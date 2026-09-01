'use strict';
/* Task 1 OfficeOps transport/cache ownership.  These tests fail if the
   isolated client is removed, if server IDs are discarded, or if a disabled
   read is allowed to replace the last successful cache. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function regexEscape(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function bindingTokens(candidate) {
  const input = String(candidate), scripts = [...input.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  const lastScriptEnd = input.toLowerCase().lastIndexOf('</script>');
  const closingHtmlAt = input.toLowerCase().indexOf('</html>', lastScriptEnd + 9);
  const appendedTail = input.slice(closingHtmlAt >= 0 ? closingHtmlAt + 7 : lastScriptEnd + 9);
  const text = scripts.length ? scripts.map(match => match[1]).join('\n') + '\n;\n' + appendedTail : input;
  const tokens = [];
  const punctuators = ['>>>=', '**=', '&&=', '||=', '??=', '<<=', '>>=', '=>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '='];
  const regexPrefixKeywords = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of', 'yield', 'await', 'else', 'do']);
  const regexPrefixPunctuators = new Set(['(', '[', '{', ',', ';', ':', '?', '!', '~', '=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=', '=>']);
  const controlKeywords = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
  const controlBlockKeywords = new Set(['else', 'do', 'try', 'finally']);
  const declarationExpressionPrefixes = new Set(['(', '[', ',', ':', '?', '!', '~', '+', '-', '*', '/', '%', '<', '>', '&', '|', '^', '=>', 'return', 'throw', 'case', 'delete', 'void', 'typeof', 'await', 'yield', 'new', 'extends', '=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);
  let i = 0, lastTokenEnd = 0;
  const push = (type, value, index, end = index + String(value).length) => {
    const lineBreakBefore = tokens.length > 0 && /[\r\n\u2028\u2029]/.test(text.slice(lastTokenEnd, index));
    tokens.push({ type, value, index, end, lineBreakBefore });
    lastTokenEnd = Math.max(lastTokenEnd, end);
  };
  const matchingOpen = (closeAt, openValue, closeValue) => {
    if (!tokens[closeAt] || tokens[closeAt].value !== closeValue) return -1;
    let depth = 0;
    for (let at = closeAt; at >= 0; at -= 1) {
      if (tokens[at].value === closeValue) depth += 1;
      else if (tokens[at].value === openValue && --depth === 0) return at;
    }
    return -1;
  };
  const closesControlParen = closeAt => {
    const openAt = matchingOpen(closeAt, '(', ')');
    return openAt >= 0 && !!(tokens[openAt - 1] && tokens[openAt - 1].type === 'identifier' && controlKeywords.has(tokens[openAt - 1].value));
  };
  const followsControlParen = () => closesControlParen(tokens.length - 1);
  const declarationKeywordAt = keywordAt => {
    let contextAt = keywordAt - 1;
    if (tokens[contextAt] && tokens[contextAt].value === 'async') contextAt -= 1;
    const preceding = tokens[contextAt];
    return !preceding || !declarationExpressionPrefixes.has(preceding.value);
  };
  const isFunctionDeclarationBlock = openAt => {
    const paramsClose = openAt - 1, paramsOpen = matchingOpen(paramsClose, '(', ')');
    if (paramsOpen < 0) return false;
    let functionAt = paramsOpen - 1;
    if (tokens[functionAt] && tokens[functionAt].type === 'identifier' && tokens[functionAt].value !== 'function') functionAt -= 1;
    if (tokens[functionAt] && tokens[functionAt].value === '*') functionAt -= 1;
    return !!(tokens[functionAt] && tokens[functionAt].value === 'function' && declarationKeywordAt(functionAt));
  };
  const isClassDeclarationBlock = openAt => {
    let classAt = openAt - 1;
    while (classAt >= 0 && ![';', '{', '}'].includes(tokens[classAt].value)) {
      if (isClassKeywordToken(tokens, classAt)) return declarationKeywordAt(classAt);
      classAt -= 1;
    }
    return false;
  };
  const followsStatementBlock = () => {
    if (!tokens.length || tokens[tokens.length - 1].value !== '}') return false;
    const openAt = matchingOpen(tokens.length - 1, '{', '}');
    if (openAt < 0) return false;
    const beforeBlock = tokens[openAt - 1];
    if (!beforeBlock) return true;
    if ((beforeBlock.value === ')' && closesControlParen(openAt - 1)) || (beforeBlock.type === 'identifier' && controlBlockKeywords.has(beforeBlock.value))) return true;
    if (isFunctionDeclarationBlock(openAt) || isClassDeclarationBlock(openAt)) return true;
    return [';', '{', '}'].includes(beforeBlock.value);
  };
  const canStartRegex = () => {
    if (!tokens.length) return true;
    const previous = tokens[tokens.length - 1];
    return regexPrefixPunctuators.has(previous.value) || (previous.type === 'identifier' && regexPrefixKeywords.has(previous.value)) || followsControlParen() || followsStatementBlock();
  };
  const consumeHtmlLineComment = markerLength => {
    i += markerLength;
    while (i < text.length && !/[\r\n\u2028\u2029]/.test(text[i])) i += 1;
  };
  const startsHtmlCloseComment = at => text.startsWith('-->', at) && (!tokens.length || /[\r\n\u2028\u2029]/.test(text.slice(lastTokenEnd, at)));
  const scanCode = stopAtTemplateBrace => {
    let braces = 0;
    while (i < text.length) {
      const start = i, ch = text[i], next = text[i + 1];
      if (/\s/.test(ch)) { i += 1; continue; }
      if (ch === '/' && next === '/') {
        i += 2;
        while (i < text.length && !/[\r\n\u2028\u2029]/.test(text[i])) i += 1;
        if (i >= text.length) break;
        continue;
      }
      if (ch === '/' && next === '*') {
        const closeAt = text.indexOf('*/', i + 2);
        if (closeAt < 0) throw new Error('malformed supplied source: unterminated block comment');
        i = closeAt + 2; continue;
      }
      if (ch === '/' && canStartRegex()) {
        let inClass = false, closed = false; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i] === '\r' || text[i] === '\n') break;
          if (text[i] === '[') inClass = true;
          else if (text[i] === ']') inClass = false;
          else if (text[i] === '/' && !inClass) { closed = true; i += 1; while (/[A-Za-z]/.test(text[i] || '')) i += 1; break; }
          i += 1;
        }
        if (!closed) throw new Error('malformed supplied source: unterminated regex literal');
        push('regex', '/', start, i); continue;
      }
      if (text.startsWith('<!--', i)) { consumeHtmlLineComment(4); continue; }
      if (startsHtmlCloseComment(i)) { consumeHtmlLineComment(3); continue; }
      if (ch === "'" || ch === '"') {
        const quote = ch; let value = '', closed = false; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { if (i + 1 < text.length) value += text[i + 1]; i += 2; continue; }
          if (text[i] === '\r' || text[i] === '\n') break;
          if (text[i] === quote) { closed = true; i += 1; break; }
          value += text[i++];
        }
        if (!closed) throw new Error('malformed supplied source: unterminated quoted string');
        push('string', value, start, i); continue;
      }
      if (ch === '`') {
        let value = '', interpolated = false, closed = false; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { if (i + 1 < text.length) value += text[i + 1]; i += 2; continue; }
          if (text[i] === '`') { closed = true; i += 1; if (!interpolated) push('string', value, start, i); break; }
          if (text[i] === '$' && text[i + 1] === '{') {
            interpolated = true; push('punctuator', '(', i, i + 2); i += 2; scanCode(true); push('punctuator', ')', i - 1, i); continue;
          }
          value += text[i++];
        }
        if (!closed) throw new Error('malformed supplied source: unterminated template literal');
        lastTokenEnd = Math.max(lastTokenEnd, i);
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        i += 1; while (i < text.length && /[A-Za-z0-9_$]/.test(text[i])) i += 1;
        push('identifier', text.slice(start, i), start, i); continue;
      }
      if (ch === '{') { braces += 1; push('punctuator', ch, start); i += 1; continue; }
      if (ch === '}') {
        if (stopAtTemplateBrace && braces === 0) { i += 1; return; }
        braces -= 1; push('punctuator', ch, start); i += 1; continue;
      }
      const punctuator = punctuators.find(value => text.startsWith(value, i));
      if (punctuator) { push('punctuator', punctuator, start); i += punctuator.length; continue; }
      push('punctuator', ch, start); i += 1;
    }
    if (stopAtTemplateBrace) throw new Error('malformed supplied source: unterminated template expression');
  };
  scanCode(false);
  return tokens;
}
function isClassKeywordToken(tokens, at) {
  const token = tokens[at], previous = tokens[at - 1], next = tokens[at + 1];
  if (!token || token.type !== 'identifier' || token.value !== 'class' || !next) return false;
  if (previous && previous.value === '.') return false;
  if ([':', '(', '=', '+=', '-=', '*=', '/=', '%=', '&&=', '||=', '??=', ',', ';', ')', ']', '.'].includes(next.value)) return false;
  return next.value === '{' || next.type === 'identifier';
}
const bindingAssignmentOperators = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);
function functionDeclarations(tokens) {
  const names = [], expressionPrefixes = new Set(['(', '[', ',', ':', '?', '!', '~', '+', '-', '=>', 'return', 'throw', 'case', 'delete', 'void', 'typeof', 'await', 'yield', 'new', 'extends', ...bindingAssignmentOperators]);
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== 'identifier' || tokens[i].value !== 'function') continue;
    const preceding = tokens[i - 1] && tokens[i - 1].value === 'async' ? tokens[i - 2] : tokens[i - 1];
    if (preceding && expressionPrefixes.has(preceding.value)) continue;
    let nameAt = i + 1;
    if (tokens[nameAt] && tokens[nameAt].value === '*') nameAt += 1;
    if (tokens[nameAt] && tokens[nameAt].type === 'identifier' && tokens[nameAt + 1] && tokens[nameAt + 1].value === '(') names.push(tokens[nameAt].value);
  }
  return names;
}
function memberToken(tokens, at) {
  if (tokens[at] && tokens[at].value === '.' && tokens[at + 1] && tokens[at + 1].type === 'identifier') return { name: tokens[at + 1].value, end: at + 2 };
  if (tokens[at] && tokens[at].value === '[' && tokens[at + 1] && tokens[at + 1].type === 'string' && tokens[at + 2] && tokens[at + 2].value === ']') return { name: tokens[at + 1].value, end: at + 3 };
  return null;
}
const groupingPrefixPunctuators = new Set(['(', '[', '{', ',', ';', ':', '?', '!', '~', '+', '-', '*', '/', '%', '<', '>', '&', '|', '^', '=', '=>', ...bindingAssignmentOperators]);
const groupingPrefixKeywords = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'await', 'yield', 'new', 'in', 'instanceof', 'of']);
const groupingControlKeywords = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
function matchingCloseToken(tokens, openAt, openValue, closeValue) {
  if (!tokens[openAt] || tokens[openAt].value !== openValue) return -1;
  let depth = 0;
  for (let at = openAt; at < tokens.length; at += 1) {
    if (tokens[at].value === openValue) depth += 1;
    else if (tokens[at].value === closeValue && --depth === 0) return at;
  }
  return -1;
}
function closesGroupedControlParen(tokens, closeAt) {
  if (!tokens[closeAt] || tokens[closeAt].value !== ')') return false;
  let depth = 0;
  for (let at = closeAt; at >= 0; at -= 1) {
    if (tokens[at].value === ')') depth += 1;
    else if (tokens[at].value === '(' && --depth === 0) return !!(tokens[at - 1] && groupingControlKeywords.has(tokens[at - 1].value));
  }
  return false;
}
function groupedSpan(tokens, start, end) {
  while (tokens[start - 1] && tokens[start - 1].value === '(' && tokens[end] && tokens[end].value === ')') {
    const beforeOpen = tokens[start - 2];
    const allowedPrefix = !beforeOpen || groupingPrefixPunctuators.has(beforeOpen.value) || (beforeOpen.type === 'identifier' && groupingPrefixKeywords.has(beforeOpen.value)) || closesGroupedControlParen(tokens, start - 2);
    if (!allowedPrefix || matchingCloseToken(tokens, start - 1, '(', ')') !== end) break;
    start -= 1;
    end += 1;
  }
  return { start, end };
}
function groupedReference(tokens, at) { return groupedSpan(tokens, at, at + 1); }
function matchingOpenToken(tokens, closeAt, openValue, closeValue) {
  if (!tokens[closeAt] || tokens[closeAt].value !== closeValue) return -1;
  let depth = 0;
  for (let at = closeAt; at >= 0; at -= 1) {
    if (tokens[at].value === closeValue) depth += 1;
    else if (tokens[at].value === openValue && --depth === 0) return at;
  }
  return -1;
}
function isFunctionExpressionBody(tokens, openAt) {
  const paramsOpen = matchingOpenToken(tokens, openAt - 1, '(', ')');
  if (paramsOpen < 0) return false;
  let functionAt = paramsOpen - 1;
  if (tokens[functionAt] && tokens[functionAt].type === 'identifier' && tokens[functionAt].value !== 'function') functionAt -= 1;
  if (tokens[functionAt] && tokens[functionAt].value === '*') functionAt -= 1;
  return !!(tokens[functionAt] && tokens[functionAt].value === 'function');
}
function isNestedClassExpressionBody(tokens, outerClassAt, openAt) {
  for (let at = openAt - 1; at > outerClassAt; at -= 1) {
    if (['{', '}', ';'].includes(tokens[at].value)) return false;
    if (isClassKeywordToken(tokens, at)) return true;
  }
  return false;
}
function isExtendsExpressionBody(tokens, outerClassAt, openAt) {
  const hasExtends = tokens.slice(outerClassAt + 1, openAt).some(token => token.type === 'identifier' && token.value === 'extends');
  return hasExtends && (isFunctionExpressionBody(tokens, openAt) || isNestedClassExpressionBody(tokens, outerClassAt, openAt));
}
function bindingStructure(tokens) {
  const bracePairs = new Map(), braceStack = [], depthAt = [], parenDepthAt = [], bracketDepthAt = [];
  let depth = 0, parens = 0, brackets = 0;
  for (let at = 0; at < tokens.length; at += 1) {
    depthAt[at] = depth;
    parenDepthAt[at] = parens;
    bracketDepthAt[at] = brackets;
    if (tokens[at].value === '{') { braceStack.push(at); depth += 1; }
    else if (tokens[at].value === '}') {
      const openAt = braceStack.pop(); depth = Math.max(0, depth - 1);
      if (Number.isInteger(openAt)) { bracePairs.set(openAt, at); bracePairs.set(at, openAt); }
    }
    else if (tokens[at].value === '(') parens += 1;
    else if (tokens[at].value === ')') parens = Math.max(0, parens - 1);
    else if (tokens[at].value === '[') brackets += 1;
    else if (tokens[at].value === ']') brackets = Math.max(0, brackets - 1);
  }
  const classRanges = [];
  for (let classAt = 0; classAt < tokens.length; classAt += 1) {
    if (!isClassKeywordToken(tokens, classAt)) continue;
    let parens = 0, brackets = 0;
    for (let at = classAt + 1; at < tokens.length; at += 1) {
      if (tokens[at].value === '(') parens += 1;
      else if (tokens[at].value === ')') parens -= 1;
      else if (tokens[at].value === '[') brackets += 1;
      else if (tokens[at].value === ']') brackets -= 1;
      else if (tokens[at].value === '{' && parens === 0 && brackets === 0) {
        const close = bracePairs.get(at);
        if (Number.isInteger(close) && isExtendsExpressionBody(tokens, classAt, at)) { at = close; continue; }
        if (Number.isInteger(close)) classRanges.push({ open: at, close });
        break;
      }
      else if ((tokens[at].value === ';' || tokens[at].value === '}') && parens === 0 && brackets === 0) break;
    }
  }
  return { bracePairs, depthAt, parenDepthAt, bracketDepthAt, classRanges };
}
function containingClass(structure, at) {
  return structure.classRanges.filter(range => range.open < at && at < range.close).sort((a, b) => (a.close - a.open) - (b.close - b.open))[0] || null;
}
function isDirectClassField(tokens, at, reference, operatorAt, structure) {
  if (!tokens[operatorAt] || tokens[operatorAt].value !== '=' || reference.start !== at || reference.end !== at + 1) return false;
  const range = containingClass(structure, at);
  if (!range || structure.depthAt[at] !== structure.depthAt[range.open] + 1 || structure.parenDepthAt[at] !== structure.parenDepthAt[range.open] || structure.bracketDepthAt[at] !== structure.bracketDepthAt[range.open]) return false;
  let fieldStart = at, boundaryAt = at - 1;
  if (tokens[boundaryAt] && tokens[boundaryAt].value === 'static') { fieldStart = boundaryAt; boundaryAt -= 1; }
  if (boundaryAt === range.open) return true;
  const boundary = tokens[boundaryAt];
  if (boundary && (boundary.value === ';' || (boundary.value === '}' && structure.bracePairs.get(boundaryAt) > range.open))) return true;
  const continuationTokens = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=', '(', '[', '{', ',', '.', ':', '?', '!', '~', '+', '-', '*', '/', '%', '<', '>', '&', '|', '^', '=>']);
  return !!(boundary && tokens[fieldStart].lineBreakBefore && !continuationTokens.has(boundary.value));
}
function bindingReassignments(tokens, protectedNames) {
  const findings = [], globals = new Set(['globalThis', 'global', 'window', 'self', 'this', 'exports']), structure = bindingStructure(tokens);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const reference = token.type === 'identifier' ? groupedReference(tokens, i) : { start: i, end: i + 1 };
    if (token.type === 'identifier' && protectedNames.has(token.value) && bindingAssignmentOperators.has(tokens[reference.end] && tokens[reference.end].value) && (!tokens[reference.start - 1] || tokens[reference.start - 1].value !== '.') && !isDirectClassField(tokens, i, reference, reference.end, structure)) {
      findings.push(token.value + ' ' + tokens[reference.end].value);
    }
    if (token.type !== 'identifier' || (tokens[reference.start - 1] && tokens[reference.start - 1].value === '.') || (token.value === 'this' && containingClass(structure, i)) || (!globals.has(token.value) && token.value !== 'module')) continue;
    let rootSpan = reference, at = rootSpan.end;
    if (token.value === 'module') {
      const exportsMember = memberToken(tokens, at);
      if (!exportsMember || exportsMember.name !== 'exports') continue;
      rootSpan = groupedSpan(tokens, rootSpan.start, exportsMember.end);
      at = rootSpan.end;
    }
    const bindingMember = memberToken(tokens, at);
    const bindingLvalue = bindingMember && groupedSpan(tokens, rootSpan.start, bindingMember.end);
    if (bindingMember && protectedNames.has(bindingMember.name) && bindingAssignmentOperators.has(tokens[bindingLvalue.end] && tokens[bindingLvalue.end].value)) {
      findings.push(token.value + '.' + bindingMember.name + ' ' + tokens[bindingLvalue.end].value);
    }
  }
  return findings;
}
function auditIsolatedFunctionBindings(candidate, requiredNames = []) {
  const tokens = bindingTokens(candidate), declarations = functionDeclarations(tokens);
  const prefixedNames = declarations.filter(name => /^(?:officeOps|commercial)/.test(name));
  const protectedNames = new Set([...requiredNames, ...prefixedNames]);
  for (const name of protectedNames) {
    const count = declarations.filter(declared => declared === name).length;
    assert.equal(count, 1, 'isolated binding declaration count for ' + name + ' must be 1, got ' + count);
  }
  const reassignments = bindingReassignments(tokens, protectedNames);
  assert.equal(reassignments.length, 0, 'isolated binding reassignment: ' + reassignments.join(', '));
  return prefixedNames;
}
function extractFunctionFrom(candidate, name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + regexEscape(name) + '\\s*\\(').exec(candidate);
  assert.ok(match, 'missing isolated function: ' + name);
  const paramsStart = candidate.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < candidate.length; i += 1) {
    if (candidate[i] === '(') params += 1;
    if (candidate[i] === ')' && --params === 0) { open = candidate.indexOf('{', i); break; }
  }
  assert.ok(open >= 0, 'isolated function body missing: ' + name);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return candidate.slice(match.index, i + 1);
  }
  assert.fail('unbalanced isolated function: ' + name);
}
function extractFunction(name) { return extractFunctionFrom(source, name); }
function extractOrderedSection(candidate, startName, endName, label) {
  const start = new RegExp('(?:async\\s+)?function\\s+' + regexEscape(startName) + '\\s*\\(').exec(candidate);
  const end = new RegExp('(?:async\\s+)?function\\s+' + regexEscape(endName) + '\\s*\\(').exec(candidate);
  assert.ok(start, label + ' start anchor missing: ' + startName);
  assert.ok(end, label + ' end anchor missing: ' + endName);
  assert.ok(start.index < end.index, label + ' anchors are not ordered');
  const section = candidate.slice(start.index, end.index);
  assert.ok(section.trim().length > 0, label + ' section is empty');
  return section;
}
function injectFunctionStatement(candidate, name, statement) {
  const original = extractFunctionFrom(candidate, name);
  const brace = original.indexOf('{');
  assert.ok(brace >= 0, 'fixture target has no body: ' + name);
  const mutated = original.slice(0, brace + 1) + statement + original.slice(brace + 1);
  assert.notEqual(mutated, original, 'fixture must mutate ' + name);
  return candidate.replace(original, mutated);
}
function discoveredIsolatedFunctionNames(candidate) {
  return auditIsolatedFunctionBindings(candidate);
}

function historyAuditRow(index, overrides = {}) {
  const action = overrides.action || 'officePilotCreate';
  return {
    action, result: 'ok', id: overrides.id || ('pilot_history_' + index), mutationId: overrides.mutationId || ('mutation_history_' + String(index).padStart(2, '0')),
    idempotencyKey: Object.hasOwn(overrides, 'idempotencyKey') ? overrides.idempotencyKey : (action.endsWith('Create') || action === 'officeConsentRecord' ? 'create_history_key_' + String(index).padStart(2, '0') : null),
    payloadSha256: 'a'.repeat(64), at: overrides.at || ('2026-08-31T09:00:' + String(index).padStart(2, '0') + '+09:00'), actor: 'representative', lifecycleBefore: null,
    backupFileId: overrides.backupFileId || ('backup_history_' + index), backupManifestFileId: overrides.backupManifestFileId || ('manifest_history_' + index),
    backupSha256: 'b'.repeat(64), preMutationRevision: Object.hasOwn(overrides, 'preMutationRevision') ? overrides.preMutationRevision : index
  };
}
function validHistoryStore(revision) {
  const audit = Array.from({ length: revision }, (_, index) => historyAuditRow(index));
  return { schemaVersion: 1, revision, updatedAt: revision ? audit[revision - 1].at : '2026-08-31T09:00:00+09:00', pilots: [], consents: [], inspections: [], opportunities: [], audit };
}
const validStoredConsent = {
  consentId: 'consent_history_1', subjectType: 'project', subjectId: 'project_1', purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
  consentVersion: 'reinspection-v1', consentTextSnapshot: 'consent snapshot', consentTextSha256: '14f8b388a01d5ec9efb2bf24eb5015621de5fe523cb8b68522b58299d94e123a',
  recordedBy: '대표', consentedAt: '2026-08-31T12:00:00+09:00', withdrawnAt: null, withdrawnBy: null, withdrawalReason: null,
  nextDueAt: '2027-02-28', lastContactedAt: null, evidenceType: 'recorded-call-note', evidenceId: 'note_1',
  audit: [{ event: 'recorded', at: '2026-08-31T12:00:00+09:00', actor: '대표', reason: null }]
};

function makeClient({ replies = [], cache = new Map(), mutationImplementation = '', timeoutMs = 11000, fetchImplementation = null,
  idbGetImplementation = null, clearTimerObserver = null } = {}) {
  const calls = [], requests = [];
  const sandbox = {
    crypto: { randomUUID: (() => { let n = 0; return () => 'uuid-' + (++n); })(), subtle: webcrypto.subtle },
    Date: class extends Date { static now() { return 0; } },
    JSON, Object, Error, Number, String, Array, Promise, URL, Intl, TextEncoder, Uint8Array, Map, Set,
    AbortController, setTimeout,
    clearTimeout: timer => { if (clearTimerObserver) clearTimerObserver(timer); clearTimeout(timer); },
    idbGet: async key => idbGetImplementation ? idbGetImplementation(key, cache) : cache.get(key),
    idbSet: async (key, value) => { cache.set(key, value); },
    fetch: async (_url, init) => {
      requests.push({ url: _url, init });
      calls.push(JSON.parse(init.body));
      if (fetchImplementation) return fetchImplementation(_url, init);
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return { ok: next && next.httpOk !== false, json: async () => next && next.body };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext("const OFFICE_OPS_REQUEST_TIMEOUT_MS=" + Number(timeoutMs) + ";const __officeOps={url:'https://office.example/ops',token:'office-token',cache:null,revision:0,updatedAt:'',loadedAt:'',loading:false};const __commercialApproval={url:'',token:'',lastTrustedNow:null};", sandbox);
  for (const name of ['normalizeHttpsUrl', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsError', 'commercialError', 'officeOpsTimeoutError', 'isRealIsoDate', 'formatKstIso', 'pilotEndsAtKst', 'parseStrictKstDateTime', 'officeOpsExactKeys', 'validOfficeString', 'normalizeOfficeTombstone', 'normalizePilotEditable', 'normalizePilotRecord', 'normalizeReinspectionConsent', 'sha256Hex', 'reinspectionNextDueAtKst', 'normalizeOfficeConsentRecord', 'validateOfficeConsentIntegrity', 'normalizeOfficeCommercialTerms', 'normalizeOfficeApprovalMetadata', 'normalizeOfficeInspectionRecord', 'validateOfficeInspectionIntegrity', 'normalizeKAptUrl', 'normalizeOfficeOpportunityRecord', 'officeOpsAuditIdValid', 'normalizeOfficeAuditRow', 'normalizeOfficeOpsStore', 'validateOfficeOpsAuditHistory', 'validateOfficeOpsStoreIntegrity', 'normalizeAndValidateOfficeOpsStore', 'officeOpsRevokeFresh', 'officeOpsActiveConsentForDraft', 'officeOpsCall', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'commercialApprovalBoot', 'officeOpsBoot']) {
    vm.runInContext(name === 'officeOpsMutationWithAck' && mutationImplementation ? mutationImplementation : extractFunction(name), sandbox);
  }
  return { sandbox, calls, requests, cache };
}

const representativeMutations = ['pilotCreate', 'pilotUpdate', 'consentDraft', 'inspectionConvert', 'contactRecord'];
async function assertRepresentativeMutationsBlocked(client, label) {
  for (const action of representativeMutations) {
    const before = client.calls.length;
    await assert.rejects(() => vm.runInContext('officeOpsMutation(' + JSON.stringify(action) + ',{})', client.sandbox), /office-disabled/, label + ' blocks ' + action);
    assert.equal(client.calls.length, before, label + ' makes zero network requests for ' + action);
  }
}

(async () => {
  let timeoutAborts = 0, timeoutSignals = 0, timeoutClears = 0;
  const timeoutClient = makeClient({ timeoutMs: 25, clearTimerObserver: () => { timeoutClears += 1; },
    fetchImplementation: (_url, init) => new Promise((resolve, reject) => {
      if (init.signal) {
        timeoutSignals += 1;
        init.signal.addEventListener('abort', () => { timeoutAborts += 1; const error = new Error('aborted'); error.name = 'AbortError'; reject(error); }, { once: true });
      }
      setTimeout(() => resolve({ ok: true, json: async () => ({ ok: true, store: validHistoryStore(0) }) }), 90);
    }) });
  let timeoutError = null;
  try { await vm.runInContext("officeOpsCall('officeOpsList',{})", timeoutClient.sandbox); }
  catch (error) { timeoutError = error; }
  assert.equal(timeoutError && timeoutError.code, 'office-timeout', 'a never-settling OfficeOps response is bounded by one stable timeout error');
  assert.match(String(timeoutError && timeoutError.message || ''), /시간이 초과.*다시 불러온 뒤 재개/, 'OfficeOps timeout gives an actionable Korean recovery message');
  assert.deepEqual({ requests: timeoutClient.calls.length, signals: timeoutSignals, aborts: timeoutAborts, clears: timeoutClears },
    { requests: 1, signals: 1, aborts: 1, clears: 1 }, 'one OfficeOps request receives one AbortSignal, aborts once, and clears its timer');
  const timeoutRequest = timeoutClient.requests[0], timeoutEnvelope = timeoutClient.calls[0];
  assert.equal(timeoutRequest.url, 'https://office.example/ops');
  assert.deepEqual(Object.keys(timeoutRequest.init).sort(), ['body','headers','method','signal']);
  assert.equal(timeoutRequest.init.method, 'POST');
  assert.deepEqual(Object.keys(timeoutRequest.init.headers), ['Content-Type']);
  assert.equal(timeoutRequest.init.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(timeoutRequest.init.signal instanceof AbortSignal, true, 'AbortSignal lives only in fetch init');
  assert.deepEqual(timeoutEnvelope, { token: 'office-token', action: 'officeOpsList', deviceId: 'uuid-1', timestamp: timeoutEnvelope.timestamp, payload: {} });
  assert.ok(Number.isFinite(Date.parse(timeoutEnvelope.timestamp)) && new Date(timeoutEnvelope.timestamp).toISOString() === timeoutEnvelope.timestamp);
  assert.deepEqual(Object.keys(timeoutEnvelope).sort(), ['action','deviceId','payload','timestamp','token'], 'timeout control never enters the exact OfficeOps envelope');

  let successClears = 0;
  const timeoutSuccess = makeClient({ timeoutMs: 25, clearTimerObserver: () => { successClears += 1; }, replies: [{ body: { ok: true, store: validHistoryStore(0) } }] });
  assert.equal((await vm.runInContext("officeOpsCall('officeOpsList',{})", timeoutSuccess.sandbox)).ok, true);
  assert.equal(successClears, 1, 'successful OfficeOps calls always clear the deadline timer');
  let errorClears = 0; const networkSentinel = new Error('network sentinel');
  const timeoutNetwork = makeClient({ timeoutMs: 25, clearTimerObserver: () => { errorClears += 1; }, replies: [networkSentinel] });
  await assert.rejects(() => vm.runInContext("officeOpsCall('officeOpsList',{})", timeoutNetwork.sandbox), error => error === networkSentinel,
    'non-timeout OfficeOps failures preserve the original error');
  assert.equal(errorClears, 1, 'non-timeout failures also clear the deadline timer');

  let jsonAborts = 0, jsonClears = 0;
  const timeoutJson = makeClient({ timeoutMs: 25, clearTimerObserver: () => { jsonClears += 1; },
    fetchImplementation: (_url, init) => {
      init.signal.addEventListener('abort', () => { jsonAborts += 1; }, { once: true });
      return Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
    } });
  await assert.rejects(() => vm.runInContext("officeOpsCall('officeOpsList',{})", timeoutJson.sandbox), error => error && error.code === 'office-timeout',
    'a response body/json read that never settles is included in the same OfficeOps deadline');
  assert.deepEqual({ requests: timeoutJson.calls.length, aborts: jsonAborts, clears: jsonClears }, { requests: 1, aborts: 1, clears: 1 });

  let lateFetchAborted = false, lateFetchCalls = 0, releaseLateDevice, observeLateFetch;
  const lateDevice = new Promise(resolve => { releaseLateDevice = resolve; });
  const lateFetchObserved = new Promise(resolve => { observeLateFetch = resolve; });
  const lateEnvelopeClient = makeClient({ timeoutMs: 25,
    idbGetImplementation: key => key === 'office_ops_device_id' ? lateDevice : undefined,
    fetchImplementation: (_url, init) => {
      lateFetchCalls += 1; lateFetchAborted = !!(init.signal && init.signal.aborted); observeLateFetch();
      const error = new Error('already aborted'); error.name = 'AbortError'; return Promise.reject(error);
    } });
  let lateError = null;
  try { await vm.runInContext("officeOpsCall('officeOpsList',{})", lateEnvelopeClient.sandbox); }
  catch (error) { lateError = error; }
  assert.equal(lateError && lateError.code, 'office-timeout', 'the timeout begins before asynchronous device/envelope work');
  assert.equal(lateFetchCalls, 0, 'the bounded caller returns before delayed device work reaches fetch');
  releaseLateDevice('device-late');
  await Promise.race([lateFetchObserved, new Promise((_, reject) => setTimeout(() => reject(new Error('late fetch observation timeout')), 1000))]);
  assert.equal(lateFetchCalls, 1);
  assert.equal(lateFetchAborted, true, 'pre-fetch work finishing after the deadline cannot start an un-aborted request');

  assert.match(source, /const OFFICE_OPS_REQUEST_TIMEOUT_MS=11000;/, 'the production OfficeOps deadline remains fixed at eleven seconds');
  assert.match(extractFunction('officeOpsCall'), /^async function officeOpsCall\(action,payload,\{mutationId\}=\{\}\)/,
    'production callers have no timeout override surface');

  const storeAtEight = validHistoryStore(8);
  const client = makeClient({ replies: [
    { body: { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: storeAtEight.updatedAt } },
    { body: { ok: true, store: storeAtEight } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", client.sandbox);
  const result = await vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{name:'same-name'})", client.sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ack)), { id: 'pilot_history_7', revision: 8, updatedAt: storeAtEight.updatedAt }, 'returned metadata preserves the exact strictly bound server ACK');
  assert.equal(client.calls.length, 2, 'mutation acknowledgement is followed by exactly one refresh read');
  const [mutation, read] = client.calls;
  assert.deepEqual(Object.keys(mutation).sort(), ['action', 'deviceId', 'mutationId', 'payload', 'timestamp', 'token'], 'OfficeOps mutation has one isolated envelope');
  assert.equal(mutation.mutationId, 'uuid-1', 'mutation gets a fresh mutation ID');
  assert.equal(mutation.deviceId, 'uuid-2', 'device identity is separate from the mutation ID');
  assert.deepEqual(Object.keys(read).sort(), ['action', 'deviceId', 'payload', 'timestamp', 'token'], 'OfficeOps read has no mutation ID');
  assert.equal(Object.hasOwn(mutation, 'ts'), false, 'legacy ts is never sent');
  assert.equal(Object.hasOwn(read, 'ts'), false, 'legacy ts is never sent on reads');
  assert.deepEqual([...client.cache.keys()], ['office_ops_device_id', 'office_ops_cache'], 'only device identity and successful normalized read cache are persisted');

  const disabledStore = validHistoryStore(4);
  const disabledCache = new Map([['office_ops_cache', { store: disabledStore, revision: disabledStore.revision, updatedAt: disabledStore.updatedAt }]]);
  const disabled = makeClient({ cache: disabledCache, replies: [{ body: { ok: false, error: 'office-disabled' } }] });
  assert.equal(await vm.runInContext('officeOpsRefresh()', disabled.sandbox), null, 'disabled reads enter export-only mode instead of treating cache as current');
  assert.equal(disabled.cache.get('office_ops_cache').revision, 4, 'disabled read retains the last successful cache');
  assert.equal(vm.runInContext('__officeOps.mode', disabled.sandbox), 'export-only', 'disabled mode blocks future mutations');
  assert.equal(disabled.calls.length, 1, 'export-only refresh makes one read only');
  await assertRepresentativeMutationsBlocked(disabled, 'actual disabled read');

  const missingGuardFixture = extractFunction('officeOpsMutationWithAck').replace("if(__officeOps.mode!=='fresh')throw new Error('office-disabled');", '');
  assert.notEqual(missingGuardFixture, extractFunction('officeOpsMutationWithAck'), 'fixture omits the fail-closed mutation guard');
  const missingGuard = makeClient({ mutationImplementation: missingGuardFixture });
  vm.runInContext("__officeOps.mode='export-only'", missingGuard.sandbox);
  let mutationGuardDetected = false;
  try { await assertRepresentativeMutationsBlocked(missingGuard, 'missing guard fixture'); }
  catch (_) { mutationGuardDetected = true; }
  assert.equal(mutationGuardDetected, true, 'representative disabled-action assertions reject a missing mutation guard fixture');

  const stale = makeClient({ cache: disabledCache });
  await vm.runInContext('officeOpsBoot()', stale.sandbox);
  assert.equal(vm.runInContext('__officeOps.mode', stale.sandbox), 'stale-export-only', 'boot cache is never treated as a current successful load');
  await assertRepresentativeMutationsBlocked(stale, 'stale boot cache');

  const unloaded = makeClient();
  await assertRepresentativeMutationsBlocked(unloaded, 'unloaded client');

  const ackThenDisabled = makeClient({ replies: [
    { body: { ok: true, id: 'pilot_history_8', revision: 9, updatedAt: '2026-08-31T09:00:08+09:00' } },
    { body: { ok: false, error: 'office-disabled' } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", ackThenDisabled.sandbox);
  await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('pilotCreate',{})", ackThenDisabled.sandbox), /office-disabled/, 'a disabled refresh after a valid ACK still fails closed');
  assert.equal(vm.runInContext('__officeOps.mode', ackThenDisabled.sandbox), 'export-only', 'ACK-followed disabled refresh switches to export-only');
  assert.equal(ackThenDisabled.calls.length, 2, 'valid ACK is followed directly by one list refresh');
  await assertRepresentativeMutationsBlocked(ackThenDisabled, 'ACK-followed disabled refresh');

  const ackThenNetworkFailure = makeClient({ replies: [
    { body: { ok: true, id: 'consent_server_1', revision: 10, updatedAt: '2026-08-31T12:00:01+09:00' } },
    new Error('list network failed')
  ] });
  vm.runInContext("__officeOps.mode='fresh';__officeOps.cache={pilots:[],consents:[{consentId:'consent_server_1',withdrawnAt:null}],inspections:[],opportunities:[],audit:[]}", ackThenNetworkFailure.sandbox);
  await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officeConsentWithdraw',{consentId:'consent_server_1'})", ackThenNetworkFailure.sandbox), /list network failed/, 'generic post-ACK reload failure is surfaced');
  assert.equal(vm.runInContext('__officeOps.mode', ackThenNetworkFailure.sandbox), 'stale-export-only', 'any post-ACK reload failure revokes fresh state');
  assert.equal(vm.runInContext("officeOpsActiveConsentForDraft('consent_server_1')", ackThenNetworkFailure.sandbox), null, 'old active consent cannot feed a draft after withdrawal ACK without strict reload');
  const callsAfterFailedReload = ackThenNetworkFailure.calls.length;
  await assert.rejects(() => vm.runInContext("officeOpsMutation('consentDraft',{})", ackThenNetworkFailure.sandbox), /office-disabled/);
  assert.equal(ackThenNetworkFailure.calls.length, callsAfterFailedReload, 'revoked mode blocks every subsequent mutation with no network request');

  const replayStore = validHistoryStore(8);
  const concurrentReplay = makeClient({ replies: [
    { body: { ok: true, id: 'pilot_history_6', revision: 7, updatedAt: replayStore.audit[6].at } },
    { body: { ok: true, store: replayStore } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", concurrentReplay.sandbox);
  const replay = await vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", concurrentReplay.sandbox);
  assert.equal(replay.store.revision, 8, 'a later concurrent revision remains valid when the acknowledged audit event is still bound in history');

  for (const [label, body] of [
    ['non-string ACK id', { ok: true, id: 7, revision: 8, updatedAt: storeAtEight.updatedAt }],
    ['non-integer ACK revision', { ok: true, id: 'pilot_history_7', revision: '8', updatedAt: storeAtEight.updatedAt }],
    ['non-KST ACK updatedAt', { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: '2026-08-31T00:00:07Z' }]
  ]) {
    const invalidAck = makeClient({ replies: [{ body }] });
    vm.runInContext("__officeOps.mode='fresh'", invalidAck.sandbox);
    await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", invalidAck.sandbox), /invalid mutation acknowledgement/, label);
    assert.equal(vm.runInContext('__officeOps.mode', invalidAck.sandbox), 'unloaded', label + ' revokes fresh state before any reload');
  }

  for (const [label, ack, reloaded] of [
    ['reload revision older than ACK', { ok: true, id: 'pilot_history_7', revision: 9, updatedAt: storeAtEight.updatedAt }, storeAtEight],
    ['ACK audit time mismatch', { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: '2026-08-31T09:00:09+09:00' }, storeAtEight],
    ['ACK ID mismatch', { ok: true, id: 'pilot_other', revision: 8, updatedAt: storeAtEight.updatedAt }, storeAtEight]
  ]) {
    const mismatched = makeClient({ replies: [{ body: ack }, { body: { ok: true, store: reloaded } }] });
    vm.runInContext("__officeOps.mode='fresh'", mismatched.sandbox);
    await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", mismatched.sandbox), /invalid mutation reload binding/, label);
    assert.equal(vm.runInContext('__officeOps.mode', mismatched.sandbox), 'stale-export-only', label + ' revokes fresh state');
  }

  const historyBase = validHistoryStore(2), second = historyBase.audit[1];
  const createDuplicate = historyAuditRow(1, { action: 'officePilotCreate', id: 'pilot_history_other', idempotencyKey: historyBase.audit[0].idempotencyKey, at: second.at });
  const nonCreateWithKey = historyAuditRow(1, { action: 'officePilotUpdate', id: 'pilot_history_other', idempotencyKey: 'forbidden_update_key', at: second.at });
  const corruptStores = [
    ['invalid consent withdrawal state', { ...historyBase, consents: [{ ...validStoredConsent, withdrawnAt: 'not-a-kst-time' }] }],
    ['revision and audit length mismatch', { ...historyBase, audit: [historyBase.audit[0]] }],
    ['non-contiguous preMutationRevision', { ...historyBase, audit: [historyBase.audit[0], { ...second, preMutationRevision: 0 }] }],
    ['duplicate mutationId', { ...historyBase, audit: [historyBase.audit[0], { ...second, mutationId: historyBase.audit[0].mutationId }] }],
    ['same-row backup artifacts', { ...historyBase, audit: [historyBase.audit[0], { ...second, backupManifestFileId: second.backupFileId }] }],
    ['globally repeated backup artifact', { ...historyBase, audit: [historyBase.audit[0], { ...second, backupFileId: historyBase.audit[0].backupFileId }] }],
    ['duplicate create action and idempotency key', { ...historyBase, audit: [historyBase.audit[0], createDuplicate] }],
    ['non-create idempotency key', { ...historyBase, audit: [historyBase.audit[0], nonCreateWithKey] }],
    ['last audit time differs from store updatedAt', { ...historyBase, updatedAt: '2026-08-31T09:00:09+09:00' }]
  ];
  for (const [label, store] of corruptStores) {
    const live = makeClient({ replies: [{ body: { ok: true, store } }] });
    vm.runInContext("__officeOps.mode='fresh'", live.sandbox);
    await assert.rejects(() => vm.runInContext('officeOpsRefresh()', live.sandbox), /invalid (OfficeOps store|consent record|audit record)/, label + ' is rejected on live load');
    assert.notEqual(vm.runInContext('__officeOps.mode', live.sandbox), 'fresh', label + ' cannot remain fresh');
    assert.equal(live.cache.has('office_ops_cache'), false, label + ' is never persisted after live load');

    const cached = new Map([['office_ops_cache', { store, revision: store.revision, updatedAt: store.updatedAt }]]);
    const boot = makeClient({ cache: cached });
    await vm.runInContext('officeOpsBoot()', boot.sandbox);
    assert.equal(vm.runInContext('__officeOps.mode', boot.sandbox), 'unloaded', label + ' cannot be promoted from IDB');
    assert.equal(vm.runInContext('__officeOps.cache', boot.sandbox), null, label + ' leaves no in-memory cache');
  }

  const exports = makeClient({ cache: disabledCache });
  const downloads = [];
  Object.assign(exports.sandbox, {
    Blob: class Blob { constructor(parts, options) { this.parts = parts; this.options = options; } },
    URL: Object.assign(URL, { createObjectURL: () => 'blob:office-cache', revokeObjectURL: () => {} }),
    document: { body: { appendChild: node => downloads.push(node) }, createElement: () => ({ click: () => {}, remove: () => {} }) },
    setTimeout: callback => callback()
  });
  vm.runInContext(extractFunction('officeOpsExportLastCache'), exports.sandbox);
  await vm.runInContext('officeOpsExportLastCache()', exports.sandbox);
  assert.equal(exports.calls.length, 0, 'allowed local cache export makes zero network requests');
  assert.equal(downloads.length, 1, 'allowed local cache export creates one local download only');

  const forbiddenOwnedSettings = /officeOps|office_ops|commercialApproval|commercial_approval/i;
  function assertProductSectionsIsolated(candidate) {
    const sections = [
      ['serialize', extractFunctionFrom(candidate, 'serializeData')],
      ['apply', extractFunctionFrom(candidate, 'applyData')],
      ['relay', extractOrderedSection(candidate, 'relayCall', 'cloudApiHealth', 'relay')],
      ['OfficeIntake', extractOrderedSection(candidate, 'officeIntakeData', 'aptSettle', 'OfficeIntake')]
    ];
    for (const [label, section] of sections) {
      assert.doesNotMatch(section, forbiddenOwnedSettings, label + ' remains isolated from OfficeOps and commercial settings');
    }
  }
  for (const [name, statement] of [
    ['serializeData', 'const officeOpsLeakFixture=1;'],
    ['applyData', 'const commercialApprovalLeakFixture=1;'],
    ['relayCall', 'const office_ops_cache_fixture=1;'],
    ['officeIntakeData', 'const commercial_approval_token_fixture=1;']
  ]) {
    const mutant = injectFunctionStatement(source, name, statement);
    assert.throws(() => assertProductSectionsIsolated(mutant), /remains isolated/, name + ' owned-setting mutant must be rejected');
  }
  const missingRelayEnd = source.replace(/function\s+cloudApiHealth\s*\(/, 'function cloudApiHealthMissing(');
  assert.notEqual(missingRelayEnd, source, 'relay boundary fixture removes the real end anchor');
  assert.throws(() => assertProductSectionsIsolated(missingRelayEnd), /relay end anchor missing/, 'missing relay boundary fails closed');
  const reversedIntake = source.replace(/function\s+aptSettle\s*\(/, 'function aptSettleMissing(');
  assert.notEqual(reversedIntake, source, 'OfficeIntake boundary fixture removes the real end anchor');
  assert.throws(() => assertProductSectionsIsolated(reversedIntake), /OfficeIntake end anchor missing/, 'missing OfficeIntake boundary fails closed');
  assertProductSectionsIsolated(source);
  const exportBody = extractFunction('officeOpsExportLastCache');
  assert.match(exportBody, /idbGet\('office_ops_cache'\)/, 'export reads only the normalized OfficeOps cache');
  assert.doesNotMatch(exportBody, /officeOpsCall|commercialCall|fetch\(/, 'export performs no network request');
  assert.doesNotMatch(source, /String\(__officeOps\.token\)\.slice\(-4\)|String\(__commercialApproval\.token\)\.slice\(-4\)/, 'settings never render credential fragments');
  for (const name of ['updateOfficePilot', 'persistReinspectionConsent', 'withdrawReinspectionConsent']) {
    assert.doesNotMatch(extractFunction(name), /pilotWindowView/, name + ' never uses the display-only pilot projection as transport input');
  }
  assert.doesNotMatch(extractFunction('pilotWindowView'), /officeOpsMutation|officeOpsCall|fetch\(/, 'pilotWindowView remains a no-network display projection');
  assert.doesNotMatch(extractFunction('normalizeKAptUrl'), /fetch\(|scrap|crawl/i, 'K-apt URL validation never scrapes');
  for (const inputId of ['ooTok', 'caTok']) {
    assert.match(source, new RegExp('id="' + inputId + '" value=""'), inputId + ' value is always blank in rendered settings HTML');
    assert.doesNotMatch(source, new RegExp('id="' + inputId + '"[^>]*value="\\$\\{'), inputId + ' never interpolates a credential into the rendered value');
  }
  const isolatedFunctions = ['normalizeHttpsUrl', 'officeOpsError', 'commercialError', 'officeOpsTimeoutError', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsCall', 'commercialRequestWithTimeout', 'commercialCall', 'commercialApprovalBoot', 'normalizeOfficeOpsStore', 'validateOfficeOpsAuditHistory', 'officeOpsRevokeFresh', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'officeOpsBoot', 'officeOpsSaveSettings', 'officeOpsClearCredentials', 'officeOpsExportLastCache'];
  const forbiddenReferences = /\bstate\b|serializeData|applyData|DATA_FILE_NAME|OFFICE_STORE_FILE|relayCall|relayBoot|__relay\b|RELAY_URL_DEFAULT|relay(?:Queue|Upload)[A-Za-z0-9_]*|relay_queue|relay_url|relay_token|\bcloudApi[A-Za-z0-9_]*|\brelayBuild[A-Za-z0-9_]*(?:Upload|Payload)[A-Za-z0-9_]*|__gd[A-Za-z0-9_]*|GD_[A-Z0-9_]*|\bgd[A-Za-z0-9_]*(?:Backup|Blob|Drive|File|Folder|Persist|Queue|Restore|Save|Sync|Token|Upload)[A-Za-z0-9_]*|__heic[A-Za-z0-9_]*|queueHeicPreview|(?:pump|process|queue)HeicPreview[A-Za-z0-9_]*|(?:photo|heic)(?:Queue|Upload)[A-Za-z0-9_]*|(?:queue|upload)(?:Photo|Heic)[A-Za-z0-9_]*|APP_TOKEN|officeIntake|OfficeIntake/i;
  for (const snippet of ['__relay.token', 'RELAY_URL_DEFAULT', "idbGet('relay_queue')", '__gdToken', 'GD_FOLDER_ID', 'queueHeicPreview(file)', 'photoUploadQueue(item)', 'cloudApiUploadFile', 'relayBuildUploadPayload', 'gdUploadBlob', '__heicPreviewQueue', 'pumpHeicPreviewQueue']) {
    assert.match(snippet, forbiddenReferences, 'relay/photo/Drive fixture must be rejected: ' + snippet);
  }
  function assertStrongTransportIsolation(candidate) {
    auditIsolatedFunctionBindings(candidate, isolatedFunctions);
    for (const name of isolatedFunctions) {
      assert.doesNotMatch(extractFunctionFrom(candidate, name), forbiddenReferences, name + ' is isolated from app state, serialization, relay, and OfficeIntake');
    }
  }

  const forbiddenCrossSurface = /relayCall|relayBoot|__relay\b|RELAY_URL_DEFAULT|relay(?:Queue|Upload)[A-Za-z0-9_]*|relay_queue|relay_url|relay_token|\bcloudApi[A-Za-z0-9_]*|\brelayBuild[A-Za-z0-9_]*(?:Upload|Payload)[A-Za-z0-9_]*|__gd[A-Za-z0-9_]*|GD_[A-Z0-9_]*|\bgd[A-Za-z0-9_]*(?:Backup|Blob|Drive|File|Folder|Persist|Queue|Restore|Save|Sync|Token|Upload)[A-Za-z0-9_]*|__heic[A-Za-z0-9_]*|queueHeicPreview|(?:pump|process|queue)HeicPreview[A-Za-z0-9_]*|(?:photo|heic)(?:Queue|Upload)[A-Za-z0-9_]*|(?:queue|upload)(?:Photo|Heic)[A-Za-z0-9_]*|officeIntake|OfficeIntake/i;
  function assertAllPrefixedFunctionsIsolated(candidate) {
    const names = discoveredIsolatedFunctionNames(candidate);
    assert.ok(names.length > 0, 'OfficeOps/commercial function discovery is empty');
    for (const name of names) {
      const body = extractFunctionFrom(candidate, name);
      assert.doesNotMatch(body, forbiddenCrossSurface, name + ' cannot route OfficeOps/commercial data to relay, Drive, OfficeIntake, or media queues');
      assert.doesNotMatch(body, /state\.aptOrders\s*\.(?:push|splice|unshift|pop|shift)\s*\(/, name + ' cannot write the local order collection directly');
    }
    return names;
  }
  const duplicateCommercialBindingMutant = source + '\nfunction commercialRequestWithTimeout(){void state.officeOpsLeak;}\n';
  const reassignedCommercialBindingMutant = source + '\ncommercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n';
  for (const [label, mutant, expectedError] of [
    ['duplicate declaration', duplicateCommercialBindingMutant, /binding declaration count/],
    ['direct reassignment', reassignedCommercialBindingMutant, /binding reassignment/],
    ['compound reassignment', source + '\ncommercialRequestWithTimeout += function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['logical reassignment', source + '\ncommercialRequestWithTimeout &&= function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['global property reassignment', source + '\nglobalThis.commercialRequestWithTimeout = function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['module property reassignment', source + '\nmodule.exports["commercialRequestWithTimeout"] = function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['grouped direct reassignment', source + '\n(commercialRequestWithTimeout)=function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['grouped global property reassignment', source + '\n(globalThis).commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['grouped classic-script this reassignment', source + '\n(this).commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['grouped window member reassignment', source + '\n(window)[`commercialRequestWithTimeout`]=function(){void state.officeOpsLeak;};\n', /binding reassignment/],
    ['grouped module property reassignment', source + '\n(module).exports.commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n', /binding reassignment/]
  ]) {
    assert.throws(() => assertStrongTransportIsolation(mutant), expectedError, 'strong scan rejects ' + label);
    assert.throws(() => assertAllPrefixedFunctionsIsolated(mutant), expectedError, 'dynamic scan rejects ' + label);
  }
  const groupedMemberMisses = [];
  for (const [label, mutant] of [
    ['grouped classic-script this dot member', source + '\n(this.commercialRequestWithTimeout)=function(){void state.officeOpsLeak;};\n'],
    ['nested grouped window quoted member', source + '\n((window["commercialRequestWithTimeout"]))=function(){void state.officeOpsLeak;};\n'],
    ['grouped globalThis template member compound', source + '\n(globalThis[`commercialRequestWithTimeout`])+=function(){void state.officeOpsLeak;};\n'],
    ['nested grouped module.exports dot member logical', source + '\n((module.exports.commercialRequestWithTimeout))&&=function(){void state.officeOpsLeak;};\n'],
    ['grouped self quoted member logical', source + '\n(self["commercialRequestWithTimeout"])??=function(){void state.officeOpsLeak;};\n'],
    ['grouped exports dot member compound', source + '\n(exports.commercialRequestWithTimeout)^=function(){void state.officeOpsLeak;};\n'],
    ['grouped module.exports root then dot member', source + '\n((module.exports)).commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n'],
    ['control-body grouped direct binding', source + '\nif(true)(commercialRequestWithTimeout)=function(){void state.officeOpsLeak;};\n'],
    ['control-body grouped true-root member', source + '\nif(true)(globalThis.commercialRequestWithTimeout)=function(){void state.officeOpsLeak;};\n']
  ]) {
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(mutant); groupedMemberMisses.push(label + ' (' + scanLabel + ')'); }
      catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
    }
  }
  assert.deepEqual(groupedMemberMisses, [], 'grouped complete-member replacements must fail closed');
  const malformedAccepted = [];
  for (const [label, candidate] of [
    ['unterminated block comment', source + '\n/* unterminated block comment'],
    ['unterminated single-quoted string', source + "\nconst malformed='unterminated"],
    ['unterminated double-quoted string', source + '\nconst malformed="unterminated'],
    ['unterminated template literal', source + '\nconst malformed=`unterminated'],
    ['unterminated template expression', source + '\nconst malformed=`value ${1 + 2'],
    ['unterminated regex literal', source + '\nconst malformed=/unterminated']
  ]) {
    try { assertStrongTransportIsolation(candidate); malformedAccepted.push(label + ' (strong)'); }
    catch (error) { if (!/malformed supplied source/.test(String(error && error.message || error))) throw error; }
    try { assertAllPrefixedFunctionsIsolated(candidate); malformedAccepted.push(label + ' (dynamic)'); }
    catch (error) { if (!/malformed supplied source/.test(String(error && error.message || error))) throw error; }
  }
  assert.deepEqual(malformedAccepted, [], 'malformed supplied Office source must fail closed');
  const lineCommentSeparatorMisses = [];
  for (const [label, candidate] of [
    ['LF line-comment reassignment', source + '\n// comment\ncommercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n'],
    ['CR line-comment reassignment', source + '\n// comment\rcommercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n'],
    ['U+2028 line-comment reassignment', source + '\n// comment\u2028commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n'],
    ['U+2029 line-comment reassignment', source + '\n// comment\u2029commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n']
  ]) {
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(candidate); lineCommentSeparatorMisses.push(label + ' (' + scanLabel + ')'); }
      catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
    }
  }
  assert.deepEqual(lineCommentSeparatorMisses, [], 'every ECMAScript line terminator must end a line comment before a protected reassignment');
  const htmlOpenCommentMisses = [];
  const commercialProbeSource = extractFunctionFrom(source, 'commercialRequestWithTimeout');
  for (const [label, separator] of [
    ['LF', '\n'],
    ['CR', '\r'],
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029']
  ]) {
    const probe = commercialProbeSource + '\nconst originalCommercialRequestWithTimeout=commercialRequestWithTimeout;\n<!-- legacy HTML open comment' + separator + 'commercialRequestWithTimeout=function(){};\noriginalCommercialRequestWithTimeout===commercialRequestWithTimeout;';
    assert.equal(vm.runInNewContext(probe), false, label + ' engine probe must execute the protected reassignment after <!--');
    const candidate = source + '\n<!-- legacy HTML open comment' + separator + 'commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n';
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(candidate); htmlOpenCommentMisses.push(label + ' (' + scanLabel + ')'); }
      catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
    }
  }
  assert.deepEqual(htmlOpenCommentMisses, [], '<!-- must stop at every ECMAScript line terminator before a protected reassignment');
  const htmlCloseCommentMisses = [];
  for (const [label, separator] of [
    ['LF', '\n'],
    ['CR', '\r'],
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029']
  ]) {
    const probe = commercialProbeSource + '\nconst originalCommercialRequestWithTimeout=commercialRequestWithTimeout;\n--> legacy HTML close comment' + separator + 'commercialRequestWithTimeout=function(){};\noriginalCommercialRequestWithTimeout===commercialRequestWithTimeout;';
    assert.equal(vm.runInNewContext(probe), false, label + ' engine probe must execute the protected reassignment after line-start -->');
    const candidate = source + '\n--> legacy HTML close comment' + separator + 'commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n';
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(candidate); htmlCloseCommentMisses.push(label + ' (' + scanLabel + ')'); }
      catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
    }
  }
  assert.deepEqual(htmlCloseCommentMisses, [], 'line-start --> must stop at every ECMAScript line terminator before a protected reassignment');
  const htmlLikeAcceptanceFailures = [];
  const htmlLikeAcceptanceFixtures = [
    ['HTML open comment at EOF', source + '\n<!-- commercialRequestWithTimeout=function(){}'],
    ['HTML close comment at EOF', source + '\n--> commercialRequestWithTimeout=function(){}'],
    ['HTML close comment after leading block comment at EOF', source + '\n \t/* lead */ --> commercialRequestWithTimeout=function(){}'],
    ['decrement-greater-than operator context', source + '\nlet officeHtmlCounter=1;const officeHtmlCompare=officeHtmlCounter-->0;\n']
  ];
  assert.equal(vm.runInNewContext(commercialProbeSource + '\nconst originalCommercialRequestWithTimeout=commercialRequestWithTimeout;\noriginalCommercialRequestWithTimeout===commercialRequestWithTimeout;\n--> commercialRequestWithTimeout=function(){}'), true, 'line-start --> engine probe keeps protected-looking EOF comment inert');
  assert.equal(vm.runInNewContext(commercialProbeSource + '\nconst originalCommercialRequestWithTimeout=commercialRequestWithTimeout;\noriginalCommercialRequestWithTimeout===commercialRequestWithTimeout;\n \t/* lead */ --> commercialRequestWithTimeout=function(){}'), true, 'line-start block-comment-prefixed --> remains an inert EOF comment');
  assert.equal(vm.runInNewContext('let officeHtmlCounter=1;const officeHtmlCompare=officeHtmlCounter-->0;officeHtmlCounter===0&&officeHtmlCompare===true;'), true, '--> in an expression remains decrement plus greater-than');
  for (const [label, candidate] of htmlLikeAcceptanceFixtures) {
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(candidate); }
      catch (error) { htmlLikeAcceptanceFailures.push(label + ' (' + scanLabel + '): ' + String(error && error.message || error)); }
    }
  }
  assert.deepEqual(htmlLikeAcceptanceFailures, [], 'valid HTML-like EOF comments and --> operator contexts must be accepted');
  const contextualAcceptanceFailures = [];
  for (const [label, candidate] of [
    ['instance class field', source + '\nclass OfficeField { commercialRequestWithTimeout = function(){} }\n'],
    ['static class field', source + '\nclass OfficeStaticField { static commercialRequestWithTimeout = function(){} }\n'],
    ['semicolonless consecutive class field', source + '\nclass OfficeConsecutiveField { other=1\ncommercialRequestWithTimeout=function(){} }\n'],
    ['semicolonless consecutive static class field', source + '\nclass OfficeConsecutiveStaticField { other=1\nstatic commercialRequestWithTimeout=function(){} }\n'],
    ['extends function expression class field', source + '\nclass OfficeExtendsFunction extends function(){} { commercialRequestWithTimeout=function(){} }\n'],
    ['extends class expression class field', source + '\nclass OfficeExtendsClass extends class {} { commercialRequestWithTimeout=function(){} }\n'],
    ['extends function expression static class field', source + '\nclass OfficeExtendsFunctionStatic extends function(){} { static commercialRequestWithTimeout=function(){} }\n'],
    ['extends class expression static class field', source + '\nclass OfficeExtendsClassStatic extends class {} { static commercialRequestWithTimeout=function(){} }\n'],
    ['named extends function expression class field', source + '\nclass OfficeNamedExtendsFunction extends function commercialRequestWithTimeout(){} { commercialRequestWithTimeout=function(){} }\n'],
    ['regex after function declaration', source + "\nfunction officeRegexHelper(){} /commercialRequestWithTimeout=/.test('x');\n"],
    ['regex after class declaration', source + "\nclass OfficeRegexHelper{} /commercialRequestWithTimeout=/.test('x');\n"],
    ['regex after plain statement block', source + "\n{ const local=1; } /commercialRequestWithTimeout=/.test('x');\n"],
    ['class-local this members', source + '\nclass OfficeThisMembers { commercialRequestWithTimeout=function(){}; run(){this.commercialRequestWithTimeout=function(){};} static {this.commercialRequestWithTimeout=function(){};} }\n']
  ]) {
    for (const [scanLabel, scan] of [['strong', assertStrongTransportIsolation], ['dynamic', assertAllPrefixedFunctionsIsolated]]) {
      try { scan(candidate); }
      catch (error) { contextualAcceptanceFailures.push(label + ' (' + scanLabel + '): ' + String(error && error.message || error)); }
    }
  }
  assert.deepEqual(contextualAcceptanceFailures, [], 'valid class fields and post-block regex statements must be accepted');
  for (const [label, mutant] of [
    ['outer assignment inside class method', source + '\nclass OfficeMethod { run(){ commercialRequestWithTimeout=function(){}; } }\n'],
    ['outer assignment inside static block', source + '\nclass OfficeStaticBlock { static { commercialRequestWithTimeout=function(){}; } }\n'],
    ['outer assignment inside field initializer', source + '\nclass OfficeFieldInitializer { value=(commercialRequestWithTimeout=function(){}); }\n'],
    ['object-literal division assignment', source + '\nconst officeQuotient={n:1}/(commercialRequestWithTimeout=function(){},2);\n'],
    ['function-expression division assignment', source + '\nconst officeFunctionQuotient=function helper(){return 1;}/(commercialRequestWithTimeout=function(){},2);\n'],
    ['class-expression division assignment', source + '\nconst officeClassQuotient=class {}/(commercialRequestWithTimeout=function(){},2);\n'],
    ['arrow-body division assignment', source + '\nconst officeArrowQuotient=(()=>{})/(commercialRequestWithTimeout=function(){},2);\n'],
    ['property-named-class phantom range', source + '\nobj.class;{commercialRequestWithTimeout=function(){};}\n'],
    ['object-key-class phantom range', source + '\nconst officeMarker={class:true};{commercialRequestWithTimeout=function(){};}\n'],
    ['outer assignment inside extends function body', source + '\nclass OfficeExtendsFunctionWrite extends function helper(){ commercialRequestWithTimeout=function(){}; } { safe=1 }\n']
  ]) {
    assert.throws(() => assertStrongTransportIsolation(mutant), /binding reassignment/, 'strong scan rejects ' + label);
    assert.throws(() => assertAllPrefixedFunctionsIsolated(mutant), /binding reassignment/, 'dynamic scan rejects ' + label);
  }
  const ordinaryObjectFixture = source + '\nconst commercialDiagnostics={commercialRequestWithTimeout:function(){return null;}};commercialDiagnostics.commercialRequestWithTimeout=function(){return null;};const namedDiagnostic=function commercialRequestWithTimeout(){return null;};\n';
  assertStrongTransportIsolation(ordinaryObjectFixture);
  assertAllPrefixedFunctionsIsolated(ordinaryObjectFixture);
  for (const [label, mutant] of [
    ['template expression reassignment accepted', source + '\nconst p=`${(commercialRequestWithTimeout=function(){void state.officeOpsLeak;})}`;\n'],
    ['static template member reassignment accepted', source + '\nglobalThis[`commercialRequestWithTimeout`]=function(){void state.officeOpsLeak;};\n'],
    ['classic-script this reassignment accepted', source + '\nthis.commercialRequestWithTimeout=function(){void state.officeOpsLeak;};\n'],
    ['classic-script this member reassignment accepted', source + '\nthis["commercialRequestWithTimeout"]=function(){void state.officeOpsLeak;};\n']
  ]) {
    assert.throws(() => assertStrongTransportIsolation(mutant), /binding reassignment/, 'strong scan: ' + label);
    assert.throws(() => assertAllPrefixedFunctionsIsolated(mutant), /binding reassignment/, 'dynamic scan: ' + label);
  }
  for (const [label, fixture] of [
    ['async named function expression rejected', source + '\nconst asyncNamed=async function commercialRequestWithTimeout(){return null;};\n'],
    ['unary named function expression rejected', source + '\n!function commercialRequestWithTimeout(){return null;};\n'],
    ['unary async named function expression rejected', source + '\nvoid async function commercialRequestWithTimeout(){return null;};\n'],
    ['control-paren regex rejected', source + "\nif(true) /commercialRequestWithTimeout=/.test('x');\n"],
    ['control-block regex rejected', source + "\nif(true){} /commercialRequestWithTimeout=/.test('x');\n"],
    ['comment or string text rejected', source + '\nconst bindingText="commercialRequestWithTimeout=";/* commercialRequestWithTimeout=function(){} */\n'],
    ['common regex literal rejected', source + "\nconst regexMatch=/commercialRequestWithTimeout=/.test('x');\n"],
    ['line comment at EOF rejected', source + '\n// valid line comment at EOF'],
    ['escaped quoted strings rejected', source + '\nconst escapedSingle=\'it\\\'s\';const escapedDouble="a\\\"b";\n'],
    ['regex character class rejected', source + '\nconst characterClass=/[a-z=]+/;\n'],
    ['nested template interpolation rejected', source + '\nconst nestedTemplate=`outer ${`inner ${1+2}`}`;\n'],
    ['multiline template rejected', source + '\nconst multilineTemplate=`line one\nline two`;\n'],
    ['HTML close text inside appended string rejected', source + '\nconst htmlCloseText="</html>";\n'],
    ['nested global/this/module properties rejected', source + '\nconst diagnostics={window:{},this:{},module:{exports:{}}};diagnostics.window.commercialRequestWithTimeout=function(){return null;};diagnostics.this.commercialRequestWithTimeout=function(){return null;};diagnostics.module.exports.commercialRequestWithTimeout=function(){return null;};\n'],
    ['grouped nested ordinary members rejected', source + '\nconst groupedDiagnostics={window:{},module:{exports:{}}};(groupedDiagnostics.window.commercialRequestWithTimeout)=function(){return null;};(groupedDiagnostics.module.exports.commercialRequestWithTimeout)=function(){return null;};\n']
  ]) {
    assertStrongTransportIsolation(fixture);
    assertAllPrefixedFunctionsIsolated(fixture);
  }
  const commercialStateLeakMutant = injectFunctionStatement(source, 'commercialRequestWithTimeout', 'void state.officeOpsLeak;');
  assert.throws(() => assertStrongTransportIsolation(commercialStateLeakMutant), /commercialRequestWithTimeout is isolated/, 'strong transport isolation rejects commercial deadline state access');
  assertStrongTransportIsolation(source);
  for (const statement of [
    'void __relay.token;',
    'void __gdToken;',
    'photoUploadQueue(item);',
    'queueHeicPreview(file);',
    'officeIntakeQueueOrderStatus(row);'
  ]) {
    const mutant = injectFunctionStatement(source, 'officeOpsError', statement);
    assert.throws(() => assertAllPrefixedFunctionsIsolated(mutant), /cannot route/, 'cross-surface mutant must be rejected');
  }
  const discoveredFunctions = assertAllPrefixedFunctionsIsolated(source);
  for (const requiredName of [
    'officeOpsNormalizeConversionCandidateInvariant', 'officeOpsAssertConversionCandidate', 'officeOpsAssertUniqueLocalOrderIds',
    'officeOpsAssertDurableConversionOrder', 'officeOpsFenceDurableConversionCandidate', 'officeOpsConversionFenceRecoveryError',
    'officeOpsAssertFenceRelease', 'officeOpsConversionStageFromStore', 'officeOpsTerminalConversionStep'
  ]) assert.ok(discoveredFunctions.includes(requiredName), 'automatic OfficeOps function discovery must include ' + requiredName);
  for (const name of ['officeOpsDriveInspectionConversion', 'convertOfficeOpsInspectionToAptOrder', 'resumeOfficeOpsInspectionConversion', 'cancelOfficeOpsInspectionConversion']) {
    assert.doesNotMatch(extractFunction(name), /\bofficeOpsMutation\s*\(/, name + ' uses only the ACK-bound OfficeOps mutation path');
  }
  assert.match(extractFunction('officeOpsDriveInspectionConversion'), /executePaidWorkGate\(/, 'the conversion driver delegates its only local create to the paid gate');
  assert.doesNotMatch(extractFunction('officeOpsDriveInspectionConversion'), /issueCommercialApproval\(/, 'resume stages never issue a new receipt');
  assert.doesNotMatch(extractFunction('resumeOfficeOpsInspectionConversion').replace(/^async function resumeOfficeOpsInspectionConversion[^\{]*\{/, ''), /resumeOfficeOpsInspectionConversion\s*\(/, 'resume is bounded and non-recursive');
  const cancelBody = extractFunction('cancelOfficeOpsInspectionConversion');
  assert.doesNotMatch(cancelBody, /issueCommercialApproval|validateCommercialApproval|hjSnapshot|executePaidWorkGate/, 'cancel has no commercial, snapshot, or local-order effect');
  assert.deepEqual((extractFunction('officeOpsAptOrderDraft').match(/sourceOfficeOps[A-Za-z]+/g) || []).sort(), ['sourceOfficeOpsConversionId','sourceOfficeOpsInspectionId'], 'draft carries only the two approved OfficeOps source IDs');
  assert.doesNotMatch(extractFunction('officeOpsInspectionCardHtml'), /receiptHmac|approvalEvidenceFileId|approvalEvidenceSha256|conversionReceiptId|conversionTermsSha256/, 'conversion cards never render signed receipt or proof secrets');

  const queueSandbox = { state: { aptOrders: [], officeIntake: { outbox: [] } }, queued: 0, setTimeout, officeIntakeQueueOrderStatus: () => { queueSandbox.queued += 1; } };
  vm.createContext(queueSandbox); vm.runInContext(extractFunction('officeIntakeQueueCommittedOrderStatus'), queueSandbox);
  const queueResult = vm.runInContext("officeIntakeQueueCommittedOrderStatus({id:'order_1',source:'officeops-preventive-inspection',status:'visit'})", queueSandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(queueResult)), { queued: false, skipped: true }, 'OfficeOps-created paid order is not projected into OfficeIntake');
  assert.equal(queueSandbox.queued, 0, 'OfficeOps-created paid order makes zero OfficeIntake queue calls');
  console.log('PASS  OfficeOps isolated envelopes, acknowledgements, cache ownership, and legacy boundaries');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

/* pages-artifact.e2e.js — GitHub Pages 공개 산출물 허용목록 검사

   보호하는 사고: backup/index_v104_original.html, tests/, apps-script/ 같은
   저장소 내부 파일이 Pages에서 실행·열람 가능한 상태로 배포되는 것. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const nodeAssert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hj-pages-artifact-'));
const out = path.join(temp, '_site');
const expected = ['.nojekyll', 'index.html', 'privacy.html', 'sw.js', 'terms.html'];
const assert = (v, m) => { if (!v) throw new Error(m); };
const requiredGuards = [
  'syntax.check.js', 'dead-endpoint.check.js', 'cost-honesty.check.js',
  'version-sync.check.js', 'sw-cache.check.js', 'pages-artifact.e2e.js',
  'office-ops-isolation.e2e.js', 'office-ops-ui.e2e.js', 'paid-work-gate.e2e.js',
  'apt-commercial-ui.e2e.js', 'legacy-commercial-gate.e2e.js',
  'office-ops-conversion.e2e.js', 'relay.e2e.js',
  'ai-high-risk-confirm.e2e.js', 'sensitive-query.e2e.js'
];

function assertRequiredGuards(testNames, label) {
  const names = testNames instanceof Set ? testNames : new Set(testNames);
  const missing = requiredGuards.filter(name => !/\.(check|unit|e2e)\.js$/.test(name) || !names.has(name));
  assert(missing.length === 0, label + ' 필수 검사 누락: ' + missing.join(', '));
}

function regexEscape(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function bindingTokens(candidate) {
  const tokens = [], text = String(candidate);
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
  const findings = [], globals = new Set(['globalThis', 'global', 'window', 'self', 'exports']), structure = bindingStructure(tokens);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const reference = token.type === 'identifier' ? groupedReference(tokens, i) : { start: i, end: i + 1 };
    if (token.type === 'identifier' && protectedNames.has(token.value) && bindingAssignmentOperators.has(tokens[reference.end] && tokens[reference.end].value) && (!tokens[reference.start - 1] || tokens[reference.start - 1].value !== '.') && !isDirectClassField(tokens, i, reference, reference.end, structure)) {
      findings.push(token.value + ' ' + tokens[reference.end].value);
    }
    if (token.type !== 'identifier' || (tokens[reference.start - 1] && tokens[reference.start - 1].value === '.') || (!globals.has(token.value) && token.value !== 'module')) continue;
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
function assertUniqueRunnerBinding(candidate) {
  const tokens = bindingTokens(candidate), count = functionDeclarations(tokens).filter(name => name === 'listSuite').length;
  if (count === 0) throw new Error('runner function missing: listSuite');
  assert(count === 1, 'runner binding declaration count for listSuite must be 1, got ' + count);
  const reassignments = bindingReassignments(tokens, new Set(['listSuite']));
  assert(reassignments.length === 0, 'runner binding reassignment: ' + reassignments.join(', '));
}
function extractFunctionFrom(candidate, name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + regexEscape(name) + '\\s*\\(').exec(candidate);
  assert(match, 'runner function missing: ' + name);
  const paramsStart = candidate.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < candidate.length; i += 1) {
    if (candidate[i] === '(') params += 1;
    if (candidate[i] === ')' && --params === 0) { open = candidate.indexOf('{', i); break; }
  }
  assert(open >= 0, 'runner function body missing: ' + name);
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
  throw new Error('runner function unbalanced: ' + name);
}
function noFilterSuiteBasenames(candidate) {
  assertUniqueRunnerBinding(candidate);
  const sandbox = { fs, path, process: { argv: ['node', 'tests/run-all.js'] }, TESTS: path.join(root, 'tests') };
  vm.createContext(sandbox);
  vm.runInContext(extractFunctionFrom(candidate, 'listSuite'), sandbox);
  const suite = vm.runInContext('listSuite()', sandbox);
  assert(Array.isArray(suite), 'listSuite() did not return an array');
  return suite.map(file => path.basename(String(file)));
}
function withoutRunnerGuard(candidate, guard) {
  const original = extractFunctionFrom(candidate, 'listSuite');
  const mutated = original.replace(/return\s+(\[[\s\S]*?\]);/, "return $1.filter(file => path.basename(file) !== " + JSON.stringify(guard) + ');');
  assert(mutated !== original, 'runner mutant did not alter listSuite');
  return candidate.replace(original, mutated);
}
function assertRunnerContainsRequiredGuards(candidate, label) {
  const suite = new Set(noFilterSuiteBasenames(candidate));
  const missing = requiredGuards.filter(name => !suite.has(name));
  assert(missing.length === 0, label + ' 무필터 run-all 필수 검사 누락: ' + missing.join(', '));
  return suite;
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).replace(/\\/g, '/')];
  });
}

try {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'stage-pages.mjs'), out], {
    cwd: root, encoding: 'utf8'
  });
  assert(run.status === 0, 'Pages staging 실패: ' + String(run.stderr || run.stdout || 'exit ' + run.status).trim());
  const files = walk(out).sort();
  assert(JSON.stringify(files) === JSON.stringify(expected),
    '공개 산출물이 허용목록과 다르다\nwant: ' + expected.join(', ') + '\n got: ' + files.join(', '));
  assert(!fs.existsSync(path.join(out, 'backup', 'index_v104_original.html')), '공개 백업 HTML이 산출물에 포함됐다');
  assert(!fs.existsSync(path.join(out, 'tests')) && !fs.existsSync(path.join(out, 'apps-script')), '내부 테스트/서버 소스가 산출물에 포함됐다');

  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  // 게이트는 run-all.js 를 "인자 없이" 불러야 한다 — 인자를 붙이면 필터가 걸려
  // 전체 스위트가 아니라 일부만 돌면서도 초록불이 켜진다. 그게 예전 8/82 사고다.
  assert(/node\s+tests\/run-all\.js\s*$/m.test(workflow),
    '워크플로가 전체 러너(node tests/run-all.js, 인자 없이)를 실행하지 않는다');
  assert(/uses:\s*actions\/checkout@v7[\s\S]*?with:[\s\S]*?fetch-depth:\s*0[\s\S]*?- name:\s*Setup Node\.js/.test(workflow),
    '고정 기준 커밋의 조상 검사를 위해 Checkout 전체 이력(fetch-depth: 0)이 필요하다');
  // 수익·승인·격리·중계 회귀까지 포함한 필수 검사가 러너의 자동 수집 범위에
  // 실제 파일로 존재하는지 — 파일 삭제/개명으로 녹색이 되는 일을 막는다.
  const testNames = new Set(fs.readdirSync(path.join(root, 'tests')));
  const missingGuardMutant = new Set(testNames);
  missingGuardMutant.delete('office-ops-conversion.e2e.js');
  nodeAssert.throws(() => assertRequiredGuards(missingGuardMutant, 'mutant'), /office-ops-conversion\.e2e\.js/, 'missing deployment guard fixture must be rejected');
  assertRequiredGuards(testNames, '배포 전');
  const runner = fs.readFileSync(path.join(root, 'tests', 'run-all.js'), 'utf8');
  const missingListSuiteMutant = runner.replace(/function\s+listSuite\s*\(/, 'function listSuiteMissing(');
  assert(missingListSuiteMutant !== runner, 'missing listSuite fixture must alter the runner');
  nodeAssert.throws(() => noFilterSuiteBasenames(missingListSuiteMutant), /runner function missing: listSuite/, 'missing listSuite extraction fails closed');
  const unbalancedListSuiteMutant = extractFunctionFrom(runner, 'listSuite').slice(0, -1);
  nodeAssert.throws(() => extractFunctionFrom(unbalancedListSuiteMutant, 'listSuite'), /runner function unbalanced: listSuite/, 'unbalanced listSuite extraction fails closed');
  const filteredRunnerMutant = withoutRunnerGuard(runner, 'office-ops-conversion.e2e.js');
  assert(testNames.has('office-ops-conversion.e2e.js'), 'runner mutant prerequisite keeps the required test file on disk');
  nodeAssert.throws(() => assertRunnerContainsRequiredGuards(filteredRunnerMutant, 'mutant'), /office-ops-conversion\.e2e\.js/, 'no-filter runner mutation must be rejected while the file stays on disk');
  assertRunnerContainsRequiredGuards(runner, '배포 전 실제');
  const duplicateRunnerBindingMutant = runner + "\nfunction listSuite(){return fs.readdirSync(TESTS).filter(file=>/\\.(?:check|unit|e2e)\\.js$/.test(file)&&file!=='office-ops-conversion.e2e.js').map(file=>path.join('tests',file));}\n";
  const reassignedRunnerBindingMutant = runner + "\nlistSuite=function(){return fs.readdirSync(TESTS).filter(file=>/\\.(?:check|unit|e2e)\\.js$/.test(file)&&file!=='office-ops-conversion.e2e.js').map(file=>path.join('tests',file));};\n";
  for (const [label, mutant, expectedError] of [
    ['duplicate declaration', duplicateRunnerBindingMutant, /binding declaration count/],
    ['direct reassignment', reassignedRunnerBindingMutant, /binding reassignment/],
    ['compound reassignment', runner + '\nlistSuite += "disabled";\n', /binding reassignment/],
    ['logical reassignment', runner + '\nlistSuite &&= function(){return [];};\n', /binding reassignment/],
    ['global property reassignment', runner + '\nglobalThis.listSuite = function(){return [];};\n', /binding reassignment/],
    ['module property reassignment', runner + '\nmodule.exports["listSuite"] = function(){return [];};\n', /binding reassignment/],
    ['grouped direct reassignment', runner + '\n(listSuite)=function(){return [];};\n', /binding reassignment/],
    ['grouped global property reassignment', runner + '\n(globalThis).listSuite=function(){return [];};\n', /binding reassignment/],
    ['grouped module property reassignment', runner + '\n(module).exports.listSuite=function(){return [];};\n', /binding reassignment/]
  ]) nodeAssert.throws(() => assertRunnerContainsRequiredGuards(mutant, 'binding mutant'), expectedError, label + ' must fail closed');
  const groupedMemberMisses = [];
  for (const [label, mutant] of [
    ['grouped globalThis dot member', runner + '\n(globalThis.listSuite)=function(){return [];};\n'],
    ['grouped module.exports dot member', runner + '\n(module.exports.listSuite)=function(){return [];};\n'],
    ['nested grouped global quoted member compound', runner + '\n((global["listSuite"]))+=function(){return [];};\n'],
    ['nested grouped window template member logical', runner + '\n((window[`listSuite`]))||=function(){return [];};\n'],
    ['grouped self dot member logical', runner + '\n(self.listSuite)??=function(){return [];};\n'],
    ['grouped exports quoted member compound', runner + '\n(exports["listSuite"])^=function(){return [];};\n'],
    ['grouped module.exports root then dot member', runner + '\n((module.exports)).listSuite=function(){return [];};\n'],
    ['control-body grouped direct binding', runner + '\nif(true)(listSuite)=function(){return [];};\n'],
    ['control-body grouped true-root member', runner + '\nif(true)(globalThis.listSuite)=function(){return [];};\n']
  ]) {
    try { assertRunnerContainsRequiredGuards(mutant, 'grouped member mutant'); groupedMemberMisses.push(label); }
    catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
  }
  nodeAssert.deepEqual(groupedMemberMisses, [], 'grouped complete-member replacements must fail closed');
  const malformedAccepted = [];
  for (const [label, candidate] of [
    ['unterminated block comment', runner + '\n/* unterminated block comment'],
    ['unterminated single-quoted string', runner + "\nconst malformed='unterminated"],
    ['unterminated double-quoted string', runner + '\nconst malformed="unterminated'],
    ['unterminated template literal', runner + '\nconst malformed=`unterminated'],
    ['unterminated template expression', runner + '\nconst malformed=`value ${1 + 2'],
    ['unterminated regex literal', runner + '\nconst malformed=/unterminated']
  ]) {
    try { assertRunnerContainsRequiredGuards(candidate, 'malformed source fixture'); malformedAccepted.push(label); }
    catch (error) { if (!/malformed supplied source/.test(String(error && error.message || error))) throw error; }
  }
  nodeAssert.deepEqual(malformedAccepted, [], 'malformed supplied runner source must fail closed');
  const lineCommentSeparatorMisses = [];
  for (const [label, candidate] of [
    ['LF line-comment reassignment', runner + '\n// comment\nlistSuite=function(){return [];};\n'],
    ['CR line-comment reassignment', runner + '\n// comment\rlistSuite=function(){return [];};\n'],
    ['U+2028 line-comment reassignment', runner + '\n// comment\u2028listSuite=function(){return [];};\n'],
    ['U+2029 line-comment reassignment', runner + '\n// comment\u2029listSuite=function(){return [];};\n']
  ]) {
    try { assertRunnerContainsRequiredGuards(candidate, 'line-comment separator mutant'); lineCommentSeparatorMisses.push(label); }
    catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
  }
  nodeAssert.deepEqual(lineCommentSeparatorMisses, [], 'every ECMAScript line terminator must end a line comment before a protected reassignment');
  const htmlOpenCommentMisses = [];
  const listSuiteProbeSource = extractFunctionFrom(runner, 'listSuite');
  for (const [label, separator] of [
    ['LF', '\n'],
    ['CR', '\r'],
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029']
  ]) {
    const probe = listSuiteProbeSource + '\nconst originalListSuite=listSuite;\n<!-- legacy HTML open comment' + separator + 'listSuite=function(){return [];};\noriginalListSuite===listSuite;';
    nodeAssert.equal(vm.runInNewContext(probe), false, label + ' engine probe must execute the protected reassignment after <!--');
    const candidate = runner + '\n<!-- legacy HTML open comment' + separator + 'listSuite=function(){return [];};\n';
    try { assertRunnerContainsRequiredGuards(candidate, 'HTML open-comment mutant'); htmlOpenCommentMisses.push(label); }
    catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
  }
  nodeAssert.deepEqual(htmlOpenCommentMisses, [], '<!-- must stop at every ECMAScript line terminator before a protected reassignment');
  const htmlCloseCommentMisses = [];
  for (const [label, separator] of [
    ['LF', '\n'],
    ['CR', '\r'],
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029']
  ]) {
    const probe = listSuiteProbeSource + '\nconst originalListSuite=listSuite;\n--> legacy HTML close comment' + separator + 'listSuite=function(){return [];};\noriginalListSuite===listSuite;';
    nodeAssert.equal(vm.runInNewContext(probe), false, label + ' engine probe must execute the protected reassignment after line-start -->');
    const candidate = runner + '\n--> legacy HTML close comment' + separator + 'listSuite=function(){return [];};\n';
    try { assertRunnerContainsRequiredGuards(candidate, 'HTML close-comment mutant'); htmlCloseCommentMisses.push(label); }
    catch (error) { if (!/binding reassignment/.test(String(error && error.message || error))) throw error; }
  }
  nodeAssert.deepEqual(htmlCloseCommentMisses, [], 'line-start --> must stop at every ECMAScript line terminator before a protected reassignment');
  const htmlLikeAcceptanceFailures = [];
  const htmlLikeAcceptanceFixtures = [
    ['HTML open comment at EOF', runner + '\n<!-- listSuite=function(){return [];}'],
    ['HTML close comment at EOF', runner + '\n--> listSuite=function(){return [];}'],
    ['HTML close comment after leading block comment at EOF', runner + '\n \t/* lead */ --> listSuite=function(){return [];}'],
    ['decrement-greater-than operator context', runner + '\nlet pageHtmlCounter=1;const pageHtmlCompare=pageHtmlCounter-->0;\n']
  ];
  nodeAssert.equal(vm.runInNewContext(listSuiteProbeSource + '\nconst originalListSuite=listSuite;\noriginalListSuite===listSuite;\n--> listSuite=function(){return [];}'), true, 'line-start --> engine probe keeps protected-looking EOF comment inert');
  nodeAssert.equal(vm.runInNewContext(listSuiteProbeSource + '\nconst originalListSuite=listSuite;\noriginalListSuite===listSuite;\n \t/* lead */ --> listSuite=function(){return [];}'), true, 'line-start block-comment-prefixed --> remains an inert EOF comment');
  nodeAssert.equal(vm.runInNewContext('let pageHtmlCounter=1;const pageHtmlCompare=pageHtmlCounter-->0;pageHtmlCounter===0&&pageHtmlCompare===true;'), true, '--> in an expression remains decrement plus greater-than');
  for (const [label, candidate] of htmlLikeAcceptanceFixtures) {
    try { assertRunnerContainsRequiredGuards(candidate, 'HTML-like acceptance fixture'); }
    catch (error) { htmlLikeAcceptanceFailures.push(label + ': ' + String(error && error.message || error)); }
  }
  nodeAssert.deepEqual(htmlLikeAcceptanceFailures, [], 'valid HTML-like EOF comments and --> operator contexts must be accepted');
  const contextualAcceptanceFailures = [];
  for (const [label, candidate] of [
    ['instance class field', runner + '\nclass PageField { listSuite = function(){} }\n'],
    ['static class field', runner + '\nclass PageStaticField { static listSuite = function(){} }\n'],
    ['semicolonless consecutive class field', runner + '\nclass PageConsecutiveField { other=1\nlistSuite=function(){} }\n'],
    ['semicolonless consecutive static class field', runner + '\nclass PageConsecutiveStaticField { other=1\nstatic listSuite=function(){} }\n'],
    ['extends function expression class field', runner + '\nclass PageExtendsFunction extends function(){} { listSuite=function(){} }\n'],
    ['extends class expression class field', runner + '\nclass PageExtendsClass extends class {} { listSuite=function(){} }\n'],
    ['extends function expression static class field', runner + '\nclass PageExtendsFunctionStatic extends function(){} { static listSuite=function(){} }\n'],
    ['extends class expression static class field', runner + '\nclass PageExtendsClassStatic extends class {} { static listSuite=function(){} }\n'],
    ['named extends function expression class field', runner + '\nclass PageNamedExtendsFunction extends function listSuite(){} { listSuite=function(){} }\n'],
    ['regex after function declaration', runner + "\nfunction pageRegexHelper(){} /listSuite=/.test('x');\n"],
    ['regex after class declaration', runner + "\nclass PageRegexHelper{} /listSuite=/.test('x');\n"],
    ['regex after plain statement block', runner + "\n{ const local=1; } /listSuite=/.test('x');\n"]
  ]) {
    try { assertRunnerContainsRequiredGuards(candidate, 'contextual acceptance fixture'); }
    catch (error) { contextualAcceptanceFailures.push(label + ': ' + String(error && error.message || error)); }
  }
  nodeAssert.deepEqual(contextualAcceptanceFailures, [], 'valid class fields and post-block regex statements must be accepted');
  for (const [label, mutant] of [
    ['outer assignment inside class method', runner + '\nclass PageMethod { run(){ listSuite=function(){return [];}; } }\n'],
    ['outer assignment inside static block', runner + '\nclass PageStaticBlock { static { listSuite=function(){return [];}; } }\n'],
    ['outer assignment inside field initializer', runner + '\nclass PageFieldInitializer { value=(listSuite=function(){return [];}); }\n'],
    ['object-literal division assignment', runner + '\nconst pageQuotient={n:1}/(listSuite=function(){return [];},2);\n'],
    ['function-expression division assignment', runner + '\nconst pageFunctionQuotient=function helper(){return 1;}/(listSuite=function(){return [];},2);\n'],
    ['class-expression division assignment', runner + '\nconst pageClassQuotient=class {}/(listSuite=function(){return [];},2);\n'],
    ['arrow-body division assignment', runner + '\nconst pageArrowQuotient=(()=>{})/(listSuite=function(){return [];},2);\n'],
    ['property-named-class phantom range', runner + '\nobj.class;{listSuite=function(){return [];};}\n'],
    ['object-key-class phantom range', runner + '\nconst pageMarker={class:true};{listSuite=function(){return [];};}\n'],
    ['outer assignment inside extends function body', runner + '\nclass PageExtendsFunctionWrite extends function helper(){ listSuite=function(){return [];}; } { safe=1 }\n']
  ]) nodeAssert.throws(() => assertRunnerContainsRequiredGuards(mutant, 'contextual binding mutant'), /binding reassignment/, label + ' must remain rejected');
  const ordinaryObjectFixture = runner + '\nconst runnerDiagnostics={listSuite:function(){return [];}};runnerDiagnostics.listSuite=function(){return [];};const namedDiagnostic=function listSuite(){return [];};\n';
  assertRunnerContainsRequiredGuards(ordinaryObjectFixture, 'ordinary object property fixture');
  for (const [label, mutant] of [
    ['template expression reassignment accepted', runner + '\nconst p=`${(listSuite=function(){return [];})}`;\n'],
    ['static template member reassignment accepted', runner + '\nglobalThis[`listSuite`]=function(){return [];};\n']
  ]) nodeAssert.throws(() => assertRunnerContainsRequiredGuards(mutant, 'adversarial binding mutant'), /binding reassignment/, label);
  for (const [label, fixture] of [
    ['async named function expression rejected', runner + '\nconst asyncNamed=async function listSuite(){return [];};\n'],
    ['unary named function expression rejected', runner + '\n!function listSuite(){return [];};\n'],
    ['unary async named function expression rejected', runner + '\nvoid async function listSuite(){return [];};\n'],
    ['control-paren regex rejected', runner + "\nif(true) /listSuite=/.test('x');\n"],
    ['control-block regex rejected', runner + "\nif(true){} /listSuite=/.test('x');\n"],
    ['comment or string text rejected', runner + '\nconst bindingText="listSuite=";/* listSuite=function(){} */\n'],
    ['common regex literal rejected', runner + "\nconst regexMatch=/listSuite=/.test('x');\n"],
    ['line comment at EOF rejected', runner + '\n// valid line comment at EOF'],
    ['escaped quoted strings rejected', runner + '\nconst escapedSingle=\'it\\\'s\';const escapedDouble="a\\\"b";\n'],
    ['regex character class rejected', runner + '\nconst characterClass=/[a-z=]+/;\n'],
    ['nested template interpolation rejected', runner + '\nconst nestedTemplate=`outer ${`inner ${1+2}`}`;\n'],
    ['multiline template rejected', runner + '\nconst multilineTemplate=`line one\nline two`;\n'],
    ['nested global/module properties rejected', runner + '\nconst diagnostics={globalThis:{},module:{exports:{}}};diagnostics.globalThis.listSuite=function(){return [];};diagnostics.module.exports.listSuite=function(){return [];};\n'],
    ['grouped nested ordinary members rejected', runner + '\nconst groupedDiagnostics={window:{},module:{exports:{}}};(groupedDiagnostics.window.listSuite)=function(){return [];};(groupedDiagnostics.module.exports.listSuite)=function(){return [];};\n']
  ]) assertRunnerContainsRequiredGuards(fixture, 'valid syntax fixture: ' + label);
  assert(runner.includes('static-server.js') && runner.includes('mock-relay.js'),
    '러너가 테스트 서버(8299/8398)를 직접 관리하지 않는다 — CI 에서 e2e 가 전부 죽는다');
  assert(/node\s+scripts\/stage-pages\.mjs\s+_site/.test(workflow), '워크플로가 검증된 staging 스크립트를 실행하지 않는다');
  assert(/path:\s*["']?_site["']?/.test(workflow), 'Pages 업로드 경로가 _site 허용목록 산출물이 아니다');
  assert(/actions\/setup-node@v7/.test(workflow), '보안 E2E용 Node 준비 단계가 없다');
  assert(/actions\/upload-pages-artifact@v5[\s\S]*?include-hidden-files:\s*true/.test(workflow),
    'Pages 업로드에서 .nojekyll 숨김 파일 보존 설정이 없다');
  assert(/playwright[^\n]*(?:install|@)/i.test(workflow), '보안 E2E용 Playwright 설치 단계가 없다');
  assert(/\/opt\/pw-browsers/.test(workflow), '하드코딩 브라우저 경로(/opt/pw-browsers) 심링크 단계가 없다 — 옛 e2e 30여 개가 CI 에서 못 뜬다');
  const verifyAt = workflow.indexOf('Verify release guards');
  const stageAt = workflow.indexOf('Stage public site allowlist');
  const uploadAt = workflow.indexOf('Upload site artifact');
  assert(verifyAt >= 0 && verifyAt < stageAt && stageAt < uploadAt, '검증 → staging → upload 순서가 아니다');
  console.log('PASS  Pages 산출물은 앱 셸 5개 파일만 포함');
  console.log('PASS  공개 백업 HTML·tests·apps-script 제외');
  console.log('PASS  배포 워크플로가 _site staging 산출물만 업로드');
  console.log('PASS  배포 전 전체 스위트(run-all.js, 인자 없이) 실행 후 staging/upload');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

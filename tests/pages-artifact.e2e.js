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
  let i = 0;
  const push = (type, value, index) => tokens.push({ type, value, index });
  const closesControlParen = closeAt => {
    if (!tokens[closeAt] || tokens[closeAt].value !== ')') return false;
    let depth = 0;
    for (let at = closeAt; at >= 0; at -= 1) {
      if (tokens[at].value === ')') depth += 1;
      else if (tokens[at].value === '(' && --depth === 0) return !!(tokens[at - 1] && tokens[at - 1].type === 'identifier' && controlKeywords.has(tokens[at - 1].value));
    }
    return false;
  };
  const followsControlParen = () => closesControlParen(tokens.length - 1);
  const followsControlBlock = () => {
    if (!tokens.length || tokens[tokens.length - 1].value !== '}') return false;
    let depth = 0;
    for (let at = tokens.length - 1; at >= 0; at -= 1) {
      if (tokens[at].value === '}') depth += 1;
      else if (tokens[at].value === '{' && --depth === 0) {
        const beforeBlock = tokens[at - 1];
        return !!(beforeBlock && ((beforeBlock.value === ')' && closesControlParen(at - 1)) || (beforeBlock.type === 'identifier' && controlBlockKeywords.has(beforeBlock.value))));
      }
    }
    return false;
  };
  const canStartRegex = () => {
    if (!tokens.length) return true;
    const previous = tokens[tokens.length - 1];
    return regexPrefixPunctuators.has(previous.value) || (previous.type === 'identifier' && regexPrefixKeywords.has(previous.value)) || followsControlParen() || followsControlBlock();
  };
  const scanCode = stopAtTemplateBrace => {
    let braces = 0;
    while (i < text.length) {
      const start = i, ch = text[i], next = text[i + 1];
      if (/\s/.test(ch)) { i += 1; continue; }
      if (ch === '/' && next === '/') { i = text.indexOf('\n', i + 2); if (i < 0) { i = text.length; return; } continue; }
      if (ch === '/' && next === '*') { i = text.indexOf('*/', i + 2); if (i < 0) { i = text.length; return; } i += 2; continue; }
      if (ch === '/' && canStartRegex()) {
        let inClass = false; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i] === '[') inClass = true;
          else if (text[i] === ']') inClass = false;
          else if (text[i] === '/' && !inClass) { i += 1; while (/[A-Za-z]/.test(text[i] || '')) i += 1; break; }
          i += 1;
        }
        push('regex', '/', start); continue;
      }
      if (text.startsWith('<!--', i)) { i = text.indexOf('-->', i + 4); if (i < 0) { i = text.length; return; } i += 3; continue; }
      if (ch === "'" || ch === '"') {
        const quote = ch; let value = ''; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { if (i + 1 < text.length) value += text[i + 1]; i += 2; continue; }
          if (text[i] === quote) { i += 1; break; }
          value += text[i++];
        }
        push('string', value, start); continue;
      }
      if (ch === '`') {
        let value = '', interpolated = false; i += 1;
        while (i < text.length) {
          if (text[i] === '\\') { if (i + 1 < text.length) value += text[i + 1]; i += 2; continue; }
          if (text[i] === '`') { i += 1; if (!interpolated) push('string', value, start); break; }
          if (text[i] === '$' && text[i + 1] === '{') {
            interpolated = true; push('punctuator', '(', i); i += 2; scanCode(true); push('punctuator', ')', i - 1); continue;
          }
          value += text[i++];
        }
        continue;
      }
      if (/[A-Za-z_$]/.test(ch)) {
        i += 1; while (i < text.length && /[A-Za-z0-9_$]/.test(text[i])) i += 1;
        push('identifier', text.slice(start, i), start); continue;
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
  };
  scanCode(false);
  return tokens;
}
const bindingAssignmentOperators = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);
function functionDeclarations(tokens) {
  const names = [], expressionPrefixes = new Set(['(', '[', ',', ':', '?', '!', '~', '+', '-', '=>', 'return', 'throw', 'case', 'delete', 'void', 'typeof', 'await', 'yield', 'new', ...bindingAssignmentOperators]);
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
function groupedReference(tokens, at) {
  let start = at, end = at + 1;
  while (tokens[start - 1] && tokens[start - 1].value === '(' && tokens[end] && tokens[end].value === ')') {
    const beforeOpen = tokens[start - 2];
    if (beforeOpen && !groupingPrefixPunctuators.has(beforeOpen.value) && !(beforeOpen.type === 'identifier' && groupingPrefixKeywords.has(beforeOpen.value))) break;
    start -= 1;
    end += 1;
  }
  return { start, end };
}
function bindingReassignments(tokens, protectedNames) {
  const findings = [], globals = new Set(['globalThis', 'global', 'window', 'self', 'exports']);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const reference = token.type === 'identifier' ? groupedReference(tokens, i) : { start: i, end: i + 1 };
    if (token.type === 'identifier' && protectedNames.has(token.value) && bindingAssignmentOperators.has(tokens[reference.end] && tokens[reference.end].value) && (!tokens[reference.start - 1] || tokens[reference.start - 1].value !== '.')) {
      findings.push(token.value + ' ' + tokens[reference.end].value);
    }
    if (token.type !== 'identifier' || (tokens[reference.start - 1] && tokens[reference.start - 1].value === '.') || (!globals.has(token.value) && token.value !== 'module')) continue;
    let at = reference.end;
    if (token.value === 'module') {
      const exportsMember = memberToken(tokens, at);
      if (!exportsMember || exportsMember.name !== 'exports') continue;
      at = exportsMember.end;
    }
    const bindingMember = memberToken(tokens, at);
    if (bindingMember && protectedNames.has(bindingMember.name) && bindingAssignmentOperators.has(tokens[bindingMember.end] && tokens[bindingMember.end].value)) {
      findings.push(token.value + '.' + bindingMember.name + ' ' + tokens[bindingMember.end].value);
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
  assert(/uses:\s*actions\/checkout@v4[\s\S]*?with:[\s\S]*?fetch-depth:\s*0[\s\S]*?- name:\s*Setup Node\.js/.test(workflow),
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
    ['nested global/module properties rejected', runner + '\nconst diagnostics={globalThis:{},module:{exports:{}}};diagnostics.globalThis.listSuite=function(){return [];};diagnostics.module.exports.listSuite=function(){return [];};\n']
  ]) assertRunnerContainsRequiredGuards(fixture, 'valid syntax fixture: ' + label);
  assert(runner.includes('static-server.js') && runner.includes('mock-relay.js'),
    '러너가 테스트 서버(8299/8398)를 직접 관리하지 않는다 — CI 에서 e2e 가 전부 죽는다');
  assert(/node\s+scripts\/stage-pages\.mjs\s+_site/.test(workflow), '워크플로가 검증된 staging 스크립트를 실행하지 않는다');
  assert(/path:\s*["']?_site["']?/.test(workflow), 'Pages 업로드 경로가 _site 허용목록 산출물이 아니다');
  assert(/actions\/setup-node@v4/.test(workflow), '보안 E2E용 Node 준비 단계가 없다');
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

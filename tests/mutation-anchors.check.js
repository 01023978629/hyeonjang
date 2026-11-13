/* 변이 기준 글 점검 — 검사 파일의 변이 표(const MUT = {...})가 가리키는 앱 코드 조각이 지금 코드에 정확히 한 번 있는가.
   이 저장소는 '새 기능 = 새 검사 + 변이 검증'(AGENTS) — 변이는 보호하는 줄을 일부러 되돌려 검사가 실패하는지 보는 것인데, 나중 판이 그 줄을
   고치면 변이가 'mutation anchor' 로 시작도 못 하고, 변이는 CI 에서 돌지 않아 아무도 모른다(v591~v597 통합 검토에서 다섯 개, 더 옛것 두 개를 찾았다).
   이 점검은 변이를 돌리지 않는다 — 표만 읽어 기준 글(바꿀 앞 글)이 앱 파일 하나에 정확히 한 번 있는지(여러 쌍이면 차례로 바꿔 가며) 본다.
   앱 코드를 고쳐 이 점검이 떨어지면: 그 변이가 지키던 동작이 아직 지켜지는지 보고, 표의 기준 글을 새 코드에 맞춘 뒤 그 변이를 한 번 돌려 의도한 곳에서
   실패하는지 확인하라(기준 글만 맞추고 끝내지 마라). 표가 다른 상수를 쓰면 파일 앞부분을 실행해 표를 얻는다(검사 자체는 띄우지 않는다). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['index.html', 'sw.js', 'apps-script/Watchdog.gs', 'bathroom.js', 'leak.js', 'team-ui.js', 'team-projects.js', 'team-packet.js',
  'media-safety.js', 'shared-todo-backup.js', 'operations-review.js']
  .filter(f => fs.existsSync(path.join(ROOT, f))).map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
// '{' 에서 짝이 맞는 '}' 까지(문자열·주석·템플릿 안의 괄호는 건너뜀)
function objectText(src, at) {
  let depth = 0, quote = null;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\') { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) return null; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; if (i <= 0) return null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return { text: src.slice(at, i + 1), end: i + 1 }; }
  }
  return null;
}
function loadTable(file, src, match) {
  const obj = objectText(src, match.index + match[0].length - 1);
  if (!obj) throw new Error('변이 표의 끝을 못 찾음');
  try { return vm.runInNewContext('(' + obj.text + ')', {}); } catch (error) {
    if (!(error instanceof ReferenceError) && error.name !== 'ReferenceError') throw error;
  }
  // 표가 파일 위쪽 상수를 쓴다 — 표까지의 앞부분만 실행(검사 본문·브라우저는 그 뒤라 돌지 않는다)
  const prefix = src.slice(0, obj.end).replace(/^#!.*\n/, '') + '\n;globalThis.__MUT_TABLE__ = MUT;';
  const sandbox = { require: require('node:module').createRequire(file), __dirname: path.dirname(file), __filename: file, module: { exports: {} }, exports: {}, console, URL, URLSearchParams, Buffer, TextEncoder, TextDecoder,
    process: { env: {}, platform: process.platform, argv: [], cwd: () => ROOT, exitCode: 0 } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(prefix, sandbox, { filename: file });
  return sandbox.__MUT_TABLE__;
}
const failures = [];
let anchors = 0, tables = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'tests')).filter(f => /\.js$/.test(f) && f !== path.basename(__filename) && !f.startsWith('.')).sort()) {
  const file = path.join(ROOT, 'tests', name), src = fs.readFileSync(file, 'utf8');
  const match = /const MUT\s*=\s*\{/.exec(src);
  if (!match) continue;
  let table;
  try { table = loadTable(file, src, match); } catch (error) { failures.push(name + ' — 변이 표를 읽지 못함: ' + String(error.message || error).slice(0, 120)); continue; }
  tables++;
  for (const [key, value] of Object.entries(table || {})) {
    let pairs = null;
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string') pairs = [value];
    else if (Array.isArray(value) && value.length && value.every(p => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string')) pairs = value;
    if (!pairs) { failures.push(name + ' ' + key + ' — 변이 꼴을 모름([앞 글, 뒤 글] 또는 그 목록이어야 한다)'); continue; }
    anchors += pairs.length;
    const hit = TARGETS.find(([, text0]) => {
      let text = text0;
      for (const [from, to] of pairs) { if (text.split(from).length !== 2) return false; text = text.replace(from, () => to); }
      return true;
    });
    if (!hit) {
      const where = pairs.map(([from]) => { const seen = TARGETS.map(([t, text]) => [t, text.split(from).length - 1]).filter(x => x[1]); return seen.length ? seen.map(x => x[0] + ' ' + x[1] + '번').join(',') : '없음'; });
      failures.push(name + ' ' + key + ' — 기준 글이 앱 파일에 정확히 한 번 있지 않음(' + where.join(' / ') + ')');
    }
  }
}
if (failures.length) {
  console.error('✗ 변이 기준 글 ' + failures.length + '곳이 지금 코드와 맞지 않음:\n  · ' + failures.join('\n  · '));
  console.error('  → 그 변이가 지키던 동작을 확인하고 기준 글을 새 코드에 맞춘 뒤, 변이를 한 번 돌려 의도한 곳에서 실패하는지 보라.');
  process.exit(1);
}
if (tables < 30) { console.error('✗ 변이 표가 ' + tables + '개뿐 — 표 찾기가 깨졌다(36개 안팎이어야)'); process.exit(1); }
console.log('✓ 변이 기준 글 — 검사 ' + tables + '개 · 기준 글 ' + anchors + '개 모두 앱 코드에 정확히 한 번');

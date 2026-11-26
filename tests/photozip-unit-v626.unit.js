/* v626 대표 요청(11/26) "한달 지난 사진 동호수 분류가 안되어 있어 동호수를 파일로 분류해서 넣어서" — 한 달 지난 사진 ZIP 보관에서
   동·호수가 연결된 사진은 ZIP 안 '<동·호수>/<촬영일>/<이름>', 연결이 없으면 예전 '<촬영일>/<이름>'.
   ① hjPzEntryDir: 동·호수가 있으면 앞에(위험 글자는 hjPzSafeName 으로 _) · 없거나 빈 칸·공백이면 날짜만 · 날짜가 없으면 '날짜 없음'
   ② 새로 담는 자리(hjPzProject)는 hjPzEntryDir(day, it.meta.unit) 로 이름을 짓고, 그 이름이 hjPzUnique·csv 로 간다(같은 줄)
   ③ v611 원본 ZIP 바꾸기(hjPzMigratePart)는 옛 항목 이름 그대로(e.name) — 되살린 사진 자리를 바꾸지 않는다
   브라우저 없이 돈다: index.html 에서 두 함수만 떼어 VM 에서 부른다. 실제 ZIP 쓰기는 tests/photozip-v612.e2e.js(A1 = 101동 501호).
   변이(HJ_V626_MUTATION): no-unit · unit-after-day · no-safe · blank-unit-dir · old-put · migrate-renamed — 모두 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-unit': ["return u?hjPzSafeName(u)+'/'+d:d;}", 'return d;}'],
  'unit-after-day': ["return u?hjPzSafeName(u)+'/'+d:d;}", "return u?d+'/'+hjPzSafeName(u):d;}"],
  'no-safe': ["return u?hjPzSafeName(u)+'/'+d:d;}", "return u?u+'/'+d:d;}"],
  'blank-unit-dir': ["u=String(unit==null?'':unit).trim();return u?", "u=String(unit==null?'':unit);return unit!=null?"],
  'old-put': ["hjPzUnique(hjPzEntryDir(day,it.meta&&it.meta.unit)+'/'+hjPzShrunkName(String(rec.name||''),out.shrunk),pt.names)", "hjPzUnique((day||'날짜 없음')+'/'+hjPzShrunkName(String(rec.name||''),out.shrunk),pt.names)"],
  'migrate-renamed': ['await hjPzPut(pt,hjPzUnique(hjPzShrunkName(e.name,out.shrunk),pt.names)', "await hjPzPut(pt,hjPzUnique(hjPzEntryDir('x',meta&&meta.unit)+'/'+hjPzShrunkName(e.name,out.shrunk),pt.names)"],
};
if (process.env.HJ_V626_MUTATION) {
  const m = MUT[process.env.HJ_V626_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V626_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V626_MUTATION); html = html.replace(m[0], () => m[1]);
}
function grab(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 이 없다');
  let i = html.indexOf('{', at), depth = 0;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
  return html.slice(at, i + 1);
}
const ctx = vm.createContext({});
vm.runInContext(grab('hjPzSafeName') + '\n' + grab('hjPzEntryDir') + '\nthis.hjPzEntryDir=hjPzEntryDir;', ctx);
const dir = ctx.hjPzEntryDir;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', n, name); };

t('① 동·호수 → 날짜', () => {
  assert.equal(dir('2026-09-11', '2동 309호'), '2동 309호/2026-09-11');
  assert.equal(dir('2026-09-11', '103동 6·7라인 출입구 경사로'), '103동 6·7라인 출입구 경사로/2026-09-11', '공용 구역 이름도');
  assert.equal(dir('2026-09-11', '  1동 907호 '), '1동 907호/2026-09-11', '앞뒤 빈칸');
  assert.equal(dir('2026-09-11', 'A/B:동'), 'A_B_동/2026-09-11', '경로를 깨는 글자는 _');
  assert.equal(dir('', '1동 907호'), '1동 907호/날짜 없음');
});
t('① 동·호수가 없으면 예전 꼴', () => {
  for (const u of ['', '   ', null, undefined]) assert.equal(dir('2026-10-05', u), '2026-10-05', JSON.stringify(u));
  assert.equal(dir('', ''), '날짜 없음');
  assert.equal(dir(null, null), '날짜 없음');
});
t('② 새로 담는 자리는 동·호수 폴더', () => {
  const body = grab('hjPzProject');
  assert.ok(body.includes("hjPzUnique(hjPzEntryDir(day,it.meta&&it.meta.unit)+'/'+hjPzShrunkName(String(rec.name||''),out.shrunk),pt.names),out.bytes,null,rec.when,path,it)"),
    '이름 = 동·호수/날짜/이름 · csv 는 같은 it(meta.unit)');
  assert.ok(body.indexOf('meta:hjPzMeta(rec,driveId,out.shrunk,ocrc)') < body.indexOf('hjPzEntryDir(day,it.meta'), 'meta 를 먼저 채운 뒤 이름');
  assert.ok(!/\(day\|\|'날짜 없음'\)\+'\/'/.test(body), '옛 날짜만 이름이 남지 않음');
});
t('③ v611 바꾸기는 옛 이름 그대로', () => {
  const body = grab('hjPzMigratePart');
  assert.ok(body.includes('await hjPzPut(pt,hjPzUnique(hjPzShrunkName(e.name,out.shrunk),pt.names)'));
  assert.ok(!body.includes('hjPzEntryDir'));
});
t('도움말에 적힘', () => {
  assert.ok(html.includes('동·호수가 연결된 사진은 ZIP 안 <b>동·호수 → 날짜</b> 폴더'));
});
console.log('photozip-unit-v626', n + '/5');

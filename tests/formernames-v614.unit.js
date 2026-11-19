/* v614 현장 옛 이름(formerNames) — 현장웹과 카톡봇 현장 이름 연동 단위 검사
   카톡봇(v1.8.6)은 드라이브 현장데이터.json 의 현장 목록을 읽는다. 현장웹에서 현장 이름을 바꾸면(renameProject → hjRenameProjectRefs) 옛 이름이 사라져
   봇의 사진 폴더·톡방 기본값이 옛 이름에 남았다. 이제 현장 객체 안 칸 formerNames 에 바꾸기 전 이름을 남긴다(봇이 별칭으로 읽음).
   브라우저 없이 돈다: index.html 의 앱 스크립트를 통째로 VM 에 올려(화면·저장소·네트워크는 빈 껍데기) **진짜 hjRenameProjectRefs·serializeData·applyData·
   hjPhotoNewHint·photoSuggestLabel** 을 합성 자료로 부른다. 실제 고객·현장·서버 없음, 바깥 쓰기 없음.
   ① 이름을 바꾸면 formerNames = [바꾸기 전 이름] · 이름으로 이어진 기록도 그대로 옮겨진다(예전 동작) · 다른 현장은 그대로 (RENAME)
   ② 두 번·열두 번 바꾸면 오래된 것 앞·최근 것 뒤 · 최근 10개까지 · 깨진 값(글 아님·빈 글·겹침)은 정리 (ORDER)
   ③ 옛 이름으로 되돌리면 그 이름은 목록에서 빠진다 · 지금 이름은 어느 때도 목록에 없다 (BACK)
   ④ 저장 왕복(serializeData → JSON → applyData) 뒤에도 현장 칸으로 남는다 · 새 최상위 저장 키 없음 (SAVE)
   ⑤ 🧭 폴더 이름 단서 — 옛 이름 폴더('현장사진/<옛 이름>/')의 사진은 바뀐 현장을 참고로(former) · 옛 이름을 새 현장으로 제안하지 않는다 ·
      🧭 창 줄도 그 현장 '참고: 📁 … 옛 이름과 같아요'(체크 안 함) (FOLDER)
   ⑥ 지금 이름이 먼저 — 옛 이름과 같은 이름의 현장(보관 포함)이 지금 있으면 옛 이름은 안 본다 · 옛 이름을 가진 진행 현장이 둘이면 고르지 않음 ·
      보관한 현장의 옛 이름은 참고로도 새 현장으로도 내놓지 않음 · 옛 이름이 없는 폴더는 예전처럼 새 현장 제안 · 단서 계산은 읽기만 (GUARD)
   HJ_V614_BASELINE=<commit>(예: origin/main 396453a) 은 ①에서, HJ_V614_FORMER_MUTATION=no-former 는 ①, no-cap·no-dedupe·keep-current 는 ②
   (keep-current 는 ③ 도 같은 까닭), no-folder-former 는 ⑤, current-not-first·suggest-old-as-new 는 ⑥ 에서 실패해야 한다.
   앱 스크립트가 VM 에 안 올라가면(새 최상위 코드가 브라우저 API 를 부름) 아래 any()/ctx 에 그 이름을 더하라 — 검사를 끄지 마라. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V614_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V614_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-former': ['  if(p){p.formerNames=hjFormerNamesNext(p.formerNames,oldName,newName);p.name=newName;}\n', '  if(p)p.name=newName;\n'],
  'no-cap': ['  return out.slice(-HJ_FORMER_NAMES_MAX);\n', '  return out;\n'],
  'no-dedupe': ['    const i=out.indexOf(n);if(i>=0)out.splice(i,1);\n', '\n'],
  'keep-current': ["    if(typeof n!=='string'||!n.trim()||n===newName)return;\n", "    if(typeof n!=='string'||!n.trim())return;\n"],
  'no-folder-former': ['    if(was.length===1||wasExact.length===1){out.exist=(wasExact.length===1?wasExact[0]:was[0]).name;out.former=true;return out;}\n', '\n'],
  'current-not-first': ['    const owners=(state.projects||[]).some(p=>p&&p.name&&hit(p.name))?[]:(state.projects||[])', '    const owners=(state.projects||[])'],
  'suggest-old-as-new': ['    const c=(same.length||owners.length)?null:hjNewSiteCheck(site);\n', '    const c=same.length?null:hjNewSiteCheck(site);\n']
};
if (process.env.HJ_V614_FORMER_MUTATION) {
  const m = MUT[process.env.HJ_V614_FORMER_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V614_FORMER_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor'); html = html.replace(m[0], () => m[1]);
}

// ── 앱 스크립트를 VM 에 — 화면·저장소·네트워크는 무엇이든 받아 주는 빈 껍데기 (stagetidy-v612.unit.js 와 같은 틀) ──
function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
let writes = 0;
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const store = new Map(), noop = () => {};
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, queueMicrotask, Promise, Intl, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, performance, structuredClone,
    document: any('document'), navigator: any('navigator'), history: any('history'), indexedDB: any('indexedDB'), caches: any('caches'), visualViewport: any('vv'),
    Notification: any('Notification'), speechSynthesis: any('ss'), getSelection: () => any('sel'), getComputedStyle: () => any('cs'),
    location: { href: 'http://127.0.0.1/index.html', search: '', hash: '', pathname: '/index.html', origin: 'http://127.0.0.1', protocol: 'http:', hostname: '127.0.0.1', reload: noop, replace: noop },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    fetch: () => { writes++; return new Promise(noop); }, addEventListener: noop, removeEventListener: noop, screen: { width: 1280, height: 800 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    alert: noop, confirm: () => false, prompt: () => null, scrollTo: noop, scrollBy: noop, open: () => null, print: noop,
    Blob: globalThis.Blob || function () {}, File: globalThis.File || function () {}, Response: globalThis.Response, Headers: globalThis.Headers, Request: globalThis.Request,
    AbortController: globalThis.AbortController, atob: globalThis.atob, btoa: globalThis.btoa, Event: function () {}, CustomEvent: function () {},
    HTMLElement: function () {}, Element: function () {}, Node: function () {}
  };
  for (const k of ['BroadcastChannel', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Image', 'Worker', 'FileReader', 'DOMParser', 'XMLSerializer', 'FormData'])
    ctx[k] = function () { return any(k); };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(code, ctx, { filename: 'index.html#app-script' }); }
  catch (e) { throw new Error('앱 스크립트를 VM 에 올리지 못함 — 새 브라우저 API 면 이 검사의 ctx 에 더하라: ' + (e && e.message)); }
  return ctx;
}
const ctx = loadApp();
const fetchAtBoot = writes;
const run = (src, data) => { ctx.__IN__ = data === undefined ? null : JSON.parse(JSON.stringify(data)); return JSON.parse(vm.runInContext('JSON.stringify((()=>{' + src + '})())', ctx)); };

// 합성 자료 — 이름은 모두 가짜. 현장 객체는 앱이 만드는 꼴(ensureProjectExists)과 같다.
const proj = (name, extra = {}) => ({ name, stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, ...extra });
const SEED = `const d=__IN__;state.projects=d.projects||[];state.files=d.files||[];state.schedule=d.schedule||[];state.payLog=d.payLog||[];state.asLog=d.asLog||[];
  state.quotes=d.quotes||[];state.notes=d.notes||[];state.expenses=[];state.workLogs=[];state.trips=[];state.satisfaction=[];state.adPosts=[];state.aptOrders=[];
  state.activeProject=d.activeProject||null;state.editingQuote=null;`;
const fm = (data, name) => { const p = data.projects.find(x => x.name === name); return p ? p.formerNames : undefined; };

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS formernames-v614 ' + name); }

test('① 이름을 바꾸면 formerNames = [바꾸기 전 이름] · 이어진 기록도 옮겨짐 · 다른 현장 그대로 (RENAME)', () => {
  const r = run(SEED + `hjRenameProjectRefs('가상 옛현장','가상 새현장');return {projects:state.projects,pay:state.payLog,sch:state.schedule,active:state.activeProject};`, {
    projects: [proj('가상 옛현장'), proj('가상 이웃')],
    payLog: [{ d: '2026-11-01', project: '가상 옛현장', amt: 1000 }, { d: '2026-11-02', project: '가상 이웃', amt: 2000 }],
    schedule: [{ id: 's1', date: '2026-11-03', title: '가상 일정', project: '가상 옛현장' }],
    activeProject: '가상 옛현장'
  });
  const p = r.projects.find(x => x.name === '가상 새현장');
  assert.ok(p, '현장 이름이 바뀜 ' + JSON.stringify(r.projects.map(x => x.name)));
  assert.deepEqual(p.formerNames, ['가상 옛현장'], 'formerNames ' + JSON.stringify(p));
  assert.ok(!r.projects.some(x => x.name === '가상 옛현장'), '옛 이름 현장 없음');
  assert.equal(fm(r, '가상 이웃'), undefined, '다른 현장에는 칸이 생기지 않음');
  assert.deepEqual(r.pay.map(x => x.project), ['가상 새현장', '가상 이웃'], '수금 기록도 새 이름(예전 동작)');
  assert.equal(r.sch[0].project, '가상 새현장', '일정도 새 이름');
  assert.equal(r.active, '가상 새현장', '활성 현장도 새 이름');
});

test('② 두 번·열두 번 바꾸면 오래된 것 앞·최근 것 뒤 · 최근 10개 · 깨진 값 정리 (ORDER)', () => {
  const two = run(SEED + `hjRenameProjectRefs('가상A','가상B');hjRenameProjectRefs('가상B','가상C');return {projects:state.projects};`, { projects: [proj('가상A')] });
  assert.deepEqual(fm(two, '가상C'), ['가상A', '가상B'], '두 번 ' + JSON.stringify(two.projects));
  const many = run(SEED + `let n='가상0';for(let i=1;i<=12;i++){hjRenameProjectRefs(n,'가상'+i);n='가상'+i;}return {projects:state.projects};`, { projects: [proj('가상0')] });
  assert.deepEqual(fm(many, '가상12'), ['가상2', '가상3', '가상4', '가상5', '가상6', '가상7', '가상8', '가상9', '가상10', '가상11'], '열두 번 — 최근 10개, 가장 오래된 둘(가상0·가상1)은 빠짐 ' + JSON.stringify(fm(many, '가상12')));
  const messy = run(SEED + `hjRenameProjectRefs('가상A','가상B');return {projects:state.projects};`, { projects: [proj('가상A', { formerNames: ['가상X', 7, '', '  ', null, '가상A', '가상X', '가상B'] })] });
  assert.deepEqual(fm(messy, '가상B'), ['가상X', '가상A'], '글 아님·빈 글 버림 · 겹침은 최근 자리 하나 · 새 이름 빠짐 ' + JSON.stringify(fm(messy, '가상B')));
  assert.equal(run(`return HJ_FORMER_NAMES_MAX;`), 10, '최대 10');
});

test('③ 옛 이름으로 되돌리면 목록에서 빠짐 · 지금 이름은 어느 때도 목록에 없음 (BACK)', () => {
  const r = run(SEED + `const out=[];const step=(a,b)=>{hjRenameProjectRefs(a,b);const p=state.projects.find(x=>x.name===b);out.push({name:p.name,fm:p.formerNames.slice()});};
    step('가상A','가상B');step('가상B','가상A');step('가상A','가상C');step('가상C','가상B');step('가상B','가상A');return out;`, { projects: [proj('가상A')] });
  assert.deepEqual(r.map(x => x.fm), [['가상A'], ['가상B'], ['가상B', '가상A'], ['가상A', '가상C'], ['가상C', '가상B']], '되돌리면 그 이름은 빠지고 방금 이름이 뒤에 ' + JSON.stringify(r));
  r.forEach(x => assert.ok(!x.fm.includes(x.name), '지금 이름 ' + x.name + ' 이 목록에 있음 ' + JSON.stringify(x)));
  const same = run(SEED + `hjRenameProjectRefs('가상A','가상A');return {projects:state.projects};`, { projects: [proj('가상A', { formerNames: ['가상Z', '가상A'] })] });
  assert.deepEqual(fm(same, '가상A'), ['가상Z'], '같은 이름으로 불러도 지금 이름은 목록에 안 들어감 ' + JSON.stringify(same.projects));
  assert.deepEqual(run(`return [hjProjectFormerNames({name:'가상A',formerNames:['가상A','가상Q',3,'']}),hjProjectFormerNames({name:'가상A'}),hjProjectFormerNames(null)];`),
    [['가상Q'], [], []], '읽을 때도 지금 이름·깨진 값은 뺌');
});

test('④ 저장 왕복 뒤에도 현장 칸으로 남음 · 새 최상위 저장 키 없음 (SAVE)', () => {
  const r = run(SEED + `const before=Object.keys(serializeData()).sort();hjRenameProjectRefs('가상A','가상B');hjRenameProjectRefs('가상B','가상C');
    const out=JSON.parse(JSON.stringify(serializeData()));const keys=Object.keys(out).sort();
    state.projects=[];applyData(out);return {keys,before,saved:out.projects,projects:state.projects};`, { projects: [proj('가상A'), proj('가상 이웃')] });
  assert.deepEqual(r.keys, r.before, '최상위 키 같음');
  assert.ok(!r.keys.includes('formerNames'), '최상위 formerNames 없음');
  assert.deepEqual(r.saved.find(p => p.name === '가상C').formerNames, ['가상A', '가상B'], '저장 자료(드라이브·중계가 받는 본문)의 현장 안에');
  assert.deepEqual(fm(r, '가상C'), ['가상A', '가상B'], 'applyData 뒤에도 ' + JSON.stringify(r.projects));
  assert.equal(fm(r, '가상 이웃'), undefined, '이웃 현장에는 칸이 생기지 않음');
});

// 미배정 사진 두 장 — 같은 시각·위치 없음 → 한 묶음. 폴더는 '현장사진/<folder>/'.
const photos = (folder, tag = 'p') => [1, 2].map(i => ({ id: tag + i, name: tag + i + '.jpg', ext: 'jpg', kind: 'photo', prefix: '현장사진/' + folder + '/', project: null, size: 100 + i, when: '2026-11-10T01:0' + i + ':00.000Z' }));
const HINT = SEED + `state.files.forEach(f=>{if(f.when)f.when=new Date(f.when);});const before=JSON.stringify(state.projects);
  const h=hjPhotoNewHint(state.files);return {h,same:before===JSON.stringify(state.projects)};`;

test('⑤ 옛 이름 폴더 → 바뀐 현장을 참고로 · 옛 이름을 새 현장으로 제안하지 않음 · 🧭 창 줄 (FOLDER)', () => {
  // 먼저 이름을 바꾼 뒤(진짜 hjRenameProjectRefs), 옛 이름 폴더의 사진 단서를 본다
  const r = run(SEED + `state.files.forEach(f=>{if(f.when)f.when=new Date(f.when);});hjRenameProjectRefs('가상 달빛아파트','가상 달빛아파트 101동 공사');
    const h=hjPhotoNewHint(state.files);const rows=hjPhotoSuggestReviewData().map(x=>({ids:x.open.map(p=>p.id),sg:x.sg,sure:x.sure,nw:x.nw}));
    return {h,rows,label:photoSuggestLabel({name:'x',why:'folder',former:true}),plain:photoSuggestLabel({name:'x',why:'folder'}),short:photoSuggestLabel({name:'x',why:'folder',former:true},true)};`,
  { projects: [proj('가상 달빛아파트'), proj('가상 이웃')], files: photos('가상 달빛아파트') });
  assert.deepEqual([r.h.folder, r.h.exist, r.h.name, r.h.former], ['가상 달빛아파트', '가상 달빛아파트 101동 공사', '', true], '옛 이름 폴더 → 바뀐 현장 ' + JSON.stringify(r.h));
  assert.equal(r.rows.length, 1, '한 묶음 ' + JSON.stringify(r.rows));
  assert.deepEqual([r.rows[0].sg && r.rows[0].sg.name, r.rows[0].sg && r.rows[0].sg.why, r.rows[0].sg && r.rows[0].sg.former, r.rows[0].sure], ['가상 달빛아파트 101동 공사', 'folder', true, false],
    '🧭 창 — 바뀐 현장을 참고로(확실 아님) ' + JSON.stringify(r.rows[0]));
  assert.equal(r.label, '참고: 📁 사진 폴더 이름이 이 현장의 옛 이름과 같아요 (확인 후 체크하세요)', r.label);
  assert.equal(r.plain, '참고: 📁 사진 폴더 이름이 이 현장과 같아요 (확인 후 체크하세요)', '옛 이름이 아니면 예전 글 그대로 ' + r.plain);
  assert.equal(r.short, '참고: 폴더 이름', r.short);
  // 띄어쓰기·'아파트' 차이와 동·호수 꼬리도 지금 이름과 같은 기준으로 맞는다
  const loose = run(HINT, { projects: [proj('가상 새이름', { formerNames: ['가상 옛이름 아파트'] })], files: photos('가상옛이름아파트 101동') });
  assert.deepEqual([loose.h.exist, loose.h.former, loose.h.name], ['가상 새이름', true, ''], '같은 기준(hjNormName·동호수 뗌) ' + JSON.stringify(loose.h));
  assert.equal(loose.same, true, '읽기만');
});

test('⑥ 지금 이름이 먼저 · 겹친 옛 이름 · 보관 현장 · 옛 이름 없는 폴더 · 읽기만 (GUARD)', () => {
  // 옛 이름으로 새 현장을 다시 만든 경우 — 지금 그 이름을 가진 현장이 맞다
  const cur = run(HINT, { projects: [proj('가상 바뀐현장', { formerNames: ['가상 옛현장'] }), proj('가상 옛현장')], files: photos('가상 옛현장') });
  assert.deepEqual([cur.h.exist, cur.h.former, cur.h.name], ['가상 옛현장', undefined, ''], '지금 이름이 먼저 ' + JSON.stringify(cur.h));
  // 지금 그 이름을 가진 현장이 보관돼 있어도 — 옛 이름은 안 본다(예전처럼 제안 없음)
  const arc = run(HINT, { projects: [proj('가상 바뀐현장', { formerNames: ['가상 옛현장'] }), proj('가상 옛현장', { archived: true })], files: photos('가상 옛현장') });
  assert.deepEqual([arc.h.exist, arc.h.former, arc.h.name], ['', undefined, ''], '보관한 지금 이름 현장이 있으면 옛 이름 참고 안 함 ' + JSON.stringify(arc.h));
  // 같은 옛 이름을 가진 진행 현장 둘 — 고르지 않고, 옛 이름을 새 현장으로도 내놓지 않는다
  const two = run(HINT, { projects: [proj('가상 갑', { formerNames: ['가상 옛현장'] }), proj('가상 을', { formerNames: ['가상 옛현장'] })], files: photos('가상 옛현장') });
  assert.deepEqual([two.h.exist, two.h.name, two.h.src], ['', '', ''], '겹친 옛 이름 → 고르지도 새 현장 제안도 안 함 ' + JSON.stringify(two.h));
  // 그중 하나만 글자까지 같으면 그 현장
  const ex = run(HINT, { projects: [proj('가상 갑', { formerNames: ['가상 옛현장'] }), proj('가상 을', { formerNames: ['가상옛현장'] })], files: photos('가상 옛현장') });
  assert.deepEqual([ex.h.exist, ex.h.former], ['가상 갑', true], '글자까지 같은 하나 ' + JSON.stringify(ex.h));
  // 보관한 현장의 옛 이름 — 참고로도, 새 현장으로도 내놓지 않는다(바꾼 현장을 옛 이름으로 되살리지 않게)
  const ao = run(HINT, { projects: [proj('가상 끝난현장', { archived: true, formerNames: ['가상 옛현장'] })], files: photos('가상 옛현장') });
  assert.deepEqual([ao.h.exist, ao.h.name, ao.h.src], ['', '', ''], '보관 현장의 옛 이름 ' + JSON.stringify(ao.h));
  // 옛 이름이 없는 폴더 — 예전처럼 새 현장 제안
  const fresh = run(HINT, { projects: [proj('가상 바뀐현장', { formerNames: ['가상 옛현장'] })], files: photos('가상 처음현장') });
  assert.deepEqual([fresh.h.exist, fresh.h.name, fresh.h.src, fresh.h.former], ['', '가상 처음현장', 'folder', undefined], '예전 새 현장 제안 ' + JSON.stringify(fresh.h));
  [cur, arc, two, ex, ao, fresh].forEach((x, i) => assert.equal(x.same, true, '읽기만 #' + i));
  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
});

console.log('formernames-v614: ' + passed + '/6');
if (passed !== 6) process.exit(1);

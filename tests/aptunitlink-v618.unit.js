/* v618 🏢 동·호수 연결 요청 apt_unit_link (단위 검사)
   카톡봇이 현장 사진을 현장사진\단지\동 호\ 로 옮기면 재스캔 때 세대 연결(_aptUnit)이 풀린다(경로가 같아야만 되살아남 — v557 규칙).
   요청 apt_unit_link 가 세대를 등록하고(있으면 그대로) 사진을 파일 이름으로 다시 연결한다.
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올리고 진짜 aiToolRun 의 apt_unit_link 를 부른다.
   저장(aptUnitSave·aptUnitAssign — 안전판·원자 저장)은 가짜로 세워 '어떤 사진을 고르는지'만 본다. 진짜 저장 길은 apt-unit-assign.e2e.js 가 지킨다.
   ① 새 세대 등록 · 그 현장 사진과 미배정 사진(그 현장으로 배정)만 연결 · 다른 현장·다른 세대·같은 이름 여럿은 건너뜀 · 풀린 연결은 다시 (PICK)
   ② 이미 있는 세대는 다시 만들지 않음 · 이미 그 세대인 사진은 '이미연결' (REUSE)
   ③ 공용부(area) · 잘못된 동·호·없는 현장은 거부 (INPUT)
   ④ 요청함·카톡 승인 자동 반영 대상(더하기만) · 화면 글 (INBOX)
   변이(HJ_V618_MUTATION): steal-other-project·relink-other-unit·dup-name-pick·no-assign-free 는 ①, reuse-ignored 는 ②, not-auto 는 ④ 에서 실패해야 한다.
   HJ_V618_BASELINE=<commit>(예: 6f2a593) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V618_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V618_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'steal-other-project': ['pick=mine.length?mine:free;', 'pick=mine.length?mine:(free.length?free:fs);'],
  'relink-other-unit': ['if(link&&link.project===pj&&live.some(u=>u.id===link.unitId)){if(link.unitId===unit.id)already++;else skipped++;continue;}', 'if(link&&link.unitId===unit.id){already++;continue;}'],
  'dup-name-pick': ['if(pick.length!==1){skipped++;continue;}', ''],
  'no-assign-free': ['if(!f.project){f.project=pj;assigned++;}', ''],
  'reuse-ignored': ['let unit=aptUnitList(p).find(u=>aptUnitLabelKey(aptUnitLabel(u))===key),made=false;', 'let unit=null,made=false;'],
  'not-auto': ["const HJ_KAKAO_AUTO_TOOLS=new Set(['add_schedule','add_project','apt_unit_link']);", "const HJ_KAKAO_AUTO_TOOLS=new Set(['add_schedule','add_project']);"]
};
if (process.env.HJ_V618_MUTATION) {
  const m = MUT[process.env.HJ_V618_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V618_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V618_MUTATION); html = html.replace(m[0], () => m[1]);
}

function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
let writes = 0;
const store = new Map();
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const noop = () => {};
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
const realNavigator = ctx.navigator;
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

// 저장 길은 가짜 — 고르는 규칙만 본다(진짜 aptUnitSave·aptUnitAssign 은 안전판·원자 저장, apt-unit-assign.e2e.js)
let saves = [], assigns = [];
ctx.render = () => {};
ctx.markDirty = () => {};
ctx.aptUnitSave = async (pj, input) => {
  const p = vm.runInContext('aptUnitProject', ctx)(pj), n = vm.runInContext('aptUnitNormalize', ctx)(input), id = 'unit_t' + (saves.length + 1);
  saves.push({ pj, unit: n });
  p.aptUnits = (p.aptUnits || []).concat(Object.assign({ id }, n));
  return id;
};
ctx.aptUnitAssign = async (pj, unitId, ids) => {
  assigns.push({ pj, unitId, ids: Array.from(ids, String) });   // VM 배열을 바깥 배열로(deepStrictEqual 은 프로토타입까지 본다)
  ids.forEach(id => { const f = vm.runInContext('state.files', ctx).find(x => x.id === id); f._aptUnit = { project: pj, unitId }; });
  return ids.length;
};
const P = '가상아파트';
function reset() {
  saves = []; assigns = [];
  vm.runInContext(`state._demo=false;state.projects=[{name:${JSON.stringify(P)},stage:2,aptUnits:[{id:'unit_old',type:'unit',dong:'4',ho:'902',name:'',note:''}]},{name:'다른현장',stage:1}];
  state.files=[
    {id:'a',kind:'photo',name:'A.jpg',project:${JSON.stringify(P)}},
    {id:'b',kind:'photo',name:'B.jpg',project:null},
    {id:'c',kind:'photo',name:'C.jpg',project:'다른현장'},
    {id:'d1',kind:'photo',name:'D.jpg',project:null},{id:'d2',kind:'photo',name:'D.jpg',project:null},
    {id:'e',kind:'photo',name:'E.jpg',project:${JSON.stringify(P)},_aptUnit:{project:${JSON.stringify(P)},unitId:'unit_old'}},
    {id:'f',kind:'photo',name:'F.jpg',project:${JSON.stringify(P)},_aptUnit:{project:${JSON.stringify(P)},unitId:'unit_gone'}},
    {id:'q',kind:'photo',name:'Q.jpg',project:null,_fromQuote:true},
    {id:'x',kind:'estimate',name:'X.jpg',project:null}];`, ctx);
}
const tool = (args) => runA(`return await aiToolRun('apt_unit_link',${JSON.stringify(args)});`);
const fileOf = (id) => run(`return state.files.find(f=>f.id===${JSON.stringify(id)});`);

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS aptunitlink-v618 ' + name); }

(async () => {
  await test('① 새 세대 · 그 현장/미배정만 · 다른 현장·다른 세대·같은 이름 여럿은 건너뜀 · 풀린 연결은 다시 (PICK)', async () => {
    reset();
    const r = await tool({ project: P, dong: '303동', ho: '901호', files: ['a.jpg', 'B.JPG', 'C.jpg', 'D.jpg', 'E.jpg', 'F.jpg', 'Q.jpg', 'X.jpg', 'G.jpg', 'a.jpg'] });
    assert.deepEqual(r, { 결과: '동·호수 연결', 현장: P, 세대: '303동 901호', 새세대: true, 연결: 3, 현장배정: 1, 이미연결: 0, 건너뜀: 3, 못찾음: 3 },
      JSON.stringify(r));
    assert.deepEqual(saves.map(s => [s.unit.dong, s.unit.ho, s.unit.type]), [['303', '901', 'unit']], "'303동'·'901호' 도 숫자로");
    assert.deepEqual(assigns, [{ pj: P, unitId: 'unit_t1', ids: ['a', 'b', 'f'] }], '그 현장 a · 미배정 b · 풀린 연결 f');
    assert.equal(fileOf('b').project, P, '미배정 사진은 그 현장으로 배정');
    assert.equal(fileOf('c').project, '다른현장', '다른 현장 사진은 그대로');
    assert.equal(fileOf('e')._aptUnit.unitId, 'unit_old', '다른 세대에 연결된 사진은 그대로');
    assert.equal(fileOf('d1').project, null, '같은 이름 여럿 — 손대지 않음');
  });

  await test('② 이미 있는 세대는 다시 만들지 않음 · 이미 그 세대인 사진 (REUSE)', async () => {
    reset();
    const r = await tool({ project: P, dong: '4', ho: '902', files: ['E.jpg', 'A.jpg'] });
    assert.equal(saves.length, 0, '4동 902호는 이미 있다');
    assert.deepEqual([r.새세대, r.이미연결, r.연결, r.세대], [false, 1, 1, '4동 902호']);
    assert.deepEqual(assigns, [{ pj: P, unitId: 'unit_old', ids: ['a'] }]);
    const none = await tool({ project: P, dong: '4', ho: '902', files: [] });
    assert.equal(none.연결, 0);
    assert.equal(assigns.length, 1, '사진이 없으면 연결 저장을 부르지 않는다');
  });

  await test('③ 공용부 · 잘못된 입력 (INPUT)', async () => {
    reset();
    const r = await tool({ project: P, area: '104동 3라인 옥상', files: ['B.jpg'] });
    assert.deepEqual([r.세대, saves[0].unit.type], ['104동 3라인 옥상', 'common']);
    await assert.rejects(tool({ project: '없는현장', dong: '1', ho: '101' }), /없거나/);
    await assert.rejects(tool({ project: P, dong: '1', ho: '12층' }), /숫자/);
  });

  await test('④ 요청함 · 카톡 승인 자동 반영 대상 · 화면 글 (INBOX)', async () => {
    const q = { id: 'kb-20261122-090000-a1001', tool: 'apt_unit_link', args: { project: P, dong: '303', ho: '901', files: ['B.jpg'] } };
    assert.equal(run(`return claudeReqBad(${JSON.stringify(q)});`), '', '요청함으로 받을 수 있다');
    assert.equal(run("return HJ_KAKAO_AUTO_TOOLS.has('apt_unit_link');"), true);
    assert.equal(run("return AI_WRITE.has('apt_unit_link');"), true, '장부를 바꾸는 작업으로 표시(요청함 경고·안전판)');
    assert.equal(run(`return aiActionLabel('apt_unit_link',${JSON.stringify(q.args)});`), '동·호수 연결 "가상아파트" 303동 901호 · 사진 1장');
  });

  console.log('aptunitlink-v618: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL aptunitlink-v618', e && e.stack || e); process.exit(1); });

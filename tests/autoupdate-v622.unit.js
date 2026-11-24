/* v622 🔄 손대지 않은 창은 새 판을 저절로 (단위 검사)
   대표 결정(11/24 'A' — 승인한 일이 PC 창에 묶이지 않게). 11/24 PC 크롬의 현장웹 창이 11/23 07:00 부터 v618 그대로 열려 있어
   카톡 승인 요청을 7시간 넘게 못 넣었다 — 새 판 확인은 켤 때·다시 볼 때뿐이었고 숨은 창은 확인조차 안 했다.
   ① 막는 때 — 체험·받는 중·사진/서류·폴더 저장 전·기기 저장 중·다른 탭이 더 최근(__tabStale)·서버에 못 올린 변경·서버 저장 중/충돌/인증·창·글 칸 (BLOCK)
   ② 손 안 댄 때만 — 숨은 창 15분 · 보이는 창 60분 · 기기에서 30분에 한 번 · 묻는 사이 손대면 그만 · 기기 저장을 끝낸 뒤에 단추와 같은 길 (IDLE)
   ③ 같은 판으로 두 번 바꿨는데도 그대로면 더 안 하고 띠만 (LOOP)
   ④ 바꾼 뒤 처음 열릴 때 한 번 알림 (NOTICE)
   ⑤ 부팅 연결 — 손댄 시각 세기 · 1분마다 · 알림 (WIRE)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(photoassign-v620.unit.js 와 같은 틀) 진짜 함수를 부른다.
   ⑥ 받는 사이 손대면 다시 열기 직전에 그만두고 횟수도 되돌린다 · 단추로 누른 것은 그대로 (ABORT)
   검토 반영: 쓰던 견적서(relayEditingNow)·폴더 다시 읽기·사진 묶음·보내기 깃발 막기 · 깨어난 창은 방금 손댄 것 · 실제로 바꿀 때만 횟수.
   변이(HJ_V622_MUTATION): ignore-stale-tab·ignore-unsynced·ignore-modal·ignore-busy-flags·ignore-editing 은 ①,
   no-idle-gate·visible-short·no-cadence·no-persist·recheck-after-ask·record-before-update·no-resume-reset 는 ②, no-loop-guard 는 ③, notice-any 는 ④,
   no-wiring·no-abort 는 ⑤, abort-keeps-tries·abort-always 는 ⑥에서 실패해야 한다. HJ_V622_BASELINE=<commit>(예: 993c31b) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V622_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V622_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'ignore-stale-tab': ["    if(__tabStale)return '다른 탭이 더 최근에 저장';\n", ''],
  'ignore-unsynced': ["    if(__relayUnsynced>0)return '서버에 못 올린 변경';\n", ''],
  'ignore-modal': ["    const mr=document.getElementById('modalRoot');if(mr&&mr.children&&mr.children.length)return '창이 열려 있음';\n", ''],
  'no-idle-gate': ['    if(navigator.onLine===false||!hjVerIdleEnough())return false;\n', '    if(navigator.onLine===false)return false;\n'],
  'visible-short': ['(hidden?HJ_VER_IDLE_HIDDEN_MS:HJ_VER_IDLE_SHOWN_MS)', 'HJ_VER_IDLE_HIDDEN_MS'],
  'no-cadence': ['    if(now-last<HJ_VER_IDLE_CHECK_MS||hjVerAutoBlocked())return false;\n', '    if(hjVerAutoBlocked())return false;\n'],
  'no-persist': ['    if(!(await guardedPersistCurrentState()))return false;\n', ''],
  'recheck-after-ask': ['    if(!hjVerIdleEnough()||hjVerAutoBlocked())return false;   // 묻는 사이', '    if(false)return false;   // 묻는 사이'],
  'no-loop-guard': ['    if(tries>=HJ_VER_AUTO_TRIES){if(__verBannerFor!==s.server)appVersionBanner(s.server);return false;}', ''],
  'notice-any': ["    if(!rec||rec.to!==APP_BUILD)return '';\n", "    if(!rec)return '';\n"],
  'no-wiring': ['setInterval(()=>{hjVerIdleTick();},60*1000);', ''],
  'ignore-busy-flags': ["    if(window.__hjScanBusy||window.__hjScanDirtyDeferred||window.__hjPzBusy||__relayFlushing||__hjOutboxFlushing)return '작업 중';", '    if(false)return;'],
  'ignore-editing': ["    if(relayEditingNow())return '편집 중';", '    if(false)return;'],
  'no-resume-reset': ["    if(gap>HJ_VER_RESUME_GAP_MS&&document.visibilityState!=='hidden'){__hjLastInputAt=now;return false;}", '    if(false){}'],
  'record-before-update': ["    if(!(await appVersionUpdate())){window.__hjVerAutoRun=false;return false;}", '    try{localStorage.setItem(HJ_VER_AUTO_KEY,JSON.stringify({to:s.server,tries:tries+1}));}catch(e){}if(!(await appVersionUpdate())){window.__hjVerAutoRun=false;return false;}'],
  'abort-keeps-tries': ["  if(stop){try{const p=window.__hjVerPrevRec;", "  if(false){try{const p=window.__hjVerPrevRec;"],
  'no-abort': ['if(!appVersionPhotoGuard()&&!hjVerAutoAbort())location.reload();', 'if(!appVersionPhotoGuard())location.reload();'],
  'abort-always': ['  if(!window.__hjVerAutoRun)return false;\n  window.__hjVerAutoRun=false;\n', '  window.__hjVerAutoRun=false;\n'],
};
if (process.env.HJ_V622_MUTATION) {
  const m = MUT[process.env.HJ_V622_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V622_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V622_MUTATION); html = html.replace(m[0], () => m[1]);
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
let appCode = '';
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  appCode = code;
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
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

const T0 = Date.UTC(2026, 10, 24, 6, 0, 0);
const MIN = 60 * 1000;
const SHELL = run('return APP_BUILD;'), NEWER = 'hyeonjang-v999-future';
let order = [], toasts = [], banners = [], asks = 0, server = NEWER, persistOk = true, onAsk = null;
const modal = { children: [] };
const doc = { visibilityState: 'hidden', activeElement: null, getElementById: id => (id === 'modalRoot' ? modal : null), addEventListener() {},
  querySelector: sel => (sel === '#modalRoot .modal' && modal.children.length ? {} : null) };
let updateOk = true;
ctx.document = doc;
ctx.navigator = { onLine: true };
ctx.toast = m => { toasts.push(String(m)); };
ctx.appVersionBanner = s => { banners.push(s); };
ctx.photoIntakePending = () => false;
ctx.appVersionState = async () => { asks++; if (onAsk) onAsk(); return { shell: SHELL, cache: SHELL, server, online: true, err: '' }; };
ctx.guardedPersistCurrentState = async () => { order.push('persist'); return persistOk; };
ctx.appVersionUpdate = async () => { order.push('update'); return updateOk; };
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(idleMin, opts = {}) {
  order = []; toasts = []; banners = []; asks = 0; server = opts.server || NEWER; persistOk = opts.persistOk !== false; onAsk = null; updateOk = true;
  store.clear(); modal.children = []; doc.visibilityState = opts.visible ? 'visible' : 'hidden'; doc.activeElement = null; ctx.navigator = { onLine: true };
  ctx.__T__ = T0;
  vm.runInContext(`state._demo=false;state.dirty=false;state.dirHandle=null;__hjLocalSavePending=false;__tabStale=false;__relayUnsynced=0;__relayState='saved';
    __appVersionUpdating=false;__verBannerFor='';window.__documentUploadPending=false;__hjLastInputAt=${T0 - idleMin * MIN};
    state.editingQuote=null;window.__hjScanBusy=false;window.__hjScanDirtyDeferred=false;window.__hjPzBusy=false;__relayFlushing=false;__hjOutboxFlushing=false;
    __hjVerLastTick=${T0 - MIN};window.__hjVerAutoRun=false;window.__hjVerPrevRec=null;`, ctx);
}
const tick = () => runA('return await hjVerIdleTick();');
const blocked = () => run('return hjVerAutoBlocked();');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS autoupdate-v622 ' + name); }

(async () => {
  await test('① 막는 때 — 저장·작업 중이거나 다른 탭이 더 최근이면 안 바꾼다 (BLOCK)', async () => {
    reset(120);
    assert.equal(blocked(), '', '아무것도 없으면 바꿔도 된다');
    const cases = [
      ['체험', 'state._demo=true;'], ['받는 중', '__appVersionUpdating=true;'], ['사진·서류 넣는 중', 'window.__documentUploadPending=true;'],
      ['폴더 저장 전', 'state.dirty=true;state.dirHandle={};'], ['기기 저장 중', '__hjLocalSavePending=true;'], ['다른 탭이 더 최근에 저장', '__tabStale=true;'],
      ['서버에 못 올린 변경', '__relayUnsynced=Date.now();'], ['서버 saving', "__relayState='saving';"], ['서버 conflict', "__relayState='conflict';"], ['서버 auth', "__relayState='auth';"],
      ['작업 중', 'window.__hjScanBusy=true;'], ['작업 중', 'window.__hjScanDirtyDeferred=true;'], ['작업 중', 'window.__hjPzBusy=true;'],
      ['작업 중', '__relayFlushing=true;'], ['작업 중', '__hjOutboxFlushing=true;'], ['편집 중', 'state.editingQuote={id:"q1"};'],
    ];
    for (const [why, src] of cases) { reset(120); run(src); assert.equal(blocked(), why, src); }
    reset(120); modal.children = [{}]; assert.equal(blocked(), '창이 열려 있음');
    reset(120); doc.activeElement = { tagName: 'TEXTAREA' }; assert.equal(blocked(), '글 칸');
    reset(120); doc.activeElement = { tagName: 'DIV', isContentEditable: true }; assert.equal(blocked(), '글 칸');
    reset(120); run('state.dirty=true;'); assert.equal(blocked(), '', '폴더 없는 기기(폰)의 dirty 는 늘 참이라 막지 않는다(v450)');
    reset(120); run('__tabStale=true;');
    assert.equal(await tick(), false); assert.equal(asks, 0, '막히면 서버에 묻지도 않는다');
  });

  await test('② 손 안 댄 때만 — 숨은 창 15분 · 보이는 창 60분 · 30분에 한 번 · 저장 끝낸 뒤 단추와 같은 길 (IDLE)', async () => {
    reset(5);
    assert.equal(await tick(), false); assert.equal(asks, 0, '5분 전에 손댄 창');
    reset(16);
    assert.equal(await tick(), true);
    assert.deepEqual(order, ['persist', 'update'], '기기 저장을 끝낸 뒤 바꾼다');
    const rec = JSON.parse(store.get('hj_ver_auto'));
    assert.deepEqual([rec.from, rec.to, rec.tries], [SHELL, NEWER, 1]);
    assert.equal(store.get('hj_ver_idle_at'), String(T0));
    order = []; ctx.__T__ = T0 + 10 * MIN;
    assert.equal(await tick(), false); assert.equal(asks, 1, '30분 안에는 다시 묻지 않는다');
    reset(30, { visible: true });
    assert.equal(await tick(), false); assert.equal(asks, 0, '보이는 창은 60분');
    reset(61, { visible: true });
    assert.equal(await tick(), true);
    reset(16, { server: SHELL });
    assert.equal(await tick(), false); assert.deepEqual(order, [], '이미 최신');
    reset(16); ctx.navigator = { onLine: false };
    assert.equal(await tick(), false); assert.equal(asks, 0, '오프라인');
    reset(16, { persistOk: false });
    assert.equal(await tick(), false); assert.deepEqual(order, ['persist'], '기기 저장이 안 되면 바꾸지 않는다');
    reset(16); onAsk = () => { vm.runInContext('__hjLastInputAt=Date.now();', ctx); };
    assert.equal(await tick(), false); assert.deepEqual(order, [], '묻는 사이 손을 대면 그만');
    reset(16); onAsk = () => { modal.children = [{}]; };
    assert.equal(await tick(), false); assert.deepEqual(order, [], '묻는 사이 창이 열리면 그만');
    reset(16); updateOk = false;
    assert.equal(await tick(), false); assert.equal(store.has('hj_ver_auto'), false, '못 바꿨으면 횟수에 넣지 않는다');
    reset(180, { visible: true }); vm.runInContext(`__hjVerLastTick=${T0 - 240 * MIN};`, ctx);
    assert.equal(await tick(), false); assert.equal(asks, 0, '1분 깨우기가 4시간 멈췄다 보이는 채 깨어남 — 대표가 방금 열었다');
    assert.equal(run('return __hjLastInputAt;'), T0, '방금 손댄 것으로');
    reset(16); vm.runInContext(`__hjVerLastTick=${T0 - 240 * MIN};`, ctx);
    assert.equal(await tick(), true, '숨은 채 늦게 돈 것은 깨어난 것이 아니다');
  });

  await test('⑥ 받는 사이 손대면 다시 열지 않고 횟수도 되돌린다 (ABORT)', async () => {
    reset(16);
    assert.equal(await tick(), true);
    assert.equal(run('return window.__hjVerAutoRun;'), true);
    assert.equal(run('return hjVerAutoAbort();'), false, '그대로 손 안 댐 — 다시 연다');
    assert.equal(JSON.parse(store.get('hj_ver_auto')).tries, 1);
    reset(16); store.set('hj_ver_auto', JSON.stringify({ from: SHELL, to: NEWER, tries: 1 }));
    assert.equal(await tick(), true);
    assert.equal(JSON.parse(store.get('hj_ver_auto')).tries, 2);
    vm.runInContext('__hjLastInputAt=Date.now();', ctx);
    assert.equal(run('return hjVerAutoAbort();'), true, '받는 사이 손댐 — 열지 않는다');
    assert.equal(JSON.parse(store.get('hj_ver_auto')).tries, 1, '횟수는 되돌린다');
    reset(16);
    assert.equal(await tick(), true);
    run("state.editingQuote={id:'q'};");
    assert.equal(run('return hjVerAutoAbort();'), true, '받는 사이 견적서를 쓰기 시작');
    assert.equal(store.has('hj_ver_auto'), false, '처음이었으면 기록도 없앤다');
    reset(16);
    assert.equal(run('return hjVerAutoAbort();'), false, '단추로 누른 새로고침(저절로가 아님)은 그대로');
    vm.runInContext('__hjLastInputAt=Date.now();', ctx);
    assert.equal(run('return hjVerAutoAbort();'), false);
  });

  await test('③ 같은 판으로 두 번 바꿨는데도 그대로면 띠만 (LOOP)', async () => {
    reset(16); store.set('hj_ver_auto', JSON.stringify({ from: SHELL, to: NEWER, tries: 1 }));
    assert.equal(await tick(), true);
    assert.equal(JSON.parse(store.get('hj_ver_auto')).tries, 2);
    reset(16); store.set('hj_ver_auto', JSON.stringify({ from: SHELL, to: NEWER, tries: 2 }));
    assert.equal(await tick(), false);
    assert.deepEqual([order, banners], [[], [NEWER]], '더 바꾸지 않고 새 판 띠');
    reset(16); store.set('hj_ver_auto', JSON.stringify({ from: SHELL, to: 'hyeonjang-v998-old', tries: 5 }));
    assert.equal(await tick(), true, '다른(더 새) 판이면 처음부터');
  });

  await test('④ 바꾼 뒤 처음 열릴 때 한 번 알림 (NOTICE)', async () => {
    reset(0); store.set('hj_ver_auto', JSON.stringify({ from: 'hyeonjang-v621-gcalskip', to: SHELL, tries: 1 }));
    assert.match(run('return hjVerAutoNotice();'), /손대지 않은 사이에 새 판 v622-autoupdate 으로 바꿨어요/);
    assert.equal(toasts.length, 1); assert.equal(store.has('hj_ver_auto'), false, '한 번만');
    assert.equal(run('return hjVerAutoNotice();'), '');
    reset(0); store.set('hj_ver_auto', JSON.stringify({ from: SHELL, to: NEWER, tries: 1 }));
    assert.equal(run('return hjVerAutoNotice();'), '', '아직 안 바뀌었으면 알리지 않고 기록을 남긴다(③이 센다)');
    assert.equal(store.has('hj_ver_auto'), true);
  });

  await test('⑤ 부팅 연결 — 손댄 시각 세기 · 1분마다 · 알림 (WIRE)', async () => {
    const line = appCode.split('\n').find(l => l.includes('hjVerIdleTick();')) || '';
    assert.match(line, /\['pointerdown','keydown','touchstart','wheel'\]\.forEach\(t=>document\.addEventListener\(t,\(\)=>\{__hjLastInputAt=Date\.now\(\);\},\{capture:true,passive:true\}\)\)/);
    assert.match(line, /setInterval\(\(\)=>\{hjVerIdleTick\(\);\},60\*1000\)/);
    assert.match(line, /setTimeout\(\(\)=>\{hjVerAutoNotice\(\);\},3000\)/);
    assert.match(line, /visibilitychange',\(\)=>\{if\(document\.visibilityState==='visible'\)__hjLastInputAt=Date\.now\(\);\}\)/, '보이게 되면 손댄 것');
    assert.match(line, /addEventListener\('pageshow',\(\)=>\{__hjLastInputAt=Date\.now\(\);\}\)/);
    assert.match(line, /addEventListener\('focus',\(\)=>\{__hjLastInputAt=Date\.now\(\);\}\)/);
    assert.match(appCode, /if\(!appVersionPhotoGuard\(\)&&!hjVerAutoAbort\(\)\)location\.reload\(\);/, '다시 열기 직전에 한 번 더');
    assert.match(appCode, /setTimeout\(\(\)=>\{appVersionAutoCheck\(\)\.catch\(\(\)=>\{\}\);\},2500\)/, '예전 확인(켤 때·다시 볼 때)은 그대로');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('autoupdate-v622: ' + passed + '/6');
  if (passed !== 6) process.exit(1);
})().catch(e => { console.error('FAIL autoupdate-v622', e && e.stack || e); process.exit(1); });

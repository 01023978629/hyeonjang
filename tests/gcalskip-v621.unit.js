/* v621 📅 구글에서 온 일정은 구글 캘린더 창을 다시 띄우지 않는다 (단위 검사)
   11/24 카톡 승인 1011번(카톡봇이 구글 캘린더에서 가져온 일정)을 현장웹이 저절로 넣자, 📅 구글 캘린더 자동 열기(hj_gcal_auto)가
   PC 에 '새 일정 만들기' 창을 띄웠다 — 저장하면 같은 일정이 구글에 둘이 된다. 카톡 승인 요청은 손대지 않아도 들어오므로 창이 아무 때나 뜬다.
   ① 출처 줄 — 메모 어느 줄이든 '구글 캘린더에서 가져옴'(꼬리 없음 · '(@ 제미나이 입력)' · '(카톡봇)')만 그 줄 전체일 때 (ORIGIN)
   ② 자동 열기 — 구글에서 온 일정은 안 띄우고, 손으로 만든 일정은 지금처럼 띄운다 (OPEN)
   ③ 실제 길 — aiToolRun add_schedule · 카톡 승인 저절로(hjKakaoAutoApply) 가 일정을 넣어도 구글에서 온 것이면 창 없음 (ADD)
   ④ 팀 글 — 카톡봇 출처 줄도 v605 처럼 뺀다(📤 일정 공유·작업자 문안·하루치 지시) (TEAM)
   ⑤ 📄 일정 복사 — 복사본은 구글에 없는 새 일정: 출처 줄을 옮기지 않아 자동 열기가 뜬다 (COPY)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(photoassign-v620.unit.js 와 같은 틀) 진짜 함수를 부른다. 실제 중계·드라이브·고객 없음.
   변이(HJ_V621_MUTATION): origin-any-text·origin-first-line·origin-no-trim·origin-no-bot 은 ①, open-ignores-origin 은 ②, copy-keeps-origin 은 ⑤에서 실패해야 한다
   (③·④는 ①·②가 지키는 같은 함수를 실제 길로 다시 본다). HJ_V621_BASELINE=<commit>(예: 16f485a) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V621_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V621_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'origin-any-text': ["function hjSchFromGcal(s){return String(s&&s.memo||'').split('\\n').some(l=>HJ_CALSYNC_FROM_RE.test(l.replace(/\\s+/g,' ').trim()));}",
    "function hjSchFromGcal(s){return /구글 캘린더에서 가져옴/.test(String(s&&s.memo||''));}"],
  'origin-first-line': ["String(s&&s.memo||'').split('\\n').some(", "String(s&&s.memo||'').split('\\n').slice(0,1).some("],
  'origin-no-trim': [".some(l=>HJ_CALSYNC_FROM_RE.test(l.replace(/\\s+/g,' ').trim()))", '.some(l=>HJ_CALSYNC_FROM_RE.test(l))'],
  'origin-no-bot': ['(?:@ 제미나이 입력|카톡봇)', '@ 제미나이 입력'],
  'copy-keeps-origin': [".split('\\n').filter(l=>!HJ_CALSYNC_FROM_RE.test(l.replace(/\\s+/g,' ').trim())).join('\\n').trim();\n  const base=HJ_YMD_RE", ".trim();\n  const base=HJ_YMD_RE"],
  'open-ignores-origin': ["/^💰/.test(s.title||'')||hjSchFromGcal(s))return false;", "/^💰/.test(s.title||''))return false;"],
};
if (process.env.HJ_V621_MUTATION) {
  const m = MUT[process.env.HJ_V621_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V621_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V621_MUTATION); html = html.replace(m[0], () => m[1]);
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

const T0 = Date.UTC(2026, 10, 24, 1, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000;
const BOT = '구글 캘린더에서 가져옴 (카톡봇)', APPSYNC = '구글 캘린더에서 가져옴 (@ 제미나이 입력)';
// 카톡봇 approvals.schedule_args 꼴 — 여러 날은 첫 줄 '시작~끝 (N일)', 가운데 근거 줄, 끝줄 출처
const botArgs = (title, extra) => Object.assign({ title, date: '2026-11-26', memo: '2026-11-26~2026-11-27 (2일)\n카톡봇 12번 · 가상 방\n' + BOT, allDay: true }, extra || {});
let opened = [], timers = [];
ctx.open = (url) => { opened.push(String(url)); return null; };
ctx.setTimeout = (fn) => { timers.push(fn); return timers.length; };
const flush = () => { const t = timers; timers = []; for (const fn of t) { try { fn(); } catch (e) { /* 검사 밖 타이머 */ } } };
let fileJson = { requests: [] }, relayLog = [];
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-24T01:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
ctx.toast = () => {}; ctx.openModal = () => {}; ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = () => Promise.resolve(true);
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(gcalAuto = true) {
  opened = []; timers = []; relayLog = []; store.clear(); ctx.__T__ = T0;
  if (gcalAuto) store.set('hj_gcal_auto', '1');
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=[{name:'가상빌라',stage:0,received:0,phases:[]}];state.files=[];state.schedule=[];
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const fromG = memo => run(`return hjSchFromGcal({title:'x',date:'2026-11-26',memo:${JSON.stringify(memo)}});`);
const maybeOpen = (title, memo) => run(`return hjGcalMaybeOpen(Object.assign(newSchedule(),{title:${JSON.stringify(title)},date:'2026-11-26',time:'09:00',memo:${JSON.stringify(memo)}}));`);

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS gcalskip-v621 ' + name); }

(async () => {
  await test('① 출처 줄 — 메모 어느 줄이든 그 줄 전체가 출처 표시일 때만 (ORIGIN)', async () => {
    reset();
    for (const m of [BOT, APPSYNC, '구글 캘린더에서 가져옴', botArgs('x').memo, '장소: 가상시 달빛로 5\n' + APPSYNC, '  구글  캘린더에서 가져옴  (카톡봇) ', '첫 줄\r\n' + BOT])
      assert.equal(fromG(m), true, JSON.stringify(m));
    for (const m of ['', '구글 캘린더에서 가져옴 확인할 것', '고객이 ' + BOT + ' 라고 말함', '구글 캘린더에서 가져옴 (다른 앱)', '실리콘 색 확인'])
      assert.equal(fromG(m), false, JSON.stringify(m));
    assert.equal(run('return hjSchFromGcal(null);'), false);
    assert.equal(run("return hjSchFromGcal({title:'x'});"), false, '메모 없는 일정');
  });

  await test('② 자동 열기 — 구글에서 온 일정은 안 띄우고, 손으로 만든 일정은 그대로 띄운다 (OPEN)', async () => {
    reset();
    assert.equal(maybeOpen('가상빌라 실측', '자재 확인'), true);
    assert.equal(opened.length, 1); assert.match(opened[0], /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=/);
    opened = [];
    assert.equal(maybeOpen('가상빌라 아스콘 작업', botArgs('x').memo), false, '카톡봇이 구글에서 가져온 일정');
    assert.equal(maybeOpen('가상빌라 배관', APPSYNC), false, '🔄 구글 캘린더 맞추기로 들어온 일정');
    assert.equal(maybeOpen('💰 가상빌라 잔금', ''), false, '돈 일정은 v5xx 그대로 안 띄움');
    assert.deepEqual(opened, []);
    reset(false);
    assert.equal(maybeOpen('가상빌라 실측', ''), false, '자동 열기를 끈 기기');
    assert.deepEqual(opened, []);
  });

  await test('③ 실제 길 — add_schedule·카톡 승인 저절로 넣기도 구글에서 온 일정이면 창 없음 (ADD)', async () => {
    reset();
    await runA(`await aiToolRun('add_schedule',${JSON.stringify(botArgs('가상빌라 옆 주차장 안전바'))});return null;`);
    flush();
    assert.deepEqual(opened, [], '요청함·AI 로 넣은 구글 일정');
    await runA("await aiToolRun('add_schedule',{title:'가상빌라 실측',date:'2026-11-27',time:'10:00'});return null;");
    flush();
    assert.equal(opened.length, 1, '손으로(요청·AI) 만든 새 일정은 지금처럼 한 번 띄운다');
    // 카톡 승인 — 요청함에서 저절로(v617) 들어와도 창이 뜨지 않는다
    reset();
    fileJson = { requests: [{ id: 'kb-20261124-075441-a1011', tool: 'add_schedule', args: botArgs('가상빌라 옆 주차장 안전바'), why: '구글 캘린더 일정',
      approved: { via: 'manager', at: at(T0 - 30 * MIN), item: 1011 } }] };
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    flush();
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261124-075441-a1011']);
    assert.deepEqual(run('return state.schedule.map(s=>s.date+"|"+s.title);'), ['2026-11-26|가상빌라 옆 주차장 안전바'], '일정은 그대로 들어감');
    assert.deepEqual(opened, [], '구글 캘린더 창 없음');
    assert.deepEqual(relayLog, ['listFiles', 'download']);
  });

  await test('④ 팀 글 — 카톡봇 출처 줄도 뺀다 · 다른 줄·맞추기 출처는 v605 그대로 (TEAM)', async () => {
    reset();
    const out = m => run(`return hjMemoOut(${JSON.stringify(m)}).text;`);
    assert.equal(out(BOT), '');
    assert.equal(out('실리콘 색 확인\n' + BOT), '실리콘 색 확인');
    assert.equal(out(botArgs('x').memo), '카톡봇 12번 · 가상 방', '기간 줄은 v577 처럼 떼고 근거 줄은 남김');
    assert.equal(out(APPSYNC), '', '맞추기 출처(v605) 그대로 뺌');
    assert.equal(out('구글 캘린더에서 가져옴 확인할 것'), '구글 캘린더에서 가져옴 확인할 것', '출처 줄이 아니면 그대로');
    assert.equal(run(`return hjWoMemoSafe({customer:{}},${JSON.stringify('주차 B2\n' + BOT)});`), '주차 B2', '📤 하루치 팀 지시도');
  });

  await test('⑤ 📄 일정 복사 — 출처 줄은 옮기지 않아 복사본은 자동 열기가 뜬다 (COPY)', async () => {
    reset();
    for (const memo of [botArgs('x').memo, '장소: 가상시 달빛로 5\n' + APPSYNC, '줄눈 회색\r\n' + BOT]) {
      const d = run(`return hjScheduleCopyDraft({id:'g1',date:'2026-11-26',time:'09:00',title:'가상빌라 타일',project:'가상빌라',memo:${JSON.stringify(memo)}});`);
      assert.equal(run(`return hjSchFromGcal({memo:${JSON.stringify(d.memo)}});`), false, '복사본 메모에 출처 줄 없음: ' + JSON.stringify(d.memo));
      opened = [];
      assert.equal(run(`return hjGcalMaybeOpen(Object.assign(newSchedule(),${JSON.stringify(d)}));`), true);
      assert.equal(opened.length, 1, '복사본은 구글에 없는 새 일정 — 창이 뜬다');
    }
    const d = run("return hjScheduleCopyDraft({id:'g2',date:'2026-11-26',title:'가상빌라 타일',memo:'2026-11-26~2026-11-27 (2일)\\n줄눈 회색\\n구글 캘린더에서 가져옴 (카톡봇)'});");
    assert.equal(d.memo, '줄눈 회색', '기간 줄(v361)과 출처 줄을 떼고 나머지는 그대로');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('gcalskip-v621: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL gcalskip-v621', e && e.stack || e); process.exit(1); });

/* v619 📲 카톡봇에서 승인하면 현장웹이 켜져 있는 동안 5분 안에 (단위 검사)
   대표 요청(11/23) "다음번에는 카톡봇에서 승인하면 넣어지게" — 승인한 결재(1007·1008·1009)가 요청함에서 1시간 넘게 안 들어갔다:
   현장웹은 요청 파일을 부팅·다시 보기·첫 화면에서 30분에 한 번만 읽었고, 사진 탭에 계속 있으면 읽지 않았다.
   또 세대 연결(apt_unit_link)은 사진이 아직 없는 기기가 먼저 넣으면 '못찾음'으로 처리돼 연결이 빠진다.
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(kakaoauto-v617.unit.js 와 같은 틀) 진짜 hjKakaoAutoTick·claudeInboxFetch·hjKakaoAutoApply 를
   가짜 relayCall(합성 요청 파일)로 부른다. aiToolRun 은 부른 것만 적는 가짜(진짜 도구 길은 aptunitlink-v618·kakaoauto-v617 이 지킨다). 실제 중계·드라이브·고객 없음.
   ① 5분마다 — 1분 깨우기 등록 · 읽은 지 5분 안이면 요청 0 · 5분 지나면 읽고 넣음 · 30분 알림 확인으로 방금 읽었으면 그것도 셈 (TICK)
   ② 끈 때 — 부팅 전·중계 없음·직원·체험·오프라인이면 요청 0 (GATE)
   ③ 세대 연결은 사진이 이 기기에 다 있을 때만 — 없으면 요청함에 남고 처리 표시 없음 · 다 오면 넣음 · 이틀 지나면 있는 것만이라도 · 다른 도구는 그대로 (UNIT)
   변이(HJ_V619_TICK_MUTATION): slow-tick·no-tick-throttle·no-tick-start 는 ①, tick-ignores-staff 는 ②, no-unit-ready·unit-no-timeout 은 ③ 에서 실패해야 한다.
   HJ_V619_BASELINE=<commit>(예: f3031a6) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V619_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V619_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'slow-tick': ['const HJ_KAKAO_TICK_MS=5*60*1000;', 'const HJ_KAKAO_TICK_MS=30*60*1000;'],
  'no-tick-throttle': ['    if(now-Math.max(last,hjClaudeInboxCheckedAt())<HJ_KAKAO_TICK_MS)return false;\n', '\n'],
  'no-tick-start': ['setInterval(()=>{hjKakaoAutoTick();},60*1000);', ''],
  'tick-ignores-staff': ["||!__hjCinboxArmed||(typeof hjStaffOn==='function'&&hjStaffOn());", '||!__hjCinboxArmed;'],
  'no-unit-ready': ['.filter(q=>hjKakaoUnitReady(q,now))', ''],
  'unit-no-timeout': ['  return isFinite(t)&&(now||Date.now())-t>HJ_KAKAO_UNIT_WAIT_MS;\n', '  return false;\n']
};
if (process.env.HJ_V619_TICK_MUTATION) {
  const m = MUT[process.env.HJ_V619_TICK_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V619_TICK_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V619_TICK_MUTATION); html = html.replace(m[0], () => m[1]);
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
const realNavigator = ctx.navigator;
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

const T0 = Date.UTC(2026, 10, 23, 8, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
const stamp = (via = 'kakao', ago = 5 * MIN) => ({ via, at: at(T0 - ago), item: 1008 });
const P = '가상빌아파트 305동 602호';
const FILES = ['KakaoTalk_20261123_155400111.jpg', 'KakaoTalk_20261123_155400111_01.jpg'];
const unit = (id, extra) => Object.assign({ id, tool: 'apt_unit_link', args: { project: P, dong: '305', ho: '602', files: FILES }, why: '카톡봇 사진 정리 305동 602호', approved: stamp() }, extra || {});
const prj = (id, name, extra) => Object.assign({ id, tool: 'add_project', args: { name }, why: '카톡봇 @사진', approved: stamp('manager') }, extra || {});
let relayLog = [], fileJson = { requests: [] }, calls = [];
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-23T08:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
ctx.toast = () => {}; ctx.openModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = () => Promise.resolve(true);
ctx.aiToolRun = (tool, args) => { calls.push(tool + ':' + (args.name || args.project)); return Promise.resolve(tool === 'apt_unit_link' ? { 결과: '동·호수 연결', 못찾음: 0 } : { 결과: '현장 생성' }); };
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(opts = {}) {
  relayLog = []; calls = []; store.clear(); ctx.__T__ = T0; ctx.navigator = realNavigator;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=${JSON.stringify([{ name: P, stage: 0, received: 0, phases: [] }])};
    state.files=${JSON.stringify(opts.files || [])};
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const tick = () => runA('return await hjKakaoAutoTick();');
const done = () => run('return state.claudeDone.slice();');
const photo = (name) => ({ id: 'f-' + name, kind: 'photo', name, project: null, prefix: '현장사진/' + P + '/' });

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS kakaotick-v619 ' + name); }

(async () => {
  await test('① 5분마다 — 1분 깨우기 · 5분 안이면 요청 0 · 지나면 읽고 넣음 · 30분 알림 확인도 셈 (TICK)', async () => {
    assert.match(appCode, /__hjCinboxArmed=true;[^\n]*setInterval\(\(\)=>\{hjKakaoAutoTick\(\);\},60\*1000\)/, '부팅(중계 연결) 뒤 1분마다 깨우기를 건다');
    fileJson = { requests: [prj('kb-20261123-174313-a1009', '용문동 257-10')] };
    reset();
    assert.equal(await tick(), true);
    assert.deepEqual(relayLog, ['listFiles', 'download'], '요청 파일만 읽음');
    assert.deepEqual(calls, ['add_project:용문동 257-10'], '승인 요청을 넣음');
    assert.deepEqual(done(), ['kb-20261123-174313-a1009']);
    fileJson = { requests: [prj('kb-20261123-174313-a1009', '용문동 257-10'), prj('kb-20261123-180000-a1010', '석교동 상가')] };
    ctx.__T__ = T0 + 2 * MIN;
    assert.equal(await tick(), false, '5분 안에는 다시 안 읽음');
    assert.deepEqual(relayLog, ['listFiles', 'download']);
    ctx.__T__ = T0 + 5 * MIN + 1;
    assert.equal(await tick(), true, '5분 지나면 다시 — 30분을 기다리지 않는다');
    assert.deepEqual(calls, ['add_project:용문동 257-10', 'add_project:석교동 상가'], '새 승인만 넣음(처리한 것은 다시 안 넣음)');
    // 30분 알림 확인(부팅·첫 화면)으로 방금 읽었으면 그것도 센다 — 중계를 겹쳐 두드리지 않게
    reset();
    assert.equal(await runA('return await hjClaudeInboxAutoCheck("dash");'), true);
    const n = relayLog.length;
    ctx.__T__ = T0 + 3 * MIN;
    assert.equal(await tick(), false); assert.equal(relayLog.length, n);
    ctx.__T__ = T0 + 6 * MIN;
    assert.equal(await tick(), true); assert.equal(relayLog.length, n + 2);
  });

  await test('② 끈 때 — 부팅 전·중계 없음·직원·체험·오프라인이면 요청 0 (GATE)', async () => {
    fileJson = { requests: [prj('kb-20261123-174313-a1009', '용문동 257-10')] };
    for (const [why, setup] of [
      ['부팅 전', () => run('__hjCinboxArmed=false;')],
      ['중계 없음', () => run("__relay.url='';__relay.token='';")],
      ['직원 모드', () => store.set('hj_role', 'staff')],
      ['체험', () => run('state._demo=true;')],
      ['오프라인', () => { ctx.navigator = { onLine: false }; }]
    ]) {
      reset(); setup();
      assert.equal(await tick(), false, why);
      assert.deepEqual(relayLog, [], why + ' — 요청 파일도 안 읽음');
      assert.deepEqual(calls, [], why);
    }
  });

  await test('③ 세대 연결은 사진이 이 기기에 다 있을 때만 · 이틀 지나면 있는 것만 · 다른 도구는 그대로 (UNIT)', async () => {
    fileJson = { requests: [unit('kb-20261123-174313-a1008'), prj('kb-20261123-174313-a1009', '용문동 257-10')] };
    reset({ files: [photo(FILES[0])] });                       // 한 장만 이 기기에
    assert.equal(await tick(), true);
    assert.deepEqual(calls, ['add_project:용문동 257-10'], '새 현장은 넣고 세대 연결은 기다림');
    assert.deepEqual(done(), ['kb-20261123-174313-a1009'], '세대 연결은 처리로 표시하지 않음 — 요청함에 남음');
    assert.equal(run('return hjClaudeInboxNoticeData().n;'), 1, '첫 화면 알림에 남은 1건');
    run(`state.files.push(${JSON.stringify(photo(FILES[1].toUpperCase()))});`);   // 나머지 사진이 들어옴(대소문자 무시)
    ctx.__T__ = T0 + 5 * MIN + 1;
    assert.equal(await tick(), true);
    assert.deepEqual(calls, ['add_project:용문동 257-10', 'apt_unit_link:' + P], '사진이 다 오면 넣음');
    assert.deepEqual(done(), ['kb-20261123-174313-a1009', 'kb-20261123-174313-a1008']);
    // 승인 뒤 이틀이 지나도 사진이 다 안 오면 — 있는 것만이라도 넣는다
    fileJson = { requests: [unit('kb-20261121-080000-a1007', { approved: stamp('kakao', 2 * D + H) })] };
    reset({ files: [] });
    assert.equal(await tick(), true);
    assert.deepEqual(calls, ['apt_unit_link:' + P], '이틀 지나면 넣음');
    // 사진 목록이 빈 세대 연결은 그대로(기다릴 것 없음)
    fileJson = { requests: [unit('kb-20261123-180000-a1011', { args: { project: P, dong: '305', ho: '602', files: [] } })] };
    reset({ files: [] });
    assert.equal(await tick(), true);
    assert.deepEqual(calls, ['apt_unit_link:' + P]);
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('kakaotick-v619: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error('FAIL kakaotick-v619', e && e.stack || e); process.exit(1); });

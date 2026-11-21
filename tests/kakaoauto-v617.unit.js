/* v617 📲 카톡 승인 요청 저절로 반영 (단위 검사)
   카톡봇 v1.9.1 결재함에서 대표가 카톡 나와의 채팅·관리 프로그램으로 승인한 현장웹 추가 요청(일정·현장)은 드라이브 요청 파일에 approved 도장이 찍혀 오고,
   현장웹이 요청 파일을 읽을 때(hjClaudeInboxAutoCheck) 요청함을 다시 열지 않아도 들어간다. 나머지는 지금처럼 요청함에서 ✓.
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(화면·저장소·네트워크는 빈 껍데기 — claudeinbox-notice-v614.unit.js 와 같은 틀)
   **진짜 hjClaudeInboxAutoCheck·claudeInboxFetch·hjKakaoAutoApply·aiToolRun** 을 가짜 relayCall(합성 요청 파일)로 부른다. 실제 중계·드라이브·고객 없음.
   ① 도장 찍힌 카톡·관리 프로그램 승인 일정·현장은 저절로 — 안전판 한 번 · claudeDone · 토스트 한 번 · 종일(allDay) · 알림 줄 비움 (APPLY)
   ② 도장 없음·Claude·7일 지남·미래·다른 도구·카톡봇 id 아님·날짜 이상 → 하나도 안 넣음 · 요청함에 남음 (GATE)
   ③ 링크·붙여넣기(?hjreq=)로 받은 요청은 도장이 있어도 절대 안 넣음 (LINK)
   ④ 직원 모드·체험이면 안 넣음(직접 불러도) (STAFF)
   ⑤ 같은 날 같은 제목 일정·같은 이름 현장이 이미 있으면 넣지 않고 처리로만 (DUP)
   ⑥ 처리한 요청은 다시 보지 않음 — 같은 결과로 두 번 불러도 안전판·저장 0 (DONE)
   ⑦ 넣다가 실패한 요청은 처리로 표시하지 않음(요청함에 남김) · 나머지는 넣음 (FAIL)
   ⑧ add_schedule 종일 — allDay:true 일 때만 '' · 다른 길은 예전처럼 09:00 (ALLDAY)
   ⑨ 한 번에 10건까지 (MAX)
   변이(HJ_V617_KAKAO_MUTATION): no-snapshot 은 ①, no-via-check·no-age-check·any-tool 은 ②, link-auto 는 ③, staff-auto 는 ④, no-dup-check 는 ⑤, no-done 은 ⑥,
   mark-on-fail 은 ⑦, allday-ignored 는 ①·⑧, no-max 는 ⑨ 에서 실패해야 한다. HJ_V617_BASELINE=<commit>(예: f5a1f03) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V617_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V617_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-snapshot': ["    try{await hjSnapshot('📲 카톡 승인 요청 반영 전 — '+list.length+'건',true);}catch(e){}\n", '\n'],
  'no-via-check': ["  if(!ap||typeof ap!=='object'||!HJ_KAKAO_AUTO_VIA.has(ap.via))return false;", "  if(!ap||typeof ap!=='object')return false;"],
  'no-age-check': ['  if(t>n+10*60*1000||n-t>HJ_KAKAO_AUTO_DAYS*86400000)return false;\n', '\n'],
  'any-tool': ['  if(!HJ_KAKAO_AUTO_TOOLS.has(q.tool))return false;\n', '\n'],
  'link-auto': ["    if(r.via==='link')return 0;", '    if(false)return 0;'],
  'staff-auto': ["    if(typeof hjStaffOn==='function'&&hjStaffOn())return 0;\n", '\n'],
  'no-dup-check': ["        if(q.tool==='add_schedule'&&hjKakaoSchHas(a)){same++;}", "        if(false){same++;}"],
  'no-done': ['filter(q=>q&&!done.has(q.id)&&hjKakaoAutoOk(q,now))', 'filter(q=>q&&hjKakaoAutoOk(q,now))'],
  'mark-on-fail': ["e&&e.message||e);}catch(_){}continue;}", 'e&&e.message||e);}catch(_){}}'],
  'allday-ignored': ["time:(a.allDay===true&&!a.time)?'':String(a.time||'09:00').slice(0,5)", "time:String(a.time||'09:00').slice(0,5)"],
  'no-max': ['.slice(0,HJ_KAKAO_AUTO_MAX);', ';']
};
if (process.env.HJ_V617_KAKAO_MUTATION) {
  const m = MUT[process.env.HJ_V617_KAKAO_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V617_KAKAO_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V617_KAKAO_MUTATION); html = html.replace(m[0], () => m[1]);
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

// 시각 — 도장 시각은 카톡봇처럼 지역 시각 'YYYY-MM-DDTHH:MM'(앱도 지역 시각으로 읽는다 — 시간대와 상관없이 맞게 T0 기준으로 만든다)
const T0 = Date.UTC(2026, 10, 21, 6, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const H = 3600 * 1000, D = 24 * H;
const stamp = (via = 'kakao', ago = H) => ({ via, at: at(T0 - ago), item: 1001 });
const sch = (id, title, date, extra) => Object.assign({ id, tool: 'add_schedule', args: { title, date, memo: '카톡봇 3번\n구글 캘린더에서 가져옴 (카톡봇)' }, why: '카톡봇 일정 3번', approved: stamp() }, extra || {});
const prj = (id, name, extra) => Object.assign({ id, tool: 'add_project', args: { name }, why: '카톡봇 새 현장', approved: stamp() }, extra || {});
let relayLog = [], fileJson = { requests: [] };
function fakeRelay(action, payload) {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-21T06:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
}
let toasts = [], snaps = [], dirty = 0;
ctx.relayCall = fakeRelay;
ctx.toast = (m) => { toasts.push(String(m)); };
ctx.openModal = () => {};
ctx.render = () => {};
ctx.markDirty = () => { dirty++; };
ctx.hjSnapshot = (label) => { snaps.push(String(label)); return Promise.resolve(true); };
ctx.hjGcalAutoOn = () => false;
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(opts = {}) {
  relayLog = []; toasts = []; snaps = []; dirty = 0;
  store.clear(); ctx.__T__ = T0; ctx.navigator = realNavigator;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=${JSON.stringify(opts.done || [])};
    state.schedule=${JSON.stringify(opts.schedule || [])};state.projects=${JSON.stringify(opts.projects || [{ name: '가상래미안', stage: 0, received: 0, phases: [] }])};
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const auto = () => runA('return await hjClaudeInboxAutoCheck("boot");');
const schedule = () => run('return state.schedule.map(s=>({title:s.title,date:s.date,time:s.time,memo:s.memo,project:s.project}));');
const projects = () => run('return state.projects.map(p=>p.name);');
const done = () => run('return state.claudeDone.slice();');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS kakaoauto-v617 ' + name); }

(async () => {
  await test('① 도장 찍힌 카톡·관리 프로그램 승인 일정·현장은 저절로 (APPLY)', async () => {
    fileJson = { requests: [
      sch('kb-20261121-140000-a1001', '가상래미안 욕실 타일', '2026-11-24', { args: { title: '가상래미안 욕실 타일', date: '2026-11-24', allDay: true, project: '가상래미안', memo: '2026-11-24~2026-11-25 (2일)\n카톡봇 3번\n구글 캘린더에서 가져옴 (카톡봇)' } }),
      prj('kb-20261121-140000-a1002', '가상빌'),
      sch('kb-20261121-140000-a1003', '가상빌 바닥 미장', '2026-11-26', { args: { title: '가상빌 바닥 미장', date: '2026-11-26', time: '10:00' }, approved: stamp('manager', 2 * H) })
    ] };
    reset();
    assert.equal(await auto(), true);
    assert.deepEqual(relayLog, ['listFiles', 'download'], '요청 파일만 읽음');
    assert.deepEqual(schedule(), [
      { title: '가상래미안 욕실 타일', date: '2026-11-24', time: '', memo: '2026-11-24~2026-11-25 (2일)\n카톡봇 3번\n구글 캘린더에서 가져옴 (카톡봇)', project: '가상래미안' },
      { title: '가상빌 바닥 미장', date: '2026-11-26', time: '10:00', memo: '', project: '' }
    ], '종일(allDay)·메모(여러 날·가져옴 표시)·시각 그대로');
    assert.deepEqual(projects(), ['가상래미안', '가상빌']);
    assert.deepEqual(done(), ['kb-20261121-140000-a1001', 'kb-20261121-140000-a1002', 'kb-20261121-140000-a1003'], '처리한 id(기기끼리 공유)');
    assert.equal(snaps.length, 1, '안전판은 넣기 전에 한 번 ' + JSON.stringify(snaps));
    assert.match(snaps[0], /카톡 승인 요청 반영 전 — 3건/);
    assert.ok(dirty >= 1, '저장 표시');
    assert.deepEqual(toasts.filter(t => /카톡에서 승인한/.test(t)), ['📲 카톡에서 승인한 요청 3건을 현장웹에 넣었어요'], '토스트 한 번 ' + JSON.stringify(toasts));
    assert.equal(run('return hjClaudeInboxNoticeData().n;'), 0, '첫 화면 알림 줄에서도 빠짐');
  });

  await test('② 도장 없음·Claude·7일 지남·미래·다른 도구·카톡봇 id 아님·시각 이상 → 안 넣음 (GATE)', async () => {
    const reqs = [
      sch('kb-20261121-1', '도장 없음', '2026-11-24', { approved: undefined }),
      sch('kb-20261121-2', 'Claude 도장', '2026-11-24', { approved: stamp('claude') }),
      sch('kb-20261121-3', '도장 via 없음', '2026-11-24', { approved: { at: at(T0 - H) } }),
      sch('kb-20261121-4', '8일 전 승인', '2026-11-24', { approved: stamp('kakao', 8 * D) }),
      sch('kb-20261121-5', '미래 승인', '2026-11-24', { approved: stamp('kakao', -H) }),
      { id: 'kb-20261121-6', tool: 'set_stage', args: { project: '가상래미안', stage: '완료' }, approved: stamp() },
      sch('cl-20261121-7', '카톡봇 id 아님', '2026-11-24'),
      sch('kb-20261121-8', '시각 이상', '2026-11-24', { approved: { via: 'kakao', at: '어제쯤' } }),
      sch('kb-20261121-9', '도장이 글자', '2026-11-24', { approved: 'kakao' })
    ];
    fileJson = { requests: reqs };
    reset();
    assert.equal(await auto(), true);
    assert.deepEqual(schedule(), [], '하나도 안 넣음 ' + JSON.stringify(schedule()));
    assert.equal(run("return state.projects.find(p=>p.name==='가상래미안').stage;"), 0, '단계 바꾸기는 저절로 안 함');
    assert.deepEqual(done(), [], '처리로도 안 표시');
    assert.equal(snaps.length + toasts.length, 0, '안전판·토스트 0');
    assert.equal(run('return hjClaudeInboxNoticeData().n;'), reqs.length, '모두 요청함에 남아 대표가 손으로');
  });

  await test('③ 링크·붙여넣기로 받은 요청은 도장이 있어도 절대 안 넣음 (LINK)', async () => {
    reset();
    const code = JSON.stringify({ requests: [sch('kb-20261121-140000-a1001', '링크 일정', '2026-11-24'), prj('kb-20261121-140000-a1002', '링크현장')] });
    const n = await runA(`const d=claudeReqDecode(${JSON.stringify(code)});return {via:d.via,n:d.requests.length,applied:await hjKakaoAutoApply(d)};`);
    assert.deepEqual(n, { via: 'link', n: 2, applied: 0 });
    assert.deepEqual(schedule(), []); assert.deepEqual(projects(), ['가상래미안']); assert.deepEqual(done(), []);
  });

  await test('④ 직원 모드·체험이면 안 넣음 — 직접 불러도 (STAFF)', async () => {
    fileJson = { requests: [prj('kb-20261121-140000-a1002', '가상빌')] };
    reset(); store.set('hj_role', 'staff');
    assert.equal(await auto(), false); assert.deepEqual(relayLog, [], '직원 모드 — 요청 파일도 안 읽음');
    store.delete('hj_role');
    const fetched = await runA('return await claudeInboxFetch();');
    store.set('hj_role', 'staff');
    assert.equal(await runA(`return await hjKakaoAutoApply(${JSON.stringify(fetched)});`), 0, '직원 모드에서 직접 불러도 0');
    store.delete('hj_role'); run('state._demo=true;');
    assert.equal(await runA(`return await hjKakaoAutoApply(${JSON.stringify(fetched)});`), 0, '체험 모드 0');
    assert.deepEqual(projects(), ['가상래미안']); assert.deepEqual(done(), []);
  });

  await test('⑤ 같은 날 같은 제목 일정·같은 이름 현장이 있으면 넣지 않고 처리로만 (DUP)', async () => {
    fileJson = { requests: [sch('kb-20261121-140000-a1001', '가상래미안 욕실 타일', '2026-11-24'), prj('kb-20261121-140000-a1002', '가상래미안'),
      sch('kb-20261121-140000-a1003', '가상래미안 욕실 타일', '2026-11-25')] };
    reset({ schedule: [{ id: 's1', title: '가상래미안  욕실타일', date: '2026-11-24', time: '09:00', project: '가상래미안', memo: '' }] });
    assert.equal(await auto(), true);
    assert.deepEqual(schedule().map(s => s.date), ['2026-11-24', '2026-11-25'], '같은 날 같은 제목(띄어쓰기 무시)은 그대로 하나 · 다른 날은 넣음');
    assert.deepEqual(projects(), ['가상래미안'], '같은 이름 현장은 그대로');
    assert.equal(done().length, 3, '셋 다 처리로 — 다시 보지 않게');
    assert.deepEqual(toasts.filter(t => /카톡에서 승인한/.test(t)), ['📲 카톡에서 승인한 요청 1건을 현장웹에 넣었어요 · 이미 있던 2건은 건너뜀']);
  });

  await test('⑥ 처리한 요청은 다시 보지 않음 — 같은 결과로 두 번 불러도 안전판·저장 0 (DONE)', async () => {
    fileJson = { requests: [prj('kb-20261121-140000-a1002', '가상빌')] };
    reset();
    const fetched = await runA('return await claudeInboxFetch();');
    assert.equal(await runA(`return await hjKakaoAutoApply(${JSON.stringify(fetched)});`), 1);
    const s0 = snaps.length, d0 = dirty, t0 = toasts.length;
    assert.equal(await runA(`return await hjKakaoAutoApply(${JSON.stringify(fetched)});`), 0, '옛 결과로 다시 불러도');
    assert.equal(snaps.length, s0, '안전판 다시 안 찍음'); assert.equal(dirty, d0, '저장 표시 다시 안 함'); assert.equal(toasts.length, t0);
    assert.deepEqual(projects(), ['가상래미안', '가상빌']);
  });

  await test('⑦ 넣다가 실패한 요청은 처리로 표시하지 않음 · 나머지는 넣음 (FAIL)', async () => {
    fileJson = { requests: [sch('kb-20261121-140000-a1001', '없는 날짜', '2026-02-30'), sch('kb-20261121-140000-a1003', '가상빌 바닥 미장', '2026-11-26')] };
    reset();
    assert.equal(await auto(), true);
    assert.deepEqual(schedule().map(s => s.title), ['가상빌 바닥 미장']);
    assert.deepEqual(done(), ['kb-20261121-140000-a1003'], '실패한 것은 요청함에 남음');
    assert.equal(run('return hjClaudeInboxNoticeData().n;'), 1);
  });

  await test("⑧ add_schedule 종일 — allDay:true 일 때만 '' · 다른 길은 09:00 그대로 (ALLDAY)", async () => {
    reset();
    await runA("await aiToolRun('add_schedule',{title:'종일 일',date:'2026-11-24',allDay:true});await aiToolRun('add_schedule',{title:'시각 없는 일',date:'2026-11-24'});" +
      "await aiToolRun('add_schedule',{title:'시각 있는 종일 표시',date:'2026-11-24',allDay:true,time:'13:00'});return null;");
    assert.deepEqual(schedule().map(s => s.time), ['', '09:00', '13:00']);
  });

  await test('⑨ 한 번에 10건까지 (MAX)', async () => {
    fileJson = { requests: Array.from({ length: 12 }, (_, i) => prj('kb-20261121-140000-a' + (2000 + i), '가상현장' + i)) };
    reset();
    assert.equal(await auto(), true);
    assert.equal(projects().length, 11, '10곳 + 원래 1곳');
    assert.equal(run('return hjClaudeInboxNoticeData().n;'), 2, '남은 2건은 다음에(또는 요청함에서)');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('kakaoauto-v617: ' + passed + '/9');
  if (passed !== 9) process.exit(1);
})().catch(e => { console.error('FAIL kakaoauto-v617', e && e.stack || e); process.exit(1); });

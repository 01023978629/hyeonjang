/* v614 🤖 클로드 요청함 알림 — 카톡봇(v1.8.6)·클로드가 드라이브 요청 파일(클로드_요청함.json)에 남긴 요청을 첫 화면 한 줄로 알림 (단위 검사)
   예전엔 대표가 더보기 › 🤖 클로드 요청함을 열어야만 요청 파일을 읽었다 — 카톡봇이 남긴 '현장 만들기' 요청이 며칠씩 묻혔다.
   이제 서버(중계)가 연결된 기기에서 부팅·앱 다시 보기·첫 화면 그리기 때 30분에 한 번 요청 파일을 읽어(claudeInboxFetch 그대로) ✅ 오늘 현장 업무 칸에
   '🤖 카톡봇·클로드 요청 n건이 승인을 기다려요' 한 줄 + [요청함 열기] + [✕]. **읽기만** — 적용은 요청함의 [✓ 승인·적용] 그대로.
   브라우저 없이 돈다: index.html 의 앱 스크립트를 통째로 VM 에 올려(화면·저장소·네트워크는 빈 껍데기) **진짜 hjClaudeInboxAutoCheck·claudeInboxFetch·
   hjClaudeInboxNotice*** 를 가짜 relayCall(합성 요청 파일)로 부른다. 실제 중계·드라이브·고객 없음, 바깥 요청 없음(fetch 0).
   ① 서버 미연결·체험·직원 모드·오프라인·부팅 뒤에 붙인 연결(__hjCinboxArmed 꺼짐) → relayCall 0 · 확인 시각도 안 남김 (NORELAY)
   ② 30분에 한 번 — 두 번째는 요청 0 · 시각은 localStorage 에도(새로 고침 흉내 뒤에도 요청 0, 대기 요약은 남아 줄이 그대로) · 30분 지나면 다시 (THROTTLE)
   ③ 처리한 id(state.claudeDone)·형식 오류·금지 도구는 빠짐(claudeInboxFetch) · 받은 뒤 처리한 것도 그릴 때 빠짐 · 자동 확인은 state 를 안 바꿈 (DONE)
   ④ 줄 HTML — 건수 · add_project 현장 이름 3개까지 + '외 n곳' · 이름은 이스케이프 · 단추 44px · 대기 0 이면 빈 자리(hidden) (HTML)
   ⑤ [✕] — 그때 id 들을 기억해 숨김 · 처리돼 줄기만 하면 숨긴 채 · 새 id 가 생기면 다시 · localStorage 로 새로 고침 뒤에도 (DISMISS)
   ⑥ 실패는 조용히 — 던짐·ok:false·JSON 아님 → false, console.debug 만(토스트·창 없음), 실패도 30분을 셈 (QUIET)
   ⑦ [요청함 열기] — 이 창에서 받은 결과가 있으면 처리한 것을 다시 걸러 claudeInboxView(preset), 없으면 claudeInboxView() 가 새로 받음 (OPEN)
   변이(HJ_V614_CINBOX_MUTATION): no-throttle·memory-only 는 ②, no-relay-guard·no-armed-gate 는 ①, no-done-filter 는 ③, no-escape·no-name-cap 은 ④,
   dismiss-any-change·no-dismiss 는 ⑤, toast-errors 는 ⑥, stale-preset 은 ⑦ 에서 실패해야 한다. HJ_V614_CINBOX_BASELINE=<commit>(예: 4be5651) 은 ①에서.
   앱 스크립트가 VM 에 안 올라가면(새 최상위 코드가 브라우저 API 를 부름) 아래 any()/ctx 에 그 이름을 더하라 — 검사를 끄지 마라. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V614_CINBOX_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V614_CINBOX_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-throttle': ['    if(now-hjClaudeInboxCheckedAt()<HJ_CINBOX_CHECK_MS)return false;\n', '\n'],
  'memory-only': ['  let ls=0;try{ls=Number(localStorage.getItem(HJ_CINBOX_AT_KEY))||0;}catch(e){}\n', '  let ls=0;\n'],
  'no-armed-gate': ['    if(!__hjCinboxArmed)return false;', '    if(false)return false;'],
  'no-relay-guard': ["    if(state._demo||typeof relayReady!=='function'||!relayReady())return false;\n", '    if(state._demo)return false;\n'],
  'no-done-filter': ['  return __hjCinbox.items.filter(x=>!done.has(x.id));\n', '  return __hjCinbox.items.slice();\n'],
  'no-escape': ["🏗 새 현장: '+escapeHtml(d.names.join(' · '))+", "🏗 새 현장: '+d.names.join(' · ')+"],
  'no-name-cap': ['names:names.slice(0,3),more:Math.max(0,names.length-3)', 'names:names,more:0'],
  'dismiss-any-change': ['show:pending.some(x=>!hid.has(x.id))};', "show:pending.map(x=>x.id).join('|')!==[...hid].join('|')};"],
  'no-dismiss': ['show:pending.some(x=>!hid.has(x.id))};', 'show:true};'],
  'toast-errors': ["    if(!(r&&r.ok)){try{console.debug('[클로드 요청함 알림] 확인 실패('+String(reason||'')+')',r&&r.error);}catch(e){}return false;}\n",
    "    if(!(r&&r.ok)){toast('요청함 확인 실패: '+(r&&r.error));return false;}\n"],
  'stale-preset': ['    const rest=Object.assign({},r,{requests:(r.requests||[]).filter(q=>q&&!done.has(q.id))});\n', '    const rest=Object.assign({},r);\n']
};
if (process.env.HJ_V614_CINBOX_MUTATION) {
  const m = MUT[process.env.HJ_V614_CINBOX_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V614_CINBOX_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor'); html = html.replace(m[0], () => m[1]);
}

// ── 앱 스크립트를 VM 에 — 화면·저장소·네트워크는 무엇이든 받아 주는 빈 껍데기 (formernames-v614.unit.js 와 같은 틀) ──
function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
let writes = 0, debugs = 0;
const store = new Map();
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const noop = () => {};
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: () => { debugs++; } }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
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

// 합성 요청 파일 — 이름·id 는 모두 가짜(카톡봇 꼴 kb-YYYYMMDD-HHMMSS-n)
const T0 = Date.UTC(2026, 10, 20, 1, 0, 0);
const req = (id, name, extra) => Object.assign({ id, tool: 'add_project', args: { name }, why: '카톡봇: 사진 폴더 새 현장' }, extra || {});
const FILE = (requests) => ({ requests });
let relayLog = [], relayMode = 'ok', fileJson = FILE([]);
const relayOdd = [];   // 가짜 중계가 본 뜻밖의 인자 — 끝에 비어 있어야 한다(가짜 안에서 던지면 앱이 '실패'로 삼켜 버린다)
function fakeRelay(action, payload) {
  relayLog.push(action);
  if (relayMode === 'throw') return Promise.reject(new Error('네트워크 끊김(가짜)'));
  if (relayMode === 'notok') return Promise.resolve({ ok: false, message: 'unauthorized' });
  if (action === 'listFiles') {
    if (JSON.stringify(payload) !== '{"kind":"doc"}') relayOdd.push('listFiles ' + JSON.stringify(payload));   // 문서 폴더 목록만
    return Promise.resolve({ ok: true, files: relayMode === 'nofile' ? [{ id: 'F0', name: '다른파일.xlsx' }] : [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-20T01:00:00Z' }] });
  }
  if (action === 'download') {
    if (!payload || payload.fileId !== 'FREQ1') relayOdd.push('download ' + JSON.stringify(payload));   // 요청 파일만 내려받음
    const b64 = relayMode === 'badjson' ? Buffer.from('{이건 JSON 아님', 'utf8').toString('base64') : Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64');
    return Promise.resolve({ ok: true, dataB64: b64 });
  }
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
}
let toasts = 0, modals = 0, views = [];
ctx.relayCall = fakeRelay;
ctx.toast = () => { toasts++; };
ctx.openModal = () => { modals++; };
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(opts = {}) {
  relayLog = []; relayMode = 'ok'; toasts = 0; modals = 0; views = []; debugs = 0;
  store.clear(); ctx.__T__ = T0; ctx.navigator = realNavigator;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=${opts.armed === false ? 'false' : 'true'};state._demo=false;state.claudeDone=${JSON.stringify(opts.done || [])};
    __relay.url=${JSON.stringify(opts.relay === false ? '' : 'https://script.google.com/macros/s/AKfyTEST/exec')};__relay.token=${JSON.stringify(opts.relay === false ? '' : 'TEST-RELAY-TOKEN')};`, ctx);
}
const reload = () => vm.runInContext('__hjCinbox={at:0,result:null,items:null,dismissed:null};', ctx);   // 새로 고침 흉내 — 메모리만 비움(localStorage 는 남음)
const auto = (why = 'test') => runA(`return await hjClaudeInboxAutoCheck(${JSON.stringify(why)});`);
const data = () => run('return hjClaudeInboxNoticeData();');
const inner = () => run('return hjClaudeInboxNoticeInner();');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS claudeinbox-notice-v614 ' + name); }

(async () => {
  await test('① 서버 미연결·체험·직원 모드·부팅 뒤 연결·오프라인 → 요청 0 · 시각도 안 남김 (NORELAY)', async () => {
    fileJson = FILE([req('kb-20261120-090000-1', '가상빌라 101호')]);
    reset({ relay: false });
    assert.equal(run('return __hjCinboxArmed;'), true, '이 검사는 부팅 때 연결된 기기를 흉내 낸다');
    assert.equal(await auto('boot'), false, '미연결 → false');
    assert.deepEqual(relayLog, [], '미연결인데 중계를 불렀다 ' + JSON.stringify(relayLog));
    assert.equal(store.get('hj_claude_inbox_checked_at'), undefined, '미연결이면 확인 시각도 안 남김(연결하면 바로 확인)');
    assert.equal(inner(), '', '줄 없음');
    reset(); run('state._demo=true;');
    assert.equal(await auto('dash'), false); assert.deepEqual(relayLog, [], '체험 모드 요청 0');
    reset(); store.set('hj_role', 'staff');
    assert.equal(await auto('dash'), false); assert.deepEqual(relayLog, [], '직원 모드 요청 0');
    reset({ armed: false });
    assert.equal(await auto('dash'), false); assert.equal(await auto('visible'), false);
    assert.deepEqual(relayLog, [], '부팅 뒤에 붙인 연결(설정에서 방금 연결) — 다음에 열 때부터, 요청 0');
    assert.equal(store.get('hj_claude_inbox_checked_at'), undefined, '켜지지 않은 기기는 시각도 안 남김');
    reset(); ctx.navigator = { onLine: false };
    assert.equal(await auto('visible'), false); assert.deepEqual(relayLog, [], '오프라인 요청 0');
    assert.equal(store.get('hj_claude_inbox_checked_at'), undefined, '오프라인이면 시각 안 남김');
  });

  await test('② 30분에 한 번 · localStorage 시각으로 새로 고친 뒤에도 · 30분 지나면 다시 (THROTTLE)', async () => {
    fileJson = FILE([req('kb-20261120-090000-1', '가상빌라 101호'), req('kb-20261120-090000-2', '가상아파트 2동 303호')]);
    reset();
    assert.equal(await auto('boot'), true, '첫 확인');
    assert.deepEqual(relayLog, ['listFiles', 'download'], '목록 → 요청 파일 내려받기 ' + JSON.stringify(relayLog));
    assert.equal(store.get('hj_claude_inbox_checked_at'), String(T0), '시각을 localStorage 에도');
    assert.equal(data().n, 2, '대기 2건');
    ctx.__T__ = T0 + 29 * 60 * 1000;
    assert.equal(await auto('dash'), false); assert.equal(await auto('visible'), false);
    assert.equal(relayLog.length, 2, '30분 안에는 다시 안 부름 ' + JSON.stringify(relayLog));
    reload();
    assert.equal(await auto('boot'), false, '새로 고친 뒤에도(메모리 비움) localStorage 시각으로 막힘');
    assert.equal(relayLog.length, 2, '새로 고침 뒤 요청 0');
    assert.equal(data().n, 2, '새로 고친 뒤에도 대기 요약이 남아 줄이 그대로 ' + JSON.stringify(data()));
    assert.match(inner(), /요청 2건이 승인을 기다려요/);
    ctx.__T__ = T0 + 30 * 60 * 1000 + 1;
    assert.equal(await auto('visible'), true, '30분 지나면 다시');
    assert.deepEqual(relayLog, ['listFiles', 'download', 'listFiles', 'download']);
    // 요청함을 손으로 열어 받은 것(claudeInboxFetch)도 시각·요약을 새로 쓴다
    ctx.__T__ = T0 + 40 * 60 * 1000;
    fileJson = FILE([]);
    await runA('return await claudeInboxFetch();');
    assert.equal(store.get('hj_claude_inbox_checked_at'), String(T0 + 40 * 60 * 1000), '손으로 연 확인도 시각을 씀');
    assert.equal(data().n, 0, '요청이 비면 줄도 비움'); assert.equal(store.has('hj_claude_inbox_pending'), false, '빈 요약은 지움');
    assert.equal(inner(), '');
    assert.equal(writes, fetchAtBoot, '진짜 fetch 0');
  });

  await test('③ 처리한 id·형식 오류·금지 도구는 빠짐 · 받은 뒤 처리한 것도 빠짐 · state 무변경 (DONE)', async () => {
    fileJson = FILE([
      req('kb-20261120-090000-1', '가상빌라 101호'), req('kb-done-1', '이미 만든 현장'),
      { id: 'kb-bad-1', tool: 'delete_project', args: { name: '가상빌라 101호' }, why: '금지 도구' },
      { id: 'kb-bad-2', tool: 'rm_rf_everything', args: {} }, { tool: 'add_project', args: { name: 'id 없음' } },
      { id: 'kb-sched-1', tool: 'add_schedule', args: { date: '2026-11-21', title: '가상 일정' }, why: '일정' },
      req('kb-20261120-090000-3', '가상주택')
    ]);
    reset({ done: ['kb-done-1'] });
    const before = run('return {done:state.claudeDone.slice(),keys:Object.keys(serializeData()).sort(),projects:state.projects.length};');
    assert.equal(await auto('boot'), true);
    const d = data();
    assert.deepEqual(d.ids, ['kb-20261120-090000-1', 'kb-sched-1', 'kb-20261120-090000-3'], '처리한 id·금지·모르는 도구·id 없음은 빠짐 ' + JSON.stringify(d));
    assert.equal(d.n, 3, '건수는 요청 수(현장 만들기 아닌 요청도 셈)');
    assert.deepEqual(d.names, ['가상빌라 101호', '가상주택'], '이름은 현장 만들기만');
    run("state.claudeDone.push('kb-20261120-090000-1');");
    assert.deepEqual(data().ids, ['kb-sched-1', 'kb-20261120-090000-3'], '받은 뒤 처리(다른 기기 동기화 포함)한 것은 그릴 때 빠짐');
    run("state.claudeDone=state.claudeDone.filter(x=>x!=='kb-20261120-090000-1');");
    const after = run('return {done:state.claudeDone.slice(),keys:Object.keys(serializeData()).sort(),projects:state.projects.length};');
    assert.deepEqual(after, before, '자동 확인은 state·저장 키를 안 바꿈(읽기만) ' + JSON.stringify(after));
    reload(); run("state.claudeDone.push('kb-sched-1');");
    assert.deepEqual(data().ids, ['kb-20261120-090000-1', 'kb-20261120-090000-3'], 'localStorage 요약도 그릴 때 다시 거름');
  });

  await test('④ 줄 HTML — 건수 · 이름 3개 + 외 n곳 · 이스케이프 · 44px · 비면 hidden 자리 (HTML)', async () => {
    fileJson = FILE([
      req('kb-1', '하이츠빌아파트 305동 602호'), req('kb-2', '가상빌라 <b>101</b>호'), req('kb-3', '가상주택 & 창고'),
      req('kb-4', '가상상가 1층'), req('kb-5', '가상오피스텔 1204호'),
      { id: 'kb-6', tool: 'add_schedule', args: { date: '2026-11-21', title: '가상 일정' } }
    ]);
    reset();
    await auto('boot');
    const h = inner();
    assert.match(h, /🤖 카톡봇·클로드 요청 6건이 승인을 기다려요/, '건수 ' + h);
    assert.match(h, /data-claude-inbox-count="6"/);
    assert.ok(h.includes('🏗 새 현장: 하이츠빌아파트 305동 602호 · 가상빌라 &lt;b&gt;101&lt;/b&gt;호 · 가상주택 &amp; 창고 외 2곳'), '이름 3개 + 외 2곳(이스케이프) ' + h);
    assert.ok(!h.includes('<b>101</b>'), '이름 HTML 이 그대로 들어가면 안 됨');
    assert.ok(!h.includes('가상상가'), '넷째 이름부터는 숨김');
    const btns = h.match(/<button[^>]*>/g) || [];
    assert.equal(btns.length, 2, '단추 둘(열기·닫기) ' + JSON.stringify(btns));
    btns.forEach(b => assert.match(b, /min-height:44px/, '44px ' + b));
    assert.ok(btns.some(b => b.includes('data-claude-inbox-open')) && btns.some(b => b.includes('data-claude-inbox-dismiss')), '위임 이름');
    assert.match(h, />요청함 열기</);
    assert.match(h, /aria-label="클로드 요청 알림 닫기"/);
    assert.match(h, /var\(--paper\)/, '어두운 화면 변수(--paper)');
    assert.ok(!/#fff|#ffffff|white/i.test(h), '흰 바탕 고정색 없음');
    const slot = run('return hjClaudeInboxNoticeSlotHtml();');
    assert.ok(slot.startsWith('<div id="dashboardClaudeInbox">') && slot.includes('data-claude-inbox-notice'), '자리 + 줄 ' + slot.slice(0, 60));
    // 현장 만들기 없이 다른 요청만 — 이름 줄 없음
    fileJson = FILE([{ id: 'kb-6', tool: 'add_schedule', args: { date: '2026-11-21', title: '가상 일정' } }]);
    reset(); await auto('boot');
    assert.match(inner(), /요청 1건이/); assert.ok(!inner().includes('data-claude-inbox-names'), '이름 줄 없음');
    // 대기 0 — 빈 자리(hidden)
    fileJson = FILE([]); reset(); await auto('boot');
    assert.equal(inner(), ''); assert.equal(run('return hjClaudeInboxNoticeSlotHtml();'), '<div id="dashboardClaudeInbox" hidden></div>');
    // 요청 파일 자체가 없음 — 빈 자리
    relayMode = 'nofile'; store.clear(); reload();
    assert.equal(await auto('boot'), true); assert.equal(inner(), '');
    // 직원 모드 기기에는 줄을 그리지 않음
    fileJson = FILE([req('kb-1', '가상빌라 101호')]); reset(); await auto('boot'); store.set('hj_role', 'staff');
    assert.equal(inner(), '', '직원 모드엔 줄 없음');
  });

  await test('⑤ [✕] — 그때 id 기억 · 줄기만 하면 숨긴 채 · 새 id 면 다시 · 새로 고침 뒤에도 (DISMISS)', async () => {
    fileJson = FILE([req('kb-1', '가상빌라 101호'), req('kb-2', '가상주택')]);
    reset(); await auto('boot');
    assert.equal(data().show, true);
    run('hjClaudeInboxNoticeDismiss();');
    assert.equal(data().show, false, '닫으면 숨김'); assert.equal(inner(), '');
    assert.deepEqual(JSON.parse(store.get('hj_claude_inbox_dismissed')), ['kb-1', 'kb-2'], '그때 id 를 기기에 기억');
    ctx.__T__ = T0 + 31 * 60 * 1000; await auto('visible');
    assert.equal(data().show, false, '같은 요청이면 다시 받아도 숨긴 채');
    run("state.claudeDone.push('kb-1');");
    assert.equal(data().n, 1); assert.equal(data().show, false, '처리돼 줄기만 하면 숨긴 채');
    reload();
    assert.equal(data().show, false, '새로 고침 뒤에도 숨긴 채(localStorage)');
    fileJson = FILE([req('kb-2', '가상주택'), req('kb-3', '가상상가 1층')]);
    ctx.__T__ = T0 + 62 * 60 * 1000; assert.equal(await auto('visible'), true);
    const d = data();
    assert.equal(d.show, true, '새 id(kb-3) 가 오면 다시 보임 ' + JSON.stringify(d));
    assert.equal(d.n, 2, '다시 보일 땐 대기 전부를 셈');
    assert.match(inner(), /요청 2건이/);
  });

  await test('⑥ 실패는 조용히 — false · console.debug 만 · 토스트·창 없음 · 실패도 30분 (QUIET)', async () => {
    for (const mode of ['throw', 'notok', 'badjson']) {
      fileJson = FILE([req('kb-1', '가상빌라 101호')]);
      reset(); relayMode = mode;
      assert.equal(await auto('boot'), false, mode + ' → false');
      assert.equal(toasts, 0, mode + ' 토스트 없음'); assert.equal(modals, 0, mode + ' 창 없음');
      assert.ok(debugs >= 1, mode + ' console.debug 에만 남김');
      assert.equal(inner(), '', mode + ' 줄 없음');
      const n = relayLog.length;
      ctx.__T__ = T0 + 5 * 60 * 1000;
      assert.equal(await auto('visible'), false); assert.equal(relayLog.length, n, mode + ' 실패 뒤에도 30분은 다시 안 부름');
    }
    // 앞서 받은 요약은 실패해도 지우지 않는다(대표가 볼 줄이 사라지지 않게)
    fileJson = FILE([req('kb-1', '가상빌라 101호')]); reset(); await auto('boot');
    relayMode = 'throw'; ctx.__T__ = T0 + 31 * 60 * 1000;
    assert.equal(await auto('visible'), false); assert.equal(data().n, 1, '실패해도 앞 요약 유지'); assert.equal(toasts, 0);
  });

  await test('⑦ [요청함 열기] — 받은 결과를 다시 걸러 preset 으로 · 없으면 새로 받기 (OPEN)', async () => {
    fileJson = FILE([req('kb-1', '가상빌라 101호'), req('kb-2', '가상주택'), req('kb-3', '가상상가 1층')]);
    reset(); await auto('boot');
    const calls = [], realView = ctx.claudeInboxView;
    ctx.claudeInboxView = (preset) => { calls.push(preset === undefined ? null : JSON.parse(JSON.stringify(preset))); return Promise.resolve({}); };
    run("state.claudeDone.push('kb-2');");
    run('hjClaudeInboxNoticeOpen();');
    assert.equal(calls.length, 1);
    assert.ok(calls[0], '받은 결과를 preset 으로');
    assert.deepEqual(calls[0].requests.map(q => q.id), ['kb-1', 'kb-3'], '처리한 것(kb-2)은 다시 걸러 뺌 ' + JSON.stringify(calls[0].requests));
    assert.equal(calls[0].ok, true); assert.equal(calls[0].via, undefined, '드라이브 결과 — 링크 경고 대상 아님');
    assert.equal(relayLog.length, 2, '열 때 다시 받지 않음');
    reload(); run('hjClaudeInboxNoticeOpen();');
    assert.equal(calls[1], null, '새로 고친 뒤(요약만 있음)엔 claudeInboxView() 가 새로 받음');
    run("state.claudeDone.push('kb-1','kb-3');"); vm.runInContext('__hjCinbox.result=null;', ctx);
    run('hjClaudeInboxNoticeOpen();'); assert.equal(calls[2], null, '결과 없음 → 새로 받기');
    ctx.claudeInboxView = realView;
  });

  // 앱 시작 꼬리 — '부팅 때 연결'은 설정 복원 순간에 찍힌 값(__hjRelayConfigDone.ready)으로만 켠다(그 뒤 붙인 연결로 켜지지 않게)
  const tail = html.split('\n').find(l => l.includes('__hjCinboxArmed=true;')) || '';
  assert.ok(tail.includes('Promise.all([window.__hjRelayConfigDone,window.__hjRelayBootDone])') && tail.includes('if(!(r&&r[0]&&r[0].ready&&relayReady()))return;__hjCinboxArmed=true;'),
    '부팅 꼬리 — 설정 복원 순간의 ready 로만 켠다 ' + tail.slice(0, 160));
  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  assert.deepEqual(relayOdd, [], '중계에는 문서 목록·요청 파일 내려받기만');
  console.log('claudeinbox-notice-v614: ' + passed + '/7');
  if (passed !== 7) process.exit(1);
})().catch(e => { console.error('FAIL claudeinbox-notice-v614', e && e.stack || e); process.exit(1); });

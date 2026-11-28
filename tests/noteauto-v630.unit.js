/* v630 📝 카톡 승인 메모(add_note) 저절로 반영 (단위 검사)
   대표 승인(11/28 '위 내용 진행'): 카톡봇 결재함에서 대표가 카톡·관리 프로그램으로 승인한 메모 요청(add_note — 의뢰 내용·시공 내용 메모)은
   🤖 클로드 요청함에서 ✓ 를 다시 누르지 않아도 다른 저절로 도구(일정·현장·사진·고객 칸·작업일지·내역서 줄)처럼 들어간다. 메모 더하기만(지우거나 고치지 않음).
   ① 카톡·관리 프로그램 승인 메모는 저절로 — 안전판(넣기 전) 한 번 · claudeDone · 토스트 한 번 · 글 앞뒤 빈칸 뺌 · 현장 없는 메모도 (APPLY)
   ② 링크·붙여넣기로 받은 메모는 도장이 있어도 안 넣음 · 도장 없음·Claude·7일 지남·직원·체험도 안 넣음 (GATE)
   ③ 빈 글·빈칸뿐·글자 아닌 글·글 없음·너무 긴 글(앞뒤 빈칸 뺀 4000자 넘음)·글자 아닌 현장은 고르지 않음 — 요청함에 남음 · 4000자는 넣음 (BAD)
   ④ 같은 현장에 같은 글(앞뒤 빈칸 무시) 메모가 이미 있으면 두 번 안 넣고 처리로만 · 다른 현장·현장 없음은 따로 · 같은 묶음에 두 번 와도 한 번 (SAME)
   ⑤ 연결 — 저절로 도구·SAFE_AUTO·AI_WRITE 이고 늘 확인(AI_ALWAYS_CONFIRM)은 아님 · 요청함 이름표 '메모 기록' 그대로 · 요청함 화면에 메모 줄이 보임 (WIRE)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(custfill-v624.unit.js 와 같은 틀) 진짜 hjKakaoAutoTick·hjKakaoAutoApply·aiToolRun·claudeInboxView 를 부른다.
   중계는 가짜 relayCall(합성 요청 파일). 실제 중계·드라이브·고객 없음 — 현장 이름·메모 글은 모두 가짜.
   변이(HJ_V630_MUTATION): not-auto 는 ①·⑤, no-empty-check·no-max-check·max-before-trim·no-type-check·project-any 는 ③,
   no-dup-note·dup-ignores-project·dup-no-trim·dup-counted-new 는 ④ 에서 실패해야 한다. HJ_V630_BASELINE=<commit>(예: a1f9cc3 = v629) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V630_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V630_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('add_note');", ''],
  'no-empty-check': ['      if(!t||t.length>HJ_KAKAO_NOTE_MAX)return false;', '      if(t.length>HJ_KAKAO_NOTE_MAX)return false;'],
  'no-max-check': ['      if(!t||t.length>HJ_KAKAO_NOTE_MAX)return false;', '      if(!t)return false;'],
  'max-before-trim': ['      if(!t||t.length>HJ_KAKAO_NOTE_MAX)return false;', '      if(!t||a.text.length>HJ_KAKAO_NOTE_MAX)return false;'],
  'no-type-check': ["      if(typeof a.text!=='string')return false;\n      const t=a.text.trim();", '      const t=String(a.text==null?\'\':a.text).trim();'],
  'project-any': ["      return a.project==null||typeof a.project==='string';", '      return true;'],
  'no-dup-note': ["        else if(q.tool==='add_note'&&hjKakaoNoteHas(a)){same++;}", '        else if(false){same++;}'],
  'dup-ignores-project': ["n.text.trim()===t&&String(n.project||'').trim()===pj);", 'n.text.trim()===t);'],
  'dup-no-trim': ["n.text.trim()===t&&String(n.project||'').trim()===pj);", "n.text===t&&String(n.project||'').trim()===pj);"],
  'dup-counted-new': ["        else if(q.tool==='add_note'&&hjKakaoNoteHas(a)){same++;}", "        else if(q.tool==='add_note'&&hjKakaoNoteHas(a)){n++;}"]
};
if (process.env.HJ_V630_MUTATION) {
  const m = MUT[process.env.HJ_V630_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V630_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V630_MUTATION); html = html.replace(m[0], () => m[1]);
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
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

// 도장 시각은 카톡봇처럼 지역 시각 'YYYY-MM-DDTHH:MM'(앱도 지역 시각으로 읽는다 — T0 기준으로 만든다)
const T0 = Date.UTC(2026, 10, 28, 3, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000, D = 24 * 60 * MIN;
const PJ = '가상편한세상아파트', PJ2 = '가상타운';
const stamp = (via = 'kakao', ago = 5 * MIN) => ({ via, at: at(T0 - ago), item: 1050 });
const note = (id, args, extra) => Object.assign({ id, tool: 'add_note', args, why: '카톡봇 메모', approved: stamp() }, extra || {});
let relayLog = [], fileJson = { requests: [] };
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-28T03:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
let toasts = [], snaps = [], modals = [];
ctx.toast = (t) => { toasts.push(String(t)); };
ctx.openModal = (title, body) => { modals.push(String(body || '')); };
ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = (label) => { snaps.push({ label: String(label), notes: vm.runInContext('(state.notes||[]).length', ctx) }); return Promise.resolve(true); };
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(notes) {
  relayLog = []; toasts = []; snaps = []; modals = []; store.clear(); ctx.__T__ = T0;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=${JSON.stringify([{ name: PJ, stage: 0, received: 0, phases: [] }, { name: PJ2, stage: 0, received: 0, phases: [] }])};
    state.files=[];state.schedule=[];state.notes=${JSON.stringify(notes || [])};
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const notes = () => run('return (state.notes||[]).map(n=>[n.project,n.text]);');
const done = () => run('return state.claudeDone.slice();');
const pending = () => run('return hjClaudeInboxNoticeData().n;');
const tick = () => runA('return await hjKakaoAutoTick();');
const apply = (reqs, via = 'drive') => runA(`return await hjKakaoAutoApply({ok:true,via:${JSON.stringify(via)},requests:${JSON.stringify(reqs)}});`);
const putToasts = () => toasts.filter(t => /카톡에서 승인한/.test(t));

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS noteauto-v630 ' + name); }

(async () => {
  await test('① 카톡·관리 프로그램 승인 메모는 저절로 — 안전판 · claudeDone · 토스트 · 앞뒤 빈칸 · 현장 없는 메모 (APPLY)', async () => {
    fileJson = { requests: [
      note('kb-20261128-120000-a1050', { text: '  [의뢰 내용] 가상 욕실 누수 확인 요청\n아랫집 천장 얼룩  ', project: PJ }),
      note('kb-20261128-120000-a1051', { text: '[시공 내용] 가상 배관 교체 · 방수 마감', project: PJ }, { approved: stamp('manager', 30 * MIN) }),
      note('kb-20261128-120000-a1052', { text: '가상 자재 주문 메모 — 실리콘 2박스' })   // 현장 없는 메모
    ] };
    reset([{ id: 'n0', date: '2026. 11. 27.', text: '원래 있던 가상 메모', project: PJ }]);
    assert.equal(await tick(), true);
    assert.deepEqual(relayLog, ['listFiles', 'download'], '요청 파일만 읽음');
    assert.deepEqual(notes(), [
      [PJ, '원래 있던 가상 메모'],
      [PJ, '[의뢰 내용] 가상 욕실 누수 확인 요청\n아랫집 천장 얼룩'],
      [PJ, '[시공 내용] 가상 배관 교체 · 방수 마감'],
      ['', '가상 자재 주문 메모 — 실리콘 2박스']
    ], '메모 더하기만 — 원래 메모 그대로 · 글 앞뒤 빈칸 뺌 · 현장 없는 메모는 빈 현장');
    assert.deepEqual(done(), ['kb-20261128-120000-a1050', 'kb-20261128-120000-a1051', 'kb-20261128-120000-a1052'], '처리한 id(기기끼리 공유)');
    assert.deepEqual(snaps.map(s => [s.label, s.notes]), [['📲 카톡 승인 요청 반영 전 — 3건', 1]], '안전판은 넣기 전에 한 번');
    assert.deepEqual(putToasts(), ['📲 카톡에서 승인한 요청 3건을 현장웹에 넣었어요'], '토스트 한 번 ' + JSON.stringify(toasts));
    assert.equal(pending(), 0, '첫 화면 알림 줄에서도 빠짐');
    // 같은 결과로 다시 불러도(처리한 id) 두 번 넣지 않는다
    assert.equal(await apply(fileJson.requests), 0);
    assert.equal(notes().length, 4);
  });

  await test('② 링크·붙여넣기는 도장이 있어도 안 넣음 · 도장 없음·Claude·7일 지남·직원·체험도 안 넣음 (GATE)', async () => {
    const good = note('kb-20261128-120100-a1053', { text: '가상 링크 메모', project: PJ });
    reset();
    const viaLink = await runA(`const d=claudeReqDecode(${JSON.stringify(JSON.stringify({ requests: [good] }))});return {via:d.via,n:d.requests.length,applied:await hjKakaoAutoApply(d)};`);
    assert.deepEqual(viaLink, { via: 'link', n: 1, applied: 0 }, '링크로 받은 메모');
    assert.equal(await apply([good], 'link'), 0);
    assert.deepEqual([notes(), done(), snaps.length], [[], [], 0], '안 넣고 처리로도 안 표시 · 안전판 0');
    reset();
    const gated = [
      note('kb-20261128-120100-a1054', { text: '도장 없음' }, { approved: undefined }),
      note('kb-20261128-120100-a1055', { text: 'Claude 도장' }, { approved: stamp('claude') }),
      note('kb-20261128-120100-a1056', { text: '8일 전 승인' }, { approved: stamp('kakao', 8 * D) }),
      note('cl-20261128-120100-a1057', { text: '카톡봇 id 아님' })
    ];
    assert.equal(await apply(gated), 0);
    assert.deepEqual([notes(), done(), snaps.length], [[], [], 0], '문 그대로');
    reset(); store.set('hj_role', 'staff');
    assert.equal(await apply([good]), 0, '직원 모드');
    store.delete('hj_role'); run('state._demo=true;');
    assert.equal(await apply([good]), 0, '체험 모드');
    run('state._demo=false;');
    assert.deepEqual([notes(), done()], [[], []]);
  });

  await test('③ 빈 글·빈칸뿐·글자 아님·글 없음·너무 긴 글·글자 아닌 현장은 고르지 않음 · 4000자는 넣음 (BAD)', async () => {
    assert.equal(run('return HJ_KAKAO_NOTE_MAX;'), 4000);
    const bad = [
      note('kb-20261128-120200-a1060', { text: '', project: PJ }),
      note('kb-20261128-120200-a1061', { text: ' \n\t　 ', project: PJ }),
      note('kb-20261128-120200-a1062', { text: 12345, project: PJ }),
      note('kb-20261128-120200-a1063', { project: PJ }),
      note('kb-20261128-120200-a1064', { text: '가'.repeat(4001), project: PJ }),
      note('kb-20261128-120200-a1065', { text: '가상 현장이 숫자', project: 7 }),
      note('kb-20261128-120200-a1066', { text: '가상 현장이 묶음', project: { name: PJ } })
    ];
    fileJson = { requests: bad };
    reset();
    assert.equal(await tick(), true);
    assert.deepEqual(notes(), [], '하나도 안 넣음 ' + JSON.stringify(notes()).slice(0, 200));
    assert.deepEqual(done(), [], '처리로도 안 표시');
    assert.equal(snaps.length, 0, '고를 요청이 없으면 안전판도 안 찍음');
    assert.equal(pending(), bad.length, '모두 요청함에 남아 대표가 손으로');
    // 앞뒤 빈칸을 빼고 4000자면 넣는다(빈칸 때문에 4000을 넘는 글도)
    reset();
    const edge = [note('kb-20261128-120200-a1067', { text: '나'.repeat(4000), project: PJ }), note('kb-20261128-120200-a1068', { text: '  ' + '다'.repeat(4000) + '\n\n', project: PJ2 })];
    assert.equal(await apply(edge), 2);
    assert.deepEqual(notes().map(([p, t]) => [p, t.length]), [[PJ, 4000], [PJ2, 4000]]);
    assert.deepEqual(done(), edge.map(q => q.id));
    // 현장 칸이 빈 글자·null 이면 현장 없는 메모로
    reset();
    assert.equal(await apply([note('kb-20261128-120200-a1069', { text: '가상 현장 빈칸', project: '' }), note('kb-20261128-120200-a1070', { text: '가상 현장 null', project: null })]), 2);
    assert.deepEqual(notes(), [['', '가상 현장 빈칸'], ['', '가상 현장 null']]);
  });

  await test('④ 같은 현장에 같은 글이 이미 있으면 두 번 안 넣고 처리로만 · 다른 현장은 따로 · 같은 묶음 두 번도 한 번 (SAME)', async () => {
    const T = '[의뢰 내용] 가상 욕실 누수 확인 요청';
    // 대표가 손으로 먼저 적은 메모(앞뒤 빈칸이 달라도 같은 글) — 넣지 않고 처리로만
    reset([{ id: 'h1', date: '2026. 11. 28.', text: ' ' + T + ' \n', project: PJ + ' ' }, { id: 'h2', date: '2026. 11. 28.', text: '가상 현장 없는 메모', project: null }]);
    assert.equal(await apply([note('kb-20261128-120300-a1080', { text: T + '  ', project: PJ }), note('kb-20261128-120300-a1081', { text: '가상 현장 없는 메모' })]), 0, '넣은 것 0');
    assert.equal(notes().length, 2, '두 번 안 넣음 ' + JSON.stringify(notes()));
    assert.deepEqual(done(), ['kb-20261128-120300-a1080', 'kb-20261128-120300-a1081'], '처리로는 표시(다시 넣지 않게)');
    assert.deepEqual(putToasts(), [], "'넣었어요' 토스트 없음");
    assert.equal(pending(), 0);
    // 같은 글이라도 다른 현장·현장 없는 메모는 따로 넣는다
    reset([{ id: 'h1', date: '2026. 11. 28.', text: T, project: PJ }]);
    assert.equal(await apply([note('kb-20261128-120300-a1082', { text: T, project: PJ2 }), note('kb-20261128-120300-a1083', { text: T })]), 2);
    assert.deepEqual(notes(), [[PJ, T], [PJ2, T], ['', T]]);
    // 같은 묶음에 같은 메모가 두 번(다른 id) — 한 번만 넣고 둘 다 처리로
    reset();
    assert.equal(await apply([note('kb-20261128-120300-a1084', { text: T, project: PJ }), note('kb-20261128-120300-a1085', { text: T + '\n', project: PJ })]), 1);
    assert.deepEqual(notes(), [[PJ, T]]);
    assert.deepEqual(done(), ['kb-20261128-120300-a1084', 'kb-20261128-120300-a1085']);
    assert.deepEqual(putToasts(), ['📲 카톡에서 승인한 요청 1건을 현장웹에 넣었어요 · 이미 있던 1건은 건너뜀']);
  });

  await test("⑤ 연결 — 저절로 도구·SAFE_AUTO·AI_WRITE · 늘 확인은 아님 · 이름표 '메모 기록' · 요청함 화면 (WIRE)", async () => {
    assert.deepEqual(run("return [HJ_KAKAO_AUTO_TOOLS.has('add_note'),SAFE_AUTO.has('add_note'),AI_WRITE.has('add_note'),AI_ALWAYS_CONFIRM.has('add_note'),CLAUDE_REQ_DENY.has('add_note')];"),
      [true, true, true, false, false]);
    assert.equal(run("return aiActionLabel('add_note',{text:'가상 메모',project:'가상편한세상아파트'});"), '메모 기록');
    assert.deepEqual(run("return aiActionWarnings('add_note',{text:'가상 메모'});"), []);
    assert.equal(run("return aiResultBrief('add_note',{기록:'가상 메모'});"), ' — 기록됨');
    // 저절로 못 넣은 메모(링크로 받음)는 요청함 화면에 '메모 기록' 줄과 ✓ 단추로 보인다
    reset();
    const viewed = await runA(`return await claudeInboxView({ok:true,via:'link',requests:${JSON.stringify([note('kb-20261128-120400-a1090', { text: '가상 요청함 메모', project: PJ })])},bad:[],total:1});`);
    assert.deepEqual(viewed, { 요청: 1 });
    const body = modals[modals.length - 1] || '';
    assert.match(body, /메모 기록/); assert.match(body, /✓ 승인·적용/); assert.match(body, /장부를 바꾸는 작업입니다/);
    assert.deepEqual(notes(), [], '보기만으로는 안 넣음');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('noteauto-v630: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL noteauto-v630', e && e.stack || e); process.exit(1); });

/* v624 👤 고객 칸 채우기 요청(fill_customer) (단위 검사)
   대표 결정(11/24 'C ⑨ 고객 칸 0/84 — 채우고 싶어요'): Claude 가 모은 고객 이름·연락처·주소를 카톡봇 결재로 올리고, 대표가 카톡에서 승인하면 저절로 들어간다.
   ① 빈 칸만 채운다 — 적힌 값은 그대로(같으면 이미같음 · 다르면 다름) · 없는 현장·같은 이름 여럿은 못찾음 · 연락처 꼴 · 글자 거르기 · 100곳까지 (FILL)
   ② 답에는 이름·번호가 없다(AI 비서 답은 바깥 LLM 으로 간다) · 요청함이 아는 도구 · 장부를 바꾸는 작업 · 이름표 (ANSWER)
   ③ 카톡·관리 프로그램 승인이면 저절로 — 링크·붙여넣기는 아님 · 채울 빈 칸이 없으면 '건너뜀'으로 (AUTO)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(photoassign-v620.unit.js 와 같은 틀) 진짜 aiToolRun·hjKakaoAutoTick·hjKakaoAutoApply 를 부른다.
   중계는 가짜 relayCall(합성 요청 파일). 실제 중계·드라이브·고객 없음 — 이름·번호·주소는 모두 가짜.
   변이(HJ_V624_MUTATION): overwrite·dup-names·no-phone-check·no-clean·no-cap·digits-compare 는 ①, pii-in-answer·not-write 는 ②,
   not-auto·same-counted-new 는 ③ 에서 실패해야 한다. HJ_V624_BASELINE=<commit>(예: ba167ed) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V624_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V624_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'overwrite': ["          if(cur){if(k==='phone'?hjCustDigits(cur)===hjCustDigits(v):cur.replace(/\\s+/g,'')===v.replace(/\\s+/g,''))same++;else differ++;continue;}   // 적힌 값은 그대로\n", ''],
  'dup-names': ["        if(!pj||ps.length!==1){missing++;continue;}   // 없는 현장·같은 이름이 여럿 — 어느 현장인지 모른다\n", "        if(!pj||!ps.length){missing++;continue;}\n"],
  'no-phone-check': ["  if(out.phone){const d=hjCustDigits(out.phone);if(d.length<9||d.length>12||d[0]!=='0'){out.phone='';out.bad++;}}\n", ''],
  'no-clean': ["  const clean=(v,max)=>String(v==null?'':v).replace(/[\\u0000-\\u001f\\u007f<>]/g,' ').replace(/\\s+/g,' ').trim().slice(0,max);\n",
    "  const clean=(v,max)=>String(v==null?'':v).trim();\n"],
  'no-cap': ["      const list=(Array.isArray(a.items)?a.items:[]).slice(0,HJ_CUST_FILL_MAX);\n", "      const list=(Array.isArray(a.items)?a.items:[]);\n"],
  'digits-compare': ["if(cur){if(k==='phone'?hjCustDigits(cur)===hjCustDigits(v):", "if(cur){if(k==='phone'?cur===v:"],
  'pii-in-answer': ["      return {결과:'고객 칸 채우기',현장:sites,칸:put,", "      return {결과:'고객 칸 채우기',값:list,현장:sites,칸:put,"],
  'not-write': ["AI_WRITE.add('fill_customer');", ''],
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('fill_customer');", ''],
  'same-counted-new': ["||(q.tool==='fill_customer'&&out&&!out.칸))same++;else n++;", ")same++;else n++;"]
};
if (process.env.HJ_V624_MUTATION) {
  const m = MUT[process.env.HJ_V624_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V624_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V624_MUTATION); html = html.replace(m[0], () => m[1]);
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

const T0 = Date.UTC(2026, 10, 24, 13, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000;
const A = '가상마을아파트', B = '가상로9번길 1', C = '가상빌라', DUP = '같은이름현장', FULL = '다 적힌 현장';
const blank = () => ({ name: '', phone: '', addr: '' });
const PROJECTS = () => [
  { name: A, stage: 0, received: 0, phases: [], customer: blank() },
  { name: B, stage: 0, received: 0, phases: [] },                                              // customer 칸이 아예 없는 옛 현장
  { name: C, stage: 0, received: 0, phases: [], customer: { name: '', phone: '010-0000-0003', addr: '' } },
  { name: DUP, stage: 0, received: 0, phases: [], customer: blank() },
  { name: DUP, stage: 0, received: 0, phases: [], customer: blank() },
  { name: FULL, stage: 0, received: 0, phases: [], customer: { name: '가상주인', phone: '010-0000-0005', addr: '가상시 가상구 가상로 5' } }
];
let relayLog = [], fileJson = { requests: [] };
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-24T13:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
let toasts = [];
ctx.toast = (t) => { toasts.push(String(t)); }; ctx.openModal = () => {}; ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = () => Promise.resolve(true);
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(projects) {
  relayLog = []; toasts = []; store.clear(); ctx.__T__ = T0;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=${JSON.stringify(projects || PROJECTS())};state.files=[];state.schedule=[];
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const cust = () => run('return state.projects.map(p=>p.name+"|"+(p.customer?[p.customer.name,p.customer.phone,p.customer.addr].join("/"):"(없음)"));');
const fill = items => runA(`return await aiToolRun('fill_customer',{items:${JSON.stringify(items)}});`);
const req = (id, items, extra) => Object.assign({ id, tool: 'fill_customer', args: { items }, why: '고객 칸 채우기', approved: { via: 'kakao', at: at(T0 - 5 * MIN), item: 1022 } }, extra || {});

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS custfill-v624 ' + name); }

(async () => {
  await test('① 빈 칸만 — 적힌 값은 그대로 · 없는 현장·같은 이름 여럿 · 연락처 꼴 · 글자 거르기 · 100곳 (FILL)', async () => {
    reset();
    const out = await fill([
      { project: A, name: '가상고객', phone: '010-0000-0001', addr: '가상시 가상구 가상동 가상마을아파트' },
      { project: B, addr: '가상시 가상구 가상로9번길 1' },                                   // customer 칸이 없던 현장
      { project: C, name: '가상셋', phone: '01000000003' },                                    // 같은 번호(하이픈 없이) — 이미같음
      { project: DUP, name: '누구' },                                                          // 같은 이름 현장 둘 — 못찾음
      { project: '없는 현장', name: '누구' },
      { project: FULL, name: '다른사람', phone: '010-0000-0099', addr: '가상시 가상구 가상로  5' }, // 이름·번호 다름 · 주소는 띄어쓰기만 다름
      { project: '  ' + A + '  ', name: '두번째' }                                             // 이미 채운 칸 — 그대로
    ]);
    assert.deepEqual([out.현장, out.칸, out.이미같음, out.다름, out.못찾음, out.잘못된값], [3, 5, 2, 3, 2, 0], JSON.stringify(out));
    assert.deepEqual(cust(), [
      A + '|가상고객/010-0000-0001/가상시 가상구 가상동 가상마을아파트',
      B + '|//가상시 가상구 가상로9번길 1',
      C + '|가상셋/010-0000-0003/',
      DUP + '|//', DUP + '|//',
      FULL + '|가상주인/010-0000-0005/가상시 가상구 가상로 5'
    ], '빈 칸만 채우고 적힌 값·같은 이름 여럿은 그대로');
    // 연락처 꼴 — 0 으로 시작하는 9~12자리만 · 못 쓰는 번호는 넣지 않고 셈만(다른 칸은 넣는다)
    reset();
    const o2 = await fill([{ project: A, name: '가상', phone: '1234' }, { project: B, phone: '010-0000-0002-99999' }, { project: C, name: '가상셋', phone: '1588-0000' }]);
    assert.deepEqual([o2.칸, o2.잘못된값], [2, 3], JSON.stringify(o2));
    assert.deepEqual(cust().slice(0, 3), [A + '|가상//', B + '|(없음)', C + '|가상셋/010-0000-0003/']);
    // 글자 거르기 — 줄바꿈·꺾쇠는 빈칸 · 길이 자름
    reset();
    await fill([{ project: A, name: '가상\n<b>고객</b>', addr: '가'.repeat(200) }]);
    const c = run('return state.projects[0].customer;');
    assert.equal(c.name, '가상 b 고객 /b', '줄바꿈·꺾쇠를 빈칸으로');
    assert.equal(c.addr.length, 120, '주소 120자');
    // 100곳까지
    const many = Array.from({ length: 101 }, (_, i) => ({ name: '가상현장' + i, stage: 0, received: 0, phases: [], customer: blank() }));
    reset(many);
    const o3 = await fill(many.map(p => ({ project: p.name, name: '가상' })));
    assert.equal(o3.현장, 100, '한 번에 100곳');
    assert.equal(run('return state.projects[100].customer.name;'), '');
    await assert.rejects(fill([]), /채울 현장이 없/);
    await assert.rejects(runA("return await aiToolRun('fill_customer',{});"), /채울 현장이 없/);
  });

  await test('② 답에는 이름·번호 없음 · 요청함이 아는 도구 · 장부를 바꾸는 작업 · 이름표 (ANSWER)', async () => {
    reset();
    const out = await fill([{ project: A, name: '가상고객', phone: '010-0000-0001', addr: '가상시 가상구 가상동' }]);
    const text = JSON.stringify(out);
    for (const v of ['가상고객', '0000-0001', '가상동']) assert.ok(!text.includes(v), '답에 ' + v + ' 없음: ' + text);
    assert.equal(run("return aiResultBrief('fill_customer'," + text + ");"), ' — 1곳 3칸');
    assert.equal(run("return claudeReqBad({id:'kb-20261124-230000-a1022',tool:'fill_customer',args:{items:[]}});"), '', '요청함이 아는 도구');
    assert.equal(run("return AI_WRITE.has('fill_customer');"), true, '장부를 바꾸는 작업으로 표시(요청함 경고·안전판)');
    assert.equal(run("return aiActionLabel('fill_customer',{items:[{project:'가'},{project:'나'},{project:'다'}]});"), '고객 칸 채우기 → "가" 외 2곳');
    assert.equal(run("return aiActionLabel('fill_customer',{items:[{project:'가'}]});"), '고객 칸 채우기 → "가"');
    assert.equal(run("return AI_TOOLS.filter(t=>t.name==='fill_customer').length;"), 1);
  });

  await test('③ 카톡 승인이면 저절로 · 링크는 아님 · 빈 칸이 없으면 건너뜀 (AUTO)', async () => {
    assert.equal(run("return HJ_KAKAO_AUTO_TOOLS.has('fill_customer');"), true);
    fileJson = { requests: [req('kb-20261124-230000-a1022', [{ project: A, name: '가상고객', phone: '010-0000-0001' }])] };
    reset();
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261124-230000-a1022']);
    assert.equal(cust()[0], A + '|가상고객/010-0000-0001/');
    assert.ok(toasts.some(t => /1건을 현장웹에 넣었어요/.test(t)), toasts.join(' / '));
    // 링크·붙여넣기(via link)로 받은 것은 저절로 넣지 않는다(v617 문 그대로)
    reset();
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'link',requests:${JSON.stringify([req('kb-20261124-230001-a1023', [{ project: A, name: '가상' }])])}});`), 0);
    assert.equal(cust()[0], A + '|//');
    // 채울 빈 칸이 없었다(다 적힌 현장) — 처리로 표시하되 '넣었어요' 셈에는 넣지 않는다
    reset();
    const n = await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify([req('kb-20261124-230002-a1024', [{ project: FULL, name: '다른사람' }])])}});`);
    assert.equal(n, 0);
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261124-230002-a1024'], '처리로는 표시(다시 넣지 않게)');
    assert.equal(cust()[5], FULL + '|가상주인/010-0000-0005/가상시 가상구 가상로 5');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('custfill-v624: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

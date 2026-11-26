/* v624 👤 고객 칸 채우기 요청(fill_customer) (단위 검사)
   대표 결정(11/24 'C ⑨ 고객 칸 0/84 — 채우고 싶어요'): Claude 가 모은 고객 이름·연락처·주소를 카톡봇 결재로 올리고, 대표가 카톡에서 승인하면 저절로 들어간다.
   ① 빈 칸만 채운다 — 적힌 값은 그대로(같으면 이미같음 · 다르면 다름) · 없는 현장·같은 이름 여럿·꼴 깨진 고객 칸은 못찾음 · 연락처는 자르기 전에 ·
      글만 · 글자 거르기 · 주소 동·호수 뺌 · 100곳 넘으면 throw · 하나도 못 넣으면 throw · 누수 현장 세대 보호 (FILL)
   ② 답에는 이름·번호가 없다(AI 비서 답은 바깥 LLM 으로 간다) · 요청함이 아는 도구 · 장부를 바꾸는 작업 · 이름표 · 승인 화면 미리보기(번호 뒷 4자리) ·
      AI 비서는 ⚡자동이어도 늘 확인 (ANSWER)
   ③ 카톡·관리 프로그램 승인이면 저절로 — 링크·붙여넣기는 아님 · 채울 빈 칸이 없으면 '건너뜀' · 하나도 못 넣으면 요청함에 남김 · 일부만이면 토스트 (AUTO)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(photoassign-v620.unit.js 와 같은 틀) 진짜 aiToolRun·hjKakaoAutoTick·hjKakaoAutoApply 를 부른다.
   중계는 가짜 relayCall(합성 요청 파일). 실제 중계·드라이브·고객 없음 — 이름·번호·주소는 모두 가짜.
   변이(HJ_V624_MUTATION): overwrite·dup-names·no-phone-check·phone-cut-first·non-string-ok·no-clean·no-cap·digits-compare·customer-shape·
   no-unit-strip·no-leak-guard·sites-per-row·stored-long-differs·no-throw-empty 는 ①, pii-in-answer·not-write·label-first-empty·preview-full-phone·auto-confirm-off 는 ②,
   not-auto·same-counted-new·no-miss-toast 는 ③ 에서 실패해야 한다(v625 부터 넣을 값이 없는 요청은 hjKakaoAutoCanWrite 가 고르지 않아 ③ 의 '요청함에 남김'은 no-throw-empty 와 상관없이 지켜진다). HJ_V624_BASELINE=<commit>(예: ba167ed) 은 ①에서. */
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
  'overwrite': ["          if(cur){if(k==='phone'?hjCustDigits(cur)===hjCustDigits(v):hjCustFillClean(cur,HJ_CUST_FILL_LIM[k]).replace(/\\s+/g,'')===v.replace(/\\s+/g,''))same++;else differ++;continue;}   // 적힌 값은 그대로\n", ''],
  'dup-names': ["        if(ps.length!==1){missing++;continue;}   // 없는 현장·같은 이름이 여럿 — 어느 현장인지 모른다\n", "        if(!ps.length){missing++;continue;}\n"],
  'no-phone-check': ["    if(k==='phone'&&s){const d=hjCustDigits(s);if(s.length>HJ_CUST_FILL_LIM.phone||d.length<9||d.length>12||d[0]!=='0'){out.bad++;continue;}}", "    if(false){"],
  'phone-cut-first': ["    let s=hjCustFillClean(v,1000);\n", "    let s=hjCustFillClean(v,HJ_CUST_FILL_LIM[k]);\n"],
  'non-string-ok': ["    if(typeof v!=='string'){out.bad++;continue;}", "    if(typeof v!=='string'){continue;}"],
  'no-clean': ["function hjCustFillClean(v,max){return typeof v==='string'?v.replace(/[\\u0000-\\u001f\\u007f<>]/g,' ').replace(/\\s+/g,' ').trim().slice(0,max):'';}",
    "function hjCustFillClean(v,max){return typeof v==='string'?v.trim():'';}"],
  'no-cap': ["      if(all.length>HJ_CUST_FILL_MAX)throw new Error(", "      if(false)throw new Error("],
  'digits-compare': ["if(cur){if(k==='phone'?hjCustDigits(cur)===hjCustDigits(v):", "if(cur){if(k==='phone'?cur===v:"],
  'customer-shape': ["        if(p.customer!=null&&(typeof p.customer!=='object'||Array.isArray(p.customer))){missing++;continue;}", "        if(false){missing++;continue;}"],
  'no-unit-strip': ["if(t!==s){out.unitCut++;s=t;}}", "}}"],
  'no-leak-guard': ["if(!after.valid||after.unitKey!==before.unitKey){p.customer[k]='';kept++;continue;}}", "}"],
  'sites-per-row': ["          filled.add(p);put++;\n", "          filled.add({});put++;\n"],
  'stored-long-differs': [":hjCustFillClean(cur,HJ_CUST_FILL_LIM[k]).replace(/\\s+/g,'')===v.replace(", ":cur.replace(/\\s+/g,'')===v.replace("],
  'pii-in-answer': ["      return {결과:'고객 칸 채우기',현장:filled.size,", "      return {결과:'고객 칸 채우기',값:all,현장:filled.size,"],
  'not-write': ["AI_WRITE.add('fill_customer');", ''],
  'label-first-empty': [".filter(x=>x&&typeof x==='object'&&typeof x.project==='string'&&x.project.trim());return '고객 칸 채우기 → '", ";return '고객 칸 채우기 → '"],
  'preview-full-phone': ["parts.push('연락처 '+hjBriefMaskPhone(w.phone));", "parts.push('연락처 '+w.phone);"],
  'auto-confirm-off': ["AI_ALWAYS_CONFIRM.add('fill_customer');", ''],
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('fill_customer');", ''],
  'same-counted-new': ["||(q.tool==='fill_customer'&&out&&!out.칸)||(q.tool==='stmt_line_edit'&&out&&!out.고침))same++;else n++;", "||(q.tool==='stmt_line_edit'&&out&&!out.고침))same++;else n++;"],   // v629 같은 줄에 내역서 줄 고치기가 붙음
  'no-throw-empty': ["      if(!put&&(missing||bad))throw new Error(", "      if(false)throw new Error("],
  'no-miss-toast': ["+(custMiss?' · 고객 칸 못 넣은 줄 '+custMiss+'개(현장 이름·번호 확인)':'')", ""]
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
  await test('① 빈 칸만 — 적힌 값 그대로 · 못찾음 · 연락처 · 글만 · 거르기 · 동호수 · 100곳 · 못 넣으면 throw · 누수 세대 (FILL)', async () => {
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
    // 같은 현장 두 줄(다른 칸) — 현장은 한 번만 센다
    reset();
    const o1 = await fill([{ project: A, name: '가상' }, { project: A, addr: '가상시 가상구' }]);
    assert.deepEqual([o1.현장, o1.칸], [1, 2]);
    // 연락처 꼴 — 0 으로 시작하는 9~12자리 · 20자 넘으면 자르지 않고 잘못된값(잘린 조각이 다른 번호가 되지 않게)
    reset();
    const o2 = await fill([{ project: A, name: '가상', phone: '1234' }, { project: B, phone: '010-0000-0002-99999', name: '가상둘' },
      { project: C, name: '가상셋', phone: '1588-0000' }, { project: FULL, phone: '042-000-0007 (사무실) 010-0000-0009' }]);
    assert.deepEqual([o2.칸, o2.잘못된값], [3, 4], JSON.stringify(o2));
    assert.deepEqual(cust().slice(0, 3), [A + '|가상//', B + '|가상둘//', C + '|가상셋/010-0000-0003/']);
    reset();
    const o2b = await fill([{ project: A, name: '가상', phone: '010-0000-0009 (가상 사무실 번호)' }]);
    assert.deepEqual([o2b.칸, o2b.잘못된값], [1, 1], '숫자는 맞아도 20자 넘는 연락처는 넣지 않는다');
    assert.equal(cust()[0], A + '|가상//');
    // 글만 — 숫자·목록·객체는 넣지 않고 잘못된값
    reset();
    const o2c = await fill([{ project: A, name: { a: 1 }, phone: 1000000001, addr: ['가상시', '가상구'] }, { project: B, name: '가상' }]);
    assert.deepEqual([o2c.칸, o2c.잘못된값], [1, 3], JSON.stringify(o2c));
    assert.equal(cust()[0], A + '|//');
    // 글자 거르기 — 줄바꿈·꺾쇠는 빈칸 · 길이 자름 · 주소의 동·호수 뺌
    reset();
    const o4 = await fill([{ project: A, name: '가상\n<b>고객</b>', addr: '가'.repeat(200) }, { project: B, addr: '가상시 가상구 가상아파트 101동 1203호' },
      { project: C, addr: '가상시 가상구 가상로 2호선역 앞' }]);
    const c = run('return state.projects[0].customer;');
    assert.equal(c.name, '가상 b 고객 /b', '줄바꿈·꺾쇠를 빈칸으로');
    assert.equal(c.addr.length, 120, '주소 120자');
    assert.equal(cust()[1], B + '|//가상시 가상구 가상아파트', '동·호수는 주소에서 뺀다');
    assert.equal(cust()[2], C + '|/010-0000-0003/가상시 가상구 가상로 2호선역 앞', "'2호선'은 그대로");
    assert.equal(o4.동호수뺌, 1);
    // 적힌 값이 120자를 넘어도 같은 값이면 '이미같음'
    const long = '가상'.repeat(80);
    reset([{ name: A, stage: 0, received: 0, phases: [], customer: { name: '', phone: '', addr: long } }, { name: B, stage: 0, received: 0, phases: [] }]);
    const o5 = await fill([{ project: A, addr: long }, { project: B, name: '가상' }]);
    assert.deepEqual([o5.이미같음, o5.다름], [1, 0]);
    // 고객 칸 꼴이 깨진 현장(배열·글)은 손으로 — 덮지 않는다
    reset([{ name: A, stage: 0, received: 0, phases: [], customer: [] }, { name: B, stage: 0, received: 0, phases: [], customer: '가상 메모' }, { name: C, stage: 0, received: 0, phases: [] }]);
    const o6 = await fill([{ project: A, name: '가상' }, { project: B, name: '가상' }, { project: C, name: '가상' }]);
    assert.deepEqual([o6.칸, o6.못찾음], [1, 2]);
    assert.deepEqual(run('return [state.projects[0].customer,state.projects[1].customer];'), [[], '가상 메모']);
    // 100곳까지 — 넘으면 자르지 않고 throw(나머지가 말없이 빠지지 않게)
    const many = n => Array.from({ length: n }, (_, i) => ({ name: '가상현장' + i, stage: 0, received: 0, phases: [], customer: blank() }));
    reset(many(100));
    assert.equal((await fill(many(100).map(p => ({ project: p.name, name: '가상' })))).현장, 100, '한 번에 100곳');
    reset(many(101));
    await assert.rejects(fill(many(101).map(p => ({ project: p.name, name: '가상' }))), /100곳까지/);
    assert.equal(run('return state.projects.filter(p=>p.customer.name).length;'), 0, '101곳이면 아무것도 넣지 않는다');
    await assert.rejects(fill([]), /채울 현장이 없/);
    await assert.rejects(runA("return await aiToolRun('fill_customer',{});"), /채울 현장이 없/);
    // 하나도 못 넣었는데 못 찾은 현장·못 쓰는 값이 있으면 throw(요청함에 남는다) · 다 적혀 있기만 하면 throw 아님
    reset();
    await assert.rejects(fill([{ project: '가상마을 아파트', name: '가상' }, { project: DUP, name: '가상' }]), /하나도 넣지 못했습니다 — 못 찾은 현장 2곳/);
    await assert.rejects(fill([{ project: A, phone: '+82 10-0000-0001' }]), /못 쓰는 값 1개/);
    assert.equal((await fill([{ project: FULL, name: '다른사람' }])).칸, 0, '적힌 값이 다르기만 하면 throw 아님');
    // 누수 현장 — 이름에서 읽던 세대가 주소 때문에 사라지면 주소는 넣지 않는다
    const LEAK = '가상누수아파트 101동 1203호';
    reset([{ name: LEAK, kind: 'leak', stage: 0, received: 0, phases: [], customer: blank() }, { name: '가상누수빌라', kind: 'leak', stage: 0, received: 0, phases: [], customer: blank() }]);
    const before = run(`return hjLeakPlace(state.projects[0]);`);
    assert.deepEqual([before.valid, before.source], [true, 'legacy-name'], '시험 전제 — 이름으로 세대를 읽는다');
    const o7 = await fill([{ project: LEAK, name: '가상', addr: '가상시 가상구 가상동' }, { project: '가상누수빌라', addr: '가상시 가상구 가상로 7' }]);
    assert.deepEqual([o7.칸, o7.세대보호], [2, 1], JSON.stringify(o7));
    assert.deepEqual(cust(), [LEAK + '|가상//', '가상누수빌라|//가상시 가상구 가상로 7']);
    assert.equal(run(`return hjLeakPlace(state.projects[0]).unitKey;`), before.unitKey, '세대 그대로');
  });

  await test('② 답에는 이름·번호 없음 · 아는 도구 · 장부 작업 · 이름표 · 미리보기 · 늘 확인 (ANSWER)', async () => {
    reset();
    const out = await fill([{ project: A, name: '가상고객', phone: '010-0000-0001', addr: '가상시 가상구 가상동' }]);
    const text = JSON.stringify(out);
    for (const v of ['가상고객', '0000-0001', '가상동']) assert.ok(!text.includes(v), '답에 ' + v + ' 없음: ' + text);
    assert.equal(run("return aiResultBrief('fill_customer'," + text + ");"), ' — 1곳 3칸');
    assert.equal(run("return aiResultBrief('fill_customer',{현장:1,칸:1,못찾음:2,잘못된값:1});"), ' — 1곳 1칸 · 못 찾은 현장 2 · 못 쓰는 값 1');
    assert.equal(run("return claudeReqBad({id:'kb-20261124-230000-a1022',tool:'fill_customer',args:{items:[]}});"), '', '요청함이 아는 도구');
    assert.equal(run("return AI_WRITE.has('fill_customer');"), true, '장부를 바꾸는 작업으로 표시(요청함 경고·안전판)');
    assert.equal(run("return aiActionLabel('fill_customer',{items:[{project:'가'},{project:'나'},{project:'다'}]});"), '고객 칸 채우기 → "가" 외 2곳');
    assert.equal(run("return aiActionLabel('fill_customer',{items:[{project:'가'}]});"), '고객 칸 채우기 → "가"');
    assert.equal(run("return aiActionLabel('fill_customer',{items:[{name:'가상'},{project:' 나 '}]});"), '고객 칸 채우기 → "나"', '현장 없는 줄은 이름표에서 뺀다');
    assert.equal(run("return AI_TOOLS.filter(t=>t.name==='fill_customer').length;"), 1);
    // 승인 화면 미리보기 — 이 기기 화면에만 · 번호는 뒷 4자리 · 이미 적힌 칸은 뺌
    reset();
    const pv = run(`return aiActionWarnings('fill_customer',{items:[{project:${JSON.stringify(A)},name:'가상고객',phone:'010-0000-0001',addr:'가상시 가상구 가상동'},` +
      `{project:'없는 현장',name:'누구'},{project:${JSON.stringify(FULL)},name:'다른사람'},{project:${JSON.stringify(C)},phone:'1234'}]});`);
    assert.equal(pv.length, 5, JSON.stringify(pv));
    assert.match(pv[1], /가상고객 \/ 연락처 ···0001 \/ 주소 가상시 가상구 가상동/);
    assert.ok(!pv.join('\n').includes('0000-0001'), '번호 원문은 보이지 않는다');
    assert.match(pv[2], /현장을 못 찾음/);
    assert.match(pv[3], /채울 빈 칸 없음/);
    assert.match(pv[4], /못 쓰는 값 1개/);
    assert.match(run(`return aiActionWarningHTML('fill_customer',{items:[{project:${JSON.stringify(A)},name:'<i>x</i>'}]});`), /data-ai-action-warning/);
    const many = Array.from({ length: 12 }, (_, i) => ({ project: '가상' + i }));
    assert.equal(run(`return aiActionWarnings('fill_customer',{items:${JSON.stringify(many)}}).slice(-1)[0];`), '외 4곳');
    // AI 비서는 ⚡자동 실행이어도 늘 확인
    run('window.__aiAuto=true;');
    assert.equal(run("return aiWriteNeedsConfirm('fill_customer');"), true);
    run('window.__aiAuto=false;');
  });

  await test('③ 카톡 승인이면 저절로 · 링크는 아님 · 빈 칸 없으면 건너뜀 · 못 넣으면 요청함 · 일부만이면 토스트 (AUTO)', async () => {
    assert.equal(run("return HJ_KAKAO_AUTO_TOOLS.has('fill_customer');"), true);
    fileJson = { requests: [req('kb-20261124-230000-a1022', [{ project: A, name: '가상고객', phone: '010-0000-0001' }])] };
    reset();
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261124-230000-a1022']);
    assert.equal(cust()[0], A + '|가상고객/010-0000-0001/');
    assert.ok(toasts.some(t => /1건을 현장웹에 넣었어요$/.test(t)), toasts.join(' / '));
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
    // 하나도 못 넣었다(현장 이름이 틀림·번호가 틀림) — 처리로 표시하지 않고 요청함에 남긴다(봇이 '반영됐어요'라고 하지 않게)
    reset();
    const bad = [req('kb-20261124-230003-a1025', [{ project: '가상마을 아파트', name: '가상' }]), req('kb-20261124-230004-a1026', [{ project: A, phone: '+82 10-0000-0001' }])];
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify(bad)}});`), 0);
    assert.deepEqual(run('return state.claudeDone.slice();'), [], '요청함에 남는다');
    assert.equal(cust()[0], A + '|//');
    // 일부만 못 넣었다 — 넣은 것은 넣고, 토스트로 못 넣은 줄을 알린다
    reset();
    const part = [req('kb-20261124-230005-a1027', [{ project: A, name: '가상' }, { project: '없는 현장', name: '누구' }])];
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify(part)}});`), 1);
    assert.ok(toasts.some(t => /고객 칸 못 넣은 줄 1개/.test(t)), toasts.join(' / '));
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('custfill-v624: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

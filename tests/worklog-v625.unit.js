/* v625 📋 작업일지 적기 요청(report_worklog) · ⏸ 안 쓰는 메뉴 더 접기(⑮) · 🧹 첫 화면 단계 정리 한 줄(④) (단위 검사)
   대표 결정(11/25): 카톡봇이 모은 끝난 작업 보고를 카톡 승인으로 지난 일정의 📋 작업 보고에 적는다 · 0건인 지출·운행일지·작업시간·연락처 메뉴를 보류로 ·
   한 번도 반영 안 한 v613 단계 정리 제안을 첫 화면 한 줄로.
   ① 적기 — 정확히 같은 이름 현장 하나 · 그 날짜를 덮는 일정(여러 날 공정 포함, 💰·세금 일정 빼고) · 빈 보고면 v623 꼴 '완료'(filledAt = 그날 0시 — 누수 확인 문자 그대로) ·
      모두 보고가 있으면 첫 일정에 덧붙임(progress·filledAt 그대로) · 같은 글은 '이미'(두 번 해도 한 번) · 그날 일정이 없으면 새 일정 없이 '일정없음' ·
      글만·한 줄·꺾쇠 빈칸·200자 · 전화번호 꼴은 자르기 전에 잘못된값 · 앞날·가짜 날짜·이상한 사진 수 잘못된값 · 50줄 넘으면 throw · 한 줄도 못 적으면 throw (WRITE)
   ② 답에는 셈만(글·현장 이름·번호 없음) · 요청함이 아는 도구 · 장부를 바꾸는 작업 · 이름표 · 승인 화면 미리보기(못 쓰는 줄은 글을 안 보임) · AI 비서는 ⚡자동이어도 늘 확인 (ANSWER)
   ③ 카톡·관리 프로그램 승인이면 저절로 — 링크·붙여넣기는 아님 · '이미'뿐이면 '건너뜀' · 한 줄도 못 적으면 요청함에 남김 · 일부만이면 토스트 (AUTO)
   ④ 보류 — 지출 셋(간편 장부·경비 분류·영수증 스캔)·🚗 운행일지·⏱ 작업시간·연락처·🏷 명함 스캔은 0건이면 보류, 기록이 생기면 보임 · 직원 모드는 작업시간 그대로 ·
      회계 탭 🚗·현장 화면 ⏱/🚗 · 더보기 바로가기·PC 위 연락처 탭 · 보류 묶음에서 연다 · 사용설명서 한 줄 (HOLD)
   ⑤ 첫 화면 — 체크해 둘 단계 정리 제안(v613 규칙 그대로)이 있으면 '🧹 단계 정리 — 완료로 볼 현장 N곳 [보기]' · 직원·체험 없음 · 그릴 때마다 세지 않음 · 자리만 고침 (DASH)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(custfill-v624.unit.js 와 같은 틀) 진짜 aiToolRun·hjKakaoAutoTick·hjHold*·viewLedger·viewProject·dashboardTodoHTML 을 부른다.
   중계는 가짜 relayCall(합성 요청 파일). 날짜는 이 기기 오늘 기준 앞뒤 며칠(pastreport-v623 과 같은 셈). 실제 중계·드라이브·고객 없음 — 현장 이름·글·번호는 모두 가짜.
   변이(HJ_V625_MUTATION): no-same-check·new-schedule·span-start-only·money-ok·dup-names·no-phone-check·phone-cut-first·non-string-ok·no-clean·future-ok·photos-any·
   overwrite-report·new-in-progress·midday-done·filled-now·append-resets·no-cap·no-throw-empty 는 ①, pii-in-answer·not-write·label-first-empty·no-preview·preview-bad-text·auto-confirm-off 는 ②,
   not-auto·same-counted-new·no-miss-toast 는 ③(no-throw-empty 는 ③ 의 '요청함에 남김'도 깬다), expense-shown·trips-no-data·worktime-staff·contacts-no-cards·ledger-trip-shown·
   project-card-shown·nav-contacts-shown·tab-not-hidden·help-adpost-text 는 ④, dash-no-slot·dash-in-staff·dash-count-each-render·dash-no-click·dash-no-refresh-paint 는 ⑤ 에서 실패해야 한다.
   HJ_V625_BASELINE=<commit>(예: 6f4b990 = v624) 은 ①에서 실패한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V625_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V625_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-same-check': ["  if(ss.some(s=>s.report&&String(s.report.done==null?'':s.report.done).split('\\n').some(l=>hjWorklogKey(l)===key)))return Object.assign(w,{st:'same'});\n", ''],
  'new-schedule': ["        if(w.st==='nosch'){noSch++;continue;}", "        if(w.st==='nosch'){state.schedule.push({id:'mut',date:w.date,time:'',title:'작업일지',project:w.pj,report:{done:w.line,progress:'진행'}});wrote++;continue;}"],
  'span-start-only': ['    const sp=hjSchSpan(s);return date>=sp.from&&date<=sp.to;', '    return s.date===date;'],
  'money-ok': ["s.project!==pj||!HJ_YMD_RE.test(String(s.date||''))||!hjPrepOtherOk(s))return false;", "s.project!==pj||!HJ_YMD_RE.test(String(s.date||'')))return false;"],
  'dup-names': ["  if(ps.length!==1)return Object.assign(w,{st:'missing'});", "  if(!ps.length)return Object.assign(w,{st:'missing'});"],
  'no-phone-check': ['  if(!full||HJ_WORKLOG_PHONE_RE.test(full))return {pj,date,bad:true};', '  if(!full)return {pj,date,bad:true};'],
  'phone-cut-first': ['HJ_WORKLOG_PHONE_RE.test(full))return {pj,date,bad:true};', 'HJ_WORKLOG_PHONE_RE.test(full.slice(0,HJ_WORKLOG_TEXT_MAX)))return {pj,date,bad:true};'],
  'non-string-ok': [["  if(typeof o.text!=='string')return {pj,date,bad:true};", '  if(o.text==null)return {pj,date,bad:true};'], ['  const full=o.text.replace(', '  const full=String(o.text).replace(']],
  'no-clean': ["  const full=o.text.replace(/[\\u0000-\\u001f\\u007f<>]/g,' ').replace(/\\s+/g,' ').trim();", '  const full=o.text.trim();'],
  'future-ok': ['||date>(today||localDate()))return {pj,date,bad:true};', ')return {pj,date,bad:true};'],
  'photos-any': ['  if(ph!=null&&!(Number.isInteger(ph)&&ph>=0&&ph<=HJ_WORKLOG_PHOTOS_MAX))return {pj,date,bad:true};\n', ''],
  'overwrite-report': ['  const blank=ss.find(s=>hjWorklogRepEmpty(s.report));', '  const blank=ss[0];'],
  'new-in-progress': ["issue:'',progress:(w.date<hjSchSpan(w.s).to?'진행':'완료'),weather:''", "issue:'',progress:'진행',weather:''"],
  'midday-done': ["progress:(w.date<hjSchSpan(w.s).to?'진행':'완료')", "progress:'완료'"],
  'filled-now': ['filledAt:hjWorklogFilledAt(w.date)};wrote++;', 'filledAt:new Date().toISOString()};wrote++;'],
  'append-resets': ["        rep.done=(prev?prev+'\\n':'')+w.line;added++;", "        rep.done=(prev?prev+'\\n':'')+w.line;rep.progress='완료';rep.filledAt=new Date().toISOString();added++;"],
  'no-cap': ['      if(all.length>HJ_WORKLOG_MAX)throw new Error(', '      if(false)throw new Error('],
  'no-throw-empty': ['      if(!wrote&&!added&&(missing||noSch||bad))throw new Error(', '      if(false)throw new Error('],
  'pii-in-answer': ["      return {결과:'작업일지 적기',적음:wrote,", "      return {결과:'작업일지 적기',글:all,적음:wrote,"],
  'not-write': ["AI_WRITE.add('report_worklog');", ''],
  'label-first-empty': [".filter(x=>x&&typeof x==='object'&&typeof x.project==='string'&&x.project.trim());return '작업일지 적기 → '", ";return '작업일지 적기 → '"],
  'no-preview': ["  if(name==='report_worklog')return hjWorklogPreview(a);", ''],
  'preview-bad-text': ["    if(w.st==='bad')out.push(head+': 못 쓰는 값(", "    if(w.st==='bad')out.push(head+': '+String(it&&it.text)+' 못 쓰는 값("],
  'auto-confirm-off': ["AI_ALWAYS_CONFIRM.add('report_worklog');", ''],
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('report_worklog');", ''],
  'same-counted-new': ["||(q.tool==='report_worklog'&&out&&!out.적음&&!out.덧붙임)", ''],
  'no-miss-toast': ["+(wlMiss?' · 작업일지 못 적은 줄 '+wlMiss+'개(현장 이름·날짜·그날 일정 확인)':'')", ''],
  'expense-shown': ["  expense:{why:'안 쓰는 메뉴 — 지출 기록 0건',n:()=>hjHoldNum(state.expenses)},\n", ''],
  'trips-no-data': ["  trips:{why:'안 쓰는 메뉴 — 운행 기록 0건',n:()=>hjHoldNum(state.trips)},", "  trips:{why:'안 쓰는 메뉴 — 운행 기록 0건'},"],
  'worktime-staff': ["n:()=>hjHoldNum(state.workLogs)+(typeof hjStaffOn==='function'&&hjStaffOn()?1:0)}", 'n:()=>hjHoldNum(state.workLogs)}'],
  'contacts-no-cards': ["  contacts:{why:'안 쓰는 메뉴 — 연락처 0명(고객 연락처는 현장 👤 고객 칸에)',n:()=>hjHoldNum(state.contacts)+(state.files||[]).filter(f=>f&&f.kind==='card').length},",
    "  contacts:{why:'안 쓰는 메뉴 — 연락처 0명(고객 연락처는 현장 👤 고객 칸에)',n:()=>hjHoldNum(state.contacts)},"],
  'ledger-trip-shown': ["(hjHeld('trips')?'':'<button class=\"ghost tiny\" data-trip=\"\" style=\"padding:8px 12px\">🚗 운행일지</button>')",
    "'<button class=\"ghost tiny\" data-trip=\"\" style=\"padding:8px 12px\">🚗 운행일지</button>'"],
  'project-card-shown': ["  const wtShow=!hjHeld('worktime'),trShow=!hjHeld('trips');", '  const wtShow=true,trShow=true;'],
  'nav-contacts-shown': ['function hjMoreNavItems(held){return MORE_NAV_SHORTCUTS.filter(n=>!(held&&held.has(n.tab)));}', 'function hjMoreNavItems(held){return MORE_NAV_SHORTCUTS.slice();}'],
  'tab-not-hidden': ['if(HJ_HOLD_EXTRA[id])t.hidden=state.tab!==id&&hjHeld(id);', 'if(HJ_HOLD_EXTRA[id])t.hidden=false;'],
  'help-adpost-text': ["return r.id==='adpostlog'?'⏸ 게시 기록 손 입력은 지금 보류 중 — 더보기 맨 아래 [⏸ 보류]에서 열 수 있어요':'⏸ 지금 보류 중 — 더보기 맨 아래 [⏸ 보류]에서 열 수 있어요';",
    "return '⏸ 게시 기록 손 입력은 지금 보류 중 — 더보기 맨 아래 [⏸ 보류]에서 열 수 있어요';"],
  'dash-no-slot': ['    hjStageTidyDashSlotHtml()+     // v625', '    // v625'],
  'dash-in-staff': ["  if(!(n>0)||state._demo||(typeof hjStaffOn==='function'&&hjStaffOn()))return '';", "  if(!(n>0))return '';"],
  'dash-count-each-render': ["  let inner='';try{inner=hjStageTidyDashInner(__hjStageTidyDashN);}catch(e){inner='';}", "  let inner='';try{inner=hjStageTidyDashInner(hjStageTidyBtnN());}catch(e){inner='';}"],
  'dash-no-click': ["    const stageTidyDash=e.target.closest('[data-stage-tidy-dash]');if(stageTidyDash)return hjStageTidyView();", ''],
  'dash-no-refresh-paint': ["    if(shown!==(inner?String(n):''))slot.innerHTML=inner;", '']
};
if (process.env.HJ_V625_MUTATION) {
  const m = MUT[process.env.HJ_V625_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V625_MUTATION);
  for (const [from, to] of (Array.isArray(m[0]) ? m : [m])) {
    assert.equal(html.split(from).length, 2, 'mutation anchor ' + process.env.HJ_V625_MUTATION); html = html.replace(from, () => to);
  }
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

// 날짜 — 앱의 localDate() 와 같은 이 기기 시각(오늘 기준 앞뒤 며칠)
const p2 = n => String(n).padStart(2, '0');
const day = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const smsAt = (off, hh) => { const d = new Date(); d.setHours(hh, 0, 0, 0); d.setDate(d.getDate() + off); return d.toISOString(); };
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000;
const A = '가상아파트', B = '가상빌라', DUP = '같은이름현장', L = '가상누수현장';
const OLD_AT = '2000-01-01T00:00:00.000Z';
const PROJECTS = () => [
  { name: A, stage: 2, received: 0, phases: [] },
  { name: B, stage: 2, received: 0, phases: [] },
  { name: DUP, stage: 2, received: 0, phases: [] },
  { name: DUP, stage: 2, received: 0, phases: [] },
  { name: L, stage: 2, received: 0, phases: [], kind: 'leak', leak: { sms: { detect: smsAt(-3, 15) } } }
];
const SCHEDULE = () => [
  { id: 'a1', date: day(-3), time: '09:00', title: '가상아파트 욕실 방수', project: A, report: null },
  { id: 'a2', date: day(-3), time: '13:00', title: '가상아파트 줄눈', project: A, report: null },
  { id: 'a3', date: day(-8), time: '09:00', title: '가상아파트 철거', project: A, report: null, memo: day(-8) + '~' + day(-6) + ' (3일)' },
  { id: 'a4', date: day(-5), time: '10:00', title: '💰 잔금 확인', project: A, report: null },
  { id: 'a5', date: day(-5), time: '11:00', title: '부가세 신고', project: A, report: null, _taxAuto: true },
  { id: 'b1', date: day(-2), time: '09:00', title: '가상빌라 도배', project: B, report: { done: '초배 붙임', actualWorkers: '가상 2명', material: '', issue: '', progress: '진행', weather: '맑음', filledAt: OLD_AT } },
  { id: 'b2', date: day(-4), time: '09:00', title: '가상빌라 장판', project: B, report: { done: '', actualWorkers: '', material: '', issue: '', progress: '', weather: '' } },
  { id: 'b3', date: day(-6), time: '09:00', title: '가상빌라 메모', project: B, report: '깨진 보고' },
  { id: 'd1', date: day(-3), time: '09:00', title: '같은이름현장 일', project: DUP, report: null },
  { id: 'l1', date: day(-3), time: '09:00', title: '가상누수현장 누수 탐지', project: L, report: null, urgent: true }
];
let relayLog = [], fileJson = { requests: [] }, toasts = [], dirty = 0, staff = false;
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: new Date().toISOString() }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
ctx.toast = (t) => { toasts.push(String(t)); }; ctx.openModal = () => {}; ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => { dirty++; };
ctx.hjSnapshot = () => Promise.resolve(true);
ctx.hjStaffOn = () => staff;
ctx.__hjRelayBootDone = Promise.resolve();
const realDocument = ctx.document;
function reset(projects, schedule) {
  relayLog = []; toasts = []; dirty = 0; staff = false; store.clear(); ctx.document = realDocument;
  ctx.__seed__ = { projects: projects || PROJECTS(), schedule: schedule || SCHEDULE() };
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=__seed__.projects;state.schedule=__seed__.schedule;state.files=[];state.quotes=[];state.payLog=[];state.asLog=[];
    state.expenses=[];state.trips=[];state.workLogs=[];state.contacts=[];state.adPosts=[];state.tab='dashboard';state.activeProject=null;
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const rep = id => run(`const s=state.schedule.find(x=>x.id===${JSON.stringify(id)});return s?s.report:undefined;`);
const write = items => runA(`return await aiToolRun('report_worklog',{items:${JSON.stringify(items)}});`);
const counts = o => [o.적음, o.덧붙임, o.이미, o.일정없음, o.못찾음, o.잘못된값];
const req = (id, items, extra) => Object.assign({ id, tool: 'report_worklog', args: { items }, why: '작업일지 적기', approved: { via: 'kakao', at: at(Date.now() - 5 * MIN), item: 1100 } }, extra || {});

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS worklog-v625 ' + name); }

(async () => {
  await test('① 적기 — 같은 이름 현장 하나 · 그날 일정 · 빈 보고면 완료 · 덧붙임 · 이미 · 일정없음 · 거르기 · 50줄 · 못 적으면 throw (WRITE)', async () => {
    reset();
    const nSch = run('return state.schedule.length;');
    const items = [
      { project: A, date: day(-3), text: '욕실 방수 1차 완료', photos: 3 },     // a1 빈 보고 → 완료
      { project: A, date: day(-3), text: '줄눈 시공' },                         // a1 은 이제 보고가 있다 → 다음 빈 일정 a2
      { project: A, date: day(-3), text: '실리콘 마감' },                       // 그날 일정이 모두 보고가 있다 → 첫 일정(a1)에 덧붙임
      { project: A, date: day(-7), text: '철거 둘째 날' },                      // 여러 날 공정(a3: -8~-6) 안
      { project: A, date: day(-5), text: '잔금 날 작업' },                      // 💰·세금 자동 일정만 있다 → 일정없음
      { project: B, date: day(-2), text: '정배 마감' },                         // b1 보고가 있다 → 덧붙임(progress·filledAt 그대로)
      { project: B, date: day(-4), text: '장판 깔기' },                         // b2 칸만 있고 비었다 → 빈 보고로 보고 완료
      { project: B, date: day(-6), text: '깨진 보고 날' },                      // 보고 꼴이 깨진 일정만 — 건드리지 않는다
      { project: DUP, date: day(-3), text: '같은 이름' },                       // 같은 이름 현장 둘 → 못찾음
      { project: '없는 현장', date: day(-3), text: '없음' },
      { project: A, date: day(-1), text: '일정 없는 날' },                      // 그날 일정 없음 — 새 일정을 만들지 않는다
      { project: '  ' + A + '  ', date: ' ' + day(-3) + ' ', text: '  욕실   방수 1차 완료 ', photos: 3 }   // 같은 글(띄어쓰기·사진 꼬리 무시) → 이미
    ];
    const out = await write(items);
    assert.equal(out.결과, '작업일지 적기');
    assert.deepEqual(counts(out), [4, 2, 1, 3, 2, 0], JSON.stringify(out));
    assert.equal(run('return state.schedule.length;'), nSch, '새 일정을 만들지 않는다');
    const a1 = rep('a1');
    assert.deepEqual(Object.keys(a1).sort(), ['actualWorkers', 'done', 'filledAt', 'issue', 'material', 'progress', 'weather'], '📋 일일 작업 보고와 같은 칸(v623 꼴)');
    assert.deepEqual([a1.done, a1.progress, a1.filledAt], ['욕실 방수 1차 완료 (사진 3장)\n실리콘 마감', '완료', new Date(day(-3) + 'T00:00:00').toISOString()], '빈 보고 → 완료 · 그날 0시 · 덧붙임은 첫 일정');
    assert.deepEqual([rep('a2').done, rep('a2').progress], ['줄눈 시공', '완료']);
    assert.deepEqual([rep('a3').done, rep('a3').progress, rep('a3').filledAt], ['철거 둘째 날', '진행', new Date(day(-7) + 'T00:00:00').toISOString()],
      '여러 날 공정의 중간 날은 진행(공정이 끝난 것으로 보이지 않게) · filledAt 은 그 보고 날짜 0시');
    const a3saved = rep('a3');
    run("state.schedule.find(s=>s.id==='a3').report=null;");
    await runA(`return await aiToolRun('report_worklog',{items:[{project:${JSON.stringify(A)},date:${JSON.stringify(day(-6))},text:'철거 마지막 날'}]});`);
    assert.deepEqual([rep('a3').done, rep('a3').progress], ['철거 마지막 날', '완료'], '여러 날 공정의 마지막 날은 완료');
    run(`state.schedule.find(s=>s.id==='a3').report=${JSON.stringify(a3saved)};`);   // 아래 '다시 넣어도 이미' 검사를 위해 되돌림
    assert.deepEqual([rep('a4'), rep('a5')], [null, null], '💰 수금·세금 자동 일정에는 적지 않는다');
    const b1 = rep('b1');
    assert.deepEqual([b1.done, b1.progress, b1.filledAt, b1.actualWorkers, b1.weather], ['초배 붙임\n정배 마감', '진행', OLD_AT, '가상 2명', '맑음'], '덧붙이면 다른 칸은 그대로');
    assert.deepEqual([rep('b2').done, rep('b2').progress], ['장판 깔기', '완료'], '칸만 있고 빈 보고는 빈 보고');
    assert.equal(rep('b3'), '깨진 보고', '꼴이 깨진 보고는 그대로');
    assert.equal(rep('d1'), null, '같은 이름 현장 일정은 그대로');
    assert.ok(dirty >= 1, '저장 표시');
    // 같은 요청을 다시 — 한 번만 적힌다(두 번 승인·다시 읽기)
    const again = await write(items.filter((_, i) => [0, 1, 2, 3, 5, 6].includes(i)));
    assert.deepEqual(counts(again), [0, 0, 6, 0, 0, 0], JSON.stringify(again));
    assert.equal(rep('a1').done, '욕실 방수 1차 완료 (사진 3장)\n실리콘 마감', '두 번 붙지 않는다');
    // 못 쓰는 값 — 전화번호 꼴 · 글이 아님 · 빈 글 · 가짜·앞날·다른 꼴 날짜 · 이상한 사진 수 → 하나도 못 적으면 throw(요청함에 남김)
    reset();
    const bad = [
      { project: A, date: day(-3), text: '가상 고객 010-0000-0001 연락 드림' }, { project: A, date: day(-3), text: '번호 01000000002' },
      { project: A, date: day(-3), text: '+82 10-0000-0003 으로' }, { project: A, date: day(-3), text: '관리소 (042) 000-0004' },
      { project: A, date: day(-3), text: 123 }, { project: A, date: day(-3), text: ['욕실'] }, { project: A, date: day(-3), text: '  \n ' },
      { project: A, date: '2026-13-40', text: '날짜 틀림' }, { project: A, date: day(1), text: '내일 일' }, { project: A, date: '11/20', text: '꼴 틀림' }, { project: A, text: '날짜 없음' },
      { project: A, date: day(-3), text: '사진 수', photos: -1 }, { project: A, date: day(-3), text: '사진 수', photos: 2.5 }, { project: A, date: day(-3), text: '사진 수', photos: '3' },
      null, '글'
    ];
    await assert.rejects(write(bad), /한 줄도 적지 못했습니다 — 못 찾은 현장 0곳 · 그날 일정 없음 0줄 · 못 쓰는 값 16줄/);
    assert.deepEqual([rep('a1'), rep('a2')], [null, null], '못 쓰는 값은 적지 않는다');
    // 번호처럼 보이지 않는 숫자(날짜·시각·금액·치수)는 그대로 적는다
    const ok = await write([{ project: A, date: day(-3), text: day(-3) + ' 09:00~18:00 · 1,200,000원 · 0.5평 · 600x1200 타일 2차' }]);
    assert.deepEqual(counts(ok), [1, 0, 0, 0, 0, 0], JSON.stringify(ok));
    // 거르기 — 줄바꿈·탭·꺾쇠는 빈칸(한 줄) · 200자 · 전화번호는 자르기 전에(200자 언저리에 걸친 번호도 잘못된값)
    reset();
    const o4 = await write([{ project: A, date: day(-3), text: '방수\n<b>2차</b>\t마감' }, { project: A, date: day(-3), text: '가'.repeat(300) },
      { project: B, date: day(-4), text: '나'.repeat(193) + ' 010-0000-0005' }]);
    assert.deepEqual(counts(o4), [2, 0, 0, 0, 0, 1], JSON.stringify(o4));
    assert.deepEqual([rep('a1').done, rep('a2').done], ['방수 b 2차 /b 마감', '가'.repeat(200)], '한 줄 · 꺾쇠 빈칸 · 200자');
    assert.equal(rep('b2').done, '', '200자 언저리에 걸친 번호가 든 글은 적지 않는다');
    // 50줄까지 — 넘으면 자르지 않고 throw · 빈 요청 throw
    reset();
    const many = n => Array.from({ length: n }, (_, i) => ({ project: A, date: day(-3), text: '가상 작업 ' + i }));
    await assert.rejects(write(many(51)), /50줄까지/);
    assert.equal(rep('a1'), null, '51줄이면 아무것도 적지 않는다');
    assert.deepEqual(counts(await write(many(50))), [2, 48, 0, 0, 0, 0], '50줄 — 빈 일정 둘에 적고 나머지는 덧붙임');
    await assert.rejects(write([]), /적을 작업일지가 없/);
    await assert.rejects(runA("return await aiToolRun('report_worklog',{});"), /적을 작업일지가 없/);
    // 못 찾은 현장·그날 일정 없음만 → throw · 이미만 → throw 아님
    reset();
    await assert.rejects(write([{ project: '가상 아파트', date: day(-3), text: 'x' }, { project: A, date: day(-1), text: 'y' }]), /못 찾은 현장 1곳 · 그날 일정 없음 1줄/);
    await write([{ project: A, date: day(-3), text: '한 번' }]);
    assert.deepEqual(counts(await write([{ project: A, date: day(-3), text: '한 번' }])), [0, 0, 1, 0, 0, 0], '이미만이면 throw 아님');
    // 누수 현장 — 완료 보고 시각이 그날 0시라 그날 보낸 '확인' 문자는 그대로 '보냄'
    reset();
    assert.equal(run(`return hjLeakSmsSent(state.projects.find(p=>p.name===${JSON.stringify(L)}),'detect');`), true, '시험 전제 — 그날 보낸 누수 확인 문자');
    await write([{ project: L, date: day(-3), text: '누수 탐지 끝' }]);
    assert.deepEqual([rep('l1').progress, rep('l1').filledAt], ['완료', new Date(day(-3) + 'T00:00:00').toISOString()]);
    assert.equal(run(`return hjLeakSmsSent(state.projects.find(p=>p.name===${JSON.stringify(L)}),'detect');`), true, '보고 뒤에도 그날 보낸 문자는 보냄');
  });

  await test('② 답에는 셈만 · 아는 도구 · 장부 작업 · 이름표 · 미리보기 · 늘 확인 (ANSWER)', async () => {
    reset();
    const out = await write([{ project: A, date: day(-3), text: '가상 비밀 작업 글', photos: 2 }, { project: '가상 없는 현장 이름', date: day(-3), text: 'x' }]);
    assert.deepEqual(Object.keys(out), ['결과', '적음', '덧붙임', '이미', '일정없음', '못찾음', '잘못된값'], '약속한 답 칸만(카톡봇과 같다)');
    const text = JSON.stringify(out);
    for (const v of ['가상 비밀', A, '가상 없는 현장', day(-3)]) assert.ok(!text.includes(v), '답에 ' + v + ' 없음: ' + text);
    assert.equal(run("return aiResultBrief('report_worklog'," + text + ");"), ' — 적음 1 · 덧붙임 0 · 못 찾은 현장 1');
    assert.equal(run("return aiResultBrief('report_worklog',{적음:0,덧붙임:2,이미:1,일정없음:3,못찾음:0,잘못된값:4});"), ' — 적음 0 · 덧붙임 2 · 이미 있음 1 · 그날 일정 없음 3 · 못 쓰는 값 4');
    assert.equal(run("return claudeReqBad({id:'kb-20261125-090000-a1100',tool:'report_worklog',args:{items:[]}});"), '', '요청함이 아는 도구');
    assert.equal(run("return AI_WRITE.has('report_worklog');"), true, '장부를 바꾸는 작업으로 표시(요청함 경고·안전판)');
    assert.equal(run("return AI_TOOLS.filter(t=>t.name==='report_worklog').length;"), 1);
    assert.equal(run("return aiActionLabel('report_worklog',{items:[{project:'가'},{project:'나'},{project:'가'}]});"), '작업일지 적기 → "가" 외 2건');
    assert.equal(run("return aiActionLabel('report_worklog',{items:[{project:'가'}]});"), '작업일지 적기 → "가"');
    assert.equal(run("return aiActionLabel('report_worklog',{items:[{text:'현장 없음'},{project:' 나 '}]});"), '작업일지 적기 → "나"', '현장 없는 줄은 이름표에서 뺀다');
    assert.equal(run("return aiActionLabel('report_worklog',{});"), '작업일지 적기 → 0건');
    // 승인 화면 미리보기 — 이 기기 화면에만 · 현장·날짜·글 앞부분 · 못 쓰는 줄은 글을 보이지 않는다
    reset();
    run(`state.schedule.find(s=>s.id==='a2').report={done:'이미 쓴 글',progress:'완료'};`);
    const pv = run(`return aiActionWarnings('report_worklog',{items:${JSON.stringify([
      { project: A, date: day(-3), text: '가'.repeat(60), photos: 1 }, { project: A, date: day(-3), text: '이미 쓴 글' }, { project: B, date: day(-2), text: '덧붙일 글' },
      { project: '없는 현장', date: day(-3), text: 'x' }, { project: A, date: day(-1), text: 'y' }, { project: A, date: day(-3), text: '가상 010-0000-0009 고객' }])}});`);
    assert.equal(pv.length, 7, JSON.stringify(pv));
    assert.match(pv[0], /새 일정은 만들지 않아요/);
    const md = run(`return hjMdDow(${JSON.stringify(day(-3))});`);
    assert.equal(pv[1], A + ' ' + md + ': ' + '가'.repeat(39) + '…', '현장·날짜·글 앞부분');
    assert.match(pv[2], /이미 적혀 있음$/);
    assert.match(pv[3], /^가상빌라 .+: 덧붙일 글 \(보고에 덧붙임\)$/);
    assert.match(pv[4], /현장을 못 찾음/);
    assert.match(pv[5], /그날 일정이 없어 적지 않아요/);
    assert.match(pv[6], /못 쓰는 값/);
    assert.ok(!pv.join('\n').includes('0000-0009'), '번호가 든 글은 미리보기에도 보이지 않는다');
    assert.match(run(`return aiActionWarningHTML('report_worklog',{items:[{project:${JSON.stringify(A)},date:${JSON.stringify(day(-3))},text:'<i>x</i>'}]});`), /data-ai-action-warning/);
    const many = Array.from({ length: 12 }, (_, i) => ({ project: A, date: day(-3), text: '가상 ' + i }));
    assert.equal(run(`return aiActionWarnings('report_worklog',{items:${JSON.stringify(many)}}).slice(-1)[0];`), '외 4줄');
    // AI 비서는 ⚡자동 실행이어도 늘 확인
    run('window.__aiAuto=true;');
    assert.equal(run("return aiWriteNeedsConfirm('report_worklog');"), true);
    run('window.__aiAuto=false;');
  });

  await test('③ 카톡 승인이면 저절로 · 링크는 아님 · 이미뿐이면 건너뜀 · 못 적으면 요청함 · 일부만이면 토스트 (AUTO)', async () => {
    assert.equal(run("return HJ_KAKAO_AUTO_TOOLS.has('report_worklog');"), true);
    reset();
    fileJson = { requests: [req('kb-20261125-090000-a1100', [{ project: A, date: day(-3), text: '가상 방수 완료', photos: 2 }])] };
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261125-090000-a1100']);
    assert.deepEqual([rep('a1').done, rep('a1').progress], ['가상 방수 완료 (사진 2장)', '완료']);
    assert.ok(toasts.some(t => /1건을 현장웹에 넣었어요$/.test(t)), toasts.join(' / '));
    // 링크·붙여넣기(via link)로 받은 것은 저절로 넣지 않는다(v617 문 그대로)
    reset();
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'link',requests:${JSON.stringify([req('kb-20261125-090001-a1101', [{ project: A, date: day(-3), text: 'x' }])])}});`), 0);
    assert.equal(rep('a1'), null);
    // 이미 적힌 글뿐 — 처리로 표시하되 '넣었어요' 셈에는 넣지 않는다
    reset();
    run(`state.schedule.find(s=>s.id==='a1').report={done:'가상 이미 적음',progress:'완료',filledAt:${JSON.stringify(OLD_AT)}};`);
    const n = await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify([req('kb-20261125-090002-a1102', [{ project: A, date: day(-3), text: '가상 이미 적음' }])])}});`);
    assert.equal(n, 0);
    assert.deepEqual(run('return state.claudeDone.slice();'), ['kb-20261125-090002-a1102'], '처리로는 표시(다시 넣지 않게)');
    assert.ok(!toasts.some(t => /넣었어요/.test(t)), toasts.join(' / '));
    // 한 줄도 못 적었다(현장 이름이 틀림·그날 일정 없음·번호가 든 글) — 처리로 표시하지 않고 요청함에 남긴다(봇이 '반영됐어요'라고 하지 않게)
    reset();
    const bad = [req('kb-20261125-090003-a1103', [{ project: '가상 아파트', date: day(-3), text: 'x' }]), req('kb-20261125-090004-a1104', [{ project: A, date: day(-1), text: 'y' }]),
      req('kb-20261125-090005-a1105', [{ project: A, date: day(-3), text: '가상 010-0000-0006' }])];
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify(bad)}});`), 0);
    assert.deepEqual(run('return state.claudeDone.slice();'), [], '요청함에 남는다');
    assert.equal(rep('a1'), null);
    // 일부만 못 적었다 — 적은 것은 적고, 토스트로 못 적은 줄을 알린다
    reset();
    const part = [req('kb-20261125-090006-a1106', [{ project: A, date: day(-3), text: '가상 적을 글' }, { project: A, date: day(-1), text: '일정 없는 날' }, { project: '없는 현장', date: day(-3), text: 'z' }])];
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'drive',requests:${JSON.stringify(part)}});`), 1);
    assert.equal(rep('a1').done, '가상 적을 글');
    assert.ok(toasts.some(t => /작업일지 못 적은 줄 2개/.test(t)), toasts.join(' / '));
  });

  await test('④ 보류 — 지출 셋·운행일지·작업시간·연락처·명함 스캔 · 기록이 생기면 보임 · 직원 모드 · 회계 탭·현장 화면·바로가기·PC 탭 (HOLD)', async () => {
    const NEW = ['expense', 'expenseclassify', 'scanreceipt', 'trips', 'worktime', 'contacts', 'scancard'];
    reset();
    const held = () => run(`return ${JSON.stringify(NEW)}.filter(id=>hjHeld(id));`);
    assert.deepEqual(held(), NEW, '11/25 자료 꼴(지출·운행·작업시간·연락처 0건) → 일곱 모두 보류');
    assert.deepEqual(run(`return ${JSON.stringify(NEW)}.filter(id=>HJ_HOLD_NEVER.includes(id)||!HJ_HOLD_IDS.includes(id));`), [], '보류 목록에 있고 보류하지 않는 목록과 겹치지 않음');
    assert.deepEqual(run(`return ['expense','expenseclassify','scanreceipt','scancard'].map(id=>!!moreItemInfo(id)&&!HJ_HOLD_EXTRA[id]);`), [true, true, true, true], '더보기 칸 넷');
    assert.deepEqual(run(`return ['trips','worktime','contacts'].map(id=>!moreItemInfo(id)&&typeof HJ_HOLD_EXTRA[id].open);`), ['function', 'function', 'function'], '더보기 칸이 아닌 셋은 보류 묶음에서 여는 길');
    assert.match(run("return hjHoldWhy('worktime');"), /작업시간 기록 0건/);
    assert.match(run("return hjHoldWhy('contacts');"), /연락처 0명/);
    for (const id of NEW) assert.ok(!/\.js\b|\.md\b|team-config/.test(run(`return hjHoldWhy(${JSON.stringify(id)});`)), id + ' 까닭은 쉬운 말');
    // 고객 관리·리뷰 요청·실측 노트·하자점검표·추가공사·부대사항·AS·아파트 오더·음성 현장일지(📋 작업 보고)는 이번에 보류하지 않는다
    assert.deepEqual(run("return ['crm','repeatcust','reviewreq','measure','punchlist','extrawork','siterules','asmanage','aptorders','worklog','photorep'].filter(id=>hjHeld(id));"), []);
    // 기록이 한 건이라도 생기면 다시 보인다
    const shownWith = setup => { reset(); run(setup); return held(); };
    assert.deepEqual(shownWith("state.expenses=[{id:'e1',amt:1000}];"), ['trips', 'worktime', 'contacts', 'scancard'], '지출 1건 → 지출 셋 보임');
    assert.deepEqual(shownWith("state.trips=[{id:'t1',km:3}];"), ['expense', 'expenseclassify', 'scanreceipt', 'worktime', 'contacts', 'scancard'], '운행 1건 → 운행일지 보임');
    assert.deepEqual(shownWith("state.workLogs=[{id:'w1',project:'가상아파트',date:'2026-11-20',in:'09:00',out:''}];"), ['expense', 'expenseclassify', 'scanreceipt', 'trips', 'contacts', 'scancard'], '작업시간 1건 → 작업시간 보임');
    assert.deepEqual(shownWith("state.contacts=[{id:'c1',name:'가상'}];"), ['expense', 'expenseclassify', 'scanreceipt', 'trips', 'worktime'], '연락처 1명 → 연락처·명함 스캔 보임');
    assert.deepEqual(shownWith("state.files=[{id:'f1',kind:'card',name:'가상명함.jpg'}];"), ['expense', 'expenseclassify', 'scanreceipt', 'trips', 'worktime'], '명함 사진 1장 → 연락처·명함 스캔 보임');
    reset(); staff = true;
    assert.deepEqual(held(), ['expense', 'expenseclassify', 'scanreceipt', 'trips', 'contacts', 'scancard'], '직원 모드 기기는 ⏱ 작업시간을 접지 않는다');
    staff = false;
    // 💼 회계 탭 [🚗 운행일지] · 현장 화면 ⏱·📋·🚗 — 보류면 없고, 다시 보이기·기록이면 그대로
    reset();
    const ledger = () => run('return viewLedger();');
    assert.ok(!/data-trip=/.test(ledger()), '운행 0건 → 회계 탭 🚗 없음');
    const proj = () => { run(`state.tab='project';state.activeProject=${JSON.stringify(A)};`); const h = run('return viewProject();'); return { punch: /data-punch=/.test(h), log: /data-worklog=/.test(h), trip: /data-trip=/.test(h) }; };
    assert.deepEqual(proj(), { punch: false, log: false, trip: false }, '둘 다 0건 → 현장 화면 ⏱·🚗 칸 없음');
    run("hjHoldShow('worktime');");
    assert.deepEqual(proj(), { punch: true, log: true, trip: false }, '작업시간만 다시 보이기');
    run("hjHoldShow('trips');");
    assert.deepEqual(proj(), { punch: true, log: true, trip: true }, '둘 다 — 예전 그대로');
    assert.ok(/data-trip=""/.test(ledger()), '다시 보이면 회계 탭 🚗');
    reset(); run("state.trips=[{id:'t1',km:3}];");
    assert.deepEqual(proj(), { punch: false, log: false, trip: true }, '운행 기록만 있으면 🚗 만');
    // 더보기 바로가기 [연락처] · PC 위 연락처 탭 — 보류면 빠지고, 보고 있는 동안은 그대로
    reset();
    assert.ok(!run('return hjMoreNavItems(hjHoldState().held).map(n=>n.tab);').includes('contacts'), '바로가기에서 연락처 빠짐');
    assert.equal(run('return hjMoreNavItems(hjHoldState().held).length;'), run('return MORE_NAV_SHORTCUTS.length;') - 1, '다른 바로가기는 그대로');
    assert.ok(run('return moreSearchItems("연락처").some(it=>it.tab==="contacts");'), '검색은 그대로 찾는다');
    const tabs = [{ dataset: { tab: 'contacts' }, hidden: false }, { dataset: { tab: 'schedule' }, hidden: false }, { dataset: { tab: 'quotemaker' }, hidden: false }];
    ctx.document = { querySelectorAll: () => tabs };
    run('hjHoldTabsSync();');
    assert.deepEqual(tabs.map(t => t.hidden), [true, false, false], 'PC 위 연락처 탭만 숨김');
    run("state.tab='contacts';hjHoldTabsSync();");
    assert.equal(tabs[0].hidden, false, '보류 묶음에서 연 연락처 탭은 보이는 동안 그대로');
    run("state.tab='dashboard';state.contacts=[{id:'c1',name:'가상'}];hjHoldTabsSync();");
    assert.equal(tabs[0].hidden, false, '연락처가 생기면 탭이 돌아온다');
    ctx.document = realDocument;
    // 보류 묶음에서 연다(지운 것이 아니다)
    reset();
    const opened = [];
    ctx.tripView = r => opened.push('trip:' + r); ctx.workView = (...a) => opened.push('work:' + a.length);
    run("hjHoldOpen('trips');hjHoldOpen('worktime');hjHoldOpen('contacts');");
    assert.deepEqual([opened, run('return state.tab;')], [['trip:true', 'work:0'], 'contacts']);
    const chip = '(it=>\'<button data-moreaction="\'+it.id+\'">\'+it.label+\'</button>\')';
    const block = run(`return moreHoldBlockHtml(hjHoldState(),${chip},false);`);
    for (const id of ['trips', 'worktime', 'contacts']) assert.ok(block.includes('data-hold-open="' + id + '"'), '보류 묶음 열기 단추 ' + id);
    for (const id of ['expense', 'expenseclassify', 'scanreceipt', 'scancard']) assert.ok(block.includes('data-moreaction="' + id + '"'), '보류 묶음의 더보기 칸 ' + id);
    // 📖 사용설명서 — 장부 탭 [🚗 운행일지] 설명에 '⏸ 보류' 한 줄 · 광고 관리는 예전 글 그대로
    const rows = 'hjHoldState().rows';
    assert.equal(run(`return hjHelpHoldNote({k:'차량 운행일지',d:'장부 탭 [🚗 운행일지]'},${rows});`), '⏸ 지금 보류 중 — 더보기 맨 아래 [⏸ 보류]에서 열 수 있어요');
    assert.match(run(`return hjHelpHoldNote({k:'광고 관리',d:''},${rows});`), /^⏸ 게시 기록 손 입력은 지금 보류 중/);
    assert.match(run(`return hjHelpHoldNote({k:'경비 분류',d:'더보기 [🧾 경비 분류]'},${rows});`), /^⏸ 지금 보류 중/);
  });

  await test('⑤ 첫 화면 단계 정리 한 줄 — v613 규칙 그대로 · 직원·체험 없음 · 그릴 때마다 세지 않음 · 자리만 고침 (DASH)', async () => {
    const P = '가상완료현장';
    reset([{ name: P, stage: 0, received: 0, phases: [] }, { name: '가상상담현장', stage: 0, received: 0, phases: [] }],
      [{ id: 'w1', date: day(-12), time: '09:00', title: '가상완료현장 도배', project: P, report: null }]);
    run(`state.payLog=[{d:${JSON.stringify(day(-10))},project:${JSON.stringify(P)},amt:1000000}];`);
    const realStats = ctx.projStats;
    ctx.projStats = n => n === P ? { bill: 1000000, extra: 0, recv: 1000000, due: 0 } : { bill: 0, extra: 0, recv: 0, due: 0 };
    try {
      assert.equal(run('return hjStageTidyBtnN();'), 1, '받을 돈을 다 받은 상담 현장 하나 — v613 규칙');
      assert.equal(run('return hjStageTidyPlan().on;'), 1, '새 판단 규칙 없음 — 세는 것은 v613 제안의 체크해 둘 줄');
      const line = run('return hjStageTidyDashInner(1);');
      assert.match(line, /🧹 단계 정리 — 완료로 볼 현장 <b data-stage-tidy-dash-n="1">1곳<\/b>/);
      assert.match(line, /<button type="button" class="ghost" data-stage-tidy-dash style="min-height:44px[^"]*">보기<\/button>/, '[보기] 44px');
      assert.equal(run('return hjStageTidyDashInner(0);'), '', '0곳이면 없음');
      staff = true; assert.equal(run('return hjStageTidyDashInner(3);'), '', '직원 모드엔 없음'); staff = false;
      run('state._demo=true;'); assert.equal(run('return hjStageTidyDashInner(3);'), '', '체험엔 없음'); run('state._demo=false;');
      // 첫 화면을 그릴 때는 세지 않는다(지난번 수로) — 다시 세기는 그린 뒤 한 번, 이 자리만 고친다
      let calls = 0; const realBtn = ctx.hjStageTidyBtnN; ctx.hjStageTidyBtnN = () => { calls++; return realBtn(); };
      run('__hjStageTidyDashN=0;');
      const slot0 = run('return hjStageTidyDashSlotHtml();');
      assert.equal(calls, 0, '그릴 때마다 세지 않는다');
      assert.equal(slot0, '<div id="dashboardStageTidy" hidden></div>', '처음(센 적 없음)은 빈 자리');
      assert.match(run('return dashboardTodoHTML();'), /<div id="dashboardStageTidy" hidden><\/div>/, '✅ 오늘 현장 업무 칸 안의 자리');
      const slot = { isConnected: true, hidden: true, innerHTML: '', q: null, querySelector() { return this.q; } };
      ctx.document = { getElementById: id => (id === 'dashboardStageTidy' ? slot : null) };
      assert.equal(run('return hjStageTidyDashRefresh();'), 1);
      assert.equal(calls, 1);
      assert.ok(/완료로 볼 현장/.test(slot.innerHTML) && slot.hidden === false, '센 뒤 그 자리만 채운다 ' + slot.innerHTML);
      slot.innerHTML = 'KEEP'; slot.q = { dataset: { stageTidyDashN: '1' } };
      run('hjStageTidyDashRefresh();');
      assert.equal(slot.innerHTML, 'KEEP', '수가 같으면 바꿔 끼우지 않는다(누르려던 [보기] 그대로)');
      assert.equal(calls, 2);
      calls = 1;
      ctx.document = realDocument;
      assert.match(run('return dashboardTodoHTML();'), /<div id="dashboardStageTidy"><div data-stage-tidy-dash-line[^>]*>.*완료로 볼 현장 <b data-stage-tidy-dash-n="1">1곳<\/b>.*data-stage-tidy-dash /, '다음 그리기부터 지난번 수로 한 줄');
      assert.equal(calls, 1, '그때도 세지 않는다');
      ctx.document = { getElementById: () => null };
      assert.equal(run('return hjStageTidyDashRefresh();'), -1, '첫 화면이 아니면 세지 않는다');
      ctx.document = realDocument;
      ctx.hjStageTidyBtnN = realBtn;
    } finally { ctx.projStats = realStats; ctx.document = realDocument; }
    // [보기] 는 기존 🧹 단계 정리 창(체크한 것만 바뀐다)
    assert.ok(html.includes("const stageTidyDash=e.target.closest('[data-stage-tidy-dash]');if(stageTidyDash)return hjStageTidyView();"), '[보기] → hjStageTidyView');
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('worklog-v625: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

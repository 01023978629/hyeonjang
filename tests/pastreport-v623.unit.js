/* v623 📋 지난 일정 보고 정리 (단위 검사)
   대표 결정(11/24 'C ⑧ 지난 일정 작업 보고'). 11/24 자료: 일정 84건 중 작업 보고 있는 일정 0건 · 현장이 이어진 지난 일정 15건 중 8건은
   그날 그 현장 사진이 있다 — 보고가 없으면 공정 진행·🐢 공정 지연·누수 출동 기록이 그 일을 '안 한 일'로 본다.
   ① 후보 — 지난 60일 · 진행 현장에 이어진 · 보고 없는 · 여러 날 공정은 끝난 뒤 · 상담/실측·💰·세금·AS 방문 빼고 · 최근 먼저 (CANDS)
   ② 사진 수 — 같은 현장 · 그 일정 기간(여러 날) 안 · 사진만(서류 아님) (PHOTOS)
   ③ 남기기 — 체크한 것만 '완료' 보고(📋 와 같은 칸) · 그사이 보고가 생긴 일정은 건너뜀 · 저장 표시 (APPLY)
   ④ 띠와 창 — 체험·직원 모드엔 띠 없음 · 사진 있는 일정만 미리 체크 · [완료로 기록] 이 고른 것만 남김 (VIEW)
   ⑤ 연결 — 일정 탭에 띠 · 누르면 창 (WIRE)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(autoupdate-v622.unit.js 와 같은 틀) 진짜 함수를 부른다.
   변이(HJ_V623_MUTATION): keep-report·include-archived·no-window·unfinished-span·no-skip-plan·no-skip-as 는 ①, photo-any-kind·photo-span 은 ②,
   apply-overwrite·apply-progress·apply-filled-now 는 ③, no-skip-as-id 는 ①, precheck-all·banner-in-demo 는 ④, no-banner-wire·no-click-wire 는 ⑤에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'keep-report': ['    if(!s||s.report||s._taxAuto||!live.has(s.project)||', '    if(!s||s._taxAuto||!live.has(s.project)||'],
  'include-archived': ['  const live=new Set((state.projects||[]).filter(p=>p&&p.name&&!p.archived).map(p=>p.name));   // 진행 현장만', '  const live=new Set((state.projects||[]).filter(p=>p&&p.name).map(p=>p.name));   // 진행 현장만'],
  'no-window': ["!HJ_YMD_RE.test(String(s.date||''))||s.date<from)return false;", "!HJ_YMD_RE.test(String(s.date||'')))return false;"],
  'unfinished-span': ['    return hjSchSpan(s).to<today;   // 여러 날 공정은 끝난 뒤에만', '    return s.date<today;   // 여러 날 공정은 끝난 뒤에만'],
  'no-skip-plan': ['    if(!t||HJ_PLAN_SKIP_RE.test(t)||HJ_INQ_MONEY_RE.test(t)||', '    if(!t||HJ_INQ_MONEY_RE.test(t)||'],
  'no-skip-as': ['||hjIsAsVisitSched(s)||asIds.has(s.id))return false;', ')return false;'],
  'photo-any-kind': ["    if(!f||f.kind!=='photo'||!want.has(f.project)||!f.when)return;", '    if(!f||!want.has(f.project)||!f.when)return;'],
  'photo-span': ['    (days.get(s.project)||new Map()).forEach((c,d)=>{if(d>=sp.from&&d<=sp.to)n+=c;});', '    (days.get(s.project)||new Map()).forEach((c,d)=>{if(d===sp.from)n+=c;});'],
  'apply-overwrite': ['    if(!s||s.report)return;   // 그사이 보고가 생긴 일정(다른 기기·📋)은 그대로', '    if(!s)return;   // 그사이 보고가 생긴 일정(다른 기기·📋)은 그대로'],
  'apply-progress': ["issue:'',progress:'완료',weather:'',filledAt};n++;});", "issue:'',progress:'진행',weather:'',filledAt};n++;});"],
  'apply-filled-now': ["const day=new Date(String(s.date)+'T00:00:00'),filledAt=isNaN(day.getTime())?new Date().toISOString():day.toISOString();   // 그 일정 날 0시", "const filledAt=new Date().toISOString();   // 그 일정 날 0시"],
  'no-skip-as-id': ['||hjIsAsVisitSched(s)||asIds.has(s.id))return false;', '||asIds.has(s.id))return false;'],
  'precheck-all': ["'\"'+(r.n>0?' checked':'')+' style=\"margin-top:3px\">'", "'\"'+' checked'+' style=\"margin-top:3px\">'"],
  'banner-in-demo': ["    if(hjStaffOn()||state._demo)return '';   // 체험·직원 모드엔 없음", "    if(false)return '';   // 체험·직원 모드엔 없음"],
  'no-banner-wire': ['  html+=hjPastRepBanner();   // v623 보고 없는 지난 일정 — 보고 정리', ''],
  'no-click-wire': ["    const pastRepTarget=e.target.closest('[data-past-rep]');if(pastRepTarget)return hjPastRepView();   // v623 지난 일정 보고 정리", ''],
};
if (process.env.HJ_V623_MUTATION) {
  const m = MUT[process.env.HJ_V623_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V623_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V623_MUTATION); html = html.replace(m[0], () => m[1]);
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

// 날짜 — 앱의 localDate() 와 같은 기기 시각(오늘 기준 앞뒤 며칠)
const pad = n => String(n).padStart(2, '0');
const day = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const smsAt = (off, hh) => { const d = new Date(); d.setHours(hh, 0, 0, 0); d.setDate(d.getDate() + off); return d.toISOString(); };
const shot = (off, hh, project, kind = 'photo') => { const d = new Date(); d.setHours(hh, 30, 0, 0); d.setDate(d.getDate() + off); return { kind, project, when: d.toISOString(), name: 'p' + off + hh + '.jpg' }; };

let dirty = 0, renders = 0, toasts = [], modal = null, staff = false;
ctx.markDirty = () => { dirty++; };
ctx.render = () => { renders++; };
ctx.toast = m => { toasts.push(String(m)); };
ctx.hjStaffOn = () => staff;
ctx.openModal = (title, body, btns) => { modal = { title, body, btns }; };
ctx.closeModal = () => {};

function seed() {
  dirty = 0; renders = 0; toasts = []; modal = null; staff = false;
  ctx.__seed__ = {
    projects: [{ name: '가나아파트', stage: 2, kind: 'leak', leak: { sms: { detect: smsAt(-3, 15) } } }, { name: '다라빌라', stage: 2 }, { name: '보관현장', stage: 3, archived: true }],
    schedule: [
      { id: 's1', date: day(-3), time: '09:00', title: '가나아파트 101동 욕실 방수', project: '가나아파트', report: null, urgent: true },
      { id: 's2', date: day(-5), time: '10:00', title: '다라빌라 우수관', project: '다라빌라', report: null },
      { id: 's3', date: day(-8), time: '09:00', title: '가나아파트 철거', project: '가나아파트', report: null, memo: day(-8) + '~' + day(-6) + ' (3일)' },
      { id: 'rep', date: day(-2), time: '09:00', title: '이미 보고', project: '가나아파트', report: { done: '', progress: '진행' } },
      { id: 'arc', date: day(-2), time: '09:00', title: '보관 현장 일', project: '보관현장', report: null },
      { id: 'nop', date: day(-2), time: '09:00', title: '현장 없는 일', project: '', report: null },
      { id: 'gone', date: day(-2), time: '09:00', title: '없는 현장', project: '사라진현장', report: null },
      { id: 'today', date: day(0), time: '09:00', title: '오늘 일', project: '가나아파트', report: null },
      { id: 'future', date: day(2), time: '09:00', title: '모레 일', project: '가나아파트', report: null },
      { id: 'old', date: day(-61), time: '09:00', title: '두 달 전 일', project: '가나아파트', report: null },
      { id: 'edge', date: day(-60), time: '09:00', title: '딱 60일 전 일', project: '다라빌라', report: null },
      { id: 'going', date: day(-2), time: '09:00', title: '가나아파트 타일', project: '가나아파트', report: null, memo: day(-2) + '~' + day(1) + ' (4일)' },
      { id: 'meet', date: day(-4), time: '14:00', title: '상담·실측: 가나아파트', project: '가나아파트', report: null },
      { id: 'money', date: day(-4), time: '14:00', title: '💰 잔금 확인', project: '가나아파트', report: null },
      { id: 'tax', date: day(-4), time: '14:00', title: '부가세 신고', project: '가나아파트', report: null, _taxAuto: true },
      { id: 'as1', date: day(-4), time: '15:00', title: '🔧 AS 방문 — 누수', project: '가나아파트', report: null },
      { id: 'as2', date: day(-4), time: '16:00', title: '하자 확인', project: '다라빌라', report: null },
      { id: 'as3', date: day(-4), time: '17:00', title: '방문 점검', project: '다라빌라', report: null, asId: 'a9' },
    ],
    files: [
      shot(-3, 10, '가나아파트'), shot(-3, 11, '가나아파트'), shot(-3, 11, '다라빌라'), shot(-4, 11, '가나아파트'),
      shot(-7, 9, '가나아파트'), shot(-7, 10, '가나아파트'), shot(-6, 15, '가나아파트'), shot(-9, 10, '가나아파트'),
      shot(-5, 10, '다라빌라', 'doc'), { kind: 'photo', project: '다라빌라', when: 'bad' },
    ],
    asLog: [{ id: 'a1', visitSchedId: 'as2' }],
  };
  vm.runInContext(`state._demo=false;state.projects=__seed__.projects;state.schedule=__seed__.schedule;state.files=__seed__.files;state.asLog=__seed__.asLog;`, ctx);
}
const cands = () => run('return hjPastRepCands().map(r=>({id:r.s.id,n:r.n}));');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS pastreport-v623 ' + name); }

test('① 후보 — 지난 60일 · 진행 현장 · 보고 없음 · 끝난 공정 · 상담/실측·💰·세금·AS 빼고 · 최근 먼저 (CANDS)', () => {
  seed();
  assert.deepEqual(cands().map(r => r.id), ['s1', 's2', 's3', 'edge']);
  assert.equal(run("return hjPastRepCands('" + day(1) + "').some(r=>r.s.id==='going');"), false, '내일 끝나는 여러 날 공정은 아직');
  assert.equal(run("return hjPastRepCands('" + day(2) + "').some(r=>r.s.id==='going');"), true, '끝난 다음 날부터');
  assert.equal(run("return hjPastRepCands('" + day(1) + "').some(r=>r.s.id==='today');"), true, '오늘 일은 내일부터');
});

test('② 사진 수 — 같은 현장 · 그 기간 안 · 사진만 (PHOTOS)', () => {
  seed();
  const n = Object.fromEntries(cands().map(r => [r.id, r.n]));
  assert.deepEqual(n, { s1: 2, s2: 0, s3: 3, edge: 0 }, '다른 현장 사진·서류·시각 없는 사진·기간 밖 사진은 세지 않는다');
});

test('③ 남기기 — 고른 것만 · 그사이 보고가 생기면 건너뜀 · 저장 표시 (APPLY)', () => {
  seed();
  assert.equal(run("return hjLeakSmsSent(state.projects[0],'detect');"), true, '그날 보낸 누수 확인 문자 — 보고 전');
  const r = run(`const rows=hjPastRepCands();const pick=rows.filter(r=>r.s.id==='s1'||r.s.id==='s2'||r.s.id==='s3');
    state.schedule.find(s=>s.id==='s3').report={done:'다른 기기에서 쓴 보고',progress:'완료'};
    const n=hjPastRepApply(pick);return {n,s1:state.schedule.find(s=>s.id==='s1').report,s2:state.schedule.find(s=>s.id==='s2').report,
    s3:state.schedule.find(s=>s.id==='s3').report,edge:state.schedule.find(s=>s.id==='edge').report};`);
  assert.equal(r.n, 2);
  assert.deepEqual(Object.keys(r.s1).sort(), ['actualWorkers', 'done', 'filledAt', 'issue', 'material', 'progress', 'weather'], '📋 일일 작업 보고와 같은 칸');
  assert.equal(r.s1.done, '가나아파트 101동 욕실 방수 (사진 2장)');
  assert.equal(r.s1.progress, '완료');
  assert.equal(r.s1.filledAt, new Date(day(-3) + 'T00:00:00').toISOString(), '보고 시각은 그 일정 날 0시(누른 때가 아니다)');
  assert.equal(run("return hjLeakSmsSent(state.projects[0],'detect');"), true, '그날 보낸 누수 확인 문자는 보고 뒤에도 보냄');
  assert.equal(r.s2.done, '다라빌라 우수관', '사진이 없으면 제목만');
  assert.equal(r.s3.done, '다른 기기에서 쓴 보고', '그사이 생긴 보고는 그대로');
  assert.equal(r.edge, null, '고르지 않은 일정은 그대로');
  assert.equal(run("return hjSchReported(state.schedule.find(s=>s.id==='s1'));"), true, '앱이 한 일로 본다');
  assert.deepEqual([dirty, renders], [1, 1]);
  assert.equal(run('return hjPastRepApply([]);'), 0);
  assert.deepEqual([dirty, renders], [1, 1], '바뀐 것이 없으면 저장 표시도 없음');
  assert.deepEqual(cands().map(x => x.id), ['edge'], '남긴 일정은 후보에서 빠진다');
});

test('④ 띠와 창 — 체험·직원 모드엔 띠 없음 · 사진 있는 일정만 미리 체크 · 고른 것만 남김 (VIEW)', () => {
  seed();
  const b = run('return hjPastRepBanner();');
  assert.match(b, /📋 보고 없는 지난 일정 <b>4건<\/b> — 그날 현장 사진이 있는 일정 2건/);
  assert.match(b, /data-past-rep="1"/);
  staff = true; assert.equal(run('return hjPastRepBanner();'), '', '직원 모드');
  staff = false; run('state._demo=true;'); assert.equal(run('return hjPastRepBanner();'), '', '체험');
  run('state._demo=false;');
  run('hjPastRepView();');
  assert.ok(modal && /지난 일정 보고 정리/.test(modal.title));
  const boxes = [...modal.body.matchAll(/data-pastrep-row="(\d+)"( checked)?/g)].map(m => ({ i: +m[1], checked: !!m[2] }));
  assert.deepEqual(boxes.map(x => x.checked), [true, false, true, false], 's1·s3(사진 있음)만 미리 체크');
  assert.match(modal.body, /그날 사진 2장/); assert.match(modal.body, /사진 없음/);
  ctx.document = { querySelectorAll: () => boxes.map(x => ({ checked: x.checked, dataset: { pastrepRow: String(x.i) } })) };
  const go = modal.btns.find(x => x.label === '완료로 기록');
  go.fn();
  assert.deepEqual(run("return state.schedule.filter(s=>s.report&&s.report.progress==='완료'&&s.report.filledAt).map(s=>s.id).sort();"), ['s1', 's3']);
  assert.match(toasts.join('\n'), /지난 일정 2건에 완료 보고를 남겼어요/);
  run("state.schedule.forEach(s=>{if(s.id==='s2'||s.id==='edge')s.report={done:'x',progress:'완료'};});");
  toasts = []; run('hjPastRepView();');
  assert.match(toasts.join('\n'), /보고를 남길 지난 일정이 없어요/);
  assert.equal(run('return hjPastRepBanner();'), '', '다 남기면 띠도 없음');
});

test('⑤ 연결 — 일정 탭에 띠 · 누르면 창 (WIRE)', () => {
  assert.match(appCode, /html\+=hjSchLinkBanner\(\);[^\n]*\n {2}html\+=hjPastRepBanner\(\);/, '일정 탭 — 현장 잇기 띠 다음');
  assert.match(appCode, /e\.target\.closest\('\[data-past-rep\]'\);if\(pastRepTarget\)return hjPastRepView\(\);/);
});

assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
console.log('pastreport-v623: ' + passed + '/5');
if (passed !== 5) process.exit(1);

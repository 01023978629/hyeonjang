/* v613 🧹 현장 단계 한 번에 정리 — 제안 계산(hjStageTidyPlan·hjStageTidyRule) 단위 검사 (분석 AD WA6)
   11/18 실자료: 현장 82곳 중 77곳이 단계 0(상담) — 🛡 파수꾼·보증·방치 현장은 stage 가 아니라 doneAt(준공일)을 보는데, 앱에서 '완료'를 누르면
   doneAt 이 오늘이 된다(setStage). 이 창은 받을 돈을 다 받은 현장을 '완료'로 제안하고 준공일을 근거 날짜(마지막 작업일 → 작업 날짜가 없으면 마지막 입금일)로 적는다.
   (v613 검토: 협력사 일괄 입금일을 준공일로 쓰면 작업이 끝난 날보다 최대 71일 늦어져 보증 기산일이 밀린다 — 입금일은 근거 글로만.)
   브라우저 없이 돈다: index.html 의 앱 스크립트를 통째로 VM 에 올려(화면·저장소·네트워크는 빈 껍데기) **진짜 projStats(청구·받은 돈·due)** 와 함께 센다.
   합성 자료만 — 실제 고객·금액·서버 없음, 쓰기 없음.
   ① 완납 → 완료 체크, 준공일 = 마지막 작업일(오늘·입금일 아님) · 마지막 입금일은 근거 글에 ② 부분 입금·입금 없음·돈 없이 작업만 → 체크 끈 완료(준공일 = 마지막 작업일), 앞으로 일정이면 시공
   ③ 보관·이미 단계 있음·이름 겹침 → 건드리지 않음 ④ 근거 없음(입금 날짜·작업일 없는 완납 · 상담 일정만 · 💰 일정만) → 뺌 ⑤ 앞으로 일정·입금 뒤 작업 → 체크 끔 ·
   예전 준공일 먼저 · 차례 ⑥ 읽기만(자료 불변) · 근거 글에 금액 없음 ⑦ hjStageTidyRule 순수 경계.
   앱 스크립트가 VM 에 안 올라가면(새 최상위 코드가 브라우저 API 를 부름) 아래 any()/ctx 에 그 이름을 더하라 — 검사를 끄지 마라.
   HJ_V612_STAGE_MUTATION=paid-any-due·today-done·pay-first·keep-archived·no-next-off·money-text 는 각각 의도한 단언에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'paid-any-due': ['  const paid=owed>0&&recv>0&&due<=0;\n', '  const paid=owed>0&&recv>0;\n'],
  'today-done': ["    const at=prev||lastWork||lastPay,src=prev?'prev':lastWork?'work':lastPay?'pay':'';", "    const at=localDate(),src='pay';"],
  'pay-first': ["    const at=prev||lastWork||lastPay,src=prev?'prev':lastWork?'work':lastPay?'pay':'';", "    const at=prev||lastPay||lastWork,src=prev?'prev':lastPay?'pay':lastWork?'work':'';"],
  'keep-archived': ['    if(p.archived){out.skip.archived++;return;}\n    if((Number(p.stage)||0)!==0){out.skip.staged++;return;}', '    if((Number(p.stage)||0)!==0){out.skip.staged++;return;}'],
  'no-next-off': ['on:!next&&!after,why:join([', 'on:true,why:join(['],
  'money-text': ["      '받을 돈을 다 받았어요'+(payN?'(입금 '+payN+'건)':''),", "      '받을 돈을 다 받았어요('+won(recv)+')',"]
};
if (process.env.HJ_V612_STAGE_MUTATION) {
  const m = MUT[process.env.HJ_V612_STAGE_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V612_STAGE_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor'); html = html.replace(m[0], () => m[1]);
}

// ── 앱 스크립트를 VM 에 — 화면·저장소·네트워크는 무엇이든 받아 주는 빈 껍데기 ──
function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const store = new Map(), noop = () => {};
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, queueMicrotask, Promise, Intl, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, performance, structuredClone,
    document: any('document'), navigator: any('navigator'), history: any('history'), indexedDB: any('indexedDB'), caches: any('caches'), visualViewport: any('vv'),
    Notification: any('Notification'), speechSynthesis: any('ss'), getSelection: () => any('sel'), getComputedStyle: () => any('cs'),
    location: { href: 'http://127.0.0.1/index.html', search: '', hash: '', pathname: '/index.html', origin: 'http://127.0.0.1', protocol: 'http:', hostname: '127.0.0.1', reload: noop, replace: noop },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    fetch: () => new Promise(noop), addEventListener: noop, removeEventListener: noop, screen: { width: 1280, height: 800 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
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
const run = (src, data) => { ctx.__IN__ = data === undefined ? null : JSON.parse(JSON.stringify(data)); return vm.runInContext(src, ctx); };
const TODAY = '2026-11-19';

// 합성 자료 — 오늘 11/19(목). 작업내역서 견적(수주)·입금 기록은 앱의 반영·입금 길과 같은 꼴(q.stmt·payLog d/project/amt).
const stmtQuote = (id, project, total, lineDays, extra = {}) => ({
  id, no: 'T-' + id, title: project + ' 작업내역서', project, date: '2026-10-31', result: 'won', vatIncluded: true, accountIdx: null,
  items: [{ name: '작업', spec: '', qty: 1, price: Math.round(total / 1.1) }],
  stmt: { v: 1, doc: '작업내역서', to: '시험 협력사', date: '2026-10-31', file: 'T.xlsx', key: 'T.xlsx#' + project, vat: 'included', total, src: 'T.xlsx',
    lines: lineDays.map(d => ({ d, loc: project, work: '작업', amt: Math.round(total / lineDays.length) })) }, ...extra
});
const proj = (name, extra = {}) => ({ name, stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, ...extra });
function seed() {
  return {
    projects: [
      proj('완납현장', { received: 1100000 }),
      proj('부분입금', { received: 300000 }),
      proj('보관현장', { archived: true, received: 550000 }),
      proj('시공중', { stage: 2, received: 550000 }),
      proj('입금없음'),
      proj('빈현장'),
      proj('이어짐', { received: 440000 }),
      proj('입금뒤작업', { received: 330000 }),
      proj('날짜없음', { received: 770000 }),
      proj('예전준공', { received: 220000, doneAtPrev: '2026-08-01' }),
      proj('사진만'),
      proj('상담일정'),
      proj('하는중'),
      proj('겹침', { received: 110000 }), proj('겹침', { received: 110000 }),
      proj('받기만', { received: 50000 })
    ],
    quotes: [
      stmtQuote(1, '완납현장', 1100000, ['2026-10-20', '2026-10-22']),
      stmtQuote(2, '부분입금', 1000000, ['2026-10-15']),
      stmtQuote(3, '보관현장', 550000, ['2026-09-10']),
      stmtQuote(4, '시공중', 550000, ['2026-09-11']),
      stmtQuote(5, '입금없음', 500000, ['2026-10-01']),
      stmtQuote(6, '이어짐', 440000, ['2026-10-05']),
      stmtQuote(7, '입금뒤작업', 330000, ['2026-10-06']),
      stmtQuote(9, '예전준공', 220000, ['2026-07-30']),
      stmtQuote(10, '겹침', 110000, ['2026-10-09'])
    ],
    files: [
      // 앱 견적이 아닌 견적서 파일(금액만) — 날짜 기록 없는 완납
      { id: 'est-x', name: '날짜없음 견적서.pdf', ext: 'pdf', kind: 'estimate', project: '날짜없음', est: { amount: 770000, supply: 700000, vat: 70000, customer: '시험' } },
      { id: 'ph-1', name: 'a.jpg', ext: 'jpg', kind: 'photo', project: '사진만', when: '2026-09-03T05:00:00.000Z', _worklabel: '타일 시공' },
      { id: 'ph-2', name: 'b.jpg', ext: 'jpg', kind: 'photo', project: '사진만', when: '2026-09-01T05:00:00.000Z', _worklabel: '실측' },
      { id: 'ph-3', name: 'c.jpg', ext: 'jpg', kind: 'photo', project: '빈현장', when: '2026-09-04T05:00:00.000Z', _worklabel: '현장 확인' }
    ],
    payLog: [
      { d: '2026-11-05', project: '완납현장', amt: 600000, stmt: 'T.xlsx' },
      { d: '2026-11-10', project: '완납현장', amt: 500000, stmt: 'T.xlsx' },
      { d: '2026-11-03', project: '부분입금', amt: 300000 },
      { d: '2026-11-04', project: '이어짐', amt: 440000 },
      { d: '2026-11-05', project: '입금뒤작업', amt: 330000 },
      { d: '2026-11-06', project: '예전준공', amt: 220000 },
      { d: '2026-11-07', project: '보관현장', amt: 550000 },
      { d: '2026-11-08', project: '시공중', amt: 550000 },
      { d: '2026-11-09', project: '겹침', amt: 110000 },
      { d: '2026-11-02', project: '받기만', amt: 50000 },
      { d: '2026-11-25', project: '부분입금', amt: 1 }   // 오늘 뒤 입금 기록은 근거가 아니다
    ],
    schedule: [
      { id: 's1', date: '2026-11-25', time: '', title: '추가 세대 방수', project: '이어짐', hours: 8, memo: '', report: null },
      { id: 's2', date: '2026-11-15', time: '', title: '타일 보수', project: '입금뒤작업', hours: 4, memo: '', report: null },
      { id: 's3', date: '2026-10-10', time: '', title: '실측 방문', project: '상담일정', hours: 1, memo: '', report: null },
      { id: 's4', date: '2026-10-12', time: '', title: '💰 잔금 받기', project: '상담일정', hours: 0, memo: '', report: null },
      { id: 's5', date: '2026-11-10', time: '', title: '도배', project: '하는중', hours: 8, memo: '', report: null },
      { id: 's6', date: '2026-11-21', time: '', title: '장판', project: '하는중', hours: 8, memo: '', report: null },
      { id: 's7', date: '2026-11-12', time: '', title: '확인 방문', project: '받기만', hours: 1, memo: '', report: null }
    ]
  };
}
const PLAN = `(()=>{const d=__IN__;state.projects=d.projects;state.quotes=d.quotes;state.files=d.files;state.payLog=d.payLog;state.schedule=d.schedule;state.goals={};
  state.quotes.forEach(q=>{if(q&&q.project)syncQuoteToProject(q);});   // 앱 견적 → 견적 파일(가상) — 견적 저장·반영 길과 같은 함수
  const before=JSON.stringify({p:state.projects,q:state.quotes,f:state.files,l:state.payLog,s:state.schedule});
  const plan=hjStageTidyPlan({today:'${TODAY}'});
  const after=JSON.stringify({p:state.projects,q:state.quotes,f:state.files,l:state.payLog,s:state.schedule});
  return JSON.stringify({plan,same:before===after,stats:Object.fromEntries(['완납현장','부분입금','입금없음'].map(n=>{const s=projStats(n);return [n,{bill:s.bill,recv:s.recv,due:s.due}];}))});})()`;

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS stagetidy-v612 ' + name); }
const out = JSON.parse(run(PLAN, seed()));
const plan = out.plan, row = n => plan.rows.find(r => r.name === n), left = n => plan.left.find(r => r.name === n);

test('⓪ 진짜 projStats — 내역서 견적의 청구·받은 돈·due 를 그대로 씀', () => {
  assert.deepEqual(out.stats['완납현장'], { bill: 1100000, recv: 1100000, due: 0 }, '완납 ' + JSON.stringify(out.stats));
  assert.equal(out.stats['부분입금'].due > 0, true, '부분 입금은 due>0');
  assert.equal(out.stats['입금없음'].recv, 0, '입금 없음');
});

test('① 완납 → 완료 체크 · 준공일 = 마지막 작업일(오늘·입금일 아님) · 입금일은 근거 글에', () => {
  const r = row('완납현장');
  assert.ok(r, '완납현장 줄');
  assert.deepEqual([r.kind, r.to, r.on, r.doneAt, r.src], ['paid', 3, true, '2026-10-22', 'work'], '작업 10/20·10/22 · 입금 11/05·11/10 → 준공일은 작업이 끝난 10/22 ' + JSON.stringify(r));
  assert.notEqual(r.doneAt, TODAY, '준공일이 오늘이 아님');
  assert.notEqual(r.doneAt, r.lastPay, '준공일이 입금일이 아님(보증 기산일이 밀리지 않게)');
  assert.match(r.why, /받을 돈을 다 받았어요\(입금 2건\)/, r.why);
  assert.match(r.why, /완료일 = 마지막 작업일/, r.why);
  assert.match(r.why, /마지막 작업 10\/22\(목\)\(작업내역서\)/, r.why);
  assert.match(r.why, /마지막 입금 11\/10\(화\)/, '입금일은 근거 글로 ' + r.why);
});

test('② 부분 입금·입금 없음·돈 없이 작업만 → 체크 끈 완료(준공일 = 마지막 작업일) · 앞으로 일정이면 시공', () => {
  const p = row('부분입금'), u = row('입금없음'), w = row('사진만'), g = row('하는중'), o = row('받기만');
  assert.deepEqual([p.kind, p.to, p.on, p.doneAt], ['partial', 3, false, '2026-10-15'], '부분 입금 ' + JSON.stringify(p));
  assert.match(p.why, /일부만 입금했어요\(입금 1건\)/, p.why);
  assert.deepEqual([u.kind, u.to, u.on, u.doneAt], ['unpaid', 3, false, '2026-10-01'], '입금 없음 ' + JSON.stringify(u));
  assert.match(u.why, /청구는 있는데 입금 기록이 없어요/, u.why);
  assert.deepEqual([w.kind, w.to, w.on, w.doneAt, w.workSrc], ['work', 3, false, '2026-09-03', '작업 사진'], '작업 사진만(실측 사진은 작업이 아님) ' + JSON.stringify(w));
  assert.deepEqual([g.kind, g.to, g.on, g.doneAt, g.next], ['work', 2, false, '', '2026-11-21'], '앞으로 일정 → 시공 ' + JSON.stringify(g));
  assert.deepEqual([o.kind, o.to, o.on, o.doneAt], ['payonly', 3, false, '2026-11-12'], '금액 없이 입금만(확인 방문 일정은 작업으로 셈) ' + JSON.stringify(o));
});

test('③ 보관·이미 단계 있음·이름 겹침 → 건드리지 않음', () => {
  for (const n of ['보관현장', '시공중', '겹침']) assert.ok(!row(n) && !left(n), n + ' 은 목록에 없음');
  assert.deepEqual(plan.skip, { archived: 1, staged: 1, dup: 2 }, JSON.stringify(plan.skip));
});

test('④ 근거 없음 → 뺌(이름과 까닭만)', () => {
  assert.deepEqual(plan.left.map(r => [r.name, r.kind]), [['날짜없음', 'paid'], ['빈현장', 'none'], ['상담일정', 'none']], JSON.stringify(plan.left.map(r => [r.name, r.kind, r.why])));
  assert.match(left('날짜없음').why, /입금일·작업일 기록이 없어요/);
  assert.match(left('빈현장').why, /돈·작업 기록이 없어요/, '현장 확인 사진은 작업이 아님');
  assert.match(left('상담일정').why, /돈·작업 기록이 없어요/, '실측 일정·💰 일정은 작업이 아님');
});

test('⑤ 앞으로 일정·입금 뒤 작업 → 체크 끔 · 예전 준공일 먼저 · 차례', () => {
  const n = row('이어짐'), a = row('입금뒤작업'), v = row('예전준공');
  assert.deepEqual([n.kind, n.to, n.on, n.doneAt, n.next], ['paid', 3, false, '2026-10-05', '2026-11-25'], '앞으로 일정 ' + JSON.stringify(n));
  assert.match(n.why, /이어지는 공사면 체크하지 마세요/, n.why);
  assert.deepEqual([a.kind, a.on, a.doneAt, a.lastWork, a.lastPay], ['paid', false, '2026-11-15', '2026-11-15', '2026-11-05'], '입금 뒤 작업 — 준공일 칸은 마지막 작업일, 체크는 끔 ' + JSON.stringify(a));
  assert.match(a.why, /마지막 입금 뒤에도 작업 기록이 있어요/, a.why);
  assert.deepEqual([v.kind, v.on, v.doneAt, v.src], ['paid', true, '2026-08-01', 'prev'], '예전 준공일 ' + JSON.stringify(v));
  assert.deepEqual(plan.rows.map(r => r.name), ['예전준공', '완납현장', '이어짐', '입금뒤작업', '부분입금', '입금없음', '받기만', '사진만', '하는중'], '체크한 줄 먼저 → 완납·부분·없음·입금만·작업만 → 완료 먼저 → 가나다 ' + JSON.stringify(plan.rows.map(r => r.name)));
  assert.equal(plan.on, 2, '체크해 둘 줄 2');
});

test('⑥ 읽기만 · 오늘 준공일 없음 · 근거 글에 금액 없음', () => {
  assert.equal(out.same, true, '자료 불변');
  for (const r of plan.rows) {
    assert.notEqual(r.doneAt, TODAY, r.name + ' 준공일이 오늘');
    assert.ok(!/\d[\d,]*\s*원|미수/.test(r.why), r.name + ' 근거에 금액·미수 ' + r.why);
  }
  for (const r of plan.left) assert.ok(!/\d[\d,]*\s*원|미수/.test(r.why), r.name + ' ' + r.why);
});

test('⑦ hjStageTidyRule 순수 경계', () => {
  const rule = f => JSON.parse(run('JSON.stringify(hjStageTidyRule(__IN__))', f));
  assert.deepEqual(rule({}), { kind: 'none', to: null, why: '돈·작업 기록이 없어요' });
  const over = rule({ owed: 100, recv: 150, due: 0, payN: 2, lastPay: '2026-11-01' });
  assert.deepEqual([over.kind, over.to, over.on, over.doneAt, over.src], ['paid', 3, true, '2026-11-01', 'pay'], '더 받아도 완납 · 작업 날짜가 없으면 마지막 입금일 ' + JSON.stringify(over));
  assert.match(over.why, /완료일 = 마지막 입금일\(작업 날짜 기록 없음\)/, over.why);
  const nopay = rule({ owed: 100, recv: 100, due: 0, lastWork: '2026-10-01', workSrc: '일정' });
  assert.deepEqual([nopay.to, nopay.on, nopay.doneAt, nopay.src], [3, true, '2026-10-01', 'work'], '입금 날짜 없으면 마지막 작업일 ' + JSON.stringify(nopay));
  assert.match(nopay.why, /완료일 = 마지막 작업일/);
  const both = rule({ owed: 100, recv: 100, due: 0, payN: 1, lastPay: '2026-11-11', lastWork: '2026-09-01', workSrc: '작업내역서' });
  assert.deepEqual([both.on, both.doneAt, both.src], [true, '2026-09-01', 'work'], '작업 9/1 · 입금 11/11(71일 뒤) → 준공일 9/1 ' + JSON.stringify(both));
  assert.match(both.why, /마지막 작업 9\/1\([^)]+\)\(작업내역서\) · 마지막 입금 11\/11/, both.why);
  const owedZero = rule({ owed: 0, recv: 0, due: 0, prev: '2026-05-05' });
  assert.deepEqual([owedZero.kind, owedZero.to, owedZero.doneAt, owedZero.on], ['work', 3, '2026-05-05', false], '예전 준공일만 ' + JSON.stringify(owedZero));
  const bad = rule({ owed: 100, recv: 100, due: 0, lastPay: '11/5', lastWork: 'x' });
  assert.equal(bad.to, null, '날짜 꼴이 아니면 근거가 아님 ' + JSON.stringify(bad));
  assert.equal(rule({ owed: 100, recv: 0, due: 100, next: '2026-12-01' }).to, null, '작업한 날 없이 앞으로 일정만이면 제안 안 함');
});

console.log('stagetidy-v612: ' + passed + '/8');
if (passed !== 8) process.exit(1);

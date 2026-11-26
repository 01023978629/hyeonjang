/* v628 대표 요청(11/27) "현장웹에 내역서가 월 분류가 잘못되었어 내역서에 미 포함 이나 금액 수정 기능 추가해줘".
   ① 월 = 줄의 작업 날짜(hjStmtQuoteMonths): 한 내역서가 두 달이면 두 달 조각, 조각 합 = 견적 합계(1원까지) · 작성일보다 늦은 날짜는 작성 월 + ⚠(hjStmtLineOdd)
   ② 미포함(skip) = 0원(hjStmtLineAmt) — 단가 다시·손으로 고친 견적 판정이 같은 셈 · 줄을 모두 뺀 0원 견적은 조각 없음
   ③ 줄 고치기 미리 셈(hjStmtLineEditPlan): 금액·날짜·미포함 → 사본만(원본 견적 불변) · d0/amt0 는 파일 값 한 번만, 파일 값으로 되돌리면 지움 ·
      막는 것(오래된 창·견적 작성 화면·손으로 고친 견적·날짜 꼴·미래·마이너스·빈 금액·바뀐 것 없음) · 받은 돈이 많아져도 막지 않고 over 로 알림 · 부가세 별도 내역서
   ④ 같은 파일 다시 넣기(hjStmtClassify): 날짜·금액을 고친 줄·미포함 줄도 '이미 든 줄'
   ⑤ 날짜 권하기(hjStmtLineDaySuggest): 한 달 앞 같은 날 무렵에 그 현장 사진이 있을 때만 · ⑥ 장부(hjStmtLedger) odd·skipN·over
   브라우저 없이 돈다: index.html 에서 함수를 떼어 VM 에서 부른다(현장·금액은 시험용 가짜).
   변이(HJ_V628_MUTATION): month-by-stmt · odd-ignored · skip-counted · rest-dropped · no-amt0 · classify-cur-only · no-future-check · no-edited-guard · names-strict · over-blocks · neg-blocked · no-digit-check · revblock-skip */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const MUT = {
  'month-by-stmt': ['const ym=ymOf(hjStmtLineDay(l,date))||fall;', 'const ym=fall;'],
  'odd-ignored': ["return /^\\d{4}-\\d{2}-\\d{2}$/.test(d)&&!hjStmtLineOdd(l,date)?d:String(date||'');", "return /^\\d{4}-\\d{2}-\\d{2}$/.test(d)?d:String(date||'');"],
  'skip-counted': ['function hjStmtLineAmt(l){return !l||l.skip?0:Math.round(num(l.amt));}', 'function hjStmtLineAmt(l){return !l?0:Math.round(num(l.amt));}'],
  'rest-dropped': ['ms.slice().sort((a,b)=>b.w-a.w||a.ym.localeCompare(b.ym)).forEach(m=>{if(rest>0){m.amount++;rest--;}});', ''],
  'no-amt0': ['cl.amt=amt;if(amt===o0)delete cl.amt0;else cl.amt0=o0;', 'cl.amt=amt;delete cl.amt0;'],
  'classify-cur-only': ['ids=[...new Set([hjStmtLineId(o),hjStmtLineId(l)])]', 'ids=[hjStmtLineId(l)]'],
  'no-future-check': ["  if(d>today&&d!==was.d)return {why:", "  if(false)return {why:"],
  'neg-blocked': ['if(neg&&amt!==was.amt)return', 'if(neg)return'],
  'no-digit-check': ["if(typeof raw!=='number'&&/[^\\d,\\s원\\-−–—－]/.test(String(raw)))return", 'if(false)return'],
  'no-edited-guard': ['const ed=hjStmtQuoteEdited(q,1,true);if(ed)return', "const ed='';if(ed)return"],
  'names-strict': ['const ed=hjStmtQuoteEdited(q,1,true);if(ed)return', 'const ed=hjStmtQuoteEdited(q,1);if(ed)return'],
  'revblock-skip': ["  if(e.l&&e.l.skip)return '내역서에서 뺀(미포함) 줄이에요", "  if(false)return '내역서에서 뺀(미포함) 줄이에요"],
  'over-blocks': ['  const srcAfter=srcBefore+(counted?after-before:0),changes=[];', "  const srcAfter=srcBefore+(counted?after-before:0),changes=[];if(paidSrc>srcAfter)return {why:'받은 돈보다 적어요'};"],
};
if (process.env.HJ_V628_MUTATION) {
  const m = MUT[process.env.HJ_V628_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V628_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V628_MUTATION); html = html.replace(m[0], () => m[1]);
}
function grab(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 이 없다');
  let i = html.indexOf('{', html.indexOf(')', at)), depth = 0, q = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && html[i + 1] === '/' ) { i = html.indexOf('\n', i); continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
  }
  return html.slice(at, i + 1);
}
const NAMES = ['num', 'ymOf', 'won2num', 'hjIsNegativeAmount', 'hjNum', 'hjStmtCell', 'hjStmtKey', 'hjStmtMd', 'hjStmtSrcOf', 'hjStmtLineId', 'hjStmtLineKey',
  'hjStmtLineAmt', 'hjStmtLineOrig', 'hjStmtLineOdd', 'hjStmtLineDay', 'hjStmtQuoteMonths', 'hjStmtShiftMonthDay', 'hjStmtLineDaySuggest', 'hjStmtQuoteById',
  'hjStmtLineEditPlan', 'hjStmtPrices', 'quoteSupplyForTotal', 'quoteCalc', 'hjStmtGross', 'hjStmtReprice', 'hjStmtQuoteEdited', 'hjStmtClassify',
  'hjStmtBuildQuote', 'hjStmtLedger', 'hjStmtPhotoCount', 'hjAddDays', 'hjYmd', 'pad2', 'hjStmtRevBlock'];
const TODAY = '2026-11-27';
const ctx = vm.createContext({ state: {}, __tabStale: false, localDate: () => TODAY, uid: (() => { let n = 0; return () => 'q' + (++n); })(), hjQuoteNextNo: () => '제1',
  PHOTOS: new Map(), hjStmtPhotoIndex() { return this.PHOTOS; } });
ctx.hjStmtPhotoIndex = () => ctx.PHOTOS;
const src = NAMES.map(n => { try { return grab(n); } catch (e) { if (n === 'pad2') return 'function pad2(n){return String(n).padStart(2,"0");}'; throw e; } }).join('\n');
vm.runInContext(src + '\n' + NAMES.map(n => `this.${n}=${n};`).join(''), ctx);
const X = ctx;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS stmtedit-v628 ' + name); }
const L = (d, loc, work, amt) => ({ d, loc, work, amt });
const build = (src, project, date, lines, vat = 'included', to = '시험누수') => X.hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat, project, lines });
const seed = (quotes, payLog = []) => { X.state = { quotes, payLog, projects: [], files: [] }; X.state.editingQuote = null; ctx.state = X.state; vm.runInContext('state=this.state', ctx); };
// VM 안의 state 와 바깥 객체를 같게
vm.runInContext('var state=this.state;', ctx);
function setState(quotes, payLog = []) { ctx.state = { quotes, payLog, projects: [], files: [], editingQuote: null }; vm.runInContext('state=this.state;', ctx); return ctx.state; }
const clone = o => JSON.parse(JSON.stringify(o));

test('① 두 달에 걸친 내역서는 작업한 달 조각 — 합 = 견적 합계', () => {
  const q = build('A.xlsx', '가온아파트', '2026-10-13', [L('2026-09-21', '가온아파트 28-708', '우수관 2개 작업', 400000), L('2026-09-21', '가온아파트 28-708', '세탁기 육가 작업', 100000), L('2026-10-02', '가온아파트 28-708', '부분 줄눈', 50000)]);
  setState([q]);
  const ms = X.hjStmtQuoteMonths(q).map(m => [m.ym, m.amount, m.lines.map(x => x.i)]);
  assert.deepEqual(JSON.parse(JSON.stringify(ms)), [['2026-09', 500000, [0, 1]], ['2026-10', 50000, [2]]]);
  assert.equal(X.quoteCalc(q).total, 550000);
  const one = build('B.xlsx', '나래아파트', '2026-10-30', [L('2026-10-13', '나래 6-501', '온냉수 교체', 1800000)]);
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(one).map(m => [m.ym, m.amount]))), [['2026-10', 1800000]]);
  // 줄이 없는 견적 = 작성 월 한 조각
  const bare = clone(one); bare.stmt.lines = [];
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(bare, 1800000).map(m => [m.ym, m.amount]))), [['2026-10', 1800000]]);
});

test('① 작성일보다 늦은 작업 날짜 = 작성 월 + ⚠ · 날짜 없는 줄 = 작성 월', () => {
  const q = build('S917.xlsx', '다솜아파트', '2026-09-17', [L('2026-09-09', '다솜 101동 1302호', '수도관 누수', 1000000), L('2026-10-15', '다솜 21동 1203호', '우수관 2개', 400000)]);
  setState([q]);
  assert.equal(X.hjStmtLineOdd(q.stmt.lines[1], q.stmt.date), true);
  assert.equal(X.hjStmtLineOdd(q.stmt.lines[0], q.stmt.date), false);
  assert.equal(X.hjStmtLineDay(q.stmt.lines[1], q.stmt.date), '2026-09-17');
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(q).map(m => [m.ym, m.amount]))), [['2026-09', 1400000]]);
  const nd = build('D.xlsx', '라온', '2026-09-29', [L('', '라온 602동 1003호', '화장실 방수', 900000), L('', '라온', '샤워기(서비스)', 0)]);
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(nd).map(m => [m.ym, m.amount, m.lines.length]))), [['2026-09', 900000, 2]]);
});

test('① 부가세 별도·나머지 원 — 조각 합이 늘 견적 합계', () => {
  const q = build('T.xlsx', '마루', '2026-10-31', [L('2026-09-30', '마루', '우수관', 100001), L('2026-10-01', '마루', '우수관', 100001), L('2026-10-02', '마루', '지하', 100001)], 'separate', '장시험');
  setState([q]);
  const tot = X.quoteCalc(q).total, ms = X.hjStmtQuoteMonths(q);
  assert.equal(tot, 330003);
  assert.equal(ms.reduce((a, m) => a + m.amount, 0), tot, '조각 합 = 합계');
  assert.deepEqual(JSON.parse(JSON.stringify(ms.map(m => m.ym))), ['2026-09', '2026-10']);
  assert.equal(ms[1].amount, 220002, '큰 달이 나머지 원');
  // 손으로 합계가 줄어든 견적(hand) — 그래도 합 = 받은 total
  const ms2 = X.hjStmtQuoteMonths(q, 100000);
  assert.equal(ms2.reduce((a, m) => a + m.amount, 0), 100000);
});

test('② 미포함 줄 = 0원 — 단가 다시 · 손으로 고친 견적 아님 · 모두 빼면 조각 없음', () => {
  const q = build('A.xlsx', '가온아파트', '2026-10-13', [L('2026-10-02', '가온', '우수관 1개', 220000), L('2026-10-05', '가온', '줄눈', 50000)]);
  setState([q]);
  const c = clone(q); c.stmt.lines[1].skip = true; X.hjStmtReprice(c);
  assert.equal(c.items[1].price, 0);
  assert.equal(X.quoteCalc(c).total, 220000);
  assert.equal(c.stmt.total, 220000);
  assert.equal(X.hjStmtQuoteEdited(c, 1), '', '미포함으로 다시 단가 낸 견적은 손으로 고친 견적이 아니다');
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(c).map(m => [m.ym, m.amount, m.lines.length]))), [['2026-10', 220000, 1]]);
  const all = clone(q); all.stmt.lines.forEach(l => { l.skip = true; }); X.hjStmtReprice(all);
  assert.equal(X.quoteCalc(all).total, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(X.hjStmtQuoteMonths(all))), []);
});

test('③ 금액 고치기 — 사본만 · amt0 한 번 · 파일 값으로 되돌리면 지움 · 내역서 합계', () => {
  const a = build('A.xlsx', '가온아파트', '2026-10-13', [L('2026-10-02', '가온', '우수관 1개', 220000), L('2026-10-05', '가온', '줄눈', 50000)]);
  const b = build('A.xlsx', '나래아파트', '2026-10-13', [L('2026-10-07', '나래', '수도 배관', 150000)]);
  setState([a, b]);
  const before = clone(a);
  const P = X.hjStmtLineEditPlan(a.id, 0, { d: '2026-10-02', amt: '200,000', skip: false });
  assert.equal(P.why, undefined, P.why);
  assert.deepEqual(clone(a), before, '원본 견적은 그대로(미리 셈)');
  assert.deepEqual([P.before, P.after, P.srcBefore, P.srcAfter, P.over], [270000, 250000, 420000, 400000, 0]);
  assert.equal(P.c.stmt.lines[0].amt, 200000); assert.equal(P.c.stmt.lines[0].amt0, 220000); assert.equal(P.c.stmt.lines[0].edAt, '2026-11-27');
  assert.equal(P.c.stmt.total, 250000); assert.equal(X.hjStmtQuoteEdited(P.c, 1), '');
  assert.deepEqual(JSON.parse(JSON.stringify(P.changes)), ['금액 220,000→200,000원']);
  // 고친 줄을 다시 고쳐도 파일 값은 처음 것
  a.stmt = P.c.stmt; a.items = P.c.items;
  const P2 = X.hjStmtLineEditPlan(a.id, 0, { d: '2026-10-02', amt: '180000', skip: false });
  assert.equal(P2.c.stmt.lines[0].amt0, 220000);
  // 파일 값으로 되돌리면 amt0·edAt 지움
  const P3 = X.hjStmtLineEditPlan(a.id, 0, { d: '2026-10-02', amt: '220000', skip: false });
  assert.equal(P3.why, undefined);
  assert.equal('amt0' in P3.c.stmt.lines[0], false); assert.equal('edAt' in P3.c.stmt.lines[0], false);
  assert.equal(P3.after, 270000);
});

test('③ 날짜 고치기(10/15 → 9/15) — d0 · 품목 규격 날짜 · 달이 옮겨짐', () => {
  const q = build('S917.xlsx', '다솜아파트', '2026-09-17', [L('2026-09-09', '다솜 101동', '수도관 누수', 1000000), L('2026-10-15', '다솜 21동 1203호', '우수관 2개', 400000)]);
  setState([q]);
  const P = X.hjStmtLineEditPlan(q.id, 1, { d: '2026-09-15', amt: 400000, skip: false });
  assert.equal(P.why, undefined, P.why);
  assert.equal(P.c.stmt.lines[1].d, '2026-09-15'); assert.equal(P.c.stmt.lines[1].d0, '2026-10-15');
  assert.ok(P.c.items[1].spec.startsWith('9/15 '), P.c.items[1].spec);
  assert.equal(P.before, P.after, '금액 그대로');
  assert.equal(X.hjStmtLineOdd(P.c.stmt.lines[1], P.c.stmt.date), false);
  assert.deepEqual(JSON.parse(JSON.stringify(P.changes)), ['날짜 10/15→9/15']);
});

test('③ 미포함 — 받은 돈이 많아져도 막지 않고 over 로 알린다', () => {
  const q = build('A.xlsx', '가온아파트', '2026-10-13', [L('2026-10-02', '가온', '우수관 1개', 220000), L('2026-10-05', '가온', '줄눈', 50000)]);
  setState([q], [{ d: '2026-11-05', project: '가온아파트', amt: 270000, stmt: 'A.xlsx', stmtPay: 'spx1' }]);
  const P = X.hjStmtLineEditPlan(q.id, 1, { d: '2026-10-05', amt: '50000', skip: true });
  assert.equal(P.why, undefined, P.why);
  assert.deepEqual([P.after, P.paidSrc, P.over], [220000, 270000, 50000]);
  assert.equal(P.c.stmt.lines[1].skip, true); assert.equal(P.c.stmt.lines[1].amt, 50000, '금액 칸은 남김');
  assert.deepEqual(JSON.parse(JSON.stringify(P.changes)), ['내역서에서 뺌(미포함)']);
  // 다시 넣기
  q.stmt = P.c.stmt; q.items = P.c.items;
  const back = X.hjStmtLineEditPlan(q.id, 1, { d: '2026-10-05', amt: '50000', skip: false });
  assert.equal(back.after, 270000); assert.equal('skip' in back.c.stmt.lines[1], false); assert.equal('edAt' in back.c.stmt.lines[1], false);
});

test('③ 막는 것 — 쓰기 전에', () => {
  const q = build('A.xlsx', '가온아파트', '2026-10-13', [L('2026-10-02', '가온', '우수관 1개', 220000)]);
  const st = setState([q]);
  const why = o => X.hjStmtLineEditPlan(q.id, 0, Object.assign({ d: '2026-10-02', amt: '220000', skip: false }, o)).why || '';
  assert.match(why({ d: '2026-12-01' }), /미래/);
  assert.match(why({ d: '2026-10-2' }), /날짜를 확인/);
  assert.match(why({ amt: '-10,000' }), /마이너스/);
  assert.match(why({ amt: '' }), /금액을 넣으세요/);
  assert.match(why({}), /바뀐 것이 없어요/);
  assert.match(X.hjStmtLineEditPlan(q.id, 5, { amt: '1' }).why, /찾지 못했어요/);
  assert.match(X.hjStmtLineEditPlan('없음', 0, { amt: '1' }).why, /찾지 못했어요/);
  st.editingQuote = { id: q.id }; assert.match(why({ amt: '1' }), /견적 작성 화면/); st.editingQuote = null;
  vm.runInContext('__tabStale=true', ctx); assert.match(why({ amt: '1' }), /오래된 창/); vm.runInContext('__tabStale=false', ctx);
  const hand = clone(q); hand.id = 'H'; hand.items[0].price = 100000; st.quotes.push(hand);
  assert.match(X.hjStmtLineEditPlan('H', 0, { d: '2026-10-02', amt: '1', skip: false }).why, /손으로 고친 견적/);
  assert.equal(why({ amt: '0' }), '', '0원은 된다');
  assert.match(why({ amt: '120만' }), /숫자로만/); assert.match(why({ amt: '1.5' }), /숫자로만/);
  // 할인 줄(-50,000) — 금액을 그대로 두면 날짜·빼기는 된다, 다른 마이너스는 안 됨
  const dc = build('DC.xlsx', '나래', '2026-10-13', [L('2026-10-02', '나래', '우수관', 220000), L('2026-10-02', '나래', '할인', -20000)]); dc.id = 'DC'; st.quotes.push(dc);
  const pd = X.hjStmtLineEditPlan('DC', 1, { d: '2026-10-03', amt: '-20,000', skip: false });
  assert.equal(pd.why, undefined, pd.why); assert.equal(pd.c.stmt.lines[1].amt, -20000); assert.equal(pd.after, 200000);
  assert.equal(X.hjStmtLineEditPlan('DC', 1, { d: '2026-10-02', amt: '-20000', skip: true }).after, 220000, '할인 줄 빼기');
  assert.match(X.hjStmtLineEditPlan('DC', 1, { d: '2026-10-02', amt: '-30,000', skip: false }).why, /마이너스/);
  // 파일에 미래로 잘못 적힌 날짜 — 그대로 두면 빼기는 된다
  const fu = build('FU.xlsx', '라온', '2026-10-13', [L('2027-10-02', '라온', '우수관', 100000)]); fu.id = 'FU'; st.quotes.push(fu);
  assert.equal(X.hjStmtLineEditPlan('FU', 0, { d: '2027-10-02', amt: '100000', skip: true }).why, undefined);
  // 품목 이름만 짧게 줄인 견적(수량 1·단가 = 줄 금액에서) — 이름은 안 바꾸므로 고칠 수 있다 / 수량을 바꾼 견적은 막는다
  const nm = clone(q); nm.id = 'N'; nm.items[0].name = '우수관'; st.quotes.push(nm);
  const pn = X.hjStmtLineEditPlan('N', 0, { d: '2026-10-02', amt: '200000', skip: false });
  assert.equal(pn.why, undefined, pn.why); assert.equal(pn.c.items[0].name, '우수관', '품목 이름은 그대로');
  const qt = clone(q); qt.id = 'Q2'; qt.items[0].qty = 2; qt.items[0].price = 100000; st.quotes.push(qt);
  assert.match(X.hjStmtLineEditPlan('Q2', 0, { d: '2026-10-02', amt: '1', skip: false }).why, /손으로 고친 견적/);
});

test('③ 부가세 별도 내역서 — 줄 = 공급가, 합계 = +10%', () => {
  const q = build('T.xlsx', '마루', '2026-09-01', [L('2026-09-01', '마루', '우수관', 220000)], 'separate', '장시험');
  setState([q]);
  const P = X.hjStmtLineEditPlan(q.id, 0, { d: '2026-09-01', amt: '200000', skip: false });
  assert.equal(P.why, undefined, P.why);
  assert.deepEqual([P.before, P.after], [242000, 220000]);
  assert.equal(P.c.items[0].price, 200000);
});

test('④ 같은 파일 다시 넣기 — 고친 줄·미포함 줄도 이미 든 줄', () => {
  const lines = [L('2026-10-15', '다솜 21동', '우수관 2개', 400000), L('2026-09-09', '다솜 101동', '수도관 누수', 1000000), L('2026-09-11', '다솜 3동', '우수관 1개', 220000)];
  const q = build('S917.xlsx', '다솜아파트', '2026-09-17', clone(lines));
  setState([q]);
  q.stmt.lines[0].d0 = '2026-10-15'; q.stmt.lines[0].d = '2026-09-15';      // 날짜 고침
  q.stmt.lines[1].amt0 = 1000000; q.stmt.lines[1].amt = 900000;            // 금액 고침
  q.stmt.lines[2].skip = true;                                            // 미포함
  X.hjStmtReprice(q);                                                     // 앱처럼 단가도 다시(손으로 고친 견적이 아님)
  const r = X.hjStmtClassify(clone(lines));
  assert.equal(r.dup.size, 3, '파일 줄 셋 다 이미 든 줄');
  assert.equal(r.rev.size, 0);
  // 고친 값 그대로 적은 수정본도 이미 든 줄(지금 값으로)
  const r2 = X.hjStmtClassify([L('2026-09-15', '다솜 21동', '우수관 2개', 400000)]);
  assert.equal(r2.dup.size, 1);
  // 금액만 다른 새 수정본 — 원래 열쇠로 '금액만 다른 줄' 후보
  const r3 = X.hjStmtClassify([L('2026-09-09', '다솜 101동', '수도관 누수', 950000)]);
  assert.equal(r3.dup.size, 0); assert.equal(r3.rev.size, 1);
  // 수정본 금액이 미포함 줄에 닿으면 기본값 '바꾸기' 없이 고르게(바꾸면 다시 넣음)
  ctx.state.projects = [{ name: '다솜아파트' }];
  const r4 = X.hjStmtClassify([L('2026-09-11', '다솜 3동', '우수관 1개', 250000)]);
  const cand = [...r4.rev.values()][0].cands[0];
  assert.equal(cand.li, 2);
  assert.match(X.hjStmtRevBlock(cand, L('2026-09-11', '다솜 3동', '우수관 1개', 250000), 'S917.xlsx', { project: '다솜아파트' }), /미포함/);
  assert.equal(X.hjStmtRevBlock({ q, li: 1, l: q.stmt.lines[1] }, L('2026-09-09', '다솜 101동', '수도관 누수', 950000), 'S917.xlsx', { project: '다솜아파트' }), '', '미포함 아닌 줄은 그대로 바꿀 수 있음');
});

test('⑤ 날짜 권하기 — 한 달 앞 같은 날 무렵 사진이 있을 때만', () => {
  const q = build('S917.xlsx', '다솜아파트', '2026-09-17', [L('2026-10-15', '다솜 21동', '우수관 2개', 400000), L('2026-09-09', '다솜', '누수', 1)]);
  setState([q]);
  ctx.PHOTOS = new Map();
  assert.equal(X.hjStmtLineDaySuggest(q, q.stmt.lines[0]), null, '사진 없음 → 권하지 않음');
  ctx.PHOTOS = new Map([['다솜아파트', new Map([['2026-09-15', 30]])]]);
  assert.deepEqual(clone(X.hjStmtLineDaySuggest(q, q.stmt.lines[0])), { d: '2026-09-15', photos: 30 });
  assert.equal(X.hjStmtLineDaySuggest(q, q.stmt.lines[1]), null, '작성일 앞 날짜는 권하지 않음');
  assert.equal(X.hjStmtShiftMonthDay('2026-10-31', -1), '', '9/31 은 없다');
  assert.equal(X.hjStmtShiftMonthDay('2026-01-15', -1), '2025-12-15');
});

test('⑥ 장부 — ⚠ 날짜 확인·미포함 줄 수·받은 돈 많음', () => {
  const q = build('S917.xlsx', '다솜아파트', '2026-09-17', [L('2026-10-15', '다솜 21동', '우수관 2개', 400000), L('2026-09-09', '다솜', '누수', 100000), L('2026-09-10', '다솜', '줄눈', 50000)]);
  q.stmt.lines[2].skip = true; X.hjStmtReprice(q);
  setState([q], [{ d: '2026-11-05', project: '다솜아파트', amt: 550000, stmt: 'S917.xlsx', stmtPay: 'spx1' }]);
  const s = X.hjStmtLedger()[0];
  assert.deepEqual([s.total, s.paid, s.left, s.over, s.odd, s.skipN], [500000, 550000, 0, 50000, 1, 1]);
});

console.log(passed + ' passed');

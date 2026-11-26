/* v629 대표 요청(11/27) "고쳐줘" — 🤖 요청함 '내역서 줄 고치기'(stmt_line_edit): Claude·카톡봇 결재로 내역서 줄의 작업 날짜·금액·미포함을 고친다.
   ① 9/17 내역서 '10/15' 4줄(작업명·금액·날짜가 같은 두 줄은 위치로 구별) → 9/15 · d0 · 비고 · 가상 견적 파일 · 한 번 markDirty
   ② 다시 넣으면(파일 원래 값으로 찾음) '이미' — 두 번 바꾸지 않고 throw 도 없음
   ③ 같은 줄이 여럿인데 위치가 없으면 못 찾음(짐작 안 함) · 없는 줄 · 모두 못 고치면 throw(요청함에 남음) · 일부만이면 고친 것만
   ④ ✏ 와 같은 막기(미래 날짜·손으로 고친 견적) · 미포함·금액 · 50줄 넘으면 throw · ⑤ 미리보기 · ⑥ 연결(도구 표·자동 반영·늘 확인·답 줄)
   브라우저 없이 돈다: index.html 에서 함수를 떼어 VM 에서 부른다(현장·금액은 시험용 가짜).
   변이(HJ_V629_MUTATION): no-loc-filter · no-orig-match · no-throw · same-as-blocked · guess-first · auto-off */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const MUT = {
  'no-loc-filter': ['const h=hits.length>1&&loc?hits.filter(x=>hjStmtCell(x.l.loc)===loc):hits;', 'const h=hits;'],
  'no-orig-match': ["||(String(o.d||'')===d&&Math.round(num(o.amt))===amt))hits.push", '))hits.push'],
  'no-throw': ["  if(!fixed&&(missing||blocked))throw new Error('내역서 줄을 하나도 고치지 못했습니다", "  if(false)throw new Error('내역서 줄을 하나도 고치지 못했습니다"],
  'same-as-blocked': ['if(P.why){if(P.why===HJ_STMT_FIX_SAME)same++;else{', 'if(P.why){{'],
  'guess-first': ['  if(h.length!==1)return {miss:true};\n  const x=h[0],l=x.l;', '  if(!h.length)return {miss:true};\n  const x=h[0],l=x.l;'],
  'auto-off': ["HJ_KAKAO_AUTO_TOOLS.add('stmt_line_edit');", '//'],
};
if (process.env.HJ_V629_MUTATION) {
  const m = MUT[process.env.HJ_V629_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V629_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V629_MUTATION); html = html.replace(m[0], () => m[1]);
}
function grab(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 이 없다');
  let i = html.indexOf('{', html.indexOf(')', at)), depth = 0, q = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && html[i + 1] === '/') { i = html.indexOf('\n', i); continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
  }
  return html.slice(at, i + 1);
}
const NAMES = ['num', 'ymOf', 'won2num', 'hjIsNegativeAmount', 'hjNum', 'hjStmtCell', 'hjStmtKey', 'hjStmtMd', 'hjStmtSrcOf', 'hjStmtLineAmt', 'hjStmtLineOrig',
  'hjStmtLineOdd', 'hjStmtQuoteById', 'hjStmtLineEditPlan', 'hjStmtLineEditWrite', 'hjStmtPrices', 'quoteSupplyForTotal', 'quoteCalc', 'hjStmtGross', 'hjStmtReprice',
  'hjStmtQuoteEdited', 'hjStmtBuildQuote', 'hjStmtFixResolve', 'hjStmtFixApply', 'hjStmtFixPreview'];
const CONST = (html.match(/const HJ_STMT_FIX_MAX=\d+,HJ_STMT_FIX_SAME='[^']+';/) || [])[0];
assert.ok(CONST, 'HJ_STMT_FIX 상수');
const TODAY = '2026-11-27';
const calls = { sync: 0, dirty: 0, render: 0 };
const ctx = vm.createContext({ state: { quotes: [], payLog: [], projects: [], editingQuote: null }, __tabStale: false, __hjUnbilledMemo: 1, localDate: () => TODAY,
  uid: (() => { let n = 0; return () => 'q' + (++n); })(), hjQuoteNextNo: () => '제1',
  syncQuoteToProject: () => { calls.sync++; }, markDirty: () => { calls.dirty++; }, render: () => { calls.render++; } });
vm.runInContext(CONST.replace('const ', 'var ') + '\n' + NAMES.map(grab).join('\n') + '\n' + NAMES.map(n => `this.${n}=${n};`).join(''), ctx);
const X = ctx;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS stmtfix-v629 ' + name); }
const L = (d, loc, work, amt) => ({ d, loc, work, amt });
const SRC = '작업내역서20260917_가상누수.xlsx';
function seed() {
  const b = (project, lines) => X.hjStmtBuildQuote({ src: SRC, file: SRC, doc: '작업내역서', to: '가상누수', date: '2026-09-17', vat: 'included', project, lines });
  const qs = [b('가온아파트', [L('2026-09-09', '가온 101동 1302호', '수도관 누수', 1000000)]),
    b('다솜아파트', [L('2026-10-15', '오류동 다솜아파트 21동 1203호', '우수관 2개', 400000), L('2026-10-15', '오류동 다솜아파트 21동 1203호', '우수관 세탁기 배관 타공 작업', 50000)]),
    b('라온타운아파트', [L('2026-10-15', '라온아파트 102동 1208호', '우수관 1개', 220000), L('2026-10-15', '라온아파트 102동 1308호', '우수관 1개', 220000)])];
  ctx.state = { quotes: qs, payLog: [], projects: [], editingQuote: null };
  vm.runInContext('__tabStale=false', ctx);
  calls.sync = calls.dirty = calls.render = 0;
  return qs;
}
const FOUR = [
  { src: SRC, project: '다솜아파트', d: '2026-10-15', work: '우수관 2개', loc: '오류동 다솜아파트 21동 1203호', amt: 400000, to_d: '2026-09-15' },
  { src: SRC, project: '다솜아파트', d: '2026-10-15', work: '우수관 세탁기 배관 타공 작업', loc: '오류동 다솜아파트 21동 1203호', amt: 50000, to_d: '2026-09-15' },
  { src: SRC, project: '라온타운아파트', d: '2026-10-15', work: '우수관 1개', loc: '라온아파트 102동 1208호', amt: 220000, to_d: '2026-09-15' },
  { src: SRC, project: '라온타운아파트', d: '2026-10-15', work: '우수관 1개', loc: '라온아파트 102동 1308호', amt: 220000, to_d: '2026-09-15' },
];
const plain = o => JSON.parse(JSON.stringify(o));

test('① 4줄 10/15 → 9/15 — 같은 두 줄은 위치로 · d0 · 비고 · 한 번 markDirty', () => {
  const qs = seed();
  const before = qs.map(q => X.quoteCalc(q).total);
  const out = X.hjStmtFixApply({ items: plain(FOUR) });
  assert.deepEqual(plain(out), { 결과: '내역서 줄 고치기', 고침: 4, 이미: 0, 못찾음: 0, 막힘: 0 });
  assert.deepEqual(plain(qs[1].stmt.lines.map(l => [l.d, l.d0])), [['2026-09-15', '2026-10-15'], ['2026-09-15', '2026-10-15']]);
  assert.deepEqual(plain(qs[2].stmt.lines.map(l => [l.d, l.d0, l.loc.slice(-5)])), [['2026-09-15', '2026-10-15', '1208호'], ['2026-09-15', '2026-10-15', '1308호']]);
  assert.equal(qs[0].stmt.lines[0].d0, undefined, '다른 줄은 그대로');
  assert.deepEqual(qs.map(q => X.quoteCalc(q).total), before, '금액 그대로');
  assert.ok(qs[1].items[0].spec.startsWith('9/15 '));
  assert.match(qs[2].memo, /\[내역서 줄 고침\] 2026-11-27 · 우수관 1개 · 날짜 10\/15→9\/15/);
  assert.deepEqual([calls.sync, calls.dirty, calls.render], [4, 1, 1]);
  assert.equal(X.hjStmtLineOdd(qs[1].stmt.lines[0], '2026-09-17'), false, '⚠ 사라짐');
});

test('② 다시 넣으면 — 파일 원래 값으로 찾아 이미 · 두 번 안 바꿈 · throw 없음', () => {
  const qs = seed();
  X.hjStmtFixApply({ items: plain(FOUR) });
  const snap = JSON.stringify(qs);
  calls.dirty = 0;
  const out = X.hjStmtFixApply({ items: plain(FOUR) });
  assert.deepEqual(plain(out), { 결과: '내역서 줄 고치기', 고침: 0, 이미: 4, 못찾음: 0, 막힘: 0 });
  assert.equal(JSON.stringify(qs), snap); assert.equal(calls.dirty, 0);
  // 고친 값(지금 값)으로 적어 보내도 이미
  const now = FOUR.map(x => ({ ...x, d: '2026-09-15' }));
  assert.equal(X.hjStmtFixApply({ items: now }).이미, 4);
});

test('③ 위치 없이 같은 줄 여럿 → 못 찾음 · 없는 줄 · 모두 못 고치면 throw · 일부만이면 고친 것만', () => {
  seed();
  const noLoc = { ...FOUR[2] }; delete noLoc.loc;
  assert.deepEqual(plain(X.hjStmtFixResolve(noLoc)), { miss: true }, '짐작하지 않는다');
  assert.throws(() => X.hjStmtFixApply({ items: [noLoc] }), /하나도 고치지 못했습니다 — 못 찾은 줄 1 · 막힌 줄 0/);
  assert.throws(() => X.hjStmtFixApply({ items: [{ ...FOUR[0], src: '다른파일.xlsx' }] }), /못 찾은 줄 1/);
  assert.throws(() => X.hjStmtFixApply({ items: [{ ...FOUR[0], amt: 1 }] }), /못 찾은 줄 1/);
  assert.throws(() => X.hjStmtFixApply({ items: [] }), /고칠 줄이 없습니다/);
  const mixed = X.hjStmtFixApply({ items: [FOUR[0], { ...FOUR[1], work: '없는 작업' }] });
  assert.deepEqual([mixed.고침, mixed.못찾음], [1, 1]);
});

test('④ ✏ 와 같은 막기 · 미포함·금액 · 50줄', () => {
  const qs = seed();
  assert.throws(() => X.hjStmtFixApply({ items: [{ ...FOUR[0], to_d: '2099-01-01' }] }), /막힌 줄 1 \(작업 날짜가 미래예요/);
  qs[0].items[0].price = 1;   // 손으로 고친 견적
  assert.throws(() => X.hjStmtFixApply({ items: [{ src: SRC, project: '가온아파트', d: '2026-09-09', work: '수도관 누수', amt: 1000000, to_d: '2026-09-08' }] }), /손으로 고친 견적/);
  const out = X.hjStmtFixApply({ items: [{ ...FOUR[1], skip: true }, { ...FOUR[0], to_amt: 380000 }] });
  assert.equal(out.고침, 2);
  assert.deepEqual([qs[1].stmt.lines[1].skip, qs[1].stmt.lines[0].amt, qs[1].stmt.lines[0].amt0, X.quoteCalc(qs[1]).total], [true, 380000, 400000, 380000]);
  assert.throws(() => X.hjStmtFixApply({ items: Array.from({ length: 51 }, () => FOUR[0]) }), /50줄까지/);
});

test('⑤ 미리보기 — 줄마다 바뀌는 것 · 못 찾음', () => {
  seed();
  const p = X.hjStmtFixPreview({ items: [FOUR[0], { ...FOUR[2], loc: '' }] });
  assert.deepEqual(plain(p), ['다솜아파트 10/15 우수관 2개 — 날짜 10/15→9/15', '못 찾은 줄: 라온타운아파트 2026-10-15 우수관 1개']);
});

test('⑥ 연결 — 도구 표·실행·자동 반영·늘 확인·답 줄', () => {
  assert.ok(html.includes(" {name:'stmt_line_edit',description:'[변경] 반영한 작업내역서 줄의"), 'AI_TOOLS(요청함 claudeReqBad 가 아는 도구)');
  assert.ok(html.includes("    case 'stmt_line_edit':return hjStmtFixApply(a);"), 'aiToolRun');
  assert.ok(html.includes("HJ_KAKAO_AUTO_TOOLS.add('stmt_line_edit');"), '카톡 승인 반영');
  assert.ok(html.includes("AI_ALWAYS_CONFIRM.add('stmt_line_edit');"), 'AI 비서는 늘 확인');
  assert.ok(html.includes("AI_WRITE.add('stmt_line_edit');"), '바꾸는 작업');
  assert.ok(html.includes("||(q.tool==='stmt_line_edit'&&out&&!out.고침))same++;"), '이미뿐이면 건너뜀으로');
  assert.ok(html.includes("if(q.tool==='stmt_line_edit'){   // v629 고칠 수 있는(또는 이미 그 값인) 줄이 하나라도"), '쓸 것이 있는 요청만 고름');
});

console.log(passed + ' passed');

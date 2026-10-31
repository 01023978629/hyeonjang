/* v533 🏦↔📑 통장 입금 ↔ 작업내역서 자동 맞추기 — 10/31 대표 "다른거 개발 · 이어서 진행".
   v527 로 협력사 내역서(현장 여러 곳)의 받을 돈을 장부로 보게 됐지만, 협력사 입금은 통장 가져오기(v350)에서 현장과 안 맞아
   장부에서 한 장씩 [💰 입금]으로 다시 적어야 했다. 이제 통장 줄의 입금자가 내역서 거래처이고 금액이 그 내역서 남은 돈과 같으면
   그 내역서를 제안(체크)하고, 저장하면 v527 규칙(남은 돈 비율)으로 현장마다 나눠 적는다.
   합성 자료만(실제 고객·주소·거래처 아님), 바깥 요청 0(csv 경로), 바깥 쓰기 0.
   ① 맞추기 규칙: 거래처+남은 돈 같음 → 제안 · 잘린 이름·메모의 거래처 · 일부 입금·금액만 같음·여러 장 합계·같은 금액 두 장 → 힌트만 · 1글자 이름은 안 맞춤 (MATCH)
   ② 이미 기록됨: 한 번에 나눠 적은 묶음(stmtPay) 합계 · v533 전 기록(묶음 없음)은 그날 합계 · 같은 날 두 번 · 내역서 입금은 '전에 같은 입금자' 단서가 아님 (DUP)
   ③ 화면(390px): 📑 장부 [🏦 통장 파일로 맞추기] → csv → 내역서 2줄 체크·일부/금액만 줄은 힌트·현장 줄(v350) 그대로 → 저장 → 현장마다 나눠 기록·다음 할 일은 현장 줄만 (UI)
   ④ 같은 파일 다시: 이미 기록됨(체크 풀림·억지로 체크해도 안 적음) · 직접 고르기 · 남은 돈보다 많으면 막음 · 내역서만 저장하면 수금 이력 (AGAIN)
   ⑤ 소스·핀 3곳(v533 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V533_BASELINE=<commit> 은 ① 에서, HJ_V533_MUTATION=no-stmt 는 ③, no-dup·prev-stmt 는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V533_BASELINE ? execFileSync('git', ['show', process.env.HJ_V533_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-stmt': ["    if(sm.src)return Object.assign({},r,{project:'',why:sm.why,hint:'',stmt:sm.src,dup:false});\n", ''],
  'no-dup': ["  return !!(hit&&hit.has(row.amt));\n", "  return false;\n"],
  'prev-stmt': ["if(x&&x.payer&&x.project&&!x.stmt){const k=hjBankNorm(x.payer);", "if(x&&x.payer&&x.project){const k=hjBankNorm(x.payer);"]
}[process.env.HJ_V533_MUTATION || ''];
if (process.env.HJ_V533_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V533_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}
// 은행 csv(utf-8) — 보낸분·메모 열. 마지막 줄은 출금(빠져야 한다)
const CSV = ['거래일자,출금금액,입금금액,거래후잔액,보낸분,메모',
  '2026.10.31,,"1,490,001",0,(주)시험누수,10월분',
  '2026.10.31,,150000,0,시험누수,',
  '2026.10.30,,100000,0,시험누수,',
  '2026.10.29,,300000,0,홍길동,',
  '2026.10.28,,500000,0,라온고객,잔금',
  '2026.10.27,50000,,0,마트,'].join('\r\n') + '\r\n';

let browser, passed = 0;
const errors = [], confirms = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => {
    if (dialog.type() === 'beforeunload') return dialog.accept();
    if (dialog.type() === 'confirm') { confirms.push(dialog.message()); return dialog.accept(); }
    errors.push('dialog:' + dialog.type()); dialog.dismiss();
  });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS bankstmt-v533 ' + name); }
  const { context, page } = await openPage();
  // 합성: 협력사 '시험누수' 내역서 A(가온 220,000 + 나래 270,000 + 다솜 1,000,001)·B(가온 150,000), '시험방수' 내역서 D(마루 300,000), 보통 현장 라온빌라(고객 '라온고객')
  const SEED = () => page.evaluate(() => {
    const P = (name, cust) => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: cust || '', phone: '', addr: '' }, geo: null });
    state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트'), P('마루아파트'), P('라온빌라', '라온고객')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = [];
    const mk = (src, to, date, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: amts.map((a, i) => ({ d: date, loc: project + ' 작업' + i, work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); return q; };
    mk('A.xlsx', '시험누수', '2026-10-13', '가온아파트', [220000]); mk('A.xlsx', '시험누수', '2026-10-13', '나래아파트', [220000, 50000]); mk('A.xlsx', '시험누수', '2026-10-13', '다솜아파트', [1000001]);
    mk('B.xlsx', '시험누수', '2026-10-30', '가온아파트', [150000]);
    mk('D.xlsx', '시험방수', '2026-10-20', '마루아파트', [300000]);
    const plain = { id: 'PLAIN', title: '보통 견적', no: '제20261001', date: '2026-10-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '라온빌라', items: [{ name: '욕실', spec: '', qty: 1, price: 500000 }], result: 'won' };
    state.quotes.push(plain); syncQuoteToProject(plain);
    try { closeModal(); } catch (e) {}
  });

  await test('① 맞추기 규칙 — 거래처+남은 돈 → 제안 · 잘린 이름·메모 · 일부/금액만/합계/같은 금액 두 장은 힌트 (MATCH)', async () => {
    await SEED();
    const r = await page.evaluate(() => {
      const led = hjStmtLedger();
      const M = (amt, payer, memo, L) => { const m = hjBankStmtMatch({ date: '2026-10-31', amt, payer, memo: memo || '' }, L || led); return [m.src, m.dup, m.named, m.why, m.hint]; };
      const X = (src, date, left) => ({ src, to: '시험누수', doc: '작업내역서', date, left, quotes: [1] });
      return {
        led: led.map(s => [s.src, s.to, s.left]),
        exactA: M(1490001, '(주)시험누수'), exactB: M(150000, '시험누수'),
        trunc: M(300000, '시험방'), memo: M(300000, '김대표', '시험방수 10월'),
        part: M(100000, '시험누수'), amtOnly: M(300000, '홍길동'), short: M(300000, '하'),
        sum: M(1640001, '시험누수'), over: M(2000000, '시험누수'), none: M(77777, '모르는분'),
        tie: M(5000, '시험누수', '', [X('X1', '2026-10-01', 5000), X('X2', '2026-10-02', 5000)]),
        paidOff: M(5000, '시험누수', '', [X('X1', '2026-10-01', 0)])
      };
    });
    assert.deepEqual(r.led, [['B.xlsx', '시험누수', 150000], ['D.xlsx', '시험방수', 300000], ['A.xlsx', '시험누수', 1490001]], 'ledger ' + JSON.stringify(r.led));
    assert.deepEqual(r.exactA.slice(0, 3), ['A.xlsx', false, true]); assert.match(r.exactA[3], /입금자=거래처 · 남은 돈과 같은 금액 → 현장 3곳에 나눠 적어요/);
    assert.deepEqual(r.exactB.slice(0, 3), ['B.xlsx', false, true]); assert.match(r.exactB[3], /현장 1곳/);
    assert.equal(r.trunc[0], 'D.xlsx', 'bank-truncated payer name still matches ' + JSON.stringify(r.trunc));
    assert.equal(r.memo[0], 'D.xlsx', 'partner name in memo column ' + JSON.stringify(r.memo));
    assert(r.part[0] === '' && r.part[2] === true && /시험누수 작업내역서 10\/30\(남음 150,000원\) · 시험누수 작업내역서 10\/13\(남음 1,490,001원\)의 일부 입금일 수 있어요/.test(r.part[4]), 'partial = hint only ' + JSON.stringify(r.part));
    assert(r.amtOnly[0] === '' && r.amtOnly[2] === false && /📑 시험방수 작업내역서 10\/20 남은 돈과 같은 금액 — 입금자가 그 거래처면/.test(r.amtOnly[4]), 'amount only = hint only ' + JSON.stringify(r.amtOnly));
    assert(r.short[0] === '' && r.short[2] === false, 'one-letter payer never matches a partner ' + JSON.stringify(r.short));
    // v538 부터는 거래처가 맞고 오래된 순 합계가 딱 맞으면 '여러 장 한 번에' 제안(고르는 건 화면 체크 — tests/bankmulti-v538.e2e.js)
    assert(r.sum[0] === '' && /오래된 내역서 2장 남은 돈 합계와 같은 금액/.test(r.sum[3]) && r.sum[4] === '', 'several statements at once = combo suggestion (v538) ' + JSON.stringify(r.sum));
    assert.deepEqual(r.over, ['', false, true, '', ''], 'more than any statement = nothing');
    assert.deepEqual(r.none, ['', false, false, '', '']);
    assert(r.tie[0] === '' && /남은 돈이 같은 내역서 2장/.test(r.tie[4]), 'two statements with the same remaining amount = no pick ' + JSON.stringify(r.tie));
    assert.deepEqual(r.paidOff, ['', false, true, '', ''], 'fully paid statement is not suggested');
  });

  await test('② 이미 기록됨 — 묶음(stmtPay) 합계 · 예전 기록은 그날 합계 · 같은 날 두 번 · 내역서 입금은 전에 같은 입금자 단서 아님 (DUP)', async () => {
    await SEED();
    const r = await page.evaluate(() => {
      const D = (date, amt, src) => hjBankStmtDup({ date, amt }, src);
      const before = D('2026-10-31', 1490001, 'A.xlsx');
      const res = hjStmtPayApply('A.xlsx', { amt: 1490001, d: '2026-10-31', method: '계좌이체', payer: '(주)시험누수' });
      const recs = state.payLog.filter(x => x.stmt === 'A.xlsx');
      const after = [D('2026-10-31', 1490001, 'A.xlsx'), D('2026-10-31', 1490000, 'A.xlsx'), D('2026-10-30', 1490001, 'A.xlsx'), D('2026-10-31', 1490001, 'B.xlsx'), D('2026-10-31', 220000, 'A.xlsx')];
      // v533 전(v527) 기록 — 묶음 id 없음: 그날 합계로 본다
      state.payLog.push({ d: '2026-10-30', project: '가온아파트', amt: 100000, stmt: 'B.xlsx' }, { d: '2026-10-30', project: '가온아파트', amt: 50000, stmt: 'B.xlsx' });
      const legacy = [D('2026-10-30', 150000, 'B.xlsx'), D('2026-10-30', 100000, 'B.xlsx')];
      // 같은 날 두 번 나눠 받은 것 — 묶음마다 본다
      hjStmtPayApply('D.xlsx', { amt: 100000, d: '2026-10-29' }); hjStmtPayApply('D.xlsx', { amt: 100000, d: '2026-10-29' });
      const twice = [D('2026-10-29', 100000, 'D.xlsx'), D('2026-10-29', 200000, 'D.xlsx'), D('2026-10-29', 50000, 'D.xlsx')];
      // 이제 '시험누수' 이름으로 현장 기록이 생겼지만 협력사 입금이라 현장 제안 단서가 아니다
      const projects = state.projects.filter(p => !p.archived);
      const m = hjBankMatch({ date: '2026-10-31', amt: 777000, payer: '시험누수', memo: '' }, projects, n => projStats(n), state.payLog);
      // 보통 입금 기록(v350)은 예전처럼 단서가 된다
      state.payLog.push({ d: '2026-10-01', project: '라온빌라', amt: 1000, payer: '라온엄마' });
      const m2 = hjBankMatch({ date: '2026-10-31', amt: 777000, payer: '라온엄마', memo: '' }, projects, n => projStats(n), state.payLog);
      return { before, res: [res.n, res.total], recs: recs.map(x => [x.project, x.amt, x.payer, x.method, x.d]), groups: [...new Set(recs.map(x => x.stmtPay))].length, grpOk: /^sp/.test(recs[0].stmtPay), after, legacy, twice, m: [m.project, m.why, m.hint], m2: [m2.project, m2.why] };
    });
    assert.equal(r.before, false);
    assert.deepEqual(r.res, [3, 1490001]);
    assert.deepEqual(r.recs, [['가온아파트', 220000, '(주)시험누수', '계좌이체', '2026-10-31'], ['나래아파트', 270000, '(주)시험누수', '계좌이체', '2026-10-31'], ['다솜아파트', 1000001, '(주)시험누수', '계좌이체', '2026-10-31']], 'split records carry payer & method ' + JSON.stringify(r.recs));
    assert(r.groups === 1 && r.grpOk, 'one stmtPay group per payment');
    assert.deepEqual(r.after, [true, false, false, false, false], 'dup = same statement · same day · group sum equal ' + JSON.stringify(r.after));
    assert.deepEqual(r.legacy, [true, false], 'records without group id: day total ' + JSON.stringify(r.legacy));
    assert.deepEqual(r.twice, [true, false, false], 'two payments on one day are two groups ' + JSON.stringify(r.twice));
    assert.deepEqual(r.m, ['', '', ''], 'statement payments are not "전에 같은 입금자" evidence ' + JSON.stringify(r.m));
    assert(r.m2[0] === '라온빌라' && /전에 같은 입금자/.test(r.m2[1]), 'ordinary payer history still works ' + JSON.stringify(r.m2));
  });

  const rowsOf = () => page.evaluate(() => ({
    sum: document.getElementById('bkSum').textContent,
    rows: [...document.querySelectorAll('#modalRoot .bkRow')].map(el => {
      const sel = el.querySelector('.bkPj');
      return { chk: el.querySelector('.bkChk').checked, v: sel.value, opt: sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '', why: el.querySelector('.bkWhy').textContent, stmtOpts: sel.querySelectorAll('optgroup option').length,
        h: el.querySelector('label').getBoundingClientRect().height, sh: sel.getBoundingClientRect().height };
    }),
    wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  const pick = (i, v) => page.evaluate(([i, v]) => { const sel = document.querySelector('#modalRoot .bkPj[data-i="' + i + '"]'); sel.value = v; sel.dispatchEvent(new Event('change')); }, [i, v]);
  const csvFile = { name: '거래내역.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') };

  await test('③ 화면 390px — 📑 장부 [🏦 통장 파일로 맞추기] → 내역서 2줄 체크·힌트 2줄·현장 1줄 → 저장 → 현장마다 나눠 기록 (UI)', async () => {
    await SEED();
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    await page.waitForSelector('[data-stmt-ledger] [data-stmtbank]');
    const btnH = await page.evaluate(() => document.querySelector('[data-stmtbank]').getBoundingClientRect().height);
    assert(btnH >= 44, 'ledger button 44px ' + btnH);
    await page.click('[data-stmtbank]');
    await page.waitForSelector('#bkFile');
    await page.setInputFiles('#bkFile', csvFile);
    await page.waitForSelector('#modalRoot .bkRow');
    const s1 = await rowsOf();
    assert(/입금 5건/.test(s1.sum) && /현장 제안 1건/.test(s1.sum) && /📑 내역서 제안 2건/.test(s1.sum) && !/이미 기록됨/.test(s1.sum), 'summary ' + s1.sum);
    const R = s1.rows;
    assert.equal(R.length, 5, 'withdrawal row excluded');
    assert(R[0].chk && R[0].v === 'stmt:A.xlsx' && /제안: 📑 시험누수 작업내역서 10\/13 — 입금자=거래처 · 남은 돈과 같은 금액 → 현장 3곳에 나눠 적어요/.test(R[0].why) && /남음 1,490,001원/.test(R[0].opt), 'row A ' + JSON.stringify(R[0]));
    assert(R[1].chk && R[1].v === 'stmt:B.xlsx' && /현장 1곳/.test(R[1].why), 'row B ' + JSON.stringify(R[1]));
    assert(!R[2].chk && R[2].v === '' && /일부 입금일 수 있어요/.test(R[2].why), 'partial row: hint only ' + JSON.stringify(R[2]));
    assert(!R[3].chk && R[3].v === '' && /시험방수 작업내역서 10\/20 남은 돈과 같은 금액/.test(R[3].why), 'amount-only row: hint only ' + JSON.stringify(R[3]));
    assert(R[4].chk && R[4].v === '라온빌라' && /제안: 입금자=고객명/.test(R[4].why), 'ordinary project row unchanged (v350) ' + JSON.stringify(R[4]));
    assert(R.every(x => x.stmtOpts === 3), 'dropdown lists the 3 open statements ' + JSON.stringify(R.map(x => x.stmtOpts)));
    assert(R.every(x => x.h >= 44 && x.sh >= 44) && s1.wide <= 0, '44px · no horizontal overflow ' + JSON.stringify([R.map(x => [x.h, x.sh]), s1.wide]));
    confirms.length = 0;
    await page.evaluate(() => { state.dirty = false; document.getElementById('bkSave').click(); });
    await page.waitForFunction(() => /다음 할 일/.test((document.querySelector('#modalRoot .modal h3') || {}).textContent || ''));
    const after = await page.evaluate(() => {
      const L = (state.payLog || []).map(x => [x.project, x.amt, x.stmt || '', x.payer || '', x.method || '', x.d]);
      const led = hjStmtLedger().map(s => [s.src, s.paid, s.left]);
      const recv = Object.fromEntries(state.projects.map(p => [p.name, p.received || 0]));
      const a = state.payLog.filter(x => x.stmt === 'A.xlsx');
      return { L, led, recv, memo: a[0] && a[0].memo, grp: new Set(a.map(x => x.stmtPay)).size, toast: document.getElementById('toast').textContent, title: document.querySelector('#modalRoot .modal h3').textContent,
        next: [...document.querySelectorAll('#modalRoot .bsRow')].map(el => el.textContent.replace(/\s+/g, ' ')), dirty: state.dirty, keys: Object.keys(serializeData()).length };
    });
    assert.equal(confirms.length, 1); assert.match(confirms[0], /입금 3건 · 2,140,001원을 수금 이력에 저장할까요\?\n📑 작업내역서 입금 2건은 그 내역서 현장들에 남은 돈 비율로 나눠 적어요\./, 'confirm text ' + JSON.stringify(confirms));
    assert.deepEqual(after.L, [
      ['가온아파트', 220000, 'A.xlsx', '(주)시험누수', '계좌이체', '2026-10-31'], ['나래아파트', 270000, 'A.xlsx', '(주)시험누수', '계좌이체', '2026-10-31'], ['다솜아파트', 1000001, 'A.xlsx', '(주)시험누수', '계좌이체', '2026-10-31'],
      ['가온아파트', 150000, 'B.xlsx', '시험누수', '계좌이체', '2026-10-31'],
      ['라온빌라', 500000, '', '라온고객', '', '2026-10-28']], 'records ' + JSON.stringify(after.L));
    assert.equal(after.memo, '📑 시험누수 작업내역서 2026-10-13'); assert.equal(after.grp, 1);
    assert.deepEqual(after.led, [['B.xlsx', 150000, 0], ['D.xlsx', 0, 300000], ['A.xlsx', 1490001, 0]], 'ledger after ' + JSON.stringify(after.led));
    assert.deepEqual(after.recv, { 가온아파트: 370000, 나래아파트: 270000, 다솜아파트: 1000001, 마루아파트: 0, 라온빌라: 500000 }, 'received ' + JSON.stringify(after.recv));
    assert.match(after.toast, /🏦 입금 3건 저장 — 수금 이력에 반영 · 📑 내역서 2건은 현장 4곳에 나눠 기록/);
    assert(/입금 1건 저장됨 — 다음 할 일/.test(after.title) && after.next.length === 1 && /라온빌라/.test(after.next[0]), 'next-steps list = ordinary project rows only (no receipt text to a partner) ' + JSON.stringify([after.title, after.next]));
    assert(after.dirty === true && after.keys === 41, 'dirty · top-level keys unchanged ' + JSON.stringify([after.dirty, after.keys]));
  });

  await test('④ 같은 파일 다시 — 이미 기록됨 · 억지 체크도 안 적음 · 직접 고르기 · 남은 돈 초과 막음 · 내역서만 저장 → 수금 이력 (AGAIN)', async () => {
    await page.evaluate(async () => { closeModal(); hjBankImportView(); await new Promise(r => setTimeout(r, 60)); });
    await page.setInputFiles('#bkFile', csvFile);
    await page.waitForSelector('#modalRoot .bkRow');
    const s1 = await rowsOf(), R = s1.rows;
    assert(/이미 기록됨 3건/.test(s1.sum) && !/📑 내역서 제안/.test(s1.sum), 'summary ' + s1.sum);
    assert(!R[0].chk && R[0].v === 'stmt:A.xlsx' && /이미 기록됨 — 📑 시험누수 작업내역서 10\/13에 같은 날·같은 금액으로 나눠 적은 입금이 있어요/.test(R[0].why) && /다 받음/.test(R[0].opt), 'A again ' + JSON.stringify(R[0]));
    assert(!R[1].chk && R[1].v === 'stmt:B.xlsx' && /이미 기록됨/.test(R[1].why), 'B again ' + JSON.stringify(R[1]));
    assert(!R[2].chk && R[2].v === '', 'partner payer no longer drags in a project (전에 같은 입금자 아님) ' + JSON.stringify(R[2]));
    assert(!R[4].chk && R[4].v === '라온빌라' && /이미 기록됨/.test(R[4].why), 'ordinary dup unchanged ' + JSON.stringify(R[4]));
    const n0 = await page.evaluate(() => state.payLog.length);
    const forced = await page.evaluate(() => { [0, 1].forEach(i => { document.querySelector('#modalRoot .bkChk[data-i="' + i + '"]').checked = true; }); document.getElementById('bkSave').click(); return { n: state.payLog.length, toast: document.getElementById('toast').textContent }; });
    assert(forced.n === n0 && /이미 기록된/.test(forced.toast), 'forced re-check still not saved ' + JSON.stringify(forced));
    await page.evaluate(() => { [0, 1].forEach(i => { document.querySelector('#modalRoot .bkChk[data-i="' + i + '"]').checked = false; }); });
    // 내역서 현장을 바로 고르면 — 저장은 되지만 내역서를 고르라고 알려 준다
    await pick(3, '마루아파트');
    const direct = (await rowsOf()).rows[3];
    assert(direct.chk && /직접 고름: 마루아파트 — 이 현장은 📑 시험방수 작업내역서 10\/20에 들어 있어요\. 협력사 입금이면 그 내역서를 고르세요/.test(direct.why), 'statement project picked directly → nudge ' + JSON.stringify(direct));
    // 직접 고르기 — 홍길동 300,000 → 시험방수 D (남은 돈 300,000)
    await pick(3, 'stmt:D.xlsx');
    // 라온고객 500,000 을 D 로 — 남은 돈보다 많다
    await pick(4, 'stmt:D.xlsx');
    const s2 = (await rowsOf()).rows;
    assert(s2[3].chk && /직접 고름: 📑 시험방수 작업내역서 10\/20 → 현장 1곳에 남은 돈 비율로 나눠 적어요/.test(s2[3].why), 'manual pick ' + JSON.stringify(s2[3]));
    assert(!s2[4].chk && /남은 돈\(300,000원\)보다 많아요/.test(s2[4].why), 'over → unchecked ' + JSON.stringify(s2[4]));
    confirms.length = 0;
    const over = await page.evaluate(() => { document.querySelector('#modalRoot .bkChk[data-i="4"]').checked = true; document.getElementById('bkSave').click(); return { n: state.payLog.length, toast: document.getElementById('toast').textContent }; });
    assert(over.n === n0 && confirms.length === 0 && /📑 시험방수 작업내역서 10\/20 남은 돈\(300,000원\)보다 많은 입금을 골랐어요/.test(over.toast), 'over-total blocks the whole save ' + JSON.stringify(over));
    await page.evaluate(() => { document.querySelector('#modalRoot .bkChk[data-i="4"]').checked = false; document.getElementById('bkSave').click(); });
    await page.waitForFunction(() => /수금 이력/.test((document.querySelector('#modalRoot .modal h3') || {}).textContent || ''));
    const done = await page.evaluate(() => ({ n: state.payLog.length, last: (x => [x.project, x.amt, x.stmt, x.payer, x.method, x.d])(state.payLog[state.payLog.length - 1]), D: hjStmtLedger().find(s => s.src === 'D.xlsx').left, toast: document.getElementById('toast').textContent }));
    assert.equal(confirms.length, 1);
    assert(done.n === n0 + 1 && done.D === 0, 'D recorded ' + JSON.stringify(done));
    assert.deepEqual(done.last, ['마루아파트', 300000, 'D.xlsx', '홍길동', '계좌이체', '2026-10-29']);
    assert.match(done.toast, /🏦 입금 1건 저장 — 수금 이력에 반영 · 📑 내역서 1건은 현장 1곳에 나눠 기록/);
    await page.evaluate(() => closeModal());
  });

  await test('⑤ 소스·핀 3곳(v533 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(d\.stmtbank!==undefined\)return hjBankImportView\(\);/);
    assert.match(SRC, /#qmStmt,\[data-stmtpay\],\[data-stmtfile\],\[data-stmtbank\]/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 533, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`bankstmt-v533: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL bankstmt-v533', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

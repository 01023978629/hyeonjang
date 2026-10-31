/* v527 📑 작업내역서 장부 · 💰 내역서 입금 · 📂 폴더의 내역서 바로 반영 — 10/31 대표 "개발 계속 진행".
   v526 으로 내역서를 현장별 견적(수주)으로 넣으면 협력사가 돈을 줄 때까지 현장들이 모두 미수다. 협력사는 내역서 한 장 단위로 입금한다.
   합성 자료만(실제 고객·주소 아님), 엑셀 라이브러리는 가짜(XLSX.read 가 JSON 격자를 돌려줌), 바깥 쓰기 0.
   ① 장부: 내역서(stmt.src)별 거래처·현장 수·합계·받음·남음 · 집계 제외 견적은 빼고 · 보통 견적은 장부에 없음 (LEDGER)
   ② 나누기: 남은 돈 비율 · 원 단위 합이 정확 · 남은 돈보다 많으면 null · 일부 받은 뒤 남은 돈만큼 (PLAN)
   ③ 입금: 현장마다 입금 기록(stmt·결제 방법·증빙) · 받은 돈 누계·잔금 · 미수 독촉 작업 닫힘 · 미래 날짜·초과·지워진 현장 막음 (APPLY)
   ④ 화면: 견적 작성 탭 장부 · [💰 입금] → 나눔 미리보기 → 저장 → '✓ 다 받음' (UI)
   ⑤ 폴더 파일: 앱이 색인한 작업내역서 엑셀(양식 제외) 목록 · [📑 반영] → 확인 창 → 반영 뒤 목록에서 빠짐 (FILES)
   ⑥ 소스·핀 3곳 v527 · 오류 0 · 바깥 쓰기 0
   HJ_V527_BASELINE=<commit> 은 ① 에서, HJ_V527_MUTATION=no-split 는 ② 에서 실패해야 한다. */
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
let html = process.env.HJ_V527_BASELINE ? execFileSync('git', ['show', process.env.HJ_V527_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V527_MUTATION === 'no-split') {
  const from = "  rows.slice().sort((a,b)=>(b.exact-b.amt)-(a.exact-a.amt)||b.left-a.left).forEach(r=>{if(rest>0&&r.amt<r.left){r.amt++;rest--;}});\n";
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
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
const SER = d => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000) + 25569);

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS stmtpay-v527 ' + name); }
  const { context, page } = await openPage();
  // 합성: 가온·나래·다솜 세 현장, 내역서 두 장(A: 가온 220,000 + 나래 270,000 + 다솜 1,000,001 / B: 가온 150,000), 집계 제외 내역서 견적 1건, 보통 견적 1건
  const SEED = () => page.evaluate(() => {
    const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
    state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = [];
    const mk = (src, date, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines: amts.map((a, i) => ({ d: date, loc: project + ' ' + (i + 1) + '-101', work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); return q; };
    mk('A.xlsx', '2026-10-13', '가온아파트', [220000]); mk('A.xlsx', '2026-10-13', '나래아파트', [220000, 50000]); mk('A.xlsx', '2026-10-13', '다솜아파트', [1000001]);
    mk('B.xlsx', '2026-10-30', '가온아파트', [150000]);
    const ex = mk('C.xlsx', '2026-10-20', '다솜아파트', [500000]); ex.exSum = true; syncQuoteToProject(ex);
    const plain = { id: 'PLAIN', title: '보통 견적', no: '제20261001', date: '2026-10-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '가온아파트', items: [{ name: '욕실', spec: '', qty: 1, price: 1000000 }], result: 'won' };
    state.quotes.push(plain); syncQuoteToProject(plain);
  });

  await test('① 장부 — 내역서별 합계·받음·남음 · 집계 제외·보통 견적은 빼고 (LEDGER)', async () => {
    await SEED();
    const r = await page.evaluate(() => hjStmtLedger().map(s => [s.src, s.to, s.date, s.quotes.length, s.total, s.paid, s.left]));
    assert.deepEqual(r, [['B.xlsx', '시험누수', '2026-10-30', 1, 150000, 0, 150000], ['A.xlsx', '시험누수', '2026-10-13', 3, 1490001, 0, 1490001]], 'LEDGER ' + JSON.stringify(r));
  });

  await test('② 나누기 — 남은 돈 비율 · 합이 정확 · 초과는 null · 일부 받은 뒤 (PLAN)', async () => {
    const r = await page.evaluate(() => {
      const A = hjStmtLedger().find(s => s.src === 'A.xlsx');
      const full = hjStmtPayPlan(A, 1490001), part = hjStmtPayPlan(A, 1000000), over = hjStmtPayPlan(A, 1490002), zero = hjStmtPayPlan(A, 0);
      return { full: full.map(x => [x.project, x.amt]), fullSum: full.reduce((a, x) => a + x.amt, 0), part: part.map(x => [x.project, x.amt]), partSum: part.reduce((a, x) => a + x.amt, 0), over, zero };
    });
    assert.deepEqual(r.full, [['가온아파트', 220000], ['나래아파트', 270000], ['다솜아파트', 1000001]], 'PLAN full ' + JSON.stringify(r));
    assert.equal(r.fullSum, 1490001);
    assert.equal(r.partSum, 1000000, 'PLAN partial sum exact ' + JSON.stringify(r.part));
    assert.deepEqual(r.part, [['가온아파트', 147651], ['나래아파트', 181208], ['다솜아파트', 671141]], 'PLAN partial proportional ' + JSON.stringify(r.part));
    assert(r.over === null && r.zero === null, 'PLAN over/zero refused');
  });

  await test('③ 입금 — 현장마다 기록 · 받은 돈·잔금 · 독촉 닫힘 · 미래·초과·지워진 현장 막음 (APPLY)', async () => {
    const r = await page.evaluate(() => {
      const o = aiOpsEnsureState(); o.queue = o.queue || []; o.queue.push({ id: 'T1', title: '나래아파트 미수금 독촉', project: '나래아파트', status: 'pending' });
      const errs = [];
      const tryPay = (src, opt) => { try { hjStmtPayApply(src, opt); return 'ok'; } catch (e) { errs.push(e.message); return 'err'; } };
      const fut = tryPay('A.xlsx', { amt: 1000, d: '2999-01-01' }), over = tryPay('A.xlsx', { amt: 9999999, d: '2026-10-31' });
      const r1 = hjStmtPayApply('A.xlsx', { amt: 1000000, d: '2026-10-31', method: '계좌이체', proof: 'tax' });
      const mid = hjStmtLedger().find(s => s.src === 'A.xlsx');
      const r2 = hjStmtPayApply('A.xlsx', { amt: mid.left, d: '2026-10-31', method: '계좌이체' });
      const A = hjStmtLedger().find(s => s.src === 'A.xlsx');
      const logs = state.payLog.filter(x => x.stmt === 'A.xlsx');
      const st = projStats('나래아파트');
      // 지워진 현장 — B 의 가온을 지우면 막는다
      state.projects = state.projects.filter(p => p.name !== '가온아파트');
      const gone = tryPay('B.xlsx', { amt: 150000, d: '2026-10-31' });
      return { fut, over, errs, r1: [r1.n, r1.total], r2: [r2.n, r2.total], A: [A.paid, A.left], logs: logs.length, sample: logs[0] && [logs[0].project, logs[0].amt, logs[0].method, logs[0].proof, !!logs[0].proofAt, logs[0].memo], recv: st.recv, due: st.due,
        task: (aiOpsEnsureState().queue || []).some(t => t.id === 'T1'), dirty: state.dirty, gone, bLeft: (state.payLog || []).filter(x => x.stmt === 'B.xlsx').length };
    });
    assert(r.fut === 'err' && r.over === 'err' && /미래/.test(r.errs[0]) && /남은 돈/.test(r.errs[1]), 'APPLY guards ' + JSON.stringify(r.errs));
    assert.deepEqual(r.r1, [3, 1000000]); assert.deepEqual(r.r2, [3, 490001]);
    assert.deepEqual(r.A, [1490001, 0], 'APPLY fully paid');
    assert.equal(r.logs, 6);
    assert.deepEqual(r.sample, ['가온아파트', 147651, '계좌이체', 'tax', true, '📑 시험누수 작업내역서 2026-10-13'], 'APPLY record fields ' + JSON.stringify(r.sample));
    assert(r.recv === 270000 && r.due === 0, 'APPLY project received & due ' + JSON.stringify(r));
    assert.equal(r.task, false, 'APPLY closes dunning task');
    assert(r.gone === 'err' && /지워진 현장/.test(r.errs[2]) && r.bLeft === 0, 'APPLY deleted project → nothing recorded ' + JSON.stringify(r));
  });

  await test('④ 화면 — 장부 · [💰 입금] → 미리보기 → 저장 → 다 받음 (UI)', async () => {
    await SEED();
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    await page.waitForSelector('[data-stmt-ledger]');
    const before = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-stmt-row]').length, pay: [...document.querySelectorAll('[data-stmtpay]')].map(b => b.dataset.stmtpay), text: document.querySelector('[data-stmt-ledger]').textContent.replace(/\s+/g, ' ') }));
    assert(before.rows === 2 && before.pay.join() === 'B.xlsx,A.xlsx' && /남은 돈 합계 1,640,001원/.test(before.text), 'UI ledger ' + JSON.stringify(before));
    await page.click('[data-stmtpay="A.xlsx"]');
    await page.waitForSelector('#spAmt');
    const prev = await page.evaluate(() => ({ v: document.querySelector('#spAmt').value, plan: document.querySelector('#spPlan').textContent }));
    assert(prev.v === '1490001' && /다솜아파트1,000,001원/.test(prev.plan.replace(/\s+/g, '')), 'UI default = remaining, preview ' + JSON.stringify(prev));
    await page.fill('#spAmt', '9,999,999');
    await page.waitForFunction(() => /남은 돈\(1,490,001원\)보다 많아요/.test(document.querySelector('#spPlan').textContent));
    await page.click('.mfoot button.clay');
    await page.waitForFunction(() => /남은 돈\(1,490,001원\)보다 많아요/.test(document.getElementById('toast').textContent));
    assert.equal(await page.evaluate(() => (state.payLog || []).length), 0, 'UI over-amount not saved');
    await page.fill('#spAmt', '1,490,001');
    await page.selectOption('#spProof', 'tax');
    await page.click('.mfoot button.clay');
    await page.waitForFunction(() => !document.querySelector('#spAmt'));
    const after = await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, text: document.querySelector('[data-stmt-ledger]').textContent.replace(/\s+/g, ' '), pay: [...document.querySelectorAll('[data-stmtpay]')].map(b => b.dataset.stmtpay), logs: state.payLog.length, proof: state.payLog.every(x => x.proof === 'tax') }));
    assert(/💰 시험누수 1,490,001원 입금 — 현장 3곳에 나눠 기록/.test(after.toast) && /✓ 다 받음/.test(after.text) && after.pay.join() === 'B.xlsx' && after.logs === 3 && after.proof, 'UI saved ' + JSON.stringify(after));
  });

  await test('⑤ 폴더 파일 — 색인된 작업내역서 엑셀 · [📑 반영] → 확인 창 → 반영 뒤 목록에서 빠짐 (FILES)', async () => {
    await SEED();
    const grid = [['작업 내역서', '', '', ''], ['받는 분', '시험누수', '작성일', SER('2026-10-31')], ['작업 날짜', '위치', '작업명', '작업비용'], [SER('2026-10-28'), '가온아파트 1-101', '우수관 교체', 220000], ['합 계', '', '', 220000]];
    await page.evaluate((grid) => {
      window.XLSX = { read: u8 => ({ SheetNames: ['작업 내역서'], Sheets: { '작업 내역서': JSON.parse(new TextDecoder().decode(u8)) } }), utils: { sheet_to_json: ws => ws } };
      const mkf = (id, name, prefix, body) => state.files.push({ id, name, prefix, ext: 'xlsx', kind: 'other', size: body.length, project: null, when: new Date('2026-10-31T01:00:00Z'), _file: new File([body], name) });
      mkf('F1', '작업내역서20261031_시험누수.xlsx', '작업내역서/', JSON.stringify(grid));
      mkf('F2', '작업내역서_양식.xlsx', '작업내역서/', '[]');
      mkf('F3', 'A.xlsx', '작업내역서/', '[]');   // 이미 반영한 내역서(장부의 A.xlsx)
      state.tab = 'quotemaker'; state.editingQuote = null; render();
    }, grid);
    await page.waitForSelector('[data-stmtfile]');
    const list = await page.evaluate(() => ({ files: hjStmtFiles().map(x => [x.f.id, x.applied]), btn: [...document.querySelectorAll('[data-stmtfile]')].map(b => b.dataset.stmtfile) }));
    assert.deepEqual(list.files, [['F1', false], ['F3', true]], 'FILES list (template excluded, applied marked) ' + JSON.stringify(list));
    assert.deepEqual(list.btn, ['F1']);
    await page.click('[data-stmtfile="F1"]');
    await page.waitForSelector('.stmt-review');
    const ui = await page.evaluate(() => [...document.querySelectorAll('[data-stmt-proj]')].map(s => s.value));
    assert.deepEqual(ui, ['가온아파트'], 'FILES review default ' + JSON.stringify(ui));
    await page.click('.mfoot button.blue');
    await page.waitForFunction(() => !document.querySelector('.stmt-review'));
    const done = await page.evaluate(() => ({ q: state.quotes.filter(q => q.stmt && hjStmtSrcOf(q) === '작업내역서20261031_시험누수.xlsx').length, btn: document.querySelectorAll('[data-stmtfile]').length, rows: document.querySelectorAll('[data-stmt-row]').length }));
    assert(done.q === 1 && done.btn === 0 && done.rows === 3, 'FILES applied, list updated ' + JSON.stringify(done));
  });

  await test('⑥ 소스·핀 3곳 v527 · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(d\.stmtpay!==undefined\)return hjStmtPayView\(d\.stmtpay\);/);
    assert.match(SRC, /#qmStmt,\[data-stmtpay\],\[data-stmtfile\]/);
    const pins = [/const APP_BUILD='hyeonjang-v527-stmtpay'/.test(SRC), /const C='hyeonjang-v527-stmtpay'/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), /TARGET_BUILD = 'hyeonjang-v527-stmtpay'/.test(fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8'))];
    assert.deepEqual(pins, [true, true, true], 'pins ' + JSON.stringify(pins));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`stmtpay-v527: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL stmtpay-v527', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

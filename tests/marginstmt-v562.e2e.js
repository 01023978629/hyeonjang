/* v562 마진 = 작업내역서 기준 · 퍼센트 먼저 — 대표 지시(2026-11-08): "마진은 퍼센트로 작업내역서 기준으로 진행".
   v561 의 매출 기준(goals.salesBasis==='stmt')을 켜면 projStats 마진(margin·marginNet·marginEff 와 율)은 작업내역서 매출(sales) − 지출로 센다.
   작업내역서가 없는 현장은 마진을 셀 수 없어 marginNA(마진 0) — 대시보드 총 마진·수익 분석·수익성 순위·적자 경보·월말 결산 완료 현장 합계에서 뺀다.
   화면은 마진율(%)을 먼저 보인다. 설정이 없으면 예전 그대로(견적 − 지출, 금액 먼저). 청구·고객 숫자(est·bill·due)는 그대로.
   합성 자료만, 바깥 쓰기 0. 날짜는 '지난달'(PYM).
   시드: 가온(견적서 3,300,000 + 내역서 220,000 · 장부 자재 50,000) · 나래(견적서 5,500,000 · 내역서 없음 · 자재 5,000,000 · 지난달 준공) ·
         다솜(내역서 1,100,000 · 인건 300,000 · 지난달 준공) · 라온(내역서 100,000 · 외주 150,000 — 적자).
   ① 꺼 둠(salesBasis 'all') — 마진·총 마진·적자 경보·수익 분석은 예전 그대로(견적 기준, 금액 먼저) (DEFAULT)
      (v589 부터 설정이 비어 있으면 내역서가 있는 자료는 저절로 내역서 기준이라, 예전 동작은 사람이 끈 'all' 로 지킨다)
   ② 켜면 마진 = 내역서 − 지출 · 내역서 없는 나래는 marginNA · est·bill·due 그대로 (STMT)
   ③ 화면 — 대시보드 '총 마진(내역서) 65% · 92만원' · 마진 표 칸 '77% · …(작업내역서 기준)'/'작업내역서 없음' · 파일철 · 건별 마진 (VIEW)
   ④ 합계·분석 — 마진 요약 · 수익 분석 · 수익성 순위 · 적자 경보 · 월말 결산 완료 현장에서 나래 빠짐 (TOTALS)
   ⑤ 소스·핀 3곳(v562 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V562_BASELINE=<commit> 은 ② 에서, HJ_V562_MUTATION=no-base(마진 바탕을 est 로 되돌림) 은 ② 에서 실패해야 한다. */
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
const BASE = "marginBase=mStmt?sales:est,";
let html = process.env.HJ_V562_BASELINE ? execFileSync('git', ['show', process.env.HJ_V562_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V562_MUTATION) {
  assert.equal(process.env.HJ_V562_MUTATION, 'no-base', 'unknown mutation ' + process.env.HJ_V562_MUTATION);
  assert.equal(SRC.split(BASE).length, 2, 'mutation anchor');
  html = SRC.replace(BASE, 'marginBase=est,');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS marginstmt-v562 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const PYM = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  const P = (name, cost, doneAt) => ({ name, stage: doneAt ? 3 : 2, received: 0, phases: [], cost: Object.assign({ material: 0, labor: 0, outsource: 0 }, cost || {}), customer: { name: '', phone: '', addr: '' }, archived: false, doneAt: doneAt || null });
  state.projects = [P('가온'), P('나래', { material: 5000000 }, PYM + '-26'), P('다솜', { labor: 300000 }, PYM + '-25'), P('라온', { outsource: 150000 })];
  state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state._demo = false; state.dirHandle = null; state.goals = { salesBasis: 'all' };   // v589 예전 동작은 사람이 끈 'all' 로
  state.expenses = [{ id: 'X1', date: PYM + '-10', category: '자재', amount: 50000, project: '가온', memo: '' }];
  const est = (id, name, project, amount, day) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, prefix: '_정리완료/' + project + '/견적서/', size: 1000 + amount % 997,
    est: { customer: name.replace(/\.xlsx$/, ''), amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date: PYM + '-' + day }, when: new Date(PYM + '-' + day + 'T09:00:00+09:00') });
  state.files = [est('E_A', '가온_견적서.xlsx', '가온', 3300000, '05'), est('E_B', '나래_견적서.xlsx', '나래', 5500000, '08')];
  const stmt = (project, amt, day) => { const q = hjStmtBuildQuote({ src: 'S_' + project + '.xlsx', file: 'S_' + project + '.xlsx', doc: '작업내역서', to: '시험누수', date: PYM + '-' + day, vat: 'included', project, lines: [{ d: PYM + '-' + day, loc: project + ' 101-1', work: '누수', amt }] }); state.quotes.push(q); syncQuoteToProject(q); };
  stmt('가온', 220000, '20'); stmt('다솜', 1100000, '21'); stmt('라온', 100000, '22');
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
  return PYM;
};
const pick = (page, PYM) => page.evaluate(PYM => {
  const pj = n => { const s = projStats(n); return { est: s.est, bill: s.bill, due: s.due, marginEff: s.marginEff, rate: s.marginRateEff, net: s.marginNet, rateNet: s.marginRateNet, na: !!s.marginNA, base: s.marginBase, label: projectMarginLabel(s) }; };
  const pa = profitAnalysisData(), ms = projMarginSummary().total, mc = monthlyClosingData(PYM);
  return { A: pj('가온'), B: pj('나래'), C: pj('다솜'), D: pj('라온'),
    pa: { tEst: pa.tEst, tCost: pa.tCost, rate: pa.rate, lossers: (pa.sug || []).filter(t => /적자 현장/.test(t)).join('') },
    ms: { marginEff: ms.marginEff, rate: ms.marginRateEff },
    rank: profitRankData().map(r => [r.name, r.revenue, r.profit, r.rate]),
    loss: lossAlertData().map(r => [r.name, r.marginRate]),
    done: { est: mc.doneEst, cost: mc.doneCost, margin: mc.doneMargin, text: monthlyClosingText(mc) } };
}, PYM);

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    const PYM = await page.evaluate(SEED);
    let base;
    await test('① 설정 없음 — 마진·총 마진·적자 경보·수익 분석은 예전 그대로(견적 기준, 금액 먼저) (DEFAULT)', async () => {
      base = await pick(page, PYM);
      assert.deepEqual([base.A.est, base.A.marginEff, base.A.rate], [3520000, 3470000, 99], '가온 = 견적 3,520,000 − 장부 50,000 — ' + JSON.stringify(base.A));
      assert.deepEqual([base.B.marginEff, base.B.rate], [500000, 9], '나래 = 견적 5,500,000 − 5,000,000');
      assert.deepEqual([base.D.marginEff, base.D.rate], [-50000, -50], '라온 적자');
      assert.deepEqual(base.loss, [['라온', -50], ['나래', 9]], '적자·저마진 경보 — 견적 기준');
      assert.deepEqual([base.pa.tEst, base.pa.tCost, base.pa.rate], [10220000, 5500000, 46], '수익 분석 — 네 현장 모두');
      assert.ok(/원 · 99% \(입력 원가 기준\)$/.test(base.A.label), '금액 먼저 — ' + base.A.label);
      const kpi = await page.evaluate(() => { state.tab = 'dashboard'; render(); return [...document.querySelectorAll('.kpis .kpi')].map(k => k.innerText.replace(/\s+/g, ' ')).find(t => t.includes('총 마진')) || ''; });
      assert.ok(kpi.includes('472') && kpi.includes('만원') && kpi.includes('46%'), '총 마진 = 견적 합 − 지출 합(472만원 · 46%) — ' + kpi);
    });
    let on;
    await test('② 켜면 마진 = 내역서 − 지출 · 내역서 없는 나래는 marginNA · est·bill·due 그대로 (STMT)', async () => {
      await page.evaluate(() => hjSalesBasisSet(true));
      on = await pick(page, PYM);
      assert.deepEqual([on.A.base, on.A.marginEff, on.A.rate, on.A.na], [220000, 170000, 77, false], '가온 = 내역서 220,000 − 50,000 — ' + JSON.stringify(on.A));
      assert.deepEqual([on.B.base, on.B.marginEff, on.B.rate, on.B.na], [0, 0, 0, true], '나래는 내역서 없음 — ' + JSON.stringify(on.B));
      assert.deepEqual([on.C.marginEff, on.C.rate], [800000, 73], '다솜 = 1,100,000 − 300,000');
      assert.deepEqual([on.D.marginEff, on.D.rate], [-50000, -50], '라온 = 100,000 − 150,000');
      assert.equal(on.A.net, 200000 - 45455, '가온 순마진 = 내역서 공급가 200,000 − 자재 공급가 45,455');
      for (const k of ['A', 'B', 'C', 'D']) assert.deepEqual([on[k].est, on[k].bill, on[k].due], [base[k].est, base[k].bill, base[k].due], k + ' 청구·고객 숫자 그대로');
    });
    await test('③ 화면 — 대시보드 총 마진(내역서) 65% · 92만원 · 마진 표 칸 · 파일철 · 건별 마진 (VIEW)', async () => {
      const v = await page.evaluate(() => {
        state.tab = 'dashboard'; render();
        const kpi = (document.querySelector('[data-margin-kpi]') || {}).innerText || '';
        const rows = {}; document.querySelectorAll('#dashboardMarginTable tbody tr').forEach(tr => { const n = (tr.querySelector('td') || {}).innerText || ''; const mg = tr.querySelector('td.mg'); if (mg) rows[n.trim()] = mg.textContent.replace(/\s+/g, ' ').trim(); });   // textContent — PC 폭에서는 ' · ' 가 숨는다(v464, 글은 같음)
        const hist = projectHistoryText(projectHistoryData('가온')), histB = projectHistoryText(projectHistoryData('나래'));
        const mA = hjProjectMargin('가온', true), mB = hjProjectMargin('나래', true);
        return { kpi: kpi.replace(/\s+/g, ' '), rowA: rows['가온'], rowB: rows['나래'], labelA: projectMarginLabel(projStats('가온')), hist, histB, textA: hjMarginText(mA), textB: hjMarginText(mB), won170: won(170000), revA: mA.revenue };
      });
      assert.ok(v.kpi.includes('총 마진(내역서)') && /65\s*%/.test(v.kpi) && v.kpi.includes('92만원'), '대시보드 총 마진 = 내역서 있는 현장 (92만원/142만원) — ' + v.kpi);
      assert.equal(v.labelA, '77% · ' + v.won170 + ' (작업내역서 기준)', '마진 글 = 퍼센트 먼저');
      assert.equal(v.rowA, v.labelA, '마진 표 칸 글 = 마진 글 — ' + v.rowA);
      assert.equal(v.rowB, '작업내역서 없음', '나래 칸 — ' + v.rowB);
      assert.ok(v.hist.includes('마진 77% · 17만원'), '파일철 — ' + v.hist.split('\n')[1]);
      assert.ok(v.histB.includes('마진 내역서 없음'), '파일철 나래 — ' + v.histB.split('\n')[1]);
      assert.equal(v.revA, 220000, '건별 마진 매출 = 내역서');
      assert.ok(v.textA.startsWith('77% (' + v.won170 + ')'), '건별 마진 글 = 퍼센트 먼저(인건·외주 칸이 비어 \'일부 미입력\'이 붙는다) — ' + v.textA);
      assert.equal(v.textB, '작업내역서 없음', '건별 마진 나래');
    });
    await test('④ 합계·분석 — 마진 요약 · 수익 분석 · 수익성 순위 · 적자 경보 · 월말 결산 완료 현장에서 나래 빠짐 (TOTALS)', async () => {
      assert.deepEqual([on.ms.marginEff, on.ms.rate], [920000, 65], '마진 요약 = 17만 + 80만 − 5만, ÷ 142만 — ' + JSON.stringify(on.ms));
      assert.deepEqual([on.pa.tEst, on.pa.tCost, on.pa.rate], [1420000, 500000, 65], '수익 분석 — 내역서 현장만(지출도) — ' + JSON.stringify(on.pa));
      assert.ok(on.pa.lossers.includes('라온') && !on.pa.lossers.includes('나래'), '적자 현장 제안 — ' + on.pa.lossers);
      assert.deepEqual(on.rank, [['다솜', 1100000, 800000, 73], ['가온', 220000, 170000, 77], ['라온', 100000, -50000, -50]], '수익성 순위 — 내역서 매출 · 나래 빠짐');
      assert.deepEqual(on.loss, [['라온', -50]], '적자 경보 — 나래 빠짐');
      assert.deepEqual([on.done.est, on.done.cost, on.done.margin], [1100000, 300000, 800000], '월말 결산 완료 현장 합계 — 다솜만');
      assert.ok(on.done.text.includes('매출(내역서) 110만원 · 지출 30만원 · 마진 73% · 80만원'), '월말 결산 완료 줄 — ' + on.done.text);
      assert.ok(on.done.text.includes('나래 마진 내역서 없음') && on.done.text.includes('다솜 마진 73% · 80만원'), '월말 결산 현장 줄');
      const back = await page.evaluate(() => { hjSalesBasisSet(false); const s = projStats('나래'); return [s.marginEff, s.marginRateEff, !!s.marginNA]; });
      assert.deepEqual(back, [500000, 9, false], '끄면 예전 마진으로');
    });
    await test('⑤ 소스·핀 3곳(v562 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 562, '핀 v562 이상 ' + a);
      assert.ok(src.includes(BASE), '마진 바탕이 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
    console.log(`marginstmt-v562: ${passed}/5 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL marginstmt-v562 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

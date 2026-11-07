/* v561 매출 기준 = 작업내역서 — 대표 결정(2026-11-07): "견적은 매출로 세지마, 매출은 내역서로 변경 할 거야".
   저장본 goals.salesBasis==='stmt' 이면 매출 한 벌(hjSalesEntries — 월말 결산·부가세 준비·세무 엑셀·매출 추이·세금계산서 발행 대조)과
   현장 매출(projStats.sales)은 작업내역서(📑 반영으로 만든 앱 견적 — q.stmt, 가상 파일 _stmt)만 센다. 견적서 파일·일반 앱 견적은 '견적'.
   청구서·거래명세서·고객 페이지·입금 문자가 쓰는 projStats.est·bill·due 와 마진은 이 판에서 그대로다. 설정이 없으면 예전과 같다.
   합성 자료만, 바깥 쓰기 0. 날짜는 '지난달'(PYM)로 — 매출 추이(최근 3개월)에 들어가게.
   시드: 가온(견적서 파일 3,300,000 + 작업내역서 220,000) · 나래(견적서 파일 5,500,000) · 현장 없는 견적서 1,100,000 ·
         현장 없는 '수주' 앱 견적 770,000 → 기본 매출 합계 10,890,000.
   ① 설정 없음 — 매출 한 벌·월말 결산·현장 견적 합계·대시보드 글자는 예전 그대로 (DEFAULT)
   ② 작업내역서 기준을 켜면 매출 한 벌은 내역서 220,000 만 — 월말 결산·부가세 준비·매출 추이·발행 대조 같은 값 (STMT)
   ③ 현장 숫자 — est·bill·due(청구·고객 숫자)는 그대로, sales 만 내역서 · 내역서 없는 현장 sales 0 (PROJ)
   ④ 화면 글자 — 대시보드 '총 견적' + '매출(내역서)' 칸 · 표 머리 · 월말 결산 문구 · 경영 현황 '월 매출' · 증빙 묶음 줄 (LABELS)
   ⑤ 📊 매출 목표 화면의 켜기(44px)·끄기 · 저장본(serializeData→applyData)으로 기기 사이에 따라감 · 월·연 목표는 안 건드림 (TOGGLE)
   ⑥ 소스·핀 3곳(v561 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V561_BASELINE=<commit> 은 ② 에서, HJ_V561_MUTATION=no-filter(견적 파일 거르기 한 조각 삭제) 은 ② 에서 실패해야 한다. */
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
const FILTER = "if(!e||!hjSalesFileOk(f))return;";
let html = process.env.HJ_V561_BASELINE ? execFileSync('git', ['show', process.env.HJ_V561_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V561_MUTATION) {
  assert.equal(process.env.HJ_V561_MUTATION, 'no-filter', 'unknown mutation ' + process.env.HJ_V561_MUTATION);
  assert.equal(SRC.split(FILTER).length, 2, 'mutation anchor');
  html = SRC.replace(FILTER, 'if(!e)return;');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS salesbasis-v561 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
    window.__toasts = []; const t0 = toast; toast = (msg, ...rest) => { window.__toasts.push(String(msg)); try { return t0(msg, ...rest); } catch (_) { return undefined; } };
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const PYM = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온'), P('나래')];
  state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null;
  state.goals = { month: 10000000, year: 120000000 };
  const est = (id, name, project, amount, day) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, prefix: project ? '_정리완료/' + project + '/견적서/' : '', size: 1000 + amount % 997,
    est: { customer: name.replace(/\.xlsx$/, ''), amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date: PYM + '-' + day }, when: new Date(PYM + '-' + day + 'T09:00:00+09:00') });
  state.files = [est('E_A', '가온_견적서.xlsx', '가온', 3300000, '05'), est('E_B', '나래_견적서.xlsx', '나래', 5500000, '08'), est('E_L', '미지정_견적서.xlsx', '', 1100000, '09')];
  const sq = hjStmtBuildQuote({ src: 'S1.xlsx', file: 'S1.xlsx', doc: '작업내역서', to: '시험누수', date: PYM + '-20', vat: 'included', project: '가온',
    lines: [{ d: PYM + '-20', loc: '가온 101-1', work: '누수탐지', amt: 220000 }] });
  state.quotes.push(sq); syncQuoteToProject(sq);
  state.quotes.push({ id: 'WQ', title: '수주 견적', no: '제' + PYM.replace('-', '') + '12', date: PYM + '-12', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '', items: [{ name: '도배', spec: '', qty: 1, price: 700000 }], result: 'won' });   // 단가 = 공급가 → 부가세 포함 770,000
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
  return PYM;
};
const numbers = (page, PYM) => page.evaluate(PYM => {
  const S = hjSalesEntries(), m = collectQuotesByMonth()[PYM] || { count: 0, total: 0 }, v = vatReportData(PYM, PYM), t = revenueTrendData(3).rows.find(r => r.ym === PYM) || {};
  const pj = n => { const s = projStats(n); return { est: s.est, bill: s.bill, due: s.due, sales: s.sales, salesSupply: s.salesSupply }; };
  return { n: S.length, total: S.reduce((a, r) => a + r.amount, 0), stmtOnly: S.every(r => !!(r.file && r.file._stmt)), month: m.total, monthN: m.count, closing: monthlyClosingData(PYM).total,
    vat: v.salesSupply + v.salesVat, vatN: v.salesCount, trend: t.est, issue: hjTaxIssueSales(PYM + '-01', PYM + '-31').reduce((a, r) => a + Number(r.amount), 0), A: pj('가온'), B: pj('나래') };
}, PYM);

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    const PYM = await page.evaluate(SEED);
    let base;
    await test('① 설정 없음 — 매출 한 벌·월말 결산·현장 견적 합계·대시보드 글자는 예전 그대로 (DEFAULT)', async () => {
      base = await numbers(page, PYM);
      assert.equal(base.total, 10890000, '기본 매출 = 견적서 3장 + 내역서 + 수주 앱 견적 — ' + JSON.stringify(base));
      assert.equal(base.n, 5, '매출 5건');
      assert.equal(base.month, 10890000, '월말 결산 묶음'); assert.equal(base.closing, 10890000, '월말 결산');
      assert.equal(base.vat, 10890000, '부가세 준비 공급가+세액'); assert.equal(base.trend, 10890000, '매출 추이');
      assert.equal(base.A.est, 3520000, '가온 견적 합계 = 견적서 + 내역서'); assert.equal(base.B.est, 5500000, '나래 견적 합계');
      const ui = await page.evaluate(() => ({ kpi: (document.querySelector('.kpis') || {}).innerText || '', salesKpi: !!document.querySelector('[data-sales-kpi]'),
        th: [...document.querySelectorAll('#dashboardMarginTable thead th')].map(th => th.innerText.trim()).slice(0, 2) }));
      assert.ok(ui.kpi.includes('총 견적(매출)'), '대시보드 글자 그대로 — ' + ui.kpi);
      assert.equal(ui.salesKpi, false, '설정 없으면 매출(내역서) 칸 없음');
      assert.deepEqual(ui.th, ['현장', '견적(매출)'], '마진 표 머리 그대로');
    });
    let on;
    await test('② 작업내역서 기준을 켜면 매출 한 벌은 내역서 220,000 만 — 월말 결산·부가세 준비·매출 추이·발행 대조 같은 값 (STMT)', async () => {
      const basis = await page.evaluate(() => hjSalesBasisSet(true));
      assert.equal(basis, 'stmt', '설정이 켜짐');
      on = await numbers(page, PYM);
      assert.equal(on.total, 220000, '매출 = 작업내역서만 — ' + JSON.stringify(on));
      assert.equal(on.n, 1, '매출 1건'); assert.equal(on.stmtOnly, true, '남은 건 내역서 가상 파일');
      assert.deepEqual([on.month, on.monthN, on.closing], [220000, 1, 220000], '월말 결산');
      assert.deepEqual([on.vat, on.vatN], [220000, 1], '부가세 준비');
      assert.equal(on.trend, 220000, '매출 추이');
      assert.equal(on.issue, 220000, '세금계산서 발행 대조(수주 기준)');
    });
    await test('③ 현장 숫자 — est·bill·due(청구·고객 숫자)는 그대로, sales 만 내역서 · 내역서 없는 현장 sales 0 (PROJ)', async () => {
      assert.deepEqual([on.A.est, on.A.bill, on.A.due], [base.A.est, base.A.bill, base.A.due], '가온 청구·고객 숫자 그대로 — ' + JSON.stringify([base.A, on.A]));
      assert.deepEqual([on.B.est, on.B.bill, on.B.due], [base.B.est, base.B.bill, base.B.due], '나래 청구·고객 숫자 그대로');
      assert.deepEqual([on.A.sales, on.A.salesSupply], [220000, 200000], '가온 매출 = 내역서');
      assert.equal(on.B.sales, 0, '나래는 내역서가 없어 매출 0');
      assert.deepEqual([base.A.sales, base.B.sales], [base.A.est, base.B.est], '설정이 없을 땐 sales = est');
    });
    await test('④ 화면 글자 — 대시보드 총 견적 + 매출(내역서) 칸 · 표 머리 · 월말 결산 문구 · 경영 현황 월 매출 · 증빙 묶음 줄 (LABELS)', async () => {
      const ui = await page.evaluate(PYM => {
        state.tab = 'dashboard'; render();
        const kpi = (document.querySelector('.kpis') || {}).innerText || '', sk = document.querySelector('[data-sales-kpi]');
        const th = [...document.querySelectorAll('#dashboardMarginTable thead th')].map(th => th.innerText.trim()).slice(0, 2);
        const closing = monthlyClosingText(monthlyClosingData(PYM));
        bizDashboard(); const biz = document.body.innerText; closeModal(true);
        const ev = hjEvidenceLedgerRows(state.projects.find(p => p.name === '가온')).slice(-2);
        return { kpi, sk: sk ? sk.innerText.replace(/\s+/g, ' ') : null, th, closing, biz: /\d+월 매출 /.test(biz), bizOld: /\d+월 견적 /.test(biz), ev, label: [hjEstLabel(), hjEstWord(), hjSalesLabel()] };
      }, PYM);
      assert.ok(ui.kpi.includes('총 견적') && !ui.kpi.includes('총 견적(매출)'), '대시보드 견적 칸은 \'견적\' — ' + ui.kpi);
      assert.ok(ui.sk && ui.sk.includes('매출(내역서)') && ui.sk.includes('22'), '매출(내역서) 칸 22만원 — ' + ui.sk);
      assert.deepEqual(ui.th, ['현장', '견적'], '마진 표 머리');
      assert.ok(ui.closing.includes('🧾 매출(내역서) 1건'), '월말 결산 문구 — ' + ui.closing);
      assert.ok(ui.biz && !ui.bizOld, '경영 현황 \'N월 매출\'');
      assert.deepEqual(ui.ev, [['견적', 3520000, '', '', '', ''], ['매출(내역서)', 220000, '', '', '', '']], '증빙 묶음 수금 표 끝 두 줄');
      assert.deepEqual(ui.label, ['견적', '견적', '매출(내역서)'], '이름 함수');
    });
    await test('⑤ 📊 매출 목표 화면의 켜기(44px)·끄기 · 저장본으로 기기 사이에 따라감 · 월·연 목표는 안 건드림 (TOGGLE)', async () => {
      const r = await page.evaluate(async () => {
        hjSalesBasisSet(false); window.__toasts = [];
        goalManage();
        const box = document.querySelector('[data-sales-basis]'), cb = document.getElementById('goalSalesStmt');
        const h = box ? Math.round(box.getBoundingClientRect().height) : 0, w = box ? Math.round(box.getBoundingClientRect().width) : 0, unchecked = cb && !cb.checked;
        cb.click();
        const afterOn = { basis: hjSalesBasis(), goals: JSON.parse(JSON.stringify(state.goals)), toast: window.__toasts.slice() };
        const snap = JSON.parse(JSON.stringify(serializeData()));
        state.goals = {}; const lost = hjSalesBasis();
        applyData(JSON.parse(JSON.stringify(snap)));
        const restored = hjSalesBasis();
        closeModal(true); goalManage();
        const cb2 = document.getElementById('goalSalesStmt'), checked2 = !!(cb2 && cb2.checked);
        cb2.click();
        const afterOff = { basis: hjSalesBasis(), goals: JSON.parse(JSON.stringify(state.goals)) };
        closeModal(true);
        return { h, w, vw: innerWidth, unchecked, afterOn, snapBasis: snap.goals && snap.goals.salesBasis, lost, restored, checked2, afterOff };
      });
      assert.ok(r.h >= 44, '켜기 칸 높이 44px 이상 — ' + r.h);
      assert.ok(r.w <= r.vw, '390px 안에 들어감 — ' + r.w + '/' + r.vw);
      assert.equal(r.unchecked, true, '꺼진 채로 시작');
      assert.equal(r.afterOn.basis, 'stmt', '누르면 켜짐');
      assert.deepEqual(r.afterOn.goals, { month: 10000000, year: 120000000, salesBasis: 'stmt' }, '월·연 목표 그대로 + 설정');
      assert.ok(r.afterOn.toast.some(t => t.includes('작업내역서만')), '안내 — ' + JSON.stringify(r.afterOn.toast));
      assert.equal(r.snapBasis, 'stmt', '저장본에 실림');
      assert.deepEqual([r.lost, r.restored], ['all', 'stmt'], '저장본을 받으면 같은 기준');
      assert.equal(r.checked2, true, '다시 열면 켜진 상태로 보임');
      assert.deepEqual(r.afterOff, { basis: 'all', goals: { month: 10000000, year: 120000000 } }, '끄면 설정 키가 빠지고 목표는 그대로');
      const back = await numbers(page, PYM);
      assert.equal(back.total, 10890000, '끄면 예전 매출로 돌아옴');
    });
    await test('⑥ 소스·핀 3곳(v561 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 561, '핀 v561 이상 ' + a);
      assert.ok(src.includes(FILTER), '매출 한 벌의 내역서 거르기가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
    console.log(`salesbasis-v561: ${passed}/6 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL salesbasis-v561 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

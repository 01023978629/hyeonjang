/* sales-basis.e2e.js — 매출 집계 기준이 화면마다 같은지 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.

   대시보드(projStats)는 중복 견적을 걸러내고 '집계 제외(exSum)' 견적도 뺀다.
   그런데 월말 결산·부가세 신고 준비·세무 엑셀은 state.files 를 원시 필터로 훑어
   중복과 exSum 을 그대로 더하고 있었다.

     실측: 둔산동 초안 3,000만(자동 exSum) + 확정 4,000만
       대시보드   40,000,000  (정답)
       월말 결산  70,000,000  ✗
       매출세액    7,000,000  ✗  (정답 4,000,000) → 300만원 과다

   앱은 폴더 스캔 때 exSum 을 찍고 "매출 집계에서 제외했어요"라고 알려준다.
   제외했다고 말해놓고 세무 경로만 무시하면, 그 말을 믿은 사장님이 손해를 본다.

   ※ 중복 판정은 현장 안에서만 해야 한다. 1차 키가 파일명이라, 전체를 한 번에 넣으면
     이름이 같은 다른 현장 견적이 묶여 매출이 통째로 사라진다 — 그 회귀도 여기서 막는다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // files: [id, name, ext, project, amount, exSum]
  const seed = (projects, files) => page.evaluate((a) => {
    state.projects = a.projects.map(n => ({ name: n, stage: 2, received: 0, phases: [], cost: {},
                                            customer: { name: '', phone: '', addr: '' }, archived: false }));
    state.quotes = []; state.expenses = []; state.schedule = []; state.payLog = [];
    state.files = a.files.map(f => ({
      id: f[0], name: f[1], ext: f[2], kind: 'estimate', project: f[3], exSum: !!f[5],
      est: { customer: f[1], amount: f[4], supply: f[4], vat: Math.round(f[4] * 0.1), date: '2026-05-05' },
      when: new Date('2026-05-05'),
    }));
  }, { projects, files });

  const numbers = () => page.evaluate(() => {
    const v = vatReportData('2026-04', '2026-06');
    return {
      dash: state.projects.reduce((a, p) => a + projStats(p.name).est, 0),
      month: monthlyClosingData('2026-05').total,
      vatSupply: v.salesSupply, vatTax: v.salesVat, vatCount: v.salesCount,
      basis: salesEstimateFiles().map(f => f.name),
    };
  });

  await test("'집계 제외'한 견적이 결산·부가세에서도 빠진다", async () => {
    await seed(['둔산동'], [
      ['a', '둔산동 초안.xlsx', 'xlsx', '둔산동', 30000000, true],
      ['b', '둔산동 확정 견적.xlsx', 'xlsx', '둔산동', 40000000, false],
    ]);
    const r = await numbers();
    assert(r.dash === 40000000, '대시보드: ' + r.dash);
    assert(r.month === 40000000, '월말 결산이 집계 제외를 무시했다: ' + r.month + ' (정답 40,000,000)');
    assert(r.vatSupply === 40000000, '부가세 공급가가 집계 제외를 무시했다: ' + r.vatSupply);
    assert(r.vatTax === 4000000, '매출세액: ' + r.vatTax + ' (정답 4,000,000)');
    assert(r.dash === r.month && r.month === r.vatSupply,
      '화면마다 매출이 다르다: ' + JSON.stringify(r));
  });

  await test('중복 견적(엑셀+PDF 사본)도 한 번만 잡힌다', async () => {
    await seed(['망원동'], [
      ['a', '망원동 견적.xlsx', 'xlsx', '망원동', 7000000, false],
      ['b', '망원동 견적서.pdf', 'pdf', '망원동', 7000000, false],
    ]);
    const r = await numbers();
    assert(r.dash === 7000000, '대시보드: ' + r.dash);
    assert(r.month === 7000000, '월말 결산이 사본을 또 셌다: ' + r.month);
    assert(r.vatSupply === 7000000, '부가세가 사본을 또 셌다: ' + r.vatSupply);
    assert(r.vatCount === 1, '부가세 매출 건수: ' + r.vatCount);
    assert(r.basis.length === 1 && /\.xlsx$/.test(r.basis[0]), '대표가 엑셀(원본)이어야 한다: ' + JSON.stringify(r.basis));
  });

  await test('파일명이 같은 다른 현장은 합쳐지지 않는다 (중복 판정은 현장 안에서만)', async () => {
    await seed(['A현장', 'B현장'], [
      ['1', '견적서.xlsx', 'xlsx', 'A현장', 5000000, false],
      ['2', '견적서.xlsx', 'xlsx', 'B현장', 5000000, false],
    ]);
    const r = await numbers();
    assert(r.dash === 10000000, '두 현장 매출이 합쳐져 사라졌다: ' + r.dash + ' (정답 10,000,000)');
    assert(r.vatSupply === 10000000, '부가세 공급가: ' + r.vatSupply);
    assert(r.vatCount === 2, '부가세 매출 건수가 2건이어야 한다: ' + r.vatCount);
  });

  await test('현장 미배정 견적도 매출에서 빠지지 않는다', async () => {
    await seed(['A현장'], [
      ['1', '미배정 견적.xlsx', 'xlsx', null, 3000000, false],
      ['2', 'A현장 견적.xlsx', 'xlsx', 'A현장', 2000000, false],
    ]);
    const r = await numbers();
    assert(r.vatSupply === 5000000, '미배정 견적이 부가세에서 빠졌다: ' + r.vatSupply + ' (정답 5,000,000)');
    assert(r.vatCount === 2, '건수: ' + r.vatCount);
  });

  await test('집계 제외만 있으면 매출은 0이다', async () => {
    await seed(['둔산동'], [['a', '둔산동 초안.xlsx', 'xlsx', '둔산동', 30000000, true]]);
    const r = await numbers();
    assert(r.dash === 0 && r.month === 0 && r.vatSupply === 0,
      '집계 제외뿐인데 매출이 잡혔다: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== sales-basis: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

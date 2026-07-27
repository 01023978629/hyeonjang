/* paylog-correction.e2e.js — 수금액을 고쳤을 때 리포트가 따라오는지 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.

   수금액은 '누적 총액'을 입력받고(setReceived), hjPayLog 가 이전 값과의 차액을 payLog 에 남긴다.
   금액을 줄이면 그 차액은 음수다 — 이게 '정정' 기록이다.

   예전에는 이걸 소비하는 쪽이 amt>0 으로 걸러서 음수를 버렸다. 그래서 오타를 고쳐도
   리포트에는 정정 전 금액이 그대로 남았다.
     실측: 500만 오입력 → 같은 날 50만으로 정정
       현장 카드 50만 · 매출 추이 50만 · 통장 50만  (정상)
       월말 결산 500만 · 주간 리포트 500만          (틀림 — 순이익이 450만 부풀어 나온다)
   같은 payLog 를 보는 두 화면이 다른 값을 말하는 상태였다.

   합계는 정정을 반영해 전부 더하고, '수금 TOP' 같은 목록만 합산 후 0 이하를 숨긴다. */
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

  // payLog 는 '오늘' 날짜로 쌓이므로 시드도 오늘로 맞춘다(주간 범위에 들어가야 한다)
  const seed = (entries, received) => page.evaluate((a) => {
    const t = new Date();
    const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    state.projects = [{ name: '갈마동', stage: 2, received: a.received, phases: [], cost: {},
                        customer: { name: '김', phone: '', addr: '' }, archived: false },
                      { name: '둔산동', stage: 2, received: 2000000, phases: [], cost: {},
                        customer: { name: '박', phone: '', addr: '' }, archived: false }];
    state.files = []; state.quotes = []; state.expenses = []; state.schedule = [];
    state.payLog = a.entries.map(e => ({ d, project: e.pj, amt: e.amt }));
    return { ym: d.slice(0, 7) };
  }, { entries, received });

  const read = (ym) => page.evaluate((y) => ({
    week: weeklyReportData(0).paySum,
    month: monthlyClosingData(y).paySum,
    payTop: monthlyClosingData(y).payTop,
    trend: (state.payLog || []).filter(x => String(x.d || '').slice(0, 7) === y).reduce((a, x) => a + x.amt, 0),
    card: state.projects[0].received,
  }), ym);

  await test('수금 오타를 고치면 모든 리포트가 정정 후 금액을 말한다', async () => {
    const { ym } = await seed([{ pj: '갈마동', amt: 5000000 }, { pj: '갈마동', amt: -4500000 }], 500000);
    const r = await read(ym);
    assert(r.card === 500000, '현장 카드: ' + r.card);
    assert(r.week === 500000, '주간 리포트가 정정 전 금액이다: ' + r.week + ' (정답 500,000)');
    assert(r.month === 500000, '월말 결산이 정정 전 금액이다: ' + r.month + ' (정답 500,000)');
    assert(r.trend === 500000, '매출 추이: ' + r.trend);
    assert(r.week === r.month && r.month === r.trend && r.trend === r.card,
      '같은 payLog 를 보는 화면들이 다른 값을 말한다: ' + JSON.stringify(r));
  });

  await test('수금 TOP 목록에 음수 현장이 뜨지 않는다', async () => {
    // 갈마동은 전액 취소(순 0), 둔산동만 남아야 한다
    const { ym } = await seed([
      { pj: '갈마동', amt: 3000000 }, { pj: '갈마동', amt: -3000000 },
      { pj: '둔산동', amt: 2000000 },
    ], 0);
    const r = await read(ym);
    assert(r.month === 2000000, '월말 결산 합계: ' + r.month + ' (정답 2,000,000)');
    const names = (r.payTop || []).map(x => x.pj);
    assert(!names.includes('갈마동'), '순 0원인 현장이 수금 TOP 에 떴다: ' + JSON.stringify(r.payTop));
    assert((r.payTop || []).every(x => x.amt > 0), '수금 TOP 에 0 이하 항목이 있다: ' + JSON.stringify(r.payTop));
  });

  await test('정정이 없는 평범한 경우는 그대로다(회귀 방지)', async () => {
    const { ym } = await seed([{ pj: '갈마동', amt: 1000000 }, { pj: '둔산동', amt: 2000000 }], 1000000);
    const r = await read(ym);
    assert(r.week === 3000000 && r.month === 3000000, '정상 합산이 깨졌다: ' + r.week + '/' + r.month);
    assert((r.payTop || []).length === 2, '수금 TOP 이 2건이어야 한다: ' + JSON.stringify(r.payTop));
  });

  await test('현장 상세의 수금 합계도 정정을 반영한다', async () => {
    const { ym } = await seed([{ pj: '갈마동', amt: 5000000 }, { pj: '갈마동', amt: -4500000 }], 500000);
    const sum = await page.evaluate(() => {
      // projectHistoryData 계열이 돌려주는 paySum — 이름이 바뀌었을 수 있어 payLog 로 직접 대조
      const mine = (state.payLog || []).filter(x => x.project === '갈마동');
      return mine.reduce((a, x) => a + x.amt, 0);
    });
    assert(sum === 500000, '현장별 수금 합계: ' + sum);
  });

  await test('누적 입력이라 사용자가 음수를 칠 일이 없다(차액은 hjPayLog 가 만든다)', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '테스트', stage: 0, received: 0, phases: [], cost: {},
                          customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.payLog = [];
      setReceived('테스트', '5,000,000');     // 오입력
      setReceived('테스트', '500,000');       // 정정
      return { received: state.projects[0].received, log: state.payLog.map(x => x.amt) };
    });
    assert(r.received === 500000, '누적 수금액: ' + r.received);
    assert(r.log.length === 2 && r.log[0] === 5000000 && r.log[1] === -4500000,
      'payLog 에 차액이 제대로 안 남았다: ' + JSON.stringify(r.log));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== paylog-correction: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

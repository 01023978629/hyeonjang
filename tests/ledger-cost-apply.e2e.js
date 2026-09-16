/* ledger-cost-apply.e2e.js — [📒 장부에서 원가 불러오기] 모달의 [반영] 이 실제로 돈다 (v300)

   보호하는 사고: 모달은 #modalRoot 에 그려지는데 클릭 위임은 #view 에 걸려 있다.
   둘은 형제라 위임이 닿지 않는다. 그래서 [반영] 버튼은 셀렉터 목록에도 있고
   핸들러도 있는데 **눌러도 아무 일이 없었다** — 오류도 토스트도 없이 조용했다.

   v298 의 [동·호수 관리] 와 증상은 같지만 원인이 다르다. 그쪽은 셀렉터 목록에서
   빠진 것이고, 이쪽은 목록에 있어도 위임이 닿지 않는 자리에 있었다. 그래서
   tests/click-delegation.check.js(정적)로는 못 잡는다 — 그 검사는 "목록에 있나"만 본다.
   모달 버튼은 이렇게 **눌러 보는 수밖에 없다.**

     ① [반영] 을 눌러야만 원가가 들어간다 (누르기 전에는 0)
     ② 수기로 넣은 값(0이 아님)은 덮지 않는다
     ③ 태깅된 지출이 없는 현장은 목록에 없다
     ④ 두 번 눌러도 두 배가 되지 않는다
     ⑤ 저장된 자료에도 남는다 (새로고침 왕복)

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
let browser, passed = 0;

async function boot() {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  const gisDone = page.waitForEvent('requestfailed', { predicate: r => r.url() === 'https://accounts.google.com/gsi/client', timeout: 20000 });
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' }); await gisDone;
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const P = (name, cost) => ({ name, archived: false, stage: 2, received: 0, phases: [], cost,
      customer: {}, geo: null });
    state.projects = [
      P('가상 빈원가현장', { material: 0, labor: 0, outsource: 0 }),
      P('가상 수기원가현장', { material: 777000, labor: 0, outsource: 0 }),   // 수기 값은 덮으면 안 된다
      P('가상 지출없는현장', { material: 0, labor: 0, outsource: 0 }),        // 태깅된 지출 없음
    ];
    state.expenses = [
      { id: 'ex1', project: '가상 빈원가현장', category: '자재비', amount: 500000, date: '2026-09-01' },
      { id: 'ex2', project: '가상 빈원가현장', category: '외주비', amount: 300000, date: '2026-09-02' },
      { id: 'ex3', project: '가상 수기원가현장', category: '자재비', amount: 900000, date: '2026-09-03' },
      { id: 'ex4', project: '가상 수기원가현장', category: '외주비', amount: 100000, date: '2026-09-04' },
    ];
    state.files = []; state.payLog = []; state.activeProject = null; state.tab = 'dashboard';
    state._demo = false; state.dirty = false; state.dirHandle = null; __tabStale = false;
    window.__toasts = []; const nativeToast = toast;
    toast = function(t) { window.__toasts.push(String(t)); try { return nativeToast.apply(this, arguments); } catch (e) {} };
    render(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw new Error('virtual fixture baseline failed to persist');
    await __appStateWriteQueue;
  });
  return { context, page, errors };
}
const cost = (page, name) => page.evaluate(n => {
  const p = state.projects.find(p => p.name === n); return p ? [p.cost.material, p.cost.labor, p.cost.outsource] : null;
}, name);

async function scenario(name, fn) {
  const test = await boot();
  try { await fn(test); assert.deepEqual(test.errors, [], 'pageerror 0'); passed++; console.log('PASS ' + name); }
  finally { await test.context.close(); }
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  await scenario('[반영] 을 눌러야 원가가 들어간다 · 수기 값은 덮지 않는다 · 두 번 눌러도 두 배가 안 된다', async ({ page }) => {
    await page.evaluate(() => hjLoadCostFromLedger());
    const btn = page.locator('#modalRoot [data-ledgercost="가상 빈원가현장"]');
    await btn.waitFor({ state: 'visible' });

    // 지출이 없는 현장은 제안 자체가 없다
    assert.equal(await page.locator('#modalRoot [data-ledgercost="가상 지출없는현장"]').count(), 0,
      '태깅된 지출이 없는 현장은 목록에 없다');

    assert.deepEqual(await cost(page, '가상 빈원가현장'), [0, 0, 0], '누르기 전에는 0이다');

    await btn.click();
    // 여기서 멈추면 그게 이 검사가 잡으려는 사고다 — 모달 버튼은 #view 위임이 닿지 않는다
    await page.waitForFunction(() => state.projects.find(p => p.name === '가상 빈원가현장').cost.material === 500000, null, { timeout: 8000 })
      .catch(() => { throw new Error('[반영] 을 눌렀는데 원가가 들어가지 않았다 — 모달(#modalRoot) 버튼은 #view 클릭 위임이 닿지 않는다. openModal 직후에 직접 배선했는지 확인하라'); });
    assert.deepEqual(await cost(page, '가상 빈원가현장'), [500000, 0, 300000], '자재비·외주비가 들어간다');

    // 수기로 넣은 자재비는 그대로, 0이던 외주비만 들어간다
    await page.locator('#modalRoot [data-ledgercost="가상 수기원가현장"]').click();
    await page.waitForFunction(() => state.projects.find(p => p.name === '가상 수기원가현장').cost.outsource === 100000, null, { timeout: 8000 });
    assert.deepEqual(await cost(page, '가상 수기원가현장'), [777000, 0, 100000],
      '수기로 넣은 값(0이 아님)은 절대 덮지 않는다');

    // 다시 눌러도 더해지지 않는다
    await page.evaluate(() => { closeModal(); hjLoadCostFromLedger(); });
    const again = await page.locator('#modalRoot [data-ledgercost="가상 빈원가현장"]').count();
    if (again) {
      await page.locator('#modalRoot [data-ledgercost="가상 빈원가현장"]').click();
      await page.waitForTimeout(600);
    }
    assert.deepEqual(await cost(page, '가상 빈원가현장'), [500000, 0, 300000], '두 번 눌러도 두 배가 되지 않는다');
  });

  await scenario('반영한 원가는 저장된 자료에도 남는다', async ({ page }) => {
    await page.evaluate(() => hjLoadCostFromLedger());
    await page.locator('#modalRoot [data-ledgercost="가상 빈원가현장"]').click();
    await page.waitForFunction(() => state.projects.find(p => p.name === '가상 빈원가현장').cost.material === 500000, null, { timeout: 8000 });
    await page.evaluate(async () => { closeModal(); await guardedPersistCurrentState(); await __appStateWriteQueue; });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone);
    await page.evaluate(() => window.__hjRestoreDone);
    assert.deepEqual(await cost(page, '가상 빈원가현장'), [500000, 0, 300000], '새로고침해도 남아 있다');
  });

  console.log('\n== ledger-cost-apply: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => { console.error('FAIL ledger-cost-apply', error && error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v455 자재(v439) 뒷정리 — 리허설 R6 에서 찾은 것. 합성 자료만, 외부 쓰기 0.
   ① 입고 취소하면 📦 재고로 옮긴 남은 자재를 되돌린다(옮긴 수량만큼, 0 아래 없음)·다시 입고하면 다시 옮길 수 있다(LEFTOVER_REVERTED)
   ② 입고 취소 → 재입고 → 원가 반영을 반복해도 단가 이력은 같은 날 같은 단가 한 줄(PRICE_HISTORY_NO_DUP) · 다른 날·다른 단가는 쌓인다
   ③ PC 1024px 첫 화면 견적서 내역 표는 옆으로 밀고 이름 칸이 눌리지 않는다.
   HJ_V455_BASELINE=<commit> 은 LEFTOVER_REVERTED 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_U1 둔산 욕실';
const html = process.env.HJ_V455_BASELINE ? execFileSync('git', ['show', process.env.HJ_V455_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async P => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = false; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.inventory = [];
    state.suppliers = [{ id: 'TEST_SUP', name: 'TEST_대전타일', category: '자재', phone: '010-0000-5001' }];
    state.projects = [{ name: P, kind: 'interior', stage: 2, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-5002', addr: '대전 서구 둔산동 1-1' },
      matOrders: [{ id: 'TEST_MO1', sup: 'TEST_대전타일', items: [{ name: '타일 600각', spec: '', qty: 40, unit: '장', price: 12000 }, { name: '타일 본드', spec: '', qty: 5, unit: '포', price: 9000 }], due: localDate(), at: new Date().toISOString() }] }];
    const item = (name, qty, price) => ({ name, spec: '', qty, price });
    state.quotes = [{ id: 'TEST_UQ1', project: P, title: '욕실 리모델링 — 기본안 긴 제목 테스트', no: 'A', date: localDate(), vatIncluded: true, items: [item('타일', 10, 100000)] }];
    state.quotes.forEach(q => syncQuoteToProject(q));
    state.tab = 'dashboard'; render();
  }, P);
  async function test(name, fn) { await fn(); passed++; console.log('PASS material2-v455 ' + name); }

  await test('① 입고 → 남은 자재 재고로 → 입고 취소하면 재고에서 되돌림 → 재입고하면 다시 옮길 수 있음(LEFTOVER_REVERTED)', async () => {
    const r = await page.evaluate(() => {
      const id = 'TEST_MO1'; hjMatReceive(id, true); const f = hjMatFind(id); f.o.items[0].left = 6; f.o.items[1].left = 1;
      const m1 = hjMatLeftToInventory(id); const inv1 = state.inventory.map(x => [x.name, x.qty]);
      hjMatReceive(id, false); const inv2 = state.inventory.map(x => [x.name, x.qty]); const flags = f.o.items.map(x => !!x.movedToInv);
      hjMatReceive(id, true); const m2 = hjMatLeftToInventory(id); const inv3 = state.inventory.map(x => [x.name, x.qty]);
      return { m1: m1.moved, inv1, inv2, flags, m2: m2.moved, inv3, recv: !!f.o.recvAt };
    });
    assert.deepEqual(r, { m1: 2, inv1: [['타일 600각', 6], ['타일 본드', 1]], inv2: [['타일 600각', 0], ['타일 본드', 0]], flags: [false, false], m2: 2, inv3: [['타일 600각', 6], ['타일 본드', 1]], recv: true }, 'LEFTOVER_REVERTED ' + JSON.stringify(r));
    const floor = await page.evaluate(() => { const f = hjMatFind('TEST_MO1'); state.inventory[0].qty = 2; hjMatReceive('TEST_MO1', false); const q = state.inventory[0].qty; hjMatReceive('TEST_MO1', true); return q; });
    assert.equal(floor, 0, 'never below zero when the owner used some of the stock');
  });

  await test('② 입고 취소 → 재입고 → 원가 반영을 세 번 해도 단가 이력은 한 줄 · 다른 날·다른 단가는 쌓임(PRICE_HISTORY_NO_DUP)', async () => {
    const r = await page.evaluate(() => {
      const id = 'TEST_MO1'; const sup = () => state.suppliers.find(s => s.name === 'TEST_대전타일');
      for (let i = 0; i < 3; i++) { hjMatCostRevert(id); hjMatReceive(id, false); hjMatReceive(id, true); hjMatCostApply(id); }
      const after3 = (sup().prices || []).filter(x => x.name === '타일 600각').length, material = state.projects[0].cost.material;
      hjSupPriceAdd('TEST_대전타일', { name: '타일 600각', unit: '장', price: 12500, at: localDate() }, 'recv');
      hjSupPriceAdd('TEST_대전타일', { name: '타일 600각', unit: '장', price: 12000, at: hjAddDays(localDate(), -3) }, 'recv');
      return { after3, material, later: (sup().prices || []).filter(x => x.name === '타일 600각').map(x => [x.price, x.at === localDate() ? 'today' : 'earlier']) };
    });
    assert.equal(r.after3, 1, 'PRICE_HISTORY_NO_DUP ' + JSON.stringify(r)); assert.equal(r.material, 40 * 12000 + 5 * 9000, 'cost applied once');
    assert.deepEqual(r.later, [[12000, 'earlier'], [12000, 'today'], [12500, 'today']]);
  });

  await test('③ PC 1024px 첫 화면 견적서 내역 표 — 옆으로 밀고 이름 칸이 눌리지 않음', async () => {
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    const r = await page.evaluate(() => { const t = document.getElementById('dashboardQuoteTable'); const wrap = t.parentElement; const first = t.querySelector('tbody td'); return { scroll: getComputedStyle(wrap).overflowX, min: getComputedStyle(t).minWidth, lines: first ? Math.round(first.getBoundingClientRect().height / 18) : 0, overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
    assert.equal(r.scroll, 'auto'); assert.equal(r.min, '900px'); assert(r.lines <= 3, 'name cell lines ' + r.lines); assert.equal(r.overflow, false);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`material2-v455: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL material2-v455', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

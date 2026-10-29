/* v439 자재상 명단·발주→입고→원가·단가표·남은 자재 — 합성 레코드만, 외부 쓰기 0.
   HJ_V439_BASELINE=<commit> 은 MATERIAL_API_PRESENT 에서, HJ_V439_MUTATION=cost-guard(costApplied 가드 제거) 는 MAT_COST_ONCE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_MAT_LEAK', INT = 'TEST_MAT_INTERIOR';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V439_BASELINE && execFileSync('git', ['show', process.env.HJ_V439_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.accept());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v439Calls = { external: [] };
    window.open = (...args) => { __v439Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v439Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjSupPriceAdd', 'hjSupPriceSuggest', 'hjSupPriceTable', 'hjSupPriceTableView', 'hjMatOrderTotal', 'hjMatCostApply', 'hjMatCostRevert', 'hjMatCostAsk', 'hjMatLeftView', 'hjMatLeftToInventory', 'hjSupImportRows', 'hjSupParseCsv', 'hjSupRemove', 'hjQuoteCostHintHtml', 'hjMatCostPending'].every(k => typeof window[k] === 'function')), true, 'MATERIAL_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V439_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  if (process.env.HJ_V439_MUTATION) {
    assert.equal(process.env.HJ_V439_MUTATION, 'cost-guard');
    await page.evaluate(() => { const real = hjMatCostApply; hjMatCostApply = (id, amount) => { const f = hjMatFind(id); if (f && f.o.costApplied) { delete f.o.costApplied; } return real(id, amount); }; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS material-v439 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, int }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const project = (name, kind) => ({ name, kind, stage: 2, phases: [], customer: { name: 'TEST_CUST', phone: '', addr: '' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak'); p.leak = { intake: { where: ['욕실'], at: localDate() + 'T01:00:00.000Z' } };
      state.projects = [p, project(int, 'interior')];
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v439Calls.external = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V439_SEED_SAVE_FAILED');
    }, { leak: LEAK, int: INT });
  }
  async function snapshot() {
    return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() }; });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function shot(name) {
    if (!process.env.HJ_V439_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V439_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V439_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  await test('supplier directory: add material supplier, edit, hide/unhide, delete, CSV merge', async () => {
    await seed(); const keys = (await snapshot()).keys;
    await page.evaluate(() => supplierEditDialog(null, { category: '자재' })); await page.locator('#supName').waitFor();
    assert.equal(await page.locator('#supMatFields').isHidden(), false, 'material fields show for 자재');
    await page.locator('#supName').fill('한밭철물'); await page.locator('#supPhone').fill('042-000-0001'); await page.locator('#supAddr').fill('대전 중구 대종로 1'); await page.locator('#supHours').fill('평일 07:30~18:00');
    await page.locator('#supPay').selectOption('월말 외상'); await page.locator('#supDelivery').check(); await page.locator('#supItems').fill('배관 부속, 실리콘');
    await tapOk('#modalRoot .mfoot button, .supCat'); await noOverflow(); await footer('저장').click(); await page.locator('.supRow').waitFor();
    const s = await page.evaluate(() => state.suppliers[0]);
    assert.deepEqual([s.name, s.category, s.phone, s.addr, s.hours, s.pay, s.delivery, s.items], ['한밭철물', '자재', '042-000-0001', '대전 중구 대종로 1', '평일 07:30~18:00', '월말 외상', true, '배관 부속, 실리콘']);
    assert.match(await page.locator('.supRow').innerText(), /월말 외상 · 배송 가능/); await tapOk('#supAddMat, #supImport, #supPrices, .supRow'); await shot('01-suppliers');
    await page.locator('.supRow').click(); await page.locator('#supCats .supCat[data-c="외주"]').click(); assert.equal(await page.locator('#supMatFields').isHidden(), true, 'material fields hide for other categories');
    await page.locator('#supCats .supCat[data-c="자재"]').click(); await page.locator('#supHours').fill('평일 08:00~18:00'); await footer('저장').click(); await page.locator('.supRow').waitFor();
    assert.equal(await page.evaluate(() => state.suppliers[0].hours), '평일 08:00~18:00');
    const imported = await page.evaluate(() => { const rows = hjSupParseCsv('이름,전화,주소,품목\n"대전타일","042-000-0002","대전 서구","타일, 본드"\n한밭철물,,,\n중부도기,042-000-0003,대전 동구,"도기, 수전"\n'); return { rows: rows.length, r: hjSupImportRows(rows), names: state.suppliers.map(x => x.name).sort(), phone: state.suppliers.find(x => x.name === '한밭철물').phone }; });
    assert.equal(imported.rows, 4); assert.deepEqual(imported.r, { added: 2, merged: 0, skipped: 1 }); assert.deepEqual(imported.names, ['대전타일', '중부도기', '한밭철물']); assert.equal(imported.phone, '042-000-0001', 'existing values are kept');
    const merged = await page.evaluate(() => { state.suppliers.find(x => x.name === '중부도기').phone = ''; return hjSupImportRows([['중부도기', '042-999-9999', '', '']]); });
    assert.deepEqual(merged, { added: 0, merged: 1, skipped: 0 }); assert.equal(await page.evaluate(() => state.suppliers.find(x => x.name === '중부도기').phone), '042-999-9999');
    await page.evaluate(() => { hjSupPriceAdd('대전타일', { name: '타일 600각', unit: '장', price: 12000 }, 'manual'); markDirty(); });
    const rm = await page.evaluate(() => ({ tile: hjSupRemove('대전타일'), dogi: hjSupRemove('중부도기'), list: state.suppliers.map(x => [x.name, !!x.hidden]) }));
    assert.deepEqual(rm.tile, { 숨김: '대전타일' }); assert.deepEqual(rm.dogi, { 삭제: '중부도기' }); assert.deepEqual(rm.list.sort(), [['대전타일', true], ['한밭철물', false]]);
    await page.evaluate(() => suppliers()); await page.locator('.supUnhide').waitFor({ state: 'attached' }); assert.match(await page.locator('#modalRoot').innerText(), /숨긴 거래처 1/);
    await page.locator('#modalRoot details summary').click(); await page.locator('.supUnhide').click(); await page.waitForFunction(() => !state.suppliers.find(x => x.name === '대전타일').hidden);
    assert.equal(await page.evaluate(() => hjSupPriceSuggest('대전타일', '타일 600각').price), 12000, 'prices survive hide/unhide');
    assert.deepEqual((await snapshot()).keys, keys, 'no new top-level serialized keys');
  });

  await test('order price → total → receive asks → cost applied once → undo subtracts without negatives', async () => {
    await seed(); const today = await page.evaluate(() => localDate());
    const parsed = await page.evaluate(() => ({ items: hjMatParseItems('타일 600각 × 42장 @12,000\n본드 × 3포\n줄눈재 @ 9000'), line: hjMatItemLine({ name: '타일 600각', qty: 42, unit: '장', price: 12000 }) }));
    assert.deepEqual(parsed.items[0], { name: '타일 600각', spec: '', qty: 42, unit: '장', price: 12000 }); assert.equal(parsed.items[1].price, undefined); assert.deepEqual(parsed.items[2], { name: '줄눈재', spec: '', qty: '', unit: '', price: 9000 }); assert.equal(parsed.line, '타일 600각 × 42장 @12,000');
    const rec = await page.evaluate(({ leak, today }) => { const r = hjMatRecord(leak, { sup: '대전타일', items: [{ name: '타일 600각', qty: 42, unit: '장', price: 12000 }, { name: '본드', qty: 3, unit: '포' }], due: today }); return { total: r.o.total, dup: r.dup, id: r.o.id, computed: hjMatOrderTotal(r.o) }; }, { leak: LEAK, today });
    assert.equal(rec.total, 504000); assert.equal(rec.computed, 504000); assert.equal(rec.dup, false);
    await page.evaluate(name => hjMatView(name), LEAK); await page.locator('#matView .mdRecv').waitFor(); assert.match(await page.locator('[data-mat-total]').innerText(), /504,000원/); await tapOk('.mdRecv');
    await page.locator('#matView .mdRecv').click(); await page.locator('#hjMatCost').waitFor();
    assert.equal(await page.locator('#hjMatCostAmt').inputValue(), '504,000'); await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('02-cost-ask');
    await page.locator('#hjMatCostAmt').fill('500,000'); await footer('더하기').click(); await page.locator('#matView').waitFor();
    const after = await page.evaluate(({ leak, id }) => { const p = state.projects.find(x => x.name === leak), o = hjMatOrders(p)[0]; return { material: p.cost.material, applied: o.costApplied, amt: o.costAppliedAmt, total: o.total, recv: o.recvAt, note: state.notes.find(n => n.text.startsWith('[자재비]')), prices: hjSupPrices(state.suppliers.find(s => s.name === '대전타일')), costBtn: document.querySelectorAll('#matView .mdCost').length, pending: hjMatCostPending().length }; }, { leak: LEAK, id: rec.id });
    assert.equal(after.material, 500000); assert.equal(after.applied, true); assert.equal(after.amt, 500000); assert.equal(after.total, 500000); assert.equal(after.recv, today); assert(after.note); assert.match(after.note.text, /대전타일 500,000원/);
    assert.deepEqual(after.prices.map(x => [x.name, x.price, x.src]), [['타일 600각', 12000, 'recv']]); assert.equal(after.costBtn, 0); assert.equal(after.pending, 0);
    const twice = await page.evaluate(({ leak, id }) => { const r = hjMatCostApply(id, 500000); return { r, material: state.projects.find(x => x.name === leak).cost.material }; }, { leak: LEAK, id: rec.id });
    assert.equal(twice.material, 500000, 'MAT_COST_ONCE'); assert.equal(twice.r.이미, true);
    await page.evaluate(name => { state.projects.find(x => x.name === name).cost.material = 200000; }, LEAK);
    await page.locator('#matView .mdUndo').click(); await page.waitForFunction(name => !hjMatOrders(state.projects.find(x => x.name === name))[0].recvAt, LEAK);
    const undone = await page.evaluate(name => { const p = state.projects.find(x => x.name === name), o = hjMatOrders(p)[0]; return { material: p.cost.material, applied: o.costApplied, note: state.notes.some(n => n.text.startsWith('[자재비 취소]')) }; }, LEAK);
    assert.equal(undone.material, 0, 'never below zero'); assert.equal(undone.applied, undefined); assert.equal(undone.note, true);
    await page.locator('#matView .mdRecv').click(); await page.locator('#hjMatCost').waitFor(); await footer('나중에').click(); await page.locator('#matView .mdCost').waitFor();
    assert.equal(await page.evaluate(() => hjMatCostPending().length), 1); assert.equal(await page.evaluate(() => hjDayCloseData().matCost), 1);
    await close(); await page.evaluate(() => hjDayCloseView()); await page.locator('[data-dc-matcost]').waitFor(); assert.match(await page.locator('[data-dc-matcost]').innerText(), /원가 반영 안 한 발주 1건/);
    await close(); await page.evaluate(name => hjMatView(name), LEAK); await page.locator('#matView .mdCost').click(); await page.locator('#hjMatCost').waitFor(); await footer('더하기').click();
    await page.waitForFunction(name => state.projects.find(x => x.name === name).cost.material === 500000, LEAK);
    await close(); await page.evaluate(name => hjMatEdit(null, { project: name }), LEAK); await page.locator('#meItems').waitFor();
    await page.locator('#meSup').fill('대전타일'); await page.locator('#meItems').fill('타일 600각 × 10장\n본드 × 1포'); await page.locator('#meSuggest').click();
    assert.equal(await page.locator('#meItems').inputValue(), '타일 600각 × 10장 @12,000\n본드 × 1포'); assert.match(await page.locator('#meTotal').innerText(), /120,000원/);
    await footer('저장').click(); await page.waitForFunction(name => hjMatOrders(state.projects.find(x => x.name === name)).length === 2, LEAK);
    assert.equal(await page.evaluate(name => hjMatOrders(state.projects.find(x => x.name === name))[1].total, LEAK), 120000);
  });

  await test('price table: last five per item, lowest seller, quote editor hint leaves quote prices alone', async () => {
    await seed();
    const r = await page.evaluate(() => {
      for (let i = 1; i <= 6; i++) hjSupPriceAdd('대전타일', { name: '타일 600각', unit: '장', price: 10000 + i * 100, at: '2026-10-0' + i }, 'manual');
      hjSupPriceAdd('중부도기', { name: '타일 600각', unit: '장', price: 9900, at: '2026-10-02' }, 'manual');
      hjSupPriceAdd('중부도기', { name: '양변기', unit: '대', price: 180000, at: '2026-10-02' }, 'manual');
      const tile = hjSupPrices(state.suppliers.find(s => s.name === '대전타일'));
      return { kept: tile.map(x => x.price), mine: hjSupPriceSuggest('대전타일', '타일 600각'), best: hjSupPriceSuggest('', '타일 600각'), none: hjSupPriceSuggest('', '없는 품목'), table: hjSupPriceTable().map(x => [x.sup, x.name, x.price, x.best, x.sellers]) };
    });
    assert.deepEqual(r.kept, [10200, 10300, 10400, 10500, 10600], 'only the five latest are kept');
    assert.deepEqual(r.mine, { price: 10600, sup: '대전타일', at: '2026-10-06', best: false }); assert.deepEqual(r.best, { price: 9900, sup: '중부도기', at: '2026-10-02', best: true }); assert.equal(r.none, null);
    assert.deepEqual(r.table, [['대전타일', '타일 600각', 10600, false, 2], ['중부도기', '양변기', 180000, false, 1], ['중부도기', '타일 600각', 9900, true, 2]]);
    const before = await snapshot();
    await page.evaluate(() => hjSupPriceTableView()); await page.locator('#hjPriceTable').waitFor();
    assert.equal(await page.locator('[data-price-row]').count(), 3); assert.equal(await page.locator('[data-price-best]').count(), 1); await noOverflow(); await shot('03-price-table');
    sameSnapshot(await snapshot(), before, 'price table view is read only');
    await page.locator('#hjPriceTable details summary').click(); await page.locator('#ptSup').fill('한밭철물'); await page.locator('#ptName').fill('실리콘 투명'); await page.locator('#ptUnit').fill('개'); await page.locator('#ptPrice').fill('4,500'); await page.locator('#ptAdd').click();
    await page.waitForFunction(() => (state.suppliers.find(s => s.name === '한밭철물') || { prices: [] }).prices?.length === 1);
    await close();
    await page.evaluate(name => { state.editingQuote = Object.assign(newQuote(), { project: name, title: 'T', items: [{ name: '타일 600각', spec: '', qty: 10, price: 25000 }, { name: '도배', spec: '', qty: 1, price: 300000 }] }); state.tab = 'quotemaker'; render(); }, LEAK);
    await page.locator('[data-quote-cost-hint]').waitFor();
    assert.match(await page.locator('[data-quote-cost-hint]').innerText(), /타일 600각 9,900원\(중부도기\)/); assert(!/도배/.test(await page.locator('[data-quote-cost-hint]').innerText()));
    assert.equal(await page.locator('input[data-qi="0"][data-qf="price"]').inputValue(), '25,000', 'quote price unchanged'); assert.equal(await page.evaluate(() => state.editingQuote.items[0].price), 25000);
  });

  await test('leftover materials move into inventory once, quantities add up', async () => {
    await seed(); const today = await page.evaluate(() => localDate());
    const id = await page.evaluate(({ leak, today }) => { state.inventory = [{ id: 'INV1', name: '타일 600각', qty: 5, unit: '장', minQty: 0, supplier: '', updatedAt: '' }]; const r = hjMatRecord(leak, { sup: '대전타일', items: [{ name: '타일 600각', qty: 42, unit: '장', price: 12000 }, { name: '본드', qty: 3, unit: '포' }], due: today }); hjMatReceive(r.o.id, true); return r.o.id; }, { leak: LEAK, today });
    await page.evaluate(name => hjMatView(name), LEAK); await page.locator('#matView .mdLeft').waitFor(); await tapOk('.mdLeft'); await page.locator('#matView .mdLeft').click(); await page.locator('#hjMatLeft').waitFor();
    await page.locator('[data-mat-left="0"]').fill('2'); await page.locator('[data-mat-left="1"]').fill('1'); await tapOk('#modalRoot .mfoot button'); await footer('재고로 옮기기').click(); await page.locator('#matView').waitFor();
    const inv = await page.evaluate(id => ({ inv: state.inventory.map(x => [x.name, x.qty, x.unit, x.supplier]), items: hjMatFind(id).o.items.map(x => [x.left, !!x.movedToInv]), again: hjMatLeftToInventory(id) }), id);
    assert.deepEqual(inv.inv, [['타일 600각', 7, '장', '대전타일'], ['본드', 1, '포', '대전타일']]); assert.deepEqual(inv.items, [[2, true], [1, true]]); assert.deepEqual(inv.again, { moved: 0 }, 'never moved twice');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v439Calls.external), []);
  });
  console.log(`material-v439: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL material-v439', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

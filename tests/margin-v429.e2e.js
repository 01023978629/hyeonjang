/* v429 건별 마진·월 마진 보드·누수 원가 템플릿 — 합성 레코드만. HJ_V429_BASELINE=<commit> 은 MARGIN_API_PRESENT 에서,
   HJ_V429_MUTATION=zero-cost(빈 원가를 0으로 계산) 는 MARGIN_MISSING_NOT_ZERO 에서 실패해야 한다. 외부 쓰기 0. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const A = 'TEST_MARGIN_LEAK_FULL', B = 'TEST_MARGIN_LEAK_NOCOST', C = 'TEST_MARGIN_INT_FULL', D = 'TEST_MARGIN_INT_LASTMONTH', E = 'TEST_MARGIN_INT_UNDATED', F = 'TEST_MARGIN_LEAK_LOSS';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V429_BASELINE && execFileSync('git', ['show', process.env.HJ_V429_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
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
    window.__v429Calls = { xlsx: [], external: [] };
    window.open = (...args) => { __v429Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v429Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjProjectMargin', 'hjMarginBand', 'hjMarginBoardData', 'hjMarginBoardView', 'hjLeakCostTemplate', 'hjCostInputView', 'hjProjectMarginHtml', 'hjMarginMonthOf'].every(k => typeof window[k] === 'function') && Array.isArray(HJ_MARGIN_BANDS) && HJ_MARGIN_BANDS.length === 4), true, 'MARGIN_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false;
    taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V429_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjMarginBoardXlsx = async d => { __v429Calls.xlsx.push(d.ym); return true; };
  });
  if (process.env.HJ_V429_MUTATION) {
    assert.equal(process.env.HJ_V429_MUTATION, 'zero-cost');
    await page.evaluate(() => { const real = hjProjectMargin; hjProjectMargin = (name, gross) => { const m = real(name, gross); if (m && m.missing && m.revenue > 0) { m.missing = false; m.cost = 0; m.margin = m.revenue; m.rate = 100; m.band = hjMarginBand(100); } return m; }; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS margin-v429 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async names => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null; __hjMarginGross = false;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.expenses = [];
      const today = localDate(), lastMonthDay = hjAddDays(today.slice(0, 7) + '-01', -1);
      const project = (name, kind, doneAt, cost) => ({ name, kind, stage: doneAt ? 3 : 2, phases: [], customer: { name: 'TEST_CUST_' + name, phone: '', addr: '' }, received: 0, archived: false, doneAt: doneAt || undefined, cost: cost || { material: 0, labor: 0, outsource: 0 } });
      const [A, B, C, D, E, F] = names;
      const pA = project(A, 'leak', today, { material: 20000, labor: 30000, outsource: 0 }); pA.leak = { intake: { where: ['욕실'], at: today + 'T01:00:00.000Z' }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', at: today + 'T02:00:00.000Z' } };
      const pB = project(B, 'leak', today, null); pB.leak = { intake: { where: ['천장'], at: today + 'T01:00:00.000Z' }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', at: today + 'T02:00:00.000Z' } };
      const pC = project(C, 'interior', today, { material: 500000, labor: 300000, outsource: 100000 });
      const pD = project(D, 'interior', lastMonthDay, { material: 0, labor: 480000, outsource: 0 });
      const pE = project(E, 'interior', '', null);
      const pF = project(F, 'leak', today, { material: 0, labor: 150000, outsource: 0 }); pF.leak = { intake: { where: ['베란다'], at: today + 'T01:00:00.000Z' }, detect: { methods: ['육안'], cause: '방수층(욕실·베란다)', zone: '전유부', at: today + 'T02:00:00.000Z' } };
      state.projects = [pA, pB, pC, pD, pE, pF];
      const quote = (id, project, supply, date) => ({ id, project, title: id, date, items: [{ name: 'TEST_ITEM', qty: 1, price: supply }], vatIncluded: true });
      state.quotes = [quote('TEST_Q_A', A, 100000, today), quote('TEST_Q_B', B, 200000, today), quote('TEST_Q_C', C, 1000000, today), quote('TEST_Q_D', D, 500000, lastMonthDay), quote('TEST_Q_F', F, 100000, today)];
      state.quotes.forEach(q => syncQuoteToProject(q));
      state.activeProject = null; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v429Calls.xlsx = []; __v429Calls.external = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V429_SEED_SAVE_FAILED');
    }, [A, B, C, D, E, F]);
  }
  async function snapshot() {
    return page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const live = serializeData(); live.savedAt = '';
      return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() };
    });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      if (!a || !b || typeof a !== 'object' || typeof b !== 'object') { changed.push(section); continue; }
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (Object.hasOwn(a, key) !== Object.hasOwn(b, key) || JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
      }
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function shot(name) {
    if (!process.env.HJ_V429_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V429_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V429_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  await test('per-project margin: full, partial, missing, VAT toggle, negative — and missing is never zero', async () => {
    await seed(); const before = await snapshot();
    const r = await page.evaluate(names => { const [A, B, , D, , F] = names; return { a: hjProjectMargin(A), aG: hjProjectMargin(A, true), b: hjProjectMargin(B), d: hjProjectMargin(D), f: hjProjectMargin(F), bands: HJ_MARGIN_BANDS.map(x => x.key), text: { a: hjMarginText(hjProjectMargin(A)), b: hjMarginText(hjProjectMargin(B)) } }; }, [A, B, C, D, E, F]);
    assert.deepEqual(r.bands, ['good', 'ok', 'low', 'loss']);
    assert.equal(r.a.revenue, 100000); assert.equal(r.a.cost, Math.round(20000 / 1.1) + 30000); assert.equal(r.a.margin, 100000 - r.a.cost); assert.equal(r.a.rate, 52); assert.equal(r.a.band.key, 'good'); assert.equal(r.a.missing, false); assert.equal(r.a.partial, true);
    assert.equal(r.aG.revenue, 110000); assert.equal(r.aG.cost, 50000); assert.equal(r.aG.margin, 60000); assert.equal(r.aG.rate, 55); assert.equal(r.aG.gross, true);
    assert.equal(r.b.margin, null, 'MARGIN_MISSING_NOT_ZERO'); assert.equal(r.b.missing, true); assert.equal(r.b.rate, null); assert.equal(r.b.cost, null); assert.equal(r.b.band, null); assert.equal(r.text.b, '원가 미입력');
    assert.equal(r.d.partial, true); assert.equal(r.d.rate, 4); assert.equal(r.d.band.key, 'low'); assert.deepEqual(r.d.empty, ['material', 'outsource']);
    assert.equal(r.f.margin, -50000); assert.equal(r.f.rate, -50); assert.equal(r.f.band.key, 'loss');
    assert.match(r.text.a, /52%/); assert.match(r.text.a, /일부 미입력/);
    sameSnapshot(await snapshot(), before, 'margin calculation is read only');
    await page.evaluate(name => { state.activeProject = name; state.tab = 'project'; render(); }, A);
    await page.locator('[data-margin-card="' + A + '"]').waitFor();
    assert.match(await page.locator('[data-margin-card="' + A + '"] [data-margin-value]').innerText(), /52%/);
    await tapOk('[data-margintoggle], [data-costedit]'); await shot('01-project-margin');
    await page.locator('[data-margintoggle="' + A + '"]').click(); await page.waitForFunction(name => /55%/.test(document.querySelector('[data-margin-card="' + name + '"] [data-margin-value]')?.textContent || ''), A);
    assert.match(await page.locator('[data-margintoggle="' + A + '"]').innerText(), /부가세 포함 기준/);
    await page.evaluate(name => { __hjMarginGross = false; state.activeProject = name; render(); }, B);
    await page.locator('[data-margin-card="' + B + '"] [data-margin-missing]').waitFor();
    assert.equal(await page.locator('[data-margin-card="' + B + '"] [data-margin-value]').innerText(), '—');
    sameSnapshot(await snapshot(), before, 'card and toggle are read only');
  });

  await test('leak cost template fills only empty fields and keeps existing values', async () => {
    await seed();
    const r = await page.evaluate(names => {
      const [A, B, C, , , F] = names, pB = state.projects.find(p => p.name === B), pF = state.projects.find(p => p.name === F), pC = state.projects.find(p => p.name === C);
      const ext = { ...pB, leak: { detect: { cause: '외벽·창호' } } }, none = { ...pB, leak: { detect: { cause: '결로' } } };
      return { empty: hjLeakCostTemplate(pB, {}), kept: hjLeakCostTemplate(pB, { material: 12345 }), water: hjLeakCostTemplate(pF, pF.cost), ext: hjLeakCostTemplate(ext, {}), none: hjLeakCostTemplate(none, {}), interior: hjLeakCostTemplate(pC, {}), rate: hjLeakCostDayRate(), tplKeys: Object.keys(HJ_LEAK_COST_TPL) };
    }, [A, B, C, D, E, F]);
    assert.deepEqual(r.tplKeys, ['pipe', 'waterproof', 'seal', 'exterior']); assert.equal(r.rate, 250000);
    assert.equal(r.empty.key, 'pipe'); assert.deepEqual(r.empty.filled, { material: 50000, labor: 250000 }); assert.deepEqual(r.empty.kept, []);
    assert.deepEqual(r.kept.filled, { labor: 250000 }); assert.deepEqual(r.kept.kept, ['material'], 'existing value is never overwritten');
    assert.equal(r.water.key, 'waterproof'); assert.deepEqual(r.water.filled, { material: 250000 }); assert.deepEqual(r.water.kept, ['labor'], 'labor already entered stays');
    assert.equal(r.ext.key, 'exterior'); assert.deepEqual(r.ext.filled, { outsource: 500000 });
    assert.equal(r.none, null); assert.equal(r.interior, null);
    await page.evaluate(name => hjCostInputView(name), B); await page.locator('#hjCostForm').waitFor();
    await tapOk('#ciTemplate, #ci_material, #modalRoot .mfoot button'); await noOverflow(); await shot('02-cost-template');
    await page.locator('#ci_material').fill('12,345'); await page.locator('#ciTemplate').click();
    assert.equal(await page.locator('#ci_material').inputValue(), '12,345'); assert.equal(await page.locator('#ci_labor').inputValue(), '250,000'); assert.equal(await page.locator('#ci_outsource').inputValue(), '');
    await footer('저장').click(); await page.waitForFunction(name => state.projects.find(p => p.name === name).cost.labor === 250000, B);
    const saved = await page.evaluate(name => ({ cost: state.projects.find(p => p.name === name).cost, m: hjProjectMargin(name) }), B);
    assert.deepEqual(saved.cost, { material: 12345, labor: 250000, outsource: 0 }); assert.equal(saved.m.missing, false); assert.equal(saved.m.cost, Math.round(12345 / 1.1) + 250000);
  });

  await test('monthly board: two groups, sums, order, missing warning, trend, summary sentence', async () => {
    await seed(); const before = await snapshot();
    const d = await page.evaluate(() => hjMarginBoardData(localDate().slice(0, 7)));
    const ym = await page.evaluate(() => localDate().slice(0, 7)), lastYm = await page.evaluate(() => hjAddDays(localDate().slice(0, 7) + '-01', -1).slice(0, 7));
    assert.equal(d.ym, ym); assert.equal(d.undated, 1, 'undated project is counted, not placed');
    const leak = d.groups.leak, interior = d.groups.interior;
    assert.equal(leak.n, 3); assert.deepEqual(leak.rows.map(r => r.name), [A, F, B], 'ordered by margin rate, missing last');
    assert.equal(leak.revenue, 400000); assert.equal(leak.countedRevenue, 200000); assert.equal(leak.cost, (Math.round(20000 / 1.1) + 30000) + 150000); assert.equal(leak.margin, (100000 - (Math.round(20000 / 1.1) + 30000)) + (100000 - 150000)); assert.equal(leak.rate, 1); assert.equal(leak.missing, 1);
    assert.equal(interior.n, 1); assert.equal(interior.rows[0].name, C); assert.equal(interior.rate, 15); assert.equal(interior.band.key, 'ok'); assert.equal(interior.rows[0].basis, '준공');
    assert.equal(d.totals.n, 4); assert.equal(d.totals.missing, 1); assert.equal(d.totals.revenue, 1400000);
    assert.deepEqual(d.trend.map(t => t.ym).slice(-2), [lastYm, ym]); assert.equal(d.trend.length, 3); assert.equal(d.trend[1].n, 1); assert.equal(d.trend[1].rate, 4); assert.equal(d.trend[2].n, 4);
    assert.match(d.summary, /누수 3건 평균 마진율 1%/); assert.match(d.summary, /인테리어 1건 평균 마진율 15%/); assert.match(d.summary, /원가 미입력 1건/);
    const monthOf = await page.evaluate(names => names.map(n => hjMarginMonthOf(state.projects.find(p => p.name === n))), [A, D, E]);
    assert.deepEqual(monthOf.map(x => x.basis), ['준공', '준공', '']); assert.equal(monthOf[1].ym, lastYm);
    const est = await page.evaluate(names => { const p = state.projects.find(x => x.name === names[0]); delete p.doneAt; const r = hjMarginMonthOf(p); p.doneAt = localDate(); return r; }, [A]);
    assert.equal(est.basis, '견적'); assert.equal(est.ym, ym);
    sameSnapshot(await snapshot(), before, 'board data is read only');
    await page.evaluate(() => hjMarginBoardView()); await page.locator('#hjMarginBoard').waitFor();
    assert.equal(await page.locator('[data-margin-group]').count(), 2); assert.equal(await page.locator('[data-margin-bar]').count(), 4);
    assert.match(await page.locator('[data-margin-missing-count]').innerText(), /원가 미입력 1건/); assert.match(await page.locator('[data-margin-summary]').innerText(), /누수 3건/);
    const widths = await page.locator('[data-margin-bar] span span').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.width)));
    assert(widths.every(w => w >= 0 && w <= 100), JSON.stringify(widths));
    await tapOk('#mbPrev, #mbNext, #mbBasis, #mbXlsx, [data-mbcost]'); await noOverflow(); await shot('03-margin-board');
    await page.locator('#mbBasis').click(); await page.locator('#mbBasis', { hasText: '부가세 포함 기준' }).waitFor();
    assert.match(await page.locator('[data-margin-bar="' + A + '"]').innerText(), /55%/);
    await page.locator('#mbPrev').click(); await page.waitForFunction(ym => document.getElementById('mbMonth')?.value === ym, lastYm);
    assert.match(await page.locator('[data-margin-group="interior"]').innerText(), new RegExp(D)); assert.match(await page.locator('[data-margin-group="leak"]').innerText(), /이 달 현장 없음/);
    await page.locator('#mbXlsx').click(); await page.waitForFunction(() => __v429Calls.xlsx.length === 1); assert.equal(await page.evaluate(() => __v429Calls.xlsx[0]), lastYm);
    await page.locator('[data-mbcost="' + D + '"]').click(); await page.locator('#hjCostForm').waitFor(); await footer('닫기').click(); await page.locator('#hjMarginBoard').waitFor();
    sameSnapshot(await snapshot(), before, 'board, toggles, month moves and export are read only');
  });

  await test('ledger entry, menu contract, sizes, no errors and no external writes', async () => {
    await seed();
    await page.evaluate(() => { state.tab = 'ledger'; render(); });
    await page.locator('[data-marginboard]').waitFor(); await page.locator('[data-marginboard]').click(); await page.locator('#hjMarginBoard').waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v429Calls.external), []);
  });
  console.log(`margin-v429: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL margin-v429', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

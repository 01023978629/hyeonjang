/* v440 외주팀·작업자 명단 · 일당·공수 정산표 · 외주 견적 요청서 · 지급 명세 — 합성 레코드만, 외부 쓰기 0.
   HJ_V440_BASELINE=<commit> 은 CREW_API_PRESENT 에서, HJ_V440_MUTATION=pay-dup(지급 중복 가드 제거) 은 CREW_PAY_ONCE 에서,
   HJ_V440_MUTATION=phone-unmask(고객 이름·전화 가림 해제) 은 SUBQUOTE_NO_CUSTOMER_PHONE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_CREW_LEAK', INT = 'TEST_CREW_INTERIOR', CUST = '테스트고객', PHONE = '010-1234-5678', ADDR = '대전 중구 대흥동 101동 1203호';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V440_BASELINE && execFileSync('git', ['show', process.env.HJ_V440_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
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
    window.__v440Calls = { external: [], sms: [], print: [], download: [], compose: [], xlsx: [] };
    window.open = (...args) => { __v440Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v440Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjCrewContact', 'hjCrewRate', 'hjLaborBy', 'hjLaborByTotal', 'hjLaborSetPerson', 'hjCrewSettleData', 'hjCrewPayPending', 'hjCrewSettleView', 'hjCrewSettleXlsx', 'hjCrewPayslipData', 'hjCrewPayslipText', 'hjCrewPayslipHtml', 'hjCrewPayMark', 'hjCrewPayslipView', 'hjSubQuotes', 'hjSubQuoteText', 'hjSubQuotePrivacyOk', 'hjSubQuoteHtml', 'hjSubQuoteView', 'hjSubQuotePicked'].every(k => typeof window[k] === 'function') && Array.isArray(HJ_CREW_TRADES) && HJ_CREW_TRADES.includes('방수')), true, 'CREW_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V440_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    // 외부로 나가는 출구는 모두 기록기로 — 문자·인쇄·다운로드·엑셀 모듈
    hjSendSms = (phone, text) => { __v440Calls.sms.push({ phone, text }); };
    hjDocPrint = html => { __v440Calls.print.push(String(html)); return true; };
    hjDocDownload = (text, fname, mime) => { __v440Calls.download.push({ fname, mime, size: String(text).length }); };
    hjWarrantyShareHtml = async (name, html, fname) => { __v440Calls.download.push({ fname }); return true; };
    hjDocHtmlToPng = async (html, base) => { __v440Calls.download.push({ fname: base + '.png' }); return true; };
    msgCenterCompose = (kind, preset) => { __v440Calls.compose.push({ kind, text: preset && preset.text, project: preset && preset.project }); closeModal(true); };
    ensureXLSX = async () => {};
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => ({ rows: JSON.parse(JSON.stringify(rows)) }), book_append_sheet: (wb, ws, name) => wb.sheets.push({ name, rows: ws.rows }) }, writeFile: (wb, name) => { __v440Calls.xlsx.push({ name, sheets: wb.sheets.map(s => s.name), summary: wb.sheets[0].rows }); } };
  });
  if (process.env.HJ_V440_MUTATION) {
    assert(['pay-dup', 'phone-unmask'].includes(process.env.HJ_V440_MUTATION), 'unknown mutation ' + process.env.HJ_V440_MUTATION);
    if (process.env.HJ_V440_MUTATION === 'pay-dup') await page.evaluate(() => { const real = hjCrewPayMark; hjCrewPayMark = (who, ym, amount) => { (state.expenses || []).forEach(e => { if (e && e.sourceKey === 'crewpay|' + who + '|' + ym) delete e.sourceKey; }); return real(who, ym, amount); }; });
    else await page.evaluate(() => { hjSubQuotePrivacyOk = () => true; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS crew-v440 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, int, cust, phone, addr }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const project = (name, kind) => ({ name, kind, stage: 2, phases: [], customer: { name: cust, phone, addr }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak'); p.leak = { intake: { where: ['욕실'], at: localDate() + 'T01:00:00.000Z' } };
      state.projects = [p, project(int, 'interior')];
      const ym = localDate().slice(0, 7);
      state.schedule = [
        { id: 'S1', date: ym + '-03', time: '09:00', title: '욕실 방수·타일', project: leak, crew: '김타일, 박목수', memo: '' },
        { id: 'S2', date: ym + '-04', time: '09:00', title: '타일 마감', project: leak, crew: '김타일', memo: '' },
        { id: 'S3', date: ym + '-05', time: '09:00', title: '거실 목공', project: int, crew: '박목수', memo: '' }];
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v440Calls.external = []; __v440Calls.sms = []; __v440Calls.print = []; __v440Calls.download = []; __v440Calls.compose = []; __v440Calls.xlsx = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V440_SEED_SAVE_FAILED');
    }, { leak: LEAK, int: INT, cust: CUST, phone: PHONE, addr: ADDR });
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
    if (!process.env.HJ_V440_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V440_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V440_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  // 사람별 공수를 UI 없이 쌓는다(②·④가 같은 상태에서 출발) — 김타일 S1 1일·S2 1일, 박목수 S1 반일·S3 1일(일당 200,000 으로 고침)
  const seedCrew = async () => page.evaluate(() => {
    state.contacts.push({ id: 'C1', name: '김타일', phone: '010-0000-0001', company: '', title: '', memo: '', team: true, trade: '타일', dayRate: 250000, halfDay: true },
      { id: 'C2', name: '박목수', phone: '010-0000-0002', company: '', title: '', memo: '', team: true, trade: '목공', dayRate: 220000 });
    supplierAdd({ name: '대전방수팀', category: '외주', phone: '042-000-0020', trade: '방수', lead: '이방수', rate: { type: 'pyeong', amount: 35000 }, taxInvoice: true });
    hjLaborSetPerson('S1', '김타일', 1); hjLaborSetPerson('S1', '박목수', 0.5); hjLaborSetPerson('S2', '김타일', 1); hjLaborSetPerson('S3', '박목수', 1, 200000);
    return localDate().slice(0, 7);
  });

  await test('① worker fields on team contacts, 외주팀 fields on suppliers, CSV import, hide when records exist', async () => {
    await seed(); const keys = (await snapshot()).keys;
    await page.evaluate(() => openContactEdit()); await page.locator('#cName').waitFor();
    assert.equal(await page.locator('#cCrewFields').isHidden(), true, 'crew fields stay hidden until 팀원 is checked');
    await page.locator('#cName').fill('김타일'); await page.locator('#cPhone').fill('010-0000-0001'); await page.locator('#cTeam').check();
    await page.locator('#cTrade').waitFor({ state: 'visible' }); await page.locator('#cTrade').selectOption('타일'); await page.locator('#cDayRate').fill('250,000'); await page.locator('#cHalfDay').check();
    await tapOk('#modalRoot .mfoot button, #modalRoot label:has(#cTeam), #modalRoot label:has(#cHalfDay)'); await noOverflow(); await shot('01-contact'); await footer('저장').click(); await page.waitForFunction(() => state.contacts.length === 1);
    const c = await page.evaluate(() => state.contacts[0]);
    assert.deepEqual([c.name, c.team, c.trade, c.dayRate, c.halfDay], ['김타일', true, '타일', 250000, true]);
    assert.equal(await page.evaluate(() => hjCrewRate('김타일')), 250000);
    await page.evaluate(id => openContactEdit(id), c.id); await page.locator('#cTrade').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#cDayRate').inputValue(), '250,000'); assert.equal(await page.locator('#cTrade').inputValue(), '타일');
    await page.locator('#cTeam').uncheck(); await footer('저장').click(); await page.waitForFunction(() => !state.contacts[0].team);
    assert.deepEqual(await page.evaluate(() => [state.contacts[0].trade, state.contacts[0].dayRate, state.contacts[0].halfDay]), [undefined, undefined, undefined], 'crew fields leave with the 팀원 flag');
    await page.evaluate(() => { Object.assign(state.contacts[0], { team: true, trade: '타일', dayRate: 250000, halfDay: true }); markDirty(); });
    await close(); await page.evaluate(() => hjCrewWeekView('week')); await page.locator('[data-crew-info]').waitFor();
    assert.match(await page.locator('[data-crew-info]').first().innerText(), /타일 · 일당 250,000원/);
    await close(); await page.evaluate(() => supplierEditDialog(null, { category: '외주' })); await page.locator('#supName').waitFor();
    assert.equal(await page.locator('#supSubFields').isHidden(), false, '외주팀 fields show for 외주'); assert.equal(await page.locator('#supMatFields').isHidden(), true, 'material fields hide for 외주');
    await page.locator('#supName').fill('대전방수팀'); await page.locator('#supPhone').fill('042-000-0020'); await page.locator('#supTrade').selectOption('방수'); await page.locator('#supLead').fill('이방수');
    await page.locator('#supRateType').selectOption('pyeong'); await page.locator('#supRateAmt').fill('35,000'); await page.locator('#supTax').check();
    await tapOk('#modalRoot .mfoot button, .supCat'); await noOverflow(); await footer('저장').click(); await page.locator('.supRow').waitFor();
    const s = await page.evaluate(() => state.suppliers[0]);
    assert.deepEqual([s.name, s.category, s.phone, s.trade, s.lead, s.rate, s.taxInvoice], ['대전방수팀', '외주', '042-000-0020', '방수', '이방수', { type: 'pyeong', amount: 35000 }, true]);
    assert.match(await page.locator('.supRow').innerText(), /방수 · 대표 이방수 · 평당 35,000원 · 세금계산서 가능/); await tapOk('#supAddSub, #supImportSub, .supRow'); await shot('02-suppliers');
    const imported = await page.evaluate(() => { const rows = hjSupParseCsv('이름,전화,공종,단가\n충청도배,042-000-0010,도배,180000\n대전방수팀,,,\n한밭전기,042-000-0011,전기,"230,000"\n'); return { rows: rows.length, r: hjSupImportRows(rows, { category: '외주' }), list: state.suppliers.map(x => [x.name, x.category, x.trade, x.rate]) }; });
    assert.equal(imported.rows, 4); assert.deepEqual(imported.r, { added: 2, merged: 0, skipped: 1 });
    assert.deepEqual(imported.list, [['대전방수팀', '외주', '방수', { type: 'pyeong', amount: 35000 }], ['충청도배', '외주', '도배', { type: 'day', amount: 180000 }], ['한밭전기', '외주', '전기', { type: 'day', amount: 230000 }]]);
    const rm = await page.evaluate(name => { state.projects.find(x => x.name === name).subQuotes = [{ id: 'SQ0', sup: '대전방수팀', trade: '방수', at: new Date().toISOString(), items: [], when: '', status: 'asked', amount: 0 }]; markDirty(); return { team: hjSupRemove('대전방수팀'), elec: hjSupRemove('한밭전기'), list: state.suppliers.map(x => [x.name, !!x.hidden]) }; }, LEAK);
    assert.deepEqual(rm.team, { 숨김: '대전방수팀' }, 'a team with a quote request is hidden, not deleted'); assert.deepEqual(rm.elec, { 삭제: '한밭전기' }); assert.deepEqual(rm.list, [['대전방수팀', true], ['충청도배', false]]);
    await page.evaluate(() => suppliers()); await page.locator('.supUnhide').waitFor({ state: 'attached' }); await page.locator('#modalRoot details summary').click(); await page.locator('.supUnhide').click();
    await page.waitForFunction(() => !state.suppliers.find(x => x.name === '대전방수팀').hidden);
    assert.equal(await page.locator('#hjSubQuote').count(), 0); assert.deepEqual((await snapshot()).keys, keys, 'no new top-level serialized keys');
  });

  await test('② per-person 1/½ toggles → settle sheet totals, prepaid deduction, per-site sums equal laborProjectTotal', async () => {
    await seed(); const ym = await page.evaluate(() => { state.contacts.push({ id: 'C1', name: '김타일', phone: '', company: '', title: '', memo: '', team: true, trade: '타일', dayRate: 250000 }, { id: 'C2', name: '박목수', phone: '', company: '', title: '', memo: '', team: true, trade: '목공', dayRate: 220000 }); markDirty(); return localDate().slice(0, 7); });
    await page.evaluate(ym => laborLedger(ym), ym); await page.locator('.llDay[data-id="S1"][data-name="김타일"][data-days="1"]').waitFor();
    assert.equal(await page.locator('.llDay').count(), 12, '4 crew names × 3 toggles'); await tapOk('.llDay, #llSettle'); await noOverflow(); await shot('03-ledger');
    await page.locator('.llDay[data-id="S1"][data-name="김타일"][data-days="1"]').click(); await page.waitForFunction(() => hjLaborBy(state.schedule[0])['김타일']);
    assert.equal(await page.locator('.llAmt[data-id="S1"]').inputValue(), '250,000'); assert.equal(await page.locator('.llAmt[data-id="S1"]').evaluate(n => n.readOnly), true, 'sum is derived once people are set');
    assert.match(await page.locator('.llDay[data-id="S1"][data-name="김타일"][data-days="1"]').getAttribute('class'), /blue/);
    await page.locator('.llDay[data-id="S1"][data-name="박목수"][data-days="0.5"]').click(); await page.waitForFunction(() => num(state.schedule[0].labor.amount) === 360000);
    await page.locator('.llDay[data-id="S2"][data-name="김타일"][data-days="1"]').click(); await page.waitForFunction(() => num(state.schedule[1].labor.amount) === 250000);
    await page.locator('.llDay[data-id="S3"][data-name="박목수"][data-days="1"]').click(); await page.waitForFunction(() => num(state.schedule[2].labor.amount) === 220000);
    const rateS3 = page.locator('.llRate[data-id="S3"][data-name="박목수"]');
    await rateS3.fill('200,000'); await rateS3.blur(); await page.waitForFunction(() => num(state.schedule[2].labor.amount) === 200000);
    // iOS 처럼 입력 칸 포커스가 남은 채 1/½ 를 누르면 — 적던 일당이 먼저 저장되고, 다시 그릴 때 늦게 오는 change 로 겹쳐 그리지 않는다
    await rateS3.fill('210,000'); await page.locator('.llDay[data-id="S2"][data-name="김타일"][data-days="0.5"]').evaluate(n => n.click());
    await page.waitForFunction(() => num(state.schedule[1].labor.amount) === 125000 && num(state.schedule[2].labor.amount) === 210000);
    assert.deepEqual(errors, [], 'LEDGER_NO_NESTED_REDRAW'); assert.equal(await page.locator('.llRate[data-id="S3"][data-name="박목수"]').inputValue(), '210,000');
    await page.locator('.llDay[data-id="S2"][data-name="김타일"][data-days="1"]').click(); await page.waitForFunction(() => num(state.schedule[1].labor.amount) === 250000);
    await rateS3.fill('200,000'); await rateS3.blur(); await page.waitForFunction(() => num(state.schedule[2].labor.amount) === 200000);
    assert.deepEqual(await page.evaluate(() => [state.schedule[0].labor, state.schedule[2].labor.by]), [{ by: { 김타일: { days: 1, rate: 250000 }, 박목수: { days: 0.5, rate: 220000 } }, amount: 360000, names: '김타일, 박목수' }, { 박목수: { days: 1, rate: 200000 } }]);
    await page.locator('.llDay[data-id="S1"][data-name="박목수"][data-days="0"]').click(); await page.waitForFunction(() => num(state.schedule[0].labor.amount) === 250000, null, { timeout: 5000 });
    await page.locator('.llDay[data-id="S1"][data-name="박목수"][data-days="0.5"]').click(); await page.waitForFunction(() => num(state.schedule[0].labor.amount) === 360000);
    const d = await page.evaluate(({ ym, leak, int }) => { state.expenses.push({ id: 'E0', date: ym + '-10', amount: 100000, category: '인건비', method: '현금', memo: '[지급] 김타일 선지급', project: '', vendor: '김타일', src: 'crewpay', who: '김타일', ym }); markDirty(); const d = hjCrewSettleData(ym); return { people: d.people.map(p => [p.name, p.days, p.amount, p.prepaid, p.due, p.paidDone, p.trade]), dates: d.dates, byPj: d.byPj, total: d.total, pending: d.pendingPayslip, lt: [laborProjectTotal(leak).total, laborProjectTotal(int).total], ledger: laborLedgerData(ym).byPj, cells: d.people[0].cells }; }, { ym, leak: LEAK, int: INT });
    assert.deepEqual(d.people, [['김타일', 2, 500000, 100000, 400000, false, '타일'], ['박목수', 1.5, 310000, 0, 310000, false, '목공']]);
    assert.deepEqual(d.dates, [ym + '-03', ym + '-04', ym + '-05']); assert.deepEqual(d.cells, { [ym + '-03']: 1, [ym + '-04']: 1 });
    assert.deepEqual(d.byPj, { [LEAK]: 610000, [INT]: 200000 }); assert.deepEqual(d.lt, [610000, 200000], 'per-site sums equal laborProjectTotal'); assert.deepEqual(d.ledger, d.byPj, 'same numbers as the 인건비 장부'); assert.equal(d.total, 810000); assert.deepEqual(d.pending, ['김타일', '박목수']);
    await page.evaluate(() => guardedPersistCurrentState()); const before = await snapshot();
    await page.locator('#llSettle').click(); await page.locator('#hjCrewSettle').waitFor();
    assert.equal(await page.locator('[data-crew-grid]').count(), 1); assert.equal(await page.locator('[data-crew-row]').count(), 2); assert.equal(await page.locator('[data-crew-person]').count(), 2);
    assert.match(await page.locator('[data-crew-row="김타일"]').innerText(), /공수 2 · 일당 합 500,000원 · 선지급 −100,000원 · 지급할 금액 400,000원/);
    assert.match(await page.locator('[data-crew-row="박목수"]').innerText(), /공수 1\.5 · 일당 합 310,000원 · 지급할 금액 310,000원/);
    assert.match(await page.locator('#hjCrewSettle').innerText(), new RegExp(LEAK + '\\s*610,000원')); assert.match(await page.locator('#modalTitle').innerText(), /사람별 정산표/);
    await tapOk('[data-crew-payslip], #csPrev, #csNext, #modalRoot .mfoot button'); await noOverflow(); await shot('04-settle');
    await footer('엑셀').click(); await page.waitForFunction(() => __v440Calls.xlsx.length === 1);
    const xl = await page.evaluate(() => __v440Calls.xlsx[0]);
    assert.equal(xl.name, '만물_정산_' + ym + '.xlsx'); assert.deepEqual(xl.sheets, ['요약', '김타일', '박목수']); assert.deepEqual(xl.summary[1], ['김타일', '타일', 2, 500000, 100000, 400000]); assert.deepEqual(xl.summary[3], ['합계', '', 3.5, 810000, '', '']);
    await footer('PDF 1장').click(); await page.locator('#hjDocPdf').waitFor(); assert.match(await page.locator('#modalTitle').innerText(), /사람별 정산표/);
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(() => __v440Calls.print.length === 1);
    assert.match(await page.evaluate(() => __v440Calls.print[0]), /일당 · 공수 정산표[\s\S]*김타일[\s\S]*400,000[\s\S]*계좌: 전화로 확인/);
    await footer('← 뒤로').click(); await page.locator('#hjCrewSettle').waitFor(); await page.locator('#csPrev').click(); await page.locator('#hjCrewSettle').waitFor();
    assert.equal(await page.locator('[data-crew-row]').count(), 0, 'previous month is empty'); await page.locator('#csNext').click(); await page.locator('[data-crew-row="김타일"]').waitFor();
    sameSnapshot(await snapshot(), before, 'settle sheet, xlsx and pdf are read only');
  });

  await test('③ 외주 견적 요청서 — customer name/phone never leave, p.subQuotes recorded, amount received → picked', async () => {
    await seed(); await seedCrew();
    await page.evaluate(name => { const q = newQuote(false); q.project = name; q.title = '욕실'; q.items = [{ name: '욕실 방수', spec: '', qty: 1, price: 500000 }, { name: '타일 시공', spec: '', qty: 10, price: 50000 }]; state.quotes.push(q); markDirty(); state.tab = 'project'; render(); }, LEAK);
    await page.locator('#view [data-subquote]').waitFor(); await tapOk('#view [data-subquote]'); await page.locator('#view [data-subquote]').click(); await page.locator('#hjSubQuote').waitFor();
    assert.equal(await page.locator('#sqAddr').inputValue(), ADDR); assert.equal(await page.locator('[data-sq-item]').count(), 2); assert.equal(await page.locator('[data-sq-item]:checked').count(), 2);
    await page.locator('#sqSup').fill('대전방수팀'); await page.locator('#sqTrade').selectOption('방수'); await page.locator('#sqWhen').fill('10/20~22 중 하루'); await page.locator('[data-sq-item="타일 시공"]').uncheck();
    await page.locator('[data-sq-privacy="ok"]').waitFor(); await tapOk('#modalRoot .mfoot button, #hjSubQuote label:has([data-sq-item])'); await noOverflow(); await shot('05-subquote');
    await page.locator('#sqMemo').fill('고객 연락처 ' + PHONE); await footer('문자 초안').click(); await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __v440Calls.sms.length), 0, 'SUBQUOTE_NO_CUSTOMER_PHONE'); assert.equal(await page.locator('[data-sq-privacy="fail"]').count(), 1, 'SUBQUOTE_NO_CUSTOMER_PHONE banner');
    assert.equal(await page.evaluate(name => hjSubQuotes(state.projects.find(x => x.name === name)).length, LEAK), 0, 'nothing recorded while customer data is inside');
    assert.equal(await page.locator('#hjSubQuote').count(), 1, 'form stays open to fix');
    await page.locator('#sqMemo').fill('고객 이름 ' + CUST); await page.locator('[data-sq-privacy="fail"]').waitFor(); await page.locator('#sqMemo').fill('주차는 지하 2층'); await page.locator('[data-sq-privacy="ok"]').waitFor();
    await footer('문자 초안').click(); await page.waitForFunction(() => __v440Calls.sms.length === 1);
    const sent = await page.evaluate(name => { const p = state.projects.find(x => x.name === name); return { sms: __v440Calls.sms[0], subs: hjSubQuotes(p).map(x => [x.sup, x.trade, x.items, x.when, x.status, x.amount]), note: state.notes.map(n => n.text) }; }, LEAK);
    assert.equal(sent.sms.phone, '042-000-0020'); assert(!sent.sms.text.includes(CUST) && !sent.sms.text.replace(/\D/g, '').includes(PHONE.replace(/\D/g, '')), 'customer name/phone absent: ' + sent.sms.text);
    assert.match(sent.sms.text, /외주 견적 요청[\s\S]*공종: 방수[\s\S]*101동 1203호[\s\S]*· 욕실 방수[\s\S]*희망 일정: 10\/20~22 중 하루[\s\S]*주차는 지하 2층/); assert(!/타일 시공/.test(sent.sms.text));
    assert.deepEqual(sent.subs, [['대전방수팀', '방수', ['욕실 방수'], '10/20~22 중 하루', 'asked', 0]]); assert.deepEqual(sent.note, ['[외주 견적 요청] 대전방수팀 · 방수']);
    await page.evaluate(name => hjSubQuoteView(name), LEAK); await page.locator('[data-sq-record]').waitFor(); assert.match(await page.locator('[data-sq-record]').innerText(), /대전방수팀 · 방수 · .*요청함/); await tapOk('[data-sq-got]');
    await page.locator('[data-sq-got]').click(); await page.waitForTimeout(100); assert.equal(await page.evaluate(name => hjSubQuotes(state.projects.find(x => x.name === name))[0].status, LEAK), 'asked', 'no amount, no change');
    await page.locator('[data-sq-amt]').fill('1,200,000'); await page.locator('[data-sq-got]').click(); await page.locator('[data-sq-pick]').waitFor();
    assert.match(await page.locator('[data-sq-record]').innerText(), /금액 받음 · 1,200,000원/); await tapOk('[data-sq-pick]'); await page.locator('[data-sq-pick]').click(); await page.waitForFunction(name => hjSubQuotes(state.projects.find(x => x.name === name))[0].status === 'picked', LEAK);
    assert.deepEqual(await page.evaluate(name => hjSubQuotePicked(state.projects.find(x => x.name === name)).map(x => [x.sup, x.amount]), LEAK), [['대전방수팀', 1200000]]);
    assert.match(await page.locator('[data-sq-record]').innerText(), /선택 · 1,200,000원/);
    await page.locator('#sqSup').fill('새로운설비'); await page.locator('#sqTrade').selectOption('설비'); await footer('요청서(PDF)').click(); await page.locator('#hjDocPdf').waitFor();
    assert.match(await page.locator('#modalTitle').innerText(), /외주 견적 요청서/); assert.equal(await page.locator('#hjDocSms').count(), 1); assert.equal(await page.locator('#hjDocImage').count(), 1); await tapOk('#hjDocPdf, #hjDocSms, #hjDocImage');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(() => __v440Calls.print.length === 1);
    const pdf = await page.evaluate(name => ({ html: __v440Calls.print[0], sup: state.suppliers.find(s => s.name === '새로운설비'), subs: hjSubQuotes(state.projects.find(x => x.name === name)).map(x => [x.sup, x.status]) }), LEAK);
    assert.match(pdf.html, /외 주 견 적 요 청 서[\s\S]*새로운설비[\s\S]*101동 1203호/); assert(!pdf.html.includes(CUST) && !pdf.html.replace(/\D/g, '').includes(PHONE.replace(/\D/g, '')), 'pdf has no customer data');
    assert.deepEqual([pdf.sup.category, pdf.sup.name], ['외주', '새로운설비'], 'unknown team is added to 📇 거래처 as 외주'); assert.deepEqual(pdf.subs, [['대전방수팀', 'picked'], ['새로운설비', 'asked']]);
    await page.locator('#hjDocSms').click(); await page.waitForFunction(() => __v440Calls.compose.length === 1);
    assert.match(await page.evaluate(() => __v440Calls.compose[0].kind + ' ' + __v440Calls.compose[0].text), /^subquote \[[\s\S]*새로운설비 외주 견적 요청/);
  });

  await test('④ 지급 명세 → one expense per person·month (sourceKey), pdf + sms draft, 외주 kind, day-close count', async () => {
    await seed(); const ym = await seedCrew();
    await page.evaluate(ym => { state.expenses.push({ id: 'E0', date: ym + '-10', amount: 100000, category: '인건비', method: '현금', memo: '[지급] 김타일 선지급', project: '', vendor: '김타일', src: 'crewpay', who: '김타일', ym }); hjLaborSetPerson('S3', '대전방수팀', 1, 350000); markDirty(); }, ym);
    const text = await page.evaluate(ym => hjCrewPayslipText(hjCrewPayslipData('김타일', ym)), ym);
    assert.match(text, /김타일님 \d+월 지급 명세\n[\s\S]*TEST_CREW_LEAK 1일 250,000원\n[\s\S]*공수 2 · 합계 500,000원 · 선지급 100,000원\n지급액 400,000원\n입금 후 문자로 알려 드립니다\. 계좌: 전화로 확인$/); assert(!/\d{3,}-\d{2,}-\d{3,}/.test(text), 'no account number anywhere');
    await page.evaluate(ym => hjCrewPayslipView('김타일', ym), ym); await page.locator('#hjCrewPaid').waitFor();
    assert.match(await page.locator('#modalTitle').innerText(), /지급 명세 \(인건비\) — 김타일/); assert.match(await page.locator('#hjCrewPaid').innerText(), /지급했음 — 지출 장부에 400,000원/);
    await tapOk('#hjCrewPaid, #hjDocPdf, #hjDocSms'); await noOverflow(); await shot('06-payslip');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(() => __v440Calls.print.length === 1);
    assert.match(await page.evaluate(() => __v440Calls.print[0]), /지 급 명 세 서[\s\S]*김타일[\s\S]*선지급 차감[\s\S]*100,000[\s\S]*지급액[\s\S]*400,000[\s\S]*계좌: 전화로 확인/);
    await page.locator('#hjDocWord').click(); await page.waitForFunction(() => __v440Calls.download.length === 1); assert.equal(await page.evaluate(() => __v440Calls.download[0].fname), '만물_정산_' + ym + '_김타일.doc');
    await page.locator('#hjCrewPaid').click(); await page.waitForFunction(() => state.expenses.length === 2);
    const paid = await page.evaluate(ym => { const e = state.expenses[1]; return { e: [e.amount, e.category, e.method, e.memo, e.project, e.vendor, e.sourceKey, e.src, e.who, e.ym, e.final], due: hjCrewSettleData(ym).people.find(p => p.name === '김타일'), pending: hjCrewPayPending(ym), btn: document.querySelector('#hjCrewPaid').innerText, labor: state.projects.map(p => p.cost.labor) }; }, ym);
    assert.deepEqual(paid.e, [400000, '인건비', '현금', '[지급] 김타일 ' + ym, '', '김타일', 'crewpay|김타일|' + ym, 'crewpay', '김타일', ym, true]);
    assert.deepEqual([paid.due.prepaid, paid.due.due, paid.due.paidDone], [500000, 0, true]); assert.deepEqual(paid.pending, ['대전방수팀', '박목수'], 'paid person leaves the pending list'); assert.match(paid.btn, /지급 기록 있음/);
    assert.deepEqual(paid.labor, [0, 0], 'site cost stays with the ledger [지출 반영] button');
    await page.locator('#hjCrewPaid').click(); await page.waitForTimeout(150);
    const again = await page.evaluate(ym => ({ n: state.expenses.length, direct: hjCrewPayMark('김타일', ym, 400000), finals: state.expenses.filter(e => e.src === 'crewpay' && e.who === '김타일' && e.final).length }), ym);
    assert.equal(again.finals, 1, 'CREW_PAY_ONCE'); assert.equal(again.n, 2, 'CREW_PAY_ONCE'); assert.deepEqual(again.direct, { dup: true });
    await page.locator('#hjDocSms').click(); await page.waitForFunction(() => __v440Calls.compose.length === 1);
    assert.deepEqual(await page.evaluate(() => [__v440Calls.compose[0].kind, __v440Calls.compose[0].project]), ['crewpay', '김타일']);
    const sub = await page.evaluate(ym => { const d = hjCrewPayslipData('대전방수팀', ym); const r = hjCrewPayMark('대전방수팀', ym); return { kind: d.kind, phone: d.phone, due: d.person.due, r, e: state.expenses[2] && [state.expenses[2].category, state.expenses[2].amount, state.expenses[2].vendor], dc: hjDayCloseData(ym + '-28').crewPay, dcEarly: hjDayCloseData(ym + '-20').crewPay, hasRec: hjSupHasRecords('대전방수팀') }; }, ym);
    assert.deepEqual([sub.kind, sub.phone, sub.due], ['외주', '042-000-0020', 350000]); assert.deepEqual(sub.r, { 기록: 350000, key: 'crewpay|대전방수팀|' + ym }); assert.deepEqual(sub.e, ['외주', 350000, '대전방수팀']);
    assert.deepEqual(sub.dc, ['박목수'], 'month-end close lists people without a payslip'); assert.deepEqual(sub.dcEarly, [], 'quiet before the 25th'); assert.equal(sub.hasRec, true, 'paid team cannot be deleted, only hidden');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v440Calls.external), []);
  });
  console.log(`crew-v440: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL crew-v440', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v428: synthetic receipts only; actual forms and atomic persistence.
   HJ_V428_BASELINE=75025e5 must fail TAX_ISSUE_API_PRESENT.
   HJ_V428_MUTATION=card-na must fail CARD_AUTOMATIC_NOT_APPLICABLE.
   No customer data, remote writes, issuance, login, or actual file downloads.
   HJ_V428_SHOTS and HJ_V428_XLSX_PATH are optional evidence/library paths. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin, TODAY = '2026-10-16', MONTH = '2026-10';
const NOW = '2026-10-16T12:00:00+09:00';
const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const INTERIOR = 'TEST_TAX_INTERIOR', LEAK = 'TEST_TAX_LEAK', BUSINESS = 'TEST_TAX_BUSINESS', UNKNOWN = 'TEST_TAX_UNKNOWN';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V428_BASELINE && execFileSync('git', ['show', process.env.HJ_V428_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const RECEIPTS = {
  interior: { n: 4, sum: 1200000 }, leak: { n: 3, sum: 850000 },
  unknown: { n: 1, sum: 700000 }, total: { n: 8, sum: 2750000 }
};
const SALES = {
  interior: { n: 1, sum: 1100000 }, leak: { n: 1, sum: 2200000 },
  unknown: { n: 1, sum: 3300000 }, total: { n: 3, sum: 6600000 }
};
async function xlsxLibrarySource() {
  const candidates = [process.env.HJ_V428_XLSX_PATH];
  try { candidates.push(require.resolve('xlsx/dist/xlsx.full.min.js')); } catch (_) {}
  candidates.push('/opt/node22/lib/node_modules/xlsx/dist/xlsx.full.min.js');
  const local = candidates.find(file => file && fs.existsSync(file));
  let source;
  if (local) source = fs.readFileSync(local, 'utf8');
  else {
    // Only this fixed, public dependency GET may leave Node. Browser routing and
    // the zero remote-write assertion stay unchanged; no library is written to disk.
    const response = await fetch(XLSX_CDN, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true, 'TAX_ISSUE_XLSX_CDN_HTTP_' + response.status);
    assert.equal(response.url, XLSX_CDN, 'TAX_ISSUE_XLSX_CDN_FIXED_URL');
    assert.match(response.headers.get('content-type') || '', /(?:javascript|ecmascript|text\/plain)/i, 'TAX_ISSUE_XLSX_CDN_CONTENT_TYPE');
    const advertised = Number(response.headers.get('content-length') || 0);
    assert(advertised <= 5 * 1024 * 1024, 'TAX_ISSUE_XLSX_CDN_SIZE');
    source = await response.text();
  }
  assert(source.length > 100000 && Buffer.byteLength(source, 'utf8') <= 5 * 1024 * 1024, 'TAX_ISSUE_XLSX_LIBRARY_SIZE');
  assert.match(source, /SheetJS/, 'TAX_ISSUE_XLSX_LIBRARY_CONTENT');
  assert.match(source, /0\.18\.5/, 'TAX_ISSUE_XLSX_LIBRARY_VERSION_CONTENT');
  assert.doesNotMatch(source.slice(0, 256), /<!doctype|<html/i, 'TAX_ISSUE_XLSX_LIBRARY_NOT_HTML');
  return source;
}
let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  const page = await context.newPage(), pageErrors = [], network = { writes: 0 };
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(now => {
    const NativeDate = Date, fixed = NativeDate.parse(now);
    class TestDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
    window.Date = TestDate;
    for (const [key, value] of Object.entries({ hj_onboard_done: '1', pref_mobile: '1', hj_gcal_auto: '0', hj_ver_checked_at: String(Date.now()), hj_more_recent: '[]', hj_more_favorites: '[]' })) localStorage.setItem(key, value);
    window.__v428External = 0;
    window.open = () => { window.__v428External++; return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__v428External++; } });
  }, NOW);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key]));
    if (window.__hjShareInboxBootDone) await window.__hjShareInboxBootDone;
    if (window.__hjOutboxUiBootDone) await window.__hjOutboxUiBootDone;
  }, BOOT);
  assert.equal(await page.evaluate(() => typeof hjTaxIssueRead === 'function' && typeof hjTaxIssueSave === 'function' && typeof hjTaxIssueView === 'function' && typeof hjTaxIssueSummary === 'function'), true, 'TAX_ISSUE_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false;
    // Complete real boot seeders before our fixture; never replace these helpers.
    taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); __idbSaveTimer = null; await __appStateWriteQueue;
    window.__v428Send = hjSendSms;
    hjSendSms = () => { window.__v428External++; throw Error('TEST_V428_MUST_NOT_SEND'); };
  });
  if (process.env.HJ_V428_MUTATION) {
    assert.equal(process.env.HJ_V428_MUTATION, 'card-na');
    const applied = await page.evaluate(() => {
      const source = hjTaxIssueNormalize.toString();
      const needle = "if(method==='카드'){type='none';status='notApplicable';no='';at='';}";
      if (!source.includes(needle)) return false;
      hjTaxIssueNormalize = (0, eval)('(' + source.replace(needle, "if(false){type='none';status='notApplicable';no='';at='';}") + ')');
      return true;
    });
    assert.equal(applied, true, 'TAX_ISSUE_MUTATION_TARGET_PRESENT');
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS taxissue-v428 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !__mobileSheetHistoryDeferredOpen);
  }
  async function poll(read, accept, label) {
    const deadline = Date.now() + 12000; let value;
    do { value = await read(); if (accept(value)) return value; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < deadline);
    assert.fail(label + ': ' + JSON.stringify(value));
  }
  async function persist() {
    assert.equal(await page.evaluate(async () => { clearTimeout(__idbSaveTimer); __idbSaveTimer = null; await __appStateWriteQueue; return guardedPersistCurrentState(); }), true, 'TAX_ISSUE_FIXTURE_DURABLE');
  }
  async function seed() {
    await close();
    await page.evaluate(async ({ interior, leak, business, unknown, today }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __tabStale = false; __appVersionUpdating = false; __gdToken = null; __relay.url = ''; __relay.token = '';
      state._demo = false; state.dirHandle = null; state.editingQuote = null; state.dirty = false;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      const p = (name, kind, extra = {}) => ({ name, kind, stage: 2, phases: [], received: 0, archived: false, customer: {}, cost: { material: 0, labor: 0, outsource: 0 }, ...extra });
      state.projects = [p(interior, 'interior'), p(leak, 'leak'), p(business, 'interior', { customer: { bizno: '000-00-00000' } })];
      const day = delta => hjAddDays(today, delta);
      const issue = (type, status = 'pending', at = '') => ({ type, status, no: '', at });
      state.payLog = [
        { id: 'TEST_PAY_1', d: today, project: interior, amt: 100000, method: '계좌이체', issue: issue('cash') },
        { id: 'TEST_PAY_2', d: day(-5), project: interior, amt: 200000, method: '현금', issue: issue('tax') },
        { id: 'TEST_PAY_3', d: day(-6), project: interior, amt: 300000, method: '카드', issue: issue('none', 'notApplicable'), proof: 'card' },
        { id: 'TEST_PAY_4', d: day(-4), project: leak, amt: 400000, method: '계좌이체', quoteId: 'TEST_TAX_Q_LEAK', issue: issue('tax') },
        { id: 'TEST_PAY_5', d: day(-10), project: leak, amt: 500000, method: '현금', issue: issue('cash', 'issued', day(-10)), proof: 'cash', proofAt: day(-10) },
        { id: 'TEST_PAY_6', d: day(-2), project: leak, amt: -50000, method: '현금', issue: issue('cash') },
        { id: 'TEST_PAY_7', d: day(-7), project: interior, amt: 600000, method: '계좌이체' },
        { id: 'TEST_PAY_8', d: day(-3), project: unknown, amt: 700000 }
      ];
      for (const project of state.projects) project.received = state.payLog.filter(rec => rec.project === project.name).reduce((sum, rec) => sum + rec.amt, 0);
      const quote = (id, project, price) => Object.assign(newQuote(), { id, project, title: id, date: today, items: [{ name: 'TEST_ONLY_ITEM', spec: '식', qty: 1, price }], vatIncluded: true });
      const qi = quote('TEST_TAX_Q_INTERIOR', interior, 1000000), ql = quote('TEST_TAX_Q_LEAK', leak, 2000000);
      ql.leak = { from: 'template', cause: '급수관', zone: '전유부', at: '2026-10-16T01:00:00.000Z' };
      ql.paid = { method: '계좌이체', amount: 400000, at: day(-4), payLogId: 'TEST_PAY_4', receipt: { type: '세금계산서', issued: false } };
      state.quotes = [qi, ql];
      // Match quoteCommitEditing's virtual-file normalization before paid exact-state guards.
      state.quotes.forEach(syncQuoteToProject);
      state.files.push({ id: 'TEST_TAX_EXTERNAL', name: 'TEST_ONLY_ESTIMATE.pdf', ext: 'pdf', kind: 'estimate', mime: 'application/pdf', size: 10, when: new Date('2026-10-16T01:00:00.000Z'), project: unknown, est: { amount: 3300000, supply: 3000000, vat: 300000, date: today } });
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V428_SEED_SAVE_FAILED');
    }, { interior: INTERIOR, leak: LEAK, business: BUSINESS, unknown: UNKNOWN, today: TODAY });
  }
  async function snapshot() {
    return page.evaluate(async () => {
      await __appStateWriteQueue;
      const clean = data => { const copy = JSON.parse(JSON.stringify(data)); delete copy.savedAt; return copy; };
      return { live: clean(serializeData()), stored: clean(await idbGetStrict('appState')) };
    });
  }
  async function same(before, label) {
    const after = await snapshot(), changed = [];
    for (const side of ['live', 'stored']) for (const key of new Set([...Object.keys(before[side]), ...Object.keys(after[side])])) if (JSON.stringify(before[side][key]) !== JSON.stringify(after[side][key])) changed.push(side + '.' + key);
    assert.deepEqual(changed, [], label + ' (changed keys only)');
  }
  async function edit(id, initialStatus) {
    await close();
    assert.equal(await page.evaluate(({ id, initialStatus }) => hjTaxIssueEdit(state.payLog.find(rec => rec.id === id), null, initialStatus), { id, initialStatus }), true, 'TAX_ISSUE_EDITOR_OPEN');
    await page.locator('#hjTaxIssueForm').waitFor();
  }
  async function saved(form = '#hjTaxIssueForm', error = '#hjTaxIssueError') {
    const result = await poll(() => page.evaluate(({ form, error }) => ({ open: !!document.querySelector(form), error: document.querySelector(error)?.textContent || '' }), { form, error }), value => !value.open || !!value.error, 'TAX_ISSUE_SAVE_COMPLETES');
    assert.equal(result.error, '', 'TAX_ISSUE_SAVE_ERROR'); assert.equal(result.open, false, 'TAX_ISSUE_SAVED_FORM_CLOSES');
  }
  async function geometry(selectors) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, 'TAX_ISSUE_NO_PAGE_OVERFLOW');
    if (await page.locator('#modalRoot .modal').count()) assert.equal(await page.locator('#modalRoot .modal').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, 'TAX_ISSUE_NO_MODAL_OVERFLOW');
    for (const selector of selectors) {
      const nodes = page.locator(selector);
      assert((await nodes.count()) > 0, 'TAX_ISSUE_CONTROL_PRESENT ' + selector);
      for (let i = 0; i < await nodes.count(); i++) { const box = await nodes.nth(i).boundingBox(); assert(box && box.height >= 43.5, 'TAX_ISSUE_CONTROL_44PX ' + selector); }
    }
  }
  async function shot(name) {
    if (!process.env.HJ_V428_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V428_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V428_SHOTS, name + '.png'), animations: 'disabled' });
  }

  await test('card normalization and legacy readers are conservative and immutable', async () => {
    await seed(); const before = await snapshot();
    const result = await page.evaluate(today => {
      const legacy = [{ d: today, project: 'TEST_OLD', amt: 10 }, { d: today, amt: 20, proof: 'cash', proofAt: today }, { amt: 30, proof: 'etc' }, { amt: 40, proof: 'card' }, { amt: 50, issue: null, proof: 'tax' }];
      const raw = JSON.stringify(legacy), read = legacy.map(hjTaxIssueRead);
      return { card: hjTaxIssueNormalize({ method: '카드', issue: { type: 'tax', status: 'issued', no: 'TEST_CARD_MUST_CLEAR', at: today } }), read, unchanged: JSON.stringify(legacy) === raw };
    }, TODAY);
    assert.deepEqual(result.card, { method: '카드', issue: { type: 'none', status: 'notApplicable', no: '', at: '' } }, 'CARD_AUTOMATIC_NOT_APPLICABLE');
    assert.equal(result.unchanged, true); assert.equal(result.read[0].method, ''); assert.equal(result.read[0].needsReview, true);
    assert.equal(result.read[1].status, 'issued'); assert.equal(result.read[1].method, '', 'legacy proof does not infer receipt method');
    assert.equal(result.read[2].needsReview, true); assert.equal(result.read[3].status, 'notApplicable'); assert.equal(result.read[4].status, 'pending'); assert.equal(result.read[4].needsReview, true);
    await page.evaluate(() => { for (let i = 0; i < 3; i++) { hjTaxIssueRows(); hjTaxIssuePending(localDate()); hjTaxIssueSummary(); hjDayCloseData(); } });
    await same(before, 'TAX_ISSUE_READERS_KEEP_PAID_STATE');
  });

  await test('normal receipt UI suggests tax or cash and stores card as non-issuance', async () => {
    await seed(); const top = Object.keys((await snapshot()).live).sort();
    await page.evaluate(name => recvQuickView(name), BUSINESS);
    assert.equal(await page.locator('#rqTaxType').inputValue(), 'tax'); assert.equal(await page.locator('#rqTaxStatus').inputValue(), 'pending');
    await close(); await page.evaluate(name => recvQuickView(name), INTERIOR);
    assert.equal(await page.locator('#rqTaxType').inputValue(), 'cash');
    await page.locator('#rqAmt').fill('12345'); await page.locator('#rqTaxMethod').selectOption('카드');
    assert.equal(await page.locator('#rqTaxType').inputValue(), 'none'); assert.equal(await page.locator('#rqTaxStatus').inputValue(), 'notApplicable');
    assert.equal(await page.locator('#rqTaxStatus').isDisabled(), true);
    await geometry(['#rqTaxMethod', '#rqTaxType', '#rqTaxStatus', '#modalRoot .mfoot button']); await shot('01-tax-receipt-card');
    const beforeSave = await snapshot();
    await page.evaluate(() => { window.__v428ReceiveAtomic = { original: paidCommitWriteAtomic, calls: 0 }; paidCommitWriteAtomic = async () => { __v428ReceiveAtomic.calls++; throw Error('TEST_V428_RECEIVE_ATOMIC_FAIL'); }; });
    try {
      await page.locator('#modalRoot .mfoot').getByRole('button', { name: '입금 저장', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#rqIssue')?.textContent.includes('TEST_V428_RECEIVE_ATOMIC_FAIL'));
      assert.equal(await page.evaluate(() => __v428ReceiveAtomic.calls), 1); assert.equal(await page.locator('#rqAmt').inputValue(), '12345');
      assert.equal(await page.locator('#rqTaxMethod').inputValue(), '카드'); await same(beforeSave, 'TAX_ISSUE_RECEIVE_FAILED_WRITE_PRESERVES_PAYLOG_AND_RECEIVED');
    } finally { await page.evaluate(() => { paidCommitWriteAtomic = __v428ReceiveAtomic.original; }); }
    await page.locator('#modalRoot .mfoot').getByRole('button', { name: '입금 저장', exact: true }).click();
    await page.locator('#modalRoot .mfoot').getByRole('button', { name: '나중에', exact: true }).waitFor();
    await page.locator('#modalRoot .mfoot').getByRole('button', { name: '나중에', exact: true }).click(); await close(); await persist();
    const after = await snapshot(), rec = after.live.payLog.find(row => row.amt === 12345);
    assert.equal(after.live.payLog.length, 9); assert.equal(rec.method, '카드'); assert.equal(rec.proof, 'card'); assert.deepEqual(rec.issue, { type: 'none', status: 'notApplicable', no: '', at: '' });
    assert.deepEqual(after.stored.payLog, after.live.payLog); assert.deepEqual(Object.keys(after.live).sort(), top, 'TAX_ISSUE_NO_NEW_TOP_KEYS');
    assert.equal(after.live.projects.find(project => project.name === INTERIOR).received, 1212345);
  });

  await test('pending list, exact five-day alert, today list, issued and declined actions', async () => {
    await seed(); const before = await snapshot();
    const lists = await page.evaluate(today => ({ pending: hjTaxIssuePending(today).map(row => row.rec.id).sort(), due: hjTaxIssuePending(today, { minDays: 5 }).map(row => row.rec.id).sort(), today: hjDayCloseData(today).taxIssue.map(row => row.rec.id), alert: briefExtraItems().find(row => row.action === 'taxissue') }), TODAY);
    assert.deepEqual(lists.pending, ['TEST_PAY_1', 'TEST_PAY_2', 'TEST_PAY_4', 'TEST_PAY_7']); assert.deepEqual(lists.due, ['TEST_PAY_2', 'TEST_PAY_7']); assert.deepEqual(lists.today, ['TEST_PAY_1']);
    assert.match(lists.alert.t, /5일.*2건/); assert.match(lists.alert.sub, /거래일 기준 기한 확인/);
    await page.evaluate(() => hjDayCloseView()); await page.locator('[data-dc-taxissue]').click();
    assert.equal(await page.locator('[data-tax-issue-row]').count(), 1); await close();
    await page.evaluate(() => hjTaxIssueView()); assert.equal(await page.locator('[data-tax-issue-row]').count(), 4);
    assert.match(await page.locator('#hjTaxIssueList').textContent(), /미확인 1건/);
    await geometry(['[data-tax-issue-edit]', '[data-tax-issue-decline]', '#modalRoot .mfoot button']); await shot('02-tax-pending-list');
    await close(); await same(before, 'TAX_ISSUE_LISTS_READ_ONLY');
    await page.evaluate(() => hjTaxIssueView({ todayOnly: true })); await page.locator('[data-tax-issue-edit]').click();
    assert.equal(await page.locator('#tiStatus').inputValue(), 'issued'); await page.locator('#tiNo').fill('TEST_ISSUED_001'); await page.locator('#hjTaxIssueSave').click();
    await page.locator('#hjTaxIssueList').waitFor(); assert.equal(await page.locator('[data-tax-issue-row]').count(), 0);
    let rec = await page.evaluate(() => state.payLog.find(row => row.id === 'TEST_PAY_1'));
    assert.equal(rec.issue.no, 'TEST_ISSUED_001'); assert.equal(rec.issue.at, TODAY); assert.equal(rec.proof, 'cash');
    await close(); await page.evaluate(() => hjTaxIssueView({ minDays: 5 }));
    const row = page.locator('[data-tax-issue-row]').filter({ hasText: '200,000' }); await row.locator('[data-tax-issue-decline]').click();
    assert.equal(await page.locator('#tiStatus').inputValue(), 'declined'); await page.locator('#hjTaxIssueSave').click(); await page.locator('#hjTaxIssueList').waitFor();
    rec = await page.evaluate(() => state.payLog.find(row => row.id === 'TEST_PAY_2'));
    assert.equal(rec.issue.status, 'declined'); assert.equal(rec.proof, 'etc');
    assert.equal(await page.evaluate(() => hjTaxIssuePending(localDate()).some(row => row.rec.id === 'TEST_PAY_2' && row.needsReview)), true, 'CUSTOMER_DECLINE_IS_NOT_EXEMPTION');
    assert.match(await page.locator('#hjTaxIssueList').textContent(), /발행 의무 확인|의무 확인/);
  });

  await test('receipt and sales bases retain negatives and explicitly unknown kinds', async () => {
    await seed(); const before = await snapshot();
    const summary = await page.evaluate(month => hjTaxIssueSummary(month, month), MONTH);
    assert.deepEqual(summary.receipt, RECEIPTS, 'TAX_ISSUE_EIGHT_RECEIPT_INDEPENDENT_TOTALS');
    assert.deepEqual(summary.sales, SALES, 'TAX_ISSUE_SALES_INDEPENDENT_TOTALS');
    await page.evaluate(month => monthCloseView(1, month), MONTH); await page.locator('[data-tax-split]').waitFor();
    for (const [kind, value] of Object.entries(RECEIPTS)) {
      const text = await page.locator('[data-tax-kind="' + kind + '"]').textContent(); assert(text.includes(value.n + '건')); assert(text.includes(value.sum.toLocaleString('en-US')));
    }
    await page.locator('[data-tax-basis="sales"]').click();
    assert.match(await page.locator('[data-tax-kind="total"]').textContent(), /3건.*6,600,000/);
    assert.equal(await page.locator('[data-tax-basis="sales"]').getAttribute('aria-pressed'), 'true');
    await geometry(['[data-tax-basis]']); await shot('03-tax-split-sales'); await close(); await same(before, 'TAX_ISSUE_SUMMARY_READ_ONLY');
    const edge = await page.evaluate(() => {
      const original = state.projects, p = original.find(row => row.name === 'TEST_TAX_INTERIOR');
      // Swap synthetic candidates instead of deleting/reinserting a saved object's
      // keys. Restore the exact array and objects even if a reader assertion fails.
      try {
        const untyped = { ...p }; delete untyped.kind;
        state.projects = original.map(row => row === p ? untyped : row); const missing = hjTaxIssueKind(p.name);
        state.projects = [...original, { name: p.name, kind: 'leak' }]; const duplicate = hjTaxIssueKind(p.name);
        state.projects = original.map(row => row === p ? { ...p, archived: true } : row); const archived = hjTaxIssueKind(p.name);
        state.projects = [...original, { name: '', kind: 'interior' }]; const empty = hjTaxIssueKind('');
        return { missing, duplicate, archived, empty };
      } finally { state.projects = original; }
    });
    assert.deepEqual(edge, { missing: 'unknown', duplicate: 'unknown', archived: 'interior', empty: 'unknown' });
    await same(before, 'TAX_ISSUE_KIND_EDGE_RESTORES_EXACT_STATE');
  });

  await test('linked quote issuance uses one durable record and survives both editor reopen paths', async () => {
    await seed(); const before = await snapshot(); await edit('TEST_PAY_4', 'issued');
    await page.locator('#tiType').selectOption('tax'); await page.locator('#tiNo').fill('TEST_LINKED_428'); await page.locator('#tiAt').fill('2026-10-15');
    await page.locator('#hjTaxIssueSave').click(); await saved();
    let after = await snapshot(), rec = after.live.payLog.find(row => row.id === 'TEST_PAY_4'), quote = after.live.quotes.find(row => row.id === 'TEST_TAX_Q_LEAK');
    assert.equal(after.live.payLog.length, 8); assert.deepEqual(rec.issue, { type: 'tax', status: 'issued', no: 'TEST_LINKED_428', at: '2026-10-15' });
    assert.equal(rec.proof, 'tax'); assert.equal(rec.proofAt, '2026-10-15'); assert.deepEqual(quote.paid.receipt, { type: '세금계산서', issued: true });
    assert.equal(quote.paid.amount, 400000); assert.equal(quote.paid.payLogId, 'TEST_PAY_4');
    assert.equal(after.live.projects.find(row => row.name === LEAK).received, 850000); assert.deepEqual(after.stored.payLog, after.live.payLog); assert.deepEqual(after.stored.quotes, after.live.quotes);
    await edit('TEST_PAY_4'); assert.equal(await page.locator('#tiNo').inputValue(), 'TEST_LINKED_428'); await close();
    await page.evaluate(() => hjLeakPaymentView(state.quotes.find(row => row.id === 'TEST_TAX_Q_LEAK'))); await page.locator('#hjLeakPayForm').waitFor();
    assert.equal(await page.locator('#hjLeakTaxStatus').inputValue(), 'issued', 'LINKED_PAYMENT_REOPEN_ISSUE_STATUS');
    assert.equal(await page.locator('#hjLeakTaxNo').inputValue(), 'TEST_LINKED_428', 'LINKED_PAYMENT_REOPEN_ISSUE_NUMBER');
    assert.equal(await page.locator('#hjLeakTaxAt').inputValue(), '2026-10-15');
    await page.locator('#hjLeakPayMethod').selectOption('카드'); assert.equal(await page.locator('#hjLeakTaxStatus').inputValue(), 'notApplicable'); assert.equal(await page.locator('#hjLeakPayIssued').isChecked(), false);
    await page.locator('#modalRoot .mfoot').getByRole('button', { name: '저장', exact: true }).click(); await saved('#hjLeakPayForm', '#hjLeakPayIssue');
    after = await snapshot(); quote = after.live.quotes.find(row => row.id === 'TEST_TAX_Q_LEAK'); rec = after.live.payLog.find(row => row.id === 'TEST_PAY_4');
    assert.deepEqual(rec.issue, { type: 'none', status: 'notApplicable', no: '', at: '' }); assert.equal(rec.proof, 'card'); assert.equal(Object.hasOwn(rec, 'proofAt'), false);
    assert.equal(quote.paid.method, '카드'); assert.deepEqual(quote.paid.receipt, { type: '카드전표', issued: false });
    assert.equal(after.live.payLog.length, 8); assert.equal(after.live.projects.find(row => row.name === LEAK).received, 850000);
    assert.deepEqual(Object.keys(after.live).sort(), Object.keys(before.live).sort());
  });

  await test('atomic failure keeps input and both stores intact, then one retry succeeds', async () => {
    await seed(); await edit('TEST_PAY_1', 'issued'); await page.locator('#tiNo').fill('TEST_ATOMIC_RETRY'); const before = await snapshot();
    await page.evaluate(() => { window.__v428Atomic = { original: paidCommitWriteAtomic, calls: 0 }; paidCommitWriteAtomic = async () => { __v428Atomic.calls++; throw Error('TEST_V428_ATOMIC_FAIL'); }; });
    try {
      await page.locator('#hjTaxIssueSave').click();
      await page.waitForFunction(() => document.querySelector('#hjTaxIssueError')?.textContent.includes('TEST_V428_ATOMIC_FAIL'));
      assert.equal(await page.evaluate(() => __v428Atomic.calls), 1); assert.equal(await page.locator('#tiNo').inputValue(), 'TEST_ATOMIC_RETRY');
      await same(before, 'TAX_ISSUE_FAILED_COMMIT_PRESERVES_DATA');
    } finally { await page.evaluate(() => { paidCommitWriteAtomic = __v428Atomic.original; }); }
    await page.locator('#hjTaxIssueSave').click(); await page.waitForFunction(() => !document.getElementById('hjTaxIssueForm'));
    const after = await snapshot(); assert.equal(after.live.payLog.length, 8); assert.equal(after.live.payLog.find(row => row.id === 'TEST_PAY_1').issue.no, 'TEST_ATOMIC_RETRY'); assert.deepEqual(after.live.payLog, after.stored.payLog);
  });

  await test('stale or updating tabs and ambiguous links cannot write through an open form', async () => {
    for (const flag of ['stale', 'updating']) {
      await seed(); await edit('TEST_PAY_1', 'issued'); await page.locator('#tiNo').fill('TEST_KEEP_DRAFT'); const before = await snapshot();
      await page.evaluate(flag => { __tabStale = flag === 'stale'; __appVersionUpdating = flag === 'updating'; }, flag);
      try {
        await page.locator('#hjTaxIssueSave').click(); await page.waitForFunction(() => !!document.querySelector('#hjTaxIssueError')?.textContent);
        assert.match(await page.locator('#hjTaxIssueError').textContent(), /바뀌|최신|오래|업데이트/); assert.equal(await page.locator('#tiNo').inputValue(), 'TEST_KEEP_DRAFT'); await same(before, 'TAX_ISSUE_' + flag + '_NO_WRITE');
      } finally { await page.evaluate(() => { __tabStale = false; __appVersionUpdating = false; }); }
    }
    await seed(); const before = await snapshot();
    const guards = await page.evaluate(() => {
      const rec = state.payLog.find(row => row.id === 'TEST_PAY_4'), q = state.quotes.find(row => row.id === 'TEST_TAX_Q_LEAK');
      const reject = () => { try { hjTaxIssueContext(rec); return false; } catch (_) { return true; } };
      state.projects.push({ name: rec.project, kind: 'leak' }); const duplicateProject = reject(); state.projects.pop();
      state.quotes.push({ ...q, id: 'TEST_DUP_Q' }); const duplicateQuote = reject(); state.quotes.pop();
      state.editingQuote = JSON.parse(JSON.stringify(q)); state.editingQuote.paid.amount++; const unsavedPayment = reject(); state.editingQuote = null;
      return { duplicateProject, duplicateQuote, unsavedPayment };
    });
    assert.deepEqual(guards, { duplicateProject: true, duplicateQuote: true, unsavedPayment: true }); await same(before, 'TAX_ISSUE_AMBIGUOUS_LINKS_READ_ONLY');
  });

  await test('invalid and future receipt dates stay out of reminders without losing ledger totals', async () => {
    await seed();
    const result = await page.evaluate(today => {
      const original = state.payLog;
      try {
        const rec = (id, d, amt) => ({ id, d, project: 'TEST_TAX_INTERIOR', amt, method: '현금', issue: { type: 'cash', status: 'pending', no: '', at: '' } });
        state.payLog = [rec('VALID', today, 10), rec('ZERO', today, 0), rec('NEGATIVE', today, -5), rec('MISSING', '', 20), rec('BAD', '2026-02-30', 30), rec('FUTURE', hjAddDays(today, 1), 40)];
        return { ids: hjTaxIssuePending(today).map(row => row.rec.id), all: hjTaxIssueSummary().receipt.total, month: hjTaxIssueSummary('2026-10', '2026-10').receipt.total };
      } finally { state.payLog = original; }
    }, TODAY);
    assert.deepEqual(result.ids, ['VALID']); assert.deepEqual(result.all, { n: 6, sum: 95 }); assert.deepEqual(result.month, { n: 4, sum: 45 });
  });

  await test('calendar offers invoice deadlines without silently adding or duplicating them', async () => {
    await seed(); const before = await snapshot();
    const proposals = await page.evaluate(today => hjTaxIssueCalendarProposals(today), TODAY);
    assert(proposals.length > 0, 'TAX_ISSUE_CALENDAR_PROPOSALS_PRESENT');
    assert.equal(proposals.length, 12); assert.equal(proposals[0].raw, '2026-11-10'); assert.equal(proposals.at(-1).raw, '2027-10-10');
    assert(proposals.every(row => /세금계산서.*전월분/.test(row.title) && row.raw.endsWith('-10')), 'TAX_ISSUE_CALENDAR_PROPOSAL_TITLE_AND_TENTH');
    await page.evaluate(() => taxCalendarView()); await page.locator('#txIssueOffer').click(); await page.locator('#hjTaxIssueCalendarConfirm').waitFor();
    await close(); await same(before, 'TAX_ISSUE_CALENDAR_CANCEL_NO_WRITE');
    await page.evaluate(() => taxCalendarView()); await page.locator('#txIssueOffer').click(); await page.locator('#hjTaxIssueCalendarAdd').click();
    await poll(() => page.evaluate(() => (state.schedule || []).filter(row => /세금계산서.*전월분/.test(row.title || '')).length), count => count === proposals.length, 'TAX_ISSUE_CALENDAR_ADD_ONCE');
    await persist();
    const result = await page.evaluate(today => ({ proposals: hjTaxIssueCalendarProposals(today), rows: state.schedule.filter(row => /세금계산서.*전월분/.test(row.title || '')) }), TODAY);
    assert.equal(result.proposals.length, 0); assert.equal(new Set(result.rows.map(row => row.id)).size, result.rows.length);
    assert.deepEqual(result.rows.map(row => ({ id: row.id, date: row.date })), proposals.map(row => ({ id: row.id, date: row.date })), 'TAX_ISSUE_CALENDAR_EXPLICIT_HOLIDAY_ADJUSTED_PROPOSALS');
    const after = await snapshot(); assert.deepEqual(after.live.schedule, after.stored.schedule);
  });

  await test('actual XLSX workbook keeps old columns and includes issuance and kind split', async () => {
    await seed(); const before = await snapshot();
    await page.addScriptTag({ content: await xlsxLibrarySource() });
    assert.equal(await page.evaluate(() => window.XLSX?.version), '0.18.5', 'TAX_ISSUE_XLSX_RUNTIME_VERSION');
    const data = await page.evaluate(async () => {
      const rows = hjTaxIssueExportRows(), original = XLSX.writeFile;
      let captured;
      XLSX.writeFile = (workbook, filename) => { const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }); const reopened = XLSX.read(bytes, { type: 'array' }); captured = { filename, sheets: reopened.SheetNames, rows: XLSX.utils.sheet_to_json(reopened.Sheets['수금이력'], { header: 1, defval: '' }) }; };
      window.__payHist = { from: '', to: '', pj: '', q: '', page: 1 };
      try { await payHistExcel(); } finally { XLSX.writeFile = original; }
      return { rows, captured };
    });
    const header = ['일자', '현장', '금액', '결제 방법', '발행 상태', '증빙 종류', '승인·발행번호', '발행 기록일', '공사 구분'];
    assert.deepEqual(data.rows[0], header); assert.equal(data.rows.length, 9); assert.equal(data.rows.slice(1).reduce((sum, row) => sum + row[2], 0), 2750000);
    assert.deepEqual(data.captured.sheets, ['수금이력']); assert.deepEqual(data.captured.rows[0], header); assert.equal(data.captured.rows.length, 10);
    assert.equal(data.captured.rows.at(-1)[2], 2750000); assert.equal(data.captured.rows.filter(row => row[8] === '누수').length, 3); assert.equal(data.captured.rows.filter(row => row[8] === '인테리어').length, 4); assert.equal(data.captured.rows.filter(row => row[8] === '미분류').length, 1);
    assert.equal(data.captured.rows.find(row => row[2] === 300000)[4], '카드 · 발행 해당 없음'); await same(before, 'TAX_ISSUE_XLSX_EXPORT_READ_ONLY');
  });

  await test('mobile more contract stays 126 with no remote or customer side effects', async () => {
    await seed(); const before = await snapshot();
    await page.locator('.mobile-nav [data-mnav="__more"]').click(); await page.locator('#moreSheet').waitFor();
    assert.equal(await page.locator('.more-cat-block [data-moreaction]').count(), 126, 'TAX_ISSUE_MORE_MENU_126');
    const actions = await page.evaluate(() => MORE_CATS.flatMap(cat => cat.items.map(item => item[0]))); assert.equal(actions.length, 126); assert.equal(new Set(actions).size, 126);
    await page.locator('#moreSheetClose').click(); await page.waitForFunction(() => !document.getElementById('moreSheet') && !__mobileSheetHistoryRetire);
    await same(before, 'TAX_ISSUE_MORE_READ_ONLY'); assert.equal(network.writes, 0, 'TAX_ISSUE_NO_NETWORK_WRITES'); assert.equal(await page.evaluate(() => window.__v428External), 0, 'TAX_ISSUE_NO_SEND_OR_LOGIN'); assert.deepEqual(pageErrors, [], 'TAX_ISSUE_NO_PAGE_ERRORS');
  });
  await context.close(); console.log('taxissue-v428: ' + passed + '/' + passed + ' passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });

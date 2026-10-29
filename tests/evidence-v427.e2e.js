/* v427 건별 증빙 묶음·월말 묶음 — 합성 레코드만. JSZip/XLSX/__docExport 는 기록용 스텁(외부 라이브러리·다운로드·Drive 0).
   HJ_V427_BASELINE=<commit> 은 EVIDENCE_API_PRESENT 에서, HJ_V427_MUTATION=customer-internal(고객용에 내부 원가 포함) 은 CUSTOMER_NO_INTERNAL_COST 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_EVIDENCE_LEAK', INTERIOR = 'TEST_EVIDENCE_INTERIOR', OLD = 'TEST_EVIDENCE_LASTMONTH';
const PRIVATE = ['TEST_PRIVATE_CUSTOMER', '010-0000-0000', 'TEST_PRIVATE_ADDRESS'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V427_BASELINE && execFileSync('git', ['show', process.env.HJ_V427_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v427Calls = { zips: [], downloads: [], drive: [], external: [] };
    window.open = (...args) => { __v427Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v427Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjEvidencePlan', 'hjEvidenceBundle', 'hjEvidenceView', 'hjEvidenceMonthBundle', 'hjEvidenceMonthView', 'hjEvidencePhotos', 'hjEvidenceLedgerRows'].every(k => typeof window[k] === 'function') && !!HJ_DOC433_TYPES.evidence), true, 'EVIDENCE_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false;
    taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V427_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    // 기록용 스텁 — JSZip 은 담긴 경로와 내용을, XLSX 는 행을, 다운로드 앵커는 파일명을 남긴다. 실제 라이브러리·네트워크는 쓰지 않는다.
    window.ensureJSZip = async () => {}; window.ensureXLSX = async () => {};
    window.JSZip = function () {
      const files = {}; const record = { files }; __v427Calls.zips.push(record);
      const make = prefix => ({ file(p, b) { files[prefix + p] = b; return this; }, folder(n) { return make(prefix + n + '/'); } });
      const api = make(''); api.generateAsync = async () => new Blob([JSON.stringify(Object.keys(files))], { type: 'application/zip' }); return api;
    };
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => rows, book_append_sheet: (wb, ws, name) => { wb.sheets.push({ name, rows: ws }); } }, write: wb => JSON.stringify(wb.sheets), writeFile: () => {} };
    hjEvidenceDownload = (blob, name) => { __v427Calls.downloads.push(name); };
    hjEvidenceDrive = async (blob, name) => { __v427Calls.drive.push(name); return true; };
    __docExport = async () => new Blob(['%PDF-TEST'], { type: 'application/pdf' });
  });
  if (process.env.HJ_V427_MUTATION) {
    assert.equal(process.env.HJ_V427_MUTATION, 'customer-internal');
    await page.evaluate(() => { const real = hjEvidenceOptions; hjEvidenceOptions = input => { const o = real(input); if (o.purpose === 'customer') o.internal = true; return o; }; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS evidence-v427 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, interior, old, privateFields, png }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.expenses = [];
      const day = localDate(), at = day + 'T03:00:00.000Z', lastMonth = hjAddDays(day.slice(0, 7) + '-01', -1);
      const project = (name, kind, doneAt) => ({ name, kind, stage: 3, phases: [], customer: { name: privateFields[0], phone: privateFields[1], addr: privateFields[2] }, received: 0, archived: false, doneAt, cost: { material: 20000, labor: 30000, outsource: 0 } });
      const p = project(leak, 'leak', day); p.received = 150000;
      p.leak = { intake: { where: ['욕실'], since: '오늘', amount: '똑똑 떨어짐', at }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', place: 'TEST_PLACE', at } };
      p.warranty = { startedAt: day, items: [{ name: '배관 수리', months: 24, expiresAt: hjAddDays(day, 730) }] };
      p.docs = [{ type: 'payrcpt', no: 'MM-20260101-01', at, purpose: '잔금', name: '간이영수증', ref: 'TEST_EV_PAY_2' }];
      const q = project(interior, 'interior', day); q.received = 0;
      const o = project(old, 'interior', lastMonth);
      state.projects = [p, q, o];
      state.quotes = [{ id: 'TEST_EV_QUOTE', project: leak, title: 'TEST_EV_QUOTE_TITLE', date: day, leak: { from: 'template', cause: '온수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 200000 }], vatIncluded: true, memo: 'TEST_INTERNAL_MEMO',
        paid: { method: '계좌이체', amount: 100000, at: day, receipt: { type: '세금계산서', issued: true }, payLogId: 'TEST_EV_PAY_1' } },
        { id: 'TEST_EV_QUOTE_INT', project: interior, title: 'TEST_EV_INT_QUOTE', date: day, items: [{ name: '도배', qty: 1, price: 500000 }], vatIncluded: true }];
      state.quotes.forEach(x => syncQuoteToProject(x));
      state.payLog = [{ id: 'TEST_EV_PAY_1', d: day, project: leak, amt: 100000, method: '계좌이체', quoteId: 'TEST_EV_QUOTE', source: 'leak-quote' }, { id: 'TEST_EV_PAY_2', d: day, project: leak, amt: 50000, method: '현금' }];
      const photo = (id, project, when, extra) => ({ id, kind: 'photo', project, name: id + '.jpg', ext: 'jpg', when, thumb: png, ...extra });
      state.files.push(photo('TEST_EV_AFTER_2', leak, day + 'T05:00:00.000Z', { _leaktag: 'after', _worklabel: '욕실' }), photo('TEST_EV_MID_1', leak, day + 'T02:00:00.000Z', {}), photo('TEST_EV_BEFORE_1', leak, day + 'T00:30:00.000Z', { _leaktag: 'before', _worklabel: '욕실' }),
        photo('TEST_EV_AFTER_1', leak, day + 'T04:00:00.000Z', { _leaktag: 'after' }), photo('TEST_EV_BEFORE_2', leak, day + 'T01:00:00.000Z', { _phase: '철거' }), photo('TEST_EV_MID_2', leak, day + 'T03:00:00.000Z', { _leaktag: 'cause' }),
        { id: 'TEST_EV_RCPT_1', kind: 'receipt', project: leak, name: 'receipt1.jpg', ext: 'jpg', when: day + 'T06:00:00.000Z', thumb: png }, { id: 'TEST_EV_RCPT_2', kind: 'receipt', project: leak, name: 'receipt2.jpg', ext: 'jpg', when: day + 'T06:10:00.000Z', thumb: png },
        photo('TEST_EV_INT_PH', interior, day + 'T01:00:00.000Z', { _phase: '완료' }));
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v427Calls)) __v427Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V427_SEED_SAVE_FAILED');
    }, { leak: LEAK, interior: INTERIOR, old: OLD, privateFields: PRIVATE, png: PNG });
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
    if (!process.env.HJ_V427_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V427_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V427_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const lastZip = () => page.evaluate(() => { const z = __v427Calls.zips.at(-1); const out = {}; for (const [k, v] of Object.entries(z.files)) out[k] = typeof v === 'string' ? v : (v && v.name ? 'FILE:' + v.name : 'BLOB'); return out; });

  await test('one project bundle: entries, photo order and names, xlsx rows, record', async () => {
    await seed(); const before = await snapshot();
    const plan = await page.evaluate(name => { const p = hjEvidencePlan(name, { purpose: 'tax' }); return { fileName: p.fileName, paths: p.entries.map(e => e.path), notes: p.notes, counts: p.counts, sides: p.entries.filter(e => e.kind === 'photo').map(e => e.side), xlsx: p.entries.find(e => e.kind === 'xlsx').payload, list: p.entries[0].payload }; }, LEAK);
    assert.match(plan.fileName, new RegExp('^만물_증빙_' + LEAK + '_\\d{8}\\.zip$'));
    assert.deepEqual(plan.sides, ['전', '전', '중', '중', '후', '후']);
    const photos = plan.paths.filter(p => p.startsWith('02_사진/'));
    assert.deepEqual(photos, ['02_사진/01_전_욕실.jpg', '02_사진/02_전_철거.jpg', '02_사진/03_중.jpg', '02_사진/04_중_원인.jpg', '02_사진/05_후.jpg', '02_사진/06_후_욕실.jpg']);
    assert.deepEqual(plan.paths.filter(p => p.startsWith('03_')), ['03_영수증/receipt1.jpg', '03_영수증/receipt2.jpg']);
    assert.deepEqual(plan.paths.filter(p => p.startsWith('01_')), ['01_견적/TEST_EV_QUOTE_TITLE.txt']);
    assert.deepEqual(plan.paths.filter(p => p.startsWith('04_')), ['04_보고서/거래명세서.html', '04_보고서/청구서.html']);
    assert.deepEqual(plan.paths.filter(p => p.startsWith('05_')), ['05_보증서/하자보증서.html']); assert(plan.paths.includes('06_수금발행기록.xlsx')); assert.equal(plan.paths[0], '00_목록.txt');
    assert.equal(plan.paths.length, 14); assert(plan.notes.some(n => /누수 보고서/.test(n)), 'missing report is named, not silently skipped');
    assert.deepEqual(plan.xlsx[0], ['날짜', '금액', '방법', '견적', '세금계산서/현금영수증', '간이영수증']);
    assert.equal(plan.xlsx[1][1], 100000); assert.equal(plan.xlsx[1][4], '세금계산서 발행'); assert.equal(plan.xlsx[1][3], 'TEST_EV_QUOTE_TITLE');
    assert.equal(plan.xlsx[2][1], 50000); assert.equal(plan.xlsx[2][5], 'MM-20260101-01', 'simple receipt linked by payLog ref'); assert.deepEqual(plan.xlsx[3].slice(0, 2), ['합계', 150000]);
    assert.match(plan.list, /용도: 세무사용/); assert.match(plan.list, /의뢰인: T○○/); assert(!plan.list.includes(PRIVATE[1]), 'tax bundle has no phone'); assert.match(plan.list, /원가\(내부\)/); assert.match(plan.list, /간이영수증 MM-20260101-01/);
    sameSnapshot(await snapshot(), before, 'plan is read only');
    const r = await page.evaluate(name => hjEvidenceBundle(name, { purpose: 'tax' }, 'download'), LEAK);
    assert.equal(r.added, 14); assert.equal(r.skipped, 0); assert.equal(r.preview, 8, 'thumbnails stand in for originals and are counted');
    const zip = await lastZip(); const keys = Object.keys(zip);
    assert.equal(keys.length, 14); assert(keys.every(k => k.startsWith(LEAK + '/')), 'project folder'); assert.match(zip[LEAK + '/01_견적/TEST_EV_QUOTE_TITLE.txt'], /TEST_INTERNAL_MEMO/); assert.match(zip[LEAK + '/01_견적/TEST_EV_QUOTE_TITLE.txt'], /220,000원/);
    assert.match(zip[LEAK + '/06_수금발행기록.xlsx'], /세금계산서 발행/); assert.equal(zip[LEAK + '/02_사진/01_전_욕실.jpg'], 'FILE:01_전_욕실.jpg');
    const issued = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); return { docs: p.docs, note: state.notes.find(n => n.text.startsWith('[문서] 증빙 묶음')), stored: (await idbGetStrict('appState')).projects.find(x => x.name === name).docs, downloads: __v427Calls.downloads, keys: Object.keys(serializeData()).sort() }; }, LEAK);
    assert.equal(issued.docs.length, 2); assert.equal(issued.docs[1].type, 'evidence'); assert.match(issued.docs[1].no, /^EV-\d{8}-01$/); assert.equal(issued.docs[1].purpose, '세무사용'); assert.match(issued.docs[1].name, /^만물_증빙_/);
    assert(issued.note); assert.deepEqual(issued.stored, issued.docs); assert.deepEqual(issued.downloads, [r.fileName]); assert.deepEqual(issued.keys, before.keys, 'no new top-level serialized keys');
  });

  await test('three purposes: customer has no internal cost or memo, tax masks, insurance can hide amounts', async () => {
    await seed(); const before = await snapshot();
    const r = await page.evaluate(name => {
      const text = (plan, p) => { const e = plan.entries.find(x => x.path === p); return e ? String(e.payload) : null; };
      const customer = hjEvidencePlan(name, { purpose: 'customer' }), tax = hjEvidencePlan(name, { purpose: 'tax' }), ins = hjEvidencePlan(name, { purpose: 'insurance', hideAmount: true }), insFull = hjEvidencePlan(name, { purpose: 'insurance', fullName: true });
      return { customer: { list: text(customer, '00_목록.txt'), quote: text(customer, '01_견적/TEST_EV_QUOTE_TITLE.txt'), paths: customer.entries.map(e => e.path) }, tax: { list: text(tax, '00_목록.txt'), quote: text(tax, '01_견적/TEST_EV_QUOTE_TITLE.txt') }, ins: { list: text(ins, '00_목록.txt'), quote: text(ins, '01_견적/TEST_EV_QUOTE_TITLE.txt'), paths: ins.entries.map(e => e.path), notes: ins.notes }, insFull: { list: text(insFull, '00_목록.txt') }, purposes: Object.keys(HJ_EVIDENCE_PURPOSES) };
    }, LEAK);
    assert.deepEqual(r.purposes, ['tax', 'insurance', 'customer']);
    assert(!/원가/.test(r.customer.list), 'CUSTOMER_NO_INTERNAL_COST'); assert(!r.customer.quote.includes('TEST_INTERNAL_MEMO'), 'customer bundle has no internal memo'); assert(r.customer.list.includes(PRIVATE[0]), 'customer sees own full name'); assert(r.customer.list.includes(PRIVATE[1]));
    assert.match(r.tax.list, /원가\(내부\)/); assert(r.tax.quote.includes('TEST_INTERNAL_MEMO')); assert(!r.tax.list.includes(PRIVATE[0])); assert(!r.tax.list.includes(PRIVATE[1]));
    assert(!r.ins.paths.some(p => /거래명세서|청구서|수금발행기록/.test(p)), 'hidden amounts drop statement, invoice and ledger'); assert(!/\d[\d,]*원/.test(r.ins.quote), 'hidden amounts keep item names only'); assert(!/견적\(매출\)/.test(r.ins.list)); assert(r.ins.notes.some(n => /금액 숨김/.test(n)));
    assert(!r.ins.list.includes(PRIVATE[0])); assert(r.insFull.list.includes(PRIVATE[0]), 'insurance opt-in full name');
    sameSnapshot(await snapshot(), before);
    await page.evaluate(name => hjEvidenceView(name), LEAK); await page.locator('#hjEvidenceForm').waitFor();
    assert.equal(await page.locator('[data-evidence-purpose]').count(), 3); assert.equal(await page.locator('[data-evidence-part]').count(), 6); assert.match(await page.locator('[data-evidence-preview]').innerText(), /파일 14개/);
    await tapOk('[data-evidence-purpose], #modalRoot .mfoot button'); await noOverflow(); await shot('01-evidence-form');
    await page.locator('[data-evidence-purpose="insurance"]').click(); await page.locator('#evHideAmount').waitFor(); await page.locator('#evHideAmount').check(); await page.locator('[data-evidence-preview]', { hasText: '금액 숨김' }).waitFor();
    assert.match(await page.locator('[data-evidence-preview]').innerText(), /파일 11개/);
    await page.locator('[data-evidence-purpose="customer"]').click(); await page.waitForFunction(() => !document.getElementById('evHideAmount') && !document.getElementById('evFullName'));
    sameSnapshot(await snapshot(), before, 'form changes are read only');
  });

  await test('leak report generated on request through the v422 issue path', async () => {
    await seed();
    const without = await page.evaluate(name => hjEvidencePlan(name, { purpose: 'insurance' }).entries.some(e => e.kind === 'leakreport'), LEAK);
    assert.equal(without, false);
    const r = await page.evaluate(name => hjEvidenceBundle(name, { purpose: 'insurance', genLeakReport: true }, 'drive'), LEAK);
    const zip = await lastZip(); const pdf = Object.keys(zip).find(k => /04_보고서\/LR-\d{8}-01_.*\.pdf$/.test(k));
    assert(pdf, 'generated report lands in the bundle: ' + Object.keys(zip).join(', ')); assert.equal(zip[pdf], 'BLOB'); assert.equal(r.skipped, 0);
    const after = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); return { reports: p.leak.reports, docs: p.docs.map(d => d.type), drive: __v427Calls.drive, downloads: __v427Calls.downloads, notes: state.notes.map(n => n.text) }; }, LEAK);
    assert.equal(after.reports.length, 1); assert.match(after.reports[0].no, /^LR-\d{8}-01$/); assert.deepEqual(after.docs, ['payrcpt', 'evidence']); assert.deepEqual(after.drive, [r.fileName]); assert.deepEqual(after.downloads, []);
    assert(after.notes.some(t => t.startsWith('[누수 보고서]'))); assert(after.notes.some(t => /\[문서\] 증빙 묶음 .* Drive/.test(t)));
  });

  await test('month bundle: two project folders and a summary sheet, last month excluded', async () => {
    await seed(); const before = await snapshot();
    const names = await page.evaluate(() => hjEvidenceMonthProjects(localDate().slice(0, 7)));
    assert.deepEqual(names, [INTERIOR, LEAK].sort());
    const r = await page.evaluate(() => hjEvidenceMonthBundle(localDate().slice(0, 7)));
    assert.equal(r.projects, 2); assert.match(r.fileName, /^만물_증빙_\d{4}-\d{2}_전체\.zip$/);
    const zip = await lastZip(); const keys = Object.keys(zip), ym = r.fileName.match(/\d{4}-\d{2}/)[0];
    assert(keys.every(k => k.startsWith('증빙_' + ym + '/'))); assert(keys.some(k => k.startsWith('증빙_' + ym + '/' + LEAK + '/02_사진/'))); assert(keys.some(k => k.startsWith('증빙_' + ym + '/' + INTERIOR + '/01_견적/')));
    assert(!keys.some(k => k.includes(OLD)), 'last month project is excluded');
    const summary = JSON.parse(zip['증빙_' + ym + '/00_요약_' + ym + '.xlsx']);
    assert.equal(summary[0].name, ym + ' 요약'); assert.deepEqual(summary[0].rows[0], ['현장', '유형', '준공일', '견적(매출)', '이 달 수금', '세금계산서/현금영수증 발행', '간이영수증', '증빙 묶음 기록']);
    const leakRow = summary[0].rows.find(x => x[0] === LEAK); assert.equal(leakRow[1], '누수'); assert.equal(leakRow[4], 150000); assert.equal(leakRow[5], 1); assert.equal(leakRow[6], 1);
    assert(!summary[0].rows[0].some(h => /미수/.test(h)), 'summary keeps the 2026-08-13 rule: no receivable column');
    sameSnapshot(await snapshot(), before, 'month bundle writes no record');
    await page.evaluate(() => hjEvidenceMonthView(localDate().slice(0, 7))); await page.locator('#hjEvidenceMonth').waitFor();
    assert.match(await page.locator('#hjEvidenceMonth').innerText(), /현장 2곳/); await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('02-month-bundle');
    await close(); await page.evaluate(() => monthCloseView(1)); await footer('이번 달 증빙 전부').waitFor(); await footer('이번 달 증빙 전부').click(); await page.locator('#hjEvidenceMonth').waitFor();
  });

  await test('document center entry, menu contract, sizes, no errors and no external writes', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(name => docHubView(name), LEAK); await page.locator('#modalRoot .docHubBtn[data-act="evidence"]').waitFor();
    assert.equal(await page.locator('#modalRoot .docHubBtn[data-act="todo:bundle"]').count(), 0, 'bundle is no longer a planned row');
    await page.locator('#modalRoot .docHubBtn[data-act="evidence"]').click(); await page.locator('#hjEvidenceForm').waitFor();
    sameSnapshot(await snapshot(), before);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v427Calls.external), []);
  });
  console.log(`evidence-v427: ${passed}/${passed} PASS; synthetic data; downloads/drive stubbed; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL evidence-v427', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

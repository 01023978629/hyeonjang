/* v433 문서 센터 — 합성 레코드만 쓴다. HJ_V433_BASELINE=<commit> 은 DOC433_API_PRESENT 에서 실패해야 하고,
   HJ_V433_MUTATION=amount-default 는 WORKCERT_AMOUNT_HIDDEN_DEFAULT, =unmask-default 는 DOC433_NAME_MASKED_DEFAULT 에서 실패해야 한다.
   실제 인쇄·공유·문자·외부 쓰기는 0 — 인쇄/이미지/공유 함수는 호출만 기록한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_LEAK_DOC_PROJECT', INTERIOR = 'TEST_INTERIOR_DOC_PROJECT', BARE = 'TEST_BARE_LEAK_PROJECT';
const PRIVATE = ['TEST_PRIVATE_CUSTOMER', '010-0000-0000', 'TEST_PRIVATE_ADDRESS 101동 202호'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const LEGACY_ACTS = ['aptreport', 'warranty', 'wdoc', 'payrcpt', 'settle', 'zip', 'pdf', 'portfolio'];
const LEGACY_FNS = { aptreport: 'aptReportView', warranty: 'warrantyView', wdoc: 'warrantyIssueSend', payrcpt: 'payRcptDialog', settle: 'settleDocs', zip: 'exportProjectZIP', pdf: 'exportProjectPDF', portfolio: 'exportPortfolio' };
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V433_BASELINE && execFileSync('git', ['show', process.env.HJ_V433_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v433Calls = { print: [], png: [], word: [], html: [], sms: [], legacy: [], external: [] };
    window.open = (...args) => { __v433Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v433Calls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjWorkCertModel', 'hjWorkCertHtml', 'hjWorkCertView', 'hjLeakNarrModel', 'hjLeakNarrHtml', 'hjLeakNarrView', 'hjDoc433Issue', 'hjDocNextNo', 'hjPayRcptOffer', 'hjDocHtmlToPng', 'hjDoc433SimpleReceipts'].every(k => typeof window[k] === 'function')), true, 'DOC433_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false;
    taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V433_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __v433Calls.sms.push({ phone, text }); };
    hjDocPrint = html => { __v433Calls.print.push(String(html)); return true; };
    hjDocHtmlToPng = async (html, base) => { __v433Calls.png.push({ html: String(html), base }); return true; };
    hjDocDownload = (text, fname) => { __v433Calls.word.push(fname); };
    hjWarrantyShareHtml = async (name, html, fname) => { __v433Calls.html.push(fname); return true; };
  });
  if (process.env.HJ_V433_MUTATION) {
    assert(['amount-default', 'unmask-default'].includes(process.env.HJ_V433_MUTATION), 'unknown mutation');
    await page.evaluate(kind => {
      if (kind === 'amount-default') { const real = hjWorkCertModel; hjWorkCertModel = (p, input) => real(p, { ...(input || {}), showAmount: input && input.showAmount === false ? false : true }); }
      if (kind === 'unmask-default') { hjDoc433Name = p => String(p && p.customer && p.customer.name || '의뢰인'); }
    }, process.env.HJ_V433_MUTATION);
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS doccenter-v433 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, interior, bare, privateFields, png }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      const day = localDate(), at = day + 'T03:00:00.000Z';
      const project = (name, kind) => ({ name, kind, stage: 2, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak');
      p.customer = { name: privateFields[0], phone: privateFields[1], addr: privateFields[2] }; p.received = 90000;
      p.leak = { intake: { where: ['욕실', '천장'], since: '2~3일', amount: '똑똑 떨어짐', neighbor: '아랫집에서 연락 옴', office: '했음', insurance: '일상배상책임 있음', memo: 'TEST_INTAKE_MEMO', at },
        detect: { methods: ['청음', '압력(온수)'], cause: '온수관', zone: '전유부', place: 'TEST_DETECT_PLACE', pressure: { from: 7, to: 0, unit: 'bar' }, humidity: 0, note: 'TEST_DETECT_NOTE', revisit: false, at } };
      const q = project(interior, 'interior'); q.doneAt = day; q.stage = 3; q.customer = { name: 'TEST_INTERIOR_CUSTOMER', phone: '010-0000-0002', addr: 'TEST_INTERIOR_ADDRESS' };
      const b = project(bare, 'leak');
      state.projects = [p, q, b];
      state.quotes = [{ id: 'TEST_DOC_LEAK_QUOTE', project: leak, title: 'TEST_LEAK_QUOTE', date: day, leak: { from: 'template', cause: '온수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 100000 }], vatIncluded: true,
        paid: { method: '계좌이체', amount: 90000, at: day, receipt: { type: '세금계산서', issued: false }, payLogId: 'TEST_DOC_PAY_1' } }];
      state.quotes.forEach(x => syncQuoteToProject(x));
      state.payLog = [{ id: 'TEST_DOC_PAY_1', d: day, project: leak, amt: 90000, method: '계좌이체', quoteId: 'TEST_DOC_LEAK_QUOTE', source: 'leak-quote' }];
      state.schedule = [{ id: 'TEST_DOC_DISPATCH', project: leak, title: '누수 출동', date: day, time: '10:00', endTime: '11:00', urgent: true, report: { progress: '완료', text: 'TEST_DISPATCH_REPORTED' } }];
      const photo = (id, project, when, extra) => ({ id, kind: 'photo', project, name: id + '.jpg', ext: 'jpg', when, thumb: png, ...extra });
      state.files.push(photo('TEST_PH_CAUSE', leak, day + 'T01:00:00.000Z', { _leaktag: 'cause' }), photo('TEST_PH_BEFORE', leak, day + 'T01:10:00.000Z', { _leaktag: 'before' }), photo('TEST_PH_AFTER', leak, day + 'T02:00:00.000Z', { _leaktag: 'after' }),
        photo('TEST_PH_INT_BEFORE', interior, day + 'T01:00:00.000Z', { _phase: '철거' }), photo('TEST_PH_INT_AFTER', interior, day + 'T02:00:00.000Z', { _phase: '완료' }));
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v433Calls)) __v433Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V433_SEED_SAVE_FAILED');
    }, { leak: LEAK, interior: INTERIOR, bare: BARE, privateFields: PRIVATE, png: PNG });
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
    if (!process.env.HJ_V433_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V433_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V433_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const previewHtml = () => page.locator('#modalRoot iframe').getAttribute('srcdoc');
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  await test('document center groups, status lines and eight legacy entry points', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(name => docHubView(name), LEAK);
    await page.locator('#modalRoot .docHubBtn').first().waitFor();
    const groups = await page.locator('#modalRoot .docHubGroup').allInnerTexts();
    assert.deepEqual(groups, ['영업·계약', '시공 중', '준공·돈', 'AS·보증', '누수·보험', '아파트·행정', '보관']);
    const acts = await page.locator('#modalRoot .docHubBtn').evaluateAll(nodes => nodes.map(n => n.dataset.act));
    for (const act of [...LEGACY_ACTS, 'workcert', 'leaknarr', 'leakreport', 'statement', 'invoice', 'quote', 'contract', 'worklog', 'progress', 'order', 'aslog']) assert(acts.includes(act), 'entry ' + act);
    assert(acts.filter(a => a.startsWith('todo:')).length >= 5, 'planned rows are listed as 예정'); // v442 피해 확인서가 실제 항목이 되어 예정 줄이 하나 줄었다
    const status = await page.locator('#modalRoot .docHubStatus').allInnerTexts();
    assert(status.some(t => /사진 3장 · 주소 있음 · 번호 자동/.test(t)), 'workcert status line: ' + JSON.stringify(status));
    assert(status.some(t => /입금 기록 1건/.test(t)), 'receipt status line');
    assert(status.some(t => /접수 ✓ · 탐지 ✓/.test(t)), 'leak status line');
    await tapOk('#modalRoot .docHubBtn'); await noOverflow(); await shot('01-doc-center');
    await page.locator('#modalRoot .docHubBtn[data-act="todo:compare"]').click();
    assert.equal(await page.locator('#modalRoot .docHubBtn').count() > 0, true, 'planned row keeps the center open');
    sameSnapshot(await snapshot(), before);
    await page.evaluate(fns => { window.__v433Real = {}; for (const [act, fn] of Object.entries(fns)) { __v433Real[fn] = window[fn]; window[fn] = (...args) => { __v433Calls.legacy.push([act, args[0]]); }; } }, LEGACY_FNS);
    for (const act of LEGACY_ACTS) {
      await close(); await page.evaluate(name => docHubView(name), LEAK);
      await page.locator('#modalRoot .docHubBtn[data-act="' + act + '"]').click();
      await page.waitForFunction(act => __v433Calls.legacy.some(([a]) => a === act), act);
    }
    const legacy = await page.evaluate(() => { for (const [fn, real] of Object.entries(__v433Real)) window[fn] = real; delete window.__v433Real; return __v433Calls.legacy; });
    assert.deepEqual(legacy.map(([a]) => a), LEGACY_ACTS); assert(legacy.every(([, name]) => name === LEAK), 'legacy entry points receive the project name');
    await close(); await page.evaluate(name => docHubView(name), INTERIOR);
    const interiorStatus = await page.locator('#modalRoot .docHubStatus').allInnerTexts();
    assert(interiorStatus.some(t => /누수 현장 아님/.test(t)), 'interior project marks leak documents');
    assert(interiorStatus.some(t => /준공일 /.test(t)), 'interior project shows completion date');
    sameSnapshot(await snapshot(), before);
  });

  await test('work certificate auto-fill, hidden amount, masked name, signature, issue log', async () => {
    await seed(); const before = await snapshot();
    const m = await page.evaluate(name => { const p = state.projects.find(x => x.name === name); const m = hjWorkCertModel(p, {}); const m2 = hjWorkCertModel(p, { showAmount: true, fullName: true }); return { m, m2, html: hjWorkCertHtml(m), html2: hjWorkCertHtml(m2) }; }, LEAK);
    assert.match(m.m.no, /^WC-\d{8}-01$/); assert.match(m.m.visit, /\d{4}-\d{2}-\d{2} 10:00/);
    assert.deepEqual(m.m.works, ['배관 교체 1']); assert.deepEqual(m.m.materials, ['배관 교체 1']);
    assert.equal(m.m.amount, null, 'WORKCERT_AMOUNT_HIDDEN_DEFAULT'); assert.equal(m.m.showAmount, false);
    assert.equal(m.m.customer, 'T○○', 'DOC433_NAME_MASKED_DEFAULT'); assert.equal(m.m.warranty, '수리 부위 1년 책임 보수');
    assert.deepEqual(m.m.photos.map(f => f.id), ['TEST_PH_BEFORE', 'TEST_PH_AFTER']); assert.equal(m.m.address, PRIVATE[2]);
    assert(!m.html.includes(PRIVATE[0]), 'full customer name must not appear by default'); assert(!/data-doc433-amount/.test(m.html), 'amount row hidden by default');
    assert.match(m.html, /data-doc433-taxnote/); assert.match(m.html, /세금계산서·현금영수증은 홈택스에서 따로 발행합니다/); assert.match(m.html, /고객 확인/); assert.match(m.html, /작업자 \(/);
    assert.equal(m.m2.amount.total, 110000); assert.match(m.html2, /data-doc433-amount/); assert(m.html2.includes(PRIVATE[0]), 'opt-in full name');
    const interior = await page.evaluate(name => { const p = state.projects.find(x => x.name === name); const m = hjWorkCertModel(p, {}); return { photos: m.photos.map(f => f.label), visit: m.visit, warranty: m.warranty }; }, INTERIOR);
    assert.deepEqual(interior.photos, ['시공 전', '완료']); assert.match(interior.visit, /\d{4}-\d{2}-\d{2}/);
    sameSnapshot(await snapshot(), before, 'model and html are read only');
    await page.evaluate(name => hjWorkCertView(name), LEAK); await page.locator('#hjWorkCertForm').waitFor();
    assert.equal(await page.locator('#wcAmount').isChecked(), false); assert.equal(await page.locator('#wcFullName').isChecked(), false);
    assert.match(await page.locator('#wcWorks').inputValue(), /배관 교체/); await tapOk('#modalRoot .mfoot button'); await shot('02-workcert-form');
    await footer('확인서 만들기').click(); await page.locator('#hjDocSign').waitFor();
    for (const id of ['#hjDocPdf', '#hjDocWord', '#hjDocHtml', '#hjDocImage', '#hjDocSms', '#hjDocSign']) assert.equal(await page.locator(id).count(), 1, id);
    await tapOk('#hjDocPdf, #hjDocImage, #hjDocSms, #hjDocSign'); await noOverflow();
    assert(!(await previewHtml()).includes(PRIVATE[0]), 'preview masks the customer name');
    sameSnapshot(await snapshot(), before, 'preview does not issue');
    await page.locator('#hjDocSign').click(); await page.locator('#wsPad').waitFor();
    await page.locator('#wsName').fill('TEST_SIGNER'); await page.locator('#wsOrg').fill('202호');
    const pad = await page.locator('#wsPad').boundingBox();
    await page.mouse.move(pad.x + 20, pad.y + 40); await page.mouse.down(); await page.mouse.move(pad.x + 120, pad.y + 70, { steps: 6 }); await page.mouse.move(pad.x + 200, pad.y + 40, { steps: 6 }); await page.mouse.up();
    await footer('서명 저장').click(); await page.locator('#hjDocPdf').waitFor();
    assert.match(await page.locator('#modalRoot #modalTitle').innerText(), /서명/); const signed = await previewHtml();
    assert.match(signed, /고객 서명/); assert.match(signed, /TEST_SIGNER/); assert.match(signed, /data:image\/png;base64,/);
    assert.equal(await page.locator('#hjDocSign').count(), 0, 'signed document does not ask to sign again');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).length === 1, LEAK);
    const issued = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); const stored = await idbGetStrict('appState'); return { docs: p.docs, notes: state.notes.filter(n => n.text.startsWith('[문서]')), storedDocs: stored.projects.find(x => x.name === name).docs, prints: __v433Calls.print.length, sigs: p.warrantySigs.length, keys: Object.keys(serializeData()).sort() }; }, LEAK);
    assert.equal(issued.prints, 1); assert.equal(issued.docs[0].type, 'workcert'); assert.match(issued.docs[0].no, /^WC-\d{8}-01$/); assert.equal(issued.docs[0].purpose, 'pdf');
    assert(Number.isFinite(Date.parse(issued.docs[0].at))); assert.equal(issued.notes.length, 1); assert.match(issued.notes[0].text, /^\[문서\] 수리·작업 확인서 발행 · WC-/);
    assert.deepEqual(issued.storedDocs, issued.docs); assert.equal(issued.sigs, 1); assert.deepEqual(issued.keys, before.keys, 'no new top-level serialized keys');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(() => __v433Calls.print.length === 2);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(name => state.projects.find(x => x.name === name).docs.length, LEAK), 1, 'same number is logged once');
    assert.equal(await page.evaluate(() => hjDocNextNo('WC')).then(no => /-02$/.test(no)), true, 'next number advances after issue');
    await shot('03-workcert-signed');
  });

  await test('receipt offer after payment save, auto serial, image output, dashboard split', async () => {
    await seed();
    await page.evaluate(id => hjLeakPaymentView(state.quotes.find(q => q.id === id), () => { window.__v433Back = (window.__v433Back || 0) + 1; }), 'TEST_DOC_LEAK_QUOTE');
    await page.locator('#hjLeakPayAmount').waitFor(); await page.locator('#hjLeakPayAmount').fill('90000'); await page.locator('#hjLeakPayMethod').selectOption('현금');
    await footer('저장').click(); await page.locator('#modalRoot h3', { hasText: '받은 돈을 저장했어요' }).waitFor();
    assert.equal(await page.evaluate(() => window.__v433Back || 0), 0, 'offer shows before returning');
    await tapOk('#modalRoot .mfoot button'); await shot('04-receipt-offer');
    await footer('영수증 만들기').click(); await page.locator('#prcNo').waitFor();
    assert.match(await page.locator('#prcNo').inputValue(), /^MM-\d{8}-01$/); assert.equal((await page.locator('#prcAmt').inputValue()).replace(/\D/g, ''), '90000');
    assert.equal(await page.locator('#prcDate').inputValue(), await page.evaluate(() => localDate())); assert.equal(await page.locator('#prcMethod').inputValue(), '현금');
    assert.equal(await page.locator('.prcRow[aria-pressed="true"]').count(), 1, 'the saved payment row is preselected');
    const before = await snapshot();
    await footer('영수증 만들기').click(); await page.locator('#hjDocImage').waitFor();
    assert.match(await previewHtml(), /간 이 영 수 증/); assert.match(await previewHtml(), /MM-\d{8}-01/);
    sameSnapshot(await snapshot(), before, 'receipt preview is read only');
    await page.locator('#hjDocImage').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).some(d => d.type === 'payrcpt'), LEAK);
    const r = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); return { png: __v433Calls.png.map(x => x.base), docs: p.docs, html: hjLeakReceiptPendingHtml(), simple: hjDoc433SimpleReceipts(), pending: hjLeakReceiptPending(), quotePaid: state.quotes[0].paid.receipt }; }, LEAK);
    assert.equal(r.png.length, 1); assert.match(r.png[0], /간이영수증/); assert.equal(r.docs.length, 1); assert.equal(r.docs[0].type, 'payrcpt'); assert.match(r.docs[0].no, /^MM-\d{8}-01$/);
    assert.equal(r.simple, 1); assert.equal(r.pending, 1, 'tax receipt still pending'); assert.deepEqual(r.quotePaid, { type: '세금계산서', issued: false }, 'simple receipt does not count as 세금계산서/현금영수증');
    assert.match(r.html, /영수증 미발행 1건/); assert.match(r.html, /data-doc433-simple/); assert.match(r.html, /간이영수증 발행 1건/);
    await page.locator('#hjDocSms').click(); await page.locator('#mcBody').waitFor();
    assert.match(await page.locator('#mcBody').inputValue(), /홈택스 발행 기준/); assert.equal(await page.evaluate(() => __v433Calls.sms.length), 0, 'draft only');
    await close(); await page.evaluate(id => hjLeakPaymentView(state.quotes.find(q => q.id === id), () => { window.__v433Back = (window.__v433Back || 0) + 1; }), 'TEST_DOC_LEAK_QUOTE');
    await page.locator('#hjLeakPayAmount').waitFor(); await footer('저장').click(); await page.locator('#modalRoot h3', { hasText: '받은 돈을 저장했어요' }).waitFor();
    await footer('나중에').click(); await page.waitForFunction(() => window.__v433Back === 1);
    assert.equal(await page.evaluate(() => state.payLog.length), 1, 'repeat save keeps a single pay log');
  });

  await test('leak narrative: three record states, disclaimer, purposes, issue and report pairing', async () => {
    await seed(); const before = await snapshot();
    const r = await page.evaluate(({ leak, bare }) => {
      const p = state.projects.find(x => x.name === leak), b = state.projects.find(x => x.name === bare);
      const full = hjLeakNarrModel(p, {}), noDetect = hjLeakNarrModel({ ...p, leak: { intake: p.leak.intake } }, {}), empty = hjLeakNarrModel(b, {});
      const office = hjLeakNarrModel(p, { purpose: 'office', fullName: true }), ins = hjLeakNarrModel(p, { purpose: 'insurance', fullName: true, scopes: ['아랫집', 'TEST_BAD_SCOPE'], damage: 'TEST_DAMAGE' });
      return { full, fullHtml: hjLeakNarrHtml(full), noDetectHtml: hjLeakNarrHtml(noDetect), emptyHtml: hjLeakNarrHtml(empty), office, ins, insHtml: hjLeakNarrHtml(ins), purposes: Object.keys(HJ_LEAKNARR_PURPOSES), interior: hjLeakNarrModel(state.projects.find(x => x.name !== leak && x.name !== bare), {}) };
    }, { leak: LEAK, bare: BARE });
    assert.deepEqual(r.purposes, ['insurance', 'office', 'self']); assert.equal(r.interior, null, 'interior project has no narrative');
    assert.match(r.full.no, /^LN-\d{8}-01$/); assert.equal(r.full.hasIntake, true); assert.equal(r.full.detect.cause, '온수관'); assert.equal(r.full.hasAction, true); assert.equal(r.full.customer, 'T○○', 'DOC433_NAME_MASKED_DEFAULT');
    assert.deepEqual(r.full.photos.map(f => f.id), ['TEST_PH_CAUSE', 'TEST_PH_BEFORE', 'TEST_PH_AFTER']);
    assert.match(r.fullHtml, /data-doc433-disclaimer/); assert.match(r.fullHtml, /사실 관계 정리용 — 보험 심사·책임 판단을 대신하지 않습니다/); assert.match(r.fullHtml, /발생 추정 2~3일/); assert.match(r.fullHtml, /원인 온수관/); assert.match(r.fullHtml, /배관 교체 1/);
    assert(!r.fullHtml.includes(PRIVATE[0]), 'narrative masks name by default'); assert(!/\d[\d,]*\s*원/.test(r.fullHtml.replace(/<style>[\s\S]*?<\/style>/, '')), 'narrative carries no money');
    assert.match(r.noDetectHtml, /탐지 기록 없음/); assert.match(r.emptyHtml, /접수 기록 없음/); assert.match(r.emptyHtml, /탐지 기록 없음/); assert.match(r.emptyHtml, /조치 기록 없음/); assert.match(r.emptyHtml, /피해 범위 미기재/);
    assert.equal(r.office.fullName, false, 'full name only for insurance'); assert.equal(r.office.purposeLabel, '관리사무소 제출용');
    assert.deepEqual(r.ins.scopes, ['아랫집']); assert.match(r.insHtml, /☑ 아랫집/); assert.match(r.insHtml, /TEST_DAMAGE/); assert(r.insHtml.includes(PRIVATE[0]), 'insurance opt-in full name');
    sameSnapshot(await snapshot(), before, 'narrative model is read only');
    await page.evaluate(name => hjLeakNarrView(name), LEAK); await page.locator('#hjLeakNarrForm').waitFor();
    assert.equal(await page.locator('[data-leaknarr-purpose]').count(), 3); assert.equal(await page.locator('[data-leaknarr-scope]').count(), 3); assert.equal(await page.locator('#hjLeakNarrFullName').isChecked(), false);
    await tapOk('[data-leaknarr-purpose]'); await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('05-leaknarr-form');
    await page.locator('[data-leaknarr-purpose="office"]').click(); assert.equal(await page.locator('#hjLeakNarrFullName').isDisabled(), true);
    await page.locator('[data-leaknarr-purpose="insurance"]').click(); await page.locator('[data-leaknarr-scope="아랫집"]').check(); await page.locator('#hjLeakNarrDamage').fill('TEST_UI_DAMAGE');
    await footer('보험 제출 2종').click(); await page.locator('#hjDocNextLeakReport').waitFor();
    assert.match(await previewHtml(), /TEST_UI_DAMAGE/); assert.match(await previewHtml(), /☑ 아랫집/); await tapOk('#hjDocNextLeakReport, #hjDocImage, #hjDocSms');
    sameSnapshot(await snapshot(), before, 'narrative preview does not issue');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).some(d => d.type === 'leaknarr'), LEAK);
    const issued = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); return { docs: p.docs, note: state.notes.find(n => n.text.startsWith('[문서] 누수 사고 경위서')), stored: (await idbGetStrict('appState')).projects.find(x => x.name === name).docs }; }, LEAK);
    assert.equal(issued.docs.length, 1); assert.equal(issued.docs[0].purpose, '보험사 제출용'); assert.match(issued.docs[0].no, /^LN-\d{8}-01$/); assert(issued.note); assert.deepEqual(issued.stored, issued.docs);
    await page.locator('#hjDocNextLeakReport').click(); await page.locator('#hjLeakReportForm').waitFor();
    assert.match(await page.locator('#modalRoot #modalTitle').innerText(), /누수 보고서/); await shot('06-leaknarr-to-report');
  });

  await test('menu contract, sizes, no errors and no external writes', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(name => docHubView(name), BARE); await page.locator('#modalRoot .docHubBtn').first().waitFor();
    const bareStatus = await page.locator('#modalRoot .docHubStatus').allInnerTexts();
    assert(bareStatus.some(t => /사진 0장 · 주소 없음/.test(t)), 'empty data is named, not hidden');
    await page.locator('#modalRoot .docHubBtn[data-act="workcert"]').click(); await page.locator('#hjWorkCertForm').waitFor();
    assert.equal(await page.locator('#wcAmount').isDisabled(), true, 'no quote → amount toggle disabled');
    await footer('확인서 만들기').click(); await page.locator('#hjDocPdf').waitFor();
    assert.match(await previewHtml(), /사진 없음/); sameSnapshot(await snapshot(), before);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v433Calls.external), []); assert.equal(await page.evaluate(() => __v433Calls.sms.length), 0);
  });
  console.log(`doccenter-v433: ${passed}/${passed} PASS; synthetic data; real prints/sends=0; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL doccenter-v433', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

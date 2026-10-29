/* v442 누수 보험 청구 도우미 — 피해 확인서(아랫집) · 보험 서류 체크리스트 · 제출 이력. 합성 레코드만, 외부 쓰기 0.
   HJ_V442_BASELINE=<commit> 은 INS_API_PRESENT 에서, HJ_V442_MUTATION=amount-unmask(안내문 금액 지우기 해제) 는 INS_GUIDE_NO_AMOUNT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_INS_LEAK', LEAK2 = 'TEST_INS_LEAK2', INT = 'TEST_INS_INTERIOR', CUST = '테스트고객', PHONE = '010-1234-5678', ADDR = '대전 중구 대흥동 101동 1203호';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const AMOUNT_RE = /\d[\d,]*\s*(?:만\s*)?원/;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V442_BASELINE && execFileSync('git', ['show', process.env.HJ_V442_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v442Calls = { external: [], print: [], download: [], compose: [], contract: [], make: [] };
    window.open = (...args) => { __v442Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v442Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjInsClaimView', 'hjInsDamageView', 'hjInsDamageModel', 'hjInsDamageHtml', 'hjInsProgress', 'hjInsGuideText', 'hjInsGuideHtml', 'hjInsNoAmount', 'hjInsTplOf', 'hjInsTplDiff', 'hjInsSubmitView', 'hjInsDue', 'hjInsDashHtml', 'hjInsAttach', 'hjInsSigCapture', 'hjInsDamageLinkSend', 'hjInsDamageLinkPull'].every(k => typeof window[k] === 'function') && Array.isArray(HJ_INS_CHECKLIST) && HJ_INS_CHECKLIST.length === 12), true, 'INS_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V442_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjDocPrint = html => { __v442Calls.print.push(String(html)); return true; };
    hjDocDownload = (text, fname) => { __v442Calls.download.push({ fname }); };
    hjWarrantyShareHtml = async (name, html, fname) => { __v442Calls.download.push({ fname }); return true; };
    hjDocHtmlToPng = async (html, base) => { __v442Calls.download.push({ fname: base + '.png' }); return true; };
    msgCenterCompose = (kind, preset) => { __v442Calls.compose.push({ kind, text: preset && preset.text, project: preset && preset.project }); closeModal(true); };
    contractCall = async (action, payload) => {
      __v442Calls.contract.push({ action, payload: JSON.parse(JSON.stringify(payload)) });
      if (action === 'quickSend') return { ok: true, contractId: 'ct_dm1', contractNo: 'MM-2026-0901', signUrl: 'https://example.invalid/s/dm1' };
      if (action === 'contract.signature') return { ok: true, signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', signerName: '링크서명자', signedAt: new Date().toISOString() };
      throw Object.assign(new Error('unexpected'), { __code: 'BAD_REQUEST' });
    };
  });
  if (process.env.HJ_V442_MUTATION) {
    assert.equal(process.env.HJ_V442_MUTATION, 'amount-unmask');
    await page.evaluate(() => { hjInsNoAmount = t => String(t == null ? '' : t); });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS insurance-v442 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, leak2, int, cust, phone, addr, png }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const day = localDate(), at = day + 'T01:00:00.000Z';
      const project = (name, kind, a) => ({ name, kind, stage: 2, phases: [], customer: { name: cust, phone, addr: a }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak', addr); p.leak = { intake: { where: ['욕실'], neighbor: '아랫집에서 연락 옴', insurance: '일상배상책임 있음', at }, detect: { methods: ['청음', '가스'], cause: '급수관', place: '욕실 바닥', zone: '전유부', at } };
      const p2 = project(leak2, 'leak', '대전 서구 둔산동 7동 302호'); p2.leak = { intake: { where: ['천장'], at } };
      state.projects = [p, p2, project(int, 'interior', '대전 동구')];
      state.quotes = [{ id: 'TEST_INS_Q1', project: leak, title: 'TEST_INS_QUOTE', date: day, leak: { from: 'template', cause: '급수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 300000 }], vatIncluded: true }];
      state.quotes.forEach(x => syncQuoteToProject(x));
      const photo = (id, when, extra) => ({ id, kind: 'photo', project: leak, name: id + '.jpg', ext: 'jpg', size: 100 + id.length, when, thumb: png, ...extra });
      state.files.push(photo('TEST_PH_B1', day + 'T01:00:00.000Z', { _leaktag: 'before' }), photo('TEST_PH_B2', day + 'T01:05:00.000Z', { _leaktag: 'before' }), photo('TEST_PH_아랫집천장', day + 'T01:10:00.000Z', {}),
        photo('TEST_PH_X1', day + 'T01:20:00.000Z', {}), photo('TEST_PH_X2', day + 'T01:25:00.000Z', {}), photo('TEST_PH_X3', day + 'T01:30:00.000Z', {}), photo('TEST_PH_X4', day + 'T01:35:00.000Z', {}), photo('TEST_PH_AFTER', day + 'T03:00:00.000Z', { _leaktag: 'after' }));
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v442Calls)) __v442Calls[k] = [];
      __contract.selfTestOk = true; __contract.url = 'https://example.invalid/exec'; __contract.token = 'TEST_TOKEN';
      try { localStorage.removeItem('hj_ins_tpl'); } catch (_) {}
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V442_SEED_SAVE_FAILED');
    }, { leak: LEAK, leak2: LEAK2, int: INT, cust: CUST, phone: PHONE, addr: ADDR, png: PNG });
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
    if (!process.env.HJ_V442_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V442_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V442_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const previewHtml = () => page.locator('#modalRoot iframe').evaluate(n => n.getAttribute('srcdoc'));
  const claim = name => page.evaluate(name => JSON.parse(JSON.stringify((state.projects.find(x => x.name === name).leak || {}).claim || null)), name);
  const draw = async () => {
    const pad = await page.locator('#isgPad').boundingBox();
    await page.mouse.move(pad.x + 20, pad.y + 40); await page.mouse.down(); await page.mouse.move(pad.x + 120, pad.y + 70, { steps: 6 }); await page.mouse.move(pad.x + 200, pad.y + 40, { steps: 6 }); await page.mouse.up();
  };

  await test('① 피해 확인서 — 동·호수 자동, 이름 빈칸, 사진 6장까지, 탐지 요약, 현장·링크 서명, p.docs 발행 기록', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(name => hjInsDamageView(name), LEAK); await page.locator('#hjInsDamage').waitFor();
    assert.equal(await page.locator('#dmVictim').inputValue(), '101동 1103호'); assert.equal(await page.locator('#dmCause').inputValue(), '101동 1203호');
    assert.match(await page.locator('[data-dm-detect]').innerText(), /탐지 청음·가스 · 원인 급수관 \(욕실 바닥\) · 구분 전유부/);
    assert.equal(await page.locator('[data-dm-photo][aria-pressed="true"]').count(), 3, 'before-tagged and 아랫집 photos are preselected'); assert.match(await page.locator('#dmPhotoCount').innerText(), /^3\/6$/);
    await tapOk('#modalRoot .mfoot button, [data-dm-photo], [data-dm-sign], #dmLink, #hjInsDamage label:has([data-dm-part])'); await noOverflow(); await shot('01-damage');
    const blank = await page.evaluate(name => { const p = state.projects.find(x => x.name === name); return hjInsDamageHtml(hjInsDamageModel(p, hjInsDamageDraft(p))); }, LEAK);
    assert.match(blank, /성명 : <span style="display:inline-block;min-width:100px;border-bottom/, 'victim name is a handwriting blank'); assert(!blank.includes(CUST) && !blank.includes(LEAK), 'no customer or project name');
    sameSnapshot(await snapshot(), before, 'opening the form and previewing does not save');
    for (const id of ['TEST_PH_X1', 'TEST_PH_X2', 'TEST_PH_X3']) { await page.locator('[data-dm-photo*="' + id + '"]').click(); await page.locator('#hjInsDamage').waitFor(); }
    assert.match(await page.locator('#dmPhotoCount').innerText(), /^6\/6$/); await page.locator('[data-dm-photo*="TEST_PH_X4"]').click(); await page.waitForTimeout(100);
    assert.equal(await page.locator('[data-dm-photo][aria-pressed="true"]').count(), 6, 'seventh photo is refused');
    await page.locator('[data-dm-part="천장"]').check(); await page.locator('[data-dm-part="벽"]').check(); await page.locator('#dmPartsMemo').fill('욕실 천장 석고보드 얼룩');
    await page.locator('[data-dm-sign="victim"]').click(); await page.locator('#isgPad').waitFor(); await tapOk('#modalRoot .mfoot button, #isgClear'); await noOverflow();
    await footer('서명 저장').click(); await page.waitForTimeout(100); assert.equal(await page.locator('#isgPad').count(), 1, 'name and drawing are required');
    await page.locator('#isgName').fill('현장서명자'); await draw(); await footer('서명 저장').click(); await page.locator('#hjInsDamage').waitFor();
    assert.match(await page.locator('[data-dm-sig="victim"]').innerText(), /현장서명자 \(현장\)/); assert.equal(await page.locator('[data-dm-part="천장"]').isChecked(), true, 'form keeps its input across the pad');
    await page.locator('#dmLink').click(); await page.locator('#hjInsLink').waitFor(); assert.equal(await page.locator('#dlOrg').inputValue(), '101동 1103호');
    await page.locator('#dlName').fill('링크서명자'); await page.locator('#dlPhone').fill('010-9999-8888'); await footer('링크 만들기').click(); await page.locator('#hjInsLinkShow').waitFor();
    assert.equal(await page.locator('#dlLink').inputValue(), 'https://example.invalid/s/dm1');
    const sent = await page.evaluate(() => __v442Calls.contract[0]);
    assert.equal(sent.action, 'quickSend'); assert.equal(sent.payload.docKind, 'leak-damage'); assert.equal(sent.payload.body.site, '101동 1103호'); assert.equal(sent.payload.body.cause, '101동 1203호');
    const sentText = JSON.stringify(sent.payload.body); assert(!AMOUNT_RE.test(sentText), 'link body has no amount: ' + sentText); assert(!sentText.includes(CUST) && !sentText.includes('12345678'), 'link body has no customer data');
    const stored1 = JSON.stringify(await claim(LEAK)); assert(!stored1.includes('99998888') && !stored1.includes('9999-8888'), 'victim phone is not stored in the app');
    await footer('서명 확인').click(); await page.locator('#hjInsDamage').waitFor();
    assert.match(await page.locator('[data-dm-sig="victim"]').innerText(), /링크서명자 \(링크\)/); assert.equal(await page.evaluate(() => __v442Calls.contract[1].action), 'contract.signature');
    await page.locator('[data-dm-sign="cause"]').click(); await page.locator('#isgPad').waitFor(); await page.locator('#isgName').fill('원인세대'); await draw(); await footer('서명 저장').click(); await page.locator('#hjInsDamage').waitFor();
    const dmg = (await claim(LEAK)).damage;
    assert.deepEqual([dmg.victimUnit, dmg.causeUnit, dmg.parts, dmg.photoRefs.length, dmg.sigs.map(x => [x.role, x.name, x.via]).sort()], ['101동 1103호', '101동 1203호', ['천장', '벽'], 6, [['cause', '원인세대', 'pad'], ['victim', '링크서명자', 'link']]]);
    assert.equal(await page.evaluate(name => (state.projects.find(x => x.name === name).warrantySigs || []).length, LEAK), 0, 'warranty signatures are not touched');
    await footer('확인서 만들기').click(); await page.locator('#hjDocPdf').waitFor(); await tapOk('#hjDocPdf, #hjDocWord, #hjDocImage');
    const html = await previewHtml();
    assert.match(html, /누 수 피 해 확 인 서/); assert.match(html, /☑ 천장/); assert.match(html, /☑ 벽/); assert.match(html, /☐ 바닥/); assert.match(html, /욕실 천장 석고보드 얼룩/);
    assert.equal((html.match(/data-ins-damage-photos/g) || []).length, 1); assert.equal((html.match(/<img data-photo=/g) || []).length, 6, 'six damage photos');
    assert.equal((html.match(/서명" style="display:block;height:56px/g) || []).length, 2, 'victim and cause signatures');
    assert(!html.includes(CUST) && !html.replace(/\D/g, '').includes('01012345678') && !html.includes(LEAK), 'no customer name, phone or project name'); assert(!AMOUNT_RE.test(html), 'no amount in the damage confirmation');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).length === 1, LEAK);
    const issued = await page.evaluate(name => { const p = state.projects.find(x => x.name === name); return { docs: p.docs, notes: state.notes.filter(n => n.text.startsWith('[문서]')).map(n => n.text), auto: hjInsAuto(p, 'damage') }; }, LEAK);
    assert.equal(issued.docs[0].type, 'damage'); assert.match(issued.docs[0].no, /^DC-\d{8}-01$/); assert.equal(issued.docs[0].purpose, 'pdf'); assert.match(issued.notes[0], /^\[문서\] 피해 확인서 발행 · DC-/); assert.match(issued.auto, /^피해 확인서 DC-/);
    assert.deepEqual((await snapshot()).keys, before.keys, 'no new top-level serialized keys');
  });

  await test('② 체크리스트 12항목 · 만들기 연결 · 첨부 · 완료 · 해당 없음 · 진행률 · 고객 안내문에 금액 없음', async () => {
    await seed();
    await page.locator('#view [data-insclaim]').waitFor(); await tapOk('#view [data-insclaim]'); await page.locator('#view [data-insclaim]').click(); await page.locator('#hjInsClaim').waitFor();
    assert.equal(await page.locator('[data-ins-item]').count(), 12); assert.equal(await page.locator('[data-ins-make]').count(), 6); assert.equal(await page.locator('[data-ins-attach]').count(), 6, 'attach only for our documents');
    assert.equal(await page.locator('[data-ins-item="idbank"] [data-ins-attach]').count(), 0, 'customer ID/bank copies are never attached');
    const total = await page.evaluate(() => won(quoteCalc(state.quotes[0]).total));
    assert.equal(await page.locator('[data-ins-item="quote"]').getAttribute('data-ins-state'), 'done', 'saved leak quote counts as ready'); assert(String(await page.locator('[data-ins-item="quote"] [data-ins-detail]').innerText()).includes(total), 'owner sees the quote amount in the app');
    assert.match(await page.locator('[data-ins-progress]').innerText(), /진행 1\/12/);
    await tapOk('#modalRoot .mfoot button, [data-ins-make], [data-ins-attach], [data-ins-done], [data-ins-skip], #insExtraAdd, #modalRoot details summary'); await noOverflow(); await shot('02-claim');
    await page.evaluate(() => { window.__v442Real = {}; for (const fn of ['hjLeakReportView', 'payRcptDialog', 'hjEvidenceView', 'hjLeakNarrView']) { __v442Real[fn] = window[fn]; window[fn] = (...args) => { __v442Calls.make.push([fn, args[0], args[1] && args[1].purpose]); closeModal(true); }; } });
    for (const key of ['opinion', 'receipt', 'photos', 'narr']) { await close(); await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('[data-ins-make="' + key + '"]').click(); await page.waitForFunction(n => __v442Calls.make.length === n, ['opinion', 'receipt', 'photos', 'narr'].indexOf(key) + 1); }
    const made = await page.evaluate(() => { for (const [fn, real] of Object.entries(__v442Real)) window[fn] = real; delete window.__v442Real; return __v442Calls.make; });
    assert.deepEqual(made, [['hjLeakReportView', LEAK, undefined], ['payRcptDialog', LEAK, undefined], ['hjEvidenceView', LEAK, 'insurance'], ['hjLeakNarrView', LEAK, undefined]]);
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('[data-ins-make="quote"]').click(); await page.waitForFunction(() => state.tab === 'quotemaker' && state.editingQuote && state.editingQuote.id === 'TEST_INS_Q1');
    await page.evaluate(() => { state.editingQuote = null; state.tab = 'project'; render(); });
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('[data-ins-make="damage"]').click(); await page.locator('#hjInsDamage').waitFor(); await footer('보험 청구').click(); await page.locator('#hjInsClaim').waitFor();
    assert.equal(await claim(LEAK), null, 'navigating without changes stores nothing');
    await page.locator('[data-ins-done="claimform"]').click(); await page.locator('[data-ins-item="claimform"][data-ins-state="done"]').waitFor(); assert.match(await page.locator('[data-ins-progress]').innerText(), /진행 2\/12/);
    await page.locator('[data-ins-done="claimform"]').click(); await page.locator('[data-ins-item="claimform"][data-ins-state="todo"]').waitFor();
    await page.locator('[data-ins-done="resident"]').click(); await page.locator('[data-ins-item="resident"][data-ins-state="done"]').waitFor();
    await page.locator('[data-ins-skip="officelog"]').click(); await page.locator('[data-ins-item="officelog"][data-ins-state="skip"]').waitFor(); assert.match(await page.locator('[data-ins-progress]').innerText(), /진행 2\/11/);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-ins-attach="receipt"]').click()]);
    await chooser.setFiles({ name: '세금계산서.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%TEST\n') });
    await page.locator('[data-ins-item="receipt"][data-ins-state="done"]').waitFor();
    const att = await page.evaluate(name => { const c = state.projects.find(x => x.name === name).leak.claim; const f = state.files.find(x => x.name === '세금계산서.pdf'); return { e: c.checklist.receipt, file: f && [f.kind, f.project], ref: f && hjFileRef(f) }; }, LEAK);
    assert.deepEqual(att.file, ['other', LEAK]); assert.equal(att.e.done, true); assert.equal(att.e.fileName, '세금계산서.pdf'); assert.equal(att.e.fileRef, att.ref); assert.match(await page.locator('[data-ins-item="receipt"] [data-ins-detail]').innerText(), /첨부 세금계산서\.pdf/);
    assert.match(await page.locator('[data-ins-progress]').innerText(), /진행 3\/11/);
    await footer('고객 안내문').click(); await page.locator('#hjDocSms').waitFor(); await tapOk('#hjDocPdf, #hjDocSms, #hjDocImage');
    const guide = await previewHtml();
    assert.match(guide, /보험 청구 서류 안내/); assert.match(guide, /저희\(만물인테리어\)가 준비하는 서류/); assert.match(guide, /고객님이 준비하실 서류/); assert.match(guide, /진행<\/b>3 \/ 11/);
    assert(!guide.includes(total) && !AMOUNT_RE.test(guide), 'INS_GUIDE_NO_AMOUNT'); assert(!guide.includes(CUST) && !guide.replace(/\D/g, '').includes('01012345678'), 'guide has no customer data');
    await page.locator('#hjDocSms').click(); await page.waitForFunction(() => __v442Calls.compose.length === 1);
    const sms = await page.evaluate(() => __v442Calls.compose[0]);
    assert.equal(sms.kind, 'insguide'); assert.equal(sms.project, LEAK); assert(!AMOUNT_RE.test(sms.text), 'INS_GUIDE_NO_AMOUNT sms: ' + sms.text);
    assert.match(sms.text, /저희가 준비:\n· 누수 탐지 소견서\n· 원인 수리 견적서 ✓ — 견적 \d{4}-\d{2}-\d{2}\n· 수리비 영수증 ✓ — 완료 \d{2}-\d{2} · 첨부 세금계산서\.pdf/); assert.match(sms.text, /· 관리사무소 누수 민원 기록 \(해당 없음\)/); assert.match(sms.text, /고객님 준비:[\s\S]*주민등록등본 ✓/);
  });

  await test('③ 보험사별로 고친 목록 — 다음 현장에 제안만, 적용은 눌러야', async () => {
    await seed();
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('#insInsurer').fill('테스트화재'); await page.locator('#insInsurer').blur(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).leak.claim || {}).insurer === '테스트화재', LEAK);
    await page.locator('[data-ins-skip="officelog"]').click(); await page.locator('[data-ins-item="officelog"][data-ins-state="skip"]').waitFor();
    await page.locator('#insExtraLabel').fill('손해사정 위임장'); await page.locator('#insExtraAdd').click(); await page.locator('[data-ins-extra-del]').waitFor();
    assert.equal(await page.locator('[data-ins-item]').count(), 13);
    const tpl = await page.evaluate(() => JSON.parse(localStorage.getItem('hj_ins_tpl')));
    assert.deepEqual(Object.keys(tpl), ['테스트화재']); assert.deepEqual(tpl['테스트화재'].skip, ['officelog']); assert.deepEqual(tpl['테스트화재'].extra, ['손해사정 위임장']);
    assert(!JSON.stringify(tpl).includes(CUST) && !JSON.stringify(tpl).includes(LEAK), 'template keeps no personal or site data');
    await close(); await page.evaluate(name => hjInsClaimView(name), LEAK2); await page.locator('#hjInsClaim').waitFor(); assert.equal(await page.locator('[data-ins-tpl]').count(), 0, 'no banner before the insurer is chosen');
    await page.locator('#insInsurer').fill('테스트화재'); await page.locator('#insInsurer').blur(); await page.locator('[data-ins-tpl]').first().waitFor();
    assert.match(await page.locator('div[data-ins-tpl]').innerText(), /관리사무소 누수 민원 기록 해당 없음 · 손해사정 위임장 추가/); await tapOk('button[data-ins-tpl]');
    let c2 = await claim(LEAK2); assert.equal(c2.insurer, '테스트화재'); assert.equal((c2.checklist.officelog || {}).skip, undefined, 'suggestion is not forced'); assert.equal((c2.extra || []).length, 0);
    await page.locator('button[data-ins-tpl="keep"]').click(); await page.waitForFunction(name => state.projects.find(x => x.name === name).leak.claim.tplSeen === '테스트화재', LEAK2);
    assert.equal(await page.locator('div[data-ins-tpl]').count(), 0); c2 = await claim(LEAK2); assert.equal((c2.checklist.officelog || {}).skip, undefined);
    await close(); await page.evaluate(name => { delete state.projects.find(x => x.name === name).leak.claim.tplSeen; hjInsClaimView(name); }, LEAK2); await page.locator('button[data-ins-tpl="apply"]').click();
    await page.locator('[data-ins-item="officelog"][data-ins-state="skip"]').waitFor(); c2 = await claim(LEAK2);
    assert.equal(c2.checklist.officelog.skip, true); assert.deepEqual(c2.extra.map(x => x.label), ['손해사정 위임장']); assert.match(c2.extra[0].key, /^x_[a-z0-9]{3,12}$/); assert.match(await page.locator('[data-ins-progress]').innerText(), /진행 0\/12/);
    await page.locator('[data-ins-extra-del]').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).leak.claim.extra || []).length === 0, LEAK2);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hj_ins_tpl'))['테스트화재'].extra, []), [], 'removing on the next site updates the suggestion');
    assert.equal(await page.evaluate(name => hjInsClaimView(name), INT), false, 'interior projects have no insurance checklist');
  });

  await test('④ 제출 이력 2건 · 보완 메모 · 주민번호 거절 · 대시보드 집계 · 오늘 마감 제출 예정 · 저장본 불변 · 44px · 더보기', async () => {
    await seed(); const before = await snapshot(); const today = await page.evaluate(() => localDate());
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('#hjInsClaim').waitFor(); await footer('닫기').click();
    sameSnapshot(await snapshot(), before, 'opening and closing the checklist stores nothing');
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('#insInsurer').fill('테스트화재'); await page.locator('#insDue').fill(today); await page.locator('#insDue').blur();
    await page.locator('#insMemo').fill('900101-1234567 확인'); await page.locator('#insMemo').blur(); await page.waitForTimeout(100);
    assert.equal((await claim(LEAK)).memo, undefined, 'resident-number-like memo is refused'); await page.locator('#insMemo').fill('담당 김대리'); await page.locator('#insMemo').blur();
    await page.waitForFunction(name => state.projects.find(x => x.name === name).leak.claim.memo === '담당 김대리', LEAK);
    assert.deepEqual(await page.evaluate(day => hjInsDue(day), today), [LEAK]); assert.equal(await page.evaluate(day => hjDayCloseData(day).insDue.length, today), 1);
    await close(); await page.evaluate(() => hjDayCloseView()); await page.locator('[data-dc-insdue]').waitFor(); assert.match(await page.locator('[data-dc-insdue]').innerText(), new RegExp(LEAK));
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; state.activeProject = null; render(); }); await page.locator('#view [data-ins-dash]').waitFor();
    assert.match(await page.locator('#view [data-ins-dash]').innerText(), /🧾 보험 서류 진행 중 1곳 \(미완 11\)/);
    await page.evaluate(() => { state.tab = 'project'; state.activeProject = 'TEST_INS_LEAK'; render(); });
    await page.evaluate(name => hjInsClaimView(name), LEAK); await page.locator('[data-ins-done="claimform"]').click(); await page.locator('[data-ins-item="claimform"][data-ins-state="done"]').waitFor();
    await footer('제출했음').click(); await page.locator('#hjInsSubmit').waitFor(); await tapOk('#modalRoot .mfoot button, [data-is-via], #hjInsSubmit label:has([data-is-key])'); await noOverflow(); await shot('03-submit');
    assert.equal(await page.locator('[data-is-key]:checked').count(), 2, 'ready items are preselected');
    await page.locator('[data-is-via="팩스"]').click(); assert.equal(await page.locator('[data-is-via="팩스"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-is-key="photos"]').check(); await footer('기록').click(); await page.locator('[data-ins-sub="0"]').waitFor();
    await footer('제출했음').click(); await page.locator('#hjInsSubmit').waitFor(); await page.locator('[data-is-via="이메일"]').click();
    for (const el of await page.locator('[data-is-key]').all()) await el.uncheck();
    await footer('기록').click(); await page.waitForTimeout(100); assert.equal(await page.locator('#hjInsSubmit').count(), 1, 'at least one document is required');
    await page.locator('[data-is-key="victim"]').check(); await footer('기록').click(); await page.locator('[data-ins-sub="1"]').waitFor();
    assert.match(await page.locator('[data-ins-sub="0"]').innerText(), /\d{2}\/\d{2} 팩스 — 3건/); assert.match(await page.locator('[data-ins-sub="1"]').innerText(), /\d{2}\/\d{2} 이메일 — 1건/);
    await page.locator('[data-ins-sub-memo="0"]').fill('피해 사진 추가 요청'); await page.locator('[data-ins-sub-memo="0"]').blur();
    await page.waitForFunction(name => state.projects.find(x => x.name === name).leak.claim.submitted[0].memo === '피해 사진 추가 요청', LEAK);
    const c = await claim(LEAK);
    assert.deepEqual(c.submitted.map(x => [x.at, x.via, x.keys.length]), [[today, '팩스', 3], [today, '이메일', 1]]); assert.deepEqual(c.submitted[0].keys.sort(), ['claimform', 'photos', 'quote']);
    assert.equal((await page.evaluate(() => state.notes.filter(n => n.text.startsWith('[보험 제출]')).map(n => n.text))).length, 2);
    assert.deepEqual(await page.evaluate(day => hjInsDue(day), today), [], 'submitted today leaves the due list');
    assert(Object.keys(c).every(k => ['insurer', 'claimNo', 'dueAt', 'checklist', 'extra', 'submitted', 'memo', 'closedAt', 'tplSeen', 'damage'].includes(k)), 'claim keys: ' + Object.keys(c));
    const ids = await page.locator('#hjInsClaim input, #hjInsClaim textarea').evaluateAll(nodes => nodes.map(n => n.id || n.dataset.insSubMemo && 'sub'));
    assert.deepEqual([...new Set(ids)].sort(), ['insAttachFile', 'insClaimNo', 'insClosed', 'insDue', 'insExtraLabel', 'insInsurer', 'insMemo', 'sub'], 'no policy number / resident number / account fields');
    await page.locator('#insClosed').check(); await page.waitForFunction(name => !!state.projects.find(x => x.name === name).leak.claim.closedAt, LEAK);
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; state.activeProject = null; render(); }); assert.equal(await page.locator('#view [data-ins-dash]').count(), 0, 'closed claims leave the dashboard');
    await page.evaluate(name => docHubView(name), LEAK); await page.locator('#modalRoot .docHubBtn[data-act="insclaim"]').waitFor();
    assert.equal(await page.locator('#modalRoot .docHubBtn[data-act="todo:damage"]').count(), 0); assert.match(await page.locator('#modalRoot .docHubBtn[data-act="insclaim"]').innerText(), /진행 \d+\/\d+ · 제출 2회/);
    await page.locator('#modalRoot .docHubBtn[data-act="damage"]').click(); await page.locator('#hjInsDamage').waitFor();
    assert.deepEqual((await snapshot()).keys, before.keys, 'no new top-level serialized keys');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v442Calls.external), []);
  });
  console.log(`insurance-v442: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL insurance-v442', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

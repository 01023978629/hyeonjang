/* v435 🧾 영수증 → 경비(기기 안 글자 읽기) · 월별 세무사 전달 자료 — 합성 영수증(글자를 그린 캔버스 PNG)만.
   글자 읽기(hjReceiptOcrText)는 기록용 스텁(파일 이름 → 정해 둔 영수증 글자) — Tesseract·Vision·Gemini·네트워크 0.
   JSZip/XLSX/다운로드/Drive 도 기록용 스텁. HJ_V435_BASELINE=<commit> 은 EXPENSEOCR_API_PRESENT 에서,
   HJ_V435_MUTATION=dup-off(중복 경고 끔)는 RECEIPT_DUP_WARNS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const TILE = 'TEST_R1 욕실 타일', LEAK = 'TEST_R2 누수', PAPER = 'TEST_R3 도배';
const baseline = process.env.HJ_V435_BASELINE && execFileSync('git', ['show', process.env.HJ_V435_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
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
    window.__v435 = { zips: [], downloads: [], drive: [], snapshots: [], toasts: [], external: [], ocr: [], gemini: 0, adds: 0 };
    window.open = (...args) => { __v435.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjReceiptAdd', 'hjReceiptParse', 'hjReceiptSave', 'hjReceiptDups', 'hjReceiptOcrText', 'hjTaxPackView', 'hjTaxPackData', 'hjTaxPackBuild', 'hjTaxPackRecord'].every(k => typeof window[k] === 'function') && Array.isArray(HJ_EXP_CAT7) && !!DOCUMENT_ROLES.receipt && !!KIND.receipt), true, 'EXPENSEOCR_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    window.ensureJSZip = async () => {}; window.ensureXLSX = async () => {};
    window.JSZip = function () {
      const files = {}; __v435.zips.push({ files });
      const make = prefix => ({ file(p, b) { files[prefix + p] = b; return this; }, folder(n) { return make(prefix + n + '/'); } });
      const api = make(''); api.generateAsync = async () => new Blob([JSON.stringify(Object.keys(files))], { type: 'application/zip' }); return api;
    };
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => rows, book_append_sheet: (wb, ws, name) => { wb.sheets.push({ name, rows: ws }); } }, write: wb => JSON.stringify(wb.sheets), writeFile: () => {} };
    hjEvidenceDownload = (blob, name) => { __v435.downloads.push(name); };
    hjEvidenceDrive = async (blob, name) => { __v435.drive.push(name); return true; };
    geminiVision = async () => { __v435.gemini++; return '{}'; };
    const realToast = toast; toast = m => { __v435.toasts.push(String(m)); return realToast(m); };
    const realSnap = hjSnapshot; hjSnapshot = async (label, force, allowEmpty) => { __v435.snapshots.push(String(label)); return realSnap(label, force, allowEmpty); };
    // 글자 읽기 스텁 — 파일 이름으로 정해 둔 글자. 'slow' 는 끝나지 않는다(✍ 직접 입력 길).
    window.__v435Text = {};
    hjReceiptOcrText = file => { __v435.ocr.push(file.name); const t = __v435Text[file.name]; return t === 'slow' ? new Promise(() => {}) : Promise.resolve(t || ''); };
  });
  if (process.env.HJ_V435_MUTATION) {
    assert.equal(process.env.HJ_V435_MUTATION, 'dup-off');
    await page.evaluate(() => { hjReceiptDups = () => []; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS expenseocr-v435 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  let D;   // 날짜들(오늘 기준 — 언제 돌려도 같은 달 안)
  async function seed() {
    await close();
    D = await page.evaluate(async ({ TILE, LEAK, PAPER }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), day = Math.min(Number(today.slice(8, 10)), 28), month = today.slice(0, 7), d = n => month + '-' + String(Math.max(1, day - n)).padStart(2, '0');
      const project = (name, kind, extra) => Object.assign({ name, kind, stage: 2, phases: [], customer: { name: '박영수', phone: '010-7000-1111', addr: '대전 중구 대흥동 1-1' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }, extra || {});
      state.projects = [project(TILE, 'interior'), project(LEAK, 'leak'), project(PAPER, 'interior', { cost: { material: 300000, labor: 0, outsource: 0 } })];
      state.payLog = [{ id: 'TEST_PAY_1', d: d(1), amt: 1500000, project: TILE, method: '계좌', proof: 'tax' }];
      const dl = hjTaxPackDeadline(month), sid = 'tax_' + dl.raw + '_' + dl.k;
      if (!state.schedule.some(s => s.id === sid)) state.schedule.push(Object.assign(newSchedule(), { id: sid, title: '부가세 확정신고·납부', date: dl.raw, time: '09:00', project: '', workers: '', memo: 'TEST', _taxAuto: true }));
      state.activeProject = TILE; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null;
      for (const k of Object.keys(__v435)) __v435[k] = Array.isArray(__v435[k]) ? [] : 0;
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V435_SEED_SAVE_FAILED');
      return { today, month, a: d(3), b: d(2), c: d(1), sid };
    }, { TILE, LEAK, PAPER });
    return D;
  }
  // 합성 영수증 — 글자를 캔버스에 그린 PNG(사진 원본 보관·크기 비교용). 글자 읽기는 스텁이 같은 글자를 돌려준다.
  async function makeReceipts(map) {
    await page.evaluate(async map => {
      window.__v435Files = window.__v435Files || {};
      for (const [name, text] of Object.entries(map)) {
        const c = document.createElement('canvas'); c.width = 360; c.height = 420; const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 420); g.fillStyle = '#111'; g.font = '17px sans-serif';
        String(text === 'slow' ? '(흐린 영수증)' : text).split('\n').forEach((l, i) => g.fillText(l, 12, 28 + i * 23));
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        __v435Files[name] = new File([blob], name, { type: 'image/png', lastModified: Date.now() }); __v435Text[name] = text;
      }
    }, map);
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
    if (!process.env.HJ_V435_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V435_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V435_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const settle = () => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; });
  const dots = iso => iso.replace(/-/g, '.');
  const TEXT_A = iso => '한솔자재 (주)\n대전 중구 대흥동 12\n사업자 123-45-67890 대표 김한솔\nTEL 042-123-4567\n' + dots(iso) + ' 14:22\n품명 수량 단가 금액\n타일 접착제 2 25,000 50,000\n부가세 5,000\n합 계 55,000\n신용카드 승인번호 12345678';
  const TEXT_B = iso => 'GS칼텍스 대흥주유소\n' + iso + ' 08:10\n경유 52.3L\n결제금액 80,000원\n현금 영수증(지출증빙)';

  await test('① 영수증 1장 → 확인(날짜·금액·상호·카드·자재·현장) → 저장: 파일(kind receipt·원본 기기 보관)+지출(src·fileId·cat) 한 번에 · 현장 원가 · 같은 영수증 다시 넣으면 중복 경고', async () => {
    await seed(); await makeReceipts({ 'receipt_a.png': TEXT_A(D.a) });
    await page.evaluate(() => { __v435.snapshots = []; hjReceiptAdd({ files: [__v435Files['receipt_a.png']] }); });
    await page.locator('#hjRcConfirm').waitFor();
    const f = await page.evaluate(() => ({ date: rcDate.value, amt: rcAmt.value, vendor: rcVendor.value, method: document.querySelector('[data-rc-method][aria-pressed="true"]').dataset.rcMethod, cat: document.querySelector('[data-rc-cat][aria-pressed="true"]').dataset.rcCat, proj: rcProj.value, cost: rcCost.checked, note: rcCostNote.textContent, found: document.querySelector('[data-rc-found]').textContent, photo: !!document.querySelector('[data-rc-photo]') }));
    assert.deepEqual([f.date, f.amt, f.vendor, f.method, f.cat, f.proj, f.cost], [D.a, '55,000', '한솔자재 (주)', '카드', '자재', TILE, true]);
    assert.match(f.note, /원가\(자재\)에 들어갑니다/); assert.match(f.found, /날짜·금액·상호/); assert.equal(f.photo, true);
    assert.equal(await page.locator('[data-rc-dup]').count(), 0);
    await tapOk('#hjRcConfirm [data-rc-cat], #hjRcConfirm [data-rc-method], #modalRoot .mfoot button');
    assert(await page.evaluate(() => ['rcDate', 'rcAmt', 'rcVendor', 'rcProj'].every(id => document.getElementById(id).getBoundingClientRect().height >= 48)), 'big inputs');
    await noOverflow(); await shot('01-receipt-confirm');
    await footer('💾 저장').click();
    await page.waitForFunction(() => (state.expenses || []).length === 1 && !document.getElementById('hjRcConfirm')); await settle();
    const r = await page.evaluate(async () => { const e = state.expenses[0], file = hjReceiptFileOf(e), blob = file ? await getFileOf(file) : null, stored = await idbGetStrict('appState');
      return { e: { date: e.date, amount: e.amount, category: e.category, cat: e.cat, method: e.method, vendor: e.vendor, project: e.project, src: e.src, fileId: e.fileId, raw: e.ocr && e.ocr.raw }, file: file && { name: file.name, kind: file.kind, project: file.project, role: file.documentMeta && file.documentMeta.role, key: 'k:' + fileKey(file) },
        blob: blob && blob.size, orig: __v435Files['receipt_a.png'].size, storedExp: (stored.expenses || []).length, storedFile: (stored.files || []).filter(x => x.kind === 'receipt').length, snaps: __v435.snapshots.slice(), material: projStats(state.projects[0].name).material, gemini: __v435.gemini }; });
    assert.deepEqual([r.e.date, r.e.amount, r.e.category, r.e.cat, r.e.method, r.e.vendor, r.e.project, r.e.src], [D.a, 55000, '자재', '자재', '카드', '한솔자재 (주)', TILE, 'receipt']);
    assert.match(r.e.raw, /합 계 55,000/); assert.equal(r.e.fileId, r.file.key, 'fileId points at the receipt file');
    assert.deepEqual([r.file.name, r.file.kind, r.file.project, r.file.role], ['영수증_' + D.a.replace(/-/g, '') + '_한솔자재(주)_55000원.png', 'receipt', TILE, 'receipt']);
    assert.equal(r.blob, r.orig, 'original kept on this device'); assert.deepEqual([r.storedExp, r.storedFile], [1, 1], 'saved together');
    assert.deepEqual(r.snaps, ['영수증 저장 전']); assert.equal(r.material, 55000, 'project cost (ledger material)'); assert.equal(r.gemini, 0, 'no external OCR');
    // 같은 영수증을 다시 — 중복 경고, 저장 단추 '그래도 저장'. 닫으면 아무것도 안 생긴다.
    const before = await snapshot();
    await page.evaluate(() => hjReceiptAdd({ files: [__v435Files['receipt_a.png']] })); await page.locator('#hjRcConfirm').waitFor();
    assert.equal(await page.locator('[data-rc-dup]').count(), 1, 'RECEIPT_DUP_WARNS');
    assert.match(await page.locator('[data-rc-dup]').innerText(), /같은 날짜·금액·상호/); assert.equal(await page.locator('#rcSave').innerText(), '⚠️ 그래도 저장');
    await page.locator('#rcAmt').fill('56,000'); assert.equal(await page.locator('[data-rc-dup]').count(), 0, 'different amount — no warning'); await page.locator('#rcAmt').fill('55,000');
    await shot('02-receipt-dup');
    await close(); sameSnapshot(await snapshot(), before, 'closing the confirm saves nothing');
  });

  await test('② 여러 장 — 주유(현금·유류·원가 끔) · 못 읽은 영수증(✍ 직접 입력 · 주차·통행 · 공통) · 다시 읽지 않음', async () => {
    await makeReceipts({ 'receipt_b.png': TEXT_B(D.b), 'receipt_c.png': 'slow' });
    await page.evaluate(() => { __v435.ocr = []; hjReceiptAdd({ files: [__v435Files['receipt_b.png'], __v435Files['receipt_c.png']] }); });
    await page.locator('#hjRcConfirm').waitFor(); assert.match(await page.locator('#modalRoot .modal').innerText(), /1\/2/);
    const b = await page.evaluate(() => ({ amt: rcAmt.value, vendor: rcVendor.value, method: document.querySelector('[data-rc-method][aria-pressed="true"]').dataset.rcMethod, cat: document.querySelector('[data-rc-cat][aria-pressed="true"]').dataset.rcCat }));
    assert.deepEqual(b, { amt: '80,000', vendor: 'GS칼텍스 대흥주유소', method: '현금', cat: '유류' });
    await page.locator('#rcCost').uncheck(); assert.match(await page.locator('#rcCostNote').innerText(), /현장 원가에는 넣지 않습니다/);
    await footer('💾 저장').click();
    await page.locator('#hjRcReading').waitFor(); await footer('✍ 직접 입력').click(); await page.locator('#hjRcConfirm').waitFor();
    assert.match(await page.locator('[data-rc-found]').innerText(), /글자를 읽지 못했어요/); assert.equal(await page.inputValue('#rcAmt'), '');
    await footer('💾 저장').click(); assert.match(await page.locator('#rcIssue').innerText(), /금액을 확인해 주세요/);
    await page.locator('#rcAmt').fill('12000'); await page.locator('#rcVendor').fill('대흥 공영주차장'); await page.locator('[data-rc-cat="주차·통행"]').click();
    await page.locator('#rcProj').selectOption(''); assert.equal(await page.locator('#rcCost').isDisabled(), true); assert.match(await page.locator('#rcCostNote').innerText(), /공통 경비/);
    await footer('💾 저장').click();
    await page.waitForFunction(() => state.expenses.length === 3 && !document.getElementById('hjRcConfirm')); await settle();
    const r = await page.evaluate(tile => ({ rows: state.expenses.slice(1).map(e => [e.vendor, e.amount, e.method, e.cat, e.category, e.project, hjReceiptFileOf(e) && hjReceiptFileOf(e).project]), etc: projStats(tile).costEtc, ocr: __v435.ocr.slice(), toast: __v435.toasts.find(t => /영수증 2건/.test(t)) }), TILE);
    assert.deepEqual(r.rows, [['GS칼텍스 대흥주유소', 80000, '현금', '유류', '유류', '', TILE], ['대흥 공영주차장', 12000, '카드', '주차·통행', '기타', '', null]]);
    assert.equal(r.etc, 0, 'cost off — not in project cost'); assert.deepEqual(r.ocr, ['receipt_b.png', 'receipt_c.png']); assert(r.toast, 'summary toast');
    // 글자 풀이 — 형식이 달라도
    const p = await page.evaluate(today => ({
      a: hjReceiptParse('김밥천국 대흥점\n가맹점명: 김밥천국 대흥점\n2026년 10월 3일 12:01\n결제금액 : 33,000원\n체크카드', today),
      b: hjReceiptParse('대전역 주차장\n26-10-02\nTOTAL 7,500\n주차 2시간', today),
      c: hjReceiptParse('어느 가게\n2019.01.02\n합계 9,900', today),
      d: hjReceiptParse('무명 상점\nTEL 042-555-1234\n품목 타일 3박스 120,000\n타일 줄눈 1 15,000\n주차 무료', today) }), '2026-10-16');
    assert.deepEqual([p.a.date, p.a.amount, p.a.vendor, p.a.method, p.a.cat], ['2026-10-03', 33000, '김밥천국 대흥점', '카드', '식대']);
    assert.deepEqual([p.b.date, p.b.amount, p.b.cat], ['2026-10-02', 7500, '주차·통행']);
    assert.deepEqual([p.c.date, p.c.amount], ['', 9900], 'too old a date is not guessed');
    assert.deepEqual([p.d.amount, p.d.vendor, p.d.cat], [120000, '무명 상점', '자재'], 'no total line — largest amount, phone line ignored; category by most hits');
  });

  await test('③ 월별 세무사 전달 자료 — 시트 3개(매출·지출·요약, 받을 돈 칸 없음)·영수증 사진 ZIP·세무 캘린더 체크·다시 만듦·드라이브', async () => {
    await page.evaluate(() => expenseAdd({ amount: 30000, category: '식대', method: '현금', date: localDate().slice(0, 7) + '-01', memo: '현장 점심' }));
    await settle();
    const before = await snapshot();
    await page.evaluate(m => hjTaxPackView(m), D.month); await page.locator('#hjTaxPack').waitFor();
    const v = await page.evaluate(() => ({ sales: document.querySelector('[data-taxpack-sales]').innerText, spend: document.querySelector('[data-taxpack-spend]').innerText, photos: document.querySelector('[data-taxpack-photos]').innerText, noproof: document.querySelector('[data-taxpack-noproof]').innerText, again: !!document.querySelector('[data-taxpack-again]') }));
    assert.match(v.sales, /1건/); assert.match(v.spend, /4건/); assert.match(v.photos, /3장/); assert.match(v.noproof, /1건/); assert.equal(v.again, false);
    await tapOk('#modalRoot .mfoot button, #hjTaxPack [data-taxpack-month]'); await noOverflow(); await shot('03-taxpack');
    sameSnapshot(await snapshot(), before, 'the tax pack view is read only');
    await footer('📦 ZIP 저장').click(); await page.waitForFunction(() => __v435.downloads.length === 1);
    await page.waitForFunction(() => state.notes.some(n => n.taxPack)); await page.locator('#hjTaxPack [data-taxpack-again]').waitFor(); await settle();
    const z = await page.evaluate(({ month, sid }) => { const files = __v435.zips[0].files, keys = Object.keys(files).sort(), xl = JSON.parse(files['만물_세무자료_' + month + '.xlsx']);
      return { keys, sheets: xl.map(s => s.name), sales: xl[0].rows, spend: xl[1].rows, summary: xl[2].rows, dl: __v435.downloads[0], note: state.notes.filter(n => n.taxPack).map(n => n.text), pack: (state.schedule.find(s => s.id === sid) || {}).taxPacks, readme: String(files['00_읽어주세요.txt']) }; }, D);
    assert.equal(z.dl, '만물_세무자료_' + D.month + '.zip'); assert.deepEqual(z.sheets, ['매출', '지출', '요약']);
    assert.deepEqual(z.keys.filter(k => k.startsWith('영수증/')).length, 3); assert.deepEqual(z.keys.filter(k => !k.startsWith('영수증/')), ['00_읽어주세요.txt', '만물_세무자료_' + D.month + '.xlsx']);
    assert(!JSON.stringify([z.sales[0], z.spend[0], z.summary]).includes('미수'), 'no receivable column');
    assert.deepEqual(z.sales.slice(1, 3).map(r => [r[1], r[2], r[4]]), [[TILE, 1500000, '세금계산서 발행'], ['', 1500000, '']]);
    assert.deepEqual(z.spend.slice(1, -1).map(r => [r[1], r[3], r[4], r[7] === '없음' ? '없음' : '사진']), [['식대', '', 30000, '없음'], ['자재', '한솔자재 (주)', 55000, '사진'], ['유류', 'GS칼텍스 대흥주유소', 80000, '사진'], ['주차·통행', '대흥 공영주차장', 12000, '사진']]);
    assert.deepEqual(z.spend[z.spend.length - 1].slice(0, 5), ['합계', '', '', '', 177000]);
    assert(z.summary.some(r => r[0] === '영수증 없는 지출' && r[1] === '1건')); assert(z.summary.some(r => r[0] === '  주차·통행' && r[1] === 12000));
    assert.match(z.readme, /영수증 사진 3장/);
    assert.deepEqual(z.note, ['[세무 자료] ' + D.month + ' 만듦 · 지출 4건 · 영수증 사진 3장']); assert(z.pack && z.pack[D.month], 'tax calendar item checked');
    // 세금 캘린더 줄에 체크
    assert.match(await page.evaluate(sid => { const it = taxCalendarItems().find(i => taxCalendarId(i) === sid); return it ? hjTaxPackDoneHtml(it) : '(item not upcoming)'; }, D.sid), /세무 자료 \d+월 만듦|item not upcoming/);
    // 다시 만듦 + 드라이브
    await footer('☁️ 드라이브에 저장').click(); await page.waitForFunction(() => __v435.drive.length === 1 && state.notes.filter(n => n.taxPack).length === 2);
    assert.deepEqual(await page.evaluate(() => state.notes.filter(n => n.taxPack).map(n => [n.taxPack.again, n.taxPack.via])), [[false, 'file'], [true, 'drive']]);
    assert.match(await page.evaluate(() => state.notes.filter(n => n.taxPack)[1].text), /\(다시 만듦\)/);
    await close();
  });

  await test('④ 이어진 곳 — 장부 🧾 보기(기기 원본)·세무 자료 단추 · 증빙 묶음 03_영수증 · 서류 탭 영수증·전표 · 더보기 영수증 스캔은 기기 안 길 · 월말 마감 3단계 · 계약', async () => {
    const keys0 = (await snapshot()).keys;
    await page.evaluate(m => expenseLedger(m), D.month); await page.locator('#expReceipt').waitFor();
    await tapOk('#expReceipt, #expTaxPack'); assert.equal(await page.locator('[data-rc-view]').count(), 3); await tapOk('[data-rc-view]');
    await page.locator('[data-rc-view]').first().click(); await page.locator('#hjRcPreview').waitFor();
    assert.equal(await page.locator('#hjRcPreview img[data-rc-preview]').count(), 1, 'original shown from this device');
    await footer('← 장부').click(); await page.locator('#expTaxPack').click(); await page.locator('#hjTaxPack').waitFor(); await close();
    const plan = await page.evaluate(tile => hjEvidencePlan(tile, { purpose: 'tax' }).entries.map(e => e.path).filter(p => p.startsWith('03_')), TILE);
    assert.equal(plan.length, 2, 'both TILE receipts in the evidence bundle'); assert(plan.every(p => /^03_영수증\/영수증_/.test(p)));
    await page.evaluate(() => { state.tab = 'docs'; render(); });
    assert.match(await page.locator('#view').innerText(), /영수증·전표\s*3/);
    await page.evaluate(() => { const real = hjReceiptAdd; hjReceiptAdd = o => { __v435.adds++; return true; }; try { cardReceiptScan('receipt'); } finally { hjReceiptAdd = real; } });
    assert.equal(await page.evaluate(() => __v435.adds), 1, 'more menu receipt scan → on-device path'); assert.equal(await page.evaluate(() => __v435.gemini), 0);
    await page.evaluate(m => monthCloseView(3, m), D.month); await footer('📤 세무사 자료').waitFor(); await tapOk('#modalRoot .mfoot button'); await close();
    await page.evaluate(() => { state.tab = 'photos'; render(); });
    assert.match(await page.evaluate(() => { const real = state.files; state.files = [{ id: 'TEST_PH', kind: 'photo', name: 'a.jpg', ext: 'jpg', size: 1, project: null, date: localDate() }]; try { return viewPhotos(); } finally { state.files = real; } }), /id="btnReceiptAdd"/);
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.deepEqual((await snapshot()).keys, keys0, 'no new top-level keys');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390px');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v435.external), []);
  });
  console.log(`expenseocr-v435: ${passed}/${passed} PASS; synthetic receipts; OCR/zip/xlsx stubbed; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL expenseocr-v435', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* Mixed photo/video work reports: synthetic records in the actual local page.
   No real files, account requests, downloads, sharing or business-data changes.
   HJ_PHOTO_REPORT_MEDIA_MUTATION=typekey|imageguard must fail a protected assertion.
   Requires tests/static-server.js on 8299. */
'use strict';
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const A = '가상 미디어현장', B = '가상 다른현장', C = '가상 사진전용';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const ALL = ['p1', 'p2', 'pu', 'v1', 'v2', 'vu'];
const MUTATION = process.env.HJ_PHOTO_REPORT_MEDIA_MUTATION || '';
const ONLY = process.env.HJ_PHOTO_REPORT_MEDIA_ONLY || '';
assert(['', 'typekey', 'imageguard'].includes(MUTATION), 'known media mutation');
let browser, passed = 0;

async function boot(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], requests = [], sideEffects = [];
  let observe = false;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (observe && !/^(data:|blob:)/.test(r.url())) requests.push(r.url()); });
  page.on('download', () => sideEffects.push('real-download'));
  page.on('popup', () => sideEffects.push('popup'));
  const gis = page.waitForEvent('requestfailed', { predicate: r => r.url() === 'https://accounts.google.com/gsi/client', timeout: 25000 });
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort());
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await gis;
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.waitForFunction(() => !!localStorage.getItem('hj_glance'));
  await page.evaluate(async ({ a, b, c, png, mutation }) => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue; aiOpsEnsureState().enabled = false;
    const project = name => ({ name, archived: false, stage: 1, received: 12345, phases: ['방수', '배관'], cost: { material: 100, labor: 200, outsource: 0 }, customer: { name: 'FAKE-PRIVATE-CUSTOMER', phone: 'FAKE-PRIVATE-CONTACT' } });
    state.projects = [project(a), project(b), project(c)];
    state.projects[0].aptUnits = [{ id: 'u1', type: 'unit', dong: '101', ho: '501', name: '', note: 'FAKE-PRIVATE-UNIT-NOTE' }, { id: 'u2', type: 'unit', dong: '102', ho: '501', name: '', note: '' }];
    let size = 100;
    const media = (id, ext, when, work, unit = 'u1', proj = a) => ({ id, name: '가상_' + id + '.' + ext, ext, kind: 'photo', project: proj, when: when ? new Date(when) : null, _worklabel: work, _phase: work.includes('배관') ? '배관' : '방수', size: ++size, _virtual: true, thumb: ext === 'png' ? 'data:image/png;base64,' + png : null, ...(proj === a ? { _aptUnit: { project: a, unitId: unit } } : {}) });
    state.files = [media('p1', 'png', '2026-09-12T01:00:00Z', '방수 사진'), media('p2', 'png', '2026-09-11T01:00:00Z', '배관 사진', 'u2'), media('pu', 'png', null, ''),
      media('v1', 'mp4', '2026-09-12T02:00:00Z', '방수 영상'), media('v2', 'MOV', '2026-09-11T02:00:00Z', '배관 영상', 'u2'), media('vu', 'webm', null, ''),
      media('outside-video', 'mp4', '2026-09-12T01:00:00Z', 'FAKE-OTHER-PROJECT-WORK', '', b), media('still-only', 'png', '2026-09-12T01:00:00Z', '사진전용 작업', '', c),
      { id: 'not-media', name: '가상_서류.pdf', kind: 'estimate', ext: 'pdf', project: a, size: 333, when: null, est: { amount: 55555555, date: '2026-09-12' } }];
    // v275 could leave an old raster thumbnail on a video. It is still a video.
    state.files.find(f => f.id === 'v1').thumb = 'data:image/png;base64,' + png;
    state.quotes = []; state.aptOrders = []; state.aptOffices = []; state.schedule = []; state.expenses = []; state.payLog = [];
    state.editingQuote = null; state.activeProject = null; state.tab = 'photos'; state.search = ''; state._demo = false; state.dirHandle = null; state.dirty = false;
    __tabStale = false; __sel.clear(); __sel.add('outside-video'); __gdToken = null; relayReady = () => false; __mobileMode = true; applyMobileMode();
    window.__mediaXss = 0; window.__mediaDirty = 0; window.__mediaMutation = 0;
    window.__mediaUnexpected = []; window.__mediaCopies = []; window.__mediaDownloads = []; window.__mediaBlobs = []; window.__mediaRevoked = [];
    window.__mediaLoads = []; window.__mediaExports = []; window.__mediaAI = []; window.__mediaLightbox = [];
    const reject = name => () => { window.__mediaUnexpected.push(name); throw new Error('unexpected external ' + name); };
    window.open = reject('window.open'); window.showOpenFilePicker = reject('picker'); window.showDirectoryPicker = reject('directory');
    if (navigator.share) navigator.share = reject('share');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => window.__mediaCopies.push(String(text)) } });
    relayCall = reject('relay'); portalAutoSync = reject('portal'); getFileOf = reject('original');
    loadPhotoForExport = reject('image-before-click'); geminiAsk = reject('AI-before-consent'); __docExport = reject('image-export-before-click');
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL, anchor = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (blob) { const url = create.call(URL, blob); window.__mediaBlobs.push({ url, blob }); return url; };
    URL.revokeObjectURL = function (url) { window.__mediaRevoked.push(url); return revoke.call(URL, url); };
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__mediaDownloads.push({ filename: this.download, url: this.href }); return; } return anchor.apply(this, arguments); };
    const lightbox = openLightbox;
    openLightbox = function (id, ids) { window.__mediaLightbox.push({ id, ids: Array.isArray(ids) ? [...ids] : null }); return lightbox.apply(this, arguments); };
    taxCalendarEnsure(); coworkSchedEnsure(); state.dirty = false; render(); clearTimeout(__idbSaveTimer);
    if (!await guardedPersistCurrentState()) throw new Error('fake media fixture persistence failed');
    await __appStateWriteQueue;
    const dirty = markDirty;
    markDirty = function () { window.__mediaDirty++; return dirty.apply(this, arguments); };
    if (mutation === 'typekey') {
      const data = photoReportData;
      photoReportData = function (name, options) {
        const d = data.apply(this, arguments);
        if (d) { window.__mediaMutation++; d.recordKey = JSON.stringify([name, d.options, d.projectTotal, d.files.map(f => [f.id, f.name, f.project, photoReportDate(f.when), f._worklabel, f._phase, f._aptUnit])]); }
        return d;
      };
    }
    if (mutation === 'imageguard') {
      const image = photoReportImage;
      photoReportImage = async function () {
        const video = isVideoRec;
        window.__mediaMutation++; isVideoRec = () => false;
        try { return await image.apply(this, arguments); } finally { isVideoRec = video; }
      };
    }
  }, { a: A, b: B, c: C, png: PNG, mutation: MUTATION });
  observe = true;
  return { context, page, errors, requests, sideEffects, width };
}

async function run(name, fn, width = 390) {
  if (ONLY && !name.includes(ONLY)) return;
  const t = await boot(width);
  try {
    await fn(t);
    assert.deepEqual(t.errors, [], 'pageerror=0'); assert.deepEqual(t.requests, [], 'network=0');
    assert.deepEqual(t.sideEffects, [], 'no real download/share/window');
    assert.deepEqual(await t.page.evaluate(() => window.__mediaUnexpected), [], 'no original/account/server access');
    passed++; console.log('PASS ' + width + 'px ' + name);
  } finally {
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' + await t.page.evaluate(() => window.__mediaMutation).catch(() => 0));
    await t.context.close();
  }
}
const snap = page => page.evaluate(async () => {
  const d = serializeData(); d.savedAt = 'FIXED';
  return { data: JSON.stringify(d), files: JSON.stringify(state.files), selected: [...__sel], dirty: state.dirty, dirtyCalls: window.__mediaDirty, stored: JSON.stringify(await idbGet('appState')), local: Object.fromEntries(Object.entries(localStorage)) };
});
async function readonly(t, before) {
  const after = await snap(t.page);
  assert.deepEqual(Object.keys(before).filter(k => !isDeepStrictEqual(before[k], after[k])), [], 'media report preserves records, business state, global selection, IDB and preferences');
  assert.equal(await t.page.evaluate(() => window.__mediaXss), 0);
}
async function open(t, options = {}, name = A) { await t.page.evaluate(({ name, options }) => photoReport(name, options), { name, options }); await t.page.locator('#photoReportPanel').waitFor(); }
async function close(t) { await t.page.keyboard.press('Escape'); await t.page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire); }
async function expectRows(t, ids) {
  const actual = await t.page.locator('#prResults .prPhotoPick,#prResults .prVideoPlay').evaluateAll(els => els.map(e => e.dataset.id).sort());
  assert.deepEqual(actual, [...ids].sort(), 'displayed media IDs');
}
async function imageStub(t, { deferred = false, fail = [], exportFails = false } = {}) {
  await t.page.evaluate(({ png, deferred, fail, exportFails }) => {
    window.__mediaLoads = []; window.__mediaImageUrls = []; window.__mediaDrawn = []; window.__mediaBounds = []; window.__mediaExports = []; window.__mediaRelease = null;
    const draw = window.__mediaOriginalDraw || (window.__mediaOriginalDraw = CanvasRenderingContext2D.prototype.drawImage);
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
      if (img.__fakeMediaId) {
        window.__mediaDrawn.push(img.__fakeMediaId);
        if (args.length === 8) window.__mediaBounds.push({ id: img.__fakeMediaId, top: args[5], bottom: args[5] + args[7], canvasHeight: this.canvas.height });
      }
      return draw.call(this, img, ...args);
    };
    loadPhotoForExport = async f => {
      window.__mediaLoads.push(f.id);
      if (deferred) await new Promise(resolve => window.__mediaRelease = resolve);
      if (fail.includes(f.id)) return null;
      const blob = new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' });
      const url = URL.createObjectURL(blob), img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      img.__fakeMediaId = f.id; window.__mediaImageUrls.push(url); return { img, url };
    };
    __docExport = async (canvas, name, pdf) => { window.__mediaExports.push({ name, pdf, width: canvas.width, height: canvas.height }); if (exportFails) throw new Error('FAKE-EXPORT-FAILURE'); };
  }, { png: PNG, deferred, fail, exportFails });
}

(async () => {
  browser = await chromium.launch({ headless: true });
  await run('혼합 집계·유형 정규화·날짜/공정/세대 필터 교집합', async t => {
    const before = await snap(t.page);
    const result = await t.page.evaluate(a => {
      const take = options => { const d = photoReportData(a, options); return { ids: d.files.map(f => f.id).sort(), total: d.total, projectTotal: d.projectTotal, photoCount: d.photoCount, videoCount: d.videoCount, projectPhotoCount: d.projectPhotoCount, projectVideoCount: d.projectVideoCount, mediaType: d.options.mediaType, groupedTotal: d.days.reduce((n, day) => n + day.count, 0) + d.undated.length }; };
      return { all: take({}), photos: take({ mediaType: 'photo' }), videos: take({ mediaType: 'video' }), invalid: [null, 'wrong', 17, {}].map(mediaType => take({ mediaType })), scoped: take({ mediaType: 'video', phase: '배관', unitFilter: 'unit:u2', from: '2026-09-11', to: '2026-09-11', includeUndated: false }), missing: take({ mediaType: 'video', missingWork: true }) };
    }, A);
    assert.deepEqual(result.all, { ids: [...ALL].sort(), total: 6, projectTotal: 6, photoCount: 3, videoCount: 3, projectPhotoCount: 3, projectVideoCount: 3, mediaType: 'all', groupedTotal: 6 });
    assert.deepEqual(result.photos.ids, ['p1', 'p2', 'pu']); assert.equal(result.photos.total, 3); assert.equal(result.photos.photoCount, 3); assert.equal(result.photos.videoCount, 0);
    assert.deepEqual(result.videos.ids, ['v1', 'v2', 'vu']); assert.equal(result.videos.total, 3); assert.equal(result.videos.photoCount, 0); assert.equal(result.videos.videoCount, 3);
    assert.equal(result.photos.projectTotal, 6); assert.equal(result.videos.projectPhotoCount, 3); assert.equal(result.videos.projectVideoCount, 3);
    for (const d of result.invalid) assert.deepEqual(d, result.all, 'invalid type normalizes to all');
    assert.deepEqual(result.scoped.ids, ['v2']); assert.deepEqual(result.missing.ids, ['vu']); await readonly(t, before);
  });

  await run('종류 변경은 동일 ID 및 조회 밖 전체 집계의 recordKey를 갱신', async t => {
    const result = await t.page.evaluate(a => {
      const all = photoReportData(a), outside = photoReportData(a, { query: '배관' });
      state.files.find(f => f.id === 'p1').ext = 'mp4';
      const fresh = photoReportData(a), freshOutside = photoReportData(a, outside.options);
      return { allChanged: all.recordKey !== fresh.recordKey, outsideChanged: outside.recordKey !== freshOutside.recordKey, idsSame: JSON.stringify(all.files.map(f => f.id)) === JSON.stringify(fresh.files.map(f => f.id)), totalSame: all.total === fresh.total, freshCounts: [fresh.photoCount, fresh.videoCount] };
    }, A);
    assert(result.allChanged, 'same ID changing photo to video invalidates recordKey');
    assert(result.outsideChanged, 'project-level type counts invalidate a filtered report too');
    assert(result.idsSame && result.totalSame); assert.deepEqual(result.freshCounts, [2, 4]);
  });

  for (const width of [320, 390]) await run('모바일 유형 필터·선택 제거·초기화·영상 타일·읽기 전용', async t => {
    const before = await snap(t.page); await open(t); await expectRows(t, ALL);
    assert.equal(await t.page.locator('#prMedia').inputValue(), 'all');
    assert.equal(await t.page.locator('[data-pr-media="photo"]').count(), 3); assert.equal(await t.page.locator('[data-pr-media="video"]').count(), 3);
    assert.equal(await t.page.locator('[data-pr-media="video"] input[type="checkbox"],[data-pr-media="video"] img').count(), 0, 'videos are not image checkboxes, including old cached thumbnails');
    const videoText = await t.page.locator('.prVideoPlay[data-id="v1"]').locator('..').innerText(); assert(videoText.includes('🎬') && videoText.includes('MP4'));
    await t.page.locator('.prPhotoPick[data-id="p1"]').check();
    await t.page.locator('#prMedia').selectOption('video'); await expectRows(t, ['v1', 'v2', 'vu']); assert(await t.page.locator('#prImg').isDisabled());
    await t.page.locator('#prMedia').selectOption('all'); assert.equal(await t.page.locator('.prPhotoPick:checked').count(), 0, 'hidden image selection does not return');
    await t.page.locator('#prQuery').fill('배관'); await expectRows(t, ['p2', 'v2']);
    await t.page.locator('#prMedia').selectOption('photo'); await expectRows(t, ['p2']);
    await t.page.locator('#prReset').click(); await expectRows(t, ALL); assert.equal(await t.page.locator('#prMedia').inputValue(), 'all');
    const bad = await t.page.locator('#prMedia,#prResults .prVideoPlay').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.id, w: r.width, h: r.height, named: !!(e.getAttribute('aria-label') || e.labels?.length || e.textContent.trim()) }; }).filter(r => r.w < 43.5 || r.h < 43.5 || !r.named));
    assert.deepEqual(bad, [], 'media select and replay controls are named and at least 44px');
    const overflow = await t.page.locator('#photoReportPanel,#prResults,#prMedia,#prText').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { id: e.id, left: r.left, right: r.right, scroll: e.scrollWidth, client: e.clientWidth }; }).filter(r => r.left < -1 || r.right > innerWidth + 1 || r.scroll > r.client + 2));
    assert.deepEqual(overflow, [], '320/390px report fits viewport'); await close(t); await readonly(t, before);
  }, width);

  await run('영상 재생은 조회 영상만 순회·Tab 갇힘·닫기/Esc 후 필터와 선택 보존', async t => {
    const before = await snap(t.page); await open(t, { mediaType: 'video' });
    assert.equal(await t.page.locator('#prMedia').inputValue(), 'video');
    await t.page.locator('#prMedia').selectOption('all'); await t.page.locator('#prQuery').fill('배관'); await expectRows(t, ['p2', 'v2']);
    await t.page.locator('.prPhotoPick[data-id="p2"]').check();
    for (const how of ['button', 'Escape']) {
      await t.page.locator('.prVideoPlay[data-id="v2"]').tap(); await t.page.locator('#lbVideoNone').waitFor();
      assert.deepEqual((await t.page.evaluate(() => window.__mediaLightbox)).at(-1), { id: 'v2', ids: ['v2'] });
      assert(await t.page.locator('#lbVideo').isHidden()); assert((await t.page.locator('#lbVideoNone').innerText()).includes('MOV'));
      for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
        await t.page.keyboard.press(key);
        assert(await t.page.evaluate(() => document.getElementById('lightbox').contains(document.activeElement)), 'lightbox keeps ' + key + ' focus away from the background report');
      }
      if (how === 'button') await t.page.locator('#lbClose').click(); else await t.page.keyboard.press('Escape');
      await t.page.waitForFunction(() => !document.getElementById('lightbox') && !window.__mobileSheetHistoryRetire);
      assert(await t.page.locator('#photoReportPanel').isVisible()); assert.equal(await t.page.locator('#prQuery').inputValue(), '배관');
      assert.equal(await t.page.locator('#prMedia').inputValue(), 'all'); assert(await t.page.locator('.prPhotoPick[data-id="p2"]').isChecked());
      assert(await t.page.evaluate(() => document.activeElement?.matches('.prVideoPlay[data-id="v2"]')), 'closing restores focus to the replay trigger');
    }
    await close(t); await readonly(t, before);
  });

  await run('브라우저 뒤로가기 1회 영상만·2회 보고서만 닫고 앱에 유지', async t => {
    const before = await snap(t.page); await open(t);
    await t.page.locator('#prQuery').fill('배관'); await t.page.locator('.prPhotoPick[data-id="p2"]').check();
    await t.page.locator('.prVideoPlay[data-id="v2"]').tap(); await t.page.locator('#lbVideoNone').waitFor();
    await t.page.goBack(); await t.page.waitForFunction(() => !document.getElementById('lightbox') && !window.__mobileSheetHistoryRetire);
    assert(await t.page.locator('#photoReportPanel').isVisible()); assert.equal(await t.page.locator('#prQuery').inputValue(), '배관'); assert(await t.page.locator('.prPhotoPick[data-id="p2"]').isChecked());
    await t.page.goBack(); assert(t.page.url().startsWith(ORIGIN + '/'), 'second back stays in the app instead of leaving to about:blank');
    await t.page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && !window.__mobileSheetHistoryRetire);
    assert.equal(await t.page.locator('#photoReportPanel,#lightbox').count(), 0); await readonly(t, before);
  });

  await run('가상 동영상 원본의 실제 재생기·native controls Tab·닫기 URL 회수', async t => {
    await t.page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
      const ctx = canvas.getContext('2d'), stream = canvas.captureStream(15), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(resolve => recorder.onstop = resolve); recorder.start(30);
      let frame = 0;
      // A short synthetic recording; the stop event, not a sleep, signals readiness.
      const timer = setInterval(() => { ctx.fillStyle = frame % 2 ? '#427bcb' : '#d85858'; ctx.fillRect(0, 0, 120, 80); if (++frame === 6) { clearInterval(timer); recorder.stop(); } }, 70);
      await stopped; stream.getTracks().forEach(track => track.stop());
      const file = new File(chunks, 'SYNTHETIC_MEDIA_ONLY.webm', { type: 'video/webm' });
      const f = state.files.find(f => f.id === 'v1'); f.ext = 'webm'; f._file = file; f.handle = null;
      getFileOf = async record => { if (record === f) return file; window.__mediaUnexpected.push('unexpected-original-' + record.id); throw new Error('only synthetic video allowed'); };
    });
    const before = await snap(t.page); await open(t); await t.page.locator('.prVideoPlay[data-id="v1"]').click();
    await t.page.waitForFunction(() => { const v = document.getElementById('lbVideo'); return v && v.readyState >= 1 && /^blob:/.test(v.currentSrc || v.src); });
    const video = await t.page.locator('#lbVideo').evaluate(v => ({ url: v.currentSrc || v.src, controls: v.controls, hidden: v.hidden, width: v.videoWidth, height: v.videoHeight }));
    assert(video.controls && !video.hidden && video.width > 0 && video.height > 0, 'actual generated media is decoded by the native video player');
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
      await t.page.keyboard.press(key);
      assert(await t.page.evaluate(() => document.getElementById('lightbox').contains(document.activeElement)), 'native controls keep ' + key + ' inside the lightbox');
    }
    await t.page.locator('#lbClose').click(); await t.page.waitForFunction(() => !document.getElementById('lightbox') && !window.__mobileSheetHistoryRetire);
    assert(await t.page.locator('#photoReportPanel').isVisible()); assert(await t.page.evaluate(url => window.__mediaRevoked.includes(url), video.url), 'closing revokes the synthetic media URL');
    await close(t); await readonly(t, before);
  });

  await run('영상 ID 중복·빈 ID·HTML 특수문자 안전 및 선택 중 종류 변경', async t => {
    const x = 'v"><img src=x onerror=window.__mediaXss=1>';
    await t.page.evaluate(({ b, x }) => {
      const base = state.files.find(f => f.id === 'v1');
      state.files.push({ ...base, project: b, size: 9001 }, { ...base, id: '', size: 9002 }, { ...base, id: x, name: x + '.mp4', size: 9003 });
    }, { b: B, x });
    const before = await snap(t.page); await open(t);
    const duplicate = t.page.locator('.prVideoPlay[data-id="v1"]');
    if (await duplicate.count()) assert(await duplicate.isDisabled(), 'globally duplicate video IDs cannot open an arbitrary record');
    const empty = t.page.locator('.prVideoPlay[data-id=""]');
    if (await empty.count()) assert(await empty.isDisabled(), 'empty video ID cannot play');
    assert.equal(await t.page.locator('#photoReportPanel img[src="x"]').count(), 0);
    assert((await t.page.locator('.prVideoPlay').evaluateAll(els => els.map(e => e.dataset.id))).includes(x), 'special-character ID remains inert data');
    await t.page.locator('.prPhotoPick[data-id="p1"]').check(); await close(t); await readonly(t, before);
    await open(t); await t.page.locator('.prPhotoPick[data-id="p1"]').check();
    await t.page.evaluate(() => state.files.find(f => f.id === 'p1').ext = 'mp4');
    const changed = await snap(t.page); await t.page.locator('#prQuery').fill('방수');
    assert.equal(await t.page.locator('.prPhotoPick:checked').count(), 0); assert(await t.page.locator('#prImg').isDisabled());
    assert.equal(await t.page.locator('.prVideoPlay[data-id="p1"]').count(), 1); await close(t); await readonly(t, changed);
  });

  await run('혼합/영상전용 글·명시 TXT·AI 전송내용과 사진전용 호환', async t => {
    await t.page.evaluate(() => { window.__geminiKey = 'FAKE-LOCAL-TEST-NOT-A-KEY'; geminiAsk = async prompt => { window.__mediaAI.push(String(prompt)); return '가상 AI 미디어 초안'; }; });
    const before = await snap(t.page); await open(t);
    const mixed = await t.page.locator('#prText').inputValue(); assert(/사진\s*3장/.test(mixed) && /동영상\s*3개/.test(mixed));
    await t.page.locator('#prMedia').selectOption('video'); const text = await t.page.locator('#prText').inputValue();
    assert(text.includes('방수 영상') && text.includes('배관 영상')); assert(!text.includes('방수 사진') && !text.includes('배관 사진'));
    for (const secret of ['FAKE-PRIVATE', 'FAKE-OTHER-PROJECT-WORK', '55555555']) assert(!text.includes(secret));
    await t.page.locator('#prCopy').click(); assert.deepEqual(await t.page.evaluate(() => window.__mediaCopies), [text]);
    await t.page.locator('#prSaveText').click();
    const saved = await t.page.evaluate(async () => { const d = window.__mediaDownloads[0], b = window.__mediaBlobs.find(b => b.url === d.url); return { name: d.filename, bytes: [...new Uint8Array(await b.blob.arrayBuffer())] }; });
    assert(saved.name.endsWith('.txt')); assert.deepEqual(saved.bytes.slice(0, 3), [239, 187, 191]);
    assert.equal(Buffer.from(saved.bytes.slice(3)).toString('utf8'), text.replace(/\r?\n/g, '\r\n') + '\r\n');
    await t.page.locator('#prAI').click(); assert((await t.page.locator('#prAIConfirm').innerText()).includes('동영상'));
    assert.deepEqual(await t.page.evaluate(() => window.__mediaAI), []); await t.page.locator('#prAIRun').click();
    await t.page.locator('textarea[aria-label="AI 초안 글"]').waitFor();
    const prompt = await t.page.evaluate(() => window.__mediaAI[0]); assert(prompt.includes(text)); assert(!prompt.includes('방수 사진'));
    await close(t); await open(t, {}, C);
    const photoOnly = await t.page.locator('#prText').inputValue(); assert(photoOnly.includes('조회 사진 1장 / 현장 전체 1장 · 날짜 미확인 0장')); assert(photoOnly.includes('사진전용 작업 · 사진 1장'));
    await close(t); await readonly(t, before);
  });

  await run('동영상 직접 합성은 한 장/사진과 혼합 모두 로더 호출 전에 차단', async t => {
    const before = await snap(t.page); await imageStub(t);
    for (const ids of [['v1'], ['p1', 'v2']]) {
      const error = await t.page.evaluate(async ({ a, ids }) => { try { await photoReportImage(a, ids); return ''; } catch (e) { return String(e.message || e); } }, { a: A, ids });
      assert(error, 'direct video image request is rejected');
      assert.deepEqual(await t.page.evaluate(() => window.__mediaLoads), [], 'invalid mixed selection reads no originals');
    }
    assert.equal(await t.page.locator('#prImageCanvas').count(), 0); await readonly(t, before);
  });

  await run('정상 사진은 실제 픽셀 합성·부분 실패 안내·명시 저장·URL 회수', async t => {
    const before = await snap(t.page); await imageStub(t, { fail: ['p2'] }); await open(t);
    await t.page.locator('.prPhotoPick[data-id="p1"]').check(); await t.page.locator('.prPhotoPick[data-id="p2"]').check();
    await t.page.locator('#prImg').click(); await t.page.locator('#prImageCanvas canvas').waitFor();
    assert.deepEqual(await t.page.evaluate(() => window.__mediaLoads), ['p1', 'p2']); assert.deepEqual(await t.page.evaluate(() => window.__mediaDrawn), ['p1']);
    assert(/실패|제외/.test(await t.page.locator('#prImageStatus').innerText())); assert.deepEqual(await t.page.evaluate(() => window.__mediaExports), []);
    assert(await t.page.evaluate(() => window.__mediaImageUrls.length === 1 && window.__mediaImageUrls.every(u => window.__mediaRevoked.includes(u))));
    await t.page.getByRole('button', { name: '이미지 저장·공유', exact: true }).click(); assert.equal(await t.page.evaluate(() => window.__mediaExports.length), 1);
    await close(t); await readonly(t, before);
  });

  await run('직접 합성 await 중 사진이 영상으로 바뀌면 늦은 그림 차단·URL 회수', async t => {
    await imageStub(t, { deferred: true });
    await t.page.evaluate(a => { window.__mediaPending = photoReportImage(a, ['p1']).then(value => ({ value }), error => ({ error: String(error.message || error) })); }, A);
    await t.page.waitForFunction(() => typeof window.__mediaRelease === 'function');
    await t.page.evaluate(() => state.files.find(f => f.id === 'p1').ext = 'mp4'); const before = await snap(t.page);
    const result = await t.page.evaluate(async () => { window.__mediaRelease(); return await window.__mediaPending; });
    assert(result.error, 'without reportKey, post-await type guard still rejects the changed record');
    assert.equal(await t.page.locator('#prImageCanvas').count(), 0); assert.deepEqual(await t.page.evaluate(() => window.__mediaExports), []);
    assert(await t.page.evaluate(() => window.__mediaImageUrls.length === 1 && window.__mediaImageUrls.every(u => window.__mediaRevoked.includes(u)))); await readonly(t, before);
  });

  await run('종류가 바뀐 오래된 TXT 및 AI 요청 전/응답 후 차단', async t => {
    const beforeRequest = await t.page.evaluate(async a => {
      const d = photoReportData(a); state.files.find(f => f.id === 'p1').ext = 'mp4';
      const out = {}; try { photoReportDownload(a, d); } catch (e) { out.download = String(e.message || e); }
      try { await photoReportAISummary(a, d); } catch (e) { out.ai = String(e.message || e); }
      return out;
    }, A);
    assert(beforeRequest.download && beforeRequest.ai); assert.deepEqual(await t.page.evaluate(() => window.__mediaDownloads), []);
    await t.page.evaluate(a => {
      geminiAsk = prompt => { window.__mediaAI.push(String(prompt)); return new Promise(resolve => window.__mediaAIRelease = resolve); };
      window.__mediaAIPending = photoReportAISummary(a, photoReportData(a)).then(value => ({ value }), error => ({ error: String(error.message || error) }));
    }, A);
    await t.page.waitForFunction(() => typeof window.__mediaAIRelease === 'function');
    await t.page.evaluate(() => state.files.find(f => f.id === 'v1').ext = 'png'); const before = await snap(t.page);
    const out = await t.page.evaluate(async () => { window.__mediaAIRelease('가상 늦은 초안'); return await window.__mediaAIPending; });
    assert(out.error, 'late AI summary with changed media type is rejected'); assert.equal(await t.page.evaluate(() => window.__mediaAI.length), 1); await readonly(t, before);
  });

  await run('일일 작업일보는 로더 {img,url} 사진 렌더·영상 제외·성공/실패 URL 회수', async t => {
    await t.page.evaluate(a => { state.schedule = [{ id: 'media-daily-report', project: a, date: '2026-09-12', title: '가상 작업', workers: 1, report: { done: '가상 작업 기록' } }]; }, A);
    const before = await snap(t.page); await imageStub(t);
    await t.page.evaluate(() => exportReport('media-daily-report', false));
    assert.deepEqual(await t.page.evaluate(() => window.__mediaLoads), ['p1'], 'video with old thumbnail is excluded before the image loader');
    assert.deepEqual(await t.page.evaluate(() => window.__mediaDrawn), ['p1'], 'loader img is drawn, not treated as a Blob'); assert.equal(await t.page.evaluate(() => window.__mediaExports.length), 1);
    assert(await t.page.evaluate(() => window.__mediaImageUrls.length === 1 && window.__mediaImageUrls.every(u => window.__mediaRevoked.includes(u))));
    await imageStub(t, { exportFails: true });
    await t.page.evaluate(async () => { try { await exportReport('media-daily-report', true); } catch (_) {} });
    assert.equal(await t.page.evaluate(() => window.__mediaExports.length), 1); assert(await t.page.evaluate(() => window.__mediaImageUrls.length === 1 && window.__mediaImageUrls.every(u => window.__mediaRevoked.includes(u))), 'export failure also releases loaded URLs');
    await readonly(t, before);
  });

  await run('일일 작업일보 긴 본문과 사진4장은 모두 캔버스/하단 안내 위에 포함', async t => {
    await t.page.evaluate(a => {
      const base = state.files.find(f => f.id === 'p1');
      state.files.find(f => f.id === 'p2').when = new Date(base.when);
      state.files.push({ ...base, id: 'p3', name: '가상_p3.png', size: 9010 }, { ...base, id: 'p4', name: '가상_p4.png', size: 9011 });
      state.schedule = [{ id: 'media-long-report', project: a, date: '2026-09-12', title: '가상 긴 작업', workers: 2, report: { done: '가상 방수 도막 작업과 배관 연결 상태를 확인한 기록입니다. '.repeat(30), material: '가상 자재 투입 내역과 작업 구간 기록입니다. '.repeat(12), issue: '가상 특이사항과 다음 작업에서 확인할 내용입니다. '.repeat(12), actualWorkers: 2, progress: '진행중', weather: '맑음' } }];
    }, A);
    const before = await snap(t.page); await imageStub(t); await t.page.evaluate(() => exportReport('media-long-report', false));
    assert.deepEqual((await t.page.evaluate(() => window.__mediaLoads)).sort(), ['p1', 'p2', 'p3', 'p4']);
    const bounds = await t.page.evaluate(() => window.__mediaBounds);
    assert.equal(bounds.length, 4, 'all four real image elements are drawn');
    assert(bounds.every(b => b.top >= 0 && b.bottom < b.canvasHeight - 80), 'every photo ends above the footer and canvas boundary: ' + JSON.stringify(bounds));
    assert((await t.page.evaluate(() => window.__mediaExports[0].height)) > 1400, 'long work text and four images increase canvas height');
    assert(await t.page.evaluate(() => window.__mediaImageUrls.length === 4 && window.__mediaImageUrls.every(u => window.__mediaRevoked.includes(u)))); await readonly(t, before);
  });

  assert(passed > 0, 'at least one selected scenario ran');
  console.log('PASS photo-report-media: ' + passed + ' scenarios' + (ONLY ? ' (focused: ' + ONLY + ')' : '') + '; synthetic records only; no original/account/server mutations');
  await browser.close();
})().catch(async e => { console.error('FAIL photo-report-media', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

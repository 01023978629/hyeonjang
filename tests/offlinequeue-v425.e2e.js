/* Synthetic data only. HJ_V425_BASELINE=8e9fdfe must fail OUTBOX_API_PRESENT.
   HJ_V425_MUTATION=online-handler must fail ONLINE_EVENT_DRAINS_FIFO.
   All cloud replies are mocked; no customer data, messages or real upload. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const ROOT = path.resolve(__dirname, '..');
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const MOCK = ORIGIN + '/__v425_relay', PROJECT = 'TEST_OFFLINE_LEAK_PROJECT';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V425_BASELINE && execFileSync('git', ['show', process.env.HJ_V425_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const shellPaths = text => { const hit = text.match(/const SHELL_PATHS=new Set\(\[([\s\S]*?)\]\);/); assert(hit, 'SW_SHELL_PATHS_PRESENT'); return hit[1].replace(/\s/g, ''); };
const baseSW = execFileSync('git', ['show', '8e9fdfe:sw.js'], { cwd: ROOT, encoding: 'utf8' });
let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [], cache = new Map(), requests = [], driveRequests = [];
  // Windows Chromium resets its renderer online flag on navigation even while context traffic is offline.
  // Keep real traffic blocked by setOffline and refresh the DevTools network state; never mock navigator.onLine.
  const networkState = await context.newCDPSession(page);
  await networkState.send('Network.enable');
  const refreshNetworkState = value => networkState.send('Network.overrideNetworkState', { offline: value, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const setOffline = async value => { await context.setOffline(value); await refreshNetworkState(value); };
  let offline = false, failUploads = false, revision = 0, realWrites = 0, driveMock = false, saveReceipt = null;
  page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(String(e)));
  const dismiss = dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss();
  page.on('dialog', dismiss);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (request.url() === MOCK) {
      if (offline) return route.abort('internetdisconnected');
      const body = JSON.parse(request.postData() || '{}');
      const rows = await page.evaluate(async () => typeof hjOutboxRead === 'function' ? await hjOutboxRead() : []);
      requests.push({ action: body.action, name: body.payload?.name || '', head: rows[0]?.id || null });
      if (failUploads && body.action === 'upload') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"TEST_HTTP_500"}' });
      let response = { ok: true, revision: ++revision, savedAt: new Date().toISOString() };
      if (body.action === 'save' && saveReceipt) Object.assign(response, saveReceipt);
      if (body.action === 'upload') Object.assign(response, { fileId: 'TEST_DRIVE_' + revision, mimeType: 'image/jpeg', size: 100 });
      if (body.action === 'load') response.data = null;
      if (body.action === 'listFiles') response.files = [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
    }
    if (driveMock && url.origin === 'https://www.googleapis.com') {
      if (offline) return route.abort('internetdisconnected');
      const body = request.postDataBuffer(), json = request.method() === 'POST' ? JSON.parse(body?.toString() || '{}') : null;
      driveRequests.push({ method: request.method(), path: url.pathname, query: url.searchParams.get('q') || '', json, bytes: body ? [...body] : [] });
      if (read && url.pathname === '/drive/v3/files') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"files":[{"id":"TEST_PHOTO_FOLDER"}]}' });
      if (request.method() === 'POST' && url.pathname === '/drive/v3/files') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"TEST_DIRECT_DRIVE_PHOTO"}' });
      if (request.method() === 'PATCH' && url.pathname === '/upload/drive/v3/files/TEST_DIRECT_DRIVE_PHOTO') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"TEST_DIRECT_DRIVE_PHOTO"}' });
      throw Error('UNEXPECTED_MOCK_DRIVE_ROUTE: ' + request.method() + ' ' + url.pathname);
    }
    if (url.origin === ORIGIN && read) {
      if (url.pathname === '/__v425_seed') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>synthetic IDB seed</title>' });
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      // Offline restart receives the exact previously loaded shell bytes, not a
      // substituted app implementation. navigator.onLine remains false.
      if (offline) return cache.has(request.url()) ? route.fulfill(cache.get(request.url())) : route.abort('internetdisconnected');
      const response = await route.fetch();
      const cached = { status: response.status(), headers: response.headers(), body: await response.body() };
      cache.set(request.url(), cached); return route.fulfill(cached);
    }
    if (!read) realWrites++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(({ mutation }) => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v425External = 0; window.__v425RemovedOnline = { outbox: 0, legacy: 0 };
    window.open = () => { __v425External++; return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { __v425External++; } });
    if (mutation === 'online-handler') {
      const add = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, callback, options) {
        if (this === window && type === 'online') {
          const source = String(callback), direct = /hjOutboxOnline/.test(source), legacy = /cloudFlushQueue/.test(source);
          if (direct || legacy) { if (direct) __v425RemovedOnline.outbox++; if (legacy) __v425RemovedOnline.legacy++; return; }
        }
        return add.call(this, type, callback, options);
      };
    }
  }, { mutation: process.env.HJ_V425_MUTATION || '' });
  if (process.env.HJ_V425_MUTATION) assert.equal(process.env.HJ_V425_MUTATION, 'online-handler');
  await page.goto(ORIGIN + '/__v425_seed');
  await page.evaluate(async bytes => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('hyeonjang-share', 1); r.onupgradeneeded = () => r.result.createObjectStore('inbox', { keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { await new Promise((resolve, reject) => { const tx = db.transaction('inbox', 'readwrite'); tx.objectStore('inbox').put({ id: 'TEST_LEGACY_ACCEPTED', at: Date.now(), name: 'TEST_LEGACY.png', type: 'image/png', size: bytes.length, blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }), acceptedRecordId: 'TEST_LEGACY_REC' }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('TEST_LEGACY_ABORT')); }); } finally { db.close(); }
  }, [...PNG]);
  async function boot() {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await refreshNetworkState(offline);
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(k => !!window[k]), BOOT);
    await page.evaluate(async keys => {
      await Promise.all(keys.map(k => window[k])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
      if (window.__hjOutboxUiBootDone) await __hjOutboxUiBootDone;
      aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
      if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V425_BOOT_SEEDERS_NOT_READY');
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    }, BOOT);
    assert.equal(await page.evaluate(() => typeof hjOutboxRead === 'function' && typeof hjOutboxFlush === 'function' && typeof hjOutboxView === 'function'), true, 'OUTBOX_API_PRESENT');
  }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  async function test(name, fn) { await fn(); passed++; console.log('PASS offlinequeue-v425 ' + name); }
  async function rows() { return page.evaluate(() => hjOutboxRead()); }
  const compactRows = items => JSON.stringify(items.map(r => ({ kind: r.kind, status: r.status, tries: r.tries, error: r.lastError })));
  async function pollRows(predicate) {
    const deadline = Date.now() + 12000;
    let observed;
    do {
      observed = await rows();
      if (predicate(observed) || Date.now() >= deadline) return observed;
      await new Promise(resolve => setTimeout(resolve, Math.min(50, deadline - Date.now())));
    } while (Date.now() <= deadline);
    return observed;
  }
  async function waitCount(count, label) {
    const observed = await pollRows(items => items.length === count);
    assert.equal(observed.length, count, label + ': expected ' + count + ', rows=' + compactRows(observed));
  }
  async function shot(name) { if (process.env.HJ_V425_SHOTS) { fs.mkdirSync(process.env.HJ_V425_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.HJ_V425_SHOTS, name + '.png'), animations: 'disabled' }); } }
  async function snapshot() { return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(), stored = await idbGetStrict('appState'); live.savedAt = ''; if (stored) stored.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(stored) }; }); }
  function sameSnapshot(a, b, label) { const changed = []; for (const part of ['live', 'stored']) { if (a[part] === b[part]) continue; const x = JSON.parse(a[part]), y = JSON.parse(b[part]); for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) if (Object.hasOwn(x, key) !== Object.hasOwn(y, key) || JSON.stringify(x[key]) !== JSON.stringify(y[key])) changed.push(part + '.' + key); } assert.deepEqual(changed, [], label + ' (changed field names only)'); }
  async function originalFacts() { return page.evaluate(async () => Promise.all(state.files.filter(f => f.kind === 'photo').map(async f => { const blob = await getFileOf(f); return { name: f.name, project: f.project, work: f._worklabel, phase: f._phase, tag: hjPhotoLeakTag(f), token: f._shareInboxId, bytes: [...new Uint8Array(await blob.arrayBuffer())] }; }))); }
  async function addPhotos(count, start, project = PROJECT) {
    await close();
    await page.evaluate(({ bytes, count, start, project }) => {
      const files = Array.from({ length: count }, (_, i) => new File([new Uint8Array([...bytes, start + i])], 'TEST_OFFLINE_' + (start + i) + '.png', { type: 'image/png', lastModified: 1792112400000 + i }));
      window.__v425PhotoDone = new Promise(resolve => { openPhotoIntake(files, { project, source: 'gallery', onRecord: (_file, rec) => { rec._phase = 'TEST_OFFLINE_PHASE'; }, onComplete: resolve, onCancel: () => resolve({ error: 'TEST_CANCELLED' }) }); });
    }, { bytes: [...PNG], count, start, project });
    await page.locator('#photoIntakeWork').fill('TEST_OFFLINE_WORK'); await page.locator('[data-intake-leaktag="cause"]').click();
    await page.locator('#photoIntakeConfirm').click();
    const result = await page.evaluate(async () => { const r = await __v425PhotoDone; return { added: r.pairs?.length, saved: r.metadataSaved, error: r.error, readFailed: r.readFailed, report: r.report }; });
    assert.equal(result.added, count); assert.equal(result.saved, true); assert.equal(result.error, ''); assert.deepEqual(result.readFailed, []);
    result.text = await page.locator('#photoIntakeResult').innerText(); await close(); return result;
  }
  await boot();
  const keys = await page.evaluate(() => Object.keys(serializeData()).sort());
  let originals, fifo;
  await test('v1 accepted inbox blob survives v2 outbox migration', async () => {
    const fact = await page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const r = indexedDB.open('hyeonjang-share'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); try { const row = await new Promise((resolve, reject) => { const r = db.transaction('inbox').objectStore('inbox').get('TEST_LEGACY_ACCEPTED'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); return { version: db.version, stores: [...db.objectStoreNames].sort(), id: row.acceptedRecordId, bytes: [...new Uint8Array(await row.blob.arrayBuffer())] }; } finally { db.close(); } });
    assert.equal(fact.version, 2); assert.deepEqual(fact.stores, ['inbox', 'outbox']); assert.equal(fact.id, 'TEST_LEGACY_REC'); assert.deepEqual(Buffer.from(fact.bytes), PNG);
    await page.evaluate(async project => {
      __tabStale = false; __appVersionUpdating = false; state._demo = false; state.dirHandle = null;
      for (const key of ['files', 'notes', 'schedule', 'quotes', 'payLog', 'asLog', 'contacts']) state[key] = [];
      state.projects = [{ name: project, kind: 'leak', stage: 1, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
      state.activeProject = project; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V425_SEED_SAVE_FAILED');
    }, PROJECT);
  });
  await test('offline real photo, worklog and detection saves create five durable rows', async () => {
    offline = true; await setOffline(true); assert.equal(await page.evaluate(() => navigator.onLine), false);
    await page.evaluate(mock => { __relay.url = mock; __relay.token = 'TEST_OFFLINE_TOKEN'; }, MOCK);
    await addPhotos(3, 1);
    await page.evaluate(project => voiceWorkLog(project), PROJECT); await page.locator('#wlText').fill('TEST_OFFLINE_WORKLOG'); await page.getByRole('button', { name: '💾 일지 저장', exact: true }).click();
    await page.waitForFunction(() => state.schedule.some(s => s.report?.done === 'TEST_OFFLINE_WORKLOG') && !document.getElementById('wlText')); await close();
    await page.evaluate(project => hjLeakDetectView(project), PROJECT);
    await page.locator('[data-leak-method="청음"]').click(); await page.locator('#hjLeakCause').selectOption('온수관'); await page.locator('#hjLeakZone').selectOption('전유부');
    await page.locator('#hjLeakPlace').fill('TEST_OFFLINE_DETECT_PLACE'); await page.locator('#hjLeakDetectSave').click(); await page.locator('#hjLeakStay').waitFor({ state: 'visible' }); await page.locator('#hjLeakStay').click();
    await waitCount(5, 'OFFLINE_FIVE_RECORDS'); fifo = (await rows()).map(r => r.id);
    assert.deepEqual((await rows()).map(r => r.kind), ['file', 'file', 'file', 'note', 'detect']); assert((await rows()).every(r => r.status === 'ready' && r.tries === 0));
    const saved = await page.evaluate(async () => { const d = await idbGetStrict('appState'); return { photos: d.files.filter(f => f.kind === 'photo'), note: d.schedule.find(s => s.report?.done === 'TEST_OFFLINE_WORKLOG'), detect: d.projects[0].leak.detect }; });
    assert.equal(saved.photos.length, 3); assert(saved.photos.every(f => f.shareInboxId && f.phase === 'TEST_OFFLINE_PHASE' && f.leaktag === 'cause')); assert(saved.note); assert.equal(saved.detect.place, 'TEST_OFFLINE_DETECT_PLACE');
    originals = await originalFacts(); assert.equal(originals.length, 3); assert(originals.every(f => f.token && f.project === PROJECT && f.work === 'TEST_OFFLINE_WORK' && f.phase === 'TEST_OFFLINE_PHASE' && f.tag === 'cause'));
    for (let i = 0; i < originals.length; i++) assert.deepEqual(Buffer.from(originals[i].bytes), Buffer.concat([PNG, Buffer.from([i + 1])]));
    await page.waitForFunction(() => /오프라인/.test(document.getElementById('hjNetBar')?.textContent || '') && /3/.test(document.getElementById('hjNetBar')?.textContent || '')); await shot('01-offline-five');
  });
  await test('unpersisted record intent cannot become a sendable queue row', async () => {
    const before = await snapshot();
    const staged = await page.evaluate(async project => {
      const record = { id: 'TEST_UNSAVED_WORKLOG', project, date: localDate(), report: { done: 'TEST_NOT_PERSISTED', progress: '진행' } };
      const id = await hjOutboxStage('note', record.id, record); await hjOutboxCommit([id]);
      const row = (await hjOutboxRead()).find(r => r.id === id); await hjOutboxRemove(id); return row;
    }, PROJECT);
    assert.equal(staged.status, 'staged'); assert.equal(staged.tries, 0); sameSnapshot(await snapshot(), before, 'uncommitted intent'); assert.deepEqual((await rows()).map(r => r.id), fifo);
  });
  await test('offline restart restores original bytes, labels and queue without new items', async () => {
    await close(); await boot(); assert.equal(await page.evaluate(() => navigator.onLine), false);
    assert.deepEqual((await rows()).map(r => r.id), fifo); assert.deepEqual(await originalFacts(), originals);
    assert.equal(await page.evaluate(() => state.schedule.filter(s => s.report?.done === 'TEST_OFFLINE_WORKLOG').length), 1);
    await page.evaluate(mock => { __relay.url = mock; __relay.token = 'TEST_OFFLINE_TOKEN'; }, MOCK);
  });
  await test('pending photos feed report groups without changing saved app data', async () => {
    const before = await snapshot();
    const result = await page.evaluate(project => { const d = hjReportDraft(project), groups = hjReportPhotoGroups(state.files); aptReportView(project); return { photos: d.photos, works: d.works, groups: groups.map(g => ({ tag: g.leakTag, count: g.photos.length })) }; }, PROJECT);
    assert.equal(result.photos, 3); assert.deepEqual(result.groups, [{ tag: 'cause', count: 3 }]);
    assert.equal(await page.locator('#rpWorks').inputValue(), result.works.join('\n'));
    await page.evaluate(() => { window.__v425ReportOriginal = buildAptReportPDF; buildAptReportPDF = async options => { const bytes = await Promise.all(options.photos.map(async f => [...new Uint8Array(await (await getFileOf(f)).arrayBuffer())])); window.__v425Report = { count: options.photos.length, bytes }; return { pages: 1, photos: options.photos.length }; }; });
    try { await page.getByRole('button', { name: '📄 PDF 만들기', exact: true }).click(); await page.waitForFunction(() => !!window.__v425Report); const report = await page.evaluate(() => __v425Report); assert.equal(report.count, 3); assert.deepEqual(report.bytes, originals.map(f => f.bytes)); }
    finally { await page.evaluate(() => { buildAptReportPDF = __v425ReportOriginal; }); }
    sameSnapshot(await snapshot(), before, 'report read and renderer input'); await close();
  });
  await test('online event drains the original five rows in FIFO order', async () => {
    const readDrift = () => page.evaluate(async () => {
      const saved = await hjOutboxSaved(), live = serializeData(), paths = [];
      const walk = (a, b, path) => { if (path === 'savedAt' || paidStableJson(a) === paidStableJson(b)) return; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], path ? path + '.' + key : key); } else paths.push(path); };
      walk(live, saved, ''); return paths;
    });
    assert.deepEqual(await readDrift(), [], 'OUTBOX_LIVE_SAVED_MATCH (field paths only)');
    if (process.env.HJ_V425_MUTATION) assert(await page.evaluate(() => __v425RemovedOnline.outbox > 0 && __v425RemovedOnline.legacy > 0), 'mutation must remove direct online and legacy online-to-outbox paths');
    const start = requests.length; offline = false; await setOffline(false);
    const remaining = await pollRows(items => items.length === 0);
    assert.equal(remaining.length, 0, 'ONLINE_EVENT_DRAINS_FIFO: online event must drain all five saved records, rows=' + compactRows(remaining) + ', driftPaths=' + JSON.stringify(await readDrift()));
    const sent = requests.slice(start).filter(r => ['upload', 'save'].includes(r.action));
    assert.deepEqual([...new Set(sent.map(r => r.head).filter(Boolean))], fifo, 'FIFO applies to all file/note/detect rows');
    assert.deepEqual(sent.filter(r => r.action === 'upload').map(r => r.name), ['TEST_OFFLINE_1.png', 'TEST_OFFLINE_2.png', 'TEST_OFFLINE_3.png']);
    assert.equal(await page.evaluate(() => state.files.filter(f => f._driveId).length), 3); assert.deepEqual(await originalFacts(), originals, 'successful cloud sync must retain local originals');
  });
  await test('HTTP500 reaches five attempts, stops automatic retry, and manual UI retries', async () => {
    offline = true; await setOffline(true); await addPhotos(1, 4); await waitCount(1, 'RETRY_PHOTO_QUEUED');
    failUploads = true; offline = false; await setOffline(false);
    const firstFailure = await pollRows(items => items.length === 1 && items[0].tries === 1);
    assert.equal(firstFailure.length, 1, 'HTTP_500_FIRST_ATTEMPT: rows=' + compactRows(firstFailure));
    assert.equal(firstFailure[0].tries, 1, 'HTTP_500_FIRST_ATTEMPT: rows=' + compactRows(firstFailure));
    await page.waitForFunction(() => !__hjOutboxFlushing && !__hjOutboxUiSending);
    for (let tries = 2; tries <= 5; tries++) { await page.evaluate(() => hjOutboxFlush()); assert.equal((await rows())[0].tries, tries); }
    const failed = (await rows())[0]; assert.equal(failed.status, 'manual'); assert.match(failed.lastError, /500/);
    const n = requests.length; await page.evaluate(() => hjOutboxFlush()); assert.equal(requests.length, n, 'automatic retry must stop at five');
    await page.evaluate(() => hjOutboxView()); await page.locator('#hjOutboxView').waitFor({ state: 'visible' }); assert.match(await page.locator('#hjOutboxView').innerText(), /수동/); await shot('02-manual-retry');
    failUploads = false; await page.locator('#hjOutboxRetry').click(); await waitCount(0, 'MANUAL_RETRY_DRAINS'); await close();
  });
  await test('removing one queue row requires confirmation and preserves app record and blob', async () => {
    offline = true; await setOffline(true); await addPhotos(1, 5); await waitCount(1, 'REMOVE_PHOTO_QUEUED');
    const before = await snapshot(), bytes = await originalFacts(); await page.evaluate(() => hjOutboxView()); await page.locator('#hjOutboxView').waitFor({ state: 'visible' });
    const sizes = await page.locator('#hjOutboxView button:visible, #hjOutboxRetry:visible').evaluateAll(nodes => nodes.map(n => ({ id: n.id, w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height })));
    assert(sizes.length >= 2); assert(sizes.every(s => s.w >= 44 && s.h >= 44), JSON.stringify(sizes)); assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1)); await shot('03-outbox-remove');
    page.off('dialog', dismiss); let confirmation = '';
    const answered = new Promise((resolve, reject) => page.once('dialog', async dialog => { try { assert.equal(dialog.type(), 'confirm'); confirmation = dialog.message(); assert.match(confirmation, /원본|사진/); await dialog.accept(); resolve(); } catch (e) { await dialog.dismiss(); reject(e); } }));
    try { await page.locator('[data-outbox-remove]').click(); await answered; } finally { page.on('dialog', dismiss); }
    assert(confirmation); await waitCount(0, 'REMOVE_QUEUE_ONLY'); sameSnapshot(await snapshot(), before, 'remove must not change app records'); assert.deepEqual(await originalFacts(), bytes, 'remove must keep original blobs'); await close();
    await boot(); assert.deepEqual(await originalFacts(), bytes, 'removed queue original remains available after restart');
  });
  await test('direct Drive upload retains the company photo folder for an apostrophe project name', async () => {
    const name = "TEST_O'BRIEN_LEAK_PROJECT";
    await page.evaluate(async project => {
      state.projects.push({ name: project, kind: 'leak', stage: 1, phases: [], customer: {}, received: 0, cost: { material: 0, labor: 0, outsource: 0 } });
      state.activeProject = project; render(); clearTimeout(__idbSaveTimer); if (!await guardedPersistCurrentState()) throw Error('TEST_DRIVE_PROJECT_SAVE');
      __relay.url = ''; __relay.token = ''; __gdToken = 'TEST_DRIVE_TOKEN'; __gdFolderId = 'TEST_COMPANY_ROOT'; window.__gdSub = {};
    }, name);
    await addPhotos(1, 6, name); await waitCount(1, 'DRIVE_PHOTO_QUEUED');
    driveMock = true; offline = false; await setOffline(false); await waitCount(0, 'DIRECT_DRIVE_UPLOAD');
    assert.equal(driveRequests.filter(r => r.method === 'GET').length, 1);
    assert.match(driveRequests[0].query, /name='현장사진'/); assert(!driveRequests[0].query.includes(name), 'project name must not become a Drive folder query');
    const create = driveRequests.find(r => r.method === 'POST'); assert(create); assert.deepEqual(create.json.parents, ['TEST_PHOTO_FOLDER']); assert.equal(create.json.name, 'TEST_OFFLINE_6.png');
    const upload = driveRequests.find(r => r.method === 'PATCH'); assert(upload); assert.deepEqual(Buffer.from(upload.bytes), Buffer.concat([PNG, Buffer.from([6])]));
    assert.equal(await page.evaluate(() => state.files.find(f => f.name === 'TEST_OFFLINE_6.png')._driveId), 'TEST_DIRECT_DRIVE_PHOTO');
    await page.waitForFunction(() => !__hjOutboxFlushing && !__hjOutboxUiSending); driveMock = false;
    await page.evaluate(() => { __gdToken = null; __gdFolderId = null; window.__gdSub = {}; });
  });
  await test('relay save receipt restores revision after restart without resending saved state', async () => {
    offline = true; await setOffline(true);
    await page.evaluate(async mock => { __relay.url = mock; __relay.token = 'TEST_OFFLINE_TOKEN'; __relay.rev = 100; await idbSet('relay_rev', 100); }, MOCK);
    await page.evaluate(project => voiceWorkLog(project), PROJECT); await page.locator('#wlText').fill('TEST_RECEIPT_WORKLOG'); await page.getByRole('button', { name: '💾 일지 저장', exact: true }).click();
    await page.waitForFunction(() => !document.getElementById('wlText')); await close(); await waitCount(1, 'RECEIPT_NOTE_QUEUED');
    await page.evaluate(() => { window.__v425RealIdbSet = idbSet; idbSet = function (key, value) { if (key === 'relay_rev') return Promise.reject(Error('TEST_RELAY_REV_WRITE_FAILED')); return __v425RealIdbSet(key, value); }; });
    saveReceipt = { revision: 777, savedAt: '2026-10-16T04:00:00.000Z' };
    const before = requests.filter(r => r.action === 'save').length; offline = false; await setOffline(false);
    const held = await pollRows(items => items.length === 1 && items[0].receipt?.backend === 'relay-state' && items[0].receipt.revision === 777 && !items[0].claim);
    assert.equal(held.length, 1, 'RELAY_STATE_RECEIPT_RETAINED: rows=' + compactRows(held)); assert.equal(held[0].receipt?.revision, 777); assert.equal(held[0].receipt.savedAt, saveReceipt.savedAt);
    await page.waitForFunction(() => !__hjOutboxFlushing && !__hjOutboxUiSending); assert.equal(requests.filter(r => r.action === 'save').length - before, 1);
    offline = true; await setOffline(true); await boot();
    assert.equal(await page.evaluate(() => idbGetStrict('relay_rev')), 100); assert.equal((await rows())[0].receipt.revision, 777);
    await page.evaluate(mock => { __relay.url = mock; __relay.token = 'TEST_OFFLINE_TOKEN'; __relay.rev = 100; }, MOCK);
    const sends = requests.filter(r => r.action === 'save').length; offline = false; await setOffline(false); await waitCount(0, 'RELAY_RECEIPT_ACK_AFTER_RESTART');
    assert.equal(requests.filter(r => r.action === 'save').length, sends, 'receipt ACK must not repeat the successful save HTTP request');
    const restored = await page.evaluate(async () => ({ live: __relay.rev, stored: await idbGetStrict('relay_rev'), time: await idbGetStrict('relay_syncAt') }));
    assert.deepEqual(restored, { live: 777, stored: 777, time: saveReceipt.savedAt }); saveReceipt = null;
  });
  await test('31 photographs retain every original and accurately report 30 queued plus one excluded', async () => {
    offline = true; await setOffline(true); const result = await addPhotos(31, 100); await waitCount(30, 'THIRTY_ITEM_QUEUE_LIMIT');
    assert.equal(result.report.ok, 0); assert.equal(result.report.queued, 30); assert.equal(result.report.excluded, 1); assert.equal(result.report.excludedFiles.length, 1);
    assert.match(result.text, /자동 전송 대기 제외\s*1장/); assert.match(result.text, /전송 대기\s*30장/);
    const kept = (await originalFacts()).filter(f => /^TEST_OFFLINE_1\d\d\.png$/.test(f.name)); assert.equal(kept.length, 31);
    for (const file of kept) assert.deepEqual(Buffer.from(file.bytes), Buffer.concat([PNG, Buffer.from([Number(file.name.match(/_(\d+)\.png$/)[1])])]));
    const queued = await rows(), excluded = kept.filter(f => !queued.some(row => row.ref === f.token)); assert.equal(excluded.length, 1); assert.equal(excluded[0].name, 'TEST_OFFLINE_100.png');
    await page.evaluate(async () => { for (const row of await hjOutboxRead()) await hjOutboxRemove(row.id); }); await waitCount(0, 'LIMIT_TEST_QUEUE_REMOVAL_ONLY');
    await boot(); assert.deepEqual((await originalFacts()).filter(f => /^TEST_OFFLINE_1\d\d\.png$/.test(f.name)), kept, 'queue eviction and removal must not delete any of the 31 original blobs');
  });
  await test('serialization, shell allowlist, menu126 and external side effects remain unchanged', async () => {
    const before = await snapshot(); await page.evaluate(() => openGdriveSetup()); await page.locator('#hjOutboxOpen').waitFor({ state: 'visible' });
    assert((await page.locator('#hjOutboxOpen').boundingBox()).height >= 44); await page.locator('#hjOutboxOpen').click();
    await page.locator('[data-outbox-empty]').waitFor({ state: 'visible' }); assert.match(await page.locator('#hjOutboxView').innerText(), /기기 사진 다시 올리기/);
    const choose = page.waitForEvent('filechooser'); await page.locator('#hjOutboxRestorePhotos').click(); await (await choose).setFiles([]);
    await close(); sameSnapshot(await snapshot(), before, 'settings, empty queue and cancelled photo picker');
    assert.deepEqual(await page.evaluate(() => Object.keys(serializeData()).sort()), keys);
    assert.equal(shellPaths(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')), shellPaths(baseSW));
    assert.equal(await page.evaluate(() => new Set(MORE_CATS.flatMap(c => c.items.map(i => i[0]))).size), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= 390)); assert.equal(realWrites, 0); assert.equal(await page.evaluate(() => __v425External), 0); assert.deepEqual(errors, []);
  });
  await context.close();
  // This separate cold-install scenario starts a fresh browser network service;
  // the previous scenario intentionally used DevTools offline emulation.
  await browser.close();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  await test('real installed service worker supports cold-shell offline reload with the original photo', async () => {
    const swURL = new URL(APP); swURL.hostname = 'localhost';
    const swContext = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul', serviceWorkers: 'allow' });
    const swPage = await swContext.newPage(), swErrors = []; let blockedWrites = 0;
    swPage.setDefaultTimeout(12000); swPage.on('dialog', dismiss); swPage.on('pageerror', e => swErrors.push(String(e)));
    // No response cache, index substitution or route.fulfill in this context:
    // offline HTML/scripts must come from the real installed service worker.
    // Intercept external URLs only at context level. Pausing the worker's own
    // same-origin install fetches can deadlock Chromium's installation network.
    await swContext.route(url => url.origin !== swURL.origin, route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) blockedWrites++;
      return route.abort('blockedbyclient');
    });
    // The localhost test server is read-only; observe unexpected local writes
    // without pausing its shell requests. All external traffic stays blocked.
    swContext.on('request', request => {
      if (new URL(request.url()).origin === swURL.origin && !['GET', 'HEAD'].includes(request.method())) blockedWrites++;
    });
    await swPage.addInitScript(() => {
      localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
      window.__v425SwExternal = 0; window.open = () => { __v425SwExternal++; return null; };
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { __v425SwExternal++; } });
    });
    async function swBoot() {
      await swPage.waitForFunction(keys => typeof serializeData === 'function' && keys.every(k => !!window[k]), BOOT);
      await swPage.evaluate(async keys => { await Promise.all(keys.map(k => window[k])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; if (window.__hjOutboxUiBootDone) await __hjOutboxUiBootDone; aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure(); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; }, BOOT);
    }
    try {
      await swPage.goto(swURL.href, { waitUntil: 'domcontentloaded' }); await swBoot();
      await swPage.waitForFunction(() => !!navigator.serviceWorker.controller);
      const warm = await swPage.evaluate(async () => { const registration = await navigator.serviceWorker.ready; const names = await caches.keys(); const cache = await caches.open('hyeonjang-v425-offlinequeue'); return { active: registration.active?.state, cachedIndex: !!await cache.match(new URL('index.html', location.href).href), names }; });
      assert.equal(warm.active, 'activated'); assert.equal(warm.cachedIndex, true, 'SW_INSTALL_WARMS_INDEX_BEFORE_OFFLINE_RESTART');
      const swNetworkState = await swContext.newCDPSession(swPage); await swNetworkState.send('Network.enable');
      await swPage.evaluate(async () => {
        closeModal(true); __tabStale = false; __appVersionUpdating = false; state._demo = false; state.dirHandle = null;
        for (const key of ['files', 'notes', 'schedule', 'quotes', 'payLog', 'asLog', 'contacts']) state[key] = [];
        state.projects = [{ name: 'TEST_SW_LEAK_PROJECT', kind: 'leak', stage: 1, phases: [], customer: {}, received: 0, cost: { material: 0, labor: 0, outsource: 0 } }];
        state.activeProject = 'TEST_SW_LEAK_PROJECT'; __relay.url = ''; __relay.token = ''; __gdToken = null; render(); clearTimeout(__idbSaveTimer);
        if (!await guardedPersistCurrentState()) throw Error('TEST_SW_SEED_SAVE_FAILED');
      });
      await swContext.setOffline(true);
      const saved = await swPage.evaluate(async bytes => {
        const file = new File([new Uint8Array(bytes)], 'TEST_SW_ORIGINAL.png', { type: 'image/png', lastModified: 1792112400000 });
        const outcome = await runPhotoIntake([file], { project: 'TEST_SW_LEAK_PROJECT', workLabel: 'TEST_SW_WORK', leakTag: 'cause', onRecord: (_file, rec) => { rec._phase = 'TEST_SW_PHASE'; } });
        closeModal(true); return { saved: outcome.metadataSaved, error: outcome.error, count: outcome.pairs.length };
      }, [...PNG]);
      assert.deepEqual(saved, { saved: true, error: '', count: 1 });
      await swPage.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
      const fact = async () => swPage.evaluate(async () => { const rec = state.files[0], blob = await getFileOf(rec); return { count: state.files.length, project: rec.project, work: rec._worklabel, phase: rec._phase, tag: hjPhotoLeakTag(rec), token: rec._shareInboxId, bytes: [...new Uint8Array(await blob.arrayBuffer())], queue: (await hjOutboxRead()).map(r => ({ id: r.id, kind: r.kind, ref: r.ref })) }; });
      const before = await fact(); assert.equal(before.queue.length, 1); assert.deepEqual(Buffer.from(before.bytes), PNG);
      await swPage.reload({ waitUntil: 'domcontentloaded' });
      await swNetworkState.send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await swBoot();
      assert.equal(await swPage.evaluate(() => navigator.onLine), false); assert.deepEqual(await fact(), before, 'REAL_SW_OFFLINE_RELOAD_PRESERVES_ORIGINAL_AND_LINKS');
      assert.equal(blockedWrites, 0); assert.equal(await swPage.evaluate(() => __v425SwExternal), 0); assert.deepEqual(swErrors, []);
    } finally { await swContext.close(); }
  });
  await browser.close(); console.log('offlinequeue-v425: ' + passed + '/' + passed + ' passed');
})().catch(async e => { console.error('FAIL offlinequeue-v425', e.stack || e); if (browser) await browser.close(); process.exitCode = 1; });

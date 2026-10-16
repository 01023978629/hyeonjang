/* v416: synthetic share inbox only. No customer data, real sharing, or uploads.
   HJ_V416_BASELINE=1531627 serves the old index and must fail SHARE_INBOX_API_PRESENT.
   HJ_V416_SHOTS writes optional 390px screenshots to a caller-provided directory. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const PROJECT = 'TEST_SHARE_PROJECT';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const PNG_TWO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const originalBytes = id => String(id).startsWith('TEST_SHARE_TWO') ? PNG_TWO : PNG;
const MODIFIED = Date.parse('2026-09-08T01:02:03.000Z');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V416_BASELINE && execFileSync('git', ['show', process.env.HJ_V416_BASELINE + ':index.html'], {
  cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024
});
let browser, passed = 0;
const contexts = [], observed = [], network = { blocked: 0, nonRead: 0 };

async function test(name, fn) { await fn(); passed++; console.log('PASS shareinbox-v416 ' + name); }
async function boot(page, url = APP) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
  assert.equal(await page.evaluate(() => !!window.HJShareInbox && typeof HJShareInbox.check === 'function'), true, 'SHARE_INBOX_API_PRESENT');
  await page.evaluate(async () => { if (window.__hjShareInboxBootDone) await window.__hjShareInboxBootDone; });
  await page.evaluate(async () => {
    if (typeof aiOpsEnsureState === 'function') aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
}
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  contexts.push(ctx);
  await ctx.route('**/*', route => {
    const req = route.request(), url = new URL(req.url()), read = ['GET', 'HEAD'].includes(req.method());
    if (read && url.origin === ORIGIN) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    network.blocked++; if (!read) network.nonRead++;
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage(), errors = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(String(error)));
  // The suite deliberately restarts a dirty intake page to verify durable
  // originals. Only that navigation warning is accepted automatically;
  // destructive confirmation dialogs still default to cancellation.
  const dialogHandler = dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss();
  page.on('dialog', dialogHandler);
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v416SideEffects = { opened: 0, shared: 0, picked: [] };
    window.open = () => { window.__v416SideEffects.opened++; return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__v416SideEffects.shared++; } });
    // Simulate the browser refusing an automatic picker without user activation.
    // The actual fallback button must still be visible and usable.
    const nativeClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function (...args) {
      if (this.type === 'file') { window.__v416SideEffects.picked.push({ capture: this.getAttribute('capture'), accept: this.accept }); return; }
      return nativeClick.apply(this, args);
    };
  });
  await boot(page);
  return { ctx, page, errors, dialogHandler };
}
async function close(page) {
  await page.evaluate(() => closeModal(true));
  await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
}
async function seedProject(page) {
  await close(page);
  return page.evaluate(async name => {
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    state._demo = false; state.dirHandle = null; state.files = [];
    state.projects = [{ name, stage: 1, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
    state.activeProject = null; state.tab = 'photos'; state.search = ''; state.dirty = false;
    __tabStale = false; __photoCache.key = null; __sel.clear(); __selMode = false;
    __relay.url = ''; __relay.token = ''; __gdToken = null;
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    if (!(await guardedPersistCurrentState())) throw new Error('TEST_PROJECT_SAVE_FAILED');
    return Object.keys(serializeData()).sort();
  }, PROJECT);
}
async function putRows(page, rows) {
  await page.evaluate(async ({ rows, bytes, bytesTwo }) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('hyeonjang-share'); // Use the installed schema; new fixture DBs still start at v1.
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('inbox')) req.result.createObjectStore('inbox', { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('inbox', 'readwrite'), store = tx.objectStore('inbox');
        for (const row of rows) {
          const value = { ...row };
          if (row.kind !== 'share-meta') value.blob = new Blob([Uint8Array.from(String(row.id).startsWith('TEST_SHARE_TWO') ? bytesTwo : bytes)], { type: row.type || 'image/png' });
          store.put(value);
        }
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('TEST_INBOX_ABORT'));
      });
    } finally { db.close(); }
  }, { rows, bytes: [...PNG], bytesTwo: [...PNG_TWO] });
}
function photo(id, offset = 0, extra = {}) {
  return { id, batchId: 'TEST_SHARE_BATCH', at: Date.now() + offset, name: id + '.png', type: 'image/png', size: originalBytes(id).length,
    lastModified: MODIFIED, title: 'TEST_SHARE_TITLE', text: 'TEST_SHARE_TEXT', ...extra };
}
async function rows(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('hyeonjang-share'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    try {
      const all = await new Promise((resolve, reject) => {
        const req = db.transaction('inbox', 'readonly').objectStore('inbox').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      return Promise.all(all.map(async row => ({ ...row, blob: !!row.blob, bytes: row.blob ? [...new Uint8Array(await row.blob.arrayBuffer())] : null })));
    } finally { db.close(); }
  });
}
function pending(items) { return items.filter(row => row.blob && !row.acceptedRecordId); }
async function snapshot(page) {
  return page.evaluate(async () => {
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const data = serializeData(); data.savedAt = '';
    return { live: JSON.stringify(data), stored: JSON.stringify(await idbGetStrict('appState')) };
  });
}
async function show(page) {
  await close(page);
  await page.evaluate(() => HJShareInbox.check({ force: true }));
  await page.locator('#hjShareInbox').waitFor({ state: 'visible' });
}
async function selectProject(page) {
  const option = page.locator('#hjShareProject option').filter({ hasText: PROJECT });
  await page.locator('#hjShareProject').selectOption(await option.getAttribute('value'));
  await page.locator('#hjShareImport').click();
  await page.locator('#photoIntakeForm').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#photoIntakeProject option:checked').textContent(), PROJECT);
}
async function done(page) {
  return page.evaluate(async () => {
    if (!window.__hjShareInboxLastDone) throw new Error('TEST_INBOX_COMPLETION_SIGNAL_MISSING');
    return await window.__hjShareInboxLastDone;
  });
}
async function shot(page, name) {
  if (!process.env.HJ_V416_SHOTS) return;
  fs.mkdirSync(process.env.HJ_V416_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(process.env.HJ_V416_SHOTS, name + '.png'), animations: 'disabled', fullPage: false });
}
async function finish(item) {
  observed.push({ errors: item.errors, side: await item.page.evaluate(() => __v416SideEffects) });
  await item.ctx.close();
}
async function discardDialog(item, accept) {
  item.page.removeListener('dialog', item.dialogHandler);
  let dialog;
  try {
    // hjShareDiscard reads IDB before showing confirm, so click completion is
    // not the confirmation boundary. Register first and await the real dialog.
    const event = item.page.waitForEvent('dialog');
    const click = item.page.locator('#hjShareDiscard').click();
    dialog = await event;
    assert.equal(dialog.type(), 'confirm', 'discard must use an explicit confirmation');
    assert.match(dialog.message(), /버릴|삭제/);
    if (accept) await dialog.accept(); else await dialog.dismiss();
    await click;
  } catch (error) {
    if (dialog) await dialog.dismiss().catch(() => {});
    throw error;
  } finally {
    item.page.on('dialog', item.dialogHandler);
  }
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const main = await fresh(), page = main.page, keys = await seedProject(page);
  await test('reading inbox preserves live and stored app data; boot opens two thumbnails', async () => {
    const before = await snapshot(page);
    await putRows(page, [photo('TEST_SHARE_ONE'), photo('TEST_SHARE_TWO'), {
      id: 'TEST_SHARE_META', batchId: 'TEST_SHARE_BATCH', kind: 'share-meta', at: Date.now(), droppedCount: 3,
      reasonCounts: { type: 1, count: 1, size: 1 }, title: 'TEST_SHARE_TITLE', text: 'TEST_SHARE_TEXT'
    }]);
    await show(page);
    assert.deepEqual(await snapshot(page), before, 'inbox viewing must not write serialized app data');
    await boot(page, APP + '?view=shareinbox');
    await page.locator('#hjShareInbox').waitFor({ state: 'visible' });
    assert.match(await page.locator('#modalRoot').innerText(), /공유받은 사진\s*2장/);
    assert.match(await page.locator('#hjShareInbox').innerText(), /3/);
    assert.equal(await page.locator('#hjShareInbox img').count(), 2, 'share-meta is not a third photograph');
    await page.waitForFunction(() => [...document.querySelectorAll('#hjShareInbox img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(new URL(page.url()).searchParams.has('view'), false, 'processed view must not repeat on reload');
    const sizes = await page.locator('#hjShareProject, #hjShareImport, #hjShareLater, #hjShareDiscard').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(); return { id: node.id, width: r.width, height: r.height };
    }));
    assert.equal(sizes.length, 4); assert(sizes.every(size => size.width >= 44 && size.height >= 44), JSON.stringify(sizes));
    assert(await page.locator('#modalRoot .modal').evaluate(node => node.scrollWidth <= node.clientWidth + 1), '390px modal must not overflow');
    await shot(page, '01-share-inbox');
  });
  await test('later and visibility return preserve original bytes and metadata', async () => {
    const before = await rows(page), appBefore = await snapshot(page);
    await page.locator('#hjShareLater').click();
    await page.waitForFunction(() => !document.getElementById('hjShareInbox'));
    assert.deepEqual(await rows(page), before);
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.locator('#hjShareInbox').waitFor({ state: 'visible' });
    assert.deepEqual(await snapshot(page), appBefore);
    assert.deepEqual(await rows(page), before);
  });
  await test('intake cancellation releases claim and keeps both pending originals', async () => {
    const before = await snapshot(page);
    await selectProject(page);
    await page.locator('#photoIntakeWork').fill('TEST_SHARE_WORK');
    await page.locator('#photoIntakeCancel').click();
    assert.equal((await done(page)).status, 'cancelled');
    const items = pending(await rows(page)); assert.equal(items.length, 2);
    for (const row of items) { assert.deepEqual(Buffer.from(row.bytes), originalBytes(row.id)); assert.equal(row.acceptedRecordId, undefined); assert.equal(row.claim, undefined, 'cancel must release its atomic claim'); }
    assert.deepEqual(await snapshot(page), before);
  });
  await test('failed metadata save leaves recoverable pending rows', async () => {
    await page.evaluate(() => {
      window.__v416Intake = { calls: [], failSave: true, saveCalls: 0 };
      const realIngest = ingestFile, realSave = guardedPersistCurrentState;
      ingestFile = async function (file, ...args) {
        __v416Intake.calls.push({ name: file.name, type: file.type, lastModified: file.lastModified, isFile: file instanceof File });
        return realIngest.call(this, file, ...args);
      };
      guardedPersistCurrentState = async function (...args) {
        __v416Intake.saveCalls++;
        return __v416Intake.failSave ? false : realSave.apply(this, args);
      };
    });
    await show(page); await selectProject(page);
    await page.locator('#photoIntakeWork').fill('TEST_SHARE_WORK');
    await page.locator('#photoIntakeConfirm').click();
    const result = await done(page);
    assert.equal(result.status, 'failed');
    assert.match(await page.locator('#photoIntakeResult').innerText(), /저장/);
    const items = pending(await rows(page)); assert.equal(items.length, 2);
    for (const row of items) {
      assert.deepEqual(Buffer.from(row.bytes), originalBytes(row.id)); assert.equal(row.acceptedRecordId, undefined);
      assert.equal(row.claim, undefined, 'failed metadata completion must release its claim');
      assert.equal(typeof row.stagedRecordId, 'string', 'retry remembers the exact staged record');
    }
    const calls = await page.evaluate(() => __v416Intake.calls);
    assert.equal(calls.length, 2); assert(calls.every(call => call.isFile && call.type === 'image/png' && call.lastModified === MODIFIED));
    assert.equal(await page.evaluate(async () => (await idbGetStrict('appState')).files.length), 0, 'failed metadata save must not falsely publish accepted records');
    await page.evaluate(() => { clearTimeout(__idbSaveTimer); __tabStale = false; __v416Intake.failSave = false; });
  });
  await test('successful real PNG retry stores metadata once and retains accepted blobs', async () => {
    await show(page); await selectProject(page);
    await page.locator('#photoIntakeWork').fill('TEST_SHARE_WORK');
    await page.locator('#photoIntakeConfirm').click();
    assert.equal((await done(page)).status, 'complete');
    const items = await rows(page), accepted = items.filter(row => row.acceptedRecordId);
    assert.equal(pending(items).length, 0); assert.equal(accepted.length, 2, 'successful import keeps original blob receipts');
    for (const row of accepted) { assert.deepEqual(Buffer.from(row.bytes), originalBytes(row.id)); assert.equal(row.claim, undefined); }
    const facts = await page.evaluate(async () => ({
      calls: __v416Intake.calls, files: state.files.map(file => ({ id: file.id, name: file.name, project: file.project, work: file._worklabel, when: +file.when, local: file._file instanceof Blob })),
      saved: await idbGetStrict('appState'), keys: Object.keys(serializeData()).sort()
    }));
    assert.equal(facts.calls.length, 2, 'retry after a metadata failure must not ingest the same originals twice');
    assert.equal(facts.files.length, 2); assert.equal(facts.saved.files.length, 2); assert.deepEqual(facts.keys, keys);
    for (const file of facts.files) {
      assert.equal(file.project, PROJECT); assert.equal(file.work, 'TEST_SHARE_WORK'); assert.equal(file.when, MODIFIED); assert.equal(file.local, true);
      assert(accepted.some(row => row.acceptedRecordId === file.id));
    }
    for (const file of facts.saved.files) {
      const row = accepted.find(item => item.name === file.name);
      assert.equal(file.shareInboxId, row.id, 'per-file receipt identity must survive changing runtime record IDs');
    }
    assert(facts.saved.files.every(file => !Object.hasOwn(file, '_file') && !Object.hasOwn(file, 'blob')), 'original bytes must remain outside serialized app data');
    await shot(page, '02-share-added');
    // Also cover a tab closing after appState committed but before inbox ACK.
    // On restore a new runtime ID must still recover the same durable token,
    // rather than ingest a second copy or strand the original.
    await putRows(page, [photo('TEST_SHARE_ONE', 0, {
      stagedRecordId: accepted.find(row => row.id === 'TEST_SHARE_ONE').acceptedRecordId,
      claim: { owner: 'TEST_COMMITTED_CLOSED_TAB', phase: 'importing', at: Date.now() - 20 * 60000, expiresAt: Date.now() - 60000 }
    })]);
    assert.equal(pending(await rows(page)).length, 1, 'interrupted ACK fixture must really be pending before reload');
    await boot(page);
    const restored = await page.evaluate(async () => Promise.all(state.files.map(async file => ({
      id: file.id, name: file.name, project: file.project, work: file._worklabel,
      local: file._file instanceof Blob, originalName: file._file?.name, bytes: file._file ? [...new Uint8Array(await file._file.arrayBuffer())] : null
    }))));
    assert.equal(restored.length, 2, 'saved metadata survives a new page');
    for (const file of restored) {
      assert.equal(file.local, true, 'accepted original is reconnected after restore');
      assert.equal(file.originalName, file.name); assert.deepEqual(Buffer.from(file.bytes), originalBytes(file.name)); assert.equal(file.work, 'TEST_SHARE_WORK');
    }
    const fallback = await page.evaluate(async () => {
      const rec = state.files[0]; rec._file = null;
      const file = await getFileOf(rec);
      return { name: rec.name, originalName: file?.name, bytes: file ? [...new Uint8Array(await file.arrayBuffer())] : null };
    });
    assert.equal(fallback.originalName, fallback.name); assert.deepEqual(Buffer.from(fallback.bytes), originalBytes(fallback.name), 'original access recovers from the inbox receipt without network');
    assert.equal(pending(await rows(page)).length, 0);
    // An un-dismissed dropped-file notice may remain, but accepted originals
    // must never appear in the pending thumbnail grid again.
    assert.equal(await page.locator('#hjShareInbox img').count(), 0, 'accepted originals are not offered for import again');
  });
  await finish(main);
  const expiry = await fresh();
  await test('boot expires only pending originals older than seven days', async () => {
    await putRows(expiry.page, [photo('TEST_EXPIRED', -8 * 86400000), photo('TEST_RECENT'), photo('TEST_ACCEPTED_OLD', -8 * 86400000, { acceptedRecordId: 'TEST_EXISTING_RECORD' })]);
    await boot(expiry.page, APP + '?view=shareinbox');
    const items = await rows(expiry.page);
    assert(!items.some(row => row.id === 'TEST_EXPIRED'));
    assert(items.some(row => row.id === 'TEST_ACCEPTED_OLD' && row.blob), 'expiry must never delete accepted original storage');
    assert.deepEqual(pending(items).map(row => row.id), ['TEST_RECENT']);
    assert.match(await expiry.page.locator('#toast').innerText(), /7일|오래|기간/);
  });
  await test('discard requires confirmation and cannot delete accepted originals', async () => {
    const before = await rows(expiry.page);
    await discardDialog(expiry, false);
    assert.deepEqual(await rows(expiry.page), before, 'discard cancellation keeps every original');
    await discardDialog(expiry, true);
    await expiry.page.evaluate(async () => {
      const end = Date.now() + 10000;
      while (Date.now() < end) {
        const items = await HJShareInbox.read();
        if (!items.some(row => row.blob && !row.acceptedRecordId)) return;
        await new Promise(requestAnimationFrame);
      }
      throw Error('TEST_CONFIRMED_DISCARD_DID_NOT_FINISH');
    });
    const after = await rows(expiry.page);
    assert.equal(pending(after).length, 0);
    const accepted = after.find(row => row.id === 'TEST_ACCEPTED_OLD');
    assert(accepted && accepted.acceptedRecordId === 'TEST_EXISTING_RECORD');
    assert.deepEqual(Buffer.from(accepted.bytes), PNG);
  });
  await test('interrupted importing claim can retry without losing its original', async () => {
    await seedProject(expiry.page);
    await putRows(expiry.page, [photo('TEST_INTERRUPTED', 0, {
      stagedRecordId: 'TEST_LOST_RUNTIME_RECORD',
      claim: { owner: 'TEST_CLOSED_TAB', phase: 'importing', at: Date.now() - 20 * 60000, expiresAt: Date.now() - 60000 }
    })]);
    // The old tab ingested into memory but never committed appState. The inbox
    // original must outlive that tab and its expired in-progress claim.
    await boot(expiry.page, APP + '?view=shareinbox');
    assert.equal(pending(await rows(expiry.page)).length, 1);
    await selectProject(expiry.page);
    await expiry.page.locator('#photoIntakeWork').fill('TEST_CRASH_RECOVERY');
    await expiry.page.locator('#photoIntakeConfirm').click();
    assert.equal((await done(expiry.page)).status, 'complete', 'expired importing claim must not lock the original forever');
    const recovered = await rows(expiry.page), receipt = recovered.find(row => row.id === 'TEST_INTERRUPTED');
    assert.equal(pending(recovered).length, 0); assert.equal(receipt.claim, undefined); assert.equal(typeof receipt.acceptedRecordId, 'string');
    assert.deepEqual(Buffer.from(receipt.bytes), PNG);
    const actual = await expiry.page.evaluate(async () => ({
      count: state.files.length, receipt: state.files[0]?._shareInboxId,
      bytes: state.files[0]?._file ? [...new Uint8Array(await state.files[0]._file.arrayBuffer())] : null,
      saved: (await idbGetStrict('appState')).files.length
    }));
    assert.equal(actual.count, 1); assert.equal(actual.saved, 1); assert.equal(actual.receipt, 'TEST_INTERRUPTED'); assert.deepEqual(Buffer.from(actual.bytes), PNG);
  });
  await finish(expiry);
  const capture = await fresh();
  await test('capture shortcut has a 44px fallback, cleans query and keeps menu count', async () => {
    await boot(capture.page, APP + '?view=photos&capture=1');
    assert.equal(await capture.page.evaluate(() => state.tab), 'photos');
    // Keep the existing unassigned-photo guard: on a fresh empty profile the
    // shortcut first asks for a project, rather than silently assigning one.
    await capture.page.locator('#cameraUnassigned').waitFor({ state: 'visible' });
    await capture.page.locator('#cameraUnassigned').click();
    await capture.page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
    await capture.page.locator('#hjShareCapture').waitFor({ state: 'visible' });
    assert.match(await capture.page.locator('#hjShareCapture').innerText(), /지금 찍기/);
    const size = await capture.page.locator('#hjShareCapture').boundingBox(); assert(size.height >= 44 && size.width >= 44);
    assert.equal(new URL(capture.page.url()).searchParams.has('view'), false); assert.equal(new URL(capture.page.url()).searchParams.has('capture'), false);
    const before = await capture.page.evaluate(() => __v416SideEffects.picked.length);
    assert(before >= 1, 'shortcut must reach the real camera input after project choice');
    await capture.page.locator('#hjShareCapture').click();
    await capture.page.locator('#cameraUnassigned').click();
    await capture.page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
    const picks = await capture.page.evaluate(() => __v416SideEffects.picked);
    assert(picks.length > before); assert(picks.some(pick => pick.capture === 'environment'), 'camera shortcut must use the environment camera input');
    assert.equal(await capture.page.evaluate(() => MORE_CATS.reduce((total, cat) => total + cat.items.length, 0)), 126);
    assert(await capture.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390px document must not overflow');
    await shot(capture.page, '03-camera-fallback');
  });
  await finish(capture);
  await test('no external writes, sharing, customer data or page errors', async () => {
    for (const item of observed) {
      assert.deepEqual(item.errors, []);
      assert.equal(item.side.opened, 0); assert.equal(item.side.shared, 0);
    }
    assert.equal(network.nonRead, 0, 'no POST/upload request may be attempted');
  });
  console.log(`shareinbox-v416: ${passed}/${passed} PASS; synthetic originals only; external writes=0`);
})().catch(error => { console.error('FAIL shareinbox-v416', error.stack || error); process.exitCode = 1; })
  .finally(async () => { for (const ctx of contexts) await ctx.close(); if (browser) await browser.close(); });

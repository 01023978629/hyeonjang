/* v297 media safety: isolated synthetic files, fresh browser storage, no live I/O.
   Exercises the public UI/API rather than duplicating their implementation.
   The ordinary run-all.js runner discovers this file automatically.
   HJ_MEDIA_SAFETY_CASE restricts local development runs to matching case names. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const FILTER = process.env.HJ_MEDIA_SAFETY_CASE || '';
const MUTATION = process.env.HJ_MEDIA_SAFETY_MUTATION || '';
const mutations = {
  snapshot: { file: 'index.html', before: "if(await hjSnapshot('사진 '+refs.length+'장 삭제 전',true)!==true)",
    after: "if(await hjSnapshot('사진 '+refs.length+'장 삭제 전',true)===true)" },
  hash: { file: 'media-safety.js', before: "if(rec._originalSha256&&rec._originalSha256!==sha256)fail('file-mismatch');",
    after: "if(false)fail('file-mismatch');", firstOnly: true },
  retry: { file: 'media-safety.js', before: 'if(hits.length){chosen=hits[0];return rows;}',
    after: 'if(false){chosen=hits[0];return rows;}' },
  'offset-alignment': { file: 'media-safety.js', before: 'function uploadState(r,job){',
    after: "function uploadState(r,job){if(r.offset!==job.size&&r.offset%262144)fail('invalid-response');" },
  connection: { file: 'media-safety.js', before: "async function call(c,action,payload){\n    if(!sameConnection(c))fail('connection-changed');\n    let timer,r;\n    try{r=await Promise.race([relayCall(action,payload),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unconfirmed')),45000);})]);}finally{clearTimeout(timer);}\n    if(!sameConnection(c))fail('connection-changed');",
    after: "async function call(c,action,payload){\n    let timer,r;\n    try{r=await Promise.race([relayCall(action,payload),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unconfirmed')),45000);})]);}finally{clearTimeout(timer);}" }
};
let changedSource;
if (MUTATION) {
  const selected = mutations[MUTATION]; assert(selected, 'unknown HJ_MEDIA_SAFETY_MUTATION');
  const original = fs.readFileSync(path.join(__dirname, '..', selected.file), 'utf8').replace(/\r\n/g, '\n');
  const occurrences = original.split(selected.before).length - 1;
  assert(selected.firstOnly ? occurrences > 0 : occurrences === 1, 'mutation target must be present and unambiguous');
  changedSource = original.replace(selected.before, selected.after);
  console.log('MUTATION ' + MUTATION + ' (memory response only; non-zero exit required)');
}
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const PROJECT = 'TEST_MEDIA_PROJECT';
let browser, passed = 0;

async function boot() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url());
    if (MUTATION && url.origin === ORIGIN && url.pathname === '/' + mutations[MUTATION].file) {
      return route.fulfill({ status: 200, contentType: mutations[MUTATION].file.endsWith('.js') ? 'text/javascript' : 'text/html', body: changedSource });
    }
    return url.origin === ORIGIN && req.method() === 'GET' ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_ver_checked_at', String(Date.now()));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async ({ png, project }) => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const bytes = Uint8Array.from(atob(png), x => x.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    const file = new File([bytes], 'TEST_ORIGINAL.png', { type: 'image/png', lastModified: Date.UTC(2026, 8, 1) });
    const makeRecord = (id, extra = {}) => ({ id, name: file.name, kind: 'photo', ext: 'png', size: file.size,
      project, _worklabel: 'TEST_WORK_LABEL', _phase: 'TEST_PHASE', _aptUnit: { project, unitId: 'TEST_UNIT' },
      when: new Date('2026-08-30T00:00:00.000Z'), sourceModifiedAt: new Date(file.lastModified).toISOString(),
      prefix: 'TEST_FOLDER/', text: 'TEST_EXISTING_OCR', ocr: 'done', thumb: 'data:image/png;base64,' + png,
      _file: null, _virtual: true, _originalSha256: hash, ...extra });
    state.projects = [{ name: project, stage: 1, phases: [], customer: {}, archived: false, received: 0,
      cost: { material: 0, labor: 0, outsource: 0 }, aptUnits: [{ id: 'TEST_UNIT', dong: '101', ho: '201' }] }];
    state.files = [makeRecord('TEST_PHOTO'), makeRecord('TEST_OTHER', { name: 'TEST_OTHER.png', _driveId: 'TEST_REMOTE_OTHER' })];
    state.activeProject = project; state.tab = 'photos'; state.search = '';
    state.dirHandle = null; state._demo = false; state.dirty = false;
    __photoCache.key = null; __sel.clear(); __sel.add('TEST_PHOTO'); __selMode = true; __tabStale = false;
    __removedIds.clear(); __removedIds.add('TEST_OLD_REMOVED');
    __relay.url = ''; __relay.token = ''; __gdToken = null;
    window.__mediaTest = { file, bytes, hash, makeRecord, messages: [], calls: [], revoked: [], snapshotCalls: [],
      projectJson: JSON.stringify(state.projects), original: { hjSnapshot, revokeThumbUrl, relayCall } };
    const nativeToast = toast;
    toast = message => { window.__mediaTest.messages.push(String(message)); return nativeToast(message); };
    const nativeRevoke = revokeThumbUrl;
    revokeThumbUrl = record => { window.__mediaTest.revoked.push(record.id); return nativeRevoke(record); };
    window.__mediaTest.capture = () => JSON.stringify({ files: state.files, projects: state.projects,
      active: state.activeProject, dirty: state.dirty, selected: [...__sel], mode: __selMode, removed: [...__removedIds] });
    window.__mediaTest.refs = state.files.slice();
    render(); syncMobileNav();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  }, { png: PNG, project: PROJECT });
  return { context, page, errors };
}

async function scenario(name, fn) {
  if (FILTER && !name.includes(FILTER)) return;
  const test = await boot();
  try {
    if (!name.startsWith('delete')) await test.page.waitForFunction(() => !!window.HJMedia);
    await fn(test.page);
    assert.deepEqual(test.errors, [], 'no unhandled page errors');
    passed++; console.log('PASS media-safety ' + name);
  } catch (error) {
    console.error('DETAIL', await test.page.evaluate(() => ({ messages: window.__mediaTest.messages,
      recordIds: state.files.map(f => f.id), dirty: state.dirty, stale: __tabStale })).catch(() => ({})));
    throw error;
  } finally { await test.context.close(); }
}

async function seedDeletion(page, mode) {
  await page.evaluate(mode => {
    const t = window.__mediaTest;
    state.files[0]._driveId = 'TEST_REMOTE_SELECTED';
    t.before = t.capture(); t.refs = state.files.slice();
    if (mode === 'persist-fail') {
      const nativePut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) {
        if (key === 'appState') throw new DOMException('TEST_APPSTATE_WRITE_FAILURE', 'QuotaExceededError');
        return nativePut.apply(this, arguments);
      };
    }
    hjSnapshot = async (label, force, allowEmpty) => {
      if (!String(label).includes('삭제 전')) return t.original.hjSnapshot(label, force, allowEmpty);
      t.snapshotCalls.push({ label, force, allowEmpty });
      if (mode === 'false') return false;
      if (mode === 'throw') throw new Error('TEST_SNAPSHOT_FAILURE');
      if (mode === 'truthy') return { ok: true };
      if (mode === 'pending') return new Promise(resolve => { t.releaseSnapshot = resolve; });
      return t.original.hjSnapshot(label, force, allowEmpty);
    };
    deleteSelectedPhotos();
  }, mode);
  await page.locator('#modalRoot .mfoot button.warn').waitFor({ state: 'visible' });
}

async function assertDeletionPreserved(page, beforeKey = 'before') {
  const state = await page.evaluate(key => {
    const t = window.__mediaTest;
    return { unchanged: t.capture() === t[key], refs: state.files.every((f, i) => f === t.refs[i]),
      selected: [...__sel], removed: [...__removedIds], revoked: t.revoked, snapshots: t.snapshotCalls };
  }, beforeKey);
  assert.equal(state.unchanged, true, 'failed deletion preserves records, project, dirty state and selection');
  assert.equal(state.refs, true, 'failed deletion preserves live record objects');
  assert.deepEqual(state.selected, ['TEST_PHOTO']);
  assert.deepEqual(state.removed, ['TEST_OLD_REMOVED']);
  assert.deepEqual(state.revoked, [], 'failed deletion does not revoke usable thumbnail URLs');
  assert.equal(state.snapshots.length, 1);
  assert.equal(state.snapshots[0].force, true);
}

async function prepareUpload(page, mode = '') {
  await page.evaluate(async mode => {
    const t = window.__mediaTest;
    const bytes = new Uint8Array(1048576 + 13);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    bytes.set([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    const file = new File([bytes], 'TEST_ORIGINAL_VIDEO.mp4', { type: 'video/mp4', lastModified: t.file.lastModified });
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    const rec = t.makeRecord('TEST_VIDEO', { name: file.name, ext: 'mp4', size: file.size, _file: file,
      _originalSha256: sha256, thumb: null, ocr: 'na' });
    state.files.push(rec);
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST_MEDIA/exec';
    __relay.token = 'TEST_MEDIA_TOKEN_A'; __relay.device = 'TEST_MEDIA_DEVICE';
    relayReady = () => true;
    t.mode = mode; t.video = rec; t.uploadBytes = bytes;
    if (mode === 'partial-43') t.receivedBytes = new Uint8Array(bytes.length);
    if (mode === 'hung-chunk') {
      // Accelerate only the media request deadline. All normal UI, storage and
      // application timers retain their actual timing and completion signals.
      const nativeSet = window.setTimeout.bind(window), nativeClear = window.clearTimeout.bind(window);
      t.deadlines = { scheduled: 0, fired: 0, active: new Set() };
      window.setTimeout = function(fn, delay, ...args) {
        if (delay !== 45000) return nativeSet(fn, delay, ...args);
        const id = nativeSet(() => { t.deadlines.fired++; fn(...args); }, 25);
        t.deadlines.scheduled++; t.deadlines.active.add(id); return id;
      };
      window.clearTimeout = function(id) { t.deadlines.active.delete(id); return nativeClear(id); };
    }
    t.server = { uploadId: '', offset: 0, complete: false, begins: 0, creates: 0, failed: false, chunks: [], calls: [] };
    const version = 'media-relay-v1';
    const metadata = () => ({ fileId: 'TEST_CONFIRMED_REMOTE_VIDEO', name: file.name, mimeType: file.type,
      size: file.size, sha256, md5Checksum: 'TEST_MD5_CHECKSUM', verified: true });
    const response = () => ({ ok: true, version, uploadId: t.server.uploadId,
      state: t.server.complete ? 'complete' : 'uploading', offset: t.server.offset,
      size: file.size, chunkBytes: 1048576, ...(t.server.complete ? { file: metadata() } : {}) });
    relayCall = async (action, payload) => {
      const server = t.server;
      server.calls.push({ action, uploadId: payload && payload.uploadId, offset: payload && payload.offset,
        token: __relay.token });
      if (action === 'mediaHealth') return mode === 'old-server' ? { ok: true } : {
        ok: true, version, maxFileBytes: 104857600, chunkBytes: 1048576, alignmentBytes: 262144,
        mimeTypes: ['image/png', 'image/jpeg', 'video/mp4'] };
      if (action === 'mediaInspect') return { ok: true, version, file: metadata() };
      if (action === 'mediaUploadBegin') {
        server.begins++;
        if (server.uploadId && server.uploadId !== payload.uploadId) throw new Error('TEST_DUPLICATE_UPLOAD_ID');
        if (payload.sha256 !== sha256 || payload.size !== file.size || payload.mimeType !== file.type) throw new Error('TEST_BEGIN_METADATA_MISMATCH');
        server.uploadId = payload.uploadId;
        if (mode === 'token-change') return new Promise(resolve => { t.releaseBegin = () => resolve(response()); });
        return response();
      }
      if (action === 'mediaUploadStatus') {
        if (payload.uploadId !== server.uploadId) throw new Error('TEST_STATUS_UPLOAD_ID_MISMATCH');
        return response();
      }
      if (action === 'mediaUploadChunk') {
        if (payload.uploadId !== server.uploadId || payload.offset !== server.offset) throw new Error('TEST_CHUNK_ID_OFFSET_MISMATCH');
        if ((mode === 'middle-failure' || mode === 'partial-43') && server.offset > 0 && !server.failed) {
          server.failed = true; throw new Error('TEST_NETWORK_INTERRUPTED');
        }
        const chunk = Uint8Array.from(atob(payload.dataB64), c => c.charCodeAt(0));
        if (!chunk.length || chunk.length > 1048576 || server.offset + chunk.length > bytes.length) throw new Error('TEST_CHUNK_SIZE_MISMATCH');
        for (let i = 0; i < chunk.length; i++) if (chunk[i] !== bytes[server.offset + i]) throw new Error('TEST_WRONG_ORIGINAL_BYTES');
        if (mode === 'partial-43' && server.offset === 0) {
          // A valid resumable server may acknowledge only a prefix of the
          // submitted chunk. Its byte offset is not an alignment boundary.
          t.receivedBytes.set(chunk.subarray(0, 43), 0);
          server.chunks.push({ offset: 0, size: 43, uploadId: payload.uploadId });
          server.offset = 43; return response();
        }
        if (mode === 'partial-43') t.receivedBytes.set(chunk, server.offset);
        server.chunks.push({ offset: server.offset, size: chunk.length, uploadId: payload.uploadId });
        server.offset += chunk.length;
        if (server.offset === bytes.length) {
          server.complete = true; server.creates++;
          if (mode === 'partial-43') {
            server.receivedSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', t.receivedBytes))]
              .map(x => x.toString(16).padStart(2, '0')).join('');
          }
          if (mode === 'complete-response-lost' && !server.failed) {
            server.failed = true; throw new Error('TEST_COMPLETION_RESPONSE_LOST');
          }
        }
        if (mode === 'hung-chunk' && !server.failed) {
          server.failed = true;
          return new Promise(resolve => { t.releaseChunk = () => resolve(response()); });
        }
        return response();
      }
      throw new Error('TEST_UNEXPECTED_RELAY_ACTION:' + action);
    };
    t.beforeUpload = JSON.stringify({ files: state.files.map(f => [f.id, f.name, f.project, f._worklabel, f._phase, f._aptUnit, f.when]),
      projects: state.projects, selected: [...__sel] });
  }, mode);
}

async function uploadFacts(page) {
  return page.evaluate(async () => {
    const t = window.__mediaTest;
    const q = await idbGetStrict(HJMedia.queueKey || 'hj_media_jobs_v1');
    const live = state.files.find(f => f.id === 'TEST_VIDEO');
    return { driveId: live._driveId || '', size: live._driveSize || 0, count: state.files.length,
      queue: q, server: t.server, sameRecord: state.files.filter(f => f.id === 'TEST_VIDEO').length === 1,
      unchanged: t.beforeUpload === JSON.stringify({ files: state.files.map(f => [f.id, f.name, f.project, f._worklabel, f._phase, f._aptUnit, f.when]),
        projects: state.projects, selected: [...__sel] }) };
  });
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  for (const mode of ['false', 'throw', 'truthy', 'persist-fail']) await scenario('delete snapshot ' + mode, async page => {
    await seedDeletion(page, mode);
    await page.locator('#modalRoot .mfoot button.warn').click();
    await page.waitForFunction(() => window.__mediaTest.snapshotCalls.length === 1 && window.__mediaTest.messages.length > 0);
    await assertDeletionPreserved(page);
    assert.match(await page.evaluate(() => window.__mediaTest.messages.join('\n')), /중단|실패|안전|백업|스냅샷|저장/);
  });

  await scenario('delete record replacement while snapshot pending', async page => {
    await seedDeletion(page, 'pending');
    await page.locator('#modalRoot .mfoot button.warn').click();
    await page.waitForFunction(() => !!window.__mediaTest.releaseSnapshot);
    await page.evaluate(() => {
      const t = window.__mediaTest;
      state.files = state.files.map(f => ({ ...f, _worklabel: 'TEST_NEWER_RECORD' }));
      t.refs = state.files.slice(); t.afterReplacement = t.capture();
      t.releaseSnapshot(true);
    });
    await page.waitForFunction(() => window.__mediaTest.messages.length > 0);
    await assertDeletionPreserved(page, 'afterReplacement');
  });

  await scenario('delete successful snapshot contains removed record', async page => {
    await seedDeletion(page, 'success');
    await page.locator('#modalRoot .mfoot button.warn').click();
    await page.waitForFunction(() => !state.files.some(f => f.id === 'TEST_PHOTO'));
    const out = await page.evaluate(async () => ({ ids: state.files.map(f => f.id), selected: [...__sel],
      snaps: await idbGetStrict('hj_snaps'), project: JSON.stringify(state.projects) === window.__mediaTest.projectJson,
      preservedFile: window.__mediaTest.file.size > 0 }));
    assert.deepEqual(out.ids, ['TEST_OTHER']); assert.deepEqual(out.selected, []);
    assert(out.project && out.preservedFile);
    assert(out.snaps.some(s => s.data.files.some(f => f.name === 'TEST_ORIGINAL.png')), 'recovery snapshot contains the deleted record');
  });

  await scenario('delete single PC-linked photo always preserves its original', async page => {
    await page.evaluate(() => {
      const t = window.__mediaTest;
      t.originalDeletes = 0;
      state.files[0].handle = { kind: 'file', getFile: async () => t.file };
      canEditFiles = () => true;
      deleteOriginal = async () => { t.originalDeletes++; throw new Error('TEST_ORIGINAL_MUST_NOT_BE_DELETED'); };
      deletePhoto('TEST_PHOTO');
    });
    await page.locator('#modalRoot .mfoot button.warn').click();
    await page.waitForFunction(() => !state.files.some(f => f.id === 'TEST_PHOTO'));
    assert.equal(await page.evaluate(() => window.__mediaTest.originalDeletes), 0);
    assert.equal(await page.evaluate(() => window.__mediaTest.file.size), Buffer.from(PNG, 'base64').length);
  });

  await scenario('reconnect same original preserves metadata and record identity', async page => {
    const out = await page.evaluate(async () => {
      const t = window.__mediaTest, rec = state.files[0];
      const before = Object.fromEntries(Object.entries(rec).filter(([key]) => key !== '_file'));
      const result = await HJMedia.reconnect(rec.id, t.file);
      const live = state.files.find(f => f.id === rec.id);
      return { ok: result.ok, error: result.error, count: state.files.length, identity: state.files.filter(f => f.id === rec.id).length === 1,
        fileIdentity: live._file === t.file, metadata: Object.keys(before).filter(key => !['_virtual', 'handle'].includes(key)).every(key => JSON.stringify(live[key]) === JSON.stringify(before[key])),
        project: JSON.stringify(state.projects) === t.projectJson, selected: [...__sel] };
    });
    assert.equal(out.ok, true, JSON.stringify(out)); assert.equal(out.count, 2);
    assert(out.identity && out.fileIdentity && out.metadata && out.project, 'reconnect only binds the chosen File to the original record');
    assert.deepEqual(out.selected, ['TEST_PHOTO']);
  });

  for (const mismatch of ['name', 'size', 'hash']) await scenario('reconnect rejects ' + mismatch + ' mismatch', async page => {
    const out = await page.evaluate(async mismatch => {
      const t = window.__mediaTest, rec = state.files[0], before = t.capture();
      const bytes = new Uint8Array(t.bytes);
      if (mismatch === 'hash') bytes[bytes.length - 1] ^= 1;
      const bad = new File([bytes, ...(mismatch === 'size' ? [new Uint8Array([1])] : [])],
        mismatch === 'name' ? 'TEST_DIFFERENT_NAME.png' : t.file.name,
        { type: 'image/png', lastModified: t.file.lastModified });
      const result = await HJMedia.reconnect(rec.id, bad);
      return { ok: result.ok, error: result.error, unchanged: t.capture() === before, ref: state.files[0] === rec };
    }, mismatch);
    assert.equal(out.ok, false, JSON.stringify(out)); assert(out.error);
    assert(out.unchanged && out.ref, 'a rejected source must not overwrite metadata or bind a wrong file');
  });

  await scenario('reconnect ambiguous metadata without expected hash', async page => {
    const out = await page.evaluate(async () => {
      const t = window.__mediaTest;
      delete state.files[0]._originalSha256;
      state.files.push(t.makeRecord('TEST_AMBIGUOUS', { _originalSha256: undefined, project: 'TEST_OTHER_PROJECT' }));
      const before = t.capture();
      const result = await HJMedia.reconnect('TEST_PHOTO', t.file);
      return { ok: result.ok, error: result.error, unchanged: t.capture() === before };
    });
    assert.equal(out.ok, false, JSON.stringify(out)); assert(out.error && out.unchanged);
  });

  await scenario('reconnect stale record after file reading is rejected', async page => {
    await page.evaluate(() => {
      const t = window.__mediaTest;
      const file = new File([t.bytes], t.file.name, { type: t.file.type, lastModified: t.file.lastModified });
      file.arrayBuffer = () => new Promise(resolve => { t.releaseRead = () => resolve(t.bytes.buffer); });
      HJMedia.reconnect('TEST_PHOTO', file).then(result => { t.reconnectResult = result; });
    });
    await page.waitForFunction(() => !!window.__mediaTest.releaseRead);
    await page.evaluate(() => {
      const t = window.__mediaTest;
      state.files = state.files.map(f => ({ ...f, _worklabel: 'TEST_NEWER_WORK_LABEL' }));
      t.afterReplacement = t.capture(); t.releaseRead();
    });
    await page.waitForFunction(() => !!window.__mediaTest.reconnectResult);
    const out = await page.evaluate(() => ({ result: window.__mediaTest.reconnectResult,
      unchanged: window.__mediaTest.capture() === window.__mediaTest.afterReplacement }));
    assert.equal(out.result.ok, false); assert(out.unchanged);
  });

  await scenario('reconnect optional source metadata survives backup and old snapshot clears it', async page => {
    const out = await page.evaluate(() => {
      const t = window.__mediaTest, rec = state.files[0];
      rec._mediaOriginal = { fileId: 'TEST_ORIGINAL_REMOTE', mimeType: 'image/png', size: rec.size,
        sha256: t.hash, connectionFingerprint: 'a'.repeat(64), verifiedAt: new Date().toISOString() };
      const backup = serializeData();
      const saved = backup.files.find(f => f.name === rec.name);
      state.files = []; applyData(backup, { revert: true });
      const restored = state.files.find(f => f.name === rec.name);
      const roundtrip = restored._originalSha256 === t.hash && JSON.stringify(restored._mediaOriginal) === JSON.stringify(saved.mediaOriginal);
      const legacy = structuredClone(backup);
      for (const file of legacy.files) { delete file.sourceSha256; delete file.mediaOriginal; }
      applyData(legacy, { revert: true });
      const historical = state.files.find(f => f.name === rec.name);
      return { savedHash: saved.sourceSha256, roundtrip, cleared: !historical._originalSha256 && !historical._mediaOriginal,
        count: state.files.length, project: historical.project === rec.project && historical._worklabel === rec._worklabel,
        sourceDate: historical.sourceModifiedAt === rec.sourceModifiedAt };
    });
    assert.equal(out.savedHash, await page.evaluate(() => window.__mediaTest.hash));
    assert(out.roundtrip && out.cleared && out.project && out.sourceDate, JSON.stringify(out)); assert.equal(out.count, 2);
  });

  await scenario('upload old server fails closed without claiming backup', async page => {
    await prepareUpload(page, 'old-server');
    const result = await page.evaluate(() => HJMedia.upload('TEST_VIDEO'));
    const out = await uploadFacts(page);
    assert.equal(result.ok, false, JSON.stringify(result)); assert(result.error);
    assert.equal(out.driveId, ''); assert.equal(out.server.begins, 0); assert.equal(out.server.creates, 0);
    assert(out.unchanged && out.sameRecord); assert.equal(out.count, 3);
    assert(out.server.calls.every(call => call.action === 'mediaHealth'), 'legacy server must receive no upload operation');
  });

  for (const mode of ['middle-failure', 'complete-response-lost', 'hung-chunk', 'partial-43']) await scenario('upload retry ' + mode, async page => {
    await prepareUpload(page, mode);
    const first = await page.evaluate(() => HJMedia.upload('TEST_VIDEO'));
    const failed = await uploadFacts(page);
    assert.equal(first.ok, false, JSON.stringify(first)); assert.equal(failed.driveId, '');
    if (mode === 'partial-43') {
      assert.equal(first.error, 'TEST_NETWORK_INTERRUPTED', 'the client accepts offset 43 and reaches the next chunk before the simulated interruption');
      assert.equal(failed.server.offset, 43);
      assert.equal(failed.queue.find(job => job.uploadId === failed.server.uploadId).offset, 43,
        'the exact acknowledged offset survives in the durable retry job');
      assert.deepEqual(failed.server.chunks.map(chunk => [chunk.offset, chunk.size]), [[0, 43]]);
    }
    if (mode === 'hung-chunk') {
      assert.equal(first.error, 'unconfirmed', 'a hung request ends at its deadline without claiming a server update is needed');
      const timers = await page.evaluate(() => ({ active: window.__mediaTest.deadlines.active.size,
        fired: window.__mediaTest.deadlines.fired, busy: HJMedia.busy }));
      assert.deepEqual(timers, { active: 0, fired: 1, busy: false }, 'the deadline clears its timer and releases the in-progress guard');
    }
    assert(failed.server.uploadId, 'the failed attempt has a stable upload ID');
    assert(JSON.stringify(failed.queue).includes(failed.server.uploadId), 'failure keeps the durable retry job');
    assert.doesNotMatch(JSON.stringify(failed.queue), /TEST_MEDIA_TOKEN_A/, 'queue must not persist connection secrets');
    const second = await page.evaluate(() => HJMedia.retry('TEST_VIDEO'));
    const out = await uploadFacts(page);
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(out.server.uploadId, failed.server.uploadId, 'retry uses the same upload ID');
    assert.equal(out.server.creates, 1, 'completed media is created once, including when its first response was lost');
    assert.equal(out.driveId, 'TEST_CONFIRMED_REMOTE_VIDEO'); assert.equal(out.size, 1048576 + 13);
    assert.equal(out.count, 3); assert(out.sameRecord && out.unchanged);
    assert(out.server.calls.filter(c => c.uploadId).every(c => c.uploadId === failed.server.uploadId));
    assert.deepEqual(out.server.chunks.map(c => c.offset), mode === 'partial-43' ? [0, 43] : [0, 1048576],
      'resume starts at the exact server-acknowledged byte and never creates a duplicate media file');
    if (mode === 'partial-43') {
      const resumed = out.server.calls.slice(failed.server.calls.length).filter(call => call.action === 'mediaUploadChunk');
      assert.equal(resumed[0].offset, 43, 'the first retried chunk starts at byte 43, without rounding up or down');
      assert.deepEqual(out.server.chunks.map(chunk => chunk.size), [43, 1048576 + 13 - 43]);
      assert.equal(out.server.receivedSha256, await page.evaluate(() => window.__mediaTest.video._originalSha256),
        'the bytes actually accepted across the interrupted requests reconstruct the original SHA-256');
    }
    if (mode === 'hung-chunk') {
      const late = await page.evaluate(async () => {
        const t = window.__mediaTest, before = t.capture(), calls = t.server.calls.length;
        t.releaseChunk(); await Promise.resolve(); await Promise.resolve();
        return { unchanged: t.capture() === before, callsUnchanged: calls === t.server.calls.length,
          active: t.deadlines.active.size, busy: HJMedia.busy };
      });
      assert.deepEqual(late, { unchanged: true, callsUnchanged: true, active: 0, busy: false }, 'the expired request cannot reapply after its retry succeeds');
    }
  });

  await scenario('upload transient health failure is not reported as old server', async page => {
    await prepareUpload(page);
    await page.evaluate(() => {
      const native = relayCall;
      relayCall = async (action, payload) => {
        if (action === 'mediaHealth') throw new Error('TEST_NETWORK_UNAVAILABLE');
        return native(action, payload);
      };
    });
    const result = await page.evaluate(() => HJMedia.upload('TEST_VIDEO'));
    assert.equal(result.ok, false); assert.equal(result.error, 'TEST_NETWORK_UNAVAILABLE');
    assert.notEqual(result.error, 'server-update-required');
    const out = await uploadFacts(page);
    assert.equal(out.server.begins, 0); assert.equal(out.driveId, ''); assert(out.unchanged && out.sameRecord);
  });

  await scenario('upload token changes during begin stop all chunks', async page => {
    await prepareUpload(page, 'token-change');
    await page.evaluate(() => {
      window.__mediaTest.pendingUpload = HJMedia.upload('TEST_VIDEO').then(result => { window.__mediaTest.uploadResult = result; });
    });
    await page.waitForFunction(() => !!window.__mediaTest.releaseBegin);
    await page.evaluate(() => { __relay.token = 'TEST_MEDIA_TOKEN_B'; window.__mediaTest.releaseBegin(); });
    await page.waitForFunction(() => !!window.__mediaTest.uploadResult);
    const result = await page.evaluate(() => window.__mediaTest.uploadResult);
    const out = await uploadFacts(page);
    assert.equal(result.ok, false, JSON.stringify(result)); assert.equal(out.driveId, '');
    assert.equal(out.server.chunks.length, 0); assert.equal(out.server.creates, 0);
    assert(out.unchanged && out.sameRecord);
    assert(!out.server.calls.some(c => c.token === 'TEST_MEDIA_TOKEN_B'), 'the new connection receives no old-connection upload');
  });

  await scenario('upload durable queue failure prevents server begin', async page => {
    await prepareUpload(page);
    await page.evaluate(() => {
      const native = idbSet;
      idbSet = async (key, value) => {
        if (key === HJMedia.queueKey) throw new DOMException('TEST_MEDIA_QUEUE_QUOTA', 'QuotaExceededError');
        return native(key, value);
      };
    });
    const result = await page.evaluate(() => HJMedia.upload('TEST_VIDEO'));
    const out = await uploadFacts(page);
    assert.equal(result.ok, false); assert.equal(out.server.begins, 0); assert.equal(out.driveId, '');
    assert(out.unchanged && out.sameRecord);
  });

  await scenario('verify remote metadata mismatch never marks wrong source verified', async page => {
    await prepareUpload(page);
    await page.evaluate(() => {
      const t = window.__mediaTest;
      t.video._driveId = 'TEST_REMOTE_WRONG_SIZE';
      const native = relayCall;
      relayCall = async (action, payload) => {
        const result = await native(action, payload);
        return action === 'mediaInspect' ? { ...result, file: { ...result.file, fileId: payload.fileId, size: result.file.size + 1 } } : result;
      };
    });
    const result = await page.evaluate(() => HJMedia.verify('TEST_VIDEO'));
    assert(result.ok === false || result.status === 'remote-exists', JSON.stringify(result));
    assert.notEqual(result.status, 'original-verified', 'remote existence alone is not original verification');
    const out = await uploadFacts(page); assert.equal(out.count, 3); assert(out.sameRecord && out.unchanged);
  });

  await scenario('verify UI counts media honestly and scopes status to current connection', async page => {
    await prepareUpload(page);
    await page.evaluate(() => { window.__mediaTest.video._driveId = 'TEST_CONFIRMED_REMOTE_VIDEO'; });
    const result = await page.evaluate(() => HJMedia.verify('TEST_VIDEO'));
    assert.equal(result.ok, true); assert.equal(result.status, 'original-verified');
    const before = await page.evaluate(() => window.__mediaTest.server.calls.length);
    await page.evaluate(() => HJMedia.view());
    await page.locator('#mediaManager').waitFor({ state: 'visible' });
    assert.match(await page.locator('#mediaRows').innerText(), /사진 2장.*동영상 1개/);
    assert.match(await page.locator('[data-media-id="TEST_VIDEO"]').innerText(), /서버 원본 동일성 확인/);
    assert.equal(await page.evaluate(() => window.__mediaTest.server.calls.length), before, 'opening status sends no request');
    await page.evaluate(() => { __relay.token = 'TEST_MEDIA_TOKEN_B'; HJMedia.view(); });
    assert.doesNotMatch(await page.locator('[data-media-id="TEST_VIDEO"]').innerText(), /서버 원본 동일성 확인/);
    assert.equal(await page.evaluate(() => window.__mediaTest.server.calls.length), before, 'connection changes do not automatically verify or transmit');
    const controls = await page.locator('#mediaManager button:visible, #mediaManager input:visible').evaluateAll(nodes => nodes.map(el => {
      const rect = el.getBoundingClientRect(); return { w: rect.width, h: rect.height };
    }));
    assert(controls.length >= 5); assert(controls.every(c => c.w >= 44 && c.h >= 44));
    assert(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'media controls fit the mobile viewport');
  });

  console.log('\n== media-safety: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => { console.error('FAIL media-safety', error && error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

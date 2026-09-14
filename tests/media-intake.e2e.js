/* Real file chooser + mobile intake; all records/media/network are synthetic. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_MEDIA_INTAKE_MUTATION || '';
const mutations = {
  snapshot: ["if(await hjSnapshot('사진·영상 원본 추가 전',true,true)!==true)", 'if(false)'],
  digest: ["if(await fileHash(blob)!==file.sha256)", 'if(false)']
};
let modified;
if (MUTATION) {
  assert(mutations[MUTATION]); const [from, to] = mutations[MUTATION];
  const source = fs.readFileSync(path.join(__dirname, '../media-safety.js'), 'utf8'); assert(source.includes(from)); modified = source.replace(from, to);
}
let browser, passed = 0;
const FILE = { name: 'TEST_INTAKE_VIDEO.mp4', mimeType: 'video/mp4', buffer: Buffer.from('TEST_ORIGINAL_VIDEO_BYTES_123456') };
async function boot() {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (MUTATION && url.origin === ORIGIN && url.pathname === '/media-safety.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: modified });
    return url.origin === ORIGIN && route.request().method() === 'GET' ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    // During interception the detached input can be collected between Chromium's
    // Page.fileChooserOpened and Playwright's DOM.resolveNode. Keep it alive until
    // setFiles so Playwright does not silently drop the real chooser event.
    window.__intakePickerInputs = new Set();
    const nativeClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function (...args) {
      if (this.type === 'file') window.__intakePickerInputs.add(this);
      return nativeClick.apply(this, args);
    };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HJMedia && window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    state.files = []; state.projects = [{ name: 'TEST_INTAKE_PROJECT', stage: 1, phases: [], customer: {}, archived: false, received: 0, cost: { material: 0, labor: 0, outsource: 0 } }];
    state.activeProject = 'TEST_INTAKE_PROJECT'; state.tab = 'photos'; state.search = ''; state.dirHandle = null; state._demo = false; state.dirty = false;
    __tabStale = false; __photoCache.key = null; __sel.clear(); __selMode = false;
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST_INTAKE/exec'; __relay.token = 'TEST_INTAKE_TOKEN'; __relay.device = 'TEST_INTAKE_DEVICE'; __gdToken = null;
    const t = window.__intake = { mode: '', snapshots: 0, calls: [], jobs: {}, creates: 0, originalSnapshot: hjSnapshot, messages: [] };
    const toastOriginal = toast; toast = value => { t.messages.push(String(value)); return toastOriginal(value); };
    hjSnapshot = async (label, force, allowEmpty) => { if (label !== '사진·영상 원본 추가 전') return true; t.snapshots++; t.snapshotArgs = { label, force, allowEmpty }; return t.mode !== 'snapshot-failed'; };
    const version = 'media-relay-v1';
    const meta = j => ({ fileId: j.fileId, name: j.name, mimeType: j.mimeType, size: j.size, sha256: j.sha256, verified: true });
    const result = j => ({ ok: true, version, uploadId: j.uploadId, state: j.done ? 'complete' : 'uploading', offset: j.bytes.length, size: j.size, chunkBytes: 1048576, ...(j.done ? { file: meta(j) } : {}) });
    relayCall = async (action, p) => {
      // Existing background health is independent of the user-started media API.
      if (!action.startsWith('media')) return { ok: false, error: 'TEST_LEGACY_BLOCKED' };
      t.calls.push(action);
      if (action === 'mediaHealth') return t.mode === 'old-server' ? { ok: false, error: 'bad-request' } : { ok: true, version, maxFileBytes: 104857600, chunkBytes: 1048576, alignmentBytes: 262144, mimeTypes: ['video/mp4', 'image/png'] };
      if (action === 'mediaUploadBegin') {
        let job = t.jobs[p.uploadId];
        if (!job) job = t.jobs[p.uploadId] = { ...p, bytes: [], fileId: 'TEST_REMOTE_INTAKE_' + Object.keys(t.jobs).length, done: false };
        return result(job);
      }
      if (action === 'mediaUploadChunk') {
        const job = t.jobs[p.uploadId]; if (!job || p.offset !== job.bytes.length) throw Error('TEST_BAD_RANGE');
        job.bytes.push(...Uint8Array.from(atob(p.dataB64), c => c.charCodeAt(0)));
        if (job.bytes.length === job.size) { job.done = true; t.creates++; }
        return result(job);
      }
      const job = Object.values(t.jobs).find(j => j.fileId === p.fileId); if (!job) throw Error('TEST_FILE_MISSING');
      if (action === 'mediaInspect') return { ok: true, version, file: meta(job) };
      if (action === 'mediaReadChunk') {
        const bytes = Uint8Array.from(job.bytes.slice(p.offset, p.offset + p.length)); if (t.mode === 'corrupt-read') bytes[0] ^= 1;
        return { ok: true, version, fileId: job.fileId, offset: p.offset, nextOffset: p.offset + bytes.length, size: job.size, mimeType: job.mimeType, sha256: job.sha256, dataB64: btoa(String.fromCharCode(...bytes)), eof: p.offset + bytes.length === job.size };
      }
      throw Error('TEST_UNKNOWN_ACTION');
    };
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  return { page, context, errors };
}
async function scenario(name, fn) {
  if (process.env.HJ_MEDIA_INTAKE_CASE && !name.includes(process.env.HJ_MEDIA_INTAKE_CASE)) return;
  const test = await boot();
  try { await fn(test.page); assert.deepEqual(test.errors, []); passed++; console.log('PASS media-intake ' + name); }
  catch (e) { console.error('DETAIL', await test.page.evaluate(() => ({ text: document.getElementById('mediaIntakeStatus')?.textContent, calls: __intake.calls, messages: __intake.messages, count: state.files.length })).catch(() => ({}))); throw e; }
  finally { await test.context.close(); }
}
async function pick(page, files = [FILE]) {
  await page.evaluate(() => HJMedia.view()); await page.locator('#mediaManager').waitFor({ state: 'visible' });
  try {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#mediaAdd').click()]);
    await chooser.setFiles(files);
  } finally { await page.evaluate(() => window.__intakePickerInputs.clear()); }
  await page.locator('#mediaIntake').waitFor({ state: 'visible' }); await page.locator('#mediaWork').fill('TEST_NEW_WORK');
}
async function confirm(page) {
  await page.locator('#mediaConfirm').click(); await page.waitForFunction(() => !HJMedia.busy && !!document.getElementById('mediaIntakeStatus')?.textContent);
}
async function facts(page) { return page.evaluate(async () => ({ count: state.files.length, creates: __intake.creates, calls: __intake.calls, snapshots: __intake.snapshots, records: state.files.map(f => ({ id: f.id, name: f.name, project: f.project, work: f._worklabel, sha: f._originalSha256, remote: f._mediaOriginal })), jobs: await idbGetStrict(HJMedia.queueKey), appState: await idbGetStrict('appState') })); }
async function screenshot(page, name) { if (process.env.HJ_MEDIA_INTAKE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.HJ_MEDIA_INTAKE_SCREENSHOTS, name + '.png'), fullPage: true }); }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await scenario('file chooser requires confirmation and shows mobile fields', async page => {
    await pick(page); const f = await facts(page); assert.equal(f.count, 0); assert.equal(f.calls.length, 0); assert.equal(f.snapshots, 0);
    assert.match(await page.locator('#mediaIntake').innerText(), /같은 서버 직원에게 공유/);
    await screenshot(page, 'media-intake-mobile');
    const sizes = await page.locator('#mediaIntake button, #mediaIntake input, #mediaIntake select').evaluateAll(nodes => nodes.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    assert(sizes.every(s => s.width >= 44 && s.height >= 44)); assert(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.getByRole('button', { name: '취소', exact: true }).click(); const after = await facts(page); assert.equal(after.calls.length, 0); assert.equal(after.count, 0);
  });
  await scenario('old server blocks before records snapshot and uploads', async page => {
    await page.evaluate(() => { __intake.mode = 'old-server'; }); await pick(page); await confirm(page);
    const f = await facts(page); assert.deepEqual(f.calls, ['mediaHealth']); assert.equal(f.count, 0); assert.equal(f.snapshots, 0); assert.equal(f.jobs, undefined);
    assert.match(await page.locator('#mediaIntakeStatus').innerText(), /서버 업데이트/);
  });
  await scenario('failed safety snapshot keeps all records and sends no originals', async page => {
    await page.evaluate(() => { __intake.mode = 'snapshot-failed'; }); await pick(page); await confirm(page);
    const f = await facts(page); assert.equal(f.count, 0); assert.equal(f.snapshots, 1); assert.deepEqual(f.calls, ['mediaHealth']); assert.equal(f.creates, 0);
    assert.match(await page.locator('#mediaIntakeStatus').innerText(), /안전 백업에 실패/);
  });
  await scenario('confirmed file persists original receipt and exact transmitted bytes', async page => {
    await pick(page); await confirm(page); const f = await facts(page); assert.equal(f.count, 1); assert.equal(f.creates, 1); assert.equal(f.snapshots, 1);
    assert.equal(f.records[0].project, 'TEST_INTAKE_PROJECT'); assert.equal(f.records[0].work, 'TEST_NEW_WORK'); assert.match(f.records[0].sha, /^[a-f0-9]{64}$/); assert.equal(f.records[0].remote.sha256, f.records[0].sha);
    assert.equal(f.jobs.length, 1); assert.equal(f.jobs[0].state, 'complete');
    const bytes = await page.evaluate(() => Object.values(__intake.jobs)[0].bytes); assert.deepEqual(Buffer.from(bytes), FILE.buffer);
    assert(JSON.stringify(f.appState).includes(f.records[0].remote.fileId)); assert.match(await page.locator('#mediaIntakeStatus').innerText(), /원본 전송 확인 1개/);
    if (process.env.HJ_MEDIA_INTAKE_SCREENSHOTS) { await page.evaluate(() => HJMedia.view()); await page.locator('#mediaManager').waitFor({ state: 'visible' }); await screenshot(page, 'media-manager-mobile'); }
  });
  await scenario('repeat selection preserves existing project work and upload ID', async page => {
    await pick(page); await confirm(page); const first = await facts(page);
    await page.locator('#mediaConfirm').click(); await pick(page); await page.locator('#mediaWork').fill('TEST_MUST_NOT_OVERWRITE'); await confirm(page);
    const after = await facts(page); assert.equal(after.count, 1); assert.equal(after.creates, 1); assert.equal(after.records[0].id, first.records[0].id); assert.equal(after.records[0].work, 'TEST_NEW_WORK'); assert.equal(after.jobs[0].uploadId, first.jobs[0].uploadId);
  });
  await scenario('equal name and size but different bytes cannot disappear silently', async page => {
    const other = { ...FILE, buffer: Buffer.from(FILE.buffer) }; other.buffer[0] ^= 1;
    await pick(page, [FILE, other]); await confirm(page); const f = await facts(page); assert.equal(f.count, 0); assert.equal(f.creates, 0); assert.equal(f.snapshots, 0); assert.deepEqual(f.calls, ['mediaHealth']);
  });
  await scenario('downloaded original is independently hashed before playback', async page => {
    await pick(page); await confirm(page); const f = await facts(page);
    const valid = await page.evaluate(async id => { const r = await HJMedia.readOriginal(id); return { ok: r.ok, bytes: r.blob ? [...new Uint8Array(await r.blob.arrayBuffer())] : null }; }, f.records[0].id);
    assert.equal(valid.ok, true); assert.deepEqual(Buffer.from(valid.bytes), FILE.buffer);
    await page.evaluate(() => { __intake.mode = 'corrupt-read'; }); const bad = await page.evaluate(id => HJMedia.readOriginal(id), f.records[0].id);
    assert.equal(bad.ok, false); assert.equal(bad.error, 'invalid-response'); assert.equal(bad.blob, undefined);
  });
  await scenario('fresh device restores shared metadata and reads original without local files', async page => {
    await pick(page); await confirm(page);
    const transfer = await page.evaluate(async () => {
      const data = JSON.parse(JSON.stringify(serializeData()));
      await idbSet('TEST_SHARED_SERIALIZED_DATA', data);
      return { data: await idbGetStrict('TEST_SHARED_SERIALIZED_DATA'), serverJobs: __intake.jobs,
        senderId: state.files[0].id, sha256: state.files[0]._originalSha256, remoteId: state.files[0]._mediaOriginal.fileId };
    });
    assert.equal(transfer.data.files.length, 1);
    assert.equal(transfer.data.files[0].sourceSha256, transfer.sha256);
    assert.equal(transfer.data.files[0].mediaOriginal.fileId, transfer.remoteId);
    assert.equal(transfer.data.files[0]._file, undefined, 'shared JSON cannot contain local File bytes');
    const receiver = await boot();
    try {
      const restored = await receiver.page.evaluate(async transfer => {
        __relay.device = 'TEST_INTAKE_SECOND_DEVICE';
        __intake.jobs = transfer.serverJobs; // Same company server; no sender browser state is imported.
        const before = { records: state.files.length, jobs: await idbGetStrict(HJMedia.queueKey) };
        const count = applyData(transfer.data), rec = state.files[0];
        const local = { id: rec.id, file: !!rec._file, handle: !!rec.handle, virtual: rec._virtual,
          sha256: rec._originalSha256, remote: rec._mediaOriginal, project: rec.project, work: rec._worklabel };
        const verification = await HJMedia.verify(rec.id), download = await HJMedia.readOriginal(rec.id);
        return { before, count, local, verification,
          download: { ok: download.ok, error: download.error, file: download.file,
            bytes: download.blob ? [...new Uint8Array(await download.blob.arrayBuffer())] : null },
          calls: __intake.calls, creates: __intake.creates, jobs: await idbGetStrict(HJMedia.queueKey) };
      }, transfer);
      assert.equal(restored.before.records, 0); assert.equal(restored.before.jobs, undefined);
      assert.equal(restored.count, 1); assert.notEqual(restored.local.id, transfer.senderId, 'receiver creates its own record ID');
      assert.equal(restored.local.file, false); assert.equal(restored.local.handle, false); assert.equal(restored.local.virtual, true);
      assert.equal(restored.local.sha256, transfer.sha256); assert.equal(restored.local.remote.fileId, transfer.remoteId);
      assert.equal(restored.local.project, 'TEST_INTAKE_PROJECT'); assert.equal(restored.local.work, 'TEST_NEW_WORK');
      assert.equal(restored.verification.ok, true); assert.equal(restored.verification.status, 'original-verified');
      assert.equal(restored.download.ok, true, JSON.stringify(restored.download));
      assert.equal(restored.download.file.sha256, transfer.sha256); assert.deepEqual(Buffer.from(restored.download.bytes), FILE.buffer);
      assert.equal(restored.creates, 0); assert.equal(restored.jobs, undefined, 'reader needs no sender upload queue');
      assert(!restored.calls.some(action => action.startsWith('mediaUpload')), 'second device only reads existing originals');
      assert.deepEqual(receiver.errors, []);
    } finally { await receiver.context.close(); }
  });
  console.log(`media-intake: ${passed}/${passed} PASS; pageerrors=0`);
})().catch(error => { console.error('FAIL media-intake', error.stack || error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });

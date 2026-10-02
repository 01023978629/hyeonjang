/* Upload identity and async boundaries. Synthetic servers, originals and ephemeral IndexedDB only. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const ORIGIN = 'http://127.0.0.1:8299', ROOT = path.join(__dirname, '..');
const mutation = process.env.HJ_UPLOAD_SCOPE_MUTATION || '';
let browser, passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
async function fixture() {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url === ORIGIN + '/__upload_scope_test.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><script src="./team-upload.js"></script>' });
    if (url === ORIGIN + '/team-upload.js') {
      let source = fs.readFileSync(path.join(ROOT, 'team-upload.js'), 'utf8');
      if (mutation) {
        const changes = {
          'server-scope': ["binding.apiUrl, binding.portalUrl, binding.officeId, binding.userId, member", "'TEST_SHARED_SERVER', binding.portalUrl, binding.officeId, binding.userId, member"],
          'principal-scope': ["binding.apiUrl, binding.portalUrl, binding.officeId, binding.userId, member", "binding.apiUrl, binding.portalUrl, 'TEST_SHARED_OFFICE', 'TEST_SHARED_USER', member"],
          'permission-generation': ['e.generation === generation && !!ctx.data()', '!!ctx.data()'],
          'legacy-resume': ['r && r.scope === s && r.file instanceof Blob', "r && (r.scope === ctx.data()?.me?.id ? (r.scope = s) : r.scope === s) && r.file instanceof Blob"],
          'photo-send': ["assertLive(e); const r = await ctx.api('evidenceUpload', payload);", "const r = await ctx.api('evidenceUpload', payload);"],
          'video-send': ["assertLive(e); up = (await ctx.api('evidenceMediaChunk'", "up = (await ctx.api('evidenceMediaChunk'"],
          'photo-cancel': ["if (item.cancelled) return;\n          assertLive(e); const r = await ctx.api('evidenceUpload'", "assertLive(e); const r = await ctx.api('evidenceUpload'"],
          'video-cancel': ["if (item.cancelled) return;\n        assertLive(e); up = (await ctx.api('evidenceMediaChunk'", "assertLive(e); up = (await ctx.api('evidenceMediaChunk'"],
          'unsafe-batch-retry': ["i?.state === 'failed' && retryable(i) && await requeue(i, e)", "i?.state === 'failed' && await requeue(i, e)"],
          'stale-done-notice': ['if (live(e)) ctx.onDone(item);', 'ctx.onDone(item);'],
          'refresh-accept': ["assertLive(e); ctx.accept(r.data); }", "ctx.accept(r.data); }"]
        };
        const pair = changes[mutation]; assert(pair, 'unknown mutation');
        assert.equal(source.split(pair[0]).length - 1, 1, 'mutation anchor must be unique'); source = source.replace(...pair);
      }
      return route.fulfill({ contentType: 'application/javascript', body: source });
    }
    return route.abort();
  });
  await page.goto(ORIGIN + '/__upload_scope_test.html');
  await page.evaluate(() => {
    const endpoint = id => 'https://script.google.com/macros/s/AKfyTEST_' + id + '/exec';
    const f = window.fixture = { server: endpoint('A'), epoch: 0, member: 'TEST_MEMBER', office: 'TEST_OFFICE', user: 'TEST_USER', writes: [], calls: [], accepts: [], done: [], changes: 0, errors: [],
      data: { revision: 0, me: { id: 'TEST_MEMBER' }, evidence: [] } };
    const binding = () => f.noBinding ? null : ({ apiUrl: f.server, portalUrl: endpoint('PORTAL'), officeId: f.office, userId: f.user });
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      if (f.blockBytes) { f.blockBytes = false; f.bytesStarted = true; await new Promise(resolve => { f.releaseBytes = resolve; }); }
      return original.call(this);
    };
    const api = async (action, payload) => {
      const server = f.server; f.calls.push({ action, server });
      if (action === 'list') { const old = structuredClone(f.data); old.source = server; f.listStarted = true; await new Promise(resolve => { f.releaseList = resolve; }); return { data: old }; }
      if (action === 'evidenceMediaBegin') return { upload: { state: 'uploading', offset: 0, size: payload.entity.size } };
      if (action === 'evidenceMediaChunk') return { upload: { state: 'complete', offset: 4, size: 4 } };
      if (action !== 'evidenceUpload') throw Error('unexpected action');
      if (f.conflict) { f.conflict = false; throw Object.assign(new Error('conflict'), { code: 'conflict' }); }
      f.writes.push({ server, name: payload.entity.name });
      return { data: { ...f.data, revision: f.data.revision + 1, source: server, evidence: [...f.data.evidence, payload.entity] } };
    };
    f.queue = HJTeamUpload.create({ data: () => f.data, binding, epoch: () => f.epoch, api,
      accept: data => { f.accepts.push(data.source); f.data = data; }, onChange: () => { f.changes++; }, onDone: item => f.done.push(item.entity.name), onError: e => f.errors.push(e.code) });
    f.entry = (name, kind = 'photo') => { const bytes = kind === 'video' ? new Uint8Array([1, 2, 3, 4]) : new TextEncoder().encode(name);
      return { file: new File([bytes], name, { type: kind === 'video' ? 'video/mp4' : 'image/png' }), entity: { id: 'TEST_E_' + name, name, kind, mime: kind === 'video' ? 'video/mp4' : 'image/png', size: bytes.length,
        sha256: name.padEnd(64, '0').slice(0, 64), projectId: 'TEST_PROJECT', taskId: 'TEST_TASK', phase: 'after', capturedDate: '2026-10-02', caption: 'TEST_CAPTION' } }; };
    f.add = (name, kind) => f.queue.add([f.entry(name, kind)]);
    f.switch = server => { f.epoch++; f.queue.stop(); f.server = endpoint(server); f.data = { revision: 0, me: { id: f.member }, evidence: [] }; f.queue.kick(); };
    f.rows = () => new Promise((resolve, reject) => { const req = indexedDB.open('hj-team-upload', 1); req.onupgradeneeded = () => req.result.createObjectStore('items', { keyPath: 'key' });
      req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('items'), r = tx.objectStore('items').getAll(); tx.oncomplete = () => { db.close(); resolve(r.result); }; tx.onerror = () => reject(tx.error); }; });
    f.legacy = async () => { const entry = f.entry('legacy.png'); await new Promise((resolve, reject) => { const req = indexedDB.open('hj-team-upload', 1); req.onupgradeneeded = () => req.result.createObjectStore('items', { keyPath: 'key' });
      req.onerror = () => reject(req.error); req.onsuccess = () => { const db = req.result, tx = db.transaction('items', 'readwrite'); tx.objectStore('items').put({ ...entry, key: 'TEST_LEGACY_KEY', scope: f.member, createdAt: 1, state: 'queued' });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }); };
  });
  return { page, context, close: async () => { await context.close(); assert.deepEqual(errors, []); } };
}
async function done(page, name) { await page.waitForFunction(name => fixture.done.includes(name), name); }
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await check('same staff ID on another server cannot see or send earlier originals', async () => {
    const h = await fixture(); try {
      await h.context.setOffline(true); await h.page.evaluate(() => fixture.add('company-A.png'));
      await h.page.evaluate(() => fixture.switch('B')); await h.page.evaluate(() => fixture.add('company-B.png'));
      await h.context.setOffline(false); await done(h.page, 'company-B.png');
      const result = await h.page.evaluate(async () => ({ writes: fixture.writes, retained: (await fixture.rows()).map(r => r.entity.name) }));
      assert.deepEqual(result.writes.map(w => [w.server.split('_').pop(), w.name]), [['B/exec', 'company-B.png']]);
      assert.deepEqual(result.retained, ['company-A.png'], 'the original belonging to A remains on this device');
      await h.page.evaluate(() => fixture.switch('A')); await done(h.page, 'company-A.png');
      assert.equal(await h.page.evaluate(async () => (await fixture.rows()).length), 0);
    } finally { await h.close(); }
  });
  await check('legacy originals without a server identity are held, not guessed or removed', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(() => fixture.legacy()); await h.page.evaluate(() => fixture.add('confirmed.png')); await done(h.page, 'confirmed.png');
      const r = await h.page.evaluate(async () => ({ names: fixture.writes.map(w => w.name), held: fixture.queue.summary().held, retained: (await fixture.rows()).map(r => r.entity.name) }));
      assert.deepEqual(r.names, ['confirmed.png']); assert.equal(r.held, 1); assert.deepEqual(r.retained, ['legacy.png']);
    } finally { await h.close(); }
  });
  await check('another portal principal with a reused member ID cannot inherit originals', async () => {
    const h = await fixture(); try {
      await h.context.setOffline(true); await h.page.evaluate(() => fixture.add('first-principal.png'));
      await h.page.evaluate(() => { fixture.queue.stop(); fixture.user = 'TEST_OTHER_USER'; fixture.office = 'TEST_OTHER_OFFICE'; fixture.queue.kick(); });
      await h.page.evaluate(() => fixture.add('second-principal.png')); await h.context.setOffline(false); await done(h.page, 'second-principal.png');
      assert.deepEqual(await h.page.evaluate(() => fixture.writes.map(w => w.name)), ['second-principal.png']);
      assert.deepEqual(await h.page.evaluate(async () => (await fixture.rows()).map(r => r.entity.name)), ['first-principal.png']);
    } finally { await h.close(); }
  });
  await check('missing verified server binding does not queue or send an original', async () => {
    const h = await fixture(); try {
      const result = await h.page.evaluate(async () => { fixture.noBinding = true; return fixture.add('unverified.png'); });
      assert.equal(result.added, 0); assert.deepEqual(await h.page.evaluate(() => fixture.queue.view()), []);
      assert.equal(await h.page.evaluate(async () => (await fixture.rows()).length), 0); assert.equal(await h.page.evaluate(() => fixture.calls.length), 0);
    } finally { await h.close(); }
  });
  for (const kind of ['photo', 'video']) await check(kind + ' bytes finishing after logout cannot be sent with a new session', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(kind => { fixture.blockBytes = true; return fixture.add('stale-' + kind, kind); }, kind);
      await h.page.waitForFunction(() => fixture.bytesStarted);
      await h.page.evaluate(() => { fixture.switch('B'); fixture.releaseBytes(); });
      await h.page.evaluate(() => fixture.add('fresh.png')); await done(h.page, 'fresh.png');
      const r = await h.page.evaluate(() => ({ writes: fixture.writes, calls: fixture.calls }));
      assert.deepEqual(r.writes.map(w => w.name), ['fresh.png']);
      assert(!r.calls.some(c => c.action === 'evidenceMediaChunk'), 'the stale video chunk must never be dispatched');
    } finally { await h.close(); }
  });
  await check('a permission reset without an epoch change still invalidates old reads', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(() => { fixture.blockBytes = true; return fixture.add('before-permission-reset.png'); }); await h.page.waitForFunction(() => fixture.bytesStarted);
      await h.page.evaluate(() => { fixture.queue.stop(); fixture.releaseBytes(); });
      // Do not kick the restored connection: only the obsolete in-flight sender is under test.
      await h.page.waitForFunction(() => !fixture.queue.busy());
      assert.deepEqual(await h.page.evaluate(() => fixture.writes), []); assert.deepEqual(await h.page.evaluate(async () => (await fixture.rows()).map(r => r.entity.name)), ['before-permission-reset.png']);
    } finally { await h.close(); }
  });
  for (const kind of ['photo', 'video']) await check('cancel during ' + kind + ' byte reading stops undispatched writes and clears only the device copy', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(kind => { fixture.blockBytes = true; return fixture.add('cancelled.' + kind, kind); }, kind); await h.page.waitForFunction(() => fixture.bytesStarted);
      await h.page.evaluate(async () => { await fixture.queue.cancel(fixture.queue.view()[0].key); fixture.releaseBytes(); });
      await h.page.waitForFunction(() => !fixture.queue.busy());
      assert.deepEqual(await h.page.evaluate(() => fixture.writes), []); assert.equal(await h.page.evaluate(async () => (await fixture.rows()).length), 0);
      assert.equal(await h.page.evaluate(() => fixture.calls.some(c => c.action === 'evidenceMediaChunk')), false);
    } finally { await h.close(); }
  });
  await check('logout while checking storage prevents registering the original to a later connection', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(() => {
        navigator.storage.estimate = async () => { fixture.storageStarted = true; await new Promise(resolve => { fixture.releaseStorage = resolve; }); return { quota: 1000000, usage: 0 }; };
        fixture.pendingAdd = fixture.add('not-yet-queued.png').then(() => 'added', e => e.code);
      });
      await h.page.waitForFunction(() => fixture.storageStarted); await h.page.evaluate(() => { fixture.switch('B'); fixture.releaseStorage(); });
      assert.equal(await h.page.evaluate(() => fixture.pendingAdd), 'stale'); assert.equal(await h.page.evaluate(async () => (await fixture.rows()).length), 0);
      assert.deepEqual(await h.page.evaluate(() => fixture.writes), []);
    } finally { await h.close(); }
  });
  await check('batch retry never sends permanent errors even if their keys are supplied', async () => {
    const h = await fixture(); try {
      await h.context.setOffline(true); await h.page.evaluate(() => fixture.add('transient.png')); await h.page.evaluate(() => fixture.add('forbidden.png'));
      await h.page.evaluate(async () => {
        fixture.queue.stop(); const rows = await fixture.rows();
        rows.forEach(r => { r.state = 'failed'; r.error = r.entity.name === 'transient.png' ? 'network' : 'forbidden'; r.attempts = 6; });
        await new Promise((resolve, reject) => { const r = indexedDB.open('hj-team-upload', 1); r.onerror = () => reject(r.error);
          r.onsuccess = () => { const db = r.result, tx = db.transaction('items', 'readwrite'); rows.forEach(row => tx.objectStore('items').put(row)); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
        fixture.queue.kick();
      });
      await h.page.waitForFunction(() => fixture.queue.view().filter(r => r.state === 'failed').length === 2);
      const count = await h.page.evaluate(() => fixture.queue.retryFailed(fixture.queue.view().map(r => r.key))); assert.equal(count, 1);
      await h.context.setOffline(false); await done(h.page, 'transient.png');
      assert.deepEqual(await h.page.evaluate(() => fixture.writes.map(w => w.name)), ['transient.png']); assert.deepEqual(await h.page.evaluate(async () => (await fixture.rows()).map(r => r.entity.name)), ['forbidden.png']);
    } finally { await h.close(); }
  });
  await check('completion from a finished old upload cannot announce a file in the next login', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(() => {
        const originalDelete = IDBObjectStore.prototype.delete;
        IDBObjectStore.prototype.delete = function (key) {
          if (fixture.switchOnDrop) { fixture.switchOnDrop = false; fixture.switchedAtDrop = true; fixture.switch('B'); }
          return originalDelete.call(this, key);
        };
        fixture.switchOnDrop = true; return fixture.add('finished-company-A.png');
      });
      await h.page.waitForFunction(() => fixture.switchedAtDrop); await h.page.evaluate(() => fixture.add('fresh.png')); await done(h.page, 'fresh.png');
      assert.deepEqual(await h.page.evaluate(() => fixture.done), ['fresh.png']);
      assert.equal(await h.page.evaluate(async () => (await fixture.rows()).length), 0, 'both confirmed uploads can remove their own device copies');
    } finally { await h.close(); }
  });
  await check('a stale conflict refresh cannot apply an earlier company snapshot', async () => {
    const h = await fixture(); try {
      await h.page.evaluate(() => { fixture.conflict = true; return fixture.add('conflict.png'); }); await h.page.waitForFunction(() => fixture.listStarted);
      await h.page.evaluate(() => { fixture.switch('B'); fixture.releaseList(); });
      await h.page.evaluate(() => fixture.add('fresh.png')); await done(h.page, 'fresh.png');
      const accepts = await h.page.evaluate(() => fixture.accepts);
      assert(accepts.every(url => url.endsWith('_B/exec')), 'old company data must not be applied to the new session');
    } finally { await h.close(); }
  });
  await browser.close(); console.log('team-upload-scope: ' + passed + ' passed, ' + failed + ' failed'); process.exitCode = failed ? 1 : 0;
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('node:child_process'); let caught = 0;
  for (const mode of ['server-scope', 'principal-scope', 'permission-generation', 'legacy-resume', 'photo-send', 'video-send', 'photo-cancel', 'video-cancel', 'unsafe-batch-retry', 'stale-done-notice', 'refresh-accept']) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_UPLOAD_SCOPE_MUTATION: mode }, timeout: 180000, encoding: 'utf8' });
    const detected = r.status === 1 && /FAIL (same staff|another portal|a permission reset|legacy originals|photo bytes|video bytes|cancel during|batch retry|completion from|a stale conflict)/.test(r.stdout + r.stderr);
    console.log((detected ? 'DETECTED ' : 'SURVIVED ') + mode); if (detected) caught++;
  }
  console.log(caught + '/11 upload scope mutations detected'); process.exitCode = caught === 11 ? 0 : 1;
} else run().catch(async e => { console.error('HARNESS ERROR', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });

/* Snapshot history must save the current state before applying an older one.
   Uses the real backupHistory UI, hjSnapshot and a fresh browser-only IDB.
   No live data, credentials, relay requests or service workers are permitted.
   Run with tests/static-server.js on 8299; included automatically by run-all.js. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
// Explicit opt-in mutation runs change only the response held in memory. Never
// rewrite index.html, bypass the test runner or touch the deployed application.
const mutation = process.env.HJ_SNAPSHOT_MUTATION || '';
const mutations = {
  'skip-result': ["if(saved!==true){toast('🛡 안전 스냅샷", "if(false){toast('🛡 안전 스냅샷"],
  'truthy-result': ["if(saved!==true){toast('🛡 안전 스냅샷", "if(!saved){toast('🛡 안전 스냅샷"],
  'skip-busy': ['if(__snapshotRestoreBusy)return false;', '/* mutation: in-flight guard removed */'],
  'skip-empty': ["hjSnapshot('복구 직전',true,true)", "hjSnapshot('복구 직전',true)"],
  'skip-shape': ["if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.files))throw new Error('invalid snapshot');", '/* mutation: invalid snapshot shape guard removed */']
};
let mutatedHtml;
if (mutation) {
  assert(mutations[mutation], 'unknown HJ_SNAPSHOT_MUTATION');
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const [before, after] = mutations[mutation];
  assert.equal(source.split(before).length - 1, 1, 'mutation target must occur exactly once');
  mutatedHtml = source.replace(before, after);
  console.log('MUTATION  ' + mutation + ' (memory-only response; a non-zero result is expected)');
}
const results = [];
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  // Every context is ephemeral. Only this repository's local read-only server
  // may be contacted; failures cannot accidentally fall through to live APIs.
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (mutatedHtml && url.href === APP && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: mutatedHtml });
    }
    return url.origin === new URL(APP).origin && request.method() === 'GET'
      ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  async function seed(mode, empty = false) {
    // A fresh document also disposes prior render/automatic-work timers. Do not
    // let a later task from a successful case contaminate a subsequent case.
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]));
    await page.evaluate(async ({ mode, empty }) => {
      const original = window.__restoreGuardOriginal = { hjSnapshot, applyData, markDirty, render, closeModal, toast, idbSet, idbGetStrict };
      window.__restoreGuardBase = JSON.parse(JSON.stringify(serializeData()));
      window.__restoreGuardObserve = () => ({
        projects: state.projects.map(project => project.name),
        files: state.files.map(file => ({ name: file.name, project: file.project })),
        quotes: state.quotes, notes: state.notes, dirty: state.dirty
      });
      original.closeModal(true);
      const project = name => ({ name, stage: 1, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, received: 0, archived: false });
      // Synthetic state only. Non-work data in this fresh context is retained
      // so applyData follows its real normalization path without new timers.
      state.projects = empty ? [] : [project('TEST_CURRENT_PROJECT')];
      state.files = []; state.quotes = []; state.notes = [];
      state.dirty = false; state.activeProject = null;
      const target = JSON.parse(JSON.stringify(window.__restoreGuardBase));
      target.projects = [project('TEST_OLD_PROJECT')];
      target.files = []; target.quotes = []; target.notes = [{ id: 'TEST_NOTE', text: 'TEST_OLD_NOTE' }];
      const record = { at: '2026-01-02T03:04:05.000Z', label: 'TEST_SAVED_POINT', np: 1, nf: 0, nq: 0, data: target };
      await original.idbSet('hj_snaps', [record]);
      __snapLastAt = 0; __snapLastLabel = '';
      const probe = window.__restoreGuardProbe = {
        mode, snapshots: [], applies: 0, marks: 0, renders: 0, closes: 0,
        messages: [], handlers: 0, before: window.__restoreGuardObserve(),
        snapshotsBefore: JSON.stringify(await original.idbGetStrict('hj_snaps'))
      };
      window.toast = message => { probe.messages.push(String(message)); return original.toast(message); };
      window.markDirty = () => { probe.marks++; state.dirty = true; };
      window.render = (...args) => { probe.renders++; return original.render(...args); };
      window.closeModal = (...args) => { probe.closes++; return original.closeModal(...args); };
      window.applyData = (data, options) => {
        probe.applies++;
        probe.atApply = window.__restoreGuardObserve();
        probe.appliedOptions = options;
        probe.persistedBeforeApply = probe.lastPersisted;
        return original.applyData(data, options);
      };
      if (mode === 'idb-fail') window.idbSet = (key, data) => key === 'hj_snaps'
        ? Promise.reject(new Error('TEST_IDB_WRITE_FAILURE')) : original.idbSet(key, data);
      window.hjSnapshot = async (label, force, allowEmpty) => {
        if (label !== '복구 직전') return original.hjSnapshot(label, force, allowEmpty);
        probe.snapshots.push({ label, force, allowEmpty, state: window.__restoreGuardObserve() });
        if (probe.mode === 'false') return false;
        if (probe.mode === 'throw') throw new Error('TEST_SNAPSHOT_FAILURE');
        if (probe.mode === 'truthy') return { ok: true };
        if (probe.mode === 'pending') return new Promise(resolve => { probe.resolve = resolve; });
        const ok = await original.hjSnapshot(label, force, allowEmpty);
        probe.lastPersisted = await original.idbGetStrict('hj_snaps');
        return ok;
      };
    }, { mode, empty });
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
    await page.evaluate(() => backupHistory());
    await page.locator('#modalRoot .snapRestore').click();
    await page.getByRole('button', { name: '✅ 복구', exact: true }).waitFor();
  }

  async function clickConfirm() {
    await page.getByRole('button', { name: '✅ 복구', exact: true }).evaluate(button => {
      if (button.__restoreGuardWrapped) return;
      const handler = button.onclick;
      button.__restoreGuardWrapped = true;
      button.onclick = async function (event) {
        window.__restoreGuardProbe.handlers++;
        try { return await handler.call(this, event); }
        finally { window.__restoreGuardProbe.handlers--; }
      };
    });
    await page.getByRole('button', { name: '✅ 복구', exact: true }).click();
  }
  async function settled() {
    await page.waitForFunction(() => window.__restoreGuardProbe.handlers === 0);
  }
  async function observe() {
    return page.evaluate(async () => {
      const p = window.__restoreGuardProbe;
      return { ...p, resolve: undefined, after: window.__restoreGuardObserve(),
        snapshotsAfter: JSON.stringify(await window.__restoreGuardOriginal.idbGetStrict('hj_snaps')),
        dialogOpen: !!document.querySelector('#modalRoot .modal'),
        title: document.getElementById('modalTitle')?.textContent || '' };
    });
  }
  function unchanged(p) {
    assert.deepEqual(p.after, p.before, 'current projects/notes/dirty state must remain intact');
    assert.equal(p.applies, 0, 'applyData must not run before a successful safety snapshot');
    assert.equal(p.marks, 0, 'failed/pending restore must not mark data dirty');
    assert.equal(p.renders, 0, 'failed/pending restore must not render restored state');
    assert.equal(p.closes, 0, 'failed/pending restore must not close the confirmation');
    assert(p.dialogOpen, 'confirmation must remain visible on failure');
  }
  async function test(name, fn) {
    try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
    catch (error) { results.push({ name, ok: false }); console.error('FAIL  ' + name + '\n' + error.stack); }
  }

  await test('false snapshot result preserves current data and explains the cancellation', async () => {
    await seed('false'); await clickConfirm(); await settled();
    const p = await observe(); unchanged(p);
    assert.equal(p.snapshots.length, 1);
    assert.equal(p.snapshots[0].force, true);
    assert.equal(p.snapshotsAfter, p.snapshotsBefore, 'failed restore must preserve existing snapshots');
    assert(p.messages.some(text => /백업|스냅샷|안전판/.test(text) && /실패|못|중단/.test(text)), 'explicit safety backup failure message');
    assert(!p.messages.some(text => /복구됨/.test(text)), 'no false success toast');
  });

  await test('malformed saved records are rejected before snapshot or state mutation', async () => {
    const invalidRecords = [null, {}, [], { files: null }, { files: {} }, { files: 'TEST_NOT_AN_ARRAY' }];
    for (const data of invalidRecords) {
      await seed('real');
      // Persist a malformed saved record into this isolated test browser, then
      // select it through the actual history UI rather than invoking a helper.
      await page.evaluate(async data => {
        const original = window.__restoreGuardOriginal;
        const records = await original.idbGetStrict('hj_snaps');
        records[0].data = data;
        await original.idbSet('hj_snaps', records);
        window.__restoreGuardProbe.snapshotsBefore = JSON.stringify(await original.idbGetStrict('hj_snaps'));
        await backupHistory();
      }, data);
      await page.locator('#modalRoot .snapRestore').click();
      await clickConfirm(); await settled();
      const p = await observe(); unchanged(p);
      assert.equal(p.snapshots.length, 0, 'invalid target must be rejected before writing a safety snapshot: ' + JSON.stringify(data));
      assert.equal(p.snapshotsAfter, p.snapshotsBefore, 'malformed history remains intact for inspection');
      assert(p.messages.some(text => /손상|형식/.test(text) && /복구하지/.test(text)), 'invalid record must have a visible rejection');
      assert(!p.messages.some(text => /복구됨/.test(text)), 'a no-op apply must not be reported as a successful restore');
    }
  });

  await test('snapshot exception is contained and retry can succeed', async () => {
    await seed('throw'); await clickConfirm(); await settled();
    let p = await observe(); unchanged(p);
    assert(p.messages.some(text => /실패|못|중단/.test(text)), 'exception must be visible as failure');
    await page.evaluate(() => { window.__restoreGuardProbe.mode = 'real'; });
    await clickConfirm(); await settled(); p = await observe();
    assert.equal(p.snapshots.length, 2, 'the failed attempt must release the in-flight guard');
    assert.equal(p.applies, 1);
    assert.deepEqual(p.after.projects, ['TEST_OLD_PROJECT']);
  });

  await test('apply exception retains its safety record and releases the retry guard', async () => {
    await seed('real');
    await page.evaluate(() => {
      window.__restoreGuardApply = window.applyData;
      window.applyData = () => { window.__restoreGuardProbe.applies++; throw new Error('TEST_APPLY_FAILURE'); };
    });
    await clickConfirm(); await settled();
    let p = await observe();
    assert.deepEqual(p.after, p.before);
    assert.equal(p.applies, 1); assert.equal(p.marks, 0); assert.equal(p.renders, 0); assert.equal(p.closes, 0);
    assert(p.dialogOpen); assert(p.messages.some(text => /복구 실패/.test(text)));
    assert.equal(JSON.parse(p.snapshotsAfter).filter(record => record.label === '복구 직전').length, 1);
    await page.evaluate(() => { window.applyData = window.__restoreGuardApply; });
    await clickConfirm(); await settled(); p = await observe();
    assert.equal(p.applies, 2); assert.deepEqual(p.after.projects, ['TEST_OLD_PROJECT']);
  });

  await test('only literal true is accepted as a successful snapshot', async () => {
    await seed('truthy'); await clickConfirm(); await settled(); unchanged(await observe());
  });

  await test('pending snapshot blocks early apply and repeated confirm clicks', async () => {
    await seed('pending'); await clickConfirm();
    let p = await observe(); unchanged(p);
    assert(await page.locator('#modalRoot button').evaluateAll(buttons => buttons.every(button => button.disabled)), 'buttons are disabled while the safety write is pending');
    // Dispatch another real DOM click without waiting for the first promise.
    await page.getByRole('button', { name: '✅ 복구', exact: true }).evaluate(button => button.click());
    p = await observe(); unchanged(p);
    assert.equal(p.snapshots.length, 1, 'double click must not start a second snapshot or restore');
    await page.evaluate(() => window.__restoreGuardProbe.resolve(true));
    await settled(); p = await observe();
    assert.equal(p.applies, 1); assert.equal(p.marks, 1); assert.equal(p.renders, 1); assert.equal(p.closes, 1);
    assert.deepEqual(p.atApply, p.before, 'first mutation occurs only after the snapshot resolves');
    assert.deepEqual(p.after.projects, ['TEST_OLD_PROJECT']);
  });

  await test('reopening history cannot start a second restore while the first is pending', async () => {
    await seed('pending'); await clickConfirm();
    await page.evaluate(() => backupHistory());
    await page.locator('#modalRoot .snapRestore').click();
    await clickConfirm();
    const p = await observe(); unchanged(p);
    assert.equal(p.snapshots.length, 1, 'in-flight guard must span recreated confirmation dialogs');
    await page.evaluate(() => window.__restoreGuardProbe.resolve(false));
    await settled(); unchanged(await observe());
  });

  await test('real IDB snapshot of the current state exists before applying the selected record', async () => {
    await seed('real'); await clickConfirm(); await settled();
    const p = await observe();
    assert.equal(p.applies, 1); assert.deepEqual(p.appliedOptions, { revert: true });
    assert.deepEqual(p.atApply, p.before);
    const safety = p.persistedBeforeApply.find(record => record.label === '복구 직전');
    assert(safety, 'real IDB write must have completed before applyData');
    assert.deepEqual(safety.data.projects.map(project => project.name), ['TEST_CURRENT_PROJECT']);
    assert.equal(JSON.parse(p.snapshotsAfter).length, 2, 'both original and current-state snapshots are retained');
    assert(p.messages.some(text => /복구됨/.test(text) && /클라우드/.test(text) && /별도/.test(text)), 'local restore must not imply a successful cloud backup');
    assert.equal(p.after.dirty, true); assert(!p.dialogOpen);
  });

  await test('an empty current state is explicitly backed up and remains recoverable', async () => {
    await seed('real', true); await clickConfirm(); await settled();
    const p = await observe();
    assert.equal(p.snapshots[0].allowEmpty, true, 'restore must opt in to preserving an empty current state');
    assert.equal(p.applies, 1);
    const safety = p.persistedBeforeApply.find(record => record.label === '복구 직전');
    assert(safety, 'empty state still needs its own safety record');
    assert.deepEqual(safety.data.projects, []); assert.deepEqual(safety.data.files, []); assert.deepEqual(safety.data.quotes, []);
    assert.equal(safety.np, 0); assert.equal(safety.nf, 0); assert.equal(safety.nq, 0);
    assert.deepEqual(p.after.projects, ['TEST_OLD_PROJECT']);
  });

  await test('real hjSnapshot IDB write failure cannot apply old data or overwrite prior backups', async () => {
    await seed('idb-fail'); await clickConfirm(); await settled();
    const p = await observe(); unchanged(p);
    assert.equal(p.snapshotsAfter, p.snapshotsBefore);
    assert(!p.messages.some(text => /복구됨/.test(text)));
  });

  await test('cancel returns to history without writing or restoring', async () => {
    await seed('real');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.locator('#modalRoot .snapRestore').waitFor();
    const p = await observe(); unchanged(p);
    assert.equal(p.snapshots.length, 0); assert.equal(p.snapshotsAfter, p.snapshotsBefore);
    assert(/안전판/.test(p.title));
  });

  assert.deepEqual(errors, [], 'no unhandled browser errors');
  const passed = results.filter(result => result.ok).length;
  console.log(`\n== snapshot-restore-guard: ${passed}/${results.length} passed; pageerrors=${errors.length} ==`);
  await browser.close(); browser = null;
  process.exitCode = passed === results.length ? 0 : 1;
})().catch(async error => {
  console.error(error.stack || error);
  if (browser) await browser.close();
  process.exitCode = 1;
});

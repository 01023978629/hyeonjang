/* Conflict comparison is read-only and bound to the document, connection and local snapshot.
   Only synthetic data in an ephemeral browser; external requests are blocked. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const mutation = process.env.HJ_CONFLICT_PREVIEW_MUTATION || '';
const mutations = {
  'skip-local': ["fingerprint!==paidStableJson(hjConflictLocalSnapshot())", 'false'],
  'skip-connection': ["connection.url!==__relay.url||connection.token!==__relay.token||connection.rev!==__relay.rev", 'false'],
  'skip-document': ["if(document.getElementById('ryConflictBox')!==box)return;\n    if(connection", 'if(connection'],
  'write-on-read': ['const summary=hjConflictSummary(local,server),revision=', 'applyData(server);const summary=hjConflictSummary(local,server),revision='],
  'expose-records': ['const summary=hjConflictSummary(local,server),revision=', 'box.dataset.raw=JSON.stringify(server);const summary=hjConflictSummary(local,server),revision=']
};
let browser, failed = 0, passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
  let html;
  if (mutation) {
    const [from, to] = mutations[mutation] || [];
    assert(from, 'unknown mutation');
    html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.equal(html.split(from).length - 1, 1, 'mutation anchor must be unique');
    html = html.replace(from, to);
  }
  await context.route('**/*', r => {
    const u = new URL(r.request().url());
    if (html && u.href === APP) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
    return u.origin === new URL(APP).origin && r.request().method() === 'GET' ? r.continue() : r.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjRelayBootDone, __hjOfficeOpsBootDone]);
    // Built-in calendar import schedules a debounced appState save during boot.
    // Retire that timer and join its actual write queue before installing probes.
    clearTimeout(__idbSaveTimer); __idbSaveTimer = null; await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    aiOpsBootCheck = () => 0; aiQueueSanitize = () => 0;
    window.__previewCalls = { loads: 0, apply: 0, snapshot: 0, dirty: 0, write: 0, save: 0, backup: 0 };
    const calls = __previewCalls;
    applyData = () => { calls.apply++; }; hjSnapshot = async () => { calls.snapshot++; return true; };
    window.__previewWriteKeys = [];
    markDirty = () => { calls.dirty++; }; idbSet = async key => { calls.write++; __previewWriteKeys.push(key); };
    cloudApiSave = async () => { calls.save++; return { ok: true }; }; cloudApiBackup = async () => { calls.backup++; return { ok: true }; };
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST_COMPARE_A/exec'; __relay.token = 'TEST_COMPARE_TOKEN'; __relay.rev = 3;
    window.__previewSeed = () => {
      closeModal(true);
      state.projects = [{ name: 'TEST_PRIVATE_PROJECT_A', stage: 1, phases: [], received: 0, cost: {} }];
      state.files = [{ id: 'TEST_LOCAL_ID', name: 'TEST_PRIVATE_FILE.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', project: 'TEST_PRIVATE_PROJECT_A', size: 100, when: null, _driveId: 'TEST_DRIVE_A' }];
      state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state.workLogs = []; state.aptOrders = []; state.asLog = [];
      const local = hjConflictLocalSnapshot(), server = structuredClone(local);
      server.projects[0].stage = 2; server.projects.push({ name: 'TEST_PRIVATE_PROJECT_B', stage: 0 });
      server.files.push({ ...server.files[0], driveId: 'TEST_DRIVE_B', project: 'TEST_PRIVATE_PROJECT_B' });
      server.quotes = [{ id: 'TEST_QUOTE', amount: 987654321, memo: 'TEST_PRIVATE_QUOTE' }];
      window.__previewServer = server; window.__previewResponse = { ok: true, exists: true, revision: 4, data: server };
      window.__previewBefore = paidStableJson(local); window.__previewRev = __relay.rev;
      Object.keys(calls).forEach(k => calls[k] = 0);
      __previewWriteKeys.length = 0;
      cloudApiLoad = async () => { calls.loads++; return __previewResponse; };
      relayConflictModal({ serverRevision: 4 });
    };
    __previewSeed();
  });
  await check('preview summarizes changes without applying, writing or exposing business records', async () => {
    await page.click('#ryConflictCompare');
    await page.waitForFunction(() => document.querySelector('#ryConflictPreview')?.textContent.includes('서버 revision 4'));
    const r = await page.evaluate(() => ({
      text: $('#ryConflictPreview').textContent, html: $('#ryConflictBox').outerHTML,
      calls: { ...__previewCalls }, same: __previewBefore === paidStableJson(hjConflictLocalSnapshot()), rev: __relay.rev,
      foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent)
    }));
    assert.match(r.text, /현장 — 기기 1 \/ 서버 2/); assert.match(r.text, /같은 식별자의 변경 1/);
    assert.match(r.text, /사진·파일 — 기기 1 \/ 서버 2/); assert.match(r.text, /견적 — 기기 0 \/ 서버 1/);
    assert.equal(r.calls.loads, 1); ['apply', 'snapshot', 'dirty', 'write', 'save', 'backup'].forEach(k => assert.equal(r.calls[k], 0, k + ' must be zero'));
    assert(r.same); assert.equal(r.rev, 3); assert.equal(r.foot.length, 3);
    assert(r.foot[0].startsWith('①')); assert(r.foot[1].startsWith('②')); assert(r.foot[2].startsWith('③'));
    assert(!/TEST_PRIVATE|TEST_DRIVE|987654321|TEST_COMPARE_TOKEN/.test(r.html), 'private records must not leak to the comparison DOM');
  });
  await check('pure summary is key-order-independent and reports duplicate identities as ambiguous', async () => {
    const r = await page.evaluate(() => {
      const a = hjConflictLocalSnapshot(), b = JSON.parse(JSON.stringify(a), (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v);
      const same = hjConflictSummary(a, b); b.files.push(structuredClone(b.files[0]));
      const duplicate = hjConflictSummary(a, b);
      return { same, duplicate };
    });
    assert.equal(r.same.otherChanges, 0); assert(r.same.rows.every(x => !x.changed && !x.localOnly && !x.serverOnly && !x.ambiguous));
    const f = r.duplicate.rows.find(x => x.label === '사진·파일'); assert.equal(f.ambiguous, 1); assert.equal(f.changed, 0);
  });
  async function pending() {
    await page.evaluate(() => {
      __previewSeed();
      cloudApiLoad = () => { __previewCalls.loads++; return new Promise(resolve => { window.__previewResolve = resolve; }); };
      window.__previewPending = relayConflictCompare($('#ryConflictBox'));
    });
  }
  async function finish() { await page.evaluate(async () => { __previewResolve(__previewResponse); await __previewPending; }); }
  await check('local edits while loading invalidate the preview and remain intact', async () => {
    await pending(); await page.evaluate(() => state.projects[0].stage = 4); await finish();
    assert.match(await page.locator('#ryConflictPreview').innerText(), /바뀌었습니다/);
    assert.equal(await page.evaluate(() => state.projects[0].stage), 4);
  });
  await check('URL, token and revision changes independently invalidate the preview', async () => {
    for (const field of ['url', 'token', 'rev']) {
      await pending(); await page.evaluate(field => __relay[field] = field === 'rev' ? __relay.rev + 1 : __relay[field] + 'TEST_CHANGED', field); await finish();
      assert.match(await page.locator('#ryConflictPreview').innerText(), /바뀌었습니다/, field);
    }
  });
  await check('closing and reopening the modal cannot receive an old async result', async () => {
    await pending();
    await page.evaluate(() => { window.__previewOldBox = $('#ryConflictBox'); closeModal(true); relayConflictModal({ serverRevision: 8 }); });
    await finish();
    assert.equal(await page.locator('#ryConflictPreview').innerText(), '');
    assert(!await page.evaluate(() => __previewOldBox.querySelector('#ryConflictPreview').textContent.includes('서버 revision')), 'old detached document must not render stale data');
  });
  await check('failed, empty and malformed server responses leave local state untouched and allow retry', async () => {
    for (const response of [{ ok: false, error: 'unauthorized' }, { ok: true, exists: false }, { ok: true, exists: true, data: {} }]) {
      await page.evaluate(response => { __previewSeed(); __previewResponse = response; }, response);
      await page.click('#ryConflictCompare'); await page.waitForFunction(() => !$('#ryConflictCompare').disabled);
      const r = await page.evaluate(() => ({ text: $('#ryConflictPreview').textContent, calls: { ...__previewCalls }, writeKeys: __previewWriteKeys, same: __previewBefore === paidStableJson(hjConflictLocalSnapshot()) }));
      assert(/실패|없습니다|완료하지 못했습니다/.test(r.text), r.text); assert(r.same); assert.equal(r.calls.apply, 0); assert.equal(r.calls.write, 0, JSON.stringify(r.writeKeys));
    }
  });
  await check('mobile button and content fit 360px and repeated clicks issue one load', async () => {
    await pending();
    await page.evaluate(() => { $('#ryConflictCompare').click(); });
    assert.equal(await page.evaluate(() => __previewCalls.loads), 1); await finish();
    const r = await page.evaluate(() => ({ height: $('#ryConflictCompare').getBoundingClientRect().height, scroll: $('#ryConflictBox').scrollWidth, client: $('#ryConflictBox').clientWidth }));
    assert(r.height >= 44, JSON.stringify(r)); assert(r.scroll <= r.client + 1, JSON.stringify(r));
  });
  await check('no browser errors', () => assert.deepEqual(errors, []));
  await browser.close(); browser = null;
  console.log('sync-conflict-preview: ' + passed + '/' + (passed + failed) + ' PASS');
  process.exitCode = failed ? 1 : 0;
})().catch(async e => { console.error('FAIL sync-conflict-preview: ' + e.stack); if (browser) await browser.close(); process.exitCode = 1; });

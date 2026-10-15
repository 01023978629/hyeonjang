/* v420 synthetic leak records only. HJ_V420_BASELINE=3d6bf16 must fail
   LEAK_DETECT_API_PRESENT. HJ_V420_MUTATION=legacy-tag must fail
   LEAK_TAG_LEGACY_READ. No real data, sharing, or remote writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_LEAK_PROJECT', INTERIOR = 'TEST_INTERIOR_PROJECT';
const AT = '2026-10-16T04:00:00.000Z';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
let browser, passed = 0;
const baseline = process.env.HJ_V420_BASELINE && execFileSync('git', ['show', process.env.HJ_V420_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [], network = { writes: 0 };
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(String(error)));
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
    window.__v420External = 0;
    window.open = () => { window.__v420External++; return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__v420External++; } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => typeof hjLeakDetectView === 'function' && typeof hjLeakSummary === 'function' && typeof hjPhotoLeakTag === 'function'), true, 'LEAK_DETECT_API_PRESENT');
  await page.evaluate(async () => { aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue; });
  if (process.env.HJ_V420_MUTATION) {
    assert.equal(process.env.HJ_V420_MUTATION, 'legacy-tag');
    await page.evaluate(() => { hjPhotoLeakTag = file => file && ['cause', 'before', 'after', 'device'].includes(file._leaktag) ? file._leaktag : ''; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS leakdetect-v420 ' + name); }
  async function close() {
    if (await page.locator('#lbClose').count()) await page.locator('#lbClose').click();
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, interior }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false;
      state._demo = false; state.dirHandle = null; state.dirty = false;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      const project = (name, kind) => ({ name, kind, stage: 1, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      state.projects = [project(leak, 'leak'), project(interior, 'interior')];
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      if (typeof __photoLeakFilter !== 'undefined') __photoLeakFilter = '';
      __relay.url = ''; __relay.token = ''; __gdToken = null;
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V420_SEED_SAVE_FAILED');
    }, { leak: LEAK, interior: INTERIOR });
  }
  async function stable() { return page.evaluate(() => { const data = serializeData(); data.savedAt = ''; return paidStableJson(data); }); }
  async function detect() {
    await page.locator('[data-leakdetect="' + LEAK + '"]').click();
    await page.locator('#hjLeakDetect').waitFor({ state: 'visible' });
  }
  async function shot(name) {
    if (!process.env.HJ_V420_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V420_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V420_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  async function method(label) { await page.locator('#hjLeakMethods [data-leak-method]').filter({ hasText: label }).click(); }
  async function fillDetect() {
    await method('청음'); await method('압력(온수)');
    await page.locator('#hjLeakCause').selectOption('온수관'); await page.locator('#hjLeakZone').selectOption('전유부');
    await page.locator('#hjLeakPlace').fill('TEST_DETECT_PLACE'); await page.locator('#hjLeakNote').fill('TEST_DETECT_NOTE');
    await page.locator('#hjLeakPressureFrom').fill('7.5'); await page.locator('#hjLeakPressureTo').fill('0');
    await page.locator('#hjLeakPressureUnit').selectOption('bar'); await page.locator('#hjLeakHumidity').fill('0');
    await page.locator('#hjLeakRevisit').check();
  }
  await test('explicit leak-only entry and read-only opening', async () => {
    await seed(); const before = await stable();
    assert.equal(await page.locator('[data-leakdetect="' + LEAK + '"]').count(), 1);
    await detect(); assert.equal(await stable(), before); await close();
    await page.evaluate(name => { state.activeProject = name; render(); }, INTERIOR);
    assert.equal(await page.locator('[data-leakdetect]').count(), 0, 'ordinary interior projects must not infer leak kind');
    await page.evaluate(name => { const p = state.projects.find(p => p.name === name); delete p.kind; render(); }, INTERIOR);
    assert.equal(await page.locator('[data-leakdetect]').count(), 0, 'pre-v419 projects without kind are not leak projects');
  });
  await test('real save retains zero measurements and asks before changing dispatch stage', async () => {
    await seed(); await detect(); await fillDetect();
    const sizes = await page.locator('#hjLeakMethods button, #hjLeakDetectSave').evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, h: node.getBoundingClientRect().height })));
    assert.equal(sizes.length, 11); assert(sizes.every(item => item.h >= 44), JSON.stringify(sizes));
    assert(await page.locator('#modalRoot .modal').evaluate(node => node.scrollWidth <= node.clientWidth + 1)); await shot('01-leak-detect');
    await page.locator('#hjLeakDetectSave').click(); await page.locator('#hjLeakStay').waitFor({ state: 'visible' });
    const result = await page.evaluate(async name => {
      const saved = await idbGetStrict('appState');
      return { p: state.projects.find(p => p.name === name), notes: state.notes.filter(n => n.project === name), storedProject: saved.projects.find(p => p.name === name), storedNotes: saved.notes.filter(n => n.project === name) };
    }, LEAK);
    assert.equal(result.p.stage, 1); assert.deepEqual(result.p.leak.detect.methods, ['청음', '압력(온수)']);
    assert.equal(result.p.leak.detect.cause, '온수관'); assert.equal(result.p.leak.detect.zone, '전유부');
    assert.equal(result.p.leak.detect.place, 'TEST_DETECT_PLACE'); assert.equal(result.p.leak.detect.note, 'TEST_DETECT_NOTE');
    assert.deepEqual(result.p.leak.detect.pressure, { from: 7.5, to: 0, unit: 'bar' });
    assert.equal(result.p.leak.detect.humidity, 0); assert.equal(result.p.leak.detect.revisit, true); assert(Number.isFinite(Date.parse(result.p.leak.detect.at)));
    assert.equal(result.notes.length, 1); assert.match(result.notes[0].text, /^\[탐지\] \d{4}-\d{2}-\d{2} 원인: 온수관 위치: TEST_DETECT_PLACE/);
    assert.deepEqual(result.storedProject.leak.detect, result.p.leak.detect, 'success prompt must wait for durable detection metadata');
    assert.deepEqual(result.storedNotes, result.notes, 'detection note must commit together with the detection');
    await page.locator('#hjLeakStay').click(); assert.equal(await page.evaluate(() => state.projects[0].stage), 1);
    await close(); await detect(); await page.locator('#hjLeakDetectSave').click();
    await page.locator('#hjLeakAdvance').waitFor({ state: 'visible' });
    for (const guard of ['stale', 'updating']) {
      const before = await stable();
      const stored = await page.evaluate(async () => JSON.stringify(await idbGetStrict('appState')));
      await page.evaluate(flag => { __tabStale = flag === 'stale'; __appVersionUpdating = flag === 'updating'; }, guard);
      try {
        await page.locator('#hjLeakAdvance').click();
        assert.equal(await page.locator('#hjLeakAdvance').count(), 1, guard + ' must keep the confirmation open');
        assert.equal(await page.evaluate(() => state.projects[0].stage), 1, guard + ' must not advance to repair');
        assert.equal(await page.locator('#modalRoot .clChk').count(), 0, guard + ' must not open the stage checklist');
        assert.equal(await stable(), before, guard + ' must not change detection, notes, or checklists');
        assert.equal(await page.evaluate(async () => JSON.stringify(await idbGetStrict('appState'))), stored);
      } finally { await page.evaluate(() => { __tabStale = false; __appVersionUpdating = false; }); }
    }
    await page.locator('#hjLeakAdvance').click();
    if (await page.locator('#modalRoot .clChk').count()) await page.getByRole('button', { name: '✅ 확인하고 진행', exact: true }).click();
    await page.waitForFunction(() => state.projects[0].stage === 2);
  });
  await test('durable save failure retains the form and data, then retry commits once', async () => {
    await seed(); await detect(); await fillDetect();
    const before = await stable(), stored = await page.evaluate(async () => JSON.stringify(await idbGetStrict('appState')));
    await page.evaluate(() => {
      window.__v420Atomic = { original: paidCommitWriteAtomic, calls: 0 };
      paidCommitWriteAtomic = async function () { __v420Atomic.calls++; throw Error('TEST_V420_ATOMIC_SAVE_FAILED'); };
    });
    try {
      await page.locator('#hjLeakDetectSave').click();
      await page.waitForFunction(() => document.getElementById('hjLeakDetectIssue')?.textContent.includes('TEST_V420_ATOMIC_SAVE_FAILED'));
      assert.equal(await page.evaluate(() => __v420Atomic.calls), 1, 'failure must occur at the atomic writer');
      assert.equal(await stable(), before, 'failed commit must not change live detection or notes');
      assert.equal(await page.evaluate(async () => JSON.stringify(await idbGetStrict('appState'))), stored, 'failed commit must not change appState');
      assert.equal(await page.locator('#hjLeakPlace').inputValue(), 'TEST_DETECT_PLACE');
      assert.equal(await page.locator('#hjLeakNote').inputValue(), 'TEST_DETECT_NOTE');
      assert.equal(await page.locator('#hjLeakHumidity').inputValue(), '0');
      assert.equal(await page.locator('#hjLeakRevisit').isChecked(), true);
      assert.equal(await page.locator('#hjLeakDetectSave').isEnabled(), true);
      assert.equal(await page.locator('#hjLeakAdvance').count(), 0);
    } finally { await page.evaluate(() => { paidCommitWriteAtomic = __v420Atomic.original; delete window.__v420Atomic; }); }
    await page.locator('#hjLeakDetectSave').click(); await page.locator('#hjLeakStay').waitFor({ state: 'visible' });
    const result = await page.evaluate(async () => ({ live: state.projects[0].leak.detect, notes: state.notes, stored: await idbGetStrict('appState') }));
    assert.equal(result.notes.length, 1, 'retry must create exactly one detection note');
    assert.deepEqual(result.stored.projects[0].leak.detect, result.live); assert.deepEqual(result.stored.notes, result.notes);
    await page.locator('#hjLeakStay').click();
  });
  await test('invalid measurements and duplicate names cannot overwrite data', async () => {
    await seed(); await detect(); await fillDetect();
    for (const [id, bad, valid] of [['#hjLeakHumidity', '101', '0'], ['#hjLeakPressureFrom', '-1', '7.5']]) {
      const before = await stable(); await page.locator(id).fill(bad); await page.locator('#hjLeakDetectSave').click();
      assert(await page.locator('#hjLeakDetectIssue').innerText()); assert.equal(await stable(), before, 'invalid field must not save partial detection'); await page.locator(id).fill(valid);
    }
    await close();
    await page.evaluate(() => state.projects.push(structuredClone(state.projects[0]))); const before = await stable();
    await page.evaluate(name => hjLeakDetectView(name), LEAK);
    assert.equal(await page.locator('#hjLeakDetect').count(), 0); assert.equal(await stable(), before, 'same-name projects require disambiguation before saving');
  });
  await test('three summary shapes preserve data and never invent dispatch', async () => {
    await seed();
    const result = await page.evaluate(at => {
      const intake = { where: ['욕실', '천장'], amount: '똑똑 떨어짐', neighbor: '아랫집에서 연락 옴', at: '2026-10-16T01:00:00.000Z' };
      const detect = { methods: ['청음', '압력(온수)'], cause: '온수관', zone: '전유부', place: 'TEST_SUMMARY_PLACE', pressure: { from: 0, to: 0, unit: 'bar' }, humidity: 0, note: '', revisit: false, at };
      return [{ intake }, { detect }, { intake, detect }].map(leak => {
        const p = { name: 'TEST_SUMMARY_PROJECT', kind: 'leak', stage: 1, leak }, before = paidStableJson(p), text = hjLeakSummary(p);
        return { text, before, after: paidStableJson(p) };
      });
    }, AT);
    result.forEach(row => { assert.equal(row.before, row.after); assert(!row.text.includes('undefined')); assert(!row.text.includes('NaN')); assert(!row.text.includes('출동'), 'no dispatch evidence must not create a dispatch date'); });
    assert.match(result[0].text, /접수.*욕실.*천장.*똑똑 떨어짐/); assert(!result[0].text.includes('온수관'));
    assert.match(result[1].text, /청음.*압력\(온수\).*온수관.*전유부.*TEST_SUMMARY_PLACE/); assert.match(result[1].text, /재방문 필요 없음/); assert(!result[1].text.includes('접수'));
    assert.match(result[2].text, /접수.*→.*청음/);
  });
  async function seedPhotos() {
    await seed();
    await page.evaluate(({ leak, interior, png, at }) => {
      const file = (id, project, more = {}) => ({ id, name: id + '.png', prefix: '', ext: 'png', size: 70, kind: 'photo', project,
        when: new Date(at), lat: null, lng: null, text: '', ocr: 'na', _worklabel: 'TEST_WORK_LABEL', _phase: 'TEST_PHASE', thumb: 'data:image/png;base64,' + png, ...more });
      state.files = [file('TEST_MEMORY_TAG', leak, { _leaktag: 'cause' }), file('TEST_LEGACY_TAG', leak, { leaktag: 'before' }), file('TEST_NO_TAG', leak), file('TEST_INTERIOR_TAG', interior, { _leaktag: 'after' })];
      state.activeProject = null; state.tab = 'photos'; __photoCache.key = null; render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
    }, { leak: LEAK, interior: INTERIOR, png: PNG, at: AT });
  }
  await test('memory and legacy tags both survive serialization and restore', async () => {
    await seedPhotos();
    const facts = await page.evaluate(() => ({ memory: hjPhotoLeakTag(state.files[0]), legacy: hjPhotoLeakTag(state.files[1]), invalid: hjPhotoLeakTag({ _leaktag: 'unknown' }), saved: serializeData() }));
    assert.equal(facts.memory, 'cause'); assert.equal(facts.legacy, 'before', 'LEAK_TAG_LEGACY_READ'); assert.equal(facts.invalid, '');
    assert.equal(facts.saved.files[0].leaktag, 'cause'); assert.equal(facts.saved.files[1].leaktag, 'before');
    assert(!Object.hasOwn(facts.saved, 'leaktag')); assert(!Object.hasOwn(facts.saved.files[0], '_leaktag'));
    const report = await page.evaluate(() => {
      const before = paidStableJson(state.files), groups = hjReportPhotoGroups(state.files);
      const caps = [
        { ...state.files[0], _worklabel: '시공 완료' },
        { ...state.files[1], _worklabel: '시공 완료' },
        { ...state.files[0], _leaktag: 'after', _worklabel: '시공 전' },
        { ...state.files[0], _leaktag: 'device', _worklabel: '시공 후' },
        { ...state.files[3], _worklabel: '시공 전' }
      ].map(rptPhotoCap);
      return { groups: groups.map(g => ({ tag: g.leakTag || '', n: g.n })), interior: hjReportPhotoGroups([state.files[3]]).map(g => ({ tag: g.leakTag || '', label: g.label })), caps, before, after: paidStableJson(state.files) };
    });
    assert.equal(report.before, report.after, 'report grouping/captions are read only');
    assert.deepEqual(report.groups, [{ tag: 'cause', n: 1 }, { tag: 'before', n: 1 }, { tag: '', n: 2 }]);
    assert.deepEqual(report.interior, [{ tag: '', label: 'TEST_WORK_LABEL' }], 'interior photographs retain the existing work-label grouping');
    assert.deepEqual(report.caps.map(cap => cap.tag), ['', '전', '후', '', '전'], 'explicit leak tags override inferred before/after captions only on leak projects');
    assert.match(report.caps[0].cap, /원인/); assert.match(report.caps[3].cap, /탐지 장비 화면/); assert(!report.caps[4].cap.includes('조치 후'));
    const restored = await page.evaluate(data => { state.files = []; applyData(data); return state.files.map(f => ({ name: f.name, tag: hjPhotoLeakTag(f), work: f._worklabel, phase: f._phase })); }, facts.saved);
    assert.equal(restored.find(f => f.name === 'TEST_MEMORY_TAG.png').tag, 'cause'); assert.equal(restored.find(f => f.name === 'TEST_LEGACY_TAG.png').tag, 'before');
    assert(restored.every(f => f.work === 'TEST_WORK_LABEL' && f.phase === 'TEST_PHASE'));
  });
  await test('real lightbox and more-menu chips keep work labels and filter exactly', async () => {
    await seedPhotos(); await page.locator('[data-light="TEST_MEMORY_TAG"]').first().click();
    await page.locator('#lightbox [data-leaktag="after"]').click();
    assert.equal(await page.evaluate(() => state.files[0]._leaktag), 'after');
    const size = await page.locator('#lightbox [data-leaktag]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height)); assert.equal(size.length, 4); assert(size.every(h => h >= 44));
    await shot('02-leak-photo'); await page.locator('#lbClose').click();
    await page.locator('[data-phmore="TEST_MEMORY_TAG"]').first().click();
    await page.locator('#modalRoot [data-leaktag="device"]').click();
    assert.equal(await page.evaluate(() => state.files[0]._leaktag), 'device'); await close();
    await page.locator('[data-photo-leakfilter="before"]').click();
    const visible = await page.locator('#view [data-light]').evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.light))]);
    assert.deepEqual(visible, ['TEST_LEGACY_TAG']);
    await page.locator('[data-photo-leakfilter="device"]').click();
    const devices = await page.locator('#view [data-light]').evaluateAll(nodes => [...new Set(nodes.map(node => node.dataset.light))]); assert.deepEqual(devices, ['TEST_MEMORY_TAG']);
    const fields = await page.evaluate(() => state.files.map(f => [f._worklabel, f._phase])); assert(fields.every(row => row[0] === 'TEST_WORK_LABEL' && row[1] === 'TEST_PHASE'));
    const before = await stable(); assert.equal(await page.evaluate(() => hjSetPhotoLeakTag('TEST_INTERIOR_TAG', 'cause')), false); assert.equal(await stable(), before);
    await shot('03-leak-filter');
  });
  await test('photo intake applies one tag only after actual confirmation', async () => {
    await seed();
    await page.evaluate(({ name, png, at }) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      openPhotoIntake([new File([bytes], 'TEST_LEAK_INTAKE.png', { type: 'image/png', lastModified: Date.parse(at) })], { project: name, source: 'gallery' });
    }, { name: LEAK, png: PNG, at: AT });
    await page.locator('#photoIntakeLeakTags [data-intake-leaktag="cause"]').click();
    await page.locator('#photoIntakeLeakTags [data-intake-leaktag="device"]').click();
    assert.equal(await page.evaluate(() => state.files.length), 0);
    await page.locator('#photoIntakeWork').fill('TEST_INTAKE_WORK'); await page.locator('#photoIntakeConfirm').click();
    await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
    const result = await page.evaluate(async () => ({ file: state.files[0], saved: await idbGetStrict('appState') }));
    assert.equal(result.file._leaktag, 'device'); assert.equal(result.file._worklabel, 'TEST_INTAKE_WORK'); assert.equal(result.file.project, LEAK);
    assert.equal(result.saved.files.find(f => f.name === 'TEST_LEAK_INTAKE.png').leaktag, 'device');
  });
  await test('shared photo metadata retry honors the newly selected tag without ingesting twice', async () => {
    await seed();
    await page.evaluate(async ({ png, at }) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('hyeonjang-share', 1);
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('inbox')) request.result.createObjectStore('inbox', { keyPath: 'id' }); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('inbox', 'readwrite');
          tx.objectStore('inbox').put({ id: 'TEST_V420_SHARE_RETRY', batchId: 'TEST_V420_BATCH', at: Date.now(), name: 'TEST_V420_SHARE_RETRY.png', type: 'image/png', size: bytes.length,
            lastModified: Date.parse(at), blob: new Blob([bytes], { type: 'image/png' }), title: '', text: '' });
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('TEST_SHARE_SEED_ABORT'));
        });
      } finally { db.close(); }
      window.__v420Retry = { realSave: guardedPersistCurrentState, realIngest: ingestFile, failSave: true, calls: 0 };
      guardedPersistCurrentState = async function (...args) { return __v420Retry.failSave ? false : __v420Retry.realSave.apply(this, args); };
      ingestFile = async function (...args) { __v420Retry.calls++; return __v420Retry.realIngest.apply(this, args); };
    }, { png: PNG, at: AT });
    const showShare = async () => {
      await close(); await page.evaluate(() => HJShareInbox.check({ force: true }));
      await page.locator('#hjShareInbox').waitFor({ state: 'visible' });
      const option = page.locator('#hjShareProject option').filter({ hasText: LEAK });
      await page.locator('#hjShareProject').selectOption(await option.getAttribute('value'));
      await page.locator('#hjShareImport').click(); await page.locator('#photoIntakeForm').waitFor({ state: 'visible' });
    };
    try {
      await showShare(); await page.locator('#photoIntakeWork').fill('TEST_SHARE_ORIGINAL_WORK');
      await page.locator('#photoIntakeLeakTags [data-intake-leaktag="before"]').click();
      await page.locator('#photoIntakeConfirm').click();
      assert.equal((await page.evaluate(() => window.__hjShareInboxLastDone)).status, 'failed');
      const first = await page.evaluate(async () => ({ file: state.files[0], rows: (await HJShareInbox.read()).map(row => ({ id: row.id, accepted: row.acceptedRecordId, staged: row.stagedRecordId, hasBlob: row.blob instanceof Blob })), stored: await idbGetStrict('appState') }));
      assert.equal(first.file._leaktag, 'before'); assert.equal(first.file._worklabel, 'TEST_SHARE_ORIGINAL_WORK');
      assert.equal(first.stored.files.length, 0, 'failed metadata must remain unaccepted');
      assert.equal(first.rows.length, 1); assert.equal(first.rows[0].accepted, undefined); assert.equal(first.rows[0].staged, first.file.id); assert.equal(first.rows[0].hasBlob, true);
      await page.evaluate(() => { clearTimeout(__idbSaveTimer); __tabStale = false; __v420Retry.failSave = false; });
      await showShare(); await page.locator('#photoIntakeWork').fill('TEST_SHARE_CHANGED_WORK');
      await page.locator('#photoIntakeLeakTags [data-intake-leaktag="after"]').click();
      await page.locator('#photoIntakeConfirm').click();
      assert.equal((await page.evaluate(() => window.__hjShareInboxLastDone)).status, 'complete');
      const retry = await page.evaluate(async () => ({ files: state.files, calls: __v420Retry.calls, saved: await idbGetStrict('appState'), rows: await Promise.all((await HJShareInbox.read()).map(async row => ({ accepted: row.acceptedRecordId, bytes: row.blob ? [...new Uint8Array(await row.blob.arrayBuffer())] : null }))) }));
      assert.equal(retry.files.length, 1); assert.equal(retry.calls, 1, 'retry must reuse the staged original');
      assert.equal(retry.files[0].id, first.file.id); assert.equal(retry.files[0]._leaktag, 'after', 'SHARED_RETRY_EXPLICIT_TAG');
      assert.equal(retry.files[0]._worklabel, first.file._worklabel); assert.equal(retry.files[0]._phase, first.file._phase);
      assert.equal(retry.saved.files[0].leaktag, 'after'); assert.equal(retry.rows[0].accepted, first.file.id);
      assert.deepEqual(Buffer.from(retry.rows[0].bytes), Buffer.from(PNG, 'base64'), 'accepted original bytes are retained');
    } finally {
      await page.evaluate(() => { guardedPersistCurrentState = __v420Retry.realSave; ingestFile = __v420Retry.realIngest; delete window.__v420Retry; });
    }
  });
  await test('menu126, mobile width, no page errors or external writes', async () => {
    await close(); assert.equal(await page.evaluate(() => MORE_CATS.reduce((n, category) => n + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.equal(await page.evaluate(() => __v420External), 0);
  });
  console.log(`leakdetect-v420: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(error => { console.error('FAIL leakdetect-v420', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

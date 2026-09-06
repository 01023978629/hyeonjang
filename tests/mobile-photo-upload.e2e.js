/* 모바일 사진 올리기: 승인 전 무변경, 현장/작업명 고정, 파일별 정확한 연결.
   실제 PNG -> ingestFile -> 압축 -> relayUploadFiles를 실행하며 네트워크만 모의한다.
   고객 자료/계정/외부 서버는 사용하지 않는다. static-server.js(8299) 필요.
   HJ_PHOTO_UPLOAD_MUTATION=project|targets|restore-edits: 배정/ID 연결/동명 분리를 깨면
   같은 회귀가 실패해야 한다. 운영 파일 및 저장 구조는 변경하지 않는다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_PHOTO_UPLOAD_MUTATION || '';
assert(['', 'project', 'targets', 'restore-edits'].includes(MUTATION), 'unknown HJ_PHOTO_UPLOAD_MUTATION');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const A = '테스트 가 현장';
const B = '테스트 나 현장';
const WORK = '욕실 배관 연결 및 미장';
let browser, passed = 0;
const pick = (name = 'photo-a.png') => ({ name, mimeType: 'image/png', buffer: PNG });

async function boot(width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true,
    hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN
    ? route.continue() : route.abort());
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  await page.evaluate(({ a, b, options, mutation }) => {
    const project = name => ({ name, archived: false, stage: 1, received: 0, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: {} });
    state.projects = [project(a), project(b)]; state.files = [];
    if (options.document) state.files.push({ id: 'existing-document', name: 'existing-note.pdf', kind: 'other', ext: 'pdf',
      project: a, size: 3, thumb: null, _virtual: true, when: new Date('2026-09-01') });
    state.activeProject = options.noProject ? null : a; state.tab = 'photos'; state.search = '';
    state._demo = false; state.dirty = false; state.dirHandle = null;
    __photoCache.key = null; __sel.clear(); __selMode = false; __tabStale = false;
    window.__uploadEvents = []; window.__uploadCalls = []; window.__driveCalls = [];
    window.__ingestCalls = []; window.__snapshotCalls = []; window.__uploadMutationApplied = 0;
    window.__uploadOptions = options;
    if (options.queueQuota) {
      const nativeIdbSet = idbSet;
      idbSet = async function(key, value) {
        if (key === 'relay_queue') throw new DOMException('가상 큐 저장 공간 부족', 'QuotaExceededError');
        return nativeIdbSet.apply(this, arguments);
      };
    }
    const nativeSnapshot = hjSnapshot;
    hjSnapshot = async function(label, force, allowEmpty) {
      window.__snapshotCalls.push({ label, force, allowEmpty });
      if (force) window.__uploadEvents.push('snapshot');
      if (force && options.snapshotFail) return false;
      return nativeSnapshot.apply(this, arguments);
    };
    const nativeIngest = ingestFile;
    ingestFile = async function(file, ...args) {
      window.__ingestCalls.push(file.name); window.__uploadEvents.push('ingest:' + file.name);
      if (options.pauseIngest && window.__ingestCalls.length === 1) {
        window.__ingestEntered = true;
        await new Promise(resolve => { window.__releaseIngest = resolve; });
      }
      if (file.name === options.ingestFail) throw new Error('가상 파일 읽기 실패');
      if (mutation === 'restore-edits' && args[2] && args[2].restoreEdits === false) {
        args[2] = null; window.__uploadMutationApplied++;
      }
      const record = await nativeIngest.call(this, file, ...args);
      if (mutation === 'project') {
        Object.defineProperty(record, 'project', { configurable: true, enumerable: true, get: () => null, set: () => {} });
        window.__uploadMutationApplied++;
      }
      return record;
    };
    relayReady = () => options.network === 'relay';
    __gdToken = options.network === 'drive' ? 'FAKE-TEST-DRIVE-TOKEN' : null;
    relayCall = async function(action, payload) {
      if (action !== 'upload') return { ok: true, revision: 1, files: [] };
      window.__uploadCalls.push({ name: payload.name, mimeType: payload.mimeType, kind: payload.kind, size: payload.dataB64.length });
      window.__uploadEvents.push('upload:' + payload.name);
      if (payload.name === options.remoteFail) return { ok: false, error: 'test-upload-failed', message: '가상 서버 실패' };
      if (options.offline) throw new Error('가상 오프라인');
      return { ok: true, fileId: 'fake-upload-' + window.__uploadCalls.length, mimeType: payload.mimeType,
        size: Math.floor(payload.dataB64.length * 3 / 4) };
    };
    gdUploadBlob = async function(file, name, mime, folder) {
      window.__driveCalls.push({ name, mime, folder }); window.__uploadEvents.push('drive:' + name);
      if (name === options.remoteFail) throw new Error('가상 Drive 실패');
      return 'fake-direct-' + window.__driveCalls.length;
    };
    if (mutation === 'targets') {
      const nativeUpload = relayUploadFiles;
      relayUploadFiles = async function(files, kind, targets, report) {
        if (targets && targets.length > 1) {
          window.__uploadMutationApplied++;
          targets = targets.slice().reverse();
        }
        return nativeUpload.call(this, files, kind, targets, report);
      };
    }
    window.__originalProjectsJson = JSON.stringify(state.projects);
    render(); syncMobileNav();
  }, { a: A, b: B, options, mutation: MUTATION });
  return { page, context, errors, width };
}

async function finish(test, name) {
  assert.deepEqual(test.errors, [], 'pageerror 0');
  assert(await test.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no viewport overflow');
  passed++; console.log('PASS  ' + test.width + 'px ' + name);
}
async function scenario(width, options, name, fn) {
  const test = await boot(width, options);
  try { await fn(test.page); await finish(test, name); }
  finally {
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' + await test.page.evaluate(() => window.__uploadMutationApplied).catch(() => 0));
    await test.context.close();
  }
}

async function gallery(page, files) {
  await page.locator('#btnGdPhotos').waitFor({ state: 'visible' });
  const chooser = page.waitForEvent('filechooser'); await page.locator('#btnGdPhotos').click();
  const input = await chooser;
  assert.equal(await input.element().getAttribute('capture'), null, 'gallery must not force the camera');
  assert.equal(await input.element().getAttribute('id'), 'photoGalleryInput');
  assert.equal(await input.isMultiple(), true);
  await input.setFiles(files);
  await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
}
async function approve(page) {
  await page.locator('#photoIntakeWork').fill(WORK);
  await page.locator('#photoIntakeConfirm').click();
}
async function result(page) {
  await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !__photoIntakeBusy);
  assert.equal(await page.locator('#photoIntakeResult').getAttribute('role'), 'status');
  return page.locator('#photoIntakeResult').innerText();
}
async function expandedResult(page) {
  for (const summary of await page.locator('#photoIntakeResult details:not([open]) summary').all()) await summary.click();
  return page.locator('#photoIntakeResult').innerText();
}
async function facts(page) {
  return page.evaluate(() => ({ files: state.files.map(f => ({ id: f.id, name: f.name, project: f.project,
    kind: f.kind, work: f._worklabel || '', driveId: f._driveId || '', localFile: !!f._file })),
    ingest: window.__ingestCalls, uploads: window.__uploadCalls, direct: window.__driveCalls,
    snapshots: window.__snapshotCalls, events: window.__uploadEvents, active: state.activeProject,
    unchangedProjects: JSON.stringify(state.projects) === window.__originalProjectsJson }));
}
async function assertTouchModal(page) {
  const controls = await page.locator('#modalRoot button:visible, #modalRoot input:visible, #modalRoot select:visible, #modalRoot textarea:visible').evaluateAll(nodes => nodes.map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.id || el.className, w: r.width, h: r.height,
      label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || el.textContent };
  }));
  assert(controls.length >= 4);
  assert.deepEqual(controls.filter(el => el.w < 44 || el.h < 44), [], 'modal controls must be at least 44px');
  assert.deepEqual(controls.filter(el => !el.label), [], 'modal controls have accessible names');
  assert(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'no modal overflow');
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  for (const width of [390, 360]) {
    await scenario(width, { network: 'relay' }, '빈 사진함 갤러리, 승인 전 무변경, 정확한 현장·작업·서버 연결', async page => {
      await gallery(page, [pick(), pick('photo-b.png')]);
      await assertTouchModal(page);
      if (width === 390 && process.env.HJ_PHOTO_UPLOAD_SCREENSHOT) {
        await page.locator('#modalRoot .modal').screenshot({ path: process.env.HJ_PHOTO_UPLOAD_SCREENSHOT });
      }
      assert.equal(await page.locator('#photoIntakeProject').inputValue(), '1', 'active project is prefilled');
      assert.equal(await page.locator('#photoIntakeWork').getAttribute('maxlength'), '80');
      let f = await facts(page);
      assert.deepEqual([f.files.length, f.ingest.length, f.uploads.length, f.snapshots.length], [0, 0, 0, 0], 'selecting files alone has no data/network/backup effect');
      await approve(page); const text = await result(page); f = await facts(page);
      assert.equal(f.files.length, 2);
      assert.deepEqual(f.files.map(row => [row.name, row.project, row.work, row.driveId]),
        [['photo-a.png', A, WORK, 'fake-upload-1'], ['photo-b.png', A, WORK, 'fake-upload-2']]);
      assert(f.unchangedProjects, 'upload does not rewrite project data');
      assert.deepEqual(f.events.slice(0, 3), ['snapshot', 'ingest:photo-a.png', 'ingest:photo-b.png']);
      assert.equal(f.snapshots.filter(s => s.force === true && s.allowEmpty === true).length, 1, 'one forced pre-import snapshot allows an initially empty app');
      assert(f.uploads.every(row => row.mimeType === 'image/jpeg' && row.kind === 'photo' && row.size > 0), 'real image compression produces the network payload');
      assert.match(text, /2/);
      assert.match(text, /서버|백업/);
    });
  }

  await scenario(390, { noProject: true, document: true }, '현장 필수 확인·명시 미배정·취소·키보드 복귀', async page => {
    await gallery(page, [pick()]);
    assert.equal(await page.locator('#photoIntakeProject').inputValue(), '');
    await page.locator('#photoIntakeConfirm').click();
    await page.locator('#photoIntakeIssue').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#photoIntakeIssue').getAttribute('role'), 'alert');
    assert.deepEqual((await facts(page)).ingest, []);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('photoIntakeProject') && document.activeElement === document.getElementById('btnGdPhotos'));
    assert.equal((await facts(page)).files.length, 1, 'Escape preserves pre-existing document');
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
    await gallery(page, [pick('unassigned.png')]);
    await page.locator('#photoIntakeProject').selectOption('none'); await approve(page); await result(page);
    const added = (await facts(page)).files.find(f => f.name === 'unassigned.png');
    assert.equal(added.project, null, 'unassigned exists only through the explicit choice');
  });

  await scenario(390, { network: 'relay', pauseIngest: true, ingestFail: 'broken.png' }, '중간 읽기 실패·현장 변경·외부 추가에도 대상과 ID 유지, 중복 탭 차단', async page => {
    await gallery(page, [pick(), pick('broken.png'), pick('photo-c.png')]); await approve(page);
    await page.waitForFunction(() => window.__ingestEntered === true && __photoIntakeBusy === true);
    await page.evaluate(() => { window.__uploadBackEvents = 0; addEventListener('popstate', () => window.__uploadBackEvents++); });
    for (const expectedEvents of [1, 2]) {
      const previousMarker = await page.evaluate(() => mobileSheetHistoryMarker());
      assert(previousMarker, 'busy modal owns a history entry');
      await page.evaluate(() => history.back());
      await page.waitForFunction(({ marker, count }) => window.__uploadBackEvents >= count &&
        mobileSheetHistoryMarker() && mobileSheetHistoryMarker() !== marker && __photoIntakeBusy &&
        document.getElementById('photoIntakeProgress'), { marker: previousMarker, count: expectedEvents });
      assert.equal(page.url(), APP, 'repeated Back must not leave the app during intake');
    }
    await page.evaluate(b => {
      state.activeProject = b;
      state.files.push({ id: 'foreign-append', name: 'foreign.png', ext: 'png', kind: 'photo', project: b, size: 1, _virtual: true });
      document.getElementById('photoIntakeConfirm')?.click();
      gdUploadPhotos(); triggerCameraInput();
    }, B);
    assert.deepEqual((await facts(page)).ingest, ['photo-a.png'], 'busy handling cannot start an overlapping ingest');
    await page.evaluate(() => window.__releaseIngest());
    const text = await result(page), f = await facts(page);
    assert.deepEqual(f.files.filter(row => row.id !== 'foreign-append').map(row => [row.name, row.project, row.work, row.driveId]),
      [['photo-a.png', A, WORK, 'fake-upload-1'], ['photo-c.png', A, WORK, 'fake-upload-2']]);
    assert.deepEqual(f.files.find(row => row.id === 'foreign-append'), { id: 'foreign-append', name: 'foreign.png', project: B,
      kind: 'photo', work: '', driveId: '', localFile: false });
    assert.deepEqual(f.uploads.map(row => row.name), ['photo-a.png', 'photo-c.png']);
    assert.match(await expandedResult(page), /broken\.png/); assert.match(text, /실패/);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !document.getElementById('photoIntakeResult') && !document.querySelector('#modalRoot .modal'));
    assert.equal(page.url(), APP, 'after completion Back closes the result and stays in the app');
  });

  await scenario(390, { snapshotFail: true, network: 'relay' }, '안전판 실패면 사진 추가·전송 중단', async page => {
    await gallery(page, [pick()]); await approve(page);
    await page.waitForFunction(() => !__photoIntakeBusy && /안전판|스냅샷/.test(document.getElementById('photoIntakeIssue')?.textContent || document.getElementById('photoIntakeResult')?.textContent || ''));
    const f = await facts(page);
    assert.deepEqual([f.files.length, f.ingest.length, f.uploads.length], [0, 0, 0]);
    assert.equal(f.snapshots.filter(row => row.force).length, 1);
  });

  await scenario(390, {}, '연결 없는 폰은 앱 추가와 서버 미백업을 구분', async page => {
    await gallery(page, [pick()]); await approve(page); const text = await result(page), f = await facts(page);
    assert.equal(f.files[0].project, A); assert.equal(f.files[0].work, WORK); assert(f.files[0].localFile);
    assert.deepEqual([f.uploads.length, f.direct.length, f.files[0].driveId], [0, 0, '']);
    assert.match(text, /서버|드라이브|백업/); assert.match(text, /연결|미완료|없|되지|미백업|실행하지 않았/);
    assert.doesNotMatch(text, /원본.*(?:영구|안전하게 저장)|(?:서버|드라이브).*백업 완료/);
  });

  await scenario(390, { network: 'drive', remoteFail: 'photo-b.png' }, '직접 Drive 일부 실패를 구분하고 파일 연결 유지', async page => {
    await gallery(page, [pick(), pick('photo-b.png')]); await approve(page);
    const text = await result(page), f = await facts(page);
    assert.deepEqual(f.files.map(row => [row.project, row.driveId]), [[A, 'fake-direct-1'], [A, '']]);
    assert.equal(f.uploads.length, 0); assert.equal(f.direct.length, 2);
    assert.match(text, /실패/); assert.match(await expandedResult(page), /photo-b\.png/);
  });

  await scenario(390, { network: 'relay', remoteFail: 'photo-b.png' }, '서버 일부 실패를 구분하고 성공 사진만 ID 연결', async page => {
    await gallery(page, [pick(), pick('photo-b.png')]); await approve(page);
    const text = await result(page), f = await facts(page);
    assert.deepEqual(f.files.map(row => [row.project, row.driveId]), [[A, 'fake-upload-1'], [A, '']]);
    assert.equal(f.uploads.length, 2); assert.equal(f.direct.length, 0);
    assert.match(text, /백업 확인 1장/); assert.match(text, /백업 실패 1장/);
    assert.match(await expandedResult(page), /photo-b\.png/);
  });

  await scenario(390, { network: 'relay', offline: true }, '통신 실패는 성공으로 표시하지 않고 전송 대기로 구분', async page => {
    await gallery(page, [pick()]); await approve(page); const text = await result(page), f = await facts(page);
    assert.equal(f.files.length, 1); assert.equal(f.files[0].driveId, '');
    const queue = await page.evaluate(async () => (await idbGet('relay_queue') || []).filter(row => row.action === 'upload'));
    assert.equal(queue.length, 1, 'existing durable relay queue receives the compressed upload');
    assert.match(text, /대기/);
  });

  await scenario(390, { network: 'relay', offline: true, queueQuota: true }, '대기열 저장 실패를 전송 대기로 오표시하지 않음', async page => {
    await gallery(page, [pick()]); await approve(page); const text = await result(page), f = await facts(page);
    assert.equal(f.files.length, 1); assert.equal(f.files[0].driveId, '');
    const queue = await page.evaluate(async () => (await idbGet('relay_queue') || []).filter(row => row.action === 'upload'));
    assert.equal(queue.length, 0);
    assert.match(text, /전송 대기 0장/); assert.match(text, /백업 실패 1장/);
    assert.match(await expandedResult(page), /photo-a\.png/);
    const connection = page.locator('#modalRoot .mfoot button').filter({ hasText: '연결·대기열 확인' });
    assert.equal(await connection.count(), 1, 'backup failure has a concrete recovery action');
    await connection.click();
    await page.locator('#photoIntakeResult').waitFor({ state: 'detached' });
    await page.locator('#modalRoot .modal').waitFor({ state: 'visible' });
    assert.match(await page.locator('#modalRoot').innerText(), /저장|백업|설정/);
    assert.equal((await facts(page)).uploads.length, 1, 'opening settings does not retry or duplicate the upload');
  });

  await scenario(390, {}, '동명 새 사진에 기존 사진 Drive ID·OCR·공정이 승계되지 않음', async page => {
    await page.evaluate(({ b, png }) => {
      const old = { id: 'original-same-name', name: 'same-name.png', prefix: '_정리완료/이전현장/', ext: 'png', kind: 'photo',
        project: b, when: new Date('2026-08-01T09:00:00'), size: 200, thumb: 'data:image/png;base64,' + png,
        _driveId: 'fake-previous-drive-id', _driveMimeType: 'image/png', _driveSize: 200,
        _phase: '이전 공정', _worklabel: '이전 작업', text: '이전 OCR 원문', ocr: 'done', _virtual: true };
      state.files.push(old); backupUserEdits(); __photoCache.key = null; render();
      window.__previousPhoto = old; window.__previousPhotoJson = JSON.stringify(old);
    }, { b: B, png: PNG.toString('base64') });
    await gallery(page, [pick('same-name.png')]); await approve(page); await result(page);
    const out = await page.evaluate(() => {
      const old = state.files.find(f => f.id === 'original-same-name');
      const added = state.files.find(f => f.name === 'same-name.png' && f.id !== 'original-same-name');
      return { count: state.files.length, unchanged: old === window.__previousPhoto && JSON.stringify(old) === window.__previousPhotoJson,
        added: { project: added.project, work: added._worklabel, driveId: added._driveId || '',
          text: added.text, ocr: added.ocr, phase: added._phase || '', driveSize: added._driveSize } };
    });
    assert.equal(out.count, 2);
    assert.deepEqual(out.added, { project: A, work: WORK, driveId: '', text: '', ocr: 'pending', phase: '', driveSize: 0 });
    assert(out.unchanged, 'existing photo object and all its metadata remain unchanged');
  });

  await scenario(390, { network: 'relay' }, '카메라도 확인 후 동일한 안전 업로드 흐름 사용', async page => {
    const chooser = page.waitForEvent('filechooser'); await page.locator('[data-mnav="__camera"]').click();
    const input = await chooser;
    assert.equal(await input.element().getAttribute('capture'), 'environment');
    await input.setFiles([pick('camera.png')]); await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
    assert.equal((await facts(page)).ingest.length, 0);
    await approve(page); await result(page);
    assert.deepEqual((await facts(page)).files.map(row => [row.name, row.project, row.work, row.driveId]), [['camera.png', A, WORK, 'fake-upload-1']]);
  });
  console.log('\n== mobile-photo-upload: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => { console.error('FAIL mobile-photo-upload', error && error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

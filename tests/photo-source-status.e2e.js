/* v265: 사진 보관 상태를 읽는 것만으로 파일/배정/저장/서버를 변경하지 않는다.
   8299 로컬 서버의 새 브라우저 컨텍스트와 가상 사진만 사용한다.
   HJ_PHOTO_SOURCE_MUTATION=classify|filter: 페이지 함수만 잘못된 결과로
   바꿔 같은 검사의 분류/검색 단언이 실패하는지 확인한다. 운영 데이터는 사용하지 않는다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_PHOTO_SOURCE_MUTATION || '';
assert(['', 'classify', 'filter'].includes(MUTATION), 'unknown HJ_PHOTO_SOURCE_MUTATION');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const A = '가상 가 현장';
const B = '가상 나 현장';
const XSS = '<img src=x onerror=window.__sourceXss=1>';
let browser, passed = 0;

async function boot(width = 390, count = 0) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600,
    hasTouch: width < 600, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => requests.push(r.url()));
  // The mobile bootstrap preloads GIS after its separate pref_mobile IDB read. Let
  // that existing request finish before attributing network activity to this panel.
  const gisPreloadDone = page.waitForEvent('requestfailed', {
    predicate: request => request.url() === 'https://accounts.google.com/gsi/client', timeout: 20000
  });
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_ver_checked_at', String(Date.now()));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await gisPreloadDone;
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  await page.evaluate(({ a, b, png, xss, count, mutation }) => {
    const project = name => ({ name, archived: false, stage: 1, received: 0, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: {} });
    const tinyFile = () => new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], 'virtual-original.png', { type: 'image/png' });
    window.__sourceCalls = { markDirty: 0, idbSet: 0, relay: 0, upload: 0, persist: 0,
      getFile: 0, permission: 0, fetch: 0, xhr: 0, settings: 0 };
    const handle = () => ({
      getFile() { window.__sourceCalls.getFile++; throw new Error('read-only panel must not open files'); },
      requestPermission() { window.__sourceCalls.permission++; throw new Error('read-only panel must not request permission'); }
    });
    let serial = 0;
    const photo = (id, extra = {}) => ({ id, name: id + '.png', kind: 'photo', ext: 'png', size: ++serial + 200,
      project: a, when: new Date('2026-09-07T01:00:00Z'), _virtual: true, thumb: null, ...extra });
    state.projects = [project(a), project(b), project(xss)];
    state.files = count ? Array.from({ length: count }, (_, i) => {
      const kind = ['missing', 'preview', 'session', 'folder', 'remote'][i % 5];
      const extras = { project: i % 3 === 0 ? null : i % 3 === 1 ? a : b,
        when: new Date(Date.UTC(2026, 8, 7, 1, i)), _worklabel: '가상 작업 ' + i, _phase: '시공 중' };
      if (kind === 'preview') extras.thumb = 'data:image/png;base64,' + png;
      if (kind === 'session') extras._file = tinyFile();
      if (kind === 'folder') extras.handle = handle();
      if (kind === 'remote') { extras._driveId = 'FAKE-DRIVE-' + i; extras.thumb = 'data:image/png;base64,' + png; }
      return photo('virtual-' + String(i).padStart(2, '0'), extras);
    }) : [
      photo('remote-drive', { _driveId: 'FAKE-DRIVE-ID', _file: tinyFile(), handle: handle(), thumb: 'data:image/png;base64,' + png }),
      photo('remote-relay', { _relayLink: 'relay:FAKE-RELAY-ID', project: b }),
      photo('session', { _file: tinyFile(), handle: handle(), thumb: 'data:image/png;base64,' + png, _worklabel: '욕실 PVC 배관 보수', _phase: '시공 전' }),
      photo('folder', { handle: handle(), thumb: 'data:image/png;base64,' + png, project: b, _phase: '미 장 완료' }),
      photo('preview', { thumb: 'data:image/png;base64,' + png, project: null, when: new Date('2026-09-08T01:00:00Z') }),
      photo('missing', { _driveId: '', _relayLink: 'relay:', _file: new Blob([]), handle: {}, project: null }),
      photo('missing-invalid-file', { _file: { size: 10 }, _relayLink: 'https://example.invalid/not-a-relay' }),
      photo('xss', { name: xss + '.png', project: xss, _worklabel: xss, _phase: xss })
    ];
    state.files.push({ id: 'not-a-photo', name: 'virtual-document.pdf', kind: 'other', ext: 'pdf', project: a, thumb: 'data:image/png;base64,' + png });
    state.activeProject = a; state.tab = 'photos'; state.search = '';
    state._demo = false; state.dirty = false; state.dirHandle = null;
    __photoCache.key = null; __sel.clear(); __sel.add(state.files[0].id); __selMode = true;
    __showDup = false; __photoMoreOpen = true; __tabStale = false; relayReady = () => false; __gdToken = null;
    window.__sourceXss = 0; window.__sourceMutationApplied = 0;
    if (mutation === 'classify') {
      const nativeInfo = photoSourceInfo;
      photoSourceInfo = function(file) {
        const source = nativeInfo.apply(this, arguments);
        if (source.key === 'preview') { window.__sourceMutationApplied++; return { ...source, key: 'remote' }; }
        return source;
      };
    }
    if (mutation === 'filter') {
      const nativeFilter = photoSourceFilterRows;
      photoSourceFilterRows = function(rows, project, kind, search) {
        if (search) window.__sourceMutationApplied++;
        return nativeFilter.call(this, rows, project, kind, '');
      };
    }
    render(); syncMobileNav();
    // The ordinary gallery treats a whitespace legacy ID as a thumbnail URL. Seed that
    // invalid metadata after rendering so the separate read-only classifier owns this check.
    if (!count) state.files.find(f => f.id === 'missing')._driveId = ' ';
  }, { a: A, b: B, png: PNG, xss: XSS, count, mutation: MUTATION });
  await page.evaluate(async () => {
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    // Existing list filters/selections are deliberately distinct from the inspection panel.
    state.search = '기존 사진 목록 검색';
    window.__sourceSnapshot = JSON.stringify({ files: state.files, projects: state.projects,
      active: state.activeProject, search: state.search, selected: [...__sel], mode: __selMode, dirty: state.dirty });
    window.__sourceFileRefs = state.files.slice(); window.__sourceProjectRefs = state.projects.slice();
    for (const [name, key] of [['markDirty', 'markDirty'], ['idbSet', 'idbSet'], ['relayCall', 'relay'],
      ['gdUploadBlob', 'upload'], ['guardedPersistCurrentState', 'persist']]) {
      window[name] = function() { window.__sourceCalls[key]++; throw new Error('read-only inspection called ' + name); };
    }
    window.fetch = function() { window.__sourceCalls.fetch++; return Promise.reject(new Error('read-only inspection requested network')); };
    XMLHttpRequest.prototype.open = function() { window.__sourceCalls.xhr++; throw new Error('read-only inspection used XHR'); };
    openGdriveSetup = function() { window.__sourceCalls.settings++; };
  });
  return { context, page, errors, requests, baselineRequests: requests.length, width };
}

async function unchanged(test, settings = 0) {
  const facts = await test.page.evaluate(() => ({ same: window.__sourceSnapshot === JSON.stringify({ files: state.files,
    projects: state.projects, active: state.activeProject, search: state.search, selected: [...__sel], mode: __selMode, dirty: state.dirty }),
    refs: state.files.every((f, i) => f === window.__sourceFileRefs[i]) && state.projects.every((p, i) => p === window.__sourceProjectRefs[i]),
    calls: window.__sourceCalls, xss: window.__sourceXss }));
  assert.deepEqual(facts, { same: true, refs: true, calls: { markDirty: 0, idbSet: 0, relay: 0, upload: 0, persist: 0,
    getFile: 0, permission: 0, fetch: 0, xhr: 0, settings }, xss: 0 }, 'read-only inspection preserves original objects/data/selection and has no I/O');
  assert.deepEqual(test.requests.slice(test.baselineRequests), [], 'no image/other requests while inspecting status');
}
async function scenario(name, fn, width = 390, count = 0) {
  const test = await boot(width, count);
  try {
    await fn(test);
    assert.deepEqual(test.errors, [], 'pageerror 0');
    passed++; console.log('PASS ' + width + 'px ' + name);
  } finally {
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' + await test.page.evaluate(() => window.__sourceMutationApplied).catch(() => 0));
    await test.context.close();
  }
}
async function openPanel(page, menu = false) {
  if (menu) {
    await page.locator('#btnPhotoTools').click();
    const item = page.locator('.ptBtn[data-fn="photoSourceView"]');
    await item.waitFor({ state: 'visible' }); await item.click();
  } else await page.evaluate(() => photoSourceView());
  await page.locator('#photoSourcePanel').waitFor({ state: 'visible' });
}
async function rows(page) {
  return page.locator('#photoSourceList [data-source-key]').evaluateAll(nodes => nodes.map(el => ({
    id: el.getAttribute('data-photo-id') || el.getAttribute('data-file-id'), key: el.dataset.sourceKey, text: el.textContent
  })));
}
async function touchControls(page) {
  const controls = await page.locator('#modalRoot button:visible, #modalRoot input:visible, #modalRoot select:visible').evaluateAll(nodes => nodes.map(el => {
    const r = el.getBoundingClientRect(); return { id: el.id || el.className, w: r.width, h: r.height,
      label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || el.textContent };
  }));
  assert(controls.length >= 6, 'filter/search/reset/settings controls are available');
  assert.deepEqual(controls.filter(c => c.w < 44 || c.h < 44), [], 'interactive controls at least 44px');
  assert.deepEqual(controls.filter(c => !c.label), [], 'interactive controls have accessible names');
  assert(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'modal no horizontal overflow');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'viewport no horizontal overflow');
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await scenario('분류 우선순위·빈 연결·문서 제외·위험 우선 정렬·서버 미검증 안내', async test => {
    const result = await test.page.evaluate(() => ({ source: state.files.filter(f => f.kind === 'photo').map(f => [f.id, photoSourceInfo(f)]),
      rows: photoSourceRows().map(row => ({ id: row.file.id, key: row.source.key })) }));
    assert.deepEqual(result.source.map(([id, info]) => [id, info.key]), [
      ['remote-drive', 'remote'], ['remote-relay', 'remote'], ['session', 'session'], ['folder', 'folder'],
      ['preview', 'preview'], ['missing', 'missing'], ['missing-invalid-file', 'missing'], ['xss', 'missing']
    ], 'preview-only / empty Blob / invalid relay are not remotely backed up');
    for (const [, info] of result.source) assert(info.label && info.detail, 'every source has a human-readable label and limitation');
    assert.match(result.source[0][1].detail, /미확인|확인하지|검증하지|확인한.*아/);
    const priority = { missing: 0, preview: 1, session: 2, folder: 3, remote: 4 };
    assert.deepEqual(result.rows.map(r => priority[r.key]), [0, 0, 0, 1, 2, 3, 4, 4], 'attention-needed rows appear first');
    assert(!result.rows.some(r => r.id === 'not-a-photo'), 'other documents are excluded');
    await unchanged(test);
  });
  for (const width of [390, 360]) await scenario('사진 도구 진입·현장/유형/작업/공정 검색·이스케이프·필터 초기화', async test => {
    const { page } = test; await openPanel(page, true); await touchControls(page);
    assert.equal(await page.locator('#photoSourceProject').inputValue(), 'all', 'inspection defaults to all projects despite the active project');
    assert.equal(await page.locator('#photoSourceKind').inputValue(), 'all');
    assert.equal((await rows(page)).length, 8, 'all 8 photos, not only active project');
    assert(await page.locator('#photoSourceSummary').getAttribute('aria-live'), 'summary announces filter counts');
    const text = await page.locator('#photoSourcePanel').innerText();
    assert.match(text, /원본/); assert.match(text, /별개|다릅니다|구분/);
    assert.doesNotMatch(text, /원본 백업 완료|모든 사진.*안전하게 보관|원본 보관 완료/);
    await page.locator('#photoSourceProject').selectOption('none');
    assert.deepEqual((await rows(page)).map(r => r.id).sort(), ['missing', 'preview']);
    await page.locator('#photoSourceProject').selectOption({ label: B });
    assert.deepEqual((await rows(page)).map(r => r.id).sort(), ['folder', 'remote-relay']);
    await page.locator('#photoSourceKind').selectOption('folder');
    assert.deepEqual((await rows(page)).map(r => r.id), ['folder']);
    await page.locator('#photoSourceReset').click();
    assert.deepEqual(await page.locator('#photoSourceProject, #photoSourceKind, #photoSourceSearch').evaluateAll(nodes => nodes.map(n => n.value)), ['all', 'all', '']);
    for (const [query, ids] of [[' 욕 실 p V C 배 관 ', ['session']], ['미장완료', ['folder']], ['remote-relay', ['remote-relay']], ['가상나현장', ['folder', 'remote-relay']]]) {
      await page.locator('#photoSourceSearch').fill(query);
      assert.deepEqual((await rows(page)).map(r => r.id).sort(), ids.slice().sort(), 'normalized filename/project/work/phase search: ' + query);
    }
    await page.locator('#photoSourceSearch').fill(XSS);
    assert.deepEqual((await rows(page)).map(r => r.id), ['xss']);
    assert.equal(await page.locator('#photoSourcePanel img, #photoSourcePanel script').count(), 0, 'file/project/work names render as text only');
    await page.locator('#photoSourceSearch').fill('검색결과없는가상문구');
    assert.equal((await rows(page)).length, 0);
    assert.match(await page.locator('#photoSourceList').innerText(), /해당하는 사진이 없습니다/);
    await page.locator('#photoSourceReset').click(); assert.equal((await rows(page)).length, 8);
    if (width === 390 && process.env.HJ_PHOTO_SOURCE_SCREENSHOT) {
      await page.waitForFunction(() => !document.querySelector('#toast.show'));
      await page.locator('#modalRoot .modal').screenshot({ path: process.env.HJ_PHOTO_SOURCE_SCREENSHOT });
    }
    await unchanged(test);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('photoSourcePanel') && document.activeElement && document.activeElement.id === 'btnPhotoTools');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'btnPhotoTools', 'Escape returns keyboard focus to photo tools');
    await unchanged(test);
  }, width);
  await scenario('45장 20/40/45 점진 표시·중복 없음·분류별 최신순·필터 변경 시 첫 페이지', async test => {
    const { page } = test; await openPanel(page);
    const expected = await page.evaluate(() => photoSourceRows().map(r => r.file.id));
    assert.equal(expected.length, 45);
    assert.deepEqual((await rows(page)).map(r => r.id), expected.slice(0, 20));
    for (const end of [40, 45]) {
      await page.locator('#photoSourceMore').click();
      const shown = (await rows(page)).map(r => r.id);
      assert.deepEqual(shown, expected.slice(0, end)); assert.equal(new Set(shown).size, shown.length, 'no duplicate rows');
    }
    assert.equal(await page.locator('#photoSourceMore:visible').count(), 0, 'no misleading more button after final page');
    const sorted = await page.evaluate(() => {
      const result = photoSourceRows();
      return result.every((r, i) => !i || r.source.key !== result[i - 1].source.key || Number(result[i - 1].file.when) >= Number(r.file.when));
    });
    assert(sorted, 'within a source category newer photos come first');
    await page.locator('#photoSourceKind').selectOption('remote');
    assert.equal((await rows(page)).length, 9);
    assert((await rows(page)).every(r => r.key === 'remote'));
    await page.locator('#photoSourceReset').click();
    assert.equal((await rows(page)).length, 20, 'reset retires old pagination');
    await touchControls(page); await unchanged(test);
  }, 1280, 45);
  await scenario('사진 선택 확인·실제 추가 대기·잠긴 작업은 보관 상태 창으로 덮어쓰지 않음', async test => {
    const { page } = test;
    await page.evaluate(({ png, project }) => {
      const file = new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], 'virtual-pending.png', { type: 'image/png' });
      openPhotoIntake([file], { project, source: 'gallery' });
    }, { png: PNG, project: A });
    await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => photoSourceView()), false, 'confirmation remains intact');
    assert.equal(await page.locator('#photoIntakeProject').count(), 1);
    assert.equal(await page.locator('#photoSourcePanel').count(), 0);
    await page.evaluate(() => {
      hjSnapshot = () => new Promise(resolve => { window.__sourceReleaseSnapshot = resolve; });
    });
    await page.locator('#photoIntakeConfirm').click();
    await page.waitForFunction(() => !!window.__sourceReleaseSnapshot && __photoIntakeBusy && __modalCloseLocked);
    assert.equal(await page.evaluate(() => photoSourceView()), false, 'active intake cannot lose its progress/lock');
    assert.equal(await page.locator('#photoIntakeProgress').count(), 1);
    assert.equal(await page.locator('#photoSourcePanel').count(), 0);
    await unchanged(test);
    // Explicit snapshot refusal ends this virtual intake before any ingest or data write.
    await page.evaluate(() => window.__sourceReleaseSnapshot(false));
    await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !__photoIntakeBusy && !__modalCloseLocked);
    await page.getByRole('button', { name: '사진 보관 상태', exact: true }).click();
    await page.locator('#photoSourcePanel').waitFor({ state: 'visible' });
    await unchanged(test);
    await page.evaluate(() => closeModal());
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
    await page.evaluate(() => {
      openModal('가상 잠긴 작업', '<p id="virtualSourceLocked">작업 중</p>', []); __modalCloseLocked = true;
    });
    assert.equal(await page.evaluate(() => photoSourceView()), false, 'another locked workflow cannot be overwritten');
    assert.equal(await page.locator('#virtualSourceLocked').count(), 1);
    assert.equal(await page.locator('#photoSourcePanel').count(), 0);
    await page.evaluate(() => { __modalCloseLocked = false; closeModal(); });
    await unchanged(test);
  });
  await scenario('백업 센터의 원본 제한 안내와 보관 상태 확인 진입', async test => {
    const { page } = test;
    await page.evaluate(() => {
      // Storage usage is a separate already-tested browser API; no permission prompt in this entry test.
      storageGuardRenderIntoBackupCenter = () => {};
      storageGuardRefresh = () => Promise.resolve();
      backupCenter();
    });
    await page.locator('#bcPhotoSource').waitFor({ state: 'visible' });
    const text = await page.locator('#modalRoot .modal').innerText();
    assert.match(text, /앱 기록 백업과 사진 파일 백업은 별개/);
    assert.match(text, /원본.*확인되지는|원본.*확인.*않/);
    assert.doesNotMatch(text, /모든 사진.*안전하게 보관|원본 보관 완료/);
    await unchanged(test);
    await page.locator('#bcPhotoSource').click();
    await page.locator('#photoSourcePanel').waitFor({ state: 'visible' });
    assert.equal((await rows(page)).length, 8);
    await unchanged(test);
  });
  await scenario('설정은 명시 클릭 시에만 열고 점검창은 닫기·빈 사진함에서도 안내', async test => {
    const { page } = test; await openPanel(page);
    await unchanged(test); await page.locator('#photoSourceSettings').click();
    await page.waitForFunction(() => window.__sourceCalls.settings === 1 && !document.getElementById('photoSourcePanel'));
    await unchanged(test, 1);
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
    // Empty state is a separate virtual fixture, not a production delete action.
    await page.evaluate(() => {
      state.files = []; __sel.clear();
      window.__sourceFileRefs = [];
      window.__sourceSnapshot = JSON.stringify({ files: state.files, projects: state.projects,
        active: state.activeProject, search: state.search, selected: [...__sel], mode: __selMode, dirty: state.dirty });
    });
    await openPanel(page);
    assert.equal((await rows(page)).length, 0);
    assert.match(await page.locator('#photoSourceList').innerText(), /사진.*없/);
    await unchanged(test, 1);
  });
  console.log('\n== photo-source-status: ' + passed + ' passed, pageerrors=0 ==');
})().catch(e => { console.error('FAIL photo-source-status', e && e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

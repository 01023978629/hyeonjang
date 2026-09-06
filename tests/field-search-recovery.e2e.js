/* 사진 검색 복구와 현장 선택 검색: 모바일 390 / PC 1280.
   기존 파일·선택·보관 상태를 유지하면서 검색 0건에서 다시 작업에 닿아야 한다.
   전제: tests/static-server.js(8299). 실제 계정·외부 요청 없이 새 브라우저 컨텍스트만 사용.

   변이 확인: HJ_SEARCH_MUTATION=photo-clear 또는 project-archived 로 실행하면
   격리된 페이지에서 각각 검색 초기화 / 보관 결과 표시를 되돌린다.
   같은 정상 검사가 실패해야 한다. 운영 소스·파일은 수정하지 않는다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_SEARCH_MUTATION || '';
assert(['', 'photo-clear', 'project-archived'].includes(MUTATION), 'unknown HJ_SEARCH_MUTATION');
const XSS = '<img src=x onerror="window.__fieldsearchxss=1">';
const ACTIVE = 'Alpha 진행 현장';
const ARCHIVED = 'Beta 보관 현장';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
let browser;
let passed = 0;

async function seed(page) {
  await page.evaluate(({ active, archived, xss, px }) => {
    const project = (name, isArchived) => ({ name, archived: isArchived, stage: 2, received: 0,
      phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {} });
    state.projects = [project(active, false), project(archived, true), project(xss + ' 현장', false)];
    state.files = [
      { id: 'search_photo_1', name: 'sample_a.jpg', ext: 'jpg', kind: 'photo', project: active,
        when: new Date('2026-09-01T09:00:00'), size: 101, thumb: px },
      { id: 'search_photo_2', name: 'sample_b.jpg', ext: 'jpg', kind: 'photo', project: archived,
        when: new Date('2026-09-02T09:00:00'), size: 102, thumb: px },
      { id: 'search_photo_3', name: 'sample_c.jpg', ext: 'jpg', kind: 'photo', project: '',
        when: new Date('2026-09-03T09:00:00'), size: 103, thumb: px }
    ];
    state.activeProject = active;
    state.tab = 'photos';
    state.search = '';
    state.dirty = false;
    state.schedule = [];
    state.payLog = [];
    // 부팅 뒤 지연 실행되는 기본값 생성도 먼저 마친다. 검색 중 초기화가
    // 시작되면 검색과 무관한 markDirty/일정 추가를 데이터 변이로 오인한다.
    taxCalendarEnsure();
    coworkSchedEnsure();
    aiOpsEnsureState().enabled = false;
    state.dirty = false;
    __showArchived = false;
    __photoCache.key = null;
    __sel.clear();
    __sel.add('search_photo_1');
    __selMode = true;
    document.getElementById('globalSearch').value = '';
    window.__fieldsearchxss = 0;
    render();
    window.__fieldSearchRefs = { files: state.files.slice(), projects: state.projects.slice() };
    if (!window.__fieldSearchOriginalDirty) window.__fieldSearchOriginalDirty = markDirty;
    window.__fieldSearchDirtyCalls = 0;
    window.__fieldSearchDirtyCauses = [];
    markDirty = function () { window.__fieldSearchDirtyCalls++; window.__fieldSearchDirtyCauses.push(new Error().stack); return window.__fieldSearchOriginalDirty.apply(this, arguments); };
  }, { active: ACTIVE, archived: ARCHIVED, xss: XSS, px: PX });
}

async function snapshot(page) {
  return page.evaluate(() => ({
    files: JSON.stringify(state.files), projects: JSON.stringify(state.projects),
    serialized: JSON.stringify(Object.assign(serializeData(), { savedAt: '2026-09-06T00:00:00.000Z' })),
    sameFiles: state.files.every((f, i) => f === window.__fieldSearchRefs.files[i]),
    sameProjects: state.projects.every((p, i) => p === window.__fieldSearchRefs.projects[i]),
    selection: [...__sel], selectionMode: __selMode, activeProject: state.activeProject,
    dirty: state.dirty, dirtyCalls: window.__fieldSearchDirtyCalls, archivedExpanded: __showArchived
  }));
}

async function touchTarget(page, selector, mobile) {
  const size = await page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  if (mobile) assert(size.width >= 44 && size.height >= 44,
    selector + ' must be at least 44px: ' + JSON.stringify(size));
}

async function visibleProjects(page) {
  return page.locator('#psList button[data-psel]:visible').evaluateAll(nodes =>
    nodes.map(node => node.dataset.psel).filter(Boolean));
}

async function openSheet(page, mobile) {
  await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
  const opener = mobile ? '#projChip' : '#globalSearch';
  await page.locator(opener).focus();
  if (mobile) await page.locator(opener).click();
  else await page.evaluate(selector => openProjectSheet(document.querySelector(selector)), opener);
  await page.waitForFunction(() => document.getElementById('projSheet')?.contains(document.activeElement));
  return opener;
}

async function closeWithEscape(page, opener) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(selector => !document.getElementById('projSheet') &&
    !document.getElementById('projSheetBd') && document.activeElement === document.querySelector(selector) &&
    !document.body.classList.contains('mobile-sheet-open'), opener);
  await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
}

function pass(width, label) { passed++; console.log('PASS  ' + width + 'px ' + label); }

async function runViewport(width) {
  const mobile = width === 390;
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height: 844 },
    isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN
    ? route.continue() : route.abort());
  await page.addInitScript(({ mobileMode, mutation }) => {
    localStorage.setItem('hj_onboard_done', '1');
    localStorage.setItem('pref_mobile', mobileMode ? '1' : '0');
    window.__fieldSearchMutationApplied = 0;
    // 정상 핸들러 실행을 막는 변이는 해당 UI 동작에서만 적용된다.
    if (mutation === 'photo-clear') document.addEventListener('click', event => {
      if (!event.target.closest('#btnClearPhotoSearch')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      window.__fieldSearchMutationApplied++;
    }, true);
    if (mutation === 'project-archived') document.addEventListener('input', event => {
      if (event.target.id !== 'psSearch' || !event.target.value.trim()) return;
      for (const row of document.querySelectorAll('#psList [data-psel]')) {
        if (state.projects.some(p => p.name === row.dataset.psel && p.archived)) {
          row.style.display = 'none';
          window.__fieldSearchMutationApplied++;
        }
      }
    });
  }, { mobileMode: mobile, mutation: MUTATION });

  try {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
    await page.evaluate(async () => { await Promise.all([
      window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone
    ]); });
    await seed(page);
    const photoBefore = await snapshot(page);
    assert.equal(await page.locator('.cluster img').count(), 3, 'fixture has three rendered photos');
    await page.locator('#globalSearch').fill(XSS);
    await page.locator('#btnClearPhotoSearch').waitFor({ state: 'visible' });
    assert.match(await page.locator('#view').innerText(), /검색 결과가 없습니다/);
    assert.equal(await page.locator('#view #gdPickFolder, #view #gdImportAll').count(), 0,
      'no-match state must not claim there are no photos to import');
    assert.equal(await page.locator('#view img').count(), 0, 'search text is escaped, not parsed as an image');
    assert.equal(await page.evaluate(() => window.__fieldsearchxss), 0, 'photo search XSS must not run');
    assert.deepEqual(await snapshot(page), photoBefore, 'search must not mutate photos, projects, selection or scope');
    await touchTarget(page, '#btnClearPhotoSearch', mobile);
    await page.locator('#btnClearPhotoSearch').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.search === '' && document.getElementById('globalSearch').value === '' &&
      !document.getElementById('btnClearPhotoSearch') && document.querySelectorAll('.cluster img').length === 3);
    assert.deepEqual(await snapshot(page), photoBefore, 'recovery preserves photos, selected IDs, mode and project');
    pass(width, '사진 검색 0건 → 키보드 복구, XSS 차단, 원본·선택·현장 불변');

    await page.evaluate(() => { state.files = []; state.search = 'empty-query';
      document.getElementById('globalSearch').value = state.search; __photoCache.key = null; render(); });
    assert.equal(await page.locator('#btnClearPhotoSearch').count(), 0, 'zero stored photos use the existing empty state');
    assert.match(await page.locator('#view').innerText(), /현장 사진이 아직 없어요/);
    assert.equal(await page.locator('#gdImportAll').count(), 1, 'zero files retains the common import entry');
    await page.evaluate(() => { state.files = [{ id: 'search_doc', name: 'sample.pdf', ext: 'pdf', kind: 'document' }]; render(); });
    assert.equal(await page.locator('#btnClearPhotoSearch').count(), 0, 'documents alone are still zero stored photos');
    assert.match(await page.locator('#view').innerText(), /현장 사진 정리/);
    assert.equal(await page.locator('#gdPickFolder').count(), 1, 'photos-only empty state retains its import entry');
    pass(width, '사진 보유 0건은 기존 가져오기 안내 유지');

    await seed(page);
    const projectBefore = await snapshot(page);
    let opener = await openSheet(page, mobile);
    assert.deepEqual(await visibleProjects(page), [ACTIVE, XSS + ' 현장'], 'archived projects start collapsed');
    assert.equal(await page.locator('#projSheet').getAttribute('role'), 'dialog');
    assert.equal(await page.locator('#projSheet').getAttribute('aria-modal'), 'true');
    assert(await page.locator('#psSearch').getAttribute('aria-label'), 'project search has an accessible name');
    await touchTarget(page, '#psSearch', mobile);
    await page.locator('#psSearch').fill('  b E t A  보 관 현 장  ');
    assert.deepEqual(await visibleProjects(page), [ARCHIVED], 'case and whitespace normalize across archived projects');
    assert.match(await page.locator('#projSheet [role="status"]').innerText(), /검색 결과\s*1곳/);
    assert.match(await page.locator('#projSheet [role="status"]').innerText(), /보관\s*1곳/);
    await touchTarget(page, '#psSearchClear', mobile);
    await touchTarget(page, '#psList button[data-psel]:visible:not([data-psel=""])', mobile);
    assert.deepEqual(await snapshot(page), projectBefore, 'searching archived projects does not change source state');
    await page.locator('#psSearch').fill('no-such-project');
    assert.deepEqual(await visibleProjects(page), [], 'unmatched search hides all named project rows');
    assert.match(await page.locator('#projSheet [role="status"]').innerText(), /검색 결과\s*0곳/);
    assert.match(await page.locator('#psList').innerText(), /일치하는 현장이 없습니다/);
    await page.locator('#psSearchClear').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#psSearch').inputValue(), '');
    assert.deepEqual(await visibleProjects(page), [ACTIVE, XSS + ' 현장'], 'clearing restores the collapsed archive preference');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'psSearch', 'clear returns focus to search');
    await page.locator('#psSearch').fill(XSS);
    assert.deepEqual(await visibleProjects(page), [XSS + ' 현장'], 'HTML-like names remain searchable text');
    assert.equal(await page.locator('#projSheet img').count(), 0, 'project names and queries do not inject HTML');
    assert.equal(await page.evaluate(() => window.__fieldsearchxss), 0, 'project search XSS must not run');
    await page.locator('#psSearchClear').click();
    const last = page.locator('#projSheet button:visible, #projSheet input:visible').last();
    await last.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'projSheetClose', 'Tab cycles inside the rebuilt list');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'psArcTg', 'Shift+Tab returns to the last visible control');
    await closeWithEscape(page, opener);
    assert.deepEqual(await snapshot(page), projectBefore, 'Escape leaves source data and archive preference unchanged');
    pass(width, '현장 전체 검색·0건·지우기·XSS·44px·Tab·Esc·초점 복귀');

    opener = await openSheet(page, mobile);
    await page.locator('#psArcTg').click();
    assert.equal(await page.evaluate(() => __showArchived), true);
    await page.locator('#psSearch').fill('Alpha');
    assert.deepEqual(await visibleProjects(page), [ACTIVE]);
    await page.locator('#psSearchClear').click();
    assert.deepEqual(await visibleProjects(page), [ACTIVE, XSS + ' 현장', ARCHIVED], 'clear also restores an expanded archive preference');
    assert.equal(await page.evaluate(() => __showArchived), true);
    await page.locator('#psSearch').fill('Beta보관현장');
    const archivedRow = page.locator('#psList button[data-psel]:visible').filter({ hasText: ARCHIVED });
    await archivedRow.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(expected => !document.getElementById('projSheet') && state.activeProject === expected &&
      state.tab === 'project', ARCHIVED);
    const selected = await snapshot(page);
    assert.equal(selected.files, projectBefore.files, 'selection does not change photo files');
    assert.equal(selected.projects, projectBefore.projects, 'selecting an archived project does not unarchive or edit it');
    assert.equal(selected.serialized, projectBefore.serialized, 'view selection preserves the saved data package');
    assert(selected.sameFiles && selected.sameProjects, 'selection preserves original objects');
    assert.equal(selected.dirty, projectBefore.dirty, 'view selection does not mark customer data dirty');
    assert.equal(selected.dirtyCalls, 0, 'search and view selection never call markDirty');
    opener = await openSheet(page, mobile);
    await page.locator('#psList button[data-psel=""]').click();
    await page.waitForFunction(() => !document.getElementById('projSheet') && state.activeProject === null && state.tab === 'dashboard');
    pass(width, '보관 펼침 상태 복원·키보드 선택·보관 유지·전체 보기 동작');
    assert.deepEqual(errors, [], 'pageerror 0');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      'no horizontal overflow after search navigation');
  } finally {
    const causes = await page.evaluate(() => window.__fieldSearchDirtyCauses || []).catch(() => []);
    if (causes.length) console.log('Unexpected markDirty callers:', causes);
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' +
      await page.evaluate(() => window.__fieldSearchMutationApplied || 0).catch(() => 0));
    await context.close();
  }
}

(async () => {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined);
  browser = await chromium.launch({ executablePath });
  await runViewport(390);
  await runViewport(1280);
  console.log('\n== field-search-recovery: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => {
  console.error('FAIL field-search-recovery', error && error.stack || error);
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });

/* v264: 사진 확인/추가와 앱 갱신의 비동기 경쟁, 작업명 검색 복귀를 보호한다.
   새 브라우저에 가상 PNG만 사용하며 외부 요청은 차단한다. 8299 서버 필요.
   HJ_PHOTO_REFRESH_MUTATION=refresh|search 는 페이지 함수만 변이해 같은 회귀의
   의도한 단언이 실패해야 한다. 운영 파일/실제 사진/계정은 수정하지 않는다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_PHOTO_REFRESH_MUTATION || '';
assert(['', 'refresh', 'search'].includes(MUTATION), 'unknown HJ_PHOTO_REFRESH_MUTATION');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
let browser, passed = 0;

async function boot(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true,
    hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_ver_checked_at', String(Date.now()));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  await page.evaluate(({ png, mutation }) => {
    state.projects = [{ name: '가상 현장', stage: 1, archived: false, customer: {}, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, received: 0 }];
    state.files = []; state.activeProject = '가상 현장'; state.tab = 'photos'; state.search = '';
    state._demo = false; state.dirty = false; state.dirHandle = null;
    __photoCache.key = null; __sel.clear(); __selMode = false; __tabStale = false;
    relayReady = () => false; __gdToken = null;
    window.__refreshTestMutationApplied = 0;
    window.__testPhoto = () => new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], 'virtual-intake.png', { type: 'image/png' });
    window.__testIntake = () => openPhotoIntake([window.__testPhoto()], { project: '가상 현장', source: 'gallery' });
    window.__versionStateCalls = 0; window.__cacheDeleted = []; window.__reloadTimers = []; window.__deadlineTimers = [];
    window.__updateTimers = 0; window.__toasts = [];
    const nativeToast = toast;
    toast = function(message) { window.__toasts.push(String(message)); return nativeToast.apply(this, arguments); };
    // Observe the real update's scheduled callback without letting a successful test reload its fixture.
    const nativeTimeout = window.setTimeout;
    window.setTimeout = function(fn, ms, ...args) {
      if (window.__captureVersionDeadline && ms >= 10000 && ms <= 15000 && typeof fn === 'function' && /version-timeout/.test(String(fn))) {
        window.__deadlineTimers.push(() => fn(...args)); return -2000 - window.__deadlineTimers.length;
      }
      if (ms === 700 && typeof fn === 'function' && /location\.reload/.test(String(fn))) {
        window.__reloadTimers.push(fn); window.__updateTimers++; return -1000 - window.__updateTimers;
      }
      return nativeTimeout.call(this, fn, ms, ...args);
    };
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => null } });
    Object.defineProperty(window, 'caches', { configurable: true, value: {
      keys: async () => ['hyeonjang-v1-old', 'unrelated-cache'],
      delete: async key => { window.__cacheDeleted.push(key); return true; }
    } });
    appVersionState = async () => {
      window.__versionStateCalls++;
      if (window.__pauseVersionState) {
        window.__versionStateEntered = true;
        await new Promise(resolve => { window.__releaseVersionState = resolve; });
      }
      if (window.__throwVersionState) throw new Error('virtual server error');
      return { shell: APP_BUILD, cache: APP_BUILD, server: window.__noVersionServer ? '' : 'hyeonjang-v999-test', online: navigator.onLine, err: '' };
    };
    if (mutation === 'refresh') appVersionPhotoGuard = () => { window.__refreshTestMutationApplied++; return false; };
    if (mutation === 'search') photoWorkSearchMatch = () => { window.__refreshTestMutationApplied++; return false; };
    render(); syncMobileNav();
  }, { png: PNG, mutation: MUTATION });
  return { context, page, errors, width };
}
async function scenario(name, fn, width) {
  const test = await boot(width);
  try {
    await fn(test.page);
    assert.deepEqual(test.errors, [], 'pageerror 0');
    passed++; console.log('PASS ' + test.width + 'px ' + name);
  } finally {
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' + await test.page.evaluate(() => window.__refreshTestMutationApplied).catch(() => 0));
    await test.context.close();
  }
}
async function verifyGuard(page, label) {
  const result = await page.evaluate(async () => {
    const before = JSON.stringify(state.files);
    const r = await appVersionUpdate();
    appVersionBanner('hyeonjang-v999-test'); document.getElementById('hjVerNewGo').click();
    await Promise.resolve(); await Promise.resolve();
    const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e);
    return { r, calls: window.__versionStateCalls, timers: window.__updateTimers, deleted: window.__cacheDeleted,
      unchanged: before === JSON.stringify(state.files), unloadBlocked: e.defaultPrevented,
      bannerEnabled: !document.getElementById('hjVerNewGo').disabled };
  });
  assert.equal(result.r, false, label + ': photo refresh guard must reject before version fetch');
  assert.deepEqual([result.calls, result.timers, result.deleted.length], [0, 0, 0], label + ': no fetch/cache/reload side effect');
  assert(result.unchanged && result.unloadBlocked && result.bannerEnabled, label + ': data kept, unload warning, usable button');
}
async function seedSearch(page) {
  await page.evaluate(png => {
    let sequence = 100;
    const photo = (id, name, work, phase, text = '') => ({ id, name, kind: 'photo', ext: 'png',
      project: '가상 현장', size: ++sequence, _virtual: true, thumb: 'data:image/png;base64,' + png,
      when: new Date('2026-09-07T01:00:00Z'), _worklabel: work, _phase: phase, text });
    state.files = [photo('work', '작업사진.png', '욕실 PVC 배관 보수', '시공 전'),
      photo('phase', '마무리.png', '타일 보완', '미 장 완료'),
      photo('name', '기존파일검색.png', '', '', '기존 OCR 검색'),
      photo('html', '<img src=x onerror=window.__photoXss=1>.png', '<img src=x onerror=window.__photoXss=1>', ''),
      photo('unit-tag', '별도사진.png', '999동888호 가상 작업', ''),
      photo('unit-name', '999동888호_배관.png', '연결 작업', '')];
    state.files.push({ id: 'doc-tag', name: '태그만있는문서.pdf', kind: 'other', ext: 'pdf', _worklabel: '욕실 PVC 배관 보수', _phase: '미 장 완료' });
    __sel.clear(); __sel.add('phase'); __selMode = true; __showDup = false; state.search = '';
    __photoCache.key = null; window.__photoXss = 0;
    render(); syncMobileNav();
    window.__sourceSnapshot = JSON.stringify({ files: state.files, projects: state.projects });
    window.__selectionSnapshot = JSON.stringify([...__sel]);
  }, PNG);
}
async function assertSearchUnchanged(page) {
  const facts = await page.evaluate(() => ({ data: window.__sourceSnapshot === JSON.stringify({ files: state.files, projects: state.projects }),
    selection: window.__selectionSnapshot === JSON.stringify([...__sel]), mode: __selMode, dirty: state.dirty }));
  assert.deepEqual(facts, { data: true, selection: true, mode: true, dirty: false }, 'search preserves data, selected IDs, mode and dirty state');
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await scenario('사진 확인창이 있으면 직접 갱신·배너·페이지 이탈 차단, 취소 뒤 정상 복구', async page => {
    await page.evaluate(() => window.__testIntake());
    await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
    await verifyGuard(page, 'confirmation');
    await page.locator('#photoIntakeCancel').click();
    await page.waitForFunction(() => !document.getElementById('photoIntakeProject'));
    const result = await page.evaluate(async () => ({ r: await appVersionUpdate(), calls: window.__versionStateCalls, timers: window.__updateTimers }));
    assert.deepEqual(result, { r: true, calls: 1, timers: 1 }, 'cancel restores explicit update availability');
  });
  await scenario('실제 사진 추가의 안전판·파일 읽기 중 dirty=false 구간에서도 갱신 차단', async page => {
    await page.evaluate(() => {
      const nativeSnapshot = hjSnapshot, nativeIngest = ingestFile;
      hjSnapshot = async function(label, force, allowEmpty) {
        if (force) { window.__snapshotEntered = true; await new Promise(resolve => { window.__releaseSnapshot = resolve; }); }
        return nativeSnapshot.apply(this, arguments);
      };
      ingestFile = async function() {
        window.__ingestEntered = true; await new Promise(resolve => { window.__releaseIngest = resolve; });
        return nativeIngest.apply(this, arguments);
      };
      window.__testIntake();
    });
    await page.locator('#photoIntakeConfirm').click();
    await page.waitForFunction(() => window.__snapshotEntered && __photoIntakeBusy && !state.dirty);
    await verifyGuard(page, 'snapshot');
    await page.evaluate(() => window.__releaseSnapshot());
    await page.waitForFunction(() => window.__ingestEntered && __photoIntakeBusy && !state.dirty);
    await verifyGuard(page, 'ingest');
    await page.evaluate(() => window.__releaseIngest());
    await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => state.files.length), 1, 'real PNG intake resumes and completes');
  });
  await scenario('배너의 저장 대기 중 사진 확인을 시작하면 저장 후 재검사로 갱신 취소', async page => {
    await page.evaluate(() => {
      guardedPersistCurrentState = async () => {
        window.__persistEntered = true; await new Promise(resolve => { window.__releasePersist = resolve; }); return true;
      };
      appVersionBanner('hyeonjang-v999-test'); document.getElementById('hjVerNewGo').click();
    });
    await page.waitForFunction(() => window.__persistEntered);
    await page.evaluate(() => window.__testIntake());
    await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
    await page.evaluate(() => window.__releasePersist());
    await page.waitForFunction(() => !document.getElementById('hjVerNewGo').disabled);
    assert.deepEqual(await page.evaluate(() => [window.__versionStateCalls, window.__updateTimers, state.files.length]), [0, 0, 0]);
  });
  await scenario('서버 확인·700ms 예약 중 갤러리/촬영/직접 확인 진입과 겹친 갱신 차단', async page => {
    let chooserCount = 0; page.on('filechooser', () => chooserCount++);
    await page.evaluate(() => { window.__pauseVersionState = true; window.__updatePromise = appVersionUpdate(); });
    await page.waitForFunction(() => window.__versionStateEntered && __appVersionUpdating);
    for (const stage of ['server-await', 'scheduled-reload']) {
      const r = await page.evaluate(async () => {
        gdUploadPhotos(); triggerCameraInput(); window.__testIntake();
        return { duplicate: await appVersionUpdate(), modal: !!document.getElementById('photoIntakeProject'), files: state.files.length,
          calls: window.__versionStateCalls, locked: __appVersionUpdating };
      });
      assert.deepEqual(r, { duplicate: false, modal: false, files: 0, calls: 1, locked: true }, stage + ': mutually exclusive update/intake');
      if (stage === 'server-await') {
        await page.evaluate(() => window.__releaseVersionState());
        assert.equal(await page.evaluate(() => window.__updatePromise), true);
        assert.equal(await page.evaluate(() => window.__updateTimers), 1);
      }
    }
    assert.equal(chooserCount, 0, 'no native picker opens while update is committed');
    assert.deepEqual(await page.evaluate(() => window.__cacheDeleted), ['hyeonjang-v1-old'], 'unrelated caches are preserved');
  });
  await scenario('최종 reload 직전 사진 보호 재검사·잠금 복구·실패와 오프라인 재시도', async page => {
    await page.evaluate(async () => {
      appVersionBanner('hyeonjang-v999-test'); await appVersionUpdate();
      document.getElementById('hjVerNewGo').disabled = true;
      __photoIntakeBusy = true; window.__reloadTimers.shift()();
    });
    assert.equal(page.url(), APP);
    assert.deepEqual(await page.evaluate(() => [__appVersionUpdating, document.getElementById('hjVerNewGo').disabled]), [false, false], 'final guard cancels timer and releases update/button lock');
    await page.evaluate(() => { __photoIntakeBusy = false; window.__throwVersionState = true; });
    const failed = await page.evaluate(async () => { let r; try { r = await appVersionUpdate(); } catch (_) { r = false; } return [r, __appVersionUpdating]; });
    assert.deepEqual(failed, [false, false], 'unexpected server failure must release lock');
    await page.evaluate(() => { window.__throwVersionState = false; Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); });
    assert.deepEqual(await page.evaluate(async () => [await appVersionUpdate(), __appVersionUpdating]), [false, false], 'offline rejection does not retain lock');
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); window.__noVersionServer = true; });
    assert.deepEqual(await page.evaluate(async () => [await appVersionUpdate(), __appVersionUpdating]), [false, false], 'missing server version releases lock');
    await page.evaluate(() => { window.__noVersionServer = false; });
    assert.equal(await page.evaluate(() => appVersionUpdate()), true, 'retry works without restarting page');
  });
  for (const stage of ['server', 'worker', 'cache']) await scenario(stage + ' 응답 정체의 제한시간 후 잠금 해제·늦은 응답 무효·재시도', async page => {
    await page.evaluate(stage => {
      window.__captureVersionDeadline = true;
      if (stage === 'server') window.__pauseVersionState = true;
      if (stage === 'worker') navigator.serviceWorker.getRegistration = () => new Promise(resolve => { window.__releaseStalledStage = () => resolve(null); });
      if (stage === 'cache') window.caches.keys = () => new Promise(resolve => { window.__releaseStalledStage = () => resolve(['hyeonjang-v1-old']); });
      window.__stalledUpdate = appVersionUpdate();
    }, stage);
    await page.waitForFunction(stage => window.__deadlineTimers.length > 0 && (stage === 'server' ? window.__versionStateEntered : !!window.__releaseStalledStage), stage);
    await page.evaluate(() => window.__deadlineTimers[window.__deadlineTimers.length - 1]());
    assert.equal(await page.evaluate(() => window.__stalledUpdate), false, 'stalled update returns false after its own deadline');
    assert.equal(await page.evaluate(() => __appVersionUpdating), false, 'deadline releases mutual exclusion lock');
    await page.evaluate(async stage => {
      if (stage === 'server') window.__releaseVersionState(); else window.__releaseStalledStage();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    }, stage);
    assert.deepEqual(await page.evaluate(() => [window.__cacheDeleted.length, window.__updateTimers]), [0, 0], 'late response cannot continue to cache deletion or reload');
    await page.evaluate(() => {
      window.__captureVersionDeadline = false; window.__pauseVersionState = false;
      navigator.serviceWorker.getRegistration = async () => null; window.caches.keys = async () => ['hyeonjang-v1-old'];
    });
    assert.equal(await page.evaluate(() => appVersionUpdate()), true, 'deadline does not require a page restart to retry');
  });
  await scenario('사진 작업명·공정 공백/대소문자 검색, 기존 파일명·OCR·연결 기준 유지', async page => {
    await seedSearch(page);
    for (const [query, ids] of [[' 욕 실 p V c 배 관 ', ['work']], ['미장완료', ['phase']], ['기존파일검색', ['name']], ['기존 ocr', ['name']]]) {
      const found = await page.evaluate(q => { state.search = q.trim().toLowerCase(); return state.files.filter(f => matchSearch(f)).map(f => f.id); }, query);
      assert.deepEqual(found, ids, 'normal photo search includes work label/phase: ' + query);
      const global = await page.evaluate(q => universalSearch(q), query);
      assert.equal(global.그룹.파일.length, 1, 'global search same result for ' + query);
      if (ids[0] === 'work') assert.match(global.그룹.파일[0].일치, /작업명/);
      if (ids[0] === 'phase') assert.match(global.그룹.파일[0].일치, /공정/);
    }
    const links = await page.evaluate(() => {
      state.search = 'original-filter'; const ids = aptPhotoList({ unit: '999동888호' }).map(f => f.id);
      return { ids, search: state.search };
    });
    assert.deepEqual(links, { ids: ['unit-name'], search: 'original-filter' }, 'work label containing unit must not attach an unrelated apartment photo');
    await assertSearchUnchanged(page);
  });
  await scenario('오더 사진 배지와 실제 목록 일치, 직접 검색·통합 검색은 작업명으로 확장', async page => {
    await seedSearch(page);
    await page.evaluate(() => {
      state.aptOffices = [{ id: 'virtual-office', complex: '가상 단지', manager: '', phone: '' }];
      state.aptOrders = [{ id: 'virtual-order', officeId: 'virtual-office', unit: '999동888호', text: '가상 작업', amount: 0, date: localDate(), status: 'recv' }];
      aptOrderManage('virtual-office');
    });
    const photoButton = page.locator('.apoPh[data-id="virtual-order"]');
    assert.match(await photoButton.innerText(), /1/);
    await photoButton.click();
    await page.waitForFunction(() => state.tab === 'photos' && !document.querySelector('#modalRoot .modal'));
    assert.equal(await page.locator('.cluster img').count(), 1, 'order badge opens only the matching filename photo, not the work-label-only photo');
    assert.equal(await page.evaluate(() => __aptPhotoSearchQuery), '999동888호');
    await page.locator('#globalSearch').fill('999동888호 ');
    await page.waitForFunction(() => __aptPhotoSearchQuery === null && document.querySelectorAll('.cluster img').length === 2).catch(async error => {
      console.error('order-search facts', await page.evaluate(() => ({ scope: __aptPhotoSearchQuery, query: state.search,
        matches: state.files.filter(f => f.kind === 'photo' && matchSearch(f)).map(f => f.id),
        images: document.querySelectorAll('.cluster img').length, dup: __showDup, cache: __photoCache.key })));
      throw error;
    });
    await assertSearchUnchanged(page);
    await page.evaluate(() => { __aptPhotoSearchQuery = '999동888호'; state.search = '999동888호'; hjGlobalSearch(); });
    await page.locator('#gsInput').fill('999동888호');
    await page.locator('button.gsItem[data-photo-query]').first().click();
    await page.waitForFunction(() => __aptPhotoSearchQuery === null && !document.getElementById('gsInput') && document.querySelectorAll('.cluster img').length === 2);
    await page.evaluate(() => { __aptPhotoSearchQuery = '999동888호'; state.search = ''; render(); });
    assert.equal(await page.evaluate(() => __aptPhotoSearchQuery), null, 'empty search retires the order-only viewing scope');
    await assertSearchUnchanged(page);
  });
  for (const width of [390, 360]) await scenario('통합 사진 결과 Enter로 필터 복귀·44px·HTML 이스케이프·선택 유지', async page => {
    await seedSearch(page);
    await page.evaluate(() => { __showDup = true; state.search = '이전검색'; hjGlobalSearch(); });
    const query = '욕 실 P V C 배 관';
    await page.locator('#gsInput').fill(query);
    const hit = page.locator('button.gsItem[data-photo-query]');
    await hit.waitFor({ state: 'visible' }); assert.equal(await hit.count(), 1);
    if (width === 390 && process.env.HJ_PHOTO_REFRESH_SCREENSHOT) {
      await page.locator('#modalRoot .modal').screenshot({ path: process.env.HJ_PHOTO_REFRESH_SCREENSHOT });
    }
    const size = await hit.evaluate(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
    assert(size[0] >= 44 && size[1] >= 44, 'photo search result is a 44px native button');
    await hit.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.tab === 'photos' && !document.getElementById('gsInput') && !__showDup);
    assert.equal(await page.evaluate(() => state.search), query.toLowerCase());
    assert.equal((await page.locator('#globalSearch').inputValue()).toLowerCase(), query.toLowerCase());
    assert.equal(await page.locator('.cluster img').count(), 1, 'opened photo gallery applies the query instead of showing all photos');
    await assertSearchUnchanged(page);
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
    await page.evaluate(() => hjGlobalSearch());
    await page.locator('#gsInput').fill('<img src=x onerror=window.__photoXss=1>');
    await page.locator('button.gsItem[data-photo-query]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#gsResults img').count(), 0, 'filename/work/query are escaped');
    assert.equal(await page.evaluate(() => window.__photoXss), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no mobile horizontal overflow');
    await assertSearchUnchanged(page);
  }, width);
  console.log('\n== photo-refresh-search: ' + passed + ' passed, pageerrors=0 ==');
})().catch(e => { console.error('FAIL photo-refresh-search', e && e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

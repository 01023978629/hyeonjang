/* v340: restored/Drive photos remain deletable through both real photo views.
   Synthetic data, isolated browser storage, all non-local requests blocked. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ROOT = path.join(__dirname, '..');
const MUTATION = process.env.HJ_DELETE_ACCESS_MUTATION || '';
const mutations = {
  photos: ['const tools=photoActionTools(p);', "const tools=p._virtual?'':photoActionTools(p);"],
  project: ['const tools=photoActionTools(f);', "const tools=f._virtual?'':photoActionTools(f);"],
  mobile: ['return __mobileMode', 'return false'],
  desktop: ['return __mobileMode', 'return (__mobileMode||p._virtual)'],
  hover: ['.ph:hover .ph-tools,.ph:focus-within .ph-tools{opacity:1}', '.ph:hover .ph-tools-disabled,.ph:focus-within .ph-tools{opacity:1}'],
  sheet: ["(f._virtual?'':btn('⇄ 파일 이동','ghost','move')+btn('✎ 이름 변경','ghost','rename'))", "(btn('⇄ 파일 이동','ghost','move')+btn('✎ 이름 변경','ghost','rename'))"]
};
let source;
if (MUTATION) {
  assert(mutations[MUTATION], 'known mutation');
  source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const [before, after] = mutations[MUTATION];
  assert.equal(source.split(before).length, 2, 'unique mutation anchor');
  source = source.replace(before, after);
}
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  let count = 0;
  for (const mobile of [false, true]) for (const view of ['photos', 'project']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: mobile ? 390 : 1280, height: 844 }, hasTouch: mobile, isMobile: mobile });
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if (source && req.url() === APP) return route.fulfill({ status: 200, contentType: 'text/html', body: source });
      return url.origin === new URL(APP).origin && req.method() === 'GET' ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(mobile => {
      localStorage.setItem('hj_onboard_done', '1');
      localStorage.setItem('pref_mobile', mobile ? '1' : '0');
      localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    }, mobile);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
    await page.evaluate(async ({ mobile, view }) => {
      await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
      taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const project = 'TEST_DELETE_ACCESS';
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
      const record = (id, extra) => ({ id, name: id + '.png', kind: 'photo', ext: 'png', size: 70, project,
        when: new Date('2026-09-01T00:00:00Z'), thumb: png, _virtual: true, ...extra });
      state.projects = [{ name: project, stage: 2, phases: [], customer: {}, archived: false, received: 0, cost: { material: 0, labor: 0, outsource: 0 } }];
      state.files = [record('TEST_DRIVE', { _driveId: 'TEST_DRIVE_ID' }),
        record('TEST_RESTORED', { thumb: null, project: view === 'photos' ? null : project }),
        record('TEST_LOCAL', { _virtual: false })];
      state.activeProject = view === 'project' ? project : null; state.tab = view; state.search = '';
      state.dirHandle = null; state._demo = false; state.dirty = false;
      __photoCache.key = null; __sel.clear(); __selMode = false; __tabStale = false; __removedIds.clear();
      __relay.url = ''; __relay.token = ''; __gdToken = null;
      __mobileMode = mobile; applyMobileMode(); __projPhotoOpen.add(project); __projView = null;
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    }, { mobile, view });
    for (const id of ['TEST_DRIVE', 'TEST_RESTORED']) {
      const button = page.locator((mobile ? '[data-phmore="' : '[data-delphoto="') + id + '"]');
      assert.equal(await button.count(), 1, view + ' virtual photo must expose delete control');
      const openDelete = async () => {
        if (mobile) {
          const box = await button.boundingBox();
          assert(box && box.width >= 36 && box.height >= 36, 'visible touch-sized menu');
          await button.click();
          assert.deepEqual(await page.locator('#modalRoot .phToolBtn').evaluateAll(bs => bs.map(b => b.dataset.fn)), ['delete'], 'virtual photo offers delete without local-only tools');
          if (process.env.HJ_DELETE_ACCESS_SCREENSHOTS && view === 'photos' && id === 'TEST_DRIVE') {
            await page.screenshot({ path: path.join(process.env.HJ_DELETE_ACCESS_SCREENSHOTS, 'photo-delete-menu.png') });
          }
          await page.locator('#modalRoot .phToolBtn[data-fn="delete"]').click();
        } else {
          const photo = page.locator('.ph').filter({ has: button });
          const tools = photo.locator('.ph-tools');
          const opacity = async () => tools.evaluate(async el => {
            getComputedStyle(el).opacity;
            await Promise.all(el.getAnimations().map(a => a.finished));
            return getComputedStyle(el).opacity;
          });
          await page.locator('#globalSearch').focus();
          await page.mouse.move(0, 0);
          assert.equal(await opacity(), '0', 'PC tools stay hidden until hover or focus');
          await photo.hover();
          assert.equal(await opacity(), '1', 'PC hover reveals delete control');
          assert.equal(await photo.locator('[data-movephoto],[data-rename]').count(), 0, 'virtual PC photo hides local-only tools');
          if (process.env.HJ_DELETE_ACCESS_SCREENSHOTS && view === 'photos' && id === 'TEST_DRIVE') {
            await page.screenshot({ path: path.join(process.env.HJ_DELETE_ACCESS_SCREENSHOTS, 'photo-delete-hover.png') });
          }
          await page.mouse.move(0, 0);
          await button.focus();
          assert.equal(await opacity(), '1', 'keyboard focus reveals delete control');
          await photo.hover();
          await button.click();
        }
      };
      await openDelete();
      await page.waitForFunction(() => document.querySelector('#modalRoot .mbody')?.textContent.includes('안전 백업이 저장된 뒤'));
      assert.match(await page.locator('#modalRoot .mbody').innerText(), /PC·휴대폰·드라이브 원본은 삭제하지 않습니다/);
      assert(await page.evaluate(id => state.files.some(f => f.id === id), id), 'opening confirmation preserves photo');
      await page.locator('#modalRoot .mfoot button.ghost').click();
      await page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && !__mobileSheetHistoryRetire);
      assert(await page.evaluate(id => state.files.some(f => f.id === id), id), 'cancel preserves photo');
      await openDelete();
      await page.waitForFunction(() => document.querySelector('#modalRoot .mbody')?.textContent.includes('안전 백업이 저장된 뒤'));
      await page.locator('#modalRoot .mfoot button.warn').click();
      await page.waitForFunction(id => !state.files.some(f => f.id === id) && !__modalCloseLocked && !__mobileSheetHistoryRetire, id);
      const result = await page.evaluate(async id => {
        await __appStateWriteQueue;
        return { snaps: await idbGetStrict('hj_snaps'), saved: await idbGetStrict('appState'),
          removed: [...__removedIds], savedRemoved: await idbGetStrict('removed_ids'), local: state.files.some(f => f.id === 'TEST_LOCAL') };
      }, id);
      assert(result.local, 'unselected local photo preserved');
      assert(result.snaps.some(s => s.data.files.some(f => f.name === id + '.png')), 'snapshot contains deleted photo');
      assert(!result.saved.files.some(f => f.name === id + '.png'), 'deletion persisted');
      if (id === 'TEST_DRIVE') {
        assert(result.removed.includes('TEST_DRIVE_ID'), 'Drive reimport protection recorded');
        assert(result.savedRemoved.includes('TEST_DRIVE_ID'), 'Drive reimport protection persisted');
      }
      count++;
      console.log('PASS ' + (mobile ? 'mobile' : 'PC') + ' ' + view + ' ' + id + ' UI/cancel/snapshot/persist');
    }
    assert.equal(await page.locator(mobile ? '[data-phmore="TEST_LOCAL"]' : '[data-delphoto="TEST_LOCAL"]').count(), 1, 'local photo tools preserved');
    assert.deepEqual(errors, [], 'no page errors');
    await context.close();
  }
  console.log('PASS photo-delete-access ' + count + '/8 scenarios');
  await browser.close();
})().catch(async e => { console.error(e.stack || e); if (browser) await browser.close(); process.exitCode = 1; });

/* mobile-field-flow.e2e.js — 현장에서 폰으로 가장 자주 쓰는 흐름을 지킨다.
   ① 현장 미선택 촬영은 먼저 현장을 고르게 하고, 미배정 촬영은 명시적으로만 허용
   ② 폰의 실제 조작부는 44px 이상이며 상단이 작업 공간을 과하게 차지하지 않음
   ③ 더보기 108개 기능은 검색·바로가기 뒤 접힌 카테고리로 시작
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); } catch (e) {}
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    state.projects = [
      { name: '열매현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false },
      { name: '효성현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false },
    ];
    state.files = [];
    state.activeProject = null;
    state.tab = 'dashboard';
    __mobileMode = true;
    applyMobileMode();
    render();
  });

  await test('① 현장 미선택 촬영은 카메라보다 현장 선택 시트가 먼저 열린다', async () => {
    const out = await page.evaluate(() => {
      document.querySelector('[data-mnav="__camera"]').click();
      return {
        sheet: !!document.getElementById('cameraProjectSheet'),
        cameraInput: !!document.getElementById('camInput'),
        active: state.activeProject,
        text: (document.getElementById('cameraProjectSheet') || {}).textContent || '',
      };
    });
    assert(out.sheet, '촬영 현장 선택 시트가 열려야 함');
    assert(!out.cameraInput, '현장을 고르기 전에는 카메라 입력을 만들면 안 됨');
    assert(out.active === null, '선택 전 activeProject를 임의로 바꾸면 안 됨');
    assert(/촬영할 현장/.test(out.text), '왜 선택해야 하는지 안내가 있어야 함');
  });

  await test('① 촬영 현장 선택 시트는 초점을 받고 Esc로 닫힌 뒤 호출 버튼에 복귀한다', async () => {
    await page.evaluate(() => {
      closeCameraProjectSheet();
      const opener = document.querySelector('[data-mnav="__camera"]');
      opener.focus();
      openCamera();
    });
    await page.waitForTimeout(30);
    const focusedInside = await page.evaluate(() => {
      const sheet = document.getElementById('cameraProjectSheet');
      return {
        inside: !!sheet && sheet.contains(document.activeElement),
        locked: document.body.classList.contains('camera-sheet-open'),
      };
    });
    assert(focusedInside.inside, '시트가 열리면 키보드 초점이 시트 안으로 이동해야 함');
    assert(focusedInside.locked, '시트가 열린 동안 뒤 화면 스크롤을 잠가야 함');
    await page.locator('#cameraUnassigned').focus();
    await page.keyboard.press('Tab');
    assert(await page.locator('#cameraProjectClose').evaluate(el => el === document.activeElement), '마지막 조작부에서 Tab을 누르면 첫 조작부로 돌아와야 함');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
    const out = await page.evaluate(() => ({
      closed: !document.getElementById('cameraProjectSheet'),
      restored: document.activeElement === document.querySelector('[data-mnav="__camera"]'),
      unlocked: !document.body.classList.contains('camera-sheet-open'),
    }));
    assert(out.closed, 'Esc를 누르면 촬영 현장 선택 시트가 닫혀야 함');
    assert(out.restored, '닫힌 뒤 초점이 촬영 버튼으로 돌아와야 함');
    assert(out.unlocked, '닫힌 뒤 화면 스크롤 잠금을 풀어야 함');
    await page.evaluate(() => openCamera());
  });

  await test('① 현장을 고르면 그 현장이 활성화되고 카메라가 열린다', async () => {
    const project = page.locator('[data-camera-project="열매현장"]');
    assert(await project.count() === 1, '촬영 현장 선택지에 열매현장이 있어야 함');
    const chooserReady = page.waitForEvent('filechooser');
    await project.click();
    await chooserReady;
    const out = await page.evaluate(() => ({
      active: state.activeProject,
      closed: !document.getElementById('cameraProjectSheet'),
      chip: document.getElementById('projChip').textContent,
    }));
    assert(out.active === '열매현장', '고른 현장이 activeProject가 되어야 함: ' + out.active);
    assert(out.closed, '선택 뒤 시트가 닫혀야 함');
    assert(out.chip.includes('열매현장'), '상단 현장 표시가 선택 결과를 보여야 함: ' + out.chip);
  });

  await test('① 미배정 촬영은 경고된 보조 버튼을 직접 눌렀을 때만 열린다', async () => {
    await page.evaluate(() => {
      state.activeProject = null;
      const old = document.getElementById('camInput'); if (old) old.remove();
      openCamera();
    });
    const btn = page.locator('#cameraUnassigned');
    assert(await btn.count() === 1, '미배정 촬영 버튼은 선택 시트 안에 한 개 있어야 함');
    const chooserReady = page.waitForEvent('filechooser');
    await btn.click();
    await chooserReady;
    const active = await page.evaluate(() => state.activeProject);
    assert(active === null, '미배정 촬영은 activeProject를 만들지 않아야 함');
  });

  await test('① 이미 현장을 선택했다면 추가 시트 없이 바로 카메라가 열린다', async () => {
    await page.evaluate(() => {
      state.activeProject = '효성현장';
      const old = document.getElementById('camInput'); if (old) old.remove();
    });
    const chooserReady = page.waitForEvent('filechooser');
    await page.locator('[data-mnav="__camera"]').click();
    await chooserReady;
    const sheet = await page.locator('#cameraProjectSheet').count();
    assert(sheet === 0, '선택된 현장이 있으면 선택 시트를 다시 열지 않아야 함');
  });

  await test('② 390px 화면의 보이는 버튼·입력은 모두 44px 이상이고 상단은 118px 이하다', async () => {
    const out = await page.evaluate(() => {
      ['cameraProjectSheet', 'cameraProjectBackdrop', 'moreSheet', 'moreBackdrop'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
      state.tab = 'dashboard'; render(); window.scrollTo(0, 0);
      const small = [...document.querySelectorAll('button,input,select,textarea')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.width < 44 || r.height < 44);
      }).map(el => {
        const r = el.getBoundingClientRect();
        return ((el.id || el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)) + ' ' + Math.round(r.width) + '×' + Math.round(r.height);
      });
      return {
        small,
        headerH: Math.round(document.querySelector('header').getBoundingClientRect().height),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert(out.small.length === 0, '44px 미만 조작부: ' + out.small.slice(0, 8).join(' / '));
    assert(out.headerH <= 118, '상단 높이가 너무 큼: ' + out.headerH + 'px');
    assert(out.overflow <= 1, '가로 넘침: ' + out.overflow + 'px');
  });

  await test('③ 더보기는 6개 접힌 카테고리로 시작하고 검색하면 기능을 찾는다', async () => {
    const out = await page.evaluate(() => {
      openMoreSheetV2();
      const sheet = document.getElementById('moreSheet');
      const details = [...sheet.querySelectorAll('details.more-cat-block')];
      const summarySmall = details.map(d => d.querySelector('summary').getBoundingClientRect().height).filter(h => h < 44).length;
      return {
        categories: details.length,
        open: details.filter(d => d.open).length,
        scrollHeight: sheet.scrollHeight,
        summarySmall,
        searchH: document.getElementById('moreSearch').getBoundingClientRect().height,
      };
    });
    assert(out.categories === 6, '카테고리는 6개여야 함: ' + out.categories);
    assert(out.open === 0, '처음에는 모든 카테고리가 접혀 있어야 함: ' + out.open);
    assert(out.scrollHeight < 1000, '처음부터 전체 108개가 펼쳐져 너무 김: ' + out.scrollHeight + 'px');
    assert(out.summarySmall === 0 && out.searchH >= 44, '카테고리·검색도 44px 터치 높이를 지켜야 함');

    await page.locator('details[data-cat="site"] summary').click();
    assert(await page.locator('details[data-cat="site"][open]').count() === 1, '현장·시공 카테고리가 펼쳐져야 함');
    await page.locator('#moreSearch').fill('사진');
    const hits = await page.locator('#moreSearchResult [data-moreaction]').count();
    assert(hits > 0, '사진 검색 결과가 한 개 이상이어야 함');
  });

  await test('★ pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FAIL', e && e.stack || e);
  process.exit(1);
});

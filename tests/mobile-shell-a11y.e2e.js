/* mobile-shell-a11y.e2e.js — 모바일 공통 시트와 오프라인 안내 회귀
   ① 현장 선택 시트: 실제 버튼, dialog 의미, 초점·Esc·Tab·스크롤 잠금
   ② 더보기 시트: 검색 초점, 닫기·Esc·Tab·스크롤 잠금
   ③ 오프라인 안내: 60px 하단 메뉴를 가리지 않음
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
      { name: '점검현장 A', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false },
      { name: '점검현장 B', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false },
    ];
    state.files = [];
    state.activeProject = null;
    state.tab = 'dashboard';
    __mobileMode = true;
    applyMobileMode();
    render();
  });

  await test('① 현장 선택 시트는 버튼과 dialog 의미를 갖고 처음 초점이 안으로 이동한다', async () => {
    await page.locator('#projChip').focus();
    await page.locator('#projChip').click();
    await page.waitForTimeout(30);
    const out = await page.evaluate(() => {
      const sheet = document.getElementById('projSheet');
      return {
        role: sheet && sheet.getAttribute('role'),
        modal: sheet && sheet.getAttribute('aria-modal'),
        labelled: sheet && sheet.getAttribute('aria-labelledby'),
        focusInside: !!sheet && sheet.contains(document.activeElement),
        rowButtons: sheet ? sheet.querySelectorAll('button[data-psel]').length : 0,
        rowDivs: sheet ? sheet.querySelectorAll('div[data-psel]').length : 0,
        locked: document.body.classList.contains('mobile-sheet-open'),
        close: !!document.getElementById('projSheetClose'),
      };
    });
    await page.evaluate(() => {
      ['projSheet', 'projSheetBd'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
      document.body.classList.remove('mobile-sheet-open');
    });
    assert(out.role === 'dialog' && out.modal === 'true' && out.labelled === 'projSheetTitle', '현장 선택 시트의 dialog 연결이 빠짐');
    assert(out.focusInside, '현장 선택 시트가 열리면 초점이 안으로 이동해야 함');
    assert(out.rowButtons >= 3 && out.rowDivs === 0, '전체 보기와 현장 행은 실제 button이어야 함');
    assert(out.locked && out.close, '배경 스크롤 잠금과 닫기 버튼이 있어야 함');
  });

  await test('① 현장 선택 시트는 Tab을 순환하고 Esc 뒤 호출 버튼으로 복귀한다', async () => {
    await page.locator('#projChip').focus();
    await page.locator('#projChip').click();
    await page.waitForTimeout(30);
    const last = page.locator('#projSheet button:not([disabled]), #projSheet input:not([disabled])').last();
    if (await last.count()) { await last.focus(); await page.keyboard.press('Tab'); }
    const cycled = await page.evaluate(() => document.activeElement === document.getElementById('projSheetClose'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
    const out = await page.evaluate(() => ({
      closed: !document.getElementById('projSheet') && !document.getElementById('projSheetBd'),
      restored: document.activeElement === document.getElementById('projChip'),
      unlocked: !document.body.classList.contains('mobile-sheet-open'),
    }));
    await page.evaluate(() => {
      ['projSheet', 'projSheetBd'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
      document.body.classList.remove('mobile-sheet-open');
    });
    assert(cycled, '마지막 조작부에서 Tab을 누르면 닫기 버튼으로 순환해야 함');
    assert(out.closed && out.restored && out.unlocked, 'Esc 닫기·초점 복귀·스크롤 잠금 해제가 모두 필요함: '+JSON.stringify(out));
  });

  await test('② 더보기 시트는 검색에 초점을 두고 Esc·Tab·스크롤 잠금을 지원한다', async () => {
    const opener = page.locator('[data-mnav="__more"]');
    await opener.focus();
    await opener.click();
    await page.waitForTimeout(30);
    const before = await page.evaluate(() => {
      const sheet = document.getElementById('moreSheet');
      return {
        role: sheet && sheet.getAttribute('role'),
        modal: sheet && sheet.getAttribute('aria-modal'),
        labelled: sheet && sheet.getAttribute('aria-labelledby'),
        searchFocused: document.activeElement === document.getElementById('moreSearch'),
        locked: document.body.classList.contains('mobile-sheet-open'),
        close: !!document.getElementById('moreSheetClose'),
      };
    });
    const focusSetup = await page.evaluate(() => {
      const sheet = document.getElementById('moreSheet');
      const visible = [...sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el => {
        const closed = el.closest('details:not([open])');
        return el.getClientRects().length && (!closed || (el.tagName === 'SUMMARY' && el.parentElement === closed));
      });
      if (visible.length) visible[visible.length - 1].focus();
      const describe = el => el && (el.id || el.getAttribute('data-moreaction') || el.getAttribute('data-more') || el.tagName);
      return { active: describe(document.activeElement), last: describe(visible[visible.length - 1]), count: visible.length };
    });
    await page.keyboard.press('Tab');
    const cycleState = await page.evaluate(() => ({
      cycled: document.activeElement === document.getElementById('moreSheetClose'),
      active: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('data-moreaction') || document.activeElement.getAttribute('data-more') || document.activeElement.tagName),
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
    const after = await page.evaluate(() => ({
      closed: !document.getElementById('moreSheet') && !document.getElementById('moreBackdrop'),
      restored: document.activeElement === document.querySelector('[data-mnav="__more"]'),
      unlocked: !document.body.classList.contains('mobile-sheet-open'),
    }));
    await page.evaluate(() => {
      ['moreSheet', 'moreBackdrop'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
      document.body.classList.remove('mobile-sheet-open');
    });
    assert(before.role === 'dialog' && before.modal === 'true' && before.labelled === 'moreSheetTitle', '더보기 시트의 dialog 연결이 빠짐');
    assert(before.searchFocused && before.locked && before.close, '검색 초점·배경 잠금·닫기 버튼이 필요함');
    assert(cycleState.cycled, '더보기 마지막 조작부의 Tab은 닫기 버튼으로 순환해야 함: setup='+JSON.stringify(focusSetup)+', active='+cycleState.active);
    assert(after.closed && after.restored && after.unlocked, '더보기 Esc 닫기·초점 복귀·잠금 해제가 필요함');
  });

  await test('③ 오프라인 안내는 모바일 하단 메뉴 위에 표시되고 온라인 복귀 시 사라진다', async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(30);
    const out = await page.evaluate(() => {
      const bar = document.getElementById('hjNetBar');
      const nav = document.querySelector('.mobile-nav');
      const br = bar && bar.getBoundingClientRect();
      const nr = nav && nav.getBoundingClientRect();
      return {
        exists: !!bar,
        overlap: br && nr ? Math.max(0, Math.round(br.bottom - nr.top)) : 999,
        bottom: bar ? getComputedStyle(bar).bottom : '',
      };
    });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(30);
    const removed = await page.evaluate(() => !document.getElementById('hjNetBar'));
    assert(out.exists && out.overlap <= 1, '오프라인 안내가 하단 메뉴를 '+out.overlap+'px 가림 (bottom '+out.bottom+')');
    assert(removed, '온라인으로 돌아오면 오프라인 안내가 사라져야 함');
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

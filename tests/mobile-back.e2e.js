/* mobile-back.e2e.js — 휴대폰 뒤로가기가 앱을 벗어나지 않고 열린 하단 시트만 닫는지 검증
   ① 더보기·현장 선택·촬영 현장 선택을 각각 한 번의 뒤로가기로 닫는다
   ② 닫은 뒤 URL·업무 데이터·탭·스크롤 위치를 유지한다
   ③ 시트를 같은 동작에서 닫고 다시 열어도 history 경합으로 새 시트가 닫히지 않는다
   ④ 닫기 기록 이동이 시작된 뒤 연 새 시트와 새로고침 뒤 기록도 안전하게 처리한다
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
function near(actual, expected, tolerance) { return Math.abs(actual - expected) <= tolerance; }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' });
  const pageErrors = [];

  async function makePage() {
    const page = await ctx.newPage();
    page.setDefaultTimeout(9000); // 2.5초는 CI 부하에서 이동 대기가 끊겨 간헐 실패했다(2026-09-03). 동작 검증은 아래 어서션이 한다
    page.on('pageerror', e => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); } catch (e) {}
    });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      state.projects = [
        { name: '뒤로가기 점검현장', stage: 2, received: 0, phases: ['방수'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false },
        { name: '보관 점검현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: true },
      ];
      state.files = Array.from({ length: 160 }, (_, i) => ({
        id: 'mobile-back-photo-' + i,
        name: '점검사진-' + i + '.jpg',
        ext: 'jpg',
        kind: 'photo',
        project: '',
        when: new Date(2026, 7, 24, 9, i % 60),
      }));
      state.activeProject = null;
      state.search = '';
      state.tab = 'photos';
      __mobileMode = true;
      applyMobileMode();
      render();
      history.replaceState({ hjTest: 'base' }, '', location.href);
      history.pushState({ hjTest: 'top' }, '', location.href);
    });
    return page;
  }

  async function snapshot(page) {
    return page.evaluate(() => ({
      href: location.href,
      tab: state.tab,
      activeProject: state.activeProject,
      projectNames: state.projects.map(p => p.name + ':' + !!p.archived).join('|'),
      fileIds: state.files.map(f => f.id).join('|'),
      scrollY: window.scrollY,
    }));
  }

  async function assertBackCloses(kind, sheetId, backdropId, bodyClass, openerSelector) {
    const page = await makePage();
    try {
      await page.locator(openerSelector).focus();
      await page.evaluate(() => window.scrollTo(0, 820));
      const before = await snapshot(page);
      assert(before.scrollY > 700, kind + ' 시트 열기 전 목록이 충분히 내려가야 함: ' + before.scrollY);
      await page.evaluate(k => {
        if (k === 'more') openMoreSheetV2();
        else if (k === 'project') openProjectSheet();
        else openCameraProjectSheet();
      }, kind);
      await page.waitForSelector('#' + sheetId);

      await page.evaluate(() => history.back());
      await page.waitForFunction(id => !document.getElementById(id), sheetId);
      const after = await snapshot(page);
      const closed = await page.evaluate(({ backdropId, bodyClass }) => ({
        backdropGone: !document.getElementById(backdropId),
        unlocked: !document.body.classList.contains(bodyClass),
      }), { backdropId, bodyClass });

      assert(after.href === before.href, kind + ' 뒤로가기가 앱 URL을 바꾸면 안 됨: ' + before.href + ' → ' + after.href);
      assert(after.tab === before.tab && after.activeProject === before.activeProject, kind + ' 뒤로가기가 현재 작업 화면을 바꾸면 안 됨');
      assert(after.projectNames === before.projectNames && after.fileIds === before.fileIds, kind + ' 뒤로가기가 업무 데이터를 바꾸면 안 됨');
      assert(near(after.scrollY, before.scrollY, 5), kind + ' 뒤로가기가 목록 위치를 바꾸면 안 됨: ' + before.scrollY + ' → ' + after.scrollY);
      assert(closed.backdropGone && closed.unlocked, kind + ' 시트 배경과 스크롤 잠금도 함께 정리돼야 함');
      await page.waitForFunction(sel => document.activeElement === document.querySelector(sel), openerSelector);
    } finally {
      await page.close();
    }
  }

  await test('① 뒤로가기는 더보기 시트만 닫고 현재 작업을 유지한다', async () => {
    await assertBackCloses('more', 'moreSheet', 'moreBackdrop', 'mobile-sheet-open', '.mnav-btn[data-mnav="__more"]');
  });

  await test('② 뒤로가기는 현장 선택 시트만 닫고 현재 작업을 유지한다', async () => {
    await assertBackCloses('project', 'projSheet', 'projSheetBd', 'mobile-sheet-open', '#projChip');
  });

  await test('③ 뒤로가기는 촬영 현장 선택 시트만 닫고 현재 작업을 유지한다', async () => {
    await assertBackCloses('camera', 'cameraProjectSheet', 'cameraProjectBackdrop', 'camera-sheet-open', '.mnav-btn[data-mnav="__camera"]');
  });

  await test('④ 보관 목록을 다시 그린 직후에도 새 현장 선택 시트가 유지되고 한 번의 뒤로가기로 닫힌다', async () => {
    const page = await makePage();
    try {
      await page.locator('#projChip').focus();
      await page.evaluate(() => openProjectSheet());
      await page.waitForSelector('#psArcTg');
      await page.locator('#psArcTg').click();
      await page.waitForTimeout(80);
      assert(await page.locator('#projSheet').count() === 1, '보관 목록을 펼쳐 다시 만든 현장 선택 시트가 사라지면 안 됨');
      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !document.getElementById('projSheet'));
      const stateAfter = await page.evaluate(() => ({ href: location.href, marker: history.state && history.state.hjTest }));
      assert(stateAfter.href === APP && stateAfter.marker === 'top', '한 번의 뒤로가기는 시트만 닫고 앱 기록을 유지해야 함: ' + JSON.stringify(stateAfter));
    } finally {
      await page.close();
    }
  });

  await test('⑤ 닫기 버튼으로 닫으면 임시 기록이 정리되어 다음 뒤로가기가 정상 동작한다', async () => {
    const page = await makePage();
    try {
      await page.evaluate(() => openMoreSheetV2());
      const sheetEntryClosed = page.evaluate(() => new Promise(resolve => {
        let done = false;
        const finish = value => { if (done) return; done = true; window.removeEventListener('popstate', onPop); resolve(value); };
        const onPop = () => finish(history.state && history.state.hjTest);
        window.addEventListener('popstate', onPop);
        setTimeout(() => finish('__timeout__'), 5000);   // 기록 이동은 브라우저 프로세스 왕복 — CI 부하에서 0.9초를 넘긴다(기본 대기 9초와 맞춤)
      }));
      await page.locator('#moreSheetClose').click();
      const restored = await sheetEntryClosed;
      assert(restored === 'top', '닫기 버튼은 시트용 임시 기록만 제거해야 함: ' + restored);
      const nextEntry = await page.evaluate(() => new Promise(resolve => {
        window.addEventListener('popstate', () => resolve(history.state && history.state.hjTest), { once: true });
        history.back();
      }));
      assert(nextEntry === 'base', '다음 뒤로가기는 기존 앱 기록으로 이동해야 함: ' + nextEntry);
      const out = await page.evaluate(() => ({ sheet: !!document.getElementById('moreSheet'), href: location.href }));
      assert(!out.sheet && out.href === APP, '닫기 뒤 임시 기록이 남아 뒤로가기를 한 번 더 소비하면 안 됨');
    } finally {
      await page.close();
    }
  });

  await test('⑥ 닫기 기록 이동이 시작된 뒤 연 새 시트는 늦은 popstate에도 유지된다', async () => {
    const page = await makePage();
    try {
      await page.evaluate(() => {
        openMoreSheetV2();
        document.getElementById('moreSheetClose').click();
        setTimeout(() => openProjectSheet(), 0);
      });
      await page.waitForSelector('#projSheet');
      await page.waitForTimeout(250);
      const afterLatePop = await page.evaluate(() => ({
        sheet: !!document.getElementById('projSheet'),
        marker: history.state && history.state.__hjMobileSheet,
        activeToken: __mobileSheetHistoryActive && __mobileSheetHistoryActive.token,
        appEntry: history.state && history.state.hjTest,
      }));
      assert(afterLatePop.sheet, '이전 시트의 늦은 popstate가 새 현장 선택 시트를 닫으면 안 됨');
      assert(afterLatePop.marker && afterLatePop.marker === afterLatePop.activeToken, '새 시트용 history 표시가 현재 기록에 유지돼야 함: ' + JSON.stringify(afterLatePop));
      assert(afterLatePop.appEntry === 'top', '경합 처리 중 기존 앱 기록을 바꾸면 안 됨: ' + JSON.stringify(afterLatePop));

      await page.evaluate(() => history.back());
      await page.waitForFunction(() => !document.getElementById('projSheet'));
      const afterBack = await page.evaluate(() => ({ marker: history.state && history.state.hjTest, href: location.href }));
      assert(afterBack.marker === 'top' && afterBack.href === APP, '다음 뒤로가기는 새 시트만 닫아야 함: ' + JSON.stringify(afterBack));
    } finally {
      await page.close();
    }
  });

  await test('⑦ 열린 시트에서 새로고침해도 유령 기록 없이 다음 뒤로가기가 기존 기록으로 이동한다', async () => {
    const page = await makePage();
    try {
      await page.evaluate(() => openMoreSheetV2());
      await page.waitForSelector('#moreSheet');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.waitForFunction(() => !(history.state && history.state.__hjMobileSheet));
      const cleaned = await page.evaluate(() => ({
        sheet: !!document.getElementById('moreSheet'),
        appEntry: history.state && history.state.hjTest,
        href: location.href,
      }));
      assert(!cleaned.sheet && cleaned.appEntry === 'top' && cleaned.href === APP, '새로고침 뒤 시트용 기록만 자동 정리돼야 함: ' + JSON.stringify(cleaned));

      const nextEntry = await page.evaluate(() => new Promise(resolve => {
        window.addEventListener('popstate', () => resolve(history.state && history.state.hjTest), { once: true });
        history.back();
      }));
      assert(nextEntry === 'base', '새로고침 뒤 첫 사용자 뒤로가기는 기존 기록으로 이동해야 함: ' + nextEntry);
    } finally {
      await page.close();
    }
  });

  await test('⑧ 기록 이동 중 요청한 새 시트는 실제 표시 직후 Back을 눌러도 기존 앱 기록을 지킨다', async () => {
    const page = await makePage();
    try {
      await page.evaluate(() => {
        history.replaceState({ hjTest: 'base' }, '', location.pathname + '?entry=base');
        history.pushState({ hjTest: 'top' }, '', location.pathname + '?entry=top');
        openMoreSheetV2();
        document.getElementById('moreSheetClose').click();
        setTimeout(() => {
          openProjectSheet();
          if (document.getElementById('projSheet')) {
            history.back();
            return;
          }
          const observer = new MutationObserver(() => {
            if (!document.getElementById('projSheet')) return;
            observer.disconnect();
            history.back();
          });
          observer.observe(document.body, { childList: true });
        }, 0);
      });
      await page.waitForFunction(() => !document.getElementById('projSheet') && !__mobileSheetHistoryRetire && !__mobileSheetHistoryDeferredOpen, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(50);
      const afterRapidBack = await page.evaluate(() => ({
        sheet: !!document.getElementById('projSheet'),
        appEntry: history.state && history.state.hjTest,
        href: location.href,
      }));
      assert(!afterRapidBack.sheet, '실제 표시 직후 누른 뒤로가기는 새 시트를 닫아야 함');
      assert(afterRapidBack.appEntry === 'top' && afterRapidBack.href.endsWith('?entry=top'), '뒤로가기가 시트 아래 앱 기록까지 건너뛰면 안 됨: ' + JSON.stringify(afterRapidBack));
    } finally {
      await page.close();
    }
  });

  await test('⑨ 예약 시트가 표시되기 전 Back은 열기 예약을 취소하고 기존 기록으로 이동한다', async () => {
    const page = await makePage();
    try {
      await page.evaluate(() => {
        history.replaceState({ hjTest: 'base' }, '', location.pathname + '?entry=base');
        history.pushState({ hjTest: 'top' }, '', location.pathname + '?entry=top');
        openMoreSheetV2();
        document.getElementById('moreSheetClose').click();
        setTimeout(() => {
          openProjectSheet();
          history.back();
        }, 0);
      });
      await page.waitForFunction(() => !document.getElementById('projSheet') && !__mobileSheetHistoryActive && !__mobileSheetHistoryDeferredOpen && !!(history.state && history.state.hjTest === 'base'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(50);
      const afterBackBeforeOpen = await page.evaluate(() => ({
        sheet: !!document.getElementById('projSheet'),
        appEntry: history.state && history.state.hjTest,
        href: location.href,
        active: !!__mobileSheetHistoryActive,
        deferred: !!__mobileSheetHistoryDeferredOpen,
      }));
      assert(!afterBackBeforeOpen.sheet && !afterBackBeforeOpen.active && !afterBackBeforeOpen.deferred, '표시 전 뒤로가기는 예약 시트와 내부 상태를 모두 취소해야 함: ' + JSON.stringify(afterBackBeforeOpen));
      assert(afterBackBeforeOpen.appEntry === 'base' && afterBackBeforeOpen.href.endsWith('?entry=base'), '시트가 보이지 않을 때 뒤로가기는 기존 앱 기록 이동을 막으면 안 됨: ' + JSON.stringify(afterBackBeforeOpen));
    } finally {
      await page.close();
    }
  });

  await test('★ pageerror 0', async () => {
    assert(pageErrors.length === 0, 'pageerror: ' + pageErrors.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('FAIL', e && e.stack || e);
  process.exit(1);
});

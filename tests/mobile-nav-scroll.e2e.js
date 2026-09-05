/* mobile-nav-scroll.e2e.js — 모바일 하단 탭의 위치 기억 회귀
   ① 새 탭은 처음에 맨 위에서 시작한다
   ② 탭마다 보던 위치를 기억해 돌아오면 복원한다
   ③ 현재 탭을 다시 누르면 맨 위로 이동한다
   ④ 촬영·더보기는 현재 위치를 바꾸지 않는다
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);

  await page.evaluate(() => {
    const today = localDate();
    state.projects = [{ name: '스크롤현장', stage: 2, received: 0, phases: ['철거'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
    state.files = Array.from({ length: 160 }, (_, i) => ({
      id: 'scroll-photo-' + i,
      name: '현장사진-' + i + '.jpg',
      ext: 'jpg',
      kind: 'photo',
      project: '',
      // 여러 날짜로 흩어 묶음을 여러 개 만든다 — 한 묶음이면 렌더 상한 때문에
      // 페이지가 짧아져, 상단 도구 압축(v243) 이후 850px 스크롤 시드가 안 잡힌다(실측 618)
      when: new Date(2026, 7, 1 + (i % 24), 9, i % 60)
    }));
    state.schedule = Array.from({ length: 48 }, (_, i) => ({
      id: 'scroll-schedule-' + i,
      date: today,
      time: String(8 + Math.floor(i / 6)).padStart(2, '0') + ':' + String((i % 6) * 10).padStart(2, '0'),
      title: '작업 일정 ' + i,
      project: '스크롤현장',
      workers: '',
      memo: '',
      hours: 8,
      report: null
    }));
    state.activeProject = null;
    state.search = '';
    state.tab = 'photos';
    __mobileMode = true;
    applyMobileMode();
    render();
  });
  await page.waitForTimeout(200);

  async function openTallTab(tab, y) {
    await page.evaluate(({ tab, y }) => {
      state.tab = tab;
      render();
      window.scrollTo(0, y);
    }, { tab, y });
    await page.waitForTimeout(180);
    return page.evaluate(() => window.scrollY);
  }

  await test('① 다른 탭을 처음 열면 맨 위에서 시작한다', async () => {
    const before = await openTallTab('photos', 420);
    assert(before > 320, '사진 탭이 충분히 내려가야 함: ' + before);
    await page.click('.mnav-btn[data-mnav="schedule"]');
    await page.waitForTimeout(220);
    const after = await page.evaluate(() => window.scrollY);
    assert(after < 50, '처음 연 일정표는 맨 위여야 함: scrollY=' + after);
  });

  await test('①-2 빠르게 연속 탭을 눌러도 새 탭의 첫 위치가 섞이지 않는다', async () => {
    const before = await page.evaluate(() => {
      Object.keys(__mobileTabScroll).forEach(k => delete __mobileTabScroll[k]);
      state.tab = 'photos';
      render();
      window.scrollTo(0, 850);
      return window.scrollY;
    });
    assert(before > 750, '연속 탭 전환 전 사진 위치: ' + before);

    await page.evaluate(() => {
      document.querySelector('.mnav-btn[data-mnav="schedule"]').click();
      document.querySelector('.mnav-btn[data-mnav="photos"]').click();
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await page.evaluate(() => document.querySelector('.mnav-btn[data-mnav="schedule"]').click());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.evaluate(() => window.scrollY);
    assert(after < 50, '처음 연 일정표 위치가 이전 탭 값과 섞이면 안 됨: scrollY=' + after);
  });

  await test('② 탭별로 보던 위치를 기억해 돌아오면 복원한다', async () => {
    const photoY = await openTallTab('photos', 820);
    assert(photoY > 720, '사진 탭 시드 위치: ' + photoY);
    await page.click('.mnav-btn[data-mnav="schedule"]');
    await page.waitForTimeout(180);
    await page.evaluate(() => window.scrollTo(0, 620));
    await page.waitForTimeout(160);
    const scheduleY = await page.evaluate(() => window.scrollY);
    assert(scheduleY > 520, '일정표 시드 위치: ' + scheduleY);
    await page.click('.mnav-btn[data-mnav="photos"]');
    await page.waitForTimeout(220);
    const restoredPhoto = await page.evaluate(() => window.scrollY);
    assert(near(restoredPhoto, photoY, 50), '사진 탭 위치 복원: 기대 ' + photoY + ', 실제 ' + restoredPhoto);
    await page.click('.mnav-btn[data-mnav="schedule"]');
    await page.waitForTimeout(220);
    const restoredSchedule = await page.evaluate(() => window.scrollY);
    assert(near(restoredSchedule, scheduleY, 50), '일정표 위치 복원: 기대 ' + scheduleY + ', 실제 ' + restoredSchedule);
  });

  await test('③ 현재 탭을 다시 누르면 맨 위로 이동한다', async () => {
    const before = await openTallTab('photos', 850);
    assert(before > 750, '재탭 전 위치: ' + before);
    await page.click('.mnav-btn[data-mnav="photos"]');
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.scrollY);
    assert(after < 50, '현재 탭 재탭은 맨 위로 이동해야 함: scrollY=' + after);
  });

  await test('③-2 재탭 직후 다른 탭을 눌러도 맨 위 의도가 유지된다', async () => {
    const before = await page.evaluate(() => {
      Object.keys(__mobileTabScroll).forEach(k => delete __mobileTabScroll[k]);
      state.tab = 'photos';
      render();
      window.scrollTo(0, 850);
      return window.scrollY;
    });
    assert(before > 750, '재탭 연속 전환 전 사진 위치: ' + before);

    await page.evaluate(() => {
      document.querySelector('.mnav-btn[data-mnav="photos"]').click();
      document.querySelector('.mnav-btn[data-mnav="schedule"]').click();
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await page.evaluate(() => document.querySelector('.mnav-btn[data-mnav="photos"]').click());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.evaluate(() => window.scrollY);
    assert(after < 50, '재탭의 맨 위 위치가 이전 값으로 덮이면 안 됨: scrollY=' + after);
  });

  await test('④ 촬영·더보기는 현재 스크롤 위치를 바꾸지 않는다', async () => {
    const before = await openTallTab('photos', 720);
    assert(before > 620, '시트 열기 전 위치: ' + before);
    await page.click('.mnav-btn[data-mnav="__more"]');
    await page.waitForTimeout(120);
    const afterMore = await page.evaluate(() => window.scrollY);
    assert(near(afterMore, before, 5), '더보기 시트가 위치를 바꾸면 안 됨: ' + before + '→' + afterMore);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.waitForFunction(() => !__mobileSheetHistoryRetire && !(history.state && history.state.__hjMobileSheet));
    await page.click('.mnav-btn[data-mnav="__camera"]');
    await page.waitForSelector('#cameraProjectSheet', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(120);
    const afterCamera = await page.evaluate(() => window.scrollY);
    assert(near(afterCamera, before, 5), '촬영 현장 선택이 위치를 바꾸면 안 됨: ' + before + '→' + afterCamera);
    await page.keyboard.press('Escape');
  });

  await test('⑤ 탭 위치 기억은 저장 데이터 구조를 바꾸지 않는다', async () => {
    const scrollKeys = await page.evaluate(() => Object.keys(serializeData()).filter(k => /scroll/i.test(k)));
    assert(scrollKeys.length === 0, '스크롤 위치는 직렬화 키로 저장하지 않아야 함: ' + scrollKeys.join(','));
  });

  await test('★ pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

/* mobile-nav-badges.e2e.js — 모바일 하단 메뉴의 실시간 업무 배지 회귀
   ① 현장사진: 미배정 사진만 센다(배정 사진·서류 제외)
   ② 일정표: 오늘 일정만 센다
   ③ 0건은 숨기고 100건 이상은 99+로 제한한다
   ④ 보조기기 라벨·44px 터치·기존 탭 이동을 보존한다
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    const today = localDate();
    const tomorrow = localDate(new Date(Date.now() + 86400000));
    state.projects = [{ name: '테스트현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
    state.files = [
      { id: 'p-unassigned-1', name: '미배정1.jpg', ext: 'jpg', kind: 'photo', project: '' },
      { id: 'p-unassigned-2', name: '미배정2.jpg', ext: 'jpg', kind: 'photo', project: null },
      { id: 'p-assigned', name: '배정.jpg', ext: 'jpg', kind: 'photo', project: '테스트현장' },
      { id: 'doc-unassigned', name: '미배정서류.pdf', ext: 'pdf', kind: 'other', project: '' }
    ];
    state.schedule = [
      { id: 'today-1', date: today, time: '09:00', title: '철거', project: '테스트현장' },
      { id: 'today-2', date: today, time: '13:00', title: '방수', project: '테스트현장' },
      { id: 'tomorrow-1', date: tomorrow, time: '09:00', title: '타일', project: '테스트현장' }
    ];
    state.tab = 'dashboard';
    __mobileMode = true;
    applyMobileMode();
    render();
  });

  await test('① 미배정 사진과 오늘 일정만 정확히 센다', async () => {
    const r = await page.evaluate(() => {
      const photoBtn = document.querySelector('.mnav-btn[data-mnav="photos"]');
      const scheduleBtn = document.querySelector('.mnav-btn[data-mnav="schedule"]');
      const photoBadge = photoBtn && photoBtn.querySelector('[data-mnav-badge]');
      const scheduleBadge = scheduleBtn && scheduleBtn.querySelector('[data-mnav-badge]');
      return {
        photoText: photoBadge && photoBadge.textContent.trim(),
        photoHidden: photoBadge ? photoBadge.hidden : null,
        scheduleText: scheduleBadge && scheduleBadge.textContent.trim(),
        scheduleHidden: scheduleBadge ? scheduleBadge.hidden : null,
        photoLabel: photoBtn && photoBtn.getAttribute('aria-label'),
        scheduleLabel: scheduleBtn && scheduleBtn.getAttribute('aria-label')
      };
    });
    assert(r.photoText === '2' && r.photoHidden === false, '미배정 사진 배지 2가 보여야 함: ' + JSON.stringify(r));
    assert(r.scheduleText === '2' && r.scheduleHidden === false, '오늘 일정 배지 2가 보여야 함: ' + JSON.stringify(r));
    assert(r.photoLabel === '현장사진, 미배정 2장', '사진 접근성 라벨: ' + r.photoLabel);
    assert(r.scheduleLabel === '일정표, 오늘 일정 2건', '일정 접근성 라벨: ' + r.scheduleLabel);
  });

  await test('② 배지는 클릭을 막지 않고 기존 44px 탭 이동을 보존한다', async () => {
    const r = await page.evaluate(() => {
      const btn = document.querySelector('.mnav-btn[data-mnav="photos"]');
      const badge = btn && btn.querySelector('[data-mnav-badge]');
      const rect = btn && btn.getBoundingClientRect();
      return {
        pointer: badge && getComputedStyle(badge).pointerEvents,
        ariaHidden: badge && badge.getAttribute('aria-hidden'),
        width: rect && Math.round(rect.width),
        height: rect && Math.round(rect.height)
      };
    });
    assert(r.pointer === 'none', '배지는 터치를 가로채면 안 됨: ' + r.pointer);
    assert(r.ariaHidden === 'true', '숫자 배지는 버튼 라벨과 중복 낭독되면 안 됨: ' + r.ariaHidden);
    assert(r.width >= 44 && r.height >= 44, '탭 버튼은 44px 이상이어야 함: ' + JSON.stringify(r));
    await page.click('.mnav-btn[data-mnav="photos"]');
    const moved = await page.evaluate(() => ({ tab: state.tab, on: document.querySelector('.mnav-btn[data-mnav="photos"]').classList.contains('on') }));
    assert(moved.tab === 'photos' && moved.on, '기존 현장사진 탭 이동이 유지돼야 함: ' + JSON.stringify(moved));
  });

  await test('③ 0건이면 숨기고 기본 접근성 라벨로 돌아간다', async () => {
    const r = await page.evaluate(() => {
      const tomorrow = localDate(new Date(Date.now() + 86400000));
      state.files = [
        { id: 'assigned-only', name: '배정.jpg', ext: 'jpg', kind: 'photo', project: '테스트현장' },
        { id: 'doc-only', name: '서류.pdf', ext: 'pdf', kind: 'other', project: '' }
      ];
      state.schedule = [{ id: 'tomorrow-only', date: tomorrow, time: '09:00', title: '내일 일정', project: '테스트현장' }];
      render();
      const photoBtn = document.querySelector('.mnav-btn[data-mnav="photos"]');
      const scheduleBtn = document.querySelector('.mnav-btn[data-mnav="schedule"]');
      const photoBadge = photoBtn && photoBtn.querySelector('[data-mnav-badge]');
      const scheduleBadge = scheduleBtn && scheduleBtn.querySelector('[data-mnav-badge]');
      return {
        photoHidden: photoBadge ? photoBadge.hidden : null,
        scheduleHidden: scheduleBadge ? scheduleBadge.hidden : null,
        photoLabel: photoBtn && photoBtn.getAttribute('aria-label'),
        scheduleLabel: scheduleBtn && scheduleBtn.getAttribute('aria-label')
      };
    });
    assert(r.photoHidden === true && r.scheduleHidden === true, '0건 배지는 숨겨야 함: ' + JSON.stringify(r));
    assert(r.photoLabel === '현장사진' && r.scheduleLabel === '일정표', '0건 기본 라벨: ' + JSON.stringify(r));
  });

  await test('④ 100건 이상은 99+로 표시한다', async () => {
    const r = await page.evaluate(() => {
      const today = localDate();
      state.files = Array.from({ length: 100 }, (_, i) => ({ id: 'many-photo-' + i, name: i + '.jpg', ext: 'jpg', kind: 'photo', project: '' }));
      state.schedule = Array.from({ length: 100 }, (_, i) => ({ id: 'many-schedule-' + i, date: today, time: '09:00', title: '일정 ' + i, project: '' }));
      render();
      const photoBadge = document.querySelector('.mnav-btn[data-mnav="photos"] [data-mnav-badge]');
      const scheduleBadge = document.querySelector('.mnav-btn[data-mnav="schedule"] [data-mnav-badge]');
      return {
        photo: photoBadge && photoBadge.textContent.trim(),
        schedule: scheduleBadge && scheduleBadge.textContent.trim()
      };
    });
    assert(r.photo === '99+' && r.schedule === '99+', '100건 이상은 99+여야 함: ' + JSON.stringify(r));
  });

  await test('★ pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

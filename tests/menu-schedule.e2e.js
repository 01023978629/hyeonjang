/* menu-schedule.e2e.js — 더보기 메뉴 이름 2줄 · 일정 탭 최근 30일 기본 · 사진 칸 공정표 (Playwright)

   2026-09-04 v257 (업그레이드 점검 나머지):
     ① 폰(390px) 더보기 메뉴의 긴 이름(예: 사업자·명함 보내기)이 「…」로 잘리지 않고 2줄까지 보인다
     ② 일정 탭은 날짜를 고르지 않았을 때 최근 30일부터만 보이고, 「지난 일정 N건 더 보기」로 전부 편다(다시 누르면 접힘)
     ③ 날짜를 고르면 그날만(버튼 없음). 최근 30일 안에 일정이 없으면 숨기지 않고 전부 보인다
     ④ 사진 칸을 그릴 때 projects 를 칸마다 훑지 않는다(공정표 한 번) — 결과는 같다
     ⑤ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // ① 더보기 메뉴 긴 이름
  const chips = await page.evaluate(() => {
    __mobileMode = true; applyMobileMode();
    openMoreSheetV2();
    const labels = [...document.querySelectorAll('.more-chip .more-chip-label')];
    const long = labels.filter(l => l.textContent.trim().length >= 8);
    const out = long.map(l => ({ t: l.textContent.trim(), clamp: getComputedStyle(l).webkitLineClamp, overflow: l.scrollWidth > l.clientWidth + 1, h: l.clientHeight, w: l.clientWidth }));
    const sheet = document.querySelector('.more-sheet'); if (sheet) sheet.remove(); document.querySelectorAll('.more-backdrop,.sheet-backdrop').forEach(b => b.remove());
    return out;
  });
  assert(chips.length >= 3, '① 긴 메뉴 이름이 여러 개 있다: ' + chips.length);
  assert(chips.every(c => c.clamp === '2' && !c.overflow), '① 긴 이름이 가로로 넘치지(…) 않고 2줄까지 허용: ' + JSON.stringify(chips.slice(0, 4)));
  assert(chips.some(c => c.h >= 22), '① 실제로 2줄로 접힌 이름이 있다(높이 22px+): ' + JSON.stringify(chips.map(c => [c.t, c.h])));

  // ②③ 일정 탭 범위
  const sched = await page.evaluate(() => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };
    const mk = (id, n, title) => ({ id, date: day(n), time: '09:00', title, project: '', workers: '', memo: '', hours: 8, report: null });
    state.schedule = [mk('s-today', 0, '오늘 작업'), mk('s-10', -10, '열흘 전'), mk('s-60', -60, '두 달 전'), mk('s-400', -400, '작년')];
    __calSelDate = null; __schShowAll = false; state.tab = 'schedule'; render();
    const titles = () => [...document.querySelectorAll('#view .sch-title')].map(e => e.textContent.trim());
    const btn = () => (document.getElementById('schPastToggle') || {}).textContent || '';
    const out = { def: titles(), btn1: btn() };
    document.getElementById('schPastToggle').click();
    out.all = titles(); out.btn2 = btn();
    document.getElementById('schPastToggle').click();
    out.back = titles();
    __calSelDate = day(-60); render();
    out.picked = titles(); out.pickedBtn = !!document.getElementById('schPastToggle');
    __calSelDate = null; state.schedule = [mk('o1', -60, '두 달 전'), mk('o2', -400, '작년')]; __schShowAll = false; render();
    out.onlyOld = titles(); out.onlyOldBtn = !!document.getElementById('schPastToggle');
    state.schedule = []; render();
    return out;
  });
  assert(sched.def.join() === '열흘 전,오늘 작업' && /지난 일정 2건 더 보기/.test(sched.btn1), '② 기본은 최근 30일(2건) + 지난 2건 버튼: ' + JSON.stringify(sched));
  assert(sched.all.length === 4 && /최근 30일만 보기/.test(sched.btn2) && sched.back.length === 2, '② 펼치면 4건, 다시 누르면 2건: ' + JSON.stringify(sched));
  assert(sched.picked.join() === '두 달 전' && !sched.pickedBtn, '③ 날짜를 고르면 그날만, 버튼 없음: ' + JSON.stringify(sched));
  assert(sched.onlyOld.length === 2 && !sched.onlyOldBtn, '③ 최근 일정이 없으면 숨기지 않는다: ' + JSON.stringify(sched));

  // ④ 사진 칸 공정표
  const perf = await page.evaluate(() => {
    const P = (name) => ({ name, stage: 2, received: 0, phases: ['철거', '방수'], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false });
    state.projects = [P('둔산현장'), P('은행현장')];
    state.files = [];
    for (let i = 0; i < 40; i++) state.files.push({ id: 'q' + i, name: 'q' + i + '.jpg', ext: 'jpg', kind: 'photo', project: i % 2 ? '둔산현장' : '은행현장', when: new Date('2026-08-1' + (i % 9) + 'T09:' + String(i).padStart(2, '0') + ':00'), size: 1000 + i, _driveId: 'd' + i });
    const orig = projPhases; window.__pp = 0; projPhases = (n) => { window.__pp++; return orig(n); };
    state.tab = 'photos'; state.activeProject = null; __photoCache.key = null; render();
    projPhases = orig;
    const cells = document.querySelectorAll('#view .ph-cell').length;
    const withPhase = document.querySelectorAll('#view .ph-phase-btn').length;
    return { calls: window.__pp, cells, withPhase, table: __phasesByName && Object.keys(__phasesByName).length };
  });
  assert(perf.cells >= 40 && perf.withPhase >= 40, '④ 사진 칸 40개에 공정 버튼이 있다(결과 동일): ' + JSON.stringify(perf));
  assert(perf.calls < 40 && perf.table === 2, '④ 칸마다 projPhases 를 부르지 않는다(공정표 1회): ' + JSON.stringify(perf));

  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));
  console.log('PASS  menu-schedule: 더보기 이름 2줄 · 일정 최근 30일 + 더 보기 · 날짜 선택 우선 · 공정표 1회');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

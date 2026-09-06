/* schedule-add-prefill.e2e.js — 「+ 일정 추가」가 고른 날짜·보고 있던 현장을 미리 채운다 (Playwright)

   2026-09-06 v261 (업그레이드 조사 [13]): 달력에서 날짜를 고른 채 「+ 일정 추가」를 누르면 폼 날짜는 오늘, 현장은 빈 값이었다.
     ① 날짜를 고른 상태 → #schDate 가 그 날짜
     ② 현장별 보기(activeProject) → #schProj 가 그 현장으로 선택됨
     ③ 고른 날짜·현장이 없으면 오늘·빈 현장(기존 동작), 보관된 현장은 채우지 않음
     ④ 기존 일정 수정(openScheduleEdit(id))은 그 일정 값 그대로(미리채움 안 함)
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
  await page.waitForFunction(() => typeof openScheduleEdit === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  const form = () => page.evaluate(() => ({ date: document.getElementById('schDate').value, proj: document.getElementById('schProj').value, title: document.getElementById('schTitle').value }));
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
  await page.evaluate(([P]) => {
    state.projects = [{ name: '둔산현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, { name: '옛현장', stage: 4, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: true }];
    state.schedule = [{ id: 's-old', date: '2026-08-20', time: '10:00', title: '옛 일정', project: '둔산현장', workers: '', memo: '', hours: 8, report: null }];
    state.activeProject = null; state.tab = 'schedule'; __calSelDate = null; render();
  }, [null]);

  // ① 날짜 선택 → 폼 날짜
  await page.evaluate(() => { __calSelDate = '2026-09-08'; render(); document.getElementById('schAdd').click(); });
  await page.waitForSelector('#schDate');
  const a = await form();
  assert(a.date === '2026-09-08' && a.proj === '' && a.title === '', '① 고른 날짜가 미리 채워진다: ' + JSON.stringify(a));
  await page.evaluate(() => closeModal());

  // ② 현장별 보기 → 현장 선택
  await page.evaluate(() => { __calSelDate = null; state.activeProject = '둔산현장'; openScheduleEdit(null); });
  await page.waitForSelector('#schProj');
  const b = await form();
  assert(b.proj === '둔산현장' && b.date === localDateOf(new Date()), '② 보고 있던 현장이 선택되고 날짜는 오늘: ' + JSON.stringify(b));
  await page.evaluate(() => closeModal());

  // ③ 아무것도 안 고르면 기존 동작 / 보관 현장은 채우지 않음
  await page.evaluate(() => { state.activeProject = null; openScheduleEdit(null); });
  await page.waitForSelector('#schProj');
  const c = await form();
  assert(c.proj === '' && c.date === localDateOf(new Date()), '③ 선택 없음 → 오늘·빈 현장: ' + JSON.stringify(c));
  await page.evaluate(() => closeModal());
  await page.evaluate(() => { state.activeProject = '옛현장'; openScheduleEdit(null); });
  await page.waitForSelector('#schProj');
  const c2 = await form();
  assert(c2.proj === '', '③ 보관된 현장은 미리 채우지 않는다: ' + JSON.stringify(c2));
  await page.evaluate(() => closeModal());

  // ④ 기존 일정 수정은 그대로
  await page.evaluate(() => { __calSelDate = '2026-09-08'; state.activeProject = '옛현장'; openScheduleEdit('s-old'); });
  await page.waitForSelector('#schDate');
  const d = await form();
  assert(d.date === '2026-08-20' && d.proj === '둔산현장' && d.title === '옛 일정', '④ 수정은 그 일정 값 그대로: ' + JSON.stringify(d));
  await page.evaluate(() => { closeModal(); __calSelDate = null; state.activeProject = null; });

  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));
  console.log('PASS  schedule-add-prefill: 고른 날짜·보고 있던 현장 미리채움 · 보관 현장 제외 · 수정은 그대로');
  await browser.close();

  function localDateOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

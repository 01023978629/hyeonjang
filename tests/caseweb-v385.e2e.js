/* caseweb-v385.e2e.js — v385 '만물 웹' 홍보 칩 → 📰 사례 내보내기, [🏠 웹 게시 표시] → 홍보 현황 ✓ (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 광고 탭 🏁 완공 현장 홍보·현장 준공 관리의 [🏠 만물 웹] 은 원고 창 대신 📰 사례 내보내기(사진·6항목·EXIF 제거 ZIP)를 그 현장으로 연다.
   · 사례 내보내기 [🏠 웹 게시 표시] → 게시 기록(만물 웹·이 현장) 하나 → ✓, 다시 열면 '🏠 웹 게시됨 ✓', 또 눌러도 기록이 늘지 않음. 오늘은 2026-11-05(목) 고정. */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.open = () => null; window.portalAutoSync = () => 0;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = []; state.files = []; state.contacts = [];
    state.projects = [{ name: '가상아파트A', stage: 3, received: 0, phases: ['우수관 교체'], cost: {}, customer: {}, doneAt: '2026-11-01' }];
    state.adPosts = [{ id: 'a1', ch: 'instagram', date: '2026-11-02', title: 'A 인스타', url: '', memo: '', project: '가상아파트A' }];
    window.__adCh = 'threads'; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const btnTexts = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent));
  const clickBtn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); b.click(); }, re);

  await test('① 광고 탭 🏁 [🏠 만물 웹] → 📰 사례 내보내기(그 현장) → [🏠 웹 게시 표시] → ✓, 다시 열면 게시됨, 또 눌러도 하나', async () => {
    await seed();
    const h3 = await page.evaluate(() => { state.tab = 'ads'; render(); document.querySelector('.adCaseRow[data-proj="가상아파트A"] [data-adcase="web"]').click(); return document.querySelector('#modalRoot h3').textContent; });
    const b0 = await btnTexts();
    assert(h3 === '📰 사례 내보내기 — 가상아파트A' && b0.includes('🏠 웹 게시 표시'), '창: ' + JSON.stringify({ h3, b0 }));
    await clickBtn('웹 게시 표시');
    const r = await page.evaluate(() => {
      const recs = state.adPosts.filter(x => x.ch === 'web' && x.project === '가상아파트A');
      return { n: recs.length, title: recs[0] && recs[0].title, memo: recs[0] && recs[0].memo, date: recs[0] && recs[0].date, posted: hjAdCaseStatus('가상아파트A').posted, h3: document.querySelector('#modalRoot h3').textContent };
    });
    const b1 = await btnTexts();
    await clickBtn('웹 게시됨');
    const n2 = await page.evaluate(() => { const n = state.adPosts.filter(x => x.ch === 'web').length; closeModal(true); state.tab = 'dashboard'; render(); return n; });
    assert(r.n === 1 && r.title === '사례: 가상아파트A' && r.memo === '사례 내보내기' && r.date === '2026-11-05' && JSON.stringify(r.posted) === JSON.stringify(['instagram', 'web']), '기록: ' + JSON.stringify(r));
    assert(r.h3 === '📰 사례 내보내기 — 가상아파트A' && b1.includes('🏠 웹 게시됨 ✓') && n2 === 1, '다시 열기·중복: ' + JSON.stringify({ b1, n2 }));
  });

  await test('② 현장 준공 관리 [🏠 만물 웹] 도 📰 사례 내보내기 · 다른 채널은 원고 창 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.tab = 'project'; state.activeProject = '가상아파트A'; render();
      document.querySelector('#view .adCaseLine [data-adcase="web"]').click();
      const a = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      document.querySelector('#view .adCaseLine [data-adcase="daangn"]').click();
      const b = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { a, b };
    });
    assert(r.a === '📰 사례 내보내기 — 가상아파트A' && r.b === '✍️ 홍보 원고 만들기', '창: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== caseweb-v385: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

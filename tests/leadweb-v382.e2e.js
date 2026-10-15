/* leadweb-v382.e2e.js — v382 홈페이지 상담 리드로 만든 현장은 문의 경로 = 만물 웹 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · hjLeadCreate(홈페이지 상담 리드 → 현장 등록)가 만든 현장에 leadSrc 'web' — 광고 탭 📞 문의 경로·현장 화면 [문의 경로]에 바로 '🏠 만물 웹'.
   · 리드 메모·고객 정보는 예전과 같다. */
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
    window.portalAutoSync = () => 0;
  });

  await test('① 홈페이지 상담 리드 → 현장 등록: 문의 경로 만물 웹, 리드 메모·고객 정보 그대로, 현장 화면·광고 탭에 반영', async () => {
    const r = await page.evaluate(() => {
      try { closeModal(true); } catch (e) {}
      state._demo = false; state.projects = []; state.notes = []; state.files = []; state.adPosts = [];
      hjLeadCreate({ name: '김가상', phone: '010-1111-2222', region: '대전 서구 둔산동', type: '아파트', scope: '부분', area: '24평', works: '욕실, 도배', budget: '', movein: '', estimate: '', memo: '', leadId: 'L-v382', design: '', live: '', source: 'site', submittedAt: '', consent: true });
      const p = state.projects[0];
      const note = (state.notes.find(n => n.project === p.name) || {}).text || '';
      state.tab = 'project'; state.activeProject = p.name; render();
      const sel = (document.querySelector('#view select[data-leadsrc]') || {}).value;
      state.tab = 'ads'; state.activeProject = null; render();
      const ads = [...document.querySelectorAll('.adLeadSrc .adLeadN')].map(x => x.textContent);
      state.tab = 'dashboard'; render();
      return { name: p.name, src: p.leadSrc, cu: p.customer, note, sel, ads };
    });
    assert(r.name === '대전 서구 둔산동 아파트' && r.src === 'web' && r.cu.name === '김가상' && r.cu.phone === '010-1111-2222', '현장: ' + JSON.stringify(r));
    assert(/^\[홈페이지 상담 리드\]/.test(r.note) && /희망공사: 욕실, 도배/.test(r.note) && /리드ID: L-v382/.test(r.note), '메모: ' + r.note);
    assert(r.sel === 'web' && JSON.stringify(r.ads) === JSON.stringify(['🏠 만물 웹 1']), '화면: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== leadweb-v382: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

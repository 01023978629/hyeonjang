/* donedate-v380.e2e.js — v380 💤 방치 현장 '✅ 완료로' → 준공일 고르기(기본 = 마지막 활동일) (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 예전에는 누른 날(오늘)이 준공일이 되어 한 달 전에 끝난 현장의 보증·AS 기간이 오늘부터 셌다.
   · '✅ 완료 처리' 창: 준공일 기본값 = 내렸던 준공일(doneAtPrev) → 마지막 활동일 → 오늘. 오늘 뒤 날짜는 막음. 저장하면 완료 단계·그 준공일, 방치 현장 창으로 돌아감.
   · [취소]는 아무것도 안 바꾸고 방치 현장 창으로. 오늘은 2026-11-05(목) 고정. */
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
    window.portalAutoSync = () => 0;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.adPosts = [];
    const P = (name, x) => Object.assign({ name, stage: 2, received: 0, phases: ['우수관 교체'], cost: {}, customer: {} }, x || {});
    state.projects = [P('가상현장S'), P('가상현장R', { doneAtPrev: '2026-07-10' })];
    state.files = [{ key: 's1', name: 's1.jpg', prefix: '현장사진/', kind: 'photo', project: '가상현장S', when: '2026-06-20T03:00:00.000Z' }];
    state.schedule = [{ id: 'r1', date: '2026-06-01', time: '09:00', title: '타일', project: '가상현장R', workers: '', memo: '', hours: 8, report: null }];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const openStaleDone = (name) => page.evaluate(async (n) => {
    await staleProjects();
    document.querySelector('#modalRoot .stpDone[data-n="' + n + '"]').click();
    return { h3: document.querySelector('#modalRoot h3').textContent, val: document.getElementById('ddDate').value, max: document.getElementById('ddDate').max,
      hint: document.getElementById('doneDate').textContent };
  }, name);

  await test('① 방치 현장 ✅ 완료로 → 준공일 창(기본 = 마지막 활동일) → 그 날짜로 완료, 방치 현장 창으로 돌아감', async () => {
    await seed();
    const o = await openStaleDone('가상현장S');
    assert(o.h3 === '✅ 완료 처리 — 가상현장S' && o.val === '2026-06-20' && o.max === '2026-11-05' && /마지막 활동\(사진·일정\): 6\/20\(토\)/.test(o.hint), '창: ' + JSON.stringify(o));
    const r = await page.evaluate(async () => {
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /이 날짜로 완료/.test(b.textContent)).click();
      await new Promise(res => setTimeout(res, 150));
      const p = state.projects.find(x => x.name === '가상현장S');
      return { stage: p.stage, doneAt: p.doneAt, prev: 'doneAtPrev' in p, h3: (document.querySelector('#modalRoot h3') || {}).textContent, listed: !!document.querySelector('#modalRoot .stpDone[data-n="가상현장S"]') };
    });
    assert(r.stage === 3 && r.doneAt === '2026-06-20' && !r.prev && r.h3 === '💤 방치 현장' && !r.listed, '완료: ' + JSON.stringify(r));
  });

  await test('② 내렸던 준공일이 있으면 그 날이 기본값 · 오늘 뒤 날짜는 막음 · [취소]는 아무것도 안 바꿈', async () => {
    await seed();
    const o = await openStaleDone('가상현장R');
    assert(o.val === '2026-07-10', '기본값: ' + JSON.stringify(o));
    const r = await page.evaluate(() => {
      document.getElementById('ddDate').value = '2026-11-20';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /이 날짜로 완료/.test(b.textContent)).click();
      const blocked = { h3: document.querySelector('#modalRoot h3').textContent, stage: state.projects.find(x => x.name === '가상현장R').stage };
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '취소').click();
      return { blocked, same: snap() === b0, h3: document.querySelector('#modalRoot h3').textContent };
    });
    assert(r.blocked.h3 === '✅ 완료 처리 — 가상현장R' && r.blocked.stage === 2 && r.same && r.h3 === '💤 방치 현장', '막음·취소: ' + JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== donedate-v380: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

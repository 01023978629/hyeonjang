/* donemany-v381.e2e.js — v381 💤 방치 현장 여러 곳 한꺼번에 완료(각 준공일) + '완료' 사진 표시 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 기록 있는 줄마다 [한꺼번에 완료] 체크, 빈 현장엔 없음. 사진 분류에 '완료·완성·준공'이 있으면 "📷 '완료' 사진 있음".
   · [✅ 고른 현장 완료 N곳] — 고른 수만큼 켜짐. 누르면 확인 → 안전판 → 각 현장 완료·준공일 = 내렸던 준공일 → 마지막 활동일 → 오늘. 방치 현장 창 다시 그림.
   · 오늘은 2026-11-05(목) 고정. */
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
  const dialogs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
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
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: {} }, x || {});
    state.projects = [P('가상현장S1'), P('가상현장S2', { doneAtPrev: '2026-07-10' }), P('가상현장S3')];
    state.files = [
      { key: 'f1', name: 'f1.jpg', prefix: '현장사진/', kind: 'photo', project: '가상현장S1', worklabel: '작업 완료', when: '2026-06-20T03:00:00.000Z' },
      { key: 'f2', name: 'f2.jpg', prefix: '현장사진/', kind: 'photo', project: '가상현장S1', worklabel: '철거', when: '2026-06-18T03:00:00.000Z' }
    ];
    state.schedule = [{ id: 'r1', date: '2026-06-01', time: '09:00', title: '타일', project: '가상현장S2', workers: '', memo: '', hours: 8, report: null }];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 줄 표시 — 기록 있는 현장에만 [한꺼번에 완료], \'완료\' 사진 표시, 버튼은 고른 수만큼', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      await staleProjects();
      const chk = [...document.querySelectorAll('#modalRoot .stpChk')].map(c => c.dataset.n);
      const hint = [...document.querySelectorAll('#modalRoot .stpHint')].map(h => h.closest('div').querySelector('.stpDone').dataset.n);
      const btn = document.getElementById('stpDoneMany');
      const b0 = { dis: btn.disabled, t: btn.textContent };
      document.querySelector('#modalRoot .stpChk[data-n="가상현장S1"]').click();
      const b1 = { dis: btn.disabled, t: btn.textContent };
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { chk: chk.sort(), hint, b0, b1, w };
    });
    assert(JSON.stringify(r.chk) === JSON.stringify(['가상현장S1', '가상현장S2']) && JSON.stringify(r.hint) === JSON.stringify(['가상현장S1']), '줄: ' + JSON.stringify(r));
    assert(r.b0.dis === true && r.b0.t === '✅ 고른 현장 완료 0곳' && r.b1.dis === false && r.b1.t === '✅ 고른 현장 완료 1곳' && r.w <= 0, '버튼: ' + JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
  });

  await test('② 고른 두 곳 완료 — 확인 창에 현장·날짜, 준공일 = 내렸던 준공일 → 마지막 활동일, 창 다시 그림', async () => {
    await seed();
    dialogs.length = 0;
    await page.evaluate(async () => {
      await staleProjects();
      document.querySelector('#modalRoot .stpChk[data-n="가상현장S1"]').click();
      document.querySelector('#modalRoot .stpChk[data-n="가상현장S2"]').click();
      document.getElementById('stpDoneMany').click();
    });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const P = n => state.projects.find(x => x.name === n);
      return { s1: [P('가상현장S1').stage, P('가상현장S1').doneAt], s2: [P('가상현장S2').stage, P('가상현장S2').doneAt, 'doneAtPrev' in P('가상현장S2')], s3: P('가상현장S3').stage,
        h3: (document.querySelector('#modalRoot h3') || {}).textContent, left: [...document.querySelectorAll('#modalRoot .stpDone')].map(b => b.dataset.n) };
    });
    assert(dialogs.length === 1 && /고른 2곳을 아래 준공일로 완료/.test(dialogs[0]) && /가상현장S1 — 2026-06-20 \(마지막 활동일\)/.test(dialogs[0]) && /가상현장S2 — 2026-07-10 \(이전 준공일\)/.test(dialogs[0]), '확인 창: ' + JSON.stringify(dialogs));
    assert(JSON.stringify(r.s1) === JSON.stringify([3, '2026-06-20']) && JSON.stringify(r.s2) === JSON.stringify([3, '2026-07-10', false]) && r.s3 === 0, '완료: ' + JSON.stringify(r));
    assert(r.h3 === '💤 방치 현장' && JSON.stringify(r.left) === JSON.stringify(['가상현장S3']), '다시 그림: ' + JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== donemany-v381: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

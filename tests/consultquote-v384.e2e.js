/* consultquote-v384.e2e.js — v384 상담·실측 끝 → 견적 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 상담·실측 일정을 '완료'로 보고(일정표 📋 작업 보고 · 📋 내 업무 ✅ 완료 보고)하면, 현장이 상담·실측 단계일 때 '📐 상담·실측 끝' 창.
   · [🧾 견적서 쓰기] = 상담이면 실측으로 올리고, 견적 작성 화면에 이 현장·주소를 채운 새 견적. [📐 실측 노트]. [나중에]는 아무것도 안 바꿈.
   · 완료가 아닌 보고·시공 단계 현장·공정 일정(→ v374 다음 공정 창)은 이 창을 띄우지 않는다. 오늘은 2026-11-05(목) 고정. */
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
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '대전 대덕구 법동 1' } }, x || {});
    state.projects = [P('가상현장A'), P('가상현장B', { stage: 2 })];
    const S = (id, title, project, x) => Object.assign({ id, date: '2026-11-05', time: '10:00', title, project, workers: '', memo: '', hours: 1, report: null }, x || {});
    state.schedule = [S('c1', '상담·실측: 가상현장A', '가상현장A'), S('c2', '실측', '가상현장B'), S('t1', '타일', '가상현장A', { hours: 8 })];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const report = (id, prog) => page.evaluate(({ id, prog }) => {
    openReportEdit(id); document.getElementById('rDone').value = '실측 완료, 욕실 2곳'; document.getElementById('rProgress').value = prog;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
    const m = document.querySelector('#modalRoot .modal');
    return { h3: m ? m.querySelector('h3').textContent : '', btns: m ? [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) : [], text: (document.getElementById('consultNext') || {}).textContent || '' };
  }, { id, prog });

  await test('① 일정표 상담·실측 보고 \'완료\' → 📐 창 → [🧾 견적서 쓰기]: 상담→실측, 견적 작성 화면에 현장·주소 채운 새 견적', async () => {
    await seed();
    const o = await report('c1', '완료');
    assert(o.h3 === '📐 상담·실측 끝 — 가상현장A' && JSON.stringify(o.btns) === JSON.stringify(['나중에', '📐 실측 노트', '🧾 견적서 쓰기']) && /단계가 '실측'으로 올라갑니다/.test(o.text), '창: ' + JSON.stringify(o));
    const r = await page.evaluate(() => {
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적서 쓰기/.test(b.textContent)).click();
      const q = state.editingQuote || {};
      const sel = (document.getElementById('qmProj') || {}).value;
      const res = { tab: state.tab, stage: state.projects[0].stage, q: { project: q.project, title: q.title, place: q.place }, sel, open: !!document.querySelector('#modalRoot .modal') };
      state.editingQuote = null; state.tab = 'dashboard'; render();
      return res;
    });
    assert(r.tab === 'quotemaker' && r.stage === 1 && r.q.project === '가상현장A' && r.q.title === '가상현장A 견적' && r.q.place === '대전 대덕구 법동 1' && r.sel === '가상현장A' && !r.open, '견적: ' + JSON.stringify(r));
  });

  await test('② 완료가 아닌 보고·시공 단계 현장은 묻지 않고, 공정 일정은 기존 다음 공정 창 · [나중에]는 아무것도 안 바꿈', async () => {
    await seed();
    const half = await report('c1', '50%');
    const b2 = await report('c2', '완료');
    await page.evaluate(() => { try { closeModal(true); } catch (e) {} });
    assert(half.h3 === '' && b2.h3 === '', '묻지 않음: ' + JSON.stringify([half, b2]));
    await seed();
    await report('c1', '완료');
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '나중에').click();
      return { same: snap() === b0, open: !!document.querySelector('#modalRoot .modal'), stage: state.projects[0].stage };
    });
    assert(r.same && !r.open && r.stage === 0, '나중에: ' + JSON.stringify(r));
  });

  await test('③ 📋 내 업무 ✅ 완료 보고(상담·실측) → 📐 창, [📐 실측 노트]는 이 현장 실측 노트', async () => {
    await seed();
    const r = await page.evaluate(() => {
      myWorkReport('c1'); document.getElementById('mwDoneText').value = '실측 끝';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /완료 보고 저장/.test(b.textContent)).click();
      const h3 = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /실측 노트/.test(b.textContent)).click();
      const h3b = (document.querySelector('#modalRoot h3') || {}).textContent || '';
      closeModal(true);
      return { h3, h3b };
    });
    assert(r.h3 === '📐 상담·실측 끝 — 가상현장A' && /실측/.test(r.h3b) && /가상현장A/.test(r.h3b), '내 업무: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== consultquote-v384: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

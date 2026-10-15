/* matplan-v373.e2e.js — v373 발주 점검 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 다음 7일(오늘~+7일) 안에 시작하는 자재 공정(타일·도배·마루·목공·조명·설비·욕실…) 중 이은 납품(o.schId)이 없는 일정.
     지난 일정·7일 밖·자재 없는 공정(철거)·완료 보고·💰·[자재 없음](matNone)은 뺀다.
   · 🚚 납품 확인 창 '📋 발주 점검' 칩·칸 — [🚚 납품 예정](그 공정에 이어 추가, 예정일 = 공정 전 작업일) · [자재 없음].
   · 🌙 오늘 마감 '📋 발주 점검 … N개'. 그리는 것만으로는 저장본이 바뀌지 않는다. 오늘은 2026-11-05(목) 고정. */
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
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = []; state.asLog = [];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {}, matOrders: [
        { id: 'm2', sup: '가상도배', items: [{ name: '실크 벽지', spec: '', qty: 8, unit: '롤' }], due: '2026-11-09', at: '2026-11-01', recvAt: '', memo: '', schId: 't2' }] },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('t1', '2026-11-06', '타일', { crew: '김타일' }),
      S('t2', '2026-11-10', '도배'),
      S('t3', '2026-11-07', '철거'),
      S('t4', '2026-11-20', '마루'),
      S('t5', '2026-11-08', '조명', { matNone: true }),
      S('t6', '2026-11-04', '설비'),
      S('t7', '2026-11-09', '욕실 방수', { report: { done: '끝', progress: '완료' } }),
      S('pay', '2026-11-06', '💰 잔금 (타일 후)', { hours: 0, time: '' }),
      S('b1', '2026-11-12', '목공', { project: '가상현장B' })
    ];
    __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 발주 점검 대상 — 7일 안 자재 공정·이은 납품 없음만(지난·7일 밖·철거·완료·💰·자재 없음 제외), 현장으로 좁히기', async () => {
    await seed();
    const r = await page.evaluate(() => ({ all: hjMatPlanRows('', 7).map(x => x.id), a: hjMatPlanRows('가상현장A', 7).map(x => x.id) }));
    assert(JSON.stringify(r.all) === JSON.stringify(['t1', 'b1']) && JSON.stringify(r.a) === JSON.stringify(['t1']), '대상: ' + JSON.stringify(r));
  });

  await test('② 🚚 납품 확인 창 \'📋 발주 점검\' — [🚚 납품 예정]으로 이어 추가하면 빠지고, [자재 없음]이면 빠진다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjMatView();
      const chips = document.querySelector('#matView > div').textContent;
      const rows = [...document.querySelectorAll('#matView .mpRow')].map(x => x.dataset.sid);
      const text = (document.querySelector('#matView .mpRow[data-sid="t1"]') || {}).textContent || '';
      document.querySelector('#matView .mpAdd[data-sid="t1"]').click();
      const form = { h3: document.querySelector('#modalRoot h3').textContent, sch: document.getElementById('meSch').value, due: document.getElementById('meDue').value };
      document.getElementById('meSup').value = '가상타일상사'; document.getElementById('meItems').value = '타일 600각 × 42장';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const back = { h3: document.querySelector('#modalRoot h3').textContent, rows: [...document.querySelectorAll('#matView .mpRow')].map(x => x.dataset.sid) };
      document.querySelector('#matView .mpNone[data-sid="b1"]').click();
      const after = { rows: document.querySelectorAll('#matView .mpRow').length, chips: document.querySelector('#matView > div').textContent, none: state.schedule.find(x => x.id === 'b1').matNone };
      closeModal(true);
      return { chips, rows, text, form, back, after, order: state.projects[0].matOrders.find(o => o.sup === '가상타일상사') };
    });
    assert(/📋 발주 점검 2/.test(r.chips) && JSON.stringify(r.rows) === JSON.stringify(['t1', 'b1']) && /11\/6\(금\) 09:00 타일 · 가상현장A · 👤 김타일/.test(r.text), '칸: ' + JSON.stringify(r).slice(0, 300));
    assert(r.form.h3 === '🚚 납품 예정 추가' && r.form.sch === 't1' && r.form.due === '2026-11-05', '추가 창: ' + JSON.stringify(r.form));
    assert(r.order && r.order.schId === 't1' && r.back.h3 === '🚚 자재 납품 확인' && JSON.stringify(r.back.rows) === JSON.stringify(['b1']), '이어 추가: ' + JSON.stringify(r.back));
    assert(r.after.rows === 0 && !/발주 점검/.test(r.after.chips) && r.after.none === true, '자재 없음: ' + JSON.stringify(r.after));
  });

  await test('③ 🌙 오늘 마감 \'📋 발주 점검 … 2개\' + [🚚 납품 확인], 그리는 것만으로는 저장본 불변 · 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const n = hjDayCloseData().matPlan;
      hjDayCloseView(); const line = (document.querySelector('#dayClose [data-dc-matplan]') || {}).textContent; const btn = !!document.querySelector('#dayClose [data-dc-mat]'); closeModal(true);
      hjMatView(); const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; closeModal(true);
      return { n, line, btn, w, same: snap() === b0 };
    });
    assert(r.n === 2 && r.line === '📋 발주 점검: 다음 7일 공정 중 납품 기록 없는 것 2개' && r.btn, '오늘 마감: ' + JSON.stringify(r));
    assert(r.same && r.w <= 0, '저장본·넘침: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== matplan-v373: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

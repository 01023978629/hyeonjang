/* matsched-v369.e2e.js — v369 공정 일정 ↔ 자재 납품 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 일정의 자재 = 같은 현장 미입고 중 (이 일정에 이은 것) 또는 (안 이었거나 이은 일정이 지워졌고 납품일 ≤ 보는 날). 다른 일정에 이은 것·날짜 미정 제외.
     💰 수금·AS 방문 일정은 보지 않는다.
   · '🚚 미입고 N' — 📋 내 업무 카드·대시보드 오늘/다가오는 일정·🌙 오늘 마감 내일 일정·현장 '🗓 이 현장 일정' 줄.
   · 일정 ⋯ [🚚 이 공정 자재 납품 예정] → 그 공정에 이은 새 납품(예정일 = 공정 전 작업일). 납품 기록 창 '어느 공정용' 고르기·풀기.
   · 그리는 것만으로는 저장본이 바뀌지 않는다. 오늘은 2026-11-05(목) 고정. */
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
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    state.asLog = [{ id: 'as1', project: '가상현장A', date: '2026-11-01', text: '가상 하자', status: 'open', visitSchedId: 'asv' }];
    const I = (name, qty, unit) => ({ name, spec: '', qty, unit });
    const O = (id, sup, items, due, x) => Object.assign({ id, sup, items, due, at: '2026-11-01', recvAt: '', memo: '' }, x || {});
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {}, matOrders: [
        O('m1', '가상타일상사', [I('타일 600각', 42, '장')], '2026-11-04'),
        O('m2', '가상도배', [I('실크 벽지', 8, '롤')], '2026-11-09', { schId: 't2' }),
        O('m3', '가상본드', [I('타일 본드', 3, '통')], '2026-11-06', { schId: 't1' }),
        O('m4', '가상설비', [I('변기', 1, '대')], '2026-11-05', { recvAt: '2026-11-05' }),
        O('m5', '가상목재', [I('합판', 5, '장')], '2026-11-05', { schId: 'gone' }),
        O('m6', '가상조명', [I('다운라이트', 6, '개')], '')] },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('t0', '2026-11-05', '철거', { crew: '김타일' }),
      S('t1', '2026-11-06', '타일', { crew: '김타일', time: '08:00' }),
      S('t2', '2026-11-10', '도배'),
      S('pay', '2026-11-06', '💰 잔금', { hours: 0, time: '' }),
      S('asv', '2026-11-06', '🔧 AS 방문: 가상 하자', { asId: 'as1', time: '13:00', hours: 2 }),
      S('b1', '2026-11-05', '조명', { project: '가상현장B', time: '10:00' })
    ];
    __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const ids = (sid, ymd) => page.evaluate(({ sid, ymd }) => hjMatForSched(state.schedule.find(x => x.id === sid), ymd).map(o => o.id), { sid, ymd });

  await test('① 일정의 미입고 자재 — 이은 것·안 이은 것(납품일 ≤ 날)·지워진 일정에 이은 것, 다른 일정에 이은 것·날짜 미정·입고·💰·AS 제외', async () => {
    await seed();
    const r = {};
    for (const id of ['t0', 't1', 't2', 'pay', 'asv', 'b1']) r[id] = await ids(id);
    assert(JSON.stringify(r) === JSON.stringify({ t0: ['m1', 'm5'], t1: ['m1', 'm3', 'm5'], t2: ['m1', 'm2', 'm5'], pay: [], asv: [], b1: [] }), '자재: ' + JSON.stringify(r));
    await page.evaluate(() => { hjMatReceive('m1', true); hjMatReceive('m5', true); });
    const after = { t0: await ids('t0'), t1: await ids('t1'), t2: await ids('t2') };
    assert(JSON.stringify(after) === JSON.stringify({ t0: [], t1: ['m3'], t2: ['m2'] }), '입고 뒤: ' + JSON.stringify(after));
  });

  await test('② \'🚚 미입고 N\' — 내 업무 카드·대시보드 오늘/다가오는 일정·오늘 마감 내일 일정·현장 일정 줄, 💰·AS·없는 현장은 표시 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const warn = el => { const w = el && el.querySelector('[data-matwarn]'); return w ? w.textContent : ''; };
      myWorkView(); const mw = { t0: warn(document.querySelector('#modalRoot [data-mw-sch="t0"]')), b1: warn(document.querySelector('#modalRoot [data-mw-sch="b1"]')) }; closeModal(true);
      state.tab = 'dashboard'; render();
      const dash = { t0: warn(document.querySelector('#view [data-gosch="t0"]')), t1: warn(document.querySelector('#view [data-gosch="t1"]')), pay: warn(document.querySelector('#view [data-gosch="pay"]')), asv: warn(document.querySelector('#view [data-gosch="asv"]')) };
      hjDayCloseView(); const dcRows = [...document.querySelectorAll('#dayClose [data-matwarn]')].map(x => x.textContent); const dcT1 = /타일[\s\S]*🚚 미입고 3/.test(document.getElementById('dayClose').textContent); closeModal(true);
      state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const pj = Object.fromEntries([...document.querySelectorAll('#view [data-pjschrow]')].map(x => [x.dataset.pjschrow, warn(x)]));
      const tip = (document.querySelector('#view [data-pjschrow="t1"] [data-matwarn]') || {}).title;
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { mw, dash, dcRows, dcT1, pj, tip };
    });
    assert(r.mw.t0 === '🚚 미입고 2' && r.mw.b1 === '', '내 업무: ' + JSON.stringify(r.mw));
    assert(r.dash.t0 === '🚚 미입고 2' && r.dash.t1 === '🚚 미입고 3' && r.dash.pay === '' && r.dash.asv === '', '대시보드: ' + JSON.stringify(r.dash));
    assert(JSON.stringify(r.dcRows) === JSON.stringify(['🚚 미입고 3']) && r.dcT1, '오늘 마감: ' + JSON.stringify(r));
    assert(r.pj.t0 === '🚚 미입고 2' && r.pj.t1 === '🚚 미입고 3' && r.pj.t2 === '🚚 미입고 3' && r.pj.pay === '' && r.pj.asv === '', '현장 일정: ' + JSON.stringify(r.pj));
    assert(/가상본드 · 타일 본드 × 3통/.test(r.tip || ''), '줄 위 설명: ' + r.tip);
  });

  await test('③ 일정 ⋯ [🚚 이 공정 자재 납품 예정] → 그 공정에 이은 새 납품(예정일 = 공정 전 작업일), 💰 일정에는 버튼 없음', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      schMoreView('t1');
      const btn = document.querySelector('#modalRoot .smBtn[data-act="mat"]'); const desc = btn && btn.textContent;
      btn.click(); await new Promise(r => setTimeout(r, 150));
      const form = { h3: document.querySelector('#modalRoot h3').textContent, sch: document.getElementById('meSch').value, due: document.getElementById('meDue').value,
        opts: [...document.getElementById('meSch').options].map(o => o.value) };
      document.getElementById('meSup').value = '가상줄눈'; document.getElementById('meItems').value = '줄눈 × 4포';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const o = state.projects[0].matOrders.find(x => x.sup === '가상줄눈');
      const t1 = hjMatForSched(state.schedule.find(x => x.id === 't1')).map(x => x.id).length;
      schMoreView('pay'); const payBtn = !!document.querySelector('#modalRoot .smBtn[data-act="mat"]'); closeModal(true);
      return { desc, form, o, t1, payBtn };
    });
    assert(/이은 납품 1건 · 미입고 3건/.test(r.desc), '버튼 설명: ' + r.desc);
    assert(r.form.h3 === '🚚 납품 예정 추가' && r.form.sch === 't1' && r.form.due === '2026-11-05' && JSON.stringify(r.form.opts) === JSON.stringify(['', 't0', 't1', 't2']), '창: ' + JSON.stringify(r.form));
    assert(r.o && r.o.schId === 't1' && r.o.due === '2026-11-05' && r.t1 === 4, '저장: ' + JSON.stringify(r));
    assert(!r.payBtn, '💰 일정에 버튼이 있다');
  });

  await test('④ 납품 기록 창 \'어느 공정용\' — 고르면 손대지 않은 예정일만 공정 전 작업일로, 기존 기록 풀기, 납품 확인 창에 \'🔨 … 용\'', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const pick = v => { const s = document.getElementById('meSch'); s.value = v; s.dispatchEvent(new Event('change')); };
      hjMatEdit(null, { project: '가상현장A' });
      const d0 = document.getElementById('meDue').value; pick('t2'); const d1 = document.getElementById('meDue').value;
      document.getElementById('meDue').value = '2026-11-07'; pick('t1'); const d2 = document.getElementById('meDue').value; closeModal(true);
      hjMatView('가상현장A'); const label = (document.querySelector('#matView .mdRow[data-id="m2"] .mdSch') || {}).textContent;
      document.querySelector('#matView .mdEdit[data-id="m2"]').click();
      const sel = document.getElementById('meSch').value; pick('');
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const m2 = state.projects[0].matOrders.find(x => x.id === 'm2');
      const t2 = hjMatForSched(state.schedule.find(x => x.id === 't2')).map(x => x.id);
      closeModal(true);
      return { d0, d1, d2, label, sel, has: 'schId' in m2, t2 };
    });
    assert(r.d0 === '2026-11-06' && r.d1 === '2026-11-09' && r.d2 === '2026-11-07', '예정일 자동: ' + JSON.stringify(r));
    assert(r.label === '🔨 도배 11/10(화)용' && r.sel === 't2', '공정 표시: ' + JSON.stringify(r));
    assert(!r.has && JSON.stringify(r.t2) === JSON.stringify(['m1', 'm2', 'm5']), '풀기(납품일 11/9 ≤ 11/10 이라 여전히 도배에 보임): ' + JSON.stringify(r));
  });

  await test('⑤ 그리는 것만으로는 저장본이 바뀌지 않는다 · 390px 가로 넘침 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      myWorkView(); closeModal(true); state.tab = 'dashboard'; render(); hjDayCloseView(); closeModal(true);
      schMoreView('t1'); closeModal(true); state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      hjMatView('가상현장A'); const w2 = document.documentElement.scrollWidth - document.documentElement.clientWidth; closeModal(true);
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { same: snap() === b0, w, w2 };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.w <= 0 && r.w2 <= 0, '가로 넘침: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== matsched-v369: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

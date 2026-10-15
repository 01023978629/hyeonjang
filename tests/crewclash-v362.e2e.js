/* crewclash-v362.e2e.js — v362 👷 담당 겹침: 같은 팀원이 같은 날 시간 겹치게 두 곳에 잡히면 알린다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · hjCrewClash: 두 일정 담당에 같은 사람이 있고, 시간이 겹치거나 어느 한쪽에 시간이 없으면(하루짜리) 겹친 이름.
   · 🔍 일정 점검(scheduleConflicts): 두 일정 모두 담당이 있으면 사람 기준 — 같은 사람이면 '담당 겹침', 다른 사람이면 시간이 겹쳐도 충돌 아님.
     담당이 없는 쪽이 있으면 예전처럼 '시간 겹침'.
   · 일정 창 '그날 다른 일정'(v355): 지금 적은 담당·시간 기준으로 겹치는 일정에 '⚠ 이름 겹침', 담당·시간을 바꾸면 바로 다시 본다.
   · 🌙 오늘 마감(v359): 내일 담당 겹침 수와 [🔍 일정 점검]. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }, { id: 'k2', name: '박도배', phone: '010-3333-4444', team: true }];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {} }, { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }];
    const S = (id, date, time, title, hours, x) => Object.assign({ id, date, time, title, project: '가상현장A', workers: '', memo: '', hours, report: null }, x || {});
    state.schedule = [
      S('a', '2026-11-05', '09:00', '타일', 8, { crew: '김타일' }),
      S('b', '2026-11-05', '13:00', '조명', 2, { crew: '김타일', project: '가상현장B' }),
      S('c', '2026-11-05', '10:00', '도배', 2, { crew: '박도배' }),
      S('d', '2026-11-05', '11:00', '실측', 1),
      S('e', '2026-11-06', '', '마감', 8, { crew: '박도배' }),
      S('f', '2026-11-06', '14:00', '청소', 2, { crew: '박도배', project: '가상현장B' })
    ];
  });

  await test('① 일정 점검 — 같은 사람은 담당 겹침, 다른 사람은 충돌 아님, 담당 없는 쪽은 예전 시간 겹침', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const d = scheduleConflicts();
      const res = { clashes: d.crewClashes.map(c => c.date + ':' + c.a.id + '+' + c.b.id + ':' + c.names.join(',')), conflicts: d.conflicts.map(c => c.date + ':' + [c.a.id, c.b.id].sort().join('+')), unit: [hjCrewClash(state.schedule[0], state.schedule[1]), hjCrewClash(state.schedule[0], state.schedule[2]), hjCrewClash(state.schedule[0], state.schedule[3])] };
      const ret = scheduleCheck(); res.ret = ret; res.txt = document.querySelector('#modalRoot .mbody').textContent; closeModal(true);
      return res;
    });
    assert(JSON.stringify(r.clashes) === JSON.stringify(['2026-11-05:a+b:김타일', '2026-11-06:e+f:박도배']), '담당 겹침: ' + JSON.stringify(r.clashes));
    assert(JSON.stringify(r.conflicts) === JSON.stringify(['2026-11-05:a+d', '2026-11-05:c+d']), '시간 겹침: ' + JSON.stringify(r.conflicts));
    assert(JSON.stringify(r.unit) === JSON.stringify([['김타일'], [], []]), '단위: ' + JSON.stringify(r.unit));
    assert(r.ret.담당겹침 === 2 && /👷 담당 겹침 2건/.test(r.txt) && /시간 겹침 2건/.test(r.txt) && /종일 마감/.test(r.txt), '점검 창: ' + r.txt.slice(0, 300));
  });

  await test('② 일정 창 — 지금 적은 담당·시간 기준 ⚠ 겹침, 담당·시간을 바꾸면 바로 다시 본다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      openScheduleEdit('b');
      const info = () => document.getElementById('schDayInfo'), txt = () => info().textContent.replace(/\s+/g, ' ').trim();
      const clashLi = () => [...info().querySelectorAll('[data-crewclash]')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
      const first = { txt: txt(), li: clashLi() };
      const crew = document.getElementById('schCrew'); crew.value = '박도배'; crew.dispatchEvent(new Event('input'));
      const swapped = { txt: txt(), li: clashLi() };
      const t = document.getElementById('schTime'); t.value = '10:30'; t.dispatchEvent(new Event('change'));
      const moved = { li: clashLi() };
      document.querySelector('#modalRoot .schCrewChip[data-n="박도배"]').click();   // 박도배 빼기
      const none = { li: clashLi(), txt: txt() };
      closeModal(true);
      return { first, swapped, moved, none };
    });
    assert(/👷 담당 겹침 1/.test(r.first.txt) && r.first.li.length === 1 && /09:00 타일 .*👤 김타일 ⚠ 김타일 겹침/.test(r.first.li[0]), '처음: ' + JSON.stringify(r.first));
    assert(!/담당 겹침/.test(r.swapped.txt) && r.swapped.li.length === 0, '박도배로 바꿈(13시는 도배와 안 겹침): ' + JSON.stringify(r.swapped));
    assert(r.moved.li.length === 1 && /10:00 도배.*⚠ 박도배 겹침/.test(r.moved.li[0]), '10:30 으로 옮김: ' + JSON.stringify(r.moved));
    assert(r.none.li.length === 0 && !/담당 겹침/.test(r.none.txt), '칩으로 뺌: ' + JSON.stringify(r.none));
  });

  await test('③ 🌙 오늘 마감 — 내일 담당 겹침 수와 [🔍 일정 점검]', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjDayCloseView();
      const m = document.getElementById('dayClose');
      const out = { sum: m.querySelector('#dcSummary').textContent, line: (m.querySelector('[data-dc-clash]') || {}).textContent || '' };
      m.querySelector('[data-dc-check]').click(); out.check = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      return out;
    });
    assert(/담당 겹침 1/.test(r.sum) && /박도배 — 마감 ↔ 청소/.test(r.line) && /일정 점검/.test(r.check), '오늘 마감: ' + JSON.stringify(r));
  });

  await test('④ 담당이 없으면 일정 점검은 예전 그대로, 읽기 경로는 저장본을 바꾸지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); scheduleConflicts(); hjDayCloseData(); openScheduleEdit('a'); closeModal(true); const same = snap() === b0;
      state.schedule.forEach(s => { delete s.crew; });
      const d = scheduleConflicts();
      return { same, clashes: d.crewClashes.length, conflicts: d.conflicts.map(c => c.date + ':' + [c.a.id, c.b.id].sort().join('+')) };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.clashes === 0 && JSON.stringify(r.conflicts) === JSON.stringify(['2026-11-05:a+c', '2026-11-05:a+d', '2026-11-05:a+b', '2026-11-05:c+d']), '담당 없음 = 예전: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== crewclash-v362: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

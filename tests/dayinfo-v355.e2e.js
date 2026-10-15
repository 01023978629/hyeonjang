/* dayinfo-v355.e2e.js — v355 일정 창에서 날짜를 고르면 그날 다른 일정이 보이고, 🔍 일정 점검은 여러 날 공정의 이어지는 날도 센다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · 그날 다른 일정 = 그 날짜의 일정(자기 자신·💰·세금 자동 제외) + 여러 날 공정이 이어지는 날(v354 규칙). 날짜를 바꾸면 바로 바뀐다. 막지 않는다.
   · 일요일이면 '일요일' 이라고 알린다(공정표는 일요일을 건너뛴다).
   · scheduleConflicts: 이어지는 날의 공정도 그날 시간 겹침·과부하에 들어간다. 완료 보고된 공정·하루짜리는 예전 그대로.
   · 읽기 전용 — 창을 열고 날짜를 바꿔도 저장본은 그대로(저장 버튼 전까지). */
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
  const seed = () => page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {} }, { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('ml', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)' }),          // 수·목·금
      S('as', '2026-11-05', '🔧 AS 방문: 가상 누수', { time: '10:00', hours: 2, project: '가상현장B' }),
      S('pay', '2026-11-05', '💰 중도금', { hours: 0 }),
      S('rp', '2026-11-09', '목공 (2일차 시작)', { memo: '2026-11-09~2026-11-10 (2일)', report: { done: '끝', progress: '완료' } }),
      S('x', '2026-11-12', '조명')
    ];
  });

  await test('① 날짜를 고르면 그날 다른 일정(이어지는 공정 포함)이 보이고, 바꾸면 바로 바뀐다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      openScheduleEdit('x');
      const info = () => document.getElementById('schDayInfo').textContent.replace(/\s+/g, ' ').trim();
      const set = v => { const i = document.getElementById('schDate'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); return info(); };
      const first = info();
      const d5 = set('2026-11-05'), d6 = set('2026-11-06'), d8 = set('2026-11-08'), d10 = set('2026-11-10');
      const aria = document.getElementById('schDayInfo').getAttribute('aria-live');
      closeModal(true);
      openScheduleEdit('ml');
      const self = info();
      closeModal(true);
      openScheduleEdit();   // 새 일정
      const fresh = set('2026-11-05');
      closeModal(true);
      return { first, d5, d6, d8, d10, aria, self, fresh };
    });
    assert(/11\/12\(목\) 다른 일정 없음/.test(r.first), '처음: ' + r.first);
    assert(/다른 일정 2건/.test(r.d5) && /09:00 타일 \(2\/3일째\) · 가상현장A/.test(r.d5) && /10:00 🔧 AS 방문/.test(r.d5) && !/중도금/.test(r.d5), '11/5: ' + r.d5);
    assert(/다른 일정 1건/.test(r.d6) && /타일 \(3\/3일째\)/.test(r.d6), '11/6: ' + r.d6);
    assert(/일요일/.test(r.d8) && /다른 일정 없음/.test(r.d8), '일요일: ' + r.d8);
    assert(/다른 일정 없음/.test(r.d10), '완료 보고된 목공은 없다: ' + r.d10);
    assert(r.aria === 'polite', '읽기 알림: ' + r.aria);
    assert(/11\/4\(수\) 다른 일정 없음/.test(r.self), '자기 자신을 셌다: ' + r.self);
    assert(/다른 일정 2건/.test(r.fresh), '새 일정 창: ' + r.fresh);
  });

  await test('② 🔍 일정 점검: 이어지는 날의 공정도 시간 겹침·과부하에 들어간다(완료·하루짜리는 예전 그대로)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const d = scheduleConflicts();
      const c = d.conflicts.map(x => x.date + ':' + [x.a.id, x.b.id].sort().join('+'));
      state.schedule.push(Object.assign(newSchedule(), { id: 'y1', date: '2026-11-06', time: '17:00', title: '가상 실측', hours: 1 }), Object.assign(newSchedule(), { id: 'y2', date: '2026-11-06', time: '18:00', title: '가상 상담', hours: 1 }));
      const o = scheduleConflicts().overloads.map(x => x.date + ':' + x.count);
      scheduleCheck(); const txt = document.querySelector('#modalRoot .mbody').textContent; closeModal(true);
      return { c, o, txt };
    });
    assert(JSON.stringify(r.c) === JSON.stringify(['2026-11-05:as+ml']), '시간 겹침: ' + JSON.stringify(r.c));
    assert(r.o.includes('2026-11-06:3') && !r.o.some(x => /^2026-11-10/.test(x)), '과부하: ' + JSON.stringify(r.o));
    assert(/시간 겹침 1건/.test(r.txt) && /과부하 일정 1일/.test(r.txt), '점검 창: ' + r.txt.slice(0, 200));
  });

  await test('③ 창을 열고 날짜만 바꿔 보는 것은 저장본을 바꾸지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      openScheduleEdit('x'); const i = document.getElementById('schDate'); ['2026-11-05', '2026-11-06'].forEach(v => { i.value = v; i.dispatchEvent(new Event('change')); });
      closeModal(true); scheduleConflicts();
      return { same: snap() === b0, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== dayinfo-v355: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

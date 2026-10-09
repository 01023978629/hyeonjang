/* asview-v367.e2e.js — v367 AS 방문 일정 한눈에 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 이어진 방문 일정이 있으면 '📅 11/6(금) 10:00 · 👤 김타일'(담당 없으면 '· 담당 미정', 보고 있으면 '· 📋 보고됨').
   · 없으면 완료 전 AS 만 '📅 방문 일정 미정'(방문일만 적혔으면 '11/12(목) — 시간·담당 미정'), 완료 AS 는 줄 없음. 지워진 일정을 가리키면 미정.
   · 🔧 AS 관리: 줄마다 방문 줄 + '방문 미정 N건' 칸. 현장 화면 AS 카드: 방문 줄 + 완료 전 AS 에 [📅](AS 방문 일정 창).
   · 대시보드 '미처리 AS N건 · 방문 미정 M건'. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
    state.projects = [
      { name: '가상현장A', stage: STAGES.length - 1, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '' } },
      { name: '가상현장B', stage: STAGES.length - 1, received: 0, phases: [], cost: {}, customer: {} }
    ];
    state.asLog = [
      { id: 'as1', project: '가상현장A', date: '2026-11-03', text: '욕실 실리콘 들뜸', status: 'open', visitAt: '2026-11-06', visitSchedId: 'v1' },
      { id: 'as2', project: '가상현장A', date: '2026-11-02', text: '현관 문틀 벌어짐', status: 'open', visitAt: '2026-11-12' },
      { id: 'as3', project: '가상현장A', date: '2026-11-01', text: '주방 상부장 처짐', status: 'doing', visitSchedId: 'gone' },
      { id: 'as4', project: '가상현장A', date: '2026-10-20', text: '베란다 실리콘', status: 'done' },
      { id: 'as5', project: '가상현장B', date: '2026-10-30', text: '도어락 오류', status: 'open', visitAt: '2026-11-04', visitSchedId: 'v5' }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '10:00', title, project: '가상현장A', workers: '', memo: '', hours: 2, report: null }, x || {});
    state.schedule = [
      S('v1', '2026-11-06', '🔧 AS 방문: 욕실 실리콘 들뜸', { asId: 'as1', crew: '김타일' }),
      S('v5', '2026-11-04', '🔧 AS 방문: 도어락 오류', { asId: 'as5', project: '가상현장B', time: '09:00', report: { done: '배터리 교체', progress: '' } })
    ];
    __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const WANT = {
    as1: '📅 11/6(금) 10:00 · 👤 김타일',
    as2: '📅 11/12(목) — 시간·담당 미정',
    as3: '📅 방문 일정 미정',
    as5: '📅 11/4(수) 09:00 · 담당 미정 · 📋 보고됨'
  };

  await test('① 🔧 AS 관리 — 줄마다 방문 줄(시간·담당·보고됨 / 미정), 완료 AS 는 줄 없음, \'방문 미정 2건\' 칸', async () => {
    await seed();
    const r = await page.evaluate(() => {
      asManage();
      const lines = Object.fromEntries([...document.querySelectorAll('#modalRoot .asmVisitLine')].map(x => [x.dataset.id, x.textContent]));
      return { lines, body: document.querySelector('#modalRoot .modal').textContent.replace(/\s+/g, '') };
    });
    assert(JSON.stringify(r.lines) === JSON.stringify(WANT), '줄: ' + JSON.stringify(r.lines));
    assert(/방문미정2건/.test(r.body) && /미처리AS4건/.test(r.body), '칸: ' + r.body.slice(0, 160));
    const sums = await page.evaluate(() => ['as1', 'as2', 'as4'].map(id => hjAsSummary(state.asLog.find(x => x.id === id))));
    assert(!/방문 2026/.test(sums[0]) && !/방문 2026/.test(sums[1]), '방문 줄이 있으면 요약에 날짜를 또 쓰지 않는다: ' + JSON.stringify(sums));
    const doneSum = await page.evaluate(() => hjAsSummary({ id: 'x', project: '가상현장A', date: '2026-10-01', text: 't', status: 'done', visitAt: '2026-10-05' }));
    assert(doneSum === '방문 2026-10-05', '방문 줄이 없는 완료 AS 는 요약에 방문일: ' + doneSum);
  });

  await test('② 현장 화면 AS 카드 — 방문 줄 + 완료 전 AS 에만 [📅], 누르면 AS 방문 일정 창(미정이면 새로·있으면 그 일정)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const lines = [...document.querySelectorAll('#view .asCardVisit')].map(x => x.textContent);
      const btns = [...document.querySelectorAll('#view [data-asvisit]')].map(b => b.dataset.asvisit);
      const label = (document.querySelector('#view [data-asvisit="as1"]') || {}).getAttribute && document.querySelector('#view [data-asvisit="as1"]').getAttribute('aria-label');
      document.querySelector('#view [data-asvisit="as2"]').click();
      const a2 = { h3: document.querySelector('#modalRoot h3').textContent, date: document.getElementById('schDate').value, title: document.getElementById('schTitle').value };
      closeModal(true);
      document.querySelector('#view [data-asvisit="as1"]').click();
      const a1 = { h3: document.querySelector('#modalRoot h3').textContent, date: document.getElementById('schDate').value, crew: document.getElementById('schCrew').value };
      closeModal(true);
      return { lines, btns, label, a2, a1, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(JSON.stringify(r.lines) === JSON.stringify([WANT.as1, WANT.as2, WANT.as3]), '카드 줄: ' + JSON.stringify(r.lines));
    assert(JSON.stringify(r.btns) === JSON.stringify(['as1', 'as2', 'as3']) && /고치기/.test(r.label), '[📅]: ' + JSON.stringify(r));
    assert(r.a2.h3 === '🔧 AS 방문 일정' && r.a2.date === '2026-11-12' && r.a2.title === '🔧 AS 방문: 현관 문틀 벌어짐', '미정 → 새 창: ' + JSON.stringify(r.a2));
    assert(r.a1.h3 === '🔧 AS 방문 일정' && r.a1.date === '2026-11-06' && r.a1.crew === '김타일', '있으면 그 일정: ' + JSON.stringify(r.a1));
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('③ 대시보드 알림 \'미처리 AS 4건 · 방문 미정 2건\', 다 잡히면 \'방문 미정\' 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const t1 = briefExtraItems().filter(x => x.action === 'as').map(x => x.t);
      state.asLog.find(x => x.id === 'as2').status = 'done'; state.asLog.find(x => x.id === 'as3').status = 'done';
      const t2 = briefExtraItems().filter(x => x.action === 'as').map(x => x.t);
      return { t1, t2 };
    });
    assert(JSON.stringify(r.t1) === JSON.stringify(['미처리 AS 4건 · 방문 미정 2건']) && JSON.stringify(r.t2) === JSON.stringify(['미처리 AS 2건']), '알림: ' + JSON.stringify(r));
  });

  await test('④ 그리는 것만으로는 저장본이 바뀌지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      asManage(); closeModal(true); state.tab = 'project'; state.activeProject = '가상현장A'; render(); briefExtraItems(); state.tab = 'dashboard'; state.activeProject = null; render();
      return snap() === b0;
    });
    assert(r, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== asview-v367: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

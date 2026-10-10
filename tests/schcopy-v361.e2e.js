/* schcopy-v361.e2e.js — v361 📄 일정 복사 (일정 ⋯ 메뉴) (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 같은 현장·시간·작업 시간·인원·담당·메모로 '새 일정' 창을 채워 연다. 날짜는 다음 작업일(일요일 건너뜀). 저장 전엔 아무것도 생기지 않는다.
   · 옮겨 오지 않는 것: 작업 보고·시작 기록·준비물·캘린더 식별자·공정표 기간 메모와 '(N일차 시작)' 꼬리표.
   · '+ 일정 추가'(빈 새 일정)의 날짜·현장 미리 채움은 예전 그대로. */
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
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {} }, { name: '가상현장B', stage: 1, received: 0, phases: [], cost: {}, customer: {} }];
    state.schedule = [{ id: 'c', date: '2026-11-07', time: '08:30', title: '타일 (3일차 시작)', project: '가상현장A', workers: '2', hours: 6, crew: '김타일',
      memo: '2026-11-07~2026-11-10 (3일) 줄눈 회색', report: { done: '1일차 끝', progress: '진행' }, startedAt: '2026-11-07 08:31', prep: { done: ['x'] }, icsUid: 'u-1' }];
    __calSelDate = null; state.activeProject = null;
  });
  const save = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click());

  await test('① ⋯ [📄 일정 복사] → 다음 작업일·같은 현장/시간/인원/담당/메모로 채운 새 일정 창, 저장하면 새 일정 하나', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      schMoreView('c');
      const items = [...document.querySelectorAll('#modalRoot .smBtn')].map(b => b.dataset.act);
      document.querySelector('#modalRoot .smBtn[data-act="copy"]').click(); await new Promise(r => setTimeout(r, 160));
      const g = i => document.getElementById(i).value;
      return { items, title: document.querySelector('#modalRoot h3').textContent, f: { date: g('schDate'), time: g('schTime'), title: g('schTitle'), hours: g('schHours'), workers: g('schWorkers'), crew: g('schCrew'), proj: g('schProj'), memo: g('schMemo') }, n: state.schedule.length,
        chip: (document.querySelector('#modalRoot .schCrewChip[data-n="김타일"]') || {}).getAttribute && document.querySelector('#modalRoot .schCrewChip[data-n="김타일"]').getAttribute('aria-pressed') };
    });
    assert(JSON.stringify(r.items) === JSON.stringify(['workorder', 'share', 'copy', 'mat', 'gcal', 'ics'])   /* v369 🚚 이 공정 자재 납품 예정(현장 일정) */, '⋯ 메뉴: ' + JSON.stringify(r.items));
    assert(r.title === '📄 일정 복사' && r.n === 1, '창·아직 안 생김: ' + JSON.stringify(r));
    assert(JSON.stringify(r.f) === JSON.stringify({ date: '2026-11-09', time: '08:30', title: '타일', hours: '6', workers: '2', crew: '김타일', proj: '가상현장A', memo: '줄눈 회색' }), '채운 값: ' + JSON.stringify(r.f));
    assert(r.chip === 'true', '담당 칩 눌림: ' + r.chip);
    await save();
    const s = await page.evaluate(() => ({ n: state.schedule.length, orig: state.schedule[0], copy: state.schedule[1], modal: !!document.querySelector('#modalRoot .modal') }));
    assert(s.n === 2 && !s.modal, '저장: ' + JSON.stringify(s).slice(0, 200));
    const c = s.copy;
    assert(c.id !== 'c' && c.date === '2026-11-09' && c.title === '타일' && c.project === '가상현장A' && c.crew === '김타일' && c.memo === '줄눈 회색' && c.report === null && !('startedAt' in c) && !('prep' in c) && !('icsUid' in c), '복사본: ' + JSON.stringify(c));
    assert(s.orig.memo === '2026-11-07~2026-11-10 (3일) 줄눈 회색' && s.orig.report && s.orig.report.done === '1일차 끝' && s.orig.icsUid === 'u-1', '원본 그대로: ' + JSON.stringify(s.orig));
  });

  await test('② 취소하면 아무것도 생기지 않는다(저장본 그대로)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); hjScheduleCopy('c');
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '취소').click();
      return { same: snap() === b0, n: state.schedule.length, missing: (() => { const t = []; const o = window.toast; window.toast = m => t.push(m); hjScheduleCopy('없음'); window.toast = o; return t; })() };
    });
    assert(r.same && r.n === 1, '취소: ' + JSON.stringify(r));
    assert(/찾을 수 없/.test(r.missing.join(' ')), '없는 일정: ' + JSON.stringify(r.missing));
  });

  await test('③ "+ 일정 추가"는 예전처럼 고른 날짜·보고 있던 현장을 미리 채운다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      __calSelDate = '2026-11-20'; state.activeProject = '가상현장B';
      openScheduleEdit();
      const v = { title: document.querySelector('#modalRoot h3').textContent, date: document.getElementById('schDate').value, proj: document.getElementById('schProj').value, t: document.getElementById('schTitle').value, crew: document.getElementById('schCrew').value };
      closeModal(true); __calSelDate = null; state.activeProject = null; return v;
    });
    assert(JSON.stringify(r) === JSON.stringify({ title: '일정 추가', date: '2026-11-20', proj: '가상현장B', t: '', crew: '' }), '빈 새 일정: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== schcopy-v361: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

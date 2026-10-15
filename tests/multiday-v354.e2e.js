/* multiday-v354.e2e.js — v354 여러 날 공정이 둘째 날부터도 오늘 일정·내 업무·달력·알림 문자에 보인다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · 기간은 🗓 공정표 메모 '시작~끝 (N일)' 에서만(메모 첫머리가 그 일정 날짜일 때). 사람이 바꾼 메모·메모 없음은 하루짜리.
   · 이어지는 날 = 시작 다음 날 ~ 끝, 일요일 제외(공정표와 같은 셈), 완료 보고된 공정은 끝난 것.
   · 공정 진행률은 이어지는 날에도 '진행 중', 🕒 지연 점검은 끝나는 날부터 센다(하는 중인 공정을 지연이라 부르지 않는다).
   · 읽기 전용 — 새 일정을 만들지 않고 저장본을 바꾸지 않는다. 오늘은 2026-11-05(목)로 고정(localDate 를 가로챔). */
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
    window.__today = '2026-11-05'; const orig = window.localDate; window.localDate = (d) => d ? orig(d) : window.__today;
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-0000-1111', addr: '대전 가상구 1' } }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('one', '2026-11-02', '철거'),
      S('ml', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)', workers: '2' }),       // 수·목·금
      S('rp', '2026-11-04', '목공 (2일차 시작)', { memo: '2026-11-04~2026-11-05 (2일)', report: { done: '목공 끝', progress: '완료' } }),   // 끝난 공정
      S('hm', '2026-11-04', '설비', { memo: '2026-11-03~2026-11-06 배관 확인' }),                               // 사람이 쓴 메모 — 하루짜리
      S('td', '2026-11-05', '조명', { time: '13:00' }),
      S('dg', '2026-11-07', '도배 (3일차 시작)', { memo: '2026-11-07~2026-11-10 (3일)' })                       // 토·(일)·월·화
    ];
  });

  await test('① 기간 읽기: 공정표 메모만, 일요일·완료·사람 메모 제외, N/M일째', async () => {
    const r = await page.evaluate(() => {
      const by = id => state.schedule.find(s => s.id === id);
      const on = (id, d) => { const c = hjSchContOn(by(id), d); return c ? c.day + '/' + c.days : null; };
      return {
        span: hjSchSpan(by('ml')), hm: hjSchSpan(by('hm')).days, one: hjSchSpan(by('one')).days,
        ml: ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map(d => on('ml', d)),
        dg: ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'].map(d => on('dg', d)),
        rp: on('rp', '2026-11-05'),
        today: hjSchContinuing('2026-11-05').map(x => x.s.id),
        label: hjSchContLabel(hjSchContOn(by('ml'), '2026-11-05'))
      };
    });
    assert(JSON.stringify(r.span) === JSON.stringify({ from: '2026-11-04', to: '2026-11-06', days: 3 }) && r.hm === 1 && r.one === 1, '기간: ' + JSON.stringify(r));
    assert(JSON.stringify(r.ml) === JSON.stringify([null, '2/3', '3/3', null]), '타일 이어지는 날: ' + JSON.stringify(r.ml));
    assert(JSON.stringify(r.dg) === JSON.stringify([null, '2/3', '3/3', null]), '일요일 낀 도배: ' + JSON.stringify(r.dg));
    assert(r.rp === null && JSON.stringify(r.today) === '["ml"]', '완료 공정·오늘 목록: ' + JSON.stringify(r));
    assert(r.label === '↳ 이어서 2/3일째 · 11/4(수)~11/6(금)', '표시 글: ' + r.label);
  });

  await test('② 대시보드 오늘 일정·📋 내 업무에 둘째 날 공정이 보이고, 작업 시작 버튼은 첫날 것만', async () => {
    const r = await page.evaluate(async () => {
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 80));
      const conts = [...document.querySelectorAll('#view [data-gosch] [data-schcont]')].map(e => [e.closest('[data-gosch]').dataset.gosch, e.textContent]);
      const root = myWorkView({ refresh: false });
      const card = id => root.querySelector('[data-mw-sch="' + id + '"]');
      const out = {
        conts,
        ml: card('ml') ? { state: card('ml').querySelector('[data-mw-state]').textContent, start: !!card('ml').querySelector('[data-mw-start]'), done: !!card('ml').querySelector('[data-mw-done]'), photo: !!card('ml').querySelector('[data-mw-photo]') } : null,
        td: card('td') ? !!card('td').querySelector('[data-mw-start]') : null,
        others: ['one', 'rp', 'hm', 'dg'].filter(card),
        empty: !!root.querySelector('#mwEmpty')
      };
      closeModal(true);
      return out;
    });
    assert(r.conts.length === 1 && r.conts[0][0] === 'ml' && /이어서 2\/3일째/.test(r.conts[0][1]), '대시보드: ' + JSON.stringify(r.conts));
    assert(r.ml && /이어서 2\/3일째/.test(r.ml.state) && !r.ml.start && r.ml.done && r.ml.photo, '내 업무 이어지는 카드: ' + JSON.stringify(r.ml));
    assert(r.td === true && r.others.length === 0 && !r.empty, '첫날 카드·다른 일정: ' + JSON.stringify(r));
  });

  await test('③ 달력에 이어지는 날 막대(일요일 빼고), 날짜를 고르면 그날 묶음 끝에 ↳ 이어서', async () => {
    const r = await page.evaluate(async () => {
      __calYM = '2026-11'; __calSelDate = null; state.tab = 'schedule'; render(); await new Promise(r => setTimeout(r, 60));
      const cell = d => document.querySelector('[data-calday="' + d + '"]');
      const bars = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'].map(d => !!cell(d).querySelector('.cal-cont'));
      const aria = cell('2026-11-05').getAttribute('aria-label');
      const todayList = [...document.querySelectorAll('#view .sch-day')].filter(d => /오늘/.test(d.querySelector('.sch-day-h').textContent)).map(d => [...d.querySelectorAll('[data-schcont]')].map(e => e.textContent));
      calSelectDay('2026-11-09'); await new Promise(r => setTimeout(r, 40));
      const sel9 = [...document.querySelectorAll('#view .sch-item')].map(i => [i.querySelector('.sch-title').textContent.trim(), (i.querySelector('[data-schcont]') || {}).textContent || '']);
      calSelectDay('2026-11-09'); calSelectDay('2026-11-08'); await new Promise(r => setTimeout(r, 40));
      const sun = { items: document.querySelectorAll('#view .sch-item').length, empty: !!document.querySelector('#view .empty') };
      __calSelDate = null; __calYM = null;
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { bars, aria, todayList, sel9, sun, wide };
    });
    assert(JSON.stringify(r.bars) === JSON.stringify([false, true, true, false, false, true, true, false]), '막대: ' + JSON.stringify(r.bars));
    assert(/일정 1건 이어지는 공정 1건/.test(r.aria), '달력 읽기 글: ' + r.aria);
    assert(JSON.stringify(r.todayList) === JSON.stringify([['↳ 이어서 2/3일째 · 11/4(수)~11/6(금)']]), '오늘 묶음: ' + JSON.stringify(r.todayList));
    assert(r.sel9.length === 1 && /도배/.test(r.sel9[0][0]) && /2\/3일째 · 11\/7\(토\)~11\/10\(화\)/.test(r.sel9[0][1]), '11/9 고르기: ' + JSON.stringify(r.sel9));
    assert(r.sun.items === 0 && r.sun.empty, '일요일: ' + JSON.stringify(r.sun));
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('④ 🔔 알림 문자: 이어지는 날에도 작업자 안내(같은 주소), 고객 글은 "이어집니다"', async () => {
    const r = await page.evaluate(() => notifyDrafts('2026-11-06').map(i => ({ id: i.id, title: i.title, cont: i.cont, worker: i.worker, customer: i.customer })));
    const ml = r.find(x => x.id === 'ml');
    assert(r.length === 1 && ml && ml.title === '타일 (3/3일째)' && ml.cont === '3/3', '알림 목록: ' + JSON.stringify(r));
    assert(/작업: 타일 \(3\/3일째\)/.test(ml.worker) && /주소: 대전 가상구 1/.test(ml.worker) && /인원: 2/.test(ml.worker), '작업자 글: ' + ml.worker);
    assert(/가상현장A 타일 \(3\/3일째\) 작업이 이어집니다/.test(ml.customer) && /김가상님/.test(ml.customer), '고객 글: ' + ml.customer);
  });

  await test('⑤ 공정 진행률은 둘째 날에도 진행 중, 지연 점검은 끝나는 날부터 센다', async () => {
    const r = await page.evaluate(() => {
      const p = state.projects[0];
      const pr = hjPhaseProgress(p);
      const names = d => { window.__today = d; try { return hjPhaseDelays(p, d).map(x => x.name + (x.to !== x.date ? '~' + x.to : '')); } finally { window.__today = '2026-11-05'; } };   // 지연 점검은 그날의 진행률을 같이 본다
      return { doing: pr.doing, d6: names('2026-11-06'), d7: names('2026-11-07'), d8: names('2026-11-08') };
    });
    assert(r.doing.includes('타일') && r.doing.includes('조명'), '진행 중: ' + JSON.stringify(r.doing));
    assert(!r.d6.some(n => /^타일/.test(n)) && !r.d7.some(n => /^타일/.test(n)), '하는 중인 타일을 지연이라 불렀다: ' + JSON.stringify(r));
    assert(r.d8.includes('타일~2026-11-06') && r.d6.includes('철거') && r.d6.includes('설비'), '지연 목록: ' + JSON.stringify(r));
  });

  await test('⑥ 읽기 경로는 저장본을 바꾸지 않는다(새 일정 없음)', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(), n0 = state.schedule.length;
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 60));
      __calYM = '2026-11'; state.tab = 'schedule'; render(); __calYM = null;
      myWorkView({ refresh: false }); closeModal(true); notifyDrafts('2026-11-06'); scheduleNotify('2026-11-06'); closeModal(true);
      state.projects.forEach(p => { hjPhaseProgress(p); hjPhaseDelays(p, '2026-11-08'); });
      return { same: snap() === b0, n: state.schedule.length === n0 };
    });
    assert(r.same && r.n, '저장본이 바뀌었다 ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== multiday-v354: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

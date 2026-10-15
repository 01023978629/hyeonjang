/* custsched-v363.e2e.js — v363 🗓 고객 공사 일정 안내 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·공유 시트는 가로챔).
   · 그 현장의 남은 일정(끝나는 날이 오늘 이후·완료 보고 없음·💰/세금 자동 제외)을 날짜순 고객용 글로: 날짜(여러 날이면 시작~끝)·작업 이름만.
   · 담당 팀원·주소·내부 메모·💰 수금 일정·다른 현장 일정은 넣지 않는다. 고객 연락처가 없으면 문자 버튼 대신 안내.
   · 입구: 현장 화면 고객 카드 [🗓 일정 안내] · 📤 공유 창에서 현장을 골랐을 때 [🏠 … 고객용 일정 글](‹ 뒤로 = 공유 창).
   · 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
    window.__shared = []; window.__sms = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
    window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '이가상', phone: '', addr: '' } }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('done', '2026-11-02', '철거', { report: { done: '끝', progress: '완료' } }),
      S('past', '2026-11-03', '실측'),
      S('tile', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)', crew: '김타일' }),
      S('light', '2026-11-07', '조명', { time: '13:00', crew: '김타일', memo: '가상 내부 메모' }),
      S('pay', '2026-11-10', '💰 잔금', { hours: 0 }),
      S('as', '2026-11-12', '🔧 AS 방문: 실리콘', { time: '10:00', hours: 2 }),
      S('other', '2026-11-06', '도배', { project: '가상현장B' })
    ];
    window.__shared = []; window.__sms = []; __calSelDate = null;
  });

  await test('① 남은 일정만 날짜순 고객 글 — 여러 날은 시작~끝, 담당·주소·메모·💰·다른 현장 없음', async () => {
    await seed();
    const r = await page.evaluate(() => ({ ids: hjCustSchedRows('가상현장A').map(s => s.id), text: hjCustSchedText(state.projects[0], hjCustSchedRows('가상현장A')), empty: hjCustSchedText(state.projects[1], []) }));
    assert(JSON.stringify(r.ids) === JSON.stringify(['tile', 'light', 'as']), '남은 일정: ' + JSON.stringify(r.ids));
    const t = r.text;
    assert(/가상현장A 공사 일정 안내/.test(t) && /김가상님/.test(t) && /· 11\/4\(수\)~11\/6\(금\) 타일\n· 11\/7\(토\) 13:00 조명\n· 11\/12\(목\) 10:00 🔧 AS 방문: 실리콘/.test(t), '글: ' + t);
    assert(!/김타일|내부 메모|잔금|둔산동|도배|철거|실측|일차 시작/.test(t), '넣지 말 것: ' + t);
    assert(/남은 공사 일정이 없습니다/.test(r.empty) && /이가상님/.test(r.empty), '빈 현장: ' + r.empty);
  });

  await test('② 현장 화면 고객 카드 [🗓 일정 안내] → 고친 글로 고객 문자 / 카톡, 연락처 없으면 문자 버튼 없음', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.tab = 'project'; state.activeProject = '가상현장A'; render(); await new Promise(r => setTimeout(r, 60));
      const b = document.querySelector('#view [data-custsched="가상현장A"]'); const h = b && b.getBoundingClientRect().height; b.click();
      const m = () => document.querySelector('#modalRoot .modal');
      const first = { title: m().querySelector('h3').textContent, count: m().querySelector('#csCount').textContent, sms: !!m().querySelector('#csSms') };
      m().querySelector('#csText').value += '\n가상 덧붙임';
      m().querySelector('#csSms').click(); m().querySelector('#csKakao').click(); await new Promise(r => setTimeout(r, 20));
      hjCustSchedView('가상현장B'); const noPhone = { sms: !!m().querySelector('#csSms'), hint: m().textContent };
      closeModal(true); state.tab = 'dashboard'; state.activeProject = null; render();
      return { h, first, sms: window.__sms, shared: window.__shared.map(s => s.text), noPhone };
    });
    assert(r.h > 0 && /고객 일정 안내 — 가상현장A/.test(r.first.title) && /남은 일정 3건 · 김가상님/.test(r.first.count) && r.first.sms, '창: ' + JSON.stringify(r.first));
    assert(r.sms.length === 1 && r.sms[0].to === '010-9999-8888' && /가상 덧붙임$/.test(r.sms[0].t) && r.shared.length === 1 && /가상 덧붙임$/.test(r.shared[0]), '보내기: ' + JSON.stringify(r).slice(0, 300));
    assert(!r.noPhone.sms && /연락처가 없어/.test(r.noPhone.hint), '연락처 없음: ' + JSON.stringify(r.noPhone).slice(0, 200));
  });

  await test('③ 📤 공유 창에서 현장을 고르면 [🏠 고객용 일정 글] → ‹ 뒤로 = 공유 창, 저장본은 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      hjSchShareView({ kind: 'week' }); const before = !!document.getElementById('shCust');
      const sel = document.getElementById('shProj'); sel.value = '가상현장A'; sel.dispatchEvent(new Event('change'));
      const btn = document.getElementById('shCust'); const label = btn && btn.textContent; btn.click();
      const opened = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)).click();
      const back = { title: document.querySelector('#modalRoot h3').textContent, proj: (document.getElementById('shProj') || {}).value };
      closeModal(true);
      return { before, label, opened, back, same: snap() === b0 };
    });
    assert(!r.before && /가상현장A 고객용 일정 글/.test(r.label) && /고객 일정 안내/.test(r.opened), '버튼: ' + JSON.stringify(r));
    assert(r.back.title === '📤 일정 공유' && r.back.proj === '가상현장A', '뒤로: ' + JSON.stringify(r.back));
    assert(r.same, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== custsched-v363: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

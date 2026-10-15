/* pjsched-v364.e2e.js — v364 현장 화면 '🗓 이 현장 일정' 칸 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 남은 일정(끝나는 날이 오늘 이후·완료 보고 없음, 💰 포함·세금 자동 제외·다른 현장 제외) 날짜순 8줄까지, 여러 날은 시작~끝·N/M일째, 담당.
   · 줄마다 [✎ 수정]·[📄 복사], 아래 [+ 일정 추가](이 현장 미리 채움)·[🗓 고객 일정 안내]·[📤 팀 공유](이 현장으로 좁힘).
   · 상담 단계에 일정이 없으면 칸 없음, 실측·시공 단계는 빈 안내, 8건 넘으면 '외 N건 — 일정표에서 보기'. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '' } },
      { name: '가상현장B', stage: 0, received: 0, phases: [], cost: {}, customer: {} },
      { name: '가상현장C', stage: 1, received: 0, phases: [], cost: {}, customer: {} }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('done', '2026-11-02', '철거', { report: { done: '끝', progress: '완료' } }),
      S('tile', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)', crew: '김타일' }),
      S('light', '2026-11-07', '조명', { time: '13:00' }),
      S('pay', '2026-11-10', '💰 잔금', { hours: 0, time: '' }),
      S('tax', '2026-11-10', '부가세 신고', { _taxAuto: true }),
      S('other', '2026-11-06', '도배', { project: '가상현장B' })
    ];
    __calSelDate = null; state.activeProject = '가상현장A'; state.tab = 'project'; render();
  });
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#view [data-pjsched] [data-pjschrow]')].map(r => r.dataset.pjschrow + '|' + r.querySelector('span').textContent.replace(/\s+/g, ' ').trim()));

  await test('① 남은 일정만 날짜순(💰 포함·세금 자동·완료·다른 현장 제외), 여러 날은 시작~끝·N/M일째·담당', async () => {
    await seed();
    const r = await rows();
    const head = await page.evaluate(() => document.querySelector('#view [data-pjsched] .cust-h').textContent);
    assert(JSON.stringify(r) === JSON.stringify(['tile|11/4(수)~11/6(금) 타일 · 2/3일째 · 👤 김타일', 'light|11/7(토) 13:00 조명', 'pay|11/10(화) 💰 잔금']), '줄: ' + JSON.stringify(r));
    assert(/남은 일정 3건/.test(head), '머리: ' + head);
  });

  await test('② 줄 버튼·아래 버튼이 기존 화면을 연다 — 수정·복사·추가(이 현장)·고객 안내·팀 공유(이 현장)', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      const out = {}, h3 = () => (document.querySelector('#modalRoot h3') || {}).textContent;
      const click = sel => { document.querySelector('#view ' + sel).click(); };
      click('[data-pjsched] [data-schedit="tile"]'); out.edit = [h3(), document.getElementById('schTitle').value]; closeModal(true);
      click('[data-pjsched] [data-schcopy="light"]'); out.copy = [h3(), document.getElementById('schDate').value, document.getElementById('schProj').value]; closeModal(true);
      click('[data-pjsched] [data-pjschadd]'); out.add = [h3(), document.getElementById('schProj').value, document.getElementById('schTitle').value]; closeModal(true);
      click('[data-pjsched] [data-custsched]'); out.cust = h3(); closeModal(true);
      click('[data-pjsched] [data-pjshare]'); out.share = [h3(), (document.getElementById('shProj') || {}).value]; closeModal(true);
      return out;
    });
    assert(r.edit[0] === '일정 수정' && r.edit[1] === '타일 (3일차 시작)', '수정: ' + JSON.stringify(r.edit));
    assert(JSON.stringify(r.copy) === JSON.stringify(['📄 일정 복사', '2026-11-09', '가상현장A']), '복사: ' + JSON.stringify(r.copy));
    assert(JSON.stringify(r.add) === JSON.stringify(['일정 추가', '가상현장A', '']), '추가: ' + JSON.stringify(r.add));
    assert(/고객 일정 안내 — 가상현장A/.test(r.cust), '고객 안내: ' + r.cust);
    assert(r.share[0] === '📤 일정 공유' && r.share[1] === '가상현장A', '팀 공유: ' + JSON.stringify(r.share));
  });

  await test('③ 상담 단계·일정 없음 → 칸 없음, 실측 단계·일정 없음 → 빈 안내, 9건 이상 → 8줄 + 외 N건(일정표로)', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.activeProject = '가상현장B'; state.schedule = state.schedule.filter(s => s.project !== '가상현장B'); render();
      const b = !!document.querySelector('#view [data-pjsched]');
      state.activeProject = '가상현장C'; render();
      const c = (document.querySelector('#view [data-pjsched]') || {}).textContent || '';
      for (let i = 0; i < 8; i++) state.schedule.push(Object.assign(newSchedule(), { id: 'm' + i, date: '2026-11-1' + i, title: '추가 ' + i, project: '가상현장A' }));
      state.activeProject = '가상현장A'; render();
      const n = document.querySelectorAll('#view [data-pjsched] [data-pjschrow]').length, more = document.querySelector('#view [data-pjsched] [data-gosch]');
      const moreText = more && more.textContent; more.click(); await new Promise(r => setTimeout(r, 30));
      return { b, c, n, moreText, tab: state.tab, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(r.b === false, '상담 단계 일정 없음: 칸이 있다');
    assert(/남은 일정 0건/.test(r.c) && /남은 일정이 없어요/.test(r.c), '실측 단계 빈 안내: ' + r.c);
    assert(r.n === 8 && /외 3건/.test(r.moreText) && r.tab === 'schedule', '8줄 + 외: ' + JSON.stringify(r));
  });

  await test('④ 현장 화면을 그리는 것만으로는 저장본이 바뀌지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); render(); state.activeProject = '가상현장C'; render(); state.activeProject = '가상현장A'; render();
      return { same: snap() === b0, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== pjsched-v364: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

/* crewweek-v375.e2e.js — v375 👷 팀원 주간 현황 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 이번 주(월~일)·다음 주 — 사람 = 👷 팀원 연락처 + 그 주 일정의 담당 이름. 7칸(그날 작업 이름 — 그날 시작하는 것 먼저, 여러 날 공정의 이어지는 날 포함),
     일한 날 수·현장 수·월~토 빈 날·담당 겹침 날, 담당 없는 일정 수. [📤 일정 보내기] → 그 사람으로 좁힌 공유 창(← 뒤로 = 현황).
   · 더보기 '현장·시공' [👷 팀원 주간 현황]. 읽기 전용. 오늘은 2026-11-05(목) 고정 — 이번 주 11/2(월)~11/8(일). */
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
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }, { id: 'k2', name: '박도배', phone: '010-3333-4444', team: true }, { id: 'k3', name: '최목수', phone: '', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {} },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('t1', '2026-11-03', '타일 (3일차 시작)', { crew: '김타일', memo: '2026-11-03~2026-11-05 (3일)' }),
      S('t2', '2026-11-05', '조명', { crew: '김타일', project: '가상현장B', time: '09:00' }),
      S('d1', '2026-11-06', '도배', { crew: '박도배' }),
      S('n1', '2026-11-04', '실리콘', { crew: '이외부' }),
      S('x1', '2026-11-07', '청소'),
      S('pay', '2026-11-06', '💰 잔금', { crew: '김타일', hours: 0, time: '' }),
      S('nx', '2026-11-10', '마루', { crew: '박도배' })
    ];
    __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 사람별 — 7칸 작업·일한 날·현장 수·빈 날·겹침, 팀원 연락처 + 일정 담당 이름, 담당 없는 일정 수(💰 제외)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const d = hjCrewWeekData('week');
      const P = n => d.people.find(p => p.name === n);
      const days = p => d.dates.map(x => (p.byDate[x] || []).map(r => r.s.id).join('+') || '-').join(' ');
      return { range: [d.rg.from, d.rg.to], names: d.people.map(p => p.name), kim: { days: days(P('김타일')), work: P('김타일').work, sites: P('김타일').sites, empty: P('김타일').empty, clash: P('김타일').clashDates },
        park: { days: days(P('박도배')), work: P('박도배').work }, choi: { work: P('최목수').work, empty: P('최목수').empty.length }, ext: { team: P('이외부').team, work: P('이외부').work }, noCrew: d.noCrew };
    });
    assert(JSON.stringify(r.range) === JSON.stringify(['2026-11-02', '2026-11-08']), '범위: ' + JSON.stringify(r.range));
    assert(JSON.stringify(r.names) === JSON.stringify(['김타일', '박도배', '최목수', '이외부']), '사람: ' + JSON.stringify(r.names));
    assert(r.kim.days === '- t1 t1 t2+t1 - - -' && r.kim.work === 3 && JSON.stringify(r.kim.sites) === JSON.stringify(['가상현장A', '가상현장B']), '김타일: ' + JSON.stringify(r.kim));
    assert(JSON.stringify(r.kim.empty) === JSON.stringify(['2026-11-02', '2026-11-06', '2026-11-07']) && JSON.stringify(r.kim.clash) === JSON.stringify(['2026-11-05']), '빈 날·겹침: ' + JSON.stringify(r.kim));
    assert(r.park.days === '- - - - d1 - -' && r.park.work === 1 && r.choi.work === 0 && r.choi.empty === 6 && r.ext.team === false && r.ext.work === 1 && r.noCrew === 1, '나머지: ' + JSON.stringify(r));
  });

  await test('② 창 — 사람 카드·7칸 글·요약·겹침 표시, [다음 주], [📤 일정 보내기] → 그 사람 공유 창 ← 뒤로 = 현황', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjCrewWeekView();
      const card = n => document.querySelector('#crewWeek .cwPerson[data-name="' + n + '"]');
      const kim = { sum: card('김타일').querySelector('.cwSum').textContent, clash: (card('김타일').querySelector('.cwClash') || {}).textContent,
        cells: [...card('김타일').querySelectorAll('.cwJob')].map(x => x.textContent) };
      const hint = document.querySelector('#crewWeek .hint').textContent;
      const choiShare = !!card('최목수').querySelector('.cwShare'), extNote = /팀원 연락처 없음/.test(card('이외부').textContent);
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      card('김타일').querySelector('.cwShare').click();
      const share = { h3: document.querySelector('#modalRoot h3').textContent, crew: (document.getElementById('shCrew') || {}).value };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)).click();
      const back = document.querySelector('#modalRoot h3').textContent;
      document.querySelector('#crewWeek .cwRange[data-k="nextweek"]').click();
      const next = { hint: document.querySelector('#crewWeek .hint').textContent, park: (document.querySelector('#crewWeek .cwPerson[data-name="박도배"] .cwSum') || {}).textContent };
      closeModal(true);
      return { kim, hint, choiShare, extNote, w, share, back, next };
    });
    assert(/· 3일 · 현장 2곳 · 빈 날 월·금·토/.test(r.kim.sum) && /⚠ 겹침 11\/5\(목\)/.test(r.kim.clash || ''), '김타일 요약: ' + JSON.stringify(r.kim));
    assert(JSON.stringify(r.kim.cells) === JSON.stringify(['·', '타일', '타일', '조명·타일', '·', '·', '·']), '7칸: ' + JSON.stringify(r.kim.cells));
    assert(/11\/2\(월\)~11\/8\(일\) · 팀원 4명 · 담당 없는 일정 1건/.test(r.hint) && !r.choiShare && r.extNote && r.w <= 0, '머리·버튼: ' + JSON.stringify(r));
    assert(r.share.h3 === '📤 일정 공유' && r.share.crew === '김타일' && r.back === '👷 팀원 주간 현황', '보내기: ' + JSON.stringify(r));
    assert(/11\/9\(월\)~11\/15\(일\)/.test(r.next.hint) && /· 1일 · 현장 1곳/.test(r.next.park || ''), '다음 주: ' + JSON.stringify(r.next));
  });

  await test('③ 더보기 [👷 팀원 주간 현황]으로 열리고, 그리는 것만으로는 저장본이 바뀌지 않는다 · 팀원이 없으면 빈 안내', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      moreActionHandler('crewweek'); const h3 = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      const same = snap() === b0;
      state.contacts = []; state.schedule = [];
      hjCrewWeekView(); const empty = /사람별로 볼 팀원이 없어요/.test(document.getElementById('crewWeek').textContent); closeModal(true);
      return { h3, same, empty, item: MORE_CATS.flatMap(c => c.items).some(x => x[0] === 'crewweek') };
    });
    assert(r.h3 === '👷 팀원 주간 현황' && r.item && r.same && r.empty, JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== crewweek-v375: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

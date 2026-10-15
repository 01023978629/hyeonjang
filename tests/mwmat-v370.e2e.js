/* mwmat-v370.e2e.js — v370 현장에서 자재 받기 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 📋 내 업무 '🚚 오늘 받을 자재 N' — 오늘 일정이 있는 현장의 미입고 중 납품일 ≤ 오늘(지남 먼저). [✅ 받았어요] → 그 기록 recvAt 만 오늘로.
     오늘 일정이 없는 현장·내일 납품·입고된 것·날짜 미정은 없음. 받을 게 없으면 칸 없음.
   · 📤 팀 일정 공유 글 — 그날 일정 현장의 그날 납품 '🚚 자재 도착 예정' 줄(오늘이면 지난 미입고도 '(지난 납품…)'), 다른 현장·고객용 글에는 없음.
   · 오늘은 2026-11-05(목) 고정. */
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
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }];
    const I = (name, qty, unit) => ({ name, spec: '', qty, unit });
    const O = (id, sup, items, due, x) => Object.assign({ id, sup, items, due, at: '2026-11-01', recvAt: '', memo: '' }, x || {});
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' }, matOrders: [
        O('m1', '가상타일상사', [I('타일 600각', 42, '장')], '2026-11-04'),
        O('m2', '가상설비', [I('변기', 1, '대'), I('세면대', 1, '대')], '2026-11-05', { memo: '오전 하차' }),
        O('m3', '가상목재', [I('합판', 10, '장')], '2026-11-06'),
        O('m4', '가상도배', [I('벽지', 8, '롤')], '2026-11-05', { recvAt: '2026-11-05' }),
        O('m7', '가상창호', [I('방충망', 2, '틀')], '')] },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {}, matOrders: [O('m5', '가상조명', [I('다운라이트', 6, '개')], '2026-11-05')] },
      { name: '가상현장C', stage: 2, received: 0, phases: [], cost: {}, customer: {}, matOrders: [O('m6', '가상전기', [I('전선', 1, '롤')], '2026-11-05')] }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('t0', '2026-11-05', '철거', { crew: '김타일' }),
      S('b1', '2026-11-05', '조명', { project: '가상현장B', time: '10:00' }),
      S('t1', '2026-11-06', '타일', { crew: '김타일' }),
      S('c1', '2026-11-07', '전기', { project: '가상현장C' })
    ];
    __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 📋 내 업무 \'🚚 오늘 받을 자재\' — 오늘 일정 현장의 오늘·지난 미입고만, [✅ 받았어요] → 그 기록만 입고', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      const read = () => { const h = [...document.querySelectorAll('#myWork h4')].map(x => x.textContent).find(t => /받을 자재/.test(t)) || '';
        return { h, ids: [...document.querySelectorAll('#myWork [data-mw-mat]')].map(x => x.dataset.mwMat), text: (document.querySelector('#myWork [data-mw-mat="m2"]') || {}).textContent || '' }; };
      myWorkView({ refresh: false }); const first = read();
      const btn = document.querySelector('#myWork [data-mw-matrecv="m2"]'); const h = btn.getBoundingClientRect().height; btn.click(); await new Promise(r => setTimeout(r, 40));
      const after = read(); const rec = state.projects.map(p => (p.matOrders || []).map(o => o.id + ':' + o.recvAt).join(',')).join('|');
      closeModal(true);
      return { first, h, after, rec };
    });
    assert(r.first.h === '🚚 오늘 받을 자재 3' && JSON.stringify(r.first.ids) === JSON.stringify(['m1', 'm2', 'm5']), '처음: ' + JSON.stringify(r.first));
    assert(/🚚 오늘 납품 11\/5\(목\) · 📍가상현장A/.test(r.first.text) && /가상설비 — 변기 × 1대, 세면대 × 1대/.test(r.first.text) && /오전 하차/.test(r.first.text) && r.h >= 44, '줄: ' + r.first.text);
    assert(r.after.h === '🚚 오늘 받을 자재 2' && JSON.stringify(r.after.ids) === JSON.stringify(['m1', 'm5']), '받은 뒤: ' + JSON.stringify(r.after));
    assert(r.rec === 'm1:,m2:2026-11-05,m3:,m4:2026-11-05,m7:|m5:|m6:', '바뀐 것은 m2 하나: ' + r.rec);
  });

  await test('② 받을 게 없으면 칸 없음 — 오늘 일정이 없거나 모두 입고', async () => {
    await seed();
    const r = await page.evaluate(() => {
      ['m1', 'm2', 'm5'].forEach(id => hjMatReceive(id, true));
      myWorkView({ refresh: false }); const a = /받을 자재/.test(document.getElementById('myWork').textContent); closeModal(true);
      ['m1', 'm2', 'm5'].forEach(id => hjMatReceive(id, false));
      state.schedule = state.schedule.filter(s => s.date !== '2026-11-05');
      myWorkView({ refresh: false }); const b = /받을 자재/.test(document.getElementById('myWork').textContent); closeModal(true);
      return { a, b };
    });
    assert(!r.a && !r.b, '칸이 있다: ' + JSON.stringify(r));
  });

  await test('③ 📤 팀 일정 공유 글 — 그날 현장의 그날 납품 줄(오늘은 지난 미입고 표시), 다른 현장 없음, 고객용 글에는 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const rg = hjSchShareRange('week');
      const days = hjSchShareDays(rg.from, rg.to);
      const text = hjSchShareText(days, '이번 주', '');
      const cust = hjCustSchedText(state.projects[0], hjCustSchedRows('가상현장A'));
      return { text, cust };
    });
    const t = r.text;
    assert(/■ 11\/5\(목\)[\s\S]*· 09:00 철거 — 가상현장A[\s\S]*🚚 자재 도착 예정 — 가상현장A: 가상타일상사 · 타일 600각 × 42장 \(지난 납품, 아직 입고 확인 안 됨\)\n  🚚 자재 도착 예정 — 가상현장A: 가상설비 · 변기 × 1대, 세면대 × 1대\n  🚚 자재 도착 예정 — 가상현장B: 가상조명 · 다운라이트 × 6개\n/.test(t), '11/5: ' + t);
    assert(/■ 11\/6\(금\)\n· 09:00 타일 — 가상현장A[^\n]*\n(?:  (?!🚚)[^\n]*\n)*  🚚 자재 도착 예정 — 가상현장A: 가상목재 · 합판 × 10장\n/.test(t), '11/6: ' + t);
    assert(!/가상전기|가상도배|방충망/.test(t), '넣지 말 것(일정 없는 날의 C 현장·입고된 것·날짜 미정): ' + t);
    assert(!/자재|가상타일상사/.test(r.cust), '고객용 글: ' + r.cust);
  });

  await test('④ 내 업무를 그리는 것만으로는 저장본이 바뀌지 않는다 · 390px 가로 넘침 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); myWorkView({ refresh: false });
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; closeModal(true);
      hjSchShareView({ kind: 'week' }); closeModal(true);
      return { same: snap() === b0, w };
    });
    assert(r.same && r.w <= 0, JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== mwmat-v370: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

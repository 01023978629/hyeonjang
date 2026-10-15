/* matissue-v372.e2e.js — v372 입고 문제 → 교환·추가 납품 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음.
   · 입고 + 문제 메모(issue, issueAt) → 해결(issueDone) 전까지 '⚠ 입고 문제' 상태(지남 다음 순서). 거래처 확인 문안이 교환·추가 납품 요청으로.
   · 📋 내 업무 [⚠ 문제 있음] → 문제 적고 저장(빈 글은 막음) → 입고 + 문제, 내 업무로 돌아감. [📷 입고 사진]은 현장·'자재 입고 거래처' 이름으로 사진 추가.
   · 🚚 납품 확인 창: '⚠ 문제' 칩, 문제 줄 [✅ 해결]·[📞], 해결된 것은 최근 입고에 '입고 문제 해결'. 고치기 창 '입고 문제' 칸(바꾸면 다시 해결 전, 비우면 삭제).
   · 🔔 알림 '자재 입고 문제 N건', 현장 '🚚 자재 납품' 칸 '· 문제 N건'·[✅ 해결]. 그리는 것만으로는 저장본이 바뀌지 않는다. 오늘은 2026-11-05(목) 고정. */
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
    window.__sms = []; window.__photo = [];
    window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
    window.hjMyWorkPhoto = (pj, label) => { window.__photo.push([pj, label]); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = []; state.asLog = [];
    state.suppliers = [{ name: '가상타일상사', phone: '010-5555-6666' }];
    const I = (name, qty, unit) => ({ name, spec: '', qty, unit });
    const O = (id, sup, items, due, x) => Object.assign({ id, sup, items, due, at: '2026-11-01', recvAt: '', memo: '' }, x || {});
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', addr: '대전 서구 둔산동 1' }, matOrders: [
      O('m1', '가상타일상사', [I('타일 본드', 3, '통')], '2026-11-05'),
      O('m2', '가상타일상사', [I('타일 600각', 42, '장')], '2026-11-04', { recvAt: '2026-11-04', issue: '타일 2장 파손', issueAt: '2026-11-04' }),
      O('m3', '가상설비', [I('변기', 1, '대')], '2026-11-03', { recvAt: '2026-11-03', issue: '뚜껑 빠짐', issueAt: '2026-11-03', issueDone: '2026-11-05' }),
      O('m4', '가상도배', [I('벽지', 8, '롤')], '2026-11-02', { recvAt: '2026-11-02' })] }];
    state.schedule = [{ id: 't0', date: '2026-11-05', time: '09:00', title: '타일', project: '가상현장A', workers: '', memo: '', hours: 8, report: null, crew: '' }];
    window.__sms = []; window.__photo = []; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 상태·순서·문안 — 해결 전 입고 문제는 \'⚠ 입고 문제\'(지남 다음), 해결된 것은 입고, 거래처 문안은 교환·추가 납품 요청', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const p = state.projects[0];
      return { order: hjMatAll().map(x => x.o.id + '|' + x.st.k), t: hjMatState(p.matOrders[1]).t, ask: hjMatAskText(p, p.matOrders[1]) };
    });
    assert(JSON.stringify(r.order) === JSON.stringify(['m2|issue', 'm1|today', 'm3|recv', 'm4|recv']), '순서: ' + JSON.stringify(r.order));
    assert(r.t === '⚠ 입고 문제 — 타일 2장 파손', '상태 글: ' + r.t);
    assert(/■ 11\/4\(수\) 받은 자재에 문제가 있습니다: 타일 2장 파손\n■ 교환·추가 납품 일정을 알려 주세요\./.test(r.ask) && !/김가상/.test(r.ask), '문안: ' + r.ask);
  });

  await test('② 📋 내 업무 [⚠ 문제 있음] — 빈 글은 막고, 적으면 입고+문제 저장 → 내 업무로, [📷 입고 사진]', async () => {
    await seed();
    const r = await page.evaluate(() => {
      myWorkView({ refresh: false });
      document.querySelector('#myWork [data-mw-matissue="m1"]').click();
      const h3 = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입고 사진/.test(b.textContent)).click();
      const photo = window.__photo.slice();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /문제로 입고 저장/.test(b.textContent)).click();
      const blocked = { h3: document.querySelector('#modalRoot h3').textContent, recv: state.projects[0].matOrders[0].recvAt };
      document.getElementById('miText').value = '본드 1통 부족';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /문제로 입고 저장/.test(b.textContent)).click();
      const back = document.querySelector('#modalRoot h3').textContent, o = state.projects[0].matOrders[0];
      const still = !!document.querySelector('#myWork [data-mw-mat="m1"]'); closeModal(true);
      return { h3, photo, blocked, back, o, still, st: hjMatState(o).k };
    });
    assert(r.h3 === '⚠ 자재 문제 — 가상타일상사' && JSON.stringify(r.photo) === JSON.stringify([['가상현장A', '자재 입고 가상타일상사']]), '창·사진: ' + JSON.stringify(r));
    assert(/자재 문제/.test(r.blocked.h3) && r.blocked.recv === '', '빈 글 막음: ' + JSON.stringify(r.blocked));
    assert(/^📋 내 업무/.test(r.back) && r.o.recvAt === '2026-11-05' && r.o.issue === '본드 1통 부족' && r.o.issueAt === '2026-11-05' && !r.still && r.st === 'issue', '저장: ' + JSON.stringify(r));
  });

  await test('③ 🚚 납품 확인 창 — \'⚠ 문제\' 칩, 문제 줄 [📞]·[✅ 해결], 해결된 것은 최근 입고에 표시', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjMatView();
      const chips = document.querySelector('#matView > div').textContent;
      const row = document.querySelector('#matView .mdRow[data-id="m2"]');
      const info = { fix: !!row.querySelector('.mdFix'), ask: !!row.querySelector('.mdAsk'), undo: !!row.querySelector('.mdUndo'), issue: (row.querySelector('.mdIssue') || {}).textContent };
      const m3 = (document.querySelector('#matView .mdRow[data-id="m3"] .mdIssue') || {}).textContent;
      row.querySelector('.mdAsk').click();
      const askText = document.getElementById('maText').value;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)).click();
      document.querySelector('#matView .mdRow[data-id="m2"] .mdFix').click();
      const after = { done: state.projects[0].matOrders[1].issueDone, chips: document.querySelector('#matView > div').textContent, undo: !!document.querySelector('#matView .mdRow[data-id="m2"] .mdUndo') };
      closeModal(true);
      return { chips, info, m3, askText, after };
    });
    assert(/⚠ 문제 1/.test(r.chips), '칩: ' + r.chips);
    assert(r.info.fix && r.info.ask && !r.info.undo && r.info.issue === '입고 11/4(수) · 문제 적은 날 11/4(수)', '문제 줄: ' + JSON.stringify(r.info));
    assert(r.m3 === '입고 문제 해결 11/5(목)', '해결된 줄: ' + r.m3);
    assert(/받은 자재에 문제가 있습니다: 타일 2장 파손/.test(r.askText), '확인 문안: ' + r.askText);
    assert(r.after.done === '2026-11-05' && !/⚠ 문제/.test(r.after.chips) && r.after.undo, '해결 뒤: ' + JSON.stringify(r.after));
  });

  await test('④ 고치기 창 \'입고 문제\' 칸 — 받은 기록에만, 적으면 해결 전으로, 비우면 삭제', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjMatEdit('m1'); const unrecv = !!document.getElementById('meIssue'); closeModal(true);
      hjMatEdit('m4'); document.getElementById('meIssue').value = '색상 다름';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const m4 = JSON.parse(JSON.stringify(state.projects[0].matOrders[3]));
      hjMatEdit('m3'); const m3v = document.getElementById('meIssue').value; document.getElementById('meIssue').value = '뚜껑 빠짐, 경첩 불량';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const m3 = JSON.parse(JSON.stringify(state.projects[0].matOrders[2]));
      hjMatEdit('m2'); document.getElementById('meIssue').value = '';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const m2 = JSON.parse(JSON.stringify(state.projects[0].matOrders[1]));
      return { unrecv, m4, m3v, m3, m2 };
    });
    assert(!r.unrecv, '안 받은 기록에 문제 칸');
    assert(r.m4.issue === '색상 다름' && r.m4.issueAt === '2026-11-05' && !r.m4.issueDone, '새 문제: ' + JSON.stringify(r.m4));
    assert(r.m3v === '뚜껑 빠짐' && r.m3.issue === '뚜껑 빠짐, 경첩 불량' && !('issueDone' in r.m3), '바꾸면 해결 전: ' + JSON.stringify(r.m3));
    assert(!('issue' in r.m2) && !('issueAt' in r.m2) && r.m2.recvAt === '2026-11-04', '비우면 삭제: ' + JSON.stringify(r.m2));
  });

  await test('⑤ 🔔 \'자재 입고 문제 1건\', 현장 칸 \'· 문제 1건\'·[✅ 해결], 저장본 불변 · 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const alert = briefExtraItems().filter(x => x.action === 'matdue').map(x => x.t);
      state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const head = document.querySelector('#view [data-pjmat] .cust-h').textContent;
      const rows = [...document.querySelectorAll('#view [data-pjmatrow]')].map(x => x.dataset.pjmatrow);
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const same = snap() === b0;
      document.querySelector('#view [data-matfix="m2"]').click();
      const done = state.projects[0].matOrders[1].issueDone, head2 = document.querySelector('#view [data-pjmat] .cust-h').textContent;
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { alert, head, rows, w, same, done, head2 };
    });
    assert(JSON.stringify(r.alert) === JSON.stringify(['자재 입고 문제 1건', '납품 확인 1건']), '알림: ' + JSON.stringify(r.alert));
    assert(/기다림 1건 · 문제 1건 · 입고 2건/.test(r.head) && JSON.stringify(r.rows) === JSON.stringify(['m2', 'm1']), '현장 칸: ' + JSON.stringify(r));
    assert(r.same && r.w <= 0, '저장본·넘침: ' + JSON.stringify(r));
    assert(r.done === '2026-11-05' && /기다림 1건 · 입고 3건/.test(r.head2), '해결: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== matissue-v372: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

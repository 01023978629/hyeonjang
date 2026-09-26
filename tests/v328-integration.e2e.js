/* v328-integration.e2e.js — v328 통합(열 갈래를 합친 것)에서 '합쳐서 생긴' 결함 (Playwright)

   2026-09-26 v328 통합 반박 검토에서 확인된 것 중, 다른 검사 파일에 자리가 없는 것을 여기서 지킨다.
   (① 청구서·명세서 두 번 청구는 extras-settle ⑬, ② 견적에 담기 부가세는 extras-settle ⑨·extra-work ⑥,
    ④ 전체장부 추가공사는 ledger-roundtrip ⑦, 지운 비밀키 되살아남은 portal-key ⑤b 가 지킨다)
     ③ 현장명 변경 뒤 수금 약속일 일정 — id·제목이 새 이름으로 옮겨 가 약속일을 고치거나 지워도 알림이 둘이 되지 않는다.
        이름 변경 전에 남은 옛 'due_옛이름' 알림도 upsertDueSchedule 이 같이 걷는다
     ⑤ 이름을 바꾼 뒤 옛 이름으로 「선택 복원」 — 관리사무소 식별자가 같은 현장이 둘 생기지 않는다(그 현장은 건너뛰고 알린다),
        있는 현장에 덮을 때 식별자는 지금 값을 지킨다, 식별자가 이미 겹친 자료에서도 삭제가 남의 오더를 가져가지 않는다
     ⑥ 지운 뒤 「선택 복원」 — '(삭제됨) 이름 · 날짜' 로 옮겨 둔 수금·AS·견적이 돌아온다(매출이 0 으로 남지 않는다).
        그런 이름이 여러 벌이면 건드리지 않고 알린다
     ⑦ 추가공사 화면 — 위에 붙는 요약이 360px 에서 키보드가 올라와도(높이 420) 치고 있는 금액 칸을 덮지 않는다(설명·경고는
        그 아래 #exNote 로, 내용은 그대로). 사진 없음·견적에 담김 표시는 버튼 아래 한 줄
     ⑧ 분할납 계획 — 잔금은 나머지(셋의 합 = 견적 금액), 확인받은 추가공사는 잔금에 더한다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const ID = 'office-project-abc1234';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjRenameProjectRefs === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const clickRestore = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click());
  const waitToast = (re) => page.waitForFunction(r => window.__toasts.some(t => new RegExp(r).test(t)), re.source);

  // ③ 수금 약속일 일정 — 이름 변경
  const due = await page.evaluate(() => {
    state.projects = [{ name: '가상수금A', stage: 2, received: 0, phases: [], cost: {}, dueDate: '2026-10-01' }];
    state.schedule = []; state.files = []; state.quotes = []; state.payLog = []; state.asLog = []; state.aptOrders = [];
    const p = state.projects[0];
    upsertDueSchedule(p);
    hjRenameProjectRefs('가상수금A', '가상수금B');
    const r = { afterRename: state.schedule.map(s => [s.id, s.title, s.project, s.date]) };
    p.dueDate = '2026-10-05'; upsertDueSchedule(p);
    r.afterMove = state.schedule.map(s => [s.id, s.title, s.date]);
    p.dueDate = null; upsertDueSchedule(p);
    r.afterClear = state.schedule.length;
    // 옛 버전에서 이름을 바꿔 이미 남은 떠돌이 알림(id 는 옛 이름, project 는 새 이름) — 약속일을 저장하면 같이 걷는다
    state.schedule = [{ id: 'due_옛이름', date: '2026-09-30', time: '', title: '💰 수금: 옛이름', project: '가상수금B', workers: '', memo: '', hours: 0 },
      { id: 'sch-keep', date: '2026-09-30', time: '', title: '타일 작업', project: '가상수금B' }];
    p.dueDate = '2026-10-07'; upsertDueSchedule(p);
    r.legacy = state.schedule.map(s => s.id).sort();
    return r;
  });
  assert(JSON.stringify(due.afterRename) === JSON.stringify([['due_가상수금B', '💰 수금: 가상수금B', '가상수금B', '2026-10-01']]),
    '③ 이름 변경 뒤 수금 알림 id·제목이 새 이름: ' + JSON.stringify(due.afterRename));
  assert(due.afterMove.length === 1 && due.afterMove[0][2] === '2026-10-05', '③ 약속일을 옮기면 알림이 하나: ' + JSON.stringify(due.afterMove));
  assert(due.afterClear === 0, '③ 약속일을 지우면 알림이 없다: ' + due.afterClear);
  assert(JSON.stringify(due.legacy) === JSON.stringify(['due_가상수금B', 'sch-keep']), '③ 옛 떠돌이 수금 알림은 걷고 다른 일정은 둔다: ' + JSON.stringify(due.legacy));

  // ⑤ 이름 변경 뒤 옛 이름으로 선택 복원 — 식별자가 같은 현장 둘 금지
  await page.evaluate(({ ID }) => {
    state.projects = [{ name: '가상식별A', stage: 2, received: 0, phases: [], cost: {}, officeIntakeProjectId: ID }];
    state.files = [{ id: 'fa1', name: '가상식별사진.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: '가상식별A', handle: null, size: 10, text: '', ocr: 'na' }];
    state.schedule = []; state.quotes = []; state.asLog = [];
    state.payLog = [{ d: '2026-09-03', project: '가상식별A', amt: 100000 }];
    state.aptOrders = [{ id: 'ao1', project: '가상식별A', projectIdentity: ID, status: 'recv' }];
    window.__backups = [{ name: '현장_20260920120000.json', handle: null, data: JSON.parse(JSON.stringify(serializeData())) }];
    hjRenameProjectRefs('가상식별A', '가상식별B');
    window.__toasts = [];
    restoreSelect(0);
  }, { ID });
  await clickRestore();
  await waitToast(/이름이 바뀐 같은 현장/);
  const twin = await page.evaluate(() => ({ projects: state.projects.map(p => [p.name, p.officeIntakeProjectId || '']), files: state.files.map(f => f.project),
    orders: state.aptOrders.map(o => o.project), pay: state.payLog.map(x => x.project), t: window.__toasts.join(' | ') }));
  assert(JSON.stringify(twin.projects) === JSON.stringify([['가상식별B', ID]]) && JSON.stringify(twin.files) === '["가상식별B"]'
    && JSON.stringify(twin.orders) === '["가상식별B"]' && JSON.stringify(twin.pay) === '["가상식별B"]',
    '⑤ 이름만 바뀐 같은 현장을 옛 이름으로 또 만들지 않고 기록도 가르지 않는다: ' + JSON.stringify(twin));
  assert(/「가상식별A」 은 지금 「가상식별B」 로 이름이 바뀐 같은 현장/.test(twin.t), '⑤ 왜 건너뛰었는지 알린다: ' + twin.t);

  // ⑤' 있는 현장에 덮을 때 식별자는 지금 값 그대로(보관 여부와 같은 운영 사실)
  const keep = await page.evaluate(() => {
    const bk = JSON.parse(JSON.stringify(serializeData()));
    bk.projects[0].officeIntakeProjectId = 'office-project-old0001';
    bk.projects[0].stage = 1;
    window.__backups = [{ name: '현장_20260921120000.json', handle: null, data: bk }];
    window.__toasts = [];
    restoreSelect(0);
    return true;
  });
  assert(keep);
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const kept = await page.evaluate(() => state.projects.map(p => [p.name, p.officeIntakeProjectId, p.stage]));
  assert(JSON.stringify(kept) === JSON.stringify([['가상식별B', ID, 1]]), '⑤ 덮어도 식별자는 지금 값: ' + JSON.stringify(kept));

  // ⑤'' 이미 식별자가 겹친 자료(옛 버전 복원) — 한쪽을 지워도 다른 현장의 오더를 가져가지 않는다
  const walk = await page.evaluate(({ ID }) => {
    state.projects = [{ name: '가상겹침B', stage: 2, received: 0, phases: [], cost: {}, officeIntakeProjectId: ID },
      { name: '가상겹침A', stage: 2, received: 0, phases: [], cost: {}, officeIntakeProjectId: ID }];
    state.aptOrders = [{ id: 'ob', project: '가상겹침B', projectIdentity: ID, status: 'recv' }, { id: 'oa', project: '가상겹침A', projectIdentity: ID, status: 'recv' }];
    state.files = []; state.payLog = [];
    const r = hjDeleteProjectCore('가상겹침A');
    return { counts: r.counts, orders: state.aptOrders.map(o => [o.id, o.project]) };
  }, { ID });
  assert(walk.orders[0][1] === '가상겹침B' && /^\(삭제됨\) 가상겹침A · /.test(walk.orders[1][1]) && walk.counts.aptOrders === 1,
    '⑤ 식별자가 겹치면 이름으로만 — 남의 오더를 가져가지 않는다: ' + JSON.stringify(walk));

  // ⑥ 지운 뒤 선택 복원 — '(삭제됨)' 으로 옮긴 수금·AS·견적이 돌아온다
  const del = await page.evaluate(() => {
    const NM = '가상복원현장';
    state.projects = [{ name: NM, stage: 3, received: 0, phases: [], cost: {} }];
    state.files = []; state.payLog = [{ d: '2026-09-03', project: NM, amt: 300000 }]; state.aptOrders = [];
    state.asLog = [{ id: 'as1', project: NM, date: '2026-09-04', text: '가상 AS', status: 'open' }];
    state.quotes = [];
    const q = { id: 'qr1', no: 'Q-R', title: '가상복원', date: '2026-09-01', place: '', vatIncluded: false, accountIdx: 0, memo: '', project: NM,
      items: [{ name: '가상 품목', spec: '', qty: 1, price: 1000000 }] };
    state.quotes.push(q); syncQuoteToProject(q);
    const before = projStats(NM);
    window.__backups = [{ name: '현장_20260922120000.json', handle: null, data: JSON.parse(JSON.stringify(serializeData())) }];
    hjDeleteProjectCore(NM);
    window.__toasts = [];
    restoreSelect(0);
    return { est: before.est, recv: before.recv };
  });
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const back = await page.evaluate(() => { const NM = '가상복원현장'; const s = projStats(NM);
    return { est: s.est, recv: s.recv, pay: state.payLog.map(x => x.project), as: state.asLog.map(x => x.project), quotes: state.quotes.map(x => x.project), t: window.__toasts.join(' | ') }; });
  assert(back.est === del.est && back.est === 1000000 && back.recv === del.recv, '⑥ 지운 뒤 선택 복원하면 매출·수금이 돌아온다: ' + JSON.stringify({ back, del }));
  assert(back.pay.concat(back.as, back.quotes).every(n => n === '가상복원현장'), '⑥ 수금·AS·견적이 원래 이름으로: ' + JSON.stringify(back));
  assert(/다시 이었습니다/.test(back.t), '⑥ 다시 이었다고 알린다: ' + back.t);

  // ⑥' '(삭제됨)' 이름이 두 벌이면 잇지 않고 알린다
  await page.evaluate(() => {
    const NM = '가상두벌현장';
    state.projects = []; state.quotes = []; state.files = []; state.asLog = [];
    state.payLog = [{ d: '2026-09-01', project: '(삭제됨) ' + NM + ' · 2026-09-10', amt: 1 }, { d: '2026-09-02', project: '(삭제됨) ' + NM + ' · 2026-09-20', amt: 2 }];
    window.__backups = [{ name: '현장_20260923120000.json', handle: null, data: { projects: [{ name: NM, stage: 1, received: 0, phases: [], cost: {} }], files: [] } }];
    window.__toasts = [];
    restoreSelect(0);
  });
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const two = await page.evaluate(() => ({ pay: state.payLog.map(x => x.project), t: window.__toasts.join(' | ') }));
  assert(two.pay.every(n => /^\(삭제됨\)/.test(n)) && /여러 벌이라 자동으로 잇지 않았습니다/.test(two.t), '⑥ 여러 벌이면 건드리지 않는다: ' + JSON.stringify(two));

  // ⑦ 추가공사 화면 360×420(키보드가 올라온 높이) — 위에 붙는 요약이 금액 칸을 덮지 않는다
  await page.evaluate(() => {
    const NM = '가상화면현장';
    state.projects = [{ name: NM, stage: 2, received: 0, phases: [], cost: {}, extras: [
      { id: 'q1', date: '2026-09-02', text: '거실 선반', amount: '500000', days: '', photo: 'k:없는/사진1.jpg|1', agreed: true },
      { id: 'p1', date: '2026-09-03', text: '현관 중문', amount: '300000', days: '', photo: 'k:없는/사진2.jpg|2', agreed: false },
      { id: 'n1', date: '2026-09-04', text: '콘센트', amount: '', days: '', photo: '', agreed: true }] }];
    state.files = []; state.payLog = []; state.asLog = []; state.aptOrders = [];
    const q = { id: 'qs1', no: 'Q-S', title: '가상화면', date: '2026-09-01', place: '', vatIncluded: false, accountIdx: 0, memo: '', project: NM,
      items: [{ name: '도배', spec: '', qty: 1, price: 3000000 }, { name: '[추가] 거실 선반', spec: '', qty: 1, price: 500000, extraId: 'q1' }] };
    state.quotes = [q]; syncQuoteToProject(q);
    extraWork(NM);
  });
  await page.setViewportSize({ width: 360, height: 420 });
  const cover = await page.evaluate(() => {
    const top = document.querySelector('#exTop').getBoundingClientRect();
    const res = [...document.querySelectorAll('#modalRoot .exIn[data-k="amount"]')].map(el => {
      el.focus(); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit === el;
    });
    const ov = [document.documentElement, document.querySelector('#exSum'), ...document.querySelectorAll('#modalRoot .exRow')].map(e => e.scrollWidth - e.clientWidth);
    return { h: Math.round(top.height), res, ov, note: (document.querySelector('#exNote') || {}).textContent || '',
      marks: [...document.querySelectorAll('#modalRoot .exRow')].map(r => { const m = r.querySelector('.exMarks'); return m ? m.textContent : ''; }),
      dateH: Math.round(document.querySelector('#modalRoot .exRow span').getBoundingClientRect().height),
      marksH: Math.round(document.querySelector('#modalRoot .exRow .exMarks').getBoundingClientRect().height),
      marksBelow: (() => { const r = document.querySelector('#modalRoot .exRow'); const m = r.querySelector('.exMarks').getBoundingClientRect(), b = r.querySelector('.exAgree').getBoundingClientRect(); return m.top >= b.bottom - 1; })() };
  });
  assert(cover.res.every(Boolean), '⑦ 360×420 에서 금액 칸이 위 요약에 덮인다: ' + JSON.stringify(cover));
  assert(cover.ov.every(v => v <= 0), '⑦ 360px 가로 넘침: ' + JSON.stringify(cover.ov));
  assert(cover.h <= 190, '⑦ 위에 붙는 요약 높이 ' + cover.h + 'px — 설명·경고는 그 아래로');
  assert(/견적에 담긴 1건/.test(cover.note) && /청구에 포함되지 않은 추가공사/.test(cover.note) && /사진을 찾을 수 없음 2장/.test(cover.note), '⑦ 설명·경고 내용은 그대로: ' + cover.note);
  assert(/사진을 찾을 수 없음/.test(cover.marks[0]) && /견적에 담김/.test(cover.marks[0]) && cover.dateH <= 20 && cover.marksH <= 20 && cover.marksBelow, '⑦ 표시는 버튼 아래 한 줄, 날짜 칸은 한 줄: ' + JSON.stringify(cover));
  await page.evaluate(() => closeModal(true));
  await page.setViewportSize({ width: 360, height: 740 });

  // ⑧ 분할납 — 잔금은 나머지, 추가공사는 잔금에
  const plan = await page.evaluate(() => {
    const NM = '가상분할현장';
    state.projects = [{ name: NM, stage: 2, received: 0, phases: [], cost: {}, extras: [{ id: 'e1', date: '2026-09-02', text: '선반', amount: '500000', agreed: true }] }];
    state.files = [{ id: 'xs1', name: '가상분할 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: NM, est: { amount: 1000005 } }];
    state.quotes = []; state.schedule = [];
    const oMan = window.hjMan; window.hjMan = n => String(n);   // 만 단위로 뭉개지 않고 정확한 금액을 본다
    try {
      payPlanDialog(NM);
      ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = '2026-10-1' + (i + 1); });
      const a3 = document.getElementById('ppA3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /예약 저장/.test(b.textContent)).click();
      return { a3, titles: state.schedule.map(s => s.title), memos: state.schedule.map(s => s.memo), due: projStats(NM).due };
    } finally { window.hjMan = oMan; }
  });
  // 50/40/10 — 계약금 500,003(반올림) · 중도금 400,002 · 잔금은 나머지 100,000 + 추가공사 500,000
  // (각자 반올림하던 예전에는 잔금 100,001 — 셋의 합이 견적보다 1원 많았다)
  assert(JSON.stringify(plan.titles) === JSON.stringify(['💰 계약금 500003', '💰 중도금 400002', '💰 잔금 600000']), '⑧ 잔금은 나머지 + 추가공사: ' + JSON.stringify(plan));
  assert(500003 + 400002 + 600000 === plan.due, '⑧ 세 알림의 합 = 잔금(due): ' + plan.due);
  assert(/추가공사/.test(plan.memos[2]) && /추가공사 500000 포함/.test(plan.a3), '⑧ 잔금에 추가공사가 들어 있다고 적는다: ' + JSON.stringify(plan));

  // ⑧b 잔금 0% — 추가공사를 0이 아닌 마지막 회차(중도금)에 더한다. 예전엔 잔금 알림이 안 만들어져 추가공사가 어디에도 없었다(v328 재검토).
  const plan0 = await page.evaluate(() => {
    const NM = '가상분할현장'; state.schedule = [];
    const oMan = window.hjMan; window.hjMan = n => String(n);
    try {
      payPlanDialog(NM);
      const set = (id, v) => { const r = document.getElementById(id); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); };
      set('ppR1', 50); set('ppR2', 50); set('ppR3', 0);
      ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = '2026-10-1' + (i + 1); });
      const a2 = document.getElementById('ppA2').textContent, a3 = document.getElementById('ppA3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /예약 저장/.test(b.textContent)).click();
      return { a2, a3, titles: state.schedule.map(s => s.title), memos: state.schedule.map(s => s.memo), due: projStats(NM).due };
    } finally { window.hjMan = oMan; }
  });
  // 50/50/0 — 계약금 500,003(반올림) · 중도금은 나머지 500,002 + 추가공사 500,000. 합 = due(예전엔 잔금 칸에 '-1' 이 나오고 합이 1원 많았다)
  assert(JSON.stringify(plan0.titles) === JSON.stringify(['💰 계약금 500003', '💰 중도금 1000002']), '⑧b 잔금 0% 면 나머지·추가공사는 중도금에: ' + JSON.stringify(plan0));
  assert(500003 + 1000002 === plan0.due && plan0.a3 === '0', '⑧b 두 알림의 합 = due, 잔금 칸 0: ' + JSON.stringify(plan0));
  assert(/추가공사/.test(plan0.memos[1]) && /추가공사 500000 포함/.test(plan0.a2) && !/추가공사/.test(plan0.a3), '⑧b 어디에 더했는지 적는다: ' + JSON.stringify(plan0));

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('v328-integration.e2e OK (③ 수금 알림 이름 변경 ⑤ 선택 복원 식별자 ⑥ 삭제 뒤 복원 ⑦ 추가공사 360px ⑧ 분할납 ⑧b 잔금 0%)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });

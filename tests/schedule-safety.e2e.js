/* schedule-safety.e2e.js — 일정 결함 8건(v330 발굴 검토) (Playwright)

   2026-09-26 발굴 검토에서 살아남은 일정 결함을 고치고 못박는다.
     ① 일정 수정(saveScheduleEdit)은 기존 레코드에 폼 칸만 덮는다 — 작업 보고·일당·준비물 체크·AS 연결·ics 식별자·
        세금 표식이 남고, 0시간 일정은 0시간 그대로(예전에는 새 객체로 갈아 끼워 다 지워지고 8시간이 됐다)
     ② 자동 세금 일정은 한 번만 넣는다 — 지운 것은 다음 부팅에 되살아나지 않고, 메모를 고쳐도 하나 더 생기지 않는다(안정 id)
     ③ 출발 전 챙김: 종류가 안 잡히는 일정에서 넣은 준비물이 '기타' 목록으로 다시 나온다
     ④ 출발 전 챙김: 종류가 둘인 일정에서 ✕ 는 그 항목이 든 모든 종류에서 빼고, 안 바뀐 종류는 저장하지 않는다
     ⑤ 분할납 [💾 예약 저장]을 다시 누르면 앞으로 올 회차를 갈아 끼운다(두 벌이 되지 않는다), 지난 회차는 그대로
     ⑥ 날짜가 빈 일정은 저장하지 않는다(칸에 표시) — 'NaN.NaN.NaN' 머리가 생기지 않는다
     ⑦ 분할납 비율 합이 100% 가 아니면 저장·입금안내 문자를 막는다(칸에 표시)
     ⑧ 인건비 장부 [지출 반영]은 그 달이 아니라 현장 전체 기간 일당 합계로 반영한다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone);
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]).catch(() => {}));
  await page.waitForFunction(() => typeof window.saveScheduleEdit === 'function' && typeof window.taxCalendarEnsure === 'function' && typeof window.payPlanDialog === 'function');
  // 부팅 시더를 재운다(시나리오 한복판에 자료를 심는다). 진짜 세금 시더는 따로 쥐고 ②에서 직접 부른다.
  await page.evaluate(() => {
    window.__taxEnsure = window.taxCalendarEnsure;
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const clickFoot = async (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) throw new Error('버튼 없음 ' + src); b.click(); }, re);

  // ── ① 수정은 덮기 ──
  await page.evaluate(() => {
    const today = localDate();
    state.projects = [{ name: '가상일정현장', stage: 2, received: 0, phases: [], cost: {} }];
    state.files = []; state.quotes = []; state.payLog = []; state.asLog = [];
    state.schedule = [{ id: 'k1', date: today, time: '09:00', title: '욕실 타일 시공', project: '가상일정현장', workers: '2', memo: '', hours: 0,
      report: { done: '타일 붙임', filledAt: today }, labor: { amount: 250000, names: '가상작업자' }, prep: { '타일': true },
      asId: 'as-가상', icsUid: 'ics-가상-1', _taxAuto: false }];
    state.dirty = false;
  });
  const ym = await page.evaluate(() => localDate().slice(0, 7));
  const before = await page.evaluate((ym) => laborLedgerData(ym).total, ym);
  await page.evaluate(() => openScheduleEdit('k1'));
  await page.waitForSelector('#modalRoot #schTime');
  assert(await page.evaluate(() => document.getElementById('schHours').value) === '0', '① 0시간 일정의 시간 칸은 0 으로 보인다(예전엔 8)');
  await page.evaluate(() => { document.getElementById('schTime').value = '10:00'; });
  await clickFoot('^저장$');
  const k1 = await page.evaluate(() => { const s = state.schedule.find(x => x.id === 'k1'); return { s: JSON.parse(JSON.stringify(s)), n: state.schedule.length }; });
  assert(k1.n === 1 && k1.s.time === '10:00', '① 고친 칸이 반영된다: ' + JSON.stringify(k1));
  assert(k1.s.report && k1.s.report.done === '타일 붙임', '① 작업 보고가 남는다: ' + JSON.stringify(k1.s));
  assert(k1.s.labor && k1.s.labor.amount === 250000, '① 일당이 남는다: ' + JSON.stringify(k1.s));
  assert(k1.s.prep && k1.s.prep['타일'] === true, '① 준비물 체크가 남는다');
  assert(k1.s.asId === 'as-가상' && k1.s.icsUid === 'ics-가상-1', '① AS 연결·ics 식별자가 남는다: ' + JSON.stringify(k1.s));
  assert(k1.s.hours === 0, '① 0시간 일정은 0시간 그대로: ' + k1.s.hours);
  assert(await page.evaluate((ym) => laborLedgerData(ym).total, ym) === before && before === 250000, '① 인건비 장부 합계가 그대로');
  // 시간 칸을 비우면 기존 값을 쓴다(0 을 8 로 만들지 않는다), 새 일정은 8
  await page.evaluate(() => openScheduleEdit('k1'));
  await page.waitForSelector('#modalRoot #schHours');
  await page.evaluate(() => { document.getElementById('schHours').value = ''; document.getElementById('schMemo').value = '메모만 고침'; });
  await clickFoot('^저장$');
  assert(await page.evaluate(() => state.schedule.find(x => x.id === 'k1').hours) === 0, '① 시간 칸이 비면 기존 시간');

  // ── ⑥ 날짜가 빈 일정은 저장하지 않는다 ──
  await page.evaluate(() => openScheduleEdit('k1'));
  await page.waitForSelector('#modalRoot #schDate');
  await page.evaluate(() => { document.getElementById('schDate').value = ''; document.getElementById('schTitle').value = '제목 바꿈'; });
  await clickFoot('^저장$');
  const d6 = await page.evaluate(() => ({ s: state.schedule.find(x => x.id === 'k1'), inv: (document.getElementById('schDate') || {}).getAttribute && document.getElementById('schDate').getAttribute('aria-invalid'), open: !!document.querySelector('#modalRoot #schDate') }));
  assert(d6.open && d6.inv === 'true', '⑥ 날짜 칸에 표시하고 창을 닫지 않는다: ' + JSON.stringify(d6));
  assert(d6.s.date && d6.s.title === '욕실 타일 시공', '⑥ 기존 일정을 건드리지 않는다: ' + JSON.stringify(d6.s));
  assert(/날짜/.test(await lastToast()), '⑥ 토스트로도 말한다');
  await page.evaluate(() => closeModal());
  await page.evaluate(() => openScheduleEdit());
  await page.waitForSelector('#modalRoot #schDate');
  await page.evaluate(() => { document.getElementById('schDate').value = ''; document.getElementById('schTitle').value = '날짜 없는 새 일정'; });
  await clickFoot('^저장$');
  assert(await page.evaluate(() => !state.schedule.some(x => x.title === '날짜 없는 새 일정')), '⑥ 날짜 없는 새 일정은 들어가지 않는다');
  await page.evaluate(() => closeModal());
  const noNaN = await page.evaluate(() => { state.tab = 'schedule'; render(); return !/NaN/.test((document.getElementById('view') || document.body).innerText); });
  assert(noNaN, '⑥ 일정표에 NaN 이 없다');

  // ── ② 세금 일정 ──
  const t2 = await page.evaluate(() => {
    state.schedule = []; state.calendarImports = [];
    const a1 = window.__taxEnsure();
    const ids = state.schedule.map(s => s.id);
    const first = state.schedule[0];
    const n1 = state.schedule.length;
    // 하나를 지운다 → 다시 불러도 되살아나지 않는다
    state.schedule = state.schedule.filter(s => s !== first);
    const a2 = window.__taxEnsure();
    return { a1, n1, ids, firstId: first.id, a2, back: state.schedule.some(s => s.id === first.id), n2: state.schedule.length };
  });
  assert(t2.a1 > 0 && t2.n1 === t2.a1 && t2.ids.every(id => /^tax_\d{4}-\d{2}-\d{2}_[a-z0-9]+$/.test(id)), '② 안정 id 로 넣는다: ' + JSON.stringify(t2));
  assert(new Set(t2.ids).size === t2.ids.length, '② id 가 겹치지 않는다');
  assert(t2.a2 === 0 && !t2.back && t2.n2 === t2.n1 - 1, '② 지운 세금 일정은 되살아나지 않는다: ' + JSON.stringify(t2));
  // 메모를 고쳐 저장해도(수정 화면) 다음 부팅에 하나 더 생기지 않는다
  const second = await page.evaluate(() => state.schedule[0].id);
  await page.evaluate((id) => openScheduleEdit(id), second);
  await page.waitForSelector('#modalRoot #schMemo');
  await page.evaluate(() => { document.getElementById('schMemo').value = '세무사 전화'; });
  await clickFoot('^저장$');
  const t2b = await page.evaluate((id) => { const s = state.schedule.find(x => x.id === id); const n = state.schedule.length; const a = window.__taxEnsure(); return { tax: s._taxAuto, memo: s.memo, a, same: state.schedule.filter(x => x.date === s.date && x.title === s.title).length, n0: n, n1: state.schedule.length }; }, second);
  assert(t2b.tax === true && t2b.memo === '세무사 전화' && t2b.a === 0 && t2b.same === 1 && t2b.n1 === t2b.n0, '② 메모를 고친 세금 일정 옆에 하나 더 생기지 않는다: ' + JSON.stringify(t2b));
  // v329 까지 넣은 일정(표식 없음·옛 id)은 같은 날짜·제목이면 같은 일정으로 보고 넣지 않는다
  const t2c = await page.evaluate(() => {
    const it = taxCalendarItems()[0];
    state.schedule = [{ id: 'legacy1', date: it.date, time: '09:00', title: it.title, project: '', workers: '', memo: '옛 기록', hours: 8, report: null }];
    state.calendarImports = [];
    const a = window.__taxEnsure();
    return { a, dup: state.schedule.filter(x => x.date === it.date && x.title === it.title).length, marks: state.calendarImports.filter(x => /^tax:/.test(x)).length, items: taxCalendarItems().length };
  });
  assert(t2c.dup === 1 && t2c.a === t2c.items - 1 && t2c.marks === t2c.items, '② 옛 세금 일정과 겹치지 않는다: ' + JSON.stringify(t2c));
  const keys = await page.evaluate(() => Object.keys(serializeData()).length);
  assert(keys === 41, '② serializeData 최상위 키 41개 그대로: ' + keys);

  // ── ③ 기타 목록 ──
  await page.evaluate(() => {
    try { localStorage.removeItem('hj_prep_sets'); } catch (e) {}
    const today = localDate();
    state.schedule = [{ id: 'p1', date: today, time: '09:00', title: '현관 방충망 교체', project: '' },
                      { id: 'p2', date: today, time: '11:00', title: '문짝 경첩 수리', project: '' },
                      { id: 'p3', date: today, time: '13:00', title: '욕실 타일 방수', project: '' },
                      { id: 'p4', date: today, time: '09:00', title: '부가세 예정고지 납부', project: '', _taxAuto: true }];
    prepCheck('p1');
  });
  await page.waitForSelector('#modalRoot #prepNew');
  await page.fill('#prepNew', '방충망 롤');
  await page.click('#prepAdd');
  const p3 = await page.evaluate(() => ({ chk: [...document.querySelectorAll('#modalRoot .prepChk')].map(c => c.dataset.x), other: hjPrepFor(state.schedule.find(s => s.id === 'p2'), null), tax: hjPrepFor(state.schedule.find(s => s.id === 'p4'), null), saved: JSON.parse(localStorage.getItem('hj_prep_sets') || '{}') }));
  assert(p3.chk.includes('방충망 롤'), '③ 넣은 준비물이 체크 칸으로 다시 나온다: ' + JSON.stringify(p3));
  assert(p3.other.items.includes('방충망 롤') && p3.other.kinds.join() === '기타', '③ 종류가 안 잡히는 다른 일정에도 기타 목록: ' + JSON.stringify(p3.other));
  assert(p3.tax.items.length === 0, '③ 세금 일정에는 기타 목록을 붙이지 않는다: ' + JSON.stringify(p3.tax));
  assert(JSON.stringify(p3.saved) === JSON.stringify({ '기타': ['방충망 롤'] }), '③ 이 폰 저장: ' + JSON.stringify(p3.saved));
  await page.click('#modalRoot .prepChk[data-x="방충망 롤"]');
  assert(await page.evaluate(() => state.schedule.find(s => s.id === 'p1').prep['방충망 롤'] === true), '③ 체크가 일정에 남는다');
  // 세금 일정에서 넣으면 '넣었습니다' 라고 해 놓고 안 보이는 같은 함정 — 넣지 않고 그렇다고 말한다
  await page.evaluate(() => prepCheck('p4'));
  await page.waitForSelector('#modalRoot #prepNew');
  await page.fill('#prepNew', '세금용 물건');
  await page.click('#prepAdd');
  const p3t = await page.evaluate(() => JSON.parse(localStorage.getItem('hj_prep_sets') || '{}'));
  assert(JSON.stringify(p3t) === JSON.stringify({ '기타': ['방충망 롤'] }) && /세금/.test(await lastToast()), '③ 세금 일정에는 넣지 않는다: ' + JSON.stringify(p3t) + ' ' + await lastToast());

  // ── ④ 두 종류에서 빼기 ──
  await page.evaluate(() => prepCheck('p3'));
  await page.waitForSelector('#modalRoot .prepDel[data-x="방수제"]');
  await page.click('#modalRoot .prepDel[data-x="방수제"]');
  const p4 = await page.evaluate(() => ({ chk: [...document.querySelectorAll('#modalRoot .prepChk')].map(c => c.dataset.x), saved: JSON.parse(localStorage.getItem('hj_prep_sets') || '{}') }));
  assert(!p4.chk.includes('방수제'), '④ 둘째 종류(누수)의 항목이 빠진다: ' + JSON.stringify(p4.chk));
  assert(!('타일' in p4.saved) && Array.isArray(p4.saved['누수']) && !p4.saved['누수'].includes('방수제'), '④ 안 바뀐 종류(타일)는 저장하지 않는다: ' + JSON.stringify(p4.saved));
  await page.click('#modalRoot .prepDel[data-x="실리콘·건"]');
  const p4b = await page.evaluate(() => ({ chk: [...document.querySelectorAll('#modalRoot .prepChk')].map(c => c.dataset.x), saved: JSON.parse(localStorage.getItem('hj_prep_sets') || '{}') }));
  assert(!p4b.chk.includes('실리콘·건') && !p4b.saved['타일'].includes('실리콘·건') && !p4b.saved['누수'].includes('실리콘·건'), '④ 두 종류에 겹친 항목도 빠진다: ' + JSON.stringify(p4b));
  assert(/타일·누수/.test(await lastToast()), '④ 어느 목록에서 뺐는지 말한다: ' + await lastToast());
  await page.evaluate(() => closeModal());

  // ── ⑤ ⑦ 분할납 ──
  const plan = await page.evaluate(async () => {
    const NM = '가상분할현장2';
    const add = n => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };
    state.projects = [{ name: NM, stage: 2, received: 0, phases: [], cost: {}, customer: { name: '가상고객', phone: '010-0000-1234' } }];
    state.files = [{ id: 'xs2', name: '가상 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: NM, est: { amount: 10000000 } }];
    state.quotes = []; state.payLog = [];
    // 지난 회차(받았든 밀렸든 기록) — v329 모양 그대로(표식 없음)
    state.schedule = [{ id: 'old-past', date: add(-3), time: '', title: '💰 계약금 500만', project: NM, workers: '', hours: 0, memo: NM + ' 계약금(50%) 입금 예정', report: null }];
    window.hjMan = n => String(n);
    const sms = []; window.hjSendSms = (to, body) => { sms.push(body); };
    const R = {};
    const setR = (id, v) => { const r = document.getElementById(id); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); };
    const save = () => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /예약 저장/.test(b.textContent)).click();
    const smsBtn = () => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입금안내/.test(b.textContent)).click();
    const mine = () => state.schedule.filter(s => s.project === NM).map(s => ({ id: s.id, date: s.date, title: s.title, payPlan: s.payPlan || '' }));
    payPlanDialog(NM);
    // ⑦ 60/40/10 = 110% → 저장·문자 모두 막는다
    setR('ppR1', 60);
    ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = add(10 + i); });
    save();
    R.blocked = { list: mine(), inv: document.getElementById('ppR1').getAttribute('aria-invalid'), open: !!document.getElementById('ppR1'), toast: window.__toasts[window.__toasts.length - 1] };
    smsBtn();
    R.smsBlocked = sms.length;
    // 100% 로 맞추면 저장된다
    setR('ppR1', 50);
    smsBtn(); R.smsOk = sms.length;
    ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = add(10 + i); });
    save();
    R.first = mine();
    // ⑤ 다시 열면 앞으로 올 회차 날짜가 미리 채워지고, 30/60/10 으로 다시 저장하면 갈아 끼운다
    payPlanDialog(NM);
    R.prefill = ['ppD1', 'ppD2', 'ppD3'].map(id => document.getElementById(id).value);
    R.oldLine = (document.getElementById('ppOld') || {}).textContent || '';
    setR('ppR1', 30); setR('ppR2', 60);
    save();
    R.second = mine();
    // 같은 비율로 한 번 더 — 여전히 세 벌 아닌 한 벌
    payPlanDialog(NM);
    R.prefillR = ['ppR1', 'ppR2', 'ppR3'].map(id => document.getElementById(id).value);
    save();
    R.third = mine();
    closeModal();
    return R;
  });
  assert(plan.blocked.list.length === 1 && plan.blocked.open && plan.blocked.inv === 'true' && /100%/.test(plan.blocked.toast), '⑦ 합계 110% 면 저장하지 않고 칸에 표시: ' + JSON.stringify(plan.blocked));
  assert(plan.smsBlocked === 0 && plan.smsOk === 1, '⑦ 합계가 100% 가 아니면 입금안내 문자도 막는다: ' + JSON.stringify(plan));
  const fut = l => l.filter(x => x.id !== 'old-past');
  assert(fut(plan.first).map(x => x.title).join('|') === '💰 계약금 5000000|💰 중도금 4000000|💰 잔금 1000000', '⑤ 첫 예약: ' + JSON.stringify(plan.first));
  assert(plan.prefill.every(Boolean) && /지난 회차/.test(plan.oldLine) && /바뀜/.test(plan.oldLine), '⑤ 다시 열면 날짜가 채워지고 기존 예약을 보여 준다: ' + JSON.stringify(plan));
  assert(fut(plan.second).map(x => x.title).join('|') === '💰 계약금 3000000|💰 중도금 6000000|💰 잔금 1000000', '⑤ 다시 저장하면 두 벌이 아니라 갈아 끼운다: ' + JSON.stringify(plan.second));
  assert(plan.second.some(x => x.id === 'old-past') && plan.third.some(x => x.id === 'old-past'), '⑤ 지난 회차는 건드리지 않는다');
  assert(plan.prefillR.join('/') === '30/60/10' && fut(plan.third).length === 3, '⑤ 비율도 이어받고, 또 저장해도 한 벌: ' + JSON.stringify(plan));
  assert(fut(plan.third).every(x => ['down', 'mid', 'bal'].includes(x.payPlan)), '⑤ 회차 표식이 붙는다');

  // ── ⑧ 인건비 장부 — 두 달에 걸친 현장 ──
  const lab = await page.evaluate(async () => {
    const NM = '가상두달현장';
    state.projects = [{ name: NM, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 } }];
    state.schedule = [
      { id: 'l1', date: '2026-08-25', time: '09:00', title: '철거', project: NM, hours: 8, labor: { amount: 300000 } },
      { id: 'l2', date: '2026-08-28', time: '09:00', title: '목공', project: NM, hours: 8, labor: { amount: 200000 } },
      { id: 'l3', date: '2026-09-03', time: '09:00', title: '도배', project: NM, hours: 8, labor: { amount: 150000 } }];
    laborLedger('2026-09');
    document.querySelector('#modalRoot .llApply').click();
    const conf = document.querySelector('#modalRoot').textContent;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /반영/.test(b.textContent)).click();
    const after9 = state.projects[0].cost.labor;
    laborLedger('2026-08');
    document.querySelector('#modalRoot .llApply').click();
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /반영/.test(b.textContent)).click();
    const after8 = state.projects[0].cost.labor;
    closeModal();
    return { conf, after9, after8 };
  });
  assert(lab.after9 === 650000 && lab.after8 === 650000, '⑧ 어느 달에서 눌러도 전체 기간 합계로 반영: ' + JSON.stringify(lab));
  assert(/2026-08/.test(lab.conf) && /2026-09/.test(lab.conf) && /전체 기간/.test(lab.conf), '⑧ 확인 창에 월별 내역: ' + lab.conf);

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('schedule-safety.e2e OK (① 수정은 덮기 ② 세금 일정 한 번만 ③ 기타 목록 ④ 두 종류에서 빼기 ⑤ 분할납 갈아 끼우기 ⑥ 날짜 필수 ⑦ 비율 100% ⑧ 인건비 전체 기간)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

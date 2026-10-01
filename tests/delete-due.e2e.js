/* delete-due.e2e.js — 현장을 지우면 그 현장의 💰 수금 약속일 알림이 일정표에서 빠지고, 선택 복원하면 다시 이어지는지 (Playwright)

   2026-09-26(v330): 수금 약속일 알림은 현장의 dueDate 를 일정표에 비춘 거울이다('due_'+이름, '💰 수금: '+이름 —
   upsertDueSchedule). 예전 삭제(hjDeleteProjectCore)는 일정의 project 만 '' 로 비워 id·제목이 남았다 — 지운 현장의
   '💰 수금: 이름' 이 일정표에 계속 떴다. v328 규칙(기록은 지우지 않는다)과 맞게:
     ① 삭제 확인 창이 수금 약속일 알림을 따로 말하고(날짜·일정표에서 뺀다·선택 복원하면 다시 이어진다), 연결 해제 일정 수에서 뺀다
     ② 사람이 손대지 않은 거울은 일정표에서 빠진다 — 다른 일정은 예전처럼 연결만 풀리고, 수금 기록은 '(삭제됨)' 으로 남는다
     ③ 같은 이름으로 새 현장을 만들어 약속일을 저장해도 알림은 하나(옛 알림이 떠돌지 않는다)
     ④ 「선택 복원」 하면 백업의 dueDate 로 알림이 다시 올라오고 수금 기록도 다시 잇는다
     ⑤ 메모를 적어 둔 수금 알림은 지우지 않고 '(삭제됨) 이름 · 날짜' 로 id·제목·현장까지 옮긴다 — 같은 이름 새 현장의
        약속일 저장이 걷어 가지 않는다. 선택 복원하면 원래 이름으로 돌아오고 메모가 남으며 알림은 하나다
        (옮겨 둔 것이 그 알림 하나뿐이어도 — '(삭제됨)' 찾기 hjProjectTombstonesOf 가 일정도 본다)
     ⑥ AI 삭제(aiDeleteProject)도 같은 함수 — 결과에 수금 알림 처리를 밝힌다
     pageerror 0

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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayBootDone, __hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
    window.__seedDue = (NM, memo) => {
      const S = state;
      S.projects = [{ name: NM, stage: 3, received: 0, phases: [], cost: {}, dueDate: '2026-10-01' }];
      S.files = []; S.quotes = []; S.notes = []; S.asLog = []; S.aptOrders = []; S.editingQuote = null; S.activeProject = null;
      S.schedule = [{ id: 'sc-work', date: '2026-09-28', time: '', title: '가상 타일 작업', project: NM }];
      S.payLog = [{ d: '2026-09-20', project: NM, amt: 300000 }];
      upsertDueSchedule(S.projects[0]);
      if (memo) S.schedule.find(s => s.id === 'due_' + NM).memo = memo;
      window.__backups = [{ name: '현장_20260925120000.json', handle: null, data: JSON.parse(JSON.stringify(serializeData())) }];
    };
    window.__dueOf = (NM) => state.schedule.filter(s => s && (s.id.startsWith('due_') || /^💰/.test(s.title || ''))).map(s => [s.id, s.title, s.project, s.date, s.memo || '']);
  });
  const today = await page.evaluate(() => localDate());
  const clickRestore = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click());
  const waitToast = (re) => page.waitForFunction(r => window.__toasts.some(t => new RegExp(r).test(t)), re.source);

  // ① 확인 창
  const NM = '가상수금현장';
  await page.evaluate(NM => { __seedDue(NM); deleteProject(NM); }, NM);
  const delText = await page.locator('#modalRoot').innerText();
  const dueLine = await page.locator('#delProjDue').innerText();
  assert(/2026-10-01/.test(dueLine) && /일정표에서 뺍니다/.test(dueLine) && /선택 복원/.test(dueLine), '① 확인 창이 수금 알림을 따로 말한다: ' + dueLine);
  assert(/일정 1개/.test(delText), '① 연결 해제 일정 수에서 수금 알림을 뺀다(타일 작업 1개): ' + delText);

  // ② 삭제 — 거울은 빠지고, 다른 일정은 연결만 풀리고, 수금 기록은 (삭제됨) 으로
  await page.locator('#modalRoot .mfoot button', { hasText: '삭제' }).click();
  await page.waitForFunction(NM => !state.projects.some(p => p.name === NM), NM);
  const tomb = '(삭제됨) ' + NM + ' · ' + today;
  const gone = await page.evaluate(NM => ({ due: __dueOf(NM), work: state.schedule.find(s => s.id === 'sc-work'), pay: state.payLog.map(x => x.project) }), NM);
  assert(gone.due.length === 0, '② 지운 현장의 수금 알림이 일정표에 남지 않는다: ' + JSON.stringify(gone.due));
  assert(gone.work && gone.work.project === '', '② 다른 일정은 연결만 해제: ' + JSON.stringify(gone.work));
  assert(JSON.stringify(gone.pay) === JSON.stringify([tomb]), '② 수금 기록은 지우지 않고 (삭제됨) 으로: ' + JSON.stringify(gone.pay));

  // ③ 같은 이름으로 다시 만들어 약속일 저장 — 알림 하나
  const again = await page.evaluate(NM => {
    const p = { name: NM, stage: 0, received: 0, phases: [], cost: {}, dueDate: '2026-11-11' };
    state.projects.push(p); upsertDueSchedule(p);
    const r = __dueOf(NM);
    state.projects = state.projects.filter(x => x !== p); state.schedule = state.schedule.filter(s => s.id !== 'due_' + NM);
    return r;
  }, NM);
  assert(again.length === 1 && again[0][3] === '2026-11-11', '③ 같은 이름 새 현장의 수금 알림은 하나: ' + JSON.stringify(again));

  // ④ 선택 복원 — 알림이 백업의 dueDate 로 다시 올라오고 수금 기록도 돌아온다
  await page.evaluate(() => { window.__toasts = []; restoreSelect(0); });
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const back = await page.evaluate(NM => ({ due: __dueOf(NM), pay: state.payLog.map(x => x.project) }), NM);
  assert(JSON.stringify(back.due) === JSON.stringify([['due_' + NM, '💰 수금: ' + NM, NM, '2026-10-01', '']]), '④ 선택 복원하면 수금 알림이 다시: ' + JSON.stringify(back.due));
  assert(JSON.stringify(back.pay) === JSON.stringify([NM]), '④ 수금 기록도 다시 이어진다: ' + JSON.stringify(back.pay));

  // ⑤ 메모를 적어 둔 수금 알림 — 지우지 않고 (삭제됨) 으로 옮긴다
  const NM2 = '가상메모현장';
  const tomb2 = '(삭제됨) ' + NM2 + ' · ' + today;
  await page.evaluate(NM2 => { __seedDue(NM2, '잔금 통장 확인 — 가상 메모'); deleteProject(NM2); }, NM2);
  const dueLine2 = await page.locator('#delProjDue').innerText();
  assert(/메모가 있어 지우지 않고/.test(dueLine2), '⑤ 메모 있는 알림은 남긴다고 말한다: ' + dueLine2);
  await page.locator('#modalRoot .mfoot button', { hasText: '삭제' }).click();
  await page.waitForFunction(NM2 => !state.projects.some(p => p.name === NM2), NM2);
  const kept = await page.evaluate(NM2 => __dueOf(NM2), NM2);
  assert(JSON.stringify(kept) === JSON.stringify([['due_' + tomb2, '💰 수금: ' + tomb2, tomb2, '2026-10-01', '잔금 통장 확인 — 가상 메모']]),
    '⑤ 메모 있는 알림은 (삭제됨) 이름으로 id·제목·현장까지 옮긴다: ' + JSON.stringify(kept));
  const survive = await page.evaluate(NM2 => {
    const p = { name: NM2, stage: 0, received: 0, phases: [], cost: {}, dueDate: '2026-12-01' };
    state.projects.push(p); upsertDueSchedule(p);
    const r = __dueOf(NM2).map(x => x[0]).sort();
    state.projects = state.projects.filter(x => x !== p); state.schedule = state.schedule.filter(s => s.id !== 'due_' + NM2);
    return r;
  }, NM2);
  assert(JSON.stringify(survive) === JSON.stringify(['due_' + NM2, 'due_' + tomb2].sort()), '⑤ 같은 이름 새 현장의 약속일 저장이 옮겨 둔 메모 알림을 걷지 않는다: ' + JSON.stringify(survive));
  await page.evaluate(() => { window.__toasts = []; restoreSelect(0); });
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const back2 = await page.evaluate(NM2 => ({ due: __dueOf(NM2), pay: state.payLog.map(x => x.project) }), NM2);
  assert(JSON.stringify(back2.due) === JSON.stringify([['due_' + NM2, '💰 수금: ' + NM2, NM2, '2026-10-01', '잔금 통장 확인 — 가상 메모']]),
    '⑤ 선택 복원하면 메모 알림이 원래 이름으로 하나만: ' + JSON.stringify(back2.due));
  assert(JSON.stringify(back2.pay) === JSON.stringify([NM2]), '⑤ 수금 기록도 다시: ' + JSON.stringify(back2.pay));

  // ⑤' 옮겨 둔 것이 메모 알림 하나뿐이어도(수금 기록 없음) 선택 복원이 찾아 잇는다 — '(삭제됨)' 찾기가 일정도 본다
  const NM4 = '가상알림만현장';
  await page.evaluate(NM4 => { __seedDue(NM4, '가상 메모만'); state.payLog = [];
    window.__backups = [{ name: '현장_20260925130000.json', handle: null, data: JSON.parse(JSON.stringify(serializeData())) }];
    hjDeleteProjectCore(NM4); window.__toasts = []; restoreSelect(0); }, NM4);
  await clickRestore();
  await waitToast(/현장을 복원했습니다/);
  const only = await page.evaluate(NM4 => __dueOf(NM4), NM4);
  assert(JSON.stringify(only) === JSON.stringify([['due_' + NM4, '💰 수금: ' + NM4, NM4, '2026-10-01', '가상 메모만']]), "⑤' 메모 알림만 옮겨 둔 현장도 복원하면 이어진다: " + JSON.stringify(only));

  // ⑥ AI 삭제
  const ai = await page.evaluate(() => { const NM3 = '가상AI현장'; __seedDue(NM3); const r = aiDeleteProject(NM3); return { r, due: __dueOf(NM3), work: state.schedule.find(s => s.id === 'sc-work').project }; });
  assert(ai.due.length === 0 && ai.work === '' && ai.r.일정_연결해제 === 1 && /일정표에서 뺌\(2026-10-01\)/.test(ai.r.수금약속일_알림), '⑥ AI 삭제도 같은 규칙: ' + JSON.stringify(ai));

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('PASS  ① 삭제 확인 창이 수금 약속일 알림을 따로 말한다');
  console.log('PASS  ② 지운 현장의 수금 알림은 일정표에서 빠지고, 다른 일정·수금 기록은 예전 규칙대로');
  console.log('PASS  ③ 같은 이름 새 현장의 수금 알림은 하나');
  console.log('PASS  ④ 선택 복원하면 수금 알림·수금 기록이 다시 이어진다');
  console.log('PASS  ⑤ 메모 있는 수금 알림은 (삭제됨) 으로 옮겨 보존, 복원하면 원래 이름으로 하나');
  console.log('PASS  ⑥ AI 삭제도 같은 함수 · pageerror 0');
  await browser.close();
})().catch(async e => { console.error('FAIL ', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });

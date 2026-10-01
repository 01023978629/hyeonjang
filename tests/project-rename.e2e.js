/* project-rename.e2e.js — 현장명 변경·현장 삭제가 이름으로 이어진 기록을 제대로 다루는지 (Playwright)

   이 앱의 기록은 현장을 '이름'으로 가리킨다. 예전 renameProject 는 사진·일정·팀 업무·(식별자 있는) 관리사무소 오더만
   바꿔 수금·AS·견적·지출·작업시간·운행·만족도·메모·할일·자재 계산이 옛 이름에 남았고, 견적은 다음 불러오기 때
   syncQuoteToProject 가 파생 견적 파일까지 옛 이름으로 되돌려 매출에서 빠졌다. 삭제는 그 기록을 고아로 남겨
   같은 이름으로 새 현장을 만들면 옛 수금·AS·견적·지출이 새 현장에 붙었다(AI 삭제 경로는 일정도 안 건드렸다).
   지키는 것:
     ① 이름 변경 확인 창이 실제로 바뀌는 범위(저장소별 건수)를 말한다
     ② 저장소마다 1건씩 심은 기록이 이름 변경 뒤 옛 이름 0건·새 이름 N건 — 다른 현장 기록·식별자가 다른 오더는 그대로,
        이 폰 localStorage(hj_calc_log·hj_calc_cart)도 포함, 바꾸기 전 안전판(hj_snaps)이 찍힌다
     ③ serializeData→applyData 왕복 뒤에도 유지(파생 견적 파일 포함 — 매출 est 가 새 이름에 있다)
     ④ 안전판을 못 찍으면 아무것도 바꾸지 않는다
     ⑤ 삭제 확인 창이 연결된 기록 건수를 보여 주고, 삭제 뒤 기록은 지워지지 않고 '(삭제됨) 이름 · 날짜' 로 남는다
        (사진·서류는 미배정, 일정은 연결 해제 — 예전과 같다)
     ⑥ 같은 이름으로 다시 만들면 projStats est·수금 이력·AS·지출이 0 — 왕복 뒤에도
     ⑦ AI 삭제(aiDeleteProject)도 같은 함수를 쓴다 — 일정 연결 해제·기록 보존이 UI 와 같다
     pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

// 저장소마다 한 건씩 name 현장 기록을 심는다. other 는 건드리면 안 되는 이웃 현장.
function seed(name, other, identity, tag) {
  const S = state;
  const q = { id: 'q' + tag, no: 'Q-' + tag, title: '가상 견적 ' + tag, date: '2026-09-01', project: name, vatIncluded: false,
    items: [{ name: '가상 품목', spec: '', qty: 1, price: 1000000 }] };
  S.quotes.push(q); syncQuoteToProject(q);
  S.files.push({ id: 'ph' + tag, name: '가상사진' + tag + '.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: name, handle: null, size: 10,
    _aptUnit: { project: name, unitId: 'u1' } });
  S.files.push({ id: 'ph' + tag + 'x', name: '이웃사진' + tag + '.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: other, handle: null, size: 11 });
  S.schedule.push({ id: 'sc' + tag, date: '2026-09-02', time: '', title: '가상 일정', project: name });
  S.notes.push({ id: 'nt' + tag, date: '2026. 9. 2.', text: '가상 메모', project: name });
  S.notes.push({ id: 'td' + tag, date: '2026. 9. 2.', day: '2026-09-02', text: '가상 할일', project: name, todo: true, done: false });
  S.payLog.push({ d: '2026-09-03', project: name, amt: 500000 });
  S.payLog.push({ d: '2026-09-03', project: other, amt: 70000 });
  S.asLog.push({ id: 'as' + tag, project: name, date: '2026-09-04', text: '가상 AS', status: 'open' });
  S.expenses.push({ id: 'ex' + tag, date: '2026-09-04', amount: 30000, category: '자재비', memo: '', project: name, vendor: '가상상사' });
  S.workLogs.push({ id: 'wl' + tag, project: name, date: '2026-09-04', in: '09:00', out: '18:00', memo: '' });
  S.trips.push({ id: 'tr' + tag, date: '2026-09-04', project: name, km: 12, memo: '' });
  S.satisfaction.push({ project: name, at: '2026-09-05T00:00:00Z', date: '2026-09-05', stars: 5, text: '가상 후기', src: 'portal' });
  S.aptOrders.push({ id: 'ao' + tag, project: name, projectIdentity: identity, status: 'recv' });
  S.aptOrders.push({ id: 'an' + tag, project: name, projectIdentity: '', status: 'recv' });
  S.aptOrders.push({ id: 'af' + tag, project: name, projectIdentity: 'office-project-zzzzzz9', status: 'recv' });   // 식별자가 다른 남의 오더
  aiOpsEnsureState().queue.push({ id: 'ai' + tag, type: 'receivable', project: name, title: '가상 수금 확인', status: 'pending' });
  const log = hjCalcLogRead(); log.unshift({ id: 'cl' + tag, cat: 'tile', project: name, t: '가상' }); hjCalcLogWrite(log);
  const cart = hjCalcCartRead(); cart.push({ id: 'cc' + tag, name: '가상 타일', project: name, qty: 3, unit: '장' }); hjCalcCartWrite(cart);
}
// 저장소별로 이름 name 을 가진 기록 수
function countRefs(name) {
  const S = state, c = {};
  const add = (k, n) => { if (n) c[k] = (c[k] || 0) + n; };
  add('files', S.files.filter(f => f.project === name && !f._fromQuote).length);
  add('quoteFiles', S.files.filter(f => f.project === name && f._fromQuote).length);
  add('aptUnit', S.files.filter(f => f._aptUnit && f._aptUnit.project === name).length);
  ['schedule', 'notes', 'payLog', 'asLog', 'quotes', 'expenses', 'workLogs', 'trips', 'satisfaction', 'aptOrders'].forEach(k => add(k, (S[k] || []).filter(r => r && r.project === name).length));
  add('aiOps', ((S.aiOps && S.aiOps.queue) || []).filter(t => t.project === name).length);
  add('calcLog', hjCalcLogRead().filter(e => e.project === name).length);
  add('calcCart', hjCalcCartRead().filter(e => e.project === name).length);
  add('activeProject', S.activeProject === name ? 1 : 0);
  return c;
}
const ALL_ONE = { files: 1, quoteFiles: 1, aptUnit: 1, schedule: 1, notes: 2, payLog: 1, asLog: 1, quotes: 1, expenses: 1, workLogs: 1, trips: 1, satisfaction: 1,
  aptOrders: 3, aiOps: 1, calcLog: 1, calcCart: 1 };
const same = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));

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
  await page.evaluate(async () => { await Promise.all([__hjRestoreDone, __hjRelayBootDone, __hjOfficeOpsBootDone]); });
  await page.evaluate(`window.__seed=${seed.toString()};window.__countRefs=${countRefs.toString()};`);
  await page.evaluate(async () => {
    // 부팅 시더를 재운다 — 시나리오 한복판에 일정·할일을 심으면 건수 단정이 흔들린다.
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
    try { localStorage.removeItem('hj_calc_log'); localStorage.removeItem('hj_calc_cart'); } catch (e) {}
    const S = state;
    S.projects = [{ name: '가상A', stage: 1, received: 0, phases: [], cost: {}, officeIntakeProjectId: 'office-project-abc1234' },
      { name: '이웃현장', stage: 1, received: 0, phases: [], cost: {} }];
    S.files = []; S.quotes = []; S.schedule = []; S.notes = []; S.payLog = []; S.asLog = []; S.expenses = []; S.workLogs = []; S.trips = [];
    S.satisfaction = []; S.aptOrders = []; aiOpsEnsureState().queue = []; S.editingQuote = null;
    S.activeProject = '가상A';
    S.editingQuote = { id: 'qEdit', title: '작성 중 견적', project: '가상A', items: [] };   // 작성 중 견적은 state.quotes 밖의 사본이다
    __seed('가상A', '이웃현장', 'office-project-abc1234', 'A');
  });
  const before = await page.evaluate(() => __countRefs('가상A'));
  assert(same(before, Object.assign({}, { activeProject: 1 }, { files: 1, quoteFiles: 1, aptUnit: 1, schedule: 1, notes: 2, payLog: 1, asLog: 1, quotes: 1, expenses: 1,
    workLogs: 1, trips: 1, satisfaction: 1, aptOrders: 3, aiOps: 1, calcLog: 1, calcCart: 1 })), '시드가 저장소마다 들어갔다: ' + JSON.stringify(before));
  const estBefore = await page.evaluate(() => projStats('가상A').est);
  assert(estBefore > 0, '시드 견적이 가상A 매출에 잡힌다');

  // ── ① 확인 창이 바뀌는 범위를 말한다
  await page.evaluate(() => renameProject('가상A'));
  const refsText = await page.locator('#renProjRefs').innerText();
  for (const w of ['사진·서류 1건', '일정 1건', '메모·할일·회의록 2건', '수금 기록 1건', 'AS 기록 1건', '견적서 1건', '지출 1건', '작업시간 1건', '운행 기록 1건',
    '만족도 1건', '관리사무소 오더 2건', 'AI 할 일 1건', '자재 계산 기록(이 폰) 1건', '발주 목록(이 폰) 1건'])
    assert(refsText.includes(w), '① 확인 창에 "' + w + '": ' + refsText);
  console.log('PASS ① 이름 변경 확인 창이 저장소별 건수를 말한다');

  // ── ④ 안전판을 못 찍으면 아무것도 바꾸지 않는다
  await page.evaluate(() => { window.__realSnap = hjSnapshot; hjSnapshot = async () => false; });
  await page.locator('#renProjInput').fill('가상B');
  await page.locator('#modalRoot .mfoot button', { hasText: '저장' }).click();
  await page.waitForFunction(() => /안전판을 저장하지 못해/.test(__toasts[__toasts.length - 1] || ''));
  const blocked = await page.evaluate(() => __countRefs('가상A'));
  assert(same(blocked, before), '④ 안전판 실패 시 아무 기록도 안 바뀐다: ' + JSON.stringify(blocked));
  assert(await page.evaluate(() => state.projects.some(p => p.name === '가상A')), '④ 현장 이름도 그대로');
  await page.evaluate(() => { hjSnapshot = window.__realSnap; });
  console.log('PASS ④ 안전판 실패 → 이름 변경 안 함');

  // ── ② 이름 변경
  await page.locator('#modalRoot .mfoot button', { hasText: '저장' }).click();
  await page.waitForFunction(() => state.projects.some(p => p.name === '가상B') && !document.querySelector('#renProjInput'));
  const oldAfter = await page.evaluate(() => __countRefs('가상A'));
  assert(same(oldAfter, { aptOrders: 1 }), '② 옛 이름은 식별자가 다른 남의 오더 1건만 남는다: ' + JSON.stringify(oldAfter));
  const newAfter = await page.evaluate(() => __countRefs('가상B'));
  const expectNew = Object.assign({}, ALL_ONE, { aptOrders: 2, activeProject: 1 });
  assert(same(newAfter, expectNew), '② 새 이름에 저장소마다 옮겨졌다: ' + JSON.stringify(newAfter));
  const neighbor = await page.evaluate(() => __countRefs('이웃현장'));
  assert(same(neighbor, { files: 1, payLog: 1 }), '② 이웃 현장 기록은 그대로: ' + JSON.stringify(neighbor));
  assert(await page.evaluate(() => state.aptOrders.find(o => o.id === 'afA').project === '가상A'), '② 식별자가 다른 오더는 안 옮긴다');
  assert(await page.evaluate(() => state.editingQuote.project === '가상B'), '② 작성 중 견적도 새 이름(저장하면 옛 이름이 되살아나지 않게)');
  await page.evaluate(() => { state.editingQuote = null; });
  const snaps = await page.evaluate(async () => ((await idbGetStrict('hj_snaps')) || []).map(s => s.label));
  assert(snaps.includes('현장명 변경 전 — 가상A'), '② 바꾸기 전 안전판: ' + JSON.stringify(snaps));
  console.log('PASS ② 이름 변경이 모든 저장소(이 폰 계산 기록·발주 목록 포함)에 전파된다');

  // ── ③ 저장 왕복 — 비운 뒤 applyData 로만 되살린다
  await page.evaluate(() => {
    const d = JSON.parse(JSON.stringify(serializeData()));
    const S = state;
    S.files = []; S.quotes = []; S.schedule = []; S.notes = []; S.payLog = []; S.asLog = []; S.expenses = []; S.workLogs = []; S.trips = []; S.satisfaction = []; S.aptOrders = [];
    applyData(d);
  });
  const rt = await page.evaluate(() => __countRefs('가상B'));
  assert(same(rt, expectNew), '③ 왕복 뒤에도 새 이름: ' + JSON.stringify(rt));
  assert(same(await page.evaluate(() => __countRefs('가상A')), { aptOrders: 1 }), '③ 왕복 뒤 옛 이름 되살아남 없음');
  const est = await page.evaluate(() => ({ b: projStats('가상B').est, a: projStats('가상A').est }));
  assert(est.b === estBefore && est.a === 0, '③ 파생 견적 파일이 새 이름 매출에 남는다: ' + JSON.stringify(est));
  console.log('PASS ③ serializeData→applyData 왕복 뒤에도 유지(파생 견적 파일 포함)');

  // ── ⑤ 삭제 — 확인 창 건수, 기록 보존
  const today = await page.evaluate(() => localDate());
  const tomb = '(삭제됨) 가상B · ' + today;
  await page.evaluate(() => deleteProject('가상B'));
  const delText = await page.locator('#modalRoot').innerText();
  assert(/사진·서류 1개/.test(delText) && /일정 1개/.test(delText), '⑤ 사진·일정 건수: ' + delText);
  const kept = await page.locator('#delProjKept').innerText();
  for (const w of ['수금 기록 1건', 'AS 기록 1건', '견적서 1건', '지출 1건', '메모·할일·회의록 2건', '발주 목록(이 폰) 1건', tomb])
    assert(kept.includes(w), '⑤ 삭제 확인 창에 "' + w + '": ' + kept);
  await page.locator('#modalRoot .mfoot button', { hasText: '삭제' }).click();
  await page.waitForFunction(() => !state.projects.some(p => p.name === '가상B'));
  const gone = await page.evaluate(() => __countRefs('가상B'));
  assert(same(gone, {}), '⑤ 삭제 뒤 가상B 이름을 가진 기록 0: ' + JSON.stringify(gone));
  const tombC = await page.evaluate(t => __countRefs(t), tomb);
  const expectTomb = { quoteFiles: 1, notes: 2, payLog: 1, asLog: 1, quotes: 1, expenses: 1, workLogs: 1, trips: 1, satisfaction: 1, aptOrders: 2, aiOps: 1, calcLog: 1, calcCart: 1 };
  assert(same(tombC, expectTomb), '⑤ 기록은 지우지 않고 삭제됨 이름으로 남는다: ' + JSON.stringify(tombC));
  const detached = await page.evaluate(() => ({ f: state.files.find(f => f.name === '가상사진A.jpg').project, s: state.schedule.find(s => s.id === 'scA').project, n: state.payLog.length }));
  assert(detached.f === null && detached.s === '' && detached.n === 2, '⑤ 사진 미배정·일정 연결 해제·수금 기록 수 그대로: ' + JSON.stringify(detached));
  assert(await page.evaluate(async () => ((await idbGetStrict('hj_snaps')) || []).some(s => s.label === '현장 삭제 전 — 가상B')), '⑤ 삭제 전 안전판');
  console.log('PASS ⑤ 삭제 확인 창이 연결 기록 건수를 보여 주고, 기록은 삭제됨 이름으로 보존');

  // ── ⑥ 같은 이름 재생성 → 옛 기록이 붙지 않는다(왕복 뒤에도)
  const fresh = () => page.evaluate(() => {
    const s = projStats('가상B');
    return { est: s.est, pays: state.payLog.filter(x => x.project === '가상B').length, as: state.asLog.filter(x => x.project === '가상B').length,
      exp: state.expenses.filter(x => x.project === '가상B').length, quotes: state.quotes.filter(q => q.project === '가상B').length };
  });
  await page.evaluate(() => { state.projects.push({ name: '가상B', stage: 0, received: 0, phases: [], cost: {} }); });
  let fr = await fresh();
  assert(same(fr, { est: 0, pays: 0, as: 0, exp: 0, quotes: 0 }), '⑥ 새 가상B 는 비어 있다: ' + JSON.stringify(fr));
  await page.evaluate(() => { const d = JSON.parse(JSON.stringify(serializeData())); state.files = []; state.quotes = []; applyData(d); });
  fr = await fresh();
  assert(same(fr, { est: 0, pays: 0, as: 0, exp: 0, quotes: 0 }), '⑥ 왕복 뒤에도 비어 있다: ' + JSON.stringify(fr));
  assert(await page.evaluate(t => state.quotes.find(q => q.id === 'qA').project === t && projStats('가상B').est === 0, tomb), '⑥ 옛 견적은 삭제됨 이름에 남는다');
  console.log('PASS ⑥ 같은 이름 재생성 시 est·수금·AS·지출 0, 옛 기록은 남아 있다');

  // ── ⑦ AI 삭제 경로도 같은 함수
  await page.evaluate(() => {
    state.projects.push({ name: '가상C', stage: 1, received: 0, phases: [], cost: {}, officeIntakeProjectId: 'office-project-ccc1234' });
    __seed('가상C', '이웃현장', 'office-project-ccc1234', 'C');
  });
  const ai = await page.evaluate(() => aiDeleteProject('가상C'));
  const tombC2 = '(삭제됨) 가상C · ' + today;
  assert(ai.삭제 === '가상C' && ai.사진서류_미배정전환 === 1 && ai.일정_연결해제 === 1 && ai.보존_이름 === tombC2 && /수금 기록 1건/.test(ai.기록_보존), '⑦ AI 결과: ' + JSON.stringify(ai));
  { const cc = await page.evaluate(() => __countRefs('가상C')); assert(same(cc, { aptOrders: 1 }), '⑦ AI 삭제 뒤 가상C 이름 기록은 식별자가 다른 남의 오더 1건뿐: ' + JSON.stringify(cc)); }
  assert(same(await page.evaluate(t => __countRefs(t), tombC2), expectTomb), '⑦ AI 삭제도 같은 보존 규칙');
  assert(await page.evaluate(() => state.schedule.find(s => s.id === 'scC').project === '' && state.files.find(f => f.id === 'phC').project === null), '⑦ AI 삭제도 일정 연결 해제·사진 미배정');
  console.log('PASS ⑦ AI 삭제도 같은 함수(일정 연결 해제·기록 보존)');

  assert(errors.length === 0, 'pageerror 0: ' + errors.join(' | '));
  console.log('project-rename: 전부 통과');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.stack || e); try { await browser.close(); } catch (_) {} process.exit(1); });

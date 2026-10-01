/* unit-jobs.e2e.js — v333 세대(·공용부) 안의 작업건(job).
   대표 요청 ④: '같은 세대의 서로 다른 공사가 섞이지 않도록 접수건별 사진·견적·보수 이력을 연결.'
   한 세대(21동 1203호)에 작업건 둘 — 관리사무소 오더(욕실 누수)에서 자동으로 생긴 것과 직접 받은 것(주방 타일) — 을 두고
   ① 오더는 화면을 여는 것만으로 작업건으로 보이고(저장은 안 한다), 연결할 때 세대에 적히며 오더에 unitId 가 남는다
   ② [＋ 작업건] 실제 클릭 · 이름에 고객 이름·전화번호를 받지 않는다
   ③ 사진(배정 화면의 작업건 칸)·견적·AS·방문 이력이 작업건마다 따로 보이고 섞이지 않는다 · 옛 자료는 '작업건 미지정'
   ④ 같은 작업건 재배정은 쓰기 전에 막는다 · 매출·청구(hjSalesEntries·projStats)는 연결과 무관하다
   ⑤ IDB 저장 왕복·applyData 왕복 뒤에도 그대로
   ⑥ 현장 이름 변경(hjProjectRefWalk) 뒤에도 그대로
   ⑦ 선택 복원 뒤에도 그대로 · 지운 작업건의 사진 연결은 백업에서 되돌아온다
   ⑧ 작업건 삭제 = 연결만 해제(기록은 남는다) · 오더가 살아 있는 관리사무소 작업건은 지우지 못한다
   ⑨ 360px 폭에서 넘침 없음
   전제: tests/static-server.js(8299). serviceWorkers:'block'. 자료는 전부 자기서술형 가짜값. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let fails = 0;
async function test(name, fn) {
  try { await fn(); console.log('PASS  ' + name); }
  catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e).slice(0, 900)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
  });
  const A = '가상 작업건아파트';
  await page.evaluate(async ({ A, PNG }) => {
    try { closeModal(true); } catch (e) {}
    const photo = (i, unitId) => ({ id: 'jp' + i, name: 'TEST_unitjob_' + i + '.jpg', prefix: '현장사진/', kind: 'photo', ext: 'jpg', size: 2000 + i, project: A,
      when: new Date('2026-09-2' + (i % 9) + 'T03:00:00.000Z'), place: null, address: null, thumb: 'data:image/png;base64,' + PNG, text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null,
      _phase: null, _worklabel: null, _gdFolder: null, _driveId: null, _driveMimeType: null, _driveSize: 0, _relayLink: null, _file: null, _heicFile: null, _needHeic: false, _virtual: true,
      ...(unitId ? { _aptUnit: { project: A, unitId } } : {}) });
    state.projects = [{ name: A, stage: 2, received: 0, archived: false, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {},
      aptUnits: [{ id: 'u1', type: 'unit', dong: '21', ho: '1203', name: '', note: '' }, { id: 'u2', type: 'unit', dong: '21', ho: '1204', name: '', note: '' }] }];
    // jp1~jp6: 21동 1203호(옛 배정 — 작업건 없음), jp7: 21동 1204호
    state.files = [1, 2, 3, 4, 5, 6].map(i => photo(i, 'u1')).concat([photo(7, 'u2')]);
    state.aptOffices = [{ id: 'of1', complex: A }];
    state.aptOrders = [{ id: 'ord1abc', officeId: 'of1', unit: '21동 1203호', text: 'TEST 욕실 천장 누수', amount: 0, pipeType: '미확정', date: '2026-09-20', status: 'recv', doneAt: '', project: A }];
    state.quotes = [
      { id: 'q1', no: 'Q-TEST-1', title: 'TEST 욕실 방수 견적', date: '2026-09-20', project: A, vatIncluded: false, items: [{ name: '방수', qty: 1, price: 300000 }] },
      { id: 'q2', no: 'Q-TEST-2', title: 'TEST 주방 타일 견적', date: '2026-09-22', project: A, vatIncluded: false, items: [{ name: '타일', qty: 1, price: 800000 }] },
      { id: 'q3', no: 'Q-TEST-3', title: 'TEST 옛 견적', date: '2026-09-01', project: A, vatIncluded: false, items: [{ name: '옛', qty: 1, price: 1000 }] }];
    state.asLog = [
      { id: 'as1', project: A, date: '2026-09-21', text: 'TEST 욕실 실리콘 재시공', status: 'open' },
      { id: 'as2', project: A, date: '2026-09-23', text: 'TEST 주방 타일 들뜸', status: 'open' }];
    state.quotes.forEach(q => syncQuoteToProject(q));   // 견적의 파생 파일(quote_<id>)까지 있어야 실제 운영 상태와 같다(유상 경로 파일 수 대조)
    state.activeProject = A; state.dirty = false; __tabStale = false;
    render(); clearTimeout(__idbSaveTimer); if (!await guardedPersistCurrentState()) throw new Error('fixture persistence failed'); await __appStateWriteQueue;
    try { document.getElementById('hjPaidCommitRecovery')?.remove(); } catch (e) {}
  }, { A, PNG });
  const OJ = 'ojob_ord1abc';
  let DJ = '';
  const sales0 = await page.evaluate(A => JSON.stringify([hjSalesEntries().map(e => [e.ym, e.amount, e.supply, e.vat, e.label, e.project, e.src]), projStats(A)]), A);

  await test('① 관리사무소 오더는 열기만 해도 작업건으로 보이지만 저장은 하지 않는다(안전판·오더 그대로)', async () => {
    const r = await page.evaluate(async A => {
      const ptr0 = __paidCommitPointerKey, snaps0 = JSON.stringify(await idbGet('hj_snaps') || null);
      aptUnitView(A, 'u1');
      const btns = [...document.querySelectorAll('#modalRoot [data-unit-job]')].map(b => b.dataset.unitJob);
      const wired = [...document.querySelectorAll('#modalRoot [data-unit-job]')].every(b => typeof b.onclick === 'function');
      await __appStateWriteQueue;
      return { btns, wired, jobs: state.projects[0].aptUnits[0].jobs, unitId: state.aptOrders[0].unitId, snaps: (__paidCommitPointerKey !== ptr0 ? 1 : 0) + (JSON.stringify(await idbGet('hj_snaps') || null) !== snaps0 ? 1 : 0),
        u2: hjUnitJobsOf(state.projects[0], state.projects[0].aptUnits[1]).length };
    }, A);
    assert(r.btns.includes('ojob_ord1abc') && r.btns.includes('') && r.btns.includes('__none'), '작업건 줄에 전체·미지정·오더 작업건: ' + JSON.stringify(r.btns));
    assert(r.wired, '작업건 버튼은 모달 안이라 직접 배선되어야 한다');
    assert(r.jobs === undefined && r.unitId === undefined && r.snaps === 0, '화면을 여는 것만으로는 쓰지 않는다: ' + JSON.stringify(r));
    assert(r.u2 === 0, '다른 세대(21동 1204호)에는 그 오더 작업건이 없다');
  });

  await test('② [＋ 작업건] 실제 클릭으로 직접 접수건을 만든다 · 고객 이름·전화번호는 받지 않는다', async () => {
    await page.click('#aptUnitJobAdd');
    await page.waitForSelector('#unitJobTitle');
    for (const bad of ['김가상님 욕실', 'TEST 010-0000-0000 연락', '도어락 1234 보수']) {
      await page.fill('#unitJobTitle', bad);
      await page.click('#unitJobAddSave');
      await page.waitForFunction(() => /넣지 마세요/.test((document.getElementById('aptUnitIssue') || {}).textContent || ''));
      assert(await page.evaluate(() => state.projects[0].aptUnits[0].jobs === undefined), '개인정보가 든 이름은 저장되면 안 된다: ' + bad);
      await page.evaluate(() => { document.getElementById('aptUnitIssue').textContent = ''; });
    }
    await page.fill('#unitJobTitle', 'TEST 주방 타일 교체');
    await page.click('#unitJobAddSave');
    await page.waitForFunction(() => (state.projects[0].aptUnits[0].jobs || []).length === 1);
    const r = await page.evaluate(() => ({ job: state.projects[0].aptUnits[0].jobs[0], h3: (document.querySelector('#aptUnitPanel h3') || {}).textContent || '' }));
    assert(r.job.source === 'direct' && r.job.status === 'open' && r.job.title === 'TEST 주방 타일 교체' && /^job_/.test(r.job.id) && r.job.createdAt === await page.evaluate(() => localDate()), '직접 작업건: ' + JSON.stringify(r.job));
    assert(r.h3.includes('TEST 주방 타일 교체'), '만든 작업건 화면으로 간다: ' + r.h3);
    DJ = r.job.id;
  });

  await test('③ 사진·견적·AS·이력이 작업건마다 따로 — 오더 작업건은 연결할 때 세대에 적히고 오더에 unitId', async () => {
    // 직접 작업건: 배정 화면(실제 UI)에서 jp1·jp2 를 고른다 — 세대 전체 화면에서 작업건 칸을 고른다
    await page.evaluate(A => aptUnitView(A, 'u1'), A);
    const opts = await page.evaluate(() => [...document.querySelectorAll('#aptUnitAssignJob option')].map(o => o.value));
    assert(opts[0] === '' && opts.includes('ojob_ord1abc') && opts.length === 3, '배정 칸 작업건 = 미지정 + 이 세대 작업건 둘: ' + JSON.stringify(opts));
    await page.evaluate(DJ => {
      document.querySelectorAll('#modalRoot .apt-unit-photo-check').forEach(b => { b.checked = ['jp1', 'jp2'].includes(b.value); });
      document.getElementById('aptUnitAssignTarget').value = 'u1'; document.getElementById('aptUnitAssignJob').value = DJ;
      document.getElementById('aptUnitAssignSave').click();
    }, DJ);
    await page.waitForFunction(DJ => state.files.filter(f => f._aptUnit && f._aptUnit.jobId === DJ).length === 2, DJ, { timeout: 10000 });
    // 배정 칸에서 위치를 바꾸면 작업건 칸은 그 위치 것으로 다시 채워진다
    const re = await page.evaluate(() => { const t = document.getElementById('aptUnitAssignTarget'); t.value = 'u2'; t.onchange(); return [...document.querySelectorAll('#aptUnitAssignJob option')].map(o => o.value); });
    assert(eq(re, ['']), '21동 1204호를 고르면 그 세대 작업건(없음)만: ' + JSON.stringify(re));
    const r = await page.evaluate(async ({ A, DJ, OJ }) => {
      await aptUnitAssign(A, 'u1', ['jp3'], OJ);
      await hjUnitJobLink(A, 'u1', DJ, { quotes: { q2: true }, as: { as2: true } });
      await hjUnitJobLink(A, 'u1', OJ, { quotes: { q1: true }, as: { as1: true } });
      await hjUnitLifecycleSave(A, 'u1', { date: '2026-09-24', text: 'TEST 주방 타일 1차 방문', jobId: DJ });
      await hjUnitLifecycleSave(A, 'u1', { date: '2026-09-24', text: 'TEST 세대 공통 메모' });
      const p = state.projects[0], u = p.aptUnits[0];
      const pick = j => { const x = hjUnitJobRecords(p, 'u1', j); return { photos: x.photos.map(f => f.id).sort(), quotes: x.quotes.map(q => q.id), as: x.as.map(a => a.id), history: x.history.map(h => h.text) }; };
      return { direct: pick(DJ), office: pick(OJ), none: pick(HJ_UNIT_JOB_NONE), stored: u.jobs.map(j => [j.id, j.source, j.orderId || '', j.requestId === undefined ? '-' : j.requestId]),
        orderUnit: state.aptOrders[0].unitId, q3: state.quotes.find(q => q.id === 'q3').unitRef, jp4: state.files.find(f => f.id === 'jp4')._aptUnit };
    }, { A, DJ, OJ });
    assert(eq(r.direct, { photos: ['jp1', 'jp2'], quotes: ['q2'], as: ['as2'], history: ['TEST 주방 타일 1차 방문'] }), '직접 작업건만: ' + JSON.stringify(r.direct));
    assert(eq(r.office, { photos: ['jp3'], quotes: ['q1'], as: ['as1'], history: [] }), '오더 작업건만: ' + JSON.stringify(r.office));
    assert(eq(r.none, { photos: ['jp4', 'jp5', 'jp6'], quotes: [], as: [], history: ['TEST 세대 공통 메모'] }), "옛 자료는 '작업건 미지정'에 그대로: " + JSON.stringify(r.none));
    assert(r.stored.some(x => x[0] === OJ && x[1] === 'office' && x[2] === 'ord1abc'), '오더 작업건이 세대 레코드에 적혔다: ' + JSON.stringify(r.stored));
    assert(r.orderUnit === 'u1', '오더에 unitId 가 남는다: ' + r.orderUnit);
    assert(r.q3 === undefined && eq(r.jp4, { project: A, unitId: 'u1' }), '옛 견적·사진은 자동으로 아무 작업건에도 안 붙는다');
    // 화면: 직접 작업건을 고르면 그 사진·견적·AS 만 보인다
    await page.evaluate(({ A, DJ }) => aptUnitView(A, 'u1', 80, DJ), { A, DJ });
    const ui = await page.evaluate(() => ({ boxes: [...document.querySelectorAll('#modalRoot .apt-unit-photo-check')].map(b => b.value).sort(),
      panel: (document.getElementById('aptUnitJobPanel') || {}).textContent || '', job: document.getElementById('aptUnitAssignJob').value }));
    assert(eq(ui.boxes, ['jp1', 'jp2']), '작업건 화면 사진: ' + JSON.stringify(ui.boxes));
    assert(/TEST 주방 타일 견적/.test(ui.panel) && !/TEST 욕실 방수 견적/.test(ui.panel) && /TEST 주방 타일 들뜸/.test(ui.panel) && !/TEST 욕실 실리콘/.test(ui.panel) && /1차 방문/.test(ui.panel), '패널은 이 작업건 견적·AS·이력만: ' + ui.panel.slice(0, 300));
    assert(ui.job !== '' , '작업건 화면에서는 배정 칸 작업건이 그 작업건으로 선택된다');
    const off = await page.evaluate(({ A, OJ }) => { aptUnitView(A, 'u1', 80, OJ); return { boxes: [...document.querySelectorAll('#modalRoot .apt-unit-photo-check')].map(b => b.value), panel: document.getElementById('aptUnitJobPanel').textContent,
      done: !!document.getElementById('aptUnitJobDone'), del: !!document.getElementById('aptUnitJobRemove') }; }, { A, OJ });
    assert(eq(off.boxes, ['jp3']) && /TEST 욕실 방수 견적/.test(off.panel) && /TEST 욕실 천장 누수/.test(off.panel), '오더 작업건 화면: ' + JSON.stringify(off).slice(0, 300));
    assert(!off.done && !off.del, '오더가 살아 있는 작업건은 진행 상태·삭제를 이 화면에서 안 바꾼다(오더 화면에서)');
  });

  await test('③-1 견적·AS 연결 창(실제 클릭) — 풀면 작업건만 빠지고 세대 연결은 남는다', async () => {
    await page.evaluate(({ A, DJ }) => aptUnitView(A, 'u1', 80, DJ), { A, DJ });
    await page.click('#aptUnitJobLink');
    await page.waitForSelector('#unitJobLink');
    const checked = await page.evaluate(() => [...document.querySelectorAll('#unitJobLink .unit-job-pick')].filter(b => b.checked).map(b => b.value));
    assert(eq(checked, ['q2', 'as2']), '이미 이 작업건인 것만 켜져 있다: ' + JSON.stringify(checked));
    await page.evaluate(() => { document.querySelector('#unitJobLink .unit-job-pick[value="as2"]').checked = false; document.querySelector('#unitJobLink .unit-job-pick[value="q3"]').checked = true; });
    await page.click('#unitJobLinkSave');
    await page.waitForFunction(() => state.quotes.find(q => q.id === 'q3').unitRef);
    const r = await page.evaluate(() => ({ q3: state.quotes.find(q => q.id === 'q3').unitRef, as2: state.asLog.find(a => a.id === 'as2').unitRef, n: state.asLog.length }));
    assert(r.q3 && r.q3.unitId === 'u1' && r.q3.jobId && eq(r.as2, { unitId: 'u1' }) && r.n === 2, '연결·해제: ' + JSON.stringify(r));
    // 원래대로 — 뒤 시험이 as2 를 직접 작업건으로 본다
    await page.evaluate(({ A, DJ }) => hjUnitJobLink(A, 'u1', DJ, { quotes: { q3: false }, as: { as2: true } }), { A, DJ });
  });

  await test('④ 같은 작업건 재배정은 쓰기 전에 막고 · 매출·청구는 연결과 무관하다', async () => {
    await page.evaluate(({ A, DJ }) => aptUnitView(A, 'u1', 80, DJ), { A, DJ });
    const r = await page.evaluate(async () => {
      const ptr0 = __paidCommitPointerKey, snaps0 = JSON.stringify(await idbGet('hj_snaps') || null);
      document.querySelectorAll('#modalRoot .apt-unit-photo-check').forEach(b => { b.checked = b.value === 'jp1'; });
      document.getElementById('aptUnitAssignSave').click();
      for (let i = 0; i < 50 && !document.getElementById('aptUnitIssue').textContent; i++) await new Promise(r => setTimeout(r, 20));
      await __appStateWriteQueue;
      return { issue: document.getElementById('aptUnitIssue').textContent, snaps: (__paidCommitPointerKey !== ptr0 ? 1 : 0) + (JSON.stringify(await idbGet('hj_snaps') || null) !== snaps0 ? 1 : 0) };
    });
    assert(/같습니다/.test(r.issue) && r.snaps === 0, '같은 위치·작업건이면 쓰지 않는다: ' + JSON.stringify(r));
    // 같은 세대 안에서 작업건만 바꾸는 것은 배정이다
    await page.evaluate(() => { document.getElementById('aptUnitAssignJob').value = 'ojob_ord1abc'; document.getElementById('aptUnitAssignSave').click(); });
    await page.waitForFunction(() => state.files.find(f => f.id === 'jp1')._aptUnit.jobId === 'ojob_ord1abc');
    const t = await page.evaluate(() => window.__toasts[window.__toasts.length - 1]);
    assert(/1장 → 21동 1203호 · 관리사무소 접수/.test(t), '토스트가 작업건까지 말한다: ' + t);
    await page.evaluate(({ A, DJ }) => aptUnitAssign(A, 'u1', ['jp1'], DJ), { A, DJ });
    const sales1 = await page.evaluate(A => JSON.stringify([hjSalesEntries().map(e => [e.ym, e.amount, e.supply, e.vat, e.label, e.project, e.src]), projStats(A)]), A);
    assert(sales1 === sales0, '견적·AS 를 작업건에 이어도 매출·청구 합계는 그대로:\n' + sales0.slice(0, 900) + '\n' + sales1.slice(0, 900));
  });

  const snapshotOf = () => page.evaluate(A => {
    const p = state.projects.find(x => x.name === A); if (!p) return null;
    const u = p.aptUnits.find(x => x.id === 'u1');
    const pick = j => { const x = hjUnitJobRecords(p, 'u1', j); return [x.photos.map(f => f.name).sort(), x.quotes.map(q => q.id), x.as.map(a => a.id), x.history.map(h => h.text)]; };
    return JSON.stringify({ jobs: hjUnitJobsOf(p, u).map(j => [j.id, j.title, j.source, j.status, !!j.virtual]), d: pick(u.jobs.find(j => j.source === 'direct').id), o: pick('ojob_ord1abc'), n: pick(HJ_UNIT_JOB_NONE) });
  }, A);
  let base = '';
  let backupData = null;

  await test('⑤ IDB 저장 왕복·applyData 왕복 뒤에도 그대로', async () => {
    base = await snapshotOf();
    const r = await page.evaluate(async () => {
      const stored = await idbGet('appState');
      const sp = stored.projects[0], files = stored.files.filter(f => f.aptUnit && f.aptUnit.jobId).map(f => f.name).sort();
      applyData(JSON.parse(JSON.stringify(serializeData())));
      return { jobs: (sp.aptUnits[0].jobs || []).length, files, q: stored.quotes.filter(q => q.unitRef && q.unitRef.jobId).length, a: stored.asLog.filter(a => a.unitRef && a.unitRef.jobId).length,
        h: (sp.aptUnits[0].lifecycle.history || []).filter(h => h.jobId).length, ord: stored.aptOrders[0].unitId };
    });
    assert(r.jobs === 2 && r.files.length === 3 && r.q === 2 && r.a === 2 && r.h === 1 && r.ord === 'u1', 'IDB 저장본: ' + JSON.stringify(r));
    assert(await snapshotOf() === base, 'applyData 왕복 뒤 같은 작업건 묶음: ' + await snapshotOf());
    // 새로고침 뒤에도
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
    await page.evaluate(async () => {
      await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]);
      taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); return o(m); };
    });
    assert(await snapshotOf() === base, '새로고침 뒤 같은 작업건 묶음: ' + await snapshotOf());
  });

  await test('⑥ 현장 이름 변경(hjProjectRefWalk) 뒤에도 작업건 연결이 그대로', async () => {
    await page.evaluate(A => renameProject(A), A);
    await page.waitForSelector('#renProjInput');
    await page.fill('#renProjInput', A + ' 새이름');
    await page.locator('#modalRoot .mfoot button', { hasText: '저장' }).click();
    await page.waitForFunction(A => state.projects.some(p => p.name === A + ' 새이름') && !document.querySelector('#renProjInput'), A);
    await page.evaluate(() => __appStateWriteQueue);
    const after = await page.evaluate(A => {
      const N = A + ' 새이름', p = state.projects.find(x => x.name === N), u = p.aptUnits[0];
      const pick = j => { const x = hjUnitJobRecords(p, 'u1', j); return [x.photos.map(f => f.name).sort(), x.quotes.map(q => q.id), x.as.map(a => a.id), x.history.map(h => h.text)]; };
      return JSON.stringify({ jobs: hjUnitJobsOf(p, u).map(j => [j.id, j.title, j.source, j.status, !!j.virtual]), d: pick(u.jobs.find(j => j.source === 'direct').id), o: pick('ojob_ord1abc'), n: pick(HJ_UNIT_JOB_NONE) });
    }, A);
    assert(after === base, '이름 변경 뒤 같은 작업건 묶음:\n' + after + '\n' + base);
    // 되돌린다
    await page.evaluate(A => renameProject(A + ' 새이름'), A);
    await page.waitForSelector('#renProjInput');
    await page.fill('#renProjInput', A);
    await page.locator('#modalRoot .mfoot button', { hasText: '저장' }).click();
    await page.waitForFunction(A => state.projects.some(p => p.name === A) && !document.querySelector('#renProjInput'), A);
    await page.evaluate(() => __appStateWriteQueue);
    assert(await snapshotOf() === base, '되돌린 이름에서도 그대로');
  });

  await test('⑧ 작업건 삭제 = 연결만 해제(기록은 남는다) · 오더 작업건은 못 지운다', async () => {
    const blocked = await page.evaluate(async A => { try { await hjUnitJobRemove(A, 'u1', 'ojob_ord1abc'); return 'removed'; } catch (e) { return e.message; } }, A);
    assert(/지울 수 없습니다/.test(blocked), '오더 작업건 삭제는 막는다: ' + blocked);
    backupData = await page.evaluate(() => JSON.parse(JSON.stringify(serializeData())));
    await page.evaluate(({ A, DJ }) => aptUnitView(A, 'u1', 80, DJ), { A, DJ });
    await page.click('#aptUnitJobRemove');   // confirm 은 dialog 핸들러가 수락
    await page.waitForFunction(DJ => !(state.projects[0].aptUnits[0].jobs || []).some(j => j.id === DJ), DJ);
    const r = await page.evaluate(({ A, DJ }) => ({
      jp: state.files.filter(f => ['TEST_unitjob_1.jpg', 'TEST_unitjob_2.jpg'].includes(f.name)).map(f => f._aptUnit), q2: state.quotes.find(q => q.id === 'q2'), as2: state.asLog.find(a => a.id === 'as2'),
      h: state.projects[0].aptUnits[0].lifecycle.history.find(h => h.text === 'TEST 주방 타일 1차 방문'), office: hjUnitJobRecords(state.projects[0], 'u1', 'ojob_ord1abc').photos.map(f => f.id),
      toast: window.__toasts[window.__toasts.length - 1], h3: document.querySelector('#aptUnitPanel h3').textContent }), { A, DJ });
    assert(eq(r.jp, [{ project: A, unitId: 'u1' }, { project: A, unitId: 'u1' }]), '사진은 세대에 남고 작업건만 빠진다: ' + JSON.stringify(r.jp));
    assert(r.q2 && eq(r.q2.unitRef, { unitId: 'u1' }) && r.as2 && eq(r.as2.unitRef, { unitId: 'u1' }), '견적·AS 는 지우지 않고 작업건 연결만 뺀다');
    assert(r.h && !('jobId' in r.h), '이력은 남고 작업건 표시만 빠진다');
    assert(r.office.length === 1 && /사진 2장·견적 1건·AS 1건/.test(r.toast) && /작업건 미지정/.test(r.h3), '다른 작업건은 그대로, 토스트·화면: ' + JSON.stringify(r));
  });

  await test('⑦ 선택 복원 — 지운 작업건과 그 사진 연결이 백업에서 되돌아오고, 오더 작업건 연결은 그대로', async () => {
    await page.evaluate(data => { window.__backups = [{ name: '현장_20260925120000.json', handle: null, data }]; restoreSelect(0); }, backupData);
    await page.waitForSelector('#modalRoot input[data-bkp]');
    await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click());
    await page.waitForFunction(() => (window.__toasts || []).some(t => /현장을 복원했습니다/.test(t)));
    const r = await page.evaluate(({ A, DJ }) => {
      const p = state.projects.find(x => x.name === A), x = hjUnitJobRecords(p, 'u1', DJ), o = hjUnitJobRecords(p, 'u1', 'ojob_ord1abc');
      return { job: !!(p.aptUnits[0].jobs || []).find(j => j.id === DJ), photos: x.photos.map(f => f.name).sort(), office: o.photos.map(f => f.name).sort(), oq: o.quotes.map(q => q.id) };
    }, { A, DJ });
    assert(r.job && eq(r.photos, ['TEST_unitjob_1.jpg', 'TEST_unitjob_2.jpg']) && eq(r.office, ['TEST_unitjob_3.jpg']) && eq(r.oq, ['q1']), '선택 복원 뒤: ' + JSON.stringify(r));
  });

  await test('⑨ 360px — 작업건 화면이 가로로 넘치지 않는다', async () => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.evaluate(({ A, DJ }) => aptUnitView(A, 'u1', 80, DJ), { A, DJ });
    const r = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); const d = document.documentElement;
      return { modal: m.scrollWidth - m.clientWidth, doc: d.scrollWidth - d.clientWidth }; });
    assert(r.modal <= 1 && r.doc <= 1, '넘침: ' + JSON.stringify(r));
  });

  if (errs.length) { fails++; console.log('FAIL  페이지 오류: ' + errs.join(' | ').slice(0, 600)); }
  await browser.close();
  console.log(fails ? '\n실패 ' + fails + '건' : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

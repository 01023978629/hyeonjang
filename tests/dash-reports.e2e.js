/* dash-reports.e2e.js — 첫 화면·보고의 숫자가 매출 한 벌과 같은 값을 말한다 (v331, Playwright)

   2차 발굴(2026-09-26)에서 두 반박자가 모두 인정한 첫 화면·보고 결함 다섯 + v330 통합 결함 둘:
     ① 📉 매출 추이(revenueTrendData)·경영 현황(bizDashData)의 '이번 달 견적'이 현장에 연결한 앱 견적을 두 번 셌다
        (state.quotes 합계 + 그 가상 파일 quote_…). 종결 견적도 더했다. → hjSalesEntries 한 벌.
     ② 현장 보드(projHealthBoard)가 3년 전에 끝난 보증을 '긴급'·1050점으로 올려 첫 화면 상위 3곳을 차지했다.
        → 끝난 보증은 만료 30일까지만 '관찰', 긴급은 아직 안 끝난 14일 안쪽만.
     ③ '오늘 챙길 일'(dailyCheckData)이 종결·수주 표시한 미연결 견적까지 '연결하면 매출 반영'으로 조름. → 작성·보냄만.
     ④ 첫 화면 '📄 견적서 내역' 표가 다른 현장의 같은 이름 견적을 사본으로 합쳐 한 줄을 숨기고 합계를 줄였다. → 현장 안에서만 묶는다.
     ⑤ 주간 브리핑·운영 리포트·경영 현황·매출 추이의 '완료 현장'이 보관 현장을 뺐다. → 기간에 끝낸 공사는 보관해도 센다.
     ⑥ 현장을 지우면 그 현장 견적이 부가세 신고·월말 결산에서 두 번 잡히거나 빠졌다(견적 파일은 미배정, 앱 견적 가상 파일은
        '(삭제됨)'). → 견적서 파일도 '(삭제됨)' 이름으로 옮긴다 — 삭제 전후 매출 합계가 같다.
     ⑦ 같은 금액 견적 둘 중 하나를 ✍ 편집해 저장하면 다른 하나가 새 앱 견적의 사본으로 묶여 매출·청구·잔금에서 빠졌다.
        → 편집으로 옮겨 온 앱 견적(가상 파일 _editedFrom)은 2차 병합(같은 현장·같은 금액)에 끼지 않는다.
   시드는 전부 가상값(가상… 현장, 010-0000-1234).

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
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjSalesEntries === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
  });
  const reset = () => page.evaluate(() => {
    state.projects = []; state.files = []; state.quotes = []; state.expenses = []; state.schedule = []; state.payLog = [];
    state.asLog = []; state.notes = []; state.aptOrders = []; state.editingQuote = null; state.activeProject = null;
  });
  const P = `(name, extra) => Object.assign({ name, stage: 3, received: 0, phases: [], cost: {}, customer: { name: '가상고객', phone: '010-0000-1234', addr: '' }, archived: false }, extra || {})`;
  const Q = `(id, title, date, project, price, extra) => Object.assign({ id, no: 'Q-' + id, title, date, place: '', vatIncluded: true, accountIdx: 0, memo: '', project,
      items: [{ name: title + ' 공사', spec: '', qty: 1, price }] }, extra || {})`;

  // ── ① 매출 추이·경영 현황 = 매출 한 벌 ─────────────────────────────
  await reset();
  const r1 = await page.evaluate(({ P, Q }) => {
    P = eval(P); Q = eval(Q);
    const today = localDate(), ym = today.slice(0, 7);
    state.projects = [P('가상연결')];
    state.quotes = [
      Q('q1', '가상연결', today, '가상연결', 1000000),                                       // 110만(부가세 포함) — 현장 연결
      Q('ql', '종결견적', today, null, 1000000, { result: 'lost', lost: { at: today, reason: '가격' } })   // 종결 — 매출 아님
    ];
    syncQuoteToProject(state.quotes[0]);
    const sales = hjSalesEntries().filter(r => r.ym === ym).reduce((a, r) => a + r.amount, 0);
    const trend = revenueTrendData(3).rows.slice(-1)[0].est;
    return { sales, trend, biz: bizDashData().monthEst, est: projStats('가상연결').est };
  }, { P, Q });
  assert(r1.sales === 1100000 && r1.est === 1100000, '① 전제: 매출 한 벌 110만: ' + JSON.stringify(r1));
  assert(r1.trend === r1.sales, '① 매출 추이 이번 달 = 매출 한 벌이어야(두 번 세면 220만): ' + JSON.stringify(r1));
  assert(r1.biz === r1.sales, '① 경영 현황 이번 달 견적 = 매출 한 벌이어야: ' + JSON.stringify(r1));

  // ── ② 현장 보드: 끝난 보증은 긴급이 아니다 ───────────────────────────
  await reset();
  const r2 = await page.evaluate(({ P }) => {
    P = eval(P);
    const DAY = 86400000, d = n => localDate(new Date(Date.now() + n * DAY));
    const W = n => ({ startedAt: d(-1000), items: [{ name: '방수', months: 36, expiresAt: d(n) }] });
    state.projects = [
      P('가상옛집', { doneAt: '2021-01-10' }),                              // 보증 2024-01 에 끝남 — 보드에 보증 신호 없음
      P('가상임박', { doneAt: d(-1000), warranty: W(10) }),                  // 10일 남음 — 긴급
      P('가상막끝', { doneAt: d(-1100), warranty: W(-5) })                   // 5일 전에 끝남 — 관찰(점검 안내)
    ];
    const b = projHealthBoard();
    const w = n => { const row = b.rows.find(x => x.name === n); return row ? { level: row.level, score: row.score, r: row.reasons.filter(x => x.axis === 'warranty') } : null; };
    return { old: w('가상옛집'), soon: w('가상임박'), just: w('가상막끝'), first: b.rows[0] && b.rows[0].name, due: warrantyDue().map(x => x.name).sort() };
  }, { P });
  assert(r2.due.includes('가상옛집'), '② 전제: warrantyDue 는 만료 현장도 넘긴다(알림 모집단 그대로): ' + JSON.stringify(r2.due));
  assert(!r2.old || r2.old.r.length === 0, '② 3년 전에 끝난 보증이 보드에 남았다: ' + JSON.stringify(r2.old));
  assert(r2.soon && r2.soon.level === 'urgent' && r2.soon.r.length === 1 && r2.soon.r[0].urgent, '② 10일 남은 보증은 긴급: ' + JSON.stringify(r2.soon));
  assert(r2.just && r2.just.r.length === 1 && r2.just.r[0].urgent === false && /보증만료 D\+5/.test(r2.just.r[0].label) && r2.just.level !== 'urgent',
    '② 막 끝난 보증은 관찰(긴급 아님): ' + JSON.stringify(r2.just));
  assert(r2.just.r[0].weight <= 60, '② 끝난 보증 가중치가 만료 뒤 날수로 불지 않는다: ' + JSON.stringify(r2.just));
  assert(r2.first === '가상임박', '② 보드 1위는 아직 안 끝난 임박 보증: ' + r2.first);

  // ── ③ 오늘 챙길 일: 종결·수주 표시 미연결 견적은 조르지 않는다 ─────────
  await reset();
  const r3 = await page.evaluate(({ Q }) => {
    Q = eval(Q);
    const today = localDate();
    const pick = () => dailyCheckData().filter(x => /미연결 견적/.test(x.t)).map(x => x.t);
    state.quotes = [
      Q('ql', '종결', today, null, 1000000, { result: 'lost', lost: { at: today, reason: '가격' } }),
      Q('qw', '수주', today, null, 1000000, { result: 'won' })
    ];
    const closed = pick();
    state.quotes.push(Q('qd', '작성', today, null, 1000000));
    state.quotes.push(Q('qs', '보냄', today, null, 1000000, { sentAt: today }));
    return { closed, open: pick() };
  }, { Q });
  assert(r3.closed.length === 0, '③ 종결·수주 표시 견적만 있으면 미연결 견적 항목이 없어야: ' + JSON.stringify(r3.closed));
  assert(r3.open.length === 1 && /미연결 견적 2건/.test(r3.open[0]), '③ 작성·보냄 견적은 센다: ' + JSON.stringify(r3.open));

  // ── ④ 첫 화면 견적서 내역: 다른 현장의 같은 이름 견적은 합치지 않는다 ────
  await reset();
  const r4 = await page.evaluate(({ P }) => {
    P = eval(P);
    state.projects = [P('가상갑'), P('가상을')];
    state.files = [
      { id: 'e1', name: '욕실 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상갑', est: { amount: 5000000, supply: 4545455, vat: 454545, date: '2026-09-01' } },
      { id: 'e2', name: '욕실 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상을', est: { amount: 7000000, supply: 6363636, vat: 636364, date: '2026-09-02' } },
      // 같은 현장 안의 엑셀·PDF 출력본은 여전히 한 줄(사본)
      { id: 'e3', name: '욕실 견적.pdf', ext: 'pdf', kind: 'estimate', project: '가상을', est: { amount: 7000000, date: '2026-09-02' } }
    ];
    const box = document.createElement('div'); box.innerHTML = dashboardEstimateDetailsHTML();
    const rows = [...box.querySelectorAll('tbody tr')];
    const last = rows[rows.length - 1].textContent;
    return { data: rows.length - 1, total: last, dup: box.querySelectorAll('tbody tr span').length, sum: projStats('가상갑').est + projStats('가상을').est };
  }, { P });
  assert(r4.data === 2, '④ 두 현장 견적이 각각 한 줄이어야: ' + JSON.stringify(r4));
  assert(r4.total.includes('12,000,000'), '④ 합계 = 현장별 매출 합(1,200만): ' + JSON.stringify(r4));
  assert(r4.sum === 12000000 && r4.dup === 1, '④ 같은 현장 엑셀·PDF 는 사본 배지 하나: ' + JSON.stringify(r4));

  // ── ⑤ 기간 완료 집계는 보관 현장도 센다 ──────────────────────────────
  await reset();
  const r5 = await page.evaluate(({ P }) => {
    P = eval(P);
    const lw = hjWeekRange(-1), cw = hjWeekRange(0), today = localDate();
    state.projects = [
      P('가상지난주보관', { doneAt: lw.from, archived: true }),
      P('가상이번주보관', { doneAt: today, archived: true }),
      P('가상이번주', { doneAt: today })
    ];
    const ops = opsReportData('week').doneProjects.map(p => p.name).sort();
    const opsM = opsReportData('month').doneProjects.map(p => p.name);
    return {
      week: weekBriefData().lastDone.map(p => p.name), ops, opsM,
      biz: bizDashData().doneThisMonth.map(p => p.name).sort(), trend: revenueTrendData(3).rows.slice(-1)[0].done,
      actN: bizDashData().actN, cwFrom: cw.from
    };
  }, { P });
  assert(r5.week.includes('가상지난주보관'), '⑤ 주간 브리핑 지난주 완료에 보관 현장: ' + JSON.stringify(r5));
  assert(r5.ops.includes('가상이번주보관') && r5.ops.includes('가상이번주'), '⑤ 운영 리포트(주) 완료에 보관 현장: ' + JSON.stringify(r5));
  assert(r5.opsM.includes('가상이번주보관'), '⑤ 운영 리포트(월) 완료에 보관 현장: ' + JSON.stringify(r5));
  assert(r5.biz.includes('가상이번주보관') && r5.biz.includes('가상이번주'), '⑤ 경영 현황 이번 달 완료에 보관 현장: ' + JSON.stringify(r5));
  assert(r5.trend >= 2, '⑤ 매출 추이 이번 달 완료에 보관 현장: ' + JSON.stringify(r5));
  assert(r5.actN === 1, '⑤ 진행·단계 같은 현재 상태 집계는 여전히 보관을 뺀다: ' + JSON.stringify(r5));

  // ── ⑥ 현장을 지워도 매출 합계가 그대로 ──────────────────────────────
  await reset();
  const r6 = await page.evaluate(({ P, Q }) => {
    P = eval(P); Q = eval(Q);
    state.projects = [P('가상빌드'), P('가상앱'), P('가상도배갑'), P('가상도배을')];
    const E = (id, name, ext, project, amount, date) => ({ id, name, ext, kind: 'estimate', project, est: { amount, date }, when: new Date(date + 'T09:00:00') });
    state.files = [
      E('b1', '★20250910 빌드캡 공주 3,978,700.xlsx', 'xlsx', '가상빌드', 3978700, '2025-09-10'),   // 이름만 다른 사본 쌍(2차 병합으로 한 묶음)
      E('b2', '빌드캡 (공주)20250910 (1).xlsx', 'xlsx', '가상빌드', 3978700, '2025-09-10'),
      E('x1', '가상앱 견적.xlsx', 'xlsx', '가상앱', 11000000, '2025-09-15'),                         // 앱 견적의 엑셀 사본
      E('d1', '도배 견적.xlsx', 'xlsx', '가상도배갑', 3000000, '2025-09-20'),
      E('d2', '도배 견적.xlsx', 'xlsx', '가상도배을', 2000000, '2025-09-21'),
      { id: 'ph1', name: '가상사진.jpg', ext: 'jpg', kind: 'photo', project: '가상빌드' }
    ];
    state.quotes = [Q('qa', '가상앱', '2025-09-15', '가상앱', 10000000)];
    syncQuoteToProject(state.quotes[0]);
    const snap = () => ({ vat: vatReportData('2025-07', '2025-09').salesTotal, month: (collectQuotesByMonth()['2025-09'] || {}).total || 0 });
    const before = snap();
    const res = ['가상빌드', '가상앱', '가상도배갑', '가상도배을'].map(n => hjDeleteProjectCore(n));
    const after = snap();
    return {
      before, after, kept: res[0].kept, counts: res[0].counts,
      b1: state.files.find(f => f.id === 'b1').project, x1: state.files.find(f => f.id === 'x1').project,
      qf: state.files.find(f => f.id === 'quote_qa').project, ph: state.files.find(f => f.id === 'ph1').project,
      tombs: res.map(r => r.tomb),
      // 정리 폴더에 있던 견적서 파일이 다음 PC 스캔에서 폴더 이름으로 지운 현장을 되살리지 않는다
      reorg: (() => { const rec = { id: 'o1', name: '가상 견적.xlsx', kind: 'estimate', prefix: '_정리완료/가상빌드/', project: res[0].tomb };
        const ch = recoverOrganizedMetadata(rec); return { ch, project: rec.project, revived: state.projects.some(p => p.name === '가상빌드') }; })()
    };
  }, { P, Q });
  assert(r6.before.vat === 3978700 + 11000000 + 5000000 && r6.before.month === r6.before.vat, '⑥ 전제: 삭제 전 매출 1,997만: ' + JSON.stringify(r6.before));
  assert(r6.after.vat === r6.before.vat, '⑥ 삭제 뒤 부가세 신고 매출이 달라졌다: ' + JSON.stringify(r6));
  assert(r6.after.month === r6.before.month, '⑥ 삭제 뒤 월말 결산 매출이 달라졌다: ' + JSON.stringify(r6));
  assert(r6.b1 === r6.tombs[0] && r6.x1 === r6.tombs[1] && r6.qf === r6.tombs[1], '⑥ 견적서 파일은 앱 견적과 같은 (삭제됨) 이름으로: ' + JSON.stringify(r6));
  assert(r6.ph === null && r6.counts.files === 1 && r6.counts.estFiles === 2 && r6.kept.estFiles === 2, '⑥ 사진은 예전처럼 미배정, 견적서 파일은 따로 센다: ' + JSON.stringify(r6));
  assert(r6.reorg.ch === false && r6.reorg.project === r6.tombs[0] && !r6.reorg.revived, '⑥ 정리 폴더 스캔이 지운 현장을 되살렸다: ' + JSON.stringify(r6.reorg));
  // 삭제 확인 창도 견적서 파일을 '미배정' 이 아니라 '(삭제됨)' 쪽으로 말한다
  await reset();
  const r6b = await page.evaluate(({ P }) => {
    P = eval(P);
    state.projects = [P('가상확인')];
    state.files = [
      { id: 'k1', name: '가상확인 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상확인', est: { amount: 1000000, date: '2025-09-01' } },
      { id: 'k2', name: '가상.jpg', ext: 'jpg', kind: 'photo', project: '가상확인' }
    ];
    deleteProject('가상확인');
    const t = document.querySelector('#modalRoot').textContent;
    closeModal();
    return t;
  }, { P });
  assert(/사진·서류 1개/.test(r6b) && /견적서 파일 1건/.test(r6b), '⑥ 삭제 확인 창 문구: ' + r6b.slice(0, 400));
  // 삭제 뒤 토스트·AI 결과·AI 도구 설명도 견적서 파일을 '미배정' 이라 하지 않는다(확인 창과 같은 말)
  const r6c = await page.evaluate(async ({ P }) => {
    P = eval(P);
    state.projects = [P('가상토스트'), P('가상AI')];
    state.files = [
      { id: 't1', name: '가상토스트 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상토스트', est: { amount: 1000000, date: '2025-09-01' } },
      { id: 't2', name: '가상.jpg', ext: 'jpg', kind: 'photo', project: '가상토스트' },
      { id: 'a1', name: '가상AI 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상AI', est: { amount: 1000000, date: '2025-09-01' } },
      { id: 'a2', name: '가상2.jpg', ext: 'jpg', kind: 'photo', project: '가상AI' }
    ];
    const oldT = toast, oldS = hjSnapshot; const toasts = [];
    toast = m => toasts.push(String(m)); hjSnapshot = async () => true;
    try {
      deleteProject('가상토스트');
      const btn = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.trim() === '삭제');
      btn.click();
      for (let i = 0; i < 100 && !toasts.some(t => /삭제됨/.test(t)); i++) await new Promise(r => setTimeout(r, 20));
    } finally { toast = oldT; hjSnapshot = oldS; }
    const ai = aiDeleteProject('가상AI');
    const desc = AI_TOOLS.find(t => t.name === 'delete_project').description;
    return { toast: toasts.find(t => /삭제됨/.test(t)) || '', ai, brief: aiResultBrief('delete_project', ai), desc };
  }, { P });
  assert(/사진·서류는 미배정으로 보존/.test(r6c.toast) && /견적서 파일/.test(r6c.toast) && /\(삭제됨\) 가상토스트/.test(r6c.toast) && !/\(파일은 미배정/.test(r6c.toast),
    '⑥ 삭제 토스트가 견적서 파일을 미배정이라 한다: ' + r6c.toast);
  assert(r6c.ai.사진서류_미배정전환 === 1 && r6c.ai.견적서파일_보존 === 1 && /견적서 파일과 수금/.test(r6c.ai.안내), '⑥ AI 삭제 결과: ' + JSON.stringify(r6c.ai));
  assert(/견적서 1개/.test(r6c.brief) && /사진·서류 1개 미배정/.test(r6c.brief), '⑥ AI 결과 한 줄: ' + r6c.brief);
  assert(/견적서 파일은[^,]*\(삭제됨\)/.test(r6c.desc), '⑥ AI 도구 설명: ' + r6c.desc);

  // ── ⑦ 같은 금액 견적 하나를 ✍ 편집·저장해도 다른 견적이 남는다 ─────────
  await reset();
  const r7 = await page.evaluate(({ P }) => {
    P = eval(P);
    state.projects = [P('가상집')];
    const E = (id, name, amount) => ({ id, name, ext: 'xlsx', kind: 'estimate', project: '가상집', est: { amount, supply: amount / 1.1, vat: amount - amount / 1.1, date: '2026-09-01' }, when: new Date('2026-09-01T09:00:00') });
    state.files = [E('f1', '욕실 견적.xlsx', 5500000), E('f2', '주방 견적.xlsx', 5500000)];
    const snap = () => { const s = projStats('가상집'); return { est: s.est, bill: s.bill, due: s.due, vat: vatReportData('2026-09', '2026-09').salesTotal }; };
    const before = snap();
    quoteFromExisting('f1'); saveQuoteEdit();
    const after = snap();
    const q = state.quotes[0], vf = state.files.find(f => f._fromQuote);
    return { before, after, f1: state.files.find(f => f.id === 'f1').exSum, f2: !!state.files.find(f => f.id === 'f2').exSum, fromFileId: q && q.fromFileId, edited: vf && vf._editedFrom };
  }, { P });
  assert(r7.before.est === 11000000, '⑦ 전제: 편집 전 1,100만: ' + JSON.stringify(r7));
  assert(r7.f1 === true && r7.f2 === false && r7.fromFileId === 'f1' && r7.edited === 'f1', '⑦ 원본만 집계 제외, 표식이 남는다: ' + JSON.stringify(r7));
  assert(r7.after.est === 11000000 && r7.after.bill === 11000000 && r7.after.due === 11000000 && r7.after.vat === 11000000,
    '⑦ 편집·저장 뒤에도 매출·청구·잔금·신고가 1,100만이어야(주방 550만이 사본으로 사라지면 550만): ' + JSON.stringify(r7));
  // 표식 없는 앱 견적과 그 엑셀 사본은 여전히 한 번(v330 규칙 그대로)
  await reset();
  const r7b = await page.evaluate(({ P, Q }) => {
    P = eval(P); Q = eval(Q);
    state.projects = [P('가상사본')];
    state.quotes = [Q('qs', '가상사본', '2026-09-01', '가상사본', 1000000)];
    syncQuoteToProject(state.quotes[0]);
    state.files.push({ id: 's1', name: '가상사본 최종.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상사본', est: { amount: 1100000, date: '2026-09-01' } });
    return projStats('가상사본').est;
  }, { P, Q });
  assert(r7b === 1100000, '⑦ 편집 표식 없는 앱 견적 + 엑셀 사본은 한 번: ' + r7b);
  // 편집·저장 뒤 원본을 Σ 로 집계에 되돌리면(저장 안내가 알려 주는 길) 원본과 그 앱 견적은 한 벌이다 — 두 번 세면 1,650만
  await reset();
  const r7c = await page.evaluate(({ P }) => {
    P = eval(P);
    state.projects = [P('가상집')];
    const E = (id, name, ext, amount) => ({ id, name, ext, kind: 'estimate', project: '가상집', est: { amount, supply: amount / 1.1, vat: amount - amount / 1.1, date: '2026-09-01' }, when: new Date('2026-09-01T09:00:00') });
    const run = (srcExt, vfFirst, extra, twin, restoreId) => {
      // 원본이 PDF 거나 PDF 출력본을 둘 때 같은 금액 주방 엑셀은 v330 규칙(엑셀↔PDF 같은 현장·같은 금액 = 사본)으로 원본과 묶이므로 뺀다 — 여기서 볼 것은 편집 표식뿐
      state.files = [E('f1', '욕실 견적.' + srcExt, srcExt, 5500000)].concat(srcExt === 'pdf' || twin ? [] : [E('f2', '주방 견적.xlsx', 'xlsx', 5500000)]).concat(twin ? [twin] : []);
      state.quotes = []; state.editingQuote = null;
      quoteFromExisting('f1'); saveQuoteEdit();
      const src = state.files.find(f => f.id === 'f1'); const excluded = src.exSum === true;
      (restoreId ? state.files.find(f => f.id === restoreId) : src).exSum = false;   // Σ 되돌리기
      if (vfFirst) { const i = state.files.findIndex(f => f._fromQuote); state.files.unshift(state.files.splice(i, 1)[0]); }
      (extra || []).forEach(f => state.files.push(f));
      return { excluded, est: projStats('가상집').est, vat: vatReportData('2026-09', '2026-09').salesTotal };
    };
    return {
      xlsx: run('xlsx', false),
      // 원본이 PDF 이고 앱 견적 가상 파일이 앞에 있으면: 원본과 묶인 뒤 대표가 원본이어야 원본의 엑셀 출력본(이름 다름)도 사본으로 붙는다
      pdfFirst: run('pdf', true, [E('f3', '욕실 최종.xlsx', 'xlsx', 5500000)]),
      // 원본 엑셀과 같은 이름의 PDF 출력본이 같이 빠졌다가, Σ 로 PDF 만 되돌린 경우 — 그 PDF 도 원본 쪽이다(1차 이름 키가 같다)
      twin: run('xlsx', false, [], E('f1p', '욕실 견적.pdf', 'pdf', 5500000), 'f1p')
    };
  }, { P });
  assert(r7c.xlsx.excluded && r7c.xlsx.est === 11000000 && r7c.xlsx.vat === 11000000, '⑦ Σ 로 되돌린 원본 + 그 앱 견적은 한 번(1,100만): ' + JSON.stringify(r7c));
  assert(r7c.twin.excluded && r7c.twin.est === 5500000 && r7c.twin.vat === 5500000, '⑦ Σ 로 되돌린 원본의 같은 이름 PDF + 앱 견적은 한 번(550만, 따로 세면 1,100만): ' + JSON.stringify(r7c));
  assert(r7c.pdfFirst.excluded && r7c.pdfFirst.est === 5500000 && r7c.pdfFirst.vat === 5500000, '⑦ PDF 원본·앱 견적이 앞: 묶음 대표가 원본이어야 원본의 엑셀 출력본도 사본(550만, 따로 세면 1,100만): ' + JSON.stringify(r7c));

  assert(errors.length === 0, '페이지 오류: ' + errors.join(' | '));
  console.log('dash-reports: 7/7 통과');
  await browser.close();
})().catch(async e => { console.error('FAIL', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });

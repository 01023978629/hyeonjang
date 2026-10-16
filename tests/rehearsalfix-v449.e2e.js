/* v449 리허설 R1·R4·R5 고침 — 합성 자료만. 월말 마감 잔금 줄(상담 단계 견적 빼기) · 직원 모드(고객 입력칸·인건비 장부·돈 창 막기) ·
   마진 보드(수주 전 견적 빼기) · 인건비 장부(이번 달·사람별 공수) · 첫 답장(잡힌 방문·누수 문자=답장) · 누수 단계 체크 · 복사 안내 ·
   서류 만들기(견적 한 번·글자색) · 증빙 묶음(누수 기간·간이영수증 줄) · 누수 수리 사진 열쇠 · 메모 '고객 고객' · 계절 캠페인 기본 ·
   누수 완료 문자(출동 보고) · 월말 마감 돌아오기 · 창 열렸을 때 토스트 위.
   HJ_V449_BASELINE=<commit> 은 REHEARSALFIX_API_PRESENT 에서, HJ_V449_MUTATION=staff-cust(직원 모드 고객 입력칸 숨김 규칙 제거)는
   STAFF_CUSTOMER_HIDDEN 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const WON = 'TEST_X1 욕실 수주', PROS = 'TEST_X2 실측 견적', LEAK = 'TEST_X3 누수 출동';
const baseline = process.env.HJ_V449_BASELINE && execFileSync('git', ['show', process.env.HJ_V449_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v449 = { toasts: [], copies: [], external: [], zips: [], downloads: [] };
    window.open = (...args) => { __v449.external.push(args); return null; };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v449.copies.push(String(t)); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjMarginWon', 'hjStageCheckDef', 'hjFirstReplyBooked', 'hjFirstReplyLabel', 'hjEvidenceStartOf'].every(k => typeof window[k] === 'function') && typeof STAGE_CHECK_LEAK === 'object' && !!HJ_PHOTO_GUIDE.leakRepair), true, 'REHEARSALFIX_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const realToast = toast; toast = m => { __v449.toasts.push(String(m)); return realToast(m); };
    window.ensureJSZip = async () => {}; window.ensureXLSX = async () => {};
    window.JSZip = function () { const files = {}; __v449.zips.push({ files }); const make = pre => ({ file(p, b) { files[pre + p] = b; return this; }, folder(n) { return make(pre + n + '/'); } }); const api = make(''); api.generateAsync = async () => new Blob(['z']); return api; };
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => rows, book_append_sheet: (wb, ws, name) => { wb.sheets.push({ name, rows: ws }); } }, write: wb => JSON.stringify(wb.sheets), writeFile: () => {} };
    hjEvidenceDownload = (blob, name) => { __v449.downloads.push(name); };
    hjSendSms = () => {};
  });
  if (process.env.HJ_V449_MUTATION) {
    assert.equal(process.env.HJ_V449_MUTATION, 'staff-cust');
    await page.evaluate(() => { const st = document.getElementById('hjStaffCss'); st.textContent = st.textContent.replace('body.hj-staff .cust-card .cust-grid,', ''); });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS rehearsalfix-v449 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  let D;
  async function seed() {
    await close();
    D = await page.evaluate(async ({ WON, PROS, LEAK }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      try { localStorage.removeItem('hj_role'); localStorage.removeItem('hj_staff_pin'); } catch (e) {} hjStaffApply();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = []; state.adPosts = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), month = today.slice(0, 7), tmr = hjAddDays(today, 1);
      const P = (name, x) => Object.assign({ name, kind: 'interior', stage: 2, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박리허설', phone: '010-0000-4502', addr: '대전 중구 대흥동 1-1' } }, x || {});
      state.projects = [P(WON, { stage: 3, doneAt: today }), P(PROS, { stage: 1 }), P(LEAK, { kind: 'leak', stage: 3, doneAt: today, leak: { intake: { where: ['욕실'], at: today + 'T00:30:00.000Z' }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', at: today + 'T01:00:00.000Z' } } })];
      const est = (project, amount) => ({ id: 'TEST_EST_' + project, name: project + ' 견적.pdf', kind: 'estimate', ext: 'pdf', size: 100, project, when: null, est: { amount, supply: Math.round(amount / 1.1), date: today } });
      state.files = [est(WON, 3300000), est(PROS, 1320000), { id: 'TEST_VQ', name: 'app.quote', kind: 'estimate', ext: 'quote', size: 1, project: WON, _fromQuote: true, _virtual: true, est: { amount: 3300000, date: today } }];
      state.quotes = [{ id: 'TEST_Q1', project: WON, title: '욕실 견적', date: today, items: [] }];
      state.notes = [{ id: 'TEST_INQ', date: new Date(hjAddDays(today, -1) + 'T09:00:00').toLocaleString('ko-KR'), text: '[문의 접수] ' + hjAddDays(today, -1) + ' · 📍 네이버 지도\n천장 누수', project: LEAK }];
      state.schedule.push({ id: 'TEST_DISPATCH', project: LEAK, title: '🚨 누수 출동', date: today, time: '00:10', endTime: '00:20', urgent: true, report: { progress: '완료', done: '온수관 이음부 교체·타일 1㎡ 복구', filledAt: today + 'T01:00:00.000Z' } },
        { id: 'TEST_LABOR', project: WON, title: '타일 시공', date: today, time: '09:00', labor: { amount: 365000, names: '김타일, 박설비', by: { '김타일': { days: 1, rate: 250000 }, '박설비': { days: 0.5, rate: 230000 } } } });
      state.projects.find(p => p.name === LEAK).docs = [{ type: 'payrcpt', no: 'MM-' + today.replace(/-/g, '') + '-01', at: new Date().toISOString(), ref: 'TEST_PAY' }];
      state.activeProject = WON; state.tab = 'dashboard'; state.search = ''; __projView = null;
      for (const k of Object.keys(__v449)) __v449[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V449_SEED_SAVE_FAILED');
      return { today, month, tmr };
    }, { WON, PROS, LEAK });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };

  await test('① 월말 마감 잔금 줄은 진행·완료(또는 받은 돈 있는) 현장만 · 마진 보드는 수주 전 견적을 뺀다 · 증빙 묶음·세무 자료에서 월말 마감으로 돌아오기', async () => {
    await seed();
    const r = await page.evaluate(({ month, PROS, WON }) => { const due = mcData(month).due.map(x => x.name), mb = hjMarginBoardData(month, false); return { due, pending: mb.pending, interior: mb.groups.interior.rows.map(x => x.name) }; }, { month: D.month, PROS, WON });
    assert(r.due.includes(WON) && !r.due.includes(PROS), 'prospect quote is not a balance: ' + JSON.stringify(r.due));
    assert.equal(r.pending, 1); assert.deepEqual(r.interior, [WON]);
    await page.evaluate(m => hjMarginBoardView(m), D.month); assert.match(await page.locator('[data-margin-pending]').innerText(), /수주 전 견적 1곳은 뺐어요/); await close();
    await page.evaluate(m => monthCloseView(1, m), D.month); await footer('이번 달 증빙 전부').click(); await page.locator('#hjEvidenceMonth').waitFor();
    await tapOk('#modalRoot .mfoot button'); await footer('← 월말 마감').click(); await page.waitForFunction(() => /월 마감/.test(document.querySelector('#modalRoot h3').textContent));
    await page.evaluate(m => monthCloseView(3, m), D.month); await footer('📤 세무사 자료').click(); await page.locator('#hjTaxPack').waitFor();
    await footer('← 월말 마감').click(); await page.waitForFunction(() => /3\/5/.test(document.querySelector('#modalRoot h3').textContent)); await close();
  });

  await test('② 👷 직원 모드 — 고객 이름·번호·주소 입력칸, 고객 문자·페이지, 인건비 장부 숨김 · 돈·고객 창은 다른 길로도 안 열림 · 끄면 그대로', async () => {
    await page.evaluate(async () => { await hjStaffSet(true, '1234'); state.tab = 'project'; state.activeProject = 'TEST_X1 욕실 수주'; __projView = null; render(); });
    const v = await page.evaluate(() => ({ grid: document.querySelectorAll('.cust-card .cust-grid').length, gridShown: [...document.querySelectorAll('.cust-card .cust-grid')].filter(n => n.getClientRects().length).length,
      call: [...document.querySelectorAll('.cust-card [data-callcust]')].filter(n => n.getClientRects().length).length, sms: [...document.querySelectorAll('.cust-card [data-smscust]')].filter(n => n.getClientRects().length).length }));
    assert(v.grid > 0); assert.equal(v.gridShown, 0, 'STAFF_CUSTOMER_HIDDEN'); assert.equal(v.call, 1, 'call button stays'); assert.equal(v.sms, 0);
    await page.evaluate(() => { state.tab = 'schedule'; render(); });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#schLabor')].filter(n => n.getClientRects().length).length), 0, 'labor ledger button hidden');
    const blocked = await page.evaluate(() => { __v449.toasts = []; const r = ['laborLedger', 'recvQuickView', 'hjCustQuickView', 'settleDocs', 'monthCloseView', 'expenseLedger'].map(fn => [fn, window[fn]('TEST_X1 욕실 수주'), !!document.querySelector('#modalRoot .modal')]); return { r, toasts: __v449.toasts.slice() }; });
    assert(blocked.r.every(([, ret, open]) => ret === false && !open), JSON.stringify(blocked.r)); assert(blocked.toasts.every(t => /직원 모드에서는 돈·고객 정보 창/.test(t)));
    await page.evaluate(async () => { await hjStaffSet(false, '1234'); });
    await page.evaluate(() => laborLedger()); await page.locator('#modalRoot .modal').waitFor(); await close();
  });

  await test('③ 👷 인건비 장부 — 내년 세금 일정이 있어도 이번 달이 먼저 · 작업자별은 사람별 공수·일당(정산표와 같은 값) · 일당 합계 칸이 390px 안', async () => {
    const r = await page.evaluate(() => { const d = laborLedgerData(); return { ym: d.ym, months: d.months, byWk: d.byWk }; });
    assert.equal(r.ym, D.month); assert(!r.months.some(m => m > D.month && m.slice(0, 4) !== D.month.slice(0, 4)), 'tax reminders are not labor months: ' + r.months);
    assert.deepEqual(r.byWk, { '김타일': 250000, '박설비': 115000 });
    await page.evaluate(() => laborLedger()); await page.locator('#modalRoot .llAmt').first().waitFor();
    assert(await page.locator('#modalRoot .llAmt').first().evaluate(n => { const m = document.querySelector('#modalRoot .modal').getBoundingClientRect(), b = n.getBoundingClientRect(); return b.right <= m.right + 1 && b.width > 40; }), 'amount box inside the window');
    await close();
  });

  await test('④ 💬 첫 답장 — 잡힌 방문이 있으면 그 시간을 알림 · 누수 문자(접수 확인)를 보냈으면 답장한 것(📈 첫 답장 분에도) · 누수 수리 사진 열쇠 · 메모 고객 고객', async () => {
    const r = await page.evaluate(({ LEAK, tmr }) => {
      state.schedule.push({ id: 'TEST_TMR', project: LEAK, title: '누수 재방문', date: tmr, time: '10:00', urgent: true });
      const booked = hjFirstReplyBooked(LEAK, new Date()), draft = hjFirstReplyDraft({ ch: 'naver', kind: 'leak', slots: hjFirstReplySlots(new Date()), booked });
      const before = hjInquiryReplied(LEAK), p = state.projects.find(x => x.name === LEAK);
      p.leak.sms = { intake: new Date().toISOString() };
      const after = hjInquiryReplied(LEAK), min = hjInsightReplyMin(state.notes.filter(n => n.project === LEAK), p);
      delete p.leak.sms; state.schedule = state.schedule.filter(s => s.id !== 'TEST_TMR');
      return { booked: booked && booked.label, draft, before, after, min, key: hjWoGuideKey(p, '누수 수리'), keyDetect: hjWoGuideKey(p, '누수 탐지'), memo: hjWoMemoSafe(p, '고객 박리허설 010-0000-4502 연락 후 방문') };
    }, { LEAK, tmr: D.tmr });
    assert.equal(r.booked, '내일 오전 10시'); assert.match(r.draft, /내일 오전 10시 방문으로 잡아 두었습니다/); assert.doesNotMatch(r.draft, /또는/);
    assert.equal(r.before, false); assert.equal(r.after, true); assert(Number.isFinite(r.min) && r.min > 0, 'leak SMS counts as the first reply ' + r.min);
    assert.equal(r.key, 'leakRepair'); assert.equal(r.keyDetect, 'leakDetect'); assert.doesNotMatch(r.memo, /고객\s+고객/);
    await page.evaluate(({ LEAK, tmr }) => { state.schedule.push({ id: 'TEST_TMR2', project: LEAK, title: '누수 재방문', date: tmr, time: '10:00', urgent: true }); hjFirstReplyView(LEAK); }, { LEAK, tmr: D.tmr });
    await page.locator('[data-fr-booked]').waitFor(); assert.match(await page.inputValue('#frText'), /내일 오전 10시 방문으로/);
    await close(); await page.evaluate(() => { state.schedule = state.schedule.filter(s => s.id !== 'TEST_TMR2'); });
  });

  await test('⑤ 누수 — 단계 체크는 수리 전·수리 마무리(관리사무소 공사 신고·도어락 없음) · 완료 문자는 출동 보고의 수리 내용 · 끝낸 현장은 탐지 문자 다시 안 묻기 · 증빙 묶음 기간·간이영수증 줄', async () => {
    const leakDef = await page.evaluate(LEAK => { const p = state.projects.find(x => x.name === LEAK), i = state.projects.find(x => x.name === 'TEST_X2 실측 견적'); return { l2: hjStageCheckDef(p, 2).title, l3: stageChecklistItems(p, 3).map(x => x[1]), i2: hjStageCheckDef(i, 2).title }; }, LEAK);
    assert.equal(leakDef.l2, '📋 수리 전 체크'); assert.equal(leakDef.i2, '📋 착공 전 체크');
    assert(!leakDef.l3.includes('pwchange') && leakDef.l3.includes('retest') && leakDef.l3.includes('sms'), JSON.stringify(leakDef.l3));
    await page.evaluate(() => { const p = state.projects.find(x => x.name === 'TEST_X2 실측 견적'); p.kind = 'leak'; setStage(p.name, 2); });
    await page.locator('#modalRoot .clChk').first().waitFor();
    assert.deepEqual(await page.locator('#modalRoot .clChk').evaluateAll(n => n.map(x => x.dataset.k)), ['valve', 'neighbor', 'protect', 'photo']);
    assert.match(await page.locator('#modalRoot h3').innerText(), /수리 전 체크/); await close();
    await page.evaluate(() => { const p = state.projects.find(x => x.name === 'TEST_X2 실측 견적'); p.kind = 'interior'; });
    const sms = await page.evaluate(LEAK => { const p = state.projects.find(x => x.name === LEAK); return { done: hjLeakSmsDraft(p, 'done'), pending: hjLeakSmsPending(localDate()).detect }; }, LEAK);
    assert.match(sms.done, /수리 내용: 온수관 이음부 교체·타일 1㎡ 복구/); assert(!sms.pending.includes(LEAK), 'finished job is not asked for a detect SMS');
    const ev = await page.evaluate(LEAK => { const plan = hjEvidencePlan(LEAK, { purpose: 'tax' }); return { list: String(plan.entries[0].payload), notes: plan.notes }; }, LEAK);
    assert.match(ev.list, new RegExp('기간: ' + D.today + ' ~')); assert(ev.notes.some(n => /간이영수증 1건\(MM-/.test(n)), JSON.stringify(ev.notes));
  });

  await test('⑥ 복사 안내 · 서류 만들기(앱 견적 한 번·글자색) · 계절 캠페인 기본 · 창이 열리면 토스트는 위 · 계약', async () => {
    await page.evaluate(() => { __v449.toasts = []; coworkCopy('t1', '고객 일정 안내 글'); coworkCopy('t2'); coworkCopy('t3', '세금 정리', { cowork: true }); });
    await page.waitForFunction(() => __v449.toasts.length >= 3);
    const t = await page.evaluate(() => __v449.toasts.slice(0, 3));
    assert.equal(t[0], '📋 고객 일정 안내 글 복사됨 — 붙여 넣어 쓰세요'); assert.match(t[1], /Cowork에 붙여넣으세요/); assert.match(t[2], /Cowork에 붙여넣으세요/);
    await page.evaluate(WON => docHubView(WON), WON); await page.locator('#modalRoot .docHubBtn').first().waitFor();
    assert.match(await page.locator('#modalRoot .modal').innerText(), /견적 1건/);
    assert(await page.locator('#modalRoot .docHubBtn').first().evaluate(n => n.style.color === 'var(--ink)'), 'card text colour survives button:hover');
    await close();
    const season = await page.evaluate(() => { const today = localDate(), inwin = hjSeasonAll().filter(c => hjSeasonInWindow(c));
      state.adPosts = inwin.map(c => ({ id: 'TEST_SENT_' + c.id, ch: 'sms-season', campaign: c.id, date: today, count: 1 }));
      hjSeasonView(); const sel = (document.querySelector('[data-season-pick][aria-pressed="true"]') || {}).dataset; return { picked: sel && sel.seasonPick, expect: (inwin[0] || hjSeasonAll()[0]).id, due: hjSeasonDue().length }; });
    assert.equal(season.due, 0); assert.equal(season.picked, season.expect, 'in-season campaign first even after it was sent');
    await page.evaluate(() => { state.adPosts = []; toast('위치 확인'); });
    const pos = await page.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); return { top: r.top, bottom: innerHeight - r.bottom }; });
    assert(pos.top < 120, 'toast sits on top while a window is open: ' + JSON.stringify(pos));
    await close();
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, c) => sum + c.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v449.external), []);
  });
  console.log(`rehearsalfix-v449: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL rehearsalfix-v449', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

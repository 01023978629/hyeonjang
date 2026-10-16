/* v447 데이터 안전 — 개인정보 보존 3년·정리(익명화)·삭제 요청 · 백업 점검·복원 리허설 · 변경 기록. 합성 레코드만, 외부 쓰기 0.
   HJ_V447_BASELINE=<commit> 은 RET_API_PRESENT 에서, HJ_V447_MUTATION=ignore-due(대금 예외 무시) 는 RET_EXCEPTION_DUE 에서,
   HJ_V447_MUTATION=skip-snapshot(안전판 생략) 은 RET_SNAPSHOT_FIRST 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const NAME = '김철수', PHONE = '010-1111-2222', OLD = 'TEST 김철수 욕실', REQ = 'TEST_RET_REQUEST';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V447_BASELINE && execFileSync('git', ['show', process.env.HJ_V447_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.accept());
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
    window.__v447Calls = { external: [], sms: [], download: [] };
    window.open = (...args) => { __v447Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v447Calls.external.push(args); } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjRetLastActivity', 'hjRetExceptions', 'hjRetCandidates', 'hjRetPreview', 'hjRetAnonProject', 'hjRetApply', 'hjRetView', 'hjRetRequestView', 'hjBackupState', 'hjRestoreRehearsal', 'hjAuditAdd', 'hjAuditAll', 'hjAuditPrune', 'hjAuditView', 'hjDataSafetyView'].every(k => typeof window[k] === 'function') && HJ_RETENTION.years === 3 && HJ_RETENTION.ledgerYears === 5), true, 'RET_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V447_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __v447Calls.sms.push({ phone, text }); };
    hjDocDownload = (text, fname, mime) => { __v447Calls.download.push({ text: String(text), fname, mime }); };
    exportData = () => { __v447Calls.download.push({ fname: 'export' }); };
  });
  if (process.env.HJ_V447_MUTATION) {
    assert(['ignore-due', 'skip-snapshot'].includes(process.env.HJ_V447_MUTATION), 'unknown mutation');
    if (process.env.HJ_V447_MUTATION === 'ignore-due') await page.evaluate(() => { const real = hjRetExceptions; hjRetExceptions = (p, t) => real(p, t).filter(x => x !== '대금 정리 전'); });
    else await page.evaluate(() => { hjSnapshot = async () => true; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS retention-v447 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  /* 합성 현장 — 오늘 기준 상대 날짜. */
  async function seed() {
    await close();
    return page.evaluate(async ({ name, phone, old, req }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const today = localDate(), cut3 = hjRetCutoff(today, 3), cut1 = hjRetCutoff(today, 1), day = n => hjAddDays(cut3, n), noteAt = ymd => new Date(ymd + 'T10:00:00').toLocaleString('ko-KR');
      const project = (pname, extra) => ({ name: pname, kind: 'interior', stage: 3, phases: [], customer: { name: 'TEST_OTHER', phone: '', addr: '대전 동구' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, ...extra });
      const note = (pname, ymd, text) => state.notes.push({ id: uid(), date: noteAt(ymd), text: text || '[연락] 통화', project: pname });
      state.projects = [
        project('TEST_A_DONE', { doneAt: day(-10) }),
        project('TEST_B_PAY', { doneAt: day(-30) }), project('TEST_C_AS', { doneAt: day(-30) }), project('TEST_D_NOTE', { doneAt: day(-30) }), project('TEST_E_NONE', { stage: 0 }),
        project('TEST_F_EXACT', { stage: 0 }), project('TEST_F_INSIDE', { stage: 0 }), project('TEST_F_BEFORE', { stage: 0 }),
        project('TEST_X_WARRANTY', { warranty: { startedAt: day(-400), items: [{ name: '방수', months: 60, expiresAt: hjAddDays(today, 300) }] } }),
        project('TEST_X_DUE'), project('TEST_X_AS'), project('TEST_X_DISPUTE'),
        project(old, { doneAt: day(-5), customer: { name, phone, addr: '대전 중구 대흥동 101동 1203호', email: 'kim@example.invalid' }, warrantySigs: [{ id: 'ws1', at: day(-5), role: 'client', org: '101동 1203호', name, png: 'data:image/png;base64,AAAA' }], warrantyDoc: { at: day(-5), file: 'w.html', html: '<p>' + name + '</p>' } }),
        project(req, { doneAt: day(400), customer: { name: '이요청', phone: '010-3333-4444', addr: '대전 서구 둔산동 7동 302호' } }),
        project('TEST_INQ', { stage: 0, inquiryAt: hjAddDays(cut1, -20), customer: { name: '박문의', phone: '010-5555-6666', addr: '대전 유성구' } })];
      state.payLog.push({ id: 'PL_B', d: day(-5), project: 'TEST_B_PAY', amt: 100000, method: '계좌이체' });
      state.asLog.push({ id: 'AS_C', date: day(-4), project: 'TEST_C_AS', text: 'AS 처리', status: 'done' });
      note('TEST_D_NOTE', day(-3));
      note('TEST_F_EXACT', day(0)); note('TEST_F_INSIDE', day(1)); note('TEST_F_BEFORE', day(-1));
      note('TEST_X_WARRANTY', day(-50)); note('TEST_X_DUE', day(-50)); note('TEST_X_AS', day(-50)); note('TEST_X_DISPUTE', day(-50), '분쟁 — 하자 범위 다툼');
      state.asLog.push({ id: 'AS_X', date: day(-60), project: 'TEST_X_AS', text: '누수 재발', status: 'open' });
      state.quotes = [{ id: 'Q_DUE', project: 'TEST_X_DUE', title: 'TEST_DUE_QUOTE', date: day(-60), items: [{ name: '도배', qty: 1, price: 500000 }], vatIncluded: true },
        { id: 'Q_OLD', project: old, title: name + ' 욕실 견적', place: '대전 중구 대흥동 101동 1203호', date: day(-20), items: [{ name: '욕실 리모델링', qty: 1, price: 3000000 }], vatIncluded: true }];
      state.quotes.forEach(x => syncQuoteToProject(x));
      const oldP = state.projects.find(x => x.name === old); oldP.received = num(oldP.received) + num(projStats(old).due);
      if (num(projStats(old).due) !== 0) throw Error('TEST_V447_SEED_DUE_NOT_ZERO');
      state.payLog.push({ id: 'PL_OLD', d: day(-5), project: old, amt: oldP.received, method: '계좌이체' });
      note(old, day(-5), '[연락] ' + name + ' 님 ' + phone + ' 101동 1203호 잔금 입금 확인');
      state.schedule.push({ id: 'S_OLD', date: day(-6), project: old, title: name + ' 욕실 마감', memo: '연락 ' + phone });
      note(req, today, '[연락] 이요청 님 통화');
      note('TEST_INQ', hjAddDays(cut1, -20), '[문의 접수] 박문의 010-5555-6666');
      state.contacts = [{ id: 'C_OLD', name, phone, company: '', title: '', memo: '욕실 고객 ' + phone, tag: '고객' },
        { id: 'C_INQ', name: '박문의', phone: '010-5555-6666', company: '대전 유성구 봉명동 3-1', title: '', memo: '[문의] 욕실', tag: '고객' },
        { id: 'C_OFFICE', name: '관리소장', phone: '010-7777-8888', company: '○○아파트 관리사무소', title: '', memo: '', tag: '고객' }];
      state.projects.push(project('TEST_OFFICE_LINK', { stage: 0, inquiryAt: hjAddDays(cut1, -30), customer: { name: '관리소장', phone: '010-7777-8888', addr: '' } }));
      note('TEST_OFFICE_LINK', hjAddDays(cut1, -30));
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v447Calls)) __v447Calls[k] = [];
      try { localStorage.removeItem('hj_ret_seen'); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); localStorage.setItem('hj_restore_rehearsal_at', String(Date.now())); } catch (_) {}
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V447_SEED_SAVE_FAILED');
      return { today, cut3, cut1 };
    }, { name: NAME, phone: PHONE, old: OLD, req: REQ });
  }
  async function snapshot() {
    return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() }; });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function shot(name) {
    if (!process.env.HJ_V447_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V447_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V447_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const snapCount = () => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).length);
  const lastSnapLabel = () => page.evaluate(async () => { const s = (await idbGet('hj_snaps')) || []; return s.length ? s[s.length - 1].label : ''; });

  await test('① 기준일 5가지 · 3년 경계 ±1일 · 예외 4종 · 문의 연락처 1년 · 관리사무소 제외', async () => {
    const d = await seed(); const before = await snapshot();
    const r = await page.evaluate(today => {
      const act = n => hjRetLastActivity(state.projects.find(x => x.name === n)), c = hjRetCandidates(today);
      return { a: act('TEST_A_DONE'), b: act('TEST_B_PAY'), c: act('TEST_C_AS'), d: act('TEST_D_NOTE'), e: act('TEST_E_NONE'), list: c.projects.map(x => [x.name, x.eligible, x.exceptions]), contacts: c.contacts.map(x => [x.id, x.eligible, x.exceptions]), noDate: c.noDate, eligible: c.eligible };
    }, d.today);
    assert.deepEqual([r.a.src, r.b.src, r.c.src, r.d.src, r.e.date], ['준공', '수금', 'AS', '노트', '']);
    assert.equal(r.a.date, await page.evaluate(c => hjAddDays(c, -10), d.cut3)); assert.equal(r.b.date, await page.evaluate(c => hjAddDays(c, -5), d.cut3));
    const map = Object.fromEntries(r.list.map(([n, e, x]) => [n, { e, x }]));
    assert(map.TEST_F_EXACT && map.TEST_F_EXACT.e, 'exactly three years ago is due'); assert(map.TEST_F_BEFORE && map.TEST_F_BEFORE.e, 'one day older is due'); assert(!map.TEST_F_INSIDE, 'one day newer is not listed');
    assert(!map.TEST_E_NONE && r.noDate >= 1, 'no activity date → not listed, counted');
    assert.deepEqual(map.TEST_X_WARRANTY.x.map(x => x.split(' ~')[0]), ['보증 남음']); assert.deepEqual(map.TEST_X_DUE.x, ['대금 정리 전'], 'RET_EXCEPTION_DUE');
    assert.deepEqual(map.TEST_X_AS.x, ['진행 중 AS']); assert.deepEqual(map.TEST_X_DISPUTE.x, ['분쟁 메모']);
    assert.equal(map[OLD].e, true); assert(!map[REQ], 'recent project is not listed');
    assert.deepEqual(r.contacts.find(x => x[0] === 'C_INQ'), ['C_INQ', true, []]);
    assert.deepEqual(r.contacts.find(x => x[0] === 'C_OFFICE'), ['C_OFFICE', false, ['관리사무소']]); assert(!r.contacts.some(x => x[0] === 'C_OLD'), 'a customer with deals follows the 3-year project rule');
    sameSnapshot(await snapshot(), before, 'candidate calculation is read only');
    await page.locator('#view [data-ret-dash]').waitFor(); assert.match(await page.locator('#view [data-ret-dash]').innerText(), new RegExp('🔒 보존 3년 지난 자료 ' + r.eligible + '건'));
    await page.locator('#view [data-ret-dash] [data-ret-open]').click(); await page.locator('#hjRet').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('hj_ret_seen')), d.today.slice(0, 7), 'monthly reminder is marked seen');
    assert.equal(await page.locator('[data-ret-except]').count(), 5, 'four project exceptions + management office'); await tapOk('#modalRoot .mfoot button, #hjRet label:has([data-ret-pick]), [data-ret-preview]'); await noOverflow(); await shot('01-retention');
    sameSnapshot(await snapshot(), before, 'opening the list does not change data');
  });

  await test('② 미리보기 → 선택 정리("정리" 입력) → 안전판 → 이름·전화·호수 지움, 금액·품목·수금 기록 유지, p.anon · 변경 기록', async () => {
    const d = await seed();
    const keep = await page.evaluate(old => ({ items: JSON.stringify(state.quotes.find(q => q.id === 'Q_OLD').items), total: quoteCalc(state.quotes.find(q => q.id === 'Q_OLD')).total, pay: JSON.stringify(state.payLog.find(x => x.id === 'PL_OLD')), docs: (state.files || []).filter(f => f.project === old).length }), OLD);
    await page.evaluate(() => hjRetView()); await page.locator('#hjRet').waitFor();
    await page.locator('[data-ret-preview="' + OLD + '"]').click(); await page.locator('[data-ret-preview-box]').waitFor();
    const pv = await page.locator('[data-ret-preview-box]').innerText();
    for (const t of ['고객 이름 → "고객"', '전화번호', '메일·카카오 ID', '상세 주소 → "대전 중구 대흥동"까지만', '서명 이미지 1개', '보증서 보관본', '노트 1건', '일정 1건', '견적 1건의 주소·이름', '같은 번호 연락처 1명', '파일 1개의 이름', '현장 이름의 고객 이름', '수금 기록 1건']) assert(pv.includes(t), 'preview mentions ' + t + '\n' + pv);
    await footer('목록').click(); await page.locator('#hjRet').waitFor();
    await page.locator('[data-ret-pick="p:' + OLD + '"]').check(); await page.locator('[data-ret-pick="c:C_INQ"]').check(); assert.match(await page.locator('#hjRetPicked').innerText(), /고른 것 2건/);
    const snaps0 = await snapCount();
    await footer('선택 정리').click(); await page.locator('#hjRetConfirm').waitFor(); await tapOk('#modalRoot .mfoot button'); await noOverflow();
    await page.locator('#hjRetWord').fill('정리해'); await footer('정리').first().click(); await page.waitForTimeout(150);
    assert.equal(await page.evaluate(old => !!state.projects.find(x => x.name === old), OLD), true, 'wrong confirmation word changes nothing');
    await page.locator('#hjRetWord').fill('정리'); await page.locator('#modalRoot .mfoot button.warn').click(); await page.locator('#hjRet').waitFor();
    assert.equal(await snapCount(), snaps0 + 1, 'RET_SNAPSHOT_FIRST'); assert.equal(await lastSnapLabel(), '개인정보 정리 전');
    const after = await page.evaluate(({ old, name, phone }) => {
      const p = state.projects.find(x => x.anon && x.name.startsWith('TEST 고객'));
      const dump = JSON.stringify({ p, files: state.files.filter(f => f.project === (p && p.name)).map(f => ({ name: f.name, est: f.est, text: f.text })), notes: state.notes.filter(n => n.project === (p && p.name)), sch: state.schedule.filter(s => s.project === (p && p.name)), q: state.quotes.filter(q => q.project === (p && p.name)), c: state.contacts.filter(c => c.id === 'C_OLD' || c.id === 'C_INQ') });
      return { name: p && p.name, gone: !state.projects.some(x => x.name === old), cust: p && p.customer, anon: p && p.anon, sigs: p && p.warrantySigs, wdoc: p && p.warrantyDoc, hasName: dump.includes(name), hasPhone: dump.replace(/\D/g, '').includes(phone.replace(/\D/g, '')), hasUnit: dump.includes('1203호'),
        items: JSON.stringify(state.quotes.find(q => q.id === 'Q_OLD').items), project: state.quotes.find(q => q.id === 'Q_OLD').project, total: quoteCalc(state.quotes.find(q => q.id === 'Q_OLD')).total, pay: state.payLog.find(x => x.id === 'PL_OLD'),
        contacts: state.contacts.map(c => [c.id, c.name, c.phone, !!c.anon]) };
    }, { old: OLD, name: NAME, phone: PHONE });
    assert.equal(after.name, 'TEST 고객 욕실'); assert.equal(after.gone, true); assert.deepEqual(after.cust, { name: '고객', phone: '', addr: '대전 중구 대흥동' });
    assert.deepEqual([after.anon.by, after.anon.reason, after.anon.at], ['owner', 'retention', d.today]); assert.equal(after.sigs, undefined); assert.equal(after.wdoc.html, undefined);
    assert.equal(after.hasName, false, 'customer name is gone everywhere'); assert.equal(after.hasPhone, false, 'phone is gone everywhere'); assert.equal(after.hasUnit, false, 'unit number is gone');
    assert.equal(after.items, keep.items, 'quote items unchanged'); assert.equal(after.total, keep.total, 'quote amount unchanged'); assert.equal(after.project, after.name, 'quote follows the renamed site');
    assert.equal(after.pay.amt, JSON.parse(keep.pay).amt); assert.equal(after.pay.project, after.name, 'payment record stays, renamed site');
    assert.deepEqual(after.contacts, [['C_OLD', '고객', '', true], ['C_INQ', '고객', '', true], ['C_OFFICE', '관리소장', '010-7777-8888', false]]);
    const audit = await page.evaluate(async () => hjAuditAll());
    assert(audit.some(a => a.kind === 'anon' && a.count === 3 && a.target === '보존 기간'), 'anon audit row (1 site + 2 contacts)'); assert(audit.some(a => a.kind === 'snapshot' && a.target === '개인정보 정리 전'), 'snapshot audit row');
    assert(!JSON.stringify(audit).includes(NAME) && !JSON.stringify(audit).replace(/\D/g, '').includes('01011112222'), 'audit keeps no personal data');
    assert.equal(await page.evaluate(() => hjRetCandidates().projects.some(x => x.name.startsWith('TEST 고객'))), false, 'anonymized site leaves the list');
  });

  await test('③ 고객 삭제 요청 — 그 현장만 사유 request · 안내 문자(금액 없음) · 현장 삭제는 안전판 + 변경 기록', async () => {
    await seed();
    await page.evaluate(req => { state.tab = 'project'; state.activeProject = req; render(); }, REQ); await page.locator('#view [data-retreq]').waitFor();
    await page.locator('#view [data-retreq]').click(); await page.locator('#hjRetRequest').waitFor();
    const text = await page.locator('[data-ret-request-text]').innerText();
    assert.match(text, /세법상 5년/); assert(!/\d[\d,]*\s*원/.test(text), 'notice has no amount'); await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('02-request');
    await footer('안내 문자 초안').click(); assert.deepEqual(await page.evaluate(() => __v447Calls.sms.map(x => x.phone)), ['010-3333-4444']);
    await footer('삭제 처리').click(); await page.locator('#hjRetConfirm').waitFor(); await page.locator('#hjRetWord').fill('정리'); await page.locator('#modalRoot .mfoot button.warn').click();
    await page.waitForFunction(req => { const p = state.projects.find(x => x.name === req); return p && p.anon; }, REQ);
    const r = await page.evaluate(req => { const p = state.projects.find(x => x.name === req); return { anon: p.anon, cust: p.customer, others: state.projects.filter(x => x.anon).length }; }, REQ);
    assert.equal(r.anon.reason, 'request'); assert.deepEqual(r.cust, { name: '고객', phone: '', addr: '대전 서구 둔산동' }); assert.equal(r.others, 1, 'only that site');
    await page.evaluate(() => deleteProject('TEST_E_NONE')); await footer('삭제').click(); await page.waitForFunction(() => !state.projects.some(x => x.name === 'TEST_E_NONE'));
    await page.waitForFunction(async () => (await hjAuditAll()).some(a => a.kind === 'delete'));
    const audit = await page.evaluate(async () => (await hjAuditAll()).slice(0, 6).map(a => [a.kind, a.target]));
    assert(audit.some(([k, t]) => k === 'delete' && t === '현장'), 'delete audit'); assert(audit.some(([k, t]) => k === 'snapshot' && t === '현장 삭제 전'), 'snapshot before delete, label without the site name');
    assert(audit.some(([k, t]) => k === 'anon' && t === '삭제 요청'));
  });

  await test('④ 백업 3일·7일 판정 · 복원 리허설 비교 · ⑤ 변경 기록 필터·CSV·90일 순환 · ⑥ 키·44px·390px·더보기', async () => {
    await seed(); const before = await snapshot();
    const set = days => page.evaluate(days => { localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now() - days * 86400000 - 60000, kind: 'file' })); state.tab = 'dashboard'; render(); return hjBackupState(); }, days);
    assert.equal((await set(1)).level, 'ok'); assert.equal(await page.locator('#view [data-backup-nudge]').count(), 0); assert.equal(await page.locator('#view [data-backup-card]').count(), 0);
    assert.equal((await set(4)).level, 'warn'); await page.locator('#view [data-backup-nudge="warn"]').waitFor(); assert.match(await page.locator('#view [data-backup-nudge]').innerText(), /백업 4일 넘음/); await tapOk('#view [data-backup-nudge] button');
    assert.equal((await set(8)).level, 'alert'); await page.locator('#view [data-backup-card="alert"]').waitFor(); assert.equal(await page.locator('#view [data-backup-nudge]').count(), 0, 'red card replaces the yellow line');
    await page.evaluate(() => { localStorage.removeItem('hj_restore_rehearsal_at'); render(); }); await page.locator('#view [data-rehearsal-dash]').waitFor();
    await page.locator('#view [data-safety-open]').click(); await page.locator('#hjSafety').waitFor(); assert.equal(await page.locator('[data-safety-backup="alert"]').count(), 1);
    await tapOk('#modalRoot .mfoot button, #sfBackup, #sfRehearse, #sfRet, #sfAudit'); await noOverflow(); await shot('03-safety');
    await page.evaluate(() => hjSnapshot('TEST 리허설 기준', true, true));
    await page.locator('#sfRehearse').click(); await page.locator('[data-rehearsal-result]').waitFor(); assert.equal(await page.locator('[data-rehearsal-result]').getAttribute('data-rehearsal-result'), 'ok');
    assert(Number(await page.evaluate(() => localStorage.getItem('hj_restore_rehearsal_at'))) > 0, 'rehearsal time recorded');
    await page.evaluate(() => { state.projects.push({ name: 'TEST_NEW_AFTER_SNAP', kind: 'interior', stage: 0, phases: [], customer: {}, received: 0, cost: {} }); });
    await page.locator('#sfRehearse').click(); await page.locator('[data-rehearsal-result="diff"]').waitFor(); assert.match(await page.locator('[data-rehearsal-result]').innerText(), /차이 1곳 \(projects \d+→\d+\)/);
    await page.evaluate(() => { state.projects = state.projects.filter(p => p.name !== 'TEST_NEW_AFTER_SNAP'); });
    await page.locator('#sfBackup').click(); assert.deepEqual(await page.evaluate(() => __v447Calls.download.map(x => x.fname)), ['export'], 'backup button uses the existing export');
    const pruned = await page.evaluate(async () => { const db = await hjAuditOpen(); await new Promise(res => { const tx = db.transaction('log', 'readwrite'); tx.objectStore('log').add({ at: new Date(Date.now() - 91 * 86400000).toISOString(), kind: 'import', target: 'TEST_OLD_ROW', count: 1, by: 'owner', device: 'PC' }); tx.oncomplete = res; }); const n = await hjAuditPrune(); return { n, left: (await hjAuditAll()).filter(a => a.target === 'TEST_OLD_ROW').length }; });
    assert(pruned.n >= 1 && pruned.left === 0, '90-day rotation removes old rows');
    await page.locator('#sfAudit').click(); await page.locator('#hjAudit').waitFor(); assert((await page.locator('[data-audit-row]').count()) >= 1);
    await page.locator('#auditKind').selectOption('snapshot'); await page.locator('#hjAudit').waitFor(); await page.waitForTimeout(100);
    const kinds = await page.locator('[data-audit-row] b').allInnerTexts(); assert(kinds.length && kinds.every(k => k === '안전판'), 'kind filter: ' + kinds);
    await tapOk('#modalRoot .mfoot button, #auditKind, #auditFrom'); await noOverflow();
    await footer('CSV').click(); const csv = await page.evaluate(() => __v447Calls.download.filter(x => /변경기록_/.test(x.fname)).pop());
    assert.match(csv.fname, /^변경기록_\d{4}-\d{2}-\d{2}\.csv$/); assert.match(csv.text, /^﻿시각,종류,대상,개수,누가,기기\n/); assert(/안전판/.test(csv.text)); assert(!csv.text.includes(NAME), 'csv has no personal data');
    assert.deepEqual((await snapshot()).keys, before.keys, 'no new top-level serialized keys (audit lives in its own IndexedDB)');
    assert.equal(await page.evaluate(async () => { const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'hyeonjang-audit' }]; return dbs.some(d => d.name === 'hyeonjang-audit'); }), true);
    await close(); await page.evaluate(() => openGdriveSetup()); await page.locator('#setTab-etc').click(); await page.locator('#hjSafetyOpen').click(); await page.locator('#hjSafety').waitFor();
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v447Calls.external), []);
  });
  console.log(`retention-v447: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL retention-v447', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

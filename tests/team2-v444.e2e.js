/* v444 👷 팀 앱 연동 2 — 내일 일정 한 번에 지시 패킷(공종 틀·guideKey·메모 정리·개인정보 막힘·다시 보내면 같은 번호) ·
   작업 보고 가져오기(v432 길) · 직원 모드(금액·번호 가림, 삭제 숨김, 탭·설정 막기, by:'staff' 표식, 사진 노트, 대표 확인) · 사진 찍는 법.
   합성 데이터만, 다운로드·복사·공유는 기록용 스텁, 외부 쓰기 0.
   HJ_V444_BASELINE=<commit> 은 TEAM2_API_PRESENT 에서, HJ_V444_MUTATION=mask-off(금액 가림 끔)는 STAFF_MONEY_MASKED 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const LEAK = 'TEST_T1 누수', TILE = 'TEST_T2 욕실 타일', PAPER = 'TEST_T3 도배';
const CUST = { name: 'TEST홍길동', phone: '010-4321-8765', addr: '대전 중구 대흥동 12-3 101동 1203호' };
const MONEY = /\d[\d,]*\s*(?:만\s*)?원(?![가-힣])/, PHONE = /0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/;
const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 100, 96, 248, 95, 15, 0, 2, 135, 1, 128, 235, 71, 186, 146, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
const baseline = process.env.HJ_V444_BASELINE && execFileSync('git', ['show', process.env.HJ_V444_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

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
    window.__v444 = { downloads: [], copies: [], shares: [], external: [], snapshots: [], toasts: [], deliver: [] };
    window.open = (...args) => { __v444.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v444.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v444.copies.push(t); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjWoBuildDay', 'hjWoTomorrowView', 'hjWoRecordMany', 'hjPhotoGuideView', 'hjStaffSet', 'hjStaffView', 'hjStaffMaskNode', 'hjStaffRecords', 'hjStaffReviewView'].every(k => typeof window[k] === 'function') && typeof HJ_PHOTO_GUIDE === 'object' && typeof HJ_WO_CHECKLIST_BY === 'object'), true, 'TEAM2_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjWoDownload = (text, name) => { __v444.downloads.push({ name, text }); };
    hjWoShare = async (text, name) => { __v444.shares.push({ name, text }); return true; };
    coworkCopy = (text, label) => { __v444.copies.push(String(text)); };
    const realToast = toast; toast = m => { __v444.toasts.push(String(m)); return realToast(m); };
    const realSnap = hjSnapshot; hjSnapshot = async (label, force, allowEmpty) => { __v444.snapshots.push(String(label)); return realSnap(label, force, allowEmpty); };
    const realDeliver = hjDocDeliverView; hjDocDeliverView = (...args) => { __v444.deliver.push({ html: String(args[1]) }); return realDeliver(...args); };
  });
  if (process.env.HJ_V444_MUTATION) {
    assert.equal(process.env.HJ_V444_MUTATION, 'mask-off');
    await page.evaluate(() => { hjStaffMaskNode = () => 0; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS team2-v444 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed(opts = {}) {
    await close();
    return page.evaluate(async ({ LEAK, TILE, PAPER, CUST, opts }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      try { localStorage.removeItem('hj_role'); localStorage.removeItem('hj_staff_pin'); } catch (e) {}
      hjStaffApply();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = []; state.expenses = [];
      const today = localDate(), tomorrow = hjAddDays(today, 1), later = hjAddDays(today, 2);
      const project = (name, kind, extra) => Object.assign({ name, kind, stage: 2, phases: [], customer: { name: CUST.name, phone: CUST.phone, addr: CUST.addr }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }, extra || {});
      const leak = project(LEAK, 'leak'); leak.leak = { intake: { where: ['욕실'], at: today + 'T01:00:00.000Z' }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', at: today + 'T02:00:00.000Z' } };
      state.projects = [leak, project(TILE, 'interior', { received: 1500000, contract: 3300000 }), project(PAPER, 'interior')];
      state.contacts = [{ id: 'TEST_CONTACT_CREW', name: '이윤규', phone: '010-0000-0002', team: true, tag: '팀원' }, { id: 'TEST_CONTACT_CUST', name: CUST.name, phone: CUST.phone, tag: '고객', memo: '' }];
      state.payLog = [{ id: 'TEST_PAY_1', date: today, project: TILE, amount: 1500000, method: '계좌', memo: '계약금' }];
      state.schedule = [
        { id: 'TEST_SCH_LEAK', project: LEAK, title: CUST.name + ' 댁 누수 탐지', date: tomorrow, time: '09:00', endTime: '11:00', crew: '이윤규', memo: '고객 ' + CUST.name + ' ' + CUST.phone + ' 연락 후 방문\n잔금 50만원 받기\n아랫집 천장 얼룩 확인' },
        { id: 'TEST_SCH_TILE', project: TILE, title: opts.moneyTitle ? '방수 2차 · 잔금 확인' : '방수 2차', date: tomorrow, time: '13:00', crew: '김철수', memo: '101동 1203호 욕실' },
        { id: 'TEST_SCH_PAPER', project: PAPER, title: '도배 정배', date: tomorrow, time: '10:00', crew: '', urgent: true },
        { id: 'TEST_SCH_MONEY', project: TILE, title: '💰 수금: ' + TILE, date: tomorrow },
        { id: 'TEST_SCH_LATER', project: TILE, title: '줄눈', date: later, time: '09:00' },
        { id: 'TEST_SCH_TODAY', project: TILE, title: '타일 붙이기', date: today, time: '09:00', crew: '김철수', report: { done: '바탕 정리', actualWorkers: '2', material: '', issue: '', progress: '시작', weather: '맑음', filledAt: today + 'T09:00:00.000Z' } },
        { id: 'TEST_SCH_TODAY2', project: TILE, title: '줄눈 준비', date: today, time: '14:00', crew: '김철수' }];
      state.activeProject = TILE; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null;
      for (const k of Object.keys(__v444)) __v444[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V444_SEED_SAVE_FAILED');
      return { today, tomorrow };
    }, { LEAK, TILE, PAPER, CUST, opts });
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
    if (!process.env.HJ_V444_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V444_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V444_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const settle = () => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; });

  let days, sentIds;
  await test('① 내일 일정 3건 → 지시 3개(시간순 번호·공종 체크리스트·guideKey·메모 정리) · 개인정보 막힘 · 원자 저장 1번 · 다시 보내면 같은 번호', async () => {
    // 개인정보(돈 이야기) 남은 일정이 있으면 보내지 않는다 — 기록·다운로드 0
    days = await seed({ moneyTitle: true }); let before = await snapshot();
    await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
    assert.equal(await page.locator('[data-wo-day-order]').count(), 3, 'money schedule and other days excluded');
    assert.equal(await page.locator('#woDayStatus [data-wo-day-privacy="fail"]').count(), 1, 'WO_DAY_PRIVACY_BLOCKS');
    await footer('💾 JSON 저장').click(); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __v444.downloads.length), 0); sameSnapshot(await snapshot(), before, 'blocked packet is not recorded');
    await close();

    days = await seed(); const { today, tomorrow } = days;
    const built = await page.evaluate(d => { const b = hjWoBuildDay(d); return { packet: b.packet, issues: b.refs.map(r => r.issues), schema: hjWoValidate(b.packet), by: HJ_WO_CHECKLIST_BY }; }, tomorrow);
    assert.deepEqual(built.schema, []); assert.deepEqual(built.issues, [[], [], []]);
    const o = built.packet.orders, ymd = today.replace(/-/g, '');
    assert.deepEqual(o.map(x => x.project.name), [LEAK, PAPER, TILE], 'time order 09:00 · 10:00 · 13:00');
    assert.deepEqual(o.map(x => x.id), ['wo_' + ymd + '_001', 'wo_' + ymd + '_002', 'wo_' + ymd + '_003']);
    assert.deepEqual(o.map(x => x.guideKey), ['leakDetect', 'wallpaper', 'tile']);
    assert.deepEqual(o.map(x => x.checklist), [built.by['누수 탐지'], built.by['도배'], built.by['타일']]);
    assert.deepEqual(o.map(x => x.title), ['고객 댁 누수 탐지 (누수 탐지)', '도배 정배 (도배)', '방수 2차 (타일)']);
    assert.deepEqual(o.map(x => x.assignee), ['이윤규', '', '김철수']); assert.deepEqual(o.map(x => x.priority), ['normal', 'urgent', 'normal']);
    assert.deepEqual([o[0].due, o[0].startTime, o[0].endTime], [tomorrow, '09:00', '11:00']);
    assert.match(o[0].detail, /아랫집 천장 얼룩 확인/); assert.doesNotMatch(o[0].detail, /잔금|50만원/); assert.doesNotMatch(o[2].detail, /1203호/);
    const json = JSON.stringify(built.packet);
    assert(!json.includes(CUST.name) && !json.replace(/\D/g, '').includes(CUST.phone.replace(/\D/g, '')) && !MONEY.test(json), 'WO_DAY_NO_PRIVATE');

    before = await snapshot();
    await page.evaluate(() => { state.tab = 'schedule'; render(); }); await tapOk('#schTeamTomorrow'); await page.locator('#schTeamTomorrow').click(); await page.locator('#hjWoDay').waitFor();
    assert.equal(await page.locator('[data-wo-day-order]').count(), 3); assert.equal(await page.locator('#woDayStatus [data-wo-day-privacy="ok"]').count(), 1);
    assert.equal(await page.locator('[data-wo-day-resend]').count(), 0);
    await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('01-day-packet');
    sameSnapshot(await snapshot(), before, 'opening the day view is read only');
    await page.evaluate(() => { __v444.snapshots = []; });
    await footer('💾 JSON 저장').click();
    await page.waitForFunction(names => names.every(n => hjWoOrders(state.projects.find(p => p.name === n)).length === 1), [LEAK, TILE, PAPER]);
    await settle();
    const rec = await page.evaluate(async names => { const stored = await idbGetStrict('appState');
      return { live: names.map(n => { const w = hjWoOrders(state.projects.find(p => p.name === n))[0]; return [w.packetId, w.guideKey, w.items.map(x => x.kind + ':' + x.ref).join(), w.checklist.length]; }),
        stored: names.map(n => ((stored.projects || []).find(p => p.name === n).workOrders || []).length), notes: state.notes.filter(x => x.text.startsWith('[팀 지시]')).length, snaps: __v444.snapshots.slice(), dl: __v444.downloads.map(d => d.name) }; }, [LEAK, PAPER, TILE]);
    assert.deepEqual(rec.live.map(r => r.slice(0, 3)), [[o[0].id, 'leakDetect', 'sched:TEST_SCH_LEAK'], [o[1].id, 'wallpaper', 'sched:TEST_SCH_PAPER'], [o[2].id, 'tile', 'sched:TEST_SCH_TILE']]);
    assert.deepEqual(rec.stored, [1, 1, 1], 'saved atomically'); assert.equal(rec.notes, 3); assert.deepEqual(rec.snaps, ['팀 지시(하루치) 기록 전'], 'one snapshot for the day');
    assert.deepEqual(rec.dl, ['work-order_' + tomorrow.replace(/-/g, '') + '_3건.json']);
    const sentPacket = JSON.parse(await page.evaluate(() => __v444.downloads[0].text));
    assert.deepEqual(sentPacket.orders.map(x => x.id), o.map(x => x.id)); assert.deepEqual(await page.evaluate(p => hjWoValidate(p), sentPacket), []);
    sentIds = o.map(x => x.id);
    await close();
    // 다시 열면 같은 번호(다시 보냄) — 기록은 resent 만 늘고 새 지시가 생기지 않는다
    await page.evaluate(() => hjWoTomorrowView()); await page.locator('#hjWoDay').waitFor();
    assert.equal(await page.locator('[data-wo-day-resend]').count(), 3);
    assert.deepEqual(await page.locator('[data-wo-day-order]').evaluateAll(n => n.map(x => x.dataset.woDayOrder)), sentIds);
    await footer('📋 복사').click(); await page.waitForFunction(() => state.notes.filter(x => /\(다시 보냄\)/.test(x.text)).length === 3);
    assert.deepEqual(await page.evaluate(names => names.map(n => { const w = hjWoOrders(state.projects.find(p => p.name === n)); return [w.length, w[0].resent]; }), [LEAK, PAPER, TILE]), [[1, 1], [1, 1], [1, 1]]);
    assert.equal(await page.evaluate(() => __v444.copies.length), 1);
    await close();
    await page.evaluate(() => hjWoTomorrowView('2030-01-02')); await page.locator('[data-wo-day-empty]').waitFor(); await close();
  });

  await test('② 팀 앱 작업 보고 가져오기(v432 길) — 하루치 지시 번호로 완료·막힘 반영 · 첫 화면 줄 · 중복 0', async () => {
    const { today } = days;
    const report = { type: 'hj-work-report', version: 1, sentAt: new Date().toISOString(), reporter: '이윤규', reports: [
      { id: 'TEST_R_DONE', orderId: sentIds[0], project: { name: LEAK }, status: 'done', workDate: today, hours: 2, done: '청음 탐지 · 온수관 확인', checklist: [{ text: '계량기 사진(멈춤 확인)', ok: true }] },
      { id: 'TEST_R_BLOCKED', orderId: sentIds[2], project: { name: TILE }, status: 'blocked', workDate: today, hours: 0, issue: '자재 미도착' }] };
    const text = JSON.stringify(report);
    const m = await page.evaluate(t => { const p = hjWrParse(t); return { ok: p.ok, match: p.reports.map(r => { const x = hjWrMatch(r); return x && [x.project, x.order]; }) }; }, text);
    assert.equal(m.ok, true); assert.deepEqual(m.match, [[LEAK, sentIds[0]], [TILE, sentIds[2]]]);
    await page.evaluate(t => hjTeamReportImportView({ text: t, files: [] }), text); await page.locator('[data-ti-report]').first().waitFor();
    assert.equal(await page.locator('[data-ti-matched]').count(), 2);
    await footer('반영').click();
    await page.waitForFunction(({ leak, tile }) => [leak, tile].every(n => hjWoOrders(state.projects.find(p => p.name === n))[0].reports.length === 1), { leak: LEAK, tile: TILE });
    await page.waitForFunction(() => !document.querySelector('#hjTeamImport')); await close();
    const r = await page.evaluate(({ leak, tile }) => ({ rep: hjWoOrders(state.projects.find(p => p.name === leak))[0].reports.map(x => [x.key, x.status]), blocked: hjWoOrders(state.projects.find(p => p.name === tile))[0].reports.map(x => [x.key, x.status]), loose: (state.projects.find(p => p.name === tile).teamReports || []).length, work: state.workLogs.filter(w => w.project === leak).length }), { leak: LEAK, tile: TILE });
    assert.deepEqual(r.rep, [['TEST_R_DONE', 'done']]); assert.deepEqual(r.blocked, [['TEST_R_BLOCKED', 'blocked']], 'blocked report sits on its order'); assert.equal(r.loose, 0); assert.equal(r.work, 1);
    await page.evaluate(() => { state.tab = 'dashboard'; render(); }); await page.locator('[data-team-report-pending]').waitFor();
    assert.match(await page.locator('[data-team-report-pending]').innerText(), /막힘 1건/);
    await page.evaluate(t => hjTeamReportImportView({ text: t, files: [] }), text); await page.locator('[data-ti-report]').first().waitFor();
    assert.equal(await page.locator('[data-ti-dup]').count(), 2, 'already applied'); await footer('반영').click(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => state.workLogs.length), 1, 'duplicate import adds nothing');
    await close();
  });

  await test('③ 직원 모드 — PIN 켜기 · 금액·번호 가림(화면·모달, 입력값 그대로) · 삭제 숨김 · 탭·설정 막힘 · 사진·작업시간·보고는 되고 by:staff · 끄기 PIN · 대표 확인', async () => {
    await seed();
    const views = () => page.evaluate(async tile => { const out = {};
      for (const t of ['dashboard', 'project', 'schedule', 'contacts', 'photos']) { state.tab = t; if (t === 'project') state.activeProject = tile; render(); await new Promise(r => setTimeout(r, 30)); out[t] = document.getElementById('view').innerText; }
      state.tab = 'dashboard'; render(); return out; }, TILE);
    const owner = await views();
    assert(Object.values(owner).some(t => MONEY.test(t)), 'owner screens show amounts (the check below is meaningful)');
    assert(PHONE.test(owner.contacts), 'owner contacts show phone numbers');
    assert.deepEqual(await page.evaluate(() => hjStaffSet(true, '12a4')), { ok: false, error: 'PIN 은 숫자 4자리입니다' });
    await page.evaluate(() => hjStaffView()); await page.locator('#hjStaff [data-staff-help]').waitFor(); await tapOk('#stPin'); await tapOk('#modalRoot .mfoot button');
    await page.locator('#stPin').fill('1234'); await footer('👷 직원 모드 켜기').click();
    await page.waitForFunction(() => document.body.classList.contains('hj-staff') && !!document.getElementById('hjStaffBar'));
    await tapOk('#hjStaffOff');
    const ls = await page.evaluate(() => ({ role: localStorage.getItem('hj_role'), pin: localStorage.getItem('hj_staff_pin'), salt: localStorage.getItem('hj_staff_salt') }));
    assert.equal(ls.role, 'staff'); assert.match(ls.pin, /^[0-9a-f]{64}$/); assert.notEqual(ls.pin, '1234'); assert(ls.salt && ls.salt.length >= 8);
    const staff = await views();
    for (const [tab, t] of Object.entries(staff)) { assert(!MONEY.test(t), 'STAFF_MONEY_MASKED ' + tab + ': ' + (t.match(MONEY) || [''])[0]); assert(!PHONE.test(t), 'STAFF_PHONE_MASKED ' + tab); }
    await shot('02-staff-dashboard');
    await page.evaluate(() => { state.tab = 'contacts'; render(); });
    assert(await page.evaluate(() => [...document.querySelectorAll('#view a[href^="tel:"]')].some(a => /\d{9,}/.test(a.getAttribute('href').replace(/\D/g, '')))), 'call buttons keep the number');
    // 모달 — 글자는 가리고 입력값은 그대로
    await page.evaluate(() => openModal('TEST', '<p id="tm">계약 3,300,000원 · 잔금 50만 원 · 연락 010-4321-8765</p><textarea id="tmt">50만원 010-4321-8765</textarea>', [{ label: '닫기', cls: 'ghost', fn: closeModal }]));
    await page.waitForFunction(() => /금액 숨김/.test(document.getElementById('tm')?.textContent || ''));
    const modal = await page.evaluate(() => ({ text: document.getElementById('tm').innerText, value: document.getElementById('tmt').value }));
    assert(!MONEY.test(modal.text) && !PHONE.test(modal.text), 'STAFF_MONEY_MASKED modal ' + modal.text); assert.equal(modal.value, '50만원 010-4321-8765');
    await close();
    // 삭제 단추 — 대표 화면에는 있고 직원 화면에서는 안 보인다
    const hidden = sel => page.evaluate(sel => { const n = [...document.querySelectorAll(sel)]; return { count: n.length, shown: n.filter(x => x.getClientRects().length).length }; }, sel);
    for (const [tab, sel] of [['schedule', '[data-schdel]'], ['contacts', '[data-condel]'], ['project', '[data-delproj]']]) {
      await page.evaluate(([t, tile]) => { state.tab = t; if (t === 'project') state.activeProject = tile; render(); }, [tab, TILE]);
      const h = await hidden(sel); assert(h.count > 0, sel + ' exists'); assert.equal(h.shown, 0, 'STAFF_DELETE_HIDDEN ' + sel);
    }
    await page.evaluate(() => openReportEdit('TEST_SCH_TODAY')); await footer('저장').waitFor();
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].filter(b => /보고 삭제/.test(b.textContent)).map(b => [b.dataset.staffHide, b.getClientRects().length]).join()), '1,0', 'report delete hidden');
    await close();
    // 막힌 탭·설정
    for (const t of ['ledger', 'estimates', 'quotemaker']) { assert.equal(await page.evaluate(t => { state.tab = t; render(); return state.tab; }, t), 'dashboard', 'STAFF_TAB_BLOCKED ' + t); }
    assert(await page.evaluate(() => __v444.toasts.some(m => /직원 모드에서는/.test(m))));
    await page.evaluate(() => openGdriveSetup()); await page.locator('#hjStaff').waitFor(); await close();
    // 되는 일 — 작업시간·작업 보고·사진, by:'staff'
    await page.evaluate(tile => { workPunch(tile); }, TILE);
    await page.evaluate(() => openReportEdit('TEST_SCH_TODAY2')); await page.locator('#rDone').fill('줄눈 준비 끝'); await footer('저장').click();
    await page.waitForFunction(() => (state.schedule.find(s => s.id === 'TEST_SCH_TODAY2').report || {}).by === 'staff');
    await page.evaluate(({ png, tile }) => openPhotoIntake([new File([new Uint8Array(png)], 'staff1.png', { type: 'image/png' })], { project: tile, source: 'gallery' }), { png: PNG_BYTES, tile: TILE });
    await page.locator('#photoIntakeConfirm').click(); await page.locator('#photoIntakeResult').waitFor({ timeout: 30000 }); await page.waitForFunction(() => !__photoIntakeBusy);
    await page.waitForFunction(() => state.notes.some(n => n.by === 'staff' && /^\[직원 사진\]/.test(n.text)), null, { timeout: 8000 });
    await close();
    const marks = await page.evaluate(tile => ({ work: state.workLogs.filter(w => w.project === tile).map(w => w.by), report: state.schedule.find(s => s.id === 'TEST_SCH_TODAY2').report.by,
      photo: state.notes.filter(n => n.by === 'staff').map(n => [n.text, n.project, (n.photos || []).length]), files: state.files.filter(f => f.project === tile).length }), TILE);
    assert.deepEqual(marks.work, ['staff']); assert.equal(marks.report, 'staff'); assert.deepEqual(marks.photo, [['[직원 사진] ' + TILE + ' 1장', TILE, 1]]); assert.equal(marks.files, 1);
    // 끄기 — PIN 틀리면 그대로
    await page.locator('#hjStaffOff').click(); await page.locator('#hjStaff').waitFor();
    await page.locator('#stPin').fill('0000'); await footer('🔓 직원 모드 끄기').click(); await page.waitForFunction(() => /PIN 이 맞지 않습니다/.test(document.getElementById('stIssue').textContent));
    assert.equal(await page.evaluate(() => hjStaffOn()), true);
    await page.locator('#stPin').fill('1234'); await footer('🔓 직원 모드 끄기').click();
    await page.waitForFunction(() => !document.body.classList.contains('hj-staff') && !document.getElementById('hjStaffBar'));
    // 대표 첫 화면 — 직원 기록 3건 확인
    await page.evaluate(() => { state.tab = 'dashboard'; render(); }); await page.locator('[data-staff-records]').waitFor();
    assert.match(await page.locator('[data-staff-records]').innerText(), /직원이 남긴 기록 3건/); await tapOk('[data-staff-review]');
    await page.locator('[data-staff-review]').click(); await page.locator('#hjStaffReview').waitFor(); assert.equal(await page.locator('[data-staff-row]').count(), 3);
    await footer('✅ 모두 확인함').click(); await page.waitForFunction(() => !document.querySelector('#view [data-staff-records]'));
    await page.evaluate(async () => { clearTimeout(__idbSaveTimer); if (!(await guardedPersistCurrentState())) throw Error('TEST_V444_SAVE'); });
    const stored = await page.evaluate(async () => { const s = await idbGetStrict('appState'); return { work: s.workLogs.map(w => [w.by, !!w.seenAt]), rep: s.schedule.find(x => x.id === 'TEST_SCH_TODAY2').report, note: s.notes.filter(n => n.by === 'staff').map(n => n.done) }; });
    assert.deepEqual(stored.work, [['staff', true]]); assert.equal(stored.rep.by, 'staff'); assert(stored.rep.seenAt); assert.deepEqual(stored.note, [true]);
  });

  await test('④ 📷 사진 찍는 법 — 사진 탭 단추 · 카드 4종 + 공통 4줄 · A4 한 장(문서 엔진) · guideKey 검사(선택 필드) · 읽기 전용', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => { state.tab = 'photos'; render(); }); await tapOk('#btnPhotoGuideEmpty'); await page.locator('#btnPhotoGuideEmpty').click(); await page.locator('#hjPhotoGuide').waitFor();
    assert.match(await page.evaluate(() => { const real = state.files; state.files = [{ id: 'TEST_PH', kind: 'photo', name: 'a.jpg', ext: 'jpg', project: null, date: localDate() }]; try { return viewPhotos(); } finally { state.files = real; } }), /id="btnPhotoGuide"/, 'photo tools carry the guide button');
    assert.deepEqual(await page.locator('#hjPhotoGuide [data-guide]').evaluateAll(n => n.map(x => x.dataset.guide)), ['leakDetect', 'tile', 'wallpaper', 'finish']);
    assert.equal(await page.locator('#hjPhotoGuide [data-guide-tips] li').count(), 4);
    await tapOk('#modalRoot .mfoot button'); await noOverflow(); await shot('03-photo-guide');
    await footer('🖨 A4 한 장').click(); await page.waitForFunction(() => __v444.deliver.length === 1);
    const html = await page.evaluate(() => __v444.deliver[0].html); assert.match(html, /사 진 찍 는 법/); assert.equal((html.match(/data-guide="/g) || []).length, 4);
    await close();
    const v = await page.evaluate(leak => { const pk = hjWoBuild(leak, { title: '누수 탐지' }), o = pk.orders[0];
      const bad = JSON.parse(JSON.stringify(pk)); bad.orders[0].guideKey = 'nope'; const none = JSON.parse(JSON.stringify(pk)); delete none.orders[0].guideKey;
      return { key: o.guideKey, ok: hjWoValidate(pk), bad: hjWoValidate(bad), none: hjWoValidate(none) }; }, LEAK);
    assert.equal(v.key, 'leakDetect', 'single send (v432) also carries guideKey'); assert.deepEqual(v.ok, []); assert(v.bad.includes('orders[0].guideKey')); assert.deepEqual(v.none, [], 'guideKey stays optional');
    sameSnapshot(await snapshot(), before, 'photo guide is read only');
  });

  await test('⑤ 계약 — 새 최상위 키 없음 · 더보기 126 · 390px · 오류·외부 쓰기 0', async () => {
    await seed(); const keys0 = (await snapshot()).keys;
    await page.evaluate(() => { state.tab = 'schedule'; render(); }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'schedule 390px');
    await page.evaluate(() => { state.tab = 'dashboard'; render(); }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'dashboard 390px');
    assert.deepEqual((await snapshot()).keys, keys0, 'no new top-level keys');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v444.external), []);
  });
  console.log(`team2-v444: ${passed}/${passed} PASS; synthetic data; downloads/shares stubbed; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL team2-v444', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

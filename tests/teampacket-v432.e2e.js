/* v432 팀 패킷 연동 — 합성 레코드만. 다운로드·공유·클립보드는 기록용 스텁, 외부 쓰기 0.
   HJ_V432_BASELINE=<commit> 은 TEAMPACKET_API_PRESENT 에서, HJ_V432_MUTATION=privacy-off(개인정보 필터 제거) 는 WO_PRIVACY_BLOCKS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_PACKET_LEAK', INT = 'TEST_PACKET_INTERIOR';
const PRIVATE = ['TEST_PRIVATE_CUSTOMER', '010-0000-0000', 'TEST_PRIVATE_ADDRESS 101동 1203호'];
const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 100, 96, 248, 95, 15, 0, 2, 135, 1, 128, 235, 71, 186, 146, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V432_BASELINE && execFileSync('git', ['show', process.env.HJ_V432_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v432Calls = { downloads: [], copied: [], shares: [], external: [], snapshots: [] };
    window.open = (...args) => { __v432Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v432Calls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v432Calls.copied.push(t); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjWoBuild', 'hjWoValidate', 'hjWoPrivacyIssues', 'hjTeamPacketSendView', 'hjWrParse', 'hjWrMatch', 'hjWrApply', 'hjTeamReportImportView', 'hjTeamReportPending'].every(k => typeof window[k] === 'function')), true, 'TEAMPACKET_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V432_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjWoDownload = (text, name) => { __v432Calls.downloads.push({ name, text }); };
    hjWoShare = async (text, name) => { __v432Calls.shares.push({ name, text }); return true; };
    const realSnap = hjSnapshot; hjSnapshot = async (label, force, allowEmpty) => { __v432Calls.snapshots.push(String(label)); return realSnap(label, force, allowEmpty); };
  });
  if (process.env.HJ_V432_MUTATION) {
    assert.equal(process.env.HJ_V432_MUTATION, 'privacy-off');
    await page.evaluate(() => { hjWoPrivacyIssues = () => []; });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS teampacket-v432 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ leak, int, privateFields }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.workLogs = [];
      const today = localDate(), tomorrow = hjAddDays(today, 1);
      const project = (name, kind) => ({ name, kind, stage: 2, phases: [], customer: { name: privateFields[0], phone: privateFields[1], addr: privateFields[2] }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak'); p.leak = { intake: { where: ['욕실'], at: today + 'T01:00:00.000Z' }, detect: { methods: ['청음'], cause: '온수관', zone: '전유부', at: today + 'T02:00:00.000Z' } };
      p.checklist = [{ id: 'TEST_CK_1', text: '실리콘 투명 3개', done: false }, { id: 'TEST_CK_2', text: '이미 챙김', done: true }];
      state.projects = [p, project(int, 'interior')];
      state.contacts = [{ id: 'TEST_CONTACT_CREW', name: '이윤규', phone: '010-0000-0002', team: true, tag: '팀원' }];
      state.notes = [{ id: 'TEST_TODO_1', date: '2026-10-16 09:00', day: today, text: 'TEST_TODO_TILE', project: leak, todo: true, done: false },
        { id: 'TEST_TEAM_1', date: '2026-10-16 09:00', day: today, text: '[팀 업무]', project: leak, todo: true, done: false, teamTask: { schema: 1, title: 'TEST_TEAM_TASK', assignee: '이윤규', status: 'todo', due: tomorrow, recorder: '전병덕' } },
        { id: 'TEST_TODO_OTHER', date: '2026-10-16 09:00', day: today, text: 'TEST_OTHER_PROJECT_TODO', project: int, todo: true, done: false }];
      state.schedule = [{ id: 'TEST_SCH_1', project: leak, title: '방수 2차', date: tomorrow, time: '09:00', endTime: '12:00', workers: 2, crew: '이윤규' }, { id: 'TEST_SCH_MONEY', project: leak, title: '💰 수금: ' + leak, date: tomorrow }];
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v432Calls)) __v432Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V432_SEED_SAVE_FAILED');
    }, { leak: LEAK, int: INT, privateFields: PRIVATE });
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
    if (!process.env.HJ_V432_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V432_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V432_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const noSecrets = (json, label) => { for (const secret of [PRIVATE[0], PRIVATE[1], PRIVATE[1].replace(/-/g, ''), '1203호']) assert(!json.includes(secret), label + ': ' + secret + ' must be absent'); assert(!/\d[\d,]{2,}\s*원/.test(json), label + ': no money'); };
  const todayYmd = await page.evaluate(() => localDate()), tomorrowYmd = await page.evaluate(() => hjAddDays(localDate(), 1));

  await test('work order: candidates, schema, privacy block, record with a stable id on resend', async () => {
    await seed(); const before = await snapshot();
    const built = await page.evaluate(name => { const pk = hjWoBuild(name, { title: 'T', detail: 'D', assignee: '이윤규', due: hjAddDays(localDate(), 1), priority: 'urgent', checklist: ['a', 'b'], photosWanted: ['before', 'after'], notes: 'N' }); return { pk, errors: hjWoValidate(pk), issues: hjWoPrivacyIssues(pk, state.projects[0]), cands: hjWoCandidates(name) }; }, LEAK);
    assert.deepEqual(built.errors, []); assert.deepEqual(built.issues, []); const o = built.pk.orders[0];
    assert.equal(built.pk.type, 'hj-work-order'); assert.equal(built.pk.version, 1); assert.equal(built.pk.issuer, '만물인테리어'); assert.match(o.id, /^wo_\d{8}_001$/); assert.deepEqual(o.project, { name: LEAK, kind: 'leak', addr: 'TEST_PRIVATE_ADDRESS', unit: '101동 1203호' });
    assert.equal(o.priority, 'urgent'); assert.deepEqual(o.checklist, ['a', 'b']); assert.deepEqual(o.photosWanted, ['before', 'after']); assert.equal(o.contactMasked, '010-****-8629');
    noSecrets(JSON.stringify({ ...built.pk, orders: [{ ...o, project: { ...o.project, unit: '' } }] }), 'packet');
    assert.deepEqual(built.cands.map(c => c.kind), ['todo', 'team', 'prep', 'sched'], JSON.stringify(built.cands.map(c => c.key))); assert(!built.cands.some(c => /💰/.test(c.text)), 'money schedule is not a work item'); assert.equal(built.cands[3].due, tomorrowYmd);
    const bad = await page.evaluate(name => ({ phone: hjWoPrivacyIssues(hjWoBuild(name, { notes: '고객 010-0000-0000' }), state.projects[0]), name: hjWoPrivacyIssues(hjWoBuild(name, { detail: 'TEST_PRIVATE_CUSTOMER 님' }), state.projects[0]), money: hjWoPrivacyIssues(hjWoBuild(name, { detail: '잔금 300,000원' }), state.projects[0]), schema: hjWoValidate({ type: 'hj-work-order', version: 1, orders: [{ id: 'x', project: {}, title: '', priority: 'high', checklist: 'a', photosWanted: ['x'], extra: 1 }] }) }), LEAK);
    assert(bad.phone.includes('고객 전화번호'), 'WO_PRIVACY_BLOCKS'); assert(bad.name.includes('고객 이름')); assert(bad.money.includes('금액')); assert(bad.schema.length >= 6);
    sameSnapshot(await snapshot(), before, 'building a packet is read only');
    await page.evaluate(name => hjTeamPacketSendView(name), LEAK); await page.locator('#hjTeamPacket').waitFor();
    assert.equal(await page.locator('[data-wo-item]').count(), 4); assert.equal(await page.locator('[data-wo-item]:checked').count(), 4); assert.equal(await page.locator('#woAssignee').inputValue(), '이윤규'); assert.equal(await page.locator('#woDue').inputValue(), tomorrowYmd);
    assert.equal(await page.locator('[data-wo-privacy="ok"]').count(), 1); assert.match(await page.locator('#woDetail').inputValue(), /TEST_TODO_TILE[\s\S]*TEST_TEAM_TASK[\s\S]*준비물: 실리콘 투명 3개[\s\S]*방수 2차/);
    const preview = JSON.parse(await page.locator('#woPreview').evaluate(n => n.textContent)); assert.deepEqual(await page.evaluate(pk => hjWoValidate(pk), preview), []); noSecrets(JSON.stringify(preview).replace('101동 1203호', ''), 'preview'); const id = preview.orders[0].id;
    await tapOk('[data-wo-priority], #modalRoot .mfoot button'); await noOverflow(); await shot('01-send-form');
    await page.locator('#woNotes').fill('고객 ' + PRIVATE[1] + ' 연락'); await page.waitForSelector('[data-wo-privacy="fail"]');
    await footer('JSON 저장').click(); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(name => hjWoOrders(state.projects.find(p => p.name === name)).length, LEAK), 0, 'privacy failure blocks sending'); assert.equal(await page.evaluate(() => __v432Calls.downloads.length), 0);
    await page.locator('#woNotes').fill('관리사무소 09시 전 소음 금지'); await page.waitForSelector('[data-wo-privacy="ok"]');
    await footer('JSON 저장').click(); await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, LEAK);
    const rec = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name); return { wo: hjWoOrders(p)[0], note: state.notes.find(n => n.text.startsWith('[팀 지시]')), dl: __v432Calls.downloads, stored: (await idbGetStrict('appState')).projects.find(x => x.name === name).workOrders, keys: Object.keys(serializeData()).sort() }; }, LEAK);
    assert.equal(rec.wo.packetId, id); assert.equal(rec.wo.assignee, '이윤규'); assert.equal(rec.wo.due, tomorrowYmd); assert.equal(rec.wo.items.length, 4); assert.deepEqual(rec.wo.reports, []); assert(rec.note); assert.match(rec.note.text, new RegExp('4건 → 이윤규 · ' + id));
    assert.equal(rec.dl.length, 1); assert.equal(rec.dl[0].name, 'work-order_' + id + '.json'); noSecrets(rec.dl[0].text.replace('101동 1203호', ''), 'downloaded json'); assert.deepEqual(rec.stored.map(w => w.packetId), [id]); assert.deepEqual(rec.keys, before.keys, 'no new top-level keys');
    await footer('복사').click(); await page.waitForFunction(() => __v432Calls.copied.length === 1);
    await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name))[0].resent === 1, LEAK);
    const again = await page.evaluate(name => ({ n: hjWoOrders(state.projects.find(p => p.name === name)).length, id: JSON.parse(__v432Calls.copied[0]).orders[0].id, next: hjWoNextId() }), LEAK);
    assert.equal(again.n, 1, 'resend keeps a single record'); assert.equal(again.id, id, 'resend keeps the same id'); assert.match(again.next, /_002$/);
    await close(); await page.evaluate(name => { state.activeProject = name; state.tab = 'project'; render(); }, LEAK); await page.locator('[data-teamsend="' + LEAK + '"]').waitFor(); await tapOk('[data-teamsend]');
    await page.locator('[data-teamsend="' + LEAK + '"]').click(); await page.locator('#hjTeamPacket').waitFor(); assert.match(await page.locator('#woPreview').evaluate(n => n.textContent), /_002/);
  });

  await test('report import: done/review/blocked, worklog, checklist, photos with phase, snapshot once, no duplicate', async () => {
    await seed();
    await page.evaluate(name => hjTeamPacketSendView(name), LEAK); await page.locator('#hjTeamPacket').waitFor(); await footer('JSON 저장').click();
    await page.waitForFunction(name => hjWoOrders(state.projects.find(p => p.name === name)).length === 1, LEAK); await close();
    const orderId = await page.evaluate(name => hjWoOrders(state.projects.find(p => p.name === name))[0].packetId, LEAK);
    const report = { type: 'hj-work-report', version: 1, sentAt: new Date().toISOString(), reporter: '이윤규', reports: [
      { id: 'TEST_REPORT_DONE', orderId, project: { name: LEAK }, status: 'done', workDate: todayYmd, hours: 6.5, done: '타일 철거·방수 2회 완료', issue: '배수구 주변 바탕 보수 필요', checklist: [{ text: '작업 전 사진', ok: true }, { text: '완료 사진', ok: true }], photos: [{ file: 'photos/0001.jpg', phase: 'before', note: '철거 전' }, { file: 'photos/0002.jpg', phase: 'after' }] },
      { project: { name: INT }, status: 'review', workDate: todayYmd, hours: 2, done: '도배 1차', photos: [{ file: 'photos/0003.jpg', phase: 'after' }] },
      { id: 'TEST_REPORT_BLOCKED', project: { name: LEAK }, status: 'blocked', workDate: todayYmd, hours: 0, issue: '자재 미도착' }] };
    const text = JSON.stringify(report);
    const parsed = await page.evaluate(t => { const p = hjWrParse(t); return { ok: p.ok, n: p.reports.length, keys: p.reports.map(r => r.key), matches: p.reports.map(r => hjWrMatch(r)) }; }, text);
    assert.equal(parsed.ok, true); assert.deepEqual(parsed.keys, ['TEST_REPORT_DONE', INT + '|' + todayYmd, 'TEST_REPORT_BLOCKED']); assert.deepEqual(parsed.matches.map(m => m && m.project), [LEAK, INT, LEAK]); assert.equal(parsed.matches[0].order, orderId); assert.equal(parsed.matches[2].order, '');
    await page.evaluate(({ t, png }) => { const file = n => new File([new Uint8Array(png)], n, { type: 'image/png' }); hjTeamReportImportView({ text: t, files: [file('0001.jpg'), file('0002.jpg'), file('0003.jpg')] }); }, { t: text, png: PNG_BYTES });
    await page.locator('#hjTeamImport').waitFor(); await page.locator('[data-ti-report]').first().waitFor();
    assert.equal(await page.locator('[data-ti-report]').count(), 3); assert.equal(await page.locator('[data-ti-matched]').count(), 3); assert.equal(await page.locator('[data-ti-unmatched]').count(), 0);
    await tapOk('#tiPreview, #modalRoot .mfoot button'); await noOverflow(); await shot('02-import-preview');
    await page.evaluate(() => { __v432Calls.snapshots = []; });
    await footer('반영').click(); await page.locator('#photoIntakeProject').waitFor();
    const applied = await page.evaluate(async ({ leak, int }) => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === leak), q = state.projects.find(x => x.name === int); const wo = hjWoOrders(p)[0];
      return { reports: wo.reports.map(r => [r.key, r.status]), teamReports: (p.teamReports || []).map(r => [r.key, r.status]), todo: state.notes.find(n => n.id === 'TEST_TODO_1').done, team: hjTeamData(state.notes.find(n => n.id === 'TEST_TEAM_1')).status, teamDone: state.notes.find(n => n.id === 'TEST_TEAM_1').done, other: state.notes.find(n => n.id === 'TEST_TODO_OTHER').done, ck: p.checklist.map(c => c.done), work: state.workLogs.map(w => ({ project: w.project, date: w.date, in: w.in, out: w.out, key: w.teamReport && w.teamReport.key })), intReports: (q.teamReports || []).map(r => r.status), pending: hjTeamReportPending().map(r => [r.project, r.status]), snaps: __v432Calls.snapshots.filter(l => l === '팀 작업 가져오기 전').length, notes: state.notes.filter(n => n.text.startsWith('[팀 보고]')).length, intakeProject: document.getElementById('photoIntakeProject').selectedOptions[0].textContent }; }, { leak: LEAK, int: INT });
    assert.deepEqual(applied.reports, [['TEST_REPORT_DONE', 'done']]); assert.deepEqual(applied.teamReports, [['TEST_REPORT_BLOCKED', 'blocked']]); assert.deepEqual(applied.intReports, ['review']);
    assert.equal(applied.todo, true); assert.equal(applied.team, 'done'); assert.equal(applied.teamDone, true); assert.equal(applied.other, false, 'other project todo untouched'); assert.deepEqual(applied.ck, [true, true]);
    assert.deepEqual(applied.work, [{ project: LEAK, date: todayYmd, in: '09:00', out: '15:30', key: 'TEST_REPORT_DONE' }]); assert.deepEqual(applied.pending, [[LEAK, 'blocked'], [INT, 'review']]); assert.equal(applied.snaps, 1, 'one snapshot for the import batch'); assert.equal(applied.notes, 3); assert.equal(applied.intakeProject, LEAK);
    await page.evaluate(() => { state.tab = 'dashboard'; }); // dashboard line checked after photos
    await page.locator('#photoIntakeConfirm').click();
    await page.waitForFunction(name => state.files.filter(f => f.project === name && f._teamReport).length === 2, LEAK, { timeout: 30000 });
    await page.locator('#photoIntakeProject').waitFor(); assert.equal(await page.evaluate(() => document.getElementById('photoIntakeProject').selectedOptions[0].textContent), INT, 'next project photos follow');
    await page.locator('#photoIntakeConfirm').click();
    await page.waitForFunction(name => state.files.filter(f => f.project === name && f._teamReport).length === 1, INT, { timeout: 30000 });
    const photos = await page.evaluate(({ leak, int }) => ({ leak: state.files.filter(f => f.project === leak).map(f => ({ name: f.name, tag: f._leaktag, phase: f._phase, label: f._worklabel })), int: state.files.filter(f => f.project === int).map(f => ({ tag: f._leaktag, phase: f._phase })) }), { leak: LEAK, int: INT });
    const l1 = photos.leak.find(x => x.name === '0001.jpg'), l2 = photos.leak.find(x => x.name === '0002.jpg');
    assert.equal(l1.tag, 'before'); assert.equal(l1.phase, '시공 전'); assert.equal(l1.label, '철거 전'); assert.equal(l2.tag, 'after'); assert.equal(l2.phase, '완료'); assert.equal(photos.int[0].tag, undefined); assert.equal(photos.int[0].phase, '완료');
    await page.waitForFunction(() => !document.getElementById('photoIntakeProject')); await close();
    await page.evaluate(() => { state.tab = 'dashboard'; render(); }); await page.locator('[data-team-report-pending]').waitFor();
    assert.match(await page.locator('[data-team-report-pending]').innerText(), /검수 요청 1건[\s\S]*막힘 1건/); await shot('03-dashboard-pending');
    const before = await snapshot();
    await page.evaluate(t => hjTeamReportImportView({ text: t, files: [] }), text); await page.locator('[data-ti-report]').first().waitFor();
    assert.equal(await page.locator('[data-ti-dup]').count(), 3, 'all three are already applied'); await footer('반영').click(); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => state.workLogs.length), 1, 'duplicate import adds nothing');
    assert.equal(await page.evaluate(() => state.notes.filter(n => n.text.startsWith('[팀 보고]')).length), 3);
  });

  await test('unmatched report needs a human choice; preview is read only', async () => {
    await seed(); const before = await snapshot();
    const text = JSON.stringify({ type: 'hj-work-report', version: 1, reporter: '이윤규', reports: [{ id: 'TEST_REPORT_UNKNOWN', project: { name: 'TEST_UNKNOWN_PROJECT' }, status: 'doing', workDate: todayYmd, hours: 1, done: '진행 중' }] });
    await page.evaluate(t => hjTeamReportImportView({ text: t }), text); await page.locator('[data-ti-unmatched]').waitFor();
    await tapOk('[data-ti-pick]'); await footer('반영').click(); await page.waitForFunction(() => /현장을 고르거나/.test(document.getElementById('tiIssue')?.textContent || ''));
    sameSnapshot(await snapshot(), before, 'nothing applied without a choice');
    await page.locator('[data-ti-pick]').selectOption(INT); await footer('반영').click();
    await page.waitForFunction(name => (state.projects.find(p => p.name === name).teamReports || []).length === 1, INT);
    assert.deepEqual(await page.evaluate(name => state.projects.find(p => p.name === name).teamReports.map(r => [r.key, r.status]), INT), [['TEST_REPORT_UNKNOWN', 'doing']]);
    const bad = await page.evaluate(() => ({ a: hjWrParse('not json'), b: hjWrParse(JSON.stringify({ type: 'other' })), c: hjWrParse(JSON.stringify({ type: 'hj-work-report', reports: [] })) }));
    assert.equal(bad.a.ok, false); assert.equal(bad.b.ok, false); assert.equal(bad.c.ok, false);
  });

  await test('team board entry, menu contract, sizes, no errors and no external writes', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => hjTeamBoard()); await page.locator('#teamPacketIn').waitFor(); await tapOk('#teamPacketIn'); await page.locator('#teamPacketIn').click(); await page.locator('#hjTeamImport').waitFor();
    sameSnapshot(await snapshot(), before);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v432Calls.external), []);
  });
  console.log(`teampacket-v432: ${passed}/${passed} PASS; synthetic data; downloads/shares stubbed; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL teampacket-v432', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

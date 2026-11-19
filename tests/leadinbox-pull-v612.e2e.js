/* v613 📬 홈페이지 문의 접수함 당겨오기 — 진짜 화면(폰 390)·진짜 안전판·진짜 이 기기 저장, 접수함 서버만 가짜(route 로 script.google.com 응답). 합성 자료, 바깥 쓰기 0.
   ① NOURL     주소가 없으면 큰 단추 없이 한 줄 안내 + 작은 [켜는 법](누르면 '설정에서 넣어 주세요' 안내만 — 요청 0·자료 그대로) → ⚙️ 설정 › ⭐ 기타 칸: 틀린 주소 거절 · 맞는 주소는 이 기기 IDB 에만
   ② PULL      로그인 창(type=password) → 틀린 비밀번호(칸 비움·안내) → 맞는 비밀번호 → 목록(폰 넘침 0·44px) → [📥 열어서 등록] → 미리보기(접수함 칸·메모) →
               [현장으로 등록] → 안전판·이 기기 저장 뒤 leadDecide '승인'(메모·requestId) · 현장 source lead-inbox·접수번호 · 등록한 문의는 '앱에 등록됨'
   ③ RETRY     승인 표시가 끊기면 등록은 그대로 + 안내 → 다시 열면 [✅ 접수함에 승인 표시] → 같은 requestId 로 승인 · 같은 문의를 메일로 붙여 넣어도 '이미 등록된 문의'
   ④ AS        A/S 문의 → 현장 고르기 → AS 관리 기록 · 승인 메모 '현장웹 AS 접수: 현장'
   ⑤ DECIDE    보류 문의 거절: 사유 없으면 요청 없음 → 사유 넣으면 거절·목록으로
   ⑥ EXPIRED   서버 세션이 끝나면 [새로고침] → 로그인 창 '만료' · 메모리 세션 지움
   ⑦ PRIVACY   관리 비밀번호는 leadLogin 요청 본문 한 곳에만 — localStorage·sessionStorage·IndexedDB 모든 값·직렬화 자료·화면 어디에도 없다 ·
               세션 토큰은 이 창 메모리에만 — IndexedDB·localStorage·sessionStorage·직렬화 자료에 없음(v613 검토) · 바깥 쓰기는 가짜 접수함 주소뿐 · 페이지 오류 0
   HJ_V612L_BASELINE=<commit> 은 ① 에서 실패해야 한다(기준선 5a87511 에는 접수함 버튼이 없다). */
'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const ROOT = path.resolve(__dirname, '..');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone', '__hjLeadInboxBootDone'];
const baseline = process.env.HJ_V612L_BASELINE && execFileSync('git', ['show', process.env.HJ_V612L_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const LEAD_URL = 'https://script.google.com/macros/s/TEST_lead_inbox_v612_e2e/exec';
const PASS = 'TEST-only-admin-e2e-77';   // 합성 값 — 실제 관리 비밀번호 아님
// 만물웹 97c4d0b buildLeadText → LeadInboxPure 정규화가 실제로 만드는 message(tests/leadinbox-pull-v612.unit.js 가 HJ_MANMOOL_ROOT 로 대조)
const MSG = {
  interior: '[만물인테리어 상담 신청]\n이름: 최인테\n연락처: 010-2222-3333\n공간: 주거 · 32평 · 대전 유성구 노은동\n범위: 전체 리모델링 · 욕실,주방\n예산/시기: 4천만원대 · 2027년 1월\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 실측 상담 원합니다.\n주말 가능해요.',
  leak: '[만물인테리어 상담 신청]\n연락처: 010-4444-5555\n공간: 누수 · 대전 서구 둔산동\n증상: 아랫집 천장 물자국, 계량기 움직임\n신청 목적: 전화로 증상 상담\n접수 경로: leak-page\n개인정보 수집·이용 동의: 동의\n메모: 퇴근 후 통화 원해요',
  as: '[만물인테리어 상담 신청]\n이름: 김하자\n연락처: 010-1234-5678\n공간: A/S · 대전 서구 둔산동 수정타운아파트\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 욕실 타일 줄눈이 들떴어요.',
  office: '[만물인테리어 상담 신청]\n연락처: 070-1234-5678\n단지명: 테스트 한빛아파트\n관리사무소 담당자: 시설 담당자\n지역: 대전 중구\n관심 업무: 누수·배관, 공용부 보수\n도입 희망 시점: 2027년 1월 협의\n공간: 관리사무소 30일 시험운영\n접수 경로: office-pilot\n개인정보 수집·이용 동의: 동의\n문의 내용: 시험 운영 상담 원합니다.'
};
const ID = n => '2f1c6a5e-8b7d-4c3a-9e1f-0a1b2c3d4e' + String(n).padStart(2, '0');
const row = (n, key, status, extra) => Object.assign({ leadId: ID(n), receiptNo: 'LD-20261119-000' + n, receivedAt: '2026-11-19T0' + n + ':10:00.000Z', status, decidedAt: '', name: '', phone: '', type: '', service: '',
  region: '', area: '', scope: '', works: '', budget: '', movein: '', live: '', symptoms: '', purpose: '', visit: '', memo: '', source: '', sourcePage: '', ctaId: '', utm: '', emailDelivered: 'Y', message: MSG[key], extra: '', updatedAt: '' }, extra);
const server = {
  rows: [
    row(1, 'interior', '신규', { name: '최인테', phone: '010-2222-3333', service: '인테리어', type: '주거', region: '대전 유성구 노은동', works: '욕실, 주방', memo: '실측 상담 원합니다.' }),
    row(2, 'leak', '신규', { name: '(이름 없음)', phone: '010-4444-5555', service: '누수', type: '누수', region: '대전 서구 둔산동', symptoms: '아랫집 천장 물자국, 계량기 움직임', emailDelivered: 'N' }),
    row(3, 'as', '신규', { name: '김하자', phone: '010-1234-5678', service: '인테리어', type: 'A/S', region: '대전 서구 둔산동 수정타운아파트', memo: '욕실 타일 줄눈이 들떴어요.' }),
    row(4, 'office', '보류', { name: '(이름 없음)', phone: '070-1234-5678', service: '관리사무소', type: '관리사무소 30일 시험운영', region: '대전 중구' })
  ],
  sessions: new Map(), history: [], bodies: [], dropDecide: 0, lost: [], tokens: 0
};
const TRANS = { '신규': ['승인', '보류', '거절'], '보류': ['승인', '거절'], '거절': ['보류'], '승인': [] };
function serve(body) {
  const p = body.payload || {};
  if (body.action === 'leadLogin') {
    if (p.adminCode !== PASS) return { ok: false, error: 'invalid-credentials' };
    const token = 'TESTE2ESESSION' + 'y'.repeat(60) + '.' + (++server.tokens); server.sessions.set(token, Date.now() + 8 * 3600e3);
    return { ok: true, sessionToken: token, expiresAt: server.sessions.get(token) };
  }
  if (!(server.sessions.get(body.sessionToken) > Date.now())) return { ok: false, error: 'session-expired' };
  if (body.action === 'leadLogout') { server.sessions.delete(body.sessionToken); return { ok: true, loggedOut: true }; }
  if (body.action === 'leadList') {
    const counts = { '신규': 0, '승인': 0, '보류': 0, '거절': 0 }; server.rows.forEach(r => counts[r.status]++);
    const leads = server.rows.filter(r => p.status === '전체' || r.status === p.status); return { ok: true, leads, total: leads.length, counts };
  }
  if (body.action === 'leadDecide') {
    const row = server.rows.find(r => r.leadId === p.leadId); if (!row) return { ok: false, error: 'not-found' };
    if (p.decision === '거절' && !String(p.memo || '').trim()) return { ok: false, error: 'invalid-input' };
    if (server.history.some(h => h.requestId === p.requestId)) return { ok: true, lead: row, duplicate: true };
    if (!TRANS[row.status].includes(p.decision)) return { ok: false, error: 'invalid-transition' };
    server.history.push({ leadId: row.leadId, from: row.status, to: p.decision, memo: p.memo, requestId: p.requestId }); row.status = p.decision;
    return { ok: true, lead: row };
  }
  return { ok: false, error: 'bad-request' };
}
let browser, page, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const errors = [], network = { writes: [], foreign: [] };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.href === LEAD_URL && request.method() === 'POST') {
      const raw = request.postData() || '', body = JSON.parse(raw); server.bodies.push({ raw, body, type: request.headers()['content-type'] || '' });
      if (body.action === 'leadDecide' && server.dropDecide > 0) { server.dropDecide--; server.lost.push(body); return route.abort('connectionreset'); }
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(serve(body)) });
    }
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes.push(url.href); else network.foreign.push(url.href);
    return route.abort('blockedbyclient');
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS leadinbox-pull-v612 ' + name); }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width, t: n.textContent.trim().slice(0, 20) })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async label => assert(await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return document.documentElement.scrollWidth <= innerWidth + 1 && !!m && m.scrollWidth <= m.clientWidth + 1; }), label + ': no horizontal overflow at 390px');

  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v612lCalls = { external: [] };
    window.open = (...args) => { __v612lCalls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v612lCalls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.slice(0, 4).every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V612L_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
    const site = (name, extra) => Object.assign({ name, kind: 'interior', stage: 0, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }, extra);
    state.projects = [site('TEST 둔산 수정타운 욕실', { stage: 3, doneAt: '2025-04-10' }), site('TEST 상관없는 현장')];
    state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null;
    __relay.url = ''; __relay.token = ''; __gdToken = null;
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V612L_SEED_SAVE_FAILED');
  });
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function center() { await close(); await page.evaluate(() => webWorkCenterOpen()); await page.locator('#webWorkPaste').waitFor(); }
  async function stored() {
    return page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('hyeonjang-db', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const all = await new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readonly'), s = tx.objectStore('kv'), k = s.getAllKeys(), v = s.getAll(); tx.oncomplete = () => resolve(k.result.map((key, i) => [String(key), v.result[i]])); tx.onerror = () => reject(tx.error); });
      db.close();
      const text = value => { try { return JSON.stringify(value) || ''; } catch (_) { return String(value); } };
      return { keys: all.map(e => e[0]), idb: Object.fromEntries(all.map(([k, v]) => [k, text(v)])), local: JSON.stringify(Object.assign({}, localStorage)), session: JSON.stringify(Object.assign({}, sessionStorage)),
        serialized: JSON.stringify(serializeData()), html: document.documentElement.outerHTML, projects: state.projects.map(p => ({ name: p.name, source: p.source || '', receipt: p.sourceReceiptNo || '' })) };
    });
  }

  await test('① NOURL: guidance only before an address exists, then the address goes into this device only', async () => {
    const before = await stored();
    await center();
    assert.equal(await page.locator('#webWorkLeadPanel').getAttribute('data-lead-inbox-panel'), 'off');
    assert.equal(await page.locator('#webWorkLeadPull.blue').count(), 0, 'no big primary button before the inbox is set up');
    await tapOk('#webWorkLeadPull');
    await page.locator('#webWorkLeadPull').click();
    await page.waitForFunction(() => /접수함 주소를 설정에서 넣어 주세요/.test(document.getElementById('webWorkLeadStatus')?.textContent || ''));
    assert.equal(await page.locator('#webWorkPaste').count(), 1, 'still on the center'); assert.equal(server.bodies.length, 0, 'no request');
    assert.deepEqual((await stored()).projects, before.projects);
    await close(); await page.evaluate(() => openGdriveSetup()); await page.locator('#setTab-etc').click();
    await page.locator('#leadInboxSettings').waitFor();
    await page.locator('#liUrl').fill('https://evil.example/macros/s/x/exec'); await page.locator('#liSave').click();
    await page.waitForFunction(() => /주소 형식을 확인해 주세요/.test(document.getElementById('liState').textContent));
    await page.locator('#liUrl').fill(LEAD_URL); await page.locator('#liSave').click();
    await page.waitForFunction(() => /설정됨/.test(document.getElementById('liState').textContent));
    const s = await stored();
    assert.equal(JSON.parse(s.idb.lead_inbox_url), LEAD_URL); assert.equal(s.serialized.includes('TEST_lead_inbox_v612_e2e'), false, 'address not in synced data');
    assert.equal(s.local.includes('TEST_lead_inbox_v612_e2e'), false);
  });

  await test('② PULL: login (wrong → cleared) → list → open → preview → register → save → 승인 with memo', async () => {
    await center();
    assert.equal(await page.locator('#webWorkLeadPanel').getAttribute('data-lead-inbox-panel'), 'on');
    await page.locator('#webWorkLeadPull').click(); await page.locator('#leadInboxCode').waitFor();
    assert.equal(await page.locator('#leadInboxCode').getAttribute('type'), 'password'); await tapOk('#leadInboxCode'); await tapOk('#modalRoot .mfoot button');
    await page.locator('#leadInboxCode').fill('WRONG-admin-e2e-1'); await footer('로그인').click();
    await page.waitForFunction(() => /관리 비밀번호가 맞지 않아요/.test(document.getElementById('leadInboxLoginIssue')?.textContent || ''));
    assert.equal(await page.locator('#leadInboxCode').inputValue(), '', 'field cleared');
    assert.match(await page.locator('[data-lead-inbox-dest]').innerText(), /끝자리 …/, 'login shows where the password goes');
    await page.locator('#leadInboxCode').fill(PASS); await footer('로그인').click();
    await page.locator('[data-lead-inbox-list="3"]').waitFor();
    assert.equal((await stored()).keys.includes('lead_inbox_session'), false, 'session kept in memory only');
    assert.equal(await page.locator('[data-lead-inbox-row]').count(), 3); assert.match(await page.locator('[data-lead-inbox-rows]').innerText(), /최인테[\s\S]*메일 미발송/);
    await tapOk('[data-lead-inbox-open]'); await tapOk('[data-lead-inbox-filter]'); await noOverflow('list');
    await page.locator('[data-lead-inbox-open="' + ID(1) + '"]').click();
    await page.locator('[data-lead-inbox-box]').waitFor();
    assert.match(await page.locator('[data-lead-inbox-box]').innerText(), /LD-20261119-0001[\s\S]*신규/);
    assert.match(await page.locator('[data-web-work-preview]').innerText(), /인테리어[\s\S]*LD-20261119-0001[\s\S]*최인테/);
    assert.deepEqual(await page.locator('#modalRoot .mfoot button').allInnerTexts(), ['현장으로 등록', '← 접수함 목록', '닫기']);
    await tapOk('[data-lead-inbox-decide]'); await noOverflow('preview');
    await page.locator('#leadInboxMemo').fill('토요일 실측 약속');
    await footer('현장으로 등록').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-lead-inbox-box]'));
    await page.waitForFunction(() => /접수함에도 '승인'으로 표시했어요/.test(document.body.innerText));
    const decide = server.bodies.filter(b => b.body.action === 'leadDecide').at(-1).body;
    const s = await stored(), project = s.projects.find(p => p.receipt === 'LD-20261119-0001');
    assert(project, 'project stored on this device'); assert.equal(project.source, 'lead-inbox');
    assert.equal(decide.payload.decision, '승인'); assert.equal(decide.payload.memo, '토요일 실측 약속 · 현장웹 현장 등록: ' + project.name);
    assert.match(decide.payload.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(server.rows[0].status, '승인');
    assert.match(JSON.parse(s.idb.appState).notes.map(n => n.text).join('\n'), /접수경로: 홈페이지 문의 접수함에서 가져오기[\s\S]*접수번호: LD-20261119-0001/);
  });

  await test('③ RETRY: a lost approval keeps the site and is re-sent with the same requestId; pasting the same mail is blocked', async () => {
    await center(); await page.locator('#webWorkLeadPull').click(); await page.locator('[data-lead-inbox-list="2"]').waitFor();
    server.dropDecide = 1;
    await page.locator('[data-lead-inbox-open="' + ID(2) + '"]').click(); await page.locator('[data-lead-inbox-box]').waitFor();
    await footer('현장으로 등록').click();
    await page.waitForFunction(() => /등록은 됐지만 접수함 '승인' 표시를 못 했어요/.test(document.body.innerText));
    assert.equal(server.rows[1].status, '신규'); const lostId = server.lost[0].payload.requestId;
    assert((await stored()).projects.some(p => p.receipt === 'LD-20261119-0002'), 'site kept');
    await center(); await page.locator('#webWorkLeadPull').click(); await page.locator('[data-lead-inbox-list="2"]').waitFor();
    assert.match(await page.locator('[data-lead-inbox-row="' + ID(2) + '"]').innerText(), /✅ 앱에 등록됨[\s\S]*✅ 접수함에 승인 표시/);
    await page.locator('[data-lead-inbox-open="' + ID(2) + '"]').click(); await page.locator('[data-lead-inbox-box]').waitFor();
    assert.equal(await footer('현장으로 등록').count(), 0);
    await page.locator('[data-lead-inbox-decide="승인"]').click();
    await page.waitForFunction(() => document.querySelector('[data-lead-inbox-box]')?.getAttribute('data-lead-inbox-state') === '승인');
    assert.equal(server.history.at(-1).requestId, lostId, 'same requestId as the lost request'); assert.equal(server.rows[1].status, '승인');
    await center(); await page.locator('#webWorkPaste').fill(MSG.leak); await page.locator('#webWorkParse').click();
    await page.locator('[data-web-work-preview]').waitFor();
    assert.match(await page.locator('#modalRoot').innerText(), /이미 등록된 문의입니다/, 'the plain mail is the same inquiry');
  });

  await test('④ AS: an A/S lead goes to the picked site’s AS 관리 and is approved as an AS', async () => {
    await center(); await page.locator('#webWorkLeadPull').click(); await page.locator('[data-lead-inbox-list="1"]').waitFor();
    await page.locator('[data-lead-inbox-open="' + ID(3) + '"]').click(); await page.locator('#webWorkAsProject').waitFor();
    await page.locator('#webWorkAsProject').selectOption('TEST 둔산 수정타운 욕실');
    await footer('AS 관리에 접수').click(); await page.locator('#asmList .asmRec').first().waitFor();
    await page.waitForFunction(() => /접수함에도 '승인'으로 표시했어요/.test(document.body.innerText));
    const r = await page.evaluate(() => state.asLog.map(a => ({ project: a.project, receipt: a.sourceReceiptNo })));
    assert.deepEqual(r, [{ project: 'TEST 둔산 수정타운 욕실', receipt: 'LD-20261119-0003' }]);
    assert.equal(server.history.at(-1).memo, '현장웹 AS 접수: TEST 둔산 수정타운 욕실'); assert.equal(server.rows[2].status, '승인');
  });

  await test('⑤ DECIDE: rejecting needs a reason; then the lead is rejected and the list comes back', async () => {
    await center(); await page.locator('#webWorkLeadPull').click(); await page.locator('[data-lead-inbox-list="0"]').waitFor();   // 신규는 이제 0 — 다 불러온 뒤에 칩을 누른다(불러오는 중에는 칩이 잠긴다)
    await page.locator('[data-lead-inbox-filter="보류"]').click(); await page.locator('[data-lead-inbox-list="1"]').waitFor();
    await page.locator('[data-lead-inbox-open="' + ID(4) + '"]').click(); await page.locator('[data-lead-inbox-box]').waitFor();
    assert.deepEqual(await page.locator('[data-lead-inbox-decide]').allInnerTexts(), ['✖ 거절']);
    const n = server.bodies.length;
    await page.locator('[data-lead-inbox-decide="거절"]').click();
    await page.waitForFunction(() => /사유 메모가 꼭 필요/.test(document.getElementById('leadInboxDecideStatus')?.textContent || ''));
    assert.equal(server.bodies.length, n, 'no request without a reason');
    await page.locator('#leadInboxMemo').fill('관리 범위 밖'); await page.locator('[data-lead-inbox-decide="거절"]').click();
    await page.locator('[data-lead-inbox-list="0"]').waitFor();
    assert.equal(server.rows[3].status, '거절'); assert.equal(server.history.at(-1).memo, '관리 범위 밖');
  });

  await test('⑥ EXPIRED: an ended server session sends the owner back to login and clears the device session', async () => {
    server.sessions.clear();
    await page.locator('#leadInboxRefresh').click(); await page.locator('#leadInboxCode').waitFor();
    assert.match(await page.locator('#leadInboxLoginIssue').innerText(), /로그인이 만료됐어요/);
    assert.equal((await stored()).keys.includes('lead_inbox_session'), false);
    await close();
  });

  await test('⑦ PRIVACY: the password lives only in the one leadLogin request; the token only in this device’s session key', async () => {
    const s = await stored();
    const everywhere = [s.local, s.session, s.serialized, s.html, ...Object.values(s.idb)].join('\n');
    assert.equal(everywhere.includes(PASS), false, 'password not stored or shown anywhere');
    assert.equal(server.bodies.filter(b => b.raw.includes(PASS)).length, 1, 'only one request carried the password');
    assert(server.bodies.filter(b => b.body.action === 'leadLogin').every(b => !('sessionToken' in b.body)));
    assert(server.bodies.every(b => /^text\/plain/.test(b.type)), 'simple text/plain requests');
    assert.equal(/TESTE2ESESSION/.test(s.serialized + s.local + s.session + s.html + Object.values(s.idb).join('\n')), false, 'session token not in synced data, web storage or IndexedDB');
    assert.deepEqual(errors, [], 'page errors'); assert.deepEqual(network.writes, [], 'no other external writes');
    assert.deepEqual(await page.evaluate(() => __v612lCalls.external), []);
  });

  console.log(`leadinbox-pull-v612: ${passed}/7 PASS; fake lead-inbox server; synthetic data; other external writes=0`);
  await context.close();
})().catch(async error => {
  console.error('FAIL leadinbox-pull-v612', error.stack || error);
  try { console.error('modal:', (await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '')).slice(0, 600)); } catch (_) {}
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });

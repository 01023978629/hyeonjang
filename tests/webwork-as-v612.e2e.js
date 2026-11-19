/* v613 📥 웹 업무 연결 — A/S·하자 메일을 붙여 넣으면 새 현장 대신 고른 현장의 🔧 AS 관리에 한 건(진짜 화면·진짜 안전판·진짜 이 기기 저장). 합성 자료만, 외부 쓰기 0.
   ① UNKNOWN   모르는 '공간' 첫 칸은 여전히 오류(미리보기 없음·자료 그대로)
   ② AS        폰 390: 만물웹 A/S 본문 → 미리보기(A/S 카드·현장 고르기·'현장으로 등록' 없음·가로 넘침 0·44px) → 안 고르면 '현장을 먼저 고르세요'(자료 그대로)
               → 후보(전화·주소) 확인 → 고르면 보증 한 줄 → [🔧 AS 관리에 접수] → AS 관리가 그 기록을 펼쳐 연다 · 새 현장 0 · AS 기록·메모가 이 기기 저장소에도
   ③ DUPLICATE 같은 메일 다시 → '이미 등록된 문의' · 접수 버튼 없음
   ④ LEAK      누수 현장을 고르면 v423 원인 확인 창 → 같은 원인 → 한 번의 원자 저장에 AS 기록(leak·sourceInquiryId)·메모
   ⑤ PAGES     bathroom.html·leak.html(만물웹 안내) noindex · 페이지 오류 0 · 바깥 쓰기 0
   HJ_V612_BASELINE=<commit> 은 ① 에서 실패해야 한다(기준선 2c8160d 의 오류 문구에는 A/S 가 없고, A/S 본문도 같은 오류로 거절한다). */
'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const ROOT = path.resolve(__dirname, '..');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V612_BASELINE && execFileSync('git', ['show', process.env.HJ_V612_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
// 만물웹 js/lead-transport.js buildLeadText 가 만드는 본문 그대로(type 'A/S' — 공간 줄 첫 칸 'A/S', 접수 경로 website)
const AS_MAIL = '[만물인테리어 상담 신청]\n이름: 김하자\n연락처: 010-1234-5678\n공간: A/S · 대전 서구 둔산동 수정타운아파트\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 욕실 타일 줄눈이 들떴어요.\n작년 봄에 공사했습니다.';
const LEAK_MAIL = AS_MAIL.replace('메모: 욕실 타일 줄눈이 들떴어요.\n작년 봄에 공사했습니다.', '메모: 고친 천장에서 다시 물이 떨어져요.');
const UNKNOWN_MAIL = AS_MAIL.replace('공간: A/S', '공간: 창고');
const LEAK_SITE = 'TEST 둔산 누수 욕실';
let browser, page, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const errors = [], network = { writes: 0, foreign: [] };
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (baseline && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: baseline });
      return route.continue();
    }
    if (!read) network.writes++; else network.foreign.push(url.href);
    return route.abort('blockedbyclient');
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS webwork-as-v612 ' + name); }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };

  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v612Calls = { external: [] };
    window.open = (...args) => { __v612Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v612Calls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V612_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async leakSite => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      const site = (name, extra) => Object.assign({ name, kind: 'interior', stage: 0, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }, extra);
      state.projects = [
        site('TEST 둔산 수정타운 욕실', { stage: 3, doneAt: '2025-04-10', archived: true }),
        site('TEST 전화로만 아는 집', { stage: 2, customer: { name: '박', phone: '010-1234-5678', addr: '' } }),
        site(leakSite, { kind: 'leak', stage: 3, doneAt: '2026-01-05', customer: { addr: '대전 서구 둔산동' }, leak: { detect: { cause: '욕실 배수관' } } }),
        site('TEST 상관없는 현장')
      ];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v612Calls.external = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V612_SEED_SAVE_FAILED');
    }, LEAK_SITE);
  }
  async function snapshot() {
    return page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; const stored = await idbGetStrict('appState'); stored.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(stored) }; });
  }
  function sameSnapshot(actual, expected, label) {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(section + '.' + key);
    }
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  async function paste(text) {
    await close(); await page.evaluate(() => webWorkCenterOpen()); await page.locator('#webWorkPaste').waitFor();
    await page.locator('#webWorkPaste').fill(text); await page.locator('#webWorkParse').click();
  }

  await test('① UNKNOWN: an unknown space type is still an error — no preview, no change', async () => {
    await seed(); const before = await snapshot();
    await paste(UNKNOWN_MAIL);
    await page.waitForFunction(() => /공간 첫 항목은/.test(document.getElementById('webWorkError')?.textContent || ''));
    assert.match(await page.locator('#webWorkError').innerText(), /주거·상업·리모델링·누수·배관·관리사무소·A\/S 중 하나/);
    assert.equal(await page.locator('[data-web-work-preview]').count(), 0); assert.equal(await page.evaluate(() => __webWorkDraft), null);
    sameSnapshot(await snapshot(), before, 'unknown type changes nothing');
  });

  let asId = '';
  await test('② AS: phone preview → must pick a site → AS 관리 record, no new project, stored on this device', async () => {
    const before = await snapshot();
    await paste(AS_MAIL);
    await page.locator('[data-web-work-as]').waitFor();
    assert.equal(await page.locator('[data-web-work-service]').count(), 4, 'four service cards');
    assert.match(await page.locator('[data-web-work-service="as"]').getAttribute('style'), /#2563eb/, 'A/S card active');
    assert.match(await page.locator('[data-web-work-preview]').innerText(), /A\/S·하자/);
    assert.equal(await footer('현장으로 등록').count(), 0, 'A/S never creates a site'); assert.equal(await footer('AS 관리에 접수').count(), 1);
    assert.equal(await page.locator('#webWorkAsProject').inputValue(), '', 'nothing preselected');
    const cands = await page.locator('#webWorkAsProject option[data-web-work-as-cand]').evaluateAll(nodes => nodes.map(n => n.value));
    assert.deepEqual(cands, ['TEST 전화로만 아는 집', LEAK_SITE, 'TEST 둔산 수정타운 욕실'], 'phone first, then address hints (archived kept)');
    assert.equal(await page.locator('#webWorkAsProject option[value="TEST 상관없는 현장"]').count(), 1, 'every site can still be picked');
    await tapOk('#webWorkAsProject'); await tapOk('#modalRoot .mfoot button');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390px');
    await footer('AS 관리에 접수').click();
    await page.waitForFunction(() => /현장을 먼저 고르세요/.test(document.getElementById('webWorkAsIssue')?.textContent || ''));
    sameSnapshot(await snapshot(), before, 'no site picked → nothing saved');
    await page.locator('#webWorkAsProject').selectOption('TEST 둔산 수정타운 욕실');
    await page.waitForFunction(() => /보증/.test(document.getElementById('webWorkAsInfo')?.textContent || ''));
    assert.match(await page.locator('#webWorkAsInfo').innerText(), /🛡 보증 (?:~2028-04-10 \(D-\d+\)|만료 \(2028-04-10\)) · 법정 기본 기간/, 'warranty from hjWarranty (done 2025-04-10 + 36 months)');
    assert.equal(await page.locator('#webWorkAsIssue').innerText(), '');
    await footer('AS 관리에 접수').click();
    await page.locator('#asmList .asmRec').first().waitFor();
    const r = await page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const stored = await idbGetStrict('appState'), rec = state.asLog[0];
      return { title: document.querySelector('#modalRoot h3#modalTitle')?.textContent || '', projects: state.projects.map(p => p.name), asLog: state.asLog, storedAs: stored.asLog, notes: state.notes.map(n => ({ project: n.project, text: n.text })), storedNotes: stored.notes.length,
        open: !!document.querySelector('.asmMore[data-id="' + CSS.escape(rec.id) + '"][open]'), recText: document.querySelector('.asmRec[data-id="' + CSS.escape(rec.id) + '"]')?.innerText || '', draft: __webWorkDraft };
    });
    assert.match(r.title, /AS·하자보수 관리/, 'AS 관리 opens');
    assert.equal(r.projects.length, 4, 'no new project or lead');
    assert.equal(r.asLog.length, 1); const rec = r.asLog[0]; asId = rec.sourceInquiryId;
    assert.deepEqual(Object.keys(rec).sort(), ['date', 'id', 'project', 'sourceInquiryId', 'status', 'text']);
    assert.equal(rec.project, 'TEST 둔산 수정타운 욕실'); assert.equal(rec.status, 'open'); assert.match(rec.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(rec.text, '[홈페이지] 욕실 타일 줄눈이 들떴어요. / 작년 봄에 공사했습니다.'); assert.match(rec.sourceInquiryId, /^webmail-[a-f0-9]{64}$/);
    assert.deepEqual(r.storedAs, r.asLog, 'AS record is in this device store');
    assert.equal(r.notes.length, 1); assert.equal(r.notes[0].project, 'TEST 둔산 수정타운 욕실'); assert.match(r.notes[0].text, /^\[웹 업무 연결\]\n서비스: A\/S·하자\n[\s\S]*\n리드ID: webmail-[a-f0-9]{64}$/); assert.equal(r.storedNotes, 1);
    assert(r.open, 'the new record is unfolded'); assert.match(r.recText, /\[홈페이지\] 욕실 타일 줄눈/); assert.equal(r.draft, null, 'PII draft cleared');
  });

  await test('③ DUPLICATE: the same mail again is blocked', async () => {
    const before = await snapshot();
    await paste(AS_MAIL);
    await page.locator('[data-web-work-preview]').waitFor();
    assert.match(await page.locator('#modalRoot').innerText(), /이미 등록된 문의입니다\.\s*같은 메일로 AS를 다시 접수하지 않습니다/);
    assert.equal(await footer('AS 관리에 접수').count(), 0); assert.equal(await page.locator('#webWorkAsProject').count(), 0);
    sameSnapshot(await snapshot(), before, 'duplicate preview changes nothing');
  });

  await test('④ LEAK: a leak site goes through the v423 cause check and saves AS + note atomically', async () => {
    await paste(LEAK_MAIL);
    await page.locator('#webWorkAsProject').waitFor();
    await page.locator('#webWorkAsProject').selectOption(LEAK_SITE);
    await page.waitForFunction(() => /누수 현장/.test(document.getElementById('webWorkAsInfo')?.textContent || ''));
    const before = await snapshot();
    await footer('AS 관리에 접수').click();
    await page.locator('#hjLeakAs').waitFor();
    assert.equal(await page.locator('#hjLeakAsText').inputValue(), '[홈페이지] 고친 천장에서 다시 물이 떨어져요.');
    sameSnapshot(await snapshot(), before, 'nothing saved before the cause check');
    await page.locator('#hjLeakAsSame').selectOption('same'); await footer('확인 후 접수').click();
    await page.locator('#asmList .asmRec').first().waitFor();
    const r = await page.evaluate(async site => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const stored = await idbGetStrict('appState');
      return { projects: state.projects.length, leak: state.asLog.filter(a => a.project === site), storedLeak: stored.asLog.filter(a => a.project === site), notes: state.notes.filter(n => n.project === site).map(n => n.text) };
    }, LEAK_SITE);
    assert.equal(r.projects, 4);
    assert.equal(r.leak.length, 1); assert.deepEqual(r.storedLeak, r.leak);
    assert.equal(r.leak[0].text, '[홈페이지] 고친 천장에서 다시 물이 떨어져요.'); assert.deepEqual(r.leak[0].leak, { prevProjectId: LEAK_SITE, cause: '욕실 배수관', same: true });
    assert.match(r.leak[0].sourceInquiryId, /^webmail-[a-f0-9]{64}$/); assert.notEqual(r.leak[0].sourceInquiryId, asId);
    assert.equal(r.notes.length, 1); assert.match(r.notes[0], /서비스: A\/S·하자[\s\S]*리드ID: webmail-/);
    // 같은 누수 메일을 또 붙이면 막힌다
    await paste(LEAK_MAIL); await page.locator('[data-web-work-preview]').waitFor();
    assert.match(await page.locator('#modalRoot').innerText(), /이미 등록된 문의입니다/);
    await close();
  });

  await test('⑤ PAGES: bathroom.html and the moved leak.html are noindex; no errors; no external writes', async () => {
    const side = await context.newPage(); side.setDefaultTimeout(15000);
    for (const [name, extra] of [['bathroom.html', null], ['leak.html', 'https://01023978629.github.io/manmool/leak.html']]) {
      await side.goto(new URL(name, APP).href, { waitUntil: 'domcontentloaded' });
      const r = await side.evaluate(() => ({ robots: [...document.querySelectorAll('meta[name=robots]')].map(m => m.content), go: (document.querySelector('[data-leak-moved]') || {}).href || '' }));
      assert.deepEqual(r.robots, ['noindex,nofollow'], name + ' noindex');
      if (extra) assert.equal(r.go, extra, name + ' sends visitors to the manmool page');
    }
    await side.close();
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');   // 앱 부팅은 바깥 스크립트를 읽으려다 막힌다(쓰기 아님)
    assert.deepEqual(await page.evaluate(() => __v612Calls.external), []);
  });

  console.log(`webwork-as-v612: ${passed}/5 PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => {
  console.error('FAIL webwork-as-v612', error.stack || error);
  try { console.error('modal:', (await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '')).slice(0, 600)); } catch (_) {}
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });

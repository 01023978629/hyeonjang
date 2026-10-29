/* v438 보증 만료 전 안부 · AS 무상/유상 판정 도움 — 합성 레코드만, 외부 쓰기 0.
   HJ_V438_BASELINE=<commit> 은 WCARE_API_PRESENT 에서, HJ_V438_MUTATION=ignore-misuse(과실 질문 무시) 는 AS_MISUSE_PAID 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V438_BASELINE && execFileSync('git', ['show', process.env.HJ_V438_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v438Calls = { external: [], compose: [] };
    window.open = (...args) => { __v438Calls.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjAsJudge', 'hjAsJudgeView', 'hjAsJudgeDone', 'hjAsVerdictText', 'hjWarrantyCareRows', 'hjWarrantyCareText', 'hjWarrantyCareHtml', 'hjWarrantyCareView'].every(k => typeof window[k] === 'function')), true, 'WCARE_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V438_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    msgCenterCompose = (kind, preset) => { __v438Calls.compose.push({ kind, text: preset && preset.text, project: preset && preset.project }); closeModal(true); };
  });
  if (process.env.HJ_V438_MUTATION) {
    assert.equal(process.env.HJ_V438_MUTATION, 'ignore-misuse');
    await page.evaluate(() => { const real = hjAsJudge; hjAsJudge = ans => real({ ...(ans || {}), misuse: 'no' }); });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS warrantycare-v438 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const today = localDate(), back12 = ymd => hjAddMonths(ymd, -12);
      const project = (name, extra) => ({ name, kind: 'interior', stage: 3, phases: [], customer: { name: '테스트고객', phone: '010-1234-5678', addr: '대전 중구' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, ...extra });
      state.projects = [
        project('TEST_W60', { doneAt: back12(hjAddDays(today, 45)) }),
        project('TEST_W30', { doneAt: back12(hjAddDays(today, 20)) }),
        project('TEST_W90', { doneAt: back12(hjAddDays(today, 90)) }),
        project('TEST_WCUSTOM', { doneAt: hjAddMonths(today, -40), warranty: { startedAt: hjAddMonths(today, -34), items: [{ name: '방수', months: 36, expiresAt: hjAddDays(today, 50) }] } })];
      state.asLog = [{ id: 'AS1', project: 'TEST_W60', date: today, text: '욕실 타일 들뜸 2장', status: 'open', warrantyItem: '마감(도배·바닥·타일)' }];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v438Calls)) __v438Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V438_SEED_SAVE_FAILED');
      return { today };
    });
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
    if (!process.env.HJ_V438_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V438_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V438_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };

  await test('① 보증 만료 60·30일 전 — 항목별 만료일·시작일 3가지, 첫 화면 줄, 안부 초안(가능 시간 2개), 보냈음 → 노트·30일 숨김', async () => {
    const d = await seed(); const before = await snapshot();
    const rows = await page.evaluate(() => hjWarrantyCareRows().map(r => [r.name, r.stage, r.left, r.items, r.years]));
    assert.deepEqual(rows, [['TEST_W30', 30, 20, ['마감(도배·바닥·타일)', '전기'], 1], ['TEST_W60', 60, 45, ['마감(도배·바닥·타일)', '전기'], 1], ['TEST_WCUSTOM', 60, 50, ['방수'], 3]]);
    await page.locator('#view [data-wcare]').waitFor(); assert.match(await page.locator('#view [data-wcare]').innerText(), /🛡 보증 만료 앞둔 현장 3곳 — TEST_W30 D-20 · TEST_W60 D-45 외/);
    await tapOk('#view [data-wcare-open]'); await page.locator('#view [data-wcare-open]').click(); await page.locator('#hjWcare').waitFor();
    assert.equal(await page.locator('[data-wcare-row]').count(), 3); assert.equal(await page.locator('[data-wcare-row="TEST_W30"]').getAttribute('data-wcare-stage'), '30');
    await tapOk('[data-wcare-sms], [data-wcare-done], #modalRoot .mfoot button'); await noOverflow(); await shot('01-care');
    sameSnapshot(await snapshot(), before, 'the list is read only');
    await page.locator('[data-wcare-sms="TEST_W30"]').click(); await page.waitForFunction(() => __v438Calls.compose.length === 1);
    const sms = await page.evaluate(() => __v438Calls.compose[0]);
    assert.equal(sms.kind, 'warrantycare'); assert.equal(sms.project, 'TEST_W30');
    assert.match(sms.text, /테스트고객님, TEST_W30 준공 후 1년이 되어 갑니다\. 마감\(도배·바닥·타일\)·전기 보증이 \d{2}\/\d{2}까지예요\. 불편한 곳 있으면 보증 기간 안에 봐 드립니다\.\n점검 방문 가능 시간: ① \d{1,2}\/\d{1,2}\(.\) 오전 10시 ② \d{1,2}\/\d{1,2}\(.\) 오후 2시/);
    const slots = await page.evaluate(() => hjWarrantyCareSlots(localDate())); assert.equal(slots.length, 2);
    assert.match(await page.evaluate(() => hjWarrantyCareText(hjWarrantyCareRows().find(r => r.name === 'TEST_WCUSTOM'), localDate())), /준공 후 3년이 되어 갑니다\. 방수 보증이/);
    await page.evaluate(() => hjWarrantyCareView()); await page.locator('[data-wcare-done="TEST_W30"]').click(); await page.locator('[data-wcare-row="TEST_W60"]').waitFor();
    assert.equal(await page.locator('[data-wcare-row]').count(), 2, 'sent site is hidden');
    const care = await page.evaluate(() => ({ care: state.projects.find(p => p.name === 'TEST_W30').warrantyCare, notes: state.notes.filter(n => n.text.startsWith('[보증 안부]')).map(n => [n.project, n.text]) }));
    assert.deepEqual(care.care, { at: d.today, item: '마감(도배·바닥·타일)·전기', stage: 30 }); assert.equal(care.notes.length, 1); assert.match(care.notes[0][1], /^\[보증 안부\] 마감\(도배·바닥·타일\)·전기 만료 \d{4}-\d{2}-\d{2} 앞두고 안부 문자 \(D-20\)$/);
    assert.equal(await page.evaluate(() => { state.projects.find(p => p.name === 'TEST_W30').warrantyCare.at = hjAddDays(localDate(), -29); return hjWarrantyCareRows().length; }), 2, 'still hidden on day 29');
    assert.equal(await page.evaluate(() => { state.projects.find(p => p.name === 'TEST_W30').warrantyCare.at = hjAddDays(localDate(), -30); return hjWarrantyCareRows().length; }), 3, 'back after 30 days');
  });

  await test('② 판정 규칙 7가지 · 판정 도움 화면(보증 기간 자동·직접 바꾸기) · a.verdict · 노트 · 고객 안내 초안(금액 없음)', async () => {
    await seed();
    const R = await page.evaluate(() => {
      const ok = { period: 'yes', same: 'yes', misuse: 'no', consumable: 'no', scope: 'yes' }, j = o => hjAsJudge({ ...ok, ...o }).result;
      return { free: j({}), misuse: j({ misuse: 'yes' }), period: j({ period: 'no' }), scope: j({ scope: 'no' }), consumable: j({ consumable: 'yes' }), same: j({ same: 'no' }), unknown: j({ scope: 'unknown' }) };
    });
    assert.equal(R.misuse, 'paid', 'AS_MISUSE_PAID');
    assert.deepEqual(R, { free: 'free', misuse: 'paid', period: 'paid', scope: 'paid', consumable: 'check', same: 'check', unknown: 'check' });
    await page.evaluate(() => asManage()); await page.locator('.asmRec[data-id="AS1"] details summary').click(); await page.locator('.asmJudgeBtn[data-id="AS1"]').click(); await page.locator('#hjAsJudge').waitFor();
    assert.equal(await page.locator('[data-aj-q="period"][data-aj-a="yes"]').getAttribute('aria-pressed'), 'true', 'warranty period comes from the AS warranty item');
    assert.equal(await page.locator('[data-aj-result]').getAttribute('data-aj-result'), 'check', 'unknown answers wait for a site check');
    for (const [k, v] of [['same', 'yes'], ['misuse', 'no'], ['consumable', 'no'], ['scope', 'yes']]) await page.locator('[data-aj-q="' + k + '"][data-aj-a="' + v + '"]').click();
    assert.equal(await page.locator('[data-aj-result]').getAttribute('data-aj-result'), 'free'); assert.match(await page.locator('[data-aj-reason]').innerText(), /무상으로 봐 드려요/);
    await page.locator('[data-aj-q="misuse"][data-aj-a="yes"]').click(); assert.equal(await page.locator('[data-aj-result]').getAttribute('data-aj-result'), 'paid', 'AS_MISUSE_PAID ui');
    await tapOk('[data-aj-q], [data-aj-pick], #modalRoot .mfoot button'); await noOverflow(); await shot('02-judge');
    await page.locator('[data-aj-pick="check"]').click(); assert.match(await page.locator('#ajResult').innerText(), /현장 확인 후 판정 \(제안: 유상 → 직접 바꿈\)/);
    await footer('판정 저장').click(); await page.locator('#hjAsJudgeDone').waitFor();
    const saved = await page.evaluate(() => ({ v: state.asLog[0].verdict, note: state.notes.filter(n => n.text.startsWith('[AS 판정]')).map(n => n.text) }));
    assert.deepEqual([saved.v.result, saved.v.suggested, saved.v.answers, saved.v.at.length], ['check', 'paid', { period: 'yes', same: 'yes', misuse: 'yes', consumable: 'no', scope: 'yes' }, 10]); assert.match(saved.v.reasons[0], /과실이나 외부 요인/);
    assert.deepEqual(saved.note, ['[AS 판정] 욕실 타일 들뜸 2장 — 현장 확인 후 판정 (제안 유상)']);
    const text = await page.locator('[data-aj-text]').innerText(); assert.match(text, /현장을 직접 보고 무상·유상을 정해/); assert(!/\d[\d,]*\s*원/.test(text), 'no amount');
    await footer('문자 초안').click(); await page.waitForFunction(() => __v438Calls.compose.length === 1); assert.equal(await page.evaluate(() => __v438Calls.compose[0].kind), 'as');
    await page.evaluate(() => asManage('AS1')); await page.locator('.asmJudge[data-aj-state="check"]').waitFor({ state: 'attached' });
    const paidText = await page.evaluate(() => { const a = state.asLog[0]; a.verdict.result = 'paid'; return hjAsVerdictText(a); });
    assert.match(paidText, /보증 대상이 아니에요\. 그래서 유상 수리로 안내드려요\./); assert(!/\d[\d,]*\s*원/.test(paidText));
    const msg = await page.evaluate(() => { const real = navigator.share; Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); const copy = hjSiteCopy; let got = ''; hjSiteCopy = t => { got = t; }; const r = hjAsCustomerMsg(hjAsProject(state.asLog[0]), state.asLog[0]); hjSiteCopy = copy; Object.defineProperty(navigator, 'share', { configurable: true, value: real }); return { r, got }; });
    assert.equal(msg.r, paidText, 'the existing AS message uses the verdict text'); assert.equal(msg.got, paidText);
  });

  await test('③ 저장본 불변(열기만) · 새 최상위 키 없음 · 44px · 390px · 더보기 계약', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => hjWarrantyCareView()); await page.locator('#hjWcare').waitFor(); await close();
    await page.evaluate(() => hjAsJudgeView('AS1', () => closeModal(true))); await page.locator('#hjAsJudge').waitFor(); await footer('뒤로').click();
    sameSnapshot(await snapshot(), before, 'opening and leaving without saving changes nothing');
    await page.evaluate(() => { hjAsJudgeView('AS1'); }); await page.locator('[data-aj-q="scope"][data-aj-a="no"]').click(); await footer('판정 저장').click(); await page.locator('#hjAsJudgeDone').waitFor();
    assert.deepEqual((await snapshot()).keys, before.keys, 'no new top-level serialized keys');
    assert.equal(await page.evaluate(() => state.asLog[0].verdict.result), 'paid');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v438Calls.external), []);
  });
  console.log(`warrantycare-v438: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL warrantycare-v438', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

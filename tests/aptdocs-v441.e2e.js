/* v441 아파트 서류 4종 — 공사 신청서 · 입주민 안내문 · 현관 게시문 · 이웃 동의서. 합성 레코드만, 외부 쓰기 0.
   HJ_V441_BASELINE=<commit> 은 APTDOCS_API_PRESENT 에서, HJ_V441_MUTATION=no-unit(동·호수 자동 채움 제거) 는 APTDOCS_UNIT_AUTO 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const APT = 'TEST한빛아파트 101동 702호', ADDR_SITE = 'TEST_ADDR_SITE', CUST = '테스트고객', PHONE = '010-1234-5678';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V441_BASELINE && execFileSync('git', ['show', process.env.HJ_V441_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v441Calls = { external: [], sms: [], print: [], zip: [], download: [] };
    window.open = (...args) => { __v441Calls.external.push(args); return null; };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjAptUnitOf', 'hjAptDocModel', 'hjAptApplyHtml', 'hjAptNoticeHtml', 'hjAptPostHtml', 'hjAptConsentHtml', 'hjAptDocsIssue', 'hjAptDocsZip', 'hjAptDocsView', 'hjAptDocsDue', 'hjAptFormAttach'].every(k => typeof window[k] === 'function')), true, 'APTDOCS_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V441_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __v441Calls.sms.push({ phone, text }); };
    hjDocPrint = html => { __v441Calls.print.push(String(html)); return true; };
    hjLeakReportDownload = (blob, name) => { __v441Calls.download.push({ name, size: blob && blob.size }); };
    ensureJSZip = async () => window.JSZip;
    window.JSZip = function () { const files = {}; this.file = (n, c) => { files[n] = c; return this; }; this.generateAsync = async () => { __v441Calls.zip.push(Object.keys(files)); return new Blob(['zip']); }; };
  });
  if (process.env.HJ_V441_MUTATION) {
    assert.equal(process.env.HJ_V441_MUTATION, 'no-unit');
    await page.evaluate(() => { hjAptUnitOf = () => ({ complex: '', dong: '', ho: '', from: '' }); });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS aptdocs-v441 ' + name); }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async ({ apt, addrSite, cust, phone }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const today = localDate();
      const project = (name, addr) => ({ name, kind: 'interior', stage: 1, phases: [], customer: { name: cust, phone, addr }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      state.projects = [project(apt, '대전 중구 은행동'), project(addrSite, '대전 서구 둔산동 TEST파크 7동 302호'), project('TEST_HOUSE', '대전 동구 단독주택')];
      state.aptOffices = [{ id: 'OF1', complex: 'TEST한빛아파트', manager: '김소장', phone: '042-000-1111' }];
      state.schedule = [{ id: 'S1', date: hjAddDays(today, 2), time: '09:00', title: '철거 작업', project: apt, memo: '' }, { id: 'S2', date: hjAddDays(today, 3), time: '09:00', title: '설비', project: apt, memo: '' },
        { id: 'S3', date: hjAddDays(today, 6), time: '09:00', title: '욕실 타공', project: apt, memo: '' }, { id: 'S4', date: hjAddDays(today, 10), time: '09:00', title: '도배', project: addrSite, memo: '' }];
      state.quotes = [{ id: 'Q1', project: apt, title: 'TEST', date: today, items: [{ name: '철거', qty: 1, price: 500000 }, { name: '욕실 리모델링', qty: 1, price: 3000000 }, { name: '주방 상판', qty: 1, price: 800000 }, { name: '도배', qty: 1, price: 900000 }, { name: '바닥', qty: 1, price: 1200000 }, { name: '조명', qty: 1, price: 300000 }], vatIncluded: true }];
      state.quotes.forEach(x => syncQuoteToProject(x));
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v441Calls)) __v441Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V441_SEED_SAVE_FAILED');
      return { today };
    }, { apt: APT, addrSite: ADDR_SITE, cust: CUST, phone: PHONE });
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
    if (!process.env.HJ_V441_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V441_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V441_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const previewHtml = () => page.locator('#modalRoot iframe').evaluate(n => n.getAttribute('srcdoc'));

  await test('① 4종 — 단지·동·호수·관리사무소·기간·소음일·공종 자동, 동의서 이름 빈칸 6칸, 게시문 2개, 고객 정보 없음', async () => {
    const d = await seed(); const before = await snapshot();
    const u = await page.evaluate(({ apt, site }) => [hjAptUnitOf(state.projects.find(p => p.name === apt)), hjAptUnitOf(state.projects.find(p => p.name === site)), hjAptUnitOf(state.projects.find(p => p.name === 'TEST_HOUSE'))], { apt: APT, site: ADDR_SITE });
    assert.deepEqual(u[0], { complex: 'TEST한빛아파트', dong: '101', ho: '702', from: 'name' }, 'APTDOCS_UNIT_AUTO'); assert.deepEqual(u[1], { complex: 'TEST파크', dong: '7', ho: '302', from: 'addr' }); assert.equal(u[2].dong, '');
    await page.evaluate(apt => hjAptDocsView(apt), APT); await page.locator('#hjAptDocs').waitFor();
    assert.deepEqual([await page.locator('#adComplex').inputValue(), await page.locator('#adDong').inputValue(), await page.locator('#adHo').inputValue()], ['TEST한빛아파트', '101', '702'], 'APTDOCS_UNIT_AUTO form');
    assert.equal(await page.locator('#adFrom').inputValue(), await page.evaluate(() => hjAddDays(localDate(), 2))); assert.equal(await page.locator('#adTo').inputValue(), await page.evaluate(() => hjAddDays(localDate(), 6)));
    assert.match(await page.locator('[data-ad-office]').innerText(), /TEST한빛아파트 관리사무소 · 김소장 · 042-000-1111/); assert.match(await page.locator('[data-ad-noisy]').innerText(), /\d+\/\d+\(.\), \d+\/\d+\(.\)/);
    assert.equal(await page.locator('#adWorks').inputValue(), '철거\n욕실 리모델링\n주방 상판\n도배\n바닥', 'top five quote items');
    await tapOk('#modalRoot .mfoot button, [data-ad-doc], #adForm'); await noOverflow(); await shot('01-aptdocs');
    sameSnapshot(await snapshot(), before, 'opening the form stores nothing');
    const docs = {};
    for (const t of ['aptapply', 'aptnotice', 'aptpost', 'aptconsent']) { await page.locator('[data-ad-doc="' + t + '"]').click(); await page.locator('#hjDocPdf').waitFor(); docs[t] = await previewHtml(); await footer('뒤로').click(); await page.locator('#hjAptDocs').waitFor(); }
    assert.match(docs.aptapply, /세대 내부 공사 신청서[\s\S]*TEST한빛아파트 관리사무소[\s\S]*TEST한빛아파트 101동 702호[\s\S]*철거[\s\S]*09:00~18:00[\s\S]*10:00~17:00/);
    assert.match(docs.aptnotice, /입주민 여러분께[\s\S]*소음이 큰 날/); assert.equal((docs.aptpost.match(/data-apt-post/g) || []).length, 2, 'two signs on one page');
    assert.equal((docs.aptconsent.match(/data-apt-consent-row/g) || []).length, 6); assert(!/<td style="width:150px">[^<]*[가-힣]{2}/.test(docs.aptconsent), 'names stay blank');
    for (const t of Object.keys(docs)) { assert(!docs[t].includes(CUST) && !docs[t].replace(/\D/g, '').includes('01012345678'), t + ' has no customer data'); assert(docs[t].includes('010-2397-8629') || docs[t].includes(await page.evaluate(() => COMPANY.tel)), t + ' has the company number'); }
    sameSnapshot(await snapshot(), before, 'previews do not issue');
    await page.locator('[data-ad-doc="aptapply"]').click(); await page.locator('#hjDocPdf').click(); await page.waitForFunction(apt => (state.projects.find(p => p.name === apt).docs || []).length === 1, APT);
    const one = await page.evaluate(apt => state.projects.find(p => p.name === apt).docs[0], APT); assert.equal(one.type, 'aptapply'); assert.match(one.no, /^AA-\d{8}-01$/);
  });

  await test('② D-3 할 일 줄 · 4종 ZIP(관리사무소 양식 포함) · 문자 초안 · p.docs 4건 · 노트 한 줄', async () => {
    await seed();
    await page.locator('#view [data-aptdocs-due]').waitFor(); assert.match(await page.locator('#view [data-aptdocs-due]').innerText(), /관리사무소 서류 4종 만들기 — TEST한빛아파트 101동 702호 \(시공 D-2\)/);
    assert.equal(await page.locator('#view [data-aptdocs-due]').count(), 1, 'the address-only site starts in 10 days');
    await tapOk('#view [data-aptdocs-open]'); await page.locator('#view [data-aptdocs-open]').click(); await page.locator('#hjAptDocs').waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#adForm').click()]);
    await chooser.setFiles({ name: '한빛_공사신청양식.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%TEST\n') });
    await page.locator('[data-ad-form]').waitFor(); assert.match(await page.locator('[data-ad-form]').innerText(), /한빛_공사신청양식\.pdf/);
    const form = await page.evaluate(apt => { const p = state.projects.find(x => x.name === apt); const f = state.files.find(x => x.name === '한빛_공사신청양식.pdf'); return { ref: p.aptForm, file: f && [f.kind, f.project], fileRef: f && hjFileRef(f) }; }, APT);
    assert.deepEqual(form.file, ['other', APT]); assert.equal(form.ref.fileRef, form.fileRef);
    await page.evaluate(() => { getFileOf = async rec => new Blob(['form']); });
    await footer('4종 ZIP').click(); await page.waitForFunction(apt => (state.projects.find(p => p.name === apt).docs || []).length === 4, APT);
    const z = await page.evaluate(() => ({ zip: __v441Calls.zip[0], dl: __v441Calls.download[0] }));
    assert.deepEqual(z.zip, ['01_공사 신청서.html', '02_입주민 안내문.html', '03_현관 게시문.html', '04_이웃 동의서.html', '05_관리사무소양식_한빛_공사신청양식.pdf']); assert.match(z.dl.name, /아파트서류_\d{4}-\d{2}-\d{2}\.zip$/);
    const issued = await page.evaluate(apt => { const p = state.projects.find(x => x.name === apt); return { docs: p.docs.map(r => [r.type, r.no.slice(0, 3)]), notes: state.notes.filter(n => n.text.startsWith('[아파트 서류]')).map(n => n.text) }; }, APT);
    assert.deepEqual(issued.docs, [['aptapply', 'AA-'], ['aptnotice', 'AN-'], ['aptpost', 'AP-'], ['aptconsent', 'AC-']]); assert.equal(issued.notes.length, 1); assert.match(issued.notes[0], /^\[아파트 서류\] \d{2}\/\d{2} 4종 발행$/);
    await page.locator('#hjAptDocs').waitFor(); await footer('ZIP').click(); await page.waitForFunction(() => __v441Calls.zip.length === 2);
    assert.equal(await page.evaluate(apt => state.projects.find(p => p.name === apt).docs.length, APT), 4, 'same day is not recorded twice');
    await footer('관리사무소 문자').click(); const sms = await page.evaluate(() => __v441Calls.sms[0]);
    assert.equal(sms.phone, '042-000-1111'); assert.match(sms.text, /TEST한빛아파트 관리사무소 담당자님, TEST한빛아파트 101동 702호 내부 공사 신청 서류 보내드립니다/); assert(!sms.text.includes(CUST));
    await close(); await page.evaluate(() => { state.tab = 'dashboard'; render(); }); assert.equal(await page.locator('#view [data-aptdocs-due]').count(), 0, 'issued sites leave the to-do line');
    await page.evaluate(apt => docHubView(apt), APT); await page.locator('#modalRoot .docHubBtn[data-act="aptdocs"]').waitFor(); assert.match(await page.locator('#modalRoot .docHubBtn[data-act="aptdocs"]').innerText(), /101동 702호 · 발행 4\/4/);
    assert.equal(await page.locator('#modalRoot .docHubBtn[data-act="todo:apt"]').count(), 0);
  });

  await test('③ 데모 할 일 · 단지 화면 버튼 · 저장본 불변 · 44px · 390px · 더보기', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(apt => hjAptDocsView(apt), APT); await page.locator('#hjAptDocs').waitFor(); await close();
    sameSnapshot(await snapshot(), before, 'open and close stores nothing');
    const due = await page.evaluate(() => { const keep = JSON.stringify({ p: state.projects, s: state.schedule }); const saved = { projects: state.projects, schedule: state.schedule };
      state.projects = [{ name: '은행동 한빛아파트 101동 702호', stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' } }];
      state.schedule = [{ id: 'D1', date: hjAddDays(localDate(), 2), title: '철거 작업', project: '은행동 한빛아파트 101동 702호' }];
      const r = hjAptDocsDue().map(x => x.name); state.projects = saved.projects; state.schedule = saved.schedule; return { r, same: keep === JSON.stringify({ p: state.projects, s: state.schedule }) }; });
    assert.deepEqual(due.r, ['은행동 한빛아파트 101동 702호'], 'demo-style apartment shows the to-do'); assert.equal(due.same, true);
    const demo = await page.evaluate(() => { const src = loadDemo.toString(); return /은행동 한빛아파트 101동 702호/.test(src) && /hjAddDays\(localDate\(\),2\)/.test(src); }); assert.equal(demo, true, 'demo seeds a D-2 apartment');
    await page.evaluate(() => { state.tab = 'aptmgmt'; render(); }); await page.locator('#view [data-aptdocs-open="' + APT + '"]').waitFor(); await tapOk('#view [data-aptdocs-open]');
    await page.locator('#view [data-aptdocs-open="' + APT + '"]').click(); await page.locator('#hjAptDocs').waitFor(); await close();
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert.deepEqual((await snapshot()).keys, before.keys, 'no new top-level serialized keys');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v441Calls.external), []);
  });
  console.log(`aptdocs-v441: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL aptdocs-v441', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

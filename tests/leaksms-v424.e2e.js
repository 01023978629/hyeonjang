/* v424 synthetic records only. HJ_V424_BASELINE=e62c43e must fail
   LEAK_SMS_API_PRESENT; HJ_V424_MUTATION=third-unmask must fail THIRD_MASKED.
   No actual SMS, sharing, or external writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_LEAK_SMS_PROJECT', INTERIOR = 'TEST_INTERIOR_SMS_PROJECT';
const PRIVATE = ['TEST_PRIVATE_CUSTOMER', '010-0000-0000', 'TEST_PRIVATE_CUSTOMER_ADDRESS', 'TEST_PRIVATE_CAUSE_HOUSE'];
const KEYS = ['intake', 'dispatch', 'detect', 'quote', 'done', 'pay', 'third'];
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const baseline = process.env.HJ_V424_BASELINE && execFileSync('git', ['show', process.env.HJ_V424_BASELINE + ':index.html'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(), errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
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
    window.__v424Calls = { copied: [], sms: [], otherExternal: [] };
    window.open = (...args) => { __v424Calls.otherExternal.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v424Calls.otherExternal.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { __v424Calls.copied.push(text); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => typeof hjLeakSmsDraft === 'function' && typeof hjLeakSmsView === 'function' && typeof hjLeakSmsPending === 'function'), true, 'LEAK_SMS_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __v424Calls.sms.push({ phone, text }); };
  });
  if (process.env.HJ_V424_MUTATION) {
    assert.equal(process.env.HJ_V424_MUTATION, 'third-unmask');
    await page.evaluate(() => {
      const real = hjLeakSmsDraft;
      hjLeakSmsDraft = (p, key, options) => real(p, key, options) + (key === 'third' ? ' ' + p.customer.name + ' ' + p.customer.phone + ' ' + p.customer.addr : '');
    });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS leaksms-v424 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  async function seed(stage = 1) {
    await close();
    await page.evaluate(async ({ leak, interior, privateFields, stage }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      const project = (name, kind) => ({ name, kind, stage, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak'), day = localDate(), at = day + 'T03:00:00.000Z';
      p.customer = { name: privateFields[0], phone: privateFields[1], addr: privateFields[2] }; p.received = 70000;
      p.leak = { intake: { where: ['욕실', '천장'], since: '오늘', amount: '똑똑 떨어짐', neighbor: '아랫집에서 연락 옴', at },
        detect: { methods: ['청음'], cause: '온수관', zone: '전유부', place: privateFields[3], pressure: { from: 7, to: 0, unit: 'bar' }, humidity: 0, note: 'TEST_DETECT_NOTE', revisit: false, at } };
      state.projects = [p, project(interior, 'interior')];
      state.quotes = [{ id: 'TEST_LEAK_SMS_QUOTE', project: leak, title: 'TEST_LEAK_QUOTE', date: day, leak: { from: 'template', cause: '급수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 100000 }], vatIncluded: true, paid: { amount: 20000 } }];
      state.schedule = [{ id: 'TEST_LEAK_SMS_DISPATCH', project: leak, title: '누수 출동', date: day, time: '10:00', endTime: '11:00', urgent: true, report: { progress: '완료', text: 'TEST_DISPATCH_REPORTED' } }];
      state.activeProject = leak; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v424Calls.copied = []; __v424Calls.sms = []; __v424Calls.otherExternal = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V424_SEED_SAVE_FAILED');
    }, { leak: LEAK, interior: INTERIOR, privateFields: PRIVATE, stage });
  }
  async function snapshot() {
    return page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const live = serializeData(); live.savedAt = '';
      return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() };
    });
  }
  async function open(key) {
    await close();
    if (key) await page.evaluate(({ name, key }) => hjLeakSmsView(name, key), { name: LEAK, key });
    else await page.locator('[data-leaksms="' + LEAK + '"]').click();
    await page.locator('#hjLeakSms').waitFor({ state: 'visible' });
  }
  async function shot(name) {
    if (!process.env.HJ_V424_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V424_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V424_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  await test('seven drafts, quote/payment amounts, and third-party masking are read only', async () => {
    await seed(); const before = await snapshot();
    const drafts = await page.evaluate(() => {
      const p = state.projects[0], options = { quoteId: 'TEST_LEAK_SMS_QUOTE', accountIdx: 0, arrival: '10:30', valvePlace: 'TEST_VALVE_LOCATION', thirdTarget: '관리사무소' };
      return HJ_LEAK_SMS.map(item => ({ key: item.key, text: hjLeakSmsDraft(p, item.key, options) }));
    });
    assert.deepEqual(drafts.map(item => item.key), KEYS);
    for (const draft of drafts) { assert(draft.text.trim()); assert(!/undefined|NaN/.test(draft.text)); if (!['quote', 'pay'].includes(draft.key)) assert(!/\d[\d,]*\s*원/.test(draft.text), draft.key + ' must not include money'); }
    const get = key => drafts.find(item => item.key === key).text;
    assert.match(get('intake'), /욕실|천장/); assert.match(get('intake'), /사진\s*2장/);
    assert.match(get('dispatch'), /10:30|10시\s*30분/); assert.match(get('dispatch'), /TEST_VALVE_LOCATION/);
    assert.match(get('detect'), /청음/); assert.match(get('detect'), /온수관/); assert.match(get('detect'), /전유부/);
    assert.match(get('quote'), /110,?000\s*원/); assert.match(get('quote'), /부가세/); assert.match(get('quote'), /추가.*먼저/);
    assert.match(get('pay'), /90,?000\s*원/); assert(!/20,?000\s*원/.test(get('pay')), 'received must not be deducted again');
    for (const secret of [...PRIVATE, LEAK]) assert(!get('third').includes(secret), 'THIRD_MASKED: customer, address and origin household must be absent');
    assert.match(get('third'), /관리사무소/); assert.deepEqual(await snapshot(), before);
  });
  await test('four stage defaults use completed dispatch evidence and never write', async () => {
    await seed(); const before = await snapshot();
    const stages = await page.evaluate(() => {
      const p = state.projects[0];
      return [
        hjLeakSmsStage({ ...p, stage: 0, name: 'TEST_INTAKE_ONLY', leak: { intake: p.leak.intake } }),
        hjLeakSmsStage({ ...p, stage: 1, leak: { intake: p.leak.intake } }),
        hjLeakSmsStage({ ...p, stage: 2 }), hjLeakSmsStage({ ...p, stage: 3 })
      ];
    });
    assert.deepEqual(stages, ['intake', 'detect', 'quote', 'done']); assert.deepEqual(await snapshot(), before);
  });
  await test('ambiguous quote, unsupported paid amount, and unselected account stay unconfirmed', async () => {
    await seed();
    await page.evaluate(() => state.quotes.push({ ...structuredClone(state.quotes[0]), id: 'TEST_SECOND_LEAK_QUOTE' }));
    const before = await snapshot();
    const facts = await page.evaluate(() => {
      const p = state.projects[0], noSelection = hjLeakSmsDraft(p, 'quote'), noAccount = hjLeakSmsDraft(p, 'pay', { quoteId: 'TEST_LEAK_SMS_QUOTE' });
      const q = state.quotes[0], original = q.paid;
      q.paid = { amount: 999999 }; const badPaid = hjLeakSmsDraft(p, 'pay', { quoteId: q.id }); q.paid = original;
      return { noSelection, noAccount, badPaid, accounts: COMPANY.accounts.map(account => account.no) };
    });
    assert(!/\d[\d,]*\s*원/.test(facts.noSelection), 'multiple quotes need explicit selection');
    assert(!/\d[\d,]*\s*원/.test(facts.badPaid), 'invalid paid balance must not produce an invented amount');
    for (const account of facts.accounts) assert(!facts.noAccount.includes(account), 'bank account must not be selected automatically');
    assert.deepEqual(await snapshot(), before);
    await open('quote'); assert.equal(await page.locator('#hjLeakSmsQuote').inputValue(), ''); assert.equal(await page.locator('#hjLeakSmsAccount').inputValue(), '');
  });
  await test('open, copy and SMS app actions do not mark sent', async () => {
    await seed(); const before = await snapshot(); await open();
    assert.deepEqual(await snapshot(), before); assert.equal(await page.locator('[data-leak-sms-key]').count(), 7);
    assert.equal(await page.locator('#hjLeakSms details').count(), 1); assert.equal(await page.locator('#hjLeakSms details').evaluate(el => el.open), false);
    await page.locator('#hjLeakSmsBody').fill('TEST_EDITED_SMS_BODY');
    await page.locator('#hjLeakSmsCopy').click(); await page.waitForFunction(() => __v424Calls.copied.length === 1);
    await page.locator('#hjLeakSmsSend').click(); await page.waitForFunction(() => __v424Calls.sms.length === 1);
    const calls = await page.evaluate(() => __v424Calls);
    assert.equal(calls.copied[0], 'TEST_EDITED_SMS_BODY'); assert.equal(calls.sms[0].text, 'TEST_EDITED_SMS_BODY'); assert.equal(calls.sms[0].phone.replace(/\D/g, ''), PRIVATE[1].replace(/\D/g, ''));
    assert.deepEqual(await snapshot(), before, 'copy/deep-link opening is not a sent receipt'); await shot('01-leak-sms');
  });
  await test('third-party view requires consent and an explicit different recipient', async () => {
    await seed(); const before = await snapshot(); await open('third');
    assert.equal(await page.locator('#hjLeakSmsConsent').isChecked(), false); assert.equal(await page.locator('#hjLeakSmsPhone').inputValue(), '');
    const draft = await page.locator('#hjLeakSmsBody').inputValue(); for (const secret of PRIVATE) assert(!draft.includes(secret), 'THIRD_MASKED UI');
    await page.locator('#hjLeakSmsSend').click(); assert.equal(await page.evaluate(() => __v424Calls.sms.length), 0);
    await page.locator('#hjLeakSmsConsent').check(); await page.locator('#hjLeakSmsSend').click(); assert.equal(await page.evaluate(() => __v424Calls.sms.length), 0);
    await page.locator('#hjLeakSmsPhone').fill(PRIVATE[1]); await page.locator('#hjLeakSmsSend').click(); assert.equal(await page.evaluate(() => __v424Calls.sms.length), 0, 'third-party recipient must not default back to the customer');
    await page.locator('#hjLeakSmsPhone').fill('010-0000-0001'); await page.locator('#hjLeakSmsSend').click(); await page.waitForFunction(() => __v424Calls.sms.length === 1);
    assert.equal(await page.evaluate(() => __v424Calls.sms[0].phone.replace(/\D/g, '')), '01000000001'); assert.deepEqual(await snapshot(), before); await shot('02-third-consent');
  });
  await test('mark sent commits the receipt and one note atomically, and repeat is read only', async () => {
    await seed(); const keys = (await snapshot()).keys; await open('detect');
    await page.locator('#hjLeakSmsMark').click(); await page.waitForFunction(() => !!state.projects[0].leak.sms?.detect);
    await page.waitForFunction(() => document.getElementById('hjLeakSmsSent')?.textContent.includes('✓'));
    const result = await page.evaluate(async () => ({ p: state.projects[0], notes: state.notes, stored: await idbGetStrict('appState') }));
    assert(Number.isFinite(Date.parse(result.p.leak.sms.detect))); assert.equal(result.notes.length, 1); assert.match(result.notes[0].text, /^\[문자\]/);
    assert.deepEqual(result.stored.projects[0].leak.sms, result.p.leak.sms); assert.deepEqual(result.stored.notes, result.notes); assert.deepEqual((await snapshot()).keys, keys);
    const before = await snapshot();
    const repeat = await page.evaluate(async () => { const p = state.projects[0]; return hjLeakSmsMark(p, 'detect', hjLeakSmsExpected(p), () => true); });
    assert.equal(repeat.changed, false); assert.deepEqual(await snapshot(), before, 'already marked stage must not add a note or commit again');
    await close();
    await page.evaluate(async () => {
      state.projects[0].leak.sms.detect = hjAddDays(localDate(), -1) + 'T03:00:00.000Z';
      if (!(await guardedPersistCurrentState())) throw Error('TEST_PRIOR_VISIT_SEED_FAILED');
    });
    assert.equal(await page.evaluate(() => hjLeakSmsSent(state.projects[0], 'detect')), false, 'yesterday receipt cannot cover today completed dispatch');
    await open('detect');
    assert(!(await page.locator('#hjLeakSmsSent').innerText()).includes('✓'), 'an earlier visit receipt must not be shown as sent for this visit');
    await page.locator('#hjLeakSmsMark').click();
    await page.waitForFunction(() => state.notes.filter(n => n.text.startsWith('[문자]')).length === 2);
    assert.equal(await page.evaluate(() => hjLeakSmsSent(state.projects[0], 'detect')), true, 'new visit may be marked once');
  });
  await test('failed sent-receipt save preserves draft and IDB and supports retry', async () => {
    await seed(); await open('detect'); await page.locator('#hjLeakSmsBody').fill('TEST_UNSAVED_MESSAGE'); const before = await snapshot();
    await page.evaluate(() => { window.__v424Writer = paidCommitWriteAtomic; paidCommitWriteAtomic = async () => { throw Error('TEST_V424_ATOMIC_FAIL'); }; });
    try {
      await page.locator('#hjLeakSmsMark').click(); await page.waitForFunction(() => document.getElementById('hjLeakSmsIssue')?.textContent.includes('TEST_V424_ATOMIC_FAIL'));
      assert.equal(await page.locator('#hjLeakSmsBody').inputValue(), 'TEST_UNSAVED_MESSAGE'); assert.equal(await page.locator('#hjLeakSmsMark').isEnabled(), true);
      assert.deepEqual(await snapshot(), before);
    } finally { await page.evaluate(() => { paidCommitWriteAtomic = __v424Writer; delete window.__v424Writer; }); }
    await page.locator('#hjLeakSmsMark').click(); await page.waitForFunction(() => !!state.projects[0].leak.sms?.detect);
    assert.equal(await page.evaluate(() => state.notes.filter(n => n.text.startsWith('[문자]')).length), 1);
  });
  await test('daily close counts completed dispatch only and unnotified completed projects', async () => {
    await seed();
    await page.evaluate(() => {
      const template = state.projects[0], today = localDate(), old = hjAddDays(today, -1);
      template.leak.sms = { detect: old + 'T03:00:00.000Z' };
      const add = (name, stage = 1, extra = {}) => state.projects.push({ ...structuredClone(template), name, stage, leak: { intake: {} }, ...extra });
      add('TEST_DISPATCH_PLANNED'); add('TEST_DISPATCH_YESTERDAY'); add('TEST_DISPATCH_NONURGENT'); add('TEST_DONE_UNNOTIFIED', 3, { doneAt: today }); add('TEST_DONE_SENT', 3, { doneAt: old, leak: { sms: { done: new Date().toISOString() } } }); add('TEST_ARCHIVED_SMS', 3, { archived: true });
      const event = (project, date, urgent, reported) => ({ id: 'EVENT_' + project, project, title: 'TEST_EVENT', date, urgent, ...(reported ? { report: { progress: '완료' } } : {}) });
      state.schedule.push(event(template.name, today, true, true), event('TEST_DISPATCH_PLANNED', today, true, false), event('TEST_DISPATCH_YESTERDAY', old, true, true), event('TEST_DISPATCH_NONURGENT', today, false, true));
    });
    const before = await snapshot(), result = await page.evaluate(() => ({ direct: hjLeakSmsPending(localDate()), day: hjDayCloseData().leakSms }));
    assert.deepEqual(result.direct.detect, [LEAK]); assert.deepEqual(result.direct.done, ['TEST_DONE_UNNOTIFIED']); assert.deepEqual(result.day, result.direct);
    await page.evaluate(() => hjDayCloseView());
    assert.equal(await page.locator('[data-dc-leaksms][data-sms-key="detect"]').count(), 1); assert.equal(await page.locator('[data-dc-leaksms][data-sms-key="done"]').count(), 1);
    assert.deepEqual(await snapshot(), before); await shot('03-leak-dayclose');
  });
  await test('mobile sizes, existing message center and menu126 remain intact', async () => {
    await seed(); await open();
    const sizes = await page.locator('#hjLeakSmsCopy, #hjLeakSmsSend, #hjLeakSmsMark, [data-leak-sms-key]').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ h: node.getBoundingClientRect().height, w: node.getBoundingClientRect().width })));
    assert(sizes.length >= 4); assert(sizes.every(item => item.h >= 44 && item.w >= 44), JSON.stringify(sizes));
    assert(await page.locator('#modalRoot .modal').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await close(); await page.evaluate(() => msgCenterView('general')); assert.equal(await page.locator('.mcKind').count(), 10);
    await close(); await page.evaluate(() => msgCenterView('leak')); assert.match(await page.locator('#modalRoot').innerText(), /누수/);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v424Calls.otherExternal), []);
  });
  console.log(`leaksms-v424: ${passed}/${passed} PASS; synthetic data; real sends=0; external writes=0`);
  await context.close();
})().catch(error => { console.error('FAIL leaksms-v424', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

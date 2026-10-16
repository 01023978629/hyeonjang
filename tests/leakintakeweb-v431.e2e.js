/* v431 공개 누수 접수 페이지(leak.html) + 앱 붙여넣기 파서 — 합성 레코드만. 외부 쓰기·업로드 0.
   HJ_V431_BASELINE=<commit> 은 LEAKWEB_API_PRESENT 에서, HJ_V431_MUTATION=keymap(파서 키 매핑 제거) 은 LEAKWEB_PARSE_FIELDS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin, PAGE = new URL('leak.html', APP).href;
const ROOT = path.resolve(__dirname, '..');
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const SAMPLE = '[누수접수] 어디서=욕실·천장;언제=2~3일;물양=똑똑 떨어짐;이웃=아랫집에서 연락 옴;관리사무소=했음;보험=모름;동=유천동;시간=오전;이름=김\n사진 2장(젖은 곳 넓게 1장, 가까이 1장)을 이 문자에 답장으로 보내 주세요.';
const baseline = process.env.HJ_V431_BASELINE && execFileSync('git', ['show', process.env.HJ_V431_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  async function test(name, fn) { await fn(); passed++; console.log('PASS leakintakeweb-v431 ' + name); }
  const tapOk = async (p, selector) => {
    const sizes = await p.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  async function shot(p, name) {
    if (!process.env.HJ_V431_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V431_SHOTS, { recursive: true });
    await p.screenshot({ path: path.join(process.env.HJ_V431_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }

  // ── 공개 페이지 ─────────────────────────────────────────────
  const pub = await context.newPage(); pub.setDefaultTimeout(15000); pub.on('pageerror', e => errors.push('leak.html: ' + e));
  await pub.addInitScript(() => { window.__leakCopied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __leakCopied.push(t); } } }); });
  await pub.goto(PAGE, { waitUntil: 'load' });
  await pub.waitForFunction(() => window.LeakIntake && document.querySelectorAll('.chip').length > 0);
  await test('public page: six checklists share v419 values, required check, sms body, no price, no upload', async () => {
    const choices = await pub.evaluate(() => LeakIntake.CHOICES);
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const m = html.match(/const HJ_LEAK_INTAKE_CHOICES=Object\.freeze\(\{([\s\S]*?)\n\}\);/); assert(m, 'app intake choices found');
    const appChoices = {}; for (const [, key, list] of m[1].matchAll(/(\w+):Object\.freeze\(\[([^\]]*)\]\)/g)) appChoices[key] = [...list.matchAll(/'([^']*)'/g)].map(x => x[1]);
    assert.deepEqual(choices, appChoices, 'leak.js choices must equal index.html HJ_LEAK_INTAKE_CHOICES');
    assert.equal(await pub.locator('fieldset[data-key]').count(), 7); assert.equal(await pub.locator('#whereChips .chip').count(), 8); assert.equal(await pub.locator('#timeChips .chip').count(), 4);
    const text = await pub.evaluate(() => document.body.innerText);
    assert(!/\d[\d,]*\s*원|만\s*원|최저가|무조건|100%|업계\s*1위|무료/.test(text), 'no price or exaggeration on the public page');
    assert.match(text, /010-2397-8629/); assert.equal(await pub.locator('input[type=file]').count(), 0, 'no upload input');
    assert.equal(await pub.evaluate(() => /fetch\(|XMLHttpRequest|sendBeacon|localStorage|indexedDB/.test(Array.from(document.scripts).map(s => s.src).join(' ')) ? false : true), true);
    const js = fs.readFileSync(path.join(ROOT, 'leak.js'), 'utf8'); assert(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|indexedDB|FormData/.test(js), 'leak.js never uploads or stores');
    assert.equal(await pub.locator('#kakaoLink').isHidden(), true, 'no fake kakao link while the channel url is empty');
    assert.equal(await pub.evaluate(() => LeakIntake.validate()), false); assert.match(await pub.locator('#formError').innerText(), /어디서 새는지/);
    await pub.locator('#whereChips .chip', { hasText: '욕실' }).click(); await pub.locator('#whereChips .chip', { hasText: '천장' }).click();
    await pub.locator('#sinceChips .chip', { hasText: '2~3일' }).click(); await pub.locator('#amountChips .chip', { hasText: '똑똑 떨어짐' }).click();
    await pub.locator('#neighborChips .chip', { hasText: '아랫집에서 연락 옴' }).click(); await pub.locator('#officeChips .chip', { hasText: '했음' }).click(); await pub.locator('#insuranceChips .chip', { hasText: '모름' }).click();
    await pub.locator('#dong').fill('유천동'); await pub.locator('#timeChips .chip', { hasText: '오전' }).click(); await pub.locator('#name').fill('김');
    assert.equal(await pub.evaluate(() => LeakIntake.validate()), true);
    const href = await pub.locator('#smsLink').getAttribute('href');
    assert(href.startsWith('sms:01023978629?body='), href);
    const body = decodeURIComponent(href.slice('sms:01023978629?body='.length));
    assert.equal(body, SAMPLE); assert.equal(body.split('\n')[0], SAMPLE.split('\n')[0]);
    assert.equal(await pub.evaluate(() => LeakIntake.buildLine(LeakIntake.state)), SAMPLE.split('\n')[0]);
    await pub.locator('#send details summary').click(); await pub.locator('#copyText').click(); await pub.waitForFunction(() => __leakCopied.length === 1);
    assert.equal(await pub.evaluate(() => __leakCopied[0]), SAMPLE);
    await tapOk(pub, '.chip, #smsLink, #copyText, #callTop');
    assert(await pub.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at 390px');
    await shot(pub, '01-leak-page');
  });
  assert.deepEqual(network.foreign, [], 'public page requests nothing outside its origin'); assert.equal(network.writes, 0);
  await pub.close();

  // ── 앱 ───────────────────────────────────────────────────────
  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__v431Calls = { copied: [], external: [] };
    window.open = (...args) => { __v431Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __v431Calls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { __v431Calls.copied.push(t); } } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjLeakWebParse', 'hjLeakWebIntakeView', 'hjLeakWebLinkHtml', 'hjLeakWebIntroText'].every(k => typeof window[k] === 'function') && typeof HJ_LEAK_WEB_URL === 'string'), true, 'LEAKWEB_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V431_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  if (process.env.HJ_V431_MUTATION) {
    assert.equal(process.env.HJ_V431_MUTATION, 'keymap');
    await page.evaluate(() => { const real = hjLeakWebParse; hjLeakWebParse = t => { const r = real(t); r.fields = { where: [], since: '', amount: '', neighbor: '', office: '', insurance: '', memo: r.fields.memo }; r.ok = false; return r; }; });
  }
  async function close() { await page.evaluate(() => closeModal(true)); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = [];
      state.projects = [{ name: 'TEST_EXISTING_INTERIOR', kind: 'interior', stage: 1, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; __v431Calls.copied = []; __v431Calls.external = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V431_SEED_SAVE_FAILED');
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

  await test('parser: normal, missing, reordered and broken inputs', async () => {
    await seed(); const before = await snapshot();
    const r = await page.evaluate(sample => {
      const line = sample.split('\n')[0];
      return { normal: hjLeakWebParse(sample), missing: hjLeakWebParse('[누수접수] 어디서=주방;동=둔산동'), reordered: hjLeakWebParse('고객 문자 앞부분\n[누수접수] 이름=박;시간=저녁;보험=없음;물양=흐름;어디서=베란다 벽;언제=오늘;관리사무소=안 함'), broken: hjLeakWebParse('물이 새요 급해요 010-0000-0000'), garbage: hjLeakWebParse('[누수접수] 어디서=옥상;언제=작년;물양=많이;이상한항목=값'), summary: hjLeakWebSummary(hjLeakWebParse(line)) };
    }, SAMPLE);
    assert.equal(r.normal.ok, true, 'LEAKWEB_PARSE_FIELDS'); assert.deepEqual(r.normal.fields.where, ['욕실', '천장']); assert.equal(r.normal.fields.since, '2~3일'); assert.equal(r.normal.fields.amount, '똑똑 떨어짐'); assert.equal(r.normal.fields.neighbor, '아랫집에서 연락 옴'); assert.equal(r.normal.fields.office, '했음'); assert.equal(r.normal.fields.insurance, '모름');
    assert.equal(r.normal.dong, '유천동'); assert.equal(r.normal.time, '오전'); assert.equal(r.normal.name, '김'); assert.deepEqual(r.normal.unknown, []); assert.match(r.normal.fields.memo, /웹 접수 · 동네 유천동 · 연락 가능 오전/);
    assert.equal(r.missing.ok, true); assert.deepEqual(r.missing.fields.where, ['주방']); assert.equal(r.missing.fields.since, ''); assert.equal(r.missing.dong, '둔산동'); assert.equal(r.missing.name, '');
    assert.equal(r.reordered.ok, true); assert.deepEqual(r.reordered.fields.where, ['베란다', '벽']); assert.equal(r.reordered.fields.since, '오늘'); assert.equal(r.reordered.fields.amount, '흐름'); assert.equal(r.reordered.fields.office, '안 함'); assert.equal(r.reordered.fields.insurance, '없음'); assert.equal(r.reordered.name, '박'); assert.equal(r.reordered.time, '저녁');
    assert.equal(r.broken.ok, false); assert.equal(r.broken.marker, false); assert.deepEqual(r.broken.fields.where, []);
    assert.equal(r.garbage.ok, false, 'unknown values are never forced into the checklist'); assert.deepEqual(r.garbage.fields.where, []); assert.equal(r.garbage.fields.since, ''); assert.equal(r.garbage.unknown.length, 4); assert.match(r.garbage.fields.memo, /확인 필요/);
    assert.match(r.summary, /위치 욕실·천장 · 시작 2~3일 · 물 양 똑똑 떨어짐/);
    sameSnapshot(await snapshot(), before, 'parsing is read only');
  });

  await test('paste view registers a leak inquiry and opens the prefilled intake → dispatch', async () => {
    await seed();
    await page.evaluate(() => hjInquiryView()); await page.locator('#inqPaste').waitFor(); await tapOk(page, '#inqPaste'); await page.locator('#inqPaste').click();
    await page.locator('#hjLeakWebText').waitFor(); await page.locator('#hjLeakWebText').fill(SAMPLE);
    await page.waitForFunction(() => /위치 욕실·천장/.test(document.getElementById('hjLeakWebPreview')?.textContent || ''));
    assert.equal(await page.locator('#hjLeakWebName').inputValue(), '김'); await tapOk(page, '#modalRoot .mfoot button'); await shot(page, '02-paste-view');
    await page.locator('#hjLeakWebPhone').fill('010-0000-0001'); await footer('문의 등록').click();
    await page.locator('#hjLeakIntake').waitFor();
    const created = await page.evaluate(() => { const p = state.projects.find(x => x.kind === 'leak'); return { name: p && p.name, cust: p && p.customer, src: p && p.leadSrc, intake: p && p.leak && p.leak.intake, notes: state.notes.map(n => n.text.split('\n')[0]), contacts: state.contacts.length }; });
    assert.equal(created.name, '유천동 누수 김'); assert.equal(created.cust.name, '김'); assert.equal(created.cust.phone, '010-0000-0001'); assert.equal(created.src, 'web'); assert.equal(created.intake, undefined, 'intake is not saved twice — the intake screen saves it'); assert.equal(created.contacts, 1);
    assert(created.notes.some(t => /^\[문의 접수\]/.test(t)));
    assert.deepEqual(await page.locator('[data-leakwhere]:checked').evaluateAll(els => els.map(e => e.value)), ['욕실', '천장']);
    assert.equal(await page.locator('#hjLeakSince').inputValue(), '2~3일'); assert.equal(await page.locator('#hjLeakAmount').inputValue(), '똑똑 떨어짐'); assert.match(await page.locator('#hjLeakMemo').inputValue(), /웹 접수 · 동네 유천동/);
    await footer('오늘 출동 잡기').click();
    await page.waitForFunction(() => { const p = state.projects.find(x => x.kind === 'leak'); return !!(p && p.leak && p.leak.intake && p.leak.intake.where.length === 2); });
    const saved = await page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.kind === 'leak'); return { intake: p.leak.intake, stored: (await idbGetStrict('appState')).projects.find(x => x.name === p.name).leak.intake, modal: document.querySelector('#modalRoot h3#modalTitle')?.textContent || '' }; });
    assert.deepEqual(saved.intake.where, ['욕실', '천장']); assert.equal(saved.intake.since, '2~3일'); assert.deepEqual(saved.stored, saved.intake); assert.match(saved.modal, /출동|일정/);
    await shot(page, '03-dispatch');
  });

  await test('broken text still becomes an inquiry with the memo only', async () => {
    await seed();
    await page.evaluate(() => hjLeakWebIntakeView({ text: '물이 새요 급해요', phone: '' })); await page.locator('#hjLeakWebText').waitFor();
    assert.match(await page.locator('#hjLeakWebPreview').innerText(), /메모로만 저장/);
    await page.locator('#hjLeakWebName').fill('이'); await footer('문의 등록').click();
    await page.locator('#modalRoot h3#modalTitle', { hasText: '문의 등록' }).waitFor();
    const r = await page.evaluate(() => { const p = state.projects.find(x => x.kind === 'leak'); return { name: p.name, intake: p.leak, note: state.notes.find(n => /물이 새요 급해요/.test(n.text)) }; });
    assert.equal(r.name, '누수 문의 이'); assert.equal(r.intake, undefined); assert(r.note, 'raw text kept as the inquiry memo');
  });

  await test('share inbox with the intake text offers the same parser', async () => {
    await seed();
    await page.evaluate(async sample => { const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }); await hjShareShow([{ id: 'share-test-1', name: 'leak1.png', type: 'image/png', size: blob.size, blob, at: new Date().toISOString(), title: '', text: sample }]); }, SAMPLE);
    await page.locator('[data-share-leakweb]').waitFor(); await tapOk(page, '#hjShareLeakWeb'); await page.locator('#hjShareLeakWeb').click();
    await page.locator('#hjLeakWebText').waitFor(); assert.equal(await page.locator('#hjLeakWebText').inputValue(), SAMPLE);
    await close();
    await page.evaluate(async () => { const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }); await hjShareShow([{ id: 'share-test-2', name: 'other.png', type: 'image/png', size: blob.size, blob, at: new Date().toISOString(), title: '', text: '그냥 사진' }]); });
    await page.locator('#hjShareInbox').waitFor(); assert.equal(await page.locator('[data-share-leakweb]').count(), 0, 'no banner without the marker');
  });

  await test('ads link card, shell list unchanged, stage-pages registered, menu contract, no errors', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(() => { state.tab = 'ads'; render(); }); await page.locator('[data-leakweb]').waitFor();
    assert.match(await page.locator('[data-leakweb]').innerText(), /leak\.html/); await tapOk(page, '[data-leakwebcopy]');
    await page.locator('[data-leakwebcopy="intro"]').click(); await page.waitForFunction(() => __v431Calls.copied.length === 1);
    const intro = await page.evaluate(() => __v431Calls.copied[0]);
    assert(!/010[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(intro.replace(/https?:\/\/\S+/g, '')), 'intro text carries no phone number'); assert.match(intro, /leak\.html$/); assert(!/\d\s*원|최저가/.test(intro));
    await page.locator('[data-leakwebcopy="url"]').click(); await page.waitForFunction(() => __v431Calls.copied.length === 2);
    assert.equal(await page.evaluate(() => __v431Calls.copied[1]), 'https://01023978629.github.io/hyeonjang/leak.html');
    sameSnapshot(await snapshot(), before);
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), shell = sw.match(/const SHELL_PATHS=new Set\(\[([\s\S]*?)\]\);/)[1];
    assert(!/leak\./.test(shell), 'leak page is not an app shell asset'); assert.equal((shell.match(/SCOPE_PATH/g) || []).length, 13, 'shell list unchanged');
    const stage = fs.readFileSync(path.join(ROOT, 'scripts', 'stage-pages.mjs'), 'utf8'); for (const f of ['leak.html', 'leak.css', 'leak.js']) assert(stage.includes("'" + f + "'"), f + ' staged to Pages');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v431Calls.external), []);
  });
  console.log(`leakintakeweb-v431: ${passed}/${passed} PASS; synthetic data; uploads=0; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL leakintakeweb-v431', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 600))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

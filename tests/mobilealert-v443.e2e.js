/* v443 모바일 — 일정·출동 N분 전 알림 · 폰 캘린더 알람(.ics) · 음성 메모. 합성 레코드만, 외부 쓰기 0.
   HJ_V443_BASELINE=<commit> 은 ALERT_API_PRESENT 에서, HJ_V443_MUTATION=alert-dup(중복 알림 가드 제거) 는 ALERT_ONCE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const LEAK = 'TEST_ALERT_LEAK', INT = 'TEST_ALERT_INT', CUST = '테스트고객', PHONE = '010-1234-5678';
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const baseline = process.env.HJ_V443_BASELINE && execFileSync('git', ['show', process.env.HJ_V443_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
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
    window.__v443Calls = { external: [], notes: [], vibrate: [], ics: [], perm: 0 };
    window.open = (...args) => { __v443Calls.external.push(args); return null; };
    navigator.vibrate = p => { __v443Calls.vibrate.push(p); return true; };
    window.Notification = class { constructor(title, opt) { __v443Calls.notes.push({ title, body: opt && opt.body }); } static async requestPermission() { __v443Calls.perm++; window.Notification.permission = 'granted'; return 'granted'; } };
    window.Notification.permission = 'default';
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjAlertCfg', 'hjAlertDue', 'hjAlertTick', 'hjAlertBanner', 'hjAlertIcsItems', 'hjAlertIcsSave', 'hjAlertSettingsView', 'hjVoiceFields', 'hjMicAttach'].every(k => typeof window[k] === 'function') && /VALARM/.test(buildICS.toString())), true, 'ALERT_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (!state._cwSchedInit || !Array.isArray(state.calendarImports)) throw Error('TEST_V443_BOOT_SEEDERS_NOT_READY');
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    saveICSToPhone = async (items, name, opts) => { __v443Calls.ics.push({ name, text: buildICS(items, opts), n: items.length }); return { 완료: '저장' }; };
  });
  if (process.env.HJ_V443_MUTATION) {
    assert.equal(process.env.HJ_V443_MUTATION, 'alert-dup');
    await page.evaluate(() => { hjAlertSeen = () => new Set(); });
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS mobilealert-v443 ' + name); }
  async function close() { await page.evaluate(() => { closeModal(true); const b = document.getElementById('hjAlertBar'); if (b) b.remove(); }); await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire); }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    return page.evaluate(async ({ leak, int, cust, phone }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.inventory = []; state.expenses = [];
      const project = (name, kind) => ({ name, kind, stage: 1, phases: [], customer: { name: cust, phone, addr: '대전 중구 대흥동 101동 1203호' }, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(leak, 'leak'); p.leak = { intake: { where: ['욕실'], at: localDate() + 'T01:00:00.000Z' } };
      state.projects = [p, project(int, 'interior')];
      const today = localDate();
      state.schedule = [
        { id: 'A1', date: today, time: '14:00', title: '🚨 누수 출동', project: leak, urgent: true, memo: '고객 ' + cust + ' ' + phone + ' 문 앞 대기' },
        { id: 'A2', date: today, time: '14:20', title: '타일 시공', project: int, memo: '' },
        { id: 'A3', date: today, time: '15:00', title: '도배', project: int, memo: '' },
        { id: 'A4', date: today, time: '', title: '종일 정리', project: int, memo: '' }];
      state.activeProject = null; state.tab = 'dashboard'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__v443Calls)) __v443Calls[k] = k === 'perm' ? 0 : [];
      localStorage.removeItem('hj_alert_cfg'); localStorage.removeItem('hj_alerted'); localStorage.removeItem('hj_alert_help_seen'); window.Notification.permission = 'default';
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V443_SEED_SAVE_FAILED');
      return { today };
    }, { leak: LEAK, int: INT, cust: CUST, phone: PHONE });
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
    if (!process.env.HJ_V443_SHOTS) return;
    fs.mkdirSync(process.env.HJ_V443_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.HJ_V443_SHOTS, name + '.png'), fullPage: false, animations: 'disabled' });
  }
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), selector + ' ' + JSON.stringify(sizes));
  };
  const noOverflow = async () => { assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'modal horizontal overflow'); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow'); };
  const at = (hm) => page.evaluate(hm => { const d = new Date(localDate() + 'T00:00:00'); const [h, m] = hm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.getTime(); }, hm);

  await test('① N분 전 판정 — 정각 30분 전·설정 10/60분·출동만·이미 울린 것은 다시 안 울림(저장 자료는 그대로)', async () => {
    await seed(); const before = await snapshot();
    const due = await page.evaluate(async times => {
      const r = {}; for (const [k, t] of Object.entries(times)) r[k] = hjAlertDue(new Date(t)).map(s => s.id); return r;
    }, { t1330: await at('13:30'), t1329: await at('13:29'), t1400: await at('14:00'), t1351: await at('13:51') });
    assert.deepEqual(due, { t1330: ['A1'], t1329: [], t1400: ['A2'], t1351: ['A1', 'A2'] });
    const cfgs = await page.evaluate(async t => { hjAlertCfgSave({ min: 10 }); const ten = hjAlertDue(new Date(t)).map(s => s.id); hjAlertCfgSave({ min: 60, leakOnly: true }); const leakOnly = hjAlertDue(new Date(t)).map(s => s.id); hjAlertCfgSave({ min: 30, leakOnly: false, on: false }); const off = hjAlertDue(new Date(t)).map(s => s.id); hjAlertCfgSave({ on: true }); return { ten, leakOnly, off }; }, await at('13:51'));
    assert.deepEqual(cfgs, { ten: ['A1'], leakOnly: ['A1'], off: [] });
    const first = await page.evaluate(async t => hjAlertTick(new Date(t)), await at('13:31'));
    assert.equal(first.rang, 1); await page.locator('#hjAlertBar').waitFor();
    const second = await page.evaluate(async t => hjAlertTick(new Date(t)), await at('13:32'));
    assert.equal(second.rang, 0, 'ALERT_ONCE');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('hj_alerted'))), ['A1|' + (await page.evaluate(() => localDate())) + ' 14:00']);
    const moved = await page.evaluate(async t => { state.schedule.find(s => s.id === 'A1').time = '14:30'; const r = hjAlertDue(new Date(t)).map(s => s.id); state.schedule.find(s => s.id === 'A1').time = '14:00'; return r; }, await at('14:05'));
    assert.deepEqual(moved, ['A2', 'A1'], 'a moved appointment alerts again');
    sameSnapshot(await snapshot(), before, 'alerts do not change saved data');
  });

  await test('② 알림 권한 허용/거절 양쪽 — 띠·진동·알림·띠에서 현장 열기, 권한은 버튼을 눌렀을 때만', async () => {
    await seed();
    assert.equal(await page.evaluate(() => __v443Calls.perm), 0, 'no permission prompt on load');
    const denied = await page.evaluate(async t => { Notification.permission = 'denied'; return hjAlertTick(new Date(t)); }, await at('13:35'));
    assert.deepEqual([denied.rang, denied.notified], [1, 0]); await page.locator('#hjAlertBar').waitFor();
    assert.match(await page.locator('[data-alert-text]').innerText(), /🚨 14:00 TEST_ALERT_LEAK 누수 출동 — 25분 전/); assert.equal(await page.evaluate(() => __v443Calls.vibrate.length), 1);
    await tapOk('#hjAlertBar button'); await shot('01-banner');
    await page.locator('[data-alert-go]').click(); await page.waitForFunction(leak => state.tab === 'project' && state.activeProject === leak, LEAK); assert.equal(await page.locator('#hjAlertBar').count(), 0);
    await page.evaluate(() => { localStorage.removeItem('hj_alerted'); Notification.permission = 'default'; state.tab = 'dashboard'; render(); });
    await page.evaluate(() => openGdriveSetup()); await page.locator('#setTab-etc').click(); await page.locator('#hjAlertOpen').click(); await page.locator('#hjAlertSet').waitFor();
    assert.equal(await page.locator('[data-alert-help]').count(), 1, 'first-use help'); assert.match(await page.locator('[data-alert-help]').innerText(), /앱이 꺼져 있으면 폰 캘린더 알림이 확실합니다/);
    await tapOk('#modalRoot .mfoot button, [data-al-min], #alPerm, #alIcs, #hjAlertSet label:has(#alOn)'); await noOverflow(); await shot('02-settings');
    await page.locator('#alPerm').click(); await page.locator('[data-alert-perm="granted"]').waitFor(); assert.equal(await page.evaluate(() => __v443Calls.perm), 1);
    assert.equal(await page.locator('[data-alert-help]').count(), 0, 'help shows once');
    await page.locator('[data-al-min="10"]').click(); await page.locator('[data-al-min="10"][aria-pressed="true"]').waitFor(); assert.equal(await page.evaluate(() => hjAlertCfg().min), 10);
    await page.locator('#alLeakOnly').check(); assert.equal(await page.evaluate(() => hjAlertCfg().leakOnly), true);
    await page.evaluate(() => hjAlertCfgSave({ min: 30, leakOnly: false })); await close();
    const granted = await page.evaluate(async t => hjAlertTick(new Date(t)), await at('13:52'));
    assert.deepEqual([granted.rang, granted.notified], [2, 2]); assert.deepEqual(await page.evaluate(() => __v443Calls.notes.map(n => n.title)), ['🚨 14:00 TEST_ALERT_LEAK 누수 출동 — 8분 전', '⏰ 14:20 TEST_ALERT_INT 타일 시공 — 28분 전']);
    assert.match(await page.locator('[data-alert-text]').innerText(), /외 1건/);
    assert.deepEqual(errors, []);
  });

  await test('③ 폰 캘린더 .ics — VALARM −30분, 제목 현장·주소, 준비물, 고객 이름·전화 없음, 하루치 n건, 일정 카드 1건', async () => {
    await seed();
    await page.locator('#view [data-ics-today]').waitFor(); assert.match(await page.locator('#view [data-ics-today]').innerText(), /오늘 일정 3건 폰 캘린더에 넣기 \(알람 30분 전\)/); await tapOk('#view [data-ics-today]');
    await page.locator('#view [data-ics-today]').click(); await page.waitForFunction(() => __v443Calls.ics.length === 1);
    const ics = await page.evaluate(() => __v443Calls.ics[0]);
    assert.equal(ics.name, '일정 4건.ics'); assert.equal((ics.text.match(/BEGIN:VEVENT/g) || []).length, 4); assert.equal((ics.text.match(/BEGIN:VALARM/g) || []).length, 3, 'all-day item has no alarm');
    assert.match(ics.text, /TRIGGER:-PT30M/); assert.match(ics.text, /SUMMARY:\[TEST_ALERT_LEAK\] 🚨 누수 출동 — 대전 중구 대흥동 101동 1203호/); assert.match(ics.text, /LOCATION:대전 중구 대흥동 101동 1203호/);
    assert(!ics.text.includes(CUST) && !ics.text.replace(/\D/g, '').includes(PHONE.replace(/\D/g, '')), 'no customer name or phone');
    await page.evaluate(() => hjAlertCfgSave({ min: 10 })); await page.evaluate(() => exportScheduleICS('A2')); await page.waitForFunction(() => __v443Calls.ics.length === 2);
    const one = await page.evaluate(() => __v443Calls.ics[1]); assert.equal((one.text.match(/BEGIN:VEVENT/g) || []).length, 1); assert.match(one.text, /TRIGGER:-PT10M/); assert.match(one.text, /타일 시공/);
    const plain = await page.evaluate(() => buildICS([{ id: 'x', date: localDate(), time: '10:00', title: 'T', project: 'P' }])); assert(!/VALARM/.test(plain), 'existing exports stay without an alarm');
  });

  await test('④ 받아쓰기(누르고 말하기) · 탐지 메모 말로 칸 채우기 3가지 · 미지원이면 녹음 → 현장 파일(2MB 제한)', async () => {
    await seed();
    const split = await page.evaluate(() => [hjVoiceFields('방법 청음, 가스 그리고 열화상, 원인 욕실 바닥 온수 배관, 위치 세면대 아래'), hjVoiceFields('원인은 윗집 같아요'), hjVoiceFields('그냥 물이 새요')]);
    assert.deepEqual(split[0], { methods: ['청음', '가스', '열화상'], cause: '온수관', place: '세면대 아래' }); assert.deepEqual(split[1], { methods: [], cause: '윗세대', place: '윗집 같아요' }); assert.deepEqual(split[2], { methods: [], cause: '', place: '' });
    await page.evaluate(() => { window.SpeechRecognition = class { start() { setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: '방법 청음, 원인 욕실 바닥 온수 배관, 위치 세면대 아래' }], { isFinal: true })] }), 10); } stop() { setTimeout(() => this.onend && this.onend(), 5); } }; });
    await page.evaluate(leak => hjLeakDetectView(leak), LEAK); await page.locator('#hjLeakDetect [data-mic]').waitFor();
    assert.match(await page.locator('#hjLeakDetect [data-mic]').innerText(), /누르고 말하기/); await tapOk('#hjLeakDetect [data-mic], #hjLeakDetect [data-mic-fill]'); await noOverflow(); await shot('03-mic');
    const before = await snapshot();
    await page.locator('#hjLeakDetect [data-mic]').dispatchEvent('pointerdown'); await page.waitForFunction(() => /세면대 아래/.test(document.getElementById('hjLeakNote').value));
    await page.locator('#hjLeakDetect [data-mic]').dispatchEvent('pointerup');
    await page.locator('[data-mic-fill]').click();
    const filled = await page.evaluate(() => ({ methods: [...document.querySelectorAll('[data-leak-method][aria-pressed="true"]')].map(b => b.dataset.leakMethod), cause: document.getElementById('hjLeakCause').value, place: document.getElementById('hjLeakPlace').value }));
    assert.deepEqual(filled, { methods: ['청음'], cause: '온수관', place: '세면대 아래' });
    sameSnapshot(await snapshot(), before, 'dictation only fills the form — saving is still the save button');
    await close();
    await page.evaluate(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.__recSize = 1000;
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
      window.MediaRecorder = class { constructor() { this.state = 'inactive'; } start() { this.state = 'recording'; } stop() { this.state = 'inactive'; this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(window.__recSize)], { type: 'audio/webm' }) }); setTimeout(() => this.onstop && this.onstop(), 5); } }; });
    await page.evaluate(leak => hjLeakDetectView(leak), LEAK); await page.locator('#hjLeakDetect [data-mic]').waitFor(); assert.match(await page.locator('#hjLeakDetect [data-mic]').innerText(), /🎙 녹음/);
    await page.locator('#hjLeakDetect [data-mic]').click(); await page.locator('#hjLeakDetect [data-mic]', { hasText: '멈추기' }).waitFor(); await page.locator('#hjLeakDetect [data-mic]').click();
    await page.waitForFunction(() => /\[음성 \d{2}\/\d{2} \d{2}:\d{2}\]/.test(document.getElementById('hjLeakNote').value));
    const file = await page.evaluate(() => state.files.filter(f => /^음성_\d{8}_\d{4}\.webm$/.test(f.name)).map(f => [f.kind, f.project]));
    assert.deepEqual(file, [['other', LEAK]]);
    // 토스트 글자는 다음 토스트가 덮어쓴다 — 부하가 걸리면 기다리는 사이 사라져 가끔 실패했다. 나온 토스트를 모두 적어 두고 본다.
    await page.evaluate(() => { window.__recSize = 2 * 1024 * 1024 + 1; window.__v443Toasts = []; if (!window.__v443ToastWrapped) { const real = toast; toast = m => { (window.__v443Toasts = window.__v443Toasts || []).push(String(m)); return real(m); }; window.__v443ToastWrapped = true; } });
    await page.locator('#hjLeakDetect [data-mic]').click(); await page.locator('#hjLeakDetect [data-mic]', { hasText: '멈추기' }).waitFor(); await page.locator('#hjLeakDetect [data-mic]').click();
    await page.waitForFunction(() => (window.__v443Toasts || []).some(t => /2MB/.test(t)) || /2MB/.test(document.querySelector('#toast').textContent)); assert.equal(await page.evaluate(() => state.files.filter(f => /^음성_/.test(f.name)).length), 1, 'over 2MB is not kept');
  });

  await test('⑤ sw 앱 셸 목록 그대로 · 새 최상위 키 없음 · 더보기 계약 · 390px', async () => {
    await seed(); const before = await snapshot();
    const swNow = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), swBase = execFileSync('git', ['show', '3c7db67:sw.js'], { cwd: ROOT, encoding: 'utf8' });
    const shell = t => (t.match(/SHELL_PATHS\s*=\s*(?:new Set\()?\[[^\]]*\]/) || [''])[0]; assert(shell(swNow), 'SHELL_PATHS found'); assert.equal(shell(swNow), shell(swBase), 'sw.js SHELL_PATHS unchanged');
    await page.evaluate(() => hjAlertSettingsView()); await page.locator('#hjAlertSet').waitFor(); await close();
    sameSnapshot(await snapshot(), before, 'settings live outside the saved data');
    assert.deepEqual((await snapshot()).keys, before.keys);
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0); assert.deepEqual(await page.evaluate(() => __v443Calls.external), []);
  });
  console.log(`mobilealert-v443: ${passed}/${passed} PASS; synthetic data; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL mobilealert-v443', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 700))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

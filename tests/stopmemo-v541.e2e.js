/* v541 📝 작업 종료 때 '오늘 한 일' 한 줄 — [⏱ 종료] 직후 토스트 옆 작은 입력 줄(최종 UI 계획 1번). 합성 자료만, 외부 쓰기 0.
   ① PC 1280: [⏱ 시작] → [⏱ 종료] 직후 위쪽 토스트 바로 아래 한 줄 칸(현장 이름 · 44px · 16px 글자 · 토스트와 안 겹침) →
      적고 Enter → 방금 끝낸 그 기록의 메모 · 칸 닫힘 · ⏱ 작업시간 줄에 '📝 …'(v514) (STOP_MEMO)
   ② 건너뛰기: 적다가 [건너뛰기] · Esc · 손대지 않고 시간이 지나면 닫힘 — 자료 그대로(직렬화 같음) (SKIP)
   ③ 폰 390 + 직원 모드: 하단 메뉴·아래쪽 토스트 위, 가로 넘침 없음, [저장] 누르면 by:'staff' 기록에 메모 (STAFF)
   ④ 이미 메모가 있으면 ' · ' 로 잇고 같은 글이면 그대로 · 오래된 창(__tabStale)이면 저장 안 함 (APPEND)
   ⑤ 소스·핀 3곳(v541 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V541_BASELINE=<commit> 은 ① 에서, HJ_V541_MUTATION=skip-saves(건너뛰기가 적던 글을 저장)는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const PJ = 'TEST_v541 가상현장 가', PJ2 = 'TEST_v541 가상현장 나';
const MUT = process.env.HJ_V541_MUTATION || '';
let html = process.env.HJ_V541_BASELINE ? execFileSync('git', ['show', process.env.HJ_V541_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'skip-saves');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "bar.querySelector('[data-stopmemo-skip]').onclick=()=>hjStopMemoClose();";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "bar.querySelector('[data-stopmemo-skip]').onclick=()=>hjStopMemoSave(id,inp.value);");
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, height, mobile, staff }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(staffOn => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); if (staffOn) localStorage.setItem('hj_role', 'staff'); }, !!staff);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && typeof workPunch === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
  }, { keys: BOOT, mobile: !!mobile });
  await page.evaluate(names => {
    names.forEach(name => state.projects.push({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }));
    state.tab = 'project'; state.activeProject = names[0]; render();
  }, [PJ, PJ2]);
  return { context, page };
}
const data = page => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
const lastLog = page => page.evaluate(() => { const l = workData().slice(-1)[0]; return l ? { project: l.project, memo: l.memo, out: !!l.out, by: l.by || '' } : null; });
async function punchStop(page) {
  await page.locator('#view [data-punch]').first().click();
  await page.waitForFunction(() => /⏱ 종료/.test((document.querySelector('#view [data-punch]') || {}).textContent || ''));
  await page.locator('#view [data-punch]').first().click();
  await page.locator('#hjStopMemo').waitFor({ state: 'visible' });
}
const rect = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, w: r.width }; }, sel);
const overlap = (a, b) => !!(a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b);
async function test(name, fn) { await fn(); passed++; console.log('PASS stopmemo-v541 ' + name); }
// HJ_SHOTS=<폴더> 면 화면을 남긴다(화면 모음용) — 검사 결과와는 무관
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const pc = await open({ width: 1280, height: 800 });
  const page = pc.page;

  await test('① PC — [⏱ 종료] 직후 토스트 아래 한 줄 칸 → Enter 로 그 기록 메모 · 칸 닫힘 · 작업시간 줄에 📝 (STOP_MEMO)', async () => {
    await punchStop(page);
    const ui = await page.evaluate(() => {
      const bar = document.getElementById('hjStopMemo'), inp = bar.querySelector('input'), t = document.getElementById('toast');
      return { label: bar.querySelector('label').textContent, fs: getComputedStyle(inp).fontSize, ih: Math.round(inp.getBoundingClientRect().height), bh: [...bar.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height)), toast: t.classList.contains('show') ? t.textContent : '', focus: document.activeElement === inp, sw: document.documentElement.scrollWidth - innerWidth };
    });
    assert.match(ui.label, /오늘 한 일 한 줄/); assert(ui.label.includes(PJ), 'label names the project ' + ui.label);
    assert.equal(ui.fs, '16px'); assert(ui.ih >= 44 && ui.bh.every(h => h >= 44), 'tap targets ' + JSON.stringify(ui));
    assert.match(ui.toast, /종료 — 오늘/, 'stop toast still shown ' + ui.toast); assert.equal(ui.focus, true, 'PC focuses the input');
    assert(!overlap(await rect(page, '#hjStopMemo'), await rect(page, '#toast')), 'bar does not cover the toast');
    assert(ui.sw <= 0, 'no horizontal overflow');
    await shot(page, 'v541-pc-stopmemo');
    await page.locator('#hjStopMemoIn').fill('TEST 안방 도배 마감');
    await page.locator('#hjStopMemoIn').press('Enter');
    await page.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.deepEqual(await lastLog(page), { project: PJ, memo: 'TEST 안방 도배 마감', out: true, by: '' });
    await page.evaluate(name => workView(name), PJ); await page.locator('#modalRoot [data-wl-memo]').first().waitFor();
    const shown = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-wl-memo]')].map(x => x.textContent));
    assert(shown.some(t => t.includes('TEST 안방 도배 마감')), 'memo shows on the work log row ' + JSON.stringify(shown));
    await page.evaluate(() => closeModal(true));
  });

  await test('② 건너뛰기 · Esc — 적던 글이 있어도 자료 그대로 (SKIP)', async () => {
    await punchStop(page);
    const before = await data(page);
    await page.locator('#hjStopMemoIn').fill('TEST 적다가 그만');
    await page.locator('#hjStopMemo [data-stopmemo-skip]').click();
    await page.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.equal(await data(page), before, 'SKIP leaves app data unchanged');
    assert.equal((await lastLog(page)).memo, '');
    await punchStop(page);
    const before2 = await data(page);
    await page.locator('#hjStopMemoIn').fill('TEST Esc 로 닫음');
    await page.locator('#hjStopMemoIn').press('Escape');
    await page.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.equal(await data(page), before2, 'Esc leaves app data unchanged');
  });

  const phone = await open({ width: 390, height: 844, mobile: true, staff: true });
  const pm = phone.page;
  await test('③ 폰 390 + 직원 모드 — 하단 메뉴·토스트 위, 넘침 없음, [저장] → by:staff 기록에 메모 · 손대지 않으면 저절로 닫힘 (STAFF)', async () => {
    assert.equal(await pm.evaluate(() => hjStaffOn()), true, 'staff mode on');
    await punchStop(pm);
    const bar = await rect(pm, '#hjStopMemo'), nav = await rect(pm, '#mobileNav'), t = await rect(pm, '#toast');
    assert(bar.l >= 0 && bar.r <= 390, 'bar inside the screen ' + JSON.stringify(bar));
    assert(nav && bar.b <= nav.t, 'bar above the bottom menu ' + JSON.stringify({ bar, nav }));
    assert(!overlap(bar, t), 'bar does not cover the toast ' + JSON.stringify({ bar, t }));
    assert.notEqual(await pm.evaluate(() => document.activeElement && document.activeElement.id), 'hjStopMemoIn', 'phone does not pop the keyboard');
    assert(await pm.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'no horizontal overflow');
    await shot(pm, 'v541-phone-stopmemo');
    await pm.locator('#hjStopMemoIn').fill('TEST 직원 욕실 줄눈');
    await pm.locator('#hjStopMemo [data-stopmemo-save]').click();
    await pm.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.deepEqual(await lastLog(pm), { project: PJ, memo: 'TEST 직원 욕실 줄눈', out: true, by: 'staff' });
    // 손대지 않으면 저절로 닫힘(자료 그대로) — 기다리는 시간만 줄여 확인
    await pm.evaluate(() => { HJ_STOP_MEMO_IDLE = 400; });
    await punchStop(pm);
    const before = await data(pm);
    await pm.locator('#hjStopMemo').waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await data(pm), before, 'idle close leaves data unchanged');
    await pm.evaluate(() => { HJ_STOP_MEMO_IDLE = 25000; });
  });

  await test("④ 이미 메모가 있으면 ' · ' 로 잇기 · 같은 글은 그대로 · 오래된 창은 저장 안 함 (APPEND)", async () => {
    await punchStop(page);
    await page.evaluate(() => { workData().slice(-1)[0].memo = 'TEST 기존 메모'; });
    await page.locator('#hjStopMemoIn').fill('TEST 추가 한 줄'); await page.locator('#hjStopMemoIn').press('Enter');
    await page.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.equal((await lastLog(page)).memo, 'TEST 기존 메모 · TEST 추가 한 줄');
    await punchStop(page);
    await page.evaluate(() => { workData().slice(-1)[0].memo = 'TEST 같은 글'; });
    await page.locator('#hjStopMemoIn').fill('  TEST   같은 글 '); await page.locator('#hjStopMemoIn').press('Enter');
    await page.locator('#hjStopMemo').waitFor({ state: 'detached' });
    assert.equal((await lastLog(page)).memo, 'TEST 같은 글', 'same text is not doubled');
    await punchStop(page);
    const before = await data(page);
    await page.evaluate(() => { __tabStale = true; });
    await page.locator('#hjStopMemoIn').fill('TEST 오래된 창'); await page.locator('#hjStopMemoIn').press('Enter');
    await page.waitForFunction(() => /오래된 창/.test(document.getElementById('toast').textContent));
    assert.equal(await page.locator('#hjStopMemo').count(), 1, 'bar stays so the text is not lost');
    await page.evaluate(() => { __tabStale = false; });
    assert.equal(await data(page), before, 'stale tab writes nothing');
    await page.locator('#hjStopMemo [data-stopmemo-skip]').click();
  });

  await test('⑤ 소스·핀 3곳(v541 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(/try\{hjStopMemoOffer\(open\.id\);\}catch\(e\)\{\}/.test(src), 'workPunch offers the memo line on stop');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 541, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('stopmemo-v541: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL stopmemo-v541', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

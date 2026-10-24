/* v500 👷 팀 보고 노트 줄 — 작업일 옆 '오늘·어제·n일 전'(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 줄 머리 'M/D(요일) · 상태' 뒤에 0일 '· 오늘', 1일 '· 어제', 2~6일 '· n일 전'. 7·9일 전·앞날·날짜 이상은 표시 없음 (AGO)
   ② [📋 글로 복사] 글엔 넣지 않음 · 칩을 바꿔도 같은 표시 · 390px 넘침 없음 · 자료 불변 · 오류 0
   HJ_V500_BASELINE=<commit> 은 AGO 에서 실패해야 한다. HJ_V500_MUTATION=no-ago(표시 안 함)도 AGO 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T38 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V500_MUTATION || '';
let html = process.env.HJ_V500_BASELINE ? execFileSync('git', ['show', process.env.HJ_V500_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-ago');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "return n===0?'오늘':n===1?'어제':n>=2&&n<=6?n+'일 전':'';";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "return '';");
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, workDate, reporter) => ({ key, status, workDate, hours: 2, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0001', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_D9', 'done', ago(9), '김타일'), rep('TEST_D7', 'done', ago(7), '박설비'), rep('TEST_D6', 'review', ago(6), '김타일'), rep('TEST_D2', 'done', ago(2), '박설비'),
        rep('TEST_D1', 'blocked', ago(1), '김타일'), rep('TEST_D0', 'done', today, '박설비'), rep('TEST_F1', 'done', hjAddDays(today, 1), '김타일'), rep('TEST_X', 'done', '날짜없음', '박설비')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V500_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS noteago-v500 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const agos = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => [n.getAttribute('data-team-note'), (n.querySelector('[data-team-note-ago]') || {}).textContent || ''])));

  await test('① 0일 오늘 · 1일 어제 · 2·6일 n일 전 · 7·9일·앞날·날짜 이상은 없음 (AGO)', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const a = await agos();
    assert.deepEqual(a, { TEST_D9: '', TEST_D7: '', TEST_D6: ' · 6일 전', TEST_D2: ' · 2일 전', TEST_D1: ' · 어제', TEST_D0: ' · 오늘', TEST_F1: '', TEST_X: '' }, 'AGO labels ' + JSON.stringify(a));
    const head = await page.evaluate(() => document.querySelector('#modalRoot [data-team-note="TEST_D0"] b').textContent);
    assert.match(head, / · ✅ 완료 · 오늘$/, 'after the status ' + head);
  });

  await test('② 복사 글엔 없음 · 칩을 바꿔도 같은 표시 · 넘침 없음 · 자료 불변 · 오류 0', async () => {
    const before = await serialized();
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const text = await page.evaluate(() => window.__copied[0]);
    assert.doesNotMatch(text, /오늘|어제|일 전/, 'copy text unchanged ' + text);
    await page.locator('#modalRoot [data-note-filter-status="done"]').click();
    const a = await agos();
    assert.equal(a.TEST_D0, ' · 오늘'); assert.equal(a.TEST_D2, ' · 2일 전'); assert.equal(a.TEST_D9, '');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`noteago-v500: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL noteago-v500', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

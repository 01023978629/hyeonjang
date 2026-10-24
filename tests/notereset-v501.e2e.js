/* v501 👷 팀 보고 노트 창 — [✕ 조건 모두 끄기](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 조건(상태·보고자·⚠ 이슈·🗓 최근 7일) 하나만 켜면 단추 없음 · 둘 이상이면 칩 줄 끝에 [✕ 조건 모두 끄기](44px)
      → 누르면 전부 보임(전부·👤 모두 눌림, 이슈·최근 꺼짐) · 단추 사라짐 · 이슈+최근 조합도 같음 (RESET)
   ② 복사·모두 확인함은 다시 전부 기준 · 390px 넘침 없음 · 자료 불변 · 오류 0
   HJ_V501_BASELINE=<commit> 은 RESET 에서 실패해야 한다. HJ_V501_MUTATION=no-reset(단추 없음)도 RESET 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T39 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V501_MUTATION || '';
let html = process.env.HJ_V501_BASELINE ? execFileSync('git', ['show', process.env.HJ_V501_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-reset');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const act=(f.status?1:0)+(f.reporter?1:0)+(f.issue?1:0)+(f.recent?1:0);';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const act=0;');
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
    const rep = (key, status, days, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done: '작업 ' + key, issue, reporter, checklist: [], photos: 0, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0002', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_R1', 'review', 9, '줄눈 색', '김타일'), rep('TEST_R2', 'done', 8, '', '박설비'), rep('TEST_R3', 'blocked', 3, '자재 미도착', '박설비'),
        rep('TEST_R4', 'done', 2, '', '김타일'), rep('TEST_R5', 'review', 1, '', '박설비')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V501_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notereset-v501 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const reset = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-note-filter-reset]'); return b ? [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)] : null; });
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-note-filter] button[aria-pressed="true"]')].map(b => b.textContent.trim()));
  const ALL = ['TEST_R5', 'TEST_R4', 'TEST_R3', 'TEST_R2', 'TEST_R1'];

  await test('① 하나면 없음 · 둘 이상이면 [✕ 조건 모두 끄기] → 전부 · 이슈+최근도 같음 (RESET)', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await reset(), null, 'no filter → no button');
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    assert.equal(await reset(), null, 'one condition → no button');
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.deepEqual(await keys(), ['TEST_R5'], 'review ∩ 박설비');
    assert.deepEqual(await reset(), ['✕ 조건 모두 끄기', 44], 'RESET button with two conditions');
    await page.locator('#modalRoot [data-note-filter-reset]').click();
    assert.deepEqual(await keys(), ALL, 'RESET shows everything');
    assert.deepEqual(await pressed(), ['전부 5', '👤 모두'], 'chips back to all ' + JSON.stringify(await pressed()));
    assert.equal(await reset(), null, 'button gone after reset');
    await page.locator('#modalRoot [data-note-filter-issue]').click();
    await page.locator('#modalRoot [data-note-filter-recent]').click();
    assert.deepEqual(await keys(), ['TEST_R3'], 'issue ∩ recent');
    assert(await reset(), 'RESET for issue + recent');
    await page.locator('#modalRoot [data-note-filter-reset]').click();
    assert.deepEqual(await keys(), ALL, 'RESET clears issue and recent');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-note-filter-issue],#modalRoot [data-note-filter-recent]')].map(b => b.getAttribute('aria-pressed'))), ['false', 'false']);
  });

  await test('② 복사·모두 확인함은 다시 전부 기준 · 넘침 없음 · 자료 불변 · 오류 0', async () => {
    const before = await serialized();
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.match((await page.evaluate(() => window.__copied[0])).split('\n')[0], /팀 작업 보고 5건$/, 'copy covers all after reset');
    assert.match(await page.locator('#modalRoot [data-team-note-ackall]').textContent(), /3건 모두 확인함/, 'ack-all counts all unacked review/blocked');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notereset-v501: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notereset-v501', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

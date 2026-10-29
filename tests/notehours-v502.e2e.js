/* v502 👷 팀 보고 노트 창 — '⏱ 보고자별 시간'(공수 정산용, 개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 보이는 보고를 보고자별로 묶어 '👤 이름 n건 · h시간'(시간 많은 순, 소수 한 자리, 보고자 없으면 '보고자 없음') + 둘 이상이면 '합 h시간'
      · 상태·보고자 칩을 따름(한 사람만이면 합 없음) · 자료 불변 (HOURS)
   ② 시간이 하나도 없으면 줄 없음 · 390px 넘침 없음 · 오류 0
   HJ_V502_BASELINE=<commit> 은 HOURS 에서 실패해야 한다. HJ_V502_MUTATION=no-hours(줄 없음)도 HOURS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T40 둔산 크로바아파트 101동 1203호', ZERO = 'TEST_T40 대흥동 상가 2층';
const MUT = process.env.HJ_V502_MUTATION || '';
let html = process.env.HJ_V502_BASELINE ? execFileSync('git', ['show', process.env.HJ_V502_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-hours');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const total=[...by.values()].reduce((t,g)=>t+g.h,0);if(!(total>0))return '';";
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
  await page.evaluate(async ({ APT, ZERO }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, hours, reporter) => ({ key, status, workDate: ago(days), hours, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0003', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [rep('TEST_R1', 'done', 6, 2, '김타일'), rep('TEST_R2', 'done', 5, 3.5, '김타일'), rep('TEST_R3', 'blocked', 4, 0, '김타일'),
        rep('TEST_R4', 'done', 3, 4, '박설비'), rep('TEST_R5', 'review', 2, 1, '박설비'), rep('TEST_R6', 'done', 1, 2, '')]),
      proj(ZERO, [rep('TEST_Z1', 'done', 3, 0, '이목수'), rep('TEST_Z2', 'review', 2, 0, '최도장'), rep('TEST_Z3', 'blocked', 1, 0, '이목수')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V502_SEED_SAVE_FAILED');
  }, { APT, ZERO });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notehours-v502 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const hours = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-team-note-hours]'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : null; });

  await test('① 보고자별 건수·시간(시간 많은 순·소수 한 자리·보고자 없음) · 합 · 칩을 따름 · 자료 불변 (HOURS)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await hours(), '⏱ 보고자별 시간 👤 김타일 3건 · 5.5시간 👤 박설비 2건 · 5시간 👤 보고자 없음 1건 · 2시간 합 12.5시간', 'HOURS line ' + await hours());
    await page.locator('#modalRoot [data-note-filter-status="done"]').click();
    assert.equal(await hours(), '⏱ 보고자별 시간 👤 김타일 2건 · 5.5시간 👤 박설비 1건 · 4시간 👤 보고자 없음 1건 · 2시간 합 11.5시간', 'follows the status chip');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.equal(await hours(), '⏱ 보고자별 시간 👤 박설비 2건 · 5시간', 'one reporter → no sum');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 시간이 하나도 없으면 줄 없음 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), ZERO); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await hours(), null, 'no hours → no line');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot [data-team-note-hours]').waitFor();
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notehours-v502: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notehours-v502', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v509 👷 팀 공수 정산 창 — 달 옮기기 ◀ n월 / n월 ▶(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 이번 달 창: [◀ 지난달 숫자](44px), 다음 달 단추 없음 → ◀ 누르면 지난달 제목·보고(이번 달 것 빠짐) → 한 번 더 ◀ 지지난달
      → [n월 ▶] 두 번에 다시 이번 달 · [← 팀 보고 노트]는 옮겨도 남음 · 1월이면 지난해 12월(hjYmShift) · 자료 불변 (NAV)
   ② 390px 넘침 없음 · 오류 0
   HJ_V509_BASELINE=<commit> 은 NAV 에서 실패해야 한다. HJ_V509_MUTATION=no-nav(달 옮기기 없음)도 NAV 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T47 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V509_MUTATION || '';
let html = process.env.HJ_V509_BASELINE ? execFileSync('git', ['show', process.env.HJ_V509_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-nav');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "'<div id=\"hjTeamHours\" style=\"min-width:0\">'+nav+body+'</div>'";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "'<div id=\"hjTeamHours\" style=\"min-width:0\">'+body+'</div>'");
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
  const D = await page.evaluate(async ({ A }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', p1 = hjAddDays(first, -5), p2 = hjAddDays(hjAddDays(first, -40).slice(0, 7) + '-10', 0), at = new Date().toISOString();
    const rep = (key, workDate, hours, reporter) => ({ key, status: 'done', workDate, hours, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    state.projects = [{ name: A, kind: 'interior', stage: 2, phases: ['철거'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0010', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_N1', today, 3, '김타일'), rep('TEST_N2', today, 2, '김타일'), rep('TEST_P1', p1, 5, '박설비'), rep('TEST_Q1', p2, 7, '이목수')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    const ymName = ym => Number(ym.slice(0, 4)) + '년 ' + Number(ym.slice(5, 7)) + '월';
    return { cur: ymName(today.slice(0, 7)), prev: ymName(p1.slice(0, 7)), prev2: ymName(p2.slice(0, 7)), prevN: Number(p1.slice(5, 7)), prev2N: Number(p2.slice(5, 7)), curN: Number(today.slice(5, 7)),
      jan: typeof hjYmShift === 'function' ? [hjYmShift('2027-01', -1), hjYmShift('2026-12', 1), hjYmShift('2026-10', -14)] : null };
  }, { A });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamhours2-v509 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const state1 = () => page.evaluate(() => { const r = document.getElementById('hjTeamHours'); return { title: document.getElementById('modalTitle').textContent.trim(),
    prev: (r.querySelector('[data-team-hours-prev]') || {}).textContent || null, next: (r.querySelector('[data-team-hours-next]') || {}).textContent || null,
    reps: [...r.querySelectorAll('[data-team-hours-reporter]')].map(b => b.getAttribute('data-team-hours-reporter')), back: !![...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent.includes('← 팀 보고 노트')) }; });

  await test('① ◀ 지난달 → 지지난달 → ▶▶ 이번 달 · 다음 달 단추는 이번 달에 없음 · 돌아가기 유지 · 1월 → 12월 · 자료 불변 (NAV)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), A); await page.locator('#modalRoot [data-team-hours-month]').click(); await page.locator('#modalRoot #hjTeamHours').waitFor();
    let s = await state1();
    assert.equal(s.title, '👷 팀 공수 정산 — ' + D.cur); assert.equal(s.prev, '◀ ' + D.prevN + '월', 'NAV prev button ' + s.prev); assert.equal(s.next, null, 'no next at this month');
    assert.deepEqual(s.reps, ['김타일']);
    const h = await page.evaluate(() => Math.round(document.querySelector('#hjTeamHours [data-team-hours-prev]').getBoundingClientRect().height)); assert.equal(h, 44);
    await page.locator('#modalRoot [data-team-hours-prev]').click(); await page.waitForFunction(t => document.getElementById('modalTitle').textContent.includes(t), D.prev);
    s = await state1(); assert.deepEqual(s.reps, ['박설비'], 'last month only'); assert.equal(s.next, D.curN + '월 ▶'); assert(s.back, 'back button kept');
    await page.locator('#modalRoot [data-team-hours-prev]').click(); await page.waitForFunction(t => document.getElementById('modalTitle').textContent.includes(t), D.prev2);
    s = await state1(); assert.deepEqual(s.reps, ['이목수'], 'two months ago');
    await page.locator('#modalRoot [data-team-hours-next]').click(); await page.waitForFunction(t => document.getElementById('modalTitle').textContent.includes(t), D.prev);
    await page.locator('#modalRoot [data-team-hours-next]').click(); await page.waitForFunction(t => document.getElementById('modalTitle').textContent.includes(t), D.cur);
    s = await state1(); assert.deepEqual(s.reps, ['김타일']); assert.equal(s.next, null);
    assert.deepEqual(D.jan, ['2026-12', '2027-01', '2025-08'], 'hjYmShift wraps years');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only — app data unchanged');
  });

  await test('② 넘침 없음 · 오류 0', async () => {
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamhours2-v509: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamhours2-v509', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v481 첫 화면 검수 요청·막힘 줄 — '· n일째'(개발_백로그 '검수 요청·막힘 줄 n일째 표시'). 합성 자료만, 외부 쓰기 0.
   ① 작업일부터 2일 이상 지난 미확인 보고에만 '· n일째' — 오늘·어제·미래·빈 날짜는 없음(날짜 경계 0·1·2·5·미래·빈·잘못된 날짜)
      · v477 목록 창은 현장마다 '가장 오래된 것 n일째' · 390px 넘침 없음 · 자료 불변 (AGE)
   ② [확인함]으로 2일째 줄이 내려가면 다음 줄(9일째)이 올라와 표시를 단다 · 오류 0
   HJ_V481_BASELINE=<commit> 은 AGE 에서 실패해야 한다. HJ_V481_MUTATION=no-age(날 수를 늘 0)도 AGE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T21 둔산 크로바아파트 101동 1203호', B = 'TEST_T21 대흥동 상가 2층', C = 'TEST_T21 유천동 빌라 302호';
const MUT = process.env.HJ_V481_MUTATION || '';
let html = process.env.HJ_V481_BASELINE ? execFileSync('git', ['show', process.env.HJ_V481_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-age');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'return n>=2?n:0;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'return 0;');
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
  await page.evaluate(async ({ A, B, C }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, workDate, done, issue) => ({ key, status, workDate, hours: 2, done, issue, reporter: '김타일', checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8101', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [
      proj(A, [rep('TEST_R0', 'review', today, '벽 타일 2차', ''), rep('TEST_R1', 'review', ago(1), '벽 타일 1차', '줄눈 색 확인'), rep('TEST_R2', 'review', ago(2), '바닥 타일', '')]),
      proj(B, [rep('TEST_B5', 'blocked', ago(5), '', '자재 미도착'), rep('TEST_BF', 'blocked', hjAddDays(today, 1), '', '내일 날짜로 잘못 적힘'), rep('TEST_BE', 'blocked', '', '', '날짜 없음')]),
      proj(C, [rep('TEST_C9', 'review', ago(9), '천장 목공', '')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V481_SEED_SAVE_FAILED');
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamage-v481 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const dash = () => page.evaluate(() => [...document.querySelectorAll('#view [data-team-report-row]')].map(n => { const t = n.querySelector('[data-team-days]'); return [n.getAttribute('data-team-report-row'), t ? t.getAttribute('data-team-days') : null, t ? t.textContent.trim() : '']; }));
  const listRows = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-pending-all-row]')].map(n => { const t = n.querySelector('[data-team-days]'); return [n.getAttribute('data-team-pending-all-row'), t ? t.textContent.trim() : null]; }));

  await test('① 2일 이상만 "· n일째" · 날짜 경계 · 목록 창 "가장 오래된 것 n일째" · 넘침 없음 · 자료 불변 (AGE)', async () => {
    await page.locator('#view [data-team-report-pending]').waitFor();
    const before = await serialized();
    const d = await dash();
    assert.deepEqual(d, [['TEST_R0', null, ''], ['TEST_R1', null, ''], ['TEST_R2', '2', '· 2일째'], ['TEST_B5', '5', '· 5일째'], ['TEST_BF', null, ''], ['TEST_BE', null, '']], 'AGE dashboard labels ' + JSON.stringify(d));
    const unit = await page.evaluate(() => { const t = localDate(); return ['', null, '2026-13-45', '2026-02-30', 'abc', t, hjAddDays(t, -1), hjAddDays(t, -2), hjAddDays(t, -30), hjAddDays(t, 1)].map(hjTeamReportAgeDays); });
    assert.deepEqual(unit, [0, 0, 0, 0, 0, 0, 0, 2, 30, 0], 'AGE boundaries ' + JSON.stringify(unit));
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(ov <= 1, 'dashboard overflow ' + ov);
    await page.locator('#view [data-team-pending-all="review"]').click(); await page.locator('#modalRoot #hjTeamPendingAll').waitFor();
    assert.deepEqual(await listRows(), [[A, '· 가장 오래된 것 2일째'], [C, '· 가장 오래된 것 9일째']], 'AGE review list');
    const lov = await page.evaluate(() => { const m = document.getElementById('hjTeamPendingAll'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(lov.every(x => x <= 1), 'list overflow ' + JSON.stringify(lov));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => hjTeamPendingAllView('blocked')); await page.locator('#modalRoot #hjTeamPendingAll').waitFor();
    assert.deepEqual(await listRows(), [[B, '· 가장 오래된 것 5일째']], 'blocked list — future/empty dates do not count');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read-only — app data unchanged');
  });

  await test('② [확인함]으로 2일째 줄이 내려가면 9일째 줄이 올라와 표시 · 오류 0', async () => {
    await page.locator('#view [data-team-report-row="TEST_R2"] [data-team-ack]').click();
    await page.waitForFunction(() => !document.querySelector('#view [data-team-report-row="TEST_R2"]'));
    const d = await dash();
    assert.deepEqual(d.slice(0, 3), [['TEST_R0', null, ''], ['TEST_R1', null, ''], ['TEST_C9', '9', '· 9일째']], 'next row comes up with its label ' + JSON.stringify(d));
    assert.equal(await page.locator('#view [data-team-pending-all="review"]').count(), 0, 'three review rows → no more button');
    await page.evaluate(async () => { const c = window.confirm; window.confirm = () => true; try { await loadDemo(); } finally { window.confirm = c; } });   // 실제 자료가 있어 묻는 창에 [확인] · 데모 검수 요청은 이틀 전 — '· 2일째' 시연(2025년 날짜로 두면 '590일째'로 보였다)
    assert.equal((await page.locator('#view [data-team-report-row="wr_demo_20250312"] [data-team-days]').textContent()).trim(), '· 2일째', 'demo shows the label');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamage-v481: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamage-v481', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

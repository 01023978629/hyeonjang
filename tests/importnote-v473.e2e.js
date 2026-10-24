/* v473 📥 팀 작업 가져오기 — 반영 결과 창의 [👷 노트 보기](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 사진 없는 보고를 반영하면 결과 창(현장별 n건·상태, [👷 노트 보기])이 뜨고, 단추를 누르면 그 현장 노트 창이 마지막 반영 보고에 초점을 두고 열린다 · 반영 자체(보고·작업시간·노트)는 예전과 같다 (IMPORT_RESULT)
   ② 전부 중복(반영 0건)이면 결과 창이 뜨지 않는다 · 390px 넘침 없음 · 44px · 오류 0
   HJ_V473_BASELINE=<commit> 은 IMPORT_RESULT 에서 실패해야 한다. HJ_V473_MUTATION=no-result(결과 창을 안 연다)도 IMPORT_RESULT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T13 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T13 대흥동 상가';
const MUT = process.env.HJ_V473_MUTATION || '';
let html = process.env.HJ_V473_BASELINE ? execFileSync('git', ['show', process.env.HJ_V473_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-result');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'if(done.length&&!photoJobs.length){hjWrResultView(done,{applied,dup,failed});return;}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
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
  const D = await page.evaluate(async ({ APT, OTHER }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n);
    state.projects = [
      { name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7301', addr: '대전 서구 둔산동' } },
      { name: OTHER, kind: 'interior', stage: 2, phases: ['도배'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V473_SEED_SAVE_FAILED');
    return { today, r1: ago(2), r2: ago(1) };
  }, { APT, OTHER });
  const packet = JSON.stringify({ type: 'hj-work-report', version: 1, sentAt: new Date().toISOString(), reporter: '김타일', reports: [
    { id: 'TEST_I1', project: { name: APT }, status: 'done', workDate: D.r1, hours: 6, done: '욕실 바닥 타일 철거', checklist: [], photos: [] },
    { id: 'TEST_I2', project: { name: APT }, status: 'review', workDate: D.r2, hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인', photos: [] },
    { id: 'TEST_I3', project: { name: OTHER }, status: 'blocked', workDate: D.r2, hours: 0, issue: '자재 미도착', photos: [] }] });
  const footer = label => page.locator('#modalRoot .mfoot button', { hasText: label });
  async function test(name, fn) { await fn(); passed++; console.log('PASS importnote-v473 ' + name); }

  await test('① 반영 → 결과 창(현장별 n건·상태·[👷 노트 보기]) → 노트 창이 마지막 반영 보고에 초점 · 반영은 예전과 같음 (IMPORT_RESULT)', async () => {
    await page.evaluate(t => hjTeamReportImportView({ text: t, files: [] }), packet); await page.locator('#modalRoot [data-ti-report]').first().waitFor();
    assert.equal(await page.locator('#modalRoot [data-ti-matched]').count(), 3);
    await footer('반영').click();
    await page.locator('#modalRoot #hjWrResult').waitFor({ timeout: 15000 });
    const r = await page.evaluate(() => ({ hint: document.querySelector('#hjWrResult p.hint').textContent, rows: [...document.querySelectorAll('#hjWrResult [data-wr-result-row]')].map(x => [x.getAttribute('data-wr-result-row'), x.innerText.replace(/\s+/g, ' ').trim(), x.querySelector('[data-wr-note]').getAttribute('data-key'), Math.round(x.querySelector('[data-wr-note]').getBoundingClientRect().height)]) }));
    assert.match(r.hint, /보고 3건 반영/, 'IMPORT_RESULT hint ' + r.hint);
    assert.deepEqual(r.rows.map(x => [x[0], x[2]]), [[APT, 'TEST_I2'], [OTHER, 'TEST_I3']], 'IMPORT_RESULT rows per project, key = last applied ' + JSON.stringify(r.rows));
    assert.match(r.rows[0][1], /2건 ✅ 완료 · 🔎 검수 요청/); assert(r.rows.every(x => x[3] >= 44), 'tap targets');
    const applied = await page.evaluate(({ a, o }) => ({ apt: (state.projects.find(p => p.name === a).teamReports || []).map(x => [x.key, x.status]), other: (state.projects.find(p => p.name === o).teamReports || []).map(x => [x.key, x.status]), work: state.workLogs.length, notes: state.notes.filter(n => /^\[팀 보고\]/.test(n.text)).length }), { a: APT, o: OTHER });
    assert.deepEqual(applied, { apt: [['TEST_I1', 'done'], ['TEST_I2', 'review']], other: [['TEST_I3', 'blocked']], work: 1, notes: 3 }, 'apply unchanged ' + JSON.stringify(applied));
    await page.locator('#hjWrResult [data-wr-note]').first().click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const notes = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => [n.getAttribute('data-team-note'), n.hasAttribute('data-focus')]));
    assert.deepEqual(notes, [['TEST_I2', true], ['TEST_I1', false]], 'note window focused on the last applied report ' + JSON.stringify(notes));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow at 390px');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 전부 중복이면 결과 창 없음 · 오류 0', async () => {
    await page.evaluate(t => hjTeamReportImportView({ text: t, files: [] }), packet); await page.locator('#modalRoot [data-ti-report]').first().waitFor();
    assert.equal(await page.locator('#modalRoot [data-ti-dup]').count(), 3, 'all duplicates');
    await footer('반영').click(); await page.waitForTimeout(700);
    assert.equal(await page.locator('#modalRoot #hjWrResult').count(), 0, 'no result window when nothing applied');
    assert.equal(await page.evaluate(() => state.workLogs.length), 1, 'duplicate import adds nothing');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`importnote-v473: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL importnote-v473', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

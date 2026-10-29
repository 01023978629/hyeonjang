/* v465 첫 화면 '🔎 검수 요청 · ⛔ 막힘' 줄 — [확인함]으로 내리기(보고 레코드 ack). 합성 자료만, 외부 쓰기 0.
   ① 검수 요청·막힘 보고가 줄마다(현장 · 작업일 · 한 일/이슈, 보고자 이름 없음) [확인함] 44px 단추와 함께 보이고, 누르면 그 줄만 사라진다 · ack·ackAt 이 보고 레코드에 저장된다(TEAM_ACK_LINE)
   ② 완료(done) 보고는 이 줄에 없고 v458 '📄 팀 보고 n건 들어옴' 줄은 그대로 · 같은 보고를 두 번 확인해도 자료는 그대로 · 390px 넘침 없음 · 오류 0
   HJ_V465_BASELINE=<commit> 은 TEAM_ACK_LINE 에서 실패해야 한다. HJ_V465_MUTATION=no-ack(확인해도 ack 를 안 적음)도 TEAM_ACK_LINE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T5 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T5 대흥동 상가';
const MUT = process.env.HJ_V465_MUTATION || '';
let html = process.env.HJ_V465_BASELINE ? execFileSync('git', ['show', process.env.HJ_V465_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-ack');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'r.ack=true;r.ackAt=localDate();n++;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'n++;');
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
    window.__v465 = { toasts: [] }; const o = window.toast; window.toast = m => { __v465.toasts.push(String(m)); return o(m); };
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    state.projects = [
      { name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6501', addr: '대전 서구 둔산동' },
        workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
          { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거', issue: '', reporter: '김타일', checklist: [], photos: 0, at },
          { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [], photos: 0, at }] }],
        teamReports: [{ key: 'TEST_R3', status: 'blocked', workDate: ago(1), hours: 0, done: '', issue: '자재 미도착 — 타일 본드', reporter: '김타일', checklist: [], photos: 0, at }] },
      { name: OTHER, kind: 'interior', stage: 2, phases: ['도배'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 },
        teamReports: [{ key: 'TEST_R4', status: 'review', workDate: ago(4), hours: 4, done: '도배 마감', issue: '', reporter: '박도배', checklist: [], photos: 0, at, ack: true, ackAt: ago(3) }] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V465_SEED_SAVE_FAILED');
    return { today, r2: ago(2), r3: ago(1) };
  }, { APT, OTHER });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamack-v465 ' + name); }
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#view [data-team-report-row]')].map(r => ({ key: r.getAttribute('data-team-report-row'), text: r.innerText.replace(/\s+/g, ' ').trim(), h: Math.round(r.querySelector('[data-team-ack]').getBoundingClientRect().height) })));
  const md = iso => iso.slice(5).replace('-', '/');

  await test('① 검수 요청·막힘 줄마다 [확인함](44px) · 누르면 그 줄만 내려감 · ack·ackAt 저장 (TEAM_ACK_LINE)', async () => {
    await page.locator('#view [data-team-report-pending]').waitFor();
    const r = await rows();
    assert.deepEqual(r.map(x => x.key), ['TEST_R2', 'TEST_R3'], 'TEAM_ACK_LINE rows ' + JSON.stringify(r));
    assert.match(r[0].text, new RegExp('^🔎 ' + APT + ' — ' + md(D.r2) + ' 벽 타일 1차 · 줄눈 색 확인 필요( · \\d+일째)? (보기 )?확인함$'), r[0].text);   // v466 부터 [보기] 가 앞에 붙는다 · v481 2일 이상이면 '· n일째'
    assert.match(r[1].text, new RegExp('^⛔ ' + APT + ' — ' + md(D.r3) + ' 자재 미도착 — 타일 본드( · \\d+일째)? (보기 )?확인함$'), r[1].text);
    assert(!r.some(x => /김타일/.test(x.text)), 'no reporter name'); assert(r.every(x => x.h >= 44), 'tap targets ' + JSON.stringify(r.map(x => x.h)));
    assert.match(await page.locator('#view [data-team-report-pending]').innerText(), /🔎 검수 요청 1건[\s\S]*⛔ 막힘 1건/);
    await page.locator('#view [data-team-ack="TEST_R2"]').click();
    await page.waitForFunction(() => !document.querySelector('#view [data-team-report-row="TEST_R2"]'));
    assert.deepEqual((await rows()).map(x => x.key), ['TEST_R3'], 'only the acked row is gone');
    assert.match(await page.evaluate(() => __v465.toasts.at(-1) || ''), /확인함으로 내렸어요/);
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const stored = await page.evaluate(async n => { const p = (await idbGetStrict('appState')).projects.find(x => x.name === n); const r = p.workOrders[0].reports.find(x => x.key === 'TEST_R2'); return [r.ack, r.ackAt === localDate(), p.teamReports[0].ack || false]; }, APT);
    assert.deepEqual(stored, [true, true, false], 'TEAM_ACK_LINE ack persisted in the report record ' + JSON.stringify(stored));
  });

  await test('② 완료 보고는 이 줄에 없고 v458 줄은 그대로 · 이미 확인한 보고는 두 번 안 바뀜 · 390px 넘침 없음 · 오류 0', async () => {
    const r = await page.evaluate(n => { const p = state.projects.find(x => x.name === n); const before = JSON.stringify(p); const again = hjTeamReportAck(n, 'TEST_R2'), doneTry = hjTeamReportAck(n, 'TEST_R1'); return { again, doneTry, same: JSON.stringify(p) === before, doneLine: !!document.querySelector('#view [data-team-done-doc]'), pending: hjTeamReportPending().map(x => x.key) }; }, APT);
    assert.deepEqual(r, { again: 0, doneTry: 0, same: true, doneLine: true, pending: ['TEST_R3'] }, JSON.stringify(r));
    await page.locator('#view [data-team-ack="TEST_R3"]').click();
    await page.waitForFunction(() => !document.querySelector('#view [data-team-report-pending]'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow at 390px');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamack-v465: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamack-v465', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

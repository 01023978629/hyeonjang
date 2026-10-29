/* v472 팀 보고 확인 취소 — 노트 창의 [확인 취소](개발_백로그 '팀 보고 확인 취소'). 합성 자료만, 외부 쓰기 0.
   ① 이미 확인한(ack) 검수 요청·막힘 줄에만 [확인 취소](44px) · 누르면 표식이 사라지고 [확인함]으로 돌아오며, 첫 화면 '🔎 검수 요청' 줄이 다시 올라오고 저장본에서 ack·ackAt 이 지워진다 · 그 밖의 자료 불변 (UNACK)
   ② 완료 줄엔 [확인 취소] 없음 · 취소 뒤 다시 [확인함] 도 됨 · 390px 넘침 없음 · 오류 0
   HJ_V472_BASELINE=<commit> 은 UNACK 에서 실패해야 한다. HJ_V472_MUTATION=no-clear(취소가 ack 를 안 지움)도 UNACK 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T12 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V472_MUTATION || '';
let html = process.env.HJ_V472_BASELINE ? execFileSync('git', ['show', process.env.HJ_V472_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-clear');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'delete r.ack;delete r.ackAt;n++;';
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
  await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7201', addr: '대전 서구 둔산동' },
      workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
        { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거', issue: '', reporter: '김타일', checklist: [], photos: 0, at },
        { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [], photos: 1, at, ack: true, ackAt: ago(1) }] }],
      teamReports: [{ key: 'TEST_R3', status: 'blocked', workDate: ago(1), hours: 0, done: '', issue: '자재 미도착', reporter: '박설비', checklist: [], photos: 0, at }] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V472_SEED_SAVE_FAILED');
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS unack-v472 ' + name); }
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => ({ key: n.getAttribute('data-team-note'), ack: !!n.querySelector('[data-team-note-ack]'), unack: !!n.querySelector('[data-team-note-unack]'), text: n.innerText.replace(/\s+/g, ' ').trim(), h: [...n.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height)) })));
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');

  await test('① 확인한 줄에만 [확인 취소] · 누르면 표식 사라짐·[확인함] 복귀·첫 화면 줄 다시 올라옴·저장본에서 ack 지워짐 · 그 밖 불변 (UNACK)', async () => {
    assert.equal(await page.evaluate(() => !!document.querySelector('#view [data-team-report-row="TEST_R2"]')), false, 'acked report is not on the dashboard');
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n, 'TEST_R2'), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const r = await rows();
    assert.deepEqual(r.map(x => [x.key, x.ack, x.unack]), [['TEST_R3', true, false], ['TEST_R2', false, true], ['TEST_R1', false, false]], 'UNACK button only on the acked row ' + JSON.stringify(r.map(x => [x.key, x.ack, x.unack])));
    assert.match(r[1].text, /확인함 /); assert(r.flatMap(x => x.h).every(h => h >= 44), 'tap targets');
    await page.locator('#modalRoot [data-team-note="TEST_R2"] [data-team-note-unack]').click();
    await page.waitForFunction(() => !!document.querySelector('#modalRoot [data-team-note="TEST_R2"] [data-team-note-ack]'));
    const after = await rows();
    assert.equal(after[1].unack, false); assert.doesNotMatch(after[1].text, /확인함 /, 'UNACK mark gone ' + after[1].text);
    assert.equal(await page.evaluate(() => !!document.querySelector('#view [data-team-report-row="TEST_R2"]')), true, 'dashboard row is back');
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const stored = await page.evaluate(async n => { const p = (await idbGetStrict('appState')).projects.find(x => x.name === n); const r = p.workOrders[0].reports.find(x => x.key === 'TEST_R2'); return ['ack' in r, 'ackAt' in r]; }, APT);
    assert.deepEqual(stored, [false, false], 'UNACK persisted (keys removed) ' + JSON.stringify(stored));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
  });

  await test('② 완료 줄엔 [확인 취소] 없음 · 취소 뒤 다시 [확인함] · 390px 넘침 없음 · 오류 0', async () => {
    const r = await rows(); assert.equal(r[2].unack, false); assert.equal(r[2].ack, false);
    await page.locator('#modalRoot [data-team-note="TEST_R2"] [data-team-note-ack]').click();
    await page.waitForFunction(() => !!document.querySelector('#modalRoot [data-team-note="TEST_R2"] [data-team-note-unack]'));
    assert.equal(await page.evaluate(() => !!document.querySelector('#view [data-team-report-row="TEST_R2"]')), false, 'acked again → dashboard row gone');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`unack-v472: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL unack-v472', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

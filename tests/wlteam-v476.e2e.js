/* v476 ⏱ 작업시간 줄 — 팀 완료 보고가 만든 줄에 '👷 팀 보고' 표시 + [👷 노트](개발_백로그 '작업일지 줄 팀 보고 표시 + 노트 열기'). 합성 자료만, 외부 쓰기 0.
   ① workLogs[].teamReport.key 가 있는 줄에만 배지(보고자 포함)와 [👷 노트] · 누르면 그 현장 노트 창이 그 보고에 초점을 두고 열린다 · 보통 줄은 그대로(수정·삭제만) · 자료 불변 (WL_TEAM)
   ② 390px 넘침 없음 · 오류 0
   HJ_V476_BASELINE=<commit> 은 WL_TEAM 에서 실패해야 한다. HJ_V476_MUTATION=no-note(단추 제거)도 WL_TEAM 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T16 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V476_MUTATION || '';
let html = process.env.HJ_V476_BASELINE ? execFileSync('git', ['show', process.env.HJ_V476_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-note');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "'<div class=\"worklog-actions\">'+(tr?'<button class=\"ghost tiny wkNote\"";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "'<div class=\"worklog-actions\">'+(false?'<button class=\"ghost tiny wkNote\"");
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
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 },
      workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
        { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거', issue: '', reporter: '김타일', checklist: [], photos: 0, at },
        { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈', reporter: '김타일', checklist: [], photos: 0, at }] }] }];
    state.workLogs = [
      { id: 'TEST_WL1', project: APT, date: ago(3), in: '09:00', out: '17:00', memo: '[팀 보고 · 김타일] 욕실 바닥 타일 철거 (보고 8h 기준)', teamReport: { key: 'TEST_R1', orderId: 'wo_20261020_001', hours: 8, reporter: '김타일' } },
      { id: 'TEST_WL2', project: APT, date: ago(1), in: '08:30', out: '12:00', memo: '직접 찍음' }];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlteam-v476 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① 팀 보고 줄에만 배지·[👷 노트] → 노트 창 초점 · 보통 줄은 그대로 · 자료 불변 (WL_TEAM)', async () => {
    const before = await serialized();
    await page.evaluate(n => workView(n), APT); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .worklog-row')].map(r => ({ team: r.getAttribute('data-wl-team'), text: r.querySelector('.worklog-project').innerText.replace(/\s+/g, ' ').trim(), btns: [...r.querySelectorAll('button')].map(b => b.textContent.trim()) })));
    assert.equal(rows.length, 2, JSON.stringify(rows));
    const team = rows.find(r => r.team === 'TEST_R1'), plain = rows.find(r => !r.team);
    assert(team && plain, 'WL_TEAM one team row and one plain row ' + JSON.stringify(rows));
    assert.match(team.text, /👷 팀 보고 · 김타일/, 'badge with reporter'); assert.deepEqual(team.btns, ['👷 노트', '✏️ 수정', '🗑 삭제'], 'WL_TEAM note button first');
    assert.doesNotMatch(plain.text, /팀 보고/); assert.deepEqual(plain.btns, ['✏️ 수정', '🗑 삭제']);
    await page.locator('#modalRoot .worklog-row[data-wl-team="TEST_R1"] .wkNote').click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const notes = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => [n.getAttribute('data-team-note'), n.hasAttribute('data-focus')]));
    assert.deepEqual(notes, [['TEST_R2', false], ['TEST_R1', true]], 'note window focused on the report that made the log ' + JSON.stringify(notes));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'nothing changed');
  });

  await test('② 390px 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => workView(n), APT); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const ov = await page.evaluate(() => { const r = document.querySelector('#modalRoot .worklog-row[data-wl-team]'); return { doc: document.documentElement.scrollWidth - innerWidth, row: r.scrollWidth - r.clientWidth, modal: (m => m.scrollWidth - m.clientWidth)(document.querySelector('#modalRoot .mbody')) }; });
    assert(ov.doc <= 1 && ov.row <= 1 && ov.modal <= 1, 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlteam-v476: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlteam-v476', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

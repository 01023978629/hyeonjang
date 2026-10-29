/* v491 👷 팀 보고 노트 창 — [✔ 보이는 검수·막힘 n건 모두 확인함](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 미확인 검수·막힘이 보이는 것 2건 이상일 때만 단추(44px) · 확인 창 [취소] → 그대로 · 보고자 칩(김타일)으로 2건만 보일 때 [확인] → 그 2건만 ack·ackAt(저장),
      다른 보고자 줄은 그대로 · 첫 화면 줄도 내려감 · 단추 사라짐 · ack 말고는 자료 불변 (ACK_ALL)
   ② 보이는 미확인이 1건이면 단추 없음(줄 [확인함] 쓰기) · 이미 확인한 줄은 건너뜀 · 390px 넘침 없음 · 오류 0
   HJ_V491_BASELINE=<commit> 은 ACK_ALL 에서 실패해야 한다. HJ_V491_MUTATION=no-filter-ack(칩을 무시하고 전부 확인)도 ACK_ALL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T30 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V491_MUTATION || '';
let html = process.env.HJ_V491_BASELINE ? execFileSync('git', ['show', process.env.HJ_V491_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-filter-ack');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const keys=hjTeamReportNoteUnacked(p,f).map(r=>String(r.key));';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const keys=hjTeamReportNoteUnacked(p,{}).map(r=>String(r.key));');
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
    const rep = (key, status, days, done, issue, reporter, extra) => Object.assign({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at }, extra || {});
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9101', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_R1', 'review', 4, '벽 타일 1차', '줄눈 색', '김타일'), rep('TEST_R2', 'review', 3, '천장 목공', '', '박설비'), rep('TEST_R3', 'blocked', 2, '', '자재 미도착', '김타일'),
        rep('TEST_R4', 'blocked', 1, '', '엘리베이터 사용 불가', '김타일', { ack: true, ackAt: ago(1) }), rep('TEST_R5', 'done', 0, '실리콘 마감', '', '김타일')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V491_SEED_SAVE_FAILED');
    window.__confirmAnswer = false; window.__confirms = []; window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS ackall-v491 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');
  const btn = () => page.evaluate(() => { const b = document.querySelector('#modalRoot #hjTeamNote [data-team-note-ackall]'); return b ? [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)] : null; });
  const acks = () => page.evaluate(n => state.projects.find(p => p.name === n).teamReports.map(r => [r.key, !!r.ack]), APT);

  await test('① 단추(보이는 미확인 3건) · [취소] 그대로 · 김타일 칩 → 2건만 확인 · 다른 줄 그대로 · 첫 화면 줄 내려감 · 저장 · 그 밖은 불변 (ACK_ALL)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.deepEqual(await btn(), ['✔ 보이는 검수·막힘 3건 모두 확인함', 44], 'ACK_ALL button for 3 visible unacked');
    await page.locator('#modalRoot [data-team-note-ackall]').click();
    assert.match(await page.evaluate(() => window.__confirms.at(-1) || ''), /보이는 검수 요청·막힘 3건을 모두 확인함으로 내릴까요\?/);
    assert.equal(await serialized(), before, 'cancel → nothing changes');
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    assert.deepEqual(await btn(), ['✔ 보이는 검수·막힘 2건 모두 확인함', 44], 'reporter chip narrows the count');
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.locator('#modalRoot [data-team-note-ackall]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-team-note-ackall]'));
    assert.deepEqual(await acks(), [['TEST_R1', true], ['TEST_R2', false], ['TEST_R3', true], ['TEST_R4', true], ['TEST_R5', false]], 'ACK_ALL only the visible ones ' + JSON.stringify(await acks()));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-note-filter-reporter][aria-pressed="true"]')].map(b => b.getAttribute('data-note-filter-reporter'))), ['김타일'], 'chip kept');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#view [data-team-report-row]')].map(n => n.getAttribute('data-team-report-row'))), ['TEST_R2'], 'dashboard rows came down');
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const stored = await page.evaluate(async n => (await idbGetStrict('appState')).projects.find(p => p.name === n).teamReports.map(r => [r.key, !!r.ack, r.ack ? r.ackAt === localDate() || r.key === 'TEST_R4' : null]), APT);
    assert.deepEqual(stored, [['TEST_R1', true, true], ['TEST_R2', false, null], ['TEST_R3', true, true], ['TEST_R4', true, true], ['TEST_R5', false, null]], 'persisted ' + JSON.stringify(stored));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 보이는 미확인 1건이면 단추 없음 · 390px 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await btn(), null, 'one unacked left → no bulk button');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`ackall-v491: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL ackall-v491', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v475 👷 팀 보고 노트 창 — 상태·보고자 칩(개발_백로그 '팀 보고 노트 창 상태 필터'). 합성 자료만, 외부 쓰기 0.
   ① 보고 5건(검수 2·막힘 1·완료 2, 보고자 2명)이면 창 위에 칩 '전부 5 · 🔎 검수 요청 2 · ⛔ 막힘 1 · ✅ 완료 2' + '👤 모두 · 👤 김타일 3 · 👤 박설비 2'(44px, aria-pressed) · 상태 칩 → 그 상태만, 보고자 칩과 겹치면 둘 다 맞는 줄만, [전부]·[👤 모두]로 복귀 · 자료 불변 (NOTE_FILTER)
   ② 칩을 고른 채 [확인함]을 눌러도 칩이 유지된다 · 보고 2건·보고자 1명이면 칩 없음 · 390px 넘침 없음 · 오류 0
   HJ_V475_BASELINE=<commit> 은 NOTE_FILTER 에서 실패해야 한다. HJ_V475_MUTATION=no-filter(칩을 눌러도 목록이 안 줄어듦)도 NOTE_FILTER 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T15 둔산 크로바아파트 101동 1203호', SMALL = 'TEST_T15 대흥동 상가';
const MUT = process.env.HJ_V475_MUTATION || '';
let html = process.env.HJ_V475_BASELINE ? execFileSync('git', ['show', process.env.HJ_V475_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-filter');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const rows=all.filter(r=>(!f.status||r.status===f.status)&&(!f.reporter||String(r.reporter||'')===f.reporter));";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const rows=all;');
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
  await page.evaluate(async ({ APT, SMALL }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const r = (key, status, n, reporter, done, issue) => ({ key, status, workDate: ago(n), hours: 2, done: done || '', issue: issue || '', reporter, checklist: [], photos: 0, at });
    state.projects = [
      { name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 },
        workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
          r('TEST_R1', 'done', 5, '김타일', '철거'), r('TEST_R2', 'review', 4, '김타일', '벽 타일 1차', '줄눈 확인'), r('TEST_R3', 'blocked', 3, '박설비', '', '자재 미도착')] }],
        teamReports: [r('TEST_R4', 'done', 2, '박설비', '배관 교체'), r('TEST_R5', 'review', 1, '김타일', '바닥 타일', '색 확인')] },
      { name: SMALL, kind: 'interior', stage: 2, phases: ['도배'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 },
        teamReports: [r('TEST_S1', 'done', 2, '박도배', '도배'), r('TEST_S2', 'review', 1, '박도배', '마감', '확인')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V475_SEED_SAVE_FAILED');
  }, { APT, SMALL });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notefilter-v475 ' + name); }
  const chips = () => page.evaluate(() => [...document.querySelectorAll('#hjTeamNote [data-note-filter] button')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)]));
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#hjTeamNote [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① 칩(상태 4 + 보고자) · 상태 칩 → 그 상태만 · 보고자 칩과 겹침 · [전부]·[👤 모두] 복귀 · 자료 불변 (NOTE_FILTER)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote [data-note-filter]').waitFor();
    const c = await chips();
    assert.deepEqual(c.map(x => x[0]), ['전부 5', '🔎 검수 요청 2', '⛔ 막힘 1', '✅ 완료 2', '⚠ 이슈 3', '👤 모두', '👤 김타일 3', '👤 박설비 2'], 'NOTE_FILTER chips ' + JSON.stringify(c));   // v494 부터 '⚠ 이슈' 칩
    assert.deepEqual(c.map(x => x[1]), ['true', 'false', 'false', 'false', 'false', 'true', 'false', 'false']); assert(c.every(x => x[2] >= 44), 'chips 44px');
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R4', 'TEST_R3', 'TEST_R2', 'TEST_R1'], 'all rows, newest first');
    await page.locator('#hjTeamNote [data-note-filter-status="review"]').click();
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R2'], 'NOTE_FILTER review only'); assert.equal((await chips())[1][1], 'true');
    await page.locator('#hjTeamNote [data-note-filter-reporter="박설비"]').click();
    assert.deepEqual(await keys(), [], 'review ∩ 박설비 = none'); assert.equal(await page.locator('#hjTeamNote [data-team-note-empty]').count(), 1, 'empty hint');
    await page.locator('#hjTeamNote [data-note-filter-status=""]').click();
    assert.deepEqual(await keys(), ['TEST_R4', 'TEST_R3'], '전부 ∩ 박설비');
    await page.locator('#hjTeamNote [data-note-filter-reporter=""]').click();
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R4', 'TEST_R3', 'TEST_R2', 'TEST_R1'], 'back to all');
    assert.equal(await serialized(), before, 'read-only');
  });

  await test('② 칩 유지한 채 [확인함] · 보고 2건·보고자 1명은 칩 없음 · 390px 넘침 없음 · 오류 0', async () => {
    await page.locator('#hjTeamNote [data-note-filter-status="review"]').click(); assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R2']);
    await page.locator('#hjTeamNote [data-team-note="TEST_R5"] [data-team-note-ack]').click();
    await page.waitForFunction(() => !!document.querySelector('#hjTeamNote [data-team-note="TEST_R5"] [data-team-note-unack]'));
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R2'], 'filter kept after ack'); assert.equal((await chips())[1][1], 'true', 'review chip still pressed');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), SMALL); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await page.locator('#hjTeamNote [data-note-filter]').count(), 0, 'no chips for 2 reports / 1 reporter'); assert.deepEqual(await keys(), ['TEST_S2', 'TEST_S1']);
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notefilter-v475: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notefilter-v475', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

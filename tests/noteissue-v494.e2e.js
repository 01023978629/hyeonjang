/* v494 👷 팀 보고 노트 창 — '⚠ 이슈' 칩(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 이슈 글이 있는 보고가 일부면 상태 칩 뒤에 [⚠ 이슈 3](44px, aria-pressed) → 이슈 있는 줄만 · 상태 칩·보고자 칩과 겹쳐 고름(칩을 바꿔도 이슈 칩 유지)
      · [📋 글로 복사] 머리줄 '· ⚠ 이슈'·그 줄만 · [모두 확인함]도 보이는 이슈 줄만 · ack 말고는 자료 불변 (ISSUE)
   ② 이슈 있는 보고가 없거나 전부면 칩 없음 · 빈 글 안내 · 390px 넘침 없음 · 오류 0
   HJ_V494_BASELINE=<commit> 은 ISSUE 에서 실패해야 한다. HJ_V494_MUTATION=no-issue(칩을 눌러도 줄이 안 줄어듦)도 ISSUE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T33 둔산 크로바아파트 101동 1203호', CLEAN = 'TEST_T33 대흥동 상가 2층';
const MUT = process.env.HJ_V494_MUTATION || '';
let html = process.env.HJ_V494_BASELINE ? execFileSync('git', ['show', process.env.HJ_V494_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-issue');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "return f.issue?rows.filter(r=>String(r.issue||'').trim()):rows;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'return rows;');
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
  await page.evaluate(async ({ APT, CLEAN }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9401', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [rep('TEST_R1', 'review', 5, '벽 타일 1차', '줄눈 색 확인', '김타일'), rep('TEST_R2', 'done', 4, '바닥 타일', '', '김타일'), rep('TEST_R3', 'blocked', 3, '', '자재 미도착', '박설비'),
      rep('TEST_R4', 'done', 2, '실리콘', '모서리 깨짐 — 다음 주 보수', '김타일'), rep('TEST_R5', 'review', 1, '천장 목공', '   ', '박설비')]),
      proj(CLEAN, [rep('TEST_C1', 'done', 3, '철거', '', '이목수'), rep('TEST_C2', 'done', 2, '목공', '', '이목수'), rep('TEST_C3', 'review', 1, '도장', '', '최도장')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V494_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    window.confirm = () => true;
  }, { APT, CLEAN });
  async function test(name, fn) { await fn(); passed++; console.log('PASS noteissue-v494 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const issueChip = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-note-filter-issue]'); return b ? [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)] : null; });

  await test('① [⚠ 이슈 3] → 이슈 줄만 · 상태·보고자 칩과 겹침 · 복사 머리줄 · 모두 확인함도 그 줄만 · 그 밖은 불변 (ISSUE)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.deepEqual(await issueChip(), ['⚠ 이슈 3', 'false', 44], 'ISSUE chip (blank issue does not count)');
    await page.locator('#modalRoot [data-note-filter-issue]').click();
    assert.deepEqual(await keys(), ['TEST_R4', 'TEST_R3', 'TEST_R1'], 'ISSUE rows with an issue only ' + JSON.stringify(await keys()));
    assert.equal((await issueChip())[1], 'true');
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    assert.deepEqual(await keys(), ['TEST_R1'], 'issue ∩ review'); assert.equal((await issueChip())[1], 'true', 'issue chip kept when the status chip changes');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.deepEqual(await keys(), ['TEST_R3'], 'issue ∩ 박설비');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const lines = (await page.evaluate(() => window.__copied[0])).split('\n');
    assert.equal(lines[0], '[' + APT + '] 팀 작업 보고 1건 · 👤 박설비 · ⚠ 이슈', lines[0]); assert.equal(lines.length, 2);
    await page.locator('#modalRoot [data-note-filter-reporter=""]').click();
    assert.equal(await page.locator('#modalRoot [data-team-note-ackall]').textContent(), '✔ 보이는 검수·막힘 2건 모두 확인함', 'only visible issue rows count');
    await page.locator('#modalRoot [data-team-note-ackall]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-team-note-ackall]'));
    const acks = await page.evaluate(n => state.projects.find(p => p.name === n).teamReports.map(r => [r.key, !!r.ack]), APT);
    assert.deepEqual(acks, [['TEST_R1', true], ['TEST_R2', false], ['TEST_R3', true], ['TEST_R4', false], ['TEST_R5', false]], 'R5 (no issue) left alone ' + JSON.stringify(acks));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 이슈 없는 현장엔 칩 없음 · 빈 글 안내 · 390px 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), CLEAN); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await issueChip(), null, 'no issues → no chip');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await page.locator('#modalRoot [data-note-filter-issue]').click();
    await page.locator('#modalRoot [data-note-filter-status="done"]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.match(await page.locator('#modalRoot [data-team-note-empty]').textContent(), /⚠ 이슈 끄기/, 'empty hint mentions the issue chip');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`noteissue-v494: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL noteissue-v494', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

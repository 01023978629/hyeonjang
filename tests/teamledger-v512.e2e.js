/* v512 👷 팀 공수 정산 창 — 👷 인건비 장부(일정 줄 사람별 1/½ = 👤 사람별 정산표)와 맞춰 보기(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 사람마다 '👷 인건비 장부 공수 n — ⚠ 장부에 없는 날 n일: M/D'(½ 도 있는 것으로) · 장부에 그 이름이 없으면 '이 달 기록 없음' · 보고자 없음은 줄 없음
      · 장부를 채우면 '✓ 보고한 날이 장부에 다 있어요' · 자료 불변 (LEDGER)
   ② [👤 사람별 정산표](44px) → 같은 달 정산표 → [← 뒤로]로 이 창(노트에서 열었으면 [← 팀 보고 노트] 그대로) · 장부가 빈 달은 사람별 줄 없이 아래 안내 한 줄 · 넘침 없음 · 오류 0
   HJ_V512_BASELINE=<commit> 은 LEDGER 에서 실패해야 한다. HJ_V512_MUTATION=half-missing(½ 공수를 없는 날로)도 LEDGER 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T50 둔산 크로바아파트 101동 1203호', B = 'TEST_T50 대흥동 상가 2층';
const MUT = process.env.HJ_V512_MUTATION || '';
let html = process.env.HJ_V512_BASELINE ? execFileSync('git', ['show', process.env.HJ_V512_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'half-missing');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'miss:g.dates.filter(d=>!(Number(p.cells&&p.cells[d])>0))';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'miss:g.dates.filter(d=>!(Number(p.cells&&p.cells[d])>=1))');
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
  const D = await page.evaluate(async ({ A, B }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const ym = localDate().slice(0, 7), day = n => ym + '-' + String(n).padStart(2, '0'), pday = hjYmShift(ym, -1) + '-10', at = new Date().toISOString();
    const rep = (key, workDate, hours, reporter) => ({ key, status: 'done', workDate, hours, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0013', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [rep('TEST_A1', day(2), 8, '김타일'), rep('TEST_A2', day(3), 4, '김타일'), rep('TEST_A3', day(5), 8, '김타일'), rep('TEST_A4', day(1), 8, '박설비'), rep('TEST_AP', pday, 8, '김타일')]),
      proj(B, [rep('TEST_B1', day(3), 4, '김타일'), rep('TEST_B2', day(4), 8, '이목수'), rep('TEST_B3', day(4), 2, '')])];
    state.schedule = (state.schedule || []).concat([
      { id: 'TEST_S1', project: A, title: '욕실 타일', date: day(2), time: '08:00', labor: { amount: 200000, names: '김타일', by: { '김타일': { days: 1, rate: 200000 } } } },
      { id: 'TEST_S2', project: B, title: '상가 바닥', date: day(3), time: '08:00', labor: { amount: 280000, names: '김타일, 박설비', by: { '김타일': { days: 0.5, rate: 200000 }, '박설비': { days: 1, rate: 180000 } } } }]);
    state.activeProject = null; state.tab = 'dashboard'; render();
    return { ym, m: Number(ym.slice(5, 7)), pym: pday.slice(0, 7), title: Number(ym.slice(0, 4)) + '년 ' + Number(ym.slice(5, 7)) + '월' };
  }, { A, B });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamledger-v512 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const ledger = () => page.evaluate(() => [...document.querySelectorAll('#hjTeamHours [data-team-hours-reporter]')].map(b => { const l = b.querySelector('[data-team-hours-ledger]');
    return [b.getAttribute('data-team-hours-reporter'), l ? l.getAttribute('data-team-hours-ledger') : null, l ? l.textContent.trim() : null]; }));
  const md = n => D.m + '/' + n;

  await test('① 장부에 없는 날(½ 은 있음) · 기록 없음 · 보고자 없음 줄 없음 · 채우면 ✓ · 자료 불변 (LEDGER)', async () => {
    let before = await serialized();
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    assert.deepEqual(await ledger(), [
      ['김타일', 'miss', '👷 인건비 장부 공수 1.5 — ⚠ 장부에 없는 날 1일: ' + md(5)],
      ['박설비', 'miss', '👷 인건비 장부 공수 1 — ⚠ 장부에 없는 날 1일: ' + md(1)],
      ['이목수', 'none', '👷 인건비 장부에 이 달 기록 없음'],
      ['보고자 없음', null, null]], 'LEDGER lines ' + JSON.stringify(await ledger()));
    assert.equal(await page.locator('#modalRoot [data-team-hours-ledger-empty]').count(), 0);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only — app data unchanged');
    await page.evaluate(({ A, B, ym }) => { state.schedule.push({ id: 'TEST_S3', project: A, title: '욕실 마감', date: ym + '-05', time: '08:00', labor: { amount: 200000, names: '김타일', by: { '김타일': { days: 1, rate: 200000 } } } },
      { id: 'TEST_S4', project: A, title: '설비', date: ym + '-01', time: '08:00', labor: { amount: 180000, names: '박설비', by: { '박설비': { days: 1, rate: 180000 } } } }); }, { A, B, ym: D.ym });
    before = await serialized();
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const l2 = await ledger();
    assert.deepEqual(l2.slice(0, 2), [['김타일', 'ok', '👷 인건비 장부 공수 2.5 — ✓ 보고한 날이 장부에 다 있어요'], ['박설비', 'ok', '👷 인건비 장부 공수 2 — ✓ 보고한 날이 장부에 다 있어요']], 'LEDGER filled ' + JSON.stringify(l2));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only after fill');
  });

  await test('② [👤 사람별 정산표] → 같은 달 → [← 뒤로] 이 창(노트 돌아가기 유지) · 빈 장부 달 안내 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), A); await page.locator('#modalRoot [data-team-hours-month]').click(); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const b = await page.evaluate(() => { const x = document.querySelector('#hjTeamHours [data-team-hours-settle]'); return [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)]; });
    assert.deepEqual(b, ['👤 사람별 정산표 (인건비 장부)', 44]);
    await page.locator('#modalRoot [data-team-hours-settle]').click(); await page.locator('#modalRoot #hjCrewSettle').waitFor();
    assert.equal(await page.evaluate(() => document.getElementById('modalTitle').textContent.trim()), '👤 사람별 정산표 — ' + D.title);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#hjCrewSettle [data-crew-row]')].map(r => r.getAttribute('data-crew-row')).sort()), ['김타일', '박설비']);
    await page.locator('#modalRoot .mfoot button', { hasText: '← 뒤로' }).click(); await page.locator('#modalRoot #hjTeamHours').waitFor();
    assert.equal(await page.evaluate(() => document.getElementById('modalTitle').textContent.trim()), '👷 팀 공수 정산 — ' + D.title);
    assert(await page.evaluate(() => !![...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('← 팀 보고 노트'))), 'note back kept');
    await page.locator('#modalRoot [data-team-hours-prev]').click(); await page.locator('#modalRoot [data-team-hours-ledger-empty]').waitFor();
    assert.equal(await page.locator('#modalRoot [data-team-hours-ledger]').count(), 0, 'no per-person ledger lines when the ledger month is empty');
    assert.match(await page.evaluate(() => document.querySelector('#hjTeamHours [data-team-hours-ledger-empty]').textContent), /인건비 장부에 이 달 사람별 공수\(1\/½\)가 없어요/);
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamledger-v512: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamledger-v512', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

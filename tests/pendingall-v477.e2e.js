/* v477 첫 화면 검수 요청·막힘 줄 '외 n건' → [모두 보기](개발_백로그 '검수 요청·막힘 줄 외 n건 → 모두 보기'). 합성 자료만, 외부 쓰기 0.
   ① 검수 요청 5건(현장 2곳)이면 줄 3개 뒤에 [외 2건 — 모두 보기](44px) → 현장별 목록 창(최근 보고 순, 건수·최근 한 일) · [👷 노트 보기] → 그 현장 노트 창이 가장 최근 검수 보고에 초점 + 🔎 칩이 눌린 채(검수 줄만) · 자료 불변 (PENDING_ALL)
   ② 막힘 5건(현장 3곳)도 같은 단추 · 보고 1건뿐인 현장(칩 없음)은 노트 창이 전부 보임 · 3건 이하면 단추 없음 · 390px 넘침 없음 · 오류 0
   HJ_V477_BASELINE=<commit> 은 PENDING_ALL 에서 실패해야 한다. HJ_V477_MUTATION=no-filter(노트 창을 열 때 상태 칩을 안 누름)도 PENDING_ALL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T17 둔산 크로바아파트 101동 1203호', B = 'TEST_T17 대흥동 상가 2층', C = 'TEST_T17 유천동 빌라 302호';
const MUT = process.env.HJ_V477_MUTATION || '';
let html = process.env.HJ_V477_BASELINE ? execFileSync('git', ['show', process.env.HJ_V477_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-filter');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "b.getAttribute('data-key'),{filter:{status:st}});});";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "b.getAttribute('data-key'));});");
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
    const rep = (key, status, days, done, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at });
    const proj = (name, reports, extra) => Object.assign({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7701', addr: '대전 서구 둔산동' }, teamReports: reports }, extra || {});
    state.projects = [
      proj(A, [rep('TEST_A1', 'review', 6, '욕실 바닥 타일', '줄눈 색 확인', '김타일'), rep('TEST_A2', 'review', 4, '벽 타일 1차', '', '김타일'), rep('TEST_A3', 'review', 2, '벽 타일 2차', '모서리 마감 확인', '박설비'), rep('TEST_A4', 'blocked', 3, '', '자재 미도착', '박설비')]),
      proj(B, [rep('TEST_B1', 'review', 5, '천장 목공', '', '이목수'), rep('TEST_B2', 'review', 1, '벽체 목공', '콘센트 위치 확인', '이목수'), rep('TEST_B3', 'blocked', 7, '', '전기 승인 대기', '이목수'), rep('TEST_B4', 'blocked', 3, '', '소음 민원', '이목수'), rep('TEST_B5', 'blocked', 0, '', '엘리베이터 사용 불가', '이목수')]),
      proj(C, [rep('TEST_C1', 'blocked', 2, '', '현관문 열쇠 없음', '최도배')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V477_SEED_SAVE_FAILED');
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS pendingall-v477 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const dash = () => page.evaluate(() => { const w = document.querySelector('#view [data-team-report-pending]'); if (!w) return null; return { rows: [...w.querySelectorAll('[data-team-report-row]')].map(n => n.getAttribute('data-team-report-row')), all: [...w.querySelectorAll('[data-team-pending-all]')].map(b => [b.getAttribute('data-team-pending-all'), b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]), text: w.innerText.replace(/\s+/g, ' ') }; });
  const listWin = () => page.evaluate(() => { const m = document.getElementById('hjTeamPendingAll'); if (!m) return null; return { title: document.getElementById('modalTitle').textContent.trim(), rows: [...m.querySelectorAll('[data-team-pending-all-row]')].map(n => ({ project: n.getAttribute('data-team-pending-all-row'), text: n.innerText.replace(/\s+/g, ' ').trim(), key: n.querySelector('[data-team-pending-all-note]').getAttribute('data-key'), h: Math.round(n.querySelector('[data-team-pending-all-note]').getBoundingClientRect().height) })), ov: { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth } }; });
  const noteWin = () => page.evaluate(() => { const m = document.getElementById('hjTeamNote'); if (!m) return null; const f = m.querySelector('[data-team-note][data-focus]'); return { title: document.getElementById('modalTitle').textContent.trim(), focus: f ? f.getAttribute('data-team-note') : '', keys: [...m.querySelectorAll('[data-team-note]')].map(n => n.getAttribute('data-team-note')), chips: !!m.querySelector('[data-note-filter]'), pressed: [...m.querySelectorAll('[data-note-filter-status][aria-pressed="true"]')].map(b => b.getAttribute('data-note-filter-status')), list: !!document.getElementById('hjTeamPendingAll') }; });

  await test('① 검수 요청 5건 → [외 2건 — 모두 보기] → 현장별 목록(최근 순) → [👷 노트 보기] → 노트 창 초점·🔎 칩 눌림 · 자료 불변 (PENDING_ALL)', async () => {
    await page.locator('#view [data-team-report-pending]').waitFor();
    const before = await serialized();
    const d = await dash();
    assert.deepEqual(d.rows.slice(0, 3), ['TEST_A1', 'TEST_A2', 'TEST_A3'], 'first three review rows ' + JSON.stringify(d.rows));
    assert.deepEqual(d.all, [['review', '외 2건 — 모두 보기', 44], ['blocked', '외 2건 — 모두 보기', 44]], 'PENDING_ALL buttons ' + JSON.stringify(d.all));
    assert.doesNotMatch(d.text, /확인하면 다음 줄이 올라와요/, 'old hint gone');
    await page.locator('#view [data-team-pending-all="review"]').click();
    await page.locator('#modalRoot #hjTeamPendingAll').waitFor();
    const l = await listWin();
    assert.match(l.title, /검수 요청 보고 모두 — 5건/, l.title);
    assert.deepEqual(l.rows.map(r => [r.project, r.key, r.h >= 44]), [[B, 'TEST_B2', true], [A, 'TEST_A3', true]], 'grouped by project, latest review first ' + JSON.stringify(l.rows));
    assert.match(l.rows[0].text, /🔎 2건/); assert.doesNotMatch(l.rows[0].text, /⛔/, 'review list shows review counts only'); assert.match(l.rows[0].text, /벽체 목공/);
    assert.match(l.rows[1].text, /🔎 3건/); assert.match(l.rows[1].text, /벽 타일 2차/);
    assert(l.ov.doc <= 1 && l.ov.box <= 1, 'overflow ' + JSON.stringify(l.ov));
    await page.locator('#modalRoot [data-team-pending-all-row="' + A + '"] [data-team-pending-all-note]').click();
    await page.locator('#modalRoot #hjTeamNote').waitFor();
    const n = await noteWin();
    assert.equal(n.list, false, 'list window replaced by the note window');
    assert.match(n.title, new RegExp(A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(n.focus, 'TEST_A3', 'focus on the latest review report ' + JSON.stringify(n));
    assert.equal(n.chips, true); assert.deepEqual(n.pressed, ['review'], 'PENDING_ALL review chip pressed ' + JSON.stringify(n.pressed));
    assert.deepEqual(n.keys, ['TEST_A3', 'TEST_A2', 'TEST_A1'], 'PENDING_ALL only review rows ' + JSON.stringify(n.keys));
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    assert.deepEqual((await noteWin()).keys, ['TEST_A3', 'TEST_A4', 'TEST_A2', 'TEST_A1'], '[전부] chip shows all again');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read-only — app data unchanged');
  });

  await test('② 막힘 5건 → 현장 3곳 목록 · 보고 1건 현장은 칩 없이 전부 · 3건 이하면 단추 없음 · 오류 0', async () => {
    await page.locator('#view [data-team-pending-all="blocked"]').click();
    await page.locator('#modalRoot #hjTeamPendingAll').waitFor();
    const l = await listWin();
    assert.match(l.title, /막힘 보고 모두 — 5건/, l.title);
    assert.deepEqual(l.rows.map(r => [r.project, r.key]), [[B, 'TEST_B5'], [C, 'TEST_C1'], [A, 'TEST_A4']], 'latest blocked first ' + JSON.stringify(l.rows));
    assert.match(l.rows[0].text, /⛔ 3건/); assert.match(l.rows[1].text, /현관문 열쇠 없음/);
    assert(l.ov.doc <= 1 && l.ov.box <= 1, 'overflow ' + JSON.stringify(l.ov));
    await page.locator('#modalRoot [data-team-pending-all-row="' + C + '"] [data-team-pending-all-note]').click();
    await page.locator('#modalRoot #hjTeamNote').waitFor();
    const n = await noteWin();
    assert.equal(n.chips, false, 'one report · one reporter → no chips'); assert.deepEqual(n.keys, ['TEST_C1'], 'filter ignored without chips ' + JSON.stringify(n.keys)); assert.equal(n.focus, 'TEST_C1');
    await page.evaluate(() => closeModal(true));
    // 3건 이하 — 단추 없음(검수 요청 2건만 남긴다)
    await page.evaluate(({ A, B }) => { const by = n => state.projects.find(p => p.name === n); by(A).teamReports.forEach(r => { if (r.status === 'review' && r.key !== 'TEST_A3') r.ack = true; }); by(B).teamReports.forEach(r => { if (r.status === 'review' && r.key !== 'TEST_B2') r.ack = true; }); render(); }, { A, B });
    const d = await dash();
    assert.deepEqual(d.all.map(x => x[0]), ['blocked'], 'no review button at 2 rows ' + JSON.stringify(d.all));
    assert.deepEqual(d.rows.filter(k => /TEST_(A[123]|B[12])$/.test(k)), ['TEST_A3', 'TEST_B2'], 'remaining review rows ' + JSON.stringify(d.rows));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`pendingall-v477: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL pendingall-v477', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

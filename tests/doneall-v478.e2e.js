/* v478 첫 화면 '📄 팀 보고 n건 들어옴' 줄 — 3곳을 넘으면 [외 n곳 — 모두 보기](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 완료보고서를 기다리는 현장 5곳이면 줄 3개(최근 작업일 순) 뒤에 [외 2곳 — 모두 보기](44px) → 목록 창(5곳, 최근 순, 완료 보고 수·사진·최근 날짜, [넘기기] 없음)
      · [👷 노트 보기] → 그 현장 노트가 가장 최근 완료 보고에 초점 + ✅ 칩이 눌린 채(완료 줄만) · 390px 넘침 없음 · 자료 불변 (DONE_ALL)
   ② 목록의 [완료보고서 초안] → 목록 닫히고 완료보고서(#rpWorks) · 보고 1건 현장(칩 없음)은 노트 창에 전부 · 3곳 이하면 단추 없음 · 오류 0
   HJ_V478_BASELINE=<commit> 은 DONE_ALL 에서 실패해야 한다. HJ_V478_MUTATION=no-more(단추를 안 그림)도 DONE_ALL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P1 = 'TEST_T18 둔산 크로바아파트 101동 1203호', P2 = 'TEST_T18 대흥동 상가 2층', P3 = 'TEST_T18 유천동 빌라 302호', P4 = 'TEST_T18 관저동 주택', P5 = 'TEST_T18 문화동 사무실', P6 = 'TEST_T18 오류동 상가';
const MUT = process.env.HJ_V478_MUTATION || '';
let html = process.env.HJ_V478_BASELINE ? execFileSync('git', ['show', process.env.HJ_V478_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-more');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "(rows.length>3?'<p data-team-done-more";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "(false?'<p data-team-done-more");
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
  await page.evaluate(async ({ P1, P2, P3, P4, P5, P6 }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter, photos, extra) => Object.assign({ key, status, workDate: ago(days), hours: 4, done, issue, reporter, checklist: [], photos, at }, extra || {});
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7801', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [
      proj(P1, [rep('TEST_P1a', 'done', 6, '욕실 철거·폐기물 반출', '', '김타일', 2), rep('TEST_P1b', 'done', 2, '벽·바닥 타일 시공 완료', '', '김타일', 3), rep('TEST_P1r', 'review', 4, '줄눈 1차', '색 확인', '박설비', 0, { ack: true, ackAt: ago(4) }), rep('TEST_P1x', 'blocked', 3, '', '자재 미도착', '박설비', 0, { ack: true, ackAt: ago(3) })]),
      proj(P2, [rep('TEST_P2a', 'done', 1, '천장 목공 마감', '', '이목수', 0)]),
      proj(P3, [rep('TEST_P3a', 'done', 5, '현관 중문 설치', '', '최목수', 1)]),
      proj(P4, [rep('TEST_P4a', 'done', 8, '주방 상부장 교체', '', '최목수', 4), rep('TEST_P4z', 'done', 7, '주방 하부장 교체', '', '최목수', 2, { docAt: ago(6) })]),
      proj(P5, [rep('TEST_P5a', 'done', 10, '바닥 장판 철거', '', '이목수', 1), rep('TEST_P5b', 'done', 3, '바닥 장판 시공', '', '이목수', 2)]),
      proj(P6, [rep('TEST_P6a', 'done', 0, '간판 철거', '', '이목수', 1, { docAck: true })])];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { P1, P2, P3, P4, P5, P6 });
  async function test(name, fn) { await fn(); passed++; console.log('PASS doneall-v478 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const dash = () => page.evaluate(() => ({ rows: [...document.querySelectorAll('#view [data-team-done-doc]')].map(n => n.getAttribute('data-team-done-doc')), more: [...document.querySelectorAll('#view [data-team-done-all]')].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]) }));
  const listWin = () => page.evaluate(() => { const m = document.getElementById('hjTeamDoneAll'); if (!m) return null; return { title: document.getElementById('modalTitle').textContent.trim(), rows: [...m.querySelectorAll('[data-team-done-all-row]')].map(n => ({ project: n.getAttribute('data-team-done-all-row'), text: n.innerText.replace(/\s+/g, ' ').trim(), key: n.querySelector('[data-team-done-all-note]').getAttribute('data-key'), h: [...n.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height)) })), skip: m.querySelectorAll('[data-team-done-skip]').length, ov: { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth } }; });
  const noteWin = () => page.evaluate(() => { const m = document.getElementById('hjTeamNote'); if (!m) return null; const f = m.querySelector('[data-team-note][data-focus]'); return { title: document.getElementById('modalTitle').textContent.trim(), focus: f ? f.getAttribute('data-team-note') : '', keys: [...m.querySelectorAll('[data-team-note]')].map(n => n.getAttribute('data-team-note')), chips: !!m.querySelector('[data-note-filter]'), pressed: [...m.querySelectorAll('[data-note-filter-status][aria-pressed="true"]')].map(b => b.getAttribute('data-note-filter-status')), list: !!document.getElementById('hjTeamDoneAll') }; });
  const md = days => page.evaluate(n => hjAddDays(localDate(), -n).slice(5).replace('-', '/'), days);

  await test('① 5곳 → 줄 3개 + [외 2곳 — 모두 보기] → 목록 창(최근 순) → [👷 노트 보기] → 초점·✅ 칩 · 넘침 없음 · 자료 불변 (DONE_ALL)', async () => {
    await page.locator('#view [data-team-done-doc]').first().waitFor();
    const before = await serialized();
    const d = await dash();
    assert.deepEqual(d.rows, [P2, P1, P5], 'three most recent on the dashboard ' + JSON.stringify(d.rows));
    assert.deepEqual(d.more, [['외 2곳 — 모두 보기', 44]], 'DONE_ALL more button ' + JSON.stringify(d.more));
    await page.locator('#view [data-team-done-all]').click();
    await page.locator('#modalRoot #hjTeamDoneAll').waitFor();
    const l = await listWin();
    assert.match(l.title, /완료보고서 기다리는 현장 5곳/, l.title);
    assert.deepEqual(l.rows.map(r => r.project), [P2, P1, P5, P3, P4], 'all five, latest work date first ' + JSON.stringify(l.rows.map(r => r.project)));
    assert.deepEqual(l.rows.map(r => r.key), ['TEST_P2a', 'TEST_P1b', 'TEST_P5b', 'TEST_P3a', 'TEST_P4a'], 'note key = latest pending done report');
    assert.equal(l.rows[1].text, P1 + ' ✅ 완료 보고 2건 · 사진 5장 · 최근 ' + await md(2) + ' 완료보고서 초안 👷 노트 보기', l.rows[1].text);
    assert.match(l.rows[0].text, /✅ 완료 보고 1건 · 최근 /, 'no photo part when 0 photos'); assert.doesNotMatch(l.rows[0].text, /사진/);
    assert.match(l.rows[4].text, /✅ 완료 보고 1건 · 사진 4장/, 'docAt report excluded from the count');
    assert(l.rows.flatMap(r => r.h).every(h => h >= 44), 'tap targets ' + JSON.stringify(l.rows.map(r => r.h)));
    assert.equal(l.skip, 0, 'no [넘기기] in the list');
    assert(l.ov.doc <= 1 && l.ov.box <= 1, 'overflow ' + JSON.stringify(l.ov));
    await page.locator('#modalRoot [data-team-done-all-row="' + P1 + '"] [data-team-done-all-note]').click();
    await page.locator('#modalRoot #hjTeamNote').waitFor();
    const n = await noteWin();
    assert.equal(n.list, false, 'list replaced by the note window');
    assert.equal(n.focus, 'TEST_P1b', 'focus on the latest done report ' + JSON.stringify(n));
    assert.equal(n.chips, true); assert.deepEqual(n.pressed, ['done'], 'DONE_ALL ✅ chip pressed ' + JSON.stringify(n.pressed));
    assert.deepEqual(n.keys, ['TEST_P1b', 'TEST_P1a'], 'only done rows ' + JSON.stringify(n.keys));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read-only — app data unchanged');
  });

  await test('② [완료보고서 초안] → 완료보고서 · 칩 없는 현장은 전부 · 3곳 이하면 단추 없음 · 오류 0', async () => {
    await page.locator('#view [data-team-done-all]').click();
    await page.locator('#modalRoot #hjTeamDoneAll').waitFor();
    await page.locator('#modalRoot [data-team-done-all-row="' + P2 + '"] [data-team-done-all-note]').click();
    await page.locator('#modalRoot #hjTeamNote').waitFor();
    const n = await noteWin();
    assert.equal(n.chips, false, 'one report → no chips'); assert.deepEqual(n.keys, ['TEST_P2a']); assert.equal(n.focus, 'TEST_P2a');
    await page.evaluate(() => closeModal(true));
    await page.locator('#view [data-team-done-all]').click();
    await page.locator('#modalRoot #hjTeamDoneAll').waitFor();
    await page.locator('#modalRoot [data-team-done-all-row="' + P3 + '"] [data-team-done-all-open]').click();
    await page.locator('#modalRoot #rpWorks').waitFor();
    assert.equal(await page.locator('#modalRoot #hjTeamDoneAll').count(), 0, 'list window closed');
    assert.match(await page.locator('#modalRoot #rpWorks').inputValue(), /현관 중문 설치/);
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#modalRoot #rpWorks').count(), 1, 'report window stays open');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(({ P3, P4 }) => { [P3, P4].forEach(n => state.projects.find(p => p.name === n).teamReports.forEach(r => { if (r.status === 'done') r.docAck = true; })); render(); }, { P3, P4 });
    const d = await dash();
    assert.deepEqual(d.rows, [P2, P1, P5]); assert.deepEqual(d.more, [], 'no button at three projects');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`doneall-v478: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL doneall-v478', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

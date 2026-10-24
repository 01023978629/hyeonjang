/* v497 👷 팀 보고 노트 창 — '🗓 최근 7일' 칩(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 작업일이 오늘 포함 7일 안(0~6일 전)인 보고가 일부면 [🗓 최근 7일 4](44px, aria-pressed) → 그 보고만(6일 전은 들어가고 7·8일 전은 빠짐)
      · 상태·보고자·⚠ 이슈 칩과 겹쳐 고름(칩을 바꿔도 유지) · [📋 글로 복사] 머리줄 '· 🗓 최근 7일' · [모두 확인함]도 보이는 줄만 · ack 말고는 자료 불변 (RECENT)
   ② 최근 보고가 전부거나 하나도 없으면 칩 없음 · 빈 글 안내에 '🗓 최근 7일 끄기' · 390px 넘침 없음 · 오류 0
   HJ_V497_BASELINE=<commit> 은 RECENT 에서 실패해야 한다. HJ_V497_MUTATION=no-recent(칩을 눌러도 줄이 안 줄어듦)도 RECENT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T35 둔산 크로바아파트 101동 1203호', FRESH = 'TEST_T35 대흥동 상가 2층', OLD = 'TEST_T35 유천동 주택';
const MUT = process.env.HJ_V497_MUTATION || '';
let html = process.env.HJ_V497_BASELINE ? execFileSync('git', ['show', process.env.HJ_V497_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-recent');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '.filter(r=>!f.recent||hjTeamReportRecent(r))';
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
  await page.evaluate(async ({ APT, FRESH, OLD }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9701', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [rep('TEST_R1', 'review', 8, '벽 타일 1차', '줄눈 색 확인', '김타일'), rep('TEST_R2', 'done', 7, '바닥 타일', '', '김타일'), rep('TEST_R3', 'blocked', 6, '', '자재 미도착', '박설비'),
      rep('TEST_R4', 'done', 2, '실리콘', '', '김타일'), rep('TEST_R5', 'review', 0, '천장 목공', '', '박설비'), rep('TEST_R6', 'blocked', 1, '', '', '김타일')]),
      proj(FRESH, [rep('TEST_F1', 'done', 3, '철거', '', '이목수'), rep('TEST_F2', 'done', 2, '목공', '', '이목수'), rep('TEST_F3', 'review', 1, '도장', '', '최도장')]),
      proj(OLD, [rep('TEST_O1', 'done', 30, '철거', '', '이목수'), rep('TEST_O2', 'done', 20, '목공', '', '이목수'), rep('TEST_O3', 'review', 9, '도장', '', '최도장')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V497_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    window.confirm = () => true;
  }, { APT, FRESH, OLD });
  async function test(name, fn) { await fn(); passed++; console.log('PASS note7d-v497 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const recentChip = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-note-filter-recent]'); return b ? [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)] : null; });

  await test('① [🗓 최근 7일 4] → 0~6일 전만 · 상태·보고자·⚠ 이슈와 겹침 · 복사 머리줄 · 모두 확인함도 그 줄만 · 그 밖은 불변 (RECENT)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.deepEqual(await recentChip(), ['🗓 최근 7일 4', 'false', 44], 'RECENT chip (6 days in, 7·8 days out)');
    await page.locator('#modalRoot [data-note-filter-recent]').click();
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R6', 'TEST_R4', 'TEST_R3'], 'RECENT rows within 0~6 days only ' + JSON.stringify(await keys()));
    assert.equal((await recentChip())[1], 'true');
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    assert.deepEqual(await keys(), ['TEST_R5'], 'recent ∩ review'); assert.equal((await recentChip())[1], 'true', 'recent chip kept when the status chip changes');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R3'], 'recent ∩ 박설비');
    await page.locator('#modalRoot [data-note-filter-issue]').click();
    assert.deepEqual(await keys(), ['TEST_R3'], 'recent ∩ 박설비 ∩ issue'); assert.equal((await recentChip())[1], 'true', 'recent chip kept with the issue chip');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const lines = (await page.evaluate(() => window.__copied[0])).split('\n');
    assert.equal(lines[0], '[' + APT + '] 팀 작업 보고 1건 · 👤 박설비 · ⚠ 이슈 · 🗓 최근 7일', lines[0]); assert.equal(lines.length, 2);
    await page.locator('#modalRoot [data-note-filter-issue]').click();
    await page.locator('#modalRoot [data-note-filter-reporter=""]').click();
    assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R6', 'TEST_R4', 'TEST_R3'], 'back to recent only');
    assert.equal(await page.locator('#modalRoot [data-team-note-ackall]').textContent(), '✔ 보이는 검수·막힘 3건 모두 확인함', 'only visible (recent) rows count');
    await page.locator('#modalRoot [data-team-note-ackall]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-team-note-ackall]'));
    const acks = await page.evaluate(n => state.projects.find(p => p.name === n).teamReports.map(r => [r.key, !!r.ack]), APT);
    assert.deepEqual(acks, [['TEST_R1', false], ['TEST_R2', false], ['TEST_R3', true], ['TEST_R4', false], ['TEST_R5', true], ['TEST_R6', true]], 'R1 (8 days) left alone ' + JSON.stringify(acks));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 전부 최근이거나 하나도 없으면 칩 없음 · 빈 글 안내 · 390px 넘침 없음 · 오류 0', async () => {
    for (const n of [FRESH, OLD]) {
      await page.evaluate(x => hjTeamReportNoteView(x), n); await page.locator('#modalRoot #hjTeamNote').waitFor();
      assert.equal(await page.locator('#modalRoot [data-note-filter-status]').count() > 0, true, 'chips row exists for ' + n);
      assert.equal(await recentChip(), null, 'no recent chip when all/none are recent: ' + n);
      await page.evaluate(() => closeModal(true));
    }
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await page.locator('#modalRoot [data-note-filter-recent]').click();
    await page.locator('#modalRoot [data-note-filter-status="done"]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.match(await page.locator('#modalRoot [data-team-note-empty]').textContent(), /🗓 최근 7일 끄기/, 'empty hint mentions the recent chip');
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`note7d-v497: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL note7d-v497', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

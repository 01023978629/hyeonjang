/* v466 👷 팀 보고 노트 보기 — 보고 전문(한 일·이슈·체크리스트·사진 수·보고자)을 읽기 전용 창으로(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 첫 화면 검수 요청·막힘 줄의 [보기](44px) → 창에 그 현장 보고 전부(최근 것부터), 누른 보고가 맨 위 테두리(data-focus) · 한 일·이슈·체크리스트 ✓○·사진 수·보고자·확인/완료보고서 표식 · 저장 자료 불변(NOTE_VIEW)
   ② 📎 서류 만들기 '👷 팀 작업 보고 보기' 줄(상태 '보고 n건 · 검수·막힘 k건') → 같은 창 + [← 서류 만들기] · 보고 없는 현장은 빈 안내 · 390px 넘침 없음 · 오류 0
   HJ_V466_BASELINE=<commit> 은 NOTE_VIEW 에서 실패해야 한다. HJ_V466_MUTATION=no-entry(첫 화면 [보기] 단추 제거)도 NOTE_VIEW 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T6 둔산 크로바아파트 101동 1203호', BARE = 'TEST_T6 대흥동 상가';
const MUT = process.env.HJ_V466_MUTATION || '';
let html = process.env.HJ_V466_BASELINE ? execFileSync('git', ['show', process.env.HJ_V466_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-entry');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "'<button type=\"button\" class=\"ghost tiny\" data-team-note=\"'+escapeAttr(r.key)+'\" data-project=\"'+escapeAttr(r.project)+'\" style=\"min-height:44px\" aria-label=\"'+escapeAttr(r.project+' 팀 보고 보기')+'\">보기</button>'+";
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
  const D = await page.evaluate(async ({ APT, BARE }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    state.projects = [
      { name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6601', addr: '대전 서구 둔산동' },
        workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
          { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거·폐기물 반출', issue: '', reporter: '김타일', checklist: [{ text: '작업 전 사진', ok: true }, { text: '정리·청소', ok: true }], photos: 2, at, docAt: ago(2) },
          { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [{ text: '작업 중 사진', ok: true }, { text: '고객(관리사무소) 확인', ok: false }], photos: 1, at }] }],
        teamReports: [{ key: 'TEST_R3', status: 'blocked', workDate: ago(1), hours: 0, done: '', issue: '자재 미도착 — 타일 본드', reporter: '박설비', checklist: [], photos: 0, at }] },
      { name: BARE, kind: 'interior', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    return { today, r1: ago(3), r2: ago(2), r3: ago(1) };
  }, { APT, BARE });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamnote-v466 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const notes = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => ({ key: n.getAttribute('data-team-note'), focus: n.hasAttribute('data-focus'), text: n.innerText.replace(/\s+/g, ' ').trim() })));
  const close = () => page.evaluate(() => closeModal(true));

  await test('① 첫 화면 줄의 [보기] → 보고 전문 창(최근 것부터, 누른 보고 테두리) · 한 일·이슈·체크리스트·사진 수·보고자·표식 · 자료 불변 (NOTE_VIEW)', async () => {
    const before = await serialized();
    await page.locator('#view [data-team-report-pending]').waitFor();
    const btns = await page.locator('#view [data-team-note]').evaluateAll(ns => ns.map(n => [n.getAttribute('data-team-note'), Math.round(n.getBoundingClientRect().height)]));
    assert.deepEqual(btns.map(b => b[0]), ['TEST_R2', 'TEST_R3'], 'NOTE_VIEW [보기] per pending row ' + JSON.stringify(btns)); assert(btns.every(b => b[1] >= 44), 'tap targets');
    await page.locator('#view [data-team-note="TEST_R2"]').click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const r = await notes();
    assert.deepEqual(r.map(x => [x.key, x.focus]), [['TEST_R3', false], ['TEST_R2', true], ['TEST_R1', false]], 'all reports newest first, clicked one focused ' + JSON.stringify(r));
    assert.match(r[1].text, /🔎 검수 요청/); assert.match(r[1].text, /👤 김타일 · 2시간 · 사진 1장 · 지시 wo_20261020_001/); assert.match(r[1].text, /한 일: 벽 타일 1차/); assert.match(r[1].text, /이슈: 줄눈 색 확인 필요/); assert.match(r[1].text, /✓ 작업 중 사진 · ○ 고객\(관리사무소\) 확인/);
    assert.match(r[0].text, /⛔ 막힘/); assert.match(r[0].text, /👤 박설비 · 사진 0장 · 보고만/); assert.match(r[0].text, /이슈: 자재 미도착 — 타일 본드/);
    assert.match(r[2].text, /✅ 완료/); assert.match(r[2].text, /완료보고서 /, 'docAt mark');
    assert.equal(await page.locator('#modalRoot .mfoot button').count(), 1, 'close only — read-only window');
    await close();
    assert.equal(await serialized(), before, 'nothing changed');
  });

  await test('② 📎 서류 만들기 줄 → 같은 창 + [← 서류 만들기] · 보고 없는 현장은 빈 안내 · 390px 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => docHubView(n), APT); await page.locator('#modalRoot .docHubBtn[data-act="teamnote"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="teamnote"]').innerText(), /팀 작업 보고 보기[\s\S]*보고 3건 · 검수·막힘 2건/);
    await page.locator('#modalRoot .docHubBtn[data-act="teamnote"]').click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal((await notes()).length, 3);
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    const sizes = await page.locator('#modalRoot .mfoot button').evaluateAll(ns => ns.map(n => [n.textContent.trim(), Math.round(n.getBoundingClientRect().height)]));
    assert.deepEqual(sizes.map(x => x[0]), ['← 서류 만들기', '닫기'], JSON.stringify(sizes)); assert(sizes.every(x => x[1] >= 44));
    await page.locator('#modalRoot .mfoot button', { hasText: '서류 만들기' }).click(); await page.locator('#modalRoot .docHubBtn[data-act="teamnote"]').waitFor(); await close();
    await page.evaluate(n => hjTeamReportNoteView(n), BARE); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.match(await page.locator('#modalRoot #hjTeamNote').innerText(), /팀 작업 보고가 없어요/); assert.equal((await notes()).length, 0); await close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamnote-v466: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamnote-v466', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

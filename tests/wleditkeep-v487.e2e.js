/* v487 ⏱ 작업시간 [✏️ 수정] — 돌아올 때 칩·펼친 줄 수·스크롤 그대로(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 60줄 펼치고 45번째 줄 [✏️ 수정] → 수정 창([← 작업시간]·[닫기]) → 저장 → 목록 60줄·[외 8줄…]·스크롤 자리 그대로, 고친 메모 저장 (KEEP)
   ② [👷 팀 보고만]인 채 [✏️ 수정] → [← 작업시간](저장 없이) → 칩 그대로·자료 그대로 · 현장 창에서 고치면 그 현장 창으로 · [닫기]는 다 닫음 · 오류 0
   HJ_V487_BASELINE=<commit> 은 KEEP 에서 실패해야 한다. HJ_V487_MUTATION=no-keep(상태를 안 넘김)도 KEEP 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T27 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T27 대흥동 상가 2층';
const MUT = process.env.HJ_V487_MUTATION || '';
let html = process.env.HJ_V487_BASELINE ? execFileSync('git', ['show', process.env.HJ_V487_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-keep');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'workEditView(b.dataset.id,pjName,{teamOnly:teamOnly,monthOnly:monthOnly,limit:limit,scrollTops:st});';   // v488 이번 달 칩도 넘긴다
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'workEditView(b.dataset.id,pjName);');
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
  await page.evaluate(async ({ APT, OTHER }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8701', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [{ key: 'TEST_K1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }, { key: 'TEST_K2', status: 'done', workDate: ago(50), hours: 4, done: '철거', issue: '', reporter: '박설비', checklist: [], photos: 0, at }]), proj(OTHER, [])];
    const plain = n => ({ id: 'TEST_WP' + n, project: APT, date: ago(n), in: '09:00', out: '12:00', memo: '직접 찍음 ' + n });
    const days = Array.from({ length: 67 }, (_, i) => i + 1).filter(n => n !== 3 && n !== 50);
    state.workLogs = [{ id: 'TEST_WO1', project: OTHER, date: ago(0), in: '10:00', out: '11:00', memo: '' },
      { id: 'TEST_WT1', project: APT, date: ago(3), in: '09:00', out: '17:00', memo: '[팀 보고 · 김타일]', teamReport: { key: 'TEST_K1', orderId: '', hours: 8, reporter: '김타일' } },
      { id: 'TEST_WT2', project: APT, date: ago(50), in: '08:00', out: '12:00', memo: '[팀 보고 · 박설비]', teamReport: { key: 'TEST_K2', orderId: '', hours: 4, reporter: '박설비' } },
      ...days.map(plain)];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT, OTHER });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wleditkeep-v487 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const b = m.querySelector('[data-wl-more-btn]');
    const sc = [...document.querySelectorAll('#modalRoot .modal,#modalRoot .mbody')].find(e => e.scrollHeight > e.clientHeight + 2);
    return { title: document.getElementById('modalTitle').textContent.trim(), rows: m.querySelectorAll('.worklog-row').length, more: b ? b.textContent.trim() : null, pressed: [...m.querySelectorAll('[data-wl-filter][aria-pressed="true"]')].map(x => x.getAttribute('data-wl-filter')), scroll: sc ? Math.round(sc.scrollTop) : -1, foot: [...m.querySelectorAll('.mfoot button')].map(x => x.textContent.trim()) }; });
  const waitList = () => page.waitForFunction(() => /^⏱ 작업시간/.test(document.getElementById('modalTitle')?.textContent || '') && document.querySelector('#modalRoot .worklog-row'));

  await test('① 60줄 펼친 채 45번째 줄 수정·저장 → 60줄·[외 8줄]·스크롤 그대로·메모 저장 (KEEP)', async () => {
    await page.evaluate(() => workView()); await waitList();
    const mb = page.locator('#modalRoot [data-wl-more-btn]'); await mb.scrollIntoViewIfNeeded(); await mb.click();
    await page.waitForFunction(() => document.querySelectorAll('#modalRoot .worklog-row').length === 60);
    const row = page.locator('#modalRoot .worklog-row').nth(45); await row.scrollIntoViewIfNeeded();
    const id = await row.locator('.wkEdit').getAttribute('data-id');
    const before = await win(); assert(before.scroll > 0, 'scrolled down ' + before.scroll);
    await row.locator('.wkEdit').click(); await page.locator('#modalRoot #wkSave').waitFor();
    assert.deepEqual((await win()).foot, ['← 작업시간', '닫기'], 'KEEP edit window has a way back');
    await page.locator('#modalRoot #wkMemo').fill('메모 고침 v487');
    await page.locator('#modalRoot #wkSave').click(); await waitList(); await page.waitForTimeout(150);
    const after = await win();
    assert.equal(after.rows, 60, 'KEEP expanded rows after save ' + JSON.stringify(after)); assert.equal(after.more, '외 8줄 — 8줄 더 보기');
    assert(Math.abs(after.scroll - before.scroll) <= 4, 'KEEP scroll ' + JSON.stringify([before.scroll, after.scroll]));
    assert.equal(await page.evaluate(i => state.workLogs.find(w => w.id === i).memo, id), '메모 고침 v487', 'memo saved');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 팀 보고만 칩 그대로 [← 작업시간] · 현장 창에서 고치면 그 현장 창 · [닫기]는 다 닫음 · 오류 0', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await waitList();
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    await page.locator('#modalRoot .worklog-row[data-wl-team="TEST_K2"] .wkEdit').click(); await page.locator('#modalRoot #wkSave').waitFor();
    await page.locator('#modalRoot #wkMemo').fill('저장 안 함');
    await page.locator('#modalRoot .mfoot button', { hasText: '← 작업시간' }).click(); await waitList();
    let w = await win(); assert.deepEqual(w.pressed, ['team'], 'KEEP team chip after back ' + JSON.stringify(w)); assert.equal(w.rows, 2);
    assert.equal(await serialized(), before, 'back without saving → no change');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), OTHER); await waitList();
    await page.locator('#modalRoot .worklog-row .wkEdit').first().click(); await page.locator('#modalRoot #wkSave').waitFor();
    await page.locator('#modalRoot #wkSave').click(); await waitList();
    w = await win(); assert.equal(w.title, '⏱ 작업시간 — ' + OTHER, 'back to the project window'); assert.equal(w.rows, 1);
    await page.locator('#modalRoot .worklog-row .wkEdit').first().click(); await page.locator('#modalRoot #wkSave').waitFor();
    await page.locator('#modalRoot .mfoot button', { hasText: '닫기' }).click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wleditkeep-v487: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wleditkeep-v487', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

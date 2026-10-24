/* v488 ⏱ 작업시간 창 — '📅 이번 달' 칩(개발_백로그). 합성 자료만, 외부 쓰기 0. 날짜는 오늘 기준(이번 달 1일·오늘 / 지난달 말일·그 열흘 전).
   ① 이번 달 기록이 일부면 [전부 6]·[👷 팀 보고만 2]·[📅 이번 달 3](44px) → 이번 달만(1일 포함·지난달 말일 제외), 합계 줄 · 팀 칩과 함께 → 둘 다 맞는 줄·합계 줄에 둘 다
      · 이번 달 칩만 끄면 팀 보고만 · [전부]는 둘 다 끔 · 위 칸 그대로 · 390px 넘침 없음 · 자료 불변 (MONTH)
   ② 지워도·[✏️ 수정]→[← 작업시간] 뒤에도 이번 달 칩 유지 · 전부 이번 달이면 칩 없음 · 오류 0
   HJ_V488_BASELINE=<commit> 은 MONTH 에서 실패해야 한다. HJ_V488_MUTATION=no-month(칩을 눌러도 줄이 안 줄어듦)도 MONTH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T28 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V488_MUTATION || '';
let html = process.env.HJ_V488_BASELINE ? execFileSync('git', ['show', process.env.HJ_V488_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-month');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const view=monthOnly?shown.filter(isMonth):shown;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const view=shown;');
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
  const D = await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', prevLast = hjAddDays(first, -1), prevOld = hjAddDays(prevLast, -10), at = new Date().toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8801', addr: '대전 서구 둔산동' },
      teamReports: [{ key: 'TEST_K1', status: 'done', workDate: today, hours: 8, done: '타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }, { key: 'TEST_K2', status: 'done', workDate: prevLast, hours: 4, done: '철거', issue: '', reporter: '박설비', checklist: [], photos: 0, at }] }];
    const w = (id, date, inT, outT, team) => Object.assign({ id, project: APT, date, in: inT, out: outT, memo: id }, team ? { teamReport: { key: team, orderId: '', hours: 0, reporter: '김타일' } } : {});
    state.workLogs = [w('TEST_P1', today, '09:00', '12:00'), w('TEST_T1', today, '13:00', '17:00', 'TEST_K1'), w('TEST_P2', first, '08:00', '10:00'),
      w('TEST_P3', prevLast, '09:00', '18:00'), w('TEST_T2', prevLast, '08:00', '12:00', 'TEST_K2'), w('TEST_P4', prevOld, '09:00', '11:00')];
    state.activeProject = null; state.tab = 'dashboard'; render();
    return { month3: workHM(180 + 240 + 120), both: workHM(240), team2: workHM(240 + 240) };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlmonth-v488 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const sum = m.querySelector('[data-wl-team-sum]');
    return { chips: [...m.querySelectorAll('[data-wl-filter]')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)]), ids: [...m.querySelectorAll('.worklog-row .wkEdit')].map(b => b.getAttribute('data-id')),
      sum: sum ? sum.textContent.trim() : '', tiles: m.querySelector('.mbody > div').innerText.replace(/\s+/g, ' ').trim(), ov: [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth] }; });
  const chip = async k => { await page.locator('#modalRoot [data-wl-filter="' + k + '"]').click(); await page.waitForTimeout(120); return win(); };

  await test('① [📅 이번 달 3] → 이번 달만(1일 포함·지난달 말일 제외) · 팀 칩과 함께 · 하나만 끄기 · [전부] · 위 칸 그대로 · 넘침 없음 · 자료 불변 (MONTH)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win(); const tiles = w.tiles;
    assert.deepEqual(w.chips.slice(0, 3), [['전부 6', 'true', 44], ['👷 팀 보고만 2', 'false', 44], ['📅 이번 달 3', 'false', 44]], 'MONTH chips ' + JSON.stringify(w.chips));   // v493 부터 넷째 칩 '📅 지난달'
    assert(w.ov.every(x => x <= 1), 'overflow ' + JSON.stringify(w.ov));
    w = await chip('month');
    assert.deepEqual(w.ids.slice().sort(), ['TEST_P1', 'TEST_P2', 'TEST_T1'], 'MONTH this month only (1st included, last month out) ' + JSON.stringify(w.ids));
    assert.deepEqual(w.chips.slice(0, 3).map(c => c[1]), ['false', 'false', 'true']);
    assert.equal(w.sum, '📅 이번 달 3줄 · 합계 ' + D.month3 + ' — 위 칸은 전부 기준이에요', w.sum);
    w = await chip('team');
    assert.deepEqual(w.ids, ['TEST_T1'], 'both filters → rows matching both'); assert.deepEqual(w.chips.slice(0, 3).map(c => c[1]), ['false', 'true', 'true']);
    assert.equal(w.sum, '👷 팀 보고 · 📅 이번 달 1줄 · 합계 ' + D.both + ' — 위 칸은 전부 기준이에요', w.sum);
    w = await chip('month');
    assert.deepEqual(w.ids, ['TEST_T1', 'TEST_T2'], 'month off → team only'); assert.equal(w.sum, '👷 팀 보고 2줄 · 합계 ' + D.team2 + ' — 위 칸은 전부 기준이에요');
    await chip('month'); w = await chip('');
    assert.equal(w.ids.length, 6, '[전부] clears both'); assert.deepEqual(w.chips.slice(0, 3).map(c => c[1]), ['true', 'false', 'false']); assert.equal(w.sum, '');
    assert.equal(w.tiles, tiles, 'tiles keep the all-rows totals');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 지워도·수정 창 다녀와도 이번 달 칩 유지 · 전부 이번 달이면 칩 없음 · 오류 0', async () => {
    await page.evaluate(() => { window.__v488Confirm = window.confirm; window.confirm = () => true; });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await chip('month');
    await page.locator('#modalRoot .worklog-row .wkDel[data-id="TEST_P1"]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .wkEdit[data-id="TEST_P1"]'));
    w = await win(); assert.deepEqual(w.ids.slice().sort(), ['TEST_P2', 'TEST_T1'], 'kept after delete ' + JSON.stringify(w)); assert.deepEqual(w.chips.slice(0, 3).map(c => c[1]), ['false', 'false', 'true']);
    await page.locator('#modalRoot .wkEdit[data-id="TEST_P2"]').click(); await page.locator('#modalRoot #wkSave').waitFor();
    await page.locator('#modalRoot .mfoot button', { hasText: '← 작업시간' }).click(); await page.locator('#modalRoot .worklog-row').first().waitFor();
    w = await win(); assert.deepEqual(w.chips.slice(0, 3).map(c => c[1]), ['false', 'false', 'true'], 'kept after the edit window');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => { const ym = localDate().slice(0, 7); state.workLogs = state.workLogs.filter(x => String(x.date).startsWith(ym)); });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    w = await win(); assert.equal(w.chips.some(c => /이번 달/.test(c[0])), false, 'all rows this month → no month chip ' + JSON.stringify(w.chips));
    await page.evaluate(() => { closeModal(true); window.confirm = window.__v488Confirm; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlmonth-v488: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlmonth-v488', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

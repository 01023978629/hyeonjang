/* v480 ⏱ 작업시간 창 — '👷 팀 보고만' 칩(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 팀 보고 줄이 있으면 표 위에 [전부 n]·[👷 팀 보고만 m](44px, aria-pressed) · [팀 보고만] → 팀 보고 줄만(최근 30줄 밖에 있던 줄도), 합계 한 줄, 위 칸(일수·누적·이번 달)은 그대로
      · [👷 노트]는 그대로 동작 · 창을 새로 열면 [전부] · 390px 넘침 없음 · 자료 불변 (WL_CHIP)
   ② [팀 보고만]인 채 줄을 지워도 칩 유지 · 팀 보고 줄이 0이 되면 칩 없이 전부 · 팀 보고 없는 현장 창엔 칩 없음 · 오류 0
   HJ_V480_BASELINE=<commit> 은 WL_CHIP 에서 실패해야 한다. HJ_V480_MUTATION=no-filter(칩을 눌러도 줄이 안 줄어듦)도 WL_CHIP 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T20 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T20 대흥동 상가 2층';
const MUT = process.env.HJ_V480_MUTATION || '';
let html = process.env.HJ_V480_BASELINE ? execFileSync('git', ['show', process.env.HJ_V480_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-filter');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const shown=teamOnly?all.filter(isTeam):all;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const shown=all;');
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
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8001', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [{ key: 'TEST_K1', status: 'done', workDate: ago(2), hours: 8, done: '욕실 바닥 타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }, { key: 'TEST_K2', status: 'done', workDate: ago(40), hours: 4.5, done: '철거', issue: '', reporter: '박설비', checklist: [], photos: 0, at }]), proj(OTHER, [])];
    const plain = n => ({ id: 'TEST_WP' + n, project: APT, date: ago(n), in: '09:00', out: '12:00', memo: '직접 찍음' });
    state.workLogs = [{ id: 'TEST_WO1', project: OTHER, date: ago(0), in: '10:00', out: '11:00', memo: '' },
      { id: 'TEST_WT1', project: APT, date: ago(2), in: '09:00', out: '17:00', memo: '[팀 보고 · 김타일] 욕실 바닥 타일', teamReport: { key: 'TEST_K1', orderId: '', hours: 8, reporter: '김타일' } },
      { id: 'TEST_WT2', project: APT, date: ago(40), in: '08:00', out: '12:30', memo: '[팀 보고 · 박설비] 철거', teamReport: { key: 'TEST_K2', orderId: '', hours: 4.5, reporter: '박설비' } },
      plain(1), ...Array.from({ length: 29 }, (_, i) => plain(i + 3)), plain(33)];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT, OTHER });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlchip-v480 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const sum = m.querySelector('[data-wl-team-sum]');
    return { chips: [...m.querySelectorAll('[data-wl-filter]')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)]), rows: m.querySelectorAll('.worklog-row').length, team: [...m.querySelectorAll('.worklog-row[data-wl-team]')].map(r => r.getAttribute('data-wl-team')),
      sum: sum ? sum.textContent.trim() : '', tiles: m.querySelector('.mbody > div').innerText.replace(/\s+/g, ' ').trim(), ov: { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth } }; });

  await test('① [전부 n]·[👷 팀 보고만 m] → 팀 보고 줄만(30줄 밖도) · 합계 줄 · 위 칸 그대로 · [👷 노트] · 새 창은 [전부] · 넘침 없음 · 자료 불변 (WL_CHIP)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win();
    assert.deepEqual(w.chips, [['전부 34', 'true', 44], ['👷 팀 보고만 2', 'false', 44]], 'WL_CHIP chips ' + JSON.stringify(w.chips));
    assert.equal(w.rows, 30, 'newest 30 rows'); assert.deepEqual(w.team, ['TEST_K1'], 'old team row is past the first 30');
    const tiles = w.tiles;
    await page.locator('#modalRoot [data-wl-filter="team"]').click();
    await page.waitForFunction(() => document.querySelector('#modalRoot [data-wl-filter="team"]')?.getAttribute('aria-pressed') === 'true');
    w = await win();
    assert.equal(w.rows, 2, 'WL_CHIP team rows only ' + JSON.stringify(w)); assert.deepEqual(w.team, ['TEST_K1', 'TEST_K2'], 'newest first, including the one past 30');
    assert.deepEqual(w.chips.map(c => c[1]), ['false', 'true']);
    assert.equal(w.sum, '👷 팀 보고 2줄 · 합계 ' + await page.evaluate(() => workHM(480 + 270)) + ' — 위 칸은 전부 기준이에요', w.sum);
    assert.equal(w.tiles, tiles, 'tiles keep the all-rows totals');
    assert(w.ov.doc <= 1 && w.ov.box <= 1, 'overflow ' + JSON.stringify(w.ov));
    await page.locator('#modalRoot .worklog-row[data-wl-team="TEST_K2"] .wkNote').click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('#modalRoot [data-team-note][data-focus]')?.getAttribute('data-team-note')), 'TEST_K2', 'note button still works');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    w = await win(); assert.deepEqual(w.chips.map(c => c[1]), ['true', 'false'], 'a fresh window starts at [전부]'); assert.equal(w.rows, 30);
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    await page.locator('#modalRoot [data-wl-filter=""]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-wl-team-sum]'));
    w = await win(); assert.equal(w.rows, 30, 'back to all');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 지워도 칩 유지 · 팀 보고 0줄이면 칩 없음 · 팀 보고 없는 현장 창엔 칩 없음 · 오류 0', async () => {
    await page.evaluate(() => { window.__v480Confirm = window.confirm; window.confirm = () => true; });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    await page.locator('#modalRoot .worklog-row[data-wl-team="TEST_K1"] .wkDel').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .worklog-row[data-wl-team="TEST_K1"]'));
    let w = await win();
    assert.deepEqual(w.chips.map(c => c.slice(0, 2)), [['전부 33', 'false'], ['👷 팀 보고만 1', 'true']], 'filter kept after delete ' + JSON.stringify(w.chips)); assert.deepEqual(w.team, ['TEST_K2']); assert.equal(w.rows, 1);
    await page.locator('#modalRoot .worklog-row[data-wl-team="TEST_K2"] .wkDel').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-wl-chips]'));
    w = await win(); assert.deepEqual(w.chips, [], 'no team rows → no chips'); assert.equal(w.rows, 30, 'falls back to all rows');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), OTHER); await page.locator('#modalRoot .worklog-row').first().waitFor();
    w = await win(); assert.deepEqual(w.chips, [], 'project without team rows → no chips'); assert.equal(w.rows, 1);
    await page.evaluate(() => closeModal(true));
    assert.equal(await page.evaluate(() => [state.workLogs.length, state.workLogs.filter(x => x.teamReport).length].join('/')), '32/0');
    await page.evaluate(() => { window.confirm = window.__v480Confirm; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlchip-v480: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlchip-v480', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

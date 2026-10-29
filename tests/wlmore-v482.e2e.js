/* v482 ⏱ 작업시간 창 — 30줄 넘으면 [더 보기](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 68줄이면 30줄 + [외 38줄 — 30줄 더 보기](44px) → 60줄(스크롤 자리 그대로, 30줄 밖 팀 보고 줄도 보임) → [외 8줄 — 8줄 더 보기] → 68줄, 단추 없음 · 390px 넘침 없음 · 자료 불변 (MORE)
   ② 새로 열면 30줄 · 펼친 채 지우면 펼친 만큼·스크롤 유지 · 칩을 바꾸면 30줄부터 · 30줄 이하 창엔 단추 없음 · 오류 0
   HJ_V482_BASELINE=<commit> 은 MORE 에서 실패해야 한다. HJ_V482_MUTATION=no-more(단추를 안 그림)도 MORE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T22 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T22 대흥동 상가 2층';
const MUT = process.env.HJ_V482_MUTATION || '';
let html = process.env.HJ_V482_BASELINE ? execFileSync('git', ['show', process.env.HJ_V482_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-more');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "(rest>0?'<div data-wl-more";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "(false?'<div data-wl-more");
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
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8201', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [{ key: 'TEST_K1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }, { key: 'TEST_K2', status: 'done', workDate: ago(50), hours: 4, done: '철거', issue: '', reporter: '박설비', checklist: [], photos: 0, at }]), proj(OTHER, [])];
    const plain = n => ({ id: 'TEST_WP' + n, project: APT, date: ago(n), in: '09:00', out: '12:00', memo: '직접 찍음' });
    const plainDays = Array.from({ length: 67 }, (_, i) => i + 1).filter(n => n !== 3 && n !== 50);   // 65줄
    state.workLogs = [{ id: 'TEST_WO1', project: OTHER, date: ago(0), in: '10:00', out: '11:00', memo: '' },
      { id: 'TEST_WT1', project: APT, date: ago(3), in: '09:00', out: '17:00', memo: '[팀 보고 · 김타일]', teamReport: { key: 'TEST_K1', orderId: '', hours: 8, reporter: '김타일' } },
      { id: 'TEST_WT2', project: APT, date: ago(50), in: '08:00', out: '12:00', memo: '[팀 보고 · 박설비]', teamReport: { key: 'TEST_K2', orderId: '', hours: 4, reporter: '박설비' } },
      ...plainDays.map(plain)];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT, OTHER });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlmore-v482 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const b = m.querySelector('[data-wl-more-btn]');
    const sc = [...document.querySelectorAll('#modalRoot .modal,#modalRoot .mbody')].find(e => e.scrollHeight > e.clientHeight + 2);
    return { rows: m.querySelectorAll('.worklog-row').length, more: b ? [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)] : null, team: [...m.querySelectorAll('.worklog-row[data-wl-team]')].map(r => r.getAttribute('data-wl-team')), scroll: sc ? Math.round(sc.scrollTop) : -1, ov: { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth } }; });
  const clickMore = async () => { const b = page.locator('#modalRoot [data-wl-more-btn]'); await b.scrollIntoViewIfNeeded(); const before = (await win()).scroll; await b.click(); await page.waitForTimeout(150); return before; };

  await test('① 30줄 + [외 38줄 — 30줄 더 보기] → 60줄(스크롤 그대로, 30줄 밖 팀 보고 줄) → 68줄 · 넘침 없음 · 자료 불변 (MORE)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win();
    assert.equal(w.rows, 30); assert.deepEqual(w.more, ['외 38줄 — 30줄 더 보기', 44], 'MORE button ' + JSON.stringify(w.more)); assert.deepEqual(w.team, ['TEST_K1']);
    const sc0 = await clickMore();
    w = await win();
    assert.equal(w.rows, 60, 'MORE 60 rows ' + JSON.stringify(w)); assert.deepEqual(w.more, ['외 8줄 — 8줄 더 보기', 44]);
    assert.deepEqual(w.team, ['TEST_K1', 'TEST_K2'], 'team row past 30 now visible');
    assert(sc0 > 0 && Math.abs(w.scroll - sc0) <= 4, 'scroll kept ' + JSON.stringify([sc0, w.scroll]));
    assert(w.ov.doc <= 1 && w.ov.box <= 1, 'overflow ' + JSON.stringify(w.ov));
    await clickMore();
    w = await win(); assert.equal(w.rows, 68); assert.equal(w.more, null, 'all rows → no button');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 새 창은 30줄 · 펼친 채 지우면 유지 · 칩 바꾸면 30줄부터 · 30줄 이하엔 단추 없음 · 오류 0', async () => {
    await page.evaluate(() => { window.__v482Confirm = window.confirm; window.confirm = () => true; });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win(); assert.equal(w.rows, 30, 'fresh window starts at 30');
    await clickMore();
    const row = page.locator('#modalRoot .worklog-row').nth(45); await row.scrollIntoViewIfNeeded();
    const sc1 = (await win()).scroll;
    await row.locator('.wkDel').click();
    await page.waitForFunction(() => document.querySelectorAll('#modalRoot .worklog-row').length === 60 && document.querySelector('#modalRoot [data-wl-more-btn]')?.textContent.includes('외 7줄'));
    w = await win();
    assert.deepEqual(w.more, ['외 7줄 — 7줄 더 보기', 44], 'expanded size kept after delete ' + JSON.stringify(w.more));
    assert(sc1 > 0 && Math.abs(w.scroll - sc1) <= 4, 'scroll kept after delete ' + JSON.stringify([sc1, w.scroll]));
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    w = await win(); assert.equal(w.rows, 2); assert.equal(w.more, null, 'two team rows → no button');
    await page.locator('#modalRoot [data-wl-filter=""]').click(); await page.waitForFunction(() => !document.querySelector('#modalRoot [data-wl-team-sum]'));
    w = await win(); assert.equal(w.rows, 30, 'chip change starts from 30 again'); assert.deepEqual(w.more, ['외 37줄 — 30줄 더 보기', 44]);
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), OTHER); await page.locator('#modalRoot .worklog-row').first().waitFor();
    w = await win(); assert.equal(w.rows, 1); assert.equal(w.more, null);
    await page.evaluate(() => closeModal(true));
    assert.equal(await page.evaluate(() => state.workLogs.length), 67, 'exactly one row deleted');
    await page.evaluate(() => { window.confirm = window.__v482Confirm; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlmore-v482: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlmore-v482', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

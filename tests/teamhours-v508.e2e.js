/* v508 👷 팀 공수 정산(이번 달, 전체 현장) — 노트 창 '⏱ 보고자별 시간' 아래 [📊 이번 달 전체 현장 공수 정산](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 단추(44px) → '👷 팀 공수 정산 — YYYY년 M월': 보고자별(시간 많은 순) n건 · h시간 + 현장별 내역(보관 현장 포함), 지난달 보고는 빠짐,
      보고자 없음 묶음, '합계 n건 · h시간 · 보고자 m명' · [← 팀 보고 노트]로 그 노트 창 · 자료 불변 (HOURS_MONTH)
   ② 보고가 없는 달은 빈 안내 · 390px 넘침 없음 · 오류 0
   HJ_V508_BASELINE=<commit> 은 HOURS_MONTH 에서 실패해야 한다. HJ_V508_MUTATION=no-month-filter(다른 달도 셈)도 HOURS_MONTH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T46 둔산 크로바아파트 101동 1203호', B = 'TEST_T46 대흥동 상가 2층', C = 'TEST_T46 유천동 주택(보관)';
const MUT = process.env.HJ_V508_MUTATION || '';
let html = process.env.HJ_V508_BASELINE ? execFileSync('git', ['show', process.env.HJ_V508_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-month-filter');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(!isRealIsoDate(d)||d.slice(0,7)!==ym)return;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'if(!isRealIsoDate(d))return;');
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
  const D = await page.evaluate(async ({ A, B, C }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', prev = hjAddDays(first, -3), at = new Date().toISOString();
    const rep = (key, status, workDate, hours, reporter) => ({ key, status, workDate, hours, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    const proj = (name, reports, archived) => ({ name, kind: 'interior', stage: archived ? 3 : 2, phases: ['철거', '타일'], received: 0, archived: !!archived, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0009', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [rep('TEST_A1', 'done', first, 4, '김타일'), rep('TEST_A2', 'review', today, 2.5, '김타일'), rep('TEST_A3', 'done', today, 3, '박설비'), rep('TEST_A0', 'done', prev, 9, '김타일')]),
      proj(B, [rep('TEST_B1', 'done', first, 6, '김타일'), rep('TEST_B2', 'blocked', today, 0, '박설비'), rep('TEST_B3', 'done', today, 1, '')]),
      proj(C, [rep('TEST_C1', 'done', first, 2, '박설비')], true)];
    state.activeProject = null; state.tab = 'dashboard'; render();
    return { ym: today.slice(0, 7) };
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamhours-v508 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const view = () => page.evaluate(() => { const r = document.getElementById('hjTeamHours'); if (!r) return null;
    return { title: document.getElementById('modalTitle').textContent.trim(), reps: [...r.querySelectorAll('[data-team-hours-reporter]')].map(b => [b.getAttribute('data-team-hours-reporter'), b.firstElementChild.lastElementChild.textContent.trim(), [...b.querySelectorAll('[data-team-hours-site]')].map(s => s.innerText.replace(/\s+/g, ' ').trim())]),
      total: (r.querySelector('[data-team-hours-total]') || {}).textContent || '' }; });

  await test('① 단추 → 보고자별·현장별(보관 포함) 이번 달만 · 보고자 없음 · 합계 · [← 팀 보고 노트] · 자료 불변 (HOURS_MONTH)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), A); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const b = await page.evaluate(() => { const x = document.querySelector('#modalRoot [data-team-hours-month]'); return x ? [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)] : null; });
    assert.deepEqual(b, ['📊 이번 달 전체 현장 공수 정산', 44], 'HOURS_MONTH button');
    await page.locator('#modalRoot [data-team-hours-month]').click(); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const v = await view();
    assert.equal(v.title, '👷 팀 공수 정산 — ' + Number(D.ym.slice(0, 4)) + '년 ' + Number(D.ym.slice(5, 7)) + '월');
    assert.deepEqual(v.reps, [
      ['김타일', '3건 · 12.5시간', [B + ' 1건 · 6시간', A + ' 2건 · 6.5시간'].sort((x, y) => (parseFloat(y.split(' · ').at(-1)) - parseFloat(x.split(' · ').at(-1))))],
      ['박설비', '3건 · 5시간', [A + ' 1건 · 3시간', C + ' 1건 · 2시간', B + ' 1건 · 0시간']],
      ['보고자 없음', '1건 · 1시간', [B + ' 1건 · 1시간']]], 'HOURS_MONTH reporters ' + JSON.stringify(v.reps));
    assert.equal(v.total, '합계 7건 · 18.5시간 · 보고자 3명 — 팀 앱 보고의 시간 기준(⏱ 작업시간 기록과 따로)');
    await page.locator('#modalRoot .mfoot button', { hasText: '← 팀 보고 노트' }).click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.match(await page.evaluate(() => document.getElementById('modalTitle').textContent), /팀 작업 보고 — TEST_T46 둔산/, 'back to the note window');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only — app data unchanged');
  });

  await test('② 보고 없는 달은 빈 안내 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(() => hjTeamHoursView('2020-01')); await page.locator('#modalRoot [data-team-hours-empty]').waitFor();
    assert.match(await page.evaluate(() => document.getElementById('modalTitle').textContent), /2020년 1월/);
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamhours-v508: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamhours-v508', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v511 👷 팀 공수 정산 창 — 보고자별 '📅 보고한 날 n일 · M/D …'(서로 다른 작업일) + 글·엑셀용 복사에 일수(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 카드 머리 아래 '📅 보고한 날 n일 · M/D · …'(날짜 오름차순): 같은 날 두 현장은 하루, 막힘(0시간) 보고도 보고한 날, 다른 달은 빠짐, 보관 현장 포함
      · 현장 줄·합계 줄은 v508 그대로 · 글 복사 '- 이름 n건 · h시간 · 보고한 날 n일 (M/D · …)' + 현장 줄 '· n일' · 표 끝 '일수' 열 · 자료 불변 (DAYS)
   ② 한 달 31일 모두 보고한 사람도 390px 안에서 줄바꿈(넘침 없음) · 오류 0
   HJ_V511_BASELINE=<commit> 은 DAYS 에서 실패해야 한다. HJ_V511_MUTATION=count-reports(날짜 대신 보고 수를 셈)도 DAYS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T49 둔산 크로바아파트 101동 1203호', B = 'TEST_T49 대흥동 상가 2층', C = 'TEST_T49 유천동 주택(보관)';
const MUT = process.env.HJ_V511_MUTATION || '';
let html = process.env.HJ_V511_BASELINE ? execFileSync('git', ['show', process.env.HJ_V511_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'count-reports');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'dates:[...g.ds].sort(),days:g.ds.size,';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'dates:[...g.ds].sort(),days:g.n,');
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
    const ym = localDate().slice(0, 7), day = n => ym + '-' + String(n).padStart(2, '0'), prev = hjAddDays(day(1), -2), at = new Date().toISOString();
    const rep = (key, status, workDate, hours, reporter) => ({ key, status, workDate, hours, done: '작업 ' + key, issue: status === 'blocked' ? '자재 미도착' : '', reporter, checklist: [], photos: 0, at });
    const proj = (name, reports, archived) => ({ name, kind: 'interior', stage: archived ? 3 : 2, phases: ['철거'], received: 0, archived: !!archived, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0012', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [
      proj(A, [rep('TEST_A1', 'done', day(2), 4, '김타일'), rep('TEST_A2', 'review', day(3), 2.5, '김타일'), rep('TEST_A3', 'done', day(5), 1, '김타일'), rep('TEST_A4', 'blocked', day(1), 0, '박설비'), rep('TEST_A0', 'done', prev, 9, '박설비')]),
      proj(B, [rep('TEST_B1', 'done', day(3), 6, '김타일'), rep('TEST_B2', 'done', day(4), 1, '')]),
      proj(C, [rep('TEST_C1', 'done', day(1), 2, '박설비')], true)];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { ym, title: Number(ym.slice(0, 4)) + '년 ' + Number(ym.slice(5, 7)) + '월', m: Number(ym.slice(5, 7)) };
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamdays-v511 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  let copies = 0;
  const copy = async sel => { copies++; await page.locator('#modalRoot ' + sel).click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n'); };
  const md = n => D.m + '/' + n;

  await test('① 보고한 날(같은 날 두 현장 = 하루, 막힘 0시간도, 다른 달 빠짐, 보관 포함) · 현장 줄·합계 그대로 · 글·표에 일수 · 자료 불변 (DAYS)', async () => {
    const before = await serialized();
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const v = await page.evaluate(() => [...document.querySelectorAll('#hjTeamHours [data-team-hours-reporter]')].map(b => [b.getAttribute('data-team-hours-reporter'),
      ((b.querySelector('[data-team-hours-days]') || {}).textContent || '').trim(), [...b.querySelectorAll('[data-team-hours-site]')].map(s => s.innerText.replace(/\s+/g, ' ').trim())]));
    assert.deepEqual(v, [
      ['김타일', '📅 보고한 날 3일 · ' + [md(2), md(3), md(5)].join(' · '), [A + ' 3건 · 7.5시간', B + ' 1건 · 6시간']],
      ['박설비', '📅 보고한 날 1일 · ' + md(1), [C + ' 1건 · 2시간', A + ' 1건 · 0시간']],
      ['보고자 없음', '📅 보고한 날 1일 · ' + md(4), [B + ' 1건 · 1시간']]], 'DAYS cards ' + JSON.stringify(v));
    assert.equal(await page.evaluate(() => document.querySelector('#hjTeamHours [data-team-hours-total]').textContent), '합계 7건 · 16.5시간 · 보고자 3명 — 팀 앱 보고의 시간 기준(⏱ 작업시간 기록과 따로)', 'total line unchanged');
    let L = await copy('[data-team-hours-copy]');
    assert.deepEqual(L, ['👷 팀 공수 정산 — ' + D.title + ' (팀 앱 보고 시간 기준)',
      '- 김타일 4건 · 13.5시간 · 보고한 날 3일 (' + [md(2), md(3), md(5)].join(' · ') + ')', '  · ' + A + ' 3건 · 7.5시간 · 3일', '  · ' + B + ' 1건 · 6시간 · 1일',
      '- 박설비 2건 · 2시간 · 보고한 날 1일 (' + md(1) + ')', '  · ' + C + ' 1건 · 2시간 · 1일', '  · ' + A + ' 1건 · 0시간 · 1일',
      '- 보고자 없음 1건 · 1시간 · 보고한 날 1일 (' + md(4) + ')', '  · ' + B + ' 1건 · 1시간 · 1일',
      '합계 7건 · 16.5시간 · 보고자 3명'], 'DAYS text ' + JSON.stringify(L));
    L = await copy('[data-team-hours-tsv]');
    assert.deepEqual(L.map(l => l.split('\t')), [['월', '보고자', '현장', '건수', '시간', '일수'], [D.ym, '김타일', A, '3', '7.5', '3'], [D.ym, '김타일', B, '1', '6', '1'],
      [D.ym, '박설비', C, '1', '2', '1'], [D.ym, '박설비', A, '1', '0', '1'], [D.ym, '보고자 없음', B, '1', '1', '1']], 'DAYS tsv');
    assert.doesNotMatch(L.join(' '), /정테스트|010-/);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only — app data unchanged');
  });

  await test('② 31일 모두 보고해도 넘침 없음 · 오류 0', async () => {
    await page.evaluate(({ A }) => { const p = state.projects.find(x => x.name === A), at = new Date().toISOString();
      for (let d = 1; d <= 31; d++) p.teamReports.push({ key: 'TEST_J' + d, status: 'done', workDate: '2026-01-' + String(d).padStart(2, '0'), hours: 8, done: '작업', issue: '', reporter: '이목수장인반장님', checklist: [], photos: 0, at }); }, { A });
    await page.evaluate(() => hjTeamHoursView('2026-01')); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const t = await page.evaluate(() => document.querySelector('#hjTeamHours [data-team-hours-days]').textContent.trim());
    assert(t.startsWith('📅 보고한 날 31일 · 1/1 · 1/2 · ') && t.endsWith(' · 1/31'), t);
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamdays-v511: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamdays-v511', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

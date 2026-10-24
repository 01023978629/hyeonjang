/* v510 👷 팀 공수 정산 창 — [📋 글로 복사] · [📊 엑셀용 복사](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 글로 복사: '👷 팀 공수 정산 — YYYY년 M월 (팀 앱 보고 시간 기준)' + '- 보고자 n건 · h시간' + '  · 현장 n건 · h시간' + '합계 …'
      · 엑셀용: 머리 '월 보고자 현장 건수 시간' + 보고자×현장 줄(시간 숫자) — v511 부터 글에 '보고한 날 n일 (M/D…)', 표 끝에 '일수' 열 · ◀ 지난달로 옮기면 그 달 내용 · 44px · 고객 정보 없음 · 자료 불변 (HCOPY)
   ② 보고 없는 달은 복사 단추 없음 · 클립보드가 막히면 예전 방식 · 오류 0
   HJ_V510_BASELINE=<commit> 은 HCOPY 에서 실패해야 한다. HJ_V510_MUTATION=no-head(글 머리줄 없음)도 HCOPY 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T48 둔산 크로바아파트 101동 1203호', B = 'TEST_T48 대흥동 상가 2층';
const MUT = process.env.HJ_V510_MUTATION || '';
let html = process.env.HJ_V510_BASELINE ? execFileSync('git', ['show', process.env.HJ_V510_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-head');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "return ['👷 팀 공수 정산 — '+Number(D.ym.slice(0,4))+'년 '+Number(D.ym.slice(5,7))+'월 (팀 앱 보고 시간 기준)',";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'return [');
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
  const D = await page.evaluate(async ({ A, B }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', p1 = hjAddDays(first, -5), at = new Date().toISOString();
    const rep = (key, workDate, hours, reporter) => ({ key, status: 'done', workDate, hours, done: '작업 ' + key, issue: '', reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0011', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [rep('TEST_A1', first, 4, '김타일'), rep('TEST_A2', today, 2.5, '김타일'), rep('TEST_A3', today, 3, '박설비'), rep('TEST_A9', p1, 8, '박설비')]),
      proj(B, [rep('TEST_B1', first, 6, '김타일')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { ym: today.slice(0, 7), pym: p1.slice(0, 7), today, first, p1, title: Number(today.slice(0, 4)) + '년 ' + Number(today.slice(5, 7)) + '월', ptitle: Number(p1.slice(0, 4)) + '년 ' + Number(p1.slice(5, 7)) + '월' };
  }, { A, B });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teamhours3-v510 ' + name); }
  // v511 부터 글·표에 '보고한 날'(서로 다른 작업일) — 오늘이 1일이면 첫날과 같은 날이라 하루로 센다
  const md = d => Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)), kimDates = [...new Set([D.first, D.today])].sort();
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  let copies = 0;
  const copy = async sel => { copies++; await page.locator('#modalRoot ' + sel).click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n'); };

  await test('① 글·엑셀용 복사 내용 · 지난달로 옮기면 그 달 · 44px · 고객 정보 없음 · 자료 불변 (HCOPY)', async () => {
    const before = await serialized();
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot #hjTeamHours').waitFor();
    const hs = await page.evaluate(() => [...document.querySelectorAll('#hjTeamHours [data-team-hours-copy],#hjTeamHours [data-team-hours-tsv]')].map(b => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]));
    assert.deepEqual(hs, [['📋 글로 복사', 44], ['📊 엑셀용 복사', 44]], 'HCOPY buttons');
    let L = await copy('[data-team-hours-copy]');
    assert.deepEqual(L, ['👷 팀 공수 정산 — ' + D.title + ' (팀 앱 보고 시간 기준)', '- 김타일 3건 · 12.5시간 · 보고한 날 ' + kimDates.length + '일 (' + kimDates.map(md).join(' · ') + ')', '  · ' + A + ' 2건 · 6.5시간 · ' + kimDates.length + '일', '  · ' + B + ' 1건 · 6시간 · 1일',
      '- 박설비 1건 · 3시간 · 보고한 날 1일 (' + md(D.today) + ')', '  · ' + A + ' 1건 · 3시간 · 1일', '합계 4건 · 15.5시간 · 보고자 2명'], 'HCOPY text ' + JSON.stringify(L));
    L = await copy('[data-team-hours-tsv]');
    assert.deepEqual(L.map(l => l.split('\t')), [['월', '보고자', '현장', '건수', '시간', '일수'], [D.ym, '김타일', A, '2', '6.5', String(kimDates.length)], [D.ym, '김타일', B, '1', '6', '1'], [D.ym, '박설비', A, '1', '3', '1']], 'TSV');
    assert.doesNotMatch(L.join(' '), /정테스트|010-/);
    await page.locator('#modalRoot [data-team-hours-prev]').click(); await page.waitForFunction(t => document.getElementById('modalTitle').textContent.includes(t), D.ptitle);
    L = await copy('[data-team-hours-copy]');
    assert.deepEqual(L, ['👷 팀 공수 정산 — ' + D.ptitle + ' (팀 앱 보고 시간 기준)', '- 박설비 1건 · 8시간 · 보고한 날 1일 (' + md(D.p1) + ')', '  · ' + A + ' 1건 · 8시간 · 1일', '합계 1건 · 8시간 · 보고자 1명'], 'last month copy');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 빈 달엔 복사 단추 없음 · 클립보드 막히면 예전 방식 · 오류 0', async () => {
    await page.evaluate(() => hjTeamHoursView('2020-01')); await page.locator('#modalRoot [data-team-hours-empty]').waitFor();
    assert.equal(await page.locator('#modalRoot [data-team-hours-copy]').count(), 0);
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; window.__exec = []; window.__ex0 = document.execCommand.bind(document); document.execCommand = c => { window.__exec.push([c, (document.querySelector('body > textarea') || {}).value || '']); return true; }; });
    await page.evaluate(() => hjTeamHoursView()); await page.locator('#modalRoot [data-team-hours-tsv]').click(); await page.waitForFunction(() => window.__exec.length === 1);
    const ex = await page.evaluate(() => window.__exec[0]);
    assert.equal(ex[0], 'copy'); assert.equal(ex[1].split('\n')[0], ['월', '보고자', '현장', '건수', '시간', '일수'].join('\t'));
    assert.match(await page.evaluate(() => document.getElementById('toast').textContent), /공수 정산을 표\(엑셀용\)로 복사했어요/);
    await page.evaluate(() => { closeModal(true); document.execCommand = window.__ex0; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teamhours3-v510: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teamhours3-v510', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

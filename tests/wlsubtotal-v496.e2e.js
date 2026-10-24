/* v496 ⏱ 작업시간 창 [📋 글로 복사] — 현장별 소계(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 전체 창 복사: 머리줄·줄·'합계 …' 뒤에 '현장별 소계 (진행 중 1줄 제외)' + '- 현장 · n줄 · 시간'(시간 많은 순, 현장 없으면 '현장 미지정')
      · 소계 시간을 다 더하면 합계와 같음(진행 중 줄 제외) · 팀 칩으로 한 현장만 보이면 소계 없음 · 현장 창은 합계만 · 자료 불변 (SUB)
   ② 끝난 줄의 현장이 하나면 소계 없음(진행 중만 있는 현장은 안 셈) · 진행 중 줄이 없으면 괄호 없음 · 오류 0
   HJ_V496_BASELINE=<commit> 은 SUB 에서 실패해야 한다. HJ_V496_MUTATION=no-subtotal(소계를 안 붙임)도 SUB 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T34 둔산 크로바아파트 101동 1203호', B = 'TEST_T34 대흥동 상가 2층', C = 'TEST_T34 유천동 주택';
const MUT = process.env.HJ_V496_MUTATION || '';
let html = process.env.HJ_V496_BASELINE ? execFileSync('git', ['show', process.env.HJ_V496_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-subtotal');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const subLines=pjName?[]:hjWorkSubtotalLines(list);';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const subLines=[];');
}
// '7시간' · '1시간 30분' · '30분' → 분
const toMin = s => { const m = /^(?:(\d+)시간)?\s*(?:(\d+)분)?$/.exec(String(s).trim()); assert(m, 'time text ' + s); return (+(m[1] || 0)) * 60 + (+(m[2] || 0)); };

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
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9601', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [{ key: 'TEST_K1', status: 'done', workDate: ago(2), hours: 4, done: '타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }]), proj(B, []), proj(C, [])];
    state.workLogs = [{ id: 'TEST_A0', project: A, date: today, in: '08:30', out: '', memo: '' },
      { id: 'TEST_A1', project: A, date: ago(1), in: '09:00', out: '12:00', memo: '바닥 철거' },
      { id: 'TEST_A2', project: A, date: ago(2), in: '13:00', out: '17:00', memo: '[팀 보고 · 김타일]', teamReport: { key: 'TEST_K1', orderId: '', hours: 4, reporter: '김타일' } },
      { id: 'TEST_B1', project: B, date: ago(3), in: '09:00', out: '11:00', memo: '' },
      { id: 'TEST_B2', project: B, date: ago(4), in: '09:00', out: '11:00', memo: '' },
      { id: 'TEST_B3', project: B, date: ago(5), in: '09:00', out: '11:00', memo: '' },
      { id: 'TEST_C1', project: C, date: ago(6), in: '09:00', out: '10:30', memo: '' },
      { id: 'TEST_U1', project: '', date: ago(7), in: '10:00', out: '10:30', memo: '' }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { sum: workHM(900), h4: workHM(240), m2: hjMdDow(ago(2)), sumA: workHM(420), hA: workHM(420).trim(), hB: workHM(360).trim(), hC: workHM(90).trim(), hU: workHM(30).trim(), h3: workHM(180).trim(), h2: workHM(120).trim() };
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlsubtotal-v496 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  let copies = 0;
  const copy = async () => { copies++; await page.locator('#modalRoot [data-wl-copy]').click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n'); };

  await test('① 전체 창 복사 끝에 현장별 소계(시간 많은 순·진행 중 제외·합 = 합계) · 팀 칩 한 현장이면 없음 · 현장 창은 합계만 · 자료 불변 (SUB)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let L = await copy();
    assert.equal(L[0], '⏱ 작업시간 — 전체 · 8줄', L[0]);
    assert.equal(L[9], '합계 ' + D.sum, 'total line stays right after the rows');
    assert.deepEqual(L.slice(10), ['현장별 소계 (진행 중 1줄 제외)', '- ' + A + ' · 2줄 · ' + D.hA, '- ' + B + ' · 3줄 · ' + D.hB, '- ' + C + ' · 1줄 · ' + D.hC, '- 현장 미지정 · 1줄 · ' + D.hU],
      'SUB per-site subtotals after the total ' + JSON.stringify(L.slice(9)));
    const subSum = L.slice(11).reduce((s, x) => s + toMin(x.split(' · ').at(-1)), 0);
    assert.equal(subSum, toMin(L[9].slice(3)), 'SUB subtotals add up to the total (in-progress row excluded)');
    assert.doesNotMatch(L.join('\n'), /정테스트|010-/, 'no customer name/phone');
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    L = await copy();
    assert.deepEqual(L, ['⏱ 작업시간 — 전체 · 👷 팀 보고 · 1줄', '- ' + D.m2 + ' ' + A + ' 13:00~17:00 (' + D.h4 + ') [팀 보고 · 김타일]', '합계 ' + D.h4], 'one site visible → no subtotal');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), A); await page.locator('#modalRoot .worklog-row').first().waitFor();
    L = await copy();
    assert.equal(L.at(-1), '합계 ' + D.sumA, 'project window ends with the total'); assert.equal(L.length, 5);
    assert(!L.some(x => x.startsWith('현장별 소계')), 'project window: no subtotal');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 끝난 줄의 현장이 하나면 없음 · 진행 중 줄이 없으면 괄호 없음 · 오류 0', async () => {
    await page.evaluate(({ A, B }) => {
      const today = localDate(), ago = n => hjAddDays(today, -n);
      state.workLogs = [{ id: 'TEST_X1', project: A, date: ago(1), in: '09:00', out: '12:00', memo: '' }, { id: 'TEST_X2', project: B, date: today, in: '08:00', out: '', memo: '' }];
    }, { A, B });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let L = await copy();
    assert.equal(L.length, 4, 'header + 2 rows + total ' + JSON.stringify(L)); assert.match(L.at(-1), /^합계 /);
    await page.evaluate(() => closeModal(true));
    await page.evaluate(({ A, B }) => {
      const today = localDate(), ago = n => hjAddDays(today, -n);
      state.workLogs = [{ id: 'TEST_Y1', project: B, date: ago(1), in: '09:00', out: '11:00', memo: '' }, { id: 'TEST_Y2', project: A, date: ago(2), in: '09:00', out: '12:00', memo: '' }];
    }, { A, B });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    L = await copy();
    assert.deepEqual(L.slice(-3), ['현장별 소계', '- ' + A + ' · 1줄 · ' + D.h3, '- ' + B + ' · 1줄 · ' + D.h2], 'no in-progress rows → plain heading, still hours first');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlsubtotal-v496: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlsubtotal-v496', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

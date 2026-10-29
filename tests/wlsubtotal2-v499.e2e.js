/* v499 ⏱ 작업시간 창 — 화면에도 '📊 현장별 소계'(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 전체 창: 목록 위 접이식 '📊 현장별 소계 4곳 · 진행 중 1줄 제외'(44px, 처음엔 접힘) → 펼치면 현장 · n줄 · 시간(시간 많은 순, 소계 합 = 합계)
      · 팀 칩으로 한 현장만 보이면 없음 · [전부]로 돌아오면 펼친 채 · 현장 창엔 없음 · 390px 넘침 없음 · 자료 불변 (SCREEN)
   ② [더 보기] 뒤 소계가 보이는 줄을 따름 · 1280px 넘침 없음 · 오류 0
   HJ_V499_BASELINE=<commit> 은 SCREEN 에서 실패해야 한다. HJ_V499_MUTATION=no-screen(화면 소계 없음)도 SCREEN 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T37 둔산 크로바아파트 101동 1203호', B = 'TEST_T37 대흥동 상가 2층', C = 'TEST_T37 유천동 주택';
const MUT = process.env.HJ_V499_MUTATION || '';
let html = process.env.HJ_V499_BASELINE ? execFileSync('git', ['show', process.env.HJ_V499_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-screen');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const wlSubAll=pjName?null:hjWorkSubtotals(visible),wlSub=wlSubAll&&wlSubAll.groups.length>1?wlSubAll:null;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const wlSubAll=null,wlSub=null;');
}
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
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9901', addr: '대전 서구 둔산동' }, teamReports: reports });
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
    return { sum: 900 };
  }, { A, B, C });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlsubtotal2-v499 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const sub = () => page.evaluate(() => { const d = document.querySelector('#modalRoot [data-wl-subtotal]'); if (!d) return null; const s = d.querySelector('summary');
    return { open: d.open, head: s.textContent.trim(), h: Math.round(s.getBoundingClientRect().height), rows: [...d.querySelectorAll('[data-wl-subtotal-row]')].map(r => [...r.children].map(c => c.textContent.trim())) }; });
  const ov = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });

  await test('① 전체 창 접이식 소계(4곳·진행 중 제외·합 = 합계) · 팀 칩 한 현장이면 없음 · 펼침 유지 · 현장 창엔 없음 · 넘침 없음 · 자료 불변 (SCREEN)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let s = await sub();
    assert(s, 'SCREEN subtotal block shown in the all window');
    assert.equal(s.head, '📊 현장별 소계 4곳 · 진행 중 1줄 제외', s.head); assert.equal(s.open, false, 'starts folded'); assert(s.h >= 44, 'tap target ' + s.h);
    await page.locator('#modalRoot [data-wl-subtotal] summary').click();
    s = await sub();
    assert.equal(s.open, true);
    assert.deepEqual(s.rows.map(r => r[0]), [A, B, C, '현장 미지정'], 'hours first ' + JSON.stringify(s.rows));
    assert.deepEqual(s.rows.map(r => r[1].split(' · ')[0]), ['2줄', '3줄', '1줄', '1줄']);
    assert.equal(s.rows.reduce((t, r) => t + toMin(r[1].split(' · ')[1]), 0), D.sum, 'SCREEN subtotals add up to the total');
    assert(((await ov()).every(x => x <= 1)), 'overflow 390 ' + JSON.stringify(await ov()));
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    assert.equal(await sub(), null, 'one site visible → no block');
    await page.locator('#modalRoot [data-wl-filter=""]').click(); await page.waitForFunction(() => !document.querySelector('#modalRoot [data-wl-team-sum]'));
    s = await sub(); assert.equal(s && s.open, true, 'stays open after re-render');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), A); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.equal(await sub(), null, 'project window: no block');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② [더 보기] 뒤 보이는 줄을 따름 · 1280px 넘침 없음 · 오류 0', async () => {
    await page.evaluate(({ A, B }) => {
      const today = localDate(), ago = n => hjAddDays(today, -n);
      state.workLogs = [{ id: 'TEST_X1', project: A, date: today, in: '09:00', out: '12:00', memo: '' },
        ...Array.from({ length: 34 }, (_, i) => ({ id: 'TEST_Y' + i, project: B, date: ago(i + 1), in: '09:00', out: '10:00', memo: '' }))];
    }, { A, B });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let s = await sub(); assert.deepEqual(s.rows.map(r => r[1].split(' · ')[0]), ['29줄', '1줄'], 'visible 30 rows ' + JSON.stringify(s.rows));
    const mb = page.locator('#modalRoot [data-wl-more-btn]'); await mb.scrollIntoViewIfNeeded(); await mb.click();
    await page.waitForFunction(() => document.querySelectorAll('#modalRoot .worklog-row').length === 35);
    s = await sub(); assert.deepEqual(s.rows.map(r => r[1].split(' · ')[0]), ['34줄', '1줄'], 'after more ' + JSON.stringify(s.rows));
    await page.evaluate(() => closeModal(true));
    await page.setViewportSize({ width: 1280, height: 800 }); await page.evaluate(() => { __mobileMode = false; applyMobileMode(); });
    await page.evaluate(() => workView()); await page.locator('#modalRoot [data-wl-subtotal]').waitFor();
    assert(((await ov()).every(x => x <= 1)), 'overflow 1280 ' + JSON.stringify(await ov()));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlsubtotal2-v499: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlsubtotal2-v499', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

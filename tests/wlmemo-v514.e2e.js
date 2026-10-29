/* v514 ⏱ 작업시간 줄에 메모 '📝 …' — 적은 메모가 수정 창·복사·찾기에만 있고 목록엔 안 보였다(운영 v425 도 같음, 개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 줄마다 현장 이름 아래 '📝 메모'(60자 넘으면 59자 + '…', 전체는 마우스 올림 title) · 팀 보고 줄은 머리 '[팀 보고 · 이름]'을 떼고(배지와 겹침) · 메모 없으면 줄 없음
      · ✏️ 수정으로 메모를 고치면 목록에 바로 · 보기만으로는 자료 불변 (MEMO)
   ② 390px 줄 넘침 없음 · PC 1280 에서도 현장 칸 안 · 오류 0
   HJ_V514_BASELINE=<commit> 은 MEMO 에서 실패해야 한다. HJ_V514_MUTATION=keep-prefix(팀 보고 머리 안 뗌)도 MEMO 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T52 둔산 크로바아파트 101동 1203호', B = 'TEST_T52 대흥동 상가 2층';
const MUT = process.env.HJ_V514_MUTATION || '';
let html = process.env.HJ_V514_BASELINE ? execFileSync('git', ['show', process.env.HJ_V514_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'keep-prefix');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(tr)t=t.replace(/^\\[팀 보고[^\\]]*\\]\\s*/,'');";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const LONG = '욕실 벽 타일 1차 시공 — 줄눈은 내일 오전, 코너 비드 2개 추가 필요, 자재 남은 것 창고로 옮김, 다음 주 월요일 실리콘 마감 예정이고 관리사무소에 엘리베이터 보양 연장 요청함';

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.evaluate(async ({ A, B, LONG }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0015', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [{ key: 'TEST_K1', status: 'done', workDate: ago(1), hours: 4, done: '벽 타일', issue: '코너 비드 부족', reporter: '김타일', checklist: [], photos: 0, at }]), proj(B, [])];
    state.workLogs = [
      { id: 'TEST_W1', project: A, date: ago(0), in: '08:30', out: '12:00', memo: '바닥 철거' },
      { id: 'TEST_W2', project: A, date: ago(1), in: '09:00', out: '13:00', memo: '[팀 보고 · 김타일] 벽 타일 / 이슈: 코너 비드 부족 (보고 4시간)', teamReport: { key: 'TEST_K1', orderId: '', hours: 4, reporter: '김타일' } },
      { id: 'TEST_W3', project: B, date: ago(2), in: '13:00', out: '17:30', memo: '' },
      { id: 'TEST_W4', project: B, date: ago(3), in: '09:00', out: '18:00', memo: LONG }];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { A, B, LONG });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlmemo-v514 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const memos = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .worklog-row')].map(r => { const m = r.querySelector('.worklog-project [data-wl-memo]'); return m ? [m.textContent.trim(), m.getAttribute('title')] : null; }));

  await test('① 줄마다 📝 메모 · 팀 보고 머리 뗌 · 없으면 없음 · 60자 자름(title 은 전체) · 수정하면 바로 · 자료 불변 (MEMO)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const m = await memos();
    assert.deepEqual(m.slice(0, 3), [['📝 바닥 철거', '바닥 철거'], ['📝 벽 타일 / 이슈: 코너 비드 부족 (보고 4시간)', '벽 타일 / 이슈: 코너 비드 부족 (보고 4시간)'], null], 'MEMO rows ' + JSON.stringify(m));
    assert.equal(m[3][0], '📝 ' + LONG.slice(0, 59) + '…', 'MEMO long cut'); assert.equal(m[3][1], LONG, 'MEMO long title');
    assert.equal(await page.evaluate(() => !!document.querySelector('#modalRoot .worklog-row[data-wl-team="TEST_K1"] .worklog-project [data-wl-memo]')), true, 'team row keeps the memo under the badge');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'viewing only — app data unchanged');
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await page.locator('#modalRoot .worklog-row').nth(2).locator('.wkEdit').click(); await page.locator('#modalRoot #wkSave').waitFor();
    await page.locator('#modalRoot #wkMemo').fill('도장 2차 · 잔손 보기');
    await page.locator('#modalRoot #wkSave').click(); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('#modalRoot .worklog-row [data-wl-memo]')].some(x => x.textContent.includes('도장 2차 · 잔손 보기')));
    assert.equal(await page.evaluate(() => state.workLogs.find(w => w.id === 'TEST_W3').memo), '도장 2차 · 잔손 보기');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 390px 넘침 없음 · PC 1280 현장 칸 안 · 오류 0', async () => {
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth, ...[...document.querySelectorAll('#modalRoot .worklog-row')].map(r => r.scrollWidth - r.clientWidth)]; });
    assert(ov.every(x => x <= 1), 'overflow 390 ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    await page.setViewportSize({ width: 1280, height: 900 }); await page.evaluate(() => { __mobileMode = false; applyMobileMode(); });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const inCell = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .worklog-row [data-wl-memo]')].every(x => { const c = x.closest('.worklog-project').getBoundingClientRect(), r = x.getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1; }));
    assert.equal(inCell, true, 'memo stays inside the site cell on PC');
    ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow 1280 ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlmemo-v514: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlmemo-v514', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

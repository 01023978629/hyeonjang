/* v504 👷 팀 보고 노트 창 — '📅 이번 달' 칩(월 정산용, 개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 이번 달 보고가 일부면 [📅 이번 달 2](44px, aria-pressed) → 이번 달만(지난달 말일·중순 빠짐, 이번 달 1일 들어감)
      · 상태·보고자 칩과 겹침(칩을 바꿔도 유지) · 복사 머리줄 '· 📅 이번 달' · ⏱ 보고자별 시간·모두 확인함도 그 줄만
      · 이번 달 + 다른 조건이면 [✕ 조건 모두 끄기] · ack 말고는 자료 불변 (MONTH)
   ② 전부 이번 달이거나 하나도 없으면 칩 없음 · 빈 글 안내 '📅 이번 달 끄기' · 390px 넘침 없음 · 오류 0
   HJ_V504_BASELINE=<commit> 은 MONTH 에서 실패해야 한다. HJ_V504_MUTATION=no-month(칩을 눌러도 줄이 안 줄어듦)도 MONTH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T42 둔산 크로바아파트 101동 1203호', NOW = 'TEST_T42 대흥동 상가 2층';
const MUT = process.env.HJ_V504_MUTATION || '';
let html = process.env.HJ_V504_BASELINE ? execFileSync('git', ['show', process.env.HJ_V504_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-month');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '.filter(r=>!f.month||hjTeamReportThisMonth(r))';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
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
  await page.evaluate(async ({ APT, NOW }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', at = new Date().toISOString();
    const rep = (key, status, workDate, hours, issue, reporter) => ({ key, status, workDate, hours, done: '작업 ' + key, issue, reporter, checklist: [], photos: 0, at });
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0005', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [rep('TEST_R1', 'review', hjAddDays(first, -15), 6, '', '김타일'), rep('TEST_R2', 'blocked', hjAddDays(first, -1), 0, '자재', '박설비'),
        rep('TEST_R3', 'review', first, 2, '줄눈', '김타일'), rep('TEST_R4', 'blocked', today, 3, '', '박설비')]),
      proj(NOW, [rep('TEST_N1', 'done', first, 1, '', '이목수'), rep('TEST_N2', 'done', today, 1, '', '최도장'), rep('TEST_N3', 'review', today, 1, '', '이목수')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V504_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    window.confirm = () => true;
  }, { APT, NOW });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notemonth-v504 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const chipOf = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-note-filter-month]'); return b ? [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)] : null; });
  const hours = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-team-note-hours]'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : null; });

  await test('① [📅 이번 달 2] → 이번 달만 · 칩 겹침 · 복사 머리줄 · 보고자별 시간·모두 확인함도 그 줄만 · 조건 모두 끄기 · 그 밖 불변 (MONTH)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.deepEqual(await chipOf(), ['📅 이번 달 2', 'false', 44], 'MONTH chip');
    await page.locator('#modalRoot [data-note-filter-month]').click();
    const k = await keys(); assert.deepEqual([...k].sort(), ['TEST_R3', 'TEST_R4'], 'MONTH rows this month only ' + JSON.stringify(k));
    assert.equal((await chipOf())[1], 'true');
    assert.equal(await hours(), '⏱ 보고자별 시간 👤 박설비 1건 · 3시간 👤 김타일 1건 · 2시간 합 5시간', 'hours follow the month chip');
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    assert.deepEqual(await keys(), ['TEST_R3'], 'month ∩ review'); assert.equal((await chipOf())[1], 'true', 'month chip kept');
    assert(await page.locator('#modalRoot [data-note-filter-reset]').count(), 'reset shows for month + status');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.equal((await page.evaluate(() => window.__copied[0])).split('\n')[0], '[' + APT + '] 팀 작업 보고 1건 · 🔎 검수 요청 · 📅 이번 달');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    assert.equal(await page.locator('#modalRoot [data-team-note-ackall]').textContent(), '✔ 보이는 검수·막힘 2건 모두 확인함', 'only this month');
    await page.locator('#modalRoot [data-team-note-ackall]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-team-note-ackall]'));
    const acks = await page.evaluate(n => state.projects.find(p => p.name === n).teamReports.map(r => [r.key, !!r.ack]), APT);
    assert.deepEqual(acks, [['TEST_R1', false], ['TEST_R2', false], ['TEST_R3', true], ['TEST_R4', true]], 'last month left alone ' + JSON.stringify(acks));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 전부 이번 달이면 칩 없음 · 빈 글 안내 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), NOW); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await chipOf(), null, 'all this month → no chip');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await page.locator('#modalRoot [data-note-filter-month]').click();
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="박설비"]').click();
    assert.match(await page.locator('#modalRoot [data-team-note-empty]').textContent(), /📅 이번 달 끄기/);
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notemonth-v504: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notemonth-v504', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

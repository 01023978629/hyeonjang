/* v506 👷 팀 보고 노트 창 — '🔍 찾기'(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 보고 5건 이상이면 칩 위에 찾기 칸(44px) → 글자를 넣고 멈추면 한 일·이슈·보고자·지시 이름에 그 글자가 든 보고만(대소문자 무시)
      · 입력칸에 그대로 이어 쓰기(포커스·글자 유지) · 상태 칩과 겹침(칩을 눌러도 찾기 글자 유지) · 복사 머리줄 '· 🔍 글자'
      · 찾기 + 칩이면 [✕ 조건 모두 끄기] → 찾기 칸도 비움 · 자료 불변 (SEARCH)
   ② 맞는 것 없으면 빈 글 안내 '🔍 찾기 지우기' · 보고 4건 이하면 찾기 칸 없음 · 390px 넘침 없음 · 오류 0
   HJ_V506_BASELINE=<commit> 은 SEARCH 에서 실패해야 한다. HJ_V506_MUTATION=no-search(글자를 넣어도 안 줄어듦)도 SEARCH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T44 둔산 크로바아파트 101동 1203호', SMALL = 'TEST_T44 대흥동 상가 2층';
const MUT = process.env.HJ_V506_MUTATION || '';
let html = process.env.HJ_V506_BASELINE ? execFileSync('git', ['show', process.env.HJ_V506_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-search');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '.filter(r=>!f.q||hjTeamReportNoteMatch(p,r,f.q))';
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
  await page.evaluate(async ({ APT, SMALL }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at });
    const proj = (name, reports, orders) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0007', addr: '대전 서구 둔산동' }, teamReports: reports, workOrders: orders || [] });
    state.projects = [proj(APT, [rep('TEST_R1', 'done', 6, '벽 타일 1차', '', '김기사'), rep('TEST_R2', 'review', 5, '바닥 정리', '줄눈 색 확인 ABC', '김기사'),
        rep('TEST_R3', 'blocked', 4, '', '자재 미도착', '박설비'), rep('TEST_R4', 'done', 3, '줄눈 보수', '', '박설비'), rep('TEST_R5', 'review', 2, '실리콘', 'abc 확인', '이목수')],
      [{ packetId: 'wo_20261020_009', title: '욕실 방수', sentAt: at, via: 'copy', assignee: '이목수', due: ago(1), priority: 'normal', checklist: [], items: [],
        reports: [{ key: 'TEST_R6', status: 'done', workDate: ago(1), hours: 3, done: '도막 2회', issue: '', reporter: '이목수', checklist: [], photos: 0, at }] }]),
      proj(SMALL, [rep('TEST_S1', 'done', 3, '철거', '', '이목수'), rep('TEST_S2', 'done', 2, '목공', '', '최도장'), rep('TEST_S3', 'review', 1, '도장', '', '이목수')])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V506_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
  }, { APT, SMALL });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notesearch-v506 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const keys = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note')));
  const search = async q => { await page.locator('#modalRoot [data-note-search]').fill(q); await page.waitForFunction(v => { const i = document.querySelector('#hjTeamNote [data-note-search]'); return i && i.value === v && document.activeElement === i; }, q, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(350); };

  await test('① 찾기 칸 → 한 일·이슈·보고자·지시에 든 글자만 · 이어 쓰기 · 칩과 겹침 · 복사 머리줄 · 조건 모두 끄기 · 자료 불변 (SEARCH)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const box = await page.evaluate(() => { const i = document.querySelector('#modalRoot [data-note-search]'); return i ? [i.getAttribute('placeholder'), Math.round(i.getBoundingClientRect().height)] : null; });
    assert.deepEqual(box, ['🔍 한 일·이슈·보고자·지시 찾기', 44], 'SEARCH box');
    await search('줄눈');
    assert.deepEqual(await keys(), ['TEST_R4', 'TEST_R2'], 'SEARCH done/issue text ' + JSON.stringify(await keys()));
    assert.deepEqual(await page.evaluate(() => { const i = document.querySelector('#hjTeamNote [data-note-search]'); return [i.value, document.activeElement === i, i.selectionStart]; }), ['줄눈', true, 2], 'focus and caret kept after re-render');
    await page.locator('#modalRoot [data-note-filter-status="review"]').click();
    assert.deepEqual(await keys(), ['TEST_R2'], 'search ∩ review');
    assert.equal(await page.locator('#modalRoot [data-note-search]').inputValue(), '줄눈', 'search text kept when a chip is clicked');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.equal((await page.evaluate(() => window.__copied[0])).split('\n')[0], '[' + APT + '] 팀 작업 보고 1건 · 🔎 검수 요청 · 🔍 줄눈');
    assert(await page.locator('#modalRoot [data-note-filter-reset]').count(), 'reset for search + status');
    await page.locator('#modalRoot [data-note-filter-reset]').click();
    assert.equal((await keys()).length, 6, 'reset shows all'); assert.equal(await page.locator('#modalRoot [data-note-search]').inputValue(), '', 'reset clears the search box');
    await search('박설비'); assert.deepEqual(await keys(), ['TEST_R4', 'TEST_R3'], 'reporter name');
    await search('욕실'); assert.deepEqual(await keys(), ['TEST_R6'], 'order title');
    await search('ABC'); assert.deepEqual(await keys(), ['TEST_R5', 'TEST_R2'], 'case-insensitive');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 맞는 것 없으면 빈 글 안내 · 4건 이하면 찾기 칸 없음 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await search('없는말');
    assert.match(await page.locator('#modalRoot [data-team-note-empty]').textContent(), /🔍 찾기 지우기/);
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), SMALL); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await page.locator('#modalRoot [data-note-search]').count(), 0, 'no box for 3 reports');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notesearch-v506: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notesearch-v506', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

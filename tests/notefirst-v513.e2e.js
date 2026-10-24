/* v513 👷 팀 보고 노트 창 — 폰에서 보고가 먼저 보이게: 찾기·칩(고르는 것)은 위, 🧰 복사·정산(글로 복사·엑셀용·모두 확인함·보고자별 시간·공수 정산)은 목록 아래(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 390×844 보고 8건·보고자 4명: 첫 보고가 첫 화면 안(위 520px 안) · 찾기·칩 < 목록 < 🧰 묶음(머리 '🧰 복사·정산 — 위에서 고른 보고 기준') · 묶음에 복사·엑셀용·모두 확인함·보고자별 시간·공수 정산
      · 칩을 눌러도 같은 자리(복사 건수는 칩을 따름) · 찾기 결과가 없으면 🧰 묶음 없음 · 자료 불변 (FIRST)
   ② PC 1280 두 칸 목록(v492) 아래 🧰 묶음이 목록 폭 그대로 · 넘침 없음 · 오류 0
   HJ_V513_BASELINE=<commit> 은 FIRST 에서 실패해야 한다. HJ_V513_MUTATION=no-tools(🧰 묶음 없음)도 FIRST 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T51 둔산 크로바아파트 101동 1203호 욕실';
const MUT = process.env.HJ_V513_MUTATION || '';
let html = process.env.HJ_V513_BASELINE ? execFileSync('git', ['show', process.env.HJ_V513_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-tools');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "(tools?'<div data-team-note-tools";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "(false?'<div data-team-note-tools");
}

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
  await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const R = (key, status, d, hours, reporter, done, issue) => ({ key, status, workDate: ago(d), hours, done, issue: issue || '', reporter, checklist: [], photos: 0, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '설비', '방수', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0014', addr: '대전 서구 둔산동' },
      teamReports: [R('TEST_R1', 'done', 0, 8, '김타일', '벽 타일 1차'), R('TEST_R2', 'review', 1, 6, '김타일', '바닥 타일', '구배 확인'), R('TEST_R3', 'blocked', 1, 2, '박설비', '배관 이설 대기', '자재 미도착'),
        R('TEST_R4', 'done', 2, 8, '박설비', '급수·배수 이설'), R('TEST_R5', 'done', 3, 8, '이방수', '방수 1·2차'), R('TEST_R6', 'done', 5, 8, '김철거', '철거·반출'), R('TEST_R7', 'done', 9, 4, '김타일', '실측'), R('TEST_R8', 'done', 12, 3, '박설비', '현장 확인')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notefirst-v513 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const layout = () => page.evaluate(() => { const r = document.getElementById('hjTeamNote'), list = r.querySelector('[data-team-note-list]'), tools = r.querySelector('[data-team-note-tools]'), first = list.querySelector('[data-team-note]');
    const after = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
    const chips = r.querySelector('[data-note-filter-status]'), search = r.querySelector('[data-note-search]');
    return { firstTop: first ? Math.round(first.getBoundingClientRect().top) : null, toolsAfterList: after(list, tools), chipsBeforeList: after(chips, list), searchBeforeList: after(search, list),
      head: tools ? (tools.firstElementChild.textContent || '').trim() : null,
      inTools: tools ? ['[data-team-note-copy]', '[data-team-note-tsv]', '[data-team-note-ackall]', '[data-team-note-hours]', '[data-team-hours-month]'].map(s => !!tools.querySelector(s)) : [],
      outside: ['[data-team-note-copy]', '[data-team-note-tsv]', '[data-team-note-ackall]', '[data-team-note-hours]', '[data-team-hours-month]'].filter(s => [...r.querySelectorAll(s)].some(n => !tools || !tools.contains(n))),
      copyText: ((r.querySelector('[data-team-note-copy]') || {}).textContent || '').trim(), toolsW: tools ? Math.round(tools.getBoundingClientRect().width) : 0, listW: Math.round(list.getBoundingClientRect().width) }; });

  await test('① 첫 보고가 첫 화면 안 · 찾기·칩 < 목록 < 🧰 묶음 · 칩을 따름 · 찾기 0건이면 묶음 없음 · 자료 불변 (FIRST)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote [data-team-note]').first().waitFor();
    let L = await layout();
    assert(L.firstTop !== null && L.firstTop < 520, 'FIRST first report top ' + L.firstTop);
    assert.deepEqual([L.searchBeforeList, L.chipsBeforeList, L.toolsAfterList], [true, true, true], 'FIRST order ' + JSON.stringify(L));
    assert.equal(L.head, '🧰 복사·정산 — 위에서 고른 보고 기준');
    assert.deepEqual(L.inTools, [true, true, true, true, true], 'tools inside the 🧰 block'); assert.deepEqual(L.outside, [], 'no tool outside the block');
    assert.equal(L.copyText, '📋 보이는 보고 8건 글로 복사');
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    await page.waitForFunction(() => (document.querySelector('#hjTeamNote [data-team-note-copy]') || {}).textContent?.includes('3건'));
    L = await layout(); assert.equal(L.toolsAfterList, true); assert.equal(L.copyText, '📋 보이는 보고 3건 글로 복사');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.equal((await page.evaluate(() => window.__copied[0])).split('\n').filter(l => /^- /.test(l)).length, 3, 'copy follows the chip');
    await page.locator('#modalRoot [data-note-search]').fill('없는말zz');
    await page.waitForFunction(() => !document.querySelector('#hjTeamNote [data-team-note-tools]') && !document.querySelector('#hjTeamNote [data-team-note-list] [data-team-note]'));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'read only — app data unchanged');
  });

  await test('② PC 1280 두 칸 목록 아래 🧰 묶음 · 넘침 없음 · 오류 0', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => { __mobileMode = false; applyMobileMode(); });
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote [data-team-note]').first().waitFor();
    const L = await layout();
    assert.equal(L.toolsAfterList, true); assert(Math.abs(L.toolsW - L.listW) <= 2, 'tools width ' + L.toolsW + ' vs list ' + L.listW);
    const cols = await page.evaluate(() => new Set([...document.querySelectorAll('#hjTeamNote [data-team-note-list] > [data-team-note]')].map(n => Math.round(n.getBoundingClientRect().left))).size);
    assert.equal(cols, 2, 'two columns kept on PC');
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notefirst-v513: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notefirst-v513', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

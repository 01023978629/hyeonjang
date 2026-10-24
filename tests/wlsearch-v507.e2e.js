/* v507 ⏱ 작업시간 창 — '🔍 찾기'(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 줄 8개 이상이면 찾기 칸(44px) → 멈추면 현장·메모·날짜·팀 보고자에 글자가 든 줄만(대소문자 무시) + '🔍 “글자” n줄 · 합계'
      · 이어 쓰기(포커스·커서) · [📋 글로 복사] 머리줄 '· 🔍 글자'·📊 엑셀용·📊 현장별 소계도 그 줄만 · 팀 칩과 겹침
      · [✏️ 수정] → [← 작업시간] 뒤에도 유지 · 밖에서 새로 열면 비움 · 자료 불변 (WLSEARCH)
   ② 맞는 것 없으면 '찾는 글자에 맞는 기록이 없어요' · 7줄 이하면 칸 없음 · 390px 넘침 없음 · 오류 0
   HJ_V507_BASELINE=<commit> 은 WLSEARCH 에서 실패해야 한다. HJ_V507_MUTATION=no-wlsearch(글자를 넣어도 안 줄어듦)도 WLSEARCH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T45 둔산 크로바아파트 101동 1203호', B = 'TEST_T45 대흥동 상가 2층';
const MUT = process.env.HJ_V507_MUTATION || '';
let html = process.env.HJ_V507_BASELINE ? execFileSync('git', ['show', process.env.HJ_V507_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-wlsearch');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const found=wlQ?list.filter(wlMatch):list;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const found=list;');
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
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0008', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [{ key: 'TEST_K1', status: 'done', workDate: ago(2), hours: 4, done: '타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }]), proj(B, [])];
    let i = 0; const wl = (project, n, inT, outT, memo, team) => Object.assign({ id: 'TEST_W' + (++i), project, date: ago(n), in: inT, out: outT, memo }, team ? { teamReport: { key: team, orderId: '', hours: 4, reporter: '김타일' } } : {});
    state.workLogs = [wl(A, 1, '09:00', '12:00', '바닥 철거'), wl(A, 2, '13:00', '17:00', '[팀 보고 · 김타일]', 'TEST_K1'), wl(A, 3, '09:00', '11:00', '타일 줄눈'), wl(A, 4, '09:00', '10:00', '자재 정리'),
      wl(B, 5, '09:00', '12:00', '도장 1차'), wl(B, 6, '09:00', '10:30', '줄눈 보수'), wl(B, 7, '13:00', '14:00', 'Primer 확인'), wl(B, 8, '09:00', '11:00', '청소')];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { h2: workHM(120 + 90) };
  }, { A, B });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlsearch-v507 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const ids = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .worklog-row .wkEdit')].map(b => b.dataset.id));
  const search = async q => { await page.locator('#modalRoot [data-wl-search]').fill(q); await page.waitForFunction(v => { const i = document.querySelector('#modalRoot [data-wl-search]'); return i && i.value === v && document.activeElement === i; }, q, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); };
  let copies = 0;
  const copyLines = async sel => { copies++; await page.locator('#modalRoot ' + sel).click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n'); };

  await test('① 찾기 칸 → 글자 든 줄만 · 합계 줄 · 이어 쓰기 · 복사·엑셀용·소계 · 팀 칩 · 수정 뒤 유지 · 새로 열면 비움 · 자료 불변 (WLSEARCH)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const box = await page.evaluate(() => { const i = document.querySelector('#modalRoot [data-wl-search]'); return i ? [i.getAttribute('placeholder'), Math.round(i.getBoundingClientRect().height)] : null; });
    assert.deepEqual(box, ['🔍 현장·메모·날짜·보고자 찾기', 44], 'WLSEARCH box');
    await search('줄눈');
    assert.deepEqual(await ids(), ['TEST_W3', 'TEST_W6'], 'WLSEARCH memo text ' + JSON.stringify(await ids()));
    assert.equal(await page.locator('#modalRoot [data-wl-search-sum]').textContent(), '🔍 “줄눈” 2줄 · 합계 ' + D.h2, 'search sum line');
    assert.deepEqual(await page.evaluate(() => { const i = document.querySelector('#modalRoot [data-wl-search]'); return [i.value, document.activeElement === i, i.selectionStart]; }), ['줄눈', true, 2], 'focus and caret kept');
    let L = await copyLines('[data-wl-copy]');
    assert.equal(L[0], '⏱ 작업시간 — 전체 · 🔍 줄눈 · 2줄', L[0]);
    L = await copyLines('[data-wl-copy-tsv]'); assert.equal(L.length, 3, 'TSV header + 2 rows');
    assert.match(await page.locator('#modalRoot [data-wl-subtotal] summary').textContent(), /현장별 소계 2곳/, 'subtotal follows the search');
    await search('primer'); assert.deepEqual(await ids(), ['TEST_W7'], 'case-insensitive');
    await search('상가'); assert.deepEqual(await ids(), ['TEST_W5', 'TEST_W6', 'TEST_W7', 'TEST_W8'], 'project name');
    await search('김타일'); assert.deepEqual(await ids(), ['TEST_W2'], 'team reporter');
    await search('');
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    await search('보고'); assert.deepEqual(await ids(), ['TEST_W2'], 'team chip ∩ search');
    await page.locator('#modalRoot [data-wl-filter=""]').click(); await page.waitForFunction(() => !document.querySelector('#modalRoot [data-wl-team-sum]'));
    assert.equal(await page.locator('#modalRoot [data-wl-search]').inputValue(), '보고', 'search kept when chips change');
    await page.locator('#modalRoot .wkEdit').first().click(); await page.locator('#wkSave').waitFor();
    await page.locator('#modalRoot .mfoot button', { hasText: '← 작업시간' }).click(); await page.locator('#modalRoot [data-wl-search]').waitFor();
    assert.equal(await page.locator('#modalRoot [data-wl-search]').inputValue(), '보고', 'search kept after edit → back');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.equal(await page.locator('#modalRoot [data-wl-search]').inputValue(), '', 'fresh open clears the search'); assert.equal((await ids()).length, 8);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 맞는 것 없으면 안내 · 7줄 이하면 칸 없음 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await search('없는말');
    assert.match(await page.locator('#modalRoot .modal').innerText(), /찾는 글자에 맞는 기록이 없어요/);
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(b => workView(b), B); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.equal(await page.locator('#modalRoot [data-wl-search]').count(), 0, 'no box for 4 rows');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlsearch-v507: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlsearch-v507', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

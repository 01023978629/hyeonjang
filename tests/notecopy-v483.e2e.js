/* v483 👷 팀 보고 노트 창 — [📋 보이는 보고 n건 글로 복사](개발_백로그 '팀 보고 노트 창 글로 복사'). 합성 자료만, 외부 쓰기 0.
   ① 칩 아래 [📋 보이는 보고 5건 글로 복사](44px) → 클립보드 글 = 머리줄 + 보이는 줄(최근 것부터, '날짜 상태 — 한 일 / 이슈: … (보고자 · 시간 · 사진)', 확인한 검수는 [확인함])
      · 고객 이름·전화 없음 · ⛔ 칩이면 그 1건만·머리줄에 칩 · 보고자 칩도 반영 · 알림 · 자료 불변 (COPY)
   ② 클립보드 API 가 막히면 예전 방식(execCommand)으로 · 보이는 줄이 0이면 단추 없음 · 보고 없는 현장엔 단추 없음 · 오류 0
   HJ_V483_BASELINE=<commit> 은 COPY 에서 실패해야 한다. HJ_V483_MUTATION=no-filter-copy(칩을 무시하고 전부 복사)도 COPY 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T23 둔산 크로바아파트 101동 1203호', EMPTY = 'TEST_T23 대흥동 상가 2층';
const MUT = process.env.HJ_V483_MUTATION || '';
let html = process.env.HJ_V483_BASELINE ? execFileSync('git', ['show', process.env.HJ_V483_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-filter-copy');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const rows=hjTeamReportNoteRows(p,filter);if(!rows.length)return '';";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "const rows=hjTeamReportNoteRows(p,{});if(!rows.length)return '';");
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
  const D = await page.evaluate(async ({ APT, EMPTY }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter, hours, photos, extra) => Object.assign({ key, status, workDate: ago(days), hours, done, issue, reporter, checklist: [], photos, at }, extra || {});
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8301', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(APT, [rep('TEST_R1', 'done', 3, '욕실 바닥 타일 철거', '', '김타일', 8, 2), rep('TEST_R2', 'review', 2, '벽 타일 1차', '줄눈 색 확인', '김타일', 2, 1), rep('TEST_R3', 'blocked', 1, '', '자재 미도착', '박설비', 0, 0),
      rep('TEST_R4', 'done', 5, '방수 1차', '', '박설비', 4, 0), rep('TEST_R5', 'review', 4, '배수구 위치 확인', '', '김타일', 1, 0, { ack: true, ackAt: ago(3) })]), proj(EMPTY, [])];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { d1: hjMdDow(ago(1)), d2: hjMdDow(ago(2)), d3: hjMdDow(ago(3)), d4: hjMdDow(ago(4)), d5: hjMdDow(ago(5)) };
  }, { APT, EMPTY });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notecopy-v483 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const copyBtn = () => page.evaluate(() => { const b = document.querySelector('#modalRoot #hjTeamNote [data-team-note-copy]'); return b ? [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)] : null; });
  const lastCopy = () => page.evaluate(() => window.__copied.at(-1) || '');
  const toastText = () => page.evaluate(() => document.getElementById('toast').textContent.trim());
  const L = {
    r3: `- ${D.d1} ⛔ 막힘 / 이슈: 자재 미도착 (박설비)`,
    r2: `- ${D.d2} 🔎 검수 요청 — 벽 타일 1차 / 이슈: 줄눈 색 확인 (김타일 · 2시간 · 사진 1장)`,
    r1: `- ${D.d3} ✅ 완료 — 욕실 바닥 타일 철거 (김타일 · 8시간 · 사진 2장)`,
    r5: `- ${D.d4} 🔎 검수 요청 — 배수구 위치 확인 (김타일 · 1시간) [확인함]`,
    r4: `- ${D.d5} ✅ 완료 — 방수 1차 (박설비 · 4시간)`
  };

  await test('① [📋 보이는 보고 5건 글로 복사] → 머리줄 + 보이는 줄 · 고객 정보 없음 · ⛔·보고자 칩 반영 · 알림 · 자료 불변 (COPY)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.deepEqual(await copyBtn(), ['📋 보이는 보고 5건 글로 복사', 44], 'COPY button');
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const all = await lastCopy();
    assert.equal(all, ['[' + APT + '] 팀 작업 보고 5건', L.r3, L.r2, L.r1, L.r5, L.r4].join('\n'), 'COPY all text:\n' + all);
    assert.doesNotMatch(all, /정테스트|010-|둔산동 *$/m, 'no customer name/phone');
    assert.match(await toastText(), /보고 5건을 글로 복사했어요/);
    await page.locator('#modalRoot [data-note-filter-status="blocked"]').click();
    assert.deepEqual(await copyBtn(), ['📋 보이는 보고 1건 글로 복사', 44]);
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 2);
    assert.equal(await lastCopy(), ['[' + APT + '] 팀 작업 보고 1건 · ⛔ 막힘', L.r3].join('\n'), 'COPY follows the status chip');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 3);
    assert.equal(await lastCopy(), ['[' + APT + '] 팀 작업 보고 3건 · 👤 김타일', L.r2, L.r1, L.r5].join('\n'), 'COPY follows the reporter chip');
    assert.match(await toastText(), /보고 3건을 글로 복사했어요/);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 클립보드가 막히면 예전 방식 · 보이는 줄 0이면 단추 없음 · 보고 없는 현장엔 단추 없음 · 오류 0', async () => {
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; window.__exec = []; const ex = document.execCommand.bind(document); document.execCommand = (c, ...a) => { window.__exec.push([c, (document.activeElement && document.activeElement.value) || (document.querySelector('body > textarea') || {}).value || '']); return true; }; window.__restoreExec = () => { document.execCommand = ex; }; });
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await page.locator('#modalRoot [data-team-note-copy]').click();
    await page.waitForFunction(() => window.__exec.length === 1);
    const ex = await page.evaluate(() => window.__exec[0]);
    assert.equal(ex[0], 'copy'); assert.match(ex[1], /^\[TEST_T23 둔산 크로바아파트 101동 1203호\] 팀 작업 보고 5건\n/, 'fallback copies the same text');
    assert.match(await toastText(), /보고 5건을 글로 복사했어요/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('body > textarea').length), 0, 'fallback textarea removed');
    await page.locator('#modalRoot [data-note-filter-status="blocked"]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    await page.locator('#modalRoot [data-team-note-empty]').waitFor();
    assert.equal(await copyBtn(), null, 'no visible rows → no button');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), EMPTY); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal(await copyBtn(), null, 'no reports → no button');
    await page.evaluate(() => { closeModal(true); window.__restoreExec(); });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notecopy-v483: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notecopy-v483', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

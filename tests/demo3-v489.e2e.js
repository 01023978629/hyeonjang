/* v489 데모 팀 보고 3건 — 노트 창 칩 시연(개발_백로그). 합성(데모) 자료만, 외부 쓰기 0.
   ① 데모에 들어가면 망원동 카페에 막힘 보고 1건(김 기사, 사흘 전, 지시 없이 '보고만') — 첫 화면 '⛔ 막힘 1건' 줄 '· 3일째' · 노트 창 칩
      '전부 3 · 🔎 1 · ⛔ 1 · ✅ 1' + '👤 모두 · 👤 박 반장 2 · 👤 김 기사 1' · ⛔ 칩 → 그 1건 · [📋 글로 복사] 3줄 · 알림 '팀 보고 3건' (DEMO3)
   ② 데모는 어디에도 저장되지 않음(appState 에 데모 보고 없음) · 오류 0
   HJ_V489_BASELINE=<commit> 은 DEMO3 에서 실패해야 한다. HJ_V489_MUTATION=no-blocked(막힘 보고를 안 넣음)도 DEMO3 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const CAFE = '망원동 카페';
const MUT = process.env.HJ_V489_MUTATION || '';
let html = process.env.HJ_V489_BASELINE ? execFileSync('git', ['show', process.env.HJ_V489_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-blocked');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "cafe.teamReports=[{key:'wr_demo_blocked'";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "cafe.__off=[{key:'wr_demo_blocked'");
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
  await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; aiOpsEnsureState().enabled = false; __mobileMode = true; applyMobileMode();
    window.__toasts = []; const t0 = toast; toast = m => { __toasts.push(String(m)); return t0(m); };
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); }; }, BOOT);
  async function test(name, fn) { await fn(); passed++; console.log('PASS demo3-v489 ' + name); }

  await test('① 막힘 보고 1건 — 첫 화면 ⛔ 줄 "· 3일째" · 노트 창 칩 · ⛔ 칩 · 글로 복사 3줄 · 알림 3건 (DEMO3)', async () => {
    await page.evaluate(async () => { await loadDemo(); });
    assert.match(await page.evaluate(() => __toasts.find(t => /데모 데이터 로드됨/.test(t)) || ''), /팀 보고 3건/, 'DEMO3 toast counts 3');
    const row = await page.evaluate(() => { const n = document.querySelector('#view [data-team-report-row="wr_demo_blocked"]'); return n ? n.innerText.replace(/\s+/g, ' ').trim() : null; });
    assert(row, 'DEMO3 blocked line on the dashboard');
    assert.match(row, /^⛔ 망원동 카페 — \d\d\/\d\d 베란다 배수구 부속 미도착 — 내일 오전 입고 예정 · 3일째 보기 확인함$/, row);
    assert.match(await page.locator('#view [data-team-report-pending]').innerText(), /⛔ 막힘 1건/);
    await page.evaluate(n => hjTeamReportNoteView(n), CAFE); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const chips = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-note-filter] button')].map(b => b.textContent.trim()));
    assert.deepEqual(chips, ['전부 3', '🔎 검수 요청 1', '⛔ 막힘 1', '✅ 완료 1', '⚠ 이슈 2', '🗓 최근 7일 2', '👤 모두', '👤 박 반장 2', '👤 김 기사 1'], 'DEMO3 chips ' + JSON.stringify(chips));   // v494 '⚠ 이슈' 칩 · v497 '🗓 최근 7일'(완료 보고는 2025년 날짜라 빠짐)
    await page.locator('#modalRoot [data-note-filter-status="blocked"]').click();
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => n.getAttribute('data-team-note'))), ['wr_demo_blocked']);
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const lines = (await page.evaluate(() => window.__copied[0])).split('\n');
    assert.equal(lines.length, 4, 'header + 3 lines'); assert.equal(lines[0], '[망원동 카페] 팀 작업 보고 3건');
    assert.match(lines[2], /⛔ 막힘 \/ 이슈: 베란다 배수구 부속 미도착 — 내일 오전 입고 예정 \(김 기사\)$/, lines[2]);
    await page.evaluate(() => closeModal(true));
  });

  await test('② 데모는 저장되지 않음 · 오류 0', async () => {
    assert.equal(await page.evaluate(() => state._demo === true), true);
    const stored = await page.evaluate(async () => { try { return JSON.stringify(await idbGetStrict('appState') || null); } catch (_) { return 'null'; } });
    assert.equal(/wr_demo_blocked/.test(stored), false, 'demo report not persisted');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`demo3-v489: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL demo3-v489', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

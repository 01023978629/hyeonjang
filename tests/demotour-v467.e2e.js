/* v467 🧭 데모 둘러보기 — 데모 첫 화면 맨 위 '이렇게 보세요' 5단계 접이식 안내(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 데모가 아니면 없고, 데모를 열면 첫 화면 맨 위(#dashboardTodo 앞)에 열린 채로 뜬다 · 5단계 · 단추 44px · 접으면 localStorage hj_demo_tour 로 기억돼 다시 그려도 접힌 채 · 앱 자료는 그대로(TOUR_CARD)
   ② 단추: 1 '찾기' → 검수 요청 줄 테두리, 2 → 완료보고서(팀 보고 사진 묶음 있음), 3 → 아파트 서류 4종 창, 4 → 월말 장부(🧾 2줄) · 390px 넘침 없음 · 오류 0
   ③ 5 '끝내기' → 데모 끝(새로 열림) → 카드 없음 · 저장본엔 데모가 없다
   HJ_V467_BASELINE=<commit> 은 TOUR_CARD 에서 실패해야 한다. HJ_V467_MUTATION=no-remember(접힘 저장 제거)도 TOUR_CARD 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V467_MUTATION || '';
let html = process.env.HJ_V467_BASELINE ? execFileSync('git', ['show', process.env.HJ_V467_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-remember');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = ' ontoggle="hjDemoTourToggle(this)"';
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
  async function boot() {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; aiOpsEnsureState().enabled = false; __mobileMode = true; applyMobileMode(); }, BOOT);
  }
  await boot();
  async function test(name, fn) { await fn(); passed++; console.log('PASS demotour-v467 ' + name); }
  const card = () => page.evaluate(() => { const d = document.querySelector('#view [data-demo-tour]'); if (!d) return null; return { open: d.open, first: document.getElementById('view').firstElementChild === d, steps: [...d.querySelectorAll('[data-demo-tour-step]')].map(li => li.innerText.replace(/\s+/g, ' ').trim()), btns: [...d.querySelectorAll('[data-demo-tour-go]')].map(b => [b.getAttribute('data-demo-tour-go'), Math.round(b.getBoundingClientRect().height)]), summaryH: Math.round(d.querySelector('summary').getBoundingClientRect().height), stored: localStorage.getItem('hj_demo_tour') }; });
  const close = () => page.evaluate(() => closeModal(true));

  await test('① 데모가 아니면 없음 → 데모 첫 화면 맨 위에 열린 5단계 카드 · 44px · 접힘 기억(localStorage) · 자료 불변 (TOUR_CARD)', async () => {
    assert.equal(await page.evaluate(() => !!document.querySelector('#view [data-demo-tour]') || hjDemoTourHtml() !== ''), false, 'no card outside the demo');
    await page.evaluate(async () => { await loadDemo(); });
    const c = await card();
    assert(c, 'TOUR_CARD present in the demo'); assert.equal(c.open, true, 'open by default'); assert.equal(c.first, true, 'first thing on the dashboard');
    assert.equal(c.steps.length, 5, JSON.stringify(c.steps)); assert.match(c.steps[0], /^1\. 🔎 "검수 요청 1건" 줄/); assert.match(c.steps[4], /^5\. 🚪 데모 끝내기/);
    assert.deepEqual(c.btns.map(b => b[0]), ['pending', 'report', 'aptdocs', 'ledger', 'exit']); assert(c.btns.every(b => b[1] >= 44) && c.summaryH >= 44, 'tap targets ' + JSON.stringify(c.btns) + ' ' + c.summaryH);
    const before = await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
    await page.locator('#view [data-demo-tour] summary').click();
    await page.waitForFunction(() => !document.querySelector('#view [data-demo-tour]').open);
    await page.waitForFunction(() => localStorage.getItem('hj_demo_tour') === '0', null, { timeout: 3000 }).catch(() => {});   // toggle 이벤트는 다음 틱
    assert.equal(await page.evaluate(() => localStorage.getItem('hj_demo_tour')), '0', 'TOUR_CARD collapse remembered');
    await page.evaluate(() => render());
    const again = await card(); assert.equal(again.open, false, 'stays collapsed after re-render');
    await page.locator('#view [data-demo-tour] summary').click(); await page.waitForFunction(() => document.querySelector('#view [data-demo-tour]').open);
    await page.waitForFunction(() => localStorage.getItem('hj_demo_tour') === '1', null, { timeout: 3000 }).catch(() => {});
    assert.equal(await page.evaluate(() => localStorage.getItem('hj_demo_tour')), '1', 'reopen remembered');
    assert.equal(await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); }), before, 'app data unchanged');
  });

  await test('② 단추 1~4 가 그 자리를 연다 · 390px 넘침 없음', async () => {
    await page.locator('#view [data-demo-tour-go="pending"]').click();
    assert.match(await page.evaluate(() => document.querySelector('#view [data-team-report-pending]').style.outline), /solid/, 'pending line highlighted');
    await page.locator('#view [data-demo-tour-go="report"]').click(); await page.locator('#modalRoot #rpWorks').waitFor();
    assert.equal(await page.locator('#modalRoot [data-rp-teamphotos]').count(), 1, 'report with team photo bundles'); await close();
    await page.locator('#view [data-demo-tour-go="aptdocs"]').click(); await page.locator('#modalRoot #hjAptDocs').waitFor(); await close();
    await page.locator('#view [data-demo-tour-go="ledger"]').click(); await page.locator('#modalRoot .expRow').first().waitFor();
    assert.equal(await page.locator('#modalRoot .expRow').count(), 2); await close();
    const ov = await page.evaluate(() => { const d = document.querySelector('#view [data-demo-tour]'); return { doc: document.documentElement.scrollWidth - innerWidth, box: d.scrollWidth - d.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await test('③ 5 끝내기 → 데모 끝(새로 열림) → 카드 없음 · 저장본에 데모 없음', async () => {
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('#view [data-demo-tour-go="exit"]').click()]);
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
    const after = await page.evaluate(async () => ({ demo: !!state._demo, card: !!document.querySelector('#view [data-demo-tour]'), projects: state.projects.length, stored: ((await idbGet('appState')) || {}).projects || [] }));
    assert.deepEqual([after.demo, after.card, after.projects, after.stored.length], [false, false, 0, 0], JSON.stringify(after));
    assert.deepEqual(errors, []);
  });

  console.log(`demotour-v467: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL demotour-v467', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

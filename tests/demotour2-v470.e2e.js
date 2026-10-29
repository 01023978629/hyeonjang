/* v470 🧭 데모 둘러보기 — 본 단계 ✓ 표시(개발_백로그 '데모 둘러보기 — 단계 완료 표시'). 합성 자료만, 외부 쓰기 0.
   ① 단계 단추를 누르면 그 줄에 ✓·'다시', 요약에 '봤어요 n/4' — 이 기기 localStorage hj_demo_tour_done, 다시 그려도 유지, 앱 자료 불변 (TOUR_DONE)
   ② [끝내기] → 데모 끝 → 표식 지워짐 · 다시 데모에 들어가도 ✓ 없음(들어갈 때도 지움) · 오류 0
   HJ_V470_BASELINE=<commit> 은 TOUR_DONE 에서 실패해야 한다. HJ_V470_MUTATION=no-mark(장부 단추가 표식을 안 남김)도 TOUR_DONE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V470_MUTATION || '';
let html = process.env.HJ_V470_BASELINE ? execFileSync('git', ['show', process.env.HJ_V470_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-mark');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(go==='ledger'){hjDemoTourMarkDone(go);expenseLedger(";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "if(go==='ledger'){expenseLedger(");
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
  async function test(name, fn) { await fn(); passed++; console.log('PASS demotour2-v470 ' + name); }
  const card = () => page.evaluate(() => { const d = document.querySelector('#view [data-demo-tour]'); if (!d) return null; return { done: [...d.querySelectorAll('[data-demo-tour-step][data-done]')].map(li => li.getAttribute('data-demo-tour-step')), btns: [...d.querySelectorAll('[data-demo-tour-go]')].map(b => [b.getAttribute('data-demo-tour-go'), b.textContent.trim()]), seen: d.querySelector('[data-demo-tour-seen]').textContent.trim(), checks: [...d.querySelectorAll('[data-demo-tour-step]')].map(li => /✓/.test(li.innerText)), stored: localStorage.getItem('hj_demo_tour_done') }; });
  const close = () => page.evaluate(() => closeModal(true));

  await test('① 단추를 누른 단계에 ✓·"다시"·"봤어요 n/4" · localStorage 로 유지 · 앱 자료 불변 (TOUR_DONE)', async () => {
    await page.evaluate(async () => { await loadDemo(); });
    let c = await card(); assert(c, 'card'); assert.deepEqual(c.done, [], 'nothing seen yet'); assert.equal(c.stored, null);
    const before = await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
    await page.locator('#view [data-demo-tour-go="ledger"]').click(); await page.locator('#modalRoot .expRow').first().waitFor(); await close();
    c = await card();
    assert.deepEqual(c.done, ['5'], 'TOUR_DONE step 5 (ledger) marked ' + JSON.stringify(c)); assert.deepEqual(c.checks, [false, false, false, false, true, false]);   // v495 부터 6단계(셋째 '팀 보고 노트')
    assert.deepEqual(c.btns[4], ['ledger', '다시']); assert.match(c.seen, /^봤어요 1\/5 · 6단계/); assert.equal(c.stored, '["ledger"]');
    await page.locator('#view [data-demo-tour-go="pending"]').click();
    c = await card(); assert.deepEqual(c.done, ['1', '5']); assert.match(c.seen, /봤어요 2\/5/);
    await page.evaluate(() => render());
    c = await card(); assert.deepEqual(c.done, ['1', '5'], 'kept after re-render'); assert.equal(c.stored, '["ledger","pending"]');
    assert.equal(await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); }), before, 'app data unchanged');
  });

  await test('② [끝내기] → 표식 지워짐 · 새 데모엔 ✓ 없음 · 오류 0', async () => {
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('#view [data-demo-tour-go="exit"]').click()]);
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); aiOpsEnsureState().enabled = false; }, BOOT);
    assert.equal(await page.evaluate(() => localStorage.getItem('hj_demo_tour_done')), null, 'cleared on exit');
    await page.evaluate(() => { try { localStorage.setItem('hj_demo_tour_done', '["report"]'); } catch (_) {} });   // 지난 데모의 흔적이 남아 있더라도
    await page.evaluate(async () => { await loadDemo(); });
    const c = await card(); assert.deepEqual(c.done, [], 'entering the demo clears old marks'); assert.equal(c.stored, null);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`demotour2-v470: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL demotour2-v470', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

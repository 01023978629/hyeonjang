/* Demo exit must remain a real clickable control beneath the stale-tab warning. No business data or external network. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html', mutation = process.env.HJ_DEMO_BANNER_MUTATION || '';
let browser;
async function boot(page) {
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone]));
}
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
  page.setDefaultTimeout(9000); page.on('pageerror', e => errors.push(String(e)));
  await ctx.route('https://**/*', r => r.abort());
  await ctx.route(APP, route => {
    let source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const from = "bar.style.top=(warn?warn.getBoundingClientRect().bottom:0)+'px';";
    if (mutation) { assert.equal(source.split(from).length - 1, 1, 'unique positioning anchor'); source = source.replace(from, mutation === 'overlay-exit' ? "bar.style.top='0px';" : "bar.style.top=(warn?warn.getBoundingClientRect().bottom:0)+'px';__tabStale=false;"); }
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: source });
  });
  await ctx.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  try {
    await page.goto(APP, { waitUntil: 'domcontentloaded' }); await boot(page);
    await page.evaluate(() => { clearTimeout(__idbSaveTimer); state._demo = true; state.dirty = false; hjDemoBarSync(); __tabStale = true; __tabBanner('TEST 다른 탭이 최근에 저장했습니다 — 자동저장은 멈춘 채 최신 자료를 확인하세요.'); });
    async function protectedAndClickable() {
      return page.evaluate(() => {
        const b = document.getElementById('hjDemoExit'), bar = document.getElementById('hjDemoBar').getBoundingClientRect(), warn = document.getElementById('hjTabWarn').getBoundingClientRect(), r = b.getBoundingClientRect();
        return { stale: __tabStale, separated: bar.top >= warn.bottom, clickable: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b, fits: document.documentElement.scrollWidth <= innerWidth };
      });
    }
    assert.deepEqual(await protectedAndClickable(), { stale: true, separated: true, clickable: true, fits: true });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.waitForFunction(() => document.getElementById('hjDemoBar').getBoundingClientRect().top >= document.getElementById('hjTabWarn').getBoundingClientRect().bottom);
    assert.deepEqual(await protectedAndClickable(), { stale: true, separated: true, clickable: true, fits: true });
    await page.getByRole('button', { name: '경고 닫기', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => ({ stale: __tabStale, warning: !!document.getElementById('hjTabWarn'), top: document.getElementById('hjDemoBar').getBoundingClientRect().top })), { stale: true, warning: false, top: 0 });
    await page.evaluate(() => __tabBanner('TEST 경고를 다시 열어도 데모 종료가 가려지지 않습니다.'));
    assert.deepEqual(await protectedAndClickable(), { stale: true, separated: true, clickable: true, fits: true });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#hjDemoExit')]); await boot(page);
    assert.equal(await page.evaluate(() => !!state._demo || !!document.getElementById('hjDemoBar')), false);
    assert.deepEqual(errors, []); console.log('PASS warning fence, resize, close/reopen and an unforced Demo Exit click');
  } finally { await ctx.close(); await browser.close(); }
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('node:child_process'); let caught = 0;
  for (const mode of ['overlay-exit', 'clear-fence']) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_DEMO_BANNER_MUTATION: mode }, timeout: 180000, encoding: 'utf8' });
    const detected = r.status === 1 && /AssertionError/.test(r.stdout + r.stderr) && !/unique positioning anchor/.test(r.stdout + r.stderr);
    console.log((detected ? 'DETECTED ' : 'SURVIVED ') + mode); if (detected) caught++;
  }
  console.log(caught + '/2 demo banner mutations detected'); process.exitCode = caught === 2 ? 0 : 1;
} else run().catch(async e => { console.error(e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });

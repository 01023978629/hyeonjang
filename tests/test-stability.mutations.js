/* Explicit test-protection audit. Only synthetic HTML is mutated in memory. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { waitForTouchLayout } = require('./test-stability-fixture');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const root = path.join(__dirname, '..');
const cases = [
  ['portal-apply-notify', 'portal-key.e2e.js', /FAIL\s+⑪/],
  ['portal-idb-reject', 'portal-key.e2e.js', /FAIL\s+⑪/],
  ['warranty-stale-photo', 'warranty-v313.e2e.js', /FAIL\s+⑤\(⑦\)/],
  ['online-flush', 'office-intake-auto-sync.e2e.js', /online keeps its queue flush/],
  ['boot-wait', 'test-stability.unit.js', /completed boot leaves exactly the online-triggered flush/],
  ['field-focus', 'ui-feedback.e2e.js', /FAIL\s+③ 거래처 이름 칸[\s\S]*거래처 이름: 초점이 그 칸으로 가지 않았다/],
  ['small-touch', 'mobile-operations.e2e.js', /44px touch target:[^\n]*"height":43[,}]/]
];

// 실제 앱 CSS의 전환을 17ms에 붙잡는다. 측정 대기가 전환 완료까지
// 남아 있어야 하며, 43px은 대기 완료 후에도 44px로 보정하면 안 된다.
async function touchSettlementAudit() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  let page, waiting;
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.abort());
    page = await context.newPage(); page.setDefaultTimeout(12000);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const style = html.match(/<style>([\s\S]*?)<\/style>/);
    assert(style, 'actual app stylesheet is present');
    await page.setContent('<style>' + style[1] + '</style><button class="ghost" id="stabilityTouch" style="position:absolute;top:502.25px;left:12.5px;min-height:44px">가상 버튼</button>');
    const partial = await page.evaluate(() => {
      const button = document.getElementById('stabilityTouch');
      void getComputedStyle(button).transform;
      button.style.transform = 'translateY(-1px)';
      const transition = button.getAnimations().find(animation => animation.transitionProperty === 'transform');
      if (!transition) throw new Error('actual transform transition missing');
      transition.pause(); transition.currentTime = 17;
      return { css: getComputedStyle(button).height, layout: button.offsetHeight, measured: button.getBoundingClientRect().height, paused: transition.playState === 'paused' };
    });
    assert.deepEqual([partial.css, partial.layout, partial.paused], ['44px', 44, true]);
    let settled = false;
    waiting = waitForTouchLayout(page, '#stabilityTouch').then(() => { settled = true; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(settled, false, 'touch layout wait stays pending during the actual paused transition');
    await page.evaluate(() => document.getElementById('stabilityTouch').getAnimations().forEach(animation => animation.finish()));
    await waiting;
    assert.equal((await page.locator('#stabilityTouch').boundingBox()).height, 44, 'completed actual transform retains strict 44px');
    await page.locator('#stabilityTouch').evaluate(button => { button.style.minHeight = '43px'; });
    await waitForTouchLayout(page, '#stabilityTouch');
    assert.equal((await page.locator('#stabilityTouch').boundingBox()).height, 43, 'layout waiting never rounds a real 43px target up to 44px');
    console.log('BASELINE touch settlement: partial=' + partial.measured + ', settled=44, subminimum=43');
  } finally {
    if (page && !page.isClosed()) await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
    if (waiting) await Promise.allSettled([waiting]);
    await browser.close();
  }
}
const checkServer = () => new Promise((resolve, reject) => {
  const request = http.get('http://127.0.0.1:8299/index.html', response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; });
    response.on('end', () => {
      if (response.statusCode !== 200) return resolve(false);
      const normalize = text => text.replace(/\r\n/g, '\n');
      if (normalize(body) !== normalize(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) return reject(new Error('8299 serves a different checkout; leave that server untouched'));
      resolve(true);
    });
  });
  request.setTimeout(1500, () => request.destroy()); request.on('error', () => resolve(false));
});
function execute(file, mode) {
  const result = spawnSync(process.execPath, [path.join('tests', file)], { cwd: root, env: { ...process.env, HJ_TEST_STABILITY_MUTATION: mode }, encoding: 'utf8', timeout: 180000 });
  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  assert(!result.error && !result.signal, 'test execution error: ' + file);
  assert(!/mutation anchor missing|unknown stability mutation|Cannot find module|ECONNREFUSED|Executable doesn't exist|TimeoutError|timed out/i.test(output), 'test infrastructure error: ' + file + '\n' + output);
  return { status: result.status, output };
}
(async () => {
  let server;
  try {
    if (!await checkServer()) {
      server = spawn(process.execPath, ['tests/static-server.js'], { cwd: root, stdio: 'ignore' });
      let ready = false;
      for (let i = 0; i < 30 && !ready; i++) { await new Promise(resolve => setTimeout(resolve, 100)); ready = await checkServer(); }
      assert(ready, 'synthetic test server unavailable');
    }
    await touchSettlementAudit();
    for (const file of new Set(cases.map(row => row[1]))) {
      const result = execute(file, '');
      assert.equal(result.status, 0, 'baseline failed: ' + file + '\n' + result.output);
      console.log('BASELINE ' + file);
    }
    for (const [mode, file, reason] of cases) {
      const result = execute(file, mode);
      assert.equal(result.status, 1, 'protection removal escaped detection: ' + mode + '\n' + result.output);
      assert(reason.test(result.output), 'not the intended behavioral failure: ' + mode + '\n' + result.output);
      console.log('DETECTED ' + mode);
    }
    console.log('test-stability mutations: ' + cases.length + '/' + cases.length + ' DETECTED');
  } finally { if (server) server.kill(); }
})().catch(error => { console.error('FAIL stability mutation audit:', error.stack); process.exitCode = 1; });

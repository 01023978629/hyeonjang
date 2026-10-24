/* v474 🧭 데모 둘러보기 카드 — PC 두 칸(개발_백로그 '데모 둘러보기 PC 두 칸'). 합성(데모) 자료만, 외부 쓰기 0.
   ① 1280px PC 모드: 1·2단계가 같은 줄에 나란히(두 칸), 5단계(끝내기)는 한 줄 가득 · 단추 44px · 카드 넘침 없음 (TOUR_2COL)
   ② 390px 모바일 모드: 한 칸 그대로(모든 단계가 세로로) · 오류 0
   HJ_V474_BASELINE=<commit> 은 TOUR_2COL 에서 실패해야 한다. HJ_V474_MUTATION=one-col(두 칸 규칙 제거)도 TOUR_2COL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V474_MUTATION || '';
let html = process.env.HJ_V474_BASELINE ? execFileSync('git', ['show', process.env.HJ_V474_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'one-col');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'body:not(.mobile-mode) #view [data-demo-tour] ol{grid-template-columns:1fr 1fr;gap:6px 18px}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0 };
  async function open(width, height, mobile) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async ({ keys, mobile }) => { await Promise.all(keys.map(key => window[key])); aiOpsEnsureState().enabled = false; __mobileMode = !!mobile; applyMobileMode(); await loadDemo(); }, { keys: BOOT, mobile });
    await page.locator('#view [data-demo-tour]').waitFor();
    return { context, page };
  }
  const geo = page => page.evaluate(() => { const d = document.querySelector('#view [data-demo-tour]'); const li = [...d.querySelectorAll('[data-demo-tour-step]')].map(n => { const r = n.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; });
    return { li, btns: [...d.querySelectorAll('[data-demo-tour-go]')].map(b => Math.round(b.getBoundingClientRect().height)), ov: d.scrollWidth - d.clientWidth, doc: document.documentElement.scrollWidth - innerWidth, card: Math.round(d.getBoundingClientRect().width) }; });
  async function test(name, fn) { await fn(); passed++; console.log('PASS tour2col-v474 ' + name); }

  await test('① 1280 PC: 1·2단계 나란히(두 칸) · 5단계 한 줄 가득 · 44px · 넘침 없음 (TOUR_2COL)', async () => {
    const { context, page } = await open(1280, 860, false);
    const g = await geo(page);
    assert.equal(g.li.length, 5);
    assert.equal(g.li[0].t, g.li[1].t, 'TOUR_2COL steps 1 and 2 share a row ' + JSON.stringify(g.li)); assert(g.li[1].l > g.li[0].l + 100, 'TOUR_2COL step 2 sits to the right');
    assert.equal(g.li[2].t, g.li[3].t, 'steps 3 and 4 share a row'); assert(g.li[4].t > g.li[3].t, 'step 5 below'); assert(g.li[4].w > g.li[0].w * 1.8, 'step 5 spans both columns ' + JSON.stringify(g.li));
    assert(g.btns.every(h => h >= 44), 'tap targets ' + JSON.stringify(g.btns)); assert(g.ov <= 1 && g.doc <= 1, 'overflow ' + JSON.stringify(g));
    await context.close();
  });

  await test('② 390 모바일: 한 칸(세로) 그대로 · 오류 0', async () => {
    const { context, page } = await open(390, 800, true);
    const g = await geo(page);
    for (let i = 1; i < 5; i++) assert(g.li[i].t > g.li[i - 1].t, 'single column on the phone ' + JSON.stringify(g.li));
    assert(g.btns.every(h => h >= 44)); assert(g.ov <= 1 && g.doc <= 1, 'overflow ' + JSON.stringify(g));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`tour2col-v474: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL tour2col-v474', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

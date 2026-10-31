/* v540 🧪 데모 영수증은 늘 '이번 달' 안 — 매달 1~3일엔 데모 영수증(사흘 전·하루 전)이 지난달로 넘어가 둘러보기 5단계 [월말 장부](이번 달)가 비어 있었다.
   11/1 00:15(한국 시각)에 돈 CI 에서 demo-v462·demotour-v467·demotour2-v470 이 같이 떨어져 드러났다(v536 기준선도 그 시각엔 똑같이 떨어짐). 합성 자료만, 외부 쓰기 0.
   ① 시계를 1일·2일·3일·보통 날(20일)·해 바뀐 2일로 바꿔 데모를 열면: 영수증 지출 2건이 모두 이번 달 안이고 오늘보다 늦지 않다.
      지난달로 넘어갈 날짜만 이번 달 1일로 당기고, 보통 날엔 예전 그대로 사흘 전·하루 전이다. 영수증 파일 이름의 날짜 = 지출 날짜 (DEMO_MONTH)
   ② 1일(폰 폭)에 둘러보기 5단계 [월말 장부]를 누르면 🧾 두 줄 · 데모 자료는 기기에 저장되지 않는다 (TOUR_LEDGER)
   ③ 소스·핀 3곳(v540 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V540_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V540_MUTATION=no-clamp(이번 달로 당기는 줄을 빼면)도 ① 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V540_MUTATION || '';
let html = process.env.HJ_V540_BASELINE ? execFileSync('git', ['show', process.env.HJ_V540_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-clamp');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "return x.slice(0,7)===t.slice(0,7)?x:t.slice(0,8)+'01';";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'return x;');
}

// [시계(한국 시각), 한밭철물(사흘 전) 날짜, SK주유소(하루 전) 날짜]
const CASES = [
  ['2026-11-01T09:00:00+09:00', '2026-11-01', '2026-11-01'],
  ['2026-11-02T09:00:00+09:00', '2026-11-01', '2026-11-01'],
  ['2026-11-03T21:30:00+09:00', '2026-11-01', '2026-11-02'],
  ['2026-11-20T09:00:00+09:00', '2026-11-17', '2026-11-19'],
  ['2027-01-02T00:30:00+09:00', '2027-01-01', '2027-01-01']
];

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0 };
  async function open(when) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
    await page.clock.setFixedTime(new Date(when));   // 시계는 멈추고 타이머는 돈다
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; aiOpsEnsureState().enabled = false; __mobileMode = true; applyMobileMode(); }, BOOT);
    return { context, page };
  }
  const receipts = page => page.evaluate(async () => {
    await loadDemo();
    const today = localDate();
    return { today, rows: state.expenses.filter(e => e.src === 'receipt').map(e => { const f = state.files.find(x => 'k:' + fileKey(x) === e.fileId); return { vendor: e.vendor, date: e.date, file: f ? f.name : '' }; }) };
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS demomonth-v540 ' + name); }

  await test('① 1·2·3일·20일·해 바뀐 2일 — 데모 영수증 2건이 이번 달 안, 오늘보다 늦지 않음, 보통 날은 사흘 전·하루 전 그대로, 파일 이름 날짜 = 지출 날짜 (DEMO_MONTH)', async () => {
    for (const [when, hanbat, sk] of CASES) {
      const { context, page } = await open(when);
      const r = await receipts(page);
      await context.close();
      assert.equal(r.today, when.slice(0, 10), 'the clock is pinned ' + JSON.stringify(r));
      const by = Object.fromEntries(r.rows.map(x => [x.vendor, x]));
      assert.deepEqual(r.rows.map(x => x.vendor).sort(), ['SK주유소', '한밭철물'], JSON.stringify(r));
      assert(r.rows.every(x => x.date.slice(0, 7) === r.today.slice(0, 7) && x.date <= r.today), when + ' receipts stay in this month and not in the future ' + JSON.stringify(r.rows));
      assert.deepEqual([by['한밭철물'].date, by['SK주유소'].date], [hanbat, sk], when + ' dates ' + JSON.stringify(r.rows));
      assert(r.rows.every(x => x.file.startsWith('영수증_' + x.date.replace(/-/g, '') + '_' + x.vendor + '_')), 'file name date follows the expense date ' + JSON.stringify(r.rows));
    }
  });

  await test('② 1일 폰 — 둘러보기 5단계 [월말 장부]에 🧾 두 줄 · 데모 자료는 기기에 저장 안 됨 (TOUR_LEDGER)', async () => {
    const { context, page } = await open(CASES[0][0]);
    await page.evaluate(async () => { await loadDemo(); });
    await page.locator('#view [data-demo-tour-go="ledger"]').click();
    await page.locator('#modalRoot .expRow').first().waitFor();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .expRow')].map(r => ({ text: r.innerText.replace(/\s+/g, ' '), rc: !!r.querySelector('[data-rc-view]') })));
    assert.equal(rows.length, 2, JSON.stringify(rows));
    assert(rows.every(r => r.rc) && rows.some(r => /한밭철물/.test(r.text)) && rows.some(r => /SK주유소/.test(r.text)), JSON.stringify(rows));
    const stored = await page.evaluate(async () => { const s = await idbGet('appState'); return s && Array.isArray(s.expenses) ? s.expenses.filter(e => e.src === 'receipt' && /한밭철물|SK주유소/.test(e.vendor || '')).length : 0; });
    assert.equal(stored, 0, 'demo receipts are not stored on the device');
    await context.close();
  });

  await test('③ 소스·핀 3곳(v540 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 540, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('demomonth-v540: ' + passed + '/3 PASS; synthetic data; clock pinned; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL demomonth-v540', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

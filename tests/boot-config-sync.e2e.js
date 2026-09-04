/* boot-config-sync.e2e.js — 부팅 설정 읽기와 이후 설정 변경의 순서 (Playwright)

   2026-09-03 v251 배포 게이트 실패 원인: officeOpsBoot → commercialApprovalBoot 가 IndexedDB 에서
   상업 승인 url/token 을 비동기로 읽어 __commercialApproval 에 넣는데, 이 읽기가 늦으면
   __hjRestoreDone 뒤에 넣은 값(검사 모의값·설정 화면 값)을 저장값('')으로 덮어 승인 버튼이 잠겼다.
   apt-commercial-ui 두 탭 경합 검사가 CI 부하에서만 이 창에 걸렸다(1/4 재현).

     ① 앱은 부팅 읽기 완료 promise(window.__hjOfficeOpsBootDone)를 노출한다
     ② 읽기가 붙들려 있는 동안 그 promise 는 끝나지 않는다(가짜 완료가 아니다)
     ③ 읽기가 끝나면 promise 가 풀리고, 그 뒤에 넣은 __commercialApproval 값은 덮이지 않는다
     ④ 붙들린 읽기가 늦게 끝나도 부팅 읽기가 실패(throw)하지 않는다 — pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {}
    // 부팅의 commercial_approval_token 읽기를 검사가 풀어 줄 때까지 붙든다(진짜 IndexedDB 요청 대신 가짜 요청)
    const native = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      if (key === 'commercial_approval_token' && !window.__bootHeld) {
        window.__bootHeld = true;
        const fake = { result: undefined, onsuccess: null, onerror: null };
        window.__releaseBoot = () => { if (fake.onsuccess) fake.onsuccess({ target: fake }); };
        return fake;
      }
      return native.call(this, key);
    };
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__bootHeld);
  await page.evaluate(() => Promise.resolve(window.__hjRestoreDone));

  // ① promise 노출
  const exposed = await page.evaluate(() => typeof window.__hjOfficeOpsBootDone === 'object' && !!window.__hjOfficeOpsBootDone && typeof window.__hjOfficeOpsBootDone.then === 'function');
  assert(exposed, '① window.__hjOfficeOpsBootDone must be a promise');

  // ② 읽기가 붙들린 동안에는 끝나지 않는다
  const early = await page.evaluate(() => Promise.race([window.__hjOfficeOpsBootDone.then(() => 'settled'), new Promise(r => setTimeout(() => r('pending'), 600))]));
  assert(early === 'pending', '② boot promise must stay pending while the token read is held, got ' + early);

  // ③ 풀어 주면 끝나고, 그 뒤에 넣은 값은 덮이지 않는다
  await page.evaluate(() => { window.__releaseBoot(); });
  const settled = await page.evaluate(() => Promise.race([window.__hjOfficeOpsBootDone.then(() => 'settled'), new Promise(r => setTimeout(() => r('pending'), 3000))]));
  assert(settled === 'settled', '③ boot promise must settle after the read completes, got ' + settled);
  const kept = await page.evaluate(async () => {
    __commercialApproval.url = 'https://commercial.example/exec'; __commercialApproval.token = 'after-boot-token';
    await new Promise(r => setTimeout(r, 400));
    return { url: __commercialApproval.url, token: __commercialApproval.token };
  });
  assert(kept.url === 'https://commercial.example/exec' && kept.token === 'after-boot-token', '③ values set after boot must survive: ' + JSON.stringify(kept));

  // ④ pageerror 0
  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));

  console.log('PASS  boot-config-sync: 부팅 읽기 완료 promise 노출·붙들림·해제 뒤 설정 보존·pageerror 0');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

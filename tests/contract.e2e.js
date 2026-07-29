/* contract.e2e.js — 전자계약 안전 모드·실발송 확인 회귀 테스트
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
// 다른 테스트와 같은 폴백 — 이게 없어서 이 테스트만 조용히 실행되지 않고 있었다(MODULE_NOT_FOUND).
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // 종료된 Fly 서버는 기본값·입력 UI 어디에도 노출하지 않고 준비 안내만 보인다.
  await page.evaluate(() => { __contract.url = ''; __contract.token = ''; openGdriveSetup(); });
  await page.getByText('전자계약 — Apps Script 이전 준비 중').waitFor();
  assert(await page.locator('#ctUrl').count() === 0, '종료된 Fly 계약 서버 입력 UI가 노출됨');
  assert(await page.getByText('전자계약 — Apps Script 이전 준비 중').count() === 1, 'Apps Script 이전 준비 안내 누락');
  await page.evaluate(() => closeModal());

  // 과거 주소·토큰이 기기에 남아 있어도 기능 잠금이 우선하며 네트워크 발송을 하지 않는다.
  const lockedResult = await page.evaluate(async () => {
    __contract.url = 'https://example.invalid';
    __contract.token = 'device-only-token';
    const p = { name: '테스트 현장', phases: ['욕실'], customer: { name: '홍길동', phone: '010-1234-5678' } };
    window.__ctCalls = [];
    window.fetch = async function (url) { window.__ctCalls.push(String(url)); throw new Error('잠금 상태에서 호출되면 안 됨'); };
    await contractSend(p, 1100000);
    return {
      calls: window.__ctCalls,
      ready: contractReady(),
      logCount: (p.contractLog || []).length,
      flyInSource: document.documentElement.innerHTML.includes('manmool-contract.fly.dev')
    };
  });
  assert(lockedResult.ready === false, 'Apps Script 이전 전 계약 기능이 활성화됨');
  assert(lockedResult.calls.length === 0, '잠금 상태에서 네트워크 요청 발생');
  assert(lockedResult.logCount === 0, '잠금 상태에서 계약 발송 이력 생성');
  assert(lockedResult.flyInSource === false, '종료된 Fly 주소가 화면 소스에 남음');
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  종료된 Fly 주소·입력 UI 제거');
  console.log('PASS  Apps Script 이전 준비 안내');
  console.log('PASS  준비 중 네트워크 발송·이력 생성 0');
  console.log('PASS  pageerror 0');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

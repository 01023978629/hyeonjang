/* contract.e2e.js — 전자계약 안전 모드·실발송 확인 회귀 테스트
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const { chromium } = require('playwright');
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // 설정에는 배포된 서버 주소가 기본으로 채워지고 토큰은 소스에 없다.
  await page.evaluate(() => { __contract.url = ''; __contract.token = ''; openGdriveSetup(); });
  await page.waitForSelector('#ctUrl');
  assert(await page.inputValue('#ctUrl') === 'https://manmool-contract.fly.dev', '기본 서버 주소 누락');
  await page.evaluate(() => closeModal());

  // Mock 안전 모드는 계약만 만들고 "발송됨"으로 오표시하지 않으며 서명 링크를 제공한다.
  const mockResult = await page.evaluate(async () => {
    __contract.url = 'https://manmool-contract.fly.dev';
    __contract.token = 'device-only-token';
    const p = { name: '테스트 현장', phases: ['욕실'], customer: { name: '홍길동', phone: '010-1234-5678' } };
    window.__ctCalls = [];
    window.fetch = async function (url, opt) {
      window.__ctCalls.push({ url: String(url), body: opt && opt.body });
      if (String(url).endsWith('/healthz')) return { ok: true, json: async () => ({ ok: true, live: false }) };
      return { ok: true, status: 200, json: async () => ({
        contractNo: 'MM-TEST', contractId: 'c1', provider: 'mock',
        signPath: '/sign#t=test-token', delivery: { status: 'SENT' }
      }) };
    };
    await contractSend(p, 1100000);
    return {
      calls: window.__ctCalls,
      title: document.querySelector('#modalRoot h3,#modalRoot h2')?.textContent || '',
      link: document.getElementById('ctSignLink')?.value || '',
      status: p.contractLog && p.contractLog[0] && p.contractLog[0].status
    };
  });
  assert(mockResult.calls.some(x => x.url.endsWith('/healthz')), '발송 전 서버 상태 확인 누락');
  assert(mockResult.calls.some(x => x.url.endsWith('/api/contracts/quick-send')), 'quick-send 호출 누락');
  assert(mockResult.link === 'https://manmool-contract.fly.dev/sign#t=test-token', '서명 링크 조합 오류');
  assert(mockResult.status === 'LINK_CREATED', 'Mock를 실제 발송으로 기록함');

  // 실제 발송 모드에서는 사용자가 확인을 취소하면 quick-send를 호출하지 않는다.
  await page.evaluate(() => closeModal());
  page.once('dialog', d => d.dismiss());
  const liveCalls = await page.evaluate(async () => {
    const p = { name: '실발송 테스트', phases: [], customer: { name: '김고객', phone: '010-1111-2222' } };
    window.__ctLiveCalls = [];
    window.fetch = async function (url) {
      window.__ctLiveCalls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ ok: true, live: true }) };
    };
    await contractSend(p, 500000);
    return window.__ctLiveCalls;
  });
  assert(liveCalls.length === 1 && liveCalls[0].endsWith('/healthz'), '확인 취소 뒤 실제 발송 호출됨');
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  배포 서버 주소 기본값');
  console.log('PASS  Mock 안전 모드 링크 생성·발송 오표시 방지');
  console.log('PASS  실발송 전 사용자 확인 취소');
  console.log('PASS  pageerror 0');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

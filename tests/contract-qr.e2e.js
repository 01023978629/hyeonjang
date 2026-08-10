/* 전자계약 설정 QR — # 조각 즉시 제거, 확인 1회 뒤 기기 저장 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const data = { v: 1, url: 'https://script.google.com/macros/s/AKfyQRTEST/exec', token: 'QR-TEST-ADMIN-TOKEN-'.padEnd(64, 'X') };
const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ serviceWorkers: 'block' });
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  let confirms = 0;
  page.on('dialog', async (d) => { confirms++; await d.accept(); });
  await page.goto(APP + '#hjcontract=' + payload, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const got = await page.evaluate(async () => ({ hash: location.hash, url: await idbGet('contract_url'), token: await idbGet('contract_token'), self: await idbGet('contract_selftest') }));
  assert(got.hash === '', 'QR 조각이 주소창에 남았다');
  assert(got.url === data.url && got.token === data.token, '확인 뒤 주소·토큰이 저장되지 않았다');
  assert(!got.self, '새 연결인데 옛 자가진단 통과 기록이 남았다');
  assert(confirms === 1, '저장 확인은 정확히 한 번이어야 한다: ' + confirms);

  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const handler = html.match(/\/\/ 전자계약 설치 QR[\s\S]*?\/\/ 클로드가 준 링크/)[0];
  const safe = (src) => /hjcontract/.test(src) && /history\.replaceState/.test(src) && !/URLSearchParams\(location\.search/.test(src);
  assert(safe(handler), '실제 QR 수신기가 # 전용·즉시 제거 조건을 지키지 않는다');
  assert(!safe(handler.replace('history.replaceState', 'history.keepSecret')), '변이 검사가 주소 제거 누락을 잡지 못한다');
  assert(!safe(handler.replace('hjcontract=', 'contract=')), '변이 검사가 QR 키 변경을 잡지 못한다');
  console.log('PASS  QR # 수신 · 즉시 제거 · 확인 1회 · IDB 저장 · 변이 2건');
})().catch((e) => { console.error('FAIL ', e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* apt-order-approval.e2e.js — 아파트 오더 승인 카드에 금액·법적 경고가 보이는가
   전제: tests/static-server.js(8299) 실행 중. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const labels = await page.evaluate(() => ({
    known: aiActionLabel('apt_order_add', { complex: '한빛아파트', unit: '관리동', work: '배관 교체', amount: 15000000 }),
    missing: aiActionLabel('apt_order_add', { complex: '한빛아파트', unit: '관리동', work: '누수 점검' }),
    zero: aiActionLabel('apt_order_add', { complex: '한빛아파트', unit: '관리동', work: '점검', amount: 0 })
  }));
  assert(/15,000,000원/.test(labels.known), '① 승인 라벨에 금액이 없음: ' + labels.known);
  assert(!/원원/.test(labels.known), '① 금액 단위가 원원으로 겹침: ' + labels.known);
  assert(/금액 미정/.test(labels.missing), '① 생략 금액이 미정으로 안 보임: ' + labels.missing);
  assert(/0원/.test(labels.zero), '① 명시한 0원을 미정으로 바꿈: ' + labels.zero);

  const guides = await page.evaluate(() => ({
    highPipe: aiActionWarnings('apt_order_add', { work: '급수 배관 교체', amount: 15000000 }),
    low: aiActionWarnings('apt_order_add', { work: '배관 교체', amount: 5000000 }),
    highOther: aiActionWarnings('apt_order_add', { work: '도배', amount: 15000000 })
  }));
  assert(guides.highPipe.length === 2, '② 1,500만원 배관 오더에 두 경고가 아님: ' + JSON.stringify(guides.highPipe));
  assert(guides.highPipe.some(x => /전자입찰 대상/.test(x)), '② 관리사무소 500만원 초과 경고 없음');
  assert(guides.highPipe.some(x => /건설업 등록 없이/.test(x)), '② 전문공사 1,500만원 경고 없음');
  assert(guides.low.length === 0, '② 정확히 500만원에 오경고: ' + JSON.stringify(guides.low));
  assert(guides.highOther.length === 1 && /전자입찰/.test(guides.highOther[0]), '② 무관 공사에 전문공사 오경고: ' + JSON.stringify(guides.highOther));

  const modal = await page.evaluate(async () => {
    state.claudeDone = [];
    const d = claudeReqDecode(JSON.stringify({ requests: [{ id: 'A15', tool: 'apt_order_add', args: { complex: '한빛아파트', unit: '관리동', work: '급수 배관 교체', amount: 15000000 }, why: '승인 화면 검사' }] }));
    await claudeInboxView(d); await new Promise(r => setTimeout(r, 100));
    const root = document.getElementById('modalRoot');
    return { text: root.textContent || '', warnings: root.querySelectorAll('[data-ai-action-warning]').length, orders: (state.aptOrders || []).length };
  });
  assert(/15,000,000원/.test(modal.text), '③ 링크 승인 카드에 금액이 안 보임: ' + modal.text);
  assert(modal.warnings === 2 && /전자입찰 대상/.test(modal.text) && /건설업 등록 없이/.test(modal.text), '③ 링크 승인 카드 경고가 빠짐: ' + modal.text);
  assert(modal.orders === 0, '③ 경고를 보여 주는 동안 승인 없이 오더가 저장됨');
  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 승인 라벨에 금액/금액 미정 표시');
  console.log('PASS  ② 500만원·1,500만원 경고 판정');
  console.log('PASS  ③ 링크 승인 카드에 금액과 경고 노출');
  console.log('PASS  ④ pageerror 0');
  console.log('\n전부 통과 (4건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e); process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

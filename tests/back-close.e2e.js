/* back-close.e2e.js — 폰 뒤로가기는 모달·사진 확대를 닫지, 앱을 끄지 않는다

   2026-08-28 감사 실측: 모달을 띄운 채 뒤로가기를 누르면 앱이 about:blank 로
   통째로 이탈했다. 안드로이드에서 "사진 닫기 = 뒤로가기"가 가장 흔한 습관이라,
   저장 전 촬영분이 있으면 그 이탈로 날아간다. v229 는 하단 시트 3종만 고쳤고
   모달(openModal)·사진 확대(openLightbox)는 빠져 있었다.

     ① 모달 + 뒤로가기 → 모달만 닫히고 앱은 산다
     ② 사진 확대 + 뒤로가기 → 확대만 닫히고 앱은 산다
     ③ 모달→모달 교체(목록→상세)는 히스토리 1칸 — 뒤로가기 한 번에 닫힌다
     ④ 버튼으로 닫으면 히스토리 항목을 회수한다 — 잔여 항목이 쌓이지 않는다
     ⑤ 닫자마자 다시 열기(경합) 후에도 뒤로가기는 '닫기'다
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

// 1×1 투명 PNG — 라이트박스에 띄울 썸네일
const DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const alive = () => page.evaluate(() => ({
    url: location.href.split('/').pop(), app: typeof state !== 'undefined',
    modal: !!document.querySelector('#modalRoot .modal'), lb: !!document.getElementById('lightbox')
  })).catch(() => ({ url: 'DEAD', app: false, modal: false, lb: false }));

  // ① 모달 + 뒤로가기
  await page.evaluate(() => openModal('시험 모달', '<p>내용</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false));
  await page.waitForTimeout(250);
  await page.goBack(); await page.waitForTimeout(500);
  let s = await alive();
  assert(s.app && !s.modal && s.url !== 'DEAD', '① 뒤로가기에 앱이 이탈했거나 모달이 남았다: ' + JSON.stringify(s));

  // ② 사진 확대 + 뒤로가기
  await page.evaluate((dot) => {
    state.files = [{ id: 'bk1', name: 'b.jpg', ext: 'jpg', kind: 'photo', project: '', when: new Date(), thumb: dot }];
    openLightbox('bk1', ['bk1']);
  }, DOT);
  await page.waitForTimeout(250);
  s = await alive();
  assert(s.lb, '② 라이트박스가 안 열렸다(시드 문제)');
  await page.goBack(); await page.waitForTimeout(500);
  s = await alive();
  assert(s.app && !s.lb, '② 뒤로가기에 앱이 이탈했거나 확대가 남았다: ' + JSON.stringify(s));

  // ③ 모달→모달 교체는 히스토리 1칸
  await page.evaluate(() => {
    openModal('목록', '<p>목록</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false);
    openModal('상세', '<p>상세</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false);
  });
  await page.waitForTimeout(250);
  await page.goBack(); await page.waitForTimeout(500);
  s = await alive();
  assert(s.app && !s.modal, '③ 교체 모달이 뒤로가기 한 번에 안 닫히거나 앱이 이탈했다: ' + JSON.stringify(s));

  // ④ 버튼 닫기 후 잔여 히스토리 없음 — 다음 뒤로가기는 앱 밖(=원래 동작)으로 나간다.
  //    (항목 회수가 없으면 여기서 '한 번 더' 눌러야 나가져서, 사장님은 뒤로가기가 씹힌다고 느낀다)
  await page.evaluate(() => openModal('회수 시험', '<p>x</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false));
  await page.waitForTimeout(250);
  await page.click('#modalRoot .modal-close');
  await page.waitForTimeout(600);   // scheduleRetire(setTimeout 0) + history.back 반영 대기
  s = await alive();
  assert(s.app && !s.modal, '④ 버튼 닫기가 안 됐다: ' + JSON.stringify(s));
  await page.goBack(); await page.waitForTimeout(500);
  const gone = await page.evaluate(() => location.href).catch(() => 'about:blank');
  assert(!/index\.html/.test(gone), '④ 히스토리 항목이 회수되지 않고 쌓였다 — 뒤로가기가 한 번 씹힌다');
  await page.goForward().catch(() => {}); await page.waitForTimeout(800);

  // ⑤ 닫자마자 다시 열기 경합 — 마지막 상태에서 뒤로가기는 여전히 '닫기'
  await page.goto(APP, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
  await page.evaluate(() => {
    openModal('첫 모달', '<p>1</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false);
    closeModal();
    openModal('둘째 모달', '<p>2</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }], false);
  });
  await page.waitForTimeout(600);
  s = await alive();
  assert(s.modal, '⑤ 경합 후 모달이 안 떠 있다(전제 실패): ' + JSON.stringify(s));
  await page.goBack(); await page.waitForTimeout(600);
  s = await alive();
  assert(s.app && !s.modal, '⑤ 경합 후 뒤로가기에 앱이 이탈했거나 모달이 남았다: ' + JSON.stringify(s));

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));
  console.log('PASS  ① 모달 + 뒤로가기 = 모달만 닫힘');
  console.log('PASS  ② 사진 확대 + 뒤로가기 = 확대만 닫힘');
  console.log('PASS  ③ 모달→모달 교체는 뒤로가기 한 번');
  console.log('PASS  ④ 버튼 닫기 시 히스토리 회수(잔여 없음)');
  console.log('PASS  ⑤ 닫고 바로 열기 경합에도 뒤로가기 = 닫기');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

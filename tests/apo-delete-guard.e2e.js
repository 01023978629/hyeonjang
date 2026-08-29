/* apo-delete-guard.e2e.js — 아파트 오더 삭제 버튼(.apoDel)의 가드 배선 (Playwright)

   보호하는 사고: 관리사무소 접수에서 넘어온 오더(source:'office-intake')를
   삭제하면 관리사무소 쪽 접수와 앱 쪽 오더가 어긋나 정산 근거가 사라진다.
   officeIntakeDeleteGuard() 함수 자체는 unit 테스트가 있지만, 정작 버튼
   핸들러가 그 함수를 부르는 "배선"은 무검사였다 — 핸들러에서 가드 호출을
   지워도 모든 테스트가 초록이었다(2026-08 종합평가에서 뮤테이션 생존 확인).
   여기서는 함수가 아니라 버튼을 실제로 누른다.

     ① 접수 연결 오더: ✕ 클릭 → 삭제 안 됨, confirm 창도 안 뜸(가드가 먼저)
     ② 일반 오더: ✕ 클릭 + confirm 취소 → 삭제 안 됨
     ③ 일반 오더: ✕ 클릭 + confirm 승인 → 삭제됨, confirm 은 정확히 1번
     ④ pageerror 0

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
  await page.route('https://**/*', route => route.abort());   // 스냅샷 업로드 등 외부 호출 차단
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });

  // confirm 다이얼로그: 시나리오 플래그에 따라 승인/취소하고 횟수를 센다
  let confirmCount = 0, confirmAccept = false;
  page.on('dialog', async d => { confirmCount++; if (confirmAccept) await d.accept(); else await d.dismiss(); });

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__toasts = [];
    const orig = window.toast;
    window.toast = (t) => { window.__toasts.push(String(t)); try { orig(t); } catch (e) {} };
    state.aptOffices = [{ id: 'off1', complex: '테스트단지아파트', manager: '' }];
    state.aptOrders = [
      { id: 'ord_linked', officeId: 'off1', unit: '103동 1204호', text: '실리콘 보수', status: 'recv', date: '2026-08-20', source: 'office-intake', sourceRequestId: 'REQ-1' },
      { id: 'ord_plain', officeId: 'off1', unit: '105동 202호', text: '문짝 수리', status: 'recv', date: '2026-08-21' }
    ];
    aptOrderManage();
  });
  await page.waitForSelector('.apoDel');

  // ① 접수 연결 오더 — 가드가 confirm 이전에 끊어야 한다
  confirmAccept = true;   // 만약 confirm 까지 갔다면(=가드 실종) 승인돼 삭제될 것 — 그걸 잡는다
  await page.click('.apoDel[data-id="ord_linked"]');
  await page.waitForTimeout(400);
  let st = await page.evaluate(() => ({ n: state.aptOrders.length, linked: !!state.aptOrders.find(o => o.id === 'ord_linked'), toasts: window.__toasts.splice(0) }));
  assert(st.linked && st.n === 2, '① 접수 연결 오더가 삭제됐다 — 가드 배선이 끊겼다: ' + JSON.stringify(st));
  assert(confirmCount === 0, '① 가드보다 confirm 이 먼저 떴다 (' + confirmCount + '회) — 가드가 핸들러에서 안 불린다');
  assert(st.toasts.some(t => t.includes('삭제할 수 없습니다')), '① 왜 안 지워지는지 알려주는 안내가 없다: ' + JSON.stringify(st.toasts));

  // ② 일반 오더 + confirm 취소 — 지우면 안 된다
  confirmAccept = false;
  await page.click('.apoDel[data-id="ord_plain"]');
  await page.waitForTimeout(400);
  st = await page.evaluate(() => ({ plain: !!state.aptOrders.find(o => o.id === 'ord_plain') }));
  assert(st.plain, '② confirm 을 취소했는데 오더가 지워졌다');
  assert(confirmCount === 1, '② confirm 이 ' + confirmCount + '회 떴다 (1회여야 한다)');

  // ③ 일반 오더 + confirm 승인 — 지워져야 한다
  confirmAccept = true;
  await page.click('.apoDel[data-id="ord_plain"]');
  await page.waitForTimeout(600);   // hjSnapshot(차단됨) try/catch 통과 대기
  st = await page.evaluate(() => ({ n: state.aptOrders.length, plain: !!state.aptOrders.find(o => o.id === 'ord_plain'), rows: document.querySelectorAll('.apoDel').length }));
  assert(!st.plain && st.n === 1, '③ confirm 을 승인했는데 오더가 안 지워졌다: ' + JSON.stringify(st));
  assert(st.rows === 1, '③ 화면 목록이 갱신되지 않았다 (남은 삭제버튼 ' + st.rows + '개)');
  assert(confirmCount === 2, '③ confirm 횟수가 ' + confirmCount + '회다 (2회여야 한다)');

  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 접수 연결 오더는 버튼으로 삭제 불가 (confirm 이전 차단 + 안내)');
  console.log('PASS  ② confirm 취소 시 보존');
  console.log('PASS  ③ confirm 승인 시 삭제 + 목록 갱신');
  console.log('PASS  ④ pageerror 0');
  console.log('\n전부 통과 (4건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

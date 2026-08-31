/* apo-delete-guard.e2e.js — persisted 아파트 오더 삭제 경로 폐쇄 (Playwright)

   보호하는 사고: 관리사무소 접수 연결 여부와 무관하게 persisted 오더를
   삭제하면 승인·정산 근거가 사라진다. Task 4에는 delete/cancel 전이가 없으므로
   linked/unlinked 모두 삭제 UI가 없어야 하고, 오래 열린 화면의 합성 버튼이나
   stale click도 state/IDB/source identity를 바꾸면 안 된다.

     ① 접수 연결·일반 persisted 오더 모두 .apoDel 미노출
     ② 접수 연결 stale/synthetic 삭제 클릭 → state/IDB/source identity 보존
     ③ 일반 stale/synthetic 삭제 클릭 → state/IDB 보존
     ④ confirm 0회, 삭제 toast 0건, pageerror 0

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

  let confirmCount = 0;
  page.on('dialog', async d => { confirmCount++; await d.accept(); });

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const baseline = await page.evaluate(async() => {
    clearTimeout(__idbSaveTimer);__idbSaveTimer=null;state._demo=false;
    window.__toasts = [];
    const orig = window.toast;
    window.toast = (t) => { window.__toasts.push(String(t)); try { orig(t); } catch (e) {} };
    state.aptOffices = [{ id: 'off1', complex: '테스트단지아파트', manager: '' }];
    state.aptOrders = [
      { id: 'ord_linked', officeId: 'off1', unit: '103동 1204호', text: '실리콘 보수', status: 'recv', date: '2026-08-20', source: 'office-intake', sourceRequestId: 'REQ-1' },
      { id: 'ord_plain', officeId: 'off1', unit: '105동 202호', text: '문짝 수리', status: 'recv', date: '2026-08-21' }
    ];
    await guardedPersistCurrentState();
    aptOrderManage();
    return { live: JSON.stringify(state.aptOrders), appState: JSON.stringify(await idbGet('appState')) };
  });
  const visible = await page.locator('#modalRoot .apoDel').count();
  assert(visible === 0, '① linked/unlinked persisted 오더에 삭제 UI가 노출됐다: ' + visible);

  const st = await page.evaluate(async() => {
    const modal=document.querySelector('#modalRoot .modal');
    for(const id of ['ord_linked','ord_plain']){const stale=document.createElement('button');stale.className='apoDel';stale.dataset.id=id;modal.appendChild(stale);stale.click();stale.remove();}
    await new Promise(resolve=>setTimeout(resolve,50));clearTimeout(__idbSaveTimer);__idbSaveTimer=null;
    const linked=state.aptOrders.find(o=>o.id==='ord_linked'),plain=state.aptOrders.find(o=>o.id==='ord_plain');
    return{live:JSON.stringify(state.aptOrders),appState:JSON.stringify(await idbGet('appState')),linked:{source:linked&&linked.source,sourceRequestId:linked&&linked.sourceRequestId},plain:!!plain,toasts:window.__toasts.slice(),rows:document.querySelectorAll('#modalRoot .apoDel').length};
  });
  assert(st.live === baseline.live && st.appState === baseline.appState, '②③ stale/synthetic 삭제가 state 또는 persisted appState를 바꿨다: '+JSON.stringify(st));
  assert(st.linked.source === 'office-intake' && st.linked.sourceRequestId === 'REQ-1', '② 접수 연결 source identity가 훼손됐다: '+JSON.stringify(st.linked));
  assert(st.plain && st.rows === 0, '③ 일반 오더 보존 또는 삭제 UI 폐쇄가 깨졌다: '+JSON.stringify(st));
  assert(confirmCount === 0, '④ 삭제 UI가 없는데 confirm 이 열렸다: '+confirmCount);
  assert(!st.toasts.some(t=>t.includes('삭제됨')), '④ 삭제 완료 toast가 발생했다: '+JSON.stringify(st.toasts));
  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① linked/unlinked persisted 오더 삭제 UI 미노출');
  console.log('PASS  ② 접수 연결 stale/synthetic 삭제 무변경 + source identity 보존');
  console.log('PASS  ③ 일반 stale/synthetic 삭제 무변경 + persisted appState 보존');
  console.log('PASS  ④ confirm/delete toast/pageerror 0');
  console.log('\n전부 통과 (4건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

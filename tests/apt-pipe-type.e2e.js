/* apt-pipe-type.e2e.js — 아파트 오더의 배관 종류 기록·면허 안내
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
  page.setDefaultTimeout(9000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '한빛아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'old', officeId: 'of1', unit: '101동 101호', text: '오래된 자료', amount: 0, date: localDate(), status: 'recv', doneAt: '' },
      { id: 'hot', officeId: 'of1', unit: '관리동', text: '난방 배관', pipeType: '난방', amount: 0, date: localDate(), status: 'recv', doneAt: '' }
    ];
    state.files = [];
    aptOrderManage('of1');
  });

  // ① 구형 자료는 미확정으로 안전하게 보인다.
  const old = await page.evaluate(() => ({
    value: document.querySelector('.apoPipe[data-id="old"]')?.value,
    stored: Object.prototype.hasOwnProperty.call(state.aptOrders.find(o => o.id === 'old'), 'pipeType')
  }));
  assert(old.value === '미확정', '① 구형 자료 기본값이 미확정이 아님: ' + JSON.stringify(old));
  assert(!old.stored, '① 화면을 열기만 했는데 구형 자료를 덮어씀');

  // ② 난방/급수는 정확한 유자격 업체 안내를 보인다.
  const warning = await page.evaluate(() => document.querySelector('[data-apt-pipe-guide="hot"]')?.textContent || '');
  assert(/등록 업체만 시공할 수 있습니다/.test(warning), '② 등록 업체 안내 없음: ' + warning);
  assert(/계약서 제5조⑨/.test(warning), '② 계약서 조항 안내 없음: ' + warning);

  // ③ 선택 변경이 오더 안에 내구 저장되고 직렬화·복원된다.
  const saved = await page.evaluate(async () => {
    const select = document.querySelector('.apoPipe[data-id="old"]');
    select.value = '오수'; await select.onchange();
    const payload = serializeData();
    const copy = JSON.parse(JSON.stringify(payload));
    state.aptOrders = [];
    applyData(copy);
    const restored = state.aptOrders.find(o => o.id === 'old');
    return { saved: payload.aptOrders.find(o => o.id === 'old').pipeType, restored: restored && restored.pipeType };
  });
  assert(saved.saved === '오수' && saved.restored === '오수', '③ 저장·복원 실패: ' + JSON.stringify(saved));

  // ④ 새 오더 선택값은 로컬 직접 저장하지 않고 승인용 immutable draft에 실린다.
  const added = await page.evaluate(async () => {
    const before=state.aptOrders.length,real=window.openAptCommercialApprovalModal;window.__captured=null;
    window.openAptCommercialApprovalModal=input=>{window.__captured=input;};
    aptOrderManage('of1'); const root = document.getElementById('modalRoot');
    root.querySelector('#apoUnit').value = '지하주차장';
    root.querySelector('#apoText').value = '잡배수 보수';
    root.querySelector('#apoPipe').value = '잡배수';
    root.querySelector('#apoAmt').value = '90000';
    await root.querySelector('#apoAdd').onclick();
    const draft=window.__captured&&window.__captured.draft;window.openAptCommercialApprovalModal=real;
    return {pipeType:draft&&draft.pipeType,frozen:!!draft&&Object.isFrozen(draft),orders:state.aptOrders.length,before};
  });
  assert(added.pipeType === '잡배수' && added.frozen, '④ 승인용 draft에 배관 종류가 정확히 실리지 않음: ' + JSON.stringify(added));
  assert(added.orders===added.before, '④ 승인 전 새 오더가 로컬 장부에 직접 저장됨');

  // ⑤ 미확정·오수·우수·잡배수는 면허 경고를 띄우지 않는다.
  const quiet = await page.evaluate(() => ['미확정','오수','우수','잡배수'].map(aptPipeTypeGuide));
  assert(quiet.every(v => !v), '⑤ 일반 선택에 오경고: ' + JSON.stringify(quiet));
  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 구형 자료는 미확정·원본 불변');
  console.log('PASS  ② 난방·급수 유자격 업체 안내');
  console.log('PASS  ③ 기존 오더 저장·직렬화·복원');
  console.log('PASS  ④ 새 오더 선택값 → immutable 승인 draft · 승인 전 무저장');
  console.log('PASS  ⑤ 일반 선택 오경고 없음');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e); process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

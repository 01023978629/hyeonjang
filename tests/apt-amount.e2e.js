/* apt-amount.e2e.js — 오더 금액을 목록에서 바로 고칠 수 있는가

   발견된 구멍: 정산서 화면이 "금액 미정 N건 — 목록에서 금액을 채우고 다시 여세요"
   라고 안내하는데, 목록에는 금액을 고치는 길이 없었다.
   **할 수 없는 일을 하라고 안내하고 있었다.** 이 테스트는 그 길이 실제로
   있고, 장부를 어긋나게 하는 길(입금완료 수정)은 막혀 있음을 지킨다.

     ① 금액 미정을 눌러 금액을 넣으면 반영되고, 정산서 합계에도 들어간다
     ② 이미 있는 금액도 완료(done)까지 고칠 수 있다
     ③ 청구됨·입금완료는 수정이 막힌다 — 확정된 정산 근거를 지킨다
     ④ 취소·빈 값은 '안 바꿈' — 키 저장과 같은 규칙
     ⑤ 숫자가 아닌 입력은 거부하고 값을 지키지 않는다
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const ym = localDate().slice(0, 7);
    window.__ym = ym;
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'e1', officeId: 'of1', unit: '103동 1204호', text: '실리콘 보수', amount: 0, date: localDate(), status: 'done', doneAt: ym + '-03' },
      { id: 'e2', officeId: 'of1', unit: '201동 505호', text: '청구된 건', amount: 100000, date: localDate(), status: 'billed', doneAt: ym + '-04' },
      { id: 'e3', officeId: 'of1', unit: '301동 707호', text: '입금된 건', amount: 70000, date: localDate(), status: 'paid', doneAt: ym + '-05' }
    ];
    state.payLog = [];
  });

  // ① 미정 → 입력 → 반영 + 정산서 합계
  const fill = await page.evaluate(async () => {
    window.prompt = () => '85000';
    aptOrderManage('of1');
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e1"]').onclick();
    const amt = state.aptOrders.find(o => o.id === 'e1').amount;
    const settle = aptSettle('of1', window.__ym);   // done(85000)+billed(100000) = 185000
    // 경고 배너의 고유 문구를 겨냥한다 — '금액 미정' 넉 자만 찾으면 작업 내용에
    // 같은 글자가 든 오더('금액 미정된 건 조정' 같은 메모)에서 오탐한다.
    const noWarn = !/금액을 채우고 다시 여세요/.test(document.getElementById('modalRoot').textContent || '');
    return { amt, sum: settle.합계, noWarn };
  });
  assert(fill.amt === 85000, '① 금액이 반영 안 됨: ' + fill.amt);
  assert(fill.sum === 185000, '① 정산서 합계에 안 들어감: ' + fill.sum);
  assert(fill.noWarn, '① 금액을 다 채웠는데 정산서에 미정 경고가 남아 있다');

  // ② 완료 상태의 기존 금액은 고칠 수 있다
  const editDone = await page.evaluate(async () => {
    window.prompt = () => '120,000';   // 콤마 입력도 받아야 한다
    aptOrderManage('of1');
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e1"]').onclick();
    return state.aptOrders.find(o => o.id === 'e1').amount;
  });
  assert(editDone === 120000, '② 완료 오더 금액 수정이 안 됨(콤마 처리 포함): ' + editDone);

  // ③ 청구됨·입금완료는 모두 막힌다
  const sealed = await page.evaluate(async () => {
    let promptCalled = false;
    window.prompt = () => { promptCalled = true; return '999999'; };
    let toastMsg = ''; const rt = window.toast; window.toast = (m) => { toastMsg = m; rt(m); };
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e2"]').onclick();
    const billedToast=toastMsg;
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e3"]').onclick();
    window.toast = rt;
    return { billed:state.aptOrders.find(o => o.id === 'e2').amount,paid:state.aptOrders.find(o => o.id === 'e3').amount,promptCalled,billedToast,toastMsg };
  });
  assert(sealed.billed === 100000 && sealed.paid === 70000 && !sealed.promptCalled,
    '③ 청구·입금완료 금액이 고쳐짐 — 정산 근거와 어긋난다');
  assert(/고칠 수 없습니다/.test(sealed.billedToast) && /고칠 수 없습니다/.test(sealed.toastMsg),
    '③ 왜 안 되는지 설명이 없다: ' + JSON.stringify(sealed));

  // ④ 취소·빈 값은 안 바꿈
  const keep = await page.evaluate(async () => {
    window.prompt = () => null;
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e1"]').onclick();
    const afterCancel = state.aptOrders.find(o => o.id === 'e1').amount;
    window.prompt = () => '';
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e1"]').onclick();
    const afterEmpty = state.aptOrders.find(o => o.id === 'e1').amount;
    return { afterCancel, afterEmpty };
  });
  assert(keep.afterCancel === 120000 && keep.afterEmpty === 120000, '④ 취소/빈 값인데 금액이 바뀜: ' + JSON.stringify(keep));

  // ⑤ 숫자 아닌 입력 거부
  const bad = await page.evaluate(async () => {
    window.prompt = () => '팔만원';
    await document.getElementById('modalRoot').querySelector('.apoAmt[data-id="e1"]').onclick();
    return state.aptOrders.find(o => o.id === 'e1').amount;
  });
  assert(bad === 120000, '⑤ "팔만원" 같은 입력으로 금액이 망가짐: ' + bad);

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 금액 미정 → 채우기 → 정산서 합계 반영');
  console.log('PASS  ② 완료된 건 수정 가능 (콤마 입력 포함)');
  console.log('PASS  ③ 청구·입금완료 수정 차단 + 이유 설명');
  console.log('PASS  ④ 취소·빈 값은 안 바꿈');
  console.log('PASS  ⑤ 숫자 아닌 입력 거부');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

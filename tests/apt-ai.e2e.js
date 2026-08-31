/* apt-ai.e2e.js — AI 비서로 아파트 오더 요청·조회

   배경: "오더 기록은 AI 비서에게 말로 시켜도 됩니다" 라고 안내해 놓고
   유료 오더는 고객·관리사무소의 증빙 승인을 앱 화면에서 받아야 한다.
   AI는 대화 중 직접 장부를 쓰거나 승인 모달을 열 수 없고, 대표가
   아파트 오더 화면에서 직접 등록하도록 정확히 안내해야 한다.

     ① apt_order_add · apt_order_update · apt_orders 가 도구 목록에 선언돼 있다
     ② add/update 는 AI_WRITE 에 없고 직접 실행해도 정확히 수동 승인을 요구한다
     ③ add/update 는 상태·스냅샷·게이트·writer 를 전혀 건드리지 않는다
     ④ AI는 승인 모달을 열지 않는다
     ⑤ apt_orders 조회 — 단지 필터가 맞다. 미입금 합계는 내지 않는다(2026-08-13 대표 결정)
     ⑦ 승인 대화상자용 라벨·결과 요약이 사람 말로 나온다
     ⑧ pageerror 0

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
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'x1', officeId: 'of1', unit: '501동 101호', text: '기존 청구건', amount: 200000, date: localDate(), status: 'billed', doneAt: localDate() }
    ];
  });

  // ① 선언 ② 승인 게이트
  const decl = await page.evaluate(() => ({
    add: AI_TOOLS.some(t => t.name === 'apt_order_add'),
    update: AI_TOOLS.some(t => t.name === 'apt_order_update'),
    list: AI_TOOLS.some(t => t.name === 'apt_orders'),
    addNotGated: !AI_WRITE.has('apt_order_add'),
    updateNotGated: !AI_WRITE.has('apt_order_update'),
    listNotGated: !AI_WRITE.has('apt_orders')
  }));
  assert(decl.add && decl.update && decl.list, '① add/update/list 도구가 AI_TOOLS 에 없다');
  assert(decl.addNotGated && decl.updateNotGated,
    '② add/update 가 AI_WRITE 에 있다 — 스냅샷 뒤 실행되거나 일반 AI 승인으로 우회한다');
  assert(decl.listNotGated, '② 조회 도구까지 승인을 받으면 물어볼 때마다 확인창이 떠 못 쓴다');

  // ③④ add/update 는 정확한 수동 조치 결과만 내고, 어떤 상업 writer도 부르지 않는다.
  const blocked = await page.evaluate(async () => {
    const before=JSON.stringify(state.aptOrders);
    const calls={snapshot:0,gate:0,writer:0,modal:0};
    const oldSnap=window.hjSnapshot, oldGate=window.paidWorkGateRequest,
      oldWriter=window.persistApprovedAptOrder, oldModal=window.openAptCommercialApprovalModal;
    window.hjSnapshot=async()=>{calls.snapshot++;};
    window.paidWorkGateRequest=async()=>{calls.gate++;throw new Error('gate must not run');};
    window.persistApprovedAptOrder=async()=>{calls.writer++;throw new Error('writer must not run');};
    window.openAptCommercialApprovalModal=async()=>{calls.modal++;throw new Error('modal must not open');};
    let add,update;
    try{
      add=await aiToolRun('apt_order_add', { complex: '신흥마을', unit: '103동 1204호', work: '욕실 실리콘', amount: 80000 });
      update=await aiToolRun('apt_order_update', { orderId: 'x1', amount: 300000 });
    }finally{
      window.hjSnapshot=oldSnap;window.paidWorkGateRequest=oldGate;
      window.persistApprovedAptOrder=oldWriter;window.openAptCommercialApprovalModal=oldModal;
    }
    return {add,update,calls,before,after:JSON.stringify(state.aptOrders),modalOpen:!!document.querySelector('[data-apt-commercial-modal]')};
  });
  assert(blocked.add === '상업 승인 필요' && blocked.update === '상업 승인 필요',
    '② add/update 결과가 정확한 수동 승인 안내가 아니다: '+JSON.stringify(blocked));
  assert(blocked.before === blocked.after, '③ AI add/update 가 장부를 변경했다');
  assert(Object.values(blocked.calls).every(n=>n===0), '③ AI add/update 가 상업 경로를 호출했다: '+JSON.stringify(blocked.calls));
  assert(!blocked.modalOpen, '④ AI가 대화 중 상업 승인 모달을 열었다');

  // ⑤ 조회 — 필터. 앱이 못 받은 돈을 집계하지 않으므로 미입금 합계는 나오면 안 된다.
  const q = await page.evaluate(async () => await aiToolRun('apt_orders', { complex: '신흥마을' }));
  assert(q.건수 === 1, '⑤ 조회 건수가 틀리다: ' + q.건수);
  assert(q.미입금원 === undefined, '⑤ 미입금 합계가 되살아났다: ' + q.미입금원);

  // ⑦ 라벨·요약 — 쓰기·조회 둘 다. 조회에 라벨이 없으면 채팅에 원시 도구명이 그대로 찍힌다(감사 지적).
  const label = await page.evaluate(() => ({
    act: aiActionLabel('apt_order_add', { complex: '신흥마을아파트', unit: '103동 1204호', work: '욕실 실리콘 교체' }),
    brief: aiResultBrief('apt_order_add', { 단지: '신흥마을아파트', 동호: '103동 1204호' }),
    qAct: aiActionLabel('apt_orders', { complex: '신흥마을' }),
    qBrief: aiResultBrief('apt_orders', { 건수: 3 })
  }));
  assert(/아파트 오더 접수/.test(label.act) && /신흥마을아파트/.test(label.act), '⑦ 승인 라벨이 사람 말이 아니다: ' + label.act);
  assert(/신흥마을아파트/.test(label.brief), '⑦ 결과 요약이 비었다: ' + label.brief);
  assert(/아파트 오더 조회/.test(label.qAct) && label.qAct !== 'apt_orders', '⑦ 조회 라벨이 원시 도구명 그대로다: ' + label.qAct);
  assert(/3건/.test(label.qBrief), '⑦ 조회 결과 요약이 비었다: ' + label.qBrief);
  assert(!/미입금/.test(label.qBrief), '⑦ 결과 요약에 미입금이 되살아났다: ' + label.qBrief);

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 도구 선언 (apt_order_add · apt_order_update · apt_orders)');
  console.log('PASS  ② add/update 정확한 상업 승인 필요 응답');
  console.log('PASS  ③ 상태·스냅샷·게이트·writer 무변경');
  console.log('PASS  ④ AI 대화 중 승인 모달 없음');
  console.log('PASS  ⑤ 조회 — 단지 필터 · 미입금 합계 없음');
  console.log('PASS  ⑦ 라벨·결과 요약 (쓰기·조회)');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

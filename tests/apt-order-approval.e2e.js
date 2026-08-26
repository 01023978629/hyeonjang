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
  assert(guides.highPipe.some(x => /표준 패키지는 500만원 이하/.test(x)), '② 관리사무소 500만원 초과 정책 안내 없음');
  assert(guides.highPipe.some(x => /건설업 등록 없이/.test(x)), '② 전문공사 1,500만원 경고 없음');
  assert(guides.low.length === 0, '② 정확히 500만원에 오경고: ' + JSON.stringify(guides.low));
  assert(guides.highOther.length === 1 && /별도 견적과 관리사무소 승인/.test(guides.highOther[0]), '② 무관 공사에 전문공사 오경고: ' + JSON.stringify(guides.highOther));

  const modal = await page.evaluate(async () => {
    state.claudeDone = [];
    const d = claudeReqDecode(JSON.stringify({ requests: [{ id: 'A15', tool: 'apt_order_add', args: { complex: '한빛아파트', unit: '관리동', work: '급수 배관 교체', amount: 15000000 }, why: '승인 화면 검사' }] }));
    await claudeInboxView(d); await new Promise(r => setTimeout(r, 100));
    const root = document.getElementById('modalRoot');
    return { text: root.textContent || '', warnings: root.querySelectorAll('[data-ai-action-warning]').length, orders: (state.aptOrders || []).length };
  });
  assert(/15,000,000원/.test(modal.text), '③ 링크 승인 카드에 금액이 안 보임: ' + modal.text);
  assert(modal.warnings === 2 && /표준 패키지는 500만원 이하/.test(modal.text) && /건설업 등록 없이/.test(modal.text), '③ 링크 승인 카드 경고가 빠짐: ' + modal.text);
  assert(modal.orders === 0, '③ 경고를 보여 주는 동안 승인 없이 오더가 저장됨');

  // Break caught: only an intake-derived order publishes a sanitized public projection.
  const publishing = await page.evaluate(() => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    const intake = { id: 'publish-intake', source: 'office-intake', sourceRequestId: 'req-1', status: 'visit', visitAt: '2026-08-27T10:00:00+09:00', publicAmount: null, amount: 980000, intakePhotoIds: ['drive-1', 'drive-2'], publicPhotoIds: ['drive-2', 'unrelated'], completionSummary: '공개 가능한 완료 내용', customerName: '노출 금지' };
    const manual = { id: 'publish-manual', sourceRequestId: 'manual-looks-linked', status: 'visit', visitAt: '2026-08-27T10:00:00+09:00' };
    officeIntakeQueueOrderStatus(intake);
    officeIntakeQueueOrderStatus(manual);
    const visit = officeIntakeData().outbox.map(x => ({ action: x.action, payload: x.payload }));
    intake.status = 'done'; intake.publicAmount = 120000; intake.publicPhotoIds = ['drive-2', 'unrelated'];
    const completion = officeIntakeCompletionPayload(intake);
    officeIntakeQueueOrderStatus(intake);
    return { visit, completion, all: officeIntakeData().outbox.map(x => ({ action: x.action, payload: x.payload })) };
  });
  assert(publishing.visit.length===1&&publishing.visit[0].action==='officeSetStatus'&&JSON.stringify(publishing.visit[0].payload)===JSON.stringify({ requestId: 'req-1', status: 'visit_scheduled', visitAt: '2026-08-27T10:00:00+09:00', publicAmount: null, completionReport: null, completionPhotoIds:['drive-1','drive-2'], projectionRevision:1 }), '④ 방문 상태는 접수 오더만 공개 금액 null·trusted 사진 manifest·초기 revision을 대기열에 넣어야 한다');
  assert(JSON.stringify(publishing.completion) === JSON.stringify({ summary: '공개 가능한 완료 내용', photoIds: ['drive-1', 'drive-2'], publicPhotoIds: ['drive-2'], publicAmount: 120000 }), '④ 완료 보고는 intake 사용 가능 사진 집합과 명시 공개 부분집합만 포함해야 한다');
  assert(JSON.stringify(publishing.all[1]) === JSON.stringify({ action: 'officeSetStatus', payload: { requestId: 'req-1', status: 'completed', visitAt: '2026-08-27T10:00:00+09:00', publicAmount: 120000, completionReport: { summary: '공개 가능한 완료 내용', photoIds: ['drive-1', 'drive-2'], publicPhotoIds: ['drive-2'] }, completionPhotoIds:['drive-1','drive-2'], projectionRevision:2 } }), '④ 완료 상태는 공개 보고 외 개인정보·내부금액·무관 사진을 보내면 안 된다');
  const integrity = await page.evaluate(() => {
    const intake = { id:'strict-order', source:'office-intake', sourceRequestId:'strict-request', status:'recv', intakePhotoIds:['owned'], publicPhotoIds:['owned'], completionSummary:'홍길동 02-1234-5678 (042) 123-4567 010 1234 5678 작업 완료', residentContact:{name:'홍길동',phone:'01012345678'}, officeContactPhone:'010-9999-8888' };
    const manual = { id:'manual-order', status:'recv' };
    const allowed = [officeIntakeAptStatusAllowed(intake,'recv'), officeIntakeAptStatusAllowed(intake,'visit'), officeIntakeAptStatusAllowed(intake,'work'), officeIntakeAptStatusAllowed(manual,'paid')];
    const payload = officeIntakeCompletionPayload(intake);
    state.aptOrders=[intake]; aptOrderManage(); const select=document.querySelector('.apoStat[data-id="strict-order"]'); const options=[...select.options].map(x=>x.value); select.value='paid'; select.onchange();
    return { allowed, payload, options, after:intake.status, outbox:officeIntakeData().outbox.filter(x=>x.payload.requestId==='strict-request').length, overflow:document.getElementById('modalRoot').scrollWidth>390 };
  });
  assert(JSON.stringify(integrity.allowed) === JSON.stringify([true,true,false,true]), '⑤ intake는 현재와 다음 단계만 허용하고 manual은 기존 동작을 유지해야 한다');
  assert(JSON.stringify(integrity.options) === JSON.stringify(['recv','visit']) && integrity.after === 'recv' && integrity.outbox === 0, '⑤ 변조된 intake 상태 선택은 되돌리고 outbox에 넣으면 안 된다');
  assert(!/홍길동|(?:\d[\s().-]*){7,}/.test(integrity.payload.summary) && /\[고객명\]|\[연락처\]/.test(integrity.payload.summary), '⑤ 공개 완료 메모는 알려진 이름·휴대폰·지역번호를 placeholder로 바꿔야 한다: '+integrity.payload.summary);
  assert(integrity.overflow === false, '⑤ 390px 폭에서 Task 4 controls가 넘치면 안 된다');
  const monthly = await page.evaluate(() => {
    const ym=localDate().slice(0,7), doneAt=ym+'-10';
    state.aptOffices=[{id:'bulk-office',complex:'일괄 단지'}];
    state.aptOrders=[
      {id:'bulk-intake',officeId:'bulk-office',source:'office-intake',sourceRequestId:'bulk-request',status:'done',doneAt,amount:10000},
      {id:'bulk-manual',officeId:'bulk-office',status:'done',doneAt,amount:20000}
    ];
    state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    window.confirm=()=>true;
    aptSettle('bulk-office',ym);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(button=>button.textContent.includes('청구 처리')).click();
    const billed=officeIntakeData().outbox.map(item=>item.payload);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(button=>button.textContent.includes('입금 확인')).click();
    const paid=officeIntakeData().outbox.map(item=>item.payload);
    return { statuses:state.aptOrders.map(order=>[order.id,order.status]), billed, paid };
  });
  const bulkReport={summary:'',photoIds:[],publicPhotoIds:[]};
  assert(JSON.stringify(monthly.statuses) === JSON.stringify([['bulk-intake','paid'],['bulk-manual','paid']]), '⑥ 월 청구·입금은 실제 변경된 intake만 발행하고 manual은 기존 정산만 적용해야 한다: '+JSON.stringify(monthly));
  assert(JSON.stringify(monthly.billed) === JSON.stringify([{requestId:'bulk-request',status:'billed',visitAt:null,publicAmount:null,completionReport:bulkReport,completionPhotoIds:[],projectionRevision:1}]), '⑥ 청구는 intake 상태 1건의 정확한 payload만 대기열에 넣어야 한다');
  assert(JSON.stringify(monthly.paid) === JSON.stringify([{requestId:'bulk-request',status:'billed',visitAt:null,publicAmount:null,completionReport:bulkReport,completionPhotoIds:[],projectionRevision:1},{requestId:'bulk-request',status:'paid',visitAt:null,publicAmount:null,completionReport:bulkReport,completionPhotoIds:[],projectionRevision:2}]), '⑥ 입금도 실제 변경된 intake 상태만 순서대로 대기열에 넣어야 한다');
  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 승인 라벨에 금액/금액 미정 표시');
  console.log('PASS  ② 500만원·1,500만원 경고 판정');
  console.log('PASS  ③ 링크 승인 카드에 금액과 경고 노출');
  console.log('PASS  ④ 접수 오더만 상태·공개 완료 보고를 발행');
  console.log('PASS  ⑤ pageerror 0');
  console.log('PASS  ⑥ 월 청구·입금 intake 상태 발행');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e); process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

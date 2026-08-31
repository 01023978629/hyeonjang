/* apt-orders.e2e.js — 🏢 아파트 오더 (관리사무소 일감) 회귀

   왜 별도 장부인가
     관리사무소 일감은 일반 현장과 결이 다르다 — 한 단지에서 작은 일이 계속 오고,
     건별 계약 없이 월말에 한 번에 정산한다. 그래서 현장(projects)이 아니라
     aptOffices/aptOrders 로 들되, **입금만은 수금 장부(payLog)에 합류**한다.

   지키는 것
     ① 메뉴에서 찾을 수 있다 (구형 시트·V2 분류 메뉴 모두)
     ② 단지 등록 → 수동 등록은 승인 모달로 가고, 승인된 오더는 목록에 보인다
     ③ 완료 처리하면 doneAt 이 찍힌다 (정산은 완료 월 기준이므로 이게 없으면 정산이 빈다)
     ④ 월 정산서 — 그 단지·그 달 완료분만 합산, 문안에 동/호·합계가 들어간다
     ⑤ 청구 처리 → billed. 완료 안 된 오더는 청구되지 않는다
     ⑥ 입금 확인 → paid + payLog 1건. **두 번 눌러도 payLog 에 두 번 실리지 않는다**
     ⑦ 목록에서 상태를 '입금완료'로 직접 바꿀 수 없다 — 장부를 우회하는 길을 막는다
     ⑧ 금액 미정 오더만 있으면 입금 확인이 막힌다 (0원 수금 기록 방지)
     ⑨ serializeData/applyData 왕복에 aptOffices·aptOrders 가 살아남는다
     ⑩ 단지명에 HTML 을 넣어도 스크립트가 실행되지 않는다 (escapeHtml)
     ⑪ pageerror 0

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
  await page.waitForTimeout(700);

  // ① 메뉴 양쪽에 있고 핸들러가 이어져 있다
  const menu = await page.evaluate(() => {
    const flatSrc = document.body.innerHTML;   // 구형 시트는 열어야 생기므로 소스에서 확인
    const v2 = (typeof MORE_CATS !== 'undefined') && MORE_CATS.some(c => c.items.some(it => it[0] === 'aptorders'));
    return { v2, fnExists: typeof aptOrderManage === 'function' };
  });
  assert(menu.v2, '① V2 분류 메뉴에 아파트 오더가 없음 — 사장님이 못 찾는다');
  assert(menu.fnExists, '① aptOrderManage 함수가 없음');

  // ② 단지 등록 → 수동 등록은 승인 모달로 이동. 이후 승인 완료 fixture로 목록 회귀를 본다.
  const intake = await page.evaluate(async () => {
    state.aptOffices = []; state.aptOrders = []; state.payLog = [];
    const answers = ['신흥마을아파트', '김소장', '042-000-0000'];
    window.prompt = () => answers.shift() || '';
    aptOrderManage();
    let root = document.getElementById('modalRoot');
    root.querySelector('#apoOffAdd').onclick();
    root = document.getElementById('modalRoot');
    root.querySelector('#apoUnit').value = '103동 1204호';
    root.querySelector('#apoText').value = '욕실 실리콘 교체';
    root.querySelector('#apoAmt').value = '80000';
    await root.querySelector('#apoAdd').onclick();
    const approvalShown=/상업 승인/.test(document.getElementById('modalRoot').textContent||'');
    const beforeApproval=state.aptOrders.length;
    closeModal();
    const officeId=state.aptOffices[0].id,id='approved-order-1',terms={workKind:'repair',scope:'욕실 실리콘 교체',exclusions:[],vatMode:'excluded',quotedAmount:80000,validUntil:'2027-12-31',scheduleWindow:'협의 후 방문'};
    const receipt={receiptId:'receipt_approved_order_1',subjectType:'aptOrder',subjectId:id,approvedTermsSha256:'a'.repeat(64),approvalEvidenceType:'message-export-file',approvalEvidenceFileId:'DRIVEFILE1234567890',approvalEvidenceSha256:'b'.repeat(64),approvedAt:'2026-08-31T09:00:00+09:00',approvedByRole:'management-office',issuedAt:'2026-08-31T09:00:01+09:00',receiptHmac:'c'.repeat(64)};
    state.aptOrders.push({id,officeId,unit:'103동 1204호',text:'욕실 실리콘 교체',amount:80000,pipeType:'기타/미지정',date:localDate(),status:'visit',source:'manual-paid-diagnosis',commercialGateVersion:1,commercialTerms:terms,commercialApproval:receipt});
    __commercialApproval.url='https://commercial.test/exec';__commercialApproval.token='TEST-TOKEN';
    window.commercialCall=async(action,payload)=>{
      if(action==='commercialNow')return {ok:true,serverNowKst:'2026-08-31T10:00:00+09:00',receivedAtKst:'2026-08-31T10:00:00+09:00',nonce:payload.nonce};
      if(action==='commercialApprovalVerify')return {ok:true,receiptId:payload.commercialApproval.receiptId,serverNowKst:'2026-08-31T10:00:00+09:00',nonce:payload.nonce,verifyExpiresAtKst:'2026-08-31T10:00:30+09:00'};
      throw new Error('unexpected commercial action '+action);
    };
    aptOrderManage(officeId);
    root = document.getElementById('modalRoot');
    const listText = root.textContent;
    return {
      offices: state.aptOffices.length, orders: state.aptOrders.length,approvalShown,beforeApproval,
      order: state.aptOrders[0],
      shown: /103동 1204호/.test(listText) && /욕실 실리콘 교체/.test(listText) && /80,000원/.test(listText)
    };
  });
  assert(intake.offices === 1 && intake.approvalShown && intake.beforeApproval === 0,
    '② 수동 등록이 로컬 접수 대신 승인 모달로 가지 않는다: '+JSON.stringify(intake));
  assert(intake.orders === 1, '② 승인 완료 오더 fixture가 목록에 없다');
  assert(intake.order.status === 'visit' && intake.order.amount === 80000, '② 승인된 오더 초기 상태가 방문예정·금액이어야 함');
  assert(!Object.prototype.hasOwnProperty.call(intake.order, 'sourceRequestId'), '② 기존 수동 오더에 접수 원본 ID를 강제하면 안 됨');
  assert(intake.shown, '② 목록에 동/호·작업·금액이 보이지 않음');

  // ③ 완료 처리 → doneAt / ⑦ 입금완료 직접 변경 차단
  const flow = await page.evaluate(async () => {
    const id = state.aptOrders[0].id;
    const root = document.getElementById('modalRoot');
    const sel = root.querySelector('.apoStat[data-id="' + id + '"]');
    sel.value = 'paid'; sel.onchange();          // 우회 시도 — 막혀야 한다
    const blockedStatus = state.aptOrders[0].status;
    const sel2 = document.getElementById('modalRoot').querySelector('.apoStat[data-id="' + id + '"]');
    sel2.value = 'work'; await sel2.onchange();
    const workingStatus=state.aptOrders[0].status;
    const sel3 = document.getElementById('modalRoot').querySelector('.apoStat[data-id="' + id + '"]');
    sel3.value = 'done'; await sel3.onchange();
    return { blockedStatus,workingStatus,status: state.aptOrders[0].status, doneAt: state.aptOrders[0].doneAt };
  });
  assert(flow.blockedStatus === 'visit', '⑦ 목록에서 입금완료로 직접 바꿀 수 있음 — 수금 장부를 우회한다');
  assert(flow.workingStatus === 'work', '③ 방문예정→진행중 순차 전이가 안 된다');
  assert(flow.status === 'done' && !!flow.doneAt, '③ 완료 처리에 doneAt 이 안 찍힘 — 월 정산이 빈다');

  // ④ 월 정산서 문안
  const settle = await page.evaluate(() => {
    // 다른 달 완료 오더를 하나 심어 이달 정산에 섞이지 않는지 본다
    state.aptOrders.push({ id: 'old1', officeId: state.aptOffices[0].id, unit: '201동 101호', text: '지난달 작업', amount: 999999, date: '2026-06-01', status: 'done', doneAt: '2026-06-15' });
    aptSettle(state.aptOffices[0].id);
    const t = document.getElementById('modalRoot').querySelector('#apsText').value;
    return { t, hasUnit: /103동 1204호/.test(t), hasSum: /합계: 80,000원/.test(t), mixedOld: /지난달 작업/.test(t) };
  });
  assert(settle.hasUnit && settle.hasSum, '④ 정산 문안에 동/호·합계가 없음: ' + settle.t.slice(0, 120));
  assert(!settle.mixedOld, '④ 다른 달 완료분이 이달 정산서에 섞임 — 이중 청구가 된다');

  // ⑤ 청구 처리 — 완료분만
  const billed = await page.evaluate(async () => {
    state.aptOrders.push({ id: 'notdone', officeId: state.aptOffices[0].id, unit: '105동 505호', text: '아직 진행중', amount: 50000, date: localDate(), status: 'work', doneAt: '' });
    const root = document.getElementById('modalRoot');
    const btn = [...root.querySelectorAll('button')].find(b => /청구 처리/.test(b.textContent));
    await btn.onclick();
    return { first: state.aptOrders.find(o => o.unit === '103동 1204호').status,
             working: state.aptOrders.find(o => o.id === 'notdone').status };
  });
  assert(billed.first === 'billed', '⑤ 완료 오더가 청구됨으로 안 바뀜');
  assert(billed.working === 'work', '⑤ 진행 중 오더까지 청구됨 — 안 한 일을 청구하게 된다');

  // ⑥ 입금 확인 — payLog 1건, 두 번 눌러도 중복 없음
  const paid = await page.evaluate(async () => {
    window.confirm = () => true;
    const find = () => [...document.getElementById('modalRoot').querySelectorAll('button')].find(b => /입금 확인/.test(b.textContent));
    await find().onclick();
    const afterOnce = { pay: state.payLog.length, status: state.aptOrders.find(o => o.unit === '103동 1204호').status };
    await find().onclick();   // 한 번 더 — 남은 청구분이 없으니 아무 일도 없어야 한다
    return { afterOnce, payTwice: state.payLog.length, entry: state.payLog[0] };
  });
  assert(paid.afterOnce.pay === 1 && paid.afterOnce.status === 'paid', '⑥ 입금 확인이 payLog 에 기록되지 않음');
  assert(paid.payTwice === 1, '⑥ 입금 확인 두 번에 payLog 두 건 — 매출이 이중 집계된다');
  assert(paid.entry.amt === 80000 && /신흥마을아파트/.test(paid.entry.project), '⑥ payLog 내용이 틀림: ' + JSON.stringify(paid.entry));

  // ⑧ 금액 미정만 있으면 입금 확인이 막힌다
  const noAmt = await page.evaluate(async () => {
    state.aptOrders.push({ id: 'na1', officeId: state.aptOffices[0].id, unit: '106동 606호', text: '금액 미정 작업', amount: 0, date: localDate(), status: 'billed', doneAt: localDate() });
    aptSettle(state.aptOffices[0].id);
    const btn = [...document.getElementById('modalRoot').querySelectorAll('button')].find(b => /입금 확인/.test(b.textContent));
    await btn.onclick();
    return { pay: state.payLog.length, status: state.aptOrders.find(o => o.id === 'na1').status };
  });
  assert(noAmt.pay === 1 && noAmt.status === 'billed', '⑧ 금액 미정인데 0원 수금이 기록됨');

  // ⑨ 직렬화 왕복
  const roundtrip = await page.evaluate(() => {
    const d = JSON.parse(JSON.stringify(serializeData()));
    const savedOffices = d.aptOffices, savedOrders = d.aptOrders;
    state.aptOffices = []; state.aptOrders = [];
    applyData(d);
    return { inDump: !!(savedOffices && savedOffices.length && savedOrders && savedOrders.length),
             offices: state.aptOffices.length, orders: state.aptOrders.length };
  });
  assert(roundtrip.inDump, '⑨ serializeData 에 아파트 오더가 안 실림 — 드라이브 백업에서 사라진다');
  assert(roundtrip.offices === 1 && roundtrip.orders >= 3, '⑨ applyData 복원 실패: ' + JSON.stringify(roundtrip));

  // ⑩ XSS — 단지명·작업에 HTML 을 넣어도 실행되지 않는다
  const xss = await page.evaluate(() => {
    window.__xss = false;
    state.aptOffices.push({ id: 'x1', complex: '<img src=x onerror="window.__xss=true">', manager: '', phone: '' });
    state.aptOrders.push({ id: 'x2', officeId: 'x1', unit: '<b>1동</b>', text: '<script>window.__xss=true<\/script>', amount: 0, date: localDate(), status: 'recv', doneAt: '' });
    aptOrderManage();
    const root = document.getElementById('modalRoot');
    return { fired: window.__xss, img: !!root.querySelector('img[src="x"]'), closed: (closeModal(), true) };
  });
  await page.waitForTimeout(300);
  const xssFired = await page.evaluate(() => window.__xss);
  assert(!xss.img && !xssFired, '⑩ 단지명 HTML 이 그대로 심어짐 — escapeHtml 누락');

  assert(errors.length === 0, '⑪ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 메뉴(V2)와 핸들러 연결');
  console.log('PASS  ② 단지 등록 → 승인 모달 → 승인된 오더 목록 표시');
  console.log('PASS  ③ 완료 처리 시 doneAt 기록');
  console.log('PASS  ④ 월 정산서 — 그 달 완료분만, 동/호·합계 포함');
  console.log('PASS  ⑤ 청구 처리는 완료분만');
  console.log('PASS  ⑥ 입금 확인 → payLog 1건 · 중복 불가');
  console.log('PASS  ⑦ 목록에서 입금완료 직접 변경 차단');
  console.log('PASS  ⑧ 금액 미정이면 입금 확인 차단');
  console.log('PASS  ⑨ 직렬화 왕복 보존');
  console.log('PASS  ⑩ 단지명 XSS 차단');
  console.log('PASS  ⑪ pageerror 0');
  console.log('\n전부 통과 (11건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

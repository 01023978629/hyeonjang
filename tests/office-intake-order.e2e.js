/* office-intake-order.e2e.js — 관리사무소 접수를 기존 아파트 오더로 안전하게 변환한다.

   지키는 것
     ① 접수 원본 필드가 아파트 오더 확장 필드로 보존된다
     ② 같은 requestId를 다시 매핑해도 오더는 하나뿐이다
     ③ 접수 사진 Drive ID는 최대 5개만 보존된다
     ④ 접수함 상태는 serializeData/applyData 왕복과 구형·손상 백업에서 안전하다

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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const result = await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '예시 아파트', manager: '김소장', phone: '010-1111-2222' }];
    state.aptOrders = [];
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    const request = {
      requestId: 'req-1', receiptNo: 'MM-20260826-0001', officeId: 'of1',
      unit: '103동 1204호', location: '욕실 천장', issueType: '누수', pipeType: '미확정',
      urgency: 'urgent', description: '천장에서 물이 떨어집니다.',
      officeContact: { name: '김소장', phone: '010-1111-2222' }, residentContact: null,
      preferredVisitDate: '2026-08-27',
      photos: [
        { fileId: 'photo-1', name: 'MM-20260826-0001_01.jpg', mimeType: 'image/jpeg' },
        { fileId: 'photo-2' }, { fileId: 'photo-3' }, { fileId: 'photo-4' },
        { fileId: 'photo-5' }, { fileId: 'photo-6' }, null
      ],
      status: 'pending_review'
    };
    state.officeIntake.inbox.push(request);
    const order = officeIntakeOrderFromRequest(request, '예시 아파트 103동 1204호');
    state.aptOrders.push(order);
    const duplicate = officeIntakeOrderFromRequest(request, '다른 프로젝트여도 새 오더를 만들면 안 됨');
    const foundRequest = officeIntakeFindRequest('req-1').requestId;
    const localIntake = { inbox: [{ requestId: 'local-keep' }], cursor: 'local-cursor', outbox: [{ id: 'queued-1' }], lastSyncAt: '', lastError: '' };
    state.officeIntake = localIntake;
    applyData({ files: [], aptOffices: state.aptOffices, aptOrders: state.aptOrders });
    const afterOldBackup = state.officeIntake;
    applyData({ files: [], aptOffices: state.aptOffices, aptOrders: state.aptOrders, officeIntake: 'malformed' });
    const afterMalformedBackup = state.officeIntake;
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    return {
      order,
      duplicateId: officeIntakeFindOrder('req-1').id,
      duplicateReturnedId: duplicate.id,
      orders: state.aptOrders.length,
      foundRequest,
      serialized: serializeData().officeIntake,
      afterOldBackup,
      afterMalformedBackup,
      statusMap: [
        officeIntakeStatusToApt('accepted'), officeIntakeStatusToApt('visit_scheduled'),
        officeIntakeStatusToApt('in_progress'), officeIntakeStatusToApt('completed'),
        officeIntakeStatusToApt('unknown')
      ]
    };
  });
  assert(result.order.source === 'office-intake', '① source field');
  assert(result.order.sourceRequestId === 'req-1', '① sourceRequestId field');
  assert(result.order.officeId === 'of1', '① office mapping');
  assert(result.order.status === 'recv', '① initial apt status');
  assert(result.order.receiptNo === 'MM-20260826-0001', '① receipt number');
  assert(result.order.officeContactName === '김소장' && result.order.officeContactPhone === '010-1111-2222', '① office contact');
  assert(result.order.location === '욕실 천장' && result.order.preferredVisitDate === '2026-08-27', '① request fields');
  assert(result.order.urgency === 'urgent' && result.order.residentContact === null, '① urgency/contact fields');
  assert(JSON.stringify(result.order.intakePhotoIds) === JSON.stringify(['photo-1', 'photo-2', 'photo-3', 'photo-4', 'photo-5']), '③ photo IDs must be capped at five');
  assert(result.duplicateId === result.order.id && result.duplicateReturnedId === result.order.id && result.orders === 1, '② duplicate request created another order');
  assert(result.foundRequest === 'req-1', '① request lookup');
  assert(Array.isArray(result.serialized.outbox), '④ officeIntake persisted');
  assert(result.afterOldBackup.cursor === 'local-cursor' && result.afterOldBackup.outbox.length === 1, '④ old backup erased local intake state');
  assert(result.afterMalformedBackup.cursor === 'local-cursor' && result.afterMalformedBackup.outbox.length === 1, '④ malformed backup replaced local intake state');
  assert(JSON.stringify(result.statusMap) === JSON.stringify(['recv', 'visit', 'work', 'done', 'recv']), '① office status mapping');
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 접수 필드·상태를 아파트 오더로 매핑');
  console.log('PASS  ② sourceRequestId 중복 오더 방지');
  console.log('PASS  ③ 접수 사진 Drive ID 최대 5개');
  console.log('PASS  ④ 구형·손상 백업에서도 접수 상태 보존');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

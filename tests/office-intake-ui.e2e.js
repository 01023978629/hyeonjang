/* office-intake-ui.e2e.js — 관리사무소 접수함은 모바일에서 안전하게 검토·승인한다.

   지키는 것
     ① 아파트 오더 메뉴의 신규·24시간 미확인 배지
     ② 접수 원문은 이스케이프하고, 전화 링크는 안전한 tel:만 사용
     ③ 승인은 로컬 오더를 먼저 한 번만 보존하고 실패한 서버 연결은 정확히 큐잉
     ④ 보완 요청·보류·취소는 오더를 만들지 않고 올바른 상태만 큐잉
     ⑤ 390px 모바일 화면에 가로 넘침이 없다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
let browser;

(async () => {
  const launchOpts = process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {};
  if (!launchOpts.executablePath && process.platform !== 'win32') launchOpts.executablePath = '/opt/pw-browsers/chromium';
  browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', async dialog => {
    errors.push('unexpected dialog: ' + dialog.type());
    await dialog.dismiss().catch(() => {});
  });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of-ui', complex: '안전 아파트', manager: '관리소', phone: '010-1111-2222' }];
    state.aptOrders = [];
    state.projects = [{ name: '기존 현장', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }];
    state.officeIntake = {
      inbox: [
        {
          requestId: 'req-xss', receiptNo: 'MM-UI-0001', officeId: 'of-ui', unit: '103동 1204호',
          location: '욕실 천장', issueType: '누수', pipeType: '미확정', urgency: 'urgent',
          description: '<img src=x onerror=window.__xss=1>',
          officeContact: { name: '김소장', phone: '010-1111-2222;window.__xss=2' },
          preferredVisitDate: '2026-08-27', photos: [{ fileId: 'photo-ui-1' }, { fileId: 'photo-ui-2' }],
          status: 'pending_review', createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z'
        },
        {
          requestId: 'req-review', receiptNo: 'MM-UI-0002', officeId: 'of-ui', unit: '지하주차장',
          location: 'B2 기둥', issueType: '공용시설', pipeType: '미확정', urgency: 'normal', description: '보수 요청',
          officeContact: { name: '이주임', phone: '010-3333-4444' }, photos: [], status: 'pending_review',
          createdAt: '2000-01-02T00:00:00.000Z', updatedAt: '2000-01-02T00:00:00.000Z'
        }
      ], cursor: '', outbox: [], lastSyncAt: '', lastError: ''
    };
    window.__xss = undefined;
    window.cloudOfficeAccept = async () => ({ ok: false, error: 'offline' });
  });

  await page.evaluate(() => openMoreSheetV2());
  const aptOrders = page.locator('[data-moreaction="aptorders"]');
  const badge = await aptOrders.getAttribute('aria-label');
  assert.match(String(badge), /신규 2/, '아파트 오더 메뉴에 신규 접수 배지');
  assert.match(String(badge), /24시간 이상 미확인 2/, '메뉴 접근성 이름에 장기 미확인 수');

  await page.waitForTimeout(20); // openMoreSheetV2의 검색창 초기 포커스가 끝난 뒤 검증한다.
  await page.locator('#moreSheetClose').focus();
  await page.evaluate(() => officeIntakeOpen());
  const inbox = page.locator('#modalRoot .modal');
  await assert.doesNotReject(() => inbox.waitFor());
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#modalRoot .modal')), true, '접수함을 열면 포커스를 모달로 이동');
  await page.locator('#modalRoot .modal-close').click();
  await page.waitForTimeout(20);
  const returnedFocus = await page.evaluate(() => document.activeElement && document.activeElement.outerHTML);
  assert.match(String(returnedFocus), /id="moreSheetClose"/, '닫기 후 기존 더보기 닫기 버튼으로 포커스 복귀: ' + returnedFocus);

  await page.evaluate(() => officeIntakeOpen());
  const visible = await inbox.innerText();
  assert.match(visible, /MM-UI-0001/, '접수번호 표시');
  assert.match(visible, /103동 1204호/, '동호수 표시');
  assert.match(visible, /욕실 천장/, '위치 표시');
  assert.match(visible, /긴급/, '긴급도 표시');
  assert.match(visible, /사진 2장/, '사진 수 표시');
  assert.match(visible, /24시간 이상 미확인/, '24시간 경고 표시');
  assert.match(visible, /<img src=x onerror=window.__xss=1>/, '주입 문자열을 텍스트로 표시');
  assert.equal(await page.locator('#modalRoot img[src="x"]').count(), 0, '주입 태그를 DOM으로 만들지 않음');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'XSS 실행 없음');
  const call = page.locator('[data-oi-request="req-xss"] a[href^="tel:"]');
  assert.equal(await call.count(), 0, '악성 구분자가 섞인 전화는 전화 링크를 만들지 않음');
  const validCall = page.locator('[data-oi-request="req-review"] a[href^="tel:"]');
  assert.equal(await validCall.count(), 1, '유효한 관리사무소 전화 버튼');
  assert.equal(await validCall.getAttribute('href'), 'tel:01033334444', 'tel href는 안전한 숫자로만 정규화');

  await page.evaluate(() => {
    const b = document.querySelector('[data-oi-accept="req-xss"]');
    b.click(); b.click();
  });
  await page.waitForTimeout(120);
  const accepted = await page.evaluate(() => ({
    orders: state.aptOrders.filter(o => o.sourceRequestId === 'req-xss'),
    request: officeIntakeFindRequest('req-xss'),
    queued: officeIntakeData().outbox.filter(x => x.action === 'officeAccept').map(x => x.payload)
  }));
  assert.equal(accepted.orders.length, 1, '오더 등록을 두 번 눌러도 하나만 생성');
  assert.equal(accepted.request.status, 'accepted', '로컬 오더가 만들어진 뒤에만 승인 상태');
  assert.deepEqual(accepted.queued, [{ requestId: 'req-xss', hyeonjangOrderId: accepted.orders[0].id, attachedUploadIds:[] }], '실패한 승인 연결은 정확한 요청·오더 ID와 첨부 ack로 큐잉');

  const parallelApproval = await page.evaluate(async () => {
    officeIntakeData().inbox.push({
      requestId: 'req-idempotent', receiptNo: 'MM-UI-0003', officeId: 'of-ui', unit: '101동 101호', location: '',
      issueType: '기타', pipeType: '미확정', urgency: 'normal', description: '동시 승인 방지',
      officeContact: { name: '관리소', phone: '010-5555-6666' }, photos: [], status: 'pending_review'
    });
    const results = await Promise.all([officeIntakeAccept('req-idempotent', 'none'), officeIntakeAccept('req-idempotent', 'none')]);
    return { results: results.map(Boolean), orders: state.aptOrders.filter(o => o.sourceRequestId === 'req-idempotent').length };
  });
  assert.deepEqual(parallelApproval.results, [true, true], '동시 승인 재시도는 기존 오더를 반환');
  assert.equal(parallelApproval.orders, 1, '동시 승인 재시도도 오더 한 건만 보존');

  const projectModes = await page.evaluate(async () => {
    const addRequest = id => officeIntakeData().inbox.push({
      requestId: id, receiptNo: id, officeId: 'of-ui', unit: '공용부', location: '', issueType: '기타', pipeType: '미확정',
      urgency: 'normal', description: '현장 연결', officeContact: { name: '관리소', phone: '010-7777-8888' }, photos: [], status: 'pending_review'
    });
    addRequest('req-existing-project');
    const before = state.projects.map(p => p.name);
    const existing = await officeIntakeAccept('req-existing-project', 'existing', '기존 현장');
    const afterExisting = state.projects.map(p => p.name);
    addRequest('req-new-project');
    const created = await officeIntakeAccept('req-new-project', 'new', '새 현장');
    return { before, afterExisting, afterNew: state.projects.map(p => p.name), existingProject: existing.project, newProject: created.project };
  });
  assert.deepEqual(projectModes.afterExisting, projectModes.before, '기존 현장 연결은 새 현장을 만들지 않음');
  assert.equal(projectModes.existingProject, '기존 현장');
  assert.equal(projectModes.newProject, '새 현장');
  assert.equal(projectModes.afterNew.filter(name => name === '새 현장').length, 1, '새 현장은 기존 현장 추가 헬퍼로 한 번만 생성');

  const reviewActions = await page.evaluate(async () => {
    const ordersBefore = state.aptOrders.length;
    const promptBefore = window.prompt;
    window.prompt = () => 'a'.repeat(301);
    const needs = await officeIntakeNeedsInfo('req-review');
    const afterNeeds = { status: officeIntakeFindRequest('req-review').status, orders: state.aptOrders.length, payload: officeIntakeData().outbox.slice(-1)[0].payload };
    const hold = await officeIntakeHold('req-review');
    const afterHold = { status: officeIntakeFindRequest('req-review').status, orders: state.aptOrders.length, action: officeIntakeData().outbox.slice(-1)[0].action, payload: officeIntakeData().outbox.slice(-1)[0].payload };
    const beforeCancel = JSON.stringify({ status: officeIntakeFindRequest('req-review').status, outbox: officeIntakeData().outbox, orders: state.aptOrders });
    window.prompt = () => null;
    const cancelled = await officeIntakeNeedsInfo('req-review');
    window.prompt = promptBefore;
    return { ordersBefore, needs, afterNeeds, hold, afterHold, cancelled, unchanged: beforeCancel === JSON.stringify({ status: officeIntakeFindRequest('req-review').status, outbox: officeIntakeData().outbox, orders: state.aptOrders }) };
  });
  assert.equal(reviewActions.needs, true, '내용 보완 요청 처리');
  assert.equal(reviewActions.afterNeeds.status, 'needs_info');
  assert.equal(reviewActions.afterNeeds.orders, reviewActions.ordersBefore, '보완 요청은 오더를 만들지 않음');
  assert.equal(reviewActions.afterNeeds.payload.status, 'needs_info');
  assert.equal(reviewActions.afterNeeds.payload.reason.length, 300, '보완 사유는 300자로 제한');
  assert.equal(reviewActions.hold, true, '보류 처리');
  assert.equal(reviewActions.afterHold.status, 'on_hold');
  assert.equal(reviewActions.afterHold.orders, reviewActions.ordersBefore, '보류는 오더를 만들지 않음');
  assert.equal(reviewActions.afterHold.action, 'officeSetStatus');
  assert.deepEqual(reviewActions.afterHold.payload, { requestId: 'req-review', status: 'on_hold' }, '보류 큐 동작');
  assert.equal(reviewActions.cancelled, false, '보완 사유 입력 취소');
  assert.equal(reviewActions.unchanged, true, '입력 취소는 상태·큐·오더를 바꾸지 않음');

  const reviewGuards = await page.evaluate(async () => {
    const request = (requestId, status) => ({
      requestId, receiptNo: requestId, officeId: 'of-ui', unit: '공용부', location: '계단', issueType: '기타', pipeType: '미확정', urgency: 'normal', description: requestId,
      officeContact: { name: '관리소', phone: '010-7777-8888' }, photos: [], status
    });
    state.aptOrders = [];
    state.projects = [{ name: '기존 현장', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }];
    state.officeIntake = { inbox: [request('matrix-pending', 'pending_review'), request('matrix-needs', 'needs_info'), request('matrix-hold', 'on_hold')], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    officeIntakeOpen();
    const buttons = id => [...document.querySelectorAll('[data-oi-request="' + id + '"] button')].map(button => button.textContent.trim());
    const snapshot = () => JSON.stringify({ orders: state.aptOrders, projects: state.projects, inbox: officeIntakeData().inbox, outbox: officeIntakeData().outbox });
    const reject = async fn => { const before = snapshot(); const result = await fn(); return { result: !!result, unchanged: before === snapshot() }; };
    const invalidNeedsAccept = await reject(() => officeIntakeAccept('matrix-needs', 'none'));
    const invalidHoldNeeds = await reject(() => officeIntakeNeedsInfo('matrix-hold'));
    const invalidHoldAgain = await reject(() => officeIntakeHold('matrix-hold'));
    const invalidMode = await reject(() => officeIntakeAccept('matrix-pending', 'surprise', '무시되면 안 됨'));
    const missingExisting = await reject(() => officeIntakeAccept('matrix-pending', 'existing', '없는 현장'));
    const newCollision = await reject(() => officeIntakeAccept('matrix-pending', 'new', '기존 현장'));
    const promptBefore = window.prompt;
    window.prompt = () => '   ';
    const blankNeeds = await reject(() => officeIntakeNeedsInfo('matrix-pending'));
    window.prompt = promptBefore;
    const existing = await officeIntakeAccept('matrix-pending', 'existing', '기존 현장');
    const projectCountAfterExisting = state.projects.length;
    const duplicateExisting = await officeIntakeAccept('matrix-pending', 'new', '새로 만들면 안 됨');
    const projectCountAfterDuplicate = state.projects.length;
    const heldRequest = officeIntakeFindRequest('matrix-hold'); heldRequest.needsInfoReason = '보완 사진 대기';
    const held = await officeIntakeAccept('matrix-hold', 'new', '새 현장');
    const heldAfterAccept = { status: heldRequest.status, reason: heldRequest.needsInfoReason };
    const holdAfterNeeds = await officeIntakeHold('matrix-needs');
    state.officeIntake.inbox.push(request('recovery-ok', 'pending_review'), request('recovery-fail', 'on_hold'), request('recovery-needs', 'needs_info'));
    officeIntakeFindRequest('recovery-fail').needsInfoReason = '기존 보완 사유';
    const recoveryOrder = { id: 'recovery-order', sourceRequestId: 'recovery-ok', project: '기존 현장' };
    const recoveryFailedOrder = { id: 'recovery-failed-order', sourceRequestId: 'recovery-fail', project: '기존 현장' };
    state.aptOrders.push(recoveryOrder, recoveryFailedOrder);
    const recoveryCalls = [], priorCloud = window.cloudOfficeAccept;
    window.cloudOfficeAccept = async (requestId, orderId, attachedUploadIds) => { recoveryCalls.push({ requestId, orderId, attachedUploadIds }); return requestId === 'recovery-fail' ? { ok: false, error: 'offline' } : { ok: true }; };
    const recoverySuccess = await officeIntakeAccept('recovery-ok', 'new', '만들면 안 됨');
    const recoveryIdempotent = await officeIntakeAccept('recovery-ok', 'none');
    const recoveryFailure = await officeIntakeAccept('recovery-fail', 'existing', '없는 현장도 보지 않음');
    const recoveryNeeds = await reject(() => officeIntakeAccept('recovery-needs', 'none'));
    window.cloudOfficeAccept = priorCloud;
    const recovery = {
      success: recoverySuccess && recoverySuccess.id, failure: recoveryFailure && recoveryFailure.id, idempotent: recoveryIdempotent && recoveryIdempotent.id,
      calls: recoveryCalls, projects: state.projects.map(project => project.name), orders: state.aptOrders.filter(order => /^recovery-/.test(order.sourceRequestId)).map(order => order.id),
      successRequest: officeIntakeFindRequest('recovery-ok'), failureRequest: officeIntakeFindRequest('recovery-fail'), recoveryNeeds,
      queued: officeIntakeData().outbox.filter(item => item.action === 'officeAccept' && /^recovery-/.test(item.payload.requestId)).map(item => item.payload),
      pendingIds: officeIntakePending().map(item => item.requestId)
    };
    const phoneChecks = ['010-1234-5678', '+82 10 1234 5678', '010-1234-5678;evil', '010abc12345678', '+12'].map(value => ({ value, tel: officeIntakeTel(value) }));
    state.officeIntake.inbox.push(request('sequence', 'pending_review'));
    const events = [], originalPush = state.aptOrders.push, originalDirty = window.markDirty, originalAccept = window.cloudOfficeAccept;
    state.aptOrders.push = function () { events.push('push'); return originalPush.apply(this, arguments); };
    window.markDirty = () => events.push('dirty');
    window.cloudOfficeAccept = async () => { events.push('cloud'); return { ok: false, error: 'offline' }; };
    const sequence = await officeIntakeAccept('sequence', 'none');
    state.aptOrders.push = originalPush; window.markDirty = originalDirty; window.cloudOfficeAccept = originalAccept;
    return { buttons: { pending: buttons('matrix-pending'), needs: buttons('matrix-needs'), hold: buttons('matrix-hold') }, invalidNeedsAccept, invalidHoldNeeds, invalidHoldAgain, invalidMode, missingExisting, newCollision, blankNeeds,
      existingProject: existing && existing.project, existingIdentity: existing && existing.projectIdentity, existingProjectIdentity: state.projects.find(project => project.name === '기존 현장').officeIntakeProjectId,
      projectCountAfterExisting, duplicateProject: duplicateExisting && duplicateExisting.project, projectCountAfterDuplicate,
      heldProject: held && held.project, heldIdentity: held && held.projectIdentity, heldProjectIdentity: state.projects.find(project => project.name === '새 현장').officeIntakeProjectId,
      heldAfterAccept, holdAfterNeeds: !!holdAfterNeeds, recovery, phoneChecks, events, sequenceQueued: officeIntakeData().outbox.filter(item => item.action === 'officeAccept' && item.payload.requestId === 'sequence').map(item => item.payload), sequenceId: sequence && sequence.id };
  });
  assert.deepEqual(reviewGuards.buttons, { pending: ['오더 등록', '내용 보완 요청', '보류'], needs: ['보류'], hold: ['오더 등록'] }, '상태별로 허용된 검토 버튼만 렌더링');
  for (const key of ['invalidNeedsAccept', 'invalidHoldNeeds', 'invalidHoldAgain', 'invalidMode', 'missingExisting', 'newCollision', 'blankNeeds']) assert.deepEqual(reviewGuards[key], { result: false, unchanged: true }, key + '는 로컬 상태를 바꾸지 않음');
  assert.equal(reviewGuards.existingProject, '기존 현장');
  assert.match(reviewGuards.existingIdentity, /^office-project-[a-z0-9]{7}$/i);
  assert.equal(reviewGuards.existingIdentity, reviewGuards.existingProjectIdentity, '기존 현장 선택 시 오더와 현장에 같은 stable identity 저장');
  assert.equal(reviewGuards.projectCountAfterExisting, 1, '기존 현장 연결은 현장을 추가하지 않음');
  assert.equal(reviewGuards.duplicateProject, '기존 현장', '이미 승인된 접수는 기존 오더만 반환');
  assert.equal(reviewGuards.projectCountAfterDuplicate, 1, '중복 승인은 새 현장을 만들지 않음');
  assert.equal(reviewGuards.heldProject, '새 현장', '보류 접수는 새 현장 승인 허용');
  assert.equal(reviewGuards.heldIdentity, reviewGuards.heldProjectIdentity, '새 현장 생성 승인도 stable identity로 명시 연결');
  assert.deepEqual(reviewGuards.heldAfterAccept, { status: 'accepted', reason: null }, '보류 사유는 로컬 승인 전에 해결 처리');
  assert.equal(reviewGuards.holdAfterNeeds, true, '보완 요청 상태는 보류 허용');
  assert.equal(reviewGuards.recovery.success, 'recovery-order');
  assert.equal(reviewGuards.recovery.failure, 'recovery-failed-order');
  assert.equal(reviewGuards.recovery.idempotent, 'recovery-order', 'already accepted existing order does not call cloud twice');
  assert.deepEqual(reviewGuards.recovery.calls, [{ requestId: 'recovery-ok', orderId: 'recovery-order', attachedUploadIds:[] }, { requestId: 'recovery-fail', orderId: 'recovery-failed-order', attachedUploadIds:[] }], 'existing orders recover through their exact cloud approval IDs and attachment ack');
  assert.deepEqual(reviewGuards.recovery.projects, ['기존 현장', '새 현장'], 'recovery creates no project');
  assert.deepEqual(reviewGuards.recovery.orders, ['recovery-order', 'recovery-failed-order'], 'recovery creates no duplicate order');
  assert.equal(reviewGuards.recovery.successRequest.status, 'accepted');
  assert.equal(reviewGuards.recovery.successRequest.needsInfoReason, null);
  assert.equal(reviewGuards.recovery.failureRequest.status, 'accepted');
  assert.equal(reviewGuards.recovery.failureRequest.needsInfoReason, null, 'recovered on_hold clears its reason before local persistence');
  assert.deepEqual(reviewGuards.recovery.recoveryNeeds, { result: false, unchanged: true }, 'needs_info recovery has zero side effects');
  assert.deepEqual(reviewGuards.recovery.queued, [{ requestId: 'recovery-fail', hyeonjangOrderId: 'recovery-failed-order', attachedUploadIds:[] }], 'failed existing-order recovery queues one exact approval retry');
  assert.equal(reviewGuards.recovery.pendingIds.includes('recovery-ok'), false, 'successful recovery no longer renders as a pending row');
  assert.equal(reviewGuards.recovery.pendingIds.includes('recovery-fail'), false, 'queued recovery no longer renders as a pending row');
  assert.deepEqual(reviewGuards.phoneChecks, [
    { value: '010-1234-5678', tel: '01012345678' }, { value: '+82 10 1234 5678', tel: '+821012345678' },
    { value: '010-1234-5678;evil', tel: '' }, { value: '010abc12345678', tel: '' }, { value: '+12', tel: '' }
  ], '안전한 국내/E.164 전화만 tel href로 정규화');
  assert.deepEqual(reviewGuards.events.slice(0, 3), ['push', 'dirty', 'cloud'], '로컬 오더 저장과 dirty가 서버 승인보다 먼저 실행');
  assert.deepEqual(reviewGuards.sequenceQueued, [{ requestId: 'sequence', hyeonjangOrderId: reviewGuards.sequenceId, attachedUploadIds:[] }], '실패한 승인 호출은 한 번만 정확히 큐잉');

  const finalSafety = await page.evaluate(async () => {
    const linked = state.aptOrders.find(order => order && order.source === 'office-intake');
    const deleteBlocked = !officeIntakeDeleteGuard(linked);
    const project = state.projects.find(item => item.name === '기존 현장');
    project.officeIntakeProjectId = 'office-project-abc1234';
    const projectOrder = Object.assign({}, linked, { id: 'completion-project', unit: '103동 1204호', project: '기존 현장', projectIdentity: 'office-project-abc1234', intakePhotoIds: ['intake-only'] });
    state.files.push({ id: 'field-before', kind: 'photo', project: '기존 현장', name: '103동1204호_시공전.jpg', _driveId: 'field-before-drive', _driveMimeType: 'image/jpeg', _driveSize: 1024, _virtual: false });
    state.files.push({ id: 'field-after', kind: 'photo', project: '기존 현장', name: '103동1204호_시공후.webp', _driveId: 'field-after-drive', _driveMimeType: 'image/webp', _driveSize: 2048, _virtual: false });
    state.files.push({ id: 'cross-project', kind: 'photo', project: '타현장', name: '103동1204호_타현장.jpg', _driveId: 'cross-project-drive', _driveMimeType: 'image/jpeg', _driveSize: 1024, _virtual: false });
    state.files.push({ id: 'field-heic', kind: 'photo', project: '기존 현장', name: '103동1204호_HEIC.heic', _driveId: 'field-heic-drive', _driveMimeType: 'image/heic', _driveSize: 1024, _virtual: false });
    state.files.push({ id: 'field-large', kind: 'photo', project: '기존 현장', name: '103동1204호_대용량.jpg', _driveId: 'field-large-drive', _driveMimeType: 'image/jpeg', _driveSize: 2 * 1024 * 1024 + 1, _virtual: false });
    state.files.push({ id: 'field-unknown', kind: 'photo', project: '기존 현장', name: '103동1204호_정보없음.jpg', _driveId: 'field-unknown-drive', _virtual: false });
    const completion = officeCompletionPhotoIds(projectOrder);
    const unlinked = officeCompletionPhotoIds(Object.assign({}, projectOrder, { project: '', projectIdentity: '' }));
    const sentinel = officeCompletionPhotoIds(Object.assign({}, projectOrder, { project: '현장 미연결', projectIdentity: '' }));
    const legacyNameOnly = officeCompletionPhotoIds(Object.assign({}, projectOrder, { projectIdentity: '' }));
    const unlinkedReport = officeIntakeCompletionPayload(Object.assign({}, projectOrder, { project: '', projectIdentity: '', publicPhotoIds: ['cross-project-drive', 'intake-only'] }));
    const workProjection = officeIntakeProjectionPayload(Object.assign({}, projectOrder, { status: 'work' }));
    const doneProjection = officeIntakeProjectionPayload(Object.assign({}, projectOrder, { status: 'done' }));
    const cancelled = { requestId: 'req-cancel-race', receiptNo: 'MM-RACE', officeId: 'of-ui', unit: '105동 501호', location: '', issueType: '누수', pipeType: '미확정', urgency: 'normal', description: '취소 경합', officeContact: {}, photos: [], status: 'pending_review' };
    officeIntakeData().inbox.push(cancelled);
    const original = window.cloudOfficeAccept;
    window.cloudOfficeAccept = async () => ({ ok: false, error: 'invalid-transition', status: 'cancelled', hyeonjangOrderId: null });
    const result = await officeIntakeAccept('req-cancel-race', 'none');
    window.cloudOfficeAccept = original;
    return { deleteBlocked, completion, unlinked, sentinel, legacyNameOnly, unlinkedReport,
      workHasManifest: Object.prototype.hasOwnProperty.call(workProjection, 'completionPhotoIds'),
      doneManifest: doneProjection.completionPhotoIds,
      result: !!result, localRaceOrders: state.aptOrders.filter(order => order && order.sourceRequestId === 'req-cancel-race').length, raceOutbox: officeIntakeData().outbox.filter(item => item && item.payload && item.payload.requestId === 'req-cancel-race').length, raceStatus: cancelled.status };
  });
  assert.equal(finalSafety.deleteBlocked, true, '연결된 관리사무소 오더는 로컬 삭제 경로에서 차단');
  assert.deepEqual(finalSafety.completion, ['field-before-drive', 'field-after-drive'], '명시적으로 연결한 project identity 소유 Drive 현장 사진만 completion manifest 후보');
  assert.deepEqual({ unlinked: finalSafety.unlinked, sentinel: finalSafety.sentinel, legacyNameOnly: finalSafety.legacyNameOnly }, { unlinked: [], sentinel: [], legacyNameOnly: [] }, '현장 미연결·빈 project·legacy 이름-only 연결은 completion manifest를 fail-closed');
  assert.deepEqual({ photoIds: finalSafety.unlinkedReport.photoIds, publicPhotoIds: finalSafety.unlinkedReport.publicPhotoIds }, { photoIds: ['intake-only'], publicPhotoIds: ['intake-only'] }, '미연결 접수는 자기 접수 사진만 완료 보고에 사용할 수 있고 타현장 사진은 제외');
  assert.deepEqual({ workHasManifest: finalSafety.workHasManifest, doneManifest: finalSafety.doneManifest }, { workHasManifest: false, doneManifest: ['field-before-drive', 'field-after-drive'] }, '비완료 상태는 manifest를 보내지 않고 완료 상태만 JPEG/PNG/WebP·2MiB 이하·metadata 완비 후보를 보냄');
  assert.deepEqual({ result: finalSafety.result, localRaceOrders: finalSafety.localRaceOrders, raceOutbox: finalSafety.raceOutbox, raceStatus: finalSafety.raceStatus }, { result: false, localRaceOrders: 0, raceOutbox: 0, raceStatus: 'cancelled' }, '취소 경합은 ghost 오더·FIFO 재시도 없이 서버 상태로 정리');

  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(layout.width <= layout.viewport, '390px 모바일 가로 넘침 없음: ' + JSON.stringify(layout));
  assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await browser.close();
  browser = null;
  console.log('PASS  office intake review UI, XSS, idempotent approval, and mobile layout');
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});

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

const APP = 'http://localhost:8299/index.html';
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
  assert.equal(await call.count(), 1, '관리사무소 전화 버튼');
  assert.match(String(await call.getAttribute('href')), /^tel:\+?\d+$/, 'tel href는 숫자와 선행 +만 허용');

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
  assert.deepEqual(accepted.queued, [{ requestId: 'req-xss', hyeonjangOrderId: accepted.orders[0].id }], '실패한 승인 연결은 정확한 요청·오더 ID로 큐잉');

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

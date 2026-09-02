'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const appendFailuresBySheet = new Map();
const rangeWriteFailuresBySheet = new Map();
const dataRangeReadsBySheet = new Map();

class RangeMock {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }
  getValues() {
    const output = [];
    for (let r = 0; r < this.rowCount; r += 1) {
      const source = this.sheet.rows[this.row - 1 + r] || [];
      const row = [];
      for (let c = 0; c < this.columnCount; c += 1) row.push(source[this.column - 1 + c] ?? '');
      output.push(row);
    }
    return output;
  }
  setValues(values) {
    const failures = rangeWriteFailuresBySheet.get(this.sheet.name) || 0;
    if (failures > 0) {
      rangeWriteFailuresBySheet.set(this.sheet.name, failures - 1);
      throw new Error(`simulated ${this.sheet.name} range write failure`);
    }
    for (let r = 0; r < this.rowCount; r += 1) {
      const rowIndex = this.row - 1 + r;
      while (this.sheet.rows.length <= rowIndex) this.sheet.rows.push([]);
      for (let c = 0; c < this.columnCount; c += 1) {
        this.sheet.rows[rowIndex][this.column - 1 + c] = values[r][c];
      }
    }
    return this;
  }
}

class SheetMock {
  constructor(name) { this.name = name; this.rows = []; }
  getRange(row, column, rowCount, columnCount) { return new RangeMock(this, row, column, rowCount, columnCount); }
  getDataRange() {
    dataRangeReadsBySheet.set(this.name, (dataRangeReadsBySheet.get(this.name) || 0) + 1);
    const columns = Math.max(1, ...this.rows.map(row => row.length));
    return new RangeMock(this, 1, 1, Math.max(1, this.rows.length), columns);
  }
  appendRow(row) {
    const failures = appendFailuresBySheet.get(this.name) || 0;
    if (failures > 0) {
      appendFailuresBySheet.set(this.name, failures - 1);
      throw new Error(`simulated ${this.name} append failure`);
    }
    this.rows.push(Array.from(row));
  }
  deleteRow(rowNumber) {
    assert(Number.isInteger(rowNumber) && rowNumber >= 1 && rowNumber <= this.rows.length);
    this.rows.splice(rowNumber - 1, 1);
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  setFrozenRows() {}
}

class SpreadsheetMock {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const sheet = new SheetMock(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

const properties = new Map([
  ['OFFICE_PORTAL_ENABLED', '1'],
  ['OFFICE_PORTAL_SHEET_ID', 'sheet_for_unit_test'],
  ['OFFICE_PORTAL_SESSION_SECRET', 'unit-test-session-secret-that-is-over-32-characters'],
  ['OFFICE_PORTAL_OTP_PEPPER', 'unit-test-otp-pepper-that-is-different-and-long'],
  ['OFFICE_PORTAL_LOGIN_PEPPER', 'unit-test-login-pepper-that-is-different-and-long'],
]);
const spreadsheet = new SpreadsheetMock();
const cacheValues = new Map();
let uuidCounter = 0;
let lockWaitCount = 0;

const sandbox = {
  console,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, String(value)),
      deleteProperty: key => properties.delete(key),
    }),
  },
  SpreadsheetApp: { openById: id => {
    assert.equal(id, 'sheet_for_unit_test');
    return spreadsheet;
  } },
  LockService: { getScriptLock: () => ({ waitLock() { lockWaitCount += 1; }, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({
    get: key => cacheValues.get(key) ?? null,
    put: (key, value) => cacheValues.set(key, String(value)),
  }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    getUuid: () => {
      uuidCounter += 1;
      return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
    },
    computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(String(value)).digest()),
    computeHmacSha256Signature: (value, key) => Array.from(crypto.createHmac('sha256', String(key)).update(String(value)).digest()),
    base64EncodeWebSafe: bytes => Buffer.from(Array.from(bytes, value => value & 255)).toString('base64url'),
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: text => ({
      text,
      setMimeType() { return this; },
      getContent() { return this.text; },
    }),
  },
};
vm.createContext(sandbox);
for (const filename of ['PortalPure.gs', 'Code.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script-office-portal', filename), 'utf8'), sandbox, { filename });
}
const plain = value => JSON.parse(JSON.stringify(value));
const catches = (fn, code) => assert.throws(fn, error => error && error.portalCode === code);

const legacyUsers = spreadsheet.insertSheet('Users');
const legacyUserHeaders = plain(sandbox.PORTAL_HEADERS.Users).slice(0, 13);
legacyUsers.appendRow(legacyUserHeaders);
sandbox.portalSetupSheets_();
assert.deepEqual(legacyUsers.rows[0].slice(0, 13), legacyUserHeaders,
  'v3 migration must preserve every v2 Users header in place');
assert.deepEqual(legacyUsers.rows[0], plain(sandbox.PORTAL_HEADERS.Users),
  'v3 migration must append login security headers');
assert.deepEqual(Array.from(spreadsheet.sheets.keys()).sort(), [
  'CostItems', 'ManagementLogs', 'ManagementStatus', 'Notices', 'Offices', 'OtpChallenges',
  'PortalAudit', 'PortalOperations', 'RolePermissions', 'Sessions', 'Users', 'WorkOrders',
]);
for (const name of ['WorkOrders', 'Notices', 'CostItems']) spreadsheet.sheets.delete(name);
const existingSheetSnapshot = new Map(Array.from(spreadsheet.sheets.entries()).map(([name, sheet]) => [name, JSON.stringify(sheet.rows)]));
sandbox.portalSetupSheets_();
for (const [name, snapshot] of existingSheetSnapshot) {
  assert.equal(JSON.stringify(spreadsheet.getSheetByName(name).rows), snapshot,
    `schema v3 setup modified existing ${name} rows`);
}
for (const name of ['WorkOrders', 'Notices', 'CostItems']) assert(spreadsheet.getSheetByName(name));

const now = new Date().toISOString();
function addOffice(officeId, slug, name) {
  sandbox.portalSaveRow_('Offices', {
    officeId, slug, complexName: name, enabled: true, permissionVersion: 1, createdAt: now, updatedAt: now,
  });
}
function addUser(userId, officeId, email, name, role, unit = '') {
  const user = {
    userId, officeId, email,
    emailHash: sandbox.portalHmac_('OFFICE_PORTAL_OTP_PEPPER', email),
    displayName: name, role, unit, enabled: true, sessionVersion: 0, permissionVersion: 0,
    createdAt: now, updatedAt: now, lastLoginAt: '',
  };
  sandbox.portalSetUserLoginCode_(user, '123456', now);
  sandbox.portalSaveRow_('Users', user);
}
addOffice('of_system', 'system', '시스템 관리');
addOffice('of_alpha', 'alpha', '알파아파트');
addOffice('of_beta', 'beta', '베타아파트');
addUser('usr_sys', 'of_system', 'sys@example.com', '시스템 관리자', 'system_admin');
addUser('usr_chief_a', 'of_alpha', 'chief-a@example.com', '알파 관리소장', 'manager_chief');
addUser('usr_fac_a', 'of_alpha', 'fac-a@example.com', '알파 관리과장', 'facility_manager');
addUser('usr_rep_a', 'of_alpha', 'rep-a@example.com', '알파 동대표', 'resident_rep');
addUser('usr_res_a', 'of_alpha', 'res-a@example.com', '알파 입주민', 'resident', '101-1001');
addUser('usr_chief_b', 'of_beta', 'chief-b@example.com', '베타 관리소장', 'manager_chief');
addUser('usr_bad', 'of_alpha', 'attempts@example.com', '시도 제한', 'resident');
addUser('usr_fail', 'of_alpha', 'delivery@example.com', '메일 실패', 'resident');
addUser('usr_expired', 'of_alpha', 'expired@example.com', '만료 검증', 'resident');
addUser('usr_gate', 'of_alpha', 'gate@example.com', '전역 제한', 'resident');
addUser('usr_email_change', 'of_alpha', 'old-email@example.com', '이메일 변경', 'resident');
addUser('usr_permission_durable', 'of_alpha', 'permission-durable@example.com', '권한 내구성', 'resident');
addUser('usr_fac_ops', 'of_alpha', 'facility-ops@example.com', '운영 관리과장', 'facility_manager');

function post(body) {
  return JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
function newRequestId() {
  return sandbox.Utilities.getUuid().toLowerCase();
}
const health = post({ action: 'portalHealth' });
assert.equal(health.ok, true);
assert.equal(health.enabled, true);
assert(!Object.hasOwn(health, 'data'), 'success response must be flat for the frontend contract');
assert.deepEqual(post({ action: 'portalMe' }), { ok: false, error: 'session-expired' });
assert.deepEqual(post({ action: 'notAnAction' }), { ok: false, error: 'bad-request' });
assert.deepEqual(JSON.parse(sandbox.doPost({ postData: { contents: '{bad json' } }).getContent()), { ok: false, error: 'bad-request' });
assert.deepEqual(post({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'unknown@example.com', loginCode: '123456' },
}), { ok: false, error: 'invalid-credentials' });

function login(officeCode, email) {
  return sandbox.portalDispatch_({
    action: 'portalLogin', payload: { officeCode, email, loginCode: '123456' },
  });
}

const chiefA = login('alpha', 'chief-a@example.com');
assert.equal(chiefA.user.id, 'usr_chief_a');
assert.equal(chiefA.user.name, '알파 관리소장');
assert(chiefA.user.permissions.includes('admin.users.manage'));
assert(chiefA.permissions.includes('admin.users.manage'));
assert.equal(typeof chiefA.expiresAt, 'number');
const chiefSessionRow = sandbox.portalRows_('Sessions').find(row => row.userId === 'usr_chief_a');
assert(chiefSessionRow.tokenHash);
assert(!Object.values(chiefSessionRow).includes(chiefA.sessionToken), 'raw session token must never be stored');
const chiefUserRow = sandbox.portalUserById_('usr_chief_a');
assert(chiefUserRow.loginCodeHash && chiefUserRow.loginCodeSalt);
assert(!Object.values(chiefUserRow).includes('123456'), 'raw login code must never be stored');

const me = sandbox.portalDispatch_({ action: 'portalMe', sessionToken: chiefA.sessionToken });
assert.deepEqual(Object.keys(plain(me.user)).sort(), ['active', 'email', 'id', 'loginCodeConfigured', 'name', 'permissions', 'role'].sort());
assert.deepEqual(plain(me.permissions), plain(me.user.permissions));
assert.equal(typeof me.expiresAt, 'number');

for (let index = 0; index < 100; index += 1) {
  addUser(`usr_bulk_${index}`, 'of_alpha', `bulk-${index}@example.com`, `대량 사용자 ${index}`, 'resident');
}
const userListContext = sandbox.portalAuthenticate_(chiefA.sessionToken);
const roleReadsBeforeUserList = dataRangeReadsBySheet.get('RolePermissions') || 0;
const bulkUserList = sandbox.portalUserList_(userListContext, {});
const roleReadsAfterUserList = dataRangeReadsBySheet.get('RolePermissions') || 0;
assert(bulkUserList.users.length >= 100);
assert.equal(roleReadsAfterUserList - roleReadsBeforeUserList, 1,
  'portalUserList must read RolePermissions once regardless of user count');

const facilityOps = login('alpha', 'facility-ops@example.com');
assert(facilityOps.permissions.includes('workorders.manage'));
assert(!facilityOps.permissions.includes('workorders.assign'));
assert(!facilityOps.permissions.includes('notices.publish'));
assert(!facilityOps.permissions.includes('costs.approve'));
const operationCount = () => sandbox.portalRows_('PortalOperations').length;

const workOrderCreated = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), receiptNo: '20260901-001', title: '지하실 주철관 보수',
    location: '지하실', category: '배관', priority: 'urgent', status: 'received',
    assigneeUserId: 'usr_fac_ops', dueDate: '2026-09-05', instructions: '누수 구간 확인 후 보수',
    visibility: 'internal', revision: 0,
  },
});
assert.equal(workOrderCreated.workOrder.assigneeUserId, 'usr_fac_ops');
const facilityWorkOrders = sandbox.portalDispatch_({
  action: 'portalWorkOrderList', sessionToken: facilityOps.sessionToken,
});
assert(!Object.hasOwn(facilityWorkOrders, 'assignees'));
const chiefWorkOrderContext = sandbox.portalAuthenticate_(chiefA.sessionToken);
const usersReadsBeforeChiefWorkOrders = dataRangeReadsBySheet.get('Users') || 0;
const chiefWorkOrders = sandbox.portalWorkOrderList_(chiefWorkOrderContext, {});
const usersReadsAfterChiefWorkOrders = dataRangeReadsBySheet.get('Users') || 0;
assert.equal(usersReadsAfterChiefWorkOrders - usersReadsBeforeChiefWorkOrders, 1,
  'work-order rows and assignment candidates must share one Users read');
assert(chiefWorkOrders.assignees.some(user => user.id === 'usr_fac_ops'));
assert(chiefWorkOrders.assignees.every(user => Object.keys(user).sort().join(',') === 'id,name,role'));
const facilityWorkOrderRows = facilityWorkOrders.workOrders;
assert(facilityWorkOrderRows.some(row => row.workOrderId === workOrderCreated.workOrder.workOrderId));
assert.equal(workOrderCreated.workOrder.assigneeName, '운영 관리과장');
catches(() => sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), title: '임의 배정', location: '기계실', category: '배관',
    priority: 'normal', status: 'received', assigneeUserId: 'usr_fac_ops', dueDate: '',
    instructions: '임의 배정 금지', visibility: 'internal', revision: 0,
  },
}), 'forbidden');
const workOrderWorkingRequestId = newRequestId();
const workOrderWorkingPayload = {
  requestId: workOrderWorkingRequestId, workOrderId: workOrderCreated.workOrder.workOrderId,
  receiptNo: '20260901-001', title: '지하실 주철관 보수', location: '지하실', category: '배관',
  priority: 'urgent', status: 'planned', dueDate: '2026-09-05',
  instructions: '작업 계획 확정', visibility: 'internal', revision: workOrderCreated.workOrder.revision,
};
const workOrderWorking = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: workOrderWorkingPayload,
});
assert.equal(workOrderWorking.workOrder.assigneeUserId, 'usr_fac_ops',
  'an editor without assign permission must preserve an omitted existing assignee');
const workOrderReassigned = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), ...workOrderWorking.workOrder, assigneeUserId: 'usr_fac_a',
  },
});
const workOrderWorkingReplay = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: workOrderWorkingPayload,
});
assert.equal(workOrderWorkingReplay.replayed, true,
  'an omitted-assignee retry hash must stay stable after another user reassigns the work order');
assert.equal(workOrderWorkingReplay.workOrder.assigneeUserId, 'usr_fac_a');
const workOrderActive = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), ...workOrderReassigned.workOrder, status: 'working', instructions: '작업 중',
  },
});
const workOrderCompleted = sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), ...workOrderActive.workOrder, status: 'completed',
    instructions: '작업 완료', visibility: 'board',
  },
});
const operationsBeforeInvalidCompletedWorkOrder = operationCount();
catches(() => sandbox.portalDispatch_({
  action: 'portalWorkOrderSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), ...workOrderCompleted.workOrder, status: 'working', instructions: '완료 후 변조',
  },
}), 'invalid_transition');
assert.equal(operationCount(), operationsBeforeInvalidCompletedWorkOrder,
  'a rejected work-order transition must not leave a started operation');

const noticeDraft = sandbox.portalDispatch_({
  action: 'portalNoticeSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), title: '단수 안내', content: '오전 9시부터 단수 예정',
    visibility: 'public', state: 'draft', publishDate: '2026-01-01', expiresDate: '2026-12-31', revision: 0,
  },
});
const operationsBeforeForbiddenNoticePublish = operationCount();
catches(() => sandbox.portalDispatch_({
  action: 'portalNoticeSave', sessionToken: facilityOps.sessionToken,
  payload: { requestId: newRequestId(), ...noticeDraft.notice, state: 'published' },
}), 'forbidden');
assert.equal(operationCount(), operationsBeforeForbiddenNoticePublish,
  'a rejected notice publish must not leave a started operation');
const noticePublished = sandbox.portalDispatch_({
  action: 'portalNoticeSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), ...noticeDraft.notice, state: 'published' },
});
assert.equal(noticePublished.notice.state, 'published');

const costSubmitted = sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), workOrderId: workOrderCompleted.workOrder.workOrderId,
    category: '배관', description: '주철관 보수비', amountKrw: 450000,
    taxMode: 'included', status: 'submitted', revision: 0,
  },
});
const operationsBeforeSubmittedCostEdit = operationCount();
catches(() => sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), ...costSubmitted.cost, description: '승인 요청 후 임의 수정',
  },
}), 'invalid_transition');
assert.equal(operationCount(), operationsBeforeSubmittedCostEdit,
  'a rejected submitted-cost edit must not leave a started operation');
catches(() => sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: facilityOps.sessionToken,
  payload: { requestId: newRequestId(), costId: costSubmitted.cost.costId, targetState: 'approved', revision: costSubmitted.cost.revision },
}), 'forbidden');
const costApproved = sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), costId: costSubmitted.cost.costId, targetState: 'approved', revision: costSubmitted.cost.revision },
});
catches(() => sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), ...costApproved.cost, description: '승인 후 변조', status: 'submitted',
  },
}), 'invalid_transition');
const costPaid = sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), costId: costApproved.cost.costId, targetState: 'paid', revision: costApproved.cost.revision },
});
assert.equal(costPaid.cost.status, 'paid');
const costDraftExcluded = sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), category: '자재', description: '부가세 별도 초안', amountKrw: 100000,
    taxMode: 'excluded', status: 'draft', revision: 0,
  },
});
const costPendingExempt = sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), category: '인건비', description: '면세 승인 요청', amountKrw: 50000,
    taxMode: 'exempt', status: 'submitted', revision: 0,
  },
});
const costApprovalBase = sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), category: '장비', description: '부가세 별도 승인 건', amountKrw: 200000,
    taxMode: 'excluded', status: 'submitted', revision: 0,
  },
});
const costApprovedUnpaid = sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), costId: costApprovalBase.cost.costId,
    targetState: 'approved', revision: costApprovalBase.cost.revision,
  },
});
const costCancelBase = sandbox.portalDispatch_({
  action: 'portalCostSave', sessionToken: facilityOps.sessionToken,
  payload: {
    requestId: newRequestId(), category: '기타', description: '취소 예정 비용', amountKrw: 70000,
    taxMode: 'included', status: 'submitted', revision: 0,
  },
});
const costCancelled = sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), costId: costCancelBase.cost.costId,
    targetState: 'cancelled', revision: costCancelBase.cost.revision,
  },
});
assert.equal(costDraftExcluded.cost.status, 'draft');
assert.equal(costPendingExempt.cost.status, 'submitted');
assert.equal(costApprovedUnpaid.cost.status, 'approved');
assert.equal(costCancelled.cost.status, 'cancelled');
const operationsBeforeInvalidPaidTransition = operationCount();
catches(() => sandbox.portalDispatch_({
  action: 'portalCostApprove', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), costId: costPaid.cost.costId,
    targetState: 'approved', revision: costPaid.cost.revision,
  },
}), 'invalid_transition');
assert.equal(operationCount(), operationsBeforeInvalidPaidTransition,
  'a rejected cost transition must not leave a started operation');

const internal = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), officeId: 'of_beta', location: '지하실', category: '배관', state: 'repair', summary: '주철관 보수', visibility: 'internal' },
});
const board = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), location: '관리동', category: '전기', state: 'watch', summary: '분전반 점검', visibility: 'board' },
});
const publicStatus = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), location: '놀이터', category: '시설', state: 'normal', summary: '정기 점검 완료', visibility: 'public' },
});
assert(internal.status.statusId && board.status.statusId && publicStatus.status.statusId);
const storedInternal = sandbox.portalRows_('ManagementStatus').find(row => row.statusId === internal.status.statusId);
assert.equal(storedInternal.officeId, 'of_alpha', 'payload officeId must not override the session office');
const statusCountBeforeFormula = sandbox.portalRows_('ManagementStatus').length;
assert.deepEqual(post({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(),
    location: '지하실', category: '배관', state: 'repair',
    summary: '=IMPORTDATA("https://invalid.example")', visibility: 'internal',
  },
}), { ok: false, error: 'invalid-input' });
assert.equal(sandbox.portalRows_('ManagementStatus').length, statusCountBeforeFormula,
  'formula-like text must be rejected before a Sheets row is written');

sandbox.portalDispatch_({
  action: 'portalLogSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), workDate: '2026-09-01', category: '순찰', title: '저녁 순찰', content: '이상 없음', visibility: 'public' },
});

const dashboardContext = sandbox.portalAuthenticate_(chiefA.sessionToken);
const dashboardOnly = { ...dashboardContext, permissions: ['dashboard.view'] };
const hiddenDashboard = plain(sandbox.portalDashboard_(dashboardOnly));
assert.equal(hiddenDashboard.counts.statuses, 0);
assert.equal(hiddenDashboard.counts.logs, 0);
assert.deepEqual(hiddenDashboard.recentStatuses, []);
assert.deepEqual(hiddenDashboard.recentLogs, []);
assert.deepEqual(hiddenDashboard.notices, []);
assert(!hiddenDashboard.metrics.some(metric => ['관리 상태', '관리 일지', '공지'].includes(metric.label)),
  'dashboard leaked metrics without the corresponding view capability');
const statusDashboard = plain(sandbox.portalDashboard_({
  ...dashboardContext, permissions: ['dashboard.view', 'status.view'],
}));
assert(statusDashboard.counts.statuses > 0);
assert.equal(statusDashboard.counts.logs, 0);
assert(statusDashboard.recentStatuses.length > 0);
assert.deepEqual(statusDashboard.recentLogs, []);

const auditFailureRequestId = newRequestId();
const auditFailurePayload = {
  requestId: auditFailureRequestId,
  location: '옥상', category: '배수', state: 'repair', summary: '우수관 보수', visibility: 'internal',
};
const statusRowsBeforeAuditFailure = sandbox.portalRows_('ManagementStatus').length;
appendFailuresBySheet.set('PortalAudit', 1);
const auditPendingCreate = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken, payload: auditFailurePayload,
});
assert.equal(auditPendingCreate.auditPending, true);
assert.equal(sandbox.portalRows_('ManagementStatus').length, statusRowsBeforeAuditFailure + 1);
const pendingOperation = sandbox.portalRows_('PortalOperations').find(row => row.requestId === auditFailureRequestId);
assert.equal(pendingOperation.status, 'audit_pending');
const auditRetryCreate = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken, payload: auditFailurePayload,
});
assert.equal(auditRetryCreate.replayed, true);
assert.equal(auditRetryCreate.auditPending, false);
assert.equal(auditRetryCreate.status.statusId, auditPendingCreate.status.statusId);
assert.equal(sandbox.portalRows_('ManagementStatus').length, statusRowsBeforeAuditFailure + 1,
  'audit repair retry must not create a duplicate status');
assert.equal(sandbox.portalRows_('PortalAudit').filter(row => row.auditId === sandbox.portalOperationAuditId_(pendingOperation)).length, 1,
  'operation audit must be deterministic and unique');
assert.deepEqual(post({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken,
  payload: { ...auditFailurePayload, summary: '같은 requestId의 다른 입력' },
}), { ok: false, error: 'invalid-input' });

const statusUpdateRequestId = newRequestId();
const statusUpdatePayload = {
  requestId: statusUpdateRequestId,
  statusId: auditPendingCreate.status.statusId,
  location: '옥상', category: '배수', state: 'complete', summary: '우수관 보수 완료',
  visibility: 'internal', revision: auditPendingCreate.status.revision,
};
const statusUpdated = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken, payload: statusUpdatePayload,
});
const statusUpdateReplay = sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefA.sessionToken, payload: statusUpdatePayload,
});
assert.equal(statusUpdateReplay.replayed, true);
assert.equal(statusUpdateReplay.status.revision, statusUpdated.status.revision,
  'same update request must not increment revision twice');

const logRequestId = newRequestId();
const logPayload = {
  requestId: logRequestId, workDate: '2026-09-01', category: '보수', title: '우수관 보수',
  content: '부품 교체 완료', visibility: 'internal',
};
const logRowsBeforeReplay = sandbox.portalRows_('ManagementLogs').length;
appendFailuresBySheet.set('PortalAudit', 1);
const logCreated = sandbox.portalDispatch_({
  action: 'portalLogSave', sessionToken: chiefA.sessionToken, payload: logPayload,
});
assert.equal(logCreated.auditPending, true);
const repairedAudits = plain(sandbox.portalRepairPendingOperationAudits_());
assert.equal(repairedAudits.repaired, 1);
assert.equal(repairedAudits.pending, 0);
const logReplayed = sandbox.portalDispatch_({
  action: 'portalLogSave', sessionToken: chiefA.sessionToken, payload: logPayload,
});
assert.equal(logReplayed.replayed, true);
assert.equal(logReplayed.log.logId, logCreated.log.logId);
assert.equal(sandbox.portalRows_('ManagementLogs').length, logRowsBeforeReplay + 1);

const userRequestId = newRequestId();
const userPayload = {
  requestId: userRequestId, email: 'dedupe@example.com', name: '재시도 입주민',
  role: 'resident', active: true, unit: '102-202', loginCode: '654321',
};
const userRowsBeforeReplay = sandbox.portalRows_('Users').length;
appendFailuresBySheet.set('PortalAudit', 1);
const userCreated = sandbox.portalDispatch_({
  action: 'portalUserSave', sessionToken: chiefA.sessionToken, payload: userPayload,
});
assert.equal(userCreated.auditPending, true);
const userReplayed = sandbox.portalDispatch_({
  action: 'portalUserSave', sessionToken: chiefA.sessionToken, payload: userPayload,
});
assert.equal(userReplayed.replayed, true);
assert.equal(userReplayed.auditPending, false);
assert.equal(userReplayed.user.id, userCreated.user.id);
assert.equal(sandbox.portalRows_('Users').length, userRowsBeforeReplay + 1);

const partialPermissionRequestId = newRequestId();
sandbox.portalSaveRow_('RolePermissions', {
  officeId: 'of_alpha', userId: userCreated.user.id, role: 'resident',
  capability: 'dashboard.view', allowed: false, updatedAt: now, updatedBy: 'usr_chief_a',
});
const partialPermissionPayload = {
  requestId: partialPermissionRequestId, userId: userCreated.user.id,
  permissions: ['dashboard.view', 'status.view'],
};
appendFailuresBySheet.set('RolePermissions', 1);
assert.throws(() => sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: partialPermissionPayload,
}), /simulated RolePermissions append failure/);
assert.equal(sandbox.portalRows_('PortalOperations').find(row => row.requestId === partialPermissionRequestId).status,
  'started');
const partialPermissionVersionBeforeRetry = Number(sandbox.portalUserById_(userCreated.user.id).permissionVersion);
const recoveredPartialPermission = sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: partialPermissionPayload,
});
assert.equal(recoveredPartialPermission.replayed, true);
assert.equal(Number(sandbox.portalUserById_(userCreated.user.id).permissionVersion), partialPermissionVersionBeforeRetry + 1,
  'partial permission retry must finish absolute writes and bump version once');

const permissionRequestId = newRequestId();
const permissionPayload = {
  requestId: permissionRequestId, userId: 'usr_rep_a',
  permissions: ['dashboard.view', 'status.view', 'reports.view', 'notices.view'],
};
const permissionVersionBefore = Number(sandbox.portalUserById_('usr_rep_a').permissionVersion);
appendFailuresBySheet.set('PortalAudit', 1);
const permissionPending = sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: permissionPayload,
});
assert.equal(permissionPending.auditPending, true);
const permissionReplayed = sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: permissionPayload,
});
assert.equal(permissionReplayed.replayed, true);
assert.equal(Number(sandbox.portalUserById_('usr_rep_a').permissionVersion), permissionVersionBefore + 1,
  'permission retry must not increment permissionVersion twice');

const repA = login('alpha', 'rep-a@example.com');
const residentA = login('alpha', 'res-a@example.com');
const repStatuses = sandbox.portalDispatch_({ action: 'portalStatusList', sessionToken: repA.sessionToken }).statuses;
const residentStatuses = sandbox.portalDispatch_({ action: 'portalStatusList', sessionToken: residentA.sessionToken }).statuses;
assert.deepEqual(repStatuses.map(row => row.visibility).sort(), ['board', 'public']);
assert.deepEqual(residentStatuses.map(row => row.visibility), ['public']);
assert(repStatuses.every(row => !Object.hasOwn(row, 'officeId') && !Object.hasOwn(row, 'updatedBy')));
const residentLogs = sandbox.portalDispatch_({ action: 'portalLogList', sessionToken: residentA.sessionToken }).logs;
assert.equal(residentLogs[0].logId.startsWith('log_'), true);
assert.equal(residentLogs[0].content, '이상 없음');
const residentNotices = sandbox.portalDispatch_({ action: 'portalNoticeList', sessionToken: residentA.sessionToken }).notices;
assert(residentNotices.some(row => row.noticeId === noticePublished.notice.noticeId));
assert(!residentNotices.some(row => row.noticeId === noticeDraft.notice.noticeId && row.state === 'draft'));
const repReport = sandbox.portalDispatch_({
  action: 'portalReportSummary', sessionToken: repA.sessionToken,
  payload: { startDate: '2026-01-01', endDate: '2026-12-31' },
}).report;
assert(!Object.hasOwn(repReport, 'totalAmountKrw'));
assert(!Object.hasOwn(repReport, 'pendingAmountKrw'));
assert(!Object.hasOwn(repReport, 'approvedUnpaidAmountKrw'));
assert(!Object.hasOwn(repReport, 'paidAmountKrw'));
assert(!Object.hasOwn(repReport, 'amountKrwByStatus'));
assert(!Object.hasOwn(repReport.counts, 'costs'));
assert.equal(repReport.counts.workOrders, 1,
  'reports.view must include visibility-filtered work order aggregates without exposing rows');
const chiefReportContext = sandbox.portalAuthenticate_(chiefA.sessionToken);
const usersReadsBeforeChiefReport = dataRangeReadsBySheet.get('Users') || 0;
const chiefReport = sandbox.portalReportSummary_(chiefReportContext, {
  startDate: '2026-01-01', endDate: '2026-12-31',
}).report;
assert.equal((dataRangeReadsBySheet.get('Users') || 0) - usersReadsBeforeChiefReport, 0,
  'aggregate reports must not load assignee names');
assert.equal(sandbox.portalReportDate_('2026-08-31T15:30:00.000Z'), '2026-09-01',
  'UTC timestamps must be grouped by the Asia/Seoul operating date');
assert.equal(sandbox.portalReportDate_('2026-09-01'), '2026-09-01');
assert.equal(chiefReport.totalAmountKrw, 830000);
assert.equal(chiefReport.pendingAmountKrw, 160000);
assert.equal(chiefReport.approvedUnpaidAmountKrw, 220000);
assert.equal(chiefReport.paidAmountKrw, 450000);
assert.equal(chiefReport.amountKrwByStatus.paid, 450000);
assert.equal(chiefReport.amountKrwByStatus.draft, 110000);
assert.equal(chiefReport.amountKrwByStatus.submitted, 50000);
assert.equal(chiefReport.amountKrwByStatus.approved, 220000);
assert.equal(chiefReport.amountKrwByStatus.cancelled, 70000);
assert(chiefReport.counts.workOrders >= 1 && chiefReport.counts.notices >= 1);
const operationsDashboard = sandbox.portalDispatch_({ action: 'portalDashboard', sessionToken: chiefA.sessionToken });
assert(operationsDashboard.counts.workOrders >= 1);
assert(operationsDashboard.counts.notices >= 1);
assert(operationsDashboard.notices.every(notice => !Object.hasOwn(notice, 'content')),
  'dashboard notice summaries must not include notice bodies');
assert(!operationsDashboard.metrics.some(metric => metric.label === '접수 대기'));

const chiefB = login('beta', 'chief-b@example.com');
assert.equal(sandbox.portalDispatch_({ action: 'portalWorkOrderList', sessionToken: chiefB.sessionToken }).workOrders.length, 0);
assert.equal(sandbox.portalDispatch_({ action: 'portalNoticeList', sessionToken: chiefB.sessionToken }).notices.length, 0);
assert.equal(sandbox.portalDispatch_({ action: 'portalCostList', sessionToken: chiefB.sessionToken }).costs.length, 0);
sandbox.portalDispatch_({
  action: 'portalStatusSave', sessionToken: chiefB.sessionToken,
  payload: { requestId: newRequestId(), location: '베타동', category: '시설', state: 'normal', summary: '타 단지 데이터', visibility: 'public' },
});
const residentAfterBeta = sandbox.portalDispatch_({ action: 'portalStatusList', sessionToken: residentA.sessionToken }).statuses;
assert(!residentAfterBeta.some(row => row.summary === '타 단지 데이터'), 'cross-office content leaked');

const system = login('system', 'sys@example.com');
catches(() => sandbox.portalDispatch_({ action: 'portalDashboard', sessionToken: system.sessionToken }), 'forbidden');

const facility = login('alpha', 'fac-a@example.com');
sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), userId: 'usr_fac_a', permissions: ['dashboard.view', 'status.view', 'logs.view'] },
});
catches(() => sandbox.portalDispatch_({ action: 'portalMe', sessionToken: facility.sessionToken }), 'session_stale');
const facilityAgain = login('alpha', 'fac-a@example.com');
assert(facilityAgain.user.permissions.includes('status.manage'), 'view override removed status.manage');
assert(facilityAgain.user.permissions.includes('logs.manage'), 'view override removed logs.manage');
assert(!facilityAgain.user.permissions.includes('reports.view'));
catches(() => sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), userId: 'usr_res_a', permissions: ['status.manage'] },
}), 'invalid_permissions');

const durablePermissionSession = login('alpha', 'permission-durable@example.com');
const durablePermissionRequestId = newRequestId();
const durablePermissionPayload = {
  requestId: durablePermissionRequestId,
  userId: 'usr_permission_durable',
  permissions: ['dashboard.view', 'status.view'],
};
rangeWriteFailuresBySheet.set('Users', 1);
assert.throws(() => sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: durablePermissionPayload,
}), /simulated Users range write failure/);
assert.equal(Number(sandbox.portalUserById_('usr_permission_durable').permissionVersion), 0,
  'failed Users write must leave the durable permissionVersion unchanged');
assert.equal(sandbox.portalDispatch_({
  action: 'portalMe', sessionToken: durablePermissionSession.sessionToken,
}).user.id, 'usr_permission_durable', 'old session remains valid until durable retry finishes');
const durablePermissionRetry = sandbox.portalDispatch_({
  action: 'portalPermissionSave', sessionToken: chiefA.sessionToken, payload: durablePermissionPayload,
});
assert.equal(durablePermissionRetry.replayed, true);
assert.equal(Number(sandbox.portalUserById_('usr_permission_durable').permissionVersion), 1,
  'started operation retry must durably bump permissionVersion');
catches(() => sandbox.portalDispatch_({
  action: 'portalMe', sessionToken: durablePermissionSession.sessionToken,
}), 'session_stale');

catches(() => sandbox.portalDispatch_({
  action: 'portalUserSave', sessionToken: chiefA.sessionToken,
  payload: { requestId: newRequestId(), userId: 'usr_chief_a', email: 'chief-a@example.com', name: '알파 관리소장', role: 'manager_chief', active: false, unit: '' },
}), 'self_lockout_prevented');
catches(() => sandbox.portalDispatch_({
  action: 'portalUserSave', sessionToken: system.sessionToken,
  payload: { requestId: newRequestId(), officeId: 'of_alpha', userId: 'usr_chief_a', email: 'chief-a@example.com', name: '알파 관리소장', role: 'facility_manager', active: true, unit: '' },
}), 'last_manager_chief');

sandbox.portalDispatch_({
  action: 'portalUserSave', sessionToken: chiefA.sessionToken,
  payload: {
    requestId: newRequestId(), userId: 'usr_email_change', email: 'new-email@example.com',
    name: '이메일 변경', role: 'resident', active: true, unit: '', loginCode: '654321',
  },
});
assert.deepEqual(post({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'old-email@example.com', loginCode: '123456' },
}), { ok: false, error: 'invalid-credentials' });
assert.equal(sandbox.portalDispatch_({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'new-email@example.com', loginCode: '654321' },
}).user.id, 'usr_email_change');
const changedUser = sandbox.portalUserById_('usr_email_change');
assert(changedUser.loginCodeHash && changedUser.loginCodeSalt);
assert(!Object.values(changedUser).includes('654321'), 'raw changed login code must never be stored');

const genericInvalidCredentials = { ok: false, error: 'invalid-credentials' };
assert.deepEqual(post({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'expired@example.com', loginCode: '000000' },
}), genericInvalidCredentials, 'wrong login code must use the generic credential error');

const gateBucket = Math.floor(Date.now() / (sandbox.PORTAL_LOGIN_GLOBAL_WINDOW_SECONDS * 1000));
const gateCacheKey = `office-portal-login-global-${gateBucket}`;
cacheValues.set(gateCacheKey, String(sandbox.PORTAL_LOGIN_GLOBAL_WINDOW_LIMIT));
const lockWaitsBeforeGate = lockWaitCount;
assert.deepEqual(post({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'gate@example.com', loginCode: '123456' },
}), { ok: false, error: 'rate-limited' });
assert.equal(lockWaitCount, lockWaitsBeforeGate,
  'login flood gate must reject before taking the global script lock');
cacheValues.delete(gateCacheKey);

for (let attempt = 1; attempt <= 5; attempt += 1) {
  catches(() => sandbox.portalDispatch_({ action: 'portalLogin',
    payload: { officeCode: 'alpha', email: 'attempts@example.com', loginCode: '999999' },
  }), attempt === 5 ? 'rate_limited' : 'invalid_credentials');
}
catches(() => sandbox.portalDispatch_({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'attempts@example.com', loginCode: '123456' },
}), 'rate_limited');
const lockedUser = sandbox.portalUserById_('usr_bad');
assert.equal(Number(lockedUser.loginFailedAttempts), 5);
assert(sandbox.portalTime_(lockedUser.loginLockedUntil) > Date.now());
lockedUser.loginLockedUntil = new Date(Date.now() - 1000).toISOString();
sandbox.portalSaveRow_('Users', lockedUser);
assert.equal(login('alpha', 'attempts@example.com').user.id, 'usr_bad');

properties.set('OFFICE_PORTAL_BOOTSTRAP_SLUG', 'alpha');
properties.set('OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL', 'delivery@example.com');
properties.set('OFFICE_PORTAL_BOOTSTRAP_LOGIN_CODE', '456789');
const ownerReset = plain(sandbox.portalSetLoginCodeFromProperties_());
assert.equal(ownerReset.userId, 'usr_fail');
assert.equal(ownerReset.loginCodeConfigured, true);
for (const key of ['OFFICE_PORTAL_BOOTSTRAP_SLUG', 'OFFICE_PORTAL_BOOTSTRAP_ADMIN_EMAIL', 'OFFICE_PORTAL_BOOTSTRAP_LOGIN_CODE']) {
  assert.equal(properties.has(key), false, `${key} must be deleted after owner reset`);
}
assert.equal(sandbox.portalDispatch_({
  action: 'portalLogin', payload: { officeCode: 'alpha', email: 'delivery@example.com', loginCode: '456789' },
}).user.id, 'usr_fail');

const audits = sandbox.portalRows_('PortalAudit');
const auditJson = JSON.stringify(audits);
for (const forbiddenValue of [chiefA.sessionToken, '123456', '654321', '456789', 'chief-a@example.com', '주철관 보수', '이상 없음']) {
  assert(!auditJson.includes(forbiddenValue), `audit leaked sensitive/content value: ${forbiddenValue}`);
}
const auditList = sandbox.portalDispatch_({
  action: 'portalAuditList', sessionToken: chiefA.sessionToken, payload: { limit: 200 },
}).audit;
assert(auditList.every(row => row.createdAt && Object.hasOwn(row, 'summary') && row.actorName));

sandbox.portalDispatch_({ action: 'portalLogout', sessionToken: residentA.sessionToken });
catches(() => sandbox.portalDispatch_({ action: 'portalMe', sessionToken: residentA.sessionToken }), 'session_expired');

const dayMs = 24 * 60 * 60 * 1000;
const daysAgo = days => new Date(Date.now() - days * dayMs).toISOString();
sandbox.portalSaveRow_('OtpChallenges', {
  challengeId: 'otp_prune_old', createdAt: daysAgo(9), expiresAt: daysAgo(8),
  usedAt: '', revokedAt: '', attempts: 0,
});
sandbox.portalSaveRow_('OtpChallenges', {
  challengeId: 'otp_keep_recent', createdAt: daysAgo(7), expiresAt: daysAgo(6),
  usedAt: '', revokedAt: '', attempts: 0,
});
sandbox.portalSaveRow_('Sessions', {
  sessionId: 'ses_prune_old', tokenHash: 'hash-old', issuedAt: daysAgo(32), expiresAt: daysAgo(31),
  revokedAt: '',
});
sandbox.portalSaveRow_('Sessions', {
  sessionId: 'ses_keep_recent', tokenHash: 'hash-recent', issuedAt: daysAgo(30), expiresAt: daysAgo(29),
  revokedAt: '',
});
sandbox.portalSaveRow_('PortalOperations', {
  requestId: '11111111-1111-4111-8111-111111111111', status: 'complete',
  action: 'portalStatusSave', entityType: 'status', entityId: 'sts_old',
  createdAt: daysAgo(100), updatedAt: daysAgo(91),
});
sandbox.portalSaveRow_('PortalOperations', {
  requestId: '22222222-2222-4222-8222-222222222222', status: 'complete',
  action: 'portalStatusSave', entityType: 'status', entityId: 'sts_recent',
  createdAt: daysAgo(90), updatedAt: daysAgo(89),
});
sandbox.portalSaveRow_('PortalOperations', {
  requestId: '33333333-3333-4333-8333-333333333333', status: 'audit_pending',
  action: 'portalStatusSave', entityType: 'status', entityId: 'sts_pending',
  createdAt: daysAgo(100), updatedAt: daysAgo(99),
});
const durableCountsBeforePrune = {
  statuses: sandbox.portalRows_('ManagementStatus').length,
  logs: sandbox.portalRows_('ManagementLogs').length,
  audit: sandbox.portalRows_('PortalAudit').length,
};
const pruneResult = plain(sandbox.portalPruneExpiredAuthRows_());
assert.equal(pruneResult.otpChallengesDeleted, 1);
assert.equal(pruneResult.sessionsDeleted, 1);
assert.equal(pruneResult.operationsDeleted, 1);
assert.equal(typeof pruneResult.prunedAt, 'string');
assert(!sandbox.portalRows_('OtpChallenges').some(row => row.challengeId === 'otp_prune_old'));
assert(sandbox.portalRows_('OtpChallenges').some(row => row.challengeId === 'otp_keep_recent'));
assert(!sandbox.portalRows_('Sessions').some(row => row.sessionId === 'ses_prune_old'));
assert(sandbox.portalRows_('Sessions').some(row => row.sessionId === 'ses_keep_recent'));
assert(!sandbox.portalRows_('PortalOperations').some(row => row.requestId === '11111111-1111-4111-8111-111111111111'));
assert(sandbox.portalRows_('PortalOperations').some(row => row.requestId === '22222222-2222-4222-8222-222222222222'));
assert(sandbox.portalRows_('PortalOperations').some(row => row.requestId === '33333333-3333-4333-8333-333333333333'),
  'pending operation must never be pruned by age');
assert.deepEqual({
  statuses: sandbox.portalRows_('ManagementStatus').length,
  logs: sandbox.portalRows_('ManagementLogs').length,
  audit: sandbox.portalRows_('PortalAudit').length,
}, durableCountsBeforePrune, 'auth pruning must never delete status, log, or audit rows');
assert(!plain(sandbox.PORTAL_ACTIONS).includes('portalPruneExpiredAuthRows_'),
  'the prune function must not be exposed as a public web action');

console.log('PASS  office portal server admin login code, lockout, hashed session, RBAC, office isolation, redaction, and admin safety');

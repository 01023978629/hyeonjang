'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script-office-portal', 'PortalPure.gs'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const plain = value => JSON.parse(JSON.stringify(value));

assert.deepEqual(plain(sandbox.PORTAL_CAPABILITIES), [
  'dashboard.view', 'status.view', 'status.manage', 'logs.view', 'logs.manage',
  'requests.view', 'reports.view', 'notices.view', 'notices.manage', 'notices.publish',
  'costs.view', 'costs.manage', 'costs.approve',
  'workorders.view', 'workorders.manage', 'workorders.assign',
  'admin.users.view', 'admin.users.manage', 'admin.permissions.manage', 'admin.audit.view',
]);
assert.deepEqual(plain(sandbox.PORTAL_VIEW_CAPABILITIES), [
  'dashboard.view', 'status.view', 'logs.view', 'requests.view', 'reports.view',
  'notices.view', 'costs.view', 'workorders.view', 'admin.users.view', 'admin.audit.view',
]);
assert.equal(sandbox.portalPureRequestId_('01234567-89ab-4cde-8f01-23456789abcd'),
  '01234567-89ab-4cde-8f01-23456789abcd');
assert.throws(() => sandbox.portalPureRequestId_('not-a-uuid'), /requestId is invalid/);

const systemPermissions = plain(sandbox.portalPureEffectivePermissions_('system_admin', []));
assert(systemPermissions.includes('admin.users.manage'));
assert(!systemPermissions.includes('dashboard.view'), 'system_admin must not receive content access by default');
assert(!systemPermissions.includes('status.view'));

const facilityPermissions = plain(sandbox.portalPureEffectivePermissions_('facility_manager', [
  { capability: 'status.view', allowed: false },
]));
assert(!facilityPermissions.includes('status.view'));
assert(!facilityPermissions.includes('status.manage'), 'removing module view must also remove write capability');
assert(facilityPermissions.includes('logs.manage'));
const dependencyPermissions = plain(sandbox.portalPureEffectivePermissions_('manager_chief', [
  { capability: 'workorders.view', allowed: false },
  { capability: 'notices.view', allowed: false },
  { capability: 'costs.view', allowed: false },
  { capability: 'admin.users.view', allowed: false },
]));
for (const capability of [
  'workorders.manage', 'workorders.assign', 'notices.manage', 'notices.publish',
  'costs.manage', 'costs.approve', 'admin.users.manage', 'admin.permissions.manage',
]) assert(!dependencyPermissions.includes(capability), `${capability} survived its removed view capability`);

assert.deepEqual(plain(sandbox.portalPurePermissionSet_('resident', ['dashboard.view', 'status.view'])), [
  'dashboard.view', 'status.view',
]);
assert.throws(() => sandbox.portalPurePermissionSet_('resident', ['status.manage']), /only view permissions/);
assert.throws(() => sandbox.portalPurePermissionSet_('resident', ['admin.users.view']), /role ceiling/);
assert.throws(() => sandbox.portalPurePermissionSet_('resident', ['status.view', 'status.view']), /duplicated/);

const statusInput = plain(sandbox.portalPureRecordInput_({
  location: '지하 기계실', category: '배관', state: 'repair', summary: '주철관 보수 중',
  visibility: 'board', revision: 2,
}, 'status'));
assert.equal(statusInput.location, '지하 기계실');
assert.equal(statusInput.state, 'repair');
assert.throws(() => sandbox.portalPureRecordInput_({
  location: 'A', category: '배관', state: 'planned', summary: 'x', visibility: 'public',
}, 'status'), /state is invalid/);
assert.throws(() => sandbox.portalPureRecordInput_({
  location: 'A', category: '배관', state: 'normal', summary: 'x', visibility: 'own_unit',
}, 'status'), /visibility is invalid/);

const logInput = plain(sandbox.portalPureRecordInput_({
  workDate: '2026-09-01', category: '순찰', title: '저녁 순찰', content: '이상 없음',
  visibility: 'public', revision: 0,
}, 'log'));
assert.equal(logInput.workDate, '2026-09-01');
assert.equal(logInput.content, '이상 없음');

const workOrderInput = plain(sandbox.portalPureWorkOrderInput_({
  receiptNo: '20260901-001', title: '지하실 배관 보수', location: '지하실', category: '배관',
  priority: 'urgent', status: 'received', assigneeUserId: '', dueDate: '2026-09-03',
  instructions: '누수 구간 확인 후 보수', visibility: 'internal', revision: 0,
}));
assert.equal(workOrderInput.priority, 'urgent');
assert(sandbox.portalPureWorkOrderTransitionAllowed_('planned', 'working'));
assert(!sandbox.portalPureWorkOrderTransitionAllowed_('completed', 'working'));
const noticeInput = plain(sandbox.portalPureNoticeInput_({
  title: '단수 안내', content: '오전 중 단수 예정', visibility: 'public', state: 'draft',
  publishDate: '2026-09-02', expiresDate: '2026-09-03', revision: 0,
}));
assert.equal(noticeInput.state, 'draft');
assert(sandbox.portalPureNoticeTransitionAllowed_('draft', 'published'));
assert(!sandbox.portalPureNoticeTransitionAllowed_('published', 'draft'));
assert.throws(() => sandbox.portalPureNoticeInput_({
  title: '날짜 오류', content: '오류', visibility: 'public', state: 'draft',
  publishDate: '2026-09-04', expiresDate: '2026-09-03',
}), /date range/);
const costInput = plain(sandbox.portalPureCostInput_({
  category: '배관', description: '보수 자재', amountKrw: 120000, taxMode: 'included', status: 'submitted',
}));
assert.equal(costInput.amountKrw, 120000);
assert.throws(() => sandbox.portalPureCostInput_({
  category: '배관', description: '비정상', amountKrw: 1000000001, taxMode: 'included', status: 'draft',
}), /amountKrw/);
assert(sandbox.portalPureCostTransitionAllowed_('submitted', 'approved'));
assert(!sandbox.portalPureCostTransitionAllowed_('paid', 'approved'));

const baseStatus = {
  statusId: 'sts_1', officeId: 'of_alpha', location: '101동', category: '배관',
  state: 'repair', summary: '작업 중', visibility: 'internal', updatedAt: '2026-09-01T00:00:00.000Z',
  revision: 1, updatedBy: 'usr_chief',
};
const staff = { officeId: 'of_alpha', userId: 'usr_staff', role: 'facility_manager', unit: '' };
const representative = { officeId: 'of_alpha', userId: 'usr_rep', role: 'resident_rep', unit: '' };
const resident = { officeId: 'of_alpha', userId: 'usr_res', role: 'resident', unit: '101-1001' };
assert(sandbox.portalPureCanSeeRecord_(baseStatus, staff));
assert(!sandbox.portalPureCanSeeRecord_(baseStatus, representative));
assert(!sandbox.portalPureCanSeeRecord_(baseStatus, resident));
assert(sandbox.portalPureCanSeeRecord_({ ...baseStatus, visibility: 'board' }, representative));
assert(!sandbox.portalPureCanSeeRecord_({ ...baseStatus, visibility: 'board' }, resident));
assert(sandbox.portalPureCanSeeRecord_({ ...baseStatus, visibility: 'public' }, resident));
assert(!sandbox.portalPureCanSeeRecord_({ ...baseStatus, officeId: 'of_beta', visibility: 'public' }, resident));

const projected = plain(sandbox.portalPureProjectRecord_({ ...baseStatus, visibility: 'public' }, resident, 'status'));
assert.equal(projected.statusId, 'sts_1');
assert(!Object.hasOwn(projected, 'officeId'));
assert(!Object.hasOwn(projected, 'updatedBy'));
const projectedLog = plain(sandbox.portalPureProjectRecord_({
  logId: 'log_1', officeId: 'of_alpha', workDate: '2026-09-01', category: '점검',
  title: '옥상 점검', content: '완료', visibility: 'public', createdAt: 'x', updatedAt: 'y', revision: 1,
}, resident, 'log'));
assert.equal(projectedLog.logId, 'log_1');

const userInput = plain(sandbox.portalPureUserInput_({
  email: 'USER@EXAMPLE.COM', name: '관리자', role: 'manager_chief', active: true, unit: '',
}));
assert.equal(userInput.email, 'user@example.com');
assert.equal(userInput.name, '관리자');
assert.equal(userInput.active, true);

const unsafeFormulaPrefixes = ['=', '+', '-', '@', '\t', '\r', '\n', ' ='];
function assertUnsafeTextRejected(field, build) {
  for (const prefix of unsafeFormulaPrefixes) {
    assert.throws(build(prefix + 'IMPORTDATA("https://invalid.example")'), error => (
      error && error.portalCode === `invalid_${field}`
    ), `${field} accepted unsafe Sheets prefix ${JSON.stringify(prefix)}`);
  }
}
assertUnsafeTextRejected('location', value => () => sandbox.portalPureRecordInput_({
  location: value, category: '배관', state: 'repair', summary: '보수', visibility: 'internal',
}, 'status'));
assertUnsafeTextRejected('category', value => () => sandbox.portalPureRecordInput_({
  location: '지하실', category: value, state: 'repair', summary: '보수', visibility: 'internal',
}, 'status'));
assertUnsafeTextRejected('summary', value => () => sandbox.portalPureRecordInput_({
  location: '지하실', category: '배관', state: 'repair', summary: value, visibility: 'internal',
}, 'status'));
assertUnsafeTextRejected('title', value => () => sandbox.portalPureRecordInput_({
  workDate: '2026-09-01', category: '순찰', title: value, content: '이상 없음', visibility: 'public',
}, 'log'));
assertUnsafeTextRejected('content', value => () => sandbox.portalPureRecordInput_({
  workDate: '2026-09-01', category: '순찰', title: '저녁 순찰', content: value, visibility: 'public',
}, 'log'));
assertUnsafeTextRejected('name', value => () => sandbox.portalPureUserInput_({
  email: 'user@example.com', name: value, role: 'resident', active: true, unit: '',
}));
assertUnsafeTextRejected('unit', value => () => sandbox.portalPureUserInput_({
  email: 'user@example.com', name: '입주민', role: 'resident', active: true, unit: value,
}));
assertUnsafeTextRejected('email', value => () => sandbox.portalPureUserInput_({
  email: value, name: '입주민', role: 'resident', active: true, unit: '',
}));
assertUnsafeTextRejected('complexName', value => () => sandbox.portalPureOfficeInput_({
  officeId: 'of_formula', slug: 'formula', complexName: value, enabled: true,
}));
assertUnsafeTextRejected('instructions', value => () => sandbox.portalPureWorkOrderInput_({
  title: '작업', location: '지하실', category: '배관', priority: 'normal', status: 'received',
  instructions: value, visibility: 'internal',
}));
assertUnsafeTextRejected('description', value => () => sandbox.portalPureCostInput_({
  category: '배관', description: value, amountKrw: 1, taxMode: 'included', status: 'draft',
}));

const safeUser = plain(sandbox.portalPureSafeUser_({
  userId: 'usr_1', email: 'user@example.com', displayName: '관리자', role: 'manager_chief',
  enabled: true, unit: '', permissions: ['dashboard.view'],
}, true));
assert.deepEqual(safeUser, {
  id: 'usr_1', name: '관리자', role: 'manager_chief', active: true,
  permissions: ['dashboard.view'], email: 'user@example.com',
});

function loadMutant(from, to) {
  const mutatedSource = source.replace(from, to);
  assert.notEqual(mutatedSource, source, 'mutation target not found');
  const mutated = {};
  vm.createContext(mutated);
  vm.runInContext(mutatedSource, mutated);
  return mutated;
}
function assertCriticalInvariants(api) {
  const permissions = plain(api.portalPureEffectivePermissions_('manager_chief', [
    { capability: 'costs.view', allowed: false },
    { capability: 'workorders.view', allowed: false },
    { capability: 'notices.view', allowed: false },
  ]));
  assert(!permissions.includes('costs.approve'), 'cost approval survived removed cost view');
  assert(!permissions.includes('workorders.assign'), 'work-order assignment survived removed work-order view');
  assert(!permissions.includes('notices.publish'), 'notice publishing survived removed notice view');
  assert(!api.portalPureWorkOrderTransitionAllowed_('completed', 'working'), 'terminal work order reopened');
}
assertCriticalInvariants(sandbox);
const permissionDependencyMutant = loadMutant(
  "requireView('costs.view', ['costs.manage', 'costs.approve']);",
  "/* mutation: missing costs dependency */"
);
assert.throws(() => assertCriticalInvariants(permissionDependencyMutant), /cost approval survived/);
const workOrderDependencyMutant = loadMutant(
  "requireView('workorders.view', ['workorders.manage', 'workorders.assign']);",
  '/* mutation: missing work-order dependency */'
);
assert.throws(() => assertCriticalInvariants(workOrderDependencyMutant), /work-order assignment survived/);
const noticeDependencyMutant = loadMutant(
  "requireView('notices.view', ['notices.manage', 'notices.publish']);",
  '/* mutation: missing notice dependency */'
);
assert.throws(() => assertCriticalInvariants(noticeDependencyMutant), /notice publishing survived/);
const terminalTransitionMutant = loadMutant("completed: [],", "completed: ['working'],");
assert.throws(() => assertCriticalInvariants(terminalTransitionMutant), /terminal work order reopened/);

console.log('PASS  office portal pure RBAC, validation, visibility, and projection contracts');

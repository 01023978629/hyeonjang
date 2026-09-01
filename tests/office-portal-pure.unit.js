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
  'requests.view', 'reports.view', 'notices.view', 'costs.view',
  'admin.users.view', 'admin.users.manage', 'admin.permissions.manage', 'admin.audit.view',
]);
assert.deepEqual(plain(sandbox.PORTAL_VIEW_CAPABILITIES), [
  'dashboard.view', 'status.view', 'logs.view', 'requests.view', 'reports.view',
  'notices.view', 'costs.view', 'admin.users.view', 'admin.audit.view',
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
assert(facilityPermissions.includes('status.manage'), 'view override must not silently remove write capability');
assert(facilityPermissions.includes('logs.manage'));

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

const safeUser = plain(sandbox.portalPureSafeUser_({
  userId: 'usr_1', email: 'user@example.com', displayName: '관리자', role: 'manager_chief',
  enabled: true, unit: '', permissions: ['dashboard.view'],
}, true));
assert.deepEqual(safeUser, {
  id: 'usr_1', name: '관리자', role: 'manager_chief', active: true,
  permissions: ['dashboard.view'], email: 'user@example.com',
});

console.log('PASS  office portal pure RBAC, validation, visibility, and projection contracts');

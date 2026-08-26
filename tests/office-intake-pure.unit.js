'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'OfficeIntakePure.gs'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.equal(sandbox.oiNormalizePhone_('01012345678'), '010-1234-5678');
assert.equal(sandbox.oiReceiptNo_('20260826', 7), 'MM-20260826-0007');

const valid = sandbox.oiValidateCreate_({
  idempotencyKey: 'b7c9b8af-16f4-4db2-a7e4-f1a8c780b881',
  unit: '103동 1204호',
  location: '욕실 천장',
  issueType: '누수',
  pipeType: '미확정',
  urgency: 'normal',
  description: '천장에서 물이 떨어집니다.',
  officeContact: { name: '홍길동', phone: '01012345678' },
  residentContact: null,
  preferredVisitDate: '2026-08-27',
  expectedUploadIds: [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ],
  privacyConsent: true,
});
assert.equal(valid.ok, true);
assert.equal(valid.value.officeContact.phone, '010-1234-5678');
assert.deepEqual(Array.from(valid.value.expectedUploadIds), [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
]);
assert.equal(sandbox.oiValidateCreate_({ ...valid.value, expectedUploadIds: [valid.value.expectedUploadIds[0], valid.value.expectedUploadIds[0]] }).field, 'expectedUploadIds', 'duplicate declared upload slots fail closed');
assert.equal(sandbox.oiValidateCreate_({ ...valid.value, expectedUploadIds: ['00000000-0000-3000-8000-000000000001'] }).field, 'expectedUploadIds', 'declared slots must be RFC4122 UUID v4');
assert.equal(sandbox.oiValidateCreate_({ ...valid.value, expectedUploadIds: ['00000000-0000-4000-8000-00000000000A'] }).field, 'expectedUploadIds', 'declared slots must be canonical lowercase');
assert.equal(sandbox.oiValidateCreate_({ ...valid.value, expectedUploadIds: Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`) }).field, 'expectedUploadIds', 'at most five declared upload slots are accepted');
assert.equal(sandbox.oiValidateCreate_({ ...valid.value, privacyConsent: false }).field, 'privacyConsent');
assert.equal(sandbox.oiCanTransition_('pending_review', 'cancelled', 'office'), true);
assert.equal(sandbox.oiCanTransition_('accepted', 'cancelled', 'office'), false);
assert.equal(sandbox.oiCanTransition_('accepted', 'visit_scheduled', 'internal'), true);
assert.equal(sandbox.oiCanTransition_('paid', 'in_progress', 'internal'), false);

const session = sandbox.oiSessionPayload_('of1', 3, 1000);
assert.deepEqual(JSON.parse(JSON.stringify(session)), {
  officeId: 'of1', sessionVersion: 3, issuedAt: 1000, expiresAt: 1000 + 8 * 60 * 60 * 1000,
});
assert.equal(sandbox.oiRedactPhone_('010-1234-5678'), '010-****-5678');
console.log('PASS  office intake pure contract');

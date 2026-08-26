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
  privacyConsent: true,
});
assert.equal(valid.ok, true);
assert.equal(valid.value.officeContact.phone, '010-1234-5678');
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

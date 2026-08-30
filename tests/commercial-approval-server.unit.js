const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const trustedNowMs = Date.parse('2026-08-31T10:00:00+09:00');
const properties = {
  COMMERCIAL_APPROVAL_ENABLED: '1', COMMERCIAL_APPROVAL_TOKEN: 'TEST_ONLY_COMMERCIAL_TOKEN',
  COMMERCIAL_APPROVAL_RECEIPT_KEY: 'TEST_ONLY_RECEIPT_HMAC_KEY'
};
const propertyReads = [];
const driveReads = [];
const cache = new Map();

function signedBytes(value) {
  return Array.from(value, byte => byte > 127 ? byte - 256 : byte);
}

function fakeFile({ id = '', mime, bytes, trashed, size }) {
  let currentBytes = Buffer.from(bytes);
  const file = {
    getId: () => id,
    getMimeType: () => mime,
    getSize: () => size === undefined ? currentBytes.length : size,
    isTrashed: () => trashed,
    getBlob: () => ({ getBytes: () => signedBytes(currentBytes) })
  };
  Object.defineProperty(file, 'bytes', {
    get: () => Buffer.from(currentBytes),
    set: value => { currentBytes = Buffer.from(value); }
  });
  return file;
}

const drive = new Map([
  ['TEST_EVIDENCE_FILE_0001', fakeFile({ id: 'TEST_EVIDENCE_FILE_0001', mime: 'application/pdf', bytes: Buffer.from('signed quote'), trashed: false })],
  ['TEST_JSON_STORE_FILE', fakeFile({ id: 'TEST_JSON_STORE_FILE', mime: 'application/json', bytes: Buffer.from('{}'), trashed: false })],
  ['TEST_LARGE_FILE_0001', fakeFile({ id: 'TEST_LARGE_FILE_0001', mime: 'image/png', bytes: Buffer.from('png'), size: 20 * 1024 * 1024 + 1, trashed: false })],
  ['TEST_TRASHED_FILE_01', fakeFile({ id: 'TEST_TRASHED_FILE_01', mime: 'image/jpeg', bytes: Buffer.from('jpg'), trashed: true })]
]);

const sandbox = {
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  Buffer,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (_algorithm, input) => signedBytes(crypto.createHash('sha256').update(Buffer.from(input)).digest()),
    computeHmacSha256Signature: (text, key) => signedBytes(crypto.createHmac('sha256', key).update(text).digest()),
    newBlob: text => ({ getBytes: () => Array.from(Buffer.from(text, 'utf8')) }),
    getUuid: () => 'TEST_UUID_0001',
    formatDate: (date, timezone, format) => {
      assert.equal(timezone, 'Asia/Seoul');
      assert.equal(format, "yyyy-MM-dd'T'HH:mm:ssXXX");
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).format(date).replace(' ', 'T') + '+09:00';
    }
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: name => {
        propertyReads.push(name);
        return Object.prototype.hasOwnProperty.call(properties, name) ? properties[name] : null;
      }
    })
  },
  DriveApp: {
    getFileById: id => {
      driveReads.push(id);
      if (!drive.has(id)) throw new Error('not found');
      return drive.get(id);
    }
  },
  CacheService: {
    getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value, seconds) => {
        assert.equal(seconds, 60);
        cache.set(key, value);
      }
    })
  },
  caNowMs_: () => trustedNowMs
};

vm.createContext(sandbox);
for (const name of ['CommercialApprovalPure.gs', 'CommercialApproval.gs', 'Code.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script-commercial', name), 'utf8'), sandbox, { filename: name });
}

function post(action, payload, request = {}) {
  return sandbox.caDoPost_({
    action,
    token: 'TEST_ONLY_COMMERCIAL_TOKEN',
    requestAtKst: '2026-08-31T10:00:00+09:00',
    payload,
    ...request
  });
}

const commercialTerms = {
  workKind: 'device-diagnosis',
  scope: '욕실 누수 장비 진단',
  exclusions: ['복구 공사', '타일'],
  vatMode: 'included',
  quotedAmount: 100000,
  validUntil: '2026-09-30',
  scheduleWindow: '2026-09-02 오후'
};
const issuePayload = {
  subjectType: 'aptOrder',
  subjectId: 'pending_order_test_1',
  commercialTerms,
  approvalEvidenceType: 'quote-file',
  approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001',
  approvedAt: '2026-08-31T09:30:00+09:00',
  approvedByRole: 'customer'
};

const initialEvidence = drive.get('TEST_EVIDENCE_FILE_0001').bytes;
const initialJsonStore = drive.get('TEST_JSON_STORE_FILE').bytes;

const driveBeforeNow = driveReads.length;
const trustedNow = post('commercialNow', { nonce: 'time_nonce_123456' });
assert.deepEqual({ ok: trustedNow.ok, nonce: trustedNow.nonce }, { ok: true, nonce: 'time_nonce_123456' });
assert.equal(trustedNow.serverNowKst, '2026-08-31T10:00:00+09:00');
assert.equal(trustedNow.receivedAtKst, '2026-08-31T10:00:00+09:00');
assert.equal(driveReads.length, driveBeforeNow);
assert.equal(post('commercialNow', { nonce: 'short' }).error, 'invalid-nonce');

const issueReadStart = driveReads.length;
const issued = post('commercialApprovalIssue', issuePayload);
assert.equal(issued.ok, true);
assert.match(issued.commercialApproval.approvalEvidenceSha256, /^[0-9a-f]{64}$/);
assert.equal(issued.commercialApproval.approvalEvidenceSha256, crypto.createHash('sha256').update(initialEvidence).digest('hex'));
assert.equal(issued.commercialApproval.subjectType, 'aptOrder');
assert.equal(issued.commercialApproval.subjectId, 'pending_order_test_1');
assert.equal(issued.commercialApproval.approvedByRole, 'customer');
assert.equal(issued.commercialApproval.issuedAt, '2026-08-31T10:00:00+09:00');
assert.match(issued.commercialApproval.receiptHmac, /^[0-9a-f]{64}$/);
assert.deepEqual(driveReads.slice(issueReadStart), ['TEST_EVIDENCE_FILE_0001']);

for (const [label, payload, expected] of [
  ['JSON store MIME', { ...issuePayload, approvalEvidenceFileId: 'TEST_JSON_STORE_FILE' }, 'forbidden-evidence'],
  ['missing file', { ...issuePayload, approvalEvidenceFileId: 'MISSING_FILE_0001' }, 'evidence-not-found'],
  ['wrong subject type', { ...issuePayload, subjectType: 'repair' }, 'invalid-subject'],
  ['empty subject id', { ...issuePayload, subjectId: '' }, 'invalid-subject'],
  ['future approval', { ...issuePayload, approvedAt: '2026-08-31T10:00:01+09:00' }, 'invalid-approval-window'],
  ['expired terms', { ...issuePayload, commercialTerms: { ...commercialTerms, validUntil: '2026-08-30' } }, 'invalid-approval-window'],
  ['oversize evidence', { ...issuePayload, approvalEvidenceFileId: 'TEST_LARGE_FILE_0001' }, 'forbidden-evidence'],
  ['trashed evidence', { ...issuePayload, approvalEvidenceFileId: 'TEST_TRASHED_FILE_01' }, 'forbidden-evidence'],
  ['unknown issue field', { ...issuePayload, unexpected: true }, 'bad-request']
]) {
  assert.equal(post('commercialApprovalIssue', payload).error, expected, label);
}

assert.equal(post('commercialApprovalIssue', issuePayload, { token: '' }).error, 'unauthorized');
assert.equal(post('commercialApprovalIssue', issuePayload, { token: 'WRONG_TEST_TOKEN' }).error, 'unauthorized');
assert.equal(post('commercialApprovalIssue', issuePayload, { requestAtKst: '2026-08-31T10:05:01+09:00' }).error, 'bad-request');
assert.equal(post('commercialApprovalIssue', issuePayload, { unexpected: true }).error, 'bad-request');
assert.equal(post('unknownCommercialAction', issuePayload).error, 'bad-request');
assert.equal(sandbox.caDoPost_({}).error, 'bad-request');
for (const action of ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify']) {
  assert.equal(post(action, null).error, 'bad-request', action + ' rejects null payload');
}

const verifyPayload = {
  subjectType: issuePayload.subjectType,
  subjectId: issuePayload.subjectId,
  commercialTerms,
  commercialApproval: issued.commercialApproval,
  nonce: 'nonce_123456789012'
};
const verifyReadStart = driveReads.length;
const verified = post('commercialApprovalVerify', verifyPayload);
assert.equal(verified.ok, true);
assert.deepEqual(Object.keys(verified).sort(), ['nonce', 'ok', 'receiptId', 'serverNowKst', 'verifyExpiresAtKst'].sort());
assert.equal(verified.receiptId, issued.commercialApproval.receiptId);
assert.equal(verified.nonce, 'nonce_123456789012');
assert.equal(verified.verifyExpiresAtKst, '2026-08-31T10:01:00+09:00');
assert.deepEqual(driveReads.slice(verifyReadStart), ['TEST_EVIDENCE_FILE_0001']);
assert.equal(post('commercialApprovalVerify', verifyPayload).error, 'nonce-replay');

const signedFor = changes => {
  const receipt = { ...issued.commercialApproval, ...changes };
  receipt.receiptHmac = sandbox.caSignReceipt_(receipt, properties.COMMERCIAL_APPROVAL_RECEIPT_KEY);
  return receipt;
};
const verifyFailureCases = [
  ['altered terms', { ...verifyPayload, commercialTerms: { ...commercialTerms, scope: '변조된 범위' }, nonce: 'nonce_123456789013' }, 'approval-mismatch'],
  ['altered HMAC', { ...verifyPayload, commercialApproval: { ...issued.commercialApproval, receiptHmac: '0'.repeat(64) }, nonce: 'nonce_123456789014' }, 'invalid-receipt'],
  ['wrong subject type', { ...verifyPayload, subjectType: 'repair', nonce: 'nonce_123456789015' }, 'approval-mismatch'],
  ['wrong subject id', { ...verifyPayload, subjectId: 'pending_order_wrong_1', nonce: 'nonce_123456789016' }, 'approval-mismatch'],
  ['wrong role with valid MAC', { ...verifyPayload, commercialApproval: signedFor({ approvedByRole: 'staff' }), nonce: 'nonce_123456789017' }, 'invalid-receipt'],
  ['unknown verify field', { ...verifyPayload, nonce: 'nonce_123456789018', unexpected: true }, 'bad-request']
];
for (const [label, payload, expected] of verifyFailureCases) {
  const result = post('commercialApprovalVerify', payload);
  assert.equal(result.error, expected, label);
  assert.deepEqual(Object.keys(result).sort(), ['error', 'ok']);
}

const evidenceFile = drive.get('TEST_EVIDENCE_FILE_0001');
evidenceFile.bytes = Buffer.from('changed evidence');
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789019' }).error, 'evidence-hash-mismatch');
evidenceFile.bytes = initialEvidence;
drive.delete('TEST_EVIDENCE_FILE_0001');
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789020' }).error, 'evidence-hash-mismatch');
drive.set('TEST_EVIDENCE_FILE_0001', evidenceFile);

properties.COMMERCIAL_APPROVAL_ENABLED = '0';
const readsBeforeDisabled = driveReads.length;
assert.equal(post('commercialApprovalIssue', issuePayload).error, 'commercial-disabled');
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789021' }).error, 'commercial-disabled');
assert.equal(post('commercialNow', { nonce: 'time_nonce_disabled' }).ok, true);
assert.equal(post('commercialNow', { nonce: 'time_nonce_disabled' }, { token: 'WRONG_TEST_TOKEN' }).error, 'unauthorized');
assert.equal(driveReads.length, readsBeforeDisabled);
properties.COMMERCIAL_APPROVAL_ENABLED = '1';

assert.deepEqual(drive.get('TEST_EVIDENCE_FILE_0001').bytes, initialEvidence);
assert.deepEqual(drive.get('TEST_JSON_STORE_FILE').bytes, initialJsonStore);
for (const forbiddenProperty of ['DATA_FILE_ID', 'OFFICE_STORE_FILE_ID', 'OFFICE_OPS_FILE_ID']) {
  assert.equal(propertyReads.includes(forbiddenProperty), false, forbiddenProperty + ' must never be read');
}

console.log('commercial approval server tests: PASS');

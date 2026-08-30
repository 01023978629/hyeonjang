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
const failures = {};
const clock = { nowMs: trustedNowMs, stepMs: 0, calls: 0 };
const lockState = { acquireCalls: 0, releaseCalls: 0, unavailable: false };

function sensitiveServiceError(kind) {
  return new Error(kind + ': TEST_ONLY_COMMERCIAL_TOKEN TEST_EVIDENCE_FILE_0001 TEST_ONLY_RECEIPT_HMAC_KEY receipt_TEST_UUID_0001');
}

function signedBytes(value) {
  return Array.from(value, byte => byte > 127 ? byte - 256 : byte);
}

function fakeFile({ id = '', mime, bytes, trashed, size }) {
  let currentBytes = Buffer.from(bytes);
  const file = {
    getId: () => id,
    getMimeType: () => {
      if (failures.driveMetadata) throw sensitiveServiceError('drive-metadata');
      return mime;
    },
    getSize: () => size === undefined ? currentBytes.length : size,
    isTrashed: () => trashed,
    getBlob: () => ({
      getBytes: () => {
        if (failures.driveBlob) throw sensitiveServiceError('drive-blob');
        return signedBytes(currentBytes);
      }
    })
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
    computeDigest: (_algorithm, input) => {
      if (failures.digest) throw sensitiveServiceError('digest');
      return signedBytes(crypto.createHash('sha256').update(Buffer.from(input)).digest());
    },
    computeHmacSha256Signature: (text, key) => {
      if (failures.hmac) throw sensitiveServiceError('hmac');
      return signedBytes(crypto.createHmac('sha256', key).update(text).digest());
    },
    newBlob: text => ({ getBytes: () => Array.from(Buffer.from(text, 'utf8')) }),
    getUuid: () => 'TEST_UUID_0001',
    formatDate: (date, timezone, format) => {
      if (failures.formatDate) throw sensitiveServiceError('format-date');
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
        if (failures.property) throw sensitiveServiceError('property');
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
      get: key => {
        if (failures.cacheGet) throw sensitiveServiceError('cache-get');
        return cache.get(key) || null;
      },
      put: (key, value, seconds) => {
        if (failures.cachePut) throw sensitiveServiceError('cache-put');
        assert.equal(seconds, 60);
        cache.set(key, value);
      },
      remove: key => cache.delete(key)
    })
  },
  LockService: {
    getScriptLock: () => {
      if (failures.lockService) throw sensitiveServiceError('lock-service');
      return {
        tryLock: milliseconds => {
          assert.equal(milliseconds, 5000);
          lockState.acquireCalls++;
          if (failures.lockAcquire) throw sensitiveServiceError('lock-acquire');
          return !lockState.unavailable;
        },
        releaseLock: () => {
          lockState.releaseCalls++;
          if (failures.lockRelease) throw sensitiveServiceError('lock-release');
        }
      };
    }
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: text => ({
      text,
      mimeType: null,
      setMimeType(mimeType) { this.mimeType = mimeType; return this; }
    })
  },
  caNowMs_: () => {
    clock.calls++;
    if (failures.clock) throw sensitiveServiceError('clock');
    const value = clock.nowMs;
    clock.nowMs += clock.stepMs;
    return value;
  }
};

vm.createContext(sandbox);
for (const name of ['CommercialApprovalPure.gs', 'CommercialApproval.gs', 'Code.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script-commercial', name), 'utf8'), sandbox, { filename: name });
}

function post(action, payload, request = {}) {
  return sandbox.caDoPost_({
    action,
    token: 'TEST_ONLY_COMMERCIAL_TOKEN',
    timestamp: '2026-08-31T01:00:00.000Z',
    payload,
    ...request
  });
}

function httpPost(action, payload, request = {}) {
  const output = sandbox.doPost({ postData: { contents: JSON.stringify({
    token: 'TEST_ONLY_COMMERCIAL_TOKEN', action, timestamp: '2026-08-31T01:00:00.000Z', payload, ...request
  }) } });
  assert.equal(output.mimeType, 'application/json');
  return JSON.parse(output.text);
}

function assertFailure(result, expected, label) {
  assert.deepEqual(Object.keys(result).sort(), ['error', 'ok'], label + ' exact failure keys');
  assert.equal(result.ok, false, label + ' ok');
  assert.equal(result.error, expected, label + ' error');
  const serialized = JSON.stringify(result);
  for (const forbidden of ['TEST_ONLY_COMMERCIAL_TOKEN', 'TEST_EVIDENCE_FILE_0001', 'TEST_ONLY_RECEIPT_HMAC_KEY',
    'COMMERCIAL_APPROVAL_RECEIPT_KEY', 'receipt_TEST_UUID_0001', 'stack']) {
    assert.equal(serialized.includes(forbidden), false, label + ' leaked ' + forbidden);
  }
}

function withFailure(name, callback) {
  failures[name] = true;
  try { return callback(); } finally { delete failures[name]; }
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
const clockCallsBeforeNow = clock.calls;
const trustedNow = post('commercialNow', { nonce: 'time_nonce_123456' });
assert.deepEqual(Object.keys(trustedNow).sort(), ['nonce', 'ok', 'receivedAtKst', 'serverNowKst'].sort());
assert.deepEqual({ ok: trustedNow.ok, nonce: trustedNow.nonce }, { ok: true, nonce: 'time_nonce_123456' });
assert.equal(trustedNow.serverNowKst, '2026-08-31T10:00:00+09:00');
assert.equal(trustedNow.receivedAtKst, '2026-08-31T10:00:00+09:00');
assert.equal(clock.calls - clockCallsBeforeNow, 1, 'commercialNow uses one server-time snapshot');
assert.equal(driveReads.length, driveBeforeNow);
assertFailure(post('commercialNow', { nonce: 'short' }), 'invalid-nonce', 'short nonce');
assert.equal(post('commercialNow', { nonce: 'time_nonce_offset1' }, { timestamp: '2026-08-31T10:00:00+09:00' }).ok, true);
assertFailure(post('commercialNow', { nonce: 'time_nonce_nozone1' }, { timestamp: '2026-08-31T10:00:00' }), 'bad-request', 'timestamp without zone');
assertFailure(post('commercialNow', { nonce: 'time_nonce_stale_1' }, { timestamp: '2026-08-31T00:54:59Z' }), 'bad-request', 'stale timestamp');
assertFailure(sandbox.caDoPost_({
  token: 'TEST_ONLY_COMMERCIAL_TOKEN', action: 'commercialNow', requestAtKst: '2026-08-31T10:00:00+09:00',
  payload: { nonce: 'time_nonce_legacy1' }
}), 'bad-request', 'legacy requestAtKst envelope');

const httpNow = httpPost('commercialNow', { nonce: 'time_nonce_http_01' });
assert.deepEqual(Object.keys(httpNow).sort(), ['nonce', 'ok', 'receivedAtKst', 'serverNowKst'].sort());
assert.equal(httpNow.receivedAtKst, '2026-08-31T10:00:00+09:00');

const issueReadStart = driveReads.length;
const issued = post('commercialApprovalIssue', issuePayload);
assert.equal(issued.ok, true);
assert.deepEqual(Object.keys(issued).sort(), ['commercialApproval', 'ok']);
assert.deepEqual(Object.keys(issued.commercialApproval).sort(), [
  'approvalEvidenceFileId', 'approvalEvidenceSha256', 'approvalEvidenceType', 'approvedAt', 'approvedByRole',
  'approvedTermsSha256', 'issuedAt', 'receiptHmac', 'receiptId', 'subjectId', 'subjectType'
].sort());
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
  assertFailure(post('commercialApprovalIssue', payload), expected, label);
}

assertFailure(post('commercialApprovalIssue', issuePayload, { token: '' }), 'unauthorized', 'missing token');
assertFailure(post('commercialApprovalIssue', issuePayload, { token: 'WRONG_TEST_TOKEN' }), 'unauthorized', 'wrong token');
assertFailure(post('commercialApprovalIssue', issuePayload, { timestamp: '2026-08-31T01:05:01Z' }), 'bad-request', 'future timestamp');
assertFailure(post('commercialApprovalIssue', issuePayload, { unexpected: true }), 'bad-request', 'unknown envelope field');
assertFailure(post('unknownCommercialAction', issuePayload), 'bad-request', 'unknown action');
assertFailure(sandbox.caDoPost_({}), 'bad-request', 'empty envelope');
for (const action of ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify']) {
  assertFailure(post(action, null), 'bad-request', action + ' rejects null payload');
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
assert.equal(lockState.acquireCalls, 1);
assert.equal(lockState.releaseCalls, 1);
assertFailure(post('commercialApprovalVerify', verifyPayload), 'nonce-replay', 'nonce replay');
assert.equal(lockState.acquireCalls, 2);
assert.equal(lockState.releaseCalls, 2);

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
  assertFailure(result, expected, label);
}

const evidenceFile = drive.get('TEST_EVIDENCE_FILE_0001');
evidenceFile.bytes = Buffer.from('changed evidence');
assertFailure(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789019' }), 'evidence-hash-mismatch', 'changed evidence');
evidenceFile.bytes = initialEvidence;
drive.delete('TEST_EVIDENCE_FILE_0001');
assertFailure(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789020' }), 'evidence-hash-mismatch', 'deleted evidence');
drive.set('TEST_EVIDENCE_FILE_0001', evidenceFile);

const releaseBeforeUnavailable = lockState.releaseCalls;
lockState.unavailable = true;
assertFailure(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_lock_unavailable_01' }), 'internal-error', 'lock unavailable');
lockState.unavailable = false;
assert.equal(lockState.releaseCalls, releaseBeforeUnavailable, 'unacquired lock is not released');

for (const [failureName, nonce] of [
  ['lockService', 'nonce_lock_service_001'],
  ['lockAcquire', 'nonce_lock_acquire_001'],
  ['cacheGet', 'nonce_cache_get_00001'],
  ['cachePut', 'nonce_cache_put_00001']
]) {
  const releasesBefore = lockState.releaseCalls;
  const result = withFailure(failureName, () => post('commercialApprovalVerify', { ...verifyPayload, nonce }));
  assertFailure(result, 'internal-error', failureName + ' exception');
  assert.equal(lockState.releaseCalls - releasesBefore, ['cacheGet', 'cachePut'].includes(failureName) ? 1 : 0,
    failureName + ' release count');
}

const releaseFailureNonce = 'nonce_lock_release_001';
const releaseFailure = withFailure('lockRelease', () => post('commercialApprovalVerify', { ...verifyPayload, nonce: releaseFailureNonce }));
assertFailure(releaseFailure, 'internal-error', 'lock release exception');
assert.equal(cache.has('commercial-verify:' + issued.commercialApproval.receiptId + ':' + releaseFailureNonce), false,
  'failed lock release must not retain nonce claim');

clock.nowMs = trustedNowMs;
clock.stepMs = 1000;
clock.calls = 0;
const snapshotAck = post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_clock_snapshot01' });
assert.equal(snapshotAck.ok, true);
assert.deepEqual(Object.keys(snapshotAck).sort(), ['nonce', 'ok', 'receiptId', 'serverNowKst', 'verifyExpiresAtKst'].sort());
assert.equal(snapshotAck.serverNowKst, '2026-08-31T10:00:01+09:00');
assert.equal(snapshotAck.verifyExpiresAtKst, '2026-08-31T10:01:01+09:00');
assert.equal(Date.parse(snapshotAck.verifyExpiresAtKst) - Date.parse(snapshotAck.serverNowKst), 60000);
assert.equal(clock.calls, 2, 'verify uses one request clock and one claim/ACK clock snapshot');
clock.nowMs = trustedNowMs;
clock.stepMs = 0;

for (const [failureName, action, payload] of [
  ['property', 'commercialApprovalIssue', issuePayload],
  ['clock', 'commercialNow', { nonce: 'nonce_service_clock01' }],
  ['formatDate', 'commercialNow', { nonce: 'nonce_service_format1' }],
  ['driveMetadata', 'commercialApprovalIssue', issuePayload],
  ['driveBlob', 'commercialApprovalIssue', issuePayload],
  ['digest', 'commercialApprovalIssue', issuePayload],
  ['hmac', 'commercialApprovalIssue', issuePayload]
]) {
  const result = withFailure(failureName, () => httpPost(action, payload));
  assertFailure(result, 'internal-error', failureName + ' HTTP service exception');
}

properties.COMMERCIAL_APPROVAL_ENABLED = '0';
const readsBeforeDisabled = driveReads.length;
assertFailure(post('commercialApprovalIssue', issuePayload), 'commercial-disabled', 'disabled issue');
assertFailure(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789021' }), 'commercial-disabled', 'disabled verify');
assert.equal(post('commercialNow', { nonce: 'time_nonce_disabled' }).ok, true);
assertFailure(post('commercialNow', { nonce: 'time_nonce_disabled' }, { token: 'WRONG_TEST_TOKEN' }), 'unauthorized', 'disabled now wrong token');
assert.equal(driveReads.length, readsBeforeDisabled);
properties.COMMERCIAL_APPROVAL_ENABLED = '1';

assert.deepEqual(drive.get('TEST_EVIDENCE_FILE_0001').bytes, initialEvidence);
assert.deepEqual(drive.get('TEST_JSON_STORE_FILE').bytes, initialJsonStore);
for (const forbiddenProperty of ['DATA_FILE_ID', 'OFFICE_STORE_FILE_ID', 'OFFICE_OPS_FILE_ID']) {
  assert.equal(propertyReads.includes(forbiddenProperty), false, forbiddenProperty + ' must never be read');
}

console.log('commercial approval server tests: PASS');

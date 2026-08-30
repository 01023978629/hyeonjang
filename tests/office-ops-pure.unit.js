const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let assertionCount = 0;
function equal(actual, expected, message) {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}
function deepEqual(actual, expected, message) {
  assertionCount += 1;
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}
function match(actual, expected, message) {
  assertionCount += 1;
  assert.match(actual, expected, message);
}

function signedBytes(value) {
  return Array.from(value, byte => byte > 127 ? byte - 256 : byte);
}

function formatKst(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(date).replace(' ', 'T') + '+09:00';
}

let uuidCounter = 0;
function createSandbox() {
  return {
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm, input) => signedBytes(crypto.createHash('sha256').update(Buffer.from(input)).digest()),
      newBlob: text => ({ getBytes: () => Array.from(Buffer.from(text, 'utf8')) }),
      getUuid: () => '00000000-0000-4000-8000-' + String(++uuidCounter).padStart(12, '0'),
      formatDate: (date, timezone, format) => {
        assert.equal(timezone, 'Asia/Seoul');
        assert.equal(format, "yyyy-MM-dd'T'HH:mm:ssXXX");
        return formatKst(date);
      }
    }
  };
}

function loadPure(relativePath, extra = {}) {
  const sandbox = { ...createSandbox(), ...extra };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), sandbox, { filename: relativePath });
  return sandbox;
}

const sandbox = loadPure(path.join('apps-script-office-ops', 'OfficeOpsPure.gs'));
const commercialSandbox = loadPure(path.join('apps-script-commercial', 'CommercialApprovalPure.gs'), {
  caFail_: code => ({ ok: false, error: code })
});

const NOW = '2026-08-31T10:00:00+09:00';
const NOW_MS = Date.parse(NOW);
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';
const MUTATION_ID = '550e8400-e29b-41d4-a716-446655440001';
const TOKEN = 'TEST_ONLY_OFFICE_OPS_TOKEN';

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function tombstone() {
  return { archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null };
}

function validTerms(overrides = {}) {
  return {
    workKind: 'preventive-inspection', scope: '배수 점검', exclusions: [], vatMode: 'included',
    quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '2026-09-02', ...overrides
  };
}

function validApproval(termsSha256, overrides = {}) {
  return {
    receiptId: 'receipt_test_001', subjectType: 'aptOrder', subjectId: 'pending_test_001',
    approvedTermsSha256: termsSha256, approvalEvidenceType: 'quote-file',
    approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256: 'a'.repeat(64),
    approvedAt: NOW, approvedByRole: 'management-office', issuedAt: '2026-08-31T10:00:01+09:00',
    receiptHmac: 'b'.repeat(64), ...overrides
  };
}

function validPilot(overrides = {}) {
  return {
    pilotId: 'pilot_test', complexName: '테스트 단지', source: 'website', stage: 'pilot',
    pilotStartedAt: '2026-08-31T18:00:00+09:00', pilotEndsAt: '2026-09-29T23:59:59+09:00',
    extensionApprovedAt: null, nextActionAt: '2026-09-01', owner: '대표', notes: '',
    createdAt: '2026-08-31T18:00:00+09:00', updatedAt: '2026-08-31T18:00:00+09:00',
    retentionStartedAt: null, ...tombstone(), ...overrides
  };
}

function validConsent(overrides = {}) {
  return {
    consentId: 'consent_test', subjectType: 'aptOrder', subjectId: 'order01',
    purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
    consentVersion: 'reinspection-v1', consentTextSnapshot: '재점검 연락에 동의합니다.',
    consentTextSha256: sha256Text('재점검 연락에 동의합니다.'), recordedBy: '대표', consentedAt: NOW,
    withdrawnAt: null, withdrawnBy: null, withdrawalReason: null, nextDueAt: '2027-02-28',
    lastContactedAt: null, evidenceType: 'message', evidenceId: 'record_test',
    audit: [{ event: 'recorded', at: NOW, actor: '대표', reason: null }], ...overrides
  };
}

function validInspection(overrides = {}) {
  return {
    inspectionId: 'inspection_test', officeId: 'office_test', complexName: '테스트 단지',
    templateId: 'preventive-v1', status: 'proposal', nextDueAt: '2026-09-02',
    riskItems: ['배수 확인'], summary: '접근 허가 후 점검', commercialTerms: null,
    commercialApproval: null, conversionId: null, conversionTermsSha256: null,
    conversionReceiptId: null, pendingOrderId: null, linkedOrderId: null,
    conversionStartedAt: null, updatedAt: NOW, ...tombstone(), ...overrides
  };
}

function validOpportunity(overrides = {}) {
  return {
    opportunityId: 'opp_test', complexName: '테스트 단지',
    officialUrl: 'https://www.k-apt.go.kr/a?x=1', observedAt: NOW, region: '대전', category: '배관',
    deadlineAt: '2026-09-01T10:00:00+09:00', stage: 'review', requirements: ['면허 확인'],
    verifiedBy: '대표', notes: '', retentionStartedAt: null, ...tombstone(), ...overrides
  };
}

const emptyStore = {
  schemaVersion: 1, revision: 0, updatedAt: NOW,
  pilots: [], consents: [], inspections: [], opportunities: [], audit: []
};

// Request timestamp and exact envelope contracts.
equal(sandbox.ooParseRequestTimestamp_('2026-08-31T01:00:00.000Z'), Date.parse('2026-08-31T01:00:00.000Z'));
equal(sandbox.ooParseRequestTimestamp_('2026-08-31T10:00:00+09:00'), NOW_MS);
equal(sandbox.ooParseRequestTimestamp_('2026-08-31T06:30:00.1+05:30'), NOW_MS + 100);
equal(sandbox.ooParseRequestTimestamp_('2026-08-30T22:00:00.123456789-03:00'), NOW_MS + 123);
for (const invalidTimestamp of [
  '2026-02-30T10:00:00+09:00', '2026-08-31T24:00:00+09:00', '2026-08-31T10:60:00+09:00',
  '2026-08-31T10:00:60+09:00', '2026-08-31T10:00:00', '2026-08-31T10:00:00+14:01',
  '2026-08-31T10:00:00+09:60', '2026-08-31T10:00:00.1234567890Z', 123
]) equal(sandbox.ooParseRequestTimestamp_(invalidTimestamp), null, String(invalidTimestamp));
equal(sandbox.ooParseKstDateTime_(NOW), NOW_MS);
equal(sandbox.ooParseKstDateTime_('2026-02-30T10:00:00+09:00'), null);
equal(sandbox.ooParseKstDateTime_('2026-08-31T01:00:00Z'), null);

const readUtc = { token: TOKEN, action: 'officeOpsList', deviceId: DEVICE_ID, timestamp: new Date(NOW_MS).toISOString(), payload: {} };
equal(sandbox.ooValidateRequestEnvelope_(readUtc, true, NOW_MS + 5 * 60 * 1000).ok, true);
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, payload: { includeArchived: true } }, true, NOW_MS).ok, true);
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, payload: { includeArchived: false } }, true, NOW_MS).ok, true);
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, action: 'officeOpsRetentionList', payload: {} }, true, NOW_MS).ok, true);
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, mutationId: MUTATION_ID }, true, NOW_MS).error, 'unknown-field');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, ts: readUtc.timestamp }, true, NOW_MS).error, 'unknown-field');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, payload: { includeArchived: 'true' } }, true, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, payload: { includeArchived: true, surprise: true } }, true, NOW_MS).error, 'unknown-field');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, action: 'officeOpsRetentionList', payload: { includeArchived: false } }, true, NOW_MS).error, 'unknown-field');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, timestamp: '2026-08-31T01:05:01.000Z' }, true, NOW_MS).error, 'stale-request');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, timestamp: '2026-08-31T10:00:00' }, true, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, deviceId: 'a'.repeat(15) }, true, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, deviceId: 'a'.repeat(101) }, true, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, action: 'officePilotCreate' }, true, NOW_MS).error, 'bad-request');
const missingReadPayload = { ...readUtc }; delete missingReadPayload.payload;
equal(sandbox.ooValidateRequestEnvelope_(missingReadPayload, true, NOW_MS).error, 'invalid-input');

const mutationEnvelope = { deviceId: DEVICE_ID, mutationId: MUTATION_ID, timestamp: NOW };
equal(sandbox.ooValidateMutationEnvelope_(mutationEnvelope, NOW_MS + 3 * 60 * 1000).ok, true);
equal(sandbox.ooValidateMutationEnvelope_(mutationEnvelope, NOW_MS + 5 * 60 * 1000).ok, true);
equal(sandbox.ooValidateMutationEnvelope_(mutationEnvelope, NOW_MS + 5 * 60 * 1000 + 1).error, 'stale-request');
equal(sandbox.ooValidateMutationEnvelope_({ ...mutationEnvelope, deviceId: 'a'.repeat(16), mutationId: 'b'.repeat(100) }, NOW_MS).ok, true);
equal(sandbox.ooValidateMutationEnvelope_({ ...mutationEnvelope, deviceId: 'a'.repeat(15) }, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateMutationEnvelope_({ ...mutationEnvelope, mutationId: 'b'.repeat(101) }, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateMutationEnvelope_({ ...mutationEnvelope, ts: NOW }, NOW_MS).error, 'unknown-field');
const fullMutationRequest = { token: TOKEN, action: 'officePilotCreate', ...mutationEnvelope, payload: {} };
equal(sandbox.ooValidateRequestEnvelope_(fullMutationRequest, false, NOW_MS).ok, true);
equal(sandbox.ooValidateRequestEnvelope_({ ...fullMutationRequest, mutationId: undefined }, false, NOW_MS).error, 'invalid-input');
equal(sandbox.ooValidateRequestEnvelope_({ ...fullMutationRequest, action: 'officeOpsList' }, false, NOW_MS).error, 'bad-request');

// Exact store and audit contracts.
equal(sandbox.ooValidateStore_(emptyStore).ok, true);
equal(sandbox.ooValidateStore_({ ...emptyStore, surprise: true }).error, 'unknown-field');
equal(sandbox.ooValidateStore_({ ...emptyStore, revision: -1 }).error, 'invalid-store');
equal(sandbox.ooValidateStore_({ ...emptyStore, schemaVersion: 2 }).error, 'invalid-store');
equal(sandbox.ooValidateStore_({ ...emptyStore, updatedAt: '2026-08-31T10:00:00Z' }).error, 'invalid-store');
const exactAudit = {
  action: 'officePilotCreate', result: 'ok', id: 'pilot_test', mutationId: MUTATION_ID,
  idempotencyKey: 'create_pilot_123456', payloadSha256: 'a'.repeat(64), at: NOW,
  actor: 'representative', lifecycleBefore: null, backupFileId: 'BACKUP_FILE_0001',
  backupManifestFileId: 'BACKUP_MANIFEST_0001', backupSha256: 'b'.repeat(64), preMutationRevision: 0
};
equal(sandbox.ooValidateAuditRow_(exactAudit).ok, true);
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, actor: '대표' }).error, 'invalid-audit');
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, result: 'failed' }).error, 'invalid-audit');
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, idempotencyKey: null }).error, 'invalid-audit');
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, idempotencyKey: 'a'.repeat(15) }).error, 'invalid-audit');
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, surprise: true }).error, 'unknown-field');
equal(sandbox.ooValidateAuditRow_({ ...exactAudit, backupFileId: 'B'.repeat(500), backupManifestFileId: 'M'.repeat(500) }).ok, true);
const lifecycleAudit = { ...exactAudit, action: 'officePilotArchive', idempotencyKey: null, lifecycleBefore: tombstone() };
equal(sandbox.ooValidateAuditRow_(lifecycleAudit).ok, true);
equal(sandbox.ooValidateAuditRow_({ ...lifecycleAudit, lifecycleBefore: { ...tombstone(), surprise: true } }).error, 'unknown-field');
const lifecycleMissing = tombstone(); delete lifecycleMissing.restoredAt;
equal(sandbox.ooValidateAuditRow_({ ...lifecycleAudit, lifecycleBefore: lifecycleMissing }).error, 'invalid-audit');
const auditMissingActor = { ...exactAudit }; delete auditMissingActor.actor;
equal(sandbox.ooValidateAuditRow_(auditMissingActor).error, 'invalid-audit');
equal(sandbox.ooValidateStore_({ ...emptyStore, audit: [exactAudit] }).ok, true);

// Pilot stored and create contracts.
const pilot = sandbox.ooValidatePilot_(validPilot());
equal(pilot.ok, true);
equal(sandbox.ooValidatePilot_({ ...pilot.value, source: 'email' }).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_({ ...pilot.value, status: 'pilot' }).error, 'unknown-field');
equal(sandbox.ooValidatePilot_({ ...pilot.value, surprise: true }).error, 'unknown-field');
const pilotMissingStored = { ...pilot.value }; delete pilotMissingStored.notes;
equal(sandbox.ooValidatePilot_(pilotMissingStored).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ complexName: '가'.repeat(100) })).ok, true);
equal(sandbox.ooValidatePilot_(validPilot({ complexName: '가'.repeat(101) })).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ notes: '가'.repeat(2000) })).ok, true);
equal(sandbox.ooValidatePilot_(validPilot({ notes: '가'.repeat(2001) })).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ pilotStartedAt: null, pilotEndsAt: null, stage: 'new' })).ok, true);
equal(sandbox.ooValidatePilot_(validPilot({ pilotStartedAt: null, pilotEndsAt: null, stage: 'pilot' })).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ pilotEndsAt: '2026-09-30T23:59:59+09:00' })).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ pilotEndsAt: '2026-10-01T23:59:59+09:00', extensionApprovedAt: NOW })).ok, true);
equal(sandbox.ooValidatePilot_(validPilot({ stage: 'closed', retentionStartedAt: NOW })).ok, true);
equal(sandbox.ooValidatePilot_(validPilot({ stage: 'closed', retentionStartedAt: null })).error, 'invalid-pilot');
equal(sandbox.ooValidatePilot_(validPilot({ stage: 'contacted', retentionStartedAt: NOW })).error, 'invalid-pilot');
equal(sandbox.ooValidateStore_({ ...emptyStore, pilots: [{ ...pilot.value, surprise: true }] }).error, 'unknown-field');
equal(sandbox.ooValidateStore_({ ...emptyStore, pilots: [pilotMissingStored] }).error, 'invalid-pilot');
equal(sandbox.ooPilotEndsAtKst_('2026-08-31'), '2026-09-29T23:59:59+09:00');
equal(sandbox.ooPilotEndsAtKst_('2028-02-01'), '2028-03-01T23:59:59+09:00');
equal(sandbox.ooPilotEndsAtKst_('2026-02-30'), '');
for (const source of ['website', 'phone', 'referral', 'kapt']) equal(sandbox.ooValidPilotSource_(source), true);
equal(sandbox.ooValidPilotSource_('email'), false);

const pilotCreatePayload = {
  idempotencyKey: 'create_pilot_123456', complexName: '테스트 단지', source: 'website', stage: 'pilot',
  pilotStartedAt: '2026-08-31T18:00:00+09:00', pilotEndsAt: '2026-09-29T23:59:59+09:00',
  extensionApprovedAt: null, nextActionAt: '2026-09-01', owner: '대표', notes: ''
};
equal(sandbox.ooValidatePilotCreate_(pilotCreatePayload, '2026-08-31T18:00:00+09:00').ok, true);
equal(sandbox.ooValidatePilotCreate_({ ...pilotCreatePayload, pilotId: 'pilot_caller' }, NOW).error, 'unknown-field');
const pilotMissingNotes = { ...pilotCreatePayload }; delete pilotMissingNotes.notes;
equal(sandbox.ooCanonicalMutation_('officePilotCreate', pilotMissingNotes).error, 'invalid-input');
equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, surprise: true }).error, 'unknown-field');

// Consent stored, lifecycle, due-date, and create contracts.
const consent = sandbox.ooValidateConsent_(validConsent());
equal(consent.ok, true);
equal(sandbox.ooNextDueAtKst_(NOW, 6), '2027-02-28');
equal(sandbox.ooNextDueAtKst_('2028-02-29T10:00:00+09:00', 12), '2029-02-28');
equal(sandbox.ooValidateConsent_(validConsent({ intervalMonths: 9 })).error, 'invalid-consent');
equal(sandbox.ooValidateConsent_(validConsent({ consentTextSnapshot: '동'.repeat(20000), consentTextSha256:sha256Text('동'.repeat(20000)) })).ok, true);
equal(sandbox.ooValidateConsent_(validConsent({ evidenceId: 'a'.repeat(200) })).ok, true);
equal(sandbox.ooValidateConsent_(validConsent({ evidenceId: 'a'.repeat(201) })).error, 'invalid-consent');
equal(sandbox.ooValidateConsent_(validConsent({ lastContactedAt: '2026-09-01T10:00:00+09:00' })).error, 'invalid-consent');
equal(sandbox.ooValidateConsent_(validConsent({ audit: [...validConsent().audit, { event: 'recorded', at: '2026-09-01T10:00:00+09:00', actor: '대표', reason: null }] })).error, 'invalid-consent');
equal(sandbox.ooValidateConsent_({ ...consent.value, surprise: true }).error, 'unknown-field');
equal(sandbox.ooValidateConsent_(validConsent({ audit: [{ ...validConsent().audit[0], surprise: true }] })).error, 'unknown-field');
const consentMissingStored = { ...consent.value }; delete consentMissingStored.evidenceId;
equal(sandbox.ooValidateConsent_(consentMissingStored).error, 'invalid-consent');
equal(sandbox.ooValidateStore_({ ...emptyStore, consents: [validConsent({ audit: [{ ...validConsent().audit[0], surprise: true }] })] }).error, 'unknown-field');
const consentCreatePayload = {
  idempotencyKey: 'create_consent_123456', subjectType: 'aptOrder', subjectId: 'order01',
  purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
  consentVersion: 'reinspection-v1', consentTextSnapshot: '재점검 연락에 동의합니다.',
  consentTextSha256: sha256Text('재점검 연락에 동의합니다.'), recordedBy: '대표', consentedAt: NOW,
  evidenceType: 'message', evidenceId: 'record_test'
};
equal(sandbox.ooValidateConsentCreate_(consentCreatePayload, '2026-08-31T10:00:01+09:00').ok, true);
equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentedAt: '2026-08-31T10:00:00' }, NOW).error, 'invalid-consent');
equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentedAt: '2026-02-30T10:00:00+09:00' }, NOW).error, 'invalid-consent');
equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, intervalMonths: 9 }, NOW).error, 'invalid-consent');
equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentId: 'consent_caller' }, NOW).error, 'unknown-field');
const withdrawn = sandbox.ooWithdrawConsent_(consent.value, '대표', '철회', '2026-09-01T10:00:00+09:00');
equal(withdrawn.withdrawnAt, '2026-09-01T10:00:00+09:00');
deepEqual(withdrawn.audit[withdrawn.audit.length - 1], { event: 'withdrawn', at: '2026-09-01T10:00:00+09:00', actor: '대표', reason: '철회' });
equal(consent.value.withdrawnAt, null, 'withdrawal must not mutate the validated source row');
equal(sandbox.ooWithdrawConsent_(withdrawn, '대표', '다시 철회', '2026-09-02T10:00:00+09:00').error, 'already-withdrawn');
equal(sandbox.ooWithdrawConsent_(consent.value, '', '철회', '2026-09-01T10:00:00+09:00').error, 'invalid-consent');
equal(sandbox.ooConsentActive_(withdrawn, Date.parse('2026-09-01T10:00:01+09:00')), false);
equal(sandbox.ooConsentActive_(consent.value, NOW_MS), true);
deepEqual(Array.from(sandbox.ooDueConsents_([consent.value, withdrawn], Date.parse('2027-02-28T12:00:00+09:00')).map(x => x.consentId)), ['consent_test']);
const consentA = validConsent({ consentId: 'consent_a' });
const consentB = validConsent({ consentId: 'consent_b' });
deepEqual(Array.from(sandbox.ooDueConsents_([consentB, consentA], Date.parse('2027-02-28T12:00:00+09:00')).map(x => x.consentId)), ['consent_a', 'consent_b']);

// Commercial canonical parity, approval metadata, and inspection contracts.
const commercialInput = {
  workKind: 'device-diagnosis', scope: '  욕실 누수 장비 진단  ', exclusions: ['복구 공사', '타일'],
  vatMode: 'included', quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '  2026-09-02 오후  '
};
const commercial = sandbox.ooCanonicalCommercialTerms_(commercialInput);
const commercialGolden = commercialSandbox.caCanonicalTerms_(commercialInput);
const commercialJson = '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}';
equal(commercial.ok, true);
equal(commercial.json, commercialJson);
equal(commercial.json, commercialGolden.json, 'OfficeOps JSON must be byte-identical to the actual commercial relay');
equal(commercial.sha256Hex, commercialGolden.sha256Hex, 'OfficeOps hash must equal the actual commercial relay');
equal(commercial.sha256Hex, 'd281f3a06b118ecba257558c569bb48da25869c78f0ea6fc2b42cba622e0d52f');
equal(commercial.sha256Hex, crypto.createHash('sha256').update(commercialJson).digest('hex'));
equal(sandbox.ooCanonicalCommercialTerms_({ ...commercialInput, exclusions: ['타일', '복구 공사'] }).sha256Hex === commercial.sha256Hex, false);
deepEqual(sandbox.ooCanonicalCommercialTerms_({ ...commercialInput, exclusions: [1, false] }).value.exclusions, ['1', 'false']);
equal(sandbox.ooCanonicalCommercialTerms_({ ...commercialInput, validUntil: '2026-02-30' }).error, 'invalid-terms');
equal(sandbox.ooCanonicalCommercialTerms_({ ...commercialInput, surprise: true }).error, 'invalid-terms');
equal(sandbox.ooTermsSha256_(commercialInput), commercial.sha256Hex);

const approvalMetadata = validApproval(commercial.sha256Hex);
equal(sandbox.ooValidateApprovalMetadata_(approvalMetadata).ok, true);
equal(sandbox.ooValidateApprovalMetadata_({ ...approvalMetadata, surprise: true }).error, 'unknown-field');
const approvalMissingHmac = { ...approvalMetadata }; delete approvalMissingHmac.receiptHmac;
equal(sandbox.ooValidateApprovalMetadata_(approvalMissingHmac).error, 'invalid-commercial-approval');
equal(sandbox.ooValidateApprovalMetadata_({ ...approvalMetadata, issuedAt: '2026-08-31T09:59:59+09:00' }).error, 'invalid-commercial-approval');
equal(sandbox.ooValidateApprovalMetadata_({ ...approvalMetadata, receiptHmac: 'B'.repeat(64) }).error, 'invalid-commercial-approval');
equal(sandbox.ooReceiptId_(approvalMetadata), 'receipt_test_001');
equal(sandbox.ooReceiptId_(approvalMissingHmac), '');
equal(sandbox.ooApprovalProofMatches_(approvalMetadata, { receiptId: 'receipt_test_001', pendingOrderId: 'pending_test_001', receiptSubjectType: 'aptOrder', receiptSubjectId: 'pending_test_001' }, commercial.sha256Hex), true);
equal(sandbox.ooApprovalProofMatches_(approvalMetadata, { receiptId: 'receipt_test_001', pendingOrderId: 'other', receiptSubjectType: 'aptOrder', receiptSubjectId: 'other' }, commercial.sha256Hex), false);

const inspection = sandbox.ooValidateInspection_(validInspection());
equal(inspection.ok, true);
equal(sandbox.ooValidateInspection_({ ...inspection.value, conversionStartedAt: NOW }).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_({ ...inspection.value, surprise: true }).error, 'unknown-field');
const inspectionMissingStored = { ...inspection.value }; delete inspectionMissingStored.summary;
equal(sandbox.ooValidateInspection_(inspectionMissingStored).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_(validInspection({ complexName: '가'.repeat(100), summary: '가'.repeat(2000), riskItems: Array(20).fill('가'.repeat(200)) })).ok, true);
equal(sandbox.ooValidateInspection_(validInspection({ complexName: '가'.repeat(101) })).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_(validInspection({ summary: '가'.repeat(2001) })).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_(validInspection({ riskItems: Array(21).fill('확인') })).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_(validInspection({ riskItems: ['가'.repeat(201)] })).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_(validInspection({ commercialTerms: validTerms() })).ok, true);
equal(sandbox.ooValidateInspection_(validInspection({ commercialTerms: validTerms({ scope: '  배수 점검  ' }) })).error, 'invalid-terms');
equal(sandbox.ooValidateInspection_(validInspection({ commercialTerms: { ...validTerms(), surprise: true } })).error, 'unknown-field');
const approvedInspection = validInspection({
  status: 'conversion-pending', commercialTerms: commercial.value, commercialApproval: approvalMetadata,
  conversionId: 'conversion_test_001', conversionTermsSha256: commercial.sha256Hex,
  conversionReceiptId: 'receipt_test_001', pendingOrderId: 'pending_test_001', conversionStartedAt: '2026-08-31T10:00:01+09:00'
});
equal(sandbox.ooValidateInspection_(approvedInspection).ok, true);
equal(sandbox.ooValidateInspection_({ ...approvedInspection, commercialApproval: { ...approvalMetadata, surprise: true } }).error, 'unknown-field');
equal(sandbox.ooValidateInspection_({ ...approvedInspection, commercialApproval: approvalMissingHmac }).error, 'invalid-commercial-approval');
equal(sandbox.ooValidateInspection_({ ...approvedInspection, linkedOrderId: 'pending_test_001' }).error, 'invalid-inspection');
equal(sandbox.ooValidateInspection_({ ...approvedInspection, status: 'conversion-writing' }).ok, true);
equal(sandbox.ooValidateInspection_({ ...approvedInspection, status: 'conversion-local-committed', linkedOrderId: 'pending_test_001' }).ok, true);
equal(sandbox.ooValidateInspection_({ ...approvedInspection, status: 'converted', linkedOrderId: 'pending_test_001' }).ok, true);
equal(sandbox.ooValidateInspection_({ ...approvedInspection, status: 'converted', linkedOrderId: 'other_order' }).error, 'invalid-inspection');
const inspectionCreatePayload = {
  idempotencyKey: 'create_inspect_12345', officeId: 'office_test', complexName: '테스트 단지',
  templateId: 'preventive-v1', status: 'proposal', nextDueAt: '2026-09-02', riskItems: ['배수 확인'],
  summary: '접근 허가 후 점검', commercialTerms: validTerms(), commercialApproval: null
};
equal(sandbox.ooValidateInspectionCreate_(inspectionCreatePayload, NOW).ok, true);
const normalizedInspectionCreate = sandbox.ooValidateInspectionCreate_({ ...inspectionCreatePayload, commercialTerms: validTerms({ scope: '  배수 점검  ', quotedAmount: '100000' }) }, NOW);
equal(normalizedInspectionCreate.ok, true);
equal(normalizedInspectionCreate.value.commercialTerms.scope, '배수 점검');
equal(normalizedInspectionCreate.value.commercialTerms.quotedAmount, 100000);
equal(sandbox.ooValidateInspectionCreate_({ ...inspectionCreatePayload, status: 'conversion-pending' }, NOW).error, 'invalid-inspection');
equal(sandbox.ooValidateInspectionCreate_({ ...inspectionCreatePayload, commercialApproval: approvalMetadata }, NOW).error, 'invalid-inspection');
equal(sandbox.ooValidateInspectionCreate_({ ...inspectionCreatePayload, inspectionId: 'inspection_caller' }, NOW).error, 'unknown-field');

// K-apt opportunity contracts.
const opportunity = sandbox.ooValidateOpportunity_(validOpportunity());
equal(opportunity.ok, true);
equal(sandbox.ooValidateOpportunity_({ ...opportunity.value, surprise: true }).error, 'unknown-field');
const opportunityMissingStored = { ...opportunity.value }; delete opportunityMissingStored.notes;
equal(sandbox.ooValidateOpportunity_(opportunityMissingStored).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ complexName: '가'.repeat(100), notes: '가'.repeat(2000), requirements: Array(20).fill('가'.repeat(200)) })).ok, true);
equal(sandbox.ooValidateOpportunity_(validOpportunity({ complexName: '가'.repeat(101) })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ notes: '가'.repeat(2001) })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ requirements: Array(21).fill('확인') })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ requirements: ['가'.repeat(201)] })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ officialUrl: 'https://k-apt.go.kr/a?x=1#section' })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ stage: 'skip', retentionStartedAt: NOW })).ok, true);
equal(sandbox.ooValidateOpportunity_(validOpportunity({ stage: 'closed', retentionStartedAt: NOW })).ok, true);
equal(sandbox.ooValidateOpportunity_(validOpportunity({ stage: 'skip', retentionStartedAt: null })).error, 'invalid-opportunity');
equal(sandbox.ooValidateOpportunity_(validOpportunity({ stage: 'review', retentionStartedAt: NOW })).error, 'invalid-opportunity');
equal(sandbox.ooOfficialKaptUrl_(' https://www.k-apt.go.kr/a?x=1#section '), 'https://www.k-apt.go.kr/a?x=1');
equal(sandbox.ooOfficialKaptUrl_('https://k-apt.go.kr'), 'https://k-apt.go.kr');
equal(sandbox.ooOfficialKaptUrl_('https://www.k-apt.go.kr:443/a'), '');
equal(sandbox.ooOfficialKaptUrl_('https://user@www.k-apt.go.kr/a'), '');
equal(sandbox.ooOfficialKaptUrl_('http://www.k-apt.go.kr/a'), '');
equal(sandbox.ooOfficialKaptUrl_('https://evil.example/?next=https://www.k-apt.go.kr'), '');
equal(sandbox.ooCanOpportunityParticipate_(opportunity.value, Date.parse('2026-08-31T10:05:00+09:00'), Date.parse('2026-08-31T10:00:00+09:00')), true);
equal(sandbox.ooCanOpportunityParticipate_(opportunity.value, Date.parse('2026-08-31T10:05:01+09:00'), Date.parse('2026-08-31T10:00:00+09:00')), false);
equal(sandbox.ooCanOpportunityParticipate_(opportunity.value, Date.parse('2026-09-01T10:00:00+09:00'), Date.parse('2026-09-01T10:00:00+09:00')), false);
const opportunityCreatePayload = {
  idempotencyKey: 'create_opport_12345', complexName: '테스트 단지', officialUrl: 'https://www.k-apt.go.kr/a?x=1#section',
  observedAt: NOW, region: '대전', category: '배관', deadlineAt: '2026-09-01T10:00:00+09:00',
  stage: 'review', requirements: ['면허 확인'], verifiedBy: '대표', notes: ''
};
const normalizedOpportunityCreate = sandbox.ooValidateOpportunityCreate_(opportunityCreatePayload, NOW);
equal(normalizedOpportunityCreate.ok, true);
equal(normalizedOpportunityCreate.value.officialUrl, 'https://www.k-apt.go.kr/a?x=1');
equal(sandbox.ooValidateOpportunityCreate_({ ...opportunityCreatePayload, opportunityId: 'opp_caller' }, NOW).error, 'unknown-field');

// Canonical maps cover exactly all 19 mutations and preserve fixed field order.
const beginPayload = {
  inspectionId: 'inspection_test', conversionId: 'conversion_test_001', pendingOrderId: 'pending_test_001',
  receiptId: 'receipt_test_001', receiptSubjectType: 'aptOrder', receiptSubjectId: 'pending_test_001',
  termsSha256: commercial.sha256Hex, commercialTerms: commercialInput, commercialApproval: approvalMetadata,
  expectedRevision: 1
};
const expectedCanonicalFields = {
  officePilotCreate: ['idempotencyKey','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'],
  officePilotUpdate: ['pilotId','expectedRevision','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'],
  officePilotArchive: ['pilotId','expectedRevision','archiveReason'], officePilotRestore: ['pilotId','expectedRevision'],
  officeConsentRecord: ['idempotencyKey','subjectType','subjectId','purpose','intervalMonths','channel','consentVersion','consentTextSnapshot','consentTextSha256','recordedBy','consentedAt','evidenceType','evidenceId'],
  officeConsentWithdraw: ['consentId','expectedRevision','withdrawnBy','withdrawalReason'],
  officeInspectionCreate: ['idempotencyKey','officeId','complexName','templateId','status','nextDueAt','riskItems','summary','commercialTerms','commercialApproval'],
  officeInspectionUpdate: ['inspectionId','expectedRevision','officeId','complexName','templateId','status','nextDueAt','riskItems','summary','commercialTerms','commercialApproval'],
  officeInspectionArchive: ['inspectionId','expectedRevision','archiveReason'],
  officeInspectionBeginConversion: ['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','commercialTerms','commercialApproval','expectedRevision'],
  officeInspectionArmLocalCommit: ['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionRecordLocalCommit: ['inspectionId','conversionId','pendingOrderId','linkedOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionFinalizeConversion: ['inspectionId','conversionId','pendingOrderId','linkedOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionCancelConversion: ['inspectionId','conversionId','expectedRevision'], officeInspectionRestore: ['inspectionId','expectedRevision'],
  officeOpportunityCreate: ['idempotencyKey','complexName','officialUrl','observedAt','region','category','deadlineAt','stage','requirements','verifiedBy','notes'],
  officeOpportunityUpdate: ['opportunityId','expectedRevision','complexName','officialUrl','observedAt','region','category','deadlineAt','stage','requirements','verifiedBy','notes'],
  officeOpportunityArchive: ['opportunityId','expectedRevision','archiveReason'], officeOpportunityRestore: ['opportunityId','expectedRevision']
};
const canonicalTermsHash = 'd281f3a06b118ecba257558c569bb48da25869c78f0ea6fc2b42cba622e0d52f';
const canonicalRawTerms = {
  scheduleWindow: '  2026-09-02 오후  ', validUntil: '2026-09-30', quotedAmount: '100000',
  vatMode: 'included', exclusions: ['복구 공사', '타일'], scope: '  욕실 누수 장비 진단  ', workKind: 'device-diagnosis'
};
const canonicalExpectedTerms = {
  workKind: 'device-diagnosis', scope: '욕실 누수 장비 진단', exclusions: ['복구 공사', '타일'],
  vatMode: 'included', quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '2026-09-02 오후'
};
const canonicalApprovalInput = {
  receiptHmac: 'b'.repeat(64), issuedAt: '2026-08-31T10:00:01+09:00', approvedByRole: 'management-office',
  approvedAt: NOW, approvalEvidenceSha256: 'a'.repeat(64), approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001',
  approvalEvidenceType: 'quote-file', approvedTermsSha256: canonicalTermsHash, subjectId: 'pending_test_001',
  subjectType: 'aptOrder', receiptId: 'receipt_test_001'
};
const canonicalExpectedApproval = {
  receiptId: 'receipt_test_001', subjectType: 'aptOrder', subjectId: 'pending_test_001',
  approvedTermsSha256: canonicalTermsHash, approvalEvidenceType: 'quote-file',
  approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256: 'a'.repeat(64),
  approvedAt: NOW, approvedByRole: 'management-office', issuedAt: '2026-08-31T10:00:01+09:00',
  receiptHmac: 'b'.repeat(64)
};
const canonicalCases = {
  officePilotCreate: {
    input: { idempotencyKey:'create_pilot_123456', complexName:'신규 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T18:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'신규 상담 메모' },
    expected: { idempotencyKey:'create_pilot_123456', complexName:'신규 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T18:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'신규 상담 메모' }
  },
  officePilotUpdate: {
    input: { notes:'후속 상담 메모', owner:'대표', nextActionAt:'2026-09-03', extensionApprovedAt:null, pilotEndsAt:null, pilotStartedAt:null, stage:'contacted', source:'referral', complexName:'수정 단지', expectedRevision:7, pilotId:'pilot_test' },
    expected: { pilotId:'pilot_test', expectedRevision:7, complexName:'수정 단지', source:'referral', stage:'contacted', pilotStartedAt:null, pilotEndsAt:null, extensionApprovedAt:null, nextActionAt:'2026-09-03', owner:'대표', notes:'후속 상담 메모' }
  },
  officePilotArchive: {
    input: { archiveReason:'상담 종료', expectedRevision:8, pilotId:'pilot_test' },
    expected: { pilotId:'pilot_test', expectedRevision:8, archiveReason:'상담 종료' }
  },
  officePilotRestore: {
    input: { expectedRevision:9, pilotId:'pilot_test' },
    expected: { pilotId:'pilot_test', expectedRevision:9 }
  },
  officeConsentRecord: {
    input: { evidenceId:'record_test', evidenceType:'message', consentedAt:NOW, recordedBy:'대표', consentTextSha256:sha256Text('재점검 연락 선택 동의 원문'), consentTextSnapshot:'재점검 연락 선택 동의 원문', consentVersion:'reinspection-v1', channel:'kakao', intervalMonths:12, purpose:'preventive-reinspection', subjectId:'order01', subjectType:'aptOrder', idempotencyKey:'create_consent_123456' },
    expected: { idempotencyKey:'create_consent_123456', subjectType:'aptOrder', subjectId:'order01', purpose:'preventive-reinspection', intervalMonths:12, channel:'kakao', consentVersion:'reinspection-v1', consentTextSnapshot:'재점검 연락 선택 동의 원문', consentTextSha256:sha256Text('재점검 연락 선택 동의 원문'), recordedBy:'대표', consentedAt:NOW, evidenceType:'message', evidenceId:'record_test' }
  },
  officeConsentWithdraw: {
    input: { withdrawalReason:'철회 요청', withdrawnBy:'대표', expectedRevision:10, consentId:'consent_test' },
    expected: { consentId:'consent_test', expectedRevision:10, withdrawnBy:'대표', withdrawalReason:'철회 요청' }
  },
  officeInspectionCreate: {
    input: { commercialApproval:null, commercialTerms:canonicalRawTerms, summary:'점검 생성 요약', riskItems:['배수 확인','옥상 우수관 확인'], nextDueAt:'2026-09-02', status:'proposal', templateId:'preventive-v1', complexName:'점검 단지', officeId:'office_test', idempotencyKey:'create_inspect_12345' },
    expected: { idempotencyKey:'create_inspect_12345', officeId:'office_test', complexName:'점검 단지', templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-02', riskItems:['배수 확인','옥상 우수관 확인'], summary:'점검 생성 요약', commercialTerms:canonicalExpectedTerms, commercialApproval:null }
  },
  officeInspectionUpdate: {
    input: { commercialApproval:null, commercialTerms:canonicalRawTerms, summary:'점검 수정 요약', riskItems:['저수조 확인','배수펌프 확인'], nextDueAt:'2026-10-02', status:'checked', templateId:'rainy-v1', complexName:'수정 점검 단지', officeId:'office_update', expectedRevision:11, inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', expectedRevision:11, officeId:'office_update', complexName:'수정 점검 단지', templateId:'rainy-v1', status:'checked', nextDueAt:'2026-10-02', riskItems:['저수조 확인','배수펌프 확인'], summary:'점검 수정 요약', commercialTerms:canonicalExpectedTerms, commercialApproval:null }
  },
  officeInspectionArchive: {
    input: { archiveReason:'계획 보류', expectedRevision:12, inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', expectedRevision:12, archiveReason:'계획 보류' }
  },
  officeInspectionBeginConversion: {
    input: { expectedRevision:13, commercialApproval:canonicalApprovalInput, commercialTerms:canonicalRawTerms, termsSha256:canonicalTermsHash, receiptSubjectId:'pending_test_001', receiptSubjectType:'aptOrder', receiptId:'receipt_test_001', pendingOrderId:'pending_test_001', conversionId:'conversion_test_001', inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:canonicalTermsHash, commercialTerms:canonicalExpectedTerms, commercialApproval:canonicalExpectedApproval, expectedRevision:13 }
  },
  officeInspectionArmLocalCommit: {
    input: { expectedRevision:14, termsSha256:canonicalTermsHash, receiptSubjectId:'pending_test_001', receiptSubjectType:'aptOrder', receiptId:'receipt_test_001', pendingOrderId:'pending_test_001', conversionId:'conversion_test_001', inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:canonicalTermsHash, expectedRevision:14 }
  },
  officeInspectionRecordLocalCommit: {
    input: { expectedRevision:15, termsSha256:canonicalTermsHash, receiptSubjectId:'pending_test_001', receiptSubjectType:'aptOrder', receiptId:'receipt_test_001', linkedOrderId:'pending_test_001', pendingOrderId:'pending_test_001', conversionId:'conversion_test_001', inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', linkedOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:canonicalTermsHash, expectedRevision:15 }
  },
  officeInspectionFinalizeConversion: {
    input: { expectedRevision:16, termsSha256:canonicalTermsHash, receiptSubjectId:'pending_test_001', receiptSubjectType:'aptOrder', receiptId:'receipt_test_001', linkedOrderId:'pending_test_001', pendingOrderId:'pending_test_001', conversionId:'conversion_test_001', inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', linkedOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:canonicalTermsHash, expectedRevision:16 }
  },
  officeInspectionCancelConversion: {
    input: { expectedRevision:17, conversionId:'conversion_test_001', inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', conversionId:'conversion_test_001', expectedRevision:17 }
  },
  officeInspectionRestore: {
    input: { expectedRevision:18, inspectionId:'inspection_test' },
    expected: { inspectionId:'inspection_test', expectedRevision:18 }
  },
  officeOpportunityCreate: {
    input: { notes:'공고 생성 메모', verifiedBy:'대표', requirements:['면허 확인','현장설명 확인'], stage:'review', deadlineAt:'2026-09-30T18:00:00+09:00', category:'배관', region:'대전', observedAt:NOW, officialUrl:'  https://www.k-apt.go.kr/a?x=1#section  ', complexName:'공고 단지', idempotencyKey:'create_opport_12345' },
    expected: { idempotencyKey:'create_opport_12345', complexName:'공고 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:NOW, region:'대전', category:'배관', deadlineAt:'2026-09-30T18:00:00+09:00', stage:'review', requirements:['면허 확인','현장설명 확인'], verifiedBy:'대표', notes:'공고 생성 메모' }
  },
  officeOpportunityUpdate: {
    input: { notes:'공고 수정 메모', verifiedBy:'대표', requirements:['공동인증서 확인','제출서류 확인'], stage:'watch', deadlineAt:'2026-10-15T18:00:00+09:00', category:'누수', region:'대전 중구', observedAt:'2026-09-01T10:00:00+09:00', officialUrl:' https://k-apt.go.kr/b?notice=2#detail ', complexName:'수정 공고 단지', expectedRevision:19, opportunityId:'opp_test' },
    expected: { opportunityId:'opp_test', expectedRevision:19, complexName:'수정 공고 단지', officialUrl:'https://k-apt.go.kr/b?notice=2', observedAt:'2026-09-01T10:00:00+09:00', region:'대전 중구', category:'누수', deadlineAt:'2026-10-15T18:00:00+09:00', stage:'watch', requirements:['공동인증서 확인','제출서류 확인'], verifiedBy:'대표', notes:'공고 수정 메모' }
  },
  officeOpportunityArchive: {
    input: { archiveReason:'공고 종료', expectedRevision:20, opportunityId:'opp_test' },
    expected: { opportunityId:'opp_test', expectedRevision:20, archiveReason:'공고 종료' }
  },
  officeOpportunityRestore: {
    input: { expectedRevision:21, opportunityId:'opp_test' },
    expected: { opportunityId:'opp_test', expectedRevision:21 }
  }
};
const canonicalNormalizationExceptions = new Set([
  'officeInspectionCreate', 'officeInspectionUpdate', 'officeInspectionBeginConversion',
  'officeOpportunityCreate', 'officeOpportunityUpdate'
]);
for (const [action, testCase] of Object.entries(canonicalCases)) {
  const sourceBefore = JSON.stringify(testCase.input);
  const canonical = sandbox.ooCanonicalMutation_(action, testCase.input);
  const parsed = JSON.parse(canonical.json);
  const expectedEnvelope = { action, payload: testCase.expected };
  const expectedJson = JSON.stringify(expectedEnvelope);
  equal(canonical.ok, true, action + ' succeeds');
  equal(canonical.json, expectedJson, action + ' exact canonical JSON');
  deepEqual(parsed, expectedEnvelope, action + ' exact canonical values');
  deepEqual(Object.keys(parsed), ['action','payload'], action + ' top-level order');
  deepEqual(Object.keys(parsed.payload), expectedCanonicalFields[action], action + ' payload order');
  equal(canonical.sha256Hex, crypto.createHash('sha256').update(expectedJson).digest('hex'), action + ' exact hash');
  match(canonical.sha256Hex, /^[0-9a-f]{64}$/, action + ' lowercase hash');
  equal(JSON.stringify(testCase.input), sourceBefore, action + ' source payload remains unchanged');
  if (!canonicalNormalizationExceptions.has(action)) deepEqual(parsed.payload, testCase.input, action + ' raw values preserved');
  equal(sandbox.ooCanonicalMutation_(action, { ...testCase.input, surprise:true }).error, 'unknown-field', action + ' rejects extra');
  const firstKey = Object.keys(testCase.input)[0];
  const missing = { ...testCase.input }; delete missing[firstKey];
  equal(sandbox.ooCanonicalMutation_(action, missing).error, 'invalid-input', action + ' rejects missing');
}
const nullCommercialTermsCases = {
  officeInspectionCreate: {
    input: { commercialApproval:null, commercialTerms:null, summary:'상업 조건 미정 생성', riskItems:['배관 상태 확인','누수 흔적 확인'], nextDueAt:'2026-11-05', status:'proposal', templateId:'preventive-v1', complexName:'조건 미정 생성 단지', officeId:'office_null_create', idempotencyKey:'null_terms_create_123' },
    expected: { idempotencyKey:'null_terms_create_123', officeId:'office_null_create', complexName:'조건 미정 생성 단지', templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-11-05', riskItems:['배관 상태 확인','누수 흔적 확인'], summary:'상업 조건 미정 생성', commercialTerms:null, commercialApproval:null }
  },
  officeInspectionUpdate: {
    input: { commercialApproval:null, commercialTerms:null, summary:'상업 조건 미정 수정', riskItems:['옥상 배수 확인','지하 배관 확인'], nextDueAt:'2026-12-05', status:'checked', templateId:'rainy-v1', complexName:'조건 미정 수정 단지', officeId:'office_null_update', expectedRevision:22, inspectionId:'inspection_null_update' },
    expected: { inspectionId:'inspection_null_update', expectedRevision:22, officeId:'office_null_update', complexName:'조건 미정 수정 단지', templateId:'rainy-v1', status:'checked', nextDueAt:'2026-12-05', riskItems:['옥상 배수 확인','지하 배관 확인'], summary:'상업 조건 미정 수정', commercialTerms:null, commercialApproval:null }
  }
};
for (const [action, testCase] of Object.entries(nullCommercialTermsCases)) {
  const sourceBefore = JSON.stringify(testCase.input);
  const canonical = sandbox.ooCanonicalMutation_(action, testCase.input);
  const expectedEnvelope = { action, payload:testCase.expected };
  const expectedJson = JSON.stringify(expectedEnvelope);
  const parsed = JSON.parse(canonical.json);
  equal(canonical.ok, true, action + ' accepts null commercial terms');
  equal(canonical.json, expectedJson, action + ' preserves exact null commercial terms JSON');
  deepEqual(parsed, expectedEnvelope, action + ' preserves exact null commercial terms envelope');
  deepEqual(Object.keys(parsed), ['action','payload'], action + ' null variant top-level order');
  deepEqual(Object.keys(parsed.payload), expectedCanonicalFields[action], action + ' null variant payload order');
  equal(canonical.sha256Hex, crypto.createHash('sha256').update(expectedJson).digest('hex'), action + ' null variant exact hash');
  match(canonical.sha256Hex, /^[0-9a-f]{64}$/, action + ' null variant lowercase hash');
  equal(JSON.stringify(testCase.input), sourceBefore, action + ' null variant source remains unchanged');
}
equal(Object.keys(nullCommercialTermsCases).length, 2);
equal(Object.keys(canonicalCases).length, 19);
equal(Object.keys(sandbox.OO_CANONICAL_FIELDS_).length, 19);
deepEqual(Object.fromEntries(Object.entries(sandbox.OO_CANONICAL_FIELDS_).map(([key, fields]) => [key, Array.from(fields)])), expectedCanonicalFields);
equal(sandbox.ooCanonicalMutation_('officeOpsList', {}).error, 'bad-request');
equal(sandbox.ooCanonicalMutation_('officeConsentContact', {}).error, 'bad-request');
const canonicalBegin = sandbox.ooCanonicalMutation_('officeInspectionBeginConversion', beginPayload);
deepEqual(Object.keys(JSON.parse(canonicalBegin.json).payload.commercialApproval), [
  'receiptId', 'subjectType', 'subjectId', 'approvedTermsSha256', 'approvalEvidenceType',
  'approvalEvidenceFileId', 'approvalEvidenceSha256', 'approvedAt', 'approvedByRole', 'issuedAt', 'receiptHmac'
]);
equal(sandbox.ooCanonicalMutation_('officeInspectionBeginConversion', { ...beginPayload, commercialApproval: { ...approvalMetadata, surprise: true } }).error, 'unknown-field');
equal(sandbox.ooCanonicalMutation_('officeInspectionBeginConversion', { ...beginPayload, commercialApproval: approvalMissingHmac }).error, 'invalid-commercial-approval');
equal(sandbox.ooCanonicalMutation_('officeInspectionBeginConversion', { ...beginPayload, receiptSubjectId: 'other_order' }).error, 'receipt-mismatch');
equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, idempotencyKey: 'a'.repeat(16) }).ok, true);
equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, idempotencyKey: 'z'.repeat(80) }).ok, true);
equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, idempotencyKey: 'a'.repeat(15) }).error, 'invalid-input');
equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, idempotencyKey: 'z'.repeat(81) }).error, 'invalid-input');

// Archive/restore, IDs, duplicate detection, and retention rules.
const archiveTarget = { pilotId: 'pilot_test', ...tombstone() };
const archived = sandbox.ooArchive_(archiveTarget, 'representative', '상담 종료', NOW);
deepEqual(archived, { pilotId: 'pilot_test', archivedAt: NOW, archivedBy: 'representative', archiveReason: '상담 종료', restoredAt: null });
equal(archiveTarget.archivedAt, NOW, 'archive helper updates the supplied server-owned row');
equal(sandbox.ooArchive_(archived, 'representative', '다시', NOW).error, 'already-archived');
const restored = sandbox.ooRestore_(archived, 'representative', '2026-09-01T10:00:00+09:00');
deepEqual(restored, { pilotId: 'pilot_test', archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: '2026-09-01T10:00:00+09:00' });
equal(archived.restoredAt, '2026-09-01T10:00:00+09:00', 'restore helper updates the supplied server-owned row');
equal(sandbox.ooRestore_(restored, 'representative', NOW).error, 'not-archived');
match(sandbox.ooNewRecordId_('pilot'), /^pilot_[A-Za-z0-9_-]{1,100}$/);
match(sandbox.ooNewRecordId_('consent'), /^consent_[A-Za-z0-9_-]{1,100}$/);
match(sandbox.ooNewRecordId_('inspection'), /^inspection_[A-Za-z0-9_-]{1,100}$/);
match(sandbox.ooNewRecordId_('opportunity'), /^opp_[A-Za-z0-9_-]{1,100}$/);
equal(sandbox.ooNewRecordId_('other'), '');
equal(sandbox.ooValidateStore_({ ...emptyStore, pilots: [validPilot(), validPilot()] }).error, 'invalid-store');

equal(sandbox.ooRetentionStartedAtFor_('pilot', null, 'closed', NOW), NOW);
equal(sandbox.ooRetentionStartedAtFor_('pilot', NOW, 'closed', '2026-09-01T10:00:00+09:00'), NOW);
equal(sandbox.ooRetentionStartedAtFor_('pilot', NOW, 'contacted', '2026-09-01T10:00:00+09:00'), null);
equal(sandbox.ooRetentionStartedAtFor_('opportunity', null, 'skip', NOW), NOW);
equal(sandbox.ooRetentionStartedAtFor_('opportunity', NOW, 'closed', '2026-09-01T10:00:00+09:00'), NOW);
equal(sandbox.ooRetentionStartedAtFor_('opportunity', NOW, 'review', '2026-09-01T10:00:00+09:00'), null);
equal(sandbox.ooAddOneKstYear_('2028-02-29T10:00:00+09:00'), '2029-02-28T10:00:00+09:00');
equal(sandbox.ooAddOneKstYear_('2026-02-30T10:00:00+09:00'), '');
const duePilot = validPilot({ stage: 'closed', retentionStartedAt: NOW });
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, pilots: [duePilot] }, Date.parse('2027-08-31T09:59:59.999+09:00'))), []);
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, pilots: [duePilot] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'pilot', recordId: 'pilot_test', reason: 'closed', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const dueSkipOpportunity = validOpportunity({ stage: 'skip', retentionStartedAt: NOW });
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, opportunities: [dueSkipOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'opportunity', recordId: 'opp_test', reason: 'skip', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const dueClosedOpportunity = { ...dueSkipOpportunity, stage: 'closed' };
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, opportunities: [dueClosedOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'opportunity', recordId: 'opp_test', reason: 'closed', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const archivedDuePilot = { ...duePilot, archivedAt: '2026-09-01T10:00:00+09:00', archivedBy: 'representative', archiveReason: '정리', restoredAt: null };
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, pilots: [archivedDuePilot] }, Date.parse('2027-09-01T10:00:00+09:00'))), [{ recordType: 'pilot', recordId: 'pilot_test', reason: 'archived', referenceAt: '2026-09-01T10:00:00+09:00', eligibleAt: '2027-09-01T10:00:00+09:00' }]);
const archivedInspection = validInspection({ archivedAt: NOW, archivedBy: 'representative', archiveReason: '정리' });
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, inspections: [archivedInspection] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'inspection', recordId: 'inspection_test', reason: 'archived', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const archivedOpportunity = validOpportunity({ archivedAt: NOW, archivedBy: 'representative', archiveReason: '정리' });
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, opportunities: [archivedOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'opportunity', recordId: 'opp_test', reason: 'archived', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const withdrawnAtBoundary = validConsent({ withdrawnAt: NOW, withdrawnBy: '대표', withdrawalReason: '철회', audit: [validConsent().audit[0], { event: 'withdrawn', at: NOW, actor: '대표', reason: '철회' }] });
deepEqual(Array.from(sandbox.ooRetentionRows_({ ...emptyStore, consents: [withdrawnAtBoundary] }, Date.parse('2027-08-31T10:00:00+09:00'))), [{ recordType: 'consent', recordId: 'consent_test', reason: 'withdrawn', referenceAt: NOW, eligibleAt: '2027-08-31T10:00:00+09:00' }]);
const restoredTerminal = { ...archivedDuePilot, archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: '2027-08-30T10:00:00+09:00' };
equal(sandbox.ooRetentionRows_({ ...emptyStore, pilots: [restoredTerminal] }, Date.parse('2027-08-31T10:00:00+09:00'))[0].reason, 'closed');
const ordered = sandbox.ooRetentionRows_({
  ...emptyStore,
  pilots: [duePilot],
  consents: [{ ...withdrawnAtBoundary, consentId: 'consent_b' }, { ...withdrawnAtBoundary, consentId: 'consent_a' }],
  inspections: [archivedInspection], opportunities: [archivedOpportunity]
}, Date.parse('2027-08-31T10:00:00+09:00'));
deepEqual(Array.from(ordered.map(row => [row.eligibleAt, row.recordType, row.recordId])), [
  ['2027-08-31T10:00:00+09:00', 'consent', 'consent_a'],
  ['2027-08-31T10:00:00+09:00', 'consent', 'consent_b'],
  ['2027-08-31T10:00:00+09:00', 'inspection', 'inspection_test'],
  ['2027-08-31T10:00:00+09:00', 'opportunity', 'opp_test'],
  ['2027-08-31T10:00:00+09:00', 'pilot', 'pilot_test']
]);

// Task 4 RED: strict consent proof, human-only K-apt participation, conversion
// transitions, and store-wide conversion identity ownership.
equal(sandbox.ooValidateConsent_(validConsent({ consentTextSha256:'0'.repeat(64) })).error, 'invalid-consent', 'stored consent hash binds exact text');
equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentTextSha256:'0'.repeat(64) }, NOW).error, 'invalid-consent', 'create consent hash binds exact text');

const beforeDeadline = Date.parse('2026-08-31T10:00:00+09:00');
const deadline = Date.parse('2026-09-01T10:00:00+09:00');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity(), beforeDeadline, beforeDeadline), true, 'verified official K-apt opportunity may enter participation');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity({ verifiedBy:'외부' }), beforeDeadline, beforeDeadline), false, 'unverified opportunity cannot participate');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity({ requirements:[] }), beforeDeadline, beforeDeadline), false, 'participation requires checked documents');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity(), deadline, beforeDeadline), false, 'deadline equality is closed');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity(), beforeDeadline, deadline), false, 'request clock must also be before deadline');
equal(sandbox.ooCanOpportunityParticipate_(validOpportunity({ observedAt:'2026-09-01T10:00:01+09:00' }), beforeDeadline, beforeDeadline), false, 'future observation is unverified');

const lifecycleTerms = validTerms();
const lifecycleTermsHash = sandbox.ooTermsSha256_(lifecycleTerms);
const lifecycleApproval = validApproval(lifecycleTermsHash);
const lifecycleProof = {
  inspectionId:'inspection_lifecycle', conversionId:'conversion_lifecycle_001', pendingOrderId:'pending_lifecycle_001',
  receiptId:lifecycleApproval.receiptId, receiptSubjectType:'aptOrder', receiptSubjectId:'pending_lifecycle_001',
  termsSha256:lifecycleTermsHash, commercialTerms:lifecycleTerms, commercialApproval:lifecycleApproval, expectedRevision:0
};
lifecycleApproval.subjectId = lifecycleProof.pendingOrderId;
const lifecycleInspection = validInspection({ inspectionId:'inspection_lifecycle', commercialTerms:lifecycleTerms });
equal(sandbox.ooConversionTransition_(lifecycleInspection, 'begin', lifecycleProof, NOW).ok, true, 'begin freezes proof');
equal(lifecycleInspection.status, 'conversion-pending');
equal(lifecycleInspection.conversionStartedAt, NOW);
deepEqual(lifecycleInspection.commercialApproval, lifecycleApproval);
equal(sandbox.ooConversionTransition_(lifecycleInspection, 'arm', lifecycleProof, '2026-08-31T10:00:01+09:00').ok, true, 'arm advances pending');
equal(lifecycleInspection.status, 'conversion-writing');
const recordProof = { ...lifecycleProof, linkedOrderId:lifecycleProof.pendingOrderId };
equal(sandbox.ooConversionTransition_(lifecycleInspection, 'record', recordProof, '2026-08-31T10:00:02+09:00').ok, true, 'record binds local order');
equal(lifecycleInspection.status, 'conversion-local-committed');
equal(lifecycleInspection.linkedOrderId, lifecycleProof.pendingOrderId);
equal(sandbox.ooConversionTransition_(lifecycleInspection, 'finalize', recordProof, '2026-08-31T10:00:03+09:00').ok, true, 'finalize closes conversion');
equal(lifecycleInspection.status, 'converted');
equal(sandbox.ooConversionTransition_(lifecycleInspection, 'cancel', lifecycleProof, NOW).error, 'invalid-conversion-state', 'cancel is blocked after arm');

const cancelInspection = validInspection({ inspectionId:'inspection_cancel', commercialTerms:lifecycleTerms });
equal(sandbox.ooConversionTransition_(cancelInspection, 'begin', { ...lifecycleProof, inspectionId:'inspection_cancel' }, NOW).ok, true);
equal(sandbox.ooConversionTransition_(cancelInspection, 'cancel', { inspectionId:'inspection_cancel', conversionId:lifecycleProof.conversionId, expectedRevision:1 }, '2026-08-31T10:00:01+09:00').ok, true);
deepEqual({
  status:cancelInspection.status, approval:cancelInspection.commercialApproval, conversionId:cancelInspection.conversionId,
  termsHash:cancelInspection.conversionTermsSha256, receipt:cancelInspection.conversionReceiptId,
  pending:cancelInspection.pendingOrderId, linked:cancelInspection.linkedOrderId, started:cancelInspection.conversionStartedAt
}, { status:'proposal', approval:null, conversionId:null, termsHash:null, receipt:null, pending:null, linked:null, started:null });
deepEqual(cancelInspection.commercialTerms, JSON.parse(JSON.stringify(sandbox.ooCanonicalCommercialTerms_(lifecycleTerms).value)), 'cancel retains normalized proposal terms');

const identityOwner = validInspection({
  inspectionId:'inspection_identity_owner', status:'converted', commercialTerms:lifecycleTerms,
  commercialApproval:lifecycleApproval, conversionId:'conversion_identity_001', conversionTermsSha256:lifecycleTermsHash,
  conversionReceiptId:lifecycleApproval.receiptId, pendingOrderId:lifecycleProof.pendingOrderId,
  linkedOrderId:lifecycleProof.pendingOrderId, conversionStartedAt:NOW
});
const identityOther = validInspection({
  inspectionId:'inspection_identity_other', status:'conversion-pending', commercialTerms:lifecycleTerms,
  commercialApproval:{ ...lifecycleApproval, receiptId:'receipt_identity_002', subjectId:'pending_identity_002' },
  conversionId:lifecycleProof.pendingOrderId, conversionTermsSha256:lifecycleTermsHash,
  conversionReceiptId:'receipt_identity_002', pendingOrderId:'pending_identity_002', linkedOrderId:null, conversionStartedAt:NOW
});
equal(sandbox.ooValidateStore_({ ...emptyStore, inspections:[identityOwner, identityOther] }).error, 'invalid-store', 'cross-inspection identities collide across field names');
equal(sandbox.ooValidateStore_({ ...emptyStore, inspections:[identityOwner] }).ok, true, 'same-owner pending and linked equality remains legal');

console.log('office ops pure tests: PASS (' + assertionCount + ' assertions)');

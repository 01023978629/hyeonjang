var OO_OFFICE_OPS_METADATA_FIELDS_ = [
  'commercialTerms',
  'commercialApproval',
  'conversionReceiptId',
  'conversionTermsSha256',
  'pendingOrderId',
  'linkedOrderId'
];

var OO_CANONICAL_FIELDS_ = {
  officePilotCreate: ['idempotencyKey', 'complexName', 'source', 'stage', 'pilotStartedAt', 'pilotEndsAt', 'extensionApprovedAt', 'nextActionAt', 'owner', 'notes'],
  officePilotUpdate: ['pilotId', 'expectedRevision', 'complexName', 'source', 'stage', 'pilotStartedAt', 'pilotEndsAt', 'extensionApprovedAt', 'nextActionAt', 'owner', 'notes'],
  officePilotArchive: ['pilotId', 'expectedRevision', 'archiveReason'],
  officePilotRestore: ['pilotId', 'expectedRevision'],
  officeConsentRecord: ['idempotencyKey', 'subjectType', 'subjectId', 'purpose', 'intervalMonths', 'channel', 'consentVersion', 'consentTextSnapshot', 'consentTextSha256', 'recordedBy', 'consentedAt', 'evidenceType', 'evidenceId'],
  officeConsentWithdraw: ['consentId', 'expectedRevision', 'withdrawnBy', 'withdrawalReason'],
  officeInspectionCreate: ['idempotencyKey', 'officeId', 'complexName', 'templateId', 'status', 'nextDueAt', 'riskItems', 'summary', 'commercialTerms', 'commercialApproval'],
  officeInspectionUpdate: ['inspectionId', 'expectedRevision', 'officeId', 'complexName', 'templateId', 'status', 'nextDueAt', 'riskItems', 'summary', 'commercialTerms', 'commercialApproval'],
  officeInspectionArchive: ['inspectionId', 'expectedRevision', 'archiveReason'],
  officeInspectionBeginConversion: ['inspectionId', 'conversionId', 'pendingOrderId', 'receiptId', 'receiptSubjectType', 'receiptSubjectId', 'termsSha256', 'commercialTerms', 'commercialApproval', 'expectedRevision'],
  officeInspectionArmLocalCommit: ['inspectionId', 'conversionId', 'pendingOrderId', 'receiptId', 'receiptSubjectType', 'receiptSubjectId', 'termsSha256', 'expectedRevision'],
  officeInspectionRecordLocalCommit: ['inspectionId', 'conversionId', 'pendingOrderId', 'linkedOrderId', 'receiptId', 'receiptSubjectType', 'receiptSubjectId', 'termsSha256', 'expectedRevision'],
  officeInspectionFinalizeConversion: ['inspectionId', 'conversionId', 'pendingOrderId', 'linkedOrderId', 'receiptId', 'receiptSubjectType', 'receiptSubjectId', 'termsSha256', 'expectedRevision'],
  officeInspectionCancelConversion: ['inspectionId', 'conversionId', 'expectedRevision'],
  officeInspectionRestore: ['inspectionId', 'expectedRevision'],
  officeOpportunityCreate: ['idempotencyKey', 'complexName', 'officialUrl', 'observedAt', 'region', 'category', 'deadlineAt', 'stage', 'requirements', 'verifiedBy', 'notes'],
  officeOpportunityUpdate: ['opportunityId', 'expectedRevision', 'complexName', 'officialUrl', 'observedAt', 'region', 'category', 'deadlineAt', 'stage', 'requirements', 'verifiedBy', 'notes'],
  officeOpportunityArchive: ['opportunityId', 'expectedRevision', 'archiveReason'],
  officeOpportunityRestore: ['opportunityId', 'expectedRevision']
};

var OO_TERMS_FIELDS_ = ['workKind', 'scope', 'exclusions', 'vatMode', 'quotedAmount', 'validUntil', 'scheduleWindow'];
var OO_APPROVAL_META_FIELDS_ = ['receiptId', 'subjectType', 'subjectId', 'approvedTermsSha256', 'approvalEvidenceType', 'approvalEvidenceFileId', 'approvalEvidenceSha256', 'approvedAt', 'approvedByRole', 'issuedAt', 'receiptHmac'];
var OO_TOMBSTONE_FIELDS_ = ['archivedAt', 'archivedBy', 'archiveReason', 'restoredAt'];
var OO_AUDIT_FIELDS_ = ['action', 'result', 'id', 'mutationId', 'idempotencyKey', 'payloadSha256', 'at', 'actor', 'lifecycleBefore', 'backupFileId', 'backupManifestFileId', 'backupSha256', 'preMutationRevision'];
var OO_CREATE_ACTIONS_ = ['officePilotCreate', 'officeConsentRecord', 'officeInspectionCreate', 'officeOpportunityCreate'];

function ooFail_(error) {
  return { ok: false, error: error };
}

function ooClone_(value) {
  return JSON.parse(JSON.stringify(value));
}

function ooExactKeys_(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  var keys = Object.keys(value);
  return keys.length === fields.length && fields.every(function(field) {
    return Object.prototype.hasOwnProperty.call(value, field);
  });
}

function ooValidatePayloadFields_(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ooFail_('invalid-input');
  var keys = Object.keys(value);
  if (keys.some(function(key) { return required.indexOf(key) < 0; })) return ooFail_('unknown-field');
  if (required.some(function(key) { return !Object.prototype.hasOwnProperty.call(value, key); })) return ooFail_('invalid-input');
  return { ok: true };
}

function ooValidateStoredFields_(value, required, invalidCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ooFail_(invalidCode);
  var keys = Object.keys(value);
  if (keys.some(function(key) { return required.indexOf(key) < 0; })) return ooFail_('unknown-field');
  if (required.some(function(key) { return !Object.prototype.hasOwnProperty.call(value, key); })) return ooFail_(invalidCode);
  return { ok: true };
}

function ooCanonicalNested_(fields, value) {
  var result = {};
  fields.forEach(function(key) { result[key] = value[key]; });
  return result;
}

function ooValidBoundedString_(value, minimum, maximum) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function ooValidStringArray_(value, maximumItems, maximumLength) {
  if (!Array.isArray(value) || value.length > maximumItems) return false;
  return value.every(function(item) { return ooValidBoundedString_(item, 1, maximumLength); });
}

function ooValidRevision_(value) {
  return Number.isInteger(value) && value >= 0;
}

function ooValidRequestId_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(value);
}

function ooValidIdempotencyKey_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

function ooValidSubjectId_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

function ooIsIsoDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split('-').map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function ooParseRequestTimestamp_(value) {
  if (typeof value !== 'string') return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var hour = Number(match[4]);
  var minute = Number(match[5]);
  var second = Number(match[6]);
  var calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  if (match[7] !== 'Z') {
    var offset = match[7].slice(1).split(':').map(Number);
    if (offset[0] > 14 || offset[1] > 59 || (offset[0] === 14 && offset[1] !== 0)) return null;
  }
  var timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ooParseKstDateTime_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value)) return null;
  var timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Utilities.formatDate(new Date(timestamp), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX") === value ? timestamp : null;
}

function ooValidateMutationEnvelope_(request, nowMs) {
  var fields = ooValidateStoredFields_(request, ['deviceId', 'mutationId', 'timestamp'], 'invalid-input');
  if (!fields.ok) return fields;
  if (!ooValidRequestId_(request.deviceId) || !ooValidRequestId_(request.mutationId)) return ooFail_('invalid-input');
  var timestamp = ooParseRequestTimestamp_(request.timestamp);
  if (timestamp === null || !Number.isFinite(nowMs)) return ooFail_('invalid-input');
  if (Math.abs(nowMs - timestamp) > 5 * 60 * 1000) return ooFail_('stale-request');
  return { ok: true, timestampMs: timestamp };
}

function ooValidateRequestEnvelope_(request, isRead, nowMs) {
  var required = isRead ? ['token', 'action', 'deviceId', 'timestamp', 'payload'] : ['token', 'action', 'deviceId', 'timestamp', 'mutationId', 'payload'];
  var fields = ooValidateStoredFields_(request, required, 'invalid-input');
  if (!fields.ok) return fields;
  if (typeof request.token !== 'string' || !request.token || typeof request.action !== 'string' || !request.action || !ooValidRequestId_(request.deviceId)) return ooFail_('invalid-input');
  var timestamp = ooParseRequestTimestamp_(request.timestamp);
  if (timestamp === null || !Number.isFinite(nowMs)) return ooFail_('invalid-input');
  if (Math.abs(nowMs - timestamp) > 5 * 60 * 1000) return ooFail_('stale-request');
  if (isRead) {
    if (request.action !== 'officeOpsList' && request.action !== 'officeOpsRetentionList') return ooFail_('bad-request');
    var readFields = request.action === 'officeOpsList' && Object.prototype.hasOwnProperty.call(request.payload || {}, 'includeArchived') ? ['includeArchived'] : [];
    var payloadFields = ooValidatePayloadFields_(request.payload, readFields);
    if (!payloadFields.ok) return payloadFields;
    if (readFields.length && typeof request.payload.includeArchived !== 'boolean') return ooFail_('invalid-input');
    return { ok: true, timestampMs: timestamp };
  }
  if (!Object.prototype.hasOwnProperty.call(OO_CANONICAL_FIELDS_, request.action)) return ooFail_('bad-request');
  if (!request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) return ooFail_('invalid-input');
  var mutation = ooValidateMutationEnvelope_({ deviceId: request.deviceId, mutationId: request.mutationId, timestamp: request.timestamp }, nowMs);
  return mutation.ok ? { ok: true, timestampMs: timestamp } : mutation;
}

function ooSha256Hex_(text) {
  return ooBytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.newBlob(text).getBytes()));
}

function ooBytesToHex_(bytes) {
  return bytes.map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function ooValidateTombstone_(value, invalidCode) {
  var archived = value.archivedAt !== null;
  if (archived) {
    if (ooParseKstDateTime_(value.archivedAt) === null || value.archivedBy !== 'representative' ||
        !ooValidBoundedString_(value.archiveReason, 1, 500) || value.restoredAt !== null) return ooFail_(invalidCode);
  } else if (value.archivedBy !== null || value.archiveReason !== null ||
      (value.restoredAt !== null && ooParseKstDateTime_(value.restoredAt) === null)) return ooFail_(invalidCode);
  return { ok: true };
}

function ooPilotEndsAtKst_(startDateKst) {
  if (!ooIsIsoDate_(startDateKst)) return '';
  var parts = startDateKst.split('-').map(Number);
  var startMs = Date.UTC(parts[0], parts[1] - 1, parts[2]) - 9 * 60 * 60 * 1000;
  return Utilities.formatDate(new Date(startMs + 30 * 86400000 - 1000), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function ooValidPilotSource_(source) {
  return ['website', 'phone', 'referral', 'kapt'].indexOf(source) >= 0;
}

function ooValidatePilot_(value) {
  var required = ['pilotId', 'complexName', 'source', 'stage', 'pilotStartedAt', 'pilotEndsAt', 'extensionApprovedAt', 'nextActionAt', 'owner', 'notes', 'createdAt', 'updatedAt', 'retentionStartedAt', 'archivedAt', 'archivedBy', 'archiveReason', 'restoredAt'];
  var fields = ooValidateStoredFields_(value, required, 'invalid-pilot');
  if (!fields.ok) return fields;
  if (!/^pilot_[A-Za-z0-9_-]{1,100}$/.test(value.pilotId || '') || !ooValidBoundedString_(value.complexName, 1, 100) ||
      !ooValidPilotSource_(value.source) || ['new', 'contacted', 'meeting', 'pilot', 'converted', 'closed'].indexOf(value.stage) < 0 ||
      !ooIsIsoDate_(value.nextActionAt) || !ooValidBoundedString_(value.owner, 1, 100) || !ooValidBoundedString_(value.notes, 0, 2000) ||
      ooParseKstDateTime_(value.createdAt) === null || ooParseKstDateTime_(value.updatedAt) === null || Date.parse(value.updatedAt) < Date.parse(value.createdAt)) return ooFail_('invalid-pilot');
  var hasStart = value.pilotStartedAt !== null;
  var hasEnd = value.pilotEndsAt !== null;
  if (hasStart !== hasEnd || (value.stage === 'pilot' && !hasStart)) return ooFail_('invalid-pilot');
  if (!hasStart) {
    if (value.extensionApprovedAt !== null) return ooFail_('invalid-pilot');
  } else {
    if (ooParseKstDateTime_(value.pilotStartedAt) === null || ooParseKstDateTime_(value.pilotEndsAt) === null) return ooFail_('invalid-pilot');
    var normalEnd = ooPilotEndsAtKst_(value.pilotStartedAt.slice(0, 10));
    if (!normalEnd) return ooFail_('invalid-pilot');
    if (value.extensionApprovedAt === null) {
      if (value.pilotEndsAt !== normalEnd) return ooFail_('invalid-pilot');
    } else if (ooParseKstDateTime_(value.extensionApprovedAt) === null || Date.parse(value.pilotEndsAt) <= Date.parse(normalEnd)) return ooFail_('invalid-pilot');
  }
  if (value.stage === 'closed') {
    if (ooParseKstDateTime_(value.retentionStartedAt) === null) return ooFail_('invalid-pilot');
  } else if (value.retentionStartedAt !== null) return ooFail_('invalid-pilot');
  var tombstoneResult = ooValidateTombstone_(value, 'invalid-pilot');
  if (!tombstoneResult.ok) return tombstoneResult;
  return { ok: true, value: value };
}

function ooValidatePilotEditable_(payload) {
  if (!ooValidBoundedString_(payload.complexName, 1, 100) || !ooValidPilotSource_(payload.source) ||
      ['new', 'contacted', 'meeting', 'pilot', 'converted', 'closed'].indexOf(payload.stage) < 0 || !ooIsIsoDate_(payload.nextActionAt) ||
      !ooValidBoundedString_(payload.owner, 1, 100) || !ooValidBoundedString_(payload.notes, 0, 2000)) return ooFail_('invalid-pilot');
  var hasStart = payload.pilotStartedAt !== null;
  if (hasStart !== (payload.pilotEndsAt !== null) || (payload.stage === 'pilot' && !hasStart)) return ooFail_('invalid-pilot');
  if (!hasStart) return payload.extensionApprovedAt === null ? { ok: true } : ooFail_('invalid-pilot');
  if (ooParseKstDateTime_(payload.pilotStartedAt) === null || ooParseKstDateTime_(payload.pilotEndsAt) === null) return ooFail_('invalid-pilot');
  var normalEnd = ooPilotEndsAtKst_(payload.pilotStartedAt.slice(0, 10));
  if (payload.extensionApprovedAt === null) return payload.pilotEndsAt === normalEnd ? { ok: true } : ooFail_('invalid-pilot');
  return ooParseKstDateTime_(payload.extensionApprovedAt) !== null && Date.parse(payload.pilotEndsAt) > Date.parse(normalEnd) ? { ok: true } : ooFail_('invalid-pilot');
}

function ooValidatePilotCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officePilotCreate);
  if (!keys.ok) return keys;
  if (!ooValidIdempotencyKey_(payload.idempotencyKey) || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-pilot');
  var editable = ooValidatePilotEditable_(payload);
  if (!editable.ok) return editable;
  return ooValidatePilot_({
    pilotId: 'pilot_normalized_for_validation', complexName: payload.complexName, source: payload.source, stage: payload.stage,
    pilotStartedAt: payload.pilotStartedAt, pilotEndsAt: payload.pilotEndsAt, extensionApprovedAt: payload.extensionApprovedAt,
    nextActionAt: payload.nextActionAt, owner: payload.owner, notes: payload.notes, createdAt: nowKst, updatedAt: nowKst,
    retentionStartedAt: payload.stage === 'closed' ? nowKst : null,
    archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
  });
}

function ooDaysInMonth_(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ooKstDate_(year, month, day) {
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function ooKstDateParts_(value) {
  if (ooParseKstDateTime_(value) === null) return null;
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) };
}

function ooNextDueAtKst_(consentedAt, intervalMonths) {
  var start = ooKstDateParts_(consentedAt);
  if (!start || [6, 12].indexOf(intervalMonths) < 0) return '';
  var targetMonth = start.month - 1 + intervalMonths;
  var year = start.year + Math.floor(targetMonth / 12);
  var month = targetMonth % 12 + 1;
  return ooKstDate_(year, month, Math.min(start.day, ooDaysInMonth_(year, month)));
}

function ooValidateConsentAuditEvent_(value) {
  var fields = ooValidateStoredFields_(value, ['event', 'at', 'actor', 'reason'], 'invalid-consent');
  if (!fields.ok) return fields;
  if (['recorded', 'withdrawn'].indexOf(value.event) < 0 || ooParseKstDateTime_(value.at) === null ||
      !ooValidBoundedString_(value.actor, 1, 100) ||
      (value.event === 'recorded' ? value.reason !== null : !ooValidBoundedString_(value.reason, 1, 500))) return ooFail_('invalid-consent');
  return { ok: true };
}

function ooValidateConsent_(value) {
  var required = ['consentId', 'subjectType', 'subjectId', 'purpose', 'intervalMonths', 'channel', 'consentVersion', 'consentTextSnapshot', 'consentTextSha256', 'recordedBy', 'consentedAt', 'withdrawnAt', 'withdrawnBy', 'withdrawalReason', 'nextDueAt', 'lastContactedAt', 'evidenceType', 'evidenceId', 'audit'];
  var fields = ooValidateStoredFields_(value, required, 'invalid-consent');
  if (!fields.ok) return fields;
  if (!/^consent_[A-Za-z0-9_-]{1,100}$/.test(value.consentId || '') || ['project', 'aptOrder'].indexOf(value.subjectType) < 0 ||
      !ooValidSubjectId_(value.subjectId) || value.purpose !== 'preventive-reinspection' || [6, 12].indexOf(value.intervalMonths) < 0 ||
      ['sms', 'phone', 'kakao'].indexOf(value.channel) < 0 || value.consentVersion !== 'reinspection-v1' ||
      (typeof value.consentTextSnapshot !== 'string' || !value.consentTextSnapshot) || !/^[0-9a-f]{64}$/.test(value.consentTextSha256 || '') ||
      ooSha256Hex_(value.consentTextSnapshot) !== value.consentTextSha256 ||
      !ooValidBoundedString_(value.recordedBy, 1, 100) || ooParseKstDateTime_(value.consentedAt) === null ||
      value.nextDueAt !== ooNextDueAtKst_(value.consentedAt, value.intervalMonths) || value.lastContactedAt !== null ||
      ['signed-document', 'message', 'recorded-call-note'].indexOf(value.evidenceType) < 0 || !/^[A-Za-z0-9_-]{1,200}$/.test(value.evidenceId || '') ||
      !Array.isArray(value.audit) || !value.audit.length) return ooFail_('invalid-consent');
  for (var index = 0; index < value.audit.length; index += 1) {
    var auditResult = ooValidateConsentAuditEvent_(value.audit[index]);
    if (!auditResult.ok) return auditResult;
  }
  var first = value.audit[0];
  var last = value.audit[value.audit.length - 1];
  if (first.event !== 'recorded' || first.actor !== value.recordedBy || first.reason !== null) return ooFail_('invalid-consent');
  var active = value.withdrawnAt === null && value.withdrawnBy === null && value.withdrawalReason === null;
  var withdrawn = ooParseKstDateTime_(value.withdrawnAt) !== null && ooValidBoundedString_(value.withdrawnBy, 1, 100) && ooValidBoundedString_(value.withdrawalReason, 1, 500);
  if ((!active && !withdrawn) || (active && value.audit.length !== 1) ||
      (withdrawn && (value.audit.length !== 2 || last.event !== 'withdrawn' || last.at !== value.withdrawnAt || last.actor !== value.withdrawnBy || last.reason !== value.withdrawalReason))) return ooFail_('invalid-consent');
  return { ok: true, value: value };
}

function ooValidateConsentCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officeConsentRecord);
  if (!keys.ok) return keys;
  if (!ooValidIdempotencyKey_(payload.idempotencyKey) || ooParseKstDateTime_(payload.consentedAt) === null ||
      ooParseKstDateTime_(nowKst) === null || [6, 12].indexOf(payload.intervalMonths) < 0) return ooFail_('invalid-consent');
  return ooValidateConsent_({
    consentId: 'consent_normalized_for_validation', subjectType: payload.subjectType, subjectId: payload.subjectId,
    purpose: payload.purpose, intervalMonths: payload.intervalMonths, channel: payload.channel,
    consentVersion: payload.consentVersion, consentTextSnapshot: payload.consentTextSnapshot,
    consentTextSha256: payload.consentTextSha256, recordedBy: payload.recordedBy, consentedAt: payload.consentedAt,
    withdrawnAt: null, withdrawnBy: null, withdrawalReason: null,
    nextDueAt: ooNextDueAtKst_(payload.consentedAt, payload.intervalMonths), lastContactedAt: null,
    evidenceType: payload.evidenceType, evidenceId: payload.evidenceId,
    audit: [{ event: 'recorded', at: nowKst, actor: payload.recordedBy, reason: null }]
  });
}

function ooWithdrawConsent_(consent, withdrawnBy, reason, nowKst) {
  var current = ooValidateConsent_(consent);
  if (!current.ok) return current;
  if (consent.withdrawnAt !== null) return ooFail_('already-withdrawn');
  if (!ooValidBoundedString_(withdrawnBy, 1, 100) || !ooValidBoundedString_(reason, 1, 500) || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-consent');
  var result = ooClone_(consent);
  result.withdrawnAt = nowKst;
  result.withdrawnBy = withdrawnBy;
  result.withdrawalReason = reason;
  result.audit.push({ event: 'withdrawn', at: nowKst, actor: withdrawnBy, reason: reason });
  var validated = ooValidateConsent_(result);
  return validated.ok ? result : validated;
}

function ooConsentActive_(consent, nowMs) {
  return Number.isFinite(nowMs) && ooValidateConsent_(consent).ok && consent.withdrawnAt === null;
}

function ooDueConsents_(consents, nowMs) {
  if (!Array.isArray(consents) || !Number.isFinite(nowMs)) return [];
  var today = Utilities.formatDate(new Date(nowMs), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX").slice(0, 10);
  return consents.filter(function(consent) {
    return ooConsentActive_(consent, nowMs) && consent.nextDueAt <= today;
  }).slice().sort(function(left, right) {
    return left.nextDueAt.localeCompare(right.nextDueAt) || left.consentId.localeCompare(right.consentId);
  });
}

function ooCanonicalCommercialTerms_(terms) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms) || !ooExactKeys_(terms, OO_TERMS_FIELDS_)) return ooFail_('invalid-terms');
  var value = {
    workKind: String(terms.workKind || ''),
    scope: String(terms.scope || '').replace(/^\s+|\s+$/g, ''),
    exclusions: Array.isArray(terms.exclusions) ? terms.exclusions.map(String) : null,
    vatMode: String(terms.vatMode || ''),
    quotedAmount: Number(terms.quotedAmount),
    validUntil: String(terms.validUntil || ''),
    scheduleWindow: String(terms.scheduleWindow || '').replace(/^\s+|\s+$/g, '')
  };
  if (['device-diagnosis', 'dispatch', 'repair', 'preventive-inspection'].indexOf(value.workKind) < 0 || !value.scope || !value.exclusions ||
      ['included', 'excluded'].indexOf(value.vatMode) < 0 || !Number.isInteger(value.quotedAmount) || value.quotedAmount < 1 ||
      !ooIsIsoDate_(value.validUntil) || !value.scheduleWindow) return ooFail_('invalid-terms');
  var json = JSON.stringify(value);
  return { ok: true, value: value, json: json, sha256Hex: ooSha256Hex_(json) };
}

function ooTermsSha256_(terms) {
  var canonical = ooCanonicalCommercialTerms_(terms);
  return canonical.ok ? canonical.sha256Hex : '';
}

function ooValidateApprovalMetadata_(value) {
  var fields = ooValidateStoredFields_(value, OO_APPROVAL_META_FIELDS_, 'invalid-commercial-approval');
  if (!fields.ok) return fields;
  if (!/^receipt_[A-Za-z0-9_-]{1,80}$/.test(value.receiptId || '') || value.subjectType !== 'aptOrder' || !ooValidSubjectId_(value.subjectId) ||
      !/^[0-9a-f]{64}$/.test(value.approvedTermsSha256 || '') || ['quote-file', 'contract-file', 'message-export-file'].indexOf(value.approvalEvidenceType) < 0 ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(value.approvalEvidenceFileId || '') || !/^[0-9a-f]{64}$/.test(value.approvalEvidenceSha256 || '') ||
      ooParseKstDateTime_(value.approvedAt) === null || ['customer', 'management-office'].indexOf(value.approvedByRole) < 0 ||
      ooParseKstDateTime_(value.issuedAt) === null || Date.parse(value.issuedAt) < Date.parse(value.approvedAt) ||
      !/^[0-9a-f]{64}$/.test(value.receiptHmac || '')) return ooFail_('invalid-commercial-approval');
  return { ok: true, value: value };
}

function ooReceiptId_(approvalMetadata) {
  return ooValidateApprovalMetadata_(approvalMetadata).ok ? approvalMetadata.receiptId : '';
}

function ooApprovalProofMatches_(approvalMetadata, payload, termsSha256) {
  return ooValidateApprovalMetadata_(approvalMetadata).ok && ooReceiptId_(approvalMetadata) === payload.receiptId &&
    approvalMetadata.subjectType === 'aptOrder' && approvalMetadata.subjectId === payload.pendingOrderId &&
    approvalMetadata.approvedTermsSha256 === termsSha256 && payload.receiptSubjectType === 'aptOrder' &&
    payload.receiptSubjectId === payload.pendingOrderId;
}

function ooValidateCommercialTermsStored_(terms) {
  var fields = ooValidateStoredFields_(terms, OO_TERMS_FIELDS_, 'invalid-terms');
  if (!fields.ok) return fields;
  var canonical = ooCanonicalCommercialTerms_(terms);
  if (!canonical.ok) return canonical;
  return JSON.stringify(terms) === canonical.json ? canonical : ooFail_('invalid-terms');
}

function ooValidateInspection_(value) {
  var required = ['inspectionId', 'officeId', 'complexName', 'templateId', 'status', 'nextDueAt', 'riskItems', 'summary', 'commercialTerms', 'commercialApproval', 'conversionId', 'conversionTermsSha256', 'conversionReceiptId', 'pendingOrderId', 'linkedOrderId', 'conversionStartedAt', 'updatedAt', 'archivedAt', 'archivedBy', 'archiveReason', 'restoredAt'];
  var fields = ooValidateStoredFields_(value, required, 'invalid-inspection');
  if (!fields.ok) return fields;
  if (!/^inspection_[A-Za-z0-9_-]{1,100}$/.test(value.inspectionId || '') || !/^office_[A-Za-z0-9_-]{1,100}$/.test(value.officeId || '') ||
      !ooValidBoundedString_(value.complexName, 1, 100) || !/^[A-Za-z0-9_-]{1,80}$/.test(value.templateId || '') ||
      !ooIsIsoDate_(value.nextDueAt) || !ooValidStringArray_(value.riskItems, 20, 200) || !ooValidBoundedString_(value.summary, 0, 2000) ||
      ooParseKstDateTime_(value.updatedAt) === null) return ooFail_('invalid-inspection');
  if (value.commercialTerms !== null) {
    var termResult = ooValidateCommercialTermsStored_(value.commercialTerms);
    if (!termResult.ok) return termResult;
  }
  var normalStatuses = ['planned', 'checked', 'proposal', 'closed'];
  var conversionStatuses = ['conversion-pending', 'conversion-writing', 'conversion-local-committed', 'converted'];
  if (normalStatuses.indexOf(value.status) >= 0) {
    if (value.commercialApproval !== null || value.conversionId !== null || value.conversionTermsSha256 !== null ||
        value.conversionReceiptId !== null || value.pendingOrderId !== null || value.linkedOrderId !== null || value.conversionStartedAt !== null) return ooFail_('invalid-inspection');
  } else if (conversionStatuses.indexOf(value.status) >= 0) {
    if (value.commercialTerms === null) return ooFail_('invalid-inspection');
    var approvalResult = ooValidateApprovalMetadata_(value.commercialApproval);
    if (!approvalResult.ok) return approvalResult;
    if (!ooValidSubjectId_(value.conversionId) || !/^[0-9a-f]{64}$/.test(value.conversionTermsSha256 || '') ||
        !/^receipt_[A-Za-z0-9_-]{1,80}$/.test(value.conversionReceiptId || '') || !ooValidSubjectId_(value.pendingOrderId) ||
        ooParseKstDateTime_(value.conversionStartedAt) === null || value.conversionTermsSha256 !== ooTermsSha256_(value.commercialTerms) ||
        value.commercialApproval.approvedTermsSha256 !== value.conversionTermsSha256 || value.commercialApproval.receiptId !== value.conversionReceiptId ||
        value.commercialApproval.subjectType !== 'aptOrder' || value.commercialApproval.subjectId !== value.pendingOrderId) return ooFail_('invalid-inspection');
    if (value.status === 'conversion-pending' || value.status === 'conversion-writing') {
      if (value.linkedOrderId !== null) return ooFail_('invalid-inspection');
    } else if (value.linkedOrderId !== value.pendingOrderId) return ooFail_('invalid-inspection');
  } else return ooFail_('invalid-inspection');
  var tombstoneResult = ooValidateTombstone_(value, 'invalid-inspection');
  if (!tombstoneResult.ok) return tombstoneResult;
  return { ok: true, value: value };
}

function ooValidateInspectionEditable_(payload) {
  if (!/^office_[A-Za-z0-9_-]{1,100}$/.test(payload.officeId || '') || !ooValidBoundedString_(payload.complexName, 1, 100) ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(payload.templateId || '') || ['planned', 'checked', 'proposal', 'closed'].indexOf(payload.status) < 0 ||
      !ooIsIsoDate_(payload.nextDueAt) || !ooValidStringArray_(payload.riskItems, 20, 200) || !ooValidBoundedString_(payload.summary, 0, 2000) ||
      payload.commercialApproval !== null) return ooFail_('invalid-inspection');
  if (payload.commercialTerms !== null) {
    var termFields = ooValidateStoredFields_(payload.commercialTerms, OO_TERMS_FIELDS_, 'invalid-terms');
    if (!termFields.ok) return termFields;
    var terms = ooCanonicalCommercialTerms_(payload.commercialTerms);
    if (!terms.ok) return terms;
  }
  return { ok: true };
}

function ooValidateInspectionCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officeInspectionCreate);
  if (!keys.ok) return keys;
  if (!ooValidIdempotencyKey_(payload.idempotencyKey) || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-inspection');
  var editable = ooValidateInspectionEditable_(payload);
  if (!editable.ok) return editable;
  return ooValidateInspection_({
    inspectionId: 'inspection_normalized_for_validation', officeId: payload.officeId, complexName: payload.complexName,
    templateId: payload.templateId, status: payload.status, nextDueAt: payload.nextDueAt, riskItems: payload.riskItems,
    summary: payload.summary, commercialTerms: payload.commercialTerms === null ? null : ooCanonicalCommercialTerms_(payload.commercialTerms).value,
    commercialApproval: null, conversionId: null, conversionTermsSha256: null, conversionReceiptId: null,
    pendingOrderId: null, linkedOrderId: null, conversionStartedAt: null, updatedAt: nowKst,
    archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
  });
}

function ooOfficialKaptUrl_(value) {
  var raw = String(value || '').replace(/^\s+|\s+$/g, '');
  var hashIndex = raw.indexOf('#');
  if (hashIndex >= 0) raw = raw.slice(0, hashIndex);
  return /^https:\/\/(?:www\.)?k-apt\.go\.kr(?:\/[^?#]*)?(?:\?[^#]*)?$/.test(raw) ? raw : '';
}

function ooValidateOpportunity_(value) {
  var required = ['opportunityId', 'complexName', 'officialUrl', 'observedAt', 'region', 'category', 'deadlineAt', 'stage', 'requirements', 'verifiedBy', 'notes', 'retentionStartedAt', 'archivedAt', 'archivedBy', 'archiveReason', 'restoredAt'];
  var fields = ooValidateStoredFields_(value, required, 'invalid-opportunity');
  if (!fields.ok) return fields;
  if (!/^opp_[A-Za-z0-9_-]{1,100}$/.test(value.opportunityId || '') || !ooValidBoundedString_(value.complexName, 1, 100) ||
      !value.officialUrl || ooOfficialKaptUrl_(value.officialUrl) !== value.officialUrl || ooParseKstDateTime_(value.observedAt) === null ||
      !ooValidBoundedString_(value.region, 1, 100) || !ooValidBoundedString_(value.category, 1, 100) ||
      ooParseKstDateTime_(value.deadlineAt) === null || ['watch', 'review', 'participate', 'skip', 'closed'].indexOf(value.stage) < 0 ||
      !ooValidStringArray_(value.requirements, 20, 200) || !ooValidBoundedString_(value.verifiedBy, 1, 100) ||
      !ooValidBoundedString_(value.notes, 0, 2000)) return ooFail_('invalid-opportunity');
  if (value.stage === 'skip' || value.stage === 'closed') {
    if (ooParseKstDateTime_(value.retentionStartedAt) === null) return ooFail_('invalid-opportunity');
  } else if (value.retentionStartedAt !== null) return ooFail_('invalid-opportunity');
  var tombstoneResult = ooValidateTombstone_(value, 'invalid-opportunity');
  if (!tombstoneResult.ok) return tombstoneResult;
  return { ok: true, value: value };
}

function ooValidateOpportunityEditable_(payload) {
  var officialUrl = ooOfficialKaptUrl_(payload.officialUrl);
  if (!ooValidBoundedString_(payload.complexName, 1, 100) || !officialUrl || ooParseKstDateTime_(payload.observedAt) === null ||
      !ooValidBoundedString_(payload.region, 1, 100) || !ooValidBoundedString_(payload.category, 1, 100) ||
      ooParseKstDateTime_(payload.deadlineAt) === null || ['watch', 'review', 'participate', 'skip', 'closed'].indexOf(payload.stage) < 0 ||
      !ooValidStringArray_(payload.requirements, 20, 200) || !ooValidBoundedString_(payload.verifiedBy, 1, 100) ||
      !ooValidBoundedString_(payload.notes, 0, 2000)) return ooFail_('invalid-opportunity');
  return { ok: true, officialUrl: officialUrl };
}

function ooValidateOpportunityCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officeOpportunityCreate);
  if (!keys.ok) return keys;
  if (!ooValidIdempotencyKey_(payload.idempotencyKey) || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-opportunity');
  var editable = ooValidateOpportunityEditable_(payload);
  if (!editable.ok) return editable;
  return ooValidateOpportunity_({
    opportunityId: 'opp_normalized_for_validation', complexName: payload.complexName, officialUrl: editable.officialUrl,
    observedAt: payload.observedAt, region: payload.region, category: payload.category, deadlineAt: payload.deadlineAt,
    stage: payload.stage, requirements: payload.requirements, verifiedBy: payload.verifiedBy, notes: payload.notes,
    retentionStartedAt: ['skip', 'closed'].indexOf(payload.stage) >= 0 ? nowKst : null,
    archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
  });
}

function ooCanOpportunityParticipate_(opportunity, serverNowMs, requestTimestampMs) {
  if (!ooValidateOpportunity_(opportunity).ok || !Number.isFinite(serverNowMs) || !Number.isFinite(requestTimestampMs) ||
      Math.abs(serverNowMs - requestTimestampMs) > 5 * 60 * 1000) return false;
  var observedAtMs = Date.parse(opportunity.observedAt);
  var deadlineAtMs = Date.parse(opportunity.deadlineAt);
  return opportunity.officialUrl === ooOfficialKaptUrl_(opportunity.officialUrl) &&
    (opportunity.verifiedBy === '대표' || opportunity.verifiedBy === 'representative') &&
    opportunity.requirements.length > 0 && observedAtMs <= serverNowMs && observedAtMs <= requestTimestampMs &&
    deadlineAtMs > serverNowMs && deadlineAtMs > requestTimestampMs;
}

function ooVisible_(record) {
  return !!record && record.archivedAt === null;
}

function ooConversionProofMatches_(inspection, payload) {
  return !!inspection && !!payload && payload.conversionId === inspection.conversionId &&
    payload.pendingOrderId === inspection.pendingOrderId && payload.receiptId === inspection.conversionReceiptId &&
    payload.receiptSubjectType === 'aptOrder' && payload.receiptSubjectId === inspection.pendingOrderId &&
    payload.termsSha256 === inspection.conversionTermsSha256;
}

function ooConversionProofError_(inspection, payload) {
  if (!inspection || !payload || payload.conversionId !== inspection.conversionId ||
      payload.pendingOrderId !== inspection.pendingOrderId) return ooFail_('invalid-conversion-state');
  if (payload.receiptId !== inspection.conversionReceiptId || payload.receiptSubjectType !== 'aptOrder' ||
      payload.receiptSubjectId !== inspection.pendingOrderId) return ooFail_('receipt-mismatch');
  if (payload.termsSha256 !== inspection.conversionTermsSha256) return ooFail_('terms-mismatch');
  return { ok: true };
}

function ooReplaceRecord_(target, source) {
  Object.keys(source).forEach(function(key) { target[key] = source[key]; });
  return target;
}

function ooConversionTransition_(inspection, command, payload, nowKst) {
  if (!inspection || typeof inspection !== 'object' || !payload || typeof payload !== 'object' ||
      ooParseKstDateTime_(nowKst) === null || inspection.archivedAt !== null) return ooFail_('invalid-conversion-state');
  var candidate = ooClone_(inspection);
  if (command === 'begin') {
    if (candidate.status !== 'proposal') return ooFail_('invalid-conversion-state');
    var terms = ooCanonicalCommercialTerms_(payload.commercialTerms);
    if (!terms.ok || payload.termsSha256 !== terms.sha256Hex) return ooFail_('terms-mismatch');
    var approval = ooValidateApprovalMetadata_(payload.commercialApproval);
    if (!approval.ok) return approval;
    if (!ooApprovalProofMatches_(payload.commercialApproval, payload, terms.sha256Hex)) return ooFail_('receipt-mismatch');
    if (payload.conversionId === payload.pendingOrderId || payload.conversionId === payload.receiptId ||
        payload.pendingOrderId === payload.receiptId) return ooFail_('conversion-identity-conflict');
    candidate.commercialTerms = terms.value;
    candidate.commercialApproval = ooCanonicalNested_(OO_APPROVAL_META_FIELDS_, payload.commercialApproval);
    candidate.status = 'conversion-pending';
    candidate.conversionId = payload.conversionId;
    candidate.conversionTermsSha256 = payload.termsSha256;
    candidate.conversionReceiptId = payload.receiptId;
    candidate.pendingOrderId = payload.pendingOrderId;
    candidate.linkedOrderId = null;
    candidate.conversionStartedAt = nowKst;
  } else if (command === 'cancel') {
    if (candidate.status !== 'conversion-pending' || payload.conversionId !== candidate.conversionId) return ooFail_('invalid-conversion-state');
    candidate.status = 'proposal';
    candidate.commercialApproval = null;
    candidate.conversionId = null;
    candidate.conversionTermsSha256 = null;
    candidate.conversionReceiptId = null;
    candidate.pendingOrderId = null;
    candidate.linkedOrderId = null;
    candidate.conversionStartedAt = null;
  } else {
    var expectedStatus = { arm:'conversion-pending', record:'conversion-writing', finalize:'conversion-local-committed' }[command];
    if (!expectedStatus || candidate.status !== expectedStatus) return ooFail_('invalid-conversion-state');
    var proof = ooConversionProofError_(candidate, payload);
    if (!proof.ok) return proof;
    if (command === 'arm') {
      if (candidate.linkedOrderId !== null) return ooFail_('invalid-conversion-state');
      candidate.status = 'conversion-writing';
    } else if (command === 'record') {
      if (payload.linkedOrderId !== candidate.pendingOrderId || candidate.linkedOrderId !== null) return ooFail_('invalid-conversion-state');
      candidate.linkedOrderId = payload.linkedOrderId;
      candidate.status = 'conversion-local-committed';
    } else {
      if (payload.linkedOrderId !== candidate.linkedOrderId || candidate.linkedOrderId !== candidate.pendingOrderId) return ooFail_('invalid-conversion-state');
      candidate.status = 'converted';
    }
  }
  candidate.updatedAt = nowKst;
  var validated = ooValidateInspection_(candidate);
  if (!validated.ok) return validated;
  ooReplaceRecord_(inspection, candidate);
  return { ok: true };
}

function ooValidateArchivePayload_(payload, idField, idPattern) {
  if (!idPattern.test(payload[idField] || '') || !ooValidRevision_(payload.expectedRevision) || !ooValidBoundedString_(payload.archiveReason, 1, 500)) return ooFail_('invalid-input');
  return { ok: true, value: payload };
}

function ooValidateRestorePayload_(payload, idField, idPattern) {
  if (!idPattern.test(payload[idField] || '') || !ooValidRevision_(payload.expectedRevision)) return ooFail_('invalid-input');
  return { ok: true, value: payload };
}

function ooValidateConversionPayload_(action, payload) {
  if (!/^inspection_[A-Za-z0-9_-]{1,100}$/.test(payload.inspectionId || '') || !ooValidSubjectId_(payload.conversionId) || !ooValidRevision_(payload.expectedRevision)) return ooFail_('invalid-input');
  if (action === 'officeInspectionCancelConversion') return { ok: true, value: payload };
  if (!ooValidSubjectId_(payload.pendingOrderId) || !/^receipt_[A-Za-z0-9_-]{1,80}$/.test(payload.receiptId || '') ||
      typeof payload.receiptSubjectType !== 'string' || !ooValidSubjectId_(payload.receiptSubjectId) ||
      !/^[0-9a-f]{64}$/.test(payload.termsSha256 || '')) return ooFail_('invalid-input');
  if (action === 'officeInspectionRecordLocalCommit' || action === 'officeInspectionFinalizeConversion') {
    if (!ooValidSubjectId_(payload.linkedOrderId)) return ooFail_('invalid-input');
  }
  if (action === 'officeInspectionBeginConversion') {
    var termsFields = ooValidateStoredFields_(payload.commercialTerms, OO_TERMS_FIELDS_, 'invalid-terms');
    if (!termsFields.ok) return termsFields;
    var terms = ooCanonicalCommercialTerms_(payload.commercialTerms);
    if (!terms.ok) return terms;
    var approval = ooValidateApprovalMetadata_(payload.commercialApproval);
    if (!approval.ok) return approval;
    if (payload.termsSha256 !== terms.sha256Hex) return ooFail_('terms-mismatch');
    if (!ooApprovalProofMatches_(payload.commercialApproval, payload, terms.sha256Hex)) return ooFail_('receipt-mismatch');
  }
  return { ok: true, value: payload };
}

function ooValidateActionPayload_(action, payload) {
  if (action === 'officePilotCreate' || action === 'officePilotUpdate') {
    if (action === 'officePilotCreate' && !ooValidIdempotencyKey_(payload.idempotencyKey)) return ooFail_('invalid-input');
    if (action === 'officePilotUpdate' && (!/^pilot_[A-Za-z0-9_-]{1,100}$/.test(payload.pilotId || '') || !ooValidRevision_(payload.expectedRevision))) return ooFail_('invalid-input');
    var pilotEditable = ooValidatePilotEditable_(payload);
    return pilotEditable.ok ? { ok: true, value: payload } : pilotEditable;
  }
  if (action === 'officePilotArchive') return ooValidateArchivePayload_(payload, 'pilotId', /^pilot_[A-Za-z0-9_-]{1,100}$/);
  if (action === 'officePilotRestore') return ooValidateRestorePayload_(payload, 'pilotId', /^pilot_[A-Za-z0-9_-]{1,100}$/);
  if (action === 'officeConsentRecord') {
    var consent = ooValidateConsentCreate_(payload, payload.consentedAt);
    return consent.ok ? { ok: true, value: payload } : consent;
  }
  if (action === 'officeConsentWithdraw') {
    if (!/^consent_[A-Za-z0-9_-]{1,100}$/.test(payload.consentId || '') || !ooValidRevision_(payload.expectedRevision) ||
        !ooValidBoundedString_(payload.withdrawnBy, 1, 100) || !ooValidBoundedString_(payload.withdrawalReason, 1, 500)) return ooFail_('invalid-input');
    return { ok: true, value: payload };
  }
  if (action === 'officeInspectionCreate' || action === 'officeInspectionUpdate') {
    if (action === 'officeInspectionCreate' && !ooValidIdempotencyKey_(payload.idempotencyKey)) return ooFail_('invalid-input');
    if (action === 'officeInspectionUpdate' && (!/^inspection_[A-Za-z0-9_-]{1,100}$/.test(payload.inspectionId || '') || !ooValidRevision_(payload.expectedRevision))) return ooFail_('invalid-input');
    var inspection = ooValidateInspectionEditable_(payload);
    return inspection.ok ? { ok: true, value: payload } : inspection;
  }
  if (action === 'officeInspectionArchive') return ooValidateArchivePayload_(payload, 'inspectionId', /^inspection_[A-Za-z0-9_-]{1,100}$/);
  if (action === 'officeInspectionRestore') return ooValidateRestorePayload_(payload, 'inspectionId', /^inspection_[A-Za-z0-9_-]{1,100}$/);
  if (action.indexOf('officeInspection') === 0) return ooValidateConversionPayload_(action, payload);
  if (action === 'officeOpportunityCreate' || action === 'officeOpportunityUpdate') {
    if (action === 'officeOpportunityCreate' && !ooValidIdempotencyKey_(payload.idempotencyKey)) return ooFail_('invalid-input');
    if (action === 'officeOpportunityUpdate' && (!/^opp_[A-Za-z0-9_-]{1,100}$/.test(payload.opportunityId || '') || !ooValidRevision_(payload.expectedRevision))) return ooFail_('invalid-input');
    var opportunity = ooValidateOpportunityEditable_(payload);
    if (!opportunity.ok) return opportunity;
    var normalized = ooClone_(payload);
    normalized.officialUrl = opportunity.officialUrl;
    return { ok: true, value: normalized };
  }
  if (action === 'officeOpportunityArchive') return ooValidateArchivePayload_(payload, 'opportunityId', /^opp_[A-Za-z0-9_-]{1,100}$/);
  if (action === 'officeOpportunityRestore') return ooValidateRestorePayload_(payload, 'opportunityId', /^opp_[A-Za-z0-9_-]{1,100}$/);
  return ooFail_('bad-request');
}

function ooCanonicalMutation_(action, payload) {
  var fields = OO_CANONICAL_FIELDS_[action];
  if (!fields) return ooFail_('bad-request');
  var keys = ooValidatePayloadFields_(payload, fields);
  if (!keys.ok) return keys;
  var validated = ooValidateActionPayload_(action, payload);
  if (!validated.ok) return validated;
  var body = {};
  fields.forEach(function(key) { body[key] = validated.value[key]; });
  if (body.commercialTerms) {
    var terms = ooCanonicalCommercialTerms_(body.commercialTerms);
    if (!terms.ok) return terms;
    body.commercialTerms = terms.value;
  }
  if (body.commercialApproval) body.commercialApproval = ooCanonicalNested_(OO_APPROVAL_META_FIELDS_, body.commercialApproval);
  var json = JSON.stringify({ action: action, payload: body });
  return { ok: true, json: json, sha256Hex: ooSha256Hex_(json) };
}

function ooValidateAuditLifecycle_(value) {
  var fields = ooValidateStoredFields_(value, OO_TOMBSTONE_FIELDS_, 'invalid-audit');
  if (!fields.ok) return fields;
  if (value.archivedAt === null) {
    if (value.archivedBy !== null || value.archiveReason !== null || (value.restoredAt !== null && ooParseKstDateTime_(value.restoredAt) === null)) return ooFail_('invalid-audit');
  } else if (ooParseKstDateTime_(value.archivedAt) === null || value.archivedBy !== 'representative' || !ooValidBoundedString_(value.archiveReason, 1, 500) || value.restoredAt !== null) return ooFail_('invalid-audit');
  return { ok: true };
}

function ooValidAuditIdForAction_(action, id) {
  if (action.indexOf('officePilot') === 0) return /^pilot_[A-Za-z0-9_-]{1,100}$/.test(id || '');
  if (action.indexOf('officeConsent') === 0) return /^consent_[A-Za-z0-9_-]{1,100}$/.test(id || '');
  if (action.indexOf('officeInspection') === 0) return /^inspection_[A-Za-z0-9_-]{1,100}$/.test(id || '');
  if (action.indexOf('officeOpportunity') === 0) return /^opp_[A-Za-z0-9_-]{1,100}$/.test(id || '');
  return false;
}

function ooValidateAuditRow_(value) {
  var fields = ooValidateStoredFields_(value, OO_AUDIT_FIELDS_, 'invalid-audit');
  if (!fields.ok) return fields;
  if (!Object.prototype.hasOwnProperty.call(OO_CANONICAL_FIELDS_, value.action) || value.result !== 'ok' ||
      !ooValidAuditIdForAction_(value.action, value.id) || !ooValidRequestId_(value.mutationId) ||
      !/^[0-9a-f]{64}$/.test(value.payloadSha256 || '') || ooParseKstDateTime_(value.at) === null ||
      value.actor !== 'representative' || (typeof value.backupFileId !== 'string' || !value.backupFileId) ||
      (typeof value.backupManifestFileId !== 'string' || !value.backupManifestFileId) || !/^[0-9a-f]{64}$/.test(value.backupSha256 || '') ||
      !ooValidRevision_(value.preMutationRevision)) return ooFail_('invalid-audit');
  var create = OO_CREATE_ACTIONS_.indexOf(value.action) >= 0;
  if ((create && !ooValidIdempotencyKey_(value.idempotencyKey)) || (!create && value.idempotencyKey !== null)) return ooFail_('invalid-audit');
  var lifecycleAction = /(?:Archive|Restore)$/.test(value.action);
  if (lifecycleAction) {
    var lifecycle = ooValidateAuditLifecycle_(value.lifecycleBefore);
    if (!lifecycle.ok) return lifecycle;
  } else if (value.lifecycleBefore !== null) return ooFail_('invalid-audit');
  return { ok: true, value: value };
}

function ooValidateConversionIdentityIndex_(inspections) {
  if (!Array.isArray(inspections)) return ooFail_('invalid-store');
  var owners = {};
  var fields = ['conversionId', 'pendingOrderId', 'linkedOrderId', 'conversionReceiptId'];
  for (var rowIndex = 0; rowIndex < inspections.length; rowIndex += 1) {
    var row = inspections[rowIndex];
    var local = {};
    for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      var field = fields[fieldIndex];
      var value = row[field];
      if (value === null) continue;
      if (local[value]) {
        var pendingLinkedPair = (field === 'linkedOrderId' && local[value] === 'pendingOrderId') ||
          (field === 'pendingOrderId' && local[value] === 'linkedOrderId');
        if (!pendingLinkedPair) return ooFail_('invalid-store');
      } else local[value] = field;
      if (owners[value] && owners[value] !== row.inspectionId) return ooFail_('invalid-store');
      owners[value] = row.inspectionId;
    }
  }
  return { ok: true };
}

function ooValidateStore_(store) {
  var required = ['schemaVersion', 'revision', 'updatedAt', 'pilots', 'consents', 'inspections', 'opportunities', 'audit'];
  var fields = ooValidateStoredFields_(store, required, 'invalid-store');
  if (!fields.ok) return fields;
  if (store.schemaVersion !== 1 || !ooValidRevision_(store.revision) || ooParseKstDateTime_(store.updatedAt) === null ||
      !Array.isArray(store.pilots) || !Array.isArray(store.consents) || !Array.isArray(store.inspections) ||
      !Array.isArray(store.opportunities) || !Array.isArray(store.audit)) return ooFail_('invalid-store');
  var seenIds = {};
  var collections = [
    { rows: store.pilots, id: 'pilotId', validate: ooValidatePilot_ },
    { rows: store.consents, id: 'consentId', validate: ooValidateConsent_ },
    { rows: store.inspections, id: 'inspectionId', validate: ooValidateInspection_ },
    { rows: store.opportunities, id: 'opportunityId', validate: ooValidateOpportunity_ }
  ];
  for (var collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    var collection = collections[collectionIndex];
    for (var rowIndex = 0; rowIndex < collection.rows.length; rowIndex += 1) {
      var result = collection.validate(collection.rows[rowIndex]);
      if (!result.ok) return result;
      var id = collection.rows[rowIndex][collection.id];
      if (seenIds[id]) return ooFail_('invalid-store');
      seenIds[id] = true;
    }
  }
  for (var auditIndex = 0; auditIndex < store.audit.length; auditIndex += 1) {
    var auditResult = ooValidateAuditRow_(store.audit[auditIndex]);
    if (!auditResult.ok) return auditResult;
  }
  var conversionIdentities = ooValidateConversionIdentityIndex_(store.inspections);
  if (!conversionIdentities.ok) return conversionIdentities;
  return { ok: true, value: store };
}

function ooNewRecordId_(kind) {
  var prefix = { pilot: 'pilot_', consent: 'consent_', inspection: 'inspection_', opportunity: 'opp_' }[kind];
  return prefix ? prefix + Utilities.getUuid() : '';
}

function ooArchive_(record, actor, reason, nowKst) {
  if (record.archivedAt) return ooFail_('already-archived');
  if (actor !== 'representative' || !ooValidBoundedString_(reason, 1, 500) || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-input');
  record.archivedAt = nowKst;
  record.archivedBy = actor;
  record.archiveReason = reason;
  record.restoredAt = null;
  return record;
}

function ooRestore_(record, actor, nowKst) {
  if (!record.archivedAt) return ooFail_('not-archived');
  if (actor !== 'representative' || ooParseKstDateTime_(nowKst) === null) return ooFail_('invalid-input');
  record.archivedAt = null;
  record.archivedBy = null;
  record.archiveReason = null;
  record.restoredAt = nowKst;
  return record;
}

function ooRetentionStartedAtFor_(recordType, currentValue, nextState, nowKst) {
  var terminal = recordType === 'pilot' ? nextState === 'closed' : recordType === 'opportunity' ? ['skip', 'closed'].indexOf(nextState) >= 0 : false;
  return terminal ? (currentValue || nowKst) : null;
}

function ooAddOneKstYear_(referenceAt) {
  var parts = ooKstDateParts_(referenceAt);
  if (!parts) return '';
  var targetYear = parts.year + 1;
  var targetDay = Math.min(parts.day, ooDaysInMonth_(targetYear, parts.month));
  return ooKstDate_(targetYear, parts.month, targetDay) + referenceAt.slice(10);
}

function ooRetentionRows_(store, nowMs) {
  if (!Number.isFinite(nowMs)) return [];
  var rows = [];
  function add(recordType, recordId, reason, referenceAt) {
    if (!referenceAt) return;
    var eligibleAt = ooAddOneKstYear_(referenceAt);
    if (eligibleAt && Date.parse(eligibleAt) <= nowMs) rows.push({ recordType: recordType, recordId: recordId, reason: reason, referenceAt: referenceAt, eligibleAt: eligibleAt });
  }
  (store.pilots || []).forEach(function(pilot) {
    if (pilot.archivedAt) add('pilot', pilot.pilotId, 'archived', pilot.archivedAt);
    else if (pilot.stage === 'closed') add('pilot', pilot.pilotId, 'closed', pilot.retentionStartedAt);
  });
  (store.consents || []).forEach(function(consent) {
    if (consent.withdrawnAt) add('consent', consent.consentId, 'withdrawn', consent.withdrawnAt);
  });
  (store.inspections || []).forEach(function(inspection) {
    if (inspection.archivedAt) add('inspection', inspection.inspectionId, 'archived', inspection.archivedAt);
  });
  (store.opportunities || []).forEach(function(opportunity) {
    if (opportunity.archivedAt) add('opportunity', opportunity.opportunityId, 'archived', opportunity.archivedAt);
    else if (opportunity.stage === 'skip' || opportunity.stage === 'closed') add('opportunity', opportunity.opportunityId, opportunity.stage, opportunity.retentionStartedAt);
  });
  return rows.sort(function(left, right) {
    return left.eligibleAt.localeCompare(right.eligibleAt) || left.recordType.localeCompare(right.recordType) || left.recordId.localeCompare(right.recordId);
  });
}

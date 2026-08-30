var OO_SOURCE_NAME_ = '관리사무소영업운영.json';
var OO_JSON_MIME_ = 'application/json';
var OO_MANIFEST_FIELDS_ = [
  'sourceFileId', 'backupFileId', 'createdAt', 'schemaVersion',
  'preMutationRevision', 'byteLength', 'sha256Hex'
];

if (typeof ooNowMs_ !== 'function') {
  var ooNowMs_ = function() { return Date.now(); };
}

function ooConversionOperationallyEnabled_(){return false;}

function ooIsConversionAction_(action) {
  return [
    'officeInspectionBeginConversion',
    'officeInspectionArmLocalCommit',
    'officeInspectionRecordLocalCommit',
    'officeInspectionFinalizeConversion',
    'officeInspectionCancelConversion'
  ].indexOf(action) >= 0;
}

function ooDispatch_(request) {
  var requestNowMs = ooNowMs_();
  var isRead = !!request && (request.action === 'officeOpsList' || request.action === 'officeOpsRetentionList');
  var envelope = ooValidateRequestEnvelope_(request, isRead, requestNowMs);
  if (!envelope.ok) return envelope;
  return isRead ? ooDispatchRead_(request, requestNowMs) : ooMutate_(request, requestNowMs);
}

function ooDispatchRead_(request, requestNowMs) {
  var source = ooSourceFile_();
  if (!source.ok) return source;
  var loaded = ooReadStore_(source);
  if (!loaded.ok) return loaded;
  if (request.action === 'officeOpsRetentionList') {
    return { ok: true, rows: ooRetentionRows_(loaded.store, requestNowMs), serverNowKst: ooFormatKst_(requestNowMs) };
  }
  var store = ooClone_(loaded.store);
  if (!request.payload.includeArchived) {
    store.pilots = store.pilots.filter(function(row) { return row.archivedAt === null; });
    store.inspections = store.inspections.filter(function(row) { return row.archivedAt === null; });
    store.opportunities = store.opportunities.filter(function(row) { return row.archivedAt === null; });
  }
  return { ok: true, store: store };
}

function ooMutate_(request, requestNowMs) {
  var lock = null;
  var acquired = false;
  var result;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) result = ooFail_('lock-unavailable');
    else {
      acquired = true;
      result = ooMutateLocked_(request, requestNowMs);
    }
  } catch (_) {
    result = ooFail_('server-error');
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
  return result;
}

function ooMutateLocked_(request, requestNowMs) {
  var gates = ooRecheckLockedGates_(request.token);
  if (!gates.ok) return gates;
  if (ooIsConversionAction_(request.action) && !ooConversionOperationallyEnabled_()) return ooFail_('conversion-disabled');

  var source = ooSourceFile_();
  if (!source.ok) return source;
  var loaded = ooReadStore_(source);
  if (!loaded.ok) return loaded;

  if (ooFindMutation_(loaded.store, request.mutationId)) return ooFail_('replay-request');
  var canonical = ooCanonicalMutation_(request.action, request.payload);
  if (!canonical.ok) return canonical;

  var idempotent = ooFindIdempotentCreate_(loaded.store, request.action, request.payload.idempotencyKey, canonical.sha256Hex);
  if (idempotent) return idempotent;
  var domainReplay = ooFindSafeConversionReplay_(loaded.store, request, canonical);
  if (domainReplay) return domainReplay;

  var revision = ooValidateExpectedRevisionInsideLock_(request, loaded.store.revision);
  if (!revision.ok) return revision;
  var identity = ooValidateConversionIdentityOwnership_(loaded.store, request, canonical);
  if (!identity.ok) return identity;

  var mutationNowMs = ooNowMs_();
  var mutationNowKst = ooFormatKst_(mutationNowMs);
  var prepared = ooPrepareMutation_(loaded.store, request, 'representative', canonical, mutationNowKst);
  if (!prepared.ok) return prepared;
  var backup = ooBackupPair_(source, loaded, mutationNowMs);
  if (!backup.ok) return backup;
  var candidate = ooEnrichedCandidate_(loaded, prepared, backup, mutationNowKst);
  if (!candidate.ok) return candidate;
  prepared.enrichedCandidate = candidate;
  var unchanged = ooRecheckLoadedSource_(source, loaded);
  if (!unchanged.ok) return unchanged;
  var armed = ooArmRecoveryLatch_();
  if (!armed.ok) return armed;
  return ooWritePrepared_(source, loaded, prepared, backup, mutationNowKst);
}

function ooConstantTimeEqual_(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  var difference = left.length ^ right.length;
  var maximum = Math.max(left.length, right.length);
  for (var index = 0; index < maximum; index += 1) {
    difference |= (left.charCodeAt(index % (left.length || 1)) || 0) ^ (right.charCodeAt(index % (right.length || 1)) || 0);
  }
  return difference === 0;
}

function ooRecheckLockedGates_(token) {
  var expectedToken;
  try { expectedToken = ooGetScriptProperty_('OFFICE_OPS_TOKEN'); }
  catch (_) { return ooFail_('server-error'); }
  if (!expectedToken || !ooConstantTimeEqual_(token, expectedToken)) return ooFail_('unauthorized');

  var recoveryRequired;
  try { recoveryRequired = ooGetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED'); }
  catch (_) { return ooFail_('server-error'); }
  if (recoveryRequired !== '0') return ooFail_('manual-recovery-required');

  var enabled;
  try { enabled = ooGetScriptProperty_('OFFICE_OPS_ENABLED'); }
  catch (_) { return ooFail_('server-error'); }
  return enabled === '1' ? { ok: true } : ooFail_('office-disabled');
}

function ooFormatKst_(milliseconds) {
  return Utilities.formatDate(new Date(milliseconds), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function ooBackupStamp_(milliseconds) {
  return Utilities.formatDate(new Date(milliseconds), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
}

function ooNormalizeBytes_(bytes) {
  return Array.prototype.slice.call(bytes || []).map(function(value) { return (Number(value) + 256) % 256; });
}

function ooBytesEqual_(left, right) {
  var a = ooNormalizeBytes_(left);
  var b = ooNormalizeBytes_(right);
  if (a.length !== b.length) return false;
  for (var index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

function ooSha256BytesHex_(bytes) {
  return ooBytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ooNormalizeBytes_(bytes)));
}

function ooUtf8Bytes_(text) {
  return Utilities.newBlob(String(text)).getBytes();
}

function ooStrictUtf8_(bytes) {
  var normalized = ooNormalizeBytes_(bytes);
  if (normalized.length >= 3 && normalized[0] === 239 && normalized[1] === 187 && normalized[2] === 191) return null;
  var text;
  try { text = Utilities.newBlob(bytes).getDataAsString('UTF-8'); }
  catch (_) { return null; }
  return ooBytesEqual_(ooUtf8Bytes_(text), bytes) ? text : null;
}

function ooExactParent_(file) {
  try {
    var parents = file.getParents();
    if (!parents.hasNext()) return null;
    var parent = parents.next();
    if (parents.hasNext()) return null;
    var parentId = parent.getId();
    return typeof parentId === 'string' && parentId ? { value: parent, id: parentId } : null;
  } catch (_) {
    return null;
  }
}

function ooSourceFile_() {
  var configuredId;
  try { configuredId = ooGetScriptProperty_('OFFICE_OPS_FILE_ID'); }
  catch (_) { return ooFail_('server-error'); }
  if (typeof configuredId !== 'string' || !configuredId) return ooFail_('invalid-store');
  var file;
  try { file = DriveApp.getFileById(configuredId); }
  catch (_) { return ooFail_('server-error'); }
  try {
    var sourceId = file.getId();
    var parent = ooExactParent_(file);
    if (sourceId !== configuredId || file.isTrashed() || file.getName() !== OO_SOURCE_NAME_ ||
        file.getMimeType() !== OO_JSON_MIME_ || !parent) return ooFail_('invalid-store');
    return { ok: true, file: file, sourceId: sourceId, parent: parent.value, parentId: parent.id };
  } catch (_) {
    return ooFail_('server-error');
  }
}

function ooRawJson_(file) {
  var bytes;
  try { bytes = file.getBlob().getBytes(); }
  catch (_) { return { ok: false, error: 'read-failed' }; }
  var text = ooStrictUtf8_(bytes);
  if (text === null) return { ok: false, error: 'invalid-json' };
  var value;
  try { value = JSON.parse(text); }
  catch (_) { return { ok: false, error: 'invalid-json' }; }
  return {
    ok: true,
    bytes: bytes,
    text: text,
    byteLength: ooNormalizeBytes_(bytes).length,
    sha256Hex: ooSha256BytesHex_(bytes),
    value: value
  };
}

function ooReadStore_(source) {
  if (!source || !source.ok) return source || ooFail_('invalid-store');
  try {
    if (source.file.getId() !== source.sourceId || source.file.isTrashed() ||
        source.file.getName() !== OO_SOURCE_NAME_ || source.file.getMimeType() !== OO_JSON_MIME_) return ooFail_('invalid-store');
    var parent = ooExactParent_(source.file);
    if (!parent || parent.id !== source.parentId) return ooFail_('invalid-store');
  } catch (_) {
    return ooFail_('server-error');
  }
  var raw = ooRawJson_(source.file);
  if (!raw.ok) return ooFail_('invalid-store');
  var store = ooValidateStore_(raw.value);
  if (!store.ok) return ooFail_('invalid-store');
  var audit = ooValidateAuditHistory_(raw.value);
  if (!audit.ok) return audit;
  return {
    ok: true,
    sourceId: source.sourceId,
    parentId: source.parentId,
    bytes: raw.bytes,
    byteLength: raw.byteLength,
    sha256Hex: raw.sha256Hex,
    store: raw.value
  };
}

function ooValidateAuditHistory_(store) {
  if (!store || !Array.isArray(store.audit) || store.audit.length !== store.revision) return ooFail_('invalid-store');
  var mutationIds = {};
  var createKeys = {};
  var artifactIds = {};
  for (var index = 0; index < store.audit.length; index += 1) {
    var row = store.audit[index];
    if (!ooValidateAuditRow_(row).ok || row.preMutationRevision !== index || mutationIds[row.mutationId]) return ooFail_('invalid-store');
    mutationIds[row.mutationId] = true;
    if (row.backupFileId === row.backupManifestFileId || artifactIds[row.backupFileId] || artifactIds[row.backupManifestFileId]) return ooFail_('invalid-store');
    artifactIds[row.backupFileId] = true;
    artifactIds[row.backupManifestFileId] = true;
    if (OO_CREATE_ACTIONS_.indexOf(row.action) >= 0) {
      var createKey = row.action + '\u0000' + row.idempotencyKey;
      if (createKeys[createKey]) return ooFail_('invalid-store');
      createKeys[createKey] = true;
    } else if (row.idempotencyKey !== null) return ooFail_('invalid-store');
  }
  if (store.audit.length && store.audit[store.audit.length - 1].at !== store.updatedAt) return ooFail_('invalid-store');
  return { ok: true };
}

function ooFindMutation_(store, mutationId) {
  for (var index = 0; index < store.audit.length; index += 1) {
    if (store.audit[index].mutationId === mutationId) return store.audit[index];
  }
  return null;
}

function ooRecordExistsForAudit_(store, row) {
  var rows;
  var key;
  if (row.action.indexOf('officePilot') === 0) { rows = store.pilots; key = 'pilotId'; }
  else if (row.action.indexOf('officeConsent') === 0) { rows = store.consents; key = 'consentId'; }
  else if (row.action.indexOf('officeInspection') === 0) { rows = store.inspections; key = 'inspectionId'; }
  else if (row.action.indexOf('officeOpportunity') === 0) { rows = store.opportunities; key = 'opportunityId'; }
  else return false;
  var count = 0;
  for (var index = 0; index < rows.length; index += 1) if (rows[index][key] === row.id) count += 1;
  return count === 1;
}

function ooAckFromAudit_(store, row) {
  if (!row || !ooRecordExistsForAudit_(store, row) || row.preMutationRevision + 1 > store.revision) return ooFail_('invalid-store');
  return { ok: true, id: row.id, revision: row.preMutationRevision + 1, updatedAt: row.at };
}

function ooFindIdempotentCreate_(store, action, idempotencyKey, payloadSha256) {
  if (OO_CREATE_ACTIONS_.indexOf(action) < 0 || !ooValidIdempotencyKey_(idempotencyKey)) return null;
  var match = null;
  for (var index = 0; index < store.audit.length; index += 1) {
    var row = store.audit[index];
    if (row.action === action && row.idempotencyKey === idempotencyKey) {
      if (match) return ooFail_('invalid-store');
      match = row;
    }
  }
  if (!match) return null;
  if (match.payloadSha256 !== payloadSha256) return ooFail_('idempotency-conflict');
  return ooAckFromAudit_(store, match);
}

function ooSameJson_(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ooFindSafeConversionReplay_(store, request, canonical) {
  var stages = {
    officeInspectionBeginConversion: 'conversion-pending',
    officeInspectionArmLocalCommit: 'conversion-writing',
    officeInspectionRecordLocalCommit: 'conversion-local-committed',
    officeInspectionFinalizeConversion: 'converted'
  };
  var stage = stages[request.action];
  if (!stage) return null;
  var body;
  try { body = JSON.parse(canonical.json).payload; }
  catch (_) { return ooFail_('invalid-store'); }
  var matches = store.audit.filter(function(row) {
    return row.action === request.action && row.id === body.inspectionId && row.payloadSha256 === canonical.sha256Hex;
  });
  if (matches.length > 1) return ooFail_('invalid-store');
  if (!matches.length) return null;
  var row = matches[0];
  if (row !== store.audit[store.audit.length - 1] || row.preMutationRevision !== body.expectedRevision ||
      store.revision !== row.preMutationRevision + 1 || store.updatedAt !== row.at) return null;
  var inspections = store.inspections.filter(function(value) { return value.inspectionId === body.inspectionId; });
  if (inspections.length !== 1) return ooFail_('invalid-store');
  var inspection = inspections[0];
  if (inspection.status !== stage || inspection.updatedAt !== row.at ||
      inspection.conversionId !== body.conversionId || inspection.pendingOrderId !== body.pendingOrderId ||
      inspection.conversionReceiptId !== body.receiptId || inspection.conversionTermsSha256 !== body.termsSha256) return null;
  if (request.action === 'officeInspectionBeginConversion') {
    if (inspection.conversionStartedAt !== row.at || inspection.linkedOrderId !== null ||
        !ooSameJson_(inspection.commercialTerms, body.commercialTerms) ||
        !ooSameJson_(inspection.commercialApproval, body.commercialApproval)) return null;
  } else if (request.action === 'officeInspectionArmLocalCommit') {
    if (inspection.linkedOrderId !== null) return null;
  } else if (inspection.linkedOrderId !== body.linkedOrderId) return null;
  return ooAckFromAudit_(store, row);
}

function ooValidateExpectedRevisionInsideLock_(request, revision) {
  if (OO_CREATE_ACTIONS_.indexOf(request.action) >= 0) return { ok: true };
  return request.payload.expectedRevision === revision ? { ok: true } : ooFail_('revision-conflict');
}

function ooValidateConversionIdentityOwnership_(store, request, canonical) {
  return { ok: true };
}

function ooUniqueRecordId_(store, kind) {
  var ids = {};
  store.pilots.forEach(function(row) { ids[row.pilotId] = true; });
  store.consents.forEach(function(row) { ids[row.consentId] = true; });
  store.inspections.forEach(function(row) { ids[row.inspectionId] = true; });
  store.opportunities.forEach(function(row) { ids[row.opportunityId] = true; });
  for (var index = 0; index < 20; index += 1) {
    var candidate = ooNewRecordId_(kind);
    if (candidate && !ids[candidate]) return candidate;
  }
  return '';
}

function ooPrepareMutation_(store, request, actor, canonical, mutationNowKst) {
  if (actor !== 'representative') return ooFail_('server-error');
  if (request.action !== 'officePilotCreate') return ooFail_('not-implemented');
  var payload;
  try { payload = JSON.parse(canonical.json).payload; }
  catch (_) { return ooFail_('invalid-input'); }
  var valid = ooValidatePilotCreate_(payload, mutationNowKst);
  if (!valid.ok) return valid;
  var id = ooUniqueRecordId_(store, 'pilot');
  if (!id) return ooFail_('server-error');
  var record = {
    pilotId: id,
    complexName: payload.complexName,
    source: payload.source,
    stage: payload.stage,
    pilotStartedAt: payload.pilotStartedAt,
    pilotEndsAt: payload.pilotEndsAt,
    extensionApprovedAt: payload.extensionApprovedAt,
    nextActionAt: payload.nextActionAt,
    owner: payload.owner,
    notes: payload.notes,
    createdAt: mutationNowKst,
    updatedAt: mutationNowKst,
    retentionStartedAt: payload.stage === 'closed' ? mutationNowKst : null,
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    restoredAt: null
  };
  if (!ooValidatePilot_(record).ok) return ooFail_('invalid-pilot');
  var nextStore = ooClone_(store);
  nextStore.pilots.push(record);
  return {
    ok: true,
    store: nextStore,
    id: id,
    action: request.action,
    mutationId: request.mutationId,
    idempotencyKey: payload.idempotencyKey,
    payloadSha256: canonical.sha256Hex,
    lifecycleBefore: null
  };
}

function ooParentFileIdSnapshot_(parent) {
  try {
    var iterator = parent.getFiles();
    var ids = {};
    while (iterator.hasNext()) {
      var id = iterator.next().getId();
      if (!id || ids[id]) return null;
      ids[id] = true;
    }
    return ids;
  } catch (_) {
    return null;
  }
}

function ooProtectedArtifactIds_(store, parentIds) {
  var ids = {};
  Object.keys(parentIds).forEach(function(id) { ids[id] = true; });
  store.audit.forEach(function(row) {
    ids[row.backupFileId] = true;
    ids[row.backupManifestFileId] = true;
  });
  return ids;
}

function ooAttemptedArtifactSafeToTrash_(attempt, source, preexistingIds) {
  if (!attempt || !attempt.file || !attempt.id || preexistingIds[attempt.id] || attempt.id === source.sourceId) return false;
  try {
    return ooFileIdentityMatches_(attempt.file, attempt.id, attempt.name, source.parentId);
  } catch (_) {
    return false;
  }
}

function ooCleanupFailedPair_(source, backupAttempt, manifestAttempt, preexistingIds) {
  var attempts = [backupAttempt, manifestAttempt];
  if (backupAttempt && manifestAttempt && backupAttempt.id === manifestAttempt.id) return ooFail_('backup-verify-failed');
  for (var index = 0; index < attempts.length; index += 1) {
    if (!ooAttemptedArtifactSafeToTrash_(attempts[index], source, preexistingIds)) continue;
    try { attempts[index].file.setTrashed(true); } catch (_) {}
  }
  return ooFail_('backup-verify-failed');
}

function ooFileIdentityMatches_(file, id, name, parentId) {
  try {
    var parent = ooExactParent_(file);
    return file.getId() === id && id && file.getName() === name && file.getMimeType() === OO_JSON_MIME_ &&
      file.isTrashed() === false && !!parent && parent.id === parentId;
  } catch (_) {
    return false;
  }
}

function ooRereadExactPair_(source, parent, backup, manifestFile, backupName, manifestName) {
  var backupId;
  var manifestFileId;
  try {
    backupId = backup.getId();
    manifestFileId = manifestFile.getId();
  } catch (_) {
    return ooFail_('backup-verify-failed');
  }
  if (!backupId || !manifestFileId || backupId === manifestFileId || backupId === source.sourceId || manifestFileId === source.sourceId ||
      !ooFileIdentityMatches_(backup, backupId, backupName, source.parentId) ||
      !ooFileIdentityMatches_(manifestFile, manifestFileId, manifestName, source.parentId)) return ooFail_('backup-verify-failed');
  var backupRaw = ooRawJson_(backup);
  var manifestRaw = ooRawJson_(manifestFile);
  if (!backupRaw.ok || !manifestRaw.ok || !ooExactKeys_(manifestRaw.value, OO_MANIFEST_FIELDS_)) return ooFail_('backup-verify-failed');
  return {
    ok: true,
    sourceFileId: source.sourceId,
    parentId: source.parentId,
    backupFileId: backupId,
    manifestFileId: manifestFileId,
    backupBytes: backupRaw.bytes,
    manifest: manifestRaw.value
  };
}

function ooBackupPair_(source, loaded, mutationNowMs) {
  if (!source || !source.ok || source.sourceId !== loaded.sourceId || source.parentId !== loaded.parentId) return ooFail_('backup-verify-failed');
  var parentIds = ooParentFileIdSnapshot_(source.parent);
  if (!parentIds) return ooFail_('backup-verify-failed');
  var protectedIds = ooProtectedArtifactIds_(loaded.store, parentIds);
  var createdAt = ooFormatKst_(mutationNowMs);
  var stamp = ooBackupStamp_(mutationNowMs);
  var backupName = '관리사무소영업운영_백업_' + stamp + '.json';
  var manifestName = '관리사무소영업운영_백업_' + stamp + '.manifest.json';
  var backup = null;
  var manifestFile = null;
  var backupId;
  var manifestFileId;
  var backupAttempt = null;
  var manifestAttempt = null;
  try {
    backup = source.parent.createFile(Utilities.newBlob(loaded.bytes, OO_JSON_MIME_, backupName));
    backupId = backup.getId();
  } catch (_) {
    return ooFail_('backup-verify-failed');
  }
  if (!backupId || protectedIds[backupId]) return ooFail_('backup-verify-failed');
  backupAttempt = { file: backup, id: backupId, name: backupName };
  var manifest = {
    sourceFileId: loaded.sourceId,
    backupFileId: backupId,
    createdAt: createdAt,
    schemaVersion: loaded.store.schemaVersion,
    preMutationRevision: loaded.store.revision,
    byteLength: loaded.byteLength,
    sha256Hex: loaded.sha256Hex
  };
  try {
    manifestFile = source.parent.createFile(manifestName, JSON.stringify(manifest), OO_JSON_MIME_);
    manifestFileId = manifestFile.getId();
  } catch (_) {
    return ooCleanupFailedPair_(source, backupAttempt, null, protectedIds);
  }
  if (!manifestFileId || protectedIds[manifestFileId]) return ooCleanupFailedPair_(source, backupAttempt, null, protectedIds);
  manifestAttempt = { file: manifestFile, id: manifestFileId, name: manifestName };
  if (manifestFileId === backupId) return ooFail_('backup-verify-failed');
  var pair = ooRereadExactPair_(source, source.parent, backup, manifestFile, backupName, manifestName);
  if (!pair.ok) return ooCleanupFailedPair_(source, backupAttempt, manifestAttempt, protectedIds);
  var readManifest = pair.manifest;
  if (pair.sourceFileId !== loaded.sourceId || pair.parentId !== loaded.parentId || pair.backupFileId !== backupId ||
      readManifest.sourceFileId !== loaded.sourceId || readManifest.backupFileId !== backupId ||
      readManifest.createdAt !== createdAt || ooParseKstDateTime_(readManifest.createdAt) === null ||
      readManifest.schemaVersion !== loaded.store.schemaVersion || readManifest.preMutationRevision !== loaded.store.revision ||
      readManifest.byteLength !== loaded.byteLength || readManifest.sha256Hex !== loaded.sha256Hex ||
      !ooBytesEqual_(pair.backupBytes, loaded.bytes) || ooSha256BytesHex_(pair.backupBytes) !== loaded.sha256Hex) {
    return ooCleanupFailedPair_(source, backupAttempt, manifestAttempt, protectedIds);
  }
  return {
    ok: true,
    backupFileId: pair.backupFileId,
    manifestFileId: pair.manifestFileId,
    parentId: loaded.parentId,
    backupName: backupName,
    manifestName: manifestName,
    manifest: manifest,
    backup: backup,
    manifestFile: manifestFile
  };
}

function ooRecheckLoadedSource_(source, loaded) {
  if (!ooFileIdentityMatches_(source.file, loaded.sourceId, OO_SOURCE_NAME_, loaded.parentId)) return ooFail_('source-changed');
  var raw = ooRawJson_(source.file);
  if (!raw.ok || raw.byteLength !== loaded.byteLength || raw.sha256Hex !== loaded.sha256Hex || !ooBytesEqual_(raw.bytes, loaded.bytes)) return ooFail_('source-changed');
  return { ok: true };
}

function ooArmRecoveryLatch_() {
  try { ooSetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED', '1'); } catch (_) {}
  var observed;
  try { observed = ooGetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED'); }
  catch (_) { return ooFail_('recovery-state-unknown'); }
  if (observed === '1') return { ok: true };
  return observed === '0' ? ooFail_('recovery-arm-failed') : ooFail_('recovery-state-unknown');
}

function ooClearRecoveryLatch_() {
  try { ooSetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED', '0'); } catch (_) {}
  var observed;
  try { observed = ooGetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED'); }
  catch (_) { return ooFail_('recovery-state-unknown'); }
  if (observed === '0') return { ok: true };
  return observed === '1' ? ooFail_('manual-recovery-required') : ooFail_('recovery-state-unknown');
}

function ooEnrichedCandidate_(loaded, prepared, backup, mutationNowKst) {
  var candidate = ooClone_(prepared.store);
  candidate.revision = loaded.store.revision + 1;
  candidate.updatedAt = mutationNowKst;
  candidate.audit.push({
    action: prepared.action,
    result: 'ok',
    id: prepared.id,
    mutationId: prepared.mutationId,
    idempotencyKey: prepared.idempotencyKey,
    payloadSha256: prepared.payloadSha256,
    at: mutationNowKst,
    actor: 'representative',
    lifecycleBefore: prepared.lifecycleBefore,
    backupFileId: backup.backupFileId,
    backupManifestFileId: backup.manifestFileId,
    backupSha256: loaded.sha256Hex,
    preMutationRevision: loaded.store.revision
  });
  if (!ooValidateStore_(candidate).ok || !ooValidateAuditHistory_(candidate).ok) return ooFail_('invalid-store');
  var json = JSON.stringify(candidate);
  var bytes = ooUtf8Bytes_(json);
  return {
    ok: true,
    store: candidate,
    json: json,
    bytes: bytes,
    sha256Hex: ooSha256BytesHex_(bytes),
    ack: { ok: true, id: prepared.id, revision: candidate.revision, updatedAt: mutationNowKst }
  };
}

function ooWritePrepared_(source, loaded, prepared, backup, mutationNowKst) {
  var candidate = prepared.enrichedCandidate;
  if (!candidate || !candidate.ok) return ooFail_('server-error');
  var writeExact = false;
  try {
    source.file.setContent(candidate.json);
    var verified = ooReadStore_(source);
    writeExact = verified.ok && verified.store.revision === candidate.store.revision &&
      verified.byteLength === ooNormalizeBytes_(candidate.bytes).length && verified.sha256Hex === candidate.sha256Hex &&
      ooBytesEqual_(verified.bytes, candidate.bytes);
  } catch (_) {
    writeExact = false;
  }
  if (!writeExact) {
    var restored = ooRestoreSourceAfterFailedWrite_(source, loaded, backup);
    if (!restored.ok) return ooFail_('manual-recovery-required');
    var restoredClear = ooClearRecoveryLatch_();
    return restoredClear.ok ? ooFail_('write-verify-failed') : restoredClear;
  }
  var cleared = ooClearRecoveryLatch_();
  if (!cleared.ok) return cleared;
  try { ooApplyVerifiedRetention_(source, backup); } catch (_) {}
  return candidate.ack;
}

function ooRestoreSourceAfterFailedWrite_(source, loaded, backup) {
  var restoreText = ooStrictUtf8_(loaded.bytes);
  if (restoreText === null || !ooBytesEqual_(ooUtf8Bytes_(restoreText), loaded.bytes)) return ooFail_('manual-recovery-required');
  try { source.file.setContent(restoreText); }
  catch (_) { return ooFail_('manual-recovery-required'); }
  var restored = ooReadStore_(source);
  if (!restored.ok || restored.sourceId !== loaded.sourceId || restored.parentId !== loaded.parentId ||
      restored.byteLength !== loaded.byteLength || restored.sha256Hex !== loaded.sha256Hex ||
      restored.store.revision !== loaded.store.revision || !ooBytesEqual_(restored.bytes, loaded.bytes)) return ooFail_('manual-recovery-required');
  return { ok: true };
}

function ooManifestNameMatchesBackup_(manifestName, backupName) {
  var prefix = '관리사무소영업운영_백업_';
  var backupPattern = /^관리사무소영업운영_백업_\d{8}_\d{6}\.json$/;
  var manifestPattern = /^관리사무소영업운영_백업_\d{8}_\d{6}\.manifest\.json$/;
  return backupPattern.test(backupName) && manifestPattern.test(manifestName) &&
    manifestName === backupName.slice(0, -5) + '.manifest.json' && backupName.indexOf(prefix) === 0;
}

function ooRetentionFileMap_(parent) {
  var iterator = parent.getFiles();
  var map = {};
  while (iterator.hasNext()) {
    var file = iterator.next();
    var id = file.getId();
    if (!id || map[id]) return null;
    map[id] = file;
  }
  return map;
}

function ooVerifiedRetentionPair_(source, manifestFile, files) {
  var manifestId;
  var manifestName;
  try {
    manifestId = manifestFile.getId();
    manifestName = manifestFile.getName();
  } catch (_) { return null; }
  if (manifestId === source.sourceId || !/\.manifest\.json$/.test(manifestName)) return null;
  var manifestIdentity = ooExactParent_(manifestFile);
  if (!manifestIdentity || manifestIdentity.id !== source.parentId || manifestFile.isTrashed() || manifestFile.getMimeType() !== OO_JSON_MIME_) return null;
  var manifestRaw = ooRawJson_(manifestFile);
  if (!manifestRaw.ok || !ooExactKeys_(manifestRaw.value, OO_MANIFEST_FIELDS_)) return null;
  var manifest = manifestRaw.value;
  if (manifest.sourceFileId !== source.sourceId || typeof manifest.backupFileId !== 'string' || !manifest.backupFileId ||
      manifest.backupFileId === source.sourceId || manifest.backupFileId === manifestId || ooParseKstDateTime_(manifest.createdAt) === null ||
      manifest.schemaVersion !== 1 || !ooValidRevision_(manifest.preMutationRevision) || !Number.isInteger(manifest.byteLength) || manifest.byteLength < 0 ||
      !/^[0-9a-f]{64}$/.test(manifest.sha256Hex || '')) return null;
  var backupFile = files[manifest.backupFileId];
  if (!backupFile) return null;
  var backupName = backupFile.getName();
  if (!ooManifestNameMatchesBackup_(manifestName, backupName) ||
      !ooFileIdentityMatches_(backupFile, manifest.backupFileId, backupName, source.parentId)) return null;
  var backupRaw = ooRawJson_(backupFile);
  if (!backupRaw.ok || backupRaw.byteLength !== manifest.byteLength || backupRaw.sha256Hex !== manifest.sha256Hex) return null;
  if (!ooValidateStore_(backupRaw.value).ok || !ooValidateAuditHistory_(backupRaw.value).ok ||
      backupRaw.value.schemaVersion !== manifest.schemaVersion || backupRaw.value.revision !== manifest.preMutationRevision) return null;
  return {
    sourceFileId: source.sourceId,
    backupFileId: manifest.backupFileId,
    manifestFileId: manifestId,
    createdAt: manifest.createdAt,
    preMutationRevision: manifest.preMutationRevision,
    byteLength: manifest.byteLength,
    sha256Hex: manifest.sha256Hex,
    backupName: backupName,
    manifestName: manifestName,
    backupFile: backupFile,
    manifestFile: manifestFile
  };
}

function ooVerifiedRetentionPairs_(source, currentPair) {
  var files;
  try { files = ooRetentionFileMap_(source.parent); }
  catch (_) { return []; }
  if (!files) return [];
  var pairs = [];
  var used = {};
  var ids = Object.keys(files);
  for (var index = 0; index < ids.length; index += 1) {
    var pair;
    try { pair = ooVerifiedRetentionPair_(source, files[ids[index]], files); }
    catch (_) { pair = null; }
    if (!pair) continue;
    if (used[pair.backupFileId] || used[pair.manifestFileId]) return [];
    used[pair.backupFileId] = true;
    used[pair.manifestFileId] = true;
    pairs.push(pair);
  }
  pairs.sort(function(left, right) {
    return left.preMutationRevision - right.preMutationRevision || left.createdAt.localeCompare(right.createdAt) ||
      left.backupFileId.localeCompare(right.backupFileId) || left.manifestFileId.localeCompare(right.manifestFileId);
  });
  var currentMatches = pairs.filter(function(pair) {
    return pair.backupFileId === currentPair.backupFileId && pair.manifestFileId === currentPair.manifestFileId &&
      pair.backupName === currentPair.backupName && pair.manifestName === currentPair.manifestName &&
      currentPair.parentId === source.parentId && currentPair.manifest &&
      pair.createdAt === currentPair.manifest.createdAt &&
      pair.preMutationRevision === currentPair.manifest.preMutationRevision &&
      pair.byteLength === currentPair.manifest.byteLength && pair.sha256Hex === currentPair.manifest.sha256Hex &&
      currentPair.manifest.sourceFileId === source.sourceId && currentPair.manifest.backupFileId === pair.backupFileId;
  });
  if (currentMatches.length !== 1 || pairs[pairs.length - 1] !== currentMatches[0]) return [];
  return pairs;
}

function ooRetentionBackupStillExact_(source, pair) {
  if (!ooFileIdentityMatches_(source.file, source.sourceId, OO_SOURCE_NAME_, source.parentId) ||
      !ooFileIdentityMatches_(pair.backupFile, pair.backupFileId, pair.backupName, source.parentId)) return false;
  var raw = ooRawJson_(pair.backupFile);
  return raw.ok && raw.byteLength === pair.byteLength && raw.sha256Hex === pair.sha256Hex &&
    ooValidateStore_(raw.value).ok && ooValidateAuditHistory_(raw.value).ok &&
    raw.value.schemaVersion === 1 && raw.value.revision === pair.preMutationRevision;
}

function ooRetentionManifestStillExact_(source, pair) {
  if (!ooFileIdentityMatches_(source.file, source.sourceId, OO_SOURCE_NAME_, source.parentId) ||
      !ooFileIdentityMatches_(pair.manifestFile, pair.manifestFileId, pair.manifestName, source.parentId)) return false;
  var raw = ooRawJson_(pair.manifestFile);
  if (!raw.ok || !ooExactKeys_(raw.value, OO_MANIFEST_FIELDS_)) return false;
  var manifest = raw.value;
  return manifest.sourceFileId === source.sourceId && manifest.backupFileId === pair.backupFileId &&
    manifest.createdAt === pair.createdAt && manifest.schemaVersion === 1 &&
    manifest.preMutationRevision === pair.preMutationRevision && manifest.byteLength === pair.byteLength &&
    manifest.sha256Hex === pair.sha256Hex;
}

function ooPairStillExact_(source, pair) {
  return ooRetentionManifestStillExact_(source, pair) && ooRetentionBackupStillExact_(source, pair);
}

function ooApplyVerifiedRetention_(source, currentPair) {
  var pairs = ooVerifiedRetentionPairs_(source, currentPair);
  if (pairs.length <= 10) return;
  var remove = pairs.slice(0, pairs.length - 10);
  for (var index = 0; index < remove.length; index += 1) {
    var pair = remove[index];
    if (!ooPairStillExact_(source, pair) || pair.backupFileId === source.sourceId || pair.manifestFileId === source.sourceId ||
        pair.backupFileId === currentPair.backupFileId || pair.manifestFileId === currentPair.manifestFileId) return;
    try {
      pair.backupFile.setTrashed(true);
    } catch (_) {
      return;
    }
    if (!ooRetentionManifestStillExact_(source, pair) || pair.manifestFileId === source.sourceId ||
        pair.manifestFileId === currentPair.manifestFileId) return;
    try { pair.manifestFile.setTrashed(true); }
    catch (_) { return; }
  }
}

function ooRecoveryValidationError_(code) {
  return new Error('recovery-validation-failed:' + code);
}

function ooRecoveryValidateSource_() {
  var lock = null;
  var acquired = false;
  var result;
  var failure = null;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw ooRecoveryValidationError_('lock-unavailable');
    acquired = true;
    var enabled;
    var recoveryRequired;
    try {
      enabled = ooGetScriptProperty_('OFFICE_OPS_ENABLED');
      recoveryRequired = ooGetScriptProperty_('OFFICE_OPS_RECOVERY_REQUIRED');
    } catch (_) {
      throw ooRecoveryValidationError_('flags');
    }
    if (enabled !== '0' || recoveryRequired !== '1') throw ooRecoveryValidationError_('flags');
    var source = ooSourceFile_();
    if (!source.ok) throw ooRecoveryValidationError_('source');
    var loaded = ooReadStore_(source);
    if (!loaded.ok) throw ooRecoveryValidationError_('source');
    result = {
      ok: true,
      sourceFileId: loaded.sourceId,
      schemaVersion: loaded.store.schemaVersion,
      revision: loaded.store.revision,
      byteLength: loaded.byteLength,
      sha256Hex: loaded.sha256Hex
    };
    Logger.log(JSON.stringify(result));
  } catch (error) {
    if (error && /^recovery-validation-failed:[a-z-]+$/.test(error.message || '')) failure = error;
    else failure = ooRecoveryValidationError_('server');
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
  if (failure) throw failure;
  return result;
}

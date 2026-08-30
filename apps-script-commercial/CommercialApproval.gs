if (typeof caNowMs_ !== 'function') {
  var caNowMs_ = function() { return Date.now(); };
}

function caCommercialNow_(payload, receivedAtKst) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !caHasExactFields_(payload, ['nonce'])) return caFail_('bad-request');
  if (!caValidateNonce_(payload.nonce)) return caFail_('invalid-nonce');
  return { ok: true, serverNowKst: caNowKst_(), receivedAtKst: receivedAtKst, nonce: payload.nonce };
}

function caCommercialApprovalIssue_(payload) {
  if (!caEnabled_()) return caFail_('commercial-disabled');
  var fields = ['subjectType', 'subjectId', 'commercialTerms', 'approvalEvidenceType', 'approvalEvidenceFileId', 'approvedAt', 'approvedByRole'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !caHasExactFields_(payload, fields)) return caFail_('bad-request');
  if (payload.subjectType !== 'aptOrder' || typeof payload.subjectId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(payload.subjectId)) return caFail_('invalid-subject');
  var terms = caCanonicalTerms_(payload.commercialTerms);
  if (!terms.ok) return terms;
  if (['quote-file', 'contract-file', 'message-export-file'].indexOf(payload.approvalEvidenceType) < 0 ||
      ['management-office', 'customer'].indexOf(payload.approvedByRole) < 0) return caFail_('invalid-approval');
  var approvedAtMs = caParseKstDateTime_(payload.approvedAt);
  if (approvedAtMs === null || approvedAtMs > caNowMs_() || !caWithinApprovalWindow_(payload.approvedAt, terms.value.validUntil, caNowMs_())) {
    return caFail_('invalid-approval-window');
  }
  var evidence = caEvidenceByExactId_(payload.approvalEvidenceFileId);
  if (!evidence.ok) return evidence;
  var receiptKey = caReceiptKey_();
  if (!receiptKey) return caFail_('commercial-disabled');
  var receipt = {
    receiptId: 'receipt_' + String(Utilities.getUuid()).replace(/-/g, '_'),
    subjectType: payload.subjectType,
    subjectId: payload.subjectId,
    approvedTermsSha256: terms.sha256Hex,
    approvalEvidenceType: payload.approvalEvidenceType,
    approvalEvidenceFileId: evidence.fileId,
    approvalEvidenceSha256: evidence.sha256Hex,
    approvedAt: payload.approvedAt,
    approvedByRole: payload.approvedByRole,
    issuedAt: caNowKst_()
  };
  receipt.receiptHmac = caSignReceipt_(receipt, receiptKey);
  if (!receipt.receiptHmac) return caFail_('invalid-receipt');
  return { ok: true, commercialApproval: receipt };
}

function caCommercialApprovalVerify_(payload) {
  if (!caEnabled_()) return caFail_('commercial-disabled');
  var fields = ['subjectType', 'subjectId', 'commercialTerms', 'commercialApproval', 'nonce'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !caHasExactFields_(payload, fields)) return caFail_('bad-request');
  if (!caValidateNonce_(payload.nonce)) return caFail_('invalid-nonce');
  var receipt = payload.commercialApproval;
  var terms = caCanonicalTerms_(payload.commercialTerms);
  if (!terms.ok || !caReceiptFieldsValid_(receipt) || !caVerifyReceiptMac_(receipt, caReceiptKey_())) return caFail_('invalid-receipt');
  if (receipt.subjectType !== payload.subjectType || receipt.subjectId !== payload.subjectId ||
      receipt.approvedTermsSha256 !== terms.sha256Hex || !caWithinApprovalWindow_(receipt.approvedAt, terms.value.validUntil, caNowMs_())) {
    return caFail_('approval-mismatch');
  }
  var evidence = caEvidenceByExactId_(receipt.approvalEvidenceFileId);
  if (!evidence.ok || evidence.sha256Hex !== receipt.approvalEvidenceSha256) return caFail_('evidence-hash-mismatch');
  var cacheKey = 'commercial-verify:' + receipt.receiptId + ':' + payload.nonce;
  var cache = CacheService.getScriptCache();
  if (cache.get(cacheKey)) return caFail_('nonce-replay');
  cache.put(cacheKey, '1', 60);
  return {
    ok: true,
    receiptId: receipt.receiptId,
    serverNowKst: caNowKst_(),
    nonce: payload.nonce,
    verifyExpiresAtKst: caKstAfterSeconds_(60)
  };
}

function caEvidenceByExactId_(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return caFail_('invalid-evidence-id');
  var file;
  try { file = DriveApp.getFileById(id); } catch (_) { return caFail_('evidence-not-found'); }
  if (file.isTrashed()) return caFail_('forbidden-evidence');
  if (['application/pdf', 'image/jpeg', 'image/png'].indexOf(String(file.getMimeType() || '')) < 0 ||
      file.getSize() > 20 * 1024 * 1024) return caFail_('forbidden-evidence');
  var bytes = file.getBlob().getBytes();
  return { ok: true, fileId: id, sha256Hex: caSha256BytesHex_(bytes) };
}

function caEnabled_() {
  return caProperty_('COMMERCIAL_APPROVAL_ENABLED') === '1';
}

function caTokenValid_(token) {
  var configured = caProperty_('COMMERCIAL_APPROVAL_TOKEN');
  return typeof token === 'string' && !!configured && token === configured;
}

function caReceiptKey_() {
  return String(caProperty_('COMMERCIAL_APPROVAL_RECEIPT_KEY') || '');
}

function caProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function caReceiptFieldsValid_(receipt) {
  return caIsReceipt_(receipt, true);
}

function caWithinApprovalWindow_(approvedAt, validUntil, nowMs) {
  var approvedAtMs = caParseKstDateTime_(approvedAt);
  var validUntilMs = Date.parse(String(validUntil || '') + 'T23:59:59+09:00');
  return approvedAtMs !== null && Number.isFinite(validUntilMs) && approvedAtMs <= nowMs && nowMs <= validUntilMs;
}

function caSha256BytesHex_(bytes) {
  return caBytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
}

function caNowKst_() {
  return Utilities.formatDate(new Date(caNowMs_()), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function caKstAfterSeconds_(seconds) {
  return Utilities.formatDate(new Date(caNowMs_() + seconds * 1000), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function caRequestFresh_(requestAtKst) {
  var requestMs = caParseKstDateTime_(requestAtKst);
  return requestMs !== null && Math.abs(caNowMs_() - requestMs) <= 5 * 60 * 1000;
}

function caFail_(code) {
  return { ok: false, error: code };
}

function caOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

if (typeof caNowMs_ !== 'function') {
  var caNowMs_ = function() { return Date.now(); };
}

function caCommercialNow_(payload, nowMs) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !caHasExactFields_(payload, ['nonce'])) return caFail_('bad-request');
  if (!caValidateNonce_(payload.nonce)) return caFail_('invalid-nonce');
  var serverNowKst = caNowKst_(nowMs);
  return { ok: true, serverNowKst: serverNowKst, receivedAtKst: serverNowKst, nonce: payload.nonce };
}

function caCommercialApprovalIssue_(payload, nowMs) {
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
  if (approvedAtMs === null || approvedAtMs > nowMs || !caWithinApprovalWindow_(payload.approvedAt, terms.value.validUntil, nowMs)) {
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
    issuedAt: caNowKst_(nowMs)
  };
  receipt.receiptHmac = caSignReceipt_(receipt, receiptKey);
  if (!receipt.receiptHmac) return caFail_('invalid-receipt');
  return { ok: true, commercialApproval: receipt };
}

function caCommercialApprovalVerify_(payload, nowMs) {
  if (!caEnabled_()) return caFail_('commercial-disabled');
  var fields = ['subjectType', 'subjectId', 'commercialTerms', 'commercialApproval', 'nonce'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !caHasExactFields_(payload, fields)) return caFail_('bad-request');
  if (!caValidateNonce_(payload.nonce)) return caFail_('invalid-nonce');
  var receipt = payload.commercialApproval;
  var terms = caCanonicalTerms_(payload.commercialTerms);
  if (!terms.ok || !caReceiptFieldsValid_(receipt) || !caVerifyReceiptMac_(receipt, caReceiptKey_())) return caFail_('invalid-receipt');
  if (receipt.subjectType !== payload.subjectType || receipt.subjectId !== payload.subjectId ||
      receipt.approvedTermsSha256 !== terms.sha256Hex || !caWithinApprovalWindow_(receipt.approvedAt, terms.value.validUntil, nowMs)) {
    return caFail_('approval-mismatch');
  }
  var evidence = caEvidenceByExactId_(receipt.approvalEvidenceFileId);
  if (!evidence.ok || evidence.sha256Hex !== receipt.approvalEvidenceSha256) return caFail_('evidence-hash-mismatch');
  var ackNowMs = caNowMs_();
  var cacheKey = 'commercial-verify:' + receipt.receiptId + ':' + payload.nonce;
  var claim = caClaimVerifyNonce_(cacheKey);
  if (!claim.ok) return claim;
  return {
    ok: true,
    receiptId: receipt.receiptId,
    serverNowKst: caNowKst_(ackNowMs),
    nonce: payload.nonce,
    verifyExpiresAtKst: caKstAfterSeconds_(60, ackNowMs)
  };
}

function caClaimVerifyNonce_(cacheKey) {
  var lock;
  var acquired = false;
  var cache;
  var putAttempted = false;
  var result = caFail_('internal-error');
  try {
    lock = LockService.getScriptLock();
    acquired = !!lock.tryLock(5000);
    if (acquired) {
      cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) {
        result = caFail_('nonce-replay');
      } else {
        putAttempted = true;
        cache.put(cacheKey, '1', 60);
        result = { ok: true };
      }
    }
  } catch (_) {
    if (putAttempted && cache) {
      try { cache.remove(cacheKey); } catch (_) {}
    }
    result = caFail_('internal-error');
  } finally {
    if (acquired) {
      try {
        lock.releaseLock();
      } catch (_) {
        if (putAttempted && cache) {
          try { cache.remove(cacheKey); } catch (_) {}
        }
        result = caFail_('internal-error');
      }
    }
  }
  return result;
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

function caNowKst_(nowMs) {
  if (!Number.isFinite(nowMs)) nowMs = caNowMs_();
  return Utilities.formatDate(new Date(nowMs), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function caKstAfterSeconds_(seconds, nowMs) {
  if (!Number.isFinite(nowMs)) nowMs = caNowMs_();
  return Utilities.formatDate(new Date(nowMs + seconds * 1000), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function caRequestFresh_(timestamp, nowMs) {
  var requestMs = caParseRequestTimestamp_(timestamp);
  return requestMs !== null && Math.abs(nowMs - requestMs) <= 5 * 60 * 1000;
}

function caParseRequestTimestamp_(value) {
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
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day ||
      hour > 23 || minute > 59 || second > 59) return null;
  if (match[7] !== 'Z') {
    var offset = match[7].slice(1).split(':').map(Number);
    if (offset[0] > 14 || offset[1] > 59 || (offset[0] === 14 && offset[1] !== 0)) return null;
  }
  var timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function caFail_(code) {
  return { ok: false, error: code };
}

function caOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

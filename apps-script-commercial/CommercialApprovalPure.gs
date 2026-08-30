function caCanonicalTerms_(terms) {
  var fields = ['workKind', 'scope', 'exclusions', 'vatMode', 'quotedAmount', 'validUntil', 'scheduleWindow'];
  if (!terms || typeof terms !== 'object' || Array.isArray(terms) || !caHasExactFields_(terms, fields)) return caFail_('invalid-terms');
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
      !caIsIsoDate_(value.validUntil) || !value.scheduleWindow) return caFail_('invalid-terms');
  var json = JSON.stringify(value);
  return { ok: true, value: value, json: json, sha256Hex: caSha256Hex_(json) };
}

function caReceiptCanonical_(r) {
  return JSON.stringify({
    receiptId: r.receiptId,
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    approvedTermsSha256: r.approvedTermsSha256,
    approvalEvidenceType: r.approvalEvidenceType,
    approvalEvidenceFileId: r.approvalEvidenceFileId,
    approvalEvidenceSha256: r.approvalEvidenceSha256,
    approvedAt: r.approvedAt,
    approvedByRole: r.approvedByRole,
    issuedAt: r.issuedAt
  });
}

function caSignReceipt_(receipt, key) {
  if (!caIsReceipt_(receipt, false) || typeof key !== 'string' || !key) return '';
  return caHmacSha256Hex_(caReceiptCanonical_(receipt), key);
}

function caVerifyReceiptMac_(receipt, key) {
  if (!caIsReceipt_(receipt, true) || typeof key !== 'string' || !key) return false;
  return caHmacSha256Hex_(caReceiptCanonical_(receipt), key) === receipt.receiptHmac;
}

function caParseKstDateTime_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value)) return null;
  var timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Utilities.formatDate(new Date(timestamp), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX") === value ? timestamp : null;
}

function caValidateNonce_(nonce) {
  return typeof nonce === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(nonce);
}

function caSha256Hex_(text) {
  return caBytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.newBlob(text).getBytes()));
}

function caHmacSha256Hex_(text, key) {
  return caBytesToHex_(Utilities.computeHmacSha256Signature(text, key));
}

function caBytesToHex_(bytes) {
  return bytes.map(function(byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function caHasExactFields_(value, fields) {
  var keys = Object.keys(value);
  return keys.length === fields.length && fields.every(function(field) {
    return Object.prototype.hasOwnProperty.call(value, field);
  });
}

function caIsIsoDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split('-').map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function caIsReceipt_(receipt, hasMac) {
  var fields = ['receiptId', 'subjectType', 'subjectId', 'approvedTermsSha256', 'approvalEvidenceType', 'approvalEvidenceFileId',
    'approvalEvidenceSha256', 'approvedAt', 'approvedByRole', 'issuedAt'];
  if (hasMac) fields.push('receiptHmac');
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || !caHasExactFields_(receipt, fields)) return false;
  if (!/^receipt_[A-Za-z0-9_-]{1,80}$/.test(receipt.receiptId) || !/^[A-Za-z0-9_-]{1,160}$/.test(receipt.subjectId)) return false;
  if (receipt.subjectType !== 'aptOrder' || receipt.approvalEvidenceType !== 'quote-file' || receipt.approvedByRole !== 'customer') return false;
  if (!/^[0-9a-f]{64}$/.test(receipt.approvedTermsSha256) || !/^[0-9a-f]{64}$/.test(receipt.approvalEvidenceSha256)) return false;
  if (typeof receipt.approvalEvidenceFileId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.approvalEvidenceFileId)) return false;
  var approvedAt = caParseKstDateTime_(receipt.approvedAt);
  var issuedAt = caParseKstDateTime_(receipt.issuedAt);
  if (approvedAt === null || issuedAt === null || issuedAt < approvedAt) return false;
  return !hasMac || /^[0-9a-f]{64}$/.test(receipt.receiptHmac);
}

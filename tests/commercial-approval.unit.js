const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function bytes(value) { return Array.from(value, byte => byte > 127 ? byte - 256 : byte); }
const sandbox = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest: (_algorithm, input) => bytes(crypto.createHash('sha256').update(Buffer.from(input)).digest()),
    computeHmacSha256Signature: (text, key) => bytes(crypto.createHmac('sha256', key).update(text).digest()),
    newBlob: text => ({ getBytes: () => Array.from(Buffer.from(text, 'utf8')) }),
    formatDate: (date, timezone, format) => {
      assert.equal(timezone, 'Asia/Seoul');
      assert.equal(format, "yyyy-MM-dd'T'HH:mm:ssXXX");
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).format(date).replace(' ', 'T') + '+09:00';
    }
  },
  caFail_: code => ({ ok: false, error: code })
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script-commercial', 'CommercialApprovalPure.gs'), 'utf8'), sandbox);

const terms = sandbox.caCanonicalTerms_({
  workKind: 'device-diagnosis', scope: '  욕실 누수 장비 진단  ', exclusions: ['복구 공사', '타일'],
  vatMode: 'included', quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '2026-09-02 오후'
});
assert.equal(terms.ok, true);
assert.equal(terms.json, '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}');
assert.match(terms.sha256Hex, /^[0-9a-f]{64}$/);
assert.equal(sandbox.caCanonicalTerms_({ ...terms.value, exclusions: ['타일', '복구 공사'] }).sha256Hex === terms.sha256Hex, false);
assert.equal(sandbox.caCanonicalTerms_({ ...terms.value, quotedAmount: 0 }).error, 'invalid-terms');
assert.equal(sandbox.caCanonicalTerms_({ ...terms.value, unexpected: true }).error, 'invalid-terms');
assert.equal(sandbox.caValidateNonce_('nonce_123456789012'), true);
assert.equal(sandbox.caValidateNonce_('short'), false);

const receipt = { receiptId: 'receipt_test_1', subjectType: 'aptOrder', subjectId: 'pending_order_test_1', approvedTermsSha256: terms.sha256Hex, approvalEvidenceType: 'quote-file', approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256: 'a'.repeat(64), approvedAt: '2026-08-31T09:30:00+09:00', approvedByRole: 'customer', issuedAt: '2026-08-31T10:00:00+09:00' };
receipt.receiptHmac = sandbox.caSignReceipt_(receipt, 'TEST_ONLY_RECEIPT_HMAC_KEY');
assert.equal(sandbox.caVerifyReceiptMac_(receipt, 'TEST_ONLY_RECEIPT_HMAC_KEY'), true);
assert.equal(sandbox.caVerifyReceiptMac_({ ...receipt, subjectId: 'lead_changed' }, 'TEST_ONLY_RECEIPT_HMAC_KEY'), false);
assert.equal(sandbox.caVerifyReceiptMac_({ ...receipt, unexpected: true }, 'TEST_ONLY_RECEIPT_HMAC_KEY'), false);
assert.equal(sandbox.caVerifyReceiptMac_({ ...receipt, approvedTermsSha256: 'A'.repeat(64) }, 'TEST_ONLY_RECEIPT_HMAC_KEY'), false);
assert.equal(sandbox.caParseKstDateTime_('2026-08-31T10:00:00+09:00'), Date.parse('2026-08-31T10:00:00+09:00'));
assert.equal(sandbox.caParseKstDateTime_('2026-08-31T10:00:00Z'), null);

console.log('commercial approval pure tests: PASS');

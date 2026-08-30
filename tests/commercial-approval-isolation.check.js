const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = require('node:path').join(__dirname, '..', 'apps-script-commercial');
const readme = fs.readFileSync(require('node:path').join(root, 'README_APPS_SCRIPT.md'), 'utf8');
for (const required of ['COMMERCIAL_APPROVAL_ENABLED', 'COMMERCIAL_APPROVAL_TOKEN', 'COMMERCIAL_APPROVAL_RECEIPT_KEY', '20 MiB', '60 seconds', 'new standalone Apps Script project', 'representative approval']) {
  assert.equal(readme.includes(required), true, 'README must state ' + required);
}
assert.equal(readme.includes('APP_TOKEN value'), false);
assert.equal(readme.includes('...'), false, 'README must not use ellipses or partial shapes');
const headings = [...readme.matchAll(/^### Gate (\d+)\b[^\n]*$/gm)];
assert.deepEqual(headings.map(m => Number(m[1])), [1, 2, 3, 4, 5, 6, 7], 'README must have exactly ordered Gate 1-7 headings');
assert.equal(headings.length, 7, 'README must have exactly seven gates');
assert.equal(/^### Gate 8\b/m.test(readme), false, 'README must not have Gate 8');
const gateSlice = n => readme.slice(headings[n - 1].index, headings[n] ? headings[n].index : readme.length);
for (const [n, required] of [[4, ['COMMERCIAL_APPROVAL_ENABLED=0', 'new web-app version', 'redacted test client', 'commercialNow']], [5, ['paid-work client path', 'deliberately created non-production PDF', 'PDF/JPEG/PNG', '20 MiB']], [6, ['separate written representative approval', 'flag to `1`']], [7, ['flag to `0`', 'prior Apps Script deployment', 'commercialApprovalIssue', 'commercialApprovalVerify', 'commercialNow', 'fail-closed']]]) {
  for (const phrase of required) assert.equal(gateSlice(n).includes(phrase), true, 'Gate ' + n + ' must state ' + phrase);
}
const prohibitedSection = readme.slice(readme.indexOf('## 이 Task가 승인하지 않는 외부 작업'), readme.indexOf('## 공통 POST envelope와 실패 응답'));
for (const phrase of ['Drive evidence selection', 'Script Property creation', 'Apps Script deployment', 'browser token storage', 'Pages publication', 'paid-work activation', 'push', 'merge', 'PR', 'customer contact', 'paid-service configuration']) assert.equal(prohibitedSection.includes(phrase), true, 'prohibited action missing: ' + phrase);
for (const required of [
  '"token":', '"action": "commercialNow"', '"action": "commercialApprovalIssue"', '"action": "commercialApprovalVerify"',
  '"timestamp":', '"payload":', '"nonce": "fake-commercialNow-nonce-0001"',
  '"subjectType": "aptOrder"', '"subjectId": "fake-apt-order-0001"', '"commercialTerms":',
  '"approvalEvidenceType": "quote-file"', '"approvalEvidenceFileId": "fake-evidence-file-0001"',
  '"approvedByRole": "customer"', '"commercialApproval": {', '"receiptId": "receipt_fake-0001"',
  '"approvedTermsSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"',
  '"approvalEvidenceSha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"',
  '"receiptHmac": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"', '"verifyExpiresAtKst":',
  'commercialNow failure response', 'invalid-nonce', 'commercialApprovalIssue failure response', 'forbidden-evidence',
  'commercialApprovalVerify failure response', 'nonce-replay'
]) assert.equal(readme.includes(required), true, 'README contract must state ' + required);
const source = ['Code.gs', 'CommercialApprovalPure.gs', 'CommercialApproval.gs']
  .map(name => fs.readFileSync(require('node:path').join(root, name), 'utf8')).join('\n');

const envelopeFields = "['token', 'action', 'timestamp', 'payload']";
assert.equal(source.includes(envelopeFields), true, 'production must enforce exact four-field envelope');
assert.equal(source.includes("['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify']"), true, 'production allowlist missing');
assert.equal(source.includes("return caFail_('commercial-disabled')"), true, 'production disabled semantics missing');
assert.equal(source.includes("['application/pdf', 'image/jpeg', 'image/png']") && source.includes('20 * 1024 * 1024'), true, 'production evidence policy missing');
assert.equal(source.includes("'nonce-replay'"), true, 'production nonce replay literal missing');

assert.match(source, /function caIsAllowedAction_\(action\)/);
assert.deepEqual([...source.matchAll(/'commercial(?:Now|ApprovalIssue|ApprovalVerify)'/g)].map(m => m[0]).sort(),
  ["'commercialApprovalIssue'", "'commercialApprovalVerify'", "'commercialNow'"].sort());
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'loadData_', 'saveData_', 'rootFolder_', 'MailApp', 'CalendarApp', 'UrlFetchApp']) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter the commercial relay');
}

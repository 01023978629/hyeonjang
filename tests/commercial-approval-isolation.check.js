const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = require('node:path').join(__dirname, '..', 'apps-script-commercial');
const readme = fs.readFileSync(require('node:path').join(root, 'README_APPS_SCRIPT.md'), 'utf8');
for (const required of ['COMMERCIAL_APPROVAL_ENABLED', 'COMMERCIAL_APPROVAL_TOKEN', 'COMMERCIAL_APPROVAL_RECEIPT_KEY', '20 MiB', '60 seconds', 'new standalone Apps Script project', 'representative approval']) {
  assert.equal(readme.includes(required), true, 'README must state ' + required);
}
assert.equal(readme.includes('APP_TOKEN value'), false);
assert.equal(readme.includes('...'), false, 'README must not use ellipses or partial shapes');
const gateMarkers = [1, 2, 3, 4, 5, 6, 7].map(n => '### Gate ' + n);
const gateIndexes = gateMarkers.map(marker => readme.indexOf(marker));
assert.equal(gateIndexes.every(index => index >= 0), true, 'README must label all seven gates');
assert.deepEqual([...gateIndexes].sort((a, b) => a - b), gateIndexes, 'README gates must remain ordered');
for (const required of [
  'COMMERCIAL_APPROVAL_ENABLED=0', 'new web-app version', 'redacted test client', 'commercialNow',
  'non-production PDF', 'paid-work client path', 'separate written representative approval',
  'flag to `1`', 'flag to `0`', 'prior Apps Script deployment',
  'Drive evidence selection', 'Script Property creation', 'Apps Script deployment',
  'browser token storage', 'Pages publication', 'paid-work activation', 'push', 'merge', 'PR',
  'customer contact', 'paid-service configuration',
  'commercialApprovalIssue', 'commercialApprovalVerify', 'application/pdf', 'image/jpeg', 'image/png',
  'nonce replay', 'receipt HMAC', 'fail-closed'
]) assert.equal(readme.includes(required), true, 'README must state ' + required);
for (const required of [
  '"action": "commercialNow"', '"action": "commercialApprovalIssue"', '"action": "commercialApprovalVerify"',
  '"payload": { "nonce": "fake-commercialNow-nonce-0001" }',
  '"subjectType": "aptOrder"', '"subjectId": "fake-apt-order-0001"',
  '"approvalEvidenceType": "quote-file"', '"approvalEvidenceFileId": "fake-evidence-file-0001"',
  '"approvedByRole": "customer"', '"commercialApproval": {', '"receiptId": "receipt_fake-0001"',
  '"approvedTermsSha256": "fake-sha256-terms-0001"', '"approvalEvidenceSha256": "fake-sha256-evidence-0001"',
  '"receiptHmac": "fake-hmac-0001"', '"verifyExpiresAtKst": "2030-01-01T00:01:00+09:00"',
  '{ "ok": false, "error": "<code>" }'
]) assert.equal(readme.includes(required), true, 'README contract must state ' + required);
const source = ['Code.gs', 'CommercialApprovalPure.gs', 'CommercialApproval.gs']
  .map(name => fs.readFileSync(require('node:path').join(root, name), 'utf8')).join('\n');

assert.match(source, /function caIsAllowedAction_\(action\)/);
assert.deepEqual([...source.matchAll(/'commercial(?:Now|ApprovalIssue|ApprovalVerify)'/g)].map(m => m[0]).sort(),
  ["'commercialApprovalIssue'", "'commercialApprovalVerify'", "'commercialNow'"].sort());
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'loadData_', 'saveData_', 'rootFolder_', 'MailApp', 'CalendarApp', 'UrlFetchApp']) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter the commercial relay');
}

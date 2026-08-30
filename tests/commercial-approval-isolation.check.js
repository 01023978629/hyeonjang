const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = require('node:path').join(__dirname, '..', 'apps-script-commercial');
const readme = fs.readFileSync(require('node:path').join(root, 'README_APPS_SCRIPT.md'), 'utf8');
for (const required of ['COMMERCIAL_APPROVAL_ENABLED', 'COMMERCIAL_APPROVAL_TOKEN', 'COMMERCIAL_APPROVAL_RECEIPT_KEY', '20 MiB', '60 seconds', 'new standalone Apps Script project', 'representative approval']) {
  assert.equal(readme.includes(required), true, 'README must state ' + required);
}
assert.equal(readme.includes('APP_TOKEN value'), false);
assert.equal(readme.includes('...'), false, 'README must not use ellipses or partial shapes');
assert.match(readme, /executePaidWorkGate\(\{ commandKind, subjectType, subjectId, targetState, commercialTerms, commercialApproval, createDraft \}\)/);
assert.match(readme, /one matching nonce exactly once/);
assert.match(readme, /round trip is at most 10 seconds/);
assert.match(readme, /received within 60 seconds/);
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
const verifyExample = readme.slice(readme.indexOf('### `commercialApprovalVerify`'), readme.indexOf('승인 evidence는'));
for (const field of ['approvedTermsSha256', 'approvalEvidenceSha256', 'receiptHmac']) {
  const match = verifyExample.match(new RegExp('"' + field + '"\\s*:\\s*"([0-9a-f]+)"'));
  assert.ok(match && /^[0-9a-f]{64}$/.test(match[1]), 'verify ' + field + ' must be 64 lowercase hex');
}
assert.equal(verifyExample.includes('fake-sha256'), false, 'verify must not use fake-sha256 placeholders');
assert.equal(verifyExample.includes('<runtimeNowKst-plus-60-seconds>'), false, 'verify ACK must show concrete KST timestamp');
assert.match(verifyExample, /"verifyExpiresAtKst"\s*:\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00"/);
function sectionBetween(start, end) {
  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, 'README section missing: ' + start);
  assert.notEqual(endIndex, -1, 'README section end missing: ' + end);
  return readme.slice(startIndex, endIndex);
}

function assertPhrasesInOrder(text, phrases, label) {
  let cursor = -1;
  for (const phrase of phrases) {
    const next = text.indexOf(phrase, cursor + 1);
    assert.notEqual(next, -1, label + ' must state in order: ' + phrase);
    cursor = next;
  }
}

function extractFunctionBody(text, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const signature = new RegExp('\\bfunction\\s+' + escapedName + '\\s*\\(').exec(text);
  assert.ok(signature, 'production function missing: ' + functionName);
  const openingBrace = text.indexOf('{', signature.index + signature[0].length);
  assert.notEqual(openingBrace, -1, 'production function body missing: ' + functionName);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openingBrace; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '/' && nextCharacter === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openingBrace + 1, index);
    }
  }
  assert.fail('unbalanced production function body: ' + functionName);
}

const shapeOnly = sectionBetween('## Shape-only fake response examples (not executable)', '## Executable controlled failure procedures');
for (const phrase of ['test-only/redacted', 'not executable', 'server-issued receipt', 'runtime Drive file ID']) {
  assert.equal(shapeOnly.includes(phrase), true, 'shape-only boundary missing: ' + phrase);
}

const executable = sectionBetween('## Executable controlled failure procedures', '승인 evidence는');
for (const forbidden of ['fake-forbidden-evidence-0001', 'fake-evidence-file-0001', 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210']) {
  assert.equal(executable.includes(forbidden), false, 'executable procedure must not use shape-only fake value: ' + forbidden);
}
for (const phrase of ['test-only/redacted', 'real token/key/file/customer data 금지', 'repository-external variable', 'cleanup']) {
  assert.equal(executable.includes(phrase), true, 'executable procedure safety requirement missing: ' + phrase);
}

const invalidNonce = sectionBetween('### Executable: `commercialNow` invalid-nonce', '### Executable: `commercialApprovalIssue` forbidden-evidence');
assertPhrasesInOrder(invalidNonce, [
  '`COMMERCIAL_APPROVAL_TOKEN` test property', 'repository-external `TEST_COMMERCIAL_APPROVAL_TOKEN`', 'exact match',
  'complete request', 'invalid nonce', 'invalid-nonce'
], 'commercialNow invalid-nonce procedure');

const forbiddenEvidence = sectionBetween('### Executable: `commercialApprovalIssue` forbidden-evidence', '### Executable: `commercialApprovalVerify` nonce-replay');
assertPhrasesInOrder(forbiddenEvidence, [
  '`COMMERCIAL_APPROVAL_ENABLED=1`', '`COMMERCIAL_APPROVAL_TOKEN` test property',
  'repository-external `TEST_COMMERCIAL_APPROVAL_TOKEN`', 'exact match',
  'accessible existing deliberately-created non-production', '`application/json`', 'runtime exact Drive file ID',
  '`TEST_FORBIDDEN_EVIDENCE_FILE_ID`', 'repository-external variable', 'complete issue request',
  '`DriveApp.getFileById`', '`evidence-not-found`', '`forbidden-evidence`', 'cleanup'
], 'commercialApprovalIssue forbidden-evidence procedure');

const nonceReplay = sectionBetween('### Executable: `commercialApprovalVerify` nonce-replay', '승인 evidence는');
assertPhrasesInOrder(nonceReplay, [
  'successful issue response', 'actual server-issued receipt', 'unchanged evidence',
  'same complete verify request', 'same nonce', 'first verify', '`{ "ok": true',
  'identical second request', 'second verify', '`{ "ok": false, "error": "nonce-replay" }`'
], 'commercialApprovalVerify nonce-replay procedure');
assert.equal(nonceReplay.includes('shape-only fake receipt'), true, 'nonce replay must reject shape-only fake receipt as a trigger');
const nonceReplayCodeBlocks = [...nonceReplay.matchAll(/```js\s*\r?\n([\s\S]*?)\r?\n```/g)];
assert.equal(nonceReplayCodeBlocks.length, 1, 'nonce replay procedure must contain one JavaScript request example');
const nonceReplayCode = nonceReplayCodeBlocks[0][1];
assert.equal((nonceReplayCode.match(/\bconst\s+verifyRequest\s*=\s*\{/g) || []).length, 1,
  'nonce replay procedure must create exactly one verifyRequest object');
assert.equal((nonceReplayCode.match(/\bverifyRequest\s*=/g) || []).length, 1,
  'nonce replay procedure must not replace verifyRequest between calls');
assert.equal((nonceReplayCode.match(/\bpost\s*\(/g) || []).length, 2,
  'nonce replay procedure must contain exactly two post calls');
assert.deepEqual(
  [...nonceReplayCode.matchAll(/\bpost\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map(match => match[1]),
  ['verifyRequest', 'verifyRequest'],
  'nonce replay procedure must call post exactly twice with the same verifyRequest object'
);
assertPhrasesInOrder(nonceReplayCode, [
  'const verifyRequest = {',
  'commercialApproval: issueResponse.commercialApproval',
  'nonce: TEST_VERIFY_NONCE',
  'const firstVerifyResponse = post(verifyRequest);',
  'if (firstVerifyResponse.ok !== true)',
  'const replayVerifyResponse = post(verifyRequest);',
  "replayVerifyResponse.error !== 'nonce-replay'"
], 'nonce replay request identity and call order');
const source = ['Code.gs', 'CommercialApprovalPure.gs', 'CommercialApproval.gs']
  .map(name => fs.readFileSync(require('node:path').join(root, name), 'utf8')).join('\n');
const codeSource = fs.readFileSync(require('node:path').join(root, 'Code.gs'), 'utf8');
const commercialSource = fs.readFileSync(require('node:path').join(root, 'CommercialApproval.gs'), 'utf8');

const envelopeFields = "['token', 'action', 'timestamp', 'payload']";
assert.equal(source.includes(envelopeFields), true, 'production must enforce exact four-field envelope');
assert.equal(source.includes("['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify']"), true, 'production allowlist missing');
assert.equal(source.includes("return caFail_('commercial-disabled')"), true, 'production disabled semantics missing');
assert.equal(source.includes("['application/pdf', 'image/jpeg', 'image/png']") && source.includes('20 * 1024 * 1024'), true, 'production evidence policy missing');
assert.equal(source.includes("'nonce-replay'"), true, 'production nonce replay literal missing');

const doPostHandler = extractFunctionBody(codeSource, 'caDoPostSafe_');
assertPhrasesInOrder(doPostHandler, [
  'var actionIndex = request && caCommercialActionIndex_(request.action)',
  "caHasExactFields_(request, ['token', 'action', 'timestamp', 'payload'])",
  'actionIndex < 0',
  'caParseRequestTimestamp_(request.timestamp) === null',
  'caRequestFresh_(request.timestamp, nowMs)',
  'caTokenValid_(request.token)',
  'if (actionIndex === 0) return caCommercialNow_(request.payload, nowMs)',
  'if (actionIndex === 1) return caCommercialApprovalIssue_(request.payload, nowMs)',
  'if (actionIndex === 2) return caCommercialApprovalVerify_(request.payload, nowMs)'
], 'production envelope, timestamp, action, token, and dispatch ordering');
for (const dispatch of [
  'caCommercialNow_(request.payload, nowMs)',
  'caCommercialApprovalIssue_(request.payload, nowMs)',
  'caCommercialApprovalVerify_(request.payload, nowMs)'
]) {
  assert.equal(doPostHandler.split(dispatch).length - 1, 1,
    'production dispatch must occur exactly once after validation: ' + dispatch);
}

const issueHandler = extractFunctionBody(commercialSource, 'caCommercialApprovalIssue_');
assertPhrasesInOrder(issueHandler, [
  'if (!caEnabled_())',
  "caFail_('commercial-disabled')",
  "var fields = ['subjectType', 'subjectId', 'commercialTerms', 'approvalEvidenceType', 'approvalEvidenceFileId', 'approvedAt', 'approvedByRole']",
  '!caHasExactFields_(payload, fields)',
  "caFail_('bad-request')",
  "payload.subjectType !== 'aptOrder'",
  '!/^[A-Za-z0-9_-]{1,160}$/.test(payload.subjectId)',
  "caFail_('invalid-subject')",
  'var terms = caCanonicalTerms_(payload.commercialTerms)',
  'if (!terms.ok) return terms',
  "['quote-file', 'contract-file', 'message-export-file'].indexOf(payload.approvalEvidenceType)",
  "['management-office', 'customer'].indexOf(payload.approvedByRole)",
  "caFail_('invalid-approval')",
  'var approvedAtMs = caParseKstDateTime_(payload.approvedAt)',
  '!caWithinApprovalWindow_(payload.approvedAt, terms.value.validUntil, nowMs)',
  "caFail_('invalid-approval-window')",
  'caEvidenceByExactId_(payload.approvalEvidenceFileId)'
], 'production issue enabled, payload, terms, and evidence ordering');
assert.equal((issueHandler.match(/caEvidenceByExactId_\(/g) || []).length, 1,
  'production issue handler must perform one evidence lookup after validation');

const evidenceHelper = extractFunctionBody(commercialSource, 'caEvidenceByExactId_');
assertPhrasesInOrder(evidenceHelper, [
  'DriveApp.getFileById(id)', "catch (_) { return caFail_('evidence-not-found'); }",
  'file.isTrashed()', "caFail_('forbidden-evidence')",
  'file.getMimeType()', 'file.getSize() > 20 * 1024 * 1024', "caFail_('forbidden-evidence')",
  'file.getBlob().getBytes()'
], 'production evidence missing, metadata, MIME, size, and blob ordering');
assert.equal((evidenceHelper.match(/DriveApp\.getFileById\(/g) || []).length, 1,
  'production evidence helper must perform one exact-ID lookup');
assert.equal((evidenceHelper.match(/file\.getBlob\(\)\.getBytes\(\)/g) || []).length, 1,
  'production evidence helper must read one validated blob');

const verifyHandler = extractFunctionBody(commercialSource, 'caCommercialApprovalVerify_');
assertPhrasesInOrder(verifyHandler, [
  'if (!caEnabled_())',
  "caFail_('commercial-disabled')",
  "var fields = ['subjectType', 'subjectId', 'commercialTerms', 'commercialApproval', 'nonce']",
  '!caHasExactFields_(payload, fields)',
  "caFail_('bad-request')",
  'caValidateNonce_(payload.nonce)',
  "caFail_('invalid-nonce')",
  'var receipt = payload.commercialApproval',
  'var terms = caCanonicalTerms_(payload.commercialTerms)',
  '!terms.ok',
  '!caReceiptFieldsValid_(receipt)',
  '!caVerifyReceiptMac_(receipt, caReceiptKey_())',
  "caFail_('invalid-receipt')",
  'receipt.subjectType !== payload.subjectType',
  'receipt.subjectId !== payload.subjectId',
  'receipt.approvedTermsSha256 !== terms.sha256Hex',
  '!caWithinApprovalWindow_(receipt.approvedAt, terms.value.validUntil, nowMs)',
  "caFail_('approval-mismatch')",
  'caEvidenceByExactId_(receipt.approvalEvidenceFileId)',
  'evidence.sha256Hex !== receipt.approvalEvidenceSha256',
  "caFail_('evidence-hash-mismatch')",
  'caClaimVerifyNonce_(cacheKey)'
], 'production verify enabled, nonce, receipt, terms, HMAC, subject-window, evidence, and claim ordering');
assert.equal((verifyHandler.match(/caClaimVerifyNonce_\(/g) || []).length, 1,
  'production verify handler must claim the nonce exactly once after validation');
const nonceClaim = extractFunctionBody(commercialSource, 'caClaimVerifyNonce_');
assertPhrasesInOrder(nonceClaim, ['cache.get(cacheKey)', "caFail_('nonce-replay')", "cache.put(cacheKey, '1', 60)"], 'production nonce claim ordering');

assert.match(source, /function caIsAllowedAction_\(action\)/);
assert.deepEqual([...source.matchAll(/'commercial(?:Now|ApprovalIssue|ApprovalVerify)'/g)].map(m => m[0]).sort(),
  ["'commercialApprovalIssue'", "'commercialApprovalVerify'", "'commercialNow'"].sort());
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'loadData_', 'saveData_', 'rootFolder_', 'MailApp', 'CalendarApp', 'UrlFetchApp']) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter the commercial relay');
}

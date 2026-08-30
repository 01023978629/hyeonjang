# Commercial Approval Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independently deployable, internal-only Apps Script relay that supplies trusted KST and issues or verifies tamper-evident commercial-approval receipts without touching the existing photo or OfficeIntake relay.

**Architecture:** Create `apps-script-commercial/` as its own Apps Script project, deployment, property namespace, entrypoint, source files, and README. The web-app dispatcher accepts only the three commercial actions, authenticates only `COMMERCIAL_APPROVAL_TOKEN`, reads only the specifically named evidence Drive file, and returns a short-lived nonce-bound verification result for a later single paid-work transition in the client. Pure canonicalization and receipt routines are separated from Apps Script APIs so Node VM tests can inject fake Drive, Clock, Properties, Utilities, and Cache dependencies.

**Tech Stack:** Google Apps Script V8 (`ContentService`, `DriveApp`, `PropertiesService`, `Utilities`, `CacheService`), JavaScript ES5-compatible `.gs` source, Node.js `node:test`/`assert` VM unit tests.

**Spec:** `C:\Users\1dncj\Documents\New project\manmool\docs\superpowers\specs\2026-08-30-revenue-operations-expansion-design.md` (§2, §8.1, §11, §13)

## Global Constraints

- Do not modify `apps-script/`, `index.html`, `sw.js`, existing photo relay behavior, existing `OfficeIntake`, or their deployment.
- Create and deploy `apps-script-commercial/` as a new, separate Apps Script project; it must not share an entrypoint or dispatcher with `apps-script/` or `apps-script-office-ops/`.
- Use only `COMMERCIAL_APPROVAL_ENABLED`, `COMMERCIAL_APPROVAL_TOKEN`, and `COMMERCIAL_APPROVAL_RECEIPT_KEY`; the token must be distinct from `APP_TOKEN`, `OFFICE_OPS_TOKEN`, and every public OfficeIntake session token.
- Keep Script Properties, tokens, receipt HMAC keys, Drive file IDs, evidence bytes, and customer data out of source, logs, HTML, GitHub artifacts, test output, and error responses. Test fixtures may contain only self-describing fake values such as `TEST_ONLY_COMMERCIAL_TOKEN` and `TEST_ONLY_RECEIPT_HMAC_KEY`.
- Implement only `commercialNow`, `commercialApprovalIssue`, and `commercialApprovalVerify`; reject every other GET or POST action. Do not call `MailApp`, `CalendarApp`, `UrlFetchApp`, or any SMS, Kakao, Naver, OfficeOps, photo, or OfficeIntake API.
- `commercialNow` remains available when `COMMERCIAL_APPROVAL_ENABLED=0`; `commercialApprovalIssue` and `commercialApprovalVerify` fail closed with `commercial-disabled` in that state and do not change Drive data.
- Treat Apps Script time as the authority and format all returned timestamps as ISO-8601 KST (`+09:00`); do not trust a browser clock for approval time or expiry.
- Evidence must be addressed by one exact Drive file ID: no filename search, folder enumeration, implicit Drive file creation, or dependency on unknown legacy-store file-ID properties. Permit only PDF, JPEG, or PNG; reject files over 20 MiB and trashed files. The MIME allowlist excludes every JSON store, including existing field, OfficeIntake, and OfficeOps JSON files.
- Canonical terms use the exact key order `workKind`, `scope`, `exclusions`, `vatMode`, `quotedAmount`, `validUntil`, `scheduleWindow`, UTF-8 JSON, trimmed `scope`, preserved `exclusions` order, and a SHA-256 hex digest.
- A receipt HMAC covers receipt ID, subject type and ID, canonical terms hash, evidence type/file ID/hash, approved time, approver role, and issued time. Never return the HMAC key; do not return evidence IDs or receipts in error payloads.
- Every receipt uses exactly `subjectType: 'aptOrder'` and an exact `subjectId` equal to the pending order ID for a new order or the current order ID for an existing order. Verification rejects every other subject type and any subject ID mismatch.
- `commercialNow` requires a client-generated 16–80-character nonce in `payload` and echoes that exact nonce with server KST. Verification must re-read evidence bytes and require matching HMAC, subject, terms hash, evidence hash, valid role, `approvedAt <= serverNowKst <= validUntil 23:59:59 KST`, a new 16–80-character nonce, and a nonce cache record usable for at most 60 seconds. Any failure is fail-closed.
- The relay proves verification only; a future client-side `executePaidWorkGate` must consume the matching nonce once and perform exactly one local create-or-transition. This is an operational UI safety proof against accidental workflow bypasses, not hostile-client authorization enforcement: a user who can alter local browser code/state is outside this relay's enforcement boundary. This relay must not read, write, or infer any hyeonjang, OfficeIntake, OfficeOps, project, photo, quote, or order JSON.
- Do not create external Script Properties, Drive files, Apps Script deployments, Pages deployments, pushes, PRs, merges, customer messages, or paid-service settings during implementation. Those are separate named approval gates after tests pass.

---

## File Structure

| Path | Responsibility |
|---|---|
| `apps-script-commercial/appsscript.json` | Standalone Apps Script manifest for the commercial relay only. |
| `apps-script-commercial/Code.gs` | Minimal web-app `doGet`/`doPost`, action allowlist, request parsing, response shaping, and token gate. |
| `apps-script-commercial/CommercialApprovalPure.gs` | Canonical terms serialization, UTF-8 SHA-256/HMAC helpers, receipt validation, KST date validation, nonce validation, and safe response builders. |
| `apps-script-commercial/CommercialApproval.gs` | Property lookup, trusted clock, exact-ID Drive evidence checks, receipt issue/verify handlers, and nonce cache handling. |
| `apps-script-commercial/README_APPS_SCRIPT.md` | Separate-project installation, property contract, approval-only deployment procedure, and rollback/disable steps. |
| `tests/commercial-approval.unit.js` | VM unit contract for deterministic pure helpers and red/green mutation checks. |
| `tests/commercial-approval-server.unit.js` | VM server contract with fake Apps Script Drive, Clock, Properties, Utilities, and Cache dependencies. |
| `tests/commercial-approval-isolation.check.js` | Static source boundary test proving the new relay neither imports nor dispatches existing relay/OfficeOps actions or prohibited services. |

## Interfaces

The new standalone project receives only these POST envelopes:

```js
{
  token: 'TEST_ONLY_COMMERCIAL_TOKEN',
  action: 'commercialNow|commercialApprovalIssue|commercialApprovalVerify',
  payload: {},
  timestamp: '2026-08-31T10:00:00+09:00'
}
```

`commercialNow` consumes `{ nonce }` and produces `{ ok: true, serverNowKst: string, receivedAtKst: string, nonce: string }`; `nonce` is an exact echo of the request payload. A client accepts this clock only when request round trip is at most 10 seconds, the echoed nonce matches, and it is used within 60 seconds after receipt.

`commercialApprovalIssue` consumes this payload and produces a signed opaque receipt object:

```js
{
  subjectType: 'aptOrder',
  subjectId: 'pending_or_current_apt_order_id',
  commercialTerms: {
    workKind: 'device-diagnosis', scope: '욕실 누수 장비 진단', exclusions: ['복구 공사'],
    vatMode: 'included', quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '2026-09-02 오후'
  },
  approvalEvidenceType: 'quote-file|contract-file|message-export-file',
  approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001',
  approvedAt: '2026-08-31T09:30:00+09:00',
  approvedByRole: 'management-office|customer'
}
```

The successful issue response is `{ ok:true, commercialApproval:{ receiptId, subjectType, subjectId, approvedTermsSha256, approvalEvidenceType, approvalEvidenceFileId, approvalEvidenceSha256, approvedAt, approvedByRole, issuedAt, receiptHmac } }`. It is an operating record, not a payment or electronic-signature result.

`commercialApprovalVerify` consumes `{ subjectType, subjectId, commercialTerms, commercialApproval, nonce }` and returns only `{ ok, receiptId, serverNowKst, nonce, verifyExpiresAtKst }` on success. `nonce` is `[A-Za-z0-9_-]{16,80}`; the handler stores `commercial-verify:<receiptId>:<nonce>` in `CacheService` with a 60-second lifetime, rejects duplicate active nonce use as `nonce-replay`, and never echoes the receipt, file ID, token, or HMAC in a failure response.

### Task 1: Scaffold the isolated commercial Apps Script project and failing boundary checks

**Files:**
- Create: `apps-script-commercial/appsscript.json`
- Create: `apps-script-commercial/Code.gs`
- Create: `apps-script-commercial/CommercialApprovalPure.gs`
- Create: `apps-script-commercial/CommercialApproval.gs`
- Create: `tests/commercial-approval-isolation.check.js`

**Interfaces:**
- Consumes: no existing hyeonjang server source; this project has no imports from `apps-script/`.
- Produces: `caIsAllowedAction_(action)`, `caDoPost_(request)`, and a static source boundary checked by Node.

- [ ] **Step 1: Write the failing isolated-project boundary test**

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = require('node:path').join(__dirname, '..', 'apps-script-commercial');
const source = ['Code.gs', 'CommercialApprovalPure.gs', 'CommercialApproval.gs']
  .map(name => fs.readFileSync(require('node:path').join(root, name), 'utf8')).join('\n');

assert.match(source, /function caIsAllowedAction_\(action\)/);
assert.deepEqual([...source.matchAll(/'commercial(?:Now|ApprovalIssue|ApprovalVerify)'/g)].map(m => m[0]).sort(),
  ["'commercialApprovalIssue'", "'commercialApprovalVerify'", "'commercialNow'"].sort());
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'loadData_', 'saveData_', 'rootFolder_', 'MailApp', 'CalendarApp', 'UrlFetchApp']) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter the commercial relay');
}
```

- [ ] **Step 2: Run the boundary test to verify it fails**

Run: `node tests/commercial-approval-isolation.check.js`

Expected: FAIL because `apps-script-commercial/` does not yet exist.

- [ ] **Step 3: Create the standalone manifest and minimal dispatcher**

```js
// apps-script-commercial/Code.gs
function doGet() { return caOut_(caFail_('method-not-allowed')); }
function doPost(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 65536) return caOut_(caFail_('bad-request'));
  var request; try { request = JSON.parse(raw); } catch (_) { return caOut_(caFail_('bad-request')); }
  return caOut_(caDoPost_(request));
}
function caIsAllowedAction_(action) {
  return ['commercialNow', 'commercialApprovalIssue', 'commercialApprovalVerify'].indexOf(action) >= 0;
}
```

Set the manifest runtime to V8 and declare only the web-app timezone (`Asia/Seoul`); do not add OAuth scopes for mail, calendar, external HTTP, or unrelated Drive operations. Keep dispatcher error output to `{ ok:false, error:<code> }`.

- [ ] **Step 4: Run the boundary test to verify it passes**

Run: `node tests/commercial-approval-isolation.check.js`

Expected: PASS and no existing `apps-script/` file changes.

- [ ] **Step 5: Commit the isolated foundation**

```bash
git add apps-script-commercial tests/commercial-approval-isolation.check.js
git commit -m "feat: isolate commercial approval relay from production relay"
```

### Task 2: Define canonical terms, receipt HMAC, and trusted-KST pure contracts

**Files:**
- Create: `tests/commercial-approval.unit.js`
- Modify: `apps-script-commercial/CommercialApprovalPure.gs`

**Interfaces:**
- Consumes: `Utilities.computeDigest`, `Utilities.computeHmacSha256Signature`, and `Utilities.formatDate` only through injected global Apps Script shims.
- Produces: `caCanonicalTerms_(terms) -> { ok, value, json, sha256Hex }`, `caReceiptCanonical_(receipt) -> string`, `caSignReceipt_(receipt, key) -> string`, `caVerifyReceiptMac_(receipt, key) -> boolean`, `caParseKstDateTime_(value) -> number|null`, `caValidateNonce_(nonce) -> boolean`.

- [ ] **Step 1: Write failing canonicalization and receipt tests**

```js
const terms = sandbox.caCanonicalTerms_({
  workKind: 'device-diagnosis', scope: '  욕실 누수 장비 진단  ', exclusions: ['복구 공사', '타일'],
  vatMode: 'included', quotedAmount: 100000, validUntil: '2026-09-30', scheduleWindow: '2026-09-02 오후'
});
assert.equal(terms.ok, true);
assert.equal(terms.json, '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}');
assert.match(terms.sha256Hex, /^[0-9a-f]{64}$/);
assert.equal(sandbox.caCanonicalTerms_({ ...terms.value, exclusions: ['타일', '복구 공사'] }).sha256Hex === terms.sha256Hex, false);
assert.equal(sandbox.caCanonicalTerms_({ ...terms.value, quotedAmount: 0 }).error, 'invalid-terms');
assert.equal(sandbox.caValidateNonce_('nonce_123456789012'), true);
assert.equal(sandbox.caValidateNonce_('short'), false);

const receipt = { receiptId: 'receipt_test_1', subjectType: 'aptOrder', subjectId: 'pending_order_test_1', approvedTermsSha256: terms.sha256Hex, approvalEvidenceType: 'quote-file', approvalEvidenceFileId: 'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256: 'a'.repeat(64), approvedAt: '2026-08-31T09:30:00+09:00', approvedByRole: 'customer', issuedAt: '2026-08-31T10:00:00+09:00' };
receipt.receiptHmac = sandbox.caSignReceipt_(receipt, 'TEST_ONLY_RECEIPT_HMAC_KEY');
assert.equal(sandbox.caVerifyReceiptMac_(receipt, 'TEST_ONLY_RECEIPT_HMAC_KEY'), true);
assert.equal(sandbox.caVerifyReceiptMac_({ ...receipt, subjectId: 'lead_changed' }, 'TEST_ONLY_RECEIPT_HMAC_KEY'), false);
```

- [ ] **Step 2: Run the pure test to verify it fails**

Run: `node tests/commercial-approval.unit.js`

Expected: FAIL with an undefined `caCanonicalTerms_` or receipt helper.

- [ ] **Step 3: Implement the deterministic pure helpers**

```js
function caCanonicalTerms_(terms) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms)) return caFail_('invalid-terms');
  var value = { workKind:String(terms.workKind || ''), scope:String(terms.scope || '').replace(/^\s+|\s+$/g, ''),
    exclusions:Array.isArray(terms.exclusions) ? terms.exclusions.map(String) : null, vatMode:String(terms.vatMode || ''),
    quotedAmount:Number(terms.quotedAmount), validUntil:String(terms.validUntil || ''), scheduleWindow:String(terms.scheduleWindow || '').replace(/^\s+|\s+$/g, '') };
  if (['device-diagnosis','dispatch','repair','preventive-inspection'].indexOf(value.workKind) < 0 || !value.scope || !value.exclusions || ['included','excluded'].indexOf(value.vatMode) < 0 || !Number.isInteger(value.quotedAmount) || value.quotedAmount < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(value.validUntil) || !value.scheduleWindow) return caFail_('invalid-terms');
  var json = JSON.stringify(value);
  return { ok:true, value:value, json:json, sha256Hex:caSha256Hex_(json) };
}
function caReceiptCanonical_(r) {
  return JSON.stringify({ receiptId:r.receiptId, subjectType:r.subjectType, subjectId:r.subjectId, approvedTermsSha256:r.approvedTermsSha256, approvalEvidenceType:r.approvalEvidenceType, approvalEvidenceFileId:r.approvalEvidenceFileId, approvalEvidenceSha256:r.approvalEvidenceSha256, approvedAt:r.approvedAt, approvedByRole:r.approvedByRole, issuedAt:r.issuedAt });
}
```

Implement `caSha256Hex_` with `Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.newBlob(text).getBytes())`, normalize signed bytes with `(byte + 256) % 256`, and use the equivalent HMAC helper over the exact canonical receipt string. Validate all fixed enum values, exact 64-character lowercase hex hashes, timestamp parsing, and nonce format before signing or comparing.

- [ ] **Step 4: Run the pure test to verify it passes, then prove its protection**

Run: `node tests/commercial-approval.unit.js`

Expected: PASS.

Temporarily change `caReceiptCanonical_` to omit `subjectId`, rerun the same command, and confirm the altered-subject assertion fails. Restore the exact source before continuing.

- [ ] **Step 5: Commit the pure approval contract**

```bash
git add apps-script-commercial/CommercialApprovalPure.gs tests/commercial-approval.unit.js
git commit -m "feat: bind commercial receipts to canonical approval terms"
```

### Task 3: Implement exact evidence validation, issuance, and nonce-bound verification with fake dependencies

**Files:**
- Create: `tests/commercial-approval-server.unit.js`
- Modify: `apps-script-commercial/CommercialApproval.gs`
- Modify: `apps-script-commercial/Code.gs`

**Interfaces:**
- Consumes: `caCanonicalTerms_`, receipt helpers, `DriveApp.getFileById(id)`, `PropertiesService.getScriptProperties()`, `CacheService.getScriptCache()`, injected `caNowMs_()`.
- Produces: `caCommercialNow_()`, `caCommercialApprovalIssue_(payload)`, `caCommercialApprovalVerify_(payload)`, `caEvidenceByExactId_(fileId)`, `caDoPost_(request)`.

- [ ] **Step 1: Write failing server tests with an in-memory Apps Script fake**

```js
const properties = {
  COMMERCIAL_APPROVAL_ENABLED: '1', COMMERCIAL_APPROVAL_TOKEN: 'TEST_ONLY_COMMERCIAL_TOKEN',
  COMMERCIAL_APPROVAL_RECEIPT_KEY: 'TEST_ONLY_RECEIPT_HMAC_KEY'
};
const drive = new Map([
  ['TEST_EVIDENCE_FILE_0001', fakeFile({ mime: 'application/pdf', bytes: Buffer.from('signed quote'), trashed: false })],
  ['TEST_JSON_STORE_FILE', fakeFile({ mime: 'application/json', bytes: Buffer.from('{}'), trashed: false })]
]);
const trustedNow = post('commercialNow', { nonce:'time_nonce_123456' });
assert.deepEqual({ ok:trustedNow.ok, nonce:trustedNow.nonce }, { ok:true, nonce:'time_nonce_123456' });
assert.equal(post('commercialNow', { nonce:'short' }).error, 'invalid-nonce');
const issued = post('commercialApprovalIssue', issuePayload);
assert.equal(issued.ok, true);
assert.match(issued.commercialApproval.approvalEvidenceSha256, /^[0-9a-f]{64}$/);
assert.equal(post('commercialApprovalIssue', { ...issuePayload, approvalEvidenceFileId: 'TEST_JSON_STORE_FILE' }).error, 'forbidden-evidence');
assert.equal(post('commercialApprovalIssue', { ...issuePayload, approvalEvidenceFileId: 'MISSING_FILE_0001' }).error, 'evidence-not-found');
assert.equal(post('commercialApprovalIssue', { ...issuePayload, subjectType: 'repair' }).error, 'invalid-subject');
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789012' }).ok, true);
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789012' }).error, 'nonce-replay');
drive.get('TEST_EVIDENCE_FILE_0001').bytes = Buffer.from('changed evidence');
assert.equal(post('commercialApprovalVerify', { ...verifyPayload, nonce: 'nonce_123456789013' }).error, 'evidence-hash-mismatch');
```

Make the fake file expose only `getId`, `getMimeType`, `getSize`, `isTrashed`, and `getBlob().getBytes`; make `DriveApp.getFileById` throw for absent IDs; make the fake KST clock deterministic; and record every Drive read so assertions prove no filename/folder API is used.

- [ ] **Step 2: Run the server test to verify it fails**

Run: `node tests/commercial-approval-server.unit.js`

Expected: FAIL because issue/verify handlers and exact evidence checks do not exist.

- [ ] **Step 3: Implement issue and verify handlers with fail-closed validation**

```js
function caEvidenceByExactId_(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return caFail_('invalid-evidence-id');
  var file; try { file = DriveApp.getFileById(id); } catch (_) { return caFail_('evidence-not-found'); }
  if (file.isTrashed()) return caFail_('forbidden-evidence');
  if (['application/pdf','image/jpeg','image/png'].indexOf(String(file.getMimeType() || '')) < 0 || file.getSize() > 20 * 1024 * 1024) return caFail_('forbidden-evidence');
  var bytes = file.getBlob().getBytes();
  return { ok:true, fileId:id, sha256Hex:caSha256BytesHex_(bytes) };
}
function caCommercialApprovalVerify_(payload) {
  if (!caEnabled_()) return caFail_('commercial-disabled');
  if (!caValidateNonce_(payload && payload.nonce)) return caFail_('invalid-nonce');
  var receipt = payload && payload.commercialApproval;
  var terms = caCanonicalTerms_(payload && payload.commercialTerms);
  if (!terms.ok || !caReceiptFieldsValid_(receipt) || !caVerifyReceiptMac_(receipt, caReceiptKey_())) return caFail_('invalid-receipt');
  if (receipt.subjectType !== payload.subjectType || receipt.subjectId !== payload.subjectId || receipt.approvedTermsSha256 !== terms.sha256Hex || !caWithinApprovalWindow_(receipt.approvedAt, terms.value.validUntil, caNowMs_())) return caFail_('approval-mismatch');
  var evidence = caEvidenceByExactId_(receipt.approvalEvidenceFileId);
  if (!evidence.ok || evidence.sha256Hex !== receipt.approvalEvidenceSha256) return caFail_('evidence-hash-mismatch');
  var cacheKey = 'commercial-verify:' + receipt.receiptId + ':' + payload.nonce;
  if (CacheService.getScriptCache().get(cacheKey)) return caFail_('nonce-replay');
  CacheService.getScriptCache().put(cacheKey, '1', 60);
  return { ok:true, receiptId:receipt.receiptId, serverNowKst:caNowKst_(), nonce:payload.nonce, verifyExpiresAtKst:caKstAfterSeconds_(60) };
}
```

Require a valid commercial token before dispatching any action, reject malformed bodies and timestamps without revealing configuration, compare the configured token without logging it, and implement `commercialNow` without a Drive read. `commercialNow` validates `payload.nonce` with `caValidateNonce_` and returns the exact same value as `nonce`. During issue, require `subjectType==='aptOrder'`, a nonempty pending/current `subjectId`, `approvalEvidenceFileId`, and `approvedAt`; ensure `approvedAt` is not future relative to trusted KST and `validUntil` is not already expired. During verify, use the same exact evidence ID from the signed receipt, calculate its current byte digest, compare it to the signed digest, and only then store the 60-second nonce cache key. Do not consult `DATA_FILE_ID`, `OFFICE_STORE_FILE_ID`, `OFFICE_OPS_FILE_ID`, or any legacy store name: `application/json` fails the MIME allowlist before bytes are accepted.

- [ ] **Step 4: Run server and isolation checks to verify they pass, then execute failure injections**

Run: `node tests/commercial-approval-server.unit.js && node tests/commercial-approval-isolation.check.js`

Expected: both PASS.

Temporarily change the maximum evidence size comparator to accept `20 * 1024 * 1024 + 1`, add a 20 MiB + 1 fake file case, and confirm the server test fails. Restore the strict comparator and retain the over-limit test permanently. Also assert a JSON MIME file is rejected without reading a legacy-property value; future approval time, expired date, altered terms hash, altered HMAC, deleted evidence, missing token, wrong token, wrong subject type, wrong subject ID, and `COMMERCIAL_APPROVAL_ENABLED='0'` all leave fake Drive contents unchanged.

- [ ] **Step 5: Commit the evidence and verification relay**

```bash
git add apps-script-commercial/Code.gs apps-script-commercial/CommercialApproval.gs tests/commercial-approval-server.unit.js tests/commercial-approval-isolation.check.js
git commit -m "feat: fail closed when commercial evidence changes"
```

### Task 4: Document client handoff and approval-gated deployment without performing it

**Files:**
- Create: `apps-script-commercial/README_APPS_SCRIPT.md`
- Modify: `tests/commercial-approval-isolation.check.js`

**Interfaces:**
- Consumes: the three action contracts documented above and the new standalone Apps Script project.
- Produces: an operator checklist that separates repository verification from representative-controlled account and deployment work.

- [ ] **Step 1: Write a failing README contract assertion**

```js
const readme = fs.readFileSync(require('node:path').join(root, 'README_APPS_SCRIPT.md'), 'utf8');
for (const required of ['COMMERCIAL_APPROVAL_ENABLED', 'COMMERCIAL_APPROVAL_TOKEN', 'COMMERCIAL_APPROVAL_RECEIPT_KEY', '20 MiB', '60 seconds', 'new standalone Apps Script project', 'representative approval']) {
  assert.equal(readme.includes(required), true, 'README must state ' + required);
}
assert.equal(readme.includes('APP_TOKEN value'), false);
```

- [ ] **Step 2: Run the documentation assertion to verify it fails**

Run: `node tests/commercial-approval-isolation.check.js`

Expected: FAIL because the relay README does not exist.

- [ ] **Step 3: Write the operator README with concrete gates**

Include these exact ordered gates: (1) run all three commercial tests on the branch; (2) representative creates a **new** Apps Script project and copies only `apps-script-commercial/`; (3) representative creates distinct property values in that new project without pasting values into repository files; (4) representative sets `COMMERCIAL_APPROVAL_ENABLED=0`, deploys a new web-app version, and checks `commercialNow` with a redacted test client; (5) representative confirms issue/verify behavior against a deliberately created non-production PDF while no paid-work client path is enabled; (6) after separate written approval, set the flag to `1` and record only deployment version, test date, and pass/fail; (7) disable by returning the flag to `0` or selecting the prior Apps Script deployment. State that this plan does not authorize Drive evidence selection, property creation, deployment, browser token storage, Pages publication, or paid-work activation.

- [ ] **Step 4: Run the documentation assertion and commercial suite to verify they pass**

Run: `node tests/commercial-approval.unit.js && node tests/commercial-approval-server.unit.js && node tests/commercial-approval-isolation.check.js`

Expected: all PASS; no real account, Script Property, Drive file, or deployment is changed.

- [ ] **Step 5: Commit the explicit operational boundary**

```bash
git add apps-script-commercial/README_APPS_SCRIPT.md tests/commercial-approval-isolation.check.js
git commit -m "docs: require approval before commercial relay activation"
```

### Task 5: Run repository-level verification and record the client integration boundary

**Files:**
- Modify: `apps-script-commercial/README_APPS_SCRIPT.md`
- Modify: `tests/commercial-approval-isolation.check.js`

**Interfaces:**
- Consumes: all commercial relay source and tests.
- Produces: a verified handoff stating exactly what a future hyeonjang paid-work plan must consume.

- [ ] **Step 1: Add the failing client-boundary check**

```js
assert.match(readme, /executePaidWorkGate\(\{ commandKind, subjectType, subjectId, targetState, commercialTerms, commercialApproval, createDraft \}\)/);
assert.match(readme, /one matching nonce exactly once/);
assert.match(readme, /round trip is at most 10 seconds/);
assert.match(readme, /received within 60 seconds/);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/commercial-approval-isolation.check.js`

Expected: FAIL until the README names the exact future client gate contract.

- [ ] **Step 3: Document the integration invariants without changing production client code**

State that future hyeonjang work must call `commercialNow` with a newly generated nonce, measure a <=10-second request/response round trip, reject a nonmatching echoed nonce, call `commercialApprovalVerify` with a second newly generated nonce, and immediately consume the matching successful nonce once inside `executePaidWorkGate`. It must reject a response older than 60 seconds, subject/terms mismatch, or any failure without changing the pending order/state. State explicitly that this relay project has no authority to create orders or transition any state, and that this control is an operational UI safety proof rather than hostile-client authorization enforcement.

- [ ] **Step 4: Run the complete verification set**

Run: `node tests/commercial-approval.unit.js && node tests/commercial-approval-server.unit.js && node tests/commercial-approval-isolation.check.js && node tests/run-all.js`

Expected: every new commercial test passes and the existing hyeonjang regression passes with `apps-script/`, `index.html`, and `sw.js` unchanged.

- [ ] **Step 5: Commit verification evidence**

```bash
git add apps-script-commercial/README_APPS_SCRIPT.md tests/commercial-approval-isolation.check.js
git commit -m "test: preserve legacy relay while proving commercial isolation"
```

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-commercial-approval-relay.md`. Implement it in the isolated worktree with one review gate per task. The representative-controlled account, property, Drive evidence, deployment, and activation steps remain outside repository implementation and require separate explicit approval.

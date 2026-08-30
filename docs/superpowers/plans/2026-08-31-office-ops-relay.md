# OfficeOps Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independently deployable, internal-only Apps Script OfficeOps relay that keeps commercial operations in a separately identified JSON file with strict schema, concurrency, backup, archive/restore, and retention controls.

**Architecture:** Create `apps-script-office-ops/` as a second standalone Apps Script project, separate from both `apps-script/` and `apps-script-commercial/`. Its allowlisted internal actions authenticate with `OFFICE_OPS_TOKEN`, operate only on the exact `OFFICE_OPS_FILE_ID`, serialize every mutation with `LockService`, preserve verified byte-for-byte backups before each mutation, and expose no public browser/session action. Pure validation and mutation functions are tested with fake Apps Script dependencies; server tests inject fake Drive, Clock, Lock, Properties, and Utilities services.

**Tech Stack:** Google Apps Script V8 (`ContentService`, `DriveApp`, `PropertiesService`, `Utilities`, `LockService`), JavaScript ES5-compatible `.gs` source, Node.js `node:test`/`assert` VM unit tests.

**Spec:** `C:\Users\1dncj\Documents\New project\manmool\docs\superpowers\specs\2026-08-30-revenue-operations-expansion-design.md` (§7, §8.2, §9–§11, §13)

## Global Constraints

- Do not modify `apps-script/`, `apps-script-commercial/`, `index.html`, `sw.js`, existing photo relay behavior, `OfficeIntake`, existing project storage, or `aptOrders`.
- Create and deploy `apps-script-office-ops/` as a new, separate Apps Script project, entrypoint, deployment, and property namespace; it must not share sources or dispatch with `apps-script/` or `apps-script-commercial/`.
- Use only `OFFICE_OPS_FILE_ID`, `OFFICE_OPS_ENABLED`, `OFFICE_OPS_RECOVERY_REQUIRED`, and `OFFICE_OPS_TOKEN`. `OFFICE_OPS_RECOVERY_REQUIRED` is the durable fail-closed write latch, initialized to `0`; it is never a client-controlled field. `OFFICE_OPS_TOKEN` must differ from `APP_TOKEN`, every public OfficeIntake session token, and `COMMERCIAL_APPROVAL_TOKEN`.
- Permit no public browser call, OfficeIntake session token, legacy `APP_TOKEN`, or unauthenticated request. Every action is internal and must authenticate its separate token without logging it.
- Implement only `officeOpsList`, pilot/consent/inspection/opportunity create-update-archive-restore actions, the five inspection conversion actions, and `officeOpsRetentionList`; reject `load`, `save`, `upload`, `officeInbox`, `officeAccept`, `officeSetStatus`, and every unknown action.
- Store only pilots, renewal consents, inspections, opportunities, and metadata-only audit data. Inspections may retain validated `commercialTerms`, `commercialApproval` metadata, `conversionId`, `conversionReceiptId`, `conversionTermsSha256`, `pendingOrderId`, `linkedOrderId`, and server KST `conversionStartedAt`; this is metadata, not a commercial API call. Never store resident names, unit numbers, phone numbers, photos, quote originals, full project state, evidence bytes, session tokens, receipt HMAC keys, or Drive blobs in OfficeOps.
- The exact file ID in `OFFICE_OPS_FILE_ID` must point to exactly one non-trashed JSON file named `관리사무소영업운영.json`. Because this standalone project deliberately cannot read legacy property namespaces, the representative must prove at initialization that this ID differs from the existing data and OfficeIntake file IDs; the server then verifies only its exact configured ID, display name, non-trashed status, and strict schema on every read/write. General requests never search by filename and never create a new store file.
- Require schema version `1`, nonnegative integer `revision`, whole-second KST `updatedAt`, exactly `pilots`, `consents`, `inspections`, `opportunities`, and `audit` arrays; reject unknown top-level or nested fields, duplicate IDs across all four arrays, invalid states, malformed JSON, unsupported schema, and display-name mismatch without overwriting the source file. Pilot and opportunity rows include the server-owned `retentionStartedAt`; inspection rows include the server-owned `conversionStartedAt`.
- Every request, including `officeOpsList` and `officeOpsRetentionList`, requires an RFC 3339 timestamp that passes the same calendar, clock, offset, and five-minute freshness rules as the commercial relay's `caParseRequestTimestamp_`; browser UTC `new Date().toISOString()` and valid explicit offsets such as `+09:00` are accepted. Stored datetimes are stricter whole-second KST `YYYY-MM-DDTHH:mm:ss+09:00` values. Every mutation additionally requires a new `mutationId`. Creates also require a 16–80 character `[A-Za-z0-9_-]+` `idempotencyKey`; same key/same canonical payload returns the first exact acknowledgement reconstructed from audit, same key/different payload returns `idempotency-conflict`, repeated mutation ID returns `replay-request`, and stale timestamps return `stale-request` before idempotency lookup.
- Updates, archives, restores, and conversion commands require `expectedRevision`; use `LockService` to serialize mutation and fail with `revision-conflict` without overwriting newer data.
- Before every mutation, copy the exact loaded UTF-8 source bytes to `관리사무소영업운영_백업_YYYYMMDD_HHmmss.json`, create a paired `.manifest.json` containing `sourceFileId`, `backupFileId`, `createdAt`, `schemaVersion`, `preMutationRevision`, `byteLength`, and lowercase SHA-256, then re-read both files and bind every value, byte, ID, name, parent, MIME, length, hash, and revision back to that loaded source. Mutation proceeds only after the verified pair succeeds. On any copy/manifest/re-read/parse/hash failure, track only directly returned, distinct, same-parent new artifact IDs as attempted cleanup candidates and leave source bytes/revision unchanged; never trash the source or pass attempted artifacts into normal retention selection. Drive may contain same-name files created within one second; pair and order complete verified pairs by `preMutationRevision`, `createdAt`, and immutable file IDs, requiring the current pair to be the maximal member and retaining exactly the newest ten including it.
- Archive is a tombstone for pilots, inspections, and opportunities: preserve item ID, set `archivedAt`, `archivedBy`, `archiveReason`, and later `restoredAt`; exclude archived entries from default lists and operational statistics. Consents use withdrawal records rather than archive. First release never permanently deletes data.
- Retention list includes closed pilots, skip/closed opportunities, withdrawn consents, and archived tombstones once their one-KST-calendar-year reference date is reached. `retentionStartedAt` is set only when a pilot enters `closed` or an opportunity enters `skip|closed`, preserved while that terminal state remains, and cleared if the row leaves it. Archive uses `archivedAt` instead; archive wins if one row has both reasons. Restore retains the ID and resets only the archive retention start to a subsequent archive. February 29 falls back to February 28 in the following non-leap year. First release lists but never automatically deletes eligible rows.
- Do not call `MailApp`, `CalendarApp`, `UrlFetchApp`, SMS, Kakao, Naver booking APIs, `commercialNow`, `commercialApprovalIssue`, `commercialApprovalVerify`, or any external service. Inspection receipt metadata is permitted, but OfficeOps never invokes a commercial API. Do not automatically retry or queue offline work.
- `OFFICE_OPS_ENABLED=0` rejects every server read and mutation, including `officeOpsList`; only a previously validated device-local `office_ops_cache` may be exported read-only by the future UI. That stale export path must not create, edit, draft, convert orders, generate contact drafts, or call the server. Existing hyeonjang features remain functional.
- The conversion handlers are handshake-only infrastructure and remain operationally disabled by the production code constant `ooConversionOperationallyEnabled_(){return false;}` until the separate commercial relay and browser paid-work gate/recovery plan both pass their integration tests. This adds no property and no action. A later, separately approved promotion commit may change only that literal to `true` after the commercial-plus-browser E2E evidence is recorded. OfficeOps never creates or transitions a local order.
- Do not create external Script Properties, Drive files, Apps Script deployments, Pages deployments, pushes, PRs, merges, customer messages, calendars, or paid-service settings during implementation. New file setup, properties, deployment, and enabling are distinct representative approval gates.

---

## File Structure

| Path | Responsibility |
|---|---|
| `apps-script-office-ops/appsscript.json` | Standalone OfficeOps Apps Script manifest. |
| `apps-script-office-ops/Code.gs` | Internal-only web-app parsing, token gate, and action allowlist. |
| `apps-script-office-ops/OfficeOpsPure.gs` | Schema, strict-field, canonical payload, ID, timestamp, state, archive, restore, retention, and audit helpers. |
| `apps-script-office-ops/OfficeOps.gs` | Exact-ID store access, Drive byte backup/manifest verification, lock-scoped mutations, idempotency/replay storage, and action handlers. |
| `apps-script-office-ops/README_APPS_SCRIPT.md` | New-project setup, property contract, manual file initialization, deployment/rollback gates, and redacted operations checklist. |
| `AGENTS.md` | Record both new standalone Apps Script source directories and preserve the existing `apps-script/` deployment boundary. |
| `tests/office-ops-pure.unit.js` | Deterministic unit tests for schema, canonical payload, state, archive, restore, and retention rules. |
| `tests/office-ops-server.unit.js` | VM server contract with fake Apps Script Drive/Clock/Lock/Properties/Utilities and injected backup failures. |
| `tests/office-ops-server-isolation.check.js` | Static server isolation test proving no legacy relay, public OfficeIntake, hyeonjang state, commercial API call, external automation, or prohibited service path exists. |

## Interfaces

Every request is a POST envelope, not a browser/session request:

```js
{
  token: 'TEST_ONLY_OFFICE_OPS_TOKEN',
  action: 'officeOpsList|officePilotCreate|officePilotUpdate|officePilotArchive|officeConsentRecord|officeConsentWithdraw|officeInspectionCreate|officeInspectionUpdate|officeInspectionArchive|officeInspectionBeginConversion|officeInspectionArmLocalCommit|officeInspectionRecordLocalCommit|officeInspectionFinalizeConversion|officeInspectionCancelConversion|officeOpportunityCreate|officeOpportunityUpdate|officeOpportunityArchive|officePilotRestore|officeInspectionRestore|officeOpportunityRestore|officeOpsRetentionList',
  deviceId: 'device_1234567890123456',
  timestamp: '2026-08-31T10:00:00+09:00',
  mutationId: 'mut_1234567890123456', // mutations only; omitted for reads
  payload: {}
}
```

Every request has exactly `token,action,deviceId,timestamp,payload`; mutations add exactly one `mutationId`, while `officeOpsList` and `officeOpsRetentionList` must omit it. `deviceId` and `mutationId` each match `^[A-Za-z0-9_-]{16,100}$`, accepting the future client's UUIDs. Unknown envelope fields, missing/invalid IDs, a read with `mutationId`, or a mutation without it fail closed. `timestamp` accepts the commercial relay's exact RFC 3339 request grammar—`YYYY-MM-DDTHH:mm:ss[.1–9 digits](Z|±HH:MM)` with a real calendar date, valid time/offset, and absolute server skew at most five minutes—while all stored datetimes use exact whole-second KST. Create payloads include an `idempotencyKey` matching `^[A-Za-z0-9_-]{16,80}$`. The server derives IDs as `pilot_`, `consent_`, `inspection_`, or `opp_` plus `Utilities.getUuid()`; caller-supplied record IDs are rejected. Every successful mutation, including idempotent replay, returns exactly `{ ok:true, id, revision, updatedAt }`. The two read-only actions are deliberate exceptions: `officeOpsList` returns exactly `{ ok:true, store }`, and `officeOpsRetentionList` returns exactly `{ ok:true, rows, serverNowKst }`. Errors return only `{ ok:false, error:<code> }` plus non-sensitive recovery guidance.

Store shape is exactly:

```js
{
  schemaVersion: 1, revision: 0, updatedAt: '2026-08-31T10:00:00+09:00',
  pilots: [], consents: [], inspections: [], opportunities: [], audit: []
}
```

`audit` contains metadata only and every row has exactly `{ action, result, id, mutationId, idempotencyKey, payloadSha256, at, actor, lifecycleBefore, backupFileId, backupManifestFileId, backupSha256, preMutationRevision }`. `result` is exactly `'ok'`; `actor` is the server-derived `'representative'`; `idempotencyKey` is the validated create key or `null`; and `lifecycleBefore` is `null` except archive/restore, where it is exactly `{ archivedAt, archivedBy, archiveReason, restoredAt }`. It must not copy arbitrary notes, personal details, tokens, evidence, signed receipts, or complete payloads. The backup fields identify the verified pair used for that successful mutation. An idempotent create replay returns the first exact acknowledgement as `{ok:true,id:audit.id,revision:audit.preMutationRevision+1,updatedAt:audit.at}` without a new backup, audit row, revision, or write.

### Action and Error Contract

| Action family | Exact payload fields; all envelopes also require top-level `deviceId`/`timestamp`, mutations only require `mutationId` | Success reply | Fail-closed errors |
|---|---|---|---|
| `officeOpsList` | exactly `{}` or exactly `{includeArchived:boolean}`; omitted/false excludes tombstones | `{ok:true,store}` | `office-disabled`, `unauthorized`, `stale-request`, `invalid-input`, `unknown-field` |
| `officePilotCreate` / `officePilotUpdate` | create: `idempotencyKey` plus every editable pilot field; update: `pilotId`, `expectedRevision`, and every editable pilot field as a full replacement, never a patch | `{ok:true,id,revision,updatedAt}` | `unknown-field`, `invalid-input`, `revision-conflict`, idempotency errors |
| `officeInspectionCreate` / `officeInspectionUpdate` | create: `idempotencyKey,officeId,complexName,templateId,status,nextDueAt,riskItems,summary,commercialTerms,commercialApproval`; update adds `inspectionId,expectedRevision`; both are full replacement inputs, require `commercialApproval:null`, and cannot supply conversion/server fields | `{ok:true,id,revision,updatedAt}` | `invalid-inspection`, `invalid-conversion-state`, `unknown-field`, `revision-conflict`, idempotency errors |
| `officeOpportunityCreate` / `officeOpportunityUpdate` | create: `idempotencyKey` plus every editable opportunity field; update adds `opportunityId,expectedRevision` and is a full replacement, never a patch | `{ok:true,id,revision,updatedAt}` | `invalid-opportunity`, `unknown-field`, `revision-conflict`, idempotency errors |
| pilot/inspection/opportunity archive or restore | exact record ID, `expectedRevision`, archive additionally `archiveReason` | `{ok:true,id,revision,updatedAt}` | `not-found`, `already-archived`, `not-archived`, `invalid-conversion-state`, `revision-conflict` |
| `officeConsentRecord` / `officeConsentWithdraw` | record: exactly `idempotencyKey,subjectType,subjectId,purpose,intervalMonths,channel,consentVersion,consentTextSnapshot,consentTextSha256,recordedBy,consentedAt,evidenceType,evidenceId`; withdraw: exactly `consentId,expectedRevision,withdrawnBy,withdrawalReason`; server supplies withdrawal time and both audit events | `{ok:true,id,revision,updatedAt}` | `invalid-consent`, `already-withdrawn`, `unknown-field`, `revision-conflict` |
| inspection conversion actions | exact fields in Task 4's conversion table; every action includes `inspectionId`, `conversionId`, and `expectedRevision` | `{ok:true,id,revision,updatedAt}` | `conversion-disabled`, `conversion-identity-conflict`, `invalid-conversion-state`, `receipt-mismatch`, `terms-mismatch`, `revision-conflict` |
| `officeOpsRetentionList` | exactly `{}` | `{ok:true,rows,serverNowKst}` | `office-disabled`, `unauthorized`, `stale-request`, `invalid-input`, `unknown-field` |

Common request errors are `bad-request`, `unauthorized`, `office-disabled`, `conversion-disabled`, `manual-recovery-required`, `recovery-state-unknown`, `stale-request`, `replay-request`, `idempotency-conflict`, `lock-unavailable`, `invalid-store`, `invalid-input`, `unknown-field`, `source-changed`, `backup-verify-failed`, `recovery-arm-failed`, `write-verify-failed`, and `server-error`; domain errors additionally include `conversion-identity-conflict`, `invalid-conversion-state`, and the documented lifecycle errors. An unexpected key returns `unknown-field`; a missing required key or invalid value returns `invalid-input` or the action's narrower domain error. Every request checks the recovery latch before enabled/action dispatch and fails closed while it is `1` or unreadable. No error returns a token, secret, receipt HMAC, evidence file ID, or source bytes.

### Task 1: Scaffold the independent OfficeOps relay and prove strict isolation

**Files:**
- Create: `apps-script-office-ops/appsscript.json`
- Create: `apps-script-office-ops/Code.gs`
- Create: `apps-script-office-ops/OfficeOpsPure.gs`
- Create: `apps-script-office-ops/OfficeOps.gs`
- Create: `apps-script-office-ops/README_APPS_SCRIPT.md`
- Create: `tests/office-ops-server-isolation.check.js`

**Interfaces:**
- Consumes: no existing relay source, token, state, or handler.
- Produces: `ooIsAllowedAction_(action)`, `ooDoPost_(request)`, and source-boundary assertions.

- [ ] **Step 1: Write the failing static isolation test**

```js
const source = ['Code.gs', 'OfficeOpsPure.gs', 'OfficeOps.gs'].map(name =>
  fs.readFileSync(path.join(__dirname, '..', 'apps-script-office-ops', name), 'utf8')).join('\n');
for (const allowed of ['officeOpsList', 'officePilotCreate', 'officeConsentWithdraw', 'officeInspectionFinalizeConversion', 'officeOpportunityRestore', 'officeOpsRetentionList']) {
  assert.equal(source.includes("'" + allowed + "'"), true, allowed + ' is allowlisted');
}
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'officeSetStatus', 'loadData_', 'saveData_', 'serializeData', 'aptOrders', 'MailApp', 'CalendarApp', 'UrlFetchApp', 'getFilesByName', 'APP_TOKEN', 'DATA_FILE_ID', 'OFFICE_INTAKE_FILE_ID', 'COMMERCIAL_APPROVAL_TOKEN', 'commercialNow(', 'commercialApprovalIssue(', 'commercialApprovalVerify(']) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter OfficeOps');
}
assert.match(source, /commercialTerms/);
assert.match(source, /commercialApproval/);
assert.match(source, /conversionReceiptId/);
assert.match(source, /conversionTermsSha256/);
assert.equal(fs.existsSync(path.join(__dirname, '..', 'apps-script-office-ops', 'README_APPS_SCRIPT.md')), true);
```

- [ ] **Step 2: Run the isolation test to verify it fails**

Run: `node tests/office-ops-server-isolation.check.js`

Expected: FAIL because the isolated project and README do not exist.

- [ ] **Step 3: Create the standalone manifest, dispatcher, and action allowlist**

```js
function ooIsAllowedAction_(action) {
  return ['officeOpsList','officePilotCreate','officePilotUpdate','officePilotArchive','officeConsentRecord','officeConsentWithdraw','officeInspectionCreate','officeInspectionUpdate','officeInspectionArchive','officeInspectionBeginConversion','officeInspectionArmLocalCommit','officeInspectionRecordLocalCommit','officeInspectionFinalizeConversion','officeInspectionCancelConversion','officeOpportunityCreate','officeOpportunityUpdate','officeOpportunityArchive','officePilotRestore','officeInspectionRestore','officeOpportunityRestore','officeOpsRetentionList'].indexOf(action) >= 0;
}
function doGet() { return ooOut_(ooFail_('method-not-allowed')); }
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 131072) return ooOut_(ooFail_('bad-request'));
    var request;
    try { request = JSON.parse(raw); }
    catch (error) { if (error && error.name === 'SyntaxError') return ooOut_(ooFail_('bad-request')); throw error; }
    return ooOut_(ooDoPost_(request));
  } catch (_) { return ContentService.createTextOutput('{"ok":false,"error":"server-error"}').setMimeType(ContentService.MimeType.JSON); }
}
```

Set V8 and `Asia/Seoul` in the new manifest. `ooDoPost_` authenticates without logging, then reads `OFFICE_OPS_RECOVERY_REQUIRED` before enabled/action dispatch. A successful property read returning missing/empty/unexpected latch data is the expected unavailable state and returns `manual-recovery-required`; a successful read returning missing/empty/unexpected enabled data returns `office-disabled`; a missing token remains `unauthorized`. A thrown property-access or other runtime exception is not reclassified as one of those expected states and reaches the outer `server-error` boundary. Only a normal `JSON.parse` `SyntaxError` returns `bad-request`; any non-`SyntaxError` parser/runtime exception returns `server-error`. The outer `doPost` boundary catches every unexpected parser, property, dispatch, Drive, lock, and response exception and emits only `{ok:false,error:'server-error'}` without exception text or logging. Do not add public action handlers, `getFilesByName`, legacy property/source access, or reuse either `apps-script/Code.gs` or `apps-script-commercial/`. Write the complete README property, deployment, rollback, and approval-boundary contract required by Task 5; it must state that this is a separate, representative-approved deployment.

- [ ] **Step 4: Run the isolation test to verify it passes**

Run: `node tests/office-ops-server-isolation.check.js`

Expected: PASS and `git diff -- apps-script apps-script-commercial index.html sw.js` is empty.

- [ ] **Step 5: Commit the isolated OfficeOps foundation**

```bash
git add apps-script-office-ops tests/office-ops-server-isolation.check.js
git commit -m "feat: isolate OfficeOps storage from field operations"
```

### Task 2: Implement strict schema, mutation envelope, idempotency, and archive/retention pure rules

**Files:**
- Create: `tests/office-ops-pure.unit.js`
- Modify: `apps-script-office-ops/OfficeOpsPure.gs`

**Interfaces:**
- Consumes: `Utilities.computeDigest`, `Utilities.newBlob`, `Utilities.getUuid`, and an injected `nowKst` parameter; no Drive access.
- Produces: `ooValidateRequestEnvelope_(request, isRead, nowMs)`, `ooParseRequestTimestamp_(value)`, `ooParseKstDateTime_(value)`, `ooValidateStoredFields_(value, required, invalidCode)`, `ooValidateStore_(store)`, `ooValidateAuditRow_(row)`, `ooCanonicalMutation_(action, payload)`, `ooValidateMutationEnvelope_(request, nowMs)`, `ooValidatePilot_(pilot)`, `ooValidatePilotCreate_(payload, nowKst)`, `ooPilotEndsAtKst_(startDateKst)`, `ooValidPilotSource_(source)`, `ooValidateConsentAuditEvent_(event)`, `ooValidateConsent_(consent)`, `ooValidateConsentCreate_(payload, nowKst)`, `ooWithdrawConsent_(consent, withdrawnBy, reason, nowKst)`, `ooNextDueAtKst_(consentedAt, intervalMonths)`, `ooConsentActive_(consent, nowMs)`, `ooDueConsents_(consents, nowMs)`, `ooValidateInspection_(inspection)`, `ooValidateInspectionCreate_(payload, nowKst)`, `ooValidateOpportunity_(opportunity)`, `ooValidateOpportunityCreate_(payload, nowKst)`, `ooOfficialKaptUrl_(value)`, `ooCanOpportunityParticipate_(opportunity, serverNowMs, requestTimestampMs)`, `ooCanonicalCommercialTerms_(terms)`, `ooTermsSha256_(terms)`, `ooValidateApprovalMetadata_(approvalMetadata)`, `ooApprovalProofMatches_(approvalMetadata, payload, termsSha256)`, `ooReceiptId_(approvalMetadata)`, `ooNewRecordId_(kind)`, `ooArchive_(record, actor, reason, nowKst)`, `ooRestore_(record, actor, nowKst)`, `ooRetentionStartedAtFor_(recordType, currentValue, nextState, nowKst)`, `ooAddOneKstYear_(referenceAt)`, `ooRetentionRows_(store, nowMs)`.

- [ ] **Step 1: Write failing strict-schema and lifecycle tests**

```js
const crypto = require('node:crypto');
const empty = { schemaVersion:1, revision:0, updatedAt:'2026-08-31T10:00:00+09:00', pilots:[], consents:[], inspections:[], opportunities:[], audit:[] };
assert.equal(sandbox.ooValidateStore_(empty).ok, true);
assert.equal(sandbox.ooValidateStore_({ ...empty, surprise: true }).error, 'unknown-field');
assert.equal(sandbox.ooValidateStore_({ ...empty, revision: -1 }).error, 'invalid-store');
const exactAudit = { action:'officePilotCreate', result:'ok', id:'pilot_test', mutationId:'550e8400-e29b-41d4-a716-446655440001', idempotencyKey:'create_pilot_123456', payloadSha256:'a'.repeat(64), at:'2026-08-31T10:00:00+09:00', actor:'representative', lifecycleBefore:null, backupFileId:'BACKUP_FILE_0001', backupManifestFileId:'BACKUP_MANIFEST_0001', backupSha256:'b'.repeat(64), preMutationRevision:0 };
assert.equal(sandbox.ooValidateAuditRow_(exactAudit).ok, true);
assert.equal(sandbox.ooValidateAuditRow_({ ...exactAudit, actor:'대표' }).error, 'invalid-audit');
assert.equal(sandbox.ooValidateAuditRow_({ ...exactAudit, surprise:true }).error, 'unknown-field');
const lifecycleAudit = { ...exactAudit, action:'officePilotArchive', idempotencyKey:null, lifecycleBefore:{archivedAt:null,archivedBy:null,archiveReason:null,restoredAt:null} };
assert.equal(sandbox.ooValidateAuditRow_({ ...lifecycleAudit, lifecycleBefore:{...lifecycleAudit.lifecycleBefore,surprise:true} }).error, 'unknown-field');
const lifecycleMissing = {...lifecycleAudit.lifecycleBefore}; delete lifecycleMissing.restoredAt;
assert.equal(sandbox.ooValidateAuditRow_({ ...lifecycleAudit, lifecycleBefore:lifecycleMissing }).error, 'invalid-audit');
const auditMissingActor = {...exactAudit}; delete auditMissingActor.actor;
assert.equal(sandbox.ooValidateAuditRow_(auditMissingActor).error, 'invalid-audit');
const readUtc = { token:'TEST_ONLY_OFFICE_OPS_TOKEN', action:'officeOpsList', deviceId:'550e8400-e29b-41d4-a716-446655440000', timestamp:'2026-08-31T01:00:00.000Z', payload:{} };
assert.equal(sandbox.ooValidateRequestEnvelope_(readUtc, true, Date.parse('2026-08-31T10:05:00+09:00')).ok, true);
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, mutationId:'550e8400-e29b-41d4-a716-446655440001' }, true, Date.parse('2026-08-31T10:05:00+09:00')).error, 'unknown-field');
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, timestamp:'2026-08-31T01:05:01.000Z' }, true, Date.parse('2026-08-31T10:00:00+09:00')).error, 'stale-request');
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, timestamp:'2026-08-31T10:00:00' }, true, Date.parse('2026-08-31T10:00:00+09:00')).error, 'invalid-input');
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, payload:{ includeArchived:true } }, true, Date.parse('2026-08-31T10:00:00+09:00')).ok, true);
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, action:'officeOpsRetentionList', payload:{} }, true, Date.parse('2026-08-31T10:00:00+09:00')).ok, true);
assert.equal(sandbox.ooValidateRequestEnvelope_({ ...readUtc, action:'officeOpsRetentionList', payload:{ includeArchived:false } }, true, Date.parse('2026-08-31T10:00:00+09:00')).error, 'unknown-field');
assert.equal(sandbox.ooValidateMutationEnvelope_({ deviceId:'550e8400-e29b-41d4-a716-446655440000', mutationId:'550e8400-e29b-41d4-a716-446655440001', timestamp:'2026-08-31T10:00:00+09:00' }, Date.parse('2026-08-31T10:03:00+09:00')).ok, true);
assert.equal(sandbox.ooValidateMutationEnvelope_({ deviceId:'550e8400-e29b-41d4-a716-446655440000', mutationId:'550e8400-e29b-41d4-a716-446655440001', timestamp:'2026-08-31T10:00:00+09:00' }, Date.parse('2026-08-31T10:06:00+09:00')).error, 'stale-request');
const pilotCreatePayload = { idempotencyKey:'create_pilot_123456', complexName:'테스트 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T18:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'' };
const { notes, ...pilotMissingNotes } = pilotCreatePayload;
assert.equal(sandbox.ooCanonicalMutation_('officePilotCreate', pilotMissingNotes).error, 'invalid-input');
assert.equal(sandbox.ooCanonicalMutation_('officePilotCreate', { ...pilotCreatePayload, surprise:true }).error, 'unknown-field');
const archived = sandbox.ooArchive_({ pilotId:'pilot_test', archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null }, 'representative', '상담 종료', '2026-08-31T10:00:00+09:00');
assert.deepEqual(archived, { pilotId:'pilot_test', archivedAt:'2026-08-31T10:00:00+09:00', archivedBy:'representative', archiveReason:'상담 종료', restoredAt:null });
const pilot = sandbox.ooValidatePilot_({ pilotId:'pilot_test', complexName:'테스트 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T18:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'', createdAt:'2026-08-31T18:00:00+09:00', updatedAt:'2026-08-31T18:00:00+09:00', retentionStartedAt:null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null });
assert.equal(pilot.ok, true);
assert.equal(sandbox.ooValidatePilot_({ ...pilot.value, source:'email' }).error, 'invalid-pilot');
assert.equal(sandbox.ooValidatePilot_({ ...pilot.value, surprise:true }).error, 'unknown-field');
const pilotMissingStored = {...pilot.value}; delete pilotMissingStored.notes;
assert.equal(sandbox.ooValidatePilot_(pilotMissingStored).error, 'invalid-pilot');
assert.equal(sandbox.ooValidateStore_({ ...empty, pilots:[{...pilot.value,surprise:true}] }).error, 'unknown-field');
assert.equal(sandbox.ooValidateStore_({ ...empty, pilots:[pilotMissingStored] }).error, 'invalid-pilot');
assert.equal(sandbox.ooPilotEndsAtKst_('2026-08-31'), '2026-09-29T23:59:59+09:00');
assert.equal(sandbox.ooPilotEndsAtKst_('2028-02-01'), '2028-03-01T23:59:59+09:00');
assert.equal(sandbox.ooPilotEndsAtKst_('2026-02-30'), '');
const consent = sandbox.ooValidateConsent_({ consentId:'consent_test', subjectType:'aptOrder', subjectId:'order01', purpose:'preventive-reinspection', intervalMonths:6, channel:'phone', consentVersion:'reinspection-v1', consentTextSnapshot:'재점검 연락에 동의합니다.', consentTextSha256:'a'.repeat(64), recordedBy:'대표', consentedAt:'2026-08-31T10:00:00+09:00', withdrawnAt:null, withdrawnBy:null, withdrawalReason:null, nextDueAt:'2027-02-28', lastContactedAt:null, evidenceType:'message', evidenceId:'record_test', audit:[{event:'recorded',at:'2026-08-31T10:00:00+09:00',actor:'대표',reason:null}] });
assert.equal(consent.ok, true);
assert.equal(sandbox.ooNextDueAtKst_('2026-08-31T10:00:00+09:00', 6), '2027-02-28');
assert.equal(sandbox.ooNextDueAtKst_('2028-02-29T10:00:00+09:00', 12), '2029-02-28');
const consentCreatePayload = { idempotencyKey:'create_consent_123456', subjectType:'aptOrder', subjectId:'order01', purpose:'preventive-reinspection', intervalMonths:6, channel:'phone', consentVersion:'reinspection-v1', consentTextSnapshot:'재점검 연락에 동의합니다.', consentTextSha256:'a'.repeat(64), recordedBy:'대표', consentedAt:'2026-08-31T10:00:00+09:00', evidenceType:'message', evidenceId:'record_test' };
assert.equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentedAt:'2026-08-31T10:00:00' }, '2026-08-31T10:00:01+09:00').error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, consentedAt:'2026-02-30T10:00:00+09:00' }, '2026-08-31T10:00:01+09:00').error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsentCreate_({ ...consentCreatePayload, intervalMonths:9 }, '2026-08-31T10:00:01+09:00').error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, intervalMonths:9 }).error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, lastContactedAt:'2026-09-01T10:00:00+09:00' }).error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, audit:[...consent.value.audit, {event:'recorded',at:'2026-09-01T10:00:00+09:00',actor:'대표',reason:null}] }).error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, surprise:true }).error, 'unknown-field');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, audit:[{...consent.value.audit[0],surprise:true}] }).error, 'unknown-field');
const consentMissingStored = {...consent.value}; delete consentMissingStored.evidenceId;
assert.equal(sandbox.ooValidateConsent_(consentMissingStored).error, 'invalid-consent');
assert.equal(sandbox.ooValidateStore_({ ...empty, consents:[{...consent.value,audit:[{...consent.value.audit[0],surprise:true}]}] }).error, 'unknown-field');
const withdrawn = sandbox.ooWithdrawConsent_(consent.value, '대표', '철회', '2026-09-01T10:00:00+09:00');
assert.equal(withdrawn.withdrawnAt, '2026-09-01T10:00:00+09:00');
assert.deepEqual(withdrawn.audit.at(-1), {event:'withdrawn',at:'2026-09-01T10:00:00+09:00',actor:'대표',reason:'철회'});
assert.equal(sandbox.ooWithdrawConsent_(withdrawn, '대표', '다시 철회', '2026-09-02T10:00:00+09:00').error, 'already-withdrawn');
assert.equal(sandbox.ooConsentActive_(withdrawn, Date.parse('2026-09-01T10:00:01+09:00')), false);
assert.deepEqual(sandbox.ooDueConsents_([consent.value, withdrawn], Date.parse('2027-02-28T12:00:00+09:00')).map(x => x.consentId), ['consent_test']);
const consentA = {...consent.value,consentId:'consent_a'}, consentB = {...consent.value,consentId:'consent_b'};
assert.deepEqual(sandbox.ooDueConsents_([consentB,consentA], Date.parse('2027-02-28T12:00:00+09:00')).map(x => x.consentId), ['consent_a','consent_b']);
const inspection = { inspectionId:'inspection_test', officeId:'office_test', complexName:'테스트 단지', templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-02', riskItems:['배수 확인'], summary:'접근 허가 후 점검', commercialTerms:null, commercialApproval:null, conversionId:null, conversionTermsSha256:null, conversionReceiptId:null, pendingOrderId:null, linkedOrderId:null, conversionStartedAt:null, updatedAt:'2026-08-31T10:00:00+09:00', archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null };
assert.equal(sandbox.ooValidateInspection_(inspection).ok, true);
assert.equal(sandbox.ooValidateInspection_({ ...inspection, conversionStartedAt:'2026-08-31T10:00:00+09:00' }).error, 'invalid-inspection');
assert.equal(sandbox.ooValidateInspection_({ ...inspection, surprise:true }).error, 'unknown-field');
const inspectionMissingStored = {...inspection}; delete inspectionMissingStored.summary;
assert.equal(sandbox.ooValidateInspection_(inspectionMissingStored).error, 'invalid-inspection');
const storedTermsWithExtra = {workKind:'preventive-inspection',scope:'배수 점검',exclusions:[],vatMode:'included',quotedAmount:100000,validUntil:'2026-09-30',scheduleWindow:'2026-09-02',surprise:true};
assert.equal(sandbox.ooValidateInspection_({...inspection,commercialTerms:storedTermsWithExtra}).error, 'unknown-field');
const opportunity = { opportunityId:'opp_test', complexName:'테스트 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관', deadlineAt:'2026-09-01T10:00:00+09:00', stage:'review', requirements:['면허 확인'], verifiedBy:'대표', notes:'', retentionStartedAt:null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null };
assert.equal(sandbox.ooValidateOpportunity_({...opportunity,surprise:true}).error, 'unknown-field');
const opportunityMissingStored = {...opportunity}; delete opportunityMissingStored.notes;
assert.equal(sandbox.ooValidateOpportunity_(opportunityMissingStored).error, 'invalid-opportunity');
assert.equal(sandbox.ooCanOpportunityParticipate_(opportunity, Date.parse('2026-08-31T10:05:00+09:00'), Date.parse('2026-08-31T10:00:30+09:00')), true);
assert.equal(sandbox.ooCanOpportunityParticipate_(opportunity, Date.parse('2026-08-31T10:05:01+09:00'), Date.parse('2026-08-31T10:00:00+09:00')), false);
const commercial = sandbox.ooCanonicalCommercialTerms_({ workKind:'device-diagnosis', scope:'  욕실 누수 장비 진단  ', exclusions:['복구 공사','타일'], vatMode:'included', quotedAmount:100000, validUntil:'2026-09-30', scheduleWindow:'  2026-09-02 오후  ' });
const commercialJson = '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}';
assert.equal(commercial.json, commercialJson);
assert.equal(commercial.sha256Hex, crypto.createHash('sha256').update(commercialJson).digest('hex'));
const approvalMetadata = { receiptId:'receipt_test_001', subjectType:'aptOrder', subjectId:'pending_test_001', approvedTermsSha256:commercial.sha256Hex, approvalEvidenceType:'quote-file', approvalEvidenceFileId:'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256:'a'.repeat(64), approvedAt:'2026-08-31T10:00:00+09:00', approvedByRole:'management-office', issuedAt:'2026-08-31T10:00:01+09:00', receiptHmac:'b'.repeat(64) };
assert.equal(sandbox.ooValidateApprovalMetadata_(approvalMetadata).ok, true);
assert.equal(sandbox.ooValidateApprovalMetadata_({ ...approvalMetadata, surprise:true }).error, 'unknown-field');
const approvalMissingHmac = {...approvalMetadata}; delete approvalMissingHmac.receiptHmac;
assert.equal(sandbox.ooValidateApprovalMetadata_(approvalMissingHmac).error, 'invalid-commercial-approval');
const approvedInspection = { ...inspection, status:'conversion-pending', commercialTerms:commercial.value, commercialApproval:approvalMetadata, conversionId:'conversion_test_001', conversionTermsSha256:commercial.sha256Hex, conversionReceiptId:'receipt_test_001', pendingOrderId:'pending_test_001', conversionStartedAt:'2026-08-31T10:00:01+09:00' };
assert.equal(sandbox.ooValidateInspection_({ ...approvedInspection, commercialApproval:{...approvalMetadata,surprise:true} }).error, 'unknown-field');
assert.equal(sandbox.ooValidateInspection_({ ...approvedInspection, commercialApproval:approvalMissingHmac }).error, 'invalid-commercial-approval');
assert.equal(sandbox.ooAddOneKstYear_('2028-02-29T10:00:00+09:00'), '2029-02-28T10:00:00+09:00');
assert.equal(sandbox.ooRetentionStartedAtFor_('pilot', null, 'closed', '2026-08-31T10:00:00+09:00'), '2026-08-31T10:00:00+09:00');
assert.equal(sandbox.ooRetentionStartedAtFor_('pilot', '2026-08-31T10:00:00+09:00', 'closed', '2026-09-01T10:00:00+09:00'), '2026-08-31T10:00:00+09:00');
assert.equal(sandbox.ooRetentionStartedAtFor_('pilot', '2026-08-31T10:00:00+09:00', 'contacted', '2026-09-01T10:00:00+09:00'), null);
assert.equal(sandbox.ooRetentionStartedAtFor_('opportunity', null, 'skip', '2026-08-31T10:00:00+09:00'), '2026-08-31T10:00:00+09:00');
assert.equal(sandbox.ooRetentionStartedAtFor_('opportunity', '2026-08-31T10:00:00+09:00', 'closed', '2026-09-01T10:00:00+09:00'), '2026-08-31T10:00:00+09:00');
assert.equal(sandbox.ooRetentionStartedAtFor_('opportunity', '2026-08-31T10:00:00+09:00', 'review', '2026-09-01T10:00:00+09:00'), null);
const duePilot = { ...pilot.value, stage:'closed', retentionStartedAt:'2026-08-31T10:00:00+09:00' };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[duePilot] }, Date.parse('2027-08-31T09:59:59.999+09:00')), []);
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[duePilot] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'pilot',recordId:'pilot_test',reason:'closed',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const dueSkipOpportunity = { ...opportunity, stage:'skip', retentionStartedAt:'2026-08-31T10:00:00+09:00' };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, opportunities:[dueSkipOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'opportunity',recordId:'opp_test',reason:'skip',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const dueClosedOpportunity = { ...dueSkipOpportunity, stage:'closed' };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, opportunities:[dueClosedOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'opportunity',recordId:'opp_test',reason:'closed',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const archivedDuePilot = { ...duePilot, archivedAt:'2026-09-01T10:00:00+09:00', archivedBy:'representative', archiveReason:'정리', restoredAt:null };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[archivedDuePilot] }, Date.parse('2027-09-01T10:00:00+09:00')), [{recordType:'pilot',recordId:'pilot_test',reason:'archived',referenceAt:'2026-09-01T10:00:00+09:00',eligibleAt:'2027-09-01T10:00:00+09:00'}]);
const archivedInspection = { ...inspection, archivedAt:'2026-08-31T10:00:00+09:00', archivedBy:'representative', archiveReason:'정리', restoredAt:null };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, inspections:[archivedInspection] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'inspection',recordId:'inspection_test',reason:'archived',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const archivedOpportunity = { ...opportunity, archivedAt:'2026-08-31T10:00:00+09:00', archivedBy:'representative', archiveReason:'정리', restoredAt:null };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, opportunities:[archivedOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'opportunity',recordId:'opp_test',reason:'archived',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const withdrawnAtBoundary = { ...withdrawn, withdrawnAt:'2026-08-31T10:00:00+09:00', audit:[withdrawn.audit[0],{event:'withdrawn',at:'2026-08-31T10:00:00+09:00',actor:'대표',reason:'철회'}] };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, consents:[withdrawnAtBoundary] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'consent',recordId:'consent_test',reason:'withdrawn',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const restoredTerminal = { ...archivedDuePilot, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:'2027-08-30T10:00:00+09:00' };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[restoredTerminal] }, Date.parse('2027-08-31T10:00:00+09:00'))[0].reason, 'closed');
const ordered = sandbox.ooRetentionRows_({ ...empty, pilots:[duePilot], consents:[{...withdrawnAtBoundary,consentId:'consent_b'},{...withdrawnAtBoundary,consentId:'consent_a'}], inspections:[archivedInspection], opportunities:[archivedOpportunity] }, Date.parse('2027-08-31T10:00:00+09:00'));
assert.deepEqual(ordered.map(row => [row.eligibleAt,row.recordType,row.recordId]), [
  ['2027-08-31T10:00:00+09:00','consent','consent_a'],
  ['2027-08-31T10:00:00+09:00','consent','consent_b'],
  ['2027-08-31T10:00:00+09:00','inspection','inspection_test'],
  ['2027-08-31T10:00:00+09:00','opportunity','opp_test'],
  ['2027-08-31T10:00:00+09:00','pilot','pilot_test']
]);
```

Add exact-envelope tests before the domain cases. Reads accept only `token,action,deviceId,timestamp,payload`, reject `mutationId`, and apply the same five-minute freshness rule as mutations. `officeOpsList` accepts exactly `{}` or `{includeArchived:boolean}`; `officeOpsRetentionList` accepts exactly `{}`. Mutations require those five fields plus a fresh `mutationId`. Both reject `ts`, unknown keys, invalid calendar/clock/offset strings, a timestamp without a zone, IDs under 16 or over 100 characters, and stale timestamps. Test browser UUIDs and `new Date().toISOString()` output.

Use these exact stored field sets; every missing field is a domain `invalid-*` error and every extra field is `unknown-field`:

| Record | Exact stored fields |
|---|---|
| pilot | `pilotId,complexName,source,stage,pilotStartedAt,pilotEndsAt,extensionApprovedAt,nextActionAt,owner,notes,createdAt,updatedAt,retentionStartedAt,archivedAt,archivedBy,archiveReason,restoredAt` |
| consent | `consentId,subjectType,subjectId,purpose,intervalMonths,channel,consentVersion,consentTextSnapshot,consentTextSha256,recordedBy,consentedAt,withdrawnAt,withdrawnBy,withdrawalReason,nextDueAt,lastContactedAt,evidenceType,evidenceId,audit` |
| inspection | `inspectionId,officeId,complexName,templateId,status,nextDueAt,riskItems,summary,commercialTerms,commercialApproval,conversionId,conversionTermsSha256,conversionReceiptId,pendingOrderId,linkedOrderId,conversionStartedAt,updatedAt,archivedAt,archivedBy,archiveReason,restoredAt` |
| opportunity | `opportunityId,complexName,officialUrl,observedAt,region,category,deadlineAt,stage,requirements,verifiedBy,notes,retentionStartedAt,archivedAt,archivedBy,archiveReason,restoredAt` |

Pilot IDs match `^pilot_[A-Za-z0-9_-]{1,100}$`, consent IDs `^consent_[A-Za-z0-9_-]{1,100}$`, inspection IDs `^inspection_[A-Za-z0-9_-]{1,100}$`, opportunity IDs `^opp_[A-Za-z0-9_-]{1,100}$`, office IDs `^office_[A-Za-z0-9_-]{1,100}$`, template IDs `^[A-Za-z0-9_-]{1,80}$`, and consent evidence IDs `^[A-Za-z0-9_-]{1,200}$`. Commercial subject/order/conversion IDs match `^[A-Za-z0-9_-]{1,160}$`, deliberately accepting both the current seven-character `uid()` values and future UUIDs. Duplicate IDs across any collection fail the entire store.

Pilot records use `stage`, never `status`, accept `source` exactly `website|phone|referral|kapt`, and accept `stage` exactly `new|contacted|meeting|pilot|converted|closed`. Both `ooValidatePilot_` and every pilot action validator call `ooValidPilotSource_`; no other source is normalized or silently accepted. `pilotStartedAt` and `pilotEndsAt` are either both null or valid KST datetimes; `pilot` requires both. Without an extension, the end equals the start KST calendar date plus 30 calendar days minus one second. An extended end requires `extensionApprovedAt` and must be later than the normal end. `retentionStartedAt` is server-generated on first entry to `closed`, is preserved while closed, and is null outside closed.

Consent `audit` rows are exactly `{event,at,actor,reason}`. `event` is `recorded|withdrawn`; recorded uses `reason:null`, withdrawal uses its bounded reason. Require `purpose==='preventive-reinspection'`, `subjectType==='project'|'aptOrder'`, `intervalMonths===6|12`, `channel==='sms'|'phone'|'kakao'`, `consentVersion==='reinspection-v1'`, a lower-case 64-hex text hash, and `evidenceType==='signed-document'|'message'|'recorded-call-note'`. The first audit row is exactly `{event:'recorded',at:<server create KST>,actor:recordedBy,reason:null}`. An active consent has all three withdrawal fields null and exactly that one audit row; a withdrawn consent has non-null `withdrawnAt,withdrawnBy,withdrawalReason` and exactly one additional final row `{event:'withdrawn',at:withdrawnAt,actor:withdrawnBy,reason:withdrawalReason}`. `ooValidateConsent_` requires `lastContactedAt===null` for every current-schema row. Create forces `withdrawn*` and `lastContactedAt` to null and appends the recorded event. `ooWithdrawConsent_` rejects caller-supplied `withdrawnAt`, uses server KST, appends the withdrawal event, immediately makes the consent inactive, and removes it from `ooDueConsents_`. Due rows are active consents with `nextDueAt` on or before the server KST date, sorted by `nextDueAt,consentId`. There is no contact-record mutation in this release, so `lastContactedAt` stays null and no automatic send is added.

Inspection create and ordinary update accept only `planned|checked|proposal|closed`, require `commercialApproval:null`, and require every conversion identity field including `conversionStartedAt` to remain server-owned null. `commercialTerms` may be null or an exact valid commercial term object. Ordinary update is rejected in `conversion-pending|conversion-writing|conversion-local-committed|converted` and cannot directly create a conversion state. The conversion state validator requires: pending/writing have full terms, the full signed approval metadata, conversion/order/receipt/hash IDs and `conversionStartedAt`, but null `linkedOrderId`; local-committed/converted additionally require `linkedOrderId===pendingOrderId`. A normal `closed` row has no conversion identity. Begin is the only action that can atomically attach approval and populate conversion identity.

Opportunity stages are exactly `watch|review|participate|skip|closed`. `retentionStartedAt` is server-generated on first entry to `skip|closed`, preserved while that terminal state remains, and null outside those stages. Test exact K-apt HTTPS host, no custom port or userinfo, fragment removal while query survives, required observed/verified/deadline fields, equality/past-deadline rejection for participation, and device/server time difference `<= 5 * 60 * 1000`. Also test 100-character complex-name, 2,000-character notes/summary, at most 20 ordered `riskItems`/`requirements`, and 200-character item limits.

`ooValidatePilot_` and `ooValidateConsent_` validate normalized stored rows only, after the server assigns `pilotId`/`consentId`, timestamps, tombstones, and audit array. `ooValidatePilotCreate_` and `ooValidateConsentCreate_` validate the corresponding network payloads: they reject caller-supplied record IDs and then construct the normalized row before passing it to the stored-row validator. This keeps server-generated IDs compatible with exact-key validation and the canonical action maps.

`ooValidateInspection_` and `ooValidateOpportunity_` likewise validate only normalized stored rows. Their create helpers reject caller IDs and every server-owned timestamp, tombstone, retention, and conversion field. Every stored-row and nested stored-object validator must call `ooValidateStoredFields_` before value checks. An extra key returns `unknown-field`; a missing key, non-object, or invalid value returns that validator's domain code (`invalid-pilot|invalid-consent|invalid-inspection|invalid-opportunity|invalid-audit|invalid-commercial-approval`). `ooValidateStore_` returns the first nested failure unchanged instead of collapsing it to `invalid-store`. For stored `commercialTerms` and `commercialApproval`, check extra keys before invoking the canonical/domain validator; successful commercial normalization remains byte-identical to the actual commercial relay. Consent audit events and audit `lifecycleBefore` use the same error distinction. Pilot, inspection, and opportunity updates are exact full replacements of all client-editable business fields plus the record ID and `expectedRevision`; they are not partial patches. The server preserves or recalculates all server-owned fields. At the network boundary, a missing editable field returns `invalid-input`; an extra field returns `unknown-field`.

- [ ] **Step 2: Run the pure test to verify it fails**

Run: `node tests/office-ops-pure.unit.js`

Expected: FAIL with undefined OfficeOps pure helpers.

- [ ] **Step 3: Implement exact validators and canonical mutation hash**

```js
var OO_CANONICAL_FIELDS_ = {
  officePilotCreate:['idempotencyKey','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'],
  officePilotUpdate:['pilotId','expectedRevision','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'],
  officePilotArchive:['pilotId','expectedRevision','archiveReason'],
  officePilotRestore:['pilotId','expectedRevision'],
  officeConsentRecord:['idempotencyKey','subjectType','subjectId','purpose','intervalMonths','channel','consentVersion','consentTextSnapshot','consentTextSha256','recordedBy','consentedAt','evidenceType','evidenceId'],
  officeConsentWithdraw:['consentId','expectedRevision','withdrawnBy','withdrawalReason'],
  officeInspectionCreate:['idempotencyKey','officeId','complexName','templateId','status','nextDueAt','riskItems','summary','commercialTerms','commercialApproval'],
  officeInspectionUpdate:['inspectionId','expectedRevision','officeId','complexName','templateId','status','nextDueAt','riskItems','summary','commercialTerms','commercialApproval'],
  officeInspectionArchive:['inspectionId','expectedRevision','archiveReason'],
  officeInspectionBeginConversion:['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','commercialTerms','commercialApproval','expectedRevision'],
  officeInspectionArmLocalCommit:['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionRecordLocalCommit:['inspectionId','conversionId','pendingOrderId','linkedOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionFinalizeConversion:['inspectionId','conversionId','pendingOrderId','linkedOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','expectedRevision'],
  officeInspectionCancelConversion:['inspectionId','conversionId','expectedRevision'],
  officeInspectionRestore:['inspectionId','expectedRevision'],
  officeOpportunityCreate:['idempotencyKey','complexName','officialUrl','observedAt','region','category','deadlineAt','stage','requirements','verifiedBy','notes'],
  officeOpportunityUpdate:['opportunityId','expectedRevision','complexName','officialUrl','observedAt','region','category','deadlineAt','stage','requirements','verifiedBy','notes'],
  officeOpportunityArchive:['opportunityId','expectedRevision','archiveReason'],
  officeOpportunityRestore:['opportunityId','expectedRevision']
};
var OO_TERMS_FIELDS_ = ['workKind','scope','exclusions','vatMode','quotedAmount','validUntil','scheduleWindow'];
var OO_APPROVAL_META_FIELDS_ = ['receiptId','subjectType','subjectId','approvedTermsSha256','approvalEvidenceType','approvalEvidenceFileId','approvalEvidenceSha256','approvedAt','approvedByRole','issuedAt','receiptHmac'];
function ooParseRequestTimestamp_(value) {
  if (typeof value !== 'string') return null;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  var year=Number(match[1]), month=Number(match[2]), day=Number(match[3]), hour=Number(match[4]), minute=Number(match[5]), second=Number(match[6]);
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
function ooValidatePayloadFields_(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ooFail_('invalid-input');
  var keys = Object.keys(value);
  if (keys.some(function(key) { return required.indexOf(key) < 0; })) return ooFail_('unknown-field');
  if (required.some(function(key) { return !Object.prototype.hasOwnProperty.call(value, key); })) return ooFail_('invalid-input');
  return { ok:true };
}
function ooValidateStoredFields_(value, required, invalidCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ooFail_(invalidCode);
  var keys = Object.keys(value);
  if (keys.some(function(key) { return required.indexOf(key) < 0; })) return ooFail_('unknown-field');
  if (required.some(function(key) { return !Object.prototype.hasOwnProperty.call(value, key); })) return ooFail_(invalidCode);
  return { ok:true };
}
function ooCanonicalNested_(fields, value) {
  var out = {}; fields.forEach(function(key) { out[key] = value[key]; }); return out;
}
function ooCanonicalMutation_(action, payload) {
  var fields = OO_CANONICAL_FIELDS_[action];
  if (!fields) return ooFail_('bad-request');
  var keys = ooValidatePayloadFields_(payload, fields); if (!keys.ok) return keys;
  var value = ooValidateActionPayload_(action, payload, fields); if (!value.ok) return value;
  var body = {}; fields.forEach(function(key) { body[key] = value.value[key]; });
  if (body.commercialTerms) {
    var terms = ooCanonicalCommercialTerms_(body.commercialTerms);
    if (!terms.ok) return terms;
    body.commercialTerms = terms.value;
  }
  if (body.commercialApproval) body.commercialApproval = ooCanonicalNested_(OO_APPROVAL_META_FIELDS_, body.commercialApproval);
  var json = JSON.stringify({ action:action, payload:body });
  return { ok:true, json:json, sha256Hex:ooSha256Hex_(json) };
}
function ooArchive_(record, actor, reason, nowKst) {
  if (record.archivedAt) return ooFail_('already-archived');
  record.archivedAt = nowKst; record.archivedBy = actor; record.archiveReason = reason; record.restoredAt = null;
  return record;
}
function ooRestore_(record, actor, nowKst) {
  if (!record.archivedAt) return ooFail_('not-archived');
  record.archivedAt = null; record.archivedBy = null; record.archiveReason = null; record.restoredAt = nowKst;
  return record;
}
function ooNextDueAtKst_(consentedAt, intervalMonths) {
  var start = ooKstDateParts_(consentedAt), targetMonth = start.month - 1 + intervalMonths;
  var year = start.year + Math.floor(targetMonth / 12), month = (targetMonth % 12) + 1;
  return ooKstDate_(year, month, Math.min(start.day, ooDaysInMonth_(year, month)));
}
function ooPilotEndsAtKst_(startDateKst) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateKst || '');
  if (!match) return '';
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  var calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return '';
  var startMs = Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
  return Utilities.formatDate(new Date(startMs + 30 * 86400000 - 1000), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function ooValidPilotSource_(source) {
  return ['website','phone','referral','kapt'].indexOf(source) >= 0;
}
function ooValidateConsentAuditEvent_(value) {
  var fields = ooValidateStoredFields_(value, ['event','at','actor','reason'], 'invalid-consent'); if (!fields.ok) return fields;
  if (['recorded','withdrawn'].indexOf(value.event) < 0 || ooParseKstDateTime_(value.at) === null ||
      typeof value.actor !== 'string' || !value.actor || value.actor.length > 100 ||
      (value.event === 'recorded' ? value.reason !== null : typeof value.reason !== 'string' || !value.reason || value.reason.length > 500)) return ooFail_('invalid-consent');
  return { ok:true };
}
function ooValidateConsent_(value) {
  var required = ['consentId','subjectType','subjectId','purpose','intervalMonths','channel','consentVersion','consentTextSnapshot','consentTextSha256','recordedBy','consentedAt','withdrawnAt','withdrawnBy','withdrawalReason','nextDueAt','lastContactedAt','evidenceType','evidenceId','audit'];
  var fields = ooValidateStoredFields_(value, required, 'invalid-consent'); if (!fields.ok) return fields;
  if (!/^consent_[A-Za-z0-9_-]{1,100}$/.test(value.consentId || '') || ['project','aptOrder'].indexOf(value.subjectType) < 0 || !/^[A-Za-z0-9_-]{1,160}$/.test(value.subjectId || '') || value.purpose !== 'preventive-reinspection' || [6,12].indexOf(value.intervalMonths) < 0 || ['sms','phone','kakao'].indexOf(value.channel) < 0 || value.consentVersion !== 'reinspection-v1' || typeof value.consentTextSnapshot !== 'string' || !value.consentTextSnapshot || !/^[0-9a-f]{64}$/.test(value.consentTextSha256 || '') || typeof value.recordedBy !== 'string' || !value.recordedBy || ooParseKstDateTime_(value.consentedAt) === null || value.nextDueAt !== ooNextDueAtKst_(value.consentedAt, value.intervalMonths) || value.lastContactedAt !== null || ['signed-document','message','recorded-call-note'].indexOf(value.evidenceType) < 0 || !/^[A-Za-z0-9_-]{1,200}$/.test(value.evidenceId || '') || !Array.isArray(value.audit) || !value.audit.length) return ooFail_('invalid-consent');
  for (var i = 0; i < value.audit.length; i++) { var event = ooValidateConsentAuditEvent_(value.audit[i]); if (!event.ok) return event; }
  var first = value.audit[0], last = value.audit[value.audit.length - 1];
  if (first.event !== 'recorded' || first.actor !== value.recordedBy || first.reason !== null) return ooFail_('invalid-consent');
  var active = value.withdrawnAt === null && value.withdrawnBy === null && value.withdrawalReason === null;
  var withdrawn = ooParseKstDateTime_(value.withdrawnAt) !== null && typeof value.withdrawnBy === 'string' && !!value.withdrawnBy && typeof value.withdrawalReason === 'string' && !!value.withdrawalReason;
  if ((!active && !withdrawn) || (active && value.audit.length !== 1) ||
      (withdrawn && (value.audit.length !== 2 || last.event !== 'withdrawn' || last.at !== value.withdrawnAt || last.actor !== value.withdrawnBy || last.reason !== value.withdrawalReason))) return ooFail_('invalid-consent');
  return { ok:true, value:value };
}
function ooValidateConsentCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officeConsentRecord); if (!keys.ok) return keys;
  if (ooParseKstDateTime_(payload.consentedAt) === null || [6,12].indexOf(payload.intervalMonths) < 0) return ooFail_('invalid-consent');
  var nextDueAt = ooNextDueAtKst_(payload.consentedAt, payload.intervalMonths);
  return ooValidateConsent_({ consentId:'consent_normalized_for_validation', subjectType:payload.subjectType, subjectId:payload.subjectId, purpose:payload.purpose, intervalMonths:payload.intervalMonths, channel:payload.channel, consentVersion:payload.consentVersion, consentTextSnapshot:payload.consentTextSnapshot, consentTextSha256:payload.consentTextSha256, recordedBy:payload.recordedBy, consentedAt:payload.consentedAt, withdrawnAt:null, withdrawnBy:null, withdrawalReason:null, nextDueAt:nextDueAt, lastContactedAt:null, evidenceType:payload.evidenceType, evidenceId:payload.evidenceId, audit:[{event:'recorded',at:nowKst,actor:payload.recordedBy,reason:null}] });
}
function ooValidatePilotCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officePilotCreate); if (!keys.ok) return keys;
  if (!ooValidPilotSource_(payload.source)) return ooFail_('invalid-pilot');
  return ooValidatePilot_({ pilotId:'pilot_normalized_for_validation', complexName:payload.complexName, source:payload.source, stage:payload.stage, pilotStartedAt:payload.pilotStartedAt, pilotEndsAt:payload.pilotEndsAt, extensionApprovedAt:payload.extensionApprovedAt, nextActionAt:payload.nextActionAt, owner:payload.owner, notes:payload.notes, createdAt:nowKst, updatedAt:nowKst, retentionStartedAt:payload.stage === 'closed' ? nowKst : null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null });
}
function ooRetentionStartedAtFor_(recordType, currentValue, nextState, nowKst) {
  var terminal = recordType === 'pilot' ? nextState === 'closed' : recordType === 'opportunity' ? ['skip','closed'].indexOf(nextState) >= 0 : false;
  return terminal ? (currentValue || nowKst) : null;
}
function ooCanonicalCommercialTerms_(terms) {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms) || !ooExactKeys_(terms, OO_TERMS_FIELDS_)) return ooFail_('invalid-terms');
  var value = { workKind:String(terms.workKind || ''), scope:String(terms.scope || '').replace(/^\s+|\s+$/g, ''), exclusions:Array.isArray(terms.exclusions) ? terms.exclusions.map(String) : null, vatMode:String(terms.vatMode || ''), quotedAmount:Number(terms.quotedAmount), validUntil:String(terms.validUntil || ''), scheduleWindow:String(terms.scheduleWindow || '').replace(/^\s+|\s+$/g, '') };
  if (['device-diagnosis','dispatch','repair','preventive-inspection'].indexOf(value.workKind) < 0 || !value.scope || !value.exclusions || ['included','excluded'].indexOf(value.vatMode) < 0 || !Number.isInteger(value.quotedAmount) || value.quotedAmount < 1 || !ooIsIsoDate_(value.validUntil) || !value.scheduleWindow) return ooFail_('invalid-terms');
  var json = JSON.stringify(value);
  return { ok:true, value:value, json:json, sha256Hex:ooSha256Hex_(json) };
}
function ooTermsSha256_(terms) {
  var canonical = ooCanonicalCommercialTerms_(terms);
  return canonical.ok ? canonical.sha256Hex : '';
}
function ooReceiptId_(approvalMetadata) {
  if (!ooValidateApprovalMetadata_(approvalMetadata).ok) return '';
  return approvalMetadata.receiptId;
}
function ooValidateApprovalMetadata_(value) {
  var fields = ooValidateStoredFields_(value, OO_APPROVAL_META_FIELDS_, 'invalid-commercial-approval'); if (!fields.ok) return fields;
  if (!/^receipt_[A-Za-z0-9_-]{1,80}$/.test(value.receiptId || '') ||
      value.subjectType !== 'aptOrder' || !/^[A-Za-z0-9_-]{1,160}$/.test(value.subjectId || '') ||
      !/^[a-f0-9]{64}$/.test(value.approvedTermsSha256 || '') ||
      ['quote-file','contract-file','message-export-file'].indexOf(value.approvalEvidenceType) < 0 ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(value.approvalEvidenceFileId || '') ||
      !/^[a-f0-9]{64}$/.test(value.approvalEvidenceSha256 || '') || ooParseKstDateTime_(value.approvedAt) === null ||
      ['customer','management-office'].indexOf(value.approvedByRole) < 0 || ooParseKstDateTime_(value.issuedAt) === null || Date.parse(value.issuedAt) < Date.parse(value.approvedAt) ||
      !/^[a-f0-9]{64}$/.test(value.receiptHmac || '')) return ooFail_('invalid-commercial-approval');
  return { ok:true, value:value };
}
function ooApprovalProofMatches_(approvalMetadata, payload, termsSha256) {
  return ooValidateApprovalMetadata_(approvalMetadata).ok && ooReceiptId_(approvalMetadata) === payload.receiptId && approvalMetadata.subjectType === 'aptOrder' && approvalMetadata.subjectId === payload.pendingOrderId && approvalMetadata.approvedTermsSha256 === termsSha256 && payload.receiptSubjectType === 'aptOrder' && payload.receiptSubjectId === payload.pendingOrderId;
}
function ooOfficialKaptUrl_(value) {
  var raw = String(value || '').trim();
  var hash = raw.indexOf('#');
  if (hash >= 0) raw = raw.slice(0, hash);
  return /^https:\/\/(?:www\.)?k-apt\.go\.kr(?:\/[^?#]*)?(?:\?[^#]*)?$/.test(raw) ? raw : '';
}
function ooCanOpportunityParticipate_(opportunity, serverNowMs, requestTimestampMs) {
  if (!ooValidateOpportunity_(opportunity).ok || Math.abs(serverNowMs - requestTimestampMs) > 5 * 60 * 1000) return false;
  return Date.parse(opportunity.deadlineAt) > serverNowMs;
}
```

`ooCanonicalCommercialTerms_` must be golden-tested against the actual `apps-script-commercial/CommercialApprovalPure.gs` contract. It preserves the exact seven-field order, trims only the outer whitespace of `scope` and `scheduleWindow`, converts ordered exclusions with `map(String)` without sorting, converts the amount with `Number`, and uses the same date validation. For the sample in `tests/commercial-approval.unit.js`, OfficeOps must produce the byte-identical JSON and lower-case SHA-256. Do not tighten or loosen this canonicalization independently; a divergence makes a valid signed receipt unusable.

`commercialApproval` canonicalization preserves exactly the eleven signed fields `receiptId,subjectType,subjectId,approvedTermsSha256,approvalEvidenceType,approvalEvidenceFileId,approvalEvidenceSha256,approvedAt,approvedByRole,issuedAt,receiptHmac` so conversion recovery can send the same immutable receipt back to the separate commercial relay for verification. `ooValidateApprovalMetadata_` first calls `ooValidateStoredFields_(value,OO_APPROVAL_META_FIELDS_,'invalid-commercial-approval')`, so any extra signed-field key returns `unknown-field`, while a missing or malformed signed field returns `invalid-commercial-approval`; `ooValidateInspection_`, `ooValidateStore_`, and `officeInspectionBeginConversion` propagate that exact nested error unchanged. The value validator mirrors `caIsReceipt_(receipt,true)`: receipt suffix 1–80 characters, subject ID 1–160, evidence ID 1–200, lower-case 64-hex hashes/HMAC, exact enums, real whole-second KST datetimes, and `issuedAt>=approvedAt`. OfficeOps stores no evidence bytes and no secret HMAC key; `receiptHmac` is the signed receipt value, not the signing key. Cryptographic HMAC, current evidence-file hash, expiry, and trusted-time verification remain the separate commercial relay/local paid-work gate's responsibility and are a hard precondition to conversion.

Store audit rows use the exact global shape defined above. `ooValidateAuditRow_` requires `result==='ok'`, a valid mutation ID, create-only `idempotencyKey` or null, lower-case payload/backup SHA-256, whole-second KST `at`, `actor==='representative'`, nonempty immutable backup IDs, nonnegative `preMutationRevision`, and `lifecycleBefore===null` or the exact four tombstone fields. Archive/restore record only previous tombstone metadata; arbitrary notes, full payloads, and receipts never enter audit.

`ooRetentionRows_` returns exact rows `{recordType,recordId,reason,referenceAt,eligibleAt}`. `recordType` is exactly `pilot|consent|inspection|opportunity`; `reason` is exactly `archived|closed|skip|withdrawn` and must be legal for that record type. It uses `archivedAt` first for any archived pilot/inspection/opportunity; otherwise it uses pilot `retentionStartedAt` with reason `closed`, consent `withdrawnAt` with reason `withdrawn`, and opportunity `retentionStartedAt` with its current `skip|closed` stage as reason. Pilot/opportunity create and full-replacement update handlers use `ooRetentionStartedAtFor_` exclusively so entry sets server `nowKst`, terminal-to-terminal transition preserves the original value, and exit clears it. Thus `referenceAt` is exactly the selected stored timestamp, not a recalculated close time. Archive wins rather than returning duplicate reasons. `eligibleAt` is one KST calendar year after `referenceAt` with February 29 falling back to February 28; include equality and sort by `eligibleAt,recordType,recordId`. Restore removes the archive reason, and a still-terminal restored row may independently qualify from its preserved terminal `retentionStartedAt`. No deletion is performed.

Use explicit per-record and per-action allowlists, never silently drop unknown fields, and compute server-owned dates from KST. `ooPilotEndsAtKst_` validates the input as a real ISO calendar date before date arithmetic and returns `''` for malformed or impossible dates; pilot validators treat that as `invalid-pilot`. `ooValidateConsentCreate_` must validate `consentedAt` with `ooParseKstDateTime_` and `intervalMonths` as exact `6|12` before invoking `ooNextDueAtKst_`; the due helper never receives unvalidated create input. Consent withdrawal accepts no caller-supplied `withdrawnAt`; the server records `ooNowKst_()`. Nested records use fixed documented key order rather than runtime object sorting; `consentTextSnapshot` and ordered arrays retain their original order. Reject unknown `action` before canonicalization. Do not add a consent-contact action, automatic messaging, generic patch API, permanent deletion, employee roles, or any twenty-second action; the exact 21-action allowlist remains unchanged.

- [ ] **Step 4: Run the pure tests and execute a mutation-proof check**

Run: `node tests/office-ops-pure.unit.js`

Expected: PASS.

Temporarily remove the unknown-top-level check from `ooValidateStore_`, rerun the suite, and confirm the `surprise` test fails. Restore the guard. Then temporarily replace `ooCanonicalCommercialTerms_` with unordered/raw `JSON.stringify(terms)`, rerun the golden parity test, and confirm it fails before restoring the exact commercial normalization.

- [ ] **Step 5: Commit the strict data contract**

```bash
git add apps-script-office-ops/OfficeOpsPure.gs tests/office-ops-pure.unit.js
git commit -m "feat: reject unsafe OfficeOps mutations before storage"
```

### Task 3: Implement exact-file storage, locking, idempotency, and verified byte backups

**Files:**
- Create: `tests/office-ops-server.unit.js`
- Modify: `apps-script-office-ops/OfficeOps.gs`
- Modify: `apps-script-office-ops/Code.gs`

**Interfaces:**
- Consumes: pure helpers; `DriveApp.getFileById`, `Utilities.newBlob`, `Utilities.formatDate`, `LockService.getScriptLock`, and Script Properties injected by tests.
- Produces: exact one-argument `ooDispatch_(request)`; `ooDispatchRead_(request,requestNowMs)`; `ooMutate_(request,requestNowMs)`; `ooMutateLocked_(request,requestNowMs)`; `ooRecheckLockedGates_(token)`; `ooSourceFile_()`; `ooReadStore_(sourceFile)`; `ooValidateAuditHistory_(store)`; `ooValidateExpectedRevisionInsideLock_(request,revision)`; `ooBackupPair_(sourceFile,loaded,mutationNowMs)`; `ooRereadExactPair_(source,parent,backup,manifestFile,backupName,manifestName)`; `ooRecheckLoadedSource_(source,loaded)`; `ooArmRecoveryLatch_()`; `ooWritePrepared_(source,loaded,prepared,backup,mutationNowKst)`; `ooRestoreSourceAfterFailedWrite_(source,loaded,backup)`; `ooClearRecoveryLatch_()`; `ooVerifiedRetentionPairs_(sourceFile,currentPair)`; byte/hash/KST formatting utilities; and the editor-only zero-argument `ooRecoveryValidateSource_()`. Task 3 wires only the shared dispatcher/storage boundary, `officeOpsList`, `officeOpsRetentionList`, and `officePilotCreate` needed to prove one complete read/create path; Task 4 owns the remaining eighteen mutation handlers without changing the 21-action allowlist. `ooMutate_` supplies the only actor value, exact server-owned `'representative'`; no request can choose it.

Task 3 also produces the exact production gate `function ooConversionOperationallyEnabled_(){return false;}`. `ooIsConversionAction_` returns true for exactly `officeInspectionBeginConversion|officeInspectionArmLocalCommit|officeInspectionRecordLocalCommit|officeInspectionFinalizeConversion|officeInspectionCancelConversion` and false for all other/unknown strings. The gate is a code constant, not a fifth Script Property or a public action; tests may inject a `true` implementation only inside the fake server sandbox.

- [ ] **Step 1: Write failing server tests with fake Apps Script dependencies**

```js
const properties = {
  OFFICE_OPS_ENABLED:'1', OFFICE_OPS_RECOVERY_REQUIRED:'0', OFFICE_OPS_TOKEN:'TEST_ONLY_OFFICE_OPS_TOKEN', OFFICE_OPS_FILE_ID:'TEST_OFFICE_OPS_FILE'
};
const listed = postRead('officeOpsList', {});
assert.deepEqual(Object.keys(listed), ['ok','store']);
const retention = postRead('officeOpsRetentionList', {});
assert.deepEqual(Object.keys(retention), ['ok','rows','serverNowKst']);
const pilotPayload = { idempotencyKey:'create_pilot_123456', complexName:'테스트 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T09:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'' };
const first = post('officePilotCreate', pilotPayload);
assert.equal(first.ok, true);
assert.deepEqual(Object.keys(first), ['ok','id','revision','updatedAt']);
const retried = post('officePilotCreate', pilotPayload);
assert.deepEqual(retried, first);
assert.equal(post('officePilotCreate', { ...pilotPayload, complexName:'다른 단지' }).error, 'idempotency-conflict');
assert.equal(postWithMutationId(firstMutationId, 'officePilotCreate', firstPayload).error, 'replay-request');
assert.equal(postAt('2026-08-31T09:54:59+09:00', 'officePilotCreate', newPayload).error, 'stale-request');
assert.equal(drive.files.filter(file => /_백업_.*\.json$/.test(file.name)).length, 1);
assert.equal(drive.files.filter(file => /_백업_.*\.manifest\.json$/.test(file.name)).length, 1);
```

The fake Drive file must hold raw bytes, immutable IDs, parent IDs, MIME type, trashed state, and returned `getId()` values; distinguish source/update/backup/manifest reads; support invalid UTF-8; inject backup copy, manifest creation, pair re-read, source write, restore, retention-trash, and property failures; and provide `setTrashed`. The fake lock separately injects `getScriptLock`, `tryLock`, and `releaseLock` exceptions and records acquisition/release counts. The fake clock counts dispatcher request-time calls and mutation-time calls independently. Add assertions that every failed backup leaves source bytes and revision exactly unchanged.

- [ ] **Step 2: Run the server test to verify it fails**

Run: `node tests/office-ops-server.unit.js`

Expected: FAIL because there is no exact-ID store, lock, idempotency, or verified backup implementation.

- [ ] **Step 3: Implement store validation and locked mutation sequence**

```js
function ooDispatch_(request) {
  var requestNowMs = ooNowMs_();
  var isRead = request && (request.action === 'officeOpsList' || request.action === 'officeOpsRetentionList');
  var envelope = ooValidateRequestEnvelope_(request, isRead, requestNowMs); if (!envelope.ok) return envelope;
  if (isRead) return ooDispatchRead_(request, requestNowMs);
  return ooMutate_(request, requestNowMs);
}
function ooMutate_(request, requestNowMs) {
  var lock = null, acquired = false, result;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) result = ooFail_('lock-unavailable');
    else { acquired = true; result = ooMutateLocked_(request, requestNowMs); }
  } catch (_) { result = ooFail_('server-error'); }
  finally { if (acquired) { try { lock.releaseLock(); } catch (_) {} } }
  return result;
}
function ooMutateLocked_(request, requestNowMs) {
  var gates = ooRecheckLockedGates_(request.token); if (!gates.ok) return gates; // token -> latch -> enabled, before Drive
  if (ooIsConversionAction_(request.action) && !ooConversionOperationallyEnabled_()) return ooFail_('conversion-disabled');
  var source = ooSourceFile_(), loaded = ooReadStore_(source); if (!loaded.ok) return loaded;
  var replay = ooFindMutation_(loaded.store, request.mutationId); if (replay) return ooFail_('replay-request');
  var canonical = ooCanonicalMutation_(request.action, request.payload); if (!canonical.ok) return canonical;
  var idempotent = ooFindIdempotentCreate_(loaded.store, request.action, request.payload.idempotencyKey, canonical.sha256Hex); if (idempotent) return idempotent;
  var domainReplay = ooFindSafeConversionReplay_(loaded.store, request, canonical); if (domainReplay) return domainReplay;
  var revision = ooValidateExpectedRevisionInsideLock_(request, loaded.store.revision); if (!revision.ok) return revision;
  var mutationNowMs = ooNowMs_(), mutationNowKst = ooFormatKst_(mutationNowMs);
  var prepared = ooPrepareMutation_(loaded.store, request, 'representative', canonical, mutationNowKst); if (!prepared.ok) return prepared;
  var backup = ooBackupPair_(source, loaded, mutationNowMs); if (!backup.ok) return backup;
  var unchanged = ooRecheckLoadedSource_(source, loaded); if (!unchanged.ok) return unchanged;
  var armed = ooArmRecoveryLatch_(); if (!armed.ok) return armed;
  return ooWritePrepared_(source, loaded, prepared, backup, mutationNowKst);
}
function ooBackupPair_(source, loaded, mutationNowMs) {
  var parent = ooExactSourceParent_(source); if (!parent.ok || parent.id !== loaded.parentId || source.getId() !== loaded.sourceId) return ooFail_('backup-verify-failed');
  var createdAt = ooFormatKst_(mutationNowMs), stamp = ooBackupStamp_(mutationNowMs);
  var backupName = '관리사무소영업운영_백업_' + stamp + '.json', manifestName = '관리사무소영업운영_백업_' + stamp + '.manifest.json';
  var backup = parent.value.createFile(backupName, Utilities.newBlob(loaded.bytes, 'application/json'));
  var manifest = { sourceFileId:loaded.sourceId, backupFileId:backup.getId(), createdAt:createdAt, schemaVersion:loaded.store.schemaVersion, preMutationRevision:loaded.store.revision, byteLength:loaded.byteLength, sha256Hex:loaded.sha256Hex };
  var manifestFile = parent.value.createFile(manifestName, JSON.stringify(manifest), 'application/json');
  var pair = ooRereadExactPair_(source, parent.value, backup, manifestFile, backupName, manifestName); if (!pair.ok) return ooCleanupFailedPair_(backup, manifestFile, 'backup-verify-failed');
  if (pair.sourceFileId !== loaded.sourceId || pair.parentId !== loaded.parentId || pair.backupFileId !== backup.getId() || pair.manifestFileId !== manifestFile.getId() ||
      pair.createdAt !== createdAt || ooParseKstDateTime_(pair.createdAt) === null || pair.schemaVersion !== loaded.store.schemaVersion || pair.preMutationRevision !== loaded.store.revision ||
      pair.byteLength !== loaded.byteLength || pair.sha256Hex !== loaded.sha256Hex || !ooBytesEqual_(pair.backupBytes, loaded.bytes) || ooSha256BytesHex_(pair.backupBytes) !== loaded.sha256Hex) {
    return ooCleanupFailedPair_(backup, manifestFile, 'backup-verify-failed');
  }
  return { ok:true, backupFileId:backup.getId(), manifestFileId:manifestFile.getId(), parentId:loaded.parentId, backupName:backupName, manifestName:manifestName, manifest:manifest };
}
```

`ooDispatch_(request)` obtains exactly one `requestNowMs` snapshot and calls `ooValidateRequestEnvelope_` for every read and mutation before any handler; no downstream function reparses an alternative `ts`/`requestAtKst` field or calls the clock for request freshness. Reads therefore use the same request-timestamp parser and five-minute boundary as writes; list accepts only `{}` or exact `{includeArchived:boolean}`, retention accepts only `{}`, and neither accepts `mutationId`. `officeOpsRetentionList.serverNowKst` is formatted from the passed `requestNowMs`, not a second clock read. A mutation obtains exactly one later `mutationNowMs`, derives exactly one whole-second `mutationNowKst`, and passes that same KST value into the record, store `updatedAt`, audit `at`, and four-key ACK. Backup filename and manifest time derive from that same mutation snapshot. Server tests assert one request-clock read per dispatch and one mutation-clock read per non-replay mutation; reads and replay returns never create an extra mutation snapshot.

The public preflight in `ooDoPost_` remains an early rejection only. After acquiring the script lock, `ooRecheckLockedGates_` must re-read in exact order: constant-time token match, `OFFICE_OPS_RECOVERY_REQUIRED==='0'`, then `OFFICE_OPS_ENABLED==='1'`; next, and still before any Drive access, the exact five conversion actions alone pass through `ooConversionOperationallyEnabled_()`. With the production literal `false`, they return `conversion-disabled` with zero Drive, clock, backup, audit, revision, or source effects. Non-conversion routes do not call this gate. A successful property read with a missing/empty/unexpected token, latch, or enabled value maps respectively to `unauthorized`, `manual-recovery-required`, or `office-disabled`; a thrown property access is `server-error`. A request that waited behind a mutation therefore cannot pass a newly armed latch.

Inside the lock, the ordering is normative and exact: token/latch/enabled gates → conversion code gate for the exact five conversion actions → exact source/store read and strict validation → mutation-ID replay rejection → canonical action/payload validation → idempotent-create replay or safe-conversion replay → `expectedRevision` validation only for a remaining non-replay mutation → prepare/backup/source recheck/latch/write. Thus a conversion request returns `conversion-disabled` before Drive even if it would otherwise replay; once a separately approved build changes the literal gate to `true`, an already used mutation ID returns `replay-request` even if its supplied `expectedRevision` is stale, a fresh exact conversion proof with its pre-success revision returns the original exact four-key ACK without a clock, backup, property write, audit, revision, or source write, and only a fresh valid non-replay payload reaches `revision-conflict`. A fresh malformed payload with a stale revision returns canonical `unknown-field`, `invalid-input`, or its narrower domain error before revision comparison. Create and read actions cannot smuggle `expectedRevision`. The already validated `requestNowMs` is passed through and never replaced inside the lock.

`ooMutate_` catches `getScriptLock`, `tryLock`, mutation-body, and `releaseLock` exceptions without exposing exception text. False `tryLock` returns `lock-unavailable`; get/try/body exceptions return `server-error`. Once acquired, the lock is released exactly once on every success/error/early-result path. A release exception is swallowed only after recording the primary result and can never replace a success or earlier error. Tests assert zero release when acquisition did not occur and exactly one release after acquisition.

`ooPrepareMutation_` deep-clones and fully validates the requested state/revision transition before any backup or latch; it cannot access Drive, Properties, locks, or clocks. `actor` is always the server-derived exact value `'representative'`, never a caller payload. Only a valid prepared candidate proceeds to backup, exact source recheck, latch arm, audit enrichment, serialization, and `ooWritePrepared_`. Pilot, inspection, and opportunity update handlers consume the exact full-replacement payloads from Task 2; they preserve or recalculate server-owned timestamps, retention, tombstone, conversion, and audit fields rather than accepting them from the caller.

`ooRecoveryValidateSource_()` is a named zero-argument Apps Script editor entrypoint, never an allowlisted web action. It acquires the same script lock with the same exactly-once/nonmasking release pattern, then re-reads `OFFICE_OPS_ENABLED==='0'` and `OFFICE_OPS_RECOVERY_REQUIRED==='1'` inside the lock before Drive access. Wrong flags, lock failure, missing/wrong source, malformed bytes, schema failure, or hash failure throw only a redacted `Error('recovery-validation-failed:<code>')` so the Apps Script Run visibly fails. On success it invokes `ooSourceFile_()`, `ooReadStore_()`, strict schema/audit validation, and source-byte SHA-256, constructs only `{ok:true,sourceFileId,schemaVersion,revision,byteLength,sha256Hex}`, writes that sanitized tuple once with `Logger.log(JSON.stringify(result))`, and returns the same tuple. It never reads/logs/returns the token, clears the latch, changes enabled state, writes Drive, or exposes record contents. Server tests include a waiter whose flags change before lock acquisition, lock get/try/release exceptions, a valid restored file, malformed source, and wrong flags; they verify visible success/failure, exact sanitized keys, zero writes, no token/record content, and absence from `ooIsAllowedAction_`.

Implement `ooSourceFile_` with `DriveApp.getFileById(OFFICE_OPS_FILE_ID)` only and never call `getFilesByName`. Reject a missing configured ID, Drive lookup exception, returned `getId()` different from the configured ID, trashed source, a name other than exact `관리사무소영업운영.json`, MIME other than exact `application/json`, zero or multiple parents, invalid UTF-8 byte round-trip, BOM/non-JSON bytes, or any strict store/audit failure before a write. `ooReadStore_` hashes the same raw byte array it parses, calls both `ooValidateStore_` and `ooValidateAuditHistory_`, and returns exact `{ok:true,sourceId,parentId,bytes,byteLength,sha256Hex,store}`; it never silently normalizes source text. Legacy ID noncollision is a representative initialization check because this standalone property namespace cannot inspect legacy IDs, and the OfficeOps source must contain neither legacy property names nor legacy source access.

Strict store validation additionally requires `audit.length===revision`; audit `preMutationRevision` values are exactly contiguous `0..revision-1`; every mutation ID is unique; every non-null create key is unique by exact `(action,idempotencyKey)` and appears only on a create action; non-create rows have `idempotencyKey:null`; and each audit `id` matches its action family (`pilot_`, `consent_`, `inspection_`, or `opp_`). The final audit row's `at` equals store `updatedAt`. Any duplicate or ambiguous replay candidate is `invalid-store`, never “first match wins.” After freshness and mutation-ID validation, `ooFindIdempotentCreate_` immediately returns null unless `action` is one of the four create actions and the payload has a validated key; equal canonical hash reconstructs exactly `{ok:true,id:audit.id,revision:audit.preMutationRevision+1,updatedAt:audit.at}`, verified to have exactly those four keys and a matching action-ID family. A changed hash returns `idempotency-conflict`. Replay creates no clock snapshot, backup, audit, revision, or source write. `ooFindSafeConversionReplay_` uses the same exact four-key ACK rule and accepts only the exact immediately reached begin/arm/record/finalize proof; changed proof, stale timestamp, repeated mutation ID, ambiguity, or a non-conversion action cannot use it.

`ooBackupPair_` is bound to the already loaded pre-mutation object, not merely to internally consistent new files. The re-read manifest must have the exact seven approved fields and equal the loaded `sourceId`, `schemaVersion`, `revision`, `byteLength`, and `sha256Hex`; the re-read backup bytes must be byte-for-byte equal to `loaded.bytes` and independently match the same length/hash. Both created files must return their expected immutable IDs, exact generated names, exact `application/json` MIME, non-trashed state, and the same `loaded.parentId`; backup/manifest/source IDs must be pairwise distinct. A backup plus manifest changed consistently to some other valid bytes still fails `backup-verify-failed`. Failed attempted artifacts may be marked only by their directly returned new IDs and are never mixed into normal retention selection.

Write source JSON only after successful source-bound backup verification. Increment revision once and set `updatedAt` to the one mutation KST snapshot. Enrich exactly one prepared audit row with `{action,result:'ok',id,mutationId,idempotencyKey,payloadSha256,at:updatedAt,actor:'representative',lifecycleBefore,backupFileId,backupManifestFileId,backupSha256,preMutationRevision}`; create uses its validated key, all other actions use `null`, and archive/restore alone carry the exact prior tombstone object. Validate all store/audit/ACK invariants on the complete enriched candidate before serialization. Immediately before latch arm, while holding the lock, re-read the exact source and require the same ID, parent, raw bytes, byte length, SHA-256, and revision as `loaded`; any difference returns `source-changed`, preserves the verified pair, and performs no latch/source write. After `setContent(candidateBytes)`, re-read and require raw bytes and SHA-256 exactly equal to the serialized candidate, then strict-parse that same byte array and require the expected revision; valid-but-different JSON, whitespace changes, different valid fields/revision, corrupt UTF-8, or malformed JSON are all `write-verify-failed` and enter restore.

`ooVerifiedRetentionPairs_(source,currentPair)` enumerates only the exact source parent after a verified commit. A cleanup candidate exists only when an exact-key manifest is non-trashed JSON in that parent, names a distinct non-source backup ID in the same parent, has `sourceFileId===source.getId()`, and its createdAt/schema/revision/length/hash exactly match a non-trashed JSON backup whose raw bytes strict-parse and whose store revision equals `preMutationRevision`. Manifest, backup, and source IDs must be pairwise distinct. Sort complete pairs stably by `preMutationRevision,createdAt,backupFileId,manifestFileId`, require `currentPair` to be the unique maximal pair, keep exactly the newest ten including it, and immediately reverify a pair before each `setTrashed`. Never trash the source, current pair, unrelated files, orphans, cross-parent/cross-source pairs, duplicate-ID pairs, forged manifests, malformed pairs, or anything selected only by filename. Selection/verification ambiguity or trash exception stops cleanup without masking an already verified commit.

Drive `setContent` and Script Properties are not claimed atomic. Immediately before any source write, while the lock is held, `ooArmRecoveryLatch_` attempts to write `1` and then performs an independent read even if the write threw. Observed exact `1` is authoritative and permits the source write; observed exact `0` means source remains untouched, the verified pair is preserved, and the result is `recovery-arm-failed`; unreadable, missing, or any other value means source remains untouched, the pair is preserved, and the result is `recovery-state-unknown`. The next request always applies its fresh token→latch→enabled preflight: observed `0` may retry, observed `1` returns `manual-recovery-required`, and unreadable remains fail-closed. No arm failure cleans retention or claims an unobserved state.

If the source write throws or exact candidate re-read fails, `ooRestoreSourceAfterFailedWrite_` writes the already verified `loaded.bytes` back to the same exact source, then requires byte-for-byte equality, loaded hash/length/revision, strict UTF-8, and strict store/audit validation. A valid-but-different restore, corrupt restore, thrown restore, or unreadable restore is failure: no clear is attempted, the verified pair is preserved, and the result is only `manual-recovery-required`. Only after an exact verified candidate or exact verified restoration may `ooClearRecoveryLatch_` write `0`. Confirmed `0` returns the normal exact ACK or restored `write-verify-failed`; confirmed `1` returns `manual-recovery-required`; unreadable/other returns `recovery-state-unknown`. Clear ambiguity never changes the verified source result, and the next request is governed only by its newly observed latch. The plan never promises unchanged source bytes when both primary write and exact restoration fail.

- [ ] **Step 4: Run server tests and inject each backup failure**

Run: `node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js`

Expected: both PASS.

The static isolation RED pins production source to exact `function ooConversionOperationallyEnabled_(){return false;}`, proves the exact five conversion actions are classified without adding an action or property, and rejects any external or property lookup inside that gate. Server gate REDs assert token→latch→enabled→conversion-literal order before Drive; production false returns `conversion-disabled` for each of the five actions with zero effects, non-conversion routes bypass it, and every Task 3 replay or Task 4 domain test that must reach a conversion handler injects true only inside the fake sandbox.

Retain separate exact-source REDs for: missing property, Drive lookup throw, returned ID mismatch, trashed source, wrong display name, wrong MIME, no parent, multiple parents, invalid UTF-8/round-trip, BOM, malformed JSON, schema version 2, duplicate record ID, and strict audit failure. Every case must perform zero backup/source/property writes. The static isolation test must fail on `getFilesByName`, `APP_TOKEN`, `DATA_FILE_ID`, `OFFICE_INTAKE_FILE_ID`, `COMMERCIAL_APPROVAL_TOKEN`, any legacy source helper, or imports/access from `apps-script/` or `apps-script-commercial/`; protected-path checks include both directories plus `index.html` and `sw.js`.

Retain separate lock/gate/order/clock REDs for: lock unavailable; `getScriptLock` throw; `tryLock` throw; acquired-body throw; `releaseLock` throw after success and after primary error; exactly zero or one release as applicable; and a waiting request whose token, latch, or enabled property changes before acquisition. Assert the locked gate reads token→latch→enabled in that order and rejects before any Drive call. Seed a used mutation ID, send it again with a stale `expectedRevision`, and require `replay-request`. Seed an immediately completed conversion plus its successful audit row, then send a fresh mutation ID with the exact frozen proof and the pre-success `expectedRevision`; require the original byte-identical exact `{ok,id,revision,updatedAt}` and zero mutation-clock, backup, property, audit, revision, source-write, or retention calls. Send a fresh mutation ID with a valid non-replay payload and stale revision and require `revision-conflict`. Send fresh unknown-extra and missing-required payloads that also carry stale revision and require respectively `unknown-field` and `invalid-input` (or the documented narrower domain error), with zero backup/property/source write. These tests must fail if revision checking moves before mutation replay, canonical validation, or safe replay. Assert `ooDispatch_(request)` is the only dispatcher signature, one request clock snapshot serves freshness, and one mutation snapshot supplies backup time, record/store/audit time, and ACK; replay/read paths do not take a mutation snapshot.

Retain separate backup/prewrite/write REDs for: backup-copy failure; manifest-create failure; manifest or backup ID/name/MIME/parent/trashed mismatch; manifest re-read/UTF-8/parse/exact-field mismatch; backup re-read failure; byte-length/hash mismatch; valid-but-different and malformed/non-KST `createdAt`; and a backup plus manifest coherently replaced with different valid bytes/hash/length/revision. Each returns `backup-verify-failed`, marks only directly returned distinct same-parent attempted artifact IDs (one or two) as cleanup candidates, and leaves source bytes/revision unchanged; a returned source/current/unrelated ID is never trashed. Prove the manifest source ID/hash/length/revision and backup bytes are each independently equal to `loaded`. After a verified pair but immediately before latch arm, inject source changes consisting of raw-byte-only whitespace, different valid JSON, revision change, corrupt bytes, ID/parent change, and require `source-changed`, preserved pair, zero latch/source write. Inject latch arm write success/throw followed independently by read-back `1`, `0`, and unreadable: only observed `1` may write; `0` returns `recovery-arm-failed`; unreadable returns `recovery-state-unknown`; all non-`1` cases preserve the pair and source.

After source write, inject exact candidate success, valid-but-different JSON, whitespace-only byte difference, wrong revision, corrupt UTF-8, malformed JSON, and write throw. Every non-exact case enters restore. Test exact byte-for-byte restore and confirmed clear `0` returns `write-verify-failed`; restore throw, valid-but-different restore, corrupt restore, hash/length/revision mismatch, or failed strict audit keeps the pair, makes no clear attempt, returns `manual-recovery-required`, and blocks later requests. After exact commit/restore, inject clear write/read-back outcomes observed `0`, observed `1`, and unreadable: respectively normal result, `manual-recovery-required`, and `recovery-state-unknown`; the following request must obey its newly observed latch rather than an assumed state.

Add store/audit/replay REDs for `audit.length!==revision`, noncontiguous `preMutationRevision`, duplicate mutation IDs, duplicate `(create action,idempotencyKey)`, a key on a non-create action, null key on a create, wrong action-ID prefix, final audit time different from store `updatedAt`, and two otherwise valid replay candidates; each is `invalid-store`. Prove a committed row has exactly the Task 2 audit fields and bound backup values. Create once, retry the same action/key/canonical hash with a fresh mutation ID/timestamp, and require the byte-identical exact four-key acknowledgement reconstructed from audit with zero clock/Drive/property write; changed hash is `idempotency-conflict`, reused mutation ID is `replay-request` before key lookup, and stale timestamp is `stale-request` before lookup. Inject extra/missing ACK keys and require `invalid-store` rather than returning an ambiguous replay.

Add eleven same-second mutations and prove exactly the newest ten complete verified pairs remain in stable `preMutationRevision,createdAt,backupFileId,manifestFileId` order despite duplicate filenames. Inject source-as-backup, current pair, unrelated JSON, orphan backup, orphan manifest, cross-parent pair, cross-source pair, duplicate IDs, forged hash/length/revision, malformed manifest, invalid backup store, and trash exceptions; `setTrashed` must never be called on the source, current pair, unrelated/orphan/cross-source/forged files, and selection ambiguity stops safely. Reverify each old pair immediately before trash. Retention failure never masks an already exact verified commit.

Test `ooRecoveryValidateSource_` under an acquired lock with in-lock flag recheck, flag changes while waiting, all lock exceptions, malformed/exact source outcomes, exact sanitized output keys, zero writes, and exactly-once nonmasking release. For `doPost`, malformed JSON that throws the normal built-in `SyntaxError` must return `bad-request`; inject a non-`SyntaxError` parser failure and unexpected exceptions at raw input access, properties, dispatch, Drive, lock, and normal response construction, and require only redacted `{ok:false,error:'server-error'}`. Separately make successful property reads return missing/empty/unexpected latch values and require `manual-recovery-required`, then missing/empty/unexpected enabled values and require `office-disabled`; a missing token remains `unauthorized`. A property getter that throws is `server-error`, not an expected unavailable state. No branch may expose exception text, token, receipt, evidence ID, or source bytes.

- [ ] **Step 5: Commit the durable mutation boundary**

```bash
git add apps-script-office-ops/OfficeOps.gs apps-script-office-ops/Code.gs tests/office-ops-server.unit.js tests/office-ops-server-isolation.check.js
git commit -m "feat: preserve verified OfficeOps backups before each mutation"
```

### Task 4: Add all domain handlers, tombstone lifecycle, and conversion state safety

**Files:**
- Modify: `apps-script-office-ops/OfficeOpsPure.gs`
- Modify: `apps-script-office-ops/OfficeOps.gs`
- Modify: `tests/office-ops-pure.unit.js`
- Modify: `tests/office-ops-server.unit.js`

**Interfaces:**
- Consumes: `ooMutate_`, strict schema helpers, and backup contract.
- Produces: the remaining eighteen mutation handlers after Task 3's `officePilotCreate` path, including pilot update/archive/restore, every consent/inspection/opportunity mutation, and `officeInspectionBeginConversion`, `officeInspectionArmLocalCommit`, `officeInspectionRecordLocalCommit`, `officeInspectionFinalizeConversion`, and `officeInspectionCancelConversion`. Together with Task 3's two reads and pilot create, the exact allowlist remains 21 actions.

- [ ] **Step 1: Write failing lifecycle and conversion tests**

```js
const closedPilot = post('officePilotCreate', { idempotencyKey:'create_pilot_retention_1', complexName:'보존 단지', source:'phone', stage:'closed', pilotStartedAt:null, pilotEndsAt:null, extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'' });
let closedPilotRow = list().pilots.find(row => row.pilotId === closedPilot.id);
assert.equal(closedPilotRow.retentionStartedAt, closedPilot.updatedAt);
const stillClosedPilot = post('officePilotUpdate', { pilotId:closedPilot.id, expectedRevision:closedPilot.revision, complexName:'보존 단지', source:'phone', stage:'closed', pilotStartedAt:null, pilotEndsAt:null, extensionApprovedAt:null, nextActionAt:'2026-09-02', owner:'대표', notes:'계속 종료' });
closedPilotRow = list().pilots.find(row => row.pilotId === closedPilot.id);
assert.equal(closedPilotRow.retentionStartedAt, closedPilot.updatedAt);
const reopenedPilot = post('officePilotUpdate', { pilotId:closedPilot.id, expectedRevision:stillClosedPilot.revision, complexName:'보존 단지', source:'phone', stage:'contacted', pilotStartedAt:null, pilotEndsAt:null, extensionApprovedAt:null, nextActionAt:'2026-09-03', owner:'대표', notes:'재상담' });
assert.equal(list().pilots.find(row => row.pilotId === closedPilot.id).retentionStartedAt, null);
const skippedOpportunity = post('officeOpportunityCreate', { idempotencyKey:'create_opportunity_retention_1', complexName:'입찰 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관', deadlineAt:'2026-09-30T10:00:00+09:00', stage:'skip', requirements:['면허 확인'], verifiedBy:'대표', notes:'' });
let opportunityRow = list().opportunities.find(row => row.opportunityId === skippedOpportunity.id);
assert.equal(opportunityRow.retentionStartedAt, skippedOpportunity.updatedAt);
const closedOpportunity = post('officeOpportunityUpdate', { opportunityId:skippedOpportunity.id, expectedRevision:skippedOpportunity.revision, complexName:'입찰 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관', deadlineAt:'2026-09-30T10:00:00+09:00', stage:'closed', requirements:['면허 확인'], verifiedBy:'대표', notes:'종료' });
opportunityRow = list().opportunities.find(row => row.opportunityId === skippedOpportunity.id);
assert.equal(opportunityRow.retentionStartedAt, skippedOpportunity.updatedAt);
const reopenedOpportunity = post('officeOpportunityUpdate', { opportunityId:skippedOpportunity.id, expectedRevision:closedOpportunity.revision, complexName:'입찰 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관', deadlineAt:'2026-09-30T10:00:00+09:00', stage:'review', requirements:['면허 확인'], verifiedBy:'대표', notes:'재검토' });
assert.equal(list().opportunities.find(row => row.opportunityId === skippedOpportunity.id).retentionStartedAt, null);
const validTerms = { workKind:'preventive-inspection', scope:'지하 배수 점검', exclusions:[], vatMode:'included', quotedAmount:100000, validUntil:'2026-09-30', scheduleWindow:'2026-09-02' };
const termsSha256 = sandbox.ooTermsSha256_(validTerms);
const validApprovalMetadata = { receiptId:'receipt_test_001', subjectType:'aptOrder', subjectId:'pending_test_001', approvedTermsSha256:termsSha256, approvalEvidenceType:'quote-file', approvalEvidenceFileId:'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256:'a'.repeat(64), approvedAt:'2026-08-31T10:00:00+09:00', approvedByRole:'management-office', issuedAt:'2026-08-31T10:00:01+09:00', receiptHmac:'b'.repeat(64) };
const created = post('officeInspectionCreate', { idempotencyKey:'create_inspection_123', officeId:'office_test_001', complexName:'테스트 단지', templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-02', riskItems:['배수 확인'], summary:'접근 허가 후 점검', commercialTerms:validTerms, commercialApproval:null });
const createdRow = list().inspections.find(row => row.inspectionId === created.id);
assert.deepEqual(Object.keys(createdRow).sort(), ['inspectionId','officeId','complexName','templateId','status','nextDueAt','riskItems','summary','commercialTerms','commercialApproval','conversionId','conversionTermsSha256','conversionReceiptId','pendingOrderId','linkedOrderId','conversionStartedAt','updatedAt','archivedAt','archivedBy','archiveReason','restoredAt'].sort());
assert.deepEqual({ approval:createdRow.commercialApproval, conversionId:createdRow.conversionId, startedAt:createdRow.conversionStartedAt }, { approval:null, conversionId:null, startedAt:null });
assert.equal(post('officeInspectionCreate', { idempotencyKey:'create_inspection_124', officeId:'office_test_002', complexName:'다른 단지', templateId:'preventive-v1', status:'conversion-pending', nextDueAt:'2026-09-02', riskItems:[], summary:'', commercialTerms:validTerms, commercialApproval:validApprovalMetadata }).error, 'invalid-inspection');
const archived = post('officeInspectionArchive', { inspectionId:created.id, expectedRevision:created.revision, archiveReason:'계획 보류' });
assert.equal(list().inspections.some(row => row.inspectionId === created.id), false);
const restored = post('officeInspectionRestore', { inspectionId:created.id, expectedRevision:archived.revision });
assert.equal(restored.id, created.id);
const beginPayload = { inspectionId:created.id, conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:termsSha256, commercialTerms:validTerms, commercialApproval:validApprovalMetadata, expectedRevision:restored.revision };
assert.equal(post('officeInspectionBeginConversion', { ...beginPayload, commercialApproval:{...validApprovalMetadata,surprise:true} }).error, 'unknown-field');
const beginApprovalMissingHmac = {...validApprovalMetadata}; delete beginApprovalMissingHmac.receiptHmac;
assert.equal(post('officeInspectionBeginConversion', { ...beginPayload, commercialApproval:beginApprovalMissingHmac }).error, 'invalid-commercial-approval');
const begin = post('officeInspectionBeginConversion', beginPayload);
assert.deepEqual(post('officeInspectionBeginConversion', beginPayload), begin);
const begunRow = list().inspections.find(row => row.inspectionId === created.id);
assert.equal(begunRow.conversionStartedAt, begin.updatedAt);
assert.deepEqual(begunRow.commercialTerms, sandbox.ooCanonicalCommercialTerms_(validTerms).value);
assert.deepEqual(begunRow.commercialApproval, validApprovalMetadata);
const cancelled = post('officeInspectionCancelConversion', { inspectionId:created.id, conversionId:'conversion_test_001', expectedRevision:begin.revision });
assert.equal(cancelled.ok, true);
const cancelledRow = list().inspections.find(row => row.inspectionId === created.id);
assert.deepEqual({ status:cancelledRow.status, terms:cancelledRow.commercialTerms, approval:cancelledRow.commercialApproval, conversionId:cancelledRow.conversionId, termsHash:cancelledRow.conversionTermsSha256, receiptId:cancelledRow.conversionReceiptId, pendingOrderId:cancelledRow.pendingOrderId, linkedOrderId:cancelledRow.linkedOrderId, startedAt:cancelledRow.conversionStartedAt }, { status:'proposal', terms:sandbox.ooCanonicalCommercialTerms_(validTerms).value, approval:null, conversionId:null, termsHash:null, receiptId:null, pendingOrderId:null, linkedOrderId:null, startedAt:null });
const armPayload = { inspectionId:created.id, conversionId:'conversion_test_001', pendingOrderId:'pending_test_001', receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001', termsSha256:termsSha256, expectedRevision:begin.revision };
assert.equal(post('officeInspectionArmLocalCommit', armPayload).error, 'revision-conflict');
assert.equal(post('officeInspectionBeginConversion', { ...beginPayload, receiptSubjectId:'other_order', expectedRevision:cancelled.revision }).error, 'receipt-mismatch');
```

The pilot and opportunity create/update assertions above are mandatory server REDs: the real handlers must call `ooRetentionStartedAtFor_` so first terminal entry uses the handler's server `updatedAt`, terminal-to-terminal update preserves it, and terminal exit clears it. Add state-machine tests for: an inspection create/update accepts `commercialTerms:null|valid-canonical-terms` but requires `commercialApproval:null`; ordinary create/update cannot enter any conversion state and is rejected once begin has succeeded; a failed begin leaves the proposal bytes/revision unchanged; nested approval extra fields propagate `unknown-field`, while missing/malformed approval fields propagate `invalid-commercial-approval`; successful begin atomically stores and freezes the normalized exact-key `commercialTerms`, full signed `commercialApproval`, and server KST `conversionStartedAt`; terms/approval or archive/restore changes are rejected after begin. Cancel is allowed only in `conversion-pending`, retains the normalized proposal terms, and clears approval plus every conversion identity field including `conversionStartedAt`; arm rejects a cancel race. Writing with no local order permits the same `pendingOrderId` recovery only; writing with an existing local order may record it but cannot create another; record and finalize revalidate `conversionId`, `pendingOrderId`, `linkedOrderId`, `receiptId`, `receiptSubjectType==='aptOrder'`, `receiptSubjectId===pendingOrderId`, and `termsSha256` against the values frozen by begin; any mismatch blocks finalize and all subsequent paid transition handoff. For begin, arm, record, and finalize, an exact frozen-proof replay after a lost response returns the prior successful `{ok,id,revision,updatedAt}` even when the caller has the pre-success `expectedRevision`; a different proof remains a conflict. Test record replay with a fresh mutation ID and prove no duplicate local-order identity can be recorded. Keep the test server-local; it does not create an `aptOrder`.

Add a store-wide conversion-identity index over every live **and archived** inspection. Each non-null `conversionId`, `pendingOrderId`, `linkedOrderId`, and `conversionReceiptId` is reserved against every other inspection regardless of which of those four fields holds it; `pendingOrderId===linkedOrderId` is permitted only within its owning inspection after local commit. Begin additionally requires its incoming `conversionId`, `pendingOrderId`, and `receiptId` to be pairwise distinct. A collision returns `conversion-identity-conflict` before clock/backup/audit/revision/source effects. RED covers each of the four stored fields against each of the three begin inputs for both live and archived owners, same-inspection legal pending/link ownership, two concurrent begins, record adopting an ID owned by another row, finalize revalidation, and strict-store rejection of pre-existing cross-inspection collisions.

Add explicit replay REDs for begin, arm, record, and finalize at only the immediately reached stage. The successful audit row must uniquely bind action, record ID, mutation payload hash, `preMutationRevision`, and exact four-key ACK reconstruction; missing, duplicate, inconsistent, or extra audit/ACK data is `invalid-store`. A fresh mutation ID plus the exact proof and pre-success revision returns the byte-identical prior ACK with zero effects. Changed receipt/approval proof is `receipt-mismatch`, changed terms/hash is `terms-mismatch`, changed identity or a later-than-immediate stage is `invalid-conversion-state`; none writes. Cancel is deliberately not replay-successful: retry after a successful cancel returns `invalid-conversion-state` and leaves proposal bytes/revision unchanged.

Add consent handler REDs for exact create fields, server ID/time assignment, strict consent hash/KST/month validation, active scheduling visibility, withdrawn non-schedulable history visibility, and audit binding to the verified backup and pre-mutation revision. Both rows remain in the returned store because consent withdrawal is not a tombstone; only `ooConsentActive_`/due scheduling excludes the withdrawn row. Withdraw assigns the single mutation KST snapshot to `withdrawnAt`, records the exact consent audit event, makes the consent inactive and retention-eligible only at its one-KST-year boundary, and preserves all original evidence metadata. An already withdrawn consent returns `already-withdrawn` with zero effects. Assert no resident contact fields, non-null `lastContactedAt`, contact mutation, message/send action, automatic contact, permanent delete, or physical deletion appears; the required stored `lastContactedAt` field remains exactly null.

Add the full pilot/inspection/opportunity tombstone matrix: unknown ID→`not-found`; archive of archived→`already-archived`; restore of live→`not-archived`; archived update→`already-archived` and requires restore before update. Default list hides tombstones and exact `includeArchived:true` shows them. Archive/restore audit rows carry exact prior `lifecycleBefore`; restore preserves ID/business/server fields, re-archive starts a new archive retention reference, retention uses archive precedence, and no route deletes a row. Inspection archive and restore at `conversion-pending|conversion-writing|conversion-local-committed|converted` return `invalid-conversion-state` with zero effects.

Add opportunity handler REDs proving that an update which enters the human participation stage must call `ooCanOpportunityParticipate_` with the locked server row, dispatcher request timestamp, and server-now snapshot. Reject non-K-apt or nonofficial URL, unverified source, request/server skew, deadline equality (`serverNow===deadline`), and past deadline; accept only verified official K-apt with both times strictly before deadline. Each rejection has zero effects.

Count and exercise the exact remaining eighteen Task 4 mutation routes individually. Pilot, inspection, and opportunity updates are full replacements: missing editable fields fail, unknown/server-owned input fields fail, and handlers preserve or deterministically recalculate IDs, create time, retention, conversion state, and tombstones. For every route, RED covers prepare failure before backup and write/verify failure rollback under Task 3, with the representative actor, one audit row, one revision increment only on exact success, and no partially committed candidate.

- [ ] **Step 2: Run lifecycle tests to verify they fail**

Run: `node tests/office-ops-pure.unit.js && node tests/office-ops-server.unit.js`

Expected: FAIL because domain handlers and conversion transitions do not exist.

- [ ] **Step 3: Implement domain-specific validation and explicit transitions**

```js
function ooVisible_(record) { return !record.archivedAt; }
function ooConversionProofMatches_(inspection, p) {
  return p.conversionId === inspection.conversionId && p.pendingOrderId === inspection.pendingOrderId && p.receiptId === inspection.conversionReceiptId && p.receiptSubjectType === 'aptOrder' && p.receiptSubjectId === inspection.pendingOrderId && p.termsSha256 === inspection.conversionTermsSha256;
}
function ooConversionReplay_(inspection, command, payload) {
  var reached = { begin:'conversion-pending', arm:'conversion-writing', record:'conversion-local-committed', finalize:'converted' };
  if (inspection.status !== reached[command] || !ooConversionProofMatches_(inspection, payload)) return ooFail_('invalid-conversion-state');
  if ((command === 'record' || command === 'finalize') && payload.linkedOrderId !== inspection.linkedOrderId) return ooFail_('invalid-conversion-state');
  if (command === 'begin' && (ooTermsSha256_(payload.commercialTerms) !== inspection.conversionTermsSha256 ||
      JSON.stringify(ooCanonicalNested_(OO_APPROVAL_META_FIELDS_, payload.commercialApproval)) !== JSON.stringify(inspection.commercialApproval))) return ooFail_('receipt-mismatch');
  return { ok:true, replayed:true };
}
function ooConversionTransition_(inspection, command, payload, nowKst) {
  if (command === 'begin') {
    if (inspection.status !== 'proposal') return ooConversionReplay_(inspection, command, payload);
    var termsSha256 = ooTermsSha256_(payload.commercialTerms);
    if (payload.termsSha256 !== termsSha256) return ooFail_('terms-mismatch');
    if (!ooApprovalProofMatches_(payload.commercialApproval, payload, termsSha256)) return ooFail_('receipt-mismatch');
    inspection.commercialTerms = ooCanonicalCommercialTerms_(payload.commercialTerms).value;
    inspection.commercialApproval = ooCanonicalNested_(OO_APPROVAL_META_FIELDS_, payload.commercialApproval);
    inspection.status = 'conversion-pending'; inspection.conversionId = payload.conversionId; inspection.pendingOrderId = payload.pendingOrderId; inspection.conversionReceiptId = payload.receiptId; inspection.conversionTermsSha256 = payload.termsSha256; inspection.conversionStartedAt = nowKst; return { ok:true };
  }
  if (command === 'cancel' && inspection.status === 'conversion-pending' && payload.conversionId === inspection.conversionId) {
    inspection.status = 'proposal'; inspection.commercialApproval = null; inspection.conversionId = null; inspection.conversionTermsSha256 = null; inspection.conversionReceiptId = null; inspection.pendingOrderId = null; inspection.linkedOrderId = null; inspection.conversionStartedAt = null; return { ok:true };
  }
  if (command === 'arm' && inspection.status === 'conversion-pending' && ooConversionProofMatches_(inspection, payload)) { inspection.status = 'conversion-writing'; return { ok:true }; }
  if (command === 'record' && inspection.status === 'conversion-writing' && ooConversionProofMatches_(inspection, payload) && payload.linkedOrderId === inspection.pendingOrderId) { inspection.status = 'conversion-local-committed'; inspection.linkedOrderId = payload.linkedOrderId; return { ok:true }; }
  if (command === 'finalize' && inspection.status === 'conversion-local-committed' && ooConversionProofMatches_(inspection, payload) && payload.linkedOrderId === inspection.linkedOrderId && inspection.linkedOrderId === inspection.pendingOrderId) { inspection.status = 'converted'; return { ok:true }; }
  return ooConversionReplay_(inspection, command, payload);
}
```

`ooConversionReplay_` is an internal no-write signal, not an extra public response field. The lock-scoped dispatcher recognizes it after strict envelope/proof validation but before revision comparison, backup, audit, or source write, and returns the current record's exact normal acknowledgement. It is accepted only at the immediately reached stage shown above with the exact frozen proof and a fresh mutation ID; any changed proof or later stage remains a conflict.

Validate each field with explicit per-action allowlists and the exact Task 2 stored-row schemas. Pilot records use `stage`, never `status`; consent records include the exact purpose/channel/month interval/text version/text snapshot SHA-256/evidence/consented-at/server-generated-withdrawn-at fields and no resident contact; opportunities require official source URL, checked timestamp, due time, and document requirements before a human-only participation state. Inspection create/update are full replacements of editable fields, require `commercialApproval:null`, and cannot set conversion identities or any conversion status; begin alone freezes the full receipt and sets `conversionStartedAt`. Exclude archived records from default `officeOpsList`; include them only with exact `{includeArchived:true}` and never remove tombstones. `officeOpsRetentionList` returns only the exact Task 2 retention rows and never deletes them.

Implement one shared `ooValidateConversionIdentityOwnership_(store, inspectionId, candidate)` and call it from strict store validation plus begin, record, and finalize before mutation preparation. It enforces the cross-inspection reservation and begin pairwise-distinct rule above while allowing only the owning inspection's pending/link equality. Every pilot/inspection/opportunity update first rejects a tombstone with `already-archived`; every archive/restore uses the shared lifecycle helpers and conversion-state restriction. Opportunity update calls `ooCanOpportunityParticipate_` whenever its replacement stage enters participation. The consent record/withdraw handlers use only the server mutation timestamp and shared consent/retention/audit helpers. These rules apply to all remaining eighteen routes; no handler adds a property, action, contact field, delete path, or external call.

- [ ] **Step 4: Run all OfficeOps tests and demonstrate a race guard**

Run: `node tests/office-ops-pure.unit.js && node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js`

Expected: all PASS.

Temporarily bypass `expectedRevision` comparison in one update handler, rerun the race test with two same-revision updates, and confirm it fails because the second write no longer reports `revision-conflict`. Restore the comparison before continuing.

- [ ] **Step 5: Commit lifecycle correctness**

```bash
git add apps-script-office-ops/OfficeOpsPure.gs apps-script-office-ops/OfficeOps.gs tests/office-ops-pure.unit.js tests/office-ops-server.unit.js
git commit -m "feat: retain OfficeOps history through archive and restore"
```

### Task 5: Document manual initialization, read-only disablement, rollback, and approval gates

**Files:**
- Create: `apps-script-office-ops/README_APPS_SCRIPT.md`
- Modify: `apps-script-office-ops/OfficeOps.gs`
- Modify: `tests/office-ops-server.unit.js`
- Modify: `tests/office-ops-server-isolation.check.js`

**Interfaces:**
- Consumes: standalone project sources, exact storage contract, and all internal action contracts.
- Produces: a human-operated deployment and recovery procedure that cannot be mistaken for repository authorization.

- [ ] **Step 1: Add a failing README contract assertion**

```js
const readme = fs.readFileSync(path.join(__dirname, '..', 'apps-script-office-ops', 'README_APPS_SCRIPT.md'), 'utf8');
for (const phrase of ['OFFICE_OPS_FILE_ID', 'OFFICE_OPS_ENABLED', 'OFFICE_OPS_RECOVERY_REQUIRED', 'OFFICE_OPS_TOKEN', 'ooRecoveryValidateSource_', '관리사무소영업운영.json', 'latest ten verified backup pairs', 'device-local cached read-only export', 'representative approval']) {
  assert.equal(readme.includes(phrase), true, 'README must state ' + phrase);
}
assert.equal(readme.includes('TEST_ONLY_OFFICE_OPS_TOKEN value'), false);
```

- [ ] **Step 2: Run the documentation assertion to verify it fails**

Run: `node tests/office-ops-server-isolation.check.js`

Expected: FAIL until the OfficeOps README is added.

- [ ] **Step 3: Write the exact representative-only runbook**

Before documenting the runbook, require `OfficeOps.gs` to contain the zero-argument editor-only `ooRecoveryValidateSource_()` contract from Task 3 and add server tests proving it succeeds only with `enabled=0`, latch `1`, and a strict valid exact source; it never appears in `ooIsAllowedAction_` or changes any file/property.

Document these ordered actions: (1) run new OfficeOps tests and the full hyeonjang regression; (2) representative creates a **new** Apps Script project from `apps-script-office-ops/`; (3) representative manually creates one empty UTF-8 JSON file using the exact initial schema, records the existing data and OfficeIntake file IDs in a redacted checklist, confirms the new exact Drive ID is different from both, and records only the new ID in that project’s Script Properties; (4) representative sets the distinct token, `OFFICE_OPS_RECOVERY_REQUIRED=0`, and `OFFICE_OPS_ENABLED=0`; (5) representative deploys a new Apps Script web-app version and proves authenticated list and mutation both fail with `office-disabled`, without enabling public UI; (6) after separate written approval, changes only the enable flag to `1`, tests a redacted list success path, and records version/date/pass-fail; (7) on `manual-recovery-required`, never clear the recovery latch first: keep OfficeOps inaccessible, permit only device-local cached read-only export, re-read and verify the manifest/backup, restore bytes into a **new** file, point `OFFICE_OPS_FILE_ID` to it, and from the Apps Script editor run `ooRecoveryValidateSource_()` while `OFFICE_OPS_ENABLED=0` and the latch remains `1`; a thrown redacted error means stop, while success requires this explicit mapping: manifest `sourceFileId` equals the incident old source ID, manifest `backupFileId` equals the selected backup ID, logged `sourceFileId` equals both the new restored file ID and current `OFFICE_OPS_FILE_ID`, logged `schemaVersion` equals manifest `schemaVersion`, logged `revision` equals manifest `preMutationRevision`, and logged `byteLength`/`sha256Hex` equal both the manifest and re-read backup bytes; only after recording every comparison may the representative set `OFFICE_OPS_RECOVERY_REQUIRED=0`, and enabling remains a separate approval; (8) never delete/overwrite the old ID, and return to a previous deployment version if code rollback is needed.

Normal OfficeOps enablement does not enable conversion. The runbook must show all five conversion actions returning `conversion-disabled` while reads and non-conversion mutations remain testable. Promotion requires separate written approval after both the actual commercial relay verification and browser conversion/resume E2E pass; the promotion commit changes only `ooConversionOperationallyEnabled_(){return false;}` to literal `true`, reruns static/server/browser suites, records the reviewed commit and deployment version, and makes no Script Property or allowlist change. Rollback changes that literal back to `false` and redeploys; it never weakens token/latch/enabled gates.

State explicitly that no automated email/calendar/fetch, user notification, order creation, static-site deployment, account setting, or property/file/deployment operation is authorized by this plan.

- [ ] **Step 4: Run documentation and isolated suites to verify they pass**

Run: `node tests/office-ops-pure.unit.js && node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js`

Expected: all PASS with no real Drive file, property, deployment, or external API operation.

- [ ] **Step 5: Commit the activation boundary**

```bash
git add apps-script-office-ops/OfficeOps.gs apps-script-office-ops/README_APPS_SCRIPT.md tests/office-ops-server.unit.js tests/office-ops-server-isolation.check.js
git commit -m "docs: gate OfficeOps activation behind verified recovery"
```

### Task 6: Run full regression and verify source-tree separation before handoff

**Files:**
- Modify: `tests/office-ops-server-isolation.check.js`
- Modify: `apps-script-office-ops/README_APPS_SCRIPT.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: all new OfficeOps sources/tests and existing hyeonjang test runner.
- Produces: an evidence-based integration handoff for a future UI implementation, without changing the UI now.

- [ ] **Step 1: Add failing tests for disabled/no-external-action contracts**

```js
const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
assert.match(source, /OFFICE_OPS_ENABLED/);
assert.match(source, /OFFICE_OPS_RECOVERY_REQUIRED/);
assert.equal(source.includes('MailApp'), false);
assert.equal(source.includes('CalendarApp'), false);
assert.equal(source.includes('UrlFetchApp'), false);
assert.match(readme, /disabled.*device-local cached read-only export/i);
assert.match(readme, /does not create an aptOrder/i);
assert.match(agents, /apps-script-commercial\/.*separate Apps Script project/i);
assert.match(agents, /apps-script-office-ops\/.*separate Apps Script project/i);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/office-ops-server-isolation.check.js`

Expected: FAIL until the source and README make disabled/read-only and no-order authority explicit.

- [ ] **Step 3: Add the future UI contract without implementing UI code**

Document that a later hyeonjang UI plan must store `OFFICE_OPS_TOKEN` only in device-local settings, never in public Office browser/session data; it must use a fresh mutation ID per HTTP attempt, preserve idempotency key for one logical create, show revision conflicts for manual merge, never auto-retry offline, and allow only device-local last-normal-data export while disabled because the disabled server rejects reads and writes. It must pass a separately verified commercial approval and a distinct local paid-work gate before any inspection conversion causes a local order; conversion actions stay inactive until those integration tests pass, this relay merely records the conversion handshake, and it never calls hyeonjang state.

Update `AGENTS.md` in the repository map and verification section with two explicit entries: `apps-script-commercial/` and `apps-script-office-ops/` are independent source-only Apps Script projects, each requires its own manual deployment and Script Properties, neither shares `APP_TOKEN`, and neither is deployed by a Pages merge. Preserve the existing restrictions and wording for `apps-script/`; do not broaden that legacy folder's allowed modification scope.

- [ ] **Step 4: Run complete tests and inspect allowed diffs**

Run: `node tests/office-ops-pure.unit.js && node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js && node tests/run-all.js && git diff --exit-code -- apps-script apps-script-commercial index.html sw.js`

Expected: every new test and existing hyeonjang regression passes; the final diff command exits 0, proving legacy relay and PWA source remain untouched.

- [ ] **Step 5: Commit final isolation verification**

```bash
git add AGENTS.md apps-script-office-ops/README_APPS_SCRIPT.md tests/office-ops-server-isolation.check.js
git commit -m "test: prove OfficeOps failures cannot alter field operations"
```

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-office-ops-relay.md`. Implement it as an isolated Apps Script project with review after each task. The real Drive JSON initialization, property assignment, deployment, feature enablement, client token entry, and any customer or external-system action require separate explicit representative approval.

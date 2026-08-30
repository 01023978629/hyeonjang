# OfficeOps Relay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an independently deployable, internal-only Apps Script OfficeOps relay that keeps commercial operations in a separately identified JSON file with strict schema, concurrency, backup, archive/restore, and retention controls.

**Architecture:** Create `apps-script-office-ops/` as a second standalone Apps Script project, separate from both `apps-script/` and `apps-script-commercial/`. Its allowlisted internal actions authenticate with `OFFICE_OPS_TOKEN`, operate only on the exact `OFFICE_OPS_FILE_ID`, serialize every mutation with `LockService`, preserve verified byte-for-byte backups before each mutation, and expose no public browser/session action. Pure validation and mutation functions are tested with fake Apps Script dependencies; server tests inject fake Drive, Clock, Lock, Properties, and Utilities services.

**Tech Stack:** Google Apps Script V8 (`ContentService`, `DriveApp`, `PropertiesService`, `Utilities`, `LockService`), JavaScript ES5-compatible `.gs` source, Node.js `node:test`/`assert` VM unit tests.

**Spec:** `C:\Users\1dncj\Documents\New project\manmool\docs\superpowers\specs\2026-08-30-revenue-operations-expansion-design.md` (§7, §8.2, §9–§11, §13)

## Global Constraints

- Do not modify `apps-script/`, `index.html`, `sw.js`, existing photo relay behavior, `OfficeIntake`, existing project storage, or `aptOrders`.
- Create and deploy `apps-script-office-ops/` as a new, separate Apps Script project, entrypoint, deployment, and property namespace; it must not share sources or dispatch with `apps-script/` or `apps-script-commercial/`.
- Use only `OFFICE_OPS_FILE_ID`, `OFFICE_OPS_ENABLED`, `OFFICE_OPS_RECOVERY_REQUIRED`, and `OFFICE_OPS_TOKEN`. `OFFICE_OPS_RECOVERY_REQUIRED` is the durable fail-closed write latch, initialized to `0`; it is never a client-controlled field. `OFFICE_OPS_TOKEN` must differ from `APP_TOKEN`, every public OfficeIntake session token, and `COMMERCIAL_APPROVAL_TOKEN`.
- Permit no public browser call, OfficeIntake session token, legacy `APP_TOKEN`, or unauthenticated request. Every action is internal and must authenticate its separate token without logging it.
- Implement only `officeOpsList`, pilot/consent/inspection/opportunity create-update-archive-restore actions, the five inspection conversion actions, and `officeOpsRetentionList`; reject `load`, `save`, `upload`, `officeInbox`, `officeAccept`, `officeSetStatus`, and every unknown action.
- Store only pilots, renewal consents, inspections, opportunities, and metadata-only audit data. Inspections may retain validated `commercialTerms`, `commercialApproval` metadata, `conversionId`, `conversionReceiptId`, `conversionTermsSha256`, `pendingOrderId`, `linkedOrderId`, and server KST `conversionStartedAt`; this is metadata, not a commercial API call. Never store resident names, unit numbers, phone numbers, photos, quote originals, full project state, evidence bytes, session tokens, receipt HMAC keys, or Drive blobs in OfficeOps.
- The exact file ID in `OFFICE_OPS_FILE_ID` must point to exactly one non-trashed JSON file named `관리사무소영업운영.json`. Because this standalone project deliberately cannot read legacy property namespaces, the representative must prove at initialization that this ID differs from the existing data and OfficeIntake file IDs; the server then verifies only its exact configured ID, display name, non-trashed status, and strict schema on every read/write. General requests never search by filename and never create a new store file.
- Require schema version `1`, nonnegative integer `revision`, whole-second KST `updatedAt`, exactly `pilots`, `consents`, `inspections`, `opportunities`, and `audit` arrays; reject unknown top-level or nested fields, duplicate IDs across all four arrays, invalid states, malformed JSON, unsupported schema, and display-name mismatch without overwriting the source file. Pilot and opportunity rows include the server-owned `retentionStartedAt`; inspection rows include the server-owned `conversionStartedAt`.
- Every request, including `officeOpsList` and `officeOpsRetentionList`, requires an RFC 3339 timestamp that passes the same calendar, clock, offset, and five-minute freshness rules as the commercial relay's `caParseRequestTimestamp_`; browser UTC `new Date().toISOString()` and valid explicit offsets such as `+09:00` are accepted. Stored datetimes are stricter whole-second KST `YYYY-MM-DDTHH:mm:ss+09:00` values. Every mutation additionally requires a new `mutationId`. Creates also require a 16–80 character `[A-Za-z0-9_-]+` `idempotencyKey`; same key/same canonical payload returns the first exact acknowledgement reconstructed from audit, same key/different payload returns `idempotency-conflict`, repeated mutation ID returns `replay-request`, and stale timestamps return `stale-request` before idempotency lookup.
- Updates, archives, restores, and conversion commands require `expectedRevision`; use `LockService` to serialize mutation and fail with `revision-conflict` without overwriting newer data.
- Before every mutation, copy the exact UTF-8 source bytes to `관리사무소영업운영_백업_YYYYMMDD_HHmmss.json`, create a paired `.manifest.json` containing `sourceFileId`, `backupFileId`, `createdAt`, `schemaVersion`, `preMutationRevision`, `byteLength`, and lowercase SHA-256, then re-read both files, strict-parse the manifest, and verify every field plus the backup hash. Mutation proceeds only after the verified pair succeeds. On any copy/manifest/re-read/parse/hash failure, mark both new artifacts as cleanup candidates and leave source bytes/revision unchanged. Drive may contain same-name files created within one second; pair and order them by `preMutationRevision`, `createdAt`, and immutable file IDs, retaining exactly the latest ten complete verified pairs.
- Archive is a tombstone for pilots, inspections, and opportunities: preserve item ID, set `archivedAt`, `archivedBy`, `archiveReason`, and later `restoredAt`; exclude archived entries from default lists and operational statistics. Consents use withdrawal records rather than archive. First release never permanently deletes data.
- Retention list includes closed pilots, skip/closed opportunities, withdrawn consents, and archived tombstones once their one-KST-calendar-year reference date is reached. `retentionStartedAt` is set only when a pilot enters `closed` or an opportunity enters `skip|closed`, preserved while that terminal state remains, and cleared if the row leaves it. Archive uses `archivedAt` instead; archive wins if one row has both reasons. Restore retains the ID and resets only the archive retention start to a subsequent archive. February 29 falls back to February 28 in the following non-leap year. First release lists but never automatically deletes eligible rows.
- Do not call `MailApp`, `CalendarApp`, `UrlFetchApp`, SMS, Kakao, Naver booking APIs, `commercialNow`, `commercialApprovalIssue`, `commercialApprovalVerify`, or any external service. Inspection receipt metadata is permitted, but OfficeOps never invokes a commercial API. Do not automatically retry or queue offline work.
- `OFFICE_OPS_ENABLED=0` rejects every server read and mutation, including `officeOpsList`; only a previously validated device-local `office_ops_cache` may be exported read-only by the future UI. That stale export path must not create, edit, draft, convert orders, generate contact drafts, or call the server. Existing hyeonjang features remain functional.
- The conversion handlers are handshake-only infrastructure and remain operationally disabled until the separate commercial relay and browser paid-work gate/recovery plan both pass their integration tests. OfficeOps never creates or transitions a local order.
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
| pilot/inspection/opportunity archive or restore | exact record ID, `expectedRevision`, archive additionally `archiveReason` | `{ok:true,id,revision,updatedAt}` | `not-found`, `already-archived`, `not-archived`, `revision-conflict` |
| `officeConsentRecord` / `officeConsentWithdraw` | record: exactly `idempotencyKey,subjectType,subjectId,purpose,intervalMonths,channel,consentVersion,consentTextSnapshot,consentTextSha256,recordedBy,consentedAt,evidenceType,evidenceId`; withdraw: exactly `consentId,expectedRevision,withdrawnBy,withdrawalReason`; server supplies withdrawal time and both audit events | `{ok:true,id,revision,updatedAt}` | `invalid-consent`, `already-withdrawn`, `unknown-field`, `revision-conflict` |
| inspection conversion actions | exact fields in Task 4's conversion table; every action includes `inspectionId`, `conversionId`, and `expectedRevision` | `{ok:true,id,revision,updatedAt}` | `invalid-conversion-state`, `receipt-mismatch`, `terms-mismatch`, `revision-conflict` |
| `officeOpsRetentionList` | exactly `{}` | `{ok:true,rows,serverNowKst}` | `office-disabled`, `unauthorized`, `stale-request`, `invalid-input`, `unknown-field` |

Common request errors are `bad-request`, `unauthorized`, `office-disabled`, `manual-recovery-required`, `recovery-state-unknown`, `stale-request`, `replay-request`, `idempotency-conflict`, `lock-unavailable`, `invalid-store`, `invalid-input`, `unknown-field`, and `server-error`. An unexpected key returns `unknown-field`; a missing required key or invalid value returns `invalid-input` or the action's narrower domain error. Every request checks the recovery latch before enabled/action dispatch and fails closed while it is `1` or unreadable. No error returns a token, secret, receipt HMAC, evidence file ID, or source bytes.

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
for (const forbidden of ['OfficeIntake', 'officeInbox', 'officeAccept', 'officeSetStatus', 'loadData_', 'saveData_', 'serializeData', 'aptOrders', 'MailApp', 'CalendarApp', 'UrlFetchApp', 'commercialNow(', 'commercialApprovalIssue(', 'commercialApprovalVerify(']) {
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
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 131072) return ooOut_(ooFail_('bad-request'));
  var request; try { request = JSON.parse(raw); } catch (_) { return ooOut_(ooFail_('bad-request')); }
  return ooOut_(ooDoPost_(request));
}
```

Set V8 and `Asia/Seoul` in the new manifest. `ooDoPost_` authenticates without logging, then reads `OFFICE_OPS_RECOVERY_REQUIRED` before enabled/action dispatch; only exact string `0` may continue, while `1`, missing, unreadable, or any other value returns `manual-recovery-required`. Do not add public action handlers or reuse the production `apps-script/Code.gs` dispatcher. Write the complete README property, deployment, rollback, and approval-boundary contract required by Task 5; it must state that this is a separate, representative-approved deployment.

- [ ] **Step 4: Run the isolation test to verify it passes**

Run: `node tests/office-ops-server-isolation.check.js`

Expected: PASS and `git diff -- apps-script index.html sw.js` is empty.

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
- Produces: `ooValidateRequestEnvelope_(request, isRead, nowMs)`, `ooParseRequestTimestamp_(value)`, `ooParseKstDateTime_(value)`, `ooValidateStore_(store)`, `ooValidateAuditRow_(row)`, `ooCanonicalMutation_(action, payload)`, `ooValidateMutationEnvelope_(request, nowMs)`, `ooValidatePilot_(pilot)`, `ooValidatePilotCreate_(payload, nowKst)`, `ooPilotEndsAtKst_(startDateKst)`, `ooValidateConsentAuditEvent_(event)`, `ooValidateConsent_(consent)`, `ooValidateConsentCreate_(payload, nowKst)`, `ooWithdrawConsent_(consent, withdrawnBy, reason, nowKst)`, `ooNextDueAtKst_(consentedAt, intervalMonths)`, `ooConsentActive_(consent, nowMs)`, `ooDueConsents_(consents, nowMs)`, `ooValidateInspection_(inspection)`, `ooValidateInspectionCreate_(payload, nowKst)`, `ooValidateOpportunity_(opportunity)`, `ooValidateOpportunityCreate_(payload, nowKst)`, `ooOfficialKaptUrl_(value)`, `ooCanOpportunityParticipate_(opportunity, serverNowMs, requestTimestampMs)`, `ooCanonicalCommercialTerms_(terms)`, `ooTermsSha256_(terms)`, `ooValidateApprovalMetadata_(approvalMetadata)`, `ooApprovalProofMatches_(approvalMetadata, payload, termsSha256)`, `ooReceiptId_(approvalMetadata)`, `ooNewRecordId_(kind)`, `ooArchive_(record, actor, reason, nowKst)`, `ooRestore_(record, actor, nowKst)`, `ooAddOneKstYear_(referenceAt)`, `ooRetentionRows_(store, nowMs)`.

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
assert.equal(sandbox.ooPilotEndsAtKst_('2026-08-31'), '2026-09-29T23:59:59+09:00');
assert.equal(sandbox.ooPilotEndsAtKst_('2028-02-01'), '2028-03-01T23:59:59+09:00');
const consent = sandbox.ooValidateConsent_({ consentId:'consent_test', subjectType:'aptOrder', subjectId:'order01', purpose:'preventive-reinspection', intervalMonths:6, channel:'phone', consentVersion:'reinspection-v1', consentTextSnapshot:'재점검 연락에 동의합니다.', consentTextSha256:'a'.repeat(64), recordedBy:'대표', consentedAt:'2026-08-31T10:00:00+09:00', withdrawnAt:null, withdrawnBy:null, withdrawalReason:null, nextDueAt:'2027-02-28', lastContactedAt:null, evidenceType:'message', evidenceId:'record_test', audit:[{event:'recorded',at:'2026-08-31T10:00:00+09:00',actor:'대표',reason:null}] });
assert.equal(consent.ok, true);
assert.equal(sandbox.ooNextDueAtKst_('2026-08-31T10:00:00+09:00', 6), '2027-02-28');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, intervalMonths:9 }).error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, lastContactedAt:'2026-09-01T10:00:00+09:00' }).error, 'invalid-consent');
assert.equal(sandbox.ooValidateConsent_({ ...consent.value, audit:[...consent.value.audit, {event:'recorded',at:'2026-09-01T10:00:00+09:00',actor:'대표',reason:null}] }).error, 'invalid-consent');
const withdrawn = sandbox.ooWithdrawConsent_(consent.value, '대표', '철회', '2026-09-01T10:00:00+09:00');
assert.equal(withdrawn.withdrawnAt, '2026-09-01T10:00:00+09:00');
assert.deepEqual(withdrawn.audit.at(-1), {event:'withdrawn',at:'2026-09-01T10:00:00+09:00',actor:'대표',reason:'철회'});
assert.equal(sandbox.ooConsentActive_(withdrawn, Date.parse('2026-09-01T10:00:01+09:00')), false);
assert.deepEqual(sandbox.ooDueConsents_([consent.value, withdrawn], Date.parse('2027-02-28T12:00:00+09:00')).map(x => x.consentId), ['consent_test']);
const inspection = { inspectionId:'inspection_test', officeId:'office_test', complexName:'테스트 단지', templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-02', riskItems:['배수 확인'], summary:'접근 허가 후 점검', commercialTerms:null, commercialApproval:null, conversionId:null, conversionTermsSha256:null, conversionReceiptId:null, pendingOrderId:null, linkedOrderId:null, conversionStartedAt:null, updatedAt:'2026-08-31T10:00:00+09:00', archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null };
assert.equal(sandbox.ooValidateInspection_(inspection).ok, true);
assert.equal(sandbox.ooValidateInspection_({ ...inspection, conversionStartedAt:'2026-08-31T10:00:00+09:00' }).error, 'invalid-inspection');
const opportunity = { opportunityId:'opp_test', complexName:'테스트 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1', observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관', deadlineAt:'2026-09-01T10:00:00+09:00', stage:'review', requirements:['면허 확인'], verifiedBy:'대표', notes:'', retentionStartedAt:null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null };
assert.equal(sandbox.ooCanOpportunityParticipate_(opportunity, Date.parse('2026-08-31T10:05:00+09:00'), Date.parse('2026-08-31T10:00:30+09:00')), true);
assert.equal(sandbox.ooCanOpportunityParticipate_(opportunity, Date.parse('2026-08-31T10:05:01+09:00'), Date.parse('2026-08-31T10:00:00+09:00')), false);
const commercial = sandbox.ooCanonicalCommercialTerms_({ workKind:'device-diagnosis', scope:'  욕실 누수 장비 진단  ', exclusions:['복구 공사','타일'], vatMode:'included', quotedAmount:100000, validUntil:'2026-09-30', scheduleWindow:'  2026-09-02 오후  ' });
const commercialJson = '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}';
assert.equal(commercial.json, commercialJson);
assert.equal(commercial.sha256Hex, crypto.createHash('sha256').update(commercialJson).digest('hex'));
assert.equal(sandbox.ooAddOneKstYear_('2028-02-29T10:00:00+09:00'), '2029-02-28T10:00:00+09:00');
const duePilot = { ...pilot.value, stage:'closed', retentionStartedAt:'2026-08-31T10:00:00+09:00' };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[duePilot] }, Date.parse('2027-08-31T10:00:00+09:00')), [{recordType:'pilot',recordId:'pilot_test',reason:'closed',referenceAt:'2026-08-31T10:00:00+09:00',eligibleAt:'2027-08-31T10:00:00+09:00'}]);
const archivedDuePilot = { ...duePilot, archivedAt:'2026-09-01T10:00:00+09:00', archivedBy:'representative', archiveReason:'정리', restoredAt:null };
assert.deepEqual(sandbox.ooRetentionRows_({ ...empty, pilots:[archivedDuePilot] }, Date.parse('2027-09-01T10:00:00+09:00')), [{recordType:'pilot',recordId:'pilot_test',reason:'archived',referenceAt:'2026-09-01T10:00:00+09:00',eligibleAt:'2027-09-01T10:00:00+09:00'}]);
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

Pilot records use `stage`, never `status`, and accept only `new|contacted|meeting|pilot|converted|closed`. `pilotStartedAt` and `pilotEndsAt` are either both null or valid KST datetimes; `pilot` requires both. Without an extension, the end equals the start KST calendar date plus 30 calendar days minus one second. An extended end requires `extensionApprovedAt` and must be later than the normal end. `retentionStartedAt` is server-generated on first entry to `closed`, is preserved while closed, and is null outside closed.

Consent `audit` rows are exactly `{event,at,actor,reason}`. `event` is `recorded|withdrawn`; recorded uses `reason:null`, withdrawal uses its bounded reason. Require `purpose==='preventive-reinspection'`, `subjectType==='project'|'aptOrder'`, `intervalMonths===6|12`, `channel==='sms'|'phone'|'kakao'`, `consentVersion==='reinspection-v1'`, a lower-case 64-hex text hash, and `evidenceType==='signed-document'|'message'|'recorded-call-note'`. The first audit row is exactly `{event:'recorded',at:<server create KST>,actor:recordedBy,reason:null}`. An active consent has all three withdrawal fields null and exactly that one audit row; a withdrawn consent has non-null `withdrawnAt,withdrawnBy,withdrawalReason` and exactly one additional final row `{event:'withdrawn',at:withdrawnAt,actor:withdrawnBy,reason:withdrawalReason}`. `ooValidateConsent_` requires `lastContactedAt===null` for every current-schema row. Create forces `withdrawn*` and `lastContactedAt` to null and appends the recorded event. `ooWithdrawConsent_` rejects caller-supplied `withdrawnAt`, uses server KST, appends the withdrawal event, immediately makes the consent inactive, and removes it from `ooDueConsents_`. Due rows are active consents with `nextDueAt` on or before the server KST date, sorted by `nextDueAt,consentId`. There is no contact-record mutation in this release, so `lastContactedAt` stays null and no automatic send is added.

Inspection create and ordinary update accept only `planned|checked|proposal|closed`, require `commercialApproval:null`, and require every conversion identity field including `conversionStartedAt` to remain server-owned null. `commercialTerms` may be null or an exact valid commercial term object. Ordinary update is rejected in `conversion-pending|conversion-writing|conversion-local-committed|converted` and cannot directly create a conversion state. The conversion state validator requires: pending/writing have full terms, the full signed approval metadata, conversion/order/receipt/hash IDs and `conversionStartedAt`, but null `linkedOrderId`; local-committed/converted additionally require `linkedOrderId===pendingOrderId`. A normal `closed` row has no conversion identity. Begin is the only action that can atomically attach approval and populate conversion identity.

Opportunity stages are exactly `watch|review|participate|skip|closed`. `retentionStartedAt` is server-generated on first entry to `skip|closed`, preserved while that terminal state remains, and null outside those stages. Test exact K-apt HTTPS host, no custom port or userinfo, fragment removal while query survives, required observed/verified/deadline fields, equality/past-deadline rejection for participation, and device/server time difference `<= 5 * 60 * 1000`. Also test 100-character complex-name, 2,000-character notes/summary, at most 20 ordered `riskItems`/`requirements`, and 200-character item limits.

`ooValidatePilot_` and `ooValidateConsent_` validate normalized stored rows only, after the server assigns `pilotId`/`consentId`, timestamps, tombstones, and audit array. `ooValidatePilotCreate_` and `ooValidateConsentCreate_` validate the corresponding network payloads: they reject caller-supplied record IDs and then construct the normalized row before passing it to the stored-row validator. This keeps server-generated IDs compatible with exact-key validation and the canonical action maps.

`ooValidateInspection_` and `ooValidateOpportunity_` likewise validate only normalized stored rows. Their create helpers reject caller IDs and every server-owned timestamp, tombstone, retention, and conversion field. Pilot, inspection, and opportunity updates are exact full replacements of all client-editable business fields plus the record ID and `expectedRevision`; they are not partial patches. The server preserves or recalculates all server-owned fields. A missing editable field returns `invalid-input`; an extra field returns `unknown-field`.

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
function ooValidateConsentAuditEvent_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !ooExactKeys_(value, ['event','at','actor','reason']) ||
      ['recorded','withdrawn'].indexOf(value.event) < 0 || ooParseKstDateTime_(value.at) === null ||
      typeof value.actor !== 'string' || !value.actor || value.actor.length > 100) return false;
  return value.event === 'recorded' ? value.reason === null : typeof value.reason === 'string' && !!value.reason && value.reason.length <= 500;
}
function ooValidateConsent_(value) {
  var required = ['consentId','subjectType','subjectId','purpose','intervalMonths','channel','consentVersion','consentTextSnapshot','consentTextSha256','recordedBy','consentedAt','withdrawnAt','withdrawnBy','withdrawalReason','nextDueAt','lastContactedAt','evidenceType','evidenceId','audit'];
  if (!ooExactKeys_(value, required) || !/^consent_[A-Za-z0-9_-]{1,100}$/.test(value.consentId || '') || ['project','aptOrder'].indexOf(value.subjectType) < 0 || !/^[A-Za-z0-9_-]{1,160}$/.test(value.subjectId || '') || value.purpose !== 'preventive-reinspection' || [6,12].indexOf(value.intervalMonths) < 0 || ['sms','phone','kakao'].indexOf(value.channel) < 0 || value.consentVersion !== 'reinspection-v1' || typeof value.consentTextSnapshot !== 'string' || !value.consentTextSnapshot || !/^[0-9a-f]{64}$/.test(value.consentTextSha256 || '') || typeof value.recordedBy !== 'string' || !value.recordedBy || ooParseKstDateTime_(value.consentedAt) === null || value.nextDueAt !== ooNextDueAtKst_(value.consentedAt, value.intervalMonths) || value.lastContactedAt !== null || ['signed-document','message','recorded-call-note'].indexOf(value.evidenceType) < 0 || !/^[A-Za-z0-9_-]{1,200}$/.test(value.evidenceId || '') || !Array.isArray(value.audit) || !value.audit.length || !value.audit.every(ooValidateConsentAuditEvent_)) return ooFail_('invalid-consent');
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
  return ooValidateConsent_({ consentId:'consent_normalized_for_validation', subjectType:payload.subjectType, subjectId:payload.subjectId, purpose:payload.purpose, intervalMonths:payload.intervalMonths, channel:payload.channel, consentVersion:payload.consentVersion, consentTextSnapshot:payload.consentTextSnapshot, consentTextSha256:payload.consentTextSha256, recordedBy:payload.recordedBy, consentedAt:payload.consentedAt, withdrawnAt:null, withdrawnBy:null, withdrawalReason:null, nextDueAt:ooNextDueAtKst_(payload.consentedAt, payload.intervalMonths), lastContactedAt:null, evidenceType:payload.evidenceType, evidenceId:payload.evidenceId, audit:[{event:'recorded',at:nowKst,actor:payload.recordedBy,reason:null}] });
}
function ooValidatePilotCreate_(payload, nowKst) {
  var keys = ooValidatePayloadFields_(payload, OO_CANONICAL_FIELDS_.officePilotCreate); if (!keys.ok) return keys;
  return ooValidatePilot_({ pilotId:'pilot_normalized_for_validation', complexName:payload.complexName, source:payload.source, stage:payload.stage, pilotStartedAt:payload.pilotStartedAt, pilotEndsAt:payload.pilotEndsAt, extensionApprovedAt:payload.extensionApprovedAt, nextActionAt:payload.nextActionAt, owner:payload.owner, notes:payload.notes, createdAt:nowKst, updatedAt:nowKst, retentionStartedAt:payload.stage === 'closed' ? nowKst : null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null });
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
  if (!ooExactKeys_(value, OO_APPROVAL_META_FIELDS_) || !/^receipt_[A-Za-z0-9_-]{1,80}$/.test(value.receiptId || '') ||
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

`commercialApproval` canonicalization preserves exactly the eleven signed fields `receiptId,subjectType,subjectId,approvedTermsSha256,approvalEvidenceType,approvalEvidenceFileId,approvalEvidenceSha256,approvedAt,approvedByRole,issuedAt,receiptHmac` so conversion recovery can send the same immutable receipt back to the separate commercial relay for verification. `ooValidateApprovalMetadata_` mirrors `caIsReceipt_(receipt,true)`: receipt suffix 1–80 characters, subject ID 1–160, evidence ID 1–200, lower-case 64-hex hashes/HMAC, exact enums, real whole-second KST datetimes, and `issuedAt>=approvedAt`. OfficeOps stores no evidence bytes and no secret HMAC key; `receiptHmac` is the signed receipt value, not the signing key. Cryptographic HMAC, current evidence-file hash, expiry, and trusted-time verification remain the separate commercial relay/local paid-work gate's responsibility and are a hard precondition to conversion. Missing, extra, or malformed receipt fields fail closed.

Store audit rows use the exact global shape defined above. `ooValidateAuditRow_` requires `result==='ok'`, a valid mutation ID, create-only `idempotencyKey` or null, lower-case payload/backup SHA-256, whole-second KST `at`, `actor==='representative'`, nonempty immutable backup IDs, nonnegative `preMutationRevision`, and `lifecycleBefore===null` or the exact four tombstone fields. Archive/restore record only previous tombstone metadata; arbitrary notes, full payloads, and receipts never enter audit.

`ooRetentionRows_` returns exact rows `{recordType,recordId,reason,referenceAt,eligibleAt}`. `recordType` is exactly `pilot|consent|inspection|opportunity`; `reason` is exactly `archived|closed|skip|withdrawn` and must be legal for that record type. It uses `archivedAt` first for any archived pilot/inspection/opportunity; otherwise it uses pilot `retentionStartedAt` with reason `closed`, consent `withdrawnAt` with reason `withdrawn`, and opportunity `retentionStartedAt` with its current `skip|closed` stage as reason. Thus `referenceAt` is exactly the selected stored timestamp, not a recalculated close time. Archive wins rather than returning duplicate reasons. `eligibleAt` is one KST calendar year after `referenceAt` with February 29 falling back to February 28; include equality and sort by `eligibleAt,recordType,recordId`. Restore removes the archive reason, and a still-terminal restored row may independently qualify from its preserved terminal `retentionStartedAt`. No deletion is performed.

Use explicit per-record and per-action allowlists, never silently drop unknown fields, and compute server-owned dates from KST. Consent withdrawal accepts no caller-supplied `withdrawnAt`; the server records `ooNowKst_()`. Nested records use fixed documented key order rather than runtime object sorting; `consentTextSnapshot` and ordered arrays retain their original order. Reject unknown `action` before canonicalization. Do not add a consent-contact action, automatic messaging, generic patch API, permanent deletion, employee roles, or any twenty-second action; the exact 21-action allowlist remains unchanged.

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
- Produces: `ooReadStore_(sourceFile)`, `ooBackupPair_(sourceFile, sourceBytes, store)`, `ooMutate_(request)`, `ooDispatch_(action, request)`, the editor-only zero-argument `ooRecoveryValidateSource_()`, and all allowlisted handlers. `ooMutate_` supplies the only actor value, exact server-owned `'representative'`; no request can choose it.

- [ ] **Step 1: Write failing server tests with fake Apps Script dependencies**

```js
const properties = {
  OFFICE_OPS_ENABLED:'1', OFFICE_OPS_RECOVERY_REQUIRED:'0', OFFICE_OPS_TOKEN:'TEST_ONLY_OFFICE_OPS_TOKEN', OFFICE_OPS_FILE_ID:'TEST_OFFICE_OPS_FILE'
};
const pilotPayload = { idempotencyKey:'create_pilot_123456', complexName:'테스트 단지', source:'website', stage:'pilot', pilotStartedAt:'2026-08-31T09:00:00+09:00', pilotEndsAt:'2026-09-29T23:59:59+09:00', extensionApprovedAt:null, nextActionAt:'2026-09-01', owner:'대표', notes:'' };
const first = post('officePilotCreate', pilotPayload);
assert.equal(first.ok, true);
const retried = post('officePilotCreate', pilotPayload);
assert.deepEqual(retried, first);
assert.equal(post('officePilotCreate', { ...pilotPayload, complexName:'다른 단지' }).error, 'idempotency-conflict');
assert.equal(postWithMutationId(firstMutationId, 'officePilotCreate', firstPayload).error, 'replay-request');
assert.equal(postAt('2026-08-31T09:54:59+09:00', 'officePilotCreate', newPayload).error, 'stale-request');
assert.equal(drive.files.filter(file => /_백업_.*\.json$/.test(file.name)).length, 1);
assert.equal(drive.files.filter(file => /_백업_.*\.manifest\.json$/.test(file.name)).length, 1);
```

The fake Drive file must hold raw bytes, distinguish source/update/backup reads, support injected errors for backup copy, manifest creation, backup re-read, and source write, and provide `setTrashed`. The fake lock records acquire/release calls and can refuse acquisition. The fake clock supplies a fixed KST instant. Add assertions that every failed backup leaves source bytes and revision exactly unchanged.

- [ ] **Step 2: Run the server test to verify it fails**

Run: `node tests/office-ops-server.unit.js`

Expected: FAIL because there is no exact-ID store, lock, idempotency, or verified backup implementation.

- [ ] **Step 3: Implement store validation and locked mutation sequence**

```js
function ooMutate_(request) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return ooFail_('lock-unavailable');
  try {
    var source = ooSourceFile_();
    var loaded = ooReadStore_(source); if (!loaded.ok) return loaded;
    var envelope = ooValidateMutationEnvelope_(request, ooNowMs_()); if (!envelope.ok) return envelope;
    var replay = ooFindMutation_(loaded.store, request.mutationId); if (replay) return ooFail_('replay-request');
    var canonical = ooCanonicalMutation_(request.action, request.payload); if (!canonical.ok) return canonical;
    var idempotent = ooFindIdempotentCreate_(loaded.store, request.action, request.payload.idempotencyKey, canonical.sha256Hex);
    if (idempotent) return idempotent;
    var domainReplay = ooFindSafeConversionReplay_(loaded.store, request, canonical); if (domainReplay) return domainReplay;
    var prepared = ooPrepareMutation_(loaded.store, request, 'representative', canonical); if (!prepared.ok) return prepared;
    var backup = ooBackupPair_(source, loaded.bytes, loaded.store); if (!backup.ok) return backup;
    var armed = ooArmRecoveryLatch_(); if (!armed.ok) return armed;
    return ooWritePrepared_(source, loaded, prepared, backup);
  } finally { lock.releaseLock(); }
}
function ooBackupPair_(source, bytes, store) {
  var stamp = ooBackupStamp_(ooNowMs_());
  var backup = source.getParents().next().createFile('관리사무소영업운영_백업_' + stamp + '.json', Utilities.newBlob(bytes, 'application/json'));
  var manifest = { sourceFileId:source.getId(), backupFileId:backup.getId(), createdAt:ooNowKst_(), schemaVersion:store.schemaVersion, preMutationRevision:store.revision, byteLength:bytes.length, sha256Hex:ooSha256BytesHex_(bytes) };
  var manifestFile = source.getParents().next().createFile('관리사무소영업운영_백업_' + stamp + '.manifest.json', JSON.stringify(manifest), 'application/json');
  var reread; try { reread = JSON.parse(manifestFile.getBlob().getDataAsString('UTF-8')); } catch (_) { return ooCleanupFailedPair_(backup, manifestFile, 'backup-verify-failed'); }
  if (!ooExactKeys_(reread, ['sourceFileId','backupFileId','createdAt','schemaVersion','preMutationRevision','byteLength','sha256Hex']) ||
      reread.sourceFileId !== source.getId() || reread.backupFileId !== backup.getId() || reread.schemaVersion !== store.schemaVersion ||
      reread.preMutationRevision !== store.revision || reread.byteLength !== bytes.length || reread.sha256Hex !== ooSha256BytesHex_(backup.getBlob().getBytes())) {
    return ooCleanupFailedPair_(backup, manifestFile, 'backup-verify-failed');
  }
  return { ok:true, backupFileId:backup.getId(), manifestFileId:manifestFile.getId(), manifest:reread };
}
```

`ooDispatch_` obtains one server-time snapshot and calls `ooValidateRequestEnvelope_` for every read and mutation before any handler. Reads therefore use the same request-timestamp parser and five-minute freshness boundary as writes; list accepts only `{}` or exact `{includeArchived:boolean}`, retention accepts only `{}`, and neither accepts `mutationId`. The dispatcher then uses the same validated request object rather than reparsing an alternative `ts` or `requestAtKst` field.

`ooPrepareMutation_` deep-clones and fully validates the requested state/revision transition before any backup or latch; it cannot access Drive or Properties. `actor` is always the server-derived exact value `'representative'`, never a caller payload. Only a valid prepared candidate proceeds to backup, latch arm, audit enrichment, serialization, and `ooWritePrepared_`. Pilot, inspection, and opportunity update handlers consume the exact full-replacement payloads from Task 2; they preserve or recalculate server-owned timestamps, retention, tombstone, conversion, and audit fields rather than accepting them from the caller.

`ooRecoveryValidateSource_()` is a named zero-argument Apps Script editor entrypoint, never an allowlisted web action. It runs only when `OFFICE_OPS_ENABLED==='0'` and `OFFICE_OPS_RECOVERY_REQUIRED==='1'`; wrong flags, missing/wrong source, malformed bytes, schema failure, or hash failure throw a redacted `Error('recovery-validation-failed:<code>')` so the Apps Script Run visibly fails. On success it invokes `ooSourceFile_()`, `ooReadStore_()`, strict schema validation, and a source-byte SHA-256, constructs only `{ok:true,sourceFileId,schemaVersion,revision,byteLength,sha256Hex}`, writes that sanitized tuple once with `Logger.log(JSON.stringify(result))`, and returns the same tuple. It never reads/logs/returns the token, clears the latch, changes enabled state, writes Drive, or exposes record contents. Server tests capture Logger and thrown errors for a valid restored file, malformed source, wrong flags, and verify visible success/failure, exact sanitized keys, zero writes, no token/record content, and absence from `ooIsAllowedAction_`.

Implement `ooSourceFile_` with `DriveApp.getFileById(OFFICE_OPS_FILE_ID)` only, reject missing IDs and all name/schema failures before any write, and never call `getFilesByName`. Legacy ID noncollision is a representative initialization check because this standalone property namespace cannot inspect legacy IDs. After freshness and mutation-replay validation, `ooFindIdempotentCreate_` immediately returns null unless `action` is one of the four create actions and the payload has a validated key; for those actions it searches only successful create audit rows by exact `action+idempotencyKey`. Equal `payloadSha256` returns exactly `{ok:true,id:audit.id,revision:audit.preMutationRevision+1,updatedAt:audit.at}`, while a different hash returns `idempotency-conflict`. The replay creates no backup, audit, revision, or source write. `ooFindSafeConversionReplay_` accepts only the exact immediately reached begin/arm/record/finalize proof and returns the stored normal acknowledgement without backup, audit, revision increment, or source write; changed proof, stale timestamp, repeated mutation ID, or a non-conversion action cannot use it.

Write source JSON only after successful backup and manifest re-read verification. Increment revision once and set `updatedAt` to one server whole-second KST snapshot. Enrich exactly one prepared audit row with `{action,result:'ok',id,mutationId,idempotencyKey,payloadSha256,at:updatedAt,actor:'representative',lifecycleBefore,backupFileId,backupManifestFileId,backupSha256,preMutationRevision}`; create uses its validated key, all other actions use `null`, and archive/restore alone carry the exact prior tombstone object. Validate the complete enriched candidate before serialization, write, re-read, and strict store validation. Pair retention uses manifest `preMutationRevision`, `createdAt`, and immutable file IDs rather than filename; keep exactly the latest ten complete verified pairs and mark only older complete pairs for cleanup.

Drive `setContent` is not claimed to be atomic. Immediately before any source write, while the lock is held, `ooArmRecoveryLatch_` sets `OFFICE_OPS_RECOVERY_REQUIRED=1` and reads it back; if either step fails or does not equal `1`, mutation aborts before touching source. Every request checks this property first and returns `manual-recovery-required` while it is `1` or unreadable. If the source write throws or the re-read does not validate, `ooRestoreSourceAfterFailedWrite_` writes the already verified backup bytes back to the same exact source, re-reads and hashes them. If restoration or its verification fails, no clear is attempted: the previously verified armed latch remains `1`, the code returns only `{ok:false,error:'manual-recovery-required'}`, preserves the backup pair, and performs no cleanup/retention. Only after a verified new commit or verified restoration may `ooClearRecoveryLatch_` write `0`. If its read-back confirms `0`, the server returns the normal success or restored `write-verify-failed`. If the clear write/read-back throws or cannot confirm `0`, the code returns `recovery-state-unknown` and preserves the pair; it does not claim the property is still `1`, because a non-transactional clear may already have persisted. This ambiguity is safe because clear is attempted only after source bytes and schema are verified: the next request either observes `0` and may use the verified source, or observes `1`/unreadable and remains blocked. The plan never promises unchanged source bytes when both the primary write and verified restoration fail.

- [ ] **Step 4: Run server tests and inject each backup failure**

Run: `node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js`

Expected: both PASS.

Retain separate test cases for manual setup noncollision documentation, wrong display name, malformed JSON, schema version 2, duplicate record ID, lock unavailable, revision mismatch, backup-copy failure, manifest-create failure, manifest re-read/parse/field mismatch, backup re-read failure, backup hash mismatch, latch arm write/readback failure before source write, source write throw before modification, partial/corrupt write followed by verified restore, restore throw, restore hash mismatch, latch clear write/read-back failure after restore, latch clear write/read-back failure after a valid commit, and successful source re-read validation. Prove the committed audit row has exactly the Task 2 fields and verified backup values. Create once, retry the same action/key/canonical hash with a fresh mutation ID and timestamp, and require the byte-identical first acknowledgement reconstructed from audit with zero Drive write; then reuse that key with one changed canonical field and require `idempotency-conflict`. Reuse the first mutation ID and require `replay-request` before idempotency lookup; make the retry stale and require `stale-request` before lookup.

Add eleven same-second mutations and prove exactly the newest ten complete pairs remain in pre-mutation revision order despite duplicate filenames. Before the source write begins, every failure must leave raw source bytes/revision unchanged. A partial/corrupt write must either restore byte-for-byte, confirm latch clear, and return `write-verify-failed`, or preserve the pair with no clear attempt and the durable latch still `1`, return `manual-recovery-required`, and reject all later calls. Inject a Script Property arm failure and prove source is untouched. For clear ambiguity after verified bytes, require `recovery-state-unknown`; separately simulate actual persisted `0` (next call may use the verified source) and retained `1`/unreadable (next call remains blocked). Never claim or test that a failed clear read-back proves the property stayed `1`.

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
- Produces: all 21 allowlisted OfficeOps handlers, including `officeInspectionBeginConversion`, `officeInspectionArmLocalCommit`, `officeInspectionRecordLocalCommit`, `officeInspectionFinalizeConversion`, and `officeInspectionCancelConversion`.

- [ ] **Step 1: Write failing lifecycle and conversion tests**

```js
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
assert.equal(post('officeInspectionArmLocalCommit', { ...beginPayload, expectedRevision:begin.revision }).error, 'revision-conflict');
assert.equal(post('officeInspectionBeginConversion', { ...beginPayload, receiptSubjectId:'other_order', expectedRevision:cancelled.revision }).error, 'receipt-mismatch');
```

Add state-machine tests for: an inspection create/update accepts `commercialTerms:null|valid-canonical-terms` but requires `commercialApproval:null`; ordinary create/update cannot enter any conversion state and is rejected once begin has succeeded; a failed begin leaves the proposal bytes/revision unchanged; successful begin atomically stores and freezes the normalized exact-key `commercialTerms`, full signed `commercialApproval`, and server KST `conversionStartedAt`; terms/approval or archive/restore changes are rejected after begin. Cancel is allowed only in `conversion-pending`, retains the normalized proposal terms, and clears approval plus every conversion identity field including `conversionStartedAt`; arm rejects a cancel race. Writing with no local order permits the same `pendingOrderId` recovery only; writing with an existing local order may record it but cannot create another; record and finalize revalidate `conversionId`, `pendingOrderId`, `linkedOrderId`, `receiptId`, `receiptSubjectType==='aptOrder'`, `receiptSubjectId===pendingOrderId`, and `termsSha256` against the values frozen by begin; any mismatch blocks finalize and all subsequent paid transition handoff. For begin, arm, record, and finalize, an exact frozen-proof replay after a lost response returns the prior successful `{ok,id,revision,updatedAt}` even when the caller has the pre-success `expectedRevision`; a different proof remains a conflict. Test record replay with a fresh mutation ID and prove no duplicate local-order identity can be recorded. Keep the test server-local; it does not create an `aptOrder`.

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

Run: `node tests/office-ops-pure.unit.js && node tests/office-ops-server.unit.js && node tests/office-ops-server-isolation.check.js && node tests/run-all.js && git diff --exit-code -- apps-script index.html sw.js`

Expected: every new test and existing hyeonjang regression passes; the final diff command exits 0, proving legacy relay and PWA source remain untouched.

- [ ] **Step 5: Commit final isolation verification**

```bash
git add AGENTS.md apps-script-office-ops/README_APPS_SCRIPT.md tests/office-ops-server-isolation.check.js
git commit -m "test: prove OfficeOps failures cannot alter field operations"
```

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-office-ops-relay.md`. Implement it as an isolated Apps Script project with review after each task. The real Drive JSON initialization, property assignment, deployment, feature enablement, client token entry, and any customer or external-system action require separate explicit representative approval.

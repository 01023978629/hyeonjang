# OfficeOps Apps Script source

This is an independently deployable, source-only Apps Script project for
internal OfficeOps records. It is separate from the field relay and the
commercial approval project. A repository change does not create a Script
Property, Drive file, deployment, customer action, or browser configuration.
Nothing below authorizes an external action; these are representative-only
instructions for a separately approved manual operation.

## Representative-controlled initialization

Perform each step in this order, only after separate written representative
approval:

1. Run the OfficeOps tests and the full hyeonjang regression from the local
   source checkout.
2. Create a **new** standalone Apps Script project from this directory. Do not
   copy sources into the field relay or commercial approval project.
3. Manually create exactly one non-trashed UTF-8 JSON file named
   `관리사무소영업운영.json`. Its initial schema v1 document has exactly these
   fields (use the actual creation-time KST timestamp for `updatedAt`):

   ```json
   {
     "schemaVersion": 1,
     "revision": 0,
     "updatedAt": "2026-08-31T00:00:00+09:00",
     "pilots": [],
     "consents": [],
     "inspections": [],
     "opportunities": [],
     "audit": []
   }
   ```

   The initial document therefore means `schemaVersion: 1`, not a future
   schema or a file with extra top-level fields.
4. Before recording any property, compare the new file ID with the existing
   field-data file ID and the existing OfficeIntake file ID. Record all three
   redacted identifiers and the explicit two comparisons in a representative
   checklist; both comparisons must prove that the new ID is different.
5. In the **new project only**, set the four Script Properties listed below.
   Use a distinct internal token, set `OFFICE_OPS_RECOVERY_REQUIRED=0`, and set
   `OFFICE_OPS_ENABLED=0`. Do not put any value in repository files, browser
   storage shared with OfficeIntake, a public page, or a chat transcript.
6. Deploy a new web-app version. With the relay still disabled, prove that an
   authenticated list and an authenticated mutation both return
   `office-disabled`; do not expose a public Office UI. Record version, date,
   and pass/fail evidence in the redacted checklist.
7. Only after a separate written approval, change **only**
   `OFFICE_OPS_ENABLED` to `1`, test a redacted list success path, and record
   the result. Enabling is not implied by deployment, recovery, or a code
   merge.

The complete and exclusive property namespace is:

- `OFFICE_OPS_FILE_ID` — the exact new OfficeOps JSON Drive file ID.
- `OFFICE_OPS_ENABLED` — explicit server enablement. While `0`, every server
  read and mutation is rejected; only a previously validated device-local
  cached read-only export may be available to a future UI.
- `OFFICE_OPS_RECOVERY_REQUIRED` — durable write-recovery latch. It is
  initialized to `0`; missing, unreadable, or any other value fails closed.
- `OFFICE_OPS_TOKEN` — distinct internal token. It is never logged, stored in
  public browser/session data, or reused from another project.

## Recovery, validation, and rollback boundary

On `manual-recovery-required`, stop ordinary access immediately. Keep
`OFFICE_OPS_RECOVERY_REQUIRED=1` and `OFFICE_OPS_ENABLED=0`; do not clear the
latch first and do not enable the relay. The only permitted user-facing data
path is a device-local cached read-only export. It must not create, edit,
contact, convert, or send anything.

The representative re-reads the verified backup and its manifest, then restores
the verified bytes into a **new** JSON file. The old incident source file must
be preserved: do not overwrite or delete the incident source file. Update
`OFFICE_OPS_FILE_ID` to the new restored file only for this manual recovery
procedure, then run the editor-only `ooRecoveryValidateSource_()` while the
relay remains disabled and the latch remains set.

Do not delete the incident source file, even after a restored replacement has
passed validation.

Record a sanitized validator log with every comparison below; it must not
contain tokens, source bytes, resident data, evidence bytes, or full IDs.

| Required comparison | Required equality |
| --- | --- |
| Manifest `sourceFileId` | The old incident source file ID |
| Manifest `backupFileId` | The selected verified backup file ID |
| Validator logged `sourceFileId` | The new restored file ID and current `OFFICE_OPS_FILE_ID` |
| Validator logged `schemaVersion` | Manifest `schemaVersion` |
| Validator logged `revision` | Manifest `preMutationRevision` |
| Validator logged `byteLength` | Manifest `byteLength` and re-read backup byte length |
| Validator logged lowercase SHA-256 | Manifest lowercase SHA-256 and re-read backup lowercase SHA-256 |

Any thrown or mismatched validation result is a stop condition. Only after all
comparisons match and are recorded may the representative obtain a separate
written approval to change `OFFICE_OPS_RECOVERY_REQUIRED` to `0`. A further,
separate written approval is still required before changing
`OFFICE_OPS_ENABLED` to `1`.

Future mutation work retains the latest ten verified backup pairs. A code
rollback may select a previous web-app deployment version, but never authorizes
deleting, overwriting, or reusing the incident source file. OfficeOps records
conversion metadata only and does not create an `aptOrder`.

No automated email, calendar, network fetch, customer notification, order
creation, static-site deployment, account setting, property/file/deployment
operation, customer message, or paid-service setting is authorized by this
document or repository change.

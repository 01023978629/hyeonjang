# OfficeOps Apps Script source

This directory is a standalone, source-only Apps Script project for internal
OfficeOps records. It is separate from the field relay and from the commercial
approval project. A repository change does not create a Script Property, Drive
file, deployment, customer action, or browser configuration.

## Representative-controlled setup

Only after separate written representative approval may the representative
create a new Apps Script project from this directory and set its own Script
Properties. `OFFICE_OPS_FILE_ID` must identify one non-trashed UTF-8 JSON file
named `관리사무소영업운영.json`; it must be a different Drive ID from every
existing field-data and intake-data file. The representative records IDs only
in a redacted checklist.

The only property names used by this project are:

- `OFFICE_OPS_FILE_ID` — exact OfficeOps storage file ID.
- `OFFICE_OPS_TOKEN` — separate internal token, never a field, browser, or
  commercial token and never recorded in source, logs, or client-visible data.
- `OFFICE_OPS_RECOVERY_REQUIRED` — durable recovery latch. It starts as `0`;
  any missing, unreadable, or other value is fail-closed.
- `OFFICE_OPS_ENABLED` — explicit server enablement flag. `0` rejects every
  read and mutation; a future UI may only provide a device-local cached
  read-only export while disabled.

Before enabling, the representative deploys a new web-app version and verifies
that an authenticated list and mutation both return `office-disabled`. Enabling
the service is a later, separately approved property-only action. The
representative records deployment version, date, and pass/fail evidence.

## Recovery and rollback boundary

Before every future mutation implementation, the project will retain the
latest ten verified backup pairs. If recovery is required, leave the relay
disabled, inspect the backup and manifest, restore into a new file, and run the
editor-only `ooRecoveryValidateSource_()` validation while the service remains
disabled. Do not clear the recovery latch before verified recovery. A previous
web-app deployment version may be selected for a code rollback; do not
overwrite or delete the incident source file.

No automated email, calendar, network fetch, customer notification, order
creation, static-site deployment, account change, property change, file
creation, or deployment is authorized by this source directory. OfficeOps
records conversion metadata only and does not create an `aptOrder`.

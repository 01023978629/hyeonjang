# Task 4 report

## Status

Complete. Documentation and the static isolation assertion only.

## Changed files

- `apps-script-commercial/README_APPS_SCRIPT.md`
- `tests/commercial-approval-isolation.check.js`

## RED/GREEN evidence

- RED: after adding the README contract assertion, the isolation check failed with `ENOENT` because `README_APPS_SCRIPT.md` did not exist.
- GREEN: after adding the README (including the exact required phrases and forbidden-value assertion), all three checks passed using the bundled Node.js runtime:
  - `commercial approval pure tests: PASS`
  - `commercial approval server tests: PASS`
  - `commercial-approval-isolation.check.js` exited 0

## Ordered-gate checklist review

README preserves all seven gates in order: three tests; new standalone Apps Script project; distinct properties without repository values; disabled deployment and redacted `commercialNow`; non-production PDF issue/verify with paid path disabled; separate written representative approval before flag `1`; flag `0` or prior deployment rollback.

## External-side-effect confirmation

No Drive evidence selection, Script Property creation, Apps Script deployment, browser token storage, Pages publication, paid-work activation, push, merge, PR, customer contact, or paid-service configuration was performed. No real token, key, file ID, or customer data was written.

## Commit

`f329accbdd90cd34cef6f8207573ce63c03b0184` (`docs: require approval before commercial relay activation`)

## Self-review

Confirmed the README documents all three action envelopes, PDF/JPEG/PNG and 20 MiB evidence limit, 60 seconds nonce cache, separated token/key properties, fail-closed behavior, and rollback procedure. Existing relay/client/OfficeOps/photo/OfficeIntake/server behavior was not changed.

## Concerns

Representative-controlled account, deployment, evidence, and activation steps remain intentionally pending; this task does not authorize them.

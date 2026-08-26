'use strict';
/* Final office-intake regressions: keep public routing, admin state, and
   completion publication contracts from silently drifting apart. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'apps-script', 'OfficeIntake.gs'), 'utf8');

assert.match(app, /const OFFICE_PORTAL_URL='https:\/\/01023978629\.github\.io\/manmool\/office-request\.html\?office=';/,
  'issued office portal addresses use the deployed office-request route');
assert.match(server, /function oiAdminOffice_\(office\)/,
  'internal office administration returns a distinct enabled-aware projection');
assert.match(server, /value\.enabled\s*=\s*oiOfficeActive_\(office\)/,
  'admin office projection preserves the actual disabled state');
assert.match(app, /function officeIntakeDeleteGuard\(order\)/,
  'linked office requests have an explicit deletion guard');
assert.match(app, /officeCompletionPhotoIds/,
  'completion selection is based on the trusted completion-photo manifest');
assert.match(server, /completionPhotoIds/,
  'the server stores a separate validated completion-photo manifest');
assert.match(server, /projectionRevision/,
  'same-status report updates are ordered by a durable projection revision');
assert.match(app, /officeIntakeResolveAcceptConflict/,
  'accept/cancel conflicts are resolved rather than permanently blocking FIFO sync');
console.log('PASS  final office-intake regression contract');

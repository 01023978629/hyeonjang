const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PROJECT = path.join(ROOT, 'apps-script-office-ops');
const SOURCE_NAMES = ['Code.gs', 'OfficeOpsPure.gs', 'OfficeOps.gs'];
const source = SOURCE_NAMES.map(name => fs.readFileSync(path.join(PROJECT, name), 'utf8')).join('\n');

const allowedActions = [
  'officeOpsList',
  'officePilotCreate',
  'officePilotUpdate',
  'officePilotArchive',
  'officeConsentRecord',
  'officeConsentWithdraw',
  'officeInspectionCreate',
  'officeInspectionUpdate',
  'officeInspectionArchive',
  'officeInspectionBeginConversion',
  'officeInspectionArmLocalCommit',
  'officeInspectionRecordLocalCommit',
  'officeInspectionFinalizeConversion',
  'officeInspectionCancelConversion',
  'officeOpportunityCreate',
  'officeOpportunityUpdate',
  'officeOpportunityArchive',
  'officePilotRestore',
  'officeInspectionRestore',
  'officeOpportunityRestore',
  'officeOpsRetentionList'
];

for (const action of allowedActions) {
  assert.equal(source.includes("'" + action + "'"), true, action + ' is allowlisted');
}

for (const forbidden of [
  'OfficeIntake',
  'officeInbox',
  'officeAccept',
  'officeSetStatus',
  'loadData_',
  'saveData_',
  'serializeData',
  'aptOrders',
  'MailApp',
  'CalendarApp',
  'UrlFetchApp',
  'commercialNow(',
  'commercialApprovalIssue(',
  'commercialApprovalVerify('
]) {
  assert.equal(source.includes(forbidden), false, forbidden + ' must not enter OfficeOps');
}

for (const field of ['commercialTerms', 'commercialApproval', 'conversionReceiptId', 'conversionTermsSha256']) {
  assert.equal(source.includes(field), true, field + ' must remain metadata-only OfficeOps state');
}

assert.equal(fs.existsSync(path.join(PROJECT, 'README_APPS_SCRIPT.md')), true, 'OfficeOps runbook exists');
assert.equal(fs.existsSync(path.join(PROJECT, 'appsscript.json')), true, 'OfficeOps manifest exists');

const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT, 'appsscript.json'), 'utf8'));
assert.equal(manifest.runtimeVersion, 'V8');
assert.equal(manifest.timeZone, 'Asia/Seoul');

assert.doesNotThrow(() => {
  childProcess.execFileSync('git', ['diff', '--exit-code', '--', 'apps-script', 'index.html', 'sw.js'], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'OfficeOps must not modify the legacy relay or PWA sources');

console.log('office-ops-server-isolation.check.js: PASS');

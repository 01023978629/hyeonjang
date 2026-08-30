const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PROJECT = path.join(ROOT, 'apps-script-office-ops');
const SOURCE_NAMES = ['Code.gs', 'OfficeOpsPure.gs', 'OfficeOps.gs'];
const source = SOURCE_NAMES.map(name => fs.readFileSync(path.join(PROJECT, name), 'utf8')).join('\n');
const codeSource = fs.readFileSync(path.join(PROJECT, 'Code.gs'), 'utf8');
const readme = fs.readFileSync(path.join(PROJECT, 'README_APPS_SCRIPT.md'), 'utf8');
const BASE = '19657c3';

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

const sandbox = {};
vm.runInNewContext(codeSource, sandbox, { filename: 'Code.gs' });
assert.deepEqual(Array.from(sandbox.OO_ALLOWED_ACTIONS_), allowedActions, 'Code.gs must expose exactly the planned 21 actions in order');

const allowedPropertyKeys = [
  'OFFICE_OPS_FILE_ID',
  'OFFICE_OPS_ENABLED',
  'OFFICE_OPS_RECOVERY_REQUIRED',
  'OFFICE_OPS_TOKEN'
];
assert.deepEqual(Array.from(sandbox.OO_SCRIPT_PROPERTY_KEYS_), allowedPropertyKeys, 'Code.gs declares the complete OfficeOps property namespace');

const sourcePropertyKeys = Array.from(source.matchAll(/['"]([A-Z][A-Z0-9_]*(?:_TOKEN|_FILE_ID|_ENABLED|_RECOVERY_REQUIRED))['"]/g), match => match[1]);
assert.deepEqual([...new Set(sourcePropertyKeys)].sort(), [...allowedPropertyKeys].sort(), 'production source permits no legacy or arbitrary Script Property key');

const scriptPropertyReads = Array.from(codeSource.matchAll(/getProperty\(\s*([^)]*?)\s*\)/g), match => match[1]);
assert.deepEqual(scriptPropertyReads, [
  "'OFFICE_OPS_TOKEN'",
  "'OFFICE_OPS_RECOVERY_REQUIRED'",
  "'OFFICE_OPS_ENABLED'"
], 'Task 1 may read only its three active property keys; FILE_ID stays declared for later store access');

const documentedPropertyKeys = Array.from(readme.matchAll(/`(OFFICE_[A-Z0-9_]+)`/g), match => match[1]);
assert.deepEqual([...new Set(documentedPropertyKeys)].sort(), [...allowedPropertyKeys].sort(), 'README documents exactly the four OfficeOps Script Properties');

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
  childProcess.execFileSync('git', ['merge-base', '--is-ancestor', BASE, 'HEAD'], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'HEAD must descend from the fixed Task 1 base');

assert.doesNotThrow(() => {
  childProcess.execFileSync('git', ['diff', '--exit-code', BASE, 'HEAD', '--', 'apps-script', 'index.html', 'sw.js', '.superpowers/sdd/.gitignore'], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'OfficeOps commits must preserve every protected path from the fixed Task 1 base');

assert.doesNotThrow(() => {
  childProcess.execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'apps-script', 'index.html', 'sw.js', '.superpowers/sdd/.gitignore'], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'OfficeOps must not leave an uncommitted protected-path change');

for (const phrase of [
  'schemaVersion: 1',
  '관리사무소영업운영.json',
  'OfficeIntake',
  'OFFICE_OPS_RECOVERY_REQUIRED=1',
  'OFFICE_OPS_ENABLED=0',
  'sourceFileId',
  'backupFileId',
  'schemaVersion',
  'preMutationRevision',
  'byteLength',
  'lowercase SHA-256',
  'sanitized validator log',
  'do not delete the incident source file'
]) {
  assert.equal(readme.toLowerCase().includes(phrase.toLowerCase()), true, 'README must state ' + phrase);
}

console.log('office-ops-server-isolation.check.js: PASS');

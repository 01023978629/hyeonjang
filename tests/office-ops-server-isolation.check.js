const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PROJECT = path.join(ROOT, 'apps-script-office-ops');
const SOURCE_NAMES = ['Code.gs', 'OfficeOpsPure.gs', 'OfficeOps.gs'];
const sourceByName = Object.fromEntries(SOURCE_NAMES.map(name => [name, fs.readFileSync(path.join(PROJECT, name), 'utf8')]));
const source = SOURCE_NAMES.map(name => sourceByName[name]).join('\n');
const codeSource = sourceByName['Code.gs'];
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

function maskNonCode(sourceText) {
  const chars = sourceText.split('');
  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] === '/' && chars[index + 1] === '/') {
      for (index += 2; index < chars.length && chars[index] !== '\n'; index += 1) chars[index] = ' ';
      continue;
    }
    if (chars[index] === '/' && chars[index + 1] === '*') {
      chars[index] = ' ';
      chars[index + 1] = ' ';
      for (index += 2; index < chars.length && !(chars[index] === '*' && chars[index + 1] === '/'); index += 1) chars[index] = chars[index] === '\n' ? '\n' : ' ';
      if (index < chars.length) {
        chars[index] = ' ';
        chars[index + 1] = ' ';
      }
      continue;
    }
    if (chars[index] === "'" || chars[index] === '"' || chars[index] === '`') {
      const quote = chars[index];
      chars[index] = ' ';
      for (index += 1; index < chars.length; index += 1) {
        if (chars[index] === '\\') {
          chars[index] = ' ';
          if (index + 1 < chars.length) chars[++index] = ' ';
          continue;
        }
        if (chars[index] === quote) {
          chars[index] = ' ';
          break;
        }
        chars[index] = chars[index] === '\n' ? '\n' : ' ';
      }
    }
  }
  return chars.join('');
}

function findScriptPropertyCalls(sourceText) {
  const masked = maskNonCode(sourceText);
  const calls = [];
  const pattern = /\b(getProperty|setProperty|deleteProperty|getProperties|setProperties|deleteAllProperties)\b\s*\(/g;
  for (const match of masked.matchAll(pattern)) {
    const method = match[1];
    const openParen = masked.indexOf('(', match.index + method.length);
    const literal = sourceText.slice(openParen + 1).match(/^\s*(['"])([A-Z0-9_]+)\1\s*\)/);
    calls.push({ method, key: literal ? literal[2] : null });
  }
  return calls;
}

function assertScriptPropertyBoundary(sources) {
  const calls = Object.values(sources).flatMap(findScriptPropertyCalls);
  for (const call of calls) {
    assert.equal(
      ['getProperties', 'setProperties', 'deleteAllProperties'].includes(call.method),
      false,
      'whole-namespace Script Property access is forbidden: ' + call.method
    );
    assert.notEqual(call.key, null, 'dynamic Script Property key is forbidden: ' + call.method);
    assert.equal(allowedPropertyKeys.includes(call.key), true, 'unapproved Script Property key: ' + call.key);
  }
  return calls;
}

assert.deepEqual(
  assertScriptPropertyBoundary(sourceByName),
  [
    { method: 'getProperty', key: 'OFFICE_OPS_TOKEN' },
    { method: 'getProperty', key: 'OFFICE_OPS_RECOVERY_REQUIRED' },
    { method: 'getProperty', key: 'OFFICE_OPS_ENABLED' }
  ],
  'Task 1 may read only its three active property keys; FILE_ID stays declared for later store access'
);

assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + "\nfunction ooBadProperty_() { return PropertiesService.getScriptProperties().getProperty('ARBITRARY_CONFIG'); }\n" }),
  /unapproved Script Property key: ARBITRARY_CONFIG/
);
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + '\nfunction ooBadProperty_(name) { return PropertiesService.getScriptProperties().getProperty(name); }\n' }),
  /dynamic Script Property key is forbidden/
);
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + '\nfunction ooBadProperty_() { return PropertiesService.getScriptProperties().getProperties(); }\n' }),
  /whole-namespace Script Property access is forbidden/
);

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

const untrackedProtected = childProcess.execFileSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', 'apps-script', 'index.html', 'sw.js', '.superpowers/sdd/.gitignore'],
  { cwd: ROOT, encoding: 'utf8' }
);
assert.equal(untrackedProtected, '', 'OfficeOps must not add untracked files beneath protected paths');

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
assert.equal(
  readme.includes('The internal sanitized success tuple includes the exact `sourceFileId`'),
  true,
  'README must preserve the exact source ID inside the editor-only success tuple'
);
assert.equal(
  readme.includes('External checklists and reports use redacted IDs only'),
  true,
  'README must distinguish internal exact validation from externally shared redaction'
);
assert.match(
  readme,
  /internal sanitized success tuple contains the exact `sourceFileId` and no\s+token, source bytes, or PII/i,
  'README must keep the internal tuple exact but secret- and PII-free'
);

console.log('office-ops-server-isolation.check.js: PASS');

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const PROJECT = path.join(ROOT, 'apps-script-office-ops');
function listGsFiles(directory, relativeDirectory = '') {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return listGsFiles(path.join(directory, entry.name), relativePath);
      return entry.isFile() && entry.name.endsWith('.gs') ? [relativePath] : [];
    });
}

const productionFiles = listGsFiles(PROJECT);
assert.equal(productionFiles.includes('Code.gs'), true, 'OfficeOps dispatcher source exists');
const sourceByName = Object.fromEntries(productionFiles.map(name => [name, fs.readFileSync(path.join(PROJECT, name), 'utf8')]));
const source = productionFiles.map(name => sourceByName[name]).join('\n');
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

function tokenizeJavascript(sourceText) {
  const tokens = [];
  for (let index = 0; index < sourceText.length;) {
    const character = sourceText[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '/' && sourceText[index + 1] === '/') {
      index = sourceText.indexOf('\n', index + 2);
      if (index < 0) break;
      continue;
    }
    if (character === '/' && sourceText[index + 1] === '*') {
      index = sourceText.indexOf('*/', index + 2);
      if (index < 0) break;
      index += 2;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character;
      let value = '';
      for (index += 1; index < sourceText.length; index += 1) {
        if (sourceText[index] === '\\') {
          value += sourceText[index + 1] || '';
          index += 1;
          continue;
        }
        if (sourceText[index] === quote) {
          index += 1;
          break;
        }
        value += sourceText[index];
      }
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      const start = index;
      for (index += 1; index < sourceText.length && /[A-Za-z0-9_$]/.test(sourceText[index]); index += 1) {}
      tokens.push({ type: 'identifier', value: sourceText.slice(start, index) });
      continue;
    }
    tokens.push({ type: 'punctuation', value: character });
    index += 1;
  }
  return tokens;
}

const scriptPropertyMethods = new Set(['getProperty', 'setProperty', 'deleteProperty']);
const wholeNamespaceMethods = new Set(['getProperties', 'setProperties', 'deleteAllProperties']);
const allPropertyMethods = new Set([...scriptPropertyMethods, ...wholeNamespaceMethods]);

function findScriptPropertyCalls(sourceText) {
  const tokens = tokenizeJavascript(sourceText);
  const functionAliases = new Map();
  const methodAliases = new Map();
  const calls = [];

  for (let index = 0; index + 3 < tokens.length; index += 1) {
    if (!['var', 'let', 'const'].includes(tokens[index].value) || tokens[index + 1].type !== 'identifier' || tokens[index + 2].value !== '=') continue;
    const alias = tokens[index + 1].value;
    const assigned = tokens[index + 3];
    if (assigned.type === 'string' && allPropertyMethods.has(assigned.value)) methodAliases.set(alias, assigned.value);
    for (let scan = index + 3; scan + 1 < tokens.length && tokens[scan].value !== ';'; scan += 1) {
      if (tokens[scan].value === '.' && allPropertyMethods.has(tokens[scan + 1].value)) {
        functionAliases.set(alias, tokens[scan + 1].value);
        break;
      }
    }
  }

  for (let index = 0; index + 2 < tokens.length; index += 1) {
    const method = tokens[index + 1].value;
    if (tokens[index].value === '.' && allPropertyMethods.has(method) && tokens[index + 2].value === '(') {
      calls.push({ method, key: tokens[index + 3] && tokens[index + 3].type === 'string' ? tokens[index + 3].value : null, via: 'direct' });
      continue;
    }
    if (tokens[index].value === '[' && tokens[index + 2].value === ']' && tokens[index + 3] && tokens[index + 3].value === '(') {
      const bracketMethod = tokens[index + 1];
      if ((bracketMethod.type === 'string' && allPropertyMethods.has(bracketMethod.value)) ||
          (bracketMethod.type === 'identifier' && methodAliases.has(bracketMethod.value))) {
        calls.push({ method: methodAliases.get(bracketMethod.value) || bracketMethod.value, key: null, via: bracketMethod.type === 'string' ? 'bracket-literal' : 'bracket-dynamic' });
      }
      continue;
    }
    if (tokens[index].type === 'identifier' && functionAliases.has(tokens[index].value) && tokens[index + 1].value === '(') {
      calls.push({ method: functionAliases.get(tokens[index].value), key: null, via: 'function-alias' });
    }
  }
  return calls;
}

function assertScriptPropertyBoundary(sources) {
  const calls = Object.keys(sources).sort().flatMap(name => findScriptPropertyCalls(sources[name]));
  for (const call of calls) {
    assert.equal(call.via === 'bracket-literal', false, 'bracket Script Property method access is forbidden: ' + call.method);
    assert.equal(call.via === 'bracket-dynamic', false, 'dynamic Script Property method access is forbidden: ' + call.method);
    assert.equal(call.via === 'function-alias', false, 'indirect Script Property method alias is forbidden: ' + call.method);
    assert.equal(wholeNamespaceMethods.has(call.method), false, 'whole-namespace Script Property access is forbidden: ' + call.method);
    assert.notEqual(call.key, null, 'dynamic Script Property key is forbidden: ' + call.method);
    assert.equal(allowedPropertyKeys.includes(call.key), true, 'unapproved Script Property key: ' + call.key);
  }
  return calls;
}

assert.deepEqual(
  assertScriptPropertyBoundary(sourceByName),
  [
    { method: 'getProperty', key: 'OFFICE_OPS_TOKEN', via: 'direct' },
    { method: 'getProperty', key: 'OFFICE_OPS_RECOVERY_REQUIRED', via: 'direct' },
    { method: 'getProperty', key: 'OFFICE_OPS_ENABLED', via: 'direct' }
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
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + "\nfunction ooBadProperty_() { return properties['getProperties'](); }\n" }),
  /bracket Script Property method access is forbidden/
);
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + "\nfunction ooBadProperty_() { return properties['getProperty']('ARBITRARY_CONFIG'); }\n" }),
  /bracket Script Property method access is forbidden/
);
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + "\nfunction ooBadProperty_() { var f = properties.getProperty; return f('ARBITRARY_CONFIG'); }\n" }),
  /indirect Script Property method alias is forbidden/
);
assert.throws(
  () => assertScriptPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + "\nfunction ooBadProperty_() { var method = 'getProperty'; return properties[method]('ARBITRARY_CONFIG'); }\n" }),
  /dynamic Script Property method access is forbidden/
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

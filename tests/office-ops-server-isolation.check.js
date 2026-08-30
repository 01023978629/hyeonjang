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

const rawPropertyMethods = new Set(['getProperty', 'setProperty', 'deleteProperty', 'getProperties', 'setProperties', 'deleteAllProperties']);
const wrapperNames = new Set(['ooGetScriptProperty_', 'ooSetScriptProperty_']);

function allSourceTokens(sources) {
  return Object.keys(sources).sort().flatMap(name => tokenizeJavascript(sources[name]).map(token => ({ ...token, sourceName: name })));
}

function identifierCount(tokens, value) {
  return tokens.filter(token => token.type === 'identifier' && token.value === value).length;
}

function wrapperCalls(tokens, name) {
  return tokens.flatMap((token, index) => {
    if (token.type !== 'identifier' || token.value !== name || !tokens[index + 1] || tokens[index + 1].value !== '(') return [];
    if (tokens[index - 1] && tokens[index - 1].value === 'function') return [];
    return [{ key: tokens[index + 2] && tokens[index + 2].type === 'string' ? tokens[index + 2].value : null }];
  });
}

function bracketBypasses(tokens) {
  const methodAliases = new Map();
  for (let index = 0; index + 3 < tokens.length; index += 1) {
    if (!['var', 'let', 'const'].includes(tokens[index].value) || tokens[index + 1].type !== 'identifier' || tokens[index + 2].value !== '=') continue;
    if (tokens[index + 3].type === 'string') methodAliases.set(tokens[index + 1].value, tokens[index + 3].value);
  }
  const blockedNames = new Set([...rawPropertyMethods, ...wrapperNames]);
  const bypasses = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value !== '[') continue;
    let close = index + 1;
    while (close < tokens.length && tokens[close].value !== ']') close += 1;
    if (!tokens[close] || !tokens[close + 1] || tokens[close + 1].value !== '(') continue;
    const expression = tokens.slice(index + 1, close);
    const joinedStrings = expression.filter(token => token.type === 'string').map(token => token.value).join('');
    const alias = expression.length === 1 && expression[0].type === 'identifier' ? methodAliases.get(expression[0].value) : null;
    if (blockedNames.has(joinedStrings) || blockedNames.has(alias)) bypasses.push(joinedStrings || alias);
  }
  return bypasses;
}

function assertCentralizedPropertyBoundary(sources) {
  for (const sourceText of Object.values(sources)) {
    assert.equal(sourceText.includes('`'), false, 'backtick syntax is outside the OfficeOps ES5 source boundary');
  }
  const tokens = allSourceTokens(sources);
  const rawFactories = tokens.filter((token, index) => token.value === 'PropertiesService' && tokens[index + 1] && tokens[index + 1].value === '.' && tokens[index + 2] && tokens[index + 2].value === 'getScriptProperties' && tokens[index + 3] && tokens[index + 3].value === '(');
  assert.equal(rawFactories.length, 1, 'PropertiesService.getScriptProperties must appear only in ooScriptProperties_');
  assert.equal(rawFactories[0].sourceName, 'Code.gs', 'raw PropertiesService access belongs only in Code.gs');
  assert.equal(identifierCount(tokens, 'PropertiesService'), 1, 'raw PropertiesService references are centralized');
  assert.equal(identifierCount(tokens, 'getScriptProperties'), 1, 'raw getScriptProperties references are centralized');

  const rawMethods = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (tokens[index].value === '.' && rawPropertyMethods.has(tokens[index + 1].value) && tokens[index + 2].value === '(') {
      rawMethods.push({ method: tokens[index + 1].value, sourceName: tokens[index].sourceName });
    }
  }
  assert.deepEqual(rawMethods, [
    { method: 'getProperty', sourceName: 'Code.gs' },
    { method: 'setProperty', sourceName: 'Code.gs' }
  ], 'only central getter and setter wrappers may directly access Script Properties');
  assert.equal(identifierCount(tokens, 'ooScriptProperties_'), 3, 'ooScriptProperties_ appears only as its definition and in the get/set wrappers');
  assert.equal(identifierCount(tokens, 'ooScriptPropertyKeyAllowed_') >= 3, true, 'key allowlist guards both property wrappers');
  assert.deepEqual(bracketBypasses(tokens), [], 'computed Property and wrapper method access is forbidden');

  for (const name of wrapperNames) {
    const calls = wrapperCalls(tokens, name);
    assert.equal(identifierCount(tokens, name), calls.length + 1, name + ' cannot be extracted, called, or aliased');
    for (const call of calls) {
      assert.notEqual(call.key, null, name + ' requires a literal key at every production call site');
      assert.equal(allowedPropertyKeys.includes(call.key), true, name + ' rejects an unapproved literal key: ' + call.key);
    }
    for (let index = 0; index + 3 < tokens.length; index += 1) {
      if (tokens[index].value === name && tokens[index + 1].value === '.' && ['call', 'apply'].includes(tokens[index + 2].value) && tokens[index + 3].value === '(') {
        assert.fail(name + ' call/apply access is forbidden');
      }
    }
  }
  for (let index = 0; index + 4 < tokens.length; index += 1) {
    if (rawPropertyMethods.has(tokens[index].value) && tokens[index + 1].value === '.' && ['call', 'apply'].includes(tokens[index + 2].value) && tokens[index + 3].value === '(') {
      assert.fail('raw Script Property call/apply access is forbidden: ' + tokens[index].value);
    }
  }
  return tokens;
}

assertCentralizedPropertyBoundary(sourceByName);

for (const mutation of [
  "\nfunction ooBadProperty_() { return properties['get' + 'Property']('ARBITRARY_CONFIG'); }\n",
  "\nfunction ooBadProperty_() { var method = 'getProperty'; return properties[method]('ARBITRARY_CONFIG'); }\n",
  "\nfunction ooBadProperty_() { return properties.getProperty.call(properties, 'ARBITRARY_CONFIG'); }\n",
  "\nfunction ooBadProperty_() { return properties.getProperties.call(properties); }\n",
  "\nfunction ooBadProperty_() { return ooScriptProperties_(); }\n",
  "\nfunction ooBadProperty_() { return PropertiesService.getScriptProperties(); }\n",
  "\nfunction ooBadProperty_(key) { return ooGetScriptProperty_(key); }\n"
]) {
  assert.throws(
    () => assertCentralizedPropertyBoundary({ ...sourceByName, 'OfficeOps.gs': sourceByName['OfficeOps.gs'] + mutation }),
    /Property|property|Script|script|literal|call\/apply|computed/
  );
}

const wrapperValues = new Map(allowedPropertyKeys.map(key => [key, 'before-' + key]));
const wrapperSandbox = {
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) { return wrapperValues.get(key) || null; },
        setProperty(key, value) { wrapperValues.set(key, value); return null; }
      };
    }
  }
};
vm.runInNewContext(codeSource, wrapperSandbox, { filename: 'Code.gs' });
for (const key of allowedPropertyKeys) {
  assert.equal(wrapperSandbox.ooGetScriptProperty_(key), 'before-' + key, 'runtime getter accepts ' + key);
  wrapperSandbox.ooSetScriptProperty_(key, 7);
  assert.equal(wrapperValues.get(key), '7', 'runtime setter stringifies values for ' + key);
}
assert.throws(() => wrapperSandbox.ooGetScriptProperty_('APP_TOKEN'), /office-ops-script-property-key-rejected/);
assert.throws(() => wrapperSandbox.ooSetScriptProperty_(['ARBITRARY', 'CONFIG'].join('_'), 'value'), /office-ops-script-property-key-rejected/);

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

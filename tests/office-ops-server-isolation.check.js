const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
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
const serverSource = sourceByName['OfficeOps.gs'];
const readme = fs.readFileSync(path.join(PROJECT, 'README_APPS_SCRIPT.md'), 'utf8');
const BASE = '19657c3';
const serverOwnedProtectedPaths = ['apps-script', 'apps-script-commercial'];

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

function extractMarkedList(document, marker) {
  const start = `<!-- ${marker}_START -->`;
  const end = `<!-- ${marker}_END -->`;
  assert.equal(document.split(start).length - 1, 1, marker + ' start marker must appear exactly once');
  assert.equal(document.split(end).length - 1, 1, marker + ' end marker must appear exactly once');
  const startIndex = document.indexOf(start);
  const endIndex = document.indexOf(end);
  assert.equal(startIndex < endIndex, true, marker + ' markers must be ordered');
  const values = document.slice(startIndex + start.length, endIndex)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = /^- `([A-Za-z][A-Za-z0-9_]*)`$/.exec(line);
      assert.notEqual(match, null, marker + ' may contain bullet values only: ' + line);
      return match[1];
    });
  assert.equal(new Set(values).size, values.length, marker + ' values must not repeat');
  return values;
}

assert.throws(
  () => extractMarkedList('<!-- SAMPLE_START -->\n- `one`\nprose\n<!-- SAMPLE_END -->', 'SAMPLE'),
  /bullet values only/,
  'marked-list parser rejects prose'
);
assert.throws(
  () => extractMarkedList('<!-- SAMPLE_START -->\n- `one`\n- `one`\n<!-- SAMPLE_END -->', 'SAMPLE'),
  /must not repeat/,
  'marked-list parser rejects duplicate values'
);
assert.throws(
  () => extractMarkedList('<!-- SAMPLE_START -->\n- `one`\n<!-- SAMPLE_END -->\n<!-- SAMPLE_END -->', 'SAMPLE'),
  /exactly once/,
  'marked-list parser rejects duplicate markers'
);

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

const sectionOrder = [
  '## 1. 사전 검증',
  '## 2. 새 프로젝트 초기화',
  '## 3. 비활성 배포',
  '## 4. 별도 승인 후 OfficeOps 활성화',
  '## 5. 수동 복구',
  '## 6. 전환 promotion',
  '## 7. rollback',
  '## 8. 금지 작업'
];
for (const section of sectionOrder) {
  assert.equal(readme.split(section).length - 1, 1, 'README section must appear exactly once: ' + section);
}
assert.deepEqual(readme.match(/^## .+$/gm), sectionOrder, 'README must contain exactly the eight ordered runbook sections');

const documentedPropertyKeys = Array.from(readme.matchAll(/`(OFFICE_[A-Z0-9_]+)`/g), match => match[1]);
assert.deepEqual([...new Set(documentedPropertyKeys)].sort(), [...allowedPropertyKeys].sort(), 'README documents exactly the four OfficeOps Script Properties');
assert.deepEqual(extractMarkedList(readme, 'OFFICE_OPS_PROPERTIES'), allowedPropertyKeys, 'README marked property list is exact and ordered');
assert.deepEqual(extractMarkedList(readme, 'OFFICE_OPS_ACTIONS'), allowedActions, 'README marked action list is exact and ordered');

for (const forbidden of [
  'getFilesByName',
  'APP_TOKEN',
  'DATA_FILE_ID',
  'OFFICE_INTAKE_FILE_ID',
  'COMMERCIAL_APPROVAL_TOKEN',
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

assert.match(serverSource, /function\s+ooDispatch_\s*\(\s*request\s*\)/, 'OfficeOps exposes exact one-argument dispatcher');
assert.doesNotMatch(serverSource, /function\s+ooDispatch_\s*\([^)]*,/, 'dispatcher cannot accept a second argument');
const conversionGateMatch = /function\s+ooConversionOperationallyEnabled_\s*\(\s*\)\s*\{\s*return\s+(true|false)\s*;?\s*\}/.exec(serverSource);
assert.notEqual(conversionGateMatch, null, 'OfficeOps exposes the production conversion code gate');
assert.doesNotMatch(conversionGateMatch ? conversionGateMatch[0] : '', /Property|Drive|Service|ooGet|ooSet/, 'conversion gate has no property, service, or external lookup');
const conversionClassifyMatch = /function\s+ooIsConversionAction_\s*\(\s*action\s*\)/.exec(serverSource);
assert.notEqual(conversionClassifyMatch, null, 'OfficeOps exposes the exact conversion action classifier');
assert.match(serverSource, /function\s+ooRecoveryValidateSource_\s*\(\s*\)/, 'editor recovery validator is zero-argument');
assert.equal(allowedActions.includes('ooRecoveryValidateSource_'), false, 'editor recovery validator is never an action');
assert.doesNotMatch(source, /(?:apps-script-commercial|apps-script\/|\.\.\/apps-script)/, 'OfficeOps cannot import protected relay sources');

function kstFormat(date, timezone, format) {
  assert.equal(timezone, 'Asia/Seoul', 'strict KST evidence uses Asia/Seoul');
  assert.equal(format, "yyyy-MM-dd'T'HH:mm:ssXXX", 'strict KST evidence uses the exact format');
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return shifted.getUTCFullYear() + '-' + pad(shifted.getUTCMonth() + 1) + '-' + pad(shifted.getUTCDate()) +
    'T' + pad(shifted.getUTCHours()) + ':' + pad(shifted.getUTCMinutes()) + ':' + pad(shifted.getUTCSeconds()) + '+09:00';
}

const gateSandbox = {
  Date, JSON, Math, Number, Object, String, Array,
  Utilities:{ formatDate:kstFormat }
};
vm.createContext(gateSandbox);
for (const name of productionFiles) vm.runInContext(sourceByName[name], gateSandbox, { filename:name });
const exactConversionActions = [
  'officeInspectionBeginConversion',
  'officeInspectionArmLocalCommit',
  'officeInspectionRecordLocalCommit',
  'officeInspectionFinalizeConversion',
  'officeInspectionCancelConversion'
];
const promotionKeys = [
  'schemaVersion',
  'enabled',
  'approvalEvidenceSha256',
  'commercialRelayCommit',
  'commercialRelayVerifiedAtKst',
  'browserConversionE2eCommit',
  'approvedAtKst'
];

function assertPromotion(candidate, gateEnabled, label) {
  assert.deepEqual(Object.keys(candidate), promotionKeys, label + ' exact ordered keys');
  assert.equal(candidate.schemaVersion, 1, label + ' schemaVersion');
  assert.equal(typeof candidate.enabled, 'boolean', label + ' enabled boolean');
  assert.equal(candidate.enabled, gateEnabled, label + ' marker/literal parity');
  if (!candidate.enabled) {
    for (const key of promotionKeys.slice(2)) assert.equal(candidate[key], null, label + ' disabled null ' + key);
    return;
  }
  assert.match(candidate.approvalEvidenceSha256, /^[a-f0-9]{64}$/, label + ' approval SHA-256');
  assert.match(candidate.commercialRelayCommit, /^[a-f0-9]{40}$/, label + ' commercial commit');
  assert.match(candidate.browserConversionE2eCommit, /^[a-f0-9]{40}$/, label + ' browser commit');
  assert.equal(/^(?:0{64}|TEST_|REDACTED)/.test(candidate.approvalEvidenceSha256), false, label + ' approval evidence is not a placeholder');
  assert.equal(/^0{40}$/.test(candidate.commercialRelayCommit), false, label + ' commercial commit is not zero');
  assert.equal(/^0{40}$/.test(candidate.browserConversionE2eCommit), false, label + ' browser commit is not zero');
  const verifiedAt = gateSandbox.ooParseKstDateTime_(candidate.commercialRelayVerifiedAtKst);
  const approvedAt = gateSandbox.ooParseKstDateTime_(candidate.approvedAtKst);
  assert.notEqual(verifiedAt, null, label + ' commercial time is real strict KST');
  assert.notEqual(approvedAt, null, label + ' approval time is real strict KST');
  assert.equal(verifiedAt <= approvedAt, true, label + ' approval is not earlier than verification');
}

const promotion = JSON.parse(fs.readFileSync(path.join(PROJECT, 'conversion-promotion.json'), 'utf8'));
const productionGateEnabled = conversionGateMatch && conversionGateMatch[1] === 'true';
assertPromotion(promotion, productionGateEnabled, 'production promotion');
assert.equal(gateSandbox.ooConversionOperationallyEnabled_(), promotion.enabled, 'runtime gate agrees with promotion marker');
assertPromotion({
  schemaVersion:1,
  enabled:true,
  approvalEvidenceSha256:'a'.repeat(64),
  commercialRelayCommit:'1'.repeat(40),
  commercialRelayVerifiedAtKst:'2026-08-31T10:00:00+09:00',
  browserConversionE2eCommit:'2'.repeat(40),
  approvedAtKst:'2026-08-31T10:05:00+09:00'
}, true, 'future enabled promotion');
assert.throws(() => assertPromotion({
  schemaVersion:1,
  enabled:true,
  approvalEvidenceSha256:'a'.repeat(64),
  commercialRelayCommit:'1'.repeat(40),
  commercialRelayVerifiedAtKst:'2026-02-30T10:00:00+09:00',
  browserConversionE2eCommit:'2'.repeat(40),
  approvedAtKst:'2026-08-31T10:05:00+09:00'
}, true, 'invalid KST promotion'), /real strict KST/, 'promotion rejects impossible KST calendar dates');
for (const action of allowedActions) {
  assert.equal(gateSandbox.ooIsConversionAction_(action), exactConversionActions.includes(action), 'conversion classifier: ' + action);
}
for (const action of ['', 'unknown', 'officeInspectionCreate', null]) {
  assert.equal(gateSandbox.ooIsConversionAction_(action), false, 'conversion classifier rejects ' + action);
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
    childProcess.execFileSync('git', ['diff', '--exit-code', BASE, 'HEAD', '--', ...serverOwnedProtectedPaths], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'OfficeOps commits must preserve legacy/commercial server source isolation from the fixed Task 1 base');

assert.doesNotThrow(() => {
    childProcess.execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', ...serverOwnedProtectedPaths], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}, 'OfficeOps must not leave an uncommitted legacy/commercial server source change');

const untrackedProtected = childProcess.execFileSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', ...serverOwnedProtectedPaths],
  { cwd: ROOT, encoding: 'utf8' }
);
assert.equal(untrackedProtected, '', 'OfficeOps must not add untracked files beneath legacy/commercial server source paths');

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
  'do not delete the incident source file',
  'preMutationRevision → createdAt → backupFileId → manifestFileId',
  'latest complete verified pair',
  'point-in-time restore requires separate written approval',
  'latest ten verified backup pairs',
  'device-local cached read-only export',
  'representative approval',
  'approvalEvidenceSha256',
  'commercialRelayCommit',
  'browserConversionE2eCommit',
  'conversion-promotion.json',
  'exactly two production artifacts',
  'actual commercial relay verification',
  'browser conversion/resume E2E',
  'real strict KST',
  'changes no test, Script Property, action allowlist, or other source'
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

const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
assert.match(source, /OFFICE_OPS_ENABLED/, 'OfficeOps retains the explicit enable gate');
assert.match(source, /OFFICE_OPS_RECOVERY_REQUIRED/, 'OfficeOps retains the durable recovery latch');
for (const forbiddenService of ['MailApp', 'CalendarApp', 'UrlFetchApp']) {
  assert.equal(source.includes(forbiddenService), false, forbiddenService + ' cannot enter OfficeOps');
}
assert.match(readme, /disabled[\s\S]*device-local cached read-only export/i, 'disabled UI contract is device-local read-only only');
assert.match(readme, /does not create an aptOrder/i, 'OfficeOps has no local-order authority');
assert.match(agents, /apps-script-commercial\/[\s\S]*separate Apps Script project/i, 'commercial source is an independent Apps Script project');
assert.match(agents, /apps-script-office-ops\/[\s\S]*separate Apps Script project/i, 'OfficeOps source is an independent Apps Script project');
for (const projectDirectory of ['apps-script-commercial/', 'apps-script-office-ops/']) {
  const projectEntry = agents.slice(agents.indexOf('`' + projectDirectory + '`:'), agents.indexOf('`' + projectDirectory + '`:') + 320);
  assert.equal(projectEntry.includes('separate Apps Script project'), true, projectDirectory + ' is explicitly separate');
  assert.equal(projectEntry.includes('자체 Script Properties와 수동 deployment'), true, projectDirectory + ' has independent properties and deployment');
  assert.equal(projectEntry.includes('`APP_TOKEN`을 공유하지 않으며'), true, projectDirectory + ' never shares APP_TOKEN');
  assert.equal(projectEntry.includes('Pages merge로 배포되지 않는다'), true, projectDirectory + ' is never deployed by a Pages merge');
}
assert.equal(
  agents.includes('**`apps-script/` 폴더는 검토된 `OfficeIntake` 모듈과 후속 `Code.gs` dispatch split만 수정할 수 있다.**'),
  true,
  'legacy apps-script restriction remains exact'
);
for (const phrase of [
  'future UI contract only',
  'device-local settings',
  'fresh mutation ID per HTTP attempt',
  'preserve idempotency key for one logical create',
  'revision conflicts for manual merge',
  'never auto-retry offline',
  'device-local last-normal-data export',
  'disabled server rejects reads and writes',
  'separately verified commercial approval',
  'distinct local paid-work gate',
  'conversion actions stay inactive',
  'records the conversion handshake',
  'never calls hyeonjang state'
]) {
  assert.equal(readme.includes(phrase), true, 'future UI contract must state ' + phrase);
}

const branchScopePath = path.join(ROOT, 'scripts', 'verify-office-ops-branch-scope.mjs');
const branchScopeBase = 'f44fa5727064b8cba2e1e339f646dd7598b35442';
const branchScopeAllowlist = [
  '.github/workflows/deploy-pages.yml',
  '.superpowers/sdd/.gitignore',
  'AGENTS.md',
  'apps-script-commercial/Code.gs',
  'apps-script-commercial/CommercialApproval.gs',
  'apps-script-commercial/CommercialApprovalPure.gs',
  'apps-script-commercial/README_APPS_SCRIPT.md',
  'apps-script-commercial/appsscript.json',
  'apps-script-office-ops/Code.gs',
  'apps-script-office-ops/OfficeOps.gs',
  'apps-script-office-ops/OfficeOpsPure.gs',
  'apps-script-office-ops/README_APPS_SCRIPT.md',
  'apps-script-office-ops/appsscript.json',
  'apps-script-office-ops/conversion-promotion.json',
  'docs/superpowers/plans/2026-08-31-commercial-approval-relay.md',
  'docs/superpowers/plans/2026-08-31-hyeonjang-office-ops.md',
  'docs/superpowers/plans/2026-08-31-office-ops-relay.md',
  'scripts/verify-office-ops-branch-scope.mjs',
  'tests/commercial-approval-isolation.check.js',
  'tests/commercial-approval-server.unit.js',
  'tests/commercial-approval.unit.js',
  'tests/office-ops-pure.unit.js',
  'tests/office-ops-server-isolation.check.js',
  'tests/office-ops-server.unit.js',
  'tests/mobile-list.e2e.js',
  'tests/pages-artifact.e2e.js'
];

function gitBuffer(args) {
  return childProcess.execFileSync('git', args, { cwd:ROOT, encoding:null, stdio:['ignore', 'pipe', 'pipe'] });
}

function zeroSeparatedPaths(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function actualRepositorySnapshot() {
  const untracked = zeroSeparatedPaths(gitBuffer(['ls-files', '--others', '--exclude-standard', '-z']));
  return {
    status:gitBuffer(['status', '--porcelain=v1', '-z', '--untracked-files=all']).toString('hex'),
    index:gitBuffer(['ls-files', '--stage', '-z']).toString('hex'),
    staged:gitBuffer(['diff', '--cached', '--binary', 'HEAD', '--']).toString('hex'),
    worktree:gitBuffer(['diff', '--binary', 'HEAD', '--']).toString('hex'),
    untracked:untracked.map(relativePath => ({
      relativePath,
      sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex')
    }))
  };
}

assert.equal(fs.existsSync(branchScopePath), true, 'read-only OfficeOps branch-scope verifier exists');
const branchScopeSource = fs.readFileSync(branchScopePath, 'utf8');
assert.match(branchScopeSource, /spawnSync\(\s*'git'\s*,\s*args/, 'branch-scope verifier invokes Git directly');
assert.equal((branchScopeSource.match(/shell\s*:\s*false/g) || []).length, 1, 'Git runs exactly once through an explicit no-shell boundary');
assert.doesNotMatch(branchScopeSource, /shell\s*:\s*true|\bexec(?:File|FileSync|Sync)?\s*\(/, 'branch-scope verifier cannot invoke a shell or exec helper');
assert.equal((branchScopeSource.match(/'--no-renames'/g) || []).length, 3, 'committed, staged, and unstaged layers disable rename collapsing');
for (const commandFragment of [
  "FIXED_BASE + '...HEAD'",
  "['diff', '--cached', '--name-status'",
  "['diff', '--name-status', '--no-renames', '-z']",
  "['ls-files', '--others', '--exclude-standard', '-z']"
]) {
  assert.equal(branchScopeSource.includes(commandFragment), true, 'branch-scope verifier collects ' + commandFragment);
}
const syntheticPaths = [
  'scope-fixtures/customer-010-1234-5678.txt',
  'scope-fixtures/token-TEST_ONLY_TOKEN_MARKER.txt',
  'scope-fixtures/한빛아파트.txt',
  '../scope-fixtures/101동-1001호.txt'
];
const probeSource = `
  const moduleValue = await import(${JSON.stringify(pathToFileURL(branchScopePath).href)});
  try {
    const expected = JSON.parse(process.env.OFFICE_OPS_SCOPE_EXPECTED);
    const synthetic = JSON.parse(process.env.OFFICE_OPS_SCOPE_SYNTHETIC);
    const union = moduleValue.unionChangeLayers({
      committed:[{ status:'M', path:expected[0] }, { status:'M', path:synthetic[0] }],
      staged:[{ status:'A', path:expected[0] }, { status:'A', path:synthetic[1] }],
      unstaged:[{ status:'M', path:expected[0] }, { status:'M', path:synthetic[2] }],
      untracked:[{ status:'A', path:expected[0] }, { status:'A', path:synthetic[3] }]
    });
    const classified = moduleValue.classifyScopeChanges(union, new Set(expected));
    const deletion = moduleValue.classifyScopeChanges([
      { path:'AGENTS.md', statuses:new Set(['D']), layers:new Set(['committed']) }
    ], new Set(['AGENTS.md']));
    const allowedRecord = union.find(record => record.path === expected[0]);
    process.stdout.write(JSON.stringify({
      fixedBase:moduleValue.FIXED_BASE,
      allowlist:moduleValue.ALLOWED_PATHS,
      unionCount:union.length,
      allowedCount:classified.allowed.length,
      rejectedCount:classified.rejected.length,
      allowedLayers:Array.from(allowedRecord.layers).sort(),
      allowedStatuses:Array.from(allowedRecord.statuses).sort(),
      redacted:moduleValue.formatRejectedPaths(classified.rejected),
      deletionCount:deletion.rejected.length,
      deletionRedacted:moduleValue.formatRejectedPaths(deletion.rejected)
    }));
  } catch (_) {
    process.stderr.write('scope-probe-failed');
    process.exitCode = 2;
  }
`;

const beforePureProbe = actualRepositorySnapshot();
const probe = childProcess.spawnSync(process.execPath, ['--input-type=module', '--eval', probeSource], {
  cwd:ROOT,
  encoding:'utf8',
  shell:false,
  windowsHide:true,
  env:{
    ...process.env,
    OFFICE_OPS_SCOPE_EXPECTED:JSON.stringify(branchScopeAllowlist),
    OFFICE_OPS_SCOPE_SYNTHETIC:JSON.stringify(syntheticPaths)
  }
});
assert.equal(probe.status, 0, 'pure branch-scope classifier probe succeeds');
assert.equal(probe.stderr, '', 'pure classifier writes no stderr');
const probeResult = JSON.parse(probe.stdout);
assert.equal(probeResult.fixedBase, branchScopeBase, 'branch-scope verifier uses the fixed reviewed base');
assert.deepEqual(probeResult.allowlist, branchScopeAllowlist, 'branch-scope verifier uses the exact reviewed allowlist');
assert.deepEqual({
  unionCount:probeResult.unionCount,
  allowedCount:probeResult.allowedCount,
  rejectedCount:probeResult.rejectedCount,
  allowedLayers:probeResult.allowedLayers,
  allowedStatuses:probeResult.allowedStatuses
}, {
  unionCount:5,
  allowedCount:1,
  rejectedCount:4,
  allowedLayers:['committed', 'staged', 'unstaged', 'untracked'],
  allowedStatuses:['A', 'M']
}, 'classifier unions all four change layers without duplicate paths');

const redactedLines = probeResult.redacted.split('\n');
assert.equal(redactedLines[0], 'rejected-path-count: 4', 'redacted output contains only the rejected count first');
assert.equal(redactedLines.length, 5, 'redacted output has exactly one digest per rejected path');
const expectedDigests = syntheticPaths
  .map(value => crypto.createHash('sha256').update(value.replace(/\\/g, '/')).digest('hex'))
  .sort();
assert.deepEqual(redactedLines.slice(1).map(line => {
  const match = /^\[REDACTED_PATH\] ([0-9a-f]{64})$/.exec(line);
  assert.notEqual(match, null, 'each rejected path is one lowercase SHA-256 only');
  return match[1];
}).sort(), expectedDigests, 'redacted digests bind every normalized rejected path');
for (const forbiddenLeak of [
  '010-1234-5678', 'TEST_ONLY_TOKEN_MARKER', '한빛아파트', '101동-1001호',
  'scope-fixtures', '.txt', '../'
]) {
  assert.equal((probe.stdout + probe.stderr).includes(forbiddenLeak), false, 'scope output redacts ' + forbiddenLeak);
}
assert.equal(probeResult.deletionCount, 1, 'baseline deletion is rejected');
assert.match(probeResult.deletionRedacted, /^rejected-path-count: 1\n\[REDACTED_PATH\] [0-9a-f]{64}$/, 'baseline deletion output is redacted');
assert.equal(probeResult.deletionRedacted.includes('AGENTS.md'), false, 'baseline deletion never prints the path');
assert.deepEqual(actualRepositorySnapshot(), beforePureProbe, 'pure branch-scope probe mutates neither actual worktree nor index');

console.log('office-ops-server-isolation.check.js: PASS');

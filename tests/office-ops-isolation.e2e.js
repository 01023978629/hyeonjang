'use strict';
/* Task 1 OfficeOps transport/cache ownership.  These tests fail if the
   isolated client is removed, if server IDs are discarded, or if a disabled
   read is allowed to replace the last successful cache. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(match, 'missing isolated function: ' + name);
  const paramsStart = source.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === '(') params += 1;
    if (source[i] === ')' && --params === 0) { open = source.indexOf('{', i); break; }
  }
  assert.ok(open >= 0, 'isolated function body missing: ' + name);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(match.index, i + 1);
  }
  assert.fail('unbalanced isolated function: ' + name);
}

function makeClient({ replies = [], cache = new Map(), mutationImplementation = '' } = {}) {
  const calls = [];
  const sandbox = {
    crypto: { randomUUID: (() => { let n = 0; return () => 'uuid-' + (++n); })() },
    Date: class extends Date { static now() { return 0; } },
    JSON, Object, Error, Number, String, Array, Promise, URL,
    idbGet: async key => cache.get(key),
    idbSet: async (key, value) => { cache.set(key, value); },
    fetch: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return { ok: next && next.httpOk !== false, json: async () => next && next.body };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext("const __officeOps={url:'https://office.example/ops',token:'office-token',cache:null,revision:0,updatedAt:'',loadedAt:'',loading:false};const __commercialApproval={url:'',token:'',lastTrustedNow:null};", sandbox);
  for (const name of ['normalizeHttpsUrl', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsError', 'commercialError', 'normalizeOfficeOpsStore', 'officeOpsCall', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'commercialApprovalBoot', 'officeOpsBoot']) {
    vm.runInContext(name === 'officeOpsMutationWithAck' && mutationImplementation ? mutationImplementation : extractFunction(name), sandbox);
  }
  return { sandbox, calls, cache };
}

const representativeMutations = ['pilotCreate', 'pilotUpdate', 'consentDraft', 'inspectionConvert', 'contactRecord'];
async function assertRepresentativeMutationsBlocked(client, label) {
  for (const action of representativeMutations) {
    const before = client.calls.length;
    await assert.rejects(() => vm.runInContext('officeOpsMutation(' + JSON.stringify(action) + ',{})', client.sandbox), /office-disabled/, label + ' blocks ' + action);
    assert.equal(client.calls.length, before, label + ' makes zero network requests for ' + action);
  }
}

(async () => {
  const client = makeClient({ replies: [
    { body: { ok: true, id: 'pilot-server-42', revision: 8, updatedAt: '2026-08-31T00:00:00.000Z' } },
    { body: { ok: true, store: { schemaVersion: 1, revision: 8, updatedAt: '2026-08-31T00:00:00.000Z', pilots: [], consents: [], inspections: [], opportunities: [], audit: [] } } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", client.sandbox);
  const result = await vm.runInContext("officeOpsMutationWithAck('pilotCreate',{name:'same-name'})", client.sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ack)), { id: 'pilot-server-42', revision: 8, updatedAt: '2026-08-31T00:00:00.000Z' }, 'returned metadata preserves the exact server ID after the raw ACK validation');
  assert.equal(client.calls.length, 2, 'mutation acknowledgement is followed by exactly one refresh read');
  const [mutation, read] = client.calls;
  assert.deepEqual(Object.keys(mutation).sort(), ['action', 'deviceId', 'mutationId', 'payload', 'timestamp', 'token'], 'OfficeOps mutation has one isolated envelope');
  assert.equal(mutation.mutationId, 'uuid-1', 'mutation gets a fresh mutation ID');
  assert.equal(mutation.deviceId, 'uuid-2', 'device identity is separate from the mutation ID');
  assert.deepEqual(Object.keys(read).sort(), ['action', 'deviceId', 'payload', 'timestamp', 'token'], 'OfficeOps read has no mutation ID');
  assert.equal(Object.hasOwn(mutation, 'ts'), false, 'legacy ts is never sent');
  assert.equal(Object.hasOwn(read, 'ts'), false, 'legacy ts is never sent on reads');
  assert.deepEqual([...client.cache.keys()], ['office_ops_device_id', 'office_ops_cache'], 'only device identity and successful normalized read cache are persisted');

  const disabledCache = new Map([['office_ops_cache', { store: { schemaVersion: 1, revision: 4, updatedAt: '2026-08-30T00:00:00.000Z', pilots: [], consents: [], inspections: [], opportunities: [], audit: [] }, revision: 4, updatedAt: '2026-08-30T00:00:00.000Z' }]]);
  const disabled = makeClient({ cache: disabledCache, replies: [{ body: { ok: false, error: 'office-disabled' } }] });
  assert.equal(await vm.runInContext('officeOpsRefresh()', disabled.sandbox), null, 'disabled reads enter export-only mode instead of treating cache as current');
  assert.equal(disabled.cache.get('office_ops_cache').revision, 4, 'disabled read retains the last successful cache');
  assert.equal(vm.runInContext('__officeOps.mode', disabled.sandbox), 'export-only', 'disabled mode blocks future mutations');
  assert.equal(disabled.calls.length, 1, 'export-only refresh makes one read only');
  await assertRepresentativeMutationsBlocked(disabled, 'actual disabled read');

  const missingGuardFixture = extractFunction('officeOpsMutationWithAck').replace("if(__officeOps.mode!=='fresh')throw new Error('office-disabled');", '');
  assert.notEqual(missingGuardFixture, extractFunction('officeOpsMutationWithAck'), 'fixture omits the fail-closed mutation guard');
  const missingGuard = makeClient({ mutationImplementation: missingGuardFixture });
  vm.runInContext("__officeOps.mode='export-only'", missingGuard.sandbox);
  let mutationGuardDetected = false;
  try { await assertRepresentativeMutationsBlocked(missingGuard, 'missing guard fixture'); }
  catch (_) { mutationGuardDetected = true; }
  assert.equal(mutationGuardDetected, true, 'representative disabled-action assertions reject a missing mutation guard fixture');

  const stale = makeClient({ cache: disabledCache });
  await vm.runInContext('officeOpsBoot()', stale.sandbox);
  assert.equal(vm.runInContext('__officeOps.mode', stale.sandbox), 'stale-export-only', 'boot cache is never treated as a current successful load');
  await assertRepresentativeMutationsBlocked(stale, 'stale boot cache');

  const unloaded = makeClient();
  await assertRepresentativeMutationsBlocked(unloaded, 'unloaded client');

  const ackThenDisabled = makeClient({ replies: [
    { body: { ok: true, id: 'pilot-server-43', revision: 9, updatedAt: '2026-08-31T00:01:00.000Z' } },
    { body: { ok: false, error: 'office-disabled' } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", ackThenDisabled.sandbox);
  await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('pilotCreate',{})", ackThenDisabled.sandbox), /office-disabled/, 'a disabled refresh after a valid ACK still fails closed');
  assert.equal(vm.runInContext('__officeOps.mode', ackThenDisabled.sandbox), 'export-only', 'ACK-followed disabled refresh switches to export-only');
  assert.equal(ackThenDisabled.calls.length, 2, 'valid ACK is followed directly by one list refresh');
  await assertRepresentativeMutationsBlocked(ackThenDisabled, 'ACK-followed disabled refresh');

  const exports = makeClient({ cache: disabledCache });
  const downloads = [];
  Object.assign(exports.sandbox, {
    Blob: class Blob { constructor(parts, options) { this.parts = parts; this.options = options; } },
    URL: Object.assign(URL, { createObjectURL: () => 'blob:office-cache', revokeObjectURL: () => {} }),
    document: { body: { appendChild: node => downloads.push(node) }, createElement: () => ({ click: () => {}, remove: () => {} }) },
    setTimeout: callback => callback()
  });
  vm.runInContext(extractFunction('officeOpsExportLastCache'), exports.sandbox);
  await vm.runInContext('officeOpsExportLastCache()', exports.sandbox);
  assert.equal(exports.calls.length, 0, 'allowed local cache export makes zero network requests');
  assert.equal(downloads.length, 1, 'allowed local cache export creates one local download only');

  const serialize = source.slice(source.indexOf('function serializeData()'), source.indexOf('function applyData('));
  const apply = source.slice(source.indexOf('function applyData('), source.indexOf('function fixXlsxEstVat('));
  const relay = source.slice(source.indexOf('function relayCall('), source.indexOf('function cloudApiHealth'));
  const intake = source.slice(source.indexOf('function officeIntakeData('), source.indexOf('function aptSettle('));
  for (const [label, section] of [['serialize', serialize], ['apply', apply], ['relay', relay], ['OfficeIntake', intake]]) {
    assert.equal(/officeOps|office_ops|commercialApproval|commercial_approval/i.test(section), false, label + ' remains isolated from OfficeOps and commercial settings');
  }
  const exportBody = extractFunction('officeOpsExportLastCache');
  assert.match(exportBody, /idbGet\('office_ops_cache'\)/, 'export reads only the normalized OfficeOps cache');
  assert.doesNotMatch(exportBody, /officeOpsCall|commercialCall|fetch\(/, 'export performs no network request');
  assert.doesNotMatch(source, /String\(__officeOps\.token\)\.slice\(-4\)|String\(__commercialApproval\.token\)\.slice\(-4\)/, 'settings never render credential fragments');
  for (const inputId of ['ooTok', 'caTok']) {
    assert.match(source, new RegExp('id="' + inputId + '" value=""'), inputId + ' value is always blank in rendered settings HTML');
    assert.doesNotMatch(source, new RegExp('id="' + inputId + '"[^>]*value="\\$\\{'), inputId + ' never interpolates a credential into the rendered value');
  }
  const isolatedFunctions = ['normalizeHttpsUrl', 'officeOpsError', 'commercialError', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsCall', 'commercialCall', 'commercialApprovalBoot', 'normalizeOfficeOpsStore', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'officeOpsBoot', 'officeOpsSaveSettings', 'officeOpsClearCredentials', 'officeOpsExportLastCache'];
  const forbiddenReferences = /\bstate\b|serializeData|applyData|DATA_FILE_NAME|OFFICE_STORE_FILE|relayCall|relayBoot|__relay\b|RELAY_URL_DEFAULT|relay(?:Queue|Upload)[A-Za-z0-9_]*|relay_queue|relay_url|relay_token|\bcloudApi[A-Za-z0-9_]*|\brelayBuild[A-Za-z0-9_]*(?:Upload|Payload)[A-Za-z0-9_]*|__gd[A-Za-z0-9_]*|GD_[A-Z0-9_]*|\bgd[A-Za-z0-9_]*(?:Backup|Blob|Drive|File|Folder|Persist|Queue|Restore|Save|Sync|Token|Upload)[A-Za-z0-9_]*|__heic[A-Za-z0-9_]*|queueHeicPreview|(?:pump|process|queue)HeicPreview[A-Za-z0-9_]*|(?:photo|heic)(?:Queue|Upload)[A-Za-z0-9_]*|(?:queue|upload)(?:Photo|Heic)[A-Za-z0-9_]*|APP_TOKEN|officeIntake|OfficeIntake/i;
  for (const snippet of ['__relay.token', 'RELAY_URL_DEFAULT', "idbGet('relay_queue')", '__gdToken', 'GD_FOLDER_ID', 'queueHeicPreview(file)', 'photoUploadQueue(item)', 'cloudApiUploadFile', 'relayBuildUploadPayload', 'gdUploadBlob', '__heicPreviewQueue', 'pumpHeicPreviewQueue']) {
    assert.match(snippet, forbiddenReferences, 'relay/photo/Drive fixture must be rejected: ' + snippet);
  }
  for (const name of isolatedFunctions) assert.doesNotMatch(extractFunction(name), forbiddenReferences, name + ' is isolated from app state, relay, and OfficeIntake');
  assert.doesNotMatch(extractFunction('commercialCall'), forbiddenReferences, 'commercialCall static transport boundary is isolated from state, relay, and OfficeIntake');
  console.log('PASS  OfficeOps isolated envelopes, acknowledgements, cache ownership, and legacy boundaries');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

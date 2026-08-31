'use strict';
/* Task 1 OfficeOps transport/cache ownership.  These tests fail if the
   isolated client is removed, if server IDs are discarded, or if a disabled
   read is allowed to replace the last successful cache. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

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

function historyAuditRow(index, overrides = {}) {
  const action = overrides.action || 'officePilotCreate';
  return {
    action, result: 'ok', id: overrides.id || ('pilot_history_' + index), mutationId: overrides.mutationId || ('mutation_history_' + String(index).padStart(2, '0')),
    idempotencyKey: Object.hasOwn(overrides, 'idempotencyKey') ? overrides.idempotencyKey : (action.endsWith('Create') || action === 'officeConsentRecord' ? 'create_history_key_' + String(index).padStart(2, '0') : null),
    payloadSha256: 'a'.repeat(64), at: overrides.at || ('2026-08-31T09:00:' + String(index).padStart(2, '0') + '+09:00'), actor: 'representative', lifecycleBefore: null,
    backupFileId: overrides.backupFileId || ('backup_history_' + index), backupManifestFileId: overrides.backupManifestFileId || ('manifest_history_' + index),
    backupSha256: 'b'.repeat(64), preMutationRevision: Object.hasOwn(overrides, 'preMutationRevision') ? overrides.preMutationRevision : index
  };
}
function validHistoryStore(revision) {
  const audit = Array.from({ length: revision }, (_, index) => historyAuditRow(index));
  return { schemaVersion: 1, revision, updatedAt: revision ? audit[revision - 1].at : '2026-08-31T09:00:00+09:00', pilots: [], consents: [], inspections: [], opportunities: [], audit };
}
const validStoredConsent = {
  consentId: 'consent_history_1', subjectType: 'project', subjectId: 'project_1', purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
  consentVersion: 'reinspection-v1', consentTextSnapshot: 'consent snapshot', consentTextSha256: '14f8b388a01d5ec9efb2bf24eb5015621de5fe523cb8b68522b58299d94e123a',
  recordedBy: '대표', consentedAt: '2026-08-31T12:00:00+09:00', withdrawnAt: null, withdrawnBy: null, withdrawalReason: null,
  nextDueAt: '2027-02-28', lastContactedAt: null, evidenceType: 'recorded-call-note', evidenceId: 'note_1',
  audit: [{ event: 'recorded', at: '2026-08-31T12:00:00+09:00', actor: '대표', reason: null }]
};

function makeClient({ replies = [], cache = new Map(), mutationImplementation = '' } = {}) {
  const calls = [];
  const sandbox = {
    crypto: { randomUUID: (() => { let n = 0; return () => 'uuid-' + (++n); })(), subtle: webcrypto.subtle },
    Date: class extends Date { static now() { return 0; } },
    JSON, Object, Error, Number, String, Array, Promise, URL, Intl, TextEncoder, Uint8Array, Map, Set,
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
  for (const name of ['normalizeHttpsUrl', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsError', 'commercialError', 'isRealIsoDate', 'formatKstIso', 'pilotEndsAtKst', 'parseStrictKstDateTime', 'officeOpsExactKeys', 'validOfficeString', 'normalizeOfficeTombstone', 'normalizePilotEditable', 'normalizePilotRecord', 'normalizeReinspectionConsent', 'sha256Hex', 'reinspectionNextDueAtKst', 'normalizeOfficeConsentRecord', 'validateOfficeConsentIntegrity', 'normalizeOfficeCommercialTerms', 'normalizeOfficeApprovalMetadata', 'normalizeOfficeInspectionRecord', 'validateOfficeInspectionIntegrity', 'normalizeKAptUrl', 'normalizeOfficeOpportunityRecord', 'officeOpsAuditIdValid', 'normalizeOfficeAuditRow', 'normalizeOfficeOpsStore', 'validateOfficeOpsAuditHistory', 'validateOfficeOpsStoreIntegrity', 'normalizeAndValidateOfficeOpsStore', 'officeOpsRevokeFresh', 'officeOpsActiveConsentForDraft', 'officeOpsCall', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'commercialApprovalBoot', 'officeOpsBoot']) {
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
  const storeAtEight = validHistoryStore(8);
  const client = makeClient({ replies: [
    { body: { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: storeAtEight.updatedAt } },
    { body: { ok: true, store: storeAtEight } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", client.sandbox);
  const result = await vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{name:'same-name'})", client.sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ack)), { id: 'pilot_history_7', revision: 8, updatedAt: storeAtEight.updatedAt }, 'returned metadata preserves the exact strictly bound server ACK');
  assert.equal(client.calls.length, 2, 'mutation acknowledgement is followed by exactly one refresh read');
  const [mutation, read] = client.calls;
  assert.deepEqual(Object.keys(mutation).sort(), ['action', 'deviceId', 'mutationId', 'payload', 'timestamp', 'token'], 'OfficeOps mutation has one isolated envelope');
  assert.equal(mutation.mutationId, 'uuid-1', 'mutation gets a fresh mutation ID');
  assert.equal(mutation.deviceId, 'uuid-2', 'device identity is separate from the mutation ID');
  assert.deepEqual(Object.keys(read).sort(), ['action', 'deviceId', 'payload', 'timestamp', 'token'], 'OfficeOps read has no mutation ID');
  assert.equal(Object.hasOwn(mutation, 'ts'), false, 'legacy ts is never sent');
  assert.equal(Object.hasOwn(read, 'ts'), false, 'legacy ts is never sent on reads');
  assert.deepEqual([...client.cache.keys()], ['office_ops_device_id', 'office_ops_cache'], 'only device identity and successful normalized read cache are persisted');

  const disabledStore = validHistoryStore(4);
  const disabledCache = new Map([['office_ops_cache', { store: disabledStore, revision: disabledStore.revision, updatedAt: disabledStore.updatedAt }]]);
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
    { body: { ok: true, id: 'pilot_history_8', revision: 9, updatedAt: '2026-08-31T09:00:08+09:00' } },
    { body: { ok: false, error: 'office-disabled' } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", ackThenDisabled.sandbox);
  await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('pilotCreate',{})", ackThenDisabled.sandbox), /office-disabled/, 'a disabled refresh after a valid ACK still fails closed');
  assert.equal(vm.runInContext('__officeOps.mode', ackThenDisabled.sandbox), 'export-only', 'ACK-followed disabled refresh switches to export-only');
  assert.equal(ackThenDisabled.calls.length, 2, 'valid ACK is followed directly by one list refresh');
  await assertRepresentativeMutationsBlocked(ackThenDisabled, 'ACK-followed disabled refresh');

  const ackThenNetworkFailure = makeClient({ replies: [
    { body: { ok: true, id: 'consent_server_1', revision: 10, updatedAt: '2026-08-31T12:00:01+09:00' } },
    new Error('list network failed')
  ] });
  vm.runInContext("__officeOps.mode='fresh';__officeOps.cache={pilots:[],consents:[{consentId:'consent_server_1',withdrawnAt:null}],inspections:[],opportunities:[],audit:[]}", ackThenNetworkFailure.sandbox);
  await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officeConsentWithdraw',{consentId:'consent_server_1'})", ackThenNetworkFailure.sandbox), /list network failed/, 'generic post-ACK reload failure is surfaced');
  assert.equal(vm.runInContext('__officeOps.mode', ackThenNetworkFailure.sandbox), 'stale-export-only', 'any post-ACK reload failure revokes fresh state');
  assert.equal(vm.runInContext("officeOpsActiveConsentForDraft('consent_server_1')", ackThenNetworkFailure.sandbox), null, 'old active consent cannot feed a draft after withdrawal ACK without strict reload');
  const callsAfterFailedReload = ackThenNetworkFailure.calls.length;
  await assert.rejects(() => vm.runInContext("officeOpsMutation('consentDraft',{})", ackThenNetworkFailure.sandbox), /office-disabled/);
  assert.equal(ackThenNetworkFailure.calls.length, callsAfterFailedReload, 'revoked mode blocks every subsequent mutation with no network request');

  const replayStore = validHistoryStore(8);
  const concurrentReplay = makeClient({ replies: [
    { body: { ok: true, id: 'pilot_history_6', revision: 7, updatedAt: replayStore.audit[6].at } },
    { body: { ok: true, store: replayStore } }
  ] });
  vm.runInContext("__officeOps.mode='fresh'", concurrentReplay.sandbox);
  const replay = await vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", concurrentReplay.sandbox);
  assert.equal(replay.store.revision, 8, 'a later concurrent revision remains valid when the acknowledged audit event is still bound in history');

  for (const [label, body] of [
    ['non-string ACK id', { ok: true, id: 7, revision: 8, updatedAt: storeAtEight.updatedAt }],
    ['non-integer ACK revision', { ok: true, id: 'pilot_history_7', revision: '8', updatedAt: storeAtEight.updatedAt }],
    ['non-KST ACK updatedAt', { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: '2026-08-31T00:00:07Z' }]
  ]) {
    const invalidAck = makeClient({ replies: [{ body }] });
    vm.runInContext("__officeOps.mode='fresh'", invalidAck.sandbox);
    await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", invalidAck.sandbox), /invalid mutation acknowledgement/, label);
    assert.equal(vm.runInContext('__officeOps.mode', invalidAck.sandbox), 'unloaded', label + ' revokes fresh state before any reload');
  }

  for (const [label, ack, reloaded] of [
    ['reload revision older than ACK', { ok: true, id: 'pilot_history_7', revision: 9, updatedAt: storeAtEight.updatedAt }, storeAtEight],
    ['ACK audit time mismatch', { ok: true, id: 'pilot_history_7', revision: 8, updatedAt: '2026-08-31T09:00:09+09:00' }, storeAtEight],
    ['ACK ID mismatch', { ok: true, id: 'pilot_other', revision: 8, updatedAt: storeAtEight.updatedAt }, storeAtEight]
  ]) {
    const mismatched = makeClient({ replies: [{ body: ack }, { body: { ok: true, store: reloaded } }] });
    vm.runInContext("__officeOps.mode='fresh'", mismatched.sandbox);
    await assert.rejects(() => vm.runInContext("officeOpsMutationWithAck('officePilotCreate',{})", mismatched.sandbox), /invalid mutation reload binding/, label);
    assert.equal(vm.runInContext('__officeOps.mode', mismatched.sandbox), 'stale-export-only', label + ' revokes fresh state');
  }

  const historyBase = validHistoryStore(2), second = historyBase.audit[1];
  const createDuplicate = historyAuditRow(1, { action: 'officePilotCreate', id: 'pilot_history_other', idempotencyKey: historyBase.audit[0].idempotencyKey, at: second.at });
  const nonCreateWithKey = historyAuditRow(1, { action: 'officePilotUpdate', id: 'pilot_history_other', idempotencyKey: 'forbidden_update_key', at: second.at });
  const corruptStores = [
    ['invalid consent withdrawal state', { ...historyBase, consents: [{ ...validStoredConsent, withdrawnAt: 'not-a-kst-time' }] }],
    ['revision and audit length mismatch', { ...historyBase, audit: [historyBase.audit[0]] }],
    ['non-contiguous preMutationRevision', { ...historyBase, audit: [historyBase.audit[0], { ...second, preMutationRevision: 0 }] }],
    ['duplicate mutationId', { ...historyBase, audit: [historyBase.audit[0], { ...second, mutationId: historyBase.audit[0].mutationId }] }],
    ['same-row backup artifacts', { ...historyBase, audit: [historyBase.audit[0], { ...second, backupManifestFileId: second.backupFileId }] }],
    ['globally repeated backup artifact', { ...historyBase, audit: [historyBase.audit[0], { ...second, backupFileId: historyBase.audit[0].backupFileId }] }],
    ['duplicate create action and idempotency key', { ...historyBase, audit: [historyBase.audit[0], createDuplicate] }],
    ['non-create idempotency key', { ...historyBase, audit: [historyBase.audit[0], nonCreateWithKey] }],
    ['last audit time differs from store updatedAt', { ...historyBase, updatedAt: '2026-08-31T09:00:09+09:00' }]
  ];
  for (const [label, store] of corruptStores) {
    const live = makeClient({ replies: [{ body: { ok: true, store } }] });
    vm.runInContext("__officeOps.mode='fresh'", live.sandbox);
    await assert.rejects(() => vm.runInContext('officeOpsRefresh()', live.sandbox), /invalid (OfficeOps store|consent record|audit record)/, label + ' is rejected on live load');
    assert.notEqual(vm.runInContext('__officeOps.mode', live.sandbox), 'fresh', label + ' cannot remain fresh');
    assert.equal(live.cache.has('office_ops_cache'), false, label + ' is never persisted after live load');

    const cached = new Map([['office_ops_cache', { store, revision: store.revision, updatedAt: store.updatedAt }]]);
    const boot = makeClient({ cache: cached });
    await vm.runInContext('officeOpsBoot()', boot.sandbox);
    assert.equal(vm.runInContext('__officeOps.mode', boot.sandbox), 'unloaded', label + ' cannot be promoted from IDB');
    assert.equal(vm.runInContext('__officeOps.cache', boot.sandbox), null, label + ' leaves no in-memory cache');
  }

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
  for (const name of ['updateOfficePilot', 'persistReinspectionConsent', 'withdrawReinspectionConsent']) {
    assert.doesNotMatch(extractFunction(name), /pilotWindowView/, name + ' never uses the display-only pilot projection as transport input');
  }
  assert.doesNotMatch(extractFunction('pilotWindowView'), /officeOpsMutation|officeOpsCall|fetch\(/, 'pilotWindowView remains a no-network display projection');
  assert.doesNotMatch(extractFunction('normalizeKAptUrl'), /fetch\(|scrap|crawl/i, 'K-apt URL validation never scrapes');
  for (const inputId of ['ooTok', 'caTok']) {
    assert.match(source, new RegExp('id="' + inputId + '" value=""'), inputId + ' value is always blank in rendered settings HTML');
    assert.doesNotMatch(source, new RegExp('id="' + inputId + '"[^>]*value="\\$\\{'), inputId + ' never interpolates a credential into the rendered value');
  }
  const isolatedFunctions = ['normalizeHttpsUrl', 'officeOpsError', 'commercialError', 'officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsCall', 'commercialCall', 'commercialApprovalBoot', 'normalizeOfficeOpsStore', 'validateOfficeOpsAuditHistory', 'officeOpsRevokeFresh', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh', 'officeOpsBoot', 'officeOpsSaveSettings', 'officeOpsClearCredentials', 'officeOpsExportLastCache'];
  const forbiddenReferences = /\bstate\b|serializeData|applyData|DATA_FILE_NAME|OFFICE_STORE_FILE|relayCall|relayBoot|__relay\b|RELAY_URL_DEFAULT|relay(?:Queue|Upload)[A-Za-z0-9_]*|relay_queue|relay_url|relay_token|\bcloudApi[A-Za-z0-9_]*|\brelayBuild[A-Za-z0-9_]*(?:Upload|Payload)[A-Za-z0-9_]*|__gd[A-Za-z0-9_]*|GD_[A-Z0-9_]*|\bgd[A-Za-z0-9_]*(?:Backup|Blob|Drive|File|Folder|Persist|Queue|Restore|Save|Sync|Token|Upload)[A-Za-z0-9_]*|__heic[A-Za-z0-9_]*|queueHeicPreview|(?:pump|process|queue)HeicPreview[A-Za-z0-9_]*|(?:photo|heic)(?:Queue|Upload)[A-Za-z0-9_]*|(?:queue|upload)(?:Photo|Heic)[A-Za-z0-9_]*|APP_TOKEN|officeIntake|OfficeIntake/i;
  for (const snippet of ['__relay.token', 'RELAY_URL_DEFAULT', "idbGet('relay_queue')", '__gdToken', 'GD_FOLDER_ID', 'queueHeicPreview(file)', 'photoUploadQueue(item)', 'cloudApiUploadFile', 'relayBuildUploadPayload', 'gdUploadBlob', '__heicPreviewQueue', 'pumpHeicPreviewQueue']) {
    assert.match(snippet, forbiddenReferences, 'relay/photo/Drive fixture must be rejected: ' + snippet);
  }
  for (const name of isolatedFunctions) assert.doesNotMatch(extractFunction(name), forbiddenReferences, name + ' is isolated from app state, relay, and OfficeIntake');
  assert.doesNotMatch(extractFunction('commercialCall'), forbiddenReferences, 'commercialCall static transport boundary is isolated from state, relay, and OfficeIntake');
  console.log('PASS  OfficeOps isolated envelopes, acknowledgements, cache ownership, and legacy boundaries');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

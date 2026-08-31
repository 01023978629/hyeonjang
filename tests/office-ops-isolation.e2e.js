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

function makeClient({ replies = [], cache = new Map() } = {}) {
  const calls = [];
  const sandbox = {
    crypto: { randomUUID: (() => { let n = 0; return () => 'uuid-' + (++n); })() },
    Date: class extends Date { static now() { return 0; } },
    JSON, Object, Error, Number, String, Array, Promise,
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
  vm.runInContext("const __officeOps={url:'https://office.example/ops',token:'office-token',cache:null,revision:0,updatedAt:'',loadedAt:'',loading:false};", sandbox);
  for (const name of ['officeOpsDeviceId', 'officeOpsEnvelope', 'commercialEnvelope', 'postIsolated', 'officeOpsError', 'normalizeOfficeOpsStore', 'officeOpsCall', 'officeOpsLoad', 'officeOpsMutationWithAck', 'officeOpsMutation', 'officeOpsRefresh']) {
    vm.runInContext(extractFunction(name), sandbox);
  }
  return { sandbox, calls, cache };
}

(async () => {
  const client = makeClient({ replies: [
    { body: { ok: true, id: 'pilot-server-42', revision: 8, updatedAt: '2026-08-31T00:00:00.000Z' } },
    { body: { ok: true, store: { schemaVersion: 1, revision: 8, updatedAt: '2026-08-31T00:00:00.000Z', pilots: [], consents: [], inspections: [], opportunities: [], audit: [] } } }
  ] });
  const result = await vm.runInContext("officeOpsMutationWithAck('pilotCreate',{name:'same-name'})", client.sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ack)), { id: 'pilot-server-42', revision: 8, updatedAt: '2026-08-31T00:00:00.000Z' }, 'mutation returns the exact server ID acknowledgement');
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
  await assert.rejects(() => vm.runInContext("officeOpsMutation('pilotCreate',{name:'blocked'})", disabled.sandbox), /office-disabled/, 'export-only mode blocks mutation without a network retry');
  assert.equal(disabled.calls.length, 1, 'blocked mutation makes no network call');

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
  console.log('PASS  OfficeOps isolated envelopes, acknowledgements, cache ownership, and legacy boundaries');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

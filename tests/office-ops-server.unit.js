const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SOURCE_FILES = ['OfficeOpsPure.gs', 'OfficeOps.gs', 'Code.gs'];
const REQUEST_NOW_MS = Date.parse('2026-08-31T10:00:00+09:00');
const MUTATION_NOW_MS = Date.parse('2026-08-31T10:00:01+09:00');
const SOURCE_ID = 'TEST_OFFICE_OPS_FILE';
const PARENT_ID = 'TEST_OFFICE_OPS_PARENT';
const SOURCE_NAME = '관리사무소영업운영.json';
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
}

function match(actual, expected, message) {
  assertions += 1;
  assert.match(actual, expected, message);
}

function throws(callback, expected, message) {
  assertions += 1;
  assert.throws(callback, expected, message);
}

function signedBytes(value) {
  return Array.from(Buffer.from(value), byte => byte > 127 ? byte - 256 : byte);
}

function emptyStore(updatedAt = '2026-08-31T10:00:00+09:00') {
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt,
    pilots: [],
    consents: [],
    inspections: [],
    opportunities: [],
    audit: []
  };
}

function pilotPayload(overrides = {}) {
  return {
    idempotencyKey: 'create_pilot_123456',
    complexName: '테스트 단지',
    source: 'website',
    stage: 'pilot',
    pilotStartedAt: '2026-08-31T09:00:00+09:00',
    pilotEndsAt: '2026-09-29T23:59:59+09:00',
    extensionApprovedAt: null,
    nextActionAt: '2026-09-01',
    owner: '대표',
    notes: '',
    ...overrides
  };
}

function pilotUpdatePayload(id, expectedRevision, overrides = {}) {
  return {
    pilotId: id,
    expectedRevision,
    complexName: '수정 단지',
    source: 'phone',
    stage: 'contacted',
    pilotStartedAt: null,
    pilotEndsAt: null,
    extensionApprovedAt: null,
    nextActionAt: '2026-09-02',
    owner: '대표',
    notes: '수정 메모',
    ...overrides
  };
}

function storedPilot(id = 'pilot_seed_1', at = '2026-08-31T10:00:01+09:00', overrides = {}) {
  return {
    pilotId: id,
    complexName: '저장 단지',
    source: 'website',
    stage: 'contacted',
    pilotStartedAt: null,
    pilotEndsAt: null,
    extensionApprovedAt: null,
    nextActionAt: '2026-09-01',
    owner: '대표',
    notes: '',
    createdAt: at,
    updatedAt: at,
    retentionStartedAt: null,
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    restoredAt: null,
    ...overrides
  };
}

function auditRow(index = 0, overrides = {}) {
  const at = `2026-08-31T10:00:${String(index + 1).padStart(2, '0')}+09:00`;
  return {
    action: 'officePilotCreate',
    result: 'ok',
    id: `pilot_seed_${index + 1}`,
    mutationId: `mutation_seed_${String(index + 1).padStart(16, '0')}`,
    idempotencyKey: `create_seed_${String(index + 1).padStart(16, '0')}`,
    payloadSha256: String(index + 1).padStart(64, 'a').slice(-64),
    at,
    actor: 'representative',
    lifecycleBefore: null,
    backupFileId: `BACKUP_SEED_${index + 1}`,
    backupManifestFileId: `MANIFEST_SEED_${index + 1}`,
    backupSha256: String(index + 1).padStart(64, 'b').slice(-64),
    preMutationRevision: index,
    ...overrides
  };
}

function committedStore(count = 1) {
  const audit = Array.from({ length: count }, (_, index) => auditRow(index));
  return {
    schemaVersion: 1,
    revision: count,
    updatedAt: audit[count - 1].at,
    pilots: audit.map(row => storedPilot(row.id, row.at)),
    consents: [],
    inspections: [],
    opportunities: [],
    audit
  };
}

function kstFormat(date, format) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');
  const yyyy = shifted.getUTCFullYear();
  const MM = pad(shifted.getUTCMonth() + 1);
  const dd = pad(shifted.getUTCDate());
  const HH = pad(shifted.getUTCHours());
  const mm = pad(shifted.getUTCMinutes());
  const ss = pad(shifted.getUTCSeconds());
  if (format === "yyyy-MM-dd'T'HH:mm:ssXXX") return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}+09:00`;
  if (format === 'yyyyMMdd_HHmmss') return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
  throw new Error('unexpected date format');
}

function makeHarness(options = {}) {
  const hooks = options.hooks || {};
  const state = {
    properties: {
      OFFICE_OPS_ENABLED: '1',
      OFFICE_OPS_RECOVERY_REQUIRED: '0',
      OFFICE_OPS_TOKEN: 'TEST_ONLY_OFFICE_OPS_TOKEN',
      OFFICE_OPS_FILE_ID: SOURCE_ID,
      ...(options.properties || {})
    },
    propertyReads: [],
    propertyWrites: [],
    driveReads: [],
    sourceWrites: 0,
    trashCalls: [],
    created: [],
    createSignatures: [],
    clockCalls: 0,
    clockValues: options.clockValues || [REQUEST_NOW_MS, MUTATION_NOW_MS],
    lock: { getCalls: 0, tryCalls: 0, releaseCalls: 0 },
    logs: [],
    files: new Map(),
    nextBackupId: 1,
    nextManifestId: 1,
    nextUuid: 1,
    blobReads: new Map(),
    fileMethodCalls: new Map()
  };

  function addFile(file) {
    const data = {
      id: file.id,
      name: file.name,
      mime: file.mime === undefined ? 'application/json' : file.mime,
      parentIds: file.parentIds ? [...file.parentIds] : [PARENT_ID],
      trashed: !!file.trashed,
      bytes: Buffer.from(file.bytes || ''),
      returnedId: file.returnedId || file.id,
      role: file.role || 'other'
    };
    state.files.set(data.id, data);
    return data;
  }

  addFile({
    id: SOURCE_ID,
    name: options.sourceName === undefined ? SOURCE_NAME : options.sourceName,
    mime: options.sourceMime === undefined ? 'application/json' : options.sourceMime,
    parentIds: options.sourceParentIds || [PARENT_ID],
    trashed: !!options.sourceTrashed,
    returnedId: options.sourceReturnedId || SOURCE_ID,
    bytes: options.sourceBytes || Buffer.from(JSON.stringify(options.store || emptyStore()), 'utf8'),
    role: 'source'
  });
  (options.extraFiles || []).forEach(addFile);

  function iterator(values) {
    let index = 0;
    return {
      hasNext: () => index < values.length,
      next: () => values[index++]
    };
  }

  function folderHandle(id) {
    return {
      getId: () => id,
      createFile(...args) {
        let name;
        let content;
        let mime;
        let signature;
        if (args.length === 1 && args[0] && typeof args[0].getBytes === 'function') {
          content = args[0];
          name = content.name;
          mime = content.contentType;
          signature = 'blob';
        } else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
          [name, content] = args;
          mime = 'text/plain';
          signature = 'name-content';
        } else if (args.length === 3 && typeof args[0] === 'string' && typeof args[1] === 'string' && typeof args[2] === 'string') {
          [name, content, mime] = args;
          signature = 'name-content-mime';
        } else {
          throw new TypeError('unsupported Apps Script Folder.createFile overload');
        }
        if (typeof name !== 'string' || !name) throw new TypeError('blob-backed file requires a name');
        state.createSignatures.push(signature);
        const role = /\.manifest\.json$/.test(name) ? 'manifest' : 'backup';
        if (hooks.beforeCreate) hooks.beforeCreate({ role, name, state });
        const generatedId = role === 'manifest'
          ? `BACKUP_MANIFEST_${String(state.nextManifestId++).padStart(4, '0')}`
          : `BACKUP_FILE_${String(state.nextBackupId++).padStart(4, '0')}`;
        let bytes;
        let contentType = mime;
        if (content && typeof content.getBytes === 'function') {
          bytes = Buffer.from(content.getBytes().map(byte => (byte + 256) % 256));
          contentType = content.contentType || contentType;
        } else {
          bytes = Buffer.from(String(content), 'utf8');
        }
        const data = addFile({ id: generatedId, name, mime: contentType || 'application/json', parentIds: [id], bytes, role });
        state.created.push(generatedId);
        if (hooks.afterCreate) hooks.afterCreate({ role, data, state });
        return fileHandle(data.id, data.returnedId || data.id);
      },
      getFiles() {
        const handles = [...state.files.values()]
          .filter(file => file.parentIds.includes(id))
          .map(file => fileHandle(file.id, file.returnedId || file.id));
        return iterator(handles);
      }
    };
  }

  function fileHandle(id, returnedIdOverride) {
    function data() {
      if (!state.files.has(id)) throw new Error(`missing fake file:${id}`);
      return state.files.get(id);
    }
    function fileMethod(method) {
      const key = id + ':' + method;
      const call = (state.fileMethodCalls.get(key) || 0) + 1;
      state.fileMethodCalls.set(key, call);
      if (hooks.fileMethod) hooks.fileMethod({ id, method, call, data:data(), state });
    }
    return {
      getId() {
        fileMethod('getId');
        return returnedIdOverride || data().returnedId;
      },
      getName() {
        fileMethod('getName');
        return data().name;
      },
      getMimeType() {
        fileMethod('getMimeType');
        return data().mime;
      },
      isTrashed() {
        fileMethod('isTrashed');
        return data().trashed;
      },
      getParents() {
        fileMethod('getParents');
        return iterator(data().parentIds.map(folderHandle));
      },
      getBlob() {
        fileMethod('getBlob');
        return {
          getBytes() {
            const reads = (state.blobReads.get(id) || 0) + 1;
            state.blobReads.set(id, reads);
            if (hooks.beforeBlobRead) hooks.beforeBlobRead({ id, read: reads, data: data(), state });
            return signedBytes(data().bytes);
          }
        };
      },
      setContent(text) {
        state.sourceWrites += 1;
        if (hooks.beforeSetContent) hooks.beforeSetContent({ id, call: state.sourceWrites, text, data: data(), state });
        data().bytes = Buffer.from(String(text), 'utf8');
        if (hooks.afterSetContent) hooks.afterSetContent({ id, call: state.sourceWrites, text, data: data(), state });
        return this;
      },
      setTrashed(value) {
        state.trashCalls.push(id);
        if (hooks.beforeTrash) hooks.beforeTrash({ id, value, data: data(), state });
        data().trashed = !!value;
        return this;
      }
    };
  }

  const sandbox = {
    Date,
    Error,
    SyntaxError,
    JSON,
    Math,
    Number,
    Object,
    String,
    Array,
    Buffer,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(_algorithm, input) {
        if (hooks.computeDigest) hooks.computeDigest({ input, state });
        return signedBytes(crypto.createHash('sha256').update(Buffer.from(input.map(byte => (byte + 256) % 256))).digest());
      },
      newBlob(input, contentType, name) {
        const bytes = typeof input === 'string'
          ? Buffer.from(input, 'utf8')
          : Buffer.from(Array.from(input || [], byte => (byte + 256) % 256));
        return {
          contentType,
          name,
          getBytes: () => signedBytes(bytes),
          getDataAsString: charset => {
            equal(charset, 'UTF-8', 'server decodes only UTF-8');
            return bytes.toString('utf8');
          }
        };
      },
      formatDate(date, timezone, format) {
        equal(timezone, 'Asia/Seoul', 'server uses KST');
        return kstFormat(date, format);
      },
      getUuid() {
        return `TEST_UUID_${String(state.nextUuid++).padStart(4, '0')}`;
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            state.propertyReads.push(key);
            if (hooks.getProperty) return hooks.getProperty({ key, read: state.propertyReads.length, state });
            return Object.prototype.hasOwnProperty.call(state.properties, key) ? state.properties[key] : null;
          },
          setProperty(key, value) {
            state.propertyWrites.push({ key, value: String(value) });
            const control = hooks.setProperty ? hooks.setProperty({ key, value: String(value), state }) : null;
            if (control && control.skipDefault) return null;
            state.properties[key] = String(value);
            return null;
          }
        };
      }
    },
    DriveApp: {
      getFileById(id) {
        state.driveReads.push(id);
        if (hooks.driveLookup) hooks.driveLookup({ id, state });
        if (!state.files.has(id)) throw new Error('fake file not found');
        return fileHandle(id);
      }
    },
    LockService: {
      getScriptLock() {
        state.lock.getCalls += 1;
        if (hooks.getScriptLock) hooks.getScriptLock({ state });
        return {
          tryLock(milliseconds) {
            state.lock.tryCalls += 1;
            equal(milliseconds, 20000, 'OfficeOps lock timeout');
            if (hooks.tryLock) return hooks.tryLock({ milliseconds, state });
            return options.lockUnavailable ? false : true;
          },
          releaseLock() {
            state.lock.releaseCalls += 1;
            if (hooks.releaseLock) hooks.releaseLock({ state });
          }
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        if (hooks.createTextOutput) hooks.createTextOutput({ text, state });
        return {
          text,
          mimeType: null,
          setMimeType(mimeType) { this.mimeType = mimeType; return this; }
        };
      }
    },
    Logger: { log(value) { state.logs.push(value); } },
    ooNowMs_() {
      const index = state.clockCalls++;
      if (hooks.clock) return hooks.clock({ index, state });
      return state.clockValues[Math.min(index, state.clockValues.length - 1)];
    }
  };

  vm.createContext(sandbox);
  for (const name of SOURCE_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script-office-ops', name), 'utf8'), sandbox, { filename: name });
  }

  function request(action, payload, overrides = {}) {
    const read = action === 'officeOpsList' || action === 'officeOpsRetentionList';
    const envelope = {
      token: 'TEST_ONLY_OFFICE_OPS_TOKEN',
      action,
      deviceId: 'device_1234567890123456',
      timestamp: '2026-08-31T10:00:00+09:00',
      payload
    };
    if (!read) envelope.mutationId = 'mutation_1234567890123456';
    return { ...envelope, ...overrides };
  }

  function post(action, payload, overrides = {}) {
    return sandbox.ooDoPost_(request(action, payload, overrides));
  }

  function httpPost(action, payload, overrides = {}) {
    const output = sandbox.doPost({ postData: { contents: JSON.stringify(request(action, payload, overrides)) } });
    equal(output.mimeType, 'application/json', 'HTTP response MIME');
    return JSON.parse(output.text);
  }

  return { sandbox, state, hooks, addFile, fileHandle, folderHandle, request, post, httpPost };
}

function assertFailure(result, expected, label) {
  deepEqual(Object.keys(result), ['ok', 'error'], label + ' exact failure keys');
  equal(result.ok, false, label + ' ok false');
  equal(result.error, expected, label + ' error');
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    'TEST_ONLY_OFFICE_OPS_TOKEN', 'TEST_EVIDENCE_FILE_0001', 'receipt_TEST',
    SOURCE_ID, SOURCE_NAME, '테스트 단지', 'stack'
  ]) equal(serialized.includes(forbidden), false, label + ' redacts ' + forbidden);
}

{
  const harness = makeHarness();
  const source = harness.sandbox.ooSourceFile_();
  equal(source.ok, true, 'internal source handle resolves');
  const loaded = harness.sandbox.ooReadStore_(source);
  deepEqual(Object.keys(loaded), ['ok','sourceId','parentId','bytes','byteLength','sha256Hex','store'], 'store read exact internal tuple keys');
  equal(loaded.ok, true, 'internal store tuple succeeds');
}

const basic = makeHarness();
const listed = basic.post('officeOpsList', {});
deepEqual(Object.keys(listed), ['ok', 'store'], 'list exact keys');
equal(listed.ok, true, 'list succeeds');
deepEqual(listed.store, emptyStore(), 'list returns strict store');
equal(basic.state.clockCalls, 1, 'list uses one request clock');
equal(basic.state.lock.getCalls, 0, 'list does not lock');

const retention = basic.post('officeOpsRetentionList', {});
deepEqual(Object.keys(retention), ['ok', 'rows', 'serverNowKst'], 'retention exact keys');
equal(retention.ok, true, 'retention succeeds');
deepEqual(retention.rows, [], 'retention starts empty');
equal(retention.serverNowKst, '2026-08-31T10:00:01+09:00', 'retention uses its request snapshot');
equal(basic.state.clockCalls, 2, 'retention uses one request clock');

equal(basic.post('officeOpsList', { includeArchived:true }).ok, true, 'list accepts exact includeArchived boolean');
assertFailure(basic.post('officeOpsList', { includeArchived:'true' }), 'invalid-input', 'list rejects nonboolean includeArchived');
assertFailure(basic.post('officeOpsRetentionList', { includeArchived:true }), 'unknown-field', 'retention rejects extra payload field');
assertFailure(basic.post('officeOpsList', {}, { mutationId:'mutation_read_smuggle_001' }), 'unknown-field', 'read rejects mutation ID');
assertFailure(basic.post('officeOpsList', {}, { timestamp:'2026-08-31T09:54:59+09:00' }), 'stale-request', 'read rejects stale timestamp');
assertFailure(basic.post('officeOpsList', {}, { timestamp:'2026-08-31T10:00:00' }), 'invalid-input', 'read rejects timestamp without zone');
assertFailure(basic.post('officePilotCreate', pilotPayload(), { mutationId:undefined }), 'invalid-input', 'mutation requires mutation ID');

const createHarness = makeHarness();
const first = createHarness.post('officePilotCreate', pilotPayload());
deepEqual(Object.keys(first), ['ok', 'id', 'revision', 'updatedAt'], 'create exact ACK keys');
equal(first.ok, true, 'create succeeds');
match(first.id, /^pilot_[A-Za-z0-9_-]{1,100}$/, 'server-generated pilot ID');
equal(first.revision, 1, 'create increments revision');
equal(first.updatedAt, '2026-08-31T10:00:01+09:00', 'create ACK uses mutation snapshot');
equal(createHarness.state.clockCalls, 2, 'create uses request and mutation clocks once');
equal(createHarness.state.lock.getCalls, 1, 'create gets lock once');
equal(createHarness.state.lock.tryCalls, 1, 'create tries lock once');
equal(createHarness.state.lock.releaseCalls, 1, 'create releases acquired lock once');
equal(createHarness.state.sourceWrites, 1, 'create writes source once');
equal(createHarness.state.properties.OFFICE_OPS_RECOVERY_REQUIRED, '0', 'successful create clears latch');
deepEqual(createHarness.state.propertyWrites, [
  { key: 'OFFICE_OPS_RECOVERY_REQUIRED', value: '1' },
  { key: 'OFFICE_OPS_RECOVERY_REQUIRED', value: '0' }
], 'create arms then clears latch');

const written = JSON.parse(createHarness.state.files.get(SOURCE_ID).bytes.toString('utf8'));
equal(written.revision, 1, 'written store revision');
equal(written.updatedAt, first.updatedAt, 'store and ACK share time');
equal(written.pilots.length, 1, 'one pilot written');
equal(written.pilots[0].pilotId, first.id, 'ACK ID matches record');
equal(written.pilots[0].createdAt, first.updatedAt, 'record shares mutation time');
equal(written.pilots[0].updatedAt, first.updatedAt, 'record update time matches');
equal(written.audit.length, 1, 'one audit row written');
deepEqual(Object.keys(written.audit[0]), [
  'action', 'result', 'id', 'mutationId', 'idempotencyKey', 'payloadSha256', 'at', 'actor',
  'lifecycleBefore', 'backupFileId', 'backupManifestFileId', 'backupSha256', 'preMutationRevision'
], 'audit exact keys');
deepEqual({
  action: written.audit[0].action,
  result: written.audit[0].result,
  id: written.audit[0].id,
  mutationId: written.audit[0].mutationId,
  idempotencyKey: written.audit[0].idempotencyKey,
  at: written.audit[0].at,
  actor: written.audit[0].actor,
  lifecycleBefore: written.audit[0].lifecycleBefore,
  preMutationRevision: written.audit[0].preMutationRevision
}, {
  action: 'officePilotCreate', result: 'ok', id: first.id, mutationId: 'mutation_1234567890123456',
  idempotencyKey: 'create_pilot_123456', at: first.updatedAt, actor: 'representative',
  lifecycleBefore: null, preMutationRevision: 0
}, 'audit binds mutation metadata');
match(written.audit[0].payloadSha256, /^[0-9a-f]{64}$/, 'audit payload hash');
match(written.audit[0].backupSha256, /^[0-9a-f]{64}$/, 'audit backup hash');
equal(createHarness.state.created.length, 2, 'one backup and manifest created');
deepEqual(createHarness.state.createSignatures, ['blob','name-content-mime'], 'Drive creates backup and manifest through real Folder overloads');

const backup = createHarness.state.files.get(written.audit[0].backupFileId);
const manifestFile = createHarness.state.files.get(written.audit[0].backupManifestFileId);
equal(backup.trashed, false, 'current backup retained');
equal(manifestFile.trashed, false, 'current manifest retained');
deepEqual(backup.bytes, Buffer.from(JSON.stringify(emptyStore()), 'utf8'), 'backup preserves exact pre-mutation bytes');
const manifest = JSON.parse(manifestFile.bytes.toString('utf8'));
deepEqual(Object.keys(manifest), ['sourceFileId','backupFileId','createdAt','schemaVersion','preMutationRevision','byteLength','sha256Hex'], 'manifest exact keys');
equal(manifest.sourceFileId, SOURCE_ID, 'manifest exact source ID');
equal(manifest.backupFileId, backup.id, 'manifest exact backup ID');
equal(manifest.createdAt, first.updatedAt, 'manifest shares mutation time');
equal(manifest.schemaVersion, 1, 'manifest schema');
equal(manifest.preMutationRevision, 0, 'manifest pre-revision');
equal(manifest.byteLength, backup.bytes.length, 'manifest byte length');
equal(manifest.sha256Hex, crypto.createHash('sha256').update(backup.bytes).digest('hex'), 'manifest byte hash');

const beforeReplay = {
  clocks: createHarness.state.clockCalls,
  driveReads: createHarness.state.driveReads.length,
  created: createHarness.state.created.length,
  writes: createHarness.state.sourceWrites,
  propertyWrites: createHarness.state.propertyWrites.length,
  revision: written.revision,
  bytes: Buffer.from(createHarness.state.files.get(SOURCE_ID).bytes)
};
const retried = createHarness.post('officePilotCreate', pilotPayload(), { mutationId:'mutation_replay_fresh_0001' });
deepEqual(retried, first, 'idempotent replay reconstructs exact ACK');
equal(createHarness.state.clockCalls - beforeReplay.clocks, 1, 'idempotent replay uses no mutation clock');
equal(createHarness.state.driveReads.length - beforeReplay.driveReads, 1, 'idempotent replay performs only the required exact source read');
equal(createHarness.state.created.length, beforeReplay.created, 'idempotent replay creates no backup');
equal(createHarness.state.sourceWrites, beforeReplay.writes, 'idempotent replay writes no source');
equal(createHarness.state.propertyWrites.length, beforeReplay.propertyWrites, 'idempotent replay does not arm latch');
deepEqual(createHarness.state.files.get(SOURCE_ID).bytes, beforeReplay.bytes, 'idempotent replay preserves exact source');
assertFailure(createHarness.post('officePilotCreate', pilotPayload({ complexName:'다른 단지' }), {
  mutationId:'mutation_conflict_fresh_01'
}), 'idempotency-conflict', 'changed idempotent payload');

assertFailure(createHarness.post('officePilotUpdate', pilotUpdatePayload(first.id, 0), {
  mutationId:'mutation_1234567890123456'
}), 'replay-request', 'mutation replay precedes revision');
assertFailure(createHarness.post('officePilotUpdate', { ...pilotUpdatePayload(first.id, 0), unexpected:true }, {
  mutationId:'mutation_unknown_fresh_001'
}), 'unknown-field', 'canonical unknown field precedes revision');
const missingUpdate = pilotUpdatePayload(first.id, 0);
delete missingUpdate.notes;
assertFailure(createHarness.post('officePilotUpdate', missingUpdate, {
  mutationId:'mutation_missing_fresh_001'
}), 'invalid-input', 'canonical missing field precedes revision');
assertFailure(createHarness.post('officePilotUpdate', pilotUpdatePayload(first.id, 0), {
  mutationId:'mutation_revision_fresh_01'
}), 'revision-conflict', 'fresh stale revision fails after canonical validation');

for (const [label, options, expected] of [
  ['missing source property', { properties:{ OFFICE_OPS_FILE_ID:null } }, 'invalid-store'],
  ['Drive source lookup throws', { hooks:{ driveLookup(){ throw new Error('source lookup secret'); } } }, 'server-error'],
  ['returned source ID mismatch', { sourceReturnedId:'OTHER_SOURCE_ID' }, 'invalid-store'],
  ['trashed source', { sourceTrashed:true }, 'invalid-store'],
  ['wrong source name', { sourceName:'wrong.json' }, 'invalid-store'],
  ['wrong source MIME', { sourceMime:'text/plain' }, 'invalid-store'],
  ['no source parent', { sourceParentIds:[] }, 'invalid-store'],
  ['multiple source parents', { sourceParentIds:[PARENT_ID,'OTHER_PARENT'] }, 'invalid-store'],
  ['invalid UTF-8', { sourceBytes:Buffer.from([0xc3,0x28]) }, 'invalid-store'],
  ['UTF-8 BOM', { sourceBytes:Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(emptyStore()))]) }, 'invalid-store'],
  ['malformed source JSON', { sourceBytes:Buffer.from('{') }, 'invalid-store'],
  ['wrong schema version', { store:{ ...emptyStore(), schemaVersion:2 } }, 'invalid-store']
]) {
  const harness = makeHarness(options);
  assertFailure(harness.post('officeOpsList', {}), expected, label);
  equal(harness.state.created.length, 0, label + ' creates no backup');
  equal(harness.state.sourceWrites, 0, label + ' writes no source');
  equal(harness.state.propertyWrites.length, 0, label + ' writes no property');
}

for (const [label, options, expected, releases] of [
  ['lock unavailable', { lockUnavailable:true }, 'lock-unavailable', 0],
  ['getScriptLock throw', { hooks:{ getScriptLock(){ throw new Error('secret lock get'); } } }, 'server-error', 0],
  ['tryLock throw', { hooks:{ tryLock(){ throw new Error('secret lock try'); } } }, 'server-error', 0],
  ['locked body throw', { hooks:{ driveLookup(){ throw new Error('secret drive body'); } } }, 'server-error', 1]
]) {
  const harness = makeHarness(options);
  assertFailure(harness.post('officePilotCreate', pilotPayload()), expected, label);
  equal(harness.state.lock.releaseCalls, releases, label + ' release count');
}

const releaseAfterSuccess = makeHarness({ hooks:{ releaseLock(){ throw new Error('secret release'); } } });
equal(releaseAfterSuccess.post('officePilotCreate', pilotPayload()).ok, true, 'release exception does not mask success');
equal(releaseAfterSuccess.state.lock.releaseCalls, 1, 'release exception attempted once');

const releaseAfterPrimary = makeHarness({ hooks:{
  driveLookup(){ throw new Error('primary drive secret'); },
  releaseLock(){ throw new Error('secondary release secret'); }
} });
assertFailure(releaseAfterPrimary.post('officePilotCreate', pilotPayload()), 'server-error', 'release exception does not mask primary error');
equal(releaseAfterPrimary.state.lock.releaseCalls, 1, 'primary error release attempted once');

for (const [label, mutate, expected] of [
  ['token changed while waiting', state => { state.properties.OFFICE_OPS_TOKEN = 'CHANGED_TOKEN'; }, 'unauthorized'],
  ['latch armed while waiting', state => { state.properties.OFFICE_OPS_RECOVERY_REQUIRED = '1'; }, 'manual-recovery-required'],
  ['disabled while waiting', state => { state.properties.OFFICE_OPS_ENABLED = '0'; }, 'office-disabled']
]) {
  const harness = makeHarness({ hooks:{ tryLock({state}) { mutate(state); return true; } } });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), expected, label);
  deepEqual(harness.state.propertyReads.slice(3), [
    'OFFICE_OPS_TOKEN','OFFICE_OPS_RECOVERY_REQUIRED','OFFICE_OPS_ENABLED'
  ].slice(0, expected === 'unauthorized' ? 1 : expected === 'manual-recovery-required' ? 2 : 3), label + ' locked gate order');
  equal(harness.state.driveReads.length, 0, label + ' rejects before Drive');
  equal(harness.state.lock.releaseCalls, 1, label + ' releases lock');
}

for (const action of [
  'officeInspectionBeginConversion',
  'officeInspectionArmLocalCommit',
  'officeInspectionRecordLocalCommit',
  'officeInspectionFinalizeConversion',
  'officeInspectionCancelConversion'
]) {
  const harness = makeHarness();
  assertFailure(harness.post(action, {}), 'conversion-disabled', action + ' production gate');
  equal(harness.state.clockCalls, 1, action + ' gate uses request clock only');
  equal(harness.state.driveReads.length, 0, action + ' gate rejects before Drive');
  equal(harness.state.created.length, 0, action + ' gate creates no backup');
  equal(harness.state.sourceWrites, 0, action + ' gate writes no source');
  equal(harness.state.propertyWrites.length, 0, action + ' gate writes no property');
  equal(harness.state.lock.releaseCalls, 1, action + ' gate releases lock');
  deepEqual(harness.state.propertyReads, [
    'OFFICE_OPS_TOKEN','OFFICE_OPS_RECOVERY_REQUIRED','OFFICE_OPS_ENABLED',
    'OFFICE_OPS_TOKEN','OFFICE_OPS_RECOVERY_REQUIRED','OFFICE_OPS_ENABLED'
  ], action + ' gate follows public then locked property order');
}

function conversionReplayFixture(builder, action) {
  const terms = {
    workKind:'preventive-inspection', scope:'지하 배수 점검', exclusions:[], vatMode:'included',
    quotedAmount:100000, validUntil:'2026-09-30', scheduleWindow:'2026-09-02'
  };
  const termsSha256 = builder.sandbox.ooTermsSha256_(terms);
  const approval = {
    receiptId:'receipt_test_001', subjectType:'aptOrder', subjectId:'pending_test_001',
    approvedTermsSha256:termsSha256, approvalEvidenceType:'quote-file',
    approvalEvidenceFileId:'TEST_EVIDENCE_FILE_0001', approvalEvidenceSha256:'a'.repeat(64),
    approvedAt:'2026-08-31T09:59:00+09:00', approvedByRole:'management-office',
    issuedAt:'2026-08-31T10:00:00+09:00', receiptHmac:'b'.repeat(64)
  };
  const actions = [
    'officeInspectionBeginConversion',
    'officeInspectionArmLocalCommit',
    'officeInspectionRecordLocalCommit',
    'officeInspectionFinalizeConversion'
  ];
  const targetIndex = actions.indexOf(action);
  const stage = {
    officeInspectionBeginConversion:'conversion-pending',
    officeInspectionArmLocalCommit:'conversion-writing',
    officeInspectionRecordLocalCommit:'conversion-local-committed',
    officeInspectionFinalizeConversion:'converted'
  }[action];
  const stageTimes = [
    '2026-08-31T10:00:01+09:00',
    '2026-08-31T10:00:02+09:00',
    '2026-08-31T10:00:03+09:00',
    '2026-08-31T10:00:04+09:00'
  ];
  function payloadFor(stepAction, revision) {
    const base = {
      inspectionId:'inspection_replay_001', conversionId:'conversion_test_001', pendingOrderId:'pending_test_001',
      receiptId:'receipt_test_001', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_test_001',
      termsSha256, expectedRevision:revision
    };
    if (stepAction === 'officeInspectionBeginConversion') return { ...base, commercialTerms:terms, commercialApproval:approval };
    if (stepAction === 'officeInspectionRecordLocalCommit' || stepAction === 'officeInspectionFinalizeConversion') {
      return { ...base, linkedOrderId:'pending_test_001' };
    }
    return base;
  }
  const payload = payloadFor(action, targetIndex);
  const at = stageTimes[targetIndex];
  const inspection = {
    inspectionId:'inspection_replay_001', officeId:'office_replay_001', complexName:'재전송 단지',
    templateId:'preventive-v1', status:stage, nextDueAt:'2026-09-02', riskItems:['배수 확인'], summary:'재전송 검증',
    commercialTerms:terms, commercialApproval:approval, conversionId:'conversion_test_001',
    conversionTermsSha256:termsSha256, conversionReceiptId:'receipt_test_001', pendingOrderId:'pending_test_001',
    linkedOrderId:stage === 'conversion-local-committed' || stage === 'converted' ? 'pending_test_001' : null,
    conversionStartedAt:stageTimes[0], updatedAt:at, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null
  };
  const audit = actions.slice(0, targetIndex + 1).map((stepAction, revision) => {
    const canonical = builder.sandbox.ooCanonicalMutation_(stepAction, payloadFor(stepAction, revision));
    equal(canonical.ok, true, stepAction + ' sequential replay fixture canonical');
    return {
      action:stepAction, result:'ok', id:inspection.inspectionId,
      mutationId:`mutation_seed_conversion_${String(revision + 1).padStart(2, '0')}`,
      idempotencyKey:null, payloadSha256:canonical.sha256Hex, at:stageTimes[revision], actor:'representative', lifecycleBefore:null,
      backupFileId:`BACKUP_CONVERSION_${revision + 1}`, backupManifestFileId:`MANIFEST_CONVERSION_${revision + 1}`,
      backupSha256:'c'.repeat(64), preMutationRevision:revision
    };
  });
  return {
    payload,
    store:{ ...emptyStore(at), revision:audit.length, inspections:[inspection], audit },
    ack:{ ok:true, id:inspection.inspectionId, revision:audit.length, updatedAt:at }
  };
}

for (const action of [
  'officeInspectionBeginConversion',
  'officeInspectionArmLocalCommit',
  'officeInspectionRecordLocalCommit',
  'officeInspectionFinalizeConversion'
]) {
  const builder = makeHarness();
  const fixture = conversionReplayFixture(builder, action);
  const harness = makeHarness({ store:fixture.store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const beforeBytes = Buffer.from(harness.state.files.get(SOURCE_ID).bytes);
  const replay = harness.post(action, fixture.payload, { mutationId:`mutation_fresh_${action}` });
  deepEqual(replay, fixture.ack, action + ' exact safe replay ACK');
  equal(harness.state.clockCalls, 1, action + ' safe replay uses no mutation clock');
  equal(harness.state.driveReads.length, 1, action + ' safe replay performs only the required exact source read');
  equal(harness.state.created.length, 0, action + ' safe replay creates no backup');
  equal(harness.state.sourceWrites, 0, action + ' safe replay writes no source');
  equal(harness.state.propertyWrites.length, 0, action + ' safe replay writes no property');
  deepEqual(harness.state.files.get(SOURCE_ID).bytes, beforeBytes, action + ' safe replay preserves source');
}

const auditFailureStores = [];
{
  const store = committedStore(1);
  store.audit = [];
  auditFailureStores.push(['audit length differs from revision', store]);
}
{
  const store = committedStore(1);
  store.audit[0].preMutationRevision = 1;
  auditFailureStores.push(['noncontiguous audit revision', store]);
}
{
  const store = committedStore(2);
  store.audit[1].mutationId = store.audit[0].mutationId;
  auditFailureStores.push(['duplicate mutation ID', store]);
}
{
  const store = committedStore(2);
  store.audit[1].idempotencyKey = store.audit[0].idempotencyKey;
  auditFailureStores.push(['duplicate create key', store]);
}
{
  const store = committedStore(1);
  store.audit[0].action = 'officePilotUpdate';
  auditFailureStores.push(['create key on non-create action', store]);
}
{
  const store = committedStore(1);
  store.audit[0].idempotencyKey = null;
  auditFailureStores.push(['null key on create action', store]);
}
{
  const store = committedStore(1);
  store.audit[0].id = 'inspection_wrong_family';
  auditFailureStores.push(['wrong action ID family', store]);
}
{
  const store = committedStore(1);
  store.updatedAt = '2026-08-31T10:00:02+09:00';
  auditFailureStores.push(['final audit time mismatch', store]);
}
{
  const store = committedStore(1);
  store.audit[0].unexpected = true;
  auditFailureStores.push(['extra audit ACK field', store]);
}
{
  const store = committedStore(1);
  delete store.audit[0].at;
  auditFailureStores.push(['missing audit ACK field', store]);
}
{
  const store = committedStore(1);
  store.audit[0].backupManifestFileId = store.audit[0].backupFileId;
  auditFailureStores.push(['duplicate audit backup IDs', store]);
}
{
  const store = committedStore(1);
  store.pilots.push(JSON.parse(JSON.stringify(store.pilots[0])));
  auditFailureStores.push(['duplicate record ID', store]);
}
for (const [label, store] of auditFailureStores) {
  const harness = makeHarness({ store });
  assertFailure(harness.post('officeOpsList', {}), 'invalid-store', label);
  equal(harness.state.created.length, 0, label + ' creates no backup');
  equal(harness.state.sourceWrites, 0, label + ' writes no source');
  equal(harness.state.propertyWrites.length, 0, label + ' writes no property');
}

for (const [label, properties, expected] of [
  ['missing token', { OFFICE_OPS_TOKEN:null }, 'unauthorized'],
  ['empty token', { OFFICE_OPS_TOKEN:'' }, 'unauthorized'],
  ['missing latch', { OFFICE_OPS_RECOVERY_REQUIRED:null }, 'manual-recovery-required'],
  ['empty latch', { OFFICE_OPS_RECOVERY_REQUIRED:'' }, 'manual-recovery-required'],
  ['unexpected latch', { OFFICE_OPS_RECOVERY_REQUIRED:'2' }, 'manual-recovery-required'],
  ['missing enabled', { OFFICE_OPS_ENABLED:null }, 'office-disabled'],
  ['empty enabled', { OFFICE_OPS_ENABLED:'' }, 'office-disabled'],
  ['unexpected enabled', { OFFICE_OPS_ENABLED:'2' }, 'office-disabled']
]) {
  const harness = makeHarness({ properties });
  assertFailure(harness.post('officeOpsList', {}), expected, label);
  equal(harness.state.driveReads.length, 0, label + ' rejects before Drive');
}

const propertyThrow = makeHarness({ hooks:{ getProperty(){ throw new Error('TEST_ONLY_OFFICE_OPS_TOKEN property stack'); } } });
assertFailure(propertyThrow.post('officeOpsList', {}), 'server-error', 'property exception');
equal(propertyThrow.state.driveReads.length, 0, 'property exception rejects before Drive');

{
  const harness = makeHarness();
  const output = harness.sandbox.doPost({ postData:{ contents:'{' } });
  assertFailure(JSON.parse(output.text), 'bad-request', 'normal JSON SyntaxError');
}
{
  const harness = makeHarness();
  const nativeJson = harness.sandbox.JSON;
  harness.sandbox.JSON = {
    stringify:nativeJson.stringify,
    parse() { throw new Error('parser TEST_ONLY_OFFICE_OPS_TOKEN'); }
  };
  const output = harness.sandbox.doPost({ postData:{ contents:'{}' } });
  harness.sandbox.JSON = nativeJson;
  assertFailure(nativeJson.parse(output.text), 'server-error', 'non-SyntaxError parser failure');
}
{
  const harness = makeHarness();
  const output = harness.sandbox.doPost({ postData:{ get contents() { throw new Error('raw TEST_ONLY_OFFICE_OPS_TOKEN'); } } });
  assertFailure(JSON.parse(output.text), 'server-error', 'raw input exception');
}
{
  const harness = makeHarness();
  harness.sandbox.ooDispatch_ = function() { throw new Error('dispatch TEST_ONLY_OFFICE_OPS_TOKEN'); };
  const output = harness.sandbox.doPost({ postData:{ contents:JSON.stringify(harness.request('officeOpsList', {})) } });
  assertFailure(JSON.parse(output.text), 'server-error', 'dispatch exception');
}
{
  let outputCalls = 0;
  const harness = makeHarness({ hooks:{ createTextOutput(){ outputCalls += 1; if (outputCalls === 1) throw new Error('output secret'); } } });
  const output = harness.sandbox.doPost({ postData:{ contents:JSON.stringify(harness.request('officeOpsList', {})) } });
  assertFailure(JSON.parse(output.text), 'server-error', 'normal output exception');
  equal(outputCalls, 2, 'output boundary retries only redacted server error');
}

const backupFailureCases = [
  ['backup create throw', {
    beforeCreate({role}) { if (role === 'backup') throw new Error('backup create secret'); }
  }],
  ['manifest create throw', {
    beforeCreate({role}) { if (role === 'manifest') throw new Error('manifest create secret'); }
  }],
  ['backup returned source ID', {
    afterCreate({role,data}) { if (role === 'backup') data.returnedId = SOURCE_ID; }
  }],
  ['backup wrong name', {
    afterCreate({role,data}) { if (role === 'backup') data.name = 'wrong-backup.json'; }
  }],
  ['backup wrong MIME', {
    afterCreate({role,data}) { if (role === 'backup') data.mime = 'text/plain'; }
  }],
  ['backup wrong parent', {
    afterCreate({role,data}) { if (role === 'backup') data.parentIds = ['OTHER_PARENT']; }
  }],
  ['backup trashed', {
    afterCreate({role,data}) { if (role === 'backup') data.trashed = true; }
  }],
  ['manifest duplicate pair ID', {
    afterCreate({role,data,state}) {
      if (role === 'backup') data.returnedId = 'DUPLICATE_PAIR_ID';
      if (role === 'manifest') data.returnedId = 'DUPLICATE_PAIR_ID';
    }
  }],
  ['manifest wrong name', {
    afterCreate({role,data}) { if (role === 'manifest') data.name = 'wrong.manifest.json'; }
  }],
  ['manifest wrong MIME', {
    afterCreate({role,data}) { if (role === 'manifest') data.mime = 'text/plain'; }
  }],
  ['manifest wrong parent', {
    afterCreate({role,data}) { if (role === 'manifest') data.parentIds = ['OTHER_PARENT']; }
  }],
  ['manifest trashed', {
    afterCreate({role,data}) { if (role === 'manifest') data.trashed = true; }
  }],
  ['manifest malformed JSON', {
    afterCreate({role,data}) { if (role === 'manifest') data.bytes = Buffer.from('{'); }
  }],
  ['manifest invalid UTF-8', {
    afterCreate({role,data}) { if (role === 'manifest') data.bytes = Buffer.from([0xc3,0x28]); }
  }],
  ['manifest extra field', {
    afterCreate({role,data}) {
      if (role === 'manifest') {
        const value = JSON.parse(data.bytes.toString('utf8'));
        value.unexpected = true;
        data.bytes = Buffer.from(JSON.stringify(value));
      }
    }
  }],
  ['manifest non-KST createdAt', {
    afterCreate({role,data}) {
      if (role === 'manifest') {
        const value = JSON.parse(data.bytes.toString('utf8'));
        value.createdAt = '2026-08-31T01:00:01Z';
        data.bytes = Buffer.from(JSON.stringify(value));
      }
    }
  }],
  ['backup reread throw', {
    beforeBlobRead({data}) { if (data.role === 'backup') throw new Error('backup reread secret'); }
  }],
  ['manifest reread throw', {
    beforeBlobRead({data}) { if (data.role === 'manifest') throw new Error('manifest reread secret'); }
  }],
  ['backup bytes changed', {
    afterCreate({role,data}) { if (role === 'backup') data.bytes = Buffer.from(JSON.stringify({ ...emptyStore(), updatedAt:'2026-08-31T09:59:59+09:00' })); }
  }],
  ['coherently replaced pair', {
    afterCreate({role,data,state}) {
      if (role !== 'manifest') return;
      const backupData = [...state.files.values()].find(file => file.role === 'backup');
      backupData.bytes = Buffer.from(JSON.stringify({ ...emptyStore(), updatedAt:'2026-08-31T09:59:59+09:00' }));
      const value = JSON.parse(data.bytes.toString('utf8'));
      value.byteLength = backupData.bytes.length;
      value.sha256Hex = crypto.createHash('sha256').update(backupData.bytes).digest('hex');
      data.bytes = Buffer.from(JSON.stringify(value));
    }
  }]
];
for (const [label, hook] of backupFailureCases) {
  const harness = makeHarness({ hooks:hook });
  const sourceBefore = Buffer.from(harness.state.files.get(SOURCE_ID).bytes);
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'backup-verify-failed', label);
  deepEqual(harness.state.files.get(SOURCE_ID).bytes, sourceBefore, label + ' leaves exact source bytes');
  equal(JSON.parse(harness.state.files.get(SOURCE_ID).bytes.toString('utf8')).revision, 0, label + ' leaves revision');
  equal(harness.state.sourceWrites, 0, label + ' performs no source write');
  equal(harness.state.propertyWrites.length, 0, label + ' does not arm latch');
  for (const trashedId of harness.state.trashCalls) {
    equal(harness.state.created.includes(trashedId), true, label + ' trashes only directly created artifacts');
    equal(trashedId === SOURCE_ID, false, label + ' never trashes source');
  }
  if (label === 'backup returned source ID') equal(harness.state.trashCalls.length, 0, label + ' never invokes trash through source-like handle');
}

{
  const harness = makeHarness({
    store:committedStore(1),
    extraFiles:[
      { id:'BACKUP_SEED_1', name:'prior-backup.json', bytes:Buffer.from('{}') },
      { id:'MANIFEST_SEED_1', name:'prior-manifest.json', bytes:Buffer.from('{}') }
    ],
    hooks:{ afterCreate({role,data}) { if (role === 'backup') data.returnedId = 'BACKUP_SEED_1'; } }
  });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'backup-verify-failed', 'backup returned prior audit artifact ID');
  equal(harness.state.trashCalls.length, 0, 'prior audit artifact collision invokes no trash');
  equal(harness.state.propertyWrites.length, 0, 'prior audit artifact collision never arms latch');
  equal(harness.state.sourceWrites, 0, 'prior audit artifact collision never writes source');
}

{
  const harness = makeHarness({
    extraFiles:[{ id:'UNRELATED_EXISTING', name:'unrelated-existing.json', bytes:Buffer.from('{}') }],
    hooks:{ afterCreate({role,data}) { if (role === 'backup') data.returnedId = 'UNRELATED_EXISTING'; } }
  });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'backup-verify-failed', 'backup returned unrelated preexisting ID');
  equal(harness.state.trashCalls.length, 0, 'unrelated backup collision invokes no trash');
  equal(harness.state.files.get('UNRELATED_EXISTING').trashed, false, 'unrelated same-parent file remains untrashed');
  equal(harness.state.propertyWrites.length, 0, 'unrelated backup collision never arms latch');
  equal(harness.state.sourceWrites, 0, 'unrelated backup collision never writes source');
}

{
  const harness = makeHarness({
    extraFiles:[{ id:'UNRELATED_EXISTING', name:'unrelated-existing.json', bytes:Buffer.from('{}') }],
    hooks:{ afterCreate({role,data}) { if (role === 'manifest') data.returnedId = 'UNRELATED_EXISTING'; } }
  });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'backup-verify-failed', 'manifest returned unrelated preexisting ID');
  deepEqual(harness.state.trashCalls, ['BACKUP_FILE_0001'], 'manifest collision cleans only proven-new backup');
  equal(harness.state.files.get('UNRELATED_EXISTING').trashed, false, 'manifest collision preserves unrelated file');
  equal(harness.state.propertyWrites.length, 0, 'manifest collision never arms latch');
  equal(harness.state.sourceWrites, 0, 'manifest collision never writes source');
}

{
  const harness = makeHarness();
  harness.sandbox.ooEnrichedCandidate_ = function() { return { ok:false, error:'invalid-store' }; };
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'invalid-store', 'candidate validation fails before latch');
  equal(harness.state.created.length, 2, 'candidate validation failure preserves verified pair');
  equal(harness.state.propertyWrites.length, 0, 'candidate validation failure never arms latch');
  equal(harness.state.properties.OFFICE_OPS_RECOVERY_REQUIRED, '0', 'candidate validation failure leaves confirmed clear state');
  equal(harness.state.sourceWrites, 0, 'candidate validation failure never writes source');
}

for (const [label, bytes] of [
  ['source whitespace change before latch', Buffer.from(JSON.stringify(emptyStore()) + ' ')],
  ['source valid JSON change before latch', Buffer.from(JSON.stringify({ ...emptyStore(), updatedAt:'2026-08-31T09:59:59+09:00' }))],
  ['source corrupt bytes before latch', Buffer.from([0xc3,0x28])],
  ['source malformed JSON before latch', Buffer.from('{')]
]) {
  const harness = makeHarness({ hooks:{
    beforeBlobRead({id,read,data}) { if (id === SOURCE_ID && read === 2) data.bytes = Buffer.from(bytes); }
  } });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'source-changed', label);
  equal(harness.state.created.length, 2, label + ' preserves verified pair');
  equal(harness.state.sourceWrites, 0, label + ' does not write source');
  equal(harness.state.propertyWrites.length, 0, label + ' does not arm latch');
  equal(harness.state.trashCalls.length, 0, label + ' does not clean verified pair');
}

for (const [label, hooks, expected, expectedWrites] of [
  ['arm write throws but readback is one', {
    setProperty({key,value,state}) {
      if (key === 'OFFICE_OPS_RECOVERY_REQUIRED' && value === '1') {
        state.properties[key] = '1';
        throw new Error('arm write ambiguous');
      }
    }
  }, null, 1],
  ['arm readback zero', {
    setProperty({key,value,state}) {
      if (key === 'OFFICE_OPS_RECOVERY_REQUIRED' && value === '1') {
        state.properties[key] = '0';
        return { skipDefault:true };
      }
    }
  }, 'recovery-arm-failed', 0],
  ['arm readback unreadable', {
    getProperty({key,state}) {
      if (key === 'OFFICE_OPS_RECOVERY_REQUIRED' && state.propertyWrites.length === 1) throw new Error('arm read secret');
      return Object.prototype.hasOwnProperty.call(state.properties,key) ? state.properties[key] : null;
    }
  }, 'recovery-state-unknown', 0]
]) {
  const harness = makeHarness({ hooks });
  const result = harness.post('officePilotCreate', pilotPayload());
  if (expected === null) equal(result.ok, true, label + ' proceeds only on observed one');
  else assertFailure(result, expected, label);
  equal(harness.state.sourceWrites, expectedWrites, label + ' source write count');
  if (expected !== null) {
    equal(harness.state.created.length, 2, label + ' preserves verified pair');
    equal(harness.state.trashCalls.length, 0, label + ' keeps pair untrashed');
  }
}

const writeVerifyCases = [
  ['source write throws', {
    beforeSetContent({call}) { if (call === 1) throw new Error('write secret'); }
  }],
  ['candidate valid but different', {
    afterSetContent({call,data}) {
      if (call === 1) {
        const value = JSON.parse(data.bytes.toString('utf8'));
        value.pilots[0].notes = '드라이브 변조';
        data.bytes = Buffer.from(JSON.stringify(value));
      }
    }
  }],
  ['candidate whitespace changed', {
    afterSetContent({call,data}) { if (call === 1) data.bytes = Buffer.concat([data.bytes,Buffer.from(' ')]); }
  }],
  ['candidate wrong revision', {
    afterSetContent({call,data}) {
      if (call === 1) {
        const value = JSON.parse(data.bytes.toString('utf8'));
        value.revision = 2;
        data.bytes = Buffer.from(JSON.stringify(value));
      }
    }
  }],
  ['candidate corrupt UTF-8', {
    afterSetContent({call,data}) { if (call === 1) data.bytes = Buffer.from([0xc3,0x28]); }
  }],
  ['candidate malformed JSON', {
    afterSetContent({call,data}) { if (call === 1) data.bytes = Buffer.from('{'); }
  }]
];
for (const [label, hooks] of writeVerifyCases) {
  const harness = makeHarness({ hooks });
  const sourceBefore = Buffer.from(harness.state.files.get(SOURCE_ID).bytes);
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'write-verify-failed', label);
  equal(harness.state.sourceWrites, 2, label + ' attempts write and exact restore');
  deepEqual(harness.state.files.get(SOURCE_ID).bytes, sourceBefore, label + ' restores exact bytes');
  equal(harness.state.properties.OFFICE_OPS_RECOVERY_REQUIRED, '0', label + ' clears latch after verified restore');
  equal(harness.state.created.length, 2, label + ' preserves verified pair');
}

const restoreFailureCases = [
  ['restore throws', {
    beforeSetContent({call}) { if (call === 1 || call === 2) throw new Error('write or restore secret'); }
  }],
  ['restore valid but different', {
    afterSetContent({call,data}) {
      if (call === 1) data.bytes = Buffer.from('{');
      if (call === 2) data.bytes = Buffer.from(JSON.stringify({ ...emptyStore(), updatedAt:'2026-08-31T09:59:59+09:00' }));
    }
  }],
  ['restore corrupt UTF-8', {
    afterSetContent({call,data}) {
      if (call === 1) data.bytes = Buffer.from('{');
      if (call === 2) data.bytes = Buffer.from([0xc3,0x28]);
    }
  }],
  ['restore wrong revision', {
    afterSetContent({call,data}) {
      if (call === 1) data.bytes = Buffer.from('{');
      if (call === 2) data.bytes = Buffer.from(JSON.stringify(committedStore(1)));
    }
  }]
];
for (const [label, hooks] of restoreFailureCases) {
  const harness = makeHarness({ hooks });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), 'manual-recovery-required', label);
  equal(harness.state.propertyWrites.length, 1, label + ' does not clear latch');
  equal(harness.state.properties.OFFICE_OPS_RECOVERY_REQUIRED, '1', label + ' leaves latch armed');
  equal(harness.state.created.length, 2, label + ' preserves pair');
  assertFailure(harness.post('officeOpsList', {}), 'manual-recovery-required', label + ' blocks later request');
}

{
  const harness = makeHarness();
  const source = harness.sandbox.ooSourceFile_();
  const loaded = harness.sandbox.ooReadStore_(source);
  loaded.bytes = [-61, 40];
  assertFailure(
    harness.sandbox.ooRestoreSourceAfterFailedWrite_(source, loaded, {}),
    'manual-recovery-required',
    'restore rejects non-roundtripping loaded bytes'
  );
  equal(harness.state.sourceWrites, 0, 'invalid restore bytes fail before setContent');
  equal(harness.state.propertyWrites.length, 0, 'invalid restore bytes do not touch latch');
}

for (const [label, clearValue, expected] of [
  ['clear readback remains one', '1', 'manual-recovery-required'],
  ['clear readback missing', null, 'recovery-state-unknown']
]) {
  const harness = makeHarness({ hooks:{
    setProperty({key,value,state}) {
      if (key === 'OFFICE_OPS_RECOVERY_REQUIRED' && value === '0') {
        if (clearValue === null) delete state.properties[key];
        else state.properties[key] = clearValue;
        return { skipDefault:true };
      }
    }
  } });
  assertFailure(harness.post('officePilotCreate', pilotPayload()), expected, label);
  equal(JSON.parse(harness.state.files.get(SOURCE_ID).bytes.toString('utf8')).revision, 1, label + ' keeps verified commit');
  equal(harness.state.created.length, 2, label + ' preserves current pair');
  assertFailure(harness.post('officeOpsList', {}), 'manual-recovery-required', label + ' next request obeys observed latch');
}

{
  const harness = makeHarness({ properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' } });
  const validated = harness.sandbox.ooRecoveryValidateSource_();
  deepEqual(Object.keys(validated), ['ok','sourceFileId','schemaVersion','revision','byteLength','sha256Hex'], 'recovery validator exact keys');
  equal(validated.ok, true, 'recovery validator succeeds');
  equal(validated.sourceFileId, SOURCE_ID, 'recovery validator returns exact source ID internally');
  equal(validated.schemaVersion, 1, 'recovery validator schema');
  equal(validated.revision, 0, 'recovery validator revision');
  equal(validated.byteLength, harness.state.files.get(SOURCE_ID).bytes.length, 'recovery validator length');
  equal(validated.sha256Hex, crypto.createHash('sha256').update(harness.state.files.get(SOURCE_ID).bytes).digest('hex'), 'recovery validator hash');
  equal(harness.state.logs.length, 1, 'recovery validator logs once');
  deepEqual(JSON.parse(harness.state.logs[0]), validated, 'recovery validator logs same sanitized tuple');
  equal(harness.state.lock.releaseCalls, 1, 'recovery validator releases once');
  equal(harness.state.sourceWrites, 0, 'recovery validator writes no source');
  equal(harness.state.propertyWrites.length, 0, 'recovery validator writes no properties');
  equal(harness.state.created.length, 0, 'recovery validator creates no Drive file');
  const serialized = JSON.stringify(validated) + harness.state.logs.join('');
  for (const forbidden of ['TEST_ONLY_OFFICE_OPS_TOKEN','테스트 단지','pilots','audit']) {
    equal(serialized.includes(forbidden), false, 'recovery validator redacts ' + forbidden);
  }
  equal(harness.sandbox.ooIsAllowedAction_('ooRecoveryValidateSource_'), false, 'recovery validator absent from action allowlist');
}

for (const [label, options] of [
  ['recovery validator wrong enabled flag', { properties:{ OFFICE_OPS_ENABLED:'1', OFFICE_OPS_RECOVERY_REQUIRED:'1' } }],
  ['recovery validator wrong latch flag', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'0' } }],
  ['recovery validator lock unavailable', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' }, lockUnavailable:true }],
  ['recovery validator get lock throws', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' }, hooks:{ getScriptLock(){ throw new Error('recovery token secret'); } } }],
  ['recovery validator try lock throws', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' }, hooks:{ tryLock(){ throw new Error('recovery try secret'); } } }],
  ['recovery validator malformed source', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' }, sourceBytes:Buffer.from('{') }],
  ['recovery flags change while waiting', { properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' }, hooks:{ tryLock({state}) { state.properties.OFFICE_OPS_RECOVERY_REQUIRED='0'; return true; } } }]
]) {
  const harness = makeHarness(options);
  throws(() => harness.sandbox.ooRecoveryValidateSource_(), /^Error: recovery-validation-failed:[a-z-]+$/, label);
  equal(harness.state.sourceWrites, 0, label + ' writes no source');
  equal(harness.state.propertyWrites.length, 0, label + ' writes no properties');
  equal(harness.state.created.length, 0, label + ' creates no files');
  equal(harness.state.logs.length, 0, label + ' logs nothing');
}

{
  const harness = makeHarness({
    properties:{ OFFICE_OPS_ENABLED:'0', OFFICE_OPS_RECOVERY_REQUIRED:'1' },
    hooks:{ releaseLock(){ throw new Error('recovery release secret'); } }
  });
  equal(harness.sandbox.ooRecoveryValidateSource_().ok, true, 'recovery release exception does not mask success');
  equal(harness.state.lock.releaseCalls, 1, 'recovery release attempted once');
}

function retentionNoiseFiles() {
  const otherBytes = Buffer.from(JSON.stringify(emptyStore()), 'utf8');
  const otherHash = crypto.createHash('sha256').update(otherBytes).digest('hex');
  const manifest = (sourceFileId, backupFileId, overrides = {}) => Buffer.from(JSON.stringify({
    sourceFileId,
    backupFileId,
    createdAt:'2026-08-30T10:00:00+09:00',
    schemaVersion:1,
    preMutationRevision:0,
    byteLength:otherBytes.length,
    sha256Hex:otherHash,
    ...overrides
  }));
  return [
    { id:'UNRELATED_JSON', name:'unrelated.json', bytes:otherBytes, role:'noise' },
    { id:'ORPHAN_BACKUP', name:'관리사무소영업운영_백업_20260830_090000.json', bytes:otherBytes, role:'noise' },
    { id:'ORPHAN_MANIFEST', name:'관리사무소영업운영_백업_20260830_090001.manifest.json', bytes:manifest(SOURCE_ID,'MISSING_BACKUP'), role:'noise' },
    { id:'CROSS_SOURCE_BACKUP', name:'관리사무소영업운영_백업_20260830_090002.json', bytes:otherBytes, role:'noise' },
    { id:'CROSS_SOURCE_MANIFEST', name:'관리사무소영업운영_백업_20260830_090002.manifest.json', bytes:manifest('OTHER_SOURCE','CROSS_SOURCE_BACKUP'), role:'noise' },
    { id:'CROSS_PARENT_BACKUP', name:'관리사무소영업운영_백업_20260830_090005.json', bytes:otherBytes, parentIds:['OTHER_PARENT'], role:'noise' },
    { id:'CROSS_PARENT_MANIFEST', name:'관리사무소영업운영_백업_20260830_090005.manifest.json', bytes:manifest(SOURCE_ID,'CROSS_PARENT_BACKUP'), role:'noise' },
    { id:'FORGED_BACKUP', name:'관리사무소영업운영_백업_20260830_090003.json', bytes:otherBytes, role:'noise' },
    { id:'FORGED_MANIFEST', name:'관리사무소영업운영_백업_20260830_090003.manifest.json', bytes:manifest(SOURCE_ID,'FORGED_BACKUP',{sha256Hex:'0'.repeat(64)}), role:'noise' },
    { id:'SOURCE_ALIAS_MANIFEST', name:'관리사무소영업운영_백업_20260830_090004.manifest.json', bytes:manifest(SOURCE_ID,SOURCE_ID), role:'noise' }
  ];
}

function performElevenCreates(harness) {
  let last;
  for (let index = 1; index <= 11; index += 1) {
    last = harness.post('officePilotCreate', pilotPayload({
      idempotencyKey:`create_retention_${String(index).padStart(16,'0')}`,
      complexName:`보존 단지 ${index}`
    }), { mutationId:`mutation_retention_${String(index).padStart(16,'0')}` });
    equal(last.ok, true, 'retention mutation ' + index + ' succeeds');
    equal(last.revision, index, 'retention mutation ' + index + ' revision');
  }
  return last;
}

{
  const noise = retentionNoiseFiles();
  const harness = makeHarness({ extraFiles:noise });
  performElevenCreates(harness);
  const backups = [...harness.state.files.values()].filter(file => file.role === 'backup');
  const manifests = [...harness.state.files.values()].filter(file => file.role === 'manifest');
  equal(backups.filter(file => !file.trashed).length, 10, 'retention keeps newest ten backups');
  equal(manifests.filter(file => !file.trashed).length, 10, 'retention keeps newest ten manifests');
  equal(harness.state.files.get('BACKUP_FILE_0001').trashed, true, 'retention trashes oldest backup');
  equal(harness.state.files.get('BACKUP_MANIFEST_0001').trashed, true, 'retention trashes oldest manifest');
  equal(harness.state.files.get('BACKUP_FILE_0011').trashed, false, 'retention keeps current backup');
  equal(harness.state.files.get('BACKUP_MANIFEST_0011').trashed, false, 'retention keeps current manifest');
  equal(harness.state.files.get(SOURCE_ID).trashed, false, 'retention never trashes source');
  for (const file of noise) equal(harness.state.files.get(file.id).trashed, false, 'retention preserves noise ' + file.id);
}

{
  let currentPairReplaced = false;
  const harness = makeHarness({ hooks:{
    setProperty({key,value,state}) {
      if (key !== 'OFFICE_OPS_RECOVERY_REQUIRED' || value !== '0' || currentPairReplaced ||
          !state.files.has('BACKUP_FILE_0011')) return null;
      currentPairReplaced = true;
      const replacementBytes = Buffer.from(JSON.stringify(committedStore(10)));
      const replacementHash = crypto.createHash('sha256').update(replacementBytes).digest('hex');
      state.files.get('BACKUP_FILE_0011').bytes = replacementBytes;
      const manifestFile = state.files.get('BACKUP_MANIFEST_0011');
      const manifest = JSON.parse(manifestFile.bytes.toString('utf8'));
      manifest.byteLength = replacementBytes.length;
      manifest.sha256Hex = replacementHash;
      manifestFile.bytes = Buffer.from(JSON.stringify(manifest));
      return null;
    }
  } });
  performElevenCreates(harness);
  equal(currentPairReplaced, true, 'retention current pair is coherently replaced before scan');
  equal(harness.state.files.get('BACKUP_FILE_0001').trashed, false, 'retention stops when current backup no longer matches verified pair');
  equal(harness.state.files.get('BACKUP_MANIFEST_0001').trashed, false, 'retention keeps old manifest when current pair binding changes');
  equal(harness.state.files.get('BACKUP_FILE_0011').trashed, false, 'retention never trashes replaced current backup');
  equal(harness.state.files.get('BACKUP_MANIFEST_0011').trashed, false, 'retention never trashes replaced current manifest');
}

{
  let changedAfterBackupTrashStarted = false;
  const harness = makeHarness({ hooks:{
    beforeTrash({id,state}) {
      if (id !== 'BACKUP_FILE_0001' || changedAfterBackupTrashStarted) return;
      changedAfterBackupTrashStarted = true;
      const manifest = state.files.get('BACKUP_MANIFEST_0001');
      const value = JSON.parse(manifest.bytes.toString('utf8'));
      value.sha256Hex = '0'.repeat(64);
      manifest.bytes = Buffer.from(JSON.stringify(value));
    }
  } });
  performElevenCreates(harness);
  equal(changedAfterBackupTrashStarted, true, 'retention mutation hook runs between pair trash calls');
  equal(harness.state.files.get('BACKUP_FILE_0001').trashed, true, 'retention may finish the already verified backup trash');
  equal(harness.state.files.get('BACKUP_MANIFEST_0001').trashed, false, 'retention reverifies remaining manifest immediately before trash');
  equal(harness.state.files.get(SOURCE_ID).trashed, false, 'retention inter-call mutation never trashes source');
  equal(harness.state.files.get('BACKUP_FILE_0011').trashed, false, 'retention inter-call mutation preserves current backup');
  equal(harness.state.files.get('BACKUP_MANIFEST_0011').trashed, false, 'retention inter-call mutation preserves current manifest');
}

{
  const harness = makeHarness({ hooks:{ beforeTrash(){ throw new Error('retention trash secret'); } } });
  const last = performElevenCreates(harness);
  equal(last.ok, true, 'retention cleanup failure never masks verified commit');
  equal(JSON.parse(harness.state.files.get(SOURCE_ID).bytes.toString('utf8')).revision, 11, 'retention cleanup failure keeps commit');
  equal(harness.state.files.get(SOURCE_ID).trashed, false, 'retention cleanup failure never trashes source');
}

console.log(`office ops server tests: PASS (${assertions} assertions)`);

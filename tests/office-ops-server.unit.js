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

{
  const builder = makeHarness();
  const fixture = conversionReplayFixture(builder, 'officeInspectionBeginConversion');
  const inspection = fixture.store.inspections[0];
  inspection.status = 'closed';
  inspection.commercialApproval = null;
  inspection.conversionId = null;
  inspection.conversionTermsSha256 = null;
  inspection.conversionReceiptId = null;
  inspection.pendingOrderId = null;
  inspection.linkedOrderId = null;
  inspection.conversionStartedAt = null;
  const harness = makeHarness({ store:fixture.store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', fixture.payload, {
    mutationId:'mutation_inconsistent_conversion_ack_01'
  }), 'invalid-store', 'immediate conversion audit ACK must match stored transition result');
  assertNoWriteDelta(harness, before, 'inconsistent immediate conversion audit ACK', 1, 1);
}

{
  const builder = makeHarness();
  const fixture = conversionReplayFixture(builder, 'officeInspectionBeginConversion');
  fixture.store.pilots = [storedPilot('pilot_seed_1')];
  fixture.store.audit = [auditRow()];
  const harness = makeHarness({ store:fixture.store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', fixture.payload, {
    mutationId:'mutation_missing_conversion_audit_001'
  }), 'invalid-store', 'immediate conversion state requires its exact audit ACK row');
  assertNoWriteDelta(harness, before, 'missing immediate conversion audit ACK', 1, 1);
}

{
  const builder = makeHarness();
  const fixture = conversionReplayFixture(builder, 'officeInspectionBeginConversion');
  const inspection = fixture.store.inspections[0];
  inspection.archivedAt = '2026-08-31T09:58:00+09:00';
  inspection.archivedBy = 'representative';
  inspection.archiveReason = '불가능한 전환 보관 상태';
  const harness = makeHarness({ store:fixture.store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', fixture.payload, {
    mutationId:'mutation_archived_conversion_ack_001'
  }), 'invalid-store', 'archived conversion result cannot produce a replay ACK');
  assertNoWriteDelta(harness, before, 'archived immediate conversion audit ACK', 1, 1);
}

{
  const builder = makeHarness();
  const fixture = conversionReplayFixture(builder, 'officeInspectionBeginConversion');
  const sameSecond = fixture.store.updatedAt;
  fixture.store.pilots = [storedPilot('pilot_same_second', sameSecond)];
  fixture.store.audit.push(auditRow(1, {
    action:'officePilotUpdate', id:'pilot_same_second', mutationId:'mutation_seed_same_second_02',
    idempotencyKey:null, at:sameSecond, preMutationRevision:1
  }));
  fixture.store.revision = 2;
  const harness = makeHarness({ store:fixture.store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', {
    ...fixture.payload, expectedRevision:1
  }, { mutationId:'mutation_same_second_fresh_begin_001' }), 'revision-conflict',
  'same-second unrelated mutation stays a fresh revision conflict');
  assertNoWriteDelta(harness, before, 'same-second fresh begin revision conflict', 1, 1);
}

{
  const builder = makeHarness();
  const inspectionId = 'inspection_missing_second_begin';
  const currentAt = '2026-08-31T10:00:01+09:00';
  const inspection = storedInspectionFor(builder, 'conversion-pending', {
    inspectionId, officeId:'office_missing_second_begin', updatedAt:currentAt, conversionStartedAt:currentAt
  });
  const audit = [
    auditRow(0, {
      action:'officeInspectionBeginConversion', id:inspectionId, idempotencyKey:null,
      payloadSha256:'1'.repeat(64), at:'2026-08-31T09:59:58+09:00'
    }),
    auditRow(1, {
      action:'officeInspectionCancelConversion', id:inspectionId, idempotencyKey:null,
      payloadSha256:'2'.repeat(64), at:'2026-08-31T09:59:59+09:00'
    }),
    auditRow(2, {
      action:'officePilotUpdate', id:'pilot_missing_second_begin', idempotencyKey:null,
      payloadSha256:'3'.repeat(64), at:currentAt
    })
  ];
  const store = {
    ...emptyStore(currentAt), revision:3,
    pilots:[storedPilot('pilot_missing_second_begin', currentAt)], inspections:[inspection], audit
  };
  const harness = makeHarness({ store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const payload = conversionPayload(harness, inspectionId, 2);
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', payload, {
    mutationId:'mutation_missing_second_begin_audit_001'
  }), 'invalid-store', 'prior begin then cancel cannot explain a missing second begin audit');
  assertNoWriteDelta(harness, before, 'missing second begin audit', 1, 1);
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

// Task 4 RED: all remaining domain routes, replay/concurrency precedence,
// tombstones, consent history, participation timing, and generic rollback.
function lifecycleTerms(overrides = {}) {
  return {
    workKind:'preventive-inspection', scope:'지하 배수 점검', exclusions:[], vatMode:'included',
    quotedAmount:100000, validUntil:'2026-09-30', scheduleWindow:'2026-09-02', ...overrides
  };
}

function lifecycleApproval(harness, pendingOrderId = 'pending_lifecycle_001', receiptId = 'receipt_lifecycle_001', terms = lifecycleTerms()) {
  const termsSha256 = harness.sandbox.ooTermsSha256_(terms);
  return {
    receiptId, subjectType:'aptOrder', subjectId:pendingOrderId, approvedTermsSha256:termsSha256,
    approvalEvidenceType:'quote-file', approvalEvidenceFileId:'TEST_EVIDENCE_FILE_0001',
    approvalEvidenceSha256:'a'.repeat(64), approvedAt:'2026-08-31T09:59:00+09:00',
    approvedByRole:'management-office', issuedAt:'2026-08-31T10:00:00+09:00', receiptHmac:'b'.repeat(64)
  };
}

function storedInspectionFor(harness, status = 'proposal', overrides = {}) {
  const terms = overrides.commercialTerms === undefined ? lifecycleTerms() : overrides.commercialTerms;
  const pending = overrides.pendingOrderId || 'pending_lifecycle_001';
  const receipt = overrides.conversionReceiptId || 'receipt_lifecycle_001';
  const approval = lifecycleApproval(harness, pending, receipt, terms || lifecycleTerms());
  const conversion = ['conversion-pending','conversion-writing','conversion-local-committed','converted'].includes(status);
  return {
    inspectionId:'inspection_lifecycle_001', officeId:'office_lifecycle_001', complexName:'예방점검 단지',
    templateId:'preventive-v1', status, nextDueAt:'2026-09-02', riskItems:['배수 확인'], summary:'접근 허가 후 점검',
    commercialTerms:terms, commercialApproval:conversion ? approval : null,
    conversionId:conversion ? (overrides.conversionId || 'conversion_lifecycle_001') : null,
    conversionTermsSha256:conversion ? harness.sandbox.ooTermsSha256_(terms) : null,
    conversionReceiptId:conversion ? receipt : null, pendingOrderId:conversion ? pending : null,
    linkedOrderId:status === 'conversion-local-committed' || status === 'converted' ? pending : null,
    conversionStartedAt:conversion ? '2026-08-31T09:59:59+09:00' : null,
    updatedAt:'2026-08-31T10:00:00+09:00', archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null,
    ...overrides
  };
}

function inspectionCreatePayload(harness, overrides = {}) {
  return {
    idempotencyKey:'create_inspection_123456', officeId:'office_lifecycle_001', complexName:'예방점검 단지',
    templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-02', riskItems:['배수 확인'],
    summary:'접근 허가 후 점검', commercialTerms:lifecycleTerms(), commercialApproval:null, ...overrides
  };
}

function inspectionUpdatePayload(id, expectedRevision, overrides = {}) {
  return {
    inspectionId:id, expectedRevision, officeId:'office_lifecycle_001', complexName:'예방점검 수정 단지',
    templateId:'preventive-v1', status:'proposal', nextDueAt:'2026-09-03', riskItems:['우수관 확인'],
    summary:'수정된 점검 요약', commercialTerms:lifecycleTerms(), commercialApproval:null, ...overrides
  };
}

function consentRecordPayload(overrides = {}) {
  const text = '재점검 연락에 동의합니다.';
  return {
    idempotencyKey:'create_consent_123456', subjectType:'aptOrder', subjectId:'order_lifecycle_001',
    purpose:'preventive-reinspection', intervalMonths:6, channel:'phone', consentVersion:'reinspection-v1',
    consentTextSnapshot:text, consentTextSha256:crypto.createHash('sha256').update(text).digest('hex'), recordedBy:'대표',
    consentedAt:'2026-08-31T10:00:00+09:00', evidenceType:'message', evidenceId:'record_lifecycle_001', ...overrides
  };
}

function storedConsent(overrides = {}) {
  const payload = consentRecordPayload();
  return {
    consentId:'consent_lifecycle_001', subjectType:payload.subjectType, subjectId:payload.subjectId, purpose:payload.purpose,
    intervalMonths:payload.intervalMonths, channel:payload.channel, consentVersion:payload.consentVersion,
    consentTextSnapshot:payload.consentTextSnapshot, consentTextSha256:payload.consentTextSha256, recordedBy:payload.recordedBy,
    consentedAt:payload.consentedAt, withdrawnAt:null, withdrawnBy:null, withdrawalReason:null, nextDueAt:'2027-02-28',
    lastContactedAt:null, evidenceType:payload.evidenceType, evidenceId:payload.evidenceId,
    audit:[{ event:'recorded', at:'2026-08-31T10:00:00+09:00', actor:'대표', reason:null }], ...overrides
  };
}

function opportunityPayload(overrides = {}) {
  return {
    idempotencyKey:'create_opportunity_123456', complexName:'K-apt 단지', officialUrl:'https://www.k-apt.go.kr/a?x=1',
    observedAt:'2026-08-31T10:00:00+09:00', region:'대전', category:'배관',
    deadlineAt:'2026-09-30T10:00:00+09:00', stage:'review', requirements:['면허 확인'], verifiedBy:'대표', notes:'', ...overrides
  };
}

function opportunityUpdatePayload(id, expectedRevision, overrides = {}) {
  const payload = opportunityPayload(overrides);
  delete payload.idempotencyKey;
  return { opportunityId:id, expectedRevision, ...payload };
}

function storedOpportunity(overrides = {}) {
  const payload = opportunityPayload();
  return {
    opportunityId:'opp_lifecycle_001', complexName:payload.complexName, officialUrl:payload.officialUrl,
    observedAt:payload.observedAt, region:payload.region, category:payload.category, deadlineAt:payload.deadlineAt,
    stage:payload.stage, requirements:payload.requirements, verifiedBy:payload.verifiedBy, notes:payload.notes,
    retentionStartedAt:null, archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null, ...overrides
  };
}

function conversionPayload(harness, inspectionId, expectedRevision, overrides = {}) {
  const terms = lifecycleTerms();
  const pendingOrderId = overrides.pendingOrderId || 'pending_lifecycle_001';
  const receiptId = overrides.receiptId || 'receipt_lifecycle_001';
  const approval = lifecycleApproval(harness, pendingOrderId, receiptId, terms);
  return {
    inspectionId, conversionId:'conversion_lifecycle_001', pendingOrderId, receiptId,
    receiptSubjectType:'aptOrder', receiptSubjectId:pendingOrderId, termsSha256:harness.sandbox.ooTermsSha256_(terms),
    commercialTerms:terms, commercialApproval:approval, expectedRevision, ...overrides
  };
}

function noWriteSnapshot(harness) {
  return {
    clockCalls:harness.state.clockCalls, driveReads:harness.state.driveReads.length, created:harness.state.created.length,
    trashCalls:harness.state.trashCalls.length, propertyWrites:harness.state.propertyWrites.length,
    sourceWrites:harness.state.sourceWrites, bytes:Buffer.from(harness.state.files.get(SOURCE_ID).bytes)
  };
}

function assertNoWriteDelta(harness, before, label, expectedClockDelta = 1, expectedDriveDelta = 1) {
  equal(harness.state.clockCalls - before.clockCalls, expectedClockDelta, label + ' clock delta');
  equal(harness.state.driveReads.length - before.driveReads, expectedDriveDelta, label + ' Drive read delta');
  equal(harness.state.created.length, before.created, label + ' creates no backup');
  equal(harness.state.trashCalls.length, before.trashCalls, label + ' trashes nothing');
  equal(harness.state.propertyWrites.length, before.propertyWrites, label + ' writes no property');
  equal(harness.state.sourceWrites, before.sourceWrites, label + ' writes no source');
  deepEqual(harness.state.files.get(SOURCE_ID).bytes, before.bytes, label + ' preserves bytes');
}

let lifecycleMutation = 0;
function lifecyclePost(harness, action, payload) {
  lifecycleMutation += 1;
  return harness.post(action, payload, { mutationId:`mutation_lifecycle_${String(lifecycleMutation).padStart(16,'0')}` });
}

{
  const harness = makeHarness();
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };

  const closedPilot = lifecyclePost(harness, 'officePilotCreate', pilotPayload({
    idempotencyKey:'create_pilot_lifecycle_1', stage:'closed', pilotStartedAt:null, pilotEndsAt:null, extensionApprovedAt:null
  }));
  equal(closedPilot.ok, true, 'closed pilot create succeeds');
  let store = harness.post('officeOpsList', { includeArchived:true }).store;
  equal(store.pilots[0].retentionStartedAt, closedPilot.updatedAt, 'first terminal pilot starts retention');
  const stillClosed = lifecyclePost(harness, 'officePilotUpdate', pilotUpdatePayload(closedPilot.id, closedPilot.revision, { stage:'closed' }));
  equal(stillClosed.ok, true, 'pilot full replacement succeeds');
  store = harness.post('officeOpsList', { includeArchived:true }).store;
  equal(store.pilots[0].retentionStartedAt, closedPilot.updatedAt, 'terminal-to-terminal pilot preserves retention');
  const reopened = lifecyclePost(harness, 'officePilotUpdate', pilotUpdatePayload(closedPilot.id, stillClosed.revision));
  equal(reopened.ok, true);
  store = harness.post('officeOpsList', { includeArchived:true }).store;
  equal(store.pilots[0].retentionStartedAt, null, 'pilot terminal exit clears retention');
  const pilotArchive = lifecyclePost(harness, 'officePilotArchive', { pilotId:closedPilot.id, expectedRevision:reopened.revision, archiveReason:'상담 종료' });
  equal(pilotArchive.ok, true);
  equal(harness.post('officeOpsList', {}).store.pilots.length, 0, 'default list hides pilot tombstone');
  equal(harness.post('officeOpsList', { includeArchived:true }).store.pilots.length, 1, 'includeArchived shows pilot tombstone');
  const archivedPilotRow = harness.post('officeOpsList', { includeArchived:true }).store.pilots[0];
  assertFailure(lifecyclePost(harness, 'officePilotUpdate', pilotUpdatePayload(closedPilot.id, pilotArchive.revision)), 'already-archived', 'archived pilot update');
  const pilotRestore = lifecyclePost(harness, 'officePilotRestore', { pilotId:closedPilot.id, expectedRevision:pilotArchive.revision });
  equal(pilotRestore.ok, true);
  const restoredPilotRow = harness.post('officeOpsList', {}).store.pilots[0];
  equal(restoredPilotRow.pilotId, closedPilot.id, 'pilot restore preserves ID');
  equal(restoredPilotRow.archivedAt, null);
  equal(restoredPilotRow.restoredAt, pilotRestore.updatedAt);
  deepEqual(harness.post('officeOpsList', { includeArchived:true }).store.audit.find(row => row.action === 'officePilotRestore').lifecycleBefore, {
    archivedAt:archivedPilotRow.archivedAt, archivedBy:'representative', archiveReason:'상담 종료', restoredAt:null
  }, 'restore audit binds exact prior lifecycle');

  const consent = lifecyclePost(harness, 'officeConsentRecord', consentRecordPayload());
  equal(consent.ok, true, 'consent record succeeds');
  let consentRow = harness.post('officeOpsList', { includeArchived:true }).store.consents[0];
  equal(consentRow.lastContactedAt, null, 'consent stores no contact action');
  equal(harness.sandbox.ooConsentActive_(consentRow, REQUEST_NOW_MS), true);
  const withdrawn = lifecyclePost(harness, 'officeConsentWithdraw', {
    consentId:consent.id, expectedRevision:consent.revision, withdrawnBy:'대표', withdrawalReason:'고객 철회'
  });
  equal(withdrawn.ok, true, 'consent withdrawal succeeds');
  consentRow = harness.post('officeOpsList', {}).store.consents[0];
  equal(consentRow.withdrawnAt, withdrawn.updatedAt);
  equal(consentRow.audit.length, 2, 'withdrawal preserves history');
  equal(harness.sandbox.ooConsentActive_(consentRow, REQUEST_NOW_MS), false);
  const beforeSecondWithdraw = noWriteSnapshot(harness);
  assertFailure(lifecyclePost(harness, 'officeConsentWithdraw', {
    consentId:consent.id, expectedRevision:withdrawn.revision, withdrawnBy:'대표', withdrawalReason:'다시'
  }), 'already-withdrawn', 'already withdrawn consent');
  assertNoWriteDelta(harness, beforeSecondWithdraw, 'already withdrawn consent', 2, 1);

  const inspection = lifecyclePost(harness, 'officeInspectionCreate', inspectionCreatePayload(harness));
  equal(inspection.ok, true, 'inspection create succeeds');
  const inspectionUpdate = lifecyclePost(harness, 'officeInspectionUpdate', inspectionUpdatePayload(inspection.id, inspection.revision));
  equal(inspectionUpdate.ok, true, 'inspection full replacement succeeds');
  const inspectionArchive = lifecyclePost(harness, 'officeInspectionArchive', { inspectionId:inspection.id, expectedRevision:inspectionUpdate.revision, archiveReason:'계획 보류' });
  equal(inspectionArchive.ok, true);
  equal(harness.post('officeOpsList', {}).store.inspections.length, 0);
  const inspectionRestore = lifecyclePost(harness, 'officeInspectionRestore', { inspectionId:inspection.id, expectedRevision:inspectionArchive.revision });
  equal(inspectionRestore.ok, true);

  const beginPayload = conversionPayload(harness, inspection.id, inspectionRestore.revision);
  const begin = lifecyclePost(harness, 'officeInspectionBeginConversion', beginPayload);
  equal(begin.ok, true, 'conversion begin succeeds');
  let conversionRow = harness.post('officeOpsList', {}).store.inspections[0];
  equal(conversionRow.status, 'conversion-pending');
  equal(conversionRow.conversionStartedAt, begin.updatedAt);
  deepEqual(conversionRow.commercialApproval, beginPayload.commercialApproval);
  let beforeReplay = noWriteSnapshot(harness);
  const beginReplay = lifecyclePost(harness, 'officeInspectionBeginConversion', beginPayload);
  deepEqual(beginReplay, begin, 'begin exact replay returns exact ACK');
  assertNoWriteDelta(harness, beforeReplay, 'begin replay');

  const armPayload = {
    inspectionId:inspection.id, conversionId:beginPayload.conversionId, pendingOrderId:beginPayload.pendingOrderId,
    receiptId:beginPayload.receiptId, receiptSubjectType:'aptOrder', receiptSubjectId:beginPayload.pendingOrderId,
    termsSha256:beginPayload.termsSha256, expectedRevision:begin.revision
  };
  const arm = lifecyclePost(harness, 'officeInspectionArmLocalCommit', armPayload);
  equal(arm.ok, true, 'arm succeeds');
  beforeReplay = noWriteSnapshot(harness);
  deepEqual(lifecyclePost(harness, 'officeInspectionArmLocalCommit', armPayload), arm, 'arm exact replay ACK');
  assertNoWriteDelta(harness, beforeReplay, 'arm replay');
  const laterBeginBefore = noWriteSnapshot(harness);
  assertFailure(lifecyclePost(harness, 'officeInspectionBeginConversion', beginPayload), 'invalid-conversion-state', 'begin replay after later stage');
  assertNoWriteDelta(harness, laterBeginBefore, 'later begin replay');

  const recordPayload = { ...armPayload, linkedOrderId:armPayload.pendingOrderId, expectedRevision:arm.revision };
  const record = lifecyclePost(harness, 'officeInspectionRecordLocalCommit', recordPayload);
  equal(record.ok, true, 'record succeeds');
  beforeReplay = noWriteSnapshot(harness);
  deepEqual(lifecyclePost(harness, 'officeInspectionRecordLocalCommit', recordPayload), record, 'record exact replay ACK');
  assertNoWriteDelta(harness, beforeReplay, 'record replay');

  const finalizePayload = { ...recordPayload, expectedRevision:record.revision };
  const finalize = lifecyclePost(harness, 'officeInspectionFinalizeConversion', finalizePayload);
  equal(finalize.ok, true, 'finalize succeeds');
  beforeReplay = noWriteSnapshot(harness);
  deepEqual(lifecyclePost(harness, 'officeInspectionFinalizeConversion', finalizePayload), finalize, 'finalize exact replay ACK');
  assertNoWriteDelta(harness, beforeReplay, 'finalize replay');
  const convertedBefore = noWriteSnapshot(harness);
  assertFailure(lifecyclePost(harness, 'officeInspectionArchive', { inspectionId:inspection.id, expectedRevision:finalize.revision, archiveReason:'전환 종료' }), 'invalid-conversion-state', 'converted inspection archive');
  assertNoWriteDelta(harness, convertedBefore, 'converted inspection archive', 2, 1);

  const cancellable = lifecyclePost(harness, 'officeInspectionCreate', inspectionCreatePayload(harness, {
    idempotencyKey:'create_inspection_cancel_1', officeId:'office_cancel_001', complexName:'취소 점검'
  }));
  const cancellableBeginPayload = conversionPayload(harness, cancellable.id, cancellable.revision, {
    conversionId:'conversion_cancel_001', pendingOrderId:'pending_cancel_001', receiptId:'receipt_cancel_001', receiptSubjectId:'pending_cancel_001'
  });
  cancellableBeginPayload.commercialApproval = lifecycleApproval(harness, 'pending_cancel_001', 'receipt_cancel_001');
  const cancellableBegin = lifecyclePost(harness, 'officeInspectionBeginConversion', cancellableBeginPayload);
  equal(cancellableBegin.ok, true);
  const cancelled = lifecyclePost(harness, 'officeInspectionCancelConversion', {
    inspectionId:cancellable.id, conversionId:'conversion_cancel_001', expectedRevision:cancellableBegin.revision
  });
  equal(cancelled.ok, true, 'pending conversion may cancel');
  conversionRow = harness.post('officeOpsList', {}).store.inspections.find(row => row.inspectionId === cancellable.id);
  deepEqual({ status:conversionRow.status, approval:conversionRow.commercialApproval, conversionId:conversionRow.conversionId,
    hash:conversionRow.conversionTermsSha256, receipt:conversionRow.conversionReceiptId, pending:conversionRow.pendingOrderId,
    linked:conversionRow.linkedOrderId, started:conversionRow.conversionStartedAt },
  { status:'proposal', approval:null, conversionId:null, hash:null, receipt:null, pending:null, linked:null, started:null }, 'cancel clears conversion proof only');
  deepEqual(conversionRow.commercialTerms, harness.sandbox.ooCanonicalCommercialTerms_(lifecycleTerms()).value, 'cancel retains proposal terms');
  const cancelRetryBefore = noWriteSnapshot(harness);
  assertFailure(lifecyclePost(harness, 'officeInspectionCancelConversion', {
    inspectionId:cancellable.id, conversionId:'conversion_cancel_001', expectedRevision:cancellableBegin.revision
  }), 'invalid-conversion-state', 'cancel retry is not replay success');
  assertNoWriteDelta(harness, cancelRetryBefore, 'cancel retry');

  const opportunity = lifecyclePost(harness, 'officeOpportunityCreate', opportunityPayload({ stage:'skip' }));
  equal(opportunity.ok, true, 'opportunity create succeeds');
  let opportunityRow = harness.post('officeOpsList', {}).store.opportunities[0];
  equal(opportunityRow.retentionStartedAt, opportunity.updatedAt, 'opportunity terminal entry starts retention');
  const opportunityClosed = lifecyclePost(harness, 'officeOpportunityUpdate',
    opportunityUpdatePayload(opportunity.id, opportunity.revision, { stage:'closed', notes:'종료' }));
  equal(opportunityClosed.ok, true);
  opportunityRow = harness.post('officeOpsList', {}).store.opportunities[0];
  equal(opportunityRow.retentionStartedAt, opportunity.updatedAt, 'opportunity terminal-to-terminal preserves retention');
  const opportunityReview = lifecyclePost(harness, 'officeOpportunityUpdate',
    opportunityUpdatePayload(opportunity.id, opportunityClosed.revision, { stage:'review' }));
  equal(opportunityReview.ok, true);
  equal(harness.post('officeOpsList', {}).store.opportunities[0].retentionStartedAt, null, 'opportunity terminal exit clears retention');
  let participateCalls = 0;
  const originalParticipate = harness.sandbox.ooCanOpportunityParticipate_;
  harness.sandbox.ooCanOpportunityParticipate_ = function(row, serverNowMs, requestTimestampMs) {
    participateCalls += 1;
    equal(row.opportunityId, opportunity.id, 'participation receives locked server candidate');
    equal(serverNowMs, MUTATION_NOW_MS, 'participation receives mutation snapshot');
    equal(requestTimestampMs, REQUEST_NOW_MS, 'participation receives dispatcher timestamp');
    return originalParticipate(row, serverNowMs, requestTimestampMs);
  };
  const opportunityParticipate = lifecyclePost(harness, 'officeOpportunityUpdate',
    opportunityUpdatePayload(opportunity.id, opportunityReview.revision, { stage:'participate' }));
  equal(opportunityParticipate.ok, true, 'verified future K-apt opportunity may participate');
  equal(participateCalls, 1, 'participation helper called once');
  const opportunityArchive = lifecyclePost(harness, 'officeOpportunityArchive', { opportunityId:opportunity.id, expectedRevision:opportunityParticipate.revision, archiveReason:'검토 종료' });
  equal(opportunityArchive.ok, true);
  const opportunityRestore = lifecyclePost(harness, 'officeOpportunityRestore', { opportunityId:opportunity.id, expectedRevision:opportunityArchive.revision });
  equal(opportunityRestore.ok, true);

  const requiredTask4Routes = [
    'officePilotUpdate','officePilotArchive','officePilotRestore','officeConsentRecord','officeConsentWithdraw',
    'officeInspectionCreate','officeInspectionUpdate','officeInspectionArchive','officeInspectionRestore',
    'officeInspectionBeginConversion','officeInspectionArmLocalCommit','officeInspectionRecordLocalCommit',
    'officeInspectionFinalizeConversion','officeInspectionCancelConversion','officeOpportunityCreate','officeOpportunityUpdate',
    'officeOpportunityArchive','officeOpportunityRestore'
  ];
  const actionSet = new Set(harness.post('officeOpsList', { includeArchived:true }).store.audit.map(row => row.action));
  equal(requiredTask4Routes.length, 18, 'exact remaining Task 4 route count');
  for (const action of requiredTask4Routes) equal(actionSet.has(action), true, action + ' exercised successfully');
}

// Every tombstone family must hide/show symmetrically, retain exact lifecycle
// history, and start a fresh archive-retention reference after restore.
for (const config of (() => {
  const builder = makeHarness();
  return [
    {
      kind:'pilot', collection:'pilots', idField:'pilotId', id:'pilot_tombstone_matrix',
      archiveAction:'officePilotArchive', restoreAction:'officePilotRestore',
      record:storedPilot('pilot_tombstone_matrix', '2026-08-31T10:00:00+09:00', {
        stage:'closed', retentionStartedAt:'2026-01-01T10:00:00+09:00'
      })
    },
    {
      kind:'inspection', collection:'inspections', idField:'inspectionId', id:'inspection_tombstone_matrix',
      archiveAction:'officeInspectionArchive', restoreAction:'officeInspectionRestore',
      record:storedInspectionFor(builder, 'checked', {
        inspectionId:'inspection_tombstone_matrix', officeId:'office_tombstone_matrix'
      })
    },
    {
      kind:'opportunity', collection:'opportunities', idField:'opportunityId', id:'opp_tombstone_matrix',
      archiveAction:'officeOpportunityArchive', restoreAction:'officeOpportunityRestore',
      record:storedOpportunity({
        opportunityId:'opp_tombstone_matrix', stage:'skip', retentionStartedAt:'2026-01-01T10:00:00+09:00'
      })
    }
  ];
})()) {
  const store = { ...emptyStore(), [config.collection]:[config.record] };
  const harness = makeHarness({
    store,
    hooks:{ clock({index}) { return REQUEST_NOW_MS + index * 1000; } }
  });
  function businessSnapshot(row) {
    const value = JSON.parse(JSON.stringify(row));
    for (const field of ['updatedAt','archivedAt','archivedBy','archiveReason','restoredAt']) delete value[field];
    return value;
  }
  const beforeBusiness = businessSnapshot(config.record);
  const firstArchive = harness.post(config.archiveAction, {
    [config.idField]:config.id, expectedRevision:0, archiveReason:'첫 보관'
  }, { mutationId:`mutation_${config.kind}_matrix_archive_01` });
  equal(firstArchive.ok, true, config.kind + ' first archive succeeds');
  equal(harness.post('officeOpsList', {}).store[config.collection].length, 0, config.kind + ' default list hides tombstone');
  let fullStore = harness.post('officeOpsList', { includeArchived:true }).store;
  equal(fullStore[config.collection].length, 1, config.kind + ' includeArchived shows tombstone');
  const firstArchivedRow = fullStore[config.collection][0];
  equal(firstArchivedRow.archivedAt, firstArchive.updatedAt, config.kind + ' first archive timestamp');
  deepEqual(fullStore.audit.find(row => row.action === config.archiveAction && row.preMutationRevision === 0).lifecycleBefore, {
    archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:null
  }, config.kind + ' first archive audit preserves live lifecycle');

  const restored = harness.post(config.restoreAction, {
    [config.idField]:config.id, expectedRevision:firstArchive.revision
  }, { mutationId:`mutation_${config.kind}_matrix_restore_01` });
  equal(restored.ok, true, config.kind + ' restore succeeds');
  fullStore = harness.post('officeOpsList', { includeArchived:true }).store;
  const restoredRow = fullStore[config.collection][0];
  deepEqual(businessSnapshot(restoredRow), beforeBusiness, config.kind + ' restore preserves ID and business fields');
  deepEqual(fullStore.audit.find(row => row.action === config.restoreAction).lifecycleBefore, {
    archivedAt:firstArchive.updatedAt, archivedBy:'representative', archiveReason:'첫 보관', restoredAt:null
  }, config.kind + ' restore audit preserves exact tombstone lifecycle');

  const secondArchive = harness.post(config.archiveAction, {
    [config.idField]:config.id, expectedRevision:restored.revision, archiveReason:'두 번째 보관'
  }, { mutationId:`mutation_${config.kind}_matrix_archive_02` });
  equal(secondArchive.ok, true, config.kind + ' re-archive succeeds');
  equal(secondArchive.updatedAt === firstArchive.updatedAt, false, config.kind + ' re-archive uses a fresh timestamp');
  fullStore = harness.post('officeOpsList', { includeArchived:true }).store;
  const secondArchivedRow = fullStore[config.collection][0];
  equal(secondArchivedRow.archivedAt, secondArchive.updatedAt, config.kind + ' re-archive replaces archive reference');
  equal(fullStore[config.collection].length, 1, config.kind + ' lifecycle never deletes the row');
  deepEqual(fullStore.audit.find(row => row.action === config.archiveAction && row.preMutationRevision === restored.revision).lifecycleBefore, {
    archivedAt:null, archivedBy:null, archiveReason:null, restoredAt:restored.updatedAt
  }, config.kind + ' re-archive audit preserves restored lifecycle');
  const retention = harness.sandbox.ooRetentionRows_(fullStore, Date.parse('2028-09-01T10:00:00+09:00'));
  const retentionRow = retention.find(row => row.recordType === config.kind && row.recordId === config.id);
  equal(!!retentionRow, true, config.kind + ' re-archive becomes retention eligible');
  deepEqual({ reason:retentionRow.reason, referenceAt:retentionRow.referenceAt }, {
    reason:'archived', referenceAt:secondArchive.updatedAt
  }, config.kind + ' archive retention takes precedence and uses fresh reference');
}

// Immediate conversion replays with changed proof are classified precisely and
// never fall through to a stale-revision write path.
{
  const builder = makeHarness();
  const harness = makeHarness({ store:{ ...emptyStore(), inspections:[storedInspectionFor(builder)] } });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const original = conversionPayload(harness, 'inspection_lifecycle_001', 0);
  const begun = harness.post('officeInspectionBeginConversion', original, { mutationId:'mutation_proof_begin_0001' });
  equal(begun.ok, true, 'proof classifier fixture begins');
  const changedTerms = lifecycleTerms({ scheduleWindow:'2026-09-03' });
  const changedTermsHash = harness.sandbox.ooTermsSha256_(changedTerms);
  const changedTermsPayload = {
    ...original, termsSha256:changedTermsHash, commercialTerms:changedTerms,
    commercialApproval:lifecycleApproval(harness, original.pendingOrderId, original.receiptId, changedTerms)
  };
  const changedApproval = {
    ...original,
    commercialApproval:{ ...original.commercialApproval, approvalEvidenceSha256:'c'.repeat(64) }
  };
  const changedReceipt = {
    ...original, receiptId:'receipt_lifecycle_other',
    commercialApproval:lifecycleApproval(harness, original.pendingOrderId, 'receipt_lifecycle_other')
  };
  for (const [label, payload, expected] of [
    ['changed terms replay', changedTermsPayload, 'terms-mismatch'],
    ['changed approval replay', changedApproval, 'receipt-mismatch'],
    ['changed receipt replay', changedReceipt, 'receipt-mismatch'],
    ['changed identity replay', { ...original, conversionId:'conversion_lifecycle_other' }, 'invalid-conversion-state']
  ]) {
    const before = noWriteSnapshot(harness);
    assertFailure(harness.post('officeInspectionBeginConversion', payload, {
      mutationId:`mutation_proof_${label.replace(/\s/g,'_')}`
    }), expected, label);
    assertNoWriteDelta(harness, before, label);
  }
}

// Full tombstone error matrix and conversion-state archive/update/restore locks.
for (const [kind, idField, liveStore, archivedStore, updateAction, updatePayloadFactory, archiveAction, restoreAction] of [
  ['pilot', 'pilotId', { ...emptyStore(), pilots:[storedPilot()] }, { ...emptyStore(), pilots:[storedPilot('pilot_seed_1', '2026-08-31T10:00:00+09:00', { archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관' })] }, 'officePilotUpdate', () => pilotUpdatePayload('pilot_seed_1', 0), 'officePilotArchive', 'officePilotRestore'],
  ['inspection', 'inspectionId', (() => { const b=makeHarness(); return { ...emptyStore(), inspections:[storedInspectionFor(b, 'checked')] }; })(), (() => { const b=makeHarness(); return { ...emptyStore(), inspections:[storedInspectionFor(b, 'checked', { archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관' })] }; })(), 'officeInspectionUpdate', () => inspectionUpdatePayload('inspection_lifecycle_001', 0), 'officeInspectionArchive', 'officeInspectionRestore'],
  ['opportunity', 'opportunityId', { ...emptyStore(), opportunities:[storedOpportunity()] }, { ...emptyStore(), opportunities:[storedOpportunity({ archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관' })] }, 'officeOpportunityUpdate', () => opportunityUpdatePayload('opp_lifecycle_001', 0), 'officeOpportunityArchive', 'officeOpportunityRestore']
]) {
  const id = liveStore[kind === 'pilot' ? 'pilots' : kind === 'inspection' ? 'inspections' : 'opportunities'][0][idField];
  const unknownHarness = makeHarness({ store:liveStore });
  const unknownBefore = noWriteSnapshot(unknownHarness);
  const unknownId = kind === 'pilot' ? 'pilot_unknown' : kind === 'inspection' ? 'inspection_unknown' : 'opp_unknown';
  assertFailure(unknownHarness.post(archiveAction, { [idField]:unknownId, expectedRevision:0, archiveReason:'없음' }, { mutationId:`mutation_${kind}_unknown_001` }), 'not-found', kind + ' unknown archive');
  assertNoWriteDelta(unknownHarness, unknownBefore, kind + ' unknown archive', 2, 1);

  const archivedHarness = makeHarness({ store:archivedStore });
  const archiveAgainBefore = noWriteSnapshot(archivedHarness);
  assertFailure(archivedHarness.post(archiveAction, { [idField]:id, expectedRevision:0, archiveReason:'다시' }, { mutationId:`mutation_${kind}_archive_again` }), 'already-archived', kind + ' archive archived');
  assertNoWriteDelta(archivedHarness, archiveAgainBefore, kind + ' archive archived', 2, 1);
  const updateBefore = noWriteSnapshot(archivedHarness);
  assertFailure(archivedHarness.post(updateAction, updatePayloadFactory(), { mutationId:`mutation_${kind}_update_archived` }), 'already-archived', kind + ' update archived');
  assertNoWriteDelta(archivedHarness, updateBefore, kind + ' update archived', 2, 1);

  const liveHarness = makeHarness({ store:liveStore });
  const restoreLiveBefore = noWriteSnapshot(liveHarness);
  assertFailure(liveHarness.post(restoreAction, { [idField]:id, expectedRevision:0 }, { mutationId:`mutation_${kind}_restore_live` }), 'not-archived', kind + ' restore live');
  assertNoWriteDelta(liveHarness, restoreLiveBefore, kind + ' restore live', 2, 1);
}

for (const status of ['conversion-pending','conversion-writing','conversion-local-committed','converted']) {
  const builder = makeHarness();
  const inspectionId = `inspection_state_${status}`;
  const live = storedInspectionFor(builder, status, { inspectionId, officeId:`office_state_${status}` });
  const archived = {
    ...live, archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'전환 중 보관'
  };
  for (const [label, action, store, payload] of [
    [`${status} inspection update`, 'officeInspectionUpdate', { ...emptyStore(), inspections:[live] }, inspectionUpdatePayload(inspectionId, 0)],
    [`${status} inspection archive`, 'officeInspectionArchive', { ...emptyStore(), inspections:[live] }, { inspectionId, expectedRevision:0, archiveReason:'보류' }],
    [`${status} inspection restore`, 'officeInspectionRestore', { ...emptyStore(), inspections:[archived] }, { inspectionId, expectedRevision:0 }]
  ]) {
    const harness = makeHarness({ store });
    const before = noWriteSnapshot(harness);
    assertFailure(harness.post(action, payload, {
      mutationId:`mutation_state_${status}_${action}`
    }), 'invalid-conversion-state', label);
    assertNoWriteDelta(harness, before, label, 2, 1);
  }
}

// Only pending/link equality is legal inside one conversion request.
{
  const harness = makeHarness();
  const legalBody = {
    inspectionId:'inspection_target', conversionId:'conversion_distinct', pendingOrderId:'pending_same', linkedOrderId:'pending_same',
    receiptId:'receipt_distinct', receiptSubjectType:'aptOrder', receiptSubjectId:'pending_same', termsSha256:'a'.repeat(64), expectedRevision:0
  };
  const legalRequest = { action:'officeInspectionRecordLocalCommit', payload:legalBody };
  equal(harness.sandbox.ooValidateConversionIdentityOwnership_({ inspections:[] }, legalRequest, { json:JSON.stringify({ action:legalRequest.action, payload:legalBody }) }).ok, true, 'same-owner pending/link equality is legal');
  const illegalBody = { ...legalBody, conversionId:'pending_same' };
  const illegalRequest = { action:'officeInspectionRecordLocalCommit', payload:illegalBody };
  equal(harness.sandbox.ooValidateConversionIdentityOwnership_({ inspections:[] }, illegalRequest, { json:JSON.stringify({ action:illegalRequest.action, payload:illegalBody }) }).error, 'conversion-identity-conflict', 'conversion ID cannot hide in legal pending/link pair');
}

// Revision conflict must win before global identity validation; with the latest
// revision a reserved identity must fail without a mutation clock or writes.
{
  const seedHarness = makeHarness();
  const seedStore = {
    ...emptyStore(),
    inspections:[
      storedInspectionFor(seedHarness, 'proposal', { inspectionId:'inspection_race_001', officeId:'office_race_001' }),
      storedInspectionFor(seedHarness, 'proposal', { inspectionId:'inspection_race_002', officeId:'office_race_002' })
    ]
  };
  const harness = makeHarness({ store:seedStore });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  let identityCalls = 0;
  const originalIdentity = harness.sandbox.ooValidateConversionIdentityOwnership_;
  harness.sandbox.ooValidateConversionIdentityOwnership_ = function(...args) { identityCalls += 1; return originalIdentity(...args); };
  const firstPayload = conversionPayload(harness, 'inspection_race_001', 0, {
    conversionId:'conversion_race_shared', pendingOrderId:'pending_race_shared', receiptId:'receipt_race_shared', receiptSubjectId:'pending_race_shared'
  });
  firstPayload.commercialApproval = lifecycleApproval(harness, 'pending_race_shared', 'receipt_race_shared');
  const first = harness.post('officeInspectionBeginConversion', firstPayload, { mutationId:'mutation_race_first_0001' });
  equal(first.ok, true, 'first concurrent begin succeeds');
  identityCalls = 0;
  const secondPayload = { ...firstPayload, inspectionId:'inspection_race_002' };
  const staleBefore = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', secondPayload, { mutationId:'mutation_race_second_001' }), 'revision-conflict', 'stale concurrent begin');
  equal(identityCalls, 0, 'revision conflict precedes identity validation');
  assertNoWriteDelta(harness, staleBefore, 'stale concurrent begin');
  const latestBefore = noWriteSnapshot(harness);
  assertFailure(harness.post('officeInspectionBeginConversion', { ...secondPayload, expectedRevision:first.revision }, { mutationId:'mutation_race_latest_001' }), 'conversion-identity-conflict', 'latest revision reserved identity');
  equal(identityCalls, 1, 'latest revision reaches identity validation once');
  assertNoWriteDelta(harness, latestBefore, 'latest revision identity conflict');
}

// Every stored conversion identity reserves every incoming begin identity,
// regardless of tombstone visibility or which identity field holds it.
{
  const harness = makeHarness();
  const storedFields = ['conversionId','pendingOrderId','linkedOrderId','conversionReceiptId'];
  const incomingFields = ['conversionId','pendingOrderId','receiptId'];
  for (const archived of [false, true]) {
    for (const storedField of storedFields) {
      for (const incomingField of incomingFields) {
        const identities = {
          conversionId:'receipt_owner_conversion', pendingOrderId:'receipt_owner_pending',
          linkedOrderId:'receipt_owner_linked', conversionReceiptId:'receipt_owner_receipt'
        };
        const owner = { inspectionId:'inspection_owner', archivedAt:archived ? '2026-08-31T09:00:00+09:00' : null, ...identities };
        const body = {
          inspectionId:'inspection_target', conversionId:'receipt_incoming_conversion', pendingOrderId:'receipt_incoming_pending',
          receiptId:'receipt_incoming_receipt', receiptSubjectType:'aptOrder', receiptSubjectId:'receipt_incoming_pending',
          termsSha256:'a'.repeat(64), commercialTerms:lifecycleTerms(), commercialApproval:{}, expectedRevision:0
        };
        body[incomingField] = owner[storedField];
        if (incomingField === 'pendingOrderId') body.receiptSubjectId = body.pendingOrderId;
        const request = { action:'officeInspectionBeginConversion', payload:body };
        const canonical = { json:JSON.stringify({ action:request.action, payload:body }), sha256Hex:'a'.repeat(64) };
        equal(harness.sandbox.ooValidateConversionIdentityOwnership_({ inspections:[owner] }, request, canonical).error,
          'conversion-identity-conflict', `${archived ? 'archived' : 'live'} ${storedField} reserves ${incomingField}`);
      }
    }
  }
}

// Exercise the same live/archived 4x3 identity matrix through the locked
// dispatcher so every collision proves the exact pre-write side-effect budget.
{
  const storedFields = ['conversionId','pendingOrderId','linkedOrderId','conversionReceiptId'];
  const incomingFields = ['conversionId','pendingOrderId','receiptId'];
  for (const archived of [false, true]) {
    for (let storedIndex = 0; storedIndex < storedFields.length; storedIndex += 1) {
      for (let incomingIndex = 0; incomingIndex < incomingFields.length; incomingIndex += 1) {
        const builder = makeHarness();
        const owner = storedInspectionFor(builder, 'conversion-local-committed', {
          inspectionId:'inspection_identity_owner', officeId:'office_identity_owner',
          conversionId:'receipt_identity_conversion_owner', pendingOrderId:'receipt_identity_pending_owner',
          conversionReceiptId:'receipt_identity_owner',
          archivedAt:archived ? '2026-08-31T09:00:00+09:00' : null,
          archivedBy:archived ? 'representative' : null,
          archiveReason:archived ? '보관된 식별자' : null
        });
        const target = storedInspectionFor(builder, 'proposal', {
          inspectionId:'inspection_identity_target', officeId:'office_identity_target'
        });
        const store = { ...emptyStore(), inspections:[owner, target] };
        const harness = makeHarness({ store });
        harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
        const storedField = storedFields[storedIndex];
        const incomingField = incomingFields[incomingIndex];
        const overrides = {};
        overrides[incomingField] = owner[storedField];
        if (incomingField === 'pendingOrderId') overrides.receiptSubjectId = owner[storedField];
        const payload = conversionPayload(harness, target.inspectionId, 0, overrides);
        const label = `${archived ? 'archived' : 'live'} dispatcher ${storedField} reserves ${incomingField}`;
        const before = noWriteSnapshot(harness);
        assertFailure(harness.post('officeInspectionBeginConversion', payload, {
          mutationId:`mutation_identity_${archived ? 1 : 0}_${storedIndex}_${incomingIndex}`
        }), 'conversion-identity-conflict', label);
        assertNoWriteDelta(harness, before, label, 1, 1);
      }
    }
  }
}

// Record and finalize must re-check a newly supplied linked-order identity,
// even though their frozen conversion proof already belongs to the target.
for (const [action, status] of [
  ['officeInspectionRecordLocalCommit','conversion-writing'],
  ['officeInspectionFinalizeConversion','conversion-local-committed']
]) {
  const builder = makeHarness();
  const owner = storedInspectionFor(builder, 'conversion-local-committed', {
    inspectionId:`inspection_${action}_owner`, officeId:`office_${action}_owner`,
    conversionId:`conversion_${action}_owner`, pendingOrderId:`pending_${action}_owner`,
    conversionReceiptId:`receipt_${action}_owner`
  });
  const target = storedInspectionFor(builder, status, {
    inspectionId:`inspection_${action}_target`, officeId:`office_${action}_target`,
    conversionId:`conversion_${action}_target`, pendingOrderId:`pending_${action}_target`,
    conversionReceiptId:`receipt_${action}_target`
  });
  const store = { ...emptyStore(), inspections:[owner, target] };
  const harness = makeHarness({ store });
  harness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const payload = conversionPayload(harness, target.inspectionId, 0, {
    conversionId:target.conversionId, pendingOrderId:target.pendingOrderId,
    receiptId:target.conversionReceiptId, receiptSubjectId:target.pendingOrderId,
    linkedOrderId:owner.conversionId
  });
  delete payload.commercialTerms;
  delete payload.commercialApproval;
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post(action, payload, {
    mutationId:`mutation_${action}_identity_conflict`
  }), 'conversion-identity-conflict', action + ' revalidates linked identity ownership');
  assertNoWriteDelta(harness, before, action + ' linked identity conflict', 1, 1);
}

// Participation equality/skew/unverified paths fail before backup.
for (const [label, options, rowOverrides, requestOverrides] of [
  ['unverified source', {}, { verifiedBy:'외부' }, {}],
  ['deadline equality', { clockValues:[REQUEST_NOW_MS, Date.parse('2026-09-30T10:00:00+09:00')] }, { deadlineAt:'2026-09-30T10:00:00+09:00' }, {}],
  ['request equality', { clockValues:[REQUEST_NOW_MS, Date.parse('2026-09-30T09:59:59+09:00')] }, { deadlineAt:'2026-08-31T10:00:00+09:00' }, {}],
  ['request server skew', { clockValues:[REQUEST_NOW_MS, REQUEST_NOW_MS + 6 * 60 * 1000] }, {}, {}]
]) {
  const store = { ...emptyStore(), opportunities:[storedOpportunity(rowOverrides)] };
  const harness = makeHarness({ ...options, store });
  const payload = opportunityUpdatePayload('opp_lifecycle_001', 0, { stage:'participate', ...rowOverrides });
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeOpportunityUpdate', payload, {
    mutationId:`mutation_participate_${label.replace(/\s/g,'_')}`, ...requestOverrides
  }), 'invalid-opportunity', label);
  assertNoWriteDelta(harness, before, label, 2, 1);
}

{
  const store = { ...emptyStore(), opportunities:[storedOpportunity()] };
  const harness = makeHarness({ store });
  const payload = opportunityUpdatePayload('opp_lifecycle_001', 0, {
    stage:'participate', officialUrl:'https://example.com/not-kapt'
  });
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeOpportunityUpdate', payload, {
    mutationId:'mutation_nonofficial_kapt_url_001'
  }), 'invalid-opportunity', 'nonofficial K-apt URL cannot enter participation');
  assertNoWriteDelta(harness, before, 'nonofficial K-apt URL', 1, 1);
}

// A full replacement that remains in participation must revalidate the
// replacement row; prior participation never grants a permanent bypass.
for (const [label, options, rowOverrides] of [
  ['participate replacement empty requirements', {}, { requirements:[] }],
  ['participate replacement unverified source', {}, { verifiedBy:'외부' }],
  ['participate replacement deadline equality', {
    clockValues:[REQUEST_NOW_MS, Date.parse('2026-09-30T10:00:00+09:00')]
  }, { deadlineAt:'2026-09-30T10:00:00+09:00' }],
  ['participate replacement past deadline', {}, { deadlineAt:'2026-08-31T09:59:59+09:00' }],
  ['participate replacement request server skew', {
    clockValues:[REQUEST_NOW_MS, REQUEST_NOW_MS + 6 * 60 * 1000]
  }, {}],
  ['participate replacement millisecond skew boundary', {
    clockValues:[REQUEST_NOW_MS, REQUEST_NOW_MS + 5 * 60 * 1000 + 1]
  }, {}]
]) {
  const store = { ...emptyStore(), opportunities:[storedOpportunity({ stage:'participate' })] };
  const harness = makeHarness({ ...options, store });
  let participationCalls = 0;
  const originalParticipate = harness.sandbox.ooCanOpportunityParticipate_;
  harness.sandbox.ooCanOpportunityParticipate_ = function(...args) {
    participationCalls += 1;
    return originalParticipate(...args);
  };
  const payload = opportunityUpdatePayload('opp_lifecycle_001', 0, { stage:'participate', ...rowOverrides });
  const before = noWriteSnapshot(harness);
  assertFailure(harness.post('officeOpportunityUpdate', payload, {
    mutationId:`mutation_revalidate_${label.replace(/\s/g,'_')}`
  }), 'invalid-opportunity', label);
  equal(participationCalls, 1, label + ' calls participation guard once');
  assertNoWriteDelta(harness, before, label, 2, 1);
}

// Generic Task 3 rollback must remain action-independent for all exact 18 Task 4 routes.
function rollbackCases() {
  const builder = makeHarness();
  const pending = storedInspectionFor(builder, 'conversion-pending');
  const writing = storedInspectionFor(builder, 'conversion-writing');
  const committed = storedInspectionFor(builder, 'conversion-local-committed');
  const archivedPilot = storedPilot('pilot_restore_001', '2026-08-31T10:00:00+09:00', { archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관', restoredAt:null });
  const archivedInspection = storedInspectionFor(builder, 'checked', { inspectionId:'inspection_restore_001', archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관' });
  const archivedOpportunity = storedOpportunity({ opportunityId:'opp_restore_001', archivedAt:'2026-08-31T09:00:00+09:00', archivedBy:'representative', archiveReason:'보관' });
  return [
    ['officePilotUpdate', { ...emptyStore(), pilots:[storedPilot()] }, pilotUpdatePayload('pilot_seed_1', 0)],
    ['officePilotArchive', { ...emptyStore(), pilots:[storedPilot()] }, { pilotId:'pilot_seed_1', expectedRevision:0, archiveReason:'종료' }],
    ['officePilotRestore', { ...emptyStore(), pilots:[archivedPilot] }, { pilotId:'pilot_restore_001', expectedRevision:0 }],
    ['officeConsentRecord', emptyStore(), consentRecordPayload()],
    ['officeConsentWithdraw', { ...emptyStore(), consents:[storedConsent()] }, { consentId:'consent_lifecycle_001', expectedRevision:0, withdrawnBy:'대표', withdrawalReason:'철회' }],
    ['officeInspectionCreate', emptyStore(), inspectionCreatePayload(builder)],
    ['officeInspectionUpdate', { ...emptyStore(), inspections:[storedInspectionFor(builder)] }, inspectionUpdatePayload('inspection_lifecycle_001', 0)],
    ['officeInspectionArchive', { ...emptyStore(), inspections:[storedInspectionFor(builder, 'checked')] }, { inspectionId:'inspection_lifecycle_001', expectedRevision:0, archiveReason:'종료' }],
    ['officeInspectionRestore', { ...emptyStore(), inspections:[archivedInspection] }, { inspectionId:'inspection_restore_001', expectedRevision:0 }],
    ['officeInspectionBeginConversion', { ...emptyStore(), inspections:[storedInspectionFor(builder)] }, conversionPayload(builder, 'inspection_lifecycle_001', 0)],
    ['officeInspectionArmLocalCommit', { ...emptyStore(), inspections:[pending] }, (() => { const p=conversionPayload(builder,'inspection_lifecycle_001',0); delete p.commercialTerms; delete p.commercialApproval; return p; })()],
    ['officeInspectionRecordLocalCommit', { ...emptyStore(), inspections:[writing] }, (() => { const p=conversionPayload(builder,'inspection_lifecycle_001',0,{linkedOrderId:'pending_lifecycle_001'}); delete p.commercialTerms; delete p.commercialApproval; return p; })()],
    ['officeInspectionFinalizeConversion', { ...emptyStore(), inspections:[committed] }, (() => { const p=conversionPayload(builder,'inspection_lifecycle_001',0,{linkedOrderId:'pending_lifecycle_001'}); delete p.commercialTerms; delete p.commercialApproval; return p; })()],
    ['officeInspectionCancelConversion', { ...emptyStore(), inspections:[pending] }, { inspectionId:'inspection_lifecycle_001', conversionId:'conversion_lifecycle_001', expectedRevision:0 }],
    ['officeOpportunityCreate', emptyStore(), opportunityPayload()],
    ['officeOpportunityUpdate', { ...emptyStore(), opportunities:[storedOpportunity()] }, opportunityUpdatePayload('opp_lifecycle_001', 0)],
    ['officeOpportunityArchive', { ...emptyStore(), opportunities:[storedOpportunity()] }, { opportunityId:'opp_lifecycle_001', expectedRevision:0, archiveReason:'종료' }],
    ['officeOpportunityRestore', { ...emptyStore(), opportunities:[archivedOpportunity] }, { opportunityId:'opp_restore_001', expectedRevision:0 }]
  ];
}

const task4RollbackCases = rollbackCases();
equal(task4RollbackCases.length, 18, 'rollback matrix covers exact 18 routes');
for (let index = 0; index < task4RollbackCases.length; index += 1) {
  const [action, store, payload] = task4RollbackCases[index];
  const invalidHarness = makeHarness({ store });
  invalidHarness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const invalidBefore = noWriteSnapshot(invalidHarness);
  assertFailure(invalidHarness.post(action, { ...payload, surprise:true }, { mutationId:`mutation_invalid_${String(index).padStart(16,'0')}` }), 'unknown-field', action + ' prepare failure');
  assertNoWriteDelta(invalidHarness, invalidBefore, action + ' prepare failure', 1, 1);

  const writeHarness = makeHarness({ store, hooks:{ afterSetContent({call,data}) { if (call === 1) data.bytes = Buffer.concat([data.bytes,Buffer.from(' ')]); } } });
  writeHarness.sandbox.ooConversionOperationallyEnabled_ = function() { return true; };
  const sourceBefore = Buffer.from(writeHarness.state.files.get(SOURCE_ID).bytes);
  assertFailure(writeHarness.post(action, payload, { mutationId:`mutation_rollback_${String(index).padStart(16,'0')}` }), 'write-verify-failed', action + ' write rollback');
  equal(writeHarness.state.sourceWrites, 2, action + ' writes candidate then exact restore');
  deepEqual(writeHarness.state.files.get(SOURCE_ID).bytes, sourceBefore, action + ' restores exact source');
  equal(writeHarness.state.properties.OFFICE_OPS_RECOVERY_REQUIRED, '0', action + ' clears latch after verified restore');
}

console.log(`office ops server tests: PASS (${assertions} assertions)`);

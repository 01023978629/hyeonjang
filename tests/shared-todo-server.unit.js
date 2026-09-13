'use strict';
// Real doPost + new module in a VM; all Drive/lock services are memory-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const TOKEN = 'TEST-ONLY-SHARED-TODO-TOKEN';
const FOLDER = '_현장_공유할일';
const FILE = '현장_공유할일_v1.json';
const BACKUP_FOLDER = '_공유할일_백업';
let code = fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8');
let moduleSource = fs.readFileSync(path.join(ROOT, 'apps-script/SharedTodo.gs'), 'utf8');
const mutation = process.env.SHARED_TODO_MUTATION || '';
function replaceExact(source, before, after) { assert(source.includes(before), 'mutation anchor missing'); return source.replace(before, after); }
if (mutation === 'revision') moduleSource = replaceExact(moduleSource, 'payload.expectedRevision !== current.revision', 'false');
if (mutation === 'receipt') moduleSource = replaceExact(moduleSource, 'receipt.deviceId === deviceId && receipt.fingerprint === fingerprint', 'true');
if (mutation === 'tombstone') moduleSource = replaceExact(moduleSource, 'current.deleted || payload.expectedRevision', 'false || payload.expectedRevision');
if (mutation === 'write') moduleSource = replaceExact(moduleSource, 'if (applied.changed) sharedTodoWrite_(loaded, store);', 'if (false) sharedTodoWrite_(loaded, store);');
if (mutation === 'lock') moduleSource = replaceExact(moduleSource, 'if (!lock.tryLock(20000))', 'if (false)');
if (mutation === 'auth') {
  code = replaceExact(code, "var tk = checkToken_(req.token);", "var tk = ''; // MUTATION");
  moduleSource = replaceExact(moduleSource, 'var auth = checkToken_(req && req.token);', "var auth = ''; // MUTATION");
  moduleSource = replaceExact(moduleSource, 'auth = checkToken_(req.token);', "auth = ''; // MUTATION");
}
function iter(items) { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; }
function harness({ omitModule = false, sourceTransform = source => source } = {}) {
  const stats = { reads: 0, writes: 0, folders: 0, files: 0, backupWrites: 0, backupFolders: 0, lockCalls: 0, releases: 0 };
  const props = { APP_TOKEN: TOKEN, DRIVE_FOLDER_ID: 'TEST-ROOT', DATA_FILE_NAME: 'TEST-LEGACY.json' };
  let locked = false, busy = false, fault = '', rootBroken = false, onLock = null, nextId = 1;
  const cursors = new Map();
  function fileIterator(items, start = 0) {
    let index = start;
    return { hasNext: () => index < items.length, next: () => items[index++], getContinuationToken() { const token = 'TEST-CURSOR-' + nextId++; cursors.set(token, { items, index }); return token; } };
  }
  function checkLock() { assert(locked, 'shared storage accessed outside ScriptLock'); }
  class File {
    constructor(parent, name, content) { this.parent = parent; this.name = name; this.content = content; this.description = ''; }
    gate() { if (this.parent.name === FOLDER || this.parent.name === BACKUP_FOLDER) checkLock(); }
    getBlob() { this.gate(); stats.reads++; return { getDataAsString: () => this.content }; }
    setContent(content) {
      this.gate();
      assert.notEqual(this.parent.name, BACKUP_FOLDER, 'backups must be immutable');
      if (fault === 'silent') { fault = ''; return this; }
      if (fault === 'before') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR before write'); }
      if (fault === 'partial') { fault = ''; this.content = content.slice(0, 20); stats.writes++; throw new Error('TEST-SECRET-DRIVE-ERROR damaged content'); }
      this.content = content; stats.writes++;
      if (fault === 'after') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR after commit'); }
      return this;
    }
    getDescription() { return this.description; }
    setDescription(value) { this.description = value; return this; }
    getLastUpdated() { return new Date('2026-09-13T00:00:00.000Z'); }
    getName() { return this.name; }
    getParents() { this.gate(); return iter([this.parent]); }
  }
  class Folder {
    constructor(name) { this.name = name; this.children = []; this.files = []; this.id = 'TEST-FOLDER-' + nextId++; }
    getId() { return this.id; }
    getFoldersByName(name) { if (name === FOLDER) checkLock(); return iter(this.children.filter(x => x.name === name)); }
    createFolder(name) { checkLock(); if (name === BACKUP_FOLDER) stats.backupFolders++; else stats.folders++; const child = new Folder(name); this.children.push(child); return child; }
    getFilesByName(name) { if (this.name === FOLDER) checkLock(); return iter(this.files.filter(x => x.name === name)); }
    getFiles() { checkLock(); return fileIterator(this.files.slice()); }
    createFile(name, content) {
      if (this.name === FOLDER || this.name === BACKUP_FOLDER) checkLock();
      if (this.name === BACKUP_FOLDER) {
        if (fault === 'backup-before') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR backup before'); }
        const file = new File(this, name, fault === 'backup-partial' ? content.slice(0, 20) : fault === 'backup-silent' ? '{}' : content);
        if (fault === 'backup-validwrong') { const wrong = JSON.parse(content); wrong.deviceId = 'TEST-WRONG-WRITER'; file.content = JSON.stringify(wrong); fault = ''; }
        this.files.push(file); stats.backupWrites++;
        if (fault === 'backup-after') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR backup after'); }
        if (fault === 'backup-partial' || fault === 'backup-silent') fault = '';
        return file;
      }
      if (fault === 'before') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR before create'); }
      const file = new File(this, name, content); this.files.push(file); stats.files++; stats.writes++;
      if (fault === 'after') { fault = ''; throw new Error('TEST-SECRET-DRIVE-ERROR after create'); }
      return file;
    }
  }
  const root = new Folder('TEST-ROOT');
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] ?? null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ tryLock(ms) { assert.equal(ms, 20000); stats.lockCalls++; if (busy || locked) return false; locked = true; if (onLock) onLock(); return true; }, releaseLock() { assert(locked); locked = false; stats.releases++; } }) },
    DriveApp: { getFolderById(id) { assert.equal(id, 'TEST-ROOT'); if (rootBroken) throw new Error('TEST-SECRET-DRIVE-ERROR root'); return root; }, continueFileIterator(token) { const saved = cursors.get(token); if (!saved) throw new Error('TEST-SECRET-DRIVE-ERROR expired'); return fileIterator(saved.items, saved.index); } },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest(algorithm, input, charset) { return [...crypto.createHash(algorithm).update(input, charset).digest()].map(v => v > 127 ? v - 256 : v); } },
    oiIsPublicAction_: () => false, oiIsInternalAction_: () => false,
  });
  vm.runInContext(code + (omitModule ? '' : '\n' + sourceTransform(moduleSource)), context, { filename: 'shared-todo-test.gs' });
  function request(action, payload = {}, deviceId = 'TEST-DEVICE-A', changes = {}) {
    const req = { action, token: TOKEN, ts: Date.now(), deviceId, payload, ...changes };
    return JSON.parse(context.doPost({ postData: { contents: JSON.stringify(req) } }).text);
  }
  function storedFile() { return root.children.find(x => x.name === FOLDER)?.files.find(x => x.name === FILE); }
  return { context, root, stats, props, request, storedFile,
    backupFolder: () => root.children.find(x => x.name === FOLDER)?.children.find(x => x.name === BACKUP_FOLDER),
    backups: () => root.children.find(x => x.name === FOLDER)?.children.find(x => x.name === BACKUP_FOLDER)?.files || [],
    stored: () => JSON.parse(storedFile().content),
    inject(content) { let folder = root.children.find(x => x.name === FOLDER); if (!folder) { folder = new Folder(FOLDER); root.children.push(folder); } let file = storedFile(); if (!file) { file = new File(folder, FILE, ''); folder.files.push(file); } file.content = typeof content === 'string' ? content : JSON.stringify(content); },
    duplicateFolder() { root.children.push(new Folder(FOLDER)); },
    duplicateFile() { const folder = root.children.find(x => x.name === FOLDER); folder.files.push(new File(folder, FILE, '{}')); },
    setBusy(value) { busy = value; }, setFault(value) { fault = value; }, setRootBroken(value) { rootBroken = value; },
    setLockHook(value) { onLock = value; },
    assertUnlocked() { assert.equal(locked, false); },
  };
}
function id(n) { return '00000000-0000-4000-a000-' + String(n).padStart(12, '0'); }
function save(n, requestNo, revision = 0, changes = {}) { return { requestId: id(requestNo), expectedRevision: revision, task: { id: id(n), project: '가상 아파트 101동', text: '가상 배관 상태 확인', done: false, ...changes } }; }
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function expectError(result, error) { assert.equal(result.ok, false); assert.equal(result.error, error); assert(!JSON.stringify(result).includes('TEST-SECRET-DRIVE-ERROR')); }

module.exports = { harness, id, save, expectError };
if (require.main === module) {
test('authenticated health/list are read-only and empty storage is valid', () => {
  const h = harness();
  assert.deepEqual(h.request('sharedTodoHealth'), { ok: true, version: 'shared-todo-v1' });
  assert.deepEqual(h.request('sharedTodoList'), { ok: true, version: 'shared-todo-v1', storeRevision: 0, tasks: [] });
  assert.equal(h.stats.writes + h.stats.files + h.stats.folders, 0); h.assertUnlocked();
});
test('authentication guards all new actions before accessing storage', () => {
  const h = harness();
  for (const action of ['sharedTodoHealth', 'sharedTodoList', 'sharedTodoSave', 'sharedTodoDelete']) {
    expectError(h.request(action, save(1, 101), 'TEST-DEVICE-A', { token: 'TEST-WRONG' }), 'unauthorized');
    expectError(h.request(action, save(1, 101), 'TEST-DEVICE-A', { token: '' }), 'unauthorized');
  }
  assert.equal(h.stats.lockCalls + h.stats.reads + h.stats.writes, 0);
  delete h.props.APP_TOKEN; expectError(h.request('sharedTodoHealth'), 'not-configured');
});
test('timestamps and unknown actions fail without new storage writes', () => {
  const h = harness();
  expectError(h.request('sharedTodoSave', save(1, 101), 'TEST-DEVICE-A', { ts: Date.now() - 700000 }), 'bad-request');
  expectError(h.request('sharedTodoAdmin', {}), 'bad-request');
  assert.equal(h.stats.writes, 0);
});
test('create and second-device list share exact server values in one file', () => {
  const h = harness(); const result = h.request('sharedTodoSave', save(1, 101));
  assert.equal(result.ok, true); assert.equal(result.storeRevision, 1); assert.equal(result.task.revision, 1);
  assert.equal(result.task.createdAt, result.task.updatedAt); assert.equal(result.task.updatedBy, 'TEST-DEVICE-A');
  assert.deepEqual(h.request('sharedTodoList', {}, 'TEST-DEVICE-B').tasks, [result.task]);
  assert.equal(h.stats.writes, 1); assert.equal(h.stats.files, 1); assert.equal(h.stats.folders, 1);
  assert.deepEqual(h.root.files, []); assert.equal(h.stored().receipts.length, 1); h.assertUnlocked();
});
test('different task writes from two clients are not whole-store conflicts', () => {
  const h = harness();
  assert(h.request('sharedTodoSave', save(1, 101)).ok);
  assert(h.request('sharedTodoSave', save(2, 102), 'TEST-DEVICE-B').ok);
  assert.equal(h.request('sharedTodoList').tasks.length, 2); assert.equal(h.stored().revision, 2);
});
test('stale same-task update returns current without overwriting', () => {
  const h = harness(); h.request('sharedTodoSave', save(1, 101));
  const update = h.request('sharedTodoSave', save(1, 102, 1, { done: true, text: '가상 확인 완료' }), 'TEST-DEVICE-B');
  assert(update.ok); assert.equal(update.task.revision, 2);
  const before = h.storedFile().content;
  const conflict = h.request('sharedTodoSave', save(1, 103, 1, { text: '늦게 수정' }));
  expectError(conflict, 'conflict'); assert.deepEqual(conflict.current, update.task);
  assert.equal(h.storedFile().content, before);
});
test('retry replays exact receipt even after later edits and ignores transport timestamp', () => {
  const h = harness(); const payload = save(1, 101); const original = h.request('sharedTodoSave', payload);
  h.request('sharedTodoSave', save(1, 102, 1, { done: true }), 'TEST-DEVICE-B');
  const before = h.storedFile().content;
  assert.deepEqual(h.request('sharedTodoSave', payload, 'TEST-DEVICE-A', { ts: Date.now() - 1000 }), original);
  assert.equal(h.storedFile().content, before);
});
test('requestId reuse for another payload or device is rejected', () => {
  const h = harness(); h.request('sharedTodoSave', save(1, 101));
  const before = h.storedFile().content;
  expectError(h.request('sharedTodoSave', save(1, 101, 0, { text: '다른 글' })), 'request-conflict');
  expectError(h.request('sharedTodoSave', save(1, 101), 'TEST-DEVICE-B'), 'request-conflict');
  expectError(h.request('sharedTodoDelete', { requestId: id(101), id: id(1), expectedRevision: 1 }), 'request-conflict');
  assert.equal(h.storedFile().content, before);
});
test('delete creates tombstone, list hides it, retries cannot recreate it', () => {
  const h = harness(); const original = save(1, 101); h.request('sharedTodoSave', original);
  const delPayload = { requestId: id(102), id: id(1), expectedRevision: 1 };
  const deleted = h.request('sharedTodoDelete', delPayload, 'TEST-DEVICE-B');
  assert(deleted.ok); assert.equal(deleted.task.deleted, true); assert.equal(deleted.task.revision, 2);
  assert.deepEqual(h.request('sharedTodoList').tasks, []); assert.equal(h.stored().tasks.length, 1);
  assert.deepEqual(h.request('sharedTodoDelete', delPayload, 'TEST-DEVICE-B'), deleted);
  for (const revision of [0, 1, 2]) expectError(h.request('sharedTodoSave', save(1, 110 + revision, revision)), 'conflict');
  expectError(h.request('sharedTodoDelete', { ...delPayload, requestId: id(120), expectedRevision: 2 }), 'conflict');
  assert.deepEqual(h.request('sharedTodoSave', original).task.id, id(1));
  assert.deepEqual(h.request('sharedTodoList').tasks, []);
});
test('missing task edits/deletes and invalid expected revisions cannot create records', () => {
  const h = harness(); expectError(h.request('sharedTodoSave', save(1, 101, 1)), 'conflict');
  expectError(h.request('sharedTodoDelete', { requestId: id(102), id: id(1), expectedRevision: 1 }), 'conflict');
  for (const value of [-1, 1.5, '0', null, 9007199254740992]) expectError(h.request('sharedTodoSave', { ...save(1, 103), expectedRevision: value }), 'bad-request');
  assert.equal(h.stats.writes, 0); assert.equal(h.stats.folders, 0);
});
test('strict input keys and field lengths block caller-controlled storage paths', () => {
  const h = harness(); const valid = save(1, 101);
  for (const payload of [{ ...valid, folderId: 'TEST-OTHER' }, { ...valid, task: { ...valid.task, deleted: true } }, { ...valid, requestId: '__proto__' }, { ...valid, requestId: '00000000-0000-0000-0000-000000000000' }, { ...valid, task: { ...valid.task, id: 'x' } }]) expectError(h.request('sharedTodoSave', payload), 'bad-request');
  for (const [key, value] of [['project', ''], ['project', ' '.repeat(3)], ['project', '가'.repeat(161)], ['text', ''], ['text', '가'.repeat(501)], ['text', 'bad\u0000text'], ['done', 1]]) expectError(h.request('sharedTodoSave', { ...valid, task: { ...valid.task, [key]: value } }), 'bad-request');
  expectError(h.request('sharedTodoList', { project: 'x' }), 'bad-request');
  expectError(h.request('sharedTodoHealth', {}, '한글-기기'), 'bad-request');
  expectError(h.request('sharedTodoList', {}, 'TEST-DEVICE-A', { fileId: 'TEST-OTHER' }), 'bad-request');
  assert.equal(h.stats.writes, 0);
  assert(h.request('sharedTodoSave', save(2, 102, 0, { project: '가'.repeat(160), text: '나'.repeat(500) })).ok);
});
test('busy lock fails closed and no release of someone else lock', () => {
  const h = harness(); h.setBusy(true);
  expectError(h.request('sharedTodoSave', save(1, 101)), 'busy');
  expectError(h.request('sharedTodoList'), 'busy');
  assert.equal(h.stats.reads + h.stats.writes + h.stats.releases, 0); h.assertUnlocked();
});
test('token revoked during lock wait is rejected before reading or writing', () => {
  const h = harness(); h.setLockHook(() => { h.props.APP_TOKEN = 'TEST-ROTATED-TOKEN'; });
  expectError(h.request('sharedTodoSave', save(1, 101)), 'unauthorized');
  assert.equal(h.stats.reads + h.stats.writes + h.stats.files + h.stats.folders, 0);
  assert.equal(h.stats.releases, 1); h.assertUnlocked();
});
test('write failure before commit returns sanitized error and retry writes once', () => {
  const h = harness(); h.request('sharedTodoSave', save(1, 101)); const before = h.storedFile().content;
  const payload = save(1, 102, 1, { done: true }); h.setFault('before');
  expectError(h.request('sharedTodoSave', payload), 'server-error'); assert.equal(h.storedFile().content, before);
  assert(h.request('sharedTodoSave', payload).ok); assert.equal(h.stored().revision, 2); h.assertUnlocked();
});
test('lost acknowledgment after create/update/delete recovers exact stored success', () => {
  const h = harness(); const create = save(1, 101); h.setFault('after');
  expectError(h.request('sharedTodoSave', create), 'server-error');
  const createAck = h.stored().receipts[0].result;
  assert.deepEqual(h.request('sharedTodoSave', create), createAck); assert.equal(h.stats.writes, 1);
  const update = save(1, 102, 1, { done: true }); h.setFault('after');
  expectError(h.request('sharedTodoSave', update), 'server-error');
  assert.deepEqual(h.request('sharedTodoSave', update), h.stored().receipts[1].result); assert.equal(h.stats.writes, 2);
  const del = { requestId: id(103), id: id(1), expectedRevision: 2 }; h.setFault('after');
  expectError(h.request('sharedTodoDelete', del), 'server-error');
  assert.deepEqual(h.request('sharedTodoDelete', del), h.stored().receipts[2].result); assert.equal(h.stats.writes, 3);
});
test('storage corruption during a failed write is not reset by a retry', () => {
  const h = harness(); h.request('sharedTodoSave', save(1, 101)); const payload = save(1, 102, 1, { done: true });
  h.setFault('partial'); expectError(h.request('sharedTodoSave', payload), 'server-error');
  const damaged = h.storedFile().content, writes = h.stats.writes;
  expectError(h.request('sharedTodoSave', payload), 'store-corrupt');
  expectError(h.request('sharedTodoList'), 'store-corrupt');
  assert.equal(h.storedFile().content, damaged); assert.equal(h.stats.writes, writes); h.assertUnlocked();
});
test('ambiguous folder or file stops health/list/save with no mutation', () => {
  for (const method of ['duplicateFolder', 'duplicateFile']) {
    const h = harness(); h.request('sharedTodoSave', save(1, 101)); h[method]();
    const before = h.storedFile().content, writes = h.stats.writes;
    for (const action of ['sharedTodoHealth', 'sharedTodoList', 'sharedTodoSave']) expectError(h.request(action, action === 'sharedTodoSave' ? save(2, 102) : {}), 'store-ambiguous');
    assert.equal(h.storedFile().content, before); assert.equal(h.stats.writes, writes); h.assertUnlocked();
  }
});
test('invalid JSON/schema/duplicates/revisions/receipts are never repaired or overwritten', () => {
  const baseline = harness(); baseline.request('sharedTodoSave', save(1, 101)); const good = baseline.stored();
  const variants = ['{', '{}', { ...good, schema: 2 }, { ...good, extra: true }, { ...good, revision: 5 }, { ...good, tasks: [...good.tasks, good.tasks[0]] }, { ...good, tasks: [{ ...good.tasks[0], updatedAt: 'yesterday' }] }, { ...good, receipts: [...good.receipts, good.receipts[0]] }, { ...good, receipts: [] }, { ...good, receipts: [{ ...good.receipts[0], result: { ...good.receipts[0].result, storeRevision: 2 } }] }, { ...good, receipts: [{ ...good.receipts[0], result: { ...good.receipts[0].result, task: { ...good.tasks[0], text: '같은 revision인데 다른 내용' } } }] }];
  for (const invalid of variants) {
    const h = harness(); h.inject(invalid); const before = h.storedFile().content;
    expectError(h.request('sharedTodoList'), 'store-corrupt'); expectError(h.request('sharedTodoSave', save(2, 102)), 'store-corrupt');
    assert.equal(h.storedFile().content, before); assert.equal(h.stats.writes, 0); h.assertUnlocked();
  }
});
test('bounded receipts preserve tombstones and old retries remain conflict-safe', () => {
  const h = harness(); h.context.SHARED_TODO_MAX_RECEIPTS = 2;
  const first = save(1, 101); h.request('sharedTodoSave', first);
  h.request('sharedTodoDelete', { requestId: id(102), id: id(1), expectedRevision: 1 });
  h.request('sharedTodoSave', save(2, 103)); h.request('sharedTodoSave', save(3, 104));
  assert.equal(h.stored().receipts.length, 2); assert.equal(h.stored().tasks.length, 3); assert.equal(h.stored().tasks[0].deleted, true);
  expectError(h.request('sharedTodoSave', first), 'conflict'); assert.equal(h.stored().revision, 4);
});
test('capacity includes tombstones and never silently drops tasks', () => {
  const h = harness(); h.context.SHARED_TODO_MAX_TASKS = 2;
  h.request('sharedTodoSave', save(1, 101)); h.request('sharedTodoSave', save(2, 102));
  h.request('sharedTodoDelete', { requestId: id(103), id: id(1), expectedRevision: 1 });
  const before = h.storedFile().content; expectError(h.request('sharedTodoSave', save(3, 104)), 'store-full');
  assert.equal(h.storedFile().content, before); assert(h.request('sharedTodoSave', save(2, 105, 1, { done: true })).ok);
});
test('store byte budget errors preserve original content and root errors are sanitized', () => {
  const h = harness(); h.request('sharedTodoSave', save(1, 101)); const before = h.storedFile().content;
  h.context.SHARED_TODO_MAX_CHARS = before.length + 1;
  expectError(h.request('sharedTodoSave', save(2, 102)), 'store-full'); assert.equal(h.storedFile().content, before);
  h.context.SHARED_TODO_MAX_CHARS = before.length - 1;
  expectError(h.request('sharedTodoList'), 'store-too-large'); assert.equal(h.storedFile().content, before);
  h.setRootBroken(true); expectError(h.request('sharedTodoHealth'), 'server-error'); h.assertUnlocked();
});
test('missing module preserves legacy health/load/save and unknown capability response', () => {
  for (const omitModule of [true, false]) {
    const h = harness({ omitModule });
    const original = { app: '현장', version: 1, notes: [{ text: 'TEST-LEGACY-PRESERVED' }] };
    assert(h.request('save', { data: original, baseRevision: 0 }).ok);
    const before = h.root.files[0].content;
    if (omitModule) expectError(h.request('sharedTodoHealth'), 'bad-request');
    else assert(h.request('sharedTodoSave', save(1, 101)).ok);
    assert.equal(h.request('health').version, 'relay-v4');
    assert.deepEqual(h.request('load').data, original); assert.equal(h.root.files[0].content, before);
    expectError(h.request('save', { data: original, baseRevision: 0 }), 'conflict');
  }
});
console.log(`Shared todo server: ${count}/${count} passed (isolated mock Drive only).`);
if (process.argv.includes('--mutations')) {
  for (const name of ['auth', 'revision', 'receipt', 'tombstone', 'write', 'lock']) {
    const child = spawnSync(process.execPath, [__filename], { env: { ...process.env, SHARED_TODO_MUTATION: name }, encoding: 'utf8', timeout: 30000 });
    assert.equal(child.status, 1, 'mutation must fail assertions: ' + name);
    assert((child.stderr || '').includes('AssertionError'), 'mutation must fail an assertion, not setup: ' + name);
    console.log('MUTATION DETECTED ' + name);
  }
}
}

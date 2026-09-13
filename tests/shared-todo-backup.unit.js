'use strict';
// Actual Code.gs + SharedTodo.gs with isolated Drive/lock faults. No account writes.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { harness, id, save, expectError } = require('./shared-todo-server.unit.js');
const mutation = process.env.SHARED_BACKUP_MUTATION || '';
const replacements = {
  backup: ["sharedTodoBackup_(loaded, original, action === 'sharedTodoDelete' ? 'before-delete' : 'before-save', req, payload);", '// MUTATION no prewrite backup'],
  readback: ["if (file.getBlob().getDataAsString('UTF-8') !== content) throw new Error('backup-failed');", '// MUTATION no readback'],
  revision: ['if (payload.expectedStoreRevision !== original.revision)', 'if (false)'],
  safety: ["sharedTodoBackup_(loaded, original, 'before-restore', req, payload);", '// MUTATION no restore safety backup'],
  fresh_ids: ["id: sharedTodoRestoreUuid_(payload.requestId, 'task', task.id)", 'id: task.id'],
  replay: ['prior.deviceId === req.deviceId && prior.fingerprint === fingerprint', 'true'],
  writecheck: ["if (loaded.file.getBlob().getDataAsString('UTF-8') !== content) throw new Error('server-error');", '// MUTATION no primary readback'],
};
function h() {
  return harness({ sourceTransform(source) {
    if (!mutation) return source;
    const pair = replacements[mutation]; assert(pair && source.includes(pair[0]), 'mutation anchor missing');
    return source.replace(pair[0], pair[1]);
  } });
}
function snapshot(api, n = 800) {
  const result = api.request('sharedTodoBackupCreate', { requestId: id(n), expectedStoreRevision: api.request('sharedTodoList').storeRevision });
  assert(result.ok, JSON.stringify(result)); return result.backup;
}
function restore(api, backup, n = 900, revision = api.request('sharedTodoList').storeRevision) {
  const payload = { requestId: id(n), backupId: backup.id, expectedStoreRevision: revision };
  return { payload, result: api.request('sharedTodoRestore', payload) };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }

test('new actions enforce authentication, input and locking before touching Drive', () => {
  for (const action of ['sharedTodoBackupList', 'sharedTodoBackupCreate', 'sharedTodoRestore']) {
    const api = h();
    expectError(api.request(action, {}, 'TEST-DEVICE-A', { token: 'TEST-WRONG' }), 'unauthorized');
    assert.equal(api.stats.lockCalls + api.stats.reads + api.stats.writes + api.stats.backupWrites, 0);
  }
  const api = h();
  for (const payload of [{ requestId: id(800), expectedStoreRevision: '0' }, { requestId: id(800), expectedStoreRevision: 0, fileId: 'TEST-OTHER' }]) expectError(api.request('sharedTodoBackupCreate', payload), 'bad-request');
  expectError(api.request('sharedTodoRestore', { requestId: id(800), expectedStoreRevision: 0, backupId: '../TEST-OTHER.json' }), 'bad-request');
  api.setBusy(true); expectError(api.request('sharedTodoBackupList'), 'busy'); assert.equal(api.stats.reads, 0);
  api.setBusy(false); api.setLockHook(() => { api.props.APP_TOKEN = 'TEST-ROTATED'; });
  expectError(api.request('sharedTodoBackupCreate', { requestId: id(801), expectedStoreRevision: 0 }), 'unauthorized');
  assert.equal(api.stats.writes + api.stats.backupWrites, 0); api.assertUnlocked();
});

test('backup list is read-only on empty storage', () => {
  const api = h(), result = api.request('sharedTodoBackupList');
  assert.deepEqual(result, { ok: true, version: 'shared-todo-v1', storeRevision: 0, backups: [], nextCursor: null });
  assert.equal(api.stats.writes + api.stats.backupWrites + api.stats.folders + api.stats.backupFolders, 0);
});

test('every changed create/update/delete has exact full prewrite snapshot including receipts and tombstones', () => {
  const api = h();
  const initial = { schema: 1, revision: 0, tasks: [], receipts: [] };
  assert(api.request('sharedTodoSave', save(1, 101)).ok);
  assert.equal(api.backups().length, 1);
  assert.deepEqual(JSON.parse(api.backups()[0].content).store, initial);
  const before = api.stored(); assert(api.request('sharedTodoSave', save(1, 102, 1, { done: true })).ok);
  assert.deepEqual(JSON.parse(api.backups()[1].content).store, before);
  const beforeDelete = api.stored(); assert(api.request('sharedTodoDelete', { requestId: id(103), id: id(1), expectedRevision: 2 }).ok);
  assert.deepEqual(JSON.parse(api.backups()[2].content).store, beforeDelete);
  const deleted = api.stored(); assert(api.request('sharedTodoSave', save(2, 104)).ok);
  assert.deepEqual(JSON.parse(api.backups()[3].content).store, deleted);
  assert.equal(api.stats.backupWrites, api.stats.writes);
  const immutable = api.backups().map(file => file.content);
  api.request('sharedTodoSave', save(2, 104)); // exact receipt retry
  expectError(api.request('sharedTodoSave', save(1, 105)), 'conflict');
  assert.deepEqual(api.backups().map(file => file.content), immutable);
});

test('manual backups preserve primary state and exact retry result after another device changes it', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const before = api.storedFile().content;
  const payload = { requestId: id(800), expectedStoreRevision: 1 }, first = api.request('sharedTodoBackupCreate', payload);
  assert(first.ok); assert.equal(api.storedFile().content, before);
  api.request('sharedTodoSave', save(2, 102), 'TEST-DEVICE-B'); const count = api.backups().length;
  assert.deepEqual(api.request('sharedTodoBackupCreate', payload), first); assert.equal(api.backups().length, count);
  expectError(api.request('sharedTodoBackupCreate', payload, 'TEST-DEVICE-B'), 'request-conflict');
  expectError(api.request('sharedTodoBackupCreate', { requestId: id(801), expectedStoreRevision: 1 }), 'conflict');
});

test('backup failure, false creation and truncation block the primary write', () => {
  for (const fault of ['backup-before', 'backup-after', 'backup-partial', 'backup-silent', 'backup-validwrong']) {
    const api = h(); api.request('sharedTodoSave', save(1, 101)); const before = api.storedFile().content, writes = api.stats.writes;
    api.setFault(fault); expectError(api.request('sharedTodoSave', save(1, 102, 1, { done: true })), 'backup-failed');
    assert.equal(api.storedFile().content, before); assert.equal(api.stats.writes, writes); api.assertUnlocked();
  }
});

test('lost backup acknowledgment retries immutable snapshot without creating duplicate', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const payload = save(1, 102, 1, { done: true });
  api.setFault('backup-after'); expectError(api.request('sharedTodoSave', payload), 'backup-failed');
  const backupCount = api.backups().length, content = api.backups()[1].content;
  assert(api.request('sharedTodoSave', payload).ok); assert.equal(api.backups().length, backupCount); assert.equal(api.backups()[1].content, content);
});

test('corrupt existing backup and ambiguous folders fail without overwrite or deletion', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const payload = save(1, 102, 1, { done: true });
  api.setFault('backup-partial'); expectError(api.request('sharedTodoSave', payload), 'backup-failed');
  const before = api.storedFile().content, damaged = api.backups()[1].content;
  expectError(api.request('sharedTodoSave', payload), 'backup-corrupt'); assert.equal(api.storedFile().content, before); assert.equal(api.backups()[1].content, damaged);
  const parent = api.root.children[0]; parent.children.push(api.backupFolder());
  expectError(api.request('sharedTodoSave', save(2, 103)), 'backup-ambiguous'); assert.equal(api.storedFile().content, before);
});

test('silent primary write failure is never reported as successful and retry reuses the safety snapshot', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const payload = save(1, 102, 1, { done: true }), before = api.storedFile().content;
  api.setFault('silent'); expectError(api.request('sharedTodoSave', payload), 'server-error'); assert.equal(api.storedFile().content, before);
  const count = api.backups().length; assert(api.request('sharedTodoSave', payload).ok); assert.equal(api.backups().length, count);
});

test('restore replaces active list under fresh IDs while retaining all old tombstones and receipts', () => {
  const api = h(); const oldPayload = save(1, 101); const oldAck = api.request('sharedTodoSave', oldPayload), backup = snapshot(api);
  api.request('sharedTodoSave', save(1, 102, 1, { done: true, text: '가상 변경' }));
  api.request('sharedTodoSave', save(2, 103));
  const before = api.stored(), outcome = restore(api, backup); assert(outcome.result.ok, JSON.stringify(outcome.result));
  const now = api.stored(), listed = api.request('sharedTodoList').tasks;
  assert.equal(now.schema, 2); assert.equal(listed.length, 1); assert.notEqual(listed[0].id, id(1));
  assert.equal(listed[0].text, oldAck.task.text); assert.equal(listed[0].done, false);
  assert(now.tasks.filter(task => task.id === id(1) || task.id === id(2)).every(task => task.deleted));
  assert.deepEqual(now.receipts.slice(0, before.receipts.length), before.receipts);
  const safetyFile = api.backups().find(file => file.name === outcome.result.safetyBackupId); assert(safetyFile, 'restore must have a verified safety backup');
  assert.deepEqual(JSON.parse(safetyFile.content).store, before);
  assert.equal(outcome.result.storeRevision, before.revision + 2 + 1 + 1);
  assert.deepEqual(api.request('sharedTodoSave', oldPayload), oldAck); assert.equal(api.request('sharedTodoList').tasks.length, 1);
  for (const revision of [0, 1, 2, 3]) expectError(api.request('sharedTodoSave', save(1, 110 + revision, revision)), 'conflict');
  const final = api.storedFile().content; assert.deepEqual(api.request('sharedTodoRestore', outcome.payload), outcome.result); assert.equal(api.storedFile().content, final);
  expectError(api.request('sharedTodoRestore', outcome.payload, 'TEST-DEVICE-B'), 'request-conflict');
});

test('restore receipts survive later normal save/delete and can still replay exactly', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const outcome = restore(api, snapshot(api)); assert(outcome.result.ok);
  const restored = api.request('sharedTodoList').tasks[0];
  assert(api.request('sharedTodoSave', { requestId: id(120), expectedRevision: restored.revision, task: { id: restored.id, project: restored.project, text: '가상 후속 작업', done: true } }).ok);
  assert(api.request('sharedTodoDelete', { requestId: id(121), id: restored.id, expectedRevision: 2 }).ok);
  assert(api.context.sharedTodoStoreValid_(api.stored())); assert.deepEqual(api.request('sharedTodoRestore', outcome.payload), outcome.result);
  assert.deepEqual(api.request('sharedTodoList').tasks, []);
  expectError(api.request('sharedTodoSave', save(3, 900)), 'request-conflict');
});

test('restore races use the current locked revision and never create a safety backup on conflict', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const backup = snapshot(api), revision = api.stored().revision;
  api.request('sharedTodoSave', save(2, 102), 'TEST-DEVICE-B'); const before = api.storedFile().content, count = api.backups().length;
  expectError(restore(api, backup, 900, revision).result, 'conflict'); assert.equal(api.storedFile().content, before); assert.equal(api.backups().length, count);
});

test('restore cannot commit unless its safety backup is verified', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const backup = snapshot(api), before = api.storedFile().content;
  api.setFault('backup-before'); expectError(restore(api, backup).result, 'backup-failed'); assert.equal(api.storedFile().content, before);
});

test('restore lost commit acknowledgment replays exact success without applying twice', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const backup = snapshot(api); api.setFault('after');
  const outcome = restore(api, backup); expectError(outcome.result, 'server-error');
  const before = api.storedFile().content, receipt = api.stored().restores[0].result, count = api.backups().length;
  assert.deepEqual(api.request('sharedTodoRestore', outcome.payload), receipt); assert.equal(api.storedFile().content, before); assert.equal(api.backups().length, count);
});

test('empty restore increments store revision and its safety backup can recover the replaced list', () => {
  const api = h(), empty = snapshot(api); api.request('sharedTodoSave', save(1, 101));
  const outcome = restore(api, empty); assert(outcome.result.ok); assert.deepEqual(api.request('sharedTodoList').tasks, []);
  assert.equal(outcome.result.storeRevision, 3);
  const recovered = restore(api, { id: outcome.result.safetyBackupId }, 901); assert(recovered.result.ok); assert.equal(api.request('sharedTodoList').tasks.length, 1);
  const emptyApi = h(), emptyBackup = snapshot(emptyApi), blank = restore(emptyApi, emptyBackup); assert(blank.result.ok); assert.equal(blank.result.storeRevision, 1);
});

test('restore validates digest, backup scope, capacity and corrupt current state without mutation', () => {
  const api = h(); api.request('sharedTodoSave', save(1, 101)); const backup = snapshot(api), before = api.storedFile().content;
  api.context.SHARED_TODO_MAX_TASKS = 1; expectError(restore(api, backup).result, 'store-full'); api.context.SHARED_TODO_MAX_TASKS = 5000;
  const file = api.backups().find(file => file.name === backup.id), content = JSON.parse(file.content); content.store.tasks[0].text = '가상 오염'; file.content = JSON.stringify(content);
  expectError(restore(api, backup).result, 'backup-corrupt'); assert.equal(api.storedFile().content, before);
  expectError(restore(api, { id: 'r1_manual_' + id(999) + '.json' }).result, 'backup-not-found');
  api.inject('{'); expectError(api.request('sharedTodoRestore', { requestId: id(901), backupId: backup.id, expectedStoreRevision: 1 }), 'store-corrupt'); assert.equal(api.storedFile().content, '{');
});

test('bounded restoration receipts and normal receipts never discard tombstones', () => {
  const api = h(); api.context.SHARED_TODO_MAX_RESTORES = 2; api.context.SHARED_TODO_MAX_RECEIPTS = 2;
  api.request('sharedTodoSave', save(1, 101)); const backup = snapshot(api), first = restore(api, backup, 900); assert(first.result.ok);
  assert(restore(api, backup, 901).result.ok); assert(restore(api, backup, 902).result.ok);
  assert.equal(api.stored().restores.length, 2); assert.equal(api.stored().receipts.length, 2); assert.equal(api.stored().tasks.length, 4);
  expectError(api.request('sharedTodoRestore', first.payload), 'conflict'); assert.equal(api.request('sharedTodoList').tasks.length, 1);
});

test('backup listing paginates without deleting, and invalid cursors disclose no Drive errors', () => {
  const api = h(); api.context.SHARED_TODO_BACKUP_PAGE = 2;
  api.request('sharedTodoSave', save(1, 101)); snapshot(api, 800); snapshot(api, 801); snapshot(api, 802);
  const before = api.backups().map(file => file.content), first = api.request('sharedTodoBackupList');
  assert(first.ok); assert.equal(first.backups.length, 2); assert(first.nextCursor);
  const second = api.request('sharedTodoBackupList', { cursor: first.nextCursor }); assert(second.ok); assert.equal(second.backups.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.backups, ...second.backups].map(backup => backup.id)).size, 4);
  assert.deepEqual(api.backups().map(file => file.content), before);
  expectError(api.request('sharedTodoBackupList', { cursor: 'TEST-EXPIRED' }), 'backup-expired-cursor');
});

console.log(`Shared todo backups: ${count}/${count} passed (isolated Drive only).`);
if (process.argv.includes('--mutations')) {
  for (const name of Object.keys(replacements)) {
    const child = spawnSync(process.execPath, [__filename], { env: { ...process.env, SHARED_BACKUP_MUTATION: name }, encoding: 'utf8', timeout: 30000 });
    assert.equal(child.status, 1, 'mutation must fail assertions: ' + name);
    assert((child.stderr || '').includes('AssertionError'), 'mutation must fail assertion, not setup: ' + name);
    console.log('MUTATION DETECTED ' + name);
  }
}

/** Shared company todos. Authenticated doPost dispatch only; never a public action.
 * This module does not read/write the legacy DATA_FILE_NAME or any photos.
 * deviceId is an audit label, NOT an authenticated employee identity.
 */
var SHARED_TODO_VERSION = 'shared-todo-v1';
var SHARED_TODO_FOLDER = '_현장_공유할일';
var SHARED_TODO_FILE = '현장_공유할일_v1.json';
var SHARED_TODO_MAX_TASKS = 5000; // Includes tombstones: never evict/reuse task IDs.
var SHARED_TODO_MAX_RECEIPTS = 2048; // Exact retry responses for last 2048 successes.
var SHARED_TODO_MAX_CHARS = 6 * 1024 * 1024;

function sharedTodoIsAction_(action) {
  return ['sharedTodoHealth', 'sharedTodoList', 'sharedTodoSave', 'sharedTodoDelete'].indexOf(action) >= 0;
}
function sharedTodoFail_(code) { return { ok: false, error: code }; }
function sharedTodoObject_(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function sharedTodoKeys_(value, keys) {
  if (!sharedTodoObject_(value)) return false;
  return Object.keys(value).every(function (key) { return keys.indexOf(key) >= 0; });
}
function sharedTodoInt_(value, minimum) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= minimum && value <= 9007199254740991;
}
function sharedTodoUuid_(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
function sharedTodoDevice_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(value);
}
function sharedTodoText_(value, max) {
  return typeof value === 'string' && value.length <= max && value.trim().length > 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
}
function sharedTodoIso_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  var parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
function sharedTodoTaskValid_(task) {
  return sharedTodoKeys_(task, ['id', 'project', 'text', 'done', 'revision', 'createdAt', 'updatedAt', 'updatedBy', 'deleted']) &&
    sharedTodoUuid_(task.id) && sharedTodoText_(task.project, 160) && sharedTodoText_(task.text, 500) &&
    typeof task.done === 'boolean' && sharedTodoInt_(task.revision, 1) &&
    sharedTodoIso_(task.createdAt) && sharedTodoIso_(task.updatedAt) && task.createdAt <= task.updatedAt &&
    sharedTodoDevice_(task.updatedBy) && (task.deleted === undefined || task.deleted === true);
}
function sharedTodoClone_(value) { return JSON.parse(JSON.stringify(value)); }
function sharedTodoSameTask_(a, b) {
  return ['id', 'project', 'text', 'done', 'revision', 'createdAt', 'updatedAt', 'updatedBy', 'deleted'].every(function (key) { return a[key] === b[key]; });
}
function sharedTodoInput_(action, req) {
  if (!sharedTodoKeys_(req, ['action', 'token', 'ts', 'deviceId', 'payload']) || !sharedTodoDevice_(req.deviceId)) return null;
  var payload = req.payload;
  if (action === 'sharedTodoHealth' || action === 'sharedTodoList') {
    return payload === undefined || sharedTodoKeys_(payload, []) ? {} : null;
  }
  var save = action === 'sharedTodoSave';
  if (!sharedTodoKeys_(payload, save ? ['requestId', 'expectedRevision', 'task'] : ['requestId', 'expectedRevision', 'id']) ||
      !sharedTodoUuid_(payload.requestId) || !sharedTodoInt_(payload.expectedRevision, save ? 0 : 1)) return null;
  if (!save) return sharedTodoUuid_(payload.id) ? { requestId: payload.requestId, expectedRevision: payload.expectedRevision, id: payload.id } : null;
  var task = payload.task;
  if (!sharedTodoKeys_(task, ['id', 'project', 'text', 'done']) || !sharedTodoUuid_(task.id) ||
      !sharedTodoText_(task.project, 160) || !sharedTodoText_(task.text, 500) || typeof task.done !== 'boolean') return null;
  return { requestId: payload.requestId, expectedRevision: payload.expectedRevision,
    task: { id: task.id, project: task.project, text: task.text, done: task.done } };
}
function sharedTodoFingerprint_(action, deviceId, payload) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([action, deviceId, payload]), Utilities.Charset.UTF_8);
  return bytes.map(function (value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
}
function sharedTodoStoreValid_(store) {
  if (!sharedTodoKeys_(store, ['schema', 'revision', 'tasks', 'receipts']) || store.schema !== 1 ||
      !sharedTodoInt_(store.revision, 0) || !Array.isArray(store.tasks) || !Array.isArray(store.receipts) ||
      store.tasks.length > SHARED_TODO_MAX_TASKS || store.receipts.length > SHARED_TODO_MAX_RECEIPTS) return false;
  var tasks = Object.create(null), requests = Object.create(null), sum = 0, lastReceiptRevision = 0;
  for (var i = 0; i < store.tasks.length; i++) {
    var task = store.tasks[i];
    if (!sharedTodoTaskValid_(task) || tasks[task.id]) return false;
    tasks[task.id] = task; sum += task.revision;
  }
  // Every successful mutation increments exactly one retained task and the store.
  if (!sharedTodoInt_(sum, 0) || sum !== store.revision) return false;
  for (var j = 0; j < store.receipts.length; j++) {
    var receipt = store.receipts[j], result = receipt && receipt.result;
    if (!sharedTodoKeys_(receipt, ['requestId', 'deviceId', 'fingerprint', 'result']) ||
        !sharedTodoUuid_(receipt.requestId) || requests[receipt.requestId] || !sharedTodoDevice_(receipt.deviceId) ||
        typeof receipt.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.fingerprint) ||
        !sharedTodoKeys_(result, ['ok', 'version', 'storeRevision', 'task']) || result.ok !== true ||
        result.version !== SHARED_TODO_VERSION || !sharedTodoInt_(result.storeRevision, 1) ||
        result.storeRevision <= lastReceiptRevision || result.storeRevision > store.revision ||
        !sharedTodoTaskValid_(result.task) || !tasks[result.task.id] ||
        result.task.revision > tasks[result.task.id].revision || result.task.updatedBy !== receipt.deviceId ||
        result.task.createdAt !== tasks[result.task.id].createdAt || result.task.updatedAt > tasks[result.task.id].updatedAt ||
        (result.task.deleted && !tasks[result.task.id].deleted) ||
        (result.task.revision === tasks[result.task.id].revision && !sharedTodoSameTask_(result.task, tasks[result.task.id]))) return false;
    requests[receipt.requestId] = true; lastReceiptRevision = result.storeRevision;
  }
  if (store.receipts.length !== Math.min(store.revision, SHARED_TODO_MAX_RECEIPTS) ||
      (store.revision > 0 && lastReceiptRevision !== store.revision)) return false;
  return true;
}
// Missing storage is a valid empty store; reading never creates folders or files.
function sharedTodoRead_() {
  var root = rootFolder_(), folders = root.getFoldersByName(SHARED_TODO_FOLDER), folder = null, file = null;
  if (folders.hasNext()) { folder = folders.next(); if (folders.hasNext()) throw new Error('store-ambiguous'); }
  if (folder) {
    var files = folder.getFilesByName(SHARED_TODO_FILE);
    if (files.hasNext()) { file = files.next(); if (files.hasNext()) throw new Error('store-ambiguous'); }
  }
  var store = { schema: 1, revision: 0, tasks: [], receipts: [] };
  if (file) {
    var content = file.getBlob().getDataAsString('UTF-8');
    if (content.length > SHARED_TODO_MAX_CHARS) throw new Error('store-too-large');
    try { store = JSON.parse(content); } catch (_) { throw new Error('store-corrupt'); }
    if (!sharedTodoStoreValid_(store)) throw new Error('store-corrupt');
  }
  return { root: root, folder: folder, file: file, store: store };
}
function sharedTodoWrite_(loaded, store) {
  if (!sharedTodoStoreValid_(store)) throw new Error('store-corrupt');
  var content = JSON.stringify(store);
  if (content.length > SHARED_TODO_MAX_CHARS) throw new Error('store-full');
  // All task fields, revisions, tombstones and receipts are one content write.
  // No fallible description/metadata write follows the committed content.
  if (loaded.file) loaded.file.setContent(content);
  else {
    var folder = loaded.folder || loaded.root.createFolder(SHARED_TODO_FOLDER);
    folder.createFile(SHARED_TODO_FILE, content, 'application/json');
  }
}
function sharedTodoApply_(store, action, deviceId, payload) {
  var fingerprint = sharedTodoFingerprint_(action, deviceId, payload);
  for (var i = 0; i < store.receipts.length; i++) {
    var receipt = store.receipts[i];
    if (receipt.requestId === payload.requestId) return {
      changed: false,
      result: receipt.deviceId === deviceId && receipt.fingerprint === fingerprint ?
        sharedTodoClone_(receipt.result) : sharedTodoFail_('request-conflict')
    };
  }
  var id = action === 'sharedTodoSave' ? payload.task.id : payload.id;
  var index = -1;
  for (var j = 0; j < store.tasks.length; j++) if (store.tasks[j].id === id) { index = j; break; }
  var current = index < 0 ? null : store.tasks[index];
  if ((current && (current.deleted || payload.expectedRevision !== current.revision)) ||
      (!current && (action === 'sharedTodoDelete' || payload.expectedRevision !== 0))) {
    return { changed: false, result: { ok: false, error: 'conflict', current: sharedTodoClone_(current) } };
  }
  if ((!current && store.tasks.length >= SHARED_TODO_MAX_TASKS) || store.revision >= 9007199254740991 ||
      (current && current.revision >= 9007199254740991)) return { changed: false, result: sharedTodoFail_('store-full') };
  var now = new Date().toISOString();
  if (current && now < current.updatedAt) now = current.updatedAt;
  var task = action === 'sharedTodoDelete' ? sharedTodoClone_(current) : sharedTodoClone_(payload.task);
  task.revision = current ? current.revision + 1 : 1;
  task.createdAt = current ? current.createdAt : now;
  task.updatedAt = now; task.updatedBy = deviceId;
  if (action === 'sharedTodoDelete') task.deleted = true;
  if (index < 0) store.tasks.push(task); else store.tasks[index] = task;
  store.revision++;
  var result = { ok: true, version: SHARED_TODO_VERSION, storeRevision: store.revision, task: sharedTodoClone_(task) };
  store.receipts.push({ requestId: payload.requestId, deviceId: deviceId, fingerprint: fingerprint, result: sharedTodoClone_(result) });
  if (store.receipts.length > SHARED_TODO_MAX_RECEIPTS) store.receipts.splice(0, store.receipts.length - SHARED_TODO_MAX_RECEIPTS);
  return { changed: true, result: result };
}
function sharedTodoHandle_(action, req) {
  var lock = null, locked = false;
  try {
    // Defense in depth if another dispatcher later calls this helper directly.
    var auth = checkToken_(req && req.token);
    if (auth) return sharedTodoFail_(auth);
    if (!sharedTodoIsAction_(action)) return sharedTodoFail_('bad-request');
    var payload = sharedTodoInput_(action, req);
    if (!payload) return sharedTodoFail_('bad-request');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return sharedTodoFail_('busy');
    locked = true;
    // A token may be revoked while this execution waits for another writer.
    auth = checkToken_(req.token);
    if (auth) return sharedTodoFail_(auth);
    var loaded = sharedTodoRead_(), store = loaded.store;
    if (action === 'sharedTodoHealth') return { ok: true, version: SHARED_TODO_VERSION };
    if (action === 'sharedTodoList') return { ok: true, version: SHARED_TODO_VERSION, storeRevision: store.revision,
      tasks: store.tasks.filter(function (task) { return !task.deleted; }).map(sharedTodoClone_) };
    var applied = sharedTodoApply_(store, action, req.deviceId, payload);
    if (applied.changed) sharedTodoWrite_(loaded, store);
    return applied.result;
  } catch (error) {
    var code = error && error.message;
    // Never expose Drive errors, request text, paths, IDs, credentials or stacks.
    return sharedTodoFail_(['store-ambiguous', 'store-corrupt', 'store-too-large', 'store-full'].indexOf(code) >= 0 ? code : 'server-error');
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (_) {} }
  }
}

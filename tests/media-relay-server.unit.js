/* Offline Apps Script VM tests. No real accounts, files or network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const code = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/MediaRelay.gs'), 'utf8');
const TOKEN = 'TEST-MEDIA-APP-TOKEN', ROOT = 'TEST_APP_ROOT_000001', PHOTO = 'TEST_PHOTO_ROOT_0001', OUTSIDE = 'TEST_OUTSIDE_ROOT_001';
const CHUNK = 1048576;
const id = n => '00000000-0000-4000-a000-' + String(n).padStart(12, '0');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const iter = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
function response(status, body = {}, headers = {}, bytes) {
  return { getResponseCode: () => status, getContentText: () => JSON.stringify(body), getAllHeaders: () => headers,
    getBlob: () => ({ getBytes: () => [...(bytes || Buffer.alloc(0))] }) };
}
function harness(moduleSource = source) {
  const props = { APP_TOKEN: TOKEN, DRIVE_FOLDER_ID: ROOT }, files = new Map(), folders = new Map(), sessions = new Map();
  const calls = [], stats = { writes: 0, bytes: 0, ids: 0, starts: 0, locks: 0, creates: 0 };
  let lock = false, fault = '', onLock, hook, writeFault = '', busy = false, nextId = 1;
  function folder(fid, name, parents = []) {
    const item = { getId: () => fid, getName: () => name, getParents: () => iter(parents.map(v => folders.get(v))),
      getFoldersByName: n => iter([...folders.values()].filter(f => f.getName() === n && f.parentIds.includes(fid))),
      createFolder: n => { stats.creates++; return folder(PHOTO, n, [fid]); }, parentIds: parents };
    folders.set(fid, item); return item;
  }
  folder(ROOT, 'TEST_APP'); folder(PHOTO, '현장사진', [ROOT]); folder(OUTSIDE, 'TEST_OUTSIDE');
  function addFile(fid, bytes, type = 'video/mp4', parent = PHOTO) {
    files.set(fid, { id: fid, name: 'test.mp4', mimeType: type, size: String(bytes.length), sha256Checksum: digest(bytes),
      md5Checksum: crypto.createHash('md5').update(bytes).digest('hex'), parents: [parent], trashed: false, bytes: Buffer.from(bytes) });
    return files.get(fid);
  }
  const scriptProperties = { getProperty: k => props[k] ?? null, getProperties: () => ({ ...props }), setProperty(k, value) {
    stats.writes++;
    if (writeFault === 'before') { writeFault = ''; throw Error('TEST-SECRET-JOURNAL'); }
    if (writeFault === 'silent') { writeFault = ''; return; }
    props[k] = value;
    if (writeFault === 'after') { writeFault = ''; throw Error('TEST-SECRET-JOURNAL'); }
  } };
  function fetch(url, opt = {}) {
    calls.push({ url, method: opt.method || 'get', headers: { ...opt.headers }, length: opt.payload?.length || 0 });
    assert.equal(opt.headers.Authorization, 'Bearer TEST-OAUTH-NEVER-RETURN'); assert.equal(opt.followRedirects, false);
    if (hook) { const result = hook(url, opt); if (result) return result; }
    if (fault === 'network') { fault = ''; throw Error('TEST-SECRET-UPSTREAM'); }
    if (url.includes('/generateIds?')) { stats.ids++; return response(200, { ids: ['TEST_GENERATED_FILE_' + nextId++] }); }
    if (url.includes('/upload/drive/v3/files?uploadType=resumable')) {
      const meta = JSON.parse(opt.payload); if (files.has(meta.id)) return response(409);
      stats.starts++; const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=TEST_SESSION_' + stats.starts;
      sessions.set(sessionUrl, { ...meta, size: Number(opt.headers['X-Upload-Content-Length']), bytes: Buffer.alloc(0) });
      if (fault === 'start-lost') { fault = ''; throw Error('TEST-SECRET-SESSION'); }
      return response(200, {}, { Location: sessionUrl });
    }
    if (sessions.has(url)) {
      const session = sessions.get(url), range = opt.headers['Content-Range'];
      if (fault === 'expired') { fault = ''; sessions.delete(url); return response(404); }
      if (range.startsWith('bytes */')) {
        if (files.has(session.id)) return response(200, { id: session.id });
        return response(308, {}, session.bytes.length ? { Range: 'bytes=0-' + (session.bytes.length - 1) } : {});
      }
      const parts = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
      assert(parts); assert.equal(Number(parts[1]), session.bytes.length); assert.equal(Number(parts[3]), session.size);
      assert.equal(Number(parts[2]) + 1 - Number(parts[1]), opt.payload.length);
      stats.bytes += opt.payload.length; session.bytes = Buffer.concat([session.bytes, Buffer.from(opt.payload)]);
      if (session.bytes.length === session.size) {
        const file = addFile(session.id, session.bytes, session.mimeType, session.parents[0]); file.name = session.name;
        if (fault === 'checksum') { fault = ''; file.sha256Checksum = '0'.repeat(64); }
        if (fault === 'final-lost') { fault = ''; throw Error('TEST-SECRET-FINAL'); }
        return response(200, { id: session.id });
      }
      if (fault === 'chunk-lost') { fault = ''; throw Error('TEST-SECRET-CHUNK'); }
      return response(308, {}, { Range: 'bytes=0-' + (session.bytes.length - 1) });
    }
    const match = /\/drive\/v3\/files\/([A-Za-z0-9_-]+)\?/.exec(url); assert(match, 'Unexpected API URL ' + url);
    const fid = match[1];
    if (url.includes('alt=media')) {
      const file = files.get(fid); if (!file) return response(404);
      const range = /^bytes=(\d+)-(\d+)$/.exec(opt.headers.Range), start = Number(range[1]), end = Number(range[2]);
      return response(206, {}, { 'Content-Range': `bytes ${start}-${end}/${file.size}` }, file.bytes.subarray(start, end + 1));
    }
    if (folders.has(fid)) return response(200, { id: fid, mimeType: 'application/vnd.google-apps.folder', trashed: false });
    const file = files.get(fid); if (!file) return response(404); const { bytes, ...meta } = file; return response(200, meta);
  }
  const context = vm.createContext({ Date, Math, JSON, Object, Array, String, Number, Error, isFinite, isNaN, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => scriptProperties },
    LockService: { getScriptLock: () => ({ tryLock() { stats.locks++; if (busy) return false; assert.equal(lock, false); lock = true; if (onLock) onLock(); return true; }, releaseLock() { lock = false; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    DriveApp: { getFolderById: fid => { if (!folders.has(fid)) throw Error('TEST-SECRET-NOT-FOUND'); return folders.get(fid); },
      getFileById: fid => { const file = files.get(fid); if (!file) throw Error('TEST-SECRET-NOT-FOUND'); return { getParents: () => iter(file.parents.map(v => folders.get(v))) }; } },
    ScriptApp: { getOAuthToken: () => 'TEST-OAUTH-NEVER-RETURN' }, UrlFetchApp: { fetch },
    Utilities: { base64Decode: b64 => [...Buffer.from(b64, 'base64')], base64Encode: bytes => Buffer.from(bytes).toString('base64'), newBlob: value => ({ getBytes: () => [...Buffer.from(value)] }) },
    oiIsPublicAction_: () => false, oiIsInternalAction_: () => false
  });
  vm.runInContext(code + '\n' + moduleSource, context, { filename: 'media-relay-test.gs' });
  function request(action, payload = {}, changes = {}) {
    const req = { action, token: TOKEN, ts: Date.now(), deviceId: 'TEST-DEVICE-A', payload, ...changes };
    const result = JSON.parse(context.doPost({ postData: { contents: JSON.stringify(req) } }).text);
    for (const secret of ['TEST-SECRET', 'TEST-OAUTH', 'upload_id=']) assert(!JSON.stringify(result).includes(secret));
    assert.equal(lock, false); return result;
  }
  const key = n => 'MEDIA_RELAY_JOB_' + id(n);
  return { context, request, props, files, folders, sessions, stats, calls, addFile, folder,
    job: n => JSON.parse(props[key(n)]), putJob: (n, job) => { props[key(n)] = JSON.stringify(job); },
    fault: value => { fault = value; }, writeFault: value => { writeFault = value; }, hook: value => { hook = value; }, onLock: value => { onLock = value; }, busy: value => { busy = value; } };
}
function begin(bytes, n = 1, changes = {}) { return { uploadId: id(n), name: 'test.mp4', mimeType: 'video/mp4', size: bytes.length, sha256: digest(bytes), ...changes }; }
function chunk(bytes, offset = 0, n = 1) { return { uploadId: id(n), offset, dataB64: bytes.toString('base64') }; }
function error(result, expected) { assert.equal(result.ok, false); assert.equal(result.error, expected); }
function resumePartial(moduleSource, received) {
  const h = harness(moduleSource), bytes = Buffer.alloc(CHUNK * 2 + 104, 7);
  h.request('mediaUploadBegin', begin(bytes)); const fileId = h.job(1).fileId;
  // Simulate a lost request that Drive persisted only in part, not a whole chunk.
  h.hook((url, options) => {
    if (!options.headers['Content-Range']?.startsWith('bytes 0-')) return;
    h.sessions.get(url).bytes = Buffer.from(options.payload).subarray(0, received);
    h.stats.bytes += received; h.hook(null); throw Error('TEST_PARTIAL_RESPONSE_LOST');
  });
  error(h.request('mediaUploadChunk', chunk(bytes.subarray(0, CHUNK))), 'drive-unavailable');
  assert.equal(h.job(1).offset, 0, 'lost response does not invent acknowledged progress');
  let status = h.request('mediaUploadStatus', { uploadId: id(1) });
  assert.equal(status.ok, true); assert.equal(status.offset, received);
  assert.equal(h.job(1).offset, received, 'non-aligned offset is durable');
  assert.equal(h.request('mediaUploadBegin', begin(bytes)).offset, received, 'retry begin exposes exact Drive offset');
  error(h.request('mediaUploadChunk', chunk(Buffer.from([1, 2, 3]), received)), 'bad-range');
  assert.equal(h.stats.bytes, received, 'non-final chunk length must still be aligned');
  while (status.state !== 'complete') {
    const offset = status.offset;
    status = h.request('mediaUploadChunk', chunk(bytes.subarray(offset, Math.min(bytes.length, offset + CHUNK)), offset));
    assert.equal(status.ok, true); assert(status.offset > offset);
  }
  assert.equal(status.file.sha256, digest(bytes)); assert.equal(status.file.size, bytes.length);
  assert.equal(status.file.fileId, fileId); assert.equal(h.files.size, 1); assert.equal(h.stats.ids, 1);
  assert.equal(h.stats.bytes, bytes.length, 'resume sends no duplicate original bytes');
  assert.deepEqual(h.files.get(fileId).bytes, bytes);
}
function invalidSession(moduleSource, status) {
  const h = harness(moduleSource), bytes = Buffer.from('TEST_SESSION_ORIGINAL'); h.request('mediaUploadBegin', begin(bytes));
  const old = h.job(1), before = h.stats.starts;
  h.hook((url, options) => url === old.session && options.headers['Content-Range']?.startsWith('bytes */') ? response(status) : null);
  const result = h.request('mediaUploadStatus', { uploadId: id(1) });
  assert.equal(result.ok, true); assert.equal(result.state, 'uploading'); assert.equal(result.offset, 0);
  assert.equal(h.stats.starts, before + 1); assert.equal(h.stats.ids, 1); assert.equal(h.job(1).fileId, old.fileId);
  assert.notEqual(h.job(1).session, old.session); assert.equal(h.files.size, 0);
  h.hook(null); assert.equal(h.request('mediaUploadChunk', chunk(bytes)).state, 'complete'); assert.equal(h.files.size, 1);
}
function limitedSession(moduleSource, status, reason, expected) {
  const h = harness(moduleSource), bytes = Buffer.from('TEST_LIMIT_ORIGINAL'); h.request('mediaUploadBegin', begin(bytes));
  const old = h.job(1);
  h.hook((url, options) => options.headers['Content-Range']?.startsWith('bytes */') ? response(status, { error: { errors: [{ reason }], message: 'TEST-SECRET-UPSTREAM' } }) : null);
  error(h.request('mediaUploadStatus', { uploadId: id(1) }), expected);
  assert.deepEqual(h.job(1), old); assert.equal(h.stats.starts, 1); assert.equal(h.stats.ids, 1); assert.equal(h.stats.bytes, 0);
  h.hook(null); assert.equal(h.request('mediaUploadChunk', chunk(bytes)).state, 'complete');
}
let total = 0;
function test(name, fn) { fn(); total++; console.log('PASS ' + name); }

test('health authenticates and actually probes Drive without writes', () => {
  const h = harness(), r = h.request('mediaHealth'); assert.equal(r.ok, true); assert.equal(r.version, 'media-relay-v1');
  assert.equal(r.maxFileBytes, 104857600); assert.equal(r.chunkBytes, CHUNK); assert(r.mimeTypes.includes('video/quicktime'));
  assert.equal(h.stats.writes + h.stats.creates, 0); assert.equal(h.calls.length, 1); h.fault('network'); error(h.request('mediaHealth'), 'drive-unavailable');
});
test('all actions reject unauthenticated requests before side effects', () => {
  const h = harness(); for (const action of ['mediaHealth', 'mediaUploadBegin', 'mediaUploadStatus', 'mediaUploadChunk', 'mediaInspect', 'mediaReadChunk']) error(h.request(action, {}, { token: 'TEST-WRONG' }), 'unauthorized');
  assert.equal(h.calls.length + h.stats.writes + h.stats.locks, 0);
});
test('authentication is repeated under lock', () => { const h = harness(); h.onLock(() => { h.props.APP_TOKEN = 'TEST-ROTATED'; }); error(h.request('mediaHealth'), 'unauthorized'); assert.equal(h.calls.length, 0); });
test('missing module guarded dispatch preserves legacy routing', () => { const h = harness(''); error(h.request('mediaHealth'), 'bad-request'); assert.equal(h.stats.writes, 0); });
test('malformed payload, unknown fields, MIME and sizes rejected', () => {
  const h = harness(), bytes = Buffer.from('fake');
  for (const changes of [{ folderId: OUTSIDE }, { url: 'https://outside.invalid' }, { size: 104857601 }, { size: 0 }, { size: '4' }, { mimeType: 'text/html' }, { sha256: 'bad' }, { name: '../evil.mp4' }, { uploadId: '__proto__' }]) error(h.request('mediaUploadBegin', begin(bytes, 1, changes)), 'bad-request');
  error(h.request('mediaHealth', {}, { ts: 'not-a-date' }), 'bad-request'); error(h.request('mediaHealth', {}, { deviceId: '' }), 'bad-request'); assert.equal(h.stats.writes + h.calls.length, 0);
});
test('busy lock has no Drive writes', () => { const h = harness(); h.busy(true); error(h.request('mediaHealth'), 'busy'); assert.equal(h.calls.length, 0); });
test('begin is durable and duplicate begin reuses identity and session', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 3, 5), a = h.request('mediaUploadBegin', begin(b)); assert.equal(a.state, 'uploading'); assert.equal(a.offset, 0); assert.equal(a.file, undefined);
  assert(h.job(1).session); assert.equal(h.job(1).fileId, 'TEST_GENERATED_FILE_1'); assert.deepEqual(h.request('mediaUploadBegin', begin(b)), a); assert.equal(h.stats.starts, 1); assert.equal(h.stats.ids, 1);
});
test('same upload ID with different source cannot overwrite', () => {
  const h = harness(), b = Buffer.from('original'); h.request('mediaUploadBegin', begin(b));
  for (const changes of [{ sha256: '0'.repeat(64) }, { name: 'other.mp4' }, { size: b.length + 1 }, { mimeType: 'video/webm' }]) error(h.request('mediaUploadBegin', begin(b, 1, changes)), 'upload-conflict'); assert.equal(h.stats.starts, 1); assert.equal(h.stats.bytes, 0);
});
test('100MB declared size is accepted without buffering original', () => { const h = harness(), r = h.request('mediaUploadBegin', begin(Buffer.from('fake'), 1, { size: 104857600 })); assert.equal(r.size, 104857600); assert.equal(h.stats.bytes, 0); });
test('photo and video exact originals require confirmed hash and size', () => {
  for (const mimeType of ['video/mp4', 'image/heic']) {
    const h = harness(), b = Buffer.alloc(CHUNK + 17, 7); h.request('mediaUploadBegin', begin(b, 1, { mimeType }));
    const p = h.request('mediaUploadChunk', chunk(b.subarray(0, CHUNK))); assert.equal(p.state, 'uploading'); assert.equal(p.offset, CHUNK);
    const d = h.request('mediaUploadChunk', chunk(b.subarray(CHUNK), CHUNK)); assert.equal(d.state, 'complete'); assert.equal(d.file.sha256, digest(b)); assert.equal(d.file.size, b.length); assert.equal(d.file.verified, true);
    assert.equal(d.file.mimeType, mimeType); assert.equal(h.job(1).session, ''); assert.deepEqual(h.files.get(d.file.fileId).bytes, b); assert.deepEqual(h.request('mediaUploadStatus', { uploadId: id(1) }), d);
  }
});
test('chunk alignment, base64 and bounds validated before sending', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 2, 4); h.request('mediaUploadBegin', begin(b));
  error(h.request('mediaUploadChunk', chunk(Buffer.alloc(3))), 'bad-range'); error(h.request('mediaUploadChunk', chunk(Buffer.alloc(CHUNK + 1))), 'bad-range'); error(h.request('mediaUploadChunk', chunk(Buffer.alloc(3), CHUNK)), 'bad-range');
  error(h.request('mediaUploadChunk', { uploadId: id(1), offset: -1, dataB64: 'YQ==' }), 'bad-request'); error(h.request('mediaUploadChunk', { uploadId: id(1), offset: 0, dataB64: '%%%%' }), 'bad-request'); assert.equal(h.stats.bytes, 0);
});
test('out of order chunk returns confirmed offset and sends no bytes', () => { const h = harness(), b = Buffer.alloc(CHUNK * 2); h.request('mediaUploadBegin', begin(b)); const r = h.request('mediaUploadChunk', chunk(b.subarray(CHUNK), CHUNK)); error(r, 'offset-conflict'); assert.equal(r.offset, 0); assert.equal(h.stats.bytes, 0); });
test('lost chunk response resumes without duplicate bytes', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 11, 9); h.request('mediaUploadBegin', begin(b)); h.fault('chunk-lost'); error(h.request('mediaUploadChunk', chunk(b.subarray(0, CHUNK))), 'drive-unavailable'); assert.equal(h.job(1).offset, 0);
  assert.equal(h.request('mediaUploadStatus', { uploadId: id(1) }).offset, CHUNK); const r = h.request('mediaUploadChunk', chunk(b.subarray(0, CHUNK))); error(r, 'offset-conflict'); assert.equal(r.offset, CHUNK);
  assert.equal(h.request('mediaUploadChunk', chunk(b.subarray(CHUNK), CHUNK)).state, 'complete'); assert.equal(h.stats.bytes, b.length);
});
test('partially received non-aligned byte prefixes resume exactly', () => {
  for (const received of [43, 262143, 262145]) resumePartial(source, received);
});
test('lost final response is verified without reupload', () => {
  const h = harness(), b = Buffer.from('TEST_ORIGINAL_VIDEO'); h.request('mediaUploadBegin', begin(b)); h.fault('final-lost'); error(h.request('mediaUploadChunk', chunk(b)), 'drive-unavailable');
  assert.equal(h.request('mediaUploadStatus', { uploadId: id(1) }).state, 'complete'); assert.equal(h.stats.ids, 1); assert.equal(h.files.size, 1); assert.equal(h.stats.bytes, b.length);
});
test('initial journal failure never creates upload session', () => {
  for (const mode of ['before', 'silent', 'after']) { const h = harness(), b = Buffer.from('source'); h.writeFault(mode); error(h.request('mediaUploadBegin', begin(b)), 'journal-write-failed'); assert.equal(h.stats.starts, 0); assert.equal(h.request('mediaUploadBegin', begin(b)).ok, true); assert.equal(h.stats.starts, 1); }
});
test('journal failure after accepted bytes remains resumable', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 5, 2); h.request('mediaUploadBegin', begin(b)); h.hook((url, opt) => { if (opt.headers['Content-Range']?.startsWith('bytes 0-')) h.writeFault('before'); });
  error(h.request('mediaUploadChunk', chunk(b.subarray(0, CHUNK))), 'journal-write-failed'); h.hook(null); assert.equal(h.request('mediaUploadStatus', { uploadId: id(1) }).offset, CHUNK); assert.equal(h.stats.bytes, CHUNK);
});
test('final journal failure recovers verified receipt on retry', () => {
  const h = harness(), b = Buffer.from('final'); h.request('mediaUploadBegin', begin(b)); h.hook((url, opt) => { if (opt.headers['Content-Range']?.startsWith('bytes 0-')) h.writeFault('after'); });
  error(h.request('mediaUploadChunk', chunk(b)), 'journal-write-failed'); h.hook(null); assert.equal(h.request('mediaUploadStatus', { uploadId: id(1) }).state, 'complete'); assert.equal(h.files.size, 1); assert.equal(h.stats.bytes, b.length);
});
test('lost start and expired session retain generated identity', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 3, 6); h.fault('start-lost'); error(h.request('mediaUploadBegin', begin(b)), 'drive-unavailable'); const fid = h.job(1).fileId;
  assert.equal(h.request('mediaUploadBegin', begin(b)).ok, true); h.request('mediaUploadChunk', chunk(b.subarray(0, CHUNK))); h.fault('expired'); assert.equal(h.request('mediaUploadStatus', { uploadId: id(1) }).offset, 0); assert.equal(h.job(1).fileId, fid); assert.equal(h.stats.ids, 1);
});
test('400 401 404 410 session responses renew once using the same file identity', () => {
  for (const status of [400, 401, 404, 410]) invalidSession(source, status);
});
test('403 rate quota and permission failures retain the session with distinct errors', () => {
  for (const reason of ['rateLimitExceeded', 'userRateLimitExceeded']) limitedSession(source, 403, reason, 'drive-rate-limited');
  for (const reason of ['storageQuotaExceeded', 'dailyLimitExceeded']) limitedSession(source, 403, reason, 'drive-quota-exceeded');
  for (const reason of ['insufficientPermissions', 'domainPolicy', 'unknownReason']) limitedSession(source, 403, reason, 'drive-forbidden');
});
test('429 is a retryable rate limit and never resets an upload session', () => limitedSession(source, 429, '', 'drive-rate-limited'));
test('renewal checks an existing committed original and rejects hash conflicts', () => {
  for (const wrongHash of [false, true]) {
    const h = harness(), bytes = Buffer.from('TEST_ORIGINAL'); h.request('mediaUploadBegin', begin(bytes)); const old = h.job(1);
    h.hook((url, options) => {
      if (url === old.session && options.headers['Content-Range']?.startsWith('bytes */')) {
        const file = h.addFile(old.fileId, bytes); if (wrongHash) file.sha256Checksum = '0'.repeat(64);
        return response(400);
      }
    });
    const result = h.request('mediaUploadStatus', { uploadId: id(1) });
    if (wrongHash) { error(result, 'integrity-mismatch'); assert.equal(h.job(1).session, old.session); }
    else { assert.equal(result.state, 'complete'); assert.equal(result.file.sha256, digest(bytes)); }
    assert.equal(h.files.size, 1); assert.equal(h.stats.starts, 1); assert.equal(h.stats.ids, 1); assert.deepEqual(h.files.get(old.fileId).bytes, bytes);
  }
});
test('failed renewal cannot loop and retains its preallocated identity', () => {
  const h = harness(), bytes = Buffer.from('TEST_ORIGINAL'); h.request('mediaUploadBegin', begin(bytes)); const old = h.job(1);
  h.hook((url, options) => (options.headers['Content-Range']?.startsWith('bytes */') || url.includes('uploadType=resumable')) ? response(400) : null);
  const before = h.calls.length; error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'drive-request-rejected');
  assert.equal(h.calls.slice(before).filter(call => call.method === 'post').length, 1, 'single renewal attempt, no recursion');
  assert.equal(h.job(1).fileId, old.fileId); assert.equal(h.job(1).session, ''); assert.equal(h.stats.ids, 1); assert.equal(h.files.size, 0);
});
test('revoked OAuth or root permission prevents session replacement', () => {
  for (const denied of [401, 403]) {
    const h = harness(), bytes = Buffer.from('TEST_ORIGINAL'); h.request('mediaUploadBegin', begin(bytes)); const old = h.job(1);
    h.hook(url => url.includes('/drive/v3/files/' + old.fileId + '?') ? response(denied) : null);
    error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'drive-unavailable'); assert.deepEqual(h.job(1), old); assert.equal(h.stats.starts, 1);
  }
});
test('wrong or absent checksums never complete and preserve file', () => {
  const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); h.fault('checksum'); error(h.request('mediaUploadChunk', chunk(b)), 'integrity-mismatch'); assert.equal(h.job(1).state, 'uploading'); assert.equal(h.files.size, 1);
  delete h.files.get(h.job(1).fileId).sha256Checksum; error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'checksum-unavailable'); assert.equal(h.files.size, 1);
});
test('wrong final size rejected even if hash matches', () => { const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); h.addFile(h.job(1).fileId, b).size = String(b.length + 1); error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'integrity-mismatch'); assert.equal(h.job(1).state, 'uploading'); });
test('root configuration change blocks old job', () => { const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); h.props.DRIVE_FOLDER_ID = OUTSIDE; error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'connection-changed'); assert.equal(h.stats.bytes, 0); });
test('journal corruption and unsafe session URLs fail closed', () => { const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); const job = h.job(1); job.session = 'https://attacker.invalid/upload_id=oops'; h.putJob(1, job); const before = h.calls.length; error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'journal-invalid'); assert.equal(h.calls.length, before); });
test('journal bound refuses new jobs and retains previous receipts', () => { const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); h.context.MEDIA_RELAY_MAX_JOBS = 1; const first = h.props['MEDIA_RELAY_JOB_' + id(1)]; error(h.request('mediaUploadBegin', begin(b, 2)), 'journal-full'); assert.equal(h.props['MEDIA_RELAY_JOB_' + id(1)], first); assert.equal(h.stats.starts, 1); assert.equal(h.request('mediaUploadChunk', chunk(b)).state, 'complete'); });
test('oversized shared properties preserved', () => { const h = harness(); h.props.UNRELATED_TEST_STORAGE = '가'.repeat(150000); error(h.request('mediaUploadBegin', begin(Buffer.from('source'))), 'journal-full'); assert.equal(h.props.UNRELATED_TEST_STORAGE.length, 150000); assert.equal(h.stats.starts, 0); });
test('inspection returns actual metadata with no write', () => { const h = harness(), b = Buffer.from('existing original'), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b, 'image/jpeg'); const r = h.request('mediaInspect', { fileId: fid }); assert.equal(r.file.sha256, digest(b)); assert.equal(r.file.size, b.length); assert.equal(h.stats.writes + h.stats.bytes, 0); });
test('outside-root, trashed, shortcut and missing files blocked', () => {
  const h = harness(), b = Buffer.from('source'); h.addFile('TEST_OUTSIDE_FILE_001', b, 'video/mp4', OUTSIDE); error(h.request('mediaInspect', { fileId: 'TEST_OUTSIDE_FILE_001' }), 'forbidden');
  error(h.request('mediaReadChunk', { fileId: 'TEST_OUTSIDE_FILE_001', offset: 0, length: b.length, sha256: digest(b) }), 'forbidden');
  const meta = h.addFile('TEST_INSIDE_FILE_0001', b); meta.trashed = true; error(h.request('mediaInspect', { fileId: meta.id }), 'not-found'); meta.trashed = false; meta.mimeType = 'application/vnd.google-apps.shortcut'; error(h.request('mediaInspect', { fileId: meta.id }), 'unsupported-media'); error(h.request('mediaInspect', { fileId: 'TEST_MISSING_FILE_001' }), 'not-found');
});
test('authenticated ranges reconstruct original bytes', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 23, 8), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b); const a = h.request('mediaReadChunk', { fileId: fid, offset: 0, length: CHUNK, sha256: digest(b) }), z = h.request('mediaReadChunk', { fileId: fid, offset: CHUNK, length: CHUNK, sha256: digest(b) });
  assert.equal(a.eof, false); assert.equal(z.eof, true); assert.equal(z.nextOffset, b.length); assert.deepEqual(Buffer.concat([Buffer.from(a.dataB64, 'base64'), Buffer.from(z.dataB64, 'base64')]), b); assert.equal(h.stats.writes, 0);
});
test('read rejects changed hashes, invalid offsets and ignored Range', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 2), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b); const req = { fileId: fid, offset: 0, length: CHUNK, sha256: digest(b) };
  error(h.request('mediaReadChunk', { ...req, sha256: '0'.repeat(64) }), 'content-changed'); error(h.request('mediaReadChunk', { ...req, offset: b.length }), 'bad-range'); error(h.request('mediaReadChunk', { ...req, length: CHUNK + 1 }), 'bad-request');
  h.hook(url => url.includes('alt=media') ? response(200, {}, {}, b) : null); error(h.request('mediaReadChunk', req), 'bad-range-response');
});
test('bad range proof and mid-read changes fail closed', () => {
  const h = harness(), b = Buffer.from('source'), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b); const req = { fileId: fid, offset: 0, length: 3, sha256: digest(b) };
  h.hook(url => url.includes('alt=media') ? response(206, {}, { 'Content-Range': 'bytes 1-3/6' }, b.subarray(0, 3)) : null); error(h.request('mediaReadChunk', req), 'bad-range-response');
  h.hook(url => { if (url.includes('alt=media')) { h.files.get(fid).sha256Checksum = '0'.repeat(64); return response(206, {}, { 'Content-Range': 'bytes 0-2/6' }, b.subarray(0, 3)); } }); error(h.request('mediaReadChunk', req), 'content-changed');
});
test('completed missing file is not recreated', () => { const h = harness(), b = Buffer.from('source'); h.request('mediaUploadBegin', begin(b)); h.request('mediaUploadChunk', chunk(b)); h.files.delete(h.job(1).fileId); error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'not-found'); assert.equal(h.stats.starts, 1); });
test('malformed Drive offset and untrusted session redirect rejected', () => {
  const h = harness(), b = Buffer.alloc(CHUNK + 1); h.request('mediaUploadBegin', begin(b)); h.hook((url, opt) => opt.headers['Content-Range']?.startsWith('bytes */') ? response(308, {}, { Range: 'bytes=1-8' }) : null); error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'drive-response-invalid');
  const x = harness(); x.hook(url => url.includes('uploadType=resumable') ? response(200, {}, { Location: 'https://attacker.invalid/?upload_id=secret' }) : null); error(x.request('mediaUploadBegin', begin(b)), 'drive-response-invalid'); assert.equal(x.stats.bytes, 0);
});

const mutations = [
  ['invalid session recovery', 'if (status === 400 || status === 401 || status === 404 || status === 410)', 'if (status === 404 || status === 410)', m => invalidSession(m, 400)],
  ['rate-limit classification', "if (status === 429) return 'drive-rate-limited';", "if (status === 429) return 'drive-unavailable';", m => limitedSession(m, 429, '', 'drive-rate-limited')],
  ['permission keeps session', 'if (status === 400 || status === 401 || status === 404 || status === 410)', 'if (status === 400 || status === 401 || status === 403 || status === 404 || status === 410)', m => limitedSession(m, 403, 'insufficientPermissions', 'drive-forbidden')],
  ['partial offset input', 'mediaInt_(p.offset, 0, MEDIA_RELAY_MAX_FILE - 1) &&\n    typeof p.dataB64', 'mediaInt_(p.offset, 0, MEDIA_RELAY_MAX_FILE - 1) && p.offset % MEDIA_RELAY_ALIGN === 0 &&\n    typeof p.dataB64', m => resumePartial(m, 43)],
  ['partial offset journal', "job.session === '' : job.offset < job.size);", "job.session === '' : job.offset < job.size && job.offset % MEDIA_RELAY_ALIGN === 0);", m => resumePartial(m, 43)],
  ['partial offset response', 'if (!mediaInt_(offset, 0, job.size - 1))', 'if (!mediaInt_(offset, 0, job.size - 1) || offset % MEDIA_RELAY_ALIGN !== 0)', m => resumePartial(m, 43)],
  ['root isolation', 'if (!isInsideRoot_(file, root))', 'if (false)', m => { const h = harness(m); h.addFile('TEST_OUTSIDE_FILE_001', Buffer.from('x'), 'video/mp4', OUTSIDE); error(h.request('mediaInspect', { fileId: 'TEST_OUTSIDE_FILE_001' }), 'forbidden'); }],
  ['final hash', 'file.sha256 !== job.sha256', 'false', m => { const h = harness(m), b = Buffer.from('x'); h.request('mediaUploadBegin', begin(b)); h.fault('checksum'); error(h.request('mediaUploadChunk', chunk(b)), 'integrity-mismatch'); }],
  ['final size', 'file.size !== job.size', 'false', m => { const h = harness(m), b = Buffer.from('x'); h.request('mediaUploadBegin', begin(b)); h.addFile(h.job(1).fileId, b).size = '2'; error(h.request('mediaUploadStatus', { uploadId: id(1) }), 'integrity-mismatch'); }],
  ['under-lock auth', 'auth = checkToken_(req.token);', "auth = '';", m => { const h = harness(m); h.onLock(() => { h.props.APP_TOKEN = 'TEST-ROTATED'; }); error(h.request('mediaHealth'), 'unauthorized'); }],
  ['journal acknowledgement', 'if (properties.getProperty(key) !== value)', 'if (false)', m => { const h = harness(m); h.writeFault('silent'); error(h.request('mediaUploadBegin', begin(Buffer.from('x'))), 'journal-write-failed'); }],
  ['expected read digest', 'if (file.sha256 !== p.sha256)', 'if (false)', m => { const h = harness(m), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, Buffer.from('x')); error(h.request('mediaReadChunk', { fileId: fid, offset: 0, length: 1, sha256: '0'.repeat(64) }), 'content-changed'); }],
  ['range proof', "if (status === 206 && mediaHeader_(response, 'Content-Range') !==", "if (false && mediaHeader_(response, 'Content-Range') !==", m => { const h = harness(m), b = Buffer.from('source'), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b); h.hook(url => url.includes('alt=media') ? response(206, {}, { 'Content-Range': 'bytes 1-3/6' }, b.subarray(0, 3)) : null); error(h.request('mediaReadChunk', { fileId: fid, offset: 0, length: 3, sha256: digest(b) }), 'bad-range-response'); }],
  ['post-read change', 'if (after.sha256 !== file.sha256 || after.size !== file.size || after.mimeType !== file.mimeType)', 'if (false)', m => { const h = harness(m), b = Buffer.from('source'), fid = 'TEST_EXISTING_FILE_001'; h.addFile(fid, b); h.hook(url => { if (url.includes('alt=media')) { h.files.get(fid).sha256Checksum = '0'.repeat(64); return response(206, {}, { 'Content-Range': 'bytes 0-2/6' }, b.subarray(0, 3)); } }); error(h.request('mediaReadChunk', { fileId: fid, offset: 0, length: 3, sha256: digest(b) }), 'content-changed'); }]
];
for (const [name, from, to, probe] of mutations) {
  assert(source.includes(from), 'mutation target exists: ' + name); let caught = false;
  try { probe(source.replace(from, to)); } catch (e) { if (e instanceof assert.AssertionError || e.code === 'ERR_ASSERTION') caught = true; else throw e; }
  assert(caught, 'mutation survived: ' + name); console.log('MUTATION CAUGHT ' + name);
}
console.log(`media-relay-server: ${total}/${total} PASS; mutations ${mutations.length}/${mutations.length} caught`);

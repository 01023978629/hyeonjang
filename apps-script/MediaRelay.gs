/** Original media relay v1. Authenticated POST only; no legacy action changes.
 * Session URIs and generated Drive IDs are journaled BEFORE sending any bytes.
 * No automatic deletion, public sharing, overwrite, or caller-selected URL/folder.
 * Requires existing Drive scope and script.external_request at manual deployment.
 */
var MEDIA_RELAY_VERSION = 'media-relay-v1';
var MEDIA_RELAY_MAX_FILE = 100 * 1024 * 1024;
var MEDIA_RELAY_CHUNK = 1024 * 1024;
var MEDIA_RELAY_ALIGN = 256 * 1024;
var MEDIA_RELAY_JOB_PREFIX = 'MEDIA_RELAY_JOB_';
var MEDIA_RELAY_MAX_JOBS = 256;
var MEDIA_RELAY_PROPERTIES_BYTES = 400 * 1024;
var MEDIA_RELAY_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska', 'video/3gpp', 'video/3gpp2'];

function mediaRelayIsAction_(action) {
  return ['mediaHealth', 'mediaUploadBegin', 'mediaUploadStatus', 'mediaUploadChunk', 'mediaInspect', 'mediaReadChunk'].indexOf(action) >= 0;
}
function mediaFail_(code) { return { ok: false, error: code }; }
function mediaThrow_(code) { var error = new Error(code); error.mediaCode = code; throw error; }
function mediaKeys_(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(function (key) { return keys.indexOf(key) >= 0; });
}
function mediaInt_(value, min, max) { return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= min && value <= max; }
function mediaId_(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(value); }
function mediaUuid_(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value); }
function mediaHash_(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function mediaName_(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value &&
    !/[\\\/:*?"<>|\x00-\x1f\x7f]/.test(value) && value !== '.' && value !== '..';
}
function mediaSession_(value) {
  return typeof value === 'string' && value.length <= 2048 &&
    /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[A-Za-z0-9._~!$&'()*+,;=:@%?\/-]+$/.test(value) &&
    /[?&]upload_id=[A-Za-z0-9_-]+(?:&|$)/.test(value);
}
function mediaInput_(action, req) {
  if (!mediaKeys_(req, ['action', 'token', 'ts', 'deviceId', 'payload']) ||
      typeof req.deviceId !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(req.deviceId) ||
      !mediaInt_(req.ts, 1, 9007199254740991) || Math.abs(Date.now() - req.ts) > TS_WINDOW_MS) return null;
  var p = req.payload;
  if (action === 'mediaHealth') return p === undefined || mediaKeys_(p, []) ? {} : null;
  if (action === 'mediaInspect') return mediaKeys_(p, ['fileId']) && mediaId_(p.fileId) ? p : null;
  if (action === 'mediaReadChunk') return mediaKeys_(p, ['fileId', 'offset', 'length', 'sha256']) && mediaId_(p.fileId) &&
    mediaInt_(p.offset, 0, MEDIA_RELAY_MAX_FILE - 1) && mediaInt_(p.length, 1, MEDIA_RELAY_CHUNK) && mediaHash_(p.sha256) ? p : null;
  if (action === 'mediaUploadStatus') return mediaKeys_(p, ['uploadId']) && mediaUuid_(p.uploadId) ? p : null;
  if (action === 'mediaUploadBegin') return mediaKeys_(p, ['uploadId', 'name', 'mimeType', 'size', 'sha256']) &&
    mediaUuid_(p.uploadId) && mediaName_(p.name) && MEDIA_RELAY_MIMES.indexOf(p.mimeType) >= 0 &&
    mediaInt_(p.size, 1, MEDIA_RELAY_MAX_FILE) && mediaHash_(p.sha256) ? p : null;
  if (action === 'mediaUploadChunk') return mediaKeys_(p, ['uploadId', 'offset', 'dataB64']) && mediaUuid_(p.uploadId) &&
    mediaInt_(p.offset, 0, MEDIA_RELAY_MAX_FILE - 1) &&
    typeof p.dataB64 === 'string' && p.dataB64.length > 0 && p.dataB64.length <= 4 * Math.ceil(MEDIA_RELAY_CHUNK / 3) &&
    p.dataB64.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(p.dataB64) ? p : null;
  return null;
}
function mediaRelayHandle_(action, req) {
  var lock, held = false;
  try {
    var auth = checkToken_(req && req.token);
    if (auth) return mediaFail_(auth);
    var p = mediaInput_(action, req);
    if (!p) return mediaFail_('bad-request');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return mediaFail_('busy');
    held = true;
    // Recheck both token and request age after waiting, before Drive/journal access.
    auth = checkToken_(req.token);
    if (auth) return mediaFail_(auth);
    if (Math.abs(Date.now() - req.ts) > TS_WINDOW_MS) return mediaFail_('bad-request');
    var root = rootFolder_();
    if (action === 'mediaHealth') {
      // Real read-only Drive API request: scope/API failure must not advertise readiness.
      var probe = mediaMetadata_(root.getId(), false);
      if (probe.trashed || probe.mimeType !== 'application/vnd.google-apps.folder') return mediaFail_('root-unavailable');
      return { ok: true, version: MEDIA_RELAY_VERSION, maxFileBytes: MEDIA_RELAY_MAX_FILE,
        chunkBytes: MEDIA_RELAY_CHUNK, alignmentBytes: MEDIA_RELAY_ALIGN, mimeTypes: MEDIA_RELAY_MIMES.slice() };
    }
    if (action === 'mediaInspect') return { ok: true, version: MEDIA_RELAY_VERSION, file: mediaInspect_(p.fileId, root) };
    if (action === 'mediaReadChunk') return mediaRead_(p, root);
    return mediaUpload_(action, p, req.deviceId, root);
  } catch (error) {
    // Never emit upstream exceptions: they can include OAuth/session URLs or content.
    return mediaFail_(error && error.mediaCode || 'media-server-error');
  } finally { if (held) lock.releaseLock(); }
}
function mediaHeader_(response, key) {
  var headers = response.getAllHeaders(), found = '';
  Object.keys(headers).some(function (name) { if (name.toLowerCase() === key.toLowerCase()) { found = String(headers[name]); return true; } return false; });
  return found;
}
function mediaFetch_(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers.Authorization = 'Bearer ' + ScriptApp.getOAuthToken();
  options.muteHttpExceptions = true;
  options.followRedirects = false;
  try { return UrlFetchApp.fetch(url, options); }
  catch (_) { mediaThrow_('drive-unavailable'); }
}
function mediaJson_(response) {
  try { var value = JSON.parse(response.getContentText()); if (value && typeof value === 'object' && !Array.isArray(value)) return value; }
  catch (_) {}
  mediaThrow_('drive-response-invalid');
}
function mediaUploadFailure_(response) {
  var status = response.getResponseCode();
  if (status === 429) return 'drive-rate-limited';
  if (status === 401) return 'drive-auth-required';
  if (status === 403) {
    var reasons = [];
    try {
      var body = JSON.parse(response.getContentText()), details = body && body.error && body.error.errors;
      if (Array.isArray(details)) reasons = details.slice(0, 20).map(function (detail) { return detail && detail.reason; });
    } catch (_) {}
    if (reasons.some(function (reason) { return ['rateLimitExceeded', 'userRateLimitExceeded', 'sharingRateLimitExceeded'].indexOf(reason) >= 0; })) return 'drive-rate-limited';
    if (reasons.some(function (reason) { return ['dailyLimitExceeded', 'dailyLimitExceededUnreg', 'quotaExceeded', 'storageQuotaExceeded', 'teamDriveFileLimitExceeded', 'activeItemCreationLimitExceeded'].indexOf(reason) >= 0; })) return 'drive-quota-exceeded';
    // 403 can mean a permission or domain-policy failure, not just session expiry.
    // Keep an ambiguous session intact and require settings/permission inspection.
    return 'drive-forbidden';
  }
  return status >= 400 && status < 500 ? 'drive-request-rejected' : 'drive-unavailable';
}
function mediaMetadata_(id, missingAllowed) {
  var response = mediaFetch_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    '?fields=id,name,mimeType,size,sha256Checksum,md5Checksum,parents,trashed,version&supportsAllDrives=true');
  var status = response.getResponseCode();
  if (status === 404 && missingAllowed) return null;
  if (status === 404) mediaThrow_('not-found');
  if (status !== 200) mediaThrow_('drive-unavailable');
  var meta = mediaJson_(response);
  if (meta.id !== id) mediaThrow_('drive-response-invalid');
  return meta;
}
function mediaInside_(id, root) {
  var file;
  try { file = DriveApp.getFileById(id); }
  catch (_) { mediaThrow_('not-found'); }
  if (!isInsideRoot_(file, root)) mediaThrow_('forbidden');
}
function mediaPublicFile_(meta) {
  var size = Number(meta.size);
  if (meta.trashed) mediaThrow_('not-found');
  if (MEDIA_RELAY_MIMES.indexOf(meta.mimeType) < 0) mediaThrow_('unsupported-media');
  if (!mediaInt_(size, 1, MEDIA_RELAY_MAX_FILE)) mediaThrow_('too-large');
  if (!mediaHash_(meta.sha256Checksum)) mediaThrow_('checksum-unavailable');
  return { fileId: meta.id, name: String(meta.name || '').slice(0, 160), mimeType: meta.mimeType,
    size: size, sha256: meta.sha256Checksum,
    md5Checksum: /^[a-f0-9]{32}$/.test(meta.md5Checksum || '') ? meta.md5Checksum : '', verified: true };
}
function mediaInspect_(id, root) {
  mediaInside_(id, root);
  return mediaPublicFile_(mediaMetadata_(id, false));
}
function mediaRead_(p, root) {
  var file = mediaInspect_(p.fileId, root);
  if (file.sha256 !== p.sha256) return mediaFail_('content-changed');
  if (p.offset >= file.size) return mediaFail_('bad-range');
  var end = Math.min(file.size, p.offset + p.length) - 1;
  var response = mediaFetch_('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(p.fileId) + '?alt=media&supportsAllDrives=true',
    { headers: { Range: 'bytes=' + p.offset + '-' + end } });
  var status = response.getResponseCode();
  // 200 is acceptable only for a complete <=1 MiB file. Never truncate an ignored Range.
  if (status !== 206 && !(status === 200 && p.offset === 0 && end + 1 === file.size)) return mediaFail_('bad-range-response');
  if (status === 206 && mediaHeader_(response, 'Content-Range') !== 'bytes ' + p.offset + '-' + end + '/' + file.size) return mediaFail_('bad-range-response');
  var bytes = response.getBlob().getBytes();
  if (bytes.length !== end - p.offset + 1 || bytes.length > MEDIA_RELAY_CHUNK) return mediaFail_('bad-range-response');
  var after = mediaInspect_(p.fileId, root);
  if (after.sha256 !== file.sha256 || after.size !== file.size || after.mimeType !== file.mimeType) return mediaFail_('content-changed');
  return { ok: true, version: MEDIA_RELAY_VERSION, fileId: p.fileId, offset: p.offset, nextOffset: end + 1,
    size: file.size, mimeType: file.mimeType, sha256: file.sha256, dataB64: Utilities.base64Encode(bytes), eof: end + 1 === file.size };
}
function mediaJobValid_(job, uploadId) {
  return mediaKeys_(job, ['schema', 'uploadId', 'rootId', 'folderId', 'fileId', 'name', 'mimeType', 'size', 'sha256', 'deviceId', 'session', 'offset', 'state']) &&
    job.schema === 1 && job.uploadId === uploadId && mediaUuid_(job.uploadId) && mediaId_(job.rootId) && mediaId_(job.folderId) && mediaId_(job.fileId) &&
    mediaName_(job.name) && MEDIA_RELAY_MIMES.indexOf(job.mimeType) >= 0 && mediaInt_(job.size, 1, MEDIA_RELAY_MAX_FILE) && mediaHash_(job.sha256) &&
    typeof job.deviceId === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(job.deviceId) &&
    (job.session === '' || mediaSession_(job.session)) && mediaInt_(job.offset, 0, job.size) &&
    (job.state === 'uploading' || job.state === 'complete') &&
    (job.state === 'complete' ? job.offset === job.size && job.session === '' : job.offset < job.size);
}
function mediaLoadJob_(uploadId) {
  var raw = props_().getProperty(MEDIA_RELAY_JOB_PREFIX + uploadId);
  if (raw === null) return null;
  var job;
  try { job = JSON.parse(raw); } catch (_) { mediaThrow_('journal-invalid'); }
  if (!mediaJobValid_(job, uploadId)) mediaThrow_('journal-invalid');
  return job;
}
function mediaSaveJob_(job) {
  if (!mediaJobValid_(job, job.uploadId)) mediaThrow_('journal-invalid');
  var properties = props_(), all = properties.getProperties(), key = MEDIA_RELAY_JOB_PREFIX + job.uploadId;
  var value = JSON.stringify(job), count = 0, total = 0;
  all[key] = value;
  Object.keys(all).forEach(function (name) {
    if (name.indexOf(MEDIA_RELAY_JOB_PREFIX) === 0) count++;
    total += Utilities.newBlob(name + String(all[name])).getBytes().length;
  });
  if (count > MEDIA_RELAY_MAX_JOBS || total > MEDIA_RELAY_PROPERTIES_BYTES || Utilities.newBlob(value).getBytes().length > 8000) mediaThrow_('journal-full');
  try {
    properties.setProperty(key, value);
    if (properties.getProperty(key) !== value) mediaThrow_('journal-write-failed');
  } catch (_) { mediaThrow_('journal-write-failed'); }
}
function mediaFolder_(root) {
  var folders = root.getFoldersByName(PHOTO_FOLDER), folder;
  if (folders.hasNext()) { folder = folders.next(); if (folders.hasNext()) mediaThrow_('folder-ambiguous'); }
  else folder = root.createFolder(PHOTO_FOLDER);
  return folder;
}
function mediaGenerateId_() {
  var response = mediaFetch_('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');
  if (response.getResponseCode() !== 200) mediaThrow_('drive-unavailable');
  var ids = mediaJson_(response).ids;
  if (!Array.isArray(ids) || ids.length !== 1 || !mediaId_(ids[0])) mediaThrow_('drive-response-invalid');
  return ids[0];
}
function mediaResult_(job, file) {
  var result = { ok: true, version: MEDIA_RELAY_VERSION, uploadId: job.uploadId, state: job.state,
    offset: job.offset, size: job.size, chunkBytes: MEDIA_RELAY_CHUNK };
  if (file) result.file = file;
  return result;
}
function mediaComplete_(job, meta, root) {
  mediaInside_(job.fileId, root);
  var file = mediaPublicFile_(meta);
  if (file.fileId !== job.fileId || file.size !== job.size || file.sha256 !== job.sha256 || file.mimeType !== job.mimeType ||
      !Array.isArray(meta.parents) || meta.parents.indexOf(job.folderId) < 0) mediaThrow_('integrity-mismatch');
  job.state = 'complete'; job.offset = job.size; job.session = '';
  mediaSaveJob_(job);
  return mediaResult_(job, file);
}
function mediaStart_(job, root) {
  var folder;
  try { folder = DriveApp.getFolderById(job.folderId); } catch (_) { mediaThrow_('root-unavailable'); }
  if (!isInsideRoot_(folder, root)) mediaThrow_('forbidden');
  var response = mediaFetch_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post', contentType: 'application/json; charset=UTF-8',
    headers: { 'X-Upload-Content-Type': job.mimeType, 'X-Upload-Content-Length': String(job.size) },
    payload: JSON.stringify({ id: job.fileId, name: job.name, mimeType: job.mimeType, parents: [job.folderId] })
  });
  if (response.getResponseCode() === 409) {
    var existing = mediaMetadata_(job.fileId, true);
    if (existing) return mediaComplete_(job, existing, root);
    mediaThrow_('drive-unavailable');
  }
  if (response.getResponseCode() !== 200) mediaThrow_(mediaUploadFailure_(response));
  var uri = mediaHeader_(response, 'Location');
  if (!mediaSession_(uri)) mediaThrow_('drive-response-invalid');
  job.session = uri; job.offset = 0; job.state = 'uploading';
  mediaSaveJob_(job);
  return mediaResult_(job);
}
function mediaProgress_(job, response, root) {
  var status = response.getResponseCode();
  if (status === 200 || status === 201 || status === 409) {
    var meta = mediaMetadata_(job.fileId, true);
    if (!meta) mediaThrow_('verification-pending');
    return mediaComplete_(job, meta, root);
  }
  if (status === 400 || status === 401 || status === 404 || status === 410) {
    var completed = mediaMetadata_(job.fileId, true);
    if (completed) return mediaComplete_(job, completed, root);
    job.session = ''; job.offset = 0;
    mediaSaveJob_(job);
    // One renewal per request; mediaStart_ never recursively renews on failure.
    return mediaStart_(job, root); // Same preallocated ID: never create a duplicate.
  }
  if (status !== 308) mediaThrow_(mediaUploadFailure_(response));
  var range = mediaHeader_(response, 'Range'), offset = 0;
  if (range) {
    var match = /^bytes=0-(\d+)$/.exec(range);
    if (!match) mediaThrow_('drive-response-invalid');
    offset = Number(match[1]) + 1;
  }
  // A broken request may leave any byte prefix on Drive (e.g. bytes=0-42).
  // The 256 KiB requirement applies to non-final chunk LENGTH, not its start.
  if (!mediaInt_(offset, 0, job.size - 1)) mediaThrow_('drive-response-invalid');
  job.offset = offset;
  mediaSaveJob_(job);
  return mediaResult_(job);
}
function mediaSync_(job, root) {
  // Covers lost final HTTP response or journal-write failure after Drive committed.
  var completed = mediaMetadata_(job.fileId, true);
  if (completed) return mediaComplete_(job, completed, root);
  if (job.state === 'complete') mediaThrow_('not-found'); // Never recreate a removed complete file.
  if (!job.session) return mediaStart_(job, root);
  return mediaProgress_(job, mediaFetch_(job.session, {
    method: 'put', headers: { 'Content-Range': 'bytes */' + job.size }, payload: ''
  }), root);
}
function mediaUpload_(action, p, deviceId, root) {
  var job = mediaLoadJob_(p.uploadId);
  if (job && job.rootId !== root.getId()) return mediaFail_('connection-changed');
  if (!job) {
    if (action !== 'mediaUploadBegin') return mediaFail_('upload-not-found');
    var folder = mediaFolder_(root);
    job = { schema: 1, uploadId: p.uploadId, rootId: root.getId(), folderId: folder.getId(), fileId: mediaGenerateId_(),
      name: p.name, mimeType: p.mimeType, size: p.size, sha256: p.sha256, deviceId: deviceId, session: '', offset: 0, state: 'uploading' };
    mediaSaveJob_(job); // Durable identity must exist before creating a session.
  } else if (action === 'mediaUploadBegin' && (job.name !== p.name || job.mimeType !== p.mimeType || job.size !== p.size || job.sha256 !== p.sha256)) {
    return mediaFail_('upload-conflict');
  }
  var bytes;
  if (action === 'mediaUploadChunk') {
    bytes = Utilities.base64Decode(p.dataB64);
    if (bytes.length < 1 || bytes.length > MEDIA_RELAY_CHUNK || p.offset + bytes.length > job.size ||
        (p.offset + bytes.length !== job.size && bytes.length % MEDIA_RELAY_ALIGN !== 0) || Utilities.base64Encode(bytes) !== p.dataB64) return mediaFail_('bad-range');
  }
  var result = mediaSync_(job, root);
  if (result.state === 'complete' || action !== 'mediaUploadChunk') return result;
  if (p.offset !== job.offset) return { ok: false, error: 'offset-conflict', offset: job.offset };
  var response = mediaFetch_(job.session, { method: 'put', contentType: job.mimeType,
    headers: { 'Content-Range': 'bytes ' + p.offset + '-' + (p.offset + bytes.length - 1) + '/' + job.size }, payload: bytes });
  return mediaProgress_(job, response, root);
}

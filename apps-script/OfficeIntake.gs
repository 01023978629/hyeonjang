'use strict';

var OI_PUBLIC_ACTIONS = ['officeLogin', 'officeList', 'officeGet', 'officeCreate', 'officeUpdate', 'officeCancel', 'officeUpload'];
var OI_INTERNAL_ACTIONS = ['officeInbox', 'officeAccept', 'officeSetStatus', 'officeAdminUpsert', 'officeRotatePin', 'officeDisable', 'officeRetentionList'];
var OI_LOGIN_LIMIT = 5;
var OI_LOGIN_WINDOW_SECONDS = 600;
var OI_DUMMY_PIN_SALT = 'office-intake-invalid-salt';
var OI_DUMMY_PIN_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function oiIsPublicAction_(action) { return OI_PUBLIC_ACTIONS.indexOf(action) >= 0; }
function oiIsInternalAction_(action) { return OI_INTERNAL_ACTIONS.indexOf(action) >= 0; }

function oiSecret_(){
  var s=PropertiesService.getScriptProperties().getProperty('OFFICE_SESSION_SECRET')||'';
  if(s.length<32) throw new Error('office-secret-not-configured');
  return s;
}
function oiMac_(text){
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(text),oiSecret_())
  ).replace(/=+$/,'');
}
function oiHashPin_(pin,salt){return oiMac_(String(salt)+':'+String(pin));}
function oiSafeEqual_(a,b){
  if(!a||!b)return false;
  var x,y;
  try{x=Utilities.base64DecodeWebSafe(String(a));y=Utilities.base64DecodeWebSafe(String(b));}
  catch(_){return false;}
  if(!x.length||!y.length)return false;
  var diff=x.length^y.length, n=Math.max(x.length,y.length);
  for(var i=0;i<n;i++) diff|=(x[i%x.length]||0)^(y[i%y.length]||0);
  return diff===0;
}
function oiIssueSession_(office,now){
  var p={officeId:office.id,sessionVersion:Number(office.sessionVersion||1),issuedAt:now,expiresAt:now+8*60*60*1000};
  var body=Utilities.base64EncodeWebSafe(JSON.stringify(p)).replace(/=+$/,'');
  return body+'.'+oiMac_(body);
}

function oiConfig_() {
  var raw = PropertiesService.getScriptProperties().getProperty('OFFICE_CONFIG_JSON') || '';
  if (!raw) return { offices: [] };
  try {
    var config = JSON.parse(raw);
    return config && Array.isArray(config.offices) ? config : { offices: [] };
  } catch (_) { return { offices: [] }; }
}
function oiOfficeActive_(office) { return !!office && office.enabled !== false && office.disabled !== true; }
function oiOfficeBySlug_(slug) {
  var offices = oiConfig_().offices;
  for (var i = 0; i < offices.length; i++) if (String(offices[i].slug || '') === slug) return offices[i];
  return null;
}
function oiOfficeById_(id) {
  var offices = oiConfig_().offices;
  for (var i = 0; i < offices.length; i++) if (String(offices[i].id || '') === id) return offices[i];
  return null;
}
function oiPublicOffice_(office) {
  return { id: String(office.id || ''), slug: String(office.slug || ''), complexName: String(office.complexName || '') };
}
function oiInvalidCredentials_() { return { ok: false, error: 'invalid-credentials', message: '관리사무소 코드 또는 비밀번호가 올바르지 않습니다' }; }

function oiLogin_(payload, now) {
  if (PropertiesService.getScriptProperties().getProperty('OFFICE_INTAKE_ENABLED') !== '1') {
    return { ok: false, error: 'office-disabled', message: '관리사무소 접수가 현재 비활성화되어 있습니다' };
  }
  payload = payload && typeof payload === 'object' ? payload : {};
  var slug = oiText_(payload.slug, 80);
  var cache = CacheService.getScriptCache();
  var key = 'oi-login:' + slug;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (Number(cache.get(key) || 0) >= OI_LOGIN_LIMIT) {
      var limitedStore = oiReadStore_();
      oiAuditLocked_(limitedStore, '', '', 'login', 'rate-limited', now);
      oiWriteStore_(limitedStore);
      return { ok: false, error: 'rate-limited', message: '잠시 후 다시 시도하세요' };
    }

    var office = oiOfficeBySlug_(slug);
    var pin = String(payload.pin == null ? '' : payload.pin);
    var pinFormatValid = /^\d{6}$/.test(pin);
    var credential = oiOfficeActive_(office) ? office : { pinSalt: OI_DUMMY_PIN_SALT, pinHash: OI_DUMMY_PIN_HASH };
    var matches = oiSafeEqual_(oiHashPin_(pinFormatValid ? pin : '000000', credential.pinSalt), credential.pinHash);
    var valid = pinFormatValid && matches && oiOfficeActive_(office);
    if (!valid) {
      cache.put(key, String(Number(cache.get(key) || 0) + 1), OI_LOGIN_WINDOW_SECONDS);
      var failedStore = oiReadStore_();
      oiAuditLocked_(failedStore, office ? office.id : '', '', 'login', 'invalid-credentials', now);
      oiWriteStore_(failedStore);
      return oiInvalidCredentials_();
    }
    cache.remove(key);
    var successStore = oiReadStore_();
    oiAuditLocked_(successStore, office.id, '', 'login', 'ok', now);
    oiWriteStore_(successStore);
    return { ok: true, office: oiPublicOffice_(office), sessionToken: oiIssueSession_(office, Number(now)) };
  } finally {
    lock.releaseLock();
  }
}

function oiVerifySession_(token, now) {
  try {
    var parts = String(token || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1] || !oiSafeEqual_(oiMac_(parts[0]), parts[1])) return null;
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'));
    var keys = Object.keys(payload || {}).sort();
    if (keys.join(',') !== 'expiresAt,issuedAt,officeId,sessionVersion') return null;
    if (typeof payload.officeId !== 'string' || typeof payload.sessionVersion !== 'number' || typeof payload.issuedAt !== 'number' || typeof payload.expiresAt !== 'number') return null;
    if (!isFinite(payload.sessionVersion) || !isFinite(payload.issuedAt) || !isFinite(payload.expiresAt) || !isFinite(now)) return null;
    if (payload.expiresAt - payload.issuedAt !== 8 * 60 * 60 * 1000 || payload.issuedAt > now || now >= payload.expiresAt) return null;
    var office = oiOfficeById_(payload.officeId);
    if (!oiOfficeActive_(office) || Number(office.sessionVersion || 1) !== payload.sessionVersion) return null;
    return { officeId: payload.officeId, office: office };
  } catch (_) { return null; }
}

function oiHandlePublicAction_(action, req) {
  var payload = req && req.payload && typeof req.payload === 'object' ? req.payload : {};
  if (action === 'officeLogin') return oiLogin_(payload, Date.now());
  var session = oiVerifySession_((req && req.sessionToken) || payload.sessionToken, Date.now());
  if (!session) return { ok: false, error: 'session-expired', message: '로그인 세션이 만료되었습니다' };
  if (action === 'officeList') return oiList_(session, payload);
  if (action === 'officeGet') return oiGet_(session, payload.requestId);
  if (action === 'officeCreate') return oiCreate_(session, payload, Date.now());
  if (action === 'officeUpdate') return oiUpdate_(session, payload, Date.now());
  if (action === 'officeCancel') return oiCancel_(session, payload, Date.now());
  if (action === 'officeUpload') return oiUpload_(session, payload, Date.now());
  return { ok: false, error: 'bad-request', message: '아직 지원하지 않는 관리사무소 action입니다' };
}

var OI_STORE_VERSION = 1;
var OI_MAX_PHOTOS = 5;
var OI_MAX_PHOTO_BYTES = 2 * 1024 * 1024;
var OI_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function oiStoreName_() {
  return PropertiesService.getScriptProperties().getProperty('OFFICE_STORE_FILE') || '관리사무소접수.json';
}
function oiStoreRoot_() { return rootFolder_(); }
function oiStoreFile_(root) {
  var files = root.getFilesByName(oiStoreName_());
  return files.hasNext() ? files.next() : null;
}
function oiEmptyStore_() { return { version: OI_STORE_VERSION, requests: [], audit: [], operationalErrors: [] }; }
function oiReadStore_() {
  var file = oiStoreFile_(oiStoreRoot_());
  if (!file) return oiEmptyStore_();
  var store = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if (!store || store.version !== OI_STORE_VERSION || !Array.isArray(store.requests)) throw new Error('office-store-corrupt');
  if (!Array.isArray(store.audit)) store.audit = [];
  if (!Array.isArray(store.operationalErrors)) store.operationalErrors = [];
  return store;
}
function oiWriteStore_(store) {
  if (!store || store.version !== OI_STORE_VERSION || !Array.isArray(store.requests)) throw new Error('office-store-invalid');
  if (!Array.isArray(store.audit)) store.audit = [];
  if (!Array.isArray(store.operationalErrors)) store.operationalErrors = [];
  var root = oiStoreRoot_();
  var file = oiStoreFile_(root);
  var content = JSON.stringify(store);
  if (file) file.setContent(content);
  else root.createFile(oiStoreName_(), content, 'application/json');
}
function oiSessionOfficeId_(session) { return String(session && session.officeId || ''); }
function oiOwnRequest_(store, officeId, requestId) {
  requestId = String(requestId || '');
  for (var i = 0; i < store.requests.length; i++) {
    var request = store.requests[i];
    if (request.officeId === officeId && request.requestId === requestId) return request;
  }
  return null;
}
function oiRequestById_(store, requestId) {
  requestId = String(requestId || '');
  for (var i = 0; i < store.requests.length; i++) if (store.requests[i].requestId === requestId) return store.requests[i];
  return null;
}
function oiNow_(now) { return new Date(Number(now)).toISOString(); }
function oiReceiptDay_(now) {
  return Utilities.formatDate(new Date(Number(now)), Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyyMMdd');
}
function oiCreateResult_(request) {
  return { ok: true, requestId: request.requestId, receiptNo: request.receiptNo, status: request.status, createdAt: request.createdAt };
}
function oiPublicRequest_(request) {
  return {
    requestId: request.requestId,
    receiptNo: request.receiptNo,
    unit: request.unit,
    location: request.location,
    issueType: request.issueType,
    pipeType: request.pipeType,
    urgency: request.urgency,
    description: request.description,
    officeContact: request.officeContact,
    residentContact: request.residentContact || null,
    preferredVisitDate: request.preferredVisitDate || '',
    photos: (request.photos || []).map(function (photo) {
      return { fileId: photo.fileId, name: photo.name, mimeType: photo.mimeType, size: photo.size, createdAt: photo.createdAt };
    }),
    status: request.status,
    publicAmount: request.publicAmount == null ? null : request.publicAmount,
    visitAt: request.visitAt || null,
    completionReport: request.completionReport ? { summary: oiText_(request.completionReport.summary, 800), publicPhotoIds: oiCompletionPhotoIds_(request.completionReport.publicPhotoIds) || [] } : null,
    needsInfoReason: request.needsInfoReason || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}
function oiOfficeEnabled_() { return PropertiesService.getScriptProperties().getProperty('OFFICE_INTAKE_ENABLED') === '1'; }
function oiOfficeMutable_(request) { return request.status === 'pending_review' || request.status === 'needs_info'; }

function oiAuditLocked_(store, officeId, receiptNo, action, result, now) {
  store.audit = Array.isArray(store.audit) ? store.audit : [];
  store.audit.push({
    officeId: oiText_(officeId, 120), receiptNo: oiText_(receiptNo, 80),
    action: oiText_(action, 40), result: oiText_(result, 80), at: oiNow_(now)
  });
  if (store.audit.length > 1000) store.audit = store.audit.slice(-1000);
}
function oiAudit_(officeId, receiptNo, action, result, now) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    oiAuditLocked_(store, officeId, receiptNo, action, result, now);
    oiWriteStore_(store);
  } finally { lock.releaseLock(); }
}
function oiOperationalErrorLocked_(store, code, requestId, now) {
  store.operationalErrors = Array.isArray(store.operationalErrors) ? store.operationalErrors : [];
  store.operationalErrors.push({ code: oiText_(code, 60), requestId: oiText_(requestId, 120), at: oiNow_(now) });
  if (store.operationalErrors.length > 100) store.operationalErrors = store.operationalErrors.slice(-100);
}
function oiOperationalError_(code, requestId, now) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    oiOperationalErrorLocked_(store, code, requestId, now);
    oiWriteStore_(store);
  } finally { lock.releaseLock(); }
}

function oiCreate_(session, payload, now) {
  if (!oiOfficeEnabled_()) return { ok: false, error: 'office-disabled' };
  var validated = oiValidateCreate_(payload);
  if (!validated.ok) return validated;
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var createdRequest = null;
  try {
    var store = oiReadStore_();
    for (var i = 0; i < store.requests.length; i++) {
      var existing = store.requests[i];
      if (existing.officeId === officeId && existing.idempotencyKey === validated.value.idempotencyKey) return oiCreateResult_(existing);
    }
    var day = oiReceiptDay_(now);
    var receiptKey = 'OFFICE_RECEIPT_' + day;
    var props = PropertiesService.getScriptProperties();
    var sequence = Number(props.getProperty(receiptKey) || 0) + 1;
    props.setProperty(receiptKey, String(sequence));
    var at = oiNow_(now);
    var request = {
      requestId: Utilities.getUuid(),
      receiptNo: oiReceiptNo_(day, sequence),
      officeId: officeId,
      idempotencyKey: validated.value.idempotencyKey,
      unit: validated.value.unit,
      location: validated.value.location,
      issueType: validated.value.issueType,
      pipeType: validated.value.pipeType,
      urgency: validated.value.urgency,
      description: validated.value.description,
      officeContact: validated.value.officeContact,
      residentContact: validated.value.residentContact,
      preferredVisitDate: validated.value.preferredVisitDate,
      photos: [],
      status: 'pending_review',
      hyeonjangOrderId: null,
      publicAmount: null,
      visitAt: null,
      completionReport: null,
      needsInfoReason: null,
      createdAt: at,
      updatedAt: at
    };
    store.requests.push(request);
    oiAuditLocked_(store, officeId, request.receiptNo, 'create', 'ok', now);
    oiWriteStore_(store);
    createdRequest = request;
    return oiCreateResult_(request);
  } finally {
    lock.releaseLock();
    if (createdRequest && createdRequest.urgency === 'urgent') oiNotifyUrgent_(createdRequest);
  }
}

function oiList_(session, payload) {
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  var requests = oiReadStore_().requests.filter(function (request) { return request.officeId === officeId; });
  requests.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return { ok: true, requests: requests.slice(0, 50).map(oiPublicRequest_) };
}
function oiGet_(session, requestId) {
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  var request = oiOwnRequest_(oiReadStore_(), officeId, requestId);
  return request ? { ok: true, request: oiPublicRequest_(request) } : { ok: false, error: 'not-found' };
}
function oiUpdate_(session, payload, now) {
  if (!oiOfficeEnabled_()) return { ok: false, error: 'office-disabled' };
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  payload = payload && typeof payload === 'object' ? payload : {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    var request = oiOwnRequest_(store, officeId, payload.requestId);
    if (!request) return { ok: false, error: 'not-found' };
    if (!oiOfficeMutable_(request)) return { ok: false, error: 'invalid-status' };
    var source = {
      idempotencyKey: request.idempotencyKey,
      unit: payload.unit == null ? request.unit : payload.unit,
      location: payload.location == null ? request.location : payload.location,
      issueType: payload.issueType == null ? request.issueType : payload.issueType,
      pipeType: payload.pipeType == null ? request.pipeType : payload.pipeType,
      urgency: payload.urgency == null ? request.urgency : payload.urgency,
      description: payload.description == null ? request.description : payload.description,
      officeContact: payload.officeContact == null ? request.officeContact : payload.officeContact,
      residentContact: Object.prototype.hasOwnProperty.call(payload, 'residentContact') ? payload.residentContact : request.residentContact,
      preferredVisitDate: payload.preferredVisitDate == null ? request.preferredVisitDate : payload.preferredVisitDate,
      privacyConsent: payload.privacyConsent == null ? true : payload.privacyConsent
    };
    var validated = oiValidateCreate_(source);
    if (!validated.ok) return validated;
    var value = validated.value;
    request.unit = value.unit;
    request.location = value.location;
    request.issueType = value.issueType;
    request.pipeType = value.pipeType;
    request.urgency = value.urgency;
    request.description = value.description;
    request.officeContact = value.officeContact;
    request.residentContact = value.residentContact;
    request.preferredVisitDate = value.preferredVisitDate;
    if (request.status === 'needs_info') { request.status = 'pending_review'; request.needsInfoReason = null; }
    request.updatedAt = oiNow_(now);
    oiAuditLocked_(store, officeId, request.receiptNo, 'update', 'ok', now);
    oiWriteStore_(store);
    return { ok: true, requestId: request.requestId, status: request.status, updatedAt: request.updatedAt };
  } finally {
    lock.releaseLock();
  }
}
function oiCancel_(session, payload, now) {
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  payload = payload && typeof payload === 'object' ? payload : {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    var request = oiOwnRequest_(store, officeId, payload.requestId);
    if (!request) return { ok: false, error: 'not-found' };
    if (!oiOfficeMutable_(request)) return { ok: false, error: 'invalid-status' };
    request.status = 'cancelled';
    request.updatedAt = oiNow_(now);
    oiAuditLocked_(store, officeId, request.receiptNo, 'cancel', 'ok', now);
    oiWriteStore_(store);
    return { ok: true, requestId: request.requestId, status: request.status, updatedAt: request.updatedAt };
  } finally {
    lock.releaseLock();
  }
}

function oiByte_(bytes, index) { return Number(bytes[index]) & 255; }
function oiImageMagicValid_(mimeType, bytes) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && oiByte_(bytes, 0) === 0xFF && oiByte_(bytes, 1) === 0xD8 && oiByte_(bytes, 2) === 0xFF;
  if (mimeType === 'image/png') return bytes.length >= 4 && oiByte_(bytes, 0) === 0x89 && oiByte_(bytes, 1) === 0x50 && oiByte_(bytes, 2) === 0x4E && oiByte_(bytes, 3) === 0x47;
  if (mimeType === 'image/webp') return bytes.length >= 12 && oiByte_(bytes, 0) === 0x52 && oiByte_(bytes, 1) === 0x49 && oiByte_(bytes, 2) === 0x46 && oiByte_(bytes, 3) === 0x46 && oiByte_(bytes, 8) === 0x57 && oiByte_(bytes, 9) === 0x45 && oiByte_(bytes, 10) === 0x42 && oiByte_(bytes, 11) === 0x50;
  return false;
}
function oiRequestPhotoFolder_(officeId, receiptNo) {
  var office = oiOfficeById_(officeId);
  if (!office || !oiText_(office.slug, 80)) throw new Error('office-not-found');
  var root = oiStoreRoot_();
  return subFolder_(subFolder_(subFolder_(root, '관리사무소접수'), oiText_(office.slug, 80)), receiptNo);
}
function oiUpload_(session, payload, now) {
  if (!oiOfficeEnabled_()) return { ok: false, error: 'office-disabled' };
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  payload = payload && typeof payload === 'object' ? payload : {};
  var mimeType = String(payload.mimeType || '');
  if (!Object.prototype.hasOwnProperty.call(OI_IMAGE_TYPES, mimeType)) return { ok: false, error: 'unsupported-type' };
  var bytes;
  try { bytes = Utilities.base64Decode(String(payload.dataB64 || '')); }
  catch (_) { return { ok: false, error: 'invalid-file' }; }
  if (bytes.length > OI_MAX_PHOTO_BYTES) return { ok: false, error: 'too-large' };
  if (!oiImageMagicValid_(mimeType, bytes)) return { ok: false, error: 'invalid-file' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    var request = oiOwnRequest_(store, officeId, payload.requestId);
    if (!request) return { ok: false, error: 'not-found' };
    request.photos = Array.isArray(request.photos) ? request.photos : [];
    if (request.photos.length >= OI_MAX_PHOTOS) return { ok: false, error: 'too-many-files' };
    var number = request.photos.length + 1;
    var name = request.receiptNo + '_0' + number + OI_IMAGE_TYPES[mimeType];
    var file = oiRequestPhotoFolder_(officeId, request.receiptNo).createFile(Utilities.newBlob(bytes, mimeType, name));
    var createdAt = oiNow_(now);
    var photo = { fileId: file.getId(), name: name, mimeType: mimeType, size: bytes.length, createdAt: createdAt };
    request.photos.push(photo);
    request.updatedAt = createdAt;
    oiAuditLocked_(store, officeId, request.receiptNo, 'upload', 'ok', now);
    try {
      oiWriteStore_(store);
    } catch (err) {
      try { file.setTrashed(true); } catch (_) {}
      throw err;
    }
    return { ok: true, fileId: photo.fileId, name: photo.name, mimeType: photo.mimeType, size: photo.size, createdAt: photo.createdAt };
  } finally {
    lock.releaseLock();
  }
}

function oiInbox_(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var cursor = oiInboxCursor_(payload.updatedAfter);
  var now = Date.now();
  var store = oiReadStore_();
  var retryAt = {};
  store.operationalErrors.forEach(function (error) {
    if (oiIsSyncError_(error) && !error.resolvedAt) {
      var id = String(error.requestId);
      var errorAt = oiTime_(error.at);
      if (!Object.prototype.hasOwnProperty.call(retryAt, id) || errorAt > retryAt[id]) retryAt[id] = errorAt;
    }
  });
  var rows = store.requests.map(function (request) {
    var requestId = String(request.requestId || ''), hasRetry = Object.prototype.hasOwnProperty.call(retryAt, requestId);
    var errorAt = hasRetry ? retryAt[requestId] : -Infinity;
    var updatedAt = oiTime_(request.updatedAt);
    var effectiveAt = updatedAt > errorAt ? updatedAt : errorAt;
    var actionable = request.status === 'pending_review' || request.status === 'needs_info' || hasRetry;
    return { request: request, effectiveAt: effectiveAt, actionable: actionable };
  }).filter(function (row) {
    return row.actionable && oiTupleCompare_(row.effectiveAt, row.request.requestId, cursor.at, cursor.id) > 0;
  }).sort(function (a, b) {
    return oiTupleCompare_(a.effectiveAt, a.request.requestId, b.effectiveAt, b.request.requestId);
  }).slice(0, 100);
  var requests = rows.map(function (row) {
    var request = row.request;
    var copy = {};
    Object.keys(request).forEach(function (key) { copy[key] = request[key]; });
    copy.overdue = request.status === 'pending_review' && isFinite(Date.parse(request.createdAt || '')) && now - Date.parse(request.createdAt) >= 24 * 60 * 60 * 1000;
    return copy;
  });
  var next = rows.length ? oiInboxCursorEncode_(rows[rows.length - 1].effectiveAt, rows[rows.length - 1].request.requestId) : cursor.raw;
  return { ok: true, requests: requests, cursor: next, operationalErrors: store.operationalErrors.slice(-100) };
}
function oiTime_(value) { var time = Date.parse(String(value || '')); return isFinite(time) ? time : -Infinity; }
function oiTupleCompare_(leftAt, leftId, rightAt, rightId) {
  if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
  leftId = String(leftId || ''); rightId = String(rightId || '');
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}
function oiInboxCursorEncode_(at, requestId) {
  return 'oi1.' + Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify([at, String(requestId || '')])).getBytes());
}
function oiInboxCursor_(value) {
  var raw = String(value == null ? '' : value).slice(0, 200);
  if (!raw) return { at: -Infinity, id: '', raw: '' };
  if (raw.indexOf('oi1.') === 0) {
    try {
      var tuple = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(raw.slice(4))).getDataAsString());
      if (Array.isArray(tuple) && tuple.length === 2 && typeof tuple[0] === 'number' && isFinite(tuple[0]) && typeof tuple[1] === 'string') return { at: tuple[0], id: tuple[1], raw: raw };
    } catch (_) {}
    return { at: -Infinity, id: '', raw: '' };
  }
  var legacy = oiTime_(raw);
  return { at: legacy, id: '', raw: raw };
}

var OI_SYNC_ERROR_CODES = ['already-linked', 'accept-invalid-transition', 'invalid-transition'];
function oiIsSyncError_(error) { return !!(error && OI_SYNC_ERROR_CODES.indexOf(String(error.code || '')) >= 0 && error.requestId); }
function oiResolveSyncErrors_(store, requestId, codes, now) {
  var changed = false, at = oiNow_(now);
  store.operationalErrors.forEach(function (error) {
    if (!error || error.resolvedAt || String(error.requestId || '') !== String(requestId || '')) return;
    if (codes.indexOf(String(error.code || '')) < 0) return;
    error.resolvedAt = at;
    changed = true;
  });
  return changed;
}

function oiAccept_(payload, now) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var orderId = oiText_(payload.hyeonjangOrderId, 120);
  if (!orderId) return { ok: false, error: 'invalid-input' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    var request = oiRequestById_(store, payload.requestId);
    if (!request) return { ok: false, error: 'not-found' };
    if (request.hyeonjangOrderId) {
      if (request.hyeonjangOrderId !== orderId) {
        oiOperationalErrorLocked_(store, 'already-linked', request.requestId, now);
        oiWriteStore_(store);
        return { ok: false, error: 'already-linked' };
      }
      if (oiResolveSyncErrors_(store, request.requestId, ['already-linked', 'accept-invalid-transition'], now)) oiWriteStore_(store);
      return { ok: true, requestId: request.requestId, hyeonjangOrderId: request.hyeonjangOrderId, status: request.status };
    }
    if (!oiCanTransition_(request.status, 'accepted', 'internal')) {
      oiOperationalErrorLocked_(store, 'accept-invalid-transition', request.requestId, now);
      oiWriteStore_(store);
      return { ok: false, error: 'invalid-transition' };
    }
    request.hyeonjangOrderId = orderId;
    request.status = 'accepted';
    request.needsInfoReason = null;
    request.updatedAt = oiNow_(now);
    oiResolveSyncErrors_(store, request.requestId, ['already-linked', 'accept-invalid-transition'], now);
    oiAuditLocked_(store, request.officeId, request.receiptNo, 'accept', 'ok', now);
    oiWriteStore_(store);
    return { ok: true, requestId: request.requestId, hyeonjangOrderId: orderId, status: request.status };
  } finally { lock.releaseLock(); }
}

function oiStatusResult_(request) {
  return {
    ok: true, requestId: request.requestId, receiptNo: request.receiptNo, status: request.status,
    visitAt: request.visitAt || null, publicAmount: request.publicAmount == null ? null : request.publicAmount,
    completionReport: request.completionReport || null, needsInfoReason: request.needsInfoReason || null, updatedAt: request.updatedAt
  };
}
function oiCompletionPhotoIds_(value) {
  if (!Array.isArray(value)) return null;
  var ids = [], seen = {};
  for (var i = 0; i < value.length && ids.length < 10; i++) {
    if (typeof value[i] !== 'string') continue;
    var id = String(value[i]).trim();
    if (id.length > 120) continue;
    if (id && !seen[id]) { seen[id] = true; ids.push(id); }
  }
  return ids.sort();
}
function oiCompletionReportValue_(request, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'invalid-input' };
  var hasSupplied = Object.prototype.hasOwnProperty.call(value, 'photoIds');
  var supplied = hasSupplied ? oiCompletionPhotoIds_(value.photoIds) : [];
  var published = Object.prototype.hasOwnProperty.call(value, 'publicPhotoIds') ? oiCompletionPhotoIds_(value.publicPhotoIds) : [];
  if (supplied == null || published == null) return { ok: false, error: 'invalid-input' };
  var owned = {}; (request.photos || []).forEach(function (photo) { var id = String(photo && photo.fileId || '').trim(); if (id) owned[id] = true; });
  supplied = supplied.filter(function (id) { return owned[id]; });
  if (published.length && (!hasSupplied || !supplied.length)) return { ok: false, error: 'invalid-completion-photos' };
  var allowed = {};
  supplied.forEach(function (id) { allowed[id] = true; });
  published = published.filter(function (id) { return allowed[id]; });
  // `photoIds` is the intake-owned available set. Keep it with the report so a
  // lost successful reply can be retried as the same projection; only the
  // explicitly selected `publicPhotoIds` are public.
  return { ok: true, value: { summary: oiText_(value.summary, 800), photoIds: supplied, publicPhotoIds: published } };
}
function oiHas_(value, key) { return Object.prototype.hasOwnProperty.call(value || {}, key); }
function oiPublicAmount_(request, payload) {
  if (!oiHas_(payload, 'publicAmount')) return { ok: true, value: request.publicAmount == null ? null : request.publicAmount };
  var value = payload.publicAmount;
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string') {
    value = value.trim();
    if (!value) return { ok: false, error: 'invalid-input', field: 'publicAmount' };
  } else if (typeof value !== 'number') return { ok: false, error: 'invalid-input', field: 'publicAmount' };
  var amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'invalid-input', field: 'publicAmount' };
  return { ok: true, value: amount };
}
function oiNeedsInfoReason_(request, payload, next) {
  if (next === 'needs_info') {
    var reason = String(payload.reason == null ? '' : payload.reason).trim();
    return reason && reason.length <= 300 ? { ok: true, value: reason } : { ok: false, error: 'invalid-input', field: 'reason' };
  }
  return { ok: true, value: next === 'on_hold' && (request.status === 'needs_info' || request.status === 'on_hold') ? (oiText_(request.needsInfoReason, 300) || null) : null };
}
function oiStatusProjection_(request, payload, completion, next) {
  var amount = oiPublicAmount_(request, payload);
  if (!amount.ok) return amount;
  var reason = oiNeedsInfoReason_(request, payload, next);
  if (!reason.ok) return reason;
  return { ok: true, value: {
    visitAt: oiHas_(payload, 'visitAt') ? (payload.visitAt || request.visitAt || null) : (request.visitAt || null),
    publicAmount: amount.value,
    completionReport: completion ? completion.value : (request.completionReport || null),
    needsInfoReason: reason.value
  }};
}
function oiSameStatusProjection_(request, projection) {
  return (request.visitAt || null) === projection.visitAt &&
    (request.publicAmount == null ? null : request.publicAmount) === projection.publicAmount &&
    JSON.stringify(request.completionReport || null) === JSON.stringify(projection.completionReport || null) &&
    (request.needsInfoReason || null) === projection.needsInfoReason;
}
function oiSetStatus_(payload, now) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var next = oiText_(payload.status, 40);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = oiReadStore_();
    var request = oiRequestById_(store, payload.requestId);
    if (!request) return { ok: false, error: 'not-found' };
    var completion = payload.completionReport ? oiCompletionReportValue_(request, payload.completionReport) : null;
    if (completion && !completion.ok) return { ok: false, error: completion.error };
    var projected = oiStatusProjection_(request, payload, completion, next);
    if (!projected.ok) return projected;
    var projection = projected.value;
    if (request.status === next) {
      if (!oiSameStatusProjection_(request, projection)) {
        oiOperationalErrorLocked_(store, 'invalid-transition', request.requestId, now);
        oiWriteStore_(store);
        return { ok: false, error: 'invalid-transition' };
      }
      if (oiResolveSyncErrors_(store, request.requestId, ['invalid-transition'], now)) oiWriteStore_(store);
      return oiStatusResult_(request);
    }
    if (!oiCanTransition_(request.status, next, 'internal')) {
      oiOperationalErrorLocked_(store, 'invalid-transition', request.requestId, now);
      oiWriteStore_(store);
      return { ok: false, error: 'invalid-transition' };
    }
    request.status = next;
    request.visitAt = projection.visitAt;
    request.publicAmount = projection.publicAmount;
    request.completionReport = projection.completionReport;
    request.needsInfoReason = projection.needsInfoReason;
    if (next === 'completed' && !request.completedAt) request.completedAt = oiNow_(now);
    request.updatedAt = oiNow_(now);
    oiResolveSyncErrors_(store, request.requestId, ['invalid-transition'], now);
    oiAuditLocked_(store, request.officeId, request.receiptNo, 'status', 'ok', now);
    oiWriteStore_(store);
    return oiStatusResult_(request);
  } finally { lock.releaseLock(); }
}

function oiRestoreConfig_(properties, raw) {
  if (raw == null) properties.deleteProperty('OFFICE_CONFIG_JSON');
  else properties.setProperty('OFFICE_CONFIG_JSON', raw);
}
function oiSameRawConfig_(a, b) { return a === b; }
function oiCommitAdminConfig_(properties, previousRaw, stagedRaw, writeAudit, stagedResult) {
  try {
    properties.setProperty('OFFICE_CONFIG_JSON', stagedRaw);
    writeAudit();
    return stagedResult();
  } catch (original) {
    try { oiRestoreConfig_(properties, previousRaw); } catch (_) {}
    var currentRaw = properties.getProperty('OFFICE_CONFIG_JSON');
    if (oiSameRawConfig_(currentRaw, previousRaw)) throw original;
    if (oiSameRawConfig_(currentRaw, stagedRaw)) {
      var partial = stagedResult();
      partial.warning = 'audit-failed';
      return partial;
    }
    return { ok: false, error: 'admin-state-unknown' };
  }
}
function oiAdminUpsert_(payload, now) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var id = oiText_(payload.id, 120);
  var slug = oiText_(payload.slug, 80);
  var complexName = oiText_(payload.complexName, 120);
  if (!id || !slug || !complexName) return { ok: false, error: 'invalid-input' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var previousConfig = properties.getProperty('OFFICE_CONFIG_JSON');
    var config = oiConfig_();
    var office = null;
    for (var i = 0; i < config.offices.length; i++) if (String(config.offices[i].id || '') === id) office = config.offices[i];
    for (var j = 0; j < config.offices.length; j++) {
      if (String(config.offices[j].id || '') !== id && String(config.offices[j].slug || '') === slug) return { ok: false, error: 'slug-conflict' };
    }
    if (!office) { office = { id: id, sessionVersion: 1 }; config.offices.push(office); }
    var wasActive = oiOfficeActive_(office);
    office.slug = slug;
    office.complexName = complexName;
    if (Object.prototype.hasOwnProperty.call(payload, 'enabled')) { office.enabled = payload.enabled !== false; office.disabled = office.enabled === false; }
    if (wasActive && !oiOfficeActive_(office)) office.sessionVersion = Number(office.sessionVersion || 1) + 1;
    office.updatedAt = oiNow_(now);
    var stagedConfig = JSON.stringify(config);
    return oiCommitAdminConfig_(properties, previousConfig, stagedConfig, function () {
      var store = oiReadStore_(); oiAuditLocked_(store, office.id, '', 'admin-upsert', 'ok', now); oiWriteStore_(store);
    }, function () { return { ok: true, office: oiPublicOffice_(office) }; });
  } finally { lock.releaseLock(); }
}
function oiPinFromUuid_(uuid) {
  var text = String(uuid || '');
  var n = 0;
  for (var i = 0; i < text.length; i++) n = ((n * 31) + text.charCodeAt(i)) >>> 0;
  return ('000000' + String(n % 1000000)).slice(-6);
}
function oiRotatePin_(payload, now) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var officeId = oiText_(payload.officeId || payload.id, 120);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var previousConfig = properties.getProperty('OFFICE_CONFIG_JSON');
    var config = oiConfig_();
    var office = null;
    for (var i = 0; i < config.offices.length; i++) if (String(config.offices[i].id || '') === officeId) office = config.offices[i];
    if (!office) return { ok: false, error: 'not-found' };
    var pinEntropy = Utilities.getUuid();
    var pin = oiPinFromUuid_(pinEntropy);
    office.pinSalt = String(Utilities.getUuid());
    office.pinHash = oiHashPin_(pin, office.pinSalt);
    office.sessionVersion = Number(office.sessionVersion || 1) + 1;
    office.updatedAt = oiNow_(now);
    var stagedConfig = JSON.stringify(config);
    return oiCommitAdminConfig_(properties, previousConfig, stagedConfig, function () {
      var store = oiReadStore_(); oiAuditLocked_(store, office.id, '', 'pin-rotate', 'ok', now); oiWriteStore_(store);
    }, function () { return { ok: true, office: oiPublicOffice_(office), pin: pin }; });
  } finally { lock.releaseLock(); }
}
function oiDisable_(payload, now) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var officeId = oiText_(payload.officeId || payload.id, 120);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var previousConfig = properties.getProperty('OFFICE_CONFIG_JSON');
    var config = oiConfig_();
    var office = null;
    for (var i = 0; i < config.offices.length; i++) if (String(config.offices[i].id || '') === officeId) office = config.offices[i];
    if (!office) return { ok: false, error: 'not-found' };
    office.enabled = false;
    office.disabled = true;
    office.sessionVersion = Number(office.sessionVersion || 1) + 1;
    office.updatedAt = oiNow_(now);
    var stagedConfig = JSON.stringify(config);
    return oiCommitAdminConfig_(properties, previousConfig, stagedConfig, function () {
      var store = oiReadStore_(); oiAuditLocked_(store, office.id, '', 'disable', 'ok', now); oiWriteStore_(store);
    }, function () { return { ok: true, office: oiPublicOffice_(office) }; });
  } finally { lock.releaseLock(); }
}

function oiRetentionCandidates_(now) {
  now = Number(now);
  if (!isFinite(now)) return [];
  var ninetyDays = 90 * 24 * 60 * 60 * 1000;
  var oneYear = 365 * 24 * 60 * 60 * 1000;
  var candidates = [];
  oiReadStore_().requests.forEach(function (request) {
    if (request.legalRetention === true) return;
    var at = (request.status === 'completed' || request.status === 'billed' || request.status === 'paid') ? request.completedAt : request.updatedAt;
    var eligibleAt = Date.parse(at || '');
    var reason = '';
    if (request.status === 'cancelled' || request.status === 'declined') { eligibleAt += ninetyDays; reason = 'cancelled-90-days'; }
    else if (request.status === 'completed' || request.status === 'billed' || request.status === 'paid') { eligibleAt += oneYear; reason = 'completed-1-year'; }
    else return;
    if (isFinite(eligibleAt) && now >= eligibleAt) candidates.push({
      requestId: request.requestId, receiptNo: request.receiptNo, officeId: request.officeId,
      status: request.status, retentionReason: reason, eligibleAt: new Date(eligibleAt).toISOString()
    });
  });
  candidates.sort(function (a, b) { return String(a.eligibleAt).localeCompare(String(b.eligibleAt)); });
  return candidates;
}

function oiNotifyUrgent_(request) {
  if (!request || request.urgency !== 'urgent') return { ok: true };
  try {
    var office = oiOfficeById_(request.officeId);
    var title = '[긴급 관리사무소 접수] ' + oiText_(office && office.complexName, 120) + ' ' + oiText_(request.location, 120);
    var start = new Date();
    CalendarApp.getDefaultCalendar().createEvent(title, start, new Date(start.getTime() + 30 * 60 * 1000));
    return { ok: true };
  } catch (_) {
    try { oiOperationalError_('calendar-failed', request && request.requestId, Date.now()); } catch (_) {}
    return { ok: false, error: 'calendar-failed' };
  }
}

function oiHandleInternalAction_(action, req) {
  var payload = req && req.payload && typeof req.payload === 'object' ? req.payload : {};
  var now = Date.now();
  if (action === 'officeInbox') return oiInbox_(payload);
  if (action === 'officeAccept') return oiAccept_(payload, now);
  if (action === 'officeSetStatus') return oiSetStatus_(payload, now);
  if (action === 'officeAdminUpsert') return oiAdminUpsert_(payload, now);
  if (action === 'officeRotatePin') return oiRotatePin_(payload, now);
  if (action === 'officeDisable') return oiDisable_(payload, now);
  if (action === 'officeRetentionList') return { ok: true, requests: oiRetentionCandidates_(now) };
  return { ok: false, error: 'bad-request' };
}

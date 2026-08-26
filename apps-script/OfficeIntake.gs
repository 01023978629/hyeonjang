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
    if (Number(cache.get(key) || 0) >= OI_LOGIN_LIMIT) return { ok: false, error: 'rate-limited', message: '잠시 후 다시 시도하세요' };

    var office = oiOfficeBySlug_(slug);
    var pin = String(payload.pin == null ? '' : payload.pin);
    var pinFormatValid = /^\d{6}$/.test(pin);
    var credential = oiOfficeActive_(office) ? office : { pinSalt: OI_DUMMY_PIN_SALT, pinHash: OI_DUMMY_PIN_HASH };
    var matches = oiSafeEqual_(oiHashPin_(pinFormatValid ? pin : '000000', credential.pinSalt), credential.pinHash);
    var valid = pinFormatValid && matches && oiOfficeActive_(office);
    if (!valid) {
      cache.put(key, String(Number(cache.get(key) || 0) + 1), OI_LOGIN_WINDOW_SECONDS);
      return oiInvalidCredentials_();
    }
    cache.remove(key);
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
function oiEmptyStore_() { return { version: OI_STORE_VERSION, requests: [] }; }
function oiReadStore_() {
  var file = oiStoreFile_(oiStoreRoot_());
  if (!file) return oiEmptyStore_();
  var store = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if (!store || store.version !== OI_STORE_VERSION || !Array.isArray(store.requests)) throw new Error('office-store-corrupt');
  return store;
}
function oiWriteStore_(store) {
  if (!store || store.version !== OI_STORE_VERSION || !Array.isArray(store.requests)) throw new Error('office-store-invalid');
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
function oiNow_(now) { return new Date(Number(now)).toISOString(); }
function oiReceiptDay_(now) {
  return new Date(Number(now)).toISOString().slice(0, 10).replace(/-/g, '');
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
    completionReport: request.completionReport || null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}
function oiOfficeEnabled_() { return PropertiesService.getScriptProperties().getProperty('OFFICE_INTAKE_ENABLED') === '1'; }
function oiOfficeMutable_(request) { return request.status === 'pending_review' || request.status === 'needs_info'; }

function oiCreate_(session, payload, now) {
  if (!oiOfficeEnabled_()) return { ok: false, error: 'office-disabled' };
  var validated = oiValidateCreate_(payload);
  if (!validated.ok) return validated;
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
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
      createdAt: at,
      updatedAt: at
    };
    store.requests.push(request);
    oiWriteStore_(store);
    return oiCreateResult_(request);
  } finally {
    lock.releaseLock();
  }
}

function oiList_(session, payload) {
  var officeId = oiSessionOfficeId_(session);
  if (!officeId) return { ok: false, error: 'session-expired' };
  var requests = oiReadStore_().requests.filter(function (request) { return request.officeId === officeId; });
  requests.sort(function (a, b) { return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)); });
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
      residentContact: payload.residentContact == null ? request.residentContact : payload.residentContact,
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
    request.updatedAt = oiNow_(now);
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
  return bytes.length >= 12 && oiByte_(bytes, 0) === 0x52 && oiByte_(bytes, 1) === 0x49 && oiByte_(bytes, 2) === 0x46 && oiByte_(bytes, 3) === 0x46 && oiByte_(bytes, 8) === 0x57 && oiByte_(bytes, 9) === 0x45 && oiByte_(bytes, 10) === 0x42 && oiByte_(bytes, 11) === 0x50;
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
  if (!OI_IMAGE_TYPES[mimeType]) return { ok: false, error: 'unsupported-type' };
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
    oiWriteStore_(store);
    return { ok: true, fileId: photo.fileId, name: photo.name, mimeType: photo.mimeType, size: photo.size, createdAt: photo.createdAt };
  } finally {
    lock.releaseLock();
  }
}

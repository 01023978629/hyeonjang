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
  return { ok: false, error: 'bad-request', message: '아직 지원하지 않는 관리사무소 action입니다' };
}

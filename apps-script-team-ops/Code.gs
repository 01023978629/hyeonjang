/* Separate deployment. Never install in the legacy photo relay or office portal. */
'use strict';
function companyProps_(){return PropertiesService.getScriptProperties();}
function companyConfig_(){
  var p=companyProps_(),url=p.getProperty('COMPANY_PORTAL_URL'),folder=p.getProperty('COMPANY_FOLDER_ID'),office=p.getProperty('COMPANY_OFFICE_ID');
  if(p.getProperty('COMPANY_ENABLED')!=='1'||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'')||!folder||!office)teamError_('not-configured');
  return {url:url,folder:folder,office:office};
}
function companyIdentity_(token,c){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{64,256}$/.test(token))teamError_('session-expired');
  var r;try{r=UrlFetchApp.fetch(c.url,{method:'post',contentType:'text/plain',payload:JSON.stringify({action:'portalMe',sessionToken:token}),muteHttpExceptions:true});}catch(_){teamError_('auth-unavailable');}
  var me;try{me=JSON.parse(r.getContentText());}catch(_){teamError_('auth-unavailable');}
  if(r.getResponseCode()!==200||!me||me.ok!==true||!me.user||me.user.active!==true||!me.office||me.office.active!==true||me.office.id!==c.office||!Number.isFinite(me.expiresAt)||me.expiresAt<=Date.now()||typeof me.user.id!=='string'||!me.user.id.trim()||me.user.id!==me.user.id.trim()||me.user.id.length>100||/[\x00-\x1f]/.test(me.user.id))teamError_('session-expired');
  return {userId:me.user.id,officeId:me.office.id,expiresAt:me.expiresAt}; // No office role, email or permissions copied.
}
function companyDigest_(text){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text)).replace(/=+$/g,'');}
function companyRateGate_(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{64,256}$/.test(token))teamError_('session-expired');
  // Best-effort quota protection, not an authentication cache. Bounded hashed slots; no raw tokens.
  var hash=companyDigest_(token),slot=(hash.charCodeAt(0)*64+hash.charCodeAt(1))%128,minute=Math.floor(Date.now()/60000);
  var keys=['team-rate:'+minute+':all','team-rate:'+minute+':slot:'+slot],limits=[300,60];
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))teamError_('busy');
  try{
    var cache=CacheService.getScriptCache(),counts=keys.map(function(k){var n=Number(cache.get(k)||0);if(!Number.isSafeInteger(n)||n<0)teamError_('auth-unavailable');return n;});
    if(counts.some(function(n,i){return n>=limits[i];}))teamError_('rate-limited');
    keys.forEach(function(k,i){cache.put(k,String(counts[i]+1),120);});
  }finally{lock.releaseLock();}
}
function companyLoad_(c){
  var raw=companyProps_().getProperty('COMPANY_HEAD');if(!raw)teamError_('not-configured');
  var h,s,file;try{h=JSON.parse(raw);file=DriveApp.getFileById(h.fileId);var parents=file.getParents(),inside=false;while(parents.hasNext())if(parents.next().getId()===c.folder)inside=true;if(!inside)teamError_('corrupt');var text=file.getBlob().getDataAsString('UTF-8');if(companyDigest_(text)!==h.hash)teamError_('corrupt');s=JSON.parse(text);}catch(_){teamError_('corrupt');}
  if(s.schema!==1||s.revision!==h.revision||!['teams','members','tasks','audit','requests'].every(function(k){return Array.isArray(s[k]);})||companyProps_().getProperty('COMPANY_HEAD')!==raw)teamError_('conflict');
  if(!s.authority||s.authority.portalUrl!==c.url||s.authority.officeId!==c.office)teamError_('configuration-mismatch');
  return {state:s,head:raw};
}
function companyCommit_(c,s,expected){
  var p=companyProps_();if(p.getProperty('COMPANY_HEAD')!==expected)teamError_('conflict');
  var text=JSON.stringify(s);if(text.length>4000000)teamError_('capacity');
  // Immutable revisions preserve previous states; only the small head pointer changes.
  var file=DriveApp.getFolderById(c.folder).createFile('company-r'+s.revision+'-'+Utilities.getUuid()+'.json',text,'application/json');
  if(file.getBlob().getDataAsString('UTF-8')!==text)teamError_('storage-failed');
  if(p.getProperty('COMPANY_HEAD')!==expected)teamError_('conflict');
  var head=JSON.stringify({fileId:file.getId(),revision:s.revision,hash:companyDigest_(text)});p.setProperty('COMPANY_HEAD',head);
  if(p.getProperty('COMPANY_HEAD')!==head)teamError_('storage-failed');
}
function companyDispatch_(req){
  teamKeys_(req,['action','sessionToken','payload']);var c=companyConfig_();
  if(req.action==='health')return {service:'company-team-v2',portalUrl:c.url};
  if(['identity','list','teamSave','memberSave','taskSave'].indexOf(req.action)<0)teamError_('invalid-action');
  companyRateGate_(req.sessionToken);
  var identity=companyIdentity_(req.sessionToken,c); // No slow identity network call while holding the data lock.
  if(req.action==='identity')return {identity:{userId:identity.userId,officeId:identity.officeId}};
  var lock=LockService.getScriptLock();if(!lock.tryLock(15000))teamError_('busy');
  try{
    var current=companyConfig_();if(current.url!==c.url||current.office!==c.office||current.folder!==c.folder)teamError_('configuration-mismatch');
    if(identity.expiresAt<=Date.now())teamError_('session-expired');
    var loaded=companyLoad_(c);teamMember_(loaded.state,identity);
    if(req.action==='list')return {data:teamPresent_(loaded.state,identity)};
    var result=teamApply_(loaded.state,identity,req.action,req.payload,new Date().toISOString(),Utilities.getUuid(),companyDigest_);
    if(!result.replayed)companyCommit_(c,result.store,loaded.head);
    return {data:teamPresent_(result.store,identity),replayed:result.replayed};
  }finally{lock.releaseLock();}
}
function doGet(){return companyJson_({ok:false,error:'bad-request'});}
function doPost(e){
  try{var raw=e&&e.postData&&e.postData.contents;if(typeof raw!=='string'||raw.length>64000)teamError_('invalid-input');var r=companyDispatch_(JSON.parse(raw));r.ok=true;return companyJson_(r);}
  catch(e){var codes=['not-configured','configuration-mismatch','session-expired','auth-unavailable','rate-limited','forbidden','conflict','request-conflict','invalid-input','invalid-action','invalid-team','invalid-assignee','invalid-transition','handoff-required','review-note-required','not-found','duplicate','duplicate-source','team-in-use','self-lockout','last-owner','identity-immutable','reassign-open-tasks','capacity','busy','storage-failed','corrupt'];return companyJson_({ok:false,error:codes.indexOf(e.message)>=0?e.message:'server-error'});}
}
function companyJson_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
// Editor-owner only. Not in the HTTP action allowlist. No password is generated here.
function companyBootstrapFromProperties_(){
  var lock=LockService.getScriptLock();lock.waitLock(15000);try{
    var p=companyProps_(),c=companyConfig_();if(p.getProperty('COMPANY_HEAD'))teamError_('already-configured');
    var user=teamId_(p.getProperty('COMPANY_OWNER_USER_ID')),name=teamText_(p.getProperty('COMPANY_OWNER_NAME'),60);
    var teams=['대표·관리','누수·배관팀','인테리어팀','관리사무소 대응팀'].map(function(n){return {id:Utilities.getUuid(),name:n,active:true};});
    companyCommit_(c,{schema:1,revision:0,authority:{portalUrl:c.url,officeId:c.office},teams:teams,members:[{id:Utilities.getUuid(),userId:user,officeId:c.office,name:name,role:'owner',teamIds:[teams[0].id],active:true}],tasks:[],audit:[],requests:[]},null);
    p.deleteProperty('COMPANY_OWNER_USER_ID');p.deleteProperty('COMPANY_OWNER_NAME');return {ok:true};
  }finally{lock.releaseLock();}
}

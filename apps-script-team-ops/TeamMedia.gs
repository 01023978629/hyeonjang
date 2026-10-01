/* v333 staff video originals: Drive resumable upload in 1 MiB chunks (design after apps-script/MediaRelay.gs,
 * which stays untouched). The Drive file ID is preallocated and journaled BEFORE any byte is sent, so a lost
 * response or a retry can never create a second original. The resumable session URL stays server-side.
 * Verification uses Drive's own sha256Checksum: a 100 MiB original is never read into Apps Script memory.
 * No public sharing, no deletion, no caller-selected file or folder.
 */
'use strict';
var TEAM_MEDIA_CHUNK=1024*1024,TEAM_MEDIA_ALIGN=256*1024,TEAM_MEDIA_PREFIX='TEAM_MEDIA_JOB_',TEAM_MEDIA_MAX_JOBS=100,TEAM_MEDIA_TTL_MS=7*24*60*60*1000;
function teamMediaFetch_(url,options){
  options=options||{};options.headers=options.headers||{};options.headers.Authorization='Bearer '+ScriptApp.getOAuthToken();
  options.muteHttpExceptions=true;options.followRedirects=false;
  try{return UrlFetchApp.fetch(url,options);}catch(_){teamError_('busy');} // Never echo upstream text: it can contain session URLs.
}
function teamMediaHeader_(r,key){var h=r.getAllHeaders(),found='';Object.keys(h).some(function(n){if(n.toLowerCase()===key){found=String(h[n]);return true;}return false;});return found;}
function teamMediaFailure_(r){var code=r.getResponseCode();return code===429||code>=500?'busy':'storage-failed';}
function teamMediaSessionUrl_(v){return typeof v==='string'&&v.length<=2048&&/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[A-Za-z0-9._~!$&'()*+,;=:@%?\/-]+$/.test(v)&&/[?&]upload_id=[A-Za-z0-9_-]+(?:&|$)/.test(v);}
function teamMediaJobValid_(j,uploadId){
  return !!j&&typeof j==='object'&&j.schema===1&&j.uploadId===uploadId&&typeof j.actorId==='string'&&typeof j.binding==='string'&&j.entity&&typeof j.entity==='object'&&
    j.evidenceId===j.entity.id&&typeof j.fileId==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(j.fileId)&&Number.isSafeInteger(j.size)&&j.size===j.entity.size&&
    Number.isSafeInteger(j.offset)&&j.offset>=0&&j.offset<=j.size&&(j.session===''||teamMediaSessionUrl_(j.session))&&(j.state==='uploading'||j.state==='complete')&&
    (j.state!=='complete'||j.offset===j.size&&j.session==='')&&Number.isFinite(j.createdAt);
}
function teamMediaLoadJob_(uploadId){
  var raw=companyProps_().getProperty(TEAM_MEDIA_PREFIX+uploadId);if(raw===null)return null;
  var j;try{j=JSON.parse(raw);}catch(_){teamError_('corrupt');}if(!teamMediaJobValid_(j,uploadId))teamError_('corrupt');return j;
}
function teamMediaSaveJob_(j){
  if(!teamMediaJobValid_(j,j.uploadId))teamError_('corrupt');var p=companyProps_(),key=TEAM_MEDIA_PREFIX+j.uploadId,value=JSON.stringify(j);
  if(value.length>8000)teamError_('invalid-input');
  try{p.setProperty(key,value);}catch(_){teamError_('storage-failed');}if(p.getProperty(key)!==value)teamError_('storage-failed');
}
// Bounded journal: drop only receipts whose evidence is already committed, or abandoned work past Drive's one-week session life.
// The Drive original itself is never deleted here.
function teamMediaPrune_(s,now){
  var p=companyProps_(),keys=p.getKeys().filter(function(k){return k.indexOf(TEAM_MEDIA_PREFIX)===0;}),ids=teamList_(s,'evidence').map(function(e){return e.id;}),left=0;
  keys.forEach(function(k){var j;try{j=JSON.parse(p.getProperty(k));}catch(_){left++;return;}
    if(j&&(ids.indexOf(j.evidenceId)>=0||Number.isFinite(j.createdAt)&&now-j.createdAt>TEAM_MEDIA_TTL_MS))p.deleteProperty(k);else left++;});
  return left;
}
function teamMediaStatus_(j,state){return {uploadId:j.uploadId,state:state||j.state,offset:state==='committed'?j.size:j.offset,size:j.size,chunkBytes:TEAM_MEDIA_CHUNK};}
function teamMediaMeta_(id){
  var r=teamMediaFetch_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,mimeType,size,sha256Checksum,parents,trashed&supportsAllDrives=true');
  if(r.getResponseCode()===404)return null;if(r.getResponseCode()!==200)teamError_(teamMediaFailure_(r));
  var m;try{m=JSON.parse(r.getContentText());}catch(_){teamError_('storage-failed');}if(!m||m.id!==id)teamError_('storage-failed');return m;
}
function teamMediaVerify_(file,c,meta){
  companyInside_(file,c.folder);var m=teamMediaMeta_(file.getId());
  if(!m||m.trashed||m.mimeType!==meta.mime||Number(m.size)!==meta.size||m.sha256Checksum!==meta.sha256||!Array.isArray(m.parents)||m.parents.indexOf(c.folder)<0)teamError_('hash-mismatch');
}
function teamMediaComplete_(j,c){
  var file;try{file=DriveApp.getFileById(j.fileId);}catch(_){teamError_('storage-failed');}
  teamMediaVerify_(file,c,j.entity);j.state='complete';j.offset=j.size;j.session='';teamMediaSaveJob_(j);return teamMediaStatus_(j);
}
function teamMediaStart_(j,c){
  var r=teamMediaFetch_('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',{method:'post',contentType:'application/json; charset=UTF-8',
    headers:{'X-Upload-Content-Type':j.entity.mime,'X-Upload-Content-Length':String(j.size)},payload:JSON.stringify({id:j.fileId,name:'evidence-original-'+j.evidenceId+'-'+j.binding,mimeType:j.entity.mime,parents:[c.folder]})});
  if(r.getResponseCode()===409){if(teamMediaMeta_(j.fileId))return teamMediaComplete_(j,c);teamError_('busy');}
  if(r.getResponseCode()!==200)teamError_(teamMediaFailure_(r));
  var uri=teamMediaHeader_(r,'location');if(!teamMediaSessionUrl_(uri))teamError_('storage-failed');
  j.session=uri;j.offset=0;j.state='uploading';teamMediaSaveJob_(j);return teamMediaStatus_(j);
}
function teamMediaProgress_(j,r,c){
  var code=r.getResponseCode();
  if(code===200||code===201)return teamMediaComplete_(j,c);
  if([400,404,410].indexOf(code)>=0){if(teamMediaMeta_(j.fileId))return teamMediaComplete_(j,c);j.session='';j.offset=0;teamMediaSaveJob_(j);return teamMediaStart_(j,c);} // Same preallocated ID: never a duplicate.
  if(code!==308)teamError_(teamMediaFailure_(r));
  var range=teamMediaHeader_(r,'range'),offset=0;if(range){var m=/^bytes=0-(\d+)$/.exec(range);if(!m)teamError_('storage-failed');offset=Number(m[1])+1;}
  if(!Number.isSafeInteger(offset)||offset<0||offset>=j.size)teamError_('storage-failed');j.offset=offset;teamMediaSaveJob_(j);return teamMediaStatus_(j);
}
function teamMediaSync_(j,c){
  if(j.state==='complete')return teamMediaComplete_(j,c);
  if(!j.session){if(teamMediaMeta_(j.fileId))return teamMediaComplete_(j,c);return teamMediaStart_(j,c);}
  return teamMediaProgress_(j,teamMediaFetch_(j.session,{method:'put',headers:{'Content-Range':'bytes */'+j.size},payload:''}),c);
}
function teamVideoMagic_(mime,raw){
  var b=raw.slice(0,12).map(function(x){return (x+256)%256;}),box=String.fromCharCode.apply(null,b.slice(4,8));
  if(mime==='video/webm')return b[0]===0x1a&&b[1]===0x45&&b[2]===0xdf&&b[3]===0xa3;
  if(mime==='video/mp4')return box==='ftyp';
  return ['ftyp','moov','wide','mdat','free','skip','pnot'].indexOf(box)>=0; // QuickTime: older .mov files may not start with ftyp.
}
function teamMediaOwned_(s,actor,j,entity){if(j.actorId!==actor.id||j.binding!==companyDigest_(JSON.stringify([actor.id,entity])))teamError_('request-conflict');}
// Begin doubles as the status call: the client never trusts its own cached offset after a restart.
function teamMediaBegin_(c,loaded,identity,payload){
  teamKeys_(payload,['uploadId','entity']);teamUuid_(payload.uploadId);
  var s=loaded.state,actor=teamMember_(s,identity),meta=teamEvidenceValidate_(s,actor,payload.entity);if(meta.kind!=='video')teamError_('invalid-input');
  var binding=companyDigest_(JSON.stringify([actor.id,payload.entity])),done=teamList_(s,'evidence').find(function(e){return e.id===meta.id;});
  var j=teamMediaLoadJob_(payload.uploadId);
  if(done){if(done.uploaderId!==actor.id||done.sha256!==meta.sha256)teamError_('duplicate');return teamMediaStatus_(j||{uploadId:payload.uploadId,size:meta.size,offset:meta.size},'committed');}
  if(j){teamMediaOwned_(s,actor,j,payload.entity);return teamMediaSync_(j,c);}
  var now=Date.now();if(teamMediaPrune_(s,now)>=TEAM_MEDIA_MAX_JOBS)teamError_('capacity');
  companyPrivate_(DriveApp.getFolderById(c.folder));
  var ids=teamMediaFetch_('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files');if(ids.getResponseCode()!==200)teamError_(teamMediaFailure_(ids));
  var list;try{list=JSON.parse(ids.getContentText()).ids;}catch(_){teamError_('storage-failed');}if(!Array.isArray(list)||list.length!==1||!/^[A-Za-z0-9_-]{10,200}$/.test(list[0]))teamError_('storage-failed');
  j={schema:1,uploadId:payload.uploadId,actorId:actor.id,evidenceId:meta.id,binding:binding,entity:payload.entity,fileId:list[0],size:meta.size,offset:0,session:'',state:'uploading',createdAt:now};
  teamMediaSaveJob_(j); // Durable identity BEFORE a session exists.
  return teamMediaStart_(j,c);
}
function teamMediaChunk_(c,loaded,identity,payload){
  teamKeys_(payload,['uploadId','offset','base64']);teamUuid_(payload.uploadId);
  var s=loaded.state,actor=teamMember_(s,identity),j=teamMediaLoadJob_(payload.uploadId);if(!j)teamError_('upload-not-found');
  if(j.actorId!==actor.id)teamError_('forbidden');teamEvidenceValidate_(s,actor,j.entity); // Permission is re-checked on every chunk: removal mid-upload stops it.
  var b64=payload.base64;if(!Number.isSafeInteger(payload.offset)||payload.offset<0||payload.offset>=j.size||typeof b64!=='string'||!b64.length||b64.length>4*Math.ceil(TEAM_MEDIA_CHUNK/3)||b64.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))teamError_('invalid-input');
  var bytes;try{bytes=Utilities.base64Decode(b64);}catch(_){teamError_('invalid-input');}
  if(Utilities.base64Encode(bytes)!==b64||bytes.length<1||bytes.length>TEAM_MEDIA_CHUNK||payload.offset+bytes.length>j.size||(payload.offset+bytes.length!==j.size&&bytes.length%TEAM_MEDIA_ALIGN))teamError_('invalid-input');
  if(payload.offset===0&&!teamVideoMagic_(j.entity.mime,bytes))teamError_('invalid-file'); // A renamed non-video never reaches Drive.
  var status=teamMediaSync_(j,c);
  // A resent or out-of-order chunk changes nothing: the client resumes from the server offset.
  if(status.state==='complete'||payload.offset!==j.offset)return status;
  return teamMediaProgress_(j,teamMediaFetch_(j.session,{method:'put',contentType:j.entity.mime,headers:{'Content-Range':'bytes '+payload.offset+'-'+(payload.offset+bytes.length-1)+'/'+j.size},payload:bytes}),c);
}
// Same request contract as photos (requestId/revision replay), but the bytes are the verified finished upload.
function teamMediaCommit_(c,loaded,identity,actor,payload,meta,now,newId){
  if(payload.base64!==undefined)teamError_('invalid-input');teamUuid_(payload.uploadId);
  var state=loaded.state,canonical={requestId:payload.requestId,revision:payload.revision,entity:payload.entity}; // Same request hash as photos; the entity id already binds the finished upload.
  var hash=companyDigest_(JSON.stringify([actor.id,'evidenceUpload',canonical])),prior=state.requests.find(function(r){return r.id===payload.requestId;});
  if(prior){
    if(prior.hash!==hash)teamError_('request-conflict');var existing=teamList_(state,'evidence').find(function(e){return e.id===meta.id;});
    if(!existing||existing.sha256!==meta.sha256)teamError_('storage-failed');companyPrivate_(DriveApp.getFolderById(c.folder));teamMediaVerify_(DriveApp.getFileById(existing.fileId),c,existing);
    return {store:state,replayed:true};
  }
  if(!Number.isSafeInteger(payload.revision)||payload.revision!==state.revision)teamError_('conflict');
  if(teamList_(state,'evidence').some(function(e){return e.id===meta.id;}))teamError_('duplicate');
  var j=teamMediaLoadJob_(payload.uploadId);if(!j)teamError_('upload-not-found');teamMediaOwned_(state,actor,j,payload.entity);
  if(j.state!=='complete')teamError_('upload-incomplete');
  var binding=companyDigest_(JSON.stringify([actor.id,payload.entity]));
  var candidate=teamApply_(state,identity,'evidenceUpload',canonical,now,newId,companyDigest_,{fileId:'pending',binding:binding});
  if(JSON.stringify(candidate.store).length>3999500)teamError_('capacity');
  companyPrivate_(DriveApp.getFolderById(c.folder));var file;try{file=DriveApp.getFileById(j.fileId);}catch(_){teamError_('storage-failed');}teamMediaVerify_(file,c,j.entity);
  return teamApply_(state,identity,'evidenceUpload',canonical,now,newId,companyDigest_,{fileId:j.fileId,binding:binding});
}
function teamMediaReadChunk_(c,s,identity,payload){
  teamKeys_(payload,['evidenceId','offset','length']);teamUuid_(payload.evidenceId);var m=teamMember_(s,identity),e=teamList_(s,'evidence').find(function(e){return e.id===payload.evidenceId;});
  if(!e||!teamEvidenceVisible_(s,m,e))teamError_('forbidden');if(e.kind!=='video')teamError_('invalid-input');
  if(!Number.isSafeInteger(payload.offset)||payload.offset<0||payload.offset>=e.size||!Number.isSafeInteger(payload.length)||payload.length<1||payload.length>TEAM_MEDIA_CHUNK)teamError_('invalid-input');
  companyPrivate_(DriveApp.getFolderById(c.folder));var file=DriveApp.getFileById(e.fileId);teamMediaVerify_(file,c,e);
  var end=Math.min(e.size,payload.offset+payload.length)-1,r=teamMediaFetch_('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(e.fileId)+'?alt=media&supportsAllDrives=true',{headers:{Range:'bytes='+payload.offset+'-'+end}});
  var code=r.getResponseCode();if(code!==206&&!(code===200&&payload.offset===0&&end+1===e.size))teamError_(code===429||code>=500?'busy':'hash-mismatch');
  if(code===206&&teamMediaHeader_(r,'content-range')!=='bytes '+payload.offset+'-'+end+'/'+e.size)teamError_('hash-mismatch');
  var bytes=r.getBlob().getBytes();if(bytes.length!==end-payload.offset+1)teamError_('hash-mismatch');
  teamMediaVerify_(file,c,e); // Content unchanged across the read; the client still hashes the whole assembled original.
  return {mime:e.mime,size:e.size,sha256:e.sha256,offset:payload.offset,nextOffset:end+1,eof:end+1===e.size,base64:Utilities.base64Encode(bytes)};
}

/* Immutable original evidence. Never publishes a Drive URL or changes sharing permissions. */
'use strict';
function teamEvidenceValidate_(s,actor,e){
  teamKeys_(e,['id','projectId','taskId','kind','mime','name','size','sha256','phase','caption','capturedDate']);teamUuid_(e.id);
  var p=teamProject_(s,teamId_(e.projectId));if(!p.active||!teamProjectVisible_(s,actor,p))teamError_('forbidden');
  if(e.kind!=='photo'&&e.kind!=='document')teamError_('invalid-input');
  if(e.kind==='document'&&actor.role!=='owner')teamError_('forbidden');
  var taskId=e.taskId||'';
  if(e.kind==='photo'){var t=s.tasks.find(function(t){return t.id===taskId&&t.projectId===p.id;});if(!t||!teamCanSee_(actor,t))teamError_('forbidden');if(actor.role!=='owner'&&actor.role!=='lead'&&t.status==='done')teamError_('forbidden');}
  else if(taskId)teamError_('invalid-input');
  var types=e.kind==='photo'?['image/jpeg','image/png','image/webp']:['image/jpeg','image/png','image/webp','application/pdf'];
  if(types.indexOf(e.mime)<0||!Number.isSafeInteger(e.size)||e.size<8||e.size>12*1024*1024||typeof e.sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256))teamError_('invalid-file');
  var name=teamText_(e.name,160);if(/[\\/]/.test(name)||name==='.'||name==='..')teamError_('invalid-file');
  if((e.kind==='document'?['document']:['before','cause','during','after']).indexOf(e.phase)<0)teamError_('invalid-input');
  return {id:e.id,projectId:p.id,taskId:taskId,kind:e.kind,mime:e.mime,name:name,size:e.size,sha256:e.sha256,phase:e.phase,caption:teamLong_(e.caption,1000),capturedDate:e.capturedDate?teamDate_(e.capturedDate):''};
}
function companyBytesHash_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(x){return ('0'+((x+256)%256).toString(16)).slice(-2);}).join('');}
function companyBytes_(base64,e){
  if(typeof base64!=='string'||base64.length!==4*Math.ceil(e.size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))teamError_('invalid-file');
  var bytes;try{bytes=Utilities.base64Decode(base64);}catch(_){teamError_('invalid-file');}
  if(bytes.length!==e.size||Utilities.base64Encode(bytes)!==base64||companyBytesHash_(bytes)!==e.sha256)teamError_('invalid-file'); // No Drive write has happened: caller can correct/reselect input.
  var b=bytes.slice(0,12).map(function(x){return (x+256)%256;}),magic=false;
  if(e.mime==='image/jpeg')magic=b[0]===255&&b[1]===216&&b[2]===255;
  if(e.mime==='image/png')magic=[137,80,78,71,13,10,26,10].every(function(v,i){return b[i]===v;});
  if(e.mime==='image/webp')magic=String.fromCharCode.apply(null,b.slice(0,4))==='RIFF'&&String.fromCharCode.apply(null,b.slice(8,12))==='WEBP';
  if(e.mime==='application/pdf')magic=String.fromCharCode.apply(null,b.slice(0,5))==='%PDF-';
  if(!magic)teamError_('invalid-file');return bytes;
}
function companyPrivate_(item){if(item.getSharingAccess()!==DriveApp.Access.PRIVATE||item.getEditors().length||item.getViewers().length)teamError_('private-storage-required');}
function companyOnlyNamed_(folder,name){var files=folder.getFilesByName(name),hit=null;while(files.hasNext()){if(hit)teamError_('storage-ambiguous');hit=files.next();}return hit;}
function companyInside_(file,folder){var it=file.getParents(),found=false;while(it.hasNext())if(it.next().getId()===folder)found=true;if(!found)teamError_('corrupt');companyPrivate_(file);}
function companyVerifyEvidence_(file,c,meta){
  companyInside_(file,c.folder);var blob=file.getBlob(),bytes=blob.getBytes();if(blob.getContentType()!==meta.mime||bytes.length!==meta.size||companyBytesHash_(bytes)!==meta.sha256)teamError_('hash-mismatch');return bytes;
}
function companyEvidenceUpload_(c,loaded,identity,payload,now,newId){
  teamKeys_(payload,['requestId','revision','entity','base64']);teamUuid_(payload.requestId);
  var state=loaded.state,actor=teamMember_(state,identity),meta=teamEvidenceValidate_(state,actor,payload.entity);
  var bytes=companyBytes_(payload.base64,meta); // Replays must still identify the exact original, not just reuse metadata.
  var canonical={requestId:payload.requestId,revision:payload.revision,entity:payload.entity};
  var hash=companyDigest_(JSON.stringify([actor.id,'evidenceUpload',canonical])),prior=state.requests.find(function(r){return r.id===payload.requestId;});
  if(prior){
    if(prior.hash!==hash)teamError_('request-conflict');var existing=teamList_(state,'evidence').find(function(e){return e.id===meta.id;});
    if(!existing||existing.sha256!==meta.sha256)teamError_('storage-failed');companyPrivate_(DriveApp.getFolderById(c.folder));companyVerifyEvidence_(DriveApp.getFileById(existing.fileId),c,existing);
    return {store:state,replayed:true};
  }
  if(!Number.isSafeInteger(payload.revision)||payload.revision!==state.revision)teamError_('conflict');
  if(teamList_(state,'evidence').some(function(e){return e.id===meta.id;}))teamError_('duplicate');
  // Validate the whole request and capacity before any file creation.
  var binding=companyDigest_(JSON.stringify([actor.id,payload.entity]));
  var candidate=teamApply_(state,identity,'evidenceUpload',canonical,now,newId,companyDigest_,{fileId:'pending',binding:binding});
  if(JSON.stringify(candidate.store).length>3999500)teamError_('capacity');
  var folder=DriveApp.getFolderById(c.folder);companyPrivate_(folder);
  var intentName='evidence-intent-'+meta.id+'.json',intentText=JSON.stringify({schema:1,actorId:actor.id,evidenceId:meta.id,binding:binding,sha256:meta.sha256});
  var intent=companyOnlyNamed_(folder,intentName);
  if(intent){companyInside_(intent,c.folder);if(intent.getBlob().getDataAsString('UTF-8')!==intentText)teamError_('request-conflict');}
  else {intent=folder.createFile(intentName,intentText,'application/json');companyInside_(intent,c.folder);if(intent.getBlob().getDataAsString('UTF-8')!==intentText)teamError_('storage-failed');}
  // The binding is durable BEFORE binary creation. Retry finds the same original even if creation's response was lost.
  var name='evidence-original-'+meta.id+'-'+binding,file=companyOnlyNamed_(folder,name);
  if(!file)file=folder.createFile(Utilities.newBlob(bytes,meta.mime,name));
  companyVerifyEvidence_(file,c,meta);
  return teamApply_(state,identity,'evidenceUpload',canonical,now,newId,companyDigest_,{fileId:file.getId(),binding:binding});
}
function companyEvidenceRead_(c,s,identity,payload){
  teamKeys_(payload,['evidenceId']);teamUuid_(payload.evidenceId);var m=teamMember_(s,identity),e=teamList_(s,'evidence').find(function(e){return e.id===payload.evidenceId;});
  if(!e||!teamEvidenceVisible_(s,m,e))teamError_('forbidden');companyPrivate_(DriveApp.getFolderById(c.folder));
  var bytes=companyVerifyEvidence_(DriveApp.getFileById(e.fileId),c,e);return {mime:e.mime,name:e.name,size:e.size,sha256:e.sha256,base64:Utilities.base64Encode(bytes)};
}

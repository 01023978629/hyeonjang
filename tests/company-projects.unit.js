'use strict';
// All people, projects, files and identity endpoints are synthetic. No network calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..','apps-script-team-ops'),mode=process.env.HJ_PROJECT_MUTATION;
const source=Object.fromEntries(['TeamPure.gs','TeamProjects.gs','TeamEvidence.gs','TeamMedia.gs','Code.gs'].map(n=>[n,fs.readFileSync(path.join(root,n),'utf8')]));
const mutations={
 'schedule':['TeamProjects.gs',"if(t.status!=='done'&&s.tasks.some",'if(false&&s.tasks.some'],
 'scope':['TeamProjects.gs',"return !!t&&teamCanSee_(m,t);",'return !!t;'],
 'documents':['TeamProjects.gs',"if(e.kind==='document')return m.role==='owner';","if(e.kind==='document')return true;"],
 'hash':['TeamEvidence.gs','companyBytesHash_(bytes)!==meta.sha256','false'],
 'intent':['TeamEvidence.gs',"if(intent.getBlob().getDataAsString('UTF-8')!==intentText)teamError_('request-conflict');","if(false)teamError_('request-conflict');"],
 'review':['TeamProjects.gs',"if(!record.review||record.review.fingerprint!==fingerprint)teamError_('review-stale');","if(!record.review)teamError_('review-stale');"],
 'reparent':['TeamProjects.gs',"if(old&&(old.projectId||'')!==projectId&&teamList_", "if(false&&old&&(old.projectId||'')!==projectId&&teamList_"],
 'private-load':['Code.gs','companyPrivate_(DriveApp.getFolderById(c.folder));','/* mutation: no private root read guard */'],
 'private-commit':['Code.gs','var folder=DriveApp.getFolderById(c.folder);companyPrivate_(folder);','var folder=DriveApp.getFolderById(c.folder);'],
 'private-snapshot':['Code.gs','companyInside_(file,c.folder);','/* mutation: no snapshot ACL/parent guard */'],
 // v333 staff media: each protects one promise of the chunk/HEIC path.
 'heic-magic':['TeamEvidence.gs',"function teamHeifBrand_(b){","function teamHeifBrand_(b){return true;"],
 'media-offset':['TeamMedia.gs',"if(status.state==='complete'||payload.offset!==j.offset)return status;","if(status.state==='complete')return status;"],
 'media-actor':['TeamMedia.gs',"if(j.actorId!==actor.id)teamError_('forbidden');teamEvidenceValidate_","teamEvidenceValidate_"],
 'media-recheck':['TeamMedia.gs',"teamEvidenceValidate_(s,actor,j.entity); // Permission","(0); // Permission"],
 'media-verify':['TeamMedia.gs',"m.sha256Checksum!==meta.sha256||","false||"],
 'media-incomplete':['TeamMedia.gs',"if(j.state!=='complete')teamError_('upload-incomplete');",""],
 'media-magic':['TeamMedia.gs',"if(payload.offset===0&&!teamVideoMagic_(j.entity.mime,bytes))","if(false)"],
 'media-max':['TeamEvidence.gs',"e.size>(e.kind==='video'?TEAM_VIDEO_MAX:TEAM_PHOTO_MAX)","e.size>1e12"]
};
if(mode){const [file,from,to]=mutations[mode]||[];assert(file,'unknown mutation');assert(source[file].includes(from),'mutation anchor missing');source[file]=source[file].replace(from,to);}
const clone=v=>JSON.parse(JSON.stringify(v)),hex=b=>crypto.createHash('sha256').update(b).digest('hex');
let actor='TEST_OWNER',locked=false,seq=0,failCreateAfter=false,failCommit=false,sharedFolder=false;
const files=new Map(),props=new Map(),cache=new Map(),folderId='TEST_PRIVATE_COMPANY_FOLDER';
function blob(bytes,type,name=''){const b=Buffer.from(bytes);return {getBytes:()=>[...b],getDataAsString:()=>b.toString('utf8'),getContentType:()=>type,getName:()=>name};}
function file(id){const d=files.get(id);if(!d)throw Error('missing');return {getId:()=>id,getName:()=>d.name,getBlob:()=>blob(d.bytes,d.type,d.name),getSharingAccess:()=>d.shared?'ANYONE':'PRIVATE',getEditors:()=>[],getViewers:()=>[],getParents:()=>iterator([{getId:()=>d.parent}])};}
function iterator(items){let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};}
const folder={getId:()=>folderId,getSharingAccess:()=>sharedFolder?'ANYONE':'PRIVATE',getEditors:()=>[],getViewers:()=>[],getFilesByName:n=>iterator([...files].filter(([,d])=>d.name===n).map(([id])=>file(id))),createFile(name,text,type){
 let b;if(typeof name==='string')b=blob(Buffer.from(text),type,name);else b=name;
 if(failCommit&&b.getName().startsWith('company-r'))throw Error('TEST_COMMIT_FAILURE');
 const id='TEST_FILE_'+(++seq);files.set(id,{name:b.getName(),bytes:Buffer.from(b.getBytes()),type:b.getContentType(),parent:folderId});
 if(failCreateAfter&&b.getName().startsWith('evidence-original-')){failCreateAfter=false;throw Error('TEST_CREATED_RESPONSE_LOST');}return file(id);
}};
// Synthetic Drive v3 resumable API: preallocated IDs, 308/Range progress, lost responses, Range reads.
const sessions=new Map();let idSeq=0,sessionSeq=0,loseNextChunk=false;
function driveResponse(code,body='',headers={},bytes){return {getResponseCode:()=>code,getContentText:()=>typeof body==='string'?body:JSON.stringify(body),getAllHeaders:()=>headers,getBlob:()=>({getBytes:()=>[...(bytes||Buffer.alloc(0))]})};}
function drive(url,o={}){
 assert.equal(o.headers.Authorization,'Bearer TEST_DRIVE_OAUTH_NOT_REAL');
 if(url.includes('/generateIds'))return driveResponse(200,{ids:['TESTDRIVEID'+String(++idSeq).padStart(6,'0')]});
 if(url.startsWith('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true')){
  const m=JSON.parse(o.payload);if(files.has(m.id))return driveResponse(409);const uri='https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=TESTSESSION'+(++sessionSeq);
  sessions.set(uri,{id:m.id,name:m.name,type:m.mimeType,parent:m.parents[0],size:Number(o.headers['X-Upload-Content-Length']),parts:[]});return driveResponse(200,'',{Location:uri});
 }
 if(sessions.has(url)){
  const u=sessions.get(url),have=Buffer.concat(u.parts),range=o.headers['Content-Range'];
  const progress=()=>Buffer.concat(u.parts).length===u.size?(files.set(u.id,{name:u.name,bytes:Buffer.concat(u.parts),type:u.type,parent:u.parent}),driveResponse(200,{id:u.id})):driveResponse(308,'',Buffer.concat(u.parts).length?{Range:'bytes=0-'+(Buffer.concat(u.parts).length-1)}:{});
  if(range==='bytes */'+u.size)return files.has(u.id)?driveResponse(200,{id:u.id}):progress();
  const [,a,b]=/^bytes (\d+)-(\d+)\/\d+$/.exec(range).map(Number),bytes=Buffer.from(o.payload.map(x=>(x+256)%256));
  if(a!==have.length||b-a+1!==bytes.length)return driveResponse(400); // Strict like Drive: a misplaced range is not appended.
  u.parts.push(bytes);const r=progress();if(loseNextChunk){loseNextChunk=false;throw Error('TEST_CHUNK_RESPONSE_LOST');}return r;
 }
 const meta=/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^?]+)\?(.*)$/.exec(url);assert(meta,'unexpected Drive URL');
 const f=files.get(decodeURIComponent(meta[1]));if(!f)return driveResponse(404);
 if(meta[2].startsWith('alt=media')){const [,a,b]=/^bytes=(\d+)-(\d+)$/.exec(o.headers.Range).map(Number);return driveResponse(206,'',{'Content-Range':'bytes '+a+'-'+b+'/'+f.bytes.length},f.bytes.subarray(a,b+1));}
 return driveResponse(200,{id:meta[1],mimeType:f.type,size:String(f.bytes.length),sha256Checksum:hex(f.bytes),parents:[f.parent],trashed:false});
}
const context={Date,Set,Number,JSON,Error,console,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getKeys:()=>[...props.keys()]})},
 ScriptApp:{getOAuthToken:()=>'TEST_DRIVE_OAUTH_NOT_REAL'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
 LockService:{getScriptLock:()=>({tryLock(){assert(!locked);locked=true;return true;},waitLock(){assert(!locked);locked=true;},releaseLock(){locked=false;}})},
 DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:file,getFolderById:id=>{assert.equal(id,folderId);return folder;}},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value)).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),base64Encode:b=>Buffer.from(b).toString('base64'),base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:blob},
 UrlFetchApp:{fetch(url,options){if(url.startsWith('https://www.googleapis.com/'))return drive(url,options);assert(!locked,'auth before data lock');assert.equal(url,'https://script.google.com/macros/s/TEST_COMPANY_AUTH/exec');assert.equal(JSON.parse(options.payload).action,'portalMe');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,user:{id:actor,active:true},office:{id:'TEST_OFFICE',active:true},expiresAt:Date.now()+60000})};}}
};
vm.createContext(context);Object.values(source).forEach(s=>vm.runInContext(s,context));
Object.entries({COMPANY_ENABLED:'1',COMPANY_FOLDER_ID:folderId,COMPANY_OFFICE_ID:'TEST_OFFICE',COMPANY_PORTAL_URL:'https://script.google.com/macros/s/TEST_COMPANY_AUTH/exec',COMPANY_OWNER_USER_ID:'TEST_OWNER',COMPANY_OWNER_NAME:'TEST_OWNER'}).forEach(([k,v])=>props.set(k,v));
context.companyBootstrapFromProperties_();
const token='TEST_SESSION'.padEnd(80,'x'),call=(action,payload)=>{cache.clear();return clone(context.companyDispatch_({action,sessionToken:token,payload}));};
let data=call('list').data;const a=data.teams[1].id,b=data.teams[2].id;
function save(action,entity,extra={}){if(['claimReview','claimSubmitRecord'].includes(action)&&!('expectedFingerprint' in entity))entity={...entity,expectedFingerprint:actor==='TEST_OWNER'?call('claimBundle',{claimId:entity.id}).bundle.fingerprint:'TEST_UNAUTHORIZED'};const p={requestId:crypto.randomUUID(),revision:data.revision,entity,...extra};const r=call(action,p);data=r.data;return {p,r};}
function as(user){actor=user;data=call('list').data;}
function taskFields(t){return Object.fromEntries(['id','title','project','teamId','assigneeId','due','status','handoff','sourceRef','projectId','workDate','startTime','endTime'].filter(k=>t[k]!==undefined).map(k=>[k,t[k]]));}
assert.equal(call('health').service,'company-team-v3');
for(let i=1;i<=10;i++)save('memberSave',{name:'TEST_TECH_'+i,userId:'TEST_TECH_'+i,officeId:'TEST_OFFICE',teamIds:i===1?[a,b]:[i<=5?a:b],role:'member',active:true});
save('memberSave',{name:'TEST_LEAD',userId:'TEST_LEAD',officeId:'TEST_OFFICE',teamIds:[a],role:'lead',active:true});
const techs=data.members.filter(m=>m.name.startsWith('TEST_TECH_'));
save('projectSave',{name:'TEST_PROJECT_A',teamIds:[a,b],active:true});const pa=data.projects[0].id;
save('projectSave',{name:'TEST_PROJECT_B',teamIds:[a,b],active:true});const pb=data.projects[1].id;
const tasks=techs.map((m,i)=>({title:'TEST_WORK_'+i,project:'ignored supplied name',projectId:i<5?pa:pb,teamId:i<5?a:b,assigneeId:m.id,due:'2026-09-30',workDate:'2026-09-29',startTime:'09:00',endTime:'11:00',status:'todo',handoff:'',sourceRef:''}));
const batchBefore=data.revision,{p:batch}=save('taskBatch',{tasks});assert.equal(data.revision,batchBefore+1);assert.equal(data.tasks.length,10);assert.equal(data.tasks[0].project,'TEST_PROJECT_A');assert.equal(data.audit[0].action,'taskBatch');assert.equal(data.tasks.every(t=>t.history.length===1),true);
const retry=call('taskBatch',batch);assert.equal(retry.replayed,true);assert.equal(retry.data.tasks.length,10);
const beforeBatch=props.get('COMPANY_HEAD');assert.throws(()=>save('taskBatch',{tasks:[{...tasks[0],startTime:'12:00',endTime:'13:00'},{...tasks[1],assigneeId:'MISSING'}]}),/invalid-assignee/);assert.equal(props.get('COMPANY_HEAD'),beforeBatch);assert.equal(call('list').data.tasks.length,10,'failed batch is all-or-nothing');
assert.throws(()=>save('taskSave',{...tasks[0],teamId:b,startTime:'10:00',endTime:'12:00'}),/schedule-conflict/,'same technician overlap is checked across teams');
save('taskSave',{...tasks[0],teamId:b,startTime:'11:00',endTime:'12:00'});assert.equal(data.tasks.length,11,'adjacent intervals allowed');
assert.throws(()=>save('taskSave',{...tasks[1],workDate:'2026-02-30'}),/invalid-input/);
assert.throws(()=>save('taskSave',{...tasks[1],startTime:'25:00'}),/invalid-schedule/);
const first=data.tasks[0],other=data.tasks[1],otherProjectTask=data.tasks.find(t=>t.projectId===pb);
as('TEST_TECH_1');assert.equal(data.tasks.length,2);assert.deepEqual(data.projects.map(p=>p.id),[pa]);assert.throws(()=>save('taskBatch',{tasks:[tasks[0]]}),/forbidden/);assert.throws(()=>save('taskSave',{...taskFields(first),startTime:'08:00'}),/forbidden/);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVh8AAAAASUVORK5CYII=','base64');
function uploadInput(task=first,kind='photo',bytes=png){return {id:crypto.randomUUID(),projectId:task.projectId,taskId:kind==='photo'?task.id:'',kind,mime:kind==='photo'?'image/png':'application/pdf',name:kind==='photo'?'TEST_PHOTO.png':'TEST_DOCUMENT.pdf',size:bytes.length,sha256:hex(bytes),phase:kind==='photo'?'before':'document',caption:'TEST_ORIGINAL_EVIDENCE',capturedDate:'2026-09-29'};}
const firstMeta=uploadInput();let request={requestId:crypto.randomUUID(),revision:data.revision,entity:firstMeta,base64:png.toString('base64')};
const binaryCount=()=>[...files.values()].filter(f=>f.name.startsWith('evidence-original-')).length;
failCreateAfter=true;assert.throws(()=>call('evidenceUpload',request),/TEST_CREATED_RESPONSE_LOST/);assert.equal(binaryCount(),1);assert.equal(call('list').data.evidence.length,0,'uncommitted binary is not projected as uploaded');
let response=call('evidenceUpload',request);data=response.data;assert.equal(binaryCount(),1,'retry reuses durable original');assert.equal(data.evidence.length,1);assert(!JSON.stringify(data).includes('fileId'),'Drive IDs never projected');assert.equal(call('evidenceUpload',request).replayed,true);assert.equal(binaryCount(),1);
let loaded=call('evidenceRead',{evidenceId:firstMeta.id}).file;assert.equal(loaded.base64,png.toString('base64'));assert.equal(loaded.sha256,hex(png));
assert.throws(()=>call('evidenceRead',{evidenceId:firstMeta.id,fileId:'TEST_FILE_1'}),/invalid-input/);
assert.throws(()=>save('evidenceUpload',uploadInput(other),{base64:png.toString('base64')}),/forbidden/);
assert.throws(()=>save('evidenceUpload',uploadInput(otherProjectTask),{base64:png.toString('base64')}),/forbidden/);
assert.throws(()=>save('evidenceUpload',{...uploadInput(),sha256:'0'.repeat(64)},{base64:png.toString('base64')}),/invalid-file/,'unwritten invalid input is distinguishable from stored-original corruption');
assert.throws(()=>save('evidenceUpload',{...uploadInput(),mime:'image/jpeg'},{base64:png.toString('base64')}),/invalid-file/);
assert.throws(()=>save('evidenceUpload',{...uploadInput(),mime:'image/svg+xml'},{base64:png.toString('base64')}),/invalid-file/);
assert.throws(()=>save('evidenceUpload',{...uploadInput(),size:12*1024*1024+1},{base64:''}),/invalid-file/);
const pdf=Buffer.from('%PDF-1.4\nTEST_DOCUMENT\n%%EOF');assert.throws(()=>save('evidenceUpload',uploadInput(first,'document',pdf),{base64:pdf.toString('base64')}),/forbidden/);
as('TEST_TECH_2');assert.equal(data.evidence.length,0,'same project is not authorization to read another technician photo');assert.throws(()=>call('evidenceRead',{evidenceId:firstMeta.id}),/forbidden/);
as('TEST_LEAD');assert.equal(data.evidence.length,1);assert.equal(call('evidenceRead',{evidenceId:firstMeta.id}).file.size,png.length);assert.throws(()=>save('claimSave',{}),/forbidden/);
as('TEST_OWNER');const docMeta=uploadInput(first,'document',pdf);save('evidenceUpload',docMeta,{base64:pdf.toString('base64')});assert.equal(data.evidence.length,2);
as('TEST_TECH_1');assert.equal(data.evidence.length,1);assert.throws(()=>call('evidenceRead',{evidenceId:docMeta.id}),/forbidden/);
as('TEST_LEAD');assert.equal(data.evidence.length,1);assert.throws(()=>call('evidenceRead',{evidenceId:docMeta.id}),/forbidden/);
as('TEST_OWNER');assert.equal(call('evidenceRead',{evidenceId:docMeta.id}).file.base64,pdf.toString('base64'));
assert.throws(()=>save('taskSave',{...taskFields(first),projectId:pb}),/evidence-bound/);
const secondMeta=uploadInput(first);request={requestId:crypto.randomUUID(),revision:data.revision,entity:secondMeta,base64:png.toString('base64')};failCommit=true;assert.throws(()=>call('evidenceUpload',request),/TEST_COMMIT_FAILURE/);failCommit=false;
const binaries=binaryCount();assert.throws(()=>call('evidenceUpload',{...request,entity:{...secondMeta,caption:'CHANGED_BINDING'}}),/request-conflict/);assert.equal(binaryCount(),binaries);response=call('evidenceUpload',request);data=response.data;assert.equal(binaryCount(),binaries,'metadata commit failure reuses original');
sharedFolder=true;assert.throws(()=>call('evidenceRead',{evidenceId:firstMeta.id}),/private-storage-required/);assert.throws(()=>save('evidenceUpload',uploadInput(),{base64:png.toString('base64')}),/private-storage-required/);sharedFolder=false;
const actualEvidence=JSON.parse(files.get(JSON.parse(props.get('COMPANY_HEAD')).fileId).bytes.toString()).evidence.find(e=>e.id===firstMeta.id),original=files.get(actualEvidence.fileId).bytes;
const tampered=Buffer.from(original);tampered[30]^=1;files.get(actualEvidence.fileId).bytes=tampered;assert.throws(()=>call('evidenceRead',{evidenceId:firstMeta.id}),/hash-mismatch/,'same-sized corruption is detected by hash');files.get(actualEvidence.fileId).bytes=original;
files.get(actualEvidence.fileId).shared=true;assert.throws(()=>call('evidenceRead',{evidenceId:firstMeta.id}),/private-storage-required/);files.get(actualEvidence.fileId).shared=false;
const draft={projectId:pa,mode:'customer-support',insurerName:'TEST_INSURER',referenceNo:'',accidentDate:'2026-09-27',incident:'TEST_INCIDENT',cause:'TEST_CAUSE',repair:'TEST_REPAIR',items:[{kind:'cause',description:'TEST_CAUSE_REPAIR',amount:100000},{kind:'restore',description:'TEST_RESTORE',amount:200000}],selectedEvidenceIds:[firstMeta.id,docMeta.id],insurerConfirmed:true,consentConfirmed:true};
save('claimSave',draft);const claimId=data.claims[0].id;let bundle=call('claimBundle',{claimId}).bundle;assert.equal(bundle.reviewCurrent,false);assert.equal(bundle.evidence.length,2);assert.equal(bundle.claim.items.reduce((n,i)=>n+i.amount,0),300000);assert.equal(data.claims[0].submissions.length,0,'bundle/export is not submission');
assert.throws(()=>save('claimSave',{...draft,id:claimId,projectId:pb}),/project-immutable/);
assert.throws(()=>save('claimSave',{...draft,id:claimId,selectedEvidenceIds:['missing']}),/evidence-missing/);
save('claimSave',{...draft,id:claimId,consentConfirmed:false});assert.throws(()=>save('claimReview',{id:claimId}),/claim-incomplete/);save('claimSave',{...draft,id:claimId});save('claimReview',{id:claimId});bundle=call('claimBundle',{claimId}).bundle;assert.equal(bundle.reviewCurrent,true);const reviewed=bundle.fingerprint;
save('taskSave',{...taskFields(data.tasks.find(t=>t.id===first.id)),status:'doing',handoff:'TEST_UPDATED_REPORT'});bundle=call('claimBundle',{claimId}).bundle;assert.equal(bundle.reviewCurrent,false);assert.notEqual(bundle.fingerprint,reviewed);assert.throws(()=>save('claimSubmitRecord',{id:claimId,submittedDate:'2026-09-27',channel:'TEST_MANUAL_PORTAL',referenceNo:'TEST_RECEIPT'}),/review-stale/);
save('claimReview',{id:claimId});save('claimSubmitRecord',{id:claimId,submittedDate:'2026-09-27',channel:'TEST_MANUAL_PORTAL',referenceNo:'TEST_RECEIPT'});assert.equal(data.claims[0].status,'submitted');const submitted=clone(data.claims[0].submissions[0]);assert.equal(submitted.snapshot.claim.items[0].amount,100000);
save('claimSave',{...draft,id:claimId,repair:'TEST_AMENDED_REPAIR'});assert.equal(data.claims[0].status,'changed-after-submission');assert.deepEqual(data.claims[0].submissions[0],submitted,'submission snapshots immutable after edits');
assert.throws(()=>save('claimSubmitRecord',{id:claimId,submittedDate:'2026-09-27',channel:'TEST',referenceNo:'TEST'}),/review-stale/);
assert.throws(()=>save('claimReview',{id:claimId,expectedFingerprint:reviewed}),/review-stale/,'a current revision cannot approve an older displayed bundle');
save('claimReview',{id:claimId});assert.equal(data.claims[0].reviewCurrent,true);assert.equal(data.claims[0].status,'changed-after-submission','new review does not claim that amended evidence was submitted');
assert.throws(()=>save('claimSubmitRecord',{id:claimId,expectedFingerprint:reviewed,submittedDate:'2026-09-27',channel:'TEST',referenceNo:'TEST'}),/review-stale/,'submission is bound to the exact displayed/reviewed bundle');
assert.equal(context.teamBusinessDate_('2026-09-27T16:00:00Z'),'2026-09-28','Korean business date does not reject local today after midnight');
as('TEST_TECH_1');assert.equal(data.claims.length,0);assert(!JSON.stringify(data).includes('TEST_INSURER'));assert.throws(()=>call('claimBundle',{claimId}),/forbidden/);assert.throws(()=>save('claimReview',{id:claimId}),/forbidden/);
as('TEST_OWNER');const old=JSON.parse(files.get(JSON.parse(props.get('COMPANY_HEAD')).fileId).bytes.toString());delete old.projects;delete old.claims;delete old.evidence;assert.doesNotThrow(()=>context.teamPresent_(old,{userId:'TEST_OWNER',officeId:'TEST_OFFICE'}),'older snapshots project defaults remain readable');
const state=JSON.parse(files.get(JSON.parse(props.get('COMPANY_HEAD')).fileId).bytes.toString()),ownerIdentity={userId:'TEST_OWNER',officeId:'TEST_OFFICE'};
const companyConfig=context.companyConfig_(),privateHead=props.get('COMPANY_HEAD'),privateFileCount=files.size;
sharedFolder=true;
assert.throws(()=>call('list'),/private-storage-required/,'shared company folder cannot expose task/claim JSON');
assert.throws(()=>save('claimSave',{...draft,id:claimId}),/private-storage-required/,'shared company folder cannot accept claim JSON');
assert.equal(props.get('COMPANY_HEAD'),privateHead);assert.equal(files.size,privateFileCount,'blocked financial write creates no new snapshot');
assert.throws(()=>context.companyCommit_(companyConfig,state,privateHead),/private-storage-required/);assert.equal(files.size,privateFileCount,'commit verifies private root BEFORE snapshot creation');
props.delete('COMPANY_HEAD');props.set('COMPANY_OWNER_USER_ID','TEST_OWNER');props.set('COMPANY_OWNER_NAME','TEST_OWNER');
assert.throws(()=>context.companyBootstrapFromProperties_(),/private-storage-required/,'bootstrap never writes initial credentials/records into shared root');assert.equal(props.has('COMPANY_HEAD'),false);assert.equal(files.size,privateFileCount);
props.set('COMPANY_HEAD',privateHead);props.delete('COMPANY_OWNER_USER_ID');props.delete('COMPANY_OWNER_NAME');sharedFolder=false;
const headFile=files.get(JSON.parse(privateHead).fileId);headFile.shared=true;assert.throws(()=>call('list'),/private-storage-required/,'shared snapshot alone is rejected');assert.throws(()=>save('claimSave',{...draft,id:claimId}),/private-storage-required/);assert.equal(props.get('COMPANY_HEAD'),privateHead);headFile.shared=false;
headFile.parent='TEST_OTHER_FOLDER';assert.throws(()=>call('list'),/corrupt/,'snapshot cannot be moved outside company root');headFile.parent=folderId;
const apply=(s,who,action,entity,now='2026-09-27T16:00:00Z')=>{if(['claimReview','claimSubmitRecord'].includes(action))entity={...entity,expectedFingerprint:context.teamClaimBundle_(s,context.teamMember_(s,who),entity.id,context.companyDigest_).fingerprint};return context.teamApply_(s,who,action,{requestId:crypto.randomUUID(),revision:s.revision,entity},now,crypto.randomUUID(),context.companyDigest_);};
assert.doesNotThrow(()=>apply(state,ownerIdentity,'claimSubmitRecord',{id:claimId,submittedDate:'2026-09-28',channel:'TEST_KST',referenceNo:'TEST_KST_RECEIPT'}),'KST today accepted after UTC date boundary');
assert.throws(()=>apply(state,ownerIdentity,'claimSubmitRecord',{id:claimId,submittedDate:'2026-09-29',channel:'TEST_FUTURE',referenceNo:'TEST_FUTURE'}),/invalid-input/);
const archived=clone(state);archived.tasks=[archived.tasks.find(t=>t.id===first.id)];archived.tasks[0].status='done';archived.projects.find(p=>p.id===pa).active=false;
assert.doesNotThrow(()=>apply(archived,ownerIdentity,'taskSave',{...taskFields(archived.tasks[0]),handoff:'TEST_OWNER_CORRECTION'}),'owner can correct completed archived report without reopening');
assert.throws(()=>apply(archived,{userId:'TEST_TECH_1',officeId:'TEST_OFFICE'},'taskSave',{...taskFields(archived.tasks[0]),handoff:'TEST_WORKER_TAMPER'}),/forbidden/);
assert.throws(()=>apply(archived,ownerIdentity,'taskSave',{...taskFields(archived.tasks[0]),status:'doing'}),/invalid-project/,'archived project cannot resume work');
// ---- v333 staff media: HEIC originals, chunked video originals, idempotent resume, permission on every chunk ----
as('TEST_TECH_1');
const heic=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypheic'),Buffer.alloc(40,7)]),heicMeta={...uploadInput(first,'photo',heic),mime:'image/heic',name:'TEST_IPHONE.HEIC'};
save('evidenceUpload',heicMeta,{base64:heic.toString('base64')});assert.equal(data.evidence.find(e=>e.id===heicMeta.id).mime,'image/heic','HEIC original kept as HEIC, not converted');
assert.deepEqual(files.get(JSON.parse(files.get(JSON.parse(props.get('COMPANY_HEAD')).fileId).bytes.toString()).evidence.find(e=>e.id===heicMeta.id).fileId).bytes,heic,'stored bytes are the untouched original');
assert.throws(()=>save('evidenceUpload',{...uploadInput(),mime:'image/heic'},{base64:png.toString('base64')}),/invalid-file/,'renamed PNG cannot pose as HEIC');
assert.throws(()=>save('evidenceUpload',{...uploadInput(),duration:3},{base64:png.toString('base64')}),/invalid-input/,'photos never carry duration');
const video=Buffer.alloc(1024*1024+256*1024+77);for(let i=0;i<video.length;i++)video[i]=(i*31+7)&255;video.write('ftypisom',4,'latin1');
const videoEntity=(over={})=>({id:crypto.randomUUID(),projectId:first.projectId,taskId:first.id,kind:'video',mime:'video/mp4',name:'TEST_LEAK.mp4',size:video.length,sha256:hex(video),phase:'cause',caption:'TEST_VIDEO_EVIDENCE',capturedDate:'2026-09-29',duration:12.34,...over});
const chunkOf=(o,n=1024*1024)=>video.subarray(o,Math.min(video.length,o+n)).toString('base64');
const originals=()=>[...files.values()].filter(f=>f.type==='video/mp4').length;
assert.throws(()=>save('evidenceUpload',videoEntity(),{base64:video.toString('base64')}),/invalid-input/,'video is never a single base64 body');
assert.throws(()=>call('evidenceMediaBegin',{uploadId:crypto.randomUUID(),entity:videoEntity({size:100*1024*1024+1})}),/invalid-file/,'100MiB ceiling');
assert.throws(()=>call('evidenceMediaBegin',{uploadId:crypto.randomUUID(),entity:videoEntity({mime:'video/x-msvideo'})}),/invalid-file/);
assert.throws(()=>call('evidenceMediaBegin',{uploadId:crypto.randomUUID(),entity:videoEntity({duration:-1})}),/invalid-input/,'duration cannot be invented or negative');
assert.throws(()=>call('evidenceMediaBegin',{uploadId:crypto.randomUUID(),entity:videoEntity({taskId:other.id})}),/forbidden/,'only own assigned task');
const vEntity=videoEntity(),uploadId=crypto.randomUUID(),revBefore=call('list').data.revision;
let up=call('evidenceMediaBegin',{uploadId,entity:vEntity}).upload;assert.deepEqual([up.state,up.offset,up.size,up.chunkBytes],['uploading',0,video.length,1024*1024]);
assert.equal(call('list').data.revision,revBefore,'upload progress never creates company snapshots');
assert(!JSON.stringify(up).includes('TESTSESSION'),'resumable session URL never leaves the server');
assert.throws(()=>call('evidenceMediaBegin',{uploadId,entity:{...vEntity,caption:'CHANGED'}}),/request-conflict/);
assert.throws(()=>call('evidenceMediaChunk',{uploadId,offset:0,base64:video.subarray(0,1000).toString('base64')}),/invalid-input/,'non-final chunk must be 256KiB aligned');
{const fake=Buffer.from(video.subarray(0,1024*1024));fake.write('RIFF',0,'latin1');fake.write('WEBP',4,'latin1');assert.throws(()=>call('evidenceMediaChunk',{uploadId,offset:0,base64:fake.toString('base64')}),/invalid-file/,'first chunk must look like the declared video');}
up=call('evidenceMediaChunk',{uploadId,offset:0,base64:chunkOf(0)}).upload;assert.equal(up.offset,1024*1024);
up=call('evidenceMediaChunk',{uploadId,offset:0,base64:chunkOf(0)}).upload;assert.equal(up.offset,1024*1024,'resent chunk is not appended twice');
assert.throws(()=>save('evidenceUpload',vEntity,{uploadId}),/upload-incomplete/,'cannot commit before Drive has every byte');
as('TEST_LEAD');assert.throws(()=>call('evidenceMediaChunk',{uploadId,offset:1024*1024,base64:chunkOf(1024*1024)}),/forbidden/,'another member cannot continue my upload');
as('TEST_TECH_1');loseNextChunk=true;assert.throws(()=>call('evidenceMediaChunk',{uploadId,offset:1024*1024,base64:chunkOf(1024*1024)}),/busy/,'lost final response is retryable');
up=call('evidenceMediaBegin',{uploadId,entity:vEntity}).upload;assert.equal(up.state,'complete','status after restart comes from Drive, not the client');
up=call('evidenceMediaChunk',{uploadId,offset:1024*1024,base64:chunkOf(1024*1024)}).upload;assert.equal(up.state,'complete');assert.equal(originals(),1,'one original despite lost response and resend');
const commit=save('evidenceUpload',vEntity,{uploadId});const ve=data.evidence.find(e=>e.id===vEntity.id);
assert.deepEqual([ve.kind,ve.mime,ve.size,ve.duration],['video','video/mp4',video.length,12.3]);assert(!('fileId' in ve));
assert.equal(call('evidenceUpload',commit.p).replayed,true,'same requestId is a replay, not a second record');assert.equal(call('list').data.evidence.filter(e=>e.id===vEntity.id).length,1);
assert.equal(call('evidenceMediaBegin',{uploadId,entity:vEntity}).upload.state,'committed','restart after lost commit response learns it is done');
assert.throws(()=>call('evidenceRead',{evidenceId:vEntity.id}),/invalid-input/,'videos are only read in chunks');
const readAll=()=>{const parts=[];for(let o=0;o<video.length;){const c=call('evidenceReadChunk',{evidenceId:vEntity.id,offset:o,length:1024*1024}).chunk;parts.push(Buffer.from(c.base64,'base64'));o=c.nextOffset;if(c.eof)break;}return Buffer.concat(parts);};
assert.equal(hex(readAll()),hex(video));
as('TEST_TECH_2');assert.throws(()=>call('evidenceReadChunk',{evidenceId:vEntity.id,offset:0,length:10}),/forbidden/);
as('TEST_LEAD');assert.equal(hex(readAll()),hex(video),'lead of the team can verify the original');
const stored=[...files.values()].find(f=>f.type==='video/mp4'),good=stored.bytes;stored.bytes=Buffer.from(good);stored.bytes[5]^=1;
assert.throws(()=>call('evidenceReadChunk',{evidenceId:vEntity.id,offset:0,length:10}),/hash-mismatch/,'Drive checksum guards every read');stored.bytes=good;
// Permission is re-checked per chunk: a task approved mid-upload stops a member's upload.
as('TEST_TECH_1');const v2=videoEntity(),u2=crypto.randomUUID();call('evidenceMediaBegin',{uploadId:u2,entity:v2});
as('TEST_LEAD');{const t=data.tasks.find(t=>t.id===first.id);save('taskSave',{...taskFields(t),status:'review',handoff:'TEST_REVIEW'});save('taskSave',{...taskFields(data.tasks.find(t=>t.id===first.id)),status:'done'});}
as('TEST_TECH_1');assert.throws(()=>call('evidenceMediaChunk',{uploadId:u2,offset:0,base64:chunkOf(0)}),/forbidden/);
// HTTP body ceilings: a chunk fits, other small actions keep the 64k guard.
const viaPost=body=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).text);
assert.equal(viaPost({action:'evidenceMediaChunk',sessionToken:token,payload:{uploadId:u2,offset:0,base64:chunkOf(0)}}).error,'forbidden','1MiB chunk body passes the size gate');
assert.equal(viaPost({action:'list',sessionToken:token,payload:{pad:'x'.repeat(70000)}}).error,'invalid-input');
as('TEST_OWNER');
assert(!JSON.stringify([...files.values()].map(f=>f.bytes.toString())).includes(token),'session not persisted');assert.equal(locked,false);
console.log('PASS company-projects: HEIC originals, chunked/resumable video originals (idempotent, per-chunk permission, Drive checksum), 10-technician atomic dispatch, cross-team overlap, project authorization, private originals/hash/replay/storage-failure recovery, role-sensitive evidence, immutable claim review and manual submission snapshots');

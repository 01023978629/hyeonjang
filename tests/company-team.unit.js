'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=path.join(__dirname,'..','apps-script-team-ops');
let pure=fs.readFileSync(path.join(base,'TeamPure.gs'),'utf8');
if(process.env.HJ_TEAM_MUTATION==='scope')pure=pure.replace("return m.role==='owner' || (m.role==='lead' ? m.teamIds.indexOf(t.teamId)>=0 : t.assigneeId===m.id);","return true;");
if(process.env.HJ_TEAM_MUTATION==='history-reset')pure=pure.replace('task.history=old&&old.history?old.history.slice():[];', 'task.history=[];');
if(process.env.HJ_TEAM_MUTATION==='history-client')pure=pure.replace("'projectId','workDate','startTime','endTime','unitId']);", "'projectId','workDate','startTime','endTime','unitId','history']);");
if(process.env.HJ_TEAM_MUTATION==='revision')pure=pure.replace('payload.revision!==s.revision','false');
if(process.env.HJ_TEAM_MUTATION==='auth')pure=pure.replace("if (hits.length!==1) teamError_('forbidden'); return hits[0];","return hits[0] || s.members[0];");
let code=fs.readFileSync(path.join(base,'Code.gs'),'utf8');
// v333 진단 액션 변이: 대표 확인을 빼거나, 속성 값을 그대로 내보내거나, 실제 게이트 대신 모두 'ok' 로 꾸미면 검사가 떨어져야 한다.
if(process.env.HJ_TEAM_MUTATION==='diagnose-open')code=code.replace("if(teamMember_(loaded.state,identity).role!=='owner')teamError_('forbidden');","");
if(process.env.HJ_TEAM_MUTATION==='diagnose-leak')code=code.replace("COMPANY_FOLDER_ID:has('COMPANY_FOLDER_ID')","COMPANY_FOLDER_ID:p.getProperty('COMPANY_FOLDER_ID')");
if(process.env.HJ_TEAM_MUTATION==='diagnose-fake')pure=pure.replace("var v=teamPresent_(s,{userId:m.userId,officeId:m.officeId}),tasks=sortedIds(v.tasks);","var v={tasks:s.tasks,teams:s.teams,members:[],audit:[]},tasks=sortedIds(v.tasks);");
if(process.env.HJ_TEAM_MUTATION==='diagnose-write')code=code.replace("return {diagnosis:companyDiagnose_(c,loaded.state)};}","var dd=companyDiagnose_(c,loaded.state);companyCommit_(c,loaded.state,loaded.head);return {diagnosis:dd};}");
const props=new Map(),files=new Map(),cache=new Map();let identity={userId:'owner-user',officeId:'company-office'},clock=0,failWrite=false,authDown=false,authCalls=0,failCreate=false,corruptRead=false,lockHeld=false,active=true,expiry;
const folder='test-company-folder';
function file(id,text){return {getId:()=>id,getSharingAccess:()=>'PRIVATE',getEditors:()=>[],getViewers:()=>[],getBlob:()=>({getDataAsString:()=>corruptRead?text+'CORRUPT':text}),getParents:()=>{let read=false;return {hasNext:()=>!read,next:()=>{read=true;return {getId:()=>folder};}};}};}
const context={console,Date,Set,Number,JSON,Error,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.has(k)?props.get(k):null,setProperty(k,v){if(failWrite===true)throw Error('mock-write');props.set(k,v);if(failWrite==='after')throw Error('mock-response-lost');},deleteProperty:k=>props.delete(k)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
 LockService:{getScriptLock:()=>({tryLock(){assert(!lockHeld);lockHeld=true;return true;},waitLock(){assert(!lockHeld);lockHeld=true;},releaseLock(){lockHeld=false;}})},
 DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:id=>{if(!files.has(id))throw Error('missing');return file(id,files.get(id));},getFolderById:id=>{assert.equal(id,folder);return {getSharingAccess:()=>'PRIVATE',getEditors:()=>[],getViewers:()=>[],createFile(name,text){if(failCreate)throw Error('mock-create');const id='file-'+(++clock);files.set(id,text);return file(id,text);}};}},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(algo,text)=>[...crypto.createHash('sha256').update(text).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
 UrlFetchApp:{fetch(url,opts){assert.equal(lockHeld,false,'network must not hold the data lock');authCalls++;assert.equal(url,props.get('COMPANY_PORTAL_URL'));assert.equal(JSON.parse(opts.payload).action,'portalMe');if(authDown)throw Error('offline');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,user:{id:identity.userId,active,role:'resident',email:'TEST_ONLY@example.invalid'},office:{id:identity.officeId,active:true},expiresAt:expiry===undefined?Date.now()+60000:expiry})};}}
};
vm.createContext(context);vm.runInContext(pure,context);['TeamProjects.gs','TeamEvidence.gs'].forEach(name=>vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context));vm.runInContext(code,context);
props.set('COMPANY_ENABLED','1');props.set('COMPANY_FOLDER_ID',folder);props.set('COMPANY_OFFICE_ID','company-office');props.set('COMPANY_PORTAL_URL','https://script.google.com/macros/s/TEST_COMPANY_AUTH/exec');props.set('COMPANY_OWNER_USER_ID','owner-user');props.set('COMPANY_OWNER_NAME','TEST_OWNER');
context.companyBootstrapFromProperties_();assert.throws(()=>context.companyBootstrapFromProperties_(),/already-configured/);assert.equal(props.has('COMPANY_OWNER_USER_ID'),false);
const session='TEST_ONLY_SESSION_'.padEnd(80,'x');const call=(action,payload)=>context.companyDispatch_({action,payload,sessionToken:session});
let data=call('list').data;assert.equal(data.teams.length,4);assert.equal(data.me.role,'owner');const teamA=data.teams[1].id,teamB=data.teams[2].id;
function save(action,entity,requestId=crypto.randomUUID()){const payload={requestId,revision:data.revision,entity};const response=call(action,payload);data=response.data;return {payload,response};}
save('memberSave',{name:'TEST_A',userId:'user-a',officeId:'company-office',teamIds:[teamA],role:'member',active:true});const memberA=data.members.find(m=>m.userId==='user-a').id;
assert.throws(()=>save('memberSave',{name:'TEST_DUPLICATE',userId:' user-a ',officeId:'company-office',teamIds:[teamA],role:'member',active:true}),/invalid-input/);
assert.equal(call('list').data.members.filter(m=>m.userId==='user-a').length,1,'whitespace cannot create duplicate identity');
save('memberSave',{name:'TEST_B',userId:'user-b',officeId:'company-office',teamIds:[teamB],role:'lead',active:true});const memberB=data.members.find(m=>m.userId==='user-b').id;
const taskInput={title:'TEST_WORK',project:'TEST_PROJECT',teamId:teamA,assigneeId:memberA,due:'2026-09-30',status:'todo',handoff:'',sourceRef:'legacy-test-1'};
const first=save('taskSave',taskInput);const taskId=data.tasks[0].id;
let r=call('taskSave',first.payload);assert.equal(r.replayed,true);assert.equal(r.data.tasks.length,1);
assert.throws(()=>call('taskSave',{...first.payload,entity:{...taskInput,title:'CHANGED'}}),/request-conflict/);
assert.throws(()=>call('taskSave',{...first.payload,requestId:crypto.randomUUID()}),/conflict/);
assert.throws(()=>save('taskSave',taskInput),/duplicate-source/);
identity={userId:'unknown-user',officeId:'company-office'};assert.throws(()=>call('list'),/forbidden/);
identity={userId:'user-b',officeId:'company-office'};r=call('list');assert.equal(r.data.tasks.length,0,'another team cannot read work');assert(!JSON.stringify(r).includes('owner-user'),'no owner identity to lead');
identity={userId:'user-a',officeId:'company-office'};data=call('list').data;assert.equal(data.tasks.length,1);assert.equal(data.audit.length,0);assert(!('userId' in data.members[0]));
const fields=t=>Object.fromEntries(['id','title','project','teamId','assigneeId','due','status','handoff','sourceRef'].map(k=>[k,t[k]]));
let edit=fields(data.tasks[0]);assert.throws(()=>save('taskSave',{...edit,assigneeId:memberB,teamId:teamB}),/forbidden/);
assert.throws(()=>save('taskSave',{...edit,status:'done'}),/invalid-transition|forbidden/);
save('taskSave',{...edit,status:'doing'});edit=fields(data.tasks[0]);
assert.throws(()=>save('taskSave',{...edit,status:'review',handoff:''}),/handoff-required/);
save('taskSave',{...edit,status:'review',handoff:'TEST_FINISH_REPORT'});edit=fields(data.tasks[0]);assert.throws(()=>save('taskSave',{...edit,status:'done'}),/forbidden/);
assert.throws(()=>save('teamSave',{name:'ILLEGAL',active:true}),/forbidden/);
identity={userId:'owner-user',officeId:'company-office'};data=call('list').data;save('taskSave',{...edit,status:'done'});assert.equal(data.tasks[0].status,'done');
const self=data.members.find(m=>m.id===data.me.id);assert.throws(()=>save('memberSave',{...self,active:false}),/self-lockout/);
const actor=data.members.find(m=>m.id===memberA);save('memberSave',{...actor,active:false});
identity={userId:'user-a',officeId:'company-office'};assert.throws(()=>call('list'),/forbidden/);
identity={userId:'owner-user',officeId:'WRONG_OFFICE'};assert.throws(()=>call('list'),/session-expired/);
identity={userId:'owner-user',officeId:'company-office'};authDown=true;assert.throws(()=>call('list'),/auth-unavailable/);authDown=false;
data=call('list').data;const oldHead=props.get('COMPANY_HEAD');failWrite=true;assert.throws(()=>save('teamSave',{name:'TEST_FAILURE',active:true}),/mock-write/);failWrite=false;assert.equal(props.get('COMPANY_HEAD'),oldHead);assert.equal(call('list').data.teams.some(t=>t.name==='TEST_FAILURE'),false);
cache.clear();
failCreate=true;assert.throws(()=>save('teamSave',{name:'CREATE_FAILURE',active:true}),/mock-create/);failCreate=false;assert.equal(props.get('COMPANY_HEAD'),oldHead);
const originalCreate=context.DriveApp.getFolderById;
context.DriveApp.getFolderById=id=>{const f=originalCreate(id);return {...f,createFile(...args){const created=f.createFile(...args);corruptRead=true;return created;}};};
assert.throws(()=>save('teamSave',{name:'VERIFY_FAILURE',active:true}),/storage-failed/);corruptRead=false;context.DriveApp.getFolderById=originalCreate;assert.equal(props.get('COMPANY_HEAD'),oldHead);
const retry={requestId:crypto.randomUUID(),revision:data.revision,entity:{name:'RESPONSE_LOST',active:true}};
failWrite='after';assert.throws(()=>call('teamSave',retry),/mock-response-lost/);failWrite=false;
r=call('teamSave',retry);assert.equal(r.replayed,true);assert.equal(r.data.teams.filter(t=>t.name==='RESPONSE_LOST').length,1,'commit before response loss is not duplicated');data=r.data;
active=false;assert.throws(()=>call('list'),/session-expired/);active=true;
expiry=Infinity;assert.throws(()=>call('list'),/session-expired/);expiry=undefined;
const authority=props.get('COMPANY_PORTAL_URL');props.set('COMPANY_PORTAL_URL','https://script.google.com/macros/s/OTHER_AUTHORITY/exec');assert.throws(()=>call('list'),/configuration-mismatch/);props.set('COMPANY_PORTAL_URL',authority);
cache.clear();const beforeAuth=authCalls;for(let i=0;i<60;i++)context.companyRateGate_(session);assert.throws(()=>call('list'),/rate-limited/);assert.equal(authCalls,beforeAuth,'rate gate precedes network');assert(!JSON.stringify([...cache.keys()]).includes(session));assert(cache.size<=2);assert.equal(lockHeld,false);
assert(authCalls>20,'every request validates current identity');
assert(!JSON.stringify([...files.values()]).includes(session),'session never persisted');assert(!JSON.stringify([...files.values()]).includes('@example.invalid'),'portal email never persisted');
assert(data.audit.every(a=>!('text' in a)&&!('email' in a)),'audit metadata only');
const clone=x=>JSON.parse(JSON.stringify(x)),digest=x=>crypto.createHash('sha256').update(x).digest('hex');
let isolated={schema:1,revision:0,requests:[],audit:[],teams:[{id:'a',name:'TEST_A',active:true},{id:'b',name:'TEST_B',active:true}],members:[{id:'o',userId:'o',officeId:'office',role:'owner',name:'TEST_OWNER',teamIds:['a','b'],active:true},{id:'m',userId:'m',officeId:'office',role:'member',name:'TEST_MEMBER',teamIds:['a'],active:true},{id:'l',userId:'l',officeId:'office',role:'lead',name:'TEST_LEAD',teamIds:['b'],active:true},{id:'dual',userId:'dual',officeId:'office',role:'member',name:'TEST_DUAL',teamIds:['a','b'],active:true}],tasks:[{id:'work',title:'TEST_WORK',project:'TEST_SITE',teamId:'a',assigneeId:'m',due:'',status:'todo',handoff:'ORIGINAL_REPORT',sourceRef:'',updatedAt:'2026-09-01T00:00:00Z',updatedBy:'o'},{id:'closed',title:'TEST_CLOSED',project:'TEST_SITE',teamId:'a',assigneeId:'l',due:'',status:'done',handoff:'',sourceRef:'',updatedAt:'2026-09-01T00:00:00Z',updatedBy:'o'}]};
const ownerIdentity={userId:'o',officeId:'office'},memberIdentity={userId:'m',officeId:'office'};
const projectLead=clone(context.teamPresent_(isolated,{userId:'l',officeId:'office'}));assert.equal(projectLead.tasks.length,0,'lead cannot retain other-team completed assignment access');assert.deepEqual(projectLead.members.find(m=>m.id==='dual').teamIds,['b'],'peer teamIds are intersected with authorized teams');
function applyReport(entity,who=ownerIdentity,requestId=crypto.randomUUID()){const payload={requestId,revision:isolated.revision,entity};const result=context.teamApply_(isolated,who,'taskSave',payload,'2026-09-27T03:00:00Z',crypto.randomUUID(),digest);isolated=clone(result.store);return payload;}
applyReport(fields(isolated.tasks[0]));assert.equal(isolated.tasks[0].history,undefined);assert.equal(isolated.tasks[0].updatedAt,'2026-09-01T00:00:00Z','no-op preserves legacy timestamp');
const report=applyReport({...fields(isolated.tasks[0]),status:'doing',handoff:'FIRST_REPORT'},memberIdentity);assert.equal(isolated.tasks[0].history.length,2);assert.equal(isolated.tasks[0].history[0].handoff,'ORIGINAL_REPORT');assert.equal(isolated.tasks[0].history[0].at,'2026-09-01T00:00:00Z');assert.equal(isolated.tasks[0].history[1].actorId,'m');
const retryHistory=context.teamApply_(isolated,memberIdentity,'taskSave',report,'2099-01-01T00:00:00Z','UNUSED',digest);assert.equal(retryHistory.replayed,true);assert.deepEqual(clone(retryHistory.store),isolated,'retry appends no report');
assert.throws(()=>applyReport({...fields(isolated.tasks[0]),history:[]}),/invalid-input/,'caller cannot forge or erase history');
applyReport({...fields(isolated.tasks[0]),status:'review',handoff:'REVIEW_REPORT'},memberIdentity);assert.equal(isolated.tasks[0].history.length,3);assert.equal(isolated.tasks[0].history[1].handoff,'FIRST_REPORT');
assert.throws(()=>applyReport({...fields(isolated.tasks[0]),status:'doing'}),/review-note-required/);
applyReport({...fields(isolated.tasks[0]),status:'doing',handoff:'REWORK_REASON'});assert.equal(isolated.tasks[0].history.at(-1).actorId,'o');
isolated.tasks[0].history=Array.from({length:100},(_,i)=>({...isolated.tasks[0].history[0],revision:i}));applyReport(fields(isolated.tasks[0]));assert.equal(isolated.tasks[0].history.length,100,'no-op at history limit still succeeds');const fullBefore=JSON.stringify(isolated);
assert.throws(()=>applyReport({...fields(isolated.tasks[0]),handoff:'OVER_LIMIT'}),/capacity/);assert.equal(JSON.stringify(isolated),fullBefore,'capacity failure preserves all history');
// v333 권한 점검(companyDiagnose): 대표만, 읽기 전용, 속성은 있음/없음만, 구성원마다 실제 게이트 결과.
identity={userId:'owner-user',officeId:'company-office'};cache.clear();
data=call('list').data;
save('memberSave',{name:'TEST_C',userId:'user-c',officeId:'company-office',teamIds:[teamA],role:'external',active:true});
const ext=data.members.find(m=>m.userId==='user-c').id;
save('taskSave',{title:'TEST_DIAG_A',project:'TEST_DIAG',teamId:teamA,assigneeId:ext,due:'',status:'todo',handoff:'',sourceRef:''});
save('taskSave',{title:'TEST_DIAG_B',project:'TEST_DIAG',teamId:teamB,assigneeId:memberB,due:'',status:'todo',handoff:'',sourceRef:''});
const headBefore=props.get('COMPANY_HEAD'),filesBefore=files.size;
const diag=JSON.parse(JSON.stringify(call('companyDiagnose').diagnosis));
assert.equal(props.get('COMPANY_HEAD'),headBefore,'diagnose must not commit');assert.equal(files.size,filesBefore,'diagnose must not write a snapshot');
assert.equal(diag.revision,data.revision);assert.equal(diag.service,'company-team-v3');assert.equal(diag.authorityBound,true);
assert.deepEqual(diag.properties,{COMPANY_ENABLED:true,COMPANY_PORTAL_URL:true,COMPANY_FOLDER_ID:true,COMPANY_OFFICE_ID:true,COMPANY_HEAD:true,COMPANY_OWNER_USER_ID:false,COMPANY_OWNER_NAME:false});
const diagText=JSON.stringify(diag);
for(const secret of [folder,'company-office',props.get('COMPANY_PORTAL_URL'),'owner-user','user-b','user-c',JSON.parse(headBefore).fileId,session])assert(!diagText.includes(secret),'diagnosis leaks a raw value: '+secret);
const dm=Object.fromEntries(diag.members.map(m=>[m.id,m])),hash=a=>crypto.createHash('sha256').update(JSON.stringify(a.slice().sort())).digest('base64url');
const all=data.tasks.map(t=>t.id);
const ownerRow=diag.members.find(m=>m.role==='owner');assert.equal(ownerRow.access,'ok');assert.equal(ownerRow.visibleTasks,all.length);assert.equal(ownerRow.visibleTaskDigest,hash(all));assert.equal(ownerRow.seesIdentities,true);assert.equal(ownerRow.seesAudit,true);assert.deepEqual(ownerRow.assignableTeamIds,data.teams.map(t=>t.id).sort());
const leadRow=dm[memberB],leadSees=data.tasks.filter(t=>t.teamId===teamB).map(t=>t.id);assert.equal(leadRow.access,'ok');assert.equal(leadRow.visibleTaskDigest,hash(leadSees),'lead sees own team only');assert.deepEqual(leadRow.visibleTeamIds,[teamB]);assert.deepEqual(leadRow.assignableTeamIds,[teamB]);assert.equal(leadRow.seesIdentities,false);assert.equal(leadRow.seesAudit,false);
const extRow=dm[ext];assert.equal(extRow.access,'ok');assert.equal(extRow.visibleTasks,1);assert.equal(extRow.visibleTaskDigest,hash(data.tasks.filter(t=>t.assigneeId===ext).map(t=>t.id)));assert.deepEqual(extRow.assignableTeamIds,[]);assert.equal(extRow.seesIdentities,false);
assert.equal(dm[memberA].active,false);assert.equal(dm[memberA].access,'forbidden','inactive member is blocked by the real gate');
assert(diag.members.every(m=>m.linked===true&&m.duplicate===false));assert(diag.members.every(m=>!('userId' in m)&&!('officeId' in m)));
assert.equal(diag.tasks.total,data.tasks.length);
assert.throws(()=>context.companyDispatch_({action:'companyDiagnose',sessionToken:session,payload:{peek:true}}),/invalid-input/);
identity={userId:'user-b',officeId:'company-office'};assert.throws(()=>call('companyDiagnose'),/forbidden/,'lead cannot run the owner diagnosis');
identity={userId:'user-c',officeId:'company-office'};assert.throws(()=>call('companyDiagnose'),/forbidden/,'external cannot run the owner diagnosis');
identity={userId:'unknown-user',officeId:'company-office'};assert.throws(()=>call('companyDiagnose'),/forbidden/);
identity={userId:'owner-user',officeId:'company-office'};
props.set('COMPANY_OWNER_NAME','LEFTOVER');assert.equal(call('companyDiagnose').diagnosis.properties.COMPANY_OWNER_NAME,true,'leftover bootstrap property is reported');props.delete('COMPANY_OWNER_NAME');
props.delete('COMPANY_ENABLED');assert.throws(()=>call('companyDiagnose'),/not-configured/);props.set('COMPANY_ENABLED','1');
assert.equal(props.get('COMPANY_HEAD'),headBefore);assert.equal(lockHeld,false);
console.log('PASS company-team: authorization, immutable reports, legacy no-op baseline, history replay/capacity, scoped peer membership, review note, revision, issuer binding, storage failures, redaction, owner-only read-only diagnosis');

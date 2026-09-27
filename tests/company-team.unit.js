'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=path.join(__dirname,'..','apps-script-team-ops');
let pure=fs.readFileSync(path.join(base,'TeamPure.gs'),'utf8');
if(process.env.HJ_TEAM_MUTATION==='scope')pure=pure.replace("return m.role==='owner' || (m.role==='lead' && m.teamIds.indexOf(t.teamId)>=0) || t.assigneeId===m.id;","return true;");
if(process.env.HJ_TEAM_MUTATION==='revision')pure=pure.replace('payload.revision!==s.revision','false');
if(process.env.HJ_TEAM_MUTATION==='auth')pure=pure.replace("if (hits.length!==1) teamError_('forbidden'); return hits[0];","return hits[0] || s.members[0];");
const props=new Map(),files=new Map(),cache=new Map();let identity={userId:'owner-user',officeId:'company-office'},clock=0,failWrite=false,authDown=false,authCalls=0,failCreate=false,corruptRead=false,lockHeld=false,active=true,expiry;
const folder='test-company-folder';
function file(id,text){return {getId:()=>id,getBlob:()=>({getDataAsString:()=>corruptRead?text+'CORRUPT':text}),getParents:()=>{let read=false;return {hasNext:()=>!read,next:()=>{read=true;return {getId:()=>folder};}};}};}
const context={console,Date,Set,Number,JSON,Error,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.has(k)?props.get(k):null,setProperty(k,v){if(failWrite===true)throw Error('mock-write');props.set(k,v);if(failWrite==='after')throw Error('mock-response-lost');},deleteProperty:k=>props.delete(k)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
 LockService:{getScriptLock:()=>({tryLock(){assert(!lockHeld);lockHeld=true;return true;},waitLock(){assert(!lockHeld);lockHeld=true;},releaseLock(){lockHeld=false;}})},
 DriveApp:{getFileById:id=>{if(!files.has(id))throw Error('missing');return file(id,files.get(id));},getFolderById:id=>{assert.equal(id,folder);return {createFile(name,text){if(failCreate)throw Error('mock-create');const id='file-'+(++clock);files.set(id,text);return file(id,text);}};}},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(algo,text)=>[...crypto.createHash('sha256').update(text).digest()],base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
 UrlFetchApp:{fetch(url,opts){assert.equal(lockHeld,false,'network must not hold the data lock');authCalls++;assert.equal(url,props.get('COMPANY_PORTAL_URL'));assert.equal(JSON.parse(opts.payload).action,'portalMe');if(authDown)throw Error('offline');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,user:{id:identity.userId,active,role:'resident',email:'TEST_ONLY@example.invalid'},office:{id:identity.officeId,active:true},expiresAt:expiry===undefined?Date.now()+60000:expiry})};}}
};
vm.createContext(context);vm.runInContext(pure,context);vm.runInContext(fs.readFileSync(path.join(base,'Code.gs'),'utf8'),context);
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
context.DriveApp.getFolderById=id=>{const f=originalCreate(id);return {createFile(...args){const created=f.createFile(...args);corruptRead=true;return created;}};};
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
console.log('PASS company-team: authorization, organization, assignment, review, revision, replay, identity canonicalization, issuer binding, bounded rate gate, immutable storage failures, redaction');

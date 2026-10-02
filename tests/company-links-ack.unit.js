/* Synthetic company only. Never calls Google, writes originals or creates real users. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const clone=v=>JSON.parse(JSON.stringify(v)),digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const context=vm.createContext({console,companyDigest_:digest});
const mutant=process.env.HJ_LINKS_MUTATION||'';
const mutations={
 'unit-authority':['TeamPure.gs',"'endTime','unitId'].some(function(k){return (e[k]||'')!==(old[k]||'');}","'endTime'].some(function(k){return (e[k]||'')!==(old[k]||'');}"],
 'ack-authority':['TeamProjects.gs',"||old.assigneeId!==actor.id",''],
 'ack-stale':['TeamProjects.gs',"e.assignmentVersion!==(old.assignmentVersion||0)",'false'],
 'unit-leak':['TeamProjects.gs',"v.units=(v.units||[]).filter(function(u){return result.tasks.some(function(t){return t.projectId===p.id&&t.unitId===u.id;});});",''],
 'evidence-unit':['TeamProjects.gs',"||(old.unitId||'')!==unitId",''],
 'ack-invalidation':['TeamPure.gs',"task.assignmentVersion=assignmentChanged?s.revision+1:(old.assignmentVersion||0);","task.assignmentVersion=old?old.assignmentVersion||0:0;"],
 'link-immutable':['TeamProjects.gs',"if(old&&old.sourceKey&&old.sourceKey!==sourceKey)teamError_('project-immutable');",''],
 'legacy-unit':['TeamPure.gs',"if(old&&e.unitId===undefined&&(e.projectId||'')===(old.projectId||'')){e=teamClone_(e);e.unitId=old.unitId||'';}",'']
};
for(const file of ['TeamPure.gs','TeamProjects.gs','TeamEvidence.gs']){
 let src=fs.readFileSync(path.join(__dirname,'..','apps-script-team-ops',file),'utf8');
 if(mutant&&mutations[mutant]?.[0]===file){const [,a,b]=mutations[mutant];assert(src.includes(a),'mutation anchor missing: '+mutant);src=src.replace(a,b);}
 vm.runInContext(src,context);
}
const sourceKey=crypto.randomUUID();
const units=[{id:'u1',type:'unit',dong:'101',ho:'501',name:''},{id:'u2',type:'unit',dong:'102',ho:'602',name:''},{id:'c1',type:'common',dong:'',ho:'',name:'지하실'}];
const identities={owner:{userId:'TEST_OWNER',officeId:'TEST_OFFICE'},lead:{userId:'TEST_LEAD',officeId:'TEST_OFFICE'},member:{userId:'TEST_MEMBER',officeId:'TEST_OFFICE'},other:{userId:'TEST_OTHER',officeId:'TEST_OFFICE'}};
let s={schema:1,revision:0,audit:[],requests:[],tasks:[],teams:[{id:'t1',name:'TEST_PIPE',active:true},{id:'t2',name:'TEST_INTERIOR',active:true}],members:Object.keys(identities).map((k,i)=>({id:k,...identities[k],name:'TEST_'+k,role:k==='other'?'external':k,active:true,teamIds:i===3?['t2']:['t1']}))};
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function save(action,entity,actor='owner',payload){const p=payload||{requestId:crypto.randomUUID(),revision:s.revision,entity};const r=context.teamApply_(s,identities[actor],action,p,'2026-10-02T00:00:00Z',crypto.randomUUID(),digest);s=clone(r.store);return {p,r};}
function view(actor){return clone(context.teamPresent_(s,identities[actor]));}
function editable(t){const fields=['id','title','project','projectId','unitId','teamId','assigneeId','due','status','handoff','sourceRef','workDate','startTime','endTime'];return Object.fromEntries(fields.filter(k=>t[k]!==undefined).map(k=>[k,t[k]]));}
test('owner explicit stable source and locations; no automatic name merge',()=>{save('projectSave',{name:'TEST_APARTMENT',teamIds:['t1','t2'],active:true,sourceKey,units});assert.deepEqual(s.projects[0].units,units);assert.deepEqual(view('owner').capabilities,['project-units-v1','task-ack-v1']);});
const projectId=s.projects[0].id;
test('source-key unique and immutable; malformed or duplicate locations fail atomically',()=>{
 const before=clone(s);assert.throws(()=>save('projectSave',{name:'TEST_SECOND',teamIds:['t1'],active:true,sourceKey,units}),/duplicate-source/);
 assert.throws(()=>save('projectSave',{...s.projects[0],sourceKey:crypto.randomUUID()}),/project-immutable/);
 for(const bad of [[units[0],units[0]],[{...units[0],dong:101}],[{...units[0],ho:'0001'}],[{...units[0],note:'PRIVATE_NOTE'}]])assert.throws(()=>save('projectSave',{...s.projects[0],units:bad}),/invalid-input|duplicate/);
 assert.deepEqual(s,before);
});
save('taskSave',{title:'TEST_REPAIR',project:'ignored',projectId,unitId:'u1',teamId:'t1',assigneeId:'member',due:'2026-10-03',status:'todo',handoff:'',sourceRef:''});
let t=s.tasks[0];
test('only assigned apartment units visible; no owner source key leaks',()=>{const d=view('member');assert.deepEqual(d.projects[0].units,[units[0]]);assert(!('sourceKey' in d.projects[0]));assert.equal(view('other').projects.length,0);});
test('staff cannot relabel location; unknown/cross-project units rejected',()=>{
 const before=clone(s);assert.throws(()=>save('taskSave',{...editable(t),unitId:'u2'},'member'),/forbidden/);
 assert.throws(()=>save('taskSave',{...editable(t),unitId:'missing'}),/invalid-unit/);assert.deepEqual(s,before);
});
test('only current assignee accepts; no client timestamp/receipts allowed',()=>{
 const e={id:t.id,assignmentVersion:t.assignmentVersion};assert.throws(()=>save('taskAcknowledge',e,'lead'),/forbidden/);assert.throws(()=>save('taskAcknowledge',e,'other'),/forbidden/);
 assert.throws(()=>save('taskAcknowledge',{...e,at:'FAKE'},'member'),/invalid-input/);
 const r=save('taskAcknowledge',e,'member');const after=clone(s);save('taskAcknowledge',e,'member',r.p);assert.deepEqual(s,after);assert.equal(s.tasks[0].acknowledgements[0].at,'2026-10-02T00:00:00Z');
 save('taskAcknowledge',e,'member');assert.equal(s.tasks[0].acknowledgements.length,1);
});
test('progress preserves receipt; assignment change invalidates and stale receipt cannot sign new task',()=>{
 const v=t.assignmentVersion;save('taskSave',{...editable(s.tasks[0]),status:'doing'},'member');assert.equal(s.tasks[0].assignmentVersion,v);
 save('taskSave',{...editable(s.tasks[0]),due:'2026-10-04'});t=s.tasks[0];assert(t.assignmentVersion>v);assert.equal(t.acknowledgements.length,1);
 assert.throws(()=>save('taskAcknowledge',{id:t.id,assignmentVersion:v},'member'),/ack-stale/);
 save('taskAcknowledge',{id:t.id,assignmentVersion:t.assignmentVersion},'member');assert.equal(s.tasks[0].acknowledgements.length,2);
});
test('in-use unit cannot be removed or renamed; old-client project edit preserves linkage',()=>{
 const before=clone(s);assert.throws(()=>save('projectSave',{...s.projects[0],units:[units[1]]}),/unit-in-use/);
 assert.throws(()=>save('projectSave',{...s.projects[0],units:[{...units[0],ho:'999'},units[1]]}),/unit-in-use/);assert.deepEqual(s,before);
 save('projectSave',{id:projectId,name:'TEST_RENAMED_APARTMENT',teamIds:['t1','t2'],active:true});assert.deepEqual(s.projects[0].units,units);assert.equal(s.projects[0].sourceKey,sourceKey);
});
test('manager changes handoff instructions require acceptance again; client receipt/version forgery rejected',()=>{
 const v=s.tasks[0].assignmentVersion;save('taskSave',{...editable(s.tasks[0]),handoff:'TEST_CHANGED_INSTRUCTIONS'});assert(s.tasks[0].assignmentVersion>v);
 assert.throws(()=>save('taskSave',{...editable(s.tasks[0]),assignmentVersion:0}),/invalid-input/);assert.throws(()=>save('taskSave',{...editable(s.tasks[0]),acknowledgements:[]}),/invalid-input/);
});
test('photo-bound unit stays immutable; no metadata movement on edit',()=>{
 s.evidence=[{id:'TEST_EVIDENCE',taskId:t.id,projectId,kind:'photo'}];const before=clone(s);assert.throws(()=>save('taskSave',{...editable(s.tasks[0]),unitId:'u2'}),/evidence-bound/);assert.deepEqual(s,before);
});

test('old client progress report preserves photo-bound location and request identity',()=>{
 const e={...editable(s.tasks[0]),handoff:'TEST_WORKER_PROGRESS'};delete e.unitId;
 const p={requestId:crypto.randomUUID(),revision:s.revision,entity:e},before=clone(p),v=s.tasks[0].assignmentVersion;
 save('taskSave',e,'member',p);assert.deepEqual(p,before);assert.equal(s.tasks[0].unitId,'u1');assert.equal(s.tasks[0].assignmentVersion,v);
 const after=clone(s);save('taskSave',e,'member',p);assert.deepEqual(s,after);
});
test('old stored task with no version is explicitly accepted at 0; capped receipt history preserved',()=>{
 s.evidence=[];delete s.tasks[0].assignmentVersion;delete s.tasks[0].acknowledgements;
 save('taskAcknowledge',{id:t.id,assignmentVersion:0},'member');assert.equal(s.tasks[0].acknowledgements[0].assignmentVersion,0);
 s.tasks[0].assignmentVersion=s.revision;s.tasks[0].acknowledgements=Array.from({length:100},()=>({memberId:'member',assignmentVersion:0,at:'TEST_HISTORY'}));const before=clone(s);
 assert.throws(()=>save('taskAcknowledge',{id:t.id,assignmentVersion:s.revision},'member'),/capacity/);assert.deepEqual(s,before);
});
console.log('company-links-ack: '+count+'/'+count+' PASS');

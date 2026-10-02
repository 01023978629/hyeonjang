/* Company authorization is deliberately independent of apartment-office roles. */
'use strict';
function teamError_(code) { throw new Error(code); }
function teamText_(v, max) { if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f]/.test(v)) teamError_('invalid-input'); return v.trim(); }
function teamId_(v) { var id=teamText_(v,100);if(id!==v)teamError_('invalid-input');return id; }
function teamKeys_(v, keys) { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(function(k){return keys.indexOf(k)<0;})) teamError_('invalid-input'); }
function teamDate_(v) { var d=new Date(v+'T00:00:00Z');if (typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==v) teamError_('invalid-input'); return v; }
function teamClone_(v) { return JSON.parse(JSON.stringify(v)); }
function teamMember_(s, identity) {
  var hits=s.members.filter(function(m){return m.userId===identity.userId && m.officeId===identity.officeId && m.active===true;});
  if (hits.length!==1) teamError_('forbidden'); return hits[0];
}
function teamCanSee_(m,t) { return m.role==='owner' || (m.role==='lead' ? m.teamIds.indexOf(t.teamId)>=0 : t.assigneeId===m.id); }
function teamCanAssign_(m,teamId) { return m.role==='owner' || (m.role==='lead' && m.teamIds.indexOf(teamId)>=0); }
function teamPresent_(s, identity) {
  var m=teamMember_(s,identity),tasks=s.tasks.filter(function(t){return teamCanSee_(m,t);});
  var teams=s.teams.filter(function(t){return m.role==='owner'||m.teamIds.indexOf(t.id)>=0;});
  var ids=tasks.map(function(t){return t.assigneeId;});ids.push(m.id);
  var members=s.members.filter(function(u){return m.role==='owner'||(m.role==='lead'&&u.teamIds.some(function(id){return m.teamIds.indexOf(id)>=0;}))||ids.indexOf(u.id)>=0;}).map(function(u){
    var out={id:u.id,name:u.name,teamIds:u.teamIds.filter(function(id){return teams.some(function(t){return t.id===id;});}),role:u.role,active:u.active};
    if(m.role==='owner'){out.userId=u.userId;out.officeId=u.officeId;}return out;
  });
  var result={revision:s.revision,me:{id:m.id,name:m.name,role:m.role,teamIds:m.teamIds},teams:teams,members:members,tasks:tasks,
    audit:m.role==='owner'?s.audit.slice(-100).reverse():[]};
  return teamProjectsPresent_(s,m,result);
}
/* Owner-only read-only diagnosis. It runs every linked member through the real gates
 * (teamMember_/teamPresent_/teamCanAssign_) so the owner can compare the result with the
 * role rules on screen. Raw portal identifiers, folder/office ids and URLs are never returned. */
function teamDiagnose_(s, office, digest) {
  var sortedIds=function(a){return a.map(function(x){return x.id;}).sort();};
  var members=s.members.map(function(m){
    var out={id:m.id,name:m.name,role:m.role,active:m.active===true,teamIds:m.teamIds.slice(),
      linked:typeof m.userId==='string'&&!!m.userId&&m.officeId===office,
      duplicate:s.members.filter(function(x){return x.active===true&&x.userId===m.userId&&x.officeId===m.officeId;}).length>1};
    try{
      var v=teamPresent_(s,{userId:m.userId,officeId:m.officeId}),tasks=sortedIds(v.tasks);
      out.access='ok';out.visibleTasks=tasks.length;out.visibleTaskDigest=digest(JSON.stringify(tasks));out.visibleTeamIds=sortedIds(v.teams);
      out.seesIdentities=v.members.some(function(u){return Object.prototype.hasOwnProperty.call(u,'userId');});
      out.seesAudit=s.audit.length?v.audit.length>0:null;
    }catch(e){out.access=String(e&&e.message||'server-error');}
    out.assignableTeamIds=s.teams.filter(function(t){return teamCanAssign_(m,t.id);}).map(function(t){return t.id;}).sort();
    return out;
  });
  return {revision:s.revision,teams:{active:s.teams.filter(function(t){return t.active;}).length,inactive:s.teams.filter(function(t){return !t.active;}).length},
    tasks:{total:s.tasks.length,open:s.tasks.filter(function(t){return t.status!=='done';}).length},members:members};
}
function teamApply_(store, identity, action, payload, now, newId, digest, attachment) {
  var s=teamClone_(store),actor=teamMember_(s,identity);
  teamKeys_(payload,['requestId','revision','entity']);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.requestId||''))teamError_('invalid-input');
  var hash=digest(JSON.stringify([actor.id,action,payload])),prior=s.requests.filter(function(r){return r.id===payload.requestId;})[0];
  if(prior){if(prior.hash!==hash)teamError_('request-conflict');return {store:store,replayed:true};}
  if(!Number.isSafeInteger(payload.revision)||payload.revision!==s.revision)teamError_('conflict');
  var e=payload.entity,targetId='',entityKind='',old;
  if(action==='teamSave') {
    if(actor.role!=='owner')teamError_('forbidden');teamKeys_(e,['id','name','active']);
    var name=teamText_(e.name,60);if(typeof e.active!=='boolean')teamError_('invalid-input');
    old=s.teams.find(function(t){return t.id===e.id;});if(e.id&&!old)teamError_('not-found');
    if(s.teams.some(function(t){return t.id!==e.id&&t.name===name;}))teamError_('duplicate');
    if(old&&!e.active&&(s.members.some(function(m){return m.active&&m.teamIds.indexOf(old.id)>=0;})||s.tasks.some(function(t){return t.teamId===old.id&&t.status!=='done';})))teamError_('team-in-use');
    targetId=old?old.id:newId;entityKind='team';var team={id:targetId,name:name,active:e.active};
    s.teams=old?s.teams.map(function(t){return t===old?team:t;}):s.teams.concat([team]);
  } else if(action==='memberSave') {
    if(actor.role!=='owner')teamError_('forbidden');teamKeys_(e,['id','name','userId','officeId','teamIds','role','active']);
    teamId_(e.userId);teamId_(e.officeId); // Validate before every identity comparison; never normalize after deduplication.
    if(['owner','lead','member','external'].indexOf(e.role)<0||typeof e.active!=='boolean'||!Array.isArray(e.teamIds)||e.teamIds.length>20||new Set(e.teamIds).size!==e.teamIds.length)teamError_('invalid-input');
    if(e.teamIds.some(function(id){return !s.teams.some(function(t){return t.id===id&&t.active;});}))teamError_('invalid-team');
    if(e.officeId!==identity.officeId)teamError_('forbidden');
    old=s.members.find(function(m){return m.id===e.id;});if(e.id&&!old)teamError_('not-found');
    if(old&&old.id===actor.id&&(e.role!=='owner'||!e.active||e.userId!==actor.userId||e.officeId!==actor.officeId))teamError_('self-lockout');
    if(s.members.some(function(m){return m.id!==e.id&&m.userId===e.userId&&m.officeId===e.officeId;}))teamError_('duplicate');
    if(old&&(old.userId!==e.userId||old.officeId!==e.officeId))teamError_('identity-immutable');
    if(old&&s.tasks.some(function(t){return t.assigneeId===old.id&&t.status!=='done'&&(!e.active||e.teamIds.indexOf(t.teamId)<0);}))teamError_('reassign-open-tasks');
    targetId=old?old.id:newId;entityKind='member';var member={id:targetId,name:teamText_(e.name,60),userId:teamId_(e.userId),officeId:teamId_(e.officeId),teamIds:e.teamIds.slice(),role:e.role,active:e.active};
    s.members=old?s.members.map(function(m){return m===old?member:m;}):s.members.concat([member]);
    if(!s.members.some(function(m){return m.active&&m.role==='owner';}))teamError_('last-owner');
  } else if(action==='taskSave') {
    teamKeys_(e,['id','title','project','teamId','assigneeId','due','status','handoff','sourceRef','projectId','workDate','startTime','endTime','unitId']);
    old=s.tasks.find(function(t){return t.id===e.id;});if(e.id&&!old)teamError_('not-found');
    if(old&&!teamCanSee_(actor,old))teamError_('forbidden');
    // A still-open old client omits the new optional field. Never erase its existing location.
    if(old&&e.unitId===undefined&&(e.projectId||'')===(old.projectId||'')){e=teamClone_(e);e.unitId=old.unitId||'';}
    var assign=teamCanAssign_(actor,e.teamId)&&(!old||teamCanAssign_(actor,old.teamId));
    if(!s.teams.some(function(t){return t.id===e.teamId&&t.active;}))teamError_('invalid-team');
    if(!s.members.some(function(m){return m.id===e.assigneeId&&m.active&&m.teamIds.indexOf(e.teamId)>=0;}))teamError_('invalid-assignee');
    if(!assign&&(!old||old.assigneeId!==actor.id||['title','project','teamId','assigneeId','due','sourceRef','projectId','workDate','startTime','endTime','unitId'].some(function(k){return (e[k]||'')!==(old[k]||'');})))teamError_('forbidden');
    if(!assign&&old&&old.status==='done'&&['status','handoff'].some(function(k){return (e[k]||'')!==(old[k]||'');}))teamError_('forbidden');
    var transitions={todo:['doing','blocked','review'],doing:['blocked','review'],blocked:['doing','review'],review:['doing','done'],done:['doing']};
    if(!Object.prototype.hasOwnProperty.call(transitions,e.status))teamError_('invalid-input');
    if(!old&&e.status!=='todo')teamError_('invalid-transition');
    if(old&&e.status!==old.status&&transitions[old.status].indexOf(e.status)<0)teamError_('invalid-transition');
    if((e.status==='done'||old&&old.status==='done'&&e.status!=='done')&&!assign)teamError_('forbidden');
    var handoff=typeof e.handoff==='string'?e.handoff:'';if(handoff.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(handoff))teamError_('invalid-input');
    if(['blocked','review'].indexOf(e.status)>=0&&!handoff.trim())teamError_('handoff-required');
    if(old&&old.status==='review'&&e.status==='doing'&&(!handoff.trim()||handoff===old.handoff))teamError_('review-note-required');
    targetId=old?old.id:newId;entityKind='task';
    var task={id:targetId,title:teamText_(e.title,160),project:teamText_(e.project,160),teamId:e.teamId,assigneeId:e.assigneeId,due:e.due?teamDate_(e.due):'',status:e.status,handoff:handoff,sourceRef:e.sourceRef?teamText_(e.sourceRef,150):'',updatedAt:now,updatedBy:actor.id};
    teamTaskProject_(s,actor,e,task,old);
    if(task.sourceRef&&s.tasks.some(function(t){return t.id!==targetId&&t.sourceRef===task.sourceRef;}))teamError_('duplicate-source');
    // Only the server appends reports; client-supplied history is rejected by teamKeys_.
    var changed=!old||['title','project','teamId','assigneeId','due','status','handoff','sourceRef','projectId','workDate','startTime','endTime','unitId'].some(function(k){return (old[k]||'')!==(task[k]||'');});
    if(changed){
      // Assignment receipts survive progress reports, but never a changed location, person or schedule.
      var assignmentChanged=!old||['title','project','projectId','unitId','teamId','assigneeId','due','workDate','startTime','endTime'].some(function(k){return (old[k]||'')!==(task[k]||'');})||assign&&actor.id!==task.assigneeId&&old.handoff!==task.handoff;
      task.assignmentVersion=assignmentChanged?s.revision+1:(old.assignmentVersion||0);
      if(old&&old.acknowledgements)task.acknowledgements=old.acknowledgements.slice();
      task.history=old&&old.history?old.history.slice():[];
      if(old&&!old.history)task.history.push({at:old.updatedAt,actorId:old.updatedBy,status:old.status,handoff:old.handoff,teamId:old.teamId,assigneeId:old.assigneeId,revision:0,baseline:true});
      if(task.history.length>=100)teamError_('capacity');
      task.history.push({at:now,actorId:actor.id,status:task.status,handoff:task.handoff,teamId:task.teamId,assigneeId:task.assigneeId,revision:s.revision+1,baseline:false});
    }else task=old; // A no-op must not replace the original report timestamp or legacy baseline.
    s.tasks=old?s.tasks.map(function(t){return t===old?task:t;}):s.tasks.concat([task]);
  } else {
    var extra=teamProjectMutation_(s,actor,action,e,now,newId,digest,identity,attachment,payload);
    targetId=extra.id;entityKind=extra.kind;
  }
  if(s.teams.length>50||s.members.length>100||s.tasks.length>2000||s.requests.length>=10000)teamError_('capacity');
  s.revision++;s.audit.push({at:now,actorId:actor.id,action:action,targetId:targetId,kind:entityKind,revision:s.revision});
  s.requests.push({id:payload.requestId,hash:hash});return {store:s,replayed:false};
}

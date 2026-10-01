/* Private company projects, scheduling and insurance preparation. No insurer submission API. */
'use strict';
function teamList_(s,k){if(s[k]===undefined)return [];if(!Array.isArray(s[k]))teamError_('corrupt');return s[k];}
function teamOptional_(v,max){if(v===undefined||v==='')return '';return teamText_(v,max);}
function teamLong_(v,max){if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))teamError_('invalid-input');return v.trim();}
function teamUuid_(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v))teamError_('invalid-input');return v;}
function teamBusinessDate_(iso){return new Date(new Date(iso).getTime()+9*60*60*1000).toISOString().slice(0,10);} // Fixed company manifest zone: Asia/Seoul.
function teamProject_(s,id){var p=teamList_(s,'projects').find(function(p){return p.id===id;});if(!p)teamError_('not-found');return p;}
function teamProjectVisible_(s,m,p){return m.role==='owner'||(m.role==='lead'?p.teamIds.some(function(id){return m.teamIds.indexOf(id)>=0;}):s.tasks.some(function(t){return t.projectId===p.id&&t.assigneeId===m.id;}));}
function teamEvidenceVisible_(s,m,e){
  var p=teamList_(s,'projects').find(function(p){return p.id===e.projectId;});if(!p||!teamProjectVisible_(s,m,p))return false;
  if(e.kind==='document')return m.role==='owner';
  var t=s.tasks.find(function(t){return t.id===e.taskId&&t.projectId===e.projectId;});return !!t&&teamCanSee_(m,t);
}
function teamEvidencePublic_(e){var out={};['id','projectId','taskId','kind','phase','caption','capturedDate','name','mime','size','sha256','uploaderId','uploadedAt'].forEach(function(k){out[k]=e[k];});if(e.kind==='video')out.duration=e.duration===undefined?'':e.duration;return out;}
function teamProjectsPresent_(s,m,result){
  result.projects=teamList_(s,'projects').filter(function(p){return teamProjectVisible_(s,m,p);}).map(function(p){var v=teamClone_(p);if(m.role!=='owner')v.teamIds=v.teamIds.filter(function(id){return m.teamIds.indexOf(id)>=0;});return v;});
  result.evidence=teamList_(s,'evidence').filter(function(e){return teamEvidenceVisible_(s,m,e);}).map(teamEvidencePublic_);
  result.claims=m.role==='owner'?teamList_(s,'claims').map(function(c){var v=teamClone_(c),source=teamClaimSource_(s,c),fingerprint=companyDigest_(JSON.stringify(source));delete v.review;v.reviewCurrent=!!c.review&&c.review.fingerprint===fingerprint;v.reviewedAt=c.review?c.review.at:'';v.reviewStale=!!c.review&&!v.reviewCurrent;v.readiness=teamClaimReadiness_(source.evidence);v.status=v.reviewCurrent?'ready':'draft';if(c.submissions&&c.submissions.length)v.status=c.submissions[c.submissions.length-1].fingerprint===fingerprint?'submitted':'changed-after-submission';return v;}):[];
  return result;
}
function teamTaskProject_(s,actor,e,t,old){
  var projectId=e.projectId||'';
  if(old&&(old.projectId||'')!==projectId&&teamList_(s,'evidence').some(function(ev){return ev.taskId===old.id;}))teamError_('evidence-bound');
  if(projectId){var p=teamProject_(s,teamId_(projectId));if(p.teamIds.indexOf(t.teamId)<0||!p.active&&(!old||old.projectId!==p.id||t.status!=='done'))teamError_('invalid-project');t.projectId=p.id;t.project=p.name;}
  var date=e.workDate||'',start=e.startTime||'',end=e.endTime||'';
  if(date||start||end){
    teamDate_(date);if(typeof start!=='string'||typeof end!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end)teamError_('invalid-schedule');
    t.workDate=date;t.startTime=start;t.endTime=end;
    if(t.status!=='done'&&s.tasks.some(function(x){return x.id!==t.id&&x.status!=='done'&&x.assigneeId===t.assigneeId&&x.workDate===date&&x.startTime<end&&start<x.endTime;}))teamError_('schedule-conflict');
  }
}
function teamClaimSource_(s,c){
  var p=teamProject_(s,c.projectId),selected=c.selectedEvidenceIds.map(function(id){var e=teamList_(s,'evidence').find(function(e){return e.id===id&&e.projectId===p.id;});if(!e)teamError_('evidence-missing');return teamEvidencePublic_(e);});
  var ids=selected.map(function(e){return e.taskId;});
  return {claim:{id:c.id,projectId:c.projectId,mode:c.mode,insurerName:c.insurerName,referenceNo:c.referenceNo,accidentDate:c.accidentDate,incident:c.incident,cause:c.cause,repair:c.repair,items:c.items,selectedEvidenceIds:c.selectedEvidenceIds,insurerConfirmed:c.insurerConfirmed,consentConfirmed:c.consentConfirmed},project:teamClone_(p),tasks:s.tasks.filter(function(t){return t.projectId===p.id&&ids.indexOf(t.id)>=0;}).map(teamClone_),evidence:selected};
}
// 대표 결정 2026-10-01: stage readiness is 선택 사항 (optional) — a WARNING, never a gate. Neither claimReview nor claimSubmitRecord
// may raise claim-incomplete because a stage photo or the PDF is missing; claim-incomplete stays for the claim's own fields.
// The note travels in the response so the screen and the server say the same words. Mirrored in team-projects.js readiness().
var TEAM_CLAIM_STAGES=['before','cause','after'];
var TEAM_CLAIM_STAGE_NOTE='선택 사항 — 없어도 제출 준비·기록을 막지 않습니다';
function teamClaimReadiness_(evidence){
  var out={photos:{before:0,cause:0,after:0},documents:0,warnings:[],optional:true,note:TEAM_CLAIM_STAGE_NOTE};
  (evidence||[]).forEach(function(e){if(e&&e.kind==='photo'&&TEAM_CLAIM_STAGES.indexOf(e.phase)>=0)out.photos[e.phase]++;else if(e&&e.kind==='document'&&e.mime==='application/pdf')out.documents++;});
  TEAM_CLAIM_STAGES.forEach(function(k){if(!out.photos[k])out.warnings.push('missing-'+k);});if(!out.documents)out.warnings.push('missing-document');
  return out;
}
function teamClaimFingerprint_(s,c,digest){return digest(JSON.stringify(teamClaimSource_(s,c)));}
function teamClaimBundle_(s,actor,id,digest){
  if(actor.role!=='owner')teamError_('forbidden');var c=teamList_(s,'claims').find(function(c){return c.id===id;});if(!c)teamError_('not-found');
  var source=teamClaimSource_(s,c),fingerprint=digest(JSON.stringify(source));return {claim:source.claim,project:source.project,tasks:source.tasks,evidence:source.evidence,fingerprint:fingerprint,reviewCurrent:!!c.review&&c.review.fingerprint===fingerprint,readiness:teamClaimReadiness_(source.evidence),submissions:teamClone_(c.submissions||[])};
}
function teamProjectMutation_(s,actor,action,e,now,newId,digest,identity,attachment,payload){
  var list,old,record,id;
  if(action==='taskBatch'){
    teamKeys_(e,['tasks']);if(!Array.isArray(e.tasks)||!e.tasks.length||e.tasks.length>10||actor.role!=='owner'&&actor.role!=='lead')teamError_('forbidden');
    var draft=s;
    e.tasks.forEach(function(t,i){if(t.id)teamError_('invalid-input');var inner={requestId:payload.requestId,revision:draft.revision,entity:t};
      // Reuse task rules on an isolated candidate, never commit a partial batch or synthetic receipt.
      var work=teamClone_(draft);work.requests=[];var r=teamApply_(work,identity,'taskSave',inner,now,newId+'-'+(i+1),digest);
      draft.tasks=r.store.tasks;
    });
    return {id:newId,kind:'taskBatch'};
  }
  if(action==='projectSave'){
    if(actor.role!=='owner')teamError_('forbidden');teamKeys_(e,['id','name','teamIds','active']);
    if(typeof e.active!=='boolean'||!Array.isArray(e.teamIds)||!e.teamIds.length||e.teamIds.length>20||new Set(e.teamIds).size!==e.teamIds.length||e.teamIds.some(function(id){return !s.teams.some(function(t){return t.id===id&&t.active;});}))teamError_('invalid-team');
    list=teamList_(s,'projects');old=list.find(function(p){return p.id===e.id;});if(e.id&&!old)teamError_('not-found');var name=teamText_(e.name,160);
    if(list.some(function(p){return p.id!==e.id&&p.name===name;}))teamError_('duplicate');
    if(old&&s.tasks.some(function(t){return t.projectId===old.id&&(e.teamIds.indexOf(t.teamId)<0||!e.active&&t.status!=='done');}))teamError_('project-in-use');
    record={id:old?old.id:newId,name:name,teamIds:e.teamIds.slice(),active:e.active};s.projects=old?list.map(function(p){return p===old?record:p;}):list.concat([record]);if(s.projects.length>500)teamError_('capacity');return {id:record.id,kind:'project'};
  }
  if(action==='evidenceUpload'){
    var meta=teamEvidenceValidate_(s,actor,e);
    if(!attachment||typeof attachment.fileId!=='string'||attachment.binding!==digest(JSON.stringify([actor.id,e])))teamError_('storage-failed');
    list=teamList_(s,'evidence');if(list.some(function(x){return x.id===meta.id;}))teamError_('duplicate');
    meta.fileId=attachment.fileId;meta.uploaderId=actor.id;meta.uploadedAt=now;s.evidence=list.concat([meta]);if(s.evidence.length>3000)teamError_('capacity');return {id:meta.id,kind:'evidence'};
  }
  if(['claimSave','claimReview','claimSubmitRecord'].indexOf(action)<0)teamError_('invalid-action');
  if(actor.role!=='owner')teamError_('forbidden');
  list=teamList_(s,'claims');old=list.find(function(c){return c.id===e.id;});if(e.id&&!old)teamError_('not-found');
  if(action==='claimSave'){
    teamKeys_(e,['id','projectId','mode','insurerName','referenceNo','accidentDate','incident','cause','repair','items','selectedEvidenceIds','insurerConfirmed','consentConfirmed']);
    teamProject_(s,teamId_(e.projectId));if(old&&old.projectId!==e.projectId)teamError_('project-immutable');
    if(['undecided','customer-support','contractor-billing'].indexOf(e.mode)<0||typeof e.insurerConfirmed!=='boolean'||typeof e.consentConfirmed!=='boolean'||!Array.isArray(e.items)||e.items.length>50||!Array.isArray(e.selectedEvidenceIds)||e.selectedEvidenceIds.length>50||new Set(e.selectedEvidenceIds).size!==e.selectedEvidenceIds.length)teamError_('invalid-input');
    var total=0,items=e.items.map(function(x){teamKeys_(x,['kind','description','amount']);if(['cause','restore','other'].indexOf(x.kind)<0||!Number.isSafeInteger(x.amount)||x.amount<0||x.amount>1000000000)teamError_('invalid-input');total+=x.amount;return {kind:x.kind,description:teamText_(x.description,240),amount:x.amount};});if(total>10000000000)teamError_('capacity');
    record={id:old?old.id:newId,projectId:e.projectId,mode:e.mode,insurerName:teamOptional_(e.insurerName,100),referenceNo:teamOptional_(e.referenceNo,100),accidentDate:e.accidentDate?teamDate_(e.accidentDate):'',incident:teamLong_(e.incident,3000),cause:teamLong_(e.cause,3000),repair:teamLong_(e.repair,3000),items:items,selectedEvidenceIds:e.selectedEvidenceIds.slice(),insurerConfirmed:e.insurerConfirmed,consentConfirmed:e.consentConfirmed,updatedAt:now,updatedBy:actor.id,submissions:old?old.submissions||[]:[]};
    var selected=teamClaimSource_(s,record).evidence;if(selected.reduce(function(sum,x){return sum+x.size;},0)>50*1024*1024)teamError_('capacity');if(old&&old.review)record.review=old.review;
  }else{
    if(!old)teamError_('not-found');record=teamClone_(old);
    if(action==='claimReview'){
      teamKeys_(e,['id','expectedFingerprint']);teamText_(e.expectedFingerprint,100);if(e.expectedFingerprint!==teamClaimFingerprint_(s,record,digest))teamError_('review-stale');
      if(record.mode==='undecided'||!record.insurerName||!record.accidentDate||record.accidentDate>teamBusinessDate_(now)||!record.incident||!record.cause||!record.repair||!record.items.length||!record.insurerConfirmed||!record.consentConfirmed)teamError_('claim-incomplete');
      var source=teamClaimSource_(s,record);if(!source.evidence.some(function(x){return x.kind==='photo';}))teamError_('claim-incomplete');
      record.review={at:now,actorId:actor.id,fingerprint:digest(JSON.stringify(source)),snapshot:source,warnings:teamClaimReadiness_(source.evidence).warnings};
    }else{
      teamKeys_(e,['id','submittedDate','channel','referenceNo','expectedFingerprint']);teamText_(e.expectedFingerprint,100);var fingerprint=teamClaimFingerprint_(s,record,digest);
      if(e.expectedFingerprint!==fingerprint)teamError_('review-stale');
      if(!record.review||record.review.fingerprint!==fingerprint)teamError_('review-stale');
      var submittedDate=teamDate_(e.submittedDate);if(submittedDate>teamBusinessDate_(now))teamError_('invalid-input');
      if(record.submissions.length>=30)teamError_('capacity');record.submissions.push({id:newId,at:now,actorId:actor.id,submittedDate:submittedDate,channel:teamText_(e.channel,100),referenceNo:teamText_(e.referenceNo,100),fingerprint:fingerprint,snapshot:teamClone_(record.review.snapshot)});
    }
  }
  s.claims=old?list.map(function(c){return c===old?record:c;}):list.concat([record]);if(s.claims.length>300)teamError_('capacity');return {id:record.id,kind:'claim'};
}

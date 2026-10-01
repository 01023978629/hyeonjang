/* Representative-only local operations. Not an employee authorization layer. */
'use strict';
function hjUnitLifecycleSave(name,unitId,input){
  const p=aptUnitProject(name),unit=p&&aptUnitList(p).find(u=>u.id===unitId);
  if(!unit)throw new Error('등록된 위치를 다시 선택하세요.');
  const before=paidStableJson(unit),startedAt=String(input.startedAt||''),doneAt=String(input.doneAt||''),text=String(input.text||'').trim(),date=String(input.date||localDate());
  // v333 방문·보수 기록을 그 세대의 작업건에 잇는다(비우면 작업건 미지정). 착공·완료일은 세대 단위 그대로.
  const jobId=String(input.jobId||'');if(jobId&&!hjUnitJobFind(p,unitId,jobId))throw new Error('작업건을 다시 선택하세요.');
  if([startedAt,doneAt].some(d=>d&&!isRealIsoDate(d))||!isRealIsoDate(date)||doneAt&&doneAt>localDate()||startedAt&&doneAt&&startedAt>doneAt||date>localDate()||text.length>1000)throw new Error('날짜·작업 기록을 확인하세요. 완료·방문일은 미래로 입력할 수 없습니다.');
  return aptUnitMutation({snapshotLabel:'세대 완료일·보수 기록 변경 전',mutateDraft:draft=>{
    const current=aptUnitProject(name,draft),u=current&&aptUnitList(current).find(x=>x.id===unitId);
    if(!u||paidStableJson(u)!==before)throw new Error('위치 정보가 변경되었습니다. 다시 열어 주세요.');
    const old=u.lifecycle||{},history=Array.isArray(old.history)?old.history.slice():[];
    if(history.length>=200)throw new Error('이력 200건에 도달했습니다. 기존 이력은 보존했습니다.');
    if(text||startedAt!==(old.startedAt||'')||doneAt!==(old.doneAt||'')){
      if(jobId&&text)hjUnitJobEnsureDraft(draft,name,unitId,jobId);
      history.push({id:uid(),at:new Date().toISOString(),date,text,startedAt,doneAt,...(jobId&&text?{jobId}:{})});
    }
    u.lifecycle={startedAt,doneAt,history};return true;
  }});
}
function hjUnitLifecycleView(name,unitId,jobId){
  const p=aptUnitProject(name),u=p&&aptUnitList(p).find(x=>x.id===unitId);if(!u)return toast('등록된 위치를 다시 선택하세요.');
  const l=u.lifecycle||{},E=escapeHtml,A=escapeAttr,jobs=hjUnitJobsOf(p,u),jobTitle=id=>{const j=id&&jobs.find(x=>x.id===id);return j?' · '+j.title:'';};
  if(!jobs.some(j=>j.id===jobId))jobId='';
  openModal('세대·공용부 작업 이력','<section id="unitLife"><p>'+E(name+' · '+aptUnitLabel(u))+'</p><p>다른 세대와 현장 전체 준공일은 바꾸지 않습니다. 보수 방문 기록만 추가하면 원공사 완료일은 유지됩니다.</p><label>착공일<input id="lifeStart" type="date" value="'+A(l.startedAt||'')+'"></label><label>원공사 완료일<input id="lifeDone" type="date" max="'+localDate()+'" value="'+A(l.doneAt||'')+'"></label><label>작업·방문일<input id="lifeDate" type="date" max="'+localDate()+'" value="'+localDate()+'"></label><label>작업건<select id="lifeJob"><option value="">작업건 미지정</option>'+jobs.map(j=>'<option value="'+A(j.id)+'"'+(j.id===jobId?' selected':'')+'>'+E(j.title)+'</option>').join('')+'</select></label><label>추가할 작업·보수 기록<textarea id="lifeText" maxlength="1000" rows="3"></textarea></label><p id="lifeError" role="alert"></p><details><summary>변경·방문 이력 '+(l.history||[]).length+'건</summary>'+(l.history||[]).slice().reverse().map(x=>'<p>'+E(x.date+' · '+(x.text||'날짜 수정')+jobTitle(x.jobId)+' · 완료일 '+(x.doneAt||'미입력'))+'</p>').join('')+'</details></section>',[
    {label:'목록으로',cls:'ghost',fn:()=>aptUnitView(name,unitId,80,jobId)},
    {label:'저장',cls:'blue',fn:async()=>{const get=id=>document.getElementById(id).value;try{await hjUnitLifecycleSave(name,unitId,{startedAt:get('lifeStart'),doneAt:get('lifeDone'),date:get('lifeDate'),text:get('lifeText'),jobId:get('lifeJob')});hjUnitLifecycleView(name,unitId,get('lifeJob'));toast('이 기기에 저장했습니다. 다른 기기는 최신 자료를 불러오세요.');}catch(e){document.getElementById('lifeError').textContent=e.message;}}}
  ],true);hjOpsFormStyle('unitLife');
}
function hjWarrantyContext(name,unitId,snapshot){
  const p=aptUnitProject(name);if(!p)return null;
  const unit=unitId?aptUnitList(p).find(u=>u.id===unitId):null;if(unitId&&!unit)return null;
  if(snapshot){if(snapshot.projectName!==name||snapshot.unitId!==(unitId||'')||!isRealIsoDate(snapshot.doneAt)||!snapshot.warranty||!Array.isArray(snapshot.warranty.items))return null;return structuredClone(snapshot);}
  const ownDate=unit&&unit.lifecycle&&unit.lifecycle.doneAt;
  const doneAt=ownDate||p.doneAt||'';if(doneAt&&!isRealIsoDate(doneAt))return null;
  let warranty=hjWarranty(p);
  if(ownDate){const items=(warranty?.items||WARRANTY_ITEMS_DEFAULT).map(it=>({name:it.name,months:it.months,expiresAt:hjAddMonths(ownDate,it.months)}));warranty={startedAt:ownDate,items,end:items.reduce((v,it)=>it.expiresAt>v?it.expiresAt:v,'')};}
  return {projectName:name,unitId:unitId||'',doneAt,warranty:warranty?structuredClone(warranty):null,source:ownDate?'세대 완료일':unit?'세대 완료일 미입력 · 현장 준공일 기준':'현장 준공일'};
}
function hjCostSource(name,data){
  const d=data||serializeData(),p=aptUnitProject(name,d);if(!p)throw new Error('현장을 다시 선택하세요.');
  const rows=k=>(d[k]||[]).filter(x=>x.project===name).slice().sort((a,b)=>paidStableJson(a).localeCompare(paidStableJson(b)));
  return paidStableJson({name,cost:p.cost||{},received:p.received||0,files:rows('files').filter(f=>f.kind==='estimate'),expenses:rows('expenses'),quotes:rows('quotes'),payLog:rows('payLog'),schedule:rows('schedule')});
}
function hjCostReviewStatus(name){
  const p=aptUnitProject(name),r=p?.costReview;if(!r?.closedAt)return '정산 확인 전';
  return r.sourceFingerprint===hjCostSource(name)?'검토한 자료 기준 마감':'마감 후 자료 변경 · 재검토 필요';
}
async function hjCostReviewSave(name,input,expected){
  const status=input.status,keys=['material','labor','outsource','etc'],reviewer=String(input.reviewer||'').trim(),memo=String(input.memo||'').trim();
  if(!reviewer||reviewer.length>60||memo.length>1000||!status||keys.some(k=>!['pending','none','confirmed'].includes(status[k])))throw new Error('확인자와 항목별 상태를 입력하세요.');
  const values=projStats(name);if(keys.some(k=>status[k]==='none'&&Number(k==='etc'?values.costEtc:values[k])!==0))throw new Error('금액이 있는 항목은 해당 없음으로 처리할 수 없습니다.');
  if(input.close&&keys.some(k=>status[k]==='pending'))throw new Error('모든 항목을 확인한 뒤 마감하세요.');
  if(hjCostSource(name)!==expected)throw new Error('검토 중 자료가 바뀌었습니다. 다시 열어 확인하세요.');
  const old=paidStableJson(aptUnitProject(name)?.costReview||null);
  return durableLocalMutation({snapshotLabel:'현장 원가 검토·마감 전',mutateDraft:d=>{
    const p=aptUnitProject(name,d);if(!p||hjCostSource(name,d)!==expected||paidStableJson(p.costReview||null)!==old)throw new Error('자료 변경으로 중단했습니다. 다시 검토하세요.');
    const previous=p.costReview||{},history=previous.history||[];if(history.length>=100)throw new Error('마감 이력 한도에 도달했습니다. 기존 기록은 보존했습니다.');
    const at=new Date().toISOString();
    p.costReview={status:{...status},reviewer,memo,reviewedAt:at,closedAt:input.close?at:'',sourceFingerprint:input.close?expected:'',history:history.concat([{at,reviewer,closed:!!input.close}])};return true;
  }});
}
function hjOpsFormStyle(id){const root=document.getElementById(id);if(!root)return;root.style.cssText='font-size:16px;overflow-wrap:anywhere';root.querySelectorAll('input,select,textarea').forEach(el=>el.style.cssText='display:block;box-sizing:border-box;width:100%;font-size:16px;min-height:44px;margin:6px 0 12px');}
function hjCostReviewView(name){
  const p=aptUnitProject(name||state.activeProject);
  if(!p){openModal('원가 검토할 현장','<label>현장<select id="costProject">'+selectableProjects().map(x=>'<option value="'+escapeAttr(x.name)+'">'+escapeHtml(x.name)+'</option>').join('')+'</select></label>',[{label:'열기',cls:'blue',fn:()=>hjCostReviewView(document.getElementById('costProject').value)},{label:'닫기',cls:'ghost',fn:closeModal}]);return;}
  const s=projStats(p.name),r=p.costReview||{},source=hjCostSource(p.name),keys={material:'자재비',labor:'인건비',outsource:'외주비',etc:'기타경비'};
  openModal('현장 원가 검토·마감','<section id="costReview"><p>'+escapeHtml(p.name)+' · '+escapeHtml(hjCostReviewStatus(p.name))+'</p><p>마감은 확인 기록입니다. 장부를 잠그거나 금액·수금·세금을 변경하지 않습니다. 확인자 이름은 직접 입력하며 직원 인증과 별개입니다.</p>'+Object.entries(keys).map(([k,label])=>'<label>'+label+' · '+won(k==='etc'?s.costEtc:s[k])+'<select id="cost_'+k+'">'+[['pending','입력 중'],['none','해당 없음'],['confirmed','확인 완료']].map(([v,t])=>'<option value="'+v+'"'+((r.status?.[k]||'pending')===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>').join('')+'<label>확인자<input id="costReviewer" maxlength="60" value="'+escapeAttr(r.reviewer||'')+'"></label><label>검토 메모<textarea id="costMemo" maxlength="1000">'+escapeHtml(r.memo||'')+'</textarea></label><p id="costReviewError" role="alert"></p></section>',[
    {label:'검토 저장',cls:'ghost',fn:()=>save(false)},{label:'확인 후 마감',cls:'blue',fn:()=>save(true)},{label:'닫기',cls:'ghost',fn:closeModal}
  ],true);hjOpsFormStyle('costReview');
  async function save(close){try{await hjCostReviewSave(p.name,{close,status:Object.fromEntries(Object.keys(keys).map(k=>[k,document.getElementById('cost_'+k).value])),reviewer:document.getElementById('costReviewer').value,memo:document.getElementById('costMemo').value},source);hjCostReviewView(p.name);}catch(e){document.getElementById('costReviewError').textContent=e.message;}}
}
function hjCompanyDrafts(tasks){
  if(!tasks.length)return toast('이전할 미완료 업무가 없습니다.');
  if(tasks.length>100)return toast('100건 이내로 현장을 좁혀 주세요. 원본 업무는 변경하지 않았습니다.');
  if(!confirm('현장명·업무 내용 '+tasks.length+'건을 이 PC/폰에 JSON 초안으로 내려받습니다.\n직원 포털에서 내용을 검토하고 팀·담당자를 지정한 뒤 개별 등록하세요. 기존 업무는 변경하지 않습니다.'))return;
  const url=URL.createObjectURL(new Blob([JSON.stringify({format:'company-task-drafts-v1',tasks},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='company-task-drafts.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function hjCompanyLegacyExport(){hjCompanyDrafts(hjTeamList().filter(n=>hjTeamData(n).status!=='done').map(n=>{const t=hjTeamData(n);return {title:t.title,project:n.project||'공통 업무',due:t.due||'',handoff:t.handoff||'',sourceRef:'legacy-team:'+n.id};}));}
function hjCompanySharedExport(){const s=__hjSharedTodo;if(!hjSharedTodoCurrent(s)||!s.ready||s.busy||s.pending)return toast('공유 할일의 최신 조회·저장 결과를 먼저 확인하세요.');const project=s.root.querySelector('#stFilter').value;hjCompanyDrafts(s.tasks.filter(t=>!t.done&&(!project||t.project===project)).map(t=>({title:t.text.slice(0,160),project:t.project,due:'',handoff:t.text.length>160?t.text:'',sourceRef:'shared-todo:'+t.id})));}

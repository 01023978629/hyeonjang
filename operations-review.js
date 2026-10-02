/* Representative-only local operations. Not an employee authorization layer. */
'use strict';
function hjUnitLifecycleSave(name,unitId,input){
  const p=aptUnitProject(name),unit=p&&aptUnitList(p).find(u=>u.id===unitId);
  if(!unit)throw new Error('등록된 위치를 다시 선택하세요.');
  const before=paidStableJson(unit),startedAt=String(input.startedAt||''),doneAt=String(input.doneAt||''),text=String(input.text||'').trim(),date=String(input.date||localDate());
  if([startedAt,doneAt].some(d=>d&&!isRealIsoDate(d))||!isRealIsoDate(date)||doneAt&&doneAt>localDate()||startedAt&&doneAt&&startedAt>doneAt||date>localDate()||text.length>1000)throw new Error('날짜·작업 기록을 확인하세요. 완료·방문일은 미래로 입력할 수 없습니다.');
  return aptUnitMutation({snapshotLabel:'세대 완료일·보수 기록 변경 전',mutateDraft:draft=>{
    const current=aptUnitProject(name,draft),u=current&&aptUnitList(current).find(x=>x.id===unitId);
    if(!u||paidStableJson(u)!==before)throw new Error('위치 정보가 변경되었습니다. 다시 열어 주세요.');
    const old=u.lifecycle||{},history=Array.isArray(old.history)?old.history.slice():[];
    if(history.length>=200)throw new Error('이력 200건에 도달했습니다. 기존 이력은 보존했습니다.');
    if(text||startedAt!==(old.startedAt||'')||doneAt!==(old.doneAt||''))history.push({id:uid(),at:new Date().toISOString(),date,text,startedAt,doneAt});
    u.lifecycle={startedAt,doneAt,history};return true;
  }});
}
function hjUnitLifecycleView(name,unitId){
  const p=aptUnitProject(name),u=p&&aptUnitList(p).find(x=>x.id===unitId);if(!u)return toast('등록된 위치를 다시 선택하세요.');
  const l=u.lifecycle||{},E=escapeHtml,A=escapeAttr;
  openModal('세대·공용부 작업 이력','<section id="unitLife"><p>'+E(name+' · '+aptUnitLabel(u))+'</p><p>다른 세대와 현장 전체 준공일은 바꾸지 않습니다. 보수 방문 기록만 추가하면 원공사 완료일은 유지됩니다.</p><label>착공일<input id="lifeStart" type="date" value="'+A(l.startedAt||'')+'"></label><label>원공사 완료일<input id="lifeDone" type="date" max="'+localDate()+'" value="'+A(l.doneAt||'')+'"></label><label>작업·방문일<input id="lifeDate" type="date" max="'+localDate()+'" value="'+localDate()+'"></label><label>추가할 작업·보수 기록<textarea id="lifeText" maxlength="1000" rows="3"></textarea></label><p id="lifeError" role="alert"></p><details><summary>변경·방문 이력 '+(l.history||[]).length+'건</summary>'+(l.history||[]).slice().reverse().map(x=>'<p>'+E(x.date+' · '+(x.text||'날짜 수정')+' · 완료일 '+(x.doneAt||'미입력'))+'</p>').join('')+'</details></section>',[
    {label:'목록으로',cls:'ghost',fn:()=>aptUnitView(name,unitId)},
    {label:'저장',cls:'blue',fn:async()=>{const get=id=>document.getElementById(id).value;try{await hjUnitLifecycleSave(name,unitId,{startedAt:get('lifeStart'),doneAt:get('lifeDone'),date:get('lifeDate'),text:get('lifeText')});hjUnitLifecycleView(name,unitId);toast('이 기기에 저장했습니다. 다른 기기는 최신 자료를 불러오세요.');}catch(e){document.getElementById('lifeError').textContent=e.message;}}}
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
/* v333 직원 작업실 연결: 서버 주소는 직원 작업실(team.html)의 「서버 연결 설정」이 이 기기에 저장한 공개 주소뿐이다(비밀값 아님).
   초안은 같은 출처의 한 번짜리 전달함(hj_company_drafts_handoff)에 두고, 직원 작업실에 대표·팀장으로 로그인해
   한 건씩 팀·담당자를 정해 저장해야 서버에 올라간다. 자동 등록·양방향 동기화는 하지 않는다. */
const HJ_TEAM_API_KEY='hj_team_api_url',HJ_COMPANY_HANDOFF_KEY='hj_company_drafts_handoff',HJ_COMPANY_HANDOFF_TTL=24*3600000;
function hjTeamServerUrl(){try{const v=localStorage.getItem(HJ_TEAM_API_KEY)||'';return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(v)?v:'';}catch(_){return '';}}
function hjCompanyHandoffPending(){try{const v=JSON.parse(localStorage.getItem(HJ_COMPANY_HANDOFF_KEY)||'null');return v&&Number.isFinite(v.at)&&Date.now()-v.at<HJ_COMPANY_HANDOFF_TTL&&Array.isArray(v.tasks)?v.tasks.length:0;}catch(_){return 0;}}
/* 홈 화면에 설치한 앱(특히 iPhone)은 새 창(_blank)을 Safari 로 열고, Safari 는 설치 앱과 저장소를 나눠 쓰지 않는다 —
   넘긴 초안도 저장한 서버 주소도 새 창에서 안 보인다. 설치 앱으로 떠 있으면 같은 창에서 직원 작업실로 옮긴다. */
function hjTeamPortalSameWindow(){try{return navigator.standalone===true||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches;}catch(_){return false;}}
function hjCompanyDraftsSend(tasks){
  if(!hjTeamServerUrl())return toast('직원 작업실 서버 주소가 이 기기에 없습니다. 직원 작업실의 「서버 연결 설정」에서 먼저 연결하세요.');
  if(!tasks.length)return toast('보낼 미완료 업무가 없습니다.');
  if(tasks.length>100)return toast('100건 이내로 현장을 좁혀 주세요. 원본 업무는 변경하지 않았습니다.');
  // 직원 작업실은 한 건이라도 형식이 틀리면 묶음 전체를 거절한다 — 넘기기 전에 걸러 몇 건을 뺐는지 말한다.
  // 규칙은 team-ui.js draftsFrom·str 과 같다(줄바꿈·탭만 허용, 같은 sourceRef 는 첫 건만).
  const plain=(v,max,empty)=>typeof v==='string'&&v.length<=max&&(empty||!!v.trim())&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v),seen=new Set();
  const ok=tasks.filter(t=>{if(!(t&&plain(t.title,160,false)&&plain(t.project,160,false)&&plain(t.sourceRef,150,false)&&plain(t.handoff,2000,true)&&plain(t.due,10,true)&&(!t.due||/^\d{4}-\d{2}-\d{2}$/.test(t.due)))||seen.has(t.sourceRef))return false;seen.add(t.sourceRef);return true;}).map(t=>({title:t.title,project:t.project,due:t.due,handoff:t.handoff,sourceRef:t.sourceRef})),skipped=tasks.length-ok.length;
  if(!ok.length)return toast('보낼 수 있는 업무가 없습니다. 제목·현장명이 비었거나 너무 긴지 확인하세요.');
  tasks=ok;
  const waiting=hjCompanyHandoffPending();
  if(!confirm('현장명·업무 내용 '+tasks.length+'건을 직원 작업실로 넘깁니다.'+(skipped?'\n제목·현장명이 비었거나 너무 길거나 형식이 맞지 않는 '+skipped+'건은 빼고 넘깁니다(현장 앱에서 고친 뒤 다시 보내세요).':'')+(waiting?'\n아직 열지 않은 이전 초안 '+waiting+'건은 이번 초안으로 바뀝니다.':'')+'\n\n직원 작업실에 대표 계정으로 로그인하면 「현장 앱에서 보낸 업무 초안」이 뜹니다. 한 건씩 팀·담당자를 정해 저장해야 서버에 올라갑니다(자동 등록 없음).\n이 기기의 기존 업무는 바꾸지 않습니다. 넘긴 초안은 이 브라우저에 하루 동안만 남습니다.'))return;
  try{localStorage.setItem(HJ_COMPANY_HANDOFF_KEY,JSON.stringify({format:'company-task-drafts-v1',tasks,at:Date.now()}));}
  catch(_){return toast('이 브라우저에 초안을 넘기지 못했습니다. 「JSON 파일로 내려받기」를 쓰세요.');}
  if(hjTeamPortalSameWindow()){location.assign('./team.html#mine');return;}
  try{window.open('./team.html','_blank','noopener');}catch(_){/* 팝업 차단: 아래 안내대로 링크를 누르면 된다 */}
  toast('초안 '+tasks.length+'건을 넘겼습니다. 직원 작업실에 로그인하면 보입니다. 새 창이 안 열렸으면 「직원 작업실에서 열기」를 누르세요.');
}
function hjCompanyLegacyTasks(){return hjTeamList().filter(n=>hjTeamData(n).status!=='done').map(n=>{const t=hjTeamData(n);return {title:t.title,project:n.project||'공통 업무',due:t.due||'',handoff:t.handoff||'',sourceRef:'legacy-team:'+n.id};});}
function hjCompanyLegacySend(){hjCompanyDraftsSend(hjCompanyLegacyTasks());}
function hjCompanyLegacyExport(){hjCompanyDrafts(hjCompanyLegacyTasks());}
function hjCompanySharedExport(){const s=__hjSharedTodo;if(!hjSharedTodoCurrent(s)||!s.ready||s.busy||s.pending)return toast('공유 할일의 최신 조회·저장 결과를 먼저 확인하세요.');const project=s.root.querySelector('#stFilter').value;hjCompanyDrafts(s.tasks.filter(t=>!t.done&&(!project||t.project===project)).map(t=>({title:t.text.slice(0,160),project:t.project,due:'',handoff:t.text.length>160?t.text:'',sourceRef:'shared-todo:'+t.id})));}

/* v335: representative connection summary + explicit identity-only project handoff.
 * Never calls login, creates a company account, moves originals or polls a private server. */
let __hjOperationsCheck=null;
function hjOperationsCenter(){
  if(photoIntakePending()||__modalCloseLocked)return toast('진행 중인 사진 추가·저장을 먼저 마쳐 주세요.');
  const rows=photoSourceRows(),count=k=>rows.filter(r=>r.source.key===k).length,url=hjTeamServerUrl();
  const names=(state.projects||[]).filter(p=>p&&typeof p.name==='string'&&p.name&&state.projects.filter(x=>x.name===p.name).length===1).map(p=>p.name).sort((a,b)=>a.localeCompare(b,'ko'));
  const drive=typeof __gdToken!=='undefined'&&__gdToken&&__gdTokenExp>Date.now()?'이 화면에 Drive 로그인 세션 있음 · 원본 보관 검증과 별도':'현재 Drive 로그인 확인 없음 · 서버 릴레이 설정과 별도';
  openModal('운영 연결 점검','<section id="operationsConnections"><p>현재 기기 설정과 마지막 조회 기록을 모았습니다. 설정이 있다고 실제 인증·백업이 완료된 것은 아닙니다. 비밀번호·토큰·폴더 ID는 표시하지 않습니다.</p>'+
    '<h3>1. 직원 업무 서버</h3><p id="opsTeamHealth" role="status">'+(url?'주소 설정됨 · 이 화면에서 응답 확인 전':'이 기기 직원 서버 미설정')+'</p><div class="row"><button id="opsHealthCheck" type="button" class="blue">서버 응답 확인</button><a class="btn ghost" href="./team.html#mine" target="_blank" rel="noopener noreferrer">직원 작업실·권한 확인 ↗</a></div><p>서버 응답 확인은 health 조회만 합니다. 실제 직원 로그인과 권한은 직원 작업실에서 확인하세요.</p>'+
    '<h3>2. 관리사무소 접수</h3>'+webOfficeConnectionHtml()+'<button id="opsOfficeOpen" class="ghost" type="button">접수 검토·연결 설정</button>'+
    '<h3>3. 사진·원본</h3><p>'+escapeHtml(drive)+'</p><p>기기 기록 '+rows.length+'개 · 서버 연결 기록 '+count('remote')+' · PC 연결 '+count('folder')+' · 화면 파일 '+count('session')+' · 미리보기만 '+count('preview')+' · 연결 확인 필요 '+count('missing')+'</p><p>위 숫자는 원본 파일의 실제 존재나 동일성 검증 결과가 아닙니다.</p><button id="opsPhotoOpen" class="ghost" type="button">사진 보관 상태 자세히</button>'+
    '<h3>4. 아파트·동호수 연결</h3><label for="opsProject">연결 자료를 만들 현장</label><select id="opsProject"><option value="">직접 선택하세요</option>'+names.map((n,i)=>'<option value="'+i+'">'+escapeHtml(n)+'</option>').join('')+'</select><p>아파트명·등록한 동호수/공용부·안정 연결 키만 내보냅니다. 고객 정보·메모·사진·금액은 넣지 않습니다. 직원 작업실에서 대표가 대상 프로젝트를 확인해 가져오며 자동 동기화는 아닙니다.</p><button id="opsProjectExport" class="blue" type="button">연결 JSON 만들기</button><p id="opsExportStatus" role="status"></p><label for="opsLinkJson">직원 작업실에 붙여 넣을 연결 JSON</label><textarea id="opsLinkJson" readonly rows="6"></textarea><button id="opsLinkDownload" class="ghost" type="button" disabled>연결 JSON 내려받기</button></section>',[{label:'닫기',cls:'ghost',fn:()=>closeModal()}]);
  const root=document.getElementById('operationsConnections'),status=root.querySelector('#opsTeamHealth');hjOpsFormStyle('operationsConnections');
  root.querySelector('#opsOfficeOpen').onclick=()=>webWorkCenterOpen();root.querySelector('#opsPhotoOpen').onclick=()=>photoSourceView();
  const check=root.querySelector('#opsHealthCheck');check.disabled=!url||navigator.onLine===false;
  if(__hjOperationsCheck&&__hjOperationsCheck.url===url)status.textContent=__hjOperationsCheck.text+' · 확인 '+new Date(__hjOperationsCheck.at).toLocaleString('ko-KR')+' (실제 로그인 확인 아님)';
  check.onclick=async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);check.disabled=true;status.dataset.checking='true';status.textContent='서버 응답 확인 중…';
    const current=()=>root.isConnected&&hjTeamServerUrl()===url;
    try{
      const r=await fetch(url,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'health'}),signal:controller.signal});
      const h=await r.json();if(!current())return;
      const endpoint=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
      if(!r.ok||h.ok!==true||h.service!=='company-team-v3'||!endpoint.test(h.portalUrl||''))throw new Error('invalid');
      const supported=Array.isArray(h.capabilities)&&['project-units-v1','task-ack-v1'].every(k=>h.capabilities.includes(k));
      const text=supported?'회사 업무 서버 응답 정상 · 동호수/업무 수락 API 지원':'회사 업무 서버 응답 정상 · 동호수/업무 수락은 별도 서버 업데이트 필요';
      __hjOperationsCheck={url,at:Date.now(),text};status.textContent=text+' · '+new Date().toLocaleString('ko-KR')+' · 실제 계정·권한 확인 전';
    }catch(_){if(current()){__hjOperationsCheck=null;status.textContent='서버 응답을 확인하지 못했습니다. 인터넷·서버 설정을 확인하세요. 실제 계정 상태는 판단하지 않았습니다.';}}
    finally{clearTimeout(timer);status.dataset.checking='false';if(current())check.disabled=navigator.onLine===false;}
  };
  let packet=null;
  root.querySelector('#opsProject').onchange=()=>{packet=null;root.querySelector('#opsLinkDownload').disabled=true;root.querySelector('#opsLinkJson').value='';root.querySelector('#opsExportStatus').textContent='선택한 현장의 연결 자료를 새로 만들어 주세요.';};
  root.querySelector('#opsProjectExport').onclick=async()=>{
    const exportButton=root.querySelector('#opsProjectExport'),out=root.querySelector('#opsExportStatus'),selector=root.querySelector('#opsProject');
    const name=selector.value!==''?names[Number(selector.value)]:'';if(!name){out.textContent='연결할 아파트를 직접 선택하세요.';selector.focus();return;}
    if(!confirm(name+'의 아파트명·등록 위치만 연결 JSON으로 만듭니다. 최초 한 번 안정 연결 키를 안전판과 함께 저장하며, 직원 서버·사진 원본은 바꾸지 않습니다. 만들까요?'))return;
    exportButton.disabled=true;packet=null;root.querySelector('#opsLinkDownload').disabled=true;root.querySelector('#opsLinkJson').value='';
    try{
      packet=await hjCompanyProjectPacket(name,url,()=>root.isConnected&&selector.value!==''&&names[Number(selector.value)]===name);
      if(!root.isConnected)return;root.querySelector('#opsLinkJson').value=JSON.stringify(packet,null,2);root.querySelector('#opsLinkDownload').disabled=false;out.textContent='연결 자료 준비됨 · 직원 서버에 아직 등록하지 않았습니다. 동·호수 정보가 포함되므로 회사 대표에게만 전달하세요.';
    }catch(e){if(root.isConnected)out.textContent=e.message||'연결 자료 생성 실패';}
    finally{if(root.isConnected)exportButton.disabled=false;}
  };
  root.querySelector('#opsLinkDownload').onclick=()=>{
    if(!packet)return;const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}),blobUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=blobUrl;a.download='아파트-직원연결.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);
  };
}
async function hjCompanyProjectPacket(name,apiUrl,alive=()=>true){
  const endpoint=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  if(!endpoint.test(apiUrl)||hjTeamServerUrl()!==apiUrl)throw new Error('직원 작업실 서버를 먼저 연결해 주세요.');
  const p=aptUnitProject(name);if(!p)throw new Error('현장 이름이 중복되거나 변경되었습니다.');
  const units=aptUnitList(p);if(aptUnitManaged(p)&&(!Array.isArray(p.aptUnits)||units.length!==p.aptUnits.length))throw new Error('등록 위치 정보를 먼저 확인하세요. 잘못된 위치를 추정하지 않습니다.');
  const fingerprint=paidStableJson({name:p.name,units:p.aptUnits||[],key:p.companyProjectKey||''});
  const current=()=>{const now=aptUnitProject(name);if(!alive()||hjTeamServerUrl()!==apiUrl||!now||paidStableJson({name:now.name,units:now.aptUnits||[],key:now.companyProjectKey||''})!==fingerprint)throw new Error('연결 대상·서버·위치가 바뀌었습니다. 다시 확인하세요.');};
  current();const key=p.companyProjectKey||crypto.randomUUID();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)||state.projects.some(x=>x.name!==name&&x.companyProjectKey===key))throw new Error('현장 연결 키가 중복되거나 손상되었습니다.');
  const packet={format:'company-project-links-v1',apiUrl,sourceKey:key,name,units:units.map(u=>({id:u.id,type:u.type,dong:u.dong,ho:u.ho,name:u.name}))};
  if(JSON.stringify(packet).length>45000)throw new Error('연결 자료가 전송 한도를 넘습니다. 관리자에게 위치 분할을 요청하세요.');
  if(!p.companyProjectKey)await durableLocalMutation({snapshotLabel:'직원 프로젝트 연결 키 생성 전',beforeCommit:current,mutateDraft:d=>{const target=aptUnitProject(name,d);if(!target)throw new Error('현장 변경');target.companyProjectKey=key;return true;}});
  if(!alive()||hjTeamServerUrl()!==apiUrl)throw new Error('화면 또는 서버가 바뀌어 내보내기를 중단했습니다. 이미 저장한 연결 키와 원본은 보존했습니다.');
  return packet;
}

/* Company shared-todo backups. No business records or credentials are serialized.
   Uses the same atomic pending slot as shared todo edits, so another tab cannot
   start a task write while a backup/restore request awaits acknowledgment. */
(() => {
  'use strict';
  const VERSION='shared-todo-v1';
  let active=null;
  const own=s=>active===s&&s.root.isConnected;
  const current=s=>own(s)&&s.url===__relay.url&&s.token===__relay.token&&s.device===__relay.device;
  const validId=id=>typeof id==='string'&&/^r(0|[1-9][0-9]{0,15})_(manual|before-save|before-delete|before-restore)_[0-9a-f-]{36}\.json$/.test(id)&&hjSharedTodoUUID(id.slice(id.lastIndexOf('_')+1,-5));
  const validBackup=b=>b&&validId(b.id)&&typeof b.createdAt==='string'&&Number.isFinite(Date.parse(b.createdAt))&&Number.isSafeInteger(b.storeRevision)&&b.storeRevision>=0&&Number.isSafeInteger(b.taskCount)&&b.taskCount>=0&&b.taskCount<=5000&&['manual','before-save','before-delete','before-restore'].includes(b.reason);
  const validPending=op=>op&&op.schema===2&&op.source==='backup'&&['sharedTodoBackupCreate','sharedTodoRestore'].includes(op.action)&&op.payload&&hjSharedTodoUUID(op.payload.requestId)&&Number.isSafeInteger(op.payload.expectedStoreRevision)&&op.payload.expectedStoreRevision>=0&&(op.action!=='sharedTodoRestore'||validId(op.payload.backupId))&&Object.keys(op).every(k=>['schema','source','action','payload'].includes(k))&&Object.keys(op.payload).every(k=>['requestId','expectedStoreRevision',...(op.action==='sharedTodoRestore'?['backupId']:[])].includes(k));
  function status(s,kind,message){if(!own(s))return;const el=s.root.querySelector('#stbStatus');el.dataset.state=kind;el.textContent=message;}
  function controls(s){
    if(!own(s))return;
    const blocked=!current(s)||s.busy||s.loading||s.failed||s.taskPending;
    s.root.querySelectorAll('button').forEach(el=>{el.disabled=blocked;});
    s.root.querySelector('#stbCreate').disabled=blocked||!s.ready||!!s.pending;
    s.root.querySelectorAll('[data-stb-restore]').forEach(el=>{el.disabled=blocked||!s.ready||!!s.pending;});
    s.root.querySelector('#stbRetry').hidden=!s.pending;
    s.root.querySelector('#stbRetry').disabled=blocked||!s.key;
    s.root.querySelector('#stbMore').hidden=!s.cursor;
    s.root.querySelector('#stbMore').disabled=blocked||!!s.pending;
    s.root.querySelector('#stbRefresh').disabled=!current(s)||s.busy||s.loading;
    s.root.closest('.modal')?.querySelectorAll('.mfoot button').forEach(el=>{el.disabled=!!s.busy;});
  }
  function errorMessage(code){
    return ({'backup-failed':'변경 전 백업을 확인하지 못해 서버 변경을 진행하지 못했습니다.', 'backup-corrupt':'선택한 백업 내용이 손상되었거나 검증되지 않았습니다.', 'backup-not-found':'선택한 백업을 찾지 못했습니다.', 'backup-ambiguous':'같은 이름의 백업이 여러 개여서 자동 선택하지 않았습니다.', 'backup-expired-cursor':'목록 조회 시간이 지나 새로고침이 필요합니다.', 'store-corrupt':'현재 공유 저장소가 손상되어 안전한 자동 복원을 중단했습니다. 백업 원본은 Drive에 보존됩니다.', 'conflict':'다른 변경이 확인되었습니다. 현재 목록을 다시 확인한 뒤 복원 시점을 선택하세요.'})[code]||hjSharedTodoError({error:code});
  }
  async function call(s,action,payload){
    if(!current(s))throw new Error('connection-changed');
    if(navigator.onLine===false)throw new Error('offline');
    let timer;
    try{
      // relayCall serializes the checked connection synchronously before fetch.
      const result=await Promise.race([relayCall(action,payload),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unconfirmed')),25000);})]);
      if(!current(s))throw new Error('connection-changed');
      return result;
    }finally{clearTimeout(timer);}
  }
  function draw(s){
    if(!current(s))return;
    const reason={'manual':'직접 백업','before-save':'입력·수정 전','before-delete':'목록 제외 전','before-restore':'복원 직전 안전 백업'};
    s.root.querySelector('#stbList').innerHTML=s.backups.map(b=>'<article class="stb-card"><p>'+escapeHtml(new Date(b.createdAt).toLocaleString('ko-KR'))+'</p><p>'+escapeHtml(reason[b.reason])+' · 공유 할일 '+b.taskCount+'건</p><button type="button" class="ghost" data-stb-restore="'+escapeAttr(b.id)+'">이 시점으로 전체 공유 할일 복원</button></article>').join('')||'<p>확인된 백업이 없습니다.</p>';
    s.root.querySelectorAll('[data-stb-restore]').forEach(button=>{button.onclick=()=>prepare(s,'sharedTodoRestore',s.backups.find(b=>b.id===button.dataset.stbRestore));});
    controls(s);
  }
  async function refresh(s,more=false){
    if(!current(s)||s.busy||s.loading)return;
    s.loading=true;controls(s);if(!s.pending)status(s,'loading','공유 할일 백업 목록을 확인하고 있습니다…');
    try{
      const result=await call(s,'sharedTodoBackupList',more&&s.cursor?{cursor:s.cursor}:{});
      if(!result||result.ok!==true){s.ready=false;status(s,'error',errorMessage(result?.error));return;}
      if(result.version!==VERSION||!Number.isSafeInteger(result.storeRevision)||result.storeRevision<0||!Array.isArray(result.backups)||result.backups.length>100||result.backups.some(b=>!validBackup(b))||!(result.nextCursor===null||(typeof result.nextCursor==='string'&&/^[\x21-\x7e]{1,4096}$/.test(result.nextCursor))))throw new Error('invalid-response');
      const combined=more?[...s.backups,...result.backups]:result.backups;
      s.backups=[...new Map(combined.map(b=>[b.id,b])).values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
      s.cursor=result.nextCursor;s.revision=result.storeRevision;s.ready=true;draw(s);
      if(!s.pending)status(s,s.taskPending?'pending':'ready',s.taskPending?'이 기기에 공유 할일 전송 대기가 있습니다. 공유 목록에서 그 결과를 먼저 확인하세요.':'백업 '+s.backups.length+'건 확인. 복원하면 모든 현장의 공유 할일 목록이 선택한 시점으로 바뀝니다.'+(s.cursor?' 더 보기를 누르면 다음 백업을 확인합니다.':''));
    }catch(error){if(own(s)){s.ready=false;status(s,'error',current(s)?'백업 목록을 확인하지 못했습니다. 연결 후 새로고침해 주세요.':'서버 연결이 변경되었습니다. 창을 닫고 다시 열어 주세요.');}}
    finally{s.loading=false;controls(s);}
  }
  async function send(s){
    if(!current(s)||s.busy||!s.pending||s.failed||s.taskPending)return;
    const op=s.pending;s.busy=true;__modalCloseLocked=true;controls(s);status(s,'saving','저장된 동일 요청으로 서버 처리 결과를 확인하고 있습니다…');
    let done=false;
    try{
      const result=await call(s,op.action,op.payload);
      if(result?.ok===true){
        if(result.version!==VERSION||!Number.isSafeInteger(result.storeRevision)||result.storeRevision<0)throw new Error('invalid-ack');
        if(op.action==='sharedTodoBackupCreate'?(!validBackup(result.backup)||result.backup.id!=='r'+op.payload.expectedStoreRevision+'_manual_'+op.payload.requestId+'.json'||result.storeRevision!==op.payload.expectedStoreRevision):(result.storeRevision<=op.payload.expectedStoreRevision||!Number.isSafeInteger(result.restoredCount)||result.restoredCount<0||result.restoredCount>5000||result.safetyBackupId!=='r'+op.payload.expectedStoreRevision+'_before-restore_'+op.payload.requestId+'.json'))throw new Error('invalid-ack');
        await hjSharedTodoPendingSwap(s.key,op,null);
        if(!current(s))return;s.pending=null;done=true;
        status(s,'complete',op.action==='sharedTodoRestore'?'공유 할일 '+result.restoredCount+'건을 복원했습니다. 복원 직전 전체 목록도 안전 백업에 보관했습니다.':'현재 공유 할일 백업을 확인했습니다.');
      }else if(result?.ok===false&&result.error==='conflict'){
        await hjSharedTodoPendingSwap(s.key,op,null);if(!current(s))return;s.pending=null;s.ready=false;status(s,'conflict',errorMessage('conflict'));
      }else if(result?.ok===false){status(s,'pending',errorMessage(result.error)+' 원래 요청은 이 기기에 보관했습니다. ‘같은 요청 결과 확인’을 이용하세요.');}
      else throw new Error('invalid-ack');
    }catch(error){if(own(s))status(s,'pending',current(s)?'처리 결과를 확인하지 못했습니다. 요청을 보관했습니다. 연결 후 ‘같은 요청 결과 확인’을 누르면 중복 복원을 막습니다.':'서버 연결이 변경되었습니다. 원래 연결의 요청은 보관했습니다. 같은 연결로 돌아와 결과를 확인하세요.');}
    finally{s.busy=false;if(own(s))__modalCloseLocked=false;controls(s);}
    if(done&&current(s)){await refresh(s);if(current(s))status(s,'complete',op.action==='sharedTodoRestore'?'전체 공유 할일 복원을 확인했습니다. 복원 직전 목록은 안전 백업에서 다시 선택할 수 있습니다.':'현재 공유 할일 백업을 확인했습니다.');}
  }
  async function prepare(s,action,backup){
    if(!current(s)||s.busy||s.loading||s.pending||!s.ready||s.failed||s.taskPending)return;
    if(photoIntakePending()||__modalCloseLocked){status(s,'error','진행 중인 사진·저장 작업을 먼저 마쳐 주세요.');return;}
    if(action==='sharedTodoRestore'){
      if(!validBackup(backup))return;
      if(!confirm(new Date(backup.createdAt).toLocaleString('ko-KR')+' 백업의 공유 할일 '+backup.taskCount+'건으로 되돌릴까요?\n모든 현장의 현재 공유 할일 목록이 교체됩니다.'))return;
      if(!confirm('전체 공유 할일 복원을 실행할까요?\n현재 목록은 복원 직전 안전 백업에 보관합니다. 복원된 할일은 새 항목으로 등록되며 다른 직원도 갱신 시 변경된 목록을 보게 됩니다.'))return;
    }else if(!confirm('현재 모든 현장의 공유 할일을 별도 백업으로 보관할까요?'))return;
    const payload={requestId:crypto.randomUUID(),expectedStoreRevision:s.revision};if(backup)payload.backupId=backup.id;
    const op={schema:2,source:'backup',action,payload};
    s.busy=true;__modalCloseLocked=true;controls(s);
    try{
      // Same slot as normal task changes: this transaction catches cross-tab races.
      await hjSharedTodoPendingSwap(s.key,null,op);if(!current(s))return;s.pending=op;
    }catch(error){status(s,'error',error.message==='pending-other-tab'?'다른 탭의 공유 요청이 먼저 보관되었습니다. 그 요청 결과를 확인한 후 다시 열어 주세요.':'이 기기에 요청을 안전하게 보관하지 못해 전송하지 않았습니다.');return;}
    finally{s.busy=false;if(own(s))__modalCloseLocked=false;controls(s);}
    return send(s);
  }
  async function start(s){
    try{
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([s.url,s.token,s.device])));
      s.key='shared_todo_pending:v1:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      const pending=await idbGetStrict(s.key);if(!current(s))return;
      if(pending!=null){
        if(validPending(pending)){s.pending=pending;status(s,'pending','확인 대기 중인 백업·복원 요청이 있습니다. 같은 요청 결과부터 확인해 주세요.');}
        else if(pending.schema===1&&['sharedTodoSave','sharedTodoDelete'].includes(pending.action)){s.taskPending=true;}
        else throw new Error('invalid-pending');
      }
      await refresh(s);
    }catch(error){if(own(s)){s.failed=true;status(s,'error','기기에 보관된 요청을 확인하지 못했습니다. 기록을 유지하고 전송을 중단했습니다.');}}
    finally{controls(s);}
  }
  window.hjSharedTodoBackupView=function(){
    if(photoIntakePending()||__modalCloseLocked){toast('진행 중인 사진·저장 작업을 먼저 마쳐 주세요.');return false;}
    if(!relayReady()||!__relay.device||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(__relay.url)){toast('회사 서버 연결 설정을 먼저 확인하세요.');return false;}
    if(__hjSharedTodo?.root?.isConnected&&__hjSharedTodo.root.querySelector('#stText')?.value.trim()&&!__hjSharedTodo.pending){toast('작성 중인 할일을 먼저 공유하거나 수정 취소해 주세요.');return false;}
    openModal('공유 할일 백업·복원','<style>#sharedTodoBackupView{font-size:16px;overflow-wrap:anywhere}#sharedTodoBackupView button{min-height:44px;min-width:44px;max-width:100%;white-space:normal}#sharedTodoBackupView p{font-size:14px;line-height:1.6}#sharedTodoBackupView .stb-actions{display:flex;gap:8px;flex-wrap:wrap}#sharedTodoBackupView .stb-card{border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0}#sharedTodoBackupView [hidden]{display:none!important}</style><section id="sharedTodoBackupView"><p>공유 할일은 입력·수정·목록 제외 전에 자동 백업합니다. 복원은 모든 현장의 공유 할일 목록에 적용됩니다. 사진·장부·이 기기 개인 할일은 복원 대상에 포함되지 않습니다.</p><div class="stb-actions"><button type="button" class="ghost" id="stbRefresh">백업 새로고침</button><button type="button" class="blue" id="stbCreate" disabled>지금 백업</button></div><p role="status" aria-live="polite" id="stbStatus" data-state="loading">백업 연결을 확인하고 있습니다…</p><button type="button" class="blue" id="stbRetry" hidden>같은 요청 결과 확인</button><div id="stbList"></div><button type="button" class="ghost" id="stbMore" hidden>백업 더 보기</button></section>',[{label:'공유 할일로',cls:'ghost',fn:()=>{if(!__modalCloseLocked)hjSharedTodoView();}},{label:'닫기',cls:'ghost',fn:closeModal}],true);
    const s={root:document.getElementById('sharedTodoBackupView'),url:__relay.url,token:__relay.token,device:__relay.device,key:'',pending:null,taskPending:false,backups:[],cursor:null,revision:null,ready:false,busy:false,loading:false,failed:false};active=s;
    s.root.querySelector('#stbRefresh').onclick=()=>refresh(s);
    s.root.querySelector('#stbCreate').onclick=()=>prepare(s,'sharedTodoBackupCreate');
    s.root.querySelector('#stbRetry').onclick=()=>send(s);
    s.root.querySelector('#stbMore').onclick=()=>refresh(s,true);
    controls(s);start(s);return s.root;
  };
})();

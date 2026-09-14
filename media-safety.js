/* v297: explicit original-file recovery and idempotent media relay.
   No startup network calls, automatic uploads, public Drive sharing, or original deletion. */
(function () {
  'use strict';
  const VERSION='media-relay-v1', QUEUE='hj_media_jobs_v1', MAX=100*1024*1024;
  const mimeByExt={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',heic:'image/heic',heif:'image/heif',avif:'image/avif',mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm',avi:'video/x-msvideo',mkv:'video/x-matroska','3gp':'video/3gpp','3gpp':'video/3gpp','3g2':'video/3gpp2'};
  let busy=false, serial=Promise.resolve();const checkedConnections=new WeakMap();
  const errors={
    'not-connected':'같은 회사 서버 연결이 필요합니다.', 'server-update-required':'원본 전송 서버 업데이트가 필요합니다. 기존 사진 기능은 계속 사용할 수 있습니다.',
    'connection-changed':'서버 연결이 바뀌었습니다. 새 서버로 자동 전송하지 않았습니다.', 'record-changed':'작업 중 기록이 변경되었습니다. 최신 목록에서 다시 선택하세요.',
    'local-original-required':'기기에서 같은 원본을 다시 선택해 주세요. 목록만으로는 업로드할 수 없습니다.', 'file-mismatch':'이름·크기 또는 원본 해시가 다른 파일입니다.',
    'ambiguous-record':'같은 이름·크기의 기록이 여러 개입니다. 어느 기록인지 먼저 정리해 주세요.', 'storage-failed':'안전한 저장을 완료하지 못했습니다. 전송 완료로 처리하지 않습니다.',
    'invalid-response':'서버 확인 결과가 예상과 다릅니다. 원본 전송 완료로 처리하지 않습니다.', 'busy':'진행 중인 원본 작업을 먼저 마쳐 주세요.',
    'file-too-large':'파일 하나당 최대 100MB입니다.', 'unsupported-type':'지원하지 않는 사진·동영상 형식입니다.', 'backup-failed':'안전 백업에 실패해 추가를 중단했습니다.',
    'journal-full':'전송 기록 보관 한도입니다. 서버 기록 보관을 확장한 뒤 다시 시도해 주세요.', 'unconfirmed':'서버 응답 시간이 초과되었습니다. 같은 원본의 전송·재시도로 처리 결과를 확인하세요.',
    'drive-rate-limited':'Drive 요청이 일시적으로 제한됐습니다. 잠시 뒤 같은 파일로 다시 시도하세요. 전송 기록은 보존했습니다.',
    'drive-quota-exceeded':'Drive 저장 용량 또는 사용 한도를 확인해 주세요. 원본과 전송 기록은 보존했습니다.',
    'drive-forbidden':'서버의 Drive 접근 권한이나 조직 정책을 관리자가 확인해야 합니다. 자동으로 권한을 변경하지 않았습니다.',
    'drive-auth-required':'서버 배포자의 Google 권한 재승인이 필요합니다. 관리자에게 알려 주세요.',
    'drive-request-rejected':'Drive가 전송 요청을 거절했습니다. 관리자가 서버 상태를 확인한 뒤 같은 파일로 재시도해 주세요.'
  };
  function fail(code){throw new Error(code);}
  function message(code){return errors[code]||'전송 또는 확인을 마치지 못했습니다. 연결 상태를 확인한 후 같은 파일로 다시 시도해 주세요.';}
  const resultError=e=>({ok:false,error:e.message||'failed'});
  const hash=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const fileHash=async file=>hash(await file.arrayBuffer());
  const json=value=>JSON.stringify(value);
  function find(id){const rows=state.files.filter(f=>f.id===id&&f.kind==='photo');if(rows.length!==1)fail('record-changed');return rows[0];}
  function stamp(rec){return json({key:fileKey(rec),project:rec.project,work:rec._worklabel,unit:rec._aptUnit,when:rec.when,hash:rec._originalSha256,original:rec._mediaOriginal,driveId:rec._driveId});}
  function guard(rec){const saved=stamp(rec);return ()=>state.files.includes(rec)&&state.files.filter(f=>f.id===rec.id).length===1&&stamp(rec)===saved;}
  function connection(){if(!relayReady()||!__relay.url||!__relay.token)fail('not-connected');return {url:__relay.url,token:__relay.token,device:__relay.device};}
  const sameConnection=c=>c.url===__relay.url&&c.token===__relay.token&&c.device===__relay.device;
  async function fingerprint(c){return hash(new TextEncoder().encode(c.url+'\u0000'+c.token));}
  async function call(c,action,payload){
    if(!sameConnection(c))fail('connection-changed');
    let timer,r;
    try{r=await Promise.race([relayCall(action,payload),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('unconfirmed')),45000);})]);}finally{clearTimeout(timer);}
    if(!sameConnection(c))fail('connection-changed');
    if(!r||r.ok!==true)fail(String(r&&r.error||'invalid-response'));
    if(r.version!==VERSION)fail('server-update-required');return r;
  }
  async function capability(c){
    let r;try{r=await call(c,'mediaHealth',{});}catch(e){if(['unknown-action','bad-action','bad-request','action-not-allowed','unsupported-action','invalid-response'].includes(e.message))fail('server-update-required');throw e;}
    if(!Number.isInteger(r.maxFileBytes)||r.maxFileBytes<1||r.maxFileBytes>MAX||!Number.isInteger(r.chunkBytes)||r.chunkBytes<262144||r.chunkBytes>1048576||r.chunkBytes%262144||!Array.isArray(r.mimeTypes))fail('invalid-response');
    return r;
  }
  function mime(file){const byName=mimeByExt[bestExt(file.name,file.type).toLowerCase()];if(!byName)fail('unsupported-type');return byName;}
  async function source(rec){let file=null;try{file=await getFileOf(rec);}catch(_){}if(!(file instanceof Blob)||!file.size)fail('local-original-required');return file;}
  function validateLocal(rec,file){
    if(!(file instanceof File)||file.name!==rec.name||file.size!==Number(rec.size))fail('file-mismatch');
    if(file.size>MAX)fail('file-too-large');mime(file);
    if(state.files.filter(f=>f.kind==='photo'&&f.name===rec.name&&Number(f.size)===file.size).length!==1)fail('ambiguous-record');
  }
  async function persist(rec,patch,current){
    if(!current())fail('record-changed');
    const candidate={...rec,...patch},files=state.files.map(f=>f===rec?candidate:f);
    if(!await guardedPersistMediaFiles(files,current))fail('storage-failed');
    markDirty();return candidate;
  }
  async function exclusive(fn){
    if(busy)return {ok:false,error:'busy'};busy=true;
    try{return await fn();}catch(e){return resultError(e);}finally{busy=false;}
  }
  async function reconnect(id,file){return exclusive(async()=>{
    const rec=find(id),current=guard(rec);validateLocal(rec,file);
    const sha256=await fileHash(file);if(!current())fail('record-changed');
    if(rec._originalSha256&&rec._originalSha256!==sha256)fail('file-mismatch');
    let thumb=rec.thumb;if(!thumb&&!isVideoRec(rec)){try{thumb=await makeThumbDataUrl(file,480);}catch(_){}}
    const record=await persist(rec,{_file:file,handle:null,_virtual:false,_originalSha256:sha256,...(thumb?{thumb}:{})},current);
    return {ok:true,record,status:'local-connected'};
  });}
  function verifiedFile(value,expected){
    if(!value||value.verified!==true||typeof value.fileId!=='string'||!/^[A-Za-z0-9_-]{8,200}$/.test(value.fileId)||!Number.isSafeInteger(value.size)||value.size<1||value.size>MAX||!/^[a-f0-9]{64}$/.test(value.sha256||'')||!Object.values(mimeByExt).includes(value.mimeType))fail('invalid-response');
    if(expected&&(value.size!==expected.size||value.sha256!==expected.sha256||value.mimeType!==expected.mimeType))fail('invalid-response');
    return value;
  }
  async function verify(id){return exclusive(async()=>{
    const rec=find(id),current=guard(rec),c=connection(),remote=rec._mediaOriginal||{fileId:rec._driveId};
    if(!remote.fileId)fail('local-original-required');
    const response=await call(c,'mediaInspect',{fileId:remote.fileId});
    const file=verifiedFile(response.file);if(file.fileId!==remote.fileId)fail('invalid-response');if(!current())fail('record-changed');
    const identical=!!rec._originalSha256&&file.sha256===rec._originalSha256&&file.size===Number(rec.size);
    const fp=await fingerprint(c);if(!current()||!sameConnection(c))fail('connection-changed');
    rec._sourceVerification={status:identical?'original-verified':'remote-exists',at:new Date().toISOString(),connectionFingerprint:fp,fileId:file.fileId};
    checkedConnections.set(rec,c);
    return {ok:true,status:rec._sourceVerification.status,file};
  });}
  async function jobs(){const rows=await idbGetStrict(QUEUE);if(rows==null)return [];if(!Array.isArray(rows)||rows.length>512||rows.some(j=>!j||!/^[a-f0-9-]{36}$/.test(j.uploadId||'')||typeof j.key!=='string'||!/^[a-f0-9]{64}$/.test(j.sha256||'')||!/^[a-f0-9]{64}$/.test(j.connectionFingerprint||'')||!Number.isSafeInteger(j.size)||!Number.isSafeInteger(j.offset)||j.offset<0||j.offset>j.size))fail('storage-failed');return rows;}
  async function queueWrite(mutator){
    const run=async()=>{const rows=await jobs(),next=mutator(rows);if(next.length>512)fail('storage-failed');await idbSet(QUEUE,next);return next;};
    const invoke=()=>navigator.locks?navigator.locks.request('hj-media-jobs-v1',run):run();
    const pending=serial.then(invoke,invoke);serial=pending.catch(()=>{});return pending;
  }
  async function saveJob(job){await queueWrite(rows=>{const index=rows.findIndex(j=>j.uploadId===job.uploadId);if(index<0)fail('storage-failed');return rows.map((j,i)=>i===index?{...job}:j);});}
  async function chooseJob(rec,file,sha256,c){
    const fp=await fingerprint(c),key=fileKey(rec);let chosen;
    await queueWrite(rows=>{const hits=rows.filter(j=>j.connectionFingerprint===fp&&j.key===key&&j.sha256===sha256);if(hits.length>1)fail('storage-failed');
      if(hits.length){chosen=hits[0];return rows;}
      chosen={uploadId:crypto.randomUUID(),recordId:rec.id,key,name:file.name,size:file.size,mimeType:mime(file),sha256,connectionFingerprint:fp,state:'pending',offset:0,updatedAt:new Date().toISOString()};return [...rows,chosen];});
    return {...chosen};
  }
  function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
  function uploadState(r,job){
    if(r.uploadId!==job.uploadId||r.size!==job.size||!['uploading','complete'].includes(r.state)||!Number.isInteger(r.offset)||r.offset<0||r.offset>job.size)fail('invalid-response');
    if(r.state==='complete'){if(r.offset!==job.size)fail('invalid-response');verifiedFile(r.file,job);}return r;
  }
  async function uploadInternal(id,progress){
    const rec=find(id),current=guard(rec),c=connection(),cap=await capability(c),file=await source(rec);
    validateLocal(rec,file);if(file.size>cap.maxFileBytes)fail('file-too-large');if(!cap.mimeTypes.includes(mime(file)))fail('unsupported-type');
    const sha256=await fileHash(file);if(rec._originalSha256&&rec._originalSha256!==sha256)fail('file-mismatch');
    if(!current())fail('record-changed');if(!sameConnection(c))fail('connection-changed');
    const job=await chooseJob(rec,file,sha256,c);
    const work=async()=>{
      if(!current())fail('record-changed');
      let r=uploadState(await call(c,'mediaUploadBegin',{uploadId:job.uploadId,name:job.name,mimeType:job.mimeType,size:job.size,sha256:job.sha256}),job);
      let steps=0;
      while(r.state!=='complete'){
        if(!current())fail('record-changed');if(++steps>Math.ceil(job.size/262144)+5)fail('invalid-response');
        job.offset=r.offset;job.state='uploading';job.updatedAt=new Date().toISOString();await saveJob(job);
        if(!current())fail('record-changed');
        const offset=r.offset,end=Math.min(offset+cap.chunkBytes,job.size);if(end<=offset)fail('invalid-response');
        const bytes=new Uint8Array(await file.slice(offset,end).arrayBuffer());
        r=uploadState(await call(c,'mediaUploadChunk',{uploadId:job.uploadId,offset,dataB64:b64(bytes)}),job);
        if(r.state!=='complete'&&r.offset<=offset)fail('invalid-response');
        if(progress)progress({offset:r.offset,size:job.size,name:job.name});
      }
      if(!current())fail('record-changed');
      const remote=verifiedFile(r.file,job),metadata={fileId:remote.fileId,name:remote.name||job.name,mimeType:remote.mimeType,size:remote.size,sha256:remote.sha256,connectionFingerprint:job.connectionFingerprint,verifiedAt:new Date().toISOString()};
      job.offset=job.size;job.state='complete';job.file=metadata;await saveJob(job);
      if(!sameConnection(c))fail('connection-changed');
      const updated=await persist(rec,{_originalSha256:sha256,_mediaOriginal:metadata,...(!rec._driveId?{_driveId:remote.fileId,_driveMimeType:remote.mimeType,_driveSize:remote.size,_relayLink:'relay:'+remote.fileId}:{})},current);
      return {ok:true,file:remote,record:updated};
    };
    try{return navigator.locks?await navigator.locks.request('hj-media-upload-'+job.uploadId,work):await work();}
    catch(e){if(sameConnection(c)){job.state='retry';try{await saveJob(job);}catch(_){}}throw e;}
  }
  const upload=(id,progress)=>exclusive(()=>uploadInternal(id,progress));
  async function readOriginal(id,progress){return exclusive(async()=>{
    const rec=find(id),current=guard(rec),c=connection(),meta=rec._mediaOriginal;
    if(!meta?.fileId||!/^[a-f0-9]{64}$/.test(meta.sha256||''))fail('local-original-required');
    const cap=await capability(c),file=verifiedFile((await call(c,'mediaInspect',{fileId:meta.fileId})).file,meta);
    if(file.fileId!==meta.fileId)fail('invalid-response');const parts=[];let offset=0;
    while(offset<file.size){
      if(!current())fail('record-changed');const r=await call(c,'mediaReadChunk',{fileId:file.fileId,offset,length:Math.min(cap.chunkBytes,file.size-offset),sha256:file.sha256});
      if(r.fileId!==file.fileId||r.sha256!==file.sha256||r.offset!==offset||r.size!==file.size||r.mimeType!==file.mimeType||typeof r.dataB64!=='string'||r.dataB64.length>1500000)fail('invalid-response');
      const bytes=Uint8Array.from(atob(r.dataB64),x=>x.charCodeAt(0));if(!bytes.length||bytes.length>cap.chunkBytes||r.nextOffset!==offset+bytes.length||r.nextOffset>file.size||r.eof!==(r.nextOffset===file.size))fail('invalid-response');
      parts.push(bytes);offset=r.nextOffset;if(progress)progress({offset,size:file.size});
    }
    const blob=new Blob(parts,{type:file.mimeType});if(await fileHash(blob)!==file.sha256)fail('invalid-response');
    if(!current()||!sameConnection(c))fail('record-changed');return {ok:true,blob,file};
  });}
  function status(rec){
    const checked=rec._sourceVerification;
    if(checked&&checkedConnections.has(rec)&&sameConnection(checkedConnections.get(rec)))return (checked.status==='original-verified'?'서버 원본 동일성 확인':'서버 파일 확인 · 원본 동일성 미확인')+' ('+new Date(checked.at).toLocaleTimeString('ko-KR')+')';
    if(rec._mediaOriginal)return '원본 전송 기록 있음 · 현재 접근은 [서버 확인]';
    if(rec.handle||rec._file)return '기기 원본 연결 · 새로고침 뒤 재선택이 필요할 수 있음';
    return (rec._driveId?'서버 연결 기록만 있음':'목록·미리보기만 있음')+' · 원본 재연결 필요';
  }
  const styles='<style>.media-manager{font-size:15px;overflow-wrap:anywhere}.media-manager p{font-size:13px;line-height:1.65}.media-manager input,.media-manager select{width:100%;box-sizing:border-box;min-height:44px;font:inherit;margin:6px 0 12px;padding:8px}.media-manager button{min-height:44px;white-space:normal}.media-manager .media-actions{display:flex;gap:8px;flex-wrap:wrap}.media-manager article{border:1px solid var(--line);padding:12px;border-radius:12px;margin:10px 0}.media-manager small{display:block;margin:6px 0;line-height:1.5}.media-manager .media-status{padding:10px;background:var(--paper);border:1px solid var(--line);border-radius:8px}</style>';
  function view(){
    if(busy||photoIntakePending()||__modalCloseLocked){toast(message('busy'));return false;}
    openModal('사진·동영상 원본 관리',styles+'<section id="mediaManager" class="media-manager"><p>목록 등록·기기 연결·서버 원본 보관은 다릅니다. 기존 기록에서 원본만 다시 연결하면 현장·작업명·날짜를 유지합니다. PC·폰 원본은 삭제하지 않습니다.</p><div class="media-actions"><button type="button" id="mediaAdd" class="blue">사진·영상 원본 추가</button><button type="button" id="mediaHealth" class="ghost">서버 기능 확인</button></div><p id="mediaStatus" class="media-status" role="status" aria-live="polite">전송하지 않았습니다. 같은 회사 서버를 쓰는 직원에게 원본을 공유할 수 있습니다.</p><label>현장·파일 검색<input id="mediaSearch" type="search" placeholder="현장명, 작업명, 파일명"></label><div id="mediaRows"></div><button type="button" id="mediaMore" class="ghost">더 보기</button><p>전송 실패는 해당 파일의 [원본 전송·재시도]를 누르세요. 같은 전송번호로 이어 올리며 완료 파일은 다시 생성하지 않습니다. 새로고침하면 대기 기록은 남고 원본은 다시 선택해야 할 수 있습니다. 1개 최대 100MB, 한 번에 20개입니다.</p></section>',[{label:'닫기',cls:'ghost',fn:closeModal}],true);
    const root=document.getElementById('mediaManager'),notice=root.querySelector('#mediaStatus');let limit=30;
    const say=text=>{if(root.isConnected)notice.textContent=text;};
    async function run(fn,success){
      if(busy)return;say('확인 중입니다…');const previous=__modalCloseLocked;__modalCloseLocked=true;
      root.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{const r=await fn();say(r.ok?success(r):message(r.error));}catch(e){say(message(e.message));}
      finally{__modalCloseLocked=previous;if(root.isConnected){root.querySelectorAll('button').forEach(b=>b.disabled=false);draw();}}
    }
    function draw(){
      const q=root.querySelector('#mediaSearch').value.toLowerCase(),rows=state.files.filter(f=>f.kind==='photo'&&[f.name,f.project,f._worklabel].join(' ').toLowerCase().includes(q));
      const list=root.querySelector('#mediaRows');list.innerHTML='<p>'+escapeHtml(photoReportMediaLabel(rows))+' · '+Math.min(limit,rows.length)+'개 표시</p>'+rows.slice(0,limit).map(f=>'<article data-media-id="'+escapeAttr(f.id)+'"><b>'+escapeHtml(f.name)+'</b><small>'+escapeHtml(f.project||'미배정')+' · '+escapeHtml(f._worklabel||'작업명 없음')+'</small><small>'+escapeHtml(status(f))+'</small><div class="media-actions"><button type="button" data-op="local" class="ghost">원본 재연결</button><button type="button" data-op="verify" class="ghost">서버 확인</button><button type="button" data-op="upload" class="blue">원본 전송·재시도</button>'+(isVideoRec(f)?'<button type="button" data-op="play" class="ghost">영상 보기</button>':'')+'</div></article>').join('');
      root.querySelector('#mediaMore').hidden=rows.length<=limit;
      list.querySelectorAll('[data-op]').forEach(button=>button.onclick=()=>{
        const id=button.closest('[data-media-id]').dataset.mediaId,rec=find(id),op=button.dataset.op;
        if(op==='local'){
          const input=document.createElement('input');input.type='file';input.accept='image/*,video/*';input.onchange=()=>{if(input.files[0])run(()=>reconnect(id,input.files[0]),()=> '기존 기록에 원본을 연결했습니다. 서버 전송은 별도입니다.');};input.click();
        }else if(op==='verify')run(()=>verify(id),r=>r.status==='original-verified'?'현재 서버 파일과 원본 해시·크기가 같습니다.':'서버 파일은 존재합니다. 이전 원본 해시가 없거나 다르므로 동일 원본으로 확정하지 않습니다.');
        else if(op==='upload'){
          if(!confirm(rec.name+'\n'+(rec.project||'미배정')+' · '+(rec._worklabel||'작업명 없음')+'\n이 원본을 연결된 회사 Google Drive로 전송할까요? 같은 서버 직원이 볼 수 있습니다.'))return;
          run(()=>upload(id,p=>say(p.name+' · '+Math.floor(p.offset/p.size*100)+'%')),()=> '서버 원본 보관과 연결 저장을 확인했습니다. 다른 기기에서는 최신 자료를 불러오세요.');
        }else openLightbox(id,[id]);
      });
    }
    root.querySelector('#mediaSearch').oninput=()=>{limit=30;draw();};root.querySelector('#mediaMore').onclick=()=>{limit+=30;draw();};
    root.querySelector('#mediaHealth').onclick=()=>run(()=>exclusive(async()=>({ok:true,...await capability(connection())})),()=> '원본 전송 서버가 준비되어 있습니다. 최대 100MB 파일을 나누어 전송합니다.');
    root.querySelector('#mediaAdd').onclick=pick;draw();return true;
  }
  function pick(){
    if(busy||__modalCloseLocked||photoIntakePending())return;
    const input=document.createElement('input');input.type='file';input.accept='image/*,video/*';input.multiple=true;
    input.onchange=()=>{const files=[...input.files];if(files.length)intake(files);};input.click();
  }
  function intake(files){
    if(busy||__modalCloseLocked||photoIntakePending())return false;
    if(files.length>20||files.reduce((n,f)=>n+f.size,0)>250*1024*1024){toast('한 번에 20개, 합계 250MB 이내로 선택해 주세요.');return false;}
    const projects=state.projects.filter(p=>!p.archived).map(p=>p.name);
    openModal('사진·영상 원본 전송 확인',styles+'<section id="mediaIntake" class="media-manager"><p>선택한 '+files.length+'개 원본을 회사 Google Drive로 전송합니다. 같은 서버 직원에게 공유됩니다. 기존 같은 파일은 새 기록을 만들지 않고 연결합니다.</p><label>현장<select id="mediaProject"><option value="">현장을 선택하세요</option>'+projects.map((p,i)=>'<option value="'+i+'">'+escapeHtml(p)+'</option>').join('')+'</select></label><label>새 파일의 작업 내용<input id="mediaWork" maxlength="80" placeholder="예: 욕실 방수 마무리"></label><p>기존 파일은 원래 현장·작업 내용을 유지합니다. 사진은 기존 사진 추가도 사용할 수 있고, 영상 원본 전송은 새 서버 모듈이 필요합니다.</p><p id="mediaIntakeStatus" role="status" aria-live="polite"></p><button type="button" class="blue" id="mediaConfirm">확인 후 원본 전송</button></section>',[{label:'취소',cls:'ghost',fn:closeModal}],true);
    const root=document.getElementById('mediaIntake'),sel=root.querySelector('#mediaProject');if(projects.includes(state.activeProject))sel.value=String(projects.indexOf(state.activeProject));
    root.querySelector('#mediaConfirm').onclick=async()=>{
      if(busy)return;const project=projects[Number(sel.value)],work=root.querySelector('#mediaWork').value.trim();
      if(sel.value===''||!project||!work){toast('현장과 작업 내용을 입력하세요.');return;}
      const notice=root.querySelector('#mediaIntakeStatus'),button=root.querySelector('#mediaConfirm');button.disabled=true;__modalCloseLocked=true;
      let report;
      try{report=await exclusive(async()=>{
        const c=connection(),cap=await capability(c),before=json({...serializeData(),savedAt:''}),refs=[...state.files],stillCurrent=()=>sameConnection(c)&&refs.length===state.files.length&&refs.every((f,i)=>f===state.files[i])&&json({...serializeData(),savedAt:''})===before;
        const next=[...state.files],ids=[],seen=new Map();
        for(const file of files){
          notice.textContent='원본 확인: '+file.name;if(file.size<=0||file.size>cap.maxFileBytes)fail('file-too-large');const type=mime(file);if(!cap.mimeTypes.includes(type))fail('unsupported-type');
          const sha256=await fileHash(file),duplicate=file.name+'|'+file.size;if(seen.has(duplicate)){if(seen.get(duplicate)!==sha256)fail('ambiguous-record');continue;}seen.set(duplicate,sha256);
          const matches=next.filter(f=>f.kind==='photo'&&f.name===file.name&&Number(f.size)===file.size);if(matches.length>1)fail('ambiguous-record');
          let rec=matches[0];if(rec){if(rec._originalSha256&&rec._originalSha256!==sha256)fail('file-mismatch');const updated={...rec,_file:file,handle:null,_virtual:false,_originalSha256:sha256};next[next.indexOf(rec)]=updated;rec=updated;}
          else{let thumb=null;if(type.startsWith('image/')){try{thumb=await makeThumbDataUrl(file,480);}catch(_){}}rec={id:uid(),name:file.name,size:file.size,ext:bestExt(file.name,type),prefix:'',kind:'photo',project,when:new Date(file.lastModified||Date.now()),sourceModifiedAt:new Date(file.lastModified||Date.now()).toISOString(),_worklabel:work,_file:file,handle:null,_virtual:false,_originalSha256:sha256,text:'',ocr:'na',thumb};next.push(rec);}
          ids.push(rec.id);
        }
        if(!stillCurrent())fail('record-changed');if(await hjSnapshot('사진·영상 원본 추가 전',true,true)!==true)fail('backup-failed');
        if(!await guardedPersistMediaFiles(next,stillCurrent))fail('storage-failed');markDirty();
        const outcomes=[];
        for(const id of ids){try{if(!sameConnection(c))fail('connection-changed');const r=await uploadInternal(id,p=>notice.textContent=p.name+' · '+Math.floor(p.offset/p.size*100)+'%');outcomes.push({id,ok:r.ok});}catch(e){outcomes.push({id,ok:false,error:e.message});if(!sameConnection(c))break;}}
        return {ok:true,outcomes,total:ids.length};
      });}
      finally{__modalCloseLocked=false;button.disabled=false;}
      if(!report.ok){notice.textContent=message(report.error);return;}
      const complete=report.outcomes.filter(r=>r.ok).length;notice.textContent='기록 '+report.total+'개 · 원본 전송 확인 '+complete+'개 · 미완료 '+(report.total-complete)+'개. 미완료 파일만 원본 관리에서 다시 시도하세요.';
      button.textContent='원본 관리로 이동';button.onclick=view;
    };return true;
  }
  async function playRemote(id,video,isCurrent){
    const r=await readOriginal(id);if(!isCurrent())return;
    if(!r.ok){toast(message(r.error));return;}
    const url=URL.createObjectURL(r.blob);if(window.__lbUrl)URL.revokeObjectURL(window.__lbUrl);window.__lbUrl=url;video.hidden=false;video.src=url;
    document.getElementById('lbVideoNone')?.remove();
  }
  window.HJMedia={get busy(){return busy;},reconnect,verify,upload,retry:upload,readOriginal,view,pick,intake,playRemote,queueKey:QUEUE,
    health:()=>exclusive(async()=>({ok:true,...await capability(connection())}))};
  window.hjMediaView=view;
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
})();

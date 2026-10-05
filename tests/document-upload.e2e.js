/* v339: isolated IDB, synthetic documents and intercepted server only. No real uploads/accounts. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const {waitForTouchLayout}=require('./test-stability-fixture');
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new global.URL(APP).origin;
const URL='https://script.google.com/macros/s/AKfyTEST_DOCUMENT_SERVER/exec';
const MUTATION=process.env.HJ_DOCUMENT_UPLOAD_MUTATION||'';
assert(['','repeat','hash','connection','restore','reservation','layout'].includes(MUTATION));
let browser,passed=0;
function source(){
  let html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const edits={
    repeat:['if(!job.sent){','if(true){'],
    hash:["if(!bytes||bytes.length!==meta.size||await documentHash(bytes)!==meta.sha256)throw new Error('서버 원본 내용이 일치하지 않습니다. 기존 원본은 보존했습니다.');","if(!bytes||bytes.length!==meta.size)throw new Error('synthetic invalid bytes');"],
    connection:["function documentSameConnection(c){return c.url===__relay.url&&c.token===__relay.token&&c.device===(__relay.device||'unknown');}","function documentSameConnection(c){return true;}"],
    restore:["if(currentMeta.serverUpload)f.documentMeta.serverUpload=structuredClone(currentMeta.serverUpload);","if(false)f.documentMeta.serverUpload=structuredClone(currentMeta.serverUpload);"],
    reservation:["if(!saved||saved.sent!==false||paidStableJson(saved)!==paidStableJson(job))throw new Error('이미 전송 시도가 기록되었습니다. 서버 확인을 먼저 하세요.');","/* synthetic removal of atomic reservation check */"],
    layout:['#documentForm.sch-form label.document-pick{flex-direction:row;','#documentForm.sch-form label.document-pick{flex-direction:column;']
  };
  if(MUTATION){const [from,to]=edits[MUTATION];assert.equal(html.split(from).length,2,'unique mutation anchor');html=html.replace(from,to);}return html;
}
function server(){return {files:new Map(),uploads:0,saves:0,calls:[],mode:'ok',lost:false,onUpload:null};}
async function routes(context,s){
  await context.route('**/*',async route=>{
    const r=route.request();if(r.url()===URL){
      const req=JSON.parse(r.postData());assert.equal(req.token,'SELF-DESCRIBING-FAKE-DOC-TOKEN');assert.equal(req.deviceId,'FAKE-DOC-DEVICE');s.calls.push(req.action);
      const p=req.payload;let response;
      if(req.action==='upload'){
        if(s.mode==='reject')response={ok:false,error:'unauthorized'};
        else{
          assert.equal(p.kind,'doc','documents must not use compressed-photo upload');s.uploads++;
          const id='FAKE_DOCUMENT_ID_'+String(s.uploads).padStart(10,'0'),bytes=Buffer.from(p.dataB64,'base64');
          s.files.set(id,{id,name:p.name,mimeType:p.mimeType,size:bytes.length,bytes});
          if(s.onUpload)await s.onUpload();
          if(s.mode==='loss'&&!s.lost){s.lost=true;await route.abort();return;}
          response={ok:true,fileId:id,name:p.name,mimeType:p.mimeType,size:bytes.length};
          if(s.mode==='bad-id')response.fileId='short';
          if(s.mode==='bad-mime')response.mimeType='text/html';
          if(s.mode==='bad-size')response.size++;
        }
      }else if(req.action==='download'){
        const f=s.files.get(p.fileId);if(!f)response={ok:false,error:'not-found'};
        else{const bytes=Buffer.from(f.bytes);if(s.mode==='corrupt')bytes[0]^=1;response={ok:true,fileId:f.id,name:f.name,mimeType:f.mimeType,size:f.size,dataB64:bytes.toString('base64')};}
      }else if(req.action==='listFiles'){
        assert.equal(p.kind,'doc');const list=[...s.files.values()].map(({bytes,...m})=>m);
        response={ok:true,files:s.mode==='duplicate'?[...list,...list]:s.mode==='missing'?[]:list,truncated:s.mode==='truncated'};
      }else if(req.action==='save'){
        assert.equal(Object.keys(p.data).length,41);assert.equal(JSON.stringify(p.data).includes(req.token),false,'no serialized secret');s.saves++;
        if(s.mode==='save-loss'){await route.abort();return;}
        response=s.mode==='conflict'?{ok:false,error:'conflict',serverRevision:99}:{ok:true,revision:s.saves,savedAt:'2026-10-05T01:00:00Z'};
      }else throw new Error('unexpected action '+req.action);
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});return;
    }
    if(r.url()===APP&&MUTATION)return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:source()});
    return new global.URL(r.url()).origin===ORIGIN?route.continue():route.abort();
  });
}
async function configure(page,seed=true){
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:20000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayBootDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async({seed,url})=>{
    await Promise.all([__hjRestoreDone,__hjRelayBootDone,__hjOfficeOpsBootDone]);
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};aiOpsEnsureState().enabled=false;portalAutoSync=()=>{};cloudAutoSave=()=>{};
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    if(seed){state.projects=[{name:'가상 가아파트',stage:1,received:321,phases:[],cost:{material:17,labor:18},customer:{}}];state.files=[];state.quotes=[];state.schedule=[];state.payLog=[{id:'fake',project:'가상 가아파트',amount:321}];state.expenses=[];state.aptOrders=[];state.brand={unknown:'keep'};}
    state._demo=false;state.editingQuote=null;state.activeProject=null;state.tab='docs';state.search='';state.dirHandle=null;state.dirty=false;
    __tabStale=false;__documentSelection.clear();__documentBusy=false;__documentShareNotice='';
    __relay={url,token:'SELF-DESCRIBING-FAKE-DOC-TOKEN',device:'FAKE-DOC-DEVICE',rev:0,syncAt:''};
    window.__docNoCalls=[];relayCall=async()=>{__docNoCalls.push('legacy-relay');throw new Error('unexpected legacy relay');};gdGetToken=async()=>{__docNoCalls.push('OAuth');throw new Error('unexpected OAuth');};gdMoveToKindFolder=async()=>{__docNoCalls.push('move');};
    render();if(seed){if(!await guardedPersistCurrentState())throw new Error('fixture persistence failed');await __appStateWriteQueue;}
  },{seed,url:URL});
}
async function fixture(width=390){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  const s=server();await routes(context,s);const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await configure(page);
  return {context,page,s,errors};
}
async function run(name,fn,width=390){const t=await fixture(width);try{await fn(t);assert.deepEqual(t.errors,[]);assert.deepEqual(await t.page.evaluate(()=>__docNoCalls),[],'no legacy queue, moves, OAuth or unrelated writes');passed++;console.log('PASS '+name);}catch(e){console.error('FAIL CASE '+name);throw e;}finally{await t.context.close();}}
async function register(t,role='contract',name='가상 계약 원본.pdf',type='application/pdf'){
  return t.page.evaluate(async({role,name,type})=>{await documentRegister([new File(['SYNTHETIC-ORIGINAL'],name,{type,lastModified:123456789})],role,'가상 가아파트');const f=state.files.at(-1);window.__uploadKey=fileKey(f);return fileKey(f);},{role,name,type});
}
const upload=t=>t.page.evaluate(async()=>{try{return {result:await documentUploadFiles([__uploadKey])};}catch(e){return {error:e.message};}});
const record=t=>t.page.evaluate(()=>{const f=state.files.find(f=>fileKey(f)===__uploadKey);return {meta:f.documentMeta,drive:f._driveId,kind:f.kind,name:f.name,project:f.project,size:f.size};});
(async()=>{browser=await chromium.launch({headless:true});
  await run('verified original and metadata share preserve money',async t=>{
    const money=await t.page.evaluate(()=>JSON.stringify({p:state.projects,pay:state.payLog,q:state.quotes,ex:state.expenses}));await register(t,'settlement');const r=await upload(t);assert.equal(r.result.uploaded,1);assert.equal(r.result.shared,true);assert.equal(t.s.uploads,1);
    const f=await record(t);assert.equal(f.kind,'other');assert.equal(f.meta.serverUpload.status,'uploaded');assert(f.drive);assert.match(f.meta.serverUpload.name,/^hjdoc_[a-f0-9-]{36}\.pdf$/);assert.equal(f.name,'가상 계약 원본.pdf');
    assert.equal(await t.page.evaluate(()=>JSON.stringify({p:state.projects,pay:state.payLog,q:state.quotes,ex:state.expenses})),money);
    assert.equal(await t.page.evaluate(async()=>await(await getFileOf(state.files.at(-1))).text()),'SYNTHETIC-ORIGINAL');await upload(t);assert.equal(t.s.uploads,1,'completed original not resent');
  });
  await run('response loss recovers by exact UUID and original hash without repeat',async t=>{
    await register(t);t.s.mode='loss';const first=await upload(t);assert.equal(first.result.uncertain,1);assert.equal((await record(t)).drive,null);const second=await upload(t);assert.equal(second.result.uploaded,1);assert.equal(t.s.uploads,1,'unknown create must not repeat');assert(t.s.calls.includes('listFiles'));
  });
  await run('corrupt server bytes never become verified original',async t=>{await register(t);t.s.mode='corrupt';const r=await upload(t);assert.equal(r.result.uploaded,0);assert.equal(r.result.uncertain,1);assert.equal((await record(t)).drive,null);});
  await run('same-size corrupted local cache is rejected without overwrite or send',async t=>{await register(t);await upload(t);const r=await t.page.evaluate(async()=>{const f=state.files.at(-1);await idbSet('document_blob:'+f.documentMeta.localBlobId,new File(['XYNTHETIC-ORIGINAL'],f.name,{type:'application/pdf'}));try{await getFileOf(f);return '';}catch(e){return e.message;}});assert.match(r,/기기 보관 원본의 내용/);assert.equal(t.s.uploads,1);});
  await run('connection change cannot attach an old server result',async t=>{await register(t);t.s.onUpload=()=>t.page.evaluate(()=>{__relay.url='https://script.google.com/macros/s/AKfyTEST_CHANGED/exec';});assert((await upload(t)).error);assert.equal((await record(t)).drive,null);assert.equal(t.s.uploads,1);assert.equal(t.s.calls.includes('download'),false);});
  await run('IDB atomically reserves each send once',async t=>{
    await register(t);const r=await t.page.evaluate(async()=>{const f=state.files.at(-1),fp=await documentConnectionFingerprint(documentConnection()),meta={schemaVersion:1,requestId:crypto.randomUUID(),connectionFingerprint:fp,sha256:await documentHash(await(await getFileOf(f)).arrayBuffer()),size:f.size,mimeType:'application/pdf',status:'uncertain',name:'hjdoc_fake.pdf'},job={schemaVersion:1,blobId:f.documentMeta.localBlobId,originalName:f.name,meta,sent:false},key=documentJobKey(f,fp);await documentStoreJob(key,job);await documentReserveAttempt(key,job);try{await documentReserveAttempt(key,job);return false;}catch(_){return true;}});assert.equal(r,true,'second reservation must reject');assert.equal(t.s.uploads,0);
  });
  await run('receipt ID and hash cannot be changed or erased',async t=>{await register(t);await upload(t);const r=await t.page.evaluate(async()=>{const f=state.files.at(-1),key=documentJobKey(f,await documentConnectionFingerprint(documentConnection())),job=await idbGetStrict(key),attempts=[{...job,fileId:undefined},{...job,fileId:'FAKE_DIFFERENT_ID_0000000000'},{...job,meta:{...job.meta,sha256:'0'.repeat(64)}}],errors=[];for(const change of attempts){try{await documentStoreJob(key,change);errors.push('');}catch(e){errors.push(e.message);}}return {errors,unchanged:paidStableJson(job)===paidStableJson(await idbGetStrict(key))};});assert(r.errors.every(e=>/다른 전송 기록/.test(e)));assert.equal(r.unchanged,true);assert.equal(t.s.uploads,1);});
  await run('selected restore preserves current verified server source',async t=>{await register(t);const before=await t.page.evaluate(()=>serializeData().files.at(-1));await upload(t);const r=await t.page.evaluate(saved=>{const f=state.files.at(-1),proof=JSON.stringify(f.documentMeta.serverUpload);hjApplySavedFileFields(f,saved,true,true);return {proof,after:JSON.stringify(f.documentMeta.serverUpload),drive:f._driveId};},before);assert.equal(r.after,r.proof);assert(r.drive);});
  for(const oldState of ['none','uncertain'])await run('full safety restore '+oldState+' repairs proof without another upload',async t=>{
    await register(t);const before=await t.page.evaluate(()=>serializeData());
    await upload(t);const drive=(await record(t)).drive;
    if(oldState==='uncertain'){before.files.at(-1).documentMeta.serverUpload={...(await record(t)).meta.serverUpload,status:'uncertain'};delete before.files.at(-1).documentMeta.serverUpload.fileId;delete before.files.at(-1).documentMeta.serverUpload.verifiedAt;}
    const restored=await t.page.evaluate(async data=>{const ok=await hjRestoreSnapshot({data,at:'2026-10-05T00:00:00Z'});clearTimeout(__idbSaveTimer);await __appStateWriteQueue;if(!await guardedPersistCurrentState())throw new Error('synthetic restore persistence failed');return ok;},before);assert.equal(restored,true);assert.equal((await record(t)).drive,drive,'physical Drive ID survives full restore');
    assert.equal((await record(t)).meta.serverUpload?.status,oldState==='none'?undefined:'uncertain');assert.equal((await upload(t)).result.uploaded,1);assert.equal((await record(t)).meta.serverUpload.status,'uploaded');assert.equal((await record(t)).drive,drive);assert.equal(t.s.uploads,1,'full restore must only verify the existing original');
  });
  await run('upload response ID survives CAS failure and recovers without duplicate',async t=>{
    await register(t);await t.page.evaluate(()=>{window.__originalDocApply=documentApplyServerRecords;let n=0;documentApplyServerRecords=async(...a)=>{if(++n===2)throw new Error('FAKE CAS conflict');return __originalDocApply(...a);};});assert.match((await upload(t)).error,/CAS/);assert.equal(t.s.uploads,1);assert.equal((await record(t)).drive,null);
    await t.page.evaluate(()=>{documentApplyServerRecords=__originalDocApply;});assert.equal((await upload(t)).result.uploaded,1);assert.equal(t.s.uploads,1);
  });
  await run('other device downloads only verified original with no OAuth',async t=>{
    await register(t);await upload(t);const data=await t.page.evaluate(()=>serializeData());const other=await browser.newContext({serviceWorkers:'block'});await other.addInitScript(()=>localStorage.setItem('hj_onboard_done','1'));await routes(other,t.s);const p=await other.newPage();await configure(p);
    const r=await p.evaluate(async data=>{applyData(data,{revert:true});const f=state.files.at(-1),b=await getFileOf(f);return {name:b.name,bytes:await b.text(),calls:__docNoCalls};},data);assert.deepEqual(r,{name:'가상 계약 원본.pdf',bytes:'SYNTHETIC-ORIGINAL',calls:[]});
    const downloads=t.s.calls.filter(x=>x==='download').length;assert.equal(await p.evaluate(async()=>{__relay.url='';return (await getFileOf(state.files.at(-1))).text();}),'SYNTHETIC-ORIGINAL');assert.equal(t.s.calls.filter(x=>x==='download').length,downloads,'verified local cache works after disconnect');await other.close();
  });
  await run('other device repairs uncertain proof by kept Drive ID',async t=>{
    await register(t);await upload(t);const data=await t.page.evaluate(()=>serializeData());data.files.at(-1).documentMeta.serverUpload.status='uncertain';delete data.files.at(-1).documentMeta.serverUpload.fileId;delete data.files.at(-1).documentMeta.serverUpload.verifiedAt;
    const other=await browser.newContext({serviceWorkers:'block'});await other.addInitScript(()=>localStorage.setItem('hj_onboard_done','1'));await routes(other,t.s);const p=await other.newPage();await configure(p);
    await p.evaluate(async data=>{applyData(data,{revert:true});if(!await guardedPersistCurrentState())throw new Error('synthetic other device persistence failed');render();},data);
    const downloadEvent=p.waitForEvent('download');await p.locator('[data-document-download]').click();const download=await downloadEvent;assert.equal(download.suggestedFilename(),'가상 계약 원본.pdf');assert.equal(fs.readFileSync(await download.path(),'utf8'),'SYNTHETIC-ORIGINAL');
    const result=await p.evaluate(()=>({status:state.files.at(-1).documentMeta.serverUpload.status,drive:state.files.at(-1)._driveId}));assert.equal(result.status,'uncertain','first download keeps application metadata stable');assert.equal(result.drive,data.files.at(-1).driveId);
    const confirmed=await p.evaluate(async()=>{__uploadKey=fileKey(state.files.at(-1));return documentUploadFiles([__uploadKey]);});assert.equal(confirmed.uploaded,1);assert.equal(await p.evaluate(()=>state.files.at(-1).documentMeta.serverUpload.status),'uploaded');assert.equal(t.s.uploads,1);await other.close();
  });
  await run('first selected quote read after uncertain restore keeps original identity',async t=>{
    await register(t,'estimate');await upload(t);const data=await t.page.evaluate(()=>serializeData());data.files.at(-1).documentMeta.serverUpload.status='uncertain';delete data.files.at(-1).documentMeta.serverUpload.fileId;delete data.files.at(-1).documentMeta.serverUpload.verifiedAt;
    const other=await browser.newContext({serviceWorkers:'block'});await other.addInitScript(()=>localStorage.setItem('hj_onboard_done','1'));await routes(other,t.s);const p=await other.newPage();await configure(p);
    const result=await p.evaluate(async data=>{applyData(data,{revert:true});if(!await guardedPersistCurrentState())throw new Error('synthetic quote persistence failed');pdfText=async f=>{const b=await getFileOf(f);if(await b.text()!=='SYNTHETIC-ORIGINAL')throw new Error('synthetic original changed');return '합성 견적 항목';};const n=await documentReadEstimates([fileKey(state.files.at(-1))]);return {n,text:state.files.at(-1).text,status:state.files.at(-1).documentMeta.serverUpload.status};},data);assert.deepEqual(result,{n:1,text:'합성 견적 항목',status:'uncertain'});assert.equal(t.s.uploads,1);await other.close();
  });
  await run('refresh after lost response keeps attempted job and never repeats',async t=>{
    await register(t);t.s.mode='loss';await upload(t);await configure(t.page,false);await t.page.evaluate(()=>{__uploadKey=fileKey(state.files.at(-1));});assert.equal((await upload(t)).result.uploaded,1);assert.equal(t.s.uploads,1);
  });
  await run('two same-origin tabs cannot create a duplicate original',async t=>{
    await register(t);const p=await t.context.newPage();await configure(p,false);await p.evaluate(()=>{__uploadKey=fileKey(state.files.at(-1));});
    let signal,release;const started=new Promise(r=>{signal=r;}),gate=new Promise(r=>{release=r;});t.s.onUpload=async()=>{signal();await gate;};
    const first=upload(t);await Promise.race([started,first.then(r=>{if(!t.s.uploads)throw new Error('first tab did not begin its upload: '+JSON.stringify(r));})]);const second=p.evaluate(async()=>{try{return {result:await documentUploadFiles([__uploadKey])};}catch(e){return {error:e.message};}});release();const results=await Promise.all([first,second]);assert.equal(results[0].result.uploaded,1);assert.match(results[1].error,/다른 탭|stale/);assert.equal(t.s.uploads,1);await p.close();
  });
  await run('post-commit UI failure retains verified receipt for refresh recovery',async t=>{
    await register(t);await t.page.evaluate(()=>{window.__originalApplyPaid=applyPaidCommittedState;let n=0;applyPaidCommittedState=(...a)=>{if(++n===2)throw new Error('FAKE post-commit UI failure');return __originalApplyPaid(...a);};});assert.match((await upload(t)).error,/post-commit/);assert.equal(t.s.uploads,1);
    await configure(t.page,false);await t.page.evaluate(()=>{__uploadKey=fileKey(state.files.at(-1));});assert.equal((await upload(t)).result.uploaded,1);assert.equal((await record(t)).meta.serverUpload.status,'uploaded');assert.equal(t.s.uploads,1);
  });
  await run('late data change preserves receipt without overwriting new data',async t=>{
    await register(t);t.s.onUpload=()=>t.page.evaluate(()=>{state.projects[0].customer={syntheticUpdated:true};});assert.match((await upload(t)).error,/자료|화면/);assert.equal((await record(t)).drive,null);assert.equal(await t.page.evaluate(()=>state.projects[0].customer.syntheticUpdated),true);assert.equal(t.s.calls.includes('download'),false);
    t.s.onUpload=null;await t.page.evaluate(()=>guardedPersistCurrentState());assert.equal((await upload(t)).result.uploaded,1);assert.equal(t.s.uploads,1);assert.equal(await t.page.evaluate(()=>state.projects[0].customer.syntheticUpdated),true);
  });
  for(const mode of ['missing','duplicate','truncated'])await run('unknown upload with '+mode+' listing never retries',async t=>{await register(t);t.s.mode='loss';await upload(t);t.s.mode=mode;assert.equal((await upload(t)).result.uncertain,1);assert.equal((await record(t)).drive,null);assert.equal(t.s.uploads,1);});
  await run('rejected upload only retries after another explicit action',async t=>{await register(t);t.s.mode='reject';assert.equal((await upload(t)).result.rejected,1);assert.equal(t.s.uploads,0);assert.equal((await record(t)).meta.serverUpload.status,'rejected');t.s.mode='ok';assert.equal((await upload(t)).result.uploaded,1);assert.equal(t.s.uploads,1);});
  await run('missing original and snapshot failure send zero files',async t=>{await register(t);await t.page.evaluate(()=>{idbGetStrict=async()=>undefined;});assert.match((await upload(t)).error,/기기 원본/);assert.equal(t.s.uploads,0);});
  await run('snapshot failure leaves only prepared local intent and no send',async t=>{await register(t);await t.page.evaluate(()=>{hjSnapshot=async()=>false;});assert.match((await upload(t)).error,/안전판/);assert.equal(t.s.uploads,0);});
  await run('unsupported documents and oversized original stay local',async t=>{await register(t,'other','가상 한글.hwp','application/haansofthwp');assert.equal((await upload(t)).result.localOnly,1);assert.equal(t.s.uploads,0);await t.page.evaluate(async()=>{await documentRegister([new File([new Uint8Array(10*1024*1024)],'가상 큰.pdf',{type:'application/pdf'})],'contract',null);__uploadKey=fileKey(state.files.at(-1));});assert.equal((await upload(t)).result.localOnly,1);assert.equal(t.s.uploads,0);});
  await run('metadata conflict is not falsely reported as sharing success',async t=>{await register(t);t.s.mode='conflict';const r=await upload(t);assert.equal(r.result.uploaded,1);assert.equal(r.result.shared,false);assert.match(await t.page.evaluate(()=>__documentShareNotice),/미확인/);});
  await run('previous share success cannot survive a later network failure',async t=>{
    await register(t);assert.equal((await upload(t)).result.shared,true);assert.match(await t.page.evaluate(()=>__documentShareNotice),/공유 저장 완료/);t.s.mode='save-loss';assert((await upload(t)).error);assert.match(await t.page.evaluate(()=>__documentShareNotice),/공유 저장 미확인/);assert.doesNotMatch(await t.page.evaluate(()=>__documentShareNotice),/완료/);assert.equal(t.s.uploads,1);assert.equal(await t.page.evaluate(()=>window.__documentUploadPending),false);
  });
  for(const mode of ['bad-id','bad-mime','bad-size'])await run('malformed '+mode+' response cannot attach original or trigger resend',async t=>{await register(t);t.s.mode=mode;assert.equal((await upload(t)).result.uncertain,1);assert.equal((await record(t)).drive,null);t.s.mode='ok';assert.equal((await upload(t)).result.uploaded,1);assert.equal(t.s.uploads,1);});
  await run('update and offline guards protect original upload',async t=>{await register(t);await t.page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));assert.equal((await upload(t)).result.deferred,1);assert.equal(t.s.uploads,0);await t.page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:true}));let locked;t.s.onUpload=async()=>{locked=await t.page.evaluate(()=>appVersionPhotoGuard());};await upload(t);assert.equal(locked,true);assert.equal(await t.page.evaluate(()=>window.__documentUploadPending),false);});
  for(const width of [320,390,1280])await run('explicit local and server upload UI '+width,async t=>{
    await t.page.getByRole('button',{name:'정산서 업로드',exact:true}).click();await t.page.locator('#documentRegisterFiles').setInputFiles({name:'가상 선택 정산.pdf',mimeType:'application/pdf',buffer:Buffer.from('SYNTHETIC-UI')});assert.equal(await t.page.locator('#documentServerConsent').isChecked(),false,'server transmission needs explicit selection');assert.match(await t.page.locator('#documentForm').innerText(),/앱 전체의 프로젝트·고객·견적·정산·수금·파일 분류 정보/);
    await waitForTouchLayout(t.page,'#modalRoot button,#modalRoot select');const measures=await t.page.locator('#modalRoot button:visible,#modalRoot select:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert(measures.every(h=>h>=44));assert.equal(await t.page.locator('#modalRoot .modal').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
    const picks=await t.page.locator('#documentForm label.document-pick').evaluateAll(es=>es.map(e=>({direction:getComputedStyle(e).flexDirection,height:e.getBoundingClientRect().height,checkWidth:e.querySelector('input').getBoundingClientRect().width,font:parseFloat(getComputedStyle(e).fontSize)})));assert(picks.every(e=>e.direction==='row'&&e.height>=44&&e.checkWidth===22&&e.font>=14),'readable rows and full label touch targets');assert(await t.page.locator('#documentServerConsent+span small').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13));
    if(process.env.HJ_DOCUMENT_UPLOAD_SCREENSHOT_DIR)await t.page.screenshot({path:path.join(process.env.HJ_DOCUMENT_UPLOAD_SCREENSHOT_DIR,'document-upload-'+width+'.png')});
    await t.page.locator('#documentServerConsent').check();await t.page.getByRole('button',{name:'선택 파일 업로드',exact:true}).click();await t.page.waitForFunction(()=>!document.querySelector('#documentForm'));assert.equal(t.s.uploads,1);assert.equal(await t.page.evaluate(()=>state.files.at(-1).kind),'other');assert.equal(await t.page.locator('.documents-view').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true);
  },width);
  await run('unchecked server consent performs local upload only',async t=>{await t.page.getByRole('button',{name:'서류 업로드',exact:true}).click();await t.page.locator('#documentRegisterFiles').setInputFiles({name:'가상 기기만.pdf',mimeType:'application/pdf',buffer:Buffer.from('SYNTHETIC-LOCAL')});await t.page.getByRole('button',{name:'선택 파일 업로드',exact:true}).click();await t.page.waitForFunction(()=>!document.querySelector('#documentForm'));assert.equal(t.s.uploads,0);assert.equal(t.s.saves,0);assert.equal(await t.page.evaluate(()=>state.files.length),1);});
  console.log('== document-upload: '+passed+' passed ==');await browser.close();
})().catch(async e=>{console.error('FAIL document-upload',e);if(browser)await browser.close();process.exitCode=1;});

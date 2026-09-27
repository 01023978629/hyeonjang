/* Isolated synthetic browser. No production data/network. Run with the normal runner.
 * HJ_MEDIA_BATCH_MUTATION injects a regression into the served script only. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP=process.env.HJ_TEST_APP||'http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
let source=fs.readFileSync(path.join(__dirname,'../media-safety.js'),'utf8').replace(/\r\n/g,'\n');
const mutations={
  scope:["const project=select.value,rows=state.files.filter(f=>f.kind==='photo'&&(f.project||'')===project)","const project=select.value,rows=state.files.filter(f=>f.kind==='photo')"],
  stale:["if(invalid||!sameConnection(c)||targets.some(t=>!t.current()))","if(false)"],
  disk:["if(live.length!==1||disk.length!==1)return true;","if(live.length!==1)return true;"],
  replay:["if(previous&&previous.connectionFingerprint===await fingerprint(c)&&previous.sha256===sha256&&previous.size===file.size&&previous.mimeType===mime(file)){","if(false){"]
};
const mutation=process.env.HJ_MEDIA_BATCH_MUTATION;
if(mutation){const m=mutations[mutation];assert(m&&source.includes(m[0]),'mutation target');source=source.replace(m[0],m[1]);console.log('MUTATION '+mutation);}
let browser,passed=0;
async function boot(){
  const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin===ORIGIN&&u.pathname==='/media-safety.js')return route.fulfill({status:200,contentType:'text/javascript',body:source});return u.origin===ORIGIN&&req.method()==='GET'?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.HJMedia&&window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async()=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;__tabStale=false;state._demo=false;
    state.projects=[{name:'TEST_A',phases:[],cost:{material:0,labor:0,outsource:0}},{name:'TEST_B',phases:[]}];
    state.activeProject='TEST_A';state.tab='photos';state.dirHandle=null;state.files=[];state.dirty=false;
    __relay.url='https://script.google.com/macros/s/AKfyTEST_BATCH/exec';__relay.token='TEST_BATCH_TOKEN';__relay.device='TEST_BATCH_DEVICE';relayReady=()=>true;
    const bytes=new TextEncoder().encode('TEST_BATCH_IMAGE_BYTES'),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const fp=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(__relay.url+'\u0000'+__relay.token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
    window.__batch={bytes,sha,fp,calls:[],hold:null,release:null};
    __batch.rec=(id,project='TEST_A',remote=true)=>({id,name:id+'.png',size:bytes.length,kind:'photo',ext:'png',prefix:'',project,when:new Date('2026-09-20T00:00:00Z'),_file:new File([bytes],id+'.png',{type:'image/png'}),_originalSha256:sha,...(remote?{_driveId:'TEST_REMOTE_'+id}:{}),text:'',ocr:'na',thumb:null});
    __batch.meta=(id)=>({verified:true,fileId:'TEST_REMOTE_'+id,name:id+'.png',size:bytes.length,mimeType:'image/png',sha256:sha,connectionFingerprint:fp});
    relayCall=async(action,payload)=>{
      __batch.calls.push({action,payload});
      if(action==='mediaHealth')return {ok:true,version:'media-relay-v1',maxFileBytes:104857600,chunkBytes:1048576,mimeTypes:['image/png']};
      if(action==='mediaInspect'){
        if(__batch.hold)await new Promise(resolve=>{__batch.release=resolve;});
        if(__batch.error)return {ok:false,error:__batch.error};
        return {ok:true,version:'media-relay-v1',file:{...__batch.meta(payload.fileId.replace('TEST_REMOTE_','')),fileId:payload.fileId}};
      }
      return {ok:false,error:'drive-unavailable'};
    };
    render();__mobileMode=true;applyMobileMode();clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
  });return {context,page,errors};
}
async function test(name,fn){const t=await boot();try{await fn(t.page);assert.deepEqual(t.errors,[]);passed++;console.log('PASS media-batch '+name);}finally{await t.context.close();}}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  await test('project audit is read only and reachable at 360px',async page=>{
    await page.evaluate(()=>{state.files=[__batch.rec('A1'),__batch.rec('A2'),__batch.rec('B1','TEST_B')];__batch.before=JSON.stringify(serializeData().files);HJMedia.view();});
    await page.locator('#mediaAuditOpen').click();await page.locator('#mediaAuditRun').click();await page.waitForFunction(()=>document.querySelector('#mediaAuditStatus').textContent.includes('점검 완료'));
    const r=await page.evaluate(()=>({calls:__batch.calls,rows:document.querySelector('#mediaAuditRows').textContent,before:__batch.before,after:JSON.stringify(serializeData().files),overflow:document.documentElement.scrollWidth-innerWidth,button:document.querySelector('#mediaAuditRun').getBoundingClientRect().height}));
    assert.deepEqual(r.calls.map(c=>c.action),['mediaInspect','mediaInspect']);assert(!r.rows.includes('B1'));assert.equal(r.before,r.after);assert(r.overflow<=1);assert(r.button>=44);
  });
  await test('failure replaces previous success and no-source rows do not upload',async page=>{
    await page.evaluate(async()=>{state.files=[__batch.rec('A1'),__batch.rec('A2','TEST_A',false)];await HJMedia.verify('A1');__batch.error='not-found';__batch.calls=[];HJMedia.auditView();});
    await page.locator('#mediaAuditRun').click();await page.waitForFunction(()=>document.querySelector('#mediaAuditStatus').textContent.includes('점검 완료'));
    const r=await page.evaluate(()=>({rows:document.querySelector('#mediaAuditRows').textContent,proof:state.files[0]._sourceVerification,calls:__batch.calls}));assert(r.rows.includes('확인 실패'));assert(r.rows.includes('기기 원본 연결'));assert.equal(r.proof,undefined);assert.equal(r.calls.length,1);
  });
  await test('cancel stops later records',async page=>{
    await page.evaluate(()=>{state.files=[__batch.rec('A1'),__batch.rec('A2')];__batch.hold=true;HJMedia.auditView();});
    await page.locator('#mediaAuditRun').click();await page.waitForFunction(()=>!!__batch.release);await page.locator('#mediaAuditCancel').click();await page.evaluate(()=>{__batch.hold=false;__batch.release();});
    await page.waitForFunction(()=>!document.querySelector('#mediaAuditRun').disabled);assert.equal(await page.evaluate(()=>__batch.calls.length),1);assert((await page.locator('#mediaAuditStatus').textContent()).includes('중단됨'));
  });
  await test('mid-run record and connection changes invalidate all results',async page=>{
    for(const kind of ['record','connection']){
      await page.evaluate(()=>{state.files=[__batch.rec('A1')];__batch.hold=true;__batch.release=null;HJMedia.auditView();});
      await page.locator('#mediaAuditRun').click();await page.waitForFunction(()=>!!__batch.release);
      await page.evaluate(kind=>{if(kind==='record')state.files[0].project='TEST_B';else __relay.token='TEST_CHANGED_TOKEN';__batch.hold=false;__batch.release();},kind);
      await page.waitForFunction(()=>!document.querySelector('#mediaAuditRun').disabled);assert((await page.locator('#mediaAuditStatus').textContent()).includes('무효'));assert.equal(await page.locator('#mediaAuditRows article').count(),0);
    }
  });
  await test('512 durable completed receipts compact to allow another job',async page=>{
    const r=await page.evaluate(async()=>{
      const jobs=[];state.files=[];
      for(let i=1;i<=512;i++){const f=__batch.rec('OLD'+i);f._mediaOriginal=__batch.meta('OLD'+i);state.files.push(f);jobs.push({uploadId:'00000000-0000-4000-a000-'+String(i).padStart(12,'0'),recordId:f.id,key:fileKey(f),name:f.name,size:f.size,mimeType:'image/png',sha256:__batch.sha,connectionFingerprint:__batch.fp,state:'complete',offset:f.size,file:f._mediaOriginal});}
      state.files.push(__batch.rec('NEW','TEST_A',false));await idbSet('appState',serializeData());await idbSet(HJMedia.queueKey,jobs);
      const result=await HJMedia.upload('NEW');const rows=await idbGetStrict(HJMedia.queueKey);return {result,rows:rows.map(x=>({id:x.recordId,state:x.state})),begins:__batch.calls.filter(x=>x.action==='mediaUploadBegin').length};
    });assert.equal(r.result.error,'drive-unavailable');assert.equal(r.begins,1);assert.deepEqual(r.rows,[{id:'NEW',state:'retry'}]);
  });
  await test('missing durable proof retains completed recovery jobs',async page=>{
    const r=await page.evaluate(async()=>{
      const old=__batch.rec('OLD');old._mediaOriginal=__batch.meta('OLD');state.files=[old,__batch.rec('NEW','TEST_A',false)];
      const saved=serializeData();delete saved.files[0].mediaOriginal;await idbSet('appState',saved);
      await idbSet(HJMedia.queueKey,[{uploadId:'00000000-0000-4000-a000-000000000001',recordId:old.id,key:fileKey(old),name:old.name,size:old.size,mimeType:'image/png',sha256:__batch.sha,connectionFingerprint:__batch.fp,state:'complete',offset:old.size,file:old._mediaOriginal}]);
      await HJMedia.upload('NEW');return (await idbGetStrict(HJMedia.queueKey)).map(x=>x.recordId);
    });assert.deepEqual(r,['OLD','NEW']);
  });
  await test('compacted original retry verifies existing ID without a new upload',async page=>{
    const r=await page.evaluate(async()=>{const old=__batch.rec('OLD');old._mediaOriginal=__batch.meta('OLD');state.files=[old];await idbSet('appState',serializeData());await idbSet(HJMedia.queueKey,[]);return {result:await HJMedia.upload('OLD'),calls:__batch.calls};});
    assert.equal(r.result.ok,true);assert.equal(r.result.reused,true);assert.deepEqual(r.calls.map(x=>x.action),['mediaHealth','mediaInspect']);
  });
  await test('restoring old metadata still reuses compacted upload identity',async page=>{
    const r=await page.evaluate(async()=>{
      const old=__batch.rec('OLD');old._mediaOriginal=__batch.meta('OLD');state.files=[old,__batch.rec('NEW','TEST_A',false)];await idbSet('appState',serializeData());
      const uploadId='00000000-0000-4000-a000-000000000001';await idbSet(HJMedia.queueKey,[{uploadId,recordId:old.id,key:fileKey(old),name:old.name,size:old.size,mimeType:'image/png',sha256:__batch.sha,connectionFingerprint:__batch.fp,state:'complete',offset:old.size,file:old._mediaOriginal}]);
      await HJMedia.upload('NEW');delete old._mediaOriginal;__batch.calls=[];
      await HJMedia.upload('OLD');return {calls:__batch.calls,uploadId,receipts:Object.values(await idbGetStrict(HJMedia.queueKey+'_completed')).length};
    });assert.equal(r.calls.find(x=>x.action==='mediaUploadBegin').payload.uploadId,r.uploadId);assert.equal(r.receipts,1);
  });
  await test('receipt storage abort never loses active recovery queue',async page=>{
    const r=await page.evaluate(async()=>{
      const old=__batch.rec('OLD');old._mediaOriginal=__batch.meta('OLD');state.files=[old,__batch.rec('NEW','TEST_A',false)];await idbSet('appState',serializeData());
      const jobs=[{uploadId:'00000000-0000-4000-a000-000000000001',recordId:old.id,key:fileKey(old),name:old.name,size:old.size,mimeType:'image/png',sha256:__batch.sha,connectionFingerprint:__batch.fp,state:'complete',offset:old.size,file:old._mediaOriginal}];await idbSet(HJMedia.queueKey,jobs);
      const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(key===HJMedia.queueKey+'_completed')throw new DOMException('TEST_QUOTA','QuotaExceededError');return put.apply(this,arguments);};
      let result;try{result=await HJMedia.upload('NEW');}finally{IDBObjectStore.prototype.put=put;}
      return {result,rows:await idbGetStrict(HJMedia.queueKey),same:JSON.stringify(jobs)===JSON.stringify(await idbGetStrict(HJMedia.queueKey)),begins:__batch.calls.filter(x=>x.action==='mediaUploadBegin').length};
    });assert.equal(r.result.error,'storage-failed');assert.equal(r.same,true);assert.equal(r.begins,0);
  });
  console.log('media-batch-audit: '+passed+'/'+passed+' PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:8299';
const mutation=process.env.HJ_NO_RECOVERY_MUTATION||'';
const mutations={
  archive:['const archive=options?.recovery!==false;','const archive=true;'],
  default:['const archive=options?.recovery!==false;','const archive=false;'],
  rehash:['await duplicateOriginalHash(pair.file,originals)!==pair.hash','(await duplicateOriginalHash(pair.file,originals),false)'],
  confirm:['fn:()=>confirmDuplicateDiscard(plan)','fn:async()=>{await saveVerifiedDuplicates(plan,{recovery:false});}'],
  atomic:['if(!await guardedAppStateWriteAtomic(data,__paidCommitPointerKey,__tabStamp,null,unchanged,removedIds,removedExpected,photoJournal))return false;','/* atomic persistence removed */']
};
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:850}});
  await ctx.route('**/*',async route=>{
    if(new URL(route.request().url()).origin!==origin)return route.abort();
    if(mutation&&new URL(route.request().url()).pathname==='/index.html'){
      const r=await route.fetch(),s=await r.text(),[from,to]=mutations[mutation];assert(s.includes(from),'mutation target exists');
      return route.fulfill({response:r,body:s.replace(from,to)});
    }return route.continue();
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  async function boot(){
    await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
    await page.evaluate(async()=>{
      await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
      taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;__autoSaveOn=false;__gdToken=null;relayReady=()=>false;markDirty=()=>{state.dirty=true;};aiOpsEnsureState().enabled=false;
      window.__seedDiscard=async(mode='empty')=>{
        closeModal(true);__tabStale=false;__tabStamp=(await idbGetStrict('appState'))?.savedAt||null;await idbDel(PHOTO_RECOVERY_KEY);await idbSet('removed_ids',['untouched-drive-id']);__removedIds=new Set(['untouched-drive-id']);
        state.projects=[{name:'합성현장',stage:1,phases:[],cost:{},customer:{},aptUnits:[]}];
        const make=(id,name)=>({id,name,prefix:'사진/',kind:'photo',ext:'jpg',size:4,when:new Date('2026-10-01T00:00:00Z'),project:'합성현장',_phase:'방수',_worklabel:'바닥',_file:new File([new Uint8Array([1,2,3,4])],name,{type:'image/jpeg'})});
        state.files=[make('original','original.jpg'),make('copy','original (1).jpg')];
        if(mode==='bytes')state.files[1]._file=new File([new Uint8Array([4,3,2,1])],'different.jpg');
        if(mode==='metadata')state.files[1]._worklabel='다른 작업';
        if(mode==='missing')delete state.files[1]._file;
        if(mode==='full'||mode==='count'||mode==='old'){
          const record=make('archived','archived.jpg');
          if(mode==='full')record._file=new Blob([new Uint8Array(128*1048576)]);
          await idbSet(PHOTO_RECOVERY_KEY,{schemaVersion:1,revision:'existing-revision',batches:Array.from({length:mode==='count'?30:1},(_,i)=>({id:'old-'+i,at:'2026-10-01T00:00:00.000Z',records:[{...record,id:'archived-'+i}]}))});
        }
        if(mode==='invalid')await idbSet(PHOTO_RECOVERY_KEY,{unreadable:'preserve'});
        state.activeProject=null;state.tab='photos';state.search='';state.quotes=[];state.schedule=[];state.notes=[];state.payLog=[];state.expenses=[];state.aptOrders=[];state._demo=false;state.dirHandle=null;__showDup=false;__phaseProj=null;__photoCache.key='';__sel.clear();
        await guardedPersistCurrentState();render();
      };
      window.__journalProof=async()=>{
        const j=await idbGetStrict(PHOTO_RECOVERY_KEY);
        if(!j)return null;
        const hashes=[];for(const b of j.batches||[])for(const r of b.records)hashes.push(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r._file.arrayBuffer()))).join(','));
        return JSON.stringify([j,hashes]);
      };
    });
  }
  await boot();
  for(const mode of ['bytes','metadata','missing']){
    await page.evaluate(m=>__seedDiscard(m),mode);
    assert.equal(await page.evaluate(async()=>(await verifyDuplicatePhotos()).pairs.length),0,mode+' not deletable');
  }
  for(const mode of ['full','count','old','empty','invalid']){
    await page.evaluate(m=>__seedDiscard(m),mode);
    const result=await page.evaluate(async mode=>{
      const before=await __journalProof(),plan=await verifyDuplicatePhotos();
      let defaultResult;if(mode==='full'||mode==='count')defaultResult=await saveVerifiedDuplicates(plan);
      const ok=await saveVerifiedDuplicates(plan,{recovery:false}),disk=await idbGetStrict('appState');
      return {ok,defaultResult,ids:state.files.map(f=>f.id),disk:disk.files.map(f=>f.name),same:before===await __journalProof(),removed:await idbGetStrict('removed_ids')};
    },mode);
    if(mode==='full'||mode==='count')assert.equal(result.defaultResult,false,'default recovery still enforces capacity');
    assert(result.ok,mode+' discard bypasses recovery capacity');assert(result.same,'existing recovery bytes and metadata preserved');
    assert.deepEqual(result.ids,['original']);assert.deepEqual(result.disk,['original.jpg'],'atomic durable deletion');assert.deepEqual(result.removed,['untouched-drive-id']);
  }
  console.log('PASS full 128MB / 30 batches, empty and invalid journals; disk, originals and old recovery preserved');
  for(const fault of ['stale','rehash','snapshot','quota','cas','ids']){
    await page.evaluate(()=>__seedDiscard('old'));
    const result=await page.evaluate(async fault=>{
      const plan=await verifyDuplicatePhotos(),before=JSON.stringify(await idbGetStrict('appState')),journal=await __journalProof();
      const snapshot=hjSnapshot,put=IDBObjectStore.prototype.put;
      if(fault==='stale')state.files[1]._worklabel='changed';
      if(fault==='ids'){state.files[1].id=state.files[0].id;plan.current=()=>true;}
      if(fault==='rehash'){state.files[1].handle={queryPermission:async()=>'granted',getFile:async()=>new File([new Uint8Array([9,9,9,9])],'changed.jpg')};plan.current=()=>true;}
      if(fault==='snapshot')hjSnapshot=async()=>false;
      if(fault==='quota')IDBObjectStore.prototype.put=function(value,key){if(key==='appState')throw new DOMException('synthetic quota','QuotaExceededError');return put.call(this,value,key);};
      if(fault==='cas')__tabStamp='2000-01-01T00:00:00.000Z';
      try{return {ok:await saveVerifiedDuplicates(plan,{recovery:false}),n:state.files.length,disk:before===JSON.stringify(await idbGetStrict('appState')),journal:journal===await __journalProof()};}
      finally{hjSnapshot=snapshot;IDBObjectStore.prototype.put=put;}
    },fault);
    assert.equal(result.ok,false,fault+' prevents deletion');assert.equal(result.n,2);assert(result.disk);assert(result.journal);
  }
  console.log('PASS stale plan, rehash, snapshot, quota, CAS and identity failure protection');
  await page.evaluate(()=>__seedDiscard('old'));
  await page.evaluate(()=>trimDuplicates());
  await page.getByRole('button',{name:'복구 보관 없이 삭제',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.files.length),2,'confirmation must precede deletion');
  assert.match(await page.locator('#modalRoot').innerText(),/복구함에서 되돌릴 수 없습니다/);
  await page.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.files.length),2,'cancel preserves records');
  await page.evaluate(()=>trimDuplicates());
  await page.getByRole('button',{name:'복구 보관 없이 삭제',exact:true}).click();
  await page.evaluate(()=>{state.files[1]._worklabel='changed after confirmation';});
  await page.getByRole('button',{name:'1장 보관 없이 삭제 확정',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.files.length),2,'stale confirmation preserves records');
  assert.match(await page.locator('#toast').innerText(),/자료가 변경되었습니다/);
  await page.evaluate(()=>__seedDiscard('old'));
  await page.evaluate(()=>trimDuplicates());
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'preview fits '+width);
  }
  if(process.env.HJ_NO_RECOVERY_SCREENSHOT){await page.locator('#toast').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:process.env.HJ_NO_RECOVERY_SCREENSHOT+'-preview.png'});await page.locator('#toast').evaluate(e=>e.style.visibility='');}
  await page.getByRole('button',{name:'복구 보관 없이 삭제',exact:true}).click();
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'confirmation fits '+width);
    assert(await page.locator('#modalRoot .mfoot button').evaluateAll(buttons=>buttons.every(b=>b.getBoundingClientRect().height>=44)),'confirmation buttons meet 44px target '+width);
  }
  if(process.env.HJ_NO_RECOVERY_SCREENSHOT){await page.locator('#toast').evaluate(e=>e.style.visibility='hidden');await page.screenshot({path:process.env.HJ_NO_RECOVERY_SCREENSHOT+'-confirm.png'});await page.locator('#toast').evaluate(e=>e.style.visibility='');}
  await page.getByRole('button',{name:'1장 보관 없이 삭제 확정',exact:true}).click();
  await page.waitForFunction(()=>state.files.length===1);
  assert.match(await page.locator('#toast').innerText(),/복구함에서 되돌릴 수 없습니다/);
  await boot();
  assert.equal(await page.evaluate(()=>state.files.length),1,'deletion survives reload');
  assert(await page.evaluate(()=>restoreDuplicateBatch('old-0')),'existing recovery still works');
  await page.evaluate(()=>__seedDiscard());
  assert(await page.evaluate(async()=>saveVerifiedDuplicates(await verifyDuplicatePhotos())),'default still archives');
  assert.equal(await page.evaluate(async()=>(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length),1);
  assert.deepEqual(errors,[]);
  console.log('PASS separate confirmation, cancel, responsive UI, reload, old recovery and default archive');
  await browser.close();browser=null;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

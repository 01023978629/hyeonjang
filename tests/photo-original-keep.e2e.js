'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:8299';
const mutation=process.env.HJ_ORIGINAL_KEEP_MUTATION||'';
const mutations={
  keeper:['candidates.sort((a,b)=>duplicateKeeperRank(b.f,b.hash)-duplicateKeeperRank(a.f,a.hash));','/* keeper priority removed */'],
  group:['if(checked+group.length>50||bytes+total>128*1048576||group.some(f=>Number(f.size)>32*1048576))','if(false)'],
  restore:['proof.pathCount!==pathCount||(pathCount>0&&(proof.path!==path||pathCount!==1))','false'],
  download:['blob=result.blob;','/* verified download removed */']
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
  const page=await ctx.newPage();
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  async function boot(){
    await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
    await page.evaluate(async()=>{
      await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
      taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;__autoSaveOn=false;__gdToken=null;relayReady=()=>false;markDirty=()=>{state.dirty=true;};aiOpsEnsureState().enabled=false;
      window.__seedOriginal=async(mode='server')=>{
        closeModal(true);__tabStale=false;await idbDel(PHOTO_RECOVERY_KEY);
        state.projects=[{name:'테스트현장',stage:1,phases:[],cost:{},customer:{},aptUnits:[]}];
        const make=(id,name)=>({id,name,prefix:'사진/',kind:'photo',ext:'jpg',size:4,when:new Date('2026-10-01T00:00:00Z'),project:'테스트현장',_phase:'방수',_worklabel:'바닥',_file:new File([new Uint8Array([1,2,3,4])],name,{type:'image/jpeg'})});
        state.files=[make('copy','original (1).jpg'),make('original','original.jpg')];
        const hash=await duplicateOriginalHash(state.files[1]);
        if(mode==='server'||mode==='remote'||mode==='bad')state.files[1]._mediaOriginal={fileId:'synthetic-server-original',sha256:mode==='bad'?'f'.repeat(64):hash,size:4};
        if(mode==='remote'||mode==='remoteSamepath'){
          delete state.files[1]._file;
          window.__originalMedia=HJMedia;
          window.HJMedia={readOriginal:async id=>state.files.some(f=>f.id===id)?({ok:true,blob:new Blob([new Uint8Array([1,2,3,4])]),file:{id}}):({ok:false})};
        }else if(window.__originalMedia)window.HJMedia=__originalMedia;
        if(mode==='samepath')state.files.forEach(f=>f.name='image.jpg');
        if(mode==='batchSamepath')state.files=[state.files[1],state.files[0],{...state.files[0],id:'copy2'}];
        if(mode==='remoteSamepath')state.files.forEach((f,i)=>{f.name='image.jpg';delete f._file;f._mediaOriginal={fileId:'synthetic-server-'+i,sha256:hash,size:4};});
        if(mode==='invalidId'){
          state.files[0]._mediaOriginal={fileId:'?',sha256:hash,size:4};state.files[1]._driveId='valid-existing-drive';
        }
        if(mode==='date')state.files[1].when=new Date('2026-10-02T00:00:00Z');
        if(mode==='largegroup')state.files=Array.from({length:51},(_,i)=>make('f'+i,'image'+i+'.jpg'));
        state.activeProject=null;state.tab='photos';state.search='';state.quotes=[];state.schedule=[];state.notes=[];state.payLog=[];state.expenses=[];state.aptOrders=[];state._demo=false;state.dirHandle=null;__showDup=false;__phaseProj=null;__photoCache.key='';__sel.clear();
        await guardedPersistCurrentState();render();
      };
    });
  }
  await boot();
  for(const mode of ['server','remote']){
    await page.evaluate(m=>__seedOriginal(m),mode);
    const result=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();return {keep:p.pairs[0]?.keep.id,drop:p.pairs[0]?.file.id,n:p.pairs.length,ok:await saveVerifiedDuplicates(p),ids:state.files.map(f=>f.id),proof:state.files[0]._mediaOriginal?.fileId};});
    assert.equal(result.n,1,mode+' verifies actual bytes');assert.equal(result.keep,'original');assert.equal(result.drop,'copy');assert(result.ok);assert.deepEqual(result.ids,['original']);assert.equal(result.proof,'synthetic-server-original');
  }
  for(const mode of ['bad','date','largegroup']){
    await page.evaluate(m=>__seedOriginal(m),mode);
    assert.equal(await page.evaluate(async()=>(await verifyDuplicatePhotos()).pairs.length),0,mode+' must remain untouched');
  }
  await page.evaluate(()=>__seedOriginal('invalidId'));
  assert.equal(await page.evaluate(async()=>(await verifyDuplicatePhotos()).pairs[0]?.keep.id),'original','malformed server ID must not outrank existing original connection');
  await page.evaluate(()=>__seedOriginal('remoteSamepath'));
  const remoteRecovery=await page.evaluate(async()=>{
    const p=await verifyDuplicatePhotos(),ok=await saveVerifiedDuplicates(p),j=await idbGetStrict(PHOTO_RECOVERY_KEY);
    return {ok,blob:j?.batches[0].records[0]._file instanceof Blob,restored:await restoreDuplicateBatch(j.batches[0].id)};
  });
  assert(remoteRecovery.ok);assert(remoteRecovery.blob,'downloaded removed original is durably retained');assert(remoteRecovery.restored,'removed server ID is never queried during recovery');
  await page.evaluate(()=>__seedOriginal('batchSamepath'));
  const batchRecovery=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();await saveVerifiedDuplicates(p);const j=await idbGetStrict(PHOTO_RECOVERY_KEY);return {n:p.pairs.length,ok:await restoreDuplicateBatch(j.batches[0].id),names:state.files.map(f=>f.name)};});
  assert.equal(batchRecovery.n,2);assert(batchRecovery.ok,'same-path copies inside one recovery batch are restored together');assert.deepEqual(batchRecovery.names,['original.jpg','original (1).jpg','original (1).jpg']);
  await page.evaluate(()=>__seedOriginal('samepath'));
  assert(await page.evaluate(async()=>saveVerifiedDuplicates(await verifyDuplicatePhotos())));
  await boot();
  const needsConnection=await page.evaluate(async()=>{const j=await idbGetStrict(PHOTO_RECOVERY_KEY);const ok=await restoreDuplicateBatch(j.batches[0].id);return {ok,batches:(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length};});
  assert.equal(needsConnection.ok,false,'missing current original requires reconnection');assert.equal(needsConnection.batches,1);
  await page.evaluate(()=>{state.files[0]._file=new File([new Uint8Array([1,2,3,4])],'image.jpg',{type:'image/jpeg'});});
  const recovered=await page.evaluate(async()=>{const j=await idbGetStrict(PHOTO_RECOVERY_KEY);return {ok:await restoreDuplicateBatch(j.batches[0].id),toast:document.querySelector('#toast')?.textContent,identity:state.files.map(duplicateKeeperIdentity),proof:j.batches[0].keepers};});
  assert(recovered.ok, 'same-name recovery works after reload: '+JSON.stringify(recovered));
  assert.equal(await page.evaluate(()=>state.files.length),2);
  await page.evaluate(()=>__seedOriginal('samepath'));
  const collision=await page.evaluate(async()=>{
    await saveVerifiedDuplicates(await verifyDuplicatePhotos());const j=await idbGetStrict(PHOTO_RECOVERY_KEY);
    state.files.push({...state.files[0],id:'rescanned',_driveId:'new-source'});await guardedPersistCurrentState();
    return {ok:await restoreDuplicateBatch(j.batches[0].id),n:state.files.length,batches:(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length};
  });
  assert.equal(collision.ok,false,'rescanned source blocks same-name recovery');assert.equal(collision.n,2);assert.equal(collision.batches,1);
  await page.evaluate(()=>__seedOriginal('samepath'));
  const race=await page.evaluate(async()=>{
    await saveVerifiedDuplicates(await verifyDuplicatePhotos());const j=await idbGetStrict(PHOTO_RECOVERY_KEY),original=hjSnapshot;
    hjSnapshot=async()=>{state.files[0]._file=new File([new Uint8Array([9,9,9,9])],'image.jpg');return true;};
    try{return {ok:await restoreDuplicateBatch(j.batches[0].id),n:state.files.length,left:(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length};}finally{hjSnapshot=original;}
  });
  assert.equal(race.ok,false,'source replacement after hashing blocks restore commit');assert.equal(race.n,1);assert.equal(race.left,1);
  await page.evaluate(()=>__seedOriginal('date'));
  await page.locator('#btnTrimDup').click();
  await page.waitForFunction(()=>document.querySelector('#modalRoot')?.textContent.includes('안전 정리 가능 0장'));
  assert.match(await page.locator('#modalRoot').innerText(),/중복 사진 원본만 남기기/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page fits');
  await page.evaluate(()=>__seedOriginal('server'));
  await page.locator('#btnTrimDup').click();
  await page.waitForFunction(()=>document.querySelector('#modalRoot')?.textContent.includes('1장 중복 삭제'));
  assert.match(await page.locator('#modalRoot').innerText(),/original \(1\)\.jpg → original\.jpg 유지/);
  assert.equal(await page.evaluate(()=>state.files.length),2,'preview does not delete');
  if(process.env.HJ_ORIGINAL_SCREENSHOT){await page.locator('.toast').evaluateAll(es=>es.forEach(e=>e.remove()));await page.screenshot({path:process.env.HJ_ORIGINAL_SCREENSHOT});}
  console.log('PASS original selection, server reads, complete group limits, same-path durable recovery, collision protection and preview');
  await browser.close();browser=null;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});

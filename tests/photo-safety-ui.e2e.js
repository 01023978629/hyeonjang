/* v324: synthetic originals, isolated IDB, no external requests or user files. */
'use strict';
const assert=require('node:assert/strict');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_PHOTO_SAFETY_MUTATION||'';
const mutations={
  hash:["async function duplicateOriginalHash(f){","async function duplicateOriginalHash(f){return '0'.repeat(64);"],
  metadata:['function duplicateMetadata(f){',"function duplicateMetadata(f){return '';"],
  proof:["if([f._originalSha256,f._mediaOriginal?.sha256].some(proof=>proof&&String(proof).toLowerCase()!==hash))","if(false)"],
  snapshot:["if(await hjSnapshot('검증된 중복 사진 정리 전',true)!==true)",'if(false)'],
  journal:['if(photoJournal)store.put(photoJournal.value,PHOTO_RECOVERY_KEY);','/* dropped recovery journal */'],
  cas:['if(photoRecoveryRevision(raw)!==photoJournal.expected)','if(false)'],
  visible:['const visible=c.items;','const visible=c.items.filter(p=>!p._dup);'],
  margin:['if(!(s.costEffective>0))','if(false)'],
  order:['return sortProjectDisplay(state.projects.filter(p=>!p.archived||p.name===sel),projectPhotoCounts(state.files));','return state.projects.filter(p=>!p.archived||p.name===sel);']
};
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
  await ctx.route('**/*',async route=>{
    if(new URL(route.request().url()).origin!==ORIGIN)return route.abort();
    if(mutation&&new URL(route.request().url()).pathname==='/index.html'){
      const response=await route.fetch(),body=await response.text(),[from,to]=mutations[mutation];
      assert(body.includes(from),'mutation target exists');return route.fulfill({response,body:body.replace(from,to)});
    }return route.continue();
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  async function boot(){
    await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
    await page.evaluate(async()=>{
      await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
      taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;
      __autoSaveOn=false;__gdToken=null;relayReady=()=>false;markDirty=()=>{state.dirty=true;};aiOpsEnsureState().enabled=false;
      window.__testSnapshot=hjSnapshot;window.__testAtomic=guardedAppStateWriteAtomic;
      window.__seedSafety=async mode=>{
        closeModal(true);hjSnapshot=__testSnapshot;guardedAppStateWriteAtomic=__testAtomic;__tabStale=false;
        await idbDel(PHOTO_RECOVERY_KEY);await idbSet('removed_ids',['unrelated-removed']);__removedIds=new Set(['unrelated-removed']);
        state.projects=['한밭','다온10','나무','가온','다온2'].map(name=>({name,stage:1,phases:[name+' 공정'],cost:{},customer:{},aptUnits:[{id:'u1',type:'unit',dong:'101',ho:'101',name:'',note:''}]}));
        const make=(id,bytes,extra={})=>({id,name:id+'.jpg',prefix:'현장사진/',kind:'photo',ext:'jpg',size:4,when:new Date('2026-09-25T01:00:00Z'),project:'가온',_phase:'방수',_worklabel:'2차 방수',_aptUnit:{project:'가온',unitId:'u1'},_driveId:'same-drive',_file:new File([new Uint8Array(bytes)],id+'.jpg',{type:'image/jpeg'}),...extra});
        state.files=[make('a',[1,2,3,4]),make('b',mode==='different'?[4,3,2,1]:[1,2,3,4]),make('c',[9,8,7,6],{project:'한밭',_driveId:'other-drive',when:new Date('2026-09-24T01:00:00Z')})];
        if(mode==='metadata')state.files[1]._worklabel='다른 작업';
        if(mode==='unit')state.files[1]._aptUnit={project:'가온',unitId:'u2'};
        if(mode==='missing')delete state.files[1]._file;
        if(mode==='proof')state.files[1]._originalSha256='f'.repeat(64);
        if(mode==='mediaProof')state.files[1]._mediaOriginal={sha256:'e'.repeat(64)};
        if(mode==='permission')state.files[1].handle={queryPermission:async()=>'denied',getFile:async()=>{throw new Error('must not read denied handle');}};
        state.activeProject=null;state.tab='photos';state.search='';state.quotes=[];state.schedule=[];state.notes=[];state.payLog=[];state.expenses=[];state.aptOrders=[];state._demo=false;state.dirHandle=null;
        __showDup=false;__phaseProj=null;__photoCache.key='';__sel.clear();
        await guardedPersistCurrentState();render();
      };
    });
  }
  await boot();
  async function seed(mode='same'){await page.evaluate(mode=>__seedSafety(mode),mode);}
  for(const mode of ['different','metadata','unit','missing','proof','mediaProof','permission']){
    await seed(mode);
    const result=await page.evaluate(async()=>{const before=JSON.stringify({...serializeData(),savedAt:''});const plan=await verifyDuplicatePhotos();return {pairs:plan.pairs.length,unchanged:before===JSON.stringify({...serializeData(),savedAt:''}),cells:document.querySelectorAll('.cluster-body .ph').length};});
    assert.equal(result.pairs,0,'unverified/different originals or metadata must not be cleaned: '+mode);assert(result.unchanged);assert.equal(result.cells,3,'suspected duplicates remain visible');
  }
  console.log('PASS bytes/metadata/unit/missing originals: preserve every photo and all data');
  await seed();
  assert.equal(await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();state.files[1].project='나무';return saveVerifiedDuplicates(p);}),false,'stale verification rejected');
  await seed();
  assert.equal(await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();state.files[1]._file=new File([new Uint8Array([9,9,9,9])],'b.jpg');return saveVerifiedDuplicates(p);}),false,'replaced Blob rejected');
  await seed();
  const snap=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();hjSnapshot=async()=>false;const ok=await saveVerifiedDuplicates(p);return {ok,n:state.files.length,journal:await idbGetStrict(PHOTO_RECOVERY_KEY)};});
  assert.equal(snap.ok,false,'snapshot failure must block cleanup');assert.equal(snap.n,3);assert.equal(snap.journal,undefined);
  await seed();
  const quota=await page.evaluate(async()=>{
    const p=await verifyDuplicatePhotos(),before=await idbGetStrict('appState'),put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){if(key===PHOTO_RECOVERY_KEY)throw new DOMException('synthetic quota','QuotaExceededError');return put.call(this,value,key);};
    try{return {ok:await saveVerifiedDuplicates(p),n:state.files.length,unchanged:JSON.stringify(await idbGetStrict('appState'))===JSON.stringify(before),journal:await idbGetStrict(PHOTO_RECOVERY_KEY)};}finally{IDBObjectStore.prototype.put=put;}
  });
  assert.equal(quota.ok,false,'journal failure must abort the entire transaction');assert.equal(quota.n,3);assert(quota.unchanged);assert.equal(quota.journal,undefined);
  await seed();
  const conflict=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();hjSnapshot=async()=>{await idbSet(PHOTO_RECOVERY_KEY,{schemaVersion:1,revision:'other-tab',batches:[]});return true;};return {ok:await saveVerifiedDuplicates(p),n:state.files.length,revision:(await idbGetStrict(PHOTO_RECOVERY_KEY)).revision};});
  assert.equal(conflict.ok,false,'journal CAS must reject a changed revision');assert.equal(conflict.n,3);assert.equal(conflict.revision,'other-tab');
  console.log('PASS changed source, snapshot failure, quota rollback and competing journal revision');
  await seed();
  const cleaned=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos(),ok=await saveVerifiedDuplicates(p),j=await idbGetStrict(PHOTO_RECOVERY_KEY);return {ok,n:state.files.length,nStored:(await idbGetStrict('appState')).files.length,batches:j?.batches.length,blob:j?.batches[0].records[0]._file instanceof Blob,removed:[...__removedIds],savedRemoved:await idbGetStrict('removed_ids')};});
  assert(cleaned.ok);assert.equal(cleaned.n,2);assert.equal(cleaned.nStored,2);assert.equal(cleaned.batches,1,'successful cleanup must have an atomic recovery record');assert(cleaned.blob);assert.deepEqual(cleaned.removed,['unrelated-removed']);assert.deepEqual(cleaned.savedRemoved,cleaned.removed);
  await boot();
  const restored=await page.evaluate(async()=>{
    const j=await idbGetStrict(PHOTO_RECOVERY_KEY);state.files.push({id:'later',name:'later.txt',kind:'docs',prefix:'',text:'later work'});await guardedPersistCurrentState();
    const ok=await restoreDuplicateBatch(j.batches[0].id),f=state.files.find(f=>f.name==='b.jpg');
    return {ok,n:state.files.length,bytes:f?Array.from(new Uint8Array(await f._file.arrayBuffer())):[],work:f?f._worklabel:null,unit:f?f._aptUnit:null,later:state.files.some(f=>f.name==='later.txt'),left:(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length};
  });
  assert(restored.ok);assert.equal(restored.n,4);assert.deepEqual(restored.bytes,[1,2,3,4]);assert.equal(restored.work,'2차 방수');assert.equal(restored.unit.unitId,'u1');assert(restored.later);assert.equal(restored.left,0);
  await seed();
  const collision=await page.evaluate(async()=>{const p=await verifyDuplicatePhotos();await saveVerifiedDuplicates(p);const j=await idbGetStrict(PHOTO_RECOVERY_KEY);state.files.push({...p.pairs[0].file,id:'rescanned'});await guardedPersistCurrentState();return {ok:await restoreDuplicateBatch(j.batches[0].id),n:state.files.length};});
  assert.equal(collision.ok,false,'rescanned/restored path must not be appended twice');assert.equal(collision.n,3);
  await seed();
  const changedUnit=await page.evaluate(async()=>{await saveVerifiedDuplicates(await verifyDuplicatePhotos());const j=await idbGetStrict(PHOTO_RECOVERY_KEY);state.projects.find(p=>p.name==='가온').aptUnits=[];await guardedPersistCurrentState();return {ok:await restoreDuplicateBatch(j.batches[0].id),n:state.files.length,left:(await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length};});
  assert.equal(changedUnit.ok,false,'removed unit must not receive restored photos');assert.equal(changedUnit.n,2);assert.equal(changedUnit.left,1);
  console.log('PASS cleanup/reload/recovery preserves bytes, apartment assignment, unrelated records and Drive IDs');
  await seed();
  for(const width of [1280,360,412]){
    await page.setViewportSize({width,height:850});
    const selection=await page.evaluate(()=>{__phaseBarOpen=true;render();return {options:[...document.querySelector('#phaseProjSel').options].map(o=>o.value),phase:document.querySelector('.phase-chips').textContent,before:JSON.stringify({...serializeData(),savedAt:''})};});
    assert.deepEqual(selection.options,['나무','다온2','다온10','가온','한밭'],'project selector empty-photo first and numeric Korean order');assert.match(selection.phase,/나무 공정/,'phase content matches sorted default');
    const field=page.locator('#phaseProjSel').locator('..').locator('input[type=search]');
    await field.fill('다 온');
    assert.equal(await page.locator('#phaseProjSel').inputValue(),'나무','search does not silently reassign');
    assert.deepEqual(await page.locator('#phaseProjSel option').evaluateAll(es=>es.map(e=>e.value)),['나무','다온2','다온10']);
    await field.press('Escape');assert.equal(await page.locator('#phaseProjSel option').count(),5);
    assert.equal(await page.evaluate(()=>JSON.stringify({...serializeData(),savedAt:''})),selection.before,'search/sort preserve saved business data');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page has no horizontal overflow');
    if(process.env.HJ_V324_SCREENSHOTS&&width===360){await page.locator('#phaseProjSel').scrollIntoViewIfNeeded();await page.locator('.toast').evaluateAll(es=>es.forEach(e=>e.remove()));await page.screenshot({path:process.env.HJ_V324_SCREENSHOTS+'-mobile.png'});}
  }
  await page.evaluate(()=>openPhotoIntake([new File(['x'],'new.jpg')],{project:'한밭'}));
  assert.equal(await page.locator('#photoIntakeProject option:checked').textContent(),'한밭');
  assert.deepEqual(await page.locator('#photoIntakeProject option').evaluateAll(es=>es.slice(1,-1).map(e=>e.textContent)),['나무','다온2','다온10','가온','한밭']);
  await page.locator('#photoIntakeCancel').click();
  const margin=await page.evaluate(()=>{
    const before=JSON.stringify({...serializeData(),savedAt:''});
    return {none:projectMarginLabel({est:1000,costEffective:0,marginEff:1000,marginRateEff:100}),actual:projectMarginLabel({est:1000,costEffective:400,marginEff:600,marginRateEff:60}),negative:projectMarginLabel({est:1000,costEffective:1200,marginEff:-200,marginRateEff:-20}),estimate:projectMarginLabel({est:0,costEffective:0}),unchanged:before===JSON.stringify({...serializeData(),savedAt:''})};
  });
  assert.match(margin.none,/원가 입력 필요/,'missing costs do not imply 100% profit');assert.doesNotMatch(margin.none,/100%/);assert.match(margin.actual,/60%/);assert.match(margin.negative,/-20%/);assert.match(margin.estimate,/견적 입력 필요/);assert(margin.unchanged);
  const display=await page.evaluate(()=>{state.files.push({id:'estimate',name:'q.xlsx',kind:'estimate',project:'가온',est:{amount:1000}});state.activeProject='가온';state.tab='project';render();return document.querySelector('#view').textContent;});
  assert.match(display,/원가 입력 필요/,'project view uses honest margin label');
  const dashboard=await page.evaluate(()=>{state.activeProject=null;state.tab='dashboard';render();const table=[...document.querySelectorAll('#view table')].find(t=>t.querySelector('thead')?.textContent.includes('순마진'));return [...table.querySelectorAll('tbody tr')].filter(r=>r.textContent.includes('가온')||r.textContent.includes('합계')).map(r=>[r.cells[6].textContent,r.cells[7].textContent]);});
  assert.equal(dashboard.length,2);dashboard.flat().forEach(label=>{assert.match(label,/미확정/,'dashboard row and totals must qualify both margin definitions');assert.doesNotMatch(label,/100%/);});
  await seed('different');
  const assigned=await page.evaluate(async()=>{state.files[0].project=null;state.files[1].project=null;markDuplicates(state.files);window.__clusters=[{items:state.files.slice(0,2)}];window.__clusterSuggest=[{name:'가온',why:'gps'}];hjSnapshot=async()=>true;const n=await photoSuggestApplyAll();return {n,names:state.files.slice(0,2).map(f=>f.project)};});
  assert.equal(assigned.n,2,'bulk assignment includes visible suspected photos');assert.deepEqual(assigned.names,['가온','가온']);
  assert.deepEqual(errors,[]);console.log('PASS desktop/phone search and selected value; read-only honest margin label');
  await browser.close();console.log('PASS v324 photo safety and project UI');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exit(1);});

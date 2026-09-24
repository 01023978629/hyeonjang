/* v323: isolated project display + fake, read-only File System Access scan.
   HJ_PROJECT_SCAN_MUTATION=zero|alphabet|counts|priority|canonical|unit|bytes|exact|restart|phase|classified
   Each mutation must fail a named assertion (not a timeout). No real folder/account. */
'use strict';
const assert=require('node:assert/strict');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_PROJECT_SCAN_MUTATION||'';
const mutations={
  zero:['return Number(emptyB)-Number(emptyA)||','return 0||'],
  alphabet:["String(a.name).localeCompare(String(b.name),'ko',{numeric:true})","String(b.name).localeCompare(String(a.name),'ko',{numeric:true})"],
  counts:["f&&f.project&&f.kind==='photo')counts.set","f&&f.project)counts.set"],
  priority:['return photos.concat(rest);','return rest.concat(photos);'],
  canonical:['async function settleScannedPhotoCopies(){','async function settleScannedPhotoCopies(){return;'],
  unit:['if(JSON.stringify(a._aptUnit??null)!==JSON.stringify(b._aptUnit??null))continue;','/* mutant: discard unit boundary */'],
  bytes:['if(ha!==hb)continue;','/* mutant: assume equal bytes */'],
  exact:['if(!s&&!scanExactPhotoName(f.name)&&byName[f.name]','if(!s&&byName[f.name]'],
  restart:['function equalSizeScanPhotoPair(a,b){','function equalSizeScanPhotoPair(a,b){return false;'],
  phase:["['project','_phase','_worklabel','contact','text','est','exSum','_driveId'","['project','_worklabel','contact','text','est','exSum','_driveId'"],
  classified:["if(a.kind!=='photo'||b.kind!=='photo')continue;","/* mutant: absorb manually classified document */"]
};
assert(!mutation||mutations[mutation]);
const names=['한밭아파트','삼호아파트','가온아파트','나무아파트','다온2아파트','다온10아파트'];
const expected=['나무아파트','다온2아파트','다온10아파트','한밭아파트','가온아파트','삼호아파트'];
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    if(new URL(route.request().url()).origin!==ORIGIN)return route.abort();
    if(mutation&&new URL(route.request().url()).pathname==='/index.html'){
      const response=await route.fetch(),body=await response.text(),[from,to]=mutations[mutation];
      assert(body.includes(from),'mutation target present: '+mutation);
      return route.fulfill({response,body:body.replace(from,to)});
    }
    return route.continue();
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(10000);
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
  await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
  await page.evaluate(names=>{
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;
    __autoSaveOn=false;__gdToken=null;relayReady=()=>false;aiAutoOrgOffer=()=>{};quoteAutoAssignOffer=()=>{};aiOpsEnsureState().enabled=false;
    // Prevent any persistence/AI/network effect while keeping the actual scan and restoration pipeline.
    markDirty=()=>{state.dirty=true;};extractImage=async()=>{};ensureBuiltInCalendarImports=()=>({changed:false});
    const p=name=>({name,stage:2,phases:['방수'],cost:{},customer:{},received:0});
    state.projects=[...names.map(p),{...p('보관 다'),archived:true},{...p('보관 가'),archived:true}];
    const f=(name,project,kind='photo')=>({id:name,name:name+'.mp4',prefix:'현장사진/',kind,project,ext:'mp4',size:4,when:new Date('2026-09-25T00:00:00Z')});
    state.files=[f('a','가온아파트'),f('s','삼호아파트'),f('unassigned',null),f('doc','한밭아파트','docs'),f('arc','보관 가')];
    state.activeProject='삼호아파트';state.tab='photos';state.search='';state.quotes=[];state.schedule=[];state.notes=[];state.payLog=[];state.expenses=[];state.aptOrders=[];
    state.dirHandle=null;state._demo=false;__showArchived=false;render();
    window.__orderBaseline=JSON.stringify({...serializeData(),savedAt:'fixed'});
  },names);
  for(const width of [1280,360,412]){
    await page.setViewportSize({width,height:850});
    const got=await page.evaluate(()=>{
      render();openProjectSheet();
      return {desktop:[...document.querySelectorAll('#projList > div > .proj-item')].map(e=>e.getAttribute('aria-label').split(' 현장 열기')[0]),
        mobile:[...document.querySelectorAll('#psList .ps-row')].map(e=>e.dataset.psel),
        selected:document.querySelector('#psList [aria-pressed="true"]').dataset.psel,
        empty:[...document.querySelectorAll('#projList .stage-row')].filter(e=>e.textContent.includes('사진 0개')).length,
        meta:[...document.querySelectorAll('#psList .ps-row')].find(e=>e.dataset.psel==='한밭아파트').textContent};
    });
    assert.deepEqual(got.desktop,expected,'PC: photo-zero first then Korean/numeric alphabetical order');
    assert.deepEqual(got.mobile,expected,'mobile: selected project must not override zero-first order');
    assert.equal(got.selected,'삼호아파트');assert.equal(got.empty,4,'documents-only project is photo-empty');assert.match(got.meta,/자료 1개 · 사진 0개/);
    await page.locator('#psSearch').fill('다온');
    assert.deepEqual(await page.locator('#psList .ps-row').evaluateAll(es=>es.map(e=>e.dataset.psel)),['다온2아파트','다온10아파트']);
    await page.locator('#psSearchClear').click();await page.locator('#psArcTg').click();
    assert.deepEqual((await page.locator('#psList .ps-row').evaluateAll(es=>es.map(e=>e.dataset.psel))).slice(-2),['보관 다','보관 가'],'archived projects stay separate and follow the same rule');
    await page.locator('#projSheetClose').click();
    await page.waitForFunction(()=>!document.getElementById('projSheet')&&!window.__mobileSheetHistoryRetire);
    await page.evaluate(()=>openCameraProjectSheet());
    assert.deepEqual(await page.locator('[data-camera-project]').evaluateAll(es=>es.map(e=>e.dataset.cameraProject)),expected,'camera picker uses the same order');
    await page.locator('#cameraProjectClose').click();await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire);
    const snapshot=await page.evaluate(()=>({before:JSON.parse(__orderBaseline),after:JSON.parse(JSON.stringify({...serializeData(),savedAt:'fixed'}))}));
    assert.deepEqual(snapshot.after,snapshot.before,'view sorting does not modify saved business data');
    await page.evaluate(()=>{__showArchived=false;});
  }
  await page.evaluate(()=>{state.files.push({id:'new-photo',name:'new.mp4',kind:'photo',ext:'mp4',project:'나무아파트'});render();});
  assert.equal(await page.locator('#projList > div > .proj-item').first().getAttribute('aria-label'),'다온2아파트 현장 열기','rerender recalculates zero-photo group after assignment');
  console.log('PASS project display: desktop/mobile/camera, documents-only, video, search, archived, read-only');

  // Every directory handle below is synthetic; writes/removals throw.
  await page.evaluate(()=>{
    window.__runScanFixture=async({variant='same',stored=false,reverse=false,direct=false}={})=>{
      const reads=[],forbidden=[];let atDocuments=null;
      const deny=()=>{forbidden.push('write');throw Error('fixture write prohibited');};
      const fh=(name,body,opts={})=>({kind:'file',name,createWritable:deny,getFile:async()=>{
        reads.push(name);
        if(name==='quote.txt')atDocuments=state.files.filter(f=>f.prefix.startsWith('현장사진/')).length;
        const file=new File([body],name,{lastModified:1750000000000,type:name.endsWith('mp4')?'video/mp4':'text/plain'});
        if(opts.large)Object.defineProperty(file,'size',{value:100*1024*1024+1});
        if(opts.fail)file.arrayBuffer=async()=>{throw Error('synthetic byte read denied');};
        return file;
      }});
      const dir=(name,entries,fail=false)=>({kind:'directory',name,removeEntry:deny,
        async *entries(){if(fail)throw Error('synthetic folder denied');for(const e of entries)yield [e.name,e];},
        async getFileHandle(n,options){if(options&&options.create)deny();const f=entries.find(e=>e.name===n);if(!f)throw Error('not found');return f;}});
      const p=name=>({name,stage:2,received:0,phases:['방수'],cost:{},customer:{}});
      state.projects=[p('가온아파트'),p('다른아파트')];state.activeProject=null;state.tab='photos';state.search='';__showArchived=false;
      state.quotes=[];state.files=[];state._savedFileCount=0;__lastData=null;__dataAt='';
      const name='same.mp4',rawPath='현장사진/',phaseFolder=variant==='phase'?'현장사진':'방수',orgPath='_정리완료/가온아파트/'+phaseFolder+'/';
      const base={name,kind:'photo',ext:'mp4',size:4,project:'가온아파트',_worklabel:'수기 작업명',_phase:'방수',when:new Date('2026-09-25T00:00:00Z')};
      const raw={...base,id:'raw-old',prefix:rawPath},org={...base,id:'org-old',prefix:orgPath};
      if(variant==='project')raw.project='다른아파트';
      if(variant==='unit')raw._aptUnit={dong:'101',ho:'202'};
      if(variant==='shared-unit'){raw._aptUnit={dong:'101',ho:'202'};raw._driveId=org._driveId='synthetic-shared-drive';}
      if(variant==='shared-bytes')raw._driveId=org._driveId='synthetic-shared-drive';
      if(variant==='drive'){raw._driveId='synthetic-raw-drive';org._driveId='synthetic-org-drive';}
      if(variant==='hash'){raw._originalSha256='a'.repeat(64);org._originalSha256='b'.repeat(64);}
      if(variant==='evidence'){raw._mediaOriginal={size:4,type:'video/mp4'};org._mediaOriginal={size:5,type:'video/mp4'};}
      if(variant==='classified'){raw.kind='estimate';raw.est={amount:70000};raw.exSum=true;}
      if(variant==='phase'){raw._phase='타일';raw._worklabel=null;org._phase=null;org._worklabel=null;}
      if(variant==='same'){
        const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('SAME')))).map(x=>x.toString(16).padStart(2,'0')).join('');
        raw._originalSha256=sha;org._originalSha256=sha;raw._driveId=org._driveId='synthetic-shared-drive';
        raw._aptUnit=org._aptUnit={dong:'101',ho:'201'};org._mediaOriginal={sha256:sha};
      }
      if(variant==='fallback'){org._driveId='synthetic-only-org';org._originalSha256='b'.repeat(64);}
      if(variant==='large'){raw.size=org.size=100*1024*1024+1;}
      state.files=variant==='fallback'?[org]:[raw,org];
      const saved=serializeData();saved.savedAt='2099-01-01T00:00:00Z';
      if(stored)state.files=[]; // first connection: exact bindings exist only in _현장.json
      const rawFile=fh(name,'SAME',{large:variant==='large'}),orgFile=fh(name,['bytes','shared-bytes','fallback'].includes(variant)?'DIFF':'SAME',{fail:variant==='readfail',large:variant==='large'});
      const photoDir=dir('현장사진',[...Array.from({length:9},(_,i)=>fh('photo-'+i+'.mp4','x')),rawFile]);
      const organized=dir('_정리완료',[dir('가온아파트',[dir(phaseFolder,[orgFile])])]);
      const docs=dir('견적서',[fh('quote.txt','memo')]);
      const extras=[dir('_백업',[fh('MUST-NOT-READ.mp4','x')]),dir('막힌폴더',[],true),fh('_현장캐시.json','{}')];
      const entries=reverse?[organized,photoDir,docs,...extras]:[docs,...extras,organized,photoDir];
      if(stored)entries.push(fh('_현장.json',JSON.stringify(saved)));
      if(variant==='third')photoDir.entries=async function*(){yield [name,rawFile];yield ['다른원본',dir('다른원본',[fh(name,'SAME')])];};
      state.dirHandle=direct?organized:dir('만물',entries);
      await scanDir();
      const summary=f=>({prefix:f.prefix,project:f.project,kind:f.kind,est:f.est,excluded:!!f.exSum,phase:f._phase,work:f._worklabel,unit:f._aptUnit||null,drive:f._driveId||null,hash:f._originalSha256||null,media:f._mediaOriginal||null,handle:f.handle===orgFile?'organized':f.handle===rawFile?'raw':'other'});
      const records=state.files.filter(f=>f.name===name).map(summary);
      const roundTrip=serializeData();__scanPhotoNames=new Set();state.files=[];state.dirHandle=null;applyData(roundTrip);
      const reloaded=state.files.filter(f=>f.name===name).map(summary);
      return {records,reloaded,reads,atDocuments,forbidden,failed:[...__walkFailed],skipped:[...__walkSkip],names:[...__walkNames]};
    };
  });
  for(const stored of [false,true])for(const reverse of [false,true]){
    const r=await page.evaluate(args=>__runScanFixture(args),{stored,reverse});
    assert.equal(r.atDocuments,10,'현장사진 files must be read before document files');
    assert.equal(r.records.length,1,'byte-identical raw/organized photo remains one display record');
    const f=r.records[0];assert.equal(f.handle,'organized','canonical organized handle survives photo-first scan');
    assert.equal(f.prefix,'_정리완료/가온아파트/방수/');assert.equal(f.phase,'방수');assert.equal(f.work,'수기 작업명');
    assert.deepEqual(f.unit,{dong:'101',ho:'201'});assert.equal(f.drive,'synthetic-shared-drive');assert.equal(f.hash.length,64);assert.equal(f.media.sha256,f.hash);
    assert(!r.reads.includes('MUST-NOT-READ.mp4'));assert(!r.reads.includes('_현장캐시.json'));assert.deepEqual(r.forbidden,[]);
    assert(r.failed.includes('막힌폴더/'));assert(r.skipped.includes('_백업/'));assert(r.names.includes('same.mp4'));
  }
  console.log('PASS scan priority, whole scan/loadProject path restoration, exact units/hash/Drive, exclusions/failure tracking');
  for(const variant of ['unit','shared-unit','shared-bytes','project','drive','hash','evidence','bytes','readfail','large','fallback','third','classified'])for(const stored of [false,true]){
    const r=await page.evaluate(args=>__runScanFixture(args),{variant,stored});
    assert.equal(r.records.length,variant==='third'?3:2,'ambiguous '+variant+' retains all real records through full scan (stored='+stored+')');
    assert.equal(r.reloaded.length,r.records.length,'ambiguous '+variant+' remains preserved after fresh-session JSON restore');
    const raw=r.records.find(f=>f.prefix==='현장사진/'),org=r.records.find(f=>f.prefix.startsWith('_정리완료/'));
    assert.equal(raw.handle,'raw');assert.equal(org.handle,'organized');assert.deepEqual(r.forbidden,[]);
    if(variant==='unit'){assert.deepEqual(raw.unit,{dong:'101',ho:'202'});assert.equal(org.unit,null);}
    if(variant==='shared-unit'){assert.deepEqual(raw.unit,{dong:'101',ho:'202'});assert.equal(org.unit,null);assert.deepEqual(r.reloaded.find(f=>f.prefix==='현장사진/').unit,raw.unit);assert.equal(r.reloaded.find(f=>f.prefix.startsWith('_정리완료/')).unit,null);}
    if(variant.startsWith('shared-'))assert(r.reloaded.every(f=>f.drive==='synthetic-shared-drive'));
    if(variant==='project')assert.equal(raw.project,'다른아파트');
    if(variant==='drive'){assert.equal(raw.drive,'synthetic-raw-drive');assert.equal(org.drive,'synthetic-org-drive');}
    if(variant==='hash'){assert.equal(raw.hash,'a'.repeat(64));assert.equal(org.hash,'b'.repeat(64));}
    if(variant==='fallback'){assert.equal(raw.drive,null,'ambiguous raw photo must not inherit other path Drive ID');assert.equal(raw.hash,null);assert.equal(org.drive,'synthetic-only-org');}
    if(variant==='classified'){assert.equal(raw.kind,'estimate');assert.equal(raw.est.amount,70000);assert(raw.excluded);}
  }
  for(const stored of [false,true]){
    const phase=await page.evaluate(args=>__runScanFixture(args),{variant:'phase',stored});
    assert.equal(phase.records.length,1);assert.equal(phase.records[0].phase,'타일','raw-only manual phase survives when organized folder has no phase');
  }
  const direct=await page.evaluate(()=>__runScanFixture({direct:true}));
  assert(direct.records.some(f=>f.prefix==='_정리완료/가온아파트/방수/'&&f.handle==='organized'),'direct organized root still restores canonical handle');
  assert.deepEqual(errors,[],'no uncaught browser errors');
  console.log('PASS conflicts/read failure/large media retained, no cross-path fallback, direct organized root');
  if(process.env.HJ_PROJECT_SCAN_SHOT){await page.setViewportSize({width:1280,height:900});await page.screenshot({path:process.env.HJ_PROJECT_SCAN_SHOT});}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

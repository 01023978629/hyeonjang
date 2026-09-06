/* v267: fake local documents only. No original file writes, uploads or live accounts.
   HJ_ESTIMATE_INFO_MUTATION=date|quote|money deliberately removes one protection in-page. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const MUTATION=process.env.HJ_ESTIMATE_INFO_MUTATION||'';
assert(['','date','quote','money'].includes(MUTATION));
const A='가상 가아파트',B='가상 나아파트',X='<img src=x onerror=window.__estimateXss=1>';
let browser,passed=0;
async function boot(width=390){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async({a,b,x,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure();coworkSchedEnsure();aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    const p=name=>({name,stage:1,received:12345,phases:[],cost:{material:1000,labor:2000,outsource:0},customer:{},archived:false});
    state.projects=[p(a),p(b),{...p('가상 보관아파트'),archived:true},p(x)];
    state.quotes=[{id:'fake-q1',title:'가상 작성 견적',no:'FAKE-1',date:'2026-09-01',createdAt:'2026-08-31T23:30:00.000Z',place:'',memo:'보존',accountIdx:0,
      project:a,vatIncluded:true,items:[{name:'가상 배관',spec:'가상',qty:2,price:100000}]}];
    const f=(id,prefix,project,more={})=>({id,name:'가상 견적.pdf',prefix,kind:'estimate',ext:'pdf',size:100+id.length,project,
      when:new Date('2026-08-31T23:00:00Z'),sourceModifiedAt:'2026-08-31T23:00:00.000Z',_virtual:true,
      est:{amount:654321,supply:594837,vat:59484,date:'2026.08.30',customer:'가상 고객',_edited:true},exSum:true,...more});
    state.files=[f('fake-f1','견적서/가상1/',a),f('fake-f2','견적서/가상2/',b),
      f('fake-unknown','',{...p(a)}.name,{name:x+'.pdf',when:null,sourceModifiedAt:null,est:{amount:987,_edited:true,date:''}}),
      {id:'fake-photo',name:'가상 사진.jpg',kind:'photo',ext:'jpg',size:12,project:a,when:null,_virtual:true}];
    syncQuoteToProject(state.quotes[0]);state.aptOrders=[];state.payLog=[];state.expenses=[];state.schedule=[];
    state.editingQuote=null;state.activeProject=null;state.tab='estimates';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('fake-photo');__gdToken=null;relayReady=()=>false;
    window.__estimateXss=0;window.__estimateCalls=[];window.__estimateSnapshots=[];window.__estimateMutation=0;
    relayCall=async()=>{window.__estimateCalls.push('relay');throw new Error('unexpected relay');};portalAutoSync=()=>{window.__estimateCalls.push('portal');};
    const nativeSnapshot=hjSnapshot;hjSnapshot=function(label,force,empty){window.__estimateSnapshots.push({label,force,empty});return nativeSnapshot.apply(this,arguments);};
    render();clearTimeout(__idbSaveTimer);if(!await guardedPersistCurrentState())throw new Error('fixture persistence failed');await __appStateWriteQueue;
    window.__estimateInitialFinance=JSON.stringify({projects:state.projects,quotes:state.quotes.map(({project,...q})=>q),est:state.files.filter(f=>!f._fromQuote).map(f=>[f.name,f.est,!!f.exSum]),pay:state.payLog,expenses:state.expenses,orders:state.aptOrders});
    if(mutation==='date'){const native=estimateDateRows;estimateDateRows=function(f,q){const rows=native.apply(this,arguments);if(f&&f.sourceModifiedAt){rows.push({label:'원본 생성일',value:estimateInstant(f.sourceModifiedAt)});window.__estimateMutation++;}return rows;};}
    if(mutation==='quote'){const native=estimateProjectAssign;estimateProjectAssign=async function(type,id,project){const t=estimateInfoTarget(type,id);if(t&&t.q){const f=state.files.find(f=>f.id==='quote_'+t.q.id);if(f)f.project=project;window.__estimateMutation++;return true;}return native.apply(this,arguments);};}
    if(mutation==='money'){estimateDerivedQuotesConsistent=()=>{window.__estimateMutation++;return true;};}
  },{a:A,b:B,x:X,mutation:MUTATION});observe=true;return{context,page,errors,requests,width};
}
async function run(name,fn,width=390){const t=await boot(width);try{await fn(t);assert.deepEqual(t.errors,[]);passed++;console.log('PASS '+width+'px '+name);}finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__estimateMutation).catch(()=>0));await t.context.close();}}
const call=(page,type,id,project)=>page.evaluate(async({type,id,project})=>{try{return{ok:await estimateProjectAssign(type,id,project)};}catch(e){return{error:e.message};}},{type,id,project});
const snap=page=>page.evaluate(async()=>{const data=serializeData();data.savedAt='FIXED';return{live:JSON.stringify({data,selected:[...__sel],editing:state.editingQuote,dirty:state.dirty}),stored:JSON.stringify(await idbGet('appState'))};});
async function finance(t){const r=await t.page.evaluate(()=>({actual:JSON.stringify({projects:state.projects,quotes:state.quotes.map(({project,...q})=>q),est:state.files.filter(f=>!f._fromQuote).map(f=>[f.name,f.est,!!f.exSum]),pay:state.payLog,expenses:state.expenses,orders:state.aptOrders}),before:window.__estimateInitialFinance}));assert.deepEqual(JSON.parse(r.actual),JSON.parse(r.before),'amounts, invoice dates, names, projects, payments, orders and costs unchanged');assert.deepEqual(await t.page.evaluate(()=>window.__estimateCalls),[]);assert.deepEqual(t.requests,[]);}
(async()=>{browser=await chromium.launch({headless:true});
  await run('날짜 출처·한국시간·미확인·윤년과 신규/외부 생성일 구분',async t=>{
    const r=await t.page.evaluate(()=>{const f=state.files[0],before=JSON.stringify(f),rows=estimateDateRows(f),fresh=newQuote(),legacy={...state.quotes[0]};delete legacy.createdAt;
      const grid=[['품명','수량','단가'],['가상 공사',1,1000]],unknown=parseQuoteFromGrid(grid,'가상.xlsx'),dated=parseQuoteFromGrid([['견적일','2024-02-29'],...grid],'가상.xlsx');
      return{rows,summary:estimateDateSummary(f),same:JSON.stringify(f)===before,created:estimateDateRows(null,fresh),legacy:estimateDateRows(null,legacy),unknown,dated,
        dates:['2024-02-29','2025-02-29','2026-13-01','2026.9.7','bad'].map(estimateDay),invalid:estimateInstant('2026-02-30T00:00:00Z')};});
    assert(r.rows.find(x=>x.label==='파일 수정일').value.includes('2026-09-01 08:00'),'lastModified formatted in Korea');
    assert(r.rows.filter(x=>x.label==='원본 생성일').every(x=>x.value.startsWith('미확인')),'modifiedAt must never be reported as original creation time');
    assert(r.same);assert(r.created.find(x=>x.label==='앱 생성일').value.includes('한국시간'));assert(r.legacy.find(x=>x.label==='앱 생성일').value.startsWith('미확인'));
    assert.equal(r.unknown.date,'');assert.equal(r.unknown.createdAt,undefined);assert.equal(r.dated.date,'2024-02-29');assert.equal(r.dated.createdAt,undefined);
    assert.deepEqual(r.dates,['2024-02-29','','','2026-09-07','']);assert.equal(r.invalid,'');await finance(t);
  });
  await run('앱 견적 A→B→미지정→A 원자 저장·복원·가상파일 한 개',async t=>{
    for(const destination of [B,null,A]){
      assert.deepEqual(await call(t.page,'quote','fake-q1',destination),{ok:true});
      const r=await t.page.evaluate(()=>{const d=serializeData();d.savedAt=__tabStamp;const q=d.quotes.find(q=>q.id==='fake-q1'),virtual=state.files.filter(f=>f._fromQuote),copy=structuredClone(d);applyPaidCommittedState(copy);return{q:q.project,virtual:virtual.map(f=>[f.project,f.est.amount]),count:d._savedFileCount,total:quoteCalc(state.quotes[0]).total,roundtrip:JSON.stringify(serializeData(state,d.savedAt))===JSON.stringify(d)};});
      assert.equal(r.q,destination,'quote.project is the durable source of truth');assert.deepEqual(r.virtual,destination?[[destination,220000]]:[]);assert.equal(r.total,220000);assert(r.roundtrip);assert.equal(r.count,destination?5:4);
    }
    assert((await t.page.evaluate(()=>window.__estimateSnapshots)).every(s=>s.force===true));await finance(t);
  });
  await run('외부 동일명 다른 경로 개별 지정·해제·재스캔 보존',async t=>{
    assert.deepEqual(await call(t.page,'file','fake-f1',B),{ok:true});assert.deepEqual(await call(t.page,'file','fake-f1',null),{ok:true});
    const before=await t.page.evaluate(()=>state.files.filter(f=>!f._fromQuote).map(f=>[f.id,f.project]));assert.equal(before.find(r=>r[0]==='fake-f2')[1],B);
    await finance(t);
    const r=await t.page.evaluate(async()=>{backupUserEdits();const rec=await ingestFile(new File(['%PDF-FAKE'],'가상 견적.pdf',{type:'application/pdf',lastModified:Date.parse('2026-08-31T23:00:00Z')}),null,'견적서/가상1/');
      const old=state.files.find(f=>f.id==='fake-f1');return{project:rec.project,kind:rec.kind,amount:rec.est.amount,ex:rec.exSum,other:state.files.find(f=>f.id==='fake-f2').project,modified:rec.sourceModifiedAt,oldAmount:old.est.amount};});
    assert.equal(r.project,null);assert.equal(r.kind,'estimate');assert.equal(r.amount,654321);assert.equal(r.oldAmount,654321);assert(r.ex);assert.equal(r.other,B);assert.equal(r.modified,'2026-08-31T23:00:00.000Z');
  });
  await run('수정일 메타데이터 serialize/apply/원자 복원 및 Drive 다시읽기에서 보존',async t=>{
    const r=await t.page.evaluate(async()=>{const d=serializeData(),saved=d.files.find(f=>f.name==='가상 견적.pdf');applyPaidCommittedState(d);const after=serializeData();state.files=[];applyData(d,{revert:true});
      const restored=state.files.find(f=>f.prefix==='견적서/가상1/');restored._driveId='FAKE-ESTIMATE-DRIVE';restored._virtual=true;const expected=restored.sourceModifiedAt;
      const nativeFetch=window.fetch;window.fetch=async()=>new Response('%PDF-FAKE',{status:200,headers:{'Content-Type':'application/pdf'}});
      try{await __gdIngestOne('FAKE-ESTIMATE-DRIVE','가상 견적.pdf','application/pdf','FAKE-TOKEN',false,'estimate');}finally{window.fetch=nativeFetch;}
      const downloaded=state.files.find(f=>f._driveId==='FAKE-ESTIMATE-DRIVE');return{saved:saved.sourceModifiedAt,after:after.files.find(f=>f.prefix==='견적서/가상1/').sourceModifiedAt,restored:expected,downloaded:downloaded.sourceModifiedAt};});
    for(const v of Object.values(r))assert.equal(v,'2026-08-31T23:00:00.000Z');assert.deepEqual(t.requests,[]);
  });
  await run('스냅샷/원자 저장 실패·편집 초안·중복/고아 연결은 변경 0',async t=>{
    let before=await snap(t.page);await t.page.evaluate(()=>{window.__savedSnapshot=hjSnapshot;hjSnapshot=async()=>false;});assert((await call(t.page,'file','fake-f1',B)).error);assert.deepEqual(await snap(t.page),before);
    await t.page.evaluate(()=>{hjSnapshot=window.__savedSnapshot;window.__savedAtomic=paidCommitWriteAtomic;paidCommitWriteAtomic=async()=>{throw new Error('QuotaExceededError');};});before=await snap(t.page);assert((await call(t.page,'quote','fake-q1',B)).error);assert.deepEqual(await snap(t.page),before);
    await t.page.evaluate(()=>{paidCommitWriteAtomic=window.__savedAtomic;state.editingQuote={...state.quotes[0],memo:'편집 중'};});before=await snap(t.page);assert((await call(t.page,'file','fake-f1',B)).error);assert.deepEqual(await snap(t.page),before);
    await t.page.evaluate(()=>{state.editingQuote=null;state.files.push({id:'quote_orphan',kind:'estimate',name:'가상 고아',_fromQuote:true});});before=await snap(t.page);assert((await call(t.page,'file','quote_orphan',B)).error);assert.deepEqual(await snap(t.page),before);
    await t.page.evaluate(()=>{state.files=state.files.filter(f=>f.id!=='quote_orphan');state.quotes.push({...state.quotes[0]});});before=await snap(t.page);assert((await call(t.page,'quote','fake-q1',B)).error);assert.deepEqual(await snap(t.page),before);
  });
  await run('기존 정산표의 수기 금액 충돌은 덮어쓰지 않고 중단',async t=>{
    await t.page.evaluate(()=>{state.files.find(f=>f._fromQuote).est.amount=330000;});const before=await snap(t.page),r=await call(t.page,'file','fake-f1',B);
    assert(r.error&&r.error.includes('금액'));assert.deepEqual(await snap(t.page),before);assert.equal(await t.page.evaluate(()=>state.files.find(f=>f._fromQuote).est.amount),330000);
  });
  for(const width of [390,360,1280])await run('카드 진입·취소·프로젝트 저장·보관/없는 프로젝트·XSS·44px',async t=>{
    await t.page.evaluate(()=>{state.tab='quotemaker';render();});await t.page.locator('[data-estimate-type="quote"][data-estimate-info="fake-q1"]').click();
    await t.page.locator('#estimateInfoPanel').waitFor();const before=await snap(t.page);
    const controls=await t.page.locator('#modalRoot button:visible,#modalRoot select:visible').evaluateAll(els=>els.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,label:e.labels&&e.labels.length||e.getAttribute('aria-label')||e.textContent})));
    assert(controls.every(c=>c.w>=44&&c.h>=44&&c.label));assert(await t.page.locator('#modalRoot .modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.getElementById('estimateInfoPanel')&&!window.__mobileSheetHistoryRetire);assert.deepEqual(await snap(t.page),before);
    await t.page.evaluate(()=>{state.tab='estimates';render();});await t.page.locator('[data-estimate-type="file"][data-estimate-info="fake-unknown"]').click();assert.equal(await t.page.locator('#estimateInfoPanel img').count(),0);assert((await t.page.locator('#estimateInfoPanel').innerText()).includes(X));
    await t.page.locator('#estimateProject').selectOption({label:B});await t.page.getByRole('button',{name:'프로젝트 저장',exact:true}).dblclick();await t.page.waitForFunction(()=>!document.getElementById('estimateInfoPanel'));assert.equal(await t.page.evaluate(()=>state.files.find(f=>f.id==='fake-unknown').project),B);
    await t.page.evaluate(()=>{state.files.find(f=>f.id==='fake-f1').project='가상 보관아파트';estimateInfoOpen('file','fake-f1');});assert.equal(await t.page.locator('#estimateProject option:checked').innerText(),'가상 보관아파트');
    await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.getElementById('estimateInfoPanel')&&!window.__mobileSheetHistoryRetire);
    await t.page.evaluate(()=>{state.files.find(f=>f.id==='fake-f1').project='삭제된 가상 프로젝트';estimateInfoOpen('file','fake-f1');});assert.equal(await t.page.locator('#estimateProject option:checked').innerText(),'삭제된 가상 프로젝트');
    assert((await call(t.page,'file','fake-f1','삭제된 가상 프로젝트')).error);assert.equal(await t.page.evaluate(()=>window.__estimateXss),0);
    if(process.env.HJ_ESTIMATE_INFO_SCREENSHOT_DIR&&width<600){await t.page.waitForFunction(()=>{const el=document.getElementById('toast');return !el||!el.classList.contains('show')&&Number(getComputedStyle(el).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_ESTIMATE_INFO_SCREENSHOT_DIR,'estimate-info-'+width+'.png')});}
    assert.deepEqual(t.requests,[]);
  },width);
  console.log('== estimate-info: '+passed+' passed, pageerrors=0 ==');await browser.close();
})().catch(async e=>{console.error('FAIL estimate-info',e);if(browser)await browser.close();process.exitCode=1;});

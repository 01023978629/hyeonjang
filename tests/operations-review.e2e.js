'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'}),page=await context.newPage();
  await context.route('**/*',r=>{
   if(!r.request().url().startsWith('http://127.0.0.1:8299/'))return r.abort();
   if(process.env.HJ_OPS_MUTATION&&r.request().url().endsWith('/operations-review.js')){
    let text=fs.readFileSync(path.join(__dirname,'..','operations-review.js'),'utf8');
    if(process.env.HJ_OPS_MUTATION==='unit')text=text.replace('const doneAt=ownDate||p.doneAt||\'\';',"const doneAt=p.doneAt||'';");
    if(process.env.HJ_OPS_MUTATION==='cost')text=text.replace("r.sourceFingerprint===hjCostSource(name)",'true');
    return r.fulfill({contentType:'text/javascript',body:text});
   }return r.continue();
  });
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&typeof hjUnitLifecycleSave==='function');
  await page.evaluate(async()=>{
   await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,window.__hjRelayBootDone]);
   taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;
   clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
   const unit=(id)=>({id,type:'unit',dong:'101',ho:id==='unit-a'?'501':'502',name:'',note:''});
   state.projects=[{name:'TEST_APARTMENT',stage:2,received:0,cost:{material:100,labor:0,outsource:0},phases:[],customer:{},doneAt:'2026-08-01',aptUnits:[unit('unit-a'),unit('unit-b')]}];
   state.files=[];state.expenses=[];state.payLog=[];state.schedule=[];state.quotes=[];state.activeProject='TEST_APARTMENT';state._demo=false;__tabStale=false;state.dirHandle=null;__relay.url='';__relay.token='';__gdToken=null;
   await guardedPersistCurrentState();render();
  });
  const r=await page.evaluate(async()=>{
   await hjUnitLifecycleSave('TEST_APARTMENT','unit-a',{startedAt:'2026-08-03',doneAt:'2026-08-05',date:'2026-08-05',text:'TEST_DONE'});
   const a=hjWarrantyContext('TEST_APARTMENT','unit-a'),b=hjWarrantyContext('TEST_APARTMENT','unit-b');
   const original=structuredClone(a);
   await hjUnitLifecycleSave('TEST_APARTMENT','unit-a',{startedAt:'2026-08-03',doneAt:'2026-08-06',date:'2026-08-07',text:'TEST_REVISIT'});
   const preserved=hjWarrantyContext('TEST_APARTMENT','unit-a',original),p=aptUnitProject('TEST_APARTMENT');
   const frozenOptions={unitId:'unit-a',warrantyContext:original};
   const documentText=new DOMParser().parseFromString(warrantyHTML(p.name,frozenOptions),'text/html').body.textContent;
   const link=hjWarrantyLinkBody(p.name,frozenOptions);
   const frozenOutputs=documentText.includes(hjDocDate('2026-08-05'))&&documentText.includes(hjDocDate('2029-08-05'))&&link.doneAt===hjDocDate('2026-08-05');
   let rejected=0;for(const input of [{doneAt:'2026-02-30'},{startedAt:'2026-08-09',doneAt:'2026-08-08'},{doneAt:'2099-01-01'}]){try{await hjUnitLifecycleSave(p.name,'unit-a',input);}catch(_){rejected++;}}
   const fp=hjCostSource(p.name),input={status:{material:'confirmed',labor:'none',outsource:'none',etc:'none'},reviewer:'TEST_REVIEWER',memo:'',close:true};
   await hjCostReviewSave(p.name,input,fp);const closed=hjCostReviewStatus(p.name);
   state.expenses.push({id:'test-exp',project:p.name,amount:10,category:'자재',date:'2026-08-07'});const changed=hjCostReviewStatus(p.name);
   await hjCostReviewSave(p.name,input,hjCostSource(p.name));
   state.expenses[0].category='외주';const sameAmountChanged=hjCostReviewStatus(p.name);
   let wrongNone=false;try{await hjCostReviewSave(p.name,{...input,status:{...input.status,material:'none'}},hjCostSource(p.name));}catch(_){wrongNone=true;}
   const before=paidStableJson({...serializeData(),savedAt:''});const originalSnapshot=hjSnapshot;hjSnapshot=async()=>false;let stopped=false;try{await hjUnitLifecycleSave(p.name,'unit-a',{doneAt:'2026-08-08'});}catch(_){stopped=true;}hjSnapshot=originalSnapshot;
   return {a:a.doneAt,b:b.doneAt,preserved:preserved.doneAt,parent:p.doneAt,end:a.warranty.end,rejected,closed,changed,sameAmountChanged,frozenOutputs,wrongNone,stopped,unchanged:before===paidStableJson({...serializeData(),savedAt:''}),roundtrip:serializeData().projects[0].aptUnits[0].lifecycle.history.length};
  });
  assert.equal(r.a,'2026-08-05');assert.equal(r.b,'2026-08-01');assert.equal(r.preserved,'2026-08-05');assert.equal(r.parent,'2026-08-01');assert.equal(r.end,'2029-08-05');assert.equal(r.rejected,3);assert.match(r.closed,/기준 마감/);assert.match(r.changed,/재검토/);assert(r.wrongNone&&r.stopped&&r.unchanged);assert.equal(r.roundtrip,2);
  assert(r.frozenOutputs,'HTML and link use the same frozen unit period');assert.match(r.sameAmountChanged,/재검토/,'equal total with recategorization is stale');
  await page.evaluate(()=>hjUnitLifecycleView('TEST_APARTMENT','unit-a'));assert(await page.locator('#lifeDone').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.evaluate(()=>hjCostReviewView('TEST_APARTMENT'));assert(await page.locator('#costReview').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.evaluate(()=>new DOMParser().parseFromString(dashboardTodoHTML(),'text/html').querySelector('#dashboardCompanyTeam').getAttribute('href')),'./team.html');
  await context.close();console.log('PASS operations-review: unit isolation/date/history, frozen warranty, stale costs, validation, snapshot fail, serialization, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

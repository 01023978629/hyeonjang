'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ORIGIN='http://127.0.0.1:8299',API='https://script.google.com/macros/s/TEST_COMPANY_STATUS/exec';
const mutant=process.env.HJ_CONNECTION_MUTATION||'';
const pairs={
 snapshot:["if(!p.companyProjectKey)await durableLocalMutation(","if(false)await durableLocalMutation("],
 stale:["if(!current())return;",''],
 notes:["name:u.name}))", "name:u.name,note:u.note}))"]
};
let browser,count=0;
async function run(){
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
 const context=await browser.newContext({viewport:{width:360,height:800},serviceWorkers:'block'}),page=await context.newPage();
 let healthCalls=0,hold=null,old=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url===API){assert.deepEqual(JSON.parse(r.request().postData()),{action:'health'});healthCalls++;if(hold)await hold.promise;return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,service:'company-team-v3',portalUrl:API.replace('STATUS','AUTH'),...(old?{}:{capabilities:['project-units-v1','task-ack-v1']})})});}
  if(url.startsWith(ORIGIN+'/')){
   if(mutant&&url.endsWith('/operations-review.js')){let text=fs.readFileSync(path.join(__dirname,'..','operations-review.js'),'utf8');const [a,b]=pairs[mutant]||[];assert(a&&text.includes(a),'mutation anchor missing');return r.fulfill({contentType:'application/javascript',body:text.replace(a,b)});}
   return r.continue();
  }return r.abort();
 });
 await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
 await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof hjOperationsCenter==='function'&&window.__hjRelayBootDone);
 await page.evaluate(async api=>{
  await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;backupBootCheck=()=>0;kakaoCheckNew=()=>0;
  clearTimeout(__idbSaveTimer);await __appStateWriteQueue;state.projects=[{name:'TEST_APARTMENT',stage:2,received:0,cost:{},phases:[],customer:{name:'TEST_PRIVATE_CLIENT'},aptUnits:[{id:'u1',type:'unit',dong:'101',ho:'501',name:'',note:'TEST_PRIVATE_UNIT_NOTE'}]}];
  state.files=[];state.schedule=[];state.notes=[];state.aptOrders=[];state.payLog=[];state.quotes=[];state.expenses=[];state.dirHandle=null;state._demo=false;__tabStale=false;__relay.url='';__relay.token='TEST_PRIVATE_TOKEN';__gdToken=null;localStorage.setItem('hj_team_api_url',api);
  await guardedPersistCurrentState();render();window.__opsBaseline=paidStableJson({...serializeData(),savedAt:''});
 },API);
 await page.evaluate(()=>hjOperationsCenter());assert.equal(healthCalls,0);assert.match(await page.textContent('#operationsConnections'),/응답 확인 전/);
 // Read-only summary must not write a snapshot, log in or verify originals implicitly.
 assert.equal(await page.evaluate(()=>paidStableJson({...serializeData(),savedAt:''})===__opsBaseline),true);assert.doesNotMatch(await page.textContent('#operationsConnections'),/TEST_PRIVATE_TOKEN|TEST_PRIVATE_UNIT_NOTE|TEST_PRIVATE_CLIENT/);count++;console.log('PASS read-only summary and no secret/source mutation');
 await page.click('#opsHealthCheck');await page.waitForFunction(()=>document.getElementById('opsTeamHealth').textContent.includes('API 지원'));assert.equal(healthCalls,1);count++;console.log('PASS explicit health only, capabilities distinguished from login');
 old=true;await page.click('#opsHealthCheck');await page.waitForFunction(()=>document.getElementById('opsTeamHealth').textContent.includes('업데이트 필요'));assert.equal(healthCalls,2);count++;console.log('PASS old server is not misreported ready');
 old=false;hold={};hold.promise=new Promise(r=>hold.release=r);await page.click('#opsHealthCheck');await page.waitForFunction(()=>document.getElementById('opsTeamHealth').textContent.includes('확인 중'));await page.evaluate(api=>localStorage.setItem('hj_team_api_url',api.replace('STATUS','CHANGED')),API);hold.release();await page.waitForFunction(()=>document.getElementById('opsTeamHealth').dataset.checking==='false');assert.equal(await page.evaluate(()=>__hjOperationsCheck===null||!__hjOperationsCheck.text.includes('API 지원')),true);hold=null;await page.evaluate(api=>localStorage.setItem('hj_team_api_url',api),API);count++;console.log('PASS stale endpoint response discarded');
 const result=await page.evaluate(async api=>{
  const before=paidStableJson({...serializeData(),savedAt:''}),snapshot=hjSnapshot;hjSnapshot=async()=>false;let stopped=false;try{await hjCompanyProjectPacket('TEST_APARTMENT',api);}catch(_){stopped=true;}hjSnapshot=snapshot;
  const unchanged=before===paidStableJson({...serializeData(),savedAt:''});const keys=Object.keys(serializeData()).sort();const packet=await hjCompanyProjectPacket('TEST_APARTMENT',api);
  const again=await hjCompanyProjectPacket('TEST_APARTMENT',api);let duplicate=false;const copy=structuredClone(state.projects[0]);copy.name='TEST_DUPLICATE';state.projects.push(copy);try{await hjCompanyProjectPacket('TEST_DUPLICATE',api);}catch(_){duplicate=true;}state.projects.pop();
  return {stopped,unchanged,packet,again,persisted:serializeData().projects[0].companyProjectKey,keysSame:JSON.stringify(keys)===JSON.stringify(Object.keys(serializeData()).sort()),duplicate};
 },API);
 assert(result.stopped&&result.unchanged&&result.keysSame&&result.duplicate);assert.equal(result.packet.sourceKey,result.persisted);assert.equal(result.again.sourceKey,result.persisted);assert.doesNotMatch(JSON.stringify(result.packet),/TEST_PRIVATE_CLIENT|TEST_PRIVATE_UNIT_NOTE|note|customer/);count++;console.log('PASS snapshot, durable identity, duplicate key guard, no notes/customer/photos');
 page.once('dialog',d=>d.accept());await page.selectOption('#opsProject','0');await page.click('#opsProjectExport');await page.waitForFunction(()=>!document.getElementById('opsLinkDownload').disabled);assert.deepEqual(JSON.parse(await page.inputValue('#opsLinkJson')),result.packet);assert.match(await page.textContent('#opsExportStatus'),/아직 등록하지/);await page.selectOption('#opsProject','');assert.equal(await page.inputValue('#opsLinkJson'),'');assert(await page.isDisabled('#opsLinkDownload'));count++;console.log('PASS explicit export screen, confirmation, stale output cleared');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof hjOperationsCenter==='function'&&window.__hjRestoreDone);await page.evaluate(async()=>{await __hjRestoreDone;});assert.equal(await page.evaluate(()=>state.projects[0].companyProjectKey),result.persisted);count++;console.log('PASS stable project key survives IDB reload');
 for(const width of [320,360,1280]){await page.setViewportSize({width,height:800});await page.evaluate(()=>{if(typeof closeModal==='function')closeModal(true);hjOperationsCenter();});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert((await page.locator('#opsProjectExport').boundingBox()).height>=44);}
 count++;console.log('PASS 320/360/1280 responsive controls');assert.deepEqual(errors,[]);await context.close();await browser.close();console.log('operations-connections: '+count+'/'+count+' PASS');
}
run().catch(async e=>{console.error('FAIL operations-connections:',e.stack);if(browser)await browser.close();process.exitCode=1;});

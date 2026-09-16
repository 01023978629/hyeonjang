'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const {createSharedTodoMock,URL:MOCK,TOKEN}=require('./shared-todo-mock');
const ORIGIN=process.env.HJ_SHARED_BACKUP_ORIGIN||'http://127.0.0.1:8299';
const mutation=process.env.HJ_SHARED_BACKUP_MUTATION||'';
assert(['','confirm','pending','photo','backup-routing'].includes(mutation));
let source=fs.readFileSync(path.join(__dirname,'../shared-todo-backup.js'),'utf8');
if(mutation==='confirm')source=source.replaceAll('if(!confirm(', 'if(false&&confirm(');
if(mutation==='pending')source=source.replace('await hjSharedTodoPendingSwap(s.key,null,op);','/* MUTATION no durable reservation */');
if(mutation==='photo')source=source.replaceAll('if(photoIntakePending()||__modalCloseLocked)', 'if(false)');
async function until(fn,label){const limit=Date.now()+10000;while(Date.now()<limit){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,30));}throw new Error('Timeout: '+label);}
const uiState=(page,kind)=>page.waitForFunction(kind=>document.getElementById('stbStatus')?.dataset.state===kind,kind);
const row=(page,id)=>page.locator('[data-stb-restore="'+id+'"]');
(async()=>{
  const mock=createSharedTodoMock(),errors=[],dialogs=[];
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||process.env.PLAYWRIGHT_EXECUTABLE_PATH||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  const context=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const url=route.request().url();if(url===MOCK)return mock.handle(route);
    if(mutation==='backup-routing'&&url===ORIGIN+'/index.html'){
      const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),anchor="if(pending.schema===2&&pending.source==='backup'";
      assert(html.includes(anchor),'backup-routing mutation anchor exists');
      return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html.replace(anchor,"if(false&&pending.schema===2&&pending.source==='backup'")});
    }
    if(new URL(url).origin===ORIGIN)return route.continue();return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',error=>errors.push(String(error)));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  async function boot(){
    await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
    await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
    await page.evaluate(({url,token})=>{
      __relay={url,token,device:'test-backup-ui',rev:73,syncAt:'TEST-STABLE'};
      state.projects=[{name:'가상 공유 현장',stage:2,cost:{material:0,labor:0,outsource:0}}];state.files=[];state.notes=[{id:'TEST-NOTE',text:'가상 개인 할일 보존',todo:true}];state.quotes=[];state.expenses=[];state.aptOrders=[];state.schedule=[];state.activeProject='가상 공유 현장';state.dirty=false;
      taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};officeIntakeSync=async()=>false;
      __mobileMode=true;applyMobileMode();render();clearTimeout(__idbSaveTimer);closeModal(true);
    },{url:MOCK,token:TOKEN});
    await page.addScriptTag({content:source});
  }
  async function open(){await page.evaluate(()=>window.hjSharedTodoBackupView());await uiState(page,'ready');}
  async function pending(){return page.evaluate(async()=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([__relay.url,__relay.token,__relay.device])));const key='shared_todo_pending:v1:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');return {key,op:await idbGetStrict(key)};});}
  try{
    await boot();const task=mock.create('가상 공유 현장','가상 백업 시점 할일');
    const baseline=await page.evaluate(()=>({notes:JSON.stringify(state.notes),files:JSON.stringify(state.files),revision:__relay.rev,sync:__relay.syncAt}));
    await open();assert.equal(mock.count('sharedTodoBackupCreate')+mock.count('sharedTodoRestore'),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const bounds of await page.locator('#sharedTodoBackupView button:visible').evaluateAll(buttons=>buttons.map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))))assert(bounds.width>=43.5&&bounds.height>=43.5);
    console.log('PASS backup UI 1: read-only listing and 360px controls');

    await page.locator('#stbCreate').click();await uiState(page,'complete');
    assert.equal(dialogs.length,1);assert.match(dialogs[0],/공유 할일.*백업/);
    const manualCall=mock.calls.find(call=>call.action==='sharedTodoBackupCreate');assert(manualCall);assert.equal(manualCall.payload.expectedStoreRevision,1);
    const backupId='r1_manual_'+manualCall.payload.requestId+'.json';await row(page,backupId).waitFor();
    assert.equal(mock.revision(),1);assert.equal((await pending()).op,null);
    console.log('PASS backup UI 2: manual snapshot confirmation and exact acknowledgment');

    mock.update(mock.tasks.get(task.id),{text:'가상 이후 수정'});mock.create('가상 다른 현장','가상 추가 할일');
    await page.locator('#stbRefresh').click();await uiState(page,'ready');const beforeConfirm=dialogs.length;
    await row(page,backupId).click();await uiState(page,'complete');
    assert.equal(dialogs.length-beforeConfirm,2,'full-list restore needs two explicit confirmations');assert(dialogs.slice(-2).every(message=>/모든 현장|전체 공유/.test(message)));
    assert.equal(mock.active().length,1);assert.equal(mock.active()[0].text,'가상 백업 시점 할일');assert.notEqual(mock.active()[0].id,task.id);
    assert.deepEqual(await page.evaluate(()=>({notes:JSON.stringify(state.notes),files:JSON.stringify(state.files),revision:__relay.rev,sync:__relay.syncAt})),baseline);
    console.log('PASS backup UI 3: confirmed full-list restore preserves unrelated browser data');

    mock.inject('test-backup-ui','sharedTodoRestore','lost-ack');await row(page,backupId).click();await uiState(page,'pending');
    const frozen=await pending();assert(frozen.op,'uncertain mutation must retain the durable request');assert.equal(frozen.op.action,'sharedTodoRestore');assert(!JSON.stringify(frozen.op).includes(TOKEN));assert(!JSON.stringify(frozen.op).includes(MOCK));
    const restoredRevision=mock.revision(),requestId=frozen.op.payload.requestId;
    await boot();await page.evaluate(()=>hjSharedTodoView());
    await page.waitForFunction(()=>['pending','error'].includes(document.getElementById('stStatus')?.dataset.state));
    assert.equal(await page.locator('#stStatus').getAttribute('data-state'),'pending','backup pending is recoverable rather than local storage corruption');
    const pendingNotice=await page.locator('#stStatus').innerText();
    assert.match(pendingNotice,/백업·복원.*확인 대기/,'normal shared view explains the backup request');
    assert.match(pendingNotice,/같은 요청 결과/);assert.doesNotMatch(pendingNotice,/저장 공간|확인하지 못했습니다/,'valid backup requests are not mislabeled as corrupt local storage');
    assert(await page.locator('#stSave').isDisabled(),'normal task writes stay blocked by the backup reservation');
    assert(await page.locator('#stBackup').isEnabled(),'backup recovery remains reachable');
    assert(await page.locator('#stRetry').isHidden(),'normal task retry cannot send the backup payload');
    const normalWrites=mock.count('sharedTodoSave'),reads=mock.count('sharedTodoList');
    await page.locator('#stRefresh').click();
    assert.match(await page.locator('#stStatus').innerText(),/백업·복원.*확인 대기/,'manual refresh must retain the backup guidance');
    assert.equal(mock.count('sharedTodoList'),reads,'backup-pending refresh does not overwrite its notice with a normal list response');
    await page.evaluate(()=>document.getElementById('stSave').click());
    assert.equal(mock.count('sharedTodoSave'),normalWrites,'normal view must not submit while backup result is pending');
    assert.deepEqual((await pending()).op,frozen.op,'visiting and refreshing normal view preserves the frozen backup request');
    await page.locator('#stBackup').click();await page.locator('#stbRetry').waitFor();
    console.log('PASS backup UI 11: normal shared view identifies backup pending and routes safely to recovery');
    await until(()=>page.locator('#stbRetry').isEnabled(),'pending retry initialized');
    await page.locator('#stbRetry').click();await uiState(page,'complete');assert.equal(mock.revision(),restoredRevision);assert.equal((await pending()).op,null);
    const attempts=mock.calls.filter(call=>call.action==='sharedTodoRestore'&&call.payload.requestId===requestId);assert.equal(attempts.length,2);assert.deepEqual(attempts[0].payload,attempts[1].payload);
    console.log('PASS backup UI 4: reload after lost acknowledgment retries the frozen request');

    const oldRevision=mock.revision();mock.create('가상 다른 직원','가상 동시 입력');const count=mock.active().length;
    await row(page,backupId).click();await uiState(page,'conflict');assert.equal(mock.active().length,count);assert.equal(mock.revision(),oldRevision+1);assert.equal((await pending()).op,null);
    console.log('PASS backup UI 5: a concurrent employee write stops stale restore');

    await page.locator('#stbRefresh').click();await uiState(page,'ready');
    const slot=await pending(),other={schema:1,source:'editor',action:'sharedTodoSave',payload:{requestId:'00000000-0000-4000-a000-000000009999',expectedRevision:0,task:{id:'00000000-0000-4000-a000-000000008888',project:'가상 현장',text:'가상 다른 탭 대기',done:false}}};
    await page.evaluate(async({key,op})=>hjSharedTodoPendingSwap(key,null,op),{key:slot.key,op:other});
    const beforeWrites=mock.count('sharedTodoRestore');await row(page,backupId).click();await uiState(page,'error');assert.equal(mock.count('sharedTodoRestore'),beforeWrites,'atomic pending slot must block another tab before network');assert.deepEqual((await pending()).op,other);
    await page.evaluate(async({key,op})=>hjSharedTodoPendingSwap(key,op,null),{key:slot.key,op:other});
    console.log('PASS backup UI 6: another tab pending request wins atomic reservation');

    await page.evaluate(()=>{closeModal(true);__photoIntakeBusy=true;});
    assert.equal(await page.evaluate(()=>hjSharedTodoBackupView()),false,'photo intake must not be replaced');assert.equal(await page.locator('#sharedTodoBackupView').count(),0);
    await page.evaluate(()=>{__photoIntakeBusy=false;__modalCloseLocked=true;});assert.equal(await page.evaluate(()=>hjSharedTodoBackupView()),false);
    await page.evaluate(()=>{__modalCloseLocked=false;});await open();
    console.log('PASS backup UI 7: photo intake and modal locks remain protected');

    mock.inject('test-backup-ui','sharedTodoBackupCreate','hold');await page.locator('#stbCreate').click();
    await until(()=>mock.holds.some(hold=>hold.action==='sharedTodoBackupCreate'&&!hold.done),'held acknowledgment');
    assert.equal(await page.evaluate(()=>closeModal()),false);assert.equal(await page.locator('#sharedTodoBackupView').count(),1);
    mock.releaseAll();await uiState(page,'complete');
    console.log('PASS backup UI 8: close is locked until mutation acknowledgment');

    await page.evaluate(()=>{window.__stbSwap=hjSharedTodoPendingSwap;hjSharedTodoPendingSwap=async()=>{throw new Error('TEST storage unavailable');};});
    const beforeCreate=mock.count('sharedTodoBackupCreate');await page.locator('#stbCreate').click();await uiState(page,'error');assert.equal(mock.count('sharedTodoBackupCreate'),beforeCreate);
    await page.evaluate(()=>{hjSharedTodoPendingSwap=window.__stbSwap;});
    console.log('PASS backup UI 9: unavailable durable storage blocks network mutation');

    mock.inject('test-backup-ui','sharedTodoBackupList','hold');await page.locator('#stbRefresh').click();
    await until(()=>mock.holds.some(hold=>hold.action==='sharedTodoBackupList'&&!hold.done),'held list response');
    await page.evaluate(()=>{__relay.token='TEST-DIFFERENT-CONNECTION';});mock.releaseAll();await uiState(page,'error');
    assert(await page.locator('#stbCreate').isDisabled());assert(await row(page,backupId).isDisabled());
    const beforeChange=mock.count('sharedTodoRestore');await page.evaluate(()=>document.querySelector('[data-stb-restore]').click());assert.equal(mock.count('sharedTodoRestore'),beforeChange);
    assert.deepEqual(errors,[]);console.log('PASS backup UI 10: changed connection rejects late response and further writes');
  }finally{mock.releaseAll();await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

/* Two independently stored employee browsers share only a synthetic server.
   HJ_SHARED_TODO_MUTATION=revision|retry-id must fail its guarded assertion.
   HJ_SHARED_TODO_SHOTS=<folder> captures optional simulated mobile screens. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const {createSharedTodoMock,URL:MOCK,TOKEN}=require('./shared-todo-mock');
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_SHARED_TODO_MUTATION||'';
assert(['','revision','retry-id'].includes(mutation));
const shots=process.env.HJ_SHARED_TODO_SHOTS;
const PROJECT='모의 공동주택 오늘 작업 101동';
const OTHER='모의 다른 아파트 102동';
const NAV='[data-mnav="__todo"]';
const row=(page,id)=>page.locator('#stList [data-st-id="'+id+'"]');
async function waitUntil(fn,label){const started=Date.now();while(Date.now()-started<9000){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,30));}throw new Error('Timed out: '+label);}
async function status(page,value){await page.waitForFunction(value=>document.getElementById('stStatus')?.dataset.state===value,value);}
async function closed(page){await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet));}
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function snapshot(page){return page.evaluate(()=>({serialized:JSON.stringify({...serializeData(),savedAt:'TEST-STABLE'}),notes:JSON.stringify(state.notes),projects:JSON.stringify(state.projects),relayRevision:__relay.rev,relaySyncAt:__relay.syncAt}));}
/* Snapshot equality that says WHICH field moved.
   assert.deepEqual on these objects prints two ~10KB serialized blobs side by side,
   so a rare failure tells you that something changed and nothing about what. This
   compares field by field, and for the serialized blob names the top-level key that
   differs, so one CI log is enough to diagnose it. Strictness is identical: every
   field of the baseline must still match exactly. */
function sameSnapshot(actual,baseline,label){
  for(const key of Object.keys(baseline)){
    if(actual[key]===baseline[key])continue;
    let detail=key;
    if(key==='serialized'){
      let a={},b={};
      try{a=JSON.parse(actual[key]);b=JSON.parse(baseline[key]);}catch(_){}
      const moved=[...new Set([...Object.keys(a),...Object.keys(b)])]
        .filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
      detail='serialized.'+(moved.length?moved.join(','):'(unparseable)');
    }
    assert.fail(label+' — changed: '+detail+'\n  baseline: '+String(baseline[key]).slice(0,600)+
      '\n  actual:   '+String(actual[key]).slice(0,600));
  }
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(baseline).sort(),label+' — snapshot shape changed');
}
async function refresh(page){await page.locator('#stRefresh').click();await status(page,'ready');}
async function add(page,mock,project,text){
  await page.locator('#stFilter').selectOption('');
  await page.locator('#stProject').selectOption(project);await page.locator('#stText').fill(text);
  await page.locator('#stSave').click();
  await waitUntil(()=>mock.active().some(x=>x.project===project&&x.text===text),'server create acknowledged');
  const task=mock.active().find(x=>x.project===project&&x.text===text);
  await status(page,'ready');await row(page,task.id).waitFor();return task;
}
async function saveEdit(page,text){await page.locator('#stText').fill(text);await page.locator('#stSave').click();await status(page,'ready');}
async function capture(page,name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,name+'.png'),fullPage:false});}}
async function mobileBounds(page){
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'shared todo must not create horizontal page overflow');
  const results=await page.locator('#sharedTodoView button,#sharedTodoView input,#sharedTodoView select,#sharedTodoView textarea').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length&&!e.hidden).map(e=>{
    const rect=e.getBoundingClientRect(),target=e.type==='checkbox'&&e.closest('label')?e.closest('label').getBoundingClientRect():rect;
    return{id:e.id||e.dataset.stId||e.tagName,type:e.type,width:target.width,height:target.height,left:rect.left,right:rect.right,font:parseFloat(getComputedStyle(e).fontSize)};
  }));
  for(const result of results){assert(result.width>=43.5&&result.height>=43.5,'44px touch target: '+JSON.stringify(result));assert(result.left>=-1&&result.right<=await page.evaluate(()=>innerWidth)+1,'control stays inside viewport: '+JSON.stringify(result));if(result.type==='text'||result.type==='textarea')assert(result.font>=16,'mobile text input avoids automatic zoom');}
}
(async()=>{
  const mock=createSharedTodoMock(),errors=[],effects=[],contexts=[];
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  async function openDevice(device,width=360,configured=true,existingContext){
    const context=existingContext||await browser.newContext({viewport:{width,height:780},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Seoul'});if(!existingContext)contexts.push(context);
    if(!existingContext)await context.route('**/*',async route=>{
      const url=route.request().url();
      if(url===MOCK)return mock.handle(route);
      if(new URL(url).origin===ORIGIN)return route.continue();
      return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(9000);
    page.on('pageerror',error=>errors.push(device+': '+String(error)));
    page.on('popup',()=>effects.push('popup'));page.on('download',()=>effects.push('download'));
    page.on('dialog',dialog=>dialog.accept());
    await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
    async function boot(){
      await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
      /* __hjRelayBootDone must be awaited, not just __hjRelayConfigDone. relayBoot() keeps
         running after it publishes its config result: it flushes the queue and asks the
         server for health. This test hands the page a live relay token right after boot,
         so if that tail is still in flight it reaches the stubbed relayCall and reports a
         "legacy relay" side effect that no shared-work action caused. That was the rare
         parallel-load failure here; on a loaded machine the gap widens and it is reliable. */
      await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjRelayBootDone,__hjOfficeOpsBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
      await page.evaluate(({device,configured,mock,token,project,other,mutation})=>{
        state.projects=[project,other].map(name=>({name,stage:2,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{}}));
        state.activeProject=project;state.files=[];state.schedule=[];state.quotes=[];state.expenses=[];state.payLog=[];state.aptOrders=[];
        state.notes=[{id:'TEST-LOCAL-MEMO',date:'2026-09-13',text:'TEST preserved non-task memo',project},
          {id:'TEST-LOCAL-TODO',date:'2026-09-13',day:'2026-09-13',text:'TEST preserved local task',project,todo:true,done:false}];
        state.tab='photos';state.search='';state.dirHandle=null;state._demo=false;state.dirty=false;state.editingQuote=null;
        __relay={url:mock,token:configured?token:'',device,rev:73,syncAt:'TEST-SYNC-UNCHANGED'};
        __mobileMode=true;applyMobileMode();__gdToken=null;aiOpsEnsureState().enabled=false;
        // Isolate this feature from unrelated delayed startup seeders and online-event inbox sync.
        // Their own regression files cover them; they would otherwise change the baseline at 4s.
        taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};
        officeIntakeSync=async()=>false;
        window.__sharedTodoUnexpected=[];
        const reject=name=>()=>{__sharedTodoUnexpected.push(name);throw new Error('Unexpected unrelated action: '+name);};
        relayCall=reject('legacy relay');geminiAsk=reject('AI');window.open=reject('popup');window.showOpenFilePicker=reject('file picker');window.showDirectoryPicker=reject('directory picker');
        render();syncMobileNav();clearTimeout(__idbSaveTimer);document.getElementById('toast').classList.remove('show');
        if(mutation&&device==='test-a'){
          const fetchOriginal=window.fetch.bind(window),seen=new Set();
          window.fetch=function(input,init){
            if(String(input)===mock&&init?.body){
              const envelope=JSON.parse(init.body);
              if(envelope.action==='sharedTodoSave'){
                if(mutation==='revision')delete envelope.payload.expectedRevision;
                if(mutation==='retry-id'&&seen.has(envelope.payload.requestId))envelope.payload.requestId=crypto.randomUUID();
                else seen.add(envelope.payload.requestId);
                init={...init,body:JSON.stringify(envelope)};
              }
            }
            return fetchOriginal(input,init);
          };
        }
      },{device,configured,mock:MOCK,token:TOKEN,project:PROJECT,other:OTHER,mutation});
      await settle(page);await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
    }
    await boot();return{page,context,boot,device};
  }
  try{
    const A=await openDevice('test-a',360),B=await openDevice('test-b',320);
    const a=A.page,b=B.page,baselineA=await snapshot(a),baselineB=await snapshot(b);
    await a.locator(NAV).click();await status(a,'ready');
    await b.locator(NAV).click();await status(b,'ready');
    assert.equal(await a.locator('#sharedTodoView').count(),1,'connected bottom action opens shared work');
    assert.equal(await a.locator('#stProject').inputValue(),PROJECT,'active project starts selected');
    await a.locator('#stProject').selectOption('');await a.locator('#stText').fill('TEST missing project cannot submit');
    const missingCount=mock.count('sharedTodoSave');
    await a.locator('#stSave').click();
    assert.equal(mock.count('sharedTodoSave'),missingCount,'project selection is mandatory before any server write');
    await a.locator('#stProject').selectOption(PROJECT);await a.locator('#stText').fill('TEST employee A first task');
    await a.locator('#stSave').click();
    await waitUntil(()=>mock.count('sharedTodoSave')===1,'first create request observed');
    assert.equal(mock.calls.find(x=>x.action==='sharedTodoSave').payload.expectedRevision,0,'new task forwards expectedRevision 0');
    await status(a,'ready');
    const first=mock.active().find(x=>x.text==='TEST employee A first task');assert(first);
    await row(a,first.id).waitFor();
    assert.equal(await row(b,first.id).count(),0,'independent employee cache changes only after its own refresh');
    await refresh(b);assert.match(await row(b,first.id).innerText(),/TEST employee A first task/);
    assert.equal(await b.evaluate(()=>state.notes.some(x=>x.text==='TEST employee A first task')),false,'shared rows are never merged into whole-data notes');
    console.log('PASS shared todo 1: project-required creation and second employee refresh');

    // B starts editing revision 1; another employee changes it and creates unrelated work.
    await row(b,first.id).locator('[data-st-edit]').click();await b.locator('#stText').fill('TEST employee B stale draft preserved');
    await row(a,first.id).locator('[data-st-edit]').click();await saveEdit(a,'TEST employee A revision two');
    const unrelated=await add(a,mock,OTHER,'TEST separate project remains intact');
    await b.locator('#stSave').click();await status(b,'conflict');
    assert.equal(await b.locator('#stText').inputValue(),'TEST employee B stale draft preserved','conflict preserves user input');
    assert.equal(mock.tasks.get(first.id).text,'TEST employee A revision two','stale employee cannot overwrite newer work');
    assert.equal(mock.tasks.get(unrelated.id).text,'TEST separate project remains intact','same-task conflict cannot replace other project rows');
    const stale=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-b').at(-1);
    assert.equal(stale.payload.expectedRevision,1,'editing freezes the revision actually shown when edit began');
    await b.locator('#stCancelEdit').click();await refresh(b);
    await b.locator('#stFilter').selectOption('');
    assert.equal(await b.locator('#stList [data-st-id]').count(),2,'all-project filter includes both employees work');
    await b.locator('#stFilter').selectOption(OTHER);assert.equal(await b.locator('#stList [data-st-id]').count(),1);
    assert.equal(await row(b,unrelated.id).count(),1,'project filter displays only the selected project');
    await b.locator('#stFilter').selectOption('');
    console.log('PASS shared todo 2: stale edit rejected, input preserved, other project preserved');

    await row(b,first.id).locator('[data-st-done]').click();await status(b,'ready');
    assert.equal(mock.tasks.get(first.id).done,true,'completion is acknowledged by the server');
    await refresh(a);await a.locator('#stFilter').selectOption('');assert.equal(await row(a,first.id).locator('[data-st-done]').isChecked(),true);
    await row(a,first.id).locator('[data-st-done]').click();await status(a,'ready');
    await row(a,unrelated.id).locator('[data-st-delete]').click();await status(a,'ready');
    assert(mock.tasks.get(unrelated.id).deleted,'delete receives a tombstone rather than replacing the whole store');
    assert.equal(await row(a,unrelated.id).count(),0,'acknowledged deletion removes only its row');
    await refresh(b);assert.equal(await row(b,unrelated.id).count(),0,'another employee observes acknowledged deletion');
    assert.equal(await row(b,first.id).locator('[data-st-done]').isChecked(),false);
    await mobileBounds(a);await mobileBounds(b);await capture(a,'shared-work-360');await capture(b,'shared-work-320');
    console.log('PASS shared todo 3: completion, undo, deletion and mobile 320/360 layout');

    mock.inject('test-a','sharedTodoSave','lost-ack');
    await a.locator('#stProject').selectOption(PROJECT);await a.locator('#stText').fill('TEST uncertain acknowledgement once only');
    await a.locator('#stSave').click();await status(a,'pending');
    const uncertain=mock.calls.filter(x=>x.action==='sharedTodoSave').at(-1),onceRevision=mock.revision();
    assert.equal(mock.active().filter(x=>x.text==='TEST uncertain acknowledgement once only').length,1,'lost acknowledgement may already have reached the server');
    assert.equal(await row(a,uncertain.payload.task.id).count(),0,'unacknowledged creation is not rendered as successfully shared');
    assert.match(await a.locator('#stStatus').innerText(),/확인|재시도|대기|전송|네트워크/);
    await a.locator('#stRetry').click();
    await waitUntil(()=>mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.payload.task?.id===uncertain.payload.task.id).length===2,'explicit retry request observed');
    const retry=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.payload.task?.id===uncertain.payload.task.id).at(-1);
    assert.deepEqual(retry.payload,uncertain.payload,'retry reuses the exact persisted requestId and request payload');
    await status(a,'ready');assert.equal(mock.revision(),onceRevision,'idempotent retry never performs the mutation twice');
    assert.equal(mock.active().filter(x=>x.text==='TEST uncertain acknowledgement once only').length,1);
    await row(a,uncertain.payload.task.id).waitFor();
    console.log('PASS shared todo 4: lost acknowledgement replay uses identical request exactly once');

    // A real reload proves pending operations live in scoped durable storage, not only a closure.
    mock.inject('test-b','sharedTodoSave','lost-ack');
    await b.locator('#stProject').selectOption(OTHER);await b.locator('#stText').fill('TEST reload-persisted pending task');
    await b.locator('#stSave').click();await status(b,'pending');
    const persisted=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-b').at(-1);
    await B.boot();await b.locator(NAV).click();await status(b,'pending');
    await b.locator('#stRetry').click();await status(b,'ready');
    const replay=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-b').at(-1);
    assert.deepEqual(replay.payload,persisted.payload,'reload retains the exact durable operation');
    assert.equal(mock.active().filter(x=>x.text==='TEST reload-persisted pending task').length,1);
    console.log('PASS shared todo 5: reload recovers durable pending write without duplicate');

    await refresh(a);const visibleBefore=await a.locator('#stList').innerText();
    mock.inject('test-a','sharedTodoList','auth');await a.locator('#stRefresh').click();await status(a,'error');
    assert.equal(await a.locator('#stList').innerText(),visibleBefore,'authentication failure preserves the last acknowledged list');
    assert.match(await a.locator('#stStatus').innerText(),/인증|권한|토큰|연결/);
    await refresh(a);
    mock.inject('test-a','sharedTodoList','malformed');await a.locator('#stRefresh').click();await status(a,'error');
    assert.equal(await a.locator('#stList').innerText(),visibleBefore,'invalid JSON cannot become an empty successful list');
    await refresh(a);
    // Browser routes intentionally bypass transport; abort the synthetic transport as well.
    await A.context.setOffline(true);mock.inject('test-a','sharedTodoList','network');await a.locator('#stRefresh').click();await status(a,'error');
    assert.equal(await a.locator('#stList').innerText(),visibleBefore,'offline cannot become an empty successful list');
    assert.match(await a.locator('#stStatus').innerText(),/오프라인|연결|네트워크|확인/);
    await A.context.setOffline(false);await refresh(a);
    console.log('PASS shared todo 6: auth, invalid response and offline are explicit failures, not empty success');

    await a.keyboard.press('Escape');await closed(a);
    assert.equal(await a.evaluate(()=>document.activeElement?.dataset.mnav),'__todo','closing restores bottom action focus');
    await a.locator(NAV).click();await status(a,'ready');
    mock.inject('test-a','sharedTodoList','hold');await a.evaluate(()=>{hjSharedTodoRefresh();});
    await waitUntil(()=>mock.holds.some(x=>x.device==='test-a'&&!x.done),'late response held');
    await a.keyboard.press('Escape');await closed(a);mock.releaseAll();
    await waitUntil(()=>mock.holds.every(x=>x.done),'closed modal response settled');
    assert.equal(await a.locator('#sharedTodoView').count(),0,'late response cannot reopen a dismissed screen');
    assert.equal(await a.evaluate(()=>document.activeElement?.dataset.mnav),'__todo','late response cannot steal restored focus');
    await a.locator(NAV).click();await status(a,'ready');
    const changed=mock.create(PROJECT,'TEST old connection late result must be ignored');
    mock.inject('test-a','sharedTodoList','hold');await a.evaluate(()=>{hjSharedTodoRefresh();});
    await waitUntil(()=>mock.holds.some(x=>x.device==='test-a'&&!x.done),'connection-change response held');
    await a.evaluate(()=>{__relay.token='TEST-DIFFERENT-CONNECTION-TOKEN';});mock.releaseAll();
    await waitUntil(()=>mock.holds.every(x=>x.done),'changed connection response settled');
    await settle(a);assert.equal(await row(a,changed.id).count(),0,'response for previous connection cannot leak into changed connection');
    await a.evaluate(token=>{__relay.token=token;},TOKEN);await a.keyboard.press('Escape');await closed(a);
    console.log('PASS shared todo 7: closing and connection changes ignore stale responses');

    const C=await openDevice('test-unconfigured',360,false),c=C.page,requestsBefore=mock.calls.length;
    await c.evaluate(()=>hjSharedTodoView());await status(c,'unavailable');
    assert.equal(mock.calls.length,requestsBefore,'unconfigured screen sends no request');
    assert.match(await c.locator('#stStatus').innerText(),/연결|설정/);
    await c.locator('#stLocal').click();await c.locator('#todoText').waitFor();
    assert.equal(await c.locator('.todoRow[data-id="TEST-LOCAL-TODO"]').count(),1,'legacy local tasks remain explicitly accessible');
    assert.equal(await c.evaluate(()=>state.notes.length),2,'browsing local tasks does not automatically publish them');
    const D=await openDevice('test-unsupported',360),d=D.page;
    mock.inject('test-unsupported','sharedTodoHealth','unavailable');await d.locator(NAV).click();await status(d,'unavailable');
    assert.equal(await d.locator('#stList [data-st-id]').count(),0);
    assert.match(await d.locator('#stStatus').innerText(),/서버|배포|업데이트|지원/);
    await C.context.close();await D.context.close();
    console.log('PASS shared todo 8: absent configuration and undeployed capability fail closed; local tasks retained');

    const E=await openDevice('test-project-edit',320),e=E.page;
    const otherTask=mock.create(OTHER,'TEST select exact task project when editing');
    await e.locator(NAV).click();await status(e,'ready');await e.locator('#stFilter').selectOption('');
    await e.locator('#stProject').selectOption(PROJECT);await row(e,otherTask.id).locator('[data-st-edit]').click();
    assert.equal(await e.locator('#stProject').inputValue(),OTHER,'editing another project cannot retain the previous form project');
    await saveEdit(e,'TEST edited under correct other project');
    assert.equal(mock.tasks.get(otherTask.id).project,OTHER,'editing text cannot move work to an unrelated project');
    await E.context.close();
    console.log('PASS shared todo 9: selected task project overrides the earlier editor selection');

    const F=await openDevice('test-two-tabs',360),F2=await openDevice('test-two-tabs',360,true,F.context),f=F.page,f2=F2.page;
    await f.locator(NAV).click();await status(f,'ready');await f2.locator(NAV).click();await status(f2,'ready');
    mock.inject('test-two-tabs','sharedTodoSave','lost-ack');
    await f.locator('#stProject').selectOption(PROJECT);await f.locator('#stText').fill('TEST first tab pending operation');await f.locator('#stSave').click();await status(f,'pending');
    const firstPending=await f.evaluate(async()=>idbGetStrict(__hjSharedTodo.key)),beforeSecond=mock.count('sharedTodoSave');
    await f2.locator('#stProject').selectOption(OTHER);await f2.locator('#stText').fill('TEST second tab must not replace pending');await f2.locator('#stSave').click();
    await f2.waitForFunction(()=>!__hjSharedTodo.busy&&['error','pending'].includes(document.getElementById('stStatus')?.dataset.state));
    assert.equal(mock.count('sharedTodoSave'),beforeSecond,'a second tab cannot send over an unresolved first-tab operation');
    assert.deepEqual(await f2.evaluate(async()=>idbGetStrict(__hjSharedTodo.key)),firstPending,'atomic reservation preserves the first tab durable operation');
    await f.locator('#stRetry').click();await status(f,'ready');
    assert.equal(await f.evaluate(async()=>idbGetStrict(__hjSharedTodo.key)),null,'matching acknowledgement clears its own reservation');
    await F.context.close();
    console.log('PASS shared todo 10: same-browser tabs cannot overwrite another tab pending operation');

    const G=await openDevice('test-recovered-edit',360),g=G.page;
    const original=mock.create(PROJECT,'TEST existing task before interrupted edit');
    await g.locator(NAV).click();await status(g,'ready');await row(g,original.id).locator('[data-st-edit]').click();
    mock.inject('test-recovered-edit','sharedTodoSave','lost-ack');await g.locator('#stText').fill('TEST interrupted edit keeps original identity');await g.locator('#stSave').click();await status(g,'pending');
    const originalOp=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-recovered-edit').at(-1);
    mock.update(mock.tasks.get(original.id),{text:'TEST another employee subsequent change'});
    await G.boot();await g.locator(NAV).click();await status(g,'pending');
    // Model an expired server receipt with a now-newer task, a valid conflict after replay.
    mock.inject('test-recovered-edit','sharedTodoSave','conflict');await g.locator('#stRetry').click();await status(g,'conflict');
    assert.equal(await g.locator('#stText').inputValue(),'TEST interrupted edit keeps original identity');
    assert.equal(await g.evaluate(()=>__hjSharedTodo.edit?.id),original.id,'restored editing identity remains the original task');
    assert.equal(await g.evaluate(()=>__hjSharedTodo.edit?.revision),originalOp.payload.expectedRevision,'restored edit retains its displayed revision');
    assert(await g.locator('#stSave').isDisabled(),'conflict cannot be resubmitted before explicitly selecting latest work');
    const latestRevision=mock.tasks.get(original.id).revision;
    await row(g,original.id).locator('[data-st-edit]').click();await g.locator('#stText').fill('TEST explicit edit of latest existing work');await g.locator('#stSave').click();
    await waitUntil(()=>mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-recovered-edit').length===3,'resubmitted recovered edit observed');
    const again=mock.calls.filter(x=>x.action==='sharedTodoSave'&&x.deviceId==='test-recovered-edit').at(-1);
    assert.equal(again.payload.task.id,original.id,'recovered edit cannot silently become a new task UUID');
    assert.equal(again.payload.expectedRevision,latestRevision,'explicitly selecting latest work rebases to its displayed revision');
    await status(g,'ready');assert.equal(mock.active().filter(x=>x.id===original.id).length,1);
    await G.context.close();
    console.log('PASS shared todo 11: recovered edit conflicts retain identity and do not create copies');

    const H=await openDevice('test-auth-retry',360),h=H.page;
    await h.locator(NAV).click();await status(h,'ready');mock.inject('test-auth-retry','sharedTodoSave','lost-ack');
    await h.locator('#stText').fill('TEST auth retry keeps uncertain mutation');await h.locator('#stSave').click();await status(h,'pending');
    const authPending=await h.evaluate(async()=>idbGetStrict(__hjSharedTodo.key));
    mock.inject('test-auth-retry','sharedTodoSave','auth');await h.locator('#stRetry').click();
    await h.waitForFunction(()=>!__hjSharedTodo.busy&&['error','pending'].includes(document.getElementById('stStatus')?.dataset.state));
    assert.deepEqual(await h.evaluate(async()=>idbGetStrict(__hjSharedTodo.key)),authPending,'auth failure during replay does not prove the original mutation failed');
    assert(await h.locator('#stRetry').isVisible(),'uncertain request remains explicitly retryable');
    await h.locator('#stRetry').click();await status(h,'ready');
    assert.equal(mock.active().filter(x=>x.text==='TEST auth retry keeps uncertain mutation').length,1);
    await H.context.close();
    console.log('PASS shared todo 12: lost-ack then authentication failure retains exact pending request');

    const I=await openDevice('test-polling',360),i=I.page;
    await i.clock.install();await i.locator(NAV).click();await status(i,'ready');
    const autoTask=mock.create(PROJECT,'TEST automatic refresh from another employee');
    await i.clock.runFor(30001);await row(i,autoTask.id).waitFor();
    const countVisible=mock.calls.filter(x=>x.deviceId==='test-polling'&&x.action==='sharedTodoList').length;
    await i.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await i.clock.runFor(30001);
    assert.equal(mock.calls.filter(x=>x.deviceId==='test-polling'&&x.action==='sharedTodoList').length,countVisible,'hidden screen does not poll');
    await i.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await waitUntil(()=>mock.calls.filter(x=>x.deviceId==='test-polling'&&x.action==='sharedTodoList').length>countVisible,'visible screen refreshes immediately');
    await status(i,'ready');await i.keyboard.press('Escape');await i.clock.runFor(10);await closed(i);
    const countClosed=mock.calls.filter(x=>x.deviceId==='test-polling'&&x.action==='sharedTodoList').length;
    await i.clock.runFor(30001);
    assert.equal(mock.calls.filter(x=>x.deviceId==='test-polling'&&x.action==='sharedTodoList').length,countClosed,'dismissed screen cancels further polling');
    console.log('PASS shared todo 13: 30-second polling refreshes visible work, not hidden or closed screens');

    const J=await openDevice('test-corrupt-reservation',360),j=J.page;
    await j.locator(NAV).click();await status(j,'ready');
    for(const kind of ['circular','bigint']){
      await j.evaluate(async kind=>{const value={kind};if(kind==='circular')value.self=value;else value.amount=1n;await idbSet(__hjSharedTodo.key,value);},kind);
      const countBefore=mock.count('sharedTodoSave');
      await j.locator('#stText').fill('TEST corrupted '+kind+' reservation cannot be replaced');await j.locator('#stSave').click();await status(j,'error');
      assert.equal(mock.count('sharedTodoSave'),countBefore,'corrupt '+kind+' reservation blocks all network writes');
      assert(await j.evaluate(async kind=>{const value=await idbGetStrict(__hjSharedTodo.key);return value.kind===kind&&(kind==='circular'?value.self===value:value.amount===1n);},kind),'corrupt '+kind+' value is preserved after transaction abort');
      assert.equal(await j.locator('#stText').inputValue(),'TEST corrupted '+kind+' reservation cannot be replaced','failed durable reservation preserves the entered draft');
    }
    await J.context.close();
    console.log('PASS shared todo 14: circular and BigInt pending corruption aborts without network or overwrite');
    if(shots){
      const K=await openDevice('test-desktop-capture',360),k=K.page;
      await k.setViewportSize({width:1280,height:900});await k.evaluate(()=>{__mobileMode=false;applyMobileMode();render();syncMobileNav();hjSharedTodoView();});
      await status(k,'ready');await capture(k,'shared-work-desktop-1280');await K.context.close();
    }
    sameSnapshot(await snapshot(a),baselineA,'shared actions never mutate serialized notes, photos, projects or whole-store revision');
    sameSnapshot(await snapshot(b),baselineB,'employee B whole-data state is preserved across all shared actions');
    for(const context of contexts)for(const page of context.pages())assert.deepEqual(await page.evaluate(()=>__sharedTodoUnexpected),[],'no legacy relay, upload or AI side effects');
    assert.deepEqual(effects,[]);assert.deepEqual(errors,[]);
    console.log('PASS shared todo 15: legacy serialized data, relay revision and external workflows untouched');
    console.log('PASS shared todo 15/15; isolated independent employees and same-browser tabs; synthetic data only');
  }finally{
    mock.releaseAll();for(const context of contexts)await context.close();await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

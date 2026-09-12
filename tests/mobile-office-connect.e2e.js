/* Fake device records only; owns a temporary server (never uses the shared 8299).
   HJ_MOBILE_OFFICE_MUTATION=freshness|readonly|late reverts one guarded contract. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const ROOT=path.resolve(__dirname,'..'),MUTATION=process.env.HJ_MOBILE_OFFICE_MUTATION||'';
assert(['','freshness','readonly','late'].includes(MUTATION));
const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const bridge=source.slice(source.indexOf('/* ═══ 웹 업무 연결 센터'),source.indexOf('/* ═══ /웹 업무 연결 센터 ═══ */'));
for(const forbidden of ['location','navigator.clipboard','clipboard.read','fetch(','localStorage','sessionStorage','idbSet(','idbGet(','officeIntakeAccept(','officeIntakeOrderFromRequest(','state.aptOrders'])assert(!bridge.includes(forbidden),'bridge keeps original forbidden-ingress boundary: '+forbidden);
let server,browser,APP,ORIGIN,passed=0;const started=Date.now();
async function boot(width=390,big=''){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],requests=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));localStorage.setItem('pref_mobile','1');});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.waitForFunction(()=>!!localStorage.getItem('hj_glance'));
  await page.evaluate(async({width,big,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    state.projects=[{name:'가상아파트',stage:1,received:1234,phases:['방수'],cost:{material:20,labor:30,outsource:0},customer:{},archived:false}];
    state.files=[{id:'fake-photo',name:'가상사진.jpg',kind:'photo',size:100,project:'가상아파트',when:new Date(),_virtual:true}];
    state.aptOrders=[];state.quotes=[];state.schedule=[];state.payLog=[];state.notes=[];state.expenses=[];
    state.officeIntake={inbox:[],outbox:[],operationalErrors:[],cursor:'',lastSyncAt:'',lastError:''};
    state.editingQuote=null;state.activeProject=null;state.tab='photos';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('fake-photo');__gdToken=null;__relay.url='';__relay.token='';
    __mobileMode=width<600;applyMobileMode();if(big)document.body.classList.add(big);
    window.__officeUiHits=[];window.__officeUiDirty=0;window.__officeUiMutation=0;window.__officeUiXss=0;
    const reject=name=>function(){window.__officeUiHits.push(name);throw new Error('unexpected '+name);};
    relayCall=reject('relay');cloudOfficeInbox=reject('inbox');officeIntakeFlush=reject('flush');officeIntakeAccept=reject('accept');
    window.open=reject('window.open');getFileOf=reject('file');
    if(navigator.clipboard)navigator.clipboard.writeText=reject('clipboard');
    taxCalendarEnsure();coworkSchedEnsure();state.dirty=false;render();clearTimeout(__idbSaveTimer);
    if(!await guardedPersistCurrentState())throw new Error('fake fixture persistence failed');await __appStateWriteQueue;
    const dirty=markDirty;markDirty=function(){window.__officeUiDirty++;return dirty.apply(this,arguments);};
    if(mutation==='freshness'){const real=webOfficeConnectionState;webOfficeConnectionState=function(){const result=real.apply(this,arguments);if(result.configured&&!result.lastAt){window.__officeUiMutation++;result.mode='recent';result.lastAt=new Date().toISOString();}return result;};}
    if(mutation==='readonly'){const real=webOfficeConnectionState;webOfficeConnectionState=function(){window.__officeUiMutation++;state.files[0].project='원치않는 현장';return real.apply(this,arguments);};}
    if(mutation==='late'){
      const guard="if(!panel||!panel.isConnected||document.getElementById('webWorkConnectionPanel')!==panel)return;",original=webWorkCenterOpen.toString();
      const count=original.split(guard).length-1;if(count!==2)throw new Error('late mutation must remove exactly the success/error panel guards');
      webWorkCenterOpen=eval('('+original.replaceAll(guard,'')+')');window.__officeUiMutation=count;
    }
  },{width,big,mutation:MUTATION});
  observe=true;return{context,page,errors,requests,width,big};
}
async function run(name,fn,width=390,big=''){
  const t=await boot(width,big);try{await fn(t);assert.deepEqual(t.errors,[],'page errors');assert.deepEqual(t.requests,[],'no API/background request from panel');assert.deepEqual(await t.page.evaluate(()=>window.__officeUiHits),[],'no external/write endpoint');passed++;console.log('PASS '+name+' '+width+' '+big);}
  finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__officeUiMutation).catch(()=>0));await t.context.close();}
}
const snap=page=>page.evaluate(async()=>{const data=serializeData();data.savedAt='FIXED';return{data:JSON.stringify(data),files:JSON.stringify(state.files),office:JSON.stringify(state.officeIntake),selected:[...__sel],dirty:state.dirty,calls:window.__officeUiDirty,stored:JSON.stringify(await idbGet('appState')),prefs:Object.fromEntries(Object.entries(localStorage))};});
async function open(t){await t.page.waitForFunction(()=>!window.__mobileSheetHistoryRetire);await t.page.evaluate(()=>webWorkCenterOpen());await t.page.locator('#webWorkConnectionPanel').waitFor();}
async function close(t){await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
async function capture(t,name){if(!process.env.HJ_MOBILE_OFFICE_SCREENSHOT_DIR)return;await t.page.waitForFunction(()=>{const e=document.getElementById('toast');return !e||!e.classList.contains('show')&&Number(getComputedStyle(e).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_MOBILE_OFFICE_SCREENSHOT_DIR,name+'-'+t.width+(t.big?'-'+t.big:'')+'.png')});}
(async()=>{
  server=http.createServer((req,res)=>{
    let target;try{target=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));}catch(_){res.writeHead(400).end();return;}
    if(req.method!=='GET'||!target.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
    fs.readFile(target,(error,body)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));ORIGIN='http://127.0.0.1:'+server.address().port;APP=ORIGIN+'/index.html';console.log('ISOLATED_SERVER '+ORIGIN);
  browser=await chromium.launch({headless:true});
  await run('조회하지 않은 기기는 성공·정상으로 표시하지 않음',async t=>{
    await t.page.evaluate(()=>{__relay.url='https://example.invalid';__relay.token='FAKE_SECRET';__officeIntakeRestoreCompletedAt=new Date().toISOString();});
    const before=await snap(t.page);await open(t);
    assert.equal(await t.page.locator('#webWorkConnectionSummary').getAttribute('data-connection-mode'),'never');
    assert.equal(await t.page.locator('#webWorkLastSync').textContent(),'성공 조회 기록 없음');assert.equal(await t.page.locator('#webWorkLastSync').getAttribute('datetime'),null);
    assert.doesNotMatch(await t.page.locator('#webWorkConnectionPanel').textContent(),/방금|정상|FAKE_SECRET/);await close(t);assert.deepEqual(await snap(t.page),before,'open/close changes no records or storage');
  });
  await run('원시 빈 상태·잘못된 값도 읽기 전용',async t=>{
    for(const value of [null,[],{},'invalid']){
      await t.page.evaluate(value=>{state.officeIntake=value;},value);const before=await snap(t.page);await open(t);assert.equal(await t.page.locator('#webWorkConnectionSummary').getAttribute('data-connection-mode'),'setup');assert.deepEqual(await t.page.locator('[data-office-count]').allTextContents(),['0건','0건','0건','0건']);await close(t);assert.deepEqual(await snap(t.page),before);
    }
  });
  await run('접수·24시간·전송대기·차단 분리와 PII 숨김',async t=>{
    await t.page.evaluate(()=>{const old=new Date(Date.now()-25*3600000).toISOString(),recent=new Date().toISOString();state.officeIntake={inbox:[{status:'pending_review',createdAt:old,phone:'010-9876-5432',officeId:'FAKE_OFFICE_SECRET',description:'<img src=x onerror=window.__officeUiXss++>'},{status:'pending_review',createdAt:recent},{status:'needs_info',createdAt:old},{status:'on_hold',createdAt:old},{status:'accepted',createdAt:old},{status:'pending_review',createdAt:'invalid'}],outbox:[{action:'officeAccept',blocked:true,lastError:'FAKE_SECRET'},{action:'officeSetStatus'},{action:'officeSetStatus',blocked:false}],lastSyncAt:'',lastError:'FAKE_SECRET account@example.invalid <img src=x onerror=window.__officeUiXss++>'};});
    const before=await snap(t.page);await open(t);assert.deepEqual(await t.page.locator('[data-office-count]').allTextContents(),['5건','1건','2건','1건']);
    assert.doesNotMatch(await t.page.locator('#webWorkConnectionPanel').innerHTML(),/010-9876|FAKE_SECRET|FAKE_OFFICE_SECRET|account@example|onerror|src=x/);assert.equal(await t.page.evaluate(()=>window.__officeUiXss),0);await close(t);assert.deepEqual(await snap(t.page),before);
  });
  await run('성공 시각·오프라인·오류·15분 경계·미확인 구분',async t=>{
    const result=await t.page.evaluate(()=>{
      __relay.url='fake-url';__relay.token='fake-token';const now=Date.parse('2026-09-08T00:00:00Z');
      const stateAt=(value,error='',online=true)=>{state.officeIntake.lastSyncAt=value;state.officeIntake.lastError=error;Object.defineProperty(navigator,'onLine',{configurable:true,value:online});return webOfficeConnectionState(now);};
      return{recent:stateAt('2026-09-07T23:45:00.001Z'),stale:stateAt('2026-09-07T23:45:00Z'),offline:stateAt('2026-09-07T23:59:00Z','',false),error:stateAt('2026-09-07T23:59:00Z','private error'),future:stateAt('2026-09-08T00:00:01Z'),invalid:stateAt('not-a-date'),dateOnly:stateAt('2026-09-08'),invalidDay:stateAt('2026-02-30T00:00:00Z'),invalidHour:stateAt('2026-09-07T24:00:00Z'),invalidMinute:stateAt('2026-09-07T23:60:00Z'),leap:stateAt('2024-02-29T00:00:00Z')};
    });
    assert.deepEqual(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.mode])),{recent:'recent',stale:'stale',offline:'offline',error:'error',future:'never',invalid:'never',dateOnly:'never',invalidDay:'never',invalidHour:'never',invalidMinute:'never',leap:'stale'});
    assert.equal(result.offline.lastAt,'2026-09-07T23:59:00.000Z');assert.equal(result.error.lastAt,'2026-09-07T23:59:00.000Z');
  });
  await run('바로가기 정확한 기존 대상·고정 포털·113 메뉴 유지',async t=>{
    const before=await snap(t.page);await open(t);
    assert.equal(await t.page.evaluate(()=>MORE_CATS.flatMap(c=>c.items).length),113);
    const link=await t.page.locator('#webWorkStaffPortal').evaluate(e=>({href:e.href,target:e.target,rel:e.rel}));assert.deepEqual(link,{href:'https://01023978629.github.io/manmool/office-login.html',target:'_blank',rel:'noopener noreferrer'});
    for(const [id,fn] of [['webWorkOfficeOpen','officeIntakeOpen'],['webWorkApartmentOpen','aptOrderManage'],['webWorkConnectionSettings','openGdriveSetup']]){
      await t.page.evaluate(fn=>{window.__shortcut=[];window.__oldShortcut=window[fn];window[fn]=(...args)=>window.__shortcut.push({fn,args});},fn);
      await t.page.locator('#'+id).click();assert.deepEqual(await t.page.evaluate(()=>window.__shortcut),[{fn,args:[]}]);assert.equal(await t.page.locator('#webWorkConnectionPanel').count(),0);await t.page.evaluate(fn=>window[fn]=window.__oldShortcut,fn);await open(t);
    }
    for(const [id,selector] of [['webWorkOfficeOpen','[data-office-intake-rows]'],['webWorkApartmentOpen','#apoOfficeInbox']]){
      await t.page.locator('#'+id).click();await t.page.locator(selector).waitFor();assert.equal(await t.page.locator('#webWorkConnectionPanel').count(),0);await close(t);await open(t);
    }
    await close(t);assert.deepEqual(await snap(t.page),before);
  });
  await run('기존 상태 타이머는 요약만 갱신하고 입력·포커스 보존',async t=>{
    await t.page.evaluate(()=>{__relay.url='fake-url';__relay.token='fake-token';state.officeIntake.lastSyncAt=new Date(Date.now()-14*60000).toISOString();});
    const before=await snap(t.page);await open(t);assert.equal(await t.page.locator('#webWorkConnectionSummary').getAttribute('data-connection-mode'),'recent');
    await t.page.locator('#webWorkPaste').fill('작성 중인 가상 문의 내용');await t.page.locator('#webWorkPaste').focus();
    const kept=await t.page.evaluate(()=>{
      const panel=document.getElementById('webWorkConnectionPanel'),input=document.getElementById('webWorkPaste'),button=document.getElementById('webWorkOfficeRefresh'),handler=button.onclick,original=Date.now;input.setSelectionRange(3,7);
      try{Date.now=()=>original()+2*60000;officeIntakeRefreshVisibleStatus();}finally{Date.now=original;}
      return{panel:panel===document.getElementById('webWorkConnectionPanel'),input:input===document.getElementById('webWorkPaste'),button:button===document.getElementById('webWorkOfficeRefresh'),handler:handler===button.onclick,value:input.value,focus:document.activeElement===input,selection:[input.selectionStart,input.selectionEnd]};
    });
    assert.deepEqual(kept,{panel:true,input:true,button:true,handler:true,value:'작성 중인 가상 문의 내용',focus:true,selection:[3,7]});assert.equal(await t.page.locator('#webWorkConnectionSummary').getAttribute('data-connection-mode'),'stale');await close(t);assert.deepEqual(await snap(t.page),before);
  });
  await run('명시 갱신만 실제 sync 사용·성공시간·실패시 보존',async t=>{
    await t.page.evaluate(()=>{__relay.url='fake-url';__relay.token='fake-token';window.__syncCalls=[];cloudOfficeInbox=async cursor=>{window.__syncCalls.push(cursor);return{ok:true,requests:[],cursor:'fake-cursor',operationalErrors:[]};};});
    await open(t);assert.deepEqual(await t.page.evaluate(()=>window.__syncCalls),[]);
    await t.page.locator('#webWorkOfficeRefresh').click();await t.page.waitForFunction(()=>document.getElementById('webWorkOfficeStatus').textContent==='접수함을 갱신했습니다.');
    const at=await t.page.locator('#webWorkLastSync').getAttribute('datetime');assert(at&&Number.isFinite(Date.parse(at)));assert.equal(await t.page.evaluate(()=>window.__syncCalls.length),1);assert.equal(await t.page.evaluate(()=>window.__officeUiDirty),1);
    await t.page.evaluate(()=>{cloudOfficeInbox=async()=>{window.__syncCalls.push('failure');throw new Error('FAKE_SECRET account@example.invalid');};});await t.page.locator('#webWorkOfficeRefresh').click();await t.page.waitForFunction(()=>document.getElementById('webWorkOfficeStatus').textContent.includes('갱신하지 못했습니다'));
    assert.equal(await t.page.locator('#webWorkLastSync').getAttribute('datetime'),at);assert.equal(await t.page.locator('#webWorkConnectionSummary').getAttribute('data-connection-mode'),'error');assert.doesNotMatch(await t.page.locator('#webWorkConnectionPanel').textContent(),/FAKE_SECRET|account@example/);
  });
  await run('갱신 중 연타·닫힘·새 패널과 다른 모달을 덮지 않음',async t=>{
    await t.page.evaluate(()=>{window.__syncCount=0;officeIntakeSync=()=>{window.__syncCount++;return new Promise(resolve=>window.__syncResolve=resolve);};});await open(t);
    await t.page.evaluate(()=>{const b=document.getElementById('webWorkOfficeRefresh');b.click();b.click();});assert.equal(await t.page.evaluate(()=>window.__syncCount),1);
    await close(t);await t.page.evaluate(()=>openModal('다른 화면','<p id="otherModal">보존</p>'));await t.page.evaluate(()=>window.__syncResolve(true));await t.page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await t.page.locator('#otherModal').textContent(),'보존');assert.equal(await t.page.locator('#webWorkConnectionPanel').count(),0);await close(t);
    await open(t);await t.page.locator('#webWorkOfficeRefresh').click();await close(t);await open(t);await t.page.evaluate(()=>window.__syncResolve(false));await t.page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await t.page.locator('#webWorkOfficeStatus').textContent(),'');
  });
  await run('예외 거절도 원문 없이 안내·재시도 가능',async t=>{
    await t.page.evaluate(()=>{officeIntakeSync=async()=>{throw new Error('FAKE_SECRET account@example.invalid');};});await open(t);await t.page.locator('#webWorkOfficeRefresh').click();await t.page.waitForFunction(()=>document.getElementById('webWorkOfficeStatus').textContent.includes('갱신하지 못했습니다'));assert.equal(await t.page.locator('#webWorkOfficeRefresh').isEnabled(),true);assert.doesNotMatch(await t.page.locator('#webWorkConnectionPanel').textContent(),/FAKE_SECRET|account@example/);
  });
  for(const [width,big] of [[320,''],[390,''],[1280,''],[320,'a11y-big1'],[390,'a11y-big2']])await run('모바일·PC·큰 글씨와 44px·스크롤·키보드',async t=>{
    const before=await snap(t.page);await open(t);
    const geometry=await t.page.locator('#webWorkConnectionPanel,#webWorkConnectionPanel *').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>({name:e.id||e.className||e.tagName,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,client:e.clientWidth,scroll:e.scrollWidth})).filter(e=>e.left<-.5||e.right>innerWidth+.5||e.client>0&&e.scroll>e.client+2));assert.deepEqual(geometry,[],'panel descendants have no horizontal overflow');
    const small=await t.page.locator('#webWorkConnectionPanel button,#webWorkConnectionPanel a,.modal-close,.mfoot button').evaluateAll(nodes=>nodes.map(e=>({id:e.id||e.className,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).filter(e=>e.width<43.5||e.height<43.5));assert.deepEqual(small,[],'44px controls');
    const tiny=await t.page.locator('.web-office-stats dt,.web-office-status span,.web-office-actions button,.web-office-actions a,.web-office-panel p').evaluateAll(nodes=>nodes.map(e=>({name:e.id||e.tagName,size:parseFloat(getComputedStyle(e).fontSize),min:e.tagName==='P'?13:14})).filter(e=>e.size<e.min));assert.deepEqual(tiny,[],'new status metrics/actions 14px and guidance 13px or larger');
    assert.equal(await t.page.locator('.web-work-center').evaluate(e=>e.firstElementChild.id),'webWorkConnectionPanel');
    await t.page.locator('#webWorkStaffPortal').focus();assert.equal(await t.page.evaluate(()=>document.activeElement.id),'webWorkStaffPortal');await t.page.locator('#webWorkParse').scrollIntoViewIfNeeded();assert.equal(await t.page.locator('#webWorkParse').isVisible(),true);await t.page.locator('#webWorkConnectionTitle').scrollIntoViewIfNeeded();await capture(t,'office-connection');await close(t);assert.deepEqual(await snap(t.page),before);
  },width,big);
  await browser.close();browser=null;
  console.log('CORE elapsed='+((Date.now()-started)/1000).toFixed(1)+'s');
  if(process.env.HJ_MOBILE_OFFICE_LEGACY==='1'){
    const file=path.join(ROOT,'tests','web-work-bridge.e2e.js');
    const code="const fs=require('node:fs'),Module=require('node:module');const file="+JSON.stringify(file)+";const code=fs.readFileSync(file,'utf8').replaceAll('8299',"+JSON.stringify(String(server.address().port))+");const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(require('node:path').dirname(file));m._compile(code,file);";
    // Async spawn: the parent event loop must keep serving the isolated test origin.
    const result=await new Promise(resolve=>{const child=require('node:child_process').spawn(process.execPath,['-e',code],{cwd:ROOT,env:process.env,stdio:'inherit'});child.on('close',resolve);});assert.equal(result,0,'existing web-work bridge passes unchanged with only its port remapped');
  }
  console.log('SUMMARY '+passed+'/14 elapsed='+((Date.now()-started)/1000).toFixed(1)+'s');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{try{if(browser)await browser.close();}catch(_){}if(server)await new Promise(resolve=>server.close(resolve));});

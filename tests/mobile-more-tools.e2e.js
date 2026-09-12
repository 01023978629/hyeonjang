/* v269: fake local state only. Every menu endpoint is stubbed before the 113-action dispatch sweep.
   HJ_MOBILE_MORE_MUTATION=dispatch|favorite intentionally breaks one tested guarantee in-page. */
'use strict';
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const FAKE_WEATHER={daily:{time:['2026-09-07'],weather_code:[0],precipitation_probability_max:[0],relative_humidity_2m_max:[50],temperature_2m_max:[28],temperature_2m_min:[20]}};
const MUTATION=process.env.HJ_MOBILE_MORE_MUTATION||'';
assert(['','dispatch','favorite'].includes(MUTATION));
// Independent expected contract, not parsed from moreActionHandler or generated from MORE_CATS.
const TARGETS={
  webbridge:['webWorkCenterOpen'],officeops:['officeOpsView'],biz:['shareBizCard'],gdrive:['openGdriveSetup'],opendrive:['openDrive'],
  photobundle:['sendPhotoBundles'],sheet:['exportToSheet'],voice:['voiceMemo'],ai:['aiHelper'],addproject:['addProject'],restore:['openRestore'],
  backups:['backupHistory'],asmanage:['asManage'],aptorders:['aptOrderManage'],pjmap:['allProjectsMap'],fullxlsx:['exportFullXlsx'],activebrief:['aiActiveBrief'],
  opsreport:['opsReport','week'],aiprovider:['aiProviderManage'],llama:['llamaSetup'],autopilot:['aiAutoOperateView'],cowork:['coworkTasksManage'],
  backupcenter:['backupCenter'],claudeinbox:['claudeInboxView'],bulkassign:['bulkAssignCenter'],taxcal:['taxCalendarView'],contractdraft:['contractDraftView'],
  beforeafter:['baCompareView'],voicein:['voiceInputView'],cwsched:['coworkSchedView'],msgcenter:['msgCenterView'],ledgertab:['render'],vatc:['vatCenterView'],
  adstab:['render'],kakaoin:['kakaoOpenInbox'],ptlist:['portalListView'],yearreport:['yearReport'],aiops:['aiOpsCenter'],loopstatus:['aiOpsLoopStatus'],
  aibrain:['aiOpsBrain'],asintake:['asIntake'],satisfaction:['satisfactionManage'],funnel:['funnelView'],payplan:['payPlanDialog'],crm:['crmDialog'],
  inventory:['inventoryManage'],profitrank:['profitRank'],weekplan:['weekPlan'],companyintro:['companyIntro'],datahealth:['dataHealth'],
  photoaudit:['photoAssignmentAudit'],staleproj:['staleProjects'],reviewreq:['reviewRequest'],featurecoach:['featureCoach'],quotefollowup:['quoteFollowup'],
  similarquotes:['similarQuoteDialog'],contractreview:['contractReview'],repeatcust:['repeatCustomers'],cashflow:['cashFlow'],expenseclassify:['expenseAutoClassify'],
  budgetalert:['budgetAlert'],lossalert:['lossAlert'],voicebrief:['voiceBrief'],selfquote:['selfQuoteDialog'],salestarget:['salesTarget'],alertcenter:['alertCenter'],
  photoquote:['photoQuoteScan'],route:['routeToday'],monthreport:['monthlyReport'],safety:['safetyChecklist'],season:['seasonCalendar'],warranty:['warrantyManage'],
  knowhow:['knowhowManage'],scheduleplan:['schedulePlanDialog'],negotiate:['negotiateDialog'],siteconv:['siteConversation'],winrate:['winRateCoach'],
  bagallery:['beforeAfterGallery'],custprogress:['customerProgressV2'],weather:['weatherSmart'],scancard:['cardReceiptScan','card'],scanreceipt:['cardReceiptScan','receipt'],
  aiusage:['aiUsageDashboard'],a11y:['a11yManage'],syncguide:['syncGuide'],custreply:['customerReplyDialog'],forecast:['salesForecast'],automode:['aiOperateMode'],
  guide:['hjGuideHome'],help:['helpGuide',''],brand:['brandSettings'],import:['importWizard'],settle:['settleDocs'],taxinv:['taxInvoiceInfo'],photorep:['photoReport'],
  notify:['notifySettings'],expense:['expenseLedger'],pnl:['pnl'],search:['hjGlobalSearch'],materials:['materialCatalog'],calc:['materialCalc'],suppliers:['suppliers'],annual:['annualReport'],
  goal:['goalManage'],schedbrief:['scheduleBrief'],aiquote:['aiQuoteDialog'],photodefect:['photoDefectDialog'],worklog:['voiceWorkLog'],analysis:['bizAnalysis'],
  budget:['budgetManage'],weekbrief:['weekBrief'],undo:['fakeUndo'],diag:['runDiagnostics']
};
assert.equal(Object.keys(TARGETS).length,113,'expected action contract contains all 113 registered actions');
let browser,passed=0;
async function boot(width=390,forced=false){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[],external=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  page.on('download',()=>external.push('download'));page.on('popup',()=>external.push('popup'));
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_more_recent','[]');localStorage.setItem('hj_more_favorites','[]');});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  // The unrelated boot-only glance cache is written after 2.5s. Settle it before
  // observing preferences instead of excluding its key or weakening preservation.
  await page.waitForFunction(()=>!!localStorage.getItem('hj_glance'));
  await page.evaluate(async({width,forced,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    const p=name=>({name,stage:1,received:12345,phases:['방수'],cost:{material:100,labor:200,outsource:0},customer:{},archived:false});
    state.projects=[p('가상 가아파트'),p('가상 나아파트')];state.quotes=[];state.aptOrders=[];state.schedule=[];state.expenses=[];
    state.payLog=[{id:'fake-pay',project:'가상 가아파트',date:'2026-09-01',amount:12345}];
    state.files=Array.from({length:30},(_,i)=>({id:'fake-photo-'+i,name:'가상 사진 '+i+'.jpg',kind:'photo',ext:'jpg',size:101+i,project:'가상 가아파트',when:new Date('2026-09-01T00:00:00Z'),_virtual:true}));
    state.files.push({id:'fake-estimate',name:'가상 견적.pdf',kind:'estimate',ext:'pdf',size:333,project:'가상 가아파트',when:null,est:{amount:11000,customer:'가상 고객',date:'2026-09-01'},_virtual:true});
    state.editingQuote=null;state.activeProject=null;state.tab='photos';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('fake-photo-0');__gdToken=null;relayReady=()=>false;__mobileMode=width<600||forced;applyMobileMode();
    window.__moreUnexpected=[];window.__moreHits=[];window.__moreMutation=0;window.__moreDirty=0;window.__moreXss=0;
    const reject=name=>function(){window.__moreUnexpected.push(name);throw new Error('unexpected external action '+name);};
    window.open=reject('window.open');window.showOpenFilePicker=reject('filePicker');window.showDirectoryPicker=reject('directoryPicker');
    if(navigator.share)navigator.share=reject('share');if(navigator.clipboard){navigator.clipboard.writeText=reject('clipboard');navigator.clipboard.write=reject('clipboard');}
    if(navigator.geolocation){navigator.geolocation.getCurrentPosition=reject('geolocation');navigator.geolocation.watchPosition=reject('geolocation');}
    if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=reject('microphone');
    window.SpeechRecognition=reject('speech');window.webkitSpeechRecognition=reject('speech');
    relayCall=reject('relay');portalAutoSync=reject('portalSync');getFileOf=reject('originalFile');
    // Seed after replacing schedule, so later boot timers are idempotent. Calling
    // ensure before clearing fake schedule would re-add tax items during capture.
    taxCalendarEnsure();coworkSchedEnsure();state.dirty=false;render();clearTimeout(__idbSaveTimer);if(!await guardedPersistCurrentState())throw new Error('fake fixture persistence failed');await __appStateWriteQueue;
    const dirty=markDirty;markDirty=function(){window.__moreDirty++;return dirty.apply(this,arguments);};
    if(mutation==='dispatch'){const real=moreActionHandler;moreActionHandler=function(action){if(action==='beforeafter'){window.__moreMutation++;return beforeAfterGallery();}return real.apply(this,arguments);};}
    if(mutation==='favorite'){const real=moreGetFavorites;moreGetFavorites=function(){window.__moreMutation++;state.files[0].project='가상 나아파트';return real.apply(this,arguments);};}
  },{width,forced,mutation:MUTATION});
  observe=true;return{context,page,errors,requests,external,width,forced};
}
async function run(name,fn,width=390,forced=false){const t=await boot(width,forced);try{await fn(t);assert.deepEqual(t.errors,[]);assert.deepEqual(t.requests,[]);assert.deepEqual(t.external,[]);assert.deepEqual(await t.page.evaluate(()=>window.__moreUnexpected),[]);passed++;console.log('PASS '+width+'px '+name);}finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__moreMutation).catch(()=>0));await t.context.close();}}
const snap=page=>page.evaluate(async()=>{const data=serializeData();data.savedAt='FIXED';return{data:JSON.stringify(data),files:JSON.stringify(state.files),selected:[...__sel],dirty:state.dirty,calls:window.__moreDirty,
  stored:JSON.stringify(await idbGet('appState')),otherLocal:Object.fromEntries(Object.entries(localStorage).filter(([key])=>!['hj_more_recent','hj_more_favorites'].includes(key)))};});
async function readonly(t,before){const after=await snap(t.page);const changed=Object.keys(before).filter(key=>!isDeepStrictEqual(after[key],before[key]));const localKeys=[...new Set([...Object.keys(before.otherLocal),...Object.keys(after.otherLocal)])].filter(key=>!isDeepStrictEqual(before.otherLocal[key],after.otherLocal[key]));assert.deepEqual(changed,[],'menu browsing preserves business state; changed fields: '+changed.join(', ')+'; preference keys: '+localKeys.join(', '));assert.equal(await t.page.evaluate(()=>window.__moreXss),0);}
async function openMore(t){await t.page.waitForFunction(()=>!window.__mobileSheetHistoryRetire&&!window.__mobileSheetHistoryDeferredOpen);await t.page.evaluate(()=>openMoreSheetV2(document.querySelector('[data-mnav="__more"]')));await t.page.locator('#moreSheet').waitFor();}
async function closeMore(t){await t.page.locator('#moreSheetClose').click();await t.page.waitForFunction(()=>!document.getElementById('moreSheet')&&!window.__mobileSheetHistoryRetire);}
async function closeModal(t){await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
const searchActions=page=>page.locator('#moreSearchResult [data-moreaction],#moreSearchResult [data-more]').evaluateAll(els=>els.map(e=>e.dataset.moreaction||'nav:'+e.dataset.more));
async function search(t,text,expected){await t.page.locator('#moreSearch').fill(text);await t.page.waitForFunction(expected=>[...document.querySelectorAll('#moreSearchResult [data-moreaction],#moreSearchResult [data-more]')].some(e=>(e.dataset.moreaction||'nav:'+e.dataset.more)===expected),expected);}
async function targets44(t){const bad=await t.page.locator('#moreSheet button:visible,#moreSheet input:visible,#moreSheet summary:visible').evaluateAll(els=>els.map(e=>({tag:e.tagName,id:e.id||e.dataset.moreaction||e.dataset.more||e.textContent.trim().slice(0,30),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,name:!!(e.getAttribute('aria-label')||e.labels?.length||e.textContent.trim())})).filter(e=>e.w<43.5||e.h<43.5||!e.name));assert.deepEqual(bad,[],'visible menu controls have names and 44px targets');}
async function capture(t,name){if(!process.env.HJ_MOBILE_MORE_SCREENSHOT_DIR)return;await t.page.waitForFunction(()=>{const el=document.getElementById('toast');return !el||!el.classList.contains('show')&&Number(getComputedStyle(el).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_MOBILE_MORE_SCREENSHOT_DIR,name+'-'+t.width+(t.forced?'-forced':'')+'.png')});}
(async()=>{browser=await chromium.launch({headless:true});
  await run('113개 메뉴의 실제 클릭→dispatch→함수·인자 일치',async t=>{
    const before=await snap(t.page);
    const records=await t.page.evaluate(async targets=>{
      const actions=MORE_CATS.flatMap(c=>c.items.map(i=>i[0]));
      if(new Set(actions).size!==113||JSON.stringify([...actions].sort())!==JSON.stringify(Object.keys(targets).sort()))throw new Error('catalog differs from independent 113-action contract');
      const saved={},calls=[];for(const fn of new Set(Object.values(targets).map(t=>t[0]))){if(fn==='fakeUndo')continue;if(typeof window[fn]!=='function')throw new Error('missing target '+fn);saved[fn]=window[fn];window[fn]=(...args)=>{calls.push({fn,args});};}
      const nativePrompt=window.prompt;window.prompt=()=>'가상 신규 현장';state.lastMove={fake:true};
      const undo=document.createElement('button');undo.id='btnUndo';undo.onclick=()=>calls.push({fn:'fakeUndo',args:[]});document.getElementById('btnUndo').replaceWith(undo);
      const nativeDispatch=moreDispatch;let pending=null;moreDispatch=function(action){pending=Promise.resolve(nativeDispatch(action));return pending;};
      const wait=async test=>{const until=Date.now()+6000;while(!test()){if(Date.now()>until)throw new Error('menu transition timed out');await new Promise(requestAnimationFrame);}};
      const out=[];try{for(const action of actions){
        await wait(()=>!window.__mobileSheetHistoryRetire&&!window.__mobileSheetHistoryDeferredOpen);openMoreSheetV2(document.querySelector('[data-mnav="__more"]'));
        await wait(()=>!!document.getElementById('moreSheet'));const chip=document.querySelector('.more-cat-block [data-moreaction="'+action+'"]');
        if(!chip)throw new Error('missing category chip '+action);chip.closest('details').open=true;const rect=chip.getBoundingClientRect(),enabled=!chip.disabled;const start=calls.length;pending=null;chip.click();
        await wait(()=>!!pending||!!document.getElementById('moreRunProceed'));
        if(document.getElementById('moreRunProceed'))document.getElementById('moreRunProceed').click();
        await wait(()=>!!pending);const result=await pending;
        out.push({action,result,hits:calls.slice(start),enabled,width:rect.width,height:rect.height,tab:state.tab,project:state.activeProject,newProject:document.getElementById('newProj')?.value});
      }}finally{moreDispatch=nativeDispatch;window.prompt=nativePrompt;for(const fn of Object.keys(saved))window[fn]=saved[fn];state.lastMove=null;}
      await wait(()=>!window.__mobileSheetHistoryRetire);return out;
    },TARGETS);
    assert.equal(records.length,113);for(const r of records){const [fn,...args]=TARGETS[r.action];assert.deepEqual(r.hits,[{fn,args}],'exact endpoint for '+r.action);assert.equal(r.result,true,'registered successful dispatch '+r.action);assert(r.enabled&&r.width>=43.5&&r.height>=43.5,'enabled 44px menu chip '+r.action);if(r.action==='ledgertab')assert.equal(r.tab,'ledger');if(r.action==='adstab')assert.equal(r.tab,'ads');if(['ledgertab','adstab'].includes(r.action))assert.equal(r.project,null);if(r.action==='addproject')assert.equal(r.newProject,'가상 신규 현장');}
    await readonly(t,before);
  });
  await run('잘못된 최근사용·즐겨찾기 저장값을 안전하게 읽고 제한',async t=>{
    const before=await snap(t.page);
    const out=await t.page.evaluate(()=>{
      const records=[];for(const value of ['null','{}','"gdrive"','not-json','1']){localStorage.setItem('hj_more_recent',value);localStorage.setItem('hj_more_favorites',value);records.push({recent:moreGetRecent(),favorites:moreGetFavorites()});}
      const mixed=['gdrive','gdrive','unknown-action',null,{},7,'a11y','syncguide','photoaudit','backupcenter','aptorders','annual'];
      localStorage.setItem('hj_more_recent',JSON.stringify(mixed));localStorage.setItem('hj_more_favorites',JSON.stringify(mixed));
      return{records,recent:moreGetRecent(),favorites:moreGetFavorites()};
    });
    for(const r of out.records){assert.deepEqual(r.recent,[]);assert.deepEqual(r.favorites,[]);}
    const expected=['gdrive','a11y','syncguide','photoaudit','backupcenter','aptorders'];assert.deepEqual(out.recent,expected);assert.deepEqual(out.favorites,expected);
    await openMore(t);assert.equal(await t.page.locator('#moreFavorites [data-moreaction]').count(),6);await closeMore(t);await readonly(t,before);
  });
  await run('즐겨찾기 편집은 실행하지 않고 최대6개·해제·유지',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{window.__moreFavoriteDispatch=[];window.__moreOriginalDispatch=moreDispatch;moreDispatch=async action=>{window.__moreFavoriteDispatch.push(action);return true;};});
    await openMore(t);await t.page.locator('#moreFavoriteEdit').click();assert.equal(await t.page.locator('#moreFavoriteEdit').getAttribute('aria-pressed'),'true');
    assert(await t.page.locator('#moreMain [data-more="docs"]').isDisabled(),'navigation shortcuts are disabled during favorite editing');
    for(const action of ['gdrive','a11y','syncguide','photoaudit','backupcenter','aptorders']){await t.page.evaluate(action=>{const el=document.querySelector('.more-cat-block [data-moreaction="'+action+'"]');el.closest('details').open=true;},action);await t.page.locator('.more-cat-block [data-moreaction="'+action+'"]').click();assert(await t.page.locator('#moreSheet').count());}
    assert.deepEqual(await t.page.evaluate(()=>moreGetFavorites()),['gdrive','a11y','syncguide','photoaudit','backupcenter','aptorders']);
    await t.page.evaluate(()=>document.querySelector('.more-cat-block [data-moreaction="annual"]').closest('details').open=true);await t.page.locator('.more-cat-block [data-moreaction="annual"]').click();assert.equal(await t.page.evaluate(()=>moreGetFavorites().length),6);
    await t.page.locator('#moreFavorites [data-moreaction="gdrive"]').click();assert.equal(await t.page.evaluate(()=>moreGetFavorites().includes('gdrive')),false);
    assert.deepEqual(await t.page.evaluate(()=>window.__moreFavoriteDispatch),[]);assert.deepEqual(await t.page.evaluate(()=>moreGetRecent()),[]);
    await closeMore(t);await openMore(t);assert.equal(await t.page.locator('#moreFavoriteEdit').getAttribute('aria-pressed'),'false');assert.equal(await t.page.locator('#moreFavorites [data-moreaction]').count(),5);await capture(t,'mobile-more-favorites');
    await t.page.locator('#moreFavorites [data-moreaction="a11y"]').click();await t.page.waitForFunction(()=>!document.getElementById('moreSheet'));assert.deepEqual(await t.page.evaluate(()=>window.__moreFavoriteDispatch),['a11y']);await readonly(t,before);
  });
  await run('공백없는 검색·화면 바로가기·결과0복귀·한글조합·XSS',async t=>{
    const before=await snap(t.page);await openMore(t);
    await search(t,'백업센터','backupcenter');await search(t,'사업자·명함','biz');await search(t,'프로젝트별문서','nav:docs');await search(t,'견적','nav:estimates');await capture(t,'mobile-more-search');
    assert.equal(await t.page.locator('#moreResultCount').getAttribute('role'),'status');await t.page.locator('#moreSearchClear').click();
    assert.equal(await t.page.locator('#moreSearch').inputValue(),'');assert(await t.page.locator('#moreMain').isVisible());
    await t.page.locator('#moreSearch').focus();await t.page.evaluate(()=>{const e=document.getElementById('moreSearch');window.__moreImeNode=e;e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));e.value='백업센터';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'백업센터',isComposing:true}));});
    assert(await t.page.evaluate(()=>document.getElementById('moreSearch')===window.__moreImeNode&&document.activeElement===window.__moreImeNode),'IME must retain the focused search node');
    await t.page.evaluate(()=>document.getElementById('moreSearch').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'백업센터'})));
    await t.page.waitForFunction(()=>!!document.querySelector('#moreSearchResult [data-moreaction="backupcenter"]'));
    const x='<img src=x onerror=window.__moreXss=1>';await t.page.locator('#moreSearch').fill(x);assert.deepEqual(await searchActions(t.page),[]);assert.equal(await t.page.locator('#moreSearchResult img').count(),0);assert((await t.page.locator('#moreSearchResult').innerText()).includes('없'));
    await t.page.locator('#moreSearchClear').click();await closeMore(t);await readonly(t,before);
  });
  await run('미등록·동기오류·비동기거절은 실패로 표시하고 밖으로 새지 않음',async t=>{
    const before=await snap(t.page),out=await t.page.evaluate(async()=>{
      const native=annualReport,nativeYear=yearReport,nativeToast=toast,calls=[];toast=message=>calls.push(String(message));
      const results=[];try{results.push(await moreDispatch('unknown-action'));annualReport=()=>{throw new Error('FAKE_SYNC_FAILURE');};results.push(await moreDispatch('annual'));
        annualReport=async()=>{throw new Error('FAKE_ASYNC_FAILURE');};results.push(await moreDispatch('annual'));
        yearReport=()=>{throw new Error('FAKE_YEAR_SYNC_FAILURE');};results.push(await moreDispatch('yearreport'));
        yearReport=async()=>{throw new Error('FAKE_YEAR_ASYNC_FAILURE');};results.push(await moreDispatch('yearreport'));
      }finally{annualReport=native;yearReport=nativeYear;toast=nativeToast;}return{results,calls};
    });assert.deepEqual(out.results,[false,false,false,false,false]);assert(out.calls.length>=5);await readonly(t,before);
  });
  await run('반출·일괄변경·되돌리기 5개 메뉴 확인에서 취소하면 실행0',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{window.__moreCanceledDispatch=[];moreDispatch=async action=>{window.__moreCanceledDispatch.push(action);return true;};});
    for(const action of ['sheet','aibrain','autopilot','fullxlsx','undo']){
      await openMore(t);const label=await t.page.evaluate(action=>MORE_CATS.flatMap(c=>c.items).find(i=>i[0]===action)[2],action);
      await search(t,label,action);await t.page.locator('#moreSearchResult [data-moreaction="'+action+'"]').click();await t.page.locator('#moreRunConfirm').waitFor();
      assert((await t.page.locator('#moreRunConfirm').innerText()).length>30,'confirmation describes the pending operation');assert(await t.page.locator('#moreRunProceed').isVisible());
      await closeModal(t);assert.deepEqual(await t.page.evaluate(()=>window.__moreCanceledDispatch),[],'cancel never calls '+action);
    }
    await readonly(t,before);
  });
  await run('주요 실제 화면과 바로가기의 진입·취소',async t=>{
    const before=await snap(t.page);
    for(const tab of ['docs','estimates','contacts','project']){await openMore(t);await t.page.locator('#moreMain [data-more="'+tab+'"]').click();await t.page.waitForFunction(tab=>state.tab===tab&&!document.getElementById('moreSheet'),tab);assert(await t.page.locator('#view').innerText());}
    const screens=[['syncguide','#syncOpen'],['a11y','.a11yBig'],['photoaudit','#paDupCount'],['backupcenter','#bcPhotoSource']];
    await t.page.evaluate(()=>{storageGuardRefresh=async()=>{};});
    for(const [action,selector]of screens){await openMore(t);await search(t,(await t.page.evaluate(action=>MORE_CATS.flatMap(c=>c.items).find(i=>i[0]===action)[2],action)),action);await t.page.locator('#moreSearchResult [data-moreaction="'+action+'"]').click();await t.page.locator('#modalRoot '+selector).first().waitFor();await closeModal(t);}
    await readonly(t,before);
  });
  await run('날씨 성공·오류 화면은 모달과 닫기를 유지하고 잠금을 해제',async t=>{
    const before=await snap(t.page);
    for(const fail of [false,true]){
      const result=await t.page.evaluate(async({data,fail})=>{weatherFetch=async()=>{if(fail)throw new Error('FAKE_WEATHER_FAILURE <img src=x onerror=window.__moreXss=1>');return data;};aiKeyReady=()=>false;return await weatherSmart();},{data:FAKE_WEATHER,fail});
      assert.equal(await t.page.locator('#modalRoot .modal').getAttribute('role'),'dialog');assert(await t.page.locator('#modalRoot .modal-close').isVisible());
      assert(await t.page.evaluate(()=>document.body.classList.contains('modal-open')));
      assert((await t.page.locator('#modalRoot .mbody').innerText()).includes(fail?'FAKE_WEATHER_FAILURE':'날씨 연동 공정 관리'));
      assert.equal(await t.page.locator('#modalRoot img').count(),0,'error message is escaped, never interpreted as markup');
      assert.equal(fail?result.오류:result.예보일수,fail?'날씨 로드 실패':1);
      await closeModal(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);
    }
    await readonly(t,before);
  });
  await run('닫은 날씨 요청의 늦은 성공·실패가 다른 모달을 덮지 않음',async t=>{
    const before=await snap(t.page);
    for(const fail of [false,true]){
      await t.page.evaluate(()=>{window.__fakeWeatherResolve=null;window.__fakeWeatherReject=null;weatherFetch=()=>new Promise((resolve,reject)=>{window.__fakeWeatherResolve=resolve;window.__fakeWeatherReject=reject;});window.__fakeWeatherPending=weatherSmart();});
      await t.page.waitForFunction(()=>typeof window.__fakeWeatherResolve==='function'&&document.querySelector('#modalRoot .mbody')?.textContent.includes('불러오는 중'));
      await closeModal(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);
      await t.page.evaluate(()=>{openModal('가상 다른 화면','<div id="fakeNextModal">유지되어야 하는 화면</div>');window.__fakeNextModal=document.querySelector('#modalRoot .modal');});
      await t.page.evaluate(async({data,fail})=>{if(fail)window.__fakeWeatherReject(new Error('FAKE_LATE_WEATHER_FAILURE'));else window.__fakeWeatherResolve(data);await window.__fakeWeatherPending;},{data:FAKE_WEATHER,fail});
      assert(await t.page.evaluate(()=>document.querySelector('#modalRoot .modal')===window.__fakeNextModal),'late weather results preserve the current modal node');
      assert.equal(await t.page.locator('#fakeNextModal').innerText(),'유지되어야 하는 화면');
      await closeModal(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);
    }
    await readonly(t,before);
  });
  await run('닫은 날씨 AI 응답이 새 화면의 내용을 바꾸지 않음',async t=>{
    const before=await snap(t.page);
    await t.page.evaluate(async data=>{weatherFetch=async()=>data;aiKeyReady=()=>true;weatherRisksForDate=()=>[{title:'가상 방수',reason:'가상 위험'}];aiAsk=()=>new Promise(resolve=>{window.__fakeAiResolve=resolve;});await weatherSmart();const b=document.getElementById('wxAI'),fn=b.onclick;b.onclick=()=>{window.__fakeAiPending=fn();return window.__fakeAiPending;};},FAKE_WEATHER);
    await t.page.locator('#wxAI').click();await t.page.waitForFunction(()=>typeof window.__fakeAiResolve==='function');
    await closeModal(t);await t.page.evaluate(()=>{openModal('가상 다른 화면','<div id="wxAiBox">새 화면 보존</div>');window.__fakeNextModal=document.querySelector('#modalRoot .modal');});
    await t.page.evaluate(async()=>{window.__fakeAiResolve('가상 지연 제안');await window.__fakeAiPending;});
    assert(await t.page.evaluate(()=>document.querySelector('#modalRoot .modal')===window.__fakeNextModal));assert.equal(await t.page.locator('#wxAiBox').innerText(),'새 화면 보존');
    await closeModal(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);await readonly(t,before);
  });
  for(const size of [1,2])await run('큰 글씨 '+size+'단계에서 모든 메뉴 이름·버튼이 잘리지 않음',async t=>{
    const before=await snap(t.page);await t.page.evaluate(size=>document.body.classList.add('a11y-big'+size),size);await openMore(t);
    await t.page.evaluate(()=>document.querySelectorAll('.more-cat-block').forEach(el=>el.open=true));await targets44(t);
    const bad=await t.page.locator('#moreSheet .more-chip-label,#moreSheet .more-chip').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{name:el.textContent.trim(),left:r.left,right:r.right,scroll:el.scrollWidth,client:el.clientWidth,h:el.clientHeight,fullh:el.scrollHeight,label:el.classList.contains('more-chip-label')};}).filter(x=>x.left< -1||x.right>innerWidth+1||x.scroll>x.client+2||x.label&&x.fullh>x.h+2));
    assert.deepEqual(bad,[],'large-text controls and labels remain visible');
    const navBad=await t.page.locator('.mobile-nav .mnav-btn').evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect(),label=e.querySelector('span:not(.mi):not(.mnav-badge)'),r=label.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);const lines=new Set([...range.getClientRects()].filter(x=>x.width>0&&x.height>0).map(x=>Math.round(x.top))).size;return{id:e.dataset.mnav,left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:b.width,h:b.height,labelLeft:r.left,labelRight:r.right,labelBottom:r.bottom,lines};}).filter(x=>x.left< -1||x.right>innerWidth+1||x.top<0||x.bottom>innerHeight+1||x.w<43.5||x.h<43.5||x.labelLeft<x.left-1||x.labelRight>x.right+1||x.labelBottom>innerHeight+1||x.lines!==1));
    assert.deepEqual(navBad,[],'bottom navigation labels stay on one complete line within the viewport; camera icon may protrude upward');
    await capture(t,'mobile-more-big'+size);await closeMore(t);await readonly(t,before);
  },320);
  for(const [width,forced]of [[320,false],[360,false],[390,false],[768,true]])await run('폰 메뉴 배치·44px·초점·뒤로가기·스크롤 보존',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{history.replaceState({fakeMenu:'base'},'',location.href);history.pushState({fakeMenu:'top'},'',location.href);window.scrollTo(0,300);});const scroll=await t.page.evaluate(()=>window.scrollY);
    await openMore(t);assert.equal(await t.page.locator('#moreSheet').getAttribute('role'),'dialog');assert.equal(await t.page.locator('#moreSheet').getAttribute('aria-modal'),'true');
    assert.equal(await t.page.evaluate(()=>document.activeElement.id),'moreSearch');await targets44(t);
    await t.page.locator('.more-cat-block').first().locator('summary').click();await targets44(t);
    const bad=await t.page.locator('#moreSheet,.more-chip:visible').evaluateAll((els,width)=>els.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth};}).filter(r=>r.left< -1||r.right>width+1||r.scroll>r.client+2),width);assert.deepEqual(bad,[],'menu does not overflow viewport');
    await capture(t,'mobile-more');
    await t.page.evaluate(()=>{const s=document.getElementById('moreSheet'),els=[...s.querySelectorAll('button,input,summary')].filter(e=>{const closed=e.closest('details:not([open])');return e.getClientRects().length&&(!closed||e.tagName==='SUMMARY'&&e.parentElement===closed);});els.at(-1).focus();});await t.page.keyboard.press('Tab');assert.equal(await t.page.evaluate(()=>document.activeElement.id),'moreSheetClose');
    await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.getElementById('moreSheet')&&!window.__mobileSheetHistoryRetire);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('mobile-sheet-open')),false);
    await openMore(t);await t.page.evaluate(()=>history.back());await t.page.waitForFunction(()=>!document.getElementById('moreSheet')&&!window.__mobileSheetHistoryRetire);
    assert.equal(await t.page.evaluate(()=>history.state.fakeMenu),'top');assert(Math.abs(await t.page.evaluate(()=>window.scrollY)-scroll)<6);await readonly(t,before);
  },width,forced);
  console.log('== mobile-more-tools: '+passed+' passed; 113 action clicks checked; pageerrors=0 ==');await browser.close();
})().catch(async e=>{console.error('FAIL mobile-more-tools',e);if(browser)await browser.close();process.exitCode=1;});

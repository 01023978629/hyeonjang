/* v270 photo report: isolated fake metadata/images, never operating files/accounts.
   HJ_PHOTO_REPORT_MUTATION=scope|readonly|selection must fail its protected assertion. */
'use strict';
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const A='가상 가아파트',B='가상 나아파트',ARCHIVE='가상 보관아파트';
const X='<img src=x onerror=window.__reportXss=1>';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const MUTATION=process.env.HJ_PHOTO_REPORT_MUTATION||'';
assert(['','scope','readonly','selection'].includes(MUTATION));
let browser,passed=0;
async function boot(width=390){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[],sideEffects=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  page.on('download',()=>sideEffects.push('download'));page.on('popup',()=>sideEffects.push('popup'));
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.waitForFunction(()=>!!localStorage.getItem('hj_glance'));
  await page.evaluate(async({a,b,archive,x,png,width,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;aiOpsEnsureState().enabled=false;
    const p=(name,archived=false)=>({name,archived,stage:1,received:12345,phases:['철거','방수','미장','배관'],cost:{material:100,labor:200,outsource:0},customer:{name:'가상 내부 고객',phone:'FAKE-PRIVATE-CONTACT'}});
    state.projects=[p(a),p(b),p(archive,true)];state.quotes=[];state.aptOrders=[];state.schedule=[];state.expenses=[];
    state.payLog=[{id:'fake-pay',project:a,date:'2026-09-01',amount:12345}];
    let serial=100;const photo=(id,when,phase,work,project=a,name=id+'.png')=>({id,name,project,kind:'photo',ext:'png',size:++serial,when:when?new Date(when):null,_phase:phase,_worklabel:work,_virtual:true,thumb:'data:image/png;base64,'+png});
    state.files=[photo('a-old','2026-08-31T01:00:00Z','철거','이전 작업'),photo('a1','2026-09-06T14:59:00Z','방수','화장실 1차 방수'),
      photo('a2','2026-09-06T15:00:00Z','방수','화장실 2차 방수'),photo('a3','2026-09-07T01:00:00Z','미장','거실 확장 미장'),
      photo('a4','2026-09-08T01:00:00Z','미장','바닥 미장'),photo('a5','2026-09-09T01:00:00Z','배관','피팅 연결'),
      photo('a-unknown',null,'방수','날짜 미확인 작업'),photo('a-xss','2026-09-07T03:00:00Z',x,x,a,x+'.png'),
      photo('b1','2026-09-07T01:00:00Z','방수','다른현장비공개',b),photo('arch1','2026-09-07T01:00:00Z','방수','보관 작업',archive),
      photo('unassigned','2026-09-07T01:00:00Z','방수','미배정 작업',null),
      {id:'fake-estimate',name:'방수 견적.pdf',project:a,kind:'estimate',ext:'pdf',size:333,when:null,est:{amount:110000,date:'2026-09-01'}}];
    state.editingQuote=null;state.activeProject=null;state.tab='photos';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('b1');__gdToken=null;relayReady=()=>false;__mobileMode=width<600;applyMobileMode();
    window.__reportXss=0;window.__reportMutation=0;window.__reportDirty=0;window.__reportUnexpected=[];window.__reportCopies=[];window.__reportAI=[];window.__reportLoads=[];window.__reportExports=[];
    const reject=name=>()=>{window.__reportUnexpected.push(name);throw new Error('unexpected external '+name);};
    window.open=reject('window.open');window.showOpenFilePicker=reject('picker');window.showDirectoryPicker=reject('directory');
    if(navigator.share)navigator.share=reject('share');
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__reportCopies.push(String(text))}});
    relayCall=reject('relay');portalAutoSync=reject('portal');getFileOf=reject('original');
    loadPhotoForExport=reject('image-before-explicit-click');geminiAsk=reject('AI-before-consent');__docExport=reject('export-before-explicit-click');
    taxCalendarEnsure();coworkSchedEnsure();state.dirty=false;render();clearTimeout(__idbSaveTimer);
    if(!await guardedPersistCurrentState())throw new Error('fake report fixture persistence failed');await __appStateWriteQueue;
    const originalDirty=markDirty;markDirty=function(){window.__reportDirty++;return originalDirty.apply(this,arguments);};
    if(mutation==='scope'){const original=photoReportData;photoReportData=function(name,opts){const d=original.apply(this,arguments);if(name===a&&d&&d.files){window.__reportMutation++;d.files=[...d.files,state.files.find(f=>f.id==='b1')];d.total=d.files.length;}return d;};}
    if(mutation==='readonly'){const original=photoReportData;photoReportData=function(){window.__reportMutation++;state.projects[0].received++;return original.apply(this,arguments);};}
    if(mutation==='selection'){const original=photoReportImage;photoReportImage=function(name,ids,opts){if(Array.isArray(ids)&&ids.length===2&&ids.includes('a2')&&ids.includes('a3')){window.__reportMutation++;return original.call(this,name,['a5'],opts);}return original.apply(this,arguments);};}
  },{a:A,b:B,archive:ARCHIVE,x:X,png:PNG,width,mutation:MUTATION});
  observe=true;return{context,page,errors,requests,sideEffects,width};
}
async function run(name,fn,width=390){const t=await boot(width);try{await fn(t);assert.deepEqual(t.errors,[],'pageerror=0');assert.deepEqual(t.requests,[],'network=0');assert.deepEqual(t.sideEffects,[],'no real download/share/window');assert.deepEqual(await t.page.evaluate(()=>window.__reportUnexpected),[]);passed++;console.log('PASS '+width+'px '+name);}finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__reportMutation).catch(()=>0));await t.context.close();}}
const snap=page=>page.evaluate(async()=>{const d=serializeData();d.savedAt='FIXED';return{data:JSON.stringify(d),files:JSON.stringify(state.files),selected:[...__sel],dirty:state.dirty,dirtyCalls:window.__reportDirty,stored:JSON.stringify(await idbGet('appState')),local:Object.fromEntries(Object.entries(localStorage))};});
async function readonly(t,before){const after=await snap(t.page);assert.deepEqual(Object.keys(before).filter(k=>!isDeepStrictEqual(before[k],after[k])),[],'reports preserve metadata, business state, global selection, IDB and preferences');assert.equal(await t.page.evaluate(()=>window.__reportXss),0);}
async function open(t,name=A){await t.page.evaluate(name=>photoReport(name),name);await t.page.locator('#photoReportPanel').waitFor();}
async function close(t){await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
const rows=page=>page.locator('#prResults input.prPhotoPick').evaluateAll(els=>els.map(e=>e.dataset.id));
async function expectRows(t,ids){await t.page.waitForFunction(expected=>{const got=[...document.querySelectorAll('#prResults input.prPhotoPick')].map(e=>e.dataset.id).sort();return JSON.stringify(got)===JSON.stringify([...expected].sort());},ids);assert.deepEqual((await rows(t.page)).sort(),[...ids].sort());}
async function fillDate(t,id,value){await t.page.locator(id).fill(value);await t.page.locator(id).dispatchEvent('change');}
async function imageStub(t,{fail=[],deferred=false}={}){await t.page.evaluate(({png,fail,deferred})=>{
  window.__reportLoads=[];window.__reportExports=[];window.__reportCreated=[];window.__reportRevoked=[];window.__reportDrawn=[];window.__reportLoadRelease=null;
  const originalRevoke=URL.revokeObjectURL;URL.revokeObjectURL=function(url){window.__reportRevoked.push(url);return originalRevoke.call(URL,url);};
  const originalDraw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(img){if(img.__fakeReportId)window.__reportDrawn.push(img.__fakeReportId);return originalDraw.apply(this,arguments);};
  loadPhotoForExport=async f=>{window.__reportLoads.push(f.id);if(deferred)await new Promise(resolve=>window.__reportLoadRelease=resolve);if(fail.includes(f.id))return null;
    const blob=new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:'image/png'}),url=URL.createObjectURL(blob),img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});img.__fakeReportId=f.id;window.__reportCreated.push(url);return{img,url};};
  __docExport=async(cv,name,pdf)=>window.__reportExports.push({canvas:cv.id,width:cv.width,height:cv.height,name,pdf});
},{png:PNG,fail,deferred});}
async function capture(t,name){if(!process.env.HJ_PHOTO_REPORT_SCREENSHOT_DIR)return;await t.page.waitForFunction(()=>{const el=document.getElementById('toast');return !el||!el.classList.contains('show')&&Number(getComputedStyle(el).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_PHOTO_REPORT_SCREENSHOT_DIR,name+'-'+t.width+'.png')});}
(async()=>{browser=await chromium.launch({headless:true});
  await run('엄격한 날짜 검증·KST 자정·윤일·날짜 미확인',async t=>{
    const before=await snap(t.page),result=await t.page.evaluate(()=>({
      valid:['2024-02-29','2026-09-07','2026-09-06T15:00:00.000Z'].map(photoReportDate),
      dates:[new Date('2026-09-06T14:59:59Z'),new Date('2026-09-06T15:00:00Z')].map(photoReportDate),
      invalid:[null,undefined,'',0,123,true,{},'2026-02-29','2026-04-31','2026-13-01','2026-00-10','garbage',new Date(NaN)].map(photoReportDate)
    }));assert.deepEqual(result.valid,['2024-02-29','2026-09-07','2026-09-07']);assert.deepEqual(result.dates,['2026-09-06','2026-09-07']);assert(result.invalid.every(x=>x===''));await readonly(t,before);
  });
  await run('현장·종류·기간·공정·작업명 범위를 지키는 집계',async t=>{
    const before=await snap(t.page),data=await t.page.evaluate(a=>{
      const take=d=>({ids:d.files.map(f=>f.id).sort(),total:d.total,projectTotal:d.projectTotal,undated:d.undated.map(f=>f.id),undatedTotal:d.undatedTotal,dateCount:d.dateCount,dates:d.days.map(x=>x.date),error:!!d.error});
      return{all:take(photoReportData(a)),period:take(photoReportData(a,{from:'2026-09-07',to:'2026-09-07',includeUndated:false})),unknown:take(photoReportData(a,{from:'2026-09-07',to:'2026-09-07',includeUndated:true})),phase:take(photoReportData(a,{phase:'방수',query:'화장실2차'})),invalid:take(photoReportData(a,{from:'2026-09-09',to:'2026-09-01'}))};
    },A);
    assert.deepEqual(data.all.ids,['a-old','a-unknown','a-xss','a1','a2','a3','a4','a5'].sort());assert.equal(data.all.total,8);assert.equal(data.all.projectTotal,8);assert.equal(data.all.undatedTotal,1);assert.equal(data.all.dateCount,5);
    assert.deepEqual(data.period.ids,['a-xss','a2','a3'].sort());assert.deepEqual(data.unknown.ids,['a-unknown','a-xss','a2','a3'].sort());assert.deepEqual(data.phase.ids,['a2']);assert(data.invalid.error&&data.invalid.total===0,'invalid period fails closed');await readonly(t,before);
  });
  await run('조회 필터·미확인 날짜·결과0 복귀·결정적 작업 글·복사',async t=>{
    const before=await snap(t.page);await open(t);await expectRows(t,['a-old','a1','a2','a3','a4','a5','a-unknown','a-xss']);
    assert.equal(await t.page.locator('#prText').getAttribute('readonly'),'');assert(await t.page.locator('#prCount').getAttribute('aria-live'));
    await fillDate(t,'#prFrom','2026-09-07');await fillDate(t,'#prTo','2026-09-07');await t.page.locator('#prUndated').uncheck();await expectRows(t,['a2','a3','a-xss']);
    await t.page.locator('#prPhase').selectOption('방수');await expectRows(t,['a2']);const text=await t.page.locator('#prText').inputValue();
    assert(text.includes('화장실 2차 방수'));assert(!text.includes('다른현장비공개'));assert(!text.includes('화장실 1차 방수'));assert(!text.includes('FAKE-PRIVATE-CONTACT'));
    assert.equal(await t.page.evaluate(a=>photoReportText(a,photoReportData(a,{from:'2026-09-07',to:'2026-09-07',phase:'방수',includeUndated:false})),A),text);
    assert.deepEqual(await t.page.evaluate(()=>window.__reportCopies),[]);await t.page.locator('#prCopy').click();assert.deepEqual(await t.page.evaluate(()=>window.__reportCopies),[text]);
    await t.page.locator('#prQuery').fill('찾을수없는가상단어');await expectRows(t,[]);assert((await t.page.locator('#prResults').innerText()).includes('없'));
    await t.page.locator('#prReset').click();await expectRows(t,['a-old','a1','a2','a3','a4','a5','a-unknown','a-xss']);await close(t);await readonly(t,before);
  });
  await run('사진 선택 최대4·필터 숨김 선택 제거·전역 선택 독립',async t=>{
    const before=await snap(t.page);await open(t);assert.equal(await t.page.locator('.prPhotoPick:checked').count(),0);assert(await t.page.locator('#prImg').isDisabled());
    for(const id of ['a1','a2','a3','a4'])await t.page.locator('.prPhotoPick[data-id="'+id+'"]').check();
    const fifth=t.page.locator('.prPhotoPick[data-id="a5"]');if(!await fifth.isDisabled())await fifth.click();assert.equal(await t.page.locator('.prPhotoPick:checked').count(),4);
    await t.page.locator('#prQuery').fill('화장실');await expectRows(t,['a1','a2']);assert.deepEqual(await t.page.locator('.prPhotoPick:checked').evaluateAll(els=>els.map(e=>e.dataset.id).sort()),['a1','a2']);
    await t.page.locator('#prReset').click();assert.equal(await t.page.locator('.prPhotoPick[data-id="a3"]').isChecked(),false,'hidden choice does not silently reappear');
    await close(t);await readonly(t,before);
  });
  await run('현장 선택 검색·보관 현장 명시 선택과 선택 초기화',async t=>{
    const before=await snap(t.page);await open(t);await t.page.locator('.prPhotoPick[data-id="a2"]').check();await t.page.locator('#prChange').click();await t.page.locator('#prProjectSearch').waitFor();
    assert.equal(await t.page.locator('.prPick[data-n="'+ARCHIVE+'"]').count(),0);await t.page.locator('#prArchived').check();assert.equal(await t.page.locator('.prPick[data-n="'+ARCHIVE+'"]').count(),1);
    await t.page.locator('#prProjectSearch').fill('가상나아파트');assert.deepEqual(await t.page.locator('.prPick').evaluateAll(els=>els.map(e=>e.dataset.n)),[B]);
    await t.page.locator('.prPick[data-n="'+B+'"]').click();await expectRows(t,['b1']);assert.equal(await t.page.locator('.prPhotoPick:checked').count(),0);await close(t);await readonly(t,before);
  });
  await run('전역 중복ID·미지정ID 사진은 보고서 이미지 선택 불가',async t=>{
    await t.page.evaluate(({a,b})=>{const base=state.files.find(f=>f.id==='a2');state.files.push({...base,project:b,size:9001},{...base,id:'a3',size:9002},{...base,id:'',size:9003},{...base,id:null,size:9004});},{a:A,b:B});
    const before=await snap(t.page);await imageStub(t);await open(t);
    const guarded=await t.page.locator('.prPhotoPick').evaluateAll(els=>els.filter(e=>['a2','a3','','null'].includes(e.dataset.id||'')).map(e=>({id:e.dataset.id||'',disabled:e.disabled})));
    assert(guarded.length>=5&&guarded.every(e=>e.disabled),'ambiguous or missing ids cannot be selected');
    for(const ids of [['a2'],['a3'],[''],[null]])await t.page.evaluate(async({a,ids})=>{try{await photoReportImage(a,ids);}catch(_){}},{a:A,ids});
    assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),[],'direct calls also reject ambiguous ids');if(await t.page.locator('#modalRoot .modal').count())await close(t);await readonly(t,before);
  });
  await run('썸네일은 기존 raster data만 사용하고 외부·SVG·blob 요청 차단',async t=>{
    await t.page.evaluate(()=>{state.files.find(f=>f.id==='a1').thumb='https://fake-report-image.invalid/private.png';state.files.find(f=>f.id==='a2').thumb='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="window.__reportXss=1"/>';state.files.find(f=>f.id==='a3').thumb='blob:https://fake-report-image.invalid/unknown';});
    const before=await snap(t.page);await open(t);
    for(const id of ['a1','a2','a3']){const label=t.page.locator('.prPhotoPick[data-id="'+id+'"]').locator('..');assert.equal(await label.locator('img').count(),0);assert.equal(await label.locator('.pr-placeholder').count(),1);}
    assert.equal(await t.page.locator('.prPhotoPick[data-id="a4"]').locator('..').locator('img.pr-thumb').count(),1);
    const safe=await t.page.evaluate(png=>({valid:photoReportThumb({thumb:'data:image/png;base64,'+png}),bad:[null,5,'https://fake.invalid/image.png','data:image/svg+xml;base64,PHN2Zy8+','blob:fake','javascript:alert(1)'].map(thumb=>photoReportThumb({thumb}))}),PNG);
    assert(safe.valid.includes('<img'));assert(safe.bad.every(x=>!x.includes('<img')&&x.includes('pr-placeholder')));await close(t);await readonly(t,before);
  });
  await run('AI 실행 동의·필터 범위만 전송·닫은 뒤 응답 무시',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{window.__geminiKey='FAKE-LOCAL-TEST-NOT-A-KEY';geminiAsk=prompt=>{window.__reportAI.push(String(prompt));return new Promise(resolve=>window.__reportAIResolve=resolve);};const original=photoReportAISummary;photoReportAISummary=function(){window.__reportPending=Promise.resolve(original.apply(this,arguments));return window.__reportPending;};});
    await open(t);await t.page.locator('#prQuery').fill('화장실2차');await expectRows(t,['a2']);await t.page.locator('#prAI').click();await t.page.locator('#prAIConfirm').waitFor();assert.deepEqual(await t.page.evaluate(()=>window.__reportAI),[]);
    await close(t);assert.deepEqual(await t.page.evaluate(()=>window.__reportAI),[]);
    await open(t);await t.page.locator('#prQuery').fill('화장실2차');await expectRows(t,['a2']);await t.page.locator('#prAI').click();await t.page.locator('#prAIRun').click();
    await t.page.waitForFunction(()=>window.__reportAI.length===1);const prompt=await t.page.evaluate(()=>window.__reportAI[0]);assert(prompt.includes('화장실 2차 방수'));assert(!prompt.includes('다른현장비공개')&&!prompt.includes('FAKE-PRIVATE-CONTACT')&&!prompt.includes('화장실 1차 방수'));
    await close(t);await t.page.evaluate(async()=>{openModal('가상 다음 창','<div id="fakeNextReport">이 화면 유지</div>');window.__reportNextModal=document.querySelector('#modalRoot .modal');window.__reportAIResolve('가상 늦은 AI 결과');await window.__reportPending;});
    assert(await t.page.evaluate(()=>document.querySelector('#modalRoot .modal')===window.__reportNextModal));assert.equal(await t.page.locator('#fakeNextReport').innerText(),'이 화면 유지');await close(t);await readonly(t,before);
  });
  await run('AI 처리 중 필터 변경은 옛 결과를 무효화하고 중복 요청 차단',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{window.__geminiKey='FAKE-LOCAL-TEST-NOT-A-KEY';geminiAsk=prompt=>{window.__reportAI.push(String(prompt));return new Promise(resolve=>window.__reportAIResolve=resolve);};const original=photoReportAISummary;photoReportAISummary=function(){window.__reportPending=Promise.resolve(original.apply(this,arguments));return window.__reportPending;};});
    await open(t);await t.page.locator('#prQuery').fill('화장실2차');await expectRows(t,['a2']);await t.page.locator('#prAI').click();await t.page.locator('#prAIRun').waitFor();
    await t.page.evaluate(()=>{const button=document.getElementById('prAIRun');button.click();button.click();});await t.page.waitForFunction(()=>window.__reportAI.length===1);
    await t.page.locator('#prQuery').waitFor();await t.page.locator('#prQuery').fill('거실확장');await expectRows(t,['a3']);await t.page.evaluate(()=>window.__reportFilteredModal=document.querySelector('#modalRoot .modal'));
    await t.page.evaluate(async()=>{window.__reportAIResolve('가상 변경 전 응답');await window.__reportPending;});
    assert(await t.page.evaluate(()=>document.querySelector('#modalRoot .modal')===window.__reportFilteredModal),'late result must not replace changed filter view');assert.equal(await t.page.locator('#prQuery').inputValue(),'거실확장');await expectRows(t,['a3']);assert.equal(await t.page.evaluate(()=>window.__reportAI.length),1);await close(t);await readonly(t,before);
  });
  await run('AI 정상 초안은 escape하고 실패는 원래 화면에서 재시도 가능',async t=>{
    const before=await snap(t.page);await t.page.evaluate(()=>{window.__geminiKey='FAKE-LOCAL-TEST-NOT-A-KEY';window.__reportAiFail=false;geminiAsk=prompt=>{window.__reportAI.push(String(prompt));if(window.__reportAiFail)return Promise.reject(new Error('FAKE_AI_FAILURE'));return new Promise(resolve=>window.__reportAIResolve=resolve);};const original=photoReportAISummary;photoReportAISummary=function(){window.__reportPending=Promise.resolve(original.apply(this,arguments));return window.__reportPending;};});
    await open(t);await t.page.locator('#prAI').click();await t.page.locator('#prAIRun').click();await t.page.waitForFunction(()=>window.__reportAI.length===1);
    await t.page.locator('.prPhotoPick[data-id="a2"]').check();await t.page.evaluate(x=>window.__reportAIResolve('가상 AI 초안 '+x),X);await t.page.waitForFunction(()=>document.getElementById('modalTitle')?.textContent.startsWith('AI 초안'));
    assert((await t.page.locator('textarea[aria-label="AI 초안 글"]').inputValue()).includes(X),'image-only selection changes do not invalidate record-text AI result');assert.equal(await t.page.locator('#modalRoot img').count(),0);assert.deepEqual(await t.page.evaluate(()=>window.__reportCopies),[]);await close(t);
    await t.page.evaluate(()=>window.__reportAiFail=true);await open(t);await t.page.locator('#prAI').click();await t.page.locator('#prAIRun').click();await t.page.waitForFunction(()=>window.__reportAI.length===2&&!document.getElementById('prAIRun')?.disabled);
    assert(await t.page.locator('#photoReportPanel').isVisible());await close(t);await readonly(t,before);
  });
  await run('선택 사진만 이미지 미리보기·부분실패·명시저장·URL 회수',async t=>{
    const before=await snap(t.page);await imageStub(t,{fail:['a3']});await open(t);for(const id of ['a2','a3'])await t.page.locator('.prPhotoPick[data-id="'+id+'"]').check();
    await t.page.locator('#prImg').click();await t.page.locator('#prImageCanvas').waitFor();
    assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),['a2','a3']);assert.deepEqual(await t.page.evaluate(()=>window.__reportDrawn),['a2']);assert.deepEqual(await t.page.evaluate(()=>window.__reportExports),[]);
    const status=await t.page.locator('#prImageStatus').innerText();assert(status.includes('1')&&/실패|제외|불러오지/.test(status),'partial load is disclosed');
    assert(await t.page.evaluate(()=>window.__reportCreated.every(url=>window.__reportRevoked.includes(url))),'loaded image object URLs are released');
    await t.page.getByRole('button',{name:'이미지 저장·공유',exact:true}).click();await t.page.waitForFunction(()=>window.__reportExports.length===1);await capture(t,'photo-report-image');await close(t);await readonly(t,before);
  });
  await run('불완전 ID·다른 현장·전체 이미지 실패는 반출하지 않음',async t=>{
    const before=await snap(t.page);await imageStub(t,{fail:['a1','a2','a3','a4','a5']});
    for(const ids of [[],['b1'],['missing'],['a1','a1'],['a1','a2','a3','a4','a5']])await t.page.evaluate(async({a,ids})=>{try{await photoReportImage(a,ids);}catch(_){}},{a:A,ids});
    assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),[],'invalid selections do not touch images');
    await t.page.evaluate(a=>photoReportImage(a,['a1','a2']),A);assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),['a1','a2']);assert.equal(await t.page.locator('#prImageCanvas').count(),0);assert.deepEqual(await t.page.evaluate(()=>window.__reportExports),[]);
    if(await t.page.locator('#modalRoot .modal').count())await close(t);await readonly(t,before);
  });
  await run('이미지 준비 중 닫으면 늦은 미리보기·저장 없이 URL 회수',async t=>{
    const before=await snap(t.page);await imageStub(t,{deferred:true});await t.page.evaluate(()=>{const original=photoReportImage;photoReportImage=function(){window.__reportImagePending=Promise.resolve(original.apply(this,arguments));return window.__reportImagePending;};});
    await open(t);await t.page.locator('.prPhotoPick[data-id="a2"]').check();await t.page.locator('#prImg').click();await t.page.waitForFunction(()=>typeof window.__reportLoadRelease==='function');await close(t);
    await t.page.evaluate(()=>{openModal('가상 다른 창','<div id="fakeAfterImage">다음 화면 유지</div>');window.__reportNextModal=document.querySelector('#modalRoot .modal');});
    await t.page.evaluate(async()=>{window.__reportLoadRelease();await window.__reportImagePending;});
    assert(await t.page.evaluate(()=>document.querySelector('#modalRoot .modal')===window.__reportNextModal));assert.equal(await t.page.locator('#fakeAfterImage').innerText(),'다음 화면 유지');
    assert.deepEqual(await t.page.evaluate(()=>window.__reportExports),[]);assert(await t.page.evaluate(()=>window.__reportCreated.every(url=>window.__reportRevoked.includes(url))));await close(t);await readonly(t,before);
  });
  await run('이미지 준비 중 선택 변경은 이전 결과를 폐기하고 실행 중복 차단',async t=>{
    const before=await snap(t.page);await imageStub(t,{deferred:true});await t.page.evaluate(()=>{const original=photoReportImage;photoReportImage=function(){window.__reportImagePending=Promise.resolve(original.apply(this,arguments));return window.__reportImagePending;};});
    await open(t);await t.page.locator('.prPhotoPick[data-id="a2"]').check();await t.page.locator('#prImg').click();await t.page.waitForFunction(()=>typeof window.__reportLoadRelease==='function');
    await t.page.locator('.prPhotoPick[data-id="a2"]').uncheck();await t.page.locator('.prPhotoPick[data-id="a3"]').check();assert(await t.page.locator('#prImg').isDisabled());
    await t.page.evaluate(()=>document.getElementById('prImg').onclick());assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),['a2']);
    await t.page.evaluate(async()=>{window.__reportLoadRelease();await window.__reportImagePending;});assert.equal(await t.page.locator('#prImageCanvas').count(),0);assert(await t.page.locator('#photoReportPanel').isVisible());
    assert.equal(await t.page.locator('#prImg').isDisabled(),false);assert.deepEqual(await t.page.locator('.prPhotoPick:checked').evaluateAll(els=>els.map(e=>e.dataset.id)),['a3']);assert(await t.page.evaluate(()=>window.__reportCreated.every(url=>window.__reportRevoked.includes(url))));await close(t);await readonly(t,before);
  });
  await run('기존 진행 이미지도 로더 계약·최근4장·중립 문구·캔버스 범위 유지',async t=>{
    await t.page.evaluate(()=>{const base=state.files.find(f=>f.id==='a2');for(let i=0;i<5;i++)state.files.push({...base,id:'same-day-'+i,name:'fake-same-day-'+i+'.png',size:9100+i,when:new Date(Date.UTC(2026,8,10,1+i))});});
    const before=await snap(t.page);await imageStub(t);await t.page.evaluate(()=>{
      window.__legacyBounds=[];window.__legacyNeutral=false;window.__legacyUnsupportedClaim=false;
      const originalDraw=CanvasRenderingContext2D.prototype.drawImage,originalText=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.drawImage=function(img,...a){if(img.__fakeReportId&&a.length===8)window.__legacyBounds.push({id:img.__fakeReportId,bottom:a[5]+a[7],canvasHeight:this.canvas.height});return originalDraw.call(this,img,...a);};
      CanvasRenderingContext2D.prototype.fillText=function(text,...a){if(String(text).includes('별도 확인'))window.__legacyNeutral=true;if(String(text).includes('순조롭게 진행'))window.__legacyUnsupportedClaim=true;return originalText.call(this,text,...a);};
    });
    await t.page.evaluate(a=>makeProgressReport(a),A);
    assert.deepEqual(await t.page.evaluate(()=>window.__reportLoads),['same-day-4','same-day-3','same-day-2','same-day-1'],'legacy chooses latest four photos including intra-day timestamps');
    assert.deepEqual(await t.page.evaluate(()=>window.__reportDrawn),['same-day-4','same-day-3','same-day-2','same-day-1']);assert.equal(await t.page.evaluate(()=>window.__reportExports.length),1);
    assert(await t.page.evaluate(()=>window.__legacyNeutral&&!window.__legacyUnsupportedClaim));assert(await t.page.evaluate(()=>window.__legacyBounds.length===4&&window.__legacyBounds.every(x=>x.bottom<=x.canvasHeight-150)),'all photos remain above footer text');
    assert(await t.page.evaluate(()=>window.__reportCreated.length===4&&window.__reportCreated.every(url=>window.__reportRevoked.includes(url))));await readonly(t,before);
  });
  for(const width of [320,390,1280])await run('모바일·PC 접근성·IME·XSS·닫기·44px',async t=>{
    const before=await snap(t.page);await open(t);await t.page.locator('#prQuery').focus();
    await t.page.evaluate(()=>{const e=document.getElementById('prQuery');window.__reportIme=e;e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='거실확장';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'거실확장',inputType:'insertCompositionText'}));});
    assert(await t.page.evaluate(()=>document.getElementById('prQuery')===window.__reportIme&&document.activeElement===window.__reportIme));
    await t.page.evaluate(()=>document.getElementById('prQuery').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'거실확장'})));await expectRows(t,['a3']);
    await t.page.locator('#prReset').click();assert.equal(await t.page.locator('#photoReportPanel img[src="x"]').count(),0);assert.equal(await t.page.evaluate(()=>window.__reportXss),0);
    const bad=await t.page.locator('#modalRoot button:visible,#photoReportPanel select:visible,#photoReportPanel input:not([type=checkbox]):visible').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,w:r.width,h:r.height,named:!!(e.getAttribute('aria-label')||e.labels?.length||e.textContent.trim())};}).filter(x=>x.w<43.5||x.h<43.5||!x.named));assert.deepEqual(bad,[],'controls are labeled and at least44px');
    const overflow=await t.page.locator('#photoReportPanel,#prResults,#prText').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,left:r.left,right:r.right};}).filter(r=>r.left< -1||r.right>innerWidth+1));assert.deepEqual(overflow,[]);
    await t.page.locator('#photoReportPanel').evaluate(e=>e.closest('.mbody').scrollTop=0);await capture(t,'photo-report');
    if(width===390){for(const id of ['a2','a3'])await t.page.locator('.prPhotoPick[data-id="'+id+'"]').check();await t.page.locator('#prImg').scrollIntoViewIfNeeded();await capture(t,'photo-report-selected');await t.page.locator('#prText').scrollIntoViewIfNeeded();await capture(t,'photo-report-text');
      await t.page.evaluate(()=>document.body.classList.add('a11y-big2'));
      const largeOverflow=await t.page.locator('#photoReportPanel,#prResults,#prText,#prFrom,#prTo,#prPhase,#prQuery,#prReset').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth};}).filter(r=>r.left< -1||r.right>innerWidth+1||r.scroll>r.client+2));assert.deepEqual(largeOverflow,[],'large-text controls and report remain within the screen');
      await t.page.locator('#photoReportPanel').evaluate(e=>e.closest('.mbody').scrollTop=0);await capture(t,'photo-report-big2');await t.page.evaluate(()=>document.body.classList.remove('a11y-big2'));}
    await close(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);await readonly(t,before);
  },width);
  console.log('== photo-report: '+passed+' passed; pageerrors=0; real exports/network=0 ==');await browser.close();
})().catch(async e=>{console.error('FAIL photo-report',e);if(browser)await browser.close();process.exitCode=1;});

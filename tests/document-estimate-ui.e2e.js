/* Local UI regression: fake documents only; no original reads, external account or downloads.
   HJ_DOCUMENT_ESTIMATE_MUTATION=css|filter must fail a real layout/read-only assertion. */
'use strict';
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const MUTATION=process.env.HJ_DOCUMENT_ESTIMATE_MUTATION||'';
assert(['','css','filter'].includes(MUTATION));
const A='가상 가아파트',B='가상 나아파트',X='<img src=x onerror=window.__documentXss=1>';
const IDS=['fake-alpha','fake-beta','fake-gamma','fake-unknown'];
let browser,passed=0;
async function boot(width=390,forced=false){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[],requests=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async({a,b,x,forced,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure();coworkSchedEnsure();aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    const p=name=>({name,stage:1,received:12345,phases:[],cost:{material:1000,labor:2000,outsource:0},customer:{},archived:false});
    state.projects=[p(a),p(b)];state.quotes=[];state.aptOrders=[];state.schedule=[];
    state.payLog=[{id:'fake-pay',project:a,amount:12345,date:'2026-09-01'}];state.expenses=[];
    const f=(id,name,project,amount,date,extra={})=>({id,name,prefix:'가상 견적/',kind:'estimate',ext:'pdf',size:100+amount,
      project,when:date?new Date(date+'T00:00:00Z'):null,sourceModifiedAt:date?date+'T00:00:00.000Z':null,
      est:{customer:'가상 고객 '+id,amount,supply:amount-100,vat:100,date,bizno:'FAKE-NOT-A-BUSINESS-NUMBER'},...extra});
    state.files=[f('fake-alpha','가상 알파 배관 견적서.pdf',a,440000,'2026-09-01'),
      f('fake-beta','가상 베타 방수 견적서.pdf',null,220000,'2026-09-05'),
      f('fake-gamma','가상 감마 미장 견적서.pdf',b,880000,'2026-09-03',{exSum:true}),
      f('fake-unknown',x+'긴파일명이여러줄로표시되어도관리버튼이화면밖으로나가지않아야합니다'.repeat(3)+'.pdf',null,110000,'',{est:{customer:x,amount:110000,date:'',bizno:x}}),
      {id:'fake-biz',name:'가상 사업자등록 서류.pdf',prefix:'가상 서류/',kind:'bizreg',ext:'pdf',size:551,project:a,when:new Date('2026-09-01T00:00:00Z')},
      {id:'fake-other',name:'가상 기타 관리 안내.pdf',prefix:'가상 서류/',kind:'other',ext:'pdf',size:552,project:b,when:null},
      {id:'fake-photo',name:'가상 작업 사진.jpg',kind:'photo',ext:'jpg',size:33,project:a,when:null,_virtual:true}];
    state.editingQuote=null;state.activeProject=null;state.tab='estimates';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('fake-photo');__gdToken=null;relayReady=()=>false;
    if(forced)document.body.classList.add('mobile-mode');
    window.__documentXss=0;window.__documentCalls=[];window.__documentMutation=0;window.__documentDirty=0;window.__documentReads=0;
    relayCall=async()=>{window.__documentCalls.push('relay');throw new Error('unexpected relay');};portalAutoSync=()=>window.__documentCalls.push('portal');
    getFileOf=async()=>{window.__documentReads++;return null;};
    ensureXLSX=async()=>{};window.XLSX={utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:rows=>({rows:structuredClone(rows)}),
      book_append_sheet:(wb,sheet,name)=>wb.sheets.push({name,sheet})},writeFile:wb=>{window.__documentExport=structuredClone(wb);}};
    render();clearTimeout(__idbSaveTimer);if(!await guardedPersistCurrentState())throw new Error('fixture persistence failed');await __appStateWriteQueue;
    const originalDirty=markDirty;markDirty=function(){window.__documentDirty++;return originalDirty.apply(this,arguments);};
    if(mutation==='filter'){const original=viewEstimates;viewEstimates=function(){if(__estimateListUI.search){state.files[0].est.amount++;window.__documentMutation++;}return original.apply(this,arguments);};}
    if(mutation==='css'){const s=document.createElement('style');s.textContent='.documents-view .document-list.grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}';document.head.appendChild(s);window.__documentMutation++;}
  },{a:A,b:B,x:X,forced,mutation:MUTATION});
  observe=true;return{context,page,errors,requests,width,forced};
}
async function run(name,fn,width=390,forced=false){const t=await boot(width,forced);try{await fn(t);assert.deepEqual(t.errors,[]);passed++;console.log('PASS '+width+'px'+(forced?' forced-mobile':'')+' '+name);}finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__documentMutation).catch(()=>0));await t.context.close();}}
const snap=page=>page.evaluate(async()=>{const data=serializeData();data.savedAt='FIXED';return{
  data:JSON.stringify(data),metadata:JSON.stringify(state.files),selected:[...__sel],dirty:state.dirty,
  dirtyCalls:window.__documentDirty,stored:JSON.stringify(await idbGet('appState'))};});
async function readonly(t,before){assert(isDeepStrictEqual(await snap(t.page),before),'query/details/layout must not change files, estimates, projects, payments, selection or saved state');assert.deepEqual(await t.page.evaluate(()=>window.__documentCalls),[]);assert.deepEqual(t.requests,[],'UI-only actions issue no network requests');assert.equal(await t.page.evaluate(()=>window.__documentXss),0);}
async function view(t,tab){await t.page.evaluate(tab=>{state.tab=tab;render();},tab);await t.page.locator(tab==='docs'?'.documents-view':'.estimates-view').waitFor();}
const rowIds=page=>page.locator('.estimates-list tbody tr[data-id]').evaluateAll(els=>els.map(e=>e.dataset.id));
async function expectRows(t,ids){try{await t.page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('.estimates-list tbody tr[data-id]')].map(e=>e.dataset.id))===JSON.stringify(ids),ids);}catch(e){console.error('ROW DIAGNOSTIC',JSON.stringify(await t.page.evaluate(()=>({ui:__estimateListUI,global:state.search,input:document.getElementById('estimateListSearch')?.value,ids:[...document.querySelectorAll('.estimates-list tbody tr[data-id]')].map(e=>e.dataset.id)}))));throw e;}assert.deepEqual(await rowIds(t.page),ids);}
async function touchTargets(page,scope){const controls=await page.locator(scope+' button:visible,'+scope+' select:visible,'+scope+' input:visible,'+scope+' summary:visible').evaluateAll(els=>els.map(e=>({tag:e.tagName,id:e.id||e.dataset.ef||e.dataset.preview||e.textContent.trim().slice(0,30),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,
  name:!!(e.labels&&e.labels.length||e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent.trim())})));
  assert(controls.length>0);for(const c of controls){assert(c.w>=43.5&&c.h>=43.5,'44px touch target: '+JSON.stringify(c));assert(c.name,'accessible control name: '+JSON.stringify(c));}}
async function noOverflow(page,scope,width){const bad=await page.locator(scope).evaluateAll((els,width)=>els.map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,cls:e.className,left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth};}).filter(r=>r.left< -1||r.right>width+1||r.tag!=='INPUT'&&r.scroll>r.client+2),width);assert.deepEqual(bad,[],'new UI content stays inside viewport; text inputs may scroll their editable value internally');}
async function closeModal(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
async function capture(t,name){if(!process.env.HJ_DOCUMENT_ESTIMATE_SCREENSHOT_DIR)return;await t.page.waitForFunction(()=>{const e=document.getElementById('toast');return !e||!e.classList.contains('show')&&Number(getComputedStyle(e).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_DOCUMENT_ESTIMATE_SCREENSHOT_DIR,name+'-'+t.width+(t.forced?'-forced':'')+'.png')});}
(async()=>{browser=await chromium.launch({headless:true});
  await run('견적 검색·상태·정렬은 조회 전용이며 합계·엑셀 기준 보존',async t=>{
    const before=await snap(t.page);await expectRows(t,IDS);
    const totals=await t.page.locator('.estimates-view .sumbar').allTextContents();
    await t.page.locator('#btnXlsx').click();const exported=await t.page.evaluate(()=>window.__documentExport);
    await t.page.locator('#estimateListSearch').fill('베타');await expectRows(t,['fake-beta']);await readonly(t,before);
    assert((await t.page.locator('#estimateListCount').innerText()).includes('1'));
    await t.page.locator('#btnXlsx').click();assert.deepEqual(await t.page.evaluate(()=>window.__documentExport),exported,'export still includes all rows while filtered');
    assert.deepEqual(await t.page.locator('.estimates-view .sumbar').allTextContents(),totals,'totals do not become filtered totals');
    await t.page.locator('#estimateListSearch').fill(A);await expectRows(t,['fake-alpha']);
    await t.page.locator('#estimateListReset').click();await expectRows(t,IDS);
    await t.page.locator('#estimateListStatus').selectOption('unassigned');await expectRows(t,['fake-beta','fake-unknown']);
    await t.page.locator('#estimateListStatus').selectOption('excluded');await expectRows(t,['fake-gamma']);
    await t.page.locator('#estimateListReset').click();await t.page.locator('#estimateListSort').selectOption('date');await expectRows(t,['fake-beta','fake-gamma','fake-alpha','fake-unknown']);
    await t.page.locator('#estimateListSort').selectOption('amount');await expectRows(t,['fake-gamma','fake-alpha','fake-beta','fake-unknown']);
    await t.page.locator('#estimateListSearch').fill('가상에없는검색값');await expectRows(t,[]);
    assert((await t.page.locator('.estimates-view').innerText()).includes('없'));
    await t.page.locator('#estimateListReset').click();await expectRows(t,IDS);
    assert.deepEqual(await t.page.evaluate(()=>__estimateListUI),{search:'',status:'all',sort:'original'});
    await readonly(t,before);
  });
  await run('키보드 상세 토글·검색 후 열린 상태 유지·금액은 상시 표시',async t=>{
    const before=await snap(t.page),detail=t.page.locator('details[data-estimate-details="fake-alpha"]');
    assert.equal(await detail.getAttribute('open'),null);assert(await t.page.locator('input[data-ef="amount"][data-id="fake-alpha"]').isVisible());
    await detail.locator('summary').focus();await t.page.keyboard.press('Enter');assert(await detail.evaluate(e=>e.open));
    for(const field of ['customer','date','bizno'])assert(await detail.locator('[data-ef="'+field+'"]').isVisible());
    await t.page.locator('#estimateListSearch').fill('베타');await expectRows(t,['fake-beta']);
    await t.page.locator('#estimateListReset').click();await expectRows(t,IDS);assert(await detail.evaluate(e=>e.open));
    await t.page.locator('#estimateListSort').selectOption('amount');assert(await detail.evaluate(e=>e.open));
    await detail.locator('summary').focus();await t.page.keyboard.press('Space');assert.equal(await detail.evaluate(e=>e.open),false);
    assert.equal(await t.page.locator('.estimates-view img').count(),0);assert((await t.page.locator('.estimates-view').innerText()).includes(X));
    await readonly(t,before);
  });
  await run('한글 조합 중 검색 DOM·초점 유지 및 조합 종료 후 적용',async t=>{
    const before=await snap(t.page);await t.page.locator('#estimateListSearch').focus();
    await t.page.evaluate(()=>{const el=document.getElementById('estimateListSearch');window.__documentImeInput=el;el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));});
    for(const text of ['베','베타']){
      await t.page.evaluate(text=>{const el=document.getElementById('estimateListSearch');el.value=text;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:text,isComposing:true}));},text);
      assert(await t.page.evaluate(()=>document.getElementById('estimateListSearch')===window.__documentImeInput&&document.activeElement===window.__documentImeInput),'IME composition keeps the original focused input node');
      assert.equal(await t.page.locator('#estimateListSearch').inputValue(),text);await expectRows(t,IDS);
    }
    await t.page.evaluate(()=>document.getElementById('estimateListSearch').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'베타'})));
    await expectRows(t,['fake-beta']);assert.equal(await t.page.locator('#estimateListSearch').inputValue(),'베타');
    assert.equal(await t.page.evaluate(()=>document.activeElement.id),'estimateListSearch');await readonly(t,before);
  });
  await run('기존 상세입력 수정 후 열린 상태 및 다른 금액·기록 보존',async t=>{
    const detail=t.page.locator('details[data-estimate-details="fake-alpha"]');await detail.locator('summary').click();
    const before=await t.page.evaluate(()=>({files:JSON.stringify(state.files),projects:JSON.stringify(state.projects),pay:JSON.stringify(state.payLog)}));
    const input=detail.locator('[data-ef="customer"]');await input.fill('가상 수정 고객');await input.press('Tab');
    await t.page.waitForFunction(()=>state.files.find(f=>f.id==='fake-alpha').est.customer==='가상 수정 고객');
    assert(await detail.evaluate(e=>e.open));assert.equal(await detail.locator('[data-ef="customer"]').inputValue(),'가상 수정 고객');
    assert.deepEqual(await t.page.evaluate(()=>({field:document.activeElement.dataset.ef,id:document.activeElement.dataset.id})),{field:'date',id:'fake-alpha'},'Tab continues to the next field in the same estimate');
    const after=await t.page.evaluate(()=>({files:JSON.stringify(state.files),projects:JSON.stringify(state.projects),pay:JSON.stringify(state.payLog),dirty:state.dirty,dirtyCalls:window.__documentDirty}));
    const expected=JSON.parse(before.files);expected[0].est.customer='가상 수정 고객';expected[0].est._edited=true;
    assert.deepEqual(JSON.parse(after.files),expected);assert.equal(after.projects,before.projects);assert.equal(after.pay,before.pay);assert(after.dirty);assert.equal(after.dirtyCalls,1);
    await detail.locator('[data-ef="date"]').fill('2026-09-06');await detail.locator('[data-ef="date"]').press('Tab');
    await t.page.waitForFunction(()=>document.activeElement.dataset.ef==='bizno'&&document.activeElement.dataset.id==='fake-alpha');
    assert(await detail.evaluate(e=>e.open));assert.equal(await detail.locator('[data-ef="date"]').inputValue(),'2026-09-06');
    expected[0].est.date='2026-09-06';assert.deepEqual(await t.page.evaluate(()=>JSON.parse(JSON.stringify(state.files))),expected);assert.equal(await t.page.evaluate(()=>window.__documentDirty),2,'each confirmed field change marks dirty once');
    assert.deepEqual(t.requests,[]);assert.equal(await t.page.evaluate(()=>window.__documentXss),0);
  });
  await run('서류 검색 해제와 기존 미리보기·프로젝트 모달 진입 취소',async t=>{
    await view(t,'docs');const before=await snap(t.page);
    assert.equal(await t.page.locator('.document-row.card').count(),6);assert.equal(await t.page.locator('.document-row[data-id="fake-photo"]').count(),0);
    const card=t.page.locator('.document-row[data-id="fake-alpha"]');
    assert.equal(await card.locator('.thumb').count(),1);assert.equal(await card.locator('.meta').count(),1);assert.equal(await card.locator('.cardact').count(),1);
    for(const selector of ['[data-preview="fake-alpha"]','[data-rename="fake-alpha"]','[data-fcopy="fake-alpha"]','[data-fdel="fake-alpha"]'])assert(await card.locator(selector).count()>0);
    const more=card.locator('details.doc-more');await more.locator('summary').focus();await t.page.keyboard.press('Enter');assert(await more.evaluate(e=>e.open));
    await touchTargets(t.page,'.documents-view');await more.locator('summary').focus();await t.page.keyboard.press('Space');assert.equal(await more.evaluate(e=>e.open),false);
    await card.locator('button[data-preview="fake-alpha"]').click();await t.page.locator('#pvCanvas').waitFor();
    assert((await t.page.locator('#pvCanvas').innerText()).includes('원본 파일을 찾을 수 없습니다'));assert.equal(await t.page.evaluate(()=>window.__documentReads),1);await closeModal(t.page);
    await card.locator('[data-estimate-info="fake-alpha"]').click();await t.page.locator('#estimateInfoPanel').waitFor();
    await t.page.locator('#estimateProject').selectOption({label:B});await closeModal(t.page);assert.equal(await t.page.evaluate(()=>state.files[0].project),A);
    await t.page.evaluate(()=>{state.search='가상에없는검색값';render();});await t.page.locator('#btnClearDocSearch').waitFor();assert.equal(await t.page.locator('.document-row').count(),0);
    await t.page.locator('#btnClearDocSearch').click();assert.equal(await t.page.evaluate(()=>state.search),'');assert.equal(await t.page.locator('.document-row.card').count(),6);
    await readonly(t,before);
  });
  for(const [width,forced] of [[1280,false],[960,false],[390,false],[360,false],[320,false],[1280,true]])await run('서류 가로 카드·견적 4열/폰 2열·44px·긴 이름·XSS',async t=>{
    const before=await snap(t.page);await view(t,'docs');
    const layout=await t.page.locator('.document-list.grid').evaluateAll(els=>els.map(e=>({columns:getComputedStyle(e).gridTemplateColumns.split(/\s+/).length,rows:[...e.querySelectorAll('.document-row')].map(r=>{const box=r.getBoundingClientRect(),thumb=r.querySelector('.thumb').getBoundingClientRect(),meta=r.querySelector('.meta').getBoundingClientRect();return{left:box.left,right:box.right,width:box.width,thumbRight:thumb.right,metaLeft:meta.left,thumbTop:thumb.top,thumbBottom:thumb.bottom,metaTop:meta.top,metaBottom:meta.bottom};})})));
    for(const group of layout){assert.equal(group.columns,1,'documents remain a single-column row list');for(const r of group.rows){assert(r.metaLeft>=r.thumbRight-1,'thumbnail stays beside document metadata');assert(r.thumbTop<r.metaBottom&&r.metaTop<r.thumbBottom,'thumbnail and metadata overlap vertically in a horizontal card');}}
    await touchTargets(t.page,'.documents-view');await noOverflow(t.page,'.document-row,.document-row .meta,.document-row .cardact,.document-row .card-tools',width);
    assert.equal(await t.page.locator('.documents-view img').count(),0);assert((await t.page.locator('.documents-view').innerText()).includes(X));
    if(!forced&&[1280,960,390,320].includes(width))await capture(t,'documents-ui');
    await view(t,'estimates');assert.equal(await t.page.locator('.estimates-list thead th').count(),4);
    const mobile=width<=720||forced;
    const estLayout=await t.page.locator('.estimates-list tbody tr[data-id]').evaluateAll(els=>els.map(e=>({display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns.split(/\s+/).length})));
    if(mobile)for(const r of estLayout){assert.equal(r.display,'grid');assert.equal(r.columns,2,'mobile estimate uses two columns');}
    else for(const r of estLayout)assert.equal(r.display,'table-row');
    await touchTargets(t.page,'.estimates-view');await noOverflow(t.page,'.estimates-list,.estimates-list tbody tr[data-id],.estimates-list td,input[data-ef="amount"]',width);
    if(!forced&&[1280,960,390,320].includes(width))await capture(t,'estimates-ui');
    const details=t.page.locator('details[data-estimate-details="fake-unknown"]');await details.locator('summary').click();
    for(const field of ['customer','date','bizno'])assert(await details.locator('[data-ef="'+field+'"]').isVisible());
    await touchTargets(t.page,'.estimates-view');await noOverflow(t.page,'details.est-row-details,details.est-row-details input',width);
    if(!forced&&[1280,960,390,320].includes(width))await capture(t,'estimates-ui-details');
    await readonly(t,before);
  },width,forced);
  console.log('== document-estimate-ui: '+passed+' passed, pageerrors=0 ==');await browser.close();
})().catch(async e=>{console.error('FAIL document-estimate-ui',e);if(browser)await browser.close();process.exitCode=1;});

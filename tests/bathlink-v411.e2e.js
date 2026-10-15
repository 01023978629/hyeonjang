/* v411: synthetic pre-boot storage only. No live accounts, customer data or external requests.
   --canary (or HJ_BATHLINK_CANARY=1) fails immediately on a baseline without this feature.
   The normal run starts with the same presence assertion; timeouts never count as mutation evidence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',HANDOFF='hj_bath_handoff',PREFILL='hj_bath_prefill',DRAFT='hj_bathroom_consult_v1';
const CANARY=process.argv.includes('--canary')||process.env.HJ_BATHLINK_CANARY==='1';
const A='TEST_BATH_SITE_A',B='TEST_BATH_SITE_B';
// Synthetic historical values exercise the actual fetch/normalize/source path only
// in the two explicit integration scenarios below. Existing v411 scenarios see 404.
const ESTIMATE_TABLE={generatedAt:'2026-10-16T00:00:00.000Z',source:'과거 견적 6건(합성 자료)',vat:'exclusive',items:{
 '욕실 벽 타일(박스)':{price:28000,n:6,min:25000,max:32000},'욕실 벽 타일 시공(㎡)':{price:18000,n:4,min:16000,max:20000},
 '욕실 바닥 타일(박스)':{price:24000,n:4,min:22000,max:26000},'욕실 바닥 타일 시공(㎡)':{price:22000,n:4,min:20000,max:24000},
 '양변기':{price:250000,n:2,min:230000,max:270000,weak:true},'양변기 시공':{price:70000,n:3,min:60000,max:80000},
 '방수·바탕 보수':{price:90000,n:3,min:80000,max:100000}
}};
const field=(page,key)=>page.locator('[data-path="'+key+'"]');
let browser,passed=0;
function appFixture(){return {version:2,app:'현장',savedAt:new Date(Date.now()-60000).toISOString(),files:[],quotes:[],schedule:[],notes:[{id:'TEST_KEEP_NOTE',text:'TEST_KEEP_NOTE'}],contacts:[],payLog:[],
 projects:[A,B].map((name,i)=>({name,stage:1,received:0,phases:[],cost:{},customer:{name:'TEST_CUSTOMER_'+i,addr:'TEST_ADDRESS_'+i,phone:''},archived:false})),
 priceBook:{'욕실 벽 타일(박스)':10000,'욕실 벽 타일 시공(㎡)':20000,'욕실 바닥 타일(박스)':8000,'욕실 바닥 타일 시공(㎡)':15000,'양변기':100000,'양변기 시공':50000,'TEST_UNRELATED_PRICE':98765}};}
function handoff(extra={}){return {at:new Date().toISOString(),version:1,project:A,customer:{name:'TEST_HANDOFF_CUSTOMER',addr:'TEST_HANDOFF_ADDRESS'},place:'TEST_HANDOFF_ADDRESS',vat:'exclusive',method:'full',days:{work:2,unusable:1,start:'TEST_START'},items:[{name:'TEST_HANDOFF_ITEM',spec:'TEST_SPEC',qty:2,price:100,pending:false}],memo:'TEST_HANDOFF_MEMO',total:220,...extra};}
async function turn(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function makeContext(width=390,initial={},estimates=false){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',timezoneId:'Asia/Seoul'}),errors=[];
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==BASE)return route.abort();if(u.pathname==='/__bathlink_seed__')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>synthetic seed</title>'});return route.continue();});
 await context.route('**/bathroom-defaults.json*',route=>route.fulfill(estimates?{status:200,contentType:'application/json',body:JSON.stringify(ESTIMATE_TABLE)}:{status:404,body:''}));
 context.on('page',page=>{page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());});
 const seed=await context.newPage();await seed.goto(BASE+'/__bathlink_seed__');
 await seed.evaluate(async({fixture,initial})=>{
  localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_gcal_auto','0');localStorage.setItem('bathlink_unrelated','TEST_KEEP');
  for(const [key,value]of Object.entries(initial))localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
  await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(fixture,'appState');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 },{fixture:appFixture(),initial});
 await seed.close();return {context,errors,width};
}
async function app(t){
 const page=await t.context.newPage();await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
 assert(await page.evaluate(()=>typeof hjBathHandoffCheck==='function'&&typeof hjBathPrefillOpen==='function'),'BATHLINK_APP_FEATURE_PRESENT');
 await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
 await page.evaluate(async()=>{
  await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);
  // Unrelated delayed seeders are not part of handoff. Drain the real writer before snapshots.
  taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};portalAutoSync=()=>{};aiOpsEnsureState().enabled=false;
  clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;
  const title=document.querySelector('#modalRoot h3');if(title&&!title.textContent.includes('욕실 상담 견적'))closeModal(true);
 });
 await page.waitForFunction(()=>typeof __hjBathReady!=='undefined'&&__hjBathReady);await turn(page);return page;
}
async function bath(t){const page=await t.context.newPage();await page.goto(BASE+'/bathroom.html',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('#sendToApp').count(),1,'BATHLINK_FEATURE_PRESENT');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');return page;}
async function snapshot(page){return page.evaluate(async()=>{await __appStateWriteQueue;const clean=value=>{if(value==null)return value;const d=JSON.parse(JSON.stringify(value));delete d.savedAt;return d;};const data=clean(serializeData()),pointer=await idbGet('paid_commit_pointer');return {keys:Object.keys(data).sort(),data,stored:clean(await idbGet('appState')),pointer:pointer||null,generation:pointer?clean(await idbGet(pointer)):null,unrelated:localStorage.getItem('bathlink_unrelated')};});}
async function unchanged(page,before,label){const after=await snapshot(page);for(const key of Object.keys(before))assert.deepEqual(after[key],before[key],label+' '+key);}
async function modal(page,title='🛁 욕실 상담 견적 불러오기'){await page.waitForFunction(title=>document.querySelector('#modalRoot h3')?.textContent===title,title);}
const modalButton=(page,text)=>page.locator('#modalRoot .mfoot').getByRole('button',{name:text,exact:true});
async function trigger(page,payload){const raw=JSON.stringify(payload);await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);window.dispatchEvent(new Event('focus'));},{key:HANDOFF,raw});await turn(page);return raw;}
// Explicit synthetic-fixture reset: remove the previous scenario's transfer before
// closing a modal, otherwise its close observer correctly reopens the next pending transfer.
async function clearEditor(page){await page.evaluate(()=>{localStorage.removeItem('hj_bath_handoff');closeModal(true);state.editingQuote=null;state.tab='quotemaker';state.activeProject=null;render();});await turn(page);}
async function geometry(page,selectors){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'BATHLINK_NO_PAGE_OVERFLOW');
 for(const selector of selectors){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await turn(page);const box=await el.boundingBox();assert(box&&box.height>=44&&box.width>=44,'BATHLINK_44PX '+selector);}
}
async function pricedBath(page,inclusive=false,pending=false){
 const raw=await page.evaluate(({inclusive,pending,A})=>{
  const d=HJBath.defaults(),factor=inclusive?1.1:1;d.project=A;d.customer='TEST_HANDOFF_CUSTOMER';d.place='TEST_HANDOFF_ADDRESS';d.vat=inclusive?'inclusive':'exclusive';d.method='overlay';d.days={work:2,unusable:1,start:'TEST_START'};
  d.scope.forEach(s=>s.enabled=false);d.wall.price=10000*factor;d.wall.labor=20000*factor;d.floor.price=8000*factor;d.floor.labor=15000*factor;
  d.consumables[0].enabled=true;d.consumables[0].price=25000*factor;d.consumables[1].enabled=true;d.consumables[1].price=5000*factor;
  Object.assign(d.scope.find(s=>s.id==='toilet'),{enabled:true,qty:2,material:100000*factor,labor:50000*factor,model:'TEST_MODEL <img src=x onerror=alert(1)>'});
  if(pending){Object.assign(d.scope.find(s=>s.id==='basin'),{enabled:true,material:null,labor:null});Object.assign(d.scope.find(s=>s.id==='mirror'),{enabled:true,material:0,labor:0});}
  return d;
 },{inclusive,pending,A});
 // Prices are exact integer won even when the input VAT mode is inclusive.
 for(const k of ['wall','floor'])for(const p of ['price','labor'])raw[k][p]=Math.round(raw[k][p]);for(const c of raw.consumables)c.price=Math.round(c.price);for(const s of raw.scope)for(const p of ['material','labor'])if(s[p]!=null)s[p]=Math.round(s[p]);
 await page.evaluate(({key,raw})=>localStorage.setItem(key,JSON.stringify(raw)),{key:DRAFT,raw});await page.locator('#loadDraft').click();assert.match(await page.locator('#status').textContent(),/저장한 초안을 불러왔습니다/);return raw;
}
async function send(page){await page.locator('#sendToApp').click();const raw=await page.evaluate(key=>localStorage.getItem(key),HANDOFF);assert(raw,'BATHLINK_UI_CREATED_HANDOFF');assert(await page.locator('#openAppLink').isVisible(),'BATHLINK_OPEN_APP_VISIBLE');assert.equal(await page.locator('#openAppLink').getAttribute('href'),'./index.html');assert.notEqual(await page.locator('#openAppLink').getAttribute('target'),'_blank','BATHLINK_APP_LINK_SAME_TAB');return JSON.parse(raw);}
async function quote(page){return page.evaluate(()=>({q:state.editingQuote,total:state.editingQuote?quoteCalc(state.editingQuote).total:null,quotes:state.quotes,keys:Object.keys(serializeData()).filter(k=>k!=='savedAt').sort(),raw:localStorage.getItem('hj_bath_handoff')}));}
async function run(name,fn,width=390,initial={},estimates=false){const t=await makeContext(width,initial,estimates);try{await fn(t);assert.deepEqual(t.errors,[],'NO_PAGE_ERRORS '+name);passed++;console.log('PASS '+name);}finally{await t.context.close();}}
async function uiRoundTrip(t,inclusive=false,pending=false){
 const b=await bath(t);await pricedBath(b,inclusive,pending);const payload=await send(b);assert.equal(payload.total,1078990,'BATHLINK_BATH_TOTAL_INDEPENDENT');assert.equal(payload.customer.name,'TEST_HANDOFF_CUSTOMER');assert.equal(payload.place,'TEST_HANDOFF_ADDRESS');
 const expected=[['욕실 벽 타일(박스)',13,10000],['욕실 벽 타일 시공(㎡)',16.26,20000],['욕실 바닥 타일(박스)',3,8000],['욕실 바닥 타일 시공(㎡)',3.78,15000],['타일 접착제',5,25000],['줄눈재',4,5000],['양변기',2,100000],['양변기 시공',2,50000]];
 for(const [name,qty,price]of expected){const item=payload.items.find(it=>it.name===name);assert(item,'BATHLINK_STANDARD_ITEM '+name);assert.equal(item.qty,qty,'BATHLINK_QTY '+name);assert.equal(item.price,Math.round(price*(inclusive?1.1:1)),'BATHLINK_RAW_PRICE '+name);}
 assert.match(payload.items[0].spec,/300×600.*8장\/박스.*13박스.*104장.*100장/,'BATHLINK_TILE_SPEC');assert(payload.memo.includes('TEST_START')&&payload.memo.includes('2')&&payload.memo.includes('덧방'),'BATHLINK_METHOD_DAYS_MEMO');
 const a=await app(t);await modal(a);const before=await snapshot(a);await a.evaluate(()=>{hjBathHandoffCheck();hjBathHandoffCheck();});assert.equal(await a.locator('#modalRoot .modal').count(),1,'BATHLINK_SINGLE_MODAL');await unchanged(a,before,'BATHLINK_MODAL_READ_ONLY');
 await geometry(a,['#modalRoot .mfoot button:first-child','#modalRoot .mfoot button:last-child']);await modalButton(a,'불러오기').click();await a.locator('#qmTitle').waitFor();const imported=await quote(a);
 assert.equal(imported.q.title,A+' 욕실 견적');assert.equal(imported.q.project,A);assert.equal(imported.q.place,'TEST_HANDOFF_ADDRESS');assert.equal(imported.q.vatIncluded,true);assert.equal(imported.raw,null,'BATHLINK_KEY_CONSUMED');assert.equal(imported.quotes.length,0,'BATHLINK_NOT_SAVED_AUTOMATICALLY');assert.equal(imported.total,1078990,'BATHLINK_APP_TOTAL_INDEPENDENT');assert(Math.abs(imported.total-payload.total)<=1);
 assert.deepEqual(imported.keys,before.keys,'BATHLINK_TOP_KEYS_UNCHANGED');await unchanged(a,before,'BATHLINK_IMPORT_MEMORY_ONLY');
 for(const [name,qty,price]of expected){const item=imported.q.items.find(it=>it.name===name);assert.equal(item.qty,qty);assert.equal(item.price,price,'BATHLINK_SUPPLY_PRICE '+name);assert.equal(item.spec,payload.items.find(it=>it.name===name).spec);}
 if(inclusive)assert(imported.q.memo.includes('부가세 포함 입력값을 공급가로 환산'),'BATHLINK_INCLUSIVE_MEMO');
 if(pending){const unknown=payload.items.filter(it=>it.pending);assert.equal(unknown.length,1,'BATHLINK_COMBINED_PENDING_ROW');assert.equal(unknown[0].price,0);assert.match(unknown[0].spec,/자재\+시공.*단가 확인 필요/);assert.match(imported.q.memo,/단가 확인 필요 1건/);const free=payload.items.filter(it=>it.name.startsWith('거울·수납장'));assert.equal(free.length,2);assert(free.every(it=>it.price===0&&it.pending===false),'BATHLINK_ZERO_IS_NOT_PENDING');}
 await geometry(a,['#qmBathroom']);
}
async function dirtyBranches(t){
 const a=await app(t);await clearEditor(a);
 for(const [branch,label]of [['continue','계속 편집'],['discard','저장 안 하고 새 견적'],['save','저장하고 새 견적']]){
  await clearEditor(a);await a.locator('#qmNew').click();await a.locator('#qmTitle').fill('TEST_DIRTY_'+branch);await a.locator('[data-qi="0"][data-qf="name"]').fill('TEST_OLD_ITEM');await a.locator('[data-qi="0"][data-qf="price"]').fill('500');await a.locator('[data-qi="0"][data-qf="price"]').press('Tab');await a.waitForFunction(()=>Number(state.editingQuote.items[0].price)===500);
  assert(await a.evaluate(()=>quoteEditDirty()),'BATHLINK_DIRTY_FIXTURE');const old=await quote(a),before=await snapshot(a),raw=await trigger(a,handoff({memo:'TEST_'+branch}));await modal(a);await unchanged(a,before,'BATHLINK_DIRTY_PROMPT_READ_ONLY');await modalButton(a,'불러오기').click();await modal(a,'저장하지 않은 견적');
  assert.deepEqual((await quote(a)).q,old.q,'BATHLINK_DIRTY_BEFORE_CHOICE');await modalButton(a,label).click();await turn(a);const after=await quote(a);
  if(branch==='continue'){assert.deepEqual(after.q,old.q,'BATHLINK_CONTINUE_PRESERVES_EDITOR');assert.equal(after.raw,raw);await unchanged(a,before,'BATHLINK_CONTINUE_READ_ONLY');await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await turn(a);assert.equal(await a.locator('#hjBathHandoff').count(),0,'BATHLINK_CONTINUE_SKIPS_SESSION');}
  else{assert.equal(after.q.title,A+' 욕실 견적');assert.equal(after.raw,null);assert.equal(after.quotes.filter(q=>q.id===old.q.id).length,branch==='save'?1:0,'BATHLINK_DIRTY_SAVE_CHOICE');if(branch==='save'){const stored=after.quotes.find(q=>q.id===old.q.id);assert.equal(stored.title,old.q.title);assert.equal(stored.items[0].price,old.q.items[0].price);await a.evaluate(()=>guardedPersistCurrentState());}else await unchanged(a,before,'BATHLINK_DISCARD_MEMORY_ONLY');}
 }
}
async function prefillRoundTrip(t){
 const a=await app(t);await clearEditor(a);await a.evaluate(({A})=>{state.activeProject=A;render();},{A});const before=await snapshot(a),names=await a.evaluate(()=>[...HJ_BATH_PRICE_NAMES].sort());
 await a.locator('#qmNew').click();await a.locator('#qmProj').selectOption(B);await a.locator('#qmTitle').fill('TEST_UNSAVED_PREFILL');await a.locator('#qmTitle').press('Tab');await a.waitForFunction(()=>state.editingQuote.title==='TEST_UNSAVED_PREFILL');const old=await quote(a);
 const opened=t.context.waitForEvent('page');await a.locator('#qmBathroom').click();const b=await opened;await b.waitForLoadState('domcontentloaded');await b.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
 assert.equal(new URL(b.url()).pathname,'/bathroom.html');assert.equal(new URL(b.url()).search,'','BATHLINK_NO_CUSTOMER_IN_QUERY');assert.equal(new URL(b.url()).hash,'');assert.equal(await b.evaluate(()=>window.opener),null,'BATHLINK_NOOPENER');
 assert.equal(await field(b,'project').inputValue(),B,'BATHLINK_EDITOR_PROJECT_PRECEDENCE');assert.equal(await field(b,'customer').inputValue(),'TEST_CUSTOMER_1');assert.equal(await field(b,'place').inputValue(),'TEST_ADDRESS_1');assert.equal(await field(b,'wall.price').inputValue(),'10000');assert.equal(await field(b,'scope.4.material').inputValue(),'100000');assert.equal(await b.evaluate(key=>localStorage.getItem(key),PREFILL),null,'BATHLINK_PREFILL_CONSUMED');assert.match(await b.locator('#appPrefillNotice').textContent(),/앱에서 가져옴:.*단가 6개/);
 const modelNames=await b.evaluate(()=>[...HJBath.appPriceNames].sort());assert.deepEqual(names,modelNames,'BATHLINK_STANDARD_NAMES_DRIFT');assert.equal(names.length,46);
 const existing=await b.evaluate(()=>{const d=HJBath.defaults();d.wall.price=0;d.wall.labor='123';d.project='TEST_EXISTING';const before=JSON.stringify(d),p={at:new Date().toISOString(),project:'TEST_NEW',customer:{name:'TEST_NEW',addr:'TEST_NEW'},prices:{'욕실 벽 타일(박스)':999,'욕실 벽 타일 시공(㎡)':999,'욕실 바닥 타일(박스)':888}},r=HJBath.hjBathApplyPrefill(d,p);return {same:JSON.stringify(d)===before,wall:r.data.wall,floor:r.data.floor};});assert(existing.same);assert.equal(existing.wall.price,0,'BATHLINK_PREFILL_PRESERVES_FREE');assert.equal(existing.wall.labor,123,'BATHLINK_PREFILL_PRESERVES_TYPED_PRICE');assert.equal(existing.floor.price,888);
 assert.deepEqual((await quote(a)).q,old.q,'BATHLINK_PREFILL_PRESERVES_EDITOR');await unchanged(a,before,'BATHLINK_PREFILL_READ_ONLY');await geometry(b,['#sendToApp','#workMethod']);
}
async function lifecycle(t){
 const a=await app(t);await clearEditor(a);const before=await snapshot(a);
 for(const [kind,payload]of [['expired',handoff({at:new Date(Date.now()-86401000).toISOString()})],['future',handoff({at:new Date(Date.now()+60000).toISOString()})],['schema',handoff({days:{work:61,unusable:null,start:''}})]]){await trigger(a,payload);assert.equal(await a.locator('#hjBathHandoff').count(),0,'BATHLINK_INVALID_NO_MODAL '+kind);assert.equal(await a.evaluate(key=>localStorage.getItem(key),HANDOFF),null,'BATHLINK_INVALID_CONSUMED '+kind);await unchanged(a,before,'BATHLINK_INVALID_READ_ONLY '+kind);}
 const raw=await trigger(a,handoff({memo:'TEST_LATER'}));await modal(a);await modalButton(a,'나중에').click();await a.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));hjBathHandoffCheck();});await turn(a);assert.equal(await a.locator('#hjBathHandoff').count(),0,'BATHLINK_LATER_ONCE_PER_SESSION');assert.equal(await a.evaluate(key=>localStorage.getItem(key),HANDOFF),raw);await unchanged(a,before,'BATHLINK_LATER_READ_ONLY');
 await a.evaluate(()=>openModal('TEST_OTHER_MODAL','<p>TEST_OTHER</p>',[{label:'TEST_CLOSE',fn:closeModal}]));const later=await trigger(a,handoff({project:'TEST_UNKNOWN_SITE',memo:'TEST_WAIT_OTHER'}));assert.equal(await a.locator('#modalRoot h3').textContent(),'TEST_OTHER_MODAL','BATHLINK_OTHER_MODAL_NOT_REPLACED');assert.equal(await a.locator('#hjBathHandoff').count(),0);await modalButton(a,'TEST_CLOSE').click();await modal(a);assert.equal(await a.evaluate(key=>localStorage.getItem(key),HANDOFF),later);await modalButton(a,'불러오기').click();const q=await quote(a);assert.equal(q.q.project,null,'BATHLINK_UNKNOWN_SITE_NOT_ASSIGNED');assert.equal(q.q.place,'TEST_HANDOFF_ADDRESS');assert.match(q.q.memo,/현장을 골라 연결하세요/);await unchanged(a,before,'BATHLINK_UNKNOWN_IMPORT_MEMORY_ONLY');
}
async function revalidation(t){
 const a=await app(t);await clearEditor(a);const before=await snapshot(a);
 const first=await trigger(a,handoff({memo:'TEST_FIRST'}));await modal(a);const replacement=JSON.stringify(handoff({memo:'TEST_REPLACEMENT',project:B}));await a.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:HANDOFF,raw:replacement});await modalButton(a,'불러오기').click();assert.equal((await quote(a)).q,null,'BATHLINK_REPLACED_PAYLOAD_NOT_IMPORTED');assert.equal((await quote(a)).raw,replacement,'BATHLINK_REPLACEMENT_KEY_PRESERVED');assert.notEqual(first,replacement);await unchanged(a,before,'BATHLINK_REPLACED_READ_ONLY');
 await clearEditor(a);await trigger(a,handoff({memo:'TEST_STALE'}));await modal(a);await a.evaluate(()=>{__tabStale=true;});const stale=await quote(a);await modalButton(a,'불러오기').click();assert.deepEqual((await quote(a)).q,stale.q,'BATHLINK_STALE_EDITOR_PRESERVED');assert.equal((await quote(a)).raw,stale.raw,'BATHLINK_STALE_KEY_PRESERVED');await unchanged(a,before,'BATHLINK_STALE_READ_ONLY');await a.evaluate(()=>{__tabStale=false;});
 await clearEditor(a);await trigger(a,handoff({vat:'inclusive',items:[{name:'TEST_ROUND',spec:'TEST_SPEC',qty:100,price:100,pending:false}],total:10000,memo:'TEST_ROUNDING'}));await modal(a);assert(await modalButton(a,'불러오기').isDisabled(),'BATHLINK_ROUNDING_GAP_BLOCKED');assert.match(await a.locator('#hjBathHandoff [role="alert"]').textContent(),/차이.*보류/);const raw=await a.evaluate(key=>localStorage.getItem(key),HANDOFF);assert.equal(await a.evaluate(raw=>hjBathHandoffApply(raw),raw),false,'BATHLINK_DIRECT_APPLY_ROUNDING_BLOCKED');assert.equal((await quote(a)).q,null);assert.equal((await quote(a)).raw,raw);await unchanged(a,before,'BATHLINK_ROUNDING_READ_ONLY');
 await clearEditor(a);await a.locator('#qmNew').click();await a.locator('#qmTitle').fill('TEST_DIRTY_BEFORE_CONFIRM');await a.locator('#qmTitle').press('Tab');await a.waitForFunction(()=>state.editingQuote.title==='TEST_DIRTY_BEFORE_CONFIRM');await trigger(a,handoff({memo:'TEST_DIRTY_CHANGED'}));await modal(a);await modalButton(a,'불러오기').click();await modal(a,'저장하지 않은 견적');await a.evaluate(()=>{state.editingQuote.title='TEST_CHANGED_WHILE_CONFIRMING';});const changed=await quote(a);await modalButton(a,'저장 안 하고 새 견적').click();assert.deepEqual((await quote(a)).q,changed.q,'BATHLINK_DIRTY_REVALIDATED');assert.equal((await quote(a)).raw,changed.raw,'BATHLINK_DIRTY_CHANGED_KEY_PRESERVED');
}
async function methodDaysAndMobile(t){
 const b=await bath(t);await pricedBath(b);await field(b,'method').selectOption('full');for(const i of [0,1])assert(await field(b,'scope.'+i+'.enabled').isChecked(),'BATHLINK_FULL_DEFAULTS');await field(b,'method').selectOption('overlay');for(const i of [0,1])assert(!await field(b,'scope.'+i+'.enabled').isChecked(),'BATHLINK_OVERLAY_DEFAULTS');assert((await b.locator('body').textContent()).includes('배수 구배'),'BATHLINK_OVERLAY_EXPLANATION');
 await b.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await field(b,'scope.0.enabled').check();await field(b,'days.work').fill('3');assert(await field(b,'scope.0.enabled').isChecked(),'BATHLINK_MANUAL_SELECTION_PRESERVED');await field(b,'scope.0.enabled').uncheck();
 for(const value of ['-1','61','1.5']){await field(b,'days.work').fill(value);assert(await b.locator('#sendToApp').isDisabled(),'BATHLINK_INVALID_DAYS_BLOCK_SEND '+value);await b.locator('#sendToApp').evaluate(el=>el.click());assert.equal(await b.evaluate(key=>localStorage.getItem(key),HANDOFF),null,'BATHLINK_INVALID_DAYS_NO_PAYLOAD');}
 await field(b,'days.work').fill('3');await field(b,'days.unusable').fill('2');await field(b,'days.start').fill('TEST_START_AFTER_REVIEW');await field(b,'method').selectOption('overlay');
 await b.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__bathlinkCopy=text;}}}));await b.locator('#copyQuote').click();await b.waitForFunction(()=>typeof window.__bathlinkCopy==='string');
 const output={report:await b.locator('#report').textContent(),copy:await b.evaluate(()=>window.__bathlinkCopy)};
 for(const [name,id]of [['csv','exportCSV'],['html','exportHTML']]){const download=b.waitForEvent('download');await b.locator('#'+id).click();output[name]=fs.readFileSync(await(await download).path(),'utf8');}
 for(const [kind,text]of Object.entries(output)){assert(text.includes('덧방'),'BATHLINK_METHOD_OUTPUT '+kind);assert(text.includes('TEST_START_AFTER_REVIEW'),'BATHLINK_DAYS_OUTPUT '+kind);}
 const payload=await send(b);assert.deepEqual(payload.days,{work:3,unusable:2,start:'TEST_START_AFTER_REVIEW'});assert(payload.memo.includes('TEST_START_AFTER_REVIEW'));
 await geometry(b,['#sendToApp','#workMethod']);const headings=await b.locator('h1,h2').evaluateAll(els=>els.map(el=>({text:el.textContent,overflow:el.scrollWidth-el.clientWidth,wordBreak:getComputedStyle(el).wordBreak,wrap:getComputedStyle(el).overflowWrap})));for(const h of headings){assert(h.overflow<=0,'BATHLINK_HEADING_OVERFLOW '+h.text);assert.equal(h.wordBreak,'keep-all');assert.equal(h.wrap,'anywhere');}
}
async function bathStorage(page){return page.evaluate(async()=>{
 const stored=await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readonly'),read=tx.objectStore('kv').get('appState');read.onerror=()=>reject(read.error);read.onsuccess=()=>{db.close();resolve(read.result);};};});
 return {stored,local:Object.fromEntries(Object.entries(localStorage).sort(([a],[b])=>a.localeCompare(b)))};
});}
async function estimatedTransferBlocked(t){
 const b=await bath(t);await b.waitForFunction(()=>document.documentElement.dataset.bathPricesReady==='true');
 assert.equal(await field(b,'wall.price').inputValue(),'28000','BATHLINK_ESTIMATED_PRICE_LOADED');
 assert.equal(await b.locator('[data-price-source="estimate"][data-source-path="wall.price"]').count(),1,'BATHLINK_ESTIMATE_SOURCE_PRESENT');
 const before=await bathStorage(b);assert(before.local[HANDOFF]&&before.local[DRAFT],'BATHLINK_PRESERVATION_FIXTURES_PRESENT');
 assert(await b.locator('#sendToApp').isDisabled(),'BATHLINK_ESTIMATE_SEND_DISABLED');
 assert(await b.locator('#appHandoffBlocked').isVisible(),'BATHLINK_ESTIMATE_PERSISTENT_NOTICE');assert.match(await b.locator('#appHandoffBlocked').textContent(),/추정/);
 // dispatchEvent deliberately reaches the real handler despite the disabled control.
 // This protects the payload too, rather than testing only the button presentation.
 await b.locator('#sendToApp').dispatchEvent('click');await turn(b);
 assert.deepEqual(await bathStorage(b),before,'BATHLINK_ESTIMATE_BLOCK_PRESERVES_ALL_STORAGE');
 assert(await b.locator('#openAppLink').isHidden(),'BATHLINK_BLOCKED_NO_SUCCESS_LINK');
 assert.match(await b.locator('#status').textContent(),/추정|확인/,'BATHLINK_BLOCKED_HANDLER_NOTICE');
}
async function savedPriceProvenance(t){
 const a=await app(t);await clearEditor(a);await a.evaluate(A=>{state.activeProject=A;render();},A);const before=await snapshot(a);
 const opened=t.context.waitForEvent('page');await a.locator('#qmBathroom').click();const b=await opened;await b.waitForLoadState('domcontentloaded');await b.waitForFunction(()=>document.documentElement.dataset.bathReady==='true'&&document.documentElement.dataset.bathPricesReady==='true');
 for(const [path,value]of [['wall.price',10000],['wall.labor',20000],['floor.price',8000],['floor.labor',15000],['scope.4.material',100000],['scope.4.labor',50000]]){
  assert.equal(await field(b,path).inputValue(),String(value),'BATHLINK_APP_PRICE_BEATS_ESTIMATE '+path);
  assert.equal(await b.locator('[data-price-source="app"][data-source-path="'+path+'"]').count(),1,'BATHLINK_APP_SOURCE_BADGE '+path);
  assert.equal(await b.locator('[data-price-source="estimate"][data-source-path="'+path+'"]').count(),0,'BATHLINK_NO_FALSE_ESTIMATE '+path);
 }
 assert.equal(await field(b,'scope.2.material').inputValue(),'90000');assert(!await field(b,'scope.2.enabled').isChecked());
 assert.equal(await b.locator('[data-price-source="estimate"][data-source-path="scope.2.material"]').count(),1,'BATHLINK_UNSELECTED_ESTIMATE_RETAINED');
 assert(await b.locator('#sendToApp').isEnabled(),'BATHLINK_UNSELECTED_ESTIMATE_DOES_NOT_BLOCK');
 assert(await b.locator('#appHandoffBlocked').isHidden());assert.equal(await b.evaluate(key=>localStorage.getItem(key),PREFILL),null);
 await b.locator('#saveDraft').click();const draft=await b.evaluate(key=>JSON.parse(localStorage.getItem(key)),DRAFT);
 assert.deepEqual(draft.priceSources['욕실 벽 타일(박스)'],{kind:'app',supplyPrice:10000},'BATHLINK_APP_PROVENANCE_SAVED');
 assert.equal(draft.priceSources['방수·바탕 보수'].kind,'estimate','BATHLINK_UNSELECTED_PROVENANCE_SAVED');
 const payload=await send(b);assert.equal(payload.items.length,4);assert.equal(payload.items[0].price,10000,'BATHLINK_HANDOFF_USES_SAVED_APP_PRICE');assert.deepEqual(payload.items[0].priceSource,{kind:'app',supplyPrice:10000},'BATHLINK_HANDOFF_PRESERVES_APP_PROVENANCE');assert.equal(payload.total,589490,'BATHLINK_APP_PRICE_TOTAL_INDEPENDENT');
 await unchanged(a,before,'BATHLINK_PROVENANCE_IMPORT_READ_ONLY');
}
async function expiredPrefill(t){const b=await bath(t);assert.equal(await b.evaluate(key=>localStorage.getItem(key),PREFILL),null,'BATHLINK_EXPIRED_PREFILL_CONSUMED');assert.equal(await field(b,'project').inputValue(),'');assert.equal(await field(b,'wall.price').inputValue(),'');assert(await b.locator('#appPrefillNotice').isHidden());assert.equal(await b.evaluate(()=>localStorage.getItem('bathlink_unrelated')),'TEST_KEEP');}
(async()=>{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});
 try{
  await run('신규 기능 존재 — 기준 버전은 의도한 단언으로 실패',async t=>{await bath(t);});if(CANARY){console.log('bathlink canary 1/1');return;}
  await run('욕실 실제 보내기 → 앱 부팅 → 품목·공급가·합계·저장 불변',t=>uiRoundTrip(t));
  await run('부가세 포함 환산·미정 한 행·무료 구분',t=>uiRoundTrip(t,true,true));
  await run('더러운 견적 계속 편집·버리기·저장 세 분기',dirtyBranches);
  await run('앱 버튼 새 탭 prefill·우선 현장·46개 품목 계약·비덮기',prefillRoundTrip);
  await run('만료·미래·손상·나중에·다른 모달 대기·미연결 현장',lifecycle);
  await run('전송 교체·stale 탭·환산차이·확인 중 편집 재검증',revalidation);
  await run('공사 방식·기간·고객 출력·320px',methodDaysAndMobile,320);
  await run('공사 방식·기간·고객 출력·390px',methodDaysAndMobile,390);
  for(const delta of [-601000,60000])await run('미리 채우기 시각 거부 '+delta,expiredPrefill,390,{[PREFILL]:{at:new Date(Date.now()+delta).toISOString(),project:'TEST_EXPIRED',customer:{name:'TEST_EXPIRED',addr:'TEST_EXPIRED'},prices:{'욕실 벽 타일(박스)':10000}}});
  await run('추정 단가의 앱 전송 보류·직접 핸들러·저장 원문 보존',estimatedTransferBlocked,390,{[HANDOFF]:handoff({memo:'TEST_PREVIOUS_HANDOFF_KEEP'}),[DRAFT]:'{"version":99,"note":"TEST_DRAFT_ORIGINAL_KEEP"}'},true);
  await run('저장한 앱 단가 우선·app 출처·미선택 추정 보존·전송',savedPriceProvenance,390,{},true);
  console.log('bathlink-v411 e2e '+passed+'/'+passed);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

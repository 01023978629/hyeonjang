/* v421: isolated synthetic IndexedDB, 390px real UI, actual quote/payment saves.
   Keep 8299 in repository source; only the isolated test copy changes the port.
   --canary fails explicitly on a build without this feature.
   HJ_LEAK_QUOTE_MUTATION=names|duplicate reruns the SAME normal assertion body;
   only its named ERR_ASSERTION is mutation evidence, never timeout/boot failure.
   HJ_LEAK_SCREENSHOT_DIR optionally saves synthetic mobile screenshots. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',APP=BASE+'/index.html';
const MUTATION=process.env.HJ_LEAK_QUOTE_MUTATION||'',CANARY=process.argv.includes('--canary');
assert(['','names','duplicate'].includes(MUTATION),'unknown HJ_LEAK_QUOTE_MUTATION');
const LEAK='누수 견적 알파',INTERIOR='실내 공사 베타',NOW='2026-11-06T08:40:00+09:00',TODAY='2026-11-06',ADDRESS='TEST_ONLY_ADDRESS_V421';
// Independent contract copied from the task, never derived from implementation.
const NAMES=['출장·탐지비','배관 교체','배관 부속·밸브','방수 보수','타일 복구','천장 점검구 설치','도배·마감 복구','폐기물 처리','아랫집 피해 복구 협의'];
const UNITS=['식','m','개','㎡','㎡','개','식','식','식'];
const CASES=[['급수관',[0,1,2,4]],['배수관',[0,1,7]],['방수층(욕실·베란다)',[0,3,4]],['원인 미확정',[0]]];
const MUTATION_MARKER={names:'LEAK_QUOTE_EXACT_NAMES',duplicate:'LEAK_PAYMENT_SINGLE_LOG'};
let browser,passed=0;
function project(name,extra={}){return {name,stage:0,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{name:'TEST_CUSTOMER',phone:'',addr:ADDRESS},archived:false,...extra};}
function fixture(){return {version:2,app:'현장',savedAt:new Date(NOW).toISOString(),files:[],quotes:[],schedule:[],notes:[],contacts:[],payLog:[],priceBook:{'출장·탐지비':150000,'배관 교체':40000,'배관 부속·밸브':0,'타일 복구':-1,'천장 점검구 설치':'17000'},projects:[project(LEAK,{kind:'leak',leak:{detect:{cause:'급수관',zone:'전유부',at:'2026-11-06T07:00:00+09:00'}}}),project(INTERIOR)]};}
const footer=(page,label)=>page.locator('#modalRoot .mfoot').getByRole('button',{name:label,exact:true});
async function turn(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function settleMotion(page){await page.evaluate(async()=>{for(;;){const active=document.getAnimations().filter(animation=>animation.playState==='running'&&animation.playbackRate!==0&&Number.isFinite(animation.effect?.getComputedTiming().endTime));if(!active.length)return;await Promise.allSettled(active.map(animation=>animation.finished));}});}
async function queue(page){await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;});}
async function persist(page){assert.equal(await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;const ok=await guardedPersistCurrentState();await __appStateWriteQueue;return ok;}),true,'LEAK_QUOTE_FIXTURE_DURABLE');}
async function snap(page){return page.evaluate(async()=>{await __appStateWriteQueue;const clean=value=>{if(value==null)return value;const copy=JSON.parse(JSON.stringify(value));delete copy.savedAt;return copy;};const data=clean(serializeData()),pointer=await idbGet('paid_commit_pointer');return {keys:Object.keys(data).sort(),data,stored:clean(await idbGet('appState')),pointer:pointer||null,generation:pointer?clean(await idbGet(pointer)):null,unrelated:localStorage.getItem('leakquote_unrelated')};});}
async function same(page,before,label){assert.deepEqual(await snap(page),before,label);}
async function geometry(page,selectors){await settleMotion(page);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'LEAK_QUOTE_NO_HORIZONTAL_OVERFLOW');for(const selector of selectors){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await settleMotion(page);const box=await el.boundingBox();assert(box&&box.width>=44&&box.height>=44,'LEAK_QUOTE_44PX '+selector);}}
async function screenshot(page,name,selector){if(process.env.HJ_LEAK_SCREENSHOT_DIR){if(selector)await page.locator(selector).scrollIntoViewIfNeeded();else await page.evaluate(()=>window.scrollTo(0,0));await turn(page);await page.screenshot({path:path.join(process.env.HJ_LEAK_SCREENSHOT_DIR,name+'.png')});}}
async function boot(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Seoul'}),errors=[],externalWrites=[];
 context.on('page',page=>{page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(35000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());});
 await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){externalWrites.push(request.method()+' '+url.origin+url.pathname);return route.abort();}if(url.origin!==BASE)return route.abort();if(url.pathname==='/__leakquote_seed__')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>synthetic leak quote fixture</title>'});return route.continue();});
 await context.addInitScript(now=>{const NativeDate=Date;window.__leakQuoteNow=NativeDate.parse(now);class LeakQuoteDate extends NativeDate{constructor(...args){super(...(args.length?args:[window.__leakQuoteNow]));}static now(){return window.__leakQuoteNow;}}window.Date=LeakQuoteDate;},NOW);
 const seed=await context.newPage();await seed.goto(BASE+'/__leakquote_seed__');
 await seed.evaluate(async data=>{for(const [key,value]of Object.entries({hj_onboard_done:'1',pref_mobile:'1',hj_ver_checked_at:String(Date.now()),hj_gcal_auto:'0',hj_more_recent:'[]',hj_more_favorites:'[]',leakquote_unrelated:'TEST_KEEP'}))localStorage.setItem(key,value);await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(data,'appState');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},fixture());await seed.close();
 const page=await context.newPage();
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  assert(await page.evaluate(()=>typeof HJ_LEAK_ITEMS!=='undefined'&&typeof hjLeakQuoteItems==='function'&&typeof hjLeakQuickQuote==='function'&&typeof hjLeakQuoteTemplate==='function'&&typeof hjLeakPaymentView==='function'&&typeof hjLeakReceiptPending==='function'),'LEAK_QUOTE_FEATURE_PRESENT');
  if(CANARY)return {context,page,errors,externalWrites};
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
  await page.evaluate(async()=>{await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};portalAutoSync=()=>{};aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;closeModal(true);state._demo=false;state.dirHandle=null;state.editingQuote=null;state.activeProject=null;state.tab='dashboard';__tabStale=false;__gdToken=null;relayReady=()=>false;window.__leakQuoteOpened=[];window.open=(...args)=>{window.__leakQuoteOpened.push(args);return null;};window.__leakSmsCalls=[];hjSendSms=(...args)=>{window.__leakSmsCalls.push(args);throw new Error('LEAK_QUOTE_MUST_NOT_SEND_SMS');};render();});
  await persist(page);await turn(page);return {context,page,errors,externalWrites};
 }catch(error){await context.close();throw error;}
}
async function openMore(page){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('.mobile-nav [data-mnav="__more"]').click();await page.locator('#moreSheet').waitFor();}
async function selectProject(page,name){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('#projChip').click();await page.locator('#projSheet').waitFor();await page.locator('#psList [data-psel="'+name+'"]').click();await page.waitForFunction(()=>!document.getElementById('projSheet')&&!__mobileSheetHistoryRetire);await turn(page);}
async function closeModal(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await turn(page);}
async function quickOpen(page){await selectProject(page,LEAK);await page.locator('[data-leakquote="'+LEAK+'"]').click();await page.locator('#hjLeakQuoteForm').waitFor();}
async function run(name,fn){const t=await boot();try{await fn(t);assert.deepEqual(t.errors,[],'LEAK_QUOTE_NO_PAGE_ERRORS '+name);assert.deepEqual(t.externalWrites,[],'LEAK_QUOTE_NO_NETWORK_WRITES '+name);assert.deepEqual(await t.page.evaluate(()=>window.__leakSmsCalls),[],'LEAK_QUOTE_NO_CUSTOMER_SEND '+name);passed++;console.log('PASS '+name);}finally{await t.context.close();}}

async function defaults({page}){
 if(MUTATION==='names')await page.evaluate(()=>{const original=hjLeakQuoteItems;hjLeakQuoteItems=function(...args){const rows=original.apply(this,args).map(row=>({...row}));if(rows[0])rows[0].name+=' TEST_CHANGED';return rows;};});
 for(const [cause,expected]of CASES){
  await page.evaluate(({name,cause})=>{state.projects.find(p=>p.name===name).leak.detect.cause=cause;}, {name:LEAK,cause});await persist(page);const before=await snap(page);
  const rows=await page.evaluate(name=>hjLeakQuoteItems(state.projects.find(p=>p.name===name)),LEAK);
  assert.deepEqual(rows.map(row=>row.name),NAMES,'LEAK_QUOTE_EXACT_NAMES');assert.deepEqual(rows.map(row=>row.spec),UNITS,'LEAK_QUOTE_UNITS');assert.deepEqual(rows.map((row,i)=>row.checked?i:null).filter(i=>i!==null),expected,'LEAK_QUOTE_CAUSE_SET '+cause);assert(rows.every(row=>row.qty===1),'LEAK_QUOTE_DEFAULT_QTY');assert.deepEqual(rows.map(row=>row.price),[150000,40000,0,'','','','','',0],'LEAK_QUOTE_ONLY_VALID_PRICEBOOK_AND_EXPLICIT_ZERO');
  await quickOpen(page);const checked=await page.locator('[data-leakquote-check]:checked').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.leakquoteCheck)));assert.deepEqual(checked,expected,'LEAK_QUOTE_UI_CAUSE_SET '+cause);assert.equal(await page.locator('[data-leakquote-price="3"]').inputValue(),'','LEAK_QUOTE_MISSING_PRICE_IS_BLANK');assert.equal(Number((await page.locator('[data-leakquote-price="2"]').inputValue()).replace(/,/g,'')),0,'LEAK_QUOTE_EXPLICIT_ZERO_RETAINED');assert.equal(Number((await page.locator('[data-leakquote-price="8"]').inputValue()).replace(/,/g,'')),0,'LEAK_QUOTE_NEIGHBOR_ZERO');await footer(page,'닫기').click();await same(page,before,'LEAK_QUOTE_DEFAULT_READ_ONLY '+cause);
 }
 const extra=await page.evaluate(name=>{const p=state.projects.find(p=>p.name===name);return ['온수관','난방 배관','외벽·창호','결로','윗세대','잘못된 원인'].map(cause=>({cause,set:hjLeakQuoteItems({...p,leak:{...p.leak,detect:{...p.leak.detect,cause}}}).map((r,i)=>r.checked?i:null).filter(i=>i!==null)}));},LEAK);assert.deepEqual(extra.map(x=>x.set),[[0,1,2,4],[0,1,2,4],[0],[0],[0],[0]],'LEAK_QUOTE_OTHER_CAUSES_CONSERVATIVE');
}

async function template({page}){
 await selectProject(page,LEAK);await page.evaluate(name=>{state.tab='quotemaker';state.editingQuote=newQuote();state.editingQuote.project=name;state.editingQuote.items=[{name:'TEST_EXISTING_ITEM',spec:'식',qty:2,price:12345}];render();},LEAK);await page.locator('#qmLeakTemplate').waitFor();await geometry(page,['#qmLeakTemplate']);
 const before=await snap(page);await page.locator('#qmLeakTemplate').click();await page.locator('#hjLeakTemplateForm').waitFor();await footer(page,'선택한 품목 넣기').click();assert.match(await page.locator('#modalRoot').textContent(),/뒤에 추가/);await footer(page,'취소').click();assert.deepEqual(await page.evaluate(()=>state.editingQuote.items),[{name:'TEST_EXISTING_ITEM',spec:'식',qty:2,price:12345}],'LEAK_TEMPLATE_CANCEL_PRESERVES_EXISTING');await same(page,before,'LEAK_TEMPLATE_PREVIEW_NOT_SAVED');
 await page.locator('#qmLeakTemplate').click();await page.locator('#hjLeakTemplateForm').waitFor();await footer(page,'선택한 품목 넣기').click();await footer(page,'뒤에 추가').click();assert.deepEqual(await page.evaluate(()=>state.editingQuote.items.map(row=>row.name)),['TEST_EXISTING_ITEM',NAMES[0],NAMES[1],NAMES[2],NAMES[4]],'LEAK_TEMPLATE_APPEND');
 await page.locator('#qmLeakTemplate').click();await page.locator('#hjLeakTemplateForm').waitFor();for(let i=0;i<NAMES.length;i++)await page.locator('[data-leak-template-check="'+i+'"]').setChecked(i===0||i===3);await footer(page,'선택한 품목 넣기').click();await footer(page,'바꾸기').click();
 const draft=await page.evaluate(()=>JSON.parse(JSON.stringify(state.editingQuote)));assert.deepEqual(draft.items.map(row=>row.name),[NAMES[0],NAMES[3]],'LEAK_TEMPLATE_REPLACE_SELECTED');assert.equal(draft.title,LEAK+' 누수 수리 견적');assert.equal(draft.project,LEAK);assert.equal(draft.place,ADDRESS);assert.deepEqual(draft.leak,{cause:'급수관',zone:'전유부',from:'template',at:new Date(NOW).toISOString()},'LEAK_TEMPLATE_META');
 await page.locator('[data-qi="1"][data-qf="price"]').fill('27000');await page.locator('[data-qi="1"][data-qf="price"]').blur();await page.locator('#qmSave').click();await page.waitForFunction(()=>state.quotes.length===1);await persist(page);assert.equal(await page.evaluate(()=>state.priceBook['방수 보수']),27000,'LEAK_TEMPLATE_SAVE_LEARNS_FIXED_NAME');assert.equal((await snap(page)).stored.priceBook['방수 보수'],27000,'LEAK_TEMPLATE_PRICEBOOK_DURABLE');const learned=await page.evaluate(name=>hjLeakQuoteItems(state.projects.find(p=>p.name===name)).find(row=>row.name==='방수 보수').price,LEAK);assert.equal(learned,27000,'LEAK_TEMPLATE_SECOND_QUOTE_LEARNS');assert.deepEqual((await snap(page)).keys,before.keys,'LEAK_TEMPLATE_NO_TOP_KEYS');
}

async function fillQuick(page){
 for(let i=0;i<NAMES.length;i++)await page.locator('[data-leakquote-check="'+i+'"]').setChecked(i===0||i===1);
 for(const [i,qty,price]of [[0,'1','150000'],[1,'2.5','42000']]){await page.locator('[data-leakquote-qty="'+i+'"]').fill(qty);await page.locator('[data-leakquote-price="'+i+'"]').fill(price);}
 await page.locator('#hjLeakQuoteVat').selectOption('1');
}

async function quickSave({page}){
 const before=await snap(page);await selectProject(page,LEAK);await geometry(page,['[data-leakquote="'+LEAK+'"]']);await page.locator('[data-leakquote="'+LEAK+'"]').click();await page.locator('#hjLeakQuoteForm').waitFor();await fillQuick(page);await geometry(page,['[data-leakquote-qty="0"]','[data-leakquote-price="0"]','#hjLeakQuoteVat']);
 await footer(page,'고객에게 보여주기').click();await page.locator('#hjLeakQuoteCustomer').waitFor();let text=await page.locator('#hjLeakQuoteCustomer').textContent();assert.match(text,/280,500/,'LEAK_QUOTE_CUSTOMER_TOTAL_WITH_VAT');assert.match(text,/만물인테리어/);assert.match(text,/010[- ]?2397[- ]?8629/);await same(page,before,'LEAK_QUOTE_PREVIEW_DOES_NOT_SAVE');await screenshot(page,'v421-customer-390','#hjLeakQuoteCustomer');await footer(page,'편집으로').click();assert.equal(await page.locator('[data-leakquote-qty="1"]').inputValue(),'2.5','LEAK_QUOTE_PREVIEW_RETURNS_INPUTS');assert.equal(Number((await page.locator('[data-leakquote-price="1"]').inputValue()).replace(/,/g,'')),42000);
 await page.locator('#hjLeakQuoteVat').selectOption('0');await footer(page,'고객에게 보여주기').click();assert.match(await page.locator('#hjLeakQuoteCustomer').textContent(),/255,000/,'LEAK_QUOTE_CUSTOMER_TOTAL_WITHOUT_VAT');await footer(page,'편집으로').click();await page.locator('#hjLeakQuoteVat').selectOption('1');
 await footer(page,'문자 초안').click();await page.locator('#mcBody').waitFor();text=await page.locator('#mcBody').inputValue();assert(text.includes(LEAK),'LEAK_QUOTE_SMS_PROJECT');assert(text.includes('280,500'),'LEAK_QUOTE_SMS_TOTAL');await same(page,before,'LEAK_QUOTE_SMS_DRAFT_DOES_NOT_SAVE');assert.deepEqual(await page.evaluate(()=>window.__leakQuoteOpened),[],'LEAK_QUOTE_DRAFT_NO_EXTERNAL_COMPOSER');await footer(page,'편집으로').click();await page.locator('#hjLeakQuoteForm').waitFor();assert.equal(await page.locator('[data-leakquote-qty="1"]').inputValue(),'2.5','LEAK_QUOTE_SMS_RETURNS_INPUTS');
 await page.evaluate(()=>{window.__leakQuoteCommitCalls=0;const original=quoteCommitEditing;quoteCommitEditing=function(...args){window.__leakQuoteCommitCalls++;return original.apply(this,args);};});await screenshot(page,'v421-quick-390','#hjLeakQuoteForm');await footer(page,'저장').click();await page.waitForFunction(()=>state.quotes.length===1);await persist(page);
 const after=await snap(page),q=after.data.quotes[0];assert.equal(await page.evaluate(()=>window.__leakQuoteCommitCalls),1,'LEAK_QUOTE_USES_EXISTING_COMMIT');assert.equal(q.project,LEAK);assert.equal(q.title,LEAK+' 누수 수리 견적');assert.equal(q.place,ADDRESS);assert.equal(q.leak.cause,'급수관');assert.equal(q.leak.zone,'전유부');assert.equal(q.leak.at,new Date(NOW).toISOString());assert.deepEqual(q.items.map(row=>({name:row.name,qty:Number(row.qty),price:Number(row.price)})),[{name:NAMES[0],qty:1,price:150000},{name:NAMES[1],qty:2.5,price:42000}],'LEAK_QUOTE_SAVED_ITEMS');assert.equal(await page.evaluate(()=>quoteCalc(state.quotes[0]).total),280500,'LEAK_QUOTE_SAVED_TOTAL');assert.equal(after.stored.quotes.length,1,'LEAK_QUOTE_DURABLE');assert.deepEqual(after.stored.quotes[0].leak,q.leak);assert.equal(await page.evaluate(({id,name})=>state.files.filter(file=>file.id==='quote_'+id&&file.project===name).length,{id:q.id,name:LEAK}),1,'LEAK_QUOTE_VIRTUAL_FILE_SINGLE');assert.equal(await page.evaluate(name=>projStats(name).est,LEAK),280500,'LEAK_QUOTE_REVENUE_SINGLE');assert.equal(after.data.priceBook['배관 교체'],42000,'LEAK_QUOTE_QUICK_SAVE_LEARNS');assert.deepEqual(after.keys,before.keys,'LEAK_QUOTE_NO_NEW_TOP_KEYS');assert.equal(after.unrelated,'TEST_KEEP');
 await page.evaluate(()=>{closeModal(true);quoteHistoryView(true);});assert.match(await page.locator('#modalRoot').textContent(),/누수 견적 알파 누수 수리 견적/,'LEAK_QUOTE_HISTORY_VISIBLE');await closeModal(page);await page.evaluate(()=>{window.__leakQuoteNow=Date.parse('2026-11-10T08:40:00+09:00');quoteFollowup();});assert.match(await page.locator('#modalRoot').textContent(),/누수 견적 알파 누수 수리 견적/,'LEAK_QUOTE_FOLLOWUP_VISIBLE');assert.equal(await page.locator('.qfWon[data-q="'+q.id+'"]').count(),1,'LEAK_QUOTE_EXISTING_FOLLOWUP_ACTION');await closeModal(page);
}

async function unsaved({page}){
 await selectProject(page,LEAK);await page.evaluate(name=>{const q=newQuote();q.title='TEST_UNSAVED_DO_NOT_LOSE';q.project=name;q.items=[{name:'TEST_MANUAL_ITEM',spec:'식',qty:1,price:123456}];state.editingQuote=q;render();},INTERIOR);const draft=await page.evaluate(()=>JSON.parse(JSON.stringify(state.editingQuote))),before=await snap(page);
 await page.locator('[data-leakquote="'+LEAK+'"]').click();assert.match(await page.locator('#modalRoot h3').textContent(),/저장하지 않은 견적/);await footer(page,'계속 편집').click();assert.deepEqual(await page.evaluate(()=>state.editingQuote),draft,'LEAK_QUOTE_KEEP_UNSAVED');await same(page,before,'LEAK_QUOTE_CANCEL_GUARD_READ_ONLY');
 await page.locator('[data-leakquote="'+LEAK+'"]').click();await footer(page,'저장하고 새 견적').click();await page.locator('#hjLeakQuoteForm').waitFor();assert.equal(await page.evaluate(()=>state.quotes.length),1,'LEAK_QUOTE_GUARD_SAVES_PREVIOUS_ONCE');assert.equal(await page.evaluate(()=>state.quotes[0].title),'TEST_UNSAVED_DO_NOT_LOSE');await footer(page,'닫기').click();await persist(page);
 await page.evaluate(name=>{const q=newQuote();q.title='TEST_DISCARD_EXPLICIT';q.project=name;q.items=[{name:'TEST_NOT_SAVED',spec:'식',qty:1,price:99}];state.editingQuote=q;render();},INTERIOR);await page.locator('[data-leakquote="'+LEAK+'"]').click();await footer(page,'저장 안 하고 새 견적').click();await page.locator('#hjLeakQuoteForm').waitFor();assert.equal(await page.evaluate(()=>state.quotes.length),1,'LEAK_QUOTE_EXPLICIT_DISCARD_NO_EXTRA_SAVE');assert.equal(await page.evaluate(()=>state.quotes.some(q=>q.title==='TEST_DISCARD_EXPLICIT')),false);await footer(page,'닫기').click();
}

async function payment({page}){
 await quickOpen(page);await fillQuick(page);await footer(page,'저장').click();await page.waitForFunction(()=>state.quotes.length===1);await persist(page);const before=await snap(page),qid=before.data.quotes[0].id;
 if(MUTATION==='duplicate')await page.evaluate(()=>{const original=hjLeakPaymentContext;hjLeakPaymentContext=function(...args){const context=original.apply(this,args);context.record=null;context.recordStamp=paidStableJson(null);context.payLogId='leakpay_'+uid();return context;};});
 const open=async()=>{await page.evaluate(id=>{closeModal(true);hjLeakPaymentView(state.quotes.find(q=>q.id===id));},qid);await page.locator('#hjLeakPayAmount').waitFor();};
 await page.evaluate(id=>{closeModal(true);state.tab='quotemaker';editQuote(id);},qid);await page.locator('#qmLeakPaid').waitFor();await geometry(page,['#qmLeakPaid']);await page.locator('#qmLeakPaid').click();await page.locator('#hjLeakPayAmount').waitFor();assert.match(await page.locator('#modalRoot h3').textContent(),/받은 돈 기록/);assert.equal(Number((await page.locator('#hjLeakPayAmount').inputValue()).replace(/,/g,'')),280500,'LEAK_PAYMENT_DEFAULT_TOTAL');await geometry(page,['#hjLeakPayMethod','#hjLeakPayAmount','#hjLeakPayDate','#hjLeakPayReceipt']);await page.locator('#hjLeakPayMethod').selectOption('계좌이체');await page.locator('#hjLeakPayAmount').fill('120000');await page.locator('#hjLeakPayDate').fill(TODAY);await page.locator('#hjLeakPayReceipt').selectOption('세금계산서');await page.locator('#hjLeakPayIssued').uncheck();await screenshot(page,'v421-payment-390','#hjLeakPayAmount');await footer(page,'저장').click();await page.waitForFunction(id=>!!state.quotes.find(q=>q.id===id).paid,qid);await persist(page);
 let after=await snap(page),q=after.data.quotes[0],log=after.data.payLog;assert.equal(log.length,1,'LEAK_PAYMENT_SINGLE_LOG');assert.equal(q.paid.method,'계좌이체');assert.equal(q.paid.amount,120000);assert.equal(q.paid.at,TODAY);assert.deepEqual(q.paid.receipt,{type:'세금계산서',issued:false});assert(q.paid.payLogId,'LEAK_PAYMENT_LOG_ID_RETAINED');assert.equal(log[0].id,q.paid.payLogId,'LEAK_PAYMENT_LINKS_LOG');assert.equal(log[0].amt,120000);assert.equal(log[0].d,TODAY);assert.equal(log[0].project,LEAK);assert.equal(after.data.projects.find(p=>p.name===LEAK).received,120000,'LEAK_PAYMENT_RECEIVED_ONCE');const payLogId=q.paid.payLogId;
 await open();await footer(page,'저장').click();await page.waitForFunction(()=>!document.getElementById('hjLeakPayAmount'));await persist(page);after=await snap(page);assert.equal(after.data.payLog.length,1,'LEAK_PAYMENT_SINGLE_LOG');assert.equal(after.data.quotes[0].paid.payLogId,payLogId,'LEAK_PAYMENT_REPEAT_SAME_LOG_ID');assert.equal(after.data.projects.find(p=>p.name===LEAK).received,120000,'LEAK_PAYMENT_REPEAT_NOT_ADDED');
 await open();await page.locator('#hjLeakPayAmount').fill('135000');await page.locator('#hjLeakPayMethod').selectOption('현금');await page.locator('#hjLeakPayReceipt').selectOption('현금영수증');await footer(page,'저장').click();await page.waitForFunction(()=>!document.getElementById('hjLeakPayAmount'));await persist(page);after=await snap(page);assert.equal(after.data.payLog.length,1,'LEAK_PAYMENT_SINGLE_LOG');assert.equal(after.data.payLog[0].id,payLogId);assert.equal(after.data.payLog[0].amt,135000,'LEAK_PAYMENT_EDIT_UPDATES_LOG');assert.equal(after.data.projects.find(p=>p.name===LEAK).received,135000,'LEAK_PAYMENT_EDIT_UPDATES_RECEIVED_DIFFERENCE');assert.equal(after.stored.quotes[0].paid.amount,135000,'LEAK_PAYMENT_DURABLE');assert.deepEqual(after.stored.payLog,after.data.payLog,'LEAK_PAYMENT_LOG_DURABLE');assert.deepEqual(after.keys,before.keys,'LEAK_PAYMENT_NO_NEW_TOP_KEYS');
 await page.evaluate(()=>{closeModal(true);state.activeProject=null;state.tab='dashboard';render();});await turn(page);assert.match(await page.locator('#view').textContent(),/영수증 미발행\s*1건/,'LEAK_PAYMENT_DASHBOARD_UNISSUED');const read=await snap(page);await page.evaluate(()=>{hjLeakReceiptPending();hjLeakReceiptPending();render();});await same(page,read,'LEAK_PAYMENT_READ_ONLY_HELPER');
 await open();await page.locator('#hjLeakPayIssued').check();await footer(page,'저장').click();await page.waitForFunction(()=>!document.getElementById('hjLeakPayAmount'));await persist(page);await page.evaluate(()=>{state.activeProject=null;state.tab='dashboard';render();});assert.doesNotMatch(await page.locator('#view').textContent(),/영수증 미발행\s*1건/,'LEAK_PAYMENT_ISSUED_CLEARS_DASHBOARD');assert.equal((await snap(page)).data.payLog.length,1,'LEAK_PAYMENT_SINGLE_LOG');
 // The pre-existing receipt screen and project assignment must respect this same payment.
 await page.evaluate(()=>{hjProofSet(state.payLog[0],'');});await persist(page);assert.equal(await page.evaluate(()=>hjLeakReceiptPending()),1,'LEAK_PAYMENT_EXISTING_PROOF_UNISSUED_SYNC');
 await page.evaluate(()=>{hjProofSet(state.payLog[0],'tax');});await persist(page);assert.equal(await page.evaluate(()=>hjLeakReceiptPending()),0,'LEAK_PAYMENT_EXISTING_PROOF_ISSUED_SYNC');
 await open();assert.equal(await page.locator('#hjLeakPayReceipt').inputValue(),'세금계산서');assert.equal(await page.locator('#hjLeakPayIssued').isChecked(),true);await footer(page,'저장').click();await page.waitForFunction(()=>!document.getElementById('hjLeakPayAmount'));await persist(page);assert.equal(await page.evaluate(()=>state.payLog[0].proof),'tax','LEAK_PAYMENT_SAVE_PRESERVES_EXISTING_PROOF');
 await page.evaluate(()=>{state.editingQuote=null;});const beforeMove=await snap(page);const move=await page.evaluate(async({id,name})=>{try{await estimateProjectAssign('quote',id,name);return '';}catch(e){return e.message;}},{id:qid,name:INTERIOR});assert.match(move,/받은 돈.*현장/,'LEAK_PAYMENT_LINKED_PROJECT_ASSIGN_BLOCKED');await same(page,beforeMove,'LEAK_PAYMENT_REASSIGN_DOES_NOT_SPLIT_LEDGER');
 await page.evaluate(({id,name})=>{state.editingQuote=JSON.parse(JSON.stringify(state.quotes.find(q=>q.id===id)));state.editingQuote.project=name;},{id:qid,name:INTERIOR});assert.equal(await page.evaluate(()=>saveQuoteEdit()),false,'LEAK_PAYMENT_EDITOR_PROJECT_CHANGE_BLOCKED');await same(page,beforeMove,'LEAK_PAYMENT_EDITOR_DOES_NOT_SPLIT_LEDGER');
}

async function scope({page}){
 await selectProject(page,INTERIOR);const before=await snap(page);assert.equal(await page.locator('[data-leakquote]').count(),0,'LEAK_QUOTE_INTERIOR_HAS_NO_QUICK_BUTTON');await page.evaluate(name=>{state.tab='quotemaker';state.editingQuote=newQuote();state.editingQuote.project=name;render();},INTERIOR);assert.equal(await page.locator('#qmLeakTemplate').count(),0,'LEAK_QUOTE_INTERIOR_HAS_NO_TEMPLATE');await page.evaluate(()=>{state.editingQuote=null;state.tab='dashboard';render();});await same(page,before,'LEAK_QUOTE_INTERIOR_READ_ONLY');
 await selectProject(page,LEAK);await geometry(page,['[data-leakquote="'+LEAK+'"]']);await page.locator('[data-leakquote="'+LEAK+'"]').click();await page.locator('#hjLeakQuoteForm').waitFor();await geometry(page,['[data-leakquote-qty="0"]','[data-leakquote-price="0"]','#hjLeakQuoteVat']);const buttons=page.locator('#modalRoot .mfoot button');for(let i=0;i<await buttons.count();i++){const button=buttons.nth(i);await button.scrollIntoViewIfNeeded();await settleMotion(page);const box=await button.boundingBox();assert(box&&box.height>=44,'LEAK_QUOTE_FOOTER_44PX');}await footer(page,'닫기').click();await openMore(page);assert.equal(await page.locator('.more-cat-block [data-moreaction]').count(),126,'LEAK_QUOTE_MORE_126_DOM');const actions=await page.evaluate(()=>MORE_CATS.flatMap(cat=>cat.items.map(item=>item[0])));assert.equal(actions.length,126);assert.equal(new Set(actions).size,126,'LEAK_QUOTE_MORE_126_UNIQUE');await page.locator('#moreSheetClose').click();await page.waitForFunction(()=>!document.getElementById('moreSheet')&&!__mobileSheetHistoryRetire);const read=await snap(page);await page.evaluate(name=>{const p=state.projects.find(p=>p.name===name);for(let i=0;i<3;i++){hjLeakQuoteItems(p);hjLeakReceiptPending();hjLeakCardHtml(p);}render();},LEAK);await same(page,read,'LEAK_QUOTE_READERS_PRESERVE_STORED_DATA');
}

/* PRIVATE v421 additions. Insert these three functions before the runner.
   Uses existing test helpers only; no production function is replaced except
   the narrow native IDB abort and the real snapshot completion gate below. */

async function quickExternalEdit({page}){
 const before=await snap(page);await quickOpen(page);await fillQuick(page);
 const quickDraft=await page.evaluate(()=>JSON.parse(JSON.stringify(state.editingQuote)));
 await footer(page,'닫기').click();await page.waitForFunction(()=>!document.getElementById('hjLeakQuoteForm'));
 assert.equal(await page.evaluate(()=>state.editingQuote&&state.editingQuote.id),quickDraft.id,'LEAK_QUOTE_MODIFIED_QUICK_DRAFT_RETAINED');
 await page.evaluate(()=>{state.tab='quotemaker';render();});await page.locator('#qmTitle').waitFor();
 await page.locator('[data-qi="0"][data-qf="name"]').fill('TEST_FULL_EDITOR_CUSTOM_ITEM');await page.locator('[data-qi="0"][data-qf="name"]').blur();
 await page.locator('[data-qi="0"][data-qf="price"]').fill('76543');await page.locator('[data-qi="0"][data-qf="price"]').blur();
 await page.locator('[data-qi="1"][data-qf="qty"]').fill('3.75');await page.locator('[data-qi="1"][data-qf="qty"]').blur();
 const edited=await page.evaluate(()=>JSON.parse(JSON.stringify(state.editingQuote)));
 assert.equal(edited.id,quickDraft.id,'LEAK_QUOTE_FULL_EDITOR_SAME_DRAFT');assert.equal(edited.items[0].name,'TEST_FULL_EDITOR_CUSTOM_ITEM');assert.equal(Number(edited.items[0].price),76543);assert.equal(Number(edited.items[1].qty),3.75);
 await page.evaluate(()=>{state.tab='dashboard';render();});await selectProject(page,LEAK);await page.locator('[data-leakquote="'+LEAK+'"]').click();await turn(page);
 assert.equal(await page.locator('#hjLeakQuoteForm').count(),0,'LEAK_QUOTE_STALE_ROWS_MUST_NOT_REOPEN');
 assert.deepEqual(await page.evaluate(()=>state.editingQuote),edited,'LEAK_QUOTE_FULL_EDITOR_CHANGES_PRESERVED');
 assert.equal(await page.evaluate(()=>state.tab),'quotemaker','LEAK_QUOTE_EXTERNAL_EDIT_RETURNS_FULL_EDITOR');assert.equal(await page.locator('#qmTitle').count(),1);
 assert.equal(await page.locator('[data-qi="0"][data-qf="name"]').inputValue(),'TEST_FULL_EDITOR_CUSTOM_ITEM');assert.equal(Number((await page.locator('[data-qi="0"][data-qf="price"]').inputValue()).replace(/,/g,'')),76543);
 await same(page,before,'LEAK_QUOTE_DRAFT_EDITOR_SWITCH_NEVER_SAVES');
}

async function quickBlankPrice({page}){
 const before=await snap(page);await quickOpen(page);
 for(let i=0;i<NAMES.length;i++)await page.locator('[data-leakquote-check="'+i+'"]').setChecked(i===0||i===3);
 await page.locator('[data-leakquote-price="3"]').fill('');
 await page.evaluate(()=>{window.__leakBlankCommitCalls=0;const original=quoteCommitEditing;quoteCommitEditing=function(...args){window.__leakBlankCommitCalls++;return original.apply(this,args);};});
 for(const action of ['저장','고객에게 보여주기','문자 초안']){
  await footer(page,action).click();await turn(page);
  assert.equal(await page.locator('#hjLeakQuoteForm').count(),1,'LEAK_QUOTE_BLANK_PRICE_STAYS_IN_EDITOR '+action);
  assert.equal(await page.locator('#hjLeakQuoteCustomer').count(),0,'LEAK_QUOTE_BLANK_PRICE_NO_CUSTOMER_TOTAL '+action);assert.equal(await page.locator('#mcBody').count(),0,'LEAK_QUOTE_BLANK_PRICE_NO_SMS '+action);
  assert.match(await page.locator('#hjLeakQuoteIssue').textContent(),/방수 보수.*단가/,'LEAK_QUOTE_BLANK_PRICE_EXPLAINS_ITEM '+action);assert.match(await page.locator('#hjLeakQuoteTotal').textContent(),/확인 필요/,'LEAK_QUOTE_BLANK_PRICE_NOT_FREE '+action);
  assert.equal(await page.evaluate(()=>window.__leakBlankCommitCalls),0,'LEAK_QUOTE_BLANK_PRICE_NEVER_COMMITS');await same(page,before,'LEAK_QUOTE_BLANK_PRICE_NOT_SAVED '+action);
 }
 // Explicitly choosing a free item is different from an unknown blank price.
 await page.locator('[data-leakquote-price="3"]').fill('0');await footer(page,'고객에게 보여주기').click();await page.locator('#hjLeakQuoteCustomer').waitFor();assert.match(await page.locator('#hjLeakQuoteCustomer').textContent(),/165,000/,'LEAK_QUOTE_EXPLICIT_ZERO_VALID_TOTAL');await footer(page,'편집으로').click();await footer(page,'저장').click();await page.waitForFunction(()=>state.quotes.length===1);await persist(page);
 assert.equal(await page.evaluate(()=>window.__leakBlankCommitCalls),1,'LEAK_QUOTE_EXPLICIT_ZERO_COMMITS_ONCE');const after=await snap(page),free=after.data.quotes[0].items.find(row=>row.name==='방수 보수');assert(free,'LEAK_QUOTE_EXPLICIT_ZERO_ITEM_KEPT');assert.equal(Number(free.price),0);assert.notEqual(free.price,'');assert.equal(after.stored.quotes.length,1,'LEAK_QUOTE_EXPLICIT_ZERO_DURABLE');assert.deepEqual(after.keys,before.keys,'LEAK_QUOTE_BLANK_VALIDATION_TOP_KEYS');
}

async function paymentFailureProtection({page}){
 await quickOpen(page);await fillQuick(page);await footer(page,'저장').click();await page.waitForFunction(()=>state.quotes.length===1);await persist(page);
 const qid=await page.evaluate(()=>state.quotes[0].id);
 const open=async()=>{await page.evaluate(id=>{closeModal(true);hjLeakPaymentView(state.quotes.find(q=>q.id===id));},qid);await page.locator('#hjLeakPayAmount').waitFor();await page.locator('#hjLeakPayMethod').selectOption('계좌이체');await page.locator('#hjLeakPayAmount').fill('120000');await page.locator('#hjLeakPayDate').fill(TODAY);await page.locator('#hjLeakPayReceipt').selectOption('세금계산서');await page.locator('#hjLeakPayIssued').uncheck();};
 const nativePaid=async()=>page.evaluate(async()=>{
  const keys=await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readonly'),get=tx.objectStore('kv').getAllKeys();get.onsuccess=()=>resolve(get.result.filter(key=>typeof key==='string'&&key.startsWith('paid_commit_')).sort());get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close();};});
  const entries=[];for(const key of keys)entries.push([key,await idbGet(key)]);return entries;
 });
 await open();await page.evaluate(()=>{state.dirty=false;});const before=await snap(page),nativeBefore=await nativePaid();
 await page.evaluate(()=>{
  window.__leakPayNativePut=IDBObjectStore.prototype.put;window.__leakPayFault={requested:0,succeeded:0,aborted:0,key:''};
  IDBObjectStore.prototype.put=function(value,key){
   const request=window.__leakPayNativePut.call(this,value,key);
   if(typeof key==='string'&&key.startsWith('paid_commit_generation:')){
    const fault=window.__leakPayFault;fault.requested++;fault.key=key;const transaction=this.transaction;
    transaction.addEventListener('abort',()=>{fault.aborted++;},{once:true});
    request.addEventListener('success',()=>{fault.succeeded++;transaction.abort();},{once:true});
   }
   return request;
  };
 });
 try{
  await footer(page,'저장').click();await page.waitForFunction(()=>window.__leakPayFault.aborted===1&&!!document.getElementById('hjLeakPayIssue')&&document.getElementById('hjLeakPayIssue').textContent.length>0&&!__modalCloseLocked);
  assert.deepEqual(await page.evaluate(()=>({requested:window.__leakPayFault.requested,succeeded:window.__leakPayFault.succeeded,aborted:window.__leakPayFault.aborted})),{requested:1,succeeded:1,aborted:1},'LEAK_PAYMENT_REAL_IDB_TRANSACTION_ABORT');
  await same(page,before,'LEAK_PAYMENT_IDB_ABORT_NO_PARTIAL_LIVE_OR_SAVED_RECORDS');assert.deepEqual(await nativePaid(),nativeBefore,'LEAK_PAYMENT_IDB_ABORT_ALL_PAID_KEYS_UNCHANGED');assert.equal(await page.evaluate(()=>state.dirty),false,'LEAK_PAYMENT_IDB_ABORT_NOT_DIRTY');assert.equal(await page.locator('#hjLeakPayAmount').inputValue(),'120000','LEAK_PAYMENT_IDB_ABORT_INPUT_RETAINED');
 }finally{await page.evaluate(()=>{if(window.__leakPayNativePut)IDBObjectStore.prototype.put=window.__leakPayNativePut;});}
 await footer(page,'취소').click();
 // Wait inside the real recovery snapshot, then alter the live saved quote.
 // No application write function is mocked into success and no stored customer
 // record is modified: this is the isolated synthetic state only.
 await open();const raceBefore=await snap(page),nativeRaceBefore=await nativePaid();
 await page.evaluate(()=>{
  const original=hjSnapshot;window.__leakPaySnapshotOriginal=original;window.__leakPayGate={entered:false,release:null};const gate=new Promise(resolve=>{window.__leakPayGate.release=resolve;});
  hjSnapshot=async function(...args){const ok=await original.apply(this,args);if(args[0]==='누수 견적 받은 돈 기록 전'){window.__leakPayGate.entered=true;await gate;}return ok;};
 });
 try{
  await footer(page,'저장').click();await page.waitForFunction(()=>window.__leakPayGate.entered&&__modalCloseLocked);
  await page.evaluate(id=>{state.quotes.find(q=>q.id===id).title='TEST_CONCURRENT_QUOTE_EDIT';window.__leakPayGate.release();},qid);
  await page.waitForFunction(()=>!!document.getElementById('hjLeakPayIssue')&&/바뀌/.test(document.getElementById('hjLeakPayIssue').textContent)&&!__modalCloseLocked);await queue(page);
  const after=await snap(page),expected=JSON.parse(JSON.stringify(raceBefore.data));expected.quotes.find(q=>q.id===qid).title='TEST_CONCURRENT_QUOTE_EDIT';
  assert.deepEqual(after.data,expected,'LEAK_PAYMENT_SNAPSHOT_RACE_PRESERVES_CONCURRENT_QUOTE');assert.deepEqual(after.stored,raceBefore.stored,'LEAK_PAYMENT_SNAPSHOT_RACE_NO_STORED_PAYMENT');assert.equal(after.pointer,raceBefore.pointer);assert.deepEqual(after.generation,raceBefore.generation);assert.deepEqual(after.keys,raceBefore.keys);assert.deepEqual(await nativePaid(),nativeRaceBefore,'LEAK_PAYMENT_SNAPSHOT_RACE_NO_PAID_COMMIT');assert.equal(after.data.payLog.length,0,'LEAK_PAYMENT_SNAPSHOT_RACE_NO_LOG');assert.equal(after.data.projects.find(p=>p.name===LEAK).received,0,'LEAK_PAYMENT_SNAPSHOT_RACE_NO_RECEIVED');assert.equal(after.data.quotes[0].paid,undefined,'LEAK_PAYMENT_SNAPSHOT_RACE_NO_PAID');assert.equal(await page.evaluate(()=>state.dirty),false,'LEAK_PAYMENT_SNAPSHOT_RACE_NOT_DIRTY');
 }finally{await page.evaluate(()=>{if(window.__leakPayGate&&window.__leakPayGate.release)window.__leakPayGate.release();if(window.__leakPaySnapshotOriginal)hjSnapshot=window.__leakPaySnapshotOriginal;});}
}


(async()=>{const opts={headless:true};if(process.env.PLAYWRIGHT_EXECUTABLE)opts.executablePath=process.env.PLAYWRIGHT_EXECUTABLE;else if(process.platform!=='win32')opts.executablePath='/opt/pw-browsers/chromium';browser=await chromium.launch(opts);if(CANARY){const t=await boot();await t.context.close();console.log('PASS LEAK_QUOTE_FEATURE_PRESENT');return;}if(MUTATION){await run('변이 동일 본문 '+MUTATION,MUTATION==='names'?defaults:payment);throw new Error('MUTATION_NOT_DETECTED '+MUTATION);}await run('① 원인별 네 세트·정확 품명·priceBook·빈 단가·읽기 불변',defaults);await run('② 템플릿 추가/바꾸기/취소·실제 저장 단가 학습',template);await run('③ 즉시 견적 고객보기·문자 초안·실제 저장·이력·팔로업',quickSave);await run('④ 기존 미저장 견적 계속/저장/버리기 보호',unsaved);await run('⑤ 받은 돈 실제 저장·반복/수정 한 건·미발행 대시보드',payment);await run('⑥ 인테리어 숨김·390px·44px·더보기126·저장본 불변',scope);await run('⑦ 간이 견적 닫기→전체 편집 변경→재진입 손실 방지',quickExternalEdit);
await run('⑧ 빈 선택 단가 저장·고객보기·문자 차단 및 명시 0 허용',quickBlankPrice);
await run('⑨ 실제 IDB 중단 및 안전판 대기 중 견적 변경 보호',paymentFailureProtection);console.log('PASS leakquote-v421 '+passed+'/9; separate mutations: names, duplicate');})().catch(error=>{if(MUTATION&&error.code==='ERR_ASSERTION'&&String(error.message).includes(MUTATION_MARKER[MUTATION]))console.error('MUTATION_DETECTED '+MUTATION+' '+MUTATION_MARKER[MUTATION]);console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

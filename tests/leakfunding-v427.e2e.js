/* v427 누수 비용 출처·제출 서류 체크: 390px, 격리 합성 IndexedDB, 실제 로컬 저장, 외부 호출 0.
   Keep 8299 in committed source; only the isolated test copy rewrites the port.
   --canary: fail fast on a build without v427 (the typeof assertion must fail on the v426 head).
   HJ_LEAK_FUNDING_MUTATION=purpose|whitelist|chip|resume|stamp|conflict: run the SAME relevant
   scenario after removing one protection in-page. Only the named ERR_ASSERTION prints
   MUTATION_DETECTED; timeout, launch, boot or unrelated assertion failures are never proof.
   Version strings are never hardcoded here (read sw.js const C if a pin is ever needed).
   Optional HJ_LEAK_FUNDING_SCREENSHOT_DIR saves synthetic mobile evidence only. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',APP=BASE+'/index.html';
const MUTATION=process.env.HJ_LEAK_FUNDING_MUTATION||'',CANARY=process.argv.includes('--canary');
assert(['','purpose','whitelist','chip','resume','stamp','conflict'].includes(MUTATION),'unknown HJ_LEAK_FUNDING_MUTATION');
const LEAK='누수 출처 알파',INTERIOR='주거 검증 베타',LEAK_OFFICE='관리비 누수 감마',LEAK_CONTRA='보험 모순 델타',LEAK_PLAIN='출처 없는 엡실론';
const NOW='2026-11-06T08:40:00+09:00',TODAY='2026-11-06',ADDRESS='TEST_ONLY_ADDRESS_V427',INTAKE_AT='2026-11-04T09:00:00+09:00';
const MUTATION_MARKER={purpose:'LEAK_FUNDING_REPORT_DEFAULT_OFFICE',whitelist:'LEAK_FUNDING_DOCS_WHITELIST',chip:'LEAK_FUNDING_CHIP_PRESENT',resume:'LEAK_FUNDING_RESUME_KEEPS_SOURCE',stamp:'LEAK_FUNDING_INTAKE_STAMP_COVERS_FUNDING',conflict:'LEAK_FUNDING_CONTRADICTION_HINT'};
let browser,passed=0;
function project(name,extra={}){return {name,stage:0,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{name:'TEST_CUSTOMER',phone:'',addr:ADDRESS},archived:false,...extra};}
function intake(extra={}){return {where:['욕실','천장'],since:'2~3일',amount:'똑똑 떨어짐',neighbor:'아랫집에서 연락 옴',office:'했음',insurance:'일상배상책임 있음',memo:'TEST 접수',at:INTAKE_AT,...extra};}
function fixture(){return {version:2,app:'현장',savedAt:new Date(NOW).toISOString(),files:[],notes:[],contacts:[],priceBook:{},schedule:[],
 quotes:[{id:'TEST_LEAK_QUOTE_427',title:'TEST 누수 수리 견적',project:LEAK_OFFICE,date:TODAY,place:ADDRESS,vatIncluded:true,items:[{name:'출장·탐지비',spec:'식',qty:1,price:150000},{name:'배관 교체',spec:'m',qty:2.5,price:42000}],leak:{cause:'급수관',zone:'전유부',from:'template',at:new Date(NOW).toISOString()},paid:{method:'계좌이체',amount:120000,at:TODAY,receipt:{type:'세금계산서',issued:false},payLogId:'TEST_PAID_427'}}],
 payLog:[{id:'TEST_PAID_427',project:LEAK_OFFICE,quoteId:'TEST_LEAK_QUOTE_427',d:TODAY,amt:120000,method:'계좌이체'}],
 projects:[
  project(LEAK,{kind:'leak',leak:{intake:intake()}}),
  project(INTERIOR,{customer:{name:'TEST_CUSTOMER',phone:'',addr:''}}), // no kind key on purpose: legacy interior protection
  project(LEAK_OFFICE,{kind:'leak',received:120000,leak:{intake:intake(),funding:{source:'office',docs:['quote','TEST_INVALID_DOC'],at:INTAKE_AT}}}),
  project(LEAK_CONTRA,{kind:'leak',leak:{intake:intake({insurance:'없음'}),funding:{source:'insurance',docs:[]}}}),
  project(LEAK_PLAIN,{kind:'leak',leak:{intake:{where:['주방'],at:INTAKE_AT}}})]};}
const footer=(page,label)=>page.locator('#modalRoot .mfoot').getByRole('button',{name:label,exact:true});
async function turn(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function queue(page){await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;});}
async function persist(page){assert.equal(await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;const ok=await guardedPersistCurrentState();await __appStateWriteQueue;return ok;}),true,'LEAK_FUNDING_FIXTURE_DURABLE');}
async function snap(page){return page.evaluate(async()=>{await __appStateWriteQueue;const clean=value=>{if(value==null)return value;const copy=JSON.parse(JSON.stringify(value));delete copy.savedAt;return copy;};const data=clean(serializeData()),pointer=await idbGet('paid_commit_pointer');return {keys:Object.keys(data).sort(),data,stored:clean(await idbGet('appState')),pointer:pointer||null,generation:pointer?clean(await idbGet(pointer)):null,unrelated:localStorage.getItem('leakfunding_unrelated')};});}
async function same(page,before,label){assert.deepEqual(await snap(page),before,label);}
async function geometry(page,selectors){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'LEAK_FUNDING_NO_HORIZONTAL_OVERFLOW');
 for(const selector of selectors){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const box=await el.boundingBox();assert(box&&box.width>=43.5&&box.height>=43.5,'LEAK_FUNDING_44PX '+selector);}
}
async function modalFits(page,label){assert(await page.evaluate(()=>{const m=document.querySelector('#modalRoot .modal');return !!m&&m.scrollWidth<=m.clientWidth+1;}),'LEAK_FUNDING_NO_HORIZONTAL_OVERFLOW modal '+label);const heights=await page.locator('#modalRoot .mfoot button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));assert(heights.length&&heights.every(h=>h>=43.5),'LEAK_FUNDING_44PX footer '+label+' '+heights.join(','));}
async function screenshot(page,name,selector){if(process.env.HJ_LEAK_FUNDING_SCREENSHOT_DIR){if(selector)await page.locator(selector).scrollIntoViewIfNeeded();else await page.evaluate(()=>window.scrollTo(0,0));await turn(page);await page.screenshot({path:path.join(process.env.HJ_LEAK_FUNDING_SCREENSHOT_DIR,name+'.png')});}}
/* Boot-end signals + timer neutralization live here so a reload can reuse them. No fixed waits. */
async function settle(page){
 await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
 await page.evaluate(async()=>{await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);if(window.__hjShareInboxBootDone)await window.__hjShareInboxBootDone;taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};portalAutoSync=()=>{};aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;closeModal(true);state._demo=false;state.dirHandle=null;state.editingQuote=null;state.activeProject=null;state.tab='dashboard';__tabStale=false;__gdToken=null;relayReady=()=>false;
  window.__reportUnexpected=[];const deny=name=>(...args)=>{window.__reportUnexpected.push(name);throw new Error('REPORT_UNEXPECTED '+name);};window.open=deny('window.open');hjSendSms=deny('send SMS');getFileOf=deny('original file');gdGetToken=deny('account');gdUploadBlob=deny('Drive');cloudApiUploadFile=deny('relay upload');__docExport=deny('docExport');Object.defineProperty(navigator,'share',{configurable:true,value:deny('share')});render();});
 await persist(page);await turn(page);
}
async function boot(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Seoul'}),errors=[],externalWrites=[],effects=[];
 context.on('page',page=>{page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(35000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());page.on('download',()=>effects.push('real download'));page.on('popup',()=>effects.push('popup'));});
 await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){externalWrites.push(request.method()+' '+url.origin+url.pathname);return route.abort();}if(url.origin!==BASE)return route.abort();if(url.pathname==='/__leakfunding_seed__')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>synthetic funding fixture</title>'});return route.continue();});
 // Only the clock is controlled. Real timers, animation frames, persistence and commit code stay intact.
 await context.addInitScript(now=>{const NativeDate=Date;window.__leakFundingNow=NativeDate.parse(now);class FundingDate extends NativeDate{constructor(...args){super(...(args.length?args:[window.__leakFundingNow]));}static now(){return window.__leakFundingNow;}}window.Date=FundingDate;},NOW);
 const seed=await context.newPage();await seed.goto(BASE+'/__leakfunding_seed__');
 await seed.evaluate(async data=>{for(const [key,value]of Object.entries({hj_onboard_done:'1',pref_mobile:'1',hj_ver_checked_at:String(Date.now()),hj_gcal_auto:'0',hj_more_recent:'[]',hj_more_favorites:'[]',leakfunding_unrelated:'TEST_KEEP'}))localStorage.setItem(key,value);await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(data,'appState');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},fixture());await seed.close();
 const page=await context.newPage();
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  assert(await page.evaluate(()=>typeof hjLeakFundingData==='function'&&typeof hjLeakFundingSave==='function'&&typeof hjLeakFundingView==='function'&&typeof hjLeakReportDefaultPurpose==='function'&&typeof hjLeakIntakeStamp==='function'&&typeof HJ_LEAK_FUNDING_DOCS==='object'&&HJ_LEAK_FUNDING_DOCS!==null),'LEAK_FUNDING_FEATURE_PRESENT');
  if(CANARY)return {context,page,errors,externalWrites,effects};
  await settle(page);return {context,page,errors,externalWrites,effects};
 }catch(error){await context.close();throw error;}
}
async function openMore(page){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('.mobile-nav [data-mnav="__more"]').click();await page.locator('#moreSheet').waitFor();}
async function selectProject(page,name){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('#projChip').click();await page.locator('#projSheet').waitFor();await page.locator('#psList [data-psel="'+name+'"]').click();await page.waitForFunction(()=>!document.getElementById('projSheet')&&!__mobileSheetHistoryRetire);await turn(page);}
async function closeModal(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await turn(page);}
async function openIntake(page,name){await selectProject(page,name);await page.locator('[data-leakintake="'+name+'"]').click();await page.locator('#hjLeakIntake').waitFor();}
async function openFunding(page,name){await selectProject(page,name);await page.locator('[data-leakfunding="'+name+'"]').click();await page.locator('#hjLeakFundingModal').waitFor();}
async function openReport(page,name){await selectProject(page,name);await page.locator('[data-leakreport="'+name+'"]').click();await page.locator('#hjLeakReportForm').waitFor();}
async function fundingOf(snapshot,name){return (snapshot.stored.projects.find(p=>p.name===name).leak||{}).funding;}
async function run(name,fn){const t=await boot();try{await fn(t);assert.deepEqual(t.errors,[],'LEAK_FUNDING_NO_PAGE_ERRORS '+name);assert.deepEqual(t.externalWrites,[],'LEAK_FUNDING_NO_NETWORK_WRITES '+name);assert.deepEqual(t.effects,[],'LEAK_FUNDING_NO_REAL_DOWNLOAD_OR_POPUP '+name);assert.deepEqual(await t.page.evaluate(()=>window.__reportUnexpected),[],'LEAK_FUNDING_NO_ORIGINAL_ACCOUNT_SEND '+name);passed++;console.log('PASS '+name);}finally{await t.context.close();}}

async function readers({page}){
 if(MUTATION==='whitelist')await page.evaluate(()=>{const original=hjLeakFundingData;hjLeakFundingData=function(p){const out=original(p);const raw=p&&p.leak&&p.leak.funding;if(raw&&Array.isArray(raw.docs))out.docs=raw.docs.slice();return out;};});
 const before=await snap(page);
 const pure=await page.evaluate(names=>{const ps=names.map(n=>state.projects.find(p=>p.name===n));const out={};for(let n=0;n<3;n++)for(const p of ps){const f=hjLeakFundingData(p);hjLeakFundingSummary(f);hjLeakFundingChip(p);hjLeakFundingConflict(hjLeakIntakeData(p),'insurance');hjLeakReportDefaultPurpose(p);hjLeakFundingProgress(f);hjLeakCardHtml(p);out[p.name]={data:f,chip:hjLeakFundingChip(p),purpose:hjLeakReportDefaultPurpose(p),ownKind:Object.prototype.hasOwnProperty.call(p,'kind')};}
  return {out,catalog:{labels:Object.keys(HJ_LEAK_FUNDING_DOC_LABELS),docs:HJ_LEAK_FUNDING_DOCS,sources:HJ_LEAK_FUNDING_SOURCES,texts:[...Object.values(HJ_LEAK_FUNDING_DOC_LABELS),...Object.values(HJ_LEAK_FUNDING_SOURCES),HJ_LEAK_FUNDING_NOTICE]},actions:MORE_CATS.flatMap(c=>c.items.map(i=>i[0]))};},[LEAK,INTERIOR,LEAK_OFFICE,LEAK_CONTRA,LEAK_PLAIN]);
 await same(page,before,'LEAK_FUNDING_PURE_READERS');
 assert.deepEqual(pure.out[LEAK_OFFICE].data,{source:'office',docs:['quote'],at:INTAKE_AT},'LEAK_FUNDING_DOCS_WHITELIST');
 assert.deepEqual(pure.out[LEAK].data,{source:'',docs:[]});assert.equal(pure.out[LEAK].purpose,'insurance','LEAK_FUNDING_DEFAULT_FALLBACK');assert.match(pure.out[LEAK].chip,/비용 출처 미입력/,'LEAK_FUNDING_DEFAULT_FALLBACK');
 assert.equal(pure.out[LEAK_OFFICE].purpose,'office');assert.match(pure.out[LEAK_OFFICE].chip,/관리사무소\(관리비·공용부\) · 서류 1\/7/);assert.equal(pure.out[LEAK_CONTRA].purpose,'insurance');assert.match(pure.out[LEAK_CONTRA].chip,/보험 청구 · 서류 0\/7/);
 assert.equal(pure.out[INTERIOR].ownKind,false,'LEAK_FUNDING_LEGACY_NO_KIND');assert.deepEqual(pure.out[INTERIOR].data,{source:'',docs:[]});
 for(const [source,ids]of Object.entries(pure.catalog.docs)){assert(ids.length>=4&&ids.length<=7,'LEAK_FUNDING_CATALOG_SUBSET size '+source);assert(ids.every(id=>pure.catalog.labels.includes(id)),'LEAK_FUNDING_CATALOG_SUBSET '+source);assert(pure.catalog.sources[source],'LEAK_FUNDING_CATALOG_SUBSET source '+source);}
 assert.deepEqual(Object.keys(pure.catalog.sources),['self','office','insurance','undecided']);
 for(const text of pure.catalog.texts)for(const banned of ['무료','보장','승인됨','제출 완료'])assert(!text.includes(banned),'LEAK_FUNDING_NO_FREE_CLAIM '+text);
 assert.equal(pure.actions.length,126,'LEAK_FUNDING_MORE_126');assert.equal(new Set(pure.actions).size,126,'LEAK_FUNDING_MORE_126');
 await selectProject(page,INTERIOR);assert.equal(await page.locator('[data-leakfunding]').count(),0,'LEAK_FUNDING_NO_INTERIOR_ENTRY');assert.equal(await page.locator('[data-leak-card]').count(),0,'LEAK_FUNDING_NO_INTERIOR_ENTRY card');
 await openMore(page);assert.equal(await page.locator('.more-cat-block [data-moreaction]').count(),126,'LEAK_FUNDING_MORE_126 dom');await page.locator('#moreSheetClose').click();await page.waitForFunction(()=>!document.getElementById('moreSheet')&&!__mobileSheetHistoryRetire);
 const after=await snap(page);assert.deepEqual(after.keys,before.keys,'LEAK_FUNDING_TOP_KEYS');assert.deepEqual(after.data,before.data,'LEAK_FUNDING_PURE_READERS after navigation');
}

async function intakePath({page}){
 const before=await snap(page);
 // '선택 안 함' on a record without funding must not create an empty funding object.
 await openIntake(page,LEAK_PLAIN);assert.equal(await page.locator('#hjLeakFunding').inputValue(),'');await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 let after=await snap(page);const plain=after.stored.projects.find(p=>p.name===LEAK_PLAIN);assert.equal(Object.prototype.hasOwnProperty.call(plain.leak,'funding'),false,'LEAK_FUNDING_NO_EMPTY_OBJECT');assert.equal(after.data.notes.filter(n=>n.project===LEAK_PLAIN&&n.text.startsWith('[누수 접수] ')).length,1);assert(!after.data.notes.find(n=>n.project===LEAK_PLAIN).text.includes('비용 출처'),'LEAK_FUNDING_NO_EMPTY_OBJECT note');
 await openIntake(page,LEAK);assert.equal(await page.locator('#hjLeakFunding').inputValue(),'');await page.locator('#hjLeakFunding').selectOption('insurance');
 await geometry(page,['#hjLeakFunding','#hjLeakSince','#hjLeakAmount','#hjLeakNeighbor','#hjLeakOffice','#hjLeakInsurance']);await modalFits(page,'intake');await screenshot(page,'v427-intake-funding-390','#hjLeakFunding');
 await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 after=await snap(page);const stored=after.stored.projects.find(p=>p.name===LEAK),live=after.data.projects.find(p=>p.name===LEAK);
 assert.deepEqual(stored.leak.funding,{source:'insurance',docs:[],at:new Date(NOW).toISOString()},'LEAK_FUNDING_INTAKE_SOURCE_DURABLE');assert.deepEqual(live.leak.funding,stored.leak.funding,'LEAK_FUNDING_INTAKE_SOURCE_DURABLE live');
 assert.equal(Object.prototype.hasOwnProperty.call(stored.leak.intake,'funding'),false,'LEAK_FUNDING_NOT_IN_INTAKE');assert.deepEqual(Object.keys(stored.leak.intake).sort(),['amount','at','insurance','memo','neighbor','office','since','where'],'LEAK_FUNDING_INTAKE_FIELDS_INTACT');
 assert.deepEqual({where:stored.leak.intake.where,since:stored.leak.intake.since,amount:stored.leak.intake.amount,neighbor:stored.leak.intake.neighbor,office:stored.leak.intake.office,insurance:stored.leak.intake.insurance,memo:stored.leak.intake.memo},{where:['욕실','천장'],since:'2~3일',amount:'똑똑 떨어짐',neighbor:'아랫집에서 연락 옴',office:'했음',insurance:'일상배상책임 있음',memo:'TEST 접수'},'LEAK_FUNDING_INTAKE_FIELDS_INTACT values');
 const notes=after.data.notes.filter(n=>n.project===LEAK&&n.text.startsWith('[누수 접수] '));assert.equal(notes.length,1,'LEAK_FUNDING_INTAKE_NOTE_ONE');assert(!/[\r\n]/.test(notes[0].text),'LEAK_FUNDING_INTAKE_NOTE_ONE line');assert(notes[0].text.startsWith('[누수 접수] '+TODAY+' · '));assert(notes[0].text.includes('비용 출처 보험 청구'),'LEAK_FUNDING_INTAKE_NOTE_ONE source');
 assert.equal(await page.evaluate(()=>state.dirty),true,'LEAK_FUNDING_SAVE_SYNC_DIRTY');
 if(MUTATION==='chip')await page.evaluate(()=>{hjLeakFundingChip=()=>'';render();});
 await turn(page);assert.match(await page.locator('[data-leak-card]').textContent(),/💰 보험 청구 · 서류 0\/7/,'LEAK_FUNDING_CHIP_PRESENT');
 assert.deepEqual(after.data.projects.find(p=>p.name===INTERIOR),before.data.projects.find(p=>p.name===INTERIOR),'LEAK_FUNDING_LEGACY_RECORD_UNCHANGED');assert.equal(after.unrelated,'TEST_KEEP');assert.deepEqual(after.keys,before.keys,'LEAK_FUNDING_TOP_KEYS');
 // Changing the source in the intake modal re-filters saved doc checks: the hint must say how many would be dropped, and clearing the source leaves a note tail.
 await openIntake(page,LEAK_OFFICE);assert.equal(await page.locator('#hjLeakFunding').inputValue(),'office');assert.equal(await page.locator('#hjLeakFundingHint').textContent(),'','LEAK_FUNDING_INTAKE_DROP_HINT same source');
 await page.locator('#hjLeakFunding').selectOption('insurance');assert.equal(await page.locator('#hjLeakFundingHint').textContent(),'','LEAK_FUNDING_INTAKE_DROP_HINT shared id survives');
 await page.locator('#hjLeakFunding').selectOption('');const dropHint=await page.locator('#hjLeakFundingHint').textContent();assert.match(dropHint,/지워져요/,'LEAK_FUNDING_INTAKE_DROP_HINT');assert.match(dropHint,/1건 중 1건/,'LEAK_FUNDING_INTAKE_DROP_HINT count');
 await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 const cleared=await snap(page),office=cleared.stored.projects.find(p=>p.name===LEAK_OFFICE);assert.deepEqual(office.leak.funding,{source:'',docs:[],at:new Date(NOW).toISOString()},'LEAK_FUNDING_INTAKE_CLEAR_SOURCE');
 const clearNotes=cleared.data.notes.filter(n=>n.project===LEAK_OFFICE&&n.text.startsWith('[누수 접수] '));assert.equal(clearNotes.length,1,'LEAK_FUNDING_INTAKE_CLEAR_NOTE');assert(clearNotes[0].text.endsWith(' · 비용 출처 지움'),'LEAK_FUNDING_INTAKE_CLEAR_NOTE tail');assert(!/[\r\n]/.test(clearNotes[0].text),'LEAK_FUNDING_INTAKE_CLEAR_NOTE line');
 await turn(page);assert.match(await page.locator('[data-leak-card]').textContent(),/💰 비용 출처 미입력/,'LEAK_FUNDING_INTAKE_CLEAR_NOTE chip');
 // Re-saving the intake with the same source leaves funding (at, docs) untouched even though the clock moved on.
 await page.evaluate(()=>{window.__leakFundingNow=Date.parse('2026-11-06T09:30:00+09:00');});await openIntake(page,LEAK);assert.equal(await page.locator('#hjLeakFunding').inputValue(),'insurance');await page.locator('#hjLeakMemo').fill('TEST 접수 다시');await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 const again=await snap(page),twice=again.stored.projects.find(p=>p.name===LEAK);assert.deepEqual(twice.leak.funding,stored.leak.funding,'LEAK_FUNDING_INTAKE_KEEPS_FUNDING_WHEN_SAME');assert.equal(twice.leak.intake.memo,'TEST 접수 다시');assert.notEqual(twice.leak.intake.at,stored.leak.intake.at);assert.equal(again.data.notes.filter(n=>n.project===LEAK&&n.text.startsWith('[누수 접수] ')).length,2);
}

async function resume({page}){
 if(MUTATION==='resume')await page.evaluate(()=>{const original=hjLeakIntakeCapture;hjLeakIntakeCapture=function(...args){const draft=original.apply(this,args);delete draft.funding;return draft;};});
 const before=await snap(page);await openIntake(page,LEAK);await page.locator('#hjLeakFunding').selectOption('office');
 const draft=await page.evaluate(name=>hjLeakIntakeCapture(document.getElementById('hjLeakIntake'),hjLeakIntakeStamp(state.projects.find(p=>p.name===name)),[]),LEAK);
 await closeModal(page);assert.equal(await page.evaluate(draft=>hjLeakIntakeView(draft.name,draft.draft),{name:LEAK,draft}),true);await page.locator('#hjLeakIntake').waitFor();
 assert.equal(await page.locator('#hjLeakFunding').inputValue(),'office','LEAK_FUNDING_RESUME_KEEPS_SOURCE');assert.equal(await page.locator('#hjLeakIssue').textContent(),'','LEAK_FUNDING_RESUME_STAMP_MATCH');assert.equal(await page.locator('#hjLeakOffice').inputValue(),'했음');
 await closeModal(page);await same(page,before,'LEAK_FUNDING_RESUME_NO_WRITE');
}

async function docsModal({page,context}){
 const before=await snap(page);await openFunding(page,LEAK_OFFICE);
 assert.equal(await page.locator('#hjLeakFundingSource').inputValue(),'office');assert.equal(await page.locator('[data-leakfundingdoc]').count(),7,'LEAK_FUNDING_DOCS_RESTORED count');assert.equal(await page.locator('[data-leakfundingdoc="quote"]').isChecked(),true,'LEAK_FUNDING_DOCS_RESTORED');assert.match(await page.locator('#hjLeakFundingDocs legend').textContent(),/1\/7/);assert.match(await page.locator('#hjLeakFundingPurpose').textContent(),/관리사무소용/);
 await geometry(page,['#hjLeakFundingSource',...[0,1,2,3,4,5,6].map(i=>'#hjLeakFundingDocs label >> nth='+i)]);await modalFits(page,'funding');await screenshot(page,'v427-funding-modal-390','#hjLeakFundingDocs');
 await page.locator('[data-leakfundingdoc="officeContact"]').check();await page.locator('[data-leakfundingdoc="photoCause"]').check();await page.locator('#hjLeakFundingSource').selectOption('insurance');
 assert.equal(await page.locator('[data-leakfundingdoc]').count(),7);assert.equal(await page.locator('[data-leakfundingdoc="officeContact"]').count(),0);assert.equal(await page.locator('[data-leakfundingdoc="quote"]').isChecked(),true,'LEAK_FUNDING_SWITCH_KEEPS_SHARED');assert.equal(await page.locator('[data-leakfundingdoc="photoCause"]').isChecked(),true,'LEAK_FUNDING_SWITCH_KEEPS_SHARED');assert.match(await page.locator('#hjLeakFundingDocs legend').textContent(),/2\/7/);assert.match(await page.locator('#hjLeakFundingPurpose').textContent(),/보험사 제출용/);
 await page.locator('#hjLeakFundingSource').selectOption('office');assert.equal(await page.locator('[data-leakfundingdoc="officeContact"]').isChecked(),true,'LEAK_FUNDING_SWITCH_BACK_RESTORES');assert.match(await page.locator('#hjLeakFundingDocs legend').textContent(),/3\/7/);
 await page.locator('#hjLeakFundingSource').selectOption('');assert.equal(await page.locator('[data-leakfundingdoc]').count(),0);assert.match(await page.locator('#hjLeakFundingDocs').textContent(),/비용 출처를 고르면/);
 await page.locator('#hjLeakFundingSource').selectOption('insurance');await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 const after=await snap(page),saved={source:'insurance',docs:['photoCause','quote'],at:new Date(NOW).toISOString()};
 assert.deepEqual(await fundingOf(after,LEAK_OFFICE),saved,'LEAK_FUNDING_DOCS_DURABLE');assert.deepEqual(after.data.projects.find(p=>p.name===LEAK_OFFICE).leak.funding,saved,'LEAK_FUNDING_DOCS_DURABLE live');
 const notes=after.data.notes.filter(n=>n.project===LEAK_OFFICE&&n.text.startsWith('[비용 출처] '));assert.equal(notes.length,1,'LEAK_FUNDING_DOC_NOTE_ONE');assert(!/[\r\n]/.test(notes[0].text),'LEAK_FUNDING_DOC_NOTE_ONE line');assert.equal(notes[0].text,'[비용 출처] '+TODAY+' · 비용 출처 보험 청구 · 서류 2/7');
 assert.equal(after.data.notes.filter(n=>n.text.startsWith('[누수 접수] ')).length,before.data.notes.filter(n=>n.text.startsWith('[누수 접수] ')).length,'LEAK_FUNDING_DOC_NOTE_ONE no intake note');
 await turn(page);assert.match(await page.locator('[data-leak-card]').textContent(),/💰 보험 청구 · 서류 2\/7/,'LEAK_FUNDING_CHIP_COUNT');
 const leakBefore=before.stored.projects.find(p=>p.name===LEAK_OFFICE).leak,leakAfter=after.stored.projects.find(p=>p.name===LEAK_OFFICE).leak;assert.deepEqual(leakAfter.intake,leakBefore.intake,'LEAK_FUNDING_INTAKE_AT_UNCHANGED');assert.deepEqual(Object.keys(leakAfter).sort(),Object.keys(leakBefore).sort(),'LEAK_FUNDING_SIBLING_KEYS_INTACT');
 assert.deepEqual(after.keys,before.keys,'LEAK_FUNDING_TOP_KEYS');assert.equal(after.unrelated,'TEST_KEEP');assert.deepEqual(after.data.projects.find(p=>p.name===INTERIOR),before.data.projects.find(p=>p.name===INTERIOR),'LEAK_FUNDING_LEGACY_RECORD_UNCHANGED');
 // Reboot: a fresh page load reads the saved funding back from IndexedDB.
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);await page.evaluate(async()=>{await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);});
 assert.deepEqual(await page.evaluate(name=>hjLeakFundingData(state.projects.find(p=>p.name===name)),LEAK_OFFICE),saved,'LEAK_FUNDING_SURVIVES_RELOAD');
 await settle(page);await selectProject(page,LEAK_OFFICE);assert.match(await page.locator('[data-leak-card]').textContent(),/💰 보험 청구 · 서류 2\/7/,'LEAK_FUNDING_SURVIVES_RELOAD chip');const rebooted=await snap(page);assert.deepEqual(await fundingOf(rebooted,LEAK_OFFICE),saved,'LEAK_FUNDING_SURVIVES_RELOAD stored');assert.deepEqual(rebooted.data.projects,rebooted.stored.projects,'LEAK_FUNDING_SURVIVES_RELOAD live==stored');assert.deepEqual(rebooted.keys,before.keys,'LEAK_FUNDING_TOP_KEYS reload');
}

async function failures({page}){
 // (a) snapshot failure: nothing written, no note, inputs preserved, controls enabled.
 await openFunding(page,LEAK_OFFICE);await page.locator('[data-leakfundingdoc="officeContact"]').check();const unchanged=await snap(page);
 await page.evaluate(()=>{state.dirty=false;window.__leakFundingSnapshot=hjSnapshot;hjSnapshot=async()=>false;});
 try{await footer(page,'저장').click();await page.waitForFunction(()=>document.getElementById('hjLeakFundingIssue').textContent.length>0&&!__modalCloseLocked);await same(page,unchanged,'LEAK_FUNDING_FAILED_SAVE_NO_WRITE_OR_NOTE');assert.equal(await page.evaluate(()=>state.dirty),false,'LEAK_FUNDING_FAILED_SAVE_NOT_DIRTY');
  assert.equal(await page.locator('#hjLeakFundingSource').inputValue(),'office','LEAK_FUNDING_FAILED_SAVE_KEEPS_INPUT');assert.equal(await page.locator('[data-leakfundingdoc="officeContact"]').isChecked(),true,'LEAK_FUNDING_FAILED_SAVE_KEEPS_INPUT');assert.equal(await page.locator('[data-leakfundingdoc="quote"]').isChecked(),true,'LEAK_FUNDING_FAILED_SAVE_KEEPS_INPUT');assert.equal(await page.locator('#hjLeakFundingSource').isDisabled(),false,'LEAK_FUNDING_FAILED_SAVE_KEEPS_INPUT enabled');assert.equal(await footer(page,'저장').isDisabled(),false);}
 finally{await page.evaluate(()=>{hjSnapshot=window.__leakFundingSnapshot;});}
 await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);const ok=await snap(page);assert.deepEqual(await fundingOf(ok,LEAK_OFFICE),{source:'office',docs:['officeContact','quote'],at:new Date(NOW).toISOString()},'LEAK_FUNDING_RETRY_SAVES_ONCE');assert.equal(ok.data.notes.filter(n=>n.text.startsWith('[비용 출처] ')).length,1,'LEAK_FUNDING_RETRY_SAVES_ONCE note');
 // (b) stale docs modal: a concurrent funding change rejects the save and is preserved.
 await openFunding(page,LEAK_OFFICE);await page.locator('[data-leakfundingdoc="zoneProof"]').check();await page.evaluate(async name=>{state.projects.find(p=>p.name===name).leak.funding.source='self';await guardedPersistCurrentState();},LEAK_OFFICE);await footer(page,'저장').click();await page.waitForFunction(()=>/바뀌/.test(document.getElementById('hjLeakFundingIssue').textContent)&&!__modalCloseLocked);
 await closeModal(page);const stale=await snap(page);assert.equal((await fundingOf(stale,LEAK_OFFICE)).source,'self','LEAK_FUNDING_STALE_GUARD');assert.equal(stale.data.notes.filter(n=>n.text.startsWith('[비용 출처] ')).length,1,'LEAK_FUNDING_STALE_GUARD note');
 // (c) stale intake modal: the composite stamp must notice a funding-only change made elsewhere.
 if(MUTATION==='stamp')await page.evaluate(()=>{hjLeakIntakeStamp=p=>JSON.stringify(p.leak&&p.leak.intake||null);});
 await openIntake(page,LEAK_OFFICE);assert.equal(await page.locator('#hjLeakFunding').inputValue(),'self');await page.evaluate(async name=>{state.projects.find(p=>p.name===name).leak.funding.source='undecided';await guardedPersistCurrentState();},LEAK_OFFICE);const notesBefore=stale.data.notes.length;
 await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')||(document.getElementById('hjLeakIssue').textContent.length>0&&!__modalCloseLocked));await queue(page);
 const issue=await page.evaluate(()=>{const el=document.getElementById('hjLeakIssue');return el?el.textContent:'';});assert.match(issue,/바뀌/,'LEAK_FUNDING_INTAKE_STAMP_COVERS_FUNDING issue');
 if(await page.locator('#modalRoot .modal').count())await closeModal(page);const guarded=await snap(page);assert.equal((await fundingOf(guarded,LEAK_OFFICE)).source,'undecided','LEAK_FUNDING_INTAKE_STAMP_COVERS_FUNDING');assert.deepEqual(guarded.stored.projects.find(p=>p.name===LEAK_OFFICE).leak.intake,stale.stored.projects.find(p=>p.name===LEAK_OFFICE).leak.intake,'LEAK_FUNDING_INTAKE_STAMP_COVERS_FUNDING intake');assert.equal(guarded.data.notes.length,notesBefore,'LEAK_FUNDING_INTAKE_STAMP_COVERS_FUNDING note');
}

async function report({page}){
 if(MUTATION==='purpose')await page.evaluate(()=>{hjLeakReportDefaultPurpose=()=>'insurance';});
 if(MUTATION==='conflict')await page.evaluate(()=>{hjLeakFundingConflict=()=>'';});
 const before=await snap(page),preview=page.locator('#hjLeakReportPreview'),money=/\d{1,3}(,\d{3})+/;
 await openReport(page,LEAK_OFFICE);assert.equal(await page.locator('[data-leak-report-purpose="office"]').getAttribute('aria-pressed'),'true','LEAK_FUNDING_REPORT_DEFAULT_OFFICE');assert.equal(await page.locator('[data-leak-report-purpose="insurance"]').getAttribute('aria-pressed'),'false','LEAK_FUNDING_REPORT_DEFAULT_OFFICE insurance');
 assert.equal(await page.locator('#hjLeakReportHideAmount').isChecked(),true,'LEAK_FUNDING_REPORT_DEFAULT_OFFICE hide');assert.equal(await page.locator('#hjLeakReportHideAmount').isDisabled(),true);assert.equal(await preview.locator('[data-leak-report-amount]').count(),0,'LEAK_FUNDING_REPORT_DEFAULT_OFFICE amount');assert(!money.test(await preview.textContent()),'LEAK_FUNDING_REPORT_DEFAULT_OFFICE money');assert.match(await preview.textContent(),/관리사무소용/);
 assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/기본 용도: 비용 출처\(관리사무소\(관리비·공용부\)\)에 따름/,'LEAK_FUNDING_REPORT_HINT');
 const action=await page.locator('#hjLeakReportAction').inputValue();assert.match(action,/출장·탐지비.*1식/,'LEAK_FUNDING_ACTION_DRAFT_UNMASKED');assert(!action.includes('[개인정보 생략]')&&!action.includes('[금액 생략]'),'LEAK_FUNDING_ACTION_DRAFT_UNMASKED');
 await page.locator('[data-leak-report-purpose="insurance"]').click();assert.equal(await page.locator('[data-leak-report-purpose="insurance"]').getAttribute('aria-pressed'),'true','LEAK_FUNDING_PURPOSE_OVERRIDABLE');assert.match(await preview.textContent(),money,'LEAK_FUNDING_PURPOSE_OVERRIDABLE amount');assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/^⚠ 비용 출처는 관리사무소/,'LEAK_FUNDING_REPORT_HINT mismatch');
 await page.locator('[data-leak-report-purpose="neighbor"]').click();assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/아랫집 안내용 — 비용 출처와 무관/);await geometry(page,['[data-leak-report-purpose="office"]']);await modalFits(page,'report');await closeModal(page);
 await openReport(page,LEAK);assert.equal(await page.locator('[data-leak-report-purpose="insurance"]').getAttribute('aria-pressed'),'true','LEAK_FUNDING_REPORT_DEFAULT_INSURANCE');assert.equal(await page.locator('#hjLeakReportHideAmount').isChecked(),false);assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/비용 출처 미입력 — 기본은 보험사 제출용/,'LEAK_FUNDING_REPORT_DEFAULT_INSURANCE hint');await closeModal(page);
 await openReport(page,LEAK_CONTRA);assert.equal(await page.locator('[data-leak-report-purpose="insurance"]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/기본 용도: 비용 출처\(보험 청구\)에 따름/);await page.locator('[data-leak-report-purpose="office"]').click();assert.match(await page.locator('#hjLeakReportPurposeHint').textContent(),/^⚠ 비용 출처는 보험 청구인데 관리사무소용/);await closeModal(page);
 await openIntake(page,LEAK_CONTRA);const hint=await page.locator('#hjLeakFundingHint').textContent();assert(hint.includes('보험 없음')&&hint.includes('보험사에 확인'),'LEAK_FUNDING_CONTRADICTION_HINT');await page.locator('#hjLeakInsurance').selectOption('모름');assert.equal(await page.locator('#hjLeakFundingHint').textContent(),'','LEAK_FUNDING_CONTRADICTION_HINT clears');await page.locator('#hjLeakInsurance').selectOption('없음');await page.locator('#hjLeakFunding').selectOption('office');assert.equal(await page.locator('#hjLeakFundingHint').textContent(),'');await page.locator('#hjLeakOffice').selectOption('해당 없음(단독·상가)');assert.match(await page.locator('#hjLeakFundingHint').textContent(),/관리사무소 해당 없음/,'LEAK_FUNDING_CONTRADICTION_HINT office');await closeModal(page);
 await openFunding(page,LEAK_CONTRA);const conflict=await page.locator('#hjLeakFundingConflict').textContent();assert(conflict.includes('보험 없음')&&conflict.includes('보험사에 확인'),'LEAK_FUNDING_CONTRADICTION_HINT modal');await closeModal(page);
 await same(page,before,'LEAK_FUNDING_REPORT_READONLY');
}

async function mobile({page}){
 const before=await snap(page);await selectProject(page,LEAK_OFFICE);
 const buttons=['[data-leakintake="'+LEAK_OFFICE+'"]','[data-leakdispatch="'+LEAK_OFFICE+'"]','[data-leaksms="'+LEAK_OFFICE+'"]','[data-leakquote="'+LEAK_OFFICE+'"]','[data-leakfunding="'+LEAK_OFFICE+'"]','[data-leakreport="'+LEAK_OFFICE+'"]'];
 assert.equal(await page.locator('[data-leak-card] button').count(),6,'LEAK_FUNDING_CARD_SIX_BUTTONS');await geometry(page,buttons);await screenshot(page,'v427-card-390','[data-leak-card]');
 await page.locator(buttons[0]).click();await page.locator('#hjLeakIntake').waitFor();await geometry(page,['#hjLeakFunding']);await modalFits(page,'intake');await closeModal(page);
 await page.locator(buttons[4]).click();await page.locator('#hjLeakFundingModal').waitFor();await geometry(page,['#hjLeakFundingSource','#hjLeakFundingDocs label >> nth=0']);await modalFits(page,'funding');await closeModal(page);
 await page.locator(buttons[5]).click();await page.locator('#hjLeakReportForm').waitFor();await modalFits(page,'report');await closeModal(page);
 await same(page,before,'LEAK_FUNDING_MOBILE_READONLY');
}

(async()=>{
 const opts={headless:true};if(process.env.PLAYWRIGHT_EXECUTABLE)opts.executablePath=process.env.PLAYWRIGHT_EXECUTABLE;else if(process.platform!=='win32')opts.executablePath='/opt/pw-browsers/chromium';browser=await chromium.launch(opts);
 if(CANARY){const t=await boot();await t.context.close();console.log('PASS LEAK_FUNDING_FEATURE_PRESENT');return;}
 if(MUTATION){const target={purpose:report,whitelist:readers,chip:intakePath,resume,stamp:failures,conflict:report}[MUTATION];await run('변이 동일 본문 '+MUTATION,target);throw new Error('MUTATION_NOT_DETECTED '+MUTATION);}
 await run('① 읽기 함수·화이트리스트·레거시·더보기126·요금 단정 없음',readers);
 await run('② 접수 모달 출처 저장·intake 불변·노트 1건·칩',intakePath);
 await run('③ AS 왕복 초안에 출처 보존',resume);
 await run('④ 서류 모달 체크·출처 전환·내구 저장·재부팅 복원',docsModal);
 await run('⑤ 저장 실패·오래된 창·합성 스탬프',failures);
 await run('⑥ 보고서 기본 용도·힌트·모순 안내·읽기 불변',report);
 await run('⑦ 카드 버튼 6개·모달 3종 390px/44px',mobile);
 console.log('PASS leakfunding-v427 '+passed+'/7; separate mutations: purpose, whitelist, chip, resume, stamp, conflict');
})().catch(error=>{if(MUTATION&&error.code==='ERR_ASSERTION'&&String(error.message).includes(MUTATION_MARKER[MUTATION]))console.error('MUTATION_DETECTED '+MUTATION+' '+MUTATION_MARKER[MUTATION]);console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

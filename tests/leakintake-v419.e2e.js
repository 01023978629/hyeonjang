/* v419: 390px, isolated synthetic IndexedDB, real local saves, no external calls.
   Keep 8299 in committed source; only the isolated test copy rewrites the port.
   --canary: fail fast on a build without v419.
   HJ_LEAK_MUTATION=urgent|dashboard: run the SAME relevant scenario after removing
   its rendering helpers. Only the named ERR_ASSERTION prints MUTATION_DETECTED;
   timeout, launch, boot or unrelated assertion failures are never mutation proof.
   Optional HJ_LEAK_SCREENSHOT_DIR saves synthetic mobile evidence only. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',APP=BASE+'/index.html';
const MUTATION=process.env.HJ_LEAK_MUTATION||'',CANARY=process.argv.includes('--canary');
assert(['','urgent','dashboard'].includes(MUTATION),'unknown HJ_LEAK_MUTATION');
const LEAK='누수 검사 알파',INTERIOR='주거 검증 제타',FINISHED='보수 완료 감마',CREATED='새 배관 엡실론';
const NOW='2026-11-06T08:40:00+09:00',TODAY='2026-11-06',ADDRESS='TEST_ONLY_ADDRESS_V419';
const MUTATION_MARKER={urgent:'LEAK_URGENT_LIST_PRESENT',dashboard:'LEAK_DASHBOARD_PRESENT'};
let browser,passed=0;
function project(name,extra={}){return {name,stage:0,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{name:'TEST_CUSTOMER',phone:'',addr:''},archived:false,...extra};}
function fixture(){return {version:2,app:'현장',savedAt:new Date(NOW).toISOString(),files:[],quotes:[],schedule:[],notes:[],contacts:[],payLog:[],projects:[project(LEAK,{kind:'leak',customer:{name:'TEST_CUSTOMER',phone:'',addr:ADDRESS}}),project(INTERIOR),project(FINISHED,{kind:'leak',stage:3})]};}
const footer=(page,label)=>page.locator('#modalRoot .mfoot').getByRole('button',{name:label,exact:true});
async function turn(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function queue(page){await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;});}
async function persist(page){assert.equal(await page.evaluate(async()=>{clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;const ok=await guardedPersistCurrentState();await __appStateWriteQueue;return ok;}),true,'LEAK_SYNTHETIC_FIXTURE_DURABLE');}
async function snap(page){return page.evaluate(async()=>{await __appStateWriteQueue;const clean=value=>{if(value==null)return value;const copy=JSON.parse(JSON.stringify(value));delete copy.savedAt;return copy;};const data=clean(serializeData()),pointer=await idbGet('paid_commit_pointer');return {keys:Object.keys(data).sort(),data,stored:clean(await idbGet('appState')),pointer:pointer||null,generation:pointer?clean(await idbGet(pointer)):null,unrelated:localStorage.getItem('leak_unrelated')};});}
async function same(page,before,label){assert.deepEqual(await snap(page),before,label);}
async function geometry(page,selectors){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'LEAK_NO_HORIZONTAL_OVERFLOW');
 for(const selector of selectors){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const box=await el.boundingBox();assert(box&&box.width>=43.5&&box.height>=43.5,'LEAK_44PX '+selector);}
}
async function screenshot(page,name,selector){if(process.env.HJ_LEAK_SCREENSHOT_DIR){if(selector)await page.locator(selector).scrollIntoViewIfNeeded();else await page.evaluate(()=>window.scrollTo(0,0));await turn(page);await page.screenshot({path:path.join(process.env.HJ_LEAK_SCREENSHOT_DIR,name+'.png')});}}
async function boot(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',timezoneId:'Asia/Seoul'}),errors=[],externalWrites=[];
 context.on('page',page=>{page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(35000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());});
 await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())){externalWrites.push(request.method()+' '+url.origin+url.pathname);return route.abort();}if(url.origin!==BASE)return route.abort();if(url.pathname==='/__leak_seed__')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>synthetic leak fixture</title>'});return route.continue();});
 // Only the clock is controlled. Real timers, animation frames, persistence and
 // snapshot/commit implementations remain intact.
 await context.addInitScript(now=>{const NativeDate=Date;window.__leakNow=NativeDate.parse(now);class LeakDate extends NativeDate{constructor(...args){super(...(args.length?args:[window.__leakNow]));}static now(){return window.__leakNow;}}window.Date=LeakDate;},NOW);
 const seed=await context.newPage();await seed.goto(BASE+'/__leak_seed__');
 await seed.evaluate(async data=>{for(const [key,value]of Object.entries({hj_onboard_done:'1',pref_mobile:'1',hj_ver_checked_at:String(Date.now()),hj_gcal_auto:'0',hj_more_recent:'[]',hj_more_favorites:'[]',leak_unrelated:'TEST_KEEP'}))localStorage.setItem(key,value);await new Promise((resolve,reject)=>{const request=indexedDB.open('hyeonjang-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('kv');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(data,'appState');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},fixture());await seed.close();
 const page=await context.newPage();
 try{
  await page.goto(APP,{waitUntil:'domcontentloaded'});
  assert(await page.evaluate(()=>typeof hjProjectKind==='function'&&typeof hjStageLabel==='function'&&typeof hjLeakIntakeView==='function'&&typeof hjLeakDispatchSeed==='function'&&typeof hjLeakTodayHtml==='function'),'LEAK_FEATURE_PRESENT');
  if(CANARY)return {context,page,errors,externalWrites};
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone&&window.__hjRelayBootDone);
  await page.evaluate(async()=>{await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone,window.__hjRelayBootDone]);taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};portalAutoSync=()=>{};aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);__idbSaveTimer=null;await __appStateWriteQueue;closeModal(true);state._demo=false;state.dirHandle=null;state.editingQuote=null;state.activeProject=null;state.tab='dashboard';__tabStale=false;__gdToken=null;relayReady=()=>false;window.__leakOpened=[];window.open=(...args)=>{window.__leakOpened.push(args);return null;};render();});
  await persist(page);await turn(page);return {context,page,errors,externalWrites};
 }catch(error){await context.close();throw error;}
}
async function openMore(page){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('.mobile-nav [data-mnav="__more"]').click();await page.locator('#moreSheet').waitFor();}
async function moreAction(page,action){await openMore(page);const chip=page.locator('.more-cat-block [data-moreaction="'+action+'"]');assert.equal(await chip.count(),1,'LEAK_MORE_ACTION_PRESENT '+action);await chip.evaluate(el=>{el.closest('details').open=true;});await chip.click();if(await page.locator('#moreRunProceed').isVisible())await page.locator('#moreRunProceed').click();await page.waitForFunction(()=>!document.getElementById('moreSheet')&&!__mobileSheetHistoryRetire);}
async function selectProject(page,name){await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);await page.locator('#projChip').click();await page.locator('#projSheet').waitFor();await page.locator('#psList [data-psel="'+name+'"]').click();await page.waitForFunction(()=>!document.getElementById('projSheet')&&!__mobileSheetHistoryRetire);await turn(page);}
async function closeModal(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await turn(page);}
async function run(name,fn){const t=await boot();try{await fn(t);assert.deepEqual(t.errors,[],'LEAK_NO_PAGE_ERRORS '+name);assert.deepEqual(t.externalWrites,[],'LEAK_NO_NETWORK_WRITES '+name);passed++;console.log('PASS '+name);}finally{await t.context.close();}}

async function creation({page}){
 const before=await snap(page);await moreAction(page,'addproject');assert.equal(await page.locator('#hjQuickKind').count(),1,'LEAK_QUICK_KIND_PRESENT');await geometry(page,['#hjQuickKind']);await page.locator('#hjQuickProj').fill(CREATED);await page.locator('#hjQuickKind').selectOption('leak');await footer(page,'추가').click();await page.locator('#hjLeakIntake').waitFor();
 const got=await page.evaluate(({name,old})=>{const p=state.projects.find(p=>p.name===name),interior=state.projects.find(p=>p.name===old);return {kind:p.kind,stage:p.stage,leakLabels:[0,1,2,3].map(i=>hjStageLabel(p,i)),interiorLabels:[0,1,2,3].map(i=>hjStageLabel(interior,i)),constant:[...STAGES],oldHasKind:Object.prototype.hasOwnProperty.call(interior,'kind')};},{name:CREATED,old:INTERIOR});
 assert.deepEqual(got,{kind:'leak',stage:0,leakLabels:['접수','출동','수리','완료'],interiorLabels:['상담','실측','시공','완료'],constant:['상담','실측','시공','완료'],oldHasKind:false},'LEAK_KIND_AND_LEGACY_STAGE_CONTRACT');
 // Cancel the newly offered intake: creating a type does not invent an intake.
 await closeModal(page);await persist(page);await selectProject(page,CREATED);await geometry(page,['[data-leakintake="'+CREATED+'"]','[data-leakdispatch="'+CREATED+'"]']);assert.match(await page.locator('#view').textContent(),/접수/);
 const after=await snap(page);assert.deepEqual(after.keys,before.keys,'LEAK_CREATE_TOP_KEYS');assert.equal(after.data.projects.find(p=>p.name===CREATED).leak,undefined,'LEAK_CANCEL_NO_INTAKE');assert.deepEqual(after.data.projects.find(p=>p.name===INTERIOR),before.data.projects.find(p=>p.name===INTERIOR),'LEAK_CREATE_LEGACY_RECORD_UNCHANGED');
 // Existing photo-less intake must advertise the durable edit to the normal save/sync path.
 await selectProject(page,LEAK);await page.locator('[data-leakintake="'+LEAK+'"]').click();await page.locator('#hjLeakAmount').selectOption('얼룩만');
 const unchanged=await snap(page);await page.evaluate(()=>{state.dirty=false;window.__leakSnapshot=hjSnapshot;hjSnapshot=async()=>false;});await footer(page,'저장').click();await page.waitForFunction(()=>document.getElementById('hjLeakIssue').textContent.length>0);await same(page,unchanged,'LEAK_FAILED_SAVE_NO_INTAKE_OR_NOTE');assert.equal(await page.evaluate(()=>state.dirty),false,'LEAK_FAILED_SAVE_NOT_DIRTY');
 await page.evaluate(()=>{hjSnapshot=window.__leakSnapshot;});await footer(page,'저장').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));assert.equal(await page.evaluate(()=>state.dirty),true,'LEAK_SUCCESSFUL_SAVE_SYNC_DIRTY');assert.equal((await snap(page)).stored.projects.find(p=>p.name===LEAK).leak.intake.amount,'얼룩만');
 // Apartment names retain their existing preview/confirmation safety route and the chosen type.
 await moreAction(page,'addproject');await page.locator('#hjQuickProj').fill('합성안전아파트');await page.locator('#hjQuickKind').selectOption('leak');await footer(page,'추가').click();await page.locator('#aptProjectPanel').waitFor();await page.locator('#aptProjectDong').fill('101');await page.locator('#aptProjectHo').fill('201');await footer(page,'미리보기').click();await page.locator('#aptProjectConfirm').waitFor();assert.equal(await page.evaluate(()=>state.projects.some(p=>p.name==='합성안전아파트')),false,'LEAK_APARTMENT_PREVIEW_READ_ONLY');await footer(page,'확인 후 저장').click();await page.locator('#hjLeakIntake').waitFor();assert.equal(await page.evaluate(()=>state.projects.find(p=>p.name==='합성안전아파트').kind),'leak','LEAK_APARTMENT_TYPE_RETAINED');await closeModal(page);
}

async function intakePhotos({page}){
 const before=await snap(page);await selectProject(page,LEAK);await page.locator('[data-leakintake="'+LEAK+'"]').click();await page.locator('#hjLeakIntake').waitFor();
 await page.locator('[data-leakwhere][value="욕실"]').check();await page.locator('[data-leakwhere][value="천장"]').check();
 const fields={hjLeakSince:'2~3일',hjLeakAmount:'똑똑 떨어짐',hjLeakNeighbor:'아랫집에서 연락 옴',hjLeakOffice:'했음',hjLeakInsurance:'일상배상책임 있음'};
 for(const [id,value]of Object.entries(fields))await page.locator('#'+id).selectOption(value);
 await page.locator('#hjLeakMemo').fill('TEST_ONLY 첫 줄\n둘째 줄');await geometry(page,Object.keys(fields).map(id=>'#'+id));
 const images=await page.evaluate(()=>['#e34234','#1c61c4'].map(color=>{const canvas=document.createElement('canvas');canvas.width=12;canvas.height=12;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,12,12);return canvas.toDataURL('image/png').split(',')[1];}));
 await page.locator('#hjLeakPhotos').setInputFiles(images.map((data,i)=>({name:'TEST_LEAK_'+i+'.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})));assert.match(await page.locator('#hjLeakPhotoCount').textContent(),/2장/);assert.equal(await page.evaluate(()=>state.files.length),0,'LEAK_SELECTION_NOT_INGESTED');
 // Actual combined button saves intake first, confirms photos second, then opens
 // the unchanged schedule editor. Cancel the editor so this case adds no schedule.
 await footer(page,'🚨 오늘 출동 잡기').click();await page.locator('#photoIntakeConfirm').waitFor();assert.equal(await page.locator('#photoIntakeProject option:checked').textContent(),LEAK);assert.equal(await page.locator('#photoIntakeWork').inputValue(),'누수 접수');await page.locator('#photoIntakeConfirm').click();await page.locator('#photoIntakeResult').waitFor({timeout:45000});assert.match(await page.locator('#photoIntakeResult').textContent(),/앱 목록 추가 2장/);await footer(page,'사진 목록 보기').click();await page.locator('#schTitle').waitFor();assert.equal(await page.locator('#schTitle').inputValue(),'🚨 출동: '+LEAK);await footer(page,'취소').click();await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await queue(page);
 const after=await snap(page),p=after.data.projects.find(p=>p.name===LEAK),d=p.leak.intake;
 assert.deepEqual({where:d.where,since:d.since,amount:d.amount,neighbor:d.neighbor,office:d.office,insurance:d.insurance,memo:d.memo},{where:['욕실','천장'],since:'2~3일',amount:'똑똑 떨어짐',neighbor:'아랫집에서 연락 옴',office:'했음',insurance:'일상배상책임 있음',memo:'TEST_ONLY 첫 줄\n둘째 줄'},'LEAK_INTAKE_FIELDS');assert.equal(d.at,new Date(NOW).toISOString());
 const notes=after.data.notes.filter(n=>n.project===LEAK&&n.text.startsWith('[누수 접수] '));assert.equal(notes.length,1,'LEAK_SINGLE_NOTE');assert(notes[0].text.startsWith('[누수 접수] '+TODAY+' · '));assert(!/[\r\n]/.test(notes[0].text),'LEAK_NOTE_ONE_LINE');for(const word of ['욕실','천장','똑똑 떨어짐','일상배상책임 있음','TEST_ONLY 첫 줄 둘째 줄'])assert(notes[0].text.includes(word));
 const photos=after.data.files.filter(f=>/^TEST_LEAK_[01]\.png$/.test(f.name));assert.equal(photos.length,2,'LEAK_TWO_PHOTOS');assert(photos.every(f=>f.project===LEAK&&f.kind==='photo'&&f.worklabel==='누수 접수'),'LEAK_PHOTO_PROJECT_AND_WORK');assert(await page.evaluate(name=>state.files.filter(f=>/^TEST_LEAK_[01]\.png$/.test(f.name)).every(f=>f.project===name&&f._worklabel==='누수 접수'),LEAK),'LEAK_PHOTO_MEMORY_WORKLABEL');assert.deepEqual(after.data.schedule,before.data.schedule,'LEAK_CANCEL_DISPATCH_PRESERVES_SCHEDULE');assert.deepEqual(after.keys,before.keys,'LEAK_INTAKE_TOP_KEYS');assert.equal(after.unrelated,'TEST_KEEP');
 assert.deepEqual(after.stored.projects.find(p=>p.name===LEAK).leak.intake,d,'LEAK_INTAKE_DURABLE');assert.equal(after.stored.files.filter(f=>f.project===LEAK&&f.kind==='photo').length,2,'LEAK_PHOTO_METADATA_DURABLE');await selectProject(page,LEAK);assert.match(await page.locator('[data-leak-card]').textContent(),/욕실·천장/);await screenshot(page,'v419-intake-project-390');
}

async function dispatch({page}){
 const boundaries=[['2026-11-06T17:00:00+09:00','2026-11-06','18:00'],['2026-11-06T17:00:01+09:00','2026-11-07','09:00'],['2026-11-06T17:40:00+09:00','2026-11-07','09:00']];
 if(MUTATION==='urgent')await page.evaluate(()=>{hjScheduleUrgentAttrs=()=>'';hjScheduleUrgentIcon=()=>'';});
 for(const [now,date,time]of boundaries){
  await page.evaluate(now=>{window.__leakNow=Date.parse(now);state.schedule=[];__calYM=null;__calSelDate=null;},now);await persist(page);await selectProject(page,LEAK);await page.locator('[data-leakdispatch="'+LEAK+'"]').click();await footer(page,'🚨 오늘 출동 잡기').click();await page.locator('#schTitle').waitFor();assert.equal(await page.locator('#schTitle').inputValue(),'🚨 출동: '+LEAK);assert.equal(await page.locator('#schDate').inputValue(),date,'LEAK_DISPATCH_DATE '+now);assert.equal(await page.locator('#schTime').inputValue(),time,'LEAK_DISPATCH_TIME '+now);assert.equal(await page.locator('#schHours').inputValue(),'2');await footer(page,'저장').click();
  await page.waitForFunction(({name,date,time})=>state.schedule.some(s=>s.project===name&&s.date===date&&s.time===time),{name:LEAK,date,time});await persist(page);
  const saved=await page.evaluate(name=>state.schedule.filter(s=>s.project===name),LEAK);assert.equal(saved.length,1);assert.equal(saved[0].urgent,true,'LEAK_DISPATCH_URGENT_SAVED');assert.equal(saved[0].hours,2);assert.equal(saved[0].title,'🚨 출동: '+LEAK);
  await page.locator('.mobile-nav [data-mnav="schedule"]').click();await turn(page);assert.equal(await page.locator('.sch-item.leak-urgent').count(),1,'LEAK_URGENT_LIST_PRESENT');assert.match(await page.locator('.sch-item.leak-urgent').textContent(),/🚨/);assert.equal(await page.locator('.cal-cell.leak-urgent[data-calday="'+date+'"]').count(),1,'LEAK_URGENT_CALENDAR_PRESENT');
  const red=await page.locator('.sch-item.leak-urgent').evaluate(el=>{const s=getComputedStyle(el),rgb=s.borderLeftColor.match(/\d+/g)||[];return parseFloat(s.borderLeftWidth)>0&&Number(rgb[0])>Number(rgb[1])*1.3&&Number(rgb[0])>Number(rgb[2])*1.3;});assert(red,'LEAK_URGENT_RED_BORDER');
  const stored=(await snap(page)).stored.schedule.find(s=>s.id===saved[0].id);assert.equal(stored.urgent,true,'LEAK_URGENT_DURABLE');
 }
 const weekends=await page.evaluate(name=>[hjLeakDispatchSeed(name,0,new Date('2026-11-07T17:40:00+09:00')),hjLeakDispatchSeed(name,1,new Date('2026-11-06T08:40:00+09:00'))],LEAK);assert.equal(weekends[0].date,'2026-11-09');assert.equal(weekends[0].time,'09:00');assert.equal(weekends[1].date,'2026-11-07');assert.equal(weekends[1].time,'10:00');await screenshot(page,'v419-urgent-schedule-390','.sch-item.leak-urgent');
}

async function dashboard({page}){
 await page.evaluate(({leak,interior,finished,today})=>{state.projects.find(p=>p.name===leak).stage=2;state.schedule=[{id:'TEST_URGENT_A',title:'🚨 출동: '+leak,project:leak,date:today,time:'14:00',hours:2,urgent:true,report:{progress:'완료',done:'TEST_ONLY 점검'}},{id:'TEST_DONE_C',title:'🚨 출동: '+finished,project:finished,date:today,time:'16:30',hours:2,urgent:true,report:{progress:'완료'}},{id:'TEST_NORMAL_B',title:'TEST_ONLY 일반 일정',project:interior,date:today,time:'10:00',hours:1,urgent:true,report:{progress:'완료'}}];state.activeProject=null;state.tab='dashboard';render();},{leak:LEAK,interior:INTERIOR,finished:FINISHED,today:TODAY});await persist(page);const before=await snap(page);
 if(MUTATION==='dashboard')await page.evaluate(()=>{hjLeakTodayHtml=()=>'';render();});
 await page.locator('.mobile-nav [data-mnav="dashboard"]').click();await turn(page);assert.equal(await page.locator('[data-leak-today]').count(),1,'LEAK_DASHBOARD_PRESENT');const line=await page.locator('[data-leak-today]').textContent();assert(line.includes('오늘 출동 2건'));assert(line.includes(LEAK+' 14:00'));assert(line.includes(FINISHED+' 16:30'));assert(!line.includes(INTERIOR));await geometry(page,['[data-leak-today] [data-navi="'+LEAK+'"]']);assert.equal(await page.locator('[data-leak-today] [data-navi="'+FINISHED+'"]').count(),0,'LEAK_NO_ADDRESS_NO_MAP');
 await page.locator('[data-leak-today] [data-navi="'+LEAK+'"]').click();const opened=await page.evaluate(()=>window.__leakOpened);assert.equal(opened.length,1);assert.equal(opened[0][0],'https://map.naver.com/p/search/'+encodeURIComponent(ADDRESS),'LEAK_EXISTING_MAP_ROUTE');
 assert.deepEqual(await page.evaluate(()=>hjLeakPendingRepairs()),[LEAK],'LEAK_COMPLETED_DISPATCH_UNFINISHED_REPAIR');await page.locator('[data-dayclose]').first().click();assert.match(await page.locator('#modalRoot').textContent(),/출동했는데 수리 안 끝난 누수 현장 1곳/,'LEAK_DAY_CLOSE_PENDING');await closeModal(page);await same(page,before,'LEAK_DASHBOARD_READ_ONLY');await screenshot(page,'v419-dispatch-dashboard-390','[data-leak-today]');
 await page.evaluate(()=>{state.schedule=[];render();});await persist(page);const empty=await snap(page);assert.equal(await page.locator('[data-leak-today]').count(),0,'LEAK_EMPTY_DASHBOARD_HAS_NO_LINE');assert.deepEqual(await page.evaluate(()=>hjLeakTodayData()),[]);assert.deepEqual(await page.evaluate(()=>hjLeakPendingRepairs()),[]);await same(page,empty,'LEAK_EMPTY_DASHBOARD_READ_ONLY');
}

async function inquiries({page}){
 const before=await snap(page);await moreAction(page,'webbridge');await page.locator('#webWorkPaste').fill('[만물인테리어 상담 신청]\n이름: TEST_LEAK_CUSTOMER\n연락처: 02-0000-0000\n공간: 누수 · TEST_LEAK_WEB_REGION\n증상: TEST_ONLY 합성 누수 접수\n신청 목적: 유상 장비진단·방문 일정 상담\n접수 경로: leak-page\n유입 페이지: https://example.invalid/leak.html\n접수번호: LD-20261106-0419\n개인정보 수집·이용 동의: 동의');await page.locator('#webWorkParse').click();await page.locator('[data-web-work-preview]').waitFor();assert.equal(await page.evaluate(()=>__webWorkDraft.service),'leak-pipe','LEAK_WEB_SERVICE_CLASSIFIED');await same(page,before,'LEAK_WEB_PREVIEW_READ_ONLY');await footer(page,'현장으로 등록').click();await page.waitForFunction(()=>state.projects.some(p=>p.sourceReceiptNo==='LD-20261106-0419'));await queue(page);const registered=await page.evaluate(()=>state.projects.find(p=>p.sourceReceiptNo==='LD-20261106-0419'));assert.equal(registered.kind,'leak','LEAK_WEB_SERVICE_CREATES_KIND');assert.equal(registered.sourceService,'leak-pipe');assert.equal((await snap(page)).stored.projects.find(p=>p.name===registered.name).kind,'leak','LEAK_WEB_KIND_DURABLE');if(await page.locator('#modalRoot .modal').count())await closeModal(page);
 await moreAction(page,'inquiry');assert.equal(await page.locator('#inqKind').inputValue(),'interior');await geometry(page,['#inqKind']);await page.locator('#inqKind').selectOption('leak');await page.locator('#inqName').fill('TEST_MANUAL_LEAK');await page.locator('#inqArea').fill('수동 접수 델타');await page.locator('#inqText').fill('TEST_ONLY 수동 문의');await footer(page,'📥 등록').click();await page.waitForFunction(()=>state.projects.some(p=>p.name==='수동 접수 델타'));assert.equal(await page.evaluate(()=>state.projects.find(p=>p.name==='수동 접수 델타').kind),'leak','LEAK_MANUAL_INQUIRY_KIND');if(await page.locator('#modalRoot .modal').count())await closeModal(page);await persist(page);const after=await snap(page);assert.deepEqual(after.keys,before.keys,'LEAK_INQUIRY_TOP_KEYS');assert.deepEqual(after.data.projects.find(p=>p.name===INTERIOR),before.data.projects.find(p=>p.name===INTERIOR),'LEAK_INQUIRY_LEGACY_UNCHANGED');
 await page.evaluate(()=>{const lead={name:'TEST_WEB_LEAD',region:'홈 접수 베타',leadId:'TEST_LEAK_HOME_V419',consent:true};location.hash='lead='+btoa(unescape(encodeURIComponent(JSON.stringify(lead))));});await page.locator('#leadKind').waitFor();await geometry(page,['#leadKind']);await page.locator('#leadKind').selectOption('leak');await footer(page,'현장으로 등록').click();await page.locator('#hjLeakIntake').waitFor();assert.equal(await page.evaluate(()=>state.projects.find(p=>p.name==='홈 접수 베타').kind),'leak','LEAK_HOMEPAGE_KIND');await closeModal(page);
}

async function filtering({page}){
 const before=await snap(page),pure=await page.evaluate(({leak,interior})=>{const a=state.projects.find(p=>p.name===leak),b=state.projects.find(p=>p.name===interior);for(let n=0;n<3;n++){hjProjectKind(b);hjStageLabel(b,0);hjLeakCardHtml(a);hjLeakIntakeData(a);hjLeakTodayHtml();hjLeakPendingRepairs();}return {oldKind:hjProjectKind(b),oldOwnKind:Object.prototype.hasOwnProperty.call(b,'kind'),actions:MORE_CATS.flatMap(c=>c.items.map(i=>i[0]))};},{leak:LEAK,interior:INTERIOR});assert.equal(pure.oldKind,'interior');assert.equal(pure.oldOwnKind,false);assert.equal(pure.actions.length,126,'LEAK_MORE_126');assert.equal(new Set(pure.actions).size,126,'LEAK_MORE_126_UNIQUE');await same(page,before,'LEAK_PURE_READERS_DO_NOT_MIGRATE');
 await page.locator('#projChip').click();await page.locator('#projSheet').waitFor();const toggle=page.locator('#psLeakFilter');assert.equal(await toggle.count(),1,'LEAK_FILTER_PRESENT');await geometry(page,['#psLeakFilter']);assert.match(await toggle.textContent(),/누수/);assert.equal(await page.locator('#psList [data-psel="'+INTERIOR+'"]:visible').count(),1);await toggle.click();assert.equal(await page.locator('#psList [data-psel="'+INTERIOR+'"]:visible').count(),0,'LEAK_FILTER_EXCLUDES_INTERIOR');assert.equal(await page.locator('#psList [data-psel="'+LEAK+'"]:visible').count(),1);assert.equal(await page.locator('#psList [data-psel="'+FINISHED+'"]:visible').count(),1);assert.match(await page.locator('#psList [data-psel="'+LEAK+'"] .ps-meta').textContent(),/접수/);assert.match(await page.locator('#psList [data-psel="'+FINISHED+'"] .ps-meta').textContent(),/완료/);await toggle.click();assert.equal(await page.locator('#psList [data-psel="'+INTERIOR+'"]:visible').count(),1);assert.match(await page.locator('#psList [data-psel="'+INTERIOR+'"] .ps-meta').textContent(),/상담/);await page.locator('#projSheetClose').click();await page.waitForFunction(()=>!document.getElementById('projSheet')&&!__mobileSheetHistoryRetire);
 await openMore(page);assert.equal(await page.locator('.more-cat-block [data-moreaction]').count(),126,'LEAK_MORE_DOM_126');await geometry(page,['#moreSearch']);await page.locator('#moreSheetClose').click();await page.waitForFunction(()=>!document.getElementById('moreSheet')&&!__mobileSheetHistoryRetire);await same(page,before,'LEAK_FILTER_AND_MENU_READ_ONLY');
}

/* v419/v416 integration: one synthetic scenario for the combined callback contract.
   Real PNG ingestion and durable metadata saves remain unchanged. A beforeEach
   gate only pauses the supported callback boundary; every timeout is a failure. */
async function photoCallbacks({page}){
 const before=await snap(page);
 await page.evaluate(async name=>{
  const canvas=document.createElement('canvas');canvas.width=12;canvas.height=12;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#315ca8';ctx.fillRect(0,0,12,12);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('synthetic PNG creation failed')),'image/png'));
  const file=new File([blob],'TEST_LEAK_CALLBACK.png',{type:'image/png',lastModified:Date.now()});
  window.__v419PhotoCallbacks={file,events:[],beforeAdd:0,beforeEach:0,gateEntered:false,release:null,outcome:null};
  openPhotoIntake([file],{project:name,source:'gallery',
   onCancel:()=>{window.__v419PhotoCallbacks.events.push('cancel');},
   onClose:()=>{window.__v419PhotoCallbacks.events.push('close');},
   onComplete:()=>{window.__v419PhotoCallbacks.events.push('complete');}
  });
 },LEAK);
 await page.locator('#photoIntakeCancel').waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.events),[],'LEAK_CALLBACK_INITIAL_OPEN_SILENT');
 await page.locator('#photoIntakeCancel').click();
 await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));
 await turn(page);
 assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.events),['cancel','close'],'LEAK_CALLBACK_CANCEL_THEN_CLOSE_ONCE');
 assert.deepEqual(await snap(page),before,'LEAK_CALLBACK_CANCEL_PRESERVES_SYNTHETIC_DATA');

 await page.waitForFunction(()=>!__mobileSheetHistoryRetire&&!__mobileSheetHistoryDeferredOpen);
 await page.evaluate(name=>{
  const probe=window.__v419PhotoCallbacks;probe.events=[];
  const gate=new Promise(resolve=>{probe.release=resolve;});
  openPhotoIntake([probe.file],{project:name,source:'gallery',
   beforeAdd:async()=>{probe.beforeAdd++;},
   beforeEach:async file=>{probe.beforeEach++;if(file&&!probe.gateEntered){probe.gateEntered=true;await gate;}},
   onCancel:()=>{probe.events.push('cancel');},
   onClose:()=>{probe.events.push('close');},
   onComplete:outcome=>{probe.outcome={pairs:outcome.pairs.length,readFailed:outcome.readFailed.length,metadataSaved:outcome.metadataSaved,error:outcome.error};probe.events.push('complete');}
  });
 },LEAK);
 await page.locator('#photoIntakeWork').fill('TEST_CALLBACK_WORK');
 try{
  await page.locator('#photoIntakeConfirm').click();
  await page.waitForFunction(()=>window.__v419PhotoCallbacks.gateEntered&&!!document.getElementById('photoIntakeProgress'));
  assert.deepEqual(await page.evaluate(()=>({events:window.__v419PhotoCallbacks.events,beforeAdd:window.__v419PhotoCallbacks.beforeAdd,beforeEach:window.__v419PhotoCallbacks.beforeEach,files:state.files.length,result:!!document.getElementById('photoIntakeResult'),locked:__modalCloseLocked})),{events:[],beforeAdd:1,beforeEach:1,files:0,result:false,locked:true},'LEAK_CALLBACK_PROGRESS_DOES_NOT_CANCEL_COMPLETE_OR_CONTINUE');
  await page.keyboard.press('Escape');await turn(page);
  assert.equal(await page.locator('#photoIntakeProgress').count(),1,'LEAK_CALLBACK_PROGRESS_CANNOT_CLOSE');
  assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.events),[],'LEAK_CALLBACK_LOCKED_CLOSE_IS_SILENT');
  await page.evaluate(()=>window.__v419PhotoCallbacks.release());
  await page.locator('#photoIntakeResult').waitFor({timeout:45000});
  await page.waitForFunction(()=>window.__v419PhotoCallbacks.outcome!==null);
  assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.events),['complete'],'LEAK_CALLBACK_RESULT_COMPLETES_WITHOUT_CANCEL_OR_CLOSE');
  assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.outcome),{pairs:1,readFailed:0,metadataSaved:true,error:''},'LEAK_CALLBACK_REAL_PNG_COMPLETED');
  assert.match(await page.locator('#photoIntakeResult').textContent(),/앱 목록 추가 1장/);
  await footer(page,'사진 목록 보기').click();
  await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal'));await turn(page);
  assert.deepEqual(await page.evaluate(()=>window.__v419PhotoCallbacks.events),['complete','close'],'LEAK_CALLBACK_RESULT_CLOSE_ONCE_WITHOUT_CANCEL');
  await queue(page);
  const after=await snap(page),photos=after.data.files.filter(file=>file.name==='TEST_LEAK_CALLBACK.png');
  assert.equal(photos.length,1,'LEAK_CALLBACK_INGESTS_ONE_REAL_PNG');
  assert.equal(photos[0].project,LEAK);assert.equal(photos[0].worklabel,'TEST_CALLBACK_WORK');
  assert.equal(after.stored.files.filter(file=>file.name==='TEST_LEAK_CALLBACK.png'&&file.project===LEAK&&file.worklabel==='TEST_CALLBACK_WORK').length,1,'LEAK_CALLBACK_METADATA_DURABLE');
  assert.deepEqual(after.data.schedule,before.data.schedule,'LEAK_CALLBACK_PROBE_DOES_NOT_CREATE_DISPATCH');
  assert.deepEqual(after.keys,before.keys,'LEAK_CALLBACK_TOP_KEYS_UNCHANGED');
 }finally{
  // Release an outstanding gate even on assertion failure; never convert a
  // timeout or failed assertion into successful regression evidence.
  await page.evaluate(()=>{const probe=window.__v419PhotoCallbacks;if(probe&&probe.release)probe.release();});
 }
}

(async()=>{
 const opts={headless:true};if(process.env.PLAYWRIGHT_EXECUTABLE)opts.executablePath=process.env.PLAYWRIGHT_EXECUTABLE;else if(process.platform!=='win32')opts.executablePath='/opt/pw-browsers/chromium';browser=await chromium.launch(opts);
 if(CANARY){const t=await boot();await t.context.close();console.log('PASS LEAK_FEATURE_PRESENT');return;}
 if(MUTATION){await run('변이 동일 본문 '+MUTATION,MUTATION==='urgent'?dispatch:dashboard);throw new Error('MUTATION_NOT_DETECTED '+MUTATION);}
 await run('① 실제 현장 생성·유형·단계·기존 데이터 보호',creation);
 await run('② 접수 저장·한 줄 노트·실제 사진 2장 연결·직렬화',intakePhotos);
 await run('③ 실제 출동 일정 저장·17시 경계 3건·목록/달력',dispatch);
 await run('④ 오늘 출동·길찾기44·마감 미완료·읽기 불변',dashboard);
 await run('⑤ leak-pipe 웹 문의 및 수동 문의 유형',inquiries);
 await run('⑥ 누수 목록 필터·더보기126·390px·읽기 불변',filtering);
 await run('⑦ 사진 공유·누수 닫힘 콜백 공존',photoCallbacks);
 console.log('PASS leakintake-v419 '+passed+'/7; separate mutations: urgent, dashboard');
})().catch(error=>{if(MUTATION&&error.code==='ERR_ASSERTION'&&String(error.message).includes(MUTATION_MARKER[MUTATION]))console.error('MUTATION_DETECTED '+MUTATION+' '+MUTATION_MARKER[MUTATION]);console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});



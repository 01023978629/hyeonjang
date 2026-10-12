/* v394 최근 연락처 누락 현장만, 안전판 성공 뒤 선택한 칸만 저장. 가상 자료. */
'use strict';
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const assert=require('node:assert/strict'),results=[];
async function test(n,fn){try{await fn();results.push(true);console.log('PASS '+n);}catch(e){results.push(false);console.log('FAIL '+n+' '+e.stack);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined}),ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:780}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_gcal_auto','0');window.ContactsManager=function(){};Object.defineProperty(navigator,'contacts',{configurable:true,value:{select:async()=>window.__pick||[]}});});
 await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__hjOfficeOpsBootDone);
 await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);const orig=localDate;window.localDate=d=>d?orig(d):'2026-11-05';window.taxCalendarEnsure=()=>0;window.coworkSchedEnsure=()=>0;window.portalAutoSync=()=>0;window.__snap=()=>{const d=serializeData();d.savedAt='';return paidStableJson(d);};});
 const seed=()=>page.evaluate(()=>{
  closeModal(true);state._demo=false;state.files=[];state.quotes=[];state.schedule=[];state.notes=[];state.payLog=[];state.asLog=[];state.contacts=[];
  const p=(name,stage,x)=>Object.assign({name,stage,received:0,phases:[],cost:{},customer:{name:'기존가상',phone:'',addr:'유지 주소'},leadSrc:'referral'},x||{});
  state.projects=[p('최근상담',0,{inquiryAt:'2026-11-02'}),p('최근실측',1,{inquiryAt:'2026-11-03'}),p('최근시공',2,{inquiryAt:'2026-11-04'}),p('옛상담',0,{inquiryAt:'2026-01-01'}),p('옛실측',1,{inquiryAt:'2026-01-01'}),p('옛시공',2,{inquiryAt:'2026-01-01'}),p('최근완료',3,{doneAt:'2026-10-06'}),p('옛완료',3,{doneAt:'2026-04-19',inquiryAt:'2026-11-05'}),p('보관',0,{archived:true,inquiryAt:'2026-11-05'}),p('번호있음',0,{inquiryAt:'2026-11-05',customer:{phone:'010-0000-0000'}}),p('기록없음',0)];
  state.tab='dashboard';state.activeProject=null;window.__snaps=[];window.__snapshotOK=true;window.hjSnapshot=async(label,force)=>{if(label==='연락처 모아 채우기 전')__snaps.push({label,force,before:__snap()});return __snapshotOK;};render();
 });
 const save=()=>page.evaluate(()=>[...document.querySelectorAll('#modalRoot .mfoot button')].find(b=>b.textContent==='저장').click());
 await test('① 목록·순서·읽기 불변·대시보드·검진 진입',async()=>{
  await seed();const r=await page.evaluate(()=>{const before=__snap(),names=hjCustMissing(),el=document.getElementById('dashboardCustMissing'),b=el&&el.querySelector('button');return {names,same:before===__snap(),text:el&&el.textContent,h:b&&b.getBoundingClientRect().height,w:document.documentElement.scrollWidth-document.documentElement.clientWidth,beforeQuote:el&&el.nextElementSibling.id};});
  assert.deepEqual(r.names,['최근시공','최근실측','최근상담','최근완료']);assert(r.same);assert(r.text.includes('연락처 없는 현장 4곳'));assert(r.h>=44);assert(r.w<=0);assert.equal(r.beforeQuote,'dashboardQuoteWaiting');
  await page.locator('[data-custfill]').click();assert.equal(await page.locator('#modalRoot h3').textContent(),'👤 연락처 빈 현장 4곳');
  await page.evaluate(()=>{closeModal(true);dataHealth();});await page.locator('#healthCustFill').click();assert.equal(await page.locator('#custFill .cfRow').count(),4);
 });
 await test('오늘 시각·자정은 포함하고 미래·90일 밖은 제외',async()=>{
  await seed();const r=await page.evaluate(()=>{state.projects=['오늘시각','오늘자정','미래','경계90일','경계91일'].map(name=>({name,stage:0,customer:{}}));state.files=['2026-11-05T10:00:00','2026-11-05T00:00:00','2026-11-06T10:00:00','2026-08-07T10:00:00','2026-08-06T10:00:00'].map((when,i)=>({project:state.projects[i].name,when,kind:'photo'}));const before=__snap();return {names:hjCustMissing(),same:before===__snap()};});assert.deepEqual(r.names,['오늘시각','오늘자정','경계90일']);assert(r.same);
 });
 await test('② 두 줄 저장·선행 안전판 1회·다른 필드 유지',async()=>{
  await seed();await page.evaluate(()=>{window.__before=__snap();window.__others=JSON.stringify(state.projects.filter(p=>!['최근상담','최근실측'].includes(p.name)));hjCustFillView();});
  await page.locator('#cfName1').fill('실측가상');await page.locator('#cfPhone1').fill('010-1111-2222');await page.locator('#cfName2').fill('상담가상');await page.locator('#cfPhone2').fill('010-3333-4444');await save();await page.waitForFunction(()=>document.querySelectorAll('#custFill .cfRow').length===2);
  const r=await page.evaluate(()=>({cu:state.projects.slice(0,2).map(p=>p.customer),names:hjCustMissing(),same:__others===JSON.stringify(state.projects.filter(p=>!['최근상담','최근실측'].includes(p.name))),snaps:__snaps.map(s=>({force:s.force,before:s.before===__before})),contacts:state.contacts.length,src:state.projects[0].leadSrc}));
  assert.deepEqual(r.cu,[{name:'상담가상',phone:'010-3333-4444',addr:'유지 주소'},{name:'실측가상',phone:'010-1111-2222',addr:'유지 주소'}]);assert.deepEqual(r.names,['최근시공','최근완료']);assert(r.same);assert.deepEqual(r.snaps,[{force:true,before:true}]);assert.equal(r.contacts,0);assert.equal(r.src,'referral');
 });
 await test('③ 짧은 번호는 전체 중단·빈칸은 유지',async()=>{
  await seed();await page.evaluate(()=>{hjCustFillView();window.__before=__snap();});await page.locator('#cfPhone0').fill('010-0000-0000');await page.locator('#cfPhone1').fill('123');await save();
  assert(await page.evaluate(()=>__before===__snap()&&__snaps.length===0));assert.equal(await page.locator('#cfPhone1').getAttribute('aria-invalid'),'true');
  await page.locator('#cfPhone1').fill('');await page.locator('#cfName0').fill('');await save();await page.waitForFunction(()=>hjCustMissing().length===3);assert.equal(await page.evaluate(()=>state.projects[2].customer.name),'기존가상');assert.equal(await page.evaluate(()=>state.projects[1].customer.phone),'');
 });
 await test('④ 주소록은 그 줄만·44px·미지원 없음',async()=>{
  await seed();await page.evaluate(()=>{hjCustFillView();window.__before=__snap();window.__pick=[{name:['주소록가상'],tel:['01055556666']}];});assert((await page.locator('.cfPick').first().boundingBox()).height>=44);await page.locator('.cfPick').nth(1).click();await page.waitForFunction(()=>document.getElementById('cfPhone1').value==='010-5555-6666');
  assert.equal(await page.locator('#cfPhone0').inputValue(),'');assert.equal(await page.locator('#cfName1').inputValue(),'주소록가상');assert(await page.evaluate(()=>__before===__snap()));assert(await page.evaluate(()=>document.querySelector('.modal').scrollWidth<=document.querySelector('.modal').clientWidth));
  await page.evaluate(()=>{closeModal(true);delete window.ContactsManager;hjCustFillView();});assert.equal(await page.locator('.cfPick').count(),0);
 });
 await test('⑤ 안전판 실패·저장 연타는 변경 금지',async()=>{
  await seed();await page.evaluate(()=>{hjCustFillView();window.__before=__snap();window.__snapshotOK=false;});await page.locator('#cfPhone0').fill('010-0000-0000');await save();assert(await page.evaluate(()=>__before===__snap()));
  await page.evaluate(()=>{window.__snaps=[];window.hjSnapshot=label=>{if(label!=='연락처 모아 채우기 전')return Promise.resolve(true);__snaps.push(label);return new Promise(r=>window.__release=r);};const b=[...document.querySelectorAll('.mfoot button')].find(b=>b.textContent==='저장');b.click();b.click();});assert.equal(await page.evaluate(()=>__snaps.length),1);await page.evaluate(()=>__release(true));await page.waitForFunction(()=>hjCustMissing().length===3);
 });
 await browser.close();console.log('custfill-v394: '+results.filter(Boolean).length+'/'+results.length+' passed, pageerrors='+errors.length);process.exit(results.every(Boolean)&&!errors.length?0:1);
})().catch(e=>{console.error(e);process.exit(1);});

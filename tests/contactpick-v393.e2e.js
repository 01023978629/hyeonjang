/* v393 한 사람 주소록 선택은 저장 전 입력칸만 바꾼다. 가상 자료만 사용. */
'use strict';
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const assert=require('node:assert/strict'),results=[];
async function test(name,fn){try{await fn();results.push(true);console.log('PASS '+name);}catch(e){results.push(false);console.log('FAIL '+name+' '+e.stack);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined});
 const errors=[];
 async function open(supported){
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:780}}),page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
  await page.addInitScript(s=>{
   localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_gcal_auto','0');
   if(s){window.ContactsManager=function(){};Object.defineProperty(navigator,'contacts',{configurable:true,value:{select:async(props,opts)=>{window.__pickArgs={props,opts};if(window.__pickError)throw {name:window.__pickError};return window.__pick||[];},getProperties:async()=>['name','tel']}});}
  },supported);
  await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__hjOfficeOpsBootDone);
  await page.evaluate(async()=>{await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);});
  await page.evaluate(()=>{
   closeModal(true);window.taxCalendarEnsure=()=>0;window.coworkSchedEnsure=()=>0;window.backupBootCheck=()=>0;window.portalAutoSync=()=>0;
   state._demo=false;state.files=[];state.quotes=[];state.notes=[];state.schedule=[];state.payLog=[];state.contacts=[];
   state.projects=[{name:'가상현장',stage:0,received:0,phases:[],cost:{},customer:{name:'기존',phone:'010-1234-5678',addr:'가상 주소'},leadSrc:'naverplace'}];
   state.tab='dashboard';state.activeProject=null;render();window.__toasts=[];window.toast=s=>__toasts.push(s);
   window.__snap=()=>{const d=serializeData();d.savedAt='';return paidStableJson(d);};
  });return {ctx,page};
 }
 const {ctx,page}=await open(true);
 const foot=label=>page.evaluate(label=>[...document.querySelectorAll('#modalRoot .mfoot button')].find(b=>b.textContent===label).click(),label);
 await test('① 문의 선택·형식·중복 초기화·44px·가로 넘침',async()=>{
  await page.evaluate(()=>{hjInquiryView({area:'가상 지역',text:'가상 내용',src:'naverplace'});window.__pick=[{name:[' 김가상 '],tel:['01012345678']}];});
  assert.equal(await page.locator('#inqPick').count(),1);
  await page.locator('#inqPick').click();await page.waitForFunction(()=>document.getElementById('inqPhone').value==='010-1234-5678');
  assert.equal(await page.locator('#inqName').inputValue(),'김가상');await foot('📥 등록');assert.equal(await page.locator('#inqDup').isVisible(),true);
  await page.locator('#inqPick').click();await page.waitForFunction(()=>document.getElementById('inqDup').hidden);
  const r=await page.evaluate(()=>({h:document.getElementById('inqPick').getBoundingClientRect().height,w:document.querySelector('.modal').scrollWidth-document.querySelector('.modal').clientWidth,args:__pickArgs,area:document.getElementById('inqArea').value,text:document.getElementById('inqText').value,src:document.getElementById('inqSrc').value}));
  assert(r.h>=44);assert(r.w<=0);assert.deepEqual(r.args,{props:['name','tel'],opts:{multiple:false}});assert.equal(r.area,'가상 지역');assert.equal(r.text,'가상 내용');assert.equal(r.src,'naverplace');
 });
 await test('② 고객 선택 후 닫기 불변·저장 때만 반영',async()=>{
  await page.evaluate(()=>{closeModal(true);window.__before=__snap();hjCustQuickView('가상현장');window.__pick=[{name:['선택가상'],tel:['0111234567']}];});
  assert.equal(await page.locator('#cqPick').count(),1);assert((await page.locator('#cqPick').boundingBox()).height>=44);await page.locator('#cqPick').click();await page.waitForFunction(()=>document.getElementById('cqPhone').value==='011-123-4567');
  assert.equal(await page.locator('#cqAddr').inputValue(),'가상 주소');assert.equal(await page.locator('#cqSrc').inputValue(),'naverplace');await foot('닫기');
  assert(await page.evaluate(()=>__before===__snap()));
  await page.evaluate(()=>hjCustQuickView('가상현장'));await page.locator('#cqPick').click();await page.waitForFunction(()=>document.getElementById('cqName').value==='선택가상');await foot('저장');
  const r=await page.evaluate(()=>({cu:state.projects[0].customer,contacts:state.contacts.length}));assert.deepEqual(r.cu,{name:'선택가상',phone:'011-123-4567',addr:'가상 주소'});assert.equal(r.contacts,0);
 });
 await test('③ 취소·오류·국제번호·늦은 응답',async()=>{
  await page.evaluate(()=>{closeModal(true);hjInquiryView({name:'유지',phone:'02-123-4567'});window.__pick=[];window.__toasts=[];});
  assert.equal(await page.locator('#inqPick').count(),1);await page.locator('#inqPick').click();await page.waitForFunction(()=>!document.getElementById('inqPick').disabled);assert.equal(await page.locator('#inqName').inputValue(),'유지');
  const r=await page.evaluate(async()=>{const out=[];for(const e of ['AbortError','InvalidStateError']){window.__pickError=e;out.push(await hjPickOneContact());}const quiet=__toasts.length;window.__pickError='NotAllowedError';out.push(await hjPickOneContact());window.__pickError='';window.__pick=[{name:[' 해외가상 '],tel:[' +82 10 0000 0000 ']}];return {out,quiet,toasts:__toasts,foreign:await hjPickOneContact()};});
  assert.deepEqual(r.out,[null,null,null]);assert.equal(r.quiet,0);assert.deepEqual(r.toasts,['주소록을 열지 못했어요']);assert.equal(r.foreign.phone,'+82 10 0000 0000');
  await page.evaluate(()=>{navigator.contacts.select=()=>new Promise(resolve=>window.__late=resolve);document.getElementById('inqPick').click();closeModal(true);hjInquiryView({name:'다음 창'});__late([{name:['늦은가상'],tel:['01000000000']}]);});
  assert.equal(await page.locator('#inqName').inputValue(),'다음 창');
 });
 await test('④ 미지원 기기 버튼 없음',async()=>{const u=await open(false);const r=await u.page.evaluate(()=>{hjInquiryView();const a=!!document.getElementById('inqPick');closeModal(true);hjCustQuickView('가상현장');return {a,b:!!document.getElementById('cqPick')};});assert.deepEqual(r,{a:false,b:false});await u.ctx.close();});
 await ctx.close();await browser.close();console.log('contactpick-v393: '+results.filter(Boolean).length+'/'+results.length+' passed, pageerrors='+errors.length);process.exit(results.every(Boolean)&&!errors.length?0:1);
})().catch(e=>{console.error(e);process.exit(1);});

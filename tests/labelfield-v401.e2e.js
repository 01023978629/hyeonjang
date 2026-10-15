/* v401 실제 메모리 필드로 홍보 제외·완료 힌트·작업 사진 집계를 검증한다. 가상 자료만. */
'use strict';
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const assert=require('node:assert/strict'),results=[];
async function test(name,fn){try{await fn();results.push(true);console.log('PASS '+name);}catch(e){results.push(false);console.log('FAIL '+name+' '+e.stack);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined}),ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:780}}),page=await ctx.newPage(),errors=[];
 page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(String(e)));await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_gcal_auto','0');});
 await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__hjOfficeOpsBootDone);
 await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);window.taxCalendarEnsure=()=>0;window.coworkSchedEnsure=()=>0;window.portalAutoSync=()=>0;aiOpsEnsureState().enabled=false;clearTimeout(__idbSaveTimer);await __appStateWriteQueue;window.__ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return localDate(d);};});
 const seed=()=>page.evaluate(()=>{closeModal(true);state._demo=false;for(const k of ['schedule','notes','payLog','asLog','contacts','adPosts','satisfaction','quotes'])state[k]=[];state.projects=[{name:'가상현장',stage:3,doneAt:__ago(10),received:0,phases:['방수'],cost:{},customer:{}}];state.files=['정리','청소','방수','미장','타일 완료'].map((label,i)=>({id:'photo'+i,key:'photo'+i,name:'photo'+i+'.jpg',prefix:'현장사진/',kind:'photo',project:'가상현장',_worklabel:label,when:new Date(__ago(40)+'T12:00:00')}));state.tab='dashboard';state.activeProject=null;render();});
 await test('① 실제 작업명: 정리 제외와 홍보 원고 사진 3장',async()=>{await seed();const r=await page.evaluate(()=>{const usable=state.files.map(hjAdPhotoUsable);adDraftOpen('web','가상현장');return {usable,text:document.querySelector('#adDraftPhotos .adPhN').textContent};});assert.deepEqual(r.usable,[false,false,true,true,true]);assert(r.text.includes('사진 3장')&&r.text.includes('정리 사진 2장 뺌'));});
 await test('② 실제 완료 작업명: 방치 현장 줄 힌트',async()=>{await seed();await page.evaluate(async()=>{state.projects[0].stage=1;await staleProjects();});assert.equal(await page.locator('.stpHint').textContent(),"📷 '완료' 사진 있음");});
 await test('③ 작업 사진 3장·읽기 불변·메모리 우선/옛 필드 호환',async()=>{await seed();const r=await page.evaluate(()=>{const snap=()=>{const d=serializeData();d.savedAt='';return paidStableJson(d);},before=snap(),work=hjStaleWorkPhotos('가상현장');return {work,same:before===snap(),labels:typeof hjPhotoLabel==='function'?[hjPhotoLabel({_worklabel:' 방수 ',worklabel:'정리'}),hjPhotoLabel({_phase:'미장'}),hjPhotoLabel({worklabel:'타일'}),hjPhotoLabel({phase:'철거'}),hjPhotoLabel(null)]:[]};});assert.equal(r.work.n,3);assert(r.same);assert.deepEqual(r.labels,['방수','미장','타일','철거','']);});
 await browser.close();console.log('labelfield-v401: '+results.filter(Boolean).length+'/'+results.length+' passed, pageerrors='+errors.length);process.exit(results.every(Boolean)&&!errors.length?0:1);
})().catch(e=>{console.error(e);process.exit(1);});

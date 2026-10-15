/* v418: 이 기존 검사에서는 과거 단가 자동채움을 끈다. 자동채움은 bathprices-v418에서 별도로 검증한다. */
/* 사진 준비/취소/실패가 늦게 끝나도 고객 출력은 현재 선택과 일치한다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const source=fs.readFileSync(path.join(__dirname,'../bathroom.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});let passed=0,mutations=0;
 async function scenario(name,run,script){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
  try{
   await ctx.route('https://**/*',r=>r.abort());if(script)await page.route('**/bathroom.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:script}));
   await page.route("**/bathroom-defaults.json*",r=>r.fulfill({status:404,body:""}));await page.goto('http://127.0.0.1:8299/bathroom.html');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
   await page.evaluate(()=>{
    const nativeDecode=Image.prototype.decode,nativeFetch=window.fetch;window.__photoJobs=[];window.__photoHTML=0;window.__photoPrints=0;
    Image.prototype.decode=function(){const ready=nativeDecode.call(this);ready.catch(()=>{});return new Promise((resolve,reject)=>window.__photoJobs.push({ok:async()=>{await ready;resolve();},fail:()=>reject(new Error('TEST_IMAGE_FAILURE'))}));};
    window.fetch=(url,...args)=>{if(url==='bathroom.css')window.__photoHTML++;return nativeFetch(url,...args);};window.print=()=>window.__photoPrints++;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});
   });
   await run(page);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(!script){passed++;console.log('PASS '+name);}
  }finally{await ctx.close();}
 }
 async function choose(page,name,color='#c22'){
  const url=await page.evaluate(color=>{const c=document.createElement('canvas');c.width=16;c.height=16;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,16,16);return c.toDataURL('image/png');},color);
  const count=await page.evaluate(()=>window.__photoJobs.length);
  await page.locator('#sitePhoto').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(url.split(',')[1],'base64')});await page.waitForFunction(count=>window.__photoJobs.length===count+1,count);return count;
 }
 async function settle(page,index,fail=false){await page.evaluate(async({index,fail})=>{await window.__photoJobs[index][fail?'fail':'ok']();await new Promise(resolve=>requestAnimationFrame(resolve));},{index,fail});}
 async function html(page){const next=page.waitForEvent('download');await page.locator('#exportHTML').click();return fs.readFileSync(await(await next).path(),'utf8');}
 async function pending(page){
  await choose(page,'TEST_FIRST.png');
  assert(await page.locator('#exportHTML').isDisabled(),'PHOTO_PENDING_HTML_BUTTON');assert(await page.locator('#printQuote').isDisabled(),'PHOTO_PENDING_PRINT_BUTTON');
  assert(await page.locator('#sitePhotoStatus').isVisible());assert(await page.locator('#clearPhoto').isVisible());
  assert(await page.locator('#exportCSV').isEnabled());assert(await page.locator('#copyQuote').isEnabled());
  await page.evaluate(()=>document.getElementById('exportHTML').dispatchEvent(new MouseEvent('click')));
  assert.equal(await page.evaluate(()=>window.__photoHTML),0,'PHOTO_PENDING_HTML_ENTRY');
  await page.evaluate(()=>document.getElementById('printQuote').dispatchEvent(new MouseEvent('click')));
  assert.equal(await page.evaluate(()=>window.__photoPrints),0,'PHOTO_PENDING_PRINT_ENTRY');
  await page.locator('#roomWidth').fill('');await settle(page,0);
  assert(await page.locator('#exportHTML').isDisabled());assert(await page.locator('#printQuote').isDisabled());assert(await page.locator('#sitePhotoStatus').isHidden());
  await page.locator('#roomWidth').fill('180');assert(await page.locator('#exportHTML').isEnabled());
  const image=await page.locator('#sitePhotoPreview').getAttribute('src');assert(image.startsWith('data:image/jpeg'));
  assert((await html(page)).includes('src="'+image+'"'),'completed photo is embedded in the customer file');
 }
 async function stale(page){
  await choose(page,'TEST_ORIGINAL.png');await settle(page,0);const original=await page.locator('#sitePhotoPreview').getAttribute('src');
  await choose(page,'TEST_OLD_PENDING.png','#2c2');await choose(page,'TEST_NEW_PENDING.png','#22c');const status=await page.locator('#status').textContent();
  await settle(page,1,true);
  assert.equal(await page.locator('#status').textContent(),status,'PHOTO_STALE_FAILURE_NOTICE');
  assert(await page.locator('#exportHTML').isDisabled(),'PHOTO_STALE_FAILURE_PENDING');
  assert.equal(await page.locator('#sitePhoto').evaluate(el=>el.files[0].name),'TEST_NEW_PENDING.png');
  await settle(page,2);const current=await page.locator('#sitePhotoPreview').getAttribute('src');assert.notEqual(current,original);assert(await page.locator('#exportHTML').isEnabled());
  assert.match(await page.locator('#status').textContent(),/사진을 추가했습니다/);
  await choose(page,'TEST_CURRENT_FAILURE.png');await settle(page,3,true);
  assert.match(await page.locator('#status').textContent(),/사진을 읽을 수 없습니다/);assert.equal(await page.locator('#sitePhoto').inputValue(),'');
  assert.equal(await page.locator('#sitePhotoPreview').getAttribute('src'),current,'실패한 새 사진은 마지막으로 읽은 사진을 덮지 않는다');assert(await page.locator('#exportHTML').isEnabled());
 }
 async function cancel(page){
  await page.locator('#saveDraft').click();const saved=await page.evaluate(()=>localStorage.getItem('hj_bathroom_consult_v1'));
  await choose(page,'TEST_RESTORE_CANCEL.png');page.once('dialog',d=>d.accept());await page.locator('#loadDraft').click();await settle(page,0);
  assert(await page.locator('#sitePhotoPreview').isHidden());assert(await page.locator('#exportHTML').isEnabled());
  await choose(page,'TEST_CLEAR_CANCEL.png');await page.locator('#clearPhoto').click();const status=await page.locator('#status').textContent();await settle(page,1,true);
  assert.equal(await page.locator('#status').textContent(),status);assert(await page.locator('#sitePhotoPreview').isHidden());assert(await page.locator('#sitePhotoStatus').isHidden());assert(await page.locator('#exportHTML').isEnabled());
  await choose(page,'TEST_INVALID_REPLACEMENT.png');await page.locator('#sitePhoto').setInputFiles({name:'TEST_INVALID.txt',mimeType:'text/plain',buffer:Buffer.from('TEST_INVALID')});
  assert.match(await page.locator('#status').textContent(),/10MB 이하/);await settle(page,2);
  assert(await page.locator('#sitePhotoPreview').isHidden());assert(await page.locator('#exportHTML').isEnabled());
  assert.equal(await page.evaluate(()=>localStorage.getItem('hj_bathroom_consult_v1')),saved);
 }
 async function exportThenPhoto(page){
  await page.evaluate(()=>{const native=window.fetch,gate=new Promise(resolve=>window.__releasePhotoCSS=resolve);window.fetch=(url,...args)=>url==='bathroom.css'?gate.then(()=>native(url,...args)):native(url,...args);});
  await page.locator('#exportHTML').click();await choose(page,'TEST_DURING_EXPORT.png');
  const next=page.waitForEvent('download');await page.evaluate(()=>window.__releasePhotoCSS());const old=fs.readFileSync(await(await next).path(),'utf8');assert(!old.includes('<img class="report-photo"'));
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('고객용 파일을 저장했습니다'));
  assert(await page.locator('#exportHTML').isDisabled(),'PHOTO_PENDING_AFTER_EXPORT');
  await settle(page,0);assert(await page.locator('#exportHTML').isEnabled());assert((await html(page)).includes('<img class="report-photo"'));
 }
 try{
  await scenario('사진 준비 중 파일·인쇄 차단, 입력 오류 수정 후 실제 사진 출력',pending);
  await scenario('늦은 이전 실패 무시와 현재 실패 후 마지막 사진 보존',stale);
  await scenario('복원·사진 빼기·잘못된 새 파일 선택이 지연 사진을 취소',cancel);
  await scenario('기존 고객 파일 생성이 끝나도 새 사진 준비 중 잠금 유지',exportThenPhoto);
  for(const [name,from,to,run,marker] of [
   ['준비 중 버튼 잠금 제거',"if(photoPending){$('exportHTML')","if(false){$('exportHTML')",pending,'PHOTO_PENDING_HTML_BUTTON'],
   ['준비 중 파일 진입 차단 제거','if(!result||htmlExporting||photoPending)return;','if(!result||htmlExporting)return;',pending,'PHOTO_PENDING_HTML_ENTRY'],
   ['준비 중 인쇄 차단 제거','if(result&&!photoPending)window.print();','if(result)window.print();',pending,'PHOTO_PENDING_PRINT_ENTRY'],
   ['이전 실패 메시지 보호 제거',"if(token===photoToken){e.target.value='';notify('사진을 읽을", "if(true){e.target.value='';notify('사진을 읽을",stale,'PHOTO_STALE_FAILURE_NOTICE'],
   ['이전 작업의 준비 상태 보호 제거','if(token===photoToken){photoPending=false;update();}','if(true){photoPending=false;update();}',stale,'PHOTO_STALE_FAILURE_PENDING'],
   ['고객 파일 종료 후 사진 잠금 제거','htmlExporting=false;button.disabled=!result||photoPending;','htmlExporting=false;button.disabled=!result;',exportThenPhoto,'PHOTO_PENDING_AFTER_EXPORT']
  ]){
   assert.equal(source.split(from).length,2,'unique mutation target '+name);let caught;
   try{await scenario(name,run,source.replace(from,to));}catch(e){caught=e;}
   assert(caught&&caught.code==='ERR_ASSERTION'&&caught.message.includes(marker),'mutation must fail at intended assertion: '+name+' '+(caught&&caught.stack));mutations++;console.log('DETECTED '+name);
  }
 }finally{await browser.close();}
 console.log('bathroom-photo e2e '+passed+'/'+passed+', mutations '+mutations+'/'+mutations);
})().catch(e=>{console.error(e);process.exitCode=1;});

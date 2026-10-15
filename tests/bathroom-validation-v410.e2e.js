/* v418: 이 기존 검사에서는 과거 단가 자동채움을 끈다. 자동채움은 bathprices-v418에서 별도로 검증한다. */
/* 미선택 입력은 보존하고, 선택 검증과 손상 초안 거부는 고객 출력까지 유지한다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',KEY='hj_bathroom_consult_v1';
const field=(page,key)=>page.locator('[data-path="'+key+'"]');
async function seed(page,kind='plain'){
 const raw=await page.evaluate(kind=>{
  const d=HJBath.defaults();d.project='TEST_VALIDATION_PROJECT';d.customer='TEST_VALIDATION_CUSTOMER';d.date='2026-10-15';
  d.wall.price=d.wall.labor=d.floor.price=d.floor.labor=100;
  d.scope.forEach(s=>{s.material=10;s.labor=20;});d.consumables.forEach(c=>c.price=10);
  if(kind==='preserve'){
   Object.assign(d.scope[4],{qty:'',material:-987654321,labor:'0.5',model:'TEST_UNSELECTED_MODEL_PRIVATE'});
   Object.assign(d.scope[5],{qty:1.5,material:null,labor:100000001});
   Object.assign(d.scope[6],{qty:'  -17.25 ',material:'',labor:-2});
   Object.assign(d.consumables[0],{usage:'',pack:0,price:'987654321'});
   Object.assign(d.consumables[1],{usage:null,pack:'1001.25',price:-123456789});
  }
  if(kind==='legacy'){
   Object.assign(d.scope[4],{qty:' +2 ',material:'0x10',labor:'+2'});
   Object.assign(d.scope[5],{qty:' 2 ',material:'   ',labor:0});
   Object.assign(d.consumables[0],{usage:' 0.5 ',pack:'0x10',price:'+2'});
  }
  return d;
 },kind);
 await page.evaluate(({key,raw})=>localStorage.setItem(key,JSON.stringify(raw)),{key:KEY,raw});
 await page.locator('#loadDraft').click();
 assert.match(await page.locator('#status').textContent(),/저장한 초안을 불러왔습니다/,'VALID_FIXTURE_LOAD');
 return raw;
}
async function ready(page,marker){assert(await page.locator('#formErrors').isHidden(),marker);for(const id of ['exportHTML','exportCSV','copyQuote','printQuote'])assert(await page.locator('#'+id).isEnabled(),marker+' '+id);}
async function blocked(page,marker){assert(await page.locator('#formErrors').isVisible(),marker);for(const id of ['exportHTML','exportCSV','copyQuote','printQuote'])assert(await page.locator('#'+id).isDisabled(),marker+' '+id);}
async function download(page,id){const event=page.waitForEvent('download');await page.locator('#'+id).click();return fs.readFileSync(await(await event).path(),'utf8');}
async function copy(page){await page.evaluate(()=>window.__validationCopy=null);await page.locator('#copyQuote').click();await page.waitForFunction(()=>typeof window.__validationCopy==='string');return page.evaluate(()=>window.__validationCopy);}
async function save(page){await page.locator('#saveDraft').click();assert.match(await page.locator('#status').textContent(),/초안을 저장했습니다/);return JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY));}
async function openOptions(page){await page.locator('#scope-toilet summary').click();await page.locator('#consumableFields').locator('..').locator(':scope > summary').click();}
async function scopeRecovery(page){
 await seed(page);await page.locator('#scope-toilet summary').click();const enabled=field(page,'scope.4.enabled');await enabled.check();
 for(const [key,value,fix] of [['qty','','1'],['qty','-1','1'],['qty','101','1'],['qty','1.5','1'],['material','-1','10'],['material','100000001','10'],['material','0.5','10'],['labor','-1','20']]){
  await field(page,'scope.4.'+key).fill(value);await blocked(page,'SELECTED_SCOPE_BLOCKED '+key+'='+value);
  assert(await page.locator('#scope-toilet').evaluate(el=>el.classList.contains('selected')),'INVALID_SELECTED_CARD_STATE');
  await enabled.uncheck();await ready(page,'INACTIVE_SCOPE_QUOTE_RECOVERS');
  assert.equal(await field(page,'scope.4.'+key).inputValue(),value,'INACTIVE_SCOPE_INPUT_PRESERVED');
  assert.equal(await page.locator('#price-toilet').textContent(),'선택 시 수량·단가 확인 필요','CARD_INVALID_NOTICE');
  assert(!await page.locator('#scope-toilet').evaluate(el=>el.classList.contains('selected')),'INACTIVE_CARD_STATE');
  await enabled.check();await blocked(page,'RESELECT_SCOPE_REVALIDATES');
  await field(page,'scope.4.'+key).fill(fix);await ready(page,'CORRECT_SCOPE_RECOVERS');
 }
 await enabled.uncheck();await field(page,'scope.4.material').fill('');await ready(page,'INACTIVE_EMPTY_PRICE_ALLOWED');
 assert.match(await page.locator('#price-toilet').textContent(),/단가 확인 필요/);assert(!(await page.locator('#price-toilet').textContent()).includes('수량·단가'));
}
async function consumableRecovery(page){
 await seed(page);await page.locator('#consumableFields').locator('..').locator(':scope > summary').click();const enabled=field(page,'consumables.0.enabled');await enabled.check();
 for(const [key,value,fix] of [['usage','','4'],['usage','-0.01','4'],['usage','101','4'],['pack','','20'],['pack','0','20'],['pack','1001','20'],['price','-1','10'],['price','0.5','10'],['price','100000001','10']]){
  await field(page,'consumables.0.'+key).fill(value);await blocked(page,'SELECTED_CONSUMABLE_BLOCKED');await enabled.uncheck();await ready(page,'INACTIVE_CONSUMABLE_QUOTE_RECOVERS');
  assert.equal(await field(page,'consumables.0.'+key).inputValue(),value,'INACTIVE_CONSUMABLE_INPUT_PRESERVED');
  assert((await page.locator('.report-note').textContent()).includes('타일 접착제'));
  await enabled.check();await blocked(page,'RESELECT_CONSUMABLE_REVALIDATES');await field(page,'consumables.0.'+key).fill(fix);await ready(page,'CORRECT_CONSUMABLE_RECOVERS');
 }
}
function optionalValues(d){return {scope:d.scope.map(s=>({enabled:s.enabled,qty:s.qty,material:s.material,labor:s.labor,model:s.model})),consumables:d.consumables.map(c=>({enabled:c.enabled,usage:c.usage,pack:c.pack,price:c.price}))};}
async function preservedOutputs(page){
 const raw=await seed(page,'preserve');await ready(page,'INACTIVE_INVALID_DRAFT_ACCEPTED');
 const saved=await save(page);assert.deepEqual(optionalValues(saved),optionalValues(raw),'INACTIVE_SAVE_RAW_VALUES');
 await page.locator('#scope-toilet summary').click();await field(page,'scope.4.qty').fill('3');await field(page,'project').fill('TEST_CHANGED');await page.locator('#loadDraft').click();
 assert.equal(await field(page,'project').inputValue(),raw.project);assert.equal(await field(page,'scope.4.qty').inputValue(),'');
 assert.deepEqual(optionalValues(await save(page)),optionalValues(raw),'INACTIVE_RESTORE_RAW_VALUES');
 const storage=await page.evaluate(key=>localStorage.getItem(key),KEY),report=await page.locator('#report').textContent(),copied=await copy(page),csv=await download(page,'exportCSV'),html=await download(page,'exportHTML');
 for(const [kind,text] of Object.entries({report,copied,csv,html})){
  for(const value of ['TEST_UNSELECTED_MODEL_PRIVATE','987654321','123456789','1001.25','-17.25'])assert(!text.includes(value),'INACTIVE_PRIVATE_VALUE_NOT_EXPORTED '+kind+' '+value);
  for(const name of ['양변기','타일 접착제','줄눈재'])assert(text.includes(name),'INACTIVE_NAME_IS_EXCLUDED '+kind+' '+name);
 }
 const priceRows=await page.locator('.price-table tbody').textContent();assert(!priceRows.includes('양변기')&&!priceRows.includes('타일 접착제'),'INACTIVE_NOT_IN_PRICE_ROWS');
 assert(!csv.includes('"자재","양변기"')&&!csv.includes('"자재","타일 접착제"'),'INACTIVE_NOT_IN_CSV_ROWS');
 await page.locator('#printQuote').click();assert.equal(await page.evaluate(()=>window.__validationPrints),1);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),storage,'OUTPUTS_KEEP_RAW_DRAFT');
}
async function addPhoto(page,pending=false){
 const url=await page.evaluate(pending=>{
  if(pending){const decode=Image.prototype.decode;Image.prototype.decode=function(){const ready=decode.call(this);return new Promise((resolve,reject)=>{window.__validationPhotoDone=async()=>{try{await ready;resolve();}catch(e){reject(e);}};});};}
  const c=document.createElement('canvas');c.width=12;c.height=12;c.getContext('2d').fillRect(0,0,12,12);return c.toDataURL('image/png');
 },pending);
 await page.locator('#sitePhoto').setInputFiles({name:'TEST_VALIDATION_PHOTO.png',mimeType:'image/png',buffer:Buffer.from(url.split(',')[1],'base64')});
 if(pending)await page.waitForFunction(()=>typeof window.__validationPhotoDone==='function');
 else await page.waitForFunction(()=>!document.getElementById('sitePhotoPreview').hidden&&document.getElementById('sitePhotoStatus').hidden);
}
async function viewState(page){return page.evaluate(()=>({fields:[...document.querySelectorAll('[data-path]')].map(el=>[el.dataset.path,el.value,el.checked]),photo:document.getElementById('sitePhotoPreview').getAttribute('src'),photoHidden:document.getElementById('sitePhotoPreview').hidden,photoFile:document.getElementById('sitePhoto').value,report:document.getElementById('report').innerHTML,buttons:[...document.querySelectorAll('.export-buttons button')].map(el=>[el.id,el.disabled])}));}
async function malformedDraft(page){
 const valid=await seed(page);await addPhoto(page);const before=await viewState(page);
 const cases=[['scope.4.qty',true,false],['scope.4.qty',[2],true],['scope.4.material',true,false],['scope.4.labor',{},true],['consumables.0.usage',[2],false],['consumables.0.pack',true,true],['consumables.0.price',[],false],['consumables.0.price',{},true],['size.width',[180]],['wall.pack',[8]],['floor.price',true],['wall.labor',{}],['scope.4.qty','TEST_NONFINITE_POS',false],['consumables.0.price','TEST_NONFINITE_NEG',false],...['abc','1,000','NaN','Infinity','1e999'].flatMap(value=>[['scope.4.qty',value,false],['consumables.0.price',value,false],['scope.4.labor',value,true]])];
 for(const [key,value,enabled] of cases){
  const damaged=JSON.parse(JSON.stringify(valid)),parts=key.split('.');let item=damaged;for(const p of parts.slice(0,-1))item=item[p];item[parts.at(-1)]=value;if(enabled!==undefined)item.enabled=enabled;
  const raw=JSON.stringify(damaged).replace('"TEST_NONFINITE_POS"','1e999').replace('"TEST_NONFINITE_NEG"','-1e999');
  await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);window.__validationConfirms=0;},{key:KEY,raw});await page.locator('#loadDraft').click();
  assert.match(await page.locator('#status').textContent(),/저장한 초안을 읽을 수 없습니다/,'MALFORMED_DRAFT_REJECTED '+key);
  assert.equal(await page.evaluate(()=>window.__validationConfirms),0,'MALFORMED_NO_REPLACE_CONFIRM '+key);
  assert.deepEqual(await viewState(page),before,'MALFORMED_CURRENT_VIEW_PRESERVED '+key);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw,'MALFORMED_STORAGE_ORIGINAL_PRESERVED '+key);
 }
}
async function legacyNumbers(page){
 const raw=await seed(page,'legacy');await openOptions(page);
 for(const [key,value] of [['scope.4.qty','2'],['scope.4.material','16'],['scope.4.labor','2'],['consumables.0.usage','0.5'],['consumables.0.pack','16'],['consumables.0.price','2']])assert.equal(await field(page,key).inputValue(),value,'LEGACY_NUMERIC_DISPLAY '+key);
 assert((await page.locator('#price-toilet').textContent()).includes('36원'),'LEGACY_CARD_NUMERIC_VALUE');
 assert.deepEqual(optionalValues(await save(page)),optionalValues(raw),'LEGACY_RAW_VALUES_SAVED');
 await field(page,'scope.4.enabled').check();await ready(page,'LEGACY_SELECTED_VALID');
 const copied=await copy(page);assert(copied.includes('양변기 × 2개'),'LEGACY_COPY_NUMERIC_QTY');
 await field(page,'scope.5.enabled').check();await ready(page,'BLANK_PRICE_ALLOWED');assert.equal(await page.locator('#mobileAmount').textContent(),'단가 확인 중');
 const blank=await save(page);assert.equal(blank.scope[5].material,null,'ACTIVE_BLANK_PRICE_NULL');assert.equal(blank.scope[5].labor,0,'ACTIVE_ZERO_PRICE_ZERO');
 await page.locator('#scope-basin summary').click();await field(page,'scope.5.material').fill('0');await ready(page,'ZERO_PRICE_RECOVERS_TOTAL');assert.notEqual(await page.locator('#mobileAmount').textContent(),'단가 확인 중');
 const rows=await page.locator('.price-table tbody tr').allTextContents();assert.equal(rows.filter(x=>x.includes('세면대·하부장')).length,2);for(const row of rows.filter(x=>x.includes('세면대·하부장')))assert(row.includes('0원'),'ZERO_PRICE_ROWS');
 await field(page,'consumables.0.enabled').check();await ready(page,'LEGACY_CONSUMABLE_SELECTED');
}
async function pendingRecovery(page){
 await seed(page);await page.locator('#scope-toilet summary').click();await field(page,'scope.4.enabled').check();await field(page,'scope.4.qty').fill('');await addPhoto(page,true);
 await field(page,'scope.4.enabled').uncheck();assert(await page.locator('#formErrors').isHidden(),'PENDING_INACTIVE_RECOVERS_CALC');
 assert(await page.locator('#exportCSV').isEnabled());assert(await page.locator('#copyQuote').isEnabled());assert(await page.locator('#exportHTML').isDisabled(),'PENDING_HTML_STILL_LOCKED');assert(await page.locator('#printQuote').isDisabled(),'PENDING_PRINT_STILL_LOCKED');
 await page.evaluate(()=>window.__validationPhotoDone());await page.waitForFunction(()=>document.getElementById('sitePhotoStatus').hidden);await ready(page,'PHOTO_READY_RECOVERS_EXPORT');
 const preview=page.locator('#sitePhotoPreview');
 assert.equal(await preview.evaluate(el=>el.hidden),false,'PHOTO_READY_PREVIEW_NOT_HIDDEN');
 assert.match(await preview.getAttribute('src'),/^data:image\/jpeg;base64,/,'PHOTO_READY_PREVIEW_DATA');
 // 해제 체크박스까지 스크롤한 뒤라 미리보기는 화면 밖이다. lazy 이미지의 실제 디코딩은 별도로 기다린다.
 await preview.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const img=document.getElementById('sitePhotoPreview');return img.complete&&img.naturalWidth>0&&img.naturalHeight>0;});
 assert(await preview.isVisible(),'PHOTO_READY_PREVIEW_VISIBLE');
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});let passed=0,mutations=0;
 async function scenario(name,run,mutation){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
  try{
   await ctx.route('https://**/*',r=>r.abort());
   if(mutation){const source=fs.readFileSync(path.join(__dirname,'..',mutation.file),'utf8');assert.equal(source.split(mutation.from).length,2,'unique mutation target '+name);await ctx.route('**/'+mutation.file,r=>r.fulfill({status:200,contentType:'application/javascript',body:source.replace(mutation.from,mutation.to)}));}
   await page.route("**/bathroom-defaults.json*",r=>r.fulfill({status:404,body:""}));await page.goto(BASE+'/bathroom.html');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
   await page.evaluate(()=>{window.__validationConfirms=0;window.confirm=()=>{window.__validationConfirms++;return true;};window.__validationPrints=0;window.print=()=>window.__validationPrints++;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__validationCopy=text;}}});localStorage.setItem('bath_validation_unrelated','KEEP');});
   let caught;try{await run(page);}catch(e){caught=e;}
   if(mutation)assert(caught&&caught.code==='ERR_ASSERTION'&&caught.message.includes(mutation.marker),'mutation must fail at intended assertion: '+name+' '+(caught&&caught.stack));else if(caught)throw caught;
   assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'MOBILE_390_NO_OVERFLOW');assert.equal(await page.evaluate(()=>localStorage.getItem('bath_validation_unrelated')),'KEEP');
   if(mutation){mutations++;console.log('DETECTED '+name);}else{passed++;console.log('PASS '+name);}
  }finally{await ctx.close();}
 }
 try{
  await scenario('미선택 공사 오류 회복·재선택 검증·수정 회복',scopeRecovery);
  await scenario('미선택 부자재 사용량·포장·단가 오류 회복',consumableRecovery);
  await scenario('미선택 원값 저장·복원과 고객 출력 분리',preservedOutputs);
  await scenario('손상 숫자 타입 초안을 확인 전 거부하고 사진·입력·저장 유지',malformedDraft);
  await scenario('기존 숫자 문자열 표시·저장과 빈 단가·무료 구별',legacyNumbers);
  await scenario('미선택 오류 회복이 사진 준비 출력 잠금을 풀지 않음',pendingRecovery);
  for(const [name,run,mutation] of [
   ['미선택 수량 검증 완화 제거',scopeRecovery,{file:'bathroom-model.js',from:'return enabled?number(v,label,min,max,integer):v===undefined?null:v;',to:'return number(v,label,min,max,integer);',marker:'INACTIVE_SCOPE_QUOTE_RECOVERS'}],
   ['숫자 타입 보호 제거',malformedDraft,{file:'bathroom-model.js',from:"if(v!==null&&v!==undefined&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v)))",to:'if(false)',marker:'MALFORMED_DRAFT_REJECTED'}],
   ['미선택 카드 계산 검증 제거',scopeRecovery,{file:'bathroom.js',from:'M.hjBathScopeAmount(s)',to:'Number(s.qty)*(Number(s.material)+Number(s.labor))',marker:'CARD_INVALID_NOTICE'}],
   ['기존 숫자 문자열 화면 변환 제거',legacyNumbers,{file:'bathroom.js',from:"el.type==='number'?hjBathInputValue(v):",to:"el.type==='number'?v:",marker:'LEGACY_NUMERIC_DISPLAY'}],
   ['숫자로 표시할 수 없는 문자열 거부 제거',malformedDraft,{file:'bathroom-model.js',from:"if(typeof v==='string'&&v.trim()!==''&&!Number.isFinite(Number(v)))",to:'if(false)',marker:'MALFORMED_DRAFT_REJECTED'}]
  ])await scenario(name,run,mutation);
 }finally{await browser.close();}
 console.log('bathroom-validation e2e '+passed+'/'+passed+', mutations '+mutations+'/'+mutations);
})().catch(e=>{console.error(e);process.exitCode=1;});

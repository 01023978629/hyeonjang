/* v418: 이 기존 검사에서는 과거 단가 자동채움을 끈다. 자동채움은 bathprices-v418에서 별도로 검증한다. */
/* 선택 카드의 계산 근거·빈 단가 바로가기·모바일 견적서를 실제 고객 출력과 대조한다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',KEY='hj_bathroom_consult_v1';
const MODEL='TEST_PRODUCT_'+('LONG'.repeat(20))+'<b>고객 확인</b>\n설치 범위 포함';
const field=(page,key)=>page.locator('[data-path="'+key+'"]');
const checklist=page=>page.locator('#priceChecklist [data-price-path]');
const priceRow=(page,id)=>page.locator('.price-table tr[data-row-id="'+id+'"]');
async function seed(page,kind='priced'){
 const raw=await page.evaluate(({model,kind})=>{
  const d=HJBath.defaults();d.project='TEST_CHOICE_PROJECT';d.customer='TEST_CHOICE_CUSTOMER';d.date='2026-10-15';
  d.wall.price=10000;d.wall.labor=50000;d.floor.price=12000;d.floor.labor=60000;
  d.scope.forEach(s=>{s.enabled=false;s.material=null;s.labor=null;});
  Object.assign(d.scope[4],{enabled:true,qty:2,material:100000,labor:50000,model});
  d.consumables[0].price=7000;d.consumables[1].price=null;
  if(kind==='missing'){d.wall.price=d.wall.labor=d.floor.price=d.floor.labor=null;d.scope[4].labor=null;d.consumables[0].enabled=true;d.consumables[0].price=null;}
  if(kind==='adhesive')d.consumables[0].enabled=true;
  return d;
 },{model:MODEL,kind});
 await page.evaluate(({key,raw})=>{localStorage.setItem(key,JSON.stringify(raw));window.__choiceOriginal=localStorage.getItem(key);},{key:KEY,raw});
 await page.locator('#loadDraft').click();
 assert.match(await page.locator('#status').textContent(),/저장한 초안을 불러왔습니다/,'CHOICE_FIXTURE_LOADED');
 assert(await page.locator('#formErrors').isHidden(),'CHOICE_VALID_FIXTURE');
 return raw;
}
async function openParents(page,key){await field(page,key).evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
async function fill(page,key,value){await openParents(page,key);await field(page,key).fill(value);}
async function toggle(page,key,on){await openParents(page,key);await field(page,key).setChecked(on);}
async function download(page,id){const event=page.waitForEvent('download');await page.locator('#'+id).click();return fs.readFileSync(await(await event).path(),'utf8');}
async function copied(page){await page.evaluate(()=>window.__choiceCopied=null);await page.locator('#copyQuote').click();await page.waitForFunction(()=>typeof window.__choiceCopied==='string');return page.evaluate(()=>window.__choiceCopied);}
async function paths(page){return checklist(page).evaluateAll(els=>els.map(el=>el.dataset.pricePath).sort());}
async function scopeExplanation(page){
 await seed(page);
 // 기준 버전에서는 존재 단언으로 실패해야 한다. 없는 요소를 기다리다 timeout 난 것은 탐지가 아니다.
 assert.equal(await page.locator('#scope-toilet .option-breakdown').count(),1,'CHOICE_BREAKDOWN_PRESENT');
 const breakdown=page.locator('#scope-toilet .option-breakdown');
 assert((await breakdown.textContent()).includes('자재 2개 × 100,000원 = 200,000원'),'CHOICE_MATERIAL_FORMULA');
 assert((await breakdown.textContent()).includes('시공 2개 × 50,000원 = 100,000원'),'CHOICE_LABOR_FORMULA');
 assert((await breakdown.textContent()).includes('부가세 별도'),'CHOICE_BREAKDOWN_VAT');
 assert.equal(await page.locator('#price-toilet').textContent(),'선택됨 · + 300,000원 (부가세 별도)','CHOICE_CARD_TOTAL');
 const description=page.locator('#scope-toilet .option-description');
 assert((await description.textContent()).includes(MODEL),'CHOICE_PRODUCT_TEXT_PRESERVED');
 assert((await description.textContent()).includes('제품 모델과 배수 위치를 확인합니다.'),'CHOICE_SCOPE_NOTE_VISIBLE');
 assert.equal(await description.locator('b,img,script').count(),0,'CHOICE_PRODUCT_ESCAPED');
 assert(await description.isVisible(),'CHOICE_DESCRIPTION_WITHOUT_EXPANDING_SETTINGS');
 await field(page,'vat').selectOption('inclusive');
 assert((await breakdown.textContent()).includes('부가세 포함'),'CHOICE_INCLUDED_VAT');
 assert.equal(await page.locator('#price-toilet').textContent(),'선택됨 · + 300,000원 (부가세 포함)');
 await toggle(page,'scope.4.enabled',false);
 assert.equal(await page.locator('#price-toilet').textContent(),'선택하면 + 300,000원 (부가세 포함)');
 assert((await breakdown.textContent()).includes('200,000원'),'CHOICE_PRESELECT_EXPLANATION');
 assert.equal(await priceRow(page,'toiletMat').count(),0,'CHOICE_UNSELECTED_NOT_BILLED');
}
async function unknownFreeInvalid(page){
 await seed(page);await fill(page,'scope.4.material','');
 const breakdown=page.locator('#scope-toilet .option-breakdown');
 let text=await breakdown.textContent();
 assert(text.includes('자재 2개 × 확인 필요 = 확인 필요'),'CHOICE_UNKNOWN_NOT_FREE');
 assert(text.includes('시공 2개 × 50,000원 = 100,000원'),'CHOICE_KNOWN_COMPONENT_REMAINS');
 assert(text.includes('부가세 별도'),'CHOICE_PARTIAL_VAT_VISIBLE');
 assert.deepEqual(await paths(page),['scope.4.material'],'CHOICE_MISSING_ONE_PRICE');
 await fill(page,'scope.4.material','0');
 assert((await breakdown.textContent()).includes('자재 2개 × 0원 = 0원'),'CHOICE_ZERO_IS_FREE');
 assert.equal(await checklist(page).count(),0,'CHOICE_ZERO_NOT_MISSING');
 await fill(page,'scope.4.qty','');
 assert((await breakdown.textContent()).includes('수량·단가를 확인해 주세요.'),'CHOICE_INVALID_WARNING');
 assert(!/100,000|50,000|0원|NaN/.test(await breakdown.textContent()),'CHOICE_INVALID_NO_STALE_AMOUNTS');
 assert(await page.locator('#exportCSV').isDisabled(),'CHOICE_INVALID_EXPORT_BLOCKED');
 await toggle(page,'scope.4.enabled',false);
 assert(await page.locator('#formErrors').isHidden(),'CHOICE_INVALID_UNSELECTED_RECOVERY');
 assert((await breakdown.textContent()).includes('수량·단가를 확인해 주세요.'));
 assert.equal(await priceRow(page,'toiletWork').count(),0);
}
async function missingNavigation(page){
 await seed(page,'missing');
 const expected=['consumables.0.price','floor.labor','floor.price','scope.4.labor','wall.labor','wall.price'];
 assert.deepEqual(await paths(page),expected,'CHOICE_SELECTED_MISSING_ONLY');
 for(const key of expected){
  await page.locator('details').evaluateAll(els=>els.forEach(el=>el.open=false));
  const button=page.locator('#priceChecklist [data-price-path="'+key+'"]');
  assert(await button.evaluate(el=>el.tagName==='BUTTON'&&el.type==='button'),'CHOICE_REAL_ACTION_BUTTON');
  assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44;}),'CHOICE_PRICE_TARGET_44PX');
  await button.click();
  assert(await field(page,key).evaluate(el=>el===document.activeElement),'CHOICE_PRICE_TARGET_FOCUS');
  assert(await field(page,key).evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)return false;return true;}),'CHOICE_ALL_PARENT_DETAILS_OPEN');
  assert(await field(page,key).isVisible(),'CHOICE_TARGET_VISIBLE');
  await field(page,key).fill('0');
  assert(!(await paths(page)).includes(key),'CHOICE_FILLED_TARGET_REMOVED');
 }
 assert.equal(await checklist(page).count(),0,'CHOICE_ALL_PRICES_RESOLVED');
 assert((await page.locator('#priceChecklist').textContent()).includes('선택한 항목의 단가를 모두 입력했습니다.'),'CHOICE_COMPLETE_MESSAGE');
 assert.notEqual(await page.locator('#mobileAmount').textContent(),'단가 확인 중');
 // 양변기의 자재 단가 경로와 줄눈재 경로도 실제 입력칸으로 연결한다.
 await fill(page,'scope.4.material','');await toggle(page,'consumables.1.enabled',true);
 for(const key of ['scope.4.material','consumables.1.price']){
  await page.locator('details').evaluateAll(els=>els.forEach(el=>el.open=false));
  await page.locator('#priceChecklist [data-price-path="'+key+'"]').click();
  assert(await field(page,key).evaluate(el=>el===document.activeElement),'CHOICE_ALTERNATE_TARGET_FOCUS');
  await field(page,key).fill('0');
 }
 assert.equal(await checklist(page).count(),0);
}
async function checklistSynchronization(page){
 await seed(page,'missing');
 await toggle(page,'scope.4.enabled',false);assert(!(await paths(page)).includes('scope.4.labor'),'CHOICE_DESELECT_REMOVES_PRICE');
 await toggle(page,'consumables.0.enabled',false);assert(!(await paths(page)).includes('consumables.0.price'),'CHOICE_DESELECT_CONSUMABLE_PRICE');
 await toggle(page,'scope.4.enabled',true);assert((await paths(page)).includes('scope.4.labor'),'CHOICE_RESELECT_RESTORES_PRICE');
 await toggle(page,'scope.0.enabled',true);
 assert((await paths(page)).includes('scope.0.material')&&(await paths(page)).includes('scope.0.labor'),'CHOICE_LUMP_SUM_MISSING_BOTH');
 await fill(page,'size.width','');
 assert(await page.locator('#formErrors').isVisible(),'CHOICE_ROOM_ERROR_VISIBLE');
 assert.equal(await checklist(page).count(),0,'CHOICE_INVALID_CLEARS_CHECKLIST');
 assert((await page.locator('#priceChecklist').textContent()).includes('입력 오류를 먼저 확인해 주세요.'),'CHOICE_INVALID_CHECKLIST_GUIDANCE');
 await fill(page,'size.width','180');
 assert((await paths(page)).includes('scope.0.material'),'CHOICE_ERROR_RECOVERY_REBUILDS_CHECKLIST');
}
async function consumableExplanation(page){
 await seed(page,'adhesive');
 const adhesive=page.locator('#adhesiveResult');
 assert((await adhesive.textContent()).includes('20.04㎡ × 4kg/㎡ = 80.16kg → 5포장'),'CHOICE_CONSUMABLE_QUANTITY');
 assert((await adhesive.textContent()).includes('5포장 × 7,000원 = 35,000원 (부가세 별도)'),'CHOICE_CONSUMABLE_PRICE');
 assert((await page.locator('#wallResult').textContent()).includes('자재 13박스 × 10,000원 = 130,000원'),'CHOICE_TILE_PURCHASE_FORMULA');
 assert((await page.locator('#wallResult').textContent()).includes('시공 16.26㎡ × 50,000원 = 813,000원'),'CHOICE_TILE_WORK_FORMULA');
 await field(page,'vat').selectOption('inclusive');assert((await adhesive.textContent()).includes('35,000원 (부가세 포함)'),'CHOICE_CONSUMABLE_INCLUDED_VAT');
 await fill(page,'consumables.0.price','');assert((await adhesive.textContent()).includes('5포장 × 단가 확인 필요 = 단가 확인 필요'),'CHOICE_CONSUMABLE_UNKNOWN');
 await fill(page,'consumables.0.price','0');assert((await adhesive.textContent()).includes('5포장 × 0원 = 0원'),'CHOICE_CONSUMABLE_FREE');
 await fill(page,'consumables.0.price','7000');await fill(page,'size.width','');
 assert.equal(await adhesive.textContent(),'입력 오류를 확인하면 수량과 금액을 다시 계산합니다.','CHOICE_INVALID_CLEARS_CONSUMABLE');
 await fill(page,'size.width','180');await toggle(page,'consumables.0.enabled',false);
 assert.equal(await adhesive.textContent(),'포함을 선택하면 수량과 금액이 더해집니다.','CHOICE_UNSELECTED_CONSUMABLE_NO_PRICE');
 assert.equal(await priceRow(page,'adhesive').count(),0);
}
async function responsiveTable(page){
 assert.equal(await page.locator('.price-table').count(),1,'CHOICE_SINGLE_PRICE_TABLE');
 const rows=page.locator('.price-table tbody tr');assert.equal(await rows.count(),6,'CHOICE_EACH_ROW_ONCE');
 const ids=await rows.evaluateAll(els=>els.map(el=>el.dataset.rowId));
 assert.deepEqual(ids,['wallTile','wallWork','floorTile','floorWork','toiletMat','toiletWork'],'CHOICE_ROW_IDENTITIES');
 for(const id of ids){const labels=await priceRow(page,id).locator('td').evaluateAll(els=>els.map(el=>el.dataset.label));assert.deepEqual(labels,['구분','항목·계산 근거','수량','판매단가','금액'],'CHOICE_CELL_LABELS');}
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.locator('.price-table').scrollIntoViewIfNeeded();
  assert(await page.locator('.price-table').evaluate(el=>{const p=el.parentElement;return p.scrollWidth<=p.clientWidth&&el.getBoundingClientRect().width<=p.clientWidth;}),'CHOICE_PRICE_TABLE_NO_HORIZONTAL_SCROLL_'+width);
  assert(await priceRow(page,'toiletMat').evaluate(el=>getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'),'CHOICE_MOBILE_ROWS_VISIBLE');
  const basis=priceRow(page,'toiletMat').locator('td').nth(1);
  assert((await basis.textContent()).includes(MODEL),'CHOICE_LONG_MODEL_PRESERVED');
  assert(await basis.evaluate(el=>{const s=getComputedStyle(el);return el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight&&s.textOverflow!=='ellipsis'&&s.overflowX!=='hidden'&&s.overflowY!=='hidden';}),'CHOICE_LONG_MODEL_NOT_CLIPPED');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'CHOICE_PAGE_NO_HORIZONTAL_SCROLL_'+width);
 }
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('.price-table').evaluate(el=>getComputedStyle(el).display),'table','CHOICE_PRINT_TABLE');
 assert.equal(await priceRow(page,'toiletMat').evaluate(el=>getComputedStyle(el).display),'table-row','CHOICE_PRINT_ROW');
 assert.equal(await priceRow(page,'toiletMat').locator('td').first().evaluate(el=>getComputedStyle(el).display),'table-cell','CHOICE_PRINT_CELL');
 assert.equal(await page.locator('.price-table thead').evaluate(el=>getComputedStyle(el).display),'table-header-group','CHOICE_PRINT_HEADER');
 await page.emulateMedia({media:'screen'});
}
async function mobileAndFile(page){
 await seed(page);await responsiveTable(page);
 const html=await download(page,'exportHTML'),file=await page.context().newPage();
 try{await file.setContent(html);await responsiveTable(file);assert.equal(await file.locator('script').count(),0,'CHOICE_CUSTOMER_FILE_READ_ONLY');}
 finally{await file.close();}
 await page.locator('#printQuote').click();assert.equal(await page.evaluate(()=>window.__choicePrints),1,'CHOICE_PRINT_ACTION');
}
async function outputParity(page){
 await seed(page,'adhesive');
 assert.equal(await page.locator('#mobileAmount').textContent(),'1,694,880원','CHOICE_INDEPENDENT_TOTAL');
 const summary=await copied(page),csv=await download(page,'exportCSV');
 for(const text of ['자재비: 401,000원','시공비: 1,139,800원','부가세 포함 합계: 1,694,880원','양변기 × 2개 · '+MODEL])assert(summary.includes(text),'CHOICE_COPY_PRICE_PARITY '+text);
 for(const line of ['"자재 합계","401000"','"시공 합계","1139800"','"총액","1694880"','"자재","양변기","2","개","100000","200000"','"시공","양변기","2","개","50000","100000"','"자재","타일 접착제","5","포장","7000","35000"'])assert(csv.includes(line),'CHOICE_CSV_PRICE_PARITY '+line);
 assert((await priceRow(page,'toiletMat').textContent()).includes('200,000원'));
 await field(page,'vat').selectOption('inclusive');assert.equal(await page.locator('#mobileAmount').textContent(),'1,540,800원','CHOICE_INCLUDED_TOTAL');
 const included=await download(page,'exportCSV');assert(included.includes('"총액","1540800"'),'CHOICE_INCLUDED_CSV_TOTAL');
 assert((await copied(page)).includes('부가세 포함 합계: 1,540,800원'),'CHOICE_INCLUDED_COPY_TOTAL');
 await toggle(page,'scope.4.enabled',false);assert.equal(await page.locator('#mobileAmount').textContent(),'1,240,800원','CHOICE_DESELECT_SUBTRACTS_EXACT_COMPONENTS');
 assert.equal(await priceRow(page,'toiletMat').count(),0);assert.equal(await priceRow(page,'toiletWork').count(),0);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});let passed=0,mutations=0;
 async function scenario(name,run,mutation){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
  try{
   await ctx.route('https://**/*',r=>r.abort());
   if(mutation){const source=fs.readFileSync(path.join(__dirname,'..',mutation.file),'utf8');assert.equal(source.split(mutation.from).length,2,'unique mutation target '+name);await ctx.route('**/'+mutation.file,r=>r.fulfill({status:200,contentType:'application/javascript',body:source.replace(mutation.from,mutation.to)}));}
   await page.route("**/bathroom-defaults.json*",r=>r.fulfill({status:404,body:""}));await page.goto(BASE+'/bathroom.html');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
   await page.evaluate(()=>{window.confirm=()=>true;window.__choicePrints=0;window.print=()=>window.__choicePrints++;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__choiceCopied=text;}}});localStorage.setItem('bath_choice_unrelated','KEEP');});
   let caught;try{await run(page);}catch(e){caught=e;}
   if(mutation)assert(caught&&caught.code==='ERR_ASSERTION'&&caught.message.includes(mutation.marker),'mutation must fail at intended assertion: '+name+' '+(caught&&caught.stack));else if(caught)throw caught;
   assert.deepEqual(errors,[],'CHOICE_NO_SCRIPT_ERRORS');
   assert.equal(await page.evaluate(()=>localStorage.getItem('bath_choice_unrelated')),'KEEP','CHOICE_UNRELATED_STORAGE_UNCHANGED');
   assert(await page.evaluate(key=>localStorage.getItem(key)===window.__choiceOriginal,KEY),'CHOICE_EDIT_OUTPUT_DOES_NOT_AUTOSAVE');
   if(mutation){mutations++;console.log('DETECTED '+name);}else{passed++;console.log('PASS '+name);}
  }finally{await ctx.close();}
 }
 try{
  await scenario('선택 전후 카드에 자재·시공 산식·VAT·제품 설명을 보존',scopeExplanation);
  await scenario('미정·무료·잘못된 수량을 구별하고 이전 숫자를 지움',unknownFreeInvalid);
  await scenario('빈 단가 버튼은 접힌 설정을 열고 실제 입력칸에 초점 이동',missingNavigation);
  await scenario('미선택·재선택·치수 오류에 단가 목록을 동기화',checklistSynchronization);
  await scenario('부자재 포장 금액과 타일 박스·면적 금액의 근거 표시',consumableExplanation);
  await scenario('320·390px와 고객 HTML은 같은 견적 행을 줄바꿈하고 인쇄는 표 유지',mobileAndFile);
  await scenario('고객 복사·CSV·합계는 독립 계산과 일치하며 선택 해제 반영',outputParity);
  for(const [name,run,mutation] of [
   ['카드 계산 근거 제거',scopeExplanation,{file:'bathroom.js',from:"$('breakdown-'+s.id).innerHTML=hjBathScopeBreakdown(s);",to:"$('breakdown-'+s.id).innerHTML='';",marker:'CHOICE_MATERIAL_FORMULA'}],
   ['단가 바로가기 초점 제거',missingNavigation,{file:'bathroom.js',from:'el.focus({preventScroll:true});',to:'',marker:'CHOICE_PRICE_TARGET_FOCUS'}],
   ['제품 설명 이스케이프 제거',scopeExplanation,{file:'bathroom.js',from:"$('description-'+s.id).textContent=",to:"$('description-'+s.id).innerHTML=",marker:'CHOICE_PRODUCT_TEXT_PRESERVED'}],
   ['모바일 판매단가 표제 제거',mobileAndFile,{file:'bathroom.js',from:'<td role="cell" data-label="판매단가"',to:'<td role="cell" data-removed-label="판매단가"',marker:'CHOICE_CELL_LABELS'}],
   ['부자재 포장 금액 산식 제거',consumableExplanation,{file:'bathroom.js',from:"+hit.packs+'포장 × '+won(hit.price)",to:"+'TEST_REMOVED_PACK_PRICE'",marker:'CHOICE_CONSUMABLE_PRICE'}]
  ])await scenario(name,run,mutation);
 }finally{await browser.close();}
 console.log('bathroom-choice e2e '+passed+'/'+passed+', mutations '+mutations+'/'+mutations);
})().catch(e=>{console.error(e);process.exitCode=1;});

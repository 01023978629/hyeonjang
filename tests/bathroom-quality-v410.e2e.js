/* v418: 이 기존 검사에서는 과거 단가 자동채움을 끈다. 자동채움은 bathprices-v418에서 별도로 검증한다. */
/* 실제 입력/출력과 비동기 생성 중 입력을 검증한다. 보호 제거는 메모리 응답에만 적용한다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const source=fs.readFileSync(path.join(__dirname,'../bathroom.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});let passed=0,mutations=0;
 const fill=(page,key,value)=>page.locator('[data-path="'+key+'"]').fill(String(value));
 async function scenario(name,run,script){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.route('https://**/*',r=>r.abort());
   if(script)await page.route('**/bathroom.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:script}));
   await page.route("**/bathroom-defaults.json*",r=>r.fulfill({status:404,body:""}));await page.goto('http://127.0.0.1:8299/bathroom.html');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
   await run(page);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(!script){passed++;console.log('PASS '+name);}
  }finally{await ctx.close();}
 }
 async function manualPrice(page){
  await fill(page,'wall.labor',38000);await fill(page,'floor.labor',45000);
  for(const [k,field,value] of [['wall','width',400],['wall','height',650],['wall','pack',7],['floor','width',400],['floor','height',500],['floor','pack',6]]){
   await fill(page,k+'.price',28000);await fill(page,k+'.'+field,value);
   assert.equal(await page.locator('[data-path="'+k+'.price"]').inputValue(),'','MANUAL_PRICE_RECHECK '+k+'.'+field);
   assert.equal(await page.locator('[data-tile-preset="'+k+'"]').inputValue(),'','preset must describe actual dimensions');
   assert.match(await page.locator('#liveSummary').innerText(),/단가 확인 중/);
  }
  await fill(page,'wall.price',29000);await fill(page,'wall.width',400);await fill(page,'wall.waste',15);await fill(page,'project','가상 규격 점검');
  assert.equal(await page.locator('[data-path="wall.price"]').inputValue(),'29000','동일 규격·여유율·현장 이름 변경은 단가 보존');
  assert.equal(await page.locator('[data-path="wall.labor"]').inputValue(),'38000');assert.equal(await page.locator('[data-path="floor.labor"]').inputValue(),'45000');
  await page.locator('[data-tile-preset="wall"]').selectOption('600,600,4');assert.equal(await page.locator('[data-path="wall.price"]').inputValue(),'');
  await fill(page,'wall.price',31000);await fill(page,'wall.width',600);assert.equal(await page.locator('[data-path="wall.price"]').inputValue(),'31000');
  assert.equal(await page.locator('[data-tile-preset="wall"]').inputValue(),'600,600,4');
 }
 async function cssGate(page){
  await page.evaluate(()=>{
   const original=window.fetch;window.__qualityCssCount=0;window.__qualityReleaseCss=null;
   const gate=new Promise(resolve=>window.__qualityReleaseCss=resolve);
   window.fetch=(url,...args)=>{if(url==='bathroom.css'){window.__qualityCssCount++;return gate.then(()=>original(url,...args));}return original(url,...args);};
  });
 }
 async function exportBusy(page){
  await fill(page,'project','가상 생성 시작');await cssGate(page);
  try{
   await page.locator('#exportHTML').click();await page.waitForFunction(()=>window.__qualityCssCount===1);await fill(page,'project','가상 생성 중 수정');
   assert(await page.locator('#exportHTML').isDisabled(),'EXPORT_BUSY_INPUT');
   const count=await page.evaluate(()=>{document.getElementById('exportHTML').dispatchEvent(new MouseEvent('click',{bubbles:true}));return window.__qualityCssCount;});
   assert.equal(count,1,'EXPORT_BUSY_DUPLICATE');
   const next=page.waitForEvent('download');await page.evaluate(()=>window.__qualityReleaseCss());const download=await next,html=fs.readFileSync(await download.path(),'utf8');
   assert(html.includes('가상 생성 시작'));assert(!html.includes('가상 생성 중 수정'));assert(download.suggestedFilename().includes('가상 생성 시작'));
   await page.waitForFunction(()=>!document.getElementById('exportHTML').disabled);assert.equal(await page.locator('[data-path="project"]').inputValue(),'가상 생성 중 수정');
  }finally{await page.evaluate(()=>window.__qualityReleaseCss&&window.__qualityReleaseCss()).catch(()=>{});}
 }
 try{
  await scenario('직접 규격 변경은 단가 재확인 / 동일 규격·여유율은 보존',manualPrice);
  await scenario('원 단위 금액은 화면·CSV·HTML·인쇄에서 일치',async page=>{
   await page.locator('#measure .details summary').click();
   for(const [key,value] of [['size.doorWidth',0],['size.doorHeight',0],['size.width',55],['size.depth',91],['wall.price',28000],['wall.labor',38000],['floor.price',26000],['floor.labor',45000]])await fill(page,key,value);
   const row=page.locator('#report tr').filter({hasText:'바닥 타일 시공'});assert.match(await row.innerText(),/22,523원/);
   let next=page.waitForEvent('download');await page.locator('#exportCSV').click();const csv=fs.readFileSync(await(await next).path(),'utf8');assert.match(csv.split(/\r?\n/).find(x=>x.includes('바닥 타일 시공')),/"22523"/);
   next=page.waitForEvent('download');await page.locator('#exportHTML').click();const html=fs.readFileSync(await(await next).path(),'utf8');assert(html.includes('22,523원'));
   await page.emulateMedia({media:'print'});assert(await row.isVisible());assert.match(await row.innerText(),/22,523원/);assert.match(await page.locator('.report-contact').innerText(),/010-2397-8629/);
   await page.emulateMedia({media:'screen'});
  });
  await scenario('파일 생성 중 입력·중복 클릭 방지 / 시작 시점 내용 보존',exportBusy);
  await scenario('생성 중 잘못된 입력과 다운로드 실패 뒤 출력 상태 복원',async page=>{
   await cssGate(page);await page.locator('#exportHTML').click();await page.waitForFunction(()=>window.__qualityCssCount===1);await fill(page,'size.width','');
   const next=page.waitForEvent('download');await page.evaluate(()=>window.__qualityReleaseCss());await next;
   await page.waitForFunction(()=>document.getElementById('status').textContent.includes('고객용 파일을 저장'));
   assert(await page.locator('#exportHTML').isDisabled());assert(await page.locator('#printQuote').isDisabled());
   await fill(page,'size.width',180);await page.route('**/bathroom.css',r=>r.fulfill({status:503,body:'TEST_UNAVAILABLE'}));
   await page.locator('#exportHTML').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('파일을 만들지 못했습니다')&&!document.getElementById('exportHTML').disabled);
   await page.unroute('**/bathroom.css');const retry=page.waitForEvent('download');await page.locator('#exportHTML').click();await retry;
  });
  for(const [name,from,to,run,marker] of [
   ['직접 규격 단가 보호 제거','if(changed){hjBathClearProductSources(path);','if(false){hjBathClearProductSources(path);',manualPrice,'MANUAL_PRICE_RECHECK'],
   ['파일 생성 중 입력 잠금 제거',"b.disabled=htmlExporting&&b.id==='exportHTML'",'b.disabled=false',exportBusy,'EXPORT_BUSY_INPUT'],
   ['중복 파일 생성 진입 보호 제거','if(!result||htmlExporting||photoPending)return;','if(!result||photoPending)return;',exportBusy,'EXPORT_BUSY_DUPLICATE']
  ]){
   assert.equal(source.split(from).length,2,'unique mutation target '+name);let caught;
   try{await scenario(name,run,source.replace(from,to));}catch(e){caught=e;}
   assert(caught&&caught.code==='ERR_ASSERTION'&&caught.message.includes(marker),'mutation must fail at intended assertion: '+name+' '+(caught&&caught.stack));mutations++;console.log('DETECTED '+name);
  }
 }finally{await browser.close();}
 console.log('bathroom-quality e2e '+passed+'/'+passed+', mutations '+mutations+'/'+mutations);
})().catch(e=>{console.error(e);process.exitCode=1;});

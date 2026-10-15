/* v418: 과거 추정가는 사용자 입력·앱 단가를 덮지 않고 고객 출력에서도 추정으로 남는다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',KEY='hj_bathroom_consult_v1';
const TABLE={generatedAt:'2026-10-16T00:00:00.000Z',source:'과거 견적 6건(2025-01~2026-10)',vat:'exclusive',items:{
  '욕실 벽 타일(박스)':{price:28000,n:6,min:25000,max:32000},
  '욕실 벽 타일 시공(㎡)':{price:18000,n:4,min:16000,max:20000},
  '욕실 바닥 타일(박스)':{price:24000,n:4,min:22000,max:26000},
  '욕실 바닥 타일 시공(㎡)':{price:22000,n:4,min:20000,max:24000},
  '양변기':{price:250000,n:2,min:230000,max:270000,weak:true},
  '양변기 시공':{price:70000,n:3,min:60000,max:80000}
}};
const input=(p,key)=>p.locator('[data-path="'+key+'"]');
const badge=(p,key)=>p.locator('[data-price-source="estimate"][data-source-path="'+key+'"]');
async function fill(p,key,value){await input(p,key).evaluate(el=>{for(let n=el.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;});await input(p,key).fill(String(value));}
async function ready(p){await p.waitForFunction(()=>document.documentElement.dataset.bathPricesReady==='true');}
async function download(p,id){const wait=p.waitForEvent('download');await p.locator('#'+id).click();return fs.readFileSync(await(await wait).path(),'utf8');}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium'),args:['--no-sandbox']});
 let passed=0;
 async function scenario(name,opts,fn){
  const ctx=await browser.newContext({viewport:{width:390,height:780},serviceWorkers:'block',acceptDownloads:true});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
  let release;const barrier=opts.delay?new Promise(r=>release=r):Promise.resolve();
  await p.route('**/*',r=>r.request().url().startsWith(BASE+'/')?r.continue():r.abort());
  await p.route('**/bathroom-defaults.json*',async r=>{await barrier;await r.fulfill(opts.response||{status:200,contentType:'application/json',body:JSON.stringify(TABLE)});});
  if(process.env.HJ_V418_BASELINE){const cp=require('node:child_process');for(const file of ['bathroom-model.js','bathroom.js']){const old=cp.execFileSync('git',['show',process.env.HJ_V418_BASELINE+':'+file],{encoding:'utf8'});await p.route('**/'+file,r=>r.fulfill({contentType:'application/javascript',body:old+(file==='bathroom.js'?';document.documentElement.dataset.bathPricesReady="true";':'')}));}}
  if(opts.prefill)await p.addInitScript(value=>localStorage.setItem('hj_bath_prefill',JSON.stringify(value)),opts.prefill);
  await p.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__v418Copied=text;}}}));
  try{await p.goto(BASE+'/bathroom.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');if(!opts.delay)await ready(p);await fn(p,release);assert.deepEqual(errors,[]);console.log('PASS '+name);passed++;}
  finally{if(release)release();await ctx.close();}
 }
 try{
  await scenario('공급가 빈 칸 채움·추정 배지·모바일 합계·390px',{},async p=>{
   assert.equal(await input(p,'wall.price').inputValue(),'28000');assert.equal(await input(p,'floor.labor').inputValue(),'22000');
   assert.match(await badge(p,'wall.price').textContent(),/추정.*6건/);assert.equal(await badge(p,'scope.4.material').count(),1);
   assert.match(await p.locator('#priceEstimateNotice').textContent(),/단가는 과거 견적에서 추정한 값입니다\. 고객에게 확정 금액으로 안내하지 마세요\./);
   assert((await p.locator('.estimate-total').count())>0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(process.env.HJ_V418_SHOTS){fs.mkdirSync(process.env.HJ_V418_SHOTS,{recursive:true});await p.locator('#tileFields').evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:path.join(process.env.HJ_V418_SHOTS,'v418-prices-390.png')});}
  });
  await scenario('유효 앱 단가와 0원 우선·핸드오프 소비',{prefill:{at:new Date().toISOString(),project:'',customer:{name:'',addr:''},prices:{'욕실 벽 타일(박스)':31000,'욕실 바닥 타일(박스)':0,'양변기':false}}},async p=>{
   assert.equal(await input(p,'wall.price').inputValue(),'31000');assert.equal(await input(p,'floor.price').inputValue(),'0');assert.equal(await badge(p,'wall.price').count(),0);
   assert.equal(await input(p,'scope.4.material').inputValue(),'250000');assert.equal(await p.evaluate(()=>localStorage.getItem('hj_bath_prefill')),null);
  });
  for(const [name,at] of [['만료',new Date(Date.now()-11*60e3).toISOString()],['미래',new Date(Date.now()+60e3).toISOString()]])await scenario(name+' 핸드오프 무시',{prefill:{at,project:'',customer:{name:'',addr:''},prices:{'욕실 벽 타일(박스)':999}}},async p=>{
   assert.equal(await input(p,'wall.price').inputValue(),'28000');assert.equal(await p.evaluate(()=>localStorage.getItem('hj_bath_prefill')),null);
  });
  await scenario('늦은 추정 응답이 사용자 입력·지운 빈 칸을 덮지 않음',{delay:true},async(p,release)=>{
   await fill(p,'wall.price',12345);await fill(p,'floor.price',99);await fill(p,'floor.price','');release();await ready(p);
   assert.equal(await input(p,'wall.price').inputValue(),'12345');assert.equal(await input(p,'floor.price').inputValue(),'');assert.equal(await input(p,'wall.labor').inputValue(),'18000');
  });
  await scenario('규격을 바꾼 타일에는 기본 규격의 추정가를 적용하지 않음',{delay:true},async(p,release)=>{
   await fill(p,'wall.width',600);release();await ready(p);assert.equal(await input(p,'wall.price').inputValue(),'');assert.equal(await badge(p,'wall.price').count(),0);
  });
  await scenario('늦은 응답이 저장 초안 복원을 덮지 않음',{delay:true},async(p,release)=>{
   await p.evaluate(key=>{const d=HJBath.defaults();d.wall.price=91000;d.floor.price=0;localStorage.setItem(key,JSON.stringify(d));},KEY);
   p.once('dialog',d=>d.accept());await p.locator('#loadDraft').click();release();await ready(p);assert.equal(await input(p,'wall.price').inputValue(),'91000');assert.equal(await input(p,'floor.price').inputValue(),'0');assert.equal(await input(p,'wall.labor').inputValue(),'');
  });
  await scenario('수정한 칸의 추정 배지만 제거·VAT 공급가 일관성·초안 출처 보존',{},async p=>{
   await fill(p,'wall.price',29000);assert.equal(await badge(p,'wall.price').count(),0);assert.equal(await badge(p,'floor.price').count(),1);
   await input(p,'vat').selectOption('inclusive');assert.equal(await input(p,'floor.price').inputValue(),'26400');assert.equal(await input(p,'wall.price').inputValue(),'29000');
   await p.locator('#saveDraft').click();p.once('dialog',d=>d.accept());await p.locator('#loadDraft').click();assert.equal(await input(p,'floor.price').inputValue(),'26400');assert.equal(await badge(p,'floor.price').count(),1);assert.equal(await badge(p,'wall.price').count(),0);
   await input(p,'vat').selectOption('exclusive');assert.equal(await input(p,'floor.price').inputValue(),'24000');
  });
  await scenario('고객 HTML·CSV·복사·인쇄에서 추정 표시 유지',{},async p=>{
   const html=await download(p,'exportHTML'),csv=await download(p,'exportCSV');assert.match(html,/추정/);assert.match(html,/과거 6건/);assert.match(csv,/추정/);
   await p.locator('#copyQuote').click();assert.match(await p.evaluate(()=>window.__v418Copied),/추정/);
   await p.emulateMedia({media:'print'});assert(await p.locator('#report').isVisible());assert.match(await p.locator('#report').innerText(),/추정/);
   if(process.env.HJ_V418_SHOTS){await p.setViewportSize({width:794,height:1123});await p.screenshot({path:path.join(process.env.HJ_V418_SHOTS,'v418-print-a4.png'),fullPage:true});}
  });
  for(const [name,response] of [['없는 파일',{status:404,body:''}],['깨진 JSON',{status:200,contentType:'application/json',body:'{broken'}],['부적합 자료',{status:200,contentType:'application/json',body:JSON.stringify({vat:'inclusive',items:TABLE.items})}]])await scenario(name+' 조용히 무시',{response},async p=>{
   assert.equal(await input(p,'wall.price').inputValue(),'');assert.equal(await badge(p,'wall.price').count(),0);
  });
  console.log('bathprices-v418 e2e '+passed+'/'+passed);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

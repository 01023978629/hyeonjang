/* v418: 이 기존 검사에서는 과거 단가 자동채움을 끈다. 자동채움은 bathprices-v418에서 별도로 검증한다. */
/* 리뷰 F1~F3: 실제 화면/고객 파일/인쇄, 이미지 예산, 연락 버튼과 보호 제거 변이. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8299';
async function download(page,id){const waiting=page.waitForEvent('download');await page.locator('#'+id).click();return fs.readFileSync(await(await waiting).path(),'utf8');}
async function checkF1(page){
  assert((await page.locator('#scope-demolition .option-select').textContent()).includes('1식(일괄) 가격'),'F1 lump-sum label');
  assert((await page.locator('#scope-toilet .option-select').textContent()).includes('개당 가격'));
  await page.locator('#scope-demolition summary').click();
  for(const [key,value] of [['qty','2'],['material','0'],['labor','100000']])await page.locator('[data-path="scope.0.'+key+'"]').fill(value);
  await page.locator('[data-path="scope.0.enabled"]').check();
  const rows=page.locator('#report .price-table tbody tr').filter({hasText:'기존 욕실 철거'});
  assert.equal(await rows.count(),2);for(const row of await rows.all()){assert((await row.textContent()).includes('1식(일괄) 가격'));assert((await row.textContent()).includes('2식'));}
  assert((await rows.last().textContent()).includes('200,000원'));assert(!(await page.locator('body').textContent()).includes('식당'));
  for(const id of ['exportCSV','exportHTML']){const text=await download(page,id);assert(text.includes('기존 욕실 철거'));assert(text.includes('1식(일괄) 가격'));assert(!text.includes('식당'));}
  await page.emulateMedia({media:'print'});assert(await page.locator('#report').isVisible());assert((await rows.first().textContent()).includes('1식(일괄) 가격'));await page.emulateMedia({media:'screen'});
}
async function checkF2(page){
  let bytes=0;for(const name of ['warm','white','gray']){const size=fs.statSync(path.join(root,'bathroom-'+name+'.webp')).size;assert(size<=250000,'F2 image budget');bytes+=size;const response=await page.request.get(base+'/bathroom-'+name+'.webp');assert(response.ok());assert.equal(response.headers()['content-type'],'image/webp');}assert(bytes<=800000);
  assert.notEqual(await page.locator('.hero img').getAttribute('loading'),'lazy');
  for(const img of await page.locator('img').all()){if(!await img.evaluate(el=>!!el.closest('.hero')))assert.equal(await img.getAttribute('loading'),'lazy','F2 lazy');}
  for(const img of await page.locator('.hero img,.style-card img,.report-visual img').all()){
    assert((await img.getAttribute('src')).endsWith('.webp'));await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle());
    assert.deepEqual(await img.evaluate(el=>[el.naturalWidth,el.naturalHeight]),[1200,800]);
  }
  const html=await download(page,'exportHTML');assert(html.includes('data:image/webp;base64,'));assert(!/bathroom-(?:warm|white|gray)\.png/.test(html));
}
async function checkF3(page){
  const tel=page.locator('#report a[href="tel:01023978629"]'),sms=page.locator('#report a[href="sms:01023978629"]');
  assert.equal(await tel.count(),1,'F3 tel link');assert.equal(await sms.count(),1,'F3 sms link');
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await tel.scrollIntoViewIfNeeded();for(const link of [tel,sms]){assert(await link.isVisible());const box=await link.boundingBox();assert(box.width>=44&&box.height>=44,'F3 touch target');}assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'F3 overflow');}
  assert((await page.locator('.report-contact').textContent()).includes('만물인테리어 · 010-2397-8629'));
  const html=await download(page,'exportHTML');assert(html.includes('만물인테리어 · 010-2397-8629'));assert(html.includes('tel:01023978629'));assert(html.includes('sms:01023978629'));
  const output=await page.context().newPage();try{await output.setContent(html);await output.locator('.report-contact').scrollIntoViewIfNeeded();assert(await output.locator('.report-contact strong').isVisible());await output.emulateMedia({media:'print'});assert(await output.locator('.report-contact strong').isVisible());assert((await output.locator('.report-contact strong').textContent()).includes('010-2397-8629'));}finally{await output.close();}
  await page.emulateMedia({media:'print'});assert(await page.locator('.report-contact strong').isVisible());assert(await page.locator('.contact-actions').isHidden());await page.emulateMedia({media:'screen'});
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});
  async function scenario(name,check,mutation){
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
    try{
      await ctx.route('https://**/*',r=>r.abort());
      if(mutation)await ctx.route('**/'+mutation.file,r=>{const source=fs.readFileSync(path.join(root,mutation.file),'utf8');assert(source.includes(mutation.from));return r.fulfill({contentType:'application/javascript',body:source.replaceAll(mutation.from,mutation.to)});});
      const page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
      await page.route("**/bathroom-defaults.json*",r=>r.fulfill({status:404,body:""}));await page.goto(base+'/bathroom.html');await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');
      if(mutation){let detected=false;try{await check(page);}catch(e){assert.equal(e.code,'ERR_ASSERTION');assert(e.message.includes(mutation.marker),e.message);detected=true;}assert(detected,'Mutation survived: '+name);console.log('DETECTED '+name);}
      else{await check(page);console.log('PASS '+name);}
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  }
  try{
    await scenario('F1 화면·HTML·CSV·인쇄 일괄 표기',checkF1);
    await scenario('F2 WebP 용량·실제 크기·지연 로딩',checkF2);
    await scenario('F3 전화·문자 44px와 고객 파일·인쇄 연락처',checkF3);
    await scenario('F1 단위 오표기 재발',checkF1,{file:'bathroom-model.js',from:"unit==='식'?'1식(일괄) 가격':unit+'당 가격'",to:"unit+'당 가격'",marker:'F1 lump-sum label'});
    await scenario('F2 지연 로딩 제거',checkF2,{file:'bathroom.js',from:'loading="lazy"',to:'loading="eager"',marker:'F2 lazy'});
    await scenario('F3 전화 링크 오타',checkF3,{file:'bathroom.js',from:'tel:01023978629',to:'tel:000',marker:'F3 tel link'});
    console.log('bathroom review 3/3, protection mutations 3/3');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

/* 고객 전달 경로: 선택 수량/제품의 여러 줄과 부자재 제외 상태를 복사·파일에 보존한다. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const BASE='http://127.0.0.1:8299',KEY='hj_bathroom_consult_v1';
const MODELS={toilet:'TEST_TOILET_A\n설치 포함 / 기존 위치 유지',basin:'TEST_BASIN_B\n하부장 포함\n수전 별도 확인'};
async function download(page,id){const next=page.waitForEvent('download');await page.locator('#'+id).click();return fs.readFileSync(await(await next).path(),'utf8');}
function reportExcluded(text){const match=text.match(/미선택 품목\s*\n([\s\S]*?)\n\s*\n추가 확인/);assert(match,'REPORT_EXCLUDED_SECTION');return match[1].trim();}
function copiedExcluded(text){const line=text.split('\n').find(x=>x.startsWith('미포함:'));assert(line!==undefined,'COPY_EXCLUDED_SECTION');return line.slice('미포함:'.length).trim();}
function csvExcluded(text){const match=text.match(/(?:^|\r\n)"미포함 품목","([^"]*)"/);assert(match,'CSV_EXCLUDED_SECTION');return match[1];}
async function copyText(page){await page.locator('#copyQuote').click();await page.waitForFunction(()=>typeof window.__bathOutputCopied==='string');return page.evaluate(()=>window.__bathOutputCopied);}
async function seed(page,all){
  await page.evaluate(({models,all,key})=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__bathOutputCopied=text;}}});
    const d=HJBath.defaults();d.project='TEST_OUTPUT_PROJECT';d.customer='TEST_OUTPUT_CUSTOMER';d.date='2026-10-15';
    d.wall.price=100;d.wall.labor=100;d.floor.price=100;d.floor.labor=100;
    for(const s of d.scope){s.enabled=all;s.material=10;s.labor=20;}
    for(const c of d.consumables){c.enabled=all;c.price=10;}
    Object.assign(d.scope.find(s=>s.id==='toilet'),{enabled:true,qty:2,model:models.toilet});
    Object.assign(d.scope.find(s=>s.id==='basin'),{enabled:true,qty:3,model:models.basin});
    localStorage.setItem(key,JSON.stringify(d));window.__bathOutputSaved=localStorage.getItem(key);
  },{models:MODELS,all,key:KEY});
  page.once('dialog',d=>d.accept());await page.locator('#loadDraft').click();
  await page.waitForFunction(()=>document.querySelector('[data-path="project"]').value==='TEST_OUTPUT_PROJECT');
  assert.equal(await page.locator('[data-path="project"]').inputValue(),'TEST_OUTPUT_PROJECT');
}
async function outputs(page){
  const report=reportExcluded(await page.locator('.report-note').textContent());
  const copied=copiedExcluded(await copyText(page));
  const csv=csvExcluded(await download(page,'exportCSV'));
  const html=await download(page,'exportHTML'),file=await page.context().newPage();
  try{await file.setContent(html);return {report,copied,csv,html:reportExcluded(await file.locator('.report-note').textContent())};}
  finally{await file.close();}
}
async function checkDetails(page){
  const text=await copyText(page);
  assert(text.includes('양변기 × 2개 · '+MODELS.toilet),'COPY_SELECTED_TOILET_DETAILS');
  assert(text.includes('세면대·하부장 × 3개 · '+MODELS.basin),'COPY_SELECTED_BASIN_DETAILS');
}
async function checkExcluded(page){
  const values=await outputs(page);
  for(const [kind,text] of Object.entries(values)){
    for(const name of ['타일 접착제','줄눈재','기존 욕실 철거'])assert(text.includes(name),'EXCLUDED_'+kind+'_'+name);
    assert(!text.includes('양변기')&&!text.includes('세면대·하부장'),'선택 기구는 제외 목록에 없어야 한다: '+kind);
  }
}
async function checkNone(page){
  const values=await outputs(page);for(const [kind,text] of Object.entries(values))assert.equal(text,'없음','EXCLUDED_NONE_'+kind);
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform==='win32'?undefined:'/opt/pw-browsers/chromium')});let passed=0,mutations=0;
  async function scenario(name,all,check,mutation){
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
    page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));
    try{
      await ctx.route('https://**/*',r=>r.abort());
      if(mutation){
        const source=fs.readFileSync(path.join(__dirname,'..',mutation.file),'utf8');
        assert.equal(source.split(mutation.from).length,2,'unique mutation target: '+name);
        await ctx.route('**/'+mutation.file,r=>r.fulfill({status:200,contentType:'application/javascript',body:source.replace(mutation.from,mutation.to)}));
      }
      await page.goto(BASE+'/bathroom.html');
      await page.waitForFunction(()=>document.documentElement.dataset.bathReady==='true');await seed(page,all);
      if(mutation){
        let caught;try{await check(page);}catch(e){caught=e;}
        assert(caught&&caught.code==='ERR_ASSERTION'&&caught.message.includes(mutation.marker),'mutation must fail at intended assertion: '+name+' '+(caught&&caught.stack));
      }else await check(page);
      assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.evaluate(key=>localStorage.getItem(key)===window.__bathOutputSaved,KEY),'출력은 저장 초안을 바꾸지 않는다');
      if(mutation){mutations++;console.log('DETECTED '+name);}else{passed++;console.log('PASS '+name);}
    }finally{await ctx.close();}
  }
  try{
    await scenario('선택 수량·제품명·포함 범위 여러 줄을 복사문에 보존',false,checkDetails);
    await scenario('클립보드 거절 시 수동 복사창에도 같은 선택 내용을 보존',false,async page=>{
      const expected=await copyText(page);
      assert(expected.includes('양변기 × 2개 · '+MODELS.toilet),'COPY_FALLBACK_DETAILS');
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('TEST_CLIPBOARD_DENIED','NotAllowedError');}}}));
      await page.locator('#copyQuote').click();await page.locator('#copyDialog').waitFor({state:'visible'});
      assert.equal(await page.locator('#copyText').inputValue(),expected,'COPY_FALLBACK_SAME_TEXT');
      await page.locator('#copyDialog button').click();assert(await page.locator('#copyDialog').isHidden());
    });
    await scenario('미선택 부자재를 보고서·CSV·고객 HTML·복사에 일관 표시',false,checkExcluded);
    await scenario('공사·부자재를 모두 선택하면 모든 출력에 미포함 없음',true,checkNone);
    for(const [name,all,check,mutation] of [
      ['복사문 선택 상세 제거',false,checkDetails,{file:'bathroom.js',from:"map(s=>s.name+' × '+s.qty+s.unit+(s.model?' · '+s.model:'')).join('\\n')",to:"map(s=>s.name).join(', ')",marker:'COPY_SELECTED_TOILET_DETAILS'}],
      ['미선택 부자재 제외 목록 제거',false,checkExcluded,{file:'bathroom-model.js',from:'.concat(d.consumables.filter(c=>!c.enabled).map(c=>c.name))',to:'',marker:'EXCLUDED_report_타일 접착제'}],
      ['CSV 미포함 없음 표기 제거',true,checkNone,{file:'bathroom-model.js',from:"['미포함 품목',r.excluded.join(', ')||'없음']",to:"['미포함 품목',r.excluded.join(', ')]",marker:'EXCLUDED_NONE_csv'}],
      ['복사문 미포함 없음 표기 제거',true,checkNone,{file:'bathroom.js',from:"'미포함: '+(r.excluded.join(', ')||'없음')",to:"'미포함: '+r.excluded.join(', ')",marker:'EXCLUDED_NONE_copied'}]
    ])await scenario(name,all,check,mutation);
  }finally{await browser.close();}
  console.log('bathroom-output e2e '+passed+'/'+passed+', mutations '+mutations+'/'+mutations);
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  try{
    const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('https://**/*',r=>r.abort());
    await page.addInitScript(()=>localStorage.setItem('hj_onboard_done','1'));
    await page.goto('http://127.0.0.1:8299/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
    await page.evaluate(async()=>{
      await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);
      if(window.__hjSaveQueue)await window.__hjSaveQueue;
      state.projects=[];
      state.files=Array.from({length:25},(_,i)=>({id:'test-photo-'+i,name:'TEST_'+i+'.jpg',ext:'jpg',kind:'photo',project:null,
        when:new Date('2026-10-12T04:00:00Z'),lat:i<4?36.1:null,lng:i<4?127.1:null,
        address:'TEST_STORED_ADDRESS',_worklabel:i<4?'철근 작업':'시험 작업',size:100+i,
        thumb:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}));
      // The existing renderer sets transient duplicate flags. All other record fields must stay intact.
      window.__photoLocationStable=files=>JSON.stringify(files,(key,value)=>key==='_dup'||key==='_dupOf'?undefined:value);
      window.__photoLocationBefore=window.__photoLocationStable(state.files);
      state.tab='photos';state.activeProject=null;state.search='';__photoCache.key=null;render();
    });
    const rows=await page.locator('.cluster').allTextContents();assert.equal(rows.length,2);
    assert(rows.some(x=>x.includes('현장 방문')&&x.includes('현장 미지정 4장')&&x.includes('GPS 36.10000, 127.10000')));
    const unknown=page.locator('.cluster').filter({hasText:'현장 미지정 21장'});
    // 앞 묶음이 긴 화면을 재현한다. content-visibility:auto 영역은 실제로 스크롤한 뒤 표시 문구를 읽는다.
    await page.locator('.cluster').first().evaluate(el=>{el.style.minHeight='12000px';});
    await page.waitForFunction(()=>{const el=[...document.querySelectorAll('.cluster')].find(x=>x.textContent.includes('현장 미지정 21장'));return el&&el.innerText==='';});
    await unknown.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const el=[...document.querySelectorAll('.cluster')].find(x=>x.textContent.includes('현장 미지정 21장'));return el&&el.innerText.includes('사진 묶음');});
    const unknownText=await unknown.innerText();
    assert.match(unknownText,/사진 묶음/);assert.match(unknownText,/위치 미확인 · 시간 기준 묶음/);
    assert(!unknownText.includes('TEST_STORED_ADDRESS'));assert(!unknownText.includes('GPS '));
    assert.equal(await unknown.locator('[data-geo],[data-bname],[data-nmap],.suggest-btn').count(),0);
    // Open the real photo UI and check the individual stored address is explicitly unverified.
    await unknown.locator('img').first().click();
    await page.locator('#lbClose').waitFor({state:'visible'});
    assert.match(await page.locator('.lb-meta').innerText(),/위치 미확인 · 저장 주소: TEST_STORED_ADDRESS/);
    await page.locator('#lbClose').click();
    await page.locator('#lightbox').waitFor({state:'detached'});
    assert(await page.evaluate(()=>window.__photoLocationStable(state.files)===window.__photoLocationBefore),'display must not rewrite stored records');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>render());
    assert.equal(await page.locator('.cluster').count(),2);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(overflow,false,'mobile horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS photo-location UI: 4/21 separation, unknown labels, safe detail, original data preserved, mobile width, pageerrors 0');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

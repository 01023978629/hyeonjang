/* Mobile screen simulation. Synthetic records only; no account, upload or real deletion.
   HJ_MOBILE_SCREEN_MUTATION=work-grid|work-scroll|toast|delete-confirm restores each regression.
   HJ_MOBILE_SCREEN_SHOTS=<folder> optionally saves browser screenshots, not device captures. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_MOBILE_SCREEN_MUTATION||'';
assert(['','work-grid','work-scroll','toast','delete-confirm'].includes(mutation));
const shots=process.env.HJ_MOBILE_SCREEN_SHOTS;
const cases=[
  {name:'compact',width:360,height:640},
  {name:'large',width:412,height:915},
  {name:'landscape',width:740,height:360},
  {name:'large-text',width:360,height:640,big:true},
  {name:'short-viewport',width:360,height:360},
];
let passed=0;
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function screenshot(page,spec,name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,spec.name+'-'+name+'.png')});}}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  try{
    for(const spec of cases){
      const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
      try{
        await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
        const page=await context.newPage();page.setDefaultTimeout(8000);
        const errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('pref_mobile','1');});
        await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
        await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);await __appStateWriteQueue;});
        await page.evaluate(({big,mutation})=>{
          state.projects=[{name:'모의 화면 점검 아파트 긴 현장명 ABCDEFGHIJKLMNOPQRSTUVWXYZ',stage:2,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{}}];
          state.activeProject=state.projects[0].name;state.files=[];state.schedule=[];state.notes=[];state.dirHandle=null;state._demo=false;
          state.workLogs=[{id:'mock-work',project:state.activeProject,date:localDate(),in:'09:00',out:'18:00'},
            {id:'mock-other',project:'다른 모의 현장',date:localDate(),in:'10:00',out:'12:00'}];
          __mobileMode=true;applyMobileMode();if(big)document.body.classList.add('a11y-big2');state.tab='photos';render();syncMobileNav();
          aiOpsEnsureState().enabled=false;
          if(mutation==='delete-confirm'){
            const nativeView=workView;
            workView=function(...args){const result=nativeView(...args);document.querySelectorAll('.wkDel').forEach(b=>b.onclick=()=>{
              state.workLogs=workData().filter(w=>w.id!==b.dataset.id);markDirty();nativeView(...args);
            });return result;};
          }
          if(mutation==='work-grid'||mutation==='work-scroll'||mutation==='toast'){
            const style=document.createElement('style');
            style.textContent=mutation==='toast'?'body.mobile-mode #toast{bottom:20px!important}':mutation==='work-scroll'?
              'body.mobile-mode .modal.worklog-modal{display:block!important;overflow:auto!important}body.mobile-mode .worklog-modal .mbody{overflow:visible!important}body.mobile-mode .worklog-modal .mfoot{position:sticky!important}':
              'body.mobile-mode .worklog-row{grid-template-columns:58px minmax(0,1fr) 96px 62px!important}body.mobile-mode .worklog-row>*{grid-column:auto!important;grid-row:auto!important}body.mobile-mode .worklog-actions{flex-wrap:nowrap!important;justify-content:flex-start!important}';
            document.head.append(style);
          }
        },{big:spec.big,mutation});
        // Real tap navigation, modal scrolling, and close targets across five screen sizes.
        for(const tab of ['dashboard','photos','schedule']){
          await page.locator('[data-mnav="'+tab+'"]').click();await settle(page);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),spec.name+' '+tab+' page overflow');
        }
        // Estimate creation remains reachable from More after its bottom slot becomes Today.
        await page.locator('[data-mnav="__more"]').click();
        await page.locator('#moreNav [data-more="quotemaker"]').click();await settle(page);
        await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet));
        assert.equal(await page.evaluate(()=>state.tab),'quotemaker','More opens estimate creation');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),spec.name+' quotemaker page overflow');
        await screenshot(page,spec,'estimate');
        await page.locator('[data-mnav="__more"]').click();await page.locator('#moreSearch').fill('사진');
        await page.locator('#moreSearchResult [data-moreaction]').first().waitFor();await settle(page);await screenshot(page,spec,'more-search');
        assert(await page.locator('#moreSheetClose').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.right<=innerWidth&&r.height>=44&&r.width>=44;}),'more close is reachable');
        await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet));
        await page.evaluate(()=>{workView();document.getElementById('toast').classList.remove('show');});await settle(page);
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
        const del=page.locator('.wkDel[data-id="mock-work"]');
        // scrollIntoView can programmatically move even an overflow:hidden ancestor. A user
        // cannot swipe that clipped row, so reject horizontal overflow before any helper scroll.
        assert(await page.locator('.worklog-row').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),spec.name+' work row horizontal overflow');
        await del.scrollIntoViewIfNeeded();await screenshot(page,spec,'work-time');
        const buttons=await page.locator('.wkEdit[data-id="mock-work"],.wkDel[data-id="mock-work"]').evaluateAll(es=>es.map(e=>{
          const r=e.getBoundingClientRect();const modal=e.closest('.modal').getBoundingClientRect();
          const x=r.right-3,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
          return{width:r.width,height:r.height,inside:r.left>=modal.left&&r.right<=modal.right&&r.top>=modal.top&&r.bottom<=modal.bottom,hit:!!hit&&(hit===e||e.contains(hit))};
        }));
        assert.equal(buttons.length,2);assert(buttons.every(b=>b.width>=44&&b.height>=44&&b.inside&&b.hit),spec.name+' work controls clipped: '+JSON.stringify(buttons));
        // A declined confirmation must preserve both records, and confirmation deletes only the chosen record.
        let dialogs=0;page.once('dialog',async d=>{dialogs++;assert.equal(d.type(),'confirm');await d.dismiss();});
        await del.click();assert.equal(dialogs,1,'work deletion requires confirmation');
        assert.deepEqual(await page.evaluate(()=>state.workLogs.map(w=>w.id)),['mock-work','mock-other'],'cancel preserves records');
        page.once('dialog',async d=>{dialogs++;await d.accept();});await del.click();
        assert.equal(dialogs,2);assert.deepEqual(await page.evaluate(()=>state.workLogs.map(w=>w.id)),['mock-other'],'only selected synthetic record removed');
        await page.evaluate(()=>{closeModal();toast('모의 저장 완료 — 입력한 작업 내용을 확인했습니다');});
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='1');
        const toast=await page.evaluate(()=>{const t=document.getElementById('toast').getBoundingClientRect(),n=document.querySelector('.mobile-nav').getBoundingClientRect();return{bottom:t.bottom,navTop:n.top,left:t.left,right:t.right,width:innerWidth};});
        assert(toast.bottom<=toast.navTop-8&&toast.left>=0&&toast.right<=toast.width,spec.name+' toast covers navigation: '+JSON.stringify(toast));
        await screenshot(page,spec,'toast');
        await page.evaluate(()=>{document.getElementById('toast').classList.remove('show');openPhotoIntake([new File(['synthetic input'],'mock.png',{type:'image/png'})],{project:state.activeProject,source:'gallery'});});
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
        await page.locator('#photoIntakeWork').fill('모의 사진 작업명 — 취소하여 저장하지 않습니다');
        await page.locator('#photoIntakeWork').scrollIntoViewIfNeeded();await settle(page);
        assert(await page.locator('#photoIntakeWork').evaluate(e=>{
          const r=e.getBoundingClientRect(),body=e.closest('.mbody').getBoundingClientRect();
          return r.height>=44&&r.left>=body.left&&r.right<=body.right&&r.top>=body.top&&r.bottom<=body.bottom&&document.elementFromPoint(r.left+8,r.top+r.height/2)===e;
        }),spec.name+' photo work field must remain reachable above footer');
        assert(await page.locator('#modalRoot .modal-close').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),spec.name+' photo close stays visible');
        await screenshot(page,spec,'photo-field');
        await page.locator('#photoIntakeCancel').scrollIntoViewIfNeeded();await screenshot(page,spec,'photo-confirm');
        assert.equal(await page.evaluate(()=>state.files.length),0,'before approval no photo mutation');
        await page.locator('#photoIntakeCancel').click();assert.equal(await page.evaluate(()=>state.files.length),0,'cancel leaves photos intact');
        assert.deepEqual(errors,[]);passed++;console.log('PASS mobile screen '+spec.name+' '+spec.width+'x'+spec.height);
      }finally{await context.close();}
    }
  }finally{await browser.close();}
  console.log('PASS mobile screen scenarios '+passed+'/'+cases.length+'; synthetic data only');
})().catch(e=>{console.error(e);process.exitCode=1;});

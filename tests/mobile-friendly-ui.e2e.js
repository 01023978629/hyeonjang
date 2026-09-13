/* Friendly mobile controls: isolated synthetic records, no account or upload.
   HJ_FRIENDLY_UI_MUTATION=name-clip|current-hidden|toolbar-state must fail.
   HJ_FRIENDLY_UI_SHOTS=<folder> writes optional simulated viewport screenshots. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_FRIENDLY_UI_MUTATION||'';
assert(['','name-clip','current-hidden','toolbar-state'].includes(mutation));
const shots=process.env.HJ_FRIENDLY_UI_SHOTS;
const prefix='모의 아파트 공동주택 긴 이름 확인을 위한 가상 현장 연결된ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const A=prefix+' 동쪽',B=prefix+' 서쪽',CURRENT='현재 모의 보관 아파트';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const cases=[
  {name:'compact',width:360,height:640,mobile:true},
  {name:'large',width:412,height:915,mobile:true},
  {name:'landscape',width:740,height:360,mobile:true},
  {name:'large-text',width:360,height:640,mobile:true,big:true},
  {name:'desktop',width:1280,height:900,mobile:false}
];
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function shot(page,spec,name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,spec.name+'-'+name+'.png')});}}
async function label(locator){return(await locator.innerText()).trim().replace(/^[✓＋]\s*/,'').replace(/\s*[▴▾]$/,'');}
async function businessSnapshot(page){return page.evaluate(()=>({
  saved:JSON.stringify({...serializeData(),savedAt:'synthetic-fixed-time'}),
  projects:JSON.stringify(state.projects),order:state.projects.map(p=>p.name)
}));}
async function rows(page){return page.locator('#psList .ps-row[data-psel]').evaluateAll(es=>es.map(e=>e.dataset.psel).filter(Boolean));}
async function sheetClosed(page){await page.waitForFunction(()=>!document.getElementById('projSheet')&&!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet));}
async function reachable(locator,label){assert(await locator.evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&!!h&&(h===e||e.contains(h));}),label);}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||undefined});
  let passed=0;
  try{
    for(const spec of cases){
      const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:spec.mobile,hasTouch:spec.mobile,deviceScaleFactor:1,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
      try{
        await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
        const page=await context.newPage();page.setDefaultTimeout(8000);
        const errors=[],effects=[];page.on('pageerror',e=>errors.push(String(e)));page.on('download',()=>effects.push('download'));page.on('popup',()=>effects.push('popup'));
        await page.addInitScript(mobile=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));localStorage.setItem('pref_mobile',mobile?'1':'0');},spec.mobile);
        await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
        await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
        await page.evaluate(({a,b,current,png,spec,mutation})=>{
          const p=(name,archived=false)=>({name,archived,stage:2,received:12345,phases:['배관'],cost:{material:111,labor:222,outsource:333},customer:{name:'가상 고객',phone:'FAKE-NOT-A-CONTACT'}});
          state.projects=[p(b),...Array.from({length:40},(_,i)=>p('모의 현장 '+String(40-i).padStart(2,'0'))),p(current,true),p(a),p('모의 보관 나',true),p('모의 보관 가',true)];
          const photo=(id,project)=>({id,name:id+'.png',project,kind:'photo',ext:'png',size:100+id.length,when:new Date('2026-09-13T01:00:00Z'),_phase:'배관',_worklabel:'가상 표시 점검',_virtual:true,thumb:'data:image/png;base64,'+png});
          state.files=[photo('mock-a-one',a),photo('mock-a-two',a),photo('mock-current',current),{id:'mock-doc',name:'모의 문서.pdf',project:current,kind:'other',ext:'pdf',size:1200}];
          state.quotes=[{id:'mock-quote',project:a,name:'모의 견적',items:[],amount:777}];
          state.payLog=[{id:'mock-payment',project:a,amount:555,date:'2026-09-13'}];state.expenses=[];state.aptOrders=[];state.schedule=[];state.notes=[];
          state.activeProject=current;state.tab='photos';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;state.editingQuote=null;
          __sel.clear();__selMode=false;__photoMoreOpen=false;__showArchived=false;__mobileMode=spec.mobile;applyMobileMode();if(spec.big)document.body.classList.add('a11y-big2');
          __gdToken=null;relayReady=()=>false;aiOpsEnsureState().enabled=false;
          window.__friendlyUnexpected=[];const reject=name=>()=>{__friendlyUnexpected.push(name);throw new Error('unexpected external '+name);};
          window.open=reject('window.open');window.showOpenFilePicker=reject('file picker');window.showDirectoryPicker=reject('directory picker');relayCall=reject('relay');geminiAsk=reject('AI');
          render();syncMobileNav();clearTimeout(__idbSaveTimer);document.getElementById('toast').classList.remove('show');
          if(mutation==='name-clip'){
            const style=document.createElement('style');style.textContent='#psList .ps-name{white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}';document.head.append(style);
          }
          if(mutation==='current-hidden'){
            const original=openProjectSheet;openProjectSheet=function(...args){const r=original(...args);document.querySelectorAll('#psList .ps-row[data-psel]').forEach(e=>{if(e.dataset.psel===state.activeProject)e.remove();});return r;};
          }
          if(mutation==='toolbar-state'){
            const original=render;render=function(...args){const r=original(...args),b=document.getElementById('btnSelMode');if(b)b.setAttribute('aria-pressed','false');return r;};
          }
        },{a:A,b:B,current:CURRENT,png:PNG,spec,mutation});
        await settle(page);await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
        const baseline=await businessSnapshot(page);
        await page.evaluate(()=>openProjectSheet());await page.locator('#psSearch').waitFor();await settle(page);
        const rowNames=await rows(page);
        assert.equal(rowNames[0],CURRENT,'current archived project must be first even while archives are collapsed');
        assert.equal(rowNames.filter(x=>x===CURRENT).length,1,'current appears exactly once');
        assert.deepEqual(rowNames.slice(1),baseline.order.filter(x=>![CURRENT,'모의 보관 나','모의 보관 가'].includes(x)).sort((a,b)=>a.localeCompare(b,'ko')),'active display order sorted without mutating source');
        const currentRow=page.locator('#psList .ps-row[aria-pressed="true"]');
        assert.equal(await currentRow.count(),1,'one current project row');assert.equal(await currentRow.getAttribute('data-psel'),CURRENT);
        assert.equal(await label(currentRow.locator('.ps-current-tag')),'현재 현장');
        assert.match(await currentRow.locator('.ps-meta').innerText(),/보관/);assert.match(await currentRow.locator('.ps-meta').innerText(),/자료\s*2개/);
        if(!spec.mobile){
          await currentRow.hover();
          const contrast=await currentRow.evaluate(e=>{
            const lum=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(x=>{const n=Number(x)/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;});return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
            const foreground=lum(getComputedStyle(e.querySelector('.ps-name')).color),background=lum(getComputedStyle(e).backgroundColor);
            return(Math.max(foreground,background)+0.05)/(Math.min(foreground,background)+0.05);
          });assert(contrast>=4.5,'hovered current project name keeps readable contrast');
        }
        await shot(page,spec,'project-current');
        // Only the list scrolls. Search/close stay visible even at the last of 40+ rows.
        const headerBefore=await page.locator('#psSearch').boundingBox();
        assert(await page.locator('#projSheet').evaluate(e=>getComputedStyle(e).display==='flex'&&getComputedStyle(e).flexDirection==='column'),'project sheet is a constrained flex column');
        assert(await page.locator('#psList').evaluate(e=>e.scrollHeight>e.clientHeight+1&&['auto','scroll'].includes(getComputedStyle(e).overflowY)),'project list is scrollable');
        await page.locator('#psList').evaluate(e=>{e.scrollTop=e.scrollHeight;});await settle(page);
        const headerAfter=await page.locator('#psSearch').boundingBox();assert(Math.abs(headerBefore.y-headerAfter.y)<1,'list scrolling does not move the search header');
        await reachable(page.locator('#psSearch'),spec.name+' project search remains reachable');await reachable(page.locator('#projSheetClose'),spec.name+' close remains reachable');
        await page.locator('#psArcTg').click();
        const expanded=await rows(page);assert.deepEqual(expanded.slice(-2),['모의 보관 가','모의 보관 나'],'other archived rows sorted');assert.equal(expanded.filter(x=>x===CURRENT).length,1);
        await page.locator('#psSearch').fill(A);await settle(page);
        assert.deepEqual(await rows(page),[A],'search does not inject the nonmatching current project');
        const name=page.locator('#psList .ps-name');assert.equal(await name.innerText(),A,'full long project name remains in text');
        assert(await name.evaluate(e=>{const s=getComputedStyle(e);return s.whiteSpace!=='nowrap'&&e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1;}),'long project names wrap without clipping');
        assert.match(await page.locator('#psList .ps-meta').innerText(),/시공\s*·\s*자료\s*2개/,'stage and file count have words');
        await shot(page,spec,'project-long-name');
        await page.locator('#psSearch').fill(B);assert.deepEqual(await rows(page),[B],'similar names differing only at the end can be distinguished');
        await page.locator('#psSearch').fill('없는 모의 검색어');await page.locator('#psSearchEmpty').waitFor();assert.deepEqual(await rows(page),[]);
        await page.locator('#psSearchClear').click();assert.equal((await rows(page))[0],CURRENT,'clearing search restores the current project');
        await page.locator('#projSheetClose').click();await sheetClosed(page);
        assert.equal(await page.evaluate(()=>state.activeProject),CURRENT,'closing project chooser cancels selection');
        assert.deepEqual(await businessSnapshot(page),baseline,'project browsing changes no saved business data or order');
        await page.evaluate(()=>openProjectSheet());await page.locator('#psSearch').fill(B);
        await page.locator('#psList .ps-row[data-psel]').filter({hasText:B}).click();await sheetClosed(page);
        assert.equal(await page.evaluate(()=>state.activeProject),B,'tapping exact matching project selects it');
        assert((await page.locator('#projChip').getAttribute('aria-label')).includes(B),'project chip accessible name keeps complete project name');
        assert((await page.locator('#projChip').getAttribute('title')).includes(B),'project chip title keeps complete project name');
        assert.deepEqual(await businessSnapshot(page),baseline,'project selection changes only view state');
        await page.evaluate(()=>{state.tab='photos';render();syncMobileNav();});await settle(page);
        assert.equal(await label(page.locator('#btnGdPhotos')),'사진 추가');
        assert.equal(await label(page.locator('#btnGdLoad')),'드라이브 불러오기');
        assert.equal(await label(page.locator('#btnSelMode')),'사진 선택');assert.equal(await page.locator('#btnSelMode').getAttribute('aria-pressed'),'false');
        await page.locator('#btnSelMode').focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('#btnSelMode').getAttribute('aria-pressed'),'true','photo selection aria-pressed must follow the active mode');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'btnSelMode','selection toggle preserves keyboard focus after render');
        assert.equal(await label(page.locator('#btnSelMode')),'선택 종료');assert(await page.evaluate(()=>__selMode&&document.body.classList.contains('selmode')));
        await page.keyboard.press('Enter');assert.equal(await page.locator('#btnSelMode').getAttribute('aria-pressed'),'false');assert.equal(await label(page.locator('#btnSelMode')),'사진 선택');assert.equal(await page.evaluate(()=>document.activeElement.id),'btnSelMode');
        await page.evaluate(()=>document.getElementById('toast').classList.remove('show'));await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
        if(spec.mobile){
          const more=page.locator('#btnPhotoMore');assert.equal(await more.getAttribute('aria-controls'),'photoExtraTools');assert.equal(await more.getAttribute('aria-expanded'),'false');assert.equal(await label(more),'도구 더보기');
          assert(!(await page.locator('#photoExtraTools').isVisible()),'secondary photo tools start hidden');
          await page.locator('#btnGdPhotos').scrollIntoViewIfNeeded();await settle(page);
          // Hover lift is decorative, so compare grid alignment by layout offsets; use the
          // actual painted bounds separately for touch size and horizontal clipping.
          const boxes=await page.locator('#btnGdPhotos,#btnGdLoad,#btnSelMode,#btnPhotoMore').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,layoutX:e.offsetLeft,layoutY:e.offsetTop,layoutBottom:e.offsetTop+e.offsetHeight};}));
          const byId=Object.fromEntries(boxes.map(b=>[b.id,b]));
          assert(boxes.every(b=>b.width>=44&&b.height>=44&&b.x>=0&&b.right<=spec.width+1),'mobile photo controls meet touch size without horizontal clipping');
          assert(Math.abs(byId.btnGdPhotos.layoutY-byId.btnGdLoad.layoutY)<1&&Math.abs(byId.btnSelMode.layoutY-byId.btnPhotoMore.layoutY)<1&&byId.btnSelMode.layoutY>=Math.max(byId.btnGdPhotos.layoutBottom,byId.btnGdLoad.layoutBottom)&&Math.abs(byId.btnGdPhotos.layoutX-byId.btnSelMode.layoutX)<1&&Math.abs(byId.btnGdLoad.layoutX-byId.btnPhotoMore.layoutX)<1,'mobile photo actions use two clear columns and two rows: '+JSON.stringify(boxes));
          await shot(page,spec,'photo-toolbar');await more.focus();await page.keyboard.press('Enter');
          assert.equal(await more.getAttribute('aria-expanded'),'true');assert.equal(await label(more),'도구 접기');assert(await page.locator('#photoExtraTools').isVisible());
          assert.equal(await page.evaluate(()=>document.activeElement.id),'btnPhotoMore','expanding photo tools preserves keyboard focus');
          await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'btnPhotoTools','Tab reaches first newly expanded tool');
          assert(await page.locator('#photoExtraTools #btnPhotoTools').isVisible());
          await shot(page,spec,'photo-tools-open');await more.focus();await page.keyboard.press('Enter');assert.equal(await more.getAttribute('aria-expanded'),'false');assert(!(await page.locator('#photoExtraTools').isVisible()));assert.equal(await page.evaluate(()=>document.activeElement.id),'btnPhotoMore');
        }else{
          assert.equal(await page.locator('#btnPhotoMore').count(),0,'desktop keeps existing expanded tools');assert(await page.locator('#btnPhotoTools').isVisible());await shot(page,spec,'photo-toolbar');
        }
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),spec.name+' page has no horizontal overflow');
        assert.deepEqual(await businessSnapshot(page),baseline,'photo toolbar toggles change no saved business data');
        assert.deepEqual(await page.evaluate(()=>__friendlyUnexpected),[],'no account, file picker, Drive, or AI operation invoked');assert.deepEqual(effects,[]);assert.deepEqual(errors,[]);
        passed++;console.log('PASS friendly UI '+spec.name+' '+spec.width+'x'+spec.height);
      }finally{await context.close();}
    }
  }finally{await browser.close();}
  console.log('PASS friendly UI scenarios '+passed+'/'+cases.length+'; synthetic data only');
})().catch(e=>{console.error(e);process.exitCode=1;});

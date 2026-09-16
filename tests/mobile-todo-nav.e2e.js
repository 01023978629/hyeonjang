/* Mobile fifth navigation action opens existing todo, not another saved data system.
   HJ_TODO_NAV_MUTATION=route|quote-shortcut must fail its protected assertion.
   HJ_TODO_NAV_SHOTS=<folder> saves optional simulated screen captures. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const ORIGIN='http://127.0.0.1:8299';
const mutation=process.env.HJ_TODO_NAV_MUTATION||'';
assert(['','route','quote-shortcut'].includes(mutation));
const shots=process.env.HJ_TODO_NAV_SHOTS;
const cases=[
  {name:'compact',width:360,height:640,tab:'photos'},
  {name:'small',width:320,height:568,tab:'schedule'},
  {name:'landscape',width:740,height:360,tab:'dashboard'},
  {name:'large-text',width:360,height:640,tab:'photos',big:true}
];
const NAV='.mobile-nav [data-mnav="__todo"]';
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function capture(page,spec,name){if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,spec.name+'-'+name+'.png')});}}
async function modalClosed(page){await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet)&&document.activeElement?.dataset.mnav==='__todo');}
async function moreClosed(page){await page.waitForFunction(()=>!document.querySelector('#moreSheet')&&!window.__mobileSheetHistoryRetire&&!(history.state&&history.state.__hjMobileSheet));}
async function preserved(page){return page.evaluate(()=>({
  projects:JSON.stringify(state.projects),files:JSON.stringify(state.files),draft:JSON.stringify(state.editingQuote),quotes:JSON.stringify(state.quotes),schedule:JSON.stringify(state.schedule),
  memo:JSON.stringify(state.notes.filter(n=>!n.todo)),activeProject:state.activeProject
}));}
async function openTodo(page){
  await page.locator(NAV).click();await settle(page);
  assert.equal(await page.locator('#modalRoot #todoText').count(),1,'today work navigation must dispatch to the existing todo view');
  await page.waitForFunction(()=>document.activeElement?.id==='todoText');
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  let passed=0;
  try{
    for(const spec of cases){
      const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
      try{
        await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
        const page=await context.newPage();page.setDefaultTimeout(9000);
        const errors=[],effects=[];page.on('pageerror',e=>errors.push(String(e)));page.on('popup',()=>effects.push('popup'));page.on('download',()=>effects.push('download'));
        await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('pref_mobile','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
        await page.goto(ORIGIN+'/index.html',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
        await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);clearTimeout(__idbSaveTimer);await __appStateWriteQueue;});
        await page.evaluate(({spec,mutation})=>{
          // These isolated navigation records must not race the unrelated 4s tax/4.5s
          // Cowork startup seeders. Their own tests cover seeding; keep preservation assertions exact.
          taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>0;
          state.projects=[{name:'모의 작업 아파트',stage:2,received:0,phases:[],cost:{material:0,labor:0,outsource:0},customer:{}}];
          state.activeProject=state.projects[0].name;state.files=[];state.schedule=[];state.quotes=[];state.expenses=[];state.payLog=[];state.aptOrders=[];
          state.tab=spec.tab;state.search='';state.dirHandle=null;state._demo=false;state.dirty=false;
          const today=localDate(),before=new Date();before.setDate(before.getDate()-1);const yesterday=localDate(before);
          state.notes=[
            {id:'mock-memo',text:'모의 비할일 메모',project:state.activeProject,date:today,done:true},
            {id:'mock-today',text:'모의 오늘 준비 작업',project:state.activeProject,date:today,day:today,todo:true,done:false},
            {id:'mock-finished',text:'모의 완료 작업',project:state.activeProject,date:today,day:today,todo:true,done:true,doneAt:'mock-finished-at'},
            {id:'mock-late',text:'모의 어제 밀린 작업',project:state.activeProject,date:yesterday,day:yesterday,todo:true,done:false}
          ];
          state.editingQuote=newQuote(false);state.editingQuote.id='mock-navigation-draft';state.editingQuote.title='모의 작성 중 견적 유지';state.editingQuote.project=state.activeProject;
          state.editingQuote.items=[{name:'모의 보존 품목',spec:'모의 규격',qty:2,price:1234}];
          __mobileMode=true;applyMobileMode();if(spec.big)document.body.classList.add('a11y-big2');__gdToken=null;relayReady=()=>false;aiOpsEnsureState().enabled=false;
          window.__todoNavExternal=[];const reject=name=>()=>{__todoNavExternal.push(name);throw new Error('unexpected external '+name);};
          window.open=reject('window.open');window.showOpenFilePicker=reject('file picker');window.showDirectoryPicker=reject('directory picker');relayCall=reject('relay');geminiAsk=reject('AI');
          render();syncMobileNav();clearTimeout(__idbSaveTimer);document.getElementById('toast').classList.remove('show');
          if(mutation==='route')document.addEventListener('click',event=>{if(event.target.closest('[data-mnav="__todo"]')){event.preventDefault();event.stopImmediatePropagation();}},true);
          if(mutation==='quote-shortcut'){const index=MORE_NAV_SHORTCUTS.findIndex(x=>x.tab==='quotemaker');if(index>=0)MORE_NAV_SHORTCUTS.splice(index,1);}
        },{spec,mutation});
        await settle(page);await page.waitForFunction(()=>getComputedStyle(document.getElementById('toast')).opacity==='0');
        const before=await preserved(page);
        const nav=await page.locator('.mobile-nav [data-mnav]').evaluateAll(es=>es.map(e=>({id:e.dataset.mnav,label:e.querySelector('span:last-child')?.textContent,aria:e.getAttribute('aria-label'),title:e.title})));
        assert.deepEqual(nav.map(x=>x.id),['dashboard','photos','__camera','schedule','__todo','__more'],'six navigation positions keep today work in the fifth slot');
        assert.equal(nav[4].label,'오늘 할일');assert.equal(nav[4].aria,'오늘 할일, 오늘 할 작업 열기');assert.equal(nav[4].title,'오늘 할 작업');
        assert(await page.locator(NAV).evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1&&!!h&&(h===e||e.contains(h));}),spec.name+' fifth navigation target is visible and touchable');
        await capture(page,spec,'bottom-navigation');
        for(const closing of ['button','escape','back']){
          // Layout-only fixture proves the action also works halfway down a long page.
          await page.evaluate(()=>{document.getElementById('view').style.minHeight='1600px';window.scrollTo(0,320);});
          await page.waitForFunction(()=>scrollY>=300);const originalScroll=await page.evaluate(()=>scrollY);
          const notesBefore=await page.evaluate(()=>JSON.stringify(state.notes));
          await openTodo(page);assert.equal(await page.evaluate(()=>state.tab),spec.tab,'opening todo does not replace underlying tab');
          assert.deepEqual(await page.locator('#modalRoot .todoRow').evaluateAll(es=>es.map(e=>e.dataset.id)),['mock-late','mock-today','mock-finished'],'late, today, and completed work remain in existing order');
          const text=await page.locator('#modalRoot').innerText();assert.match(text,/밀린 할일 1/);assert.match(text,/오늘 할일 1/);assert.match(text,/끝낸 일 1/);
          if(closing==='button'){await capture(page,spec,'today-work');await page.locator('#modalRoot .mfoot button').filter({hasText:/^닫기$/}).click();}
          else if(closing==='escape')await page.keyboard.press('Escape');
          else await page.evaluate(()=>history.back());
          await modalClosed(page);assert.equal(await page.evaluate(()=>state.tab),spec.tab,closing+' preserves previous tab');
          assert(Math.abs((await page.evaluate(()=>scrollY))-originalScroll)<=1,closing+' preserves underlying page scroll position');
          assert.equal(await page.evaluate(()=>JSON.stringify(state.notes)),notesBefore,closing+' browsing does not mutate work records');
        }
        await page.evaluate(()=>{document.getElementById('view').style.minHeight='';window.scrollTo(0,0);});
        // Reuse the existing add/check flow, mutating only synthetic todo records.
        await openTodo(page);await page.locator('#todoText').fill('모의 새 작업 한 줄');await page.locator('#todoAdd').click();
        const added=await page.evaluate(()=>state.notes.find(n=>n.text==='모의 새 작업 한 줄'));
        assert(added&&added.todo&&!added.done&&added.project===before.activeProject,'new task uses existing notes record and selected project');
        let check=page.locator('.todoChkBox[data-id="'+added.id+'"]');await check.check();
        assert(await page.evaluate(id=>state.notes.find(n=>n.id===id).done,added.id),'checked todo becomes completed');
        check=page.locator('.todoChkBox[data-id="'+added.id+'"]');await check.uncheck();
        assert(!(await page.evaluate(id=>state.notes.find(n=>n.id===id).done,added.id)),'unchecked todo returns to outstanding');
        await page.keyboard.press('Escape');await modalClosed(page);await openTodo(page);
        assert.equal(await page.locator('.todoChkBox[data-id="'+added.id+'"]').isChecked(),false,'reopening keeps the edited synthetic task');
        await page.keyboard.press('Escape');await modalClosed(page);
        assert.deepEqual(await preserved(page),before,'todo edits preserve draft, projects, photos, schedule and non-todo memo');
        // Empty state uses a separate synthetic reset, never a deletion action against user data.
        await page.evaluate(()=>{window.__testTodoNotes=state.notes;state.notes=state.notes.filter(n=>!n.todo);});
        await openTodo(page);assert.match(await page.locator('#modalRoot').innerText(),/할 일이 없습니다/);assert.equal(await page.locator('#modalRoot .todoRow').count(),0);
        await capture(page,spec,'empty-work');await page.keyboard.press('Escape');await modalClosed(page);
        await page.evaluate(()=>{state.notes=window.__testTodoNotes;delete window.__testTodoNotes;});
        // Quote writer is still directly available and searchable; navigation cannot discard a draft.
        await page.locator('[data-mnav="__more"]').click();await page.locator('#moreSearch').waitFor();
        assert.equal(await page.locator('#moreNav [data-more="quotemaker"]').count(),1,'quote writing shortcut must remain accessible in More');
        assert.equal(await page.locator('#moreNav [data-more]').count(),5,'More contains five navigation shortcuts');
        assert.match(await page.locator('#moreResultCount').innerText(),/바로가기 5개/);
        await page.locator('#moreNav [data-more="quotemaker"]').click();await moreClosed(page);
        assert.equal(await page.evaluate(()=>state.tab),'quotemaker');assert.equal(await page.locator('#qmTitle').inputValue(),'모의 작성 중 견적 유지');
        assert.deepEqual(await preserved(page),before,'direct quote shortcut preserves the unsaved draft');
        await page.locator('[data-mnav="photos"]').click();await page.locator('[data-mnav="__more"]').click();await page.locator('#moreSearch').fill('견적');
        assert.equal(await page.locator('#moreSearchResult [data-more="quotemaker"]').count(),1,'quote writer is searchable alongside quote settlement');
        await page.locator('#moreSearchResult [data-more="quotemaker"]').click();await moreClosed(page);
        assert.equal(await page.locator('#qmTitle').inputValue(),'모의 작성 중 견적 유지');assert.equal(await page.locator('input[data-qf="name"]').first().inputValue(),'모의 보존 품목');
        assert.deepEqual(await preserved(page),before,'search quote shortcut preserves the unsaved draft');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),spec.name+' no page horizontal overflow');
        assert.deepEqual(await page.evaluate(()=>__todoNavExternal),[]);assert.deepEqual(effects,[]);assert.deepEqual(errors,[]);
        passed++;console.log('PASS mobile todo navigation '+spec.name+' '+spec.width+'x'+spec.height);
      }finally{await context.close();}
    }
  }finally{await browser.close();}
  console.log('PASS mobile todo navigation '+passed+'/'+cases.length+'; isolated synthetic data only');
})().catch(e=>{console.error(e);process.exitCode=1;});

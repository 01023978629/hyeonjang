/* v291: synthetic, isolated team work; no accounts, actual data, uploads or messages.
   HJ_TEAM_MUTATION=separation|stale|snapshot must fail. HJ_TEAM_ONLY filters scenarios. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin,MUTATION=process.env.HJ_TEAM_MUTATION||'';
assert(['','separation','stale','snapshot'].includes(MUTATION));
let source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
if(MUTATION==='separation'){
  assert(source.includes('n&&n.todo&&!hjIsTeamTask(n)'));source=source.replace('n&&n.todo&&!hjIsTeamTask(n)','n&&n.todo');
}
if(MUTATION==='stale'){
  assert(source.includes('JSON.stringify(original)===originalText'));source=source.replace('JSON.stringify(original)===originalText','true');
}
if(MUTATION==='snapshot'){
  assert(source.includes('&&!(data.notes||[]).length)return false;'));source=source.replace('&&!(data.notes||[]).length)return false;',')return false;');
}
let browser,passed=0;
async function ready(page){
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);});
}
async function boot(width){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',timezoneId:'Asia/Seoul',hasTouch:true});
  const page=await context.newPage();page.setDefaultTimeout(9000);const errors=[],external=[];let observing=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  page.on('request',r=>{if(observing&&!r.url().startsWith(ORIGIN)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());if(u.origin!==ORIGIN)return route.abort();
    if(MUTATION&&u.pathname==='/index.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:source});return route.continue();
  });
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:20000});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;await ready(page);
  await page.waitForFunction(()=>!!localStorage.getItem('hj_glance'));
  await page.evaluate(async()=>{
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;aiOpsEnsureState().enabled=false;
    state.projects=Array.from({length:35},(_,i)=>({name:'가상현장'+String(i+1).padStart(2,'0'),stage:1,received:0,phases:[],cost:{}}));
    state.files=[];state.quotes=[];state.aptOrders=[];state.aptOffices=[];state.expenses=[];state.payLog=[];state.contacts=[];state.schedule=[];
    state.notes=[{id:'personal',todo:true,text:'개인 할일',done:false},{id:'memo',text:'일반 회의 메모'}];
    window.__fakeTeam=(id,assignee,status='todo',due='')=>({id,text:'[팀 업무]',todo:true,done:status==='done',project:'가상현장01',teamTask:{schema:1,title:'가상 업무 '+id,assignee,status,due,handoff:'다음 사람이 확인할 내용',recorder:'가상 기록자',updatedAt:'2026-09-13T01:00:00.000Z',revision:1}});
    state.notes.push(...['가상담당1','가상담당2','가상담당3','가상담당4','가상담당5'].map((name,i)=>__fakeTeam('t'+i,name,i===0?'blocked':i===4?'done':'doing',i===1?'2000-01-01':'')));
    state.notes.push(__fakeTeam('unassigned','','todo',''));
    state.activeProject=null;state.tab='dashboard';state.search='';state.editingQuote=null;state.dirHandle=null;state._demo=false;__gdToken=null;__tabStale=false;
    __mobileMode=true;applyMobileMode();relayReady=()=>false;
    const reject=name=>()=>{throw new Error('Unexpected external '+name);};relayCall=reject('relay');window.open=reject('popup');if(navigator.share)navigator.share=reject('share');
    // Real local transaction retained. Post-commit network scheduling is observed, not executed.
    window.__teamCommitted=0;webWorkMarkDirtyAfterPersist=()=>{__teamCommitted++;state.dirty=true;};
    /* Neutralize the delayed startup seeders rather than draining them once — boot arms
       taxCalendarEnsure() at 4s and coworkSchedEnsure() at 4.5s, so calling them here and
       clearing state.schedule below just lets the timers re-seed mid-test on a loaded
       machine. That is what broke the v308 deploy in document-estimate-ui. */
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;render();clearTimeout(__idbSaveTimer);await guardedPersistCurrentState();await __appStateWriteQueue;
  });
  // Explicit reload reboots existing CDN/GIS scripts (all remain blocked by routing).
  page.__teamReload=async()=>{observing=false;const bootGis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:20000});await page.reload({waitUntil:'domcontentloaded'});await bootGis;await ready(page);observing=true;};
  observing=true;return {page,context,errors,external};
}
async function scenario(name,fn,width=390){
  if(process.env.HJ_TEAM_ONLY&&!name.includes(process.env.HJ_TEAM_ONLY))return;
  const t=await boot(width);try{await fn(t.page);assert.deepEqual(t.errors,[]);assert.deepEqual(t.external,[]);passed++;console.log('PASS '+width+'px '+name);}finally{await t.context.close();}
}
async function openBoard(page){await page.locator('#dashboardTeamOpen').click();await page.locator('#teamBoard').waitFor();}
async function fill(page,{title='자재 확인',assignee='가상담당1',project='가상현장35',due='',status='todo',handoff='다음 날 자재 확인',recorder='가상 기록자'}={}){
  await page.locator('#teamTitle').fill(title);await page.locator('#teamAssignee').fill(assignee);await page.locator('#teamProject').selectOption(project);
  await page.locator('#teamDue').fill(due);await page.locator('#teamStatus').selectOption(status);await page.locator('#teamHandoff').fill(handoff);await page.locator('#teamRecorder').fill(recorder);
}
async function save(page){await page.locator('#teamSave').click();await page.locator('#teamBoard').waitFor();}
async function fits(page,root){
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'no document overflow');
  assert(await page.locator(root).evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no panel overflow');
  for(const el of await page.locator(root+' button,'+root+' input,'+root+' select').all()){
    const b=await el.boundingBox();assert(b&&b.width>=44&&b.height>=44,'44px controls');
    if(await el.evaluate(e=>e.matches('input,select,textarea')))assert(await el.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'16px input text');
  }
}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  for(const width of [360,390,1024])await scenario('5인 담당별 집계·막힘/기한 우선·터치 UI',async page=>{
    assert.match(await page.locator('#dashboardTodoSummary').innerText(),/미완료 1건/);
    await openBoard(page);assert.match(await page.locator('#teamBoardSummary').innerText(),/5건 미완료 · 미배정 1건 · 기한 지남 1건/);
    assert.deepEqual(await page.locator('[data-team-card]').evaluateAll(els=>els.slice(0,2).map(e=>e.dataset.teamCard)),['t0','t1']);
    if(process.env.HJ_TEAM_SCREENSHOT_DIR){fs.mkdirSync(process.env.HJ_TEAM_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.HJ_TEAM_SCREENSHOT_DIR,'team-board-'+width+'.png'),fullPage:true});}
    await page.locator('#teamAssigneeFilter').selectOption('가상담당2');assert.equal(await page.locator('[data-team-card]').count(),1);
    await page.locator('#teamAssigneeFilter').selectOption('@unassigned');assert.equal(await page.locator('[data-team-card]').first().getAttribute('data-team-card'),'unassigned');
    await page.locator('#teamAssigneeFilter').selectOption('');await page.locator('#teamStatusFilter').selectOption('done');assert.equal(await page.locator('[data-team-card]').count(),1);
    await fits(page,'#teamBoard');await page.locator('#teamAdd').click();await fits(page,'#teamEditor');
    if(process.env.HJ_TEAM_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.HJ_TEAM_SCREENSHOT_DIR,'team-editor-'+width+'.png'),fullPage:true});
    assert.equal(await page.locator('#teamProject option').count(),36);
  },width);
  await scenario('팀 업무 분리·개인 완료 삭제·AI/일반 메모 비노출',async page=>{
    assert.deepEqual(await page.evaluate(()=>hjTodoList().map(n=>n.id)),['personal']);
    assert.equal(await page.evaluate(()=>aiListNotes('').메모.some(n=>n.내용==='[팀 업무]')),false);
    await page.evaluate(()=>{state.notes.find(n=>n.id==='personal').done=true;state.notes.push({...__fakeTeam('personal','가상담당1')},__fakeTeam('memo','가상담당2'));todoView();});
    await page.getByRole('button',{name:'끝낸 일 지우기',exact:true}).click();
    assert.equal(await page.evaluate(()=>hjTeamList().length),8);assert.equal(await page.evaluate(()=>hjTodoList().length),0);
    await page.evaluate(()=>voiceMemo());assert(!((await page.locator('#modalRoot').innerText()).includes('[팀 업무]')));
    await page.locator('[data-notedel="memo"]').click();await page.waitForFunction(()=>!state.notes.some(n=>n.id==='memo'&&!hjIsTeamTask(n)));assert.equal(await page.evaluate(()=>hjTeamList().length),8);
  });
  await scenario('등록·인계·완료·재개와 새로고침 왕복',async page=>{
    await openBoard(page);await page.locator('#teamAdd').click();await fill(page,{title:'가상 자재 반입',due:'2026-10-01'});await save(page);
    const id=await page.evaluate(()=>hjTeamList().find(n=>n.teamTask.title==='가상 자재 반입').id);
    assert.equal(await page.evaluate(()=>__teamCommitted),1);
    await page.locator('[data-team-edit="'+id+'"]').click();assert.equal(await page.locator('#teamRecorder').inputValue(),'');
    await fill(page,{title:'가상 자재 반입',assignee:'가상담당5',status:'review',handoff:'수량을 확인해 주세요.'});await save(page);
    await page.locator('[data-team-edit="'+id+'"]').click();await fill(page,{title:'가상 자재 반입',assignee:'가상담당5',status:'done',handoff:'수량 확인 기록'});await save(page);
    assert.equal(await page.locator('[data-team-card="'+id+'"]').count(),0);
    await page.locator('#teamStatusFilter').selectOption('done');await page.locator('[data-team-edit="'+id+'"]').click();
    await fill(page,{title:'가상 자재 반입',assignee:'가상담당5',status:'doing',handoff:'추가 반입 확인'});await save(page);
    const before=await page.evaluate(id=>state.notes.find(n=>n.id===id),id);assert.equal(before.teamTask.revision,4);assert.equal(before.done,false);
    await page.__teamReload();
    assert.deepEqual(await page.evaluate(id=>state.notes.find(n=>n.id===id),id),before);
    assert.equal(await page.evaluate(()=>state.notes.find(n=>n.id==='memo').text),'일반 회의 메모');
  });
  await scenario('필수값·막힘 사유·잘못된 날짜 차단',async page=>{
    await openBoard(page);await page.locator('#teamAdd').click();await fill(page,{status:'blocked',handoff:''});
    await page.locator('#teamSave').click();assert.match(await page.locator('#teamSaveStatus').innerText(),/인수인계/);assert.equal(await page.evaluate(()=>__teamCommitted),0);
    assert.deepEqual(await page.evaluate(()=>['2026-02-30','2026-2-03','2026-02-03'].map(hjTeamDate)),[false,false,true]);
    await page.locator('#teamHandoff').fill('가상 자재 도착 대기');await save(page);
    assert.equal(await page.evaluate(()=>hjTeamList().length),7);
  });
  await scenario('오래된 같은 객체 수정·동일 ID·삭제된 현장 차단',async page=>{
    await openBoard(page);await page.locator('[data-team-edit="t1"]').click();await fill(page,{project:'가상현장01'});
    await page.evaluate(()=>{state.notes.find(n=>n.id==='t1').teamTask.handoff='다른 탭의 새 내용';});
    await page.locator('#teamSave').click();await page.waitForFunction(()=>!__hjTeamBusy);assert.equal(await page.evaluate(()=>__teamCommitted),0,'stale edits must not commit');assert.match(await page.locator('#teamSaveStatus').innerText(),/변경/);
    await page.evaluate(()=>{closeModal(true);state.notes.push({...state.notes.find(n=>n.id==='t1')});hjTeamBoard();});
    await page.locator('[data-team-edit="t1"]').first().click();assert.equal(await page.locator('#teamEditor').count(),0);
    await page.locator('#teamAdd').click();await fill(page);await page.evaluate(()=>{state.projects=state.projects.filter(p=>p.name!=='가상현장35');});
    await page.locator('#teamSave').click();assert.match(await page.locator('#teamSaveStatus').innerText(),/변경/);assert.equal(await page.locator('#teamTitle').inputValue(),'자재 확인');
  });
  await scenario('안전판 대기 중 변경 차단·입력 보존',async page=>{
    await openBoard(page);await page.locator('[data-team-edit="t2"]').click();await fill(page);
    await page.evaluate(()=>{hjSnapshot=async()=>{state.notes=state.notes.map(n=>({...n}));return true;};});
    await page.locator('#teamSave').click();await page.waitForFunction(()=>!__hjTeamBusy);
    assert.match(await page.locator('#teamSaveStatus').innerText(),/중단/);assert.equal(await page.evaluate(()=>__teamCommitted),0);assert.equal(await page.locator('#teamTitle').inputValue(),'자재 확인');
  });
  await scenario('로컬 저장 실패 rollback·닫기 잠금·재시도',async page=>{
    await openBoard(page);await page.locator('#teamAdd').click();await fill(page);
    const before=await page.evaluate(()=>JSON.stringify(state.notes));
    await page.evaluate(()=>{window.__realTeamPersist=guardedAppStateWriteAtomic;guardedAppStateWriteAtomic=()=>new Promise(resolve=>window.__teamRelease=resolve);});
    await page.locator('#teamSave').click();await page.waitForFunction(()=>typeof window.__teamRelease==='function');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#teamEditor').count(),1);
    assert.equal(await page.evaluate(()=>JSON.stringify(serializeData().notes)),before,'cloud/backup sees no uncommitted candidate');
    await page.evaluate(()=>__teamRelease(false));await page.waitForFunction(()=>!__hjTeamBusy);
    assert.equal(await page.evaluate(()=>JSON.stringify(state.notes)),before);assert.equal(await page.evaluate(()=>__teamCommitted),0);
    assert.equal(await page.locator('#teamTitle').inputValue(),'자재 확인');await page.evaluate(()=>{guardedAppStateWriteAtomic=__realTeamPersist;});await save(page);
  });
  await scenario('업무만 있는 기기 안전판·불러오기 보호·내보내기',async page=>{
    const result=await page.evaluate(async()=>{
      state.projects=[];state.files=[];state.quotes=[];state.notes=[__fakeTeam('solo','가상담당1')];state.notes[0].project='';
      const expected=JSON.stringify(state.notes),ok=await hjSnapshot('업무 전용 테스트',true);
      const snaps=await idbGetStrict('hj_snaps'),last=snaps[snaps.length-1];
      const real=hjSnapshot;hjSnapshot=async()=>false;const guard=await relayGuardSnapshot('실패');hjSnapshot=real;
      const data=serializeData();state.notes=[];applyData(data,{revert:true});return {ok,guard,expected,restored:JSON.stringify(state.notes),snapshot:JSON.stringify(last.data.notes)};
    });
    assert.equal(result.ok,true);assert.equal(result.guard,false);assert.equal(result.restored,result.expected);assert.equal(result.snapshot,result.expected);
    // 여기서 suggestedFilename 이 'download' 로 나오면 앱 버그가 아니라 브라우저 빌드 문제다.
    // 일부 Chromium 빌드가 blob 다운로드의 **한글 파일명**을 못 받아 'download' 로 떨어뜨린다.
    // 앱과 무관함은 about:blank 에서 확인된다 — Blob + a.download 다섯 줄로, 같은 코드에
    // ASCII 이름을 주면 그대로 나오고 한글 이름만 'download' 가 된다.
    // playwright 클라이언트 판(1.55.0 / 1.56.1)을 바꿔도 같은 브라우저면 결과가 같으므로
    // 원인은 클라이언트가 아니라 브라우저 빌드다. CI 러너의 빌드는 정상이고(배포 기록에서
    // 이 파일은 매번 통과한다), 실제 폰도 문제없다.
    // 파일명은 사장님이 백업 파일을 알아보는 수단이라 ASCII 로 바꾸지 않는다 — 검사도 약하게 만들지 않는다.
    const download=page.waitForEvent('download');await page.evaluate(()=>exportData());assert.match((await download).suggestedFilename(),/^현장데이터_\d+\.json$/);
  });
  await scenario('현장 이름 변경 연동·삭제 후 기록 보존',async page=>{
    await page.evaluate(()=>renameProject('가상현장01'));await page.locator('#renProjInput').fill('가상새현장');await page.getByRole('button',{name:'저장',exact:true}).click();
    assert(await page.evaluate(()=>hjTeamList().every(n=>n.project==='가상새현장')));
    await page.evaluate(()=>{state.projects=state.projects.filter(p=>p.name!=='가상새현장');hjTeamBoard();});
    assert.match(await page.locator('#teamCards').innerText(),/연결 확인 필요/);assert.equal(await page.locator('[data-team-project]').count(),0);
    await page.locator('[data-team-edit="t0"]').click();await fill(page,{project:''});await save(page);
    assert.equal(await page.evaluate(()=>state.notes.find(n=>n.id==='t0').project),'');
  });
  await scenario('인계 후 사라진 필터 정규화·키보드 초점·보관 현장 완료',async page=>{
    await openBoard(page);await page.locator('#teamAssigneeFilter').selectOption('가상담당2');
    await page.waitForFunction(()=>document.activeElement.id==='teamAssigneeFilter');
    await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.activeElement.id==='teamAssigneeFilter');
    await page.locator('#teamAssigneeFilter').selectOption('가상담당2');await page.locator('[data-team-edit="t1"]').click();
    await fill(page,{assignee:'가상새담당',project:'가상현장01'});await save(page);
    assert.equal(await page.locator('#teamAssigneeFilter').inputValue(),'');assert.equal(await page.locator('[data-team-card]').count(),5);
    await page.evaluate(()=>{state.projects.find(p=>p.name==='가상현장01').archived=true;});
    await page.locator('[data-team-edit="t1"]').click();await fill(page,{project:'가상현장01',status:'done'});await save(page);
    assert.equal(await page.evaluate(()=>state.notes.find(n=>n.id==='t1').teamTask.status),'done');
  });
  await scenario('원자 저장 직전 변경 감지·live 후보 비공개',async page=>{
    await openBoard(page);await page.locator('#teamAdd').click();await fill(page);
    await page.evaluate(()=>{const real=guardedAppStateWriteAtomic;guardedAppStateWriteAtomic=async(...args)=>{
      if(args[4]){state.notes.push({id:'arrived',text:'다른 경로에서 도착한 기록'});}
      return real(...args);
    };});
    await page.locator('#teamSave').click();await page.waitForFunction(()=>!__hjTeamBusy);
    assert.match(await page.locator('#teamSaveStatus').innerText(),/중단/);assert.equal(await page.evaluate(()=>__teamCommitted),0);
    assert.equal(await page.evaluate(()=>state.notes.some(n=>n.id==='arrived')),true);
    assert.equal(await page.evaluate(()=>hjTeamList().length),6);
  });
  await scenario('HTML·긴 이름 안전 / 읽기 전용 필터 / 페이지 추가',async page=>{
    const bad='<img src=x onerror="window.__teamXss=1">';
    await page.evaluate(bad=>{state.notes[2].teamTask.title=bad;state.notes[2].teamTask.handoff=bad;state.notes[2].teamTask.assignee=bad;state.notes.push(...Array.from({length:55},(_,i)=>__fakeTeam('bulk'+i,'가상담당1')));},bad);
    const before=await page.evaluate(()=>JSON.stringify(state.notes));await openBoard(page);
    assert.equal(await page.locator('#teamBoard img').count(),0);assert.match(await page.locator('#teamCards').innerText(),/<img src=x/);
    assert.equal(await page.locator('[data-team-card]').count(),50);await page.locator('#teamMore').click();assert.equal(await page.locator('[data-team-card]').count(),60);
    assert.equal(await page.evaluate(()=>window.__teamXss),undefined);assert.equal(await page.evaluate(()=>JSON.stringify(state.notes)),before);await fits(page,'#teamBoard');
    assert.match(await page.locator('#teamBoard').innerText(),/5인 운영 전 확인할 점/);
  });
  console.log('SUMMARY='+passed+' scenarios passed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

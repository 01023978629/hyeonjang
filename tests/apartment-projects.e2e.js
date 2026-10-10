// v331: synthetic data only, real snapshot / CAS / IDB / reload. Mutants must fail.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const mutation = process.env.HJ_APARTMENT_PROJECT_MUTATION || '';
assert(['', 'metadata', 'financial', 'stale'].includes(mutation));
const origin = 'http://127.0.0.1:8299';
let browser, context, page;
async function seed() {
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure();coworkSchedEnsure();aiOpsEnsureState().enabled=false;
    relayReady = () => false; __gdToken = null; __tabStale = false;
    state.projects = [aptProjectDefault('가상 한마음아파트'), aptProjectDefault('가상 한마음아파트 101동 501호'), aptProjectDefault('가상 다른아파트')];
    delete state.projects[1].aptUnits;
    state.projects[1].phases = ['시공 전', '시공 후'];
    state.files = [
      {id:'a',name:'원본.png',kind:'photo',ext:'png',prefix:'_정리완료/가상 한마음아파트 101동 501호/현장사진/시공 전',size:100,project:state.projects[1].name,when:new Date('2026-09-22T00:00:00Z'),_driveId:'FAKE-A',_relayLink:'relay:FAKE-A',_worklabel:'방수 작업',_phase:'시공 전',_originalSha256:'a'.repeat(64),_virtual:true},
      {id:'v',name:'동영상.mp4',kind:'photo',ext:'mp4',prefix:'현장사진',size:200,project:state.projects[1].name,when:new Date('2026-09-22T00:00:00Z'),_mediaOriginal:{v:1,status:'local',name:'동영상.mp4',size:200},_virtual:true},
      {id:'b',name:'다른사진.png',kind:'photo',ext:'png',prefix:'현장사진',size:300,project:state.projects[2].name,_virtual:true}
    ];
    state.quotes=[];state.payLog=[];state.schedule=[];state.notes=[];state.expenses=[];state.aptOrders=[];state.aptOffices=[];
    state.dirHandle=null;state._demo=false;state.dirty=false;state.activeProject=null;state.tab='aptmgmt';state.search='';
    clearTimeout(__idbSaveTimer); __photoCache.key=null; __sel.clear(); __selMode=false;
    if(!(await guardedPersistCurrentState()))throw new Error('fixture persist failed'); await __appStateWriteQueue; render();syncMobileNav();
    window.apartmentBefore=serializeData();window.apartmentPlan=null;
  });
}
async function preview() {
  return page.evaluate(()=>{window.apartmentPlan=aptProjectPreview('가상 한마음아파트',{dong:'101',ho:'501'},'가상 한마음아파트 101동 501호');return {name:apartmentPlan.name,count:apartmentPlan.count};});
}
async function attempt() { return page.evaluate(async()=>{try{return {value:await aptProjectApply(apartmentPlan)};}catch(e){return {error:e.message};}}); }
async function serialized() {return page.evaluate(()=>aptProjectStamp(serializeData()));}
async function inject(){if(mutation)await page.evaluate(m=>{
  if(m==='financial'){aptProjectEmpty=()=>true;window.apartmentMutated=true;}
  if(m==='stale'){aptProjectStamp=()=>'';window.apartmentMutated=true;}
  if(m==='metadata'){const real=aptProjectApply;aptProjectApply=async function(p){const r=await real(p);state.files[0].prefix='BROKEN';window.apartmentMutated=true;return r;};}
},mutation);}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||(process.platform!=='win32'?'/opt/pw-browsers/chromium':undefined)});
  context=await browser.newContext({viewport:{width:1280,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  const requests=[];await context.route('**/*',r=>{
    const req=r.request(),url=req.url();if(new URL(url).origin===origin)return r.continue();
    const publicBootOrFakeThumb=req.method()==='GET'&&['https://accounts.google.com/gsi/client','https://lh3.googleusercontent.com/d/FAKE-A=w320','https://drive.google.com/thumbnail?id=FAKE-A&sz=w320','https://cdnjs.cloudflare.com/ajax/libs/exif-js/2.3.0/exif.min.js','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'].includes(url);
    if(!publicBootOrFakeThumb)requests.push(req.method()+' '+url);return r.abort();
  });
  page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/index.html');await page.evaluate(()=>window.__hjRestoreDone);
  await seed();requests.length=0;
  await inject();
  // Entry points and preview/cancel do not save.
  const before=await serialized();
  await page.locator('#btnAddAptProject').click();await page.locator('#aptProjectPanel').waitFor();
  await page.getByLabel('아파트명',{exact:true}).fill('가상 한마음아파트');
  await page.getByLabel('동',{exact:true}).fill('101');await page.getByLabel('호',{exact:true}).fill('501');
  await page.getByRole('button',{name:'미리보기',exact:true}).click();await page.locator('#aptProjectConfirm').waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'백업 파일 받기',exact:true}).click();const backup=await downloadPromise;assert(backup.suggestedFilename().startsWith('현장데이터_아파트정리전_'));
  assert.equal(await serialized(),before);
  await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await serialized(),before);
  // Exact new structure, metadata equality and persistent roundtrip.
  assert.equal((await preview()).count,2);assert(!(await attempt()).error);
  const facts=await page.evaluate(async()=>{
    const after=serializeData(),p=aptUnitProject('가상 한마음아파트'),strip=f=>{const x={...f};delete x.project;delete x.aptUnit;return x;};
    rebuildOrganizedProjectAliases();state.files.forEach(recoverOrganizedMetadata);
    return {before:apartmentBefore.files.map(strip),after:after.files.map(strip),unit:aptUnitLabel(aptUnitList(p)[0]),groups:[...aptUnitPhotoGroups(p)].map(([k,v])=>v.length),archive:state.projects[1].archived,marker:state.projects[1].aptPhotoArchive,photos:after.files.map(f=>f.project),stored:await idbGet('appState'),current:serializeData()};
  });
  assert.deepEqual(facts.after,facts.before,'file originals, paths, tags, dates and hashes must survive');
  assert.equal(facts.unit,'101동 501호');assert.deepEqual(facts.groups,[0,2]);assert.equal(facts.archive,true);assert.equal(facts.marker.count,2);
  assert.deepEqual(facts.photos,['가상 한마음아파트','가상 한마음아파트','가상 다른아파트']);
  assert.equal(facts.current.files[0].project,'가상 한마음아파트','rescan metadata preserves apartment binding');
  await page.reload();await page.evaluate(()=>window.__hjRestoreDone);
  await inject();
  assert.equal(await page.evaluate(()=>aptUnitPhotos(aptUnitProject('가상 한마음아파트'),aptUnitList(aptUnitProject('가상 한마음아파트'))[0].id).length),2,'reload restores photo-unit links');
  // Reusing a normalized apartment does not create a duplicate, or overwrite unit notes.
  await page.evaluate(async()=>{const p=aptProjectPreview('가상한마음아파트',{dong:'0101',ho:'0501'});await aptProjectApply(p);});
  assert.equal(await page.evaluate(()=>state.projects.length),3);assert.equal(await page.evaluate(()=>aptUnitList(state.projects[0]).length),1);
  console.log('PASS migration, originals, rescan, reload, existing apartment/unit reuse');
  for(const [label,expression] of [
    ['금액',"state.projects[1].received=10000"],['고객',"state.projects[1].customer.phone='FAKE-PHONE'"],
    ['견적 참조',"state.quotes=[{project:state.projects[1].name}]"],['사진 아닌 파일',"state.files[0].kind='document'"],
    ['원본 중복',"state.files.push({...state.files[0],id:'duplicate'})"],['단지 중복',"state.projects.push({...state.projects[0]})"],
    ['잘못된 세대',"state.projects[0].aptUnits=[{id:'bad'}]"],['사진 위치 충돌',"state.files[0]._aptUnit={project:'다른 현장',unitId:'u'}"],
    ['확장 데이터',"state.projects[1].casePack={photos:['a']}"],['다른 프로젝트 참조',"state.projects[2].note=state.projects[1].name"],
    ['완료일 보증 기준',"state.projects[1].doneAt='2026-09-20'"],['대상 완료일 상속',"state.projects[0].doneAt='2026-09-20'"]
  ]){
    await seed();await page.evaluate(expression);const stable=await serialized();
    const issue=await page.evaluate(()=>{try{aptProjectPreview('가상 한마음아파트',{dong:'101',ho:'501'},'가상 한마음아파트 101동 501호');return '';}catch(e){return e.message;}});
    assert(issue, label+' must block');assert.equal(await serialized(),stable);
  }
  console.log('PASS financial/reference/duplicate/conflicting-unit guards');
  await seed();await preview();await page.evaluate(()=>state.files[0]._worklabel='다른 직원 수정');
  const modified=await serialized();assert((await attempt()).error,'stale preview must block');assert.equal(await serialized(),modified);
  await seed();await preview();const unchanged=await serialized();
  await page.evaluate(()=>{window.savedSnapshot=hjSnapshot;hjSnapshot=async()=>null;});assert((await attempt()).error,'snapshot failure must block');assert.equal(await serialized(),unchanged);await page.evaluate(()=>hjSnapshot=savedSnapshot);
  await seed();await preview();await page.evaluate(()=>__tabStale=true);assert((await attempt()).error,'stale tab must block');await page.evaluate(()=>__tabStale=false);
  console.log('PASS stale preview, snapshot failure, stale tab');
  // Mobile and desktop real clicks; general names stay general.
  for(const width of [360,390,1280]){
    await page.setViewportSize({width,height:844});await seed();
    await page.evaluate(()=>{state.tab='photos';__photoMoreOpen=false;render();});
    if(await page.locator('#btnPhotoMore').isVisible())await page.locator('#btnPhotoMore').click();
    await page.locator('#view [data-aptbulk="project"]').click();await page.locator('#aptProjectPanel').waitFor();
    if(width===390&&process.env.HJ_APARTMENT_SCREENSHOT)await page.screenshot({path:process.env.HJ_APARTMENT_SCREENSHOT});
    assert(await page.locator('#modalRoot .modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    const small=await page.locator('#modalRoot button:visible, #modalRoot input:visible, #modalRoot select:visible').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height<44).map(e=>e.id));assert.deepEqual(small,[]);
    await page.getByLabel('위치 구분').selectOption('common');assert(await page.getByLabel('공용부 이름').isVisible());assert(!await page.getByLabel('동',{exact:true}).isVisible());
    await page.getByRole('button',{name:'취소',exact:true}).click();
  }
  await page.evaluate(()=>{$('#newProj').value='가상새아파트 105동 701호';addProject();});
  assert.equal(await page.getByLabel('아파트명',{exact:true}).inputValue(),'가상새아파트');
  await page.getByRole('button',{name:'미리보기',exact:true}).click();await page.getByRole('button',{name:'확인 후 저장',exact:true}).click();await page.locator('#aptUnitPanel').waitFor();
  assert.equal(await page.evaluate(()=>state.projects.some(p=>p.name==='가상새아파트 105동 701호')),false);
  assert.equal(await page.evaluate(()=>aptUnitList(aptUnitProject('가상새아파트'))[0].ho),'701');
  assert.deepEqual(requests,[],'workflow must not upload data');assert.deepEqual(errors,[]);
  console.log('PASS 360/390/1280px UI, actual creation/save clicks, no external data upload');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(mutation&&page)console.log('MUTATION '+mutation+' applied='+await page.evaluate(()=>!!window.apartmentMutated).catch(()=>false));
  if(browser)await browser.close();
});

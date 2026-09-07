/* v271: fake apartment records only. Unit-scoped report/TXT output must never
   change business state, read original files or perform a real download.
   HJ_PHOTO_REPORT_OUTPUT_MUTATION=unit|missingwork|stale reverts one core guard
   in the isolated page and must fail its protected assertion. */
'use strict';
const assert=require('node:assert/strict');
const {isDeepStrictEqual}=require('node:util');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const A='가상 가아파트',B='가상 나아파트',G='가상 일반현장';
const X='<img src=x onerror=__outXss=1>';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const ALL=['a-main','a-empty','a-other','a-common','a-unassigned','a-crosslink','a-missing','a-duplicate','a-invalid','a-undated','a-xss'];
const MUTATION=process.env.HJ_PHOTO_REPORT_OUTPUT_MUTATION||'';
assert(['','unit','missingwork','stale'].includes(MUTATION));
let browser,passed=0;
async function boot(width=390){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block',timezoneId:'Asia/Seoul'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[],sideEffects=[];let observe=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  page.on('download',()=>sideEffects.push('real-download'));page.on('popup',()=>sideEffects.push('popup'));
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.waitForFunction(()=>!!localStorage.getItem('hj_glance'));
  await page.evaluate(async({a,b,g,x,png,width,mutation})=>{
    await Promise.all([window.__hjRestoreDone,window.__hjRelayConfigDone,window.__hjOfficeOpsBootDone]);
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;aiOpsEnsureState().enabled=false;
    const unit=(id,dong,ho)=>({id,type:'unit',dong,ho,name:'',note:'FAKE-PRIVATE-UNIT-NOTE'});
    const common=(id,name)=>({id,type:'common',dong:'',ho:'',name,note:'FAKE-PRIVATE-COMMON-NOTE'});
    const project=(name,units)=>({name,archived:false,stage:1,received:987654321,phases:['방수','배관','미장'],cost:{material:1234567,labor:7654321,outsource:0},customer:{name:'FAKE-PRIVATE-CUSTOMER',phone:'FAKE-PRIVATE-CONTACT'},...(units?{aptUnits:units}:{})});
    state.projects=[project(a,[unit('unit-shared','101','501'),unit('unit-other','102','501'),common('common-a','지하실'),common('common-x',x),unit('unit-duplicate','103','501'),unit('unit-duplicate','104','501'),unit('unit-invalid','0','501')]),project(b,[unit('unit-shared','101','501')]),project(g)];
    let serial=100;
    const photo=(id,projectName,unitId,work,phase='방수',when='2026-09-07T01:00:00Z')=>({id,name:'가상_'+id+'.png',project:projectName,kind:'photo',ext:'png',size:++serial,when:when?new Date(when):null,_worklabel:work,_phase:phase,_virtual:true,thumb:'data:image/png;base64,'+png,...(unitId?{_aptUnit:{project:projectName,unitId}}:{})});
    state.files=[photo('a-main',a,'unit-shared','욕실 방수'),photo('a-empty',a,'unit-shared',''),photo('a-other',a,'unit-other','욕실 방수'),photo('a-common',a,'common-a','주철관 보수','배관'),
      photo('a-unassigned',a,'','  ','배관'),photo('a-crosslink',a,'unit-shared','연결 확인'),photo('a-missing',a,'no-such-unit','사라진 연결'),photo('a-duplicate',a,'unit-duplicate','중복 연결'),photo('a-invalid',a,'unit-invalid','잘못된 세대'),
      photo('a-undated',a,'unit-shared',' \n\t ','미장',null),photo('a-xss',a,'common-x',x),photo('b-main',b,'unit-shared','FAKE-OTHER-PROJECT-WORK'),photo('general',g,'','일반 작업'),photo('no-project',null,'','미배정 현장'),
      {id:'estimate',name:'가상_견적.pdf',project:a,kind:'estimate',ext:'pdf',size:333,when:null,est:{amount:55555555,date:'2026-09-01'}}];
    state.files.find(f=>f.id==='a-crosslink')._aptUnit.project=b;state.files.find(f=>f.id==='a-xss').name=x+'.png';
    state.quotes=[];state.aptOrders=[];state.aptOffices=[];state.schedule=[];state.expenses=[];state.payLog=[{id:'fake-payment',project:a,date:'2026-09-01',amount:987654321}];
    state.editingQuote=null;state.activeProject=null;state.tab='photos';state.search='';state._demo=false;state.dirHandle=null;state.dirty=false;
    __tabStale=false;__sel.clear();__sel.add('b-main');__gdToken=null;relayReady=()=>false;__mobileMode=width<600;applyMobileMode();
    window.__outXss=0;window.__outMutation=0;window.__outDirty=0;window.__outUnexpected=[];window.__outCopies=[];window.__outDownloads=[];window.__outBlobs=[];window.__outRevoked=[];
    const reject=name=>()=>{window.__outUnexpected.push(name);throw new Error('unexpected external '+name);};
    window.open=reject('window.open');window.showOpenFilePicker=reject('picker');window.showDirectoryPicker=reject('directory');if(navigator.share)navigator.share=reject('share');
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__outCopies.push(String(text))}});
    relayCall=reject('relay');portalAutoSync=reject('portal');getFileOf=reject('original');loadPhotoForExport=reject('image-before-explicit-click');geminiAsk=reject('AI');__docExport=reject('image-export');
    const create=URL.createObjectURL,revoke=URL.revokeObjectURL,anchor=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=function(blob){const url=create.call(URL,blob);window.__outBlobs.push({url,blob});return url;};
    URL.revokeObjectURL=function(url){window.__outRevoked.push(url);return revoke.call(URL,url);};
    HTMLAnchorElement.prototype.click=function(){if(this.download){window.__outDownloads.push({filename:this.download,url:this.href});return;}return anchor.apply(this,arguments);};
    taxCalendarEnsure();coworkSchedEnsure();state.dirty=false;render();clearTimeout(__idbSaveTimer);
    if(!await guardedPersistCurrentState())throw new Error('fake output fixture persistence failed');await __appStateWriteQueue;
    const dirty=markDirty;markDirty=function(){window.__outDirty++;return dirty.apply(this,arguments);};
    if(mutation==='unit'){
      const old=photoReportData.toString(),guard="if(unitFilter==='unassigned'?!!linked:unit&&linked?.id!==unit.id)return false;";
      if(!old.includes(guard))throw new Error('unit mutation guard not found');
      photoReportData=(0,eval)('('+old.replace(guard,'window.__outMutation++;')+')');
    }
    if(mutation==='missingwork'){
      const old=photoReportData.toString(),guard="if(o.missingWork===true&&String(f._worklabel||'').trim())return false;";
      if(!old.includes(guard))throw new Error('missing-work mutation guard not found');
      photoReportData=(0,eval)('('+old.replace(guard,'window.__outMutation++;')+')');
    }
    if(mutation==='stale'){
      const old=photoReportDownload.toString(),guard='||fresh.recordKey!==d.recordKey';
      if(!old.includes(guard))throw new Error('stale mutation guard not found');
      photoReportDownload=(0,eval)('('+old.replace(guard,'').replace('const fresh=','window.__outMutation++;const fresh=')+')');
    }
  },{a:A,b:B,g:G,x:X,png:PNG,width,mutation:MUTATION});
  observe=true;return{context,page,errors,requests,sideEffects,width};
}
async function run(name,fn,width=390){const t=await boot(width);try{await fn(t);assert.deepEqual(t.errors,[],'pageerror=0');assert.deepEqual(t.requests,[],'network=0');assert.deepEqual(t.sideEffects,[],'no real download/share');assert.deepEqual(await t.page.evaluate(()=>window.__outUnexpected),[]);passed++;console.log('PASS '+width+'px '+name);}finally{if(MUTATION)console.log('MUTATION '+MUTATION+' applied='+await t.page.evaluate(()=>window.__outMutation).catch(()=>0));await t.context.close();}}
const snap=page=>page.evaluate(async()=>{const d=serializeData();d.savedAt='FIXED';return{data:JSON.stringify(d),files:JSON.stringify(state.files),selected:[...__sel],dirty:state.dirty,dirtyCalls:window.__outDirty,stored:JSON.stringify(await idbGet('appState')),local:Object.fromEntries(Object.entries(localStorage))};});
async function readonly(t,before){const after=await snap(t.page);assert.deepEqual(Object.keys(before).filter(k=>!isDeepStrictEqual(before[k],after[k])),[],'report output preserves metadata, money, global selection, IDB and preferences');assert.equal(await t.page.evaluate(()=>window.__outXss),0);}
async function open(t,options={},name=A){await t.page.evaluate(({name,options})=>photoReport(name,options),{name,options});await t.page.locator('#photoReportPanel').waitFor();}
async function close(t){await t.page.keyboard.press('Escape');await t.page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
async function expectRows(t,ids){await t.page.waitForFunction(ids=>{const got=[...document.querySelectorAll('.prPhotoPick')].map(e=>e.dataset.id).sort();return JSON.stringify(got)===JSON.stringify([...ids].sort());},ids);assert.deepEqual(await t.page.locator('.prPhotoPick').evaluateAll(els=>els.map(e=>e.dataset.id).sort()),[...ids].sort());}
async function touch(t,locator){if(t.width<600)await locator.tap();else await locator.click();}
async function capture(t,name){if(!process.env.HJ_PHOTO_REPORT_OUTPUT_SCREENSHOT_DIR)return;await t.page.waitForFunction(()=>{const e=document.getElementById('toast');return !e||!e.classList.contains('show')&&Number(getComputedStyle(e).opacity)<0.01;});await t.page.screenshot({path:path.join(process.env.HJ_PHOTO_REPORT_OUTPUT_SCREENSHOT_DIR,name+'-'+t.width+'.png')});}
async function imageStub(t){await t.page.evaluate(png=>{
  window.__outLoads=[];window.__outImageUrls=[];window.__outImageRelease=null;
  loadPhotoForExport=async f=>{window.__outLoads.push(f.id);await new Promise(resolve=>window.__outImageRelease=resolve);const blob=new Blob([Uint8Array.from(atob(png),c=>c.charCodeAt(0))],{type:'image/png'}),url=URL.createObjectURL(blob),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});window.__outImageUrls.push(url);return{img,url};};
  const original=photoReportImage;photoReportImage=function(){window.__outImagePending=Promise.resolve(original.apply(this,arguments));return window.__outImagePending;};
},PNG);}
(async()=>{browser=await chromium.launch({headless:true});
  await run('동호·공용부·잘못된 연결·다른 현장 동일ID 격리',async t=>{
    const before=await snap(t.page),d=await t.page.evaluate(a=>{const take=o=>{const d=photoReportData(a,o);return{ids:d.files.map(f=>f.id).sort(),unit:d.unitFilter,label:d.unitLabel,options:d.options,error:d.error};};return{all:take({}),own:take({unitFilter:'unit:unit-shared'}),other:take({unitFilter:'unit:unit-other'}),common:take({unitFilter:'unit:common-a'}),unassigned:take({unitFilter:'unassigned'})};},A);
    assert.deepEqual(d.all.ids,[...ALL].sort());assert.deepEqual(d.own.ids,['a-empty','a-main','a-undated']);assert.deepEqual(d.other.ids,['a-other']);assert.deepEqual(d.common.ids,['a-common']);
    assert.deepEqual(d.unassigned.ids,['a-crosslink','a-duplicate','a-invalid','a-missing','a-unassigned']);assert.equal(d.own.unit,'unit:unit-shared');assert.equal(d.own.label,'101동 501호');assert.equal(d.own.options.unitFilter,d.own.unit);await readonly(t,before);
  });
  await run('작업명 미입력은 공정만 있거나 공백인 사진도 포함',async t=>{
    const before=await snap(t.page),d=await t.page.evaluate(a=>{const take=o=>{const d=photoReportData(a,o);return{ids:d.files.map(f=>f.id).sort(),missing:d.missingWork,options:d.options};};return{all:take({missingWork:true}),own:take({unitFilter:'unit:unit-shared',missingWork:true}),phase:take({missingWork:true,phase:'배관'}),dated:take({missingWork:true,includeUndated:false})};},A);
    assert.deepEqual(d.all.ids,['a-empty','a-unassigned','a-undated']);assert.deepEqual(d.own.ids,['a-empty','a-undated']);assert.deepEqual(d.phase.ids,['a-unassigned']);assert.deepEqual(d.dated.ids,['a-empty','a-unassigned']);assert.equal(d.all.missing,true);assert.equal(d.all.options.missingWork,true);await readonly(t,before);
  });
  await run('잘못된 세대필터·중복프로젝트·없는현장 안전 차단',async t=>{
    const before=await snap(t.page),bad=await t.page.evaluate(({a,g})=>({invalid:['unit:no-such-unit','unit:unit-duplicate','unit:unit-invalid','unit:','unknown',42,{}].map(unitFilter=>{const d=photoReportData(a,{unitFilter});return{total:d.total,error:!!d.error};}),plain:photoReportData(g,{unitFilter:'unit:unit-shared'}),missing:photoReportData('FAKE-NO-SUCH-PROJECT'),null:photoReportData(null)}),{a:A,g:G});
    assert(bad.invalid.every(d=>d.error&&d.total===0));assert(bad.plain.error&&bad.plain.total===0);assert.equal(bad.missing,null);assert.equal(bad.null,null);await readonly(t,before);
    await t.page.evaluate(a=>state.projects.push({...state.projects.find(p=>p.name===a)}),A);const duplicateBefore=await snap(t.page);assert.equal(await t.page.evaluate(a=>photoReportData(a,{unitFilter:'unit:unit-shared'}),A),null);await t.page.evaluate(a=>photoReport(a,{unitFilter:'unit:unit-shared'}),A);assert.equal(await t.page.locator('#photoReportPanel').count(),0);await readonly(t,duplicateBefore);
  });
  await run('기록 글은 동호별로 구분하고 연락처·금액·메모 제외',async t=>{
    const before=await snap(t.page),text=await t.page.evaluate(a=>photoReportText(a,photoReportData(a)),A);
    for(const fragment of ['101동 501호','102동 501호','지하실','동·호수 미지정','작업명 미입력','욕실 방수','주철관 보수'])assert(text.includes(fragment),fragment);
    assert(text.includes('[101동 501호] 욕실 방수')&&text.includes('[102동 501호] 욕실 방수'),'same work in different units remains separately grouped');
    for(const secret of ['FAKE-PRIVATE','987654321','1234567','7654321','55555555','FAKE-OTHER-PROJECT-WORK'])assert(!text.includes(secret),secret+' must not be appended');
    await open(t,{unitFilter:'unit:common-x'});await expectRows(t,['a-xss']);assert.equal(await t.page.locator('#photoReportPanel img[src="x"]').count(),0);assert((await t.page.locator('#prText').inputValue()).includes(X));await close(t);await readonly(t,before);
  });
  await run('동호 필터·작업명 미입력·선택 프루닝·초기화는 조회만',async t=>{
    const before=await snap(t.page);await open(t);for(const id of ['a-main','a-other','a-common'])await t.page.locator('.prPhotoPick[data-id="'+id+'"]').check();
    await t.page.locator('#prUnit').selectOption('unit:unit-shared');await expectRows(t,['a-main','a-empty','a-undated']);assert.deepEqual(await t.page.locator('.prPhotoPick:checked').evaluateAll(els=>els.map(e=>e.dataset.id)),['a-main']);
    await t.page.locator('#prMissingWork').check();await expectRows(t,['a-empty','a-undated']);assert.equal(await t.page.locator('.prPhotoPick:checked').count(),0);assert((await t.page.locator('#prText').inputValue()).includes('작업명 미입력 사진만'));
    await t.page.locator('#prUnit').selectOption('unassigned');await expectRows(t,['a-unassigned']);await t.page.locator('#prReset').click();await expectRows(t,ALL);assert.equal(await t.page.locator('#prUnit').inputValue(),'');assert.equal(await t.page.locator('#prMissingWork').isChecked(),false);assert.equal(await t.page.locator('.prPhotoPick:checked').count(),0);
    await t.page.locator('#prQuery').fill('FAKE-NO-MATCH');await expectRows(t,[]);assert(await t.page.locator('#prSaveText').isDisabled());await t.page.locator('#prReset').click();await expectRows(t,ALL);await close(t);await readonly(t,before);
  });
  await run('세대 관리에서 현재 동호 및 미지정 사진일지 바로 진입',async t=>{
    const before=await snap(t.page);await t.page.evaluate(a=>aptUnitView(a,'unit-shared'),A);await t.page.locator('#aptUnitReport').waitFor();await touch(t,t.page.locator('#aptUnitReport'));await expectRows(t,['a-main','a-empty','a-undated']);assert.equal(await t.page.locator('#prUnit').inputValue(),'unit:unit-shared');await close(t);
    await t.page.evaluate(a=>aptUnitView(a),A);await t.page.locator('#aptUnitReport').waitFor();await touch(t,t.page.locator('#aptUnitReport'));await expectRows(t,['a-unassigned','a-crosslink','a-missing','a-duplicate','a-invalid']);assert.equal(await t.page.locator('#prUnit').inputValue(),'unassigned');await close(t);await readonly(t,before);
  });
  await run('명시 TXT 저장은 조회 전체글·UTF8 BOM·파일명·URL 회수',async t=>{
    const before=await snap(t.page);await open(t,{unitFilter:'unit:unit-shared',missingWork:true});await expectRows(t,['a-empty','a-undated']);const text=await t.page.locator('#prText').inputValue();
    assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[]);await t.page.locator('.prPhotoPick[data-id="a-empty"]').check();await touch(t,t.page.locator('#prSaveText'));
    await t.page.waitForFunction(()=>window.__outDownloads.length===1);const output=await t.page.evaluate(async()=>{const d=window.__outDownloads[0],entry=window.__outBlobs.find(x=>x.url===d.url);return{...d,type:entry.blob.type,bytes:[...new Uint8Array(await entry.blob.arrayBuffer())]};});
    assert.deepEqual(output.bytes.slice(0,3),[239,187,191]);assert.equal(Buffer.from(output.bytes.slice(3)).toString('utf8'),text.replace(/\r?\n/g,'\r\n').replace(/(?:\r\n)*$/,'')+'\r\n');
    assert(output.filename.endsWith('.txt')&&output.filename.includes(A)&&output.filename.includes('사진작업일지')&&/\d{4}-\d{2}-\d{2}/.test(output.filename));assert(!/[\\/:*?"<>|]/.test(output.filename));assert(/^text\/plain/i.test(output.type));
    await t.page.waitForFunction(()=>window.__outDownloads.every(d=>window.__outRevoked.includes(d.url)));assert.deepEqual(await t.page.evaluate(()=>window.__outCopies),[]);await close(t);await readonly(t,before);
  });
  await run('저장 직전 세대 연결 변경은 오래된 글 반출 차단·목록 재조회',async t=>{
    await open(t,{unitFilter:'unit:unit-shared'});await expectRows(t,['a-main','a-empty','a-undated']);await t.page.evaluate(()=>state.files.find(f=>f.id==='a-main')._aptUnit.unitId='unit-other');const before=await snap(t.page);
    await touch(t,t.page.locator('#prSaveText'));assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[],'stale unit-linked preview must not download');await expectRows(t,['a-empty','a-undated']);await close(t);await readonly(t,before);
  });
  await run('직접 TXT 호출도 레코드 스냅샷 변경·중복 현장 거절',async t=>{
    const result=await t.page.evaluate(async a=>{const stale=photoReportData(a,{unitFilter:'unit:unit-shared'}),key=stale.recordKey;state.files.find(f=>f.id==='a-main')._worklabel='가상 변경된 작업';let error='';try{await photoReportDownload(a,stale);}catch(e){error=String(e.message||e);}return{error,keyStill:stale.recordKey===key,keyChanged:photoReportData(a,stale.options).recordKey!==key};},A);
    assert(result.error&&result.keyStill&&result.keyChanged,'recordKey is immutable and stale direct output is rejected');assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[]);
    const duplicate=await t.page.evaluate(async a=>{const d=photoReportData(a);state.projects.push({...state.projects.find(p=>p.name===a)});try{await photoReportDownload(a,d);return false;}catch(_){return true;}},A);assert(duplicate);assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[]);
  });
  await run('이미지 준비 중 다른 세대로 이동한 사진은 늦은 결과 차단',async t=>{
    await imageStub(t);await open(t,{unitFilter:'unit:unit-shared'});await t.page.locator('.prPhotoPick[data-id="a-main"]').check();await t.page.locator('#prImg').click();await t.page.waitForFunction(()=>typeof window.__outImageRelease==='function');
    await t.page.evaluate(()=>state.files.find(f=>f.id==='a-main')._aptUnit.unitId='unit-other');const before=await snap(t.page);
    await t.page.evaluate(async()=>{window.__outImageRelease();try{await window.__outImagePending;}catch(_){}});assert.equal(await t.page.locator('#prImageCanvas').count(),0,'unit reassignment invalidates pending image');assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[]);assert(await t.page.evaluate(()=>window.__outImageUrls.length===1&&window.__outImageUrls.every(url=>window.__outRevoked.includes(url))));await close(t);await readonly(t,before);
  });
  await run('위치관리 도입 stale·세대명 갱신·1000장 집계 검증횟수',async t=>{
    const transition=await t.page.evaluate(async g=>{const d=photoReportData(g),oldText=photoReportText(g,d);state.projects.find(p=>p.name===g).aptUnits=[];const fresh=photoReportData(g);let rejected=false;try{await photoReportDownload(g,d);}catch(_){rejected=true;}return{rejected,keyChanged:fresh.recordKey!==d.recordKey,textChanged:photoReportText(g,fresh)!==oldText};},G);
    assert(transition.rejected&&transition.keyChanged&&transition.textChanged,'introducing managed units invalidates the previous unmanaged report');assert.deepEqual(await t.page.evaluate(()=>window.__outDownloads),[]);
    await open(t,{unitFilter:'unit:unit-shared'});await t.page.evaluate(a=>state.projects.find(p=>p.name===a).aptUnits.find(u=>u.id==='unit-shared').dong='109',A);const renamedBefore=await snap(t.page);
    await t.page.locator('#prQuery').fill('욕실');await expectRows(t,['a-main']);assert.equal(await t.page.locator('#prUnit option[value="unit:unit-shared"]').textContent(),'109동 501호');assert((await t.page.locator('#prText').inputValue()).includes('109동 501호'));await close(t);await readonly(t,renamedBefore);
    await t.page.evaluate(()=>{const base=state.files.find(f=>f.id==='a-main');for(let i=0;i<1000;i++)state.files.push({...base,id:'fake-bulk-'+i,name:'가상_성능검사_'+i+'.png',size:10000+i});});const bulkBefore=await snap(t.page);
    const counts=await t.page.evaluate(a=>{let count=0;const original=aptUnitList;aptUnitList=function(){count++;return original.apply(this,arguments);};try{const d=photoReportData(a),text=photoReportText(a,d);return{count,total:d.total,hasText:text.includes('사진 작업일지')};}finally{aptUnitList=original;}},A);
    assert.equal(counts.total,1011);assert(counts.hasText&&counts.count>0&&counts.count<=2,'data+text validates the unit list once instead of per photo');await readonly(t,bulkBefore);
  });
  for(const width of [320,390,1280])await run('동호·저장 UI 터치·명칭·44px·가로 잘림 없음',async t=>{
    const before=await snap(t.page);await open(t,{unitFilter:'unit:unit-shared'});await expectRows(t,['a-main','a-empty','a-undated']);
    assert.equal(await t.page.locator('#prUnit').inputValue(),'unit:unit-shared');await touch(t,t.page.locator('#prMissingWork').locator('..'));await expectRows(t,['a-empty','a-undated']);
    const bad=await t.page.locator('#modalRoot button:visible,#photoReportPanel select:visible,#photoReportPanel input:not([type=checkbox]):visible').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,w:r.width,h:r.height,named:!!(e.getAttribute('aria-label')||e.labels?.length||e.textContent.trim())};}).filter(x=>x.w<43.5||x.h<43.5||!x.named));assert.deepEqual(bad,[],'all controls have labels and 44px targets');
    const overflow=await t.page.locator('#photoReportPanel,#prResults,#prText,#prUnit,#prSaveText').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,left:r.left,right:r.right,scroll:e.scrollWidth,client:e.clientWidth};}).filter(r=>r.left< -1||r.right>innerWidth+1||r.scroll>r.client+2));assert.deepEqual(overflow,[]);
    await t.page.locator('#prUnit').scrollIntoViewIfNeeded();await capture(t,'photo-report-units');await t.page.locator('#prSaveText').scrollIntoViewIfNeeded();await capture(t,'photo-report-output');
    await close(t);assert.equal(await t.page.evaluate(()=>document.body.classList.contains('modal-open')),false);await readonly(t,before);
  },width);
  console.log('== photo-report-output: '+passed+' passed; pageerrors=0; real exports/network=0 ==');await browser.close();
})().catch(async e=>{console.error('FAIL photo-report-output',e);if(browser)await browser.close();process.exitCode=1;});

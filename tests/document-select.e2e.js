/* v338: disposable IDB and synthetic files only. No business files, uploads or real accounts.
   HJ_DOCUMENT_SELECT_MUTATION=append|storage|settlement|source|move must trip the named protection. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;try{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}catch(_){({chromium}=require('playwright'));}
const {waitForTouchLayout}=require('./test-stability-fixture');
const APP='http://127.0.0.1:8299/index.html',ORIGIN=new URL(APP).origin;
const MUTATION=process.env.HJ_DOCUMENT_SELECT_MUTATION||'';
assert(['','append','storage','settlement','source','move'].includes(MUTATION));
const A='가상 가아파트',B='가상 나아파트';let browser,passed=0;
function mutatedSource(){
  let source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const replacements={
    append:["d.files.push(serializeData({...d,files:[rec]},at).files[0]);","d.files=[serializeData({...d,files:[rec]},at).files[0]];d._savedFileCount=0;"],
    storage:["if(!(blob instanceof File)||blob.name!==p.file.name||blob.size!==p.file.size)throw new Error('원본 보관을 확인하지 못했습니다. 목록에는 등록하지 않았습니다.');","/* synthetic removal of original verification */"],
    settlement:["function documentRoleKind(role){return ['estimate','bizreg','card','drawing'].includes(role)?role:'other';}","function documentRoleKind(role){return role==='settlement'?'estimate':(['estimate','bizreg','card','drawing'].includes(role)?role:'other');}"],
    source:["if(!strong&&!exact)return false; // 이름·크기 폴백은 수동 항목/기기 원본의 신원이 아니다.","/* synthetic removal of manual source identity guard */"],
    move:["if(item&&(f.kind==='estimate')!==(item.role==='estimate'))throw new Error('견적서는 견적 항목 안에서만 이동하세요. 정산서로 변경해 집계를 바꾸지 않습니다.');","/* synthetic removal of financial kind guard */"]
  };
  if(MUTATION){const [from,to]=replacements[MUTATION];assert(source.includes(from)&&source.indexOf(from)===source.lastIndexOf(from),'unique mutation anchor');source=source.replace(from,to);}
  return source;
}
async function boot(width=390,empty=false){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],requests=[];let observe=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(observe&&!/^(data:|blob:)/.test(r.url()))requests.push(r.url());});
  const gis=page.waitForEvent('requestfailed',{predicate:r=>r.url()==='https://accounts.google.com/gsi/client',timeout:25000});
  await context.route('**/*',r=>new URL(r.request().url()).origin===ORIGIN?r.continue():r.abort());
  if(MUTATION)await page.route(APP,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:mutatedSource()}));
  await page.addInitScript(()=>{localStorage.setItem('hj_onboard_done','1');localStorage.setItem('hj_ver_checked_at',String(Date.now()));});
  await page.goto(APP,{waitUntil:'domcontentloaded'});await gis;
  await page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayConfigDone&&window.__hjOfficeOpsBootDone);
  await page.evaluate(async({a,b,empty,mutation})=>{
    await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone]);
    taxCalendarEnsure=()=>0;coworkSchedEnsure=()=>false;backupBootCheck=()=>{};kakaoCheckNew=()=>{};aiOpsEnsureState().enabled=false;
    clearTimeout(__idbSaveTimer);await __appStateWriteQueue;
    state.projects=[a,b].map(name=>({name,stage:1,received:321,phases:[],cost:{material:11,labor:22,outsource:0},customer:{}}));
    state.quotes=[];state.schedule=[];state.aptOrders=[];state.payLog=[{id:'fake-pay',project:a,date:'2026-10-01',amount:321}];state.expenses=[];
    state.files=empty?[]:[{id:'fake-old',name:'가상 기존 서류.pdf',prefix:'원래 폴더/',kind:'other',size:41,ext:'pdf',project:a,when:null,text:'보존해야 하는 메모',ocr:'done',_driveId:'FAKE-DRIVE-OLD',_driveMimeType:'application/pdf',_driveSize:41,_virtual:true},
      {id:'fake-est',name:'가상 기존 견적.pdf',prefix:'견적서/',kind:'estimate',size:43,ext:'pdf',project:a,when:null,est:{amount:999,supply:900,vat:99,customer:'가상 고객',date:'2026-10-01',_edited:true},text:'기존 수동 금액',ocr:'done',_virtual:true}];
    state.brand={color:'#0b4ea2',unknownKeep:{fake:true}};state._demo=false;state.editingQuote=null;state.activeProject=null;state.tab='docs';state.search='';state.dirHandle=null;state.dirty=false;
    __tabStale=false;__documentSelection.clear();__documentItemFilter='all';__documentBusy=false;relayReady=()=>false;
    window.__docCalls=[];window.__docReads=0;window.__docNativeFileOf=getFileOf;window.__docMutationApplied=0;window.__docXss=0;
    relayCall=async()=>{__docCalls.push('relay');throw new Error('unexpected relay');};gdMoveToKindFolder=async()=>{__docCalls.push('drive-move');return true;};portalAutoSync=()=>__docCalls.push('portal');
    const native=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=function(){__docReads++;return native.call(this);};
    render();if(!await guardedPersistCurrentState())throw new Error('fixture persistence failed');await __appStateWriteQueue;
    window.__docFinance=JSON.stringify({projects:state.projects,pay:state.payLog,expenses:state.expenses,orders:state.aptOrders,quotes:state.quotes,old:serializeData().files});
  },{a:A,b:B,empty,mutation:MUTATION});observe=true;return{context,page,errors,requests,width,setObserve:value=>observe=value};
}
async function run(name,fn,width=390,empty=false){const t=await boot(width,empty);try{await fn(t);assert.deepEqual(t.errors,[],'page errors');assert.deepEqual(await t.page.evaluate(()=>__docCalls),[],'no Drive/portal/relay writes');assert.deepEqual(t.requests,[],'no external requests');passed++;console.log('PASS '+name);}catch(e){console.error('FAIL CASE '+name);throw e;}finally{await t.context.close();}}
const attempt=(page,js,arg)=>page.evaluate(async({js,arg})=>{try{return{result:await window.eval(js)(arg)};}catch(e){return{error:e.message};}},{js,arg});
const register=(page,role='contract',name='가상 신규 계약.pdf',bytes='SYNTHETIC-DOC')=>attempt(page,"async a=>documentRegister([new File([a.bytes],a.name,{type:'application/pdf',lastModified:Date.parse('2026-10-01T03:00:00Z')})],a.role,a.project)",{role,name,bytes,project:A});
const snapshot=page=>page.evaluate(async()=>({data:JSON.stringify({...serializeData(),savedAt:''}),stored:JSON.stringify((await resolvePaidCommitState()).data),ids:state.files.map(f=>f.id)}));
async function oldPreserved(t){const r=await t.page.evaluate(()=>{const before=JSON.parse(__docFinance);return{before,after:JSON.parse(JSON.stringify({projects:state.projects,pay:state.payLog,expenses:state.expenses,orders:state.aptOrders,quotes:state.quotes,old:serializeData().files.slice(0,before.old.length)}))};});assert.deepEqual(r.after,r.before,'append preserves existing records and money');}
async function close(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#modalRoot .modal')&&!window.__mobileSheetHistoryRetire);}
(async()=>{browser=await chromium.launch({headless:true});
  await run('empty-docs exposes selected import and item creation',async t=>{await t.page.locator('[data-document-import="other"]').click();await t.page.locator('#documentRegisterFiles').waitFor();await close(t.page);assert.equal(await t.page.locator('[data-document-create]').count(),1);},390,true);
  await run('append persistence and zero automatic file reads',async t=>{assert.deepEqual(await register(t.page),{result:1});assert.equal(await t.page.evaluate(()=>__docReads),0,'import does not OCR/parse/thumbnail bytes');await oldPreserved(t);const r=await t.page.evaluate(async()=>{const f=state.files.at(-1),blob=await getFileOf(f),saved=(await resolvePaidCommitState()).data;return{bytes:await blob.text(),meta:f.documentMeta,count:saved.files.length,keys:Object.keys(saved).length,kind:f.kind};});assert.equal(r.bytes,'SYNTHETIC-DOC');assert.equal(r.kind,'other');assert.equal(r.count,3);assert.equal(r.keys,41);assert.equal(r.meta.role,'contract');});
  await run('original storage failure leaves metadata unchanged',async t=>{const before=await snapshot(t.page);await t.page.evaluate(()=>{documentStoreOriginals=async()=>{throw new Error('FAKE quota');};});assert.match((await register(t.page)).error,/quota/);assert.deepEqual(await snapshot(t.page),before);});
  await run('missing original verification cannot report success',async t=>{const before=await snapshot(t.page);await t.page.evaluate(()=>{idbGetStrict=async key=>key.startsWith('document_blob:')?undefined:null;});assert.match((await register(t.page)).error,/원본 보관/);assert.deepEqual(await snapshot(t.page),before);});
  await run('snapshot failure writes no original or index',async t=>{const before=await snapshot(t.page);await t.page.evaluate(()=>{hjSnapshot=async()=>false;documentStoreOriginals=async()=>{__docCalls.push('unexpected-store');};});assert.match((await register(t.page)).error,/안전판|required snapshot/);assert.deepEqual(await snapshot(t.page),before);});
  await run('file chooser cancel and unchecked file perform no registration',async t=>{const before=await snapshot(t.page);await t.page.locator('[data-document-import="other"]').click();await t.page.locator('#documentRegisterFiles').setInputFiles({name:'가상 선택 취소.pdf',mimeType:'application/pdf',buffer:Buffer.from('SYNTHETIC-CANCEL')});await t.page.locator('[data-document-pick]').uncheck();await t.page.getByRole('button',{name:'선택 파일 등록',exact:true}).click();await t.page.locator('[data-document-error]').filter({hasText:'1~50'}).waitFor();assert.deepEqual(await snapshot(t.page),before);await close(t.page);});
  await run('settlement never becomes accounting estimate or photo',async t=>{assert.deepEqual(await register(t.page,'settlement','가상 합계금액 정산서.pdf'),{result:1});const r=await t.page.evaluate(async()=>{const f=state.files.at(-1);f.text='공급가액 합계금액 견적 금액';const kind=classify(f);f.ocr='pending';let reads=0;pdfText=async()=>{reads++;return 'unexpected';};await runBatchOCR();const data=serializeData();state.files=[];applyData(data,{revert:true});const restored=state.files.find(f=>f.name.includes('정산서'));return{kind,reads,restored:restored.kind,sales:salesEstimateFiles().map(f=>f.name)};});assert.equal(r.kind,'other','manual settlement role must win');assert.equal(r.restored,'other');assert.equal(r.reads,0);assert.deepEqual(r.sales,['가상 기존 견적.pdf']);});
  await run('document photo survives exact hydration and legacy restore',async t=>{const r=await attempt(t.page,"async a=>documentRegister([new File(['FAKE-IMAGE'],'가상 계약.jpg',{type:'image/jpeg',lastModified:12345})],'contract',a)",A);assert.deepEqual(r,{result:1});const result=await t.page.evaluate(()=>{const d=serializeData();applyPaidCommittedState(d);const exact=state.files.at(-1).kind;state.files=[];applyData(d,{revert:true});return{exact,legacy:state.files.at(-1).kind,classification:classify(state.files.at(-1))};});assert.deepEqual(result,{exact:'other',legacy:'other',classification:'other'});});
  await run('selected restore keeps document role and original cache consistent',async t=>{
    assert.deepEqual(await attempt(t.page,"async a=>documentRegister([new File(['FAKE-IMAGE'],'가상 계약.jpg',{type:'image/jpeg',lastModified:12345})],'contract',a)",A),{result:1});
    const r=await t.page.evaluate(()=>{const f=state.files.at(-1),source=f.documentMeta.localBlobId,saved=serializeData().files.at(-1);delete saved.documentMeta;hjApplySavedFileFields(f,saved,true,true);return{kind:f.kind,role:f.documentMeta.role,same:f.documentMeta.localBlobId===source};});assert.deepEqual(r,{kind:'other',role:'contract',same:true});
  });
  await run('category creation preserves brand and rejects duplicates',async t=>{const result=await attempt(t.page,"async ()=>documentCreateItem('가상 보험 제출','other')");assert.match(result.result,/^doc_/);const before=await snapshot(t.page);assert.match((await attempt(t.page,"async ()=>documentCreateItem('가상 보험 제출','other')")).error,/같은 이름/);assert.deepEqual(await snapshot(t.page),before);assert.deepEqual(await t.page.evaluate(()=>({color:state.brand.color,unknown:state.brand.unknownKeep,items:state.brand.documentItems.length})),{color:'#0b4ea2',unknown:{fake:true},items:1});});
  await run('same name and size never overwrite or attach another original',async t=>{assert.deepEqual(await register(t.page),{result:1});const before=await snapshot(t.page),r=await register(t.page,'contract','가상 신규 계약.pdf','DIFFERENT-DOC');assert.match(r.error,/같은 이름·크기/,'same name/size collision must be rejected');assert.deepEqual(await snapshot(t.page),before);assert.equal(await t.page.evaluate(async()=>await(await getFileOf(state.files.at(-1))).text()),'SYNTHETIC-DOC');});
  await run('metadata-only moves preserve original paths, Drive IDs and amounts',async t=>{const r=await attempt(t.page,"async a=>documentMove(state.files.map(fileKey),'',a)",B);assert.deepEqual(r,{result:2});const after=await t.page.evaluate(()=>({old:serializeData().files.map(f=>({name:f.name,prefix:f.prefix,project:f.project,driveId:f.driveId,est:f.est})),finance:{projects:state.projects,pay:state.payLog}}));assert(after.old.every(f=>f.project===B));assert.equal(after.old[0].prefix,'원래 폴더/');assert.equal(after.old[0].driveId,'FAKE-DRIVE-OLD');assert.equal(after.old[1].est.amount,999,'move preserves estimate money');const saved=await t.page.evaluate(async()=>{const d=(await resolvePaidCommitState()).data;applyPaidCommittedState(d);return state.files.map(f=>f.project);});assert.deepEqual(saved,[B,B]);});
  await run('financial kind change and derived quote are blocked',async t=>{const before=await snapshot(t.page);assert.match((await attempt(t.page,"async a=>documentMove([fileKey(state.files.find(f=>f.kind==='estimate'))],'settlement',a)",B)).error,/견적 항목/);assert.deepEqual(await snapshot(t.page),before);await t.page.evaluate(()=>{state.files.push({id:'quote_fake',name:'가상 앱 견적.pdf',kind:'estimate',_fromQuote:true,size:0,prefix:''});});assert.equal(await t.page.evaluate(()=>documentMovable(state.files.at(-1))),false);});
  await run('manual null project and category survive exact rescan only',async t=>{assert.deepEqual(await register(t.page,'settlement','가상 정산.pdf'),{result:1});await attempt(t.page,"async ()=>documentMove([fileKey(state.files.at(-1))],'contract',null)");const r=await t.page.evaluate(async()=>{const old=state.files.at(-1);backupUserEdits();const f=new File(['SYNTHETIC-DOC'],old.name,{type:'application/pdf',lastModified:Date.parse(old.sourceModifiedAt)}),same=await ingestFile(f,null,''),different=await ingestFile(f,null,'다른 원본 폴더/');return{old:old.documentMeta,same:same.documentMeta,kind:same.kind,project:same.project,different:different.documentMeta||null};});assert.deepEqual(r.same,r.old);assert.equal(r.project,null);assert.equal(r.kind,'other');assert.equal(r.different,null,'name-only fallback must not attach Blob ID');});
  await run('applyData scan path does not bind another same-name original',async t=>{
    assert.deepEqual(await register(t.page),{result:1});const r=await t.page.evaluate(async()=>{
      const original=state.files.at(-1),data=serializeData();state.files=[];
      const wrong=await ingestFile(new File(['DIFFERENT-DOC'],original.name,{type:'application/pdf',lastModified:Date.parse(original.sourceModifiedAt)}),null,'다른 폴더/',{restoreEdits:false});
      window.__scanFresh=true;window.__pruneOff=false;window.__walkNames=new Set([wrong.name.toLowerCase()]);applyData(data);window.__scanFresh=false;
      const restored=state.files.find(f=>f.documentMeta?.localBlobId===original.documentMeta.localBlobId);
      return{wrong:wrong.documentMeta||null,wrongBytes:await(await getFileOf(wrong)).text(),rightPrefix:restored?.prefix,rightBytes:restored?await(await getFileOf(restored)).text():null};
    });assert.equal(r.wrong,null);assert.equal(r.wrongBytes,'DIFFERENT-DOC');assert.equal(r.rightPrefix,'');assert.equal(r.rightBytes,'SYNTHETIC-DOC');
  });
  await run('category-only batch retains each project and originals',async t=>{
    await attempt(t.page,"async a=>documentMove([fileKey(state.files[0])],'',a)",B);
    const r=await attempt(t.page,"async ()=>documentMove([fileKey(state.files[0])],'bank',undefined)");assert.deepEqual(r,{result:1});
    const f=await t.page.evaluate(()=>({project:state.files[0].project,prefix:state.files[0].prefix,drive:state.files[0]._driveId,role:state.files[0].documentMeta.role}));assert.deepEqual(f,{project:B,prefix:'원래 폴더/',drive:'FAKE-DRIVE-OLD',role:'bank'});
  });
  await run('CAS conflict leaves original safely stored and no new live record',async t=>{
    const r=await t.page.evaluate(async a=>{const old=serializeData(),native=documentStoreOriginals;let blobId='';documentStoreOriginals=async pairs=>{await native(pairs);blobId=pairs[0].blobId;const competing={...old,savedAt:new Date(Date.parse(old.savedAt)+60000).toISOString()};await idbSet('appState',competing);};let error='';try{await documentRegister([new File(['FAKE-CAS'],'가상 경합.pdf')],'contract',a);}catch(e){error=e.message;}return{error,count:state.files.length,blob:await(await idbGetStrict('document_blob:'+blobId)).text(),storedFiles:(await idbGetStrict('appState')).files.length};},A);
    assert.match(r.error,/conflict/);assert.equal(r.count,2);assert.equal(r.storedFiles,2);assert.equal(r.blob,'FAKE-CAS');
  });
  await run('post-commit UI failure keeps cached original for reload recovery',async t=>{
    const r=await t.page.evaluate(async a=>{const native=applyPaidCommittedState;applyPaidCommittedState=()=>{throw new Error('FAKE apply failure');};let error='';try{await documentRegister([new File(['FAKE-COMMIT'],'가상 저장 후 오류.pdf')],'contract',a);}catch(e){error=e.message;}finally{applyPaidCommittedState=native;}const saved=(await resolvePaidCommitState()).data,f=saved.files.at(-1),blob=await idbGetStrict('document_blob:'+f.documentMeta.localBlobId);applyPaidCommittedState(saved);return{error,bytes:await blob.text(),count:state.files.length,name:state.files.at(-1).name};},A);
    assert.match(r.error,/화면 갱신|FAKE apply/);assert.equal(r.bytes,'FAKE-COMMIT');assert.equal(r.count,3);assert.equal(r.name,'가상 저장 후 오류.pdf');
  });
  await run('refresh restores original lazily without Google login',async t=>{
    assert.deepEqual(await register(t.page),{result:1});const name=await t.page.evaluate(()=>state.files.at(-1).name);
    // Reload reruns the app's unchanged startup CDN scripts; measure the feature read after startup.
    t.setObserve(false);await t.page.reload({waitUntil:'load'});await t.page.waitForFunction(()=>window.__hjRestoreDone&&window.__hjRelayBootDone);
    await t.page.evaluate(async()=>{await Promise.all([__hjRestoreDone,__hjRelayConfigDone,__hjOfficeOpsBootDone,__hjRelayBootDone]);window.__docCalls=[];gdGetToken=async()=>{__docCalls.push('auth');throw new Error('unexpected auth');};});t.setObserve(true);
    const r=await t.page.evaluate(async name=>{const f=state.files.find(f=>f.name===name),blob=await getFileOf(f);return{kind:f.kind,virtual:f._virtual,preview:canPreviewFile(f),bytes:await blob.text(),local:!!f.documentMeta.localBlobId};},name);
    assert.deepEqual(r,{kind:'other',virtual:true,preview:true,bytes:'SYNTHETIC-DOC',local:true});
  });
  await run('stale, demo, editor and closed form fail closed',async t=>{const before=await snapshot(t.page);for(const flag of ['__tabStale','state._demo','state.editingQuote']){await t.page.evaluate(flag=>window.eval(flag+'=true'),flag);assert((await register(t.page)).error);await t.page.evaluate(flag=>window.eval(flag+'=false'),flag);}assert((await attempt(t.page,"async a=>documentRegister([new File(['FAKE'],'가상.pdf')],'contract',a,()=>false)",A)).error);assert.deepEqual(await snapshot(t.page),before);});
  await run('unsupported-preview document can download unchanged local original',async t=>{
    const r=await attempt(t.page,"async a=>documentRegister([new File(['SYNTHETIC-HWP'],'가상 등록 서류.hwp',{type:'application/haansofthwp'})],'other',a)",A);assert.deepEqual(r,{result:1});
    const before=await snapshot(t.page),downloadEvent=t.page.waitForEvent('download');await t.page.locator('[data-document-download]').click();const download=await downloadEvent;assert.equal(download.suggestedFilename(),'가상 등록 서류.hwp');assert.equal(fs.readFileSync(await download.path(),'utf8'),'SYNTHETIC-HWP');assert.deepEqual(await snapshot(t.page),before);
  });
  await run('late original write cannot overwrite current data',async t=>{const r=await t.page.evaluate(async a=>{const native=documentStoreOriginals;documentStoreOriginals=async pairs=>{await native(pairs);state.files[0].text='그사이 변경된 메모';};let error='';try{await documentRegister([new File(['FAKE'],'가상 늦은.pdf')],'contract',a);}catch(e){error=e.message;}return{error,count:state.files.length,text:state.files[0].text};},A);assert.match(r.error,/변경/);assert.equal(r.count,2);assert.equal(r.text,'그사이 변경된 메모');});
  await run('explicit estimate read touches selected file only and preserves edited money',async t=>{const r=await t.page.evaluate(async()=>{let reads=[];pdfText=async f=>{reads.push(f.name);return '견적 금액 1,234원';};const selected=state.files.find(f=>f.kind==='estimate');const n=await documentReadEstimates([fileKey(selected)]);return{n,reads,amount:state.files.find(f=>f.name===selected.name).est.amount};});assert.deepEqual(r,{n:1,reads:['가상 기존 견적.pdf'],amount:999});});
  await run('xlsx selected-file integration uses local Blob and existing quote parser',async t=>{
    const r=await t.page.evaluate(async a=>{await documentRegister([new File(['SYNTHETIC-XLSX'],'가상 선택 견적.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})],'estimate',a);let reads=0;window.XLSX={read:bytes=>{reads++;if(new TextDecoder().decode(bytes)!=='SYNTHETIC-XLSX')throw new Error('wrong original');return{SheetNames:['Sheet1'],Sheets:{Sheet1:{}}};},utils:{sheet_to_json:()=>[['품명','규격','수량','단가','금액'],['가상 방수','합성 규격',1,1000,1000]]}};const n=await documentReadEstimates([fileKey(state.files.at(-1))]);return{n,reads,kind:state.files.at(-1).kind,text:state.files.at(-1).text,items:state.files.at(-1).quote?.items.length};},A);
    assert.equal(r.n,1);assert.equal(r.reads,1);assert.equal(r.kind,'estimate');assert(r.text.includes('가상 방수'));assert.equal(r.items,1);
  });
  for(const width of [320,390,1280])await run('responsive UI and safe item names '+width,async t=>{
    await attempt(t.page,"async ()=>documentCreateItem('<img src=x onerror=__docXss=1>','contract')");
    await t.page.locator('.document-items summary').click();assert.equal(await t.page.evaluate(()=>__docXss),0);assert.equal(await t.page.locator('.document-items img').count(),0);
    await t.page.locator('[data-document-import="settlement"]').click();await waitForTouchLayout(t.page,'#modalRoot button,#modalRoot select,#modalRoot input[type=file]');
    const sizes=await t.page.locator('#modalRoot button:visible,#modalRoot select:visible').evaluateAll(els=>els.map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width})));assert(sizes.every(s=>s.h>=44&&s.w>=44),'44px touch targets');
    assert.equal(await t.page.locator('#modalRoot .modal').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'modal has no horizontal overflow');
    if(process.env.HJ_DOCUMENT_SELECT_SCREENSHOT_DIR)await t.page.screenshot({path:path.join(process.env.HJ_DOCUMENT_SELECT_SCREENSHOT_DIR,'document-register-'+width+'.png')});await close(t.page);
    assert.equal(await t.page.locator('.documents-view').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'documents have no horizontal overflow');
  },width);
  console.log('== document-select: '+passed+' passed ==');await browser.close();
})().catch(async e=>{console.error('FAIL document-select',e);if(browser)await browser.close();process.exitCode=1;});

/* In-memory Apps Script contract double. No production URL, disk data, or account. */
'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {harness}=require('./shared-todo-server.unit.js');
const URL='https://script.google.com/macros/s/AKfyTEST_SHARED/exec';
const TOKEN='TEST-SHARED-TODO-TOKEN-NOT-A-CREDENTIAL';
const VERSION='shared-todo-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
function createSharedTodoMock(){
  const tasks=new Map(),receipts=new Map(),calls=[],faults=new Map(),holds=[];
  let storeRevision=0;
  const api=harness();api.props.APP_TOKEN=TOKEN;
  const sandbox=api.context;
  function inject(device,action,kind){faults.set(device+'|'+action,kind);}
  function count(action){return calls.filter(x=>x.action===action).length;}
  function active(){return [...tasks.values()].filter(x=>!x.deleted).map(clone);}
  function result(req){
    // Run the shipping module itself so UI and server request/receipt rules cannot drift.
    const response=clone(sandbox.sharedTodoHandle_(req.action,{token:TOKEN,ts:Date.now(),...req}));
    api.assertUnlocked();
    if(api.storedFile()){
      const stored=api.stored();storeRevision=stored.revision;tasks.clear();receipts.clear();
      stored.tasks.forEach(task=>tasks.set(task.id,task));stored.receipts.forEach(receipt=>receipts.set(receipt.requestId,receipt));
    }
    return response;
  }
  async function handle(route){
    const request=route.request();
    assert.equal(request.url(),URL,'credentials cannot enter query strings or alternate endpoints');
    assert.equal(request.method(),'POST','Apps Script uses POST');
    assert.match(request.headers()['content-type']||'',/^text\/plain/i,'Apps Script must not require a CORS preflight');
    const req=JSON.parse(request.postData());
    assert.deepEqual(Object.keys(req).sort(),['action','deviceId','payload','token','ts'],'exact existing relay envelope');
    assert(req.payload&&typeof req.payload==='object'&&!Array.isArray(req.payload));
    assert(Number.isFinite(req.ts));assert.equal(typeof req.deviceId,'string');
    calls.push(clone(req));
    const faultKey=req.deviceId+'|'+req.action,kind=faults.get(faultKey);faults.delete(faultKey);
    const fulfill=body=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'},body:JSON.stringify(body)});
    if(req.token!==TOKEN||kind==='auth')return fulfill({ok:false,error:'unauthorized'});
    if(kind==='network')return route.abort('failed');
    if(kind==='http')return route.fulfill({status:503,contentType:'text/plain',body:'mock server unavailable'});
    if(kind==='unavailable')return fulfill({ok:false,error:'bad-request'});
    if(kind==='malformed')return route.fulfill({status:200,contentType:'application/json',body:'not-json'});
    if(kind==='conflict')return fulfill({ok:false,error:'conflict',current:clone(tasks.get(req.payload.task?.id||req.payload.id)||null)});
    const body=result(req);
    if(kind==='lost-ack')return route.abort('failed');
    if(kind==='hold'){
      let release;const gate=new Promise(resolve=>{release=resolve;});
      const held={device:req.deviceId,action:req.action,body:clone(body),release,done:false};holds.push(held);
      await gate;
      try{await fulfill(body);}catch(error){if(!/closed|intercept|invalid|handled|cancel/i.test(String(error)))throw error;}finally{held.done=true;}
      return;
    }
    return fulfill(body);
  }
  return{URL,TOKEN,VERSION,tasks,receipts,calls,holds,inject,count,active,handle,
    revision:()=>storeRevision,
    // A competing employee is another valid API caller, never a mutation of browser data.
    create:(project,text,device='test-other')=>result({action:'sharedTodoSave',deviceId:device,payload:{requestId:randomUUID(),expectedRevision:0,task:{id:randomUUID(),project,text,done:false}}}).task,
    update:(task,changes,device='test-other')=>result({action:'sharedTodoSave',deviceId:device,payload:{requestId:randomUUID(),expectedRevision:task.revision,task:{id:task.id,project:task.project,text:task.text,done:task.done,...changes}}}).task,
    releaseAll:()=>holds.forEach(x=>x.release())};
}
module.exports={createSharedTodoMock,URL,TOKEN,VERSION};

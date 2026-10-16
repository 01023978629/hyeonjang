/* Synthetic SW installation only. No browser, server, credentials or real files.
   Optional HJ_OFFLINE_SW_SOURCE points at a baseline SW; it must fail INSTALL_WAITS. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(process.env.HJ_OFFLINE_SW_SOURCE||path.join(__dirname,'../sw.js'),'utf8');
const ORIGIN='https://offline.example.test';
const SUFFIXES=['','index.html','media-safety.js','shared-todo-backup.js','operations-review.js','privacy.html','terms.html','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','bathroom-defaults.json','manifest.webmanifest'];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(prefix='/hyeonjang/',options={}){
  const handlers={},events=[],requests=[],puts=[],deleted=[],oldCache=new Map([['SYNTHETIC_OLD_URL','SYNTHETIC_OLD_BYTES']]);
  const current=new Map(),cacheNames=new Map([['hyeonjang-v424-leaksms',oldCache]]);
  let skipped=0,claimed=0,releasePut=null;
  const context={URL,Request,Response,Headers,Blob,Promise,Uint8Array,Date,
    self:{location:{origin:ORIGIN,href:ORIGIN+prefix+'sw.js'},addEventListener(type,fn){handlers[type]=fn;},async skipWaiting(){events.push('skip');skipped++;}},
    clients:{async claim(){events.push('claim');claimed++;}},
    caches:{async keys(){return [...cacheNames.keys()];},async delete(key){deleted.push(key);return cacheNames.delete(key);},async open(key){
      events.push('open:'+key);if(options.openError)throw Error('SYNTHETIC_CACHE_OPEN');cacheNames.set(key,current);
      return {async put(request,response){
        puts.push(request.url);events.push('put:'+request.url);
        if(options.putError===puts.length)throw Error('SYNTHETIC_CACHE_PUT');
        if(options.holdLastPut&&puts.length===SUFFIXES.length)await new Promise(resolve=>{releasePut=resolve;});
        current.set(request.url,await response.text());
      },async match(request){const text=current.get(request.url);return text===undefined?undefined:new Response(text);}};
    }},
    fetch:async request=>{
      assert(request instanceof Request,'INSTALL_USES_EXPLICIT_REQUEST');requests.push(request);events.push('fetch:'+request.url);
      if(options.networkError===requests.length)throw Error('SYNTHETIC_NETWORK');
      if(options.httpError===requests.length)return new Response('SYNTHETIC_FAILURE',{status:500});
      if(options.opaque===requests.length)return {ok:true,type:'opaque',url:'',clone(){throw Error('OPAQUE_NOT_CACHEABLE');}};
      if(options.foreignResponse===requests.length)return {ok:true,type:'basic',url:'https://foreign.example.test/private',clone(){throw Error('FOREIGN_NOT_CACHEABLE');}};
      return new Response('SYNTHETIC_PUBLIC:'+new URL(request.url).pathname,{status:200});
    }};
  vm.createContext(context);vm.runInContext(source,context,{filename:'sw.js'});
  function dispatch(type){let waiting=null;handlers[type]({waitUntil(promise){assert.equal(waiting,null,'one install lifetime promise');waiting=Promise.resolve(promise);}});return waiting;}
  return {events,requests,puts,deleted,oldCache,current,cacheNames,install:()=>dispatch('install'),activate:()=>dispatch('activate'),get skipped(){return skipped;},get claimed(){return claimed;},release:()=>releasePut&&releasePut(),get waitingPut(){return !!releasePut;}};
}
function unchangedOld(h){assert.deepEqual([...h.oldCache],[['SYNTHETIC_OLD_URL','SYNTHETIC_OLD_BYTES']],'INSTALL_FAILURE_PRESERVES_OLD_BYTES');assert(h.cacheNames.has('hyeonjang-v424-leaksms'),'INSTALL_FAILURE_PRESERVES_OLD_CACHE');assert.deepEqual(h.deleted,[],'INSTALL_NEVER_DELETES_PREVIOUS_CACHE');}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS offlinequeue-cache-v425 '+name);}
(async()=>{
  await test('cold install caches only the exact public shell before activation',async()=>{
    for(const prefix of ['/','/hyeonjang/']){
      const h=harness(prefix),pending=h.install();assert(pending&&typeof pending.then==='function','INSTALL_WAITS');await pending;
      const expected=SUFFIXES.map(s=>ORIGIN+prefix+s);assert.deepEqual(h.requests.map(r=>r.url),expected,'INSTALL_EXACT_EXISTING_ALLOWLIST');assert.deepEqual(h.puts,expected);assert.equal(h.current.size,expected.length);
      for(const r of h.requests){const u=new URL(r.url);assert.equal(u.origin,ORIGIN);assert.equal(u.search,'');assert.equal(r.method,'GET');assert.equal(r.mode,'same-origin');assert.equal(r.credentials,'omit');assert.equal(r.redirect,'error');assert.equal(r.cache,'reload');assert.equal(r.headers.has('Authorization'),false);assert.equal(r.body,null);assert(!/share-target|relay|upload|appState|outbox|inbox|\.json\?/.test(r.url));}
      assert.equal(h.skipped,1);assert.equal(h.claimed,0);assert.equal(h.events.at(-1),'skip');unchangedOld(h);
      await h.activate();assert.equal(h.claimed,1);assert.deepEqual(h.deleted,['hyeonjang-v424-leaksms']);assert(h.cacheNames.has('hyeonjang-v425-offlinequeue'));
    }
  });
  await test('skipWaiting waits for the final cache write to finish',async()=>{
    const h=harness('/hyeonjang/',{holdLastPut:true}),pending=h.install();assert(pending,'INSTALL_WAITS');
    for(let n=0;n<100&&!h.waitingPut;n++)await tick();assert(h.waitingPut,'INSTALL_REACHES_FINAL_WRITE');assert.equal(h.skipped,0,'NO_ACTIVATION_BEFORE_ALL_CACHE_WRITES');unchangedOld(h);
    h.release();await pending;assert.equal(h.skipped,1);assert.equal(h.current.size,SUFFIXES.length);
  });
  for(const option of ['networkError','httpError','opaque','foreignResponse'])await test(option+' rejects installation and preserves the active worker cache',async()=>{
    const h=harness('/hyeonjang/',{[option]:4}),pending=h.install();assert(pending,'INSTALL_WAITS');await assert.rejects(pending);assert.equal(h.skipped,0);assert.equal(h.claimed,0);assert.equal(h.puts.length,0,'INVALID_RESPONSE_NEVER_STARTS_CACHE_COMMIT');unchangedOld(h);
  });
  for(const options of [{openError:true},{putError:4}])await test('cache persistence failure does not promote the new worker',async()=>{
    const h=harness('/hyeonjang/',options),pending=h.install();assert(pending,'INSTALL_WAITS');await assert.rejects(pending);assert.equal(h.skipped,0);assert.equal(h.claimed,0);unchangedOld(h);
  });
  console.log('offlinequeue-cache-v425: '+passed+'/'+passed+' passed');
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});

/* v416 서비스워커 공유 수신 — 합성 File/IDB만 사용하며 서버·브라우저를 띄우지 않는다.
   이전 소스 검증: HJ_SHARE_SW_SOURCE=<이전 sw.js 사본> node tests/sharetarget-v416.unit.js
   보호 제거 검증: node tests/sharetarget-v416.unit.js --mutations */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Blob,File}=require('node:buffer');
const source=fs.readFileSync(process.env.HJ_SHARE_SW_SOURCE||path.join(__dirname,'../sw.js'),'utf8');
const ORIGIN='https://share.example.test',ROOT=ORIGIN+'/hyeonjang/',TARGET=ROOT+'share-target',MAX=300*1024*1024;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
function file(name='SYNTHETIC_PHOTO.jpg',size=3,type='image/jpeg',lastModified=1700000000123){
  const f=new File(['abc'],name,{type,lastModified});
  // 용량 경계는 큰 메모리를 만들지 않고 합성 File의 메타만 고정한다.
  if(size!==3)Object.defineProperty(f,'size',{value:size});
  return f;
}
function form(media,extra={}){
  return {getAll(key){assert.equal(key,'media');return media;},get(key){return Object.prototype.hasOwnProperty.call(extra,key)?extra[key]:null;}};
}
function makeHarness(swSource=source,options={}){
  const handlers={},rows=new Map(options.existing||[]),stats={opens:[],creates:[],adds:[],puts:0,closes:0,fetches:[],cacheOpens:0,cachePuts:0,formReads:0,requestSuccesses:0};
  let serial=0,transactionReady;
  const ready=new Promise(resolve=>{transactionReady=resolve;});
  const controls={ready,complete:null,abort:null};
  function open(name,version){
    stats.opens.push({name,version});
    if(options.openThrows)throw Error('SYNTHETIC_OPEN_THROW');
    const request={};let hasStore=!!options.existingStore;
    const db={
      objectStoreNames:{contains:key=>key==='inbox'&&hasStore},
      createObjectStore(key,config){
        if(options.upgradeError)throw Error('SYNTHETIC_UPGRADE');
        stats.creates.push({key,config});hasStore=true;return {};
      },
      close(){stats.closes++;},
      transaction(key,mode){
        assert.equal(key,'inbox');assert.equal(mode,'readwrite');
        if(options.transactionThrows)throw Error('SYNTHETIC_TRANSACTION_THROW');
        let ended=false,scheduled=false;const pending=[],requests=[];
        const tx={
          objectStore(store){
            assert.equal(store,'inbox');
            return {
              add(record){
                assert.equal(ended,false);
                stats.adds.push(record);
                if(options.addThrows===stats.adds.length)throw Error('SYNTHETIC_ADD_THROW');
                const req={};pending.push(record);requests.push(req);
                if(!scheduled){scheduled=true;queueMicrotask(begin);}
                return req;
              },
              put(){stats.puts++;throw Error('OVERWRITE_FORBIDDEN');}
            };
          },
          abort(){
            if(ended)return;ended=true;
            queueMicrotask(()=>{if(tx.onabort)tx.onabort({target:tx});});
          }
        };
        function fail(){if(ended)return;ended=true;if(tx.onerror)tx.onerror({target:tx});if(tx.onabort)tx.onabort({target:tx});}
        function complete(){
          if(ended)return;ended=true;
          pending.forEach(record=>rows.set(record.id,record));
          if(tx.oncomplete)tx.oncomplete({target:tx});
        }
        function begin(){
          if(ended){transactionReady();return;}
          const ids=new Set();
          for(let i=0;i<pending.length;i++){
            const record=pending[i];
            if(rows.has(record.id)||ids.has(record.id)||options.requestError===i+1){fail();transactionReady();return;}
            ids.add(record.id);stats.requestSuccesses++;
            if(requests[i].onsuccess)requests[i].onsuccess({target:requests[i]});
          }
          controls.complete=complete;controls.abort=()=>tx.abort();transactionReady();
          if(options.abortAfterRequests){tx.abort();return;}
          if(!options.manualComplete)complete();
        }
        return tx;
      }
    };
    request.result=db;request.transaction={abort(){request._upgradeAborted=true;}};
    queueMicrotask(()=>{
      if(options.openError){request.onerror?.({target:request});return;}
      if(options.blocked){request.onblocked?.({target:request});request.onsuccess?.({target:request});return;}
      if(!hasStore)request.onupgradeneeded?.({target:request});
      if(request._upgradeAborted){request.onerror?.({target:request});return;}
      request.onsuccess?.({target:request});
    });
    return request;
  }
  const context={URL,Headers,Response,Blob,Uint8Array,Promise,Date,queueMicrotask,crypto:{
    randomUUID:options.noUUID?undefined:()=>options.fixedUUID||'00000000-0000-4000-8000-'+String(++serial).padStart(12,'0'),
    getRandomValues:bytes=>{bytes.fill(0);bytes[bytes.length-1]=++serial;return bytes;}
  },indexedDB:{open},self:{location:{origin:ORIGIN,href:ROOT+'sw.js'},skipWaiting(){},addEventListener(type,fn){handlers[type]=fn;}},
  clients:{claim:async()=>{}},caches:{keys:async()=>[],delete:async()=>true,open:async()=>{stats.cacheOpens++;return {put:async()=>{stats.cachePuts++;},match:async()=>null};}},
  fetch:async request=>{stats.fetches.push(request);return new Response('SYNTHETIC_PUBLIC_SHELL',{status:200});}};
  vm.createContext(context);vm.runInContext(swSource,context,{filename:'sw.js'});
  function dispatch(media=[],settings={}){
    let response=null;
    const request={url:settings.url||TARGET,method:settings.method||'POST',headers:new Headers(settings.headers||{}),
      async formData(){stats.formReads++;if(settings.formError)throw Error('SYNTHETIC_FORM_ERROR');return settings.form||form(media,settings.extra);}};
    handlers.fetch({request,respondWith(value){assert.equal(response,null,'respondWith must be called once');response=Promise.resolve(value);}});
    return {intercepted:response!==null,response};
  }
  return {rows,stats,controls,dispatch};
}
function noNetwork(h){assert.equal(h.stats.fetches.length,0,'SHARE_FILES_NEVER_FETCH');assert.equal(h.stats.cacheOpens,0,'SHARE_FILES_NEVER_CACHE');assert.equal(h.stats.puts,0,'SHARE_EXISTING_ROWS_NEVER_PUT');}
function redirected(response,failed=false){assert.equal(response.status,303);assert.equal(response.headers.get('location'),ROOT+'?view=shareinbox'+(failed?'&err=1':''),'SHARE_ABSOLUTE_REDIRECT');}
async function shared(h,media,settings){const d=h.dispatch(media,settings);assert(d.intercepted,'SHARE_POST_INTERCEPTED');const response=await d.response;return response;}
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function transactionBoundary(swSource){
  const h=makeHarness(swSource,{manualComplete:true}),d=h.dispatch([file()]);assert(d.intercepted,'SHARE_POST_INTERCEPTED');
  let settled=false;d.response.then(()=>{settled=true;});await h.controls.ready;await tick();
  assert.equal(h.stats.requestSuccesses,1);assert.equal(settled,false,'SHARE_WAIT_TRANSACTION_COMPLETE');assert.equal(h.rows.size,0);
  h.controls.complete();redirected(await d.response);assert.equal(h.rows.size,1);noNetwork(h);
}
(async()=>{
  await test('정확한 공유 POST 저장·절대 303·원본 보존·수정시각 미상 처리',async()=>{
    const retained={id:'SYNTHETIC_ACCEPTED',acceptedRecordId:'SYNTHETIC_APP_RECORD',blob:file('SYNTHETIC_KEEP.jpg')};
    const h=makeHarness(source,{existing:[[retained.id,retained]]}),photo=file(),video=file('SYNTHETIC_VIDEO.mp4',7,'video/mp4',1700001000456);
    redirected(await shared(h,[photo,video],{extra:{title:'T'.repeat(240),text:'X'.repeat(2400),url:'https://outside.invalid/DO_NOT_SEND'}}));
    assert.deepEqual(h.stats.opens,[{name:'hyeonjang-share',version:2}]);assert.deepEqual(plain(h.stats.creates),[{key:'inbox',config:{keyPath:'id'}},{key:'outbox',config:{keyPath:'id'}}]);
    const rows=[...h.rows.values()].filter(r=>r!==retained);assert.equal(rows.length,2);assert.strictEqual(h.rows.get(retained.id),retained);
    for(const [row,original]of rows.map((r,i)=>[r,[photo,video][i]])){
      assert.strictEqual(row.blob,original);assert.equal(row.name,original.name);assert.equal(row.size,original.size);assert.equal(row.type,original.type);assert.equal(row.lastModified,0,'SHARE_MULTIPART_MODIFIED_UNKNOWN');
      assert.equal(row.title.length,200);assert.equal(row.text.length,2000);assert(Number.isFinite(Date.parse(row.at)));assert(row.id!==row.batchId);
      assert.equal(row.acceptedRecordId,undefined);assert.equal(row.url,undefined);
    }
    assert.equal(rows[0].batchId,rows[1].batchId);assert.notEqual(rows[0].id,rows[1].id);assert.equal(h.stats.closes,1);noNetwork(h);
  });
  await test('실제 multipart 왕복의 새 File 시각을 원본 촬영일로 저장하지 않음',async()=>{
    const original=file('SYNTHETIC_OLD_PHOTO.jpg',3,'image/jpeg',Date.parse('2020-01-02T03:04:05Z'));
    const payload=new FormData();payload.append('media',original);payload.append('title','SYNTHETIC_MULTIPART');
    const request=new Request(TARGET,{method:'POST',body:payload}),received=await request.formData(),receivedFile=received.get('media');
    assert(receivedFile instanceof Blob);assert.notEqual(receivedFile.lastModified,original.lastModified,'multipart does not transmit the original File timestamp');
    const h=makeHarness();redirected(await shared(h,[],{form:received}));const row=[...h.rows.values()][0];
    assert.equal(row.lastModified,0,'SHARE_MULTIPART_MODIFIED_UNKNOWN');assert.equal(row.name,original.name);
    assert.deepEqual(Buffer.from(await row.blob.arrayBuffer()),Buffer.from(await original.arrayBuffer()),'shared original bytes are unchanged');noNetwork(h);
  });
  await test('개별 add 성공 뒤에도 transaction oncomplete 전에는 이동 안 함',()=>transactionBoundary(source));
  await test('add 성공 뒤 transaction abort는 원자 실패·이전 자료 보존',async()=>{
    const kept={id:'SYNTHETIC_KEEP',acceptedRecordId:'SYNTHETIC_DONE',blob:file()};
    const h=makeHarness(source,{abortAfterRequests:true,existing:[[kept.id,kept]]});redirected(await shared(h,[file()]),true);
    assert.equal(h.stats.requestSuccesses,1);assert.deepEqual([...h.rows.values()],[kept]);assert.equal(h.stats.closes,1);noNetwork(h);
  });
  await test('IDB 열기·blocked·upgrade·transaction·add 오류를 실패 이동으로 처리',async()=>{
    for(const options of [{openThrows:true},{openError:true},{blocked:true},{upgradeError:true},{transactionThrows:true},{addThrows:2},{requestError:2}]){
      const h=makeHarness(source,options);redirected(await shared(h,[file(),file('SYNTHETIC_SECOND.jpg')]),true);assert.equal(h.rows.size,0);noNetwork(h);
      if(!options.openThrows&&!options.openError&&!options.upgradeError)assert(h.stats.closes>=1,'IDB connection must close on failure');
    }
  });
  await test('30개 경계·초과 개수는 단일 메타 행에 기록',async()=>{
    const h=makeHarness();redirected(await shared(h,Array.from({length:32},(_,i)=>file('SYNTHETIC_'+i+'.jpg'))));
    const rows=[...h.rows.values()],media=rows.filter(r=>r.blob),meta=rows.filter(r=>r.kind==='share-meta');
    assert.equal(media.length,30);assert.equal(meta.length,1);assert.equal(meta[0].droppedCount,2);assert.deepEqual(plain(meta[0].reasonCounts),{type:0,count:2,size:0});assert.equal(meta[0].blob,undefined);noNetwork(h);
  });
  await test('300MiB 경계는 포함·초과 제외·뒤의 작은 파일은 잔여 용량에 수용',async()=>{
    let h=makeHarness();redirected(await shared(h,[file('SYNTHETIC_MAX.mp4',MAX,'video/mp4'),file('SYNTHETIC_OVER.jpg',1)]));
    let rows=[...h.rows.values()];assert.equal(rows.filter(r=>r.blob).length,1);assert.equal(rows[0].size,MAX);assert.equal(rows.find(r=>r.kind==='share-meta').reasonCounts.size,1);noNetwork(h);
    h=makeHarness();redirected(await shared(h,[file('SYNTHETIC_FIRST.mp4',200*1024*1024,'video/mp4'),file('SYNTHETIC_DROP.mp4',150*1024*1024,'video/mp4'),file('SYNTHETIC_LAST.mp4',100*1024*1024,'video/mp4')]));
    rows=[...h.rows.values()];assert.deepEqual(rows.filter(r=>r.blob).map(r=>r.name),['SYNTHETIC_FIRST.mp4','SYNTHETIC_LAST.mp4']);assert.equal(rows.find(r=>r.kind==='share-meta').droppedCount,1);noNetwork(h);
  });
  await test('가짜 File·비미디어·문자 form 값 거부, URL/파일 네트워크 전송 없음',async()=>{
    const h=makeHarness(),fake={name:'SYNTHETIC_FAKE.jpg',size:3,type:'image/jpeg',lastModified:1};
    redirected(await shared(h,['SYNTHETIC_STRING',fake,new Blob(['abc'],{type:'image/jpeg'}),file('SYNTHETIC_SCRIPT.html',3,'text/html'),file('SYNTHETIC_BAD.jpg',3,'image/'),file()]));
    const rows=[...h.rows.values()];assert.equal(rows.filter(r=>r.blob).length,1);assert.equal(rows.find(r=>r.kind==='share-meta').reasonCounts.type,5);noNetwork(h);
  });
  await test('파일 없는 form은 실패, 전부 거부면 메타만 남겨 이유 안내',async()=>{
    let h=makeHarness();redirected(await shared(h,[]),true);assert.equal(h.rows.size,0);assert.equal(h.stats.opens.length,0);noNetwork(h);
    h=makeHarness();redirected(await shared(h,[file('SYNTHETIC_TOO_BIG.mp4',MAX+1,'video/mp4')]));
    assert.equal(h.rows.size,1);assert.equal([...h.rows.values()][0].kind,'share-meta');assert.equal([...h.rows.values()][0].droppedCount,1);noNetwork(h);
  });
  await test('손상 form 파싱 실패·파일형 title/text는 텍스트로 강제변환하지 않음',async()=>{
    let h=makeHarness();redirected(await shared(h,[],{formError:true}),true);assert.equal(h.stats.opens.length,0);noNetwork(h);
    h=makeHarness();redirected(await shared(h,[file()],{extra:{title:file(),text:{toString(){throw Error('MUST_NOT_COERCE');}}}}));
    const row=[...h.rows.values()][0];assert.equal(row.title,'');assert.equal(row.text,'');noNetwork(h);
  });
  await test('동일 출처·정확 경로·쿼리 없는 POST 이외는 기존 규칙 유지',async()=>{
    for(const settings of [
      {method:'GET'},{method:'PUT'},{url:TARGET+'/'},{url:TARGET+'/extra'},{url:TARGET+'?token=SYNTHETIC'},
      {url:ORIGIN+'/share-target'},{url:ROOT+'index.html'},{url:'https://outside.invalid/hyeonjang/share-target'},
      {url:'http://share.example.test/hyeonjang/share-target'}
    ]){const h=makeHarness(),d=h.dispatch([file()],settings);assert.equal(d.intercepted,false,'SHARE_EXACT_SAME_ORIGIN_POST');assert.equal(h.stats.formReads,0);assert.equal(h.stats.opens.length,0);noNetwork(h);}
  });
  await test('기존 GET 셸 캐시와 manifest 허용목록, Authorization/쿼리 차단 유지',async()=>{
    for(const name of ['index.html','manifest.webmanifest']){
      const h=makeHarness(),d=h.dispatch([],{url:ROOT+name,method:'GET'});assert(d.intercepted);assert.equal((await d.response).status,200);assert.equal(h.stats.fetches.length,1);assert.equal(h.stats.cachePuts,1);assert.equal(h.stats.formReads,0);assert.equal(h.stats.opens.length,0);
    }
    for(const settings of [{url:ROOT+'index.html?view=shareinbox'},{url:ROOT+'index.html',headers:{Authorization:'Bearer SYNTHETIC'}},{url:ROOT+'unknown.html'}]){
      const h=makeHarness(),d=h.dispatch([],{...settings,method:'GET'});assert.equal(d.intercepted,false);noNetwork(h);
    }
  });
  await test('다음 공유는 새 행만 추가하며 기존 accepted 원본을 덮지 않음',async()=>{
    const h=makeHarness();redirected(await shared(h,[file()]));const first=[...h.rows.values()][0];first.acceptedRecordId='SYNTHETIC_ACCEPTED';
    redirected(await shared(h,[file()]));const rows=[...h.rows.values()];assert.equal(rows.length,2);assert.strictEqual(rows[0],first);assert.equal(first.acceptedRecordId,'SYNTHETIC_ACCEPTED');assert.notEqual(rows[0].batchId,rows[1].batchId);noNetwork(h);
  });
  await test('UUID 충돌은 전체 실패이며 기존 원본 유지·보안 난수 폴백 사용',async()=>{
    let h=makeHarness(source,{fixedUUID:'SYNTHETIC_COLLISION'});redirected(await shared(h,[file(),file('SYNTHETIC_SECOND.jpg')]),true);assert.equal(h.rows.size,0);noNetwork(h);
    const kept={id:'share-SYNTHETIC_COLLISION',blob:file(),acceptedRecordId:'SYNTHETIC_KEEP'};
    h=makeHarness(source,{fixedUUID:'SYNTHETIC_COLLISION',existing:[[kept.id,kept]]});redirected(await shared(h,[file()]),true);assert.deepEqual([...h.rows.values()],[kept]);noNetwork(h);
    h=makeHarness(source,{noUUID:true});redirected(await shared(h,[file(),file('SYNTHETIC_SECOND.jpg')]));assert.equal(h.rows.size,2);assert.notEqual([...h.rows.keys()][0],[...h.rows.keys()][1]);noNetwork(h);
  });
  if(process.argv.includes('--mutations')){
    const originGuard="url.origin===self.location.origin&&!url.search&&url.pathname===SCOPE_PATH+'share-target'";
    assert(source.includes(originGuard),'MUTATION_ORIGIN_TARGET_EXISTS');
    const external=makeHarness(source.replace(originGuard,"url.pathname===SCOPE_PATH+'share-target'"));
    const d=external.dispatch([file()],{url:'https://outside.invalid/hyeonjang/share-target'});
    assert.throws(()=>assert.equal(d.intercepted,false,'SHARE_EXACT_SAME_ORIGIN_POST'),/SHARE_EXACT_SAME_ORIGIN_POST/);await d.response;
    const completion='tx.oncomplete=()=>resolve();';assert(source.includes(completion),'MUTATION_TRANSACTION_TARGET_EXISTS');
    await assert.rejects(()=>transactionBoundary(source.replace(completion,'tx.oncomplete=()=>{};queueMicrotask(resolve);')),/SHARE_WAIT_TRANSACTION_COMPLETE/);
    const add='records.forEach(record=>store.add(record));';assert(source.includes(add),'MUTATION_ADD_TARGET_EXISTS');
    const overwrite=makeHarness(source.replace(add,'records.forEach(record=>store.put(record));'));
    const response=await shared(overwrite,[file()]);assert.throws(()=>redirected(response),/SHARE_ABSOLUTE_REDIRECT/);assert.equal(overwrite.stats.puts,1);
    const unknownTime='lastModified:0,blob:file';assert(source.includes(unknownTime),'MUTATION_UNKNOWN_TIME_TARGET_EXISTS');
    const receivedTime=makeHarness(source.replace(unknownTime,'lastModified:file.lastModified,blob:file'));
    redirected(await shared(receivedTime,[file()]));
    assert.throws(()=>assert.equal([...receivedTime.rows.values()][0].lastModified,0,'SHARE_MULTIPART_MODIFIED_UNKNOWN'),/SHARE_MULTIPART_MODIFIED_UNKNOWN/);
    console.log('PASS sharetarget-v416 보호 제거 변이 4/4 탐지');
  }
  console.log('PASS sharetarget-v416 unit '+passed+'/'+passed);
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});

/* 현장 앱 오프라인 캐시 — 공개 앱 셸 허용목록만 네트워크 우선으로 저장 */
const C='hyeonjang-v473-importnote';
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  // 첫 실행은 아직 SW가 제어하지 않아 fetch 캐시에 들어오지 않는다. 공개 셸만 먼저 준비한다.
  // 응답 하나라도 실패하면 기존 워커/캐시를 유지하며 새 워커로 넘어가지 않는다.
  const ready=[];
  for(const path of SHELL_PATHS){
    const request=new Request(new URL(path,self.location.origin).href,{method:'GET',mode:'same-origin',credentials:'omit',redirect:'error',cache:'reload'});
    if(!cacheableShellRequest(request))throw new Error('shell-install-request');
    const response=await fetch(request);
    if(!cacheableShellResponse(response))throw new Error('shell-install-response');
    if(response.url){const url=new URL(response.url);if(url.origin!==self.location.origin||url.search||url.pathname!==new URL(request.url).pathname)throw new Error('shell-install-response-url');}
    // 큰 HTML 응답을 읽지 않고 쌓으면 no-store 서버의 다음 요청이 막힐 수 있다.
    // 각 본문을 먼저 끝까지 읽고, 모든 응답이 검증된 뒤에만 새 캐시를 쓴다.
    const body=await response.arrayBuffer();
    ready.push([request,new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers})]);
  }
  const cache=await caches.open(C);
  for(const [request,response] of ready)await cache.put(request,response.clone());
  await self.skipWaiting();
})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)));await clients.claim();})());});

const SCOPE_PATH=new URL('./',self.location.href).pathname;
const SHELL_PATHS=new Set([
  SCOPE_PATH,
  SCOPE_PATH+'index.html',
  SCOPE_PATH+'media-safety.js',
  SCOPE_PATH+'shared-todo-backup.js',
  SCOPE_PATH+'operations-review.js',
  SCOPE_PATH+'privacy.html',
  SCOPE_PATH+'terms.html',
  SCOPE_PATH+'icon-192.png',
  SCOPE_PATH+'icon-512.png',
  SCOPE_PATH+'icon-maskable-512.png',
  SCOPE_PATH+'apple-touch-icon.png',
  SCOPE_PATH+'bathroom-defaults.json',
  SCOPE_PATH+'manifest.webmanifest'
]);
/* v416 공유 원본은 별도 기기 DB에만 둔다. 앱/Drive 저장·전송은 여기서 하지 않는다. */
const SHARE_MAX_FILES=30,SHARE_MAX_BYTES=300*1024*1024;
const SHARE_MEDIA_TYPE=/^(?:image|video)\/[a-z0-9!#$&^_.+-]+$/i;
function shareTargetRequest(request){
  if(request.method!=='POST')return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!url.search&&url.pathname===SCOPE_PATH+'share-target';
}
function shareInboxId(){
  if(typeof crypto.randomUUID==='function')return 'share-'+crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return 'share-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function shareInboxOpen(){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const fail=()=>{if(!settled){settled=true;reject(new Error('share-storage'));}};
    const request=indexedDB.open('hyeonjang-share',2);
    request.onupgradeneeded=()=>{
      try{if(!request.result.objectStoreNames.contains('inbox'))request.result.createObjectStore('inbox',{keyPath:'id'});if(!request.result.objectStoreNames.contains('outbox'))request.result.createObjectStore('outbox',{keyPath:'id'});}
      catch(_){try{request.transaction.abort();}catch(_){}fail();}
    };
    request.onerror=fail;request.onblocked=fail;
    request.onsuccess=()=>{
      const db=request.result;
      if(settled){db.close();return;}
      settled=true;db.onversionchange=()=>db.close();resolve(db);
    };
  });
}
async function shareInboxStore(records){
  const db=await shareInboxOpen();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('inbox','readwrite');
      tx.oncomplete=()=>resolve();
      tx.onerror=tx.onabort=()=>reject(new Error('share-storage'));
      try{
        const store=tx.objectStore('inbox');
        // add만 사용한다. UUID 충돌도 전체 실패로 돌려 기존/등록 완료 원본을 보존한다.
        records.forEach(record=>store.add(record));
      }catch(_){try{tx.abort();}catch(_){}reject(new Error('share-storage'));}
    });
  }finally{db.close();}
}
async function receiveShare(request){
  let failed=false;
  try{
    const form=await request.formData(),media=form.getAll('media');
    if(!media.length)throw new Error('share-empty');
    const short=(key,max)=>{const value=form.get(key);return typeof value==='string'?value.slice(0,max):'';};
    const title=short('title',200),text=short('text',2000),at=new Date().toISOString(),batchId=shareInboxId();
    const records=[],reasonCounts={type:0,count:0,size:0};let bytes=0;
    for(const file of media){
      if(!(file instanceof Blob)||typeof file.name!=='string'||!file.name||!Number.isSafeInteger(file.size)||file.size<0||!SHARE_MEDIA_TYPE.test(file.type)){reasonCounts.type++;continue;}
      if(records.length>=SHARE_MAX_FILES){reasonCounts.count++;continue;}
      if(file.size>SHARE_MAX_BYTES-bytes){reasonCounts.size++;continue;}
      bytes+=file.size;
      // multipart에는 원본 lastModified가 없다. formData()가 만든 수신 시각을 촬영일로 쓰지 않는다.
      records.push({id:shareInboxId(),batchId,at,name:file.name,type:file.type,size:file.size,
        lastModified:0,blob:file,title,text});
    }
    const droppedCount=reasonCounts.type+reasonCounts.count+reasonCounts.size;
    // 파일이 전부 거부되어도 안내는 남긴다. 메타는 사진 수/용량에 포함하지 않는다.
    if(droppedCount)records.push({id:shareInboxId(),batchId,at,kind:'share-meta',droppedCount,reasonCounts,title,text});
    await shareInboxStore(records);
  }catch(_){failed=true;}
  // Safari/Chromium 모두 상대 redirect를 거부할 수 있어 절대 URL을 만든다.
  return Response.redirect(new URL(SCOPE_PATH+'?view=shareinbox'+(failed?'&err=1':''),self.location.origin).href,303);
}
function cacheableShellRequest(request){
  if(request.method!=='GET'||request.headers.has('Authorization'))return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!url.search&&SHELL_PATHS.has(url.pathname);
}
function cacheableShellResponse(response){
  return !!response&&response.ok&&(response.type==='basic'||response.type==='default');
}
self.addEventListener('fetch',e=>{
  if(shareTargetRequest(e.request)){e.respondWith(receiveShare(e.request));return;}
  if(!cacheableShellRequest(e.request))return;
  e.respondWith((async()=>{
    const cache=await caches.open(C);
    try{
      const response=await fetch(e.request);
      if(cacheableShellResponse(response))await cache.put(e.request,response.clone());
      return response;
    }catch(error){
      const hit=await cache.match(e.request);
      if(hit)return hit;
      throw error;
    }
  })());
});

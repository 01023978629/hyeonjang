/* 현장 앱 오프라인 캐시 — HTML은 네트워크 우선(업데이트 즉시 반영), 나머지는 캐시 우선+백그라운드 갱신 */
const C='hyeonjang-v128';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)));await clients.claim();})());});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const isDoc=e.request.mode==='navigate'||e.request.destination==='document';
  if(isDoc){
    e.respondWith(fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.open(C).then(cache=>cache.match(e.request).then(hit=>{
      const net=fetch(e.request).then(res=>{try{cache.put(e.request,res.clone());}catch(_){}return res;}).catch(()=>hit);
      return hit||net;
    }))
  );
});

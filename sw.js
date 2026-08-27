/* 현장 앱 오프라인 캐시 — 공개 앱 셸 허용목록만 네트워크 우선으로 저장 */
const C='hyeonjang-v235-officechain';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)));await clients.claim();})());});

const SCOPE_PATH=new URL('./',self.location.href).pathname;
const SHELL_PATHS=new Set([
  SCOPE_PATH,
  SCOPE_PATH+'index.html',
  SCOPE_PATH+'privacy.html',
  SCOPE_PATH+'terms.html'
]);
function cacheableShellRequest(request){
  if(request.method!=='GET'||request.headers.has('Authorization'))return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!url.search&&SHELL_PATHS.has(url.pathname);
}
function cacheableShellResponse(response){
  return !!response&&response.ok&&(response.type==='basic'||response.type==='default');
}
self.addEventListener('fetch',e=>{
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

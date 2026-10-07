'use strict';
const {spawn,spawnSync}=require('node:child_process'),http=require('node:http'),path=require('node:path');
const root=path.join(__dirname,'..');
const alive=()=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:8299/',res=>{res.resume();resolve(true);});r.on('error',()=>resolve(false));r.setTimeout(1000,()=>{r.destroy();resolve(false);});});
(async()=>{let owned;try{
if(!await alive()){
  owned=spawn(process.execPath,['tests/static-server.js'],{cwd:root,stdio:'ignore'});
  for(let i=0;i<40&&!await alive();i++)await new Promise(r=>setTimeout(r,250));
  if(!await alive())throw new Error('local test server unavailable');
}
for(const mutation of ['keeper','group','restore','download']){
  const r=spawnSync(process.execPath,[require('node:path').join(__dirname,'photo-original-keep.e2e.js')],{env:{...process.env,HJ_ORIGINAL_KEEP_MUTATION:mutation},encoding:'utf8',timeout:120000});
  const out=(r.stdout||'')+(r.stderr||'');
  if(r.status!==1||!out.includes('AssertionError'))throw new Error('UNDETECTED / INFRA FAILURE '+mutation+' '+out+' '+(r.error||''));
  console.log('DETECTED '+mutation);
}
console.log('PASS 4/4 protection mutations');
}finally{if(owned)owned.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

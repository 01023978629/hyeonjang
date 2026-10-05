'use strict';
const assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process'),http=require('node:http'),path=require('node:path');
const root=path.join(__dirname,'..');
const cases={repeat:'response loss recovers',hash:'corrupt server bytes',connection:'connection change',restore:'selected restore',reservation:'IDB atomically reserves',layout:'explicit local and server upload UI 320'};
const alive=()=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:8299/',res=>{res.resume();resolve(true);});r.on('error',()=>resolve(false));r.setTimeout(1000,()=>{r.destroy();resolve(false);});});
(async()=>{let owned;try{
  if(!await alive()){owned=spawn(process.execPath,['tests/static-server.js'],{cwd:root,stdio:'ignore'});for(let i=0;i<40&&!await alive();i++)await new Promise(r=>setTimeout(r,250));assert(await alive(),'local server ready');}
  for(const [mutation,expected] of Object.entries(cases)){
    const r=spawnSync(process.execPath,['tests/document-upload.e2e.js'],{cwd:root,encoding:'utf8',timeout:180000,env:{...process.env,HJ_DOCUMENT_UPLOAD_MUTATION:mutation}}),out=(r.stdout||'')+(r.stderr||'');
    if(r.error||r.status!==1||!out.includes('FAIL CASE '+expected)||!out.includes('AssertionError')){process.stderr.write(out);throw new Error('document-upload protection not detected: '+mutation);}
    console.log('PASS intended protection failure: '+mutation);
  }
  console.log('== document-upload mutations: 6/6 detected ==');
  const boot=spawnSync(process.execPath,['tests/document-select.e2e.js'],{cwd:root,encoding:'utf8',timeout:180000,env:{...process.env,HJ_DOCUMENT_SELECT_MUTATION:'startup'}}),output=(boot.stdout||'')+(boot.stderr||'');
  if(boot.error||boot.status!==1||!output.includes('FAIL CASE refresh restores original lazily without Google login')||!output.includes('AssertionError')||!output.includes('startup request must finish before feature measurement')){process.stderr.write(output);throw new Error('document-select startup measurement guard not detected');}
  console.log('PASS intended boot observation failure: exact GIS end signal (1/1)');
}finally{if(owned)owned.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

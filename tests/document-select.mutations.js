/* Negative proof: mutate app HTML in memory, never real app/data. No retry or relaxed assertions. */
'use strict';
const assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process'),http=require('node:http'),path=require('node:path');
const root=path.join(__dirname,'..');
const cases=[['append','append persistence and zero automatic file reads'],['storage','missing original verification cannot report success'],['settlement','settlement never becomes accounting estimate or photo'],['source','applyData scan path does not bind another same-name original'],['move','financial kind change and derived quote are blocked']];
const alive=()=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:8299/',res=>{res.resume();resolve(true);});r.on('error',()=>resolve(false));r.setTimeout(1000,()=>{r.destroy();resolve(false);});});
(async()=>{let owned;try{if(!await alive()){owned=spawn(process.execPath,['tests/static-server.js'],{cwd:root,stdio:'ignore'});for(let i=0;i<40&&!await alive();i++)await new Promise(r=>setTimeout(r,250));assert(await alive(),'local server ready');}
  for(const [mode,label]of cases){const r=spawnSync(process.execPath,['tests/document-select.e2e.js'],{cwd:root,env:{...process.env,HJ_DOCUMENT_SELECT_MUTATION:mode},encoding:'utf8',timeout:180000}),out=(r.stdout||'')+(r.stderr||'');assert.equal(r.status,1,mode+' mutant must fail the actual test: '+out);assert(out.includes('FAIL CASE '+label),mode+' must fail intended assertion, not setup: '+out);console.log('PASS removed protection detected: '+mode);}
  console.log('== document-select mutations: 5/5 detected ==');
}finally{if(owned)owned.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

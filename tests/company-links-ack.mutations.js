/* Explicit protection-removal audit, not a replacement for run-all.js. Synthetic data only. */
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const cases=[
 ...['unit-authority','ack-authority','ack-stale','unit-leak','evidence-unit','ack-invalidation','link-immutable','legacy-unit'].map(mode=>['company-links-ack.unit.js','HJ_LINKS_MUTATION',mode]),
 ...['ui-autosign','ui-new-retry','ui-stale-accept','ui-unit-leak','ui-changed-import','ui-unit-filter'].map(mode=>['company-links-ack-ui.e2e.js','HJ_LINKS_UI_MUTATION',mode]),
 ...['snapshot','stale','notes'].map(mode=>['operations-connections.e2e.js','HJ_CONNECTION_MUTATION',mode]),
 ...['scope','revision','auth','history-reset','history-client','diagnose-open','diagnose-leak','diagnose-fake','diagnose-write'].map(mode=>['company-team.unit.js','HJ_TEAM_MUTATION',mode]),
 ...['schedule','scope','documents','hash','intent','review','reparent','private-load','private-commit','private-snapshot','readiness-blocks','readiness-silent','readiness-doc-any','review-stale-hidden','heic-magic','media-offset','media-actor','media-recheck','media-verify','media-incomplete','media-magic','media-max'].map(mode=>['company-projects.unit.js','HJ_PROJECT_MUTATION',mode])
];
const ping=()=>new Promise(resolve=>{const r=http.get('http://127.0.0.1:8299/index.html',res=>{res.resume();resolve(res.statusCode===200);});r.setTimeout(1500,()=>r.destroy());r.on('error',()=>resolve(false));});
async function run(){
 let server;
 try{
  if(!await ping()){
   server=spawn(process.execPath,['tests/static-server.js'],{cwd:root,stdio:'ignore'});
   let ready=false;for(let i=0;i<30&&!ready;i++){await new Promise(r=>setTimeout(r,300));ready=await ping();}assert(ready,'local synthetic test server unavailable');
  }
  let caught=0;
  for(const [file,key,mode] of cases){
   const r=spawnSync(process.execPath,[path.join('tests',file)],{cwd:root,env:{...process.env,[key]:mode},encoding:'utf8',timeout:180000});
   const output=(r.stdout||'')+'\n'+(r.stderr||'');
   assert(!r.error&&!r.signal,'mutation execution failed or timed out: '+mode);
   assert(!/mutation anchor missing|Cannot find module|ECONNREFUSED|Executable doesn't exist/.test(output),'mutation infrastructure error: '+mode);
   assert(r.status!==0,'protection removal escaped detection: '+mode);
   assert(/AssertionError|Error: (forbidden|evidence-bound|claim-incomplete)|FAIL (company-links-ack-ui|operations-connections):/.test(output),'not a behavioral failure: '+mode+'\n'+output);
   const reason=output.match(/(?:AssertionError[^\n]*|Error: (?:forbidden|evidence-bound|claim-incomplete)|FAIL (?:company-links-ack-ui|operations-connections):[^\n]*)/)?.[0]||'behavioral assertion failed';
   console.log('CAUGHT '+key+':'+mode+' — '+reason);caught++;
  }
  console.log(caught+'/'+cases.length+' link/acceptance protections detected');
 }finally{if(server)server.kill();}
}
run().catch(e=>{console.error('FAIL link mutation audit:',e.stack);process.exitCode=1;});

'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const mutation of ['hash','metadata','proof','snapshot','journal','cas','visible','margin','order']){
  const r=spawnSync(process.execPath,[path.join(__dirname,'photo-safety-ui.e2e.js')],{cwd:path.join(__dirname,'..'),env:{...process.env,HJ_PHOTO_SAFETY_MUTATION:mutation},encoding:'utf8',timeout:120000,maxBuffer:1048576});
  const out=(r.stdout||'')+(r.stderr||'');
  if(r.status!==1||!out.includes('AssertionError')){console.error('UNDETECTED / INFRA FAILURE '+mutation,out,r.error||'');process.exit(1);}
  console.log('DETECTED '+mutation+': '+out.split('\n').find(s=>s.includes('AssertionError')));
}
console.log('PASS 9/9 negative controls');

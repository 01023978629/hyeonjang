// Reproducible negative controls; runs against static-server.js (8299).
'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const mutation of ['zero','alphabet','counts','priority','canonical','unit','bytes','exact','restart','phase','classified']){
  const r=spawnSync(process.execPath,[path.join(__dirname,'project-scan-order.e2e.js')],{
    cwd:path.join(__dirname,'..'),env:{...process.env,HJ_PROJECT_SCAN_MUTATION:mutation},encoding:'utf8',timeout:90000,maxBuffer:1024*1024
  });
  const out=(r.stdout||'')+(r.stderr||'');
  if(r.status!==1||!out.includes('AssertionError')){console.error('UNDETECTED / INFRA FAILURE '+mutation,out,r.error||'');process.exit(1);}
  console.log('DETECTED '+mutation+': '+out.split('\n').find(s=>s.includes('AssertionError')));
}
console.log('PASS 11/11 project/scan mutations detected by behavioral assertions');

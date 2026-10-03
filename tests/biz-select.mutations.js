'use strict';
const {spawnSync}=require('node:child_process');
const base=spawnSync(process.execPath,['tests/biz-select.unit.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,HJ_BIZ_MUTATION:''},encoding:'utf8',timeout:60000});
if(base.error||base.status!==0){console.error('BASELINE FAILED '+(base.error||base.stderr));process.exit(1);}
const mutants=['all-files','stale-selection','rerender-reset','silent-text','delete-shift','overwrite-custom','empty-text','unsafe-image','share-duplicate','load-overwrite','new-template-stale-text','stale-callback','parallel-edit','customer-omitted','customer-unverified','customer-private-default','customer-review-note'];
for(const mutant of mutants){const r=spawnSync(process.execPath,['tests/biz-select.unit.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,HJ_BIZ_MUTATION:mutant},encoding:'utf8',timeout:60000});
 if(r.error||r.status===0||/mutation anchor missing/.test(r.stderr)){console.error('FAIL mutation '+mutant+' '+(r.error||r.stderr));process.exit(1);}
 console.log('DETECTED '+mutant);
}
console.log('biz-select mutations: '+mutants.length+'/'+mutants.length+' DETECTED');

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const mutations=[
  ['GPS missing bypass','hasGps===clusterGps&&(!hasGps||hjPhotoGpsNear(p,{lat:c.anchorLat,lng:c.anchorLng}))','(!hasGps||!clusterGps||hjPhotoGpsNear(p,{lat:c.anchorLat,lng:c.anchorLng}))','4 GPS and 21 unlocated'],
  ['project split removed','tOk&&gOk&&projectOk','tOk&&gOk','different assigned projects'],
  ['certain time-only partial',"why:located?'partial':'sameday'","why:'partial'",'time-only partial assignment'],
  ['address target filtering removed','hjPhotoGpsNear(p,c)&&!hjHasBuildingName(p.address)','true','geocodeCluster protects'],
  ['late response guard removed',"if(!(state.files||[]).includes(p)||!(c.items||[]).includes(p)||p.lat!==row.lat||p.lng!==row.lng||p.project!==row.project||p.address!==row.address||!hjPhotoGpsNear(p,plan)||hjHasBuildingName(p.address))return;",'','late response ignores'],
  ['unverified label removed',"if(!hjPhotoHasGps(c))return '위치 미확인 · 시간 기준 묶음';",'','old address stays stored']
];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hj-photo-location-'));
try{
  for(const [name,from,to,expected] of mutations){
    assert(source.includes(from),'mutation target exists: '+name);
    // Address target filtering is defended twice; remove the corresponding application guard too.
    let mutated=source.replace(from,to);
    if(name==='address target filtering removed')mutated=mutated.replace('||!hjPhotoGpsNear(p,plan)||hjHasBuildingName(p.address)','');
    const file=path.join(temp,'index.html');fs.writeFileSync(file,mutated);
    const r=spawnSync(process.execPath,[path.join(__dirname,'photo-location.unit.js')],{encoding:'utf8',env:{...process.env,HJ_PHOTO_SOURCE:file},timeout:30000});
    assert.equal(r.status,1,'mutation must fail assertions: '+name+'\n'+r.stdout+r.stderr);
    assert((r.stdout+r.stderr).includes('FAIL '+expected),'expected behavioral failure: '+name+'\n'+r.stdout+r.stderr);
    console.log('PASS mutation detected: '+name);
  }
}finally{
  assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(temp).startsWith('hj-photo-location-'));
  fs.rmSync(temp,{recursive:true,force:true});
}

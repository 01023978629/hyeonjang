'use strict';
// Actual app functions, synthetic records only. No network, browser storage or original photos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.HJ_PHOTO_SOURCE || path.join(__dirname, '..', 'index.html'), 'utf8');
const names = ['hjPhotoHasGps','hjPhotoGpsNear','clusterPhotos','photoSuggestFor','hjClusterLocationLabel','hjPhotoLocationLabel','hjHasBuildingName','hjClusterAddressPlan','hjApplyClusterAddress','geocodeCluster','geocodeAllClusters','geocodeUpgradeClusters','setClusterBuilding'];
function extract(name) {
  const start = source.search(new RegExp('(?:async )?function '+name+'\\('));
  assert(start >= 0, 'function exists: '+name);
  const lineEnd = source.indexOf('\n', start), first = source.slice(start, lineEnd);
  return first.endsWith('}') ? first : source.slice(start, source.indexOf('\n}', lineEnd)+2);
}
const ctx = {state:{files:[]}, window:{}, __photoCache:{key:'old'},
  toast(){}, markDirty(){}, render(){}, scheduleRender(){}, confirm:()=>true,
  setTimeout:fn=>{fn();return 1;}, mostCommon:xs=>xs[0],
  num:v=>Number(v)||0, geoDist:()=>0.01, PHOTO_AUDIT_NEAR_KM:0.5};
vm.createContext(ctx);vm.runInContext(names.map(extract).join('\n'), ctx);
const photo = (id, gps=true, extra={}) => ({id,name:id+'.jpg',kind:'photo',project:null,when:new Date('2026-10-12T04:00:00Z'),lat:gps?36.1:null,lng:gps?127.1:null,address:null,_driveId:'test-'+id,...extra});
const group = items => ({lat:36.1,lng:127.1,address:null,items});
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
  await test('4 GPS and 21 unlocated photos separate without changing records',()=>{
    const files=Array.from({length:25},(_,i)=>photo('p'+i,i<4,{address:i<4?null:'old stored address'}));
    const before=JSON.stringify(files),cs=ctx.clusterPhotos(files);
    assert.deepEqual(Array.from(cs,c=>c.items.length),[4,21]);
    assert.equal(cs[1].lat,null);assert.equal(cs[1].address,null);
    assert.equal(JSON.stringify(files),before);
  });
  await test('unlocated before GPS is also separated',()=>{
    const cs=ctx.clusterPhotos([photo('unknown',false),photo('located')]);assert.equal(cs.length,2);
  });
  await test('valid GPS includes zero; incomplete, blank and invalid pairs do not',()=>{
    assert(ctx.hjPhotoHasGps({lat:0,lng:0}));
    for(const p of [{lat:36},{lat:36,lng:''},{lat:' ',lng:127},{lat:NaN,lng:127},{lat:91,lng:127},{lat:36,lng:181},{lat:false,lng:127},{lat:[36],lng:127}])assert.equal(ctx.hjPhotoHasGps(p),false);
  });
  await test('normal GPS cluster and fixed anchor survive',()=>{
    const cs=ctx.clusterPhotos([photo('a'),photo('b',true,{lat:36.103}),photo('c',true,{lat:36.106})]);
    assert.deepEqual(Array.from(cs,c=>c.items.length),[2,1]);
  });
  await test('different assigned projects cannot become one cluster',()=>{
    for(const gps of [true,false])assert.equal(ctx.clusterPhotos([photo('a',gps,{project:'TEST_A'}),photo('b',gps,{project:'TEST_B'})]).length,2);
  });
  await test('time-only partial assignment is advisory, never certain',()=>{
    const items=[photo('a',false,{project:'TEST_A'}),photo('b',false)];
    const cs=ctx.clusterPhotos(items),sg=ctx.photoSuggestFor(cs[0],{projects:[],coords:{}},cs);
    assert.equal(sg.why,'sameday');assert.equal(items[1].project,null);
  });
  await test('GPS-confirmed partial assignment remains available',()=>{
    const cs=ctx.clusterPhotos([photo('a',true,{project:'TEST_A'}),photo('b')]);
    assert.equal(ctx.photoSuggestFor(cs[0],{projects:[],coords:{}},cs).why,'partial');
  });
  await test('stale mixed GPS cluster cannot recommend unlocated items as GPS matches',()=>{
    const c=group([photo('a'),photo('b',false)]);
    assert.equal(ctx.photoSuggestFor(c,{projects:[{name:'TEST_A'}],coords:{TEST_A:{lat:36.1,lng:127.1}}},[c]),null);
  });
  await test('old address stays stored but all unlocated displays say unverified',()=>{
    const p=photo('a',false,{address:'old stored address'}),cs=ctx.clusterPhotos([p]);
    assert.match(ctx.hjClusterLocationLabel(cs[0]),/위치 미확인/);
    assert.doesNotMatch(ctx.hjClusterLocationLabel(cs[0]),/old stored address/);
    assert.match(ctx.hjPhotoLocationLabel(p),/위치 미확인.*저장 주소: old stored address/);
    assert.equal(p.address,'old stored address');
  });
  for(const method of ['geocodeCluster','geocodeAllClusters','geocodeUpgradeClusters']){
    await test(method+' protects no-GPS, far coordinates and manual addresses',async()=>{
      const files=[photo('valid'),photo('unknown',false,{address:'keep unknown'}),photo('far',true,{lat:37,address:'keep far'}),photo('manual',true,{address:'test street · MANUAL'})];
      const c=group(files);if(method==='geocodeUpgradeClusters')c.address='old street';
      const preserved=JSON.stringify(files.slice(1));ctx.state.files=files;ctx.window.__clusters=[c];ctx.window.__kakaoKey='TEST_KEY';ctx.__photoCache.key='cached';
      ctx.hjLookupPlace=async()=>({addr:'TEST_LOOKUP',src:'kakao'});
      await ctx[method](c,{});
      assert.equal(files[0].address,'TEST_LOOKUP');assert.equal(JSON.stringify(files.slice(1)),preserved);
      assert.equal(ctx.__photoCache.key,null);assert(files.every(p=>p.project===null));
    });
  }
  for(const change of ['gps','project','address','restore','remove','cluster']){
    await test('late response ignores '+change+' changes',async()=>{
      const p=photo('a'),c=group([p]);ctx.state.files=[p];
      let release;ctx.hjLookupPlace=()=>new Promise(r=>{release=r;});
      const pending=ctx.geocodeCluster(c,{});
      if(change==='gps')p.lat=38;
      if(change==='project')p.project='TEST_OTHER';
      if(change==='address')p.address='new manual address';
      if(change==='restore')ctx.state.files=[{...p}];
      if(change==='remove')ctx.state.files=[];
      if(change==='cluster')c.lat=38;
      const before=JSON.stringify(ctx.state.files),old=p.address;
      release({addr:'LATE_RESULT'});await pending;
      assert.equal(JSON.stringify(ctx.state.files),before);assert.equal(p.address,old);
    });
  }
  await test('building name cannot be copied into a stale mixed cluster',()=>{
    const items=[photo('a'),photo('b',false)],c=group(items);ctx.prompt=()=>{throw Error('must not prompt');};
    ctx.setClusterBuilding(c);assert(items.every(p=>p.address===null));
  });
  console.log(`SUMMARY ${passed}/${passed+failed}`);process.exitCode=failed?1:0;
})();

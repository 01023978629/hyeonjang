/* Opt-in receipt archive. Reuses the existing offline relay harness, never live I/O.
 * HJ_MEDIA_ARCHIVE_MUTATION selects a deliberate regression (must exit nonzero). */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const original=fs.readFileSync(path.join(__dirname,'../apps-script/MediaRelay.gs'),'utf8').replace(/\r\n/g,'\n');
const mutations={
  readback:["if (shard.file.getBlob().getDataAsString('UTF-8') !== raw)","if (false)"],
  lostShard:["if (index.split(',').indexOf(shard) >= 0 && !marker)","if (false)"],
  root:["if (root.getId() !== rootId)","if (false)"],
  receipt:["if (raw === null) return archive ? mediaArchiveRead_(archive, uploadId).jobs[uploadId] || null : null;","if (raw === null) return null;"],
  sticky:["if (p.getProperty('MEDIA_RELAY_ARCHIVE_ENABLED') !== 'true' && !used)","if (p.getProperty('MEDIA_RELAY_ARCHIVE_ENABLED') !== 'true')"],
  preserve:["if (!previous) shard.file = ctx.folder.createFile(shard.name + Utilities.getUuid() + '.json', raw, 'application/json');","if (shard.file) shard.file.setContent(raw); else shard.file = ctx.folder.createFile(shard.name + Utilities.getUuid() + '.json', raw, 'application/json');"]
};
let source=original;
const mutation=process.env.HJ_MEDIA_ARCHIVE_MUTATION;
if(mutation){const m=mutations[mutation];assert(m&&source.includes(m[0]),'mutation target');source=source.replace(m[0],m[1]);console.log('MUTATION '+mutation);}
// The original file's test invocations are not evaluated, only its reusable harness.
const fixture=fs.readFileSync(path.join(__dirname,'media-relay-server.unit.js'),'utf8');
assert(fixture.includes('let total = 0;'));
const box={require,__dirname,module:{exports:{}},Buffer,console,process};
vm.runInNewContext(fixture.slice(0,fixture.indexOf('let total = 0;'))+'\nmodule.exports={harness,begin,chunk,id,ROOT,OUTSIDE};',box);
const base=box.module.exports;
function setup(enabled=true){
  const h=base.harness(source),archive=new Map(),FOLDER='TEST_RECEIPT_ARCHIVE_01';
  let fault='',deleted=0,seq=0;
  const folder=h.folder(FOLDER,'TEST_PRIVATE_RECEIPTS',[base.ROOT]);
  const nativeGet=h.context.DriveApp.getFileById;
  function object(row){return {getId:()=>row.id,getName:()=>row.name,getSize:()=>Buffer.byteLength(row.raw),
    getBlob:()=>({getDataAsString:()=>row.raw}),getParents:()=>{let once=true;return {hasNext:()=>once,next:()=>{once=false;return folder;}};},
    setContent:raw=>{row.raw=raw;return object(row);}};}
  folder.createFile=(name,raw)=>{
    if(fault==='before'){fault='';throw Error('TEST_PRIVATE_FAILURE');}
    const row={id:'TEST_ARCHIVE_SNAPSHOT_'+(++seq),name,raw:fault==='silent'?raw+' ':raw};
    if(fault==='silent')fault='';archive.set(row.id,row);
    if(fault==='after'){fault='';throw Error('TEST_PRIVATE_FAILURE');}
    return object(row);
  };
  h.context.DriveApp.getFileById=fid=>archive.has(fid)?object(archive.get(fid)):nativeGet(fid);
  h.context.Utilities.getUuid=()=>crypto.randomUUID();
  const props=h.context.PropertiesService.getScriptProperties();
  props.deleteProperty=key=>{deleted++;if(fault==='delete-before'){fault='';throw Error('TEST_PRIVATE_DELETE');}delete h.props[key];if(fault==='delete-after'){fault='';throw Error('TEST_PRIVATE_DELETE');}};
  if(enabled){h.props.MEDIA_RELAY_ARCHIVE_ENABLED='true';h.props.MEDIA_RELAY_ARCHIVE_ROOT_ID=base.ROOT;h.props.MEDIA_RELAY_ARCHIVE_FOLDER_ID=FOLDER;}
  return Object.assign(h,{archive,FOLDER,archiveFault:v=>{fault=v;},deleted:()=>deleted});
}
function complete(h,n){const bytes=Buffer.from('TEST_SOURCE_'+n);assert.equal(h.request('mediaUploadBegin',base.begin(bytes,n)).ok,true);const r=h.request('mediaUploadChunk',base.chunk(bytes,0,n));assert.equal(r.state,'complete');return {bytes,r};}
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS media-archive '+name);}
test('default leaves existing bounded properties behavior unchanged',()=>{
  const h=setup(false);complete(h,1);assert(h.props['MEDIA_RELAY_JOB_'+base.id(1)]);assert.equal(h.archive.size,0);
});
test('258 completed receipts and oldest retry remain one original per upload',()=>{
  const h=setup();let first;
  for(let n=1;n<=258;n++){const value=complete(h,n);if(n===1)first=value;}
  assert.equal(Object.keys(h.props).filter(k=>k.startsWith('MEDIA_RELAY_JOB_')).length,0);
  assert.equal(h.files.size,258);const created=h.stats.ids;
  const retry=h.request('mediaUploadBegin',base.begin(first.bytes));assert.equal(retry.state,'complete');assert.equal(retry.file.fileId,first.r.file.fileId);assert.equal(h.stats.ids,created);
  assert.equal(h.request('mediaUploadBegin',base.begin(Buffer.from('OTHER'),1)).error,'upload-conflict');
});
test('legacy completed property migrates only after immutable verified snapshot',()=>{
  const h=setup(false);const first=complete(h,1);const key='MEDIA_RELAY_JOB_'+base.id(1),old=h.props[key];
  h.props.MEDIA_RELAY_ARCHIVE_ENABLED='true';h.props.MEDIA_RELAY_ARCHIVE_ROOT_ID=base.ROOT;h.props.MEDIA_RELAY_ARCHIVE_FOLDER_ID=h.FOLDER;
  h.archiveFault('silent');const r=h.request('mediaUploadBegin',base.begin(Buffer.from('TWO'),2));assert.equal(r.error,'journal-write-failed');assert.equal(h.props[key],old);assert.equal(h.deleted(),0);
  assert.equal(h.request('mediaUploadBegin',base.begin(first.bytes,1)).state,'complete');assert.equal(h.request('mediaUploadStatus',{uploadId:base.id(1)}).file.fileId,first.r.file.fileId);
});
test('snapshot failures preserve prior snapshots and resumable receipt',()=>{
  for(const fault of ['before','after','silent','delete-before','delete-after']){
    const h=setup();complete(h,1);const old=[...h.archive.values()].map(x=>[x.id,x.raw]);
    const bytes=Buffer.from('TEST_TWO');assert.equal(h.request('mediaUploadBegin',base.begin(bytes,2)).ok,true);h.archiveFault(fault);
    assert.equal(h.request('mediaUploadChunk',base.chunk(bytes,0,2)).ok,false);
    old.forEach(([id,raw])=>assert.equal(h.archive.get(id).raw,raw,'previous archive snapshot must remain immutable'));
    assert.equal(h.request('mediaUploadStatus',{uploadId:base.id(2)}).state,'complete');assert.equal(h.files.size,2);
  }
});
test('missing file or pointer never admits old upload ID as new',()=>{
  for(const mode of ['file','pointer','corrupt']){
    const h=setup();const first=complete(h,1),key='MEDIA_RELAY_ARCHIVE_SHARD_00',fileId=h.props[key],ids=h.stats.ids;
    if(mode==='file')h.archive.delete(fileId);if(mode==='pointer')delete h.props[key];if(mode==='corrupt')h.archive.get(fileId).raw='{}';
    const r=h.request('mediaUploadBegin',base.begin(first.bytes));assert.equal(r.ok,false);assert.equal(h.stats.ids,ids);
  }
});
test('sticky archive root binding survives disabled flag and refuses root change',()=>{
  const h=setup();const first=complete(h,1),ids=h.stats.ids;delete h.props.MEDIA_RELAY_ARCHIVE_ENABLED;
  assert.equal(h.request('mediaUploadBegin',base.begin(first.bytes)).state,'complete');assert.equal(h.stats.ids,ids);
  h.props.DRIVE_FOLDER_ID=base.OUTSIDE;assert.equal(h.request('mediaUploadStatus',{uploadId:base.id(1)}).error,'connection-changed');
});
test('missing completed original is never recreated',()=>{
  const h=setup();const {bytes,r}=complete(h,1);h.files.delete(r.file.fileId);const ids=h.stats.ids;
  assert.equal(h.request('mediaUploadBegin',base.begin(bytes)).error,'not-found');assert.equal(h.stats.ids,ids);
});
console.log('media-journal-archive: '+passed+'/'+passed+' PASS');

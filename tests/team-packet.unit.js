'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
let source = fs.readFileSync(path.join(__dirname,'..','team-packet.js'),'utf8');
const mutation = process.env.HJ_PACKET_MUTATION;
const mutations = {
  review:["if (!bundle || bundle.reviewCurrent !== true) fail('review-required');","if (!bundle) fail('review-required');"],
  hash:["if (actual !== f.sha256) fail('hash-mismatch');","if (false) fail('hash-mismatch');"],
  escape:["return String(value).replace(/[&<>\"']/g,", "return String(value).replace(/NEVER_ESCAPES/g,"],
  csv:["out = \"'\" + out;","out = out;"],
  project:["if (id(c.projectId) !== project.id) fail('project-mismatch');", "if (false) fail('project-mismatch');"],
  'submission-current':["const current = s.fingerprint === n.fingerprint;", "const current = true;"],
  // v333 HEIC/video originals
  'video-kind':["if ((e.kind === 'video') !== f.mime.startsWith('video/')) fail('invalid-kind');", ""],
  'heic-magic':["['heic','heix','hevc','hevx','heim','heis','hevm','hevs','mif1','msf1'].includes(ascii(8,12))", "true"],
  'video-link':["'<p><a href=\"'+f.path+'\" download>동영상 원본 열기</a>'", "'<img src=\"'+f.path+'\"><p>'"]
};
if (mutation) {
  assert(mutations[mutation], 'unknown packet mutation');
  const [from,to] = mutations[mutation]; assert.equal(source.split(from).length,2,'exact mutation source'); source = source.replace(from,to);
}
function moduleWith(extra = {}) {
  const context = {Blob, Uint8Array, Uint32Array, DataView, TextEncoder, crypto:crypto.webcrypto, ...extra};
  vm.createContext(context); vm.runInContext(source,context); return context.HJTeamPacket;
}
const packet = moduleWith();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const bytes = Uint8Array.from([255,216,255,224,10,20,30,40,50]);
  const f = {id:'evidence-one',mime:'image/jpeg',name:'TEST_CUSTOMER_NAME_TEST_UNIT.jpg',sha256:sha(bytes),size:bytes.length,bytes};
  const e = {...f,projectId:'project-one',taskId:'task-one',kind:'photo',phase:'before',caption:'가상 현장 설명\n두 번째 줄',capturedDate:'2026-09-27',driveId:'FORBIDDEN_DRIVE_ID',privateUrl:'https://private.example.invalid',sessionToken:'FORBIDDEN_SESSION'};
  delete e.bytes;
  const bundle = {reviewCurrent:true,fingerprint:'f'.repeat(64),project:{id:'project-one',name:'가상 아파트',secret:'FORBIDDEN_PROJECT_SECRET'},
    claim:{id:'claim-one',projectId:'project-one',mode:'customer-support',insurerName:'TEST_INSURER',referenceNo:'TEST_REFERENCE',accidentDate:'2026-09-27',incident:'테스트 접수',cause:'시험 원인',repair:'시험 보수',items:[{kind:'cause',description:'시험 원인 교정',amount:1234},{kind:'restore',description:'시험 복구',amount:5678},{kind:'other',description:'시험 기타',amount:0}],selectedEvidenceIds:[f.id],secret:'FORBIDDEN_CLAIM_SECRET'},
    tasks:[{id:'task-one',projectId:'project-one',title:'가상 작업',status:'done',handoff:'현재 시험 보고',assigneeId:'member-one',workDate:'2026-09-27',startTime:'09:00',endTime:'10:00',history:[{at:'2026-09-27T00:00:00.000Z',status:'doing',handoff:'시험 시작',actorId:'member-one'}]}],evidence:[e],submissions:[]};
  return {bundle,files:[f]};
}
function crc(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i=0;i<8;i++) c = (c&1) ? (c>>>1)^0xedb88320 : c>>>1; } return (c^0xffffffff)>>>0; }
async function unzip(blob) {
  assert.equal(blob.type,'application/zip'); const data = Buffer.from(await blob.arrayBuffer()), end = data.length-22;
  assert.equal(data.readUInt32LE(end),0x06054b50); const count = data.readUInt16LE(end+10), centralOffset = data.readUInt32LE(end+16), entries = new Map();
  assert.equal(data.readUInt16LE(end+8),count); assert.equal(centralOffset+data.readUInt32LE(end+12),end);
  let cursor = centralOffset;
  for (let i=0;i<count;i++) {
    assert.equal(data.readUInt32LE(cursor),0x02014b50); assert.equal(data.readUInt16LE(cursor+8),0x800); assert.equal(data.readUInt16LE(cursor+10),0);
    const length = data.readUInt32LE(cursor+24), size = data.readUInt32LE(cursor+20), nameSize = data.readUInt16LE(cursor+28), local = data.readUInt32LE(cursor+42), checksum = data.readUInt32LE(cursor+16);
    assert.equal(length,size); assert.equal(data.readUInt32LE(local),0x04034b50); assert.equal(data.readUInt16LE(local+6),0x800); assert.equal(data.readUInt16LE(local+8),0);
    const name = data.subarray(cursor+46,cursor+46+nameSize).toString('utf8'); assert(!entries.has(name)); assert(!name.includes('..'));
    assert.equal(data.readUInt16LE(local+26),nameSize); assert.equal(data.subarray(local+30,local+30+nameSize).toString('utf8'),name);
    assert.equal(data.readUInt32LE(local+18),size); assert.equal(data.readUInt32LE(local+22),size); assert.equal(data.readUInt32LE(local+14),checksum);
    const bytes = data.subarray(local+30+nameSize,local+30+nameSize+size); assert.equal(crc(bytes),checksum); entries.set(name,bytes);
    cursor += 46+nameSize+data.readUInt16LE(cursor+30)+data.readUInt16LE(cursor+32);
  }
  assert.equal(cursor,end); return entries;
}
let passed = 0;
async function test(name,fn) { await fn(); passed++; console.log('PASS '+name); }
async function reject(change,pattern) { const f = fixture(); change(f); await assert.rejects(()=>packet.build(f.bundle,f.files),pattern); }
(async () => {
  await test('valid standard ZIP preserves original bytes and UTF-8 Korean text',async () => {
    const f = fixture(), before = JSON.stringify(f.bundle), bytesBefore = [...f.files[0].bytes];
    const entries = await unzip(await packet.build(f.bundle,f.files));
    assert.deepEqual([...entries.keys()],['originals/001.jpg','report.html','cost-items.csv','manifest.json','제출전-확인.txt']);
    assert.deepEqual([...entries.get('originals/001.jpg')],bytesBefore); assert.equal(JSON.stringify(f.bundle),before); assert.deepEqual([...f.files[0].bytes],bytesBefore);
    assert(Object.isFrozen(packet)); assert.deepEqual(Object.keys(packet),['build']);
    const html = entries.get('report.html').toString('utf8'), manifest = JSON.parse(entries.get('manifest.json'));
    assert(html.includes('가상 아파트')); assert(html.includes('가상 현장 설명<br>두 번째 줄')); assert(html.includes('시험 시작')); assert(html.includes('현재 시험 보고')); assert(html.includes('6,912원'));
    assert(html.includes('실제 제출 아님')); assert(html.includes('자동 전송') === false); assert(html.includes('위치') || html.includes('GPS'));
    assert(!/<script\b|<iframe\b|<object\b|<embed\b/.test(html)); assert(html.includes('default-src &#39;none&#39;') === false); assert(html.includes("default-src 'none'"));
    assert.equal(manifest.originals[0].sha256,sha(entries.get('originals/001.jpg'))); assert.equal(manifest.fingerprint,f.bundle.fingerprint);
    for (const content of ['report.html','manifest.json','cost-items.csv']) {
      const text = entries.get(content).toString('utf8'); assert(!/FORBIDDEN_|TEST_CUSTOMER_NAME_TEST_UNIT|private\.example\.invalid/.test(text),'no credential, Drive or original filename export');
    }
  });
  await test('review is fail closed',async () => { await reject(f=>{f.bundle.reviewCurrent=false;},/review-required/); await reject(f=>{delete f.bundle.reviewCurrent;},/review-required/); });
  await test('server base64url fingerprint is preserved',async()=> { const f=fixture(); f.bundle.fingerprint='A'.repeat(43); const entries=await unzip(await packet.build(f.bundle,f.files)); assert.equal(JSON.parse(entries.get('manifest.json')).fingerprint,f.bundle.fingerprint); await reject(f=>{f.bundle.fingerprint='invalid';},/invalid-fingerprint/); });
  await test('file SHA is checked against actual bytes',()=>reject(f=>{f.files[0].bytes[5]=99;},/hash-mismatch/));
  await test('metadata and supplied hash must agree',()=>reject(f=>{f.files[0].sha256='a'.repeat(64);},/hash-mismatch/));
  await test('claim and project cannot be mixed',()=>reject(f=>{f.bundle.claim.projectId='other-project';},/project-mismatch/));
  await test('evidence and task project cannot be mixed',async()=> { await reject(f=>{f.bundle.evidence[0].projectId='other';},/project-mismatch/); await reject(f=>{f.bundle.tasks[0].projectId='other';},/project-mismatch/); });
  await test('all selected files are present and no extras accepted',async()=> { await reject(f=>{f.files=[];},/selection-mismatch/); await reject(f=>{f.files[0].id='unselected';},/selection-mismatch/); });
  await test('duplicate IDs fail closed',async()=> { await reject(f=>{f.bundle.claim.selectedEvidenceIds.push('evidence-one');},/selection-mismatch/); await reject(f=>{f.bundle.evidence.push(f.bundle.evidence[0]);},/duplicate-id/); await reject(f=>{f.bundle.tasks.push(f.bundle.tasks[0]);},/duplicate-id/); });
  await test('size and metadata checks stop partial files',async()=> { await reject(f=>{f.files[0].size++;},/size-mismatch/); await reject(f=>{f.bundle.evidence[0].size++;},/size-mismatch/); await reject(f=>{f.files[0].bytes=f.files[0].bytes.slice(1);},/size-mismatch/); });
  await test('50 MiB and 50 file limits',async()=> { await reject(f=>{f.files[0].size=50*1024*1024+1;},/size-limit/); await reject(f=>{f.files[0].size=Number.MAX_SAFE_INTEGER;},/size-limit/); await reject(f=>{f.bundle.claim.selectedEvidenceIds=Array.from({length:51},(_,i)=>'e-'+i);},/invalid-list/); });
  await test('exactly 50 selected files supported',async()=> {
    const f=fixture(), base=f.files[0], e=f.bundle.evidence[0]; f.files=Array.from({length:50},(_,i)=>({...base,id:'e-'+i})); f.bundle.evidence=f.files.map(file=>({...e,id:file.id})); f.bundle.claim.selectedEvidenceIds=f.files.map(file=>file.id);
    const entries=await unzip(await packet.build(f.bundle,f.files)); assert.equal(entries.size,54); assert(entries.has('originals/050.jpg'));
  });
  await test('HTML injection is always text and not executable markup',async()=> {
    const f=fixture(), attack='<script>alert("TEST")</script><img src=x onerror=TEST>'; f.bundle.project.name=attack; f.bundle.claim.incident=attack; f.bundle.tasks[0].handoff=attack; f.bundle.evidence[0].caption=attack;
    const html=(await unzip(await packet.build(f.bundle,f.files))).get('report.html').toString('utf8'); assert(!html.includes(attack)); assert(html.includes('&lt;script&gt;')); assert(!html.includes('<script>')); assert(!html.includes('<img src=x'));
  });
  await test('CSV formulas are prefixed and fields always quoted',async()=> {
    const f=fixture(); f.bundle.claim.items=['=SUM(1,2)',' \t@TEST','+1','-1','\tTEST','plain "quote"\nnext'].map(description=>({kind:'cause',description,amount:1}));
    const text=(await unzip(await packet.build(f.bundle,f.files))).get('cost-items.csv').toString('utf8'); assert(text.startsWith('\uFEFF'));
    for(const value of ["'=SUM(1,2)","' \t@TEST","'+1","'-1","'\tTEST"]) assert(text.includes('"'+value+'"'));
    assert(text.includes('"plain ""quote""\nnext"')); assert(text.endsWith('"합계","","6"\r\n'));
  });
  await test('amounts cannot be fractional negative NaN or unsafe sums',async()=> {
    for(const amount of [-1,1.5,NaN,Infinity,'100']) await reject(f=>{f.bundle.claim.items[0].amount=amount;},/invalid-amount/);
    await reject(f=>{f.bundle.claim.items=[{kind:'cause',description:'TEST',amount:Number.MAX_SAFE_INTEGER},{kind:'restore',description:'TEST',amount:1}];},/invalid-amount/);
  });
  await test('only approved file types and their magic accepted',async()=> {
    await reject(f=>{f.files[0].mime='image/svg+xml';f.bundle.evidence[0].mime='image/svg+xml';},/invalid-mime/);
    await reject(f=>{f.files[0].mime='image/png';f.bundle.evidence[0].mime='image/png';},/invalid-file/);
    await reject(f=>{f.bundle.evidence[0].phase='invented';},/invalid-phase/);
    await reject(f=>{f.bundle.evidence[0].taskId='not-in-project';},/task-mismatch/);
  });
  await test('PDF is linked as document only, PNG and WebP originals retained',async()=> {
    const f=fixture(), samples=[['application/pdf',Buffer.from('%PDF-1.7\nTEST_ONLY'), 'document'],['image/png',Uint8Array.from([137,80,78,71,13,10,26,10,1,2]),'photo'],['image/webp',Buffer.from('RIFF____WEBPTEST_ONLY'),'photo']];
    f.files=samples.map(([mime,bytes],i)=>({id:'file-'+i,mime,size:bytes.length,sha256:sha(bytes),bytes:new Uint8Array(bytes)}));
    f.bundle.evidence=f.files.map((file,i)=>({...file,projectId:'project-one',taskId:i?'task-one':'',kind:samples[i][2],phase:i?'after':'',caption:'TEST'}));
    f.bundle.claim.selectedEvidenceIds=f.files.map(file=>file.id);
    const entries=await unzip(await packet.build(f.bundle,f.files)), html=entries.get('report.html').toString('utf8'); assert(entries.has('originals/001.pdf')); assert(entries.has('originals/002.png')); assert(entries.has('originals/003.webp')); assert(html.includes('href="originals/001.pdf"')); assert(!html.includes('src="originals/001.pdf"')); assert(!/<iframe|<embed|<object/.test(html));
    f.bundle.evidence[0].kind='photo'; await assert.rejects(()=>packet.build(f.bundle,f.files),/task-mismatch/);
  });
  await test('v333: HEIC photo and MP4/MOV/WebM video originals kept byte-exact; videos linked, never <img>; duration only if recorded',async()=> {
    const f=fixture(), heic=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypheic'),Buffer.from('TEST_ONLY')]), mp4=Buffer.concat([Buffer.from([0,0,0,32]),Buffer.from('ftypisomTEST_ONLY')]), mov=Buffer.concat([Buffer.from([0,0,0,8]),Buffer.from('wideTEST_ONLY')]), webm=Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3]);
    const samples=[['image/heic',heic,'photo'],['video/mp4',mp4,'video',12.5],['video/quicktime',mov,'video',''],['video/webm',webm,'video']];
    f.files=samples.map(([mime,bytes],i)=>({id:'media-'+i,mime,size:bytes.length,sha256:sha(bytes),bytes:new Uint8Array(bytes)}));
    f.bundle.evidence=f.files.map((file,i)=>({...file,projectId:'project-one',taskId:'task-one',kind:samples[i][2],phase:'cause',caption:'TEST_MEDIA_'+i,...(samples[i][2]==='video'?{duration:samples[i][3]}:{})}));
    f.bundle.claim.selectedEvidenceIds=f.files.map(file=>file.id);
    const entries=await unzip(await packet.build(f.bundle,f.files)), html=entries.get('report.html').toString('utf8'), manifest=JSON.parse(entries.get('manifest.json'));
    assert.deepEqual(['originals/001.heic','originals/002.mp4','originals/003.mov','originals/004.webm'].map(k=>sha(entries.get(k))),samples.map(([,b])=>sha(b)));
    for(const k of ['002.mp4','003.mov','004.webm']){assert(html.includes('<a href="originals/'+k+'" download>동영상 원본 열기</a>'));assert(!html.includes('<img src="originals/'+k));}
    assert(html.includes('길이 12.5초')); assert(html.includes('길이 정보 없음')); assert(html.includes('HEIC 원본입니다')); assert.equal(manifest.originals[1].duration,12.5); assert.equal(manifest.originals[2].duration,''); assert(!('duration' in manifest.originals[0]));
    await reject(g=>{g.files[0]={...g.files[0],mime:'image/heic'};g.bundle.evidence[0].mime='image/heic';},/invalid-file/); // JPEG bytes renamed .heic
    await reject(g=>{const b=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisomTEST')]);g.files[0]={...g.files[0],mime:'image/heic',bytes:new Uint8Array(b),size:b.length,sha256:sha(b)};Object.assign(g.bundle.evidence[0],{mime:'image/heic',size:b.length,sha256:sha(b)});},/invalid-file/); // an MP4 container is not a HEIF photo
    await reject(g=>{const b=Buffer.from('RIFF____WEBPTEST');g.files[0]={...g.files[0],mime:'video/mp4',bytes:new Uint8Array(b),size:b.length,sha256:sha(b)};Object.assign(g.bundle.evidence[0],{mime:'video/mp4',size:b.length,sha256:sha(b),kind:'video'});},/invalid-file/);
    await reject(g=>{const b=Buffer.concat([Buffer.from([0,0,0,8]),Buffer.from('ftypisom')]);g.files[0]={...g.files[0],mime:'video/mp4',bytes:new Uint8Array(b),size:b.length,sha256:sha(b)};Object.assign(g.bundle.evidence[0],{mime:'video/mp4',size:b.length,sha256:sha(b)});},/invalid-kind/); // video bytes labelled photo
  });
  await test('unselected documents do not leak',async()=> {
    const f=fixture(); f.bundle.evidence.push({...f.bundle.evidence[0],id:'not-selected',caption:'FORBIDDEN_UNSELECTED_CAPTION'});
    const entries=await unzip(await packet.build(f.bundle,f.files)); for(const file of ['manifest.json','report.html']) assert(!entries.get(file).toString('utf8').includes('FORBIDDEN_UNSELECTED_CAPTION'));
  });
  await test('selected order controls numbered file paths',async()=> {
    const f=fixture(), b=Uint8Array.from([255,216,255,1,2]); f.files.push({...f.files[0],id:'second-file',bytes:b,size:b.length,sha256:sha(b)}); f.bundle.evidence.push({...f.bundle.evidence[0],id:'second-file',size:b.length,sha256:sha(b)}); f.bundle.claim.selectedEvidenceIds=['second-file','evidence-one'];
    const entries=await unzip(await packet.build(f.bundle,f.files)); assert.equal(sha(entries.get('originals/001.jpg')),sha(b));
  });
  await test('snapshot is stable across asynchronous hashing',async()=> {
    let release; const ready = new Promise(resolve=>{release=resolve;}); const delaying=moduleWith({crypto:{subtle:{digest:async(...args)=>{await ready;return crypto.webcrypto.subtle.digest(...args);}}}}), f=fixture(), expected=sha(f.files[0].bytes);
    const pending=delaying.build(f.bundle,f.files); f.files[0].bytes[5]=100; f.bundle.evidence[0].caption='CHANGED_DURING_HASH'; release(); const entries=await unzip(await pending); assert.equal(sha(entries.get('originals/001.jpg')),expected); assert(!entries.get('report.html').toString('utf8').includes('CHANGED_DURING_HASH'));
  });
  await test('no crypto fails closed',async()=> { const f=fixture(); await assert.rejects(()=>moduleWith({crypto:null}).build(f.bundle,f.files),/hash-unavailable/); });
  await test('manual submission is labelled unverified and export does not write it',async()=> {
    const f=fixture(); f.bundle.submissions=[{submittedDate:'2026-09-27',channel:'TEST_MANUAL',referenceNo:'TEST_ONLY_REF',fingerprint:f.bundle.fingerprint,secret:'FORBIDDEN_SUBMISSION_SECRET'}]; const before=JSON.stringify(f.bundle.submissions);
    const html=(await unzip(await packet.build(f.bundle,f.files))).get('report.html').toString('utf8'); assert(html.includes('수기 기록이며 보험사 실제 수신·접수 확인을 뜻하지 않습니다.')); assert(html.includes('TEST_MANUAL')); assert(!html.includes('FORBIDDEN_SUBMISSION_SECRET')); assert.equal(JSON.stringify(f.bundle.submissions),before);
  });
  await test('previous submission cannot imply this revised packet was submitted',async()=> {
    const f=fixture(), older='A'.repeat(43), record={submittedDate:'2026-09-26',channel:'TEST_MANUAL',referenceNo:'TEST_OLD_REFERENCE',fingerprint:older};
    f.bundle.submissions=[record];
    const oldHtml=(await unzip(await packet.build(f.bundle,f.files))).get('report.html').toString('utf8');
    assert(oldHtml.includes('이전 자료 기준 수동 기록')); assert(!oldHtml.includes('이 자료 기준 수동 기록')); assert(oldHtml.includes('기록 당시 자료 지문: '+older)); assert(oldHtml.includes('위 접수번호는 현재 자료를 제출했다는 기록이 아닙니다.')); assert(oldHtml.includes('TEST_OLD_REFERENCE'));
    f.bundle.submissions.push({...record,submittedDate:'2026-09-27',referenceNo:'TEST_CURRENT_REFERENCE',fingerprint:f.bundle.fingerprint});
    const bothHtml=(await unzip(await packet.build(f.bundle,f.files))).get('report.html').toString('utf8');
    assert(bothHtml.includes('<strong>이전 자료 기준 수동 기록</strong><p>2026-09-26 · TEST_MANUAL · TEST_OLD_REFERENCE</p>'));
    assert(bothHtml.includes('<strong>이 자료 기준 수동 기록</strong><p>2026-09-27 · TEST_MANUAL · TEST_CURRENT_REFERENCE</p>'));
    assert(bothHtml.includes('기록 당시 자료 지문: '+f.bundle.fingerprint));
  });
  await test('submission fingerprint is required and validated',async()=> {
    for(const fingerprint of [undefined,'not-a-fingerprint','<script>TEST</script>']) await reject(f=>{f.bundle.submissions=[{submittedDate:'2026-09-27',channel:'TEST_MANUAL',referenceNo:'TEST_REFERENCE',fingerprint}];},/invalid-fingerprint/);
  });
  console.log('team-packet: '+passed+'/'+passed+' PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});

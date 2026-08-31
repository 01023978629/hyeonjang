'use strict';
/* Task 3 RED: canonical terms, relay receipt/time, gate, and deterministic durable failures. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const officeSource = fs.readFileSync(path.join(root, 'apps-script-office-ops', 'OfficeOpsPure.gs'), 'utf8');
const approvalSource = fs.readFileSync(path.join(root, 'apps-script-commercial', 'CommercialApprovalPure.gs'), 'utf8')+'\n'+fs.readFileSync(path.join(root, 'apps-script-commercial', 'CommercialApproval.gs'), 'utf8');
const GOLDEN_HASH = 'd281f3a06b118ecba257558c569bb48da25869c78f0ea6fc2b42cba622e0d52f';
const GOLDEN_JSON = '{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}';
const terms = {workKind:'device-diagnosis',scope:'  욕실 누수 장비 진단  ',exclusions:['복구 공사','타일'],vatMode:'included',quotedAmount:100000,validUntil:'2026-09-30',scheduleWindow:'  2026-09-02 오후  '};
const receipt = {receiptId:'receipt_paid_order_1',subjectType:'aptOrder',subjectId:'paid_order_1',approvedTermsSha256:GOLDEN_HASH,approvalEvidenceType:'quote-file',approvalEvidenceFileId:'drive_file_1',approvalEvidenceSha256:'b'.repeat(64),approvedAt:'2026-08-31T12:00:00+09:00',approvedByRole:'customer',issuedAt:'2026-08-31T12:00:01+09:00',receiptHmac:'c'.repeat(64)};

function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(match, 'missing Task 3 function: ' + name);
  const paramsStart = source.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    if (source[index] === '(') params += 1;
    if (source[index] === ')' && --params === 0) { open = source.indexOf('{', index); break; }
  }
  let depth = 0, quote = '', escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(match.index, index + 1);
  }
  assert.fail('unbalanced function: ' + name);
}

function utilities() {
  return {
    DigestAlgorithm:{SHA_256:'SHA_256'},
    newBlob:text=>({getBytes:()=>Array.from(Buffer.from(String(text)))}),
    computeDigest:(_algorithm,bytes)=>Array.from(crypto.createHash('sha256').update(Buffer.from(bytes)).digest()).map(value=>value>127?value-256:value),
    computeHmacSha256Signature:(text,key)=>Array.from(crypto.createHmac('sha256',key).update(text).digest()).map(value=>value>127?value-256:value),
    formatDate:date=>new Date(date.getTime()+9*3600000).toISOString().replace('.000Z','+09:00'),
    getUuid:()=> '00000000-0000-4000-8000-000000000000'
  };
}
function pure(code) { const box={Utilities:utilities(),JSON,Object,Array,Number,String,Date,Math,RegExp}; vm.createContext(box); vm.runInContext(code,box); return box; }
function copy(value){return JSON.parse(JSON.stringify(value));}

const required = ['normalizeCommercialTerms','commercialNow','validateCommercialApproval','issueCommercialApproval','normalizeReceipt','officeIntakeSnapshot','durableLocalMutation','durablePaidMutation','paidCommitWriteAtomic','readPaidCommitSnapshot','guardedPersistCurrentState','resolvePaidCommitState','assertPaidLiveStateExact','persistApprovedAptOrder','persistGatedAptTransition','executePaidWorkGate','transitionAptOrderWithGate','updateCommercialTerms'];
const missing = required.filter(name => !new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').test(source));
assert.deepEqual(missing, [], 'Task 3 functions must exist before behavior tests run');

const sandbox = {console,JSON,Object,Array,Number,String,Date,Math,RegExp,Error,TypeError,Set,Map,Promise,structuredClone,PAID_COMMIT_GENERATION_PREFIX:'paid_commit_generation:',performance:{now:()=>0},crypto:{randomUUID:()=> 'nonce_0000000000000001'}};
vm.createContext(sandbox);
for(const name of ['paidPlainObject','paidExactKeys','isRealIsoDate','formatKstIso','parseStrictKstDateTime','officeOpsExactKeys','normalizeCommercialTerms','normalizeReceipt']) vm.runInContext(extractFunction(name),sandbox);
const canonical = copy(vm.runInContext('normalizeCommercialTerms('+JSON.stringify(terms)+')',sandbox));
assert.equal(JSON.stringify(canonical),GOLDEN_JSON,'browser emits exact ordered canonical JSON');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),GOLDEN_HASH,'browser canonical bytes match golden SHA-256');
const office=pure(officeSource),approval=pure(approvalSource);
const oo=copy(vm.runInContext('ooCanonicalCommercialTerms_('+JSON.stringify(terms)+')',office));
const ca=copy(vm.runInContext('caCanonicalTerms_('+JSON.stringify(terms)+')',approval));
assert.equal(oo.json,GOLDEN_JSON);assert.equal(ca.json,GOLDEN_JSON);assert.equal(oo.sha256Hex,GOLDEN_HASH);assert.equal(ca.sha256Hex,GOLDEN_HASH);
const spaced={...terms,exclusions:['  현장 협의  ','','타일']};
assert.deepEqual(copy(vm.runInContext('normalizeCommercialTerms('+JSON.stringify(spaced)+').exclusions',sandbox)),spaced.exclusions,'exclusion spaces/empties/order are preserved');
for(const invalid of [{...terms,validUntil:'2026-02-29'},{...terms,amount:1},{...terms,currency:'KRW'},{...terms,expiresAtKst:'x'},{...terms,termsSha256:GOLDEN_HASH}]){
  assert.throws(()=>vm.runInContext('normalizeCommercialTerms('+JSON.stringify(invalid)+')',sandbox),/invalid commercial terms/);
  assert.equal(vm.runInContext('ooCanonicalCommercialTerms_('+JSON.stringify(invalid)+').ok',office),false);
  assert.equal(vm.runInContext('caCanonicalTerms_('+JSON.stringify(invalid)+').ok',approval),false);
}

const clockCalls=[];let monotonic=[0,10000,60000,60000,70000],nonces=['clock_nonce_0000000001','verify_nonce_000000001'];
Object.assign(sandbox,{__commercialApproval:{lastTrustedNow:null},performance:{now:()=>monotonic.shift()},crypto:{randomUUID:()=>nonces.shift()},commercialCall:async(action,payload)=>{clockCalls.push({action,payload});return action==='commercialNow'?{ok:true,serverNowKst:'2026-08-31T12:00:00+09:00',receivedAtKst:'2026-08-31T12:00:00+09:00',nonce:payload.nonce}:{ok:true,receiptId:receipt.receiptId,serverNowKst:'2026-08-31T12:00:00+09:00',nonce:payload.nonce,verifyExpiresAtKst:'2026-08-31T12:01:00+09:00'};}});
for(const name of ['commercialNow','validateCommercialApproval','issueCommercialApproval'])vm.runInContext(extractFunction(name),sandbox);

(async()=>{
  const posts=[],transport={Date,JSON,Object,Error,Promise,Number,setTimeout,clearTimeout,fetch:async(url,init)=>{posts.push({url,init:{...init,body:JSON.parse(init.body)}});return{ok:true,json:async()=>({ok:true,receiptId:'receipt_transport'})};}};vm.createContext(transport);vm.runInContext("const __commercialApproval={url:'https://commercial.example/exec',token:'approval-token'};const COMMERCIAL_REQUEST_TIMEOUT_MS=11000;",transport);for(const name of ['commercialEnvelope','postIsolated','commercialError','commercialRequestWithTimeout','commercialCall'])vm.runInContext(extractFunction(name),transport);await transport.commercialCall('commercialNow',{nonce:'transport_nonce'});assert.deepEqual(Object.keys(posts[0].init.body),['token','action','timestamp','payload']);assert.equal(Object.hasOwn(posts[0].init,'signal'),false,'commercial transport receives no OfficeOps AbortSignal');assert.deepEqual(copy(posts[0].init.headers),{'Content-Type':'text/plain;charset=utf-8'});for(const forbidden of ['deviceId','mutationId','ts'])assert.equal(Object.hasOwn(posts[0].init.body,forbidden),false,'commercial envelope excludes '+forbidden);
  const verification=copy(await sandbox.validateCommercialApproval({subjectType:'aptOrder',subjectId:receipt.subjectId,commercialTerms:canonical,commercialApproval:receipt}));
  assert.equal(verification.useBeforeMonotonicMs,70000,'exact 10,000ms and 60,000ms boundaries are accepted conservatively');
  assert.notEqual(clockCalls[0].payload.nonce,clockCalls[1].payload.nonce,'clock and verify nonces differ');
  assert.deepEqual(Object.keys(clockCalls[1].payload),['subjectType','subjectId','commercialTerms','commercialApproval','nonce'],'verify sends exact full receipt payload');
  assert.deepEqual(Object.keys(sandbox.normalizeReceipt(receipt,receipt.subjectId)),['receiptId','subjectType','subjectId','approvedTermsSha256','approvalEvidenceType','approvalEvidenceFileId','approvalEvidenceSha256','approvedAt','approvedByRole','issuedAt','receiptHmac'],'receipt shape is exact');
  const shuffledReceipt=Object.fromEntries(Object.entries(receipt).reverse()),canonicalReceipt=copy(sandbox.normalizeReceipt(shuffledReceipt,receipt.subjectId));
  assert.deepEqual(Object.keys(canonicalReceipt),['receiptId','subjectType','subjectId','approvedTermsSha256','approvalEvidenceType','approvalEvidenceFileId','approvalEvidenceSha256','approvedAt','approvedByRole','issuedAt','receiptHmac'],'receipt output order is canonical regardless of input insertion order');
  assert.equal(JSON.stringify(canonicalReceipt),JSON.stringify(receipt),'canonical receipt bytes are stable');
  assert.throws(()=>sandbox.normalizeReceipt({...receipt,extra:true},receipt.subjectId),/invalid commercial receipt/);
  for(const bad of ['2026-02-29T12:00:00+09:00','2026-08-31T25:00:00+09:00','2026-08-31T12:00:00.000+09:00','2026-08-31T03:00:00Z'])assert.equal(sandbox.parseStrictKstDateTime(bad),null,'strict KST rejects rollover/fraction/offset');

  async function verifyScenario(options){
    const sequence=(options.sequence||[0,0,0,0,0]).slice(),ids=(options.nonces||['clock_nonce_scenario_1','verify_nonce_scenario_2']).slice(),calls=[];
    sandbox.performance={now:()=>sequence.length?sequence.shift():0};sandbox.crypto={randomUUID:()=>ids.shift()};
    sandbox.commercialCall=async(action,payload)=>{calls.push({action,payload});if(action==='commercialNow')return{ok:true,serverNowKst:options.clockTime||'2026-08-31T12:00:00+09:00',receivedAtKst:options.receivedTime||'2026-08-31T12:00:00+09:00',nonce:payload.nonce,...(options.clockExtra?{extra:true}:{})};return{ok:true,receiptId:receipt.receiptId,serverNowKst:options.verifyTime||'2026-08-31T12:00:00+09:00',nonce:options.badNonce?'wrong_verify_nonce':payload.nonce,verifyExpiresAtKst:options.expiry||'2026-08-31T12:01:00+09:00',...(options.verifyExtra?{receipt}:{})};};
    try{return{ok:true,value:copy(await sandbox.validateCommercialApproval({subjectType:options.subjectType||'aptOrder',subjectId:receipt.subjectId,commercialTerms:canonical,commercialApproval:receipt})),calls};}catch(error){return{ok:false,error:String(error.message||error),calls};}
  }
  assert.equal((await verifyScenario({sequence:[0,10001]})).ok,false,'10,001ms commercialNow is rejected');
  assert.equal((await verifyScenario({sequence:[0,0,60001]})).ok,false,'trusted clock use at 60,001ms is rejected');
  assert.equal((await verifyScenario({sequence:[0,0,0,0,10001]})).ok,false,'10,001ms verify round trip is rejected');
  assert.equal((await verifyScenario({nonces:['same_nonce_000000001','same_nonce_000000001']})).ok,false,'clock nonce cannot be reused for verify');
  assert.equal((await verifyScenario({verifyExtra:true})).ok,false,'verify response is an exact ACK and never returns a receipt');
  assert.equal((await verifyScenario({clockExtra:true,sequence:[0,0]})).ok,false,'commercialNow ACK rejects extra keys');
  assert.equal((await verifyScenario({badNonce:true})).ok,false,'verify nonce mismatch is rejected');
  assert.equal((await verifyScenario({expiry:'2026-08-31T12:01:01+09:00'})).ok,false,'verification lifetime above 60 seconds is rejected');
  assert.equal((await verifyScenario({subjectType:'project',sequence:[0]})).ok,false,'non-aptOrder subject is rejected before relay use');
  for(const bad of ['2026-02-29T12:00:00+09:00','2026-08-31T25:00:00+09:00','2026-08-31T12:00:00.000+09:00','2026-08-31T03:00:00Z'])assert.equal((await verifyScenario({clockTime:bad,sequence:[0,0]})).ok,false,'commercialNow applies strict whole-second +09:00 parsing');
  const issueCalls=[];sandbox.commercialCall=async(action,payload)=>{issueCalls.push({action,payload});return{ok:true,commercialApproval:receipt};};
  const issued=copy(await sandbox.issueCommercialApproval({subjectId:receipt.subjectId,commercialTerms:canonical,approvalEvidenceFileId:receipt.approvalEvidenceFileId,approvalEvidenceType:receipt.approvalEvidenceType,approvedAt:receipt.approvedAt,approvedByRole:receipt.approvedByRole}));
  assert.equal(issued.receiptId,receipt.receiptId,'issue alone unwraps json.commercialApproval');assert.deepEqual(issueCalls.map(call=>[call.action,Object.keys(call.payload)]),[['commercialApprovalIssue',['subjectType','subjectId','commercialTerms','approvalEvidenceFileId','approvalEvidenceType','approvedAt','approvedByRole']]],'issue payload has exactly the evidence fields');
  await assert.rejects(sandbox.issueCommercialApproval({subjectId:receipt.subjectId,commercialTerms:canonical,approvalEvidenceFileId:receipt.approvalEvidenceFileId,approvalEvidenceType:receipt.approvalEvidenceType,approvedAt:'2026-02-29T12:00:00+09:00',approvedByRole:'customer'}),/missing approval evidence/);

  assert.equal((source.match(/idbSet\s*\(\s*['"]appState['"]/g)||[]).length,0,'all appState writers use the central guarded path');
  for(const name of ['persistLocal','relayLoadDriveFiles','officeIntakePersistNow'])assert.match(extractFunction(name),/guardedPersistCurrentState/);
  assert.match(source,/pagehide[^\n]*guardedPersistCurrentState/);assert.match(source,/visibilitychange[^\n]*guardedPersistCurrentState/);
  assert.doesNotMatch(extractFunction('serializeData'),/officeIntakeData\s*\(/,'candidate serialization must not normalize or mutate live office intake state');
  assert.doesNotMatch(extractFunction('validatePaidSerializedState'),/applyData\s*\(|officeIntakeData\s*\(|\bstate\s*=/,'candidate validation is pure');
  assert.match(extractFunction('resolvePaidCommitState'),/readPaidCommitSnapshot\s*\(/,'boot resolution reads one IndexedDB snapshot helper');
  assert.equal((extractFunction('readPaidCommitSnapshot').match(/\.transaction\s*\(/g)||[]).length,1,'paid boot snapshot opens one readonly transaction');
  assert.match(extractFunction('readPaidCommitSnapshot'),/['"]readonly['"]/);
  assert.match(source,/운영 안전 기록/);assert.match(source,/결제[^<\n]*전자서명[^<\n]*권한 보안/);

  /* Deterministic staged boundary: production must call snapshot -> validate -> one atomic writer -> commit hook -> live apply. */
  const order=[];let live={aptOrders:[],projects:[],files:[],quotes:[],notes:[]},committed=null,consumed=0;
  Object.assign(sandbox,{state:live,__appStateWriteQueue:Promise.resolve(),__paidCommitPointerKey:null,__tabBC:null,hjSnapshot:async(_l,_f,allowEmpty)=>{order.push('snapshot:'+allowEmpty);return true;},serializeData:()=>({version:2,app:'현장',savedAt:'2026-08-31T00:00:00.000Z',aptOrders:copy(live.aptOrders),projects:[],files:[],quotes:[],notes:[]}),validatePaidSerializedState:value=>{order.push('validate');if(!Array.isArray(value.aptOrders))throw Error('invalid paid state');return value;},paidCommitWriteAtomic:async value=>{order.push('transaction');committed=copy(value);return {pointer:'paid_commit_generation:fake',journal:{}};},applyPaidCommittedState:value=>{order.push('apply');live.aptOrders=copy(value.aptOrders);},assertPaidLiveStateExact:()=>{order.push('exact');return true;},render:()=>order.push('render'),performance:{now:()=>0}});
  for(const name of ['withAppStateWriteLock','durableLocalMutation'])vm.runInContext(extractFunction(name),sandbox);
  const value=await sandbox.durableLocalMutation({snapshotLabel:'유상 테스트',mutateDraft:next=>{next.aptOrders.push({id:'one'});return 'ok';},beforeCommit:()=>order.push('deadline'),onCommitted:()=>{order.push('consume');consumed++;}});
  assert.equal(value,'ok');assert.deepEqual(order,['snapshot:true','deadline','validate','deadline','transaction','consume','apply','exact','render','exact']);assert.equal(committed.aptOrders.length,1);assert.equal(consumed,1);
  order.length=0;let releaseExactChecks=0;sandbox.__tabStale=false;
  sandbox.assertPaidLiveStateExact=()=>{order.push('exact');releaseExactChecks+=1;if(releaseExactChecks===2)throw Error('injected release exact failure');return true;};
  sandbox.render=()=>{order.push('render-mutate');live.notes=[{id:'unvalidated-render'}];};
  await assert.rejects(sandbox.durableLocalMutation({snapshotLabel:'유상 렌더 경계',mutateDraft:next=>{next.aptOrders.push({id:'two'});return 'never';}}),/injected release exact failure/);
  assert.equal(sandbox.__tabStale,true,'failed final exact check marks the paid tab stale before releasing the lock');
  assert.deepEqual(committed.notes,[],'render-time live mutation never enters the already committed paid generation');
  assert.deepEqual(order,['snapshot:true','validate','transaction','apply','exact','render-mutate','exact']);
  const before=copy(live);sandbox.__tabStale=false;sandbox.paidCommitWriteAtomic=async()=>{order.push('transaction-fail');throw Error('abort');};
  await assert.rejects(sandbox.durableLocalMutation({snapshotLabel:'유상 실패',mutateDraft:next=>{next.aptOrders.push({id:'two'});},onCommitted:()=>consumed++}),/abort/);
  assert.deepEqual(live,before,'transaction failure leaves live state unchanged');assert.equal(consumed,1,'transaction failure does not consume an ACK');
  console.log('PASS  commercial canonical, relay gate, and deterministic durable failures');
})().catch(error=>{console.error('FAIL',error&&error.stack||error);process.exitCode=1;});

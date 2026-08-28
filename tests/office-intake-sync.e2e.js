/* office-intake-sync.e2e.js — relay 접수함은 누락을 지우지 않고, 상태 회신은 확인된 성공만 제거한다. */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398';
const TOKEN = 'test-token-123';

(async () => {
  await fetch(MOCK + '/__reset');
  const launchOpts = process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {};
  if (!launchOpts.executablePath && process.platform !== 'win32') launchOpts.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(({ url, token }) => {
    __relay.url = url; __relay.token = token; __relay.device = 'test-office-sync';
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
  }, { url: MOCK, token: TOKEN });

  const afterSync = await page.evaluate(async () => {
    await officeIntakeSync();
    const d = officeIntakeData(); return { n: d.inbox.length, cursor: d.cursor, error: d.lastError };
  });
  assert.equal(afterSync.n, 1, 'inbox count');
  assert.ok(afterSync.cursor, 'cursor stored');
  assert.equal(afterSync.error, '', 'sync error cleared');

  // Break caught: office access uses the stable local office id; rotating a PIN revokes old sessions and never persists the PIN.
  const officeAccess = await page.evaluate(async () => {
    state.aptOffices = [{ id: 'of1', complex: '예시 아파트', manager: '', phone: '' }];
    aptOrderManage('of1');
    const visible = !!document.querySelector('.apoOfficeAccess[data-id="of1"]');
    closeModal();
    const before = await cloudOfficeAdmin('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: true });
    const rotated = await officeIntakeOfficeAccess('of1', 'rotate');
    const after = await cloudOfficeAdmin('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: true });
    const server = await (await fetch(__relay.url + '/__state')).json();
    const persisted = JSON.stringify({ state, local: Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]) });
    return { visible, before, rotated, after, persistedPin: /\b\d{6}\b/.test(persisted), responseVersionFields:[before.office,rotated.office,after.office].map(office=>Object.hasOwn(office,'sessionVersion')), storedSessionVersion:server.officeConfig[0].sessionVersion };
  });
  assert.equal(officeAccess.visible, true, 'office list exposes the access administration control');
  assert.equal(officeAccess.before.ok, true, 'admin upsert accepts the stable aptOffices id');
  assert.equal(officeAccess.rotated.ok, true, 'PIN rotation returns a one-time result');
  assert.match(officeAccess.rotated.pin, /^\d{6}$/, 'PIN rotation result is a six digit display value');
  assert.deepEqual(officeAccess.responseVersionFields,[false,false,false],'admin API projection matches production and never exposes sessionVersion');
  assert.equal(officeAccess.storedSessionVersion,2,'PIN rotation still increments the server-only sessionVersion');
  assert.equal(officeAccess.persistedPin, false, 'one-time PIN must not enter serialized state or local storage');

  const slugContract = await page.evaluate(async () => {
    const generated=officeIntakeOfficeSlug({id:'Ab_C 1'}),validCustom=officeIntakeOfficeSlug({id:'ignored',intakeSlug:'custom-apt'}),invalidCustom=officeIntakeOfficeSlug({id:'ignored',intakeSlug:'Custom_Apt'});
    const original=window.cloudOfficeAdmin,calls=[];
    state.aptOffices=[{id:'invalid-office',complex:'안전 단지',intakeSlug:'Custom_Apt',intakeEnabled:false}];
    window.cloudOfficeAdmin=async function(action,payload){calls.push({action,payload});return {ok:true,office:{id:'invalid-office',slug:'custom-apt',enabled:false}};};
    const result=await officeIntakeOfficeAccess('invalid-office');
    window.cloudOfficeAdmin=original;
    return {generated,validCustom,invalidCustom,result,calls};
  });
  assert.deepEqual(slugContract,{generated:'office-ab-c-1',validCustom:'custom-apt',invalidCustom:'',result:{ok:false,error:'invalid-input'},calls:[]},'client slug generation and explicit custom validation match the lowercase portal contract and fail closed before admin mutation');

  const disablePersist = await page.evaluate(async () => {
    state.aptOffices=[{ id: 'of1', complex: '예시 아파트', manager: '', phone: '', intakeEnabled:true }];
    const office = state.aptOffices[0];
    const disabled = await officeIntakeOfficeAccess('of1', 'disable');
    const local = office.intakeEnabled;
    await officeIntakeOfficeAccess('of1'); closeModal();
    const remote = await cloudOfficeAdmin('officeAdminUpsert', { id:'of1', slug:'sample-apt', complexName:'예시 아파트', enabled:false });
    return { disabled, local, remote };
  });
  assert.equal(disablePersist.disabled.ok, true);
  assert.equal(disablePersist.local, false, 'disable result updates local office intakeEnabled');
  assert.equal(disablePersist.remote.office.enabled, false, 'reopen never silently reactivates a disabled office');

  // RED: an old/partial admin response that omits enabled must fail closed.  It
  // cannot flip a locally disabled office or make the next upsert send true.
  const partialAdmin = await page.evaluate(async () => {
    const office = state.aptOffices[0]; office.intakeEnabled = false;
    const applied = officeIntakeApplyOfficeAdminResult(office, { ok:true, office:{ id:'of1', slug:'sample-apt' } });
    const original = window.cloudOfficeAdmin, calls = [];
    window.cloudOfficeAdmin = async function(action,payload){ calls.push({action,payload:JSON.parse(JSON.stringify(payload||{}))}); return {ok:true,office:{id:'of1',slug:'sample-apt'}}; };
    await officeIntakeOfficeAccess('of1'); closeModal();
    window.cloudOfficeAdmin = original;
    return { applied, local:office.intakeEnabled, sentEnabled:calls[0]&&calls[0].payload.enabled };
  });
  assert.deepEqual(partialAdmin, { applied:false, local:false, sentEnabled:false }, 'missing enabled is never interpreted as enabled=true');

  await fetch(MOCK + '/__officeLegacyConfig?officeId=of1&disabled=0');
  const legacyActive = await page.evaluate(() => cloudOfficeAdmin('officeRotatePin',{officeId:'of1'}));
  await fetch(MOCK + '/__officeLegacyConfig?officeId=of1&disabled=1');
  const legacyDisabled = await page.evaluate(() => cloudOfficeAdmin('officeRotatePin',{officeId:'of1'}));
  assert.deepEqual({active:legacyActive.office.enabled,disabled:legacyDisabled.office.enabled},{active:true,disabled:false},'mock admin projection matches production legacy enabled/disabled semantics');
  const legacyReenabled = await page.evaluate(() => cloudOfficeAdmin('officeAdminUpsert',{id:'of1',slug:'sample-apt',complexName:'예시 아파트',enabled:true}));
  assert.equal(legacyReenabled.office.enabled,true,'admin upsert clears the legacy disabled flag when explicitly enabled');

  const merged = await page.evaluate(async () => {
    const d = officeIntakeData();
    d.inbox.push({ requestId: 'local-only', updatedAt: '2026-08-26T08:00:00+09:00' });
    d.inbox[0].description = 'old local value'; d.inbox[0].updatedAt = '2026-08-26T08:00:00+09:00';
    d.cursor = ''; await officeIntakeSync();
    const request = officeIntakeFindRequest('req-1');
    return { n: d.inbox.length, description: request.description, cursor: d.cursor };
  });
  assert.equal(merged.n, 2, 'paged response never removes omitted local record');
  assert.equal(merged.description, '천장에서 물이 떨어집니다.', 'newest updatedAt wins merge');
  assert.equal(merged.cursor, afterSync.cursor, 'cursor stays stable when the same page is read again');

  const blockMock = url => String(url).startsWith(MOCK);
  await page.route(blockMock, route => route.abort());
  const queued = await page.evaluate(() => {
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'needs_info', reason: '사진 보완' });
    return officeIntakeData().outbox.map(x => ({ action: x.action, attempts: x.attempts, lastError: x.lastError, hasId: !!x.id, hasCreatedAt: !!x.createdAt }));
  });
  assert.deepEqual(queued, [{ action: 'officeSetStatus', attempts: 0, lastError: '', hasId: true, hasCreatedAt: true }], 'durable outbox shape');
  const failed = await page.evaluate(async () => {
    await officeIntakeFlush(); const d = officeIntakeData(); return { n: d.outbox.length, attempts: d.outbox[0].attempts, error: d.outbox[0].lastError, overall: d.lastError };
  });
  assert.equal(failed.n, 1, 'network failure keeps queued status');
  assert.equal(failed.attempts, 1, 'failure increments attempts once');
  assert.ok(failed.error && failed.overall, 'failure stores sanitized error');
  await page.unroute(blockMock);

  const flushed = await page.evaluate(async () => {
    const result = await Promise.all([officeIntakeFlush(), officeIntakeFlush()]);
    const d = officeIntakeData(); return { result, n: d.outbox.length, error: d.lastError };
  });
  assert.equal(flushed.n, 0, 'only explicit ok:true removes queued status: ' + JSON.stringify(flushed));
  assert.equal(flushed.error, '', 'success clears last error');
  const mock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(mock.officeStatuses.length, 1, 'concurrent flush does not deliver a successful status twice');
  assert.equal(mock.officeStatusCalls, 1, 'reentry guard makes one relay delivery, not merely an idempotent server result');
  assert.equal(mock.officeStatuses[0].status, 'needs_info', 'oldest queued payload delivered');

  const authStop = await page.evaluate(async () => {
    const d = officeIntakeData();
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'on_hold' });
    officeIntakeQueue('officeAccept', { requestId: 'req-1', hyeonjangOrderId: 'order-auth-stop' });
    __relay.token = 'wrong-token'; await officeIntakeFlush(); __relay.token = 'test-token-123';
    const result = d.outbox.map(x => ({ action: x.action, attempts: x.attempts, error: x.lastError }));
    d.outbox = []; d.lastError = '';
    return result;
  });
  assert.deepEqual(authStop, [
    { action: 'officeSetStatus', attempts: 1, error: '인증 오류' },
    { action: 'officeAccept', attempts: 0, error: '' }
  ], 'authorization error stops a continuous outbox retry and leaves later work untouched');

  // RED: invalid completion-photo manifests are semantic, user-correctable
  // blockers.  Strict FIFO stops at the first blocked revision.  A strictly
  // newer correction atomically removes that blocker and every obsolete later
  // revision for the same request while preserving unrelated work order.
  const blockedCompletion = await page.evaluate(async () => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    officeIntakeQueue('officeSetStatus', { requestId:'blocked-photo', status:'completed', projectionRevision:2, completionPhotoIds:['missing-drive-id'], completionReport:{summary:'완료',photoIds:['missing-drive-id'],publicPhotoIds:[]} });
    officeIntakeQueue('officeSetStatus', { requestId:'blocked-photo', status:'billed', projectionRevision:3, completionPhotoIds:['missing-drive-id'], completionReport:{summary:'완료',photoIds:['missing-drive-id'],publicPhotoIds:[]} });
    officeIntakeQueue('officeSetStatus', { requestId:'other-order', status:'visit_scheduled', projectionRevision:1 });
    const original = window.relayCall, statusCalls=[];
    window.relayCall = async function(action,payload){
      statusCalls.push(payload.requestId==='blocked-photo'?payload.projectionRevision:'other');
      if(payload.requestId==='blocked-photo')return {ok:false,error:'invalid-completion-photos'};
      return {ok:true};
    };
    const firstSent=await officeIntakeFlush();
    const first=officeIntakeData().outbox.map(item=>({requestId:item.payload.requestId,revision:item.payload.projectionRevision,blocked:item.blocked===true,code:item.blockedCode||'',attempts:item.attempts}));
    const secondSent=await officeIntakeFlush();
    const html=officeIntakeOperationalErrorHtml();
    officeIntakeQueue('officeSetStatus', { requestId:'blocked-photo', status:'completed', projectionRevision:4, completionPhotoIds:[], completionReport:{summary:'수정 완료',photoIds:[],publicPhotoIds:[]} });
    const afterCorrection=officeIntakeData().outbox.map(item=>({requestId:item.payload.requestId,revision:item.payload.projectionRevision,blocked:item.blocked===true}));
    window.relayCall = async function(action,payload){statusCalls.push(payload.requestId==='blocked-photo'?payload.projectionRevision:'other');return {ok:true};};
    const correctedSent=await officeIntakeFlush();
    window.relayCall = original;
    return {firstSent,first,secondSent,statusCalls,html,afterCorrection,correctedSent,remaining:officeIntakeData().outbox.length};
  });
  assert.equal(blockedCompletion.firstSent, 0, 'strict FIFO sends nothing after the semantic blocker');
  assert.deepEqual(blockedCompletion.first, [
    {requestId:'blocked-photo',revision:2,blocked:true,code:'invalid-completion-photos',attempts:1},
    {requestId:'blocked-photo',revision:3,blocked:false,code:'',attempts:0},
    {requestId:'other-order',revision:1,blocked:false,code:'',attempts:0}
  ], 'blocked head and every dependent/unrelated later item remain durable');
  assert.equal(blockedCompletion.secondSent, 0, 'blocked item is not retried automatically');
  assert.deepEqual(blockedCompletion.statusCalls.slice(0,1), [2], 'rev3 is never probed while rev2 is blocked');
  assert.match(blockedCompletion.html, /사진.*수정/, 'UI explains that photo selection or manifest correction is required');
  assert.deepEqual(blockedCompletion.afterCorrection, [
    {requestId:'other-order',revision:1,blocked:false},
    {requestId:'blocked-photo',revision:4,blocked:false}
  ], 'correction removes rev2 and obsolete rev3 while preserving unrelated FIFO');
  assert.equal(blockedCompletion.correctedSent, 2);
  assert.deepEqual(blockedCompletion.statusCalls, [2,'other',4], 'only the latest corrected revision is sent after the blocker');
  assert.equal(blockedCompletion.remaining, 0, 'corrected projection flushes successfully without false success for the blocked revision');

  const inFlightCorrection = await page.evaluate(async () => {
    state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    officeIntakeQueue('officeSetStatus',{requestId:'in-flight-photo',status:'completed',projectionRevision:2,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}});
    const original=window.relayCall,calls=[];let release;
    window.relayCall=function(action,payload){calls.push(payload.projectionRevision);return new Promise(resolve=>{release=resolve;});};
    const flushing=officeIntakeFlush();
    officeIntakeQueue('officeSetStatus',{requestId:'in-flight-photo',status:'completed',projectionRevision:3,completionPhotoIds:[],completionReport:{summary:'수정',photoIds:[],publicPhotoIds:[]}});
    release({ok:false,error:'invalid-completion-photos'});
    const firstSent=await flushing;
    const afterFirst=officeIntakeData().outbox.map(item=>({revision:item.payload.projectionRevision,blocked:item.blocked===true}));
    const html=officeIntakeOperationalErrorHtml();
    window.relayCall=async function(action,payload){calls.push(payload.projectionRevision);return {ok:true};};
    const secondSent=await officeIntakeFlush();window.relayCall=original;
    return {firstSent,afterFirst,html,secondSent,calls,remaining:officeIntakeData().outbox.length};
  });
  assert.deepEqual(inFlightCorrection,{firstSent:0,afterFirst:[{revision:3,blocked:false}],html:'',secondSent:1,calls:[2,3],remaining:0},'a correction queued while the failed revision is in flight immediately supersedes the new blocker');

  // RED: correcting completion data on an order that is already billed/paid
  // must rebuild every required server transition.  Keeping only the latest
  // billed/paid projection would try to jump directly from in_progress.
  const correctionChains = await page.evaluate(async () => {
    function seed(status,revision){
      state.officeIntake={inbox:[],cursor:'',outbox:[
        {id:'blocked-'+status,action:'officeSetStatus',payload:{requestId:'chain-'+status,status:'completed',projectionRevision:2,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:1,lastError:'사진 오류',blocked:true,blockedCode:'invalid-completion-photos'},
        {id:'dependent-'+status,action:'officeSetStatus',payload:{requestId:'chain-'+status,status:'billed',projectionRevision:3},createdAt:'2026-08-27T00:00:01.000Z',attempts:0,lastError:''}
      ],lastSyncAt:'',lastError:''};
      const order={id:'order-'+status,source:'office-intake',sourceRequestId:'chain-'+status,status,project:'',text:'수리 완료',completionSummary:'수정 보고',publicAmount:120000,publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:revision,officeProjectionFingerprint:'stale'};
      state.aptOrders=[order];state.files=[];return order;
    }
    const built={};
    for(const row of [['done',3],['billed',3],['paid',4]]){
      const order=seed(row[0],row[1]);officeIntakeQueueOrderStatus(order);
      built[row[0]]={statuses:officeIntakeData().outbox.map(item=>item.payload.status),revisions:officeIntakeData().outbox.map(item=>item.payload.projectionRevision),orderRevision:order.officeProjectionRevision,summaries:officeIntakeData().outbox.map(item=>item.payload.completionReport&&item.payload.completionReport.summary)};
    }
    const billedOrder=seed('billed',3);officeIntakeQueueOrderStatus(billedOrder);
    const original=window.relayCall,billedCalls=[];let remote='in_progress';
    window.relayCall=async function(action,payload){billedCalls.push([payload.status,payload.projectionRevision]);const allowed={in_progress:'completed',completed:'billed'};if(allowed[remote]!==payload.status)return {ok:false,error:'invalid-transition'};remote=payload.status;return {ok:true,status:remote,projectionRevision:payload.projectionRevision};};
    const billedSent=await officeIntakeFlush();
    const billedResult={sent:billedSent,calls:billedCalls.slice(),remote,remaining:officeIntakeData().outbox.length};

    const paidOrder=seed('paid',4);state.officeIntake.outbox[0].blocked=false;state.officeIntake.outbox[0].attempts=0;state.officeIntake.outbox.push({id:'paid-tail',action:'officeSetStatus',payload:{requestId:'chain-paid',status:'paid',projectionRevision:4},createdAt:'2026-08-27T00:00:02.000Z',attempts:0,lastError:''});
    let release;const paidCalls=[];window.relayCall=function(action,payload){paidCalls.push([payload.status,payload.projectionRevision]);return new Promise(resolve=>{release=resolve;});};
    const inflight=officeIntakeFlush();officeIntakeQueueOrderStatus(paidOrder);release({ok:false,error:'invalid-completion-photos'});await inflight;
    const paidAfter=officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision]);
    remote='in_progress';window.relayCall=async function(action,payload){paidCalls.push([payload.status,payload.projectionRevision]);const allowed={in_progress:'completed',completed:'billed',billed:'paid'};if(allowed[remote]!==payload.status)return {ok:false,error:'invalid-transition'};remote=payload.status;return {ok:true,status:remote,projectionRevision:payload.projectionRevision};};
    const paidSent=await officeIntakeFlush();window.relayCall=original;
    const paidResult={after:paidAfter,sent:paidSent,calls:paidCalls.slice(1),remaining:officeIntakeData().outbox.length};
    const duplicateOrder={id:'order-duplicate',source:'office-intake',sourceRequestId:'chain-duplicate',status:'recv',officeProjectionRevision:1,officeProjectionFingerprint:'old'};
    const editedOrder={id:'order-edited',source:'office-intake',sourceRequestId:'chain-duplicate',status:'paid',project:'',text:'수리 완료',completionSummary:'중복 정리 보고',publicAmount:120000,publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:4,officeProjectionFingerprint:'stale'};
    state.officeIntake={inbox:[],cursor:'',outbox:[
      {id:'duplicate-blocked',action:'officeSetStatus',payload:{requestId:'chain-duplicate',status:'completed',projectionRevision:2,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:1,lastError:'사진 오류',blocked:true,blockedCode:'invalid-completion-photos'},
      {id:'duplicate-dependent',action:'officeSetStatus',payload:{requestId:'chain-duplicate',status:'billed',projectionRevision:3},createdAt:'2026-08-27T00:00:01.000Z',attempts:0,lastError:''}
    ],lastSyncAt:'',lastError:''};
    state.aptOrders=[duplicateOrder,editedOrder];state.files=[];
    officeIntakeQueueOrderStatus(editedOrder);
    const duplicates={revisions:state.aptOrders.map(order=>order.officeProjectionRevision),chain:officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision])};

    function seedRelative(blockedStatus,targetStatus){
      state.officeIntake={inbox:[],cursor:'',outbox:[{id:'relative-'+blockedStatus,action:'officeSetStatus',payload:{requestId:'relative-'+blockedStatus,status:blockedStatus,projectionRevision:11,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:1,lastError:'사진 오류',blocked:true,blockedCode:'invalid-completion-photos'}],lastSyncAt:'',lastError:''};
      const order={id:'relative-order-'+blockedStatus,source:'office-intake',sourceRequestId:'relative-'+blockedStatus,status:targetStatus,project:'',text:'수리 완료',completionSummary:'상태 유지 보고',publicAmount:120000,publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:11,officeProjectionFingerprint:'stale'};
      state.aptOrders=[order];state.files=[];officeIntakeQueueOrderStatus(order);return order;
    }
    const relative={};
    seedRelative('billed','paid');
    relative.billedBuilt=officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision]);
    remote='billed';const relativeCalls=[];window.relayCall=async function(action,payload){relativeCalls.push([payload.status,payload.projectionRevision]);const allowed={billed:['billed','paid'],paid:['paid']};if(!allowed[remote].includes(payload.status))return {ok:false,error:'invalid-transition'};remote=payload.status;return {ok:true,status:remote,projectionRevision:payload.projectionRevision};};
    relative.billedSent=await officeIntakeFlush();relative.billedCalls=relativeCalls.slice();relative.billedRemaining=officeIntakeData().outbox.length;
    seedRelative('paid','paid');
    relative.paidBuilt=officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision]);
    remote='paid';relativeCalls.length=0;
    relative.paidSent=await officeIntakeFlush();relative.paidCalls=relativeCalls.slice();relative.paidRemaining=officeIntakeData().outbox.length;

    state.officeIntake={inbox:[],cursor:'',outbox:[{id:'relative-inflight',action:'officeSetStatus',payload:{requestId:'relative-inflight',status:'billed',projectionRevision:11,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:0,lastError:''}],lastSyncAt:'',lastError:''};
    const relativeInflightOrder={id:'relative-inflight-order',source:'office-intake',sourceRequestId:'relative-inflight',status:'paid',project:'',text:'수리 완료',completionSummary:'상태 유지 보고',publicAmount:120000,publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:11,officeProjectionFingerprint:'stale'};
    state.aptOrders=[relativeInflightOrder];state.files=[];let releaseRelative;window.relayCall=function(){return new Promise(resolve=>{releaseRelative=resolve;});};
    const relativeFlushing=officeIntakeFlush();officeIntakeQueueOrderStatus(relativeInflightOrder);releaseRelative({ok:false,error:'invalid-completion-photos'});await relativeFlushing;
    relative.inflightBuilt=officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision]);
    remote='billed';relativeCalls.length=0;window.relayCall=async function(action,payload){relativeCalls.push([payload.status,payload.projectionRevision]);const allowed={billed:['billed','paid'],paid:['paid']};if(!allowed[remote].includes(payload.status))return {ok:false,error:'invalid-transition'};remote=payload.status;return {ok:true,status:remote,projectionRevision:payload.projectionRevision};};
    relative.inflightSent=await officeIntakeFlush();relative.inflightCalls=relativeCalls.slice();relative.inflightRemaining=officeIntakeData().outbox.length;window.relayCall=original;
    return {built,billed:billedResult,paid:paidResult,duplicates,relative};
  });
  assert.deepEqual(correctionChains.built.done,{statuses:['completed'],revisions:[4],orderRevision:4,summaries:['수정 보고']},'done correction rebuilds completed only');
  assert.deepEqual(correctionChains.built.billed,{statuses:['completed','billed'],revisions:[4,5],orderRevision:5,summaries:['수정 보고','수정 보고']},'billed correction rebuilds completed then billed');
  assert.deepEqual(correctionChains.built.paid,{statuses:['completed','billed','paid'],revisions:[5,6,7],orderRevision:7,summaries:['수정 보고','수정 보고','수정 보고']},'paid correction rebuilds completed, billed, then paid');
  assert.deepEqual(correctionChains.billed,{sent:2,calls:[['completed',4],['billed',5]],remote:'billed',remaining:0},'corrected billed order reaches relay through the legal chain');
  assert.deepEqual(correctionChains.paid,{after:[['completed',5],['billed',6],['paid',7]],sent:3,calls:[['completed',5],['billed',6],['paid',7]],remaining:0},'in-flight paid correction replaces stale work with a legal sequential chain');
  assert.deepEqual(correctionChains.duplicates,{revisions:[7,7],chain:[['completed',5],['billed',6],['paid',7]]},'correction advances every duplicate local order for the same request to the authoritative final revision');
  assert.deepEqual(correctionChains.relative,{billedBuilt:[['billed',12],['paid',13]],billedSent:2,billedCalls:[['billed',12],['paid',13]],billedRemaining:0,paidBuilt:[['paid',12]],paidSent:1,paidCalls:[['paid',12]],paidRemaining:0,inflightBuilt:[['billed',12],['paid',13]],inflightSent:2,inflightCalls:[['billed',12],['paid',13]],inflightRemaining:0},'completion correction starts at the failed remote status and never reverses billed or paid');

  // RED: revision ownership is request-scoped, not whichever duplicate order
  // the operator happens to edit.  Rebase above every duplicate/outbox value
  // and advance all local remnants together.
  const duplicateRebase = await page.evaluate(() => {
    state.officeIntake={inbox:[],cursor:'',outbox:[{id:'rev-six',action:'officeSetStatus',payload:{requestId:'rebase-request',status:'completed',projectionRevision:6,completionPhotoIds:[],completionReport:{summary:'이전 보고',photoIds:[],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:0,lastError:''}],lastSyncAt:'',lastError:''};
    const low={id:'rebase-low',source:'office-intake',sourceRequestId:'rebase-request',status:'done',project:'',text:'수정',completionSummary:'새 운영자 보고',publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:1,officeProjectionFingerprint:'stale'};
    const high={id:'rebase-high',source:'office-intake',sourceRequestId:'rebase-request',status:'done',project:'',text:'이전',completionSummary:'이전 보고',publicPhotoIds:[],intakePhotoIds:[],officeProjectionRevision:6,officeProjectionFingerprint:'current'};
    state.aptOrders=[low,high];state.files=[];
    officeIntakeQueueOrderStatus(low);
    return {revisions:state.aptOrders.map(order=>order.officeProjectionRevision),queued:officeIntakeData().outbox.map(item=>[item.payload.status,item.payload.projectionRevision,item.payload.completionReport&&item.payload.completionReport.summary])};
  });
  assert.deepEqual(duplicateRebase,{revisions:[7,7],queued:[['completed',6,'이전 보고'],['completed',7,'새 운영자 보고']]},'low duplicate edit rebases above request-wide rev6 and advances every duplicate to rev7');

  // RED: a corrected higher projection may already be part of the flush
  // snapshot.  It still supersedes the failed manifest and is sent on the next
  // flush instead of leaving the stale head blocked forever.
  const snapshotCorrection = await page.evaluate(async () => {
    state.officeIntake={inbox:[],cursor:'',outbox:[
      {id:'snapshot-bad',action:'officeSetStatus',payload:{requestId:'snapshot-correction',status:'completed',projectionRevision:2,completionPhotoIds:['bad'],completionReport:{summary:'이전',photoIds:['bad'],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:00.000Z',attempts:0,lastError:''},
      {id:'snapshot-good',action:'officeSetStatus',payload:{requestId:'snapshot-correction',status:'completed',projectionRevision:3,completionPhotoIds:[],completionReport:{summary:'수정',photoIds:[],publicPhotoIds:[]}},createdAt:'2026-08-27T00:00:01.000Z',attempts:0,lastError:''}
    ],lastSyncAt:'',lastError:''};
    const original=window.relayCall,calls=[];
    window.relayCall=async function(action,payload){calls.push(payload.projectionRevision);return payload.projectionRevision===2?{ok:false,error:'invalid-completion-photos'}:{ok:true,status:'completed',projectionRevision:payload.projectionRevision};};
    const first=await officeIntakeFlush();
    const afterFirst=officeIntakeData().outbox.map(item=>({revision:item.payload.projectionRevision,blocked:item.blocked===true,summary:item.payload.completionReport&&item.payload.completionReport.summary}));
    const second=await officeIntakeFlush();window.relayCall=original;
    return {first,afterFirst,second,calls,remaining:officeIntakeData().outbox.length};
  });
  assert.deepEqual(snapshotCorrection,{first:0,afterFirst:[{revision:3,blocked:false,summary:'수정'}],second:1,calls:[2,3],remaining:0},'higher correction already in the snapshot coalesces and clears the failed FIFO head');

  await fetch(MOCK + '/__reset');
  const durable = await page.evaluate(() => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    const realDirty = window.markDirty; let dirtyCalls = 0;
    window.markDirty = () => { dirtyCalls++; };
    const RealDate = window.Date;
    class FixedDate extends RealDate { constructor(...args) { return args.length ? new RealDate(...args) : new RealDate('2026-08-26T00:00:00.000Z'); } static now() { return Date.parse('2026-08-26T00:00:00.000Z'); } }
    window.Date = FixedDate;
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'needs_info', reason: '사진 보완', extra: { a: 1, b: 2 } });
    officeIntakeQueue('officeSetStatus', { status: 'needs_info', reason: '사진 보완', extra: { b: 2, a: 1 }, requestId: 'req-1' });
    officeIntakeQueue('officeAccept', { requestId: 'req-1', hyeonjangOrderId: 'order-fifo' });
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'needs_info', reason: '사진 보완', extra: { b: 2, a: 1 } });
    window.Date = RealDate;
    const canonicalActions = officeIntakeData().outbox.map(x => x.action);
    const queueDirty = dirtyCalls;
    state.officeIntake.outbox = [
      { id: 'z-first', action: 'officeSetStatus', payload: { requestId: 'req-1', status: 'needs_info', reason: '사진 보완' }, createdAt: '2026-08-26T00:00:00.000Z', attempts: 2, lastError: '동기화 오류' },
      { id: 'a-second', action: 'officeSetStatus', payload: { requestId: 'req-1', status: 'pending_review' }, createdAt: '2026-08-26T00:00:00.000Z', attempts: 3, lastError: '인증 오류' }
    ];
    state.officeIntake.cursor = 'oi1.persisted-cursor';
    const envelope = serializeData(), saved = JSON.parse(JSON.stringify(envelope.officeIntake));
    state.officeIntake = { inbox: 'bad', outbox: 'bad', cursor: '', lastSyncAt: '', lastError: '' };
    const malformed = { inbox: Array.isArray(officeIntakeData().inbox), outbox: Array.isArray(officeIntakeData().outbox) };
    envelope.officeIntake = saved; applyData(envelope);
    const restored = officeIntakeData();
    const roundTrip = { order: restored.outbox.map(x => x.id), attempts: restored.outbox.map(x => x.attempts), errors: restored.outbox.map(x => x.lastError), cursor: restored.cursor };
    dirtyCalls = 0;
    return officeIntakeFlush().then(sent => { const flushDirty = dirtyCalls; window.markDirty = realDirty; return { canonicalActions, queueDirty, malformed, roundTrip, sent, flushDirty, remaining: officeIntakeData().outbox.length }; });
  });
  assert.deepEqual(durable.canonicalActions, ['officeSetStatus', 'officeAccept', 'officeSetStatus'], 'canonical key-sorted payloads dedupe only when adjacent; A→B→A survives');
  assert.equal(durable.queueDirty, 3, 'each persisted queue change marks data dirty while adjacent dedupe is a no-op');
  assert.deepEqual(durable.malformed, { inbox: true, outbox: true }, 'malformed legacy intake arrays normalize safely');
  assert.deepEqual(durable.roundTrip, { order: ['z-first', 'a-second'], attempts: [2, 3], errors: ['동기화 오류', '인증 오류'], cursor: 'oi1.persisted-cursor' }, 'serialize/apply roundtrip preserves durable outbox order and retry state');
  assert.equal(durable.sent, 2, 'equal createdAt entries flush in persisted insertion order');
  assert.equal(durable.remaining, 0, 'both FIFO entries acknowledged');
  assert.equal(durable.flushDirty, 1, 'flush persists its batch once without save storm');
  const fifoMock = await (await fetch(MOCK + '/__state')).json();
  assert.deepEqual(fifoMock.officeStatuses.map(x => x.status), ['needs_info', 'pending_review'], 'same-time FIFO never falls back to uid ordering');

  await fetch(MOCK + '/__reset');
  await fetch(MOCK + '/__officeDropNextStatus');
  const lostResponse = await page.evaluate(async () => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'needs_info', reason: '사진 보완' });
    await officeIntakeFlush(); const afterDrop = { n: officeIntakeData().outbox.length, attempts: officeIntakeData().outbox[0] && officeIntakeData().outbox[0].attempts };
    const serverAfterDrop = await (await fetch(__relay.url + '/__state')).json();
    const sent = await officeIntakeFlush(); return { afterDrop, sent, remaining: officeIntakeData().outbox.length, serverAfterDrop: { calls: serverAfterDrop.officeStatusCalls, statuses: serverAfterDrop.officeStatuses.length } };
  });
  assert.deepEqual(lostResponse, { afterDrop: { n: 1, attempts: 1 }, sent: 1, remaining: 0, serverAfterDrop: { calls: 1, statuses: 1 } }, 'lost response retries the same status and clears only idempotent ok:true');
  const lostMock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(lostMock.officeStatuses.length, 1, 'lost response applies status exactly once');
  assert.equal(lostMock.officeStatusCalls, 2, 'retry reaches mock server and receives idempotent success');
  const mockDifferentRetry = await page.evaluate(() => cloudOfficeSetStatus({ requestId: 'req-1', status: 'needs_info', reason: '사진 보완', visitAt: '2026-08-28T10:00:00+09:00' }));
  assert.equal(mockDifferentRetry.error, 'invalid-transition', 'mock rejects a different-payload self transition');

  await fetch(MOCK + '/__reset');
  await fetch(MOCK + '/__officeDropNextStatus');
  const strictFifo = await page.evaluate(async () => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    await cloudOfficeAccept('req-1', 'strict-fifo-order');
    officeIntakeQueue('officeSetStatus', { requestId:'req-1', status:'visit_scheduled', visitAt:'2026-08-27T10:00:00+09:00' });
    officeIntakeQueue('officeSetStatus', { requestId:'req-1', status:'in_progress', visitAt:'2026-08-27T10:00:00+09:00' });
    await officeIntakeFlush(); const first=officeIntakeData().outbox.map(x=>({status:x.payload.status,attempts:x.attempts}));
    const retry=await officeIntakeFlush(); return { first, retry, remaining:officeIntakeData().outbox.map(x=>x.payload.status) };
  });
  assert.deepEqual(strictFifo, { first:[{status:'visit_scheduled',attempts:1},{status:'in_progress',attempts:0}], retry:2, remaining:[] }, 'a dropped applied head stops strict FIFO; idempotent retry then delivers the later legal step');
  const strictFifoMock=await (await fetch(MOCK + '/__state')).json();
  assert.deepEqual(strictFifoMock.officeStatuses.map(x=>x.status), ['visit_scheduled','in_progress'], 'later state is not sent before the dropped head retry');

  // RED: a real completion relay must normalize to owned photos, expose only the
  // public subset, and replay a dropped success without a duplicate record.
  await fetch(MOCK + '/__reset');
  await fetch(MOCK + '/__officeSetPhotos?requestId=req-1&fileId=owned-completion');
  const completionRelay = await page.evaluate(async () => {
    await officeIntakeSync();
    await cloudOfficeAccept('req-1','completion-order');
    await cloudOfficeSetStatus({requestId:'req-1',status:'visit_scheduled'});
    await cloudOfficeSetStatus({requestId:'req-1',status:'in_progress'});
    const payload={requestId:'req-1',status:'completed',completionReport:{summary:'완료',photoIds:['owned-completion','foreign-photo'],publicPhotoIds:['foreign-photo','owned-completion']}};
    const first=await cloudOfficeSetStatus(payload);
    await fetch(__relay.url+'/__officeDropNextStatus');
    state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    officeIntakeQueue('officeSetStatus',payload);
    await officeIntakeFlush(); const afterDrop=officeIntakeData().outbox.length;
    const retry=await officeIntakeFlush();
    return {first,afterDrop,retry,remaining:officeIntakeData().outbox.length};
  });
  assert.deepEqual(completionRelay, {first:{ok:true,requestId:'req-1',receiptNo:'MM-20260826-0001',status:'completed',visitAt:null,publicAmount:null,completionReport:{summary:'완료',photoIds:['owned-completion'],publicPhotoIds:['owned-completion']},needsInfoReason:null,projectionRevision:completionRelay.first.projectionRevision,updatedAt:completionRelay.first.updatedAt},afterDrop:1,retry:1,remaining:0}, 'completion relay matches the internal status result, returns its durable revision, and lost-success retry clears');
  assert.equal(Number.isInteger(completionRelay.first.projectionRevision), true, 'completion response returns a durable integer projection revision');
  const completionMock=await (await fetch(MOCK + '/__state')).json();
  assert.deepEqual(completionMock.officeRequests[0].completionReport,{summary:'완료',photoIds:['owned-completion'],publicPhotoIds:['owned-completion']},'mock stores request-owned available IDs for exact idempotency');
  assert.equal(completionMock.officeStatuses.filter(row=>row.status==='completed').length,1,'completion lost-success retry adds no duplicate record');

  // Break caught: the mock follows the server's public projection contract.  A
  // reason can survive needs_info -> on_hold, but acceptance resolves it.
  await fetch(MOCK + '/__reset');
  const resolvedReason = await page.evaluate(async () => {
    const needs = await cloudOfficeSetStatus({ requestId: 'req-1', status: 'needs_info', reason: '사진 보완' });
    const hold = await cloudOfficeSetStatus({ requestId: 'req-1', status: 'on_hold' });
    const accepted = await cloudOfficeAccept('req-1', 'order-reason-resolved');
    return { needs, hold, accepted };
  });
  assert.deepEqual(resolvedReason, {
    needs: { ok: true, requestId: 'req-1', receiptNo:'MM-20260826-0001', status: 'needs_info', visitAt:null, publicAmount:null, completionReport:null, needsInfoReason: '사진 보완', projectionRevision: resolvedReason.needs.projectionRevision, updatedAt: resolvedReason.needs.updatedAt },
    hold: { ok: true, requestId: 'req-1', receiptNo:'MM-20260826-0001', status: 'on_hold', visitAt:null, publicAmount:null, completionReport:null, needsInfoReason: '사진 보완', projectionRevision: resolvedReason.hold.projectionRevision, updatedAt: resolvedReason.hold.updatedAt },
    accepted: { ok: true, requestId: 'req-1', hyeonjangOrderId: 'order-reason-resolved', status: 'accepted', projectionRevision: resolvedReason.hold.projectionRevision }
  }, 'needs_info -> on_hold -> accepted succeeds');
  assert.equal(resolvedReason.needs.projectionRevision < resolvedReason.hold.projectionRevision, true, 'status transitions advance the projection revision');
  const resolvedMock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(resolvedMock.officeRequests.find(row => row.requestId === 'req-1').needsInfoReason, null, 'acceptance clears resolved needs-info reason in mock fidelity');

  // RED: a fresh field app can receive an on-hold request with an existing
  // authoritative revision, accept it, and publish the first visit as rev+1.
  await fetch(MOCK + '/__reset');
  const preacceptRevision = await page.evaluate(async () => {
    const needs=await cloudOfficeSetStatus({requestId:'req-1',status:'needs_info',reason:'추가 사진 확인'});
    const hold=await cloudOfficeSetStatus({requestId:'req-1',status:'on_hold'});
    state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[];
    await officeIntakeSync();
    const held=officeIntakeFindRequest('req-1');
    const accepted=await officeIntakeAccept('req-1','none','');
    const order=officeIntakeFindOrder('req-1');
    order.status='visit';order.visitAt='2026-08-28T10:00:00+09:00';
    officeIntakeQueueOrderStatus(order);
    const queuedRevision=officeIntakeData().outbox[0]&&officeIntakeData().outbox[0].payload.projectionRevision;
    const sent=await officeIntakeFlush();
    const server=await (await fetch(__relay.url+'/__state')).json();
    const remote=server.officeRequests.find(row=>row.requestId==='req-1');
    return {needsRevision:needs.projectionRevision,holdRevision:hold.projectionRevision,heldRevision:held&&held.projectionRevision,accepted:!!accepted,orderRevision:order&&order.officeProjectionRevision,queuedRevision,sent,remoteStatus:remote.status,remoteRevision:remote.projectionRevision};
  });
  assert.deepEqual(preacceptRevision, {
    needsRevision:1,holdRevision:2,heldRevision:2,accepted:true,orderRevision:3,queuedRevision:3,sent:1,remoteStatus:'visit_scheduled',remoteRevision:3
  }, 'needs_info/on_hold revision is inherited, so the first visit publishes current+1 without collision');

  // RED: accept is first staged as one exact local order + one durable outbox
  // item, then delivered by the same strict FIFO dispatcher as an earlier
  // on-hold transition.  The persisted pre-send snapshot can be replayed after
  // a success/crash window without creating another order.
  const durableDirectAccept = await page.evaluate(async () => {
    const originalRelay=window.relayCall,originalIdbSet=window.idbSet,events=[],calls=[];let saved=null,persistedBeforeRelay=false;
    state.officeIntake={inbox:[{requestId:'durable-accept',status:'on_hold',photos:[],projectionRevision:1}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[];state.files=[];
    officeIntakeQueue('officeSetStatus',{requestId:'durable-accept',status:'on_hold',projectionRevision:1});
    window.idbSet=async function(key,value){events.push('persist');saved=JSON.parse(JSON.stringify(value));return true;};
    window.relayCall=async function(action,payload){persistedBeforeRelay=!!saved;calls.push(action==='officeSetStatus'?'status:'+payload.status:action);events.push('relay:'+action);return action==='officeAccept'?{ok:true,status:'accepted',hyeonjangOrderId:payload.hyeonjangOrderId,projectionRevision:1}:{ok:true,status:'on_hold',projectionRevision:1};};
    const accepted=await officeIntakeAccept('durable-accept','none','');
    const orderId=accepted&&accepted.id;
    const staged=saved&&{orders:(saved.aptOrders||[]).filter(order=>order.sourceRequestId==='durable-accept').map(order=>order.id),actions:(saved.officeIntake&&saved.officeIntake.outbox||[]).map(item=>item.action)};
    let replay={orders:0,remaining:-1,accepted:false};
    if(saved){applyData(saved);window.relayCall=async function(action,payload){return action==='officeAccept'?{ok:true,status:'accepted',hyeonjangOrderId:payload.hyeonjangOrderId,projectionRevision:1}:{ok:true,status:'on_hold',projectionRevision:1};};await officeIntakeFlush();replay={orders:state.aptOrders.filter(order=>order.sourceRequestId==='durable-accept').length,remaining:officeIntakeData().outbox.length,accepted:officeIntakeFindRequest('durable-accept').status==='accepted'};}
    clearTimeout(__idbSaveTimer);window.idbSet=originalIdbSet;window.relayCall=originalRelay;
    return {accepted:!!accepted,orderId,persistedBeforeRelay,events,calls,staged,replay};
  });
  assert.equal(durableDirectAccept.accepted,true,'durable accept returns the exact order after dispatcher acknowledgement');
  assert.equal(durableDirectAccept.persistedBeforeRelay,true,'order and accept item are awaited in IndexedDB before any relay call');
  assert.deepEqual(durableDirectAccept.calls,['status:on_hold','officeAccept'],'an already queued hold is delivered before accept through strict FIFO');
  assert.deepEqual(durableDirectAccept.staged,{orders:[durableDirectAccept.orderId],actions:['officeSetStatus','officeAccept']},'pre-send durable snapshot contains one exact order and the whole FIFO');
  assert.deepEqual(durableDirectAccept.replay,{orders:1,remaining:0,accepted:true},'pre-send snapshot replays idempotently after a server-success crash window');

  // RED: first-response invalid-input from the direct approval action uses the
  // queued classifier immediately.  It is a visible, stable, nonretry blocker
  // and never looks like successful acceptance.
  const directActionInvalid = await page.evaluate(async () => {
    const originalRelay=window.relayCall,originalIdbSet=window.idbSet;let calls=0;
    state.officeIntake={inbox:[{requestId:'direct-action-invalid',status:'pending_review',photos:[]}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[];state.files=[];
    window.idbSet=async()=>true;window.relayCall=async function(){calls++;return {ok:false,error:'invalid-input',field:'attachedUploadIds'};};
    const accepted=await officeIntakeAccept('direct-action-invalid','none','');
    const first=officeIntakeData().outbox.map(item=>({action:item.action,blocked:item.blocked===true,code:item.blockedCode||'',attempts:item.attempts}));
    const html=officeIntakeOperationalErrorHtml();await officeIntakeFlush();
    clearTimeout(__idbSaveTimer);window.idbSet=originalIdbSet;window.relayCall=originalRelay;
    return {accepted:!!accepted,calls,first,html,status:officeIntakeFindRequest('direct-action-invalid').status};
  });
  assert.deepEqual({accepted:directActionInvalid.accepted,calls:directActionInvalid.calls,first:directActionInvalid.first,status:directActionInvalid.status},{accepted:false,calls:1,first:[{action:'officeAccept',blocked:true,code:'accept-invalid-input',attempts:1}],status:'pending_review'},'direct officeIntakeAccept classifies invalid-input on the first response and does not retry');
  assert.match(directActionInvalid.html,/accept-invalid-input/,'direct invalid approval blocker is visible to the operator');

  // RED: upload completion can race the field-app accept click.  The first
  // photos-pending response triggers one fresh inbox sync, attaches only the
  // declared stored slots, and retries the exact same order with an ack.
  await fetch(MOCK + '/__reset');
  const raceIds=['a0000000-0000-4000-8000-000000000061','b0000000-0000-4000-8000-000000000062'];
  await fetch(MOCK + '/__officeDeclarePhotos?requestId=req-1&ids=' + encodeURIComponent(raceIds.join(',')));
  const uploadAcceptRace = await page.evaluate(async () => {
    state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[];state.files=[];
    await officeIntakeSync();
    const original=window.cloudOfficeAccept;let calls=0;
    window.cloudOfficeAccept=async function(requestId,orderId,attachedUploadIds){const result=await original(requestId,orderId,attachedUploadIds);if(calls++===0&&result&&result.error==='photos-pending')await fetch(__relay.url+'/__officeUploadDeclared?requestId=req-1');return result;};
    const accepted=await officeIntakeAccept('req-1','none','');
    window.cloudOfficeAccept=original;
    const order=officeIntakeFindOrder('req-1');
    const server=await (await fetch(__relay.url+'/__state')).json();
    const remote=server.officeRequests.find(row=>row.requestId==='req-1');
    return {accepted:!!accepted,localStatus:officeIntakeFindRequest('req-1')&&officeIntakeFindRequest('req-1').status,orderId:order&&order.id,photoIds:order&&order.intakePhotoIds,files:state.files.map(file=>file._driveId),remoteUploadIds:remote.photos.map(photo=>photo.uploadId),remoteStatus:remote.status,remoteOrderId:remote.hyeonjangOrderId,accepts:server.officeAccepts.length,outbox:officeIntakeData().outbox.length};
  });
  assert.equal(uploadAcceptRace.accepted, true, 'race is reconciled without another user click');
  assert.equal(uploadAcceptRace.localStatus, 'accepted');
  assert.ok(uploadAcceptRace.orderId && uploadAcceptRace.orderId===uploadAcceptRace.remoteOrderId, 'the same exact local order is linked remotely');
  assert.deepEqual(uploadAcceptRace.photoIds, ['declared-file-1','declared-file-2'], 'all declared uploads are attached by their server-owned Drive file IDs');
  assert.deepEqual(uploadAcceptRace.files, ['declared-file-1','declared-file-2'], 'only the refreshed request photos become local Drive references');
  assert.deepEqual(uploadAcceptRace.remoteUploadIds, raceIds, 'the attached Drive files retain the exact declared upload slots');
  assert.equal(uploadAcceptRace.remoteStatus, 'accepted');
  assert.equal(uploadAcceptRace.accepts, 1, 'only the successful retry creates an accept audit record');
  assert.equal(uploadAcceptRace.outbox, 0, 'photos-pending never poisons the retry queue');

  // RED: a transport failure can queue accept before photos finish.  On the
  // later photos-pending response, flush refreshes the request, attaches the
  // stored files to the same exact order, retries accept once, then preserves
  // FIFO so the queued visit follows acceptance.
  await fetch(MOCK + '/__reset');
  await fetch(MOCK + '/__officeDeclarePhotos?requestId=req-1&ids=' + encodeURIComponent(raceIds.join(',')));
  await page.evaluate(async () => {state.officeIntake={inbox:[],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[];state.files=[];await officeIntakeSync();});
  await page.route(blockMock, route => route.abort());
  const offlineAccepted = await page.evaluate(() => officeIntakeAccept('req-1','none','').then(Boolean));
  await page.unroute(blockMock);
  assert.equal(offlineAccepted, true, 'offline accept keeps one recoverable staged order');
  await fetch(MOCK + '/__officeUploadDeclared?requestId=req-1');
  const queuedPhotoAccept = await page.evaluate(async () => {
    const order=officeIntakeFindOrder('req-1');order.status='visit';order.visitAt='2026-08-29T10:00:00+09:00';officeIntakeQueueOrderStatus(order);
    const sent=await officeIntakeFlush();const server=await (await fetch(__relay.url+'/__state')).json();const remote=server.officeRequests.find(row=>row.requestId==='req-1');
    return {sent,outbox:officeIntakeData().outbox.length,orders:state.aptOrders.filter(row=>row.sourceRequestId==='req-1').length,orderId:order.id,photoIds:order.intakePhotoIds,localStatus:officeIntakeFindRequest('req-1').status,remoteStatus:remote.status,remoteOrderId:remote.hyeonjangOrderId,accepts:server.officeAccepts.length,statuses:server.officeStatuses.map(row=>row.status)};
  });
  assert.deepEqual(queuedPhotoAccept, {sent:2,outbox:0,orders:1,orderId:queuedPhotoAccept.orderId,photoIds:['declared-file-1','declared-file-2'],localStatus:'accepted',remoteStatus:'visit_scheduled',remoteOrderId:queuedPhotoAccept.orderId,accepts:1,statuses:['visit_scheduled']}, 'queued photos-pending accept reconciles the exact order and unblocks dependent status FIFO');

  const recoverablePhotoBlock = await page.evaluate(async () => {
    state.officeIntake={inbox:[{requestId:'pending-photos',status:'accepted',photos:[]}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    state.aptOrders=[{id:'pending-photo-order',source:'office-intake',sourceRequestId:'pending-photos',project:'',status:'recv',intakePhotoIds:[]}];
    officeIntakeQueue('officeAccept',{requestId:'pending-photos',hyeonjangOrderId:'pending-photo-order',attachedUploadIds:[]});
    officeIntakeQueue('officeSetStatus',{requestId:'pending-photos',status:'visit_scheduled',projectionRevision:1});
    const originalRelay=window.relayCall,originalSync=window.officeIntakeSync;let acceptCalls=0;
    window.relayCall=async function(action){if(action==='officeAccept'){acceptCalls++;return {ok:false,error:'photos-pending',status:'pending_review',projectionRevision:0};}return {ok:true};};
    window.officeIntakeSync=async function(){return true;};
    const sent=await officeIntakeFlush();
    window.relayCall=originalRelay;window.officeIntakeSync=originalSync;
    const outbox=officeIntakeData().outbox.map(item=>({action:item.action,blocked:item.blocked===true,code:item.blockedCode||'',attempts:item.attempts}));
    return {sent,acceptCalls,outbox,orders:state.aptOrders.length,status:officeIntakeFindRequest('pending-photos').status,html:officeIntakeOperationalErrorHtml()};
  });
  assert.deepEqual({sent:recoverablePhotoBlock.sent,acceptCalls:recoverablePhotoBlock.acceptCalls,outbox:recoverablePhotoBlock.outbox,orders:recoverablePhotoBlock.orders,status:recoverablePhotoBlock.status},{sent:0,acceptCalls:2,outbox:[{action:'officeAccept',blocked:true,code:'photos-pending',attempts:1},{action:'officeSetStatus',blocked:false,code:'',attempts:0}],orders:1,status:'pending_review'},'still-pending upload is retried once, keeps its exact staged order, and stops FIFO explicitly');
  assert.match(recoverablePhotoBlock.html,/사진.*업로드|업로드.*사진/,'recoverable photo block is visible to the field operator');

  const directInvalidAccept = await page.evaluate(async () => {
    state.officeIntake={inbox:[{requestId:'direct-invalid',status:'pending_review',photos:[]}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
    state.aptOrders=[{id:'direct-invalid-order',source:'office-intake',sourceRequestId:'direct-invalid',status:'recv',intakePhotoIds:[]}];
    officeIntakeQueue('officeAccept',{requestId:'direct-invalid',hyeonjangOrderId:'direct-invalid-order',attachedUploadIds:['not-canonical']});
    officeIntakeQueue('officeSetStatus',{requestId:'direct-invalid',status:'visit_scheduled',projectionRevision:1});
    const original=window.relayCall;let calls=0;window.relayCall=async function(){calls++;return {ok:false,error:'invalid-input',field:'attachedUploadIds'};};
    const first=await officeIntakeFlush();const afterFirst=officeIntakeData().outbox.map(item=>({action:item.action,blocked:item.blocked===true,code:item.blockedCode||'',attempts:item.attempts}));const html=officeIntakeOperationalErrorHtml();
    const second=await officeIntakeFlush();window.relayCall=original;
    return {first,second,calls,afterFirst,html,remaining:officeIntakeData().outbox.length};
  });
  assert.deepEqual({first:directInvalidAccept.first,second:directInvalidAccept.second,calls:directInvalidAccept.calls,afterFirst:directInvalidAccept.afterFirst,remaining:directInvalidAccept.remaining},{first:0,second:0,calls:1,afterFirst:[{action:'officeAccept',blocked:true,code:'accept-invalid-input',attempts:1},{action:'officeSetStatus',blocked:false,code:'',attempts:0}],remaining:2},'first-response invalid accept is blocked once and stops dependent FIFO without a retry loop');
  assert.match(directInvalidAccept.html,/accept-invalid-input/,'direct invalid accept exposes its stable blocked code in the operator UI');

  const acceptErrorClasses = await page.evaluate(async () => {
    const originalRelay=window.relayCall,originalSync=window.officeIntakeSync;
    function seed(){state.officeIntake={inbox:[{requestId:'accept-error',status:'pending_review',photos:[]}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};state.aptOrders=[{id:'accept-error-order',source:'office-intake',sourceRequestId:'accept-error',project:'',status:'recv',intakePhotoIds:[]}];officeIntakeQueue('officeAccept',{requestId:'accept-error',hyeonjangOrderId:'accept-error-order',attachedUploadIds:[]});}
    window.officeIntakeSync=async()=>true;
    seed();let invalidCalls=0;window.relayCall=async()=>invalidCalls++===0?{ok:false,error:'photos-pending',status:'pending_review'}:{ok:false,error:'invalid-input',field:'attachedUploadIds'};
    await officeIntakeFlush();const invalidItem=officeIntakeData().outbox[0];const invalid={code:invalidItem.blockedCode,html:officeIntakeOperationalErrorHtml(),calls:invalidCalls};
    seed();let authCalls=0;window.relayCall=async()=>authCalls++===0?{ok:false,error:'photos-pending',status:'pending_review'}:{ok:false,error:'unauthorized'};
    await officeIntakeFlush();const authItem=officeIntakeData().outbox[0];const authBlocked={code:authItem.blockedCode,html:officeIntakeOperationalErrorHtml(),calls:authCalls};
    window.relayCall=async()=>{authCalls++;return {ok:true,status:'accepted',hyeonjangOrderId:'accept-error-order',projectionRevision:0};};
    const authSent=await officeIntakeFlush();const authRetry={sent:authSent,remaining:officeIntakeData().outbox.length,calls:authCalls};
    window.relayCall=originalRelay;window.officeIntakeSync=originalSync;
    return {invalid,authBlocked,authRetry};
  });
  assert.equal(acceptErrorClasses.invalid.code,'accept-invalid-input','deterministic accept payload errors are not mislabeled as pending uploads');
  assert.match(acceptErrorClasses.invalid.html,/연결.*정보|입력.*오류/,'invalid accept block tells the operator to fix connection data');
  assert.equal(acceptErrorClasses.authBlocked.code,'accept-auth-error','authorization failure keeps a separately classified recoverable block');
  assert.match(acceptErrorClasses.authBlocked.html,/인증|설정/,'authorization block tells the operator to fix relay credentials');
  assert.deepEqual(acceptErrorClasses.authRetry,{sent:1,remaining:0,calls:3},'an explicit retry after credentials recover clears the same exact queued accept');

  // RED: the mock must reject every parser shape that production rejects.
  await fetch(MOCK + '/__reset');
  await fetch(MOCK + '/__officeDeclarePhotos?requestId=req-1&ids=' + encodeURIComponent(raceIds.join(',')));
  await fetch(MOCK + '/__officeUploadDeclared?requestId=req-1');
  const strictMockAck = await page.evaluate(async ids => {
    const variants=[[ids[0],ids[0]],ids.concat('00000000-0000-4000-8000-000000000063'),[ids[0].toUpperCase(),ids[1]],['00000000-0000-3000-8000-000000000061',ids[1]],Array.from({length:6},(_,index)=>'00000000-0000-4000-8000-'+String(80+index).padStart(12,'0')),'not-an-array'];
    const results=[];for(const value of variants)results.push(await relayCall('officeAccept',{requestId:'req-1',hyeonjangOrderId:'strict-mock-order',attachedUploadIds:value}));return results.map(result=>({error:result.error,field:result.field}));
  }, raceIds);
  assert.deepEqual(strictMockAck, Array.from({length:6},()=>({error:'invalid-input',field:'attachedUploadIds'})), 'mock attachedUploadIds parser has exact production parity: '+JSON.stringify(strictMockAck));

  const exactQueuedOrder = await page.evaluate(async () => {
    const originalRelay=window.relayCall,originalSync=window.officeIntakeSync;
    function seed(withGhost){
      state.officeIntake={inbox:[{requestId:'exact-order-request',status:'pending_review',photos:[]}],cursor:'',outbox:[],lastSyncAt:'',lastError:''};
      state.aptOrders=[{id:'order-B',source:'office-intake',sourceRequestId:'exact-order-request',status:'recv',officeProjectionRevision:0,intakePhotoIds:[]}];
      if(withGhost)state.aptOrders.push({id:'order-A',source:'office-intake',sourceRequestId:'exact-order-request',status:'recv',officeProjectionRevision:0,intakePhotoIds:[]});
      state.files=[];officeIntakeQueue('officeAccept',{requestId:'exact-order-request',hyeonjangOrderId:'order-A',attachedUploadIds:[]});
    }
    seed(true);window.relayCall=async()=>({ok:true,status:'accepted',hyeonjangOrderId:'order-A',projectionRevision:5});
    await officeIntakeFlush();
    const success=state.aptOrders.map(order=>({id:order.id,revision:order.officeProjectionRevision||0}));
    seed(true);window.relayCall=async()=>({ok:false,error:'already-linked',status:'accepted',hyeonjangOrderId:'order-B',projectionRevision:6});
    await officeIntakeFlush();
    const linked={orders:state.aptOrders.map(order=>order.id),revision:state.aptOrders[0]&&state.aptOrders[0].officeProjectionRevision||0,outbox:officeIntakeData().outbox.length};
    seed(false);let pendingCalls=0;window.relayCall=async()=>{pendingCalls++;return {ok:false,error:'photos-pending',status:'pending_review',projectionRevision:0};};window.officeIntakeSync=async()=>true;
    await officeIntakeFlush();
    const missingGhost={orders:state.aptOrders.map(order=>order.id),outbox:officeIntakeData().outbox.length,pendingCalls};
    window.relayCall=originalRelay;window.officeIntakeSync=originalSync;
    return {success,linked,missingGhost};
  });
  assert.deepEqual(exactQueuedOrder,{success:[{id:'order-B',revision:0},{id:'order-A',revision:5}],linked:{orders:['order-B'],revision:6,outbox:0},missingGhost:{orders:['order-B'],outbox:0,pendingCalls:1}},'queued accept success, recovery, and conflict always target payload hyeonjangOrderId and preserve another exact linked order');

  // Break caught: an offline acceptance can race a management-office cancel.
  // That semantic failure must clear its FIFO head and the local ghost order,
  // not retry forever behind a false accepted state.
  const acceptCancelRace = await page.evaluate(async () => {
    state.officeIntake = { inbox: [{ requestId: 'req-cancel-race', status: 'pending_review', needsInfoReason: null }], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    state.aptOrders = [{ id: 'race-order', source: 'office-intake', sourceRequestId: 'req-cancel-race', status: 'recv' }];
    officeIntakeQueue('officeAccept', { requestId: 'req-cancel-race', hyeonjangOrderId: 'race-order' });
    const original = window.relayCall;
    window.relayCall = async () => ({ ok: false, error: 'invalid-transition', status: 'cancelled', hyeonjangOrderId: null });
    const sent = await officeIntakeFlush();
    window.relayCall = original;
    return { sent, outbox: officeIntakeData().outbox.length, orders: state.aptOrders.length, status: officeIntakeFindRequest('req-cancel-race').status };
  });
  assert.deepEqual(acceptCancelRace, { sent: 1, outbox: 0, orders: 0, status: 'cancelled' }, 'cancel conflict clears the ghost order and unblocks FIFO retry');

  // Break caught: a lost on_hold success must replay the same public projection,
  // keep its reason, and let the durable queue clear without a second status audit.
  await fetch(MOCK + '/__reset');
  const holdProjection = await page.evaluate(async () => {
    const needs = await cloudOfficeSetStatus({ requestId: 'req-1', status: 'needs_info', reason: '배관 사진 보완' });
    const hold = await cloudOfficeSetStatus({ requestId: 'req-1', status: 'on_hold' });
    return { needs, hold };
  });
  assert.equal(holdProjection.needs.needsInfoReason, '배관 사진 보완', 'mock status response exposes the public reason');
  assert.equal(holdProjection.hold.needsInfoReason, '배관 사진 보완', 'on_hold response preserves the public reason');
  await fetch(MOCK + '/__reset');
  await page.evaluate(() => cloudOfficeSetStatus({ requestId: 'req-1', status: 'needs_info', reason: '배관 사진 보완' }));
  await fetch(MOCK + '/__officeDropNextStatus');
  const lostHold = await page.evaluate(async () => {
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'on_hold' });
    await officeIntakeFlush();
    const afterDrop = { queued: officeIntakeData().outbox.length, attempts: officeIntakeData().outbox[0].attempts };
    const sent = await officeIntakeFlush();
    return { afterDrop, sent, remaining: officeIntakeData().outbox.length };
  });
  assert.deepEqual(lostHold, { afterDrop: { queued: 1, attempts: 1 }, sent: 1, remaining: 0 }, 'lost on_hold response retries once and clears only exact ok:true');
  const lostHoldMock = await (await fetch(MOCK + '/__state')).json();
  assert.deepEqual(lostHoldMock.officeStatuses.map(row => row.status), ['needs_info', 'on_hold'], 'lost on_hold retry does not duplicate the status audit');
  assert.equal(lostHoldMock.officeStatusCalls, 3, 'needs_info plus committed hold plus idempotent retry reach relay');
  assert.equal(lostHoldMock.officeRequests.find(row => row.requestId === 'req-1').needsInfoReason, '배관 사진 보완', 'lost on_hold retry keeps the unresolved reason');

  await fetch(MOCK + '/__officeSeed?count=101&at=2100-01-01T00%3A00%3A00.000Z');
  const cursorPaging = await page.evaluate(async () => {
    state.officeIntake = { inbox: [{ requestId: 'local-omitted', updatedAt: '2099-01-01T00:00:00.000Z' }], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    await officeIntakeSync(); const first = officeIntakeData().cursor;
    await officeIntakeSync(); const second = officeIntakeData().cursor;
    const d = officeIntakeData();
    d.inbox.push({ requestId: 'offset', updatedAt: '2026-08-26T09:00:00+09:00', description: 'keep-local' });
    const equalChanged = officeIntakeMerge([{ requestId: 'offset', updatedAt: '2026-08-26T00:00:00.000Z', description: 'same-instant' }]);
    const newerChanged = officeIntakeMerge([{ requestId: 'offset', updatedAt: '2026-08-26T00:00:01.000Z', description: 'newer' }]);
    return { first, second, n: d.inbox.length, unique: new Set(d.inbox.map(x => x.requestId)).size, omitted: !!officeIntakeFindRequest('local-omitted'), equalChanged, newerChanged, offset: officeIntakeFindRequest('offset').description };
  });
  assert.match(cursorPaging.first, /^oi1\./, 'client stores server opaque cursor verbatim');
  assert.match(cursorPaging.second, /^oi1\./, 'second page keeps opaque cursor contract');
  assert.equal(cursorPaging.n, 103, '100+1 tuple pages plus omitted local and timestamp probe are merged without loss');
  assert.equal(cursorPaging.unique, 103, 'equal-time pagination has no duplicate request');
  assert.equal(cursorPaging.omitted, true, 'paged response does not delete omitted local request');
  assert.equal(cursorPaging.equalChanged, false, 'offset-equivalent timestamps do not replace local data');
  assert.equal(cursorPaging.newerChanged, true, 'newer instant replaces local data');
  assert.equal(cursorPaging.offset, 'newer');
  const pagingMock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(pagingMock.officeInboxCursors[1], cursorPaging.first, 'second client poll sends the opaque server cursor verbatim');

  await fetch(MOCK + '/__officeSeed?count=101&at=2100-01-01T00%3A00%3A00.000Z');
  const corruptCursorRecovery = await page.evaluate(async () => {
    state.officeIntake = { inbox: [{ requestId: 'local-corrupt-omitted', updatedAt: '2099-01-01T00:00:00.000Z' }], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    const envelope = serializeData(); envelope.officeIntake.cursor = 'oi1.%%%'; applyData(envelope);
    await officeIntakeSync(); const first = officeIntakeData().cursor;
    await officeIntakeSync(); const second = officeIntakeData().cursor;
    const d = officeIntakeData(); return { first, second, n: d.inbox.length, unique: new Set(d.inbox.map(x => x.requestId)).size, omitted: !!officeIntakeFindRequest('local-corrupt-omitted') };
  });
  assert.match(corruptCursorRecovery.first, /^oi1\./, 'corrupt persisted cursor is replaced by a valid opaque cursor after full resync');
  assert.match(corruptCursorRecovery.second, /^oi1\./);
  assert.equal(corruptCursorRecovery.n, 102, 'corrupt cursor recovers 100+1 equal-time rows without deleting an omitted local request');
  assert.equal(corruptCursorRecovery.unique, 102, 'corrupt cursor recovery has no duplicate or skipped rows');
  assert.equal(corruptCursorRecovery.omitted, true);
  const corruptMock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(corruptMock.officeInboxCursors.slice(-2)[0], '', 'mock maps a corrupted opaque cursor to the full-resync tuple');
  assert.deepEqual(pageErrors, [], 'page errors');
  await browser.close();
  console.log('PASS  office intake relay sync and durable outbox');
})().catch(err => { console.error('FAIL', err && err.stack || err); process.exit(1); });

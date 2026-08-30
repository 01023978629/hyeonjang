# Hyeonjang OfficeOps Client and Paid-Work Gate Implementation Plan

> **For agentic workers:** Execute task by task, write the stated RED test first, keep each commit reviewable, and stop on an unexpected regression.

**Goal:** Add a representative-only OfficeOps client and a paid-work approval gate without reusing photo relay, serialized field data, or OfficeIntake storage.

**Architecture:** Keep the first release in \`index.html\`. OfficeOps has separate IDB configuration/read cache and its own Apps Script envelope. The browser-side preventive-inspection conversion is a recoverable saga between the OfficeOps server store and existing local \`aptOrders\`; it is not a cross-store transaction. The client gate prevents operating mistakes but is not a legal/security barrier against a hostile browser; server verification and evidence remain authoritative.

**Spec:** \`C:\Users\1dncj\Documents\New project\manmool\docs\superpowers\specs\2026-08-30-revenue-operations-expansion-design.md\`

## Global Constraints

- Use only \`C:\Users\1dncj\Documents\New project\.worktrees\hyeonjang-revenue-ops-20260831\` at \`origin/main\` \`f44fa57\`. Do not edit the original dirty checkout.
- OfficeOps must never enter \`serializeData()\`, \`applyData()\`, \`state\`, \`현장데이터.json\`, \`DATA_FILE_NAME\`, \`OFFICE_STORE_FILE\`, photo relay config/queue, or OfficeIntake storage. \`hjSnapshot()\` is the existing local recovery snapshot only.
- Never invoke, wrap, queue through, or modify \`relayCall()\`, \`relayBoot()\`, \`relay_queue\`, \`relay_url\`, \`relay_token\`, or legacy \`APP_TOKEN\`. \`tests/relay.e2e.js\` is unchanged regression-only.
- OfficeOps configuration/cache owns only \`office_ops_url\`, \`office_ops_token\`, \`commercial_approval_url\`, \`commercial_approval_token\`, \`office_ops_device_id\`, and successful read cache \`office_ops_cache\`. The paid local transaction helper additionally owns \`paid_commit_pointer\`, \`paid_commit_journal\`, and bounded \`paid_commit_generation:<id>\` records containing only the same existing serialized hyeonjang state as \`appState\`; OfficeOps collections, URLs, and tokens never enter those generations. Empty credential input retains a configured value; removal requires explicit confirmation.
- Every OfficeOps POST body is exactly \`officeOpsEnvelope={token,action,deviceId,timestamp,mutationId?,payload}\`; every commercial approval POST body is exactly \`commercialEnvelope={token,action,timestamp,payload}\`. \`timestamp\` is \`new Date().toISOString()\` and \`ts\` is forbidden. Only OfficeOps uses \`deviceId\`/\`mutationId\`: an OfficeOps read has \`deviceId\` and no \`mutationId\`, an OfficeOps mutation has a fresh \`mutationId\`, and a commercial request has neither field. A mutation result is exactly \`{ok,id,revision,updatedAt}\`, then the client explicitly calls \`officeOpsLoad()\`; acknowledgements never update cache.
- Tabs are exactly \`시험운영 후보\`, \`재점검 동의\`, \`예방점검\`, and \`K-apt 기회\`. No send, booking, scraper, bid, email, SMS, Kakao, Calendar, or Naver integration.
- Gate command kinds are \`create-order|transition-state\`; permitted target states are \`visit|work|billed\`. Existing \`payLog\` remains the sole \`paid\` settlement. Existing \`done|billed|paid\` records are readable without backfill.
- Only \`free-phone-photo-consultation\` and \`free-interior-first-measurement\` are free exceptions. Neither may contain repair/equipment/material work nor a paid \`aptOrder\`. Every other new paid order, including general, AI, OfficeIntake follow-up, manual diagnosis, and OfficeOps conversion, is gated before local persistence.
- OfficeIntake acceptance stays the existing free \`recv\` route. Later paid \`recv→visit\`, \`visit→work\`, and \`done→billed\` transitions are gated.
- Use \`escapeHtml()\` and \`escapeAttr()\`; strict-normalize a K-apt URL before anchor rendering. Never render credentials, HMAC keys, PII, photos, or evidence content. The full signed receipt including its non-secret \`receiptHmac\` value may be stored only as immutable approval metadata on the gated order/inspection; the signing key is never stored or rendered.
- Do not split \`index.html\` this release. An external file needs a separate Pages artifact allowlist and service-worker shell-cache review.
- At implementation start audit all \`hyeonjang-vN-*\` values. Reserve the next unused numeral and make the final paired \`APP_BUILD\`/sw \`C\` edit only after implementation/tests. The marker selected at start remains unused until that edit.
- Before commands: \`$node='C:\Users\1dncj\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'\`; \`$env:NODE_PATH='C:\Users\1dncj\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'\`.

## File Structure

| File | Responsibility |
|---|---|
| \`index.html\` | Separate OfficeOps settings/cache/transports, four tabs, commercial UI, all order gate call sites, and saga. |
| \`sw.js\` | Existing shell marker only; no OfficeOps/commercial response cache. |
| \`tests/office-ops-ui.e2e.js\` | Tabs, pilot, consent, K-apt, escaping, settings, and no-send behavior. |
| \`tests/office-ops-isolation.e2e.js\` | Client-owned separation from serialization, OfficeIntake, relay, APP_TOKEN, and IDB/cache keys. |
| \`tests/paid-work-gate.e2e.js\` | Exact commercial envelope/time/receipt, all paid paths/free exceptions, and direct-bypass scan. |
| \`tests/legacy-commercial-gate.e2e.js\` | Legacy and OfficeIntake-origin state compatibility; \`payLog\` paid regression. |
| \`tests/office-ops-conversion.e2e.js\` | Saga, snapshot, resume, duplicate prevention, and two-tab conflict. |
| \`tests/relay.e2e.js\` | Unchanged legacy regression; not edited. |

## Exact Client Interfaces

Implement the following in \`index.html\`, outside the relay section.

\`\`\`js
const __officeOps={url:'',token:'',cache:null,revision:0,updatedAt:'',loadedAt:'',loading:false};
const __commercialApproval={url:'',token:'',lastTrustedNow:null};

async function officeOpsDeviceId(){
  let id=await idbGet('office_ops_device_id');
  if(!id){ id=crypto.randomUUID(); await idbSet('office_ops_device_id',id); }
  return id;
}
async function officeOpsEnvelope(token,action,payload,mutationId){
  const body={token,action,deviceId:await officeOpsDeviceId(),timestamp:new Date().toISOString(),payload};
  if(mutationId) body.mutationId=mutationId;
  return body;
}
function commercialEnvelope(token,action,payload){
  return {token,action,timestamp:new Date().toISOString(),payload};
}
async function postIsolated(url,body,errorFactory){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)});
  const json=await r.json();
  if(!r.ok||!json||json.ok!==true) throw errorFactory(json);
  return json;
}
async function officeOpsCall(action,payload,{mutationId}={}){
  return postIsolated(__officeOps.url,await officeOpsEnvelope(__officeOps.token,action,payload,mutationId),officeOpsError);
}
async function commercialCall(action,payload){
  return postIsolated(__commercialApproval.url,commercialEnvelope(__commercialApproval.token,action,payload),commercialError);
}
async function commercialApprovalBoot(){
  __commercialApproval.url=normalizeHttpsUrl(await idbGet('commercial_approval_url')||'');
  __commercialApproval.token=await idbGet('commercial_approval_token')||'';
  __commercialApproval.lastTrustedNow=null;
  return {configured:!!(__commercialApproval.url&&__commercialApproval.token),url:__commercialApproval.url};
}
async function officeOpsLoad(){
  const json=await officeOpsCall('officeOpsList',{});
  const store=normalizeOfficeOpsStore(json.store);
  if(!Number.isInteger(store.revision)||typeof store.updatedAt!=='string') throw new Error('invalid OfficeOps list');
  __officeOps.cache=store; __officeOps.revision=store.revision; __officeOps.updatedAt=store.updatedAt;
  __officeOps.loadedAt=new Date().toISOString(); await idbSet('office_ops_cache',{store,revision:store.revision,updatedAt:store.updatedAt});
  return store;
}
async function officeOpsMutationWithAck(action,payload){
  const json=await officeOpsCall(action,payload,{mutationId:crypto.randomUUID()});
  if(Object.keys(json).sort().join(',')!=='id,ok,revision,updatedAt'||json.ok!==true) throw new Error('invalid mutation acknowledgement');
  const store=await officeOpsLoad();
  return {ack:Object.freeze({id:json.id,revision:json.revision,updatedAt:json.updatedAt}),store};
}
async function officeOpsMutation(action,payload){
  return (await officeOpsMutationWithAck(action,payload)).store;
}
\`\`\`

\`normalizeOfficeOpsStore(raw)\` rejects unknown/missing collection keys and returns \`{schemaVersion,revision,updatedAt,pilots,consents,inspections,opportunities,audit}\`. It maps every pilot through the Task 2 `normalizePilotRecord` full stored-row validator before caching; no summary/view projection is stored in `__officeOps.cache`. A pilot is keyed only by \`pilotId\`, a consent only by \`consentId\`, an inspection only by \`inspectionId\`, and a K-apt opportunity only by \`opportunityId\`; generic record \`id\` is never used to dispatch a UI mutation.

\`\`\`js
function isRealIsoDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day]=value.split('-').map(Number), date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function normalizeCommercialTerms(raw){
  const keys=['workKind','scope','exclusions','vatMode','quotedAmount','validUntil','scheduleWindow'];
  if(!raw||Object.keys(raw).sort().join(',')!==keys.slice().sort().join(',')) throw new Error('invalid commercial terms keys');
  const t={workKind:String(raw.workKind||''),scope:String(raw.scope||'').replace(/^\s+|\s+$/g,''),
    exclusions:Array.isArray(raw.exclusions)?raw.exclusions.map(String):null,
    vatMode:String(raw.vatMode||''),quotedAmount:Number(raw.quotedAmount),
    validUntil:String(raw.validUntil||''),scheduleWindow:String(raw.scheduleWindow||'').replace(/^\s+|\s+$/g,'')};
  if(!['device-diagnosis','dispatch','repair','preventive-inspection'].includes(t.workKind)||!t.scope||
    !t.exclusions||!['included','excluded'].includes(t.vatMode)||
    !Number.isInteger(t.quotedAmount)||t.quotedAmount<1||!isRealIsoDate(t.validUntil)||!t.scheduleWindow) throw new Error('invalid commercial terms');
  return Object.freeze(t);
}
async function commercialNow(){
  const nonce=crypto.randomUUID(), startedAt=performance.now();
  const json=await commercialCall('commercialNow',{nonce}), receivedAt=performance.now();
  if(receivedAt-startedAt>10000||json.nonce!==nonce||!Number.isFinite(Date.parse(json.serverNowKst))||
    !Number.isFinite(Date.parse(json.receivedAtKst))) throw new Error('untrusted commercial time');
  __commercialApproval.lastTrustedNow=json.serverNowKst;
  return {serverNowKst:json.serverNowKst,receivedAtKst:json.receivedAtKst,receivedMonotonicMs:receivedAt,useBeforeMonotonicMs:receivedAt+60000};
}
async function validateCommercialApproval({subjectType,subjectId,commercialTerms,commercialApproval}){
  if(subjectType!=='aptOrder') throw new Error('invalid subject type');
  const trusted=await commercialNow();
  if(performance.now()>trusted.useBeforeMonotonicMs) throw new Error('stale commercial time');
  const verifyNonce=crypto.randomUUID(), verifyStartedAt=performance.now();
  const json=await commercialCall('commercialApprovalVerify',{subjectType,subjectId,commercialTerms,commercialApproval,nonce:verifyNonce});
  const exactAckKeys=['nonce','ok','receiptId','serverNowKst','verifyExpiresAtKst'];
  const verifiedAt=performance.now(), serverMs=Date.parse(json.serverNowKst), expiryMs=Date.parse(json.verifyExpiresAtKst);
  if(Object.keys(json).sort().join(',')!==exactAckKeys.sort().join(',')||verifiedAt-verifyStartedAt>10000||verifiedAt>trusted.useBeforeMonotonicMs||json.receiptId!==commercialApproval.receiptId||json.nonce!==verifyNonce||
    !Number.isFinite(serverMs)||!Number.isFinite(expiryMs)||expiryMs<=serverMs||expiryMs-serverMs>60000) throw new Error('invalid approval verification');
  return Object.freeze({receiptId:json.receiptId,serverNowKst:json.serverNowKst,nonce:json.nonce,
    verifyExpiresAtKst:json.verifyExpiresAtKst,useBeforeMonotonicMs:Math.min(trusted.useBeforeMonotonicMs,verifyStartedAt+(expiryMs-serverMs))});
}
async function issueCommercialApproval({subjectId,commercialTerms,approvalEvidenceFileId,approvalEvidenceType,approvedAt,approvedByRole}){
  if(!approvalEvidenceFileId||!approvalEvidenceType||!Date.parse(approvedAt)||!['customer','management-office'].includes(approvedByRole)) throw new Error('missing approval evidence');
  const json=await commercialCall('commercialApprovalIssue',{subjectType:'aptOrder',subjectId,commercialTerms,
    approvalEvidenceFileId,approvalEvidenceType,approvedAt,approvedByRole});
  return normalizeReceipt(json.commercialApproval,subjectId);
}
async function persistApprovedAptOrder({draft,commercialTerms,receipt,verification}){
  if(!draft||Object.getPrototypeOf(draft)!==Object.prototype||!Object.isFrozen(draft)||draft.id!==receipt.subjectId||draft.state!=='visit'||state.aptOrders.some(x=>x.id===draft.id)) throw new Error('paid order identity conflict');
  normalizeReceipt(receipt,draft.id);
  const persisted=Object.freeze({...draft,commercialGateVersion:1,commercialTerms,commercialApproval:receipt});
  return durablePaidMutation({verification,snapshotLabel:'유상 오더 승인 저장',mutateDraft:next=>{ next.aptOrders.push(persisted); return persisted; }});
}
async function executePaidWorkGate({commandKind,subjectType,subjectId,targetState,commercialTerms,commercialApproval,createDraft}){
  if(subjectType!=='aptOrder'||!['create-order','transition-state'].includes(commandKind)||!['visit','work','billed'].includes(targetState)||
    (commandKind==='create-order'&&(targetState!=='visit'||!createDraft||typeof createDraft!=='object'||Array.isArray(createDraft)))||
    (commandKind==='transition-state'&&createDraft!==undefined)) throw new Error('invalid paid gate command');
  const terms=normalizeCommercialTerms(commercialTerms);
  const receipt=normalizeReceipt(commercialApproval,subjectId);
  const verification=await validateCommercialApproval({subjectType,subjectId,commercialTerms:terms,commercialApproval:receipt});
  if(commandKind==='create-order') return persistApprovedAptOrder({draft:createDraft,commercialTerms:terms,receipt,verification});
  return persistGatedAptTransition({subjectType,subjectId,targetState,commercialTerms:terms,receipt,verification});
}
\`\`\`

durableLocalMutation({snapshotLabel,mutateDraft,beforeCommit,onCommitted}) takes a successful recovery snapshot, applies mutateDraft to a deep-cloned candidate, validates/serializes it without touching live state, invokes the optional fail-closed `beforeCommit` hook, then uses one native IndexedDB readwrite transaction on the existing kv store to write a generation record, update a paid-commit journal/pointer, and replace legacy `appState`. IndexedDB transaction abort leaves all old keys and live state unchanged; commit success is the durable commit point, after which `onCommitted` runs exactly once. Only after commit does it replace live state and render. A render failure is not reported as a failed mutation or rolled back: the committed journal/pointer remains authoritative, the UI shows a reload-required recovery banner, and boot reloads that committed generation. durablePaidMutation({verification,snapshotLabel,mutateDraft}) is the only paid wrapper: it rejects an already consumed (receiptId,nonce), delegates with a `beforeCommit` hook that rechecks performance.now() <= verification.useBeforeMonotonicMs after the snapshot and immediately before the atomic transaction, and an `onCommitted` hook that consumes (receiptId,nonce) only after commit. The commercial relay's nonce claim is authoritative; the same stored receipt may be verified later with a new nonce while still valid. persistGatedAptTransition uses the paid wrapper and atomically preserves the normalized full commercialTerms and full signed commercialApproval on the order.

\`\`\`js
function normalizeReceipt(receipt,subjectId){
  const keys=['receiptId','subjectType','subjectId','approvedTermsSha256','approvalEvidenceType','approvalEvidenceFileId','approvalEvidenceSha256','approvedAt','approvedByRole','issuedAt','receiptHmac'];
  if(!receipt||Object.keys(receipt).sort().join(',')!==keys.slice().sort().join(',')||receipt.subjectType!=='aptOrder'||receipt.subjectId!==subjectId||!/^[A-Za-z0-9_-]{1,160}$/.test(subjectId||'')||!/^receipt_[A-Za-z0-9_-]{1,80}$/.test(receipt.receiptId||'')||
    !/^[a-f0-9]{64}$/.test(receipt.approvedTermsSha256||'')||
    !['quote-file','contract-file','message-export-file'].includes(receipt.approvalEvidenceType)||
    !/^[A-Za-z0-9_-]{1,200}$/.test(receipt.approvalEvidenceFileId||'')||!/^[a-f0-9]{64}$/.test(receipt.approvalEvidenceSha256||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(receipt.approvedAt||'')||
    !['customer','management-office'].includes(receipt.approvedByRole)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(receipt.issuedAt||'')||Date.parse(receipt.issuedAt)<Date.parse(receipt.approvedAt)||
    !/^[a-f0-9]{64}$/.test(receipt.receiptHmac||'')) throw new Error('invalid commercial receipt');
  return Object.freeze({...receipt});
}
\`\`\`
\`updateCommercialTerms(orderId,nextTerms)\` normalizes and stores the conditions, sets current \`commercialApproval:null\`, preserves the former approval only in an order audit event, snapshots first, and returns \`{order,previousApprovalAuditId}\`. It never issues replacement receipt or performs a transition.
\`\`\`js
async function createPaidDiagnosisOrderFromManualLead(input){
  const id=uid(), commercialTerms=normalizeCommercialTerms(input.commercialTerms);
  const commercialApproval=await issueCommercialApproval({subjectId:id,commercialTerms,
    approvalEvidenceFileId:input.approvalEvidenceFileId,approvalEvidenceType:input.approvalEvidenceType,
    approvedAt:input.approvedAt,approvedByRole:input.approvedByRole});
  return executePaidWorkGate({commandKind:'create-order',subjectType:'aptOrder',subjectId:id,targetState:'visit',commercialTerms,commercialApproval,
    createDraft:Object.freeze({id,source:'manual-paid-diagnosis',state:'visit'})});
}
\`\`\`
The manual UI permits only \`approvedByRole:'customer'|'management-office'\`; it must not render an approval path for AI commands.

`normalizeCommercialTerms` deliberately mirrors `apps-script-commercial/CommercialApprovalPure.gs:caCanonicalTerms_` rather than adding browser-only policy. The returned object is constructed in the exact seven-key order shown above; only `scope` and `scheduleWindow` receive outer trim, while exclusions use ordered `map(String)` with no sorting, trimming, or empty-item restriction. `tests/paid-work-gate.e2e.js` must compare the browser result, OfficeOps `ooCanonicalCommercialTerms_`, and actual commercial `caCanonicalTerms_` for byte-identical JSON and lower-case SHA-256. The shared golden input `{workKind:'device-diagnosis',scope:'  욕실 누수 장비 진단  ',exclusions:['복구 공사','타일'],vatMode:'included',quotedAmount:100000,validUntil:'2026-09-30',scheduleWindow:'  2026-09-02 오후  '}` yields exactly `{"workKind":"device-diagnosis","scope":"욕실 누수 장비 진단","exclusions":["복구 공사","타일"],"vatMode":"included","quotedAmount":100000,"validUntil":"2026-09-30","scheduleWindow":"2026-09-02 오후"}` and SHA-256 `d281f3a06b118ecba257558c569bb48da25869c78f0ea6fc2b42cba622e0d52f`. Also prove the invalid date `2026-02-29` fails in all three paths and that an exclusion such as `'  현장 협의  '` retains those array-item spaces in all three outputs.

## Task 1: Transport, settings, cache, and isolation test ownership

**Files:** modify \`index.html\`, \`tests/office-ops-isolation.e2e.js\`, \`tests/paid-work-gate.e2e.js\`. Do not edit \`tests/relay.e2e.js\`.

- [ ] **RED:** Assert each commercial POST has exactly \`token,action,timestamp,payload\` and zero \`deviceId\`/\`mutationId\`; each OfficeOps read has exactly \`token,action,deviceId,timestamp,payload\`; each OfficeOps mutation adds one fresh \`mutationId\`; no request uses \`ts\`. Mutations require the exact acknowledgement keys, preserve the server \`id\` in \`officeOpsMutationWithAck\`, and then invoke \`officeOpsLoad()\`; create helpers select the refreshed row only by that exact server ID, never by a non-unique field tuple. Assert cache write occurs only after a successful normalized \`officeOpsLoad\`; an \`office-disabled\` read never overwrites it, renders it as stale/export-only, blocks every create/edit/draft/convert/contact action, and permits only a local JSON export without a network call. Static source rejects OfficeOps references inside serialize/apply/relay/OfficeIntake sections. Expected failure: isolated functions absent, an envelope boundary is mixed, server identity is discarded, or stale cache can mutate.
- [ ] **Implement:** Add the exact functions above, IDB-only settings, stale-read/export-only display with no offline mutation retry, and settings UI with explicit credential deletion confirmation. Disabled-server export reads only the last normalized \`office_ops_cache\`; it never treats the cache as current or calls a mutation.
- [ ] **GREEN:**
\`\`\`powershell
& $node tests/office-ops-isolation.e2e.js
& $node tests/paid-work-gate.e2e.js
& $node tests/relay.e2e.js
\`\`\`
- [ ] **Commit:**
\`\`\`bash
git add index.html tests/office-ops-isolation.e2e.js tests/paid-work-gate.e2e.js
git commit -m \"feat: isolate OfficeOps client transport and cache\"
\`\`\`

## Task 2: Four tabs, KST pilot periods, consent, and strict K-apt

**Files:** modify \`index.html\`, \`tests/office-ops-ui.e2e.js\`, \`tests/office-ops-isolation.e2e.js\`.

- [ ] **RED:** Require exactly four tab labels and no outgoing-contact controls. Test pilot stages \`new|contacted|meeting|pilot|converted|closed\`, keyed by \`pilotId\`; only \`pilot\` has an active period. Assert \`2026-08-31→2026-09-29T23:59:59+09:00\`, leap \`2028-02-01→2028-03-01T23:59:59+09:00\`, and rollover \`2026-12-20→2027-01-18T23:59:59+09:00\`; assert `pilotEndsAtKst('2026-02-30')` throws `invalid pilot start date` instead of normalizing into March. Test server \`extensionApprovedAt\` plus replacement \`pilotEndsAt\` rather than a client-only extension field. Assert `normalizePilotRecord` returns exactly all 17 relay pilot keys in fixed order and rejects a missing or extra key, invalid tombstone, and any source outside `website|phone|referral|kapt`. Assert `pilotWindowView` returns only display fields and is never referenced by a create/update transport. Assert `pilotEditablePayload` returns exactly `pilotId,expectedRevision,complexName,source,stage,pilotStartedAt,pilotEndsAt,extensionApprovedAt,nextActionAt,owner,notes`—the relay's ten business keys (`pilotId` plus nine editable fields) plus `expectedRevision`—with no server-owned timestamp, retention, or tombstone field; changing one field still sends every editable field.
- [ ] **Implement:**
\`\`\`js
function formatKstIso(ms){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(ms).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return \`\${p.year}-\${p.month}-\${p.day}T\${p.hour}:\${p.minute}:\${p.second}+09:00\`;
}
function pilotEndsAtKst(startDateKst){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateKst); if(!m||!isRealIsoDate(startDateKst)) throw new Error('invalid pilot start date');
  const [y,mo,d]=m.slice(1).map(Number); return formatKstIso(Date.UTC(y,mo-1,d,-9)+(30*86400000)-1000);
}
function parseStrictKstDateTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(value)) return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&formatKstIso(ms)===value?ms:null;
}
function normalizePilotEditable(raw){
  const keys=['complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'];
  if(!raw||Object.keys(raw).sort().join(',')!==keys.slice().sort().join(',')) throw new Error('invalid pilot editable keys');
  const value={complexName:String(raw.complexName||''),source:String(raw.source||''),stage:String(raw.stage||''),pilotStartedAt:raw.pilotStartedAt,
    pilotEndsAt:raw.pilotEndsAt,extensionApprovedAt:raw.extensionApprovedAt,nextActionAt:String(raw.nextActionAt||''),owner:String(raw.owner||''),notes:String(raw.notes||'')};
  const start=value.pilotStartedAt===null?null:parseStrictKstDateTime(value.pilotStartedAt), end=value.pilotEndsAt===null?null:parseStrictKstDateTime(value.pilotEndsAt);
  const extension=value.extensionApprovedAt===null?null:parseStrictKstDateTime(value.extensionApprovedAt), normalEnd=start===null?null:pilotEndsAtKst(value.pilotStartedAt.slice(0,10));
  if(!value.complexName||value.complexName.length>100||!['website','phone','referral','kapt'].includes(value.source)||
    !['new','contacted','meeting','pilot','converted','closed'].includes(value.stage)||(start===null)!==(end===null)||
    (value.stage==='pilot'&&(start===null||end===null))||(value.extensionApprovedAt!==null&&extension===null)||(extension!==null&&(start===null||end<=Date.parse(normalEnd)))||
    (extension===null&&start!==null&&value.pilotEndsAt!==normalEnd)||
    !isRealIsoDate(value.nextActionAt)||!value.owner||value.owner.length>100||value.notes.length>2000) throw new Error('invalid pilot editable values');
  return Object.freeze(value);
}
function normalizePilotRecord(raw){
  const keys=['pilotId','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes','createdAt','updatedAt','retentionStartedAt','archivedAt','archivedBy','archiveReason','restoredAt'];
  if(!raw||Object.keys(raw).sort().join(',')!==keys.slice().sort().join(',')) throw new Error('invalid pilot record keys');
  const editable=normalizePilotEditable(Object.fromEntries(['complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'].map(key=>[key,raw[key]])));
  const value={pilotId:raw.pilotId,complexName:editable.complexName,source:editable.source,stage:editable.stage,pilotStartedAt:editable.pilotStartedAt,pilotEndsAt:editable.pilotEndsAt,
    extensionApprovedAt:editable.extensionApprovedAt,nextActionAt:editable.nextActionAt,owner:editable.owner,notes:editable.notes,createdAt:raw.createdAt,updatedAt:raw.updatedAt,
    retentionStartedAt:raw.retentionStartedAt,archivedAt:raw.archivedAt,archivedBy:raw.archivedBy,archiveReason:raw.archiveReason,restoredAt:raw.restoredAt};
  const archived=value.archivedAt===null?false:parseStrictKstDateTime(value.archivedAt)!==null;
  if(!/^pilot_[A-Za-z0-9_-]{1,100}$/.test(value.pilotId||'')||parseStrictKstDateTime(value.createdAt)===null||parseStrictKstDateTime(value.updatedAt)===null||Date.parse(value.updatedAt)<Date.parse(value.createdAt)||
    (value.stage==='closed'?parseStrictKstDateTime(value.retentionStartedAt)===null:value.retentionStartedAt!==null)||(value.archivedAt!==null&&!archived)||
    (archived&&(value.archivedBy!=='representative'||typeof value.archiveReason!=='string'||!value.archiveReason||value.restoredAt!==null))||
    (!archived&&(value.archivedBy!==null||value.archiveReason!==null||(value.restoredAt!==null&&parseStrictKstDateTime(value.restoredAt)===null)))) throw new Error('invalid pilot record');
  return Object.freeze(value);
}
function pilotWindowView(raw){
  const pilot=normalizePilotRecord(raw);
  return Object.freeze({pilotId:pilot.pilotId,stage:pilot.stage,pilotStartedAt:pilot.pilotStartedAt,pilotEndsAt:pilot.pilotEndsAt,extensionApprovedAt:pilot.extensionApprovedAt});
}
function pilotEditablePayload(raw,changes,expectedRevision){
  const pilot=normalizePilotRecord(raw), editableKeys=['complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'];
  if(!changes||Object.keys(changes).some(key=>!editableKeys.includes(key))||!Number.isInteger(expectedRevision)||expectedRevision<0) throw new Error('invalid pilot update');
  const editable=normalizePilotEditable(Object.fromEntries(editableKeys.map(key=>[key,Object.prototype.hasOwnProperty.call(changes,key)?changes[key]:pilot[key]])));
  return {pilotId:pilot.pilotId,expectedRevision,complexName:editable.complexName,source:editable.source,stage:editable.stage,pilotStartedAt:editable.pilotStartedAt,pilotEndsAt:editable.pilotEndsAt,extensionApprovedAt:editable.extensionApprovedAt,nextActionAt:editable.nextActionAt,owner:editable.owner,notes:editable.notes};
}
async function updateOfficePilot(pilotId,changes){
  const pilot=__officeOps.cache&&__officeOps.cache.pilots.find(row=>row.pilotId===pilotId); if(!pilot) throw new Error('pilot not found');
  return officeOpsMutation('officePilotUpdate',pilotEditablePayload(pilot,changes,__officeOps.revision));
}
\`\`\`
`normalizePilotRecord` is the only relay-row normalizer and returns all 17 stored keys in the exact construction order above. `pilotWindowView` is explicitly view-only: active deadline is the server-recorded `pilotEndsAt`, and an extension is displayed only when the row contains both server `extensionApprovedAt` and replacement `pilotEndsAt`; no mutation function may call it. `pilotEditablePayload` and `updateOfficePilot` are the only ordinary update path, always send the full replacement, and exclude/preserve all server-owned fields. The browser never grants or extends a pilot and never manufactures `retentionStartedAt` or tombstones.
- [ ] **Consent implementation:** \`normalizeReinspectionConsent(raw)\` accepts exactly \`{subjectType,subjectId,purpose:'preventive-reinspection',intervalMonths:6|12,channel,consentVersion:'reinspection-v1',consentTextSnapshot,consentTextSha256,recordedBy,consentedAt,evidenceType,evidenceId}\`; it validates a lower-case 64-hex hash and requires `consentedAt` to pass the same real whole-second KST `parseStrictKstDateTime` helper as relay stored timestamps. RED rejects a missing offset, UTC `Z`, fractional seconds, and impossible calendar/clock values. It returns a frozen input object without a client-created ID. \`persistReinspectionConsent(input,idempotencyKey)\` sends \`officeConsentRecord\` with those exact fields plus the required 16–80 character \`idempotencyKey\`, never \`expectedRevision\`, and outputs the refreshed server record identified by \`consentId\`. One logical create keeps the same key across a user retry; a new logical create gets a new key. \`withdrawReinspectionConsent({consentId,withdrawnBy,withdrawalReason})\` sends \`officeConsentWithdraw\` with exactly those fields plus \`expectedRevision\`; the server supplies \`withdrawnAt\` in KST. It returns the refreshed record and disables scheduling/draft creation immediately. A \`수동 초안\` is browser-memory-only/no-send until explicit record; its contact lookup is from existing project/order data only after a live active consent check.
\`\`\`js
function normalizeReinspectionConsent(raw){
  const keys=['subjectType','subjectId','purpose','intervalMonths','channel','consentVersion','consentTextSnapshot','consentTextSha256','recordedBy','consentedAt','evidenceType','evidenceId'];
  if(!raw||Object.keys(raw).sort().join(',')!==keys.slice().sort().join(',')||!['project','aptOrder'].includes(raw.subjectType)||
    !raw.subjectId||raw.purpose!=='preventive-reinspection'||![6,12].includes(raw.intervalMonths)||
    !['sms','phone','kakao'].includes(raw.channel)||raw.consentVersion!=='reinspection-v1'||
    !raw.consentTextSnapshot||!/^[a-f0-9]{64}$/.test(raw.consentTextSha256||'')||!raw.recordedBy||
    parseStrictKstDateTime(raw.consentedAt)===null||!['signed-document','message','recorded-call-note'].includes(raw.evidenceType)||!raw.evidenceId) throw new Error('invalid reinspection consent');
  return Object.freeze({...raw});
}
async function persistReinspectionConsent(input,idempotencyKey){
  if(!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey||'')) throw new Error('invalid consent idempotency key');
  const payload={idempotencyKey,...normalizeReinspectionConsent(input)};
  const result=await officeOpsMutationWithAck('officeConsentRecord',payload);
  const consent=result.store.consents.find(x=>x.consentId===result.ack.id);
  if(!consent) throw new Error('created consent missing after reload');
  return consent;
}
async function withdrawReinspectionConsent({consentId,withdrawnBy,withdrawalReason}){
  const store=await officeOpsMutation('officeConsentWithdraw',{consentId,withdrawnBy,withdrawalReason,expectedRevision:__officeOps.revision});
  return store.consents.find(x=>x.consentId===consentId);
}
\`\`\`
- [ ] **K-apt implementation:** \`normalizeKAptUrl(raw)\` returns only canonical \`https://www.k-apt.go.kr/...\` with no credentials, fragment, non-443 port, or foreign host; otherwise \`null\`. The implementation and its exact output are:
\`\`\`js
function officeOpsCanParticipate({serverNowKst,deviceNowMs,deadlineAtKst}){
  const serverMs=Date.parse(serverNowKst), deadlineMs=Date.parse(deadlineAtKst);
  if(!Number.isFinite(serverMs)||!Number.isFinite(deadlineMs)||!Number.isFinite(deviceNowMs)) return {ok:false,reason:'parse-failed'};
  if(Math.abs(serverMs-deviceNowMs)>5*60*1000) return {ok:false,reason:'clock-skew'};
  return serverMs>=deadlineMs ? {ok:false,reason:'deadline-passed'} : {ok:true,reason:'eligible'};
}
\`\`\`
The caller separately requires \`normalizeKAptUrl(record.officialUrl)\` before displaying the opportunity. RED tests one millisecond before the deadline as eligible and exact equality plus any later time as `deadline-passed`. It never scrapes.
- [ ] **GREEN/commit:**
\`\`\`powershell
& $node tests/office-ops-ui.e2e.js
& $node tests/office-ops-isolation.e2e.js
\`\`\`
\`\`\`bash
git add index.html tests/office-ops-ui.e2e.js tests/office-ops-isolation.e2e.js
git commit -m \"feat: add isolated OfficeOps representative tabs\"
\`\`\`

## Task 3: Commercial approval and paid gate

**Files:** modify \`index.html\`, \`tests/paid-work-gate.e2e.js\`, \`tests/legacy-commercial-gate.e2e.js\`.

- [ ] **Commercial canonical RED:** Load or VM-evaluate the browser `normalizeCommercialTerms`, OfficeOps `ooCanonicalCommercialTerms_`, and actual commercial `caCanonicalTerms_`. For the exact golden input and JSON/SHA-256 stated above, assert all three emit the same ordered seven-key object, byte-identical JSON, and `d281f3a06b118ecba257558c569bb48da25869c78f0ea6fc2b42cba622e0d52f`. Assert all three reject missing/extra keys and `2026-02-29`, while all three preserve ordered exclusions exactly through `map(String)`, including leading/trailing spaces and empty strings. Expected failure: browser exclusions are trimmed/sorted/rejected independently, date validation accepts rollover, key order differs, or any JSON/hash differs.

- [ ] **RED:** Mock \`commercialNow\` and reject nonce absence/mismatch, a round trip over 10 seconds, use after 60 seconds, invalid receipt, reuse of the clock nonce for verify, and a verify response that is not exactly an acknowledgement containing \`ok,receiptId,serverNowKst,nonce,verifyExpiresAtKst\`. Verify must receive the supplied full \`commercialApproval\`, use a second fresh nonce, and must not expect or unwrap \`verifyResponse.receipt\`. Assert issue payload exactly has \`subjectType:'aptOrder'\`, \`subjectId\`, \`commercialTerms\`, \`approvalEvidenceFileId\`, \`approvalEvidenceType\`, \`approvedAt\`, \`approvedByRole:'customer'|'management-office'\`, and issue unwraps \`json.commercialApproval\`. Assert terms reject \`amount\`, \`currency\`, \`expiresAtKst\`, and \`termsSha256\`; require only the exact seven spec keys. Reject a missing or non-\`aptOrder\` \`subjectType\`, identical nonce reuse, a snapshot delay past the monotonic deadline, duplicate consumption of one acknowledgement, and a mutable/non-plain draft. Inject validation/serialization/IndexedDB transaction failures and prove old generation, pointer, \`appState\`, live state, and acknowledgement-consumption set are unchanged. Inject render failure after commit and prove the new generation remains committed once, the acknowledgement is consumed once, a recovery banner appears, and boot reloads the committed generation without duplicate mutation. Prove a stored full receipt succeeds later only after verification with a new nonce, terms change makes the former receipt fail, and every successful transition atomically retains the normalized terms and full receipt. Test UI wording that gate is operational safety, not hostile-browser enforcement.
- [ ] **Implement:** Use the exact shared functions. \`commercialApprovalIssue\` alone unwraps its signed \`json.commercialApproval\`; \`commercialApprovalVerify\` accepts that receipt in its request and returns only the verification acknowledgement. Both \`commercialNow\` and verification measure a monotonic request round trip of at most 10 seconds; verification uses a second fresh nonce before the trusted-time result reaches 60 seconds. Compute a conservative monotonic use deadline from the verify request start plus the server acknowledgement lifetime, capped by the earlier trusted-time deadline, then recheck it after the snapshot and immediately before durable mutation. Consume one successful acknowledgement once; the relay nonce claim remains authoritative and the immutable receipt itself can be reverified with a new nonce. Validate \`create-order→visit\` and \`transition-state→visit|work|billed\`; \`createDraft\` is a frozen plain object only for create-order, its \`id\` equals \`subjectId\`, its initial state is \`visit\`, and it is absent for transition-state. \`transitionAptOrderWithGate({orderId,targetState,commercialTerms,commercialApproval})\` loads the current order and calls \`executePaidWorkGate({commandKind:'transition-state',subjectType:'aptOrder',subjectId:orderId,targetState,commercialTerms,commercialApproval})\`.
\`\`\`js
async function updateCommercialTerms(orderId,nextTerms){
  const current=state.aptOrders.find(x=>x.id===orderId); if(!current) throw new Error('order not found');
  const commercialTerms=normalizeCommercialTerms(nextTerms), previousApproval=current.commercialApproval||null, at=new Date().toISOString();
  return durableLocalMutation({snapshotLabel:'유상 조건 변경',mutateDraft:next=>{
    const order=next.aptOrders.find(x=>x.id===orderId); if(!order) throw new Error('order not found');
    order.commercialTerms=commercialTerms; order.commercialApproval=null;
    order.commercialApprovalAudit=[...(order.commercialApprovalAudit||[]),{event:'terms-replaced',at,previousApproval}];
    return {order,previousApprovalAuditId:at};
  }});
}
\`\`\`
The test asserts \`updateCommercialTerms\` never calls \`commercialApprovalIssue\`, never invokes the gate, and a compound conditions-change-plus-transition returns \`compound-command-not-allowed\` with no local mutation.
- [ ] **GREEN/commit:**
\`\`\`powershell
& $node tests/paid-work-gate.e2e.js
& $node tests/legacy-commercial-gate.e2e.js
\`\`\`
\`\`\`bash
git add index.html tests/paid-work-gate.e2e.js tests/legacy-commercial-gate.e2e.js
git commit -m \"feat: gate approved paid work transitions\"
\`\`\`

## Task 4: All aptOrders paths and direct-bypass protection

**Files:** modify \`index.html\`, \`tests/paid-work-gate.e2e.js\`, \`tests/legacy-commercial-gate.e2e.js\`.

- [ ] **RED:** Static source test locates every \`state.aptOrders.push(\` and status assignment. Permit only \`persistApprovedAptOrder\` (post-gate paid creation) and \`officeIntakeOrderFromRequest\` (free \`recv\` acceptance); reject every other writer. Assert \`apt_order_add\` and \`apt_order_update\` have no writer or gate call: both return the unchanged response text \`상업 승인 필요\`. Expected failure identifies the existing direct manual/AI path.
- [ ] **Implement classification:**
  - General manual \`aptOrderManage\` paid creation: create-order gate; only the two named free exceptions bypass.
  - AI \`apt_order_add\`/\`apt_order_update\`: no interactive approval proof exists, so make no order/state change and return \`상업 승인 필요\`; direct the representative to the gated manual UI. AI never calls a direct writer or the gate.
  - \`officeIntakeAccept\`/\`officeIntakeOrderFromRequest\`: free \`recv\` allowed; next paid transition gated.
  - Manual diagnostic: \`createPaidDiagnosisOrderFromManualLead\` then create-order gate.
  - OfficeOps conversion: Task 5 creates only through \`create-order\` gate with an issued management-office/customer receipt.
  - \`aptSettle\`: gate \`done→billed\`; retain \`billed→paid\` through current \`payLog\`.
  - Legacy \`recv|visit|work|done|billed|paid\`: readable, no migration/backfill.
- [ ] **GREEN/commit:**
\`\`\`powershell
& $node tests/paid-work-gate.e2e.js
& $node tests/legacy-commercial-gate.e2e.js
\`\`\`
\`\`\`bash
git add index.html tests/paid-work-gate.e2e.js tests/legacy-commercial-gate.e2e.js
git commit -m \"refactor: route every paid order path through gate\"
\`\`\`

## Task 5: Preventive-inspection conversion saga and resume

**Files:** modify \`index.html\`, \`tests/office-ops-conversion.e2e.js\`, \`tests/office-ops-isolation.e2e.js\`.

- [ ] **RED:** Inject failure before begin, after begin, arm, local write, and record. Require trusted-time receipt verification plus a successful snapshot before begin, another gate verification immediately before the local write, full signed receipt metadata available after reload, no duplicate \`pendingOrderId\`, revision conflict for second tab, and finalization refusal for any mismatched ID/terms. Prove any failure before a successful begin leaves both stores unchanged; begin atomically freezes the full normalized terms and full signed receipt; begin/arm/record/finalize safely return the prior success for an exact frozen-proof replay after response loss; and record retry with a new mutation ID plus the prior revision cannot duplicate the order. After local durable commit but before RecordLocalCommit acknowledgement, resume must recognize the exact existing local order, verify all source/terms/full-receipt identities, record it without re-running create or issuing a receipt, and continue finalize; any mismatch stops. Expected failure: saga/resume absent.
- [ ] **Implement exact payload and saga:**
\`\`\`js
function conversionPayload({inspectionId,conversionId,pendingOrderId,receipt}){
  return {inspectionId,conversionId,pendingOrderId,receiptId:receipt.receiptId,receiptSubjectType:receipt.subjectType,
    receiptSubjectId:receipt.subjectId,termsSha256:receipt.approvedTermsSha256};
}
async function convertOfficeOpsInspectionToAptOrder(inspectionId,approvalInput){
  const inspection=officeOpsInspectionById(inspectionId), conversionId=inspection.conversionId||uid(), pendingOrderId=inspection.pendingOrderId||uid();
  const terms=normalizeCommercialTerms(inspection.commercialTerms);
  const receipt=await issueCommercialApproval({subjectId:pendingOrderId,commercialTerms:terms,approvalEvidenceFileId:approvalInput.approvalEvidenceFileId,approvalEvidenceType:approvalInput.approvalEvidenceType,approvedAt:approvalInput.approvedAt,approvedByRole:approvalInput.approvedByRole});
  await validateCommercialApproval({subjectType:'aptOrder',subjectId:pendingOrderId,commercialTerms:terms,commercialApproval:receipt});
  await hjSnapshot('OfficeOps 예방점검 오더 전환 준비',true);
  const base=conversionPayload({inspectionId,conversionId,pendingOrderId,receipt});
  await officeOpsMutation('officeInspectionBeginConversion',{...base,commercialTerms:terms,commercialApproval:receipt,expectedRevision:__officeOps.revision});
  await officeOpsMutation('officeInspectionArmLocalCommit',{...base,expectedRevision:__officeOps.revision});
  const order=await executePaidWorkGate({commandKind:'create-order',subjectType:'aptOrder',subjectId:pendingOrderId,targetState:'visit',commercialTerms:terms,commercialApproval:receipt,createDraft:Object.freeze(officeOpsAptOrderDraft(inspection,{conversionId,pendingOrderId,terms}))});
  await officeOpsMutation('officeInspectionRecordLocalCommit',{...base,linkedOrderId:order.id,expectedRevision:__officeOps.revision});
  return officeOpsMutation('officeInspectionFinalizeConversion',{...base,linkedOrderId:order.id,expectedRevision:__officeOps.revision});
}
\`\`\`
\`officeOpsAptOrderDraft\` returns \`{id:pendingOrderId,sourceOfficeOpsInspectionId:inspectionId,sourceOfficeOpsConversionId:conversionId,commercialGateVersion:1,...}\` without copying OfficeOps PII to photos/OfficeIntake/relay. The resume implementation is:
\`\`\`js
async function resumeOfficeOpsInspectionConversion({inspectionId,conversionId,pendingOrderId,receiptId,receiptSubjectType,receiptSubjectId,termsSha256,linkedOrderId}){
  const store=await officeOpsLoad(), inspection=store.inspections.find(x=>x.inspectionId===inspectionId), order=state.aptOrders.find(x=>x.id===linkedOrderId||x.id===pendingOrderId);
  if(!inspection||inspection.conversionId!==conversionId||inspection.pendingOrderId!==pendingOrderId||inspection.conversionReceiptId!==receiptId||inspection.conversionTermsSha256!==termsSha256) throw new Error('conversion identity conflict');
  const base={inspectionId,conversionId,pendingOrderId,receiptId,receiptSubjectType,receiptSubjectId,termsSha256};
  if(inspection.status==='conversion-pending'){
    await officeOpsMutation('officeInspectionArmLocalCommit',{...base,expectedRevision:__officeOps.revision});
    return resumeOfficeOpsInspectionConversion({...base,linkedOrderId});
  }
  if(inspection.status==='conversion-writing'&&order){
    const storedTerms=normalizeCommercialTerms(inspection.commercialTerms), storedReceipt=normalizeReceipt(inspection.commercialApproval,pendingOrderId);
    const orderTerms=normalizeCommercialTerms(order.commercialTerms), orderReceipt=normalizeReceipt(order.commercialApproval,pendingOrderId);
    if(order.id!==pendingOrderId||order.sourceOfficeOpsInspectionId!==inspectionId||order.sourceOfficeOpsConversionId!==conversionId||
      JSON.stringify(orderTerms)!==JSON.stringify(storedTerms)||JSON.stringify(orderReceipt)!==JSON.stringify(storedReceipt)||
      orderReceipt.receiptId!==receiptId||orderReceipt.approvedTermsSha256!==termsSha256) throw new Error('existing local order identity conflict');
    await officeOpsMutation('officeInspectionRecordLocalCommit',{...base,linkedOrderId:order.id,expectedRevision:__officeOps.revision});
    return resumeOfficeOpsInspectionConversion({...base,linkedOrderId:order.id});
  }
  if(inspection.status==='conversion-writing'&&!order){
    const terms=normalizeCommercialTerms(inspection.commercialTerms), receipt=normalizeReceipt(inspection.commercialApproval,pendingOrderId);
    if(receipt.receiptId!==receiptId||receipt.subjectType!==receiptSubjectType||receipt.subjectId!==receiptSubjectId||receipt.approvedTermsSha256!==termsSha256) throw new Error('conversion receipt conflict');
    const created=await executePaidWorkGate({commandKind:'create-order',subjectType:'aptOrder',subjectId:pendingOrderId,targetState:'visit',commercialTerms:terms,commercialApproval:receipt,createDraft:Object.freeze(officeOpsAptOrderDraft(inspection,{conversionId,pendingOrderId,terms}))});
    await officeOpsMutation('officeInspectionRecordLocalCommit',{...base,linkedOrderId:created.id,expectedRevision:__officeOps.revision});
    return resumeOfficeOpsInspectionConversion({...base,linkedOrderId:created.id});
  }
  if(inspection.status==='conversion-local-committed'){
    if(!order||order.id!==linkedOrderId) throw new Error('local order identity conflict');
    return officeOpsMutation('officeInspectionFinalizeConversion',{...base,linkedOrderId,expectedRevision:__officeOps.revision});
  }
  return inspection;
}
\`\`\`
Client resume revalidates the server-fixed \`inspectionId\`, conversion/order/receipt IDs and hash; begin atomically persists and freezes the full \`commercialTerms\` and full signed \`commercialApproval\`, while arm/record/finalize revalidate all seven base fields plus \`linkedOrderId\` server-side. Resume always reuses the stored full receipt with a fresh verification nonce and never reissues it.
- [ ] **UI:** \`재개\` only at legal recovery stage; \`취소\` only pre-arm. Post-arm cancellation is a non-mutating conflict; in-flight states hide edit/terms/archive/restore/duplicate controls.
- [ ] **GREEN/commit:**
\`\`\`powershell
& $node tests/office-ops-conversion.e2e.js
& $node tests/office-ops-isolation.e2e.js
& $node tests/snapshot-revert.e2e.js
\`\`\`
\`\`\`bash
git add index.html tests/office-ops-conversion.e2e.js tests/office-ops-isolation.e2e.js
git commit -m \"feat: recover OfficeOps inspection conversion\"
\`\`\`

## Task 6: Marker/cache audit and full release gate

**Files:** modify \`index.html\`, \`sw.js\`, relevant client tests; do not modify \`tests/relay.e2e.js\`.

- [ ] **RED:** Assert no OfficeOps in serialize/apply, no relay routing, no rendered token, no unguarded paid writer, equal build/cache markers, no OfficeOps URL/token/cache in \`SHELL_PATHS\`, and no extra public artifact.
- [ ] **Audit then implement final paired marker:** Before selecting the release marker run:
\`\`\`powershell
rg -n --glob '!*node_modules*' 'hyeonjang-v[0-9]+-' index.html sw.js tests docs
git log --all --oneline -- index.html sw.js
\`\`\`
Choose the first unused integer, record that concrete value in the implementation commit, and edit both marker strings together only after all code is final. Do not ship a symbolic/literal placeholder and do not add an external script to \`SHELL_PATHS\`.
- [ ] **GREEN:**
\`\`\`powershell
& $node tests/syntax.check.js
& $node tests/version-sync.check.js
& $node tests/sw-cache.check.js
& $node tests/pages-artifact.e2e.js
& $node tests/office-ops-ui.e2e.js
& $node tests/office-ops-isolation.e2e.js
& $node tests/paid-work-gate.e2e.js
& $node tests/legacy-commercial-gate.e2e.js
& $node tests/office-ops-conversion.e2e.js
& $node tests/relay.e2e.js
& $node tests/run-all.js
\`\`\`
- [ ] **Commit:**
\`\`\`bash
git add index.html sw.js tests/office-ops-ui.e2e.js tests/office-ops-isolation.e2e.js tests/paid-work-gate.e2e.js tests/legacy-commercial-gate.e2e.js tests/office-ops-conversion.e2e.js
git commit -m \"feat: release isolated OfficeOps approval client\"
\`\`\`

## Self-Review Checklist

- Exact \`timestamp\` envelope, nonce echo, receipt unwrap, evidence ID/\`approvedAt\`, \`aptOrder\` subject, and explicit post-mutation load are covered.
- General/AI/OfficeIntake/diagnosis/conversion/settlement/legacy plus exactly two free exceptions are mapped; static test blocks direct bypass.
- Pilot tests cover exact stage, 30-day KST month/leap/year behavior and server extension; consent covers 6/12/hash/evidence/withdrawal; K-apt rejects parse failure and skew over five minutes.
- Saga carries \`inspectionId\`, \`conversionId\`, \`pendingOrderId\`, \`receiptId\`, \`receiptSubjectType\`, \`receiptSubjectId\`, \`termsSha256\` (from receipt \`approvedTermsSha256\`); record/finalize carry \`linkedOrderId\`; resume/finalize revalidate all IDs.
- Client owns \`office-ops-isolation\`; relay remains unchanged regression. This plan contains no production edit. Before handoff run \`git diff --check\` and \`git status --short\`.

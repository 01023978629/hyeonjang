'use strict';
/* Task 5 OfficeOps preventive-inspection conversion/recovery contract.
   The VM half keeps canonical/proof/saga failures deterministic.  Browser
   acceptance below exercises the actual DOM, IndexedDB paid gate, reload,
   response-loss recovery, and mobile accessibility. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { createHash, webcrypto } = require('node:crypto');

function loadPlaywright() {
  const candidates = [
    'playwright',
    path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright'
  ];
  let lastError;
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { lastError = error; }
  }
  throw lastError;
}
const { chromium } = loadPlaywright();

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appRoot = path.resolve(__dirname, '..');
const nodeSha256 = value => createHash('sha256').update(value).digest('hex');

function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(match, 'missing OfficeOps conversion function: ' + name);
  const paramsStart = source.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === '(') params += 1;
    if (source[i] === ')' && --params === 0) { open = source.indexOf('{', i); break; }
  }
  assert.ok(open >= 0, 'OfficeOps conversion function body missing: ' + name);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(match.index, i + 1);
  }
  assert.fail('unbalanced OfficeOps conversion function: ' + name);
}

const TERMS = Object.freeze({
  workKind: 'preventive-inspection', scope: '지하 공용 배관 점검', exclusions: ['세대 내부'], vatMode: 'included',
  quotedAmount: 330000, validUntil: '2026-09-30', scheduleWindow: '평일 오전 협의'
});
const TERMS_HASH = nodeSha256(JSON.stringify(TERMS));
const RECEIPT = Object.freeze({
  receiptId: 'receipt_conversion_001', subjectType: 'aptOrder', subjectId: 'order_conversion_001', approvedTermsSha256: TERMS_HASH,
  approvalEvidenceType: 'quote-file', approvalEvidenceFileId: 'drive_file_conversion_001', approvalEvidenceSha256: 'e'.repeat(64),
  approvedAt: '2026-08-31T10:00:00+09:00', approvedByRole: 'management-office', issuedAt: '2026-08-31T10:00:01+09:00', receiptHmac: 'f'.repeat(64)
});

function inspectionFixture(status = 'proposal', overrides = {}) {
  const converting = ['conversion-pending', 'conversion-writing', 'conversion-local-committed', 'converted'].includes(status);
  const linked = ['conversion-local-committed', 'converted'].includes(status);
  return {
    inspectionId: 'inspection_conversion_001', officeId: 'office_remote_001', complexName: '테스트 단지', templateId: 'preventive-v1', status,
    nextDueAt: '2026-09-15', riskItems: ['밸브 노후'], summary: '관리사무소 예방점검 제안', commercialTerms: TERMS,
    commercialApproval: converting ? RECEIPT : null, conversionId: converting ? 'conversion_001' : null,
    conversionTermsSha256: converting ? TERMS_HASH : null, conversionReceiptId: converting ? RECEIPT.receiptId : null,
    pendingOrderId: converting ? RECEIPT.subjectId : null, linkedOrderId: linked ? RECEIPT.subjectId : null,
    conversionStartedAt: converting ? '2026-08-31T10:00:02+09:00' : null, updatedAt: '2026-08-31T10:00:02+09:00',
    archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null, ...overrides
  };
}

function exactPersistedOrder(overrides = {}) {
  return {
    id: RECEIPT.subjectId, officeId: 'local_office_001', unit: '공용부', text: TERMS.scope, amount: TERMS.quotedAmount,
    pipeType: '미확정', date: '2026-09-01', source: 'officeops-preventive-inspection',
    sourceOfficeOpsInspectionId: 'inspection_conversion_001', sourceOfficeOpsConversionId: 'conversion_001', status: 'visit',
    commercialGateVersion: 1, commercialTerms: TERMS, commercialApproval: RECEIPT, ...overrides
  };
}

function freshStore(status = 'proposal', overrides = {}) {
  return { revision: 10, inspections: [inspectionFixture(status, overrides)] };
}

function browserStore() {
  return {
    schemaVersion: 1, revision: 0, updatedAt: '2026-09-01T09:00:00+09:00', pilots: [], consents: [],
    inspections: [inspectionFixture('proposal', { updatedAt: '2026-09-01T09:00:00+09:00' })], opportunities: [], audit: []
  };
}

function createBrowserScenario(options = {}) {
  return {
    store: browserStore(), lossAfter: options.lossAfter || '', failBefore: options.failBefore || '', lost: false,
    officeCalls: [], commercialCalls: [], issueCount: 0, verifyNonces: [], receipt: null
  };
}

function browserAuditAt(revision) {
  return '2026-09-01T09:00:0' + revision + '+09:00';
}

function commitBrowserOfficeMutation(scenario, envelope) {
  const payload = envelope.payload, store = scenario.store, inspection = store.inspections[0], preRevision = store.revision;
  assert.equal(payload.expectedRevision, preRevision, 'browser fake receives the fresh prior revision');
  const at = browserAuditAt(preRevision + 1);
  if (envelope.action === 'officeInspectionBeginConversion') Object.assign(inspection, {
    status: 'conversion-pending', commercialTerms: structuredClone(payload.commercialTerms), commercialApproval: structuredClone(payload.commercialApproval),
    conversionId: payload.conversionId, conversionTermsSha256: payload.termsSha256, conversionReceiptId: payload.receiptId,
    pendingOrderId: payload.pendingOrderId, linkedOrderId: null, conversionStartedAt: at
  });
  else if (envelope.action === 'officeInspectionArmLocalCommit') inspection.status = 'conversion-writing';
  else if (envelope.action === 'officeInspectionRecordLocalCommit') { inspection.status = 'conversion-local-committed'; inspection.linkedOrderId = payload.linkedOrderId; }
  else if (envelope.action === 'officeInspectionFinalizeConversion') inspection.status = 'converted';
  else if (envelope.action === 'officeInspectionCancelConversion') Object.assign(inspection, {
    status: 'proposal', commercialApproval: null, conversionId: null, conversionTermsSha256: null,
    conversionReceiptId: null, pendingOrderId: null, linkedOrderId: null, conversionStartedAt: null
  });
  else assert.fail('unexpected browser OfficeOps mutation ' + envelope.action);
  inspection.updatedAt = at; store.revision += 1; store.updatedAt = at;
  store.audit.push({
    action: envelope.action, result: 'ok', id: inspection.inspectionId, mutationId: envelope.mutationId, idempotencyKey: null,
    payloadSha256: nodeSha256(JSON.stringify(payload)), at, actor: 'representative', lifecycleBefore: null,
    backupFileId: 'backup_browser_' + store.revision, backupManifestFileId: 'manifest_browser_' + store.revision,
    backupSha256: String(store.revision).repeat(64).slice(0, 64), preMutationRevision: preRevision
  });
  return { ok: true, id: inspection.inspectionId, revision: store.revision, updatedAt: at };
}

async function routeBrowserOffice(scenario, route) {
  const envelope = route.request().postDataJSON(); scenario.officeCalls.push(structuredClone(envelope));
  if (envelope.action === 'officeOpsList') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, store: scenario.store }) }); return;
  }
  if (scenario.failBefore === envelope.action && !scenario.lost) { scenario.lost = true; await route.abort('connectionfailed'); return; }
  if (envelope.payload.expectedRevision !== scenario.store.revision) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'revision-conflict' }) }); return;
  }
  const acknowledgement = commitBrowserOfficeMutation(scenario, envelope);
  if (scenario.lossAfter === envelope.action && !scenario.lost) { scenario.lost = true; await route.abort('connectionfailed'); return; }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(acknowledgement) });
}

async function routeBrowserCommercial(scenario, route) {
  const envelope = route.request().postDataJSON(), payload = envelope.payload; scenario.commercialCalls.push(structuredClone(envelope));
  if (envelope.action === 'commercialApprovalIssue') {
    scenario.issueCount += 1;
    const hash = nodeSha256(JSON.stringify(payload.commercialTerms));
    scenario.receipt = {
      receiptId: 'receipt_browser_' + scenario.issueCount, subjectType: 'aptOrder', subjectId: payload.subjectId, approvedTermsSha256: hash,
      approvalEvidenceType: payload.approvalEvidenceType, approvalEvidenceFileId: payload.approvalEvidenceFileId,
      approvalEvidenceSha256: 'a'.repeat(64), approvedAt: payload.approvedAt, approvedByRole: payload.approvedByRole,
      issuedAt: '2026-09-01T09:00:01+09:00', receiptHmac: 'b'.repeat(64)
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, commercialApproval: scenario.receipt }) }); return;
  }
  if (envelope.action === 'commercialNow') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, serverNowKst: '2026-09-01T09:00:02+09:00', receivedAtKst: '2026-09-01T09:00:02+09:00', nonce: payload.nonce }) }); return;
  }
  if (envelope.action === 'commercialApprovalVerify') {
    scenario.verifyNonces.push(payload.nonce);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, receiptId: payload.commercialApproval.receiptId,
      serverNowKst: '2026-09-01T09:00:03+09:00', nonce: payload.nonce, verifyExpiresAtKst: '2026-09-01T09:00:33+09:00' }) }); return;
  }
  assert.fail('unexpected browser commercial action ' + envelope.action);
}

async function createActualConversionPage(browser, appUrl, scenario) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await context.route('https://office.example/**', route => routeBrowserOffice(scenario, route));
  await context.route('https://commercial.example/**', route => routeBrowserCommercial(scenario, route));
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { await window.__hjRestoreDone; clearTimeout(__idbSaveTimer); await __appStateWriteQueue; });
  await page.evaluate(async () => {
    await idbSet('office_ops_url', 'https://office.example/ops'); await idbSet('office_ops_token', 'office-token');
    await idbSet('commercial_approval_url', 'https://commercial.example/approval'); await idbSet('commercial_approval_token', 'commercial-token');
    await officeOpsBoot(); state.projects = []; state.files = []; state.aptOffices = [{ id: 'local_office_browser', complex: '테스트 단지', manager: '', phone: '' }];
    state.aptOrders = []; __tabStale = false; __paidApprovalConsumptions.clear(); clearTimeout(__idbSaveTimer);
  });
  return { context, page };
}

function createVmHarness() {
  const scenario = {
    store: freshStore(), mode: 'fresh', offices: [{ id: 'local_office_001', complex: '테스트 단지' }], orders: [],
    ids: ['conversion_001', RECEIPT.subjectId], issueCalls: [], validateCalls: [], snapshotCalls: [], gateCalls: [], mutationCalls: [],
    validationFailure: false, snapshotResult: true, lossAfter: '', failBefore: '', lost: false
  };
  const sandbox = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Promise, Date, Intl, URL, Map, Set,
    TextEncoder, Uint8Array, structuredClone, crypto: webcrypto,
    performance: { now: (() => { let value = 0; return () => ++value; })() },
    localDate: () => '2026-09-01',
    uid: () => scenario.ids.shift() || ('fresh_' + Math.random().toString(36).slice(2, 9)),
    state: { aptOffices: scenario.offices, aptOrders: scenario.orders },
    hjSnapshot: async (...args) => { scenario.snapshotCalls.push(args); return scenario.snapshotResult; },
    issueCommercialApproval: async input => { scenario.issueCalls.push(structuredClone(input)); return structuredClone(RECEIPT); },
    validateCommercialApproval: async input => {
      scenario.validateCalls.push(structuredClone(input));
      if (scenario.validationFailure) throw new Error('approval verification failed');
      return { receiptId: input.commercialApproval.receiptId, nonce: 'verify_' + scenario.validateCalls.length, useBeforeMonotonicMs: 10000 };
    },
    executePaidWorkGate: async input => {
      scenario.gateCalls.push(input);
      const draft = structuredClone(input.createDraft);
      const order = { ...draft };
      delete order.state;
      Object.assign(order, { status: 'visit', commercialGateVersion: 1, commercialTerms: structuredClone(input.commercialTerms), commercialApproval: structuredClone(input.commercialApproval) });
      scenario.orders.push(order);
      return order;
    },
    officeOpsLoad: async () => {
      sandbox.__officeOps.mode = scenario.mode;
      sandbox.__officeOps.cache = scenario.store;
      sandbox.__officeOps.revision = scenario.store.revision;
      return scenario.store;
    },
    officeOpsMutationWithAck: async (action, payload) => {
      scenario.mutationCalls.push({ action, payload: structuredClone(payload) });
      if (scenario.failBefore === action && !scenario.lost) { scenario.lost = true; throw new TypeError('network lost before commit'); }
      const inspection = scenario.store.inspections[0];
      if (payload.expectedRevision !== scenario.store.revision) throw new Error('revision-conflict');
      if (action === 'officeInspectionBeginConversion') Object.assign(inspection, {
        status: 'conversion-pending', conversionId: payload.conversionId, pendingOrderId: payload.pendingOrderId,
        conversionReceiptId: payload.receiptId, conversionTermsSha256: payload.termsSha256, commercialTerms: structuredClone(payload.commercialTerms),
        commercialApproval: structuredClone(payload.commercialApproval), conversionStartedAt: '2026-08-31T10:00:02+09:00', linkedOrderId: null
      });
      else if (action === 'officeInspectionArmLocalCommit') inspection.status = 'conversion-writing';
      else if (action === 'officeInspectionRecordLocalCommit') { inspection.status = 'conversion-local-committed'; inspection.linkedOrderId = payload.linkedOrderId; }
      else if (action === 'officeInspectionFinalizeConversion') inspection.status = 'converted';
      else if (action === 'officeInspectionCancelConversion') Object.assign(inspection, { status: 'proposal', commercialApproval: null, conversionId: null, conversionTermsSha256: null, conversionReceiptId: null, pendingOrderId: null, linkedOrderId: null, conversionStartedAt: null });
      scenario.store.revision += 1;
      sandbox.__officeOps.revision = scenario.store.revision;
      if (scenario.lossAfter === action && !scenario.lost) { scenario.lost = true; throw new TypeError('network response lost after commit'); }
      return { ack: { id: inspection.inspectionId, revision: scenario.store.revision, updatedAt: inspection.updatedAt }, store: scenario.store };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext("var __officeOps={mode:'fresh',revision:10,cache:null};", sandbox);
  for (const name of [
    'paidPlainObject', 'paidExactKeys', 'isRealIsoDate', 'formatKstIso', 'parseStrictKstDateTime', 'sha256Hex',
    'normalizeCommercialTerms', 'normalizeReceipt', 'officeOpsExactKeys', 'validOfficeString', 'normalizeOfficeTombstone',
    'normalizeOfficeCommercialTerms', 'normalizeOfficeApprovalMetadata', 'normalizeOfficeInspectionRecord', 'validateOfficeInspectionIntegrity',
    'officeOpsComplexNameKey', 'officeOpsConversionPayload', 'officeOpsCanonicalConversionTerms', 'officeOpsCanonicalConversionReceipt',
    'officeOpsAptOrderDraft', 'officeOpsValidateExistingConversionOrder', 'officeOpsInspectionConversionActions',
    'officeOpsProofValueInUse', 'officeOpsCreateConversionIds', 'officeOpsAssertCallerConversionIdentity', 'officeOpsLoadConversionContext',
    'officeOpsDriveInspectionConversion', 'convertOfficeOpsInspectionToAptOrder', 'resumeOfficeOpsInspectionConversion',
    'cancelOfficeOpsInspectionConversion'
  ]) vm.runInContext(extractFunction(name), sandbox);
  const run = expression => vm.runInContext(expression, sandbox);
  const resetState = (status = 'proposal', overrides = {}) => {
    scenario.store = freshStore(status, overrides); scenario.mode = 'fresh'; scenario.offices = [{ id: 'local_office_001', complex: '테스트 단지' }];
    scenario.orders = []; scenario.ids = ['conversion_001', RECEIPT.subjectId]; scenario.issueCalls.length = 0; scenario.validateCalls.length = 0;
    scenario.snapshotCalls.length = 0; scenario.gateCalls.length = 0; scenario.mutationCalls.length = 0; scenario.validationFailure = false;
    scenario.snapshotResult = true; scenario.lossAfter = ''; scenario.failBefore = ''; scenario.lost = false;
    sandbox.state.aptOffices = scenario.offices; sandbox.state.aptOrders = scenario.orders; sandbox.__officeOps.mode = 'fresh'; sandbox.__officeOps.revision = 10; sandbox.__officeOps.cache = scenario.store;
  };
  return { scenario, sandbox, run, resetState };
}

function proofFromInspection(inspection) {
  return {
    inspectionId: inspection.inspectionId, conversionId: inspection.conversionId, pendingOrderId: inspection.pendingOrderId,
    receiptId: inspection.conversionReceiptId, receiptSubjectType: inspection.commercialApproval.subjectType,
    receiptSubjectId: inspection.commercialApproval.subjectId, termsSha256: inspection.conversionTermsSha256,
    linkedOrderId: inspection.linkedOrderId
  };
}

async function runVmContracts() {
  const { scenario, sandbox, run, resetState } = createVmHarness();
  const plain = value => JSON.parse(JSON.stringify(value));

  assert.equal(run("officeOpsComplexNameKey('  테스트　단지  ')"), '테스트 단지', 'mapping canonicalizes Unicode/spacing but remains exact');
  const payload = plain(run('officeOpsConversionPayload(' + JSON.stringify({
    inspectionId: 'inspection_conversion_001', conversionId: 'conversion_001', pendingOrderId: RECEIPT.subjectId,
    receiptId: RECEIPT.receiptId, receiptSubjectType: 'aptOrder', receiptSubjectId: RECEIPT.subjectId, termsSha256: TERMS_HASH
  }) + ')'));
  assert.deepEqual(Object.keys(payload), ['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256']);
  assert.deepEqual(payload, {
    inspectionId: 'inspection_conversion_001', conversionId: 'conversion_001', pendingOrderId: RECEIPT.subjectId,
    receiptId: RECEIPT.receiptId, receiptSubjectType: 'aptOrder', receiptSubjectId: RECEIPT.subjectId, termsSha256: TERMS_HASH
  });
  assert.throws(() => run('officeOpsConversionPayload(' + JSON.stringify({
    inspectionId: 'inspection_conversion_001', conversionId: RECEIPT.subjectId, pendingOrderId: RECEIPT.subjectId,
    receiptId: RECEIPT.receiptId, receiptSubjectType: 'aptOrder', receiptSubjectId: RECEIPT.subjectId, termsSha256: TERMS_HASH
  }) + ')'), /identity conflict/, 'pairwise-equal proof IDs fail closed');
  resetState(); scenario.ids = ['collision_id', 'collision_id', RECEIPT.subjectId];
  assert.deepEqual(plain(run('officeOpsCreateConversionIds(__officeOps.cache,__officeOps.cache.inspections[0])')),
    { conversionId: 'collision_id', pendingOrderId: RECEIPT.subjectId }, 'generated pairwise collision is discarded before receipt issue');
  assert.equal(scenario.issueCalls.length, 0);
  resetState();
  const draft = plain(run('officeOpsAptOrderDraft(' + JSON.stringify(inspectionFixture()) + ',{conversionId:"conversion_001",pendingOrderId:' + JSON.stringify(RECEIPT.subjectId) + ',commercialTerms:' + JSON.stringify(TERMS) + ',localOffice:{id:"local_office_001",complex:"테스트 단지"}})'));
  assert.deepEqual(draft, {
    id: RECEIPT.subjectId, officeId: 'local_office_001', unit: '공용부', text: TERMS.scope, amount: TERMS.quotedAmount,
    pipeType: '미확정', date: '2026-09-01', state: 'visit', source: 'officeops-preventive-inspection',
    sourceOfficeOpsInspectionId: 'inspection_conversion_001', sourceOfficeOpsConversionId: 'conversion_001'
  }, 'draft is the frozen privacy whitelist and does not copy OfficeOps PII or gate-owned fields');

  const approvalInput = {
    approvalEvidenceFileId: RECEIPT.approvalEvidenceFileId, approvalEvidenceType: RECEIPT.approvalEvidenceType,
    approvedAt: RECEIPT.approvedAt, approvedByRole: RECEIPT.approvedByRole
  };
  const result = await run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')');
  assert.equal(result.status, 'converted');
  assert.deepEqual(scenario.mutationCalls.map(call => call.action), [
    'officeInspectionBeginConversion', 'officeInspectionArmLocalCommit', 'officeInspectionRecordLocalCommit', 'officeInspectionFinalizeConversion'
  ]);
  assert.deepEqual(scenario.mutationCalls.map(call => call.payload.expectedRevision), [10, 11, 12, 13], 'each stage consumes the fresh reloaded revision');
  const begin = scenario.mutationCalls[0].payload;
  assert.deepEqual(Object.keys(begin), ['inspectionId','conversionId','pendingOrderId','receiptId','receiptSubjectType','receiptSubjectId','termsSha256','commercialTerms','commercialApproval','expectedRevision']);
  assert.deepEqual(begin.commercialTerms, TERMS, 'Begin freezes canonical terms byte-for-byte');
  assert.deepEqual(begin.commercialApproval, RECEIPT, 'Begin freezes all eleven signed receipt fields');
  assert.deepEqual(scenario.snapshotCalls, [['OfficeOps 예방점검 오더 전환 준비', true, true]], 'required allow-empty recovery snapshot happens before Begin');
  assert.equal(scenario.issueCalls.length, 1);
  assert.equal(scenario.orders.length, 1);
  assert.doesNotMatch(JSON.stringify(scenario.orders[0]), /관리사무소 예방점검 제안|밸브 노후|office_remote_001/, 'local order contains no OfficeOps summary/risk/remote office PII');
  assert.ok(scenario.validateCalls.length >= 5, 'new conversion freshly validates receipt across stages and the paid gate boundary');

  for (const [label, lossAfter, failBefore, expectedStatus, expectedOrders] of [
    ['Begin ACK loss', 'officeInspectionBeginConversion', '', 'conversion-pending', 0],
    ['Arm ACK loss', 'officeInspectionArmLocalCommit', '', 'conversion-writing', 0],
    ['local durable commit before Record request loss', '', 'officeInspectionRecordLocalCommit', 'conversion-writing', 1],
    ['Record ACK loss', 'officeInspectionRecordLocalCommit', '', 'conversion-local-committed', 1],
    ['Finalize ACK loss', 'officeInspectionFinalizeConversion', '', 'converted', 1]
  ]) {
    resetState(); scenario.lossAfter = lossAfter; scenario.failBefore = failBefore;
    await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /network/);
    assert.equal(scenario.store.inspections[0].status, expectedStatus, label + ' preserves the server-committed stage');
    assert.equal(scenario.orders.length, expectedOrders, label + ' has the expected durable local multiplicity');
    const lostAction = lossAfter || failBefore;
    assert.equal(scenario.mutationCalls.filter(call => call.action === lostAction).length, 1, label + ' does not automatically retry a lost response');
    const issueCount = scenario.issueCalls.length;
    scenario.lossAfter = ''; scenario.failBefore = '';
    const resumed = await run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')');
    assert.equal(resumed.status, 'converted', label + ' resumes explicitly to completion');
    assert.equal(scenario.orders.length, 1, label + ' resumes without duplicate local order');
    assert.equal(scenario.issueCalls.length, issueCount, label + ' resume never reissues the receipt');
  }

  resetState();
  const mutationWithoutRace = sandbox.officeOpsMutationWithAck;
  let secondTabAdvanced = false;
  sandbox.officeOpsMutationWithAck = async (action, body) => {
    if (action === 'officeInspectionArmLocalCommit' && !secondTabAdvanced) {
      secondTabAdvanced = true;
      scenario.store.revision += 1;
    }
    return mutationWithoutRace(action, body);
  };
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /revision-conflict/);
  assert.equal(scenario.store.inspections[0].status, 'conversion-pending', 'second-tab server revision conflict cannot advance Arm');
  assert.equal(scenario.orders.length, 0);
  const secondTabProof = proofFromInspection(scenario.store.inspections[0]);
  const secondTabIssueCount = scenario.issueCalls.length;
  sandbox.officeOpsMutationWithAck = mutationWithoutRace;
  const secondTabResumed = await run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(secondTabProof) + ')');
  assert.equal(secondTabResumed.status, 'converted', 'explicit resume reloads the second-tab revision and preserves the frozen proof');
  assert.equal(scenario.issueCalls.length, secondTabIssueCount, 'revision-conflict resume never reissues the receipt');
  assert.equal(scenario.orders.length, 1);

  resetState(); scenario.offices.length = 0;
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /local office mapping/);
  assert.deepEqual([scenario.issueCalls.length, scenario.validateCalls.length, scenario.snapshotCalls.length, scenario.mutationCalls.length, scenario.orders.length], [0,0,0,0,0]);
  resetState(); scenario.offices.push({ id: 'local_office_002', complex: '  테스트　단지 ' });
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /local office mapping/);
  assert.equal(scenario.issueCalls.length, 0, 'ambiguous mapping fails before receipt issue');

  resetState(); scenario.validationFailure = true;
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /approval verification/);
  assert.deepEqual([scenario.snapshotCalls.length, scenario.mutationCalls.length, scenario.orders.length], [0,0,0], 'receipt verification failure has zero snapshot/server/local effects');
  resetState(); scenario.snapshotResult = false;
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /snapshot/);
  assert.deepEqual([scenario.mutationCalls.length, scenario.orders.length], [0,0], 'snapshot failure blocks Begin and local state');
  resetState(); scenario.mode = 'stale-export-only';
  await assert.rejects(() => run('convertOfficeOpsInspectionToAptOrder("inspection_conversion_001",' + JSON.stringify(approvalInput) + ')'), /office-disabled/);
  assert.deepEqual([scenario.issueCalls.length, scenario.validateCalls.length, scenario.snapshotCalls.length, scenario.mutationCalls.length, scenario.orders.length], [0,0,0,0,0]);

  resetState('conversion-writing'); scenario.orders.push(exactPersistedOrder(), exactPersistedOrder());
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /duplicate local order/);
  assert.deepEqual([scenario.validateCalls.length, scenario.snapshotCalls.length, scenario.mutationCalls.length], [0,0,0], 'duplicate pendingOrderId fails before verification or mutation');
  for (const [label, orderOverride, setup] of [
    ['amount', { amount: TERMS.quotedAmount + 1 }],
    ['status', { status: 'work' }],
    ['local office mapping', { officeId: 'local_office_other' }],
    ['source kind', { source: 'manual-paid-diagnosis' }],
    ['source inspection ID', { sourceOfficeOpsInspectionId: 'inspection_other' }],
    ['source conversion ID', { sourceOfficeOpsConversionId: 'conversion_other' }],
    ['canonical terms', { commercialTerms: { ...TERMS, exclusions: ['다른 제외'] } }]
  ]) {
    resetState('conversion-writing'); if (setup) setup(); scenario.orders.push(exactPersistedOrder(orderOverride));
    await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /existing local order|conversion proof|local office/);
    assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], label + ' mismatch has zero conversion mutation');
  }
  const receiptTamper = {
    receiptId: 'receipt_other', subjectType: 'project', subjectId: 'order_other', approvedTermsSha256: 'd'.repeat(64),
    approvalEvidenceType: 'contract-file', approvalEvidenceFileId: 'drive_file_other', approvalEvidenceSha256: 'd'.repeat(64),
    approvedAt: '2026-08-31T09:59:00+09:00', approvedByRole: 'customer', issuedAt: '2026-08-31T10:00:02+09:00', receiptHmac: 'c'.repeat(64)
  };
  for (const [field, changed] of Object.entries(receiptTamper)) {
    resetState('conversion-writing');
    scenario.orders.push(exactPersistedOrder({ commercialApproval: { ...RECEIPT, [field]: changed } }));
    await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /existing local order|invalid commercial receipt|invalid commercial approval/);
    assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'receipt field ' + field + ' mismatch has zero conversion mutation');
  }
  resetState('conversion-writing', { conversionTermsSha256: 'd'.repeat(64) });
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /conversion proof|invalid inspection record/);
  assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'server hash mismatch has zero conversion mutation');
  resetState('conversion-writing', { commercialTerms: { ...TERMS, exclusions: ['서버 변조'] } });
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /conversion proof|invalid inspection record/);
  assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'server terms mismatch has zero conversion mutation');
  resetState('conversion-local-committed', { linkedOrderId: 'order_other' }); scenario.orders.push(exactPersistedOrder());
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /conversion proof|local order|invalid inspection record/);
  assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'linked ID mismatch has zero conversion mutation');
  resetState('conversion-writing'); scenario.orders.push({ id: 'order_other', sourceOfficeOpsConversionId: 'conversion_001' });
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /reused conversion proof/);
  assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'proof ID reused by another local order fails before effects');
  for (const [field, changed] of Object.entries({
    inspectionId: 'inspection_other', conversionId: 'conversion_other', pendingOrderId: 'order_other', receiptId: 'receipt_other',
    receiptSubjectType: 'project', receiptSubjectId: 'order_other', termsSha256: 'd'.repeat(64), linkedOrderId: 'order_other'
  })) {
    resetState('conversion-writing'); const caller = { ...proofFromInspection(scenario.store.inspections[0]), [field]: changed };
    await assert.rejects(() => run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(caller) + ')'), /conversion identity|invalid conversion inspection/);
    assert.deepEqual([scenario.validateCalls.length, scenario.gateCalls.length, scenario.mutationCalls.length], [0,0,0], 'caller ' + field + ' mismatch has zero conversion mutation');
  }
  resetState('converted'); scenario.orders.push(exactPersistedOrder());
  const completed = await run('resumeOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')');
  assert.equal(completed.status, 'converted'); assert.equal(scenario.mutationCalls.length, 0); assert.ok(scenario.validateCalls.length >= 1, 'idempotent converted resume still fresh-validates the stored receipt');
  resetState();
  await assert.rejects(() => run('resumeOfficeOpsInspectionConversion({inspectionId:"inspection_conversion_001"})'), /invalid conversion state/);
  assert.deepEqual([scenario.validateCalls.length, scenario.snapshotCalls.length, scenario.mutationCalls.length], [0,0,0]);

  resetState('conversion-pending');
  const pendingProof = proofFromInspection(scenario.store.inspections[0]);
  await run('cancelOfficeOpsInspectionConversion(' + JSON.stringify(pendingProof) + ')');
  assert.equal(scenario.store.inspections[0].status, 'proposal');
  assert.deepEqual(scenario.mutationCalls[0], { action: 'officeInspectionCancelConversion', payload: { inspectionId: pendingProof.inspectionId, conversionId: pendingProof.conversionId, expectedRevision: 10 } });
  assert.deepEqual([scenario.issueCalls.length, scenario.validateCalls.length, scenario.snapshotCalls.length, scenario.gateCalls.length], [0,0,0,0]);
  resetState('conversion-writing');
  await assert.rejects(() => run('cancelOfficeOpsInspectionConversion(' + JSON.stringify(proofFromInspection(scenario.store.inspections[0])) + ')'), /cancel/);
  assert.equal(scenario.mutationCalls.length, 0, 'post-arm cancel fails locally before network');

  const actions = label => plain(run('officeOpsInspectionConversionActions(' + JSON.stringify(inspectionFixture(label)) + ')'));
  assert.deepEqual(actions('proposal'), [{ action: 'convert', label: '현장 오더 전환' }]);
  assert.deepEqual(actions('conversion-pending'), [{ action: 'resume', label: '전환 재개' }, { action: 'cancel', label: '전환 취소' }]);
  assert.deepEqual(actions('conversion-writing'), [{ action: 'resume', label: '전환 재개' }]);
  assert.deepEqual(actions('conversion-local-committed'), [{ action: 'resume', label: '전환 재개' }]);
  assert.deepEqual(actions('converted'), []);
  assert.doesNotMatch(extractFunction('officeOpsInspectionCardHtml'), /data-officeops-(?:edit|terms|archive|restore|duplicate)/,
    'conversion card exposes no unrelated mutation controls');
  assert.equal(sandbox.state.aptOrders, scenario.orders);
}

function startAppServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const resolved = path.resolve(appRoot, '.' + pathname);
      if (resolved !== appRoot && !resolved.startsWith(appRoot + path.sep)) { response.writeHead(403); response.end('forbidden'); return; }
      fs.stat(resolved, (statError, stat) => {
        const target = !statError && stat.isDirectory() ? path.join(resolved, 'index.html') : resolved;
        fs.readFile(target, (readError, body) => {
          if (readError) { response.writeHead(404); response.end('not found'); return; }
          response.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          response.end(body);
        });
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Browser acceptance is intentionally reached only after every named product
   helper exists.  The RED run therefore fails above on the first absent helper,
   before any product code is written. */
async function runBrowserAcceptance() {
  const server = await startAppServer();
  const port = server.address().port;
  const appUrl = 'http://127.0.0.1:' + port + '/index.html';
  let browser;
  try {
    browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {});
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.evaluate(store => {
      __officeOps.mode = 'fresh'; __officeOps.cache = store; __officeOps.revision = store.revision;
      __commercialApproval.url = 'https://commercial.example/approval'; __commercialApproval.token = 'commercial-token';
      state.aptOffices = [{ id: 'local_office_001', complex: '테스트 단지', manager: '', phone: '' }]; state.aptOrders = [];
      window.__conversionUiCalls = [];
      window.officeOpsRefresh = async () => { __officeOps.mode = 'fresh'; __officeOps.cache = store; __officeOps.revision = store.revision; return store; };
      window.convertOfficeOpsInspectionToAptOrder = async inspectionId => { window.__conversionUiCalls.push(['convert', inspectionId]); return store.inspections[0]; };
      window.resumeOfficeOpsInspectionConversion = async value => { window.__conversionUiCalls.push(['resume', value.inspectionId]); return store.inspections[0]; };
      window.cancelOfficeOpsInspectionConversion = async value => { window.__conversionUiCalls.push(['cancel', value.inspectionId]); return store.inspections[0]; };
    }, freshStore());
    await page.evaluate(() => officeOpsView('inspections'));
    const inspectionTab = page.locator('#officeOpsTab-inspections');
    await inspectionTab.focus();
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-pilots');
    assert.equal(await page.locator('#officeOpsTab-pilots').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-opportunities');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-inspections');
    assert.equal(await inspectionTab.getAttribute('aria-selected'), 'true', 'OfficeOps tab keyboard behavior remains intact');
    await page.locator('#officeOpsPanel-inspections [data-officeops-convert]').waitFor();
    const card = page.locator('#officeOpsPanel-inspections [data-officeops-inspection]').first();
    assert.equal(await card.getAttribute('aria-busy'), 'false');
    assert.equal(await card.locator('[data-officeops-convert]').getAttribute('type'), 'button');
    assert.ok((await card.locator('[data-officeops-convert]').evaluate(element => element.getBoundingClientRect().height)) >= 44);
    await card.locator('[data-officeops-convert]').click();
    await page.locator('.officeops-conversion-modal').waitFor();
    assert.equal(await page.locator('.officeops-conversion-modal').getAttribute('role'), 'dialog');
    assert.equal(await page.locator('.officeops-conversion-modal').getAttribute('aria-busy'), 'false');
    assert.ok(await page.locator('.officeops-conversion-modal fieldset legend').count() >= 1);
    const unlabeledControls = await page.locator('.officeops-conversion-form input,.officeops-conversion-form select,.officeops-conversion-form textarea').evaluateAll(controls =>
      controls.filter(control => !control.id || !document.querySelector('label[for="' + CSS.escape(control.id) + '"]')).map(control => control.id));
    assert.deepEqual(unlabeledControls, [], 'every conversion form control has a real label');
    assert.equal(await page.locator('#officeOpsConversionError').getAttribute('role'), 'alert');
    assert.equal(await page.locator('#officeOpsConversionStatus').getAttribute('role'), 'status');
    assert.equal(await page.locator('#officeOpsConversionStatus').getAttribute('aria-live'), 'polite');
    await page.locator('#officeOpsConversionSubmit').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsConversionEvidenceFileId', 'first invalid control receives focus');
    const overflow390 = await page.locator('.officeops-conversion-modal').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    assert.ok(overflow390.scroll <= overflow390.client + 1, '390px modal has no horizontal overflow');
    assert.equal((await page.locator('.officeops-conversion-form').evaluate(element => getComputedStyle(element).gridTemplateColumns)).trim().split(/\s+/).length, 1,
      '390px conversion form computes to one column');
    await page.setViewportSize({ width: 360, height: 640 });
    const overflow360 = await page.locator('.officeops-conversion-modal').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    assert.ok(overflow360.scroll <= overflow360.client + 1, '360px modal has no horizontal overflow');
    await page.locator('#officeOpsConversionEvidenceFileId').fill('drive_file_conversion_001');
    await page.evaluate(() => {
      window.__uiSubmitCount = 0;
      window.convertOfficeOpsInspectionToAptOrder = () => { window.__uiSubmitCount += 1; return new Promise(resolve => { window.__uiResolveConversion = resolve; }); };
    });
    await page.locator('#officeOpsConversionSubmit').click();
    await page.locator('#officeOpsConversionSubmit').click({ force: true });
    assert.equal(await page.evaluate(() => window.__uiSubmitCount), 1, 'busy modal suppresses duplicate conversion submission');
    assert.equal(await page.locator('.officeops-conversion-modal').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('.officeops-conversion-modal .modal-close').isDisabled(), true);
    await page.keyboard.press('Escape');
    await page.locator('.officeops-conversion-modal').waitFor();
    await page.locator('#modalRoot .modal-bg').dispatchEvent('click');
    await page.locator('.officeops-conversion-modal').waitFor();
    await page.evaluate(() => history.back());
    await page.waitForTimeout(150);
    await page.locator('.officeops-conversion-modal').waitFor();
    await page.evaluate(store => window.__uiResolveConversion(store.inspections[0]), freshStore());
    await page.locator('.officeops-conversion-modal').waitFor({ state: 'detached' });
    assert.equal(errors.length, 0, 'conversion UI raises no pageerror: ' + errors.join(' | '));

    const successScenario = createBrowserScenario();
    {
      const actual = await createActualConversionPage(browser, appUrl, successScenario);
      try {
        const completed = await actual.page.evaluate(input => convertOfficeOpsInspectionToAptOrder('inspection_conversion_001', input), {
          approvalEvidenceFileId: 'drive_file_conversion_001', approvalEvidenceType: 'quote-file',
          approvedAt: '2026-08-31T10:00:00+09:00', approvedByRole: 'management-office'
        });
        assert.equal(completed.status, 'converted');
        assert.equal(successScenario.store.inspections[0].status, 'converted');
        assert.equal(successScenario.issueCount, 1);
        assert.deepEqual(successScenario.officeCalls.filter(call => call.mutationId).map(call => call.action), [
          'officeInspectionBeginConversion','officeInspectionArmLocalCommit','officeInspectionRecordLocalCommit','officeInspectionFinalizeConversion'
        ]);
        assert.equal(successScenario.store.audit.length, successScenario.store.revision);
        successScenario.store.audit.forEach((row, index) => assert.equal(row.preMutationRevision, index));
        assert.equal(successScenario.store.audit.at(-1).at, successScenario.store.updatedAt);
        assert.equal(new Set(successScenario.verifyNonces).size, successScenario.verifyNonces.length, 'every real verification uses a distinct nonce');
        const beforeReload = await actual.page.evaluate(async () => ({
          orders: state.aptOrders.length,
          order: state.aptOrders[0],
          serialized: serializeData(),
          snapshots: (await idbGet('hj_snaps')) || []
        }));
        assert.equal(beforeReload.orders, 1);
        const preparation = beforeReload.snapshots.find(row => row.label === 'OfficeOps 예방점검 오더 전환 준비');
        assert.ok(preparation, 'required preparation snapshot is durable');
        assert.equal(preparation.data.aptOrders.length, 0, 'pre-Begin recovery snapshot contains no pending local order');
        assert.ok(beforeReload.snapshots.some(row => row.label === '유상 오더 승인 저장'), 'paid gate keeps its separate durable snapshot');
        for (const sentinel of ['https://office.example/ops','office-token','office_remote_001','관리사무소 예방점검 제안','밸브 노후']) {
          assert.doesNotMatch(JSON.stringify(beforeReload.serialized), new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'normal app serialization excludes OfficeOps sentinel ' + sentinel);
          assert.doesNotMatch(JSON.stringify(preparation.data), new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'preparation snapshot excludes OfficeOps sentinel ' + sentinel);
        }
        assert.deepEqual(beforeReload.serialized.aptOrders[0].commercialApproval, successScenario.receipt, 'only approved immutable receipt metadata enters the local order');
        await actual.page.reload({ waitUntil: 'domcontentloaded' });
        await actual.page.evaluate(async () => { await window.__hjRestoreDone; });
        const restored = await actual.page.evaluate(() => ({ orders: state.aptOrders.length, order: state.aptOrders[0], source: window.__hjRestoreSource }));
        assert.equal(restored.orders, 1, 'paid conversion order survives a real browser reload');
        assert.equal(restored.order.source, 'officeops-preventive-inspection');
        assert.deepEqual(Object.keys(restored.order.commercialApproval), ['receiptId','subjectType','subjectId','approvedTermsSha256','approvalEvidenceType','approvalEvidenceFileId','approvalEvidenceSha256','approvedAt','approvedByRole','issuedAt','receiptHmac']);
        assert.deepEqual(restored.order.commercialApproval, successScenario.receipt, 'all eleven signed receipt fields survive boot recovery');
      } finally { await actual.context.close(); }
    }

    for (const [label, options, expectedStage, expectedOrders] of [
      ['Begin response loss', { lossAfter: 'officeInspectionBeginConversion' }, 'conversion-pending', 0],
      ['Arm response loss', { lossAfter: 'officeInspectionArmLocalCommit' }, 'conversion-writing', 0],
      ['local commit before Record request loss', { failBefore: 'officeInspectionRecordLocalCommit' }, 'conversion-writing', 1],
      ['Record response loss', { lossAfter: 'officeInspectionRecordLocalCommit' }, 'conversion-local-committed', 1],
      ['Finalize response loss', { lossAfter: 'officeInspectionFinalizeConversion' }, 'converted', 1]
    ]) {
      const scenario = createBrowserScenario(options), actual = await createActualConversionPage(browser, appUrl, scenario);
      try {
        const failure = await actual.page.evaluate(async input => {
          try { await convertOfficeOpsInspectionToAptOrder('inspection_conversion_001', input); return ''; }
          catch (error) { return String(error && error.message || error); }
        }, { approvalEvidenceFileId: 'drive_file_conversion_001', approvalEvidenceType: 'quote-file', approvedAt: '2026-08-31T10:00:00+09:00', approvedByRole: 'management-office' });
        assert.match(failure, /fetch|network|failed/i, label + ' is surfaced to the caller');
        assert.equal(scenario.store.inspections[0].status, expectedStage);
        assert.equal(await actual.page.evaluate(() => state.aptOrders.length), expectedOrders);
        const lostAction = options.lossAfter || options.failBefore;
        assert.equal(scenario.officeCalls.filter(call => call.action === lostAction).length, 1, label + ' has zero automatic mutation retry');
        const issueCount = scenario.issueCount;
        scenario.lossAfter = ''; scenario.failBefore = '';
        const resumed = await actual.page.evaluate(async () => {
          await officeOpsLoad();
          return resumeOfficeOpsInspectionConversion(officeOpsConversionCallerForInspection('inspection_conversion_001'));
        });
        assert.equal(resumed.status, 'converted');
        assert.equal(scenario.store.inspections[0].status, 'converted');
        assert.equal(await actual.page.evaluate(() => state.aptOrders.length), 1, label + ' explicit resume leaves exactly one local order');
        assert.equal(scenario.issueCount, issueCount, label + ' explicit resume issues zero new receipts');
        assert.equal(new Set(scenario.verifyNonces).size, scenario.verifyNonces.length, label + ' uses a fresh nonce at every real validation');
      } finally { await actual.context.close(); }
    }

    const casAndRenderScenario = createBrowserScenario({ lossAfter: 'officeInspectionArmLocalCommit' });
    {
      const actual = await createActualConversionPage(browser, appUrl, casAndRenderScenario);
      try {
        const firstFailure = await actual.page.evaluate(async input => {
          try { await convertOfficeOpsInspectionToAptOrder('inspection_conversion_001', input); return ''; }
          catch (error) { return String(error && error.message || error); }
        }, { approvalEvidenceFileId: 'drive_file_conversion_001', approvalEvidenceType: 'quote-file', approvedAt: '2026-08-31T10:00:00+09:00', approvedByRole: 'management-office' });
        assert.match(firstFailure, /fetch|network|failed/i);
        assert.equal(casAndRenderScenario.store.inspections[0].status, 'conversion-writing');
        casAndRenderScenario.lossAfter = '';
        const caller = await actual.page.evaluate(async () => { await officeOpsLoad(); return officeOpsConversionCallerForInspection('inspection_conversion_001'); });
        await actual.page.evaluate(async () => { await idbSet('paid_commit_pointer', 'paid_commit_generation:second_tab'); });
        const casFailure = await actual.page.evaluate(async value => {
          try { await resumeOfficeOpsInspectionConversion(value); return ''; }
          catch (error) { return String(error && error.message || error); }
        }, caller);
        assert.match(casFailure, /paid commit pointer conflict/, 'Task 5 create fails closed on a real local pointer/CAS race');
        assert.equal(casAndRenderScenario.store.inspections[0].status, 'conversion-writing');
        assert.equal(casAndRenderScenario.officeCalls.filter(call => call.action === 'officeInspectionRecordLocalCommit').length, 0);
        assert.equal(await actual.page.evaluate(() => state.aptOrders.length), 0, 'CAS conflict leaves no live local order');
        await actual.page.evaluate(async () => { await idbDel('paid_commit_pointer'); render = () => { throw new Error('injected render failure'); }; });
        const resumed = await actual.page.evaluate(value => resumeOfficeOpsInspectionConversion(value), caller);
        assert.equal(resumed.status, 'converted', 'render failure after durable commit does not lose the conversion');
        assert.equal(casAndRenderScenario.issueCount, 1, 'CAS and render recovery reuse the one frozen receipt');
        assert.equal(await actual.page.locator('#hjPaidCommitRecovery').getAttribute('role'), 'alert');
        assert.equal(await actual.page.evaluate(() => state.aptOrders.length), 1);
        await actual.page.reload({ waitUntil: 'domcontentloaded' });
        await actual.page.evaluate(async () => { await window.__hjRestoreDone; });
        const recovered = await actual.page.evaluate(() => ({ count: state.aptOrders.length, order: state.aptOrders[0] }));
        assert.equal(recovered.count, 1, 'render-failed Task 5 order recovers from the durable generation after reload');
        assert.deepEqual(recovered.order.commercialApproval, casAndRenderScenario.receipt);
      } finally { await actual.context.close(); }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

(async () => {
  await runVmContracts();
  await runBrowserAcceptance();
  console.log('PASS  OfficeOps conversion proof, recovery, cancel, UI, and durable isolation');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

'use strict';
/* Task 2 OfficeOps representative UI and strict browser-side contracts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { webcrypto } = require('node:crypto');
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
let browser, appServer, appPort;

function portAlive(port) {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1000 }, response => { response.resume(); resolve(true); });
    request.on('error', () => resolve(false));
    request.on('timeout', () => { request.destroy(); resolve(false); });
  });
}
function startAppServer() {
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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

function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(match, 'missing OfficeOps function: ' + name);
  const paramsStart = source.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === '(') params += 1;
    if (source[i] === ')' && --params === 0) { open = source.indexOf('{', i); break; }
  }
  assert.ok(open >= 0, 'OfficeOps function body missing: ' + name);
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
  assert.fail('unbalanced OfficeOps function: ' + name);
}

const calls = [];
const storedConsent = {
  consentId: 'consent_server_1', subjectType: 'project', subjectId: 'project_1', purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
  consentVersion: 'reinspection-v1', consentTextSnapshot: 'consent snapshot', consentTextSha256: '14f8b388a01d5ec9efb2bf24eb5015621de5fe523cb8b68522b58299d94e123a',
  recordedBy: '대표', consentedAt: '2026-08-31T12:00:00+09:00', withdrawnAt: null, withdrawnBy: null, withdrawalReason: null,
  nextDueAt: '2027-02-28', lastContactedAt: null, evidenceType: 'recorded-call-note', evidenceId: 'note_1',
  audit: [{ event: 'recorded', at: '2026-08-31T12:00:00+09:00', actor: '대표', reason: null }]
};
let ackConsentRow = storedConsent;
let withdrawnConsentRow = { ...storedConsent, withdrawnAt: '2026-08-31T12:00:02+09:00', withdrawnBy: '대표', withdrawalReason: '고객 철회',
  audit: [...storedConsent.audit, { event: 'withdrawn', at: '2026-08-31T12:00:02+09:00', actor: '대표', reason: '고객 철회' }] };
const withdrawAuditRow = {
  action: 'officeConsentWithdraw', result: 'ok', id: 'consent_server_1', mutationId: 'mutation_withdraw_12', idempotencyKey: null,
  payloadSha256: 'c'.repeat(64), at: '2026-08-31T12:00:02+09:00', actor: 'representative', lifecycleBefore: null,
  backupFileId: 'backup_withdraw_12', backupManifestFileId: 'manifest_withdraw_12', backupSha256: 'd'.repeat(64), preMutationRevision: 11
};
const validWithdrawalResult = () => ({
  ack: { id: 'consent_server_1', revision: 12, updatedAt: '2026-08-31T12:00:02+09:00' },
  store: { revision: 12, consents: [withdrawnConsentRow], audit: [withdrawAuditRow] }
});
let withdrawalResult = validWithdrawalResult();
const sandbox = {
  Intl, Date, URL, Object, String, Number, Array, RegExp, Error, Promise, TextEncoder, Uint8Array, crypto: webcrypto,
  escapeHtml: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  escapeAttr: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  officeOpsMutationWithAck: async (action, payload) => {
    calls.push({ kind: 'ack', action, payload });
    if (action === 'officeConsentWithdraw') return withdrawalResult;
    return { ack: { id: 'consent_server_1', revision: 12, updatedAt: '2026-08-31T12:00:01+09:00' }, store: { consents: [ackConsentRow] } };
  },
  officeOpsMutation: async (action, payload) => {
    calls.push({ kind: 'store', action, payload });
    return { consents: [{ ...withdrawnConsentRow, withdrawnBy: payload.withdrawnBy, withdrawalReason: payload.withdrawalReason }] };
  }
};
vm.createContext(sandbox);
vm.runInContext("const __officeOps={mode:'fresh',revision:11,cache:{pilots:[]}};", sandbox);
for (const name of [
  'isRealIsoDate', 'formatKstIso', 'pilotEndsAtKst', 'parseStrictKstDateTime',
  'officeOpsExactKeys', 'validOfficeString', 'normalizeOfficeTombstone',
  'normalizePilotEditable', 'normalizePilotRecord', 'pilotWindowView', 'pilotEditablePayload',
  'updateOfficePilot', 'normalizeReinspectionConsent', 'sha256Hex', 'reinspectionNextDueAtKst', 'normalizeOfficeConsentRecord', 'validateOfficeConsentIntegrity',
  'normalizeOfficeCommercialTerms', 'normalizeOfficeApprovalMetadata', 'normalizeOfficeInspectionRecord', 'validateOfficeInspectionIntegrity',
  'normalizeKAptUrl', 'normalizeOfficeOpportunityRecord', 'officeOpsAuditIdValid', 'normalizeOfficeAuditRow', 'normalizeOfficeOpsStore', 'validateOfficeOpsAuditHistory', 'validateOfficeOpsStoreIntegrity', 'normalizeAndValidateOfficeOpsStore', 'officeOpsRevokeFresh',
  'persistReinspectionConsent', 'withdrawReinspectionConsent', 'officeOpsCanParticipate', 'officeOpsOpportunityCanParticipate', 'officeOpsPanelHtml'
]) vm.runInContext(extractFunction(name), sandbox);

const run = expression => vm.runInContext(expression, sandbox);
const plain = value => JSON.parse(JSON.stringify(value));
const pilotKeys = ['pilotId','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes','createdAt','updatedAt','retentionStartedAt','archivedAt','archivedBy','archiveReason','restoredAt'];
const editableKeys = ['pilotId','expectedRevision','complexName','source','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt','nextActionAt','owner','notes'];
const pilot = {
  pilotId: 'pilot_alpha', complexName: '한빛 아파트', source: 'website', stage: 'pilot',
  pilotStartedAt: '2026-08-31T00:00:00+09:00', pilotEndsAt: '2026-09-29T23:59:59+09:00', extensionApprovedAt: null,
  nextActionAt: '2026-09-02', owner: '대표', notes: '대표 메모',
  createdAt: '2026-08-30T12:00:00+09:00', updatedAt: '2026-08-31T12:00:00+09:00', retentionStartedAt: null,
  archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
};
const inspection = {
  inspectionId: 'inspection_test', officeId: 'office_test', complexName: '테스트 단지', templateId: 'preventive-v1', status: 'proposal',
  nextDueAt: '2026-09-02', riskItems: [], summary: '', commercialTerms: null, commercialApproval: null,
  conversionId: null, conversionTermsSha256: null, conversionReceiptId: null, pendingOrderId: null, linkedOrderId: null,
  conversionStartedAt: null, updatedAt: '2026-08-31T12:00:00+09:00', archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
};
const auditRow = {
  action: 'officePilotCreate', result: 'ok', id: 'pilot_alpha', mutationId: 'mutation_12345678', idempotencyKey: 'create_pilot_12345',
  payloadSha256: 'a'.repeat(64), at: '2026-08-31T12:00:00+09:00', actor: 'representative', lifecycleBefore: null,
  backupFileId: 'backup_file_1', backupManifestFileId: 'backup_manifest_1', backupSha256: 'b'.repeat(64), preMutationRevision: 0
};

(async () => {
  assert.equal(run("pilotEndsAtKst('2026-08-31')"), '2026-09-29T23:59:59+09:00');
  assert.equal(run("pilotEndsAtKst('2028-02-01')"), '2028-03-01T23:59:59+09:00');
  assert.equal(run("pilotEndsAtKst('2026-12-20')"), '2027-01-18T23:59:59+09:00');
  assert.throws(() => run("pilotEndsAtKst('2026-02-30')"), /invalid pilot start date/);

  for (const stage of ['new','contacted','meeting','pilot','converted','closed']) {
    const active = stage === 'pilot';
    const row = { ...pilot, stage, pilotStartedAt: active ? pilot.pilotStartedAt : null, pilotEndsAt: active ? pilot.pilotEndsAt : null, retentionStartedAt: stage === 'closed' ? '2026-08-31T12:00:00+09:00' : null };
    assert.equal(run('normalizePilotRecord(' + JSON.stringify(row) + ').stage'), stage, 'accepts relay pilot stage ' + stage);
  }
  const normalized = run('normalizePilotRecord(' + JSON.stringify(pilot) + ')');
  assert.deepEqual(Object.keys(normalized), pilotKeys, 'relay pilot construction order is fixed at all 17 keys');
  assert.equal(Object.isFrozen(normalized), true);
  for (const broken of [
    Object.fromEntries(Object.entries(pilot).slice(0, -1)),
    { ...pilot, unexpected: true },
    { ...pilot, source: 'scraper' },
    { ...pilot, archivedAt: '2026-08-31T12:00:00+09:00', archivedBy: null, archiveReason: null }
  ]) assert.throws(() => run('normalizePilotRecord(' + JSON.stringify(broken) + ')'), /invalid pilot/);

  const view = plain(run('pilotWindowView(' + JSON.stringify(pilot) + ')'));
  assert.deepEqual(Object.keys(view), ['pilotId','stage','pilotStartedAt','pilotEndsAt','extensionApprovedAt']);
  assert.deepEqual(view, { pilotId: 'pilot_alpha', stage: 'pilot', pilotStartedAt: '2026-08-31T00:00:00+09:00', pilotEndsAt: '2026-09-29T23:59:59+09:00', extensionApprovedAt: null });
  const payload = plain(run('pilotEditablePayload(' + JSON.stringify(pilot) + ',{notes:"교체 메모"},11)'));
  assert.deepEqual(Object.keys(payload), editableKeys, 'a one-field change still sends the complete editable replacement in fixed order');
  assert.equal(payload.notes, '교체 메모');
  for (const key of ['createdAt','updatedAt','retentionStartedAt','archivedAt','archivedBy','archiveReason','restoredAt']) assert.equal(Object.hasOwn(payload, key), false);
  const extension = { ...pilot, pilotEndsAt: '2026-10-15T23:59:59+09:00', extensionApprovedAt: '2026-09-20T09:00:00+09:00' };
  assert.equal(run('normalizePilotRecord(' + JSON.stringify(extension) + ').pilotEndsAt'), '2026-10-15T23:59:59+09:00', 'server approval accompanies the replacement deadline');
  assert.throws(() => run('normalizePilotRecord(' + JSON.stringify({ ...pilot, pilotEndsAt: '2026-10-15T23:59:59+09:00' }) + ')'), /invalid pilot editable values/);
  calls.length = 0;
  run('__officeOps.cache.pilots=[' + JSON.stringify(pilot) + ']');
  await run('updateOfficePilot("pilot_alpha",{notes:"ID로 교체"})');
  assert.equal(calls[0].action, 'officePilotUpdate');
  assert.deepEqual(Object.keys(calls[0].payload), editableKeys, 'pilotId lookup submits only the full editable replacement contract');

  const consent = {
    subjectType: 'project', subjectId: 'project_1', purpose: 'preventive-reinspection', intervalMonths: 6, channel: 'phone',
    consentVersion: 'reinspection-v1', consentTextSnapshot: 'consent snapshot', consentTextSha256: '14f8b388a01d5ec9efb2bf24eb5015621de5fe523cb8b68522b58299d94e123a',
    recordedBy: '대표', consentedAt: '2026-08-31T12:00:00+09:00', evidenceType: 'recorded-call-note', evidenceId: 'note_1'
  };
  const normalizedConsent = run('normalizeReinspectionConsent(' + JSON.stringify(consent) + ')');
  assert.deepEqual(plain(normalizedConsent), consent);
  assert.equal(Object.isFrozen(normalizedConsent), true);
  assert.equal(Object.hasOwn(normalizedConsent, 'consentId'), false, 'browser does not create the consent ID');
  for (const badTimestamp of ['2026-08-31T12:00:00','2026-08-31T03:00:00Z','2026-08-31T12:00:00.000+09:00','2026-02-30T12:00:00+09:00','2026-08-31T24:00:00+09:00']) {
    assert.throws(() => run('normalizeReinspectionConsent(' + JSON.stringify({ ...consent, consentedAt: badTimestamp }) + ')'), /invalid reinspection consent/, 'rejects non-canonical consent timestamp ' + badTimestamp);
  }
  assert.throws(() => run('normalizeReinspectionConsent(' + JSON.stringify({ ...consent, consentTextSha256: 'A'.repeat(64) }) + ')'), /invalid reinspection consent/);
  assert.throws(() => run('normalizeReinspectionConsent(' + JSON.stringify({ ...consent, subjectId: '../project/1' }) + ')'), /invalid reinspection consent/);

  calls.length = 0;
  const retryKey = 'logical_create_001';
  await assert.rejects(() => run('persistReinspectionConsent(' + JSON.stringify({ ...consent, consentTextSha256: '0'.repeat(64) }) + ',"logical_create_bad")'), /invalid reinspection consent hash/);
  await assert.rejects(() => run('persistReinspectionConsent(' + JSON.stringify(consent) + ',"too_short")'), /invalid consent idempotency key/);
  ackConsentRow = { ...storedConsent, consentTextSnapshot: 'tampered', consentTextSha256: '0'.repeat(64) };
  await assert.rejects(() => run('persistReinspectionConsent(' + JSON.stringify(consent) + ',"logical_tamper_001")'), /invalid consent integrity/, 'tampered refreshed create row is rejected before return');
  ackConsentRow = storedConsent;
  calls.length = 0;
  const created = await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',' + JSON.stringify(retryKey) + ')');
  await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',' + JSON.stringify(retryKey) + ')');
  await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',"logical_create_002")');
  assert.equal(created.consentId, 'consent_server_1');
  assert.deepEqual(calls.slice(0, 3).map(x => x.payload.idempotencyKey), [retryKey, retryKey, 'logical_create_002']);
  assert.equal(Object.hasOwn(calls[0].payload, 'expectedRevision'), false);
  assert.deepEqual(Object.keys(calls[0].payload), ['idempotencyKey', ...Object.keys(consent)]);
  const withdrawn = await run('withdrawReinspectionConsent({consentId:"consent_server_1",withdrawnBy:"대표",withdrawalReason:"고객 철회"})');
  assert.equal(withdrawn.withdrawnAt, '2026-08-31T12:00:02+09:00', 'withdrawal timestamp comes from the refreshed server record');
  assert.deepEqual(plain(calls[3]), { kind: 'ack', action: 'officeConsentWithdraw', payload: { consentId: 'consent_server_1', withdrawnBy: '대표', withdrawalReason: '고객 철회', expectedRevision: 11 } }, 'withdraw retains the mutation ACK result');
  async function rejectsWithdrawal(result, label) {
    withdrawalResult = result; run("__officeOps.mode='fresh'");
    await assert.rejects(() => run('withdrawReinspectionConsent({consentId:"consent_server_1",withdrawnBy:"대표",withdrawalReason:"고객 철회"})'), /invalid consent withdrawal postcondition/, label);
    assert.equal(run('__officeOps.mode'), 'stale-export-only', label + ' revokes fresh state');
  }
  const activeResult = validWithdrawalResult(); activeResult.store.consents = [storedConsent];
  await rejectsWithdrawal(activeResult, 'active refreshed row');
  const wrongActor = validWithdrawalResult(); wrongActor.store.consents = [{ ...withdrawnConsentRow, withdrawnBy: '다른 담당자', audit: [...storedConsent.audit, { event: 'withdrawn', at: '2026-08-31T12:00:02+09:00', actor: '다른 담당자', reason: '고객 철회' }] }];
  await rejectsWithdrawal(wrongActor, 'wrong withdrawal actor');
  const wrongReason = validWithdrawalResult(); wrongReason.store.consents = [{ ...withdrawnConsentRow, withdrawalReason: '다른 사유', audit: [...storedConsent.audit, { event: 'withdrawn', at: '2026-08-31T12:00:02+09:00', actor: '대표', reason: '다른 사유' }] }];
  await rejectsWithdrawal(wrongReason, 'wrong withdrawal reason');
  const wrongAckId = validWithdrawalResult(); wrongAckId.ack = { ...wrongAckId.ack, id: 'consent_other' };
  await rejectsWithdrawal(wrongAckId, 'wrong acknowledgement ID');
  const wrongAckType = validWithdrawalResult(); wrongAckType.ack = { ...wrongAckType.ack, revision: '12' };
  await rejectsWithdrawal(wrongAckType, 'wrong acknowledgement type');
  const wrongRevision = validWithdrawalResult(); wrongRevision.store.revision = 11;
  await rejectsWithdrawal(wrongRevision, 'reload older than acknowledgement');
  const missingAudit = validWithdrawalResult(); missingAudit.store.audit = [];
  await rejectsWithdrawal(missingAudit, 'missing matching store audit');
  const mismatchedAudit = validWithdrawalResult(); mismatchedAudit.store.audit = [{ ...withdrawAuditRow, at: '2026-08-31T12:00:03+09:00' }];
  await rejectsWithdrawal(mismatchedAudit, 'mismatched store audit time');
  withdrawalResult = validWithdrawalResult(); run("__officeOps.mode='fresh'");
  withdrawnConsentRow = { ...withdrawnConsentRow, nextDueAt: '2099-12-31' };
  withdrawalResult = validWithdrawalResult();
  await assert.rejects(() => run('withdrawReinspectionConsent({consentId:"consent_server_1",withdrawnBy:"대표",withdrawalReason:"고객 철회"})'), /invalid consent withdrawal postcondition/, 'tampered refreshed withdrawal row is rejected before return');
  assert.equal(run('__officeOps.mode'), 'stale-export-only', 'tampered withdrawal reload revokes fresh state');
  withdrawnConsentRow = { ...storedConsent, withdrawnAt: '2026-08-31T12:00:02+09:00', withdrawnBy: '대표', withdrawalReason: '고객 철회',
    audit: [...storedConsent.audit, { event: 'withdrawn', at: '2026-08-31T12:00:02+09:00', actor: '대표', reason: '고객 철회' }] };
  withdrawalResult = validWithdrawalResult();

  assert.equal(run("normalizeKAptUrl('https://www.k-apt.go.kr/bid/list?x=1')"), 'https://www.k-apt.go.kr/bid/list?x=1');
  assert.equal(run("normalizeKAptUrl('https://www.k-apt.go.kr:443/bid')"), 'https://www.k-apt.go.kr/bid');
  assert.equal(run("normalizeKAptUrl('https://k-apt.go.kr/bid?notice=2')"), 'https://www.k-apt.go.kr/bid?notice=2', 'apex input is canonicalized to the approved www host');
  for (const bad of ['http://www.k-apt.go.kr/bid','https://user:pass@www.k-apt.go.kr/bid','https://www.k-apt.go.kr:444/bid','https://www.k-apt.go.kr/bid#frag','https://evil.example/bid']) assert.equal(run('normalizeKAptUrl(' + JSON.stringify(bad) + ')'), null);
  assert.deepEqual(plain(run("officeOpsCanParticipate({serverNowKst:'2026-09-01T11:59:59.999+09:00',deviceNowMs:Date.parse('2026-09-01T11:59:59.999+09:00'),deadlineAtKst:'2026-09-01T12:00:00+09:00'})")), { ok: true, reason: 'eligible' });
  assert.deepEqual(plain(run("officeOpsCanParticipate({serverNowKst:'2026-09-01T12:00:00+09:00',deviceNowMs:Date.parse('2026-09-01T12:00:00+09:00'),deadlineAtKst:'2026-09-01T12:00:00+09:00'})")), { ok: false, reason: 'deadline-passed' });
  assert.deepEqual(plain(run("officeOpsCanParticipate({serverNowKst:'2026-09-01T12:00:01+09:00',deviceNowMs:Date.parse('2026-09-01T12:00:01+09:00'),deadlineAtKst:'2026-09-01T12:00:00+09:00'})")), { ok: false, reason: 'deadline-passed' });
  assert.deepEqual(plain(run("officeOpsCanParticipate({serverNowKst:'2026-09-01T12:00:00+09:00',deviceNowMs:Date.parse('2026-09-01T12:05:01+09:00'),deadlineAtKst:'2026-09-02T12:00:00+09:00'})")), { ok: false, reason: 'clock-skew' });
  assert.deepEqual(plain(run("officeOpsCanParticipate({deviceNowMs:Date.parse('2026-09-01T12:00:00+09:00'),deadlineAtKst:'2026-09-02T12:00:00+09:00'})")), { ok: false, reason: 'parse-failed' }, 'missing trusted server time fails closed');

  const opportunity = {
    opportunityId: 'opp_test', complexName: '테스트 단지', officialUrl: 'https://k-apt.go.kr/bid?notice=2', observedAt: '2026-08-31T10:00:00+09:00',
    region: '대전', category: '배관', deadlineAt: '2026-09-02T12:00:00+09:00', stage: 'review', requirements: [], verifiedBy: '대표', notes: '',
    retentionStartedAt: null, archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
  };
  assert.equal(run('normalizeOfficeOpportunityRecord(' + JSON.stringify(opportunity) + ').officialUrl'), 'https://www.k-apt.go.kr/bid?notice=2');
  assert.deepEqual(plain(run('officeOpsOpportunityCanParticipate(' + JSON.stringify({ ...opportunity, stage: 'participate' }) + ',{serverNowKst:"2026-09-01T12:00:00+09:00",deviceNowMs:Date.parse("2026-09-01T12:00:00+09:00")})')), { ok: false, reason: 'requirements-missing' }, 'participate requires a non-empty server checklist even though watch/review storage does not');
  assert.throws(() => run('normalizeOfficeOpportunityRecord(' + JSON.stringify({ ...opportunity, surprise: true }) + ')'), /invalid opportunity record/);
  const opportunityHtml = run('officeOpsPanelHtml("opportunities",{opportunities:[' + JSON.stringify(opportunity) + ']},"fresh")');
  assert.match(opportunityHtml, /href="https:\/\/www\.k-apt\.go\.kr\/bid\?notice=2"/);
  assert.match(opportunityHtml, /서버 확인 후 검토/);

  const strictStore = { schemaVersion: 1, revision: 1, updatedAt: '2026-08-31T12:00:00+09:00', pilots: [pilot], consents: [storedConsent], inspections: [inspection], opportunities: [opportunity], audit: [auditRow] };
  const strictNormalized = await run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify(strictStore) + ')');
  assert.equal(strictNormalized.schemaVersion, 1);
  assert.equal(strictNormalized.inspections[0].inspectionId, 'inspection_test');
  assert.equal(strictNormalized.audit[0].mutationId, 'mutation_12345678');
  for (const malformed of [
    { ...strictStore, schemaVersion: 99 },
    { ...strictStore, revision: -1 },
    { ...strictStore, updatedAt: '2026-08-31T03:00:00Z' },
    { ...strictStore, pilots: [pilot, pilot] },
    { ...strictStore, inspections: [{ ...inspection, status: 'bogus' }] },
    { ...strictStore, audit: [{ ...auditRow, mutationId: 'short' }] }
  ]) await assert.rejects(() => run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify(malformed) + ')'), /invalid (OfficeOps store|inspection|audit)/);
  await assert.rejects(() => run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify({ ...strictStore, consents: [{ ...storedConsent, consentTextSnapshot: 'tampered', consentTextSha256: '0'.repeat(64) }] }) + ')'), /invalid consent integrity/);
  await assert.rejects(() => run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify({ ...strictStore, consents: [{ ...storedConsent, nextDueAt: '2099-12-31' }] }) + ')'), /invalid consent record/);
  await assert.rejects(() => run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify({ ...strictStore, consents: [{ ...storedConsent, audit: [{ ...storedConsent.audit[0], at: '2026-08-31T03:00:00Z' }] }] }) + ')'), /invalid consent record/, 'consent audit times must be whole-second KST');
  await assert.rejects(() => run('normalizeAndValidateOfficeOpsStore(' + JSON.stringify({ ...strictStore, consents: [{ ...storedConsent, withdrawnAt: 'not-a-kst-time' }] }) + ')'), /invalid consent record/, 'non-null invalid withdrawal timestamp is neither active nor withdrawn');
  const terms = { workKind: 'preventive-inspection', scope: '공용부', exclusions: [], vatMode: 'included', quotedAmount: 10000, validUntil: '2026-09-30', scheduleWindow: '협의' };
  assert.throws(() => run('normalizeOfficeCommercialTerms(' + JSON.stringify({ scope: terms.scope, workKind: terms.workKind, exclusions: terms.exclusions, vatMode: terms.vatMode, quotedAmount: terms.quotedAmount, validUntil: terms.validUntil, scheduleWindow: terms.scheduleWindow }) + ')'), /invalid commercial terms/, 'stored commercial terms require canonical server key order');

  const freshStore = { pilots: [{ ...pilot, complexName: '<img src=x onerror=alert(1)>' }], consents: [], inspections: [], opportunities: [] };
  const html = run('officeOpsPanelHtml("pilots",' + JSON.stringify(freshStore) + ',"fresh")');
  for (const label of ['시험운영 후보','재점검 동의','예방점검','K-apt 기회']) assert.equal(html.split(label).length - 1, 1, 'fresh view contains exactly one ' + label + ' tab');
  assert.doesNotMatch(html, /<img src=x/i, 'OfficeOps row text is escaped');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /문자 보내기|카카오 보내기|이메일|예약 전송|자동 예약|스크래핑|입찰하기/i, 'representative UI exposes no send, booking, scrape, or bid control');
  assert.doesNotMatch(html, /연장 승인|승인 실행/, 'pilot view never implies that the browser can approve an extension');
  const exportOnly = run('officeOpsPanelHtml("pilots",' + JSON.stringify(freshStore) + ',"stale-export-only")');
  assert.match(exportOnly, /마지막 정상 조회본.*JSON/);
  assert.match(exportOnly, /설정/);
  assert.doesNotMatch(exportOnly, /시험운영 후보|재점검 동의|예방점검|K-apt 기회/, 'stale cache remains export-only instead of rendering task data');

  const customerMenu = source.slice(source.indexOf("{id:'customer'"), source.indexOf("{id:'site'"));
  assert.match(customerMenu, /\['officeops','🏢','영업·정기관리'\]/, 'More customer/business area has the OfficeOps entry');
  assert.match(extractFunction('moreActionHandler'), /a==='officeops'.*officeOpsView\(\)/, 'More action reaches the OfficeOps modal');
  const viewSource = extractFunction('officeOpsView');
  assert.ok(viewSource.indexOf('officeOpsRefresh()') < viewSource.indexOf("__officeOps.mode==='fresh'"), 'view requires live refresh before fresh UI is enabled');

  appServer = await startAppServer();
  appPort = appServer.address().port;
  const appUrl = 'http://127.0.0.1:' + appPort + '/index.html';
  try {
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  // 부팅의 IDB 읽기(복원·중계 설정·접수함 설정)가 끝난 뒤에 모의값을 넣는다 — 고정 대기만으로는 늦게 끝난 부팅이 모의값을 덮어쓴다(v251 CI 실패와 같은 종류)
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]));
  const browserStore = { schemaVersion: 1, revision: 1, updatedAt: '2026-08-31T12:00:00+09:00',
    pilots: [{ ...pilot, complexName: '<img src=x onerror=alert(1)>' }], consents: [], inspections: [], opportunities: [], audit: [auditRow] };
  const tokenSentinels = Object.freeze({ office: 'TEST_ONLY_OFFICEOPS_TOKEN_6F14E7A9', commercial: 'TEST_ONLY_COMMERCIAL_TOKEN_8BD2C431' });
  const bootMode = await page.evaluate(async ({ store, sentinels }) => {
    await idbSet('office_ops_url', 'https://office.example/ops');
    await idbSet('office_ops_token', sentinels.office);
    await idbSet('commercial_approval_url', 'https://commercial.example/approval');
    await idbSet('commercial_approval_token', sentinels.commercial);
    await idbSet('office_ops_cache', { store, revision: store.revision, updatedAt: store.updatedAt });
    window.__ooScenario = 'fresh'; window.__ooCalls = [];
    const realFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (!String(url).includes('office.example')) return realFetch(url, options);
      const request = JSON.parse(options.body); window.__ooCalls.push(request);
      if (window.__ooScenario === 'disabled') return { ok: true, json: async () => ({ ok: false, error: 'office-disabled' }) };
      if (window.__ooScenario === 'malformed') return { ok: true, json: async () => ({ ok: true, store: { ...store, schemaVersion: 99 } }) };
      return { ok: true, json: async () => ({ ok: true, store }) };
    };
    return (await officeOpsBoot()).mode;
  }, { store: browserStore, sentinels: tokenSentinels });
  assert.equal(bootMode, 'stale-export-only', 'strict cached boot starts stale and requires live refresh');

  const tokenMutantsDetected = await page.evaluate(sentinels => {
    openGdriveSetup();
    const root = document.getElementById('modalRoot');
    const needles = [sentinels.office, sentinels.commercial, sentinels.office.slice(-8), sentinels.commercial.slice(-8), sentinels.office.slice(-4), sentinels.commercial.slice(-4)];
    const leaks = () => {
      const surfaces = [
        root.innerHTML, root.textContent, document.documentElement.outerHTML,
        [...root.querySelectorAll('input')].map(input => input.value).join('\n'),
        [...root.querySelectorAll('[role="status"],#ooState')].map(node => node.textContent).join('\n')
      ];
      return needles.some(needle => surfaces.some(surface => String(surface).includes(needle)));
    };
    const officeInput = root.querySelector('#ooTok');
    officeInput.value = sentinels.office;
    const inputMutation = leaks();
    officeInput.value = '';
    const summary = root.querySelector('#ooState');
    const originalSummary = summary.textContent;
    summary.textContent = sentinels.commercial;
    const summaryMutation = leaks();
    summary.textContent = originalSummary;
    return inputMutation && summaryMutation;
  }, tokenSentinels);
  assert.equal(tokenMutantsDetected, true, 'credential sentinel checker rejects input-value and settings-summary leak mutants');
  const tokenDom = await page.evaluate(sentinels => {
    openGdriveSetup();
    const root = document.getElementById('modalRoot');
    const officeInput = root.querySelector('#ooTok'), commercialInput = root.querySelector('#caTok');
    const needles = [sentinels.office, sentinels.commercial, sentinels.office.slice(-8), sentinels.commercial.slice(-8), sentinels.office.slice(-4), sentinels.commercial.slice(-4)];
    const surfaces = [
      root.innerHTML, root.textContent, document.documentElement.outerHTML,
      [...root.querySelectorAll('input')].map(input => input.value).join('\n'),
      [...root.querySelectorAll('[role="status"],#ooState')].map(node => node.textContent).join('\n')
    ];
    return {
      valuesBlank: officeInput.value === '' && commercialInput.value === '',
      placeholdersStored: officeInput.placeholder === '저장됨' && commercialInput.placeholder === '저장됨',
      leakFree: !needles.some(needle => surfaces.some(surface => String(surface).includes(needle)))
    };
  }, tokenSentinels);
  assert.deepEqual(tokenDom, { valuesBlank: true, placeholdersStored: true, leakFree: true }, 'stored credential bytes and fragments never render in settings or client HTML');
  await page.locator('#modalRoot .modal-close').click();

  async function openOfficeOpsFromMore() {
    await page.locator('[data-mnav="__more"]').click();
    const customer = page.locator('#moreSheet details').filter({ hasText: '고객·영업' }).first();
    if (!await customer.evaluate(element => element.open)) await customer.locator('summary').click();
    await customer.locator('[data-moreaction="officeops"]').click();
  }

  await openOfficeOpsFromMore();
  await page.locator('#officeOpsTab-pilots').waitFor();
  const freshDom = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#modalRoot [role="tab"]')];
    const panels = [...document.querySelectorAll('#modalRoot [role="tabpanel"]')];
    window.__ooModalNode = document.querySelector('#modalRoot .modal');
    return {
      labels: tabs.map(tab => tab.textContent.trim()), calls: window.__ooCalls.map(call => call.action),
      mappings: tabs.map(tab => ({ id: tab.id, controls: tab.getAttribute('aria-controls'), selected: tab.getAttribute('aria-selected'), tabindex: tab.getAttribute('tabindex') })),
      panels: panels.map(panel => ({ id: panel.id, labelledby: panel.getAttribute('aria-labelledby'), hidden: panel.hidden })),
      injectedImages: document.querySelectorAll('#officeOpsPanel-pilots img').length,
      pilotText: document.getElementById('officeOpsPanel-pilots').textContent
    };
  });
  assert.deepEqual(freshDom.labels, ['시험운영 후보','재점검 동의','예방점검','K-apt 기회']);
  assert.deepEqual(freshDom.calls, ['officeOpsList'], 'More entry performs exactly one live refresh');
  assert.equal(freshDom.injectedImages, 0, 'actual production escaping creates no injected element');
  assert.match(freshDom.pilotText, /<img src=x onerror=alert\(1\)>/);
  assert.equal(freshDom.mappings.length, 4); assert.equal(freshDom.panels.length, 4);
  freshDom.mappings.forEach((tab, index) => {
    assert.equal(tab.controls, freshDom.panels[index].id);
    assert.equal(freshDom.panels[index].labelledby, tab.id);
    assert.equal(tab.tabindex, index === 0 ? '0' : '-1');
  });
  await page.locator('#officeOpsTab-pilots').focus();
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-opportunities');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-inspections');
  await page.keyboard.press('Home');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'officeOpsTab-pilots');
  await page.keyboard.press('ArrowRight');
  const tabSwitch = await page.evaluate(() => ({ active: document.activeElement.id, selected: document.querySelector('#officeOpsBody [role="tab"][aria-selected="true"]').id,
    shown: [...document.querySelectorAll('#officeOpsBody [role="tabpanel"]')].filter(panel => !panel.hidden).map(panel => panel.id), sameModal: window.__ooModalNode === document.querySelector('#modalRoot .modal'), calls: window.__ooCalls.length }));
  assert.deepEqual(tabSwitch, { active: 'officeOpsTab-consents', selected: 'officeOpsTab-consents', shown: ['officeOpsPanel-consents'], sameModal: true, calls: 1 }, 'tab switch retains focus and reuses the modal without another refresh');

  await page.locator('#modalRoot .modal-close').click();
  await page.evaluate(() => { window.__ooScenario = 'malformed'; });
  await openOfficeOpsFromMore();
  await page.locator('#officeOpsExport').waitFor();
  assert.equal(await page.evaluate(() => __officeOps.mode), 'stale-export-only', 'malformed live response revokes fresh cache');
  assert.equal(await page.locator('#modalRoot [role="tab"]').count(), 0, 'malformed response exposes only export guidance');

  await page.locator('#modalRoot .modal-close').click();
  await page.evaluate(() => { window.__ooScenario = 'disabled'; });
  await openOfficeOpsFromMore();
  await page.locator('#officeOpsExport').waitFor();
  assert.equal(await page.evaluate(() => __officeOps.mode), 'export-only', 'disabled response is visibly export-only');
  assert.match(await page.locator('#modalRoot .mbody').textContent(), /로컬 JSON|조회 전용/);
  assert.equal(pageErrors.length, 0, 'actual UI has no pageerror: ' + pageErrors.join(' | '));
  } finally {
    let cleanupError = null;
    if (browser) { try { await browser.close(); } catch (error) { cleanupError = error; } browser = null; }
    if (appServer) { try { await new Promise((resolve, reject) => appServer.close(error => error ? reject(error) : resolve())); } catch (error) { cleanupError = cleanupError || error; } appServer = null; }
    if (cleanupError) throw cleanupError;
  }
  assert.equal(await portAlive(appPort), false, 'owned ephemeral HTTP server is no longer listening after browser acceptance');
  console.log('PASS  OfficeOps four-tab UI, KST pilots, consent, and strict K-apt contracts');
})().catch(error => {
  console.error('FAIL', error && error.stack || error); process.exitCode = 1;
});

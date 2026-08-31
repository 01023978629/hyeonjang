'use strict';
/* Task 2 OfficeOps representative UI and strict browser-side contracts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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
const sandbox = {
  Intl, Date, URL, Object, String, Number, Array, RegExp, Error, Promise, TextEncoder, Uint8Array, crypto: webcrypto,
  escapeHtml: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  escapeAttr: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  officeOpsMutationWithAck: async (action, payload) => {
    calls.push({ kind: 'ack', action, payload });
    return { ack: { id: 'consent_server_1', revision: 12, updatedAt: '2026-08-31T12:00:01+09:00' }, store: { consents: [storedConsent] } };
  },
  officeOpsMutation: async (action, payload) => {
    calls.push({ kind: 'store', action, payload });
    return { consents: [{ ...storedConsent, withdrawnAt: '2026-08-31T12:00:02+09:00', withdrawnBy: payload.withdrawnBy, withdrawalReason: payload.withdrawalReason,
      audit: [...storedConsent.audit, { event: 'withdrawn', at: '2026-08-31T12:00:02+09:00', actor: payload.withdrawnBy, reason: payload.withdrawalReason }] }] };
  }
};
vm.createContext(sandbox);
vm.runInContext("const __officeOps={mode:'fresh',revision:11,cache:{pilots:[]}};", sandbox);
for (const name of [
  'isRealIsoDate', 'formatKstIso', 'pilotEndsAtKst', 'parseStrictKstDateTime',
  'normalizePilotEditable', 'normalizePilotRecord', 'pilotWindowView', 'pilotEditablePayload',
  'updateOfficePilot', 'normalizeReinspectionConsent', 'sha256Hex', 'normalizeOfficeConsentRecord', 'normalizeOfficeOpportunityRecord', 'persistReinspectionConsent',
  'withdrawReinspectionConsent', 'normalizeKAptUrl', 'officeOpsCanParticipate', 'officeOpsPanelHtml'
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
  const created = await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',' + JSON.stringify(retryKey) + ')');
  await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',' + JSON.stringify(retryKey) + ')');
  await run('persistReinspectionConsent(' + JSON.stringify(consent) + ',"logical_create_002")');
  assert.equal(created.consentId, 'consent_server_1');
  assert.deepEqual(calls.slice(0, 3).map(x => x.payload.idempotencyKey), [retryKey, retryKey, 'logical_create_002']);
  assert.equal(Object.hasOwn(calls[0].payload, 'expectedRevision'), false);
  assert.deepEqual(Object.keys(calls[0].payload), ['idempotencyKey', ...Object.keys(consent)]);
  const withdrawn = await run('withdrawReinspectionConsent({consentId:"consent_server_1",withdrawnBy:"대표",withdrawalReason:"고객 철회"})');
  assert.equal(withdrawn.withdrawnAt, '2026-08-31T12:00:02+09:00', 'withdrawal timestamp comes from the refreshed server record');
  assert.deepEqual(plain(calls[3]), { kind: 'store', action: 'officeConsentWithdraw', payload: { consentId: 'consent_server_1', withdrawnBy: '대표', withdrawalReason: '고객 철회', expectedRevision: 11 } });

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
    region: '대전', category: '배관', deadlineAt: '2026-09-02T12:00:00+09:00', stage: 'review', requirements: ['면허 확인'], verifiedBy: '대표', notes: '',
    retentionStartedAt: null, archivedAt: null, archivedBy: null, archiveReason: null, restoredAt: null
  };
  assert.equal(run('normalizeOfficeOpportunityRecord(' + JSON.stringify(opportunity) + ').officialUrl'), 'https://www.k-apt.go.kr/bid?notice=2');
  assert.throws(() => run('normalizeOfficeOpportunityRecord(' + JSON.stringify({ ...opportunity, surprise: true }) + ')'), /invalid opportunity record/);
  const opportunityHtml = run('officeOpsPanelHtml("opportunities",{opportunities:[' + JSON.stringify(opportunity) + ']},"fresh")');
  assert.match(opportunityHtml, /href="https:\/\/www\.k-apt\.go\.kr\/bid\?notice=2"/);
  assert.match(opportunityHtml, /서버 확인 후 검토/);

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
  console.log('PASS  OfficeOps four-tab UI, KST pilots, consent, and strict K-apt contracts');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

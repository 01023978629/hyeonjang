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
    const persisted = JSON.stringify({ state, local: Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]) });
    return { visible, before, rotated, after, persistedPin: /\b\d{6}\b/.test(persisted) };
  });
  assert.equal(officeAccess.visible, true, 'office list exposes the access administration control');
  assert.equal(officeAccess.before.ok, true, 'admin upsert accepts the stable aptOffices id');
  assert.equal(officeAccess.rotated.ok, true, 'PIN rotation returns a one-time result');
  assert.match(officeAccess.rotated.pin, /^\d{6}$/, 'PIN rotation result is a six digit display value');
  assert.equal(officeAccess.after.office.sessionVersion, officeAccess.before.office.sessionVersion + 1, 'PIN rotation increments server sessionVersion');
  assert.equal(officeAccess.persistedPin, false, 'one-time PIN must not enter serialized state or local storage');

  const disablePersist = await page.evaluate(async () => {
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
    needs: { ok: true, requestId: 'req-1', status: 'needs_info', needsInfoReason: '사진 보완', updatedAt: resolvedReason.needs.updatedAt },
    hold: { ok: true, requestId: 'req-1', status: 'on_hold', needsInfoReason: '사진 보완', updatedAt: resolvedReason.hold.updatedAt },
    accepted: { ok: true, requestId: 'req-1', hyeonjangOrderId: 'order-reason-resolved', status: 'accepted' }
  }, 'needs_info -> on_hold -> accepted succeeds');
  const resolvedMock = await (await fetch(MOCK + '/__state')).json();
  assert.equal(resolvedMock.officeRequests.find(row => row.requestId === 'req-1').needsInfoReason, null, 'acceptance clears resolved needs-info reason in mock fidelity');

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

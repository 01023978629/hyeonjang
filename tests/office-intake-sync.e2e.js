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
    officeIntakeQueue('officeSetStatus', { requestId: 'req-1', status: 'needs_info' });
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
  assert.deepEqual(pageErrors, [], 'page errors');
  await browser.close();
  console.log('PASS  office intake relay sync and durable outbox');
})().catch(err => { console.error('FAIL', err && err.stack || err); process.exit(1); });

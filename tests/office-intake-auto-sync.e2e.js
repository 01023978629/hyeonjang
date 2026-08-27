'use strict';

const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
let browser;

async function openPage(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  if (options.failAllIdb) {
    await page.addInitScript(message => {
      const prototype = Object.getPrototypeOf(indexedDB);
      prototype.open = function () { throw new Error(message); };
    }, options.failAllIdb);
  }
  await page.route('https://**/*', route => route.abort());
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  return page;
}

async function invokeAutoStart(page, restoreResult, relayResult) {
  return page.evaluate(async ({ restoreResult, relayResult }) => {
    const calls = [];
    window.__hjRestoreDone = Promise.resolve(restoreResult);
    window.__hjRelayConfigDone = Promise.resolve(relayResult);
    window.cloudOfficeInbox = async () => {
      calls.push('inbox');
      return { ok: true, requests: [], cursor: '', operationalErrors: [] };
    };
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeAutoStarted = false;
    __officeIntakeSyncPromise = null;

    officeIntakeAutoStart();
    await new Promise(resolve => setTimeout(resolve, 0));

    return { calls: calls.length, restoreResult, relayResult };
  }, { restoreResult, relayResult });
}

(async () => {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE }
      : {}
  );

  const restoreCompletionPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  const restoreStartedAt = '2026-08-27T00:00:00.000Z';
  const restoreCompletedAt = '2026-08-27T00:04:00.000Z';
  await restoreCompletionPage.addInitScript(({ startedAt, completedAt }) => {
    localStorage.setItem('hj_onboard_done', '1');
    const NativeDate = Date;
    let controlledNow = NativeDate.parse(startedAt);
    class ControlledDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [controlledNow])); }
      static now() { return controlledNow; }
    }
    window.Date = ControlledDate;
    const factoryPrototype = Object.getPrototypeOf(indexedDB);
    factoryPrototype.open = function () {
      const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      const database = {
        createObjectStore() {},
        close() {},
        transaction() {
          const transaction = { error: null, oncomplete: null, onerror: null };
          transaction.objectStore = () => ({
            get(key) {
              const getRequest = { result: null, onsuccess: null, onerror: null };
              const finish = () => queueMicrotask(() => { if (getRequest.onsuccess) getRequest.onsuccess(); });
              if (key === 'appState') {
                window.__testCompleteActualRestore = () => {
                  controlledNow = NativeDate.parse(completedAt);
                  finish();
                };
              } else {
                finish();
              }
              return getRequest;
            },
            put() { queueMicrotask(() => { if (transaction.oncomplete) transaction.oncomplete(); }); },
            delete() { queueMicrotask(() => { if (transaction.oncomplete) transaction.oncomplete(); }); }
          });
          return transaction;
        }
      };
      queueMicrotask(() => {
        request.result = database;
        if (request.onupgradeneeded) request.onupgradeneeded();
        queueMicrotask(() => { if (request.onsuccess) request.onsuccess(); });
      });
      return request;
    };
  }, { startedAt: restoreStartedAt, completedAt: restoreCompletedAt });
  await restoreCompletionPage.route('https://**/*', route => route.abort());
  await restoreCompletionPage.goto(APP, { waitUntil: 'domcontentloaded' });
  await restoreCompletionPage.waitForFunction(() => typeof window.__testCompleteActualRestore === 'function');
  const restorePendingBeforeCompletion = await restoreCompletionPage.evaluate(async () => {
    let settled = false;
    window.__hjRestoreDone.then(() => { settled = true; });
    await Promise.resolve();
    return settled;
  });
  const actualRestoreCompletion = await restoreCompletionPage.evaluate(async () => {
    window.__testCompleteActualRestore();
    return window.__hjRestoreDone;
  });
  assert.equal(restorePendingBeforeCompletion, false, 'the actual restore promise remains pending while appState is delayed');
  assert.equal(actualRestoreCompletion.ok, true);
  assert.equal(actualRestoreCompletion.restoredAt, restoreCompletedAt, 'the actual restore result records completion time');
  assert.notEqual(actualRestoreCompletion.restoredAt, restoreStartedAt, 'restore completion time is not the pre-IDB start time');
  await restoreCompletionPage.close();

  const idbFailurePage = await openPage({
    failAllIdb: 'raw failure https://relay.test/exec token=test-token'
  });
  const actualFailures = await idbFailurePage.evaluate(async () => ({
    restore: await window.__hjRestoreDone,
    relay: await window.__hjRelayConfigDone
  }));
  assert.deepEqual(Object.keys(actualFailures.restore).sort(), ['errorCode', 'ok', 'restoredAt']);
  assert.deepEqual(Object.keys(actualFailures.relay).sort(), ['completedAt', 'errorCode', 'ok', 'ready']);
  assert.equal(actualFailures.restore.ok, false);
  assert.equal(actualFailures.restore.errorCode, 'restore-failed');
  assert.equal(actualFailures.relay.ok, false);
  assert.equal(actualFailures.relay.ready, false);
  assert.equal(actualFailures.relay.errorCode, 'relay-config-failed');
  assert.equal(JSON.stringify(actualFailures).includes('raw failure https://relay.test/exec token=test-token'), false);
  await idbFailurePage.close();

  const continuationPage = await openPage();
  const continuation = await continuationPage.evaluate(async () => {
    let idbGetCalls = 0;
    let badgeCalls = 0;
    window.idbGet = async () => {
      idbGetCalls++;
      throw new Error('relay config read failed');
    };
    window.relayUpdateQueueBadge = async () => { badgeCalls++; };
    await relayBoot();
    return { idbGetCalls, badgeCalls };
  });
  assert.deepEqual(continuation, { idbGetCalls: 1, badgeCalls: 1 });
  await continuationPage.close();

  const page = await openPage();
  const gate = await page.evaluate(async () => {
    const calls = [];
    window.__hjRestoreDone = new Promise(resolve => {
      window.__testResolveRestore = resolve;
    });
    window.__hjRelayConfigDone = new Promise(resolve => {
      window.__testResolveRelay = resolve;
    });
    window.cloudOfficeInbox = async () => {
      calls.push('inbox');
      return { ok: true, requests: [], cursor: '', operationalErrors: [] };
    };
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeAutoStarted = false;
    __officeIntakeAutoLastStartedAt = 0;
    __officeIntakeRestoreCompletedAt = '';
    __officeIntakeSyncPromise = null;

    officeIntakeAutoStart();
    officeIntakeAutoStart();
    await Promise.resolve();
    const before = calls.length;

    window.__testResolveRestore({
      ok: true,
      restoredAt: '2026-08-27T00:00:00.000Z',
      errorCode: ''
    });
    await Promise.resolve();
    const afterRestoreOnly = calls.length;

    window.__testResolveRelay({
      ok: true,
      ready: true,
      completedAt: '2026-08-27T00:00:01.000Z',
      errorCode: ''
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    return {
      before,
      afterRestoreOnly,
      afterBoth: calls.length,
      restoredAt: __officeIntakeRestoreCompletedAt
    };
  });
  assert.deepEqual(gate, {
    before: 0,
    afterRestoreOnly: 0,
    afterBoth: 1,
    restoredAt: '2026-08-27T00:00:00.000Z'
  });
  await page.close();

  const eventTriggerPage = await openPage();
  const eventTrigger = await eventTriggerPage.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone]);
    await new Promise(resolve => setTimeout(resolve, 0));
    let calls = 0;
    let queueFlushes = 0;
    window.cloudOfficeInbox = async () => {
      calls += 1;
      return { ok: true, requests: [], cursor: '', operationalErrors: [] };
    };
    window.cloudFlushQueue = () => { queueFlushes += 1; };
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeAutoLastStartedAt = 0;
    __officeIntakeSyncPromise = null;

    window.dispatchEvent(new Event('online'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const afterOnline = calls;

    __officeIntakeAutoLastStartedAt = 0;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 0));

    return { calls, afterOnline, queueFlushes };
  });
  assert.deepEqual(eventTrigger, {
    calls: 2,
    afterOnline: 1,
    queueFlushes: 1
  }, 'online keeps its queue flush and both online and visible foreground events request the inbox');
  await eventTriggerPage.close();

  const blockedCases = [
    {
      name: 'restore failure',
      restoreResult: { ok: false, restoredAt: '2026-08-27T00:00:00.000Z', errorCode: 'restore-failed' },
      relayResult: { ok: true, ready: true, completedAt: '2026-08-27T00:00:01.000Z', errorCode: '' }
    },
    {
      name: 'relay config failure',
      restoreResult: { ok: true, restoredAt: '2026-08-27T00:00:00.000Z', errorCode: '' },
      relayResult: { ok: false, ready: false, completedAt: '2026-08-27T00:00:01.000Z', errorCode: 'relay-config-failed' }
    },
    {
      name: 'relay not ready',
      restoreResult: { ok: true, restoredAt: '2026-08-27T00:00:00.000Z', errorCode: '' },
      relayResult: { ok: true, ready: false, completedAt: '2026-08-27T00:00:01.000Z', errorCode: '' }
    }
  ];
  for (const testCase of blockedCases) {
    const blockedPage = await openPage();
    const result = await invokeAutoStart(blockedPage, testCase.restoreResult, testCase.relayResult);
    assert.equal(result.calls, 0, testCase.name + ' must not fetch the office inbox');
    await blockedPage.close();
  }

  const staleBoundaryPage = await openPage();
  const staleBoundary = await staleBoundaryPage.evaluate(() => {
    __officeIntakeRestoreCompletedAt = '2026-08-27T00:00:00.000Z';
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    const d = officeIntakeData();
    d.lastSyncAt = '';
    const fresh = officeIntakeStaleState(Date.parse('2026-08-27T00:14:59.999Z'));
    const edge = officeIntakeStaleState(Date.parse('2026-08-27T00:15:00.000Z'));
    d.lastSyncAt = 'not-a-date';
    const invalid = officeIntakeStaleState(Date.parse('2026-08-27T00:15:00.000Z'));
    d.lastSyncAt = '2026-08-27T00:20:00.000Z';
    const future = officeIntakeStaleState(Date.parse('2026-08-27T00:15:00.000Z'));
    return { fresh, edge, invalid, future };
  });
  assert.equal(staleBoundary.fresh.mode, 'fresh');
  assert.equal(staleBoundary.edge.mode, 'stale');
  assert.equal(staleBoundary.invalid.mode, 'stale');
  assert.equal(staleBoundary.future.mode, 'stale');
  await staleBoundaryPage.close();

  const coordinatorPage = await openPage();
  const coordinator = await coordinatorPage.evaluate(async () => {
    const network = [];
    const effects = [];
    const releases = [];
    window.cloudOfficeInbox = () => {
      network.push('inbox');
      return new Promise(resolve => { releases.push(resolve); });
    };
    window.persistLocal = () => effects.push('persist');
    window.officeIntakeMarkDirty = () => effects.push('dirty');
    window.cloudAutoSave = () => effects.push('cloud');
    window.officeIntakeFlush = async () => effects.push('flush');
    window.relaySaveNow = async () => effects.push('relay-save');
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeAutoLastStartedAt = 0;
    state.officeIntake = {
      inbox: [], cursor: '', outbox: [{ action: 'existing' }],
      lastSyncAt: '', lastError: ''
    };

    const auto = officeIntakeAutoTrigger('online');
    const manual = officeIntakeSync({ source: 'manual' });
    const recovery = officeIntakeSync({ source: 'recovery' });
    releases.forEach(release => release({
      ok: true,
      requests: [{
        requestId: 'new-1',
        updatedAt: '2026-08-27T00:00:00.000Z'
      }],
      cursor: '2026-08-27T00:00:00.000Z',
      operationalErrors: []
    }));
    const results = await Promise.all([auto, manual, recovery]);
    return {
      network: network.length,
      same: auto === manual && manual === recovery,
      effects,
      results,
      outbox: state.officeIntake.outbox.slice(),
      inboxCount: officeIntakeData().inbox.length
    };
  });
  assert.equal(coordinator.network, 1);
  assert.equal(coordinator.same, true);
  assert.deepEqual(coordinator.results, [true, true, true]);
  assert.equal(coordinator.inboxCount, 1);
  assert.deepEqual(coordinator.outbox, [{ action: 'existing' }]);
  assert.equal(coordinator.effects.includes('dirty'), false, 'auto-only sync must not call officeIntakeMarkDirty');
  assert.equal(coordinator.effects.includes('cloud'), false, 'auto-only sync must not call cloudAutoSave');
  assert.equal(coordinator.effects.includes('flush'), false);
  assert.equal(coordinator.effects.includes('relay-save'), false);
  assert.deepEqual(coordinator.effects, ['persist']);
  await coordinatorPage.close();

  const staleTimerPage = await openPage();
  const staleTimer = await staleTimerPage.evaluate(() => {
    const base = Date.parse('2026-08-27T00:00:00.000Z');
    const timers = [];
    let network = 0;
    const actualNow = Date.now;
    const actualSetTimeout = window.setTimeout;
    const actualClearTimeout = window.clearTimeout;
    Date.now = () => base;
    window.setTimeout = (callback, wait) => {
      timers.push({ callback, wait });
      return timers.length;
    };
    window.clearTimeout = () => {};
    window.cloudOfficeInbox = () => { network += 1; return Promise.resolve({ ok: true }); };
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeRestoreCompletedAt = '2026-08-27T00:00:00.000Z';
    officeIntakeData().lastSyncAt = '';
    const status = document.createElement('div');
    status.dataset.officeIntakeStatus = '';
    const summary = document.createElement('div');
    summary.dataset.officeIntakeSummary = '';
    summary.textContent = 'summary-before';
    const badgeButton = document.createElement('button');
    badgeButton.setAttribute('aria-label', 'badge-before');
    const badge = document.createElement('span');
    badge.dataset.officeIntakeBadge = '';
    badge.textContent = '신규 이전';
    badgeButton.appendChild(badge);
    document.body.appendChild(status);
    document.body.appendChild(summary);
    document.body.appendChild(badgeButton);
    officeIntakeScheduleStaleStatus();
    Date.now = () => base + 15 * 60 * 1000;
    timers[0].callback();
    const statusText = status.textContent;
    const summaryText = summary.textContent;
    const badgeText = badge.textContent;
    const badgeLabel = badgeButton.getAttribute('aria-label');
    status.remove();
    summary.remove();
    badgeButton.remove();
    Date.now = actualNow;
    window.setTimeout = actualSetTimeout;
    window.clearTimeout = actualClearTimeout;
    return { wait: timers[0] && timers[0].wait, network, statusText, summaryText, badgeText, badgeLabel };
  });
  assert.deepEqual(staleTimer, {
    wait: 15 * 60 * 1000,
    network: 0,
    statusText: '15분 이상 새 접수를 확인하지 못했습니다',
    summaryText: 'summary-before',
    badgeText: '신규 이전',
    badgeLabel: 'badge-before'
  }, 'stale timer changes only visible status at the exact boundary');
  await staleTimerPage.close();

  const staleColorPage = await openPage();
  const staleColor = await staleColorPage.evaluate(() => {
    const base = Date.parse('2026-08-27T00:00:00.000Z');
    const actualNow = Date.now;
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeRestoreCompletedAt = new Date(base).toISOString();
    state.officeIntake = { inbox: [], outbox: [], cursor: '', lastSyncAt: new Date(base).toISOString(), lastError: '' };
    state.aptOffices = [];
    state.aptOrders = [];
    const warningProbe = document.createElement('span');
    warningProbe.style.color = 'var(--warn)';
    document.body.appendChild(warningProbe);
    const warningColor = getComputedStyle(warningProbe).color;
    warningProbe.remove();
    const inspect = openSurface => {
      Date.now = () => base;
      openSurface();
      const modal = document.querySelector('#modalRoot .modal');
      officeIntakeRefreshVisibleStatus();
      const freshElement = document.querySelector('[data-office-intake-status]');
      const fresh = { mode: freshElement.dataset.officeIntakeMode || '', color: getComputedStyle(freshElement).color };
      Date.now = () => base + 15 * 60 * 1000;
      officeIntakeRefreshVisibleStatus();
      const staleElement = document.querySelector('[data-office-intake-status]');
      return {
        sameModal: modal === document.querySelector('#modalRoot .modal'),
        fresh,
        stale: { mode: staleElement.dataset.officeIntakeMode || '', color: getComputedStyle(staleElement).color }
      };
    };
    const inbox = inspect(officeIntakeOpen);
    const order = inspect(aptOrderManage);
    Date.now = actualNow;
    return { warningColor, inbox, order };
  });
  assert.notEqual(staleColor.inbox.fresh.color, staleColor.warningColor, 'fresh inbox status remains non-warning');
  assert.notEqual(staleColor.order.fresh.color, staleColor.warningColor, 'fresh apartment-order status remains non-warning');
  assert.equal(staleColor.inbox.stale.color, staleColor.warningColor, 'stale inbox status uses the computed warning color');
  assert.equal(staleColor.order.stale.color, staleColor.warningColor, 'stale apartment-order status uses the computed warning color');
  assert.equal(staleColor.inbox.fresh.mode, 'fresh');
  assert.equal(staleColor.order.fresh.mode, 'fresh');
  assert.equal(staleColor.inbox.stale.mode, 'stale');
  assert.equal(staleColor.order.stale.mode, 'stale');
  assert.equal(staleColor.inbox.sameModal, true, 'inbox status mode refresh keeps the open modal');
  assert.equal(staleColor.order.sameModal, true, 'apartment-order status mode refresh keeps the open modal');
  await staleColorPage.close();

  const staleUiPage = await openPage();
  const staleUi = await staleUiPage.evaluate(() => {
    const base = Date.parse('2026-08-27T00:00:00.000Z');
    const actualNow = Date.now;
    let toasts = 0;
    Date.now = () => base + 15 * 60 * 1000;
    window.toast = () => { toasts += 1; };
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeRestoreCompletedAt = new Date(base).toISOString();
    state.officeIntake = {
      inbox: [{ requestId: 'visible-1', receiptNo: 'MM-STALE-1', status: 'pending_review', description: 'never in status HTML', updatedAt: new Date(base).toISOString() }],
      outbox: [], cursor: '', lastSyncAt: new Date(base).toISOString(), lastError: ''
    };
    state.aptOffices = [];
    state.aptOrders = [];

    closeModal();
    officeIntakeRefreshVisibleUi();
    const closedModalCount = document.querySelectorAll('#modalRoot .modal').length;

    officeIntakeOpen();
    const inboxModal = document.querySelector('#modalRoot .modal');
    officeIntakeRefreshVisibleUi();
    const inboxStatus = document.querySelector('[data-office-intake-status]').textContent;
    const inboxStatusHtml = document.querySelector('[data-office-intake-status]').innerHTML;
    const inboxSameModal = inboxModal === document.querySelector('#modalRoot .modal');
    const inboxStatusRect = document.querySelector('[data-office-intake-status]').getBoundingClientRect();
    const inboxStatusVisible = inboxStatusRect.width > 0 && inboxStatusRect.height > 0 && getComputedStyle(document.querySelector('[data-office-intake-status]').parentElement).visibility !== 'hidden';
    const inboxOverflow = document.documentElement.scrollWidth <= innerWidth;
    const inboxButtons = [...document.querySelectorAll('[data-oi-accept], [data-oi-needs], [data-oi-hold]')].map(button => button.getBoundingClientRect().height);

    aptOrderManage();
    const orderModal = document.querySelector('#modalRoot .modal');
    officeIntakeRefreshVisibleUi();
    const orderStatus = document.querySelector('[data-office-intake-status]').textContent;
    const orderSameModal = orderModal === document.querySelector('#modalRoot .modal');
    const orderStatusRect = document.querySelector('[data-office-intake-status]').getBoundingClientRect();
    const orderStatusVisible = orderStatusRect.width > 0 && orderStatusRect.height > 0 && getComputedStyle(document.querySelector('[data-office-intake-status]').parentElement).visibility !== 'hidden';
    const orderOverflow = document.documentElement.scrollWidth <= innerWidth;
    const orderButtons = [...document.querySelectorAll('#apoOfficeInbox, #apoOfficeRetry')].map(button => button.getBoundingClientRect().height);

    openMoreSheetV2();
    officeIntakeRefreshVisibleUi();
    const badge = document.querySelector('[data-office-intake-badge]').textContent;
    const badgeLabel = document.querySelector('[data-office-intake-badge]').closest('button').getAttribute('aria-label');
    Date.now = actualNow;
    return { closedModalCount, inboxStatus, inboxStatusHtml, inboxSameModal, inboxStatusVisible, inboxOverflow, orderStatus, orderSameModal, orderStatusVisible, orderOverflow, badge, badgeLabel, minButton: Math.min(...inboxButtons, ...orderButtons), toasts };
  });
  assert.equal(staleUi.closedModalCount, 0, 'a closed inbox stays closed during a display-only refresh');
  assert.match(staleUi.inboxStatus, /15분 이상 새 접수를 확인하지 못했습니다/, 'open inbox shows the fixed stale status');
  assert.equal(staleUi.inboxStatusHtml.includes('never in status HTML'), false, 'status HTML excludes intake content');
  assert.equal(staleUi.inboxSameModal, true, 'refresh keeps the already-open inbox modal instance');
  assert.match(staleUi.orderStatus, /15분 이상 새 접수를 확인하지 못했습니다/, 'open apartment order shows the fixed stale status');
  assert.equal(staleUi.orderSameModal, true, 'refresh keeps the already-open apartment-order modal instance');
  assert.equal(staleUi.badge, '신규 1', 'open More badge refreshes the pending count');
  assert.match(String(staleUi.badgeLabel), /신규 1/, 'open More badge accessibility label refreshes: ' + staleUi.badgeLabel);
  assert.equal(staleUi.inboxStatusVisible, true, 'stale status is visibly rendered in the 390px inbox');
  assert.equal(staleUi.inboxOverflow, true, '390px inbox has no horizontal overflow');
  assert.equal(staleUi.orderStatusVisible, true, 'stale status is visibly rendered in the 390px apartment-order view');
  assert.equal(staleUi.orderOverflow, true, '390px apartment-order view has no horizontal overflow');
  assert.ok(staleUi.minButton >= 44, 'office intake mobile buttons meet the 44px touch target');
  assert.equal(staleUi.toasts, 0, 'display-only refresh emits no toast');
  await staleUiPage.close();

  const openInboxRefreshPage = await openPage();
  const openInboxRefresh = await openInboxRefreshPage.evaluate(() => {
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeRestoreCompletedAt = new Date().toISOString();
    state.officeIntake = {
      inbox: [{ requestId: 'open-old', receiptNo: 'MM-OPEN-OLD', status: 'pending_review', description: 'old visible row', updatedAt: new Date().toISOString() }],
      outbox: [], cursor: '', lastSyncAt: new Date().toISOString(), lastError: ''
    };
    officeIntakeOpen();
    const inboxModal = document.querySelector('#modalRoot .modal');
    officeIntakeData().inbox = [];
    officeIntakeRefreshVisibleUi();
    const inboxText = document.querySelector('#modalRoot .mbody').textContent;
    const inboxSameModal = inboxModal === document.querySelector('#modalRoot .modal');
    aptOrderManage();
    const orderModal = document.querySelector('#modalRoot .modal');
    officeIntakeData().inbox = [{ requestId: 'open-new', receiptNo: 'MM-OPEN-NEW', status: 'pending_review', updatedAt: new Date().toISOString() }];
    officeIntakeRefreshVisibleUi();
    const intakeButton = document.querySelector('#apoOfficeInbox');
    return {
      inboxSameModal,
      inboxText,
      orderSameModal: orderModal === document.querySelector('#modalRoot .modal'),
      orderButtonText: intakeButton.textContent,
      orderButtonLabel: intakeButton.getAttribute('aria-label')
    };
  });
  assert.equal(openInboxRefresh.inboxSameModal, true, 'full refresh keeps the open inbox modal instance');
  assert.match(openInboxRefresh.inboxText, /검토할 신규 접수가 없습니다/, 'full refresh replaces stale inbox rows with the empty state');
  assert.equal(openInboxRefresh.inboxText.includes('MM-OPEN-OLD'), false, 'full refresh removes stale inbox rows');
  assert.equal(openInboxRefresh.orderSameModal, true, 'full refresh keeps the open apartment-order modal instance');
  assert.equal(openInboxRefresh.orderButtonText, '📥 신규 1', 'full refresh updates the open apartment-order intake count');
  assert.match(String(openInboxRefresh.orderButtonLabel), /신규 접수 1건/, 'full refresh updates the open apartment-order intake aria label');
  await openInboxRefreshPage.close();

  const staleSyncPage = await openPage();
  const staleSync = await staleSyncPage.evaluate(async () => {
    const timers = [];
    __relay.url = '';
    __relay.token = '';
    const setup = officeIntakeStatusHtml(Date.parse('2026-08-27T00:15:00.000Z'));
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeRestoreCompletedAt = '2026-08-27T00:00:00.000Z';
    state.officeIntake = { inbox: [], outbox: [], cursor: '', lastSyncAt: '2026-08-27T00:00:00.000Z', lastError: 'old' };
    window.persistLocal = () => {};
    officeIntakeOpen();
    const actualSetTimeout = window.setTimeout;
    const actualClearTimeout = window.clearTimeout;
    window.setTimeout = (callback, wait) => { timers.push({ callback, wait }); return timers.length; };
    window.clearTimeout = () => {};
    window.cloudOfficeInbox = async () => ({ ok: true, requests: [], cursor: '', operationalErrors: [] });
    const success = await officeIntakeSync({ source: 'auto' });
    const afterSuccess = officeIntakeData();
    const freshText = document.querySelector('[data-office-intake-status]').textContent;
    const successfulAt = afterSuccess.lastSyncAt;

    window.cloudOfficeInbox = async () => { throw { error: 'unauthorized' }; };
    const failure = await officeIntakeSync({ source: 'auto' });
    const afterFailure = officeIntakeData();
    const staleText = document.querySelector('[data-office-intake-status]').textContent;
    window.setTimeout = actualSetTimeout;
    window.clearTimeout = actualClearTimeout;
    return { setup, success, failure, successfulAt, freshText, staleText, preservedAt: afterFailure.lastSyncAt, lastError: afterFailure.lastError, timers: timers.length };
  });
  assert.match(staleSync.setup, /관리사무소 접수 서버 연결을 확인하세요/, 'unconfigured relay has a fixed setup status');
  assert.equal(staleSync.success, true, 'successful sync clears stale state');
  assert.match(staleSync.freshText, /마지막 확인 0분 전/, 'successful sync refreshes the open inbox to fresh status');
  assert.ok(Date.parse(staleSync.successfulAt) > Date.parse('2026-08-27T00:00:00.000Z'), 'successful sync records a new last-sync timestamp');
  assert.equal(staleSync.failure, false, 'failed sync reports failure');
  assert.equal(staleSync.preservedAt, staleSync.successfulAt, 'failed sync preserves the prior last-sync timestamp');
  assert.match(staleSync.staleText, /마지막 확인 0분 전/, 'failed sync refreshes the open inbox from the preserved fresh baseline');
  assert.equal(staleSync.lastError, '인증 오류', 'failed sync keeps only the safe error category');
  assert.equal(staleSync.timers, 2, 'both success and failure reschedule the one-shot display timer');
  await staleSyncPage.close();

  const triggerPolicyPage = await openPage();
  const triggerPolicy = await triggerPolicyPage.evaluate(async () => {
    let calls = 0;
    window.cloudOfficeInbox = async () => {
      calls += 1;
      return { ok: true, requests: [], cursor: '', operationalErrors: [] };
    };
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeSyncPromise = null;
    __officeIntakeAutoLastStartedAt = 0;

    const first = await officeIntakeAutoTrigger('online');
    const cooldown = await officeIntakeAutoTrigger('visible');

    __officeIntakeAutoLastStartedAt = 0;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const offline = await officeIntakeAutoTrigger('online');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const afterOffline = await officeIntakeAutoTrigger('online');

    __officeIntakeAutoLastStartedAt = 0;
    __relay.token = '';
    const noRelay = await officeIntakeAutoTrigger('visible');
    __relay.token = 'test-token';
    const afterNoRelay = await officeIntakeAutoTrigger('visible');

    return { calls, first, cooldown, offline, afterOffline, noRelay, afterNoRelay };
  });
  assert.deepEqual(triggerPolicy, {
    calls: 3,
    first: true,
    cooldown: false,
    offline: false,
    afterOffline: true,
    noRelay: false,
    afterNoRelay: true
  }, 'automatic cooldown is consumed only by a real ready network start');
  await triggerPolicyPage.close();

  const postProcessingPage = await openPage();
  const postProcessing = await postProcessingPage.evaluate(async () => {
    const effects = [];
    let releaseShared;
    const shared = new Promise(resolve => { releaseShared = resolve; });
    window.officeIntakeSync = () => shared;
    window.officeIntakeFlush = async () => { effects.push('flush'); return 0; };
    window.toast = () => {};
    aptOrderManage();
    const retry = document.querySelector('#apoOfficeRetry');
    window.aptOrderManage = () => {};
    const manual = retry.onclick();
    await Promise.resolve();
    const beforeManualRelease = effects.slice();
    releaseShared(true);
    await manual;

    let releaseRecovery;
    const recoveryShared = new Promise(resolve => { releaseRecovery = resolve; });
    const request = { requestId: 'request-1', status: 'pending_review' };
    const order = { id: 'order-1' };
    window.officeIntakeSync = () => recoveryShared;
    window.officeIntakeFindRequest = () => request;
    window.officeIntakeFindExactOrder = () => order;
    window.officeIntakeReconcileOrderProjection = () => {};
    window.officeIntakeAttachPhotos = () => { effects.push('photos'); };
    window.officeIntakeAttachedUploadIds = () => { effects.push('photo-ids'); return ['upload-1']; };
    window.officeIntakeSendQueuedItem = async () => { effects.push('send'); return { ok: true }; };
    window.officeIntakeApplyAcceptResult = () => { effects.push('apply'); };
    const item = { payload: { requestId: 'request-1', hyeonjangOrderId: 'order-1' } };
    const recovery = officeIntakeRecoverQueuedAccept(item, { status: 'pending_review' });
    await Promise.resolve();
    const beforeRecoveryRelease = effects.slice();
    releaseRecovery(true);
    await recovery;

    return { beforeManualRelease, beforeRecoveryRelease, effects, attachedUploadIds: item.payload.attachedUploadIds };
  });
  assert.deepEqual(postProcessing, {
    beforeManualRelease: [],
    beforeRecoveryRelease: ['flush'],
    effects: ['flush', 'photos', 'photo-ids', 'send', 'apply'],
    attachedUploadIds: ['upload-1']
  }, 'manual flush and recovery photo revalidation each run once only after their shared sync promise resolves');
  await postProcessingPage.close();

  const manualOwnerPage = await openPage();
  const manualOwner = await manualOwnerPage.evaluate(async () => {
    const effects = [];
    let network = 0;
    let release;
    window.cloudOfficeInbox = () => {
      network += 1;
      return new Promise(resolve => { release = resolve; });
    };
    window.persistLocal = () => effects.push('persist');
    window.officeIntakeMarkDirty = () => effects.push('dirty');
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __officeIntakeAutoLastStartedAt = 0;
    state.officeIntake = { inbox: [], cursor: '', outbox: [], lastSyncAt: '', lastError: '' };
    const manual = officeIntakeSync();
    const auto = officeIntakeAutoTrigger('visible');
    release({ ok: true, requests: [], cursor: '', operationalErrors: [] });
    return {
      contract: { network, same: manual === auto, results: await Promise.all([manual, auto]), effects },
      lastStartedAt: __officeIntakeAutoLastStartedAt
    };
  });
  assert.deepEqual(manualOwner.contract, {
    network: 1,
    same: true,
    results: [true, true],
    effects: ['dirty']
  }, 'an automatic join cannot promote a manual-owned request');
  assert.equal(manualOwner.lastStartedAt, 0, 'joining an in-flight request does not consume automatic cooldown');
  await manualOwnerPage.close();

  const failurePage = await openPage();
  const failure = await failurePage.evaluate(async () => {
    const effects = [];
    let toastCalls = 0;
    const before = {
      inbox: [{ requestId: 'keep', updatedAt: '2026-08-26T00:00:00.000Z' }],
      cursor: 'cursor-keep',
      projects: [{ name: 'project-keep' }],
      aptOrders: [{ id: 'order-keep' }],
      files: [{ id: 'file-keep' }],
      outbox: [{ action: 'existing' }],
      operationalErrors: [{ code: 'keep-error' }],
      lastSyncAt: '2026-08-26T00:00:00.000Z'
    };
    state.projects = before.projects;
    state.aptOrders = before.aptOrders;
    state.files = before.files;
    state.officeIntake = {
      inbox: before.inbox,
      cursor: before.cursor,
      outbox: before.outbox,
      operationalErrors: before.operationalErrors,
      lastSyncAt: before.lastSyncAt,
      lastError: ''
    };
    const identities = { projects: state.projects, aptOrders: state.aptOrders, files: state.files };
    window.cloudOfficeInbox = async () => { throw { error: 'unauthorized' }; };
    window.persistLocal = () => effects.push('persist');
    window.officeIntakeMarkDirty = () => effects.push('dirty');
    window.cloudAutoSave = () => effects.push('cloud');
    window.relaySaveNow = async () => effects.push('relay-save');
    window.toast = () => { toastCalls++; };
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    const result = await officeIntakeSync({ source: 'auto' });
    const after = officeIntakeData();
    return {
      result,
      effects,
      toastCalls,
      sameReferences: identities.projects === state.projects && identities.aptOrders === state.aptOrders && identities.files === state.files,
      preserved: {
        inbox: after.inbox,
        cursor: after.cursor,
        projects: state.projects,
        aptOrders: state.aptOrders,
        files: state.files,
        outbox: after.outbox,
        operationalErrors: after.operationalErrors,
        lastSyncAt: after.lastSyncAt
      },
      lastError: after.lastError
    };
  });
  assert.equal(failure.result, false);
  assert.equal(failure.sameReferences, true);
  assert.deepEqual(failure.preserved, {
    inbox: [{ requestId: 'keep', updatedAt: '2026-08-26T00:00:00.000Z' }],
    cursor: 'cursor-keep',
    projects: [{ name: 'project-keep' }],
    aptOrders: [{ id: 'order-keep' }],
    files: [{ id: 'file-keep' }],
    outbox: [{ action: 'existing' }],
    operationalErrors: [{ code: 'keep-error' }],
    lastSyncAt: '2026-08-26T00:00:00.000Z'
  });
  assert.equal(failure.lastError, '인증 오류');
  assert.deepEqual(failure.effects, ['persist']);
  assert.equal(failure.toastCalls, 0);
  assert.equal(failure.effects.includes('dirty'), false);
  assert.equal(failure.effects.includes('cloud'), false);
  assert.equal(failure.effects.includes('relay-save'), false);
  await failurePage.close();

  const cloneFailurePage = await openPage();
  const cloneFailure = await cloneFailurePage.evaluate(async () => {
    const effects = [];
    const inbox = [{
      requestId: 'clone-keep',
      updatedAt: '2026-08-26T00:00:00.000Z',
      nonSerializable: BigInt(1)
    }];
    const projects = [{ name: 'project-keep' }];
    const aptOrders = [{ id: 'order-keep' }];
    const files = [{ id: 'file-keep' }];
    const outbox = [{ action: 'existing' }];
    const operationalErrors = [{ code: 'keep-error' }];
    state.projects = projects;
    state.aptOrders = aptOrders;
    state.files = files;
    state.officeIntake = {
      inbox,
      cursor: 'cursor-keep',
      outbox,
      operationalErrors,
      lastSyncAt: '2026-08-26T00:00:00.000Z',
      lastError: ''
    };
    window.cloudOfficeInbox = async () => ({
      ok: true,
      requests: [{ requestId: 'new-after-clone-failure', updatedAt: '2026-08-27T00:00:00.000Z' }],
      cursor: 'cursor-new',
      operationalErrors: []
    });
    window.persistLocal = () => effects.push('persist');
    window.officeIntakeMarkDirty = () => effects.push('dirty');
    window.cloudAutoSave = () => effects.push('cloud');
    window.relaySaveNow = async () => effects.push('relay-save');
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    const result = await officeIntakeSync({ source: 'auto' });
    const after = officeIntakeData();
    return {
      result,
      effects,
      sameReferences: after.inbox === inbox && state.projects === projects && state.aptOrders === aptOrders && state.files === files && after.outbox === outbox && after.operationalErrors === operationalErrors,
      inbox: { count: after.inbox.length, id: after.inbox[0] && after.inbox[0].requestId, nonSerializableType: typeof (after.inbox[0] && after.inbox[0].nonSerializable) },
      cursor: after.cursor,
      projects: state.projects.map(row => row.name),
      aptOrders: state.aptOrders.map(row => row.id),
      files: state.files.map(row => row.id),
      outbox: after.outbox.map(row => row.action),
      operationalErrors: after.operationalErrors.map(row => row.code),
      lastSyncAt: after.lastSyncAt,
      lastError: after.lastError
    };
  });
  assert.deepEqual(cloneFailure, {
    result: false,
    effects: ['persist'],
    sameReferences: true,
    inbox: { count: 1, id: 'clone-keep', nonSerializableType: 'bigint' },
    cursor: 'cursor-keep',
    projects: ['project-keep'],
    aptOrders: ['order-keep'],
    files: ['file-keep'],
    outbox: ['existing'],
    operationalErrors: ['keep-error'],
    lastSyncAt: '2026-08-26T00:00:00.000Z',
    lastError: '동기화 오류'
  }, 'a non-serializable inbox must fail without touching live office or project state');
  await cloneFailurePage.close();

  await browser.close();
  console.log('PASS office intake auto-sync contract');
})().catch(async error => {
  console.error('FAIL', error && error.stack || error);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});

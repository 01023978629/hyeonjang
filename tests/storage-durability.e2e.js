'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = `http://127.0.0.1:${process.env.HJ_TEST_PORT || 8299}/index.html`;
let browser;

async function openPage(options) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  await context.addInitScript(settings => {
    localStorage.setItem('hj_onboard_done', '1');
    const probe = {
      hasPersisted: true,
      hasPersist: true,
      hasEstimate: true,
      persistedValue: false,
      persistValue: true,
      usage: 799,
      quota: 1000,
      persistedReject: false,
      persistedDeferred: false,
      estimateReject: false,
      persistReject: false,
      persistThrow: false,
      estimateDeferred: false,
      persistDeferred: false,
      restoreFailure: false,
      persistedCalls: 0,
      estimateCalls: 0,
      persistCalls: 0,
      activationAtPersist: [],
      resolvePersisted: null,
      resolveEstimate: null,
      resolvePersist: null
    };
    Object.assign(probe, settings || {});
    if (probe.quota === '__undefined__') probe.quota = undefined;
    const api = {};
    Object.defineProperty(api, 'persisted', {
      configurable: true,
      get() {
        if (!probe.hasPersisted) return undefined;
        return async () => {
          probe.persistedCalls += 1;
          if (probe.persistedDeferred) {
            return new Promise((resolve, reject) => {
              probe.resolvePersisted = () => {
                probe.resolvePersisted = null;
                if (probe.persistedReject) {
                  reject(new Error('persisted rejected'));
                } else {
                  resolve(probe.persistedValue);
                }
              };
            });
          }
          await new Promise(resolve => setTimeout(resolve, 0));
          if (probe.persistedReject) throw new Error('persisted rejected');
          return probe.persistedValue;
        };
      }
    });
    Object.defineProperty(api, 'estimate', {
      configurable: true,
      get() {
        if (!probe.hasEstimate) return undefined;
        return async () => {
          probe.estimateCalls += 1;
          if (probe.estimateReject) throw new Error('estimate rejected');
          if (probe.estimateDeferred) {
            return new Promise(resolve => {
              probe.resolveEstimate = () => resolve({
                usage: probe.usage,
                quota: probe.quota
              });
            });
          }
          return { usage: probe.usage, quota: probe.quota };
        };
      }
    });
    Object.defineProperty(api, 'persist', {
      configurable: true,
      get() {
        if (!probe.hasPersist) return undefined;
        return () => {
          probe.persistCalls += 1;
          probe.activationAtPersist.push(
            !!(navigator.userActivation && navigator.userActivation.isActive)
          );
          if (probe.persistThrow) {
            throw new Error('persist threw');
          }
          if (probe.persistReject) {
            return Promise.reject(new Error('persist rejected'));
          }
          if (probe.persistDeferred) {
            return new Promise(resolve => {
              probe.resolvePersist = resolve;
            });
          }
          return Promise.resolve(probe.persistValue);
        };
      }
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: api
    });
    if (probe.restoreFailure) {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: {
          open() {
            throw new Error('restore failed');
          }
        }
      });
    }
    window.__storageProbe = probe;
  }, options || {});
  const page = await context.newPage();
  await page.route('https://**/*', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}

async function waitForStorageRefresh(page) {
  await page.waitForFunction(() =>
    window.__storageGuard &&
    window.__storageGuard.persisted.kind !== 'unknown' &&
    window.__storageGuard.estimate.kind !== 'unknown' &&
    window.__storageGuard.refreshInFlight === null
  );
}

async function settleBootAppStateSave(page) {
  // waitForFunction 에 async 함수를 주면 Promise 자체가 참으로 잡혀 바로 통과한다(기다리지 않음) — 페이지 안에서 직접 폴링한다(최대 10초)
  await page.evaluate(async () => {
    for (let i = 0; i < 400; i++) {
      const saved = await idbGet('appState');
      if (saved && saved.app === '현장' && saved.version === 2 && Array.isArray(saved.calendarImports) && saved.calendarImports.length > 0) return;
      await new Promise(r => setTimeout(r, 25));
    }
    throw new Error('부팅 appState 저장(calendarImports)이 10초 안에 끝나지 않았다');
  });
  const remainingBootMigrations = await page.evaluate(async () => {
    if (typeof taxCalendarEnsure !== 'function') {
      throw new Error('taxCalendarEnsure must be available during storage setup');
    }
    if (typeof coworkSchedEnsure !== 'function') {
      throw new Error('coworkSchedEnsure must be available during storage setup');
    }
    taxCalendarEnsure();
    coworkSchedEnsure();
    clearTimeout(__idbSaveTimer);
    __idbSaveTimer = null;
    await idbSet('appState', serializeData());
    return {
      taxCalendarAdded: taxCalendarEnsure(),
      coworkSchedAdded: coworkSchedEnsure()
    };
  });
  assert.deepEqual(remainingBootMigrations, {
    taxCalendarAdded: 0,
    coworkSchedAdded: 0
  }, 'delayed boot migrations must already be settled before storage sentinels are seeded');
}

async function openBackupCenterAndAwaitNewRefresh(page) {
  return page.evaluate(async () => {
    const before = {
      persistedCalls: window.__storageProbe.persistedCalls,
      estimateCalls: window.__storageProbe.estimateCalls,
      persistCalls: window.__storageProbe.persistCalls
    };
    backupCenter();
    const refresh = window.__storageGuard.refreshInFlight;
    const capturedNewRefreshPromise =
      !!refresh && typeof refresh.then === 'function';
    if (refresh) await refresh;
    return {
      before,
      after: {
        persistedCalls: window.__storageProbe.persistedCalls,
        estimateCalls: window.__storageProbe.estimateCalls,
        persistCalls: window.__storageProbe.persistCalls
      },
      capturedNewRefreshPromise
    };
  });
}

async function storageScenario(options) {
  const opened = await openPage(options);
  await opened.page.evaluate(() => window.__hjRestoreDone);
  await waitForStorageRefresh(opened.page);
  const backupRefresh = await openBackupCenterAndAwaitNewRefresh(opened.page);
  const result = await opened.page.evaluate(() => ({
    text: document.getElementById('bcStorageStatus').innerText,
    persistCalls: window.__storageProbe.persistCalls,
    persistedKind: window.__storageGuard.persisted.kind,
    estimateKind: window.__storageGuard.estimate.kind
  }));
  result.backupRefresh = backupRefresh;
  result.errors = opened.errors.slice();
  await opened.context.close();
  return result;
}

async function seedStoragePreservation(page) {
  await settleBootAppStateSave(page);
  return page.evaluate(async () => {
    state.projects = [{ name: 'STORAGE-GUARD-PROJECT', received: 321000 }];
    state.files = [{
      name: 'STORAGE-GUARD-FILE.pdf',
      size: 1234,
      kind: 'estimate',
      project: 'STORAGE-GUARD-PROJECT'
    }];
    state.storageGuardTask3Sentinel = 'state-preserved';
    const appState = {
      marker: 'appState-preserved',
      projects: [{ name: 'STORAGE-GUARD-IDB-PROJECT' }],
      files: [{ name: 'STORAGE-GUARD-IDB-FILE.pdf' }]
    };
    const relayQueue = [{
      id: 'storage-relay-queue-sentinel',
      kind: 'upload',
      attempts: 0
    }];
    await idbSet('appState', appState);
    await idbSet('relay_queue', relayQueue);
    const snapshot = {
      state: {
        sentinel: state.storageGuardTask3Sentinel,
        projects: state.projects,
        files: state.files
      },
      appState: await idbGet('appState'),
      relayQueue: await idbGet('relay_queue')
    };
    window.__storagePreservationBefore = JSON.parse(JSON.stringify(snapshot));
    return window.__storagePreservationBefore;
  });
}

async function readStoragePreservation(page) {
  return page.evaluate(async () => ({
    state: {
      sentinel: state.storageGuardTask3Sentinel,
      projects: state.projects,
      files: state.files
    },
    appState: await idbGet('appState'),
    relayQueue: await idbGet('relay_queue')
  }));
}

async function assertDataPreserved(settings, action, label, expectedWarning) {
  const opened = await openPage(settings);
  const page = opened.page;
  await page.evaluate(() => window.__hjRestoreDone);
  await waitForStorageRefresh(page);
  if (action === 'persist') {
    await openBackupCenterAndAwaitNewRefresh(page);
  }
  await settleBootAppStateSave(page);
  const before = await page.evaluate(async () => {
    state.projects = [{
      id: 'storage-project-sentinel',
      name: '보존 대상'
    }];
    state.files = [{
      id: 'storage-file-sentinel',
      projectId: 'storage-project-sentinel'
    }];
    const relayQueue = [{
      id: 'storage-relay-queue-sentinel',
      kind: 'upload',
      attempts: 0
    }];
    await idbSet('appState', serializeData());
    await idbSet('relay_queue', relayQueue);
    return {
      projects: JSON.parse(JSON.stringify(state.projects)),
      files: JSON.parse(JSON.stringify(state.files)),
      appState: await idbGet('appState'),
      relayQueue: await idbGet('relay_queue')
    };
  });

  if (action === 'estimate') {
    const backupRefresh = await openBackupCenterAndAwaitNewRefresh(page);
    assert.equal(
      backupRefresh.capturedNewRefreshPromise,
      true,
      `${label} must start a real backup-center refresh`
    );
    assert.equal(
      backupRefresh.after.persistedCalls,
      backupRefresh.before.persistedCalls + 1,
      `${label} must re-read persisted status`
    );
    assert.equal(
      backupRefresh.after.estimateCalls,
      backupRefresh.before.estimateCalls + 1,
      `${label} must re-read storage estimate`
    );
    const rendered = await page.evaluate(() => {
      const status = document.getElementById('bcStorageStatus');
      return {
        exists: !!status,
        lines: status ? status.querySelectorAll('p').length : 0,
        text: status ? status.innerText : ''
      };
    });
    assert.equal(rendered.exists, true, `${label} status node missing`);
    assert.equal(rendered.lines > 0, true, `${label} renderer did not run`);
    assert.equal(rendered.text.trim().length > 0, true, `${label} status empty`);
    if (typeof expectedWarning === 'boolean') {
      assert.equal(
        rendered.text.includes(
          '저장공간을 80% 이상 사용 중입니다. 지금 백업하세요.'
        ),
        expectedWarning,
        `${label} warning mismatch`
      );
    }
  } else {
    await page.locator('#bcPersist').click();
    await page.waitForFunction(() =>
      window.__storageGuard.persistInFlight === null
    );
  }

  const after = await page.evaluate(async () => ({
    projects: JSON.parse(JSON.stringify(state.projects)),
    files: JSON.parse(JSON.stringify(state.files)),
    appState: await idbGet('appState'),
    relayQueue: await idbGet('relay_queue')
  }));
  assert.deepEqual(after.projects, before.projects, `${label} projects changed`);
  assert.deepEqual(after.files, before.files, `${label} files changed`);
  assert.deepEqual(after.appState, before.appState, `${label} appState changed`);
  assert.deepEqual(
    after.relayQueue,
    before.relayQueue,
    `${label} relay_queue changed`
  );
  assert.deepEqual(opened.errors, [], `${label} emitted a pageerror`);
  await opened.context.close();
}

async function backupStatusSurvives(stat, expected) {
  const opened = await openPage({ estimateDeferred: true });
  const page = opened.page;
  await page.evaluate(() => window.__hjRestoreDone);
  await page.waitForFunction(() =>
    typeof window.__storageProbe.resolveEstimate === 'function'
  );
  const before = await page.evaluate(({ value, exactText }) => {
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __relayBackupStat = value;
    backupCenter();
    const node = Array.from(document.querySelectorAll('#modalRoot div')).find(
      element => element.innerText.trim() === exactText
    );
    window.__storageRelayStatusNode = node || null;
    return {
      found: !!node,
      text: node ? node.innerText.trim() : ''
    };
  }, { value: stat, exactText: expected });
  assert.deepEqual(before, { found: true, text: expected });
  await page.waitForFunction(() =>
    typeof window.__storageProbe.resolveEstimate === 'function'
  );
  await page.evaluate(() => window.__storageProbe.resolveEstimate());
  await page.waitForFunction(() =>
    window.__storageGuard.estimate.kind !== 'unknown' &&
    window.__storageGuard.refreshInFlight === null
  );
  const after = await page.evaluate(() => {
    const node = window.__storageRelayStatusNode;
    return {
      connected: !!node && node.isConnected,
      sameNode: !!node && Array.from(document.querySelectorAll('#modalRoot div')).includes(node),
      text: node ? node.innerText.trim() : ''
    };
  });
  assert.deepEqual(after, {
    connected: true,
    sameNode: true,
    text: expected
  });
  assert.deepEqual(opened.errors, []);
  await opened.context.close();
}

async function backupControlsSurviveStorageRefresh() {
  const opened = await openPage({ estimateDeferred: true });
  const page = opened.page;
  await page.evaluate(() => window.__hjRestoreDone);
  await page.waitForFunction(() =>
    typeof window.__storageProbe.resolveEstimate === 'function'
  );
  const preservedBefore = await seedStoragePreservation(page);
  const before = await page.evaluate(() => {
    __relay.url = 'https://relay.test/exec';
    __relay.token = 'test-token';
    __relayBackupStat = { ok: true, d: '2026-08-28' };
    __gdToken = null;
    __gdFolderId = null;
    window.__backupControlCalls = {
      backupNow: 0,
      toast: 0,
      closeModal: 0,
      drive: 0,
      folder: 0,
      restore: 0
    };
    window.backupNow = () => { window.__backupControlCalls.backupNow += 1; };
    window.toast = () => { window.__backupControlCalls.toast += 1; };
    window.closeModal = () => { window.__backupControlCalls.closeModal += 1; };
    window.openGdriveSetup = () => { window.__backupControlCalls.drive += 1; };
    window.openManmulFolder = () => { window.__backupControlCalls.folder += 1; };
    window.importData = () => { window.__backupControlCalls.restore += 1; };
    backupCenter();
    const nodes = {
      now: document.getElementById('bcNow'),
      drive: document.getElementById('bcDrive'),
      restore: document.getElementById('bcRestore')
    };
    window.__backupControlNodes = nodes;
    window.__backupControlHandlers = {
      now: nodes.now && nodes.now.onclick,
      drive: nodes.drive && nodes.drive.onclick,
      restore: nodes.restore && nodes.restore.onclick
    };
    return Object.fromEntries(Object.entries(nodes).map(([key, node]) => [key, {
      found: !!node,
      connected: !!node && node.isConnected,
      disabled: !!node && node.disabled,
      label: node ? node.textContent.trim() : '',
      callable: !!node && typeof node.onclick === 'function'
    }]));
  });
  for (const control of ['now', 'drive', 'restore']) {
    assert.deepEqual(before[control], {
      found: true,
      connected: true,
      disabled: false,
      label: before[control].label,
      callable: true
    });
    assert.equal(
      before[control].label.length > 0,
      true,
      `${control} must retain a nonempty label`
    );
  }

  await page.evaluate(() => window.__storageProbe.resolveEstimate());
  await waitForStorageRefresh(page);
  const after = await page.evaluate(async () => {
    const nodes = window.__backupControlNodes;
    const handlers = window.__backupControlHandlers;
    const current = {
      now: document.getElementById('bcNow'),
      drive: document.getElementById('bcDrive'),
      restore: document.getElementById('bcRestore')
    };
    const controls = Object.fromEntries(
      Object.entries(current).map(([key, node]) => [key, {
        connected: !!nodes[key] && nodes[key].isConnected,
        sameNode: node === nodes[key],
        sameHandler: !!node && node.onclick === handlers[key],
        disabled: !!node && node.disabled,
        label: node ? node.textContent.trim() : '',
        callable: !!node && typeof node.onclick === 'function'
      }])
    );
    current.now.click();
    current.drive.click();
    current.restore.click();
    await Promise.resolve();
    return {
      controls,
      calls: window.__backupControlCalls,
      preserved: {
        state: {
          sentinel: state.storageGuardTask3Sentinel,
          projects: state.projects,
          files: state.files
        },
        appState: await idbGet('appState'),
        relayQueue: await idbGet('relay_queue')
      }
    };
  });
  for (const control of ['now', 'drive', 'restore']) {
    assert.deepEqual(after.controls[control], {
      connected: true,
      sameNode: true,
      sameHandler: true,
      disabled: false,
      label: before[control].label,
      callable: true
    });
  }
  assert.deepEqual(after.calls, {
    backupNow: 1,
    toast: 1,
    closeModal: 2,
    drive: 1,
    folder: 0,
    restore: 1
  });
  assert.deepEqual(after.preserved, preservedBefore);
  assert.deepEqual(opened.errors, []);
  await opened.context.close();
}

function hasPersistenceCaveat(text) {
  return /자동 정리 가능성을 낮/.test(text) &&
    /데이터 보존을 보장하지 않/.test(text) &&
    /백업을 계속/.test(text);
}

(async () => {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE }
      : {}
  );

  const boot = await openPage();
  const restoreResult = await boot.page.evaluate(() => window.__hjRestoreDone);
  assert.equal(restoreResult.ok, true);
  await waitForStorageRefresh(boot.page);
  const bootResult = await boot.page.evaluate(() => ({
    persistCalls: window.__storageProbe.persistCalls,
    persistedCalls: window.__storageProbe.persistedCalls,
    estimateCalls: window.__storageProbe.estimateCalls,
    persistedKind: window.__storageGuard.persisted.kind,
    estimateKind: window.__storageGuard.estimate.kind
  }));
  assert.equal(bootResult.persistCalls, 0);
  assert.equal(bootResult.persistedCalls >= 1, true);
  assert.equal(bootResult.estimateCalls >= 1, true);
  assert.notEqual(bootResult.persistedKind, 'missing');
  assert.notEqual(bootResult.persistedKind, 'unknown');
  assert.notEqual(bootResult.estimateKind, 'missing');
  assert.notEqual(bootResult.estimateKind, 'unknown');
  const backupCenterRefresh = await openBackupCenterAndAwaitNewRefresh(boot.page);
  assert.equal(
    backupCenterRefresh.capturedNewRefreshPromise,
    true,
    'backupCenter must start a new read-only refresh Promise'
  );
  assert.equal(
    backupCenterRefresh.after.persistedCalls,
    backupCenterRefresh.before.persistedCalls + 1,
    'backupCenter must perform one new persisted() read'
  );
  assert.equal(
    backupCenterRefresh.after.estimateCalls,
    backupCenterRefresh.before.estimateCalls + 1,
    'backupCenter must perform one new estimate() read'
  );
  assert.equal(backupCenterRefresh.before.persistCalls, 0);
  assert.equal(backupCenterRefresh.after.persistCalls, 0);
  assert.deepEqual(boot.errors, []);
  await boot.context.close();

  const failedRestore = await openPage({ restoreFailure: true });
  const failedRestoreResult = await failedRestore.page.evaluate(
    () => window.__hjRestoreDone
  );
  await failedRestore.page.waitForTimeout(50);
  const failedRestoreReads = await failedRestore.page.evaluate(() => ({
    persistedCalls: window.__storageProbe.persistedCalls,
    estimateCalls: window.__storageProbe.estimateCalls,
    persistCalls: window.__storageProbe.persistCalls
  }));
  assert.equal(failedRestoreResult.ok, false);
  assert.deepEqual(failedRestoreReads, {
    persistedCalls: 0,
    estimateCalls: 0,
    persistCalls: 0
  });
  assert.deepEqual(failedRestore.errors, []);
  await failedRestore.context.close();

  const singleFlight = await openPage({ estimateDeferred: true });
  await singleFlight.page.evaluate(() => window.__hjRestoreDone);
  const sameRefreshPromise = await singleFlight.page.evaluate(() => {
    const first = storageGuardRefresh();
    const second = storageGuardRefresh();
    return first === second;
  });
  assert.equal(sameRefreshPromise, true);
  await singleFlight.page.waitForFunction(
    () => typeof window.__storageProbe.resolveEstimate === 'function'
  );
  await singleFlight.page.evaluate(() => window.__storageProbe.resolveEstimate());
  await waitForStorageRefresh(singleFlight.page);
  const singleFlightResult = await singleFlight.page.evaluate(() => ({
    persistedCalls: window.__storageProbe.persistedCalls,
    estimateCalls: window.__storageProbe.estimateCalls,
    persistCalls: window.__storageProbe.persistCalls
  }));
  assert.deepEqual(singleFlightResult, {
    persistedCalls: 1,
    estimateCalls: 1,
    persistCalls: 0
  });
  assert.deepEqual(singleFlight.errors, []);
  await singleFlight.context.close();

  async function storageText(usage, quota) {
    return storageScenario({ usage, quota });
  }

  const under = await storageText(799, 1000);
  const edge = await storageText(800, 1000);
  const high = await storageText(950, 1000);
  assert.equal(under.persistedKind, 'no');
  assert.equal(
    under.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      .includes('영속 보관 미적용'),
    true
  );
  assert.equal(under.text.includes('80% 이상'), false);
  assert.equal(edge.text.includes('80% 이상'), true);
  assert.equal(high.text.includes('80% 이상'), true);

  const formatted = await storageText(1024 * 1024, 2 * 1024 * 1024);
  assert.match(formatted.text, /1\.0 MB \/ 2\.0 MB 사용/);

  for (const [label, usage, quota] of [
    ['zero quota', 1, 0],
    ['undefined quota', 1, '__undefined__'],
    ['NaN quota', 1, Number.NaN],
    ['NaN usage', Number.NaN, 1000]
  ]) {
    const result = await storageText(usage, quota);
    assert.equal(
      result.text.includes('확인할 수 없음'),
      true,
      `${label} must be visibly safe`
    );
    assert.equal(result.persistCalls, 0);
    assert.deepEqual(result.errors, []);
  }

  const persistedReject = await storageScenario({ persistedReject: true });
  assert.equal(persistedReject.persistedKind, 'error');
  assert.match(persistedReject.text, /보관 상태 확인 실패/);
  assert.equal(persistedReject.persistCalls, 0);
  assert.deepEqual(persistedReject.errors, []);

  const estimateReject = await storageScenario({ estimateReject: true });
  assert.equal(estimateReject.estimateKind, 'error');
  assert.match(estimateReject.text, /용량 확인 실패/);
  assert.equal(estimateReject.persistCalls, 0);
  assert.deepEqual(estimateReject.errors, []);

  const unsupported = await storageScenario({
    hasPersisted: false,
    hasPersist: false,
    hasEstimate: false
  });
  assert.match(unsupported.text, /상태 확인 미지원/);
  assert.match(unsupported.text, /용량 확인 미지원/);
  assert.match(unsupported.text, /영속 보관 요청 미지원/);
  assert.equal(unsupported.persistCalls, 0);
  assert.deepEqual(unsupported.errors, []);

  const untrusted = await openPage({
    persistedValue: false,
    persistValue: true
  });
  await untrusted.page.evaluate(() => window.__hjRestoreDone);
  await waitForStorageRefresh(untrusted.page);
  await openBackupCenterAndAwaitNewRefresh(untrusted.page);
  const untrustedBefore = await untrusted.page.evaluate(() => ({
    calls: window.__storageProbe.persistCalls,
    persisted: JSON.parse(JSON.stringify(window.__storageGuard.persisted)),
    text: document.getElementById('bcStorageStatus').innerText,
    buttonText: document.getElementById('bcPersist').textContent
  }));
  await untrusted.page.locator('#bcPersist').evaluate(button => button.click());
  await untrusted.page.waitForTimeout(50);
  const untrustedAfter = await untrusted.page.evaluate(() => ({
    calls: window.__storageProbe.persistCalls,
    persisted: JSON.parse(JSON.stringify(window.__storageGuard.persisted)),
    text: document.getElementById('bcStorageStatus').innerText,
    buttonText: document.getElementById('bcPersist').textContent
  }));
  assert.equal(untrustedAfter.calls, 0);
  assert.deepEqual(untrustedAfter, untrustedBefore);
  assert.deepEqual(untrusted.errors, []);
  await untrusted.context.close();

  const persistPage = await openPage({
    persistedValue: false,
    estimateDeferred: true,
    persistDeferred: true
  });
  await persistPage.page.evaluate(() => window.__hjRestoreDone);
  await persistPage.page.evaluate(() => backupCenter());
  await persistPage.page.waitForFunction(() =>
    typeof window.__storageProbe.resolveEstimate === 'function'
  );
  const persistButton = persistPage.page.locator('#bcPersist');
  await persistButton.evaluate(button => {
    window.__storagePersistButton = button;
  });
  await persistButton.click({ noWaitAfter: true });
  const beforePersistResolve = await persistPage.page.evaluate(() => {
    const first = storageGuardRequestPersist();
    const second = storageGuardRequestPersist();
    const button = document.getElementById('bcPersist');
    return {
      calls: window.__storageProbe.persistCalls,
      activation: window.__storageProbe.activationAtPersist[0],
      firstEqualsSecond: first === second,
      firstEqualsInFlight: first === window.__storageGuard.persistInFlight,
      sameButton: button === window.__storagePersistButton,
      disabled: button.disabled,
      busy: button.getAttribute('aria-busy'),
      text: button.textContent
    };
  });
  assert.deepEqual(beforePersistResolve, {
    calls: 1,
    activation: true,
    firstEqualsSecond: true,
    firstEqualsInFlight: true,
    sameButton: true,
    disabled: true,
    busy: 'true',
    text: '보호 요청 중…'
  });
  await persistPage.page.evaluate(() => window.__storageProbe.resolveEstimate());
  await persistPage.page.waitForFunction(() =>
    window.__storageGuard.refreshInFlight === null
  );
  await persistPage.page.evaluate(() => window.__storageProbe.resolvePersist(true));
  await persistPage.page.waitForFunction(() =>
    window.__storageGuard.persisted.kind === 'yes' &&
    window.__storageGuard.persistInFlight === null
  );
  const afterPersistResolve = await persistPage.page.evaluate(() => {
    const button = document.getElementById('bcPersist');
    return {
      calls: window.__storageProbe.persistCalls,
      sameButton: button === window.__storagePersistButton,
      disabled: button.disabled,
      busy: button.getAttribute('aria-busy'),
      text: button.textContent
    };
  });
  assert.deepEqual(afterPersistResolve, {
    calls: 1,
    sameButton: true,
    disabled: true,
    busy: 'false',
    text: '이 기기 저장공간 보호 적용됨'
  });
  const grantedPersistenceText = await persistPage.page
    .locator('#bcStorageStatus')
    .innerText();
  assert.deepEqual(persistPage.errors, []);
  await persistPage.context.close();

  async function nativeKeyboardActivation(key) {
    const opened = await openPage({ persistedValue: false, persistValue: true });
    await opened.page.evaluate(() => window.__hjRestoreDone);
    await waitForStorageRefresh(opened.page);
    await openBackupCenterAndAwaitNewRefresh(opened.page);
    const button = opened.page.locator('#bcPersist');
    await button.focus();
    await button.press(key);
    await opened.page.waitForFunction(() =>
      window.__storageGuard.persisted.kind === 'yes' &&
      window.__storageGuard.persistInFlight === null
    );
    const result = await opened.page.evaluate(() => ({
      calls: window.__storageProbe.persistCalls,
      activation: window.__storageProbe.activationAtPersist
    }));
    result.errors = opened.errors.slice();
    await opened.context.close();
    return result;
  }

  for (const key of ['Enter', 'Space']) {
    const result = await nativeKeyboardActivation(key);
    assert.equal(result.calls, 1, `${key} must activate the native button once`);
    assert.deepEqual(result.activation, [true]);
    assert.deepEqual(result.errors, []);
  }

  async function partialSupport(settings) {
    const opened = await openPage(settings);
    await opened.page.evaluate(() => window.__hjRestoreDone);
    await waitForStorageRefresh(opened.page);
    await openBackupCenterAndAwaitNewRefresh(opened.page);
    const button = opened.page.locator('#bcPersist');
    const result = {
      text: await opened.page.locator('#bcStorageStatus').innerText(),
      disabled: await button.isDisabled(),
      calls: await opened.page.evaluate(() => window.__storageProbe.persistCalls),
      errors: opened.errors.slice()
    };
    await opened.context.close();
    return result;
  }

  const persistedOnly = await partialSupport({
    hasPersisted: true,
    hasPersist: false,
    hasEstimate: false
  });
  assert.match(persistedOnly.text, /영속 보관 요청 미지원/);
  assert.equal(persistedOnly.disabled, true);
  assert.equal(persistedOnly.calls, 0);
  assert.deepEqual(persistedOnly.errors, []);

  const persistOnlyPage = await openPage({
    hasPersisted: false,
    hasPersist: true,
    hasEstimate: false,
    persistValue: true
  });
  await persistOnlyPage.page.evaluate(() => window.__hjRestoreDone);
  await waitForStorageRefresh(persistOnlyPage.page);
  await openBackupCenterAndAwaitNewRefresh(persistOnlyPage.page);
  const persistOnlyBefore = await persistOnlyPage.page.evaluate(() => ({
    text: document.getElementById('bcStorageStatus').innerText,
    disabled: document.getElementById('bcPersist').disabled,
    calls: window.__storageProbe.persistCalls
  }));
  assert.match(persistOnlyBefore.text, /상태 확인 미지원/);
  assert.equal(persistOnlyBefore.disabled, false);
  assert.equal(persistOnlyBefore.calls, 0);
  await persistOnlyPage.page.locator('#bcPersist').click();
  await persistOnlyPage.page.waitForFunction(() =>
    window.__storageGuard.persisted.kind === 'yes' &&
    window.__storageGuard.persistInFlight === null
  );
  const persistOnly = await persistOnlyPage.page.evaluate(() => ({
    text: document.getElementById('bcStorageStatus').innerText,
    kind: window.__storageGuard.persisted.kind,
    disabled: document.getElementById('bcPersist').disabled,
    buttonText: document.getElementById('bcPersist').textContent,
    calls: window.__storageProbe.persistCalls,
    activation: window.__storageProbe.activationAtPersist
  }));
  assert.equal(persistOnly.calls, 1);
  assert.deepEqual(persistOnly.activation, [true]);
  assert.equal(persistOnly.kind, 'yes');
  assert.equal(hasPersistenceCaveat(persistOnly.text), true);
  assert.equal(persistOnly.disabled, true);
  assert.equal(persistOnly.buttonText, '이 기기 저장공간 보호 적용됨');
  assert.deepEqual(persistOnlyPage.errors, []);
  await persistOnlyPage.context.close();

  const estimateOnly = await partialSupport({
    hasPersisted: false,
    hasPersist: false,
    hasEstimate: true
  });
  assert.match(estimateOnly.text, /영속 보관 요청 미지원/);
  assert.match(estimateOnly.text, /MB|GB/);
  assert.equal(estimateOnly.disabled, true);
  assert.equal(estimateOnly.calls, 0);
  assert.deepEqual(estimateOnly.errors, []);

  const alreadyPersisted = await openPage({ persistedValue: true });
  await alreadyPersisted.page.evaluate(() => window.__hjRestoreDone);
  await waitForStorageRefresh(alreadyPersisted.page);
  await openBackupCenterAndAwaitNewRefresh(alreadyPersisted.page);
  const alreadyPersistedResult = await alreadyPersisted.page.evaluate(async () => {
    const result = storageGuardRequestPersist();
    const resolved = await result;
    const button = document.getElementById('bcPersist');
    return {
      resolved,
      calls: window.__storageProbe.persistCalls,
      disabled: button.disabled,
      text: button.textContent
    };
  });
  assert.deepEqual(alreadyPersistedResult, {
    resolved: true,
    calls: 0,
    disabled: true,
    text: '이 기기 저장공간 보호 적용됨'
  });
  const persistedReadText = await alreadyPersisted.page
    .locator('#bcStorageStatus')
    .innerText();
  assert.deepEqual({
    grantedRequest: hasPersistenceCaveat(grantedPersistenceText),
    persistedRead: hasPersistenceCaveat(persistedReadText)
  }, {
    grantedRequest: true,
    persistedRead: true
  }, 'both persistence success paths must disclose that backups are still required');
  assert.deepEqual(alreadyPersisted.errors, []);
  await alreadyPersisted.context.close();

  async function stalePersistedRefresh(settings, expected) {
    const opened = await openPage({ persistedValue: false, ...settings });
    await opened.page.evaluate(() => window.__hjRestoreDone);
    await waitForStorageRefresh(opened.page);
    await opened.page.evaluate(() => {
      window.__storageProbe.persistedDeferred = true;
      backupCenter();
      window.__staleRefreshButton = document.getElementById('bcPersist');
    });
    await opened.page.waitForFunction(() =>
      typeof window.__storageProbe.resolvePersisted === 'function'
    );
    await opened.page.locator('#bcPersist').click();
    await opened.page.waitForFunction(kind =>
      window.__storageGuard.persistInFlight === null &&
      window.__storageGuard.persisted.kind === kind,
      expected.kind
    );
    const requestOutcome = await opened.page.evaluate(() => {
      const guard = window.__storageGuard;
      const button = document.getElementById('bcPersist');
      return {
        kind: guard.persisted.kind,
        message: guard.persisted.message,
        buttonText: button.textContent,
        disabled: button.disabled,
        busy: button.getAttribute('aria-busy'),
        sameButton: button === window.__staleRefreshButton
      };
    });
    assert.deepEqual(requestOutcome, expected);
    await opened.page.evaluate(() => window.__storageProbe.resolvePersisted());
    await opened.page.waitForFunction(() =>
      window.__storageGuard.refreshInFlight === null
    );
    const finalResult = await opened.page.evaluate(() => {
      const guard = window.__storageGuard;
      const button = document.getElementById('bcPersist');
      return {
        outcome: {
          kind: guard.persisted.kind,
          message: guard.persisted.message,
          buttonText: button.textContent,
          disabled: button.disabled,
          busy: button.getAttribute('aria-busy'),
          sameButton: button === window.__staleRefreshButton
        },
        calls: window.__storageProbe.persistCalls,
        activation: window.__storageProbe.activationAtPersist
      };
    });
    assert.deepEqual(finalResult.outcome, expected);
    assert.equal(finalResult.calls, 1);
    assert.deepEqual(finalResult.activation, [true]);
    assert.deepEqual(opened.errors, []);
    await opened.context.close();
  }

  await stalePersistedRefresh(
    { persistValue: true },
    {
      kind: 'yes',
      message: '영속 보관 적용됨 — 브라우저 자동 정리 가능성을 낮췄지만 데이터 보존을 보장하지 않습니다. 백업을 계속해 주세요.',
      buttonText: '이 기기 저장공간 보호 적용됨',
      disabled: true,
      busy: 'false',
      sameButton: true
    }
  );
  await stalePersistedRefresh(
    { persistValue: true, persistedReject: true },
    {
      kind: 'yes',
      message: '영속 보관 적용됨 — 브라우저 자동 정리 가능성을 낮췄지만 데이터 보존을 보장하지 않습니다. 백업을 계속해 주세요.',
      buttonText: '이 기기 저장공간 보호 적용됨',
      disabled: true,
      busy: 'false',
      sameButton: true
    }
  );
  await stalePersistedRefresh(
    { persistValue: false },
    {
      kind: 'no',
      message: '브라우저 정책상 적용되지 않음',
      buttonText: '이 기기 저장공간 보호 요청',
      disabled: false,
      busy: 'false',
      sameButton: true
    }
  );
  await stalePersistedRefresh(
    { persistReject: true },
    {
      kind: 'error',
      message: '영속 보관 요청 실패',
      buttonText: '이 기기 저장공간 보호 요청',
      disabled: false,
      busy: 'false',
      sameButton: true
    }
  );

  async function persistFailure(settings, expected) {
    const opened = await openPage(settings);
    await opened.page.evaluate(() => window.__hjRestoreDone);
    await waitForStorageRefresh(opened.page);
    await openBackupCenterAndAwaitNewRefresh(opened.page);
    const preservedBefore = await seedStoragePreservation(opened.page);
    const persistedReadsBefore = await opened.page.evaluate(
      () => window.__storageProbe.persistedCalls
    );
    await opened.page.locator('#bcPersist').evaluate(button => {
      window.__storageFailureButton = button;
    });
    await opened.page.locator('#bcPersist').click();
    await opened.page.waitForFunction(() =>
      window.__storageGuard.persistInFlight === null
    );
    await opened.page.waitForTimeout(50);
    const result = {
      text: await opened.page.locator('#bcStorageStatus').innerText(),
      calls: await opened.page.evaluate(() => window.__storageProbe.persistCalls),
      activation: await opened.page.evaluate(
        () => window.__storageProbe.activationAtPersist
      ),
      persistedReadsAfter: await opened.page.evaluate(
        () => window.__storageProbe.persistedCalls
      ),
      sameButton: await opened.page.evaluate(() =>
        document.getElementById('bcPersist') === window.__storageFailureButton
      ),
      focused: await opened.page.evaluate(() =>
        document.activeElement === window.__storageFailureButton
      ),
      preservedAfter: await readStoragePreservation(opened.page),
      errors: opened.errors.slice()
    };
    assert.match(result.text, new RegExp(expected));
    assert.equal(result.calls, 1);
    assert.deepEqual(result.activation, [true]);
    assert.equal(result.sameButton, true);
    assert.equal(result.focused, true);
    assert.equal(
      result.persistedReadsAfter,
      persistedReadsBefore,
      'persist result must not be overwritten by a follow-up refresh'
    );
    assert.deepEqual(result.preservedAfter, preservedBefore);
    assert.deepEqual(result.errors, []);
    await opened.context.close();
  }

  await persistFailure(
    { persistedValue: false, persistValue: false },
    '브라우저 정책상 적용되지 않음'
  );
  await persistFailure(
    { persistedValue: false, persistReject: true },
    '영속 보관 요청 실패'
  );
  await persistFailure(
    { persistedValue: false, persistThrow: true },
    '영속 보관 요청 실패'
  );

  await assertDataPreserved(
    { estimateReject: true },
    'estimate',
    'estimate reject'
  );
  await assertDataPreserved(
    { usage: 799, quota: 1000 },
    'estimate',
    'estimate normal 79.9 percent',
    false
  );
  await assertDataPreserved(
    { usage: 800, quota: 1000 },
    'estimate',
    'estimate warning 80 percent',
    true
  );
  await assertDataPreserved(
    { usage: 950, quota: 1000 },
    'estimate',
    'estimate warning 95 percent',
    true
  );
  await assertDataPreserved(
    { persistedValue: false, persistValue: true },
    'persist',
    'persist granted'
  );
  await assertDataPreserved(
    { persistedValue: false, persistValue: false },
    'persist',
    'persist false'
  );
  await assertDataPreserved(
    { persistedValue: false, persistReject: true },
    'persist',
    'persist reject'
  );

  await backupStatusSurvives(
    { ok: true, d: '2026-08-27' },
    '✅ 서버 날짜별 백업 — 마지막 성공 2026-08-27'
  );
  await backupStatusSurvives(
    { ok: false, d: '2026-08-27', msg: 'test-failure' },
    '⚠️ 서버 날짜별 백업 실패 (2026-08-27)\n' +
      '사유: test-failure\n' +
      '서버에 한 번도 저장한 적이 없으면 백업할 원본이 없어 실패합니다 — ' +
      '[☁️ 서버에 저장하기]를 먼저 하세요.'
  );
  await backupControlsSurviveStorageRefresh();

  const isolated = await openPage({ estimateDeferred: true });
  await isolated.page.evaluate(() => window.__hjRestoreDone);
  await isolated.page.waitForFunction(
    () => typeof window.__storageProbe.resolveEstimate === 'function'
  );
  await isolated.page.evaluate(() => {
    state.projects = [{ name: 'PRIVATE-CUSTOMER-010-0000-0000' }];
    backupCenter();
    const modal = document.querySelector('#modalRoot .modal');
    const status = document.getElementById('bcStorageStatus');
    const sentinel = document.createElement('div');
    sentinel.id = 'storageIsolationSentinel';
    sentinel.textContent = 'server-backup-ui-preserved';
    status.parentElement.before(sentinel);
    window.__storageModal = modal;
    window.__storageStatus = status;
    window.__storageBackupCenterCalls = 0;
    window.__storageOpenModalCalls = 0;
    const originalBackupCenter = backupCenter;
    const originalOpenModal = openModal;
    window.backupCenter = function() {
      window.__storageBackupCenterCalls += 1;
      return originalBackupCenter.apply(this, arguments);
    };
    window.openModal = function() {
      window.__storageOpenModalCalls += 1;
      return originalOpenModal.apply(this, arguments);
    };
  });
  await isolated.page.evaluate(() => window.__storageProbe.resolveEstimate());
  await waitForStorageRefresh(isolated.page);
  await isolated.page.waitForFunction(() =>
    document.getElementById('bcStorageStatus').innerText.includes('사용')
  );
  await isolated.page.locator('.bc-storage').scrollIntoViewIfNeeded();
  const isolatedResult = await isolated.page.evaluate(() => {
    const status = document.getElementById('bcStorageStatus');
    const button = document.getElementById('bcPersist');
    const section = status.closest('section');
    const modal = document.querySelector('#modalRoot .modal');
    const sectionRect = section.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();
    const buttonStyle = getComputedStyle(button);
    const statusStyle = getComputedStyle(status);
    const viewportRect = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };
    const within = (inner, outer) =>
      inner.left >= outer.left - 1 && inner.top >= outer.top - 1 &&
      inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1;
    return {
      sameModal: modal === window.__storageModal,
      sameStatus: status === window.__storageStatus,
      sentinel: document.getElementById('storageIsolationSentinel').textContent,
      backupCenterCalls: window.__storageBackupCenterCalls,
      openModalCalls: window.__storageOpenModalCalls,
      role: status.getAttribute('role'),
      live: status.getAttribute('aria-live'),
      title: section.querySelector('h3').textContent,
      originScope: status.innerText.includes(
        'https://01023978629.github.io origin 전체의 근사값'
      ),
      cacheScope: ['Cache', 'IndexedDB', 'localStorage'].every(value =>
        status.innerText.includes(value)
      ),
      leaksPrivateState: status.innerText.includes('PRIVATE-CUSTOMER-010-0000-0000'),
      sectionWithinModal: within(sectionRect, modalRect),
      statusWithinModal: within(statusRect, modalRect),
      buttonWithinModal: within(buttonRect, modalRect),
      sectionWithinViewport: within(sectionRect, viewportRect),
      statusWithinViewport: within(statusRect, viewportRect),
      buttonWithinViewport: within(buttonRect, viewportRect),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      statusOverflowWrap: statusStyle.overflowWrap,
      statusWordBreak: statusStyle.wordBreak,
      buttonHeight: buttonRect.height,
      buttonMaxWidth: buttonStyle.maxWidth,
      buttonWhiteSpace: buttonStyle.whiteSpace,
      buttonLabel: button.textContent.trim()
    };
  });
  assert.equal(isolatedResult.sameModal, true);
  assert.equal(isolatedResult.sameStatus, true);
  assert.equal(isolatedResult.sentinel, 'server-backup-ui-preserved');
  assert.equal(isolatedResult.backupCenterCalls, 0);
  assert.equal(isolatedResult.openModalCalls, 0);
  assert.equal(isolatedResult.role, 'status');
  assert.equal(isolatedResult.live, 'polite');
  assert.equal(isolatedResult.title, '이 기기 저장공간 보호');
  assert.equal(isolatedResult.originScope, true);
  assert.equal(isolatedResult.cacheScope, true);
  assert.equal(isolatedResult.leaksPrivateState, false);
  assert.equal(isolatedResult.viewportWidth, 390);
  assert.equal(isolatedResult.viewportHeight, 844);
  assert.equal(isolatedResult.sectionWithinModal, true);
  assert.equal(isolatedResult.statusWithinModal, true);
  assert.equal(isolatedResult.buttonWithinModal, true);
  assert.equal(isolatedResult.sectionWithinViewport, true);
  assert.equal(isolatedResult.statusWithinViewport, true);
  assert.equal(isolatedResult.buttonWithinViewport, true);
  assert.equal(
    isolatedResult.documentScrollWidth <= isolatedResult.viewportWidth,
    true
  );
  assert.equal(isolatedResult.statusOverflowWrap, 'anywhere');
  assert.equal(isolatedResult.statusWordBreak, 'break-word');
  assert.equal(isolatedResult.buttonHeight >= 44, true);
  assert.equal(isolatedResult.buttonMaxWidth, '100%');
  assert.notEqual(isolatedResult.buttonWhiteSpace, 'nowrap');
  assert.equal(isolatedResult.buttonLabel.length > 0, true);
  assert.deepEqual(isolated.errors, []);
  await isolated.context.close();

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'index.html'),
    'utf8'
  );
  const helperStart = source.indexOf("const STORAGE_ORIGIN_LABEL='");
  const helperEnd = source.indexOf('// 백업 안심 센터', helperStart);
  assert.equal(helperStart >= 0 && helperEnd > helperStart, true);
  const storageGuardHelpers = source.slice(helperStart, helperEnd);
  for (const [name, pattern] of [
    ['state.files=[]', /state\.files\s*=\s*\[\s*\]/],
    ['state.projects=[]', /state\.projects\s*=\s*\[\s*\]/],
    ['indexedDB.deleteDatabase', /indexedDB\s*\.\s*deleteDatabase/],
    ['localStorage.clear', /localStorage\s*\.\s*clear\s*\(/],
    ['caches.delete', /caches\s*\.\s*delete\s*\(/]
  ]) {
    assert.equal(
      pattern.test(storageGuardHelpers),
      false,
      `storage-guard helper segment must not add ${name}`
    );
  }

  await browser.close();
  console.log('PASS browser storage guard');
})().catch(async error => {
  console.error('FAIL', error && error.stack || error);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});

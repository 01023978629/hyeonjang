'use strict';
/* Actual index.html queue functions, synthetic IDB/DOM/relay only. No server,
   browser, account, production data, or disk mutation is used by this test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const bytes = value => JSON.stringify(value);

// Let the JS parser find the actual closing brace, including strings/comments.
// This also fails if a required function/handler disappears or becomes invalid.
function expressionAt(text, start, label) {
  assert(start >= 0, label + ' exists');
  for (let end = text.indexOf('}', start); end >= 0; end = text.indexOf('}', end + 1)) {
    const candidate = text.slice(start, end + 1);
    try { new vm.Script('(' + candidate + ')'); return candidate; } catch (_) {}
  }
  throw new Error(label + ' could not be parsed');
}
function fn(text, name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(text);
  return expressionAt(text, match ? match.index : -1, name);
}
function handler(text, selector) {
  const prefix = "root.querySelector('" + selector + "').onclick=";
  const start = text.indexOf(prefix);
  return expressionAt(text, start < 0 ? -1 : start + prefix.length, selector);
}

const upload = (id, retryCount = 0) => ({
  id, action: 'upload', payload: { name: id + '.jpg', data: 'SYNTHETIC-IMAGE-BYTES-' + id },
  createdAt: 1234, retryCount, deviceId: 'TEST-DEVICE', baseRevision: 7,
  extension: { preserve: ['unknown', 'fields'] },
});
const save = id => ({ id, action: 'save', payload: null, createdAt: 1235, retryCount: 0 });
const initial = () => [upload('upload-existing'), save('save-existing')];

function fixture(options = {}, text = source) {
  let stored = clone(Object.prototype.hasOwnProperty.call(options, 'queue') ? options.queue : initial());
  let strictReads = 0, looseReads = 0, queueWrites = 0, confirmations = 0;
  let status = 'ready', backupCalls = 0, officeCalls = 0;
  const requests = [], toasts = [], statuses = [], timers = [], metadataWrites = [];
  const nodes = Object.fromEntries(['relayStat', 'gdDot', 'ryQn'].map(id => [id, { textContent: '', style: {} }]));
  const failRead = n => options.failReads === true || (options.failReads || []).includes(n);
  const sandbox = {
    console: { warn() {} },
    document: { getElementById: id => nodes[id] || null },
    navigator: { onLine: options.online !== false },
    __relay: { rev: 7, device: 'TEST-DEVICE', syncAt: '' },
    __relayQn: Array.isArray(stored) ? stored.length : 19,
    __relayFlushing: false, __relaySaving: false, __relayPend: false, __relayAuthToasted: false,
    state: { _demo: false },
    relayReady: () => options.ready !== false,
    toast: value => toasts.push(String(value)),
    serializeData: () => ({ app: 'SYNTHETIC-TEST', current: true }),
    idbGetStrict: async key => {
      assert.equal(key, 'relay_queue');
      if (failRead(++strictReads)) throw new Error('SYNTHETIC-IDB-READ-FAILURE');
      return clone(stored);
    },
    idbGet: async key => {
      assert.equal(key, 'relay_queue'); looseReads++;
      return options.failReads ? null : clone(stored);
    },
    idbSet: async (key, value) => {
      if (key !== 'relay_queue') { metadataWrites.push({ key, value: clone(value) }); return; }
      queueWrites++;
      if (options.failWrites) throw new Error('SYNTHETIC-IDB-WRITE-FAILURE');
      stored = clone(value);
    },
    relayCall: async (action, payload) => {
      requests.push({ action, payload: clone(payload) });
      if (options.onRequest) options.onRequest(api, requests.length);
      if (options.serverThrows) throw new Error('SYNTHETIC-RELAY-OFFLINE');
      return clone(options.response || { ok: true, revision: 8, savedAt: '2026-09-09T00:00:00.000Z' });
    },
    relayDailyBackup: () => { backupCalls++; },
    officeIntakeFlush: async () => { officeCalls++; },
    relayConflictModal: () => {},
    saveRy: async () => {},
    confirm: () => {
      confirmations++;
      if (options.onConfirm) options.onConfirm(api);
      return options.confirm !== false;
    },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
  };
  Object.defineProperty(sandbox, '__relayState', {
    get: () => status,
    set: value => { status = value; statuses.push(value); },
  });
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  for (const name of ['relayStatText', 'relaySetStatus', 'relayAuthFail', 'relayQueueReadStrict',
    'relayQueueGet', 'relayQueueSet', 'relayUpdateQueueBadge', 'relayQueuePush',
    'cloudFlushQueue', 'cloudApiSave', 'relaySaveNow']) {
    vm.runInContext(fn(text, name), sandbox, { filename: 'index.html:' + name, timeout: 1000 });
  }
  vm.runInContext('var clearFailed = ' + handler(text, '#ryClearFail') + ';\nvar flushButton = ' + handler(text, '#ryFlush') + ';', sandbox);
  const api = {
    sandbox, nodes, requests, toasts, statuses, timers, metadataWrites,
    get queue() { return clone(stored); },
    get strictReads() { return strictReads; }, get looseReads() { return looseReads; },
    get queueWrites() { return queueWrites; }, get confirmations() { return confirmations; },
    get backupCalls() { return backupCalls; }, get officeCalls() { return officeCalls; },
    append: item => { stored.push(clone(item)); },
    call: (name, ...args) => sandbox[name](...args),
  };
  return api;
}

function unchanged(f, before, noWrite = true) {
  assert.equal(bytes(f.queue), before, 'previous queue bytes preserved');
  if (noWrite) assert.equal(f.queueWrites, 0, 'no queue write attempted');
}
function failedStatus(f) {
  assert.equal(f.sandbox.__relayState, 'qfail', 'queue failure must remain final status');
  assert.equal(f.statuses.includes('saved'), false, 'failure never claims cloud save success');
  assert.match(f.nodes.relayStat.textContent, /실패/);
}

const cases = [
  ['strict read distinguishes absent queue from invalid data', async text => {
    for (const queue of [null, undefined]) {
      const f = fixture({ queue }, text);
      assert.equal(bytes(await f.call('relayQueueReadStrict')), '[]');
      assert.equal(f.strictReads, 1); assert.equal(f.looseReads, 0);
    }
    for (const queue of [{ items: [] }, '[]', 0, false, [null], [[]], ['upload']]) {
      const f = fixture({ queue }, text);
      await assert.rejects(f.call('relayQueueReadStrict'), /invalid/);
      unchanged(f, bytes(queue));
    }
  }],
  ['read failure cannot overwrite pending photos', async text => {
    for (const action of ['upload', 'save']) {
      const f = fixture({ failReads: true }, text), before = bytes(f.queue);
      assert.equal(await f.call('relayQueuePush', action, { name: 'NEW-SYNTHETIC.jpg' }), false);
      unchanged(f, before); failedStatus(f);
      assert.equal(f.requests.length, 0); assert.equal(f.looseReads, 0);
    }
  }],
  ['invalid stored queue cannot be replaced', async text => {
    for (const queue of [{ keep: 'SYNTHETIC-RECOVERABLE' }, 0, [null]]) {
      const f = fixture({ queue }, text), before = bytes(f.queue);
      assert.equal(await f.call('relayQueuePush', 'save'), false);
      unchanged(f, before); failedStatus(f); assert.equal(f.requests.length, 0);
    }
  }],
  ['write rejection preserves original queue', async text => {
    const f = fixture({ failWrites: true }, text), before = bytes(f.queue);
    assert.equal(await f.call('relayQueuePush', 'upload', { name: 'NEW-SYNTHETIC.jpg' }), false);
    unchanged(f, before, false); assert.equal(f.queueWrites, 1); failedStatus(f);
  }],
  ['uploads accumulate and saves merge without touching old upload payload', async text => {
    const f = fixture({}, text), oldPhoto = bytes(f.queue[0]);
    assert.equal(await f.call('relayQueuePush', 'upload', { name: 'NEW-SYNTHETIC.jpg', data: 'TEST-BYTES' }), true);
    assert.equal(await f.call('relayQueuePush', 'save', { mustNotPersist: true }), true);
    assert.equal(bytes(f.queue[0]), oldPhoto);
    assert.equal(f.queue.filter(it => it.action === 'upload').length, 2);
    assert.equal(f.queue.filter(it => it.action === 'save').length, 1);
    assert.equal(f.queue.at(-1).payload, null);
    assert.equal(f.queue.some(it => it.id === 'save-existing'), false);
    assert.equal(f.nodes.ryQn.textContent, 3); assert.equal(f.requests.length, 0);
  }],
  ['fifteen-photo queue cap preserves all existing records', async text => {
    const f = fixture({ queue: Array.from({ length: 15 }, (_, n) => upload('TEST-' + n)) }, text);
    const before = bytes(f.queue);
    assert.equal(await f.call('relayQueuePush', 'upload', { name: 'OVER-CAP-TEST.jpg' }), false);
    unchanged(f, before); assert.match(f.toasts.join(' '), /가득/);
  }],
  ['badge read failure is unknown, not zero pending', async text => {
    const f = fixture({ failReads: true }, text), before = bytes(f.queue);
    assert.equal(await f.call('relayUpdateQueueBadge'), null);
    assert.equal(f.sandbox.__relayQn, 2); assert.equal(f.nodes.ryQn.textContent, '확인 불가');
    unchanged(f, before); failedStatus(f);
  }],
  ['flush initial read failure makes zero relay requests', async text => {
    const f = fixture({ failReads: true }, text), before = bytes(f.queue);
    await f.call('cloudFlushQueue', true);
    unchanged(f, before); failedStatus(f);
    assert.equal(f.requests.length, 0); assert.equal(f.sandbox.__relayFlushing, false);
    assert.equal(f.backupCalls, 0); assert.equal(f.officeCalls, 0);
  }],
  ['flush reread failure preserves newly queued photo', async text => {
    const added = upload('NEW-DURING-REQUEST');
    const f = fixture({ queue: [save('queued-save')], failReads: [2],
      onRequest: (a, n) => { if (n === 1) a.append(added); } }, text);
    const expected = bytes([...f.queue, added]);
    await f.call('cloudFlushQueue', true);
    unchanged(f, expected); failedStatus(f);
    assert.equal(f.requests.length, 1); assert.equal(f.sandbox.__relayFlushing, false);
    assert.equal(f.backupCalls, 0); assert.equal(f.officeCalls, 0);
  }],
  ['flush queue-commit failure cannot claim save success', async text => {
    const f = fixture({ queue: [save('queued-save')], failWrites: true }, text), before = bytes(f.queue);
    await f.call('cloudFlushQueue', true);
    unchanged(f, before, false); failedStatus(f);
    assert.equal(f.queueWrites, 1); assert.equal(f.requests.length, 1);
    assert.equal(f.sandbox.__relayFlushing, false);
    assert.equal(f.backupCalls, 0); assert.equal(f.officeCalls, 0);
    assert.match(f.toasts.join(' '), /저장 실패/);
  }],
  ['successful flush preserves concurrent additions', async text => {
    const added = upload('NEW-AFTER-SNAPSHOT');
    const f = fixture({ onRequest: (a, n) => { if (n === 1) a.append(added); } }, text);
    await f.call('cloudFlushQueue', true);
    assert.equal(bytes(f.queue), bytes([added])); assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].payload.data.current, true);
    assert.equal(f.backupCalls, 1); assert.equal(f.officeCalls, 1);
    assert.equal(f.sandbox.__relayFlushing, false);
    assert.equal(f.sandbox.__relayState, 'netfail', 'remaining queued item is not reported saved');
  }],
  ['successful flush commits empty queue before saved status', async text => {
    const f = fixture({}, text);
    await f.call('cloudFlushQueue', true);
    assert.equal(bytes(f.queue), '[]'); assert.equal(f.queueWrites, 1);
    assert.equal(f.sandbox.__relayState, 'saved'); assert.equal(f.sandbox.__relayFlushing, false);
    assert.equal(f.backupCalls, 1); assert.equal(f.officeCalls, 1);
  }],
  ['failed uploads retain payload and increment retry count', async text => {
    const queue = [upload('FAILED-UPLOAD', 4)];
    const f = fixture({ queue, response: { ok: false, error: 'SYNTHETIC-ERROR' } }, text);
    await f.call('cloudFlushQueue');
    assert.equal(bytes(f.queue), bytes([{ ...queue[0], retryCount: 5 }]));
    await f.call('cloudFlushQueue');
    assert.equal(f.requests.length, 1, 'automatic retry stops at five');
    await f.call('cloudFlushQueue', true);
    assert.equal(f.requests.length, 2, 'manual retry still allowed');
    assert.equal(f.queue[0].retryCount, 6);
  }],
  ['manual save reports local queue failure honestly', async text => {
    for (const serverThrows of [false, true]) {
      for (const failure of [{ failReads: true }, { failWrites: true }]) {
        const f = fixture({ ...failure, serverThrows, response: { ok: false, message: 'SYNTHETIC-ERROR' } }, text);
        const before = bytes(f.queue);
        assert.equal(await f.call('relaySaveNow', true), false);
        unchanged(f, before, !failure.failWrites); failedStatus(f);
        assert.equal(f.sandbox.__relaySaving, false); assert.equal(f.requests.length, 1);
        assert.doesNotMatch(f.toasts.join(' '), /보관됨|보관했습니다|저장됨/);
        assert.match(f.toasts.join(' '), /저장하지 못했습니다/);
        assert.equal(f.backupCalls, 0); assert.equal(f.officeCalls, 0);
      }
    }
  }],
  ['manual save only reports queued after durable queue commit', async text => {
    for (const serverThrows of [false, true]) {
      const f = fixture({ serverThrows, response: { ok: false, message: 'SYNTHETIC-ERROR' } }, text);
      const photo = bytes(f.queue[0]);
      assert.equal(await f.call('relaySaveNow', true), false);
      assert.equal(bytes(f.queue[0]), photo); assert.equal(f.queueWrites, 1);
      assert.equal(f.queue.filter(it => it.action === 'save').length, 1);
      assert.match(f.toasts.join(' '), /보관됨|보관했습니다/);
      assert.equal(f.sandbox.__relayState, serverThrows ? 'offline' : 'netfail');
      assert.equal(f.sandbox.__relaySaving, false);
    }
  }],
  ['flush button never claims all-sent on unreadable queue', async text => {
    const f = fixture({ failReads: true }, text), before = bytes(f.queue);
    await f.call('flushButton');
    unchanged(f, before); failedStatus(f);
    assert.equal(f.requests.length, 0);
    assert.doesNotMatch(f.toasts.join(' '), /전부 전송 완료/);
    assert.match(f.toasts.at(-1), /확인.*실패/);
  }],
  ['clear-failed read errors cannot delete or report deletion', async text => {
    for (const failReads of [[1], [2]]) {
      const f = fixture({ queue: [upload('FAILED-OLD', 5), upload('WAITING', 0)], failReads }, text);
      const before = bytes(f.queue);
      await f.call('clearFailed');
      unchanged(f, before); failedStatus(f);
      assert.equal(f.requests.length, 0); assert.doesNotMatch(f.toasts.join(' '), /삭제됨/);
    }
  }],
  ['clear-failed write error cannot report deletion', async text => {
    const f = fixture({ queue: [upload('FAILED-OLD', 5)], failWrites: true }, text), before = bytes(f.queue);
    await f.call('clearFailed');
    unchanged(f, before, false); failedStatus(f);
    assert.equal(f.queueWrites, 1); assert.doesNotMatch(f.toasts.join(' '), /삭제됨/);
    assert.match(f.toasts.at(-1), /저장 실패/);
  }],
  ['clear-failed deletes only confirmed IDs, preserving new items', async text => {
    const added = upload('ADDED-WHILE-CONFIRMING', 5);
    const waiting = upload('WAITING', 0);
    const f = fixture({ queue: [upload('CONFIRMED-FAILED', 5), waiting], onConfirm: a => a.append(added) }, text);
    await f.call('clearFailed');
    assert.equal(bytes(f.queue), bytes([waiting, added])); assert.equal(f.confirmations, 1);
    assert.equal(f.queueWrites, 1); assert.equal(f.requests.length, 0);
    assert.match(f.toasts.at(-1), /1건 삭제됨/);
  }],
];

async function expectMutation(label, changed, caseName) {
  assert.notEqual(changed, source, label + ' really changed source in memory');
  const test = cases.find(([name]) => name === caseName);
  assert(test, 'mutation target case exists');
  await assert.rejects(() => test[1](changed), error => {
    assert.equal(error.code, 'ERR_ASSERTION', label + ' must fail a behavior assertion, not parsing');
    return true;
  });
  console.log('PASS  mutation rejected: ' + label);
}

(async () => {
  for (const [name, test] of cases) {
    await test(source);
    console.log('PASS  ' + name);
  }
  const reader = fn(source, 'relayQueueReadStrict');
  await expectMutation('read failure becomes empty queue', source.replace(reader,
    "async function relayQueueReadStrict(){try{return (await idbGetStrict('relay_queue'))||[];}catch(e){return [];}}"),
  'read failure cannot overwrite pending photos');
  const flush = fn(source, 'cloudFlushQueue');
  const commitGuard = /if\(await relayQueueSet\(keep\)!==true\)\{[^\n]*return;\}/;
  assert.match(flush, commitGuard, 'flush commit guard exists for mutation');
  await expectMutation('flush ignores failed queue commit', source.replace(flush, flush.replace(commitGuard, 'await relayQueueSet(keep);')),
    'flush queue-commit failure cannot claim save success');
  const saveNow = fn(source, 'relaySaveNow');
  const queuedAssignment = /const queued=await relayQueuePush\('save'\);/g;
  assert.equal((saveNow.match(queuedAssignment) || []).length, 2, 'both save failure branches protected');
  await expectMutation('save falsely treats failed queue as durable', source.replace(saveNow,
    saveNow.replace(queuedAssignment, "await relayQueuePush('save');const queued=true;")),
  'manual save reports local queue failure honestly');
  console.log('PASS  relay queue preservation: ' + cases.length + ' scenarios, 3 in-memory mutations; external requests 0');
})().catch(error => { console.error(error); process.exitCode = 1; });

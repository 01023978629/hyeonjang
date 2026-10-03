/* Actual relayBoot + queue badge + event listeners, with a synthetic delayed IDB
   queue and inbox coordinator. The full inbox contract remains in the E2E test. */
'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { mutation, testAppSource, eventTriggerProbe } = require('./test-stability-fixture');
const source = testAppSource('');
const start = source.indexOf('let __hjRelayConfigResolve;');
const end = source.indexOf('\nfunction relayNewerBanner', start);
assert(start >= 0 && end > start, 'actual boot source missing');
const lines = source.split(/\r?\n/);
const ready = lines.find(line => line.startsWith('function relayReady()'));
const badge = lines.find(line => line.startsWith('async function relayUpdateQueueBadge()'));
const online = lines.find(line => line.startsWith("window.addEventListener('online',function(){try{cloudFlushQueue();}"));
const visible = lines.find(line => line.includes("document.addEventListener('visibilitychange'") && line.includes("officeIntakeAutoTrigger('visible')"));
assert(ready && badge && online && visible, 'actual listener source missing');

async function scenario(waitForBoot) {
  let releaseQueue, reachedQueue;
  const queueGate = new Promise(resolve => { releaseQueue = resolve; });
  const queueReached = new Promise(resolve => { reachedQueue = resolve; });
  const listeners = new Map();
  const add = (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]);
  const context = {
    Promise, Date, Math, Error, Event, setTimeout,
    navigator: { onLine: true, userAgent: 'TEST-STABILITY-VM' },
    document: { getElementById() { return null; }, addEventListener: add,
      dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); } },
    RELAY_URL_DEFAULT: '', CONTRACT_SERVER_DEFAULT: '',
    __relay: { url: '', token: '', device: '', rev: 0, syncAt: '' },
    __contract: {}, __reviewUrl: '', __relayQn: 0, __relayState: '',
    __officeIntakeAutoLastStartedAt: 0, __officeIntakeSyncPromise: null,
    __hjRestoreDone: Promise.resolve({ ok: true }),
    idbGet: async key => key === 'relay_device' ? 'TEST-VM-DEVICE' : '',
    idbSet: async () => true, relayBackupStatLoad: async () => {}, aiRelayProbe: async () => {},
    relayQueueGet: async () => { reachedQueue(); return queueGate; },
    relayQueueSendCount: queue => queue.length, relaySetStatus: () => {},
    cloudFlushQueue: () => { throw new Error('probe not installed'); },
    cloudApiHealth: async () => ({ ok: false }),
    // Inbox coordination is synthetic; the actual listeners and boot are not.
    officeIntakeAutoTrigger: () => context.cloudOfficeInbox(),
    addEventListener: add,
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
      // Only the legacy scenario releases the delayed IDB after the online event.
      if (!waitForBoot && event.type === 'online') releaseQueue([]);
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext([ready, badge, source.slice(start, end), online, visible].join('\n'), context, { filename: 'actual-relay-boot.js', timeout: 1000 });
  const boot = context.relayBoot();
  await context.__hjRelayConfigDone;
  await queueReached;
  const probe = vm.runInContext('(' + eventTriggerProbe.toString() + ')(' + waitForBoot + ')', context);
  try {
    if (waitForBoot) {
      // Drain the current turn, while the real IDB gate stays closed: no guessed delay.
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(context.__relay.token, '', 'completed boot must precede injecting the synthetic relay token');
      assert.equal(context.cloudOfficeInbox, undefined, 'probe must not install spies while boot still reads the queue');
      releaseQueue([]);
    }
    const result = await probe;
    await boot;
    return JSON.parse(JSON.stringify(result));
  } finally {
    releaseQueue([]);
    await Promise.allSettled([boot, probe]);
  }
}
(async () => {
  const legacy = await scenario(false);
  assert.deepEqual({ calls: legacy.calls, afterOnline: legacy.afterOnline, queueFlushes: legacy.queueFlushes }, { calls: 2, afterOnline: 1, queueFlushes: 2 }, 'forced old boundary reproduces the extra boot flush');
  assert(legacy.flushStacks.some(stack => stack.includes('relayBoot')), 'extra flush originates from the actual relayBoot');
  const isolated = await scenario(mutation !== 'boot-wait');
  assert.deepEqual({ calls: isolated.calls, afterOnline: isolated.afterOnline, queueFlushes: isolated.queueFlushes }, { calls: 2, afterOnline: 1, queueFlushes: 1 }, 'completed boot leaves exactly the online-triggered flush');
  assert(!isolated.flushStacks.some(stack => stack.includes('relayBoot')), 'isolated probe must not count startup as an online event');
  console.log('PASS test stability: old boundary=2 (online + relayBoot), completed boot=1 (online only)');
})().catch(error => { console.error('FAIL test stability:', error.stack); process.exitCode = 1; });

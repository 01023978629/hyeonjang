'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const properties = {
  OFFICE_INTAKE_ENABLED: '1',
  OFFICE_SESSION_SECRET: 'TEST_ONLY_SESSION_SECRET_0123456789',
  APP_TOKEN: 'TEST_ONLY_LEGACY_RELAY_TOKEN',
  DRIVE_FOLDER_ID: 'root',
};
const cache = new Map();
const cryptoStats = { macCalls: 0, decodeCalls: 0 };
const lockEvents = [];
const drive = { nextId: 1, files: [], folders: [] };
function iterator(items) {
  let index = 0;
  return { hasNext: () => index < items.length, next: () => items[index++] };
}
function makeFolder(name, parent) {
  const folder = {
    id: 'folder-' + drive.nextId++, name, parent,
    getId() { return this.id; },
    getName() { return this.name; },
    getFilesByName(fileName) { return iterator(drive.files.filter(file => file.parent === this && file.name === fileName)); },
    getFoldersByName(folderName) { return iterator(drive.folders.filter(child => child.parent === this && child.name === folderName)); },
    createFolder(folderName) { const child = makeFolder(folderName, this); drive.folders.push(child); return child; },
    createFile(arg, content, mimeType) {
      const blob = typeof arg === 'string'
        ? { name: arg, bytes: Array.from(Buffer.from(String(content), 'utf8')), mimeType }
        : arg;
      const file = {
        id: 'file-' + drive.nextId++, parent: this, name: blob.name, mimeType: blob.mimeType,
        bytes: Array.from(blob.bytes || []),
        getId() { return this.id; },
        getName() { return this.name; },
        getBlob() { return { getDataAsString: () => Buffer.from(this.bytes).toString('utf8'), getBytes: () => this.bytes.slice() }; },
        setContent(text) { this.bytes = Array.from(Buffer.from(String(text), 'utf8')); },
      };
      drive.files.push(file);
      return file;
    },
  };
  return folder;
}
const driveRoot = makeFolder('root', null);
drive.folders.push(driveRoot);
const SandboxDate = class extends Date { static now() { return 1000; } };
function stubMac(text, key) {
  cryptoStats.macCalls++;
  return Array.from(Buffer.from('test-hmac:' + String(key) + ':' + String(text), 'utf8'));
}
function stubB64(bytes) { return Buffer.from(bytes).toString('base64url'); }
function expectedPinHash(pin, salt) {
  return stubB64(stubMac(String(salt) + ':' + String(pin), properties.OFFICE_SESSION_SECRET));
}
properties.OFFICE_CONFIG_JSON = JSON.stringify({
  offices: [{
    id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', sessionVersion: 1,
    pinSalt: 'sample-office-salt', pinHash: expectedPinHash('123456', 'sample-office-salt'),
  }, {
    id: 'of2', slug: 'disabled-apt', complexName: '중지 아파트', sessionVersion: 1, enabled: false,
    pinSalt: 'disabled-office-salt', pinHash: expectedPinHash('123456', 'disabled-office-salt'),
  }, {
    id: 'of3', slug: 'other-apt', complexName: '다른 아파트', sessionVersion: 1,
    pinSalt: 'other-office-salt', pinHash: expectedPinHash('123456', 'other-office-salt'),
  }],
});

const sandbox = {
  JSON,
  Math,
  String,
  Number,
  Array,
  Object,
  Error,
  Date: SandboxDate,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null,
      setProperty: (key, value) => { properties[key] = String(value); },
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => { cache.set(key, String(value)); },
      remove: key => cache.delete(key),
    }),
  },
  Utilities: {
    computeHmacSha256Signature: stubMac,
    base64EncodeWebSafe: stubB64,
    base64DecodeWebSafe: value => {
      cryptoStats.decodeCalls++;
      return Array.from(Buffer.from(String(value), 'base64url'));
    },
    base64Decode: value => Array.from(Buffer.from(String(value), 'base64')),
    newBlob: (bytes, mimeType, name) => ({ bytes: Array.from(bytes), mimeType, name, getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    getUuid: () => 'req-' + drive.nextId,
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      waitLock: timeout => { lockEvents.push('wait:' + timeout); },
      releaseLock: () => { lockEvents.push('release'); },
    }),
  },
  DriveApp: { getFolderById: id => { if (id !== 'root') throw new Error('not-found'); return driveRoot; } },
  CalendarApp: {},
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: text => ({
      text,
      setMimeType() { return this; },
      getContent() { return this.text; },
    }),
  },
};
vm.createContext(sandbox);
for (const name of ['OfficeIntakePure.gs', 'Code.gs', 'OfficeIntake.gs']) {
  const file = path.join(__dirname, '..', 'apps-script', name);
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name });
}

// Break caught: removing login/session helpers must make successful office login impossible.
lockEvents.length = 0;
const login = sandbox.oiLogin_({ slug: 'sample-apt', pin: '123456' }, 1000);
assert.equal(login.ok, true);
assert.deepEqual(lockEvents, ['wait:20000', 'release']);
assert.equal(login.office.complexName, '예시 아파트');
assert.equal(Object.hasOwn(login.office, 'pinHash'), false);
assert.equal(Object.hasOwn(login.office, 'pinSalt'), false);
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1001).officeId, 'of1');
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1000 + 8 * 60 * 60 * 1000 + 1), null);
assert.equal(sandbox.oiVerifySession_(sandbox.oiIssueSession_({ id: 'of1', sessionVersion: 1 }, 2000), 1000), null);
assert.equal(sandbox.oiVerifySession_(login.sessionToken.slice(0, -1) + 'x', 1001), null);
assert.equal(sandbox.oiVerifySession_('malformed-session', 1001), null);

// Break caught: unknown and disabled slugs must perform the same PIN HMAC/compare work as a known office.
function credentialMetrics(input) {
  cache.clear();
  cryptoStats.macCalls = 0;
  cryptoStats.decodeCalls = 0;
  const result = sandbox.oiLogin_(input, 1500);
  return { result, macCalls: cryptoStats.macCalls, decodeCalls: cryptoStats.decodeCalls };
}
const activeFailure = credentialMetrics({ slug: 'sample-apt', pin: '000000' });
const unknownFailure = credentialMetrics({ slug: 'missing-apt', pin: '000000' });
const disabledFailure = credentialMetrics({ slug: 'disabled-apt', pin: '000000' });
assert.equal(activeFailure.result.error, 'invalid-credentials');
assert.equal(unknownFailure.result.error, 'invalid-credentials');
assert.equal(disabledFailure.result.error, 'invalid-credentials');
assert.deepEqual(unknownFailure.result, activeFailure.result);
assert.deepEqual(disabledFailure.result, activeFailure.result);
assert.deepEqual(
  { macCalls: unknownFailure.macCalls, decodeCalls: unknownFailure.decodeCalls },
  { macCalls: activeFailure.macCalls, decodeCalls: activeFailure.decodeCalls },
);
assert.deepEqual(
  { macCalls: disabledFailure.macCalls, decodeCalls: disabledFailure.decodeCalls },
  { macCalls: activeFailure.macCalls, decodeCalls: activeFailure.decodeCalls },
);
cache.clear();

for (let i = 0; i < 5; i++) sandbox.oiLogin_({ slug: 'sample-apt', pin: '000000' }, 2000 + i);
assert.equal(sandbox.oiLogin_({ slug: 'sample-apt', pin: '123456' }, 2010).error, 'rate-limited');

properties.OFFICE_INTAKE_ENABLED = '0';
assert.equal(sandbox.oiLogin_({ slug: 'sample-apt', pin: '123456' }, 3000).error, 'office-disabled');
properties.OFFICE_INTAKE_ENABLED = '1';
cache.clear();

// Break caught: routing office actions through the legacy token gate would reject public login.
const publicOutput = sandbox.doPost({ postData: { contents: JSON.stringify({
  action: 'officeLogin', ts: 1000, payload: { slug: 'sample-apt', pin: '123456' },
}) } });
assert.equal(JSON.parse(publicOutput.getContent()).ok, true);

// Break caught: dispatching office-internal actions before APP_TOKEN validation would expose them.
const internalOutput = sandbox.doPost({ postData: { contents: JSON.stringify({
  action: 'officeInbox', ts: 1000, payload: {},
}) } });
assert.equal(JSON.parse(internalOutput.getContent()).error, 'unauthorized');

for (const token of [undefined, 'wrong-test-token']) {
  const legacyOutput = sandbox.doPost({ postData: { contents: JSON.stringify({
    action: 'health', ts: 1000, token,
  }) } });
  assert.equal(JSON.parse(legacyOutput.getContent()).error, 'unauthorized');
}

// Break caught: omitting the Drive-backed, office-scoped store would duplicate a retry and expose another office's request.
const sessionOf1 = { officeId: 'of1', office: sandbox.oiOfficeById_('of1') };
const sessionOf2 = { officeId: 'of3', office: sandbox.oiOfficeById_('of3') };
const validPayload = {
  idempotencyKey: 'retry-key-1', unit: '103동 1204호', location: '욕실 천장', issueType: '누수', pipeType: '미확정',
  urgency: 'normal', description: '천장에서 물이 떨어집니다.',
  officeContact: { name: '홍길동', phone: '01012345678' }, residentContact: null,
  preferredVisitDate: '1970-01-01', privacyConsent: true,
};
const first = sandbox.oiCreate_(sessionOf1, validPayload, 10000);
const replay = sandbox.oiCreate_(sessionOf1, validPayload, 10001);
assert.equal(first.receiptNo, 'MM-19700101-0001');
assert.equal(replay.requestId, first.requestId);
assert.equal(sandbox.oiList_(sessionOf2, {}).requests.length, 0);
assert.equal(sandbox.oiGet_(sessionOf2, first.requestId).error, 'not-found');

// Break caught: accepting an unrecognised declared type or a cross-office upload would store untrusted or another office's photo.
const badPhoto = sandbox.oiUpload_(sessionOf1, {
  requestId: first.requestId, name: 'bad.gif', mimeType: 'image/gif', dataB64: 'R0lGODlhAQABAIAAAAUEBA=='
}, 10002);
assert.equal(badPhoto.error, 'unsupported-type');
const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');
assert.equal(sandbox.oiUpload_(sessionOf2, {
  requestId: first.requestId, name: 'other.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 10003).error, 'not-found');

// Break caught: allowing a sixth image would bypass the per-request photo limit.
for (let i = 1; i <= 5; i++) {
  const upload = sandbox.oiUpload_(sessionOf1, {
    requestId: first.requestId, name: 'photo-' + i + '.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
  }, 10010 + i);
  assert.equal(upload.ok, true);
  assert.equal(upload.name, 'MM-19700101-0001_0' + i + '.jpg');
}
assert.equal(sandbox.oiUpload_(sessionOf1, {
  requestId: first.requestId, name: 'six.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 10020).error, 'too-many-files');

// Break caught: checking encoded text instead of decoded bytes would allow an image above the 2 MiB limit.
const second = sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'retry-key-2' }, 10030);
const tooLarge = Buffer.alloc(2 * 1024 * 1024 + 1);
tooLarge[0] = 0xff; tooLarge[1] = 0xd8; tooLarge[2] = 0xff;
assert.equal(sandbox.oiUpload_(sessionOf1, {
  requestId: second.requestId, name: 'large.jpg', mimeType: 'image/jpeg', dataB64: tooLarge.toString('base64')
}, 10031).error, 'too-large');

console.log('PASS  office intake server authentication');

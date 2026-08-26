'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Task 5 installation/deployment contract: keep this dependency-free so it
// still runs when the optional Playwright package is unavailable.
const codeSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const officeSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'OfficeIntake.gs'), 'utf8');
const pureSource = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'OfficeIntakePure.gs'), 'utf8');
const readme = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'README_APPS_SCRIPT.md'), 'utf8');
const installGuide = fs.readFileSync(path.join(__dirname, '..', 'APPS_SCRIPT_설치방법.md'), 'utf8');
const REQUIRED_PROPERTIES = new Set([
  'APP_TOKEN', 'DRIVE_FOLDER_ID', 'DATA_FILE_NAME', 'OFFICE_INTAKE_ENABLED',
  'OFFICE_SESSION_SECRET', 'OFFICE_CONFIG_JSON', 'OFFICE_CALENDAR_ID',
]);
function sectionBetween(source, start, end) {
  const begin = source.indexOf(start);
  assert(begin >= 0, 'missing section: ' + start);
  const finish = end ? source.indexOf(end, begin + start.length) : source.length;
  assert(finish >= 0, 'missing section end: ' + end);
  return source.slice(begin, finish);
}
function declaredPropertyKeys(section) {
  const keys = [];
  for (const match of section.matchAll(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/gm)) keys.push(match[1]);
  return new Set(keys);
}
function declaredArray(source, name) {
  const match = source.match(new RegExp('var\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  assert(match, 'missing array: ' + name);
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}
const readmePropertyKeys = declaredPropertyKeys(sectionBetween(readme, '## 배포 전 Script Properties 계약', '## 계정 측 설치·재배포 순서와 live gate'));
const installPropertyKeys = declaredPropertyKeys(sectionBetween(installGuide, '## 4. 스크립트 속성 입력', '## 5. 최초 권한 승인'));
assert.deepEqual(readmePropertyKeys, REQUIRED_PROPERTIES, 'README property declaration must be exact');
assert.deepEqual(installPropertyKeys, REQUIRED_PROPERTIES, 'install property declaration must be exact');
for (const docs of [readme, installGuide]) {
  assert(docs.includes('정확한 문자열 `1`'), 'only exact string 1 enables office intake');
  assert(docs.includes('`0`') && docs.includes('누락'), '0 or absent disables office intake');
}
function assertGateOrder(docs, start, end, deployMarker) {
  const gate = sectionBetween(docs, start, end);
  const disabled = gate.indexOf('OFFICE_INTAKE_ENABLED=0');
  const deployed = gate.indexOf(deployMarker || '배포합니다');
  const health = gate.indexOf('`health`');
  const enabled = gate.indexOf('OFFICE_INTAKE_ENABLED=1');
  const rollback = gate.lastIndexOf('OFFICE_INTAKE_ENABLED=0');
  assert(disabled >= 0 && deployed > disabled && health > deployed && enabled > health && rollback > enabled,
    'flag 0/absent -> deploy -> legacy health -> controlled flag 1 -> immediate rollback order');
}
assertGateOrder(readme, '## 계정 측 설치·재배포 순서와 live gate', '### 롤백');
assertGateOrder(installGuide, '## 6. 웹 앱으로 배포', '## 7-2. 파수꾼 설치', '**배포** 클릭');
assert.deepEqual(new Set(declaredArray(officeSource, 'OI_PUBLIC_ACTIONS')), new Set([
  'officeLogin', 'officeList', 'officeGet', 'officeCreate', 'officeUpdate', 'officeCancel', 'officeUpload',
]));
assert.deepEqual(new Set(declaredArray(officeSource, 'OI_INTERNAL_ACTIONS')), new Set([
  'officeInbox', 'officeAccept', 'officeSetStatus', 'officeAdminUpsert', 'officeRotatePin', 'officeDisable', 'officeRetentionList',
]));
assert.deepEqual(new Set(declaredArray(codeSource, 'ALLOWED_ACTIONS')), new Set([
  'health', 'load', 'save', 'backup', 'upload', 'listFiles', 'thumbnail', 'download',
]));
const postSource = sectionBetween(codeSource, 'function doPost(e)', '/* ---------- Drive 헬퍼 ---------- */');
const publicBranch = postSource.indexOf('if (oiIsPublicAction_(action)) return out_(oiHandlePublicAction_(action, req));');
const tokenBranch = postSource.indexOf('var tk = checkToken_(req.token);');
const internalBranch = postSource.indexOf('if (oiIsInternalAction_(action)) return out_(oiHandleInternalAction_(action, req));');
const legacyBranch = postSource.indexOf("if (ALLOWED_ACTIONS.indexOf(action) < 0)");
assert(publicBranch >= 0 && publicBranch < tokenBranch && tokenBranch < internalBranch && internalBranch < legacyBranch,
  'public -> APP_TOKEN -> internal -> legacy branch order');
assert(!officeSource.includes('APP_TOKEN='));
const publicErrorSection = sectionBetween(readme, '### Public response codes', '### Internal response codes');
const internalErrorSection = sectionBetween(readme, '### Internal response codes', '### Operational records');
const operationalErrorSection = sectionBetween(readme, '### Operational records', '## 배포 전 Script Properties 계약');
const codeTokens = section => [...section.matchAll(/`([a-z][a-z-]+)`/g)].map(m => m[1]).filter(token => token.includes('-'));
const documentedErrors = new Set([...codeTokens(publicErrorSection), ...codeTokens(internalErrorSection), ...codeTokens(operationalErrorSection)]);
const serverSource = codeSource + officeSource + pureSource;
for (const error of documentedErrors) assert(serverSource.includes("'" + error + "'"), 'documented error must exist in source: ' + error);
assert(internalErrorSection.includes('already-linked') && internalErrorSection.includes('slug-conflict') && internalErrorSection.includes('invalid-transition') && internalErrorSection.includes('admin-state-unknown'));
assert(operationalErrorSection.includes('calendar-failed') && operationalErrorSection.includes('성공한 접수'));

const properties = {
  OFFICE_INTAKE_ENABLED: '1',
  OFFICE_SESSION_SECRET: 'TEST_ONLY_SESSION_SECRET_0123456789',
  APP_TOKEN: 'TEST_ONLY_LEGACY_RELAY_TOKEN',
  DRIVE_FOLDER_ID: 'root',
};
const cache = new Map();
const propertyFaults = { onSet: null, onDelete: null };
const cryptoStats = { macCalls: 0, decodeCalls: 0 };
const lockEvents = [];
const drive = { nextId: 1, uuid: 0, files: [], folders: [], failStoreWrites: 0 };
function iterator(items) {
  let index = 0;
  return { hasNext: () => index < items.length, next: () => items[index++] };
}
function makeFolder(name, parent) {
  const folder = {
    id: 'folder-' + drive.nextId++, name, parent,
    getId() { return this.id; },
    getName() { return this.name; },
    getFilesByName(fileName) { return iterator(drive.files.filter(file => !file.trashed && file.parent === this && file.name === fileName)); },
    getFoldersByName(folderName) { return iterator(drive.folders.filter(child => child.parent === this && child.name === folderName)); },
    createFolder(folderName) { const child = makeFolder(folderName, this); drive.folders.push(child); return child; },
    createFile(arg, content, mimeType) {
      const blob = typeof arg === 'string'
        ? { name: arg, bytes: Array.from(Buffer.from(String(content), 'utf8')), mimeType }
        : arg;
      const file = {
        id: 'file-' + drive.nextId++, parent: this, name: blob.name, mimeType: blob.mimeType, trashed: false,
        bytes: Array.from(blob.bytes || []),
        getId() { return this.id; },
        getName() { return this.name; },
        getBlob() { return { getDataAsString: () => Buffer.from(this.bytes).toString('utf8'), getBytes: () => this.bytes.slice() }; },
        setContent(text) {
          if (this.name === '관리사무소접수.json' && drive.failStoreWrites > 0) {
            drive.failStoreWrites--;
            throw new Error('injected-store-write-failure');
          }
          this.bytes = Array.from(Buffer.from(String(text), 'utf8'));
        },
        setTrashed(value) { this.trashed = value === true; },
      };
      drive.files.push(file);
      return file;
    },
  };
  return folder;
}
const driveRoot = makeFolder('root', null);
drive.folders.push(driveRoot);
let fakeNow = 1000;
const SandboxDate = class extends Date { static now() { return fakeNow; } };
function formatDate(date, timezone, pattern) {
  assert.equal(timezone, 'Asia/Seoul');
  assert.equal(pattern, 'yyyyMMdd');
  const pieces = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((out, part) => { out[part.type] = part.value; return out; }, {});
  return pieces.year + pieces.month + pieces.day;
}
function folderPath(folder) {
  const parts = [];
  for (let current = folder; current && current.parent; current = current.parent) parts.unshift(current.name);
  return parts.join('/');
}
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
      setProperty: (key, value) => {
        const mode = propertyFaults.onSet && propertyFaults.onSet(key, String(value));
        if (mode === 'throw-before') throw new Error('injected-property-set-before');
        properties[key] = String(value);
        if (mode === 'throw-after') throw new Error('injected-property-set-after');
        if (mode === 'third-state') { properties[key] = '{"third":"state"}'; throw new Error('injected-property-third-state'); }
      },
      deleteProperty: key => {
        const mode = propertyFaults.onDelete && propertyFaults.onDelete(key);
        if (mode === 'throw-before') throw new Error('injected-property-delete-before');
        delete properties[key];
        if (mode === 'throw-after') throw new Error('injected-property-delete-after');
      },
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
    formatDate,
    newBlob: (bytes, mimeType, name) => ({ bytes: Array.from(bytes), mimeType, name, getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
    getUuid: () => 'req-' + (++drive.uuid),
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      waitLock: timeout => { lockEvents.push('wait:' + timeout); },
      releaseLock: () => { lockEvents.push('release'); },
    }),
  },
  DriveApp: { getFolderById: id => { if (id !== 'root') throw new Error('not-found'); return driveRoot; } },
  Session: { getScriptTimeZone: () => 'Asia/Seoul' },
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

function locked(run) {
  lockEvents.length = 0;
  const result = run();
  assert.deepEqual(lockEvents, ['wait:20000', 'release']);
  return result;
}
function lockedThrow(run, message) {
  lockEvents.length = 0;
  assert.throws(run, new RegExp(message));
  assert.deepEqual(lockEvents, ['wait:20000', 'release']);
}
function postOffice(action, sessionToken, payload) {
  return JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ action, ts: 1000, sessionToken, payload }) } }).getContent());
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
const first = locked(() => sandbox.oiCreate_(sessionOf1, validPayload, 10000));
const replay = locked(() => sandbox.oiCreate_(sessionOf1, validPayload, 10001));
assert.equal(first.receiptNo, 'MM-19700101-0001');
assert.equal(replay.requestId, first.requestId);
assert.equal(sandbox.oiList_(sessionOf2, {}).requests.length, 0);
assert.equal(sandbox.oiGet_(sessionOf2, first.requestId).error, 'not-found');

// Break caught: inherited Object keys must never become image MIME types.
const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');
assert.equal(sandbox.oiUpload_(sessionOf1, {
  requestId: first.requestId, name: 'prototype.bin', mimeType: 'toString', dataB64: jpegB64
}, 10002).error, 'unsupported-type');

// Break caught: receipt allocation must use the configured Korea business day rather than UTC midnight.
const kstBoundary = locked(() => sandbox.oiCreate_(sessionOf1, {
  ...validPayload, idempotencyKey: 'kst-boundary'
}, Date.parse('1970-01-01T15:00:00.000Z')));
assert.equal(kstBoundary.receiptNo, 'MM-19700102-0001');

// Break caught: declared image type and magic bytes must agree, while each allowed image type remains accepted.
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const webpBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
assert.equal(sandbox.oiUpload_(sessionOf1, {
  requestId: first.requestId, name: 'mismatch.jpg', mimeType: 'image/jpeg', dataB64: pngBytes.toString('base64')
}, 10003).error, 'invalid-file');
const photoBatch = locked(() => sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'photo-batch' }, 20000));
const exactTwoMiB = Buffer.alloc(2 * 1024 * 1024);
exactTwoMiB[0] = 0xff; exactTwoMiB[1] = 0xd8; exactTwoMiB[2] = 0xff;
const jpgUpload = locked(() => sandbox.oiUpload_(sessionOf1, {
  requestId: photoBatch.requestId, name: 'exact.jpg', mimeType: 'image/jpeg', dataB64: exactTwoMiB.toString('base64')
}, 20001));
const pngUpload = locked(() => sandbox.oiUpload_(sessionOf1, {
  requestId: photoBatch.requestId, name: 'valid.png', mimeType: 'image/png', dataB64: pngBytes.toString('base64')
}, 20002));
const webpUpload = locked(() => sandbox.oiUpload_(sessionOf1, {
  requestId: photoBatch.requestId, name: 'valid.webp', mimeType: 'image/webp', dataB64: webpBytes.toString('base64')
}, 20003));
assert.equal(jpgUpload.size, 2 * 1024 * 1024);
assert.equal(pngUpload.name, photoBatch.receiptNo + '_02.png');
assert.equal(webpUpload.name, photoBatch.receiptNo + '_03.webp');
const jpgFile = drive.files.find(file => file.id === jpgUpload.fileId);
assert.equal(folderPath(jpgFile.parent), '관리사무소접수/sample-apt/' + photoBatch.receiptNo);
const stored = JSON.parse(drive.files.find(file => file.name === '관리사무소접수.json').getBlob().getDataAsString('UTF-8'));
assert.equal(stored.version, 1);
assert.equal(Array.isArray(stored.requests), true);
const storedPhoto = stored.requests.find(request => request.requestId === photoBatch.requestId).photos[0];
assert.deepEqual(Object.keys(storedPhoto).sort(), ['createdAt', 'fileId', 'mimeType', 'name', 'size']);
assert.equal(storedPhoto.name, photoBatch.receiptNo + '_01.jpg');

// Break caught: allowing a sixth image would bypass the per-request photo limit.
for (let i = 4; i <= 5; i++) {
  assert.equal(locked(() => sandbox.oiUpload_(sessionOf1, {
    requestId: photoBatch.requestId, name: 'photo-' + i + '.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
  }, 20010 + i)).ok, true);
}
assert.equal(locked(() => sandbox.oiUpload_(sessionOf1, {
  requestId: photoBatch.requestId, name: 'six.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 20020)).error, 'too-many-files');

// Break caught: checking encoded text instead of decoded bytes would allow an image above the 2 MiB limit.
const tooLargeRequest = locked(() => sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'too-large' }, 20030));
const tooLarge = Buffer.alloc(2 * 1024 * 1024 + 1);
tooLarge[0] = 0xff; tooLarge[1] = 0xd8; tooLarge[2] = 0xff;
assert.equal(sandbox.oiUpload_(sessionOf1, {
  requestId: tooLargeRequest.requestId, name: 'large.jpg', mimeType: 'image/jpeg', dataB64: tooLarge.toString('base64')
}, 20031).error, 'too-large');
assert.equal(sandbox.oiUpload_(sessionOf2, {
  requestId: first.requestId, name: 'other.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 20032).error, 'not-found');

// Break caught: store-write failure after Drive create must not leave a retry-visible orphan photo.
const compensated = locked(() => sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'compensated' }, 20040));
drive.failStoreWrites = 1;
lockedThrow(() => sandbox.oiUpload_(sessionOf1, {
  requestId: compensated.requestId, name: 'will-fail.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 20041), 'injected-store-write-failure');
assert.equal(drive.files.filter(file => !file.trashed && file.name === compensated.receiptNo + '_01.jpg').length, 0);
assert.equal(locked(() => sandbox.oiUpload_(sessionOf1, {
  requestId: compensated.requestId, name: 'retry.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}, 20042)).ok, true);
assert.equal(drive.files.filter(file => !file.trashed && file.name === compensated.receiptNo + '_01.jpg').length, 1);

// Break caught: explicit null must clear resident contact, and only the owning office may update or cancel while status is mutable.
const editable = locked(() => sandbox.oiCreate_(sessionOf1, {
  ...validPayload, idempotencyKey: 'editable', residentContact: { name: '입주민', phone: '01098765432' }
}, 20050));
assert.equal(locked(() => sandbox.oiUpdate_(sessionOf1, {
  requestId: editable.requestId, description: '입주민 연락처 유지'
}, 20051)).ok, true);
assert.equal(sandbox.oiGet_(sessionOf1, editable.requestId).request.residentContact.name, '입주민');
assert.equal(locked(() => sandbox.oiUpdate_(sessionOf1, {
  requestId: editable.requestId, description: '수정된 설명', residentContact: null
}, 20052)).ok, true);
assert.equal(sandbox.oiGet_(sessionOf1, editable.requestId).request.residentContact, null);
assert.equal(locked(() => sandbox.oiUpdate_(sessionOf2, { requestId: editable.requestId, description: '침입' }, 20053)).error, 'not-found');
assert.equal(locked(() => sandbox.oiCancel_(sessionOf2, { requestId: editable.requestId }, 20054)).error, 'not-found');
assert.equal(locked(() => sandbox.oiCancel_(sessionOf1, { requestId: editable.requestId }, 20055)).status, 'cancelled');
assert.equal(locked(() => sandbox.oiUpdate_(sessionOf1, { requestId: editable.requestId, description: '늦은 수정' }, 20056)).error, 'invalid-status');
assert.equal(locked(() => sandbox.oiCancel_(sessionOf1, { requestId: editable.requestId }, 20057)).error, 'invalid-status');

// Break caught: newest list order is created order, not a later edit time.
const sortOld = locked(() => sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'sort-old' }, 2000000000000));
const sortNew = locked(() => sandbox.oiCreate_(sessionOf1, { ...validPayload, idempotencyKey: 'sort-new' }, 2000000000001));
assert.equal(locked(() => sandbox.oiUpdate_(sessionOf1, { requestId: sortOld.requestId, description: '늦게 수정된 오래된 접수' }, 2000000000100)).ok, true);
assert.equal(sandbox.oiList_(sessionOf1, {}).requests[0].requestId, sortNew.requestId);
const listStore = sandbox.oiReadStore_();
for (let i = 0; i <= 50; i++) {
  listStore.requests.push({
    requestId: 'cap-' + i, receiptNo: 'MM-cap-' + i, officeId: 'of1', unit: '', location: '', issueType: '', pipeType: '', urgency: 'normal',
    description: '', officeContact: {}, residentContact: null, preferredVisitDate: '', photos: [], status: 'pending_review',
    publicAmount: null, visitAt: null, completionReport: null, createdAt: '2040-01-01T00:00:' + String(i).padStart(2, '0') + '.000Z', updatedAt: '2040-01-01T00:00:00.000Z'
  });
}
sandbox.oiWriteStore_(listStore);
const newestFifty = sandbox.oiList_(sessionOf1, {}).requests;
assert.equal(newestFifty.length, 50);
assert.equal(newestFifty[0].requestId, 'cap-50');
assert.equal(newestFifty.some(request => request.requestId === 'cap-0'), false);

// Break caught: public office actions must route through the Task 2 session, not the legacy APP_TOKEN gate.
const routedCreate = postOffice('officeCreate', login.sessionToken, { ...validPayload, idempotencyKey: 'public-route' });
assert.equal(routedCreate.ok, true);
assert.equal(postOffice('officeUpdate', login.sessionToken, {
  requestId: routedCreate.requestId, description: '공개 경로 수정'
}).ok, true);
assert.equal(postOffice('officeUpload', login.sessionToken, {
  requestId: routedCreate.requestId, name: 'route.jpg', mimeType: 'image/jpeg', dataB64: jpegB64
}).ok, true);
assert.equal(postOffice('officeCancel', login.sessionToken, { requestId: routedCreate.requestId }).status, 'cancelled');

// Break caught: removing the APP_TOKEN-protected internal dispatch, idempotent link, or transition guard
// would either expose the inbox or publish a second project / invalid public status.
function postInternal(action, payload) {
  return JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({
    action, ts: fakeNow, token: properties.APP_TOKEN, payload,
  }) } }).getContent());
}
const inboxRoute = postInternal('officeInbox', { updatedAfter: '' });
assert.equal(inboxRoute.ok, true);
assert.equal(inboxRoute.requests.some(request => request.requestId === first.requestId), true);
const linked = postInternal('officeAccept', { requestId: first.requestId, hyeonjangOrderId: 'apt-1' });
assert.equal(linked.ok, true);
assert.equal(postInternal('officeAccept', { requestId: first.requestId, hyeonjangOrderId: 'apt-1' }).hyeonjangOrderId, 'apt-1');
assert.equal(postInternal('officeAccept', { requestId: first.requestId, hyeonjangOrderId: 'apt-2' }).error, 'already-linked');
assert.equal(postInternal('officeSetStatus', {
  requestId: first.requestId, status: 'visit_scheduled', visitAt: '2026-08-27T10:00:00+09:00',
}).status, 'visit_scheduled');
assert.equal(postInternal('officeSetStatus', { requestId: first.requestId, status: 'paid' }).error, 'invalid-transition');

// Break caught: treating a 24-hour-old unreviewed request as current hides an operationally overdue intake.
fakeNow = 20040 + 24 * 60 * 60 * 1000;
const overdue = sandbox.oiInbox_({ updatedAfter: '' });
assert.equal(overdue.requests.find(request => request.requestId === compensated.requestId).overdue, true);
fakeNow = 1000;

// Break caught: retention must be a review list only, with distinct 90-day cancelled and one-year completed eligibility.
const retentionStore = sandbox.oiReadStore_();
retentionStore.requests.push(
  { requestId: 'retained-cancelled', receiptNo: 'MM-retained-cancelled', officeId: 'of1', status: 'cancelled', updatedAt: '1970-01-01T00:00:00.000Z' },
  { requestId: 'retained-completed', receiptNo: 'MM-retained-completed', officeId: 'of1', status: 'completed', completedAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' },
  { requestId: 'legal-record', receiptNo: 'MM-legal-record', officeId: 'of1', status: 'completed', legalRetention: true, completedAt: '1970-01-01T00:00:00.000Z' },
);
sandbox.oiWriteStore_(retentionStore);
fakeNow = Date.parse('1972-01-01T00:00:00.000Z');
const retention = postInternal('officeRetentionList', {});
assert.equal(retention.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(retention.requests.filter(request => request.requestId.indexOf('retained-') === 0))), [
  { requestId: 'retained-cancelled', receiptNo: 'MM-retained-cancelled', officeId: 'of1', status: 'cancelled', retentionReason: 'cancelled-90-days', eligibleAt: '1970-04-01T00:00:00.000Z' },
  { requestId: 'retained-completed', receiptNo: 'MM-retained-completed', officeId: 'of1', status: 'completed', retentionReason: 'completed-1-year', eligibleAt: '1971-01-01T00:00:00.000Z' },
]);
fakeNow = 1000;

// Break caught: a Calendar outage must record a bounded operational error but never turn an urgent receipt into a failure.
sandbox.CalendarApp = { getDefaultCalendar() { throw new Error('calendar-offline'); } };
const urgent = sandbox.oiCreate_(sessionOf1, {
  ...validPayload, idempotencyKey: 'urgent-calendar', urgency: 'urgent', description: 'very-sensitive-description-not-audit',
}, 30000);
assert.equal(urgent.ok, true);
assert.equal(sandbox.oiReadStore_().operationalErrors.some(error => error.code === 'calendar-failed' && error.requestId === urgent.requestId), true);

// Break caught: unresolved sync conflicts keep the linked request actionable, while ordinary completed records stay out of the inbox.
assert.equal(postInternal('officeSetStatus', { requestId: first.requestId, status: 'in_progress' }).status, 'in_progress');
const completed = postInternal('officeSetStatus', {
  requestId: first.requestId, status: 'completed', completionReport: {
    summary: '공개 완료 보고', photoIds: ['published-photo', 'private-photo', 7],
    publicPhotoIds: ['published-photo', 'unrelated-photo', 'private-photo', 9], internalNotes: 'never public',
  },
});
assert.deepEqual(JSON.parse(JSON.stringify(completed.completionReport)), {
  summary: '공개 완료 보고', publicPhotoIds: ['published-photo', 'private-photo'],
});
const completedAt = sandbox.oiReadStore_().requests.find(request => request.requestId === first.requestId).completedAt;
assert.equal(typeof completedAt, 'string');
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.oiGet_(sessionOf1, first.requestId).request.completionReport)), {
  summary: '공개 완료 보고', publicPhotoIds: ['published-photo', 'private-photo'],
});
fakeNow = 2000;
assert.equal(postInternal('officeSetStatus', { requestId: first.requestId, status: 'billed' }).status, 'billed');
fakeNow = 3000;
assert.equal(postInternal('officeSetStatus', { requestId: first.requestId, status: 'paid' }).status, 'paid');
assert.equal(sandbox.oiReadStore_().requests.find(request => request.requestId === first.requestId).completedAt, completedAt);
const inboxStore = sandbox.oiReadStore_();
inboxStore.requests.push({ requestId: 'completed-hidden', receiptNo: 'MM-completed-hidden', officeId: 'of1', status: 'completed', completedAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' });
sandbox.oiWriteStore_(inboxStore);
const filteredInbox = postInternal('officeInbox', { updatedAfter: '' });
assert.equal(filteredInbox.requests.some(request => request.requestId === first.requestId), true);
assert.equal(filteredInbox.requests.some(request => request.requestId === 'completed-hidden'), false);
fakeNow = Date.parse('1972-01-01T00:00:00.000Z');
assert.equal(postInternal('officeRetentionList', {}).requests.some(request => request.requestId === first.requestId && request.status === 'paid' && request.retentionReason === 'completed-1-year'), true);
fakeNow = 1000;

// Break caught: admin mutations must roll back the exact config if the following audit write fails, and PIN entropy must never enter pinSalt.
const configBeforeFailedUpsert = properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
const failedUpsert = postInternal('officeAdminUpsert', { id: 'of-rollback', slug: 'rollback-apt', complexName: '원복 아파트', enabled: true });
assert.equal(failedUpsert.ok, false);
assert.equal(properties.OFFICE_CONFIG_JSON, configBeforeFailedUpsert);
const configBeforeFailedRotate = properties.OFFICE_CONFIG_JSON;
const uuidBeforeFailedRotate = drive.uuid;
drive.failStoreWrites = 1;
const failedRotate = postInternal('officeRotatePin', { officeId: 'of1' });
assert.equal(failedRotate.ok, false);
assert.equal(Object.hasOwn(failedRotate, 'pin'), false);
assert.equal(properties.OFFICE_CONFIG_JSON, configBeforeFailedRotate);
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1001).officeId, 'of1');
assert.equal(sandbox.oiLogin_({ slug: 'sample-apt', pin: '123456' }, 1000).ok, true);
assert.equal(drive.uuid, uuidBeforeFailedRotate + 2);
const configBeforeFailedDisable = properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
const failedDisable = postInternal('officeDisable', { officeId: 'of1' });
assert.equal(failedDisable.ok, false);
assert.equal(properties.OFFICE_CONFIG_JSON, configBeforeFailedDisable);
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1001).officeId, 'of1');

const entropyBeforeRotate = drive.uuid;
const rotated = postInternal('officeRotatePin', { officeId: 'of1' });
assert.equal(rotated.ok, true);
assert.match(rotated.pin, /^\d{6}$/);
const rotatedOffice = JSON.parse(properties.OFFICE_CONFIG_JSON).offices.find(office => office.id === 'of1');
assert.equal(rotatedOffice.pinSalt.includes('req-' + (entropyBeforeRotate + 1)), false);
assert.notEqual(sandbox.oiPinFromUuid_(rotatedOffice.pinSalt), rotated.pin);
assert.equal(JSON.stringify(rotatedOffice).includes(rotated.pin), false);
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1001), null);
const freshLogin = sandbox.oiLogin_({ slug: 'sample-apt', pin: rotated.pin }, 1000);
assert.equal(freshLogin.ok, true);
assert.equal(postInternal('officeAdminUpsert', { id: 'of-conflict', slug: 'sample-apt', complexName: '중복 단지', enabled: true }).error, 'slug-conflict');

// Break caught: active->disabled upsert must invalidate sessions, enabling later must not revive them, and disable keeps requests.
assert.equal(postInternal('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: false }).ok, true);
assert.equal(sandbox.oiVerifySession_(freshLogin.sessionToken, 1001), null);
assert.equal(postInternal('officeAdminUpsert', { id: 'of1', slug: 'sample-apt', complexName: '예시 아파트', enabled: true }).ok, true);
assert.equal(sandbox.oiVerifySession_(freshLogin.sessionToken, 1001), null);
const enabledLogin = sandbox.oiLogin_({ slug: 'sample-apt', pin: rotated.pin }, 1000);
assert.equal(enabledLogin.ok, true);
const beforeDisableCount = sandbox.oiReadStore_().requests.length;
assert.equal(postInternal('officeDisable', { officeId: 'of1' }).ok, true);
assert.equal(sandbox.oiVerifySession_(enabledLogin.sessionToken, 1001), null);
assert.equal(sandbox.oiLogin_({ slug: 'sample-apt', pin: rotated.pin }, 1002).error, 'invalid-credentials');
assert.equal(sandbox.oiReadStore_().requests.length, beforeDisableCount);

// Break caught: an unresolved sync error advances the inbox cursor, then a successful matching retry resolves it.
const retryStore = sandbox.oiReadStore_();
retryStore.requests.push({ requestId: 'sync-retry', receiptNo: 'MM-sync-retry', officeId: 'of1', status: 'completed', hyeonjangOrderId: 'apt-sync', updatedAt: '1970-01-01T00:00:00.000Z' });
retryStore.operationalErrors.push({ code: 'already-linked', requestId: 'sync-retry', at: '1970-01-02T00:00:00.000Z' });
sandbox.oiWriteStore_(retryStore);
fakeNow = Date.parse('1970-01-02T00:00:00.000Z');
const retryInbox = postInternal('officeInbox', { updatedAfter: '1970-01-01T12:00:00.000Z' });
assert.equal(retryInbox.requests.some(request => request.requestId === 'sync-retry'), true);
assert.equal(retryInbox.operationalErrors.some(error => JSON.stringify(error).includes('010-1234-5678')), false);
assert.equal(postInternal('officeAccept', { requestId: 'sync-retry', hyeonjangOrderId: 'apt-sync' }).ok, true);
assert.equal(postInternal('officeInbox', { updatedAfter: '1970-01-01T12:00:00.000Z' }).requests.some(request => request.requestId === 'sync-retry'), false);
fakeNow = 1000;

// Break caught: a failed internal status sync must persist only a safe retry record, then a valid status resolves that exact retry.
const statusRetryStore = sandbox.oiReadStore_();
statusRetryStore.requests.push({ requestId: 'status-retry', receiptNo: 'MM-status-retry', officeId: 'of1', status: 'accepted', updatedAt: '1970-01-01T00:00:00.000Z' });
sandbox.oiWriteStore_(statusRetryStore);
fakeNow = Date.parse('1970-01-02T00:00:00.000Z');
assert.equal(postInternal('officeSetStatus', { requestId: 'status-retry', status: 'paid' }).error, 'invalid-transition');
const statusRetryError = sandbox.oiReadStore_().operationalErrors.find(error => error.requestId === 'status-retry' && error.code === 'invalid-transition');
assert.deepEqual(Object.keys(statusRetryError).sort(), ['at', 'code', 'requestId']);
assert.equal(postInternal('officeInbox', { updatedAfter: '1970-01-01T12:00:00.000Z' }).requests.some(request => request.requestId === 'status-retry'), true);
assert.equal(postInternal('officeSetStatus', { requestId: 'status-retry', status: 'visit_scheduled' }).status, 'visit_scheduled');
assert.equal(postInternal('officeInbox', { updatedAfter: '1970-01-01T12:00:00.000Z' }).requests.some(request => request.requestId === 'status-retry'), false);
const failedStatusStore = sandbox.oiReadStore_();
failedStatusStore.requests.push({ requestId: 'status-write-fail', receiptNo: 'MM-status-write-fail', officeId: 'of1', status: 'accepted', updatedAt: '1970-01-01T00:00:00.000Z' });
sandbox.oiWriteStore_(failedStatusStore);
drive.failStoreWrites = 1;
lockedThrow(() => sandbox.oiSetStatus_({ requestId: 'status-write-fail', status: 'paid' }, fakeNow), 'injected-store-write-failure');
assert.equal(sandbox.oiReadStore_().operationalErrors.some(error => error.requestId === 'status-write-fail'), false);
fakeNow = 1000;

// Break caught: public completion photos require a non-empty owned photo list and are always a strict, bounded subset.
function completionCase(id) {
  const store = sandbox.oiReadStore_();
  store.requests.push({ requestId: id, receiptNo: 'MM-' + id, officeId: 'of1', status: 'in_progress', updatedAt: '1970-01-01T00:00:00.000Z' });
  sandbox.oiWriteStore_(store);
}
completionCase('public-missing');
assert.equal(sandbox.oiSetStatus_({ requestId: 'public-missing', status: 'completed', completionReport: { publicPhotoIds: ['owned'] } }, 4000).error, 'invalid-completion-photos');
completionCase('public-empty');
assert.equal(sandbox.oiSetStatus_({ requestId: 'public-empty', status: 'completed', completionReport: { photoIds: [], publicPhotoIds: ['owned'] } }, 4001).error, 'invalid-completion-photos');
completionCase('public-unrelated');
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.oiSetStatus_({ requestId: 'public-unrelated', status: 'completed', completionReport: {
  photoIds: ['owned'], publicPhotoIds: ['other'], internalNotes: 'private note',
} }, 4002).completionReport)), { summary: '', publicPhotoIds: [] });
completionCase('public-subset');
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.oiSetStatus_({ requestId: 'public-subset', status: 'completed', completionReport: {
  photoIds: ['owned', 'x'.repeat(161), 3], publicPhotoIds: ['owned', 'owned', 'x'.repeat(161), 8], internalNotes: 'private note',
} }, 4003).completionReport)), { summary: '', publicPhotoIds: ['owned'] });
assert.equal(JSON.stringify(sandbox.oiGet_({ officeId: 'of1' }, 'public-subset').request.completionReport).includes('private note'), false);

// Break caught: config compensation classifies restored, staged, unknown, and absent-property states without leaking a PIN in failed paths.
const recovery = postInternal('officeAdminUpsert', { id: 'of-recovery', slug: 'recovery-apt', complexName: '복구 단지', enabled: true });
assert.equal(recovery.ok, true);
const priorRecoveryConfig = properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
propertyFaults.onSet = (key, value) => key === 'OFFICE_CONFIG_JSON' && value === priorRecoveryConfig ? 'throw-after' : null;
const restoredDespiteThrow = postInternal('officeRotatePin', { officeId: 'of-recovery' });
propertyFaults.onSet = null;
assert.equal(restoredDespiteThrow.ok, false);
assert.equal(properties.OFFICE_CONFIG_JSON, priorRecoveryConfig);
assert.equal(Object.hasOwn(restoredDespiteThrow, 'pin'), false);

const priorPartialConfig = properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
propertyFaults.onSet = (key, value) => key === 'OFFICE_CONFIG_JSON' && value === priorPartialConfig ? 'throw-before' : null;
const partialRotate = postInternal('officeRotatePin', { officeId: 'of-recovery' });
propertyFaults.onSet = null;
assert.equal(partialRotate.ok, true);
assert.equal(partialRotate.warning, 'audit-failed');
assert.match(partialRotate.pin, /^\d{6}$/);
assert.notEqual(properties.OFFICE_CONFIG_JSON, priorPartialConfig);
assert.equal(sandbox.oiLogin_({ slug: 'recovery-apt', pin: partialRotate.pin }, 1000).ok, true);

const priorUnknownConfig = properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
propertyFaults.onSet = (key, value) => key === 'OFFICE_CONFIG_JSON' && value === priorUnknownConfig ? 'third-state' : null;
const unknownRotate = postInternal('officeRotatePin', { officeId: 'of-recovery' });
propertyFaults.onSet = null;
assert.equal(unknownRotate.error, 'admin-state-unknown');
assert.equal(Object.hasOwn(unknownRotate, 'pin'), false);
assert.equal(properties.OFFICE_CONFIG_JSON, '{"third":"state"}');

delete properties.OFFICE_CONFIG_JSON;
drive.failStoreWrites = 1;
propertyFaults.onDelete = key => key === 'OFFICE_CONFIG_JSON' ? 'throw-after' : null;
const absentRestore = postInternal('officeAdminUpsert', { id: 'of-absent', slug: 'absent-apt', complexName: '없음 복구', enabled: true });
propertyFaults.onDelete = null;
assert.equal(absentRestore.ok, false);
assert.equal(Object.hasOwn(properties, 'OFFICE_CONFIG_JSON'), false);
properties.OFFICE_CONFIG_JSON = priorUnknownConfig;

// Break caught: audit data must remain metadata-only even after requests containing private values and a returned PIN.
const finalStore = sandbox.oiReadStore_();
assert.equal(finalStore.audit.length > 0, true);
for (const row of finalStore.audit) assert.deepEqual(Object.keys(row).sort(), ['action', 'at', 'officeId', 'receiptNo', 'result']);
const auditText = JSON.stringify(finalStore.audit);
assert.equal(auditText.includes('very-sensitive-description-not-audit'), false);
assert.equal(auditText.includes('010-1234-5678'), false);
assert.equal(auditText.includes(rotated.pin), false);
assert.equal(auditText.includes(freshLogin.sessionToken), false);
assert.equal(auditText.includes(jpegB64), false);

console.log('PASS  office intake server authentication');

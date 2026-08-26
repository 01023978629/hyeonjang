'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const properties = {
  OFFICE_INTAKE_ENABLED: '1',
  OFFICE_SESSION_SECRET: 'TEST_ONLY_SESSION_SECRET_0123456789',
  APP_TOKEN: 'TEST_ONLY_LEGACY_RELAY_TOKEN',
};
const cache = new Map();
function stubMac(text, key) {
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
  Date: { now: () => 1000 },
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
    base64DecodeWebSafe: value => Array.from(Buffer.from(String(value), 'base64url')),
    newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
  },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
  DriveApp: {},
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
const login = sandbox.oiLogin_({ slug: 'sample-apt', pin: '123456' }, 1000);
assert.equal(login.ok, true);
assert.equal(login.office.complexName, '예시 아파트');
assert.equal(Object.hasOwn(login.office, 'pinHash'), false);
assert.equal(Object.hasOwn(login.office, 'pinSalt'), false);
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1001).officeId, 'of1');
assert.equal(sandbox.oiVerifySession_(login.sessionToken, 1000 + 8 * 60 * 60 * 1000 + 1), null);

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

console.log('PASS  office intake server authentication');

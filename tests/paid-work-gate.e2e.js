'use strict';
/* Task 1 commercial transport ownership. This catches envelope drift that
   could leak OfficeOps device/mutation fields into paid-work approval calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFunction(name) {
  const match = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(match, 'missing ' + name);
  const paramsStart = source.indexOf('(', match.index + match[0].length - 1);
  let params = 0, open = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === '(') params += 1;
    if (source[i] === ')' && --params === 0) { open = source.indexOf('{', i); break; }
  }
  assert.ok(open >= 0, name + ' body missing');
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(match.index, i + 1);
  }
  assert.fail(name + ' body is unbalanced');
}

const calls = [];
const sandbox = {
  Date, JSON, Object, Error,
  fetch: async (url, init) => {
    calls.push({ url, init: { ...init, body: JSON.parse(init.body) } });
    return { ok: true, json: async () => ({ ok: true, receiptId: 'receipt-1' }) };
  }
};
vm.createContext(sandbox);
vm.runInContext("const __commercialApproval={url:'https://commercial.example/approve',token:'approval-token',lastTrustedNow:null};", sandbox);
for (const name of ['commercialEnvelope', 'postIsolated', 'commercialError', 'commercialCall']) vm.runInContext(extractFunction(name), sandbox);

(async () => {
  const result = await vm.runInContext("commercialCall('commercialNow',{subjectId:'paid-order-1'})", sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true, receiptId: 'receipt-1' }, 'commercial response comes from the isolated POST');
  assert.equal(calls.length, 1, 'commercial call performs exactly one POST');
  assert.equal(calls[0].url, 'https://commercial.example/approve', 'commercial call uses only the commercial approval URL');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].init)), {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: { token: 'approval-token', action: 'commercialNow', timestamp: calls[0].init.body.timestamp, payload: { subjectId: 'paid-order-1' } }
  }, 'actual commercial POST has exactly the isolated four-field envelope');
  assert.match(calls[0].init.body.timestamp, /^\d{4}-\d{2}-\d{2}T/, 'commercial timestamp is ISO-8601');
  for (const forbidden of ['deviceId', 'mutationId', 'ts']) assert.equal(Object.hasOwn(calls[0].init.body, forbidden), false, 'commercial POST excludes ' + forbidden);
  console.log('PASS  commercial approval POST remains separate from OfficeOps');
})().catch(error => { console.error('FAIL', error && error.stack || error); process.exitCode = 1; });

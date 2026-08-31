'use strict';
/* Task 1 commercial transport ownership.  This catches envelope drift that
   could leak OfficeOps device/mutation fields into paid-work approval calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const match = /function commercialEnvelope\s*\(/.exec(source);
assert.ok(match, 'missing commercialEnvelope');
const open = source.indexOf('{', match.index + match[0].length);
let depth = 0, end = -1;
for (let i = open; i < source.length; i += 1) {
  if (source[i] === '{') depth += 1;
  if (source[i] === '}' && --depth === 0) { end = i + 1; break; }
}
assert.ok(end > open, 'commercialEnvelope body is balanced');
const sandbox = { Date, Object };
vm.createContext(sandbox);
vm.runInContext(source.slice(match.index, end), sandbox);
const envelope = vm.runInContext("commercialEnvelope('approval-token','commercialNow',{subjectId:'paid-order-1'})", sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(envelope)), {
  token: 'approval-token', action: 'commercialNow', timestamp: envelope.timestamp, payload: { subjectId: 'paid-order-1' }
}, 'commercial approval uses exactly its four-field transport envelope');
assert.match(envelope.timestamp, /^\d{4}-\d{2}-\d{2}T/, 'commercial timestamp is ISO-8601');
for (const forbidden of ['deviceId', 'mutationId', 'ts']) assert.equal(Object.hasOwn(envelope, forbidden), false, 'commercial envelope excludes ' + forbidden);
assert.match(source, /async function commercialCall\(action,payload\)[\s\S]*?commercialEnvelope\(__commercialApproval\.token,action,payload\)/, 'commercial call must use its isolated envelope');
console.log('PASS  commercial approval envelope remains separate from OfficeOps');

/* Explicit test-protection audit. Only synthetic HTML is mutated in memory. */
'use strict';
const assert = require('node:assert/strict');
const { spawnSync, spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const cases = [
  ['portal-apply-notify', 'portal-key.e2e.js', /FAIL\s+⑪/],
  ['portal-idb-reject', 'portal-key.e2e.js', /FAIL\s+⑪/],
  ['warranty-stale-photo', 'warranty-v313.e2e.js', /FAIL\s+⑤\(⑦\)/],
  ['online-flush', 'office-intake-auto-sync.e2e.js', /online keeps its queue flush/],
  ['boot-wait', 'test-stability.unit.js', /completed boot leaves exactly the online-triggered flush/]
];
const checkServer = () => new Promise((resolve, reject) => {
  const request = http.get('http://127.0.0.1:8299/index.html', response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', part => { body += part; });
    response.on('end', () => {
      if (response.statusCode !== 200) return resolve(false);
      const normalize = text => text.replace(/\r\n/g, '\n');
      if (normalize(body) !== normalize(fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) return reject(new Error('8299 serves a different checkout; leave that server untouched'));
      resolve(true);
    });
  });
  request.setTimeout(1500, () => request.destroy()); request.on('error', () => resolve(false));
});
function execute(file, mode) {
  const result = spawnSync(process.execPath, [path.join('tests', file)], { cwd: root, env: { ...process.env, HJ_TEST_STABILITY_MUTATION: mode }, encoding: 'utf8', timeout: 180000 });
  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  assert(!result.error && !result.signal, 'test execution error: ' + file);
  assert(!/mutation anchor missing|unknown stability mutation|Cannot find module|ECONNREFUSED|Executable doesn't exist/.test(output), 'test infrastructure error: ' + file + '\n' + output);
  return { status: result.status, output };
}
(async () => {
  let server;
  try {
    if (!await checkServer()) {
      server = spawn(process.execPath, ['tests/static-server.js'], { cwd: root, stdio: 'ignore' });
      let ready = false;
      for (let i = 0; i < 30 && !ready; i++) { await new Promise(resolve => setTimeout(resolve, 100)); ready = await checkServer(); }
      assert(ready, 'synthetic test server unavailable');
    }
    for (const file of new Set(cases.map(row => row[1]))) {
      const result = execute(file, '');
      assert.equal(result.status, 0, 'baseline failed: ' + file + '\n' + result.output);
      console.log('BASELINE ' + file);
    }
    for (const [mode, file, reason] of cases) {
      const result = execute(file, mode);
      assert.equal(result.status, 1, 'protection removal escaped detection: ' + mode + '\n' + result.output);
      assert(reason.test(result.output), 'not the intended behavioral failure: ' + mode + '\n' + result.output);
      console.log('DETECTED ' + mode);
    }
    console.log('test-stability mutations: ' + cases.length + '/' + cases.length + ' DETECTED');
  } finally { if (server) server.kill(); }
})().catch(error => { console.error('FAIL stability mutation audit:', error.stack); process.exitCode = 1; });

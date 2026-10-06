'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const expected = { photos: 'photos virtual photo must expose a menu', project: 'project virtual photo must expose a menu',
  mobile: 'photos virtual photo must expose a menu', sheet: 'virtual photo offers delete without local-only tools' };
for (const mutation of ['photos', 'project', 'mobile', 'sheet']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'photo-delete-access.e2e.js')], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, HJ_DELETE_ACCESS_MUTATION: mutation },
    encoding: 'utf8', timeout: 180000, maxBuffer: 1048576
  });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 1 || !out.includes('AssertionError') || !out.includes(expected[mutation]) || out.includes('unique mutation anchor')) { console.error('UNDETECTED / INFRA FAILURE ' + mutation, out, r.error || ''); process.exit(1); }
  console.log('DETECTED ' + mutation + ': ' + out.split('\n').find(s => s.includes('AssertionError')));
}
console.log('PASS 4/4 negative controls');

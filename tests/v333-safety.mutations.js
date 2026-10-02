/* Negative controls for restore identity and read-only conflict preview.
   Mutates responses in memory only. Owns only a server it starts itself. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), { spawn, spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..'), url = 'http://127.0.0.1:8299/index.html';
async function read() { try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; } catch (_) { return null; } }
let child;
(async () => {
  let body = await read();
  if (!body) {
    child = spawn(process.execPath, ['tests/static-server.js'], { cwd: root, stdio: 'ignore' });
    for (let i = 0; i < 40 && !body; i++) { await new Promise(r => setTimeout(r, 250)); body = await read(); }
  }
  if (!body || !body.equals(fs.readFileSync(path.join(root, 'index.html')))) throw new Error('local server must serve this exact worktree');
  const jobs = [
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'ignore-drive', 'a different Drive original never inherits'],
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'last-key', 'merge matches by Drive identity'],
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'collapse-drive', 'empty-device restore preserves'],
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'ignore-hash', 'different verified original hashes'],
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'skip-exact-priority', 'an earlier raw alias cannot consume'],
    ['file-identity.e2e.js', 'HJ_FILE_IDENTITY_MUTATION', 'select-key', 'selective restore cannot cross'],
    ['sync-conflict-preview.e2e.js', 'HJ_CONFLICT_PREVIEW_MUTATION', 'skip-local', 'local edits while loading invalidate'],
    ['sync-conflict-preview.e2e.js', 'HJ_CONFLICT_PREVIEW_MUTATION', 'skip-connection', 'URL, token and revision changes'],
    ['sync-conflict-preview.e2e.js', 'HJ_CONFLICT_PREVIEW_MUTATION', 'skip-document', 'closing and reopening the modal'],
    ['sync-conflict-preview.e2e.js', 'HJ_CONFLICT_PREVIEW_MUTATION', 'write-on-read', 'preview summarizes changes without'],
    ['sync-conflict-preview.e2e.js', 'HJ_CONFLICT_PREVIEW_MUTATION', 'expose-records', 'preview summarizes changes without']
  ];
  for (const [file, env, mutation, expected] of jobs) {
    const r = spawnSync(process.execPath, [path.join(__dirname, file)], { cwd: root, env: { ...process.env, [env]: mutation }, timeout: 90000, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status !== 1 || !out.includes('FAIL ' + expected)) throw new Error('UNDETECTED / INFRA FAILURE ' + mutation + '\n' + out + '\n' + (r.error || ''));
    console.log('DETECTED ' + mutation + ': ' + out.split('\n').find(l => l.startsWith('FAIL ' + expected)));
  }
  console.log('PASS ' + jobs.length + '/' + jobs.length + ' v333 safety mutations detected by behavioral assertions');
})().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });

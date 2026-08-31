import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXED_BASE = 'f44fa5727064b8cba2e1e339f646dd7598b35442';

export const ALLOWED_PATHS = Object.freeze([
  '.github/workflows/deploy-pages.yml',
  '.superpowers/sdd/.gitignore',
  'AGENTS.md',
  'apps-script-commercial/Code.gs',
  'apps-script-commercial/CommercialApproval.gs',
  'apps-script-commercial/CommercialApprovalPure.gs',
  'apps-script-commercial/README_APPS_SCRIPT.md',
  'apps-script-commercial/appsscript.json',
  'apps-script-office-ops/Code.gs',
  'apps-script-office-ops/OfficeOps.gs',
  'apps-script-office-ops/OfficeOpsPure.gs',
  'apps-script-office-ops/README_APPS_SCRIPT.md',
  'apps-script-office-ops/appsscript.json',
  'apps-script-office-ops/conversion-promotion.json',
  'docs/superpowers/plans/2026-08-31-commercial-approval-relay.md',
  'docs/superpowers/plans/2026-08-31-hyeonjang-office-ops.md',
  'docs/superpowers/plans/2026-08-31-office-ops-relay.md',
  'scripts/verify-office-ops-branch-scope.mjs',
  'tests/commercial-approval-isolation.check.js',
  'tests/commercial-approval-server.unit.js',
  'tests/commercial-approval.unit.js',
  'tests/office-ops-pure.unit.js',
  'tests/office-ops-server-isolation.check.js',
  'tests/office-ops-server.unit.js',
  'tests/mobile-list.e2e.js',
  'tests/pages-artifact.e2e.js'
]);

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_PATH_SET = new Set(ALLOWED_PATHS);

export function normalizeGitPath(value) {
  return String(value == null ? '' : value).replace(/\\/g, '/');
}

function isRepositoryRelativePath(value) {
  if (!value || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return false;
  const segments = value.split('/');
  return segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

export function unionChangeLayers(layers) {
  const recordsByPath = new Map();
  for (const layerName of ['committed', 'staged', 'unstaged', 'untracked']) {
    const entries = layers && Array.isArray(layers[layerName]) ? layers[layerName] : [];
    for (const entry of entries) {
      const normalizedPath = normalizeGitPath(entry && entry.path);
      let record = recordsByPath.get(normalizedPath);
      if (!record) {
        record = { path: normalizedPath, statuses: new Set(), layers: new Set() };
        recordsByPath.set(normalizedPath, record);
      }
      record.statuses.add(String(entry && entry.status || ''));
      record.layers.add(layerName);
    }
  }
  return Array.from(recordsByPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

export function classifyScopeChanges(records, baselinePaths = new Set()) {
  const allowed = [];
  const rejected = [];
  for (const record of records || []) {
    const normalizedPath = normalizeGitPath(record && record.path);
    const statuses = record && record.statuses instanceof Set
      ? new Set(record.statuses)
      : new Set(record && record.statuses || []);
    const layers = record && record.layers instanceof Set
      ? new Set(record.layers)
      : new Set(record && record.layers || []);
    const onlyAdditionOrModification = statuses.size > 0 && Array.from(statuses).every(status => status === 'A' || status === 'M');
    const deletesBaseline = baselinePaths.has(normalizedPath) && statuses.has('D');
    const classified = { path: normalizedPath, statuses, layers };
    if (
      isRepositoryRelativePath(normalizedPath) &&
      ALLOWED_PATH_SET.has(normalizedPath) &&
      onlyAdditionOrModification &&
      !deletesBaseline
    ) {
      allowed.push(classified);
    } else {
      rejected.push(classified);
    }
  }
  return { allowed, rejected };
}

export function formatRejectedPaths(records) {
  const digests = (records || []).map(record => createHash('sha256')
    .update(normalizeGitPath(record && record.path), 'utf8')
    .digest('hex'))
    .sort();
  return ['rejected-path-count: ' + digests.length]
    .concat(digests.map(digest => '[REDACTED_PATH] ' + digest))
    .join('\n');
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: REPOSITORY_ROOT,
    encoding: null,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 || result.error || !Buffer.isBuffer(result.stdout)) throw new Error('git-failed');
  return result.stdout;
}

function parseZeroSeparated(buffer) {
  const values = buffer.toString('utf8').split('\0');
  if (values[values.length - 1] === '') values.pop();
  return values;
}

function parseNameStatus(buffer) {
  const values = parseZeroSeparated(buffer);
  if (values.length % 2 !== 0) throw new Error('git-failed');
  const records = [];
  for (let index = 0; index < values.length; index += 2) {
    const status = values[index];
    const path = values[index + 1];
    if (!/^[A-Z][0-9]*$/.test(status) || !path) throw new Error('git-failed');
    records.push({ status: status.charAt(0), path });
  }
  return records;
}

function verifyBranchScope() {
  try {
    runGit(['cat-file', '-e', FIXED_BASE + '^{commit}']);
  } catch (_) {
    process.stdout.write('scope-verifier:base-unavailable\n');
    return 2;
  }

  try {
    const baselinePaths = new Set(parseZeroSeparated(runGit(['ls-tree', '-r', '--name-only', '-z', FIXED_BASE]))
      .map(normalizeGitPath));
    const layers = {
      committed: parseNameStatus(runGit(['diff', '--name-status', '--no-renames', '-z', FIXED_BASE + '...HEAD'])),
      staged: parseNameStatus(runGit(['diff', '--cached', '--name-status', '--no-renames', '-z'])),
      unstaged: parseNameStatus(runGit(['diff', '--name-status', '--no-renames', '-z'])),
      untracked: parseZeroSeparated(runGit(['ls-files', '--others', '--exclude-standard', '-z']))
        .map(path => ({ status: 'A', path }))
    };
    const classified = classifyScopeChanges(unionChangeLayers(layers), baselinePaths);
    if (classified.rejected.length > 0) {
      process.stdout.write(formatRejectedPaths(classified.rejected) + '\n');
      return 1;
    }
    const changedPaths = new Set(classified.allowed.map(record => record.path));
    process.stdout.write(ALLOWED_PATHS.filter(path => changedPaths.has(path)).join('\n') + '\n');
    return 0;
  } catch (_) {
    process.stdout.write('scope-verifier:git-failed\n');
    return 2;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) process.exitCode = verifyBranchScope();

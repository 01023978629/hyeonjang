/* pages-artifact.e2e.js — GitHub Pages 공개 산출물 허용목록 검사

   보호하는 사고: backup/index_v104_original.html, tests/, apps-script/ 같은
   저장소 내부 파일이 Pages에서 실행·열람 가능한 상태로 배포되는 것. */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hj-pages-artifact-'));
const out = path.join(temp, '_site');
const expected = ['.nojekyll', 'index.html', 'privacy.html', 'sw.js', 'terms.html'];
const assert = (v, m) => { if (!v) throw new Error(m); };

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).replace(/\\/g, '/')];
  });
}

try {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'stage-pages.mjs'), out], {
    cwd: root, encoding: 'utf8'
  });
  assert(run.status === 0, 'Pages staging 실패: ' + String(run.stderr || run.stdout || 'exit ' + run.status).trim());
  const files = walk(out).sort();
  assert(JSON.stringify(files) === JSON.stringify(expected),
    '공개 산출물이 허용목록과 다르다\nwant: ' + expected.join(', ') + '\n got: ' + files.join(', '));
  assert(!fs.existsSync(path.join(out, 'backup', 'index_v104_original.html')), '공개 백업 HTML이 산출물에 포함됐다');
  assert(!fs.existsSync(path.join(out, 'tests')) && !fs.existsSync(path.join(out, 'apps-script')), '내부 테스트/서버 소스가 산출물에 포함됐다');

  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  const guards = [
    'syntax.check.js', 'dead-endpoint.check.js', 'cost-honesty.check.js',
    'version-sync.check.js', 'sw-cache.check.js', 'pages-artifact.e2e.js',
    'ai-high-risk-confirm.e2e.js', 'sensitive-query.e2e.js'
  ];
  const missingGuards = guards.filter(name => !workflow.includes('node tests/' + name));
  assert(missingGuards.length === 0, '배포 전 필수 검사가 빠졌다: ' + missingGuards.join(', '));
  assert(/node\s+scripts\/stage-pages\.mjs\s+_site/.test(workflow), '워크플로가 검증된 staging 스크립트를 실행하지 않는다');
  assert(/path:\s*["']?_site["']?/.test(workflow), 'Pages 업로드 경로가 _site 허용목록 산출물이 아니다');
  assert(/actions\/setup-node@v4/.test(workflow), '보안 E2E용 Node 준비 단계가 없다');
  assert(/playwright[^\n]*(?:install|@)/i.test(workflow), '보안 E2E용 Playwright 설치 단계가 없다');
  assert(/node\s+tests\/static-server\.js[^\n]*&/.test(workflow), '보안 E2E가 사용할 정적 서버 시작 단계가 없다');
  const verifyAt = workflow.indexOf('Verify release guards');
  const stageAt = workflow.indexOf('Stage public site allowlist');
  const uploadAt = workflow.indexOf('Upload site artifact');
  assert(verifyAt >= 0 && verifyAt < stageAt && stageAt < uploadAt, '검증 → staging → upload 순서가 아니다');
  console.log('PASS  Pages 산출물은 앱 셸 5개 파일만 포함');
  console.log('PASS  공개 백업 HTML·tests·apps-script 제외');
  console.log('PASS  배포 워크플로가 _site staging 산출물만 업로드');
  console.log('PASS  배포 전 핵심 검사 6종 + AI/query 보안 E2E 실행 후 staging/upload');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

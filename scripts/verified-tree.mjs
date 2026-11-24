#!/usr/bin/env node
/* 배포 전 전체 검사를 건너뛰어도 되는가 — '같은 내용'이 병합 전 검사를 이미 다 통과했는지 본다(대표 결정 11/24 'B').

   왜: 공개 한 번에 같은 전체 검사가 두 번 돌았다 — PR 검사(verify-release.yml, 중앙 20분)를 통과한 커밋을 병합하면, 배포(deploy-pages.yml)가
   병합 커밋으로 같은 전체 검사를 또 18분 돌렸다. 병합 커밋의 내용(트리)이 PR 검사가 돌린 내용(refs/pull/N/merge 의 트리)과 똑같으면 두 번째는 같은 일을 되풀이할 뿐이다.

   건너뛰는 때(모두 참일 때만 — 하나라도 확인이 안 되면 전체 검사를 돈다):
     ① 이번 배포로 바뀐 파일(BEFORE..HEAD)이 검사 장치를 건드리지 않음: .github/ · tests/run-all.js · package.json · package-lock.json · 이 스크립트
        (검사 장치가 바뀐 공개는 배포 쪽에서도 전체 검사를 한 번 돈다 — 예전 '82개 중 8개만' 사고처럼 게이트가 조용히 줄어드는 일을 막는다)
     ② 지금 커밋의 트리(HEAD^{tree})와 같은 이름의 기록 'verified-tree-<트리>'(verify-release.yml 이 모든 단계를 통과한 뒤에만 남긴다)가 있고 만료 전
     ③ 그 기록을 남긴 실행이 이 저장소(포크 아님 — repository_id == head_repository_id)의 .github/workflows/verify-release.yml · pull_request · success
   그래도 배포 쪽은 빠른 검사(.check.js · .unit.js)를 돈다.

   쓰임(deploy-pages.yml): node scripts/verified-tree.mjs "$GITHUB_OUTPUT" "$BEFORE"   환경: GITHUB_REPOSITORY · GH_TOKEN
   출력: run=<검사한 실행 id>(건너뜀) 또는 run=(전체 검사). 이 스크립트는 실패로 끝나지 않는다 — 무엇이 틀어져도 run= 을 쓰고 0 으로 끝난다. */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const VERIFY_WORKFLOW = '.github/workflows/verify-release.yml';
export const GUARDED_RE = /^(?:\.github\/|tests\/run-all\.js$|package(?:-lock)?\.json$|scripts\/verified-tree\.mjs$)/;
const SHA_RE = /^[0-9a-f]{40}$/;

/* 순수 판단 — api(경로) 는 GitHub REST JSON 을 돌려주는 함수(시험은 가짜). 돌려줌 {run, why}. 던지지 않는다. */
export async function findVerifiedRun({ repo, tree, changed, api }) {
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo || ''))) return { run: '', why: '저장소를 모름' };
    if (!SHA_RE.test(String(tree || ''))) return { run: '', why: '트리를 모름' };
    if (!Array.isArray(changed)) return { run: '', why: '바뀐 파일을 모름' };
    const guarded = changed.find(f => GUARDED_RE.test(String(f)));
    if (guarded) return { run: '', why: '검사 장치가 바뀜(' + guarded + ')' };
    const name = 'verified-tree-' + tree;
    const list = await api(`repos/${repo}/actions/artifacts?name=${name}&per_page=20`);
    for (const art of (list && Array.isArray(list.artifacts) ? list.artifacts : [])) {
      if (!art || art.name !== name || art.expired !== false) continue;
      const wr = art.workflow_run || {};
      if (!wr.id || wr.repository_id == null || wr.repository_id !== wr.head_repository_id) continue;   // 포크에서 온 기록은 믿지 않는다
      const run = await api(`repos/${repo}/actions/runs/${wr.id}`);
      if (run && run.path === VERIFY_WORKFLOW && run.event === 'pull_request' && run.conclusion === 'success'
        && run.repository && run.repository.full_name === repo && run.head_repository && run.head_repository.full_name === repo) {
        return { run: String(run.id), why: '같은 트리가 병합 전 검사 실행 ' + run.id + ' 에서 전체 검사를 통과' };
      }
    }
    return { run: '', why: '같은 트리가 병합 전 검사를 통과한 기록이 없음' };
  } catch (error) {
    return { run: '', why: '확인 실패: ' + String(error && error.message || error).slice(0, 120) };
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function githubApi(path) {
  const base = process.env.VERIFIED_TREE_API_BASE || 'https://api.github.com';   // 시험은 127.0.0.1 가짜 서버
  const res = await fetch(base.replace(/\/$/, '') + '/' + path, {
    headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28',
      ...(process.env.GH_TOKEN ? { authorization: 'Bearer ' + process.env.GH_TOKEN } : {}) },
    signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('GitHub API ' + res.status + ' ' + path.split('?')[0]);
  return res.json();
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const out = argv[0] || env.GITHUB_OUTPUT || '';
  let res;
  try {
    const tree = git(['rev-parse', 'HEAD^{tree}']);
    let before = String(argv[1] || '').trim();
    if (!SHA_RE.test(before) || /^0+$/.test(before)) before = git(['rev-parse', 'HEAD^1']);   // workflow_dispatch·첫 push — 앞 커밋
    const changed = git(['diff', '--name-only', before, 'HEAD']).split('\n').map(s => s.trim()).filter(Boolean);
    res = await findVerifiedRun({ repo: env.GITHUB_REPOSITORY, tree, changed, api: githubApi });
  } catch (error) {
    res = { run: '', why: '확인 실패: ' + String(error && error.message || error).split('\n')[0].slice(0, 120) };
  }
  const line = res.run ? '::notice::배포 전 빠른 검사만 — ' + res.why : '::notice::배포 전 전체 검사 — ' + res.why;
  console.log(line);
  try { if (out) appendFileSync(out, 'run=' + res.run + '\n'); } catch (error) { console.log('::warning::출력 파일에 못 씀 — 전체 검사로 간다'); }
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {}).finally(() => { process.exitCode = 0; });
}

#!/usr/bin/env node
/* 배포 전 전체 검사를 건너뛰어도 되는가 — '같은 내용'이 병합 전 검사를 이미 다 통과했는지 본다(대표 결정 11/24 'B').

   왜: 공개 한 번에 같은 전체 검사가 두 번 돌았다 — PR 검사(verify-release.yml, 중앙 20분)를 통과한 커밋을 병합하면, 배포(deploy-pages.yml)가
   병합 커밋으로 같은 전체 검사를 또 18분 돌렸다. 병합 커밋의 내용(트리)이 PR 검사가 돌린 내용(refs/pull/N/merge 의 트리)과 똑같으면 두 번째는 같은 일을 되풀이할 뿐이다.

   건너뛰는 때(모두 참일 때만 — 하나라도 확인이 안 되면 전체 검사를 돈다):
     ① 지금 커밋(HEAD)이 PR 병합 커밋(부모 둘 — 카톡봇이 'gh pr merge --merge')이고, 그 두 번째 부모(병합된 PR 머리)가 기록을 남긴 실행의 head_sha
        (다른 PR — 닫힌 PR 포함 — 이 미리 남긴 기록은 믿지 않는다)
     ② 마지막으로 공개에 성공한 배포(deploy-pages.yml · main · success)의 커밋이 HEAD 의 조상이고, 그 뒤 바뀐 파일이 검사 장치를 건드리지 않음:
        .github/ · tests/run-all.js · package.json · package-lock.json · 이 스크립트(바로 앞 push 가 아니라 '마지막 성공 배포'와 비교 — 기다리던 배포가
        다음 push 에 밀려 취소되거나 실패해도 그 사이 바뀐 검사 장치를 놓치지 않는다). 이름은 따옴표 없이(core.quotePath=false)·이름 바꿈도 두 쪽 다(--no-renames)
     ③ 지금 커밋의 트리(HEAD^{tree})와 같은 이름의 기록 'verified-tree-<트리>'(verify-release.yml 이 모든 단계를 통과한 뒤에만 남긴다)가 있고 만료 전
     ④ 그 기록을 남긴 실행이 이 저장소(포크 아님 — repository_id == head_repository_id)의 .github/workflows/verify-release.yml · pull_request · success
   그래도 배포 쪽은 빠른 검사(.check.js · .unit.js)를 돈다. PR 검사 쪽 전체 검사가 그대로(인자 없이·조건 없이)인지는 tests/verified-tree.unit.js 가 지킨다.

   쓰임(deploy-pages.yml): node scripts/verified-tree.mjs "$GITHUB_OUTPUT"   환경: GITHUB_REPOSITORY · GH_TOKEN
   출력: run=<검사한 실행 id>(건너뜀) 또는 run=(전체 검사). 이 스크립트는 실패로 끝나지 않는다 — 무엇이 틀어져도 run= 을 쓰고 0 으로 끝난다. */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const VERIFY_WORKFLOW = '.github/workflows/verify-release.yml';
export const DEPLOY_WORKFLOW_FILE = 'deploy-pages.yml';
export const GUARDED_RE = /^(?:"|\.github\/|tests\/run-all\.js$|package(?:-lock)?\.json$|scripts\/verified-tree\.mjs$)/;   // '"' — 따옴표로 싼 이름은 모르는 이름(검사 장치로 본다)
const SHA_RE = /^[0-9a-f]{40}$/;

/* 순수 판단 — api(경로) 는 GitHub REST JSON 을 돌려주는 함수(시험은 가짜). 돌려줌 {run, why}. 던지지 않는다.
   changed = 마지막 성공 배포 이후 바뀐 파일(모르면 null) · prHead = 병합된 PR 머리(HEAD^2, 모르면 '') */
export async function findVerifiedRun({ repo, tree, changed, prHead, api }) {
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo || ''))) return { run: '', why: '저장소를 모름' };
    if (!SHA_RE.test(String(tree || ''))) return { run: '', why: '트리를 모름' };
    if (!SHA_RE.test(String(prHead || ''))) return { run: '', why: 'PR 병합 커밋이 아님(병합된 PR 머리를 모름)' };
    if (!Array.isArray(changed)) return { run: '', why: '마지막 성공 배포 이후 바뀐 파일을 모름' };
    const guarded = changed.find(f => GUARDED_RE.test(String(f)));
    if (guarded) return { run: '', why: '검사 장치가 바뀜(' + guarded + ')' };
    const name = 'verified-tree-' + tree;
    const list = await api(`repos/${repo}/actions/artifacts?name=${name}&per_page=20`);
    for (const art of (list && Array.isArray(list.artifacts) ? list.artifacts : [])) {
      if (!art || art.name !== name || art.expired !== false) continue;
      const wr = art.workflow_run || {};
      if (!wr.id || wr.repository_id == null || wr.repository_id !== wr.head_repository_id) continue;   // 포크에서 온 기록은 믿지 않는다
      if (wr.head_sha && wr.head_sha !== prHead) continue;                                              // 다른 PR 이 남긴 기록
      const run = await api(`repos/${repo}/actions/runs/${wr.id}`);
      if (run && run.path === VERIFY_WORKFLOW && run.event === 'pull_request' && run.conclusion === 'success' && run.head_sha === prHead
        && run.repository && run.repository.full_name === repo && run.head_repository && run.head_repository.full_name === repo) {
        return { run: String(run.id), why: '같은 트리가 병합 전 검사 실행 ' + run.id + ' 에서 전체 검사를 통과' };
      }
    }
    return { run: '', why: '같은 트리·이 PR 머리가 병합 전 검사를 통과한 기록이 없음' };
  } catch (error) {
    return { run: '', why: '확인 실패: ' + String(error && error.message || error).slice(0, 120) };
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function isAncestor(sha) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { stdio: 'ignore' }); return true; } catch (_) { return false; }
}

/* 마지막으로 공개에 성공한 배포의 커밋 — HEAD 의 조상인 것 중 가장 최근. 못 찾으면 ''. */
export async function lastDeployedBase(repo, api, ancestor = isAncestor) {
  const res = await api(`repos/${repo}/actions/workflows/${DEPLOY_WORKFLOW_FILE}/runs?branch=main&status=success&per_page=10`);
  for (const r of (res && Array.isArray(res.workflow_runs) ? res.workflow_runs : [])) {
    if (r && SHA_RE.test(String(r.head_sha || '')) && r.conclusion === 'success' && ancestor(r.head_sha)) return r.head_sha;
  }
  return '';
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
    const repo = env.GITHUB_REPOSITORY;
    const tree = git(['rev-parse', 'HEAD^{tree}']);
    const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).slice(1);
    const prHead = parents.length === 2 ? parents[1] : '';
    let changed = null;
    const base = await lastDeployedBase(repo, githubApi);
    if (base) {
      changed = git(['-c', 'core.quotePath=false', 'diff', '--no-renames', '--name-only', '-z', base, 'HEAD'])
        .split('\0').map(s => s.trim()).filter(Boolean);
    }
    res = await findVerifiedRun({ repo, tree, changed, prHead, api: githubApi });
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

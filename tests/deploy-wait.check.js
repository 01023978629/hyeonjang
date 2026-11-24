/* deploy-wait.check.js — 배포는 올린 사이트 묶음이 목록에 보일 때까지 기다렸다가 (정적 검사, 11/24)

   왜: 11/24 배포 실패 5번이 모두 'Upload site artifact' 가 묶음을 올린 바로 그 초에 'Deploy to GitHub Pages' 가
     'No artifacts named "github-pages"' 로 끝났다(묶음은 실제로 있었다 · 성공한 실행은 1초 뒤 시작). 그 사이에 기다리는 단계를 둔다.
   지키는 것
     ① 순서: Upload site artifact → Wait until the site artifact is listed → Deploy to GitHub Pages
     ② 기다리는 단계는 이 실행(GITHUB_RUN_ID)의 github-pages 묶음만 읽고, 최대 24번(5초 — 2분)까지 · 보이면 조금 더 기다린 뒤 끝
     ③ 이 단계는 실패로 끝나지 않는다 — exit 1·set -e 로 끝나는 명령 없음, 못 보면 ::warning:: 만. 이름에 'Deploy to GitHub Pages' 가 없다
        (카톡봇이 그 이름의 단계만 실패했으면 GitHub 쪽 실패로 보고 다시 돌린다 — 기다리기 실패를 그렇게 보면 안 된다)
     ④ 권한 actions: read(묶음 목록 읽기)
   변이(MUT)를 같은 함수로 돌려 전부 잡히는지 확인한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const WF = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8').replace(/\r\n/g, '\n');
const MUT = {
  'no-wait': ['      - name: Wait until the site artifact is listed', '      - name: Other step'],
  'no-op-wait': ['          for i in $(seq 1 24); do', '          exit 0; for i in $(seq 1 24); do'],
  'wait-fails': ['          echo "::warning::2분이 지나도 github-pages 묶음이 목록에 안 보임 — 그대로 배포를 해 본다"', '          exit 1'],
  'other-run': ['actions/runs/$GITHUB_RUN_ID/artifacts?name=github-pages', 'actions/artifacts?name=github-pages'],
  'forever': ['          for i in $(seq 1 24); do', '          while true; do'],
  'no-actions-read': ['  actions: read   #', '  actions: none   #'],
};

function stepBlock(text, name) {
  const at = text.indexOf('      - name: ' + name + '\n');
  if (at < 0) return null;
  const next = text.indexOf('\n      - name: ', at + 10);
  return text.slice(at, next < 0 ? text.length : next);
}

function check(text) {
  const p = [];
  const up = text.indexOf('      - name: Upload site artifact\n');
  const wait = text.indexOf('      - name: Wait until the site artifact is listed\n');
  const dep = text.indexOf('      - name: Deploy to GitHub Pages\n');
  if (up < 0 || wait < 0 || dep < 0 || !(up < wait && wait < dep)) p.push('① 올리기 → 기다리기 → 배포 순서가 아니다');
  const b = stepBlock(text, 'Wait until the site artifact is listed') || '';
  if (!/actions\/runs\/\$GITHUB_RUN_ID\/artifacts\?name=github-pages/.test(b)) p.push('② 이 실행의 github-pages 묶음만 읽어야 한다');
  if (!/for i in \$\(seq 1 24\); do/.test(b) || /while true/.test(b)) p.push('② 최대 24번(2분)까지만');
  if (!/-ge 1 \] 2>\/dev\/null; then [^\n]*exit 0; fi/.test(b)) p.push('② 보이면 끝나야 한다');
  if (/^\s*exit 0; for i/m.test(b) || /\bexit [1-9]/.test(b) || /set -e/.test(b) || /\|\| *exit/.test(b)) p.push('③ 기다리기 단계가 실패로 끝날 수 있다(또는 아무것도 안 한다)');
  if (!/::warning::/.test(b)) p.push('③ 못 보면 경고만 남겨야 한다');
  if (/Deploy to GitHub Pages/i.test(b.split('\n')[0])) p.push('③ 기다리기 단계 이름에 Deploy to GitHub Pages 가 있다');
  if (/continue-on-error|if:/.test(b)) p.push('③ 조건·continue-on-error 없이 늘 돈다');
  if (!/^\s{2}actions: read\b/m.test(text)) p.push('④ 권한 actions: read');
  return p;
}

const now = check(WF);
assert.deepEqual(now, [], '지금 워크플로: ' + now.join(' · '));
let caught = 0;
for (const [name, [from, to]] of Object.entries(MUT)) {
  assert.equal(WF.split(from).length, 2, 'mutation anchor ' + name);
  const bad = check(WF.replace(from, () => to));
  assert.ok(bad.length > 0, '변이 ' + name + ' 를 못 잡음');
  caught++;
}
console.log('PASS  deploy-wait — 올리기 → 기다리기(최대 2분·실패 없음·이 실행의 묶음만) → 배포 · 변이 ' + caught + '종 모두 잡음');

/* pages-head-guard.unit.js — 공개 직전 머리 확인 (단위 검사, 2026-11-28)

   왜: 11/28 만물웹에서 6초 사이에 병합된 두 PR 의 push 배포 실행이 10분 늦게, 거꾸로(새 커밋 먼저) 만들어졌다. 'pages' 묶음은 만들어진 순서대로
     하나씩 돌리므로 새 커밋이 먼저 공개되고, 기다리던 옛 커밋 실행이 뒤에 옛 트리를 덮어 공개했다(새 PR 내용이 수동 실행 전까지 빠짐).
     현장웹도 같은 'pages' 묶음이다. 공개 직전에 이 커밋이 아직 main 머리인지 보고, 넘어갔으면 공개만 건너뛴다(scripts/pages-head-guard.mjs).
   지키는 것
     ① 판단(decidePublish) — 같으면 공개 · 다르면 건너뜀(로그 'main moved on to <sha> — newer run will publish') · 머리·커밋을 모르면 예전처럼 공개(경고)
     ② 머리 읽기(readMainHead) — API commits/main 을 세 번(사이에 쉼) → 안 되면 git ls-remote → 둘 다 안 되면 모름 · 엉뚱한 답(짧은 값·다른 ref)은 믿지 않음 · 던지지 않음
     ③ 실제 명령 — 127.0.0.1 가짜 API + 임시 저장소(origin = 로컬 bare): 출력 publish/head · 토큰은 Bearer 로 · API 꺼지면 ls-remote · 둘 다 안 되면 공개 · 늘 0 으로 끝남
     ④ 워크플로 — 'pages' 묶음 · cancel-in-progress: false(끊으면 오히려 옛 커밋이 남고 공개 중인 실행도 끊긴다) · push main · workflow_dispatch ·
        머리 확인(id: head)은 검사·Stage 뒤 · 올리기 바로 앞 · 조건·continue-on-error 없이 늘 돈다 · 이름에 'Deploy to GitHub Pages' 없음(카톡봇 규칙) ·
        올리기·기다리기·공개는 if: steps.head.outputs.publish != 'false' 하나만(출력이 없으면 공개 — 'true' 와 같다고 쓰면 확인 못 할 때 공개가 빠진다)
   변이(MUT)는 이 파일 안에서 같은 검사로 돌려 전부 잡히는지 확인한다(①② 는 스크립트 사본을 바꿔 불러 보고, ④ 는 워크플로 글을 바꿔 본다). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const nl = s => s.replace(/\r\n/g, '\n');
const SRC = { script: nl(fs.readFileSync(path.join(ROOT, 'scripts', 'pages-head-guard.mjs'), 'utf8')),
  deploy: nl(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8')) };
const MUT = {
  // ① 판단
  'always-publish': ["  return { publish: false, head: top, level: 'notice',", "  return { publish: true, head: top, level: 'notice',"],
  'unknown-skips': ["if (!SHA_RE.test(top)) return { publish: true, head: '', level: 'warning'", "if (!SHA_RE.test(top)) return { publish: false, head: '', level: 'warning'"],
  'no-log-line': ["why: 'main moved on to ' + top + ' — newer run will publish", "why: '새 커밋이 있음 ' + top + ' — newer run will publish"],
  // ② 머리 읽기
  'no-retry': ['for (let i = 1; i <= tries; i++) {', 'for (let i = 1; i <= 1; i++) {'],
  'no-git-fallback': ["if (m) return { head: m[1], via: 'git' };", "if (m) return { head: '', via: '' };"],
  'loose-ref': ['refs\\/heads\\/main\\s*$/m.exec', 'refs\\/heads\\/main/m.exec'],
  'throw-through': ['} catch (_) { /* 한 번 더 */ }', '} catch (e) { throw e; }'],
  // ④ 워크플로
  'guard-removed': ['        run: node scripts/pages-head-guard.mjs "$GITHUB_OUTPUT"', '        run: echo publish=true >> "$GITHUB_OUTPUT"'],
  'guard-conditional': ['        id: head', "        id: head\n        if: github.event_name == 'push'"],
  'guard-continue': ['        id: head', '        id: head\n        continue-on-error: true'],
  'guard-named-deploy': ['      - name: Check this commit is still the head of main', '      - name: Check before Deploy to GitHub Pages'],
  'upload-unguarded': ["        if: steps.head.outputs.publish != 'false'   # main 이 넘어갔으면 올리지 않는다", '        # (조건 없음)'],
  'deploy-fail-closed': ["        if: steps.head.outputs.publish != 'false'   # 올리기와 같은 조건(11/28)", "        if: steps.head.outputs.publish == 'true'   # 올리기와 같은 조건(11/28)"],
  'cancel-in-progress': ['  cancel-in-progress: false', '  cancel-in-progress: true'],
  'no-dispatch': ['  workflow_dispatch:', '  # workflow_dispatch:'],
};
const WF_MUT = new Set(['guard-removed', 'guard-conditional', 'guard-continue', 'guard-named-deploy', 'upload-unguarded', 'deploy-fail-closed', 'cancel-in-progress', 'no-dispatch']);
const REPO = '01023978629/hyeonjang', A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'phg-'));
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS pages-head-guard ' + name); }
async function load(text, tag) {
  const file = path.join(TMP, 'pages-head-guard-' + tag + '.mjs');
  fs.writeFileSync(file, text);
  return import(pathToFileURL(file).href);
}

function checkDecide({ decidePublish }) {
  let r = decidePublish({ sha: A, head: A });
  assert.deepEqual([r.publish, r.head, r.level], [true, A, 'notice'], '머리 그대로면 공개');
  r = decidePublish({ sha: A, head: B });
  assert.deepEqual([r.publish, r.head], [false, B], 'main 이 넘어갔으면 건너뜀');
  assert.ok(r.why.includes('main moved on to ' + B + ' — newer run will publish'), '로그: ' + r.why);
  for (const head of ['', null, undefined, 'abc', B.toUpperCase(), B + 'x', ' ' + B]) {
    r = decidePublish({ sha: A, head });
    assert.deepEqual([r.publish, r.head, r.level], [true, '', 'warning'], '머리를 모르면 예전처럼 공개: ' + JSON.stringify(head));
  }
  for (const sha of ['', undefined, 'abc']) assert.equal(decidePublish({ sha, head: B }).publish, true, '이 실행의 커밋을 모르면 공개: ' + JSON.stringify(sha));
}

async function checkRead({ readMainHead }) {
  const fake = answers => { const calls = []; return { calls, api: async p => { calls.push(p); const a = answers.shift(); if (a instanceof Error) throw a; return a; } }; };
  let pauses = 0; const pause = async () => { pauses++; };
  const noGit = () => { throw new Error('ls-remote 를 부르면 안 됨'); };
  let f = fake([{ sha: B }]);
  assert.deepEqual(await readMainHead({ repo: REPO, api: f.api, lsRemote: noGit, pause }), { head: B, via: 'api' });
  assert.deepEqual(f.calls, ['repos/' + REPO + '/commits/main']);
  pauses = 0; f = fake([new Error('502'), { sha: 'abc' }, { sha: C }]);
  assert.deepEqual(await readMainHead({ repo: REPO, api: f.api, lsRemote: noGit, pause }), { head: C, via: 'api' }, '세 번째에 읽힘');
  assert.deepEqual([f.calls.length, pauses], [3, 2], '두 번 쉬고 세 번 물음');
  pauses = 0; f = fake([new Error('502'), new Error('502'), {}]);
  assert.deepEqual(await readMainHead({ repo: REPO, api: f.api, lsRemote: () => 'x\n' + C + '\trefs/heads/main\n', pause }), { head: C, via: 'git' }, 'API 가 안 되면 ls-remote');
  assert.equal(pauses, 2);
  f = fake([]);
  assert.deepEqual(await readMainHead({ repo: 'not a repo', api: f.api, lsRemote: () => B + '\trefs/heads/main', pause }), { head: B, via: 'git' }, '저장소 이름이 이상하면 API 는 묻지 않음');
  assert.deepEqual(f.calls, []);
  const bad = [() => C + '\trefs/heads/main-old\n' + C + '\trefs/tags/main\n', () => 'abc\trefs/heads/main\n', () => '', () => { throw new Error('no origin'); }];
  for (const lsRemote of bad)
    assert.deepEqual(await readMainHead({ repo: REPO, api: fake([new Error('x'), new Error('x'), new Error('x')]).api, lsRemote, pause }), { head: '', via: '' }, '엉뚱한 ref·실패는 모름: ' + lsRemote);
}

function checkWorkflow(text) {
  const p = [];
  const steps = text.split(/\n(?=      - name: )/).slice(1).map(t => ({ name: /- name: (.*)/.exec(t)[1].trim(), text: t }));
  const at = n => steps.findIndex(s => s.name === n || s.name.startsWith(n));
  const ifs = s => (s.match(/\n {8}if:.*/g) || []).map(l => l.trim().replace(/\s+#.*$/, ''));
  if (!/\nconcurrency:\n {2}group: pages\n {2}cancel-in-progress: false\n/.test(text)) p.push("④ 'pages' 묶음 · cancel-in-progress: false");
  if (!/\non:\n {2}push:\n {4}branches:\n {6}- main\n/.test(text) || !/\n {2}workflow_dispatch:/.test(text)) p.push('④ push main · workflow_dispatch');
  const iGuard = steps.findIndex(s => /\n {8}id: head\n/.test(s.text));
  const iFull = at('Verify release guards (full suite)'), iQuick = at('Verify release guards (quick'), iStage = at('Stage public site allowlist');
  const iUp = at('Upload site artifact'), iWait = at('Wait until the site artifact is listed'), iDep = at('Deploy to GitHub Pages');
  if ([iGuard, iFull, iQuick, iStage, iUp, iWait, iDep].some(i => i < 0)) { p.push('④ 단계를 못 찾음: ' + JSON.stringify(steps.map(s => s.name))); return p; }
  if (!(iFull < iGuard && iQuick < iGuard && iStage < iGuard && iGuard + 1 === iUp && iUp < iWait && iWait < iDep)) p.push('④ 순서: 검사 → Stage → 머리 확인 → 올리기 → 기다리기 → 공개');
  const g = steps[iGuard];
  if (/deploy to github pages/i.test(g.name)) p.push("④ 머리 확인 단계 이름에 'Deploy to GitHub Pages' 가 있다(카톡봇은 그 이름의 실패를 GitHub 쪽 실패로 본다)");
  if (!/\n {8}run: node scripts\/pages-head-guard\.mjs "\$GITHUB_OUTPUT"\n/.test(g.text + '\n')) p.push('④ 머리 확인은 scripts/pages-head-guard.mjs "$GITHUB_OUTPUT"');
  if (!/\n {10}GH_TOKEN: \$\{\{ github\.token \}\}/.test(g.text)) p.push('④ 머리 확인에 GH_TOKEN');
  if (/\n {8}(?:if|continue-on-error):/.test(g.text)) p.push('④ 머리 확인은 조건·continue-on-error 없이 늘 돈다(스크립트가 실패로 끝나지 않는다)');
  for (const i of [iUp, iWait, iDep]) {
    const got = ifs(steps[i].text);
    if (got.length !== 1 || got[0] !== "if: steps.head.outputs.publish != 'false'") p.push('④ ' + steps[i].name + " 조건은 publish != 'false' 하나만: " + JSON.stringify(got));
  }
  if (!/\n {8}id: deployment\n/.test(steps[iDep].text) || iDep !== steps.length - 1) p.push('④ 공개 단계(id: deployment)가 맨 끝');
  return p;
}

(async () => {
  const real = await load(SRC.script, 'real');

  await test('① 판단 — 머리 그대로면 공개 · 넘어갔으면 건너뜀 · 모르면 예전처럼 공개 (DECIDE)', async () => { checkDecide(real); });

  await test('② 머리 읽기 — API 세 번 → git ls-remote → 모름 · 엉뚱한 답은 믿지 않음 (READ)', async () => { await checkRead(real); });

  await test('③ 실제 명령 — 가짜 API · 임시 저장소 · 출력 publish/head · 늘 0 (CLI)', async () => {
    const bare = path.join(TMP, 'origin.git'), work = path.join(TMP, 'work'), plain = path.join(TMP, 'plain');
    const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    fs.mkdirSync(work); fs.mkdirSync(plain);
    g(TMP, 'init', '-q', '--bare', bare); g(bare, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    g(work, 'init', '-q'); g(work, 'config', 'user.email', 't@example.invalid'); g(work, 'config', 'user.name', 't'); g(work, 'checkout', '-q', '-b', 'main');
    fs.writeFileSync(path.join(work, 'index.html'), 'v1\n'); g(work, 'add', '.'); g(work, 'commit', '-q', '-m', 'A');
    g(work, 'remote', 'add', 'origin', bare); g(work, 'push', '-q', 'origin', 'main');
    const M = g(work, 'rev-parse', 'HEAD');
    let head = A, seen = [];
    const server = http.createServer((req, res) => {
      seen.push([req.url, req.headers.authorization || '']);
      const ok = req.url === '/repos/' + REPO + '/commits/main';
      res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(ok ? { sha: head } : {}));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    // 가짜 서버가 같은 프로세스에 있으니 자식은 비동기로 띄운다(spawnSync 는 서버를 멈춘다)
    const cli = ({ sha, apiBase = base, cwd = work, token = '' }) => new Promise(resolve => {
      const out = path.join(TMP, 'out-' + Math.random().toString(36).slice(2));
      const env = Object.assign({}, process.env, { GITHUB_REPOSITORY: REPO, GITHUB_SHA: sha, GH_TOKEN: token, PAGES_HEAD_GUARD_API_BASE: apiBase, PAGES_HEAD_GUARD_TRIES: '1',
        GIT_TERMINAL_PROMPT: '0' });
      if (cwd === plain) env.GIT_DIR = path.join(plain, 'no-such-git');   // 저장소 밖(위 폴더가 우연히 저장소여도)
      const c = spawn(process.execPath, [path.join(TMP, 'pages-head-guard-real.mjs'), out], { cwd, env });
      let log = ''; c.stdout.on('data', b => { log += b; }); c.stderr.on('data', b => { log += b; });
      c.on('close', status => resolve({ status, out: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '', log }));
    });
    try {
      let r = await cli({ sha: A, token: 't0k' });
      assert.deepEqual([r.status, r.out], [0, 'publish=true\nhead=' + A + '\n'], '머리 그대로: ' + r.log);
      assert.match(r.log, /::notice::main 머리 그대로/);
      assert.deepEqual(seen[0], ['/repos/' + REPO + '/commits/main', 'Bearer t0k'], '토큰은 Bearer 로');
      head = B;
      r = await cli({ sha: A });
      assert.deepEqual([r.status, r.out], [0, 'publish=false\nhead=' + B + '\n'], 'main 이 넘어감: ' + r.log);
      assert.ok(r.log.includes('::notice::main moved on to ' + B + ' — newer run will publish'), r.log);
      r = await cli({ sha: M, apiBase: 'http://127.0.0.1:9' });
      assert.deepEqual([r.status, r.out], [0, 'publish=true\nhead=' + M + '\n'], 'API 가 안 되면 git ls-remote(머리 그대로): ' + r.log);
      assert.match(r.log, /git ls-remote/);
      r = await cli({ sha: A, apiBase: 'http://127.0.0.1:9' });
      assert.deepEqual([r.status, r.out], [0, 'publish=false\nhead=' + M + '\n'], 'API 가 안 되면 git ls-remote(넘어감): ' + r.log);
      r = await cli({ sha: A, apiBase: 'http://127.0.0.1:9', cwd: plain });
      assert.deepEqual([r.status, r.out], [0, 'publish=true\nhead=\n'], '둘 다 안 되면 예전처럼 공개(그래도 0): ' + r.log);
      assert.match(r.log, /::warning::main 머리를 못 읽음/);
    } finally { server.close(); }
  });

  await test("④ 워크플로 — 'pages'·끊지 않음 · 검사 뒤 올리기 바로 앞 · 늘 돎 · 공개 세 단계는 publish != 'false' 하나만 (WORKFLOW)", async () => {
    const now = checkWorkflow(SRC.deploy);
    assert.deepEqual(now, [], '지금 워크플로: ' + now.join(' · '));
  });

  await test('⑤ 변이 — ①②④ 가 ' + Object.keys(MUT).length + '종을 모두 잡음 (MUT)', async () => {
    for (const [name, [from, to]] of Object.entries(MUT)) {
      const key = WF_MUT.has(name) ? 'deploy' : 'script';
      assert.equal(SRC[key].split(from).length, 2, 'mutation anchor ' + name);
      const text = SRC[key].replace(from, () => to);
      let caught = false;
      if (key === 'deploy') caught = checkWorkflow(text).length > 0;
      else {
        const mod = await load(text, 'mut-' + name);
        try { checkDecide(mod); await checkRead(mod); } catch (_) { caught = true; }
      }
      assert.ok(caught, '변이 ' + name + ' 를 못 잡음');
    }
  });

  console.log('pages-head-guard: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL pages-head-guard', e && e.stack || e); process.exit(1); })
  .finally(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });

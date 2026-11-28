/* 배포 때 같은 전체 검사 두 번 줄이기 · PC 빠른 검사 2개 (단위 검사) — 대표 결정(11/24 'B')
   공개 한 번에 같은 전체 검사가 두 번 돌았다(PR 검사 중앙 20분 + 배포 전 18분). 병합 커밋의 내용(트리)이 PR 검사가 돌린 내용과 똑같으면
   배포 쪽은 빠른 검사(.check.js·.unit.js)만 돈다 — 대신 아주 좁게: 하나라도 확인이 안 되면 지금처럼 전체 검사(예전 '82개 중 8개' 사고를 되풀이하지 않게).
   ① 판단(scripts/verified-tree.mjs findVerifiedRun) — 같은 트리 기록 · 이 저장소(포크 아님) · verify-release.yml · pull_request · success · 만료 전 ·
      병합된 바로 그 PR 머리(HEAD^2)의 실행 · 검사 장치(.github/·run-all.js·package*.json·이 스크립트·따옴표 이름)가 바뀐 배포는 묻지도 않고 전체 · API 오류는 전체 (DECIDE)
   ② 실제 명령 — 임시 git 저장소(PR 병합 커밋) + 127.0.0.1 가짜 API: 마지막 성공 배포(조상)와 비교 · 밀려 취소된 배포 사이의 검사 장치 변경도 잡음 ·
      조상이 아닌 배포·병합 아닌 커밋·한글 이름 워크플로·서버 꺼짐은 전체 · 늘 0 으로 끝남 (CLI)
   ③ 워크플로 — 배포: actions:read · 판단 단계가 브라우저 설치·전체 검사 앞 · 둘 다 run 이 비었을 때만 · 빠른 검사는 run 이 있을 때만 · 공개 단계는 조건 없음(11/28 부터 올리기·공개는 머리 확인 조건 하나만) ·
      전체 검사는 그대로 'node tests/run-all.js'(인자 없이) / PR 검사(이제 진짜 관문): 전체 검사가 인자·조건·continue-on-error·|| 없이 · 맨 끝에만 트리 기록 (WORKFLOW)
   ④ PC 빠른 검사 — mutation-anchors 는 playwright 가 없어도 표를 읽는다(이름일 때만 대역) · 고정 파일은 줄끝을 바꾸지 않는다(.gitattributes) (PC)
   변이(VT_MUTATION): no-fork-check·any-conclusion·any-workflow·any-event·no-guard·no-expiry·throw-through·no-head-check·quoted-name 은 ①,
   any-base·no-ancestor-check·parent-one 은 ②, full-always-skipped·quick-wrong-filter·record-always·no-actions-read·verify-full-filtered·
   verify-continue-on-error 는 ③, no-fallback·no-gitattributes·stub-paths-too 는 ④에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SRC = { script: rd('scripts/verified-tree.mjs'), deploy: rd('.github/workflows/deploy-pages.yml'), verify: rd('.github/workflows/verify-release.yml'),
  anchors: rd('tests/mutation-anchors.check.js'), attrs: fs.existsSync(path.join(ROOT, '.gitattributes')) ? rd('.gitattributes') : '' };
const MUT = {
  'no-fork-check': ["if (!wr.id || wr.repository_id == null || wr.repository_id !== wr.head_repository_id) continue;", "if (!wr.id) continue;"],
  'any-conclusion': ["&& run.conclusion === 'success'", ''],
  'any-workflow': ["if (run && run.path === VERIFY_WORKFLOW && run.event", 'if (run && run.event'],
  'any-event': ["run.event === 'pull_request' && run.conclusion", 'run.conclusion'],
  'no-guard': ["if (guarded) return { run: '', why: '검사 장치가 바뀜(' + guarded + ')' };", ''],
  'no-expiry': ["if (!art || art.name !== name || art.expired !== false) continue;", 'if (!art || art.name !== name) continue;'],
  'throw-through': ["return { run: '', why: '확인 실패: ' + String(error && error.message || error).slice(0, 120) };", 'throw error;'],
  'no-head-check': ["&& run.head_sha === prHead", ''],
  'quoted-name': ['export const GUARDED_RE = /^(?:"|\\.github\\/', 'export const GUARDED_RE = /^(?:\\.github\\/'],
  'any-base': ['const base = await lastDeployedBase(repo, githubApi);', "const base = git(['rev-parse', 'HEAD^1']);"],
  'no-ancestor-check': ["&& r.conclusion === 'success' && ancestor(r.head_sha)) return r.head_sha;", "&& r.conclusion === 'success') return r.head_sha;"],
  'parent-one': ["const prHead = parents.length === 2 ? parents[1] : '';", "const prHead = parents[0] || '';"],
  'full-always-skipped': ["        if: steps.verified.outputs.run == ''   # 같은 트리 기록이 없으면", "        if: steps.verified.outputs.run != ''   # 같은 트리 기록이 없으면"],
  'quick-wrong-filter': ['          node tests/run-all.js .check.js .unit.js', '          node tests/run-all.js .unit.js'],
  'record-always': ['      - name: Record the verified tree', '      - name: Record the verified tree\n        if: always()'],
  'no-actions-read': ['  actions: read   # 병합 전 검사 기록', '  # actions: read   # 병합 전 검사 기록'],
  'verify-full-filtered': ['          node tests/run-all.js', '          node tests/run-all.js .check.js .unit.js'],
  'verify-continue-on-error': ['      - name: Verify release guards (full suite)', '      - name: Verify release guards (full suite)\n        continue-on-error: true'],
  'no-fallback': ["if (error && error.code === 'MODULE_NOT_FOUND' && PLAYWRIGHT_ID_RE.test(String(id))) return PLAYWRIGHT_STUB;", ''],
  'no-gitattributes': ['tests/fixtures/vendor/** -text', '# (없음)'],
  'stub-paths-too': ['const PLAYWRIGHT_ID_RE = /^(?:playwright|@playwright\\/[\\w.-]+)$/;', 'const PLAYWRIGHT_ID_RE = /(?:^|[\\\\/])playwright(?:$|[\\\\/])|^@playwright\\//;'],
};
const KEYOF = { 'full-always-skipped': 'deploy', 'quick-wrong-filter': 'deploy', 'no-actions-read': 'deploy', 'record-always': 'verify',
  'verify-full-filtered': 'verify', 'verify-continue-on-error': 'verify', 'no-fallback': 'anchors', 'no-gitattributes': 'attrs', 'stub-paths-too': 'anchors' };
const nl = s => s.replace(/\r\n/g, '\n');
for (const k of Object.keys(SRC)) SRC[k] = nl(SRC[k]);
if (process.env.VT_MUTATION) {
  const name = process.env.VT_MUTATION, m = MUT[name]; assert.ok(m, 'unknown mutation ' + name);
  const key = KEYOF[name] || 'script';
  assert.equal(SRC[key].split(m[0]).length, 2, 'mutation anchor ' + name);
  SRC[key] = SRC[key].replace(m[0], () => m[1]);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-'));
const SCRIPT = path.join(TMP, 'verified-tree.mjs');
fs.writeFileSync(SCRIPT, SRC.script);
const REPO = '01023978629/hyeonjang', TREE = 'a'.repeat(40), HEADSHA = 'd'.repeat(40), RID = 4242;
const art = (o = {}) => Object.assign({ name: 'verified-tree-' + TREE, expired: false, workflow_run: { id: RID, repository_id: 1, head_repository_id: 1, head_sha: HEADSHA } }, o);
const runOf = (o = {}) => Object.assign({ id: RID, path: '.github/workflows/verify-release.yml', event: 'pull_request', conclusion: 'success', head_sha: HEADSHA,
  repository: { full_name: REPO }, head_repository: { full_name: REPO } }, o);

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS verified-tree ' + name); }

(async () => {
  const { findVerifiedRun } = await import(pathToFileURL(SCRIPT).href);
  function fake({ arts = [art()], runs = { [RID]: runOf() }, fail = false } = {}) {
    const calls = [];
    return { calls, api: async p => {
      calls.push(p);
      if (fail) throw new Error('GitHub API 502');
      if (p.startsWith(`repos/${REPO}/actions/artifacts?`)) return { total_count: arts.length, artifacts: arts };
      const m = /actions\/runs\/(\d+)$/.exec(p); if (m) return runs[m[1]];
      throw new Error('unexpected ' + p);
    } };
  }
  const decide = (opts = {}, f = fake()) => findVerifiedRun(Object.assign({ repo: REPO, tree: TREE, prHead: HEADSHA, changed: ['index.html', 'tests/x.unit.js'], api: f.api }, opts));

  await test('① 판단 — 같은 트리·이 저장소·병합된 그 PR 머리·병합 전 검사 성공일 때만, 아니면 전체 검사 (DECIDE)', async () => {
    let f = fake(); let r = await decide({}, f);
    assert.equal(r.run, String(RID), r.why);
    assert.deepEqual(f.calls, [`repos/${REPO}/actions/artifacts?name=verified-tree-${TREE}&per_page=20`, `repos/${REPO}/actions/runs/${RID}`]);
    for (const g of ['.github/workflows/deploy-pages.yml', '.github/workflows/verify-release.yml', 'tests/run-all.js', 'package.json', 'package-lock.json', 'scripts/verified-tree.mjs',
      '"\\353\\260\\260\\355\\217\\254.yml"']) {
      f = fake(); r = await decide({ changed: ['index.html', g] }, f);
      assert.equal(r.run, '', g); assert.deepEqual(f.calls, [], '검사 장치가 바뀌면 묻지도 않는다: ' + g); assert.match(r.why, /검사 장치/);
    }
    assert.equal((await decide({ changed: ['scripts/stage-pages.mjs', 'tests/run-all.unit.js', 'AGENTS.md'] })).run, String(RID), '검사 장치가 아닌 파일');
    const none = [
      ['기록 없음', fake({ arts: [] })], ['만료', fake({ arts: [art({ expired: true })] })], ['만료 모름', fake({ arts: [art({ expired: undefined })] })],
      ['다른 트리 이름', fake({ arts: [art({ name: 'verified-tree-' + 'b'.repeat(40) })] })],
      ['포크', fake({ arts: [art({ workflow_run: { id: RID, repository_id: 1, head_repository_id: 2, head_sha: HEADSHA } })] })],
      ['저장소 모름', fake({ arts: [art({ workflow_run: { id: RID, repository_id: null, head_repository_id: null, head_sha: HEADSHA } })] })],
      ['다른 PR 이 남긴 기록(기록의 머리)', fake({ arts: [art({ workflow_run: { id: RID, repository_id: 1, head_repository_id: 1, head_sha: 'e'.repeat(40) } })] })],
      ['다른 PR 이 남긴 기록(실행의 머리)', fake({ arts: [art({ workflow_run: { id: RID, repository_id: 1, head_repository_id: 1 } })], runs: { [RID]: runOf({ head_sha: 'e'.repeat(40) }) } })],
      ['실패한 실행', fake({ runs: { [RID]: runOf({ conclusion: 'failure' }) } })],
      ['다른 워크플로', fake({ runs: { [RID]: runOf({ path: '.github/workflows/deploy-pages.yml' }) } })],
      ['push 실행', fake({ runs: { [RID]: runOf({ event: 'push' }) } })],
      ['포크 머리', fake({ runs: { [RID]: runOf({ head_repository: { full_name: 'someone/hyeonjang' } }) } })],
      ['다른 저장소', fake({ runs: { [RID]: runOf({ repository: { full_name: 'someone/else' } }) } })],
      ['API 오류', fake({ fail: true })],
    ];
    for (const [why, ff] of none) assert.equal((await decide({}, ff)).run, '', why);
    assert.match((await decide({}, fake({ fail: true }))).why, /확인 실패/);
    for (const bad of [{ repo: '' }, { repo: 'x' }, { tree: 'abc' }, { changed: null }, { prHead: '' }, { prHead: 'abc' }])
      assert.equal((await decide(bad)).run, '', JSON.stringify(bad));
    const two = fake({ arts: [art({ workflow_run: { id: 1, repository_id: 1, head_repository_id: 2, head_sha: HEADSHA } }), art({ workflow_run: { id: 7, repository_id: 1, head_repository_id: 1, head_sha: HEADSHA } })],
      runs: { 7: runOf({ id: 7 }) } });
    assert.equal((await decide({}, two)).run, '7', '포크 기록은 건너뛰고 다음 기록');
  });

  await test('② 실제 명령 — PR 병합 커밋 · 마지막 성공 배포와 비교 · 늘 0 으로 끝남 (CLI)', async () => {
    const repo = path.join(TMP, 'repo'); fs.mkdirSync(repo);
    const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text); };
    g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@example.invalid'); g('config', 'user.name', 't'); g('config', 'core.autocrlf', 'false');
    put('index.html', 'v1\n'); g('add', '.'); g('commit', '-q', '-m', 'A'); const A = g('rev-parse', 'HEAD');
    const pr = (branch, files) => {   // main 에서 갈래 → 커밋 → --no-ff 병합(카톡봇 'gh pr merge --merge' 꼴). 돌려줌 [PR 머리, 병합 커밋]
      g('checkout', '-q', '-b', branch); for (const [rel, text] of files) put(rel, text); g('add', '.'); g('commit', '-q', '-m', branch);
      const head = g('rev-parse', 'HEAD'); g('checkout', '-q', 'main'); g('merge', '-q', '--no-ff', '-m', 'Merge ' + branch, branch);
      return [head, g('rev-parse', 'HEAD')];
    };
    // 갈래 S — 병합되지 않은 커밋(조상이 아닌 배포 흉내)
    g('checkout', '-q', '-b', 'side'); put('index.html', 'side\n'); g('add', '.'); g('commit', '-q', '-m', 'S'); const S = g('rev-parse', 'HEAD'); g('checkout', '-q', 'main');
    const [F1, M1] = pr('f1', [['index.html', 'v2\n']]);
    let deployed = [A], known = new Map([[g('rev-parse', 'M1^{tree}'.replace('M1', M1)), F1]]);
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let body;
      if (u.pathname === `/repos/${REPO}/actions/workflows/deploy-pages.yml/runs`) {
        body = { total_count: deployed.length, workflow_runs: deployed.map((h, i) => ({ id: 900 + i, head_sha: h, conclusion: 'success', status: 'completed' })) };
      } else if (u.pathname === `/repos/${REPO}/actions/artifacts`) {
        const t = String(u.searchParams.get('name') || '').replace('verified-tree-', ''), h = known.get(t);
        body = { total_count: h ? 1 : 0, artifacts: h ? [{ name: 'verified-tree-' + t, expired: false, workflow_run: { id: RID, repository_id: 1, head_repository_id: 1, head_sha: h } }] : [] };
      } else if (u.pathname === `/repos/${REPO}/actions/runs/${RID}`) {
        body = runOf({ head_sha: [...known.values()][known.size - 1] });
      }
      res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(body || {}));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    // 가짜 서버가 같은 프로세스에 있으니 자식은 비동기로 띄운다(spawnSync 는 서버를 멈춘다)
    const cli = (apiBase = base) => new Promise(resolve => {
      const out = path.join(TMP, 'out-' + Math.random().toString(36).slice(2));
      const c = spawn(process.execPath, [SCRIPT, out], { cwd: repo,
        env: Object.assign({}, process.env, { GITHUB_REPOSITORY: REPO, VERIFIED_TREE_API_BASE: apiBase, GH_TOKEN: '' }) });
      let log = ''; c.stdout.on('data', b => { log += b; }); c.stderr.on('data', b => { log += b; });
      c.on('close', status => resolve({ status, out: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '', log }));
    });
    try {
      let r = await cli();
      assert.deepEqual([r.status, r.out], [0, `run=${RID}\n`], 'PR 병합 · 마지막 성공 배포 A · 같은 트리를 그 PR 머리가 통과: ' + r.log);
      assert.match(r.log, /::notice::배포 전 빠른 검사만/);
      deployed = [];
      r = await cli(); assert.equal(r.out, 'run=\n', '성공한 배포를 못 찾으면 전체: ' + r.log);
      deployed = [S];
      r = await cli(); assert.equal(r.out, 'run=\n', '마지막 성공 배포가 조상이 아니면 전체: ' + r.log);
      deployed = [A];
      // PR2 가 검사 장치를 바꾸고(병합 M2) 그 배포가 다음 병합에 밀려 취소됨 → PR3(M3, 앱만)의 배포는 마지막 성공 배포 A 와 비교해 전체
      const [, M2] = pr('f2', [['.github/workflows/verify-release.yml', 'on: pull_request\n']]);
      const [F3, M3] = pr('f3', [['index.html', 'v3\n']]);
      known = new Map([[g('rev-parse', M3 + '^{tree}'), F3]]);
      r = await cli(); assert.equal(r.out, 'run=\n', '밀려 취소된 배포 사이의 워크플로 변경을 놓치지 않는다(앞 push 와만 비교하면 건너뛸 뻔): ' + r.log);
      assert.match(r.log, /검사 장치가 바뀜/);
      deployed = [M2];
      r = await cli(); assert.deepEqual([r.status, r.out], [0, `run=${RID}\n`], '검사 장치 변경까지 배포된 뒤의 앱만 바꾼 병합은 건너뜀: ' + r.log);
      // 한글 이름 워크플로(따옴표로 나오던 이름)
      const [F4, M4] = pr('f4', [['.github/workflows/배포.yml', 'on: push\n']]);
      known = new Map([[g('rev-parse', M4 + '^{tree}'), F4]]); deployed = [M3];
      r = await cli(); assert.equal(r.out, 'run=\n', '한글 이름 워크플로도 검사 장치: ' + r.log);
      // 병합이 아닌 커밋(직접 push)
      put('index.html', 'v5\n'); g('add', '.'); g('commit', '-q', '-m', 'direct');
      known = new Map([[g('rev-parse', 'HEAD^{tree}'), g('rev-parse', 'HEAD')]]); deployed = [M4];
      r = await cli(); assert.equal(r.out, 'run=\n', 'PR 병합 커밋이 아니면 전체: ' + r.log);
      assert.match(r.log, /PR 병합 커밋이 아님/);
      r = await cli('http://127.0.0.1:9');
      assert.deepEqual([r.status, r.out], [0, 'run=\n'], 'API 가 안 되면 전체(그래도 0 으로 끝남): ' + r.log);
    } finally { server.close(); }
  });

  await test('③ 워크플로 — 판단은 앞에 · 전체/빠른 검사는 갈라서 · 공개 단계는 그대로 · PR 검사의 전체 검사는 그대로 · 기록은 맨 끝 (WORKFLOW)', async () => {
    const steps = src => src.split(/\n(?=      - name: )/).slice(1).map(t => ({ name: /- name: (.*)/.exec(t)[1].trim(), text: t }));
    const d = steps(SRC.deploy), at = n => d.findIndex(s => s.name.startsWith(n));
    assert.match(SRC.deploy, /\npermissions:\n(?: {2}\S.*\n)*? {2}actions: read\b/, '배포가 병합 전 검사 기록을 읽을 수 있어야');
    const iFind = at('Find the same tree already verified before merge'), iNode = at('Setup Node.js'), iBrowser = at('Install security test browser');
    const iFull = at('Verify release guards (full suite)'), iQuick = at('Verify release guards (quick');
    assert.ok(iNode >= 0 && iFind > iNode && iBrowser > iFind && iFull > iFind && iQuick > iFull, JSON.stringify(d.map(s => s.name)));
    const find = d[iFind].text;
    assert.match(find, /id: verified\n/); assert.match(find, /run: node scripts\/verified-tree\.mjs "\$GITHUB_OUTPUT"\n/);
    assert.match(find, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.doesNotMatch(find, /continue-on-error|\n {8}if:/, '판단 단계는 늘 돈다(스크립트가 실패로 끝나지 않는다)');
    for (const i of [iBrowser, iFull]) assert.match(d[i].text, /\n {8}if: steps\.verified\.outputs\.run == ''(?: +#[^\n]*)?\n/, d[i].name);
    assert.match(d[iFull].text, /\n {10}node tests\/run-all\.js\s*\n/, '전체 검사는 그대로 인자 없이');
    assert.match(d[iQuick].text, /\n {8}if: steps\.verified\.outputs\.run != ''(?: +#[^\n]*)?\n/);
    assert.match(d[iQuick].text, /\n {10}node tests\/run-all\.js \.check\.js \.unit\.js\s*\n/, '빠른 검사는 정적·단위 전부');
    // 11/28: 올리기·공개는 공개 직전 머리 확인 조건(main 이 넘어갔으면 건너뜀 — tests/pages-head-guard.unit.js) 하나만 가질 수 있다. 검사를 건너뛰는 조건은 여전히 없다.
    const HEAD_IF = /\n {8}if: steps\.head\.outputs\.publish != 'false'(?: +#[^\n]*)?\n/;
    for (const n of ['Checkout', 'Setup Node.js', 'Configure GitHub Pages', 'Stage public site allowlist', 'Upload site artifact', 'Deploy to GitHub Pages']) {
      const text = /^(?:Upload site artifact|Deploy to GitHub Pages)$/.test(n) ? d[at(n)].text.replace(HEAD_IF, '\n') : d[at(n)].text;
      assert.doesNotMatch(text, /\n {8}if:/, n + ' 은 건너뛰지 않는다(조건 없음 — 올리기·공개는 머리 확인 조건만)');
    }
    const v = steps(SRC.verify);
    const last = v[v.length - 1], rec = v[v.length - 2];
    assert.equal(last.name, 'Upload the verified tree record', '기록 올리기는 맨 끝');
    assert.match(last.text, /uses: actions\/upload-artifact@v\d+/); assert.match(last.text, /name: verified-tree-\$\{\{ steps\.tree\.outputs\.tree \}\}/);
    assert.match(last.text, /retention-days: \d+/); assert.match(last.text, /if-no-files-found: error/);
    assert.equal(rec.name, 'Record the verified tree');
    assert.match(rec.text, /git rev-parse 'HEAD\^\{tree\}'/); assert.match(rec.text, /id: tree\n/);
    for (const s of [rec, last]) assert.doesNotMatch(s.text, /\n {8}if:/, '위 단계가 다 통과했을 때만(기본 success()) — always() 금지');
    // 이제 진짜 전체 검사 관문은 PR 검사 — 그 전체 검사가 줄면 배포도 빠른 검사만 돌아 '82개 중 8개'가 된다(독립 검토 11/24)
    const vFull = v.findIndex(s => s.name === 'Verify release guards (full suite)');
    assert.ok(vFull >= 0 && vFull < v.length - 2, '전체 검사가 있고 그 뒤에 기록: ' + JSON.stringify(v.map(s => s.name)));
    assert.match(v[vFull].text, /\n {10}node tests\/run-all\.js[ \t]*\n/, 'PR 검사의 전체 검사도 인자 없이');
    assert.doesNotMatch(v[vFull].text, /\n {8}(?:if|continue-on-error):|\|\|/, 'PR 전체 검사는 조건·실패 무시 없이');
    assert.doesNotMatch(SRC.verify, /continue-on-error/, 'PR 검사 어디에도 continue-on-error 금지(실패해도 기록이 남는다)');
  });

  await test('④ PC 빠른 검사 — playwright 없이 변이 표 읽기(이름일 때만 대역) · 고정 파일 줄끝 그대로 (PC)', async () => {
    const EXIT = {};
    const runAnchors = env => {
      let exit = 0, out = '';
      const proc = { env: Object.assign({}, process.env, env), exit: c => { exit = c; throw EXIT; }, platform: process.platform, argv: [], cwd: () => ROOT };
      const con = { log: (...a) => { out += a.join(' ') + '\n'; }, error: (...a) => { out += a.join(' ') + '\n'; }, warn() {}, info() {} };
      try { new Function('require', '__dirname', '__filename', 'process', 'console', SRC.anchors)(require, path.join(ROOT, 'tests'), path.join(ROOT, 'tests', 'mutation-anchors.check.js'), proc, con); }
      catch (e) { if (e !== EXIT) throw e; }
      return { exit, out };
    };
    const hid = runAnchors({ MUT_ANCHORS_HIDE_PLAYWRIGHT: '1' });
    assert.equal(hid.exit, 0, 'playwright 가 없는 PC 에서도 변이 표를 읽는다: ' + hid.out.slice(0, 400));
    assert.ok(Number((/검사 (\d+)개/.exec(hid.out) || [])[1]) >= 30, hid.out);
    const m = /const PLAYWRIGHT_ID_RE = (\/.*\/[a-z]*);/.exec(SRC.anchors);
    assert.ok(m, 'PLAYWRIGHT_ID_RE 를 찾음');
    const re = new Function('return ' + m[1])();
    assert.deepEqual(['playwright', '@playwright/test', '/opt/node22/lib/node_modules/playwright', './playwright', 'playwright-core'].map(id => re.test(id)),
      [true, true, false, false, false], '대역은 이름(playwright·@playwright/…)일 때만 — 경로는 그대로 실패시켜 검사 파일이 NODE_PATH 의 진짜로 넘어간다');
    assert.match(SRC.attrs, /^tests\/fixtures\/vendor\/\*\* -text$/m, '고정 파일(sri 지문)은 줄끝을 바꾸지 않는다');
  });

  console.log('verified-tree: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL verified-tree', e && e.stack || e); process.exit(1); })
  .finally(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });

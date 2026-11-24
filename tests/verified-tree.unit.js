/* 배포 때 같은 전체 검사 두 번 줄이기 · PC 빠른 검사 2개 (단위 검사) — 대표 결정(11/24 'B')
   공개 한 번에 같은 전체 검사가 두 번 돌았다(PR 검사 중앙 20분 + 배포 전 18분). 병합 커밋의 내용(트리)이 PR 검사가 돌린 내용과 똑같으면
   배포 쪽은 빠른 검사(.check.js·.unit.js)만 돈다 — 대신 아주 좁게: 하나라도 확인이 안 되면 지금처럼 전체 검사(예전 '82개 중 8개' 사고를 되풀이하지 않게).
   ① 판단(scripts/verified-tree.mjs findVerifiedRun) — 같은 트리 기록 · 이 저장소(포크 아님) · verify-release.yml · pull_request · success · 만료 전 ·
      검사 장치(.github/·run-all.js·package*.json·이 스크립트)가 바뀐 배포는 묻지도 않고 전체 · API 오류는 전체 (DECIDE)
   ② 실제 명령 — 임시 git 저장소 + 127.0.0.1 가짜 API: BEFORE..HEAD 로 바뀐 파일 · 0000… 이면 앞 커밋 · 모르는 커밋·서버 꺼짐은 전체 · 늘 0 으로 끝남 (CLI)
   ③ 워크플로 — 배포: actions:read · 판단 단계가 브라우저 설치·전체 검사 앞 · 둘 다 run 이 비었을 때만 · 빠른 검사는 run 이 있을 때만 · 공개 단계는 조건 없음 ·
      전체 검사는 그대로 'node tests/run-all.js'(인자 없이) / PR 검사: 맨 끝에만 트리 기록(위가 다 통과했을 때) (WORKFLOW)
   ④ PC 빠른 검사 — mutation-anchors 는 playwright 가 없어도 표를 읽는다(대역) · 고정 파일은 줄끝을 바꾸지 않는다(.gitattributes) (PC)
   변이(VT_MUTATION): no-fork-check·any-conclusion·any-workflow·any-event·no-guard·no-expiry·throw-through 는 ①, before-ignored 는 ②,
   full-always-skipped·quick-wrong-filter·record-always·no-actions-read 는 ③, no-fallback·no-gitattributes 는 ④에서 실패해야 한다. */
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
  'before-ignored': ["if (!SHA_RE.test(before) || /^0+$/.test(before)) before = git(['rev-parse', 'HEAD^1']);", "before = git(['rev-parse', 'HEAD^1']);"],
  'full-always-skipped': ["        if: steps.verified.outputs.run == ''   # 같은 트리 기록이 없으면", "        if: steps.verified.outputs.run != ''   # 같은 트리 기록이 없으면"],
  'quick-wrong-filter': ['          node tests/run-all.js .check.js .unit.js', '          node tests/run-all.js .unit.js'],
  'record-always': ['      - name: Record the verified tree', '      - name: Record the verified tree\n        if: always()'],
  'no-actions-read': ['  actions: read   # 병합 전 검사 기록', '  # actions: read   # 병합 전 검사 기록'],
  'no-fallback': ["if (error && error.code === 'MODULE_NOT_FOUND' && PLAYWRIGHT_ID_RE.test(String(id))) return PLAYWRIGHT_STUB;", ''],
  'no-gitattributes': ['tests/fixtures/vendor/** -text', '# (없음)'],
};
const KEYOF = { 'full-always-skipped': 'deploy', 'quick-wrong-filter': 'deploy', 'no-actions-read': 'deploy', 'record-always': 'verify',
  'no-fallback': 'anchors', 'no-gitattributes': 'attrs' };
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
const REPO = '01023978629/hyeonjang', TREE = 'a'.repeat(40), RID = 4242;
const art = (o = {}) => Object.assign({ name: 'verified-tree-' + TREE, expired: false, workflow_run: { id: RID, repository_id: 1, head_repository_id: 1 } }, o);
const runOf = (o = {}) => Object.assign({ id: RID, path: '.github/workflows/verify-release.yml', event: 'pull_request', conclusion: 'success',
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
  const decide = (opts = {}, f = fake()) => findVerifiedRun(Object.assign({ repo: REPO, tree: TREE, changed: ['index.html', 'tests/x.unit.js'], api: f.api }, opts));

  await test('① 판단 — 같은 트리·이 저장소·병합 전 검사 성공일 때만, 아니면 전체 검사 (DECIDE)', async () => {
    let f = fake(); let r = await decide({}, f);
    assert.equal(r.run, String(RID), r.why);
    assert.deepEqual(f.calls, [`repos/${REPO}/actions/artifacts?name=verified-tree-${TREE}&per_page=20`, `repos/${REPO}/actions/runs/${RID}`]);
    for (const g of ['.github/workflows/deploy-pages.yml', '.github/workflows/verify-release.yml', 'tests/run-all.js', 'package.json', 'package-lock.json', 'scripts/verified-tree.mjs']) {
      f = fake(); r = await decide({ changed: ['index.html', g] }, f);
      assert.equal(r.run, '', g); assert.deepEqual(f.calls, [], '검사 장치가 바뀌면 묻지도 않는다: ' + g); assert.match(r.why, /검사 장치/);
    }
    assert.equal((await decide({ changed: ['scripts/stage-pages.mjs', 'tests/run-all.unit.js', 'AGENTS.md'] })).run, String(RID), '검사 장치가 아닌 파일');
    const none = [
      ['기록 없음', fake({ arts: [] })], ['만료', fake({ arts: [art({ expired: true })] })], ['만료 모름', fake({ arts: [art({ expired: undefined })] })],
      ['다른 트리 이름', fake({ arts: [art({ name: 'verified-tree-' + 'b'.repeat(40) })] })],
      ['포크', fake({ arts: [art({ workflow_run: { id: RID, repository_id: 1, head_repository_id: 2 } })] })],
      ['저장소 모름', fake({ arts: [art({ workflow_run: { id: RID, repository_id: null, head_repository_id: null } })] })],
      ['실패한 실행', fake({ runs: { [RID]: runOf({ conclusion: 'failure' }) } })],
      ['다른 워크플로', fake({ runs: { [RID]: runOf({ path: '.github/workflows/deploy-pages.yml' }) } })],
      ['push 실행', fake({ runs: { [RID]: runOf({ event: 'push' }) } })],
      ['포크 머리', fake({ runs: { [RID]: runOf({ head_repository: { full_name: 'someone/hyeonjang' } }) } })],
      ['다른 저장소', fake({ runs: { [RID]: runOf({ repository: { full_name: 'someone/else' } }) } })],
      ['API 오류', fake({ fail: true })],
    ];
    for (const [why, ff] of none) assert.equal((await decide({}, ff)).run, '', why);
    assert.match((await decide({}, fake({ fail: true }))).why, /확인 실패/);
    for (const bad of [{ repo: '' }, { repo: 'x' }, { tree: 'abc' }, { changed: null }]) assert.equal((await decide(bad)).run, '', JSON.stringify(bad));
    const two = fake({ arts: [art({ workflow_run: { id: 1, repository_id: 1, head_repository_id: 2 } }), art({ workflow_run: { id: 7, repository_id: 1, head_repository_id: 1 } })],
      runs: { 7: runOf({ id: 7 }) } });
    assert.equal((await decide({}, two)).run, '7', '포크 기록은 건너뛰고 다음 기록');
  });

  await test('② 실제 명령 — 임시 저장소 · 가짜 API · 늘 0 으로 끝남 (CLI)', async () => {
    const repo = path.join(TMP, 'repo'); fs.mkdirSync(repo);
    const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    g('init', '-q'); g('config', 'user.email', 't@example.invalid'); g('config', 'user.name', 't'); g('config', 'core.autocrlf', 'false');
    fs.writeFileSync(path.join(repo, 'index.html'), 'v1\n'); g('add', '.'); g('commit', '-q', '-m', 'A'); const A = g('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(repo, 'index.html'), 'v2\n'); g('add', '.'); g('commit', '-q', '-m', 'B'); const treeB = g('rev-parse', 'HEAD^{tree}');
    let known = new Set([treeB]);
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let body;
      if (u.pathname === `/repos/${REPO}/actions/artifacts`) {
        const t = String(u.searchParams.get('name') || '').replace('verified-tree-', '');
        body = { total_count: known.has(t) ? 1 : 0, artifacts: known.has(t) ? [{ name: 'verified-tree-' + t, expired: false, workflow_run: { id: RID, repository_id: 1, head_repository_id: 1 } }] : [] };
      } else if (u.pathname === `/repos/${REPO}/actions/runs/${RID}`) body = runOf();
      res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' }); res.end(JSON.stringify(body || {}));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    // 가짜 서버가 같은 프로세스에 있으니 자식은 비동기로 띄운다(spawnSync 는 서버를 멈춘다)
    const cli = (before, apiBase = base) => new Promise(resolve => {
      const out = path.join(TMP, 'out-' + Math.random().toString(36).slice(2));
      const c = spawn(process.execPath, [SCRIPT, out, before], { cwd: repo,
        env: Object.assign({}, process.env, { GITHUB_REPOSITORY: REPO, VERIFIED_TREE_API_BASE: apiBase, GH_TOKEN: '' }) });
      let log = ''; c.stdout.on('data', b => { log += b; }); c.stderr.on('data', b => { log += b; });
      c.on('close', status => resolve({ status, out: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '', log }));
    });
    try {
      let r = await cli(A);
      assert.deepEqual([r.status, r.out], [0, `run=${RID}\n`], r.log);
      assert.match(r.log, /::notice::배포 전 빠른 검사만/);
      r = await cli('0'.repeat(40));
      assert.equal(r.out, `run=${RID}\n`, '0000… 이면 앞 커밋과 비교: ' + r.log);
      r = await cli('');
      assert.equal(r.out, `run=${RID}\n`, 'workflow_dispatch(BEFORE 없음)');
      r = await cli('c'.repeat(40));
      assert.deepEqual([r.status, r.out], [0, 'run=\n'], '모르는 커밋 — 전체: ' + r.log);
      fs.mkdirSync(path.join(repo, '.github', 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(repo, '.github', 'workflows', 'x.yml'), 'on: push\n'); g('add', '.'); g('commit', '-q', '-m', 'C');
      known = new Set([g('rev-parse', 'HEAD^{tree}')]);
      r = await cli(g('rev-parse', 'HEAD^1'));
      assert.deepEqual([r.status, r.out], [0, 'run=\n'], '워크플로가 바뀐 배포는 같은 트리 기록이 있어도 전체: ' + r.log);
      assert.match(r.log, /::notice::배포 전 전체 검사 — 검사 장치가 바뀜/);
      fs.writeFileSync(path.join(repo, 'index.html'), 'v3\n'); g('add', '.'); g('commit', '-q', '-m', 'D');
      r = await cli(g('rev-parse', 'HEAD^1'));
      assert.equal(r.out, 'run=\n', '기록 없는 트리 — 전체');
      known = new Set([g('rev-parse', 'HEAD^{tree}')]);
      r = await cli(g('rev-parse', 'HEAD^1'), 'http://127.0.0.1:9');
      assert.deepEqual([r.status, r.out], [0, 'run=\n'], 'API 가 안 되면 전체(그래도 0 으로 끝남): ' + r.log);
      r = await cli(g('rev-parse', 'HEAD^1'));
      assert.equal(r.out, `run=${RID}\n`);
    } finally { server.close(); }
  });

  await test('③ 워크플로 — 판단은 앞에 · 전체/빠른 검사는 갈라서 · 공개 단계는 그대로 · 기록은 맨 끝 (WORKFLOW)', async () => {
    const steps = src => src.split(/\n(?=      - name: )/).slice(1).map(t => ({ name: /- name: (.*)/.exec(t)[1].trim(), text: t }));
    const d = steps(SRC.deploy), at = n => d.findIndex(s => s.name.startsWith(n));
    assert.match(SRC.deploy, /\npermissions:\n(?: {2}\S.*\n)*? {2}actions: read\b/, '배포가 병합 전 검사 기록을 읽을 수 있어야');
    const iFind = at('Find the same tree already verified before merge'), iNode = at('Setup Node.js'), iBrowser = at('Install security test browser');
    const iFull = at('Verify release guards (full suite)'), iQuick = at('Verify release guards (quick');
    assert.ok(iNode >= 0 && iFind > iNode && iBrowser > iFind && iFull > iFind && iQuick > iFull, JSON.stringify(d.map(s => s.name)));
    const find = d[iFind].text;
    assert.match(find, /id: verified\n/); assert.match(find, /run: node scripts\/verified-tree\.mjs "\$GITHUB_OUTPUT" "\$BEFORE"/);
    assert.match(find, /BEFORE: \$\{\{ github\.event\.before \}\}/); assert.match(find, /GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.doesNotMatch(find, /continue-on-error|\n {8}if:/, '판단 단계는 늘 돈다(스크립트가 실패로 끝나지 않는다)');
    for (const i of [iBrowser, iFull]) assert.match(d[i].text, /\n {8}if: steps\.verified\.outputs\.run == ''(?: +#[^\n]*)?\n/, d[i].name);
    assert.match(d[iFull].text, /\n {10}node tests\/run-all\.js\s*\n/, '전체 검사는 그대로 인자 없이');
    assert.match(d[iQuick].text, /\n {8}if: steps\.verified\.outputs\.run != ''(?: +#[^\n]*)?\n/);
    assert.match(d[iQuick].text, /\n {10}node tests\/run-all\.js \.check\.js \.unit\.js\s*\n/, '빠른 검사는 정적·단위 전부');
    for (const n of ['Checkout', 'Setup Node.js', 'Configure GitHub Pages', 'Stage public site allowlist', 'Upload site artifact', 'Deploy to GitHub Pages'])
      assert.doesNotMatch(d[at(n)].text, /\n {8}if:/, n + ' 은 건너뛰지 않는다(조건 없음)');
    const v = steps(SRC.verify);
    const last = v[v.length - 1], rec = v[v.length - 2];
    assert.equal(last.name, 'Upload the verified tree record', '기록 올리기는 맨 끝');
    assert.match(last.text, /uses: actions\/upload-artifact@v\d+/); assert.match(last.text, /name: verified-tree-\$\{\{ steps\.tree\.outputs\.tree \}\}/);
    assert.match(last.text, /retention-days: \d+/); assert.match(last.text, /if-no-files-found: error/);
    assert.equal(rec.name, 'Record the verified tree');
    assert.match(rec.text, /git rev-parse 'HEAD\^\{tree\}'/); assert.match(rec.text, /id: tree\n/);
    for (const s of [rec, last]) assert.doesNotMatch(s.text, /\n {8}if:/, '위 단계가 다 통과했을 때만(기본 success()) — always() 금지');
    assert.ok(v.findIndex(s => s.name === 'Verify release guards (full suite)') < v.length - 2, '전체 검사 뒤에 기록');
  });

  await test('④ PC 빠른 검사 — playwright 없이 변이 표 읽기 · 고정 파일 줄끝 그대로 (PC)', async () => {
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
    const n = Number((/검사 (\d+)개/.exec(hid.out) || [])[1]);
    assert.ok(n >= 30, hid.out);
    assert.match(SRC.attrs, /^tests\/fixtures\/vendor\/\*\* -text$/m, '고정 파일(sri 지문)은 줄끝을 바꾸지 않는다');
  });

  console.log('verified-tree: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL verified-tree', e && e.stack || e); process.exit(1); })
  .finally(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });

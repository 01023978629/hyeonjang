/* run-all.js — tests/ 전체를 순서대로 돌리는 러너 (로컬·CI 공용)

   배경: 배포 게이트(deploy-pages.yml)가 그동안 82개 중 8개만 돌렸다.
   나머지 74개는 "로컬에서 돌렸다"는 말에 의존했는데, 말은 검사가 아니다.
   실제로 v238 병합 직전까지 게이트가 못 보는 회귀가 몇 번 있었다.

   하는 일:
     · *.check.js → *.unit.js → *.e2e.js 순서(빠른 정적 검사부터 — 문법이
       깨졌으면 브라우저 82번 띄우기 전에 1초 만에 멈춘다)
     · 8299(static-server)·8398(mock-relay)이 안 떠 있으면 직접 띄우고,
       직접 띄운 것만 끝나고 끈다(남이 띄운 서버는 건드리지 않는다)
     · 파일당 180초 제한 — 로컬 관례와 같다
     · 실패한 파일은 출력 꼬리를 그 자리에서 보여주고, 전부 돈 뒤 요약
     · 하나라도 실패하면 exit 1 → CI 가 배포를 멈춘다

   사용: node tests/run-all.js            ← 전체(배포 게이트는 반드시 이 형태)
         node tests/run-all.js photo mobile ← 파일명에 photo·mobile 이 든 것만(로컬 개발용)
   CI 주의: 브라우저 경로를 하드코딩한 옛 테스트들 때문에
   /opt/pw-browsers/chromium 이 실제 크로미움을 가리켜야 한다(심링크로 충분). */
'use strict';
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TESTS = path.join(__dirname);
const ROOT = path.join(__dirname, '..');
const PER_FILE_TIMEOUT_MS = 180000;

function listSuite() {
  const filters = process.argv.slice(2);   // 인자 없으면 전체 — 게이트는 인자 없이 부른다
  const all = fs.readdirSync(TESTS).sort()
    .filter(f => !filters.length || filters.some(w => f.includes(w)));
  const pick = (re) => all.filter(f => re.test(f)).map(f => path.join('tests', f));
  return [...pick(/\.check\.js$/), ...pick(/\.unit\.js$/), ...pick(/\.e2e\.js$/)];
}

function portAlive(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 },
      res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer(port, script, spawned) {
  if (await portAlive(port)) return;
  const child = spawn(process.execPath, [path.join('tests', script)], {
    cwd: ROOT, stdio: 'ignore', detached: false
  });
  child.unref();   // 서버는 안 끝나는 프로세스다 — 잡고 있으면 러너가 요약까지 찍고도 안 죽는다(실측)
  spawned.push(child);
  for (let i = 0; i < 40; i++) {
    if (await portAlive(port)) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(script + ' 이(가) ' + port + ' 포트에서 안 뜬다 — 게이트를 진행할 수 없다');
}

(async () => {
  const spawned = [];
  const stop = () => spawned.forEach(c => { try { c.kill(); } catch (e) {} });
  process.on('exit', stop);

  await ensureServer(8299, 'static-server.js', spawned);
  await ensureServer(8398, 'mock-relay.js', spawned);

  const suite = listSuite();
  const failed = [];
  let done = 0;
  const t0 = Date.now();
  for (const f of suite) {
    const s = Date.now();
    const r = spawnSync(process.execPath, [f], {
      cwd: ROOT, encoding: 'utf8', timeout: PER_FILE_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024, env: process.env
    });
    const sec = ((Date.now() - s) / 1000).toFixed(1);
    const ok = r.status === 0 && !r.error;
    done++;
    if (ok) {
      console.log('PASS  ' + f + '  (' + sec + 's)');
    } else {
      failed.push(f);
      const why = r.error ? String(r.error) : 'exit ' + r.status;
      console.log('FAIL  ' + f + '  (' + sec + 's, ' + why + ')');
      const tail = ((r.stdout || '') + '\n' + (r.stderr || '')).trim().split('\n').slice(-20);
      tail.forEach(l => console.log('      | ' + l));
    }
  }

  const total = ((Date.now() - t0) / 60000).toFixed(1);
  console.log('\n== ' + done + '개 중 ' + (done - failed.length) + ' 통과, '
    + failed.length + ' 실패  (' + total + '분)');
  if (failed.length) {
    console.log('실패 목록:');
    failed.forEach(f => console.log('  · ' + f));
    process.exitCode = 1;
  }
  // process.exit() 는 파이프로 나가는 마지막 출력(요약)을 자를 수 있어 쓰지 않는다.
  // unref 덕에 이벤트 루프가 저절로 비고, exit 훅(stop)이 직접 띄운 서버를 끈다.
})().catch(e => { console.error('러너 오류:', e && e.stack || e); process.exitCode = 1; });

/* dead-endpoint.check.js — 종료된 주소가 소스에 남아 있지 않은지 검사

   2026-07-30 에 Fly.io 계정과 manmool-contract 앱을 종료했다.
   그 주소는 이제 아무 데도 닿지 않는다. 남아 있으면 두 가지가 나쁘다.
     · 죽은 주소로 요청이 나가 조용히 실패한다
     · 소스를 읽는 사람이 "아직 그 서버를 쓰는구나"로 오해한다

   문법 검사(syntax.check.js)와 같은 성격의 정적 검사라 브라우저 없이 돈다.
   앱을 켤 필요가 없으니 CI 에서도 제일 먼저 돌 수 있다. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 이 문자열이 나오면 안 된다.
const DEAD = [
  { pat: 'manmool-contract.fly.dev', why: '종료된 Fly 계약 서버 주소' },
  { pat: 'x-admin-token', why: 'Apps Script 는 커스텀 헤더를 받으면 preflight 로 막힌다 — 토큰은 본문에 싣는다' },
  { pat: '/api/contracts', why: '옛 Fly 서버의 경로. Apps Script 는 단일 주소 + action 이다' },
  { pat: '/healthz', why: '옛 Fly 서버의 경로. Apps Script 는 action:health 다' }
];

// 검사 대상 — 앱 소스와 테스트. 문서(md)는 "옛날엔 이랬다"를 적어야 하므로 제외한다.
const TARGETS = ['index.html', 'sw.js'];
const TEST_DIR = path.join(ROOT, 'tests');
for (const f of fs.readdirSync(TEST_DIR)) {
  if (f.endsWith('.js') && f !== 'dead-endpoint.check.js') TARGETS.push(path.join('tests', f));
}

let bad = 0;
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  for (const d of DEAD) {
    lines.forEach((ln, i) => {
      if (ln.indexOf(d.pat) < 0) return;
      // 그 주소가 '없어야 한다'고 검사하는 줄과, 옛 규약을 설명하는 주석은 예외다.
      // 그런 줄에는 dead-endpoint-ok 를 적어 두면 건너뛴다. 예외는 눈에 보이게 남긴다.
      if (ln.indexOf('dead-endpoint-ok') >= 0) return;
      // Ollama 로컬 서버의 /api/tags 같은 무관한 경로는 걸리지 않는다(패턴이 다르다).
      console.log('FAIL  ' + rel + ':' + (i + 1) + '  "' + d.pat + '" — ' + d.why);
      console.log('      ' + ln.trim().slice(0, 120));
      bad++;
    });
  }
}

if (bad) {
  console.log('\n' + bad + '곳에 종료된 주소·옛 규약이 남아 있습니다.');
  process.exit(1);
}
console.log('✓ 종료된 Fly 주소·옛 규약 없음 (' + TARGETS.length + '개 파일 검사)');

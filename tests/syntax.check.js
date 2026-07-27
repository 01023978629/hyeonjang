/* syntax.check.js — index.html 안의 스크립트가 파싱되는지 1초 만에 확인한다.
   브라우저 테스트도 결국 잡아내지만(스크립트가 통째로 죽어 state 부터 없다),
   원인이 'ReferenceError: state is not defined' 로 보여서 진짜 이유를 찾는 데 시간이 걸린다.
   실제로 한 줄짜리 긴 문장 중간에 // 주석을 넣어 뒷부분이 통째로 주석 처리된 적이 있다.
   실행: node tests/syntax.check.js */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const files = ['index.html', 'privacy.html', 'terms.html'];
let bad = 0, n = 0;
for (const rel of files) {
  const p = path.resolve(__dirname, '..', rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, i = 0;
  while ((m = re.exec(src))) {
    i++; n++;
    try { new Function(m[1]); }
    catch (e) {
      bad++;
      // 오류 지점을 파일 기준 줄번호로 환산해 알려준다
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`✗ ${rel} 의 ${i}번째 <script>(파일 ${line}행부터): ${e.message}`);
    }
  }
}
if (bad) { console.error('\n스크립트가 파싱되지 않으면 앱이 통째로 안 뜬다.'); process.exit(1); }
console.log(`✓ 스크립트 문법 정상 — 블록 ${n}개`);

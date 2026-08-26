/* version-sync.check.js — 화면에 찍히는 버전과 실제 캐시 버전이 같은지 검사

   앱은 두 곳에 자기 번호를 적는다.
     · sw.js  의 C          — 서비스워커가 캐시를 가르는 진짜 이름
     · index.html 의 APP_BUILD — 사장님 화면(설정 하단·푸터·🔧 진단)에 찍히는 글자

   둘은 손으로 맞춰야 하는데, 그동안 index.html 쪽만 아무도 안 고쳤다.
   v183 을 쓰는 폰이 화면에 '2026-07-30-uiux-contract-audit' 을 띄우고 있었다.

   틀린 번호는 없는 번호보다 나쁘다. "지금 몇 번이세요?" 로 시작하는 원격
   확인이 통째로 무너진다 — 틀린 답을 믿고 엉뚱한 데를 판다. 화면이
   "최신입니다" 라고 말할 때도 그 말이 무엇과 비교한 것인지가 어긋난다.

   브라우저 없이 도는 정적 검사다(syntax·dead-endpoint 와 같은 성격). */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const fail = [];
const TARGET_BUILD = 'hyeonjang-v234-officequeue';

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const mSw = sw.match(/const\s+C\s*=\s*'([^']+)'/);
const mApp = html.match(/const\s+APP_BUILD\s*=\s*'([^']+)'/);

if (!mSw) fail.push("sw.js 에서 캐시 이름(const C='…')을 못 찾았다 — 형식이 바뀌었으면 이 검사부터 고쳐라");
if (!mApp) fail.push("index.html 에서 const APP_BUILD='…' 을 못 찾았다");

if (mSw && mApp) {
  const c = mSw[1], b = mApp[1];
  if (c !== b) {
    fail.push(
      '버전이 어긋난다 — 화면과 캐시가 다른 번호를 말한다\n' +
      "  sw.js        C = '" + c + "'\n" +
      "  index.html APP_BUILD = '" + b + "'\n" +
      '  → index.html 을 고쳤으면 sw.js 버전을 올리고, APP_BUILD 도 같은 값으로 맞춰라.'
    );
  }
  // 형식까지 못박는다 — 'hyeonjang-v{숫자}-{짧은이름}' 이 저장소 규칙이다.
  if (!/^hyeonjang-v\d+-[a-z0-9]+$/.test(c)) {
    fail.push("캐시 이름 형식이 규칙에서 벗어났다: '" + c + "' (hyeonjang-v{숫자}-{영소문자·숫자})");
  }
  if (c !== TARGET_BUILD || b !== TARGET_BUILD) {
    fail.push("이번 오피스 인테이크 릴리스는 정확히 '" + TARGET_BUILD + "'를 사용해야 한다");
  }
}

// 화면 코드가 APP_BUILD 를 실제로 쓰는지 — 상수만 고쳐 놓고 어디에도 안 쓰면 의미가 없다
const uses = (html.match(/APP_BUILD/g) || []).length;
if (uses < 2) fail.push('APP_BUILD 가 선언만 되고 화면에 안 쓰인다 (' + uses + '회) — 번호를 볼 데가 없다');

if (fail.length) {
  fail.forEach(f => console.error('FAIL  ' + f));
  process.exit(1);
}
console.log('PASS  sw.js 캐시 이름 == index.html APP_BUILD (' + mSw[1] + ')');
console.log('PASS  캐시 이름 형식 hyeonjang-v{숫자}-{이름}');
console.log('PASS  APP_BUILD 가 화면에서 쓰인다 (' + uses + '곳)');
console.log('\n전부 통과 (3건)');

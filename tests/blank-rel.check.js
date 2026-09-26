/* blank-rel.check.js — 새 창(target="_blank") 링크는 모두 rel 에 noopener 가 있어야 한다

   noopener 가 없으면 열린 외부 페이지가 window.opener 로 이 앱 탭을 다른 주소로 바꿔치기할 수 있다
   (키 발급 페이지·고객 링크처럼 우리가 통제하지 않는 곳). 그리고 새 창 링크는 대개 외부로 나간다 —
   noreferrer 까지 붙이면 이 앱 주소도 안 넘어간다. 여기서는 최소선인 noopener 만 강제한다.
   v328 전에는 네 곳(키 발급 페이지 2·카카오맵 길찾기·고객 링크)이 빠져 있었다.

   HTML 마크업과 JS 문자열 안의 태그를 모두 본다(대부분 JS 문자열로 그려진다).
   '_blank' 를 window.open() 인자로 쓰는 것은 태그가 아니라 대상이 아니다. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['index.html', 'privacy.html', 'terms.html'].filter(f => fs.existsSync(path.join(root, f)));
const bad = [];
let seen = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  // 태그 하나: '<a' 부터 다음 '>' 까지. 속성 값 안의 JS 연결('+x+')은 '>' 를 담지 않는다.
  const re = /<a\b[^>]*>/gi;
  let m;
  while ((m = re.exec(src))) {
    const tag = m[0];
    if (!/target\s*=\s*\\?["']?_blank/i.test(tag)) continue;
    seen++;
    const rel = tag.match(/\brel\s*=\s*\\?["']([^"'\\]*)/i);
    if (!rel || !/\bnoopener\b/i.test(rel[1])) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push(f + ':' + line + '  ' + tag.slice(0, 160));
    }
  }
}
// 카카오맵 길찾기 주소의 목적지 이름은 고정값('현장 N') — 현장명에는 고객 이름·동호수가 흔히 들어가고
// 그 주소가 카카오 서버 로그·방문 기록에 남는다.
{
  const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const kk = src.match(/map\.kakao\.com\/link\/to\/'\+encodeURIComponent\((?!'현장 ')[^)]*\)/g) || [];
  if (kk.length) { bad.push('카카오 길찾기 목적지에 현장명 등 가변값: ' + kk.join(' | ')); }
  // 전역 리퍼러 정책 — 새 창·이미지·API 요청에 전체 주소(경로·쿼리) 대신 출처만 간다
  if (!/<meta name="referrer" content="strict-origin-when-cross-origin">/.test(src)) bad.push('index.html <head> 에 referrer 메타 없음');
}
if (!seen) { console.log('FAIL blank-rel: target=_blank 태그를 하나도 못 찾음 — 검사의 눈이 멀었다(정규식 확인)'); process.exit(1); }
if (bad.length) {
  console.log('FAIL blank-rel: 새 창 링크·외부 전송 규칙 위반 ' + bad.length + '곳');
  bad.forEach(b => console.log('  ' + b));
  process.exit(1);
}
console.log('PASS blank-rel: target=_blank 링크 ' + seen + '곳 전부 rel 에 noopener');

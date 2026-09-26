/* tap-inline.check.js — 인라인 min-height 가 44 미만인 버튼 금지 (v329)

   폰에서 누르는 것은 44px — 이 저장소의 자체 규칙이다(body.mobile-mode button, ≤640px @media).
   그런데 인라인 style 은 전역 규칙보다 무겁다. 버튼에 style="min-height:34px" 를 적어 두면
   전역 44 규칙을 조용히 이기고 그 버튼 하나만 34 로 남는다. v329 까지 네 곳이 그랬다:
   #appVerBtn 34 · #wsClear 36 · #matSupClear 32 · 영업·정기관리 탭 40 (그리고 설정 탭 40).
   화면을 열어 재는 mobile-more-sweep 은 그 화면이 열렸을 때만 잡는다(서명판 지우기처럼 깊은 곳은
   못 연다). 그래서 소스 전체를 읽는 정적 검사가 따로 필요하다.

   판정: <button … > 태그(자바스크립트 문자열 이어붙이기로 쪼개져 있어도 다음 '>' 까지) 안에
   min-height:Npx 가 있고 N<44 이면 위반. 위반 줄을 출력하고 종료코드 1.
   고치는 법: 인라인 min-height 를 지운다(전역 규칙이 폰에서 44 를 준다). PC 에서도 꼭 높이가
   필요하면 44 이상으로 적는다. 브라우저 없이 도는 정적 검사다. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['index.html', 'media-safety.js', 'shared-todo-backup.js'].filter(f => fs.existsSync(path.join(ROOT, f)));

function scan(src) {
  const bad = [];
  const re = /<button\b/gi;
  let m;
  while ((m = re.exec(src))) {
    const end = src.indexOf('>', m.index);
    if (end < 0) break;
    const tag = src.slice(m.index, end + 1);
    const mh = /min-height\s*:\s*(\d+(?:\.\d+)?)px/i.exec(tag);
    if (mh && Number(mh[1]) < 44) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push({ line, px: Number(mh[1]), tag: tag.replace(/\s+/g, ' ').slice(0, 160) });
    }
  }
  return bad;
}

// 자가진단: 검사가 눈이 멀지 않았는지 — 쪼개진 태그·작은따옴표 문자열 안에서도 잡는다.
const probe = scan(`x='<button class="setTab" id="setTab-'+t.id+'"'+' style="flex:none;'+'min-height:40px">';y='<button style="min-height:44px">';z='<button style="min-height:48px">'`);
if (probe.length !== 1 || probe[0].px !== 40) { console.error('FAIL tap-inline 자가진단: 쪼개진 <button 태그의 min-height:40px 를 못 읽는다', probe); process.exit(1); }

let total = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const b of scan(src)) {
    total++;
    console.error(`FAIL ${f}:${b.line} 버튼 인라인 min-height:${b.px}px (<44) — 전역 44 규칙을 이긴다: ${b.tag}`);
  }
}
if (total) { console.error(`tap-inline: 위반 ${total}곳`); process.exit(1); }
console.log(`== tap-inline: ${FILES.join(', ')} — 인라인 min-height<44 버튼 0곳 ==`);

/* cost-honesty.check.js — 요금을 "무료"라고 단정하지 않는지 검사

   2026-08-01, 사장님의 Gemini 프로젝트('Default Gemini Project')에 결제계정이 붙었다.
   그 순간 앱 곳곳의 문구가 조용히 거짓이 됐다:

     · 📊 AI 사용량 화면    → "예상 비용 ₩0 (무료)"      (실제로는 청구되고 있었다)
     · 🔑 키 설정 안내       → "무료(초과 시 잠깐 막힘·과금X)"
     · 📖 도움말            → "비용 없는 AI … 비용이 들지 않아요"
     · 🧠 두뇌 선택 화면     → Gemini 배지 "무료" vs ChatGPT "유료" 대비

   가장 나쁜 것은 **비용을 확인하러 들어간 화면이 ₩0 이라고 단언한 것**이다.
   청구서가 날아올 때까지 앱 안에 아무 신호도 없었다.

   근본 원인은 문장 형태였다. "Gemini 는 무료" 라는 **무조건형 단정**은
   지금 참이어도 클릭 두 번이면 거짓이 된다. 앱은 결제 연결 여부를 알 방법이 없다 —
   구글이 키만으로는 알려주지 않는다. 그러니 앱이 할 수 있는 정직한 말은
   **조건형**("결제계정이 없을 때만 무료")뿐이다. 그건 두 상태 모두에서 참이고 낡지 않는다.

   이 검사는 그 규칙을 못 박는다. 문법 검사와 같은 성격의 정적 검사라 브라우저 없이 돈다. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');

/* 금지 패턴 — 요금이 0 이라고 **단정**하는 표현.
   조건이 같은 줄에 함께 적혀 있으면 통과시킨다(아래 GUARD 참조). */
const BANNED = [
  { re: /₩0\s*\(무료\)/, why: '금액을 ₩0 으로 단정 — 결제계정이 붙으면 거짓이 된다' },
  { re: /비용이\s*들지\s*않아요/, why: '비용 0 단정' },
  { re: /비용\s*없는\s*AI/, why: '제목부터 비용 0 단정 — 요금이 걱정돼 찾아본 사람이 이걸 읽고 안심한다' },
  { re: /무료\s*Gemini/, why: '"무료 Gemini" 는 조건을 숨긴 이름 — 무료인 것은 결제 미연결 프로젝트일 때뿐이다' },
  { re: /과금\s*X/, why: '과금 없음 단정' },
  { re: /100%\s*과금\s*0원/, why: '0원 보장 단정 — 예산 알림은 지출을 멈추지 못한다' },
];

/* 같은 줄에 이 중 하나가 있으면 조건형으로 본다 — 단정이 아니다. */
const GUARD = [
  /결제계정이?\s*(연결되지\s*않|없)/,
  /결제\s*미연결/,
  /결제계정이?\s*연결(돼|되어)\s*있으면/,
  /cost-honesty-ok/,   // 이 검사 자신처럼, 일부러 그 문자열을 다루는 줄
];

const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split('\n');
let bad = 0;

for (const b of BANNED) {
  lines.forEach((ln, i) => {
    if (!b.re.test(ln)) return;
    if (GUARD.some(g => g.test(ln))) return;
    bad++;
    console.error('✗ index.html:' + (i + 1) + '  ' + b.why);
    console.error('    ' + ln.trim().slice(0, 160));
  });
}

/* AI_PRICING.gemini 가 free:true 로만 박혀 있으면, 비용 화면이 영원히 0 을 표시한다.
   결제 연결 여부를 모른다는 사실(unknown)을 함께 들고 있어야 화면이 "확인 필요"라고 말할 수 있다. */
const pricing = (text.match(/AI_PRICING\s*=\s*\{\s*gemini:\{[^}]*\}/) || [''])[0];
if (pricing && !/unknown\s*:\s*true/.test(pricing)) {
  bad++;
  console.error('✗ AI_PRICING.gemini 에 unknown:true 가 없다 — 비용 화면이 ₩0 을 단언하게 된다');
  console.error('    ' + pricing.slice(0, 160));
}

/* 반대 방향도 못 박는다: 조건형 안내가 실제로 화면에 있어야 한다.
   금지 문구만 지우고 아무 설명도 안 남기면, 사장님은 요금 위험을 아예 모르게 된다. */
const MUST = [
  { re: /결제계정이\s*연결되지\s*않았을\s*때|결제계정이\s*없을\s*때/, why: '무료 조건을 설명하는 문구가 어디에도 없다' },
  { re: /console\.cloud\.google\.com/, why: '실제 청구를 확인할 곳을 알려 주지 않는다' },
  { re: /횟수만|횟수는/, why: '앱의 분당·하루 제한이 요금이 아니라 횟수를 막는다는 설명이 없다' },
];
for (const m of MUST) {
  if (m.re.test(text)) continue;
  bad++;
  console.error('✗ ' + m.why);
}

if (bad) {
  console.error('\n요금 정직성 검사 실패 — ' + bad + '건');
  console.error('요금은 "무료" 라고 단정하지 말고 조건("결제계정이 없을 때만 무료")으로 쓰세요.');
  process.exit(1);
}
console.log('✓ 요금을 단정하는 문구 없음 · 조건과 확인처가 안내됨');

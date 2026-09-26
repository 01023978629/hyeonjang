/* local-date.check.js — 사용자에게 보이거나 날짜로 비교하는 '오늘'을 UTC(toISOString)로 만들지 않는다

   toISOString() 은 UTC 다. 한국(UTC+9)에서 오전 9시 전에는 날짜가 하루 이르다.
   v330 전에 이 꼴이 견적·수금·AS·오더·운행 이력의 기본 기간(오늘 쓴 기록이 목록·합계·엑셀에서 빠졌다),
   준공일 기록(setStage — 보증 기산일·보증서 작업완료일이 하루 앞섰다), 카카오 문의의 '내일' 일정,
   완료보고서 날짜, 보증서 송부 시각('YYYY-MM-DD HH:MM' 이 9시간 이르게) 에 있었다.
   날짜 키는 localDate(d), 화면에 찍는 시각은 localStamp(d) 로 만든다.

   막는 꼴: toISOString() 뒤에 바로 .slice/.substr/.substring(0, 7|10|13|16|19) 또는 .split('T'),
            그리고 ymOf(…toISOString()) — 날짜 조각을 UTC 에서 잘라 쓰는 것.
   서버로 보내는 타임스탬프(toISOString() 통째)는 막지 않는다 — 시점이라 UTC 가 맞다.

   허용 목록 — 줄의 고유한 조각으로 찾는다(줄번호는 금방 낡는다). 항목마다 이유를 적고,
   아무 줄에도 안 걸리는 항목은 실패로 본다(지운 코드의 허용이 남아 새 결함을 덮지 않게). */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const FILES = ['index.html', 'media-safety.js', 'shared-todo-backup.js', 'sw.js'].filter(f => fs.existsSync(path.join(root, f)));

const ALLOW = [
  // 내려받는 파일 이름의 날짜 — 문서 내용이 아니라 이름이다(하루 어긋나도 자료가 틀리지 않는다). 과제 지시로 그대로 둔다.
  { frag: "'_세무정산_'+new Date().toISOString().slice(0,10)", why: '세무정산 엑셀 파일 이름' },
  { frag: "'작업확인서')+'_'+new Date().toISOString().slice(0,10)", why: '계약서·작업확인서 PDF 파일 이름' },
  { frag: "'_진행리포트_'+new Date().toISOString().slice(0,10)", why: '진행 리포트 파일 이름' },
  { frag: "'비포애프터_'+new Date().toISOString().slice(0,10)", why: '비포애프터 이미지 파일 이름' },
  { frag: "const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,'')", why: '폴더 백업 JSON 파일 이름(시각 도장)' },
  { frag: "const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');", why: '견적정산 엑셀 파일 이름' },
  // UTC 가 맞는 곳
  { frag: "const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;",
    why: "날짜 문자열 검증 — 'Z'(UTC)로 만들고 UTC 로 되읽어 같은지 본다. 양쪽이 UTC 라 어긋나지 않는다" },
  { frag: "const d=new Date(Math.round((v-25569)*86400000));return d.toISOString().slice(0,7);",
    why: '엑셀 날짜 일련번호 → 연월. 일련번호는 UTC 자정 기준 ms 로 풀리므로 UTC 로 읽어야 맞다' },
];

const BAD = [
  /toISOString\(\)\s*\.\s*(?:slice|substr|substring)\(\s*0\s*,\s*(?:7|10|13|16|19)\s*\)/,
  /toISOString\(\)\s*\.\s*split\(\s*['"]T['"]\s*\)/,
  /\bymOf\([^;]*toISOString\(\)/,
];

const bad = [];
const used = new Set();
let scanned = 0;
for (const f of FILES) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  lines.forEach((ln, i) => {
    scanned++;
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;   // 주석 줄(설명에 예시로 적은 꼴)은 코드가 아니다
    if (!BAD.some(re => re.test(ln))) return;
    const hit = ALLOW.findIndex(a => ln.includes(a.frag));
    if (hit >= 0) { used.add(hit); return; }
    bad.push(f + ':' + (i + 1) + '  ' + ln.trim().slice(0, 170));
  });
}
if (!scanned) { console.log('FAIL local-date: 읽은 줄이 없다 — 파일 경로 확인'); process.exit(1); }
// 자기 진단 — 정규식이 실제 꼴을 잡는지(눈이 먼 검사는 통과하고도 아무것도 안 지킨다)
const probe = "window.__x={to:t.toISOString().slice(0,10)};p.at=new Date().toISOString().slice(0,16).replace('T',' ');ymOf(f.when.toISOString());d.toISOString().split('T')[0]";
if (!BAD.every(re => re.test(probe))) { console.log('FAIL local-date: 자기 진단 — 금지 정규식이 표본을 못 잡는다'); process.exit(1); }
const stale = ALLOW.map((a, i) => used.has(i) ? null : a).filter(Boolean);
if (stale.length) {
  console.log('FAIL local-date: 허용 목록 중 아무 줄에도 안 걸리는 항목 ' + stale.length + '개 — 코드가 바뀌었으면 목록에서 지워라');
  stale.forEach(a => console.log('  ' + a.frag + '  (' + a.why + ')'));
  process.exit(1);
}
if (bad.length) {
  console.log('FAIL local-date: UTC 로 자른 날짜 ' + bad.length + '곳 — 날짜 키는 localDate(d), 화면 시각은 localStamp(d)');
  bad.forEach(b => console.log('  ' + b));
  process.exit(1);
}
console.log('PASS local-date: toISOString 날짜 자르기는 허용 ' + ALLOW.length + '곳(파일 이름·UTC 검증)뿐');

/* receivable-removed.check.js — 미수금 기능이 되살아나지 않는지 지킨다

   2026-08-13, 대표 결정: 앱이 미수금을 추적하고 독촉하도록 챙기는 일을 전부
   없앴다. 1인 사업장에서 입금 여부는 통장을 보면 되는 일이고, 앱이 매일
   "못 받은 돈"을 들이밀면 그 알림 자체를 안 믿게 된다.

   남긴 것과 없앤 것을 분명히 해 둔다 — 이 선이 흐려지면 다음 사람이
   "편의상" 하나씩 되살린다.

     없앰: 미수금 팔로업·독촉 문안·에이징(30/60/90)·일괄 완납·미수금 리포트·
           파수꾼의 '못 받은 돈'/'입금 확인 필요' 절·운영 루프의 미수금 작업
     없앰(2차): 남아 있던 **미수 숫자 표시** — 대시보드·리포트·장부·엑셀·
           한눈 보기·지도 핀·입금 화면의 '현재 미수'까지. 대표 지시 "지워".
     남김: 수금액 입력(현장 목록의 수금액 칸·recvQuickView)과 payLog,
           그리고 견적(매출)·수금액 두 값 — 장부와 부가세 근거라 지우면 안 된다.
           둘이 남아 있으면 미수는 언제든 다시 계산되므로 신고 근거는 온전하다.

   브라우저 없이 도는 정적 검사다. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const watchdog = fs.readFileSync(path.join(ROOT, 'apps-script', 'Watchdog.gs'), 'utf8');
const fail = [];

/* ① 지운 함수가 이름만이라도 돌아오면 화면이 다시 붙는다 */
const GONE = ['overdueFollowupData', 'overdueFollowup', 'overdueDraftModal', 'overdueRuleDrafts',
  'aiOpsReceivableReport', 'dueAgingData', 'dueAgingView', 'dueAgingMsg', 'agingSms',
  'dueSettleAll', 'sendDunning'];
for (const fn of GONE) {
  if (html.indexOf(fn) !== -1) fail.push('index.html 에 ' + fn + ' 이 돌아왔다 — 미수금 기능이 되살아났다');
}

/* ② AI 도구로도 부를 수 없어야 한다 */
for (const tool of ['overdue_followup', 'ops_loop_report_receivable', 'due_aging']) {
  if (html.indexOf("'" + tool + "'") !== -1) fail.push('AI 도구 ' + tool + ' 이 남아 있다');
}

/* ③ 파수꾼(메일·캘린더)도 같이 조용해야 한다.
      한쪽만 고치면 앱은 조용한데 매일 아침 메일로 독촉이 온다. */
for (const k of ['dueAfterDone', 'dueMin', 'watchPaidProjects_']) {
  if (watchdog.indexOf(k) !== -1) fail.push('Watchdog.gs 에 ' + k + ' 이 남아 있다');
}
for (const w of ['못 받은 돈', '입금 확인 필요']) {
  if (watchdog.indexOf(w) !== -1) fail.push('Watchdog.gs 본문에 "' + w + '" 이 남아 있다');
}

/* ④ 반대로, 수금 입력은 반드시 살아 있어야 한다 — 지우면 장부가 무너진다 */
// 이름 끝을 막는다. indexOf 로만 보면 recvQuickViewX 로 바꿔치기해도 통과한다(변이 검증에서 걸렸다).
for (const keep of ['recvQuickView', 'setReceived', 'hjPayLog']) {
  if (!new RegExp('function\\s+' + keep + '\\s*\\(').test(html)) {
    fail.push('수금 입력 경로가 사라졌다: ' + keep + '() — 장부·부가세 근거가 끊긴다');
  }
}
if (html.indexOf('data-recv=') === -1) fail.push('현장 목록의 수금액 입력칸(data-recv)이 사라졌다');

/* ⑤ 계약서의 지급 조건(계약금·중도금·잔금)은 계약 내용이라 남는다 */
if (html.indexOf('pay_plan') === -1) fail.push('분할납 계획(pay_plan)이 사라졌다 — 지급 조건은 계약 내용이다');


/* ⑥ 미수 "숫자 표시"가 되살아나지 않는지 — 기능은 지웠는데 숫자만 다시 붙는 일이 잦다.
      아래는 전부 실제로 화면에 찍히던 문구/자리다. */
const GONE_TEXT = [
  '미수금 총액',     // 월간 보고서·경영 현황 지표 줄
  '미수금 현장',     // 월간 보고서 상세 목록
  '현재 미수',       // 입금 기록(recvQuickView) 상단 줄
  '남은 미수',       // 입금 저장 토스트·승인함 사유
  '미수 확정',       // '받은 게 없어요' 버튼
  '미수금 에이징',   // 없어진 화면 이름(도움말에 남아 있으면 없는 화면을 안내한다)
  '총 미수금',
];
for (const t of GONE_TEXT) {
  if (html.indexOf(t) !== -1) fail.push('index.html 에 "' + t + '" 표시가 돌아왔다');
}

/* ⑦ 엑셀 시트 헤더 — 세무사에게 나가는 표에 미수 칸이 다시 생기면 안 된다.
      헤더 배열만 본다(주석에 '미수'가 들어 있다고 실패하면 안 된다). */
// 헤더는 그 시트에만 있는 칸 이름으로 집는다 — `const s1` 은 파일에 여럿이라
// 변수명으로 찾으면 엉뚱한 시트를 검사한다(첫 시도에서 실제로 그랬다).
const SHEETS = [
  { name: '전체 장부 ① 현장', re: /\[\[([^\]]*'견적합계'[^\]]*)\]\]/, keep: ['수금', '마진'] },
  { name: '견적 정산 시트1', re: /\[\[([^\]]*'수금률\(%\)'[^\]]*)\]\]/, keep: ['견적(매출)', '수금액'] },
];
for (const sh of SHEETS) {
  const m = html.match(sh.re);
  if (!m) { fail.push(sh.name + ' 헤더를 찾지 못했다 — 검사가 무력해졌다'); continue; }
  if (m[1].indexOf('미수') !== -1) fail.push(sh.name + ' 헤더에 미수 칸이 돌아왔다: ' + m[1]);
  for (const k of sh.keep) {
    if (m[1].indexOf(k) === -1) fail.push(sh.name + ' 헤더에서 "' + k + '" 이 사라졌다 — 남기기로 한 값이다');
  }
}
// 정산표 합계행의 미수 누산기
if (/\btDue\b/.test(html)) fail.push('정산표에 미수 합계(tDue)가 돌아왔다');
for (const keep of ['tEst', 'tRecv']) {
  if (!new RegExp('\\b' + keep + '\\b').test(html)) fail.push('정산표 합계에서 ' + keep + ' 이 사라졌다');
}

/* ⑧ 한눈 보기(홈 위젯)는 앱을 열기도 전에 보이는 화면이다 — 여기 미수가 뜨면 제일 나쁘다 */
const glance = html.match(/localStorage\.setItem\('hj_glance',[\s\S]{0,400}?\}\)\);/);
if (!glance) fail.push('한눈 보기 캐시(hj_glance)를 찾지 못했다 — 검사가 무력해졌다');
else if (/\bdue\b/.test(glance[0])) fail.push('한눈 보기 캐시에 미수(due)가 돌아왔다');

/* ⑨ 입금 기록 화면은 남되(장부 근거), 미수액을 미리 채워 주지도 말아야 한다.
      '전액 ○○원' 버튼이 곧 미수 표시였다. */
const rq = html.match(/function recvQuickView\([\s\S]*?\n\}/);
if (!rq) fail.push('recvQuickView 본문을 찾지 못했다 — 검사가 무력해졌다');
else {
  // 따옴표까지 본다 — indexOf('rqAmt') 는 rqAmtX 로 바꿔치기해도 통과한다(변이 검증에서 걸렸다)
  for (const id of ['rqAmt', 'rqDate']) {
    if (rq[0].indexOf('id="' + id + '"') === -1) fail.push('입금 기록 화면에서 ' + id + ' 칸이 사라졌다 — 장부 입력이 끊긴다');
  }
  for (const gone of ['rqFull', 'rqHalf', 'rqNone']) {
    if (rq[0].indexOf(gone) !== -1) fail.push('입금 기록 화면에 ' + gone + ' (미수액 자동 채움)이 돌아왔다');
  }
}

/* ⑩ 현장 지도 핀의 빨간 테두리는 "이 집 돈 안 냈다"는 표시였다 */
if (/const ring\s*=\s*s\.due/.test(html)) fail.push('지도 핀에 미수 테두리가 돌아왔다');

if (fail.length) {
  console.error('FAIL  미수금 제거 상태가 깨졌다:');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS  미수금 기능·표시 제거 유지 · 수금 입력 경로와 견적/수금액 보존');

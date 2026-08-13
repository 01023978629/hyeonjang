/* receivable-removed.check.js — 미수금 기능이 되살아나지 않는지 지킨다

   2026-08-13, 대표 결정: 앱이 미수금을 추적하고 독촉하도록 챙기는 일을 전부
   없앴다. 1인 사업장에서 입금 여부는 통장을 보면 되는 일이고, 앱이 매일
   "못 받은 돈"을 들이밀면 그 알림 자체를 안 믿게 된다.

   남긴 것과 없앤 것을 분명히 해 둔다 — 이 선이 흐려지면 다음 사람이
   "편의상" 하나씩 되살린다.

     없앰: 미수금 팔로업·독촉 문안·에이징(30/60/90)·일괄 완납·미수금 리포트·
           파수꾼의 '못 받은 돈'/'입금 확인 필요' 절·운영 루프의 미수금 작업
     남김: 수금액 입력(현장 목록의 수금액 칸·recvQuickView)과 payLog —
           장부와 부가세 근거라 지우면 안 된다

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

if (fail.length) {
  console.error('FAIL  미수금 제거 상태가 깨졌다:');
  for (const f of fail) console.error('  - ' + f);
  process.exit(1);
}
console.log('PASS  미수금 기능 제거 유지 · 수금 입력 경로 보존');

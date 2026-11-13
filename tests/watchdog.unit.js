/* watchdog.unit.js — Apps Script 파수꾼(Watchdog.gs) 순수 계산 검증
   Watchdog.gs 의 watchScan_ 계열은 GAS API를 쓰지 않는 순수 함수라 Node에서 그대로 돌린다.
   중점: 보증 D-day·AS·방치·일정.

   2026-08-13 — 미수금 경보를 없애면서 관련 검사(미수금 계산·소액 무시·
   입금 확인 분리·중도금 약속일·견적 중복제거)를 걷어냈다. 견적 중복제거는
   미수금 계산에만 쓰이던 것이라 함께 사라졌다. 대신 '되살아나지 않는지'를
   아래에서 확인한다. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// HJ_WATCHDOG_SRC=<파일> 이면 그 사본으로 돈다(변이 검사 — 보호 동작을 일부러 되돌린 사본에서 실패해야 한다)
const src = fs.readFileSync(process.env.HJ_WATCHDOG_SRC || path.join(__dirname, '..', 'apps-script', 'Watchdog.gs'), 'utf8');
const sandbox = {
  // 로드 시점에 호출되지 않지만, 혹시 참조돼도 죽지 않게 최소 스텁
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'test@example.com' }) },
  MailApp: { sendEmail() {} },
  ScriptApp: { getProjectTriggers: () => [] },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.message || e) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }
function eq(a, b, m) { if (a !== b) throw new Error('assert: ' + m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

// 날짜 헬퍼: N일 전 YYYY-MM-DD
function ago(n) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function ahead(n) { return ago(-n); }

test('보증 만료 — D-60 이내만, doneAt+1년 규칙', () => {
  const data = {
    projects: [
      { name: '만료임박', received: 0, doneAt: ago(365 - 30), customer: { phone: '010-3333-4444' } }, // D-30
      { name: '아직멀었음', received: 0, doneAt: ago(100) },                                          // D-265
      { name: '이미만료', received: 0, doneAt: ago(400) },                                            // 지남 → 제외
    ],
    files: [],
  };
  const r = sandbox.watchScan_(data);
  eq(r.warranty.length, 1, 'D-60 이내 1건만');
  eq(r.warranty[0].name, '만료임박', '현장명');
  assert(r.warranty[0].dday >= 28 && r.warranty[0].dday <= 32, 'D-30 근방: ' + r.warranty[0].dday);
  eq(r.warranty[0].phone, '010-3333-4444', '연락처 전달');
});

test('보증 — 항목별 warranty.items 있으면 가장 늦은 만료일 기준', () => {
  const data = {
    projects: [{
      name: '항목보증', received: 0, doneAt: ago(700),
      warranty: { startedAt: ago(700), items: [{ name: '도배', expiresAt: ago(30) }, { name: '방수', expiresAt: ahead(20) }] },
    }],
    files: [],
  };
  const r = sandbox.watchScan_(data);
  eq(r.warranty.length, 1, 'items 기준으로 아직 유효 → 임박 1건');
  assert(r.warranty[0].dday >= 18 && r.warranty[0].dday <= 22, '가장 늦은 항목(방수) 기준 D-20: ' + r.warranty[0].dday);
});

test('AS — 미처리만, done 제외, 경과일 최대값', () => {
  const data = {
    projects: [{ name: '괴산현장', received: 0 }],
    files: [],
    asLog: [
      { project: '괴산현장', date: ago(10), text: '화장실 누수', status: 'open' },
      { project: '괴산현장', date: ago(2), text: '문짝 삐걱', status: 'open' },
      { project: '괴산현장', date: ago(50), text: '끝난 건', status: 'done' },
      { project: '둔산동', date: ago(1), text: '어제 접수', status: 'open' },   // 3일 미만 → 제외
    ],
  };
  const r = sandbox.watchScan_(data);
  eq(r.as.length, 1, '괴산현장만');
  eq(r.as[0].name, '괴산현장', '현장명');
  eq(r.as[0].count, 2, '미처리 2건(done 제외)');
  eq(r.as[0].days, 10, '가장 오래된 건 기준');
});

test('방치 현장 — 진행 중인데 21일 이상 조용한 것만', () => {
  const data = {
    projects: [
      { name: '멈춤', received: 0 },
      { name: '활발', received: 0 },
      { name: '완료됨', received: 0, doneAt: ago(60) },   // 완료 → 방치 대상 아님
    ],
    files: [
      { kind: 'photo', project: '멈춤', name: 'a.jpg', when: ago(40) + 'T09:00:00.000Z' },
      { kind: 'photo', project: '활발', name: 'b.jpg', when: ago(2) + 'T09:00:00.000Z' },
      { kind: 'photo', project: '완료됨', name: 'c.jpg', when: ago(90) + 'T09:00:00.000Z' },
    ],
    schedule: [],
  };
  const r = sandbox.watchScan_(data);
  eq(r.stale.length, 1, '멈춤 1건만');
  eq(r.stale[0].name, '멈춤', '현장명');
  eq(r.stale[0].days, 40, '마지막 움직임 40일 전');
});

test('보관(archived) 현장은 모든 경보에서 제외', () => {
  const data = {
    projects: [{ name: '보관됨', received: 0, doneAt: ago(100), archived: true }],
    files: [{ kind: 'estimate', project: '보관됨', name: 'q.xlsx', est: { amount: 9000000 }, when: ago(120) }],
  };
  const r = sandbox.watchScan_(data);
  eq(r.total, 0, '보관 현장은 경보 0건');
});

test('오늘·내일 일정 — 경보(total)에는 포함하지 않음', () => {
  const data = {
    projects: [],
    files: [],
    schedule: [
      { date: ago(0), time: '09:00', title: '철거', project: '괴산현장' },
      { date: ahead(1), time: '10:00', title: '방수', project: '둔산동' },
      { date: ahead(5), time: '09:00', title: '먼 일정', project: 'X' },
    ],
  };
  const r = sandbox.watchScan_(data);
  eq(r.today.length, 2, '오늘+내일만');
  eq(r.today[0].when, '오늘', '오늘 먼저');
  eq(r.total, 0, '일정은 경보 수에 안 들어감');
});

test('★AS 알림에 전화번호 — 폰에서 바로 전화 걸 수 있게', () => {
  const data = {
    projects: [{ name: '괴산현장', received: 0, customer: { name: '김사장', phone: '010-9999-8888' } }],
    files: [],
    asLog: [{ project: '괴산현장', date: ago(9), text: '누수', status: 'open' }],
  };
  const r = sandbox.watchScan_(data);
  eq(r.as[0].phone, '010-9999-8888', 'AS 항목에 연락처가 실려야 함');
  assert(/010-9999-8888/.test(sandbox.watchText_(r)), '알림 본문에도 번호 노출');
});

test('★조용한 날이라도 오늘·내일 일정이 있으면 알린다(일정 유실 방지)', () => {
  // 경보 0건 + 일정 있음 → quiet 이면 안 된다
  const withSched = sandbox.watchScan_({
    projects: [], files: [],
    schedule: [{ date: ahead(1), time: '09:00', title: '타일팀 방문', project: '괴산현장' }],
  });
  eq(withSched.total, 0, '경보는 0건');
  eq(withSched.today.length, 1, '내일 일정 1건');
  // dailyWatch 의 판정식과 동일한 규칙을 확인
  const quiet = (withSched.total === 0 && withSched.today.length === 0);
  assert(quiet === false, '일정이 있으면 조용한 날로 보면 안 됨 — 내일 타일팀이 오는데 폰이 조용하면 안 된다');

  const empty = sandbox.watchScan_({ projects: [], files: [], schedule: [] });
  assert((empty.total === 0 && empty.today.length === 0) === true, '아무것도 없으면 조용한 날이 맞음');
});

test('쓰지 않는 기준값을 선언해두지 않는다(구현된 척 방지)', () => {
  // dueAfterDone·dueMin 은 미수금 경보를 없애면서 쓰는 곳이 사라졌다(2026-08-13).
  // 남겨두면 '아직 미수금을 본다'고 오해할 근거가 되므로 선언도 없어야 한다.
  ['quoteSilent', 'dueAfterDone', 'dueMin'].forEach(k => {
    assert(!(k in sandbox.W), k + ' 는 쓰는 곳이 없으므로 선언도 없어야 함');
  });
  ['warrantySoon', 'asStale', 'projStale'].forEach(k => {
    assert(k in sandbox.W, '실제 쓰이는 기준값은 있어야 함: ' + k);
  });
});

test('빈 자료·깨진 자료에도 죽지 않음', () => {
  [{}, { projects: null, files: 'x' }, { projects: [null, {}], files: [null] }].forEach((d, i) => {
    const r = sandbox.watchScan_(d);
    eq(r.total, 0, '케이스 ' + i + ' 경보 0');
  });
});

test('알림 문구(텍스트) — 캘린더·시트용, 금액·경과일·연락처가 그대로 읽힘', () => {
  const data = {
    payLog: [{ d: ago(35), project: '괴산현장', amt: 5000000 }],
    projects: [
      { name: '괴산현장', received: 5000000, doneAt: ago(30), customer: { name: '김사장', phone: '010-1111-2222' } },
      { name: '보증임박', received: 0, doneAt: ago(365 - 20) },
    ],
    files: [{ kind: 'estimate', project: '괴산현장', name: 'q.xlsx', est: { amount: 11000000 }, when: ago(60) }],
    asLog: [{ project: '괴산현장', date: ago(9), text: '누수', status: 'open' }],
  };
  const r = sandbox.watchScan_(data);
  const t = sandbox.watchText_(r);
  assert(t.indexOf('<') === -1, 'HTML 태그가 섞이면 안 됨(캘린더 설명은 순수 텍스트)');
  assert(!/못 받은 돈|미수금/.test(t), '미수금 절은 없어야 한다: ' + t.slice(0, 200));
  assert(/밀린 AS/.test(t), 'AS 섹션');
  // watch-v4: 기본(WATCH_SECTIONS 없음 = 'work')은 작업 일정 + AS 만 — 보증·방치는 'all' 일 때만
  assert(!/보증 만료 임박/.test(t), '기본에는 보증 섹션이 없다');
  withProps({ WATCH_SECTIONS: 'all' }, () => assert(/보증 만료 임박/.test(sandbox.watchText_(r)), "'all' 이면 보증 섹션"));
});

test('알림 문구 — 조용한 날은 오늘·내일 "잡힌 작업 없음"', () => {
  const t = sandbox.watchText_(sandbox.watchScan_({ projects: [], files: [] }));
  assert(/■ 오늘 작업 — [\s\S]*잡힌 작업 없음[\s\S]*■ 내일 작업 — [\s\S]*잡힌 작업 없음/.test(t), '오늘·내일 작업 없음 문구: ' + t.slice(0, 160));
});

test('알림 경로 — 기본은 캘린더(메일 아님), 설정에 따라 분기', () => {
  const calls = [];
  const mk = (props) => {
    const box = Object.assign({}, sandbox);
    box.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) };
    box.CalendarApp = { getDefaultCalendar: () => { calls.push('calendar'); return null; } };
    box.SpreadsheetApp = { open: () => { calls.push('sheet'); throw new Error('stub'); },
                           create: () => { calls.push('sheet'); throw new Error('stub'); } };
    box.MailApp = { sendEmail: () => { calls.push('mail'); } };
    box.DriveApp = { getFileById: () => ({}), getRootFolder: () => ({ removeFile() {} }) };
    box.rootFolder_ = () => ({ getFilesByName: () => ({ hasNext: () => false }) });
    box.Logger = { log() {} };
    return box;
  };
  // 기본(설정 없음) → 캘린더
  calls.length = 0;
  let b = mk({});
  vm.createContext(b); vm.runInContext(src, b);
  b.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  b.CalendarApp = { getDefaultCalendar: () => { calls.push('calendar'); return null; } };
  b.MailApp = { sendEmail: () => { calls.push('mail'); } };
  b.Logger = { log() {} };
  b.watchDeliver_('제목', '본문', null);
  assert(calls.indexOf('calendar') !== -1, '기본은 캘린더 시도: ' + JSON.stringify(calls));
  assert(calls.indexOf('mail') === -1, '기본에서 메일은 쓰지 않음: ' + JSON.stringify(calls));

  // mail 로 명시했을 때만 메일
  calls.length = 0;
  let b2 = mk({});
  vm.createContext(b2); vm.runInContext(src, b2);
  b2.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'WATCH_CHANNEL' ? 'mail' : null) }) };
  b2.MailApp = { sendEmail: () => { calls.push('mail'); } };
  b2.Session = { getEffectiveUser: () => ({ getEmail: () => 'a@b.c' }) };
  b2.CalendarApp = { getDefaultCalendar: () => { calls.push('calendar'); return null; } };
  b2.Logger = { log() {} };
  b2.watchDeliver_('제목', '본문', null);
  assert(calls.indexOf('mail') !== -1, "WATCH_CHANNEL='mail' 이면 메일: " + JSON.stringify(calls));
  assert(calls.indexOf('calendar') === -1, 'mail 지정 시 캘린더는 안 씀: ' + JSON.stringify(calls));
});

test('알림 경로 — 한 경로가 실패해도 예외를 밖으로 던지지 않음(파수꾼이 죽지 않게)', () => {
  const b = Object.assign({}, sandbox);
  vm.createContext(b); vm.runInContext(src, b);
  b.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'WATCH_CHANNEL' ? 'both' : null) }) };
  b.CalendarApp = { getDefaultCalendar: () => { throw new Error('캘린더 권한 없음'); } };
  b.rootFolder_ = () => { throw new Error('폴더 없음'); };
  const logs = [];
  b.Logger = { log: (m) => logs.push(String(m)) };
  let threw = false;
  try { b.watchDeliver_('제목', '본문', null); } catch (e) { threw = true; }
  assert(!threw, '전달 실패해도 예외가 밖으로 나오면 안 됨');
  assert(logs.some(l => /전달 실패/.test(l)), '조용히 삼키지 않고 로그로 남김: ' + JSON.stringify(logs));
});

test('메일 HTML 생성 — XSS 차단(현장명에 태그 넣어도 이스케이프)', () => {
  // 미수금 절이 사라졌으므로 AS 경보로 시드한다 — 확인하려는 건 이스케이프이지 미수금이 아니다.
  const data = {
    projects: [{ name: '<img src=x onerror=alert(1)>', received: 0, doneAt: ago(30) }],
    asLog: [{ project: '<img src=x onerror=alert(1)>', date: ago(20), text: '누수', status: 'open' }],
  };
  const r = sandbox.watchScan_(data);
  const html = sandbox.watchHtml_(r, data);
  assert(html.indexOf('<img src=x') === -1, '원본 태그가 그대로 들어가면 안 됨');
  assert(html.indexOf('&lt;img') !== -1, '이스케이프되어 들어감');
});

test('제목 — 작업·AS 건수, 없으면 잡힌 작업 없음', () => {
  const none = sandbox.watchScan_({ projects: [], files: [] });
  assert(/잡힌 작업 없음/.test(sandbox.watchSubject_(none)), '조용한 날 제목: ' + sandbox.watchSubject_(none));
  const some = sandbox.watchScan_({
    projects: [{ name: 'A', received: 0, doneAt: ago(30) }],
    asLog: [{ project: 'A', date: ago(20), text: '누수', status: 'open' }],
  });
  const s = sandbox.watchSubject_(some);
  assert(/🔧 AS 1/.test(s), '경보 제목에 건수: ' + s);
  assert(!/미수금|못 받은 돈/.test(s), '제목에 미수금이 남으면 안 된다: ' + s);
});


// ── watch-v4 (2026-11-03) — 구글 캘린더에는 작업 일정만: 💰 수금·입금·세금·개인 일정과 금액은 넣지 않는다 ──
function withProps(props, fn) {
  const keep = sandbox.PropertiesService;
  sandbox.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) };
  try { return fn(); } finally { sandbox.PropertiesService = keep; }
}
const MONEY_SCHED = [
  { date: ago(0), time: '09:00', title: '💰 잔금 수금 3,000만', project: '괴산현장' },
  { date: ago(0), time: '', title: '💰 수금: 둔산동', project: '둔산동' },
  { date: ahead(1), time: '', title: '중도금 입금 확인', project: '괴산현장' },
  { date: ahead(1), time: '09:00', title: '부가세 예정고지 납부', _taxAuto: true },
  { date: ahead(3), time: '', title: '개인 시험', sourceUid: 'x@test' },
  { date: ahead(4), time: '', title: '계약금 받기', project: 'X' },
];

test('v4 💰 수금·입금·잔금·세금 자동·개인 일정은 오늘·내일·다가오는 작업 어디에도 없다', () => {
  const r = sandbox.watchScan_({ projects: [], files: [], schedule: MONEY_SCHED.concat([
    { date: ago(0), time: '08:00', title: '철거', project: '괴산현장', crew: '김철거' },
    { date: ahead(2), time: '', title: '욕조방수', project: '가상빌라' }]) });
  eq(r.today.map(x => x.title).join('|'), '철거', '오늘·내일은 작업만');
  eq(r.ahead.map(x => x.title).join('|'), '욕조방수', '다가오는 작업도 작업만');
  const t = sandbox.watchText_(r), subj = sandbox.watchSubject_(r);
  assert(!/💰|수금|입금|잔금|계약금|중도금|부가세|개인 시험|3,000만|원\b/.test(t.replace(/💰 수금·세금 일정과 금액은 넣지 않음/, '')), '본문에 돈 이야기가 없다: ' + t);
  assert(!/💰|수금|입금/.test(subj), '제목에도 없다: ' + subj);
  assert(/08:00 철거 \/ 괴산현장 \/ 👤 김철거/.test(t), '작업 줄 = 시각·작업·현장·담당: ' + t);
  assert(/■ 다가오는 작업 \(7일 안\)\n  · \d+\/\d+\([일월화수목금토]\) 종일 욕조방수 \/ 가상빌라/.test(t), '다가오는 작업 줄: ' + t);
});

test('v4 여러 날 공정 — 이어지는 날 N/M일째(일요일 빼고), 완료 보고면 끝, 공정표 꼬리 뗌', () => {
  // 어제 시작한 3일짜리(어제·오늘·내일 — 사이에 일요일이 끼면 하루 밀린다)
  const start = ago(1), span = [start];
  { const d = new Date(start + 'T00:00:00'); while (span.length < 3) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) span.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)); } }
  const memo = start + '~' + span[2] + ' (3일)';
  const r = sandbox.watchScan_({ projects: [], files: [], schedule: [
    { date: start, time: '09:00', title: '도배 (3일차 시작)', project: '가상빌라', memo },
    { date: start, time: '09:00', title: '타일 (3일차 시작)', project: '가상빌라', memo, report: { progress: '완료' } }] });
  const isSun = new Date(ago(0) + 'T00:00:00').getDay() === 0;
  const todayDoba = r.today.filter(x => x.when === '오늘' && x.title === '도배');
  if (isSun) eq(todayDoba.length, 0, '일요일은 이어지는 날이 아니다');
  else { eq(todayDoba.length, 1, '오늘은 이어지는 날'); eq(todayDoba[0].cont.day + '/' + todayDoba[0].cont.days, '2/3', 'N/M일째'); }
  assert(!r.today.some(x => x.title === '타일'), '완료 보고한 공정은 이어지지 않는다');
  assert(!r.today.some(x => /일차 시작/.test(x.title)), '공정표 꼬리는 뗀다');
  if (!isSun) assert(/도배 \(2\/3일째\) \/ 가상빌라/.test(sandbox.watchText_(r)), '본문 줄: ' + sandbox.watchText_(r));
});

test("v4 기본(work)은 보증·방치를 캘린더에서 빼고(계산은 그대로 — 시트 칸), 'all' 이면 예전처럼", () => {
  const data = {
    projects: [{ name: '멈춤', received: 0 }, { name: '보증임박', received: 0, doneAt: ago(365 - 20) }],
    files: [{ kind: 'photo', project: '멈춤', name: 'a.jpg', when: ago(40) + 'T09:00:00.000Z' }], schedule: [] };
  const r = sandbox.watchScan_(data);
  eq(r.stale.length, 1, '방치 계산은 그대로'); eq(r.warranty.length, 1, '보증 계산은 그대로');
  assert(!/방치|보증/.test(sandbox.watchSubject_(r)) && !/멈춰 있는 현장|보증 만료/.test(sandbox.watchText_(r)), '기본 캘린더에는 없다');
  eq(sandbox.watchQuiet_(r), true, '작업·AS 가 없으면 조용한 날(방치만으로는 매일 알리지 않는다)');
  withProps({ WATCH_SECTIONS: 'all' }, () => {
    assert(/보증만료 1/.test(sandbox.watchSubject_(r)) && /방치 1/.test(sandbox.watchSubject_(r)), "'all' 제목");
    assert(/멈춰 있는 현장/.test(sandbox.watchText_(r)) && /보증 만료 임박/.test(sandbox.watchText_(r)), "'all' 본문");
    eq(sandbox.watchQuiet_(r), false, "'all' 이면 경보로 알린다");
  });
});

test('v4 제목 — 오늘·내일 작업 수, 없으면 다음 작업 날짜, AS 는 따로', () => {
  const r1 = sandbox.watchScan_({ projects: [], files: [], schedule: [
    { date: ago(0), time: '09:00', title: '철거', project: 'A' }, { date: ahead(1), time: '', title: '방수', project: 'A' }, { date: ahead(1), time: '', title: '설비', project: 'B' }] });
  eq(sandbox.watchSubject_(r1), '📅 오늘 작업 1 · 내일 2', '오늘·내일');
  const r2 = sandbox.watchScan_({ projects: [], files: [], schedule: [{ date: ahead(5), time: '', title: '욕조방수', project: 'A' }] });
  assert(/^📅 다음 작업 \d+\/\d+\([일월화수목금토]\)$/.test(sandbox.watchSubject_(r2)), '다음 작업: ' + sandbox.watchSubject_(r2));
  eq(sandbox.watchQuiet_(r2), true, '모레 이후만 있으면 매일 알리지 않는다(월요일 확인 때 보인다)');
  const r3 = sandbox.watchScan_({ projects: [{ name: 'A', received: 0 }], files: [], schedule: [],
    asLog: [{ project: 'A', date: ago(9), text: '누수', status: 'open' }] });
  eq(sandbox.watchSubject_(r3), '🔧 AS 1', 'AS 만');
});

test('미수금 경보는 되살아나지 않는다', () => {
  // 지우기만 하면 언젠가 조용히 돌아온다. 결과 스키마와 본문 양쪽을 못박는다.
  const r = sandbox.watchScan_(({
    projects: [{ name: '완료현장', received: 0, doneAt: ago(90), dueDate: ago(90) }],
    files: [{ project: '완료현장', kind: 'estimate', est: { amount: 11000000 } }]
  }));
  assert(r.due === undefined, '결과에 due 가 없어야 한다');
  assert(r.uncertain === undefined, '결과에 uncertain 이 없어야 한다');
  assert(r.cash === undefined, '결과에 cash(못 받은 돈 합계)가 없어야 한다');
  const txt = sandbox.watchText_(r);
  assert(!/못 받은 돈|미수금|입금 확인 필요/.test(txt), '본문에 미수금 문구가 남아 있다: ' + txt.slice(0, 200));
  const html = sandbox.watchHtml_ ? sandbox.watchHtml_(r) : '';
  assert(!/못 받은 돈|입금 확인 필요/.test(html), 'HTML 에 미수금 절이 남아 있다');
});

// ── watch-v5 (2026-11-04) — '[파수꾼]' 요약 대신 앱의 실제 작업 일정을 구글 캘린더 일정으로 하나씩 맞춘다 ──
function localYmd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
// 가짜 캘린더 — CalendarApp 일정이 쓰는 메서드만. 지운 일정은 deleted 로 남겨 무엇을 지웠는지 본다.
function fakeCal() {
  const evs = [];
  let seq = 0;
  const mk = (title, start, end, allDay, opt) => {
    const e = { id: ++seq, title, start, end, allDay, desc: (opt && opt.description) || '', loc: (opt && opt.location) || '', tags: {}, deleted: false, edits: [] };
    const api = {
      _e: e,
      getTitle: () => e.title,
      setTitle: t => { e.title = t; e.edits.push('title'); return api; },
      setDescription: d => { e.desc = d; e.edits.push('desc'); return api; },
      setLocation: l => { e.loc = l; e.edits.push('loc'); return api; },
      setTime: (s, en) => { e.start = s; e.end = en; e.allDay = false; e.edits.push('time'); return api; },
      setAllDayDate: d => { e.start = d; e.end = new Date(d.getTime() + 86400000); e.allDay = true; e.edits.push('allday'); return api; },
      isAllDayEvent: () => e.allDay,
      getAllDayStartDate: () => e.start,
      getStartTime: () => e.start,
      getTag: k => (Object.prototype.hasOwnProperty.call(e.tags, k) ? e.tags[k] : null),
      setTag: (k, v) => { e.tags[k] = v; return api; },
      deleteEvent: () => { e.deleted = true; },
      getLocation: () => e.loc,
      getEventType: () => e.type || 'DEFAULT',
      getMyStatus: () => e.status || 'OWNER',
      addPopupReminder: m => { (e.reminders = e.reminders || []).push(m); return api; }
    };
    evs.push(api);
    return api;
  };
  return {
    evs,
    created: () => evs.length,
    createEvent: (t, s, en, opt) => mk(t, s, en, false, opt),
    createAllDayEvent: (t, d, opt) => mk(t, d, new Date(d.getTime() + 86400000), true, opt),
    getEvents: (s, en) => evs.filter(a => !a._e.deleted && a._e.start < en && a._e.end > s),
    live: () => evs.filter(a => !a._e.deleted),
    mine: () => evs.filter(a => !a._e.deleted && a._e.tags.hjKey),
    byKey: k => evs.filter(a => !a._e.deleted && a._e.tags.hjKey === k)
  };
}
const V5_DATA = () => ({
  projects: [{ name: '열매마을', customer: { name: '홍길동', phone: '010-1111-2222', addr: '세종 아름동 열매마을 9단지' } }, { name: '목동' }],
  schedule: [
    { id: 'yeol', date: ahead(9), time: '', title: '열매마을 908-903 욕조방수', project: '열매마을', memo: '공동현관 #0908 / 현관 0139* / 거실 욕조자리만 · 잔금 300만' },
    { id: 'mok', date: ahead(2), time: '09:00', hours: 4, title: '철거 (1일차 시작)', project: '목동', crew: '우철', workers: '2', memo: ahead(2) + '~' + ahead(6) + ' (4일) · 자재 반입 150,000원' },
    { id: 'pay', date: ahead(1), time: '', title: '💰 잔금 수금 3,000만', project: '목동' },
    { id: 'mid', date: ahead(3), time: '', title: '중도금 입금 확인', project: '목동' },
    { id: 'tax', date: ahead(1), time: '09:00', title: '부가세 예정고지 납부', _taxAuto: true },
    { id: 'me', date: ahead(5), time: '', title: '개인 시험', sourceUid: 'x@test' }
  ]
});

test('v5 캘린더에 넣을 일정 — 작업만, 시각/종일, 여러 날 공정은 날마다(일요일 빼고), 금액·출입 번호·고객 연락처 없음', () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const r = sandbox.watchCalItems_(V5_DATA(), today);
  const keys = r.items.map(i => i.key);
  assert(keys.indexOf('pay') < 0 && keys.indexOf('mid') < 0 && keys.indexOf('tax') < 0 && keys.indexOf('me') < 0, '💰·수금·세금·개인 일정 제외: ' + keys);
  const mokDays = r.items.filter(i => i.key === 'mok' || i.key.indexOf('mok-d') === 0);
  // 시작일은 일요일이어도 넣고(그날 잡은 일정 그대로 — 앱 hjSchSpan·hjSchContDates 와 같음), 이어지는 날만 일요일을 뺀다.
  // 예전 기대값은 시작일까지 일요일을 빼서, 모레가 일요일인 날(금요일)에 돌면 떨어졌다(2026-11-13 CI). 공정 일수도 날짜에서 센다.
  const span = []; for (let n = 2; n <= 6; n++) { const d = new Date(today); d.setDate(d.getDate() + n); if (n === 2 || d.getDay() !== 0) span.push(localYmd(d)); }
  eq(mokDays.map(i => i.date).join(','), span.join(','), '여러 날 공정 날짜 — 이어지는 날은 일요일 제외');
  assert(mokDays.length >= 4 && mokDays.length <= 5, '4일 공정이면 날마다 하나: ' + mokDays.length);
  eq(mokDays[0].title, '[목동] 철거 (' + span.length + '일 · ~' + sandbox.watchMdDow_(ahead(6)) + ')', '첫날 제목');
  eq(mokDays[1].title, '[목동] 철거 (2/' + span.length + '일째)', '이어지는 날 제목');
  eq(mokDays[0].time + '/' + mokDays[0].hours, '09:00/4', '시각 일정 — 작업 시간 4시간');
  const y = r.items.find(i => i.key === 'yeol');
  eq(y.title, '열매마을 908-903 욕조방수', '제목에 현장 이름이 이미 있으면 [현장] 을 또 붙이지 않는다');
  eq(y.time + '/' + y.hours, '/0', '시각 없으면 종일');
  eq(y.loc, '세종 아름동 열매마을 9단지', '주소는 장소로');
  const all = r.items.map(i => i.title + '\n' + i.desc + '\n' + i.loc).join('\n');
  assert(!/0908|0139|300만|150,000|원\b|홍길동|010-1111/.test(all), '출입 번호·금액·고객 이름·전화가 없어야: ' + all);
  assert(/메모: 거실 욕조자리만/.test(y.desc) && /메모: 자재 반입|현장: 목동/.test(mokDays[0].desc), '나머지 메모는 남는다: ' + y.desc);
  assert(/담당: 우철/.test(mokDays[0].desc) && /예정 인원 2명/.test(mokDays[0].desc), '담당·인원');
  assert(!/~/.test(mokDays[0].desc.split('\n').filter(l => /^메모/.test(l)).join('')), '공정표 기간은 메모에서 뗀다');
});

test('v5 완료 보고된 여러 날 공정은 첫날만, 범위(31일 전~180일 뒤) 밖은 넣지 않는다', () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const r = sandbox.watchCalItems_({ projects: [], schedule: [
    { id: 'done', date: ahead(1), title: '방수', project: 'A', memo: ahead(1) + '~' + ahead(5) + ' (5일)', report: { progress: '완료' } },
    { id: 'old', date: ago(40), title: '철거', project: 'A' },
    { id: 'far', date: ahead(200), title: '도배', project: 'A' },
    { id: 'edge', date: ago(31), title: '타일', project: 'A' }
  ] }, today);
  eq(r.items.map(i => i.key).join(','), 'edge,done', '완료 보고면 첫날만 · 40일 전·200일 뒤는 제외 · 31일 전은 포함');
});

test('v5 맞추기 — 처음엔 만들고(태그), 다시 돌면 그대로, 앱에서 바꾸면 그 일정을 고치고, 지우면 지운다', () => {
  const cal = fakeCal(), now = new Date();
  const mine0 = cal.createAllDayEvent('사장님 개인 일정', sandbox.watchDate_(ahead(9)), {});   // 태그 없는 사장님 일정
  const d = V5_DATA();
  const r1 = sandbox.watchCalSync_(d, cal, now);
  assert(r1.created >= 5 && r1.updated === 0 && r1.deleted === 0, '처음엔 만들기만: ' + JSON.stringify(r1));
  eq(cal.mine().length, r1.created, '만든 일정에는 모두 hjKey 태그');
  const y = cal.byKey('yeol')[0];
  assert(y._e.allDay && y._e.title === '열매마을 908-903 욕조방수', '종일 일정으로 만든다');
  const m = cal.byKey('mok')[0];
  assert(!m._e.allDay && m._e.start.getHours() === 9 && (m._e.end - m._e.start) === 4 * 3600000, '09:00 부터 4시간');
  const r2 = sandbox.watchCalSync_(d, cal, now);
  eq(JSON.stringify([r2.created, r2.updated, r2.deleted]), '[0,0,0]', '다시 돌면 바꿀 것 없음: ' + JSON.stringify(r2));
  eq(r2.kept, r1.created, '모두 그대로');
  // 앱에서 시각·제목을 바꾸고, 열매마을 일정을 지움
  d.schedule[1].time = '13:00'; d.schedule[1].title = '철거·폐기물 (1일차 시작)';
  d.schedule.splice(0, 1);
  const r3 = sandbox.watchCalSync_(d, cal, now);
  assert(r3.updated >= 1 && r3.deleted === 1 && r3.created === 0, '고치기·지우기: ' + JSON.stringify(r3));
  eq(cal.byKey('mok')[0], m, '같은 캘린더 일정을 고친다(지우고 새로 만들지 않음)');
  assert(m._e.start.getHours() === 13 && /철거·폐기물/.test(m._e.title), '시각·제목 반영: ' + m._e.title);
  eq(cal.byKey('yeol').length, 0, '앱에서 지운 일정은 캘린더에서도 지운다');
  assert(!mine0._e.deleted && mine0._e.edits.length === 0, '태그 없는 사장님 일정은 건드리지 않는다');
});

test('v5 사장님이 이미 넣어 둔 같은 일정(같은 날·같은 작업·현장)은 하나 더 만들지 않는다 — 예전 [파수꾼] 요약은 같은 일정이 아니다', () => {
  const cal = fakeCal(), now = new Date();
  cal.createAllDayEvent('열매마을 908-903 욕조방수 @열매마을', sandbox.watchDate_(ahead(9)), {});
  cal.createEvent('[파수꾼] 📅 오늘 작업 1 — 철거 / 목동', sandbox.watchDateTime_(ahead(2), '07:00'), sandbox.watchDateTime_(ahead(2), '07:30'), {});
  const r = sandbox.watchCalSync_(V5_DATA(), cal, now);
  eq(r.skipped, 1, '열매마을은 이미 있음');
  eq(cal.byKey('yeol').length, 0, '같은 일정을 또 만들지 않는다');
  assert(cal.byKey('mok').length === 1, '[파수꾼] 요약이 있어도 목동 철거는 만든다');
});

test('v5 안전판 — 넣을 일정이 없는데 지울 것이 많으면 지우지 않고, 일정표가 없는 자료면 아무것도 바꾸지 않는다', () => {
  const cal = fakeCal(), now = new Date();
  const d = { projects: [], schedule: [1, 2, 3, 4, 5].map(n => ({ id: 's' + n, date: ahead(n), title: '작업' + n, project: 'A' })) };
  sandbox.watchCalSync_(d, cal, now);
  eq(cal.mine().length, 5, '5개 만듦');
  const r = sandbox.watchCalSync_({ projects: [], schedule: [] }, cal, now);
  eq(r.held, 5, '지우기 보류');
  eq(cal.mine().length, 5, '하나도 지우지 않음');
  let threw = false;
  try { sandbox.watchCalSync_({ projects: [] }, cal, now); } catch (e) { threw = true; }
  assert(threw && cal.mine().length === 5, '일정표(schedule)가 없는 자료는 던지고 그대로 둔다');
  // 겹친 태그 일정은 하나만 남긴다
  const dup = cal.createAllDayEvent('작업1', sandbox.watchDate_(ahead(1)), {}); dup.setTag('hjKey', 's1'); dup.setTag('hjSig', 'x');
  const r2 = sandbox.watchCalSync_(d, cal, now);
  eq(cal.byKey('s1').length, 1, '같은 키는 하나만: ' + JSON.stringify(r2));
});

test('v5 범위 밖(31일보다 지난) 태그 일정은 기록으로 두고 지우지 않는다', () => {
  const cal = fakeCal(), now = new Date();
  const old = cal.createAllDayEvent('[A] 옛 작업', sandbox.watchDate_(ago(45)), {}); old.setTag('hjKey', 'gone'); old.setTag('hjSig', 'x');
  sandbox.watchCalSync_({ projects: [], schedule: [{ id: 'n1', date: ahead(1), title: '새 작업', project: 'A' }] }, cal, now);
  assert(!old._e.deleted, '45일 전 일정은 지우지 않는다');
});

test("v5 dailyWatch — 기본은 '[파수꾼]' 요약을 만들지 않고 캘린더 일정만 맞춘다 · WATCH_SUMMARY=1 이면 요약도 · 자료를 못 읽으면 캘린더를 건드리지 않는다", () => {
  const withToday = () => { const d = V5_DATA(); d.schedule.push({ id: 'now', date: ago(0), time: '', title: '설비 점검', project: '목동' }); return d; };
  const run = (props, loadErr) => {
    const b = {};
    vm.createContext(b); vm.runInContext(src, b);
    const cal = fakeCal();
    b.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) };
    b.CalendarApp = { getDefaultCalendar: () => cal, getCalendarById: () => cal };
    b.Logger = { log() {} };
    b.watchLoadData_ = () => { if (loadErr) throw new Error('읽기 실패'); return withToday(); };
    const out = b.dailyWatch(false);
    return { cal, out };
  };
  const a = run({});
  assert(/^sync \+\d+/.test(a.out), '기본 결과: ' + a.out);
  assert(a.cal.live().every(e => e._e.title.indexOf('[파수꾼]') !== 0), '기본은 [파수꾼] 요약 일정을 만들지 않는다');
  assert(a.cal.mine().length >= 5, '실제 일정은 넣는다');
  const b2 = run({ WATCH_SUMMARY: '1', WATCH_HOUR: String(new Date().getHours()) });
  assert(b2.cal.live().some(e => e._e.title.indexOf('[파수꾼]') === 0), 'WATCH_SUMMARY=1 이고 그 시각이면 요약도: ' + b2.out);
  const c = run({ WATCH_SUMMARY: '1', WATCH_HOUR: String((new Date().getHours() + 3) % 24) });
  assert(c.cal.live().every(e => e._e.title.indexOf('[파수꾼]') !== 0) && /summary-later/.test(c.out), '요약은 하루 한 번 그 시각에만: ' + c.out);
  const e = run({}, true);
  eq(e.out, 'load-failed', '자료를 못 읽으면');
  eq(e.cal.live().length, 0, '캘린더에 경고 요약도 만들지 않는다(요약 끔)');
  const f = run({ WATCH_OFF: '1' });
  eq(f.out, 'off', 'WATCH_OFF=1 이면 멈춘다');
});

test('v5 설치 — 예전 매일 트리거를 지우고 매시간 트리거 하나', () => {
  const b = {};
  vm.createContext(b); vm.runInContext(src, b);
  const made = [], removed = [];
  const old = { getHandlerFunction: () => 'dailyWatch' }, other = { getHandlerFunction: () => 'doSomethingElse' };
  b.ScriptApp = {
    getProjectTriggers: () => [old, other],
    deleteTrigger: t => removed.push(t),
    newTrigger: fn => ({ timeBased: () => ({ everyHours: n => ({ create: () => made.push(fn + '@' + n + 'h') }), atHour: () => { throw new Error('매일 트리거는 쓰지 않는다'); } }) })
  };
  b.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
  b.Logger = { log() {} };
  const msg = b.installDailyWatch();
  eq(made.join(','), 'dailyWatch@1h', '매시간 트리거 하나');
  eq(removed.length, 1, '예전 dailyWatch 트리거만 지운다');
  eq(removed[0], old, '다른 트리거는 그대로');
  assert(/매시간/.test(msg), '안내: ' + msg);
});


// ── watch-v6 (2026-11-12) — '[파수꾼]' 이름을 '일정 알림'으로 · 매일 9시 내일 일정 요약 · 내일 일정이 없으면 보내지 않는다 ──
const at = (ymd, hm) => new Date(ymd + 'T' + hm + ':00');
function alertBox(props) {
  const b = {}; vm.createContext(b); vm.runInContext(src, b);
  const store = Object.assign({}, props || {}), mails = [];
  b.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); } }) };
  b.Logger = { log() {} };
  b.MailApp = { sendEmail: m => mails.push(m) };
  b.Session = { getEffectiveUser: () => ({ getEmail: () => 'owner@example.test' }) };
  return { b, store, mails };
}
// 오늘 11/12(목) · 내일 11/13(금)
const V6_DATA = () => ({
  projects: [{ name: '복수동 계룡A', customer: { name: '홍길동', phone: '010-1111-2222' } }, { name: '진잠타운' }, { name: '목동' }],
  schedule: [
    { id: 'a1', date: '2026-11-13', time: '10:00', title: '계룡A 6동 608호 우수관 1개, 세탁배관', project: '복수동 계룡A', crew: '우철', memo: '공동현관 #0608 · 잔금 30만' },
    { id: 'a2', date: '2026-11-13', time: '12:00', hours: 1, title: '진잠타운 105동 802호 우수관 1개', project: '진잠타운' },
    { id: 'a3', date: '2026-11-11', time: '', title: '철거 (1일차 시작)', project: '목동', memo: '2026-11-11~2026-11-14 (4일)' },
    { id: 'p', date: '2026-11-13', time: '', title: '💰 잔금 수금', project: '목동' },
    { id: 't', date: '2026-11-13', time: '09:00', title: '부가세 예정고지 납부', _taxAuto: true },
    { id: 'me', date: '2026-11-13', time: '', title: '개인 시험', sourceUid: 'x@test' },
    { id: 'x', date: '2026-11-14', time: '', title: '다른 날 작업', project: '목동' },
    { id: 'done', date: '2026-11-12', time: '', title: '방수', project: '목동', memo: '2026-11-12~2026-11-14 (3일)', report: { progress: '완료' } }
  ]
});
function v6Cal() {
  const cal = fakeCal(), D = '2026-11-13', day = sandbox.watchDate_(D);
  // 이 스크립트가 맞춰 둔 태그 일정 — 앱에서 시각을 바꾼 뒤 한 시간 맞추기가 아직 안 돈 옛 사본(09:00). 앱 일정으로 이미 세므로 따로 넣지 않는다
  const tagged = cal.createEvent('[복수동 계룡A] 계룡A 6동 608호 우수관 1개, 세탁배관', at(D, '09:00'), at(D, '10:00'), {}); tagged.setTag('hjKey', 'a1'); tagged.setTag('hjSig', 'x');
  cal.createEvent('@진잠타운 105동 802호 우수관 1개', at(D, '12:00'), at(D, '13:00'), {});        // 제미나이가 넣은 같은 일정 — 한 줄로
  cal.createAllDayEvent('@철거', day, {});                                                        // 앱의 여러 날 공정 셋째 날과 같은 일정
  cal.createAllDayEvent('[다른현장] 철거', day, {});                                              // 다른 현장의 같은 작업 — 합치지 않는다
  cal.createEvent('@한밭우성A 101동 403호 우수관1개', at(D, '15:00'), at(D, '16:00'), { location: '한밭우성A 101동' });
  cal.createEvent('치과 예약', at(D, '17:30'), at(D, '18:00'), { location: '공동현관 1234' });   // 출입 번호처럼 보이는 장소는 뺀다
  cal.createEvent('💰 잔금 받기', at(D, '09:00'), at(D, '09:30'), {});
  cal.createEvent('[파수꾼] 📅 오늘 작업 1', at(D, '07:00'), at(D, '07:30'), {});
  cal.createEvent('[일정 알림] 내일 11/14(토) 일정 1건', at(D, '09:00'), at(D, '09:30'), {});
  cal.createAllDayEvent('김철수 생일', day, {});
  cal.createAllDayEvent('기념일', day, {})._e.type = 'BIRTHDAY';
  cal.createEvent('협력사 미팅', at(D, '14:00'), at(D, '15:00'), {})._e.status = 'NO';             // 거절한 초대
  cal.createEvent('야간 누수 점검', at('2026-11-12', '22:00'), at(D, '02:00'), {});                 // 오늘 밤 시작해 자정을 넘김
  cal.createEvent('모레 일정', at('2026-11-14', '10:00'), at('2026-11-14', '11:00'), {});
  return cal;
}

test('v6 내일 일정 목록 — 앱 작업 + 캘린더(제미나이·개인), 같은 일정은 한 줄, 💰·세금·개인 앱 일정·생일·거절·알림 자신은 뺀다', () => {
  const cal = v6Cal();
  const evs = cal.getEvents(sandbox.watchDate_('2026-11-13'), sandbox.watchDate_('2026-11-14'));
  const items = sandbox.watchAlertItems_(V6_DATA(), evs, '2026-11-13');
  eq(JSON.stringify(items.map(i => [i.time, i.title, i.src])), JSON.stringify([
    ['', '[다른현장] 철거', 'cal'], ['', '야간 누수 점검 (이어서)', 'cal'], ['', '철거', 'app'],
    ['10:00', '계룡A 6동 608호 우수관 1개, 세탁배관', 'app'], ['12:00', '진잠타운 105동 802호 우수관 1개', 'app'],
    ['15:00', '한밭우성A 101동 403호 우수관1개', 'cal'], ['17:30', '치과 예약', 'cal']]), '내일 일정');
  const t = sandbox.watchAlertText_(items, '2026-11-13');
  assert(/^내일 11\/13\(금\) 일정 7건/.test(t), '첫 줄: ' + t.split('\n')[0]);
  assert(/· 종일 철거 \(3\/4일째\) \/ 목동/.test(t), '여러 날 공정 셋째 날: ' + t);
  assert(/· 10:00 계룡A 6동 608호 우수관 1개, 세탁배관 \/ 복수동 계룡A \/ 👤 우철/.test(t), '시각·현장·담당: ' + t);
  assert(/· 15:00 한밭우성A 101동 403호 우수관1개 \/ 📍 한밭우성A 101동/.test(t), '캘린더 일정은 장소까지: ' + t);
  assert(!/0608|30만|잔금|1234|홍길동|010-1111|수금|부가세|개인 시험|생일|기념일|협력사|모레|\[파수꾼\]|\[일정 알림\]/.test(t), '금액·출입 번호·고객 연락처·뺀 일정이 없어야: ' + t);
  eq(sandbox.watchAlertSubject_(items, '2026-11-13'), '내일 11/13(금) 일정 7건', '제목');
});

test('v6 9시 알림 — 8시대에 돌면 9:00 시작 일정 + 팝업, 같은 날 다시 돌면 또 안 만든다, 9시 넘어 처음 돌면 5분 뒤', () => {
  const { b, store } = alertBox({});
  const cal = v6Cal();
  const r1 = b.watchAlertRun_(V6_DATA(), cal, at('2026-11-12', '08:20'), false);
  eq(r1, 'alert-sent:7', '보냄');
  const mine = () => cal.live().filter(e => e._e.title.indexOf('[일정 알림] 내일 11/13') === 0);
  eq(mine().length, 1, '알림 일정 하나');
  const ev = mine()[0]._e;
  eq(ev.title, '[일정 알림] 내일 11/13(금) 일정 7건', '제목');
  eq(ev.start.getTime(), at('2026-11-12', '09:00').getTime(), '9:00 시작 — 9시에 정확히 울린다');
  eq(ev.end - ev.start, 30 * 60000, '30분');
  eq(JSON.stringify(ev.reminders), '[0]', '시작 시각 팝업');
  assert(/계룡A 6동 608호/.test(ev.desc) && !/0608|30만/.test(ev.desc), '본문 = 알림 글: ' + ev.desc);
  eq(store.ALERT_SENT, '2026-11-12', '보낸 날 기록');
  eq(b.watchAlertRun_(V6_DATA(), cal, at('2026-11-12', '09:20'), false), 'alert-done', '같은 날 다시 돌면 안 보냄');
  eq(mine().length, 1, '여전히 하나');
  const late = alertBox({}), cal2 = v6Cal();
  eq(late.b.watchAlertRun_(V6_DATA(), cal2, at('2026-11-12', '09:40'), false), 'alert-sent:7', '9시 넘어 처음 돌아도 보냄');
  const ev2 = cal2.live().find(e => e._e.title.indexOf('[일정 알림] 내일 11/13') === 0)._e;
  eq(ev2.start.getTime(), at('2026-11-12', '09:45').getTime(), '지난 9:00 대신 5분 뒤(지난 시각 일정은 폰이 안 울린다)');
  const sameDayCal = v6Cal();   // 캘린더에 오늘 알림이 이미 있으면(속성 기록이 없어도) 또 안 만든다
  sameDayCal.createEvent('[일정 알림] 내일 11/13(금) 일정 2건', at('2026-11-12', '09:00'), at('2026-11-12', '09:30'), {});
  eq(alertBox({}).b.watchAlertRun_(V6_DATA(), sameDayCal, at('2026-11-12', '10:10'), false), 'alert-done', '오늘 알림이 캘린더에 있으면 안 보냄');
});

test('v6 시각 창(8~11시대) · 내일 일정이 없으면 안 보냄(창 안에서 생기면 그때) · ALERT_OFF · ALERT_HOUR', () => {
  const run = (props, data, hm, cal) => { const x = alertBox(props), c = cal || fakeCal(); return { out: x.b.watchAlertRun_(data, c, at('2026-11-12', hm), false), cal: c, store: x.store }; };
  eq(run({}, V6_DATA(), '07:30').out, 'alert-later', '8시 전');
  eq(run({}, V6_DATA(), '12:00').out, 'alert-later', '12시부터는 안 보냄');
  eq(run({}, V6_DATA(), '11:59').out, 'alert-sent:3', '11시대는 보냄(캘린더 없이 앱 일정 3건)');
  const empty = { projects: [], schedule: [{ id: 'p', date: '2026-11-13', title: '💰 잔금 수금' }, { id: 'x', date: '2026-11-14', title: '모레 작업' }] };
  const box = alertBox({}), cal = fakeCal();
  eq(box.b.watchAlertRun_(empty, cal, at('2026-11-12', '09:05'), false), 'alert-none', '내일 일정이 없으면');
  eq(cal.live().length, 0, '알림 일정을 만들지 않는다');
  eq(box.store.ALERT_SENT, undefined, '보낸 기록도 없다');
  empty.schedule.push({ id: 'n', date: '2026-11-13', time: '13:00', title: '타일 보수', project: '목동' });
  eq(box.b.watchAlertRun_(empty, cal, at('2026-11-12', '10:05'), false), 'alert-sent:1', '10시에 내일 일정이 생기면 그때 보낸다');
  eq(run({ ALERT_OFF: '1' }, V6_DATA(), '09:05').out, 'alert-off', 'ALERT_OFF=1');
  const seven = run({ ALERT_HOUR: '7' }, V6_DATA(), '06:10');
  eq(seven.out, 'alert-sent:3', 'ALERT_HOUR=7 이면 6시대부터');
  eq(seven.cal.live()[0]._e.start.getTime(), at('2026-11-12', '07:00').getTime(), '7:00 시작');
  eq(run({ ALERT_HOUR: '7' }, V6_DATA(), '10:05').out, 'alert-later', 'ALERT_HOUR=7 이면 10시는 창 밖');
  eq(run({ ALERT_HOUR: 'x' }, V6_DATA(), '08:30').out, 'alert-sent:3', '잘못된 ALERT_HOUR 는 9시');
});

test('v6 testWatchNow(force) — 시각과 무관하게 다시 보내되 오늘 알림은 하나 · 메일 채널 · 앱 맞추기가 [일정 알림]을 앱 일정으로 들이지 않는다', () => {
  const { b } = alertBox({}), cal = v6Cal();
  b.watchAlertRun_(V6_DATA(), cal, at('2026-11-12', '08:40'), false);
  eq(b.watchAlertRun_(V6_DATA(), cal, at('2026-11-12', '15:00'), true), 'alert-sent:7', 'force 는 창 밖·보낸 뒤에도');
  const mine = cal.live().filter(e => e._e.title.indexOf('[일정 알림] 내일 11/13') === 0);
  eq(mine.length, 1, '오늘 알림은 하나만(이전 것을 지움)');
  eq(mine[0]._e.start.getTime(), at('2026-11-12', '15:05').getTime(), '5분 뒤');
  const m = alertBox({ WATCH_CHANNEL: 'mail' }), mcal = fakeCal();
  eq(m.b.watchAlertRun_(V6_DATA(), mcal, at('2026-11-12', '09:00'), false), 'alert-sent:3', '메일');
  eq(mcal.live().length, 0, '메일 채널이면 캘린더 일정 없음');
  eq(m.mails.length, 1, '메일 하나'); eq(m.mails[0].subject, '[일정 알림] 내일 11/13(금) 일정 3건', '메일 제목'); eq(m.mails[0].name, '만물인테리어 일정 알림', '보내는 이름');
  // 앱(index.html) 구글 캘린더 맞추기·v588 바로 읽기가 이 알림을 앱 일정으로 들이면 안 된다 — 접두를 바꾸면 앱도 같이
  const html = fs.readFileSync(process.env.HJ_INDEX_SRC || path.join(__dirname, '..', 'index.html'), 'utf8');
  const fnSrc = (html.match(/function hjCalSyncSkip\(raw\)\{[^\n]*?\}(?=\s*(?:\/\/|$))/m) || [])[0];
  assert(fnSrc, 'hjCalSyncSkip 을 찾지 못함');
  const skip = new Function(fnSrc + '; return hjCalSyncSkip;')();
  assert(skip(sandbox.ALERT_TAG + ' 내일 11/13(금) 일정 3건') && skip('[파수꾼] 📅 오늘 작업 1'), '앱 맞추기는 [일정 알림]·[파수꾼]을 건너뛴다');
  assert(!skip('[목동] 철거') && !skip('@우수관 1개'), '다른 일정은 건너뛰지 않는다');
});

test('v6 dailyWatch — 맞추기와 알림을 함께, WATCH_CALSYNC=0 이면 맞추기만 멈추고 알림은 보낸다, 이름은 일정 알림', () => {
  const tmrData = () => { const d = V5_DATA(); d.schedule.push({ id: 'tm', date: ahead(1), time: '13:00', title: '설비 점검', project: '목동' }); return d; };
  const run = props => {
    const { b, store } = alertBox(Object.assign({ ALERT_HOUR: String(new Date().getHours()) }, props));
    const cal = fakeCal();
    b.CalendarApp = { getDefaultCalendar: () => cal, getCalendarById: () => cal };
    b.watchLoadData_ = () => tmrData();
    return { out: b.dailyWatch(false), cal };
  };
  const a = run({});
  assert(/^sync \+\d+.* · alert-sent:\d+$/.test(a.out), '맞추기 + 알림: ' + a.out);
  assert(a.cal.mine().length >= 5 && a.cal.live().some(e => /^\[일정 알림\] 내일 /.test(e._e.title)), '태그 일정 + 일정 알림');
  assert(a.cal.live().every(e => e._e.title.indexOf('[파수꾼]') !== 0), '[파수꾼] 이름은 더 쓰지 않는다');
  const c = run({ WATCH_CALSYNC: '0' });
  assert(/^sync-off · alert-sent:\d+$/.test(c.out), '맞추기만 멈춤: ' + c.out);
  eq(c.cal.mine().length, 0, '태그 일정을 만들지 않는다');
  const d = run({ ALERT_OFF: '1' });
  assert(/ · alert-off$/.test(d.out) && d.cal.live().every(e => e._e.title.indexOf('[일정 알림]') !== 0), 'ALERT_OFF: ' + d.out);
  const i = alertBox({}); i.b.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() {} }) }) }) };
  assert(/매일 9시 내일 일정 알림/.test(i.b.installDailyWatch()), '설치 안내에 일정 알림');
  eq(sandbox.WATCH_VERSION, 'watch-v6', '버전');
});

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok);
console.log('\n== watchdog.unit: ' + passed + '/' + results.length + ' passed ==');
if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + f.err));
process.exit(failed.length ? 1 : 0);

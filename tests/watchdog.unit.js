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

const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Watchdog.gs'), 'utf8');
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
  assert(/보증 만료 임박/.test(t), '보증 섹션');
});

test('알림 문구 — 조용한 날은 "챙길 게 없습니다"', () => {
  const t = sandbox.watchText_(sandbox.watchScan_({ projects: [], files: [] }));
  assert(/챙길 게 없습니다/.test(t), '이상 없음 문구: ' + t.slice(0, 120));
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

test('제목 — 경보 있으면 금액·건수, 없으면 이상 없음', () => {
  const none = sandbox.watchScan_({ projects: [], files: [] });
  assert(/챙길 것 없음/.test(sandbox.watchSubject_(none)), '조용한 날 제목');
  const some = sandbox.watchScan_({
    projects: [{ name: 'A', received: 0, doneAt: ago(30) }],
    asLog: [{ project: 'A', date: ago(20), text: '누수', status: 'open' }],
  });
  const s = sandbox.watchSubject_(some);
  assert(/AS 1/.test(s), '경보 제목에 건수: ' + s);
  assert(!/미수금|못 받은 돈/.test(s), '제목에 미수금이 남으면 안 된다: ' + s);
});

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok);
console.log('\n== watchdog.unit: ' + passed + '/' + results.length + ' passed ==');
if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + f.err));
process.exit(failed.length ? 1 : 0);

test('미수금 경보는 되살아나지 않는다', () => {
  // 지우기만 하면 언젠가 조용히 돌아온다. 결과 스키마와 본문 양쪽을 못박는다.
  const r = sandbox.watchScan_(seed({
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

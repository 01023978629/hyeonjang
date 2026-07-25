/* watchdog.unit.js — Apps Script 파수꾼(Watchdog.gs) 순수 계산 검증
   Watchdog.gs 의 watchScan_ 계열은 GAS API를 쓰지 않는 순수 함수라 Node에서 그대로 돌린다.
   중점: 돈 계산(견적 중복제거·미수금)·보증 D-day·AS·방치·일정. 과거 부가세 이중계산 전력 있어 특히 엄격히. */
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

test('미수금 — 견적(부가세 포함) - 수금, 완료 14일 경과분만 경보', () => {
  const data = {
    projects: [
      { name: '괴산현장', received: 5000000, doneAt: ago(30), customer: { name: '김사장', phone: '010-1111-2222' } },
      { name: '둔산동', received: 10000000, doneAt: ago(30) },              // 완납 → 제외
      { name: '진행중', received: 0 },                                       // doneAt 없음 → 제외(공사 중)
      { name: '방금완료', received: 0, doneAt: ago(3) },                     // 14일 미만 → 제외
    ],
    files: [
      { kind: 'estimate', project: '괴산현장', name: '괴산 견적서.xlsx', est: { amount: 11000000 }, when: ago(60) },
      { kind: 'estimate', project: '둔산동', name: '둔산 견적.xlsx', est: { amount: 10000000 }, when: ago(60) },
      { kind: 'estimate', project: '방금완료', name: 'x.xlsx', est: { amount: 3000000 }, when: ago(10) },
    ],
  };
  const r = sandbox.watchScan_(data);
  eq(r.due.length, 1, '경보 대상은 괴산현장 1건');
  eq(r.due[0].name, '괴산현장', '현장명');
  eq(r.due[0].owed, 6000000, '미수금 = 1100만 - 500만 (부가세 이중계산 없음)');
  eq(r.due[0].days, 30, '완료 후 경과일');
  eq(r.due[0].customer, '김사장', '고객명 전달');
  eq(r.cash, 6000000, '미수 합계');
});

test('견적 중복제거 — 이름 다르고 금액 같으면 1건으로(2배 계상 금지)', () => {
  const data = {
    projects: [{ name: '공주현장', received: 0, doneAt: ago(30) }],
    files: [
      { kind: 'estimate', project: '공주현장', name: '★20251028 빌드캡 공주 3,978,700.xlsx', est: { amount: 3978700 }, when: ago(50) },
      { kind: 'estimate', project: '공주현장', name: '빌드캡 (공주)20251028 (1).xlsx', est: { amount: 3978700 }, when: ago(49) },
    ],
  };
  const r = sandbox.watchScan_(data);
  eq(r.due.length, 1, '1건');
  eq(r.due[0].owed, 3978700, '같은 금액 견적 2개 → 1번만 계상');
});

test('견적 중복제거 — exSum(집계 제외) 견적은 빼고 계산', () => {
  const data = {
    projects: [{ name: 'A현장', received: 0, doneAt: ago(30) }],
    files: [
      { kind: 'estimate', project: 'A현장', name: '초기안.xlsx', est: { amount: 9000000 }, exSum: true, when: ago(70) },
      { kind: 'estimate', project: 'A현장', name: '최종.xlsx', est: { amount: 5000000 }, when: ago(60) },
    ],
  };
  const r = sandbox.watchScan_(data);
  eq(r.due[0].owed, 5000000, '집계 제외 견적은 합산에서 빠짐');
});

test('미수금 — 소액 잔액(10만 미만)은 노이즈로 무시', () => {
  const data = {
    projects: [{ name: '잔돈현장', received: 9950000, doneAt: ago(40) }],
    files: [{ kind: 'estimate', project: '잔돈현장', name: 'q.xlsx', est: { amount: 10000000 }, when: ago(60) }],
  };
  const r = sandbox.watchScan_(data);
  eq(r.due.length, 0, '5만원 잔액은 경보 안 함');
});

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

test('빈 자료·깨진 자료에도 죽지 않음', () => {
  [{}, { projects: null, files: 'x' }, { projects: [null, {}], files: [null] }].forEach((d, i) => {
    const r = sandbox.watchScan_(d);
    eq(r.total, 0, '케이스 ' + i + ' 경보 0');
  });
});

test('메일 HTML 생성 — XSS 차단(현장명에 태그 넣어도 이스케이프)', () => {
  const data = {
    projects: [{ name: '<img src=x onerror=alert(1)>', received: 0, doneAt: ago(30) }],
    files: [{ kind: 'estimate', project: '<img src=x onerror=alert(1)>', name: 'q.xlsx', est: { amount: 5000000 }, when: ago(60) }],
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
    files: [{ kind: 'estimate', project: 'A', name: 'q.xlsx', est: { amount: 1000000 }, when: ago(60) }],
  });
  const s = sandbox.watchSubject_(some);
  assert(/미수금 1/.test(s) && /1,000,000원/.test(s), '경보 제목에 건수·금액: ' + s);
});

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok);
console.log('\n== watchdog.unit: ' + passed + '/' + results.length + ' passed ==');
if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + f.err));
process.exit(failed.length ? 1 : 0);

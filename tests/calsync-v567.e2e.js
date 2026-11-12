/* v567 🔄 구글 캘린더 맞추기 — 대표 지시(2026-11-10) "최근 운영 방법에 개발 가능 부분".
   구글 캘린더 일정(.ics 또는 캘린더 화면 글)을 읽어 앱 일정표와 견주고, 미리보기에서 체크한 것만 넣는다. 구글은 읽기만.
   합성 자료(이름·주소는 지어낸 것), 시계 2026-11-10 고정, 바깥 쓰기 0.
   ① 글 읽기 — 시각·종일·분 단위·쉼표 든 제목·위치·여러 날 줄 · 화면의 다른 줄은 무시 (TEXT)
   ② .ics 읽기 — …Z(UTC)는 한국 시각으로 · 종일 · TZID · 취소 (ICS)
   ③ 계획 — 새 일정 · 시간 다름 · 날짜 옮김('@'·'[현장명]' 떼고 비교, 구글에 2번) · 이미 같음 · 앱에만(보고한 일정·💰 제외) · 건너뜀 · 현장 제안 · 읽기만 (PLAN)
   ④ 창 — 일정표 [🔄 구글 캘린더 맞추기] → 붙여 넣고 읽기 → 미리보기 → 현장 고르고 반영 → 안전판 1회 · 제목에 '@' 없음 · 앱에만 있는 일정은 그대로 (APPLY)
   ⑤ 다시 읽으면 앱에만 1줄 → 체크·확인 뒤에만 지움 · 그다음엔 '같아요' · 안전판 실패·일정표 바뀜·오래된 창이면 무변경 (SAFE)
   ⑥ 폰 390 — 가로 넘침 없음 · 단추·고르기 44px · 소스·핀 3곳(v567 이상) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V567_BASELINE=<commit> 은 ① 에서, HJ_V567_MUTATION=utc-raw(…Z 를 한국 시각으로 안 바꿈) 는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const UTC = 'new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4]+9,+m[5]))';
let html = process.env.HJ_V567_BASELINE ? execFileSync('git', ['show', process.env.HJ_V567_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V567_MUTATION) {
  assert.equal(process.env.HJ_V567_MUTATION, 'utc-raw', 'unknown mutation ' + process.env.HJ_V567_MUTATION);
  assert.equal(SRC.split(UTC).length, 2, 'mutation anchor');
  html = SRC.replace(UTC, 'new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]))');
}
const TEXT = [
  '일정 7개, 11월 10일 (화요일), 오늘', '오전 9시', '가온A 3동 1309호 앞베란다 우수관 방수',
  '오전 9시~오후 5시, [가온아파트] 가온A 3동 1309호 앞베란다 우수관 방수, 홍길동, 위치 없음, 2026년 11월 10일',
  '오전 9시~오전 10시, @나래마을 114동 1205호 세면대 배관 공사, 홍길동, 위치: 나래마을 114동 1205호, 2026년 11월 10일',
  '오후 2시~오후 3시, @다솜A 4동 1004호 앞베란다 우수관 1개, 홍길동, 위치: 다솜A 4동 1004호, 2026년 11월 10일',
  '종일, 벌곡 방문, 홍길동, 위치 없음, 2026년 11월 11일',
  '오후 3시~오후 4시, 김고객 방문 - 보일러 점검, 구역 1,2 (시험로 14 1층), 홍길동, 위치: 시험로 14 1층, 2026년 11월 11일',
  '종일, 바닥 미장 작업, 홍길동, 위치 없음, 2026년 11월 12일',
  '오전 11시~오후 12시, [다솜아파트] 창틀 실리콘, 홍길동, 위치 없음, 2026년 11월 12일',
  '오전 8:30~오후 2:30, @라온그린 104동 1503호 우수관 누수, 홍길동, 위치: 라온그린 104동 1503호, 2026년 11월 13일',
  '오전 8:30~오후 2:30, 라온그린 104동 1503호 우수관 누수, 홍길동, 위치 없음, 2026년 11월 13일',
  '오전 9시~오후 5시, 마루 작업, 홍길동, 위치 없음, 2026년 11월 14일',
  '종일, @가온A 3동 1309호 앞베란다 우수관 1개, 홍길동, 위치: 가온A 3동 1309호, 2026년 11월 16일',
  '종일, @가온A 3동 1309호 앞베란다 우수관 1개, 홍길동, 위치: 가온A 3동 1309호, 2026년 11월 16일',
  '오전 7:36~오전 8:06, [파수꾼] ✅ 만물인테리어 — 잡힌 작업 없음, 홍길동, 위치 없음, 2026년 11월 9일',
  '종일, 크리스마스, 캘린더: 대한민국의 휴일, 2026년 12월 25일', 'cake', '생일: Happy birthday!,',
  '2026년 11월 2일 오후 7:20~2026년 11월 8일 오후 9:30, 긴 모임, 캘린더: 시험모임, 위치: 대강당,',
  '오전 9시~오후 5시, 지난 일정, 홍길동, 위치 없음, 2026년 10월 20일'
].join('\n');
const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:u1@test', 'DTSTART:20261117T000000Z', 'DTEND:20261117T080000Z', 'SUMMARY:@가온A 5동 501호 방수', 'LOCATION:가온A 5동 501호', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u2@test', 'DTSTART;VALUE=DATE:20261118', 'DTEND;VALUE=DATE:20261119', 'SUMMARY:종일 작업', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u3@test', 'DTSTART;TZID=Asia/Seoul:20261119T140000', 'DTEND;TZID=Asia/Seoul:20261119T153000', 'SUMMARY:오후 점검\\, 2층', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u4@test', 'DTSTART:20261119T160000Z', 'SUMMARY:자정 넘는 일정', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:u5@test', 'DTSTART:20261120T010000Z', 'SUMMARY:취소된 일정', 'STATUS:CANCELLED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

let browser, passed = 0;
const errors = [], confirms = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calsync-v567 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); if (dialog.type() === 'confirm' && /앱에만 있는 일정 1건/.test(dialog.message())) { confirms.push(dialog.message()); return dialog.accept(); } errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래마을아파트'), P('다솜아파트'), P('라온그린아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  state.files = [{ id: 'PH1', name: 'IMG_1.jpg', ext: 'jpg', kind: 'photo', project: '나래마을아파트', prefix: '현장사진/', size: 1001, when: new Date('2026-11-01T10:00:00+09:00') }];
  const S = (id, date, time, title, project, extra) => Object.assign({ id, date, time, title, project: project || '', workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [S('A', '2026-11-10', '09:00', '가온A 3동 1309호 앞베란다 우수관 방수', '가온아파트'), S('B', '2026-11-10', '12:00', '라온그린 104동 1503호 우수관 누수', '라온그린아파트'),
    S('C', '2026-11-12', '', '바닥 미장 작업'), S('D', '2026-11-11', '09:00', '벌곡 방문'), S('E', '2026-11-14', '10:00', '마루 작업'), S('F', '2026-11-15', '09:00', '앱에만 있는 일정'),
    S('G', '2026-11-12', '09:00', '💰 잔금 받기', '가온아파트'), S('H', '2026-11-13', '09:00', '보고한 일정', '', { report: { progress: '완료', done: '끝' } }), S('Z', '2026-10-20', '09:00', '지난 일정')];
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
const BRIEF = r => [r.status, r.date, r.time || '종일', r.title, r.check];

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    await test('① 글 읽기 — 시각·종일·분 단위·쉼표 든 제목·위치·여러 날 줄 · 다른 줄 무시 (TEXT)', async () => {
      const ev = await page.evaluate(t => hjCalSyncParse(t).map(e => [e.date, e.time, e.hours, e.raw, e.location]), TEXT);
      assert.equal(ev.length, 14, '읽은 줄 14(똑같은 줄은 한 번) — ' + ev.length);
      assert.deepEqual(ev[0], ['2026-11-10', '09:00', 8, '[가온아파트] 가온A 3동 1309호 앞베란다 우수관 방수', '']);
      assert.deepEqual(ev[1], ['2026-11-10', '09:00', 1, '@나래마을 114동 1205호 세면대 배관 공사', '나래마을 114동 1205호']);
      assert.deepEqual(ev[4], ['2026-11-11', '15:00', 1, '김고객 방문 - 보일러 점검, 구역 1,2 (시험로 14 1층)', '시험로 14 1층'], '쉼표 든 제목 — ' + JSON.stringify(ev[4]));
      assert.deepEqual(ev[5], ['2026-11-12', '', 8, '바닥 미장 작업', '']);
      assert.deepEqual(ev[7], ['2026-11-13', '08:30', 6, '@라온그린 104동 1503호 우수관 누수', '라온그린 104동 1503호'], '분 단위 시각·6시간 — ' + JSON.stringify(ev[7]));
      assert.deepEqual(ev[12], ['2026-11-02', '19:20', 1, '긴 모임', '대강당'], '날짜로 시작하는 여러 날 줄 — ' + JSON.stringify(ev[12]));
      assert.ok(!ev.some(e => /크리스마스|birthday|^가온A 3동 1309호 앞베란다 우수관 방수$/.test(e[3])), '화면의 다른 줄(휴일·생일·제목만 있는 줄)은 안 읽음');
    });
    await test('② .ics 읽기 — …Z 는 한국 시각으로 · 종일 · TZID · 취소 (ICS)', async () => {
      const ev = await page.evaluate(t => hjCalSyncParse(t).map(e => [e.uid, e.date, e.time, e.hours, e.raw, e.location, e.cancelled]), ICS);
      assert.deepEqual(ev, [['u1@test', '2026-11-17', '09:00', 8, '@가온A 5동 501호 방수', '가온A 5동 501호', false], ['u2@test', '2026-11-18', '', 8, '종일 작업', '', false],
        ['u3@test', '2026-11-19', '14:00', 1.5, '오후 점검, 2층', '', false], ['u4@test', '2026-11-20', '01:00', 1, '자정 넘는 일정', '', false], ['u5@test', '2026-11-20', '10:00', 1, '취소된 일정', '', true]], JSON.stringify(ev));
      const plan = await page.evaluate(t => { const P = hjCalSyncPlan(hjCalSyncParse(t)); return { rows: P.rows.map(r => [r.status, r.date, r.time, r.title, r.project]), st: P.stats }; }, ICS);
      assert.deepEqual(plan.rows, [['new', '2026-11-17', '09:00', '가온A 5동 501호 방수', '가온아파트'], ['new', '2026-11-18', '', '종일 작업', ''], ['new', '2026-11-19', '14:00', '오후 점검, 2층', ''], ['new', '2026-11-20', '01:00', '자정 넘는 일정', '']], JSON.stringify(plan.rows));
      assert.equal(plan.st.skipped, 1, '취소된 일정은 건너뜀');
    });
    await test('③ 계획 — 새 일정 · 시간 다름 · 날짜 옮김 · 이미 같음 · 앱에만 · 건너뜀 · 현장 제안 · 읽기만 (PLAN)', async () => {
      const r = await page.evaluate(t => { const before = JSON.stringify(state.schedule); const P = hjCalSyncPlan(hjCalSyncParse(t));
        return { rows: P.rows.map(x => [x.status, x.date, x.time || '종일', x.title, x.check]), extra: P.rows.map(x => [x.project || '', x.dupN, (x.marks || []).join(''), x.app ? x.app.id : '']), st: P.stats, lo: P.lo, hi: P.hi, same: before === JSON.stringify(state.schedule) }; }, TEXT);
      assert.deepEqual(r.rows, [
        ['new', '2026-11-10', '09:00', '나래마을 114동 1205호 세면대 배관 공사', true], ['new', '2026-11-10', '14:00', '다솜A 4동 1004호 앞베란다 우수관 1개', true],
        ['new', '2026-11-11', '15:00', '김고객 방문 - 보일러 점검, 구역 1,2 (시험로 14 1층)', true], ['new', '2026-11-12', '11:00', '창틀 실리콘', true], ['new', '2026-11-16', '종일', '가온A 3동 1309호 앞베란다 우수관 1개', true],
        ['time', '2026-11-14', '09:00', '마루 작업', true], ['move', '2026-11-13', '08:30', '라온그린 104동 1503호 우수관 누수', true], ['apponly', '2026-11-15', '09:00', '앱에만 있는 일정', false]], JSON.stringify(r.rows));
      assert.deepEqual(r.extra[0].slice(0, 3), ['나래마을아파트', 1, '@'], '이름 맞추기로 현장 제안 — ' + JSON.stringify(r.extra[0]));
      assert.deepEqual(r.extra[3].slice(0, 3), ['다솜아파트', 1, 'app'], '[현장명] 표시 → 그 현장 — ' + JSON.stringify(r.extra[3]));
      assert.deepEqual(r.extra[5], ['', 1, '', 'E'], '시간 다름은 앱 일정 E');
      assert.deepEqual(r.extra[6], ['', 2, '@', 'B'], "날짜 옮김: '@제목'과 제목이 같은 날 2번 → 한 줄 · 앱 일정 B — " + JSON.stringify(r.extra[6]));
      assert.deepEqual(r.st, { read: 14, same: 3, skipped: 1, old: 2, gdup: 1, unread: 0 }, '같음 3(가온·벌곡·미장) · 파수꾼 1 · 지난 일정 2 · 구글 겹침 1 · 못 읽은 줄 0(v580) — ' + JSON.stringify(r.st));
      assert.deepEqual([r.lo, r.hi, r.same], ['2026-11-10', '2026-11-16', true], '읽기만');
    });
    await test('④ 창 — 붙여 넣고 읽기 → 미리보기 → 현장 고르고 반영 → 안전판 1회 · 앱에만 있는 일정은 그대로 (APPLY)', async () => {
      await page.click('#view #schCalSync');
      await page.waitForSelector('#modalRoot #hjCalSync');
      assert.equal(await page.evaluate(() => document.getElementById('csApply').disabled), true, '읽기 전에는 반영 단추 잠김');
      await page.fill('#csText', TEXT);
      await page.click('#csRead');
      await page.waitForSelector('#csBody [data-cs-row]');
      const v = await page.evaluate(() => ({ sum: document.querySelector('[data-cs-sum]').innerText.replace(/\s+/g, ' '), kinds: [...document.querySelectorAll('#csBody [data-cs-row]')].map(el => el.dataset.csRow + (el.querySelector('.csChk').checked ? '+' : '-')),
        sels: [...document.querySelectorAll('#csBody .csSel')].map(s => s.value), moved: document.querySelector('#csBody [data-cs-row="move"]').innerText.replace(/\s+/g, ' ').trim(), gdup: !!document.querySelector('[data-cs-gdup]') }));
      assert.ok(v.sum.includes('읽은 일정 14건') && v.sum.includes('새 일정 5') && v.sum.includes('이미 같음 3') && v.sum.includes('건너뜀 3'), v.sum);
      assert.deepEqual(v.kinds, ['new+', 'new+', 'new+', 'new+', 'new+', 'time+', 'move+', 'apponly-'], JSON.stringify(v.kinds));
      assert.deepEqual([v.sels[0], v.sels[3], v.sels.length], ['나래마을아파트', '다솜아파트', 5], '새 일정마다 현장 고르기 — ' + JSON.stringify(v.sels));
      assert.ok(v.moved.includes('📆 날짜 옮김') && v.moved.includes('날짜 11/10(화) → 11/13(금)') && v.moved.includes('구글에 2번') && v.moved.includes('@ 제미나이') && v.gdup, v.moved);
      await page.selectOption('#csBody .csSel[data-i="4"]', '가온아파트');
      const snaps = await page.evaluate(() => { window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { window.__snaps.push(a[0]); return o(...a); }; return 0; });
      await page.click('#csApply');
      // v581 부터 반영 뒤 '바뀐 일정 알리기' 창이 뜬다(맞추기 창은 닫힘) — 그 창을 닫고 본다
      // 맞추기 창이 닫힐 때까지(실패면 오류 토스트) 기다린 뒤 결과 창을 단언한다 — 창이 안 뜨는 회귀가 시간 초과가 아니라 단언 실패로 떨어지게
      await page.waitForFunction(() => !document.querySelector('#hjCalSync') || /안전판을 만들지 못해|바뀌었어요|체크하세요|오래된 창/.test(document.getElementById('toast').textContent));
      const done = await page.evaluate(() => { const n = document.querySelectorAll('#modalRoot #hjCalSyncDone [data-csd-row]').length, open = !!document.querySelector('#hjCalSync'), t = document.getElementById('toast').textContent; closeModal(true); return { n, open, t }; });
      assert.deepEqual([done.open, done.n], [false, 7], '반영 뒤 알릴 일정 7건(새 5 · 시간 1 · 옮김 1) — ' + JSON.stringify(done));
      const r = await page.evaluate(() => ({ snaps: window.__snaps, n: state.schedule.length, by: Object.fromEntries(state.schedule.map(s => [s.id, [s.date, s.time, s.project]])),
        added: state.schedule.filter(s => s.icsUid).map(s => [s.date, s.time, s.title, s.project, s.hours]).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])), memo: state.schedule.find(s => /세면대/.test(s.title)).memo }));
      assert.ok(r.snaps[0] === '구글 캘린더 맞추기 전' && r.snaps.filter(x => x === '구글 캘린더 맞추기 전').length === 1, '반영 전 안전판 1회(먼저) — ' + JSON.stringify(r.snaps));
      assert.equal(r.n, 14, '9건 + 새 일정 5건');
      assert.deepEqual([r.by.B, r.by.E, r.by.F, r.by.A, r.by.H], [['2026-11-13', '08:30', '라온그린아파트'], ['2026-11-14', '09:00', ''], ['2026-11-15', '09:00', ''], ['2026-11-10', '09:00', '가온아파트'], ['2026-11-13', '09:00', '']], '옮김·시간·그대로 — ' + JSON.stringify(r.by));
      assert.deepEqual(r.added, [['2026-11-10', '09:00', '나래마을 114동 1205호 세면대 배관 공사', '나래마을아파트', 1], ['2026-11-10', '14:00', '다솜A 4동 1004호 앞베란다 우수관 1개', r.added[1][3], 1],
        ['2026-11-11', '15:00', '김고객 방문 - 보일러 점검, 구역 1,2 (시험로 14 1층)', '', 1], ['2026-11-12', '11:00', '창틀 실리콘', '다솜아파트', 1], ['2026-11-16', '', '가온A 3동 1309호 앞베란다 우수관 1개', '가온아파트', 8]], "제목에 '@'·'[현장명]' 없음 — " + JSON.stringify(r.added));
      assert.equal(r.memo, '장소: 나래마을 114동 1205호\n구글 캘린더에서 가져옴 (@ 제미나이 입력)');
    });
    await test('⑤ 다시 읽으면 앱에만 1줄 → 체크·확인 뒤에만 지움 · 그다음엔 같아요 · 안전판 실패·일정표 바뀜·오래된 창이면 무변경 (SAFE)', async () => {
      const guard = await page.evaluate(async t => {
        const plan = () => hjCalSyncPlan(hjCalSyncParse(t)), sig = () => JSON.stringify(state.schedule), out = {};
        const tryIt = async (p, picks) => { const b = sig(); try { await hjCalSyncApply(p, picks); return 'applied'; } catch (e) { return (b === sig() ? 'same:' : 'CHANGED:') + e.message; } };
        const p0 = plan(); out.rows = p0.rows.map(r => r.status);
        window.__tabStale = true; out.stale = await tryIt(p0, [{ i: 0 }]); window.__tabStale = false;
        const real = hjSnapshot; hjSnapshot = async () => false; out.snap = await tryIt(p0, [{ i: 0 }]); hjSnapshot = real;
        const f = state.schedule.find(s => s.id === 'F'), keep = f.title; f.title = '바뀐 제목'; out.stamp = await tryIt(p0, [{ i: 0 }]); f.title = keep;
        out.none = await tryIt(plan(), []);
        return out;
      }, TEXT);
      assert.deepEqual(guard.rows, ['apponly'], '다시 읽으면 앱에만 1줄 — ' + JSON.stringify(guard.rows));
      assert.ok(/^same:오래된 창/.test(guard.stale) && /^same:안전판/.test(guard.snap) && /^same:미리보기 뒤 일정표가 바뀌었/.test(guard.stamp) && /^same:반영할 줄/.test(guard.none), JSON.stringify(guard));
      await page.evaluate(() => { state.tab = 'schedule'; render(); });
      await page.click('#view #schCalSync');
      await page.fill('#csText', TEXT); await page.click('#csRead');
      await page.waitForSelector('#csBody [data-cs-row="apponly"]');
      await page.click('#csApply');
      const a = await page.evaluate(() => [!!document.querySelector('#modalRoot .modal'), state.schedule.some(s => s.id === 'F')]);
      assert.deepEqual([a, confirms.length], [[true, true], 0], '체크 안 하면 안 지움(안내만)');
      await page.check('#csBody .csChk[data-i="0"]');
      await page.click('#csApply');
      await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
      const b = await page.evaluate(t => ({ F: state.schedule.some(s => s.id === 'F'), n: state.schedule.length, rows: hjCalSyncPlan(hjCalSyncParse(t)).rows.length }), TEXT);
      assert.deepEqual([b, confirms.length], [{ F: false, n: 13, rows: 0 }, 1], '확인 뒤 지움 · 그다음엔 바꿀 것 없음 — ' + JSON.stringify(b));
      await page.click('#view #schCalSync'); await page.fill('#csText', TEXT); await page.click('#csRead');
      await page.waitForSelector('#csBody [data-cs-clean]');
      assert.equal(await page.evaluate(() => { const d = document.getElementById('csApply').disabled; closeModal(true); return d; }), true, '같으면 반영 단추 잠김');
    });
    await context.close();
    await test('⑥ 폰 390 — 넘침 없음 · 44px · 소스·핀 3곳(v567 이상) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED);
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await m.page.waitForSelector('#csBody [data-cs-row]');
      const r = await m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal');
        const small = [...root.querySelectorAll('#hjCalSync button,#hjCalSync select,#hjCalSync label,.mfoot button')].filter(b => b.getClientRects().length).map(b => [b.tagName, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        const wide = [...root.querySelectorAll('#hjCalSync *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).length;
        return { rows: root.querySelectorAll('[data-cs-row]').length, small, wide, over: document.documentElement.scrollWidth - innerWidth }; });
      assert.ok(r.rows === 8 && r.wide === 0 && r.over <= 1, '넘침 없음 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px 미만 — ' + JSON.stringify(r.small));
      await m.context.close();
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 567, '핀 v567 이상 ' + a);
      assert.ok(src.includes(UTC) && src.includes('function hjCalSyncPlan('), '맞추기 함수가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`calsync-v567: ${passed}/6 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calsync-v567 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

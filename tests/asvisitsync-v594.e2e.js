/* v594 AS 방문일은 일정 날짜를 따라간다 — 구글 캘린더 맞추기에서도 (AGENTS v580~v587 '통합 검토' · v330 남은 것)
   일정 창 저장(saveScheduleEdit, v331)만 AS 기록의 방문일(visitAt)을 옮겼다. 🔄 구글 캘린더 맞추기의 '날짜 옮김'(제미나이가 구글에서 AS 방문을 옮긴 것)은
   일정만 옮겨, AS 관리·현장 AS 카드·보증 화면·AS 이력 엑셀의 방문일이 옛 날짜로 남았다.
   이제 한 곳(hjAsVisitFollow)이 잇는 규칙을 갖고 일정 창 저장·맞추기 날짜 옮김이 부른다. 📥 캘린더 파일 가져오기의 같은 uid 갱신도 부르지만 안전장치다 —
   앱이 만든 AS 방문 일정(AS 관리 [📅 방문 일정]·방문일 칸)에는 icsUid·sourceUid 가 없어 지금은 그 길로 날짜가 바뀌지 않는다(③ 은 uid 를 손으로 붙인 합성 꼴).
   맞추기가 21일(HJ_CALSYNC_MOVE) 넘게 떨어진 AS 방문을 '새 일정'으로 넣는 것(이어지지 않음)은 v567 부터의 한계라 여기서 다루지 않는다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-05 고정, 바깥 쓰기 0.
   ① 맞추기 '날짜 옮김' — AS 방문 일정(asId + visitSchedId)이 옮겨지면 방문일도 구글 날짜로 · 같이 옮긴 보통 일정은 AS 기록을 안 건드림 · 결과 목록(list)·asMoved
      · 안전판 1회 · 오래된 창·미리보기 뒤 일정표 바뀜은 그대로 거부(일정·AS 모두 그대로) (CALSYNC)
   ② 잇는 규칙 — 일정의 asId 만 남은 옛 기록(visitSchedId 없음)도 따라감 · visitSchedId 가 지워진 일정을 가리키는 AS 도 남은 asId 일정을 따라감
      · 그 AS 의 방문 일정이 지금 있는 다른 일정이면(예전 일정을 옮김) 건드리지 않음
      · 맞추기 창 [반영] 토스트에 'AS 방문일 n건도 맞춤' · 일정 창 저장도 같은 규칙(asId 만 남은 기록 따라감, 날짜 그대로인 저장은 손대지 않음) (LINK)
   ③ 캘린더 파일 가져오기(안전장치 · 합성 꼴) — 같은 uid 로 날짜가 바뀐 AS 방문 일정은 방문일도 따라감 · 날짜가 같은 갱신은 어긋난 옛 자료도 그대로 · 보통 일정 갱신은 AS 그대로 (ICS)
   ④ 폰 390 AS 관리 넘침 없음 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   AI 도구에는 있는 일정의 날짜를 바꾸는 것이 없다(add_schedule·schedule_plan 은 새 일정, delete_schedule 은 지움) — 그래서 AI 길은 검사 대상이 없다.
   🔁 뒤 일정 같이 옮기기(hjCascadeCands)는 AS 방문 일정을 후보에서 뺀다(v365) — 옮겨지는 일 자체가 없다.
   HJ_V594_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V594_MUTATION — no-calsync(맞추기 날짜 옮김에서 따라가기 뺌)는 ①,
   visit-only(visitSchedId 로만 잇기 — asId 만 남은 기록 무시)·no-live-guard(다른 일정이 방문 일정인 AS 도 덮음)·
   live-true(visitSchedId 가 지워진 일정이어도 '있는 다른 방문 일정'으로 봄 — 남은 asId 일정을 안 따라감)는 ②,
   no-ics(캘린더 파일 가져오기에서 따라가기 뺌)·ics-always(날짜가 같아도 맞춤)는 ③ 에서 실패해야 한다. */
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
const MUT = {
  'no-calsync': ['      if(old!==s.date)out.asMoved+=hjAsVisitFollow(s);', '      '],
  'visit-only': ['const mine=a.visitSchedId===s.id||(!!s.asId&&a.id===s.asId&&', 'const mine=a.visitSchedId===s.id||(false&&'],
  'no-live-guard': ['&&!(a.visitSchedId&&a.visitSchedId!==s.id&&live(a.visitSchedId)));', ');'],
  'live-true': ['const live=id=>(state.schedule||[]).some(x=>x&&x.id===id);', 'const live=id=>true;'],
  'no-ics': ['      if(prev!==e.date)hjAsVisitFollow(state.schedule[i]);', '      '],
  'ics-always': ['      if(prev!==e.date)hjAsVisitFollow(state.schedule[i]);', '      hjAsVisitFollow(state.schedule[i]);']
};
let html = process.env.HJ_V594_BASELINE ? execFileSync('git', ['show', process.env.HJ_V594_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V594_MUTATION) {
  const m = MUT[process.env.HJ_V594_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V594_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS asvisitsync-v594 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    window.__toasts = []; const t = toast; toast = m => { window.__toasts.push(String(m)); return t(m); };
    window.__snaps = []; const h = hjSnapshot; hjSnapshot = (...a) => { window.__snaps.push(String(a[0])); return h(...a); };
    window.AS = () => Object.fromEntries(state.asLog.map(a => [a.id, a.visitAt]));
    window.SCH = () => Object.fromEntries(state.schedule.map(s => [s.id, s.date]));
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
  state.projects = [P('가상현장A'), P('가상현장B')];
  state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.notes = [];
  state.asLog = [
    { id: 'as1', project: '가상현장A', date: '2026-11-02', text: '욕실 실리콘 들뜸', status: 'open', visitAt: '2026-11-06', visitSchedId: 'v1' },     // 둘 다 이어진 보통 꼴
    { id: 'as2', project: '가상현장B', date: '2026-11-03', text: '현관 문틀 벌어짐', status: 'open', visitAt: '2026-11-07' },                        // 일정의 asId 만 남은 옛 꼴
    { id: 'as3', project: '가상현장A', date: '2026-11-01', text: '주방 상부장 처짐', status: 'open', visitAt: '2026-11-12' },                        // 일정 연결 없음
    { id: 'as4', project: '가상현장B', date: '2026-10-30', text: '베란다 배수구 역류', status: 'doing', visitAt: '2026-11-13', visitSchedId: 'v4b' },  // 방문 일정은 v4b(재방문) — v4a 는 예전 일정
    { id: 'as5', project: '가상현장A', date: '2026-11-04', text: '싱크대 수전 누수', status: 'open', visitAt: '2026-11-08', visitSchedId: 'gone' }       // 방문 일정이던 'gone' 은 지워졌다 — 남은 v5(asId)가 방문 일정
  ];
  state.schedule = [
    { id: 'v1', date: '2026-11-06', time: '10:00', hours: 2, title: '🔧 AS 방문: 욕실 실리콘 들뜸', project: '가상현장A', asId: 'as1', memo: 'AS 접수 2026-11-02 — 욕실 실리콘 들뜸', crew: '' },
    { id: 'v2', date: '2026-11-07', time: '14:00', hours: 2, title: '🔧 AS 방문: 현관 문틀 벌어짐', project: '가상현장B', asId: 'as2', memo: '', crew: '' },
    { id: 'v4a', date: '2026-11-11', time: '', hours: 0, title: '🔧 AS 방문: 베란다 배수구 역류', project: '가상현장B', asId: 'as4', memo: '', crew: '' },
    { id: 'v4b', date: '2026-11-13', time: '10:00', hours: 2, title: '🔧 AS 재방문: 베란다 배수구', project: '가상현장B', asId: 'as4', memo: '', crew: '' },
    { id: 'v5', date: '2026-11-08', time: '11:00', hours: 2, title: '🔧 AS 방문: 싱크대 수전 누수', project: '가상현장A', asId: 'as5', memo: '', crew: '' },
    { id: 't1', date: '2026-11-09', time: '09:00', hours: 8, title: '타일 시공', project: '가상현장A', memo: '', crew: '' }
  ];
  state.activeProject = null; state.tab = 'schedule'; state.editingQuote = null;
  window.__toasts = []; window.__snaps = [];
  render();
};
// 구글 캘린더 화면 글 — 제미나이가 AS 방문(욕실)과 타일을 하루씩 뒤로 옮겼다(@ 표시)
const TEXT1 = ['오전 10시~오후 12시, @AS 방문: 욕실 실리콘 들뜸, 홍길동, 위치 없음, 2026년 11월 9일',
  '오전 9시~오후 5시, @타일 시공, 홍길동, 위치 없음, 2026년 11월 10일'].join('\n');
// 현관(asId 만 남은 옛 기록)은 11/10 으로, 싱크대(방문 일정이 지워지고 asId 일정만 남음)는 11/11 로, 베란다 예전 방문 일정(v4a)은 11/12 로
const TEXT2 = ['오후 2시~오후 4시, @AS 방문: 현관 문틀 벌어짐, 홍길동, 위치 없음, 2026년 11월 10일',
  '오전 11시~오후 1시, @AS 방문: 싱크대 수전 누수, 홍길동, 위치 없음, 2026년 11월 11일',
  '종일, @AS 방문: 베란다 배수구 역류, 홍길동, 위치 없음, 2026년 11월 12일'].join('\n');
const ICS = ['BEGIN:VCALENDAR',
  'BEGIN:VEVENT', 'UID:as-uid-1@test', 'DTSTART:20261116T100000', 'SUMMARY:🔧 AS 방문: 욕실 실리콘 들뜸', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:as-uid-2@test', 'DTSTART:20261107T140000', 'SUMMARY:🔧 AS 방문: 현관 문틀 벌어짐', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:tile-uid@test', 'DTSTART:20261118T090000', 'SUMMARY:타일 시공', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);

    await test('① 맞추기 날짜 옮김 — AS 방문일이 구글 날짜를 따라감 · 보통 일정은 AS 를 안 건드림 · 안전판·가드 그대로 (CALSYNC)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(async t => {
        const plan = hjCalSyncPlan(hjCalSyncParse(t));
        const rows = plan.rows.map((x, i) => ({ i, status: x.status, id: x.app && x.app.id, date: x.date }));
        const picks = rows.filter(x => x.status === 'move').map(x => ({ i: x.i }));
        const before = JSON.stringify(state.asLog.filter(a => a.id !== 'as1'));
        const out = await hjCalSyncApply(plan, picks);
        return { rows: rows.filter(x => x.status === 'move').map(x => [x.id, x.date]), as: AS(), sch: SCH(), otherSame: before === JSON.stringify(state.asLog.filter(a => a.id !== 'as1')),
          asMoved: out.asMoved, list: out.list.map(x => [x.id, x.kind, x.from.date, x.to.date]), changed: out.changed, snaps: window.__snaps.slice() };
      }, TEXT1);
      assert.deepEqual(r.rows, [['v1', '2026-11-09'], ['t1', '2026-11-10']], '전제: 두 줄 모두 날짜 옮김 ' + JSON.stringify(r.rows));
      assert.equal(r.sch.v1, '2026-11-09'); assert.equal(r.sch.t1, '2026-11-10');
      assert.equal(r.as.as1, '2026-11-09', 'AS 방문 일정을 옮겼으면 AS 기록의 방문일도 구글 날짜로 ' + JSON.stringify(r.as));
      assert.ok(r.otherSame, '다른 AS 기록(보통 일정 t1 을 옮긴 것 포함)은 그대로');
      assert.equal(r.asMoved, 1, '맞춘 AS 기록 수');
      assert.deepEqual(r.list, [['v1', 'move', '2026-11-06', '2026-11-09'], ['t1', 'move', '2026-11-09', '2026-11-10']], '결과 목록(v581 알리기)은 그대로');
      assert.equal(r.changed, 2);
      assert.equal(r.snaps.filter(x => x === '구글 캘린더 맞추기 전').length, 1, '안전판 1회(그 밖은 markDirty 의 \'작업 중\' 자동 안전판) ' + JSON.stringify(r.snaps));
      // 오래된 창 · 미리보기 뒤 일정표가 바뀜 — 거부하고 일정·AS 모두 그대로
      await page.evaluate(SEED);
      const g = await page.evaluate(async t => {
        const sig = () => JSON.stringify([state.schedule, state.asLog]);
        const tryIt = async plan => { const b = sig(); try { await hjCalSyncApply(plan, plan.rows.map((x, i) => ({ i })).filter(p => plan.rows[p.i].status === 'move')); return 'applied'; } catch (e) { return (b === sig() ? 'same:' : 'CHANGED:') + e.message; } };
        let plan = hjCalSyncPlan(hjCalSyncParse(t));
        __tabStale = true; const stale = await tryIt(plan); __tabStale = false;
        plan = hjCalSyncPlan(hjCalSyncParse(t)); state.schedule.find(s => s.id === 'v4b').time = '11:00';
        const stamp = await tryIt(plan);
        return { stale, stamp, as: AS() };
      }, TEXT1);
      assert.match(g.stale, /^same:오래된 창/, '오래된 창 거부 ' + g.stale);
      assert.match(g.stamp, /^same:미리보기 뒤 일정표가 바뀌었어요/, '미리보기 뒤 바뀜 거부 ' + g.stamp);
      assert.equal(g.as.as1, '2026-11-06', '거부되면 AS 방문일도 그대로');
    });

    await test('② 잇는 규칙 — asId 만 남은 옛 기록·지워진 방문 일정 기록은 따라감 · 다른 일정이 방문 일정인 AS 는 그대로 · 토스트 · 일정 창도 같은 규칙 (LINK)', async () => {
      await page.evaluate(SEED);
      // 맞추기 창 [반영] — 실제 버튼 길(토스트까지)
      await page.evaluate(() => hjCalSyncView());
      await page.waitForSelector('#modalRoot #csText');
      await page.evaluate(t => { document.querySelector('#modalRoot #csText').value = t; document.querySelector('#modalRoot #csRead').click(); }, TEXT2);
      await page.waitForFunction(() => { const b = document.getElementById('csApply'); return b && !b.disabled; });
      const rows = await page.evaluate(() => (window.__hjCalSyncPlan.rows || []).map((x, i) => [i, x.status, x.app && x.app.id, !!(document.querySelector('#modalRoot .csChk[data-i="' + i + '"]') || {}).checked]));
      const moves = rows.filter(x => x[1] === 'move');
      assert.deepEqual(moves.map(x => [x[2], x[3]]), [['v2', true], ['v5', true], ['v4a', true]], '전제: 세 줄 날짜 옮김·체크됨 ' + JSON.stringify(rows));
      await page.evaluate(() => document.querySelectorAll('#modalRoot .csChk').forEach(c => { const r = window.__hjCalSyncPlan.rows[+c.dataset.i]; c.checked = !!r && r.status === 'move'; c.dispatchEvent(new Event('change', { bubbles: true })); }));
      await page.click('#csApply');
      await page.waitForFunction(() => (state.schedule.find(s => s.id === 'v2') || {}).date === '2026-11-10');
      const a = await page.evaluate(() => ({ as: AS(), sch: SCH(), toast: window.__toasts.join(' | ') }));
      assert.equal(a.sch.v2, '2026-11-10'); assert.equal(a.sch.v5, '2026-11-11'); assert.equal(a.sch.v4a, '2026-11-12');
      assert.equal(a.as.as2, '2026-11-10', 'visitSchedId 없이 일정의 asId 만 남은 옛 기록도 방문일이 따라간다 ' + JSON.stringify(a.as));
      assert.equal(a.as.as5, '2026-11-11', 'AS 의 visitSchedId 가 지워진 일정이면 남은 asId 일정(v5)이 방문 일정이라 따라간다 ' + JSON.stringify(a.as));
      assert.equal(a.as.as4, '2026-11-13', 'AS 의 방문 일정이 지금 있는 다른 일정(v4b)이면 예전 일정을 옮겨도 방문일은 그대로 ' + JSON.stringify(a.as));
      assert.match(a.toast, /바꿈 3 · AS 방문일 2건도 맞춤/, '맞추기 토스트가 같이 맞춘 AS 를 말한다 ' + a.toast);
      await page.evaluate(() => closeModal(true));
      // 일정 창 저장 — 같은 규칙(v331 + asId 만 남은 기록), 날짜 그대로인 저장은 어긋난 옛 자료도 손대지 않는다
      await page.evaluate(SEED);
      const save = async (id, fn) => {
        await page.evaluate(i => openScheduleEdit(i), id);
        await page.waitForSelector('#modalRoot #schDate');
        await page.evaluate(fn);
        await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /^저장$/.test(x.textContent.trim())); if (!b) throw new Error('저장 단추 없음'); b.click(); });
        await page.waitForFunction(() => !document.querySelector('#modalRoot #schDate'));
        await page.evaluate(() => closeModal(true));
      };
      await save('v2', () => { document.getElementById('schDate').value = '2026-11-14'; });
      await save('v4a', () => { document.getElementById('schDate').value = '2026-11-16'; });
      await save('v5', () => { document.getElementById('schDate').value = '2026-11-15'; });
      await page.evaluate(() => { state.asLog.find(a => a.id === 'as1').visitAt = '2026-11-05'; });   // 이미 어긋나 있던 옛 자료
      await save('v1', () => { document.getElementById('schMemo').value = '가상 메모만'; });
      await save('t1', () => { document.getElementById('schDate').value = '2026-11-17'; });
      const e = await page.evaluate(() => ({ as: AS(), sch: SCH(), toast: window.__toasts.join(' | ') }));
      assert.deepEqual(e.sch, { v1: '2026-11-06', v2: '2026-11-14', v4a: '2026-11-16', v4b: '2026-11-13', v5: '2026-11-15', t1: '2026-11-17' });
      assert.deepEqual(e.as, { as1: '2026-11-05', as2: '2026-11-14', as3: '2026-11-12', as4: '2026-11-13', as5: '2026-11-15' }, '일정 창: asId 만 남은 기록·지워진 방문 일정 기록 따라감 · 다른 방문 일정 AS 그대로 · 메모만 고친 저장은 그대로 · 보통 일정은 AS 안 건드림 ' + JSON.stringify(e.as));
      assert.match(e.toast, /AS 방문일도 2026-11-14 로 맞췄습니다/, '일정 창 토스트 ' + e.toast);
    });

    await test('③ 캘린더 파일 가져오기(안전장치) — 같은 uid 로 날짜가 바뀐 AS 방문 일정은 방문일도 따라감 · 날짜 같은 갱신·보통 일정은 그대로 (ICS)', async () => {
      // 합성 꼴: 앱이 만든 AS 방문 일정에는 icsUid 가 없다(AS 관리에서만 만들고, uid 는 가져오기·맞추기 '새 일정'만 붙인다) — 그래서 uid 를 손으로 붙인다.
      // 지금은 이 길로 AS 방문 날짜가 바뀌지 않지만, 나중에 AS 방문 일정에 uid 가 붙어도 방문일이 어긋나지 않는지 지킨다.
      await page.evaluate(SEED);
      const r = await page.evaluate(async ics => {
        state.schedule.find(s => s.id === 'v1').icsUid = 'as-uid-1@test';
        state.schedule.find(s => s.id === 'v2').icsUid = 'as-uid-2@test';
        state.schedule.find(s => s.id === 't1').icsUid = 'tile-uid@test';
        state.asLog.find(a => a.id === 'as2').visitAt = '2026-11-08';   // 이미 어긋나 있던 옛 자료 — 날짜가 그대로인 갱신은 손대지 않는다
        const out = await importICS(ics);
        return { out, as: AS(), sch: SCH() };
      }, ICS);
      assert.deepEqual(r.out, { 추가: 0, 갱신: 3, 취소: 0 }, '전제: 세 건 모두 같은 uid 로 갱신 ' + JSON.stringify(r.out));
      assert.equal(r.sch.v1, '2026-11-16'); assert.equal(r.sch.v2, '2026-11-07'); assert.equal(r.sch.t1, '2026-11-18');
      assert.equal(r.as.as1, '2026-11-16', '날짜가 바뀐 AS 방문 일정은 방문일도 따라간다 ' + JSON.stringify(r.as));
      assert.equal(r.as.as2, '2026-11-08', '날짜가 같은 갱신은 AS 를 건드리지 않는다(v331 과 같음) ' + JSON.stringify(r.as));
      assert.equal(r.as.as3, '2026-11-12'); assert.equal(r.as.as4, '2026-11-13'); assert.equal(r.as.as5, '2026-11-08');
    });

    await test('④ 폰 390 AS 관리 넘침 없음 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(SEED);
      await page.evaluate(() => asManage());
      await page.waitForSelector('#modalRoot .modal');
      const over = await page.evaluate(() => (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0) + [...document.querySelectorAll('#modalRoot .modal')].filter(e => e.scrollWidth - e.clientWidth > 1).length);
      assert.equal(over, 0, '넘침 없음');
      await page.evaluate(() => closeModal(true));
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('asvisitsync-v594: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL asvisitsync-v594', e && e.stack || e); process.exit(1); });

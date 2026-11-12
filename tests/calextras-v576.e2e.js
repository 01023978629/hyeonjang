/* v576 🔄 구글 캘린더 맞추기 덧붙임 — 🤖 제미나이 칩 · 종일 여러 날 일정 (v567 '안 한 것' 두 가지)
   대표(2026-11-10) "@표시는 제미나이가 한 거야" — 맞추기 창은 '@' 를 떼고 넣어, 일정표에서는 누가 넣은 일정인지 안 보였다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-10 고정, 바깥 쓰기 0.
   ① .ics 종일 여러 날 — DTEND(끝난 다음 날)에서 하루 뺀 날이 마지막 날 · 하루짜리·시각 있는 일정·60일 넘는 끝은 to 없음 (PARSE)
   ② 계획·미리보기 — 새 일정 줄에 '~ 끝 날짜' · 읽기만 (PLAN)
   ③ 반영 — 메모 머리 '시작~끝 (N일)' → hjSchSpan·이어지는 날(일요일 제외) · '@' 일정은 icsBy gemini · '@' 없는 일정은 없음 · 안전판 1회 (APPLY)
   ④ 일정표 🤖 제미나이 칩 — 새 일정(icsBy) · v567~v575 이 넣은 옛 일정(메모 글) · 보통 일정엔 없음 · 저장본 왕복 · 폰 390 넘침 없음 (CHIP)
   ⑤ 다시 읽으면 '이미 같음' — 여러 날 일정이 두 번 들어가지 않는다 · 페이지 오류 0 · 외부 쓰기 0 (AGAIN)
   HJ_V576_BASELINE=<commit> 은 ① 에서, HJ_V576_MUTATION=no-span(메모에 기간을 안 적음)은 ③, no-chip(칩 판정을 늘 거짓)은 ④ 에서 실패해야 한다. */
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
  'no-span': ["const span=r.to&&r.to>r.date?r.date+'~'+r.to+' ('+(hjWorkDaysBetween(r.date,r.to)+1)+'일)':'';", "const span='';"],
  'no-chip': ["function hjSchGemini(s){return !!s&&(s.icsBy==='gemini'||HJ_GEMINI_MEMO_RE.test(String(s.memo||'')));}", 'function hjSchGemini(s){return false;}']
};
let html = process.env.HJ_V576_BASELINE ? execFileSync('git', ['show', process.env.HJ_V576_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V576_MUTATION) {
  const m = MUT[process.env.HJ_V576_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V576_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const EV = (uid, lines) => ['BEGIN:VEVENT', 'UID:' + uid].concat(lines, ['END:VEVENT']);
const ICS = ['BEGIN:VCALENDAR'].concat(
  EV('m3@test', ['DTSTART;VALUE=DATE:20261116', 'DTEND;VALUE=DATE:20261119', 'SUMMARY:@가온아파트 욕실 방수 공사', 'LOCATION:가온아파트 3동']),   // 월~수 3일
  EV('m7@test', ['DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261125', 'SUMMARY:나래마을 도배']),                                        // 금~화(일요일 낌) 5일 → 작업일 4
  EV('d1@test', ['DTSTART;VALUE=DATE:20261126', 'DTEND;VALUE=DATE:20261127', 'SUMMARY:하루 종일 일정']),
  EV('t1@test', ['DTSTART:20261127T010000Z', 'DTEND:20261127T030000Z', 'SUMMARY:@다솜아파트 창틀 실리콘']),
  EV('x9@test', ['DTSTART;VALUE=DATE:20261201', 'DTEND;VALUE=DATE:20270301', 'SUMMARY:끝 날짜가 이상한 일정']),
  ['END:VCALENDAR']).join('\r\n');

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calextras-v576 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
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
  state.projects = [P('가온아파트'), P('나래마을아파트'), P('다솜아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  const S = (id, date, time, title, extra) => Object.assign({ id, date, time, title, project: '', workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [S('OLD', '2026-11-12', '09:00', '옛 맞추기 일정', { memo: '장소: 시험로 1\n구글 캘린더에서 가져옴 (@ 제미나이 입력)' }), S('MAN', '2026-11-12', '13:00', '손으로 넣은 일정', { memo: '구글 캘린더에서 가져옴' })];
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    await test('① .ics 종일 여러 날 — 마지막 날 = DTEND 하루 전 · 하루짜리·시각 있는 일정·60일 넘는 끝은 없음 (PARSE)', async () => {
      const r = await page.evaluate(t => hjCalSyncParse(t).map(e => [e.uid, e.date, e.time || '종일', e.to || '']), ICS);
      assert.deepEqual(r, [['m3@test', '2026-11-16', '종일', '2026-11-18'], ['m7@test', '2026-11-20', '종일', '2026-11-24'], ['d1@test', '2026-11-26', '종일', ''],
        ['t1@test', '2026-11-27', '10:00', ''], ['x9@test', '2026-12-01', '종일', '']]);
    });
    await test('② 계획·미리보기 — 새 일정 줄에 끝 날짜 · 읽기만 (PLAN)', async () => {
      const r = await page.evaluate(t => { const before = JSON.stringify(serializeData().schedule); const plan = hjCalSyncPlan(hjCalSyncParse(t));
        return { rows: plan.rows.map(x => [x.status, x.date, x.to || '', x.title, x.marks.join('')]), text: plan.rows.map(hjCalSyncRowText), same: before === JSON.stringify(serializeData().schedule) }; }, ICS);
      assert.deepEqual(r.rows.filter(x => x[0] === 'new').map(x => x.slice(1)), [['2026-11-16', '2026-11-18', '가온아파트 욕실 방수 공사', '@'], ['2026-11-20', '2026-11-24', '나래마을 도배', ''],
        ['2026-11-26', '', '하루 종일 일정', ''], ['2026-11-27', '', '다솜아파트 창틀 실리콘', '@'], ['2026-12-01', '', '끝 날짜가 이상한 일정', '']]);
      assert.match(r.text[0], /^11\/16\(월\) 종일 ~ 11\/18\(수\) 가온아파트 욕실 방수 공사/, r.text[0]);
      assert.ok(!/ ~ /.test(r.text[2]), '하루짜리엔 끝 날짜 없음 — ' + r.text[2]);
      assert.ok(r.same, '계획은 읽기만');
    });
    await test('③ 반영 — 메모 머리 기간 → 이어지는 날 · @ 일정만 icsBy · 안전판 1회 (APPLY)', async () => {
      await page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, ICS);
      await page.waitForSelector('#csBody [data-cs-row="new"]');
      const snaps0 = await page.evaluate(async () => (await hjSnapList()).length).catch(() => null);
      await page.click('#csApply');
      await page.waitForFunction(() => state.schedule.length === 7);
      const r = await page.evaluate(async () => {
        const g = u => state.schedule.find(s => s.icsUid === u), a = g('m3@test'), b = g('m7@test'), d = g('d1@test'), t = g('t1@test');
        let snaps = null; try { snaps = (await hjSnapList()).length; } catch (e) {}
        return { a: { title: a.title, memo: a.memo, by: a.icsBy, project: a.project, span: hjSchSpan(a), c17: hjSchContOn(a, '2026-11-17'), c19: hjSchContOn(a, '2026-11-19') },
          b: { memo: b.memo, by: b.icsBy, span: hjSchSpan(b), sun: hjSchContOn(b, '2026-11-22'), mon: hjSchContOn(b, '2026-11-23') },
          d: { memo: d.memo, span: hjSchSpan(d) }, t: { by: t.icsBy, time: t.time, hours: t.hours, memo: t.memo }, snaps };
      });
      assert.equal(r.a.title, '가온아파트 욕실 방수 공사'); assert.equal(r.a.by, 'gemini'); assert.equal(r.a.project, '가온아파트');
      assert.match(r.a.memo, /^2026-11-16~2026-11-18 \(3일\)\n장소: 가온아파트 3동\n구글 캘린더에서 가져옴 \(@ 제미나이 입력\)$/, r.a.memo);
      assert.deepEqual([r.a.span.to, r.a.span.days], ['2026-11-18', 3]);
      assert.ok(r.a.c17 && r.a.c17.day === 2 && r.a.c17.days === 3, '11/17 은 2/3일째 — ' + JSON.stringify(r.a.c17));
      assert.equal(r.a.c19, null, 'DTEND(11/19)는 포함되지 않는 날');
      assert.match(r.b.memo, /^2026-11-20~2026-11-24 \(4일\)\n/, r.b.memo); assert.equal(r.b.by, undefined, '@ 없는 일정엔 icsBy 없음');
      assert.equal(r.b.sun, null, '일요일은 이어지는 날 아님'); assert.ok(r.b.mon && r.b.mon.day === 3, '월요일은 3/4일째 — ' + JSON.stringify(r.b.mon));
      assert.ok(!/~/.test(r.d.memo) && r.d.span.days === 1, '하루짜리는 기간 메모 없음 — ' + r.d.memo);
      assert.deepEqual([r.t.by, r.t.time, r.t.hours], ['gemini', '10:00', 2]);
      if (snaps0 != null && r.snaps != null) assert.equal(r.snaps - snaps0, 1, '안전판 1회');
    });
    await test('④ 일정표 🤖 제미나이 칩 — icsBy · 옛 메모 글 · 보통 일정엔 없음 · 저장본 왕복 (CHIP)', async () => {
      const r = await page.evaluate(() => {
        const chips = d => { __calSelDate = d; render(); return [...document.querySelectorAll('#view .sch-item')].map(el => [(el.querySelector('.sch-title') || {}).textContent.replace(/\s+/g, ' ').trim(), !!el.querySelector('[data-schgemini]')]); };
        const d12 = chips('2026-11-12'), d16 = chips('2026-11-16'), d20 = chips('2026-11-20'), d27 = chips('2026-11-27');
        __calSelDate = null; render();
        const round = JSON.parse(JSON.stringify(serializeData())).schedule;
        return { d12, d16, d20, d27, by: round.filter(s => s.icsBy === 'gemini').map(s => s.icsUid).sort() };
      });
      assert.deepEqual(r.d12.map(x => x[1]), [true, false], '옛 메모 글은 칩 · 메모에 표시 없는 일정은 없음 — ' + JSON.stringify(r.d12));
      assert.ok(r.d16.length === 1 && r.d16[0][1] && /🤖 제미나이/.test(r.d16[0][0]) && !/@/.test(r.d16[0][0].replace('🤖 제미나이', '')), '새 @ 일정은 칩 · 제목에 @ 없음 — ' + JSON.stringify(r.d16));
      assert.deepEqual(r.d20.map(x => x[1]), [false], '@ 없는 일정엔 칩 없음');
      assert.deepEqual(r.d27.map(x => x[1]), [true]);
      assert.deepEqual(r.by, ['m3@test', 't1@test'], '저장본 왕복 뒤 icsBy 유지');
    });
    await test('⑤ 다시 읽으면 이미 같음 — 두 번 안 들어감 · 폰 390 넘침 없음 · 페이지 오류 0 · 외부 쓰기 0 (AGAIN)', async () => {
      const r = await page.evaluate(t => { const plan = hjCalSyncPlan(hjCalSyncParse(t)); return { rows: plan.rows.filter(x => x.status !== 'apponly').length, same: plan.stats.same, n: state.schedule.length }; }, ICS);
      assert.deepEqual([r.rows, r.same, r.n], [0, 5, 7], JSON.stringify(r));
      const data = await page.evaluate(() => JSON.parse(JSON.stringify({ schedule: state.schedule, projects: state.projects })));
      await context.close();
      const m = await open(390, true);
      const w = await m.page.evaluate(d => { state.projects = d.projects; state.schedule = d.schedule; state.files = []; state.tab = 'schedule'; __calSelDate = '2026-11-16'; render();
        const chip = document.querySelector('#view [data-schgemini]'), b = chip && chip.getBoundingClientRect();
        return { chip: !!chip, right: b ? Math.round(b.right) : 0, over: document.documentElement.scrollWidth - innerWidth, cont: [...document.querySelectorAll('#view [data-schcont]')].length }; }, data);
      assert.ok(w.chip && w.right <= 391 && w.over <= 1, '폰에서 칩이 화면 안 — ' + JSON.stringify(w));
      await m.context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`calextras-v576: ${passed}/5 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calextras-v576 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

/* v580 🔄 구글 캘린더 맞추기 — 여러 날 일정의 기간 지키기 (v576 '안 한 것': 화면 글의 여러 날 줄 · '날짜 옮김' 줄의 기간)
   맞추기의 '날짜 옮김'은 s.date 만 바꿔 메모 머리 '시작~끝 (N일)' 이 남의 날짜가 됐고, hjSchSpan 이 3일 공정을 하루로 봤다
   (둘째·셋째 날이 대시보드·내 업무·달력·지연 점검에서 사라짐). 화면 글 '종일, …, 시작~끝' 은 끝 날짜를 시작일로 읽었고, '시작~끝, 제목, …' 은 안 읽었다.
   같은 날·같은 제목인데 구글 끝 날짜만 다르면 '이미 같음'으로 버렸다. 합성 자료(이름은 지어낸 것), 시계 2026-11-10 고정, 바깥 쓰기 0.
   ① 화면 글 두 날짜 — 줄 끝·줄 머리 · 끝 연도/월 생략 · 해·달 넘김 · 하루짜리 · 60일 넘는 끝 · 없는 날짜는 건너뜀 · 시각 있는 여러 날은 하루 · .ics 와 같은 결과 (PARSE)
   ② 계획 — ⏳ 기간 다름(하루 → 여러 날) · 📆 날짜 옮김 줄에 끝 · 구글이 하루면 앱 기간을 줄이지 않음 · 사람이 고친 메모 머리는 안 봄 · 읽기만 (PLAN)
   ③ 반영 — 옮긴 공정의 메모 머리가 새 날짜로(구글 끝 있으면 그 끝, 없으면 작업일 수 그대로, 일요일로 옮겨도) · 기간 다름은 머리만 · 사람이 고친 머리는 그대로
      · 나머지 칸(report·crew·prep·labor·workers) 보존 · 이어지는 날이 살아 있음 · 안전판 1회 (APPLY)
   ④ 다시 읽으면 바꿀 것 없음 · 미리보기 뒤 메모 머리를 고치면 반영 거부 (AGAIN)
   ⑤ 폰 390 — 넘침 없음·44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V580_BASELINE=<commit> 은 ① 에서, HJ_V580_MUTATION=last-date(끝 날짜를 시작일로)는 ①, no-shift(날짜 옮김에서 메모 그대로)는 ③ 에서 실패해야 한다. */
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
  'last-date': ['if(rg){const r=hjCalSyncRangeOf(rg);if(!r)return;date=r.date;end=r.end;}', "if(rg){const r=hjCalSyncRangeOf(rg);if(!r)return;date=r.end||r.date;end='';}"],
  'no-shift': ["if(own){if(r.to&&r.to>r.date)s.memo=hjCalSyncSpanMemo(s.memo,r.date,r.to);\n        else if(sp.days>1){let nm=hjShiftRangeMemo(s.memo,old,hjWorkDaysBetween(old,r.date));const m=nm&&nm.match(HJ_RANGE_MEMO_RE);\n          if(!m||m[1]!==r.date)nm=hjCalSyncSpanMemo(s.memo,r.date,hjShiftWorkDays(r.date,sp.days-1));s.memo=nm;}}", '']
};
let html = process.env.HJ_V580_BASELINE ? execFileSync('git', ['show', process.env.HJ_V580_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V580_MUTATION) {
  const m = MUT[process.env.HJ_V580_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V580_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
// ① 읽기용 — 화면 글 여러 꼴
const PARSE_TEXT = [
  '일정 9개, 11월 16일 (월요일)',
  '종일, @가온아파트 욕실 방수, 홍길동, 위치: 가온아파트 3동, 2026년 11월 16일~2026년 11월 18일',
  '2026년 11월 19일~2026년 11월 21일, 나래마을 도배, 홍길동, 위치 없음,',
  '종일, 해넘이 작업, 홍길동, 위치 없음, 2026년 12월 30일~1월 2일',
  '2026년 11월 30일~2일, 달넘이 작업, 홍길동, 위치: 시험로 1,',
  '종일, 하루 작업, 홍길동, 위치 없음, 2026년 11월 17일',
  '종일, 끝이 먼 일정, 홍길동, 위치 없음, 2026년 11월 20일~2027년 2월 1일',
  '종일, 없는 날짜, 홍길동, 위치 없음, 2026년 2월 30일~2026년 3월 2일',
  '2026년 11월 2일 오후 7:20~2026년 11월 8일 오후 9:30, 긴 모임, 캘린더: 시험모임, 위치: 대강당,'
].join('\n');
const PARSE_ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:p1@test', 'DTSTART;VALUE=DATE:20261116', 'DTEND;VALUE=DATE:20261119', 'SUMMARY:@가온아파트 욕실 방수', 'LOCATION:가온아파트 3동', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:p2@test', 'DTSTART;VALUE=DATE:20261119', 'DTEND;VALUE=DATE:20261122', 'SUMMARY:나래마을 도배', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
// ②③ 맞추기용 — 앱 일정과 견줄 구글 화면 글
const TEXT = [
  '종일, 타일, 홍길동, 위치 없음, 2026년 11월 13일~2026년 11월 16일',                     // T 11/12~11/14 → 11/13~11/16 (금·토·월)
  '오전 9시~오후 5시, 몰딩, 홍길동, 위치 없음, 2026년 11월 15일',                           // U 토요일 → 일요일로(작업일 0)
  '종일, 방수, 홍길동, 위치 없음, 2026년 11월 16일~2026년 11월 18일',                      // B 하루 → 3일 (기간 다름)
  '오전 9시~오후 5시, 도배, 홍길동, 위치 없음, 2026년 11월 18일',                           // W 11/17~11/19 → 11/18 (구글은 하루로 보임)
  '종일, 청소, 홍길동, 위치 없음, 2026년 11월 20일',                                         // C 2일짜리 — 구글은 하루: 줄이지 않음
  '2026년 11월 23일~2026년 11월 25일, 줄눈, 홍길동, 위치 없음,',                           // H 사람이 고친 메모 머리 — 안 봄
  '종일, 필름, 홍길동, 위치 없음, 2026년 11월 26일'                                          // F 사람이 고친 메모 머리 — 날짜만 옮김
].join('\n');

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calmulti-v580 ' + name); }
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
  state.projects = [P('가온아파트'), P('나래마을아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  const S = (id, date, time, title, memo, extra) => Object.assign({ id, date, time, title, project: '가온아파트', workers: '', hours: 8, memo, report: null }, extra || {});
  state.schedule = [
    S('T', '2026-11-12', '', '타일', '2026-11-12~2026-11-14 (3일)\n자재: 줄눈 회색'),
    S('U', '2026-11-14', '', '몰딩', '2026-11-14~2026-11-17 (3일)'),
    S('B', '2026-11-16', '', '방수', 'B 메모', { report: { progress: '50%', weather: '맑음' }, crew: '박방수' }),
    S('W', '2026-11-17', '', '도배', '2026-11-17~2026-11-19 (3일)\n벽지 실크', { crew: '김도배', workers: '2', prep: { done: ['풀'] }, labor: { amount: 300000 }, hours: 8 }),
    S('C', '2026-11-20', '', '청소', '2026-11-20~2026-11-21 (2일)'),
    S('H', '2026-11-23', '', '줄눈', '2026-11-21~2026-11-24 (4일) 손으로 고침'),
    S('F', '2026-11-24', '', '필름', '2026-11-10~2026-11-12 (3일) 손으로 고침')];
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    await test('① 화면 글 두 날짜 — 줄 끝·머리 · 연도/월 생략 · 해·달 넘김 · 하루 · 60일 · 없는 날짜 · 시각 있는 여러 날 · .ics 와 같음 (PARSE)', async () => {
      const r = await page.evaluate(({ t, ics }) => ({ text: hjCalSyncParse(t).map(e => [e.date, e.time || '종일', e.to || '', e.hours, e.raw, e.location]),
        ics: hjCalSyncParse(ics).map(e => [e.date, e.to || '', e.raw]) }), { t: PARSE_TEXT, ics: PARSE_ICS });
      assert.deepEqual(r.text, [
        ['2026-11-16', '종일', '2026-11-18', 8, '@가온아파트 욕실 방수', '가온아파트 3동'],
        ['2026-11-19', '종일', '2026-11-21', 8, '나래마을 도배', ''],
        ['2026-12-30', '종일', '2027-01-02', 8, '해넘이 작업', ''],
        ['2026-11-30', '종일', '2026-12-02', 8, '달넘이 작업', '시험로 1'],
        ['2026-11-17', '종일', '', 8, '하루 작업', ''],
        ['2026-11-20', '종일', '', 8, '끝이 먼 일정', ''],
        ['2026-11-02', '19:20', '', 1, '긴 모임', '대강당']], JSON.stringify(r.text));
      assert.deepEqual(r.ics, r.text.slice(0, 2).map(x => [x[0], x[2], x[4]]), '같은 일정은 .ics 와 화면 글이 같은 날짜·끝 — ' + JSON.stringify(r.ics));
    });
    await test('② 계획 — 기간 다름 · 날짜 옮김 끝 · 구글 하루면 안 줄임 · 사람이 고친 머리는 안 봄 · 읽기만 (PLAN)', async () => {
      const r = await page.evaluate(t => { const before = JSON.stringify(serializeData().schedule); const P = hjCalSyncPlan(hjCalSyncParse(t));
        return { rows: P.rows.map(x => [x.status, x.app ? x.app.id : '', x.date, x.to || '', x.app ? x.app.to || '' : '', x.check]), text: P.rows.map(hjCalSyncRowText), same: P.stats.same, unchanged: before === JSON.stringify(serializeData().schedule) }; }, TEXT);
      assert.deepEqual(r.rows, [
        ['span', 'B', '2026-11-16', '2026-11-18', '', true],
        ['move', 'T', '2026-11-13', '2026-11-16', '2026-11-14', true],
        ['move', 'U', '2026-11-15', '', '2026-11-17', true],
        ['move', 'W', '2026-11-18', '', '2026-11-19', true],
        ['move', 'F', '2026-11-26', '', '', true]], JSON.stringify(r.rows));
      assert.equal(r.same, 2, '청소(구글 하루)·줄눈(사람이 고친 머리)은 이미 같음 — ' + r.same);
      assert.match(r.text[0], /^11\/16\(월\) 종일 방수 — 기간 하루 → ~11\/18\(수\)$/, r.text[0]);
      assert.match(r.text[1], /^11\/13\(금\) 종일 타일 — 날짜 11\/12\(목\) → 11\/13\(금\) ~ 11\/16\(월\)$/, r.text[1]);
      assert.ok(r.unchanged, '계획은 읽기만');
      await page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await page.waitForSelector('#csBody [data-cs-row="span"]');
      const v = await page.evaluate(() => ({ sum: document.querySelector('[data-cs-sum]').innerText.replace(/\s+/g, ' '), span: document.querySelector('#csBody [data-cs-row="span"]').innerText.replace(/\s+/g, ' ').trim() }));
      assert.ok(v.sum.includes('기간 다름 1') && v.sum.includes('날짜 옮김 4') && v.sum.includes('이미 같음 2'), v.sum);
      assert.ok(v.span.startsWith('⏳ 기간 다름') && v.span.includes('기간 하루 → ~11/18(수)'), v.span);
      await page.evaluate(() => closeModal(true));
    });
    await test('③ 반영 — 메모 머리가 새 날짜로 · 기간 다름은 머리만 · 사람이 고친 머리 그대로 · 다른 칸 보존 · 이어지는 날 · 안전판 1회 (APPLY)', async () => {
      await page.evaluate(t => { window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { window.__snaps.push(a[0]); return o(...a); };
        hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await page.waitForSelector('#csBody [data-cs-row="move"]');
      await page.click('#csApply');
      await page.waitForFunction(() => state.schedule.find(s => s.id === 'T').date === '2026-11-13');
      const r = await page.evaluate(() => {
        const g = id => state.schedule.find(s => s.id === id), sp = id => { const x = hjSchSpan(g(id)); return [x.from, x.to, x.days]; };
        return { snaps: window.__snaps, n: state.schedule.length,
          memo: Object.fromEntries(['T', 'U', 'B', 'W', 'C', 'H', 'F'].map(id => [id, g(id).memo])),
          date: Object.fromEntries(['T', 'U', 'B', 'W', 'C', 'H', 'F'].map(id => [id, g(id).date + ' ' + (g(id).time || '종일')])),
          span: { T: sp('T'), U: sp('U'), B: sp('B'), W: sp('W'), C: sp('C') },
          cont: { T14: hjSchContOn(g('T'), '2026-11-14'), T16: hjSchContOn(g('T'), '2026-11-16'), B17: hjSchContOn(g('B'), '2026-11-17'), W20: hjSchContOn(g('W'), '2026-11-20'), U16: hjSchContOn(g('U'), '2026-11-16') },
          keep: { B: [g('B').report, g('B').crew], W: [g('W').crew, g('W').workers, g('W').prep, g('W').labor, g('W').hours] },
          dash: hjSchContinuing('2026-11-17').map(x => x.s.id).sort() };
      });
      assert.deepEqual(r.snaps.filter(x => x === '구글 캘린더 맞추기 전'), ['구글 캘린더 맞추기 전'], '안전판 1회 — ' + JSON.stringify(r.snaps));
      assert.equal(r.n, 7, '새 일정·지운 일정 없음');
      assert.deepEqual(r.date, { T: '2026-11-13 종일', U: '2026-11-15 09:00', B: '2026-11-16 종일', W: '2026-11-18 09:00', C: '2026-11-20 종일', H: '2026-11-23 종일', F: '2026-11-26 종일' }, JSON.stringify(r.date));
      assert.deepEqual(r.memo, {
        T: '2026-11-13~2026-11-16 (3일)\n자재: 줄눈 회색',          // 구글 끝 날짜로(금·토·월 작업일 3)
        U: '2026-11-15~2026-11-17 (3일)',                           // 토→일(작업일 0)에도 머리 시작 = 새 날짜
        B: '2026-11-16~2026-11-18 (3일)\nB 메모',                  // 기간 다름 — 머리만 덧붙임
        W: '2026-11-18~2026-11-20 (3일)\n벽지 실크',                // 구글은 하루 — 작업일 수 그대로 옮김(v353 hjShiftRangeMemo)
        C: '2026-11-20~2026-11-21 (2일)',
        H: '2026-11-21~2026-11-24 (4일) 손으로 고침',
        F: '2026-11-10~2026-11-12 (3일) 손으로 고침' }, JSON.stringify(r.memo));
      assert.deepEqual(r.span, { T: ['2026-11-13', '2026-11-16', 3], U: ['2026-11-15', '2026-11-17', 3], B: ['2026-11-16', '2026-11-18', 3], W: ['2026-11-18', '2026-11-20', 3], C: ['2026-11-20', '2026-11-21', 2] }, JSON.stringify(r.span));
      assert.ok(r.cont.T14 && r.cont.T14.day === 2 && r.cont.T16 && r.cont.T16.day === 3, '옮긴 타일의 둘째·셋째 날 — ' + JSON.stringify(r.cont));
      assert.ok(r.cont.B17 && r.cont.B17.day === 2 && r.cont.W20 && r.cont.W20.day === 3 && r.cont.U16 && r.cont.U16.day === 2, JSON.stringify(r.cont));
      assert.deepEqual(r.keep, { B: [{ progress: '50%', weather: '맑음' }, '박방수'], W: ['김도배', '2', { done: ['풀'] }, { amount: 300000 }, 8] }, '나머지 칸 보존 — ' + JSON.stringify(r.keep));
      assert.deepEqual(r.dash, ['B', 'U'], '11/17 이어지는 공정(대시보드·내 업무가 읽는 것) — ' + JSON.stringify(r.dash));
    });
    await test('④ 다시 읽으면 바꿀 것 없음 · 미리보기 뒤 메모 머리를 고치면 반영 거부 (AGAIN)', async () => {
      const r = await page.evaluate(async t => {
        const P = hjCalSyncPlan(hjCalSyncParse(t)), out = { rows: P.rows.map(x => x.status), same: P.stats.same };
        const P2 = hjCalSyncPlan(hjCalSyncParse('종일, 타일, 홍길동, 위치 없음, 2026년 11월 13일~2026년 11월 18일'));
        out.rows2 = P2.rows.map(x => x.status);
        const T = state.schedule.find(s => s.id === 'T'), keep = T.memo; T.memo = keep.replace('2026-11-16 (3일)', '2026-11-17 (4일)');
        const sig = JSON.stringify(state.schedule);
        try { await hjCalSyncApply(P2, [{ i: 0 }]); out.guard = 'applied'; } catch (e) { out.guard = (sig === JSON.stringify(state.schedule) ? 'same:' : 'CHANGED:') + e.message; }
        T.memo = keep; return out;
      }, TEXT);
      assert.deepEqual([r.rows, r.same], [[], 7], '다시 읽으면 7줄 모두 이미 같음 — ' + JSON.stringify(r));
      assert.deepEqual(r.rows2, ['span'], '끝 날짜만 바뀌면 기간 다름');
      assert.match(r.guard, /^same:미리보기 뒤 일정표가 바뀌었/, r.guard);
    });
    await context.close();
    await test('⑤ 폰 390 — 넘침 없음 · 44px · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED);
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT);
      await m.page.waitForSelector('#csBody [data-cs-row="span"]');
      const r = await m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal');
        const small = [...root.querySelectorAll('#hjCalSync button,#hjCalSync select,#hjCalSync label,.mfoot button')].filter(b => b.getClientRects().length).map(b => [b.tagName, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        const wide = [...root.querySelectorAll('#hjCalSync *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).length;
        return { rows: root.querySelectorAll('[data-cs-row]').length, small, wide, over: document.documentElement.scrollWidth - innerWidth }; });
      assert.ok(r.rows === 5 && r.wide === 0 && r.over <= 1, '넘침 없음 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px 미만 — ' + JSON.stringify(r.small));
      await m.context.close();
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`calmulti-v580: ${passed}/5 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calmulti-v580 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

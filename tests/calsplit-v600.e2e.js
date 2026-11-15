/* v600 🔄 구글 캘린더 맞추기 — 같은 날 같은 제목이라도 '다른 구글 일정'은 한 줄로 삼키지 않는다.
   예전에는 읽은 일정을 '날짜|제목 열쇠' 하나로 묶어, 하루에 세 현장으로 잡힌 '@우수관 1개' 세 건(시각·위치·uid 가 다 다름)이 한 줄('구글에 3번')이 되고
   앱에는 한 건만 들어갔다. 다시 읽으면 '같아요'라 나머지 두 현장 작업은 일정표·팀 지시·일정 공유에 영영 안 들어왔다. 합성 이름만, 시계 2026-11-10 고정, 바깥 쓰기 0.
   ① 구글 바로 읽기 — 같은 날 같은 제목 3건(uid·시각·위치 다름) → 새 일정 3줄(각자 시각·위치·체크) → 반영 3건(각자 uid·장소) → 다시 읽으면 0줄·이미 같음 3 (SPLIT)
   ② 한 줄로 남는 것 — '@제목'+앱이 올린 사본(제목 머리·태그 private/shared·설명 끝줄) · 같은 시각·같은(빈) 위치의 진짜 겹침 · 같은 uid · 사본뿐인 묶음 (ONE-ROW)
   ③ 사본은 제 칸에 — 나뉜 일정을 넣은 뒤 올라온 사본(태그 hjKey = 앱 일정 id)이 그 일정의 구글 원본 칸에 붙어 다시 읽으면 0줄(앱에서 시각을 고친 일정도) (COPY-ATTACH)
   ④ 화면 글(uid 없음) — 시각이 다른 두 줄 · 같은 시각에 위치만 다른 두 줄도 따로 · 합성 uid 가 기록마다 다름 · 다시 읽으면 0줄(기록 차례가 뒤집혀도) ·
      한 줄만 남아도·앱에서 시각을 고쳐도 시각이 같은 기록과 짝 (TEXT)
   ⑤ 이어지는 날·날짜 옮김 — 여러 날 공정의 이어지는 날에 같은 제목이 둘이면 한 칸만 이어지는 날 · uid 로 옮겨 온 일정 옆의 새 일정도 따로 · 계획은 읽기만 (CONT-MOVE)
   ⑥ 폰 390 — 붙여 넣기 → 미리보기 3줄(각자 위치·'같은 날 같은 제목 3건')·안내 → 반영(안전판 1회) · 넘침 없음·44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V600_BASELINE=<commit> 와 HJ_V600_MUTATION=no-split(칸을 안 나눔)은 ①, copy-own-slot(사본도 제 칸)·split-same-time(같은 시각·같은 위치도 나눔)·
   no-shared-tag(태그 shared 를 안 봄)는 ②, no-appid-attach(사본을 가리키는 일정의 칸에 안 붙임)·no-day-key(태그의 이어지는 날 꼬리 '-dN' 을 안 뗌)는 ③,
   no-time-pref(칸마다 시각이 같은 앱 일정을 먼저 짝 짓지 않음)·no-time-tie(한 칸일 때 시각이 같은 앱 일정을 먼저 고르지 않음)·synth-uid-same(합성 uid 가 칸마다 같음)·
   loc-dedupe(위치만 다른 줄을 똑같은 줄로 버림)는 ④,
   cont-all(이어지는 날이 칸을 다 삼킴)은 ⑤ 에서 실패해야 한다. */
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
  'no-split': ['  if(slots.length<2)return [list];\n', '  return [list];\n'],
  'copy-own-slot': ["const copy=x=>!!x.copy||x.mark==='app'||String(x.memo||'').includes(HJ_CALSYNC_COPY_NOTE),tm=", 'const copy=x=>false,tm='],
  'split-same-time': ['||slots.find(y=>y.time===tm(x)&&(!l||!y.loc||y.loc===l));', '||slots.find(y=>false);'],
  'no-shared-tag': ['||!!(xp&&xp.shared&&xp.shared.hjKey)||', '||'],
  'no-appid-attach': ['at.set(x,(au&&slots.find(y=>y.uids.has(au)))||slots.find(', 'at.set(x,slots.find('],
  'no-day-key': ["||apps.find(a=>String(a.s.id)===k.replace(HJ_CALSYNC_COPY_DAY_RE,''))||null", '||null'],
  'no-time-pref': ['    if(g.sibs>1)timePair(g);\n', ''],
  'no-time-tie': ["||(String(y.s.time||'')===String(rep.time||'')?1:0)-(String(x.s.time||'')===String(rep.time||'')?1:0))[0];", ')[0];'],
  'synth-uid-same': ["let u=taken.has(b)?t:b;for(let n=2;taken.has(u);n++)u=t+'#'+n;taken.add(u);return u;", 'return b;'],
  'loc-dedupe': ["+'|'+to+'|'+(lm?lm[1].trim():'');if(seen.has(k))return;", "+'|'+to;if(seen.has(k))return;"],
  'cont-all': ['    if(hit&&contFull(g))hit=false;\n', '']
};
let html = process.env.HJ_V600_BASELINE ? execFileSync('git', ['show', process.env.HJ_V600_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V600_MUTATION) {
  const m = MUT[process.env.HJ_V600_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V600_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V600_MUTATION); html = SRC.replace(m[0], () => m[1]);
}
// 구글 캘린더 API 일정 모양(합성) — 시각 있는 일정
const T = (id, summary, date, t1, t2, extra) => Object.assign({ kind: 'calendar#event', id, iCalUID: id + '@google.com', status: 'confirmed', summary,
  start: { dateTime: date + 'T' + t1 + ':00+09:00', timeZone: 'Asia/Seoul' }, end: { dateTime: date + 'T' + t2 + ':00+09:00', timeZone: 'Asia/Seoul' }, eventType: 'default' }, extra || {});
const NOTE = '현장: 시험\n— 만물인테리어 현장 앱 일정(자동). 앱에서 고치거나 지우면 한 시간 안에 여기도 바뀝니다.';
const LOC_A = '시험시 새벽로 12 모란아파트 303동 704호', LOC_B = '시험시 달빛로 8 나래마을아파트 101동 202호';
// ① 같은 날 같은 제목 세 건 — 제미나이가 하루에 세 현장으로 잡은 꼴
const THREE = [T('u1', '@우수관 1개', '2026-11-13', '09:00', '11:00', { location: LOC_A }), T('u2', '@우수관 1개', '2026-11-13', '14:00', '16:00', { location: LOC_B }), T('u3', '@우수관 1개', '2026-11-13', '17:00', '18:00')];
// ② 한 줄로 남아야 하는 것들
const ONE = [
  T('k1', '@도배', '2026-11-16', '09:00', '17:00', { location: '한빛로 3' }), T('k1c', '[가온아파트] 도배', '2026-11-16', '09:00', '17:00', { location: '시험시 가온로 1' }),            // 제목 머리 '[현장]' 사본 — 위치 글이 달라도 한 줄
  T('k2', '@미장', '2026-11-17', '09:00', '17:00', { location: '한빛로 3' }), T('k2c', '미장', '2026-11-17', '10:00', '18:00', { extendedProperties: { shared: { hjKey: 'gone-1', hjSig: 's' } } }),   // 태그(shared)만 있는 사본 — 시각이 달라도 한 줄
  T('k3', '@목공', '2026-11-18', '09:00', '17:00'), T('k3c', '목공', '2026-11-18', '13:00', '17:00', { description: NOTE }),                                                     // 설명 끝줄만 있는 사본
  T('k4', '창호', '2026-11-18', '09:00', '10:00'), T('k4c', '창호', '2026-11-18', '11:00', '12:00', { extendedProperties: { private: { hjKey: 'gone-2' } } }),                 // 태그(private)
  T('d1', '@방수', '2026-11-19', '09:00', '12:00', { location: '달빛로 8' }), T('d2', '@방수', '2026-11-19', '09:00', '12:00', { location: '달빛로 8' }), T('d3', '@방수', '2026-11-19', '09:00', '12:00'),   // 진짜 겹침(같은 시각·같은/빈 위치)
  Object.assign(T('s1a', '@타공', '2026-11-20', '09:00', '10:00', { location: '가' }), { iCalUID: 'same@google.com' }), Object.assign(T('s1b', '@타공', '2026-11-20', '13:00', '14:00', { location: '나' }), { iCalUID: 'same@google.com' }),   // 같은 uid
  T('c1', '[가온아파트] 실리콘', '2026-11-21', '09:00', '10:00'), T('c2', '[나래마을아파트] 실리콘', '2026-11-21', '14:00', '15:00')                                           // 사본뿐인 묶음 — 예전처럼 한 줄
];
// ③ 나뉜 세 일정을 넣은 뒤 Watchdog 이 사본을 올린 꼴 — r2 는 앱에서 10:00 으로 고쳤다(사본도 10:00)
const AFTER = [THREE[0], T('w1', '[모란아파트] 우수관 1개', '2026-11-13', '09:00', '11:00', { location: '시험시 새벽로 12', description: NOTE, extendedProperties: { private: { hjKey: 'r1', hjSig: 'a' } } }),
  T('w2', '[나래마을아파트] 우수관 1개', '2026-11-13', '10:00', '12:00', { location: '시험시 달빛로 8', description: NOTE, extendedProperties: { shared: { hjKey: 'r2', hjSig: 'b' } } }),
  THREE[1], THREE[2], T('w3', '우수관 1개', '2026-11-13', '17:00', '18:00', { description: NOTE, extendedProperties: { private: { hjKey: 'r3', hjSig: 'c' } } })];
// ④ 화면 글 — uid 없음
const TEXT = [
  '오전 9시~오전 11시, @우수관 1개, 홍길동, 위치: 새벽로 12 모란아파트 303동 704호, 2026년 11월 13일',
  '오후 2시~오후 4시, @우수관 1개, 홍길동, 위치: 달빛로 8 나래마을아파트 101동 202호, 2026년 11월 13일',
  '오전 10시~오전 11시, @누수 탐지, 홍길동, 위치: 새벽로 12 모란아파트, 2026년 11월 14일',
  '오전 10시~오전 11시, @누수 탐지, 홍길동, 위치: 달빛로 8 나래마을아파트, 2026년 11월 14일',
  '오전 10시~오전 11시, @누수 탐지, 홍길동, 위치 없음, 2026년 11월 14일',
  '오후 3시~오후 4시, @점검, 홍길동, 위치: 한빛상가, 2026년 11월 14일',
  '오후 3시~오후 4시, @점검, 홍길동, 위치: 한빛상가, 2026년 11월 14일'
].join('\n');
const TEXT_MORE = TEXT + '\n오후 5시~오후 6시, @우수관 1개, 홍길동, 위치 없음, 2026년 11월 13일';
// ⑤ 이어지는 날·날짜 옮김
const CONT = [Object.assign(T('gm', '@타일', '2026-11-16', '09:00', '17:00'), { iCalUID: 'm@google.com' }),
  T('e1', '@타일', '2026-11-17', '09:00', '17:00'), T('e2', '@타일', '2026-11-17', '13:00', '15:00', { location: LOC_B }), T('e3', '@타일', '2026-11-18', '09:00', '17:00'),
  Object.assign(T('gu', '@배관 점검', '2026-11-20', '10:00', '11:00', { location: LOC_A }), { iCalUID: 'u@google.com' }), T('gn', '@배관 점검', '2026-11-20', '15:00', '16:00', { location: LOC_B })];
// ⑥ 폰 — 화면 글 세 줄
const TEXT3 = ['오전 9시~오전 11시, @우수관 1개, 홍길동, 위치: 새벽로 12 모란아파트 303동 704호, 2026년 11월 13일',
  '오후 2시~오후 4시, @우수관 1개, 홍길동, 위치: 달빛로 8 나래마을아파트 101동 202호, 2026년 11월 13일', '오후 5시~오후 6시, @우수관 1개, 홍길동, 위치 없음, 2026년 11월 13일'].join('\n');

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calsplit-v600 ' + name); }
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
// 합성 현장 셋 + 넘겨받은 일정(없으면 빈 일정표)
const SEED = sched => {
  closeModal(true);
  const P = (name, addr) => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: addr || '' }, archived: false });
  state.projects = [P('가온아파트', '시험시 가온로 1'), P('모란아파트', '시험시 새벽로 12'), P('나래마을아파트', '시험시 달빛로 8')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.contacts = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  state.files = [{ id: 'PH1', name: 'IMG_1.jpg', ext: 'jpg', kind: 'photo', project: '가온아파트', prefix: '현장사진/', size: 1001, when: new Date('2026-11-01T10:00:00+09:00') }];
  state.schedule = (sched || []).map(s => Object.assign({ workers: '', hours: 2, memo: '', report: null, project: '' }, s));
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await test('① 구글 바로 읽기 — 같은 날 같은 제목 3건(uid·시각·위치 다름) → 새 일정 3줄 → 반영 3건 → 다시 읽으면 0줄·이미 같음 3 (SPLIT)', async () => {
      await page.evaluate(SEED, []);
      const r = await page.evaluate(async items => {
        const before = JSON.stringify(serializeData().schedule), P = hjCalSyncPlan(hjCalApiEvents(items));
        const out = { rows: P.rows.map(x => [x.status, x.date, x.time, x.title, x.check, x.dupN, x.sibs, x.location, x.uid]), text: P.rows.map(hjCalSyncRowText), st: P.stats, readonly: before === JSON.stringify(serializeData().schedule) };
        const res = await hjCalSyncApply(P, P.rows.map((x, i) => ({ i, project: x.project || '' })));
        out.added = res.added;
        out.sch = state.schedule.map(s => [s.date, s.time, s.title, s.icsUid, s.icsBy || '', (String(s.memo || '').match(/장소: (.*)/) || ['', ''])[1]]);
        const P2 = hjCalSyncPlan(hjCalApiEvents(items));
        out.again = P2.rows.map(x => [x.status, hjCalSyncRowText(x)]); out.st2 = P2.stats;
        return out;
      }, THREE);
      assert.deepEqual(r.rows, [
        ['new', '2026-11-13', '09:00', '우수관 1개', true, 1, 3, LOC_A, 'u1@google.com'],
        ['new', '2026-11-13', '14:00', '우수관 1개', true, 1, 3, LOC_B, 'u2@google.com'],
        ['new', '2026-11-13', '17:00', '우수관 1개', true, 1, 3, '', 'u3@google.com']], '세 일정이 각자 줄(체크·구글에 1번·같은 제목 3건) — ' + JSON.stringify(r.rows));
      assert.ok(r.text[0].includes(LOC_A) && r.text[1].includes(LOC_B) && r.text[0].startsWith('11/13(금) 09:00') && r.text[2].startsWith('11/13(금) 17:00'), '줄 글에 각자 시각·위치 — ' + JSON.stringify(r.text));
      assert.deepEqual([r.st.read, r.st.gdup, r.st.same, r.readonly], [3, 0, 0, true], '겹침으로 세지 않음 · 계획은 읽기만 — ' + JSON.stringify(r.st));
      assert.equal(r.added, 3, '세 건 다 들어감');
      assert.deepEqual(r.sch, [['2026-11-13', '09:00', '우수관 1개', 'u1@google.com', 'gemini', LOC_A], ['2026-11-13', '14:00', '우수관 1개', 'u2@google.com', 'gemini', LOC_B], ['2026-11-13', '17:00', '우수관 1개', 'u3@google.com', 'gemini', '']], '기록마다 제 구글 uid·장소 — ' + JSON.stringify(r.sch));
      assert.deepEqual([r.again, r.st2.same, r.st2.gdup], [[], 3, 0], '다시 읽으면 바꿀 것 없음 · 이미 같음 3 — ' + JSON.stringify([r.again, r.st2]));
    });

    await test('② 한 줄로 남는 것 — \'@제목\'+사본(제목 머리·태그 private/shared·설명 끝줄) · 진짜 겹침 · 같은 uid · 사본뿐인 묶음 (ONE-ROW)', async () => {
      await page.evaluate(SEED, []);
      const r = await page.evaluate(items => { const ev = hjCalApiEvents(items), P = hjCalSyncPlan(ev);
        return { flags: Object.fromEntries(ev.map(e => [e.uid.replace('@google.com', ''), [e.copy, e.appId]])), rows: P.rows.map(x => [x.status, x.date, x.time, x.title, x.dupN, x.sibs, (x.marks || []).join('+')]), gdup: P.stats.gdup, read: P.stats.read }; }, ONE);
      assert.deepEqual([r.flags.k1, r.flags.k1c, r.flags.k2c, r.flags.k3c, r.flags.k4c, r.flags.d1], [[false, ''], [true, ''], [true, 'gone-1'], [true, ''], [true, 'gone-2'], [false, '']],
        '사본 판정·가리키는 앱 일정 — 제목 머리 · 태그 shared · 설명 끝줄 · 태그 private — ' + JSON.stringify(r.flags));
      assert.deepEqual(r.rows, [
        ['new', '2026-11-16', '09:00', '도배', 2, 1, '@+app'],
        ['new', '2026-11-17', '09:00', '미장', 2, 1, '@'],
        ['new', '2026-11-18', '09:00', '목공', 2, 1, '@'],
        ['new', '2026-11-18', '09:00', '창호', 2, 1, ''],
        ['new', '2026-11-19', '09:00', '방수', 3, 1, '@'],
        ['new', '2026-11-20', '09:00', '타공', 2, 1, '@'],
        ['new', '2026-11-21', '09:00', '실리콘', 2, 1, 'app']], '모두 한 줄(구글에 n번) — ' + JSON.stringify(r.rows));
      assert.deepEqual([r.read, r.gdup], [15, 8], '읽은 15건 · 겹침 8 — ' + JSON.stringify([r.read, r.gdup]));
    });

    await test('③ 사본은 제 칸에 — 태그 hjKey 가 가리키는 앱 일정의 구글 원본 칸에 붙어 다시 읽으면 0줄(앱에서 시각을 고친 일정도) · 태그 없으면 시각이 같은 칸 (COPY-ATTACH)', async () => {
      const APPS = [{ id: 'r1', date: '2026-11-13', time: '09:00', title: '우수관 1개', project: '모란아파트', icsUid: 'u1@google.com' }, { id: 'r2', date: '2026-11-13', time: '10:00', title: '우수관 1개', project: '나래마을아파트', icsUid: 'u2@google.com' },
        { id: 'r3', date: '2026-11-13', time: '17:00', title: '우수관 1개', project: '', icsUid: 'u3@google.com' }];
      await page.evaluate(SEED, APPS);
      const r = await page.evaluate(items => { const P = hjCalSyncPlan(hjCalApiEvents(items));
        // 칸 나누기만 따로 — 사본 w2(10:00)는 r2 의 구글 원본 u2(14:00) 칸에 붙는다
        const ev = hjCalApiEvents(items).map(e => Object.assign({}, e, hjCalSyncTitle(e.raw))), uidOf = k => ({ r1: 'u1@google.com', r2: 'u2@google.com', r3: 'u3@google.com' })[k] || '';
        return { rows: P.rows.map(x => [x.status, hjCalSyncRowText(x)]), st: P.stats, slots: hjCalSyncSlots(ev, uidOf).map(l => l.map(e => e.uid.replace('@google.com', ''))) }; }, AFTER);
      assert.deepEqual(r.slots, [['u1', 'w1'], ['w2', 'u2'], ['u3', 'w3']], '사본이 가리키는 일정의 칸 — ' + JSON.stringify(r.slots));
      assert.deepEqual([r.rows, r.st.same, r.st.gdup], [[], 3, 3], '바꿀 것 없음 · 이미 같음 3 · 구글에 겹친 사본 3 — ' + JSON.stringify([r.rows, r.st]));
      // 여러 날 공정의 이어지는 날 사본은 태그가 'id-dN' — 꼬리를 떼고 그 일정을 찾는다
      const rd = await page.evaluate(items => { const ev = hjCalApiEvents(items).map(e => e.appId === 'r2' ? Object.assign({}, e, { appId: 'r2-d2' }) : e), P = hjCalSyncPlan(ev);
        return [P.rows.map(x => [x.status, hjCalSyncRowText(x)]), P.stats.same]; }, AFTER);
      assert.deepEqual(rd, [[], 3], "태그 'id-dN' 도 그 일정의 칸 — " + JSON.stringify(rd));
      // 태그 없이(.ics·화면 글 꼴) — 제목 머리로 사본인 줄만 알면 시각이 같은 칸에
      const r2 = await page.evaluate(items => { state.schedule.find(s => s.id === 'r2').time = '14:00';
        const ev = hjCalApiEvents(items).map(e => Object.assign({}, e, { appId: '', copy: undefined, memo: '' }, e.uid.startsWith('w2') ? { time: '14:00' } : {}));
        const P = hjCalSyncPlan(ev); return [P.rows.map(x => [x.status, hjCalSyncRowText(x)]), P.stats.same, P.stats.gdup]; }, AFTER);
      assert.deepEqual(r2, [[], 3, 3], '태그 없는 사본은 시각이 같은 칸 — ' + JSON.stringify(r2));
    });

    await test('④ 화면 글(uid 없음) — 시각이 다른 두 줄 · 같은 시각에 위치만 다른 두 줄도 따로 · 합성 uid 가 기록마다 다름 · 다시 읽으면 0줄(기록 차례가 뒤집혀도) (TEXT)', async () => {
      await page.evaluate(SEED, []);
      const r = await page.evaluate(async ({ text, more }) => {
        const ev = hjCalSyncParse(text), P = hjCalSyncPlan(ev), out = { n: ev.length, rows: P.rows.map(x => [x.status, x.date, x.time, x.title, x.check, x.dupN, x.sibs, x.location]), gdup: P.stats.gdup };
        await hjCalSyncApply(P, P.rows.map((x, i) => ({ i, project: '' })));
        out.uids = state.schedule.map(s => [s.time, s.icsUid]);
        const again = () => { const Q = hjCalSyncPlan(hjCalSyncParse(text)); return [Q.rows.map(x => [x.status, hjCalSyncRowText(x)]), Q.stats.same]; };
        out.again = again(); state.schedule.reverse(); out.reversed = again(); state.schedule.reverse();
        // 구글에서 09:00 일정이 지워져 14:00 한 줄만 남았다 — 14:00 기록과 짝(09:00 기록의 시각을 바꾸지 않는다), 09:00 기록은 '앱에만'
        out.one = hjCalSyncPlan(hjCalSyncParse(text.split('\n')[1])).rows.map(x => [x.status, x.time, x.check]);
        // 09:00 기록을 앱에서 10:00 으로 고쳤고 기록 차례도 뒤집혔다 — 14:00 칸은 14:00 기록과 먼저, 09:00 칸은 남은 기록과(시간 다름 한 줄)
        const r09 = state.schedule.find(s => s.title === '우수관 1개' && s.time === '09:00'); r09.time = '10:00'; state.schedule.reverse();
        out.edited = hjCalSyncPlan(hjCalSyncParse(text)).rows.map(x => [x.status, hjCalSyncRowText(x)]);
        state.schedule.reverse(); r09.time = '09:00';
        // 나중에 같은 날 같은 제목이 하나 더 — 그 줄만 새 일정, 합성 uid 도 겹치지 않게
        const P3 = hjCalSyncPlan(hjCalSyncParse(more)); out.more = P3.rows.map(x => [x.status, x.time, x.title, x.sibs]);
        await hjCalSyncApply(P3, P3.rows.map((x, i) => ({ i, project: '' })));
        out.uids3 = state.schedule.filter(s => s.title === '우수관 1개').map(s => s.icsUid); out.again3 = hjCalSyncPlan(hjCalSyncParse(more)).rows.length;
        return out;
      }, { text: TEXT, more: TEXT_MORE });
      assert.equal(r.n, 6, '똑같은 줄만 한 번(위치만 다른 줄은 남는다) — 읽은 ' + r.n + '건');
      assert.deepEqual(r.rows, [
        ['new', '2026-11-13', '09:00', '우수관 1개', true, 1, 2, '새벽로 12 모란아파트 303동 704호'],
        ['new', '2026-11-13', '14:00', '우수관 1개', true, 1, 2, '달빛로 8 나래마을아파트 101동 202호'],
        ['new', '2026-11-14', '10:00', '누수 탐지', true, 2, 2, '새벽로 12 모란아파트'],
        ['new', '2026-11-14', '10:00', '누수 탐지', true, 1, 2, '달빛로 8 나래마을아파트'],
        ['new', '2026-11-14', '15:00', '점검', true, 1, 1, '한빛상가']], '시각·위치가 다른 줄은 따로, 위치 없는 같은 시각 줄은 첫 칸에 — ' + JSON.stringify(r.rows));
      assert.equal(r.gdup, 1, '진짜 겹침 1(위치 없는 누수 탐지 줄)');
      assert.deepEqual(r.uids, [['09:00', 'gcal:2026-11-13|우수관1개'], ['14:00', 'gcal:2026-11-13|우수관1개|14:00'], ['10:00', 'gcal:2026-11-14|누수탐지'], ['10:00', 'gcal:2026-11-14|누수탐지|10:00'], ['15:00', 'gcal:2026-11-14|점검']],
        '합성 uid — 첫 기록은 예전 꼴, 그다음은 시각을 붙여 다르게 — ' + JSON.stringify(r.uids));
      assert.deepEqual(r.again, [[], 5], '다시 읽으면 바꿀 것 없음 — ' + JSON.stringify(r.again));
      assert.deepEqual(r.reversed, [[], 5], '기록 차례가 뒤집혀도 시각이 같은 기록과 짝(시간 다름 줄 없음) — ' + JSON.stringify(r.reversed));
      assert.deepEqual(r.one, [['apponly', '09:00', false]], '한 줄만 남아도 시각이 같은 기록과 짝 — ' + JSON.stringify(r.one));
      assert.deepEqual(r.edited, [['time', '11/13(금) 09:00 우수관 1개 — 시간 10:00 → 09:00']], '시각을 고친 기록이 다른 칸의 기록을 가로채지 않음 — ' + JSON.stringify(r.edited));
      assert.deepEqual(r.more, [['new', '17:00', '우수관 1개', 3]], '나중에 늘어난 한 줄만 새 일정 — ' + JSON.stringify(r.more));
      assert.deepEqual([r.uids3, r.again3], [['gcal:2026-11-13|우수관1개', 'gcal:2026-11-13|우수관1개|14:00', 'gcal:2026-11-13|우수관1개|17:00'], 0], '세 기록의 합성 uid 가 다 다름 · 다시 읽으면 0줄 — ' + JSON.stringify([r.uids3, r.again3]));
    });

    await test('⑤ 이어지는 날·날짜 옮김 — 이어지는 날에 같은 제목이 둘이면 한 칸만 이어지는 날 · uid 로 옮겨 온 일정 옆의 새 일정도 따로 · 계획은 읽기만 (CONT-MOVE)', async () => {
      await page.evaluate(SEED, [{ id: 'M', date: '2026-11-16', time: '09:00', title: '타일', project: '가온아파트', hours: 8, memo: '2026-11-16~2026-11-18 (3일)', icsUid: 'm@google.com' },
        { id: 'U', date: '2026-11-12', time: '10:00', title: '배관 점검', project: '모란아파트', icsUid: 'u@google.com' }]);
      const r = await page.evaluate(items => { const before = JSON.stringify(serializeData()), P = hjCalSyncPlan(hjCalApiEvents(items));
        return { rows: P.rows.map(x => [x.status, x.date, x.time, x.title, x.check, x.app ? x.app.id : '', x.location || '']), st: P.stats, readonly: before === JSON.stringify(serializeData()) }; }, CONT);
      assert.deepEqual(r.rows, [
        ['new', '2026-11-17', '13:00', '타일', true, '', LOC_B],
        ['new', '2026-11-20', '15:00', '배관 점검', true, '', LOC_B],
        ['move', '2026-11-20', '10:00', '배관 점검', true, 'U', LOC_A]], '이어지는 날은 한 칸만 · 옮겨 온 일정과 새 일정은 따로 — ' + JSON.stringify(r.rows));
      assert.deepEqual([r.st.same, r.st.cont, r.st.gdup, r.readonly], [3, 2, 0, true], '이미 같음 3(시작·이어지는 날 2) · 계획은 읽기만 — ' + JSON.stringify(r.st));
    });
    await context.close();

    await test('⑥ 폰 390 — 붙여 넣기 → 미리보기 3줄(각자 위치·같은 제목 3건)·안내 → 반영(안전판 1회) · 넘침 없음·44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED, []);
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT3);
      await m.page.waitForSelector('#csBody [data-cs-row]');
      const v = await m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal'), rows = [...root.querySelectorAll('#csBody [data-cs-row]')];
        const small = [...root.querySelectorAll('#hjCalSync button,#hjCalSync select,#hjCalSync label,.mfoot button')].filter(b => b.getClientRects().length).map(b => [b.tagName, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        const wide = [...root.querySelectorAll('#hjCalSync *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).length;
        return { kinds: rows.map(el => el.dataset.csRow + (el.querySelector('.csChk').checked ? '+' : '-')), text: rows.map(el => el.innerText.replace(/\s+/g, ' ').trim()), sibs: root.querySelectorAll('#csBody [data-cs-sibs]').length,
          hint: !!root.querySelector('[data-cs-sibs-hint]'), gdup: !!root.querySelector('[data-cs-gdup]'), sum: root.querySelector('[data-cs-sum]').innerText.replace(/\s+/g, ' '),
          fonts: [...root.querySelectorAll('#csBody select')].map(s => parseFloat(getComputedStyle(s).fontSize)), small, wide, over: document.documentElement.scrollWidth - innerWidth }; });
      assert.deepEqual(v.kinds, ['new+', 'new+', 'new+'], '세 줄 모두 체크된 새 일정 — ' + JSON.stringify(v.kinds));
      assert.ok(v.text[0].includes('09:00') && v.text[0].includes('모란아파트 303동 704호') && v.text[1].includes('14:00') && v.text[1].includes('나래마을아파트 101동 202호') && v.text[2].includes('17:00'), '줄마다 제 시각·위치 — ' + JSON.stringify(v.text));
      assert.ok(v.text.every(t => t.includes('같은 날 같은 제목 3건')) && v.sibs === 3 && v.hint && !v.gdup, '따로 본 줄 표시·안내, 겹침 안내는 없음 — ' + JSON.stringify([v.text, v.sibs, v.hint, v.gdup]));
      assert.ok(v.sum.includes('읽은 일정 3건') && v.sum.includes('새 일정 3'), v.sum);
      assert.ok(v.wide === 0 && v.over <= 1 && v.fonts.every(f => f >= 16), '넘침 없음 · 고르기 칸 16px — ' + JSON.stringify([v.wide, v.over, v.fonts]));
      assert.deepEqual(v.small, [], '44px 미만 — ' + JSON.stringify(v.small));
      await m.page.evaluate(() => { window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { window.__snaps.push(a[0]); return o(...a); }; });
      await m.page.click('#csApply');
      await m.page.waitForFunction(() => !document.querySelector('#hjCalSync') || /안전판을 만들지 못해|바뀌었어요|체크하세요|오래된 창/.test(document.getElementById('toast').textContent));
      const done = await m.page.evaluate(() => { const n = document.querySelectorAll('#modalRoot #hjCalSyncDone [data-csd-row]').length; closeModal(true);
        return { n, snaps: window.__snaps, sch: state.schedule.map(s => [s.date, s.time, s.title]).sort((a, b) => a[1].localeCompare(b[1])) }; });
      assert.ok(done.n === 3 && done.snaps[0] === '구글 캘린더 맞추기 전' && done.snaps.filter(x => x === '구글 캘린더 맞추기 전').length === 1, '반영 뒤 알릴 일정 3건 · 안전판 1회(먼저) — ' + JSON.stringify(done));
      assert.deepEqual(done.sch, [['2026-11-13', '09:00', '우수관 1개'], ['2026-11-13', '14:00', '우수관 1개'], ['2026-11-13', '17:00', '우수관 1개']], '일정 3건 — ' + JSON.stringify(done.sch));
      await m.context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    console.log(`calsplit-v600: ${passed}/6 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calsplit-v600 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

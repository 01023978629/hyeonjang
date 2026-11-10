/* gcal-import-v565.e2e.js — 「📥 캘린더 파일 가져오기」에 구글 캘린더 내보내기(.ics)를 넣는 회귀 (Playwright)
   대표 2026-11-10 "구글 캘린더를 보고 현장 웹에 반영해줘. @표시는 제미나이가 한 거야".
   구글 내보내기 꼴(UTC 'Z' 시각·TZID·종일 여러 날·RRULE·RECURRENCE-ID)을 tests/fixtures/gcal-export.ics 에 그대로 담았다.

   지키는 것:
   ① 'Z'(UTC) 시각은 한국 시각으로 바뀐다 — 010000Z 는 10:00 이지 01:00 이 아니다. DTEND 로 시간(hours) 3
   ② TZID=Asia/Seoul 은 적힌 그대로(14:00·2시간) · 다른 시간대(LA 09:00)는 그 시간대 기준으로 바뀐다(11-21 02:00)
   ③ 종일 여러 날(DTEND 는 다음 날)은 공정표 메모 '시작~끝 (N일)' 로 들어와 이어지는 날(hjSchContOn)이 생긴다
   ④ 제목 앞·뒤 '@' 는 떼고 icsBy:'gemini' — 일정표에 🤖 제미나이 칩, '@' 없는 일정엔 없다
   ⑤ 현장 이름이 들어 있으면 그 현장에 연결 · 두 현장이 따로 맞으면 붙이지 않는다(긴 이름이 짧은 이름을 품을 때만 긴 쪽) · 사람이 붙인 현장은 덮지 않는다
   ⑥ RRULE 반복은 첫 회만(메모에 적음) · RECURRENCE-ID 예외 회차는 따로 한 건(원본을 덮지 않음)
   ⑦ 같은 파일을 다시 넣어도 건수가 늘지 않는다 · '@' 를 지운 파일을 넣으면 표식이 떨어진다 · STATUS:CANCELLED 는 지운다
   ⑧ 직렬화 왕복에 icsBy·icsUid 가 남는다
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 시간대 Asia/Seoul. 네트워크 없음. */
'use strict';
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const FIX = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof importICS === 'function' && typeof render === 'function');
  await page.waitForTimeout(800);

  const GCAL = FIX('gcal-export.ics');
  const NOAT = FIX('gcal-export-noat.ics');   // 유천동 일정의 '@' 만 뺀 같은 파일

  await page.evaluate(() => {
    const P = (name) => ({ name, stage: 2, received: 0, phases: [], cost: {}, customer: {}, archived: false });
    state.projects = [P('유천동주택'), P('둔산동아파트'), P('도안동 욕실')];
    state.files = [];
    state.schedule = [
      { id: 'work1', date: '2026-11-12', time: '08:00', title: '타일 시공', project: '유천동주택', workers: '2', memo: '', hours: 8, report: null },
      { id: 'gone1', date: '2026-11-25', time: '', title: '취소된 방문', project: '', workers: '', memo: '', hours: 0, report: null, icsUid: 'cancel-1@google.com' }
    ];
    state.calendarImports = [];
    state.tab = 'schedule'; state.dirty = false; render();
  });

  let out1;
  await test('① UTC(Z) 시각은 한국 시각 — 010000Z → 10:00 · DTEND 로 3시간', async () => {
    const r = await page.evaluate(async (ics) => {
      const out = await importICS(ics);
      const s = state.schedule.find(x => x.icsUid === 'utc-tile-1@google.com');
      return { out, s: s && { date: s.date, time: s.time, hours: s.hours, title: s.title, memo: s.memo } };
    }, GCAL);
    out1 = r.out;
    assert(r.s, '유천동 타일 일정이 들어와야 함');
    assert(r.s.date === '2026-11-12' && r.s.time === '10:00', 'UTC 01:00 → 한국 10:00: ' + JSON.stringify(r.s));
    assert(r.s.hours === 3, '01:00Z~04:00Z = 3시간: ' + r.s.hours);
    assert(/자재상에 09시/.test(r.s.memo) && /장소: 대전 유성구 유천동/.test(r.s.memo), '설명·장소가 메모에: ' + r.s.memo);
  });

  await test('② TZID=Asia/Seoul 은 그대로 14:00 · America/Los_Angeles 09:00 은 11-21 02:00', async () => {
    const r = await page.evaluate(() => {
      const a = state.schedule.find(x => x.icsUid === 'tzid-measure-1@google.com');
      const b = state.schedule.find(x => x.icsUid === 'la-call-1@google.com');
      return { a: a && { date: a.date, time: a.time, hours: a.hours }, b: b && { date: b.date, time: b.time, hours: b.hours, memo: b.memo } };
    });
    assert(r.a && r.a.date === '2026-11-13' && r.a.time === '14:00' && r.a.hours === 2, 'Seoul 14:00·2시간: ' + JSON.stringify(r.a));
    assert(r.b && r.b.date === '2026-11-21' && r.b.time === '02:00' && r.b.hours === 1, 'LA 09:00(PST) = 한국 다음날 02:00: ' + JSON.stringify(r.b));
    assert(!/변환 못 함/.test(r.b.memo), '아는 시간대는 메모에 경고가 없어야 함: ' + r.b.memo);
  });

  await test('③ 종일 3일 일정은 공정표 메모 꼴(시작~끝 (3일)) — 이어지는 날이 생긴다', async () => {
    const r = await page.evaluate(() => {
      const s = state.schedule.find(x => x.icsUid === 'allday-3days@google.com');
      if (!s) return null;
      const sp = hjSchSpan(s), c = hjSchContOn(s, '2026-11-17'), c3 = hjSchContOn(s, '2026-11-19');
      return { date: s.date, time: s.time, hours: s.hours, memo: s.memo, span: sp, cont: c, after: c3 };
    });
    assert(r, '3일 일정이 들어와야 함');
    assert(r.date === '2026-11-16' && r.time === '', '시작일·종일: ' + JSON.stringify(r));
    assert(/^2026-11-16~2026-11-18 \(3일\)/.test(r.memo), '메모 머리 = 2026-11-16~2026-11-18 (3일): ' + r.memo);
    assert(r.span.to === '2026-11-18' && r.span.days === 3, 'hjSchSpan: ' + JSON.stringify(r.span));
    assert(r.cont && r.cont.day === 2 && r.cont.days === 3, '11-17 은 2/3일째: ' + JSON.stringify(r.cont));
    assert(!r.after, 'DTEND(11-19)는 포함되지 않는 날이라 이어지지 않아야 함');
    assert(r.hours === 0, '종일 일정은 시간 0: ' + r.hours);
  });

  await test('④ 제목 앞·뒤 @ 는 떼고 icsBy gemini · 일정표에 🤖 제미나이 칩 · @ 없는 일정엔 없음', async () => {
    const r = await page.evaluate(() => {
      const a = state.schedule.find(x => x.icsUid === 'utc-tile-1@google.com');
      const b = state.schedule.find(x => x.icsUid === 'tzid-measure-1@google.com');
      const c = state.schedule.find(x => x.icsUid === 'allday-3days@google.com');
      const chips = (d) => { __calSelDate = d; render(); return document.querySelectorAll('#view [data-schgemini]').length; };
      const n12 = chips('2026-11-12'), n13 = chips('2026-11-13'), n16 = chips('2026-11-16');
      __calSelDate = null; render();
      return { a: a && { title: a.title, by: a.icsBy }, b: b && { title: b.title, by: b.icsBy }, c: c && { title: c.title, by: c.icsBy }, n12, n13, n16 };
    });
    assert(r.a && r.a.title === '유천동주택 타일 시공' && r.a.by === 'gemini', '앞 @: ' + JSON.stringify(r.a));
    assert(r.b && r.b.title === '둔산동 실측 상담' && r.b.by === 'gemini', '뒤 @: ' + JSON.stringify(r.b));
    assert(r.c && r.c.title === '도안동 욕실 방수 공사' && !r.c.by, '@ 없는 일정엔 표식 없음: ' + JSON.stringify(r.c));
    assert(r.n12 === 1 && r.n13 === 1, '12·13일 칸에 🤖 칩 하나씩: ' + r.n12 + '/' + r.n13);
    assert(r.n16 === 0, '16일(@ 없음)엔 칩 없음: ' + r.n16);
    assert(out1 && out1.제미나이 === 2, '결과에 제미나이 2건: ' + JSON.stringify(out1));
  });

  await test('⑤ 현장 이름으로 연결 — 두 현장이 따로 맞으면 미연결 · 품는 이름은 긴 쪽 · 사람이 붙인 현장은 유지', async () => {
    const r = await page.evaluate(async (ics) => {
      const g = (u) => state.schedule.find(x => x.icsUid === u);
      const before = { tile: g('utc-tile-1@google.com').project, bath: g('allday-3days@google.com').project, two: g('two-sites@google.com').project, la: g('la-call-1@google.com').project };
      state.projects.push({ name: '유천동주택 2차', stage: 2, received: 0, phases: [], cost: {}, customer: {}, archived: false });
      const nest = icsProjectGuess({ title: '유천동주택 2차 도배', location: '', memo: '' });
      state.projects.pop();
      g('la-call-1@google.com').project = '둔산동아파트';     // 사람이 붙임
      g('utc-tile-1@google.com').project = '도안동 욕실';     // 사람이 바꿈
      const out = await importICS(ics);
      return { before, nest, after: { la: g('la-call-1@google.com').project, tile: g('utc-tile-1@google.com').project }, out };
    }, GCAL);
    assert(r.before.tile === '유천동주택', '제목에 현장명 → 연결: ' + r.before.tile);
    assert(r.before.bath === '도안동 욕실', '공백 무시해 "도안동 욕실" 연결: ' + r.before.bath);
    assert(r.before.two === '', '두 현장이 따로 맞으면 미연결: ' + JSON.stringify(r.before.two));
    assert(r.nest === '유천동주택 2차', '긴 이름이 짧은 이름을 품으면 긴 쪽: ' + JSON.stringify(r.nest));
    assert(r.before.la === '', '현장명 없는 일정은 미연결: ' + JSON.stringify(r.before.la));
    assert(r.after.la === '둔산동아파트' && r.after.tile === '도안동 욕실', '다시 넣어도 사람이 붙인 현장 유지: ' + JSON.stringify(r.after));
    assert(out1 && out1.현장연결 === 2, '첫 가져오기 현장 연결 2건: ' + JSON.stringify(out1));
  });

  await test('⑥ RRULE 은 첫 회만(메모) · RECURRENCE-ID 예외 회차는 따로 한 건', async () => {
    const r = await page.evaluate(() => {
      const rows = state.schedule.filter(x => String(x.icsUid || '').indexOf('recur-order@google.com') === 0);
      return rows.map(x => ({ key: x.icsUid, date: x.date, time: x.time, title: x.title, memo: x.memo })).sort((a, b) => a.date.localeCompare(b.date));
    });
    assert(r.length === 2, '원본 1 + 예외 회차 1 = 2건: ' + JSON.stringify(r));
    assert(r[0].date === '2026-11-17' && r[0].time === '09:00' && /반복 일정 — 첫 회만/.test(r[0].memo), '원본 첫 회 + 반복 메모: ' + JSON.stringify(r[0]));
    assert(r[1].date === '2026-11-24' && r[1].time === '11:00' && /시간 변경/.test(r[1].title) && !/반복 일정/.test(r[1].memo), '예외 회차: ' + JSON.stringify(r[1]));
    assert(r[1].key === 'recur-order@google.com|20261124T090000', '예외 회차 키 = UID|회차: ' + r[1].key);
    assert(out1 && out1.반복 === 1, '결과에 반복 1건: ' + JSON.stringify(out1));
  });

  await test('⑦ 다시 넣어도 건수 그대로 · @ 를 지운 파일이면 표식 해제 · CANCELLED 는 지움', async () => {
    const r = await page.evaluate(async (args) => {
      const before = state.schedule.length;
      const o1 = await importICS(args.gcal);
      const mid = state.schedule.length;
      const o2 = await importICS(args.noat);
      const a = state.schedule.find(x => x.icsUid === 'utc-tile-1@google.com');
      return { before, mid, after: state.schedule.length, o1, o2, by: a && a.icsBy, title: a && a.title,
        gone: !state.schedule.some(x => x.id === 'gone1'), work: state.schedule.some(x => x.id === 'work1' && x.title === '타일 시공') };
    }, { gcal: GCAL, noat: NOAT });
    assert(r.before === r.mid && r.mid === r.after, '건수가 늘면 안 됨: ' + r.before + '→' + r.mid + '→' + r.after);
    assert(r.o1.추가 === 0 && r.o1.갱신 === 7, '갱신만: ' + JSON.stringify(r.o1));
    assert(r.by === undefined && r.title === '유천동주택 타일 시공', '@ 를 지우면 표식이 떨어진다: ' + JSON.stringify({ by: r.by, title: r.title }));
    assert(r.o2.제미나이 === 1, '@ 가 하나 남았으니 제미나이 1건: ' + JSON.stringify(r.o2));
    assert(r.gone, '취소된 일정(cancel-1)은 첫 가져오기에서 지워져야 함');
    assert(out1 && out1.취소 === 1, '첫 결과 취소 1건: ' + JSON.stringify(out1));
    assert(r.work, '기존 현장 작업 일정은 그대로');
  });

  await test('⑧ 직렬화 왕복에 icsBy·icsUid 가 남는다', async () => {
    const r = await page.evaluate(() => {
      const round = JSON.parse(JSON.stringify(serializeData()));
      const b = (round.schedule || []).find(x => x.icsUid === 'tzid-measure-1@google.com');
      return { by: b && b.icsBy, n: (round.schedule || []).filter(x => x.icsUid).length };
    });
    assert(r.by === 'gemini', '왕복 뒤 icsBy 유지: ' + JSON.stringify(r));
    assert(r.n === 7, '가져온 일정 7건 유지: ' + r.n);
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

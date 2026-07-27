/* ics-import.e2e.js — 일정표 「📥 캘린더 파일 가져오기」 회귀 (Playwright)
   밖에서 받은 일정(큐넷 시험 등)을 손으로 옮겨 적지 않게 하는 기능.
   실제로 사장님께 보낸 .ics 두 개(tests/fixtures)를 그대로 넣어 검증한다.

   지키는 것:
   ① 종일 일정(VALUE=DATE)을 날짜만으로 정확히 읽는다 — 하루 밀리면 시험을 놓친다
   ② 장소·수험번호(DESCRIPTION)가 메모로 들어온다 · 줄 접힘(folding)·이스케이프 해제
   ③ 같은 파일을 두 번 넣어도 중복이 생기지 않는다(UID 기준 갱신)
   ④ STATUS:CANCELLED 는 이미 있는 같은 일정을 지운다(접수 취소 반영)
   ⑤ 기존 현장 작업 일정은 건드리지 않는다 · 직렬화 왕복에도 보존된다
   ⑥ 버튼이 위임에 연결돼 있다(눌러도 아무 일 없는 버튼 방지)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 네트워크 없음. */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const EXAM = FIX('exam.ics');          // 9/1 타일 · 9/14 방수 + 8/31 취소
  const OLD = FIX('exam-old.ics');       // 8/31 익산 · 9/1 대전 (취소 전 원본)

  await page.evaluate(() => {
    state.projects = [{ name: '유천동주택', stage: 2, received: 0, phases: [], cost: {}, customer: {}, archived: false }];
    state.files = [];
    state.schedule = [{ id: 'work1', date: '2026-09-02', time: '08:00', title: '타일 시공', project: '유천동주택', workers: '2', memo: '', hours: 8, report: null }];
    state.tab = 'schedule'; state.dirty = false; render();
  });

  await test('⑥ 일정표에 [📥 캘린더 파일 가져오기] 버튼이 있고 위임에 연결돼 있다', async () => {
    const r = await page.evaluate(() => {
      const btn = document.getElementById('schIcsIn');
      let called = false;
      const orig = window.pickICSFile;
      window.pickICSFile = () => { called = true; };
      if (btn) btn.click();
      window.pickICSFile = orig;
      return { has: !!btn, called };
    });
    assert(r.has, '일정표 툴바에 버튼이 있어야 함');
    assert(r.called, '버튼을 눌렀을 때 파일 선택이 열려야 함(위임 미등록이면 아무 일도 안 남)');
  });

  await test('① 종일 시험 일정을 날짜 그대로 읽는다 (하루 밀림 없음)', async () => {
    const r = await page.evaluate((ics) => {
      const evs = parseICS(ics);
      return evs.map(e => ({ d: e.date, t: e.time, s: e.title, c: e.cancelled }));
    }, EXAM);
    assert(r.length === 3, '이벤트 3건(확정2+취소1) 이어야 함: ' + r.length);
    const tile = r.find(x => /타일/.test(x.s) && !x.c);
    const wp = r.find(x => /방수/.test(x.s));
    assert(tile && tile.d === '2026-09-01', '타일 = 2026-09-01: ' + JSON.stringify(tile));
    assert(wp && wp.d === '2026-09-14', '방수 = 2026-09-14: ' + JSON.stringify(wp));
    assert(tile.t === '' && wp.t === '', '종일 일정은 시간이 비어야 함');
    assert(r.some(x => x.c && x.d === '2026-08-31'), '8/31 은 취소 이벤트로 읽혀야 함');
  });

  await test('② 장소·수험번호가 메모로 들어온다 (접힘 풀기·이스케이프 해제)', async () => {
    const r = await page.evaluate(async (ics) => {
      await importICS(ics);
      const wp = state.schedule.find(s => /방수/.test(s.title || ''));
      return { memo: (wp && wp.memo) || '', title: (wp && wp.title) || '' };
    }, EXAM);
    assert(/제일인테리어기술학원/.test(r.memo), '장소가 메모에 있어야 함: ' + r.memo.slice(0, 80));
    assert(/13200888/.test(r.memo), '수험번호가 메모에 있어야 함');
    assert(/주차 불가/.test(r.memo), '주차불가 안내가 살아 있어야 함');
    assert(!/\\n|\\,/.test(r.memo), '이스케이프(\\n, \\,)가 그대로 남으면 안 됨: ' + r.memo.slice(0, 60));
    assert(!/^\s*$/.test(r.title), '제목이 있어야 함');
  });

  await test('①-2 가져온 뒤 일정표에 2건이 실제로 들어간다', async () => {
    const r = await page.evaluate(() => {
      const imported = state.schedule.filter(s => s.icsUid);
      return { n: imported.length, dates: imported.map(s => s.date).sort(),
        shown: (document.getElementById('view') || {}).textContent || '' };
    });
    assert(r.n === 2, '가져온 일정 2건이어야 함: ' + r.n);
    assert(r.dates.join(',') === '2026-09-01,2026-09-14', '날짜: ' + r.dates.join(','));
  });

  await test('③ 같은 파일을 두 번 넣어도 중복이 생기지 않는다', async () => {
    const r = await page.evaluate(async (ics) => {
      const before = state.schedule.length;
      const out = await importICS(ics);
      return { before, after: state.schedule.length, out };
    }, EXAM);
    assert(r.after === r.before, '건수가 늘면 안 됨: ' + r.before + '→' + r.after);
    assert(r.out.추가 === 0 && r.out.갱신 === 2, '갱신만 되어야 함: ' + JSON.stringify(r.out));
  });

  await test('④ 취소된 일정은 이미 있으면 지운다 (접수 취소 반영)', async () => {
    const r = await page.evaluate(async (args) => {
      // 취소 전 원본(8/31 포함)을 먼저 넣고 → 최신본(8/31 취소)을 넣으면 사라져야 한다
      const r1 = await importICS(args.old);
      const had = state.schedule.some(s => s.date === '2026-08-31');
      const r2 = await importICS(args.exam);
      const gone = !state.schedule.some(s => s.date === '2026-08-31');
      return { r1, had, r2, gone, n: state.schedule.filter(s => s.icsUid).length };
    }, { old: OLD, exam: EXAM });
    assert(r.had, '먼저 8/31 일정이 들어와 있어야 함(전제)');
    assert(r.gone, '최신본을 넣으면 8/31 이 사라져야 함');
    assert(r.r2.취소 === 1, '취소 1건으로 보고해야 함: ' + JSON.stringify(r.r2));
    assert(r.n === 2, '남는 시험 일정은 2건: ' + r.n);
  });

  await test('⑤ 기존 현장 작업 일정은 그대로 · 직렬화 왕복 보존', async () => {
    const r = await page.evaluate(() => {
      const work = state.schedule.find(s => s.id === 'work1');
      const round = JSON.parse(JSON.stringify(serializeData()));
      const kept = (round.schedule || []).filter(s => s.icsUid).length;
      const workKept = (round.schedule || []).some(s => s.id === 'work1' && s.project === '유천동주택');
      return { work: !!work, workTitle: work && work.title, kept, workKept };
    });
    assert(r.work && r.workTitle === '타일 시공', '기존 작업 일정이 유지돼야 함');
    assert(r.kept === 2, '직렬화 후에도 시험 일정 2건 유지: ' + r.kept);
    assert(r.workKept, '직렬화 후에도 현장 작업 일정 유지');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

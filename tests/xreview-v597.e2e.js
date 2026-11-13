/* v591~v597 통합 검토 고침 — 갈래마다 따로 검토한 뒤 합친 판에서 세 관점(자료·현장·검사)이 찾은 것 중 확인된 것.
   v591 이 진행 중 보고(진행·진행중·NN%)가 있는 여러 날 공정을 둘째·셋째 날에도 이어지게 했는데(hjSchContEnded),
   🌙 오늘 마감(hjDayCloseData)과 🔄 구글 캘린더 맞추기(hjCalSyncPlan)는 아직 '보고 글이 있으면 끝난 공정'(hjSchReported)으로 봤다.
   ① 오늘 마감 — 진행 중 보고가 있는 3일 공정은 첫날·가운데 날 '내일도 계속', 마지막 날 '보고할 일정'(예전: 이미 보고함 — 📋 내 업무는 '끝나면 완료 보고'라는데
      오늘 마감은 '모두 보고했어요'). 하루짜리 일정은 예전처럼 보고 글이 있으면 보고함. 화면 글에 '모두 보고했어요'가 없음 (DAYCLOSE)
   ② 맞추기 — 진행 중 보고가 있는 여러 날 공정을 구글에서 하루 미루면 예전엔 체크된 '새 일정'으로 한 번 더 들어가(옮김 후보에서 빠지므로) 같은 날 두 번 보였다.
      이제 체크 해제 + 까닭('진행 중인 ‘타일’ … 과 같은 작업일 수 있어'). 같은 구글 일정(uid)을 다른 날로 옮긴 것도 '완료 보고한' 이 아니라 '진행 중인'.
      보고 없는 공정은 예전처럼 날짜 옮김, 완료 보고·하루짜리 진행 보고는 예전 그대로(체크된 새 일정). 계획은 읽기만 (CALSYNC)
   ③ 폰 390 맞추기 창 줄 글 · 핀 3곳 서로 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   (아침 자동 창이 서버 자동 반영 뒤 느린 사진 목록을 기다리다 건너뛰던 것은 morningboot2-v592 ⑥ 이 지킨다 — 변이 fresh-after-photos.)
   합성 자료(이름은 지어낸 것), 시계 고정. HJ_XR597_BASELINE=<commit> 은 ① 에서 실패해야 한다.
   HJ_XR597_MUTATION — dayclose-old(오늘 마감을 예전 hjSchReported 로)는 ①, going-off(체크 해제 안 함)·uid-done(같은 uid 줄을 '완료 보고한' 으로)은 ② 에서 실패해야 한다. */
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
  'dayclose-old': ['done:sp.days>1?hjSchContEnded(s):hjSchReported(s),endsToday', 'done:hjSchReported(s),endsToday'],
  'going-off': ['rows.push(newRow(g,base,going?hjCalSyncGoingRef(going.s):undefined));', 'rows.push(newRow(g,base));'],
  'uid-done': ['rows.push(newRow(g,base,hjCalSyncGoing(a.s)?hjCalSyncGoingRef(a.s):{done:', 'rows.push(newRow(g,base,0?hjCalSyncGoingRef(a.s):{done:']
};
let html = process.env.HJ_XR597_BASELINE ? execFileSync('git', ['show', process.env.HJ_XR597_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_XR597_MUTATION) {
  const m = MUT[process.env.HJ_XR597_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_XR597_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS xreview-v597 ' + name); }
async function open(width, mobile, at) {
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
  await page.clock.setFixedTime(new Date(at));
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
// 시드 — S(id, 날짜, 제목, 메모, 덧붙일 칸)
const SEED = list => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래마을아파트')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.asLog = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  state.schedule = list.map(([id, date, title, memo, extra]) => Object.assign({ id, date, time: '09:00', title, project: '가온아파트', workers: '', hours: 8, memo, report: null }, extra || {}));
  state.activeProject = null; state.tab = 'schedule'; state.search = '';
  render();
};
const DAY_SEED = [
  ['TILE', '2026-11-10', '타일', '2026-11-10~2026-11-12 (3일)', { report: { progress: '진행', done: '1일째 초배', weather: '맑음' } }],
  ['CTRL', '2026-11-10', '도배', '2026-11-10~2026-11-12 (3일)'],
  ['ENDED', '2026-11-10', '방수', '2026-11-10~2026-11-12 (3일)', { report: { progress: '완료', done: '방수 끝' } }],
  ['ONE', '2026-11-11', '실리콘 보수', '', { report: { progress: '진행', done: '반만 함' } }]];

(async () => {
  browser = await chromium.launch();
  try {
    await test('① 오늘 마감 — 진행 중 여러 날 공정은 내일도 계속 · 마지막 날 보고할 일정 · 하루짜리는 예전 그대로 (DAYCLOSE)', async () => {
      const { context, page } = await open(1280, false, '2026-11-11T18:30:00+09:00');
      await page.evaluate(SEED, DAY_SEED);
      const r = await page.evaluate(() => {
        const pick = d => { const x = hjDayCloseData(d); return { need: x.needReport.map(r => r.s.id).sort(), ongoing: x.ongoing.map(r => r.s.id).sort(), reported: x.reported }; };
        return { d10: pick('2026-11-10'), d11: pick('2026-11-11'), d12: pick('2026-11-12') };
      });
      assert.deepEqual(r.d10, { need: [], ongoing: ['CTRL', 'TILE'], reported: 1 }, '첫날 — 진행 보고한 타일은 내일도 계속(완료 보고한 방수만 보고함) ' + JSON.stringify(r.d10));
      assert.deepEqual(r.d11, { need: [], ongoing: ['CTRL', 'TILE'], reported: 1 }, '가운데 날 — 타일·도배 내일도 계속, 하루짜리 실리콘 보수는 진행 보고도 보고함(예전 그대로) ' + JSON.stringify(r.d11));
      assert.deepEqual(r.d12, { need: ['CTRL', 'TILE'], ongoing: [], reported: 0 }, '마지막 날 — 타일도 보고할 일정(예전: 이미 보고함으로 셈) ' + JSON.stringify(r.d12));
      await page.clock.setFixedTime(new Date('2026-11-12T18:30:00+09:00'));
      const v = await page.evaluate(() => { hjDayCloseView(); const m = document.querySelector('#modalRoot .modal'); const t = m ? m.innerText : ''; closeModal(true); return t; });
      assert.ok(v.includes('타일') && v.includes('도배'), '오늘 마감 창에 두 공정 모두 보고할 일정 ' + v.slice(0, 300));
      assert.ok(!v.includes('모두 보고했어요'), "'모두 보고했어요' 라고 하지 않는다 " + v.slice(0, 300));
      await context.close();
    });
    await test('② 맞추기 — 진행 중 공정을 구글에서 미루면 새 일정은 체크 해제 + 까닭 · 같은 uid 도 진행 중 · 보고 없음은 옮김 · 완료·하루짜리는 예전 그대로 (CALSYNC)', async () => {
      const { context, page } = await open(1280, false, '2026-11-17T10:00:00+09:00');
      const plan = async (seed, text) => { await page.evaluate(SEED, seed); return page.evaluate(text => {
        const before = JSON.stringify(serializeData().schedule);
        const P = hjCalSyncPlan(hjCalSyncParse(text));
        return { rows: P.rows.map(x => ({ st: x.status, check: x.check, date: x.date, to: x.to || '', app: x.app ? x.app.id : '', going: x.going ? x.going.id : '', done: x.done ? x.done.id : '', text: hjCalSyncRowText(x) })),
          same: P.stats.same, unchanged: before === JSON.stringify(serializeData().schedule) };
      }, text); };
      const TEXT = '종일, 타일, 홍길동, 위치 없음, 2026년 11월 17일~2026년 11월 19일';
      // 진행 중 보고 — 하루 미룬 구글 일정은 체크 해제 새 일정(예전: 체크된 새 일정 → 반영하면 같은 날 두 번)
      const a = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '진행', done: '1일째' } }]], TEXT);
      assert.equal(a.rows.length, 1, JSON.stringify(a.rows));
      assert.deepEqual([a.rows[0].st, a.rows[0].check, a.rows[0].going, a.rows[0].done], ['new', false, 'TILE', ''], '진행 중 공정과 겹치는 새 일정은 체크 해제 ' + JSON.stringify(a.rows));
      assert.ok(a.rows[0].text.includes('진행 중인 ‘타일’(11/16(월)~11/18(수))') && a.rows[0].text.includes('체크 해제'), '까닭을 적는다 ' + a.rows[0].text);
      assert.ok(a.unchanged, '계획은 읽기만');
      // '진행중'·'50%' 도 같다
      for (const progress of ['진행중', '50%']) {
        const b = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress, done: '1일째' } }]], TEXT);
        assert.deepEqual(b.rows.map(r => [r.st, r.check, r.going]), [['new', false, 'TILE']], progress + ' ' + JSON.stringify(b.rows));
      }
      // 보고 없음 — 예전처럼 날짜 옮김(체크)
      const c = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)']], TEXT);
      assert.deepEqual(c.rows.map(r => [r.st, r.check, r.app, r.going]), [['move', true, 'TILE', '']], '보고 없음은 옮김 ' + JSON.stringify(c.rows));
      // 완료 보고한 여러 날 공정·진행 보고한 하루짜리 — 예전 그대로(체크된 새 일정, 까닭 없음)
      const d = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '완료', done: '끝' } }]], TEXT);
      assert.deepEqual(d.rows.map(r => [r.st, r.check, r.going]), [['new', true, '']], '완료 보고 — 다시 하는 작업 ' + JSON.stringify(d.rows));
      const e = await plan([['TILE', '2026-11-16', '타일', '', { report: { progress: '진행', done: '반만' } }]], TEXT);
      assert.deepEqual(e.rows.map(r => [r.st, r.check, r.going]), [['new', true, '']], '하루짜리 진행 보고 — 예전 그대로 ' + JSON.stringify(e.rows));
      // 다른 현장 '[현장]' 표시 — 짝이 아님(체크된 새 일정)
      const f = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '진행', done: '1일째' } }]], '종일, [나래마을아파트] 타일, 홍길동, 위치 없음, 2026년 11월 17일~2026년 11월 19일');
      assert.deepEqual(f.rows.map(r => [r.st, r.check, r.going]), [['new', true, '']], '다른 현장 ' + JSON.stringify(f.rows));
      // 같은 구글 일정(uid)을 다른 날로 — '완료 보고한' 이 아니라 '진행 중인'
      const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:xr597-tile@test', 'DTSTART;VALUE=DATE:20261118', 'DTEND;VALUE=DATE:20261121', 'SUMMARY:타일 공사', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const g = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '진행', done: '1일째' }, icsUid: 'xr597-tile@test' }]], ICS);
      assert.deepEqual(g.rows.map(r => [r.st, r.check, r.going, r.done]), [['new', false, 'TILE', '']], '같은 uid · 진행 중 ' + JSON.stringify(g.rows));
      assert.ok(g.rows[0].text.includes('진행 중인') && !g.rows[0].text.includes('완료 보고한'), g.rows[0].text);
      const h = await plan([['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '완료', done: '끝' }, icsUid: 'xr597-tile@test' }]], ICS);
      assert.deepEqual(h.rows.map(r => [r.st, r.check, r.going, r.done]), [['new', false, '', 'TILE']], '같은 uid · 완료 보고 — 예전 그대로 ' + JSON.stringify(h.rows));
      await context.close();
    });
    await test('③ 폰 390 맞추기 창 줄 글 · 핀 3곳 · 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const { context, page } = await open(390, true, '2026-11-17T10:00:00+09:00');
      await page.evaluate(SEED, [['TILE', '2026-11-16', '타일', '2026-11-16~2026-11-18 (3일)', { report: { progress: '진행', done: '1일째' } }]]);
      await page.evaluate(() => hjCalSyncView());
      await page.fill('#csText', '종일, 타일, 홍길동, 위치 없음, 2026년 11월 17일~2026년 11월 19일');
      await page.click('#csRead');
      await page.waitForFunction(() => /진행 중인/.test((document.querySelector('#csBody') || {}).innerText || ''));
      const m = await page.evaluate(() => {
        const box = document.querySelector('#csBody'), cb = box.querySelector('input[type=checkbox]');
        return { text: box.innerText, checked: cb ? cb.checked : null, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      assert.ok(m.text.includes('체크 해제'), m.text.slice(0, 300));
      assert.equal(m.checked, false, '체크 해제로 보인다');
      assert.ok(m.over <= 0, '가로 넘침 없음 ' + m.over);
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/)[1];
      const app = SRC.match(/const APP_BUILD='([^']+)'/)[1];
      const vs = fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/)[1];
      assert.ok(sw === app && app === vs, '핀 3곳 같음 ' + [sw, app, vs].join(' '));
      await context.close();
    });
    assert.deepEqual(errors, [], 'page errors ' + JSON.stringify(errors));
    assert.equal(network.writes, 0, '외부 쓰기 0');
    console.log('xreview-v597: ' + passed + '/3');
  } catch (error) {
    console.error('FAIL xreview-v597', error); process.exitCode = 1;
  } finally { await browser.close(); }
})();

/* v569 🔄 클로드 명령 '구글 캘린더 일정 → 현장웹 맞추기' · 📥 캘린더 파일 가져오기의 …Z(UTC) 시각 고침 — 대표 지시(2026-11-11) "더 개발 진행".
   대표는 일정을 제미나이로 구글 캘린더에 넣는다. 그 일정을 현장웹으로 옮기는 일을 클로드에게 한 번에 시킬 수 있게 기본 명령을 더하고,
   기존 가져오기(parseICS)가 구글 내보내기의 UTC 시각(…Z)을 그대로 써 9시간 어긋나던 것을 고친다. 합성 자료, 바깥 쓰기 0.
   ① parseICS — …Z 는 한국 시각(+9, 날짜 넘김 포함) · TZID·떠 있는 시각·종일은 그대로 (ZTIME)
   ② importICS — Z 일정이 09:00 으로 들어가고, 같은 파일을 다시 넣으면 갱신만 (IMPORT)
   ③ 🧰 클로드 명령어 — cw_calsync 가 현장웹 분류 맨 앞 · 준비물 · 스킬 줄 · 구글은 읽기만·맞추기 창만 (CMD)
   ④ 소스·핀 3곳(v569 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V569_BASELINE=<commit> 과 HJ_V569_MUTATION=no-z(…Z 변환 끔) 는 ① 에서 실패해야 한다. */
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
const ZRE = "if(!allDay&&/^\\d{8}T\\d{4,6}Z$/i.test(raw)){";
let html = process.env.HJ_V569_BASELINE ? execFileSync('git', ['show', process.env.HJ_V569_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V569_MUTATION) {
  assert.equal(process.env.HJ_V569_MUTATION, 'no-z', 'unknown mutation ' + process.env.HJ_V569_MUTATION);
  assert.equal(SRC.split(ZRE).length, 2, 'mutation anchor');
  html = SRC.replace(ZRE, 'if(false){');
}
const ICS = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:z1@test', 'DTSTART:20261117T000000Z', 'DTEND:20261117T080000Z', 'SUMMARY:아침 작업', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:z2@test', 'DTSTART:20261119T1600Z', 'SUMMARY:자정 넘는 일정', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:t1@test', 'DTSTART;TZID=Asia/Seoul:20261119T140000', 'SUMMARY:오후 점검', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:f1@test', 'DTSTART:20261120T093000', 'SUMMARY:떠 있는 시각', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:d1@test', 'DTSTART;VALUE=DATE:20261121', 'SUMMARY:종일 작업', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calcmd-v569 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
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
(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(() => { closeModal(true); state.projects = []; state.files = []; state.quotes = []; state.schedule = []; state._demo = false; state.dirHandle = null; state.tab = 'schedule'; render(); });
    await test('① parseICS — …Z 는 한국 시각(+9, 날짜 넘김) · TZID·떠 있는 시각·종일은 그대로 (ZTIME)', async () => {
      const ev = await page.evaluate(t => parseICS(t).map(e => [e.uid, e.date, e.time, e.title]), ICS);
      assert.deepEqual(ev, [['z1@test', '2026-11-17', '09:00', '아침 작업'], ['z2@test', '2026-11-20', '01:00', '자정 넘는 일정'], ['t1@test', '2026-11-19', '14:00', '오후 점검'],
        ['f1@test', '2026-11-20', '09:30', '떠 있는 시각'], ['d1@test', '2026-11-21', '', '종일 작업']], JSON.stringify(ev));
    });
    await test('② importICS — Z 일정이 09:00 으로 들어가고, 같은 파일을 다시 넣으면 갱신만 (IMPORT)', async () => {
      const r = await page.evaluate(async t => { const a = await importICS(t), one = state.schedule.map(s => [s.date, s.time, s.title]).sort((x, y) => (x[0] + x[1]).localeCompare(y[0] + y[1])); const b = await importICS(t);
        return { a, b, one, n: state.schedule.length }; }, ICS);
      assert.deepEqual([r.a, r.b, r.n], [{ 추가: 5, 갱신: 0, 취소: 0 }, { 추가: 0, 갱신: 5, 취소: 0 }, 5], JSON.stringify(r));
      assert.deepEqual(r.one[0], ['2026-11-17', '09:00', '아침 작업'], JSON.stringify(r.one));
    });
    await test('③ 🧰 클로드 명령어 — cw_calsync · 현장웹 분류 맨 앞 · 준비물 · 스킬 줄 · 구글은 읽기만 (CMD)', async () => {
      const r = await page.evaluate(() => { const d = coworkDefaults(), t = d.find(x => x.id === 'cw_calsync') || {}, app = d.filter(x => cwCatOf(x) === 'app').sort((a, b) => CW_META[a.id].o - CW_META[b.id].o).map(x => x.id);
        return { title: t.title, icon: t.icon, builtin: t.builtin, keys: Object.keys(t).sort().join(), first: app[0], prep: (CW_META.cw_calsync || {}).prep, skill: cwSkillLine(t),
          ok: /구글 캘린더는 읽기만 한다/.test(t.prompt) && /맞추기 창만 쓴다/.test(t.prompt) && /🔄 구글 캘린더 맞추기/.test(t.prompt) && /'@' 일정/.test(t.prompt) && !/Cowork/i.test(t.prompt) }; });
      assert.deepEqual(r, { title: '구글 캘린더 일정 → 현장웹 맞추기', icon: '🔄', builtin: true, keys: 'builtin,icon,id,prompt,title', first: 'cw_calsync', prep: 'PC 크롬에 구글 캘린더와 현장웹 탭 열어 두기',
        skill: '🧰 사용할 스킬: manmul-hyeonjang — 앱 운영 스킬 · 구글 캘린더 맞추기(🔄 미리보기·안전판, 구글은 읽기만)', ok: true }, JSON.stringify(r));
    });
    await context.close();
    await test('④ 소스·핀 3곳(v569 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 569, '핀 v569 이상 ' + a);
      assert.ok(src.includes(ZRE), '…Z 변환이 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`calcmd-v569: ${passed}/4 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calcmd-v569 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

/* v606 📤 내일 일정 팀에 보내기 — 하루치 지시 detail 에 일정 메모의 출입 번호가 그대로 실리던 것.
   📤 일정 공유 글·.ics·작업자 문안·다음 공정 안내는 v552·v577 부터 출입 번호처럼 보이는 토막을 뺐는데(hjMemoOut), 팀 지시 패킷의 detail(hjWoMemoSafe)만
   고객 이름·전화·돈 줄만 지우고 '현관 5678#' 은 그대로 실었다 — 패킷은 팀 앱·카톡으로 퍼진다(v604 갈래가 탐침으로 확인). 합성 자료, 시계 고정, 바깥 쓰기 0.
   ① 지시 내용 — 출입 번호 줄·토막은 빠지고 나머지 메모는 남는다 · 번호 아닌 숫자('폭 1100mm')·뺄 것 없는 줄(' / ' 든 줄)은 한 글자도 그대로 ·
      돈 줄은 예전처럼 빠짐 · 뺀 수(cut) (DETAIL)
   ② 화면 — 그 지시에만 '🔒 … n곳은 지시에서 뺐어요' · 미리보기 JSON 에도 번호 없음 · 개인정보 검사 통과 · 폰 390 넘침 없음 (VIEW)
   ③ 일정 메모는 그대로(대표 화면) · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (KEEP)
   HJ_V606_BASELINE=<commit> 와 HJ_V606_MUTATION=no-scrub(출입 번호를 안 뺌)은 ①, no-note(뺐다는 안내 없음)는 ② 에서 실패해야 한다. */
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
  'no-scrub': [".filter(l=>!own(l)).map(l=>{const sc=hjAccessScrub(l);return sc.cut?sc.parts.join(' · '):l;}).filter(", '.filter(l=>!own(l)).filter('],
  'no-note': ["      (r.cut?'<div data-wo-day-cut", "      (false?'<div data-wo-day-cut"]
};
let html = process.env.HJ_V606_BASELINE ? execFileSync('git', ['show', process.env.HJ_V606_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V606_MUTATION) {
  const m = MUT[process.env.HJ_V606_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V606_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS wocode-v606 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    // 합성 현장 둘 + 내일(11/17 화) 일정 둘 — 하나는 메모에 출입 번호 셋, 하나는 번호 없는 메모
    state.projects = [{ name: '가온아파트', stage: 2, customer: { name: '김가상', phone: '', addr: '시험시 가온로 1' } }, { name: '나래빌라', stage: 2, customer: { name: '', phone: '', addr: '시험시 나래길 2' } }];
    state.files = [];
    state.schedule = [
      { id: 's1', date: '2026-11-17', time: '09:00', title: '욕실 방수', project: '가온아파트', hours: 4, memo: '장소: 공동현관 1234\n현관 5678#\n자재는 문 앞 / 도어락 9999* / 주차 B2\n보양비 30000원 받기' },
      { id: 's2', date: '2026-11-17', time: '14:00', title: '타일 보수', project: '나래빌라', hours: 2, memo: '공동현관 폭 1100mm\n엘리베이터 보양 먼저 / 주차 B2' }
    ];
  }, BOOT);
  return { context, page };
}
(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    await test('① 지시 내용 — 출입 번호는 빠지고 나머지 메모는 남는다 (DETAIL)', async () => {
      const r = await page.evaluate(() => {
        const b = hjWoBuildDay('2026-11-17'), o = id => b.refs.find(x => x.items[0].ref === id);
        return { n: b.packet.orders.length, d1: o('s1').order.detail, d2: o('s2').order.detail, cut: [o('s1').cut, o('s2').cut], issues: b.refs.map(x => x.issues.length), json: JSON.stringify(b.packet), bad: hjWoValidate(b.packet) };
      });
      assert.equal(r.n, 2, '지시 2개');
      assert.equal(r.d1, '자재는 문 앞 · 주차 B2', '출입 번호 줄·토막과 돈 줄이 빠진 메모 ' + JSON.stringify(r.d1));
      assert.equal(r.d2, '공동현관 폭 1100mm\n엘리베이터 보양 먼저 / 주차 B2', '번호 아닌 숫자·뺄 것 없는 줄은 한 글자도 그대로 ' + JSON.stringify(r.d2));
      assert.deepEqual(r.cut, [3, 0], '뺀 수 ' + JSON.stringify(r.cut));
      assert.ok(!/1234|5678|9999/.test(r.json), '패킷 어디에도 출입 번호 없음');
      assert.deepEqual([r.issues, r.bad], [[0, 0], []], '개인정보 검사·형식 통과 ' + JSON.stringify([r.issues, r.bad]));
    });

    await test('② 화면 — 그 지시에만 🔒 안내 · 미리보기에도 번호 없음 · 폰 390 넘침 없음 (VIEW)', async () => {
      await page.evaluate(() => { hjWoTomorrowView('2026-11-17'); });
      await page.waitForSelector('#hjWoDay');
      const v = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#hjWoDay [data-wo-day-order]')];
        return { notes: rows.map(x => (x.querySelector('[data-wo-day-cut]') || {}).textContent || ''), preview: document.getElementById('woDayPreview').textContent,
          ok: document.querySelectorAll('#woDayStatus [data-wo-day-privacy="ok"]').length, over: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      assert.deepEqual(v.notes, ['🔒 출입 번호처럼 보이는 메모 3곳은 지시에서 뺐어요', ''], '안내는 뺀 지시에만 ' + JSON.stringify(v.notes));
      assert.ok(!/1234|5678|9999/.test(v.preview), '미리보기 JSON 에 출입 번호 없음');
      assert.deepEqual([v.ok, v.over], [1, false], '검사 통과 표시 · 넘침 없음 ' + JSON.stringify([v.ok, v.over]));
      await page.evaluate(() => closeModal());
    });

    await test('③ 일정 메모는 그대로 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (KEEP)', async () => {
      const memo = await page.evaluate(() => state.schedule.find(s => s.id === 's1').memo);
      assert.ok(/현관 5678#/.test(memo) && /도어락 9999\*/.test(memo), '저장된 메모는 그대로(대표 화면은 본다)');
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('wocode-v606: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error('FAIL wocode-v606', e && e.stack || e); process.exit(1); });

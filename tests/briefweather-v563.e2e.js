/* v563 ☀️ 오늘의 브리핑 정돈 + 날씨 — 대표 지시(2026-11-08): "오늘의 브리핑을 정돈해줘 날씨도 추가해주고".
   · 날씨: 🌤 날씨 공정과 같은 공개 예보(weatherFetch, 키 없음)를 대전 기준으로 받아 브리핑 맨 위에 오늘·내일 한 줄.
     비 50%↑·습도 80%↑ 인 날의 날씨 민감 공정은 일정 옆 ☔/💧 표시 + 날씨 줄 아래 ⚠️ 모음. 예보는 이 기기 localStorage 에 3시간(저장본에 안 실림).
   · 정돈: 칸 순서 일정 → 오늘의 체크 → 진행 현장 → 연락 → 견적 팔로업 → 대금. 체크·진행 현장 5, 연락(리드 3·후속 5) 넘으면 [더 보기].
     '미수·독촉이 작동해요'(2026-08-13 결정과 어긋난 문구) 정리. 매출 기준이 작업내역서면 '다른 업체 견적이 매출에' 체크는 안 띄움.
   · 🌅 오늘 브리핑: 내일 일정이 늘 비던 것(nextDayYmd 는 'YYYYMMDD') 고침 + 날씨 줄.
   합성 자료·가짜 예보만, 바깥 쓰기 0.
   ① 날씨 줄 — 오늘 🌧 비 80% · 내일 ⛅ 습도 85% · ⚠️ 위험 공정 모음 (WEATHER)
   ② 일정 옆 표시 — 오늘 '옥상 방수' ☔ 비 80% · 방수 주의 · 내일 '도배' 💧 습도 85% · 도배 주의 · '철거' 는 없음 · 복사 글에도 (BADGE)
   ③ 정돈 — 칸 순서 · 진행 현장 8곳 → 5곳 + [외 3건 더 보기] → 펼침·접기 · 옛 문구 없음 · 작업내역서 기준이면 다른 업체 견적 체크 없음 (TIDY)
   ④ 못 받으면 '날씨를 못 불러왔어요 [다시]' → [다시] 로 받아짐 · 캐시 3시간 · 저장본(serializeData)에 날씨 없음 (FAIL)
   ⑤ 🌅 오늘 브리핑 — 날씨 줄 · 내일 일정 2건 (MODAL)
   ⑥ 390px — 카드 넘침 없음 · [다시]·[더 보기] 44px (MOBILE)
   ⑦ 소스·핀 3곳(v563 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V563_BASELINE=<commit> 은 ① 에서, HJ_V563_MUTATION=no-badge(일정 옆 표시를 빈 글로) 는 ② 에서 실패해야 한다. */
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
const BADGE = "return (x.wet?'☔ 비 '+x.rain+'%':'💧 습도 '+x.humid+'%')+' · '+w.label+' 주의';";
let html = process.env.HJ_V563_BASELINE ? execFileSync('git', ['show', process.env.HJ_V563_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V563_MUTATION) {
  assert.equal(process.env.HJ_V563_MUTATION, 'no-badge', 'unknown mutation ' + process.env.HJ_V563_MUTATION);
  assert.equal(SRC.split(BADGE).length, 2, 'mutation anchor');
  html = SRC.replace(BADGE, "return '';");
}

let browser, passed = 0;
const errors = [], network = { writes: 0, weather: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS briefweather-v563 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (url.hostname.endsWith('open-meteo.com')) network.weather++;
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    window.__wxCalls = 0; window.__wxFail = false;
    weatherFetch = async () => { window.__wxCalls++; if (window.__wxFail) throw new Error('offline'); return JSON.parse(JSON.stringify(window.__WX)); };
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const today = localDate(), [y, m, d] = today.split('-').map(Number), tmr = localDate(new Date(y, m - 1, d + 1)), d2 = localDate(new Date(y, m - 1, d + 2));
  window.__WX = { daily: { time: [today, tmr, d2], weather_code: [61, 3, 0], temperature_2m_max: [14.4, 11.2, 13], temperature_2m_min: [6.6, 2.1, 1], precipitation_probability_max: [80, 20, 0], relative_humidity_2m_max: [70, 85, 50] } };
  try { localStorage.removeItem('hj_brief_weather'); } catch (_) {}
  if (typeof __hjBriefWxErrAt !== 'undefined') { __hjBriefWxErrAt = 0; __hjBriefWx = null; }
  window.__briefOpen = true; __briefOpen = true; if (typeof __briefMore !== 'undefined') __briefMore = {};
  const P = (name, stage, extra) => Object.assign({ name, stage, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }, extra || {});
  state.projects = [P('가온', 2, { phases: ['방수', '도배'] }), P('나래', 1), P('다솜', 2), P('라온', 2), P('마루', 1), P('바다', 0), P('사랑', 0), P('아라', 0)];
  state.files = []; state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; state.goals = {};
  state.schedule = [
    { id: 'S1', date: today, time: '09:00', title: '옥상 방수', project: '가온', workers: '2', hours: 8 },
    { id: 'S2', date: tmr, time: '10:00', title: '도배', project: '가온', workers: '', hours: 8 },
    { id: 'S3', date: tmr, time: '13:00', title: '철거', project: '나래', workers: '', hours: 4 },
  ];
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
  return { today, tmr };
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    const D = await page.evaluate(SEED);
    await test('① 날씨 줄 — 오늘 🌧 비 80% · 내일 ⛅ 습도 85% · ⚠️ 위험 공정 모음 (WEATHER)', async () => {
      await page.waitForSelector('.brief-card [data-brief-weather="ok"]', { timeout: 8000 });
      const w = await page.evaluate(() => { const el = document.querySelector('.brief-card [data-brief-weather]'); const r = el.querySelector('[data-brief-weather-risk]'); return { text: el.innerText.replace(/\s+/g, ' '), risk: r ? r.innerText.replace(/\s+/g, ' ') : '', calls: window.__wxCalls, top: el.getBoundingClientRect().top - el.closest('.brief-card').getBoundingClientRect().top }; });
      assert.ok(w.text.includes('대전') && w.text.includes('오늘 🌧 비 7~14℃ · 비 80%') && w.text.includes('내일 ⛅ 구름 2~11℃ · 비 20%'), '날씨 줄 — ' + w.text);
      assert.ok(w.risk.includes('오늘 비 — 방수·외부 작업 「옥상 방수」') && w.risk.includes('내일 습도 높음 — 도배 「도배」'), '위험 공정 모음(한 일정은 한 번, 이름을 잇는다) — ' + w.risk);
      assert.equal(w.risk.split('옥상 방수').length, 2, '옥상 방수는 한 번만');
      assert.equal(w.calls, 1, '예보는 한 번만 받음');
      assert.ok(w.top < 80, '날씨는 카드 맨 위(머리 바로 아래) — ' + w.top);
    });
    await test('② 일정 옆 표시 — 방수 ☔ · 도배 💧 · 철거 없음 · 복사 글에도 (BADGE)', async () => {
      const r = await page.evaluate(() => {
        const row = id => { const el = document.querySelector('.brief-card [data-brief-sch="' + id + '"]'); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
        return { a: row('S1'), b: row('S2'), c: row('S3'), text: hjDailyBriefText() };
      });
      assert.ok(r.a.includes('☔ 비 80% · 방수 주의'), '오늘 방수 — ' + r.a);
      assert.ok(r.b.includes('💧 습도 85% · 도배 주의'), '내일 도배 — ' + r.b);
      assert.ok(r.c && !/주의/.test(r.c), '철거는 표시 없음 — ' + r.c);
      assert.ok(r.text.split('\n')[1].startsWith('🌤 대전 오늘 🌧 비 7~14℃ 비 80% · 내일 ⛅ 구름 2~11℃ 비 20%'), '복사 글 둘째 줄 = 날씨 — ' + r.text.split('\n')[1]);
      assert.ok(r.text.includes('옥상 방수 @가온 (2명) [☔ 비 80% · 방수 주의]') && r.text.includes('10:00 도배 [💧 습도 85% · 도배 주의]'), '복사 글 일정 표시');
    });
    await test('③ 정돈 — 칸 순서 · 진행 현장 8곳 → 5 + [외 3건 더 보기] · 펼침·접기 · 옛 문구 · 작업내역서 기준 (TIDY)', async () => {
      const r = await page.evaluate(async () => {
        const card = () => document.querySelector('.brief-card');
        const order = ['📅 오늘·내일 일정', '✅ 오늘의 체크', '🔥 진행 중 현장', '📞 챙길 연락', '💰 대금 현황(힌트)'].map(t => card().innerHTML.indexOf('>' + t + '</div>'));   // 칸 머리만(위 요약 칩 글과 구분)
        const board = card().innerHTML.indexOf('🏥 현장 보드');
        const doing = () => card().querySelectorAll('[data-workorderp]').length;
        const n1 = doing(), btn1 = (card().querySelector('[data-briefmore="doing"]') || {}).textContent || '';
        card().querySelector('[data-briefmore="doing"]').click(); await new Promise(r => setTimeout(r, 60));
        const n2 = doing(), btn2 = (card().querySelector('[data-briefmore="doing"]') || {}).textContent || '';
        card().querySelector('[data-briefmore="doing"]').click(); await new Promise(r => setTimeout(r, 60));
        const n3 = doing();
        // 옛 문구 · 작업내역서 기준이면 다른 업체 견적 체크 없음
        state.files = [{ id: 'V1', kind: 'estimate', project: '가온', name: '용진인테리어 견적서.xlsx', ext: 'xlsx', est: { amount: 1100000, customer: '용진인테리어' }, when: new Date() }];
        state.payLog = [];
        const ck0 = hjDailyBrief().checks.map(c => c.t);
        hjSalesBasisSet(true); const ck1 = hjDailyBrief().checks.map(c => c.t); hjSalesBasisSet(false);
        state.files = [];
        render();
        return { order, board, n1, btn1, n2, btn2, n3, ck0, ck1 };
      });
      assert.ok(r.order.every(i => i > 0) && r.order.every((v, i, a) => i === 0 || a[i - 1] < v), '칸 순서 일정 → 체크 → 진행 → 연락 → 대금 — ' + r.order);
      assert.ok(r.board > r.order[1] && r.board < r.order[2], '🏥 현장 보드는 체크 다음·진행 현장 앞 — ' + [r.order[1], r.board, r.order[2]]);
      assert.deepEqual([r.n1, r.n2, r.n3], [5, 8, 5], '진행 현장 5 → 펼치면 8 → 접으면 5');
      assert.ok(r.btn1.includes('외 3건 더 보기') && r.btn2.includes('접기'), '더 보기/접기 — ' + r.btn1 + ' / ' + r.btn2);
      assert.ok(r.ck0.some(t => t.includes('수금 기록이 없는 현장') && t.includes('장부·세무 자료가 맞아요')) && !r.ck0.some(t => t.includes('미수·독촉')), '옛 미수·독촉 문구 정리 — ' + JSON.stringify(r.ck0));
      const vend = ck => ck.some(t => t.includes('다른 업체 이름 견적'));
      assert.deepEqual([vend(r.ck0), vend(r.ck1)], [true, false], '작업내역서 기준이면 다른 업체 견적 체크 없음');
    });
    await test('④ 못 받으면 [다시] → 받아짐 · 캐시 3시간 · 저장본에 날씨 없음 (FAIL)', async () => {
      const r = await page.evaluate(async () => {
        localStorage.removeItem('hj_brief_weather'); __hjBriefWxErrAt = 0; window.__wxFail = true; window.__wxCalls = 0;
        render(); await new Promise(r => setTimeout(r, 300));
        const st1 = (document.querySelector('.brief-card [data-brief-weather]') || {}).dataset.briefWeather, t1 = document.querySelector('.brief-card [data-brief-weather]').innerText;
        render(); await new Promise(r => setTimeout(r, 200)); const callsAfterRerender = window.__wxCalls;   // 10분 안에는 저절로 다시 안 부름
        window.__wxFail = false;
        document.querySelector('.brief-card [data-briefweather="retry"]').click();
        await new Promise(r => setTimeout(r, 400));
        const st2 = (document.querySelector('.brief-card [data-brief-weather]') || {}).dataset.briefWeather;
        const cache = JSON.parse(localStorage.getItem('hj_brief_weather') || 'null');
        cache.at = Date.now() - 3 * 3600 * 1000 - 1000; localStorage.setItem('hj_brief_weather', JSON.stringify(cache));
        const stale = hjBriefWeatherNow().state;
        const ser = JSON.stringify(serializeData());
        return { st1, t1, callsAfterRerender, st2, cacheOk: !!(cache && cache.data && cache.data.daily), stale, serHasWx: /precipitation|hj_brief_weather|weather_code/.test(ser) };
      });
      assert.equal(r.st1, 'error', '못 받으면 error'); assert.ok(r.t1.includes('날씨를 못 불러왔어요'), r.t1);
      assert.equal(r.callsAfterRerender, 1, '실패 뒤 다시 그려도 저절로 또 부르지 않음');
      assert.equal(r.st2, 'ok', '[다시] 로 받아짐');
      assert.equal(r.cacheOk, true, '이 기기 캐시'); assert.equal(r.stale, 'none', '3시간 지나면 다시 받을 대상');
      assert.equal(r.serHasWx, false, '저장본에 날씨가 실리지 않음');
    });
    await test('⑤ 🌅 오늘 브리핑 — 날씨 줄 · 내일 일정 2건 (MODAL)', async () => {
      const r = await page.evaluate(async () => {
        await hjBriefWeatherLoad(true);
        const d = aiBriefData(); await aiBriefing();
        const box = (document.getElementById('briefBox') || {}).innerText || ''; closeModal(true);
        return { tmr: d.내일일정.map(x => x.제목), box };
      });
      assert.deepEqual(r.tmr, ['도배', '철거'], '내일 일정(예전엔 늘 비었음)');
      assert.ok(r.box.startsWith('🌤 대전 오늘 🌧 비') && r.box.includes('내일: 10:00 도배, 13:00 철거'), '🌅 브리핑 글 — ' + r.box.slice(0, 160));
    });
    await context.close();
    await test('⑥ 390px — 카드 넘침 없음 · [다시]·[더 보기] 44px (MOBILE)', async () => {
      const m = await open(390);
      await m.page.evaluate(SEED);
      await m.page.evaluate(() => { window.__wxFail = true; __hjBriefWxErrAt = 0; localStorage.removeItem('hj_brief_weather'); render(); });
      await m.page.waitForSelector('.brief-card [data-briefweather="retry"]', { timeout: 8000 });
      const r = await m.page.evaluate(() => {
        const card = document.querySelector('.brief-card'), cr = card.getBoundingClientRect();
        const h = s => { const el = card.querySelector(s); return el ? Math.round(el.getBoundingClientRect().height) : 0; };
        return { over: card.scrollWidth - card.clientWidth, right: Math.round(cr.right), vw: innerWidth, retry: h('[data-briefweather="retry"]'), more: h('[data-briefmore="doing"]'), doc: document.documentElement.scrollWidth - innerWidth };
      });
      assert.ok(r.over <= 1 && r.right <= r.vw && r.doc <= 1, '넘침 없음 — ' + JSON.stringify(r));
      assert.ok(r.retry >= 44 && r.more >= 44, '[다시]·[더 보기] 44px — ' + JSON.stringify(r));
      await m.context.close();
    });
    await test('⑦ 소스·핀 3곳(v563 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 563, '핀 v563 이상 ' + a);
      assert.ok(src.includes(BADGE), '일정 옆 표시가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`briefweather-v563: ${passed}/7 PASS; synthetic data · fake forecast; external writes=${network.writes}; real weather calls=${network.weather}`);
  } catch (error) {
    console.error('FAIL briefweather-v563 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

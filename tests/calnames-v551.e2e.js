/* v551 달력 칸에 그날 일정 제목 — 날짜 칸만 봐도 무슨 일인지(거래처 월간 일정표처럼). 합성 자료만, 외부 쓰기 0.
   ① PC 1280: 하루 한 건은 제목이 3줄까지 접혀 다 보임 · 네 건이면 시각 붙은 두 줄 + '+2건' · 여러 날 공정의 이어지는 날 '↳ 제목'(.cal-cont, 일요일 빼고)이 맨 위 ·
      완료 보고·긴급 표시 · 칸 이름(aria-label)에 종전 '일정 N건 …' + 제목 · 칸 밖으로 안 잘림 · 달력 높이 줄어듦(정사각 760px → 600px 대) (PC)
   ② 날짜 누르기는 종전대로: 그날 일정만 아래 목록 · 고른 칸(파랑)의 제목 칸은 흰 바탕 대비 4.5↑ (SELECT)
   ③ 폰 390: 시각 없이 두 줄까지(한 건이면 두 줄 제목, 많으면 한 칸 + '+N건') · 칸 높이 50px 대 · 넘침 0 (PHONE)
   ④ 어두운 화면 + 큰 글씨 2단계(폰·PC): 제목·시각·'+N건'·이어지는 칸 대비 4.5↑ · 넘침 0 · 안 잘림 (DARK)
   ⑤ 제목의 꺾쇠·따옴표는 글자로(칸에 요소가 생기지 않음) · 소스·핀 3곳(v551 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V551_BASELINE=<commit> 은 ① 에서, HJ_V551_MUTATION=dots(칸 제목 그리기 삭제)도 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V551_MUTATION || '';
let html = process.env.HJ_V551_BASELINE ? execFileSync('git', ['show', process.env.HJ_V551_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'dots');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '      ${hjCalEvHTML(items,narrow)}\n';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const GA = 'T551 빌라';
const LONG = 'T551 가상빌라 욕조방수 1칸 — 가상건설사';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, dark, big }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, dark, big, ga, long }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false;
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;
    const orig = window.localDate; window.localDate = d => d ? orig(d) : '2026-12-02';   // 12월이 이번 달 — 실제 날짜와 무관
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    if (dark) document.body.classList.add('dark'); if (big) document.body.classList.add('a11y-big2');
    state.projects.push({ name: ga, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    const S = (id, date, title, x) => Object.assign({ id: 'v551_' + id, date, time: '', title, project: '', workers: '', memo: '', hours: 0, report: null }, x || {});
    state.schedule = [
      S('one', '2026-12-03', long),                                                                                   // 하루 한 건 — 긴 제목
      S('m1', '2026-12-10', '자재 반입', { time: '08:00' }),
      S('m2', '2026-12-10', '도배 (3일차 시작)', { time: '09:00', project: ga, memo: '2026-12-10~2026-12-12 (3일)' }),   // 10·11·12(토), 13 일요일 다음은 끝
      S('m3', '2026-12-10', '전기 배선 점검', { time: '14:00', project: ga }),
      S('m4', '2026-12-10', '관리소 서류 제출', { time: '17:00' }),
      S('c1', '2026-12-11', '실측', { time: '10:00' }),                                                                // 이어지는 날 + 그날 시작
      S('rp', '2026-12-16', '타일 마감', { time: '09:00', report: { done: '마감 끝', progress: '완료' } }),
      S('ur', '2026-12-17', '누수 긴급 출동', { urgent: true }),
      S('xs', '2026-12-21', '<img src=x onerror="window.__v551x=1">"따옴표"')
    ];
    __calYM = '2026-12'; __calSelDate = null; state.tab = 'schedule'; render(); if (mobile) syncMobileNav();   // 달력 달은 localMonth(실제 날짜)라 고정
  }, { keys: BOOT, mobile: !!mobile, dark: !!dark, big: !!big, ga: GA, long: LONG });
  if (dark) await page.waitForTimeout(700);   // 글자색 전환이 끝난 뒤 잰다
  return { context, page };
}
// 칸별: 제목 칸 글자·종류·줄 수, 칸 이름, 잘림(자식 아래끝 > 칸 아래끝)
const cells = page => page.evaluate(() => {
  const out = {};
  document.querySelectorAll('.cal-cell[data-calday]').forEach(c => {
    const evs = [...c.querySelectorAll('.cal-ev, .cal-more')];
    const cr = c.getBoundingClientRect();
    const clip = [...c.querySelectorAll('*')].some(e => e.getBoundingClientRect().bottom > cr.bottom + 0.5);
    out[c.dataset.calday.slice(8)] = {
      ev: evs.map(e => (e.classList.contains('cal-more') ? 'MORE:' : '') + (e.classList.contains('cal-cont') ? 'CONT:' : '') + (e.classList.contains('rep') ? 'REP:' : '') + (e.classList.contains('urgent') ? 'URG:' : '') + e.textContent),
      clamp: evs.map(e => +(e.style.webkitLineClamp || 1)), time: evs.map(e => !!e.querySelector('b')),
      aria: c.getAttribute('aria-label'), hidden: (c.querySelector('.cal-evs') || {}).getAttribute ? c.querySelector('.cal-evs').getAttribute('aria-hidden') : null,
      h: Math.round(cr.height), clip, d: (c.querySelector('.cal-d') || {}).textContent
    };
  });
  const cal = document.querySelector('.calendar').getBoundingClientRect();
  return { cells: out, calH: Math.round(cal.height), over: document.documentElement.scrollWidth - innerWidth, imgs: document.querySelectorAll('.calendar img').length, x: !!window.__v551x };
});
async function test(name, fn) { await fn(); passed++; console.log('PASS calnames-v551 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), fullPage: false }); }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// 글자 뒤의 실제 바탕색 — 반투명 칸은 아래 바탕과 섞어서(알파 합성) 잰다
const BG = 'window.__bg=e=>{const layers=[];for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;const m=c.match(/[\\d.]+/g);if(!m)continue;const a=m.length>3?+m[3]:1;if(a>0)layers.push([+m[0],+m[1],+m[2],a]);if(a>=1)break;}let rgb=[255,255,255];if(!layers.length||layers[layers.length-1][3]<1){const b=getComputedStyle(document.body).backgroundColor.match(/[\\d.]+/g).map(Number);rgb=[b[0],b[1],b[2]];}for(let i=layers.length-1;i>=0;i--){const[r,g,b2,a]=layers[i];rgb=[r*a+rgb[0]*(1-a),g*a+rgb[1]*(1-a),b2*a+rgb[2]*(1-a)];}return "rgb("+rgb.map(v=>Math.round(v)).join(", ")+")";};';
const pairs = page => page.evaluate(() => {
  const pick = sel => [...document.querySelectorAll(sel)].map(e => [sel, getComputedStyle(e).color, __bg(e)]);
  return [...pick('.calendar .cal-ev'), ...pick('.calendar .cal-ev b'), ...pick('.calendar .cal-more')];
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 1280 });

  await test('① PC 1280 — 칸에 제목(한 건 3줄·네 건 두 줄+N·↳ 이어지는 날 맨 위·완료·긴급) · 칸 이름 · 안 잘림 · 달력 높이 (PC)', async () => {
    const r = await cells(page);
    const c = r.cells;
    assert.deepEqual(c['03'].ev, [LONG], 'one item shows the whole title');
    assert.deepEqual(c['03'].clamp, [3], 'a lone item may fold to 3 lines');
    assert.equal(c['03'].hidden, 'true', 'title chips are hidden from screen readers (the cell name carries them)');
    assert.equal(c['03'].aria, '2026년 12월 3일 일정 1건: ' + (LONG.length > 24 ? LONG.slice(0, 23) + '…' : LONG), 'cell name = old count + title (cut 24)');
    assert.deepEqual(c['10'].ev, ['08:00 자재 반입', '09:00 도배', 'MORE:+2건'], 'four items: two lines with time, then +2 (plan suffix trimmed) ' + JSON.stringify(c['10'].ev));
    assert.deepEqual(c['10'].time, [true, true, false], 'PC shows the time');
    assert.match(c['10'].aria, /일정 4건: 자재 반입, 도배, 전기 배선 점검 외 1건$/, 'cell name lists three ' + c['10'].aria);
    assert.deepEqual(c['11'].ev, ['CONT:↳ 도배', '10:00 실측'], 'continuing day first, then that day\'s start ' + JSON.stringify(c['11'].ev));
    assert.match(c['11'].aria, /일정 1건 이어지는 공정 1건: ↳ 도배, 실측$/, 'old count words kept ' + c['11'].aria);
    assert.deepEqual(c['12'].ev, ['CONT:↳ 도배'], 'Saturday continues');
    assert.deepEqual(c['13'].ev, [], 'Sunday skipped (same as v354)');
    assert.deepEqual(c['14'].ev, [], 'span ended on the 12th');
    assert.deepEqual(c['16'].ev, ['REP:09:00 타일 마감'], 'reported item marked');
    assert.deepEqual(c['17'].ev, ['URG:누수 긴급 출동'], 'urgent item marked'); assert.match(c['17'].d, /🚨/, 'urgent day icon kept');
    assert.match(c['05'].aria, /일정 없음$/, 'empty day name unchanged');
    const clipped = Object.keys(c).filter(k => c[k].clip); assert.deepEqual(clipped, [], 'nothing spills out of a cell');
    const hs = [...new Set(Object.values(c).map(x => x.h))];
    assert(hs.every(h => h >= 86 && h <= 96), 'PC cells about 88px (3 lines) ' + JSON.stringify(hs));
    assert(r.calH < 660, 'PC calendar shorter than the old 760px squares ' + r.calH);
    assert(r.over <= 0, 'no horizontal overflow ' + r.over);
    await shot(page, 'v551-pc');
  });

  await test('② 날짜 누르기 — 그날 일정만 목록 · 고른 칸 제목 대비 4.5↑ (SELECT)', async () => {
    await page.locator('[data-calday="2026-12-10"]').click();
    const r = await page.evaluate(() => ({ sel: document.querySelector('[data-calday="2026-12-10"]').classList.contains('sel'), pressed: document.querySelector('[data-calday="2026-12-10"]').getAttribute('aria-pressed'), list: [...document.querySelectorAll('#view .sch-item .sch-title')].map(e => e.textContent.trim().replace(/\s*🏗️.*$/, '')) }));
    assert.equal(r.sel, true); assert.equal(r.pressed, 'true');
    assert.deepEqual(r.list, ['자재 반입', '도배 (3일차 시작)', '전기 배선 점검', '관리소 서류 제출'], 'list below = that day only ' + JSON.stringify(r.list));
    await page.evaluate(BG);
    const p = await page.evaluate(() => [...document.querySelectorAll('[data-calday="2026-12-10"] .cal-ev, [data-calday="2026-12-10"] .cal-ev b, [data-calday="2026-12-10"] .cal-more')].map(e => [getComputedStyle(e).color, __bg(e)]));
    assert(p.length === 5 && p.every(x => ratio(...x) >= 4.5), 'selected cell chips contrast ' + JSON.stringify(p));
    const dn = await page.evaluate(() => { const e = document.querySelector('[data-calday="2026-12-10"] .cal-d'); return [getComputedStyle(e).color, __bg(e), document.querySelector('[data-calday="2026-12-10"]').matches(':hover')]; });
    assert(dn[2] && ratio(dn[0], dn[1]) >= 4.5, 'selected day number stays readable under the mouse (was white on white :hover) ' + JSON.stringify(dn));
    await shot(page, 'v551-pc-selected');
    await page.locator('[data-calday="2026-12-10"]').click();
    assert.equal(await page.evaluate(() => __calSelDate), null, 'second tap clears the day');
  });

  await test('③ 폰 390 — 시각 없이 두 줄까지 · 한 칸+N건 · 칸 높이 · 넘침 0 (PHONE)', async () => {
    const { page: ph } = await open({ width: 390, mobile: true });
    const r = await cells(ph), c = r.cells;
    assert.deepEqual(c['03'].clamp, [2], 'phone: lone title folds to 2 lines');
    assert.deepEqual(c['10'].ev, ['자재 반입', 'MORE:+3건'], 'phone: one line + "+3건" ' + JSON.stringify(c['10'].ev));
    assert.deepEqual(c['10'].time, [false, false], 'phone: no time prefix');
    assert.deepEqual(c['11'].ev, ['CONT:↳ 도배', '실측'], 'phone: continuing first');
    const clipped = Object.keys(c).filter(k => c[k].clip); assert.deepEqual(clipped, [], 'nothing spills out of a phone cell');
    const hs = [...new Set(Object.values(c).map(x => x.h))];
    assert(hs.every(h => h >= 50 && h <= 60), 'phone cells about 52px ' + JSON.stringify(hs));
    assert(r.calH < 460, 'phone calendar height ' + r.calH);
    assert(r.over <= 0, 'phone no overflow ' + r.over);
    await ph.evaluate(BG);
    const p = await pairs(ph); assert(p.length >= 8 && p.every(x => ratio(x[1], x[2]) >= 4.5), 'phone light contrast ' + JSON.stringify(p.filter(x => ratio(x[1], x[2]) < 4.5)));
    await shot(ph, 'v551-phone');
  });

  await test('④ 어두운 화면 + 큰 글씨 2단계 — 폰·PC 대비 4.5↑ · 넘침 0 · 안 잘림 (DARK)', async () => {
    for (const o of [{ width: 390, mobile: true, dark: true, big: true }, { width: 1280, dark: true, big: true }]) {
      const { page: pd } = await open(o);
      const r = await cells(pd);
      const clipped = Object.keys(r.cells).filter(k => r.cells[k].clip); assert.deepEqual(clipped, [], (o.mobile ? 'phone' : 'PC') + ' dark+big: nothing spills ' + JSON.stringify(clipped));
      assert(r.over <= 0, 'dark+big no overflow ' + r.over);
      await pd.evaluate(BG);
      const p = await pairs(pd);
      assert(p.length >= 8 && p.every(x => ratio(x[1], x[2]) >= 4.5), (o.mobile ? 'phone' : 'PC') + ' dark+big contrast ' + JSON.stringify(p.filter(x => ratio(x[1], x[2]) < 4.5)));
      await pd.locator('[data-calday="2026-12-11"]').click();
      const s = await pd.evaluate(() => [...document.querySelectorAll('[data-calday="2026-12-11"] .cal-ev')].map(e => [getComputedStyle(e).color, __bg(e)]));
      assert(s.length === 2 && s.every(x => ratio(...x) >= 4.5), 'dark selected cell chips contrast ' + JSON.stringify(s));
      const dn = await pd.evaluate(() => { const e = document.querySelector('[data-calday="2026-12-11"] .cal-d'); return [getComputedStyle(e).color, __bg(e)]; });
      assert(ratio(...dn) >= 4.5, 'dark selected day number contrast ' + JSON.stringify(dn));
      await shot(pd, o.mobile ? 'v551-phone-dark-big' : 'v551-pc-dark-big');
    }
  });

  await test('⑤ 꺾쇠·따옴표는 글자로 · 소스·핀 3곳(v551 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const r = await cells(page);
    assert.deepEqual(r.cells['21'].ev, ['<img src=x onerror="window.__v551x=1">"따옴표"'], 'title stays text');
    assert.equal(r.imgs, 0, 'no element made from a title'); assert.equal(r.x, false, 'no script ran');
    const xs = '<img src=x onerror="window.__v551x=1">"따옴표"';
    assert(r.cells['21'].aria.endsWith(': ' + xs.slice(0, 23) + '…'), 'cell name keeps the raw title as text (cut 24) ' + r.cells['21'].aria);
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('function hjCalEvHTML(items,narrow){') && !src.includes('<span class="cal-dot'), 'chips replace the dot');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 551, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('calnames-v551: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL calnames-v551', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

/* v553 운영 대시보드 맨 위에 달력 — 현장 요청(11/3) "운영 대시보드 맨 위를 캘린더로". 합성 자료만, 외부 쓰기 0.
   ① 폰 390: 첫 화면 맨 위가 달력(v551 칸마다 일정 제목) → 바로 아래 📅 오늘 일정 → ✅ 오늘 현장 업무(벤토) 순 · 달력이 첫 화면 안에 다 들어옴 · 넘침 0 (PHONE)
   ② PC 1280: 같은 순서 · 넘침 0 · 어두운 화면 + 큰 글씨 2단계에서 칸 제목·날짜 숫자(오늘·고른 일요일 포함) 대비 4.5↑ · 안 잘림 (PC)
   ③ 대시보드 달력의 날짜를 누르면(또는 Enter) 캘린더 탭으로 가서 그날 일정만 목록 · 고른 칸이 화면 안 · ‹ › 는 대시보드에 머문 채 달만 넘김(캘린더 탭과 같은 달) · '오늘' 은 이번 달로 (TAP)
   ④ 날짜 있는 일정이 하나도 없으면 달력을 그리지 않음(📅 오늘 일정이 종전처럼 맨 위) · 현장이 하나도 없는 첫 화면(불러오기 안내)은 종전 그대로 (EMPTY)
   ⑤ 소스·핀 3곳(v553 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V553_BASELINE=<commit> 은 ① 에서, HJ_V553_MUTATION=stay(날짜 누르면 대시보드에 머묾)는 ③ 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V553_MUTATION || '';
let html = process.env.HJ_V553_BASELINE ? execFileSync('git', ['show', process.env.HJ_V553_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'stay');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(state.tab==='dashboard'){__calSelDate=d.calday;__calYM=String(d.calday).slice(0,7);return hjGoTab('schedule');}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const GA = 'T553 빌라';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, dark, big, schedule, noProjects }) {
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
  await page.evaluate(async ({ keys, mobile, dark, big, ga, schedule, noProjects }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false;
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;
    try { closeModal(true); } catch (_) {}
    const orig = window.localDate; window.localDate = d => d ? orig(d) : '2026-12-02';   // 12월 2일이 오늘 — 실제 날짜와 무관
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    if (dark) document.body.classList.add('dark'); if (big) document.body.classList.add('a11y-big2');
    if (!noProjects) state.projects.push({ name: ga, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    const S = (id, date, title, x) => Object.assign({ id: 'v553_' + id, date, time: '', title, project: '', workers: '', memo: '', hours: 0, report: null }, x || {});
    state.schedule = schedule === 'none' ? [] : schedule === 'undated' ? [S('u', '', '날짜 미정 상담')] : [
      S('t1', '2026-12-02', '철거', { time: '09:00', project: ga }),
      S('t2', '2026-12-13', '가상마을 욕조방수 1칸'),
      S('t3', '2026-12-21', '도배', { time: '08:30', project: ga }),
      S('t4', '2026-12-21', '자재 반입', { time: '13:00' })
    ];
    __calYM = '2026-12'; __calSelDate = null; state.tab = 'dashboard'; render(); if (mobile) syncMobileNav();   // 달력 달은 localMonth(실제 날짜)라 고정
  }, { keys: BOOT, mobile: !!mobile, dark: !!dark, big: !!big, ga: GA, schedule: schedule || '', noProjects: !!noProjects });
  if (dark) await page.waitForTimeout(700);   // 글자색 전환이 끝난 뒤 잰다
  return { context, page };
}
// 대시보드 위에서부터: 달력 · 오늘 일정 · 벤토 위치(문서 기준), 달력 칸 제목, 넘침
const layout = page => page.evaluate(() => {
  const top = e => e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
  const cal = document.getElementById('hjDashCal');
  const todaySec = [...document.querySelectorAll('#view .dash-sec')].find(e => /오늘 일정/.test(e.textContent)) || null;
  const firstShown = [...document.querySelectorAll('#view > *')].find(e => e.getBoundingClientRect().height > 0) || null;
  const chips = {};
  if (cal) cal.querySelectorAll('.cal-cell[data-calday]').forEach(c => { const t = [...c.querySelectorAll('.cal-ev, .cal-more')].map(e => e.textContent); if (t.length) chips[c.dataset.calday.slice(8)] = t; });
  const cr = cal && cal.getBoundingClientRect();
  const clip = cal ? [...cal.querySelectorAll('.cal-cell')].some(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('*')].some(e => e.getBoundingClientRect().bottom > r.bottom + 0.5); }) : null;
  return {
    cal: top(cal), calBottom: cr ? Math.round(cr.bottom + scrollY) : null, today: top(todaySec), bento: top(document.querySelector('#view [data-bento]')),
    first: firstShown ? (firstShown.id || firstShown.className) : null, title: cal ? cal.querySelector('.cal-title').textContent : null,
    chips, clip, over: document.documentElement.scrollWidth - innerWidth, tab: state.tab, ym: __calYM, sel: __calSelDate
  };
});
async function test(name, fn) { await fn(); passed++; console.log('PASS dashcal-v553 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), fullPage: false }); }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// 글자 뒤의 실제 바탕색 — 반투명 칸은 아래 바탕과 섞어서(알파 합성) 잰다
const BG = 'window.__bg=e=>{const layers=[];for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;const m=c.match(/[\\d.]+/g);if(!m)continue;const a=m.length>3?+m[3]:1;if(a>0)layers.push([+m[0],+m[1],+m[2],a]);if(a>=1)break;}let rgb=[255,255,255];if(!layers.length||layers[layers.length-1][3]<1){const b=getComputedStyle(document.body).backgroundColor.match(/[\\d.]+/g).map(Number);rgb=[b[0],b[1],b[2]];}for(let i=layers.length-1;i>=0;i--){const[r,g,b2,a]=layers[i];rgb=[r*a+rgb[0]*(1-a),g*a+rgb[1]*(1-a),b2*a+rgb[2]*(1-a)];}return "rgb("+rgb.map(v=>Math.round(v)).join(", ")+")";};';
const pairs = page => page.evaluate(() => [...document.querySelectorAll('#hjDashCal .cal-ev, #hjDashCal .cal-ev b, #hjDashCal .cal-more, #hjDashCal .cal-d, #hjDashCal .cal-title')].map(e => [e.className || e.tagName, getComputedStyle(e).color, __bg(e)]));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page: ph } = await open({ width: 390, mobile: true });

  await test('① 폰 390 — 맨 위 달력(칸마다 제목) → 오늘 일정 → 벤토 · 첫 화면 안 · 넘침 0 (PHONE)', async () => {
    const r = await layout(ph);
    assert(r.cal !== null, 'dashboard has a calendar at the top');
    assert.equal(r.first, 'hjDashCal', 'calendar is the first visible block of the dashboard ' + r.first);
    assert(r.today !== null && r.bento !== null, 'today list and bento kept');
    assert(r.cal < r.today && r.today < r.bento, 'order: calendar → 오늘 일정 → 벤토 ' + JSON.stringify([r.cal, r.today, r.bento]));
    assert(r.calBottom <= 844, 'whole calendar on the first phone screen ' + r.calBottom);
    assert.equal(r.title, '2026년 12월');
    assert.deepEqual(r.chips['02'], ['철거'], 'today\'s title in the cell (phone: no time) ' + JSON.stringify(r.chips));
    assert.deepEqual(r.chips['13'], ['가상마을 욕조방수 1칸'], 'lone item title');
    assert.deepEqual(r.chips['21'], ['도배', '자재 반입'], 'two items on phone: two lines, no time');
    assert.equal(r.clip, false, 'nothing spills out of a cell'); assert(r.over <= 0, 'no horizontal overflow ' + r.over);
    await ph.evaluate(BG);
    const p = await pairs(ph);
    assert(p.length >= 30 && p.every(x => ratio(x[1], x[2]) >= 4.5), 'phone light contrast (today number included) ' + JSON.stringify(p.filter(x => ratio(x[1], x[2]) < 4.5)));
    await shot(ph, 'v553-phone');
  });

  await test('② PC 1280 — 같은 순서 · 넘침 0 · 어두운 화면 + 큰 글씨 대비 4.5↑ (PC)', async () => {
    const { page: pc } = await open({ width: 1280 });
    const r = await layout(pc);
    assert(r.cal !== null && r.cal < r.today && r.today < r.bento, 'PC order ' + JSON.stringify([r.cal, r.today, r.bento]));
    assert.deepEqual(r.chips['21'], ['08:30 도배', '13:00 자재 반입'], 'PC shows time ' + JSON.stringify(r.chips['21']));
    assert(r.over <= 0, 'PC no overflow ' + r.over);
    await shot(pc, 'v553-pc');
    for (const o of [{ width: 390, mobile: true, dark: true, big: true }, { width: 1280, dark: true, big: true }]) {
      const { page: pd } = await open(o);
      const d = await layout(pd);
      assert(d.cal !== null && d.cal < d.today, 'dark+big order');
      assert.equal(d.clip, false, 'dark+big nothing spills'); assert(d.over <= 0, 'dark+big no overflow ' + d.over);
      await pd.evaluate(BG);
      const p = await pairs(pd);
      assert(p.length >= 30 && p.every(x => ratio(x[1], x[2]) >= 4.5), (o.mobile ? 'phone' : 'PC') + ' dark+big contrast ' + JSON.stringify(p.filter(x => ratio(x[1], x[2]) < 4.5)));
      await shot(pd, o.mobile ? 'v553-phone-dark-big' : 'v553-pc-dark-big');
      await pd.evaluate(() => { __calSelDate = '2026-12-13'; render(); });   // 고른 칸이 일요일이어도 흰 숫자(캘린더 탭과 같은 CSS)
      const sun = await pd.evaluate(() => { const e = document.querySelector('#hjDashCal [data-calday="2026-12-13"] .cal-d'); return [getComputedStyle(e).color, __bg(e)]; });
      assert(ratio(...sun) >= 4.5, 'dark selected Sunday number contrast ' + JSON.stringify(sun));
    }
  });

  await test('③ 날짜 누르기 → 캘린더 탭 그날 · Enter 도 · ‹ › 는 대시보드에서 달만 · 오늘 (TAP)', async () => {
    await ph.locator('#hjDashCal [data-calday="2026-12-21"]').click();
    let r = await ph.evaluate(() => {
      const c = document.querySelector('[data-calday="2026-12-21"]'), b = c && c.getBoundingClientRect();
      return { tab: state.tab, sel: __calSelDate, ym: __calYM, pressed: c && c.getAttribute('aria-pressed'), inView: !!b && b.top >= 0 && b.bottom <= innerHeight, dash: !!document.getElementById('hjDashCal'),
        list: [...document.querySelectorAll('#view .sch-item .sch-title')].map(e => e.textContent.trim().replace(/\s*🏗️.*$/, '')), nav: (document.querySelector('.mnav-btn.on, .mnav .on, [data-mnav].on') || {}).textContent || '' };
    });
    assert.equal(r.tab, 'schedule', 'tap on the dashboard calendar opens the calendar tab ' + r.tab);
    assert.equal(r.sel, '2026-12-21'); assert.equal(r.ym, '2026-12'); assert.equal(r.pressed, 'true'); assert.equal(r.dash, false, 'calendar tab has its own calendar only');
    assert.deepEqual(r.list, ['도배', '자재 반입'], 'list = that day only ' + JSON.stringify(r.list));
    assert(r.inView, 'the chosen day is on screen after the switch');
    // 다시 대시보드 — Enter 로도 같은 동작
    await ph.evaluate(() => { __calSelDate = null; hjGoTab('dashboard'); });
    await ph.locator('#hjDashCal [data-calday="2026-12-13"]').focus(); await ph.keyboard.press('Enter');
    r = await ph.evaluate(() => ({ tab: state.tab, sel: __calSelDate }));
    assert.deepEqual(r, { tab: 'schedule', sel: '2026-12-13' }, 'Enter on a dashboard day does the same');
    // ‹ › 는 대시보드에 머물며 달만
    await ph.evaluate(() => { __calSelDate = null; hjGoTab('dashboard'); });
    await ph.locator('#hjDashCal [data-calnav="1"]').click();
    r = await layout(ph);
    assert.deepEqual([r.tab, r.ym, r.title], ['dashboard', '2027-01', '2027년 1월'], 'next month stays on the dashboard');
    await ph.locator('#hjDashCal [data-calnav="-1"]').click();
    r = await layout(ph);
    assert.deepEqual([r.tab, r.title], ['dashboard', '2026년 12월'], 'previous month');
    await ph.evaluate(() => hjGoTab('schedule'));
    assert.equal(await ph.evaluate(() => document.querySelector('#view .calendar .cal-title').textContent), '2026년 12월', 'calendar tab shows the same month');
    await ph.evaluate(() => hjGoTab('dashboard'));
    await ph.locator('#hjDashCal [data-calnav="0"]').click();
    r = await layout(ph);
    assert.deepEqual([r.tab, r.ym, r.sel], ['dashboard', null, null], '오늘 → this month, still the dashboard');
  });

  await test('④ 날짜 있는 일정 0건이면 달력 없음 · 현장 0곳 첫 화면은 종전 그대로 (EMPTY)', async () => {
    for (const schedule of ['none', 'undated']) {
      const { page: pe } = await open({ width: 390, mobile: true, schedule });
      const r = await layout(pe);
      assert.equal(r.cal, null, schedule + ': no empty calendar on the first screen');
      assert(r.bento !== null, schedule + ': dashboard still renders');
    }
    const { page: pn } = await open({ width: 390, mobile: true, noProjects: true });
    const r = await pn.evaluate(() => ({ cal: !!document.getElementById('hjDashCal'), empty: !!document.querySelector('#view .empty'), pull: !!document.getElementById('dashGdPull') }));
    assert.deepEqual(r, { cal: false, empty: true, pull: true }, 'no-projects onboarding unchanged');
  });

  await test('⑤ 소스·핀 3곳(v553 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('function hjDashCalendarHTML(){') && src.includes('hjDemoTourHtml()+hjDashCalendarHTML()+dashboardTodayHTML()'), 'calendar goes first in viewDashboard');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 553, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('dashcal-v553: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL dashcal-v553', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

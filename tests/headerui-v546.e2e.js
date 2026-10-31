/* v546 상단 머리 — 판 배지 · 🩺 자료 건강 캡슐 · [🧩 공정 일괄 채우기] · PC 머리 위에 붙음(대표 PDF 6번 '최종 UI 1'). 합성 자료만, 외부 쓰기 0.
   ① PC 1280: 배지 = APP_BUILD 의 vNNN · 캡슐(미배정 사진·안 읽은 견적·백업) · 공정 빈칸 있으면 채우기 단추 · 머리 한 줄(꾸밈 글만 접힘) · 스크롤해도 머리가 위에 (HEAD)
   ② 누르면: 미배정 → 🧭 추측 배정 · 견적 → 견적 읽기 · 백업 → 지금 백업 · 채우기 → 🧩 창 (CLICK)
   ③ 자료가 바뀌면 render 때 숫자가 바뀌고, 같으면 캡슐 DOM 을 다시 만들지 않는다 · 상태색: 백업 7일 넘음 bad / 할 일 todo / 깨끗 ok (LIVE)
   ④ 폰(모바일 모드 390)은 캡슐 없음·가로 넘침 없음 · 직원 모드 PC 는 머리가 직원 줄(44px) 아래 · 어두운 화면 글자 대비 4.5 이상 · 1024 넘침 없음 (FIT)
   ⑤ 소스·핀 3곳(v546 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V546_BASELINE=<commit> 은 ① 에서, HJ_V546_MUTATION=no-collapse(꾸밈 글을 안 접으면 PC 머리가 두 줄)도 ① 에서 실패해야 한다. */
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
const PJ = 'TEST_V546 가온빌라 3층';
const MUT = process.env.HJ_V546_MUTATION || '';
let html = process.env.HJ_V546_BASELINE ? execFileSync('git', ['show', process.env.HJ_V546_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-collapse');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'body:not(.mobile-mode) header:has(#hjHeadHealth:not([hidden])) .tagline{font-size:0;letter-spacing:0;border-left:none;padding-left:0}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, staff, backupDays }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.addInitScript(({ staff, days }) => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now() - days * 864e5, kind: 'file' })); if (staff) localStorage.setItem('hj_role', 'staff'); }, { staff: !!staff, days: backupDays || 0 });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, pj }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    state.projects.push({ name: pj, stage: 3, received: 0, phases: ['방수'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    const ph = (id, project, label) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 2048 + id.length, when: new Date(Date.parse('2026-10-20T12:00:00+09:00') + id.length * 3600e3), handle: null, _file: null, _virtual: true, thumb: null, text: '', ocr: 'na', lat: null, lng: null, _phase: null, _worklabel: label });
    state.files.push(ph('v546_free', '', null), ph('v546_blank', pj, null), ph('v546_ok_long', pj, '욕실 방수'));
    state.files.push({ id: 'v546_est', name: 'TEST 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: pj, prefix: '견적서/', size: 3000, when: new Date(), handle: null, _file: null, ocr: 'pending', est: null });
    __photoCache.key = null; state.tab = 'dashboard'; render();
  }, { keys: BOOT, mobile: !!mobile, pj: PJ });
  return { context, page };
}
const head = page => page.evaluate(() => {
  const h = document.querySelector('header'), box = document.getElementById('hjHeadHealth'), cap = box && box.querySelector('[data-head-cap]');
  const segs = box ? [...box.querySelectorAll('[data-head-health]')].map(b => [b.dataset.headHealth, b.textContent.replace(/\s+/g, ' ').trim()]) : [];
  return { badge: (document.getElementById('hjBuildBadge') || {}).textContent || '', hidden: !box || box.hidden || getComputedStyle(box).display === 'none', cap: cap ? cap.dataset.headCap : '', segs, fill: !!(box && box.querySelector('[data-head-fill]')), h: Math.round(h.getBoundingClientRect().height), top: Math.round(h.getBoundingClientRect().top), tagFs: getComputedStyle(document.querySelector('.tagline')).fontSize, over: document.documentElement.scrollWidth - innerWidth };
});
async function test(name, fn) { await fn(); passed++; console.log('PASS headerui-v546 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' });   // 화면 모음엔 안내 토스트를 빼고 }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 1280, backupDays: 0 });

  await test('① PC 1280 — 배지 · 캡슐 · 채우기 단추 · 머리 한 줄 · 스크롤해도 위에 (HEAD)', async () => {
    const r = await head(page);
    const build = await page.evaluate(() => APP_BUILD);
    assert.equal(r.badge, (build.match(/-(v\d+)-/) || [])[1], 'badge shows the build ' + JSON.stringify(r));
    assert.equal(r.hidden, false, 'capsule shown on PC');
    assert.deepEqual(r.segs.map(s => s[0]), ['photo', 'est', 'backup'], JSON.stringify(r.segs));
    assert.match(r.segs[0][1], /미배정 사진 1/); assert.match(r.segs[1][1], /안 읽은 견적 1/); assert.match(r.segs[2][1], /백업 완료/);
    assert.equal(r.fill, true, 'fill button (a photo has blanks)'); assert.equal(r.cap, 'todo');
    assert(r.h <= 84, 'header stays one row at 1280: ' + r.h); assert.equal(r.tagFs, '0px', 'decorative tagline folded');
    await page.evaluate(() => { document.getElementById('view').insertAdjacentHTML('beforeend', '<div id="v546pad" style="height:2400px"></div>'); scrollTo(0, 1200); });
    await page.waitForFunction(() => scrollY >= 1100);
    assert.equal((await head(page)).top, 0, 'header sticks to the top');
    await page.evaluate(() => { document.getElementById('v546pad').remove(); scrollTo(0, 0); });
    await shot(page, 'v546-pc-header');
  });

  await test('② 누르면 — 미배정·견적·백업·채우기가 각 도구를 부른다 (CLICK)', async () => {
    await page.evaluate(() => { window.__calls = []; const wrap = n => { const o = window[n]; window[n] = (...a) => { __calls.push(n); return n === 'hjPhotoFillView' ? o(...a) : undefined; }; }; ['hjPhotoSuggestReview', 'hjEstimateAutoRead', 'backupNow', 'hjPhotoFillView'].forEach(wrap); });
    for (const k of ['photo', 'est', 'backup']) await page.locator('#hjHeadHealth [data-head-health="' + k + '"]').click();
    await page.locator('#hjHeadHealth [data-head-fill]').click(); await page.locator('#hjPhotoFill').waitFor();
    assert.deepEqual(await page.evaluate(() => __calls), ['hjPhotoSuggestReview', 'hjEstimateAutoRead', 'backupNow', 'hjPhotoFillView']);
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 자료가 바뀌면 숫자가 바뀌고 같으면 DOM 그대로 · 상태색 (LIVE)', async () => {
    const same = await page.evaluate(() => { const a = document.querySelector('#hjHeadHealth .hj-cap'); render(); return a === document.querySelector('#hjHeadHealth .hj-cap'); });
    assert.equal(same, true, 'unchanged capsule is not rebuilt');
    await page.evaluate(pj => { state.files.find(f => f.id === 'v546_free').project = pj; const b = state.files.find(f => f.id === 'v546_blank'); b._phase = '방수'; b._worklabel = '욕실 방수'; state.files.find(f => f.id === 'v546_free')._phase = '방수'; state.files.find(f => f.id === 'v546_free')._worklabel = '욕실 방수'; state.files.find(f => f.id === 'v546_ok_long')._phase = '방수'; state.files = state.files.filter(f => f.id !== 'v546_est'); __photoCache.key = null; render(); }, PJ);
    let r = await head(page);
    assert.match(r.segs[0][1], /미배정 사진 0/); assert.match(r.segs[1][1], /안 읽은 견적 0/); assert.equal(r.fill, false, 'no blanks → no fill button'); assert.equal(r.cap, 'ok');
    const { page: old } = await open({ width: 1280, backupDays: 9 });
    r = await head(old); assert.equal(r.cap, 'bad'); assert.match(r.segs.find(s => s[0] === 'backup')[1], /백업 9일 전/);
  });

  await test('④ 폰 캡슐 없음 · 직원 모드 PC 머리 44px 아래 · 어두운 화면 대비 · 1024 넘침 없음 (FIT)', async () => {
    const { page: pm } = await open({ width: 390, mobile: true });
    const m = await head(pm); assert.equal(m.hidden, true, 'no capsule on the phone'); assert(m.over <= 0, 'phone no overflow');
    const { page: ps } = await open({ width: 1280, staff: true });
    await ps.evaluate(() => { document.getElementById('view').insertAdjacentHTML('beforeend', '<div style="height:2400px"></div>'); scrollTo(0, 1200); });
    await ps.waitForFunction(() => scrollY >= 1100);
    assert.equal((await head(ps)).top, 44, 'staff bar stays above the sticky header');
    await page.evaluate(() => { document.body.classList.add('dark'); render(); });
    await page.waitForTimeout(700);   // 단추 글자색 전환(transition)이 끝난 뒤 잰다
    const c = await page.evaluate(() => { const cap = document.querySelector('#hjHeadHealth .hj-cap'), k = cap.querySelector('.hj-cap-k'), s = cap.querySelector('[data-head-health="photo"]'); return { bg: getComputedStyle(cap).backgroundColor, k: getComputedStyle(k).color, s: getComputedStyle(s).color }; });
    assert(ratio(c.k, c.bg) >= 4.5 && ratio(c.s, c.bg) >= 4.5, 'dark contrast ' + JSON.stringify(c));
    await page.evaluate(() => { document.body.classList.remove('dark'); render(); });
    const { page: p1024 } = await open({ width: 1024 });
    assert((await head(p1024)).over <= 0, '1024 no horizontal overflow');
  });

  await test('⑤ 소스·핀 3곳(v546 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes("try{hjHeadApply();}catch(e){}   // v546"), 'render refreshes the header');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 546, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('headerui-v546: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL headerui-v546', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

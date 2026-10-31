/* v550 폰 하단 5칸 — 현장 · 캘린더 · [카메라] · 정산 · 설정 (대표 PDF 10번) + 어두운 화면·큰 글씨 대비 마감. 합성 자료만, 외부 쓰기 0.
   ① 폰 390: 다섯 칸 순서·글자·44px·카메라 가운데 · 배지(미배정 사진·오늘 일정) 그대로 · 정산 → 견적·정산 탭 · 현장 → 사진 탭 (NAV)
   ② 빠진 두 곳의 길: 설정 바로가기 맨 앞 [대시보드][✅ 내 업무] · 내 업무는 지금 화면 위에 열리고 닫으면 [설정]으로 초점 · 캘린더 위 [✅ 내 업무] ·
      머리 '현장.' 글자(누름·Enter) → 대시보드 (PATHS)
   ③ 폰 어두운 화면 + 큰 글씨 2단계: 하단 글자 대비 4.5↑·글자 안 잘림 · 사진 탭 큰 단추(v549) 대비 · 네 탭 가로 넘침 0 (PHONE-DARK)
   ④ PC 1280 어두운 화면 + 큰 글씨 2단계: 머리 캡슐(v546)·진행 현장 칩(v547)·돈 흐름 칸·눈금(v548) 대비 4.5↑ · 넘침 0 · PC 는 하단 메뉴 없음 (PC-DARK)
   ⑤ 소스·핀 3곳(v550 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V550_BASELINE=<commit> 은 ① 에서, HJ_V550_MUTATION=no-settle(정산 칸 삭제)도 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V550_MUTATION || '';
let html = process.env.HJ_V550_BASELINE ? execFileSync('git', ['show', process.env.HJ_V550_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-settle');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '  <button class="mnav-btn" data-mnav="estimates" aria-label="정산, 견적·정산"><span class="mi" aria-hidden="true">💰</span><span>정산</span></button>\n';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const GA = 'T550 빌라';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
  await page.evaluate(async ({ keys, mobile, dark, big, ga, px }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    if (dark) document.body.classList.add('dark'); if (big) document.body.classList.add('a11y-big2');
    const t = localDate();
    state.projects.push({ name: ga, stage: 2, received: 0, phases: ['철거'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    state.schedule = Array.isArray(state.schedule) ? state.schedule : [];
    state.schedule.push({ id: 'v550_s1', date: t, time: '09:00', title: '철거', project: ga, workers: '', hours: 0 });
    const ph = (id, project, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 2048 + id.length, when: new Date(Date.parse(t + 'T09:00:00+09:00') - id.length * 60e3), handle: null, _file: null, _virtual: true, thumb: px, text: '', ocr: 'na', lat: null, lng: null, _phase: null, _worklabel: null }, extra || {});
    state.files.push(ph('u1', null), ph('u2', null), ph('a1', ga));
    state.payLog = [{ id: 'v550_p1', d: t, project: ga, amt: 1500000, method: '계좌이체' }];
    state.expenses = [{ id: 'v550_e1', date: t, amount: 200000, category: '자재', method: '카드', memo: '', project: ga, vendor: '' }];
    __photoCache.key = null; state.tab = 'photos'; render(); syncMobileNav();
  }, { keys: BOOT, mobile: !!mobile, dark: !!dark, big: !!big, ga: GA, px: PX });
  if (dark) await page.waitForTimeout(700);   // 단추 글자색 전환이 끝난 뒤 잰다
  return { context, page };
}
const nav = page => page.evaluate(() => [...document.querySelectorAll('#mobileNav .mnav-btn')].map(b => {
  const r = b.getBoundingClientRect(), lab = b.querySelector('span:not(.mi):not(.mnav-badge)'), badge = b.querySelector('[data-mnav-badge]');
  return { id: b.dataset.mnav, label: lab ? lab.textContent : '', aria: b.getAttribute('aria-label'), on: b.classList.contains('on'), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.left + r.width / 2), right: Math.round(r.right), badge: badge && !badge.hidden ? badge.textContent : '', clip: lab ? lab.scrollWidth - lab.clientWidth : 0, color: lab ? getComputedStyle(lab).color : '' };
}));
const modalOpen = page => page.evaluate(() => !!document.querySelector('#modalRoot #myWork'));
async function test(name, fn) { await fn(); passed++; console.log('PASS nav5-v550 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// 글자 뒤의 실제 바탕색(투명이면 부모로 올라가며 찾는다)
const BG = 'window.__bg=e=>{for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c&&!/rgba\\(\\d+, \\d+, \\d+, 0\\)/.test(c)&&c!=="transparent")return c;}return getComputedStyle(document.body).backgroundColor;};';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 390, mobile: true });

  await test('① 폰 390 — 다섯 칸 순서·글자·44px·카메라 가운데·배지·정산·현장 (NAV)', async () => {
    let n = await nav(page);
    assert.deepEqual(n.map(x => x.id), ['photos', 'schedule', '__camera', 'estimates', '__more'], 'five positions ' + JSON.stringify(n.map(x => x.id)));
    assert.deepEqual(n.map(x => x.label), ['현장', '캘린더', '카메라', '정산', '설정']);
    assert(n.every(x => x.h >= 44 && x.w >= 44 && x.right <= 390), 'touch size and inside the screen ' + JSON.stringify(n));
    assert(Math.abs(n[2].cx - 195) <= 2, 'camera sits in the middle ' + n[2].cx);
    assert.deepEqual([n[0].badge, n[0].aria, n[1].badge, n[1].aria], ['2', '현장사진, 미배정 2장', '1', '캘린더, 오늘 일정 1건'], 'badges keep working');
    assert.equal(n[0].on, true, 'photos tab highlights 현장');
    await page.locator('#mobileNav [data-mnav="estimates"]').click();
    n = await nav(page); assert.equal(await page.evaluate(() => state.tab), 'estimates'); assert.equal(n[3].on, true, '정산 highlighted');
    await page.locator('#mobileNav [data-mnav="photos"]').click(); assert.equal(await page.evaluate(() => state.tab), 'photos');
    await shot(page, 'v550-phone-nav');
  });

  await test('② 빠진 두 곳의 길 — 설정 바로가기 [대시보드][내 업무] · 캘린더 위 [내 업무] · 머리 글자 → 대시보드 (PATHS)', async () => {
    await page.locator('#mobileNav [data-mnav="__more"]').click(); await page.locator('#moreSearch').waitFor();
    const lead = await page.locator('#moreNav [data-more]').evaluateAll(es => es.slice(0, 2).map(e => [e.dataset.more, e.textContent.replace(/\s+/g, ' ').trim()]));
    assert.deepEqual(lead.map(x => x[0]), ['dashboard', '__mywork'], 'shortcuts lead with dashboard and today work'); assert(/대시보드/.test(lead[0][1]) && /내 업무/.test(lead[1][1]), JSON.stringify(lead));
    await shot(page, 'v550-phone-settings');
    await page.locator('#moreNav [data-more="__mywork"]').click(); await page.locator('#modalRoot #myWork').waitFor();
    assert.equal(await page.evaluate(() => state.tab), 'photos', 'today work opens over the current tab');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && document.activeElement && document.activeElement.dataset.mnav === '__more');
    await page.locator('#mobileNav [data-mnav="__more"]').click(); await page.locator('#moreNav [data-more="dashboard"]').click();
    await page.waitForFunction(() => state.tab === 'dashboard');
    await page.locator('#mobileNav [data-mnav="schedule"]').click(); await page.locator('#schMyWork').click(); await page.locator('#modalRoot #myWork').waitFor();
    assert.equal(await page.evaluate(() => state.tab), 'schedule'); await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    await page.locator('#hjLogoHome').click(); await page.waitForFunction(() => state.tab === 'dashboard');
    await page.locator('#mobileNav [data-mnav="photos"]').click(); await page.locator('#hjLogoHome').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.tab === 'dashboard');
    assert.equal(await page.evaluate(() => document.getElementById('hjLogoHome').getAttribute('role')), 'button');
  });

  await test('③ 폰 어두운 화면 + 큰 글씨 2단계 — 하단 대비·안 잘림 · 큰 단추 대비 · 네 탭 넘침 0 (PHONE-DARK)', async () => {
    const { page: pd } = await open({ width: 390, mobile: true, dark: true, big: true });
    await pd.evaluate(BG);
    const n = await nav(pd), navBg = await pd.evaluate(() => __bg(document.getElementById('mobileNav')));
    assert(n.every(x => x.clip <= 0), 'labels not clipped at big text ' + JSON.stringify(n.map(x => [x.label, x.clip])));
    assert(n.filter(x => x.id !== '__camera').every(x => ratio(x.color, navBg) >= 4.5), 'nav label contrast ' + JSON.stringify(n.map(x => [x.label, x.color, navBg])));
    const cam = await pd.evaluate(() => { const l = document.querySelector('#mobileNav .mnav-cam span:not(.mi)'); return [getComputedStyle(l).color, __bg(l)]; });
    assert(ratio(...cam) >= 4.5, 'camera label contrast ' + JSON.stringify(cam));
    const badge = await pd.evaluate(() => { const b = document.querySelector('#mobileNav [data-mnav-badge="photos"]'); return [getComputedStyle(b).color, getComputedStyle(b).backgroundColor]; });
    assert(ratio(...badge) >= 4.5, 'badge contrast ' + JSON.stringify(badge));
    const acts = await pd.evaluate(() => [...document.querySelectorAll('#view .hj-ph-actions button')].map(b => [getComputedStyle(b).color, __bg(b)]));   // 🪜(ghost)는 투명이라 실제 바탕으로
    assert(acts.length === 3 && acts.every(c => ratio(...c) >= 4.5), 'v549 big buttons + phase toggle in dark ' + JSON.stringify(acts));
    for (const tab of ['photos', 'schedule', 'estimates', 'dashboard']) {
      const over = await pd.evaluate(tab => { state.tab = tab; render(); syncMobileNav(); return document.documentElement.scrollWidth - innerWidth; }, tab);
      assert(over <= 0, tab + ' no horizontal overflow at dark+big ' + over);
    }
    await pd.evaluate(() => { state.tab = 'photos'; render(); syncMobileNav(); });
    await shot(pd, 'v550-phone-dark-big');
  });

  await test('④ PC 1280 어두운 화면 + 큰 글씨 2단계 — 캡슐·진행 현장·돈 흐름 대비 · 넘침 0 · 하단 메뉴 없음 (PC-DARK)', async () => {
    const { page: pc } = await open({ width: 1280, dark: true, big: true });
    await pc.evaluate(() => { state.tab = 'dashboard'; render(); });
    await pc.waitForTimeout(700);
    await pc.evaluate(BG);
    const c = await pc.evaluate(() => {
      const pair = e => e ? [getComputedStyle(e).color, __bg(e)] : null, svgPair = e => e ? [getComputedStyle(e).fill, __bg(e.closest('svg'))] : null;
      return {
        nav: getComputedStyle(document.getElementById('mobileNav')).display,
        cap: pair(document.querySelector('#hjHeadHealth [data-head-health="photo"]')), capK: pair(document.querySelector('#hjHeadHealth .hj-cap-k')),
        chipOn: pair(document.querySelector('#hjBentoProgress .hj-st-chip.on')), chipOff: pair(document.querySelector('#hjBentoProgress .hj-st-chip:not(.on)')), memo: pair(document.querySelector('#hjBentoProgress .hj-bento-memo')),
        tileV: pair(document.querySelector('#hjMoneyBoard [data-money="spend"] .hj-mt-v')), tileK: pair(document.querySelector('#hjMoneyBoard [data-money="spend"] .hj-mt-k')), net: pair(document.querySelector('#hjMoneyBoard [data-money="net"] .hj-mt-v')),
        tick: svgPair(document.querySelector('#hjMoneyBoard .hj-mc-tick')), over: document.documentElement.scrollWidth - innerWidth
      };
    });
    assert.equal(c.nav, 'none', 'no bottom nav on PC');
    for (const k of ['cap', 'capK', 'chipOn', 'chipOff', 'memo', 'tileV', 'tileK', 'net', 'tick']) assert(c[k] && ratio(...c[k]) >= 4.5, k + ' contrast at dark+big ' + JSON.stringify(c[k]));
    assert(c.over <= 0, 'PC no overflow at dark+big ' + c.over);
    await pc.locator('#hjLogoHome').click(); assert.equal(await pc.evaluate(() => state.tab), 'dashboard', 'logo is home on PC too');
    await shot(pc, 'v550-pc-dark-big');
  });

  await test('⑤ 소스·핀 3곳(v550 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes("if(item.tab==='__mywork'){closeSheet(false);moreRestoreOpener(opener);return myWorkView();}"), 'today work shortcut wired');
    assert(!src.includes('data-mnav="__todo"') && !src.includes('<button class="mnav-btn" data-mnav="dashboard"'), 'old bottom slots gone');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 550, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('nav5-v550: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL nav5-v550', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

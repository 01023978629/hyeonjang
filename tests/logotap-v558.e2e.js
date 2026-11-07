/* v558 폰 머리 '현장.' 누르는 곳 44px — 11/6 금요일 점검(최신 판 v557, 데모 자료, 폰 390·360·PC 1280)이 찾은 것. 합성 자료만, 외부 쓰기 0.
   v550 부터 폰 하단 5칸에 대시보드가 없어 첫 화면으로 가는 길은 머리의 '현장.'(#hjLogoHome) 하나인데, 그 상자가 55x23 이었다.
   로고 아래 9px 에 [🏗 전체 보기] 칩이 있어 조금만 아래를 누르면 현장 고르기가 열리고, 사이 틈은 아무 반응이 없었다.
   ① 폰 390(모바일 모드): 로고 상자 44x44 이상 · 위 끝 = 머리 위 끝 · 아래 끝 = 검색 줄 위 끝(겹침 0) · 머리 맨 위(2px)와
      검색 줄 바로 위(3px)를 누르면 첫 화면으로 · 칩 가운데는 여전히 칩 (TAP)
   ② 폰 360 · 큰 글씨(a11y-big2) · 데모 띠(#hjDemoBar) 아래에서도 같은 규칙 · 로고 가운데가 띠에 덮이지 않음 (EDGE)
   ③ PC 1280(모바일 모드 아님): 이 규칙이 안 걸림(줄 높이·최소 높이 그대로) · 로고 클릭은 종전대로 첫 화면 (PC)
   ④ 소스·핀 3곳(v558 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V558_BASELINE=<commit> 은 ① 에서, HJ_V558_MUTATION=no-rule(규칙 삭제)·no-margin(위아래 -8px 삭제 → 머리가 19px 커짐)은 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V558_MUTATION || '';
const RULE = '    body.mobile-mode #hjLogoHome{line-height:44px;min-height:44px;min-width:44px;margin:-8px 0}\n';
let html = process.env.HJ_V558_BASELINE ? execFileSync('git', ['show', process.env.HJ_V558_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.ok(['no-rule', 'no-margin'].includes(MUT), 'unknown mutation ' + MUT);
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.equal(html.split(RULE).length, 2, 'mutation needle');
  html = html.replace(RULE, MUT === 'no-rule' ? '' : RULE.replace(';margin:-8px 0', ''));
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS logotap-v558 ' + name); }
async function open({ width, mobile }) {
  const context = await browser.newContext(mobile
    ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' }
    : { viewport: { width, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.addInitScript(mobile => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('pref_mobile', mobile ? '1' : '0');
    window.confirm = () => true; window.alert = () => {}; window.prompt = () => null;
  }, !!mobile);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false;
    try { closeModal(true); } catch (_) {}
    __mobileMode = !!mobile; applyMobileMode();
    state.tab = 'photos'; state.activeProject = null; render(); try { syncMobileNav(); } catch (_) {}
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const geo = page => page.evaluate(() => {
  const R = sel => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const lg = document.getElementById('hjLogoHome'), cs = getComputedStyle(lg);
  return { header: R('header'), logo: R('#hjLogoHome'), hsearch: R('header .hsearch'), chip: R('#projChip'), bar: R('#hjDemoBar'), lineHeight: cs.lineHeight, minHeight: cs.minHeight, vw: innerWidth };
});
const hit = (page, x, y) => page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !el ? 'none' : el.closest('#hjLogoHome') ? 'logo' : el.closest('#projChip') ? 'chip' : (el.id || el.tagName.toLowerCase()); }, [x, y]);
async function phoneRules(page, label) {
  const g = await geo(page);
  assert.ok(g.logo.h >= 44 - 0.5 && g.logo.w >= 44 - 0.5, label + ': 로고 상자 44x44 이상 — ' + JSON.stringify(g.logo));
  assert.ok(Math.abs(g.logo.t - g.header.t) <= 1, label + ': 로고 위 끝 = 머리 위 끝(머리 위 여백을 누르는 곳으로) — logo ' + g.logo.t + ' header ' + g.header.t);
  assert.ok(Math.abs(g.logo.b - g.hsearch.t) <= 1, label + ': 로고 아래 끝 = 검색 줄 위 끝 — logo ' + g.logo.b + ' hsearch ' + g.hsearch.t);
  assert.ok(g.logo.b <= g.chip.t + 0.5, label + ': [전체 보기] 칩과 겹치지 않음');
  const cx = g.logo.l + g.logo.w / 2;
  assert.equal(await hit(page, cx, g.header.t + 2), 'logo', label + ': 머리 맨 위(2px)는 로고');
  assert.equal(await hit(page, cx, g.chip.t - 3), 'logo', label + ': 검색 줄 바로 위(3px)는 로고');
  assert.equal(await hit(page, g.chip.l + g.chip.w / 2, g.chip.t + g.chip.h / 2), 'chip', label + ': 칩 가운데는 칩');
  return g;
}

(async () => {
  browser = await chromium.launch();
  try {
    await test('① 폰 390: 로고 44x44 · 머리 위 끝~검색 줄 위 끝 · 위/아래 가장자리 눌러 첫 화면 · 칩 그대로 (TAP)', async () => {
      const { context, page } = await open({ width: 390, mobile: true });
      const g = await phoneRules(page, '390');
      const cx = g.logo.l + g.logo.w / 2;
      await page.touchscreen.tap(cx, g.chip.t - 3);
      await page.waitForFunction(() => state.tab === 'dashboard');
      await page.evaluate(() => { state.tab = 'photos'; render(); });
      await page.touchscreen.tap(cx, g.header.t + 2);
      await page.waitForFunction(() => state.tab === 'dashboard');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '390 가로 넘침 없음');
      await context.close();
    });
    await test('② 폰 360 · 큰 글씨(a11y-big2) · 데모 띠 아래에서도 (EDGE)', async () => {
      const { context, page } = await open({ width: 360, mobile: true });
      await phoneRules(page, '360');
      await page.evaluate(() => { document.body.classList.add('a11y-big2'); });
      await phoneRules(page, '360 큰 글씨');
      await page.evaluate(() => { document.body.classList.remove('a11y-big2'); });
      await page.evaluate(async () => { await loadDemo(); });
      await page.waitForFunction(() => state._demo === true && !!document.getElementById('hjDemoBar'));
      await page.evaluate(() => { state.tab = 'photos'; render(); });
      await page.waitForFunction(() => { const b = document.getElementById('hjDemoBar').getBoundingClientRect(), h = document.querySelector('header').getBoundingClientRect(); return h.top >= b.bottom - 0.5; });
      const g = await phoneRules(page, '360 데모 띠');
      assert.ok(g.logo.t >= g.bar.b - 0.5, '데모 띠 아래에서 시작 — logo ' + g.logo.t + ' bar ' + g.bar.b);
      assert.equal(await hit(page, g.logo.l + g.logo.w / 2, g.logo.t + g.logo.h / 2), 'logo', '로고 가운데는 띠에 안 덮임');
      await context.close();
    });
    await test('③ PC 1280: 규칙이 안 걸림 · 로고 클릭은 종전대로 첫 화면 (PC)', async () => {
      const { context, page } = await open({ width: 1280, mobile: false });
      const g = await geo(page);
      assert.notEqual(g.lineHeight, '44px', 'PC 로고 줄 높이는 종전 그대로');
      assert.notEqual(g.minHeight, '44px', 'PC 로고 최소 높이 없음');
      assert.ok(g.logo.t > g.header.t + 4, 'PC 로고는 머리 위 여백 안쪽(종전 자리)');
      await page.click('#hjLogoHome');
      await page.waitForFunction(() => state.tab === 'dashboard');
      await context.close();
    });
    await test('④ 소스·핀 3곳(v558 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 558, '핀 v558 이상 ' + a);
      assert.ok(src.includes(RULE), '폰 로고 규칙이 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`logotap-v558: ${passed}/4 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL logotap-v558 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

/* v554 데모 고침 4건 + leak.html 칩 — 11/4 수요일 품질 점검(보고\웹앱_테스트_20261104.md)이 찾은 P2. 합성 자료만, 외부 쓰기 0.
   ① 폰 390: 데모 들어가기 직전에 예약된 기기 저장(markDirty → persistLocal 800ms)이 데모 안에서 터져도 '⚠️ 다른 탭이 더 최근에 저장' 띠·__tabStale 이 생기지 않는다 (STALE)
      — 새 기기에서 부팅 시더(taxCalendarEnsure 4.0s·coworkSchedEnsure 4.5s) 직후 [예시 넣기]를 누르면 났던 가짜 경고. 저장 대기 표시(__hjLocalSavePending)도 내린다.
   ② 폰 390·PC 1280: 데모 띠(#hjDemoBar)가 머리(header)를 덮지 않는다 — 머리·로고·검색칸이 띠 아래에서 시작하고 검색칸 가운데를 누르면 검색칸이 눌린다 (HEADER)
   ③ 실제 자료가 있는 기기의 확인창 문구 '가상 현장 N곳' 의 N = HJ_DEMO_PROJECT_COUNT = 데모 시드 현장 수(4) — "3곳"으로 남아 있던 문구 (COUNT)
   ④ 데모 '견적 작성' 2건(시드 현장에 연결) → 견적 협상·유사 견적·계약 검토·공정표 생성이 토스트 대신 창을 연다 · 파일 수 17 그대로(가상 견적 파일 없음) · 토스트에 '견적 작성 2건' (QUOTES)
   ⑤ leak.html 폰 390: 모든 .chip 이 44×44 이상(한 글자 '벽' 칩이 42.9px 였다 — leakintakeweb-v431 의 실패 원인) (CHIP)
   ⑥ 소스·핀 3곳(v554 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V554_BASELINE=<commit> 은 ① 에서, HJ_V554_MUTATION=timer(persistLocal 타이머의 데모 가드 삭제)는 ① 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin, LEAK = new URL('leak.html', APP).href;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V554_MUTATION || '';
let html = process.env.HJ_V554_BASELINE ? execFileSync('git', ['show', process.env.HJ_V554_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'timer');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "    if(state._demo){__hjLocalSavePending=false;return;}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS demofix-v554 ' + name); }
async function open({ width, mobile, real }) {
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
  await page.addInitScript(mobile => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('pref_mobile', mobile ? '1' : '0');
    window.__toasts = []; window.__confirms = []; window.confirm = m => { window.__confirms.push(String(m)); return false; }; window.alert = () => {}; window.prompt = () => null;
  }, !!mobile);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, real }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false;
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;   // 시더는 ① 에서 markDirty 로 대신 재현한다
    try { closeModal(true); } catch (_) {}
    const realToast = toast; window.toast = m => { window.__toasts.push(String(m)); return realToast(m); };
    __mobileMode = !!mobile; applyMobileMode();
    if (real) state.projects.push({ name: 'T554 실제 현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    clearTimeout(__idbSaveTimer); __hjLocalSavePending = false;
    state.tab = 'dashboard'; render(); syncMobileNav();
  }, { keys: BOOT, mobile: !!mobile, real: !!real });
  return { context, page };
}
const headerState = page => page.evaluate(() => {
  const bar = document.getElementById('hjDemoBar'), warn = document.getElementById('hjTabWarn'), header = document.querySelector('header');
  const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
  const inp = document.getElementById('globalSearch'), ir = inp.getBoundingClientRect();
  const hit = document.elementFromPoint((ir.left + ir.right) / 2, (ir.top + ir.bottom) / 2);
  const logo = document.getElementById('hjLogoHome'), lr = logo.getBoundingClientRect();
  const lhit = document.elementFromPoint((lr.left + lr.right) / 2, (lr.top + lr.bottom) / 2);
  return { bar: bar ? r(bar) : null, warn: warn ? r(warn) : null, header: r(header), input: r(inp), searchHit: hit === inp, logoHit: !!(lhit && (lhit === logo || logo.contains(lhit))),
    stale: !!__tabStale, pending: !!__hjLocalSavePending, scrollY: window.scrollY, over: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth };
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page: ph } = await open({ width: 390, mobile: true });

  await test('① 데모 직전 예약된 기기 저장이 데모 안에서 터져도 가짜 \'다른 탭\' 띠·__tabStale 없음 (STALE)', async () => {
    // (a) 타이머가 데모 안에서 실행되는 경우 — 시더가 markDirty 한 직후 데모에 들어간 모양 그대로(타이머 800ms 는 지우지 않고 _demo 만 먼저 켠다)
    let r = await ph.evaluate(async () => {
      markDirty(); const pending = !!__hjLocalSavePending && !!__idbSaveTimer; state._demo = true;
      await new Promise(res => setTimeout(res, 1400));
      const out = { pending, stale: !!__tabStale, warn: !!document.getElementById('hjTabWarn'), savePending: !!__hjLocalSavePending };
      state._demo = false; return out;
    });
    assert(r.pending, 'markDirty schedules a local save');
    assert.deepEqual([r.stale, r.warn, r.savePending], [false, false, false], 'timer in demo: ' + JSON.stringify(r));
    // (b) 실제 길 — markDirty 직후 loadDemo (빈 자료 분기)
    r = await ph.evaluate(async () => { markDirty(); const ok = await loadDemo(); render(); await new Promise(res => setTimeout(res, 1400)); return { ok, demo: !!state._demo, stale: !!__tabStale, warn: !!document.getElementById('hjTabWarn'), savePending: !!__hjLocalSavePending, toasts: window.__toasts.filter(t => /다른 탭/.test(t)) }; });
    assert.deepEqual([r.ok, r.demo, r.stale, r.warn, r.savePending, r.toasts], [true, true, false, false, false, []], 'loadDemo: ' + JSON.stringify(r));
  });

  await test('② 데모 띠가 머리를 덮지 않음 — 폰 390 · PC 1280 (HEADER)', async () => {
    let r = await headerState(ph);
    assert(r.bar && r.bar.bottom > 0, 'demo bar shown');
    assert(r.header.top >= r.bar.bottom - 1, 'phone: header starts below the bar ' + JSON.stringify(r));
    assert(r.input.top >= r.bar.bottom - 1 && r.searchHit && r.logoHit, 'phone: search box and logo reachable ' + JSON.stringify(r));
    assert.equal(r.over, 0, 'phone: no horizontal overflow');
    // 아래로 내려도 머리는 띠 아래에 붙는다(sticky top)
    await ph.evaluate(() => window.scrollTo(0, 600)); await ph.waitForTimeout(150);
    r = await headerState(ph);
    assert(r.scrollY > 0 && r.header.top >= r.bar.bottom - 1 && r.searchHit, 'phone scrolled: header sticks below the bar ' + JSON.stringify(r));
    const { page: pc } = await open({ width: 1280, mobile: false });
    await pc.evaluate(async () => { await loadDemo(); render(); });
    r = await headerState(pc);
    assert(r.bar && r.header.top >= r.bar.bottom - 1 && r.input.top >= r.bar.bottom - 1 && r.searchHit && r.logoHit, 'PC: header below the bar ' + JSON.stringify(r));
    assert.equal(r.over, 0, 'PC: no horizontal overflow');
  });

  await test('③ 확인창 문구 \'가상 현장 N곳\' = HJ_DEMO_PROJECT_COUNT = 시드 현장 수 (COUNT)', async () => {
    const n = await ph.evaluate(() => state.projects.length);
    const { page: pr } = await open({ width: 390, mobile: true, real: true });
    const r = await pr.evaluate(async () => { const ok = await loadDemo(); return { ok, demo: !!state._demo, projects: state.projects.map(p => p.name), confirms: window.__confirms, N: HJ_DEMO_PROJECT_COUNT }; });
    assert.deepEqual([r.ok, r.demo, r.projects, r.confirms.length], [false, false, ['T554 실제 현장'], 1], 'real data: confirm shown and cancelled ' + JSON.stringify(r));
    assert.equal(r.N, n, 'HJ_DEMO_PROJECT_COUNT equals the seeded demo project count');
    assert(r.confirms[0].includes('가상 현장 ' + n + '곳') && !r.confirms[0].includes('3곳'), 'confirm text: ' + r.confirms[0]);
  });

  await test('④ 데모 견적 작성 2건 → 협상·유사 견적·계약 검토·공정표가 창을 연다 · 파일 17 (QUOTES)', async () => {
    const r = await ph.evaluate(() => ({ quotes: (state.quotes || []).map(q => ({ project: q.project, items: q.items.length, total: quoteCalc(q).total })), projects: state.projects.map(p => p.name), files: state.files.length, virtual: state.files.filter(f => f._fromQuote).length, toast: window.__toasts.find(t => /데모 데이터 로드됨/.test(t)) || '' }));
    assert.equal(r.quotes.length, 2, 'two demo quotes'); assert(r.quotes.every(q => r.projects.includes(q.project) && q.items >= 3 && q.total > 0), JSON.stringify(r.quotes));
    assert.equal(r.quotes[0].total, 8500000, '성수동 quote matches the PDF estimate amount');
    assert.deepEqual([r.files, r.virtual], [17, 0], 'no virtual quote files (demo file count unchanged)');
    assert.match(r.toast, /현장 4곳 · 파일 17개 · 팀 보고 3건 · 영수증 2장 · 견적 작성 2건/, r.toast);
    for (const [action, title] of [['negotiate', /견적 협상/], ['similarquotes', /유사 견적|비슷한 견적/], ['contractreview', /계약서 위험 검토|계약 검토/], ['scheduleplan', /공정표/]]) {
      const got = await ph.evaluate(async a => { window.__toasts.length = 0; await Promise.race([moreDispatch(a), new Promise(res => setTimeout(res, 5000))]); await new Promise(res => setTimeout(res, 250)); const h = document.querySelector('#modalRoot .modal h3'); const t = h ? h.textContent : ''; const tx = window.__toasts.slice(); closeModal(true); return { title: t, toasts: tx }; }, action);
      assert(title.test(got.title) && !got.toasts.some(t => /견적(이|을) (없|작성)|필요해요/.test(t)), action + ': ' + JSON.stringify(got));
    }
    await ph.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
  });

  await test('⑤ leak.html 폰 390: .chip 전부 44×44 이상 (CHIP)', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
    await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN && route.request().method() === 'GET' ? route.continue() : route.abort('blockedbyclient'));
    await page.goto(LEAK, { waitUntil: 'load' }); await page.waitForTimeout(300);
    const small = await page.evaluate(() => [...document.querySelectorAll('.chip')].filter(n => n.getClientRects().length).map(n => { const r = n.getBoundingClientRect(); return { t: n.textContent.trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter(x => x.w < 44 || x.h < 44));
    const total = await page.evaluate(() => document.querySelectorAll('.chip').length);
    assert(total > 10, 'chips rendered ' + total); assert.deepEqual(small, [], 'chips under 44px: ' + JSON.stringify(small));
  });

  await test('⑥ 소스·핀 3곳(v554 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('const HJ_DEMO_PROJECT_COUNT=') && src.includes('function hjTopBarsSync()') && src.includes('clearTimeout(__idbSaveTimer);__hjLocalSavePending=false;   // v554'), 'v554 source markers');
    assert(fs.readFileSync(path.join(ROOT, 'leak.css'), 'utf8').includes('.chip{min-height:44px;min-width:44px;'), 'leak.css chip min-width');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 554, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('demofix-v554: ' + passed + '/6 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL demofix-v554', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

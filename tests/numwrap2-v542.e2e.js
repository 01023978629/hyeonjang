/* v542 폰에서 숫자가 중간에서 끊기지 않게 2차 — 대표 PDF 2번(대시보드 KPI·현장 카드 금액·마진 요약, 390px). 합성(데모) 자료만, 외부 쓰기 0.
   데모 금액을 37배로 키워(7자리 '123,580만원') 좁은 폰에서 일부러 빠듯하게 만든다.
   ① 첫 화면 숫자 칸(.kpis): 360·390·1280 에서 숫자와 '만원' 이 한 줄 · 넘침 없음 · PC 는 26px 그대로, 폰은 칸 폭에 맞춰 조금만 줄어듦(clamp 18px, 글꼴이 넓으면 v547 맞춤이 14px 까지)
      · 다른 화면의 flex 줄 .kpi(아파트 관리)는 영향 없음 (DASH_KPI)
   ② 연락처 전화번호는 '-' 에서 안 끊김(360·390) · 번호 글자는 그대로 보임(태그가 들어 있어도 글자) (PHONE)
   ③ 월말 결산 글(#mcText)의 금액이 360 에서 안 끊김 (CLOSING)
   ④ 전수: 360·390 에서 탭 9개·데모 현장 4곳·돈 창 11개를 돌며 금액·시간·퍼센트 덩어리가 줄 중간에서 끊긴 곳 0(파일 이름 칸 제외) (SCAN)
   ⑤ 소스·핀 3곳(v542 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V542_BASELINE=<commit> 은 ① 에서, HJ_V542_MUTATION=no-scale(숫자 칸 글자 맞춤을 빼면)도 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V542_MUTATION || '';
let html = process.env.HJ_V542_BASELINE ? execFileSync('git', ['show', process.env.HJ_V542_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-scale');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '.kpis>.kpi .kv{font-size:clamp(18px,17.5cqi,26px);';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '.kpis>.kpi .kv{');
  // v547 부터는 그린 뒤 맞춤(hjKpiFit)도 있다 — 변이는 둘 다 빼야 의미가 있다
  const fit = "  if(state.tab==='dashboard')hjKpiFit(v);   // v547 숫자 칸 한 줄 맞춤\n";
  if (html.includes(fit)) html = html.replace(fit, '');
}
const TABS = ['dashboard', 'estimates', 'ledger', 'schedule', 'photos', 'docs', 'contacts', 'quotemaker', 'aptmgmt'];
const MODALS = [['월말 결산', 'monthlyClosing()'], ['월별 손익', 'pnl()'], ['매출 추이', 'revenueTrend()'], ['매출 목표', 'goalManage()'], ['매출 예측', 'salesForecast()'], ['마진 점검', 'lossAlert()'], ['현금 흐름', 'cashFlow()'], ['마진 보드', 'hjMarginBoardView()'], ['수금 이력', 'payHistoryView()'], ['작업시간', 'workView()'], ['지출 장부', 'expenseLedger(localDate().slice(0,7))']];

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openDemo(width) {
  const mobile = width < 600;
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(width + ': ' + String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    await loadDemo();
    // 금액을 37배로 — 7자리 '만원' 이 되어 좁은 칸에서 빠듯해진다(데모는 저장되지 않는다)
    const K = /amount|total|price|received|paid|cost|sum|material|labor|outsource|budget|supply|vat|deposit|balance|contract/i;
    const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 6) return; for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'number' && v >= 1000 && K.test(k)) o[k] = Math.round(v * 37); else if (typeof v === 'object') walk(v, d + 1); } };
    walk(state, 0); state.tab = 'dashboard'; state.activeProject = null; render();
  }, { keys: BOOT, mobile });
  return { context, page };
}
// 숫자 덩어리(금액·시간·퍼센트·3자리 이상)가 줄 중간에서 갈린 곳 — 글자 범위의 줄 상자 위치로 잰다
const SPLITS = page => page.evaluate(() => {
  const RE = /[-+]?(?:₩\s?)?\d[\d,.]*\s?(?:만\s?원|천\s?원|억|원|%|시간|분|일|건|곳|장|개|평|㎡|명)?/g, out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.TEXT_NODE); let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement; if (!el || el.closest('.nm,script,style,noscript,[hidden]')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || (!el.offsetParent && cs.position !== 'fixed')) continue;
    const s = n.nodeValue; RE.lastIndex = 0; let m;
    while ((m = RE.exec(s))) {
      const tok = m[0].trim(); if (tok.replace(/[^\d]/g, '').length < 3 && !/[원%]|시간|분/.test(tok)) continue;
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const tops = new Set([...r.getClientRects()].filter(x => x.width > 0.5).map(x => Math.round(x.top)));
      if (tops.size > 1) out.push(tok + ' @ ' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60));
    }
  }
  return out;
});
const kpis = page => page.evaluate(() => [...document.querySelectorAll('.kpis>.kpi .kv')].filter(e => e.querySelector('small') && /\d/.test(e.firstChild && e.firstChild.textContent || '') && !/font-size:\s*(13|20)px/.test(e.getAttribute('style') || '')).map(e => {   // v547 숫자 칸(맞춤이 인라인 크기를 줄 수 있다 — 글자 칸·수금 20px 칸만 뺀다)
  const r = e.getBoundingClientRect(), sm = e.querySelector('small'), fs = parseFloat(getComputedStyle(e).fontSize);
  // 한 줄이면 높이 ≈ 글자 크기(줄 높이 1), 두 줄이면 두 배 — 큰 숫자와 작은 '만원' 은 바닥선이 달라 상자 위치로 세면 안 된다
  return { t: e.textContent.trim(), fs, h: Math.round(r.height), lines: r.height > fs * 1.5 ? 2 : 1, over: e.scrollWidth > e.clientWidth + 1, unitSame: !sm || Math.abs(sm.getBoundingClientRect().bottom - r.bottom) < fs * 0.6 };
}));
async function test(name, fn) { await fn(); passed++; console.log('PASS numwrap2-v542 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const pages = {};
  for (const w of [360, 390, 1280]) pages[w] = (await openDemo(w)).page;

  await test("① 첫 화면 숫자 칸 — 360·390·1280 에서 숫자와 '만원' 한 줄 · 넘침 없음 · PC 26px · 폰 18px 이상 · 다른 .kpi 는 그대로 (DASH_KPI)", async () => {
    for (const w of [360, 390, 1280]) {
      const k = await kpis(pages[w]);
      assert(k.length >= 3 && k.some(x => /\d{3},\d{3}만원/.test(x.t)), w + ' seven digit KPI present ' + JSON.stringify(k));
      for (const x of k) {
        assert.equal(x.lines, 1, w + 'px KPI on one line: ' + JSON.stringify(x));
        assert(!x.over && x.unitSame, w + 'px KPI fits with its unit: ' + JSON.stringify(x));
        assert(x.fs >= 14 && x.fs <= 26, w + 'px KPI font ' + x.fs);   // v547 글꼴이 넓으면 맞춤이 14px 까지 줄인다
        if (w === 1280) assert.equal(x.fs, 26, 'PC keeps 26px');
      }
    }
    await shot(pages[360], 'v542-phone360-kpi');
    // flex 줄에 쓰인 .kpi(아파트 관리 화면)는 글자 폭대로 — 칸 맞춤(container)이 새지 않는다
    const flexKpi = await pages[390].evaluate(() => { const g = document.createElement('div'); g.className = 'grid'; g.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'; g.innerHTML = '<div class="kpi"><span class="kl">단지</span><span class="kv">12<small>곳</small></span></div>'; document.getElementById('view').appendChild(g); const k = g.firstChild, w = Math.round(k.getBoundingClientRect().width), ct = getComputedStyle(k).containerType; g.remove(); return { w, ct }; });
    assert(flexKpi.w > 60 && flexKpi.ct === 'normal', 'flex .kpi untouched ' + JSON.stringify(flexKpi));
  });

  await test("② 연락처 전화번호 — '-' 에서 안 끊김 · 글자 그대로(태그도 글자) (PHONE)", async () => {
    for (const w of [360, 390]) {
      const page = pages[w];
      await page.evaluate(() => { state.contacts = state.contacts || []; state.contacts.push({ id: 'v542c', name: 'TEST 연락처 아주 긴 이름의 거래처 담당자', phone: '010-1234-5678', tel: '02-555-7777', email: 'test-v542@example.invalid', memo: '' }, { id: 'v542x', name: 'TEST 태그', phone: '<b>010-0000-0000</b>', tel: '', email: '', memo: '' }); state.tab = 'contacts'; render(); });
      const r = await page.evaluate(() => {
        const split = []; document.querySelectorAll('#view .ci span.hj-nw').forEach(s => { const g = document.createRange(); g.selectNodeContents(s); const tops = new Set([...g.getClientRects()].filter(x => x.width > 0.5).map(x => Math.round(x.top))); if (tops.size > 1) split.push(s.textContent); });
        const nw = [...document.querySelectorAll('#view .ci span.hj-nw')].map(s => s.textContent);
        return { split, nw, bold: !![...document.querySelectorAll('#view .ci b')].find(b => b.textContent === '010-0000-0000'), raw: [...document.querySelectorAll('#view .ci')].some(c => c.textContent.includes('<b>010-0000-0000</b>')) };
      });
      assert(r.nw.includes('010-1234-5678') && r.nw.includes('02-555-7777'), w + ' phones wrapped as one piece ' + JSON.stringify(r.nw));
      assert.deepEqual(r.split, [], w + ' no phone split');
      assert(!r.bold && r.raw, 'phone text is escaped, not markup ' + JSON.stringify(r));
      assert.deepEqual((await SPLITS(page)).filter(x => /\d{2,3}-\d{3,4}/.test(x)), [], w + ' contacts tab');
      await page.evaluate(() => { state.contacts = state.contacts.filter(c => !/^v542/.test(c.id)); state.tab = 'dashboard'; render(); });
    }
  });

  await test('③ 월말 결산 글 — 360 에서 금액 안 끊김 (CLOSING)', async () => {
    const page = pages[360];
    await page.evaluate(() => monthlyClosing()); await page.locator('#mcText').waitFor();
    const bad = (await SPLITS(page)).filter(x => /원/.test(x));
    assert.deepEqual(bad, [], 'closing text');
    await page.evaluate(() => closeModal(true));
  });

  await test('④ 전수 — 360·390 탭 9개 · 데모 현장 4곳 · 돈 창 11개: 숫자 덩어리 줄 중간 끊김 0 (SCAN)', async () => {
    for (const w of [360, 390]) {
      const page = pages[w], found = [];
      const go = async (tab, pj) => { await page.evaluate(({ tab, pj }) => { closeModal(true); state.tab = tab; state.activeProject = pj || null; render(); }, { tab, pj }); await page.waitForTimeout(250); };
      for (const tab of TABS) { await go(tab); (await SPLITS(page)).forEach(x => found.push(tab + ': ' + x)); }
      for (const pj of await page.evaluate(() => state.projects.map(p => p.name))) { await go('project', pj); (await SPLITS(page)).forEach(x => found.push('현장 ' + pj + ': ' + x)); }
      for (const [label, js] of MODALS) {
        await go('dashboard');
        await page.evaluate(js => { try { const r = (0, eval)(js); return r && r.then ? r.catch(() => 0) : r; } catch (e) { return 0; } }, js);
        await page.waitForTimeout(450);
        (await SPLITS(page)).forEach(x => found.push(label + ': ' + x));
      }
      await go('dashboard');
      assert.deepEqual(found, [], w + 'px split numbers');
    }
  });

  await test('⑤ 소스·핀 3곳(v542 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 542, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('numwrap2-v542: ' + passed + '/5 PASS; synthetic demo data (amounts x37); external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL numwrap2-v542', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

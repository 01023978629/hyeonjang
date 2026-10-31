/* v544 📄 견적 빠른 배정 — 현장 없는 견적서·다른 업체 이름이 붙은 견적(매입·비교 후보)을 견적 탭 위 한 창에서(대표 PDF 4번). 합성 자료만, 외부 쓰기 0.
   ① 대상·추정: 현장 없음 6묶음 + 업체 이름 1건이 대상, 매입·집계 제외·앱 견적·서류 기록은 빠짐 · 엑셀·PDF 사본은 한 줄(사본 1건 함께)
      · 추정 3점(현장 이름 그대로)·2점(아파트 단지)·1점(이름 낱말)·같은 점수 두 현장은 추정 안 함 · 미리 체크는 업체 이름 없고 2점 이상만 · 여는 것만으론 자료 불변 (PLAN)
   ② 적용: 체크한 줄만 · 안전판 1회 · 사본까지 같은 현장 · 매입은 매출에서 빠지고 외주 지출 1번 · 비교는 집계 제외 · 다시 적용해도 지출이 두 번 안 생김 (APPLY)
   ③ 안전판을 못 만들면 아무것도 안 바뀜 · 창을 연 뒤 다른 곳에서 바뀌면 거부 · 바꿀 게 없으면 안전판도 안 만듦 (GUARD)
   ④ 견적 탭 위 줄(현장 없는 n건 · 업체 후보 m건 · [빠른 배정] 44px) · 폰 390 창 가로 넘침 없음 · 단추·체크 44px (UI)
   ⑤ 소스·핀 3곳(v544 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V544_BASELINE=<commit> 은 ① 에서, HJ_V544_MUTATION=rep-only(사본은 그대로 두고 대표 파일만 현장 연결)는 ② 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V544_MUTATION || '';
let html = process.env.HJ_V544_BASELINE ? execFileSync('git', ['show', process.env.HJ_V544_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'rep-only');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(s.project&&members.some(m=>(m.project||'')!==s.project)){members.forEach(m=>{m.project=s.project;});linked++;}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "if(s.project&&members.some(m=>(m.project||'')!==s.project)){g.rep.project=s.project;linked++;}");
}
// 합성 현장(실제 고객 아님)
const P1 = 'TEST 가온아파트 101동 1203호', P2 = 'TEST 나래빌라 3층', P3 = 'TEST 다솜상가 1층', P4 = 'TEST 다솜상가 2층';
const SEED = { projects: [P1, P2, P3, P4], files: [
  // ① 현장 이름 그대로(3점) — 엑셀·PDF 사본 한 묶음
  { k: 'a', name: 'TEST 가온아파트 101동 1203호 욕실 견적.xlsx', amount: 3300000, date: '2026-10-02' },
  { k: 'a2', name: 'TEST 가온아파트 101동 1203호 욕실 견적.pdf', ext: 'pdf', amount: 3300000, date: '2026-10-02' },
  // ② 아파트 단지 이름(2점)
  { k: 'b', name: '가온아파트 주방 상부장 견적.xlsx', amount: 1800000, date: '2026-10-05' },
  // ③ 이름 낱말(1점) — 추정은 하되 미리 체크 안 함
  { k: 'c', name: '나래빌라 도배 견적.xlsx', amount: 900000, date: '2026-10-06' },
  // ④ 단서 없음
  { k: 'd', name: '견적서(최종).xlsx', amount: 2500000, date: '2026-10-07' },
  // ⑤ 같은 점수 두 현장(다솜상가 1층·2층) — 추정 안 함
  { k: 'e', name: '다솜상가 전기 견적.xlsx', amount: 700000, date: '2026-10-08' },
  // ⑥ 다른 업체 이름 + 현장 있음 → 매입·비교 후보
  { k: 'f', name: '나래빌라 욕실 작업-용진인테리어.xlsx', amount: 1200000, date: '2026-10-09', project: P2 },
  // ⑦ 다른 업체 이름 + 현장 없음
  { k: 'g', name: '다솜상가 비교 견적-태산인테리어.xlsx', amount: 5000000, date: '2026-10-10' },
  // 대상 아님: 이미 매입·집계 제외·앱 견적·우리 상호
  { k: 'x1', name: '이미 매입-용진인테리어.xlsx', amount: 400000, date: '2026-10-11', project: P1, purchase: true },
  { k: 'x2', name: '초안 견적.xlsx', amount: 100000, date: '2026-10-11', exSum: true },
  { k: 'x3', name: '앱 견적', amount: 600000, date: '2026-10-11', fromQuote: true },
  { k: 'x4', name: 'TEST 가온아파트 101동 1203호 거실 견적-만물인테리어.xlsx', amount: 2000000, date: '2026-10-12', project: P1 }
] };

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open(width) {
  const mobile = width < 600;
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.evaluate(async ({ keys, mobile, seed }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    seed.projects.forEach(name => state.projects.push({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }));
    window.__ids = {};
    seed.files.forEach(s => {
      const id = 'v544_' + s.k; window.__ids[s.k] = id;
      const f = { id, name: s.name, ext: s.ext || 'xlsx', kind: 'estimate', project: s.project || '', prefix: '견적서/', size: 2048, when: Date.parse(s.date + 'T10:00:00+09:00'), handle: null, _file: null, thumb: null, text: '', ocr: 'done', lat: null, lng: null, place: null, address: null, contact: null, est: { amount: s.amount, date: s.date } };
      if (s.purchase) { f.est.purchase = true; f.est.purchaseKey = 'estpurchase:' + id; }
      if (s.exSum) f.exSum = true;
      if (s.fromQuote) { f._fromQuote = true; f.id = 'quote_v544'; window.__ids[s.k] = f.id; }
      state.files.push(f);
    });
    state.tab = 'estimates'; state.activeProject = null; render();
  }, { keys: BOOT, mobile, seed: SEED });
  return { context, page };
}
const data = page => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
const files = page => page.evaluate(() => Object.fromEntries(Object.entries(window.__ids).map(([k, id]) => { const f = state.files.find(x => x.id === id) || {}; return [k, { project: f.project || '', purchase: !!(f.est && f.est.purchase), exSum: !!f.exSum }]; })));
const snapCount = page => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).filter(s => /견적 빠른 배정 전/.test(s.label || '')).length);
async function test(name, fn) { await fn(); passed++; console.log('PASS estassign-v544 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' });   // 화면 모음엔 안내 토스트를 빼고 }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open(1280);

  await test('① 대상·추정·미리 체크 · 사본 한 줄 · 여는 것만으론 자료 불변 (PLAN)', async () => {
    const before = await data(page);
    const plan = await page.evaluate(() => hjEstAssignPlan().map(r => ({ k: Object.keys(window.__ids).find(k => window.__ids[k] === r.id), guess: r.guess, why: r.why, check: r.check, copies: r.copies, vendor: r.vendor, kind: r.kind, project: r.project })));
    const by = Object.fromEntries(plan.map(r => [r.k, r]));
    assert.deepEqual(Object.keys(by).sort(), ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'targets ' + JSON.stringify(plan));
    assert.equal(by.a.copies, 1, 'xlsx·pdf copies are one row'); assert.equal(by.a.guess, P1); assert.equal(by.a.check, true); assert.match(by.a.why, /그대로/);
    assert.equal(by.b.guess, P1); assert.equal(by.b.check, true); assert.match(by.b.why, /단지 이름/);
    assert.equal(by.c.guess, P2); assert.equal(by.c.check, false, 'one-word match is a suggestion only'); assert.match(by.c.why, /낱말/);
    assert.equal(by.d.guess, ''); assert.equal(by.d.check, false);
    assert.equal(by.e.guess, ''); assert.match(by.e.why, /2곳이 같은 점수/); assert.equal(by.e.check, false);
    assert.equal(by.f.vendor, '용진인테리어'); assert.equal(by.f.project, P2); assert.equal(by.f.check, false); assert.equal(by.f.kind, 'purchase');
    assert.equal(by.g.vendor, '태산인테리어'); assert.equal(by.g.check, false);
    await page.evaluate(() => hjEstAssignView()); await page.locator('#hjEstAssign [data-ea-row]').first().waitFor();
    assert.equal(await page.locator('#hjEstAssign [data-ea-row]').count(), 7);
    assert.equal(await data(page), before, 'opening the plan and the window changes nothing');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 체크한 줄만 · 안전판 1회 · 사본까지 · 매입 외주비 1번 · 비교 집계 제외 · 다시 해도 지출 한 번 (APPLY)', async () => {
    const est0 = await page.evaluate(n => projStats(n).est, P2);
    await page.evaluate(() => hjEstAssignView()); await page.locator('#hjEstAssign [data-ea-row]').first().waitFor();
    const row = k => page.locator('#hjEstAssign [data-ea-row="' + 'v544_' + k + '"]');
    await row('d').locator('[data-ea-project]').selectOption(P3);   // 고르면 체크됨
    await row('f').locator('[data-ea-check]').check();               // 매입(기본)
    await row('g').locator('[data-ea-project]').selectOption(P4); await row('g').locator('[data-ea-kind]').selectOption('compare');
    assert.equal(await row('d').locator('[data-ea-check]').isChecked(), true, 'choosing a project checks the row');
    const s0 = await snapCount(page);
    await page.locator('#modalRoot .mfoot button', { hasText: '체크한 줄 적용' }).click();
    await page.waitForFunction(() => !document.getElementById('hjEstAssign'));
    assert.equal(await snapCount(page) - s0, 1, 'one snapshot');
    const f = await files(page);
    assert.deepEqual([f.a.project, f.a2.project, f.b.project, f.d.project], [P1, P1, P1, P3], 'checked rows linked (copies too) ' + JSON.stringify(f));
    assert.equal(f.c.project, '', 'unchecked suggestion untouched'); assert.equal(f.e.project, '', 'tie untouched');
    assert.deepEqual([f.f.purchase, f.f.project], [true, P2]); assert.deepEqual([f.g.exSum, f.g.project, f.g.purchase], [true, P4, false]);
    const r = await page.evaluate(({ p2 }) => ({ exp: (state.expenses || []).filter(x => x.category === '외주' && x.project === p2).map(x => [x.amount, x.vendor]), est2: projStats(p2).est }), { p2: P2 });
    assert.deepEqual(r.exp, [[1200000, '용진인테리어']], 'one outsource expense');
    assert.equal(r.est2, est0 - 1200000, 'purchase quote leaves P2 sales');
    // 같은 견적을 다시 매입으로(되돌렸다가 다시) — 지출은 한 번
    await page.evaluate(id => { const x = state.files.find(y => y.id === id); delete x.est.purchase; delete x.est.purchaseKey; }, 'v544_f');
    const plan = await page.evaluate(() => hjEstAssignPlan().reduce((o, r) => { o[r.id] = r.sig; return o; }, {}));
    await page.evaluate(seen => hjEstAssignApply([{ id: 'v544_f', project: '', kind: 'purchase' }], seen), plan);
    assert.equal(await page.evaluate(p2 => (state.expenses || []).filter(x => x.category === '외주' && x.project === p2).length, P2), 1, 'no second expense');
  });

  await test('③ 안전판 실패 무변경 · 연 뒤 바뀌면 거부 · 바꿀 게 없으면 안전판도 없음 (GUARD)', async () => {
    const seen = await page.evaluate(() => hjEstAssignPlan().reduce((o, r) => { o[r.id] = r.sig; return o; }, {}));
    let before = await data(page);
    await page.evaluate(() => { window.__snapReal = hjSnapshot; hjSnapshot = async () => false; });
    const r1 = await page.evaluate(seen => hjEstAssignApply([{ id: 'v544_c', project: 'TEST 나래빌라 3층', kind: 'sale' }], seen), seen);
    await page.evaluate(() => { hjSnapshot = window.__snapReal; });
    assert.equal(r1.오류, '안전판'); assert.equal(await data(page), before, 'snapshot failure changes nothing');
    await page.evaluate(() => { state.files.find(x => x.id === 'v544_c').project = 'TEST 다솜상가 1층'; });
    before = await data(page);
    const s0 = await snapCount(page);
    const r2 = await page.evaluate(seen => hjEstAssignApply([{ id: 'v544_c', project: 'TEST 나래빌라 3층', kind: 'sale' }], seen), seen);
    assert.equal(r2.오류, '바뀜'); assert.equal(await data(page), before, 'stale plan changes nothing'); assert.equal(await snapCount(page), s0, 'no snapshot for a refused apply');
    const seen2 = await page.evaluate(() => hjEstAssignPlan().reduce((o, r) => { o[r.id] = r.sig; return o; }, {}));
    const r3 = await page.evaluate(seen => hjEstAssignApply([{ id: 'v544_e', project: '', kind: 'sale' }], seen), seen2);
    assert.equal(r3.적용, 0); assert.equal(await snapCount(page), s0, 'nothing to change → no snapshot');
  });

  await test('④ 견적 탭 위 줄 · 폰 390 창 넘침 없음 · 44px (UI)', async () => {
    const bar = await page.evaluate(() => { state.tab = 'estimates'; render(); const b = document.querySelector('#view [data-est-assign-bar]'); return b ? { t: b.textContent.replace(/\s+/g, ' '), h: Math.round(b.querySelector('[data-est-assign]').getBoundingClientRect().height) } : null; });
    assert(bar && /현장 없는 견적서 \d+건/.test(bar.t) && bar.h >= 44, 'bar ' + JSON.stringify(bar));
    await shot(page, 'v544-pc-estimates-bar');
    const { page: pm } = await open(390);
    await pm.locator('#view [data-est-assign]').click(); await pm.locator('#hjEstAssign [data-ea-row]').first().waitFor();
    const ui = await pm.evaluate(() => ({ sw: document.querySelector('#modalRoot .modal').scrollWidth - document.querySelector('#modalRoot .modal').clientWidth, doc: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#hjEstAssign input[type=checkbox],#hjEstAssign select,#modalRoot .mfoot button')].map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44) }));
    assert(ui.sw <= 1 && ui.doc <= 0, 'no horizontal overflow ' + JSON.stringify(ui)); assert.deepEqual(ui.small, [], '44px controls');
    await shot(pm, 'v544-phone-estassign');
  });

  await test('⑤ 소스·핀 3곳(v544 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('${hjEstAssignBarHTML()}'), 'estimates tab shows the bar');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 544, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('estassign-v544: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL estassign-v544', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

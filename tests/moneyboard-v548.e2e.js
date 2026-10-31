/* v548 '💼 이번 달 돈 흐름' 보드 — 지출·손익(마진)·증빙 세 칸 + 최근 6개월 수금·지출 막대(대표 PDF 8번). 합성 자료만, 시계 고정(2026-11-15 KST), 외부 쓰기 0.
   ① PC 1280: 수금률 아래·진행 단계 분포 위 · 왼쪽 세 칸 | 오른쪽 막대 · 숫자(지출 60만·손익 +240만·이익률 80%·발행 확인 2건·영수증 없는 지출 2건)
      · 6개월(6~11월) 막대 높이 비례 · 빈 달은 막대 없음 · 눈금 0/100만/200만/300만 · 그리기만으로 자료 불변 (BOARD)
   ② 누르면 있던 창 — 지출 → 지출 장부(60만), 손익 → 월별 손익(+2,400,000), 발행 확인 → 🧾 발행 확인(2건), 영수증 없음 → 세무 자료(2건) — 숫자가 서로 같다 (OPEN)
   ③ 표로 보기(6줄·다시 그려도 펼침 유지) · 달마다 모든 값이 든 풍선말(title) · 막대 굵기 24px 이하 (TABLE)
   ④ 1024 는 세 칸 한 줄 + 막대 아래(250px 이하) · 폰(모바일 모드) 보드 없음 · 폰 폭(360) PC 모드도 숨김 · 모드 바꾸면 바로 숨김 · 기록 없으면 빈 안내 · 어두운 화면 막대색·글자 대비 (FIT)
   ⑤ 소스·핀 3곳(v548 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V548_BASELINE=<commit> 은 ① 에서, HJ_V548_MUTATION=ledger-proof(카드 월 합계 줄을 영수증 없는 지출로 셈)도 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V548_MUTATION || '';
const NOW = '2026-11-15T12:00:00+09:00';
let html = process.env.HJ_V548_BASELINE ? execFileSync('git', ['show', process.env.HJ_V548_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'ledger-proof');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "num(e.amount)>0&&!e._fromLedger&&!(e.src==='receipt'&&hjReceiptFileOf(e))).length;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "num(e.amount)>0&&!(e.src==='receipt'&&hjReceiptFileOf(e))).length;");
}
const GA = 'TEST_V548 가 빌라';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, empty }) {
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
  await page.clock.setFixedTime(new Date(NOW));   // 시계는 멈추고 타이머는 돈다 — 달 경계(CI 1일)와 무관하게
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, empty, ga }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    state.projects.push({ name: ga, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    if (!empty) {
      state.payLog = [
        { id: 'v548_p1', d: '2026-11-03', project: ga, amt: 3000000, method: '계좌이체' },                                   // 발행 확인 대기
        { id: 'v548_p2', d: '2026-10-05', project: ga, amt: 2000000, method: '계좌이체', proof: 'cash', proofAt: '2026-10-06' },  // 발행함
        { id: 'v548_p3', d: '2026-08-10', project: ga, amt: 1000000, method: '카드' },                                       // 카드 — 해당 없음
        { id: 'v548_p4', d: '2026-04-10', project: ga, amt: 500000, method: '현금' }                                         // 6개월 밖이지만 발행 확인 대기
      ];
      const rf = { id: 'v548_rc', name: 'v548_rc.jpg', ext: 'jpg', kind: 'receipt', project: '', prefix: '영수증/', size: 1234, when: new Date('2026-11-07T12:00:00+09:00'), handle: null, _file: null, _virtual: true, thumb: null, text: '', ocr: 'done' };
      state.files.push(rf);
      state.expenses = [
        { id: 'v548_e1', date: '2026-11-04', amount: 400000, category: '자재', method: '카드', memo: '', project: ga, vendor: 'TEST 자재상' },
        { id: 'v548_e2', date: '2026-11-06', amount: 50000, category: '유류', method: '카드', memo: '', project: '', vendor: '' },
        { id: 'v548_e3', date: '2026-11-07', amount: 30000, category: '식대', method: '카드', memo: '', project: '', vendor: 'TEST 식당', src: 'receipt', fileId: 'k:' + fileKey(rf) },
        { id: 'v548_e4', date: '2026-11-28', amount: 120000, category: '기타', method: '카드', memo: '카드 이용내역 자동 반영', _fromLedger: '2026-11' },
        { id: 'v548_e5', date: '2026-09-12', amount: 700000, category: '자재', method: '현금', memo: '', project: ga, vendor: '' },
        { id: 'v548_e6', date: '2026-05-20', amount: 999000, category: '자재', method: '현금', memo: '', project: ga, vendor: '' }
      ];
    }
    __photoCache.key = null; state.tab = 'dashboard'; render();
  }, { keys: BOOT, mobile: !!mobile, empty: !!empty, ga: GA });
  return { context, page };
}
const board = page => page.evaluate(() => {
  const b = document.getElementById('hjMoneyBoard'); if (!b) return null;
  const R = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
  const t = k => { const e = b.querySelector('[data-money="' + k + '"]'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; };
  const svg = b.querySelector('svg.hj-mc-svg'), groups = svg ? [...svg.querySelectorAll('g[data-money-month]')] : [];
  const hgt = sel => groups.map(g => { const p = g.querySelector(sel); return p ? Math.round(p.getBBox().height * 10) / 10 : 0; });
  const prev = b.previousElementSibling, next = b.nextElementSibling;
  return {
    shown: getComputedStyle(b).display !== 'none', tiles: R(b.querySelector('.hj-money-tiles')), chart: R(b.querySelector('.hj-money-chart')), tileTops: [...b.querySelectorAll('.hj-money-tiles>.hj-money-tile')].map(e => Math.round(e.getBoundingClientRect().top)),
    spend: t('spend'), net: t('net'), netCls: (b.querySelector('[data-money="net"]') || {}).className || '', proof: (b.querySelector('[data-money-proof] .hj-mt-v') || {}).textContent || '', issue: t('issue'), noproof: t('noproof'),
    months: groups.map(g => g.dataset.moneyMonth), inc: hgt('.hj-mc-inc'), sp: hgt('.hj-mc-sp'), widths: groups.flatMap(g => [...g.querySelectorAll('path')].map(p => Math.round(p.getBBox().width))),
    ticks: svg ? [...svg.querySelectorAll('.hj-mc-tick')].map(e => e.textContent) : [], aria: svg ? svg.getAttribute('aria-label') : '', svgH: svg ? Math.round(svg.getBoundingClientRect().height) : 0,
    tips: groups.map(g => (g.querySelector('title') || {}).textContent || ''), legend: (b.querySelector('.hj-mc-legend') || {}).textContent || '', empty: (b.querySelector('.hj-money-chart .hint') || {}).textContent || '',
    prev: prev ? prev.className : '', next: next ? next.textContent : '', title: (b.querySelector('#hjMoneyTitle') || {}).textContent || '', over: document.documentElement.scrollWidth - innerWidth
  };
});
const data = page => page.evaluate(() => JSON.stringify({ pay: state.payLog, exp: state.expenses, files: state.files.map(f => [f.id, f.kind, f.project]) }));
const modal = page => page.evaluate(() => (document.getElementById('modalRoot') || {}).innerText || '');
async function test(name, fn) { await fn(); passed++; console.log('PASS moneyboard-v548 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => document.getElementById('hjMoneyBoard').scrollIntoView({ block: 'center' })); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' });   // 화면 모음엔 안내 토스트를 빼고 }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 1280 });

  await test('① PC 1280 — 자리·두 칸·숫자·6개월 막대·눈금·자료 불변 (BOARD)', async () => {
    const r = await board(page);
    assert(r, 'money board on the PC dashboard'); assert.equal(r.shown, true);
    assert.match(r.prev, /ratewrap/, 'right under the collection-rate bar'); assert.match(r.next, /진행 단계 분포/, 'before the stage distribution');
    assert.equal(r.title, '💼 11월 돈 흐름');
    assert(r.chart.left >= r.tiles.right && Math.abs(r.chart.top - r.tiles.top) <= 40, 'tiles left, chart right at 1280 ' + JSON.stringify([r.tiles, r.chart]));
    assert.equal(r.spend, '💳 이번 달 지출 60만원 4건 · 자재 67%');
    assert.equal(r.net, '📈 이번 달 손익(마진) +240만원 수금 300만원 · 이익률 80%'); assert.match(r.netCls, /is-pos/);
    assert.equal(r.proof, '4건 확인'); assert.equal(r.issue, '발행 확인 2건 · 350만원'); assert.equal(r.noproof, '영수증 없는 지출 2건', 'ledger total and receipt-backed rows are not missing proof');
    assert.deepEqual(r.months, ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    assert.deepEqual(r.ticks, ['0', '100만', '200만', '300만']);
    const [jun, jul, aug, sep, oct, nov] = r.inc;
    assert.equal(jun + jul + sep, 0, 'no income bars in empty months'); assert(Math.abs(nov / oct - 1.5) < 0.02 && Math.abs(nov / aug - 3) < 0.03, 'income bars proportional ' + JSON.stringify(r.inc));
    assert.deepEqual(r.sp.map(h => h > 0), [false, false, false, true, false, true]); assert(Math.abs(r.sp[3] / r.sp[5] - 7 / 6) < 0.02, 'spend bars proportional ' + JSON.stringify(r.sp));
    assert.match(r.legend, /수금.*지출/); assert.match(r.aria, /11월 수금 300만원, 지출 60만원/);
    assert(r.over <= 0, 'no horizontal overflow');
    const same = await page.evaluate(() => { const a = JSON.stringify({ p: state.payLog, e: state.expenses, f: state.files.length }), d = state.dirty; render(); render(); return a === JSON.stringify({ p: state.payLog, e: state.expenses, f: state.files.length }) && d === state.dirty; });
    assert.equal(same, true, 'rendering does not change data');
    await shot(page, 'v548-pc-board');
  });

  await test('② 누르면 있던 창 — 지출 장부·월별 손익·발행 확인·세무 자료, 숫자가 서로 같다 (OPEN)', async () => {
    const before = await data(page);
    await page.locator('#hjMoneyBoard [data-money="spend"]').click(); assert.match(await modal(page), /600,000/, 'expense ledger total'); await page.evaluate(() => closeModal(true));
    await page.locator('#hjMoneyBoard [data-money="net"]').click(); let m = await modal(page); assert.match(m, /월 손익/); assert.match(m, /\+2,400,000/, 'monthly P&L net'); await page.evaluate(() => closeModal(true));
    await page.locator('#hjMoneyBoard [data-money="issue"]').click(); assert.match(await modal(page), /발행 안 한 수금 2건/); await page.evaluate(() => closeModal(true));
    await page.locator('#hjMoneyBoard [data-money="noproof"]').click(); await page.locator('#modalRoot [data-taxpack-noproof]').waitFor();
    assert.match(await page.locator('#modalRoot [data-taxpack-noproof]').innerText(), /2건/, 'tax pack counts the same missing receipts'); await page.evaluate(() => closeModal(true));
    assert.equal(await data(page), before, 'opening views changes nothing');
  });

  await test('③ 표로 보기 · 달마다 풍선말 · 막대 굵기 (TABLE)', async () => {
    await page.locator('#hjMoneyBoard .hj-money-table summary').click();
    await page.waitForFunction(() => __hjMoneyTableOpen === true);   // toggle 이벤트는 클릭 뒤 따로 온다
    let rows = await page.evaluate(() => [...document.querySelectorAll('#hjMoneyBoard .hj-money-table tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()));
    assert.equal(rows.length, 6); assert.equal(rows[5], '2026년 11월 3,000,000원 600,000원 +2,400,000원'); assert.equal(rows[3], '2026년 9월 0원 700,000원 -700,000원');
    const open = await page.evaluate(() => { render(); return document.querySelector('#hjMoneyBoard .hj-money-table').open; });
    assert.equal(open, true, 'table stays open across re-render');
    const r = await board(page);
    assert.equal(r.tips[5], '11월 — 수금 300만원 · 지출 60만원 · 손익 +240만원'); assert.equal(r.tips[3], '9월 — 수금 0원 · 지출 70만원 · 손익 -70만원');
    assert(r.widths.length === 5 && r.widths.every(w => w > 0 && w <= 24), 'bars at most 24px ' + JSON.stringify(r.widths));
    await page.evaluate(() => { __hjMoneyTableOpen = false; render(); });
  });

  await test('④ 1024 한 줄+아래 막대 · 폰 없음 · 모드 전환 · 빈 안내 · 어두운 화면 (FIT)', async () => {
    const { page: p1024 } = await open({ width: 1024 });
    let r = await board(p1024);
    assert(new Set(r.tileTops).size === 1 && r.chart.top >= r.tiles.bottom, 'three tiles in a row, chart below ' + JSON.stringify(r.tileTops));
    assert(r.svgH <= 250 && r.over <= 0, 'chart capped, no overflow ' + r.svgH);
    await shot(p1024, 'v548-pc-1024');
    const { page: pm } = await open({ width: 390, mobile: true });
    assert.equal(await board(pm), null, 'phone has no money board');
    const { page: pn } = await open({ width: 360 });   // 폰 폭인데 PC 모드 — 막대 글자가 너무 작아지므로 숨김(dash-cards ④ 가로 넘침 0)
    r = await pn.evaluate(() => { const b = document.getElementById('hjMoneyBoard'); return { shown: !!b && getComputedStyle(b).display !== 'none', over: document.documentElement.scrollWidth - innerWidth }; });
    assert.equal(r.shown, false, 'hidden at phone width even in PC mode'); assert(r.over <= 0, 'no overflow at 360 ' + r.over);   // 앱이 좁은 폭을 모바일 모드로 바꿨으면 아예 없다 — 둘 다 숨김
    r = await page.evaluate(() => { __mobileMode = true; applyMobileMode(); const shown = getComputedStyle(document.getElementById('hjMoneyBoard')).display !== 'none'; __mobileMode = false; applyMobileMode(); return shown; });
    assert.equal(r, false, 'mode toggle hides it at once');
    const { page: pe } = await open({ width: 1280, empty: true });
    r = await board(pe);
    assert.equal(r.months.length, 0); assert.match(r.empty, /기록이 아직 없습니다/); assert.equal(r.proof, '✅ 빠진 것 없음'); assert.equal(r.spend, '💳 이번 달 지출 0원 기록 없음');
    const fills = () => page.evaluate(() => { const b = document.getElementById('hjMoneyBoard'); return [getComputedStyle(b.querySelector('.hj-mc-inc')).fill, getComputedStyle(b.querySelector('.hj-mc-sp')).fill]; });
    assert.deepEqual(await fills(), ['rgb(42, 120, 214)', 'rgb(235, 104, 52)'], 'validated light pair');
    await page.evaluate(() => { document.body.classList.add('dark'); render(); });
    await page.waitForTimeout(700);
    assert.deepEqual(await fills(), ['rgb(57, 135, 229)', 'rgb(217, 89, 38)'], 'validated dark pair');
    const c = await page.evaluate(() => {
      const b = document.getElementById('hjMoneyBoard'), cs = e => getComputedStyle(e), bg = cs(b).backgroundColor, tile = b.querySelector('[data-money="spend"]');
      return { bg, tileBg: cs(tile).backgroundColor, v: cs(tile.querySelector('.hj-mt-v')).color, k: cs(tile.querySelector('.hj-mt-k')).color, net: cs(b.querySelector('[data-money="net"] .hj-mt-v')).color, tick: cs(b.querySelector('.hj-mc-tick')).fill, btn: cs(b.querySelector('[data-money="issue"]')).color };
    });
    assert(ratio(c.v, c.tileBg) >= 4.5 && ratio(c.k, c.tileBg) >= 4.5 && ratio(c.net, c.tileBg) >= 4.5 && ratio(c.tick, c.bg) >= 4.5 && ratio(c.btn, c.bg) >= 4.5, 'dark contrast ' + JSON.stringify(c));
    await shot(page, 'v548-pc-dark');
    await page.evaluate(() => { document.body.classList.remove('dark'); render(); });
  });

  await test('⑤ 소스·핀 3곳(v548 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('html+=hjMoneyBoardHTML();   // v548'), 'dashboard draws the board');
    assert(src.includes("if(d.money!==undefined){e.stopPropagation();return hjMoneyOpen(d.money);}"), 'click delegation');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 548, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('moneyboard-v548: ' + passed + '/5 PASS; synthetic data; clock pinned; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL moneyboard-v548', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

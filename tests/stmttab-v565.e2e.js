/* v565 📑 내역서 탭 — 대표 지시(2026-11-10): "견적, 정산은 내역서로 대체할 거야".
   매출 기준이 작업내역서이거나 📑 반영한 내역서가 하나라도 있으면 '견적·정산' 탭(폰 하단 [정산])이 '📑 내역서'가 된다.
   숫자는 있던 계산(매출 한 벌의 내역서 줄·v527 장부·수금 이력)을 읽기만 한다. 합성 자료, 바깥 쓰기 0.
   ① 내역서 없음 + 매출 기준 견적 → 예전 '견적·정산' 그대로(탭·폰 하단·화면) (OFF)
   ② 내역서 있음 → 탭 '📑 내역서'·배지 = 장부 장 수·제목 · 숫자 칸(이번 달 1,320,000·2건 — 견적서·수주 앱 견적·집계 제외 빠짐 · 지난달 · 받을 돈 · 받은 돈 · 올해) · 장부 (KPI)
   ③ 월 줄 → 그 달 현장별 줄 · 현장 단추 → 현장 화면 · [💰 입금] 창이 이 탭에서도 열림 (MONTH)
   ④ 예전 견적 화면은 접혀 있고 펼칠 때만 그림 · 다시 그려도 펼침 유지 · 사람이 끈('all') 때만 안내 줄 → [매출은 작업내역서만] 켜기 → 안내 줄 사라짐 (OLD)
      (v589 부터 설정이 비어 있으면 내역서가 있는 자료는 저절로 내역서 기준이라 ② 에는 안내 줄이 없다)
   ⑤ 폰 390 — 하단 '내역서'·가로 넘침 없음·단추 44px · 그리기만으로 자료 불변 (PHONE)
   ⑥ 소스·핀 3곳(v565 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V565_BASELINE=<commit> 은 ② 에서, HJ_V565_MUTATION=count-all(내역서 거르기 삭제) 도 ② 숫자에서 실패해야 한다
   (v589 부터 설정이 비어 있으면 저절로 내역서 기준이라, ② 는 끈('all') 상태의 숫자도 따로 본다). */
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
const FILTER = 'if(r&&((r.file&&r.file._stmt)||(r.quote&&r.quote.stmt&&r.quote.stmt.key)))out.push(r);';
let html = process.env.HJ_V565_BASELINE ? execFileSync('git', ['show', process.env.HJ_V565_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V565_MUTATION) {
  assert.equal(process.env.HJ_V565_MUTATION, 'count-all', 'unknown mutation ' + process.env.HJ_V565_MUTATION);
  assert.equal(SRC.split(FILTER).length, 2, 'mutation anchor');
  html = SRC.replace(FILTER, 'if(r)out.push(r);');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmttab-v565 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED = withStmt => {
  closeModal(true);
  const today = localDate(), YM = today.slice(0, 7), PYM = hjYmShift(YM, -1);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온'), P('나래'), P('다솜')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.schedule = []; state._demo = false; state.dirHandle = null; state.goals = {};
  const est = (id, name, project, amount, date) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, prefix: '_정리완료/' + project + '/견적서/', size: 900 + amount % 991,
    est: { customer: name.replace(/\.xlsx$/, ''), amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date }, when: new Date(date + 'T09:00:00+09:00') });
  state.files = [est('E_A', '가온_견적서.xlsx', '가온', 3300000, YM + '-01')];
  if (withStmt) {
    const stmt = (src, project, amt, date, work) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines: [{ d: date, loc: project + ' 101-1', work: work || '누수 탐지', amt }] }); state.quotes.push(q); syncQuoteToProject(q); return q; };
    stmt('S1.xlsx', '가온', 220000, YM + '-01', '우수관 방수'); stmt('S2.xlsx', '다솜', 1100000, YM + '-01', '욕조 방수'); stmt('S0.xlsx', '나래', 330000, PYM + '-15', '배관 교체');
    const ex = stmt('SX.xlsx', '다솜', 500000, YM + '-01'); ex.exSum = true; syncQuoteToProject(ex);   // 집계 제외 내역서 — 빠져야 함
    state.quotes.push({ id: 'WQ', title: '수주 견적', no: '제1', date: YM + '-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '', items: [{ name: '도배', spec: '', qty: 1, price: 700000 }], result: 'won' });
    hjStmtPayApply('S1.xlsx', { amt: 100000, d: today, method: '계좌이체' });
  }
  __hjStmtYm = null; __hjStmtOldOpen = false;
  state.activeProject = null; state.tab = 'estimates'; state.search = '';
  render();
  return { YM, PYM, mm: +YM.slice(5, 7), pmm: +PYM.slice(5, 7), sameYear: YM.slice(0, 4) === PYM.slice(0, 4) };
};
const HEAD = () => ({ tab: document.querySelector('#tabs .tab[data-tab="estimates"]').firstChild.textContent.trim(), badge: document.getElementById('bEst').textContent,
  nav: document.querySelector('#mobileNav [data-mnav="estimates"]').getAttribute('aria-label'), navText: document.querySelector('#mobileNav [data-mnav="estimates"]').innerText.replace(/\s+/g, ''),
  title: document.getElementById('mainTitle').textContent.replace(/\s+/g, ' ').trim(), stmt: !!document.querySelector('#view [data-stmt-view]'), old: !!document.querySelector('#view .estimates-view') });
const KPI = () => Object.fromEntries([...document.querySelectorAll('#view [data-stmt-kpi]')].map(el => [el.dataset.stmtKpi, el.innerText.replace(/\s+/g, ' ').trim()]));

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await test('① 내역서 없음 + 매출 기준 견적 → 예전 견적·정산 그대로 (OFF)', async () => {
      await page.evaluate(SEED, false);
      const h = await page.evaluate(HEAD);
      assert.deepEqual([h.tab, h.nav, h.navText, h.title, h.stmt, h.old], ['견적·정산', '정산, 견적·정산', '💰정산', '견적 정산', false, true], JSON.stringify(h));
    });
    let D;
    await test('② 내역서 있음 → 탭·배지·제목 · 숫자 칸 · 장부 (KPI)', async () => {
      D = await page.evaluate(SEED, true);
      const h = await page.evaluate(HEAD), k = await page.evaluate(KPI);
      assert.deepEqual([h.tab, h.badge, h.nav, h.navText, h.title, h.stmt, h.old], ['📑 내역서', '3', '내역서, 작업내역서 장부', '📑내역서', '작업 내역서', true, false], JSON.stringify(h));
      assert.ok(k.cur.includes(D.mm + '월 매출(내역서)') && k.cur.includes('1,320,000원') && k.cur.includes('내역서 2건'), '이번 달 — 견적서 3,300,000·수주 앱 견적 770,000·집계 제외 500,000 빠짐: ' + k.cur);
      assert.ok(k.prev.includes('지난달(' + D.pmm + '월)') && k.prev.includes('330,000원') && k.prev.includes('내역서 1건'), '지난달 — ' + k.prev);
      assert.ok(k.left.includes('1,550,000원') && k.left.includes('내역서 3장'), '받을 돈 = 1,650,000 − 100,000 — ' + k.left);
      assert.ok(k.paid.includes('100,000원'), '이번 달 받은 돈 — ' + k.paid);
      assert.ok(k.year.includes((D.sameYear ? 1650000 : 1320000).toLocaleString('ko-KR') + '원'), '올해 누계 — ' + k.year);
      const led = await page.evaluate(() => ({ rows: document.querySelectorAll('#view [data-stmt-ledger] [data-stmt-row]').length, hint: !!document.querySelector('#view [data-stmt-basis-hint]'), stmtBtn: !!document.querySelector('#view #qmStmt') }));
      assert.deepEqual(led, { rows: 3, hint: false, stmtBtn: true }, '장부 3장 · 매출 기준 안내 없음(v589 설정 없음 = 저절로 내역서) · 반영 단추 — ' + JSON.stringify(led));
      // 내역서 탭 숫자는 매출 기준과 상관없이 내역서만 — v589 부터 설정 없음이 저절로 내역서 기준이라, 끈('all') 상태에서도 같은 값인지 본다
      const kAll = await page.evaluate(() => { hjSalesBasisSet(false); const cur = document.querySelector('#view [data-stmt-kpi="cur"]').innerText.replace(/\s+/g, ' ').trim(); delete state.goals.salesBasis; render(); return cur; });
      assert.ok(kAll.includes('1,320,000원') && kAll.includes('내역서 2건'), '끈 상태(all)에서도 이번 달 매출(내역서)은 내역서만 — ' + kAll);
    });
    await test('③ 월 줄 → 그 달 현장별 줄 · 현장 단추 → 현장 화면 · [💰 입금] 창 (MONTH)', async () => {
      const a = await page.evaluate(() => ({ months: [...document.querySelectorAll('#view [data-stmt-ym]')].map(b => [b.dataset.stmtYm, b.getAttribute('aria-pressed'), b.innerText.replace(/\s+/g, ' ').trim()]),
        list: document.querySelector('#view [data-stmt-month-list]').dataset.stmtMonthList, items: [...document.querySelectorAll('#view [data-stmt-item]')].map(el => el.innerText.replace(/\s+/g, ' ').trim()) }));
      assert.deepEqual(a.months.map(m => m.slice(0, 2)), [[D.YM, 'true'], [D.PYM, 'false']], '월 줄 최신 먼저 — ' + JSON.stringify(a.months));
      assert.ok(a.months[0][2].includes('내역서 2건 · 현장 2곳 · 받은 돈 100,000원') && a.months[0][2].endsWith('1,320,000원'), '이번 달 줄 — ' + a.months[0][2]);
      assert.equal(a.list, D.YM);
      assert.deepEqual(a.items, [D.mm + '/1 가온 우수관 방수 · 시험누수 📷 사진 없음 220,000원', D.mm + '/1 다솜 욕조 방수 · 시험누수 📷 사진 없음 1,100,000원'], '이번 달 현장별 줄 — ' + JSON.stringify(a.items));
      await page.click('#view [data-stmt-ym="' + D.PYM + '"]');
      const b = await page.evaluate(() => ({ list: document.querySelector('#view [data-stmt-month-list]').dataset.stmtMonthList, items: [...document.querySelectorAll('#view [data-stmt-item]')].map(el => el.innerText.replace(/\s+/g, ' ').trim()),
        pressed: [...document.querySelectorAll('#view [data-stmt-ym]')].map(x => x.getAttribute('aria-pressed')) }));
      assert.deepEqual([b.list, b.items, b.pressed], [D.PYM, [D.pmm + '/15 나래 배관 교체 · 시험누수 📷 사진 없음 330,000원'], ['false', 'true']], '지난달 고름 — ' + JSON.stringify(b));
      await page.click('#view [data-stmtpay="S2.xlsx"]');
      await page.waitForSelector('#modalRoot .modal');
      const modal = await page.evaluate(() => { const t = document.querySelector('#modalRoot .modal').innerText; closeModal(true); return t; });
      assert.ok(/입금/.test(modal) && modal.includes('다솜'), '이 탭에서 [💰 입금] 창 — ' + modal.slice(0, 120));
      await page.click('#view [data-stmt-item] [data-open="나래"]');
      const pj = await page.evaluate(() => [state.tab, state.activeProject]);
      assert.deepEqual(pj, ['project', '나래'], '현장 단추 → 현장 화면');
    });
    await test('④ 예전 견적 화면은 접혀 있고 펼칠 때만 그림 · 펼침 유지 · 매출 기준 켜기 (OLD)', async () => {
      await page.evaluate(() => { state.activeProject = null; state.tab = 'estimates'; render(); });
      const a = await page.evaluate(() => { const d = document.querySelector('#view [data-stmt-old]'); return { open: d.open, sum: d.querySelector('summary').innerText.trim(), old: !!document.querySelector('#view .estimates-view') }; });
      assert.deepEqual(a, { open: false, sum: '📄 견적서 파일 · 예전 견적·정산 화면 (1건)', old: false }, JSON.stringify(a));
      await page.click('#view [data-stmt-old] > summary');
      await page.waitForSelector('#view [data-stmt-old][open] .estimates-view');
      const b = await page.evaluate(() => { render(); const d = document.querySelector('#view [data-stmt-old]'); return { open: d.open, names: [...d.querySelectorAll('.est-name')].map(x => x.textContent), stmt: !!document.querySelector('#view [data-stmt-kpis]') }; });
      assert.ok(b.open && b.stmt && b.names.includes('가온_견적서.xlsx'), '펼치면 견적서 목록 · 다시 그려도 펼침 — ' + JSON.stringify(b));
      await page.click('#view [data-stmt-old] > summary');
      await page.waitForFunction(() => !document.querySelector('#view .estimates-view'));
      // v589 사람이 📊 매출 목표에서 끈 경우('all')에만 안내 줄 — 켜기 단추로 다시 켠다
      const hint = await page.evaluate(() => { hjSalesBasisSet(false); const el = document.querySelector('#view [data-stmt-basis-hint]'); return { basis: state.goals.salesBasis, text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '' }; });
      assert.equal(hint.basis, 'all', '끄면 all');
      assert.match(hint.text, /꺼 두셔서, 대시보드·월말 결산의 매출이 견적서까지 함께 세고 있어요\. 📑 매출은 작업내역서만 세기$/, '끈 때만 안내 — ' + hint.text);
      await page.click('#view [data-stmt-basis]');
      const c = await page.evaluate(() => ({ basis: state.goals.salesBasis, hint: !!document.querySelector('#view [data-stmt-basis-hint]'), tab: document.querySelector('#tabs .tab[data-tab="estimates"]').firstChild.textContent.trim() }));
      assert.deepEqual(c, { basis: 'stmt', hint: false, tab: '📑 내역서' }, '매출 기준 켜기 — ' + JSON.stringify(c));
      const d = await page.evaluate(() => { state.quotes = []; state.files = state.files.filter(f => !f._stmt); state.payLog = []; render(); return { tab: document.querySelector('#tabs .tab[data-tab="estimates"]').firstChild.textContent.trim(), empty: !!document.querySelector('#view [data-stmt-empty]') }; });
      assert.deepEqual(d, { tab: '📑 내역서', empty: true }, '매출 기준이 작업내역서면 내역서가 없어도 내역서 탭 + 빈 안내 — ' + JSON.stringify(d));
    });
    await context.close();
    await test('⑤ 폰 390 — 하단 내역서 · 가로 넘침 없음 · 단추 44px · 그리기만으로 자료 불변 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED, true);
      const r = await m.page.evaluate(() => {
        const before = JSON.stringify(serializeData());
        render(); document.querySelector('#view [data-stmt-ym]').click();
        const v = document.getElementById('view'), nb = document.querySelector('#mobileNav [data-mnav="estimates"]');
        const small = [...v.querySelectorAll('[data-stmt-view] button')].filter(b => b.getClientRects().length).map(b => [b.innerText.trim().slice(0, 14), Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        const kv = [...v.querySelectorAll('[data-stmt-kpi] b')].filter(b => b.scrollWidth > b.clientWidth + 1).length;
        const data = Object.assign({}, serializeData()), b0 = JSON.parse(before); delete data.savedAt; delete b0.savedAt;
        return { nav: nb.getAttribute('aria-label'), navText: nb.innerText.replace(/\s+/g, ''), on: nb.classList.contains('on'), over: document.documentElement.scrollWidth - innerWidth, viewOver: v.scrollWidth - v.clientWidth, small, kv, same: JSON.stringify(data) === JSON.stringify(b0) };
      });
      assert.deepEqual([r.nav, r.navText, r.on], ['내역서, 작업내역서 장부', '📑내역서', true], JSON.stringify(r));
      assert.ok(r.over <= 1 && r.viewOver <= 1 && r.kv === 0, '가로 넘침 없음 · 숫자 안 잘림 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px 미만 단추 — ' + JSON.stringify(r.small));
      assert.ok(r.same, '그리기·달 고르기로 자료가 바뀌지 않음');
      await m.context.close();
    });
    await test('⑥ 소스·핀 3곳(v565 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 565, '핀 v565 이상 ' + a);
      assert.ok(src.includes(FILTER) && src.includes('function viewStatements()'), '내역서 탭이 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmttab-v565: ${passed}/6 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmttab-v565 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

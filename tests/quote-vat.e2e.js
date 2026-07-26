/* quote-vat.e2e.js — 견적 금액이 화면마다 달라지지 않게 지킨다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.

   f.est.amount 는 projStats 의 매출(est)이고, 그 위에 대시보드 매출·마진·연간결산·
   세무용 분기 정산이 전부 얹혀 있다. 그런데 f.est 를 만드는 곳이 두 군데다:
     · 앱에서 만든 견적   → syncQuoteToProject  (quoteCalc.total 을 넣는다)
     · 엑셀에서 불러온 견적 → quoteToEst
   이 둘이 vatIncluded 를 반대로 해석하면 같은 견적인데 매출이 부가세만큼 어긋난다.
   실제로 그랬고(엑셀 견적 매출 10% 과대), 아무 화면에도 경고가 뜨지 않는다 —
   숫자가 그럴듯해서 사람 눈으로는 못 잡는다. 그래서 여기서 잡는다.

   실발신·네트워크 없음. state 를 읽기만 하고 원본 불변까지 확인한다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 품목 단가는 '공급가액(부가세 전)'이라는 게 quoteCalc 의 계약이다. 합계 1,000만.
  const mkQuote = (vatIncluded) => ({
    id: 'qtest', no: '견20260726', title: '석교동 카페', date: '2026-07-26', place: '', project: null,
    accountIdx: 0, memo: '', vatIncluded,
    items: [{ name: '철거', spec: '', qty: 1, price: 4000000 }, { name: '목공', spec: '', qty: 2, price: 3000000 }]
  });

  await test('부가세 포함 견적: quoteToEst 가 quoteCalc 와 같은 합계를 낸다', async () => {
    const r = await page.evaluate((q) => {
      const c = quoteCalc(q), e = quoteToEst(q);
      return { total: c.total, supply: c.supply, vat: c.vat, amount: e.amount, eSupply: e.supply, eVat: e.vat };
    }, mkQuote(true));
    assert(r.supply === 10000000, '공급가 1,000만이어야 한다: ' + r.supply);
    assert(r.vat === 1000000, '세액 100만이어야 한다: ' + r.vat);
    assert(r.total === 11000000, '부가세 포함 합계는 1,100만이어야 한다: ' + r.total);
    assert(r.amount === r.total, 'est.amount 가 견적서 합계와 다르다 — 대시보드 매출이 어긋난다: ' + r.amount + ' vs ' + r.total);
    assert(r.eSupply === r.supply && r.eVat === r.vat, 'est 의 공급가·세액이 quoteCalc 와 다르다: ' + r.eSupply + '/' + r.eVat);
  });

  await test('부가세 별도 견적: quoteToEst 가 quoteCalc 와 같은 합계를 낸다', async () => {
    const r = await page.evaluate((q) => {
      const c = quoteCalc(q), e = quoteToEst(q);
      return { total: c.total, supply: c.supply, vat: c.vat, amount: e.amount, eSupply: e.supply, eVat: e.vat };
    }, mkQuote(false));
    assert(r.total === 10000000, '부가세 별도 합계는 공급가 그대로 1,000만이어야 한다: ' + r.total);
    assert(r.amount === r.total, 'est.amount 가 견적서 합계와 다르다 — 엑셀 견적 매출이 10% 부풀려진다: ' + r.amount + ' vs ' + r.total);
    assert(r.eSupply === 10000000 && r.eVat === 1000000, 'est 공급가/세액이 어긋난다: ' + r.eSupply + '/' + r.eVat);
  });

  await test('f.est 를 만드는 두 경로(앱 견적·엑셀 견적)가 같은 금액을 낸다', async () => {
    // syncQuoteToProject 는 앱에서 만든 견적의 est 를, quoteToEst 는 엑셀에서 불러온 견적의 est 를 만든다.
    // 같은 견적 데이터를 주면 두 경로의 amount/supply/vat 가 반드시 일치해야 한다.
    for (const vatIncluded of [true, false]) {
      const r = await page.evaluate((q) => {
        const keep = { projects: state.projects, files: state.files, quotes: state.quotes };
        state.projects = [{ name: '테스트현장', stage: 0, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false }];
        state.files = []; state.quotes = [];
        const viaImport = quoteToEst(q);
        syncQuoteToProject(Object.assign({}, q, { project: '테스트현장' }));
        const f = state.files.find(x => x.id === 'quote_' + q.id);
        const viaApp = f && f.est;
        state.projects = keep.projects; state.files = keep.files; state.quotes = keep.quotes;
        return { viaImport, viaApp };
      }, mkQuote(vatIncluded));
      const a = r.viaApp, b = r.viaImport;
      assert(a, 'syncQuoteToProject 가 est 를 만들지 않았다 (vatIncluded=' + vatIncluded + ')');
      assert(a.amount === b.amount,
        '같은 견적인데 매출이 다르다 (vatIncluded=' + vatIncluded + ') — 앱 ' + a.amount + ' vs 엑셀 ' + b.amount);
      assert(a.supply === b.supply && a.vat === b.vat,
        '공급가·세액이 다르다 (vatIncluded=' + vatIncluded + ') — 앱 ' + a.supply + '/' + a.vat + ' vs 엑셀 ' + b.supply + '/' + b.vat);
    }
  });

  await test('엑셀 파서는 합계 행을 품목으로 세지 않는다(부가세 이중계상 방지)', async () => {
    // parseQuoteFromGrid 가 '합계/총액/소계' 행을 품목으로 읽으면 금액이 두 배가 된다.
    // 단가 합계 = 공급가액 이라는 quoteCalc 의 계약이 여기서 깨진다.
    const r = await page.evaluate(() => {
      const grid = [
        ['견 적 서', '', '', '', ''],
        ['품명', '규격', '수량', '단가', '공급가액'],
        ['철거', '', 1, 4000000, 4000000],
        ['목공', '', 2, 3000000, 6000000],
        ['합계', '', '', '', 10000000],
        ['부가세', '', '', '', 1000000]
      ];
      const q = parseQuoteFromGrid(grid, '석교동_20260726.xlsx');
      return { n: (q.items || []).length, total: quoteCalc(q).total, amount: quoteToEst(q).amount, vatIncluded: q.vatIncluded };
    });
    assert(r.n === 2, '품목은 2개여야 한다(합계·부가세 행 제외): ' + r.n);
    assert(r.total === 10000000, '엑셀 견적 합계가 공급가액 합과 다르다: ' + r.total);
    assert(r.amount === 10000000, '엑셀 견적 매출이 부풀려졌다: ' + r.amount);
  });

  await test('quoteToEst 는 원본 견적을 건드리지 않는다', async () => {
    const r = await page.evaluate((q) => {
      const before = JSON.stringify(q);
      quoteToEst(q); quoteCalc(q);
      return { before, after: JSON.stringify(q) };
    }, mkQuote(true));
    assert(r.before === r.after, 'quoteToEst/quoteCalc 가 원본 견적을 변형했다');
  });

  await test('소수 수량이 들어와도 금액에 소수점이 남지 않는다', async () => {
    const r = await page.evaluate(() => {
      const q = { id: 'q2', title: 'x', date: '2026-07-26', vatIncluded: true, items: [{ name: '벽지', spec: '', qty: 1.5, price: 33333 }] };
      const c = quoteCalc(q), e = quoteToEst(q);
      return { total: c.total, supply: c.supply, vat: c.vat, amount: e.amount };
    });
    for (const [k, v] of Object.entries(r)) assert(Number.isInteger(v), k + ' 에 소수가 남았다: ' + v);
    assert(r.amount === r.total, 'est.amount 가 합계와 다르다: ' + r.amount + ' vs ' + r.total);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

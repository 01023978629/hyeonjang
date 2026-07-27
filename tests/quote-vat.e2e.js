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

  // ── 앱이 만든 견적서를 앱이 다시 읽는 왕복 ───────────────────────────
  // 파서가 '합 계(공급가액)'·'총 액(부가세 포함)' 행을 못 끊으면 그 금액이 품목으로
  // 흡수돼 견적이 통째로 한 번 더 더해진다. 실측 1,100만 → 3,100만(2.8배)이었다.
  const exportedGrid = (vatIncluded) => {
    const supply = 10000000, total = vatIncluded ? 11000000 : 10000000;
    const vatLabel = vatIncluded ? '부가세 포함' : '부가세 별도';
    return [
      ['견 적 서'],
      ['상호', '만물인테리어', '사업자번호', '895-48-01132', '대표자', '전병덕'],
      ['소재지', '', '업태', '', '종목', ''],
      ['연락처', ''],
      ['견적번호', '견20260726', '견적일', '2026-07-26'],
      ['견적명', '석교동 카페'],
      ['견적금액(' + vatLabel + ')', total],
      [],
      ['No.', '품 명', '규 격', '수 량', '단 가', '공급가액', '세 액'],
      [1, '철거', '', 1, 4000000, 4000000, vatIncluded ? 400000 : ''],
      [2, '목공', '', 2, 3000000, 6000000, vatIncluded ? 600000 : ''],
      [],
      ['', '', '', '', '합 계(공급가액)', supply, ''],
      ['', '', '', '', '총 액(' + vatLabel + ')', total, ''],
      ['결제방법', '계좌: 농협 123-456'],
      ['장소', '대전 중구'],
      ['비고', ''],
      ['견적 유효기간', '견적서 일 기준 1개월']
    ];
  };

  await test('내보낸 견적서를 다시 읽어도 금액이 그대로다 (부가세 포함)', async () => {
    const r = await page.evaluate((grid) => {
      const q = parseQuoteFromGrid(grid, '석교동 카페.xlsx');
      return { n: (q.items || []).length, vatIncluded: q.vatIncluded, total: quoteCalc(q).total, amount: quoteToEst(q).amount };
    }, exportedGrid(true));
    assert(r.n === 2, '합계·총액·꼬리말 행이 품목으로 섞였다 — 품목 ' + r.n + '개');
    assert(r.vatIncluded === true, "'(부가세 포함)' 표기를 못 읽었다 — 총액이 부가세만큼 줄어든다");
    assert(r.total === 11000000, '왕복 후 합계가 달라졌다: ' + r.total + ' (원본 11,000,000)');
    assert(r.amount === 11000000, '왕복 후 매출이 달라졌다: ' + r.amount);
  });

  await test('내보낸 견적서를 다시 읽어도 금액이 그대로다 (부가세 별도)', async () => {
    const r = await page.evaluate((grid) => {
      const q = parseQuoteFromGrid(grid, '석교동 카페.xlsx');
      return { n: (q.items || []).length, vatIncluded: q.vatIncluded, total: quoteCalc(q).total };
    }, exportedGrid(false));
    assert(r.n === 2, '합계·총액·꼬리말 행이 품목으로 섞였다 — 품목 ' + r.n + '개');
    assert(r.vatIncluded === false, "'별도'인데 포함으로 읽었다 — 총액이 10% 늘어난다");
    assert(r.total === 10000000, '왕복 후 합계가 달라졌다: ' + r.total + ' (원본 10,000,000)');
  });

  await test('품명이 없고 금액만 있는 줄은 품목으로 세지 않는다', async () => {
    const r = await page.evaluate(() => {
      const grid = [
        ['품 명', '수 량', '단 가', '공급가액'],
        ['철거', 1, 4000000, 4000000],
        ['', '', '', 4000000],        // 소계 — 품명 없이 금액만
        ['목공', 1, 3000000, 3000000]
      ];
      const q = parseQuoteFromGrid(grid, 'x.xlsx');
      return { n: q.items.length, total: quoteCalc(q).total };
    });
    assert(r.n === 2, '품명 없는 소계 줄을 품목으로 셌다 — 품목 ' + r.n + '개');
    assert(r.total === 7000000, '소계가 이중계상됐다: ' + r.total);
  });

  await test("'장소이동비' 같은 품목명이 꼬리말로 오인돼 잘리지 않는다", async () => {
    // 꼬리말 라벨(장소·비고 등)은 완전일치로만 끊는다 — 접두사로 끊으면 진짜 품목이 사라진다.
    const r = await page.evaluate(() => {
      const grid = [
        ['품 명', '수 량', '단 가', '공급가액'],
        ['철거', 1, 4000000, 4000000],
        ['장소이동비', 1, 200000, 200000],
        ['비고자재', 1, 300000, 300000]
      ];
      const q = parseQuoteFromGrid(grid, 'x.xlsx');
      return { n: q.items.length, total: quoteCalc(q).total };
    });
    assert(r.n === 3, '정상 품목이 꼬리말로 오인돼 잘렸다 — 품목 ' + r.n + '개');
    assert(r.total === 4500000, '합계가 어긋난다: ' + r.total);
  });

  // ── 이미 저장돼 있던 부풀려진 금액 교정 ─────────────────────────────
  // 고치기 전에 엑셀로 불러온 견적서는 est 가 부풀려진 채로 저장됐다.
  // 새로 불러오는 것만 고치면 이미 들어간 장부는 계속 틀린다.
  const seedFiles = () => page.evaluate(() => {
    const q = { id: 'qi', title: '불러온견적', date: '2026-05-02', vatIncluded: false,
                items: [{ name: '철거', spec: '', qty: 1, price: 10000000 }] };
    state.files = [
      // ① 엑셀에서 불러온 견적 — 예전 계산으로 1,100만이 저장돼 있다 (정답 1,000만)
      { id: 'f1', name: '불러온견적.xlsx', ext: 'xlsx', kind: 'estimate', project: 'A', quote: q,
        est: { customer: '불러온견적', amount: 11000000, supply: 10000000, vat: 1000000, date: '2026-05-02', _fromXlsx: true } },
      // ② 사람이 손으로 고친 값 — 건드리면 안 된다
      { id: 'f2', name: '손수정.xlsx', ext: 'xlsx', kind: 'estimate', project: 'A', quote: q,
        est: { customer: '손수정', amount: 9500000, supply: 9500000, vat: 950000, date: '2026-05-02', _fromXlsx: true, _edited: true } },
      // ③ PDF 텍스트에서 뽑은 견적 — quote 가 없어 대상이 아니다
      { id: 'f3', name: '스캔견적.pdf', ext: 'pdf', kind: 'estimate', project: 'A', quote: null,
        est: { customer: '스캔', amount: 8250000, supply: 7500000, vat: 750000, date: '2026-05-02' } }
    ];
  });

  await test('이미 저장된 부풀려진 견적 매출을 불러올 때 바로잡는다', async () => {
    await seedFiles();
    const r = await page.evaluate(() => {
      const n = fixXlsxEstVat();
      const g = id => state.files.find(f => f.id === id).est;
      return { n, f1: g('f1'), f2: g('f2'), f3: g('f3') };
    });
    assert(r.n === 1, '고친 건수가 1이어야 한다: ' + r.n);
    assert(r.f1.amount === 10000000, '엑셀 견적 매출이 안 고쳐졌다: ' + r.f1.amount);
    assert(r.f1.supply === 10000000 && r.f1.vat === 1000000, '공급가·세액이 어긋난다: ' + r.f1.supply + '/' + r.f1.vat);
    assert(r.f2.amount === 9500000, '손으로 고친 값(_edited)을 덮어썼다: ' + r.f2.amount);
    assert(r.f3.amount === 8250000, 'PDF 에서 뽑은 견적(quote 없음)을 건드렸다: ' + r.f3.amount);
  });

  await test('교정은 여러 번 돌려도 결과가 같다(멱등)', async () => {
    await seedFiles();
    const r = await page.evaluate(() => {
      const a = fixXlsxEstVat(), b = fixXlsxEstVat(), c = fixXlsxEstVat();
      return { a, b, c, amount: state.files.find(f => f.id === 'f1').est.amount };
    });
    assert(r.a === 1 && r.b === 0 && r.c === 0, '두 번째부터는 고칠 게 없어야 한다: ' + [r.a, r.b, r.c].join(','));
    assert(r.amount === 10000000, '반복 실행이 금액을 또 바꿨다: ' + r.amount);
  });

  await test('교정이 대시보드 매출(projStats)까지 내려간다', async () => {
    await seedFiles();
    const r = await page.evaluate(() => {
      state.projects = [{ name: 'A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false }];
      const beforeEst = projStats('A').est;
      fixXlsxEstVat();
      return { beforeEst, afterEst: projStats('A').est };
    });
    assert(r.beforeEst - r.afterEst === 1000000,
      '교정 후 매출이 부가세만큼 줄어야 한다: ' + r.beforeEst + ' → ' + r.afterEst);
  });

  await test('데이터를 불러오면(applyData) 교정이 자동으로 돈다', async () => {
    const r = await page.evaluate(() => {
      const q = { id: 'qi2', title: '불러온견적2', date: '2026-05-02', vatIncluded: false,
                  items: [{ name: '도배', spec: '', qty: 1, price: 5000000 }] };
      state.files = [];
      applyData({
        savedAt: '2026-05-02T00:00:00.000Z',
        projects: [{ name: 'B', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' } }],
        files: [{ key: 'k9', name: '불러온견적2.xlsx', kind: 'estimate', project: 'B', quote: q,
                  est: { customer: '불러온견적2', amount: 5500000, supply: 5000000, vat: 500000, _fromXlsx: true }, when: null }]
      });
      const f = state.files.find(x => x.name === '불러온견적2.xlsx');
      return { amount: f && f.est && f.est.amount };
    });
    assert(r.amount === 5000000, 'applyData 뒤에도 부풀려진 값이 남아 있다: ' + r.amount);
  });

  await test('예전 파서가 합계 행까지 품목으로 저장한 견적도 되돌린다', async () => {
    // 고치기 전 파서는 '합 계'·'총 액' 행을 품명 없는 품목으로 저장했다.
    // 그 저장본을 그대로 다시 계산하면 여전히 2.8배다 — 유령 품목부터 걷어내야 한다.
    const r = await page.evaluate(() => {
      const polluted = { id: 'qp', title: '석교동 카페', date: '2026-07-26', vatIncluded: false, items: [
        { name: '철거', spec: '', qty: 1, price: 4000000 },
        { name: '목공', spec: '', qty: 2, price: 3000000 },
        { name: '', spec: '', qty: 1, price: 10000000 },   // 흡수된 '합 계(공급가액)'
        { name: '', spec: '', qty: 1, price: 11000000 },   // 흡수된 '총 액(부가세 포함)'
        { name: '계좌: 농협 123-456', spec: '', qty: 1, price: 0 },
        { name: '견적서 일 기준 1개월', spec: '', qty: 1, price: 0 }
      ] };
      state.files = [{ id: 'fp', name: '석교동 카페.xlsx', ext: 'xlsx', kind: 'estimate', project: 'A', quote: polluted,
        est: { customer: '석교동 카페', amount: 34100000, supply: 31000000, vat: 3100000, _fromXlsx: true } }];
      const n = fixXlsxEstVat();
      const f = state.files[0];
      return { n, amount: f.est.amount, supply: f.est.supply, vat: f.est.vat,
               items: f.quote.items.length, vatIncluded: f.quote.vatIncluded };
    });
    assert(r.n === 1, '고친 건수가 1이어야 한다: ' + r.n);
    assert(r.items === 4, '품명 없는 유령 품목이 안 지워졌다 — 남은 품목 ' + r.items + '개');
    assert(r.vatIncluded === true, "지워낸 합계가 '품목합계+부가세'와 맞으므로 부가세 포함으로 되살려야 한다");
    assert(r.amount === 11000000, '되돌린 금액이 틀리다: ' + r.amount + ' (정답 11,000,000)');
    assert(r.supply === 10000000 && r.vat === 1000000, '공급가·세액이 어긋난다: ' + r.supply + '/' + r.vat);
  });

  await test('되돌리기도 여러 번 돌려서 안전하다(유령 제거 후 멱등)', async () => {
    const r = await page.evaluate(() => {
      const polluted = { id: 'qp2', title: 'x', date: '2026-07-26', vatIncluded: false, items: [
        { name: '철거', spec: '', qty: 1, price: 4000000 },
        { name: '', spec: '', qty: 1, price: 4000000 }
      ] };
      state.files = [{ id: 'fp2', name: 'x.xlsx', ext: 'xlsx', kind: 'estimate', project: 'A', quote: polluted,
        est: { customer: 'x', amount: 8800000, supply: 8000000, vat: 800000, _fromXlsx: true } }];
      const a = fixXlsxEstVat(), b = fixXlsxEstVat(), c = fixXlsxEstVat();
      return { a, b, c, amount: state.files[0].est.amount, items: state.files[0].quote.items.length };
    });
    assert(r.a === 1 && r.b === 0 && r.c === 0, '두 번째부터는 고칠 게 없어야 한다: ' + [r.a, r.b, r.c].join(','));
    assert(r.amount === 4000000, '반복 실행이 금액을 또 바꿨다: ' + r.amount);
    assert(r.items === 1, '유령 제거가 반복 실행에서 흔들린다: ' + r.items);
  });

  // ── 날짜 형식이 집계에서 견적을 통째로 떨어뜨리지 않는가 ─────────────
  // parseEstimate 는 PDF·이미지에서 뽑은 날짜를 '2026.05.10'(점)로 만들었다.
  // 앱 내부 표준은 '2026-05-10' 이고, 월 비교는 문자열 비교다:
  //   '2026.05' <= '2026-06'  →  false  ('.'=46 > '-'=45)
  // 그래서 그 견적이 신고기간에 안 들어가고 매출세액이 0이 됐다.
  await test('점(.) 날짜로 저장된 견적도 부가세 신고에 잡힌다', async () => {
    const run = (dateStr) => page.evaluate((d) => {
      state.projects = [{ name: 'A', stage: 2, received: 0, phases: [], cost: { material: 3300000, labor: 0, outsource: 0 },
                          customer: { name: '', phone: '', addr: '' }, archived: false, doneAt: '2026-05-20' }];
      state.files = [{ id: 'f1', name: '견적.pdf', ext: 'pdf', kind: 'estimate', project: 'A', quote: null,
                       est: { customer: '가', amount: 11000000, supply: 10000000, vat: 1000000, date: d } }];
      state.quotes = []; state.schedule = []; state.expenses = [];
      const v = vatReportData('2026-04', '2026-06');
      return { salesVat: v.salesVat, payable: v.payable, count: v.salesCount };
    }, dateStr);
    const dot = await run('2026.05.10');
    const dash = await run('2026-05-10');
    assert(dot.count === 1, '점 날짜 견적이 매출 집계에서 빠졌다 — 건수 ' + dot.count);
    assert(dot.salesVat === 1000000, '점 날짜면 매출세액이 0이 된다: ' + dot.salesVat);
    assert(dot.payable === 700000, '납부 예상이 틀리다(환급으로 뒤집힘): ' + dot.payable);
    assert(dot.salesVat === dash.salesVat && dot.payable === dash.payable,
      '같은 날짜인데 표기 형식만으로 세액이 달라진다 — 점 ' + dot.payable + ' vs 하이픈 ' + dash.payable);
  });

  await test('이번 달 매출·매출 추이도 점(.) 날짜를 놓치지 않는다', async () => {
    const r = await page.evaluate(() => {
      const seed = (d) => { state.files = [{ id: 'f1', name: '견적.pdf', kind: 'estimate', project: 'A', quote: null,
                                             est: { amount: 11000000, supply: 10000000, vat: 1000000, date: d } }]; };
      const ym = '2026-05';
      const monthOf = () => { let s = 0; (state.files || []).forEach(f => { if (f.kind === 'estimate' && f.est && hjNormDate(f.est.date).slice(0, 7) === ym) s += num(f.est.amount); }); return s; };
      seed('2026.05.10'); const dot = monthOf();
      seed('2026-05-10'); const dash = monthOf();
      return { dot, dash };
    });
    assert(r.dot === r.dash && r.dot === 11000000, '점 날짜가 이번 달 매출에서 빠진다: ' + r.dot + ' vs ' + r.dash);
  });

  await test('parseEstimate 는 앱 표준(YYYY-MM-DD) 날짜를 만든다', async () => {
    const r = await page.evaluate(() => {
      const e = parseEstimate('견 적 서\n작성일 2026. 05. 10\n합계 11,000,000원', '견적.pdf');
      return e && e.date;
    });
    assert(r === '2026-05-10', "parseEstimate 날짜가 앱 표준이 아니다: '" + r + "' (기대 '2026-05-10')");
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

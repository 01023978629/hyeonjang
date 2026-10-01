/* revenue-basis.e2e.js — 매출·청구·수입을 화면마다 같은 한 벌로 센다 (v330, Playwright)

   발굴 검토(2026-09-26)에서 살아남은 매출·정산 집계 결함 여섯 건:
     ① 부가세 신고 준비(vatReportData)·세무 분기 엑셀(exportTaxXlsx)이 state.quotes 를 통째로 더해 ✕ 종결·작성 중 견적까지
        매출세액에 넣었다(세무사에게 그대로 나간다). 정본 hjSalesEntries = projStats.est 와 같은 묶음 + 현장 없는 '수주' 견적만.
     ② 앱 견적이 둘(욕실·주방)인 현장의 청구서·거래명세서가 가장 최근 하나만 청구(대시보드 880만 / 청구서 330만).
        정본 hjEstBill — est 에 든 묶음마다 그 묶음의 앱 견적 품목을 싣는다. 같은 묶음(사본)은 한 번.
     ③ 월말 결산(collectQuotesByMonth)이 현장에 연결된 앱 견적을 빼고 연결 안 된(종결) 견적만 셌다.
     ④ '부가세 별도' 견적에서 청구서(부가세 포함)와 입금 확인 문자·영수증·고객 페이지(공급가 기준)의 잔금이 부가세만큼 달랐다.
        projStats.bill(= 청구서 공사대금 합계)에서 잔금을 뺀다 — 청구 금액 = due, 문자 '계약 …(부가세 포함)'.
     ⑤ 받은 금액을 고치면 남는 정정(amt<0)을 월별 실손익·목표·기간 리포트·연말 결산이 빼서 수입이 부풀었다.
     ⑥ (검토) bill−est 를 부가세라 불렀다 — 수량 0 줄·손으로 고친 금액이 '(부가세 포함)'·잔금 증가로 새었다. billVat 은 분명한
        '부가세 별도' 세액(앱 견적 vatIncluded:false, 이관 견적 세액)만.
   시드는 전부 가상값(가상… 현장, 010-0000-1234).

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjSalesEntries === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
  });

  // ── 시드 ───────────────────────────────────────────────────────────
  //  가상둔산: 욕실 500만+부가세(9/1) · 주방 300만+부가세(9/10) 앱 견적 두 건 + 주방의 사본 둘(다시 저장한 앱 견적·엑셀 — 한 묶음) · 수금 100만
  //  가상거실: '부가세 별도' 1,000만 앱 견적 · 계약금 550만
  //  가상혼합: 앱 견적 220만(부가세 포함) + 다른 공사의 외부 견적 파일 330만(공급가 300만)
  //  현장 없는 견적: ✕ 종결 2,000만 · 작성 중 100만 · 수주 표시 200만(+부가세)
  await page.evaluate(() => {
    const P = (name, received) => ({ name, stage: 3, received, phases: [], cost: {}, customer: { name: '가상고객', phone: '010-0000-1234', addr: '' }, archived: false });
    state.projects = [P('가상둔산', 1000000), P('가상거실', 5500000), P('가상혼합', 0)];
    state.files = []; state.expenses = []; state.schedule = []; state.payLog = [];
    const Q = (id, title, date, project, vatIncluded, price, extra) => Object.assign({ id, no: 'Q-' + id, title, date, place: '', vatIncluded, accountIdx: 0, memo: '', project,
      items: [{ name: title + ' 공사', spec: '', qty: 1, price }] }, extra || {});
    state.quotes = [
      Q('qa', '욕실', '2026-09-01', '가상둔산', true, 5000000),
      Q('qb', '주방', '2026-09-10', '가상둔산', true, 3000000),
      Q('qb2', '주방', '2026-09-08', '가상둔산', true, 3000000),   // 같은 주방 견적을 다시 저장한 사본 — 같은 묶음, 두 번 청구 금지
      Q('qc', '거실', '2026-09-05', '가상거실', false, 10000000),
      Q('qd', '가상혼합', '2026-09-06', '가상혼합', true, 2000000),
      Q('ql', '종결견적', '2026-09-12', null, true, 20000000, { result: 'lost', lost: { at: '2026-09-20', reason: '가격' } }),
      Q('qr', '작성견적', '2026-09-13', null, true, 1000000),
      Q('qw', '수주견적', '2026-09-14', null, true, 2000000, { result: 'won' })
    ];
    state.quotes.filter(q => q.project).forEach(q => syncQuoteToProject(q));
    // 주방 견적을 엑셀로 내보냈다가 다시 불러온 사본 — 같은 현장·같은 금액이라 한 묶음(대표는 엑셀)
    state.files.push({ id: 'xk', name: '주방 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상둔산', when: new Date('2026-09-10'),
      est: { amount: 3300000, supply: 3000000, vat: 300000, customer: '주방', date: '2026-09-10' } });
    state.files.push({ id: 'xm', name: '가상혼합 창호 견적.pdf', ext: 'pdf', kind: 'estimate', project: '가상혼합', when: new Date('2026-09-06'),
      est: { amount: 3300000, supply: 3000000, vat: 300000, customer: '가상혼합 창호', date: '2026-09-06' } });
  });

  const grab = (html, label) => { const i = html.indexOf(label); if (i < 0) return null; const m = html.slice(i).match(/(\d{1,3}(?:,\d{3})+)/); return m ? Number(m[1].replace(/,/g, '')) : null; };

  // ① 부가세 신고 준비·세무 분기 엑셀 — 현장 매출과 같은 규칙
  const sales = await page.evaluate(async () => {
    const v = vatReportData('2026-07', '2026-12');
    const dash = state.projects.reduce((a, p) => a + projStats(p.name).est, 0);
    const oX = window.XLSX, oE = window.ensureXLSX; let wb = null;
    window.ensureXLSX = async () => {};
    window.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: a => a, book_append_sheet: (w, sh, n) => w.sheets.push([n, sh]) }, writeFile: w => { wb = w; } };
    try { await exportTaxXlsx(); } finally { window.XLSX = oX; window.ensureXLSX = oE; }
    const s1 = wb && wb.sheets[0][1], total = s1 && s1[s1.length - 1];
    const detail = wb && wb.sheets[2][1].slice(1).map(r => r[1]);
    return { supply: v.salesSupply, vat: v.salesVat, count: v.salesCount, labels: v.salesRows.map(r => r.label), dash, xlsx: total, detail };
  });
  // 욕실 500만 + 주방 300만(엑셀 사본은 한 번) + 거실 1,000만(별도, 세액 100만) + 가상혼합 200만 + 창호 300만 + 수주 표시 200만
  assert(sales.supply === 25000000 && sales.vat === 2500000 && sales.count === 6,
    '① 부가세 신고 매출 = 현장 매출 + 수주 표시 견적(종결·작성 중 빼고, 사본 한 번): ' + JSON.stringify(sales));
  assert(!sales.labels.includes('종결견적') && !sales.labels.includes('작성견적') && sales.labels.includes('수주견적'),
    '① 종결·작성 중 견적은 매출이 아니다: ' + JSON.stringify(sales.labels));
  assert(sales.xlsx && sales.xlsx[0] === '합계' && sales.xlsx[1] === sales.supply && sales.xlsx[2] === sales.vat && sales.xlsx[4] === sales.count,
    '① 세무 분기 엑셀 합계 = 부가세 신고 준비: ' + JSON.stringify(sales.xlsx));
  assert(!sales.detail.includes('종결견적') && !sales.detail.includes('작성견적'), '① 세무 엑셀 상세에도 종결·작성 중 견적 없음: ' + JSON.stringify(sales.detail));
  // 대시보드(현장 매출 합) = 부가세 신고의 현장 몫 — 가상거실은 별도라 est 가 공급가
  assert(sales.dash === 5500000 + 3300000 + 10000000 + 2200000 + 3300000, '① 대시보드 매출(시드 확인): ' + sales.dash);

  // ③ 월말 결산 — 현장에 연결된 앱 견적이 들어가고, 종결·작성 중 견적은 안 들어간다
  const mc = await page.evaluate(() => { const d = monthlyClosingData('2026-09'); return { total: d.total, count: d.count, srcMix: d.srcMix,
    months: hjMonthList(), html: monthlyQuoteHTML() }; });
  assert(mc.total === 5500000 + 3300000 + 10000000 + 2200000 + 3300000 + 2200000 && mc.count === 6,
    '③ 월말 결산 견적(매출) = 현장 견적 + 수주 표시 견적: ' + JSON.stringify({ total: mc.total, count: mc.count }));
  assert(/작성/.test(mc.srcMix) && /외부/.test(mc.srcMix), '③ 앱 견적(작성)과 외부 견적이 같이 잡힌다: ' + mc.srcMix);
  assert(mc.html.indexOf('26,500,000') >= 0, '③ 월별 견적 현황 표도 같은 값');

  // ② 두 견적 현장 — 청구서·명세서가 두 견적을 합쳐 청구하고 청구 금액 = 잔금(due)
  const two = await page.evaluate(() => { const s = projStats('가상둔산'); const d = settleDocData('가상둔산');
    return { est: s.est, bill: s.bill, due: s.due, inv: invoiceHTML('가상둔산'), st: statementHTML('가상둔산'), items: d.items.map(i => i.name) }; });
  assert(two.est === 8800000 && two.due === 7800000, '② 시드: est 880만·잔금 780만: ' + JSON.stringify({ est: two.est, due: two.due }));
  assert(grab(two.inv, '청구 금액') === two.due && grab(two.inv, '공사대금 합계') === 8800000,
    '② 청구서 청구 금액 = 잔금, 공사대금 합계 = 두 견적 합: ' + grab(two.inv, '청구 금액') + ' / ' + grab(two.inv, '공사대금 합계'));
  assert(two.items.includes('욕실 공사') && two.items.includes('주방 공사') && two.items.length === 2,
    '② 품목에 두 견적이 다 있고 엑셀 사본은 두 번 안 실린다: ' + JSON.stringify(two.items));
  const stTail = two.st.slice(two.st.indexOf('class="row total"'));
  assert(grab(stTail, '합계') === 8800000 && grab(two.st, '잔금') === 7800000, '② 거래명세서 합계·잔금도 같다');

  // 앱 견적 + 다른 공사의 외부 견적 파일 — 외부 파일도 한 줄로 청구, 청구 금액 = 잔금
  const mix = await page.evaluate(() => { const s = projStats('가상혼합'); const d = settleDocData('가상혼합');
    return { est: s.est, due: s.due, inv: invoiceHTML('가상혼합'), items: d.items.map(i => i.name + ':' + i.price) }; });
  assert(mix.est === 5500000 && mix.due === 5500000 && grab(mix.inv, '청구 금액') === 5500000,
    '② 섞인 현장도 청구 금액 = 잔금 = 550만: ' + JSON.stringify({ est: mix.est, due: mix.due, claim: grab(mix.inv, '청구 금액') }));
  assert(mix.items.some(x => /^견적서 — /.test(x) && /:3000000$/.test(x)), '② 외부 견적 파일이 품목표에 공급가 한 줄로: ' + JSON.stringify(mix.items));

  // ④ 부가세 별도 — 청구서·입금 확인 문자·영수증·고객 페이지가 한 잔금
  const off = await page.evaluate(() => {
    const p = state.projects.find(x => x.name === '가상거실'); const s = projStats('가상거실');
    const r = { est: s.est, bill: s.bill, due: s.due, inv: invoiceHTML('가상거실'), txt: receiptText(p, { d: '2026-09-20', amt: 5500000 }),
      rc: receiptHTML('가상거실', 5500000), portal: portalBuild('가상거실') };
    p.received = 10000000; r.txt2 = receiptText(p, { d: '2026-09-25', amt: 4500000 }); r.due2 = projStats('가상거실').due; r.inv2 = invoiceHTML('가상거실');
    p.received = 11000000; r.txt3 = receiptText(p, { d: '2026-09-26', amt: 1000000 }); r.due3 = projStats('가상거실').due;
    p.received = 5500000; return r;
  });
  assert(off.est === 10000000 && off.bill === 11000000, '④ est(매출)는 공급가 그대로, 청구 기준은 부가세 포함: ' + JSON.stringify({ est: off.est, bill: off.bill }));
  assert(off.due === 5500000 && grab(off.inv, '청구 금액') === off.due, '④ 청구 금액 = 잔금 = 550만: ' + off.due + ' / ' + grab(off.inv, '청구 금액'));
  assert(off.txt.indexOf('· 누계 수금: 5,500,000원 / 계약 11,000,000원(부가세 포함)') >= 0 && off.txt.indexOf('· 잔액: 5,500,000원') >= 0,
    '④ 입금 확인 문자 계약·잔액이 청구서와 같다: ' + off.txt);
  assert(grab(off.rc, '공사 잔금') === 5500000, '④ 영수증 공사 잔금 = 550만: ' + grab(off.rc, '공사 잔금'));
  assert(off.portal.payment.due === 5500000 && off.portal.quote.amount === 11000000 && /부가세 1,000,000원 포함/.test(off.portal.quote.summary),
    '④ 고객 페이지 공사 비용 − 입금 = 남은 금액: ' + JSON.stringify(off.portal.quote) + ' / ' + off.portal.payment.due);
  assert(off.due2 === 1000000 && grab(off.inv2, '청구 금액') === 1000000 && off.txt2.indexOf('· 잔액: 1,000,000원') >= 0 && off.txt2.indexOf('모두 정리') < 0,
    '④ 공급가만큼 받았으면 부가세가 남았다고 말한다(\'모두 정리\' 금지): ' + off.txt2);
  assert(off.due3 === 0 && off.txt3.indexOf('잔금까지 모두 정리되었습니다') >= 0, '④ 부가세까지 받으면 정리 문구: ' + off.txt3);

  // 정산 문서 요약 — '견적 − 수금 ≠ 잔금' 인 까닭(부가세 별도)을 화면에 밝힌다
  const sumTxt = await page.evaluate(() => { settleDocs('가상거실'); const t = (document.querySelector('#modalRoot') || {}).textContent || ''; closeModal(); return t; });
  assert(sumTxt.indexOf('견적 1,000만원 (부가세 별도 +100만원)') >= 0 && sumTxt.indexOf('잔금 550만원') >= 0, '④ 정산 문서 요약에 부가세 별도: ' + sumTxt.slice(0, 160));

  // 월말 마감의 잔금 안내 문자도 같은 계약 금액·잔금
  const mcs = await page.evaluate(() => {
    let sms = ''; const oSms = window.hjSendSms; window.hjSendSms = (ph, t) => { sms = t; };
    try { monthCloseView(2); const b = document.querySelector('#modalRoot .mcDue[data-pj="가상거실"]'); if (b) b.click(); }
    finally { window.hjSendSms = oSms; try { closeModal(); } catch (_) {} }
    return sms;
  });
  assert(mcs.indexOf('공사 잔금 5,500,000원 안내드립니다') >= 0 && mcs.indexOf('(계약 11,000,000원(부가세 포함) · 수금 5,500,000원)') >= 0,
    '④ 월말 마감 잔금 안내 문자도 같은 기준: ' + mcs);

  // 부가세 포함 견적만 있는 현장은 옛 문구 그대로('(부가세 포함)' 꼬리 없음)
  const incl = await page.evaluate(() => receiptText(state.projects.find(x => x.name === '가상둔산'), { d: '2026-09-20', amt: 1000000 }));
  assert(incl.indexOf('· 누계 수금: 1,000,000원 / 계약 8,800,000원\n· 잔액: 7,800,000원') >= 0, '④ 포함 견적은 옛 글자 그대로: ' + incl);

  // 월말 마감 2단계 줄도 잔금과 같은 계약 금액(줄 '계약' 과 문자가 다르면 셈이 안 맞는다)
  const mcRow = await page.evaluate(() => { monthCloseView(2); const b = document.querySelector('#modalRoot .mcDue[data-pj="가상거실"]');
    const t = b ? b.parentElement.textContent : ''; closeModal(); return t; });
  assert(mcRow.indexOf('계약 11,000,000원(부가세 포함)') >= 0, '④ 월말 마감 줄의 계약도 청구 기준: ' + mcRow);

  // 분할납 계획 — 부가세 별도 견적이면 계획(공급가)과 잔금(부가세 포함)의 차이를 밝힌다(나누는 기준은 대표 결정)
  const pp = await page.evaluate(() => { payPlanDialog('가상거실'); const a = !!document.querySelector('#modalRoot #ppVatNote'); closeModal();
    payPlanDialog('가상둔산'); const b = !!document.querySelector('#modalRoot #ppVatNote'); closeModal(); return { a, b }; });
  assert(pp.a && !pp.b, '④ 분할납 계획의 부가세 별도 안내는 별도 견적 현장에만: ' + JSON.stringify(pp));

  // ⑥ 청구 − 매출 차이를 '부가세'라 부르지 않는다(v330 검토)
  //  가상수량0: 부가세 포함 견적에 '선택: 비데(미포함)' 수량 0 줄 — quoteCalc 는 0 으로 센다, 청구도 0 이어야 한다
  //  가상고침: 인식값 1,100만(공급가 1,000만)을 손으로 1,000만('부가세 빼고')으로 고친 외부 파일 — 부가세를 되얹지 않는다
  //  가상이관: 전체장부 엑셀로 이사한 부가세 별도 현장(_import + 세액) — 분명한 신호라 부가세를 얹는다, 금액을 고치면 안 얹는다
  const six = await page.evaluate(() => {
    const P = (name, received) => ({ name, stage: 3, received, phases: [], cost: {}, customer: { name: '가상고객', phone: '010-0000-1234', addr: '' }, archived: false });
    state.projects.push(P('가상수량0', 1000000), P('가상고침', 0), P('가상이관', 0));
    const q = { id: 'qz', no: 'Q-qz', title: '욕실', date: '2026-09-15', place: '', vatIncluded: true, accountIdx: 0, memo: '', project: '가상수량0',
      items: [{ name: '욕실 공사', spec: '', qty: 1, price: 5000000 }, { name: '선택: 비데(미포함)', spec: '', qty: 0, price: 300000 }] };
    state.quotes.push(q); syncQuoteToProject(q);
    state.files.push({ id: 'xe', name: '가상고침 견적.pdf', ext: 'pdf', kind: 'estimate', project: '가상고침', when: new Date('2026-09-16'),
      est: { amount: 10000000, supply: 10000000, vat: 1000000, customer: '가상고침', date: '2026-09-16', _edited: true } });
    const fi = { id: 'xi', name: '이관 견적_가상이관.xlsx', kind: 'estimate', project: '가상이관', when: new Date('2026-09-17'), _import: true,
      est: { amount: 10000000, supply: 10000000, vat: 1000000, customer: '가상이관', date: '2026-09-17' } };
    state.files.push(fi);
    const pick = n => { const s = projStats(n); return { est: s.est, bill: s.bill, billVat: s.billVat, due: s.due, inv: invoiceHTML(n),
      txt: receiptText(state.projects.find(x => x.name === n), { d: '2026-09-20', amt: 1000000 }), portal: portalBuild(n).quote }; };
    const r = { z: pick('가상수량0'), e: pick('가상고침'), i: pick('가상이관') };
    fi.est._edited = true; r.i2 = pick('가상이관'); delete fi.est._edited;
    return r;
  });
  assert(six.z.est === 5500000 && six.z.bill === 5500000 && six.z.billVat === 0 && six.z.due === 4500000 && grab(six.z.inv, '청구 금액') === 4500000,
    '⑥ 수량 0 줄은 청구에도 0 — 잔금 450만: ' + JSON.stringify({ est: six.z.est, bill: six.z.bill, billVat: six.z.billVat, due: six.z.due, claim: grab(six.z.inv, '청구 금액') }));
  assert(six.z.txt.indexOf('/ 계약 5,500,000원\n· 잔액: 4,500,000원') >= 0 && !/부가세/.test(six.z.portal.summary) && six.z.portal.amount === 5500000,
    '⑥ 포함 견적 현장 문자·고객 페이지에 가짜 부가세 없음: ' + six.z.txt + ' / ' + JSON.stringify(six.z.portal));
  assert(six.e.bill === 10000000 && six.e.billVat === 0 && six.e.due === 10000000 && grab(six.e.inv, '청구 금액') === 10000000 && six.e.txt.indexOf('(부가세 포함)') < 0,
    '⑥ 손으로 고친 금액은 부가세 포함 합계로 본다: ' + JSON.stringify({ bill: six.e.bill, billVat: six.e.billVat, due: six.e.due, claim: grab(six.e.inv, '청구 금액') }));
  assert(six.i.bill === 11000000 && six.i.billVat === 1000000 && six.i.due === 11000000 && grab(six.i.inv, '청구 금액') === 11000000 && six.i.txt.indexOf('계약 11,000,000원(부가세 포함)') >= 0,
    '⑥ 이관 견적의 세액은 분명한 신호 — 부가세를 얹는다: ' + JSON.stringify({ bill: six.i.bill, billVat: six.i.billVat, due: six.i.due }));
  const warn = await page.evaluate(() => { const r = {};
    // 가상공급가없음: 금액만 읽힌 외부 파일 — 공급가를 모를 뿐 '공급가 = 합계' 가 아니다(확인 요청 대상 아님)
    state.projects.push({ name: '가상공급가없음', stage: 3, received: 0, phases: [], cost: {}, customer: { name: '가상고객', phone: '010-0000-1234', addr: '' }, archived: false });
    state.files.push({ id: 'xn', name: '가상공급가없음 견적.pdf', ext: 'pdf', kind: 'estimate', project: '가상공급가없음', when: new Date('2026-09-18'),
      est: { amount: 3300000, customer: '가상공급가없음', date: '2026-09-18' } });
    ['가상고침', '가상이관', '가상거실', '가상공급가없음'].forEach(n => { settleDocs(n); const el = document.querySelector('#modalRoot #sdVatUnknown');
    r[n] = el ? el.textContent : ''; closeModal(); }); return r; });
  assert(/가상고침/.test(warn['가상고침']) && /공급가와 합계가 같아/.test(warn['가상고침']) && !warn['가상이관'] && !warn['가상거실'] && !warn['가상공급가없음'],
    '⑥ 신호 없는 공급가=합계 파일은 정산 문서 화면이 사람에게 확인을 청한다: ' + JSON.stringify(warn));
  assert(six.i2.bill === 10000000 && six.i2.billVat === 0, '⑥ 이관 견적도 금액을 고치면 부가세를 안 얹는다: ' + JSON.stringify({ bill: six.i2.bill, billVat: six.i2.billVat }));

  // ⑤ 받은 금액 정정(amt<0)이 수입에 들어간다
  const pl = await page.evaluate(() => {
    const ym = localDate().slice(0, 7), y = ym.slice(0, 4);
    // 가상혼합은 작년 말에 넣은 100만을 이번 달에 0 으로 고쳤다 — 이 달·올해 그 현장 합은 −100만(순위에는 안 나온다)
    state.payLog = [{ d: ym + '-01', project: '가상둔산', amt: 50000000 }, { d: ym + '-02', project: '가상둔산', amt: -45000000 },
      { d: ym + '-01', project: '가상거실', amt: 5500000 }, { d: (+y - 1) + '-12-31', project: '가상혼합', amt: 1000000 }, { d: ym + '-03', project: '가상혼합', amt: -1000000 }];
    state.expenses = [];
    const pn = pnlData(ym), g = goalProgress(), yr = yearReportData(y), mcd = monthlyClosingData(ym), op = opsReportData('month');
    return { pnl: pn.income, top: pn.incomeTop, goal: g.monthRecv, goalY: g.yearRecv, year: yr.income, best: yr.best, mc: mcd.paySum, ops: op.income };
  });
  assert(pl.pnl === 9500000 && pl.mc === 9500000, '⑤ 월별 실손익 수입 = 월말 결산 수금 = 950만: ' + JSON.stringify({ pnl: pl.pnl, mc: pl.mc }));
  assert(pl.goal === 9500000 && pl.goalY === 9500000, '⑤ 목표 달성(이번 달·올해)도 정정 포함: ' + JSON.stringify({ m: pl.goal, y: pl.goalY }));
  assert(pl.ops === 9500000, '⑤ 기간(월) 운영 리포트 수금도 정정 포함: ' + pl.ops);
  assert(pl.year === 9500000 && pl.best.length === 2 && pl.best[0].name === '가상거실' && pl.best[0].amt === 5500000 && pl.best[1].amt === 5000000,
    '⑤ 연말 결산 수입·올해의 현장 순위도 정정 뒤 값: ' + JSON.stringify({ year: pl.year, best: pl.best }));
  assert(pl.top.every(x => x.amt > 0) && pl.top.find(x => x.name === '가상둔산').amt === 5000000, '⑤ 월 현장별 수입 순위도 정정 뒤 값: ' + JSON.stringify(pl.top));

  assert(!errors.length, 'pageerror: ' + errors.join(' | '));
  console.log('revenue-basis.e2e OK (① 부가세·세무 엑셀 ② 두 견적 청구 ③ 월말 결산 ④ 부가세 별도 잔금 ⑤ 정정 포함 ⑥ 가짜 부가세 없음)');
  await browser.close();
  process.exit(0);
})().catch(async e => { console.log('FAIL ' + (e && e.message || e)); try { await browser.close(); } catch (_) {} process.exit(1); });

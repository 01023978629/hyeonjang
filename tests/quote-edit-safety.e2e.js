/* quote-edit-safety.e2e.js — 견적 편집·저장이 매출을 조용히 바꾸지 않게 (Playwright, v330)

   2026-09-26 발굴 검토(발견자 + 반박자 둘이 모두 인정)에서 살아남은 다섯 결함:
     ① 견적·정산 목록 [✍ 편집]이 부가세 포함 총액에 10%를 또 얹은 새 사본을 만들고, 저장하면 현장 매출이 두 번 잡혔다.
        → 앱 견적은 원래 견적을 그대로 연다(editQuote). 엑셀·PDF 견적은 부가세 포함/별도를 사람이 고른다 —
          어느 쪽이든 편집기 총액은 원래 금액 그대로, 저장하면 원래 파일은 집계 제외(exSum)라 한 번만 센다.
     ② AI 견적 초안이 저장 목록(state.quotes)과 같은 객체라 [목록으로]로 버려도 남고 다음 부팅에 매출·수주로 잡혔다.
        → 초안은 편집기에만(저장해야 목록에), [목록으로]는 저장 안 한 변경이 있으면 묻는다. 목록에는 복사본을 넣는다.
     ③ 견적 이력 [📤 보냄]이 종결·수주 표시와 종결 사유를 지웠다 → 보낸 날짜만 켜고 끈다.
     ④ 견적·정산 목록에서 앱 견적 금액을 고치면 다시 불러올 때 조용히 원래 값으로 돌아갔다 → 그 칸은 읽기 전용,
        고치려 하면 견적 편집기로 안내한다.
     ⑤ 되돌리기·서버 병합 뒤 없어진 견적의 파생 파일(quote_<id>)이 남아 매출·미수에 잡혔다 → applyData 가 뺀다.

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
  page.on('dialog', d => d.dismiss());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.quoteFromExisting === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const modalOpen = () => page.evaluate(() => !!document.querySelector('#modalRoot .modal'));
  const clickModal = async (label) => {
    const ok = await page.evaluate((label) => {
      const b = [...document.querySelectorAll('#modalRoot button')].find(x => x.textContent.trim() === label);
      if (!b) return false; b.click(); return true;
    }, label);
    assert(ok, '모달 버튼 없음: ' + label + ' / ' + await page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || ''));
  };
  const modalButtons = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot button')].map(b => b.textContent.trim()));

  // 시드 — 가짜 현장 넷, 앱 견적 하나(공급가 1,000만·부가세 포함 1,100만), 엑셀·PDF 에서 읽은 견적 파일 셋.
  const seed = () => page.evaluate(() => {
    const P = (name) => ({ name, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false });
    state.projects = ['가현장', '나현장', '다현장', '라현장', '마현장'].map(P);
    state.quotes = [{ id: 'q1', title: '가현장 도배', no: '제20260920', date: '2026-09-20', place: '', vatIncluded: true, accountIdx: 0, memo: '', project: '가현장',
      items: [{ name: '도배', spec: '', qty: 1, price: 10000000 }] }];
    const EF = (id, name, project, est) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, when: new Date('2026-09-01'), est, exSum: false });
    state.files = [
      EF('ex1', '나현장 견적.xlsx', '나현장', { amount: 5500000, customer: '나현장', date: '2026-09-10' }),
      EF('ex2', '다현장 견적.pdf', '다현장', { amount: 3000000, customer: '다현장', date: '2026-09-11' }),
      EF('ex3', '마현장 견적.xlsx', '마현장', { amount: 2200000, supply: 2000000, vat: 200000, customer: '마현장', date: '2026-09-12' }),
    ];
    state.quotes.forEach(q => syncQuoteToProject(q));
    state.editingQuote = null; closeModal();
  });
  await seed();
  assert(await page.evaluate(() => projStats('가현장').est) === 11000000, '시드: 가현장 매출 1,100만');

  // ── ① 앱 견적 [✍ 편집] = 원래 견적을 연다 ──
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="quote_q1"]');
  let r = await page.evaluate(() => ({ tab: state.tab, id: state.editingQuote && state.editingQuote.id, total: state.editingQuote && quoteCalc(state.editingQuote).total, same: state.editingQuote === state.quotes[0] }));
  assert(r.tab === 'quotemaker' && r.id === 'q1', '① 앱 견적은 원래 견적(q1)을 연다: ' + JSON.stringify(r));
  assert(r.total === 11000000, '① 편집기 총액에 부가세가 또 붙지 않는다(1,100만): ' + r.total);
  assert(!r.same, '① 편집기는 목록의 복사본이다');
  await page.click('#qmSave');
  r = await page.evaluate(() => ({ n: state.quotes.length, est: projStats('가현장').est, files: state.files.filter(f => f._fromQuote).length }));
  assert(r.n === 1 && r.est === 11000000 && r.files === 1, '① 저장해도 견적 하나·매출 1,100만 그대로: ' + JSON.stringify(r));

  // ① 엑셀·PDF 견적 — 부가세를 모르면 사람이 고른다(고르기 전엔 편집기를 열지 않는다)
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex1"]');
  assert(await modalOpen(), '① 추출 견적은 부가세 포함/별도를 묻는다');
  assert(await page.evaluate(() => state.editingQuote === null), '① 고르기 전엔 편집기를 열지 않는다');
  assert((await modalButtons()).includes('부가세 포함 금액') && (await modalButtons()).includes('부가세 별도(이 금액이 공급가)'), '① 두 선택지: ' + await modalButtons());
  await clickModal('부가세 포함 금액');
  r = await page.evaluate(() => { const q = state.editingQuote; return { vat: q.vatIncluded, price: q.items[0].price, total: quoteCalc(q).total, project: q.project }; });
  assert(r.vat === true && r.price === 5000000 && r.total === 5500000 && r.project === '나현장', '① 포함: 공급가 역산, 총액은 원래 금액 그대로: ' + JSON.stringify(r));
  await page.click('#qmSave');
  r = await page.evaluate(() => ({ est: projStats('나현장').est, exSum: state.files.find(f => f.id === 'ex1').exSum, hasSrc: state.quotes.some(q => '_srcFileId' in q) }));
  assert(r.est === 5500000, '① 저장 뒤 나현장 매출이 두 번 잡히지 않는다(550만): ' + r.est);
  assert(r.exSum === true && !r.hasSrc, '① 원래 파일은 집계 제외, 연결 표시는 저장되지 않는다: ' + JSON.stringify(r));
  assert(/원래 견적 파일은 매출 집계에서 뺐어요/.test(await lastToast()), '① 원래 파일을 집계에서 뺐다고 알린다: ' + await lastToast());
  r = await page.evaluate(() => { applyData(JSON.parse(JSON.stringify(serializeData()))); return projStats('나현장').est; });
  assert(r === 5500000, '① 다시 불러와도 550만: ' + r);
  // 별도를 고르면 그 금액이 공급가, 총액은 그대로
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex2"]');
  await clickModal('부가세 별도(이 금액이 공급가)');
  r = await page.evaluate(() => { const q = state.editingQuote; return { vat: q.vatIncluded, total: quoteCalc(q).total }; });
  assert(r.vat === false && r.total === 3000000, '① 별도: 총액 300만 그대로: ' + JSON.stringify(r));
  await page.evaluate(() => closeQuoteEdit(true));
  // 공급가·세액이 읽혀 있고 맞으면 묻지 않는다
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex3"]');
  r = await page.evaluate(() => ({ modal: !!document.querySelector('#modalRoot .modal'), q: state.editingQuote && { vat: state.editingQuote.vatIncluded, total: quoteCalc(state.editingQuote).total } }));
  assert(!r.modal && r.q && r.q.vat === true && r.q.total === 2200000, '① 공급가+세액이 맞으면 포함으로 바로 연다: ' + JSON.stringify(r));
  await page.evaluate(() => closeQuoteEdit(true));
  // 10% 로 딱 나눠지지 않는 금액은 '포함'으로 공급가를 짓지 않는다
  r = await page.evaluate(() => ({ a: quoteSupplyForTotal(11000000), b: quoteSupplyForTotal(16), c: quoteSupplyForTotal(0) }));
  assert(r.a === 10000000 && r.b === null && r.c === null, '① 공급가 역산은 딱 맞을 때만: ' + JSON.stringify(r));
  await page.evaluate(() => { state.files.find(f => f.id === 'ex2').est.amount = 16; state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex2"]');
  assert(!(await modalButtons()).includes('부가세 포함 금액'), '① 나눠지지 않는 금액엔 포함 선택지가 없다');
  await page.evaluate(() => { closeModal(); state.files.find(f => f.id === 'ex2').est.amount = 3000000; });

  // ① 같은 견적의 사본(엑셀 원본 + 그 출력 PDF)이 있으면 묶음 전체를 뺀다 — 금액을 고쳐 저장해도 옛 사본이 남아 두 번 세지 않는다.
  //    (검토 재현: 누른 파일만 빼면 PDF 사본이 대표가 되어 550만 + 660만 = 1,210만.) 이름이 다른 별개 견적은 그대로 센다.
  const seedCopies = () => page.evaluate(() => {
    const EF = (id, name, ext, amount) => ({ id, name, ext, kind: 'estimate', project: '나현장', when: new Date('2026-09-01'), est: { amount, customer: '나현장', date: '2026-09-10' }, exSum: false });
    state.files.push(EF('ex4', '나현장 견적.pdf', 'pdf', 5500000), EF('ex5', '나현장 욕실 추가.xlsx', 'xlsx', 1000000));
  });
  await seed(); await seedCopies();
  assert(await page.evaluate(() => projStats('나현장').est) === 6500000, '① 시드: 엑셀·PDF 사본은 한 번(550만) + 별개 욕실 100만');
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex1"]');
  await clickModal('부가세 포함 금액');
  await page.evaluate(() => { setQuoteItem(0, 'price', 6000000); });
  await page.click('#qmSave');
  r = await page.evaluate(() => ({ est: projStats('나현장').est, ex: ['ex1', 'ex4', 'ex5'].map(id => !!state.files.find(f => f.id === id).exSum) }));
  assert(r.est === 7600000, '① 금액을 고쳐 저장해도 옛 사본이 남지 않는다(660만 + 별개 100만): ' + JSON.stringify(r));
  assert(r.ex[0] && r.ex[1] && !r.ex[2], '① 원본과 사본만 빼고 별개 견적은 둔다: ' + JSON.stringify(r));
  assert(/2개\(같은 견적의 사본 포함\)/.test(await lastToast()), '① 뺀 파일 수를 알린다: ' + await lastToast());

  // ① PDF 출력 전 자동 저장도 같은 한 곳을 지난다 — 복사본·원본 묶음 제외·안내
  await seed(); await seedCopies();
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  await page.click('[data-toedit="ex1"]');
  await clickModal('부가세 포함 금액');
  await page.evaluate(() => { setQuoteItem(0, 'price', 6000000); });
  await page.click('#qmPdf');
  r = await page.evaluate(() => ({ n: state.quotes.length, est: projStats('나현장').est, ex: ['ex1', 'ex4'].map(id => !!state.files.find(f => f.id === id).exSum), same: state.quotes.includes(state.editingQuote), leak: state.quotes.some(q => '_srcFileId' in q) }));
  assert(r.n === 2 && r.est === 7600000 && r.ex[0] && r.ex[1], '① PDF 전 자동 저장도 원본 묶음을 뺀다: ' + JSON.stringify(r));
  assert(!r.same && !r.leak, '① PDF 전 자동 저장도 목록에 복사본(연결 표시 없음): ' + JSON.stringify(r));
  assert(/집계에서 뺐어요/.test(await lastToast()), '① PDF 경로도 원본을 뺐다고 알린다: ' + await lastToast());
  await page.evaluate(() => { setQuoteItem(0, 'price', 1); });
  r = await page.evaluate(() => { const q = state.quotes.find(x => x.id === state.editingQuote.id); return { price: q.items[0].price, est: projStats('나현장').est }; });
  assert(r.price === 6000000 && r.est === 7600000, '② PDF 뒤 고친 값은 [저장] 없이 목록에 남지 않는다: ' + JSON.stringify(r));
  await page.click('#qmClose');
  assert(await modalOpen(), '② PDF 뒤 고친 값이 있으면 [목록으로]가 묻는다');
  await clickModal('저장 안 하고 나가기');
  // 이미 집계에서 뺀 엑셀을 편집해도 남아 있던 PDF 사본을 찾아 뺀다(estimateGroups 는 뺀 파일을 건너뛰어 묶음을 못 찾는다)
  await seed(); await seedCopies();
  await page.evaluate(() => { state.files.find(f => f.id === 'ex1').exSum = true; quoteFromExisting('ex1'); });
  await clickModal('부가세 포함 금액');
  await page.evaluate(() => { setQuoteItem(0, 'price', 6000000); });
  await page.click('#qmSave');
  r = await page.evaluate(() => ({ est: projStats('나현장').est, ex4: !!state.files.find(f => f.id === 'ex4').exSum }));
  assert(r.est === 7600000 && r.ex4, '① 원본이 이미 빠져 있어도 사본을 뺀다: ' + JSON.stringify(r));

  // ── ② AI 견적 초안은 저장 전까지 목록에 없다, [목록으로]는 묻는다 ──
  await seed();
  await page.evaluate(async () => { await aiToolRun('create_quote_draft', { title: '라현장 도배', project: '라현장', items: [{ name: '도배', qty: 1, price: 3000000 }] }); });
  r = await page.evaluate(() => ({ inList: state.quotes.some(q => q.title === '라현장 도배'), editing: !!state.editingQuote, tab: state.tab }));
  assert(!r.inList && r.editing && r.tab === 'quotemaker', '② 초안은 편집기에만(저장 전 목록에 없음): ' + JSON.stringify(r));
  await page.evaluate(() => { setQuoteItem(0, 'price', 9000000); });
  await page.click('#qmClose');
  assert(await modalOpen(), '② 저장 안 한 초안에서 [목록으로]는 묻는다');
  assert(await page.evaluate(() => !!state.editingQuote), '② 묻는 동안 초안은 그대로');
  await clickModal('계속 편집');
  assert(await page.evaluate(() => !!state.editingQuote && !document.querySelector('#modalRoot .modal')), '② 계속 편집');
  await page.click('#qmClose');
  await clickModal('저장 안 하고 나가기');
  r = await page.evaluate(() => { const a = { editing: state.editingQuote, n: state.quotes.length, est: projStats('라현장').est };
    applyData(JSON.parse(JSON.stringify(serializeData()))); a.estReload = projStats('라현장').est; a.nReload = state.quotes.length; return a; });
  assert(r.editing === null && r.n === 1 && r.est === 0 && r.estReload === 0 && r.nReload === 1, '② 버린 초안은 남지 않고 다음 부팅에도 매출 0: ' + JSON.stringify(r));
  // 저장하고 나가기 → 목록·매출에 한 번
  await page.evaluate(async () => { await aiToolRun('create_quote_draft', { title: '라현장 도배', project: '라현장', items: [{ name: '도배', qty: 1, price: 3000000 }] }); });
  await page.click('#qmClose');
  await clickModal('저장하고 나가기');
  r = await page.evaluate(() => ({ n: state.quotes.filter(q => q.title === '라현장 도배').length, est: projStats('라현장').est, editing: state.editingQuote }));
  assert(r.n === 1 && r.est === 3300000 && r.editing === null, '② 저장하고 나가면 목록·매출에 한 번: ' + JSON.stringify(r));
  // AI 견적(말로 설명) — 같은 규칙. 키·응답은 가짜
  await page.evaluate(() => { window.__geminiKey = 'TEST-FAKE-GEMINI-KEY'; window.geminiAsk = async () => '[{"name":"장판","qty":1,"price":1000000}]'; });
  r = await page.evaluate(async () => { const n = state.quotes.length; const res = await aiQuoteFromText('라현장 장판 교체', '라현장'); return { res, n0: n, n: state.quotes.length, editing: !!state.editingQuote, same: state.quotes.includes(state.editingQuote), tab: state.tab }; });
  assert(!r.res.오류 && r.n === r.n0 && r.editing && !r.same && r.tab === 'quotemaker', '② AI 견적도 저장 전엔 목록에 없다: ' + JSON.stringify(r));
  await page.evaluate(() => closeQuoteEdit(true));
  // 저장된 견적을 열고 아무것도 안 고쳤으면 묻지 않는다, 고쳤으면 묻는다
  await page.evaluate(() => { editQuote('q1'); state.tab = 'quotemaker'; render(); });
  await page.click('#qmClose');
  assert(!(await modalOpen()) && await page.evaluate(() => state.editingQuote === null), '② 안 고친 견적은 바로 닫힌다');
  await page.evaluate(() => { editQuote('q1'); state.tab = 'quotemaker'; render(); setQuoteField('title', '고친 제목'); });
  await page.click('#qmClose');
  assert(await modalOpen(), '② 고친 견적은 묻는다');
  await clickModal('저장 안 하고 나가기');
  assert(await page.evaluate(() => state.quotes.find(q => q.id === 'q1').title === '가현장 도배'), '② 버리면 원래 제목');
  // 목록에는 복사본 — 저장(또는 PDF 전 자동 저장) 뒤 계속 고친 값이 [저장] 없이 목록에 새지 않는다
  r = await page.evaluate(() => { editQuote('q1'); const eq = state.editingQuote; quoteCommitEditing(eq); const stored = state.quotes.find(q => q.id === 'q1'); eq.items[0].price = 1; const a = { same: stored === eq, price: stored.items[0].price }; state.editingQuote = null; return a; });
  assert(!r.same && r.price === 10000000, '② 목록에는 복사본을 넣는다: ' + JSON.stringify(r));

  // ── ③ [📤 보냄]은 종결·수주를 지우지 않는다 ──
  await page.evaluate(() => {
    state.quotes.push({ id: 'q3', title: '종결 견적', no: 'x', date: '2026-09-15', vatIncluded: true, accountIdx: 0, memo: '', project: null, items: [{ name: 'a', spec: '', qty: 1, price: 100 }], result: 'lost', lost: { at: '2026-09-20', reason: '가격' } });
    state.quotes.push({ id: 'q4', title: '수주 표시 견적', no: 'y', date: '2026-09-15', vatIncluded: true, accountIdx: 0, memo: '', project: null, items: [{ name: 'a', spec: '', qty: 1, price: 100 }], result: 'won' });
    quoteMark('q3', 'sent'); quoteMark('q4', 'sent'); closeModal();
  });
  r = await page.evaluate(() => { const q3 = state.quotes.find(q => q.id === 'q3'), q4 = state.quotes.find(q => q.id === 'q4');
    return { s3: quoteStatus(q3), reason: q3.lost && q3.lost.reason, sent3: !!q3.sentAt, s4: quoteStatus(q4), sent4: !!q4.sentAt, follow: quoteFollowupData().some(x => x.id === 'q3' || x.id === 'q4') }; });
  assert(r.s3 === 'lost' && r.reason === '가격' && r.sent3, '③ 종결 견적에 보냄을 눌러도 종결·사유 그대로: ' + JSON.stringify(r));
  assert(r.s4 === 'won' && r.sent4 && !r.follow, '③ 수주 표시도 그대로, 팔로업으로 안 돌아온다: ' + JSON.stringify(r));
  await page.evaluate(() => { quoteMark('q3', 'sent'); closeModal(); });
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q3'); return !q.sentAt && q.result === 'lost' && q.lost.reason === '가격'; }), '③ 보냄을 풀어도 종결 그대로');

  // ── ④ 앱 견적 줄의 금액 칸은 읽기 전용, 고치려 해도 값이 바뀌지 않는다 ──
  await seed();
  await page.evaluate(() => { state.tab = 'estimates'; render(); });
  r = await page.evaluate(() => { const a = document.querySelector('input[data-ef="amount"][data-id="quote_q1"]'), b = document.querySelector('input[data-ef="amount"][data-id="ex1"]');
    const c = document.querySelector('input[data-ef="customer"][data-id="quote_q1"]');
    return { ro: a && a.readOnly, roCust: c && c.readOnly, other: b && b.readOnly, note: /편집에서 수정/.test(a.closest('td').textContent) }; });
  assert(r.ro === true && r.roCust === true && r.other === false && r.note, '④ 앱 견적 칸만 읽기 전용 + 안내: ' + JSON.stringify(r));
  r = await page.evaluate(() => { const a = document.querySelector('input[data-ef="amount"][data-id="quote_q1"]'); a.value = '9,500,000'; a.dispatchEvent(new Event('change', { bubbles: true }));
    return { amt: state.files.find(f => f.id === 'quote_q1').est.amount, est: projStats('가현장').est }; });
  assert(r.amt === 11000000 && r.est === 11000000, '④ 앱 견적 금액은 목록에서 바뀌지 않는다(조용한 되돌림 없음): ' + JSON.stringify(r));
  assert(/편집/.test(await lastToast()), '④ 견적 편집기로 안내: ' + await lastToast());
  r = await page.evaluate(() => { const b = document.querySelector('input[data-ef="amount"][data-id="ex1"]'); b.value = '5,000,000'; b.dispatchEvent(new Event('change', { bubbles: true })); return state.files.find(f => f.id === 'ex1').est.amount; });
  assert(r === 5000000, '④ 추출 견적 금액은 예전처럼 고친다: ' + r);
  // 일괄 배정(붙여넣기·자동 매칭)도 앱 견적 가상 파일은 건드리지 않는다 — 고쳐도 다음 불러오기에 조용히 되돌아간다
  r = await page.evaluate(() => { const a = applyBulkAssign([{ id: 'quote_q1', project: '나현장', amount: 1 }, { name: '[견적서] 가현장', project: '나현장', amount: 2 }, { id: 'ex2', project: '다현장', amount: 3100000 }]);
    const f = state.files.find(x => x.id === 'quote_q1'); return { a, pj: f.project, amt: f.est.amount, ex2: state.files.find(x => x.id === 'ex2').est.amount }; });
  assert(r.a.applied === 1 && r.a.fromQuote === 2 && r.pj === '가현장' && r.amt === 11000000 && r.ex2 === 3100000, '④ 일괄 배정은 앱 견적을 건너뛰고 센다: ' + JSON.stringify(r));

  // ── ⑤ 되돌리기·병합 뒤 없는 견적의 파생 파일은 남지 않는다 ──
  await seed();
  r = await page.evaluate(() => {
    const before = JSON.parse(JSON.stringify(serializeData()));
    state.quotes.push({ id: 'qx', title: '가상A 견적', no: 'z', date: '2026-09-21', vatIncluded: false, accountIdx: 0, memo: '', project: '라현장', items: [{ name: '철거', spec: '', qty: 1, price: 1000000 }] });
    syncQuoteToProject(state.quotes[state.quotes.length - 1]);
    const mid = projStats('라현장').est;
    applyData(before, { revert: true });
    return { mid, after: projStats('라현장').est, due: projStats('라현장').due, ghost: state.files.filter(f => f._fromQuote).map(f => f.id), q1: projStats('가현장').est };
  });
  assert(r.mid === 1000000, '⑤ 시드: 되돌리기 전 100만: ' + JSON.stringify(r));
  assert(r.after === 0 && !r.due && !r.ghost.includes('quote_qx'), '⑤ 되돌리기 뒤 없는 견적의 매출·미수 0: ' + JSON.stringify(r));
  assert(r.ghost.includes('quote_q1') && r.q1 === 11000000, '⑤ 남은 견적의 파생 파일은 그대로: ' + JSON.stringify(r));
  // 서버 병합 — 다른 기기에서 현장 연결을 푼 견적
  r = await page.evaluate(() => {
    const d = JSON.parse(JSON.stringify(serializeData()));
    d.quotes.find(q => q.id === 'q1').project = null;
    applyData(d);
    return { est: projStats('가현장').est, ghost: state.files.some(f => f.id === 'quote_q1') };
  });
  assert(r.est === 0 && !r.ghost, '⑤ 병합으로 현장 연결이 풀린 견적도 파생 파일을 뺀다: ' + JSON.stringify(r));

  // 저장 구조 그대로 — 최상위 키 수, 견적 레코드에 편집 연결 표시가 새지 않는다
  r = await page.evaluate(() => { const d = serializeData(); return { keys: Object.keys(d).length, leak: JSON.stringify(d.quotes).includes('_srcFileId') }; });
  assert(!r.leak, '저장본에 _srcFileId 가 없다');
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('PASS quote-edit-safety ①~⑤ (최상위 키 ' + r.keys + ')');
  await browser.close();
})().catch(async e => { console.error('FAIL', e.message); try { await browser.close(); } catch (_) {} process.exit(1); });

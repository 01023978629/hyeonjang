/* calc-safety.e2e.js — 자재 계산기·물량·발주가 조용히 틀리던 여섯 자리 (Playwright)

   2026-09-26 v331 2차 발굴에서 살아남은 결함. 지키는 것:
     ① 계산 화면을 다시 열어 보기만 해서는 작업기록이 늘지 않는다(세션 기억으로 칸이 채워진 채 열려도) —
        「🧺 이 현장 담기」 물량이 두 배가 되지 않는다
     ② 다른 현장에서 계산기를 열면 이전 현장의 면적으로 시작하지 않고, 보기만 해서는 그 현장 이름으로 기록이 생기지 않는다
     ③ 📐 실측 노트에서 다른 현장(B)의 방을 🧮 로 넘기면 기록·🧺 발주 담기·📝 현장 메모가 활성 현장(A)이 아니라 B 로 간다,
        같은 방을 두 번 넘겨도 기록은 한 건
     ④ 자재 재고의 「🚚 발주서 만들기」는 부족한 재고만 올린다(최근 견적 품목·현장 이름을 끌어오지 않는다)
     ⑤ 예상 자재비·견적 단가·발주 금액은 규격(판 크기·각재 길이)이 맞는 자재 값만 — 규격을 모르면 값을 붙이지 않는다
     ⑥ 폭 재단 도배(로스를 곱하지 않는 계산)와 올림 발주 레미콘의 '내 로스'는 실제 계산에 맞게 되짚고,
        폭 재단 기록으로 면적법 로스 ⭐ 기본값을 제안하지 않는다
     ⑦ pageerror 0

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
  let sayYes = true;
  page.on('dialog', d => (sayYes ? d.accept() : d.dismiss()));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.materialCalc === 'function' && typeof window.inventoryManage === 'function' && !!window.__hjRestoreDone);
  await page.evaluate(() => Promise.resolve(window.__hjRestoreDone).catch(() => 0));   // 부팅 복원이 state 를 바꾼 뒤에 심는다
  const waitOut = re => page.waitForFunction(re => new RegExp(re).test((document.querySelector('#calcOut') || {}).textContent || ''), re.source);
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const logs = () => page.evaluate(() => { hjCalcLogFlush(); return hjCalcLogRead(); });
  const closeCalc = () => page.evaluate(() => closeModal());

  await page.evaluate(() => {
    state.projects = [{ name: 'A현장', stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '대전 중구 가길 1' } },
                      { name: 'B현장', stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '대전 서구 나길 2' },
                        measure: [{ id: 'room-b1', room: '안방', w: '3', h: '4', hgt: '2.3', open: '0' }] }];
    state.activeProject = 'A현장';
    state.materials = []; state.notes = state.notes || [];
    localStorage.setItem('hj_calc_log', '[]'); localStorage.setItem('hj_calc_cart', '[]');
    window.__hjCalcMem = {}; window.__hjCalcMemPj = {};
  });

  // ① 다시 열기만 하면 기록이 늘지 않는다
  await page.evaluate(() => materialCalc('tile'));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await waitOut(/61 장/);
  await closeCalc();
  let L = await logs();
  assert(L.length === 1 && L[0].project === 'A현장' && L[0].q === 61, '① 칸을 고치면 한 건: ' + JSON.stringify(L));
  await page.evaluate(() => materialCalc('tile'));   // 세션 기억으로 10㎡ 가 채워진 채 열린다
  await waitOut(/61 장/);
  assert((await page.inputValue('#modalRoot .calcIn[data-k="m2"]')) === '10', '① 같은 현장에서는 넣던 값으로 열린다');
  await closeCalc();
  await page.evaluate(() => { materialCalc(); document.querySelector('#modalRoot .calcCat[data-id="tile"]').click(); });
  await waitOut(/61 장/);
  await page.evaluate(() => materialCalc());   // ← 다른 계산
  await closeCalc();
  L = await logs();
  assert(L.length === 1, '① 열어 보기만 해서는 기록이 늘지 않는다: ' + JSON.stringify(L.map(e => [e.project, e.q])));
  await page.evaluate(() => { materialCalcLog(); document.querySelector('#modalRoot .calcLogBom[data-p="A현장"]').click(); });
  let cart = await page.evaluate(() => hjCalcCartRead());
  assert(cart.length === 1 && cart[0].qty === 61 && cart[0].project === 'A현장', '① 이 현장 담기 물량이 두 배가 되지 않는다: ' + JSON.stringify(cart));
  await page.evaluate(() => { localStorage.setItem('hj_calc_cart', '[]'); closeModal(); });

  // ② 다른 현장에서는 이전 현장 면적으로 시작하지 않고, 보기만 해서는 기록이 없다
  await page.evaluate(() => { state.activeProject = 'B현장'; materialCalc('tile'); });
  const bM2 = await page.inputValue('#modalRoot .calcIn[data-k="m2"]');
  assert(bM2 === '', '② B현장에서 A현장 면적(10)으로 시작하지 않는다: ' + bM2);
  await closeCalc();
  L = await logs();
  assert(L.length === 1 && !L.some(e => e.project === 'B현장'), '② B현장 가짜 기록 없음: ' + JSON.stringify(L.map(e => [e.project, e.q])));
  await page.evaluate(() => materialCalc('tile'));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '5');
  await waitOut(/31 장/);
  await closeCalc();
  L = await logs();
  assert(L.length === 2 && L[0].project === 'B현장' && L[0].q === 31, '② B현장에서 칸을 고치면 B현장 기록: ' + JSON.stringify(L.map(e => [e.project, e.q])));
  await page.evaluate(() => { state.activeProject = 'A현장'; materialCalc('tile'); });
  assert((await page.inputValue('#modalRoot .calcIn[data-k="m2"]')) === '', '② A현장으로 돌아와도 B현장 면적(5)으로 시작하지 않는다');
  await closeCalc();

  // ③ 실측 노트에서 B현장 방을 넘기면 B현장으로
  await page.evaluate(() => { localStorage.setItem('hj_calc_log', '[]'); localStorage.setItem('hj_calc_cart', '[]'); state.activeProject = 'A현장'; measureNote('B현장'); });
  await page.click('#modalRoot .mnCalc');
  await page.click('#modalRoot .calcCat[data-id="tile"]');
  await waitOut(/장/);
  await page.click('#calcCart');
  const notesBefore = await page.evaluate(() => state.notes.length);
  await page.click('#calcNote');
  await closeCalc();
  L = await logs();
  cart = await page.evaluate(() => hjCalcCartRead());
  const lastNote = await page.evaluate(() => state.notes[state.notes.length - 1]);
  assert(L.length === 1 && L[0].project === 'B현장', '③ 실측 방 계산 기록은 B현장: ' + JSON.stringify(L.map(e => [e.project, e.q, e.room])));
  assert(cart.length === 1 && cart[0].project === 'B현장', '③ 발주 담기는 B현장: ' + JSON.stringify(cart));
  assert((await page.evaluate(() => state.notes.length)) === notesBefore + 1 && lastNote.project === 'B현장', '③ 현장 메모는 B현장: ' + JSON.stringify(lastNote));
  assert((await page.evaluate(() => state.activeProject)) === 'A현장', '③ 활성 현장은 바꾸지 않는다');
  // 면적 모드를 바꿔 다시 그려도 B현장 그대로
  await page.evaluate(() => { measureNote('B현장'); document.querySelector('#modalRoot .mnCalc').click(); document.querySelector('#modalRoot .calcCat[data-id="tile"]').click(); });
  await waitOut(/장/);
  await page.click('#modalRoot .calcSeg[data-mode="m2"]');
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '12.5');
  await waitOut(/76 장/);
  await page.click('#calcCart');
  await closeCalc();
  L = await logs();
  cart = await page.evaluate(() => hjCalcCartRead());
  assert(L.length === 1 && L[0].project === 'B현장' && L[0].q === 76, '③ 같은 방을 두 번 넘겨도 기록은 한 건(덮어씀), 다시 그려도 B현장: ' + JSON.stringify(L.map(e => [e.project, e.q])));
  assert(cart[0].project === 'B현장', '③ 다시 그린 뒤 발주 담기도 B현장: ' + JSON.stringify(cart[0]));
  // 작업기록을 꺼 둬도(기록에서 현장을 되찾을 수 없어도) 다시 그린 화면은 B현장 그대로
  await page.evaluate(() => { localStorage.setItem('hj_calc_cart', '[]'); localStorage.setItem('hj_calc_log', '[]'); const p = hjCalcPrefs(); p.ui.log = false; hjCalcPrefsSave(p);
    measureNote('B현장'); document.querySelector('#modalRoot .mnCalc').click(); document.querySelector('#modalRoot .calcCat[data-id="tile"]').click(); });
  await waitOut(/장/);
  await page.click('#modalRoot .calcSeg[data-mode="py"]');
  await page.click('#calcCart');
  await closeCalc();
  cart = await page.evaluate(() => hjCalcCartRead());
  assert(cart.length === 1 && cart[0].project === 'B현장', '③ 기록을 꺼도 다시 그린 화면의 발주 담기는 B현장: ' + JSON.stringify(cart));
  await page.evaluate(() => { const p = hjCalcPrefs(); p.ui.log = true; hjCalcPrefsSave(p); });
  await page.evaluate(() => { state.notes.pop(); localStorage.setItem('hj_calc_log', '[]'); localStorage.setItem('hj_calc_cart', '[]'); });

  // ④ 부족 재고 발주
  await page.evaluate(() => {
    state.inventory = [{ id: 'iv1', name: '타일 본드', qty: 0, minQty: 2, unit: '통', supplier: '한밭자재' },
                       { id: 'iv2', name: '실리콘', qty: 5, minQty: 2, unit: '개', supplier: '' }];
    state.quotes = [{ id: 'q1', no: 'Q-1', title: '유성빌라 욕실', project: 'B현장', date: '2026-09-20', items: [{ name: '욕실 철거', spec: '', qty: 1, price: 300000 }, { name: '변기', spec: '', qty: 1, price: 200000 }] }];
    state.editingQuote = null; state.suppliers = [];
    inventoryManage();
  });
  assert(await page.evaluate(() => !!document.querySelector('#invOrder')), '④ 거래처 목록이 비어도 부족 재고 발주 버튼');
  await page.click('#invOrder');
  let t = await modalText();
  assert(/부족 재고 발주/.test(t) && /타일 본드/.test(t) && !/욕실 철거|변기|실리콘/.test(t), '④ 부족 재고만 올린다: ' + t.slice(0, 200));
  assert((await page.inputValue('#modalRoot .ioQty[data-i="0"]')) === '2' && (await page.inputValue('#modalRoot .ioSup[data-i="0"]')) === '한밭자재', '④ 수량 = 최소까지 채울 양, 거래처 = 재고에 적은 곳');
  await page.fill('#modalRoot .ioQty[data-i="0"]', '5');
  await page.click('#ioMake');
  const moTxt = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .moTxt')].map(x => x.textContent));
  assert(moTxt.length === 1 && /한밭자재/.test(moTxt[0]) && /타일 본드 × 5통/.test(moTxt[0]) && !/■ 현장/.test(moTxt[0]) && !/변기|철거|B현장/.test(moTxt[0]), '④ 발주 문자: ' + JSON.stringify(moTxt));
  await page.click('#modalRoot .mfoot button:has-text("← 품목으로")');
  assert(/부족 재고 발주/.test(await modalText()), '④ ← 품목으로는 부족 재고 화면으로');
  await page.evaluate(() => { state.inventory = [{ id: 'iv3', name: '실리콘', qty: 5, minQty: 2, unit: '개' }]; inventoryOrder(); });
  assert(/자재 재고/.test(await modalText()), '④ 부족한 것이 없으면 재고 화면으로 돌아간다');
  await page.evaluate(() => closeModal());

  // ⑤ 규격이 맞는 단가만
  const est = await page.evaluate(() => {
    const mat = (id, name, spec, unit, price) => ({ id, name, spec, unit, entries: [{ supplier: '시험', price }] });
    const tileMain = hjCalcRun('tile', { m2: 10, tw: 300, th: 600, joint: 3, loss: 10 }).main;
    const out = {};
    state.materials = [mat('t1', '포세린 타일 600×1200', '', '장', 1100), mat('t2', '포세린 타일 300×600', '', '장', 3300)];
    out.tile = hjCalcEstimate(tileMain);
    state.materials = [mat('t3', '포세린 타일', '', '장', 1100)];
    out.noSize = hjCalcEstimate(tileMain);
    state.materials = [mat('t4', '포세린 타일 600×1200', '', '장', 1100)];
    out.other = hjCalcEstimate(tileMain);
    state.materials = [mat('g1', '석고보드 9.5T', '3×6', '장', 3300), mat('g2', '석고보드 9.5T 대', '1200×2400', '장', 6600)];
    out.gyp18 = hjCalcEstimate(hjCalcRun('gypsum', { m2: 10, sheet: '1.62', layers: 1, sides: '1', loss: 10 }).main);
    out.gyp24 = hjCalcEstimate(hjCalcRun('gypsum', { m2: 10, sheet: '2.88', layers: 1, sides: '1', loss: 10 }).main);
    state.materials = [mat('w1', '각재 30×30', '2.4m', '본', 2200), mat('w2', '각재 30×30 12자', '', '본', 3300)];
    out.stick = hjCalcEstimate(hjCalcRun('wood', { len: 36, stick: 3.6, loss: 0 }).main);
    state.materials = [mat('p1', '합판 12T', '4×8', '장', 22000)];
    out.ply = hjCalcEstimate(hjCalcRun('wood', { m2: 10, sheet: '2.9768', loss: 0 }).main);
    out.plySmall = hjCalcEstimate(hjCalcRun('wood', { m2: 10, sheet: '1.6562', loss: 0 }).main);
    // 발주 줄 금액 — 같은 이름이라도 규격이 다르면 값이 없다
    state.materials = [mat('c1', '타일', '600×1200', '장', 1100)];
    out.cartOther = hjCartUnitPrice({ cat: 'tile', name: '타일', spec: '300×600 (로스 10%)', qty: 61, unit: '장' });
    state.materials = [mat('c2', '타일', '300×600', '장', 1100)];
    out.cartSame = hjCartUnitPrice({ cat: 'tile', name: '타일', spec: '300×600 (로스 10%) · 단위 장', qty: 61, unit: '장' });
    out.cartManual = hjCartUnitPrice({ name: '타일', qty: 1, unit: '장' });   // 계산기가 아닌 줄은 예전 그대로(이름·단위)
    state.materials = [mat('c3', '각재', '2.4m', '본', 2200)];
    out.cartStick = hjCartUnitPrice({ cat: 'wood', name: '각재', spec: '3.6m · 단위 본', qty: 10, unit: '본' });
    return out;
  });
  assert(est.tile && est.tile.name === '포세린 타일 300×600' && est.tile.price === 3000 && est.tile.others === 0, '⑤ 300×600 타일은 300×600 단가: ' + JSON.stringify(est.tile));
  assert(est.noSize === null && est.other === null, '⑤ 규격을 모르거나 다르면 값 없음: ' + JSON.stringify([est.noSize, est.other]));
  assert(est.gyp18 && est.gyp18.price === 3000 && est.gyp24 && est.gyp24.price === 6000, '⑤ 석고보드 3×6(자) = 900×1800, 1200×2400 은 따로: ' + JSON.stringify([est.gyp18, est.gyp24]));
  assert(est.stick && est.stick.price === 3000, '⑤ 각재 3.6m 는 12자 값(2.4m 값이 싸도): ' + JSON.stringify(est.stick));
  assert(est.ply && est.ply.price === 20000 && est.plySmall === null, '⑤ 합판 4×8 = 1220×2440, 910×1820 에는 붙이지 않는다: ' + JSON.stringify([est.ply, est.plySmall]));
  assert(est.cartOther === 0 && est.cartSame === 1000 && est.cartManual === 1000 && est.cartStick === 0, '⑤ 발주 줄 금액도 규격대로: ' + JSON.stringify(est));
  // 견적에 담기도 규격이 맞는 단가로
  await page.evaluate(() => {
    state.materials = [{ id: 't1', name: '포세린 타일 600×1200', unit: '장', entries: [{ supplier: '시험', price: 1100 }] }, { id: 't2', name: '포세린 타일 300×600', unit: '장', entries: [{ supplier: '시험', price: 3300 }] }];
    state.editingQuote = newQuote(false); window.__hjCalcMem = {}; materialCalc('tile');
  });
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await waitOut(/61 장/);
  await page.click('#calcQuote');
  const qi = await page.evaluate(() => state.editingQuote.items[0]);
  assert(qi && qi.price === 3000 && qi.qty === 61, '⑤ 견적 단가는 같은 규격 값: ' + JSON.stringify(qi));
  await page.evaluate(() => { window.__hjCalcQuotePushed = false; closeModal(); state.editingQuote = null; state.materials = []; localStorage.setItem('hj_calc_log', '[]'); });

  // ⑥ 폭 재단 도배·레미콘의 내 로스
  const loss = await page.evaluate(() => {
    const v = { peri: 14, hgt: 2.3, kind: '0.93|17.75', loss: 15 };
    const m = hjCalcRun('paper', v).main;
    const out = { q: m.qty };
    out.oldSame = hjCalcLossOf({ id: 'o1', cat: 'paper', v, q: m.qty, lp: 15, used: 3 });     // 옛 기록(pq 없음)도 다시 계산해 맞춘다
    out.oldMore = hjCalcLossOf({ id: 'o2', cat: 'paper', v, q: m.qty, lp: 15, used: 4 });
    const cv = { w: 5, h: 1, t: 10, loss: 10 };   // 순 부피 0.5㎥, 발주 1㎥(최소)
    out.concQ = hjCalcRun('concrete', cv).main.qty;
    out.conc = hjCalcLossOf({ id: 'c1', cat: 'concrete', v: cv, q: out.concQ, lp: 10, used: 0.55 });
    out.tile = hjCalcLossOf({ id: 't1', cat: 'tile', v: { m2: 10, tw: 300, th: 600, joint: 3, loss: 10 }, q: 61, lp: 10, used: 61 });
    localStorage.setItem('hj_calc_log', JSON.stringify([1, 2, 3].map(i => ({ id: 'p' + i, t: '', cat: 'paper', v, head: '벽지', q: m.qty, u: '롤', lp: 15, used: 4, project: null }))));
    out.avg = hjCalcLossAvg('paper');
    return out;
  });
  assert(loss.q === 3 && loss.oldSame === 0 && Math.round(loss.oldMore) === 33, '⑥ 폭 재단 도배: 같은 양이면 0%, 한 롤 더면 33%: ' + JSON.stringify(loss));
  assert(loss.concQ === 1 && Math.abs(loss.conc - 10) < 0.01, '⑥ 레미콘은 순 부피 기준(발주 올림을 로스로 세지 않는다): ' + JSON.stringify(loss));
  assert(Math.abs(loss.tile - (61 / (61 / 1.1) - 1) * 100) < 0.11, '⑥ 타일은 예전 그대로: ' + loss.tile);
  assert(loss.avg === null, '⑥ 폭 재단 기록으로 면적법 로스 ⭐ 를 제안하지 않는다: ' + JSON.stringify(loss.avg));
  // 화면: 새 기록에는 로스 없는 양이 실리고, 작업기록은 '계산에 로스 없음' 이라고 말한다
  await page.evaluate(() => { localStorage.setItem('hj_calc_log', '[]'); window.__hjCalcMem = {}; materialCalc('paper'); });
  await page.fill('#modalRoot .calcIn[data-k="peri"]', '14');
  await waitOut(/3 롤/);
  await closeCalc();
  L = await logs();
  assert(L.length === 1 && L[0].pq === 3 && L[0].lp === 0 && L[0].strip === 1, '⑥ 기록에 로스 없는 양·실제 곱한 로스: ' + JSON.stringify(L[0]));
  await page.evaluate(id => { localStorage.setItem('hj_calc_log', JSON.stringify(hjCalcLogRead().map(e => Object.assign({}, e, { used: 3 })))); materialCalcLog(); }, L[0].id);
  t = await modalText();
  assert(/내 로스 0% \(폭 재단 — 계산에 로스 없음\)/.test(t) && !/평균 로스/.test(t), '⑥ 작업기록 표시: ' + (t.match(/내 로스[^)]*\)/) || [t.slice(0, 120)])[0]);
  await page.evaluate(() => closeModal());

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));
  console.log('calc-safety.e2e OK (① 다시 열기 ② 현장 바꿈 ③ 실측 현장 ④ 부족 재고 발주 ⑤ 규격 단가 ⑥ 폭 재단 로스 ⑦ 오류 0)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

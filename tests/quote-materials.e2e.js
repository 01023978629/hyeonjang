/* quote-materials.e2e.js — 견적 작성 「🛒 자재」: 정리한 자재 단가를 품목으로 (Playwright)

   2026-09-05 v259 (v258 자재 구매처·단가의 다음 단계 — 정리한 단가를 견적에서 써먹는다):
     ① 견적 작성 화면 품목 줄에 「🛒 자재」 버튼이 있고, 자재가 없으면 안내 + 「자재 구매처·단가 열기」
     ② 자재가 있으면 목록에 공급가(÷1.1 반올림)·부가세 포함가·구매처가 보이고, 누르면 품목이 들어간다
        — 첫 추가는 마지막 빈 줄을 대신 채우고, 다음 추가는 줄을 더한다(수량 1, 단가 = 공급가)
     ③ 가격 없는 자재는 0원으로 들어간다(막지 않는다) / 검색은 목록만 거른다
     ④ 「끝」을 누르면 화면이 다시 그려져 품목 표에 보이고 quoteCalc 합계가 맞는다
     ⑤ 견적 작성 화면이 아니면(editingQuote 없음) 토스트만
     ⑥ pageerror 0
     ⑦ 같은 자재 두 번 → 「넣음 ×2」 글자 배지, ↩ 되돌리기는 마지막 것부터(전부 빼면 빈 줄 하나)
     ⑧ 닫힘 훅은 그 모달에서 한 번만(다음 모달에 남지 않음)

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
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof quoteAddFromMaterials === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  // ⑤ 견적 화면 밖
  const outside = await page.evaluate(() => { let msg = ''; const t = window.toast; window.toast = m => { msg = String(m); }; state.editingQuote = null; quoteAddFromMaterials(); window.toast = t; return { msg, modal: !!document.querySelector('#modalRoot .modal') }; });
  assert(/견적 작성/.test(outside.msg) && !outside.modal, '⑤ 견적 화면 밖에서는 안내만: ' + JSON.stringify(outside));

  // ① 버튼 + 빈 안내
  await page.evaluate(() => { state.materials = []; state.editingQuote = newQuote(); state.tab = 'quotemaker'; render(); });
  assert(await page.locator('#qmMat').count() === 1, '① 「🛒 자재」 버튼이 품목 줄에 있다');
  await page.click('#qmMat');
  await page.waitForSelector('#modalRoot .modal');
  const empty = await page.evaluate(() => ({ text: document.getElementById('modalRoot').textContent, btn: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()) }));
  assert(/정리한 자재가 없습니다/.test(empty.text) && empty.btn.some(t => /자재 구매처·단가 열기/.test(t)), '① 자재 없음 안내 + 열기 버튼: ' + JSON.stringify(empty.btn));
  await page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /열기/.test(b.textContent)).click(); });
  await page.waitForFunction(() => /자재 구매처·단가/.test((document.getElementById('modalTitle') || {}).textContent || ''));
  await page.evaluate(() => closeModal());

  // ② 자재 3개(둘은 가격 있음, 하나는 없음)
  await page.evaluate(() => {
    state.materials = [
      { id: 'mat_a', name: '타일 본드', spec: '20kg', unit: '통', memo: '', entries: [{ id: 'e1', supplier: '쿠팡', url: 'https://www.coupang.com/x', price: 18000, qty: '', memo: '', checkedAt: '2026-09-01', createdAt: '' }, { id: 'e2', supplier: '한밭철물', url: '', price: 16500, qty: '', memo: '', checkedAt: '2026-09-02', createdAt: '' }], createdAt: '', updatedAt: '' },
      { id: 'mat_b', name: '실리콘', spec: '백색', unit: '개', memo: '', entries: [{ id: 'e3', supplier: '다나와', url: '', price: '3,300원', qty: '', memo: '', checkedAt: '', createdAt: '' }], createdAt: '', updatedAt: '' },
      { id: 'mat_c', name: '방수액', spec: '', unit: '', memo: '', entries: [], createdAt: '', updatedAt: '' },
    ];
    state.editingQuote = newQuote(); state.tab = 'quotemaker'; render();
  });
  await page.click('#qmMat');
  await page.waitForSelector('#modalRoot .qmMatRow');
  const listed = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .qmMatRow')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  assert(listed.length === 3 && /타일 본드/.test(listed[listed.length - 1]) && /공급가 15,000원\/통/.test(listed[listed.length - 1]) && /부가세 포함 16,500원 · 한밭철물/.test(listed[listed.length - 1]), '② 최저가(16,500)→공급가 15,000 과 구매처가 보인다: ' + JSON.stringify(listed));
  assert(listed.some(t => /실리콘/.test(t) && /공급가 3,000원/.test(t)), '② "3,300원" 글자 가격도 공급가 3,000 으로: ' + JSON.stringify(listed));
  assert(listed.some(t => /방수액/.test(t) && /가격 없음/.test(t)), '③ 가격 없는 자재 표시: ' + JSON.stringify(listed));
  // 첫 추가는 빈 줄을 대신 채운다
  await page.click('#modalRoot .qmMatRow[data-id="mat_a"]');
  const after1 = await page.evaluate(() => ({ items: state.editingQuote.items.map(it => [it.name, it.spec, it.qty, it.price]), count: document.getElementById('qmMatCount').textContent }));
  assert(after1.items.length === 1 && after1.items[0].join() === '타일 본드,20kg,1,15000' && /1개 넣음/.test(after1.count), '② 첫 추가가 빈 줄을 채운다(수량 1·공급가): ' + JSON.stringify(after1));
  await page.click('#modalRoot .qmMatRow[data-id="mat_b"]');
  await page.click('#modalRoot .qmMatRow[data-id="mat_c"]');
  const after3 = await page.evaluate(() => ({ items: state.editingQuote.items.map(it => [it.name, it.qty, it.price]), count: document.getElementById('qmMatCount').textContent, modal: !!document.querySelector('#modalRoot .qmMatRow') }));
  assert(after3.items.length === 3 && after3.items[1].join() === '실리콘,1,3000' && after3.items[2].join() === '방수액,1,0' && /3개 넣음/.test(after3.count) && /\(공급가\)/.test(after3.count) && after3.modal, '②③ 연달아 넣기(모달 유지)·가격 없음은 0원·상태줄에 (공급가): ' + JSON.stringify(after3));

  // ⑦ 같은 자재를 두 번 넣으면 배지 글자(색만이 아님)로 보이고, 되돌리기는 마지막 것부터 뺀다
  await page.click('#modalRoot .qmMatRow[data-id="mat_b"]');
  const twice = await page.evaluate(() => ({ badge: document.querySelector('#modalRoot .qmMatRow[data-id="mat_b"] .qmMatN').textContent, n: state.editingQuote.items.length, count: document.getElementById('qmMatCount').textContent, undo: !document.getElementById('qmMatUndo').hidden }));
  assert(twice.badge === '넣음 ×2' && twice.n === 4 && /2번째/.test(twice.count) && twice.undo, '⑦ 두 번 넣음 배지·안내·되돌리기 버튼: ' + JSON.stringify(twice));
  await page.click('#qmMatUndo');
  const undone = await page.evaluate(() => ({ badge: document.querySelector('#modalRoot .qmMatRow[data-id="mat_b"] .qmMatN').textContent, items: state.editingQuote.items.map(it => it.name), count: document.getElementById('qmMatCount').textContent }));
  assert(undone.badge === '넣음 ×1' && undone.items.join() === '타일 본드,실리콘,방수액' && /되돌림 — 실리콘/.test(undone.count), '⑦ 되돌리기가 마지막 것만 뺀다: ' + JSON.stringify(undone));
  // 되돌리기로 첫 줄까지 빼면 빈 줄이 돌아온다(품목 0줄 금지)
  const blankBack = await page.evaluate(async () => { for (let i = 0; i < 3; i++) { document.getElementById('qmMatUndo').click(); } return { items: state.editingQuote.items.map(it => [it.name, it.price]), undo: !document.getElementById('qmMatUndo').hidden }; });
  assert(blankBack.items.length === 1 && blankBack.items[0].join() === ',0' && !blankBack.undo, '⑦ 전부 되돌리면 빈 줄 하나로: ' + JSON.stringify(blankBack));
  for (const id of ['mat_a', 'mat_b', 'mat_c']) await page.click('#modalRoot .qmMatRow[data-id="' + id + '"]');
  // ③ 검색은 목록만
  await page.fill('#qmMatSearch', '실리');
  await page.waitForFunction(() => document.querySelectorAll('#modalRoot .qmMatRow').length === 1);
  const filtered = await page.evaluate(() => ({ n: document.querySelectorAll('#modalRoot .qmMatRow').length, name: document.querySelector('#modalRoot .qmMatRow b').textContent, items: state.editingQuote.items.length }));
  assert(filtered.n === 1 && filtered.name === '실리콘' && filtered.items === 3, '③ 검색은 목록만 거르고 품목은 그대로: ' + JSON.stringify(filtered));

  // ④ 「끝」이 아니라 X 로 닫아도 다시 그려져 표에 보이고(안 보이면 다시 넣어 중복이 난다) 합계가 맞는다
  await page.evaluate(() => { document.querySelector('#modalRoot .modal-close').click(); });
  await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
  const table = await page.evaluate(() => ({ names: [...document.querySelectorAll('#view input[data-qf="name"]')].map(i => i.value), calc: quoteCalc(state.editingQuote) }));
  assert(table.names.join() === '타일 본드,실리콘,방수액' && table.calc.sub === 18000 && table.calc.total === 19800, '④ X 로 닫아도 표에 3줄, 공급가 18,000·부가세 포함 19,800: ' + JSON.stringify(table));
  // ⑧ 닫힘 훅은 한 번만 — 다른 모달을 열고 닫아도 다시 그리지 않는다(훅이 남아 있으면 엉뚱한 화면에서 render 가 돈다)
  await page.click('#qmMat'); await page.waitForSelector('#modalRoot .qmMatRow');
  await page.click('#modalRoot .qmMatRow[data-id="mat_b"]');   // 훅이 걸린 상태(넣은 게 있음)
  const hookOnce = await page.evaluate(async () => { const orig = render; let n = 0; render = (...a) => { n++; return orig(...a); }; openModal('시험', '<p>x</p>'); closeModal(); render = orig; return n; });
  assert(hookOnce === 0, '⑧ 다른 모달이 위에 열리면 자재 모달의 닫힘 훅은 버린다: render ' + hookOnce + '번');
  await page.evaluate(() => { state.editingQuote.items = state.editingQuote.items.slice(0, 3); render(); });

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));
  console.log('PASS  quote-materials: 🛒 자재 버튼·빈 안내→열기·공급가 환산(÷1.1)·빈 줄 대체·연달아 추가·가격 없음 0원·검색·×2 배지·되돌리기·X 닫아도 표·합계·훅 1회');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

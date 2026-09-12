/* calc-flow.e2e.js — v278 계산기에서 발주까지 (Playwright)

   2026-09-12 대표 지시로 v277 계산기의 다음 단계를 붙였다.
     ① 견적 화면 툴바에 🧮 계산기 버튼 — 견적 쓰다가 바로 수량을 뽑는다
     ② 🗑 폐기물 산출 — 철거 면적·대상으로 부피·마대·트럭, 단가를 넣으면 처리비 어림
     ③ 🧺 발주 담기 — 계산 결과가 이 폰 장바구니(hj_calc_cart)에 모이고, 계산기 첫 화면에 건수가 보인다
     ④ 🧺 발주 목록 — 수량·거래처를 고쳐 「거래처별 발주 문자」로. 기존 발주 문자 화면을 그대로 쓰고, 자동 발송은 없다
     ⑤ 📏 내 로스율 — 작업기록에 실제 쓴 양을 넣으면 내 로스가 나오고, 세 건이 쌓이면 ⭐ 기본값을 제안한다
     ⑥ 앱 저장 구조는 그대로 — serializeData 에 cart·loss 키가 없다, pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(/id="qmCalc"/.test(source) && /if\(t\.id==='qmCalc'\)return materialCalc\(\);/.test(source), '① 견적 툴바 버튼이 계산기로 간다(정적)');
assert(/localStorage\.getItem\('hj_calc_cart'\)/.test(source), '③ 장바구니는 이 폰 localStorage');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true, asked = [];
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.materialCalc === 'function' && typeof window.hjCalcCartRead === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const outText = () => page.evaluate(() => (document.querySelector('#calcOut') || {}).textContent || '');
  const run = (id, v) => page.evaluate(([id, v]) => hjCalcRun(id, v), [id, v]);
  const val = (res, label) => { const r = res.rows.find(x => x[0] === label); assert(r, '행 없음: ' + label + ' in ' + JSON.stringify(res)); return r[1]; };
  const cart = () => page.evaluate(() => hjCalcCartRead());
  const waitOut = re => page.waitForFunction(re => new RegExp(re).test((document.querySelector('#calcOut') || {}).textContent || ''), re.source);

  // ② 폐기물 산출
  let r = await run('waste', { m2: '30', kind: '0.03', swell: '1.3', bag: '1', truck: '2.5' });
  // 30 × 0.03 × 1.3 = 1.17㎥ → 마대 2장, 트럭 1대
  assert(val(r, '폐기물 부피') === '1.17 ㎥ (부풀림 1.3배 포함)' && val(r, '마대(톤백)') === '2 장 (1㎥/장)' && val(r, '트럭') === '1 대 (2.5㎥/대)', '② 폐기물: ' + JSON.stringify(r));
  assert(/㎥당 처리비/.test(r.note) && !r.rows.some(x => /처리비/.test(x[0])), '② 단가 없으면 처리비 대신 안내');
  assert(r.main && r.main.name === '폐기물 처리' && r.main.unit === '㎥' && r.main.qty === 1.17 && /타일·마루/.test(r.main.spec), '② 폐기물 main: ' + JSON.stringify(r.main));
  r = await run('waste', { m2: '30', kind: '0.03', swell: '1.3', bag: '1', truck: '2.5', price: '100000' });
  assert(val(r, '처리비 어림') === '117,000원 (㎥당 100,000원)' && !r.note, '② 처리비 어림: ' + JSON.stringify(r));
  r = await run('waste', { m2: '30', kind: '0.05', swell: '1', bag: '1.5', truck: '5' });
  assert(val(r, '폐기물 부피').startsWith('1.5 ㎥') && val(r, '마대(톤백)') === '1 장 (1.5㎥/장)', '② 혼합 철거·마대 크기: ' + JSON.stringify(r));
  r = await run('waste', { kind: '0.03' });
  assert(r.rows.length === 0 && /철거 면적/.test(r.note), '② 면적 없으면 안내: ' + JSON.stringify(r));

  // ① 견적 화면에서 계산기 열기 → ➕ 견적에 담기까지
  await page.evaluate(() => { state.editingQuote = newQuote(false); state.tab = 'quotemaker'; render(); });
  const hasBtn = await page.evaluate(() => !!document.querySelector('#qmCalc'));
  assert(hasBtn, '① 견적 화면에 🧮 계산기 버튼');
  await page.click('#qmCalc');
  assert(/자재 계산기/.test(await modalText()), '① 버튼을 누르면 계산기가 열린다');
  await page.click('#modalRoot .calcCat[data-id="waste"]');
  await page.selectOption('#modalRoot .calcIn[data-k="kind"]', '0.03');
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '30');
  await waitOut(/1.17 ㎥/);
  assert(await page.evaluate(() => !!document.querySelector('#calcQuote')), '① 견적 작성 중이면 담기 버튼');
  await page.click('#calcQuote');
  let q = await page.evaluate(() => state.editingQuote.items);
  assert(q.length === 1 && q[0].name === '폐기물 처리' && q[0].qty === 1.17, '① 폐기물을 견적 품목으로: ' + JSON.stringify(q));

  // ③ 🧺 발주 담기
  assert((await cart()).length === 0, '③ 처음엔 장바구니가 비어 있다');
  await page.click('#calcCart');
  let c = await cart();
  assert(c.length === 1 && c[0].name === '폐기물 처리' && c[0].qty === 1.17 && c[0].unit === '㎥' && c[0].cat === 'waste' && c[0].id, '③ 담김: ' + JSON.stringify(c));
  await page.evaluate(() => { state.activeProject = '평화로운아파트'; window.__hjCalcMem.tile = { m2: '10', box: '10' }; materialCalc('tile'); });
  await waitOut(/61 장/);
  await page.click('#calcCart');
  c = await cart();
  assert(c.length === 2 && c[0].name === '타일' && c[0].qty === 61 && c[0].unit === '장' && c[0].project === '평화로운아파트', '③ 두 번째도 담기고 현장이 붙는다: ' + JSON.stringify(c[0]));
  await page.evaluate(() => materialCalc());
  assert(/🧺 발주 목록 2/.test(await modalText()), '③ 계산기 첫 화면에 담은 건수: ' + (await modalText()).slice(0, 120));

  // ④ 🧺 발주 목록 → 거래처별 발주 문자
  await page.click('#modalRoot .mfoot button:has-text("발주 목록")');
  let t = await modalText();
  assert(/발주 목록 \(2\)/.test(t) && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcCartRow').length)) === 2, '④ 목록 화면: ' + t.slice(0, 120));
  await page.fill('#modalRoot .ccQty[data-i="0"]', '65');
  await page.fill('#modalRoot .ccSup[data-i="0"]', '대전타일');
  await page.fill('#modalRoot .ccSup[data-i="1"]', '대전산업폐기물');
  await page.click('#ccMake');
  t = await modalText();
  assert(/발주 문자 — 2곳/.test(t) && /대전타일/.test(t) && /타일 .*× 65/.test(t) && /폐기물 처리/.test(t) && /평화로운아파트/.test(t), '④ 거래처별 문자: ' + t.slice(0, 300));
  const sup = await page.evaluate(() => ({ map: state.supplierMap, names: (state.suppliers || []).map(s => s.name) }));
  assert(sup.map['타일'] === '대전타일' && sup.names.includes('대전타일'), '④ 거래처 학습: ' + JSON.stringify(sup));
  await page.click('#modalRoot .mfoot button:has-text("품목으로")');
  assert(/발주 목록 \(2\)/.test(await modalText()), '④ 문자 화면에서 목록으로 돌아온다');
  await page.click('#modalRoot .ccDel >> nth=0');
  assert((await cart()).length === 1 && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcCartRow').length)) === 1, '④ ✕ 하나 빼기');
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("비우기")');
  assert((await cart()).length === 0 && asked.length === 1 && /모두 뺄까요/.test(asked[0]) && /담은 것이 없습니다/.test(await modalText()), '④ 비우기는 물어본 뒤: ' + JSON.stringify(asked));
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("비우기")');
  assert(asked.length === 0, '④ 비울 것이 없으면 묻지 않는다');

  // ⑤ 📏 내 로스율
  await page.evaluate(() => { localStorage.setItem('hj_calc_log', '[]'); window.__hjCalcMem.tile = {}; });
  for (const [m2, expect] of [['10', /61 장/], ['20', /121 장/], ['30', /181 장/]]) {
    await page.evaluate(() => materialCalc('tile'));
    await page.fill('#modalRoot .calcIn[data-k="m2"]', m2);
    await waitOut(expect).catch(async () => { throw new Error('⑤ 계산 안 맞음(' + m2 + '㎡): ' + (await outText()) + ' 입력 ' + JSON.stringify(await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot .calcIn')].map(i => [i.dataset.k, i.value]))))); });
    await page.evaluate(() => hjCalcLogFlush());
  }
  let log = await page.evaluate(() => hjCalcLogRead());
  assert(log.length === 3 && log.every(e => e.cat === 'tile' && e.q > 0 && e.u === '장' && e.lp === 10 && e.used === null), '⑤ 기록에 계산 수량·단위·로스가 남는다: ' + JSON.stringify(log.map(e => [e.q, e.u, e.lp, e.used])));
  await page.evaluate(() => materialCalcLog());
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcUsed').length)) === 3, '⑤ 줄마다 실제 쓴 양 칸');
  // 계산 61장(로스 10% 포함) → 순수 55.45장. 실제 66장이면 내 로스 19%
  const fillUsed = async (n, v) => { await page.fill('#modalRoot .calcUsed >> nth=' + n, v); await page.keyboard.press('Tab'); await page.waitForTimeout(120); };
  await fillUsed(2, '66');
  t = await modalText();
  assert(/내 로스 19% \(계산은 10%\)/.test(t), '⑤ 내 로스율: 기록 ' + JSON.stringify(await page.evaluate(() => hjCalcLogRead().map(e => [e.q, e.used, e.lp]))) + ' / ' + t.slice(0, 200));
  assert(!/기본값으로/.test(t), '⑤ 한 건만으로는 기본값을 제안하지 않는다');
  await fillUsed(1, '131');   // 121 → 순수 110 → 19.1%
  await fillUsed(0, '196');   // 181 → 순수 164.5 → 19.1%
  t = await modalText();
  assert(/내 현장 평균 로스 <?b?>?19%/.test(t.replace(/\s+/g, ' ')) || /평균 로스 19%/.test(t), '⑤ 세 건이면 평균 제안: ' + t.slice(0, 260));
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLossApply').length)) === 1, '⑤ ⭐ 기본값으로 버튼');
  await page.click('#modalRoot .calcLossApply');
  const prefs = await page.evaluate(() => hjCalcPrefs());
  assert(prefs.d.tile && prefs.d.tile.loss === '19', '⑤ 누르면 로스 기본값이 바뀐다: ' + JSON.stringify(prefs.d));
  await page.evaluate(() => { window.__hjCalcMem.tile = {}; materialCalc('tile'); });
  assert((await page.evaluate(() => document.querySelector('#modalRoot .calcIn[data-k="loss"]').value)) === '19', '⑤ 다음 계산은 내 로스율로 시작');
  // 실제 쓴 양을 지우면 로스도 사라진다
  await page.evaluate(() => materialCalcLog());
  await fillUsed(0, '');
  assert((await page.evaluate(() => hjCalcLogRead()[0].used)) === null && !/평균 로스/.test(await modalText()), '⑤ 비우면 로스 계산에서 빠진다');

  // ⑥ 저장 구조 변경 없음, 오류 0
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /cart|loss|waste|calc/i.test(k)), '⑥ serializeData 에 새 키 없음: ' + keys.join(','));
  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('calc-flow.e2e OK (① 견적 툴바 계산기 ② 폐기물 4건 ③ 발주 담기 ④ 발주 목록·문자·학습 ⑤ 내 로스율 ⑥ 저장 무변경)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

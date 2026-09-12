/* site-bom.e2e.js — 📦 현장별 자재 물량 (Playwright)

   2026-09-12: 한 현장에서 타일·레미탈·도배를 따로 계산해 놓고, 자재상에 전화할 때 처음부터 다시 센다.
   새 화면을 만들지 않고 🕘 작업기록과 🧺 발주 목록을 현장으로 잇는다.
     ① 작업기록이 현장별로 묶인다(현장 없는 것은 맨 뒤 '현장 미지정'), 최근 50건
     ② 「🧺 이 현장 담기」로 그 현장 계산이 한 번에 발주 목록에 들어간다
     ③ 같은 자재는 더해진다(물량표는 '다 해서 몇 장'이라야 쓸모가 있다)
     ④ 수량이 나오지 않는 계산(헤베 환산·전기 굵기)은 담기지 않고 그렇다고 말해 준다
     ⑤ 발주 목록이 현장별로 묶이고 예상 매입가 합계가 나온다 — 단가 없는 줄은 빠졌다고 밝힌다
     ⑥ 현장이 둘 이상이면 전체 합계도 보여 준다, 금액은 견적가가 아니라 매입 공급가(÷1.1)
     ⑦ 줄 고치기·빼기가 묶은 뒤에도 그 줄에 맞는다(줄 번호가 어긋나지 않는다), 저장 키는 그대로, pageerror 0
     ⑧ 고친 수량·거래처가 남고 합계도 따라 움직인다(문자 만들 때만 읽으면 다시 열 때 되돌아간다)

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
assert(/const HJ_CALC_LOG_MAX=50;/.test(source), '① 작업기록 상한 50(정적)');
assert(/function hjCalcGroupBy\(/.test(source) && /function hjCartSum\(/.test(source), '① 묶기·합계 도우미가 있다');
// 새 더보기 항목을 만들지 않는다 — 이미 있는 두 화면을 잇는 일이다
assert(!/'sitebom'|'bom'/.test(source), '① 더보기 항목을 늘리지 않는다');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true;
  page.on('dialog', d => sayYes ? d.accept() : d.dismiss());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.materialCalcLog === 'function' && typeof window.hjCalcGroupBy === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const cart = () => page.evaluate(() => JSON.parse(localStorage.getItem('hj_calc_cart') || '[]'));
  const toasts = () => page.evaluate(() => (window.__toasts || []).join(' | '));

  await page.evaluate(() => {
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(m); return o(m); };
    state.projects = [{ name: '평화로운아파트', stage: 2, received: 0, phases: [], cost: {} },
                      { name: '유성빌라', stage: 2, received: 0, phases: [], cost: {} }];
    state.activeProject = '평화로운아파트';
    state.materials = [{ id: 'm1', name: '타일', spec: '300×600', unit: '장',
                         entries: [{ id: 'e1', supplier: '한밭타일', url: '', price: 2200, checkedAt: '2026-09-01' }], createdAt: '', updatedAt: '' },
                       // 이름은 같지만 단위가 다른 자재 — 값을 붙이면 안 된다(롤 벽지에 통 단가를 곱하면 엉뚱한 금액이 된다)
                       { id: 'm2', name: '벽지', spec: '', unit: '통',
                         entries: [{ id: 'e2', supplier: '아무데나', url: '', price: 55000, checkedAt: '2026-09-01' }], createdAt: '', updatedAt: '' }];
    try { localStorage.removeItem('hj_calc_cart'); } catch (e) {}
    // 작업기록을 손으로 심는다 — 평화로운 3건(타일 2건·도배 1건), 유성 1건, 현장 없음 1건
    const mk = (id, cat, v, project, q, u, head) => ({ id, t: '2026-09-12 09:00', cat, v, head, sub: '', project, q, u, lp: 5, used: null });
    localStorage.setItem('hj_calc_log', JSON.stringify([
      mk('L1', 'tile', { m2: 10, tw: 300, th: 600, joint: 3, loss: 10 }, '평화로운아파트', 1, '장', '타일'),
      mk('L2', 'tile', { m2: 5, tw: 300, th: 600, joint: 3, loss: 10 }, '평화로운아파트', 1, '장', '타일'),
      mk('L3', 'paper', { peri: 16, hgt: 2.3, open: 0, ceil: 0, walls: 1, loss: 15 }, '평화로운아파트', 1, '롤', '벽지'),
      mk('L4', 'tile', { m2: 8, tw: 300, th: 600, joint: 3, loss: 10 }, '유성빌라', 1, '장', '타일'),
      mk('L5', 'area', { m2: 33 }, '', 0, '', '평 환산'),
      mk('L6', 'area', { m2: 50 }, '평화로운아파트', 0, '', '평 환산')   // 수량이 안 나오는 계산이 섞여 있어도 건너뛴다
    ]));
    materialCalcLog();
  });
  let t = await modalText();

  // ① 현장별 묶음 · 50건 안내
  assert(/평화로운아파트/.test(t) && /유성빌라/.test(t) && /현장 미지정/.test(t), '① 현장별로 묶인다: ' + t.slice(0, 120));
  assert(/최근 50건/.test(t), '① 50건 안내');
  const order = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .calcLogBom, #modalRoot [data-p]')].map(b => b.dataset.p));
  const heads = await page.evaluate(() => [...document.querySelectorAll('#modalRoot')].length && [...document.querySelectorAll('#modalRoot b')].map(b => b.textContent).filter(x => /평화로운아파트|유성빌라|현장 미지정/.test(x)));
  assert(JSON.stringify(heads) === JSON.stringify(['유성빌라', '평화로운아파트', '현장 미지정']),
    '① 현장은 가나다, 현장 없는 것은 맨 뒤: ' + JSON.stringify(heads));
  assert(order.includes('평화로운아파트') && order.includes('유성빌라'), '① 현장마다 담기 버튼: ' + JSON.stringify(order));
  // ④ 수량이 없는 계산만 있는 묶음에는 담기 버튼을 두지 않는다
  assert(!order.includes(''), '④ 담을 수량이 없는 묶음에는 버튼이 없다: ' + JSON.stringify(order));

  // ②③ 이 현장 담기 — 타일 2건이 한 줄로 더해진다
  await page.click('#modalRoot .calcLogBom[data-p="평화로운아파트"]');
  let c = await cart();
  const tile = c.filter(x => /타일/.test(x.name));
  assert(c.length === 2 && tile.length === 1, '②③ 같은 자재는 더해져 2줄: ' + JSON.stringify(c.map(x => x.name + ' ' + x.qty + x.unit)));
  assert(tile[0].project === '평화로운아파트' && tile[0].qty > 0, '② 현장이 붙는다: ' + JSON.stringify(tile[0]));
  assert(/2줄 담고|담고 1줄은/.test(await toasts()), '②③ 담은 결과를 알려 준다: ' + await toasts());
  assert(/1건은 수량이 없어 건너뜀/.test(await toasts()), '④ 수량 없는 계산은 건너뛰고 말해 준다: ' + await toasts());
  assert(!c.some(x => !x.name || !(Number(x.qty) > 0)), '④ 빈 줄이 들어가지 않는다: ' + JSON.stringify(c));
  const merged = tile[0].qty;

  // ③ 다시 담으면 또 더해진다(같은 줄에)
  await page.evaluate(() => materialCalcLog());
  await page.click('#modalRoot .calcLogBom[data-p="평화로운아파트"]');
  c = await cart();
  assert(c.length === 2 && Math.abs(c.find(x => /타일/.test(x.name)).qty - merged * 2) < 0.05,
    '③ 다시 담으면 있던 줄에 더한다: ' + JSON.stringify(c.map(x => x.name + ' ' + x.qty)));

  // ⑤⑥ 발주 목록 — 현장별 묶음·예상 매입가
  await page.evaluate(() => { hjCalcCartWrite([]); materialCalcLog(); });
  await page.click('#modalRoot .calcLogBom[data-p="평화로운아파트"]');
  await page.evaluate(() => materialCalcLog());
  await page.click('#modalRoot .calcLogBom[data-p="유성빌라"]');
  await page.evaluate(() => materialCalcCart());
  t = await modalText();
  assert(/📦 평화로운아파트/.test(t) && /📦 유성빌라/.test(t), '⑤ 발주 목록이 현장별로 묶인다: ' + t.slice(0, 140));
  assert(/전체 합계/.test(t), '⑥ 현장이 둘이면 전체 합계');
  assert(/매입 공급가 기준/.test(t) && /견적가가 아닙니다/.test(t), '⑥ 매입가라고 밝힌다');
  assert(/단가 없는 1줄 빠짐/.test(t), '⑤ 단가 없는 줄을 밝힌다: ' + t.slice(0, 200));
  // 금액은 공급가(÷1.1) × 수량
  const money = await page.evaluate(() => {
    const c = hjCalcCartRead();
    const tile = c.find(x => /타일/.test(x.name) && x.project === '평화로운아파트');
    return { unit: hjCartUnitPrice(tile), qty: tile.qty, sum: hjCartSum(c.filter(x => x.project === '평화로운아파트')) };
  });
  assert(money.unit === 2000, '⑥ 공급가 ÷1.1: ' + money.unit);
  const wrongUnit = await page.evaluate(() => {
    const w = hjCalcCartRead().find(x => /벽지/.test(x.name));
    return { unit: w && w.unit, price: hjCartUnitPrice(w) };
  });
  assert(wrongUnit.unit === '롤' && wrongUnit.price === 0, '⑤ 단위가 다르면 값을 붙이지 않는다: ' + JSON.stringify(wrongUnit));
  assert(money.sum.amount === Math.round(money.unit * money.qty) && money.sum.priced === 1 && money.sum.unpriced === 1,
    '⑤ 현장 합계: ' + JSON.stringify(money));

  // ⑦ 줄 번호가 어긋나지 않는다 — 묶은 뒤에도 그 줄이 지워진다
  const before = (await cart()).length;
  const gone = await page.evaluate(() => {
    const c = hjCalcCartRead(); const target = c.find(x => x.project === '유성빌라');
    document.querySelector('#modalRoot .ccDel[data-id="' + target.id + '"]').click();
    return target.name;
  });
  c = await cart();
  assert(c.length === before - 1 && !c.some(x => x.project === '유성빌라'), '⑦ 그 줄이 지워진다: ' + gone + ' / ' + JSON.stringify(c.map(x => x.project + ':' + x.name)));
  // 수량 고치기도 그 줄에 간다
  await page.evaluate(() => materialCalcCart());
  await page.fill('#modalRoot .ccQty[data-i="0"]', '77');
  await page.evaluate(() => document.querySelector('#modalRoot .ccQty[data-i="0"]').dispatchEvent(new Event('change', { bubbles: true })));
  const first = await page.evaluate(() => hjCalcCartRead()[0]);
  assert(Number(first.qty) === 77, '⑦ 첫 줄 수량이 바뀐다: ' + JSON.stringify(first));

  // ⑧ 고친 값이 남고 합계가 따라 움직인다
  const stuck = await page.evaluate(async () => {
    materialCalcCart();
    const before = hjCartSum(hjCalcCartRead()).amount;
    // 단가가 있는 줄(타일)이라야 합계가 움직인다 — 단가 없는 줄은 금액에 안 들어간다
    const c0 = hjCalcCartRead();
    const ti = c0.findIndex(x => hjCartUnitPrice(x) > 0);
    window.__ti = ti;
    const q = document.querySelector('#modalRoot .ccQty[data-i="' + ti + '"]');
    const i0 = c0[ti];
    q.value = '9'; q.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const sup = document.querySelector('#modalRoot .ccSup[data-i="' + ti + '"]');
    sup.value = '한밭철물'; sup.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    materialCalcCart();                                   // 다시 열어도 남아야 한다
    const after = hjCalcCartRead()[ti];
    return { name: i0.name, qty: after.qty, sup: after.sup,
             shown: document.querySelector('#modalRoot .ccSup[data-i="' + ti + '"]').value,
             before, sumAfter: hjCartSum(hjCalcCartRead()).amount };
  });
  assert(stuck.qty === 9 && stuck.sup === '한밭철물' && stuck.shown === '한밭철물', '⑧ 고친 값이 남는다: ' + JSON.stringify(stuck));
  assert(stuck.sumAfter === 2000 * 9 && stuck.before !== stuck.sumAfter, '⑧ 합계가 고친 수량을 따라간다: ' + JSON.stringify(stuck));
  // 한 칸을 고쳐도 옆 칸에 치던 값이 날아가지 않는다 — 목록을 통째로 다시 그리면 날아간다
  const sibling = await page.evaluate(async () => {
    // 현장이 둘이라야 전체 합계 줄이 나온다 — 단가 없는 자재를 넣어 합계 숫자는 그대로 두고 본다
    const l0 = hjCalcCartRead();
    l0.push({ id: uid(), cat: 'mortar', project: '유성빌라', t: '', name: '레미탈', spec: '', qty: 4, unit: '포' });
    hjCalcCartWrite(l0);
    materialCalcCart();
    const ti = hjCalcCartRead().findIndex(x => hjCartUnitPrice(x) > 0);
    window.__ti = ti;
    const q = document.querySelector('#modalRoot .ccQty[data-i="' + ti + '"]');
    const sup = document.querySelector('#modalRoot .ccSup[data-i="' + ti + '"]');
    sup.value = '치던 중';                                  // 아직 손이 안 떨어진 값
    q.value = '12'; q.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const now = document.querySelector('#modalRoot .ccSup[data-i="' + ti + '"]');
    return { same: now === sup, kept: now && now.value,
             sum: (document.querySelector('#modalRoot .ccSum[data-pkey="평화로운아파트"]') || {}).textContent || '',
             all: (document.querySelector('#modalRoot .ccSumAll') || {}).textContent || '' };
  });
  assert(sibling.same && sibling.kept === '치던 중', '⑧ 옆 칸에 치던 값이 날아가면 안 된다: ' + JSON.stringify(sibling));
  assert(/24,000/.test(sibling.sum), '⑧ 현장 합계가 제자리에서 바뀐다: ' + sibling.sum);
  assert(/24,000/.test(sibling.all), '⑧ 전체 합계도 같이 바뀐다: ' + sibling.all);

  // 0 이나 빈 값은 되돌린다
  const bad = await page.evaluate(async () => {
    const ti = window.__ti;
    const q = document.querySelector('#modalRoot .ccQty[data-i="' + ti + '"]');
    q.value = '0'; q.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    return { stored: hjCalcCartRead()[ti].qty, shown: document.querySelector('#modalRoot .ccQty[data-i="' + ti + '"]').value };
  });
  assert(Number(bad.stored) === 12 && bad.shown === '12', '⑧ 0은 받지 않고 되돌린다: ' + JSON.stringify(bad));

  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /cart|bom/i.test(k)), '⑦ serializeData 최상위 키는 그대로: ' + keys.join(','));
  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));

  console.log('site-bom.e2e OK (① 현장 묶음·50건 ② 이 현장 담기 ③ 같은 자재 합치기 ④ 수량 없는 계산 ⑤ 현장 합계 ⑥ 전체 합계·매입가 ⑦ 줄 번호·저장 키 ⑧ 고친 값 유지)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

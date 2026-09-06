/* quote-hints.e2e.js — 견적 품명 → 🛒 자재 단가 자동 제안 · AI 견적 프롬프트 힌트 (Playwright)

   2026-09-06 v260 (업그레이드 조사 [3]·[6]):
     ① 단가장에 없는 품명을 치면 🛒 자재 구매처·단가의 같은 이름 자재 최저가를 공급가(÷1.1)로 넣고 규격도 채운다(토스트에 '자재')
     ② 단가장(priceBook)에 같은 이름이 있으면 단가장이 우선(토스트 '지난 단가')
     ③ 단가가 이미 있으면 덮지 않는다 / 이름이 자재에 없으면 그대로
     ④ 품명 자동완성(datalist)에 자재 이름이 '공급가 N원 (🛒)' 라벨로 뜬다
     ⑤ AI 견적 프롬프트(aiQuotePromptText): 단가장 값이 숫자 그대로(':0' 이 아니라) 실리고, 자재 최저가 줄이 붙는다; 자재가 없으면 그 줄이 없다
     ⑥ 정적: index.html 에 옛 버그(pb[k].price)가 없다
     ⑦ pageerror 0

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

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert(!/pb\[k\]\.price/.test(src), '⑥ 단가장 값은 숫자다 — pb[k].price 는 항상 undefined(0) 였던 옛 버그');

  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof aiQuotePromptText === 'function' && typeof matByName === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  const SEED = () => {
    state.materials = [
      { id: 'mat_a', name: '타일 본드', spec: '20kg', unit: '통', memo: '', entries: [{ id: 'e1', supplier: '쿠팡', url: 'https://www.coupang.com/x', price: 18000, qty: '', memo: '', checkedAt: '', createdAt: '' }, { id: 'e2', supplier: '한밭철물', url: '', price: 16500, qty: '', memo: '', checkedAt: '', createdAt: '' }], createdAt: '', updatedAt: '' },
      { id: 'mat_c', name: '방수액', spec: '', unit: '', memo: '', entries: [], createdAt: '', updatedAt: '' },
    ];
    state.priceBook = {};
    state.editingQuote = newQuote(); state.tab = 'quotemaker'; render();
  };
  const typeName = async (v) => page.evaluate((val) => {
    let msg = ''; const t = window.toast; window.toast = m => { msg = String(m); t(m); };
    const inp = document.querySelector('#view input[data-qf="name"][data-qi="0"]'); inp.value = val; inp.dispatchEvent(new Event('change', { bubbles: true }));
    window.toast = t; const it = state.editingQuote.items[0]; return { name: it.name, spec: it.spec, price: it.price, msg };
  }, v);

  // ① 자재 최저가 → 공급가·규격
  await page.evaluate(SEED);
  const a = await typeName('타일 본드');
  assert(a.price === 15000 && a.spec === '20kg' && /자재/.test(a.msg) && /15,000원/.test(a.msg) && /16,500원/.test(a.msg) && /한밭철물/.test(a.msg), '① 자재 최저가 16,500(부가세 포함)→공급가 15,000·규격·토스트: ' + JSON.stringify(a));
  // 대소문자·공백 차이도 같은 자재로
  await page.evaluate(SEED);
  const a2 = await typeName('  타일 본드 ');
  assert(a2.price === 15000, '① 앞뒤 공백은 무시: ' + JSON.stringify(a2));

  // ② 단가장 우선
  await page.evaluate(() => { state.priceBook = { '타일 본드': 20000 }; state.editingQuote = newQuote(); render(); });
  const b = await typeName('타일 본드');
  assert(b.price === 20000 && /지난 단가/.test(b.msg), '② 단가장이 있으면 단가장 우선: ' + JSON.stringify(b));

  // ③ 단가가 있으면 안 덮음 / 모르는 이름·가격 없는 자재는 그대로
  await page.evaluate(SEED);
  await page.evaluate(() => { state.editingQuote.items[0].price = 7000; render(); });
  const c = await typeName('타일 본드');
  assert(c.price === 7000 && !/자재/.test(c.msg), '③ 이미 단가가 있으면 덮지 않는다: ' + JSON.stringify(c));
  const c2 = await typeName('방수액');
  assert(c2.price === 7000, '③ 가격 없는 자재는 건드리지 않는다: ' + JSON.stringify(c2));
  await page.evaluate(SEED);
  const c3 = await typeName('없는품목');
  assert(c3.price === 0 && !c3.msg, '③ 모르는 이름은 그대로: ' + JSON.stringify(c3));

  // ④ 데이터리스트
  await page.evaluate(SEED);
  const dl = await page.evaluate(() => [...document.querySelectorAll('#qmItemNames option')].filter(o => o.value === '타일 본드' || o.value === '방수액').map(o => [o.value, o.label]));
  assert(JSON.stringify(dl) === JSON.stringify([['타일 본드', '공급가 15,000원 (🛒)']]), '④ 자재 이름이 공급가 라벨로 자동완성에 뜨고, 가격 없는 자재는 안 뜬다: ' + JSON.stringify(dl));

  // ⑤ AI 프롬프트 힌트
  const pr = await page.evaluate(() => { state.priceBook = { '도배(실크)': 45000, '장판': 0 }; const withMat = aiQuotePromptText('욕실 타일'); state.materials = []; const noMat = aiQuotePromptText('욕실 타일'); return { withMat, noMat }; });
  assert(/참고 단가장: 도배\(실크\):45000/.test(pr.withMat) && !/:0\b/.test(pr.withMat), '⑤ 단가장 값이 숫자 그대로 실리고 0원 항목은 뺀다: ' + pr.withMat.slice(0, 300));
  assert(/참고 자재 최저가\(공급가, 부가세 별도\): 타일 본드\(20kg\): 공급가 15000원\/통 · 한밭철물/.test(pr.withMat), '⑤ 자재 최저가 줄: ' + pr.withMat.slice(0, 400));
  assert(!/참고 자재/.test(pr.noMat) && /현장 설명: 욕실 타일/.test(pr.noMat), '⑤ 자재가 없으면 그 줄이 없다: ' + pr.noMat.slice(0, 300));

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));
  console.log('PASS  quote-hints: 품명→자재 최저가 공급가·규격 · 단가장 우선 · 덮지 않음 · 자동완성 라벨 · AI 프롬프트 단가장 숫자+자재 힌트 · 옛 버그 부재');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

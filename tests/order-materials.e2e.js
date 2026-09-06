/* order-materials.e2e.js — 🚚 발주서가 🛒 자재 구매처를 알아서 채운다 (Playwright)

   2026-09-06 v261 (업그레이드 조사 [0]): 발주서의 거래처 미리채움은 supplierMap(발주 문자를 만든 뒤 학습)만 봐서,
   v258 자재 화면에 적어 둔 구매처를 발주서에서 품목마다 다시 쳤다.
     ① supplierMap 에 없으면 같은 이름 자재의 최저가 구매처가 .moSup 에 미리 채워진다(가격 없는 자재는 첫 구매처)
     ② supplierMap 에 있으면 그것이 우선
     ③ 거래처 자동완성(datalist)에 자재 구매처가 있다
     ④ 발주 문자 카드: 링크로 사는 구매처(URL 있음)는 「🔗 구매 링크」(새 탭·noopener)가 붙고 📇 거래처 목록에는 자동 등록되지 않는다;
        URL 없는 구매처는 예전처럼 거래처에 등록된다
     ⑤ pageerror 0

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
  await page.waitForFunction(() => typeof materialOrder === 'function' && typeof matSupplierUrl === 'function');
  await page.evaluate(() => window.__hjRestoreDone);

  const SEED = () => {
    state.materials = [
      { id: 'mat_a', name: '타일 본드', spec: '20kg', unit: '통', memo: '', entries: [{ id: 'e1', supplier: '쿠팡', url: 'https://www.coupang.com/vp/1', price: 18000, qty: '', memo: '', checkedAt: '', createdAt: '' }, { id: 'e2', supplier: '한밭철물', url: '', price: 16500, qty: '', memo: '', checkedAt: '', createdAt: '' }], createdAt: '', updatedAt: '' },
      { id: 'mat_b', name: '실리콘', spec: '', unit: '개', memo: '', entries: [{ id: 'e3', supplier: '다나와', url: 'https://www.danawa.com/p/2', price: '', qty: '', memo: '', checkedAt: '', createdAt: '' }], createdAt: '', updatedAt: '' },
    ];
    state.suppliers = []; state.supplierMap = {};
    state.projects = [{ name: '둔산현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    const q = newQuote(); q.title = '욕실'; q.project = '둔산현장'; q.items = [{ name: '타일 본드', spec: '20kg', qty: 2, price: 15000 }, { name: '실리콘', spec: '', qty: 3, price: 3000 }, { name: '인건비', spec: '', qty: 1, price: 200000 }];
    state.quotes = [q]; state.editingQuote = null;
  };
  await page.evaluate(SEED);

  // ①③ 미리채움 + 자동완성
  await page.evaluate(() => materialOrder());
  await page.waitForSelector('#moMake');
  const a = await page.evaluate(() => ({ sup: [...document.querySelectorAll('.moSup')].map(i => i.value), list: [...document.querySelectorAll('#moSupList option')].map(o => o.value) }));
  assert(a.sup.join('|') === '한밭철물|다나와|', '① 최저가 구매처(한밭철물)·가격 없는 자재는 첫 구매처(다나와)·모르는 품목은 빈 값: ' + JSON.stringify(a.sup));
  assert(a.list.includes('쿠팡') && a.list.includes('한밭철물') && a.list.includes('다나와'), '③ 자동완성에 자재 구매처: ' + JSON.stringify(a.list));

  // ④ 발주 문자 만들기 → 링크 카드 · 거래처 자동 등록 규칙
  await page.evaluate(() => { document.querySelector('.moSup[data-i="2"]').value = '대덕인력'; document.getElementById('moMake').click(); });
  await page.waitForSelector('.moTxt');
  const cards = await page.evaluate(() => ({
    links: [...document.querySelectorAll('.moLink')].map(x => [x.getAttribute('href'), x.getAttribute('target'), x.getAttribute('rel')]),
    cardSups: [...document.querySelectorAll('.moSend')].map(b => b.dataset.sup),
    suppliers: state.suppliers.map(s => s.name), map: state.supplierMap,
  }));
  assert(cards.links.length === 1 && cards.links[0].join() === 'https://www.danawa.com/p/2,_blank,noopener', '④ 링크로 사는 구매처(다나와)에만 🔗 구매 링크(noopener): ' + JSON.stringify(cards.links));
  assert(cards.suppliers.join('|') === '한밭철물|대덕인력' && cards.map['타일 본드'] === '한밭철물' && cards.map['실리콘'] === '다나와', '④ 쇼핑몰은 거래처 목록에 안 넣고 supplierMap 은 셋 다 학습: ' + JSON.stringify([cards.suppliers, cards.map]));
  await page.evaluate(() => closeModal());

  // ② supplierMap 우선
  await page.evaluate(SEED);
  await page.evaluate(() => { state.supplierMap = { '타일 본드': '동네자재상' }; materialOrder(); });
  await page.waitForSelector('#moMake');
  const b = await page.evaluate(() => document.querySelector('.moSup[data-i="0"]').value);
  assert(b === '동네자재상', '② supplierMap 이 있으면 그것이 우선: ' + b);
  await page.evaluate(() => closeModal());

  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));
  console.log('PASS  order-materials: 발주서 거래처 폴백(최저가 구매처) · supplierMap 우선 · 자동완성 · 🔗 구매 링크 · 쇼핑몰 거래처 미등록');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

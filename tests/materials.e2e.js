/* materials.e2e.js — 🛒 자재 구매처·단가 (Playwright)

   2026-09-04 대표 요청: "자재 거래처 및 구매 링크 가격 정리를 편하게".
     ① 더보기 → 자재 구매처·단가 가 열린다(라우팅), 빈 안내
     ② 자재를 추가하면 목록에 보이고 상세로 들어간다
     ③ 구매처 추가: 링크를 붙여넣으면 쇼핑몰 이름(쿠팡)이 자동으로 채워지고, "12,500원" 같은 가격 글자도 숫자로 저장, 확인일은 오늘
     ④ 주소 없이 도메인만 써도 https 로 저장(스마트스토어), 두 곳 중 싼 곳에 「최저」 표시, 링크는 새 탭·noopener
     ⑤ javascript: 링크는 거부하고 저장하지 않는다
     ⑥ 가격 수정·구매처 삭제가 되고 최저가가 다시 계산된다
     ⑦ 목록 검색·최저가 목록 복사 글에 자재·가격·구매처·링크가 들어간다
     ⑧ 저장(serializeData)에 materials 가 실리고 복원(applyData)으로 그대로 돌아온다
     ⑨ pageerror 0

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
assert(/\['materials','🛒','자재 구매처·단가'\]/.test(source), '더보기 메뉴 그룹에 있다');
assert(/data-moreaction="materials"/.test(source), '옛 더보기 시트에도 있다');
assert(/materials:supplied\?current\.materials:\(current\.materials\|\|\[\]\)/.test(source) && /state\.materials=Array\.isArray\(data\.materials\)/.test(source), '저장·복원 두 곳에 materials 가 있다');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');

  // ① 라우팅 + 빈 안내
  await page.evaluate(() => { state.materials = []; state.suppliers = [{ name: '한밭철물', category: '자재' }]; moreActionHandler('materials'); });
  let t = await modalText();
  assert(/자재 구매처·단가 \(0\)/.test(t) && /등록된 자재가 없습니다/.test(t), '① 열림·빈 안내: ' + t.slice(0, 80));

  // ② 자재 추가
  await page.click('#matAdd'); await page.waitForTimeout(120);
  await page.fill('#matName', '실크 벽지'); await page.fill('#matSpec', '1000×20m'); await page.fill('#matUnit', '롤');
  await page.click('#modalRoot .mfoot button:has-text("저장")');
  t = await modalText();
  assert(/🛒 실크 벽지/.test(t) && /구매처가 없습니다/.test(t), '② 저장 뒤 상세로: ' + t.slice(0, 80));
  const stored = await page.evaluate(() => state.materials.map(m => ({ name: m.name, spec: m.spec, unit: m.unit, entries: m.entries.length })));
  assert(stored.length === 1 && stored[0].name === '실크 벽지' && stored[0].unit === '롤' && stored[0].entries === 0, '② state.materials: ' + JSON.stringify(stored));

  // ③ 구매처 추가 — 링크 붙여넣기 → 쿠팡, 가격 글자 → 숫자
  await page.click('#matEntryAdd'); await page.waitForTimeout(120);
  await page.fill('#matUrl', 'https://www.coupang.com/vp/products/123456');
  await page.dispatchEvent('#matUrl', 'input');
  const auto = await page.evaluate(() => ({ v: document.getElementById('matSup').value, hint: getComputedStyle(document.getElementById('matSupHint')).display !== 'none' }));
  assert(auto.v === '쿠팡' && auto.hint, '③ 링크에서 쇼핑몰 이름 자동 + 자동 입력 안내: ' + JSON.stringify(auto));
  await page.fill('#matPrice', '12,500원'); await page.fill('#matQty', '1롤');
  await page.click('#modalRoot .mfoot button:has-text("저장")');
  const e1 = await page.evaluate(() => { const e = state.materials[0].entries[0]; return { supplier: e.supplier, url: e.url, price: e.price, qty: e.qty, checkedAt: e.checkedAt, today: localDate() }; });
  assert(e1.supplier === '쿠팡' && e1.url === 'https://www.coupang.com/vp/products/123456' && e1.price === 12500 && e1.qty === '1롤' && e1.checkedAt === e1.today, '③ 저장값: ' + JSON.stringify(e1));

  // ④ 도메인만 → https, 최저 표시, 새 탭 noopener
  await page.click('#matEntryAdd'); await page.waitForTimeout(120);
  await page.fill('#matUrl', 'smartstore.naver.com/abc/products/9'); await page.dispatchEvent('#matUrl', 'input');
  await page.fill('#matPrice', '11900');
  await page.click('#modalRoot .mfoot button:has-text("저장")');
  const view = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#modalRoot .matEntry')].map(r => ({ sup: r.querySelector('b').textContent, best: /최저/.test(r.textContent), href: (r.querySelector('a') || {}).getAttribute ? r.querySelector('a').getAttribute('href') : '', target: r.querySelector('a') && r.querySelector('a').getAttribute('target'), rel: r.querySelector('a') && r.querySelector('a').getAttribute('rel') }));
    return { rows, order: rows.map(r => r.sup) };
  });
  assert(view.order.join() === '네이버 스마트스토어,쿠팡', '④ 싼 곳이 위: ' + JSON.stringify(view.order));
  assert(view.rows[0].best && !view.rows[1].best && view.rows[0].href === 'https://smartstore.naver.com/abc/products/9' && view.rows[0].target === '_blank' && /noopener/.test(view.rows[0].rel), '④ 최저 표시·https 보정·noopener: ' + JSON.stringify(view.rows));

  // ⑤ javascript: 거부
  await page.click('#matEntryAdd'); await page.waitForTimeout(120);
  await page.fill('#matUrl', 'javascript:alert(1)'); await page.dispatchEvent('#matUrl', 'input');
  await page.fill('#matSup', '이상한곳'); await page.fill('#matPrice', '100');
  await page.click('#modalRoot .mfoot button:has-text("저장")');
  const rejected = await page.evaluate(() => ({ n: state.materials[0].entries.length, toast: document.querySelector('#toast').textContent, stillDialog: !!document.getElementById('matUrl'), invalid: document.getElementById('matUrl').getAttribute('aria-invalid'), focused: document.activeElement && document.activeElement.id }));
  assert(rejected.n === 2 && /http/.test(rejected.toast) && rejected.stillDialog && rejected.invalid === 'true' && rejected.focused === 'matUrl', '⑤ javascript: 링크는 저장되지 않고 문제 칸으로 포커스: ' + JSON.stringify(rejected));
  await page.click('#modalRoot .mfoot button:has-text("취소")');

  // ⑥ 가격 수정 → 최저 재계산, 삭제
  const coupangId = await page.evaluate(() => state.materials[0].entries.find(e => e.supplier === '쿠팡').id);
  await page.click('#modalRoot .matEdit[data-eid="' + coupangId + '"]'); await page.waitForTimeout(120);
  await page.fill('#matPrice', '9,900'); await page.click('#modalRoot .mfoot button:has-text("저장")');
  const after = await page.evaluate(() => ({ order: [...document.querySelectorAll('#modalRoot .matEntry b')].map(b => b.textContent), best: matBest(state.materials[0]).supplier, price: matBest(state.materials[0]).price }));
  assert(after.order[0] === '쿠팡' && after.best === '쿠팡' && after.price === 9900, '⑥ 수정 뒤 최저 재계산: ' + JSON.stringify(after));
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#modalRoot .matDel[data-eid="' + coupangId + '"]');
  const afterDel = await page.evaluate(() => ({ n: state.materials[0].entries.length, best: matBest(state.materials[0]).supplier, badge: /최저/.test(document.querySelector('#modalRoot').textContent) }));
  assert(afterDel.n === 1 && afterDel.best === '네이버 스마트스토어' && !afterDel.badge, '⑥ 삭제 뒤 1곳뿐이면 「최저」 표시 없음: ' + JSON.stringify(afterDel));
  // 메모만 고치면 확인일은 그대로(가격을 바꿔야 오늘로)
  const memoOnly = await page.evaluate(() => { const e = state.materials[0].entries[0]; e.checkedAt = '2026-08-01'; return e.id; });
  await page.click('#modalRoot .matEdit[data-eid="' + memoOnly + '"]'); await page.waitForTimeout(120);
  await page.fill('#matEMemo', '배송 2일'); await page.click('#modalRoot .mfoot button:has-text("저장")');
  const kept = await page.evaluate(() => { const e = state.materials[0].entries[0]; return { memo: e.memo, checkedAt: e.checkedAt }; });
  assert(kept.memo === '배송 2일' && kept.checkedAt === '2026-08-01', '⑥ 메모만 고치면 확인일 유지: ' + JSON.stringify(kept));

  // ⑦ 목록 검색 + 복사 글
  await page.evaluate(() => { state.materials.push({ id: 'mat_x', name: '타일 본드', spec: '20kg', unit: '통', entries: [{ id: 'me_x', supplier: '한밭철물', url: '', price: 18000, checkedAt: '2026-09-01' }], createdAt: '', updatedAt: '' }); materialCatalog(''); });
  t = await modalText();
  assert(/자재 구매처·단가 \(2\)/.test(t) && /실크 벽지/.test(t) && /타일 본드/.test(t) && /11,900원\/롤/.test(t), '⑦ 목록 2건·최저가 요약: ' + t.slice(0, 120));
  await page.evaluate(() => { document.getElementById('matSearch').__same = true; });
  await page.fill('#matSearch', '본드'); await page.waitForTimeout(300);
  t = await modalText();
  const sameInput = await page.evaluate(() => !!document.getElementById('matSearch').__same && document.activeElement === document.getElementById('matSearch'));
  assert(/타일 본드/.test(t) && !/실크 벽지/.test(t) && sameInput, '⑦ 검색은 목록만 바꾸고 입력칸은 그대로(한글 조합 보호): ' + JSON.stringify({ sameInput, t: t.slice(0, 80) }));
  const copy = await page.evaluate(() => materialsCopyText());
  assert(/실크 벽지 \(1000×20m\): 11,900원\/롤 · 네이버 스마트스토어 https:\/\/smartstore\.naver\.com\/abc\/products\/9 \(확인 2026-08-01\)/.test(copy) && /타일 본드 \(20kg\): 18,000원\/통 · 한밭철물 \(확인 2026-09-01\)/.test(copy), '⑦ 복사 글(확인일 포함): ' + copy);

  // ⑧ 저장·복원 왕복
  const rt = await page.evaluate(() => {
    const s = serializeData();
    const before = JSON.stringify(s.materials);
    const keep = state.materials; state.materials = [];
    applyData(JSON.parse(JSON.stringify(s)));
    const after = JSON.stringify(serializeData().materials);
    return { has: Array.isArray(s.materials) && s.materials.length === 2, same: before === after };
  });
  assert(rt.has && rt.same, '⑧ materials 저장·복원 왕복: ' + JSON.stringify(rt));

  assert(errors.length === 0, '⑨ pageerror: ' + errors.join(' | '));
  console.log('PASS  materials: 자재·구매처·링크 자동 인식·가격 글자·최저·noopener·javascript 거부·수정삭제·검색·복사·왕복');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

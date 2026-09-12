/* receipt-project.e2e.js — 🧾 영수증 지출에 현장·거래처·결제수단 (Playwright)

   2026-09-12 검토에서 드러난 빈틈: 영수증으로 넣은 지출은 현장이 안 붙어 현장 예산이 0원 그대로였고,
   거래처(vendor)는 읽어 놓고 저장되지 않아 경비 분류의 e.vendor 가 죽은 값이었으며, 결제 수단은 말없이 '현금'이 됐다.
     ① 지출 레코드가 거래처를 남긴다 — 경비 분류가 읽는 값이 실제로 채워진다
     ② 영수증 확인 화면에 현장(최근 3개 칩 + 목록)과 결제 수단이 있다
     ③ 고른 현장·거래처·카드로 저장되고, 그 현장 예산(장부 자재비)에 잡힌다
     ④ 자재비를 직접 넣어 둔 현장에는 '수기값을 쓴다'고 알려 준다(이중 계산 방지)
     ⑤ 현장을 안 고르면 미연결로 저장되고 그렇게 알려 준다, pageerror 0

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
assert(/vendor:String\(o\.vendor\|\|''\)/.test(source), '① expenseAdd 가 거래처를 저장한다(정적)');
assert(/id="rsvProj"/.test(source) && /class="rsvMethod/.test(source), '② 영수증 화면에 현장·결제 수단(정적)');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.receiptScanConfirm === 'function' && typeof window.expenseAdd === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const last = () => page.evaluate(() => (state.expenses || [])[state.expenses.length - 1]);

  await page.evaluate(() => {
    state.projects = [{ name: '평화로운아파트', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 } },
                      { name: '유성빌라', stage: 1, received: 0, phases: [], cost: { material: 1200000, labor: 0, outsource: 0 } },
                      { name: '중구상가', stage: 1, received: 0, phases: [], cost: {} }];
    state.expenses = [{ id: 'e0', date: '2026-09-01', amount: 50000, category: '자재', method: '카드', memo: '', project: '중구상가' }];
    state.activeProject = '평화로운아파트'; state.dirty = false;
  });

  // ① 거래처가 실제로 남는다 — 경비 분류가 읽는 값
  const v = await page.evaluate(() => { const r = expenseAdd({ amount: 10000, category: '자재', vendor: '대전타일', memo: '시험' }); return { err: r.오류 || '', last: state.expenses[state.expenses.length - 1] }; });
  assert(!v.err && v.last.vendor === '대전타일', '① 거래처 저장: ' + JSON.stringify(v));
  const seen = await page.evaluate(() => { const e = state.expenses[state.expenses.length - 1]; return guessExpenseCategory((e.memo || '') + ' ' + (e.vendor || '') + ' ' + (e.project || '')); });
  assert(typeof seen === 'string' && seen.length > 0, '① 경비 분류가 거래처 글자를 읽는다: ' + seen);
  await page.evaluate(() => { state.expenses = state.expenses.filter(e => e.id === 'e0'); });

  // ② 화면에 현장·결제 수단
  await page.evaluate(() => receiptScanConfirm({ amount: '320000', vendor: '한샘자재', category: '자재', date: '2026-09-12', items: '압착시멘트 외' }));
  let t = await modalText();
  assert(/결제 수단/.test(t) && /💳 카드/.test(t) && /현장/.test(t), '② 화면: ' + t.slice(0, 120));
  const chips = await page.evaluate(() => [...document.querySelectorAll('.rsvProjChip')].map(b => b.dataset.n));
  assert(chips.join() === '중구상가', '② 최근 쓴 현장 칩: ' + chips.join());
  assert((await page.evaluate(() => document.querySelector('#rsvProj').value)) === '평화로운아파트', '② 지금 보고 있는 현장이 기본');
  assert(/✅ 평화로운아파트 예산에 자재비로 잡힙니다/.test(await page.evaluate(() => document.querySelector('#rsvProjNote').textContent)), '② 예산 반영 안내');

  // ④ 자재비를 직접 넣어 둔 현장이면 알려 준다
  await page.selectOption('#rsvProj', '유성빌라');
  assert(/직접 넣어 두셨습니다/.test(await page.evaluate(() => document.querySelector('#rsvProjNote').textContent)), '④ 수기 자재비 안내');
  await page.selectOption('#rsvProj', '');
  assert(/현장을 고르면/.test(await page.evaluate(() => document.querySelector('#rsvProjNote').textContent)), '④ 미연결 안내');
  await page.click('.rsvProjChip[data-n="중구상가"]');
  assert((await page.evaluate(() => document.querySelector('#rsvProj').value)) === '중구상가', '② 칩을 누르면 그 현장으로');
  await page.selectOption('#rsvProj', '평화로운아파트');

  // ③ 저장 결과와 현장 예산 반영
  await page.click('#modalRoot .mfoot button:has-text("지출 기록")');
  let e = await last();
  assert(e.amount === 320000 && e.project === '평화로운아파트' && e.vendor === '한샘자재' && e.method === '카드' && e.category === '자재', '③ 저장 내용: ' + JSON.stringify(e));
  const stat = await page.evaluate(() => { const s = projStats('평화로운아파트'); return { mat: s.costEffective, src: s.matSrc }; });
  assert(stat.mat === 320000 && stat.src === '장부', '③ 현장 예산(장부 자재비)에 잡힌다: ' + JSON.stringify(stat));
  assert((await page.evaluate(() => state.dirty)) === true, '③ 저장 대기 표시');

  // ⑤ 현장 미연결
  await page.evaluate(() => receiptScanConfirm({ amount: '15000', vendor: '주유소', category: '유류', date: '2026-09-12', items: '경유' }));
  await page.selectOption('#rsvProj', '');
  await page.click('#modalRoot .rsvMethod[data-m="현금"]');
  await page.click('#modalRoot .mfoot button:has-text("지출 기록")');
  e = await last();
  assert(e.project === '' && e.method === '현금' && e.vendor === '주유소', '⑤ 미연결·현금 저장: ' + JSON.stringify(e));
  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));

  console.log('receipt-project.e2e OK (① 거래처 저장 ② 현장·결제수단 화면 ③ 예산 반영 ④ 수기 자재비 안내 ⑤ 미연결·현금)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

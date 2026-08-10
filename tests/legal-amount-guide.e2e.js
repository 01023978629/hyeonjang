/* legal-amount-guide.e2e.js — 관리사무소 수의계약·전문공사 금액 안내
   안내는 보여 주되 저장을 막지 않는다는 불변식을 지킨다.
   전제: tests/static-server.js(8299) 실행 중. */
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
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '한빛아파트', manager: '', phone: '' }];
    state.aptOrders = [];
    state.quotes = [];
    state.projects = [];
    state.files = [];
  });

  // ① 500만원 초과는 경고, 정확히 500만원은 경고 없음
  const apt = await page.evaluate(() => {
    aptOrderManage('of1');
    const root = document.getElementById('modalRoot');
    const amount = root.querySelector('#apoAmt');
    amount.value = '5,000,000'; amount.dispatchEvent(new Event('input', { bubbles: true }));
    const atLimit = root.querySelector('[data-apt-amount-guide]').style.display;
    amount.value = '5,000,001'; amount.dispatchEvent(new Event('input', { bubbles: true }));
    const guide = root.querySelector('[data-apt-amount-guide]').textContent;
    root.querySelector('#apoUnit').value = '관리동 공용부';
    root.querySelector('#apoText').value = '공용부 보수';
    root.querySelector('#apoAdd').click();
    return { atLimit, guide, saved: state.aptOrders.length, amount: state.aptOrders[0] && state.aptOrders[0].amount };
  });
  assert(apt.atLimit === 'none', '① 500만원에서 경고가 뜸');
  assert(/500만원\(부가세 제외\).*전자입찰 대상/.test(apt.guide), '① 500만원 초과 안내 문구가 다름: ' + apt.guide);
  assert(apt.saved === 1 && apt.amount === 5000001, '① 경고가 오더 저장을 막음: ' + JSON.stringify(apt));

  // ② 1,500만원 이상 + 배관 계열이면 경고하고, 저장은 계속된다.
  const quote = await page.evaluate(() => {
    const q = newQuote();
    q.title = '상가 급수 배관 교체'; q.vatIncluded = false;
    q.items = [{ name: '배관 교체', spec: '', qty: 1, price: 15000000 }];
    state.editingQuote = q; state.tab = 'quotemaker'; render();
    const shown = document.querySelector('[data-quote-legal-guide]')?.textContent || '';
    let toastMsg = ''; const realToast = window.toast;
    window.toast = m => { toastMsg = String(m); };
    saveQuoteEdit(); window.toast = realToast;
    return { shown, toastMsg, saved: state.quotes.some(x => x.id === q.id) };
  });
  assert(/1,500만원 이상 전문공사/.test(quote.shown), '② 견적 경고가 안 보임: ' + quote.shown);
  assert(quote.saved, '② 경고가 견적 저장을 막음');
  assert(/견적서 저장됨/.test(quote.toastMsg) && /나눠 계약해도 합산/.test(quote.toastMsg), '② 저장 완료·경고 토스트가 없음: ' + quote.toastMsg);

  // ③ 기준 미만 또는 배관 계열이 아니면 경고하지 않는다.
  const quiet = await page.evaluate(() => {
    const under = newQuote(); under.vatIncluded = false; under.title = '누수 배관';
    under.items = [{ name: '배관', qty: 1, price: 14999999 }];
    const unrelated = newQuote(); unrelated.vatIncluded = false; unrelated.title = '도배 공사';
    unrelated.items = [{ name: '실크 도배', qty: 1, price: 20000000 }];
    return { under: quoteRegistrationGuide(under), unrelated: quoteRegistrationGuide(unrelated) };
  });
  assert(!quiet.under && !quiet.unrelated, '③ 기준 미만/무관 공사에 오경고: ' + JSON.stringify(quiet));

  // ④ 현장 상세의 연결 견적에도 같은 안내가 보인다.
  const project = await page.evaluate(() => {
    state.projects = [{ name: '은행동 누수 설비', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
    const q = newQuote(); q.project = '은행동 누수 설비'; q.vatIncluded = false;
    q.items = [{ name: '급수 배관', qty: 1, price: 15000000 }];
    state.quotes = [q]; syncQuoteToProject(q);
    state.activeProject = '은행동 누수 설비'; state.tab = 'project'; render();
    return document.querySelector('[data-project-legal-guide]')?.textContent || '';
  });
  assert(/건설업 등록 없이 시공할 수 없습니다/.test(project), '④ 현장 상세 안내가 없음: ' + project);

  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));
  console.log('PASS  ① 500만원 초과 안내 + 오더 저장 계속');
  console.log('PASS  ② 1,500만원 이상 배관공사 안내 + 견적 저장 계속');
  console.log('PASS  ③ 기준 미만·무관 공사 오경고 없음');
  console.log('PASS  ④ 현장 상세에도 같은 안내');
  console.log('PASS  ⑤ pageerror 0');
  console.log('\n전부 통과 (5건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

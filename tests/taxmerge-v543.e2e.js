/* v543 PR #189(v428 수금 발행 확인) 통합 — 대표 PDF 3번. #189 는 v425 기준이라 지금 코드(v433·v435·v450·v452 …)와 6곳이 충돌했다.
   이 검사는 #189 자체 검사(taxissue-v428 11개)와 별개로 '합친 자리'만 본다. 합성 자료만, 외부 쓰기 0.
   ① 💰 입금 기록 창: 결제 방법 칸은 v450 #rqMethod 하나(#rqTaxMethod 없음) · 발행 종류·상태 칸 있음 · 예전 증빙 고르기(#rqProof)가 발행 칸을 채움 ·
      결제 방법 '모름'이면 기록에 method 를 안 남김(v450 약속) · 카드면 '해당 없음' + proof card (RECEIVE_FORM)
   ② 💰 월별 손익: 발행 구분 줄이 붙고, 6개월 추이의 '지출' 색은 어두운 화면용 var(--hj-warn-fg) 그대로(v452) (PNL)
   ③ 📅 세금 캘린더: v435 [📤 세무사 전달 자료] 단추와 #189 의 '발행 마감 일정 제안'이 함께 · 전달 자료 단추가 그 창을 연다 (TAX_CAL)
   ④ 누수 견적 받은 돈: 발행 정보 없는 예전 기록이면 견적에 적힌 영수증 종류(세금계산서)에서 시작(열자마자 '없음'으로 덮지 않음) · 저장 뒤 v433 간이영수증 제안 (LEAK_LEGACY)
   ⑤ 📋 대표 할 일 'pr189' 는 '#198 병합 뒤 닫기' · 소스·핀 3곳(v543 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V543_BASELINE=<commit> 은 ① 에서, HJ_V543_MUTATION=dup-method(발행 칸에 결제 방법을 또 그리면)도 ① 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const PJ = 'TEST_V543 가온빌라 3층', LEAK = 'TEST_V543 누수 나래빌라';
const MUT = process.env.HJ_V543_MUTATION || '';
let html = process.env.HJ_V543_BASELINE ? execFileSync('git', ['show', process.env.HJ_V543_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'dup-method');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "hjTaxIssueFields('rqTax',null,pjName,{noMethod:true})";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "hjTaxIssueFields('rqTax',null,pjName)");
}

let browser, passed = 0, page;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS taxmerge-v543 ' + name); }
async function shot(name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }
const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
const lastPay = () => page.evaluate(() => { const x = state.payLog[state.payLog.length - 1]; return { amt: x.amt, hasMethod: 'method' in x, method: x.method, proof: x.proof || '', issue: x.issue || null }; });

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await page.clock.setFixedTime(new Date('2026-10-16T12:00:00+09:00'));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, pj, leak }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure(); __mobileMode = true; applyMobileMode();
    const P = (name, kind) => ({ name, kind, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    state.projects.push(P(pj, 'interior'), P(leak, 'leak'));
    const day = '2026-10-10';
    state.quotes = [{ id: 'TEST_V543_LEAK_Q', project: leak, title: 'TEST_V543 누수 견적', date: day, leak: { from: 'template', cause: '온수관', zone: '전유부' }, items: [{ name: '배관 교체', qty: 1, price: 100000 }], vatIncluded: true,
      paid: { method: '계좌이체', amount: 90000, at: day, receipt: { type: '세금계산서', issued: false }, payLogId: 'TEST_V543_PAY_1' } }];
    state.quotes.forEach(x => syncQuoteToProject(x));
    state.payLog = [{ id: 'TEST_V543_PAY_1', d: day, project: leak, amt: 90000, method: '계좌이체', quoteId: 'TEST_V543_LEAK_Q', source: 'leak-quote' }];
    state.projects.find(p => p.name === leak).received = 90000;
    state.tab = 'dashboard'; render();
  }, { keys: BOOT, pj: PJ, leak: LEAK });

  await test("① 💰 입금 기록 창 — 결제 방법 칸 하나 · 발행 칸 · 증빙 고르기가 발행 칸을 채움 · '모름'은 method 없음 · 카드는 해당 없음 (RECEIVE_FORM)", async () => {
    await page.evaluate(n => recvQuickView(n), PJ); await page.locator('#rqAmt').waitFor();
    const ui = await page.evaluate(() => ({ method: document.querySelectorAll('#modalRoot #rqMethod').length, taxMethod: document.querySelectorAll('#modalRoot #rqTaxMethod').length, type: !!document.getElementById('rqTaxType'), status: !!document.getElementById('rqTaxStatus'), selects: [...document.querySelectorAll('#modalRoot select')].filter(s => /결제 방법/.test((document.querySelector('label[for="' + s.id + '"]') || {}).textContent || '')).length }));
    assert.deepEqual(ui, { method: 1, taxMethod: 0, type: true, status: true, selects: 1 }, 'one payment-method select ' + JSON.stringify(ui));
    await page.locator('#rqProof').selectOption('cash');
    assert.deepEqual(await page.evaluate(() => [document.getElementById('rqTaxType').value, document.getElementById('rqTaxStatus').value]), ['cash', 'issued'], 'legacy proof fills the issuance fields');
    await shot('v543-phone-receive-form');
    await page.locator('#rqAmt').fill('330,000'); await page.locator('#rqMethod').selectOption('계좌이체');
    await footer('입금 저장').click(); await page.waitForFunction(() => /입금 확인증/.test((document.querySelector('#modalRoot h3') || {}).textContent || ''));
    let r = await lastPay();
    assert.deepEqual([r.amt, r.method, r.proof, r.issue && r.issue.type, r.issue && r.issue.status], [330000, '계좌이체', 'cash', 'cash', 'issued'], JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => recvQuickView(n), PJ); await page.locator('#rqAmt').fill('10,000'); await page.locator('#rqMethod').selectOption('');
    await footer('입금 저장').click(); await page.waitForFunction(() => /입금 확인증/.test((document.querySelector('#modalRoot h3') || {}).textContent || ''));
    r = await lastPay(); assert.equal(r.hasMethod, false, "unknown method leaves no method key (v450) " + JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => recvQuickView(n), PJ); await page.locator('#rqAmt').fill('55,000'); await page.locator('#rqMethod').selectOption('카드');
    assert.deepEqual(await page.evaluate(() => [document.getElementById('rqTaxType').value, document.getElementById('rqTaxStatus').value, document.getElementById('rqTaxStatus').disabled]), ['none', 'notApplicable', true]);
    await footer('입금 저장').click(); await page.waitForFunction(() => /입금 확인증/.test((document.querySelector('#modalRoot h3') || {}).textContent || ''));
    r = await lastPay(); assert.deepEqual([r.method, r.proof, r.issue && r.issue.status], ['카드', 'card', 'notApplicable']);
    await page.evaluate(() => closeModal(true));
    assert.equal(await page.evaluate(n => state.projects.find(p => p.name === n).received, PJ), 395000, 'received follows the three payments');
  });

  await test("② 💰 월별 손익 — 발행 구분 줄 + 6개월 추이 '지출' 색은 어두운 화면용 변수 그대로 (PNL)", async () => {
    await page.evaluate(() => pnl('2026-10')); await page.locator('#modalRoot h3', { hasText: '월별 손익' }).waitFor();
    const r = await page.evaluate(() => { const m = document.getElementById('modalRoot'); return { text: m.innerText.replace(/\s+/g, ' '), legend: [...m.querySelectorAll('span')].filter(s => /■ 지출/.test(s.textContent)).map(s => s.getAttribute('style') || '') }; });
    assert(r.legend.length === 1 && /var\(--hj-warn-fg\)/.test(r.legend[0]), 'dark-mode spend colour kept ' + JSON.stringify(r.legend));
    assert(/발행/.test(r.text), 'issuance split shown ' + r.text.slice(0, 300));
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 📅 세금 캘린더 — 세무사 전달 자료 단추와 발행 마감 제안이 함께 · 전달 자료 단추가 열림 (TAX_CAL)', async () => {
    await page.evaluate(() => taxCalendarView()); await page.locator('#modalRoot #txPack').waitFor();
    assert.equal(await page.locator('#modalRoot #txIssueOffer').count(), 1, 'issuance deadline offer kept');
    const h = await page.evaluate(() => [...document.querySelectorAll('#modalRoot #txPack,#modalRoot #txIssueOffer')].map(b => Math.round(b.getBoundingClientRect().height)));
    assert(h.every(x => x >= 44), '44px ' + JSON.stringify(h));
    await page.locator('#modalRoot #txPack').click(); await page.locator('#hjTaxPack').waitFor();
    await page.evaluate(() => closeModal(true));
  });

  await test("④ 누수 받은 돈 — 예전 기록이면 견적의 '세금계산서'에서 시작 · 저장 뒤 간이영수증 제안 (LEAK_LEGACY)", async () => {
    await page.evaluate(() => hjLeakPaymentView(state.quotes.find(q => q.id === 'TEST_V543_LEAK_Q'), () => {}));
    await page.locator('#hjLeakPayAmount').waitFor();
    assert.deepEqual(await page.evaluate(() => [document.getElementById('hjLeakPayReceipt').value, document.getElementById('hjLeakTaxType').value, document.getElementById('hjLeakTaxStatus').value]), ['세금계산서', 'tax', 'pending'], 'starts from the saved receipt type');
    await page.locator('#hjLeakPayMethod').selectOption('현금');
    assert.equal(await page.evaluate(() => document.getElementById('hjLeakPayReceipt').value), '세금계산서', 'method change keeps the receipt type');
    await footer('저장').click(); await page.locator('#modalRoot h3', { hasText: '받은 돈을 저장했어요' }).waitFor();
    const q = await page.evaluate(() => ({ receipt: state.quotes.find(x => x.id === 'TEST_V543_LEAK_Q').paid.receipt, pending: hjLeakReceiptPending() }));
    assert.deepEqual(q, { receipt: { type: '세금계산서', issued: false }, pending: 1 }, 'tax invoice reminder survives ' + JSON.stringify(q));
    await page.evaluate(() => closeModal(true));
  });

  await test("⑤ 대표 할 일 'pr189' · 소스·핀 3곳(v543 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0", async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(/\{id:'pr189',ic:'🔀',title:'PR #189 는 #198 병합 뒤 닫기\(병합 말고\)'/.test(src), 'owner to-do says close #189 after #198');
    assert(!/^<{7} |^>{7} /m.test(src), 'no merge markers');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 543, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('taxmerge-v543: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL taxmerge-v543', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

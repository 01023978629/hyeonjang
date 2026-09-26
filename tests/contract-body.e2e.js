/* contract-body.e2e.js — 전자계약에 부가세·공사기간·공사 범위를 싣는다 (Playwright)

   2026-09-26: 전자계약 서버(manmool ctStandardBody_)는 body.vatIncluded 가 true 가 아니면 제2조를
   '총 계약금액 X원(부가세 별도)' 로, period 가 비면 제4조를 '별도 협의하여 정한다' 로 찍고, scope 를 '공사 범위'
   칸과 제1조에 그린다. 그런데 앱은 body 에 site 와 사진 공정명(p.phases)만 실었다 — 앱 견적 기본값은 부가세 포함이고
   계약금액 기본값도 그 총액이라, 고객이 서명한 계약서가 청구서와 다른 말을 했다. 공사 범위에는 '시공 전'·'완료'
   같은 사진 분류가 섞였다. 지키는 것:
     ① 부가세 포함 앱 견적 → 미리 '포함' 이 골라져 있고 body.vatIncluded === true, 미리보기 제2조가 '(부가세 포함)'
     ② 부가세 별도 앱 견적 → body.vatIncluded === false (서버 기본값에 기대지 않고 명시한다)
     ③ 부가세 여부를 모르는 견적(PDF 에서 읽은 금액·엑셀인데 '포함' 표기 없음·견적마다 다름·견적 없음) →
        아무것도 골라져 있지 않고, 고르기 전에는 서버를 부르지 않는다. 고르면 고른 값이 간다
     ④ 금액을 고치면 견적에서 미리 고른 부가세는 풀린다(다시 골라야 보낸다). 사람이 고른 값은 금액을 고쳐도 남는다
     ⑤ 공사기간: 이 현장 일정(수금·상담 제외, 공정표의 여러 날 끝날 포함) → 'YYYY-MM-DD ~ YYYY-MM-DD'.
        일정이 없으면 period 를 보내지 않는다. 한쪽만·거꾸로 넣으면 보내지 않는다
     ⑥ 공사 범위: 견적 품목 이름(배열). 품목이 없으면 현장 공정에서 사진 전/후 이름(시공 전·시공전·완료)을 뺀 것.
        비어 있어도 배열로 보낸다(빈 문자열이면 서버가 제목을 범위 자리에 넣는다)
     ⑦ contractSend 는 부가세가 true/false 가 아니면(없음·문자열) 부르지 않는다, 틀린 기간 형식도
     ⑧ 멱등 키: 같은 분 안이라도 부가세가 다르면 다른 키, 같은 내용이면 같은 키. 계약 이력에 부가세가 남는다
     ⑨ 360px 에서 넘침 없음 · 입력 44px · pageerror 0

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
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openContractSend === 'function' && !!window.__hjRestoreDone && !!window.__hjRelayBootDone);
  // 부팅의 IDB 복원·중계 설정이 끝난 뒤에 시드를 넣는다 — 늦게 끝난 복원이 시드를 덮으면 엉뚱한 곳에서 떨어진다.
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]));

  // 서버 대신 contractCall 을 가로챈다 — 보낸 payload·idem 을 그대로 잡는다.
  await page.evaluate(() => {
    window.__toasts = []; const ot = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); try { return ot(m); } catch (e) {} };
    window.__qs = [];
    __contract.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __contract.token = 'tk'; __contract.selfTestOk = true;
    window.contractCall = async function (action, payload, opts) {
      if (action === 'health') return { ok: true, live: false };
      if (action === 'quickSend') {
        window.__qs.push({ payload: JSON.parse(JSON.stringify(payload)), idem: opts && opts.idem });
        return { ok: true, contractId: 'ct_' + window.__qs.length, contractNo: 'MM-TEST-' + window.__qs.length,
          signUrl: 'https://script.google.com/macros/s/AKfyTEST/exec?page=sign&t=FAKE', notify: { sent: false, reason: 'MOCK_OFF' } };
      }
      throw new Error('예상 밖 호출: ' + action);
    };
    const cust = { name: '테스트고객', phone: '010-0000-1234', addr: '' };
    const mkQuote = (id, title, project, vat, items) => Object.assign(newQuote(), { id, title, project, vatIncluded: vat, items });
    state.quotes = [
      mkQuote('qa', '가양 욕실 공사', '가양동 욕실', true, [
        { name: '욕실 철거', spec: '', qty: 1, price: 1000000 },
        { name: '벽 타일', spec: '300x600', qty: 10, price: 50000 },
        { name: '부가세', spec: '', qty: 1, price: 0 }]),               // 품목 칸에 섞여 든 세금 줄 — 범위에 넣지 않는다
      mkQuote('qb', '둔산 주방 공사', '둔산동 주방', false, [{ name: '싱크대 교체', spec: '', qty: 1, price: 2000000 }]),
      mkQuote('qm1', '관평 욕실 공사', '관평동 혼합', true, [{ name: '욕실 방수', spec: '', qty: 1, price: 1000000 }]),
      mkQuote('qm2', '관평 도배 공사', '관평동 혼합', false, [{ name: '도배', spec: '', qty: 1, price: 700000 }])
    ];
    state.projects = [
      { name: '가양동 욕실', stage: 1, received: 0, phases: ['시공 전', '철거', '타일', '완료'], cost: {}, customer: cust },
      { name: '둔산동 주방', stage: 1, received: 0, phases: [], cost: {}, customer: cust },
      { name: '유성 빌라', stage: 1, received: 0, phases: ['시공전', '도배', '장판', '완료'], cost: {}, customer: cust },
      { name: '노은 상가', stage: 1, received: 0, phases: [], cost: {}, customer: cust },
      { name: '관평동 혼합', stage: 1, received: 0, phases: [], cost: {}, customer: cust },
      { name: '반석 원룸', stage: 1, received: 0, phases: [], cost: {}, customer: cust }
    ];
    state.files = [
      // PDF 에서 읽은 견적 — 공급가·세액이 읽혀 있어도 이것만으로 '포함' 이라 단정하지 않는다
      { id: 'pdf1', kind: 'estimate', name: '유성빌라 견적.pdf', ext: 'pdf', project: '유성 빌라', est: { amount: 3300000, supply: 3000000, vat: 300000, date: '2026-09-20' } },
      // 엑셀 견적 — '(부가세 포함)' 이 적힌 시트(파서가 vatIncluded:true 로 읽은 것)
      { id: 'x1', kind: 'estimate', name: '노은상가 견적.xlsx', ext: 'xlsx', project: '노은 상가',
        quote: { items: [{ name: '천장 텍스', spec: '', qty: 1, price: 1000000 }], vatIncluded: true },
        est: { amount: 1100000, supply: 1000000, vat: 100000, _fromXlsx: true } },
      // 엑셀 견적 — 표기가 없어 파서가 '별도' 로 둔 것(추정) → 모른다
      { id: 'x2', kind: 'estimate', name: '반석원룸 견적.xlsx', ext: 'xlsx', project: '반석 원룸',
        quote: { items: [{ name: '장판', spec: '', qty: 1, price: 800000 }], vatIncluded: false },
        est: { amount: 800000, supply: 800000, vat: 80000, _fromXlsx: true } }
    ];
    state.quotes.forEach(q => syncQuoteToProject(q));
    state.schedule = [
      { id: 's1', date: '2026-10-05', time: '09:00', title: '욕실 철거', project: '가양동 욕실', memo: '' },
      { id: 's2', date: '2026-10-07', time: '09:00', title: '타일 (3일차 시작)', project: '가양동 욕실', memo: '2026-10-07~2026-10-09 (3일)' },
      { id: 's3', date: '2026-10-20', time: '', title: '💰 수금: 가양동 욕실', project: '가양동 욕실', memo: '' },
      { id: 's4', date: '2026-09-28', time: '10:00', title: '상담·실측: 가양동 욕실', project: '가양동 욕실', memo: '' },
      { id: 's5', date: '2026-10-02', time: '09:00', title: '다른 현장', project: '둔산동 주방X', memo: '' }
    ];
  });
  const seeded = await page.evaluate(() => ({ a: projStats('가양동 욕실').est, b: projStats('둔산동 주방').est, m: projStats('관평동 혼합').est }));
  assert(seeded.a === 1650000, '시드: 가양동 견적 합계가 부가세 포함 1,650,000 이어야 한다(아니면 ①이 헛돈다): ' + seeded.a);
  assert(seeded.b === 2000000, '시드: 둔산동 견적은 별도 2,000,000: ' + seeded.b);
  assert(seeded.m === 1100000 + 700000, '시드: 관평동은 두 견적이 따로 합산된다(아니면 혼합 판정이 헛돈다): ' + seeded.m);

  const open = (name) => page.evaluate((n) => { window.__toasts = []; openContractSend(n); }, name);
  const dlg = () => page.evaluate(() => {
    const root = document.getElementById('modalRoot');
    const r = root.querySelector('input[name=ctVat]:checked');
    return {
      vat: r ? r.value : null, amt: (root.querySelector('#ctAmt') || {}).value, from: (root.querySelector('#ctFrom') || {}).value,
      to: (root.querySelector('#ctTo') || {}).value, scope: (root.querySelector('#ctScope') || {}).value,
      preview: (root.querySelector('#ctPreview') || {}).textContent || '', note: (root.querySelector('#ctVatNote') || {}).textContent || '',
      text: root.textContent || ''
    };
  });
  // [전자계약 준비] 는 비동기다. 끝 신호: 보냈으면 quickSend 가 잡히고 링크 창이 뜬다, 안 보냈으면 이유 토스트가 뜬다.
  const send = async () => {
    const before = await page.evaluate(() => ({ n: window.__qs.length, t: window.__toasts.length }));
    await page.click('#modalRoot .mfoot button.clay');
    await page.waitForFunction((b) => window.__qs.length > b.n || window.__toasts.length > b.t, before);
    const sent = await page.evaluate((b) => window.__qs.length > b.n, before);
    if (sent) await page.waitForFunction(() => !!document.getElementById('ctSignLink'));
    return sent;
  };
  const qsCount = () => page.evaluate(() => window.__qs.length);
  const lastQs = () => page.evaluate(() => window.__qs[window.__qs.length - 1]);
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const closeAll = () => page.evaluate(() => closeModal(true));

  // ① 부가세 포함 앱 견적
  await open('가양동 욕실');
  let d = await dlg();
  assert(d.vat === '1', '① 부가세 포함 견적이면 [부가세 포함] 이 미리 골라져 있다: ' + d.vat);
  assert(/총 계약금액은 금 1,650,000원\(부가세 포함\)으로 한다/.test(d.preview), '① 미리보기 제2조가 서버 문장과 같다: ' + d.preview);
  assert(/공사기간은 2026-10-05 ~ 2026-10-09\./.test(d.preview), '① 미리보기 제4조: ' + d.preview);
  assert(d.from === '2026-10-05' && d.to === '2026-10-09', '⑤ 기간은 공사 일정에서(상담 9/28·수금 10/20 제외, 공정표 끝날 10/09 포함): ' + d.from + '~' + d.to);
  assert(!/시공 전|완료/.test(d.scope) && /욕실 철거/.test(d.scope) && /벽 타일/.test(d.scope), '⑥ 범위 칸은 견적 품목 이름: ' + d.scope);
  assert(!/부가세/.test(d.scope), '⑥ 품목 칸의 세금 줄은 범위가 아니다: ' + d.scope);
  let n0 = await qsCount();
  await send();
  assert(await qsCount() === n0 + 1, '① 보냈다');
  let q = await lastQs();
  assert(q.payload.body.vatIncluded === true, '① body.vatIncluded === true: ' + JSON.stringify(q.payload.body));
  assert(q.payload.amount === 1650000, '① 금액: ' + q.payload.amount);
  assert(q.payload.body.period === '2026-10-05 ~ 2026-10-09', '⑤ body.period 형식: ' + q.payload.body.period);
  assert(Array.isArray(q.payload.body.scope) && q.payload.body.scope.includes('욕실 철거') && q.payload.body.scope.includes('벽 타일'), '⑥ body.scope 는 품목 이름 배열: ' + JSON.stringify(q.payload.body.scope));
  assert(!q.payload.body.scope.some(s => /시공\s*전|완료/.test(s)), '⑥ body.scope 에 사진 분류가 없다: ' + JSON.stringify(q.payload.body.scope));
  assert(q.payload.body.site === '가양동 욕실', '① site');
  const logA = await page.evaluate(() => state.projects.find(p => p.name === '가양동 욕실').contractLog.slice(-1)[0]);
  assert(logA.vatIncluded === true && logA.period === '2026-10-05 ~ 2026-10-09', '⑧ 계약 이력에 부가세·기간이 남는다: ' + JSON.stringify(logA));
  await closeAll();

  // ② 부가세 별도 앱 견적 · 일정 없음 → period 없음
  await open('둔산동 주방');
  d = await dlg();
  assert(d.vat === '0', '② 별도 견적이면 [부가세 별도] 가 미리 골라져 있다: ' + d.vat);
  assert(/\(부가세 별도\)/.test(d.preview) && /공사기간은 별도 협의하여 정한다/.test(d.preview), '② 미리보기: ' + d.preview);
  assert(d.from === '' && d.to === '', '⑤ 이 현장 일정이 없으면 비워 둔다(다른 현장 일정을 끌어오지 않는다)');
  await send();
  q = await lastQs();
  assert(q.payload.body.vatIncluded === false, '② body.vatIncluded === false (명시): ' + JSON.stringify(q.payload.body));
  assert(!('period' in q.payload.body), '⑤ 일정이 없으면 period 를 보내지 않는다: ' + JSON.stringify(q.payload.body));
  assert(JSON.stringify(q.payload.body.scope) === JSON.stringify(['싱크대 교체']), '⑥ scope: ' + JSON.stringify(q.payload.body.scope));
  await closeAll();

  // ③ 모르는 출처 — PDF 견적. 고르기 전엔 안 보낸다. 범위는 공정에서 사진 분류를 뺀 것
  await open('유성 빌라');
  d = await dlg();
  assert(d.vat === null, '③ PDF 견적은 부가세를 미리 고르지 않는다: ' + d.vat);
  assert(/알 수 없어요/.test(d.note) && /공급가 3,000,000원/.test(d.note), '③ 모른다고 말하고 읽은 값을 보여 준다: ' + d.note);
  assert(/부가세 포함\/별도를 골라 주세요/.test(d.preview), '③ 미리보기에도 비었다고 보인다: ' + d.preview);
  assert(d.scope === '도배, 장판', '⑥ 품목이 없으면 공정에서 시공전·완료를 뺀 것: ' + d.scope);
  n0 = await qsCount();
  await send();
  assert(await qsCount() === n0, '③ 고르기 전에는 서버를 부르지 않는다');
  assert(/계약서 제2조에 그대로 적힙니다/.test(await lastToast()), '③ 왜 안 보냈는지 말한다(확인 화면이 먼저 막는다): ' + await lastToast());
  assert(/warn/.test(await page.evaluate(() => document.querySelector('#modalRoot #ctVatBox').style.borderColor)), '③ 골라야 할 칸을 표시한다');
  await page.check('#modalRoot input[name=ctVat][value="0"]');
  assert(!/warn/.test(await page.evaluate(() => document.querySelector('#modalRoot #ctVatBox').style.borderColor)), '③ 고르면 표시가 풀린다');
  await page.fill('#modalRoot #ctAmt', '0');
  await send();
  assert(await qsCount() === n0 && /계약금액을 넣어 주세요/.test(await lastToast()), '③ 0원은 보내지 않는다(서버도 거절한다)');
  await page.fill('#modalRoot #ctAmt', '3,300,000');
  await send();
  assert(await qsCount() === n0 + 1, '③ 고른 뒤에는 보낸다');
  q = await lastQs();
  assert(q.payload.body.vatIncluded === false, '③ 고른 값(별도)이 간다: ' + q.payload.body.vatIncluded);
  assert(JSON.stringify(q.payload.body.scope) === JSON.stringify(['도배', '장판']), '⑥ scope 에 시공전·완료 없음: ' + JSON.stringify(q.payload.body.scope));
  await closeAll();

  // ③ 엑셀 — '(부가세 포함)' 표기가 있으면 안다, 없으면(파서의 추정 '별도') 모른다
  await open('노은 상가');
  d = await dlg();
  assert(d.vat === '1', '③ 엑셀에 부가세 포함이 적혀 있으면 미리 고른다: ' + d.vat);
  assert(d.scope === '천장 텍스', '⑥ 엑셀 품목 이름: ' + d.scope);
  await closeAll();
  await open('반석 원룸');
  d = await dlg();
  assert(d.vat === null, '③ 엑셀에 표기가 없으면 파서가 둔 "별도" 를 믿지 않는다: ' + d.vat);
  n0 = await qsCount();
  await send();
  assert(await qsCount() === n0, '③ 표기 없는 엑셀도 고르기 전엔 안 보낸다');
  await closeAll();
  // ③ 견적마다 부가세가 다르면 모른다
  await open('관평동 혼합');
  d = await dlg();
  assert(d.vat === null && /포함 1건 · 별도 1건/.test(d.note), '③ 견적마다 다르면 고르게 한다: ' + d.vat + ' / ' + d.note);
  await closeAll();
  // ③ 견적이 없으면(수금액 기본값) 모른다 — 가짜 현장 하나로 확인
  await page.evaluate(() => { state.projects.push({ name: '견적없는 현장', stage: 1, received: 500000, phases: [], cost: {}, customer: { name: '테스트고객', phone: '010-0000-1234' } }); });
  await open('견적없는 현장');
  d = await dlg();
  assert(d.vat === null && /견적이 없어/.test(d.note), '③ 견적이 없으면 모른다: ' + d.note);
  assert(d.scope === '', '⑥ 품목도 공정도 없으면 비운다');
  await page.check('#modalRoot input[name=ctVat][value="1"]');
  await send();
  q = await lastQs();
  assert(Array.isArray(q.payload.body.scope) && q.payload.body.scope.length === 0, '⑥ 범위가 비어도 배열로 보낸다(빈 문자열이면 서버가 제목을 넣는다): ' + JSON.stringify(q.payload.body.scope));
  assert(q.payload.amount === 500000, '③ 금액은 수금액 기본값');
  await closeAll();

  // ④ 금액을 고치면 미리 고른 부가세가 풀린다 → 다시 골라야 보낸다. 사람이 고른 값은 남는다
  await open('가양동 욕실');
  await page.fill('#modalRoot #ctAmt', '1,500,000');
  d = await dlg();
  assert(d.vat === null, '④ 금액을 고치면 견적에서 고른 부가세는 풀린다: ' + d.vat);
  assert(/금액을 고치셔서/.test(d.note), '④ 왜 풀렸는지 말한다: ' + d.note);
  n0 = await qsCount();
  await send();
  assert(await qsCount() === n0, '④ 다시 고르기 전에는 안 보낸다');
  await page.fill('#modalRoot #ctAmt', '1,650,000');
  assert((await dlg()).vat === '1', '④ 견적 금액으로 되돌리면 다시 견적의 부가세로');
  await page.fill('#modalRoot #ctAmt', '1,500,000');
  await page.check('#modalRoot input[name=ctVat][value="1"]');
  await page.fill('#modalRoot #ctAmt', '1,400,000');
  d = await dlg();
  assert(d.vat === '1', '④ 사람이 고른 값은 금액을 고쳐도 그대로: ' + d.vat);
  assert(/금 1,400,000원\(부가세 포함\)/.test(d.preview), '④ 미리보기가 따라온다: ' + d.preview);
  // ⑤ 기간 — 한쪽만·거꾸로는 안 보낸다, 둘 다 비우면 period 없이
  await page.fill('#modalRoot #ctTo', '');
  await send();
  assert(await qsCount() === n0, '⑤ 종료일만 비우면 안 보낸다');
  assert(/둘 다 넣거나 둘 다 비워/.test(await lastToast()), '⑤ 이유를 말한다');
  await page.fill('#modalRoot #ctTo', '2026-10-01');
  await send();
  assert(await qsCount() === n0, '⑤ 시작일이 종료일보다 늦으면 안 보낸다');
  await page.fill('#modalRoot #ctTo', '2026-10-30');
  await page.fill('#modalRoot #ctScope', '욕실 철거, 벽 타일, 욕조 설치');
  await send();
  assert(await qsCount() === n0 + 1, '④⑤ 고친 값으로 보낸다');
  q = await lastQs();
  assert(q.payload.amount === 1400000 && q.payload.body.vatIncluded === true, '④ 고친 금액 + 사람이 고른 부가세: ' + q.payload.amount + ' ' + q.payload.body.vatIncluded);
  assert(q.payload.body.period === '2026-10-05 ~ 2026-10-30', '⑤ 고친 기간: ' + q.payload.body.period);
  assert(JSON.stringify(q.payload.body.scope) === JSON.stringify(['욕실 철거', '벽 타일', '욕조 설치']), '⑥ 고친 범위: ' + JSON.stringify(q.payload.body.scope));
  await closeAll();

  // ⑦ contractSend 직접 호출 — 부가세가 true/false 가 아니면·기간 형식이 틀리면 부르지 않는다
  const direct = await page.evaluate(async () => {
    const p = state.projects.find(x => x.name === '가양동 욕실');
    const before = window.__qs.length;
    await contractSend(p, 1000000);
    await contractSend(p, 1000000, {});
    await contractSend(p, 1000000, { vatIncluded: 'true' });
    await contractSend(p, 1000000, { vatIncluded: true, period: '2026-10-09 ~ 2026-10-05' });
    await contractSend(p, 1000000, { vatIncluded: true, period: '10월 초' });
    const refused = window.__qs.length - before;
    // ⑧ 멱등 키 — 같은 분(시계 고정) 안에서 부가세만 다르면 다른 키, 같으면 같은 키
    const realNow = Date.now; Date.now = () => 1790000000000;
    try {
      await contractSend(p, 1000000, { vatIncluded: true, scope: [] }); closeModal(true);
      await contractSend(p, 1000000, { vatIncluded: false, scope: [] }); closeModal(true);
      await contractSend(p, 1000000, { vatIncluded: true, scope: [] }); closeModal(true);
    } finally { Date.now = realNow; }
    const k = window.__qs.slice(-3).map(x => x.idem);
    return { refused, k, lens: k.map(x => String(x).length) };
  });
  assert(direct.refused === 0, '⑦ 부가세 미확정·틀린 기간이면 서버를 부르지 않는다: ' + direct.refused + '건 보냄');
  assert(direct.k[0] !== direct.k[1], '⑧ 부가세가 다르면 다른 멱등 키(같으면 서버가 고치기 전 계약을 돌려준다): ' + direct.k.join(' / '));
  assert(direct.k[0] === direct.k[2], '⑧ 같은 내용 재시도는 같은 멱등 키(두 건 생기지 않게): ' + direct.k.join(' / '));
  assert(direct.lens.every(l => l <= 200), '⑧ 멱등 키 길이는 서버 상한 200 이하');

  // ⑨ 360px — 넘침 없음, 입력·라디오 줄 44px. 모바일 모드는 화면 폭이 아니라 설정값이다 — 모드 CSS(input 44px)가
  //    라디오 줄 높이를 대신 채워 주지 않는 PC 모드에서 잰다(모바일 모드 쪽은 아래에서 따로).
  await page.evaluate(() => { __mobileMode = false; applyMobileMode(); });
  await open('가양동 욕실');
  const measure = () => page.evaluate(() => {
    const m = document.querySelector('#modalRoot .modal'), b = document.querySelector('#modalRoot .mbody');
    const h = s => Math.round(document.querySelector('#modalRoot ' + s).getBoundingClientRect().height);
    const labels = [...document.querySelectorAll('#modalRoot input[name=ctVat]')].map(r => Math.round(r.closest('label').getBoundingClientRect().height));
    return { over: Math.max(m.scrollWidth - m.clientWidth, b.scrollWidth - b.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      amt: h('#ctAmt'), from: h('#ctFrom'), to: h('#ctTo'), scope: h('#ctScope'), labels };
  });
  for (const mode of [false, true]) {
    await page.evaluate((m) => { __mobileMode = m; applyMobileMode(); }, mode);
    const lay = await measure();
    assert(lay.over <= 1, '⑨ 360px 에서 가로 넘침(모바일 모드 ' + mode + '): ' + lay.over);
    assert([lay.amt, lay.from, lay.to, lay.scope].every(x => x >= 44) && lay.labels.every(x => x >= 44), '⑨ 입력·라디오 44px(모바일 모드 ' + mode + '): ' + JSON.stringify(lay));
  }
  await closeAll();

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('PASS  ① 부가세 포함 견적 → vatIncluded true · 미리보기 제2조 (부가세 포함)');
  console.log('PASS  ② 부가세 별도 견적 → vatIncluded false 명시');
  console.log('PASS  ③ 모르는 출처(PDF·표기 없는 엑셀·견적마다 다름·견적 없음)는 고르기 전 안 보냄');
  console.log('PASS  ④ 금액을 고치면 견적의 부가세는 풀리고, 사람이 고른 값은 남는다');
  console.log('PASS  ⑤ 공사기간 YYYY-MM-DD ~ YYYY-MM-DD (수금·상담 제외) · 없으면 안 보냄 · 한쪽만/거꾸로 거부');
  console.log('PASS  ⑥ 공사 범위 = 견적 품목 이름 · 없으면 공정에서 사진 전/후 뺀 것 · 빈 것도 배열');
  console.log('PASS  ⑦ contractSend 는 부가세 미확정·틀린 기간이면 부르지 않는다');
  console.log('PASS  ⑧ 멱등 키가 내용을 따라간다 · 계약 이력에 부가세·기간');
  console.log('PASS  ⑨ 360px 넘침 없음 · 44px · pageerror 0');
  console.log('\n전부 통과 (9건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

/* extras-settle.e2e.js — 🖊 추가공사가 정산·청구·보증서·공사 스토리·고객 페이지로 흐른다 (Playwright)

   2026-09-26: 추가공사(p.extras, v283)를 '확인받음' 까지 적어 놓고도, 그걸 읽는 곳이 추가공사 화면뿐이라
   청구서·잔금·고객 페이지에 안 잡혀 못 받는 일이 생겼다. 정본 hjExtrasBill 하나가 세고 모두 거기서 읽는다.
   시드: 견적 공급가 1,000만 + 견적에 담긴 추가 20만(부가세 포함 견적 → 11,220,000) · 기수금 300만
         확인받은 추가 50만 · 확인 전 30만 · 확인받았지만 금액 협의 1건 · 빈 칸 1건
     ① 정본 hjExtrasBill — 청구에 더하는 것은 '확인받음 + 금액 있음 + 견적에 안 담김' 뿐, 나머지는 pending/quoted
     ② projStats — est(매출)는 그대로, extra=50만, due = est + 50만 − 수금 (마진도 그대로)
     ③ 청구서 — 공사대금 합계 뒤 '[추가] 내용' 행·합계, 청구 금액 = due, 확인 전·금액 협의는 합계 밖 한 줄
     ④ 거래명세서 — 견적에 담긴 추가는 품목에 한 번만, 확인받은 추가는 추가공사 표에, 잔금 = due
     ⑤ 정산 문서 요약·영수증 잔금·자금 흐름·고객 페이지(남은 금액·공사 비용)가 같은 값
        (대시보드의 '미수' 칸은 2026-08-13 대표 결정으로 없앴다 — receivable-removed.check. 되살리지 않는다)
     ⑥ 하자보증서 공사 내용 프리필에 확인받았거나 견적에 담긴 추가공사가 이어 붙는다(칸은 고칠 수 있다)
     ⑦ 공사 스토리에 확인받은 추가공사만 — 확인받은 날(agreedAt), 금액 없으면 '금액 협의'
     ⑧ 추가공사 화면 — '견적에 담김' 표시, '청구서·잔금에 더해짐' 합계가 입력에 따라 움직인다, 확인받음은 날짜를 남긴다
     ⑨ ➕ 견적에 담기 — 품목에 extraId, 이미 담긴 것은 건너뛰고 두 번 눌러도 두 배가 안 된다,
        작성 중(저장 전)에는 청구 금액이 그대로, 저장하면 견적으로 옮겨 가 청구서에 따로 더하지 않는다
     ⑩ 옛 자료(extraId 없는 '[추가] …' 품목) — 이름이 같으면 담김, 이름을 고쳤으면 같은 금액 하나만 담김
     ⑪ 저장 왕복을 지나도 같고 serializeData 최상위 키는 늘지 않는다, pageerror 0
     ⑫ 견적−수금으로 따로 세던 곳(월말 마감 미수·잔금 안내 문자·입금 확인 문자·현장 ZIP 보고서)도 같은 잔금,
        추가공사가 없는 현장의 문자는 옛 글자 그대로
     ⑬ 담김 판정은 est 가 센 견적만(집계 제외·가상 파일 없음 → 청구로, 같은 견적 묶음의 엑셀 대표 → 담긴 것 그대로)
     ⑭ 다른 현장 견적에 안 담기·고객 페이지 갱신·'50만' 금액·영수증 잔금 표기·세대별 보증서

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const PJ = '가상추가현장 101동 1001호';
const EST = 11220000;          // (10,000,000 + 200,000) × 1.1 — 견적에 담긴 추가 20만은 견적 금액 안에 있다
const RECV = 3000000;
const EXTRA = 500000;          // 확인받은 추가(견적 밖)만
const DUE = EST + EXTRA - RECV; // 8,720,000

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  // 부팅 복원·설정 읽기가 끝난 뒤에 시드를 넣는다(늦은 applyData 가 시드를 덮지 않게), 시더는 재운다
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjExtrasBill === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const closeModalNow = () => page.evaluate(() => { try { closeModal(); } catch (_) {} });

  await page.evaluate(({ PJ }) => {
    state.projects = [
      { name: PJ, stage: 3, doneAt: '2026-09-10', received: 3000000, phases: ['철거', '타일'], cost: { material: 2000000, labor: 0, outsource: 0 },
        customer: { name: '김가상', phone: '010-0000-1234', addr: '대전 가상동' }, portalAcc: '1',
        extras: [
          { id: 'ex-agreed', date: '2026-09-03', text: '거실 선반 설치', amount: '500000', days: '1', photo: '', agreed: true, agreedAt: '2026-09-04' },
          { id: 'ex-pending', date: '2026-09-05', text: '베란다 타일 덧방', amount: '300000', days: '', photo: '', agreed: false },
          // 견적에 담긴 것 — 확인받음 표시는 안 했지만 견적 금액에 이미 들어 있다(두 번 세면 안 된다)
          { id: 'ex-quoted', date: '2026-09-02', text: '현관 중문 교체', amount: '200000', days: '', photo: '', agreed: false },
          { id: 'ex-nego', date: '2026-09-06', text: '안방 콘센트 추가', amount: '', days: '', photo: '', agreed: true },
          { id: 'ex-blank', date: '2026-09-07', text: '', amount: '', days: '', photo: '', agreed: false },
        ] },
      // ⑩ 옛 자료 — v327 까지 [견적에 담기]는 품목에 표를 남기지 않았다
      { name: '옛담기현장', stage: 2, received: 0, phases: [], cost: {},
        extras: [
          { id: 'L1', date: '2026-08-01', text: '욕실 수납장', amount: '180000', agreed: true },           // 담은 뒤 금액을 고쳤다 — 이름으로 짝을 찾는다
          { id: 'L2', date: '2026-08-02', text: '주방 타일 덧방(수정)', amount: '250000', agreed: true },   // 담은 뒤 내용을 고쳤다
          { id: 'L3', date: '2026-08-03', text: '창틀 실리콘', amount: '250000', agreed: true },           // 같은 금액, 견적에 없음
        ] },
    ];
    state.files = [];
    state.quotes = [
      { id: 'qx1', no: 'Q-1', title: '김가상', date: '2026-09-01', place: '', vatIncluded: true, accountIdx: 0, memo: '', project: PJ,
        items: [{ name: '욕실 리모델링', spec: '', qty: 1, price: 10000000 }, { name: '[추가] 현관 중문 교체', spec: '', qty: 1, price: 200000, extraId: 'ex-quoted' }] },
      { id: 'qx2', no: 'Q-2', title: '옛고객', date: '2026-08-05', place: '', vatIncluded: false, accountIdx: 0, memo: '', project: '옛담기현장',
        // '[추가] 거실 선반 설치' 는 다른 현장 견적의 품목이다 — 현장이 다르면 짝이 되지 않아야 한다
        items: [{ name: '주방 공사', spec: '', qty: 1, price: 5000000 }, { name: '[추가] 욕실 수납장', spec: '', qty: 1, price: 150000 }, { name: '[추가] 주방 타일 덧방', spec: '', qty: 1, price: 250000 },
          { name: '[추가] 거실 선반 설치', spec: '', qty: 1, price: 999000 }] },
    ];
    state.quotes.forEach(q => syncQuoteToProject(q));
    state.payLog = [{ id: 'pl1', project: PJ, d: '2026-09-01', amt: 3000000 }];
    state.schedule = []; state.expenses = []; state.asLog = [];
    state.activeProject = PJ; state.dirty = false; state.editingQuote = null;
  }, { PJ });

  // ① 정본
  const bill = await page.evaluate(({ PJ }) => { const b = hjExtrasBill(state.projects.find(p => p.name === PJ));
    return { total: b.total, agreed: b.agreed.map(x => x.id), pending: b.pending.map(x => x.id), quoted: b.quoted.map(x => x.id),
      line: hjExtrasPendingLine(b) }; }, { PJ });
  assert(bill.total === EXTRA && JSON.stringify(bill.agreed) === '["ex-agreed"]', '① 청구에 더하는 것은 확인받은 50만 한 건: ' + JSON.stringify(bill));
  assert(JSON.stringify(bill.pending) === '["ex-pending","ex-nego"]', '① 확인 전·금액 협의는 pending(빈 칸은 세지 않는다): ' + JSON.stringify(bill.pending));
  assert(JSON.stringify(bill.quoted) === '["ex-quoted"]', '① 견적에 담긴 것은 quoted: ' + JSON.stringify(bill.quoted));
  assert(bill.line === '청구에 포함되지 않은 추가공사 2건 (확인 전 1건 · 금액 협의 1건)', '① pending 한 줄: ' + bill.line);
  const readOnly = await page.evaluate(() => { const p = { name: '추가공사없음' }; hjExtrasBill(p); projStats('추가공사없음'); return 'extras' in p; });
  assert(readOnly === false, '① 읽기 전용 — 정본이 p.extras 를 만들면 안 된다');

  // ② projStats
  const st = await page.evaluate(({ PJ }) => { const s = projStats(PJ); return { est: s.est, extra: s.extra, due: s.due, recv: s.recv, marginEff: s.marginEff, costEffective: s.costEffective }; }, { PJ });
  assert(st.est === EST, '② est(매출)는 견적 금액 그대로 — 추가공사를 섞지 않는다: ' + st.est);
  assert(st.extra === EXTRA && st.due === DUE, '② due = est + 확인받은 추가 − 수금: ' + JSON.stringify(st));
  assert(st.marginEff === EST - st.costEffective, '② 마진 기준은 그대로: ' + JSON.stringify(st));

  const grab = (html, label) => { const i = html.indexOf(label); if (i < 0) return null; const m = html.slice(i + label.length).match(/(\d{1,3}(?:,\d{3})+)/); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const count = (html, s) => html.split(s).length - 1;

  // ③ 청구서
  const inv = await page.evaluate(({ PJ }) => invoiceHTML(PJ), { PJ });
  assert(grab(inv, '공사대금 합계') === EST, '③ 공사대금 합계 = 견적(담긴 추가 20만 포함): ' + grab(inv, '공사대금 합계'));
  assert(grab(inv, '[추가] 거실 선반 설치') === EXTRA, '③ [추가] 행: ' + grab(inv, '[추가] 거실 선반 설치'));
  assert(grab(inv, '합계 (공사대금 + 추가공사)') === EST + EXTRA, '③ 추가공사 포함 합계: ' + grab(inv, '합계 (공사대금 + 추가공사)'));
  assert(grab(inv, '청구 금액') === DUE && grab(inv, '아래 금액을 청구합니다') === DUE, '③ 청구 금액 = due: ' + grab(inv, '청구 금액') + ' / ' + grab(inv, '아래 금액을 청구합니다'));
  assert(inv.indexOf('청구에 포함되지 않은 추가공사 2건 (확인 전 1건 · 금액 협의 1건)') >= 0, '③ 확인 전·금액 협의는 합계 밖 한 줄');
  assert(inv.indexOf('베란다 타일 덧방') < 0 && inv.indexOf('안방 콘센트 추가') < 0 && inv.indexOf('현관 중문 교체') < 0, '③ 합계에 안 들어간 것·견적에 담긴 것은 [추가] 행으로 나오지 않는다');
  assert(inv.indexOf('(공사대금 부가세 포함 · 추가공사는 확인받은 금액)') >= 0, '③ 추가공사에 부가세를 얹지 않았다는 것을 밝힌다');

  // ④ 거래명세서
  const stmt = await page.evaluate(({ PJ }) => statementHTML(PJ), { PJ });
  assert(count(stmt, '현관 중문 교체') === 1, '④ 견적에 담긴 추가는 품목에 한 번만: ' + count(stmt, '현관 중문 교체'));
  assert(grab(stmt, '[추가] 거실 선반 설치') === EXTRA && grab(stmt, '추가공사 (확인받은 금액)') === EXTRA, '④ 추가공사 표·합계 줄');
  const stTotal = (() => { const i = stmt.indexOf('class="row total"'); return grab(stmt.slice(i), '합계'); })();
  assert(stTotal === EST + EXTRA, '④ 합계 = 공사대금 + 추가공사: ' + stTotal);
  assert(grab(stmt, '잔금') === DUE, '④ 잔금 = due: ' + grab(stmt, '잔금'));
  assert(stmt.indexOf('청구에 포함되지 않은 추가공사 2건') >= 0 && stmt.indexOf('베란다 타일 덧방') < 0, '④ 확인 전은 합계 밖 한 줄');

  // ⑤ 같은 값 — 정산 문서 요약·영수증·자금 흐름·고객 페이지
  const same = await page.evaluate(({ PJ }) => {
    const r = settleDocs(PJ);
    const txt = (document.querySelector('#modalRoot') || {}).textContent || '';
    const pend = (document.querySelector('#sdExPending') || {}).textContent || '';
    closeModal();
    const rc = receiptHTML(PJ, 1000000);
    const cf = cashFlowData().reduce((a, wk) => a + wk.inItems.filter(x => x.name === PJ).reduce((b, x) => b + x.amt, 0), 0);
    const pb = portalBuild(PJ);
    const pv = portalPreviewHtml(pb);
    return { r, txt, pend, rc, cf, due: pb.payment.due, qamt: pb.quote.amount, qsum: pb.quote.summary, pv };
  }, { PJ });
  assert(same.r && same.r.잔금원 === DUE, '⑤ 정산 문서 잔금원: ' + JSON.stringify(same.r));
  assert(/추가공사 50만원/.test(same.txt) && /잔금 872만원/.test(same.txt), '⑤ 정산 요약에 추가공사·잔금: ' + same.txt.slice(0, 160));
  assert(/청구에 포함되지 않은 추가공사 2건/.test(same.pend), '⑤ 정산 요약의 pending 한 줄: ' + same.pend);
  assert(grab(same.rc, '공사 잔금') === DUE, '⑤ 영수증 잔금: ' + grab(same.rc, '공사 잔금'));
  assert(same.cf === DUE, '⑤ 자금 흐름 들어올 돈: ' + same.cf);
  assert(same.due === DUE, '⑤ 고객 페이지 남은 금액: ' + same.due);
  assert(same.qamt === EST + EXTRA && same.qsum === '상세 내역은 전달드린 견적서를 확인해 주세요 · 확인하신 추가공사 500,000원 포함', '⑤ 고객 페이지 공사 비용: ' + same.qamt + ' / ' + same.qsum);
  assert(same.qamt - RECV === same.due, '⑤ 고객 화면 산수 — 공사 비용 − 입금 = 남은 금액');
  assert(same.pv.indexOf('남은 금액 <b>8,720,000원') >= 0, '⑤ 고객 화면 미리보기 남은 금액');

  // ⑥ 하자보증서 공사 내용 프리필
  await page.evaluate(({ PJ }) => warrantyView(PJ), { PJ });
  const work = await page.inputValue('#wrWork');
  assert(work === '철거, 타일 · 추가공사 거실 선반 설치, 현관 중문 교체, 안방 콘센트 추가', '⑥ 공사 내용 프리필: ' + work);
  await page.fill('#wrWork', '욕실 리모델링 일체');
  assert(await page.inputValue('#wrWork') === '욕실 리모델링 일체', '⑥ 칸은 고칠 수 있다');
  await closeModalNow();

  // ⑦ 공사 스토리
  const story = await page.evaluate(({ PJ }) => hjStoryData(PJ).filter(e => /추가공사/.test(e.t)), { PJ });
  assert(story.length === 2 && story.some(e => e.d === '2026-09-04' && e.t === '추가공사 확인 — 거실 선반 설치 500,000원')
    && story.some(e => e.d === '2026-09-06' && e.t === '추가공사 확인 — 안방 콘센트 추가 (금액 협의)'), '⑦ 스토리: ' + JSON.stringify(story));

  // ⑧ 추가공사 화면
  await page.evaluate(({ PJ }) => extraWork(PJ), { PJ });
  const sumOf = () => page.evaluate(() => ((document.querySelector('#exSum') || {}).textContent || '').replace(/\s/g, ''));
  let sum = await sumOf();
  assert(/청구서·잔금에더해짐500,000원/.test(sum) && /견적에담긴1건은견적금액에이미들어있습니다/.test(sum), '⑧ 청구 합계 줄: ' + sum);
  assert(/📄 견적에 담김/.test(await page.textContent('#modalRoot .exRow[data-i="2"]')) && !/견적에 담김/.test(await page.textContent('#modalRoot .exRow[data-i="0"]')), '⑧ 견적에 담긴 줄에만 표시');
  await page.click('#modalRoot .exAgree[data-i="1"]');
  const ag = await page.evaluate(({ PJ }) => { const x = state.projects.find(p => p.name === PJ).extras[1]; return { agreed: x.agreed, at: x.agreedAt, today: localDate(), due: projStats(PJ).due }; }, { PJ });
  assert(ag.agreed === true && ag.at === ag.today && ag.due === DUE + 300000, '⑧ 확인받음 → 날짜가 남고 잔금이 따라 는다: ' + JSON.stringify(ag));
  assert(/청구서·잔금에더해짐800,000원/.test(await sumOf()), '⑧ 다시 그린 합계: ' + await sumOf());
  await page.fill('#modalRoot .exIn[data-k="amount"][data-i="1"]', '350000');
  assert(/청구서·잔금에더해짐850,000원/.test(await sumOf()), '⑧ 금액을 고치면 바로 움직인다: ' + await sumOf());
  await page.fill('#modalRoot .exIn[data-k="amount"][data-i="1"]', '300000');
  await page.click('#modalRoot .exAgree[data-i="1"]');
  const back = await page.evaluate(({ PJ }) => { const x = state.projects.find(p => p.name === PJ).extras[1]; return { agreed: x.agreed, has: 'agreedAt' in x, due: projStats(PJ).due }; }, { PJ });
  assert(back.agreed === false && back.has === false && back.due === DUE, '⑧ 되돌리면 날짜도 지운다: ' + JSON.stringify(back));
  await closeModalNow();

  // ⑫ 견적−수금으로 따로 세던 네 곳도 같은 잔금 — 월말 마감 미수·잔금 안내 문자·입금 확인 문자·현장 ZIP 보고서
  const four = await page.evaluate(async ({ PJ }) => {
    const D = mcData();
    const row = D.due.find(x => x.name === PJ) || null;
    let sms = '';
    const oSms = window.hjSendSms; window.hjSendSms = (ph, t) => { sms = t; };
    monthCloseView(2);
    const btn = document.querySelector('#modalRoot .mcDue[data-pj="' + PJ + '"]');
    const rowTxt = btn ? btn.parentElement.textContent : '';
    if (btn) btn.click();
    window.hjSendSms = oSms; closeModal();
    const p = state.projects.find(x => x.name === PJ);
    const rcpt = receiptText(p, state.payLog[0]);
    // 현장 ZIP — JSZip 스텁(site-zip 과 같은 방식), 다운로드 앵커는 가로챈다
    let report = '';
    const oZip = window.JSZip, oClick = HTMLAnchorElement.prototype.click;
    window.JSZip = function () { const f = { file(n, b) { if (/_현장보고서/.test(n)) report = String(b); return f; }, folder() { return f; } };
      return { folder() { return f; }, file: f.file, generateAsync: async () => new Blob(['z']) }; };
    HTMLAnchorElement.prototype.click = function () {};
    const oFiles = state.files; state.files = oFiles.concat([{ id: 'zf1', project: PJ, name: '가상.txt', kind: 'doc', _virtual: true }]);
    try { await exportProjectZIP(PJ); } finally { state.files = oFiles; window.JSZip = oZip; HTMLAnchorElement.prototype.click = oClick; }
    return { row, rowTxt, sms, rcpt, report };
  }, { PJ });
  assert(four.row && four.row.rest === DUE && four.row.extra === EXTRA, '⑫ 월말 마감 미수 = due: ' + JSON.stringify(four.row));
  assert(/추가공사 500,000원/.test(four.rowTxt), '⑫ 월말 마감 줄에 추가공사: ' + four.rowTxt);
  assert(four.sms.indexOf('공사 잔금 8,720,000원 안내드립니다') >= 0 && four.sms.indexOf('(계약 11,220,000원 · 추가공사 500,000원 · 수금 3,000,000원)') >= 0, '⑫ 잔금 안내 문자: ' + four.sms);
  assert(four.rcpt.indexOf('· 잔액: 8,720,000원') >= 0 && four.rcpt.indexOf('/ 계약 11,220,000원 · 추가공사 500,000원') >= 0, '⑫ 입금 확인 문자 잔액: ' + four.rcpt);
  assert(four.report.indexOf('미수: 8,720,000원') >= 0 && four.report.indexOf('추가공사(고객 확인): 500,000원') >= 0, '⑫ 현장 ZIP 보고서 미수: ' + four.report.replace(/\n/g, ' | '));
  // 추가공사가 없는 현장의 문자는 예전과 글자까지 같다(옛 문구 보존)
  const plain = await page.evaluate(() => { const p = state.projects.find(x => x.name === '옛담기현장'); const o = p.extras; p.extras = [];
    p.received = 1000000; const s = projStats(p.name);
    const t = receiptText(p, { d: '2026-08-06', amt: 1000000 }); p.received = 0; p.extras = o;
    return { t, want: '· 누계 수금: ' + won(1000000) + ' / 계약 ' + won(s.est) + '\n· 잔액: ' + won(s.est - 1000000) }; });
  assert(plain.t.indexOf(plain.want) >= 0, '⑫ 추가공사 없으면 옛 문구 그대로: ' + plain.t + ' / 기대 ' + plain.want);

  // ⑨ 견적에 담기
  await page.evaluate(() => { editQuote('qx1'); });
  await page.evaluate(({ PJ }) => extraWork(PJ), { PJ });
  await page.click('#modalRoot .mfoot button:has-text("견적에 담기")');
  const eq = await page.evaluate(() => state.editingQuote.items.map(it => ({ name: it.name, price: it.price, extraId: it.extraId })));
  assert(eq.filter(it => it.name === '[추가] 현관 중문 교체').length === 1, '⑨ 이미 담긴 것은 다시 안 넣는다: ' + JSON.stringify(eq));
  assert(eq.some(it => it.name === '[추가] 거실 선반 설치' && it.extraId === 'ex-agreed' && it.price === 500000)
    && eq.some(it => it.extraId === 'ex-pending') && eq.some(it => it.extraId === 'ex-nego') && eq.length === 5, '⑨ 품목에 extraId: ' + JSON.stringify(eq));
  assert(/3건을 담았습니다/.test(await lastToast()) && /이미 담긴 1건은 건너뜀/.test(await lastToast()), '⑨ 토스트: ' + await lastToast());
  assert(await page.evaluate(({ PJ }) => projStats(PJ).due, { PJ }) === DUE, '⑨ 저장 전(작성 중)에는 청구 금액이 그대로');
  await page.evaluate(({ PJ }) => extraWork(PJ), { PJ });
  await page.click('#modalRoot .mfoot button:has-text("견적에 담기")');
  assert(/이미 이 견적에 담긴 추가공사/.test(await lastToast()) && (await page.evaluate(() => state.editingQuote.items.length)) === 5, '⑨ 두 번 눌러도 두 배가 안 된다');
  await closeModalNow();
  await page.evaluate(() => saveQuoteEdit());
  const moved = await page.evaluate(({ PJ }) => { const s = projStats(PJ); const b = hjExtrasBill(state.projects.find(p => p.name === PJ)); return { est: s.est, extra: s.extra, due: s.due, quoted: b.quoted.length, inv: invoiceHTML(PJ) }; }, { PJ });
  const EST2 = Math.round((10000000 + 200000 + 500000 + 300000) * 1.1);
  assert(moved.est === EST2 && moved.extra === 0 && moved.due === EST2 - RECV && moved.quoted === 4, '⑨ 저장하면 견적으로 옮겨 가 따로 더하지 않는다: ' + JSON.stringify({ est: moved.est, extra: moved.extra, due: moved.due, quoted: moved.quoted }));
  assert(moved.inv.indexOf('[추가] 거실 선반 설치') < 0 && grab(moved.inv, '청구 금액') === EST2 - RECV, '⑨ 청구서에도 두 번 나오지 않는다');

  // ⑩ 옛 자료
  const legacy = await page.evaluate(() => { const b = hjExtrasBill(state.projects.find(p => p.name === '옛담기현장'));
    return { total: b.total, quoted: b.quoted.map(x => x.id), agreed: b.agreed.map(x => x.id) }; });
  assert(legacy.quoted.includes('L1'), '⑩ 이름이 같은 옛 품목은 담긴 것: ' + JSON.stringify(legacy));
  assert(legacy.quoted.length === 2 && legacy.total === 250000 && legacy.agreed.length === 1, '⑩ 이름을 고친 것은 같은 금액 하나만 담긴 것으로(둘 다 빼지 않는다): ' + JSON.stringify(legacy));

  // ⑬ 담김 판정은 est 가 센 견적만 — 집계 제외(exSum)·가상 파일 없는 견적에만 담긴 추가공사는 청구로 돌아간다(검토 2026-09-26),
  //    같은 현장·같은 금액 엑셀이 대표가 된 묶음(앱이 '같은 견적' 으로 본 것)은 담긴 것 그대로 — 다시 더하면 두 번 청구
  const ded = await page.evaluate(() => {
    const NM = '집계제외현장';
    state.projects.push({ name: NM, stage: 3, doneAt: '2026-09-10', received: 0, phases: [], cost: {},
      extras: [{ id: 'd1', date: '2026-09-01', text: '욕실 환풍기', amount: '500000', agreed: true }] });
    const q = { id: 'qd1', no: 'Q-D', title: '제외고객', date: '2026-09-01', place: '', vatIncluded: false, accountIdx: 0, memo: '', project: NM,
      items: [{ name: '욕실 공사', spec: '', qty: 1, price: 10500000 }, { name: '[추가] 욕실 환풍기', spec: '', qty: 1, price: 500000, extraId: 'd1' }] };
    state.quotes.push(q); syncQuoteToProject(q);
    const snap = () => { const s = projStats(NM); const b = hjExtrasBill(state.projects.find(p => p.name === NM));
      return { est: s.est, extra: s.extra, due: s.due, quoted: b.quoted.length, agreed: b.agreed.length }; };
    const r = {};
    const vf = state.files.find(f => f.id === 'quote_qd1');
    r.qamt = vf.est.amount;
    r.before = snap();
    // 리뷰어 재현 그대로 — 앱 견적은 집계 제외, 엑셀 1,100만이 매출
    vf.exSum = true;
    state.files.push({ id: 'xd1', name: '제외고객 최종 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: NM, est: { amount: 11000000 } });
    r.exsum = snap();
    r.inv = invoiceHTML(NM);
    // 집계 제외를 풀고 엑셀을 앱 견적과 같은 금액으로 — 2차 병합으로 엑셀이 대표, 앱 견적은 사본
    vf.exSum = false; state.files.find(f => f.id === 'xd1').est.amount = vf.est.amount;
    r.reps = dedupeEstimates(state.files.filter(f => f.project === NM && f.kind === 'estimate')).map(f => f.id);
    r.same = snap();
    // 엑셀을 치우고 가상 파일도 없애면(현장 연결이 끊겼던 견적) est 밖
    state.files = state.files.filter(f => f.id !== 'xd1' && f.id !== 'quote_qd1');
    r.novf = snap();
    // 원래대로
    syncQuoteToProject(q);
    r.after = snap();
    return r;
  });
  assert(ded.before.est === ded.qamt && ded.before.extra === 0 && ded.before.quoted === 1, '⑬ 앱 견적이 매출이면 담긴 것: ' + JSON.stringify(ded.before));
  assert(ded.exsum.est === 11000000 && ded.exsum.extra === 500000 && ded.exsum.due === 11500000 && ded.exsum.quoted === 0 && ded.exsum.agreed === 1,
    '⑬ 집계 제외 견적에만 담긴 추가공사는 청구로 돌아간다: ' + JSON.stringify(ded.exsum));
  assert(ded.exsum && ded.inv.indexOf('[추가] 욕실 환풍기') >= 0, '⑬ 청구서에도 [추가] 행');
  assert(JSON.stringify(ded.reps) === '["xd1"]' && ded.same.est === ded.qamt && ded.same.extra === 0 && ded.same.quoted === 1,
    '⑬ 같은 견적으로 묶인 엑셀이 대표면 담긴 것 그대로(두 번 청구 금지): ' + JSON.stringify({ reps: ded.reps, same: ded.same }));
  assert(ded.novf.est === 0 && ded.novf.extra === 500000 && ded.novf.quoted === 0, '⑬ 가상 파일 없는 견적은 est 밖 — 청구로: ' + JSON.stringify(ded.novf));
  assert(ded.after.extra === 0 && ded.after.quoted === 1, '⑬ 되돌리면 다시 담긴 것: ' + JSON.stringify(ded.after));

  // ⑭ 검토 지적 잔손질 — 담기 현장 확인·고객 페이지 갱신·'50만' 금액·영수증 잔금 표기·세대별 보증서
  // (a) 다른 현장 견적에는 담지 않는다 / 현장이 빈 견적은 이 현장으로 연결한다
  const cross = await page.evaluate(({ PJ }) => {
    state.editingQuote = { id: 'qz', no: 'Q-Z', title: '남의견적', date: '2026-09-20', place: '', vatIncluded: true, accountIdx: 0, memo: '', project: '옛담기현장',
      items: [{ name: '다른 공사', spec: '', qty: 1, price: 100 }] };
    const r = {};
    extraWork(PJ);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적에 담기/.test(b.textContent)).click();
    r.n1 = state.editingQuote.items.length; r.t1 = window.__toasts[window.__toasts.length - 1];
    try { closeModal(); } catch (_) {}
    state.editingQuote.project = ''; state.editingQuote.items = [{ name: '', spec: '', qty: 1, price: 0 }];
    extraWork(PJ);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적에 담기/.test(b.textContent)).click();
    r.proj = state.editingQuote.project; r.n2 = state.editingQuote.items.length; r.t2 = window.__toasts[window.__toasts.length - 1];
    try { closeModal(); } catch (_) {}
    state.editingQuote = null; try { render(); } catch (_) {}
    return r;
  }, { PJ });
  assert(cross.n1 === 1 && /「옛담기현장」 현장 견적입니다/.test(cross.t1), '⑭ 다른 현장 견적에는 안 담는다: ' + JSON.stringify(cross));
  assert(cross.proj === PJ && cross.n2 > 1 && /현장에 연결했습니다/.test(cross.t2), '⑭ 현장 빈 견적은 이 현장으로 연결하고 알린다: ' + JSON.stringify(cross));
  // (b) 확인받음·금액·지우기가 고객 페이지 갱신을 건다
  const nudged = await page.evaluate(({ PJ }) => {
    const calls = []; const o = window.portalAutoSync; window.portalAutoSync = n => calls.push(n);
    try {
      extraWork(PJ);
      document.querySelector('#modalRoot .exAgree[data-i="1"]').click();
      const a = calls.length;
      const el = document.querySelector('#modalRoot .exIn[data-k="amount"][data-i="1"]'); el.value = '310000'; el.dispatchEvent(new Event('input'));
      const b = calls.length;
      el.value = '300000'; el.dispatchEvent(new Event('input'));
      document.querySelector('#modalRoot .exAgree[data-i="1"]').click();
      const c = calls.length;
      document.querySelector('#modalRoot #exAdd').click();   // 빈 칸 하나 더해 그것을 지운다(자료는 제자리)
      const dels = document.querySelectorAll('#modalRoot .exDel'); dels[dels.length - 1].click();
      const n = state.projects.find(x => x.name === PJ).extras.length;
      closeModal();
      return { a, b, d: calls.length - c, n, all: calls.every(n => n === PJ) };
    } finally { window.portalAutoSync = o; }
  }, { PJ });
  assert(nudged.a === 1 && nudged.b === 2 && nudged.d === 1 && nudged.n === 5 && nudged.all, '⑭ 청구에 닿는 변경은 고객 페이지 갱신을 건다: ' + JSON.stringify(nudged));
  // (c) '50만' 같은 금액은 50원으로 읽지 않는다 — 청구에서 빼고 칸 아래에 알린다
  // ⑨ 저장 뒤 PJ 의 추가공사는 모두 견적에 담겼다 — 견적 밖인 옛담기현장 L3(확인받음 25만)으로 본다
  const bad = await page.evaluate(() => {
    const NM = '옛담기현장';
    const p = state.projects.find(x => x.name === NM); const x = p.extras[2]; const o = x.amount;
    x.amount = '50만';
    const b = hjExtrasBill(p); const s = projStats(NM);
    const r = { id: x.id, total: b.total, pend: hjExtrasPendingLine(b), extra: s.extra, txt: hjExtraText(NM, [x]) };
    extraWork(NM);
    const w = document.querySelector('#modalRoot .exAmtBad[data-i="2"]'); r.warnShown = !!w && !w.hidden;
    const el = document.querySelector('#modalRoot .exIn[data-k="amount"][data-i="2"]'); el.value = '500,000원'; el.dispatchEvent(new Event('input'));
    r.warnAfter = w.hidden; r.fixed = hjExtrasBill(p).total;
    const w2 = document.querySelector('#modalRoot .exAmtBad[data-i="0"]'); r.okHidden = !!w2 && w2.hidden;
    closeModal(); x.amount = o;
    return r;
  });
  assert(bad.id === 'L3' && bad.total === 0 && bad.extra === 0 && bad.pend === '청구에 포함되지 않은 추가공사 1건 (금액 확인 필요 1건)' && bad.txt.indexOf('금액 협의') >= 0 && bad.txt.indexOf('50원') < 0,
    "⑭ '50만' 은 청구에 넣지 않는다: " + JSON.stringify(bad));
  assert(bad.warnShown && bad.warnAfter && bad.fixed === 500000 && bad.okHidden, '⑭ 칸 아래 경고가 켜졌다 고치면 꺼진다: ' + JSON.stringify(bad));
  // (d) 영수증 잔금은 추가공사가 들어 있다고 밝힌다(없으면 옛 글자 그대로)
  const rc = await page.evaluate(() => {
    const p = state.projects.find(x => x.name === '옛담기현장'); const withEx = receiptHTML(p.name, 1000);
    const o = p.extras; p.extras = []; const plain = receiptHTML(p.name, 1000); p.extras = o;
    return { withEx, plain };
  });
  assert(rc.withEx.indexOf('공사 잔금 (추가공사 포함)') >= 0 && rc.withEx.indexOf('(확인하신 추가공사 250,000원 포함)은 공사 완료 후 정산 예정입니다') >= 0, '⑭ 영수증 잔금 표기');
  assert(rc.plain.indexOf('추가공사') < 0 && rc.plain.indexOf('>공사 잔금</td>') >= 0, '⑭ 추가공사 없으면 영수증 옛 글자 그대로');
  // (e) 세대별 보증서에는 현장 전체 추가공사를 붙이지 않는다
  await page.evaluate(({ PJ }) => { const p = state.projects.find(x => x.name === PJ);
    p.aptUnits = [{ id: 'unit-x1', type: 'unit', dong: '101', ho: '1001', name: '', note: '' }]; warrantyView(PJ, { unitId: 'unit-x1' }); }, { PJ });
  const unitWork = await page.inputValue('#wrWork');
  await closeModalNow();
  await page.evaluate(({ PJ }) => { delete state.projects.find(x => x.name === PJ).aptUnits; }, { PJ });
  assert(unitWork === '철거, 타일', '⑭ 세대별 보증서 공사 내용에 추가공사 없음: ' + unitWork);

  // ⑪ 저장 왕복·최상위 키
  const round = await page.evaluate(({ PJ }) => {
    const before = Object.keys(serializeData()).length;
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.projects = []; state.quotes = [];
    applyData(snap);
    const s = projStats(PJ);
    return { before, keys: Object.keys(serializeData()), due: s.due, extra: s.extra,
      ids: ((state.quotes.find(q => q.id === 'qx1') || {}).items || []).map(it => it.extraId || '') };
  }, { PJ });
  assert(round.before === 41 && round.keys.length === 41 && !round.keys.some(k => /extra/i.test(k)), '⑪ 최상위 키 41개 그대로: ' + round.keys.length);
  assert(round.due === EST2 - RECV && round.extra === 0 && round.ids.filter(Boolean).length === 4, '⑪ 왕복 뒤에도 같다: ' + JSON.stringify(round));
  assert(errors.length === 0, '⑪ pageerror: ' + errors.join(' | '));

  console.log('extras-settle.e2e OK (① 정본 ② projStats ③ 청구서 ④ 거래명세서 ⑤ 같은 잔금 ⑥ 보증서 ⑦ 스토리 ⑧ 추가공사 화면 ⑨ 견적에 담기 ⑩ 옛 자료 ⑪ 왕복 ⑫ 네 곳 잔금 ⑬ 집계 제외·묶음 ⑭ 검토 잔손질)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

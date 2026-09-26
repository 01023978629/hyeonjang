/* quote-flow.e2e.js — v329 견적 앞뒤의 끊긴 길 셋 (Playwright)

   ① 📐 실측에서 가져오기 — 견적 작성 툴바에서 그 견적 현장의 실측(p.measure) 방별 바닥·벽 ㎡ 를 품목으로 넣는다.
      spec '안방 바닥 12㎡' · qty 면적 · 단가 0(금액을 지어내지 않는다). 현장에 실측이 없으면 버튼이 숨는다.
      같은 방·같은 면은 두 번 넣지 않는다(measureRef).
   ② 견적 종결 — 팔로업 화면 「✕ 종결」 → 사유 칩(가격·시기·다른 업체·연락 두절·기타). 견적 안 lost:{at,reason} + result:'lost'
      (견적 이력의 '종결'과 같은 개념). 종결하면 팔로업에서 빠지고, 30일 지난 견적도 종결 대상으로 보이며(예전엔 조용히 사라졌다),
      수주 분석이 사유를 세고, 유사 견적에 '종결 · 사유' 가 붙는다.
   ③ 고객 타임라인 = 현장마다 공사 스토리(hjStoryEvents — 40건 상한 없이. 공사 스토리 화면만 hjStoryData 로 40건) — 계약·AS·보증서·추가공사가 고객 화면에도 보인다.
      파일철(projectHistoryData)에 계약·보증 줄.
   ④ 저장 구조 그대로 — serializeData 최상위 키 불변, pageerror 0.

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
assert(/if\(t\.id==='qmMeasure'\)return quoteFromMeasure\(\);/.test(source), '① 툴바 버튼 배선(정적)');

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
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.quoteFromMeasure === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const keysBefore = await page.evaluate(() => Object.keys(serializeData()).sort().join(','));

  const ago = n => page.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); }, n);
  const D5 = await ago(5), D8 = await ago(8), D10 = await ago(10), D45 = await ago(45), D400 = await ago(400);
  const TODAY = await page.evaluate(() => localDate());

  await page.evaluate(({ D5, D8, D10, D45, D400 }) => {
    state.projects = [
      { name: '실측현장', stage: 1, received: 0, phases: [], cost: {},
        measure: [
          { id: 'r1', room: '안방', w: '3', h: '4', hgt: '2.4', open: '2', note: '' },
          { id: 'r2', room: '거실', w: '5', h: '4', hgt: '2.4', open: '0', note: '' },
          { id: 'r3', room: '빈칸', w: '', h: '', hgt: '', open: '', note: '' },
        ] },
      { name: '빈현장', stage: 1, received: 0, phases: [], cost: {} },
      { name: '고객현장', stage: 3, doneAt: '2026-09-01', received: 500000, phases: ['도배'], cost: {},
        customer: { name: '박가상', phone: '010-0000-5678' },
        contractLog: [{ at: '2026-08-01T09:00:00Z', contractNo: 'C-TEST-1', amount: 1000000, serverStatus: 'COMPLETED', completedAt: '2026-08-02T10:00:00Z' }],
        extras: [{ id: 'x1', date: '2026-08-10', text: '현관 선반', amount: '100000', agreed: true, agreedAt: '2026-08-11' }],
        warrantyDoc: { at: '2026-09-02' } },
    ];
    state.payLog = [{ project: '고객현장', d: '2026-08-05', amt: 500000 }];
    state.asLog = [{ id: 'as1', project: '고객현장', date: '2026-09-15', text: '실리콘 들뜸', status: 'open' }];
    const it = (n, p) => [{ name: n, spec: '', qty: 1, price: p }];
    state.quotes = [
      { id: 'q1', title: '가상 도배 견적', date: D5, items: it('도배(실크)', 3000000), vatIncluded: false },
      { id: 'q2', title: '가상 오래된 견적', date: D45, items: it('장판', 1000000), vatIncluded: false },
      { id: 'q3', title: '수주 견적', date: D10, project: '실측현장', items: it('도배(실크)', 3200000), vatIncluded: false },
      { id: 'q4', title: '옛 실패 표시', date: D8, result: 'lost', items: it('타일', 900000), vatIncluded: false },
      { id: 'q5', title: '아주 옛 견적', date: D400, items: it('몰딩', 500000), vatIncluded: false },
      // 현장 연결 없이 수주로 표시한 것 — 견적 이력과 수주 분석이 같은 판정(quoteStatus)을 쓰는지
      { id: 'q6', title: '수주 표시 견적', date: D5, result: 'won', items: it('욕실', 2000000), vatIncluded: false },
      // result 없이 종결 기록만 남은 자료(손본 백업 등) — 그래도 종결로 본다
      { id: 'q7', title: '종결 기록만', date: D8, lost: { at: D8, reason: '기타' }, items: it('샷시', 700000), vatIncluded: false },
    ];
  }, { D5, D8, D10, D45, D400 });

  /* ── ① 실측 → 견적 품목 ── */
  await page.evaluate(() => { state.editingQuote = newQuote(false); state.tab = 'quotemaker'; render(); });
  assert(await page.evaluate(() => !!document.querySelector('#qmMeasure') && document.querySelector('#qmMeasure').hidden && getComputedStyle(document.querySelector('#qmMeasure')).display === 'none'), '① 연결 현장 없으면 버튼 숨김(실제로 안 보임)');
  await page.selectOption('#qmProj', '실측현장');
  await page.waitForFunction(() => document.querySelector('#qmMeasure') && !document.querySelector('#qmMeasure').hidden);
  const itemsBefore = await page.evaluate(() => state.editingQuote.items.length);
  await page.click('#qmMeasure');
  await page.waitForFunction(() => document.querySelectorAll('#modalRoot .qmmPick').length > 0);
  let mt = await modalText();
  assert(/안방/.test(mt) && /바닥 12㎡/.test(mt) && /벽 31\.6㎡/.test(mt) && /거실/.test(mt) && /벽 43\.2㎡/.test(mt), '① 방별 바닥·벽 면적: ' + mt.slice(0, 300));
  assert(!/빈칸/.test(mt), '① 면적 없는 방은 목록에 없다');
  assert(await page.evaluate(() => document.querySelectorAll('#modalRoot .qmmPick').length) === 4, '① 고를 수 있는 면 4개');
  // 고르지 않고 넣으면 아무것도 안 들어간다
  await page.click('#modalRoot .mfoot button:has-text("품목으로 넣기")');
  assert(/하나 이상/.test(await modalText()), '① 빈 선택 안내');
  await page.check('#modalRoot .qmmPick[data-ref="r1:floor"]');
  await page.check('#modalRoot .qmmPick[data-ref="r2:wall"]');
  await page.fill('#qmmName', '장판');
  await page.click('#modalRoot .mfoot button:has-text("품목으로 넣기")');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .qmmPick'));
  let items = await page.evaluate(() => state.editingQuote.items.filter(x => x.measureRef));
  assert(items.length === 2, '① 두 줄 들어감: ' + JSON.stringify(items));
  const f = items.find(x => x.measureRef === 'r1:floor'), w = items.find(x => x.measureRef === 'r2:wall');
  assert(f && f.name === '장판' && f.spec === '안방 바닥 12㎡' && f.qty === 12 && f.price === 0, '① 안방 바닥 품목: ' + JSON.stringify(f));
  assert(w && w.name === '장판' && w.spec === '거실 벽 43.2㎡' && w.qty === 43.2 && w.price === 0, '① 거실 벽 품목: ' + JSON.stringify(w));
  // newQuote 의 빈 첫 줄은 채워 쓰고 새 줄을 하나만 더한다(빈 줄이 남지 않게)
  const total1 = await page.evaluate(() => state.editingQuote.items.length);
  assert(total1 === itemsBefore + 1, '① 빈 줄 재사용: ' + itemsBefore + '→' + total1);
  assert(await page.evaluate(() => document.querySelectorAll('input[data-qf="spec"]').length) === total1, '① 표가 다시 그려짐');
  // 다시 열면 담긴 면은 막혀 있고, 억지로 체크해도 두 번 들어가지 않는다
  await page.click('#qmMeasure');
  await page.waitForFunction(() => document.querySelectorAll('#modalRoot .qmmPick').length > 0);
  assert(await page.evaluate(() => document.querySelector('#modalRoot .qmmPick[data-ref="r1:floor"]').disabled), '① 담긴 면은 비활성');
  assert(/이미 담김/.test(await modalText()), '① 이미 담김 표시');
  await page.evaluate(() => { document.querySelector('#modalRoot .qmmPick[data-ref="r1:floor"]').checked = true; });
  await page.check('#modalRoot .qmmPick[data-ref="r1:wall"]');
  await page.click('#modalRoot .mfoot button:has-text("품목으로 넣기")');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .qmmPick'));
  items = await page.evaluate(() => state.editingQuote.items.filter(x => x.measureRef).map(x => x.measureRef + '|' + x.name + '|' + x.qty));
  assert(items.length === 3 && items.filter(x => x.startsWith('r1:floor')).length === 1 && items.includes('r1:wall|벽|31.6'), '① 중복 없음·품명 비우면 면 이름: ' + JSON.stringify(items));
  // 다른 현장(실측 없음)으로 바꾸면 버튼이 숨는다
  await page.selectOption('#qmProj', '빈현장');
  await page.waitForFunction(() => document.querySelector('#qmMeasure').hidden && getComputedStyle(document.querySelector('#qmMeasure')).display === 'none');
  await page.evaluate(() => { state.editingQuote = null; state.tab = 'dashboard'; closeModal(); render(); });

  /* ── ② 견적 종결 ── */
  assert(await page.evaluate(() => quoteStatus(state.quotes.find(q => q.id === 'q4'))) === 'lost', '② 옛 실패 표시 = 종결');
  assert(await page.evaluate(() => quoteStatus(state.quotes.find(q => q.id === 'q7'))) === 'lost', '② 종결 기록만 있어도 종결');
  let fu = await page.evaluate(() => quoteFollowupData().map(x => x.id).join(','));
  assert(fu === 'q1', '② 팔로업은 진행 중 3~30일만(수주·종결 제외): ' + fu);
  let st = await page.evaluate(() => quoteStaleData().map(x => x.id).join(','));
  assert(st === 'q2', '② 30일 지난 견적이 종결 대상으로: ' + st);
  await page.evaluate(() => quoteFollowup());
  await page.waitForSelector('#modalRoot .qfClose[data-q="q1"]');
  mt = await modalText();
  assert(/30일 지난 견적 1건/.test(mt) && /가상 오래된 견적/.test(mt), '② 팔로업 화면에 30일 지난 견적: ' + mt.slice(0, 300));
  assert(await page.evaluate(() => { const r = document.querySelector('#modalRoot .qfReasons[data-q="q1"]'); return r.hidden && getComputedStyle(r).display === 'none'; }), '② 사유 칩은 종결을 눌러야 열린다');
  await page.click('#modalRoot .qfClose[data-q="q1"]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .qfReasons[data-q="q1"]').hidden);
  await page.click('#modalRoot .qfReason[data-id="q1"][data-r="가격"]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .qfClose[data-q="q1"]'));
  let q1 = await page.evaluate(() => state.quotes.find(q => q.id === 'q1'));
  assert(q1.result === 'lost' && q1.lost && q1.lost.reason === '가격' && q1.lost.at === TODAY, '② 종결 기록: ' + JSON.stringify(q1));
  assert(await page.evaluate(() => quoteFollowupData().length) === 0, '② 종결하면 팔로업에서 빠진다');
  // 팔로업 대상이 없어도 30일 지난 견적이 있으면 화면이 그것을 보여 준다
  await page.click('#modalRoot .qfClose[data-q="q2"]');
  await page.click('#modalRoot .qfReason[data-id="q2"][data-r="연락 두절"]');
  await page.waitForFunction(() => !document.querySelector('#modalRoot .qfClose'));
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q2'); return q.lost.reason === '연락 두절' && quoteStaleData().length === 0; }), '② 30일 지난 견적 종결');
  // 견적 이력의 ✕ 종결 과 같은 개념 — 표시하면 lost 가 생기고, 풀면 같이 지워진다
  await page.evaluate(() => { closeModal(); quoteMark('q5', 'lost'); });
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return q.result === 'lost' && q.lost && !!q.lost.at && q.lost.reason === ''; }), '② 견적 이력 종결 = lost 기록');
  await page.evaluate(() => quoteMark('q5', 'lost'));
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return !q.result && !('lost' in q) && quoteStatus(q) !== 'lost'; }), '② 종결 풀면 lost 도 지움');
  // 종결 뒤 수주·보냄으로 바꿔도 lost 가 남지 않는다 — quoteStatus 가 lost.at 을 보므로, 남으면 수주를 풀 때 '종결'로 되살아난다
  await page.evaluate(() => { quoteMark('q5', 'lost'); quoteMark('q5', 'won'); });
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return q.result === 'won' && !('lost' in q); }), '② 종결→수주면 lost 지움');
  await page.evaluate(() => quoteMark('q5', 'won'));
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return !q.result && !('lost' in q) && quoteStatus(q) === 'draft'; }), '② 수주 풀면 진행 중(종결로 되살아나지 않음)');
  await page.evaluate(() => { quoteMark('q5', 'lost'); quoteMark('q5', 'sent'); });
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return !q.result && !('lost' in q) && quoteStatus(q) === 'sent'; }), '② 종결→보냄이면 lost 지움');
  await page.evaluate(() => { quoteMark('q5', 'sent'); closeModal(); });
  assert(await page.evaluate(() => { const q = state.quotes.find(x => x.id === 'q5'); return !q.result && !q.sentAt && !('lost' in q); }), '② q5 원래대로');
  // 견적 이력에서 사유 칩 — 옛 '실패' 표시(q4)에 사유를 붙인다
  await page.evaluate(() => quoteHistoryView(true));
  await page.waitForSelector('#modalRoot .qhReason[data-id="q4"]');
  await page.click('#modalRoot .qhReason[data-id="q4"][data-r="시기"]');
  await page.waitForFunction(() => { const q = state.quotes.find(x => x.id === 'q4'); return q.lost && q.lost.reason === '시기'; });
  assert(/종결/.test(await modalText()) && !/✕ 실패/.test(await modalText()), '② 견적 이력 낱말도 종결');
  // 수주 분석 — 사유 집계, 진행 중에서 종결 제외
  const wr = await page.evaluate(() => { closeModal(); return winRateData(); });
  assert(wr.total === 7 && wr.won === 2 && wr.lost === 4 && wr.pending === 1 && wr.rate === 29, '② 수주 분석 셈: ' + JSON.stringify(wr));
  assert(wr.lostReasons['가격'] === 1 && wr.lostReasons['연락 두절'] === 1 && wr.lostReasons['시기'] === 1 && wr.lostReasons['기타'] === 1, '② 사유 집계: ' + JSON.stringify(wr.lostReasons));
  await page.evaluate(() => winRateCoach());
  await page.waitForSelector('#modalRoot #wrLost');
  mt = await modalText();
  assert(/종결 사유 4건/.test(mt) && /가격1건/.test(mt.replace(/\s/g, '')) && await page.evaluate(() => document.querySelectorAll('#modalRoot .wrReason').length) === 4, '② 수주 분석 화면 사유: ' + mt.slice(0, 400));
  // 유사 견적 — 종결 견적 표시
  await page.evaluate(() => { closeModal(); similarQuoteDialog('q3'); });
  await page.waitForSelector('#modalRoot .sqLost');
  assert(/종결 · 가격/.test(await page.evaluate(() => document.querySelector('#modalRoot .sqLost').textContent)), '② 유사 견적 종결·사유 배지');
  await page.evaluate(() => closeModal());
  // 유사 견적 배지도 quoteStatus 하나로 — 현장 연결 없이 수주 표시한 견적은 수주, 현장이 붙었어도 종결한 견적은 종결
  const sq = await page.evaluate(() => {
    state.quotes.push({ id: 'q8', title: '수주표시만', date: '2026-09-01', result: 'won', items: [{ name: '도배(실크)', spec: '', qty: 1, price: 3100000 }], vatIncluded: false });
    state.quotes.push({ id: 'q9', title: '현장붙은 종결', date: '2026-09-01', project: '빈현장', result: 'lost', lost: { at: '2026-09-02', reason: '시기' }, items: [{ name: '도배(실크)', spec: '', qty: 1, price: 3100000 }], vatIncluded: false });
    const r = similarQuotes('q3').filter(s => s.q.id === 'q8' || s.q.id === 'q9').map(s => s.q.id + ':' + (s.won ? 'W' : '') + (s.lost ? 'L' : ''));
    state.quotes = state.quotes.filter(q => q.id !== 'q8' && q.id !== 'q9');
    return r.sort().join(',');
  });
  assert(sq === 'q8:W,q9:L', '② 유사 견적 배지 = quoteStatus: ' + sq);

  /* ── ③ 고객 타임라인 = 공사 스토리 ── */
  const key = await page.evaluate(() => customerKey(state.projects.find(p => p.name === '고객현장')));
  const tl = await page.evaluate(k => customerTimeline(k), key);
  const titles = tl.map(e => e.title).join(' | ');
  assert(/전자계약 C-TEST-1/.test(titles) && /고객 서명 완료/.test(titles), '③ 계약 줄: ' + titles);
  assert(/AS 접수 — 실리콘 들뜸/.test(titles), '③ AS 줄: ' + titles);
  assert(/완료보증서 발급/.test(titles), '③ 보증서 줄: ' + titles);
  assert(/추가공사 확인 — 현관 선반/.test(titles), '③ 추가공사 줄: ' + titles);
  assert(/고객현장 완공/.test(titles) && tl.filter(e => /입금/.test(e.title)).length === 1, '③ 완공·입금 한 번씩: ' + titles);
  assert(tl.every(e => e.date), '③ 날짜 없는 줄 없음');
  await page.evaluate(k => crmDialog(k), key);
  mt = await modalText();
  assert(/AS 접수/.test(mt) && /공사 스토리/.test(mt) && !/완공·수금·리뷰 요청이 자동으로/.test(mt), '③ 고객 화면: ' + mt.slice(0, 300));
  await page.evaluate(() => closeModal());
  // 사진 날이 40일을 넘는 긴 현장 — 공사 스토리 화면은 최근 40건이지만, 고객 타임라인에서 계약금 입금·계약 줄이 빠지면 안 된다
  const longTl = await page.evaluate(() => {
    state.projects.push({ name: '긴현장', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '최가상', phone: '010-0000-4321' },
      contractLog: [{ at: '2026-01-02T09:00:00Z', contractNo: 'C-TEST-LONG', amount: 2000000, serverStatus: 'SENT' }] });
    state.payLog.push({ project: '긴현장', d: '2026-01-03', amt: 1000000 });
    const base = Date.parse('2026-02-01T03:00:00Z');
    for (let i = 0; i < 45; i++) state.files.push({ id: 'lp' + i, kind: 'photo', project: '긴현장', name: 'lp' + i + '.jpg', when: base + i * 86400000 });
    const k = customerKey(state.projects.find(p => p.name === '긴현장'));
    const t = customerTimeline(k).map(e => e.title);
    const capped = hjStoryData('긴현장').map(e => e.t);
    // 파일철은 최근 40줄만 보이고 나머지는 '더 있음(more)'으로 센다 — 계약 줄이 목록에서 빠지면 그 수가 하나 준다
    const hd = projectHistoryData('긴현장'); const hist = hd.timeline.length + hd.more;
    state.projects = state.projects.filter(p => p.name !== '긴현장');
    state.payLog = state.payLog.filter(x => x.project !== '긴현장');
    state.files = state.files.filter(f => f.project !== '긴현장');
    return { t, capped, hist };
  });
  assert(longTl.t.some(x => /전자계약 C-TEST-LONG/.test(x)) && longTl.t.some(x => /입금 /.test(x)) && longTl.t.filter(x => /시공 사진/.test(x)).length === 45, '③ 긴 현장도 첫 계약·입금 줄: ' + longTl.t.slice(-5).join(' | '));
  assert(longTl.hist === 47, '③ 파일철도 긴 현장의 계약 줄을 센다(사진 45일+입금 1+계약 1): ' + longTl.hist);
  assert(longTl.capped.length === 40 && !longTl.capped.some(x => /C-TEST-LONG/.test(x)), '③ 공사 스토리 화면은 여전히 최근 40건: ' + longTl.capped.length);
  const ph = await page.evaluate(() => projectHistoryData('고객현장').timeline.map(e => e.ic + e.t).join(' | '));
  assert(/✍️전자계약 C-TEST-1/.test(ph) && /🛡완료보증서 발급/.test(ph), '③ 파일철에 계약·보증: ' + ph);

  /* ── ④ 저장 구조 ── */
  const keysAfter = await page.evaluate(() => Object.keys(serializeData()).sort().join(','));
  assert(keysAfter === keysBefore, '④ 직렬화 최상위 키 불변');
  const saved = await page.evaluate(() => serializeData().quotes.find(q => q.id === 'q1'));
  assert(saved && saved.lost && saved.lost.reason === '가격', '④ 종결 기록이 저장 자료에 실린다');
  assert(!errors.length, 'pageerror: ' + errors.join('\n'));
  console.log('PASS quote-flow ①~④');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });

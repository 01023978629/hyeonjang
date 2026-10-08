/* 임시 스크린샷 스크립트(커밋하지 않음) — v350·v351 화면을 390px 로 찍어 대표 확인용 */
'use strict';
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8302/index.html';
const OUT = process.env.OUT || '/mnt/user-data/outputs/shots351';
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const EUCKR_CSV_HEX = 'b0c5b7a1c0cfc0da2cc3e2b1ddb1ddbed72cc0d4b1ddb1ddbed72cb0c5b7a1c8c4c0dcbed72cb0c5b7a1b3bbbfeb2cb0c5b7a1b1e2b7cfbbe7c7d70a323032362e31302e30322c2c313530303030302c353030303030302cc0cec5cdb3ddb9f0c5b72cb1e8b0edb0b40a323032362e31302e30332c3230303030302c2c343830303030302cc3bcc5a9c4abb5e52cb8b6c6ae0a';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route('https://**/*', r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  await page.evaluate(({ d9, d3, d6 }) => {
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = []; state.schedule = []; state.notes = []; state.asLog = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [
      P('삼성아파트 101동 1001호', { phases: ['철거', '타일', '도배'], customer: { name: '박영희', phone: '010-2222-3333', addr: '' } }),
      P('둔산 상가', { extras: [{ id: 'x1', text: '간판 철거' }, { id: 'x2', text: '전기 콘센트 2개', amount: '150000', agreed: true }], customer: { name: '이철수', phone: '', addr: '' } }),
      P('대전 빌라', { punch: [{ id: 'p1', area: '거실', text: '벽지 들뜸', status: 'fix' }, { id: 'p2', area: '거실', text: '몰딩 이음새', status: 'ok' }, { id: 'p3', area: '욕실1', text: '실리콘 마감', status: 'done' }] }),
      P('유성 카페', { stage: 3, doneAt: d3 })
    ];
    state.files = [{ id: 'a1', name: 'a1.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '', project: '삼성아파트 101동 1001호', when: new Date(), handle: null, _file: null, _virtual: true, text: '', ocr: 'na', _phase: '철거' },
      { id: 'e1', name: '20260901 둔산 상가 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '둔산 상가', est: { amount: 12000000, supply: 10909091, vat: 1090909, date: '2026-09-01' }, when: new Date('2026-09-01') }];
    state.schedule = [Object.assign(newSchedule(), { title: '타일', date: d9, time: '09:00', project: '삼성아파트 101동 1001호' }), Object.assign(newSchedule(), { title: '도배', date: ago => ago, project: '삼성아파트 101동 1001호' })].slice(0, 1);
    state.payLog = [{ d: d6, project: '유성 카페', amt: 2500000 }, { d: d6, project: '둔산 상가', amt: 6000000, proof: 'cash', proofAt: d6 }];
    ['lossAlertData', 'budgetAlertData', 'boardWarrantyRows', 'staleProjectData', 'reviewRequestData', 'asOpenData'].forEach(fn => { window[fn] = () => []; });
    try { closeModal(); } catch (e) {}
    __mobileMode = true; applyMobileMode(); state.tab = 'dashboard'; render();
  }, { d9: ago(9), d3: ago(3), d6: ago(6) });
  await page.waitForTimeout(400);
  // 1) 대시보드 — 브리핑 펼침 + 보드 전체
  await page.evaluate(async () => { const t = document.querySelector('[data-brieftoggle]'); if (t) t.click(); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector('[data-boardtoggle]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  const card = await page.$('.brief-card');
  await card.screenshot({ path: OUT + '/01_대시보드_브리핑_보드.png' });
  // 2) 공정 지연 점검 (현장 창)
  await page.evaluate(() => hjDelayPick('삼성아파트 101동 1001호')); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/02_공정지연점검.png' });
  await page.evaluate(() => closeModal());
  // 3) 수금 이력 → 통장 가져오기
  await page.evaluate(() => payHistoryView(true)); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/03_수금이력_버튼.png' });
  await page.evaluate(() => { closeModal(); hjBankImportView(() => payHistoryView()); }); await page.waitForTimeout(300);
  await page.setInputFiles('#bkFile', { name: '농협_거래내역.csv', mimeType: 'text/csv', buffer: Buffer.from(EUCKR_CSV_HEX, 'hex') });
  await page.waitForSelector('#modalRoot .bkRow'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/04_통장가져오기_제안.png' });
  await page.evaluate(() => closeModal());
  // 4) 더보기 — 현장·시공 묶음(🕒 공정 지연 점검 보이게)
  await page.evaluate(() => { try { openMoreSheet(); } catch (e) { try { moreSheet(); } catch (_) {} } }); await page.waitForTimeout(400);
  const more = await page.evaluate(() => { const el = [...document.querySelectorAll('button,[data-moreact],[data-moreaction]')].find(b => /공정 지연 점검/.test(b.textContent)); if (el) { el.scrollIntoView({ block: 'center' }); return true; } return false; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/05_더보기_공정지연점검.png' });
  console.log('shots ok, more item found:', more);
  await browser.close();
})();

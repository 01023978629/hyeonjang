/* bankimport-v350.e2e.js — v350 🏦 통장 입금 내역 가져오기 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음(xlsx 라이브러리도 못 받는다 — csv 경로로 끝까지).
   실데이터(2026-10-08) 견적 72곳·입금 기록 0건 — 통장 거래내역(xlsx·csv)에서 입금 줄만 뽑아 현장을 제안하고, 사람이 체크한 것만 저장한다.
   · 머리글 찾기(농협식 입금금액 열 / 카카오식 구분+거래금액), 날짜 꼴(2026/10/02 14:22, 엑셀 일련번호, 2026.10.03, 20261004), 합계 줄 제외
   · 제안은 이름이 맞을 때만(고객명·예전 입금자·현장명). 금액만 맞으면 힌트. 후보 동점이면 비움. 같은 날·금액·현장은 '이미 기록됨'
   · 저장은 hjPayRecordAdd 한 곳(💰 입금 기록 창과 같다) — received·payLog·독촉 작업 닫기. 최상위 키 41개. 그리기만으로 저장본 불변. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
// 농협식 csv 를 EUC-KR 로 저장한 바이트(은행 csv 는 보통 EUC-KR) — '거래일자,출금금액,입금금액,거래후잔액,거래내용,거래기록사항 / 2026.10.02,,1500000,…,김고객 / 2026.10.03,200000,,…,마트'
const EUCKR_CSV_HEX = 'b0c5b7a1c0cfc0da2cc3e2b1ddb1ddbed72cc0d4b1ddb1ddbed72cb0c5b7a1c8c4c0dcbed72cb0c5b7a1b3bbbfeb2cb0c5b7a1b1e2b7cfbbe7c7d70a323032362e31302e30322c2c313530303030302c353030303030302cc0cec5cdb3ddb9f0c5b72cb1e8b0edb0b40a323032362e31302e30332c3230303030302c2c343830303030302cc3bcc5a9c4abb5e52cb8b6c6ae0a';

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  let fetches = 0;
  await page.route('https://**/*', route => { fetches++; route.abort(); });
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await page.evaluate(() => {
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = []; state.schedule = []; state.notes = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, x || {});
    state.projects = [
      P('대전', { customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }),
      P('삼성아파트 101동 1001호', { customer: { name: '박영희', phone: '', addr: '' } }),
      P('둔산', { customer: { name: '이철수', phone: '', addr: '' } }),
      P('보관현장', { archived: true, customer: { name: '최보관', phone: '', addr: '' } })
    ];
    // 둔산: 견적 1,000만(부가세 포함) → 잔금 1,000만. 계약금 비율 50% = 500만
    state.files = [{ id: 'e1', name: '20260901 둔산 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '둔산', est: { amount: 10000000, supply: 9090909, vat: 909091, date: '2026-09-01' }, when: new Date('2026-09-01') }];
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('격자 읽기 — 농협식(입금금액 열)·카카오식(구분+거래금액)·날짜 네 꼴·합계 줄·출금 줄 제외·못 읽는 파일 이유', async () => {
    const r = await page.evaluate(() => {
      const nh = hjBankRowsFromGrid([
        ['농협 거래내역조회'], ['조회기간: 2026.10.01 ~ 2026.10.08'], [],
        ['거래일자', '출금금액', '입금금액', '거래후잔액', '거래내용', '거래기록사항', '거래점'],
        ['2026/10/02 14:22:01', '', '1,500,000', '5,000,000', '인터넷뱅킹', '김고객', '둔산지점'],
        [46027, '', 2000000, 7000000, '타행이체', '박영희', ''],
        ['2026.10.04', '300,000', '', '6,700,000', '체크카드', '마트', ''],
        ['20261005', '', '5000000', '11700000', '인터넷뱅킹', '이철수', ''],
        ['합계', '300,000', '8,500,000', '', '', '', '']
      ]);
      const kakao = hjBankRowsFromGrid([
        ['거래일시', '구분', '거래금액', '거래 후 잔액', '거래구분', '내용', '메모'],
        ['2026.10.06 09:10:00', '입금', '700,000', '1,000,000', '이체', '김고객', ''],
        ['2026.10.06 10:00:00', '출금', '50,000', '950,000', '체크카드', '편의점', ''],
        ['2026.10.07 11:00:00', '입금', '0', '950,000', '이자', '이자', '']
      ]);
      const noDate = hjBankRowsFromGrid([['금액', '내용'], ['1000', '김고객']]);
      const noType = hjBankRowsFromGrid([['거래일자', '거래금액', '내용'], ['2026.10.01', '1000', '김고객']]);
      const csv = hjBankCsvGrid('"거래일자","입금금액","거래기록사항"\r\n"2026.10.02","1,500,000","김고객, 잔금"\r\n2026.10.03,,마트\r\n');
      return { nh, kakao, noDate: noDate.reason, noType: noType.reason, csv };
    });
    assert(r.nh.rows.length === 3 && JSON.stringify(r.nh.rows.map(x => [x.date, x.amt, x.payer])) === JSON.stringify([['2026-10-02', 1500000, '김고객'], ['2026-01-05', 2000000, '박영희'], ['2026-10-05', 5000000, '이철수']]), '농협식: ' + JSON.stringify(r.nh));
    assert(r.kakao.rows.length === 1 && r.kakao.rows[0].amt === 700000 && r.kakao.rows[0].payer === '김고객' && r.kakao.rows[0].date === '2026-10-06', '카카오식(구분 열): ' + JSON.stringify(r.kakao));
    assert(/날짜 열과 입금/.test(r.noDate) && /입금\/출금을 가르는 열/.test(r.noType), '못 읽는 이유: ' + r.noDate + ' / ' + r.noType);
    assert(r.csv.length === 3 && r.csv[1][2] === '김고객, 잔금' && r.csv[2][1] === '', 'csv 따옴표·빈 칸: ' + JSON.stringify(r.csv));
  });

  await test('현장 제안 — 고객명 일치만 고르고, 금액만 맞으면 힌트, 동점이면 비움, 예전 입금자명·현장명 일치, 이미 기록됨', async () => {
    const r = await page.evaluate(() => {
      const projects = state.projects.filter(p => !p.archived);
      const statsOf = n => projStats(n);
      const M = (payer, amt) => hjBankMatch({ date: '2026-10-02', amt, payer }, projects, statsOf, state.payLog);
      const byCust = M('김고객', 123);                 // 고객명 일치
      const byNameOnly = M('이철수', 1000);           // 둔산 고객
      const amtOnly = M('모르는사람', 10000000);      // 둔산 잔금과 같은 금액 — 힌트만
      const ratio = M('모르는사람', 5000000);         // 계약금 비율 — 힌트만
      const none = M('홍길동', 777);
      const byProj = M('삼성아파트', 10);             // 입금자≈현장명
      const archived = M('최보관', 10);               // 보관 현장은 후보 아님
      state.projects.push({ name: '대전2', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김고객', phone: '', addr: '' } });
      const tie = hjBankMatch({ date: '2026-10-02', amt: 5, payer: '김고객' }, state.projects.filter(p => !p.archived), statsOf, state.payLog);
      state.projects.pop();
      state.payLog = [{ d: '2026-09-01', project: '둔산', amt: 100, payer: '둔산엄마' }];
      const prev = M('둔산엄마', 10);
      const dup = hjBankDup({ date: '2026-09-01', amt: 100 }, '둔산'), dupOther = hjBankDup({ date: '2026-09-01', amt: 100 }, '대전'), dupAny = hjBankDup({ date: '2026-09-01', amt: 100 }, '');
      state.payLog = [];
      return { byCust, byNameOnly, amtOnly, ratio, none, byProj, archived, tie, prev, dup, dupOther, dupAny };
    });
    assert(r.byCust.project === '대전' && /입금자=고객명/.test(r.byCust.why), '고객명: ' + JSON.stringify(r.byCust));
    assert(r.byNameOnly.project === '둔산', '둔산 고객: ' + JSON.stringify(r.byNameOnly));
    assert(!r.amtOnly.project && /둔산/.test(r.amtOnly.hint) && /잔금과 같은 금액/.test(r.amtOnly.hint), '금액만: ' + JSON.stringify(r.amtOnly));
    assert(!r.ratio.project && /비율 금액/.test(r.ratio.hint), '비율: ' + JSON.stringify(r.ratio));
    assert(!r.none.project && !r.none.hint, '모르는 입금자: ' + JSON.stringify(r.none));
    assert(r.byProj.project === '삼성아파트 101동 1001호' && /현장명/.test(r.byProj.why), '현장명: ' + JSON.stringify(r.byProj));
    assert(!r.archived.project && !r.archived.hint, '보관 현장은 후보가 아니다: ' + JSON.stringify(r.archived));
    assert(!r.tie.project && /후보/.test(r.tie.hint) && /대전/.test(r.tie.hint), '동점: ' + JSON.stringify(r.tie));
    assert(r.prev.project === '둔산' && /전에 같은 입금자/.test(r.prev.why), '예전 입금자: ' + JSON.stringify(r.prev));
    assert(r.dup === true && r.dupOther === false && r.dupAny === true, '이미 기록됨: ' + JSON.stringify([r.dup, r.dupOther, r.dupAny]));
  });

  await test('화면 — 수금 이력 → 통장에서 가져오기 → EUC-KR csv 고르기 → 제안·체크·현장 바꾸기 → 저장(한 곳) → 중복은 건너뜀 · 390px · 요청 0 · 저장본 키', async () => {
    fetches = 0;   // 부팅 때 막힌 요청(글꼴·GIS 미리읽기)은 세지 않는다 — 가져오기 흐름 동안만
    const r = await page.evaluate(async () => {
      payHistoryView(true); await new Promise(r => setTimeout(r, 80));
      const btn = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /통장에서 가져오기/.test(b.textContent));
      if (!btn) return { noBtn: true };
      btn.click(); await new Promise(r => setTimeout(r, 80));
      return { title: document.querySelector('#modalRoot .modal h3').textContent, input: !!document.getElementById('bkFile') };
    });
    assert(!r.noBtn && /통장 입금 내역/.test(r.title) && r.input, '창: ' + JSON.stringify(r));
    await page.setInputFiles('#bkFile', { name: '거래내역.csv', mimeType: 'text/csv', buffer: Buffer.from(EUCKR_CSV_HEX, 'hex') });
    await page.waitForSelector('#modalRoot .bkRow');
    const s1 = await page.evaluate(() => ({
      sum: document.getElementById('bkSum').textContent, rows: [...document.querySelectorAll('#modalRoot .bkRow')].map(el => ({
        chk: el.querySelector('.bkChk').checked, pj: el.querySelector('.bkPj').value, why: el.querySelector('.bkWhy').textContent,
        h: el.querySelector('label').getBoundingClientRect().height, sh: el.querySelector('.bkPj').getBoundingClientRect().height })),
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    assert(/입금 1건/.test(s1.sum) && /현장 제안 1건/.test(s1.sum), 'EUC-KR csv 를 읽고 출금 줄은 뺐다: ' + s1.sum);
    assert(s1.rows.length === 1 && s1.rows[0].chk && s1.rows[0].pj === '대전' && /입금자=고객명/.test(s1.rows[0].why), '제안 줄: ' + JSON.stringify(s1.rows));
    assert(s1.rows[0].h >= 44 && s1.rows[0].sh >= 44 && s1.wide <= 0, '44px·가로 넘침: ' + JSON.stringify([s1.rows[0].h, s1.rows[0].sh, s1.wide]));
    // 현장을 직접 바꾸면 그 현장으로, 다시 비우면 체크가 풀린다
    const s2 = await page.evaluate(() => {
      const sel = document.querySelector('#modalRoot .bkPj'); sel.value = '둔산'; sel.dispatchEvent(new Event('change'));
      const a = { chk: document.querySelector('#modalRoot .bkChk').checked, why: document.querySelector('#modalRoot .bkWhy').textContent };
      sel.value = ''; sel.dispatchEvent(new Event('change'));
      const b = { chk: document.querySelector('#modalRoot .bkChk').checked };
      sel.value = '대전'; sel.dispatchEvent(new Event('change'));
      return { a, b };
    });
    assert(s2.a.chk && /직접 고름: 둔산/.test(s2.a.why) && !s2.b.chk, '현장 바꾸기: ' + JSON.stringify(s2));
    const before = await page.evaluate(() => ({ recv: state.projects.find(p => p.name === '대전').received, n: (state.payLog || []).length, keys: Object.keys(serializeData()).length, dirty: state.dirty }));
    await page.evaluate(() => { state.dirty = false; document.getElementById('bkSave').click(); });
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => {
      const p = state.projects.find(x => x.name === '대전');
      const rec = JSON.parse(JSON.stringify(serializeData().payLog)).slice(-1)[0];
      return { recv: p.received, n: state.payLog.length, rec, keys: Object.keys(serializeData()).length, dirty: state.dirty, due: projStats('대전').due, title: (document.querySelector('#modalRoot .modal h3') || {}).textContent || '' };
    });
    assert(after.n === before.n + 1 && after.recv === before.recv + 1500000, '저장: ' + JSON.stringify([before, after]));
    assert(after.rec.d === '2026-10-02' && after.rec.project === '대전' && after.rec.amt === 1500000 && after.rec.payer === '김고객' && !after.rec.proof, '저장본 입금 기록: ' + JSON.stringify(after.rec));
    assert(after.keys === 41 && before.keys === 41 && after.dirty === true, '최상위 키 41·dirty: ' + JSON.stringify([before.keys, after.keys, after.dirty]));
    assert(/수금 이력/.test(after.title), '저장 뒤 수금 이력으로 돌아온다: ' + after.title);
    // 같은 파일을 다시 넣으면 '이미 기록됨' 으로 체크가 풀려 두 번 저장되지 않는다
    await page.evaluate(async () => { closeModal(); hjBankImportView(); await new Promise(r => setTimeout(r, 60)); });
    await page.setInputFiles('#bkFile', { name: '거래내역.csv', mimeType: 'text/csv', buffer: Buffer.from(EUCKR_CSV_HEX, 'hex') });
    await page.waitForSelector('#modalRoot .bkRow');
    const s3 = await page.evaluate(() => {
      const row = document.querySelector('#modalRoot .bkRow');
      const r0 = { chk: row.querySelector('.bkChk').checked, why: row.querySelector('.bkWhy').textContent, sum: document.getElementById('bkSum').textContent };
      row.querySelector('.bkChk').checked = true; document.getElementById('bkSave').click();
      return Object.assign(r0, { n: state.payLog.length, toast: (document.getElementById('toast') || {}).textContent || '' });
    });
    assert(!s3.chk && /이미 기록됨/.test(s3.why) && /이미 기록됨 1건/.test(s3.sum) && s3.n === after.n && /이미 기록된/.test(s3.toast), '중복 방지: ' + JSON.stringify(s3));
    await page.evaluate(() => closeModal());
    assert(fetches === 0, '네트워크 요청이 없어야 한다: ' + fetches);
  });

  await test('입금 기록 창(💰)도 같은 한 곳으로 저장하고, 화면을 그리는 읽기 경로는 저장본을 바꾸지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 120));
      hjDailyBrief(); payHistoryView(true); await new Promise(r => setTimeout(r, 60));
      hjBankMatch({ date: '2026-10-02', amt: 1, payer: '김고객' }, state.projects, n => projStats(n), state.payLog);
      const same = snap() === b0; closeModal();
      // 💰 입금 기록 창 → 저장 → received·payLog·증빙까지 예전과 같은 결과
      const p = state.projects.find(x => x.name === '둔산'); const n0 = state.payLog.length, r0 = p.received || 0;
      recvQuickView('둔산'); await new Promise(r => setTimeout(r, 60));
      document.getElementById('rqAmt').value = '2,000,000'; document.getElementById('rqDate').value = '2026-10-01'; document.getElementById('rqProof').value = 'cash';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입금 저장/.test(b.textContent)).click();
      await new Promise(r => setTimeout(r, 250));
      const rec = state.payLog[state.payLog.length - 1]; closeModal();
      return { same, n: state.payLog.length - n0, recv: p.received - r0, rec: { d: rec.d, project: rec.project, amt: rec.amt, proof: rec.proof, hasProofAt: !!rec.proofAt } };
    });
    assert(r.same, '그리기만 했는데 저장본이 바뀌었다');
    assert(r.n === 1 && r.recv === 2000000 && r.rec.d === '2026-10-01' && r.rec.project === '둔산' && r.rec.amt === 2000000 && r.rec.proof === 'cash' && r.rec.hasProofAt, '💰 입금 기록 창: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== bankimport-v350: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

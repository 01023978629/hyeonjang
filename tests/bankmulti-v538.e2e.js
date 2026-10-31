/* v538 🏦 통장 한 줄 = 작업내역서 여러 장 — 10/31 대표 "문제 없어 일단 더 개발 진행".
   협력사는 한 달 치 내역서를 한 번에 보내기도 한다. v533 은 그런 줄을 '합계와 같아요 — 장부에서 장마다' 힌트로만 보여 손으로 나눠 적어야 했다.
   이제 입금자가 거래처(하나)와 맞고 그 거래처 내역서를 오래된 순으로 더해 이 줄 금액과 딱 맞는 첫 묶음(2장 이상)이면 그 묶음을 제안하고,
   저장하면 장마다 다 받음으로(현장마다 남은 돈 비율) 나눠 적는다 — 한 묶음 id 로.
   합성 자료만(실제 거래처·주소 아님), 바깥 요청 0(csv), 바깥 쓰기 0.
   ① 규칙: 오래된 순 묶음(2장·3장) · 한 장이 딱 맞으면 그것 먼저 · 중간을 건너뛴 조합·입금자 다름·거래처 둘은 제안 안 함 (MATCH)
   ② 화면(390px): 묶음 줄 체크·목록에 '내역서 2장 합계' · 같은 내역서를 다른 줄도 고르면 남은 돈 초과로 아무것도 안 적음 → 빼고 저장 → 장마다 다 받음·한 묶음 id (UI)
   ③ 같은 파일 다시: 묶음 줄 '이미 기록됨'(억지 체크도 안 적음) · 묶음 안 한 장과 금액만 같은 다른 줄은 '이미 기록됨'으로 잘못 잡지 않음 (AGAIN)
   ④ 묶음 중 한 장이라도 못 적으면(지워진 현장) 아무 장도 적지 않음 (ATOMIC)
   ⑤ 소스·핀 3곳(v538 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V538_BASELINE=<commit> 은 ① 에서, HJ_V538_MUTATION=no-combo-dup 은 ③, no-precheck 는 ④ 에서 실패해야 한다. */
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
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V538_BASELINE ? execFileSync('git', ['show', process.env.HJ_V538_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-combo-dup': ["  if(cgNamed||cg.length===1)return {src:'',combo:", "  if(false)return {src:'',combo:"],
  'no-precheck': ["        for(const pt of parts){const why=hjStmtPayCheck(pt.src,pt.left,pc.x.date);if(why){", "        for(const pt of parts){const why='';if(why){"]
}[process.env.HJ_V538_MUTATION || ''];
if (process.env.HJ_V538_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V538_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}
const CSV = ['거래일자,출금금액,입금금액,거래후잔액,보낸분,메모',
  '2026.10.31,,"1,640,001",0,(주)시험누수,10월분 2장',
  '2026.10.31,,300000,0,시험방수,',
  '2026.10.30,,60000,0,시험누수,',
  '2026.10.31,,150000,0,시험누수,'].join('\r\n') + '\r\n';

let browser, passed = 0;
const errors = [], confirms = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => {
    if (dialog.type() === 'beforeunload') return dialog.accept();
    if (dialog.type() === 'confirm') { confirms.push(dialog.message()); return dialog.accept(); }
    errors.push('dialog:' + dialog.type()); dialog.dismiss();
  });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS bankmulti-v538 ' + name); }
  const { context, page } = await openPage();
  // 합성: '시험누수' A(10/13 · 가온 220,000 + 나래 270,000 + 다솜 1,000,001) · B(10/20 · 바다 150,000 — B 에만 있는 현장) · C(10/30 · 나래 60,000), '시험방수' D(10/20 · 마루 300,000)
  const SEED = () => page.evaluate(() => {
    const P = (name, cust) => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: cust || '', phone: '', addr: '' }, geo: null });
    state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트'), P('마루아파트'), P('바다아파트')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = [];
    const mk = (src, to, date, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: amts.map((a, i) => ({ d: date, loc: project + ' 작업' + i, work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); };
    mk('A.xlsx', '시험누수', '2026-10-13', '가온아파트', [220000]); mk('A.xlsx', '시험누수', '2026-10-13', '나래아파트', [220000, 50000]); mk('A.xlsx', '시험누수', '2026-10-13', '다솜아파트', [1000001]);
    mk('B.xlsx', '시험누수', '2026-10-20', '바다아파트', [150000]);
    mk('C.xlsx', '시험누수', '2026-10-30', '나래아파트', [60000]);
    mk('D.xlsx', '시험방수', '2026-10-20', '마루아파트', [300000]);
    try { closeModal(); } catch (e) {}
  });
  const rowsOf = () => page.evaluate(() => ({
    sum: document.getElementById('bkSum').textContent,
    rows: [...document.querySelectorAll('#modalRoot .bkRow')].map(el => { const sel = el.querySelector('.bkPj'); return { chk: el.querySelector('.bkChk').checked, v: sel.value, opt: sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '', why: el.querySelector('.bkWhy').textContent, h: Math.round(sel.getBoundingClientRect().height) }; }),
    wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  const csvFile = { name: '거래내역.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') };
  const openImport = async () => { await page.evaluate(async () => { closeModal(); hjBankImportView(); await new Promise(r => setTimeout(r, 60)); }); await page.setInputFiles('#bkFile', csvFile); await page.waitForSelector('#modalRoot .bkRow'); };
  const setChk = (i, v) => page.evaluate(([i, v]) => { document.querySelector('#modalRoot .bkChk[data-i="' + i + '"]').checked = v; }, [i, v]);

  await test('① 규칙 — 오래된 순 묶음 · 한 장이 맞으면 먼저 · 건너뛴 조합·입금자 다름·거래처 둘은 제안 안 함 (MATCH)', async () => {
    await SEED();
    const r = await page.evaluate(() => {
      const led = hjStmtLedger(), I = hjBankStmtDupIndex();
      const M = (amt, payer) => { const m = hjBankStmtMatch({ date: '2026-10-31', amt, payer, memo: '' }, led, I); return { src: m.src, combo: m.combo || null, dup: m.dup, why: m.why }; };
      return { two: M(1640001, '(주)시험누수'), three: M(1700001, '시험누수'), single: M(1490001, '시험누수'), skip: M(210000, '시험누수'), stranger: M(1640001, '홍길동'), twoPartners: M(1640001, '시험'), tooMuch: M(1800000, '시험누수') };
    });
    assert.deepEqual(r.two.combo, ['A.xlsx', 'B.xlsx'], 'two oldest ' + JSON.stringify(r.two));
    assert(r.two.src === '' && !r.two.dup && /입금자=거래처 · 오래된 내역서 2장 남은 돈 합계와 같은 금액 → 장마다 다 받음으로 나눠 적어요/.test(r.two.why), 'why ' + JSON.stringify(r.two));
    assert.deepEqual(r.three.combo, ['A.xlsx', 'B.xlsx', 'C.xlsx'], 'all three ' + JSON.stringify(r.three));
    assert(r.single.src === 'A.xlsx' && r.single.combo === null, 'one statement that fits exactly wins ' + JSON.stringify(r.single));
    assert(r.skip.combo === null && r.stranger.combo === null && r.twoPartners.combo === null && r.tooMuch.combo === null, 'no combo for skipped/unnamed/two partners/over ' + JSON.stringify(r));
  });

  await test('② 화면 390px — 묶음 줄 체크 · 같은 내역서 겹치면 초과로 막음 → 빼고 저장 → 장마다 다 받음 · 한 묶음 id (UI)', async () => {
    await openImport();
    const s1 = await rowsOf(), R = s1.rows;
    assert(/📑 내역서 제안 4건/.test(s1.sum), 'summary ' + s1.sum);
    assert(R[0].chk && R[0].v === 'combo:0' && /📑 시험누수 내역서 2장\(10\/13·10\/20\) 합계 · 1,640,001원/.test(R[0].opt) && /^제안: 📑 시험누수 내역서 2장\(10\/13·10\/20\) — 입금자=거래처/.test(R[0].why), 'combo row ' + JSON.stringify(R[0]));
    assert(R[1].chk && R[1].v === 'stmt:D.xlsx' && R[2].chk && R[2].v === 'stmt:C.xlsx' && R[3].chk && R[3].v === 'stmt:B.xlsx', 'single rows ' + JSON.stringify(R.slice(1)));
    assert(R.every(x => x.h >= 44) && s1.wide <= 0, '44px · no overflow');
    // B 를 묶음과 넷째 줄이 함께 고름 → 남은 돈 초과 — 아무것도 적지 않는다
    confirms.length = 0;
    const over = await page.evaluate(() => { document.getElementById('bkSave').click(); return { n: state.payLog.length, toast: document.getElementById('toast').textContent }; });
    assert(over.n === 0 && confirms.length === 0 && /📑 시험누수 작업내역서 10\/20 남은 돈\(150,000원\)보다 많은 입금을 골랐어요/.test(over.toast), 'overlap blocked ' + JSON.stringify(over));
    await setChk(3, false);
    await page.evaluate(() => { document.getElementById('bkSave').click(); });
    await page.waitForFunction(() => /수금 이력/.test((document.querySelector('#modalRoot .modal h3') || {}).textContent || ''));
    const after = await page.evaluate(() => {
      const L = state.payLog.map(x => [x.stmt, x.project, x.amt, x.d, x.payer || '', x.method || '', x.stmtPay || '']);
      return { L, led: hjStmtLedger().map(s => [s.src, s.left]).sort(), toast: document.getElementById('toast').textContent };
    });
    assert.equal(confirms.length, 1); assert.match(confirms[0], /내역서 여러 장을 한 번에 받은 1건은 장마다 다 받음으로/);
    const combo = after.L.filter(x => x[0] === 'A.xlsx' || x[0] === 'B.xlsx');
    assert.deepEqual(combo.map(x => x.slice(0, 6)), [
      ['A.xlsx', '가온아파트', 220000, '2026-10-31', '(주)시험누수', '계좌이체'], ['A.xlsx', '나래아파트', 270000, '2026-10-31', '(주)시험누수', '계좌이체'], ['A.xlsx', '다솜아파트', 1000001, '2026-10-31', '(주)시험누수', '계좌이체'],
      ['B.xlsx', '바다아파트', 150000, '2026-10-31', '(주)시험누수', '계좌이체']], 'combo split ' + JSON.stringify(combo));
    assert(new Set(combo.map(x => x[6])).size === 1 && /^sp/.test(combo[0][6]), 'one group id across the statements');
    assert(after.L.filter(x => x[0] === 'C.xlsx' || x[0] === 'D.xlsx').every(x => x[6] && x[6] !== combo[0][6]), 'single payments keep their own group');
    assert.deepEqual(after.led, [['A.xlsx', 0], ['B.xlsx', 0], ['C.xlsx', 0], ['D.xlsx', 0]]);
    assert.match(after.toast, /🏦 입금 3건 저장 — 수금 이력에 반영 · 📑 내역서 3건은 현장 6곳에 나눠 기록/);
  });

  await test('③ 같은 파일 다시 — 묶음 줄 이미 기록됨 · 억지 체크도 안 적음 · 묶음 한 장과 금액만 같은 줄은 잘못 잡지 않음 (AGAIN)', async () => {
    await openImport();
    const R = (await rowsOf()).rows;
    assert(!R[0].chk && R[0].v === 'combo:0' && /^이미 기록됨 — 📑 시험누수 내역서 2장\(10\/13·10\/20\)에 같은 날·같은 금액으로 나눠 적은 입금이 있어요/.test(R[0].why), 'combo dup ' + JSON.stringify(R[0]));
    assert(!R[1].chk && /이미 기록됨/.test(R[1].why) && !R[2].chk && /이미 기록됨/.test(R[2].why), 'single dups ' + JSON.stringify(R.slice(1, 3)));
    assert(!R[3].chk && !/이미 기록됨/.test(R[3].why) && R[3].v === '', "B's part of the combo is not mistaken for this separate 150,000 row " + JSON.stringify(R[3]));
    const n0 = await page.evaluate(() => state.payLog.length);
    const forced = await page.evaluate(() => { document.querySelector('#modalRoot .bkChk[data-i="0"]').checked = true; document.getElementById('bkSave').click(); return { n: state.payLog.length, toast: document.getElementById('toast').textContent }; });
    assert(forced.n === n0 && /이미 기록된/.test(forced.toast), 'forced re-save refused ' + JSON.stringify(forced));
    await page.evaluate(() => closeModal());
  });

  await test('④ 묶음 중 한 장이라도 못 적으면(지워진 현장) 아무 장도 적지 않음 (ATOMIC)', async () => {
    await SEED();
    // 묶음의 둘째 장(B)에만 있는 현장을 지운다 — 미리 확인하지 않으면 첫 장(A)만 적히고 멈춘다
    await page.evaluate(() => { state.projects = state.projects.filter(p => p.name !== '바다아파트'); });
    await openImport();
    const R = (await rowsOf()).rows;
    assert(R[0].chk && R[0].v === 'combo:0', 'combo still offered ' + JSON.stringify(R[0]));
    for (const i of [1, 2, 3]) await setChk(i, false);
    confirms.length = 0;
    const r = await page.evaluate(() => { document.getElementById('bkSave').click(); return { n: state.payLog.length, toast: document.getElementById('toast').textContent, A: hjStmtLedger().find(s => s.src === 'A.xlsx').left }; });
    assert(r.n === 0 && r.A === 1490001 && confirms.length === 0 && /지워진 현장이 있어 나눠 적을 수 없어요: 바다아파트/.test(r.toast), 'nothing written when one statement cannot be ' + JSON.stringify(r));
    await page.evaluate(() => closeModal());
  });

  await test('⑤ 소스·핀 3곳(v538 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /function hjBankStmtComboDup\(row,srcs,idx\)\{/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 538, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`bankmulti-v538: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL bankmulti-v538', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

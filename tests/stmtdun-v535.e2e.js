/* v535 📑 내역서 미수 경과일 · 협력사 미수 안내 글 — 10/31 대표 "계속 진행".
   v527 장부는 내역서마다 남은 돈만 보여 얼마나 오래됐는지, 협력사마다 얼마를 요청할지 손으로 세야 했다.
   합성 자료만(실제 거래처·주소·계좌 아님 — 계좌는 검사 안에서 가짜로 바꿔 끼움), 바깥 요청 0, 바깥 쓰기 0.
   ① 묶음·경과일: 남은 돈 있는 내역서만 거래처별(남은 돈 큰 거래처부터·오래된 순) · 다 받은 내역서 빠짐 · 경과일·색(30일 주황·60일 빨강) (GROUPS)
   ② 안내 글: 내역서마다 날짜·현장 수·(일부 받았으면 합계·받은 돈)·남은 돈·경과일 · 합계 · 계좌는 넘긴 것만(없으면 줄 없음 · 둘이면 ①②) · 현장 이름 없음 (TEXT)
   ③ 화면(390px): 장부에 협력사별 미수 줄·경과일 · [📋 미수 안내 글] → 미리보기 + 계좌 단추(앞세운 것 없음)·'계좌 없이 글만' → 고른 계좌만 복사 (UI)
   ④ 소스·핀 3곳(v535 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V535_BASELINE=<commit> 은 ① 에서, HJ_V535_MUTATION=no-age 는 ①, auto-account(계좌를 묻지 않고 첫 계좌로) 는 ③ 에서 실패해야 한다. */
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
let html = process.env.HJ_V535_BASELINE ? execFileSync('git', ['show', process.env.HJ_V535_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-age': ["function hjStmtAgeDays(s,today){return Math.max(0,", "function hjStmtAgeDays(s,today){return 0&&Math.max(0,"],
  'auto-account': ["  const preview=hjStmtDunText(to,[]);\n", "  return hjStmtDunSend(to,A.slice(0,1));\n  const preview=hjStmtDunText(to,[]);\n"]
}[process.env.HJ_V535_MUTATION || ''];
if (process.env.HJ_V535_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V535_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
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
  async function test(name, fn) { await fn(); passed++; console.log('PASS stmtdun-v535 ' + name); }
  const { context, page } = await openPage();
  // 합성: '시험누수' A(45일 전·현장 3곳·1,490,001) · B(10일 전·150,000 중 50,000 받음) · E(5일 전·다 받음), '시험방수' D(70일 전·300,000). 계좌는 가짜 둘.
  const SEED = () => page.evaluate(() => {
    const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
    state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트'), P('마루아파트')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = [];
    const ago = n => localDate(new Date(Date.now() - n * 86400000));
    const mk = (src, to, date, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: amts.map((a, i) => ({ d: date, loc: project + ' 작업' + i, work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); };
    mk('A.xlsx', '시험누수', ago(45), '가온아파트', [220000]); mk('A.xlsx', '시험누수', ago(45), '나래아파트', [220000, 50000]); mk('A.xlsx', '시험누수', ago(45), '다솜아파트', [1000001]);
    mk('B.xlsx', '시험누수', ago(10), '가온아파트', [150000]);
    mk('E.xlsx', '시험누수', ago(5), '나래아파트', [80000]);
    mk('D.xlsx', '시험방수', ago(70), '마루아파트', [300000]);
    hjStmtPayApply('B.xlsx', { amt: 50000, d: localDate(), method: '계좌이체' });
    hjStmtPayApply('E.xlsx', { amt: 80000, d: localDate(), method: '계좌이체' });
    COMPANY.accounts = [{ label: '시험 계좌 가', bank: '시험은행', no: '000-01', holder: '시험가' }, { label: '시험 계좌 나', bank: '시험은행', no: '000-02', holder: '시험나' }];
    try { closeModal(); } catch (e) {}
    return { A: ago(45), B: ago(10), D: ago(70), today: localDate() };
  });
  const md = d => (+d.slice(5, 7)) + '/' + (+d.slice(8, 10));
  let D0;

  await test('① 묶음·경과일 — 남은 돈 있는 것만 거래처별 · 다 받은 것 빠짐 · 30일 주황·60일 빨강 (GROUPS)', async () => {
    D0 = await SEED();
    const r = await page.evaluate(() => ({
      g: hjStmtDunGroups().map(g => [g.to, g.list.map(s => s.src), g.left]),
      ages: hjStmtLedger().filter(s => s.left > 0).map(s => [s.src, hjStmtAgeDays(s)]),
      fixed: [hjStmtAgeDays({ date: '2026-10-01' }, '2026-10-31'), hjStmtAgeDays({ date: '2026-11-05' }, '2026-10-31'), hjStmtAgeDays({ date: '' }, '2026-10-31')],
      chips: ['A.xlsx', 'B.xlsx', 'D.xlsx'].map(src => { const el = document.createElement('div'); el.innerHTML = hjStmtAgeChip(hjStmtLedger().find(s => s.src === src)); const sp = el.querySelector('[data-stmt-age]'); return [sp.textContent, sp.style.color, sp.style.fontWeight]; })
    }));
    assert.deepEqual(r.g, [['시험누수', ['A.xlsx', 'B.xlsx'], 1590001], ['시험방수', ['D.xlsx'], 300000]], 'groups ' + JSON.stringify(r.g));
    assert.deepEqual(r.ages.sort(), [['A.xlsx', 45], ['B.xlsx', 10], ['D.xlsx', 70]], 'ages ' + JSON.stringify(r.ages));
    assert.deepEqual(r.fixed, [30, 0, 0], 'age from a given date · future/blank never negative');
    assert.deepEqual(r.chips, [['45일 지남', 'rgb(180, 83, 9)', '800'], ['10일 지남', 'var(--muted)', '400'], ['70일 지남', 'rgb(185, 28, 28)', '800']], 'chips ' + JSON.stringify(r.chips));
  });

  await test('② 안내 글 — 내역서마다 금액·경과일 · 일부 입금 표시 · 합계 · 계좌는 넘긴 것만 · 현장 이름 없음 (TEXT)', async () => {
    const r = await page.evaluate(() => ({ none: hjStmtDunText('시험누수', []), one: hjStmtDunText('시험누수', [COMPANY.accounts[1]]), two: hjStmtDunText('시험누수', COMPANY.accounts), solo: hjStmtDunText('시험방수', []), nobody: hjStmtDunText('없는거래처', []) }));
    const L = r.none.split('\n');
    assert.equal(L[0], '[만물인테리어] 작업내역서 미수 안내');
    assert.equal(L[1], '시험누수 담당자님, 아래 작업내역서 금액이 아직 입금 전으로 확인되어 안내드립니다.');
    assert.equal(L[3], '1. ' + md(D0.A) + ' 작업내역서 · 현장 3곳 · 남은 돈 1,490,001원 (45일 지남)');
    assert.equal(L[4], '2. ' + md(D0.B) + ' 작업내역서 · 현장 1곳 · 합계 150,000원 중 받은 돈 50,000원 · 남은 돈 100,000원 (10일 지남)');
    assert.equal(L[6], '남은 돈 합계: 1,590,001원 (내역서 2장)');
    assert(!/입금계좌/.test(r.none) && /이미 보내셨다면/.test(r.none) && /^문의: /m.test(r.none), 'no account unless chosen ' + JSON.stringify(L));
    assert(!/가온아파트|나래아파트|다솜아파트|E\.xlsx/.test(r.none), 'no site names, paid-off statement left out');
    assert(/^입금계좌: 시험은행 000-02 \(예금주 시험나\)$/m.test(r.one) && !/000-01/.test(r.one), 'only the chosen account ' + r.one);
    assert(/^입금계좌 ①: 시험은행 000-01/m.test(r.two) && /^입금계좌 ②: 시험은행 000-02/m.test(r.two), 'two accounts numbered');
    assert(/^1\. .* 남은 돈 300,000원 \(70일 지남\)$/m.test(r.solo) && /남은 돈 합계: 300,000원$/m.test(r.solo) && !/내역서 1장/.test(r.solo), 'single statement ' + r.solo);
    assert.equal(r.nobody, '');
  });

  await test('③ 화면 390px — 협력사별 미수 줄·경과일 · [📋 미수 안내 글] → 미리보기·계좌 단추(앞세운 것 없음) → 고른 계좌만 복사 (UI)', async () => {
    await page.evaluate(() => {
      window.__copied = [];
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copied.push(t); } }, configurable: true });
      state.tab = 'quotemaker'; state.editingQuote = null; render();
    });
    await page.waitForSelector('[data-stmt-ledger] [data-stmt-dun]');
    const ui = await page.evaluate(() => ({
      dun: [...document.querySelectorAll('[data-stmt-dun]')].map(el => [el.dataset.stmtDun, el.textContent.replace(/\s+/g, ' ').trim()]),
      ages: [...document.querySelectorAll('[data-stmt-row] [data-stmt-age]')].map(el => +el.dataset.stmtAge),
      btnH: [...document.querySelectorAll('[data-stmtdun]')].map(b => Math.round(b.getBoundingClientRect().height)),
      wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    assert.deepEqual(ui.dun.map(x => x[0]), ['시험누수', '시험방수'], 'partner rows ' + JSON.stringify(ui.dun));
    assert(/시험누수 · 내역서 2장 · 남은 돈 1,590,001원 · 가장 오래된 것 45일 지남/.test(ui.dun[0][1]) && /시험방수 · 내역서 1장 · 남은 돈 300,000원 · 가장 오래된 것 70일 지남/.test(ui.dun[1][1]), 'partner row text ' + JSON.stringify(ui.dun));
    assert.deepEqual(ui.ages.slice().sort((a, b) => a - b), [10, 45, 70], 'age on each open statement row (paid-off has none) ' + JSON.stringify(ui.ages));
    assert(ui.btnH.every(h => h >= 44) && ui.wide <= 0, '44px · no horizontal overflow ' + JSON.stringify([ui.btnH, ui.wide]));
    await page.click('[data-stmtdun="시험방수"]');
    await page.waitForSelector('[data-stmt-dun-preview]');
    const m = await page.evaluate(() => ({ title: document.querySelector('#modalRoot .modal h3').textContent, pre: document.querySelector('[data-stmt-dun-preview]').textContent,
      btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => [b.textContent.trim(), b.className]) }));
    assert.match(m.title, /📋 시험방수 미수 안내 글/);
    assert(/남은 돈 300,000원 \(70일 지남\)/.test(m.pre) && !/입금계좌/.test(m.pre), 'preview without account ' + m.pre);
    assert.deepEqual(m.btns.map(b => b[0]), ['① 시험 계좌 가 적기', '② 시험 계좌 나 적기', '계좌 없이 글만', '닫기'], 'buttons ' + JSON.stringify(m.btns));
    assert(m.btns.every(b => !/\b(clay|blue|moss)\b/.test(b[1])), 'no account is pushed as the default ' + JSON.stringify(m.btns));
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => window.__copied.length === 1);
    const c1 = await page.evaluate(() => ({ t: window.__copied[0], toast: document.getElementById('toast').textContent, modal: !!document.querySelector('[data-stmt-dun-preview]') }));
    assert(/^입금계좌: 시험은행 000-02 \(예금주 시험나\)$/m.test(c1.t) && !/000-01/.test(c1.t) && /미수 안내 글을 복사했어요/.test(c1.toast) && !c1.modal, 'chosen account only ' + JSON.stringify(c1));
    await page.click('[data-stmtdun="시험누수"]');
    await page.waitForSelector('[data-stmt-dun-preview]');
    await page.click('#modalRoot .mfoot button:nth-child(3)');
    await page.waitForFunction(() => window.__copied.length === 2);
    const c2 = await page.evaluate(() => window.__copied[1]);
    assert(!/입금계좌/.test(c2) && /남은 돈 합계: 1,590,001원 \(내역서 2장\)/.test(c2), 'text only ' + c2);
    const after = await page.evaluate(() => ({ pay: (state.payLog || []).length, dirty: state.dirty }));
    assert.equal(after.pay, 2, 'reading/copying never records anything (only the two seeded payments)');
  });

  await test('④ 소스·핀 3곳(v535 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(d\.stmtdun!==undefined\)return hjStmtDunView\(d\.stmtdun\);/);
    assert.match(SRC, /#qmStmt,\[data-stmtpay\],\[data-stmtfile\],\[data-stmtbank\],\[data-stmtdun\]/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 535, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`stmtdun-v535: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL stmtdun-v535', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

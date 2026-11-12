/* v582 📄 내역서 한 장 보기 — 협력사가 '10/13 내역서 얼마 남았어요?' 하면 답할 화면이 없었다(장부 줄은 합계·받음·남음 글자뿐,
   내역서 줄은 반영 미리보기에서만, 입금 묶음 이력·현장별 남은 돈은 어디에도 없었다).
   합성 자료(이름은 지어낸 것), 시계 2026-11-05 고정, 바깥 쓰기 0.
   ① 자료 — 머리 = 장부 값 · 현장별 합계·받은 돈(이 내역서 입금만, hjStmtPayPlan 과 같은 셈 — 같은 현장의 다른 내역서·견적 입금은 안 섞임)·남은 돈 · 줄 순서 · 📷 ·
      줄에서 빠진 현장·현장 미지정의 입금도 따로 → 현장별 받은 돈 합 = 머리 받은 돈 · 머리 남음은 장부 셈 하나(v589 대표 결정 11/12 — 차이·까닭 칸 없음) ·
      입금 이력(stmtPay 묶음 — 같은 날 두 묶음은 두 줄 / 옛 기록은 날짜별 / 통장 한 줄로 여러 장) · 읽기만 (DATA)
   ② 장부 [📄 보기] — 📑 내역서 탭·✍ 견적 작성 탭 둘 다 같은 창 · 줄마다 다른 이름(aria-label) · 머리·경과일·원본 파일(차이 경고 줄 없음 — v589) · 현장 묶음·줄·📷 · 입금 이력 ·
      고객 이름·전화 없음 · 단추 (ENTRY)
   ③ 단추는 기존 함수만 — 🧾 증빙·📋 미수 안내 글·💰 입금 셋 다 ‹ 뒤로 = 이 창, 입금 저장 뒤에도 이 창 · 현장 단추 → 현장 화면 · 다 받은 내역서는 [닫기]만 ·
      견적을 고쳐 줄 금액과 합계가 다르면 알림 · 거래처 없는 내역서의 미수 안내 글 (BUTTONS)
   ④ 폰 390·360 넘침 없음(띄어쓰기 없는 긴 거래처 이름 포함)·44px · 저장본 불변 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V582_BASELINE=<commit> 은 ①, HJ_V582_MUTATION=wrong-paid(현장별 받은 돈을 내역서 무시하고 그 현장 전체 수금으로)·same-day-merge(입금 이력을 날짜로만 묶음)·
   no-unassigned(현장 없이 적힌 입금을 현장별에서 뺌)·no-dun-fallback(거래처 없는 내역서를 미수 안내 글에 못 이음 — ③ 의 화면에서도)·
   site-left-head(머리 남음을 장부 셈 대신 현장별 남은 돈 합으로 — v589 '장부 셈 하나')는 ①,
   no-entry(위임 셀렉터에 [data-stmtdetail] 빠뜨림)는 ②, no-lines-off(고친 견적 알림 없음)·no-back(입금 창에 ‹ 뒤로 없음)는 ③,
   wide-head(머리 거래처 이름 줄바꿈 없음)는 ④ 에서 실패해야 한다. */
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
const MUT = {
  'wrong-paid': ["if(x&&x.stmt===src){const k=x.project||'';paidBy[k]", "if(x){const k=x.project||'';paidBy[k]"],
  'no-entry': ['[data-stmtproof],[data-stmtdetail]', '[data-stmtproof]'],
  'same-day-merge': ["const d=String(x.d||''),k=x.stmtPay?'g:'+x.stmtPay:'d:'+d", "const d=String(x.d||''),k='d:'+d"],
  'no-unassigned': ["if(x&&x.stmt===src){const k=x.project||'';paidBy[k]", "if(x&&x.stmt===src&&x.project){const k=x.project||'';paidBy[k]"],
  'site-left-head': ['date:s.date,age:hjStmtAgeDays(s),total:s.total,paid:s.paid,left:s.left,', 'date:s.date,age:hjStmtAgeDays(s),total:s.total,paid:s.paid,left:list.reduce((a,g)=>a+(g.quotes?g.left:0),0),'],
  'no-dun-fallback': ["dunTo:hjStmtCell(s.to)||'거래처 미기재'", 'dunTo:s.to'],
  'no-lines-off': ['if(Math.abs(exp-t)>1)g.linesOff=true;', ''],
  'no-back': ['fn:()=>hjStmtPayView(src,me)', 'fn:()=>hjStmtPayView(src)'],
  'proof-noback': ["      if(typeof back==='function')back();}   // v582 📄 내역서 보기에서 열었으면 저장 뒤 그 창으로", "      }   // v582"],
  'wide-head': ['line-height:1.7;overflow-wrap:anywhere"><b style="overflow-wrap:anywhere">', 'line-height:1.7"><b>']
};
let html = process.env.HJ_V582_BASELINE ? execFileSync('git', ['show', process.env.HJ_V582_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V582_MUTATION) {
  const m = MUT[process.env.HJ_V582_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V582_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtdetail-v582 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '시험고객' + name.slice(0, 1), phone: '010-0000-12' + String(name.length).padStart(2, '0'), addr: '' }, geo: null });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
  state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = [];
  const mk = (src, date, project, lines, to = '시험누수') => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  // A.xlsx — 현장 셋, 합계 1,650,000 (11 의 배수라 부가세 역산이 딱 맞음)
  mk('A.xlsx', '2026-10-13', '가온아파트', [{ d: '2026-10-06', loc: '가온아파트 101-1001', work: '배관 교체', amt: 330000 }, { d: '2026-10-05', loc: '가온아파트 101-1001', work: '욕실 누수 탐지', amt: 220000 }]);
  mk('A.xlsx', '2026-10-13', '나래아파트', [{ d: '2026-10-08', loc: '나래아파트 2-301', work: '실리콘 보수', amt: 110000 }]);
  mk('A.xlsx', '2026-10-13', '다솜아파트', [{ d: '2026-10-10', loc: '다솜아파트 3-502', work: '베란다 방수', amt: 990000 }]);
  mk('B.xlsx', '2026-10-20', '가온아파트', [{ d: '2026-10-18', loc: '가온아파트 101-1001', work: '타일 보수', amt: 440000 }]);
  mk('C.xlsx', '2026-10-22', '다솜아파트', [{ d: '2026-10-21', loc: '다솜아파트 3-502', work: '코킹', amt: 330000 }]);
  mk('D.xlsx', '2026-10-22', '나래아파트', [{ d: '2026-10-21', loc: '나래아파트 2-301', work: '도어 보수', amt: 220000 }]);
  mk('E.xlsx', '2026-10-24', '나래아파트', [{ d: '2026-10-23', loc: '나래아파트 2-301', work: '현관 보수', amt: 110000 }], '');   // 거래처 없는 내역서
  mk('F.xlsx', '2026-10-26', '가온아파트', [{ d: '2026-10-25', loc: 'LONGLOCATIONNAMEWITHOUTANYSPACESATALL101', work: 'LONGWORKNAMEWITHOUTANYSPACESFORTESTING', amt: 220000 }], 'PARTNERLONGNAMEWITHOUTSPACESINCORPORATED');   // 띄어쓰기 없는 긴 이름
  // A: 같은 날(10/25) 따로 두 번 받음(묶음 id 다름) — 660,000 → 220,000·44,000·396,000, 165,000 → 55,000·11,000·99,000 (남은 돈 비율). 세금계산서 · 입금자 있음
  hjStmtPayApply('A.xlsx', { amt: 660000, d: '2026-10-25', method: '계좌이체', proof: 'tax', payer: '시험누수(주)', grp: 'spsameday1' });
  hjStmtPayApply('A.xlsx', { amt: 165000, d: '2026-10-25', method: '계좌이체', proof: 'tax', payer: '시험누수(주)', grp: 'spsameday2' });
  // 묶음 id 없는 옛 기록(v527 이전처럼) — 같은 날 세 줄은 한 칸으로: 나래 나머지 + 줄에서 빠진 현장(집계 제외·견적 삭제) + 현장 없이 적힌 입금
  state.payLog.push({ d: '2026-10-30', project: '나래아파트', amt: 55000, stmt: 'A.xlsx', memo: '옛 기록' });
  state.payLog.push({ d: '2026-10-30', project: '라온빌라', amt: 22000, stmt: 'A.xlsx', memo: '옛 기록 · 견적을 지운 현장' });
  state.payLog.push({ d: '2026-10-30', project: '', amt: 11000, stmt: 'A.xlsx', memo: '옛 기록 · 현장 없음' });
  // 같은 현장(가온)의 다른 내역서 입금 · 견적 입금 — A 의 현장별 받은 돈에 섞이면 안 된다
  hjStmtPayApply('B.xlsx', { amt: 440000, d: '2026-10-28', method: '계좌이체', proof: 'tax', payer: '시험누수(주)' });
  hjPayRecordAdd(state.projects[0], { d: '2026-10-29', project: '가온아파트', amt: 100000, method: '현금' });
  // v538 통장 한 줄로 C·D 두 장을 함께 받음(같은 묶음 id)
  hjStmtPayApply('C.xlsx', { amt: 330000, d: '2026-10-31', method: '계좌이체', grp: 'spcombo01', payer: '시험누수(주)' });
  hjStmtPayApply('D.xlsx', { amt: 220000, d: '2026-10-31', method: '계좌이체', grp: 'spcombo01', payer: '시험누수(주)' });
  // 사진 — 가온 10/5 두 장(앞뒤 하루 안), 다솜 10/11 한 장, 나래 없음
  const ph = (id, project, iso) => state.files.push({ id, name: id + '.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', size: 1000 + state.files.length, project, when: new Date(iso) });
  ph('P1', '가온아파트', '2026-10-05T03:00:00Z'); ph('P2', '가온아파트', '2026-10-07T03:00:00Z'); ph('P3', '다솜아파트', '2026-10-11T03:00:00Z'); ph('P4', '가온아파트', '2026-09-20T03:00:00Z');
  state.activeProject = null; state.tab = 'estimates'; state.editingQuote = null;
  render();
};
const snapState = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);
    await test('① 자료 — 머리=장부 · 현장별 받은 돈은 이 내역서 입금만 · 머리 남음과 현장별 남은 돈 합의 차이 · 줄·📷 · 입금 이력 · 읽기만 (DATA)', async () => {
      const r = await page.evaluate(() => {
        const snap = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };
        const before = snap();
        const D = hjStmtDetailData('A.xlsx'), L = hjStmtLedger().find(s => s.src === 'A.xlsx');
        const own = {}; state.payLog.forEach(x => { if (x.stmt === 'A.xlsx') own[x.project] = (own[x.project] || 0) + x.amt; });
        const plan = hjStmtPayPlan(L, L.left);   // 남은 돈 전부를 나누면 현장별 남은 돈과 같아야 한다
        const out = {
          head: [D.to, D.doc, D.date, D.file, D.age, D.total, D.paid, D.left, D.dunTo, D.proofN], led: [L.total, L.paid, L.left],
          gapKeys: ['siteLeft', 'orphanPaid', 'overPaid', 'gap'].filter(k => k in D),   // v589 차이 셈은 없어졌다(머리 남음 = 장부 셈 하나)
          sites: D.sites.map(g => [g.project, g.quotes, g.total, g.paid, g.left, g.photos, g.open, g.none, g.linesOff]),
          own, plan: plan && plan.map(r => [r.project, r.left]),
          planCap: (() => { const siteLeft = D.sites.reduce((a, g) => a + (g.quotes ? g.left : 0), 0); return [!!hjStmtPayPlan(L, siteLeft), hjStmtPayPlan(L, siteLeft + 1)]; })(),   // [💰 입금] 이 나눌 수 있는 한도 = 현장별 남은 돈 합
          lines: D.sites[0].lines.map(l => [l.d, l.loc, l.work, l.amt]),
          pays: D.pays.map(p => [p.key, p.d, p.total, p.sites, p.unassigned, !!p.grp, p.payer, p.method, JSON.stringify(p.proofs), p.none, p.others]),
          sumPaid: D.sites.reduce((a, g) => a + g.paid, 0), sumTotal: D.sites.reduce((a, g) => a + g.total, 0),
          sumLeft: D.sites.reduce((a, g) => a + (g.quotes ? g.left : 0), 0),
          B: (() => { const b = hjStmtDetailData('B.xlsx'); return [b.total, b.paid, b.left, b.sites.map(g => [g.project, g.paid]), b.pays.length]; })(),
          C: hjStmtDetailData('C.xlsx').pays.map(p => [p.total, p.others]),
          E: (() => { const e = hjStmtDetailData('E.xlsx'); return [e.to, e.dunTo, e.left]; })(),
          none: hjStmtDetailData('없는.xlsx')
        };
        out.same = before === snap();
        return out;
      });
      assert.deepEqual(r.head, ['시험누수', '작업내역서', '2026-10-13', 'A.xlsx', 23, 1650000, 913000, 737000, '시험누수', 3], '머리 ' + JSON.stringify(r.head));
      assert.deepEqual(r.led, [1650000, 913000, 737000], '장부와 같은 값');
      assert.deepEqual(r.sites, [
        ['가온아파트', 1, 550000, 275000, 275000, 2, true, false, false],
        ['나래아파트', 1, 110000, 110000, 0, 0, true, false, false],
        ['다솜아파트', 1, 990000, 495000, 495000, 1, true, false, false],
        ['라온빌라', 0, 0, 22000, 0, 0, false, false, false],
        ['', 0, 0, 11000, 0, 0, false, true, false]
      ], '현장별 ' + JSON.stringify(r.sites));
      for (const s of r.sites) assert.equal(s[3], r.own[s[0]], (s[0] || '현장 미지정') + ' 받은 돈 = 이 내역서 입금 기록만');
      assert.deepEqual(r.plan, [['가온아파트', 275000], ['다솜아파트', 495000]], 'hjStmtPayPlan 과 같은 남은 돈');
      assert.equal(r.sumPaid, 913000, '현장별 받은 돈 합 = 머리 받은 돈(현장 미지정 포함)'); assert.equal(r.sumTotal, 1650000);
      // 머리 남음은 장부 셈 하나(합계 − 이 내역서로 받은 돈 전부 = 737,000) — 현장별 남은 돈 합(770,000, 줄에서 빠진 현장·현장 미지정으로 받은 33,000 만큼 큼)과
      // 갈려도 차이 셈·경고는 없다(v589 대표 결정 11/12 "돈은 메모용"). 현장별 줄의 남은 돈은 그대로 보인다.
      assert.deepEqual(r.gapKeys, [], '차이 셈 없음 ' + JSON.stringify(r.gapKeys));
      assert.equal(r.sumLeft, 770000, '현장별 남은 돈 합(현장 줄 그대로)'); assert.equal(r.head[7], 737000, '머리 남음 = 장부 셈');
      assert.deepEqual(r.planCap, [true, null], '입금 창이 나눌 수 있는 한도 = 현장별 남은 돈 합');
      assert.deepEqual(r.lines, [['2026-10-05', '가온아파트 101-1001', '욕실 누수 탐지', 220000], ['2026-10-06', '가온아파트 101-1001', '배관 교체', 330000]], '줄 날짜순');
      assert.deepEqual(r.pays, [
        ['d:2026-10-30', '2026-10-30', 88000, 2, 1, false, '', '', '{}', 3, 0],
        ['g:spsameday1', '2026-10-25', 660000, 3, 0, true, '시험누수(주)', '계좌이체', '{"tax":3}', 0, 0],
        ['g:spsameday2', '2026-10-25', 165000, 3, 0, true, '시험누수(주)', '계좌이체', '{"tax":3}', 0, 0]
      ], '입금 이력 — 같은 날 따로 받은 두 묶음은 두 줄 ' + JSON.stringify(r.pays));
      assert.deepEqual(r.B, [440000, 440000, 0, [['가온아파트', 440000]], 1], '다 받은 내역서 ' + JSON.stringify(r.B));
      assert.deepEqual(r.C, [[330000, 1]], '통장 한 줄로 두 장');
      assert.deepEqual(r.E, ['', '거래처 미기재', 110000], '거래처 없는 내역서');
      assert.equal(r.none, null, '없는 내역서');
      assert.ok(r.same, '읽기만 — 저장본 불변');
    });
    await test('② 장부 [📄 보기] — 내역서 탭·견적 작성 탭 같은 창 · 줄마다 다른 이름 · 머리(차이 경고 없음)·현장·줄·이력 · 고객 정보 없음 (ENTRY)', async () => {
      await page.waitForSelector('#view [data-stmt-view] [data-stmtdetail="A.xlsx"]');
      const btn = await page.evaluate(() => [...document.querySelectorAll('#view [data-stmtdetail]')].map(b => [b.dataset.stmtdetail, b.textContent.trim(), b.getAttribute('aria-label')]));
      assert.deepEqual(btn.map(b => b[0]).sort(), ['A.xlsx', 'B.xlsx', 'C.xlsx', 'D.xlsx', 'E.xlsx', 'F.xlsx'], '장부 줄마다 보기');
      assert.ok(btn.every(b => b[1] === '📄 보기'));
      const label = Object.fromEntries(btn.map(b => [b[0], b[2]]));
      assert.equal(label['A.xlsx'], '시험누수 작업내역서 10/13 보기'); assert.equal(label['E.xlsx'], '작업내역서 10/24 보기');
      assert.equal(new Set(btn.map(b => b[2])).size, btn.length, '단추 이름이 줄마다 다름(화면읽기)');
      const rowLabels = await page.evaluate(() => [...document.querySelectorAll('#view [data-stmt-row] [data-stmtpay],#view [data-stmt-row] [data-stmtproof]')].map(b => [b.textContent.trim(), b.getAttribute('aria-label')]));
      assert.ok(rowLabels.length >= 2 && rowLabels.every(([t, a]) => a && a.endsWith(t.replace(/^\S+\s/, ''))), '입금·증빙 단추 이름 = 내역서 + 보이는 글자 ' + JSON.stringify(rowLabels));
      await page.click('#view [data-stmtdetail="A.xlsx"]');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]', { timeout: 4000 });
      const r = await page.evaluate(() => {
        const m = document.querySelector('#modalRoot'), t = el => (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
        return {
          title: t(m.querySelector('#modalTitle')), head: t(m.querySelector('[data-sd-head]')), age: (m.querySelector('[data-sd-head] [data-stmt-age]') || {}).dataset,
          gap: m.querySelectorAll('[data-sd-gap]').length,
          sites: [...m.querySelectorAll('[data-sd-site]')].map(s => [s.dataset.sdSite, t(s.querySelector('[data-sd-site-sum]')), (s.querySelector('[data-stmt-photo]') || {}).dataset ? s.querySelector('[data-stmt-photo]').dataset.stmtPhoto : null, s.querySelectorAll('[data-sd-line]').length, !!s.querySelector('button[data-open]')]),
          line0: t(m.querySelector('[data-sd-site="가온아파트"] [data-sd-line]')),
          none: t(m.querySelector('[data-sd-site=""]')), raon: t(m.querySelector('[data-sd-site="라온빌라"]')),
          pays: [...m.querySelectorAll('[data-sd-pay]')].map(p => [p.dataset.sdPay, t(p)]), all: t(m), off: m.querySelectorAll('[data-sd-lines-off]').length,
          btns: [...m.querySelectorAll('.mfoot button')].map(b => b.textContent.trim())
        };
      });
      assert.equal(r.title, '📄 시험누수 작업내역서 10/13');
      assert.match(r.head, /시험누수 · 작업내역서 · 작성일 2026-10-13 · 23일 지남/);
      assert.match(r.head, /합계 1,650,000원 · 받음 913,000원 · 남음 737,000원/);
      assert.match(r.head, /원본 파일: A\.xlsx/);
      assert.equal(r.age && r.age.stmtAge, '23');
      assert.equal(r.gap, 0, '머리에 차이 경고 줄 없음(v589 — 장부 셈 하나)');
      assert.ok(!/현장별 남은 돈을 더하면/.test(r.head), '머리에 차이 글 없음 ' + r.head);
      assert.deepEqual(r.sites, [
        ['가온아파트', '합계 550,000원 · 받은 돈 275,000원 · 남은 돈 275,000원', '2', 2, true],
        ['나래아파트', '합계 110,000원 · 받은 돈 110,000원 · ✓ 다 받음', '0', 1, true],
        ['다솜아파트', '합계 990,000원 · 받은 돈 495,000원 · 남은 돈 495,000원', '1', 1, true],
        ['라온빌라', '받은 돈 22,000원', null, 0, false],
        ['', '받은 돈 11,000원', null, 0, false]
      ], '현장 묶음 ' + JSON.stringify(r.sites));
      assert.equal(r.line0, '10/5 가온아파트 101-1001 · 욕실 누수 탐지 220,000원');
      assert.match(r.none, /^현장 미지정 받은 돈 11,000원 현장 없이 적힌 이 내역서 입금이에요/, r.none);
      assert.match(r.raon, /현장 목록에 없음/); assert.match(r.raon, /이 내역서 줄에서 빠진 현장이에요\(집계 제외·견적 삭제 등\)/);
      assert.ok(!/이름 바뀜/.test(r.all), '이름을 바꾸면 입금 기록도 옮겨지므로 까닭에 이름 바뀜을 쓰지 않는다');
      assert.equal(r.off, 0, '고친 견적 없음');
      assert.deepEqual(r.pays.map(p => p[0]), ['d:2026-10-30', 'g:spsameday1', 'g:spsameday2'], '같은 날 두 묶음은 두 줄');
      assert.match(r.pays[0][1], /^10\/30\(금\) \(그날 입금 합계\) 88,000원 현장 2곳에 나눠 적음 \(현장 미지정 1건 포함\) · 🧾 증빙 아직$/, r.pays[0][1]);
      assert.match(r.pays[1][1], /^10\/25\(일\) 660,000원 현장 3곳에 나눠 적음 · 입금자 시험누수\(주\) · 계좌이체 · 🧾 세금계산서$/, r.pays[1][1]);
      assert.match(r.pays[2][1], /^10\/25\(일\) 165,000원 현장 3곳에 나눠 적음 · 입금자 시험누수\(주\) · 계좌이체 · 🧾 세금계산서$/, r.pays[2][1]);
      assert.ok(!/시험고객|010-0000/.test(r.all), '고객 이름·전화 없음');
      assert.deepEqual(r.btns, ['닫기', '📋 미수 안내 글', '🧾 증빙 3건', '💰 입금']);
      await page.evaluate(() => closeModal(true));
      // ✍ 견적 작성 탭의 장부도 같은 단추 → 같은 창
      await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
      await page.waitForSelector('#view [data-stmt-ledger] [data-stmtdetail="B.xlsx"]');
      assert.equal(await page.locator('#view [data-stmt-view]').count(), 0, '견적 작성 탭');
      await page.click('#view [data-stmtdetail="B.xlsx"]');
      await page.waitForSelector('#modalRoot [data-stmt-detail="B.xlsx"]', { timeout: 4000 });
      const b = await page.evaluate(() => ({ sum: document.querySelector('#modalRoot [data-sd-sum]').textContent.replace(/\s+/g, ' ').trim(), age: !!document.querySelector('#modalRoot [data-sd-head] [data-stmt-age]'), gap: !!document.querySelector('#modalRoot [data-sd-gap]'), btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.textContent.trim()) }));
      assert.deepEqual(b, { sum: '합계 440,000원 · 받음 440,000원 · ✓ 다 받음', age: false, gap: false, btns: ['닫기'] }, '다 받은 내역서 ' + JSON.stringify(b));
      await page.evaluate(() => closeModal(true));
    });
    await test('③ 단추 — 증빙·미수 안내 글·입금 셋 다 ‹ 뒤로 = 이 창 · 입금 저장 뒤 이 창 · 현장 단추 · 고친 견적 · 거래처 없는 내역서 (BUTTONS)', async () => {
      const foot = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()));
      await page.evaluate(() => { state.tab = 'estimates'; render(); hjStmtDetailView('A.xlsx'); });
      await page.click('#modalRoot .mfoot button:has-text("🧾 증빙 3건")');
      await page.waitForSelector('#modalRoot [data-stmtproof-n]');
      assert.equal(await page.locator('#modalRoot [data-stmtproof-row]').count(), 3, '증빙 대상 3건(현장 미지정 포함)');
      await page.click('#modalRoot .mfoot button:has-text("‹ 뒤로")');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]');
      await page.click('#modalRoot .mfoot button:has-text("📋 미수 안내 글")');
      await page.waitForSelector('#modalRoot [data-stmt-dun-preview]');
      const dun = await page.evaluate(() => ({ title: document.querySelector('#modalTitle').textContent, pre: document.querySelector('#modalRoot [data-stmt-dun-preview]').textContent }));
      assert.match(dun.title, /시험누수 미수 안내 글/); assert.match(dun.pre, /남은 돈 737,000원/);
      assert.equal((await foot())[0], '‹ 뒤로', '미수 안내 글 창에도 ‹ 뒤로');
      await page.click('#modalRoot .mfoot button:has-text("‹ 뒤로")');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]');
      await page.click('#modalRoot [data-sd-site="다솜아파트"] button[data-open]');
      await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
      const r = await page.evaluate(() => ({ p: state.activeProject, tab: state.tab, logs: state.payLog.length }));
      assert.deepEqual(r, { p: '다솜아파트', tab: 'project', logs: 13 }, '현장 화면으로 · 입금 기록 그대로 ' + JSON.stringify(r));
      // 💰 입금 — ‹ 뒤로 = 이 창, 저장 뒤에도 이 창(바뀐 받은 돈을 바로 본다)
      await page.evaluate(() => { state.tab = 'estimates'; state.activeProject = null; render(); hjStmtDetailView('A.xlsx'); });
      await page.click('#modalRoot .mfoot button:has-text("💰 입금")');
      await page.waitForSelector('#modalRoot #spAmt');
      assert.equal(await page.inputValue('#modalRoot #spAmt'), '737000', '입금 창 기본값 = 머리 남은 돈');
      assert.equal((await foot())[0], '‹ 뒤로', '입금 창에도 ‹ 뒤로');
      await page.click('#modalRoot .mfoot button:has-text("‹ 뒤로")');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]');
      assert.equal(await page.evaluate(() => state.payLog.length), 13, '뒤로는 아무것도 안 적음');
      await page.click('#modalRoot .mfoot button:has-text("💰 입금")');
      await page.waitForSelector('#modalRoot #spAmt');
      await page.click('#modalRoot .mfoot button.clay');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]', { timeout: 4000 });
      const after = await page.evaluate(() => ({ logs: state.payLog.length, sum: document.querySelector('#modalRoot [data-sd-sum]').textContent.replace(/\s+/g, ' ').trim(),
        gap: document.querySelectorAll('#modalRoot [data-sd-gap]').length,
        siteLeft: [...document.querySelectorAll('#modalRoot [data-sd-site-sum]')].map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(t => /남은 돈/.test(t)),
        btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()) }));
      // 머리 남음 737,000 을 현장별 남은 돈 770,000 비율로 나누면 머리는 '다 받음'(장부 셈)이고 현장 줄에는 남은 돈이 그대로 보인다 — 차이 경고 줄은 없다(v589)
      assert.equal(after.logs, 15, '입금 저장 2건');
      assert.equal(after.sum, '합계 1,650,000원 · 받음 1,650,000원 · ✓ 다 받음');
      assert.equal(after.gap, 0, '차이 경고 줄 없음 — 머리 남음은 장부 셈 하나');
      assert.equal(after.siteLeft.length, 2, '현장 줄의 남은 돈은 그대로 보임 ' + JSON.stringify(after.siteLeft));
      const siteLeftSum = after.siteLeft.reduce((a, t) => a + Number((t.match(/남은 돈 ([\d,]+)원/) || [0, '0'])[1].replace(/,/g, '')), 0);
      assert.equal(siteLeftSum, 33000, '현장 줄 남은 돈 합 = 33,000 ' + JSON.stringify(after.siteLeft));
      assert.deepEqual(after.btns, ['닫기', '🧾 증빙 5건'], '다 받으면 입금·미수 단추 없음 ' + JSON.stringify(after.btns));
      // 🧾 증빙도 저장 뒤 이 창으로(통합 검토 v587 — 예전엔 창이 닫혀 장부로 떨어졌다)
      await page.click('#modalRoot .mfoot button:has-text("🧾 증빙 5건")');
      await page.waitForSelector('#modalRoot [data-stmtproof-n]');
      await page.click('#modalRoot .mfoot button.clay');
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]', { timeout: 6000 });
      const pf = await page.evaluate(() => ({ btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()), left: hjStmtProofTargets('A.xlsx').length }));
      assert.deepEqual(pf, { btns: ['닫기'], left: 0 }, '증빙 저장 뒤 내역서 보기로 · 증빙 단추 사라짐 ' + JSON.stringify(pf));
      // 뒤로 = 받은 함수
      const back = await page.evaluate(() => { let hit = 0; hjStmtDetailView('B.xlsx', () => { hit++; closeModal(true); }); const b = [...document.querySelectorAll('#modalRoot .mfoot button')]; const label = b[0].textContent; b[0].click(); return { label, hit }; });
      assert.deepEqual(back, { label: '← 뒤로', hit: 1 });
      // 반영한 뒤 견적을 고침(품목 단가 절반) — 줄은 내역서 원본, 합계는 지금 견적이라 갈린다 → 그 현장 칸에 알림
      const off = await page.evaluate(() => {
        const q = state.quotes.find(x => x.stmt && x.stmt.src === 'B.xlsx'); q.items.forEach(it => { it.price = Math.round(it.price / 2); });
        const D = hjStmtDetailData('B.xlsx'), g = D.sites[0];
        hjStmtDetailView('B.xlsx');
        const m = document.querySelector('#modalRoot');
        return { d: [g.total, g.lineTotal, g.linesOff, g.paid, g.left, D.left], note: (m.querySelector('[data-sd-site="가온아파트"] [data-sd-lines-off]') || {}).textContent || '',
          line: m.querySelector('[data-sd-site="가온아파트"] [data-sd-line]').innerText.replace(/\s+/g, ' ').trim(), gapNote: !!m.querySelector('[data-sd-gap]') };
      });
      assert.deepEqual(off.d, [220000, 440000, true, 440000, 0, 0], '고친 견적 ' + JSON.stringify(off.d));
      assert.equal(off.note, '✏ 반영한 뒤 견적을 고쳐서, 아래 줄 금액으로 셈한 합계(440,000원)와 위 합계가 달라요 — 위 합계·남은 돈은 지금 견적 기준이에요');
      assert.equal(off.line, '10/18 가온아파트 101-1001 · 타일 보수 440,000원', '줄은 내역서 원본 금액');
      assert.equal(off.gapNote, false, '차이 경고 줄 없음');
      await page.evaluate(() => closeModal(true));
      // 거래처가 빈 내역서 — 📋 미수 안내 글이 '거래처 미기재' 묶음으로 열린다(죽은 단추가 아님)
      await page.evaluate(() => hjStmtDetailView('E.xlsx'));
      assert.equal(await page.evaluate(() => document.querySelector('#modalTitle').textContent), '📄 작업내역서 10/24');
      await page.click('#modalRoot .mfoot button:has-text("📋 미수 안내 글")');
      await page.waitForSelector('#modalRoot [data-stmt-dun-preview]', { timeout: 4000 });
      const e = await page.evaluate(() => ({ title: document.querySelector('#modalTitle').textContent, pre: document.querySelector('#modalRoot [data-stmt-dun-preview]').textContent }));
      assert.equal(e.title, '📋 거래처 미기재 미수 안내 글'); assert.match(e.pre, /남은 돈 110,000원/);
      await page.evaluate(() => closeModal(true));
    });
    await test('④ 폰 390·360 넘침 없음(긴 거래처 이름 포함)·44px · 저장본 불변 · 핀 3곳 · 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(SEED);
      for (const w of [390, 360]) {
        await page.setViewportSize({ width: w, height: 800 });
        const before = await page.evaluate(snapState);
        await page.evaluate(() => { state.tab = 'estimates'; render(); });
        for (const src of ['A.xlsx', 'F.xlsx']) {
          await page.click(`#view [data-stmtdetail="${src}"]`);
          await page.waitForSelector(`#modalRoot [data-stmt-detail="${src}"]`);
          const ui = await page.evaluate(() => {
            const m = document.querySelector('#modalRoot .modal'), mr = m.getBoundingClientRect();
            // 상자 밖으로 나간 요소 + 상자 안에서 글자가 넘친 요소(띄어쓰기 없는 긴 이름은 상자는 그대로이고 글자만 삐져나간다)
            const wide = [...m.querySelectorAll('*')].filter(el => el.offsetParent && (el.getBoundingClientRect().right > mr.right + 1 || (getComputedStyle(el).overflowX === 'visible' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0))).map(el => el.tagName + (el.id ? '#' + el.id : '') + ':' + el.textContent.trim().slice(0, 20));
            return { over: document.documentElement.scrollWidth - innerWidth, modalOver: m.scrollWidth - m.clientWidth, right: Math.round(mr.right), vw: innerWidth, wide,
              small: [...document.querySelectorAll('#modalRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim()),
              rowSmall: [...document.querySelectorAll('#view [data-stmtdetail]')].filter(b => b.getBoundingClientRect().height < 43.5).length };
          });
          assert.ok(ui.over <= 1 && ui.modalOver <= 1 && ui.right <= ui.vw && !ui.wide.length, w + ' ' + src + ' 넘침 없음 ' + JSON.stringify(ui));
          assert.deepEqual(ui.small, [], w + ' ' + src + ' 44px'); assert.equal(ui.rowSmall, 0, w + ' 장부 단추 44px');
          await page.evaluate(() => closeModal(true));
        }
        const led = await page.evaluate(() => { const sec = document.querySelector('#view [data-stmt-ledger]'), r = sec.getBoundingClientRect(); return [...sec.querySelectorAll('*')].filter(el => el.offsetParent && el.getBoundingClientRect().right > r.right + 1).map(el => el.tagName + ':' + el.textContent.trim().slice(0, 20)); });
        assert.deepEqual(led, [], w + ' 장부 줄도 긴 거래처 이름에서 넘치지 않음');
        assert.equal(await page.evaluate(snapState), before, w + ' 저장본 불변');
      }
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtdetail-v582: ${passed}/4 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtdetail-v582 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

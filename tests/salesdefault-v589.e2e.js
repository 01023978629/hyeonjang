/* v589 매출 기준 기본값 = 작업내역서 · 내역서 한 장 보기의 남은 돈은 장부 셈 하나 — 대표 결정(2026-11-12): "돈은 메모용이니 매출을 내역서 정리만 하면 돼".
   goals.salesBasis 가 'stmt' 면 내역서, 'all' 이면(사람이 끈 것) 예전처럼 견적 포함, 비어 있으면 내역서 견적(q.stmt.key)·작업내역서 가상 파일(_stmt)이
   하나라도 있으면 내역서, 없으면 예전 그대로. 끄면 'all' 이 적힌다(키를 지우면 다음에 열 때 저절로 다시 켜진다).
   합성 자료(이름은 지어낸 것), 시계 2026-11-05 고정, 바깥 쓰기 0.
   시드: 가온(견적서 3,300,000) · 나래(견적서 5,500,000) · 현장 없는 '수주' 앱 견적 770,000 → 내역서가 없으면 매출 9,570,000.
         ② 부터 가온 작업내역서 220,000(10/20) — 그 내역서 입금은 가온 100,000 + 현장 미지정 11,000.
   ① 내역서 없음 + 설정 없음 = 예전(all) — 매출 한 벌·대시보드 글자·탭 그대로, 정한 값은 '' (NONE)
   ② 내역서 있음 + 설정 없음 = 내역서 기준 — 매출 한 벌·월말 결산·부가세 준비·월별 묶음·대시보드 매출(내역서) 칸·마진(v562)·브리핑 월 매출이 같은 값 ·
      내역서 탭에 안내 줄 없음 · 📊 매출 목표 체크는 실제 기준(켜짐 + '저절로') (AUTO)
   ③ 끄면 'all' 이 적히고 serializeData→applyData 뒤에도 꺼진 채 · 그때만 내역서 탭 안내 줄 · 목표 화면 체크 꺼짐 · 옛 판 기기도 'all' 을 예전처럼 읽음 (OFF)
   ④ 켜면 'stmt' — 내역서 탭 안내 단추로 켜도 같음 (ON)
   ⑤ 낡은 기억 없음 — 같은 작업 안에서 hjStmtApply 직후·applyData 직후·내역서 지운 직후 바로 맞고, 다음 작업에서는 제자리 수정도 봄 · 가상 파일(_stmt)만 있어도 내역서 (FRESH)
   ⑥ 화면을 그려도(대시보드·내역서 탭·목표·월말 결산·내역서 보기) 저장본 불변 (READONLY)
   ⑦ 📄 내역서 한 장 보기 — 머리 남음 = 장부 셈 하나, 차이 경고 줄([data-sd-gap]) 없음 · 현장별 받은 돈·남은 돈·'현장 미지정' 칸은 그대로 (DETAIL)
   ⑧ 기준을 따르는 글 — 고객·보험용 증빙 묶음에 내부 '매출(내역서)' 줄 없음(세무사용에만) · 견적을 '매출에 들어간다'고 하던 안내(오늘 챙길 일·
      견적 저장 알림·안 여러 개·예전 견적 화면 칸·최종본 안내·내역서 반영 창의 집계 제외 상자)가 내역서 기준이면 '견적 합계'로, 끄면 예전 글 (LABELS)
   ⑨ 폰 390 — 가로 넘침 없음·단추·체크 칸 44px · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   검토 반영(같은 판): ③ 목표 창 체크를 끄면 '저절로 켜져 있어요' 글이 바로 사라지고, ④ 사람이 켠('stmt') 목표 창에는 그 글이 없다 ·
   ⑤ 같은 작업 안에서 견적·파일 배열이 같은 길이의 다른 배열로 통째로 바뀌어도(복원·불러오기) 바로 맞다.
   HJ_V589_BASELINE=<commit> 은 ① 에서, HJ_V589_MUTATION=no-auto(설정 없으면 늘 견적 포함)·hint-always(안내 줄을 늘 보임)·toggle-pref(목표 체크가 정한 값만 봄)는 ②,
   off-deletes(끄면 키를 지움)는 ③, stale-memo(배열·길이 대조 없이 기억)·memo-forever(작업이 끝나도 기억을 안 비움)·no-file-scan(가상 파일 _stmt 를 안 봄)은 ⑤,
   gap-back(차이 경고 줄을 되살림)은 ⑦ 에서 실패해야 한다.
   검토 반영 변이: note-stale(체크를 바꿔도 '저절로' 글을 안 고침)은 ③, note-pref(사람이 켠 'stmt' 에도 '저절로')는 ④, memo-len-only(배열이 같은 것인지 안 보고
   길이만 대조)는 ⑤, evid-head·evid-ledger(고객·보험용 묶음에도 '매출(내역서)')·label-unread·label-review·label-toast·label-overview·label-final·label-tier·label-confirm(기준을 안 보는 옛 글)는 ⑧ 에서 실패해야 한다. */
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
  'no-auto': ["return hjStmtDataExists()?'stmt':'all';}", "return 'all';}"],
  'hint-always': ["if(hjSalesBasisPref()==='all')h+='<div data-stmt-basis-hint", "if(true)h+='<div data-stmt-basis-hint"],
  'toggle-pref': ["id=\"goalSalesStmt\"'+(hjSalesBasis()==='stmt'?' checked':'')", "id=\"goalSalesStmt\"'+(hjSalesBasisPref()==='stmt'?' checked':'')"],
  'off-deletes': ["state.goals.salesBasis=on?'stmt':'all';", "if(on)state.goals.salesBasis='stmt';else delete state.goals.salesBasis;"],
  'stale-memo': ['if(m&&m.qs===qs&&m.ql===ql&&m.fs===fs&&m.fl===fl)return m.v;', 'if(m)return m.v;'],
  'memo-forever': ["if(!__hjStmtDataMemoQ){__hjStmtDataMemoQ=true;", "if(false){__hjStmtDataMemoQ=true;"],
  'no-file-scan': ['if(!v&&fl>0)for(let i=0;i<fl;i++){const f=fs[i];if(f&&f._stmt){v=true;break;}}', ''],
  'gap-back': ["'</div>'+\n    '<div style=\"font-size:11.5px;color:var(--muted);word-break:break-all\">원본 파일: '",
    "'</div>'+(D.left!==D.sites.reduce((a,g)=>a+(g.quotes?g.left:0),0)?'<div data-sd-gap>⚠ 현장별 남은 돈과 달라요</div>':'')+\n    '<div style=\"font-size:11.5px;color:var(--muted);word-break:break-all\">원본 파일: '"],
  'note-stale': ["const nt=document.querySelector('#modalRoot [data-sales-basis-note]');if(nt)nt.innerHTML=hjSalesBasisAutoHtml();", ''],
  'note-pref': ["function hjSalesBasisAutoHtml(){return !hjSalesBasisPref()&&hjSalesBasis()==='stmt'?", "function hjSalesBasisAutoHtml(){return hjSalesBasis()==='stmt'?"],
  'memo-len-only': ['if(m&&m.qs===qs&&m.ql===ql&&m.fs===fs&&m.fl===fl)return m.v;', 'if(m&&m.ql===ql&&m.fl===fl)return m.v;'],
  'evid-head': ["(o.internal&&hjSalesBasis()==='stmt'?' · 매출(내역서): '", "(hjSalesBasis()==='stmt'?' · 매출(내역서): '"],
  'evid-ledger': ["if(hjSalesBasis()==='stmt'&&(!o||o.internal))rows.push(['매출(내역서)'", "if(hjSalesBasis()==='stmt')rows.push(['매출(내역서)'"],
  'label-unread': ["'건 — 읽어야 '+hjEstSumWord()+'에 들어갑니다'", "'건 — 읽어야 매출에 들어갑니다'"],
  'label-review': ["${hjSalesBasisPref()==='all'?'이 현장들에 이미 매출로 잡힌 견적", "${true?'이 현장들에 이미 매출로 잡힌 견적"],
  'label-toast': ["${hjSalesQuoteOk(q)?'매출 반영':'견적 합계 반영'}", "매출 반영"],
  'label-final': ["이 ${hjEstSumWord()}에 같이 잡히고 있어요.", "이 매출에 같이 잡히고 있어요."],
  'label-tier': ["'개가 '+(live.every(hjSalesQuoteOk)?'매출':'견적 합계')+'에 모두 더해집니다", "'개가 매출에 모두 더해집니다"],
  'label-confirm': ["+'안은 '+(list.every(hjSalesQuoteOk)?'매출':'견적')+' 합계에서 뺐어요", "+'안은 매출 합계에서 뺐어요"],
  'label-overview': ["${hjSalesBasis()==='stmt'?'견적 합계 · 매출은 작업내역서만':'견적 합계 · 매출 집계 기준'}", "견적 합계 · 매출 집계 기준"]
};
let html = process.env.HJ_V589_BASELINE ? execFileSync('git', ['show', process.env.HJ_V589_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V589_MUTATION) {
  const m = MUT[process.env.HJ_V589_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V589_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V589_MUTATION); html = SRC.replace(m[0], m[1]);
}
// v561~v588 판(옛 판 기기)의 매출 기준 함수 — 그 판이 'all' 을 읽어도 예전처럼 견적 포함인지 본다
const OLD_BASIS = "function hjSalesBasis(){const g=state.goals;return g&&typeof g==='object'&&g.salesBasis==='stmt'?'stmt':'all';}";

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS salesdefault-v589 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const t0 = toast; toast = (msg, ...rest) => { window.__toasts.push(String(msg)); try { return t0(msg, ...rest); } catch (_) { return undefined; } };
  }, BOOT);
  return { context, page };
}
const SEED = withStmt => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온'), P('나래')];
  state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null;
  state.goals = { month: 10000000, year: 120000000 };   // 매출 기준은 정하지 않음
  const est = (id, name, project, amount, date) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, prefix: '_정리완료/' + project + '/견적서/', size: 900 + amount % 991,
    est: { customer: name.replace(/\.xlsx$/, ''), amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date }, when: new Date(date + 'T09:00:00+09:00') });
  state.files = [est('E_A', '가온_견적서.xlsx', '가온', 3300000, '2026-10-05'), est('E_B', '나래_견적서.xlsx', '나래', 5500000, '2026-10-08')];
  state.quotes.push({ id: 'WQ', title: '수주 견적', no: '제20261012', date: '2026-10-12', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '', items: [{ name: '도배', spec: '', qty: 1, price: 700000 }], result: 'won' });   // 부가세 포함 770,000
  if (withStmt) {
    const q = hjStmtBuildQuote({ src: 'S1.xlsx', file: 'S1.xlsx', doc: '작업내역서', to: '시험누수', date: '2026-10-20', vat: 'included', project: '가온', lines: [{ d: '2026-10-20', loc: '가온 101-1', work: '누수 탐지', amt: 220000 }] });
    state.quotes.push(q); syncQuoteToProject(q);
    state.payLog.push({ d: '2026-10-28', project: '가온', amt: 100000, stmt: 'S1.xlsx', stmtPay: 'spv589a' }, { d: '2026-10-28', project: '', amt: 11000, stmt: 'S1.xlsx', stmtPay: 'spv589a' });
  }
  __hjStmtYm = null; __hjStmtOldOpen = false;
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
};
const NUMBERS = () => {
  const S = hjSalesEntries(), m = collectQuotesByMonth()['2026-10'] || { count: 0, total: 0 }, v = vatReportData('2026-10', '2026-10');
  const A = projStats('가온'), B = projStats('나래');
  return { basis: hjSalesBasis(), pref: hjSalesBasisPref(), total: S.reduce((a, r) => a + r.amount, 0), n: S.length, month: m.total, closing: monthlyClosingData('2026-10').total,
    vat: v.salesSupply + v.salesVat, brief: hjStmtMonthSales('2026-10').total, A: [A.est, A.sales, A.marginBase, !!A.marginNA], B: [B.est, B.sales, !!B.marginNA],
    labels: [hjEstLabel(), hjSalesLabel(), hjMarginWord()] };
};
const SCREEN = () => {
  state.tab = 'dashboard'; state.activeProject = null; render();
  const kpi = (document.querySelector('.kpis') || {}).innerText || '', sk = document.querySelector('[data-sales-kpi]');
  state.tab = 'estimates'; render();
  const tab = document.querySelector('#tabs .tab[data-tab="estimates"]').firstChild.textContent.trim(), hint = document.querySelector('#view [data-stmt-basis-hint]');
  goalManage();
  const cb = document.getElementById('goalSalesStmt'), auto = document.querySelector('#modalRoot [data-sales-basis-auto]');
  const out = { kpiOld: kpi.includes('총 견적(매출)'), salesKpi: sk ? sk.innerText.replace(/\s+/g, ' ') : null, tab, hint: hint ? hint.innerText.replace(/\s+/g, ' ').trim() : null,
    goalChecked: !!(cb && cb.checked), goalAuto: auto ? auto.innerText.trim() : null };
  closeModal(true);
  return out;
};

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await test('① 내역서 없음 + 설정 없음 = 예전(견적 포함) — 숫자·글자·탭 그대로, 정한 값은 비어 있음 (NONE)', async () => {
      await page.evaluate(SEED, false);
      const api = await page.evaluate(() => [typeof hjSalesBasisPref, typeof hjStmtDataExists]);
      assert.deepEqual(api, ['function', 'function'], '정한 값·내역서 유무 함수 ' + JSON.stringify(api));
      const n = await page.evaluate(NUMBERS), s = await page.evaluate(SCREEN);
      assert.deepEqual([n.basis, n.pref], ['all', ''], '설정 없음 + 내역서 없음 = 견적 포함');
      assert.deepEqual([n.total, n.n, n.month, n.closing, n.vat], [9570000, 3, 9570000, 9570000, 9570000], '매출 = 견적서 2장 + 수주 앱 견적 ' + JSON.stringify(n));
      assert.deepEqual(n.A, [3300000, 3300000, 3300000, false], '가온 — 매출 = 견적, 마진 바탕 = 견적');
      assert.deepEqual(n.labels, ['견적(매출)', '견적(매출)', '매출'], '이름 그대로');
      assert.deepEqual(s, { kpiOld: true, salesKpi: null, tab: '견적·정산', hint: null, goalChecked: false, goalAuto: null }, '화면 그대로 ' + JSON.stringify(s));
    });
    await test('② 내역서 있음 + 설정 없음 = 내역서 기준 — 매출 한 벌·월말 결산·부가세 준비·대시보드·마진·브리핑 같은 값 · 안내 줄 없음 · 목표 체크 켜짐(저절로) (AUTO)', async () => {
      await page.evaluate(SEED, true);
      const n = await page.evaluate(NUMBERS), s = await page.evaluate(SCREEN);
      assert.deepEqual([n.basis, n.pref], ['stmt', ''], '설정 없음 + 내역서 있음 = 내역서');
      assert.deepEqual([n.total, n.n, n.month, n.closing, n.vat, n.brief], [220000, 1, 220000, 220000, 220000, 220000], '매출 = 내역서만, 모든 곳이 같은 값 ' + JSON.stringify(n));
      assert.deepEqual(n.A, [3520000, 220000, 220000, false], '가온 — 견적 합계(청구 숫자)는 그대로, 매출·마진 바탕은 내역서');
      assert.deepEqual(n.B, [5500000, 0, true], '나래 — 내역서 없음 → 마진 셀 수 없음(v562)');
      assert.deepEqual(n.labels, ['견적', '매출(내역서)', '매출(내역서)'], '이름이 내역서 기준');
      assert.equal(s.kpiOld, false, '대시보드 견적 칸은 \'견적\'');
      assert.ok(s.salesKpi && s.salesKpi.includes('매출(내역서)') && s.salesKpi.includes('22'), '대시보드 매출(내역서) 칸 — ' + s.salesKpi);
      assert.equal(s.tab, '📑 내역서', '내역서 탭');
      assert.equal(s.hint, null, '저절로 내역서 기준이면 내역서 탭에 안내 줄 없음');
      assert.equal(s.goalChecked, true, '📊 매출 목표 체크는 실제 기준(켜짐)');
      assert.equal(s.goalAuto, '· 작업내역서가 있어 저절로 켜져 있어요', '저절로 켜졌다고 적음');
    });
    await test('③ 끄면 \'all\' — 저장본을 거쳐도 꺼진 채 · 그때만 안내 줄 · 목표 체크 꺼짐 · 옛 판 기기도 예전처럼 읽음 (OFF)', async () => {
      const r = await page.evaluate(() => {
        goalManage(); const cb = document.getElementById('goalSalesStmt');
        const note = () => { const a = document.querySelector('#modalRoot [data-sales-basis-auto]'); return a ? a.innerText.trim() : null; };
        const note0 = note(); cb.click();   // 목표 화면에서 끔
        const after = { basis: hjSalesBasis(), pref: hjSalesBasisPref(), goals: JSON.parse(JSON.stringify(state.goals)), total: hjSalesEntries().reduce((a, x) => a + x.amount, 0),
          note0, noteOff: note(), checkedOff: cb.checked };
        closeModal(true);
        const snap = JSON.parse(JSON.stringify(serializeData()));
        state.goals = {}; const blank = hjSalesBasis();   // 아무것도 안 정한 다른 기기라면 저절로 켜진다
        applyData(JSON.parse(JSON.stringify(snap)));
        return { after, snapBasis: snap.goals && snap.goals.salesBasis, blank, restored: hjSalesBasis(), restoredPref: hjSalesBasisPref() };
      });
      assert.deepEqual(r.after.goals, { month: 10000000, year: 120000000, salesBasis: 'all' }, '끄면 \'all\' 이 적히고 목표는 그대로 ' + JSON.stringify(r.after.goals));
      assert.deepEqual([r.after.basis, r.after.pref, r.after.total], ['all', 'all', 9790000], '끄면 견적 포함(견적서 2장 + 수주 앱 견적 + 내역서)');
      assert.deepEqual([r.after.note0, r.after.noteOff, r.after.checkedOff], ['· 작업내역서가 있어 저절로 켜져 있어요', null, false], '끄면 \'저절로\' 글이 바로 사라짐(창을 다시 안 열어도) ' + JSON.stringify(r.after));
      assert.equal(r.snapBasis, 'all', '저장본에 \'all\' 이 실림');
      assert.equal(r.blank, 'stmt', '정하지 않은 기기는 저절로 내역서');
      assert.deepEqual([r.restored, r.restoredPref], ['all', 'all'], '저장본을 받으면 꺼진 채(다시 켜지지 않음)');
      const s = await page.evaluate(SCREEN);
      assert.equal(s.tab, '📑 내역서', '내역서가 있으니 탭은 내역서');
      assert.ok(s.hint && /꺼 두셔서, 대시보드·월말 결산의 매출이 견적서까지 함께 세고 있어요\. 📑 매출은 작업내역서만 세기$/.test(s.hint), '끈 때만 안내 줄 — ' + s.hint);
      assert.deepEqual([s.goalChecked, s.goalAuto, s.kpiOld, s.salesKpi], [false, null, true, null], '목표 체크 꺼짐 · 대시보드 예전 글자 ' + JSON.stringify(s));
      // 옛 판(v561~v588) 기기는 'stmt' 만 본다 — 'all' 을 읽어도 예전과 같다
      const old = goals => new Function('state', OLD_BASIS + ';return hjSalesBasis();')({ goals });
      assert.deepEqual([old({ salesBasis: 'all' }), old({ salesBasis: 'stmt' }), old({})], ['all', 'stmt', 'all'], '옛 판 기기의 읽기');
      try { const base = execFileSync('git', ['show', '9ed7e0b:index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); assert.ok(base.includes(OLD_BASIS), '옛 판 함수 글자가 기준선과 같음'); }
      catch (e) { if (e && e.code === 'ERR_ASSERTION') throw e; console.log('  (기준선 커밋을 읽지 못해 옛 판 함수 글자 대조는 건너뜀 — 얕은 복제)'); }
    });
    await test('④ 켜면 \'stmt\' — 내역서 탭 안내 단추로 켜도 같음 · 안내 줄 사라짐 (ON)', async () => {
      await page.evaluate(() => { state.tab = 'estimates'; render(); });
      await page.click('#view [data-stmt-basis]');
      const r = await page.evaluate(() => ({ basis: hjSalesBasis(), pref: state.goals.salesBasis, hint: !!document.querySelector('#view [data-stmt-basis-hint]'), total: hjSalesEntries().reduce((a, x) => a + x.amount, 0), saved: serializeData().goals.salesBasis }));
      assert.deepEqual(r, { basis: 'stmt', pref: 'stmt', hint: false, total: 220000, saved: 'stmt' }, '켜기 ' + JSON.stringify(r));
      const t = await page.evaluate(() => { hjSalesBasisSet(false); const a = state.goals.salesBasis; hjSalesBasisSet(true); return [a, state.goals.salesBasis, hjSalesBasis()]; });
      assert.deepEqual(t, ['all', 'stmt', 'stmt'], '끄고 다시 켜기');
      // 사람이 켠('stmt') 목표 창 — 체크는 켜짐, '저절로' 글은 없음 · 그 창에서 끄고 다시 켜도 글이 생기지 않음
      const g = await page.evaluate(() => {
        goalManage(); const cb = document.getElementById('goalSalesStmt'), note = () => !!document.querySelector('#modalRoot [data-sales-basis-auto]');
        const open = [cb.checked, note()]; cb.click(); const off = [cb.checked, note(), hjSalesBasisPref()]; cb.click(); const on = [cb.checked, note(), hjSalesBasisPref()];
        closeModal(true); return { open, off, on };
      });
      assert.deepEqual(g, { open: [true, false], off: [false, false, 'all'], on: [true, false, 'stmt'] }, '사람이 정한 값이면 \'저절로\' 없음 ' + JSON.stringify(g));
    });
    await test('⑤ 낡은 기억 없음 — 반영·복원·지움 직후 같은 작업 안에서도 바로 · 다음 작업은 제자리 수정도 봄 · 가상 파일만 있어도 내역서 (FRESH)', async () => {
      await page.evaluate(SEED, false);
      const r = await page.evaluate(() => {
        const out = {};
        out.before = hjSalesBasis();   // 'all' 을 기억해 둔 채로
        const res = hjStmtApply({ src: 'S9.xlsx', file: 'S9.xlsx', doc: '작업내역서', to: '시험누수', date: '2026-10-21', vat: 'included',
          groups: [{ loc: '가온 101-1', choice: '가온', lines: [{ d: '2026-10-21', loc: '가온 101-1', work: '누수 탐지', amt: 330000 }] }] });
        out.applied = res.quotes.length;
        out.afterApply = hjSalesBasis(); out.salesAfterApply = hjSalesEntries().reduce((a, x) => a + x.amount, 0);
        const snap = JSON.parse(JSON.stringify(serializeData()));
        state.quotes = state.quotes.filter(q => !q.stmt); state.files = state.files.filter(f => !f._stmt);
        out.afterDelete = hjSalesBasis(); out.salesAfterDelete = hjSalesEntries().reduce((a, x) => a + x.amount, 0);
        applyData(JSON.parse(JSON.stringify(snap)));
        out.afterRestore = hjSalesBasis();
        // 같은 작업 안에서 견적·파일 배열이 같은 길이의 다른 배열로 통째로 바뀜(복원·불러오기 꼴) — 길이만 보면 옛 값('stmt')이 남는다
        const ql = state.quotes.length, fl = state.files.length;
        state.quotes = state.quotes.map(q => { const c = Object.assign({}, q); delete c.stmt; return c; });
        state.files = state.files.map(f => { const c = Object.assign({}, f); delete c._stmt; return c; });
        out.sameLen = [state.quotes.length === ql, state.files.length === fl, hjSalesBasis()];
        applyData(JSON.parse(JSON.stringify(snap)));   // 내역서가 있는 자료로 되돌려 아래 '다음 작업' 단계를 잇는다
        return out;
      });
      assert.deepEqual(r, { before: 'all', applied: 1, afterApply: 'stmt', salesAfterApply: 330000, afterDelete: 'all', salesAfterDelete: 9570000, afterRestore: 'stmt', sameLen: [true, true, 'all'] }, '같은 작업 안 ' + JSON.stringify(r));
      // 다음 작업 — 견적·파일 목록 길이가 그대로인 제자리 수정(내역서 표시를 떼고 붙임)도 본다
      await page.evaluate(() => { state.goals = {}; state.quotes.forEach(q => { if (q.stmt) { q.__stmt = q.stmt; delete q.stmt; } }); state.files.forEach(f => { if (f._stmt) { f.__stmt = f._stmt; delete f._stmt; } }); });
      const off = await page.evaluate(() => hjSalesBasis());
      await page.evaluate(() => { state.quotes.forEach(q => { if (q.__stmt) { q.stmt = q.__stmt; delete q.__stmt; } }); });
      const on = await page.evaluate(() => hjSalesBasis());
      assert.deepEqual([off, on], ['all', 'stmt'], '다음 작업에서는 새로 셈 ' + JSON.stringify([off, on]));
      // 견적 레코드 없이 가상 파일(_stmt)만 남아 있어도 내역서가 있는 것
      const fileOnly = await page.evaluate(() => { const v = state.files.find(f => f.__stmt); state.quotes = state.quotes.filter(q => !q.stmt); v._stmt = v.__stmt; delete v.__stmt; return [state.quotes.some(q => q.stmt), hjSalesBasis()]; });
      assert.deepEqual(fileOnly, [false, 'stmt'], '가상 파일만 있어도 내역서');
    });
    await test('⑥ 화면을 그려도(대시보드·내역서 탭·목표·월말 결산·내역서 보기) 저장본 불변 (READONLY)', async () => {
      await page.evaluate(SEED, true);
      const r = await page.evaluate(() => {
        const snap = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };
        const before = snap();
        state.tab = 'dashboard'; render(); state.tab = 'estimates'; render();
        goalManage(); closeModal(true);
        monthlyClosingData('2026-10'); vatReportData('2026-10', '2026-10'); hjSalesBasis();
        hjStmtDetailView('S1.xlsx'); closeModal(true);
        return { same: before === snap(), pref: hjSalesBasisPref(), goals: JSON.stringify(state.goals) };
      });
      assert.deepEqual(r, { same: true, pref: '', goals: '{"month":10000000,"year":120000000}' }, '그리기만으로 바뀌지 않음(설정이 저절로 적히지 않음) ' + JSON.stringify(r));
    });
    await test('⑦ 📄 내역서 한 장 보기 — 머리 남음 = 장부 셈 하나 · 차이 경고 줄 없음 · 현장별 받은 돈·남은 돈·현장 미지정 칸은 그대로 (DETAIL)', async () => {
      await page.evaluate(() => { state.tab = 'estimates'; render(); });
      await page.click('#view [data-stmtdetail="S1.xlsx"]');
      await page.waitForSelector('#modalRoot [data-stmt-detail="S1.xlsx"]');
      const r = await page.evaluate(() => {
        const m = document.querySelector('#modalRoot'), t = el => (el ? el.innerText : '').replace(/\s+/g, ' ').trim(), D = hjStmtDetailData('S1.xlsx');
        return { sum: t(m.querySelector('[data-sd-sum]')), gap: m.querySelectorAll('[data-sd-gap]').length, head: t(m.querySelector('[data-sd-head]')),
          sites: [...m.querySelectorAll('[data-sd-site]')].map(s => [s.dataset.sdSite, t(s.querySelector('[data-sd-site-sum]'))]), left: D.left,
          keys: ['siteLeft', 'orphanPaid', 'overPaid', 'gap'].filter(k => k in D) };
      });
      assert.equal(r.sum, '합계 220,000원 · 받음 111,000원 · 남음 109,000원', '머리 = 장부 셈(합계 − 이 내역서로 받은 돈 전부) ' + r.sum);
      assert.equal(r.left, 109000);
      assert.equal(r.gap, 0, '차이 경고 줄 없음 — 현장별 남은 돈 합(120,000)과 갈려도');
      assert.ok(!/현장별 남은 돈을 더하면|달라요/.test(r.head), '머리에 차이 글 없음 ' + r.head);
      assert.deepEqual(r.keys, [], '차이 셈 없음');
      assert.deepEqual(r.sites, [['가온', '합계 220,000원 · 받은 돈 100,000원 · 남은 돈 120,000원'], ['', '받은 돈 11,000원']], '현장별 줄은 그대로 ' + JSON.stringify(r.sites));
      await page.evaluate(() => closeModal(true));
    });
    await test('⑧ 기준을 따르는 글 — 고객·보험용 증빙 묶음에 내부 매출 줄 없음 · 견적을 매출이라 하던 안내가 내역서 기준이면 \'견적 합계\', 끄면 예전 글 (LABELS)', async () => {
      const MORE = () => {   // 안 읽은 견적서 1장 · 현장 미연결 견적 1건 · ★ 최종본이 있는 달의 다른 안 1건(가온)
        const f = (id, name, amount) => ({ id, name, ext: 'xlsx', kind: 'estimate', project: '가온', prefix: '_정리완료/가온/견적서/', size: 600 + amount % 97,
          est: { customer: '가온', amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date: '2026-10-10' }, when: new Date('2026-10-10T09:00:00+09:00') });
        state.files.push(f('E_STAR', '★가온_견적_20261010.xlsx', 1100000), f('E_PLAIN', '가온_견적_20261011.xlsx', 990000),
          { id: 'E_U', name: '다온_견적서.xlsx', ext: 'xlsx', kind: 'estimate', project: '', prefix: '견적서/', size: 777, ocr: 'pending', est: null, when: new Date('2026-11-01T09:00:00+09:00') });
        state.quotes.push({ id: 'UQ', title: '미연결 견적', no: '제20261101', date: '2026-11-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '', items: [{ name: '도배', spec: '', qty: 1, price: 100000 }] });
      };
      const READ = () => {
        const out = { basis: hjSalesBasis(), pref: hjSalesBasisPref() };
        const ev = purpose => { const plan = hjEvidencePlan('나래', { purpose }), head = plan.entries[0].payload.split('\n').find(l => /수금:/.test(l)) || '';
          const led = (plan.entries.find(e => e.path === '06_수금발행기록.xlsx') || {}).payload; return [head, led ? led[led.length - 1][0] : null]; };
        out.ev = { customer: ev('customer'), insurance: ev('insurance'), tax: ev('tax') };
        out.daily = dailyCheckData().map(x => x.t).filter(t => /읽지 않은 견적서|현장 미연결 견적/.test(t));
        __hjStmtOldOpen = true; state.tab = 'estimates'; render();
        out.overview = ([...document.querySelectorAll('#view .estimate-overview span')].map(x => x.innerText.trim()))[2] || null;
        const fin = [...document.querySelectorAll('#view .hint')].map(x => x.innerText.replace(/\s+/g, ' ').trim()).find(t => /최종본/.test(t)); out.final = fin || null;
        __hjStmtOldOpen = false; state.tab = 'dashboard'; render();
        hjStmtReview(hjStmtParse([{ name: 's', grid: [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-10-25', '나래', '방수', 150000]] }], 'N1.xlsx'));
        const exh = document.querySelector('#modalRoot [data-stmt-ex-head]'); out.review = exh ? exh.innerText.trim() : null;
        closeModal(true);
        const save = () => { window.__toasts = []; const q = newQuote(); q.project = '나래'; q.title = '도배안'; q.items = [{ name: '도배', spec: '', qty: 1, price: 1000000 }]; state.editingQuote = q; saveQuoteEdit(); return window.__toasts.slice(-1)[0] || ''; };
        out.toast1 = save(); out.toast2 = save();
        const ids = state.quotes.filter(q => q.project === '나래' && q.title === '도배안').map(q => q.id);
        window.__toasts = []; hjQuoteTierConfirm('나래', ids[0], ids);
        out.confirm = [window.__toasts.slice(-1)[0] || '', (state.notes.slice(-1)[0] || {}).text || ''];
        out.sales = hjSalesEntries().reduce((a, x) => a + x.amount, 0);
        return out;
      };
      await page.evaluate(SEED, true); await page.evaluate(MORE);
      const auto = await page.evaluate(READ);
      assert.deepEqual([auto.basis, auto.pref], ['stmt', ''], '저절로 내역서 기준');
      assert.deepEqual(auto.ev, { customer: ['견적: 5,500,000원 · 수금: 0원', '견적'], insurance: ['견적: 5,500,000원 · 수금: 0원', '견적'],
        tax: ['견적: 5,500,000원 · 매출(내역서): 0원 · 수금: 0원', '매출(내역서)'] }, '고객·보험용 묶음에는 내부 매출 줄 없음, 세무사용에만 ' + JSON.stringify(auto.ev));
      assert.deepEqual(auto.daily, ['읽지 않은 견적서 1건 — 읽어야 견적 합계에 들어갑니다', '현장 미연결 견적 1건 — 연결하면 현장 견적 합계에 반영'], '오늘 챙길 일 ' + JSON.stringify(auto.daily));
      assert.equal(auto.overview, '견적 합계 · 매출은 작업내역서만', '예전 견적 화면 칸');
      assert.ok(auto.final && auto.final.includes('견적 합계에 같이 잡히고 있어요') && !auto.final.includes('매출'), '최종본 안내 — ' + auto.final);
      assert.equal(auto.review, '이 현장들의 견적 합계·청구에 잡힌 견적(매출은 작업내역서만 셉니다) — 내역서로 대신하면 체크(견적 합계·청구에서 제외 · 지우지 않음)', '내역서 반영 창 집계 제외 상자 — ' + auto.review);
      assert.equal(auto.toast1, '견적서 저장됨 · 나래 견적 합계 반영', '견적 저장 알림');
      assert.ok(/이 현장 견적 2개가 견적 합계에 모두 더해집니다/.test(auto.toast2), '안 여러 개 알림 — ' + auto.toast2);
      assert.ok(/나머지 1안은 견적 합계에서 뺐어요/.test(auto.confirm[0]) && /나머지 1안은 견적 Σ 에서 뺌$/.test(auto.confirm[1]), '안 확정 알림·기록 — ' + JSON.stringify(auto.confirm));
      assert.equal(auto.sales, 220000, '견적을 저장해도 매출(내역서)은 그대로');
      // 사람이 끈('all') 자료는 예전 글 그대로
      await page.evaluate(SEED, true); await page.evaluate(() => { state.goals.salesBasis = 'all'; }); await page.evaluate(MORE);
      const off = await page.evaluate(READ);
      assert.deepEqual([off.basis, off.pref], ['all', 'all']);
      assert.deepEqual(off.ev, { customer: ['견적(매출): 5,500,000원 · 수금: 0원', '견적(매출)'], insurance: ['견적(매출): 5,500,000원 · 수금: 0원', '견적(매출)'],
        tax: ['견적(매출): 5,500,000원 · 수금: 0원', '견적(매출)'] }, '끄면 예전 묶음 ' + JSON.stringify(off.ev));
      assert.deepEqual(off.daily, ['읽지 않은 견적서 1건 — 읽어야 매출에 들어갑니다', '현장 미연결 견적 1건 — 연결하면 매출 반영'], '끄면 예전 글 ' + JSON.stringify(off.daily));
      assert.equal(off.overview, '견적 합계 · 매출 집계 기준');
      assert.ok(off.final && off.final.includes('매출에 같이 잡히고 있어요'), '최종본 안내 예전 글 — ' + off.final);
      assert.equal(off.review, '이 현장들에 이미 매출로 잡힌 견적 — 내역서로 대신하면 체크(집계 제외 · 지우지 않음)');
      assert.equal(off.toast1, '견적서 저장됨 · 나래 매출 반영');
      assert.ok(/이 현장 견적 2개가 매출에 모두 더해집니다/.test(off.toast2), '안 여러 개 예전 글 — ' + off.toast2);
      assert.ok(/나머지 1안은 매출 합계에서 뺐어요/.test(off.confirm[0]) && /나머지 1안은 매출 Σ 에서 뺌$/.test(off.confirm[1]), '안 확정 예전 글 — ' + JSON.stringify(off.confirm));
      await page.evaluate(SEED, true);
    });
    await test('⑨ 폰 390 — 가로 넘침 없음 · 단추·체크 칸 44px · 핀 3곳 · 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      const r = await page.evaluate(() => {
        const over = () => document.documentElement.scrollWidth - innerWidth;
        const out = {};
        hjSalesBasisSet(false); state.tab = 'estimates'; render();
        const hb = document.querySelector('#view [data-stmt-basis]');
        out.tab = over(); out.hintBtn = hb ? Math.round(hb.getBoundingClientRect().height) : 0;
        const hw = document.querySelector('#view [data-stmt-basis-hint]'); out.hintRight = hw ? Math.round(hw.getBoundingClientRect().right) : 0;
        goalManage();
        const box = document.querySelector('#modalRoot [data-sales-basis]'), md = document.querySelector('#modalRoot .modal');
        out.goal = over(); out.box = box ? [Math.round(box.getBoundingClientRect().height), Math.round(box.getBoundingClientRect().right)] : [0, 0]; out.modalOver = md.scrollWidth - md.clientWidth;
        closeModal(true); hjSalesBasisSet(true); state.tab = 'dashboard'; render(); out.dash = over();
        hjStmtDetailView('S1.xlsx'); const dm = document.querySelector('#modalRoot .modal'); out.detail = [over(), dm.scrollWidth - dm.clientWidth];
        out.small = [...document.querySelectorAll('#modalRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim());
        closeModal(true);
        out.vw = innerWidth;
        return out;
      });
      assert.ok(r.tab <= 1 && r.goal <= 1 && r.dash <= 1 && r.detail[0] <= 1 && r.detail[1] <= 1 && r.modalOver <= 1, '가로 넘침 없음 ' + JSON.stringify(r));
      assert.ok(r.hintBtn >= 44, '안내 줄 단추 44px ' + r.hintBtn); assert.ok(r.hintRight <= r.vw, '안내 줄이 화면 안 ' + r.hintRight);
      assert.ok(r.box[0] >= 44 && r.box[1] <= r.vw, '목표 화면 체크 칸 44px·화면 안 ' + JSON.stringify(r.box));
      assert.deepEqual(r.small, [], '내역서 보기 단추 44px');
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`salesdefault-v589: ${passed}/9 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL salesdefault-v589 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

/* v583 📑 고친 작업내역서 — 금액만 바뀐 줄을 다시 반영하면 두 번 더해지던 것.
   hjStmtLineId = [날짜,위치,작업명,금액] 이라 금액만 고친 줄은 '새 줄'로 붙고(같은 파일) 또는 견적이 하나 더 생겨(…_수정.xlsx) 옛 줄이 남았다 —
   매출(내역서)·남은 돈·부가세 매출이 조용히 부풀었다. v579 초안 엑셀을 채워 반영 → 금액을 고쳐 다시 반영하면 바로 일어난다.
   합성 자료(이름은 지어낸 것) · 시계 2026-11-10 고정 · 엑셀은 격자를 hjStmtParse 에 바로 넣거나 가짜 XLSX · 바깥 쓰기 0.
   ① 나누기 — 같은 파일 고친 줄(짝 하나 → 기본 '바꾸기') · 새 파일에 없는 옛 줄 알림 · 같은 줄이 여럿이면 기본값 없음 · 손으로 고친 견적은 기본값 없음 ·
      날짜 없는 줄은 같은 파일일 때만 기본 '바꾸기' · 위치가 다르면 짝 아님 · 읽기만 (CLASSIFY)
      기본값을 주지 않는 곳 — 고른 현장과 다른 현장 · 집계 제외 · 보관·지운 현장 · 다른 거래처·거래처 모름 · 합만 같고 품목 사이 금액을 옮긴 견적 · 품목 이름을 고친 견적 (DEFAULT)
   ② 반영 — 바꾸기: 줄 금액·stmt.total·품목 단가(1원 보정)·가상 견적 파일·매출·장부가 새 금액 · 견적 수 그대로 · 안전판 '작업내역서 금액 수정 전' ·
      저장 표시(바꾸기만 해도) · 견적 비고에 '[금액 수정]' 기록 · 이름이 다른 수정본도 옛 견적을 바꿈 + 새 줄은 따로 · 따로 더하기·넣지 않기 ·
      바꾸기만 한 수정본 파일도 '반영함'(hjStmtFiles) · 공급가 견적 +10% (APPLY)
   ③ 막음 — 안 고른 줄·안전판 없이·안전판 실패·손으로 고친 견적·입금이 새 합계보다 큼·미리보기 뒤 바뀜·같은 옛 줄 두 번 → 아무것도 안 바뀜 ·
      여럿 중 고른 줄만 바꿈 (GUARD) · 그 현장에 나눠 적힌 입금이 그 현장 새 합계보다 큼(내역서 전체는 괜찮아도) · 집계 제외 견적은 입금 대조에서 뺌 ·
      품목 이름·순서를 고친 견적 · 품목 사이 금액을 옮긴 견적 · 견적 작성 화면에 열린 견적 (GUARD2)
   ④ 화면 — 확인 창의 ✏️ 줄(기본 '바꾸기')·없는 줄 알림·옛 작성 월 알림 · 현장을 다른 곳으로 고르면 기본값 없음 → 되돌리면 다시 바꾸기 ·
      창을 연 뒤 옛 줄이 바뀌면 [반영]이 막힘 · [반영] → 바뀜 · 여럿이면 안 고르면 반영 안 함 → 고르면 반영 · 반영 중 Esc 로 안 닫힘 ·
      폰 390 넘침 없음·44px·16px (UI)
   ⑤ 핀 3곳 서로 같음 · 오류 0 · 바깥 쓰기 0
   HJ_V583_BASELINE=<commit> 은 ① 에서, HJ_V583_MUTATION=no-revise(감지 끔)·no-reprice(단가를 다시 안 셈)는 ①·② 에서 실패해야 한다.
   검토 뒤 더한 변이 — 모두 실패해야 한다: no-dirty·no-memo·no-filemark(②) · no-loc·no-projctx·no-vendor·no-deadproj·no-exsumdef·no-itemcheck·no-namecheck(①)
   · no-projpaid·no-exsum·no-editingq(③) · no-revamt·stale-default·no-lock(④). */
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
  'no-revise': ['byK.forEach((ls,k)=>{const cs=exist.filter(x=>!x.used&&x.k===k);if(cs.length)ls.forEach(l=>rev.set(l,{cands:cs,sure:ls.length===1&&cs.length===1}));});', ''],
  'no-reprice': ['  q.items.forEach((it,i)=>{it.price=prices[i];});\n', ''],
  'no-dirty': ['||res.newProjects.length||res.replaced.length)markDirty();', '||res.newProjects.length)markDirty();'],
  'no-memo': ["x.q.memo=[String(x.q.memo||'')]", "void [String(x.q.memo||'')]"],
  'no-filemark': ["    x.q.stmt.revFiles=(Array.isArray(x.q.stmt.revFiles)?x.q.stmt.revFiles:[]).filter(f=>f!==src).concat(src).slice(-20);\n", ''],
  // 통합 검토(v587) — 수정본 표식을 견적마다 한 칸(stmt.file)에 덮어쓰면 앞선 수정본이 다시 '아직 안 넣음'이 되고 원본 파일 이름도 바뀐다
  'rev-overwrite': ["    x.q.stmt.revFiles=(Array.isArray(x.q.stmt.revFiles)?x.q.stmt.revFiles:[]).filter(f=>f!==src).concat(src).slice(-20);\n", '    x.q.stmt.file=src;\n'],
  'no-oldfile': ["  if((rf.includes(sc)||org===sc)&&sc!==last)return ", "  if(false)return "],
  'no-loc': ["function hjStmtLineKey(l){return [l&&l.d||'',hjStmtKey(l&&l.loc),hjStmtKey(l&&l.work)].join('|');}", "function hjStmtLineKey(l){return [l&&l.d||'',hjStmtKey(l&&l.work)].join('|');}"],
  'no-projctx': ["  if(ctx&&ctx.project!=null&&ctx.project!==p)return '고른 현장('+ctx.project+')과 다른 현장의 견적이라 골라 주세요';\n", ''],
  'no-vendor': ["    if(!a||!b)return '다른 파일이고 거래처를 알 수 없어 골라 주세요';\n    if(a!==b)return '다른 거래처(‘'+a+'’) 내역서라 골라 주세요';\n", ''],
  'no-deadproj': ["  if(!pj)return '지운 현장의 견적이라 골라 주세요';\n  if(pj.archived)return '보관한 현장의 견적이라 골라 주세요';\n", ''],
  'no-exsumdef': ["  if(q.exSum)return '집계 제외한 견적이라 골라 주세요';\n", ''],
  'no-itemcheck': ["  for(let i=0;i<ls.length;i++){const a=Math.round(num(ls[i].amt)),base=st.vat==='separate'?a:Math.round(a/1.1);if(Math.abs(num(items[i].price)-base)>tol)return '품목 금액을 손으로 고쳤어요';}\n", ''],
  'no-namecheck': ["  for(let i=0;i<ls.length;i++){if(num(items[i].qty)!==1||String(items[i].name||'')!==(hjStmtCell(ls[i].work)||hjStmtCell(ls[i].loc)||'작업'))return '품목 이름·수량이 내역서 줄과 달라요';}\n", ''],
  'no-projpaid': ["    if(t.after<t.before&&paid>t.after)throw new Error(", "    if(false)throw new Error("],
  'no-exsum': ["(state.quotes||[]).forEach(q=>{if(!q||!q.stmt||q.exSum||!q.project||hjStmtSrcOf(q)!==src)return;const x=qs.find(y=>y.q===q)", "(state.quotes||[]).forEach(q=>{if(!q||!q.stmt||hjStmtSrcOf(q)!==src)return;const x=qs.find(y=>y.q===q)"],
  'no-editingq': ["    if(state.editingQuote&&state.editingQuote.id===q.id)throw new Error(", "    if(false)throw new Error("],
  'no-revamt': ["const a=d.split(':'),qid=a[1],li=+a[2],amt=cur.revAmt.get(d);", "const a=d.split(':'),qid=a[1],li=+a[2],qq=(state.quotes||[]).find(x=>x&&x.id===qid),old=qq&&qq.stmt&&(qq.stmt.lines||[])[li],amt=old?Math.round(num(old.amt)):null;"],
  'stale-default': ["const ok=cur.revUser.has(l)&&(d==='add'", "const ok=d!=null&&(d==='add'"],
  'no-lock': ['cur.busy=true;__modalCloseLocked=true;', ''],
};
let html = process.env.HJ_V583_BASELINE ? execFileSync('git', ['show', process.env.HJ_V583_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V583_MUTATION) {
  const m = MUT[process.env.HJ_V583_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V583_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtrevise-v583 ' + name); }
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
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    window.__realSnap = hjSnapshot;
  }, BOOT);
  await page.evaluate('window.SEED_FN = ' + SEED.toString());
  return { context, page };
}
// 내역서 격자(v579 초안을 채운 꼴) — 머리 + 줄 + 합계
const G = (lines) => [['작업내역서'], ['받는 분', '가상협력'], ['작성일', '2026-11-10'], ['작업 날짜', '위치', '작업명', '작업비용'], ...lines, ['합계', '', '', lines.reduce((a, l) => a + l[3], 0)]];
const A = '작업내역서초안_20261110_가상협력.xlsx', A2 = '작업내역서초안_20261110_가상협력_수정.xlsx';
const LINES1 = [['2026-11-03', '가온아파트 101-1101', '우수관 교체', 220000], ['2026-11-04', '가온아파트 101-1101', '육가 교체', 50000], ['2026-11-05', '나래아파트 2-202', '변기 교체', 270000]];
// 같은 파일을 고침 — 우수관 220,000 → 330,000 · 육가 그대로 · 나래 줄은 빠짐
const LINES2 = [['2026-11-03', '가온아파트 101-1101', '우수관 교체', 330000], ['2026-11-04', '가온아파트 101-1101', '육가 교체', 50000]];
// 이름이 다른 수정본 — 우수관 330,000 → 440,000 · 나래 그대로 · 새 줄 실리콘
const LINES3 = [['2026-11-03', '가온아파트 101-1101', '우수관 교체', 440000], ['2026-11-05', '나래아파트 2-202', '변기 교체', 270000], ['2026-11-06', '가온아파트 101-1101', '실리콘 마감', 30000]];
const SEED = () => {
  closeModal(true);
  hjSnapshot = window.__realSnap;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김가상', phone: '010-0000-0000', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜빌라')];
  state.quotes = []; state.files = []; state.notes = []; state.payLog = []; state.expenses = []; state.schedule = []; state._demo = false; state.dirHandle = null; state.goals = {}; state.editingQuote = null; __tabStale = false;
  __hjStmtYm = null; __hjStmtOldOpen = false; state.activeProject = null; state.tab = 'estimates'; state.search = '';
  // 앱 함수로 처음 반영한다(손으로 견적을 짓지 않는다)
  window.PLAN = (file, lines, vat, pick) => {
    const r = hjStmtParse([{ name: '작업내역서', grid: lines }], file);
    const groups = hjStmtGroups(r).map(g => ({ loc: g.loc, lines: g.lines, choice: (pick || {})[g.loc] || (/가온/.test(g.loc) ? '가온아파트' : /나래/.test(g.loc) ? '나래아파트' : '다솜빌라') }));
    return { src: r.file, file: r.file, doc: '작업내역서', to: r.to, date: r.date, vat: vat || 'included', groups, exclude: [] };
  };
  // 미리보기 기본값대로 고른 계획(짝 하나 → 바꾸기). over = {loc|work: 'add'|'skip'|cand index}
  window.DECIDE = (plan, over) => {
    const all = [], pj = new Map(); plan.groups.forEach(g => { all.push(...g.lines); g.lines.forEach(l => pj.set(l, hjStmtChoiceName(g.choice))); });
    const rv = hjStmtRevisions(all, plan.src, { projectOf: l => pj.get(l), to: plan.to }), by = new Map(rv.rows.map(x => [x.line, x]));
    plan.groups.forEach(g => { g.lines = g.lines.map(l => {
      const x = by.get(l); if (!x) return l;
      const o = (over || {})[l.work + '|' + l.amt];
      if (o === 'add' || o === 'skip') return Object.assign({}, l, { revise: o });
      const c = typeof o === 'number' ? x.cands[o] : (x.def ? x.cands[0] : null);
      return c ? Object.assign({}, l, { revise: 'replace', reviseTo: { qid: c.qid, li: c.li, amt: c.amt } }) : l;
    }); });
    return plan;
  };
  window.SNAP = () => JSON.stringify(serializeData().quotes) + JSON.stringify(state.payLog) + JSON.stringify(state.projects.map(p => p.name));
  window.EST = name => projStats(name).est;
  window.LEDGER = src => { const s = hjStmtLedger().find(x => x.src === src); return s ? s.total : null; };
  window.STMTQ = (project, src) => state.quotes.find(q => q.stmt && q.project === project && hjStmtSrcOf(q) === src);
  render();
};

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await test('① 나누기 — 짝 하나면 기본 바꾸기 · 없는 줄 알림 · 여럿이면 기본값 없음 · 손으로 고친 견적 · 읽기만 (CLASSIFY)', async () => {
      const r = await page.evaluate(({ l1, l2, A }) => {
        SEED_FN();
        hjStmtApply(PLAN(A, l1));
        const before = SNAP();
        const p2 = hjStmtParse([{ name: 's', grid: l2 }], A);
        const rv = hjStmtRevisions(p2.lines, A);
        const ga = STMTQ('가온아파트', A);
        const out = { rows: rv.rows.map(x => [x.i, x.line.work, x.line.amt, x.sure, x.def, x.cands.map(c => [c.amt, c.project, c.src, c.li, c.edited])]), gaId: ga.id,
          missing: rv.missing.map(m => [m.project, m.work, m.amt]), dup: rv.dup, same: SNAP() === before };
        // 같은 날짜·위치·작업명 옛 줄이 둘이면 기본값 없음 — 둘 다 후보
        hjStmtApply(PLAN('M.xlsx', [['작업내역서'], ['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 100000], ['2026-11-07', '다솜빌라 1층', '방수', 120000]]));
        const pm = hjStmtParse([{ name: 's', grid: [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 150000]] }], 'M2.xlsx');
        const rm = hjStmtRevisions(pm.lines, 'M2.xlsx');
        out.amb = rm.rows.map(x => [x.sure, x.def, x.cands.map(c => c.amt)]);
        // 손으로 고친 견적은 기본 '바꾸기'를 주지 않는다
        STMTQ('나래아파트', A).items[0].price += 1000;
        const pn = hjStmtParse([{ name: 's', grid: [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-05', '나래아파트 2-202', '변기 교체', 300000]] }], A);
        const rn = hjStmtRevisions(pn.lines, A);
        out.edited = rn.rows.map(x => [x.def, x.cands[0].edited]);
        STMTQ('나래아파트', A).items[0].price -= 1000;
        // 날짜가 다르거나 작업명이 다르면 금액만 바뀐 줄이 아니다
        out.other = hjStmtRevisions([{ d: '2026-11-08', loc: '가온아파트 101-1101', work: '우수관 교체', amt: 1 }, { d: '2026-11-03', loc: '가온아파트 101-1101', work: '우수관 보수', amt: 1 }, { d: '2026-11-03', loc: '가온아파트 102-1203', work: '우수관 교체', amt: 2 }, { d: '2026-11-03', loc: '가온아파트  101 - 1101', work: '우수관  교체', amt: 9 }], A).rows.map(x => x.line.work);
        // 날짜 없는 줄(더케이 '미기재')은 같은 원본 파일일 때만 기본 '바꾸기'
        hjStmtApply({ src: 'U.xlsx', file: 'U.xlsx', doc: '작업내역서', to: '', date: '2026-11-10', vat: 'included', groups: [{ loc: '다솜빌라 3층', lines: [{ d: '', loc: '다솜빌라 3층', work: '엑셀 2개', amt: 100000 }], choice: '다솜빌라' }], exclude: [] });
        const pu = [{ d: '', loc: '다솜빌라 3층', work: '엑셀 2개', amt: 120000 }];
        out.undated = [hjStmtRevisions(pu, 'U.xlsx').rows.map(x => x.def.slice(0, 2)), hjStmtRevisions(pu, 'V.xlsx').rows.map(x => [x.sure, x.def])];
        return out;
      }, { l1: G(LINES1), l2: G(LINES2), A });
      assert.deepEqual(r.rows, [[0, '우수관 교체', 330000, true, 'r:' + r.gaId + ':0', [[220000, '가온아파트', A, 0, '']]]], 'CLASSIFY rows ' + JSON.stringify(r.rows));
      assert.deepEqual(r.missing, [['나래아파트', '변기 교체', 270000]], '새 파일에 없는 옛 줄 ' + JSON.stringify(r.missing));
      assert.equal(r.dup, 1, '육가 줄은 이미 반영됨');
      assert.equal(r.same, true, '읽기만');
      assert.deepEqual(r.amb, [[false, '', [100000, 120000]]], '같은 줄이 여럿이면 기본값 없음 ' + JSON.stringify(r.amb));
      assert.equal(r.edited[0][0], '', '손으로 고친 견적은 기본값 없음');
      assert.equal(r.edited[0][1], '품목 금액을 손으로 고쳤어요', JSON.stringify(r.edited));
      assert.deepEqual(r.undated, [['r:'], [[true, '']]], '날짜 없는 줄 — 다른 파일이면 기본값 없음 ' + JSON.stringify(r.undated));
      assert.deepEqual(r.other, ['우수관  교체'], '빈칸 차이는 같은 줄로 보고, 날짜·위치·작업명이 다르면 아님 ' + JSON.stringify(r.other));
      // 기본 '바꾸기'를 주지 않는 곳 — 고른 현장·받는 분(ctx)에 따라
      const d = await page.evaluate(({ l1, A, A2 }) => {
        SEED_FN();
        hjStmtApply(PLAN(A, l1));
        const ga = STMTQ('가온아파트', A), one = [{ d: '2026-11-03', loc: '가온아파트 101-1101', work: '우수관 교체', amt: 330000 }];
        const D = (file, project, to) => hjStmtRevisions(one, file, { projectOf: () => project, to }).rows.map(x => [x.def.slice(0, 2), x.cands[0].block]);
        const out = { same: D(A, '가온아파트', '가상협력'), other: D(A, '다솜빌라', '가상협력'), newp: D(A, '새현장', '가상협력'),
          vendorSame: D(A2, '가온아파트', '가상협력'), vendorOther: D(A2, '가온아파트', '더케이'), vendorNone: D(A2, '가온아파트', '') };
        ga.exSum = true; out.exsum = D(A, '가온아파트', '가상협력'); delete ga.exSum;
        state.projects[0].archived = true; out.arch = D(A, '가온아파트', '가상협력'); state.projects[0].archived = false;
        // 합은 그대로 두고 품목 사이 금액을 옮긴 견적 · 품목 이름을 고친 견적 — 손으로 고친 견적
        const p0 = ga.items.map(i => i.price);
        ga.items[0].price -= 10000; ga.items[1].price += 10000; out.shift = [hjStmtQuoteEdited(ga, 1), D(A, '가온아파트', '가상협력')];
        ga.items[0].price = p0[0]; ga.items[1].price = p0[1];
        const n0 = ga.items[0].name; ga.items[0].name = n0 + '(수정)'; out.rename = hjStmtQuoteEdited(ga, 1); ga.items[0].name = n0;
        out.clean = hjStmtQuoteEdited(ga, 1);
        // 지운 현장 — 같은 이름 현장을 다시 만들어도 옛(지운) 견적은 기본값 없음
        hjDeleteProjectCore('가온아파트');
        state.projects.push({ name: '가온아파트', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
        out.dead = D('C.xlsx', '가온아파트', '가상협력');
        return out;
      }, { l1: G(LINES1), A, A2 });
      assert.deepEqual(d.same, [['r:', '']], 'DEFAULT 같은 현장·같은 파일 ' + JSON.stringify(d));
      assert.ok(d.other[0][0] === '' && /고른 현장\(다솜빌라\)/.test(d.other[0][1]) && d.newp[0][0] === '', 'DEFAULT 고른 현장과 다른 현장 ' + JSON.stringify(d));
      assert.deepEqual(d.vendorSame, [['r:', '']], 'DEFAULT 수정본 · 같은 거래처 ' + JSON.stringify(d));
      assert.ok(d.vendorOther[0][0] === '' && /다른 거래처\(‘가상협력’\)/.test(d.vendorOther[0][1]) && d.vendorNone[0][0] === '' && /거래처를 알 수 없어/.test(d.vendorNone[0][1]), 'DEFAULT 다른 거래처·모름 ' + JSON.stringify(d));
      assert.ok(d.exsum[0][0] === '' && /집계 제외/.test(d.exsum[0][1]) && d.arch[0][0] === '' && /보관/.test(d.arch[0][1]), 'DEFAULT 집계 제외·보관 ' + JSON.stringify(d));
      assert.ok(d.dead[0][0] === '' && /지운 현장/.test(d.dead[0][1]), 'DEFAULT 지운 현장 ' + JSON.stringify(d));
      assert.ok(d.shift[0] === '품목 금액을 손으로 고쳤어요' && d.shift[1][0][0] === '' && d.rename === '품목 이름·수량이 내역서 줄과 달라요' && d.clean === '', 'DEFAULT 손으로 고친 견적 ' + JSON.stringify(d));
    });

    await test('② 반영 — 바꾸기·1원 보정·매출·장부·가상 파일·안전판 · 수정본 · 따로 더하기·넣지 않기 · 공급가 (APPLY)', async () => {
      const r = await page.evaluate(async ({ l1, l2, l3, A, A2 }) => {
        SEED_FN();
        hjStmtApply(PLAN(A, l1));
        const s0 = { est: EST('가온아파트'), led: LEDGER(A), n: state.quotes.length };
        state.dirty = false;   // 바꾸기만 한 반영도 저장 표시를 해야 한다(새 견적·붙인 줄이 없어도)
        const res = await hjStmtApplySafe(DECIDE(PLAN(A, l2)));
        const ga = STMTQ('가온아파트', A), vf = state.files.find(f => f.id === 'quote_' + ga.id);
        const snaps = await idbGetStrict('hj_snaps'), last = snaps[snaps.length - 1];
        const lastGa = last.data.quotes.find(q => q.id === ga.id);
        const s1 = { replaced: res.replaced.map(x => [x.project, x.work, x.from, x.to]), quotes: res.quotes.length, appended: res.appended.length, total: res.total, dup: res.dupLines,
          lines: ga.stmt.lines.map(l => l.amt), stTotal: ga.stmt.total, calc: quoteCalc(ga), items: ga.items.map(i => i.price), n: state.quotes.length,
          est: EST('가온아파트'), nare: EST('나래아파트'), led: LEDGER(A), vf: vf.est.amount, sales: hjSalesEntries().reduce((a, e) => a + e.amount, 0),
          snap: last.label, snapOld: lastGa.stmt.lines.map(l => l.amt), dirty: state.dirty, memo: ga.memo.split('\n').filter(x => /^\[금액 수정\]/.test(x)) };
        return { s0, s1 };
      }, { l1: G(LINES1), l2: G(LINES2), A });
      assert.deepEqual(r.s0, { est: 270000, led: 540000, n: 2 });
      assert.deepEqual(r.s1.replaced, [['가온아파트', '우수관 교체', 220000, 330000]], 'APPLY replaced ' + JSON.stringify(r.s1));
      assert.ok(r.s1.quotes === 0 && r.s1.appended === 0 && r.s1.dup === 1 && r.s1.total === 110000 && r.s1.n === 2, 'APPLY no extra quote/line ' + JSON.stringify(r.s1));
      assert.deepEqual(r.s1.lines, [330000, 50000]);
      assert.equal(r.s1.stTotal, 380000);
      assert.deepEqual(r.s1.calc, { sub: 345455, supply: 345455, vat: 34545, total: 380000 }, '1원 보정 ' + JSON.stringify(r.s1.calc));
      assert.equal(r.s1.items.reduce((a, b) => a + b, 0), 345455, '품목 단가 합 = 새 공급가');
      assert.ok(r.s1.est === 380000 && r.s1.nare === 270000 && r.s1.led === 650000 && r.s1.vf === 380000 && r.s1.sales === 650000, 'APPLY 매출·장부·가상 파일 ' + JSON.stringify(r.s1));
      assert.ok(r.s1.snap === '작업내역서 금액 수정 전' && JSON.stringify(r.s1.snapOld) === '[220000,50000]', 'APPLY 안전판은 바꾸기 전 자료 ' + JSON.stringify(r.s1));
      assert.equal(r.s1.dirty, true, 'APPLY 바꾸기만 해도 저장 표시');
      assert.deepEqual(r.s1.memo, ['[금액 수정] 2026-11-10 · 우수관 교체 220,000→330,000원 · 원본 ‘' + A + '’'], 'APPLY 견적 비고 기록 ' + JSON.stringify(r.s1.memo));
      const r2 = await page.evaluate(async ({ l3, A, A2 }) => {
        // 이름이 다른 수정본 — 옛 견적(A)의 우수관을 바꾸고, 새 줄(실리콘)만 새 견적
        const res3 = await hjStmtApplySafe(DECIDE(PLAN(A2, l3)));
        const s3 = { replaced: res3.replaced.map(x => [x.project, x.from, x.to]), quotes: res3.quotes.map(q => [q.project, q.stmt.lines.map(l => l.work + ':' + l.amt)]), dup: res3.dupLines,
          gaLines: STMTQ('가온아파트', A).stmt.lines.map(l => l.amt), est: EST('가온아파트'), nare: EST('나래아파트'), n: state.quotes.length, ledA: LEDGER(A), ledA2: LEDGER(A2) };
        // 따로 더하기 · 넣지 않기
        const pAdd = DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-04', '가온아파트 101-1101', '육가 교체', 60000]]), { '육가 교체|60000': 'add' });
        const rAdd = await hjStmtApplySafe(pAdd);
        const pSkip = DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-05', '나래아파트 2-202', '변기 교체', 290000]]), { '변기 교체|290000': 'skip' });
        const before = SNAP(); const rSkip = await hjStmtApplySafe(pSkip);
        const s4 = { add: [rAdd.appended.length, rAdd.replaced.length, STMTQ('가온아파트', A).stmt.lines.map(l => l.amt)], skip: [rSkip.reviseSkipped, rSkip.quotes.length, rSkip.appended.length, rSkip.replaced.length, SNAP() === before] };
        // 공급가(부가세 따로) 견적 — +10%
        hjStmtApply(PLAN('S.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-02', '다솜빌라 2층', '수전 교체', 100000]], 'separate'));
        const rS = await hjStmtApplySafe(DECIDE(PLAN('S.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-02', '다솜빌라 2층', '수전 교체', 120000]], 'separate')));
        const ds = STMTQ('다솜빌라', 'S.xlsx');
        const s5 = { rep: rS.replaced.length, total: ds.stmt.total, calc: quoteCalc(ds).total, items: ds.items.map(i => i.price) };
        // 바꾸기만 하는 수정본(새 견적·붙인 줄 없음)도 만물 폴더 목록에서 '반영함'
        const A3 = '작업내역서초안_20261110_가상협력_수정2.xlsx';
        state.files.push({ id: 'fx_a3', name: A3, prefix: '작업내역서/', kind: 'other' });
        const pre = hjStmtFiles().find(x => x.f.id === 'fx_a3').applied;
        const r6 = await hjStmtApplySafe(DECIDE(PLAN(A3, [['작업내역서'], ['받는 분', '가상협력'], ['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 450000]])));
        const gq = STMTQ('가온아파트', A);
        const s6 = { pre, rep: r6.replaced.map(x => [x.from, x.to]), quotes: r6.quotes.length, post: hjStmtFiles().find(x => x.f.id === 'fx_a3').applied, file: gq.stmt.file, src: hjStmtSrcOf(gq),
          rev: (gq.stmt.revFiles || []).slice(), origApplied: hjStmtFiles().filter(x => x.f.id !== 'fx_a3').length, memo: gq.memo.split('\n').filter(x => /^\[금액 수정\]/.test(x)).length };
        // 통합 검토(v587) — 바꾸기만 한 수정본을 하나 더(수정3): 앞선 수정본(수정2)이 다시 '아직 안 넣음'이 되면 안 되고, 원본 파일 이름(stmt.file)은 그대로,
        // 이미 넣었던 옛 파일(수정2·원본)을 다시 넣으면 기본값으로 바꾸지 않는다(새 금액이 옛 금액으로 돌아간다)
        const A4 = '작업내역서초안_20261110_가상협력_수정3.xlsx', HEAD = [['작업내역서'], ['받는 분', '가상협력'], ['작업 날짜', '위치', '작업명', '작업비용']];
        const r7 = await hjStmtApplySafe(DECIDE(PLAN(A4, HEAD.concat([['2026-11-03', '가온아파트 101-1101', '우수관 교체', 460000]]))));
        const g7 = STMTQ('가온아파트', A);
        const again = (file, amt) => { const pl = PLAN(file, HEAD.concat([['2026-11-03', '가온아파트 101-1101', '우수관 교체', amt]])), row = hjStmtRevisions(pl.groups[0].lines, file, { projectOf: () => '가온아파트', to: pl.to }).rows[0]; return row ? [row.def, row.cands[0].block] : ['none', '']; };
        const s7 = { rep: r7.replaced.map(x => [x.from, x.to]), a3: hjStmtFiles().find(x => x.f.id === 'fx_a3').applied, file: g7.stmt.file, rev: (g7.stmt.revFiles || []).slice(),
          old3: again(A3, 450000), orig: again(A, 220000), next: again('작업내역서초안_20261110_가상협력_수정4.xlsx', 470000)[0] !== '', detail: hjStmtDetailData(A).file, lines: g7.stmt.lines.map(l => l.amt) };
        return { s3, s4, s5, s6, s7 };
      }, { l3: G(LINES3), A, A2 });
      Object.assign(r, r2);
      assert.deepEqual(r.s3.replaced, [['가온아파트', 330000, 440000]], 'REVISED file replaces the old quote ' + JSON.stringify(r.s3));
      assert.deepEqual(r.s3.quotes, [['가온아파트', ['실리콘 마감:30000']]], '수정본은 새 줄만 새 견적 ' + JSON.stringify(r.s3));
      assert.ok(r.s3.dup === 1 && JSON.stringify(r.s3.gaLines) === '[440000,50000]' && r.s3.est === 520000 && r.s3.nare === 270000 && r.s3.n === 3 && r.s3.ledA === 760000 && r.s3.ledA2 === 30000, 'REVISED totals ' + JSON.stringify(r.s3));
      assert.deepEqual(r.s4.add, [1, 0, [440000, 50000, 60000]], '따로 더하기는 예전처럼 한 줄 더 ' + JSON.stringify(r.s4));
      assert.deepEqual(r.s4.skip, [1, 0, 0, 0, true], '넣지 않기는 아무것도 안 바꿈 ' + JSON.stringify(r.s4));
      assert.deepEqual(r.s5, { rep: 1, total: 132000, calc: 132000, items: [120000] }, '공급가 견적 ' + JSON.stringify(r.s5));
      assert.deepEqual(r.s6, { pre: false, rep: [[440000, 450000]], quotes: 0, post: true, file: A, src: A, rev: [A, A2, '작업내역서초안_20261110_가상협력_수정2.xlsx'], origApplied: 0, memo: 3 }, 'APPLY 바꾸기만 한 수정본도 반영함 · 원본 이름 그대로 ' + JSON.stringify(r.s6));
      assert.ok(JSON.stringify(r.s7.rep) === '[[450000,460000]]' && r.s7.a3 === true && r.s7.file === A && r.s7.detail === A && JSON.stringify(r.s7.lines) === '[460000,50000,60000]', 'CHAIN 앞선 수정본 반영함 유지·원본 이름 ' + JSON.stringify(r.s7));
      assert.ok(r.s7.old3[0] === '' && /이미 넣었던 옛 파일/.test(r.s7.old3[1]) && r.s7.orig[0] === '' && /이미 넣었던 옛 파일/.test(r.s7.orig[1]), 'CHAIN 옛 파일 다시 넣으면 기본값 없음 ' + JSON.stringify(r.s7));
      assert.equal(r.s7.next, true, 'CHAIN 처음 보는 다음 수정본은 기본 바꾸기');
    });

    await test('③ 막음 — 안 고름·안전판·손으로 고친 견적·입금·미리보기 뒤 바뀜·같은 옛 줄 두 번 → 그대로 · 여럿 중 고른 줄만 (GUARD)', async () => {
      const r = await page.evaluate(async ({ l1, l2, A }) => {
        SEED_FN();
        hjStmtApply(PLAN(A, l1));
        hjStmtApply(PLAN('M.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 100000], ['2026-11-07', '다솜빌라 1층', '방수', 120000]]));
        const before = SNAP(), out = {};
        const tryIt = async (k, fn) => { try { await fn(); out[k] = 'applied'; } catch (e) { out[k] = e.message; } out[k + '_same'] = SNAP() === before; };
        await tryIt('undecided', () => hjStmtApplySafe(PLAN(A, l2)));                       // 고르지 않음
        await tryIt('nosnap', () => hjStmtApply(DECIDE(PLAN(A, l2))));                        // 안전판 없이 바로
        let snapCalls = 0; hjSnapshot = async () => { snapCalls++; return false; };
        await tryIt('snapfail', () => hjStmtApplySafe(DECIDE(PLAN(A, l2))));
        out.snapCalls = snapCalls; hjSnapshot = window.__realSnap;
        // 손으로 고친 견적 — 미리보기 기본값 대신 억지로 바꾸기
        const ga = STMTQ('가온아파트', A); ga.items[1].price += 1000;
        const editedBefore = SNAP(); let calls = 0; hjSnapshot = async () => { calls++; return true; };
        const pe = DECIDE(PLAN(A, l2), { '우수관 교체|330000': 0 });
        try { await hjStmtApplySafe(pe); out.edited = 'applied'; } catch (e) { out.edited = e.message; }
        out.edited_same = SNAP() === editedBefore; out.edited_snap = calls; hjSnapshot = window.__realSnap;
        ga.items[1].price -= 1000;
        // 입금 500,000 이 적힌 내역서(합계 540,000)를 330,000 으로 줄이면 막음
        state.payLog.push({ d: '2026-11-09', project: '가온아파트', amt: 500000, stmt: A });
        const paid0 = SNAP();
        const pDown = DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 10000]]));
        try { await hjStmtApplySafe(pDown); out.paid = 'applied'; } catch (e) { out.paid = e.message; }
        out.paid_same = SNAP() === paid0;
        // 미리보기를 연 뒤 옛 줄이 바뀜(다른 창에서 고침)
        const ps = DECIDE(PLAN(A, l2)); ga.stmt.lines[0].amt = 230000;
        const stale0 = SNAP();
        try { await hjStmtApplySafe(ps); out.stale = 'applied'; } catch (e) { out.stale = e.message; }
        out.stale_same = SNAP() === stale0; ga.stmt.lines[0].amt = 220000;
        // 옛 줄 하나에 새 줄 둘 — 둘 다 바꾸기면 막음
        const p2 = PLAN('M3.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 300000], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 310000]]);
        const rv2 = hjStmtRevisions(p2.groups[0].lines, 'M3.xlsx');
        out.twoNew = rv2.rows.map(x => [x.sure, x.def, x.cands.length]);
        const tw = DECIDE(p2, { '우수관 교체|300000': 0, '우수관 교체|310000': 0 }), tw0 = SNAP();
        try { await hjStmtApplySafe(tw); out.twice = 'applied'; } catch (e) { out.twice = e.message; }
        out.twice_same = SNAP() === tw0;
        // 여럿 중 고른 줄(120,000)만 바꿈
        const pm = DECIDE(PLAN('M2.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 150000]]), { '방수|150000': 1 });
        const rm = await hjStmtApplySafe(pm);
        out.amb = [rm.replaced.map(x => [x.from, x.to]), STMTQ('다솜빌라', 'M.xlsx').stmt.lines.map(l => l.amt), EST('다솜빌라'), rm.quotes.length];
        return out;
      }, { l1: G(LINES1), l2: G(LINES2), A });
      assert.ok(/골라 주세요/.test(r.undecided) && r.undecided_same, 'GUARD undecided ' + JSON.stringify(r));
      assert.ok(/안전판/.test(r.nosnap) && r.nosnap_same, 'GUARD no snapshot ' + JSON.stringify(r));
      assert.ok(/안전판을 만들지 못해/.test(r.snapfail) && r.snapfail_same && r.snapCalls === 1, 'GUARD snapshot fail ' + JSON.stringify(r));
      assert.ok(/손으로 고친/.test(r.edited) && r.edited_same && r.edited_snap === 0, 'GUARD hand-edited (막힐 것은 안전판 전에) ' + JSON.stringify(r));
      assert.ok(/입금/.test(r.paid) && r.paid_same, 'GUARD payment ' + JSON.stringify(r));
      assert.ok(/다시 열어/.test(r.stale) && r.stale_same, 'GUARD stale preview ' + JSON.stringify(r));
      assert.deepEqual(r.twoNew, [[false, '', 1], [false, '', 1]], '옛 줄 하나에 새 줄 둘 — 기본값 없음');
      assert.ok(/두 번/.test(r.twice) && r.twice_same, 'GUARD one old line paired once ' + JSON.stringify(r));
      assert.deepEqual(r.amb, [[[120000, 150000]], [100000, 150000], 250000, 0], 'GUARD chosen candidate only ' + JSON.stringify(r.amb));
      const g2 = await page.evaluate(async ({ l1, A }) => {
        const out = {};
        const tryIt = async (k, fn) => { const b = SNAP(); try { const res = await fn(); out[k] = 'applied ' + res.replaced.length; } catch (e) { out[k] = e.message; } out[k + '_same'] = SNAP() === b; };
        // 입금은 현장마다 나눠 적힌다 — 가온 135,000 · 나래 135,000. 가온만 70,000 으로 줄이면 내역서 전체(340,000 ≥ 270,000)는 괜찮아도 가온은 더 받은 채로 남는다
        SEED_FN(); hjStmtApply(PLAN(A, l1));
        hjStmtPayApply(A, { amt: 270000, d: '2026-11-09' });
        out.split = state.payLog.map(x => [x.project, x.amt]);
        await tryIt('proj', () => hjStmtApplySafe(DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 20000]]))));
        // 가온 135,000 보다 크게 줄이는 것은 된다
        await tryIt('projOk', () => hjStmtApplySafe(DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 200000]]))));
        out.projOkTotals = [hjProjStmtData(state.projects[0]).left, LEDGER(A)];
        // 집계 제외 견적은 입금 대조에서 뺀다(장부와 같은 셈) — 나래(집계 제외)로 적힌 300,000 이 가온 새 합계 250,000 보다 크다
        SEED_FN(); hjStmtApply(PLAN(A, l1));
        STMTQ('나래아파트', A).exSum = true;
        state.payLog.push({ d: '2026-11-09', project: '나래아파트', amt: 300000, stmt: A });
        await tryIt('exsum', () => hjStmtApplySafe(DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 200000]]))));
        // 손으로 고친 견적 — 품목 이름만 고침(합 같음) · 품목 순서를 바꿈(합 같음) · 품목 사이 금액을 옮김(합 같음)
        SEED_FN(); hjStmtApply(PLAN(A, l1));
        const ga = STMTQ('가온아파트', A), pick = () => DECIDE(PLAN(A, [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-03', '가온아파트 101-1101', '우수관 교체', 330000]]), { '우수관 교체|330000': 0 });
        const n0 = ga.items[0].name; ga.items[0].name = n0 + ' 외';
        await tryIt('rename', () => hjStmtApplySafe(pick())); ga.items[0].name = n0;
        ga.items.reverse(); await tryIt('swap', () => hjStmtApplySafe(pick())); ga.items.reverse();
        ga.items[0].price -= 10000; ga.items[1].price += 10000; await tryIt('shift', () => hjStmtApplySafe(pick())); ga.items[0].price += 10000; ga.items[1].price -= 10000;
        // 견적 작성 화면에 그 견적이 열려 있음
        state.editingQuote = JSON.parse(JSON.stringify(ga)); await tryIt('editing', () => hjStmtApplySafe(pick())); state.editingQuote = null;
        await tryIt('ok', () => hjStmtApplySafe(pick()));
        return out;
      }, { l1: G(LINES1), A });
      assert.deepEqual(g2.split, [['가온아파트', 135000], ['나래아파트', 135000]], 'GUARD2 입금 나눔 ' + JSON.stringify(g2));
      assert.ok(/가온아파트 에 이미 적힌 입금 135,000원이 이 현장의 새 합계 70,000원보다/.test(g2.proj) && g2.proj_same, 'GUARD2 현장별 입금 ' + JSON.stringify(g2));
      assert.ok(g2.projOk === 'applied 1' && JSON.stringify(g2.projOkTotals) === '[115000,520000]', 'GUARD2 현장 합계보다 작은 입금은 막지 않음 ' + JSON.stringify(g2));
      assert.ok(/입금 300,000원이 새 합계 250,000원보다/.test(g2.exsum) && g2.exsum_same, 'GUARD2 집계 제외 견적은 대조에서 뺌 ' + JSON.stringify(g2));
      assert.ok(/품목 이름·수량이 내역서 줄과 달라요/.test(g2.rename) && g2.rename_same && /품목 이름·수량이 내역서 줄과 달라요/.test(g2.swap) && g2.swap_same, 'GUARD2 품목 이름·순서 ' + JSON.stringify(g2));
      assert.ok(/품목 금액을 손으로 고쳤어요/.test(g2.shift) && g2.shift_same, 'GUARD2 품목 사이 금액 ' + JSON.stringify(g2));
      assert.ok(/견적 작성 화면에 가온아파트 견적이 열려 있어요/.test(g2.editing) && g2.editing_same && g2.ok === 'applied 1', 'GUARD2 작성 중 견적 ' + JSON.stringify(g2));
    });

    await test('④ 화면 — ✏️ 줄 기본 바꾸기·없는 줄·옛 작성 월 알림 · 다른 현장이면 기본값 없음 · 창을 연 뒤 바뀜 막음 → [반영] · 여럿이면 안 고르면 막음 → 고르면 반영 · 반영 중 잠김 · 폰 390·44px·16px (UI)', async () => {
      await page.evaluate(({ l1, A }) => { SEED_FN(); hjStmtApply(PLAN(A, l1)); hjStmtApply(PLAN('M.xlsx', [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 100000], ['2026-11-07', '다솜빌라 1층', '방수', 120000]])); state.tab = 'quotemaker'; render(); }, { l1: G(LINES1), A });
      // 가짜 엑셀로 파일 읽기 경로까지
      await page.evaluate(async ({ l2, A }) => {
        window.XLSX = { read: u8 => ({ SheetNames: ['작업내역서'], Sheets: { '작업내역서': JSON.parse(new TextDecoder().decode(u8)) } }), utils: { sheet_to_json: ws => ws } };
        hjStmtReview(await hjStmtReadFile(new File([JSON.stringify(l2)], A)));
      }, { l2: G(LINES2), A });
      await page.waitForSelector('#modalRoot [data-stmt-rev]');
      const ui = await page.evaluate(() => ({ rows: document.querySelectorAll('#modalRoot [data-stmt-revrow]').length, val: document.querySelector('#modalRoot [data-stmt-rev]').value, missing: (document.querySelector('#modalRoot [data-stmt-missing]') || {}).textContent || '',
        note: document.querySelector('#modalRoot [data-stmt-note="0"]').textContent, sum: document.querySelector('#modalRoot #stmtSummary').textContent,
        opts: [...document.querySelectorAll('#modalRoot [data-stmt-rev] option')].map(o => o.textContent) }));
      assert.equal(ui.rows, 1);
      assert.match(ui.val, /^r:/, '기본 바꾸기 ' + JSON.stringify(ui));
      assert.ok(/새 파일에 없는 줄 1개/.test(ui.missing) && /변기 교체/.test(ui.missing), 'missing notice ' + JSON.stringify(ui));
      assert.ok(/금액만 바뀐 줄 1개/.test(ui.note) && /금액 바꾸는 줄 1개\(줄 금액 \+110,000원\)/.test(ui.sum), 'note/summary ' + JSON.stringify(ui));
      assert.deepEqual(ui.opts.map(t => t.split(' — ')[0]), ['새 금액으로 바꾸기', '따로 더하기', '넣지 않기']);
      const phone = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, modalOver: (() => { const m = document.querySelector('#modalRoot .modal'); return m.scrollWidth - m.clientWidth; })(),
        sel: [...document.querySelectorAll('#modalRoot [data-stmt-rev]')].map(s => [Math.round(s.getBoundingClientRect().height), getComputedStyle(s).fontSize]),
        small: [...document.querySelectorAll('#modalRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim()) }));
      assert.ok(phone.over <= 1 && phone.modalOver <= 1 && phone.sel.every(([h, f]) => h >= 44 && f === '16px') && !phone.small.length, 'phone 390 ' + JSON.stringify(phone));
      assert.match(ui.sum, /옛 작성일\(2026-11\) 매출이 바뀝니다/, '옛 작성 월 알림 ' + JSON.stringify(ui));
      // 그 위치를 다른 현장으로 고르면 기본 '바꾸기'를 거둔다(사람이 고른다) → 되돌리면 다시 기본 '바꾸기'
      await page.selectOption('#modalRoot [data-stmt-proj="0"]', '다솜빌라');
      const other = await page.evaluate(() => ({ val: document.querySelector('#modalRoot [data-stmt-rev]').value, row: document.querySelector('#modalRoot [data-stmt-revrow]').textContent,
        opt: [...document.querySelectorAll('#modalRoot [data-stmt-rev] option')].map(o => o.textContent).find(t => /^새 금액으로 바꾸기/.test(t)) }));
      assert.ok(other.val === '' && /고른 현장\(다솜빌라\)과 다른 현장의 견적이라 골라 주세요/.test(other.row) && /고른 현장과 다름/.test(other.opt), 'UI 다른 현장이면 기본값 없음 ' + JSON.stringify(other));
      await page.selectOption('#modalRoot [data-stmt-proj="0"]', '가온아파트');
      assert.match(await page.inputValue('#modalRoot [data-stmt-rev]'), /^r:/, 'UI 되돌리면 기본 바꾸기');
      // 창을 연 뒤 그 옛 줄이 바뀌었으면(다른 기기에서 고침) [반영]이 막는다 — 화면에 보인 옛 금액(220,000)으로 대조
      const stale0 = await page.evaluate(A => { const ga = STMTQ('가온아파트', A); ga.stmt.lines[0].amt = 230000; hjStmtReprice(ga); return SNAP(); }, A);
      await page.click('#modalRoot .mfoot button.blue');
      await page.waitForFunction(() => /다시 열어/.test(document.getElementById('toast').textContent) || !document.querySelector('#modalRoot .stmt-review'));
      const st = await page.evaluate(b => ({ open: !!document.querySelector('#modalRoot .stmt-review'), same: SNAP() === b, toast: document.getElementById('toast').textContent }), stale0);
      assert.ok(st.open && st.same && /다시 열어/.test(st.toast), 'UI 창을 연 뒤 바뀐 옛 줄 → 막고 자료 그대로 ' + JSON.stringify(st));
      await page.evaluate(A => { const ga = STMTQ('가온아파트', A); ga.stmt.lines[0].amt = 220000; hjStmtReprice(ga); }, A);
      await page.click('#modalRoot .mfoot button.blue');
      await page.waitForFunction(() => !document.querySelector('#modalRoot .stmt-review'));
      const done = await page.evaluate(async () => ({ est: EST('가온아파트'), n: state.quotes.length, toast: document.getElementById('toast').textContent, snap: (await idbGetStrict('hj_snaps')).slice(-1)[0].label }));
      assert.ok(done.est === 380000 && done.n === 3 && /금액 바꾼 줄 1개/.test(done.toast) && done.snap === '작업내역서 금액 수정 전', 'UI applied ' + JSON.stringify(done));
      // 여럿 — 안 고르면 반영 안 함
      await page.evaluate(() => hjStmtReview(hjStmtParse([{ name: 's', grid: [['작업 날짜', '위치', '작업명', '작업비용'], ['2026-11-07', '다솜빌라 1층', '방수', 150000]] }], 'M2.xlsx')));
      await page.waitForSelector('#modalRoot [data-stmt-rev]');
      const before = await page.evaluate(() => SNAP());
      assert.equal(await page.inputValue('#modalRoot [data-stmt-rev]'), '', '여럿이면 기본값 없음');
      assert.match(await page.textContent('#modalRoot [data-stmt-revrow]'), /같은 줄이 여럿이라 골라야 해요/);
      await page.click('#modalRoot .mfoot button.blue');
      await page.waitForFunction(() => /골라 주세요/.test(document.getElementById('toast').textContent));
      assert.ok(await page.evaluate(b => !!document.querySelector('#modalRoot .stmt-review') && SNAP() === b, before), '안 고르면 창이 남고 자료 그대로');
      const second = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-stmt-rev] option')].map(o => o.value)[2]);
      await page.selectOption('#modalRoot [data-stmt-rev]', second);
      assert.match(await page.textContent('#modalRoot #stmtSummary'), /금액 바꾸는 줄 1개\(줄 금액 \+30,000원\)/);
      // 반영 중(안전판을 찍는 동안)에는 Esc 로 창이 닫히지 않고 단추가 잠긴다
      await page.evaluate(() => { window.__snapN = 0; hjSnapshot = () => { window.__snapN++; return new Promise(res => { window.__snapRes = res; }); }; });
      await page.click('#modalRoot .mfoot button.blue');
      await page.waitForFunction(() => window.__snapN === 1);
      await page.keyboard.press('Escape');
      const busy = await page.evaluate(() => ({ open: !!document.querySelector('#modalRoot .stmt-review'), disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].every(b => b.disabled), n: window.__snapN }));
      assert.deepEqual(busy, { open: true, disabled: true, n: 1 }, 'UI 반영 중 잠김 ' + JSON.stringify(busy));
      await page.evaluate(() => window.__snapRes(true));
      await page.waitForFunction(() => !document.querySelector('#modalRoot .stmt-review'));
      await page.evaluate(() => { hjSnapshot = window.__realSnap; });
      assert.deepEqual(await page.evaluate(() => [STMTQ('다솜빌라', 'M.xlsx').stmt.lines.map(l => l.amt), EST('다솜빌라')]), [[100000, 150000], 250000]);
    });

    await test('⑤ 핀 3곳 서로 같음 · 오류 0 · 바깥 쓰기 0', async () => {
      const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
      assert.ok(pin[0] && pin[0] === pin[1] && pin[0] === pin[2], 'pins ' + JSON.stringify(pin));
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtrevise-v583: ${passed}/5 PASS; synthetic data · fixed clock · fake xlsx; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtrevise-v583 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

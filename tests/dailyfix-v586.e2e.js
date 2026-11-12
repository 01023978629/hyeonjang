/* v586 🤖 오늘 챙길 일 바로잡기 — ① 여러 날 공정의 이어지는 날도 '오늘 일정'에 · ② '현장 미연결 견적' 줄은 ✍ 견적 작성 탭의 그 카드로
   문제(기준선): '🗓 오늘 일정 n건'이 date===오늘만 세어 3일짜리 공정 둘째·셋째 날에 빠졌다(📅 오늘 일정·📋 내 업무는 v354 부터 넣음 — 같은 줄을
   한눈 보기 hjGlanceCache·AI 비서 daily_check 도 쓴다). '🧾 현장 미연결 견적' 줄은 견적·정산 탭으로 갔는데 현장 없는 앱 견적은 가상 견적 파일이
   없어 거기 없고, 내역서 탭이 켜진 기기(v565)에서는 📑 내역서 화면이 떠서 막다른 길이었다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-11(수) 10:00 고정, 바깥 쓰기 0.
   ① 오늘 일정 = 오늘 시작 + 이어지는 날(완료 보고·일요일 제외) · 첫 줄 '(2/3일째)' · 한눈 보기·AI daily_check 같은 목록 · 💰 은 예전처럼 셈 (CONT)
   ② 미연결 견적 줄 → ✍ 견적 작성 탭 · 그 카드만 표시(종결·빈 견적·현장 연결 견적엔 없음) · 화면 안 · 테두리 · 내역서 탭이 켜져 있어도 · 읽기만 (UNLINKED)
   ③ 작성 중(저장 안 한) 견적은 버리지 않는다 — '30일 넘은 협력사 미수' 줄(v536)도 · 직원 모드엔 틀린 '없어요' 알림 없음 · 미수 줄은 그 협력사 줄로 ·
      폰 390 넘침 없음 · 줄 무게·다른 줄 그대로 · 페이지 오류 0 · 외부 쓰기 0 (SAFE)
   ④ 같은 '오늘 일정' 수 — 🤖 줄·하단 캘린더 배지·☀️ 오늘의 브리핑 칩·🌅 브리핑(aiBriefData)·📊 경영 현황·날씨 주의 모음이 이어지는 날을 같이 셈 ·
      🌅 오늘의 브리핑 창이 TypeError 없이 열림(v564 뒤 시공중현장이 없어 죽던 것) · AI morning_brief 도 (COUNT)
   HJ_V586_BASELINE=<commit> 은 ① 에서, HJ_V586_MUTATION=no-cont(이어지는 날을 안 더함)는 ①, back-estimates(예전처럼 견적·정산 탭)·no-focus 는 ②,
   staff-toast·dun-wipe 는 ③, badge-old·brief-old·daily-brief-old·wx-old·morning-crash 는 ④ 에서 실패해야 한다. */
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
  'no-cont': ['return (state.schedule||[]).filter(s=>s&&s.date===d).map(s=>({s,c:null})).concat(hjSchContinuing(d))', 'return (state.schedule||[]).filter(s=>s&&s.date===d).map(s=>({s,c:null}))'],
  'back-estimates': ['act:"hjQuoteUnlinkedOpen()",w:5', "act:\"state.tab='estimates';render()\",w:5"],
  'no-focus': ["el.setAttribute('tabindex','-1');try{el.focus({preventScroll:true});}catch(_){}", ''],
  'staff-toast': ["render();\n  if(state.tab!=='quotemaker')return false;\n", 'render();\n'],
  'dun-wipe': ['act:"hjStmtDunOpen()",w:2.8', "act:\"state.tab='quotemaker';state.editingQuote=null;render()\",w:2.8"],
  'badge-old': ["setBadge('schedule',hjTodaySchRows(localDate()).length,", "setBadge('schedule',(state.schedule||[]).filter(s=>s&&s.date===localDate()).length,"],
  'brief-old': ['const ts=hjDaySchView(today).sort(', "const ts=(state.schedule||[]).filter(s=>s.date===today).sort("],
  'daily-brief-old': ['const todaySch=hjDaySchView(today).sort(byTime);', 'const todaySch=sch.filter(s=>s&&s.date===today).slice().sort(byTime);'],
  'wx-old': ["const sch=hjDaySchView(dateStr,s=>!/^💰/.test(s.title||''));", "const sch=(state.schedule||[]).filter(s=>s.date===dateStr&&!/^💰/.test(s.title||''));"],
  'morning-crash': ["+doing+'곳</div></div>'+", "+d.시공중현장.length+'곳</div></div>'+"]
};
let html = process.env.HJ_V586_BASELINE ? execFileSync('git', ['show', process.env.HJ_V586_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V586_MUTATION) {
  const m = MUT[process.env.HJ_V586_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V586_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS dailyfix-v586 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile, isMobile: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_morning_shown', '2026-11-11');
    window.__v586 = { toasts: [] };
  });
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    const realToast = toast; toast = m => { __v586.toasts.push(String(m)); return realToast(m); };
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const P = (name, stage) => ({ name, stage: stage == null ? 2 : stage, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래빌라'), P('다솜상가', 0)];
  state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.asLog = []; state.workLogs = []; state._demo = false; state.dirHandle = null;
  state.goals = { salesBasis: 'stmt' };   // v565 내역서 탭이 켜진 기기 — 견적·정산 탭 자리가 📑 내역서
  __tabStale = false; state.editingQuote = null;
  const S = (id, date, time, title, extra) => Object.assign({ id, date, time, title, project: '', workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [
    S('MULTI', '2026-11-10', '09:00', '타일 (3일차 시작)', { project: '가온아파트', memo: '2026-11-10~2026-11-12 (3일)' }),
    S('DONE3', '2026-11-10', '08:00', '도배 (3일차 시작)', { project: '나래빌라', memo: '2026-11-10~2026-11-12 (3일)', report: { progress: '완료', done: '도배 끝' } }),
    S('TODAY', '2026-11-11', '13:00', '실리콘 보수', { project: '나래빌라', hours: 0 }),
    S('MONEY', '2026-11-11', undefined, '💰 수금: 나래빌라', { project: '나래빌라', hours: 0 }),
    S('LATER', '2026-11-12', '09:00', '줄눈', { project: '가온아파트', hours: 0 })];
  const item = (name, qty, price) => ({ name, spec: '', qty, price });
  const Q = (id, title, extra) => Object.assign({ id, title, no: '제20261101-' + id, date: '2026-11-01', place: '', vatIncluded: true, accountIdx: 0, memo: '', project: null, items: [item('철거', 1, 300000)] }, extra || {});
  state.quotes = [
    Q('QW1', '가온 욕실 견적', { project: '가온아파트' }), Q('QW2', '가온 주방 견적', { project: '가온아파트' }), Q('QW3', '나래 도배 견적', { project: '나래빌라' }),
    Q('QW4', '나래 바닥 견적', { project: '나래빌라' }), Q('QW5', '나래 창호 견적', { project: '나래빌라' }), Q('QW6', '가온 현관 견적', { project: '가온아파트' }),
    Q('QL', '종결된 미연결 견적', { result: 'lost', lost: { at: '2026-11-02', reason: '가격' } }),
    Q('QE', '빈 미연결 견적', { items: [item('', 1, 0)] }),
    Q('QU', '테스트 미연결 견적', { items: [item('방수', 1, 450000)] })];
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
};
const snap = page => page.evaluate(async () => { clearTimeout(__idbSaveTimer); const live = serializeData(); live.savedAt = ''; return paidStableJson(live); });

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    await test('① 오늘 일정 = 오늘 시작 + 이어지는 날 · 첫 줄 (2/3일째) · 한눈 보기·AI daily_check 같은 목록 (CONT)', async () => {
      const r = await page.evaluate(async () => {
        const items = dailyCheckData(), sch = items.find(i => i.ic === '🗓');
        hjGlanceCache(items); const g = JSON.parse(localStorage.getItem('hj_glance') || '{}');
        const ai = await aiToolRun('daily_check', {});
        return { sch: sch && sch.t, act: sch && sch.act, w: sch && sch.w, glance: { n: g.schN, sch: g.sch, check: g.check }, ai: (ai.목록 || []).find(x => x.startsWith('🗓')) || '' };
      });
      assert.equal(r.sch, '오늘 일정 3건 — 09:00 타일 (2/3일째) @가온아파트', '이어지는 날 포함 · 완료 보고된 공정·내일 일정 제외 · 💰 은 예전처럼 — ' + r.sch);
      assert.equal(r.act, "state.tab='schedule';render()"); assert.equal(r.w, 2, '줄 무게 그대로');
      assert.equal(r.glance.n, 3, '한눈 보기 수도 같은 목록 — ' + JSON.stringify(r.glance));
      assert.deepEqual(r.glance.sch, ['09:00 타일 (2/3일째) @가온아파트', '13:00 실리콘 보수 @나래빌라'], JSON.stringify(r.glance.sch));
      assert.equal(r.ai, '🗓 ' + r.sch, 'AI 비서 daily_check 도 같은 줄');
      const d = await page.evaluate(() => ({
        d12: hjTodaySchRows('2026-11-12').map(x => [x.s.id, x.c ? x.c.day + '/' + x.c.days : '']),
        d13: hjTodaySchRows('2026-11-13').map(x => x.s.id),
        sun: (() => { state.schedule.push({ id: 'WKND', date: '2026-11-14', time: '09:00', title: '목공 (3일차 시작)', project: '가온아파트', memo: '2026-11-14~2026-11-17 (3일)', hours: 8, report: null });
          const out = [hjTodaySchRows('2026-11-15').map(x => x.s.id), hjTodaySchRows('2026-11-16').map(x => [x.s.id, x.c ? x.c.day + '/' + x.c.days : ''])]; state.schedule.pop(); return out; })()
      }));
      assert.deepEqual(d.d12, [['LATER', ''], ['MULTI', '3/3']], '셋째 날 · 같은 시각이면 시작하는 일정 먼저(예전 정렬) — ' + JSON.stringify(d.d12));
      assert.deepEqual(d.d13, [], '끝난 다음 날은 없음');
      assert.deepEqual(d.sun, [[], [['WKND', '2/3']]], '일요일은 이어지는 날이 아님 — ' + JSON.stringify(d.sun));
    });
    await test('② 미연결 견적 줄 → ✍ 견적 작성 탭의 그 카드(화면 안·테두리) · 내역서 탭이 켜져 있어도 · 읽기만 (UNLINKED)', async () => {
      const item = await page.evaluate(() => { const it = dailyCheckData().find(i => i.ic === '🧾'); return it && { t: it.t, w: it.w }; });
      // v589 이 기기는 매출 기준이 작업내역서(salesBasis 'stmt') — 미연결 견적은 연결해도 매출이 아니라 현장 견적 합계에 들어간다(끈 기기는 예전 글 '매출 반영')
      assert.deepEqual(item, { t: '현장 미연결 견적 1건 — 연결하면 현장 견적 합계에 반영', w: 5 }, '종결·빈 견적은 세지 않음(예전 그대로)');
      assert.equal(await page.evaluate(() => hjStmtTabOn()), true, '내역서 탭이 켜진 기기');
      await page.evaluate(() => { state.tab = 'dashboard'; render(); scrollTo(0, 0); });
      const before = await snap(page);
      const row = page.locator('#view button', { hasText: '현장 미연결 견적 1건' });
      assert.equal(await row.count(), 1, '🤖 오늘 챙길 일 카드에 줄');
      await row.click();
      const r = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#view [data-qcard-unlinked]')], el = cards[0], b = el && el.getBoundingClientRect();
        return { tab: state.tab, editing: state.editingQuote, stmtView: !!document.querySelector('#view [data-stmt-view]'), ids: cards.map(c => c.dataset.qcardUnlinked),
          title: el ? el.querySelector('.nm').textContent.trim() : '', outline: el ? el.style.outline : '', inView: !!b && b.top >= 0 && b.bottom <= innerHeight, total: document.querySelectorAll('#view .card').length,
          focus: !!el && document.activeElement === el && el.getAttribute('tabindex') === '-1' };
      });
      assert.equal(r.tab, 'quotemaker', '✍ 견적 작성 탭으로 — ' + JSON.stringify(r));
      assert.equal(r.editing, null); assert.equal(r.stmtView, false, '📑 내역서 화면이 아님');
      assert.deepEqual(r.ids, ['QU'], '표시는 진행 중인 현장 미연결 견적에만(종결·빈 견적·연결 견적 없음)');
      assert.equal(r.title, '테스트 미연결 견적'); assert.ok(r.total >= 9, '카드 9장');
      assert.match(r.outline, /solid/, '잠깐 테두리'); assert.ok(r.inView, '그 카드가 화면 안');
      assert.equal(r.focus, true, '초점도 그 카드로(키보드·화면읽기) — QCARD_FOCUS');
      await page.waitForFunction(() => { const el = document.querySelector('#view [data-qcard-unlinked]'); return el && !el.style.outline; }, null, { timeout: 4000 });
      assert.equal(await snap(page), before, '읽기만 — 저장 자료 그대로');
      const m = await page.evaluate(() => { const g = hjQuoteUnlinkedOk; return [g(state.quotes.find(q => q.id === 'QU')), g(state.quotes.find(q => q.id === 'QL')), g(state.quotes.find(q => q.id === 'QE')), g(state.quotes.find(q => q.id === 'QW1'))]; });
      assert.deepEqual(m, [true, false, false, false]);
    });
    await test('③ 작성 중 견적은 버리지 않음(미수 줄도) · 없으면 알림 · 직원 모드엔 틀린 알림 없음 · 미수 줄은 그 협력사로 · 폰 390 넘침 없음 (SAFE)', async () => {
      const r = await page.evaluate(() => {
        const q = newQuote(); q.title = '작성 중 견적'; q.items = [{ name: '타일', spec: '', qty: 2, price: 50000 }];
        state.editingQuote = q; state.tab = 'dashboard'; render(); __v586.toasts = [];
        const ok = hjQuoteUnlinkedOpen();
        const out = { ok, tab: state.tab, kept: state.editingQuote === q, toast: __v586.toasts.slice(-1)[0] || '' };
        state.editingQuote = null; state.quotes = state.quotes.filter(x => x.id !== 'QU'); __v586.toasts = [];
        out.none = hjQuoteUnlinkedOpen(); out.noneToast = __v586.toasts.slice(-1)[0] || ''; out.item = dailyCheckData().some(i => i.ic === '🧾');
        return out;
      });
      assert.deepEqual([r.ok, r.tab, r.kept], [false, 'quotemaker', true], '저장 안 한 견적은 그대로 — ' + JSON.stringify(r));
      assert.match(r.toast, /작성 중인 견적/);
      assert.equal(r.none, false); assert.match(r.noneToast, /현장 미연결 견적이 없어요/); assert.equal(r.item, false, '없으면 줄도 없음');
      // 직원 모드 — render 가 대시보드로 돌리며 띄운 알림만 남는다(사실과 다른 '없어요'로 덮지 않음)
      const st = await page.evaluate(() => {
        state.quotes.push({ id: 'QS', title: '직원 모드 미연결 견적', no: 'NS', date: '2026-11-01', vatIncluded: true, accountIdx: 0, memo: '', project: null, items: [{ name: '방수', spec: '', qty: 1, price: 300000 }] });
        localStorage.setItem(HJ_STAFF_KEY, 'staff'); state.tab = 'dashboard'; __v586.toasts = [];
        const ok = hjQuoteUnlinkedOpen(), out = { ok, tab: state.tab, toasts: __v586.toasts.slice() };
        localStorage.removeItem(HJ_STAFF_KEY); state.quotes = state.quotes.filter(q => q.id !== 'QS'); state.tab = 'dashboard'; render(); return out;
      });
      assert.deepEqual(st, { ok: false, tab: 'dashboard', toasts: ['👷 직원 모드에서는 견적·정산·회계를 볼 수 없어요'] }, "직원 모드엔 '없어요' 알림 없음 — STAFF_NO_FALSE_TOAST " + JSON.stringify(st));
      // v536 '30일 넘은 협력사 미수' 줄 — 작성 중 견적을 버리지 않고, 아니면 📑 장부의 30일 넘은 협력사 줄로(초점·테두리)
      const dn = await page.evaluate(() => {
        const mk = (src, to, date, project, amt) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: [{ d: date, loc: project + ' 작업', work: '작업', amt }] }); state.quotes.push(q); syncQuoteToProject(q); };
        mk('TEST-새.xlsx', 'TEST큰협력', '2026-11-01', '가온아파트', 900000); mk('TEST-옛.xlsx', 'TEST옛협력', '2026-09-20', '나래빌라', 150000);
        const it = dailyCheckData().find(x => x.ic === '📑');
        const q = newQuote(); q.title = '작성 중 견적 2'; q.items = [{ name: '타일', spec: '', qty: 1, price: 70000 }];
        state.editingQuote = q; state.tab = 'dashboard'; render(); __v586.toasts = [];
        (0, eval)(it.act);
        const kept = { tab: state.tab, kept: state.editingQuote === q, toast: __v586.toasts.slice(-1)[0] || '' };
        state.editingQuote = null; state.tab = 'dashboard'; render(); __v586.toasts = [];
        (0, eval)(it.act);
        const el = document.activeElement;
        return { act: it.act, t: it.t, kept, go: { tab: state.tab, to: el && el.dataset ? el.dataset.stmtDun || '' : '', outline: el && el.style ? el.style.outline : '', toasts: __v586.toasts.slice() } };
      });
      assert.deepEqual([dn.kept.tab, dn.kept.kept], ['quotemaker', true], "작성 중 견적은 그대로 — DUN_KEEP_DRAFT " + JSON.stringify(dn.kept));
      assert.match(dn.kept.toast, /작성 중인 견적.*📑 장부를/);
      assert.equal(dn.act, 'hjStmtDunOpen()', JSON.stringify(dn));
      assert.deepEqual([dn.go.tab, dn.go.to], ['quotemaker', 'TEST옛협력'], '30일 넘은 협력사 줄로 — ' + JSON.stringify(dn.go));
      assert.match(dn.go.outline, /solid/); assert.deepEqual(dn.go.toasts, []);
      const data = await page.evaluate(() => JSON.parse(JSON.stringify({ projects: state.projects, schedule: state.schedule, goals: state.goals })));
      await context.close();
      const m = await open(390, true);
      const w = await m.page.evaluate(d => {
        Object.assign(state, { projects: d.projects, schedule: d.schedule, goals: d.goals, files: [], notes: [], editingQuote: null });
        const it = (n, p) => ({ name: n, spec: '', qty: 1, price: p });
        state.quotes = Array.from({ length: 6 }, (_, i) => ({ id: 'L' + i, title: '연결 견적 ' + i, no: 'N' + i, date: '2026-11-01', vatIncluded: true, accountIdx: 0, memo: '', project: '가온아파트', items: [it('철거', 100000)] }))
          .concat([{ id: 'QU2', title: '아주 긴 이름의 현장 미연결 견적 — 폰에서도 줄바꿈되어야 하는 제목', no: 'N9', date: '2026-11-01', vatIncluded: true, accountIdx: 0, memo: '', project: null, items: [it('방수', 300000)] }]);
        state.tab = 'dashboard'; render(); scrollTo(0, 0);
        const btn = [...document.querySelectorAll('#view button')].find(b => /현장 미연결 견적 1건/.test(b.textContent));
        const bh = btn ? btn.getBoundingClientRect().height : 0; if (btn) btn.click();
        const el = document.querySelector('#view [data-qcard-unlinked]'), b = el && el.getBoundingClientRect();
        return { found: !!btn, bh, tab: state.tab, id: el && el.dataset.qcardUnlinked, inView: !!b && b.top >= 0 && b.bottom <= innerHeight, over: document.documentElement.scrollWidth - innerWidth };
      }, data);
      assert.ok(w.found && w.tab === 'quotemaker' && w.id === 'QU2' && w.inView, '폰에서도 그 카드로 — ' + JSON.stringify(w));
      assert.ok(w.over <= 1, '폰 가로 넘침 없음 — ' + JSON.stringify(w));
      await m.context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await test('④ 같은 오늘 일정 수 — 배지·☀️ 칩·🌅 브리핑·경영 현황·날씨 주의 · 🌅 오늘의 브리핑 창이 열림 (COUNT)', async () => {
      const m = await open(390, true);
      try {
        await m.page.evaluate(SEED);
        const r = await m.page.evaluate(async () => {
          state.tab = 'dashboard'; render();
          const badge = (document.querySelector('.mnav-btn[data-mnav="schedule"]') || {}).getAttribute ? document.querySelector('.mnav-btn[data-mnav="schedule"]').getAttribute('aria-label') : '';
          const daily = (dailyCheckData().find(i => i.ic === '🗓') || {}).t || '';
          const b = hjDailyBrief(), ai = aiBriefData(), biz = bizDashData();
          const chip = ((document.querySelector('#view .brief-card') || {}).textContent || '').match(/📅 오늘 일정 (\d+)/);
          const text = hjDailyBriefText();
          state.schedule.push({ id: 'WXM', date: '2026-11-10', time: '07:00', title: '옥상 방수 (3일차 시작)', project: '가온아파트', memo: '2026-11-10~2026-11-12 (3일)', hours: 8, report: null });
          const wx = [...new Set(weatherRisksForDate('2026-11-11', 80, 50).map(x => x.title))];
          state.schedule.pop();
          let mb = '', mbErr = '';
          try { hjMorningBrief(); mb = (document.querySelector('#modalRoot') || {}).textContent || ''; } catch (e) { mbErr = String(e); }
          closeModal(true);
          const tool = await aiToolRun('morning_brief', {}); await new Promise(r => setTimeout(r, 120)); closeModal(true);
          return { badge, daily, brief: b.todaySch.map(s => [s.id, s.title, s.date]), briefTmr: b.tmrSch.map(s => s.id), chip: chip && chip[1], text,
            ai: ai.오늘일정.map(s => s.제목), aiTmr: ai.내일일정.map(s => s.제목), biz: biz.todaySched.map(s => s.id), wx, mb, mbErr, tool,
            orig: state.schedule.find(s => s.id === 'MULTI').title };
        });
        assert.equal(r.daily, '오늘 일정 3건 — 09:00 타일 (2/3일째) @가온아파트');
        assert.equal(r.badge, '캘린더, 오늘 일정 3건', '하단 캘린더 배지도 같은 수 — BADGE_SAME ' + r.badge);
        assert.equal(r.chip, '3', '☀️ 오늘의 브리핑 칩도 같은 수 — ' + r.chip);
        assert.deepEqual(r.brief.map(x => x[0]), ['MONEY', 'MULTI', 'TODAY'], '☀️ 브리핑 오늘 일정(시각 없는 💰 먼저 — 예전 정렬) — ' + JSON.stringify(r.brief));
        assert.deepEqual(r.brief[1], ['MULTI', '타일 (2/3일째)', '2026-11-11'], '이어지는 날은 복사본 — 제목·날짜는 그날');
        assert.equal(r.orig, '타일 (3일차 시작)', '원래 일정은 그대로');
        assert.deepEqual(r.briefTmr, ['LATER', 'MULTI'], '내일 일정도 이어지는 날 포함 — ' + JSON.stringify(r.briefTmr));
        assert.match(r.text, /오늘 3건\n · 💰 수금: 나래빌라 @나래빌라\n · 09:00 타일 \(2\/3일째\) @가온아파트/, '📋 브리핑 복사 글도 — ' + r.text);
        assert.deepEqual(r.ai, ['💰 수금: 나래빌라', '타일 (2/3일째)', '실리콘 보수'], '🌅 브리핑(aiBriefData)도 같은 목록 — ' + JSON.stringify(r.ai));
        assert.deepEqual(r.aiTmr, ['줄눈', '타일 (3/3일째)'], JSON.stringify(r.aiTmr));
        assert.deepEqual(r.biz, ['MULTI', 'TODAY'], '📊 경영 현황 오늘 일정(💰 은 예전처럼 뺌) — ' + JSON.stringify(r.biz));
        assert.deepEqual(r.wx, ['옥상 방수 (2/3일째)'], '날씨 주의 모음도 둘째 날 — ' + JSON.stringify(r.wx));
        assert.equal(r.mbErr, '', '🌅 오늘의 브리핑 창이 열린다 — MORNING_OPENS ' + r.mbErr);
        assert.match(r.mb, /시공 중\s*2곳/, '시공 중 현장 수(시공 단계·보관 아님) — ' + r.mb.slice(0, 200));
        assert.match(r.mb, /오늘 일정\s*3건/); assert.match(r.mb, /타일 \(2\/3일째\)/);
        assert.deepEqual([r.tool.오늘일정, r.tool.시공중], [3, 2], 'AI morning_brief 도 — ' + JSON.stringify(r.tool));
      } finally { await m.context.close(); }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`dailyfix-v586: ${passed}/4 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL dailyfix-v586 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

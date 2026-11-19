/* v612 ⏸ 보류 묶음 — 더보기 '쓰는 것만'(23) · ✍ 새 견적서 보류(14) · 할 일 하나(18) · 🧰 옮긴 명령(22). 합성 자료, 바깥 쓰기 0, 폰 390·PC 1280.
   판정 함수는 hold-v612.unit.js 가 따로 본다 — 여기는 실제 화면.
   ① 더보기 — 분류 6개에서 보류 기능이 빠지고 맨 아래 접힌 [⏸ 보류 18개 보기] · 칸 126개는 그대로(분류 113 + 보류 13) · 보류 칸에서 바로 연다 ·
      검색은 보류 기능도 찾고 '⏸ 보류' 표시 · 둘러보기만으로 자료·이 기기 설정 불변 (MORE)
   ② 다시 보이기 — [다시 보이기] 누르면 그 기능이 원래 분류로·묶음 수 줄어듦·설정 {show:[id]} · [처음 보류로 되돌리기] · 대시보드 단추 줄은 제자리에서 바뀜 (UNHOLD)
   ③ 자동 — 고객 페이지 주소·OfficeOps 주소+토큰이 있으면 그 기능이 분류로 돌아온다 · 중계(Apps Script)가 있어도 ☁ 팀 공유 할일은 접힌 채(할 일 하나 — v612 검토) (AUTO)
   ④ 할 일 하나 — 대시보드는 ✅ 할 일만(☁ 팀 공유 할일·팀 업무·직원 작업실 없음, 팀 업무 줄 숨김) · 열린 팀 업무가 있으면 팀 업무 단추 ·
      내 업무 창 팀 업무판·🏢 직원 작업실 줄, 팀 공유 할일 창의 직원 작업실 링크·포털 이전 단추도 같은 규칙 · 📖 사용설명서는 보류 기능에 '⏸ 보류' 한 줄 (TODO)
   ⑤ 견적 — '✍ 견적 작성' 탭 목록·편집·작업내역서 반영은 그대로, [+ 새 견적서]만 없음 · Claude 견적 만들기 한 줄 · [견적 쓰기]·검색창 '새 견적서'는
      보류 안내([닫기]는 아무것도 안 바꿈 · [이번만 앱에서 쓰기]는 예전 그대로) · 💸 AI 견적작성·📸 사진 견적은 보류 칸에 (QUOTE)
   ⑥ 광고 — [＋ 게시 기록]은 기록 0건이면 보류(카톡봇 '홍보' 명령 → PC 홍보 게시 기록 안내, 파일 이름 없이), 기록이 있으면 그대로 (ADS)
   ⑦ 🧰 — 맨 위 '사진·홍보·작업 이력 명령은 카톡봇 관리 프로그램 「클로드 명령」에 있어요' · 사진 명령 넷은 접힌 '옮긴 명령' · 청구 누락은 남음 (COWORK)
   ⑧ 폰 390 큰 글씨 2단계 — 보류 묶음을 펼쳐도 가로 넘침 0·단추 44px · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V612_BASELINE=<commit> 은 ① 에서, HJ_V612_MUTATION=cats-all 은 ①, no-unhold 는 ②, qmnew-shown·no-gate 는 ⑤, ads-shown 은 ⑥, cw-all 은 ⑦ 에서 실패해야 한다. */
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
  'cats-all': ["const items=c.items.filter(it=>!held.has(it[0]));if(!items.length)return '';", "const items=c.items;if(!items.length)return '';"],
  'no-unhold': ['const ok=id?hjHoldShow(id):hjHoldReset();if(!ok)return;', 'const ok=false;if(!ok)return;'],
  'qmnew-shown': ["const qNew=!hjHeld('quotenew');", 'const qNew=true;'],
  'no-gate': ["  if(!pass&&hjHeld('quotenew'))return hjQuoteNewHeldView(()=>hjQuoteStartFor(name,true),name);\n", ''],
  'ads-shown': ["const postLog=!hjHeld('adpostlog');", 'const postLog=true;'],
  'cw-all': ['const shown=tasks.filter(t=>!cwMoved(t)),moved=tasks.filter(cwMoved);', 'const shown=tasks,moved=[];']
};
let html = process.env.HJ_V612_BASELINE ? execFileSync('git', ['show', process.env.HJ_V612_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V612_MUTATION) {
  const m = MUT[process.env.HJ_V612_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V612_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
const HELD = ['kakaoin', 'ptlist', 'officeops', 'teamboard', 'teamroom', 'sharedtodo', 'quotenew', 'aiquote', 'photoquote', 'inventory', 'materials', 'matdue', 'suppliers', 'satisfaction', 'goal', 'budget', 'budgetalert', 'adpostlog'];
const HELD_MORE = HELD.filter(id => !['quotenew', 'teamboard', 'teamroom', 'sharedtodo', 'adpostlog'].includes(id));
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS hold-v612 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(mobile => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_more_recent', '[]'); localStorage.setItem('hj_more_favorites', '[]'); if (mobile) localStorage.setItem('pref_mobile', '1'); }, width < 600);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0; portalAutoSync = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const t0 = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return t0(m, ...a); };
  }, BOOT);
  return { context, page };
}
// 대표 자료 꼴(11/18) — 서버 없음, 재고·자재·거래처·만족도·목표·예산·납품·게시 기록 0, 견적 = 작업내역서
async function seed(page) {
  await page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    const sheet = document.getElementById('moreSheet'); if (sheet && sheet.__mobileSheetClose) sheet.__mobileSheetClose(false); else if (sheet) sheet.remove();
    const bd = document.getElementById('moreBackdrop'); if (bd) bd.remove();
    __tabStale = false; window.__toasts = []; localStorage.removeItem('hj_more_hold');
    relayReady = () => false; __relay.url = ''; __relay.token = ''; __officeOps.url = ''; __officeOps.token = '';
    const p = (name, stage) => ({ name, stage, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    state.projects = [p('가온아파트', 2), p('나래빌라', 1), Object.assign(p('달빛상가', 1), { archived: true, budget: 9000000 })];
    state.quotes = [Object.assign(newQuote(false), { id: 'qs1', title: '가온아파트 내역서', project: '가온아파트', stmt: { doc: '작업내역서', date: '2026-11-10', file: 'TEST_STMT.xlsx' }, items: [{ name: '방수', spec: '', qty: 1, price: 100000 }] })];
    state.files = []; state.schedule = []; state.notes = [{ id: 'n1', todo: true, text: '자재 주문', done: false }];
    state.inventory = []; state.materials = []; state.suppliers = []; state.supplierMap = {}; state.satisfaction = []; state.adPosts = []; state.goals = { salesBasis: 'stmt' };
    state.portalCfg = {}; state.kakaoLastAt = ''; state.editingQuote = null; state.activeProject = null; state.tab = 'dashboard'; state._demo = false;
    try { localStorage.removeItem('hj_role'); } catch (e) {}
    render();
  });
}
const dataSig = page => page.evaluate(() => { const d = JSON.parse(JSON.stringify(serializeData())); delete d.savedAt; return JSON.stringify(d); });
async function openMore(page) {
  await page.waitForFunction(() => !window.__mobileSheetHistoryRetire && !window.__mobileSheetHistoryDeferredOpen);
  await page.evaluate(() => openMoreSheetV2(document.querySelector('[data-mnav="__more"]') || document.body));
  await page.waitForSelector('#moreSheet #moreHold');
}
const moreInfo = page => page.evaluate(() => {
  const s = document.getElementById('moreSheet'), cats = [...s.querySelectorAll('details.more-cat-block:not(.more-hold)')], hold = s.querySelector('#moreHold');
  return { cats: cats.map(d => d.dataset.cat), catIds: cats.flatMap(d => [...d.querySelectorAll('[data-moreaction]')].map(b => b.dataset.moreaction)),
    counts: cats.map(d => Number(d.querySelector('.more-cat-count').textContent.replace(/\D/g, ''))), all: s.querySelectorAll('.more-cat-block [data-moreaction]').length,
    holdLast: hold === [...s.querySelectorAll('#moreCategories > details')].pop(), holdOpen: !!hold && hold.open, title: hold ? hold.querySelector('summary').textContent : '',
    rows: hold ? [...hold.querySelectorAll('[data-hold-row]')].map(r => r.dataset.holdRow) : [], auto: hold ? [...hold.querySelectorAll('[data-hold-auto]')].map(r => r.dataset.holdRow) : [],
    reset: !!s.querySelector('[data-more-holdreset]') };
});

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(390);

    await test('① 더보기 — 분류에서 빠지고 맨 아래 접힌 보류 18개 · 칸 126개 그대로 · 보류 칸에서 바로 열기 · 검색 · 자료 불변 (MORE)', async () => {
      await seed(page);
      const before = await dataSig(page);
      await openMore(page);
      const m = await moreInfo(page);
      assert.deepEqual(m.cats, ['ai', 'money', 'customer', 'site', 'report', 'tool'], '분류 6개 그대로');
      assert.deepEqual(m.catIds.filter(id => HELD.includes(id)), [], '보류 기능은 분류에 없다 ' + JSON.stringify(m.catIds.filter(id => HELD.includes(id))));
      assert.equal(m.counts.reduce((a, b) => a + b, 0), 126 - HELD_MORE.length, '분류 칸 수 = 126 − 보류 13');
      assert.equal(m.all, 126, '더보기 칸 126개 — 지운 것 없음');
      assert.ok(m.holdLast && !m.holdOpen && /보류 18개 보기/.test(m.title), '맨 아래 접힌 보류 ' + JSON.stringify(m));
      assert.deepEqual(m.rows, HELD, '보류 줄 차례(서버 없음 먼저)');
      assert.deepEqual(m.auto, HELD.slice(0, 6));
      assert.equal(m.reset, false);
      // 보류 칸에서 바로 연다 — 지운 것이 아니다
      await page.evaluate(() => { document.getElementById('moreHold').open = true; window.__invOpened = 0; window.__invNative = inventoryManage; inventoryManage = () => { window.__invOpened++; }; });
      await page.click('#moreHold [data-hold-row="inventory"] [data-moreaction="inventory"]');
      await page.waitForFunction(() => window.__invOpened === 1 && !document.getElementById('moreSheet'));
      await page.evaluate(() => { inventoryManage = window.__invNative; });
      // 검색은 보류 기능도 찾는다
      await openMore(page);
      await page.evaluate(() => { const s = document.getElementById('moreSearch'); s.value = '카카오 문의'; s.dispatchEvent(new Event('input', { bubbles: true })); });
      const hit = await page.evaluate(() => { const b = document.querySelector('#moreSearchResult [data-moreaction="kakaoin"]'); return b ? { tag: !!b.querySelector('[data-hold-tag]'), label: b.getAttribute('aria-label') } : null; });
      assert.ok(hit && hit.tag && /보류 중/.test(hit.label), '검색 결과에 ⏸ 보류 ' + JSON.stringify(hit));
      await page.evaluate(() => document.getElementById('moreSheetClose').click());
      assert.equal(await dataSig(page), before, '둘러보기·검색·보류 칸 열기 — 자료 불변');
      assert.equal(await page.evaluate(() => localStorage.getItem('hj_more_hold')), null, '보기만으로는 이 기기 설정도 안 적는다');
    });

    await test('② 다시 보이기 — 원래 분류로 · 설정 {show} · 처음 보류로 · 대시보드 단추 줄은 제자리 (UNHOLD)', async () => {
      await seed(page);
      await openMore(page);
      await page.evaluate(() => { document.getElementById('moreHold').open = true; });
      await page.click('#moreHold [data-more-unhold="kakaoin"]');
      await page.waitForFunction(() => /보류 17개 보기/.test(document.querySelector('#moreHold summary').textContent));
      let m = await moreInfo(page);
      assert.ok(m.catIds.includes('kakaoin') && !m.rows.includes('kakaoin') && m.reset && m.holdOpen, '원래 분류로 · 묶음은 펼친 채 ' + JSON.stringify(m.rows));
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('details[data-cat="customer"] [data-moreaction]')].some(b => b.dataset.moreaction === 'kakaoin')), '고객·영업 분류');
      assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('hj_more_hold'))), { show: ['kakaoin'] });
      assert.ok((await page.evaluate(() => window.__toasts.join(' '))).includes('카카오 문의'), '알림');
      // 대시보드(뒤 화면)의 팀 업무 단추 — 다시 보이기 하면 다시 그리지 않고 그 줄만 바뀐다
      await page.evaluate(() => { window.__dashNode = document.getElementById('dashboardTodo'); });
      assert.equal(await page.locator('#dashboardTeamOpen').count(), 0);
      await page.click('#moreHold [data-more-unhold="teamboard"]');
      await page.waitForFunction(() => !!document.getElementById('dashboardTeamOpen'));
      assert.ok(await page.evaluate(() => document.getElementById('dashboardTodo') === window.__dashNode && !document.getElementById('dashboardTeamSummary').hidden), '제자리 · 팀 업무 줄도 보임');
      await page.click('#moreHold [data-more-holdreset]');
      await page.waitForFunction(() => /보류 18개 보기/.test(document.querySelector('#moreHold summary').textContent));
      m = await moreInfo(page);
      assert.ok(!m.catIds.includes('kakaoin') && !m.reset, '처음 보류로');
      assert.equal(await page.evaluate(() => localStorage.getItem('hj_more_hold')), null);
      assert.equal(await page.locator('#dashboardTeamOpen').count(), 0, '대시보드도 처음대로');
      await page.evaluate(() => document.getElementById('moreSheetClose').click());
    });

    await test('③ 자동 — 서버 주소가 있으면 분류·대시보드로 돌아온다 (AUTO)', async () => {
      await seed(page);
      await page.evaluate(() => { state.portalCfg = { base: 'https://example.invalid/portal' }; __officeOps.url = 'https://example.invalid/office'; __officeOps.token = 'TEST_TOKEN';
        __relay.url = 'https://script.google.com/macros/s/TEST_DEPLOY/exec'; __relay.token = 'TEST_TOKEN'; relayReady = () => true; render(); });
      assert.equal(await page.locator('#dashboardSharedTodoOpen').count(), 0, '중계(Apps Script)가 있어도 대시보드 할 일 단추는 하나(☁ 팀 공유 할일은 보류)');
      assert.match(await page.locator('#dashboardTodoHint').innerText(), /✅ 할 일 한 곳에/);
      await openMore(page);
      const m = await moreInfo(page);
      assert.ok(['kakaoin', 'ptlist', 'officeops'].every(id => m.catIds.includes(id)) && /보류 15개 보기/.test(m.title), '연결된 셋은 분류로 ' + m.title);
      assert.ok(m.rows.includes('sharedtodo'), '☁ 팀 공유 할일은 보류 묶음에 남는다 ' + JSON.stringify(m.rows));
      assert.deepEqual(m.auto, ['teamboard', 'teamroom'], '직원 작업실은 team-config.js 주소가 빈 채로 보류');
      await page.evaluate(() => { document.getElementById('moreSheetClose').click(); relayReady = () => false; __relay.url = ''; __relay.token = ''; __officeOps.url = ''; __officeOps.token = ''; });
    });

    await test('④ 할 일 하나 — 대시보드는 ✅ 할 일만 · 열린 팀 업무가 있으면 팀 업무 · 내 업무 창도 같은 규칙 (TODO)', async () => {
      await seed(page);
      const d = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#dashboardTodoBtns [id]')].map(e => e.id), todo: document.getElementById('dashboardTodoOpen').textContent,
        team: document.getElementById('dashboardTeamSummary').hidden, hint: document.getElementById('dashboardTodoHint').textContent }));
      assert.deepEqual(d.ids, ['dashboardInquiryOpen', 'dashboardTodoOpen', 'dashboardCaseOpen', 'dashboardSearchOpen', 'dashboardOperationsConnections'], JSON.stringify(d.ids));
      assert.ok(d.todo === '✅ 할 일 확인·추가' && d.team && /✅ 할 일 한 곳에/.test(d.hint), JSON.stringify(d));
      await page.click('#dashboardTodoOpen');
      await page.waitForFunction(() => !!document.querySelector('#modalRoot .modal'));
      await page.evaluate(() => closeModal(true));
      await page.evaluate(() => { myWorkView(); });
      await page.waitForSelector('#myWork');
      assert.equal(await page.locator('#myWork #mwBoard').count(), 0, '내 업무 창 팀 업무판도 보류');
      await page.waitForFunction(() => __hjMyWork.team === 'off');
      assert.equal(await page.locator('#myWork [data-mw-teamh]').count() + await page.locator('#myWork #mwTeam').count(), 0, '내 업무 창 🏢 직원 작업실 줄도 보류');
      await page.evaluate(() => closeModal(true));
      await page.evaluate(() => { hjSharedTodoView(); });
      await page.waitForSelector('#sharedTodoView');
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#sharedTodoView .st-actions a, #sharedTodoView .st-actions button')].map(e => e.textContent.trim()).filter(t => /직원/.test(t))), [], '팀 공유 할일 창에도 직원 작업실 링크·포털 이전 단추 없음');
      await page.evaluate(() => closeModal(true));
      // 📖 사용설명서 — 보류 기능 설명에 '⏸ 보류' 한 줄(예전 자리 '더보기 [📸 사진 견적]'만 보고 헤매지 않게)
      await page.evaluate(() => helpGuide('사진 견적'));
      await page.waitForSelector('#hgBody [data-help-hold]');
      assert.match(await page.locator('#hgBody').innerText(), /더보기 \[📸 사진 견적\][\s\S]*⏸ 지금 보류 중 — 더보기 맨 아래 \[⏸ 보류\]/);
      await page.evaluate(() => closeModal(true));
      await page.evaluate(() => { state.notes.push({ id: 'tt1', text: '[팀 업무]', todo: true, done: false, project: '가온아파트', teamTask: { schema: 1, title: '가상 업무', assignee: '가상담당', status: 'doing', due: '', handoff: '', recorder: '가상', updatedAt: '2026-11-18T00:00:00.000Z', revision: 1 } }); render(); });
      assert.equal(await page.locator('#dashboardTeamOpen').count(), 1, '열린 팀 업무 → 팀 업무 단추');
      assert.equal(await page.locator('#dashboardCompanyTeam').count(), 0, '직원 작업실 링크는 서버가 없으면 그대로 보류');
    });

    await test('⑤ 견적 — 목록·편집 그대로, [+ 새 견적서]만 없음 · Claude 한 줄 · [견적 쓰기]는 보류 안내 (QUOTE)', async () => {
      await seed(page);
      await page.evaluate(() => { state.tab = 'quotemaker'; render(); });
      const q = await page.evaluate(() => ({ nw: !!document.getElementById('qmNew'), imp: !!document.getElementById('qmImport'), stmt: !!document.getElementById('qmStmt'),
        line: (document.querySelector('[data-qm-claude]') || {}).textContent || '', held: !!document.querySelector('[data-qm-held]'), cards: document.querySelectorAll('[data-qedit]').length }));
      assert.ok(!q.nw && q.imp && q.stmt && q.held && q.cards === 1, '탭은 그대로, 새 견적서만 없음 ' + JSON.stringify(q));
      assert.ok(/실제 견적서는 Claude 견적 만들기\(단가표 엑셀\)로/.test(q.line) && /데이터\\단가표\\만물_단가표_견적기\.xlsx/.test(q.line), 'Claude 한 줄 ' + q.line);
      await page.click('[data-qedit="qs1"]');
      await page.waitForSelector('#qmTitle');
      assert.equal(await page.evaluate(() => state.editingQuote && state.editingQuote.id), 'qs1', '저장된 내역서 편집은 그대로');
      await page.evaluate(() => { state.editingQuote = null; state.tab = 'dashboard'; render(); });
      // [견적 쓰기](hjQuoteStartFor) → 보류 안내. [닫기]는 아무것도 안 바꿈
      const before = await dataSig(page);
      await page.evaluate(() => hjQuoteStartFor('나래빌라'));
      await page.waitForSelector('#hjQuoteHeld');
      const g = await page.evaluate(() => ({ text: document.getElementById('hjQuoteHeld').textContent, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent) }));
      assert.ok(/Claude 견적 만들기\(단가표 엑셀\)/.test(g.text) && /나래빌라/.test(g.text) && JSON.stringify(g.btns) === JSON.stringify(['닫기', '이번만 앱에서 쓰기']), JSON.stringify(g));
      await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '닫기').click());
      assert.ok(await page.evaluate(() => !state.editingQuote && state.tab === 'dashboard'), '[닫기] — 견적·탭 그대로');
      assert.equal(await dataSig(page), before, '[닫기] — 자료 불변(단계도 그대로)');
      // [이번만 앱에서 쓰기] = 예전 길(현장 채운 새 견적, 상담이면 실측으로)
      await page.evaluate(() => hjQuoteStartFor('나래빌라'));
      await page.waitForSelector('#hjQuoteHeld');
      await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '이번만 앱에서 쓰기').click());
      await page.waitForSelector('#qmTitle');
      assert.deepEqual(await page.evaluate(() => [state.tab, state.editingQuote.project, state.editingQuote.title]), ['quotemaker', '나래빌라', '나래빌라 견적']);
      await page.evaluate(() => { state.editingQuote = null; state.tab = 'dashboard'; render(); });
      // 검색창 '새 견적서'도 같은 안내
      await page.evaluate(() => HJ_ACTIONS.find(a => a.n === '새 견적서').run());
      await page.waitForSelector('#hjQuoteHeld');
      await page.evaluate(() => closeModal(true));
      // 💸 AI 견적작성·📸 사진 견적은 보류 칸에(분류엔 없음), 다시 보이면 [+ 새 견적서]
      await openMore(page);
      const m = await moreInfo(page);
      assert.ok(['aiquote', 'photoquote'].every(id => !m.catIds.includes(id) && m.rows.includes(id)) && m.rows.includes('quotenew'), JSON.stringify(m.rows));
      await page.evaluate(() => { document.getElementById('moreHold').open = true; });
      await page.click('#moreHold [data-more-unhold="quotenew"]');
      await page.evaluate(() => { document.getElementById('moreSheetClose').click(); state.tab = 'quotemaker'; render(); });
      assert.equal(await page.locator('#qmNew').count(), 1, '다시 보이면 [+ 새 견적서]');
      await page.evaluate(() => { localStorage.removeItem('hj_more_hold'); state.tab = 'dashboard'; render(); });
    });

    await test('⑥ 광고 — [＋ 게시 기록]은 기록 0건이면 보류, 있으면 그대로 (ADS)', async () => {
      await seed(page);
      await page.evaluate(() => { state.tab = 'ads'; render(); });
      const a = await page.evaluate(() => ({ add: document.querySelectorAll('[data-adadd]').length, draft: document.querySelectorAll('[data-addraft]').length, text: document.getElementById('view').textContent }));
      assert.ok(a.add === 0 && a.draft === 1 && /올렸어 당근 \[현장\][\s\S]*PC 홍보 게시 기록/.test(a.text) && !/홍보_게시기록\.md/.test(a.text), '게시 기록 손 입력 보류 · 원고 만들기 그대로 ' + JSON.stringify({ add: a.add, draft: a.draft }));
      await page.evaluate(() => { state.adPosts = [{ id: 'a1', ch: AD_CH[0].id, date: '2026-11-01', title: '가상 게시', url: '' }]; render(); });
      assert.equal(await page.locator('[data-adadd]').count(), 1, '기록이 있으면 그대로');
      await page.evaluate(() => { state.adPosts = []; state.tab = 'dashboard'; render(); });
    });

    await test('⑦ 🧰 — 맨 위 관리 프로그램 한 줄 · 사진 명령 넷은 접힌 옮긴 명령 · 청구 누락은 남음 (COWORK)', async () => {
      await page.evaluate(() => { state.coworkTasks = null; state._coworkInit = false; coworkTasksEnsure(); moreActionHandler('cowork'); });
      await page.waitForSelector('#modalRoot .cw-cat');
      const c = await page.evaluate(() => { const root = document.getElementById('modalRoot'), kb = root.querySelector('#cwKakaoBot');
        return { kb: kb ? kb.textContent : '', kbFirst: !!kb && !!(kb.compareDocumentPosition(root.querySelector('#cwFilter')) & Node.DOCUMENT_POSITION_FOLLOWING),
          cats: [...root.querySelectorAll('.cw-cat .cw-row')].map(r => r.dataset.cwRow), moved: [...root.querySelectorAll('#cwMoved .cw-row')].map(r => r.dataset.cwRow),
          closed: !root.querySelector('#cwMoved').open, saved: state.coworkTasks.length }; });
      assert.ok(/사진·홍보·작업 이력 명령은 카톡봇 관리 프로그램 「클로드 명령」에 있어요/.test(c.kb) && c.kbFirst, 'kakaobot line ' + c.kb);
      assert.deepEqual(c.moved, ['cw_sitesort', 'cw_photoin', 'cw_chatphoto', 'cw_photoassign']);
      assert.ok(c.closed && c.saved === 17 && c.cats.length === 13 && c.cats.includes('cw_unbilled') && c.cats.includes('cw_calsync') && !c.cats.some(id => c.moved.includes(id)), JSON.stringify(c));
      await page.evaluate(() => closeModal(true));
      await context.close();
    });

    await test('⑧ 폰 390 큰 글씨 2단계 — 보류 묶음 펼쳐도 넘침 0·단추 44px · 핀 · 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      const phone = await open(390);
      await seed(phone.page);
      await phone.page.evaluate(() => document.body.classList.add('a11y-big2'));
      await openMore(phone.page);
      await phone.page.evaluate(() => { document.getElementById('moreHold').open = true; document.getElementById('moreHold').scrollIntoView(); });
      const r = await phone.page.evaluate(() => { const s = document.getElementById('moreSheet'), vis = e => e.getClientRects().length > 0;
        const small = [...s.querySelectorAll('#moreHold button, #moreHold summary, #moreHold a')].filter(vis).map(e => [e.textContent.trim().slice(0, 10), Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().width)]).filter(x => x[1] < 44 || x[2] < 44);
        const over = [...s.querySelectorAll('#moreHold .more-chip, #moreHold .more-hold-why')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 2; }).length;
        return { small, over, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
      assert.ok(r.small.length === 0 && r.over === 0 && r.doc <= 0, JSON.stringify(r));
      const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
      assert.ok(pin[0] && pin[0] === pin[1] && pin[0] === pin[2], 'pins ' + JSON.stringify(pin));
      await phone.context.close();
      assert.deepEqual(errors, []); assert.equal(network.writes, 0);
    });
  } finally { await browser.close(); }
  console.log(`hold-v612: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(error => { console.error('FAIL hold-v612', error && error.stack || error); process.exitCode = 1; });

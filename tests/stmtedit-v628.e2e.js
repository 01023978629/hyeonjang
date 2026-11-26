/* v628 대표 요청(11/27) "현장웹에 내역서가 월 분류가 잘못되었어 내역서에 미 포함 이나 금액 수정 기능 추가해줘" — 화면 흐름(합성 자료).
   ① 월(MONTH): 📑 내역서 탭 월 목록은 작업한 달 — 10/13 내역서의 9/21 줄은 9월, 작성일보다 늦은 날짜(9/17 내역서 '10/15') 줄은 작성 월(9월) +
      월 목록 '⚠ 날짜 확인 n줄' 단추 · 장부 '⚠ 날짜 확인 n줄' · 브리핑 💰(hjStmtMonthSales)도 같은 셈 · 부가세 한 벌(hjSalesEntries)은 작성 월 그대로 · 그리기만으로 자료 불변
   ② 날짜 고치기(EDIT): 📄 보기 줄마다 ✏ → 창(⚠ 안내 · 📷 권하는 날 단추) → 9/15 로 저장 → 안전판 1개('작업내역서 줄 고치기 전') · 줄 d0 · ⚠ 하나 줄어듦 ·
      '✏ 고침(원래 10/15)' · 비고 한 줄 · 보기 창으로 돌아옴 · 안전판을 못 찍으면 아무것도 안 바뀜
   ③ 금액·미포함(SKIP): 금액 400,000→300,000 → 미리 보기 줄·장부 합계·9월 매출 · 미포함 → 줄 '미포함'·취소선, 합계에서 빠짐, 받은 돈 많음 알림(입금 기록 그대로) ·
      ↩ 파일 값으로 → 처음 그대로(d0·amt0·skip·edAt 없음)
   ④ 막기(GUARD): 미래 날짜·마이너스 금액·손으로 고친 견적·오래된 창은 창 안에서 까닭을 보이고 저장해도 아무것도 안 씀
   ⑤ 폰 390(PHONE): 보기·고치기 창·월 목록 가로 넘침 0 · 단추 44px · 페이지 오류 0 · 외부 쓰기 0 · 핀 3곳 같음
   HJ_V628E_MUTATION=no-edit-btn(보기 줄 ✏ 없음)은 ②, month-by-stmt(작성 월로 셈)는 ①, no-back(저장 뒤 보기로 안 돌아옴)은 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-edit-btn': ["(l.qid!=null?'<button type=\"button\" class=\"mini-btn\" data-sdedit=", "(false?'<button type=\"button\" class=\"mini-btn\" data-sdedit="],
  'month-by-stmt': ['const ym=ymOf(hjStmtLineDay(l,date))||fall;', 'const ym=fall;'],
  'no-back': ["    if(typeof back==='function')back();else closeModal();}});", '    closeModal();}});'],
};
let html = null;
if (process.env.HJ_V628E_MUTATION) {
  const m = MUT[process.env.HJ_V628E_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V628E_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtedit-v628 ' + name); }
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
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
  }, BOOT);
  return { context, page };
}
const SEED = async () => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
  state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = []; state.goals = {};
  const mk = (src, date, project, lines) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  // S917 — 다솜 두 줄은 작성일(9/17)보다 늦은 '10/15'(실제 9/15 오기를 흉내)
  mk('S917.xlsx', '2026-09-17', '가온아파트', [{ d: '2026-09-09', loc: '가온아파트 101동 1302호', work: '수도관 누수', amt: 1000000 }]);
  mk('S917.xlsx', '2026-09-17', '다솜아파트', [{ d: '2026-10-15', loc: '다솜아파트 21동 1203호', work: '우수관 2개', amt: 400000 }, { d: '2026-10-15', loc: '다솜아파트 21동 1203호', work: '세탁기 배관 타공', amt: 50000 }]);
  // S1013 — 가온 9/21 두 줄(9월 일을 10월에 청구) · 나래 10/2
  mk('S1013.xlsx', '2026-10-13', '가온아파트', [{ d: '2026-09-21', loc: '가온아파트 28-708', work: '우수관 2개 작업', amt: 400000 }, { d: '2026-09-21', loc: '가온아파트 28-708', work: '세탁기 육가 작업', amt: 100000 }]);
  mk('S1013.xlsx', '2026-10-13', '나래아파트', [{ d: '2026-10-02', loc: '나래아파트 907동 301호', work: '우수관 1개 작업', amt: 400000 }]);
  hjStmtPayApply('S917.xlsx', { amt: 1450000, d: '2026-11-05', method: '계좌이체' });
  const ph = (id, project, iso) => state.files.push({ id, name: id + '.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', size: 1000 + state.files.length, project, when: new Date(iso) });
  ph('P1', '다솜아파트', '2026-09-15T03:00:00Z'); ph('P2', '다솜아파트', '2026-09-15T04:00:00Z');
  try { await idbSet('hj_snaps', []); } catch (e) {}
  __hjStmtYm = null; state.activeProject = null; state.tab = 'estimates'; state.editingQuote = null;
  render();
};
const snapState = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };
const qOf = (src, project) => `state.quotes.find(q=>q.stmt&&q.stmt.src===${JSON.stringify(src)}&&q.project===${JSON.stringify(project)})`;
async function openEdit(page, src, project, li) {
  await page.evaluate(({ src }) => { closeModal(true); hjStmtDetailView(src); }, { src });
  await page.waitForSelector(`#modalRoot [data-stmt-detail="${src}"]`, { timeout: 5000 });
  const qid = await page.evaluate(`String(${qOf(src, project)}.id)`);
  await page.click(`#modalRoot [data-sdedit="${qid}"][data-sdedit-li="${li}"]`);
  await page.waitForSelector('#modalRoot [data-sle]', { timeout: 5000 });
  return qid;
}
const setField = (page, sel, val) => page.evaluate(({ sel, val }) => { const el = document.querySelector('#modalRoot ' + sel); if (el.type === 'checkbox') el.checked = !!val; else el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, val });
const footClick = (page, label) => page.evaluate(label => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.trim() === label); if (!b) throw new Error('단추 없음: ' + label); b.click(); }, label);

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(1100);
    await page.evaluate(SEED);
    await test('① 월 = 작업한 날 · ⚠ 날짜 확인 · 브리핑 같은 셈 · 부가세 한 벌은 작성 월 (MONTH)', async () => {
      const r = await page.evaluate(() => {
        const before = (() => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); })();
        __hjStmtYm = '2026-09'; render();
        const sales = {}; hjSalesEntries().forEach(e => { sales[e.ym] = (sales[e.ym] || 0) + e.amount; });
        const months = [...document.querySelectorAll('#view [data-stmt-ym]')].map(b => [b.dataset.stmtYm, b.innerText.replace(/\s+/g, ' ').trim()]);
        const items = [...document.querySelectorAll('#view [data-stmt-month-list="2026-09"] [data-stmt-item]')].map(el => [el.querySelector('[data-open]').textContent, el.innerText.replace(/\s+/g, ' ').trim()]);
        const odd = [...document.querySelectorAll('#view [data-stmt-odd-go]')].map(b => [b.dataset.stmtdetail, b.textContent.trim()]);
        const ledOdd = [...document.querySelectorAll('#view [data-stmt-ledger] [data-stmt-odd]')].map(s => s.dataset.stmtOdd);
        const after = (() => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); })();
        return { sales, sep: hjStmtMonthSales('2026-09'), oct: hjStmtMonthSales('2026-10'), months, items, odd, ledOdd, basis: !!document.querySelector('#view [data-stmt-month-basis]'), same: before === after };
      });
      assert.deepEqual(r.sales, { '2026-09': 1450000, '2026-10': 900000 }, '부가세·세무 한 벌은 작성 월 그대로 ' + JSON.stringify(r.sales));
      assert.deepEqual([r.sep.total, r.sep.n, r.oct.total, r.oct.n], [1950000, 3, 400000, 1], '브리핑 💰 = 작업한 달 ' + JSON.stringify([r.sep, r.oct]));
      assert.equal(r.months.length, 2);
      assert.match(r.months[0][1], /2026년 10월 · 내역서 1건 · 현장 1곳 400,000원/);
      assert.match(r.months[1][1], /2026년 9월 · 내역서 3건 · 현장 2곳 .*1,950,000원/);
      assert.deepEqual(r.items.map(x => x[0]), ['가온아파트', '가온아파트', '다솜아파트'], '9월 목록 ' + JSON.stringify(r.items));
      assert.match(r.items[1][1], /9\/21 가온아파트 우수관 2개 작업 · 세탁기 육가 작업 .*500,000원/);
      assert.deepEqual(r.odd, [['S917.xlsx', '⚠ 날짜 확인 2줄']]);
      assert.deepEqual(r.ledOdd, ['2']);
      assert.ok(r.basis, '월 목록에 작업한 날 기준');
      assert.ok(r.same, '그리기만으로 자료 불변');
    });
    await test('② ✏ 날짜 고치기 — 권하는 날 · 안전판 · d0 · ⚠ 줄어듦 · 보기로 돌아옴 · 안전판 실패면 그대로 (EDIT)', async () => {
      // 안전판을 못 찍으면 아무것도 안 바뀐다
      const failed = await page.evaluate(async () => {
        const real = hjSnapshot; hjSnapshot = async () => false;
        const before = JSON.stringify(state.quotes);
        const q = state.quotes.find(x => x.project === '다솜아파트');
        let msg = ''; try { await hjStmtLineEditSave(q.id, 0, { d: '2026-09-15', amt: '400000', skip: false }); } catch (e) { msg = e.message; }
        hjSnapshot = real; return { msg, same: before === JSON.stringify(state.quotes) };
      });
      assert.match(failed.msg, /안전판을 만들지 못해/); assert.ok(failed.same);
      const qid = await openEdit(page, 'S917.xlsx', '다솜아파트', 0);
      const w = await page.evaluate(() => { const s = document.querySelector('#modalRoot [data-sle-sugg]'); return { odd: !!document.querySelector('#modalRoot [data-sle-odd]'), sugg: s ? s.getAttribute('data-sle-sugg') : null, date: document.querySelector('#sleDate').value, title: document.querySelector('#modalTitle').textContent }; });
      assert.ok(w.odd); assert.equal(w.sugg, '2026-09-15', '사진 있는 9/15 를 권함'); assert.equal(w.date, '2026-10-15'); assert.equal(w.title, '✏ 내역서 줄 고치기');
      await page.click('#modalRoot [data-sle-sugg]');
      assert.equal(await page.evaluate(() => document.querySelector('#sleDate').value), '2026-09-15');
      assert.match(await page.evaluate(() => document.querySelector('#modalRoot [data-sle-sum]').innerText), /다솜아파트 450,000원 → 450,000원/);
      await footClick(page, '저장');
      await page.waitForSelector('#modalRoot [data-stmt-detail="S917.xlsx"]', { timeout: 6000 });
      const r = await page.evaluate(async qid => {
        const q = state.quotes.find(x => String(x.id) === qid), l = q.stmt.lines[0], m = document.querySelector('#modalRoot');
        const snaps = (await idbGetStrict('hj_snaps')) || [];
        return { d: l.d, d0: l.d0, edAt: !!l.edAt, l1: q.stmt.lines[1].d, memo: /\[내역서 줄 고침\] .* 우수관 2개 · 날짜 10\/15→9\/15/.test(q.memo), spec: q.items[0].spec,
          odd: m.querySelectorAll('[data-sd-badge="odd"]').length, edited: [...m.querySelectorAll('[data-sd-badge="edited"]')].map(x => x.textContent.trim()),
          edits: m.querySelectorAll('[data-sdedit]').length, snaps: snaps.map(s => s.label), sep: hjStmtMonthSales('2026-09').total, ledOdd: hjStmtLedger().find(s => s.src === 'S917.xlsx').odd };
      }, qid);
      assert.deepEqual([r.d, r.d0, r.edAt, r.l1], ['2026-09-15', '2026-10-15', true, '2026-10-15']);
      assert.ok(r.memo, '비고 한 줄'); assert.ok(r.spec.startsWith('9/15 '), r.spec);
      assert.equal(r.odd, 1, '⚠ 하나 남음'); assert.deepEqual(r.edited, ['✏ 고침(원래 10/15)']);
      assert.equal(r.edits, 3, '줄마다 ✏');
      assert.equal(r.snaps.filter(l => l === '작업내역서 줄 고치기 전').length, 1, '안전판 1개 ' + JSON.stringify(r.snaps));   // 앱이 3분마다 찍는 '작업 중'은 따로
      assert.equal(r.sep, 1950000, '9월 그대로(작성 월 → 작업한 날 9/15)'); assert.equal(r.ledOdd, 1);
    });
    await test('③ 금액·미포함·↩ 파일 값으로 — 합계·장부·월 매출 · 받은 돈 많음(입금 기록 그대로) (SKIP)', async () => {
      await openEdit(page, 'S1013.xlsx', '가온아파트', 0);
      await setField(page, '#sleAmt', '300,000');
      assert.match(await page.evaluate(() => document.querySelector('#modalRoot [data-sle-sum]').innerText), /가온아파트 500,000원 → 400,000원 · 이 내역서 합계 900,000원 → 800,000원/);
      await footClick(page, '저장');
      await page.waitForSelector('#modalRoot [data-stmt-detail="S1013.xlsx"]', { timeout: 6000 });
      let r = await page.evaluate(() => ({ led: hjStmtLedger().find(s => s.src === 'S1013.xlsx').total, sep: hjStmtMonthSales('2026-09').total,
        line: document.querySelector('#modalRoot [data-sd-site="가온아파트"] [data-sd-line]').innerText.replace(/\s+/g, ' ').trim() }));
      assert.deepEqual([r.led, r.sep], [800000, 1850000]);
      assert.equal(r.line, '9/21 가온아파트 28-708 · 우수관 2개 작업 ✏ 고침(원래 400,000원) 300,000원');
      // 미포함 — 다 받은 S917 의 가온 1,000,000 줄
      const pay0 = await page.evaluate(() => JSON.stringify(state.payLog));
      await openEdit(page, 'S917.xlsx', '가온아파트', 0);
      await setField(page, '#sleSkip', true);
      assert.match(await page.evaluate(() => (document.querySelector('#modalRoot [data-sle-over]') || {}).textContent || ''), /이미 받은 돈\(1,450,000원\)이 새 합계보다 1,000,000원 많아져요/);
      await footClick(page, '저장');
      await page.waitForSelector('#modalRoot [data-stmt-detail="S917.xlsx"]', { timeout: 6000 });
      r = await page.evaluate(() => { closeModal(true); render(); const s = hjStmtLedger().find(x => x.src === 'S917.xlsx');
        hjStmtDetailView('S917.xlsx'); const m = document.querySelector('#modalRoot'), row = m.querySelector('[data-sd-site="가온아파트"] [data-sd-line]');
        return { led: [s.total, s.paid, s.left, s.over, s.skipN], skipAttr: row.hasAttribute('data-sd-skip'), text: row.innerText.replace(/\s+/g, ' ').trim(), strike: getComputedStyle(row.querySelector('b')).textDecorationLine,
          over: (m.querySelector('[data-sd-over]') || {}).textContent || '', ledOver: (document.querySelector('#view [data-stmt-over]') || {}).textContent || '', sep: hjStmtMonthSales('2026-09').total, pay: JSON.stringify(state.payLog) }; });
      assert.deepEqual(r.led, [450000, 1450000, 0, 1000000, 1]);
      assert.ok(r.skipAttr); assert.equal(r.text, '9/9 가온아파트 101동 1302호 · 수도관 누수 미포함 1,000,000원'); assert.equal(r.strike, 'line-through');
      assert.match(r.over, /받은 돈이 합계보다 1,000,000원 많아요/); assert.match(r.ledOver, /받은 돈이 1,000,000원 많아요/);
      assert.equal(r.sep, 850000, '9월 매출에서 빠짐'); assert.equal(r.pay, pay0, '입금 기록 그대로');
      // ↩ 파일 값으로 → 처음 그대로
      await openEdit(page, 'S917.xlsx', '가온아파트', 0);
      await footClick(page, '↩ 파일 값으로');
      assert.equal(await page.evaluate(() => document.querySelector('#sleSkip').checked), false);
      await footClick(page, '저장');
      await page.waitForSelector('#modalRoot [data-stmt-detail="S917.xlsx"]', { timeout: 6000 });
      r = await page.evaluate(() => { const q = state.quotes.find(x => x.stmt.src === 'S917.xlsx' && x.project === '가온아파트'); return { keys: Object.keys(q.stmt.lines[0]).sort(), total: hjStmtLedger().find(s => s.src === 'S917.xlsx').total, price: q.items[0].price }; });
      assert.deepEqual(r.keys, ['amt', 'd', 'loc', 'work']); assert.deepEqual([r.total, r.price], [1450000, 909091]);
    });
    await test('④ 막기 — 미래 날짜·마이너스·손으로 고친 견적·오래된 창은 창 안에서 까닭, 저장해도 그대로 (GUARD)', async () => {
      await openEdit(page, 'S1013.xlsx', '나래아파트', 0);
      const before = await page.evaluate(snapState);
      await setField(page, '#sleDate', '2099-01-01');
      assert.match(await page.evaluate(() => document.querySelector('#modalRoot [data-sle-why]').textContent), /미래/);
      await footClick(page, '저장');
      await setField(page, '#sleDate', '2026-10-02'); await setField(page, '#sleAmt', '-5,000');
      assert.match(await page.evaluate(() => document.querySelector('#modalRoot [data-sle-why]').textContent), /마이너스/);
      await footClick(page, '저장');
      await page.evaluate(() => { __tabStale = true; }); await setField(page, '#sleAmt', '1');
      assert.match(await page.evaluate(() => document.querySelector('#modalRoot [data-sle-why]').textContent), /오래된 창/);
      await footClick(page, '저장'); await page.evaluate(() => { __tabStale = false; });
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(snapState), before, '막힌 저장은 아무것도 안 씀');
      const hand = await page.evaluate(() => { const q = state.quotes.find(x => x.stmt.src === 'S1013.xlsx' && x.project === '나래아파트'); const old = q.items[0].price; q.items[0].price = 1; const P = hjStmtLineEditPlan(q.id, 0, { d: '2026-10-02', amt: '1', skip: false }); q.items[0].price = old; return P.why || ''; });
      assert.match(hand, /손으로 고친 견적/);
      await page.evaluate(() => closeModal(true));
    });
    await context.close();
    await test('⑤ 폰 390 — 보기·고치기 창·월 목록 넘침 0 · 단추 44px · 오류 0 · 외부 쓰기 0 · 핀 (PHONE)', async () => {
      const { context: c2, page: p2 } = await open(390);
      await p2.evaluate(SEED);
      await p2.evaluate(() => { __hjStmtYm = '2026-09'; render(); });
      const view = await p2.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#view [data-stmt-odd-go],#view [data-stmt-ym]')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).length }));
      assert.ok(view.over <= 1, '탭 넘침 ' + view.over); assert.equal(view.small, 0);
      for (const which of ['detail', 'edit']) {
        if (which === 'detail') { await p2.evaluate(() => hjStmtDetailView('S917.xlsx')); await p2.waitForSelector('#modalRoot [data-stmt-detail="S917.xlsx"]'); }
        else await openEdit(p2, 'S917.xlsx', '다솜아파트', 0);
        const ui = await p2.evaluate(() => {
          const m = document.querySelector('#modalRoot .modal') || document.querySelector('#modalRoot'), mr = m.getBoundingClientRect();
          return { over: document.documentElement.scrollWidth - innerWidth, modalOver: m.scrollWidth - m.clientWidth, right: Math.round(mr.right), vw: innerWidth,
            small: [...document.querySelectorAll('#modalRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim()) };
        });
        assert.ok(ui.over <= 1 && ui.modalOver <= 1 && ui.right <= ui.vw, which + ' 넘침 없음 ' + JSON.stringify(ui));
        assert.deepEqual(ui.small, [], which + ' 44px');
        await p2.evaluate(() => closeModal(true));
      }
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8'), src = html || SRC;
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 628, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      await c2.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtedit-v628: ${passed}/5 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtedit-v628 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

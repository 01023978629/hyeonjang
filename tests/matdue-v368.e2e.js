/* matdue-v368.e2e.js — v368 🚚 자재 발주 → 납품 확인 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음.
   · 현장 레코드 안 matOrders {id,sup,items,due,at,recvAt,memo}. 상태: 지남 ⚠ / 오늘 / D-n / 미정 / 입고 ✅, 그 순서로 정렬.
   · 📦 발주 문자 화면 카드 [🚚 납품 확인에 올리기](현장 있는 묶음만, 같은 발주는 두 번 안 올림).
   · 현장 화면 '🚚 자재 납품' 칸(기록이 있거나 시공 단계) — [✅ 입고]·[+ 납품 예정]·[🚚 납품 확인 전체].
   · 🚚 납품 확인 창 — 입고 확인/취소·고치기·삭제·추가. 🔔 알림 '납품 확인 N건 · 지남 M건', 🌙 오늘 마감 '🚚 납품 확인'.
   · 그리는 것만으로는 저장본이 바뀌지 않고, 고객 페이지 자료에 거래처가 실리지 않는다. 오늘은 2026-11-05(목) 고정. */
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

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.__sms = []; window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = []; state.asLog = []; state.schedule = [];
    state.suppliers = [{ name: '가상타일상사', phone: '010-5555-6666' }]; state.supplierMap = {};
    const I = (name, qty, unit) => ({ name, spec: '', qty, unit });
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '' }, matOrders: [
        { id: 'm1', sup: '가상타일상사', items: [I('타일 600각', 42, '장')], due: '2026-11-04', at: '2026-11-01', recvAt: '', memo: '' },
        { id: 'm2', sup: '가상설비', items: [I('변기', 1, '대'), I('세면대', 1, '대')], due: '2026-11-05', at: '2026-11-01', recvAt: '', memo: '오전 하차' },
        { id: 'm3', sup: '가상목재', items: [I('합판 9T', 10, '장')], due: '2026-11-09', at: '2026-11-02', recvAt: '', memo: '' },
        { id: 'm4', sup: '가상도배', items: [I('실크 벽지', 8, '롤')], due: '2026-11-03', at: '2026-11-01', recvAt: '2026-11-03', memo: '' }] },
      { name: '가상현장B', stage: 1, received: 0, phases: [], cost: {}, customer: {}, matOrders: [
        { id: 'm5', sup: '가상조명', items: [I('다운라이트', 12, '개')], due: '2026-11-06', at: '2026-11-02', recvAt: '', memo: '' },
        { id: 'm6', sup: '가상창호', items: [I('방충망', 3, '틀')], due: '', at: '2026-11-02', recvAt: '', memo: '' }] },
      { name: '가상현장C', stage: 0, received: 0, phases: [], cost: {}, customer: {} }
    ];
    window.__sms = []; __calSelDate = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const h3 = () => page.evaluate(() => (document.querySelector('#modalRoot h3') || {}).textContent || '');
  const foot = re => page.evaluate(src => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re);

  await test('① 상태·정렬 — 지남 → 오늘 → 예정(날짜순) → 미정 → 입고, 품목 글·줄 나누기', async () => {
    await seed();
    const r = await page.evaluate(() => ({
      order: hjMatAll().map(x => x.o.id + '|' + x.st.k + '|' + x.st.t),
      items: hjMatItemsText(state.projects[0].matOrders[1].items), items3: hjMatItemsText(state.projects[0].matOrders[1].items, 3),
      parsed: hjMatParseItems('타일 600각 × 42장\n실리콘 x 5개\n\n줄눈'),
      pending: hjMatPending('2026-11-05').map(x => x.o.id), pendingTmr: hjMatPending('2026-11-06').map(x => x.o.id)
    }));
    assert(JSON.stringify(r.order) === JSON.stringify([
      'm1|late|⚠ 11/4(수) 납품 예정이었음 — 입고 확인 안 됨', 'm2|today|🚚 오늘 납품 11/5(목)', 'm5|soon|📅 11/6(금) 납품 예정 (D-1)',
      'm3|soon|📅 11/9(월) 납품 예정 (D-4)', 'm6|nodate|📦 납품일 미정', 'm4|recv|✅ 입고 11/3(화)']), '순서: ' + JSON.stringify(r.order));
    assert(r.items === '변기 × 1대 외 1종' && r.items3 === '변기 × 1대, 세면대 × 1대', '품목 글: ' + JSON.stringify([r.items, r.items3]));
    assert(JSON.stringify(r.parsed) === JSON.stringify([{ name: '타일 600각', spec: '', qty: 42, unit: '장' }, { name: '실리콘', spec: '', qty: 5, unit: '개' }, { name: '줄눈', spec: '', qty: '', unit: '' }]), '줄 나누기: ' + JSON.stringify(r.parsed));
    assert(JSON.stringify(r.pending) === JSON.stringify(['m1', 'm2']) && JSON.stringify(r.pendingTmr) === JSON.stringify(['m1', 'm2', 'm5']), '미입고: ' + JSON.stringify(r));
  });

  await test('② 현장 화면 \'🚚 자재 납품\' — 기다림·지남·입고 수, [✅ 입고]로 바로 입고, [+ 납품 예정]·[전체], 상담 단계·기록 없으면 칸 없음', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.tab = 'project'; state.activeProject = '가상현장A'; render();
      const card = () => document.querySelector('#view [data-pjmat]');
      const rows = () => [...document.querySelectorAll('#view [data-pjmatrow]')].map(x => x.dataset.pjmatrow);
      const before = { head: card().querySelector('.cust-h').textContent, rows: rows() };
      document.querySelector('#view [data-matrecv="m2"]').click(); await new Promise(r => setTimeout(r, 30));
      const after = { head: card().querySelector('.cust-h').textContent, rows: rows(), recv: state.projects[0].matOrders[1].recvAt };
      document.querySelector('#view [data-matadd="가상현장A"]').click();
      const add = { h3: document.querySelector('#modalRoot h3').textContent, due: document.getElementById('meDue').value, proj: !!document.getElementById('meProj') };
      document.getElementById('meSup').value = '가상유리'; document.getElementById('meItems').value = '거울 600x900 × 2장';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const added = state.projects[0].matOrders.find(o => o.sup === '가상유리');
      document.querySelector('#view [data-matview="가상현장A"]').click();
      const view = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      state.activeProject = '가상현장B'; render(); const b = !!card();
      state.activeProject = '가상현장C'; render(); const c = !!card();
      return { before, after, add, added, view, b, c, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(/기다림 3건 · 지남 1건 · 입고 1건/.test(r.before.head) && JSON.stringify(r.before.rows) === JSON.stringify(['m1', 'm2', 'm3']), '처음: ' + JSON.stringify(r.before));
    assert(r.after.recv === '2026-11-05' && /기다림 2건 · 지남 1건 · 입고 2건/.test(r.after.head) && JSON.stringify(r.after.rows) === JSON.stringify(['m1', 'm3']), '입고 뒤: ' + JSON.stringify(r.after));
    assert(r.add.h3 === '🚚 납품 예정 추가' && r.add.due === '2026-11-06' && !r.add.proj, '추가 창: ' + JSON.stringify(r.add));
    assert(r.added && r.added.due === '2026-11-06' && r.added.at === '2026-11-05' && r.added.recvAt === '' && JSON.stringify(r.added.items) === JSON.stringify([{ name: '거울 600x900', spec: '', qty: 2, unit: '장' }]), '추가: ' + JSON.stringify(r.added));
    assert(r.view === '🚚 자재 납품 확인 — 가상현장A' && r.b && !r.c && r.wide <= 0, '전체·칸 유무: ' + JSON.stringify(r));
  });

  await test('③ 🚚 납품 확인 창 — 칩 수, 입고 확인 → 최근 입고 → 입고 취소, 고치기(날짜), 삭제, 빈 칸은 저장 안 함', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const ids = sel => [...document.querySelectorAll('#matView ' + sel)].map(x => x.dataset.id);
      hjMatView(); const first = { h3: document.querySelector('#modalRoot h3').textContent, chips: document.querySelector('#matView > div').textContent, rows: ids('.mdRow'), recvBtns: ids('.mdRecv'), undo: ids('.mdUndo') };
      document.querySelector('#matView .mdRecv[data-id="m1"]').click();
      const recv = { at: state.projects[0].matOrders[0].recvAt, undo: ids('.mdUndo') };
      document.querySelector('#matView .mdUndo[data-id="m1"]').click();
      const undo = { at: state.projects[0].matOrders[0].recvAt, undo: ids('.mdUndo') };
      document.querySelector('#matView .mdEdit[data-id="m3"]').click();
      const edit = { h3: document.querySelector('#modalRoot h3').textContent, items: document.getElementById('meItems').value, due: document.getElementById('meDue').value, sup: document.getElementById('meSup').value };
      document.getElementById('meDue').value = '2026-11-10';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const saved = { h3: document.querySelector('#modalRoot h3').textContent, due: state.projects[0].matOrders[2].due, items: state.projects[0].matOrders[2].items };
      document.querySelector('#matView .mdEdit[data-id="m6"]').click();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /삭제/.test(b.textContent)).click();
      const del = { left: state.projects[1].matOrders.map(o => o.id), h3: document.querySelector('#modalRoot h3').textContent };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /납품 예정 추가/.test(b.textContent)).click();
      const proj = !!document.getElementById('meProj');
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const empty = { h3: document.querySelector('#modalRoot h3').textContent, n: state.projects.reduce((t, p) => t + (p.matOrders || []).length, 0) };
      return { first, recv, undo, edit, saved, del, proj, empty };
    });
    assert(r.first.h3 === '🚚 자재 납품 확인' && /⚠ 지남 1/.test(r.first.chips) && /🚚 오늘 1/.test(r.first.chips) && /📅 예정 2/.test(r.first.chips) && /미정 1/.test(r.first.chips), '칩: ' + JSON.stringify(r.first));
    assert(JSON.stringify(r.first.rows) === JSON.stringify(['m1', 'm2', 'm5', 'm3', 'm6', 'm4']) && JSON.stringify(r.first.undo) === JSON.stringify(['m4']), '줄: ' + JSON.stringify(r.first));
    assert(r.recv.at === '2026-11-05' && r.recv.undo.includes('m1') && r.undo.at === '' && !r.undo.undo.includes('m1'), '입고·취소: ' + JSON.stringify([r.recv, r.undo]));
    assert(r.edit.h3 === '🚚 납품 기록 고치기' && r.edit.items === '합판 9T × 10장' && r.edit.due === '2026-11-09' && r.edit.sup === '가상목재', '고치기 창: ' + JSON.stringify(r.edit));
    assert(r.saved.h3 === '🚚 자재 납품 확인' && r.saved.due === '2026-11-10' && JSON.stringify(r.saved.items) === JSON.stringify([{ name: '합판 9T', spec: '', qty: 10, unit: '장' }]), '고친 뒤: ' + JSON.stringify(r.saved));
    assert(JSON.stringify(r.del.left) === JSON.stringify(['m5']) && r.del.h3 === '🚚 자재 납품 확인', '삭제: ' + JSON.stringify(r.del));
    assert(r.proj && r.empty.h3 === '🚚 납품 예정 추가' && r.empty.n === 5, '빈 칸 저장 안 함: ' + JSON.stringify(r.empty));
  });

  await test('④ 📦 발주 문자 화면 [🚚 납품 확인에 올리기] — 현장 있는 묶음만, 거래처별로, 같은 발주는 두 번 안 올림', async () => {
    await seed();
    const r = await page.evaluate(() => {
      materialOrderResult({ id: 'q1', project: '가상현장A' }, [
        { name: '타일 300각', spec: '', qty: 20, unit: '장', sup: '가상타일상사', project: '' },
        { name: '타일 본드', spec: '', qty: 3, unit: '통', sup: '가상타일상사', project: '' },
        { name: '각재', spec: '', qty: 5, unit: '단', sup: '가상목재', project: '' }], '2026-11-08');
      const btns = [...document.querySelectorAll('#modalRoot .moRec')];
      const n0 = state.projects[0].matOrders.length;
      const tile = btns.find(b => /가상타일상사/.test(b.closest('div[style*="border-radius:10px"]').textContent));
      tile.click();
      const after = { label: tile.textContent, dis: tile.disabled, n: state.projects[0].matOrders.length, o: state.projects[0].matOrders[n0] };
      const dup = hjMatRecord('가상현장A', { sup: after.o.sup, items: after.o.items, due: '2026-11-08' });
      materialOrderResult({ id: '', project: '' }, [{ name: '실리콘', spec: '', qty: 10, unit: '개', sup: '가상타일상사', project: '' }], '2026-11-06');
      const shop = document.querySelectorAll('#modalRoot .moRec').length;
      closeModal(true);
      return { cards: btns.length, labels: btns.map(b => b.textContent), after, dup: dup.dup, n2: state.projects[0].matOrders.length, shop };
    });
    assert(r.cards === 2 && r.labels.every(t => t === '🚚 납품 확인에 올리기' || /올림/.test(t)), '카드 버튼: ' + JSON.stringify(r.labels));
    assert(r.after.label === '✅ 납품 확인에 올림' && r.after.dis && r.after.n === 5, '올림: ' + JSON.stringify(r.after));
    const o = r.after.o;
    assert(o.sup === '가상타일상사' && o.due === '2026-11-08' && o.at === '2026-11-05' && o.recvAt === '' && JSON.stringify(o.items) === JSON.stringify([{ name: '타일 300각', spec: '', qty: 20, unit: '장' }, { name: '타일 본드', spec: '', qty: 3, unit: '통' }]), '기록: ' + JSON.stringify(o));
    assert(r.dup === true && r.n2 === 5, '같은 발주 두 번: ' + JSON.stringify(r));
    assert(r.shop === 0, '현장 없는(작업실 재고) 발주는 올리기 버튼 없음: ' + r.shop);
  });

  await test('⑤ 🔔 알림 \'납품 확인 2건 · 지남 1건\' → 납품 확인 창, 🌙 오늘 마감 \'🚚 납품 확인 3\' → [🚚 납품 확인] → ← 뒤로 = 오늘 마감', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const it = briefExtraItems().filter(x => x.action === 'matdue').map(x => x.t);
      alertCenter(); const item = document.querySelector('#modalRoot .alertItem[data-act="matdue"]'); const has = !!item; item.click();
      const fromAlert = document.querySelector('#modalRoot h3').textContent;
      closeModal(true);
      const dc = hjDayCloseData().mat.map(x => x.o.id);
      hjDayCloseView(); const dcText = document.getElementById('dayClose').textContent;
      document.querySelector('#dayClose [data-dc-mat]').click(); const opened = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)).click();
      const back = document.querySelector('#modalRoot h3').textContent;
      closeModal(true);
      state.projects.forEach(p => delete p.matOrders);
      const none = briefExtraItems().filter(x => x.action === 'matdue').length;
      hjDayCloseView(); const noneDc = /납품 확인/.test(document.getElementById('dayClose').textContent); closeModal(true);
      return { it, has, fromAlert, dc, dcHas: /🚚 납품 확인 3/.test(dcText), opened, back, none, noneDc };
    });
    assert(JSON.stringify(r.it) === JSON.stringify(['납품 확인 2건 · 지남 1건']) && r.has && r.fromAlert === '🚚 자재 납품 확인', '알림: ' + JSON.stringify(r));
    assert(JSON.stringify(r.dc) === JSON.stringify(['m1', 'm2', 'm5']) && r.dcHas && r.opened === '🚚 자재 납품 확인' && /^🌙 오늘 마감/.test(r.back), '오늘 마감: ' + JSON.stringify(r));
    assert(r.none === 0 && !r.noneDc, '기록이 없으면 알림·칸 없음: ' + JSON.stringify(r));
  });

  await test('⑥ 그리는 것만으로는 저장본이 바뀌지 않고, 고객 페이지 자료에 거래처가 실리지 않는다 · 390px 가로 넘침 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      state.tab = 'project'; state.activeProject = '가상현장A'; render(); const w1 = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      hjMatView(); const w2 = document.documentElement.scrollWidth - document.documentElement.clientWidth; closeModal(true);
      hjMatView('가상현장B'); closeModal(true); briefExtraItems(); hjDayCloseView(); closeModal(true);
      state.tab = 'dashboard'; state.activeProject = null; render();
      const portal = JSON.stringify(portalBuild('가상현장A') || {});
      return { same: snap() === b0, w1, w2, leak: /가상타일상사|타일 600각|matOrders/.test(portal), saved: /가상타일상사/.test(JSON.stringify(serializeData().projects)) };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.w1 <= 0 && r.w2 <= 0, '가로 넘침: ' + JSON.stringify(r));
    assert(!r.leak && r.saved, '고객 페이지에 실림/저장본에 없음: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== matdue-v368: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

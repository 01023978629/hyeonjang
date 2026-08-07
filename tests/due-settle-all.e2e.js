/* due-settle-all.e2e.js — 미수금 여러 곳 한 번에 완납 처리

   배경: 대표가 "오늘 전으로 된 거는 모두 완납"이라고 했다. 그런데 화면에는
   현장별 [💰 입금] 하나뿐이라 열 곳이면 열 번 눌러야 했다.
   그렇다고 set_received 로 0 을 밀면 **그동안 받은 기록이 통째로 사라져**
   부가세 근거가 날아간다. 그래서 더하는(누적) 일괄 처리를 만든다.

     ① 미수금이 2곳 이상일 때만 일괄 버튼이 뜬다
     ② 체크한 곳만 처리된다 — 해제한 곳은 그대로 남는다
     ③ 덮어쓰지 않고 **더한다** (기존 수금 기록 보존)
     ④ 현장마다 payLog 1건 — "언제 얼마"가 남는다
     ⑤ 미래 입금일은 거부
     ⑥ 실행 전 안전판(hjSnapshot) — 되돌릴 수 있어야 한다
     ⑦ 처리한 현장의 미수금 독촉 작업은 큐에서 빠진다
     ⑧ 취소하면 아무것도 안 바뀐다
     ⑨ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
    state.projects = [
      // A: 일부 수금됨 — 누적되어야 한다(덮어쓰면 100만이 사라진다)
      { name: 'A빌라', stage: 3, received: 1000000, doneAt: ago(70), cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false },
      { name: 'B상가', stage: 3, received: 0, doneAt: ago(40), cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false },
      { name: 'C주택', stage: 3, received: 0, doneAt: ago(10), cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }
    ];
    state.files = [
      { id: 'e1', kind: 'estimate', project: 'A빌라', name: 'A견적', est: { amount: 3000000 }, when: new Date() },
      { id: 'e2', kind: 'estimate', project: 'B상가', name: 'B견적', est: { amount: 2000000 }, when: new Date() },
      { id: 'e3', kind: 'estimate', project: 'C주택', name: 'C견적', est: { amount: 500000 }, when: new Date() }
    ];
    state.payLog = []; state.expenses = [];
    const o = aiOpsEnsureState(); o.enabled = true;
    o.queue = [
      { id: 'q1', category: '수금', type: 'aging', title: '미수금 독촉: A빌라', reason: 'x', project: 'A빌라', status: 'pending', priority: 'high', requiresApproval: true, action: { kind: 'sms', fn: 'agingSms', arg: 'A빌라' }, createdAt: new Date().toISOString() },
      { id: 'q2', category: '수금', type: 'aging', title: '미수금 독촉: C주택', reason: 'x', project: 'C주택', status: 'pending', priority: 'normal', requiresApproval: true, action: { kind: 'sms', fn: 'agingSms', arg: 'C주택' }, createdAt: new Date().toISOString() }
    ];
  });

  const seed = await page.evaluate(() => ({ a: projStats('A빌라').due, b: projStats('B상가').due, c: projStats('C주택').due }));
  assert(seed.a === 2000000 && seed.b === 2000000 && seed.c === 500000, '시드 미수액이 틀리다: ' + JSON.stringify(seed));

  // ① 일괄 버튼
  const btn = await page.evaluate(() => { dueAgingView(); return !!document.getElementById('agAll'); });
  assert(btn, '① 미수금이 여러 곳인데 일괄 버튼이 없다 — 한 곳씩 열 번 눌러야 한다');

  // ⑧ 취소는 아무것도 안 바꾼다
  const cancel = await page.evaluate(async () => {
    dueSettleAll();
    await new Promise(r => setTimeout(r, 200));
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/취소/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 200));
    return { recv: state.projects.map(p => p.received), logs: (state.payLog || []).length };
  });
  assert(cancel.recv.join(',') === '1000000,0,0' && cancel.logs === 0, '⑧ 취소했는데 장부가 바뀌었다');

  // ⑤ 미래 날짜 거부
  const future = await page.evaluate(async () => {
    dueSettleAll();
    await new Promise(r => setTimeout(r, 200));
    const d = new Date(); d.setDate(d.getDate() + 2);
    document.getElementById('dsDate').value = localDate(d);
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; };
    window.confirm = () => true;
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/완납 처리/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 250));
    window.toast = rt;
    return { msg, logs: (state.payLog || []).length };
  });
  assert(/미래/.test(future.msg), '⑤ 미래 입금일이 통과했다: ' + future.msg);
  assert(future.logs === 0, '⑤ 거부했는데 기록이 남았다');

  // ②③④⑥⑦ 본 처리 — B상가는 체크 해제
  const run = await page.evaluate(async () => {
    window.__snaps = [];
    const real = window.hjSnapshot;
    window.hjSnapshot = async (label) => { window.__snaps.push({ label: String(label || ''), logs: (state.payLog || []).length }); return true; };
    window.confirm = () => true;
    const today = localDate();
    document.getElementById('dsDate').value = today;
    // B상가 체크 해제
    document.querySelectorAll('.dsChk').forEach(c => {
      const i = +c.dataset.i;
      const nm = document.querySelectorAll('.dsChk')[i].parentElement.textContent || '';
      if (/B상가/.test(nm)) { c.checked = false; c.onchange(); }
    });
    const sumTxt = document.getElementById('dsSum').textContent || '';
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/완납 처리/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 700));
    window.hjSnapshot = real;
    const g = n => state.projects.find(p => p.name === n);
    return {
      sumTxt, today,
      a: g('A빌라').received, b: g('B상가').received, c: g('C주택').received,
      dueA: projStats('A빌라').due, dueB: projStats('B상가').due, dueC: projStats('C주택').due,
      logs: (state.payLog || []).slice(),
      snaps: window.__snaps,
      queue: aiOpsEnsureState().queue.map(t => t.id)
    };
  });

  assert(/2곳 선택/.test(run.sumTxt) && /2,500,000/.test(run.sumTxt), '② 선택 합계가 틀리다: ' + run.sumTxt);
  // ③ 누적 — A빌라는 기존 100만 + 미수 200만 = 300만 (덮어쓰면 200만이 된다)
  assert(run.a === 3000000, '③ 덮어썼다 — 기존 수금 100만이 사라졌다: ' + run.a);
  assert(run.c === 500000, '③ C주택 완납이 안 됐다: ' + run.c);
  assert(run.b === 0 && run.dueB === 2000000, '② 체크 해제한 B상가가 처리됐다');
  assert(run.dueA === 0 && run.dueC === 0, '③ 미수가 0이 아니다: ' + run.dueA + '/' + run.dueC);

  // ④ payLog — 현장마다 1건, 금액은 그 현장 미수액
  assert(run.logs.length === 2, '④ payLog 건수가 틀리다(현장마다 1건이어야 한다): ' + run.logs.length);
  const la = run.logs.find(x => x.project === 'A빌라'), lc = run.logs.find(x => x.project === 'C주택');
  assert(la && la.amt === 2000000 && la.d === run.today, '④ A빌라 수금 기록이 틀리다: ' + JSON.stringify(la));
  assert(lc && lc.amt === 500000, '④ C주택 수금 기록이 틀리다: ' + JSON.stringify(lc));
  assert(!run.logs.some(x => x.project === 'B상가'), '④ 처리 안 한 현장이 기록됐다');

  // ⑥ 안전판이 **바뀌기 전에** 찍혀야 한다
  const mine = run.snaps.filter(x => /일괄 완납/.test(x.label));
  assert(mine.length >= 1, '⑥ 실행 전 안전판을 안 찍는다 — 되돌릴 수 없다');
  assert(mine[0].logs === 0, '⑥ 안전판이 변경 뒤에 찍힌다 — 되돌릴 시점이 지났다');

  // ⑦ 처리한 현장의 독촉 작업은 큐에서 빠진다
  assert(run.queue.indexOf('q1') < 0 && run.queue.indexOf('q2') < 0,
    '⑦ 완납했는데 독촉 작업이 남아 있다 — 알림이 계속 뜨고 재승인하면 문자가 나간다: ' + JSON.stringify(run.queue));

  assert(errors.length === 0, '⑨ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 여러 곳일 때 일괄 버튼');
  console.log('PASS  ② 체크한 곳만 처리 (해제한 곳 보존)');
  console.log('PASS  ③ 덮어쓰지 않고 누적');
  console.log('PASS  ④ 현장마다 payLog 1건 (언제·얼마)');
  console.log('PASS  ⑤ 미래 입금일 거부');
  console.log('PASS  ⑥ 실행 전 안전판');
  console.log('PASS  ⑦ 독촉 작업 큐에서 제거');
  console.log('PASS  ⑧ 취소는 무변경');
  console.log('PASS  ⑨ pageerror 0');
  console.log('\n전부 통과 (9건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

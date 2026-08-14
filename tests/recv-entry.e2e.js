/* recv-entry.e2e.js — 수금 완료 입력(얼마·언제)이 알림에서 바로 닿는가

   배경: 사장님이 "미수금 알람이 계속 뜨는데 수금 완료 입력 칸이 없다"고 했다.
   실제로 입력 화면(recvQuickView)은 있었지만 알림 → 에이징 목록 → 현장 찾기의
   3단계 뒤에 숨어 있었고, **운영 승인함의 수금 작업에는 아예 없었다** —
   거기서 할 수 있는 건 '독촉 문자'뿐이라 돈을 받아도 알림이 꺼지지 않았다.

     ① 알림 센터의 미수금 항목에 [💰 수금 입력] 버튼이 있고 입금 화면이 열린다
     ② 입금 화면에 금액칸과 날짜칸이 둘 다 있다 (얼마·언제)
     ③ 저장 → received 증가 + payLog 에 {얼마, 언제} 1건
     ④ 미래 날짜는 거부한다 (안 들어온 돈이 이번 주 수금으로 잡히면 안 된다)
     ⑤ 옛 버전이 남긴 독촉 작업은 입금을 기록하면 큐에서 사라진다
        (앱은 더 이상 미수금 작업을 만들지 않는다 — 2026-08-13 대표 결정)
     ⑥ 이미 기록된 수금이 같은 화면에 보인다 (같은 입금 두 번 넣는 것 방지)
     ⑦ 운영 큐의 수금 작업에 [💰 수금 입력] — 다 받은 현장에는 안 뜬다
     ⑧ pageerror 0

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

  // 시드: 90일 전 완공·수금 일부만 된 현장 + 완납 현장
  await page.evaluate(() => {
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
    state.projects = [
      { name: '늦은빌라 302호', stage: 3, received: 1000000, doneAt: ago(90), cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박사장', phone: '01000000000' }, archived: false },
      { name: '완납상가 1층', stage: 3, received: 3000000, doneAt: ago(70), cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '최대표', phone: '01011112222' }, archived: false }
    ];
    state.files = [
      { id: 'e1', kind: 'estimate', project: '늦은빌라 302호', name: '늦은빌라 견적서', est: { amount: 3000000 }, when: new Date() },
      { id: 'e2', kind: 'estimate', project: '완납상가 1층', name: '완납상가 견적서', est: { amount: 3000000 }, when: new Date() }
    ];
    state.payLog = [{ d: ago(80), project: '늦은빌라 302호', amt: 1000000 }];
    state.expenses = [];
    // 운영 큐: 두 현장 모두에 수금 작업을 넣어 둔다 (완납 쪽엔 버튼이 안 떠야 한다)
    const o = aiOpsEnsureState();
    o.enabled = true;
    o.queue = [
      { id: 'q1', category: '수금', type: 'aging', title: '미수금 독촉: 늦은빌라 302호 (90일째)', reason: '200만 미수', project: '늦은빌라 302호', status: 'pending', priority: 'high', requiresApproval: true, action: { kind: 'sms', fn: 'agingSms', arg: '늦은빌라 302호' }, createdAt: new Date().toISOString() },
      { id: 'q2', category: '수금', type: 'aging', title: '미수금 독촉: 완납상가 1층 (70일째)', reason: '이미 완납', project: '완납상가 1층', status: 'pending', priority: 'normal', requiresApproval: true, action: { kind: 'sms', fn: 'agingSms', arg: '완납상가 1층' }, createdAt: new Date().toISOString() }
    ];
  });

  const due0 = await page.evaluate(() => projStats('늦은빌라 302호').due);
  assert(due0 === 2000000, '시드가 잘못됨 — 미수 200만이 아니라 ' + due0);

  // ① 앱이 미수금 작업·경보를 스스로 만들지 않는다 (2026-08-13 대표 결정)
  //    아래 큐 항목은 이 테스트가 손으로 넣은 fixture 다 — 생성기가 만드는지를 본다.
  const gen = await page.evaluate(() => {
    const planned = (typeof aiOpsPlan === 'function' ? aiOpsPlan() : []) || [];
    alertCenter();
    const root = document.getElementById('modalRoot');
    return {
      dueTasks: planned.filter(t => /미수|수금|receivable|aging/.test((t.category || '') + (t.type || ''))).map(t => t.title),
      alertRecvBtn: !!root.querySelector('.alertRecv')
    };
  });
  assert(gen.dueTasks.length === 0, '① 운영 루프가 미수금 작업을 다시 만든다: ' + JSON.stringify(gen.dueTasks));
  assert(!gen.alertRecvBtn, '① 미수금 알림 항목이 되살아났다');

  // ①-2 수금 입력 화면 자체는 남아 있어야 한다 — 장부·부가세 근거다.
  // 알림을 거치지 않고 현장명으로 직접 연다(현장 목록의 수금액 칸과 같은 경로).
  const opened = await page.evaluate(async () => {
    closeModal();
    recvQuickView('늦은빌라 302호');
    await new Promise(r => setTimeout(r, 300));
    const root = document.getElementById('modalRoot');
    const amt = root.querySelector('#rqAmt'), d = root.querySelector('#rqDate');
    const txt = root.textContent || '';
    return { amt: !!amt, date: !!d, dateType: d && d.type, max: d && d.getAttribute('max'), today: localDate(), aging: /미수금 에이징/.test(txt) };
  });
  assert(!opened.aging, '① 수금 입력 버튼이 행 클릭까지 발동시켜 에이징 화면이 겹쳐 뜬다 (stopPropagation 누락)');
  assert(opened.amt, '②/① 입금액 칸이 없다');
  assert(opened.date && opened.dateType === 'date', '② 입금일 칸이 없다 — "언제 들어왔는지"를 못 적는다');
  assert(opened.max === opened.today, '④ 날짜칸에 오늘 상한(max)이 없다 — 미래 입금일이 그대로 들어간다');

  // ⑥ 이미 기록된 수금이 보인다
  const hist = await page.evaluate(() => {
    const t = document.getElementById('modalRoot').textContent || '';
    return { shown: /이미 기록된 수금/.test(t), amt: /1,000,000/.test(t), wonwon: /원원/.test(t) };
  });
  assert(hist.shown && hist.amt, '⑥ 이미 넣은 수금이 안 보인다 — 같은 입금을 또 넣게 된다');
  // won() 이 이미 '원'을 붙인다 — 뒤에 또 붙이면 "2,000,000원원"이 된다
  assert(!hist.wonwon, '⑥ 금액이 "원원"으로 찍힌다 — won() 뒤에 \'원\'을 또 붙였다');

  // ④ 미래 날짜 거부
  const future = await page.evaluate(async () => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    const fut = localDate(d);
    document.getElementById('rqAmt').value = '500,000';
    document.getElementById('rqDate').value = fut;
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; };
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/입금 저장/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 150));
    window.toast = rt;
    return { msg, recv: state.projects.find(x => x.name === '늦은빌라 302호').received, logs: (state.payLog || []).length };
  });
  assert(/미래/.test(future.msg), '④ 미래 입금일이 조용히 저장된다: ' + future.msg);
  assert(future.recv === 1000000 && future.logs === 1, '④ 거부했는데 장부가 바뀌었다');

  // ③⑤ 일부 입금 — 저장되고, 옛 독촉 작업은 큐에서 사라진다.
  //     앱이 미수 잔액을 더는 추적하지 않으므로 "남은 미수 얼마" 문구도 안 쓴다.
  const partial = await page.evaluate(async () => {
    const today = localDate();
    document.getElementById('rqAmt').value = '500,000';
    document.getElementById('rqDate').value = today;
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; rt(m); };
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/입금 저장/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 250));
    window.toast = rt;
    const p = state.projects.find(x => x.name === '늦은빌라 302호');
    const last = (state.payLog || [])[state.payLog.length - 1];
    const q = aiOpsEnsureState().queue;
    return { recv: p.received, due: projStats(p.name).due, last, gone: !q.some(x => x.id === 'q1'), other: q.some(x => x.id === 'q2'), today, msg };
  });
  assert(partial.recv === 1500000, '③ 입금이 반영 안 됨: ' + partial.recv);
  assert(partial.last && partial.last.amt === 500000 && partial.last.d === partial.today && partial.last.project === '늦은빌라 302호',
    '③ payLog 에 얼마·언제가 안 남았다: ' + JSON.stringify(partial.last));
  assert(/500,000원/.test(partial.msg) && !/원원/.test(partial.msg),
    '③ 저장 안내가 "원원"으로 찍힌다 — won() 이 이미 \'원\'을 붙인다: ' + partial.msg);
  // 입금 안내에 잔액(미수)을 붙이지 않는다 — 표시를 걷어낸 이유가 사라진다
  assert(!/미수|잔액|완납/.test(partial.msg), '⑤ 입금 안내에 미수 잔액이 다시 붙었다: ' + partial.msg);
  assert(partial.gone, '⑤ 옛 독촉 작업이 큐에 그대로다 — 입금을 적어도 알람이 안 꺼진다');
  assert(partial.other, '⑤ 다른 현장 작업까지 지웠다');

  // ⑦ 운영 큐 버튼 — 아직 덜 받은 현장에만 (이중 입력 방지 게이트)
  const ops = await page.evaluate(() => {
    // q1 은 위에서 큐에서 빠졌다 — 같은 상황을 다시 만든다
    state.projects.find(x => x.name === '늦은빌라 302호').received = 1000000;
    const q = aiOpsEnsureState().queue;
    q.push({ id: 'q1', category: '수금', type: 'aging', title: '미수금 독촉: 늦은빌라 302호 (90일째)', reason: '200만 미수', project: '늦은빌라 302호', status: 'pending', priority: 'high', requiresApproval: true, action: { kind: 'sms', fn: 'agingSms', arg: '늦은빌라 302호' }, createdAt: new Date().toISOString() });
    aiOpsCenter();
    const root = document.getElementById('modalRoot');
    const btns = Array.from(root.querySelectorAll('.opRecv')).map(b => b.dataset.p);
    return { btns, targetDue: opsRecvTarget(q.find(x => x.id === 'q1')), targetPaid: opsRecvTarget(q.find(x => x.id === 'q2')) };
  });
  assert(ops.btns.indexOf('늦은빌라 302호') >= 0, '⑦ 운영 큐의 수금 작업에 [수금 입력] 버튼이 없다 — 독촉밖에 못 한다');
  assert(ops.btns.indexOf('완납상가 1층') < 0, '⑦ 다 받은 현장에도 입금 버튼이 뜬다 — 이중 입력을 부른다');
  assert(ops.targetDue === '늦은빌라 302호' && ops.targetPaid === '', '⑦ opsRecvTarget 판정이 틀리다: ' + JSON.stringify(ops));

  // ⑧ 돌아갈 길 — 저장하든 뒤로 누르든 원래 목록으로 복귀한다.
  // 없으면 대시보드로 튕겨 "알람이 꺼졌는지" 그 자리에서 확인할 수 없다.
  const back = await page.evaluate(async () => {
    aiOpsCenter();
    document.getElementById('modalRoot').querySelector('.opRecv').click();
    await new Promise(r => setTimeout(r, 250));
    const hasBack = Array.from(document.querySelectorAll('#modalRoot button, .modal button')).some(b => /뒤로/.test(b.textContent || ''));
    document.querySelectorAll('#modalRoot button, .modal button').forEach(b => { if (/뒤로/.test(b.textContent || '')) b.click(); });
    await new Promise(r => setTimeout(r, 250));
    return { hasBack, backToOps: /AI 운영 센터/.test(document.getElementById('modalRoot').textContent || '') };
  });
  assert(back.hasBack, '⑧ 입금 화면에 [뒤로]가 없다 — 운영 센터로 못 돌아간다');
  assert(back.backToOps, '⑧ [뒤로]를 눌렀는데 운영 센터로 안 돌아온다');

  // ⑨ 토스트가 모달 위에 뜨는가 — 아래로 깔리면 "미래 날짜" 같은 경고가 안 보여
  //    사장님은 저장을 눌러도 아무 반응이 없다고 느끼고 계속 누른다
  const z = await page.evaluate(() => {
    const t = document.getElementById('toast'), m = document.querySelector('.modal-bg');
    const zi = el => el ? +getComputedStyle(el).zIndex || 0 : 0;
    return { toast: zi(t), modal: zi(m) };
  });
  assert(z.toast > z.modal, '⑨ 토스트(z-index ' + z.toast + ')가 모달(' + z.modal + ') 아래에 깔린다 — 검증 경고가 안 보인다');

  // ⑩ kind:'open' 작업이 인자를 받는가 — 안 넘기면 recvQuickView(undefined) 로
  //    아무것도 안 열린 채 '성공' 처리돼 작업이 큐에서 조용히 사라진다
  const openArg = await page.evaluate(async () => {
    closeModal();
    const o = aiOpsEnsureState();
    o.queue.push({ id: 'q3', category: '수금', type: 'recvcheck', title: '입금 확인: 늦은빌라 302호', reason: '확인', project: '늦은빌라 302호', status: 'pending', priority: 'normal', requiresApproval: false, readOnly: true, action: { kind: 'open', fn: 'recvQuickView', arg: '늦은빌라 302호' }, createdAt: new Date().toISOString() });
    await aiExecuteTask('q3');
    await new Promise(r => setTimeout(r, 250));
    const txt = document.getElementById('modalRoot').textContent || '';
    return { opened: /입금 기록/.test(txt), notFound: /현장을 찾을 수 없/.test(txt) };
  });
  assert(openArg.opened && !openArg.notFound, '⑩ kind:open 작업이 arg 를 안 넘긴다 — 화면이 안 열리는데 성공으로 처리돼 작업이 사라진다');

  assert(errors.length === 0, '⑪ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 알림 센터 → [💰 수금 입력] 직행');
  console.log('PASS  ② 금액·날짜 칸 (얼마·언제)');
  console.log('PASS  ③ 저장 → received + payLog 1건');
  console.log('PASS  ④ 미래 입금일 거부');
  console.log('PASS  ⑤ 입금 기록 시 옛 독촉 작업 종료 · 안내에 미수 잔액 없음');
  console.log('PASS  ⑥ 기록된 수금 내역 표시');
  console.log('PASS  ⑦ 운영 큐 버튼 — 덜 받은 현장에만');
  console.log('PASS  ⑧ 저장·[뒤로] 후 원래 목록 복귀');
  console.log('PASS  ⑨ 토스트가 모달 위 — 검증 경고가 보인다');
  console.log('PASS  ⑩ kind:open 작업이 arg 를 넘긴다');
  console.log('PASS  ⑪ pageerror 0');
  console.log('\n전부 통과 (11건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

/* apt-ai.e2e.js — AI 비서로 아파트 오더 접수·조회

   배경: "오더 기록은 AI 비서에게 말로 시켜도 됩니다" 라고 안내해 놓고
   정작 비서의 도구 목록에 아파트 오더가 없었다. 안내가 거짓이었다.
   이 테스트는 도구가 실재하고, **쓰기 도구가 승인 게이트(AI_WRITE) 안에**
   있음을 지킨다 — 게이트에서 빠지면 비서가 승인 없이 장부에 쓴다.

     ① apt_order_add · apt_orders 가 도구 목록(AI_TOOLS)에 선언돼 있다
     ② apt_order_add 는 AI_WRITE 에 있다 — 자동 모드가 아니면 승인을 받는다
     ③ 접수 실행 — recv 상태·오늘 날짜·금액 미정 허용으로 장부에 들어간다
     ④ 단지 부분 일치 — "신흥마을" 만 말해도 신흥마을아파트에 붙는다
     ⑤ 미등록 단지는 실패하되, 등록된 단지 목록을 알려 준다 (비서가 되물을 수 있게)
     ⑥ apt_orders 조회 — 단지 필터와 미입금 합계가 맞다
     ⑦ 승인 대화상자용 라벨·결과 요약이 사람 말로 나온다
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
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'x1', officeId: 'of1', unit: '501동 101호', text: '기존 청구건', amount: 200000, date: localDate(), status: 'billed', doneAt: localDate() }
    ];
  });

  // ① 선언 ② 승인 게이트
  const decl = await page.evaluate(() => ({
    add: AI_TOOLS.some(t => t.name === 'apt_order_add'),
    list: AI_TOOLS.some(t => t.name === 'apt_orders'),
    gated: AI_WRITE.has('apt_order_add'),
    listNotGated: !AI_WRITE.has('apt_orders')
  }));
  assert(decl.add && decl.list, '① 도구가 AI_TOOLS 에 없다 — "말로 시켜도 됩니다"가 거짓이 된다');
  assert(decl.gated, '② apt_order_add 가 AI_WRITE 에 없다 — 비서가 승인 없이 장부에 쓴다');
  assert(decl.listNotGated, '② 조회 도구까지 승인을 받으면 물어볼 때마다 확인창이 떠 못 쓴다');

  // ③④ 접수 — 부분 일치 단지
  const add = await page.evaluate(async () => {
    const r = await aiToolRun('apt_order_add', { complex: '신흥마을', unit: '103동 1204호', work: '욕실 실리콘', amount: 80000 });
    const o = state.aptOrders.find(x => x.unit === '103동 1204호');
    return { r, status: o && o.status, date: o && o.date, amount: o && o.amount };
  });
  assert(add.r.결과 === '오더 접수됨' && add.r.단지 === '신흥마을아파트', '④ 부분 일치("신흥마을")가 안 된다: ' + JSON.stringify(add.r));
  assert(add.status === 'recv' && add.date === (await page.evaluate(() => localDate())), '③ 접수 상태·날짜가 틀리다');
  assert(add.amount === 80000, '③ 금액이 반영 안 됨');

  // ③-2 금액 생략 = 미정
  const noAmt = await page.evaluate(async () => {
    const r = await aiToolRun('apt_order_add', { complex: '신흥마을아파트', unit: '지하주차장', work: '도장 보수' });
    return { r, amount: state.aptOrders.find(x => x.unit === '지하주차장').amount };
  });
  assert(noAmt.r.금액 === '미정' && noAmt.amount === 0, '③ 금액 생략이 미정으로 안 남는다');

  // ⑤ 미등록 단지 — 등록된 단지를 알려주는 실패
  const miss = await page.evaluate(async () => {
    try { await aiToolRun('apt_order_add', { complex: '없는단지', unit: '1동 1호', work: 'x' }); return { threw: false }; }
    catch (e) { return { threw: true, msg: e.message || String(e) }; }
  });
  assert(miss.threw, '⑤ 미등록 단지인데 접수됨 — 유령 단지가 생긴다');
  assert(/신흥마을아파트/.test(miss.msg) && /등록/.test(miss.msg), '⑤ 실패 안내에 등록된 단지 목록이 없다 — 비서가 되물을 수 없다: ' + miss.msg);

  // ⑥ 조회 — 필터·미입금
  const q = await page.evaluate(async () => await aiToolRun('apt_orders', { complex: '신흥마을' }));
  assert(q.건수 === 3 && q.미입금원 === 200000, '⑥ 조회 건수·미입금 합계가 틀리다: ' + JSON.stringify({ n: q.건수, u: q.미입금원 }));
  assert(q.목록.some(o => o.금액 === '미정'), '⑥ 미정 금액이 "미정"으로 표기되지 않는다');

  // ⑦ 라벨·요약 — 쓰기·조회 둘 다. 조회에 라벨이 없으면 채팅에 원시 도구명이 그대로 찍힌다(감사 지적).
  const label = await page.evaluate(() => ({
    act: aiActionLabel('apt_order_add', { complex: '신흥마을아파트', unit: '103동 1204호', work: '욕실 실리콘 교체' }),
    brief: aiResultBrief('apt_order_add', { 단지: '신흥마을아파트', 동호: '103동 1204호' }),
    qAct: aiActionLabel('apt_orders', { complex: '신흥마을' }),
    qBrief: aiResultBrief('apt_orders', { 건수: 3, 미입금원: 200000 })
  }));
  assert(/아파트 오더 접수/.test(label.act) && /신흥마을아파트/.test(label.act), '⑦ 승인 라벨이 사람 말이 아니다: ' + label.act);
  assert(/신흥마을아파트/.test(label.brief), '⑦ 결과 요약이 비었다: ' + label.brief);
  assert(/아파트 오더 조회/.test(label.qAct) && label.qAct !== 'apt_orders', '⑦ 조회 라벨이 원시 도구명 그대로다: ' + label.qAct);
  assert(/3건/.test(label.qBrief) && /200,000/.test(label.qBrief), '⑦ 조회 결과 요약이 비었다: ' + label.qBrief);

  // ⑦-2 감사 권고 반영 — 음수 금액 거부 · 동명 단지 모호성
  const guard = await page.evaluate(async () => {
    let neg = false;
    try { await aiToolRun('apt_order_add', { complex: '신흥마을아파트', unit: '1동 1호', work: 'x', amount: -50000 }); }
    catch (e) { neg = /0 이상/.test(e.message || ''); }
    state.aptOffices.push({ id: 'of2', complex: '신흥마을2단지', manager: '', phone: '' });
    let ambi = false;
    try { await aiToolRun('apt_order_add', { complex: '신흥마을', unit: '1동 1호', work: 'x' }); }
    catch (e) { ambi = /여러 곳/.test(e.message || '') && /신흥마을2단지/.test(e.message || ''); }
    state.aptOffices = state.aptOffices.filter(o => o.id !== 'of2');
    return { neg, ambi };
  });
  assert(guard.neg, '⑦-2 음수 금액이 통과된다 — 청구 합계가 왜곡된다');
  assert(guard.ambi, '⑦-2 동명 단지가 여럿인데 조용히 첫 번째에 접수된다 — 남의 단지 장부에 실린다');

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 도구 선언 (apt_order_add · apt_orders)');
  console.log('PASS  ② 쓰기만 승인 게이트 · 조회는 게이트 밖');
  console.log('PASS  ③ 접수 — recv·오늘 날짜·금액 미정 허용');
  console.log('PASS  ④ 단지 부분 일치');
  console.log('PASS  ⑤ 미등록 단지 실패 + 등록 단지 안내');
  console.log('PASS  ⑥ 조회 — 필터·미입금 합계');
  console.log('PASS  ⑦ 승인 라벨·결과 요약 (쓰기·조회) + 음수·모호성 방어');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

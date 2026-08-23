/* ai-high-risk-confirm.e2e.js — AI 전체 자동 모드의 고위험 승인 게이트

   보호하는 사고:
     · 전체 자동 모드가 켜져 있어도 삭제·수금/지출·견적·고객 발송·일괄 수금은
       실제 실행 전에 사람이 [실행]을 눌러야 한다.
     · 고위험 도구를 SAFE_AUTO에 실수로 넣어도 승인 게이트를 우회하지 못한다.
     · 안전 자동 항목은 사용자가 수동으로 바꾸지 않은 경우에만 자동 실행된다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE || undefined;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const policy = await page.evaluate(() => {
    if (typeof aiWriteNeedsConfirm !== 'function') return { missing: true };
    const high = [
      'delete_project', 'delete_schedule',
      'set_received', 'batch_receive', 'add_expense', 'set_labor',
      'set_budget', 'set_goal', 'create_quote_draft', 'ai_quote', 'apt_order_add', 'ai_contract',
      'send_receipt', 'send_settle_doc', 'export_ledger', 'customer_page', 'customer_portal',
      'calendar_sync', 'ops_loop_approve', 'ops_loop_batch', 'auto_operate'
    ];
    window.__aiAuto = true;
    localStorage.removeItem('hj_auto_disabled');
    SAFE_AUTO.add('add_expense');
    const highResult = high.map(name => [name, aiWriteNeedsConfirm(name)]);
    SAFE_AUTO.delete('add_expense');
    const safeAuto = aiWriteNeedsConfirm('assign_photos');
    localStorage.setItem('hj_auto_disabled', JSON.stringify(['assign_photos']));
    const safeManual = aiWriteNeedsConfirm('assign_photos');
    localStorage.removeItem('hj_auto_disabled');
    return { missing: false, highResult, safeAuto, safeManual };
  });
  assert(!policy.missing, '고위험 승인 정책 함수가 없다');
  const bypass = policy.highResult.filter(x => !x[1]).map(x => x[0]);
  assert(bypass.length === 0, '전체 자동/SAFE_AUTO에서 고위험 도구가 승인을 우회한다: ' + bypass.join(', '));
  assert(policy.safeAuto === false, '안전 자동 항목까지 항상 확인하면 자동 정리 기능을 쓸 수 없다');
  assert(policy.safeManual === true, '사용자가 수동으로 바꾼 안전 항목이 승인 없이 실행된다');

  await page.evaluate(() => {
    window.__aiAuto = true;
    window.__geminiKey = 'TEST_ONLY_FAKE_GEMINI_KEY';
    state.expenses = [];
    aiSheetEl().style.display = 'flex';
    let round = 0;
    window.aiFC = async () => (++round === 1
      ? [{ functionCall: { name: 'add_expense', args: { amount: 12345, category: '자재', method: '현금', memo: 'TEST_ONLY' } } }]
      : [{ text: '완료' }]);
    window.__highRiskSend = aiAgentSend('TEST_ONLY 지출을 기록해');
  });
  await page.waitForTimeout(700);
  const pending = await page.evaluate(() => ({
    cards: document.querySelectorAll('#aiMsgs .ai-card').length,
    expenses: (state.expenses || []).length,
    title: (document.querySelector('#aiMsgs .ai-card-t') || {}).textContent || ''
  }));
  assert(pending.cards === 1 && /승인/.test(pending.title), '고위험 실행 승인 카드가 뜨지 않았다');
  assert(pending.expenses === 0, '승인 전에 지출이 장부에 기록됐다');

  await page.evaluate(async () => {
    document.querySelector('#aiMsgs .ai-card [data-no]').click();
    await window.__highRiskSend;
  });
  const after = await page.evaluate(() => (state.expenses || []).length);
  assert(after === 0, '취소했는데 고위험 지출이 실행됐다');
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  전체 자동 모드에서도 고위험 AI_WRITE 명시 승인 유지');
  console.log('PASS  고위험 도구가 SAFE_AUTO에 섞여도 승인 우회 불가');
  console.log('PASS  안전 자동 항목은 사용자 수동 전환을 존중');
  console.log('PASS  실제 지출 호출은 승인 카드에서 멈추고 취소 시 미실행');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

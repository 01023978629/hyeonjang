/* 마이너스 금액이 소리 없이 플러스로 뒤집히지 않는다 (v223)
   배경: won2num 은 숫자만 남긴다 — '-100,000' 이 +100,000 이 된다. 차감·환불을
   음수로 적으려던 입력이 오히려 지출·수금을 늘렸고, 화면 어디에도 경고가 없었다.
   수금이 부풀면 미수가 줄어 잔금 청구를 통째로 빠뜨린다.
   won2num 자체는 바꾸지 않는다 — 견적서 본문의 하이픈까지 음수로 읽히면 더 나쁘다.
   전제: tests/static-server.js(8299) 실행 중 */
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
async function test(name, fn) { try { await fn(); console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); } }

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageerrors = [];
  page.on('pageerror', e => pageerrors.push(String(e.message).slice(0, 110)));
  await page.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.setItem('hj_onboard_done', '1'); try { loadDemo(); } catch (e) {} });

  await test('지출: 마이너스는 거부하고 플러스로 바꿔 넣지 않는다', async () => {
    const r = await page.evaluate(() => {
      state.expenses = [];
      const out = {
        minus: expenseAdd({ amount: '-100,000', category: '자재' }),
        minusNum: expenseAdd({ amount: -50000, category: '자재' }),
        plus: expenseAdd({ amount: '100,000', category: '자재' })
      };
      out.saved = (state.expenses || []).map(e => e.amount);
      return out;
    });
    assert(!!r.minus.오류, '문자 마이너스가 통과함: ' + JSON.stringify(r.minus));
    assert(!!r.minusNum.오류, '숫자 마이너스가 통과함: ' + JSON.stringify(r.minusNum));
    assert(!!r.plus.기록, '정상 금액이 막힘: ' + JSON.stringify(r.plus));
    assert(r.saved.length === 1 && r.saved[0] === 100000, '지출 내역이 어긋남: ' + JSON.stringify(r.saved));
  });

  await test('수동 지출 창은 거부된 음수에 성공 안내를 표시하지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.expenses = [];
      const messages = [];
      const originalToast = window.toast;
      window.toast = message => messages.push(String(message));
      expenseAddDialog('2026-08');
      await new Promise(x => setTimeout(x, 250));
      document.getElementById('exAmt').value = '-100,000';
      [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.trim() === '저장')?.click();
      await new Promise(x => setTimeout(x, 250));
      const blocked = { count: state.expenses.length, messages: messages.slice() };

      expenseAddDialog('2026-08');
      await new Promise(x => setTimeout(x, 250));
      document.getElementById('exAmt').value = '100,000';
      [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.trim() === '저장')?.click();
      await new Promise(x => setTimeout(x, 250));
      const saved = { amounts: state.expenses.map(e => e.amount), messages: messages.slice() };
      window.toast = originalToast;
      try { closeModal(); } catch (e) {}
      return { blocked, saved };
    });
    assert(r.blocked.count === 0, '음수 수동 지출이 저장됨: ' + JSON.stringify(r.blocked));
    assert(r.blocked.messages.some(x => x.includes('마이너스')) && !r.blocked.messages.some(x => x.includes('기록했습니다')),
      '거부된 지출을 성공으로 안내함: ' + JSON.stringify(r.blocked.messages));
    assert(r.saved.amounts.length === 1 && r.saved.amounts[0] === 100000 && r.saved.messages.some(x => x.includes('기록했습니다')),
      '정상 수동 지출 저장 또는 안내가 막힘: ' + JSON.stringify(r.saved));
  });

  await test('수금 누계 수정: 마이너스는 반영되지 않는다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '부호검증', stage: 2, received: 3000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {} }];
      state.payLog = [];
      setReceived('부호검증', '-1,000,000');
      const after = state.projects[0].received;
      const logs = (state.payLog || []).length;
      setReceived('부호검증', '4,000,000');   // 정상 수정은 되어야 한다
      return { after, logs, normal: state.projects[0].received, logs2: (state.payLog || []).length };
    });
    assert(r.after === 3000000 && r.logs === 0, '마이너스가 수금에 반영됨: ' + JSON.stringify(r));
    assert(r.normal === 4000000 && r.logs2 === 1, '정상 수금 수정이 막힘: ' + JSON.stringify(r));
  });

  await test('입금 기록 창: 마이너스 입력은 저장되지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '부호검증2', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {} }];
      state.payLog = [];
      recvQuickView('부호검증2');
      await new Promise(x => setTimeout(x, 300));
      const el = document.getElementById('rqAmt');
      if (!el) return { skip: true };
      el.value = '-500000';
      const btn = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.includes('입금 저장'));
      if (btn) btn.click();
      await new Promise(x => setTimeout(x, 250));
      const blocked = { received: state.projects[0].received, logs: (state.payLog || []).length };
      const el2 = document.getElementById('rqAmt');
      if (el2) { el2.value = '500,000'; const b2 = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.includes('입금 저장')); if (b2) b2.click(); }
      await new Promise(x => setTimeout(x, 300));
      try { closeModal(); } catch (e) {}
      return { blocked, okReceived: state.projects[0].received, okLogs: (state.payLog || []).length };
    });
    assert(r.skip !== true, '입금 창을 열지 못함');
    assert(r.blocked.received === 0 && r.blocked.logs === 0, '마이너스 입금이 저장됨: ' + JSON.stringify(r.blocked));
    assert(r.okReceived === 500000 && r.okLogs === 1, '정상 입금이 막힘: ' + JSON.stringify(r));
  });

  await test('일괄 수금은 여러 음수 표기를 양수로 뒤집지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '일괄부호', stage: 2, received: 1000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {} }];
      state.payLog = [];
      const samples = ['-100,000', '₩-100,000', '－100,000', '(100,000)'];
      const results = [];
      for (const amount of samples) {
        const out = await batchReceive([{ query: '일괄부호', amount }], {});
        results.push({ amount, processed: out.처리, received: state.projects[0].received, logs: state.payLog.length });
      }
      const plus = await batchReceive([{ query: '일괄부호', amount: '100,000' }], {});
      return { results, plus: { processed: plus.처리, received: state.projects[0].received, logs: state.payLog.length } };
    });
    assert(r.results.every(x => x.processed === 0 && x.received === 1000000 && x.logs === 0),
      '음수 일괄 수금이 저장됨: ' + JSON.stringify(r.results));
    assert(r.plus.processed === 1 && r.plus.received === 1100000 && r.plus.logs === 1,
      '정상 일괄 수금이 막힘: ' + JSON.stringify(r.plus));
  });

  await test('영수증 확인 창은 음수 OCR 금액을 지출로 저장하지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.expenses = [];
      receiptScanConfirm({ amount: '₩-100,000', vendor: '테스트상사', category: '자재', date: '2026-08-23' });
      await new Promise(x => setTimeout(x, 250));
      const save = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.includes('지출 기록'));
      save?.click();
      await new Promise(x => setTimeout(x, 250));
      const blocked = state.expenses.map(e => e.amount);
      const input = document.getElementById('rsvAmt');
      if (input) input.value = '100,000';
      const save2 = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.includes('지출 기록'));
      save2?.click();
      await new Promise(x => setTimeout(x, 250));
      try { closeModal(); } catch (e) {}
      return { blocked, saved: state.expenses.map(e => e.amount) };
    });
    assert(r.blocked.length === 0, '음수 OCR 금액이 지출로 저장됨: ' + JSON.stringify(r.blocked));
    assert(r.saved.length === 1 && r.saved[0] === 100000, '정상 OCR 금액이 막힘: ' + JSON.stringify(r.saved));
  });

  await test('판정기는 하이픈이 섞인 정상 금액을 음수로 오해하지 않는다', async () => {
    const r = await page.evaluate(() => ({
      minus: hjIsNegativeAmount('-100000'),
      minusSpace: hjIsNegativeAmount(' -100,000'),
      wonMinus: hjIsNegativeAmount('₩-100,000'),
      fullwidthMinus: hjIsNegativeAmount('－100,000'),
      parentheses: hjIsNegativeAmount('(100,000)'),
      plain: hjIsNegativeAmount('100000'),
      comma: hjIsNegativeAmount('1,026,451'),
      dashInside: hjIsNegativeAmount('895-48-01132'),
      empty: hjIsNegativeAmount(''),
      dashOnly: hjIsNegativeAmount('-')
    }));
    assert(r.minus && r.minusSpace && r.wonMinus && r.fullwidthMinus && r.parentheses,
      '마이너스 표기를 못 잡음: ' + JSON.stringify(r));
    assert(!r.plain && !r.comma && !r.dashInside && !r.empty && !r.dashOnly, '정상 값을 음수로 오해: ' + JSON.stringify(r));
  });

  assert(pageerrors.length === 0, 'pageerror: ' + pageerrors.join(' | '));
  console.log('\n== amount-sign: ' + pass + '/' + (pass + fail) + ' passed, pageerrors=' + pageerrors.length + ' ==');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();

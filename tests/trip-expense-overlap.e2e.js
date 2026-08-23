/* 차량 운행 경비: 기간이 겹쳐도 이중으로 잡히지 않는다 (v220)
   배경: v219는 '완전히 같은 운행 묶음'만 막았다. 20km 를 경비로 넣은 뒤 10km 를
   더 적고 같은 달을 다시 넣으면 30km 가 통째로 또 들어가 유류비가 부풀었다.
   유류비는 마진·부가세 자료로 흘러가므로 금액 오류다.
   전제: tests/static-server.js(8299) 실행 중 */
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
async function test(name, fn) { try { await fn(); console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); } }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageerrors = [];
  page.on('pageerror', e => pageerrors.push(String(e.message).slice(0, 120)));
  await page.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const setup = async () => page.evaluate(async () => {
    localStorage.setItem('hj_onboard_done', '1');
    try { loadDemo(); } catch (e) {}
    state.expenses = [];
    state.tripCfg = { rate: 100 };
    state.trips = [{ id: 't1', date: '2026-08-20', project: '', km: 20, memo: '첫 운행' }];
    window.__trip = { from: '2026-08-01', to: '2026-08-31', pj: '', page: 1 };
  });

  const clickExpense = async () => page.evaluate(async () => {
    tripView();
    await new Promise(r => setTimeout(r, 250));
    const b = document.getElementById('trExp');
    if (!b) return 'no-button';
    b.click();
    await new Promise(r => setTimeout(r, 250));
    try { closeModal(); } catch (e) {}
    return 'clicked';
  });

  await test('겹치는 기간을 다시 넣어도 유류비 합계가 실제 주행과 같다', async () => {
    await setup();
    await clickExpense();                       // 20km → 2,000원
    await page.evaluate(() => {
      state.trips.push({ id: 't2', date: '2026-08-25', project: '', km: 10, memo: '두 번째' });
    });
    await clickExpense();                       // 10km 만 추가돼야 한다
    const r = await page.evaluate(() => ({
      total: (state.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      count: (state.expenses || []).length,
      amounts: (state.expenses || []).map(e => e.amount)
    }));
    // 실제 주행 30km × 100원 = 3,000원. v219 는 2,000 + 3,000 = 5,000 이었다.
    assert(r.total === 3000, '유류비 합계가 주행과 어긋남: ' + JSON.stringify(r));
    assert(r.count === 2 && r.amounts[1] === 1000, '추가분만 반영되지 않음: ' + JSON.stringify(r));
  });

  await test('반영된 운행은 다시 넣어도 늘지 않는다', async () => {
    const r = await page.evaluate(() => ({ before: (state.expenses || []).length }));
    await clickExpense();
    const after = await page.evaluate(() => (state.expenses || []).length);
    assert(after === r.before, '이미 반영한 운행이 또 들어감: ' + r.before + ' → ' + after);
  });

  await test('v219에서 이미 반영한 운행은 업그레이드 뒤 다시 지출되지 않는다', async () => {
    const r = await page.evaluate(async () => {
      state.tripCfg = { rate: 100 };
      state.trips = [
        { id: 'legacy-t1', date: '2026-08-20', project: '', km: 20, memo: 'v219 운행' },
        { id: 'new-t2', date: '2026-08-25', project: '', km: 10, memo: '업그레이드 뒤 운행' }
      ];
      state.expenses = [{
        id: 'legacy-exp', date: '2026-08-20', amount: 2000, category: '유류',
        sourceKey: 'trip|2026-08-01|2026-08-31|*|100|legacy-t1'
      }];
      window.__trip = { from: '2026-08-01', to: '2026-08-31', pj: '', page: 1 };
      tripView();
      await new Promise(x => setTimeout(x, 250));
      const firstLabel = document.getElementById('trExp')?.textContent || '';
      document.getElementById('trExp')?.click();
      await new Promise(x => setTimeout(x, 250));
      try { closeModal(); } catch (e) {}
      const afterUpgrade = {
        total: state.expenses.reduce((s, e) => s + (e.amount || 0), 0),
        amounts: state.expenses.map(e => e.amount)
      };

      state.expenses = state.expenses.filter(e => e.id !== 'legacy-exp');
      tripView();
      await new Promise(x => setTimeout(x, 250));
      const retryLabel = document.getElementById('trExp')?.textContent || '';
      document.getElementById('trExp')?.click();
      await new Promise(x => setTimeout(x, 250));
      try { closeModal(); } catch (e) {}
      return {
        firstLabel,
        afterUpgrade,
        retryLabel,
        afterDelete: state.expenses.reduce((s, e) => s + (e.amount || 0), 0)
      };
    });
    assert(/10km/.test(r.firstLabel), 'v219 반영분까지 미반영으로 표시함: ' + JSON.stringify(r));
    assert(r.afterUpgrade.total === 3000 && r.afterUpgrade.amounts[1] === 1000,
      'v219 유류비가 업그레이드 뒤 중복됨: ' + JSON.stringify(r.afterUpgrade));
    assert(/20km/.test(r.retryLabel) && r.afterDelete === 3000,
      '기존 지출 삭제 뒤 운행을 다시 반영하지 못함: ' + JSON.stringify(r));
  });

  await test('반영 기록이 저장·복원에서 살아남는다', async () => {
    const r = await page.evaluate(() => {
      const snap = JSON.parse(JSON.stringify(serializeData()));
      state.trips = [];
      applyData(snap);
      return { refs: (state.trips || []).filter(t => t.expRef).length, total: (state.trips || []).length };
    });
    assert(r.total === 2 && r.refs === 2, '반영 표시가 복원되지 않음: ' + JSON.stringify(r));
  });

  await test('참조한 지출을 지우면 그 운행은 다시 넣을 수 있다', async () => {
    const r = await page.evaluate(async () => {
      state.expenses = [];                       // 사장님이 지출을 삭제한 상황
      tripView();
      await new Promise(x => setTimeout(x, 250));
      const b = document.getElementById('trExp');
      const label = b ? b.textContent : '';
      if (b) b.click();
      await new Promise(x => setTimeout(x, 250));
      try { closeModal(); } catch (e) {}
      return { label, total: (state.expenses || []).reduce((s, e) => s + (e.amount || 0), 0) };
    });
    assert(r.total === 3000, '지출 삭제 후 재반영이 안 됨: ' + JSON.stringify(r));
  });

  assert(pageerrors.length === 0, 'pageerror: ' + pageerrors.join(' | '));
  console.log('\n== trip-expense-overlap: ' + pass + '/' + (pass + fail) + ' passed, pageerrors=' + pageerrors.length + ' ==');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();

/* payproof-v348.e2e.js — v348 입금 증빙(현금영수증·세금계산서) 기록 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · 입금 기록(payLog 항목) 안에 proof·proofAt 만 더한다 — 최상위 저장 키 41개 그대로, 옛 기록은 '아직'.
   · 알림은 10만원 이상·이틀 지난 빈 기록만. 증빙을 적으면 알림에서 빠지고, 다시 누르면 지워진다(사람이 적는다 — 발행을 대신하지 않는다).
   · 입금 기록 창에서 바로 고를 수 있고, 더보기(경영·돈)에서도 열린다. 읽기 경로는 저장본을 바꾸지 않는다. */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await page.evaluate(() => {
    state._demo = false; state.expenses = []; state.quotes = []; state.notes = []; state.schedule = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [P('대전'), P('둔산')];
    const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
    state.payLog = [
      { d: ago(5), project: '대전', amt: 500000 },                       // 빈 기록·5일 → 알림
      { d: ago(3), project: '둔산', amt: 1200000, proof: 'tax', proofAt: ago(2) },   // 세금계산서 적음 → 아님
      { d: ago(4), project: '대전', amt: 80000 },                        // 10만원 미만 → 아님
      { d: ago(1), project: '둔산', amt: 300000 },                       // 어제 → 아직 아님
      { d: ago(10), project: '대전', amt: 250000, proof: 'card' }        // 카드 → 아님
    ];
    state.projects[0].received = 830000; state.projects[1].received = 1500000;
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('알림 대상은 10만원 이상·이틀 지난 빈 기록만, 증빙을 적으면 빠지고 다시 누르면 지워진다 (저장 키 41개)', async () => {
    const r = await page.evaluate(async () => {
      const pend0 = hjProofPending().map(x => [x.project, x.amt, x.days]);
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      const chk = hjDailyBrief().checks.find(c => c.ic === '🧾' && /증빙|현금영수증/.test(c.t));
      const btns = [...document.querySelectorAll('[data-proofquick]')].map(x => ({ t: x.textContent, h: x.getBoundingClientRect().height }));
      document.querySelector('[data-proofquick="대전"]').click(); await new Promise(r => setTimeout(r, 100));
      const root = document.getElementById('modalRoot');
      const title = root.querySelector('.modal h3').textContent, rows = root.querySelectorAll('.prRow').length, warn = root.querySelectorAll('.prRow').length ? [...root.querySelectorAll('.prRow')].filter(x => /증빙 기록 없음/.test(x.textContent)).length : 0;
      // 50만원 줄(현장 대전·가장 오래된 것이 위) 에 현금영수증
      const row = [...root.querySelectorAll('.prRow')].find(x => /500,000/.test(x.textContent));
      row.querySelector('.prSet[data-k="cash"]').click(); await new Promise(r => setTimeout(r, 100));
      const live = state.payLog.find(x => x.amt === 500000), rec = { proof: live.proof, proofAt: live.proofAt };   // 값을 지금 베껴 둔다(아래에서 다시 지운다)
      const after = hjProofPending().length;
      const savedRec = JSON.parse(JSON.stringify(serializeData())).payLog.find(x => x.amt === 500000), saved = { proof: savedRec.proof, proofAt: savedRec.proofAt };
      // 같은 버튼을 다시 누르면 지운다
      const row2 = [...document.querySelectorAll('#modalRoot .prRow')].find(x => /500,000/.test(x.textContent));
      row2.querySelector('.prSet[data-k="cash"]').click(); await new Promise(r => setTimeout(r, 100));
      const cleared = state.payLog.find(x => x.amt === 500000);
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      closeModal();
      return { pend0, chk, btns, title, rows, warn, rec, after, saved, cleared: 'proof' in cleared, keys: Object.keys(serializeData()).length, wide };
    });
    assert(JSON.stringify(r.pend0) === JSON.stringify([['대전', 500000, 5]]), '알림 대상: ' + JSON.stringify(r.pend0));
    assert(r.chk && /입금 1건\(10만원 이상·2일 지남\) 합계 500,000원/.test(r.chk.t) && /대전/.test(r.chk.t), '알림 글: ' + JSON.stringify(r.chk));
    assert(r.btns.length === 1 && r.btns[0].t === '🧾 대전' && r.btns[0].h >= 44, '버튼: ' + JSON.stringify(r.btns));
    assert(/입금 증빙 기록 — 대전/.test(r.title) && r.rows === 3 && r.warn === 1, '창: ' + r.title + ' ' + r.rows + '/' + r.warn);
    assert(r.rec.proof === 'cash' && /^\d{4}-\d{2}-\d{2}$/.test(r.rec.proofAt) && r.saved.proof === 'cash' && r.after === 0, '현금영수증 기록·저장: ' + JSON.stringify(r));
    assert(r.cleared === false, '다시 누르면 표시가 지워져야 한다');
    assert(r.keys === 41 && r.wide <= 0, '저장 키 41개·390px: ' + r.keys + '/' + r.wide);
  });

  await test('입금 기록 창에서 증빙을 고르면 그 기록에 남고, 안 고르면 빈 값이다; 더보기 경영·돈에서 열린다', async () => {
    const r = await page.evaluate(async () => {
      const n0 = state.payLog.length;
      recvQuickView('둔산'); await new Promise(r => setTimeout(r, 80));
      const sel = document.getElementById('rqProof'); const opts = [...sel.options].map(o => o.value);
      document.getElementById('rqAmt').value = '700000'; sel.value = 'cash';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입금 저장/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 120));
      closeModal(); await new Promise(r => setTimeout(r, 60)); try { closeModal(); } catch (e) {}
      const a = state.payLog[state.payLog.length - 1];
      recvQuickView('둔산'); await new Promise(r => setTimeout(r, 80));
      document.getElementById('rqAmt').value = '150000';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입금 저장/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 120));
      closeModal(); await new Promise(r => setTimeout(r, 60)); try { closeModal(); } catch (e) {}
      const b = state.payLog[state.payLog.length - 1];
      moreActionHandler('payproof'); await new Promise(r => setTimeout(r, 80));
      const title = document.querySelector('#modalRoot .modal h3').textContent, rows = document.querySelectorAll('#modalRoot .prRow').length;
      closeModal();
      return { n: state.payLog.length - n0, opts, a: { amt: a.amt, proof: a.proof, proofAt: a.proofAt, project: a.project }, b: { amt: b.amt, proof: b.proof || null, project: b.project }, title, rows };
    });
    assert(JSON.stringify(r.opts) === JSON.stringify(['', 'cash', 'tax', 'card', 'etc']), '선택지: ' + JSON.stringify(r.opts));
    assert(r.n === 2 && r.a.amt === 700000 && r.a.proof === 'cash' && r.a.project === '둔산' && /^\d{4}-\d{2}-\d{2}$/.test(r.a.proofAt), '증빙과 함께 저장: ' + JSON.stringify(r.a));
    assert(r.b.amt === 150000 && r.b.proof === null, '안 고르면 빈 값: ' + JSON.stringify(r.b));
    assert(/입금 증빙 기록/.test(r.title) && r.rows === 7, '더보기에서 전체 목록: ' + r.title + ' ' + r.rows);
  });

  await test('읽기 경로(알림 계산·대시보드·창 열기)는 저장본을 바꾸지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const before = snap();
      hjProofPending(); state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 120)); hjDailyBrief();
      hjProofView(); await new Promise(r => setTimeout(r, 60)); closeModal();
      hjProofView('대전'); await new Promise(r => setTimeout(r, 60)); closeModal();
      return { same: before === snap() };
    });
    assert(r.same, '읽기 경로가 저장본을 바꿨다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== payproof-v348: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

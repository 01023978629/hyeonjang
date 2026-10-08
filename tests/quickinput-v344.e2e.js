/* quickinput-v344.e2e.js — v344 고객·수금 빠른 입력 · 부가세 매입에 지출장부 반영 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   2026-10-08 자료: 45개 현장 모두 고객 연락처가 비고 수금 기록 0건이라 미수·독촉·안부 문자가 작동하지 않았다.
   · '오늘의 체크' 알림의 현장 버튼이 입금 기록·고객 정보 창을 바로 연다
   · 고객 정보 창은 잘못된 번호·빈 입력을 막고, 저장하면 현장 고객 칸과 같은 값이 된다
   · 견적을 현장에 연결한 직후 그 현장 고객 정보가 비었으면 한 번만 묻는다 */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const seed = () => page.evaluate(() => {
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = [];
    const P = n => ({ name: n, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    state.projects = [P('대전'), P('태산그린아파트')];
    const E = (id, name, project, amount) => ({ id, name, ext: 'xlsx', kind: 'estimate', project, est: { amount, supply: amount, vat: 0, date: '2026-06-01' }, when: new Date('2026-06-01') });
    state.files = [E('e1', '★20260324 대전 견적 26,675,000.xlsx', '대전', 26675000), E('e2', '태산그린 견적.xlsx', '태산그린아파트', 3366000), E('e3', '청주 태산 그린 계약서 2,530,000.xlsx', null, 2530000)];
    try { closeModal(); } catch (e) {}
    state.tab = 'dashboard'; render();
  });

  await test("'오늘의 체크' 현장 버튼이 입금 기록·고객 정보 창을 연다", async () => {
    await seed();
    const r = await page.evaluate(async () => {
      const btns = [...document.querySelectorAll('[data-recvquick],[data-custquick]')].map(b => (b.dataset.recvquick !== undefined ? 'recv:' : 'cust:') + (b.dataset.recvquick || b.dataset.custquick));
      document.querySelector('[data-recvquick="대전"]').click(); await new Promise(r => setTimeout(r, 80));
      const recv = document.querySelector('#modalRoot .modal h3').textContent; closeModal();
      document.querySelector('[data-custquick="대전"]').click(); await new Promise(r => setTimeout(r, 80));
      const cust = document.querySelector('#modalRoot .modal h3').textContent;
      return { btns, recv, cust };
    });
    assert(r.btns.includes('recv:대전') && r.btns.includes('cust:태산그린아파트'), '버튼: ' + JSON.stringify(r.btns));
    assert(r.recv.includes('입금 기록') && r.recv.includes('대전'), '입금 창: ' + r.recv);
    assert(r.cust.includes('고객 정보') && r.cust.includes('대전'), '고객 창: ' + r.cust);
  });

  await test('고객 정보 창은 잘못된 번호·빈 입력을 막고, 저장하면 현장 고객 값이 된다', async () => {
    const r = await page.evaluate(async () => {
      const save = () => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      save(); await new Promise(r => setTimeout(r, 50)); const emptyBlocked = !!document.getElementById('cqName');
      document.getElementById('cqPhone').value = '0101234'; save(); await new Promise(r => setTimeout(r, 50)); const shortBlocked = !!document.getElementById('cqPhone');
      document.getElementById('cqName').value = '김대전'; document.getElementById('cqPhone').value = '010-1234-5678'; save(); await new Promise(r => setTimeout(r, 80));
      const p = state.projects.find(x => x.name === '대전');
      const t = document.body.innerText;
      return { emptyBlocked, shortBlocked, cust: p.customer, saved: JSON.stringify(serializeData().projects.find(x => x.name === '대전').customer), stillAsked: !![...document.querySelectorAll('[data-custquick="대전"]')].length };
    });
    assert(r.emptyBlocked && r.shortBlocked, '빈 입력·짧은 번호를 막아야 한다: ' + JSON.stringify(r));
    assert(r.cust.name === '김대전' && r.cust.phone === '010-1234-5678', '저장 값: ' + JSON.stringify(r.cust));
    assert(r.saved.includes('010-1234-5678'), '저장 자료: ' + r.saved);
    assert(!r.stillAsked, '연락처를 넣은 현장은 알림에서 빠져야 한다');
  });

  await test('견적을 현장에 연결한 직후 고객 정보가 비었으면 한 번만 묻는다', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      await guardedPersistCurrentState();
      const ask = async () => {
        const f = state.files.find(x => x.name === '청주 태산 그린 계약서 2,530,000.xlsx');   // 저장 왕복 뒤 id 가 바뀔 수 있어 이름으로 찾는다
        estimateInfoOpen('file', f.id, f.project ? null : '태산그린아파트'); await new Promise(r => setTimeout(r, 80));
        [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '프로젝트 저장').click();
        await new Promise(r => setTimeout(r, 1200));
        const t = document.querySelector('#modalRoot .modal') ? document.querySelector('#modalRoot .modal').innerText : '';
        try { closeModal(); } catch (e) {}
        return t;
      };
      const first = await ask();
      const cur = () => state.files.find(x => x.name === '청주 태산 그린 계약서 2,530,000.xlsx');
      const assigned = cur().project;
      // 다시 미지정으로 돌렸다가 또 연결해도 같은 현장은 다시 묻지 않는다
      await estimateProjectAssign('file', cur().id, null);
      const second = await ask();
      return { first, assigned, second };
    });
    assert(r.assigned === '태산그린아파트', '연결: ' + r.assigned);
    assert(r.first.includes('고객 연락처도 넣어 둘까요'), '처음엔 물어야 한다: ' + r.first.slice(0, 80));
    assert(!r.second.includes('고객 연락처도 넣어 둘까요'), '같은 현장은 다시 묻지 않는다: ' + r.second.slice(0, 80));
  });

  await test('부가세 준비의 매입에 지출장부 자재·외주가 들어가고, 수기 원가와 이중으로 세지 않는다', async () => {
    const r = await page.evaluate(() => {
      state._demo = false; state.expenses = []; state.schedule = []; state.files = [];
      const P = (n, x) => Object.assign({ name: n, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, x || {});
      state.projects = [P('A', { doneAt: '2026-05-10', cost: { material: 1100000, labor: 0, outsource: 0 } }), P('B'), P('C', { archived: true })];
      expenseAdd({ amount: 550000, category: '외주', date: '2026-04-02', project: 'A', vendor: '용진' });
      expenseAdd({ amount: 220000, category: '자재', date: '2026-04-03', project: 'A' });      // A 는 수기 자재비가 있다 → 장부 자재는 세지 않는다
      expenseAdd({ amount: 330000, category: '외주', date: '2026-06-01', project: 'B' });
      expenseAdd({ amount: 440000, category: '자재', date: '2026-06-02', project: '' });
      expenseAdd({ amount: 110000, category: '유류', date: '2026-06-02', project: 'B' });      // 매입 아님
      expenseAdd({ amount: 990000, category: '외주', date: '2026-09-01', project: 'B' });      // 기간 밖
      expenseAdd({ amount: 660000, category: '자재', date: '2026-05-05', project: 'C' });      // 보관 현장 → 날짜 기준
      const d = vatReportData('2026-01', '2026-06');
      return { mat: d.buyMaterial, out: d.buyOutsource, n: d.buyRows.length };
    });
    assert(r.mat === 2200000, '자재 매입(수기 110만 + 현장없음 44만 + 보관 66만): ' + r.mat);
    assert(r.out === 880000, '외주 매입(55만 + 33만): ' + r.out);
    assert(r.n === 5, '행 수: ' + r.n);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== quickinput-v344: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

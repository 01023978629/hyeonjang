/* quotewait-v389.e2e.js — v389 대시보드 '🧾 실측 끝, 견적 안 쓴 현장' + [🧾 견적 쓰기] (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 오늘은 2026-11-05(목) 고정.
   · 상담·실측 일정을 '완료'로 보고했거나 단계가 '실측'인데 견적서·견적 파일이 없는 현장. 보관·시공 이상·앞으로 잡힌(안 끝난) 상담·실측 일정이 있는 현장,
     💰 수금 일정은 빼고 센다. 읽기는 저장본을 바꾸지 않는다.
   · [🧾 ○○ 견적 쓰기] = v384 상담 끝 창과 같은 길(hjQuoteStartFor): 상담이면 실측으로, 현장·주소 채운 새 견적. 저장하면 줄에서 빠진다.
   · 작성 중인 견적에 저장 안 한 내용이 있으면 먼저 묻고, [계속 편집]은 단계도 바꾸지 않는다. */
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
    window.portalAutoSync = () => 0;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.adPosts = []; state.contacts = []; state.quotes = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '대전 가상동 ' + name } }, x || {});
    state.projects = [P('가상A'), P('가상B', { stage: 1 }), P('가상C', { stage: 1 }), P('가상D'), P('가상E', { stage: 1 }), P('가상F', { stage: 2 }), P('가상G'), P('가상H', { stage: 1, archived: true }), P('가상M')];
    const done = { progress: '완료', done: '실측 완료' };
    const S = (id, date, title, project, report) => ({ id, date, time: '10:00', title, project, workers: '', memo: '', hours: 1, report: report || null });
    state.schedule = [
      S('s1', '2026-11-03', '상담·실측: 가상A', '가상A', done),
      S('s2', '2026-11-03', '실측', '가상D', done),
      S('s3', '2026-11-09', '실측: 가상E', '가상E'),
      S('s4', '2026-11-02', '상담: 가상G', '가상G'),
      S('s5', '2026-11-03', '💰 실측비 입금', '가상M', done)
    ];
    state.quotes = [{ id: 'qc', title: '가상C 견적', date: '2026-11-04', project: '가상C', items: [{ name: '도배', spec: '', qty: 1, price: 100000 }], vatIncluded: false }];
    state.files = [{ id: 'ed', name: '가상D 견적서.xlsx', kind: 'estimate', project: '가상D', when: '2026-11-04T01:00:00.000Z', est: { amount: 500000 } }];
    state.editingQuote = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const line = () => page.evaluate(() => { const el = document.getElementById('dashboardQuoteWaiting'); return el ? { t: el.querySelector('span').textContent, b: el.querySelector('[data-qwait]').textContent, bq: el.querySelector('[data-qwait]').dataset.qwait, h: el.querySelector('[data-qwait]').getBoundingClientRect().height } : null; });

  await test('① 대시보드 줄 — 상담·실측 완료 보고·실측 단계인데 견적 없는 현장만(보관·시공·견적/견적 파일·앞으로 잡힌 실측·💰 일정 제외) · 읽기는 저장본 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); const l = hjQuoteWaiting(); render(); return { l, same: snap() === b0, w: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const ln = await line();
    assert(JSON.stringify(r.l) === JSON.stringify(['가상A', '가상B']) && r.same && r.w <= 0, '목록: ' + JSON.stringify(r));
    assert(ln && ln.t === '🧾 실측 끝, 견적 안 쓴 현장 2곳 — 가상A · 가상B' && ln.b === '🧾 가상A 견적 쓰기' && ln.bq === '가상A' && ln.h >= 44, '줄: ' + JSON.stringify(ln));
  });

  await test('② [🧾 가상A 견적 쓰기] → 상담→실측, 현장·주소 채운 새 견적 → 저장하면 줄에서 빠진다', async () => {
    await seed();
    await page.click('#dashboardQuoteWaiting [data-qwait]');
    const r = await page.evaluate(() => {
      const q = state.editingQuote || {};
      const o = { tab: state.tab, stage: state.projects[0].stage, q: { project: q.project, title: q.title, place: q.place } };
      state.editingQuote.items = [{ name: '욕실', spec: '', qty: 1, price: 3000000 }];
      saveQuoteEdit(); try { closeModal(true); } catch (e) {}
      state.tab = 'dashboard'; render();
      o.after = hjQuoteWaiting();
      return o;
    });
    const ln = await line();
    assert(r.tab === 'quotemaker' && r.stage === 1 && r.q.project === '가상A' && r.q.title === '가상A 견적' && r.q.place === '대전 가상동 가상A', '견적: ' + JSON.stringify(r));
    assert(JSON.stringify(r.after) === JSON.stringify(['가상B']) && ln && ln.t === '🧾 실측 끝, 견적 안 쓴 현장 1곳 — 가상B', '저장 뒤: ' + JSON.stringify({ r, ln }));
  });

  await test('③ 작성 중인 견적에 저장 안 한 내용 → \'저장하지 않은 견적\' 창, [계속 편집]은 단계·견적 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.editingQuote = Object.assign(newQuote(), { title: '쓰던 견적', items: [{ name: '타일', spec: '', qty: 1, price: 777000 }] });
      state.tab = 'dashboard'; render();
      document.querySelector('#dashboardQuoteWaiting [data-qwait]').click();
      const m = document.querySelector('#modalRoot .modal');
      const o = { h3: m && m.querySelector('h3').textContent, btns: m ? [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) : [] };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '계속 편집').click();
      o.after = { tab: state.tab, title: state.editingQuote && state.editingQuote.title, stage: state.projects[0].stage };
      state.editingQuote = null; state.tab = 'dashboard'; render();
      return o;
    });
    assert(r.h3 === '저장하지 않은 견적' && JSON.stringify(r.btns) === JSON.stringify(['계속 편집', '저장 안 하고 새 견적', '저장하고 새 견적']), '창: ' + JSON.stringify(r));
    assert(r.after.tab === 'quotemaker' && r.after.title === '쓰던 견적' && r.after.stage === 0, '계속 편집: ' + JSON.stringify(r.after));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== quotewait-v389: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

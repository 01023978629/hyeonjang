/* quotewon-v390.e2e.js — v390 🎉 수주 → 현장 단계 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음.
   · ⏰ 견적 팔로업 줄마다 [🎉 수주]. 누르면 수주로 표시하고, 붙은 현장이 상담·실측이면 '🎉 수주 — 현장' 창:
     [그대로 두기] = 단계 그대로·팔로업 창으로, [🔨 시공으로 올리기] = 보통 setStage 길(착공 전 체크가 안 끝났으면 체크리스트 창).
   · 현장 없는 견적·시공 이상 현장 견적은 묻지 않고 팔로업 창으로. 📄 견적 이력 [🎉 수주]도 같은 물음(풀 때는 안 묻는다). */
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
    const orig = window.localDate; window.__origLocalDate = orig; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.portalAutoSync = () => 0;
    window.__ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return window.__origLocalDate(d); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = []; state.schedule = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '' } }, x || {});
    state.projects = [P('상담현장'), P('체크끝현장', { stage: 1, checklists: { start: { _ok: true } } }), P('시공현장', { stage: 2 })];
    const it = p => [{ name: '도배(실크)', spec: '', qty: 1, price: p }];
    state.quotes = [
      { id: 'qa', title: '상담현장 견적', date: __ago(5), project: '상담현장', items: it(3000000), vatIncluded: false },
      { id: 'qb', title: '체크끝현장 견적', date: __ago(6), project: '체크끝현장', items: it(2000000), vatIncluded: false },
      { id: 'qf', title: '미연결 견적', date: __ago(4), items: it(1500000), vatIncluded: false, result: '' }
    ];
    state.editingQuote = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const modal = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return m ? { h3: m.querySelector('h3').textContent, btns: [...m.querySelectorAll('.mfoot button')].map(b => b.textContent), text: m.textContent } : null; });
  const click = (sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const foot = (label) => page.evaluate((label) => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === label).click(), label);

  await test('① 팔로업 [🎉 수주] — 상담 현장 견적 → \'🎉 수주 — 현장\' 창, [그대로 두기]는 단계 그대로·팔로업 창(그 견적 빠짐)', async () => {
    await seed();
    const b = await page.evaluate(() => { quoteFollowup(); return [...document.querySelectorAll('#modalRoot .qfWon')].map(x => x.dataset.q + ':' + Math.round(x.getBoundingClientRect().height)); });
    await click('#modalRoot .qfWon[data-q="qa"]');
    const m1 = await modal();
    await foot('그대로 두기');
    const m2 = await modal();
    const r = await page.evaluate(() => ({ res: state.quotes[0].result, st: quoteStatus(state.quotes[0]), stage: state.projects[0].stage, rows: [...document.querySelectorAll('#modalRoot .qfWon')].map(x => x.dataset.q) }));
    assert(JSON.stringify(b) === JSON.stringify(['qf:44', 'qa:44', 'qb:44']), '버튼: ' + JSON.stringify(b));
    assert(m1 && m1.h3 === '🎉 수주 — 상담현장' && JSON.stringify(m1.btns) === JSON.stringify(['그대로 두기', '🔨 시공으로 올리기']) && /현장 단계는 아직 상담이에요/.test(m1.text), '창: ' + JSON.stringify(m1));
    assert(m2 && /견적 골든타임|견적 팔로업/.test(m2.h3) && r.res === 'won' && r.st === 'won' && r.stage === 0 && JSON.stringify(r.rows) === JSON.stringify(['qf', 'qb']), '그대로: ' + JSON.stringify({ m2: m2 && m2.h3, r }));
    await page.evaluate(() => closeModal(true));
  });

  await test('② [🔨 시공으로 올리기] — 착공 전 체크가 끝난 현장은 바로 시공, 안 끝난 현장은 📋 착공 전 체크 창(단계는 체크 뒤)', async () => {
    await seed();
    await page.evaluate(() => quoteFollowup());
    await click('#modalRoot .qfWon[data-q="qb"]');
    await foot('🔨 시공으로 올리기');
    const a = await page.evaluate(() => ({ stage: state.projects[1].stage, open: !!document.querySelector('#modalRoot .modal') }));
    await page.evaluate(() => quoteFollowup());
    await click('#modalRoot .qfWon[data-q="qa"]');
    await foot('🔨 시공으로 올리기');
    const m = await modal();
    const s0 = await page.evaluate(() => state.projects[0].stage);
    assert(a.stage === 2 && !a.open, '체크 끝: ' + JSON.stringify(a));
    assert(m && /착공 전 체크/.test(m.h3) && s0 === 0, '체크 창: ' + JSON.stringify({ m: m && m.h3, s0 }));
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 현장 없는 견적은 묻지 않고 팔로업 창 · 📄 견적 이력 [🎉 수주]도 같은 물음, 풀 때는 안 묻는다', async () => {
    await seed();
    await page.evaluate(() => quoteFollowup());
    await click('#modalRoot .qfWon[data-q="qf"]');
    const m0 = await modal();
    const r0 = await page.evaluate(() => state.quotes[2].result);
    await page.evaluate(() => { closeModal(true); quoteHistoryView(true); });
    await click('#modalRoot .qhWon[data-id="qa"]');
    const m1 = await modal();
    await foot('그대로 두기');
    const m2 = await modal();
    await click('#modalRoot .qhWon[data-id="qa"]');
    const m3 = await modal();
    const r = await page.evaluate(() => ({ res: state.quotes[0].result, stage: state.projects[0].stage }));
    assert(m0 && /견적 골든타임|견적 팔로업/.test(m0.h3) && r0 === 'won', '미연결: ' + JSON.stringify({ m0: m0 && m0.h3, r0 }));
    assert(m1 && m1.h3 === '🎉 수주 — 상담현장' && m2 && /견적 이력/.test(m2.h3) && m3 && /견적 이력/.test(m3.h3) && r.res === '' && r.stage === 0, '이력: ' + JSON.stringify({ m1: m1 && m1.h3, m2: m2 && m2.h3, m3: m3 && m3.h3, r }));
    await page.evaluate(() => closeModal(true));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== quotewon-v390: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

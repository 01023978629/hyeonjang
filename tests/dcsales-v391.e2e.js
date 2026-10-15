/* dcsales-v391.e2e.js — v391 🌙 오늘 마감의 📞 영업 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음. 오늘은 2026-11-05(목) 고정.
   · 오늘 받은 문의(inquiryAt = 오늘), 📥 상담 일정 안 잡힌 문의(v386), 🧾 실측 끝 견적 안 쓴 현장(v389), ⏰ 답 기다리는 견적(v388 팔로업 3~30일).
   · 버튼: [🗓 ○○ 일정 잡기](다음 작업일 10:00 상담·실측) · [🧾 ○○ 견적 쓰기](견적 작성) · [⏰ 견적 팔로업]. 다 없으면 영업 칸 없음. 읽기 전용. */
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
  const seed = (empty) => page.evaluate((empty) => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = []; state.schedule = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '대전 가상동' } }, x || {});
    state.projects = empty ? [P('시공현장', { stage: 2 })] :
      [P('오늘문의', { inquiryAt: '2026-11-05' }), P('어제문의', { inquiryAt: '2026-11-04' }), P('실측현장', { stage: 1 }), P('견적현장', { stage: 1 })];
    state.notes = empty ? [] : [{ id: 'n1', date: '2026. 11. 5.', text: '[문의 접수] 2026-11-05\n욕실', project: '오늘문의' }, { id: 'n2', date: '2026. 11. 4.', text: '[문의 접수] 2026-11-04\n주방', project: '어제문의' }];
    state.quotes = empty ? [] : [{ id: 'qa', title: '견적현장 견적', date: __ago(5), project: '견적현장', items: [{ name: '도배', spec: '', qty: 1, price: 2000000 }], vatIncluded: false }];
    state.editingQuote = null; state.tab = 'dashboard'; state.activeProject = null; render();
  }, empty);
  const h3 = () => page.evaluate(() => (document.querySelector('#modalRoot h3') || {}).textContent || '');

  await test('① 📞 영업 — 오늘 문의·상담 일정 안 잡힌 문의·견적 안 쓴 현장·답 기다리는 견적, 44px 버튼, 가로 넘침 없음, 저장본 불변', async () => {
    await seed(false);
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      hjDayCloseView();
      const box = document.getElementById('dcSales');
      const hd = [...document.querySelectorAll('#dayClose h4')].map(h => h.textContent).find(t => /영업/.test(t));
      const btns = box ? [...box.querySelectorAll('button')].map(b => b.textContent + ':' + Math.round(b.getBoundingClientRect().height)) : [];
      const m = document.querySelector('#modalRoot .modal');
      return { hd, text: box && box.textContent, btns, same: snap() === b0, w: m.scrollWidth - m.clientWidth, data: hjDayCloseData().sales };
    });
    assert(r.hd === '📞 영업 — 오늘 받은 문의 1곳' && /오늘 문의: 오늘문의/.test(r.text) && /상담 일정 안 잡힌 문의 2곳/.test(r.text) && /오늘문의 · 어제문의/.test(r.text), '영업 칸: ' + JSON.stringify(r));
    assert(/실측 끝, 견적 안 쓴 현장 1곳/.test(r.text) && /답 기다리는 견적 1건/.test(r.text), '견적: ' + r.text);
    assert(JSON.stringify(r.btns) === JSON.stringify(['🗓 오늘문의 일정 잡기:44', '🧾 실측현장 견적 쓰기:44', '⏰ 견적 팔로업:44']) && r.same && r.w <= 0, '버튼·저장본: ' + JSON.stringify(r));
  });

  await test('② 버튼 — 일정 잡기(다음 작업일 10:00 상담·실측) · 견적 쓰기(실측현장 새 견적) · 견적 팔로업 창', async () => {
    await seed(false);
    const a = await page.evaluate(() => { hjDayCloseView(); document.querySelector('#dcSales [data-dc-inqsched]').click(); return { h3: document.querySelector('#modalRoot h3').textContent, t: document.getElementById('schTitle').value, d: document.getElementById('schDate').value }; });
    const b = await page.evaluate(() => { closeModal(true); hjDayCloseView(); document.querySelector('#dcSales [data-dc-qwait]').click(); const q = state.editingQuote || {}; const o = { tab: state.tab, p: q.project, open: !!document.querySelector('#modalRoot .modal') }; state.editingQuote = null; state.tab = 'dashboard'; render(); return o; });
    await page.evaluate(() => { hjDayCloseView(); document.querySelector('#dcSales [data-dc-qfollow]').click(); });
    const c = await h3();
    assert(a.h3 === '🗓 상담·실측 일정' && a.t === '상담·실측: 오늘문의' && a.d === '2026-11-06', '일정: ' + JSON.stringify(a));
    assert(b.tab === 'quotemaker' && b.p === '실측현장' && !b.open, '견적: ' + JSON.stringify(b));
    assert(/견적 골든타임/.test(c), '팔로업: ' + c);
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 영업 거리가 없으면 📞 영업 칸 없음', async () => {
    await seed(true);
    const r = await page.evaluate(() => { hjDayCloseView(); const o = { box: !!document.getElementById('dcSales'), hd: [...document.querySelectorAll('#dayClose h4')].some(h => /영업/.test(h.textContent)) }; closeModal(true); return o; });
    assert(!r.box && !r.hd, '없음: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== dcsales-v391: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

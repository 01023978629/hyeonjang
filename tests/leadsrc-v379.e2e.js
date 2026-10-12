/* leadsrc-v379.e2e.js — v379 📞 문의 경로(p.leadSrc) → 광고 탭 채널별 문의 수 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 현장 화면 👤 고객 정보 [문의 경로] 고르기(당근·네이버 지도·카카오맵·인스타·만물 웹·블로그·스레드·소개·다시 맡긴 고객·관리사무소·기타, 모름=비움).
   · 👤 고객 정보 빠른 입력 창에도 같은 칸 — 경로만 골라도 저장.
   · 광고 탭 '📞 문의 경로' — 보관 아닌 현장의 경로별 수(많은 순)·앎/모름. 그리는 것만으로는 저장본 불변. 오늘은 2026-11-05(목) 고정. */
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
    window.open = () => null; window.portalAutoSync = () => 0;
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = []; state.files = []; state.adPosts = [];
    const P = (name, x) => Object.assign({ name, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' } }, x || {});
    state.projects = [P('가상현장A', { leadSrc: 'daangn' }), P('가상현장B', { leadSrc: 'daangn' }), P('가상현장C', { leadSrc: 'naverplace' }),
      P('가상현장D', { leadSrc: 'referral' }), P('가상현장E'), P('가상현장F', { leadSrc: 'daangn', archived: true })];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 현장 화면 👤 고객 정보 [문의 경로] — 고르면 저장, 모름이면 칸을 지움, 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.tab = 'project'; state.activeProject = '가상현장E'; render();
      const sel = document.querySelector('#view select[data-leadsrc="가상현장E"]');
      const opts = [...sel.options].map(o => o.value);
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      sel.value = 'kakaomap'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const a = state.projects.find(p => p.name === '가상현장E').leadSrc;
      render(); const shown = document.querySelector('#view select[data-leadsrc="가상현장E"]').value;
      const s2 = document.querySelector('#view select[data-leadsrc="가상현장E"]'); s2.value = ''; s2.dispatchEvent(new Event('change', { bubbles: true }));
      const gone = !('leadSrc' in state.projects.find(p => p.name === '가상현장E'));
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { opts, w, a, shown, gone };
    });
    assert(JSON.stringify(r.opts) === JSON.stringify(['', 'daangn', 'naverplace', 'kakaomap', 'kakaoch', 'instagram', 'web', 'blog', 'threads', 'referral', 'repeat', 'office', 'etc']), '보기: ' + JSON.stringify(r.opts));
    assert(r.a === 'kakaomap' && r.shown === 'kakaomap' && r.gone && r.w <= 0, '저장: ' + JSON.stringify(r));
  });

  await test('② 👤 고객 정보 빠른 입력 — 문의 경로 칸, 경로만 골라도 저장', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjCustQuickView('가상현장E');
      const has = !!document.getElementById('cqSrc');
      document.getElementById('cqSrc').value = 'referral';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const p = state.projects.find(x => x.name === '가상현장E');
      hjCustQuickView('가상현장A'); const pre = document.getElementById('cqSrc').value; closeModal(true);
      return { has, src: p.leadSrc, cu: p.customer, open: !!document.querySelector('#modalRoot .modal'), pre };
    });
    assert(r.has && r.src === 'referral' && !r.open && r.pre === 'daangn' && r.cu.name === '' && r.cu.phone === '', '빠른 입력: ' + JSON.stringify(r));
  });

  await test('③ 광고 탭 📞 문의 경로 — 보관 제외 경로별 수(많은 순)·앎/모름, 그리는 것만으로는 저장본 불변', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const st = hjLeadSrcStats();
      state.tab = 'ads'; render();
      const box = document.querySelector('.adLeadSrc');
      const head = box.firstElementChild.textContent + box.children[1].textContent;
      const ns = [...box.querySelectorAll('.adLeadN')].map(x => x.textContent);
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      state.tab = 'dashboard'; render();
      hjSetLeadSrc('가상현장A', 'daangn');
      return { rows: st.rows.map(x => x.id + ':' + x.n), known: st.known, unknown: st.unknown, head, ns, w, same: snap() === b0 };
    });
    assert(JSON.stringify(r.rows) === JSON.stringify(['daangn:2', 'naverplace:1', 'referral:1']) && r.known === 4 && r.unknown === 1, '수: ' + JSON.stringify(r));
    assert(/📞 문의 경로/.test(r.head) && /문의 경로 입력 4곳 · 미입력 1곳/.test(r.head) && JSON.stringify(r.ns) === JSON.stringify(['🥕 당근 2', '📍 네이버 지도 1', '🤝 소개 1']) && r.w <= 0, '칸: ' + JSON.stringify(r));
    assert(r.same, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== leadsrc-v379: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

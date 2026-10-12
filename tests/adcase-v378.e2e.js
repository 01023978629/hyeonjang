/* adcase-v378.e2e.js — v378 📣 사례 홍보를 현장 상세·오늘 마감·현장 이름 바꾸기/지우기에 잇기 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실게시 없음.
   · 현장 상세 🎉 준공 관리 카드 안 '📣 사례 홍보' — 올린 채널 ✓ · 남은 채널 버튼(누르면 그 현장·채널 원고). 준공 전 현장엔 없음.
   · 현장 이름 바꾸기 → 홍보 기록(adPosts.project)도 새 이름으로(확인 창 '홍보 기록 N건'), 지우기 → '(삭제됨) 이름 · 날짜' 로 남김.
   · 🌙 오늘 마감 '📣 완공 현장 홍보 — 안 올린 채널 N개'(2주 안 완공만) + [📣 광고 관리]. 그리는 것만으로는 저장본 불변. 오늘은 2026-11-05(목) 고정. */
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
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = []; state.files = [];
    const P = (name, x) => Object.assign({ name, stage: 3, received: 0, phases: ['우수관 교체'], cost: {}, customer: {} }, x || {});
    state.projects = [P('가상아파트A', { doneAt: '2026-11-01' }), P('가상아파트B', { doneAt: '2026-10-20' }), P('가상아파트E', { stage: 2 })];
    state.adPosts = [
      { id: 'a1', ch: 'instagram', date: '2026-11-02', title: 'A 인스타', url: '', memo: '', project: '가상아파트A' },
      { id: 'a2', ch: 'daangn', date: '2026-11-02', title: 'A 당근', url: '', memo: '', project: '가상아파트A' },
      { id: 'a3', ch: 'threads', date: '2026-11-02', title: 'A 스레드', url: '', memo: '', project: '가상아파트A' },
      { id: 'b1', ch: 'web', date: '2026-10-21', title: 'B 웹', url: '', memo: '', project: '가상아파트B' }
    ];
    state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 현장 상세 🎉 준공 관리 — 📣 사례 홍보 ✓·남은 채널 버튼 → 그 현장·채널 원고, 준공 전 현장엔 없음, 390px', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.tab = 'project'; state.activeProject = '가상아파트A'; render();
      const line = document.querySelector('#view [data-donecard="1"] .adCaseLine');
      const text = line ? line.firstChild.textContent + line.children[0].textContent : '';
      const btns = line ? [...line.querySelectorAll('[data-adcase]')].map(b => b.dataset.adcase + '|' + b.dataset.adproj) : [];
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      line.querySelector('[data-adcase="web"]').click();
      const draft = { proj: document.getElementById('adDraftProj').value, ch: (document.querySelector('#adDraftChs .blue') || {}).dataset.draftch };
      closeModal(true);
      state.activeProject = '가상아파트E'; render();
      const none = !document.querySelector('#view .adCaseLine');
      state.tab = 'dashboard'; state.activeProject = null; render();
      return { text, btns, w, draft, none };
    });
    assert(/📣 사례 홍보 ✓ 인스타·당근/.test(r.text) && JSON.stringify(r.btns) === JSON.stringify(['naverplace|가상아파트A', 'kakaomap|가상아파트A', 'web|가상아파트A']) && r.w <= 0, '줄: ' + JSON.stringify(r));
    assert(r.draft.proj === '가상아파트A' && r.draft.ch === 'web' && r.none, '원고·준공 전: ' + JSON.stringify(r));
  });

  await test('② 현장 이름 바꾸기 — 홍보 기록도 새 이름(확인 창에 \'홍보 기록 3건\'), ✓ 유지', async () => {
    await seed();
    const r = await page.evaluate(() => {
      renameProject('가상아파트A'); const refs = document.getElementById('renProjRefs').textContent; closeModal(true);
      const c = hjRenameProjectRefs('가상아파트A', '가상아파트A2');
      const p = state.projects.find(x => x.name === '가상아파트A'); if (p) p.name = '가상아파트A2';
      return { refs, n: c.adPosts, owners: state.adPosts.map(x => x.id + ':' + x.project), st: hjAdCaseStatus('가상아파트A2').posted };
    });
    assert(/홍보 기록 3건/.test(r.refs) && r.n === 3, '확인 창: ' + JSON.stringify(r));
    assert(JSON.stringify(r.owners) === JSON.stringify(['a1:가상아파트A2', 'a2:가상아파트A2', 'a3:가상아파트A2', 'b1:가상아파트B']) && JSON.stringify(r.st) === JSON.stringify(['instagram', 'daangn']), '바뀐 기록: ' + JSON.stringify(r));
  });

  await test('③ 현장 지우기 — 홍보 기록은 \'(삭제됨) 이름 · 날짜\' 로 남고 되살릴 이름 목록에 잡힌다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const out = hjDeleteProjectCore('가상아파트B');
      return { tomb: out.tomb, kept: out.kept.adPosts, rec: state.adPosts.find(x => x.id === 'b1').project, tombs: hjProjectTombstonesOf('가상아파트B') };
    });
    assert(r.kept === 1 && r.rec === r.tomb && /^\(삭제됨\) 가상아파트B · 2026-11-05$/.test(r.tomb) && JSON.stringify(r.tombs) === JSON.stringify([r.tomb]), '삭제: ' + JSON.stringify(r));
  });

  await test('④ 🌙 오늘 마감 — 2주 안 완공 현장의 안 올린 채널 수·남은 곳, [📣 광고 관리] → 광고 탭 · 저장본 불변', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const promo = hjDayCloseData().promo.map(x => x.name + ':' + x.missing.join(','));
      hjDayCloseView();
      const h4 = [...document.querySelectorAll('#dayClose h4')].map(h => h.textContent).find(t => /완공 현장 홍보/.test(t));
      const row = (document.querySelector('#dayClose [data-dc-promo]') || {}).textContent;
      const same = snap() === b0;
      document.querySelector('#dayClose [data-dc-ads]').click();
      return { promo, h4, row, same, open: !!document.querySelector('#modalRoot .modal'), tab: state.tab };
    });
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert(JSON.stringify(r.promo) === JSON.stringify(['가상아파트A:naverplace,kakaomap,web']), '대상: ' + JSON.stringify(r.promo));
    assert(r.h4 === '📣 완공 현장 홍보 — 안 올린 채널 3개' && /가상아파트A · 완공 11\/1\(일\)남은 곳: 네이버 지도·카카오맵·만물 웹/.test(r.row || ''), '줄: ' + JSON.stringify(r));
    assert(r.same && !r.open && r.tab === 'ads', '버튼·불변: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== adcase-v378: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

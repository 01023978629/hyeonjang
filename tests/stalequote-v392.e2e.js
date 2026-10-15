/* stalequote-v392.e2e.js — v392 답 기다리는 견적이 있는 현장은 '💤 방치'가 아니다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음.
   · 진행 중 견적(작성·보냄)의 작성일·보낸 날 중 늦은 날이 30일 안이면 방치 목록(대시보드 브리핑·AI 안부 제안·위험 리포트가 같이 씀)에서 뺀다 — ⏰ 견적 팔로업이 맡는다.
   · 30일이 넘었으면 방치 줄에 [⏰ 답 없는 견적 MM-DD](44px) → 견적 팔로업 창(30일 지난 견적 종결). 종결·수주 견적은 상관없다. 읽기는 저장본 그대로.
   · 방치·팔로업 날짜는 실제 오늘(new Date) 기준이라 시드도 실제 오늘에서 n일 전으로 만든다. */
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
    window.portalAutoSync = () => 0;
    window.__ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = [];
    const P = (name, x) => Object.assign({ name, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '' } }, x || {});
    state.projects = [P('견적대기'), P('오래된견적', { stage: 0 }), P('종결견적'), P('보낸지얼마'), P('그냥방치')];
    const S = (id, project, n) => ({ id, date: __ago(n), time: '10:00', title: '상담·실측: ' + project, project, workers: '', memo: '', hours: 1, report: { progress: '완료', done: '실측' } });
    state.schedule = [S('s1', '견적대기', 40), S('s2', '오래된견적', 60), S('s3', '종결견적', 40), S('s4', '보낸지얼마', 50), S('s5', '그냥방치', 40)];
    const it = [{ name: '도배', spec: '', qty: 1, price: 1000000 }];
    state.quotes = [
      { id: 'q1', title: '견적대기 견적', date: __ago(10), project: '견적대기', items: it, vatIncluded: false },
      { id: 'q2', title: '오래된견적 견적', date: __ago(45), project: '오래된견적', items: it, vatIncluded: false },
      { id: 'q3', title: '종결견적 견적', date: __ago(10), project: '종결견적', items: it, vatIncluded: false, result: 'lost', lost: { at: __ago(5), reason: '가격' } },
      { id: 'q4', title: '보낸지얼마 견적', date: __ago(45), sentAt: __ago(20), project: '보낸지얼마', items: it, vatIncluded: false }
    ];
    state.editingQuote = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 방치 목록 — 30일 안 진행 중 견적(작성일·보낸 날 중 늦은 날)이 있으면 빠짐, 30일 넘은 견적은 표시, 종결 견적은 상관없음 · 저장본 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const rows = staleProjectData().map(x => x.name + ':' + (x.openQuote ? 'Q' : '-')).sort();
      return { rows, oq: staleProjectData().find(x => x.name === '오래된견적').openQuote === __ago(45), same: snap() === b0 };
    });
    assert(JSON.stringify(r.rows) === JSON.stringify(['그냥방치:-', '오래된견적:Q', '종결견적:-']) && r.oq && r.same, '목록: ' + JSON.stringify(r));
  });

  await test('② 💤 방치 현장 창 — 30일 넘은 견적 줄에만 [⏰ 답 없는 견적 MM-DD](44px) → 견적 팔로업 창', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      await staleProjects();
      const b = [...document.querySelectorAll('#modalRoot .stpQf')].map(x => x.dataset.n + '|' + x.textContent + '|' + Math.round(x.getBoundingClientRect().height));
      const want = '오래된견적|⏰ 답 없는 견적 ' + __ago(45).slice(5) + '|44';
      document.querySelector('#modalRoot .stpQf').click();
      const h3 = (document.querySelector('#modalRoot h3') || {}).textContent;
      const old = !!document.querySelector('#modalRoot .qfClose[data-q="q2"]');
      closeModal(true);
      return { b, want, h3, old };
    });
    assert(r.b.length === 1 && r.b[0] === r.want, '버튼: ' + JSON.stringify(r));
    assert(/견적 골든타임|견적 팔로업/.test(r.h3) && r.old, '팔로업 창: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== stalequote-v392: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

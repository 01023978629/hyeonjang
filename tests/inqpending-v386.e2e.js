/* inqpending-v386.e2e.js — v386 대시보드 [📞 새 문의 받기] + '📥 다음 일정 안 잡힌 문의' (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   · 대시보드 '✅ 오늘 현장 업무' 첫 버튼 [📞 새 문의 받기] → v383 새 문의 창.
   · 상담 단계(보관 아님)·고객 연락처 있음·[문의 접수]/[홈페이지 상담 리드] 메모 또는 카카오 문의로 들어왔고, 오늘 이후 일정이 없는 현장 →
     '📥 다음 일정 안 잡힌 문의 N곳 — 이름…' + 첫 곳 [🗓 일정 잡기](다음 작업일 10:00 상담·실측). 없으면 줄 없음. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
  const seed = (withPending) => page.evaluate((withPending) => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '고객', phone: '010-1234-5678', addr: '' } }, x || {});
    state.projects = [P('문의A'), P('리드B'), P('카카오C', { kakaoLead: { at: '2026-11-01', type: '견적문의', work: '욕실' } }), P('일반D'), P('실측E', { stage: 1 }), P('보관F', { archived: true }), P('번호없음G', { customer: { name: '', phone: '', addr: '' } })];
    const N = (project, text) => ({ id: 'n' + project, date: '2026. 11. 4.', text, project });
    state.notes = [N('문의A', '[문의 접수] 2026-11-04\n누수'), N('리드B', '[홈페이지 상담 리드]\n공사: 욕실'), N('실측E', '[문의 접수] 2026-11-01'), N('보관F', '[문의 접수] 2026-11-01'), N('번호없음G', '[문의 접수] 2026-11-01')];
    const S = (id, project, date) => ({ id, date, time: '10:00', title: '상담·실측: ' + project, project, workers: '', memo: '', hours: 1, report: null });
    state.schedule = withPending ? [S('s1', '리드B', '2026-11-06'), S('s2', '카카오C', '2026-11-01')] : [S('s1', '리드B', '2026-11-06'), S('s2', '카카오C', '2026-11-07'), S('s3', '문의A', '2026-11-05')];
    state.tab = 'dashboard'; state.activeProject = null; render();
  }, withPending);

  await test('① 대시보드 — 상담 일정 안 잡힌 문의 2곳(문의A·카카오C) 줄, [🗓 문의A 일정 잡기] → 다음 작업일 10:00 상담·실측, [📞 새 문의 받기]', async () => {
    await seed(true);
    const r = await page.evaluate(() => {
      const list = hjInquiryPending();
      const line = (document.getElementById('dashboardInquiryPending') || {}).textContent || '';
      const first = (document.querySelector('#dashboardInquiryPending + div button') || {}).id;
      const w = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      document.querySelector('#view [data-inqsched]').click();
      const sch = { h3: document.querySelector('#modalRoot h3').textContent, title: document.getElementById('schTitle').value, date: document.getElementById('schDate').value };
      closeModal(true);
      document.getElementById('dashboardInquiryOpen').click();
      const inq = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      return { list, line, first, w, sch, inq };
    });
    assert(JSON.stringify(r.list) === JSON.stringify(['문의A', '카카오C']) && /📥 다음 일정 안 잡힌 문의 2곳 — 문의A · 카카오C/.test(r.line) && /🗓 문의A 일정 잡기/.test(r.line), '줄: ' + JSON.stringify(r));
    assert(r.sch.h3 === '🗓 상담·실측 일정' && r.sch.title === '상담·실측: 문의A' && r.sch.date === '2026-11-06' && r.first === 'dashboardInquiryOpen' && r.inq === '📞 새 문의 받기' && r.w <= 0, '버튼: ' + JSON.stringify(r));
  });

  await test('② 모두 일정이 잡혀 있으면 줄 없음 · 그리는 것만으로는 저장본 불변', async () => {
    await seed(false);
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap(); render(); hjInquiryPendingHtml();
      return { none: !document.getElementById('dashboardInquiryPending'), list: hjInquiryPending(), same: snap() === b0 };
    });
    assert(r.none && r.list.length === 0 && r.same, '없음: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== inqpending-v386: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

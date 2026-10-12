/* reviewfix-v387.e2e.js — v387 GPT(Codex) 코드 검토(review-v377-v386.md) R1~R11 고침 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 오늘은 2026-11-05(목) 고정.
   R1 상담 끝 [🧾 견적서 쓰기] — 작성 중 미저장 견적이 있으면 먼저 묻는다(계속 편집 = 단계도 그대로).
   R2 오늘 마감 홍보 — 최근 4곳이 다 올렸어도 다섯 번째 남은 곳이 보인다(4곳 넘으면 '외 N곳').
   R3 새 문의 중복 알림 — 번호를 바꾸면 새 번호로 다시 확인(옛 알림은 지움).
   R4 방금 받은 문의는 '방치 현장'에 들어가지 않는다(문의 접수일 = 활동일).
   R6 정리·청소 사진만 있는 현장 원고 — '사진이 아직 없어요'가 아니라 '모두 뺐어요'.
   R7 홍보 현황 도움말 — 만물 웹은 사례 내보내기·[🏠 웹 게시 표시]로 따로 안내.
   R9 카카오맵 원고 — 보양·정리를 단정하지 않고 대괄호 자리.
   R10 상담 일정 안 잡힌 문의 — 💰 수금 일정만 있으면 여전히 대기.
   R11 완료 날짜 창을 연 사이 현장이 사라지면 완료·성공 안내 없이 멈추고, 체크 건너뛰기 표시가 남지 않는다.
   (R5 일괄 완료 문구는 donemany-v381, R8 문의 경로 문구는 leadsrc-v379 에서 확인) */
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
  const base = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.asLog = []; state.schedule = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = [];
    state.editingQuote = null; state.projects = []; state.tab = 'dashboard'; state.activeProject = null; window.__clPass = 0; render();
  });
  const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: ['우수관 교체'], cost: {}, customer: { name: '고객', phone: '010-1234-5678', addr: '대전 법동 1' } }, x || {});
  const btn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re);

  await test('R1 상담 끝 [🧾 견적서 쓰기] — 미저장 견적이 있으면 묻고, [계속 편집]은 그 견적·단계 그대로, [저장하고 새 견적]은 저장 뒤 새 견적', async () => {
    await base();
    const r = await page.evaluate((proj) => {
      state.projects = [proj];
      state.schedule = [{ id: 'c1', date: '2026-11-05', time: '10:00', title: '상담·실측: 가상현장A', project: '가상현장A', workers: '', memo: '', hours: 1, report: { done: '실측', progress: '완료' } }];
      state.editingQuote = Object.assign(newQuote(), { title: '저장 전 견적 원본', items: [{ name: '보존할 타일 품목', spec: '', qty: 1, price: 123456 }] });
      const keepId = state.editingQuote.id;
      hjConsultNextOffer(state.schedule[0]);
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적서 쓰기/.test(b.textContent)).click();
      const ask = { h3: document.querySelector('#modalRoot h3').textContent, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent) };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '계속 편집').click();
      const keep = { id: state.editingQuote.id === keepId, item: state.editingQuote.items[0].name, price: state.editingQuote.items[0].price, stage: state.projects[0].stage, tab: state.tab };
      hjConsultNextOffer(state.schedule[0]);
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적서 쓰기/.test(b.textContent)).click();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장하고 새 견적').click();
      const after = { saved: state.quotes.map(q => q.title), newQ: state.editingQuote && state.editingQuote.project, title: state.editingQuote && state.editingQuote.title, stage: state.projects[0].stage, clPass: window.__clPass };
      try { closeModal(true); } catch (e) {}
      state.editingQuote = null; state.tab = 'dashboard'; render();
      return { ask, keep, after };
    }, P('가상현장A'));
    assert(r.ask.h3 === '저장하지 않은 견적' && JSON.stringify(r.ask.btns) === JSON.stringify(['계속 편집', '저장 안 하고 새 견적', '저장하고 새 견적']), '묻기: ' + JSON.stringify(r.ask));
    assert(r.keep.id && r.keep.item === '보존할 타일 품목' && r.keep.price === 123456 && r.keep.stage === 0 && r.keep.tab === 'quotemaker', '계속 편집: ' + JSON.stringify(r.keep));
    assert(JSON.stringify(r.after.saved) === JSON.stringify(['저장 전 견적 원본']) && r.after.newQ === '가상현장A' && r.after.title === '가상현장A 견적' && r.after.stage === 1 && !r.after.clPass, '저장 뒤 새 견적: ' + JSON.stringify(r.after));
  });

  await test('R2 오늘 마감 홍보 — 최근 4곳이 다 올렸어도 다섯 번째 남은 곳이 보이고, 5곳 넘게 남으면 \'외 N곳\'', async () => {
    await base();
    const r = await page.evaluate(() => {
      const ids = ['instagram', 'daangn', 'naverplace', 'kakaomap', 'web'];
      state.projects = ['D1', 'D2', 'D3', 'D4', 'D5'].map((n, i) => ({ name: '완공' + n, stage: 3, received: 0, phases: [], cost: {}, customer: {}, doneAt: '2026-11-0' + (5 - i) }));
      state.adPosts = [];
      ['완공D1', '완공D2', '완공D3', '완공D4'].forEach(n => ids.forEach(ch => state.adPosts.push({ id: n + ch, ch, date: '2026-11-05', title: n, url: '', memo: '', project: n })));
      const one = hjDayCloseData().promo.map(x => x.name);
      state.adPosts = [];
      state.projects.push({ name: '완공D6', stage: 3, received: 0, phases: [], cost: {}, customer: {}, doneAt: '2026-10-30' });
      hjDayCloseView();
      const rows = document.querySelectorAll('#dayClose [data-dc-promo]').length;
      const more = [...document.querySelectorAll('#dayClose p.hint')].map(p => p.textContent).find(t => /^외 \d+곳$/.test(t));
      closeModal(true);
      return { one, rows, more, n: hjDayCloseData().promo.length };
    });
    assert(JSON.stringify(r.one) === JSON.stringify(['완공D5']) && r.n === 6 && r.rows === 4 && r.more === '외 2곳', 'R2: ' + JSON.stringify(r));
  });

  await test('R3 새 문의 — 번호 A 중복 알림 뒤 번호 B 로 바꾸면 옛 알림이 지워지고 B 로 다시 확인', async () => {
    await base();
    const r = await page.evaluate(() => {
      state.projects = [{ name: '현장A', stage: 3, received: 0, phases: [], cost: {}, customer: { name: '', phone: '010-1111-1111', addr: '' } },
        { name: '현장B', stage: 3, received: 0, phases: [], cost: {}, customer: { name: '', phone: '010-2222-2222', addr: '' } }];
      hjInquiryView();
      const g = id => document.getElementById(id), save = () => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /등록/.test(b.textContent)).click();
      g('inqName').value = '김가상'; g('inqArea').value = '가상동'; g('inqPhone').value = '010-1111-1111'; save();
      const a = g('inqDup').textContent;
      g('inqPhone').value = '010-2222-2222'; g('inqPhone').dispatchEvent(new Event('input', { bubbles: true }));
      const cleared = g('inqDup').hidden;
      save();
      const b = { text: g('inqDup').textContent, n: state.projects.length, open: document.querySelector('#modalRoot h3').textContent };
      save();
      const c = { n: state.projects.length, h3: document.querySelector('#modalRoot h3').textContent };
      closeModal(true);
      return { a, cleared, b, c };
    });
    assert(/현장A/.test(r.a) && r.cleared && /현장B/.test(r.b.text) && !/현장A/.test(r.b.text) && r.b.n === 2 && r.b.open === '📞 새 문의 받기', '다시 확인: ' + JSON.stringify(r));
    assert(r.c.n === 3 && r.c.h3 === '✅ 문의 등록 — 가상동', '같은 번호로 다시 누르면 등록: ' + JSON.stringify(r.c));
  });

  await test('R4 방금 받은 문의(사진·일정 없음)는 방치 현장에 없고, 문의 접수일이 오래되면 들어간다', async () => {
    await base();
    const r = await page.evaluate(async () => {
      const pj = hjInquiryCreate({ name: '김가상', phone: '010-3333-4444', area: '가상동 새문의', text: '누수', src: '' });
      const p = state.projects.find(x => x.name === pj);
      const fresh = staleProjectData().some(x => x.name === pj);
      state.projects.push({ name: '옛문의', stage: 0, received: 0, phases: [], cost: {}, customer: {} });
      state.notes.push({ id: 'old', date: 'x', text: '[문의 접수] 2026-01-02\n오래된 문의', project: '옛문의' });
      const old = staleProjectData().find(x => x.name === '옛문의');
      return { inquiryAt: p.inquiryAt, fresh, oldLast: old && old.last };
    });
    assert(r.inquiryAt === '2026-11-05' && !r.fresh && r.oldLast === '2026-01-02', 'R4: ' + JSON.stringify(r));
  });

  await test('R6·R7·R9 — 정리 사진만 있으면 \'모두 뺐어요\', 홍보 도움말에 만물 웹 따로, 카카오맵 원고는 마무리를 대괄호로', async () => {
    await base();
    const r = await page.evaluate(() => {
      state.projects = [{ name: '가상완공', stage: 3, received: 0, phases: ['타일'], cost: {}, customer: {}, doneAt: '2026-11-01' }];
      state.files = [{ key: 'f1', name: 'f1.jpg', prefix: '현장사진/', kind: 'photo', project: '가상완공', worklabel: '청소 정리' }];
      adDraftOpen('daangn', '가상완공');
      const ph = (document.getElementById('adDraftPhotos') || {}).textContent || '';
      const hasBtn = !!document.getElementById('adDraftPh');
      closeModal(true);
      state.tab = 'ads'; render();
      const hint = [...document.querySelectorAll('.adCase .hint')].map(x => x.textContent).join(' ');
      state.tab = 'dashboard'; render();
      const kk = adDraftText('kakaomap', adProjFacts('가상완공')).body;
      return { ph, hasBtn, hint, kk };
    });
    assert(/사진 1장은 모두 정리·청소 사진이라 홍보에서 뺐어요/.test(r.ph) && !/아직 없어요/.test(r.ph) && r.hasBtn, 'R6: ' + r.ph);
    assert(/만물 웹은 📰 사례 내보내기/.test(r.hint) && /\[🏠 웹 게시 표시\]/.test(r.hint), 'R7: ' + r.hint);
    assert(!/보양, 작업 후 정리까지 마쳤습니다/.test(r.kk) && /\[보양·마무리 — 실제로 한 것만 한 줄\]/.test(r.kk), 'R9: ' + r.kk);
  });

  await test('R10 상담 일정 안 잡힌 문의 — 💰 수금 일정만 있으면 여전히 대기, 상담 일정이 생기면 빠짐', async () => {
    await base();
    const r = await page.evaluate(() => {
      const pj = hjInquiryCreate({ name: '김가상', phone: '010-5555-6666', area: '가상동 문의', text: '욕실', src: 'daangn' });
      state.schedule = [{ id: 'm1', date: '2026-11-06', time: '', title: '💰 예약금 확인', project: pj, workers: '', memo: '', hours: 0, report: null }];
      const withMoney = hjInquiryPending();
      state.schedule.push({ id: 'c1', date: '2026-11-07', time: '10:00', title: '상담·실측: ' + pj, project: pj, workers: '', memo: '', hours: 1, report: null });
      return { withMoney, withConsult: hjInquiryPending(), pj };
    });
    assert(JSON.stringify(r.withMoney) === JSON.stringify([r.pj]) && r.withConsult.length === 0, 'R10: ' + JSON.stringify(r));
  });

  await test('R11 완료 날짜 창을 연 사이 현장이 사라지면 멈추고, 다른 현장은 준공 체크를 그대로 거친다', async () => {
    await base();
    const r = await page.evaluate(() => {
      state.projects = [{ name: '사라질현장', stage: 2, received: 0, phases: [], cost: {}, customer: {} }, { name: '다른현장', stage: 2, received: 0, phases: [], cost: {}, customer: {} }];
      hjDoneDateView('사라질현장', '2026-10-01');
      state.projects = state.projects.filter(p => p.name !== '사라질현장');
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /이 날짜로 완료/.test(b.textContent)).click();
      const pass = window.__clPass;
      setStage('다른현장', STAGES.length - 1);
      const h3 = (document.querySelector('#modalRoot h3') || {}).textContent || '';
      const stage = state.projects.find(p => p.name === '다른현장').stage;
      try { closeModal(true); } catch (e) {}
      window.__clPass = 1; setStage('없는현장', 3); const pass2 = window.__clPass;
      return { pass, h3, stage, pass2 };
    });
    assert(!r.pass && /준공 전 체크/.test(r.h3) && r.stage === 2 && !r.pass2, 'R11: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== reviewfix-v387: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

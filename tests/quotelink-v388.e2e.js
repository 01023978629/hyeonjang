/* quotelink-v388.e2e.js — v388 상담·실측 현장에 붙은 견적은 아직 '수주'가 아니다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(hjSendSms 가로챔).
   · quoteStatus: 현장 연결 = 수주는 그 현장이 시공·완료일 때만. 상담·실측 현장이면 작성/보냄(진행 중) → ⏰ 견적 팔로업·수주 분석·퍼널이 같은 판정.
     현장을 못 찾거나(지운·옛 이름) 보관한 현장이면 예전대로 수주. 현장이 시공으로 넘어가면 수주가 되어 팔로업에서 빠진다.
   · 팔로업 줄에 '📂 현장 (단계)', [📩 팔로업 문자 보내기]는 그 현장 고객 번호를 받는 분으로 채운다(목록 자료에는 번호 없음).
   · v384 상담 끝 → [🧾 견적서 쓰기] → 저장한 견적이 바로 '수주'로 잡히지 않는다. 읽기 함수는 저장본을 바꾸지 않는다. */
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
    window.__sms = []; window.hjSendSms = (phone, text) => { window.__sms.push({ phone, text }); };
    // 팔로업은 실제 오늘(new Date) 기준 3~30일 — 실제 오늘에서 n일 전
    window.__ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return window.__origLocalDate(d); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.notes = []; state.asLog = []; state.satisfaction = []; state.files = []; state.adPosts = []; state.contacts = []; state.schedule = [];
    const P = (name, x) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-3333-4444', addr: '대전 가상동 1' } }, x || {});
    state.projects = [P('상담현장'), P('실측현장', { stage: 1, customer: { name: '', phone: '', addr: '' } }), P('시공현장', { stage: 2 }), P('보관현장', { stage: 0, archived: true })];
    const it = p => [{ name: '도배(실크)', spec: '', qty: 1, price: p }];
    state.quotes = [
      { id: 'qa', title: '상담현장 견적', date: __ago(5), project: '상담현장', sentAt: __ago(5), items: it(3000000), vatIncluded: false },
      { id: 'qb', title: '실측현장 견적', date: __ago(9), project: '실측현장', items: it(2000000), vatIncluded: false },
      { id: 'qc', title: '시공현장 견적', date: __ago(6), project: '시공현장', items: it(4000000), vatIncluded: false },
      { id: 'qd', title: '보관현장 견적', date: __ago(6), project: '보관현장', items: it(1000000), vatIncluded: false },
      { id: 'qe', title: '지운현장 견적', date: __ago(6), project: '없는현장', items: it(1000000), vatIncluded: false },
      { id: 'qf', title: '미연결 견적', date: __ago(4), items: it(1500000), vatIncluded: false }
    ];
    state.editingQuote = null; state.tab = 'dashboard'; state.activeProject = null; render();
  });

  await test('① 상담·실측 현장에 붙은 견적 = 진행 중(팔로업·수주 분석·퍼널 같은 판정), 시공·보관·없는 현장 = 수주 · 읽기는 저장본 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const st = {}; state.quotes.forEach(q => { st[q.id] = quoteStatus(q); });
      const fu = quoteFollowupData().map(x => x.id + ':' + x.project);
      const fuKeys = Object.keys(quoteFollowupData()[0] || {}).sort();
      const wr = winRateData(); const fn = funnelData();
      return { st, fu, fuKeys, wr: [wr.total, wr.won, wr.pending, wr.rate], fn: [fn.quoteTotal, fn.quoteWon, fn.quoteRate], same: snap() === b0 };
    });
    assert(JSON.stringify(r.st) === JSON.stringify({ qa: 'sent', qb: 'draft', qc: 'won', qd: 'won', qe: 'won', qf: 'draft' }), '판정: ' + JSON.stringify(r.st));
    assert(JSON.stringify(r.fu) === JSON.stringify(['qf:', 'qa:상담현장', 'qb:실측현장']) && !r.fuKeys.includes('phone'), '팔로업: ' + JSON.stringify(r));
    assert(JSON.stringify(r.wr) === JSON.stringify([6, 3, 3, 50]) && JSON.stringify(r.fn) === JSON.stringify([6, 3, 50]) && r.same, '분석·퍼널·저장본: ' + JSON.stringify(r));
  });

  await test('② 팔로업 창 — 줄에 \'📂 현장 (단계)\', [📩]은 현장 고객 번호로(없으면 빈칸), 현장이 시공으로 넘어가면 수주로 빠진다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      window.__sms = [];
      quoteFollowup();
      const rows = [...document.querySelectorAll('#modalRoot .qfProj')].map(x => x.textContent);
      const hint = /시공 단계로 넘어가면\(수주\)/.test(document.getElementById('modalRoot').textContent);
      const h = [...document.querySelectorAll('#modalRoot .qfSms')].map(b => b.getBoundingClientRect().height);
      document.querySelector('#modalRoot .qfSms[data-q="qa"]').click();
      document.querySelector('#modalRoot .qfSms[data-q="qb"]').click();
      document.querySelector('#modalRoot .qfSms[data-q="qf"]').click();
      closeModal(true);
      const sms = window.__sms.map(x => x.phone + '|' + /실측현장 견적|상담현장 견적|미연결 견적/.exec(x.text)[0]);
      window.__clPass = 1; setStage('상담현장', 2); window.__clPass = 0;
      try { closeModal(true); } catch (e) {}
      return { rows, hint, minH: Math.min.apply(null, h), sms, after: quoteStatus(state.quotes[0]), fu: quoteFollowupData().map(x => x.id) };
    });
    assert(JSON.stringify(r.rows) === JSON.stringify(['📂 상담현장 (상담)', '📂 실측현장 (실측)']) && r.hint && r.minH >= 44, '줄: ' + JSON.stringify(r));
    assert(JSON.stringify(r.sms) === JSON.stringify(['010-3333-4444|상담현장 견적', '|실측현장 견적', '|미연결 견적']), '문자 받는 분: ' + JSON.stringify(r.sms));
    assert(r.after === 'won' && JSON.stringify(r.fu) === JSON.stringify(['qf', 'qb']), '시공 → 수주: ' + JSON.stringify(r));
  });

  await test('③ v384 상담 끝 → [🧾 견적서 쓰기] → 저장한 견적은 바로 수주가 아니고, 날이 지나면 팔로업에 오른다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      state.quotes = [];
      state.schedule = [{ id: 'c1', date: '2026-11-05', time: '10:00', title: '상담·실측: 상담현장', project: '상담현장', workers: '', memo: '', hours: 1, report: null }];
      openReportEdit('c1'); document.getElementById('rDone').value = '욕실 실측'; document.getElementById('rProgress').value = '완료';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /견적서 쓰기/.test(b.textContent)).click();
      state.editingQuote.items = [{ name: '욕실 리모델링', spec: '', qty: 1, price: 5000000 }];
      saveQuoteEdit();
      try { closeModal(true); } catch (e) {}
      const q = state.quotes.find(x => x.project === '상담현장');
      const st0 = q && quoteStatus(q);
      if (q) q.date = __ago(4);
      const fu = quoteFollowupData().map(x => x.project);
      const stage = state.projects.find(p => p.name === '상담현장').stage;
      state.editingQuote = null; state.tab = 'dashboard'; render();
      return { n: state.quotes.length, st0, fu, stage };
    });
    assert(r.n === 1 && r.stage === 1 && r.st0 !== 'won' && JSON.stringify(r.fu) === JSON.stringify(['상담현장']), '상담 끝 견적: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== quotelink-v388: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

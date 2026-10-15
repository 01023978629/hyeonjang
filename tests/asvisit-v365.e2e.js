/* asvisit-v365.e2e.js — v365 AS 접수 → 방문 일정·담당 한 번에 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·복사는 가로챔).
   · AS 기록의 [📅 방문 일정 잡기] → 일정 창('🔧 AS 방문 일정')을 방문일(없으면 다음 작업일)·10:00·2시간·AS 방문 제목·현장·메모로 채워 연다.
   · 저장하면 AS 기록과 잇는다(asId·visitSchedId·visitAt) → '다음 할 일' 창: 고객 방문 안내 글(고쳐서 문자) · 담당 작업지시(담당 번호 자동) · AS 관리로.
   · 이미 이어진 일정이 있으면 [고치기]로 그 일정을 연다(새로 만들지 않는다) — 날짜를 바꾸면 AS 방문일도 따라간다.
   · 고객 연락처가 없으면 [방문 안내 글 복사]. AS 방문 일정은 날짜를 옮겨도 같은 현장 뒤 일정을 밀자고 묻지 않는다.
   · AS 접수 직후 새 기록이 펼쳐져 [📅 방문 일정 잡기]가 바로 보인다. 창을 여닫기만 하면 저장본은 그대로. 오늘은 2026-11-05(목) 고정. */
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
    window.__sms = []; window.__copied = [];
    window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
    window.coworkCopy = (t, label) => { window.__copied.push({ t, label }); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }, { id: 'k2', name: '박도배', phone: '010-3333-4444', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 5, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } },
      { name: '가상현장B', stage: 5, received: 0, phases: [], cost: {}, customer: { name: '이가상', phone: '', addr: '' } }
    ];
    state.asLog = [
      { id: 'as1', project: '가상현장A', date: '2026-11-03', text: '욕실 실리콘 들뜸', status: 'open' },
      { id: 'as2', project: '가상현장B', date: '2026-11-04', text: '현관 문틀 벌어짐', status: 'open', visitAt: '2026-11-12' }
    ];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장B', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [S('b1', '2026-11-20', '도배'), S('b2', '2026-11-23', '조명')];
    window.__sms = []; window.__copied = []; __calSelDate = null;
    state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const h3 = () => page.evaluate(() => (document.querySelector('#modalRoot h3') || {}).textContent || '');
  const form = () => page.evaluate(() => ({ h3: document.querySelector('#modalRoot h3').textContent,
    ...Object.fromEntries(['schDate', 'schTime', 'schHours', 'schTitle', 'schProj', 'schMemo', 'schCrew'].map(i => [i, (document.getElementById(i) || {}).value])) }));
  const footBtn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re);

  await test('① AS 기록 [📅 방문 일정 잡기] → 일정 창을 방문일(없으면 다음 작업일)·10:00·2시간·제목·현장·메모로 채워 연다', async () => {
    await seed();
    const btn = await page.evaluate(() => { asManage('as1'); const b = document.querySelector('#modalRoot .asmVisit[data-id="as1"]'); return b && { text: b.textContent, h: b.getBoundingClientRect().height }; });
    assert(btn && /방문 일정 잡기/.test(btn.text) && btn.h >= 44, '버튼: ' + JSON.stringify(btn));
    await page.click('#modalRoot .asmVisit[data-id="as1"]');
    const f = await form();
    assert(JSON.stringify(f) === JSON.stringify({ h3: '🔧 AS 방문 일정', schDate: '2026-11-06', schTime: '10:00', schHours: '2', schTitle: '🔧 AS 방문: 욕실 실리콘 들뜸', schProj: '가상현장A', schMemo: 'AS 접수 2026-11-03 — 욕실 실리콘 들뜸', schCrew: '' }), '창: ' + JSON.stringify(f));
    await page.evaluate(() => { closeModal(true); hjAsVisitPlan('as2'); });
    const f2 = await form();
    assert(f2.schDate === '2026-11-12' && f2.schProj === '가상현장B', '방문일이 있으면 그 날: ' + JSON.stringify(f2));
  });

  await test('② 담당·날짜를 고쳐 저장 → AS 기록과 이어지고, 다음 할 일 창에서 고친 안내 글로 고객 문자 · 담당 번호가 채워진 작업지시', async () => {
    await seed();
    await page.evaluate(() => { hjAsVisitPlan('as1'); document.querySelector('#modalRoot .schCrewChip[data-n="김타일"]').click(); document.getElementById('schDate').value = '2026-11-09'; });
    assert(await footBtn('^저장$'), '저장 버튼');
    const r = await page.evaluate(() => {
      const s = state.schedule.find(x => x.asId === 'as1'), a = state.asLog.find(x => x.id === 'as1');
      const m = document.querySelector('#modalRoot .modal');
      return { n: state.schedule.length, s: s && { date: s.date, time: s.time, hours: s.hours, crew: s.crew, project: s.project, title: s.title }, link: !!s && a.visitSchedId === s.id, visitAt: a.visitAt,
        h3: m.querySelector('h3').textContent, body: m.textContent, text: (m.querySelector('#avText') || {}).value || '',
        btns: [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) };
    });
    assert(r.n === 3 && r.link && r.visitAt === '2026-11-09', '이음: ' + JSON.stringify(r).slice(0, 300));
    assert(JSON.stringify(r.s) === JSON.stringify({ date: '2026-11-09', time: '10:00', hours: 2, crew: '김타일', project: '가상현장A', title: '🔧 AS 방문: 욕실 실리콘 들뜸' }), '일정: ' + JSON.stringify(r.s));
    assert(r.h3 === '🔧 AS 방문 — 다음 할 일' && /11\/9\(월\) 10:00/.test(r.body) && /👤 김타일/.test(r.body), '창: ' + r.body.slice(0, 200));
    assert(/김가상님/.test(r.text) && /"욕실 실리콘 들뜸" 건으로 11\/9\(월\) 10:00에 방문드리겠습니다/.test(r.text) && !/둔산동|김타일/.test(r.text), '안내 글: ' + r.text);
    assert(JSON.stringify(r.btns) === JSON.stringify(['✉️ 고객에게 방문 안내', '📋 담당에게 작업지시', '🔧 AS 관리', '닫기']), '버튼: ' + JSON.stringify(r.btns));
    const sent = await page.evaluate(() => {
      document.getElementById('avText').value += '\n가상 덧붙임';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /고객에게 방문 안내/.test(b.textContent)).click();
      const sms = window.__sms.slice();
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /작업지시/.test(b.textContent)).click();
      return { sms, wo: document.querySelector('#modalRoot h3').textContent, phone: (document.getElementById('woPhone') || {}).value };
    });
    assert(sent.sms.length === 1 && sent.sms[0].to === '010-9999-8888' && /가상 덧붙임$/.test(sent.sms[0].t), '문자: ' + JSON.stringify(sent.sms));
    assert(sent.wo === '📋 작업지시 보내기' && sent.phone === '010-1111-2222', '작업지시: ' + JSON.stringify(sent));
  });

  await test('③ 이어진 일정이 있으면 [고치기]가 그 일정을 연다 — 날짜를 바꾸면 AS 방문일도 따라가고 일정은 늘지 않는다, [🔧 AS 관리]로 돌아간다', async () => {
    await seed();
    await page.evaluate(() => { hjAsVisitPlan('as1'); document.getElementById('schDate').value = '2026-11-09'; });
    await footBtn('^저장$');
    const r = await page.evaluate(() => {
      closeModal(true); asManage('as1');
      const b = document.querySelector('#modalRoot .asmVisit[data-id="as1"]'); const label = b.textContent; b.click();
      const f = { h3: document.querySelector('#modalRoot h3').textContent, date: document.getElementById('schDate').value, title: document.getElementById('schTitle').value };
      document.getElementById('schDate').value = '2026-11-10';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent === '저장').click();
      const after = { h3: document.querySelector('#modalRoot h3').textContent, body: document.querySelector('#modalRoot .modal').textContent };
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /AS 관리/.test(x.textContent)).click();
      const back = { h3: document.querySelector('#modalRoot h3').textContent, open: !!document.querySelector('#modalRoot details.asmMore[data-id="as1"][open]') };
      return { label, f, after, back, n: state.schedule.filter(x => x.asId === 'as1').length, visitAt: state.asLog.find(x => x.id === 'as1').visitAt };
    });
    assert(/방문 일정 고치기/.test(r.label), '고치기 버튼: ' + r.label);
    assert(r.f.h3 === '🔧 AS 방문 일정' && r.f.date === '2026-11-09' && r.f.title === '🔧 AS 방문: 욕실 실리콘 들뜸', '기존 일정: ' + JSON.stringify(r.f));
    assert(r.n === 1 && r.visitAt === '2026-11-10', '따라감: ' + JSON.stringify(r));
    assert(r.after.h3 === '🔧 AS 방문 — 다음 할 일' && /11\/10\(화\) 10:00/.test(r.after.body), '다음 할 일: ' + r.after.body.slice(0, 120));
    assert(r.back.h3 === '🔧 AS·하자보수 관리' && r.back.open, 'AS 관리로: ' + JSON.stringify(r.back));
  });

  await test('④ 고객 연락처 없음 → [📋 방문 안내 글 복사], AS 방문 일정은 날짜를 옮겨도 뒤 공정을 밀자고 묻지 않는다', async () => {
    await seed();
    await page.evaluate(() => { hjAsVisitPlan('as2'); });
    await footBtn('^저장$');
    const r = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent);
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /방문 안내 글 복사/.test(b.textContent)).click();
      const copied = window.__copied.slice(), sms = window.__sms.length;
      closeModal(true);
      const s = state.schedule.find(x => x.asId === 'as2');
      openScheduleEdit(s.id); const plainTitle = document.querySelector('#modalRoot h3').textContent;
      document.getElementById('schTitle').value = '방문 점검'; document.getElementById('schDate').value = '2026-11-13';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent === '저장').click();
      return { btns, copied, sms, plainTitle, modal: !!document.querySelector('#modalRoot .modal'), h3: (document.querySelector('#modalRoot h3') || {}).textContent || '',
        b1: state.schedule.find(x => x.id === 'b1').date, visitAt: state.asLog.find(x => x.id === 'as2').visitAt };
    });
    assert(r.btns[0] === '📋 방문 안내 글 복사' && r.copied.length === 1 && /이가상님/.test(r.copied[0].t) && r.sms === 0, '복사: ' + JSON.stringify(r).slice(0, 300));
    assert(r.plainTitle === '일정 수정', '일정표에서 열면 보통 수정 창: ' + r.plainTitle);
    assert(!/뒤 일정도/.test(r.h3) && r.b1 === '2026-11-20' && r.visitAt === '2026-11-13', '뒤 공정 그대로·방문일 따라감: ' + JSON.stringify(r));
  });

  await test('⑤ AS 접수 직후 새 기록이 펼쳐져 [📅 방문 일정 잡기]가 바로 보인다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      asManage();
      document.getElementById('asmProj').value = '가상현장A'; document.getElementById('asmText').value = '주방 상부장 처짐';
      document.getElementById('asmAdd').click();
      const na = state.asLog.find(x => x.text === '주방 상부장 처짐');
      const d = na && document.querySelector('#modalRoot details.asmMore[data-id="' + na.id + '"]');
      const b = d && d.querySelector('.asmVisit');
      return { n: state.asLog.length, open: !!(d && d.open), visible: !!(b && b.getBoundingClientRect().height >= 44), text: b && b.textContent };
    });
    assert(r.n === 3 && r.open && r.visible && /방문 일정 잡기/.test(r.text), '새 기록: ' + JSON.stringify(r));
  });

  await test('⑥ 창을 열고 닫기만 하면 저장본은 그대로, 390px 가로 넘침 없음', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      asManage('as1'); const w1 = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      hjAsVisitPlan('as1'); const w2 = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent === '취소').click();
      return { same: snap() === b0, w1, w2, n: state.schedule.length };
    });
    assert(r.same && r.n === 2, '저장본이 바뀌었다: ' + JSON.stringify(r));
    assert(r.w1 <= 0 && r.w2 <= 0, '390px 가로 넘침: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== asvisit-v365: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

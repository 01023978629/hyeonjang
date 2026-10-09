/* crew-v357.e2e.js — v357 👷 일정 담당 팀원 + 연락처 '팀원' 표시 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음(공유 시트·문자 앱은 가로챔).
   · 연락처 수정 창 [👷 팀원] 체크 → 연락처 항목 안 team:true. 저장은 기존 항목에 폼 칸만 덮는다(예전엔 tag·email 이 지워졌다).
   · 일정 창 '담당 팀원' — 팀원 칩을 누르면 넣고/빼고, 직접 적어도 된다. 일정 항목 안 crew(쉼표 글자). 최상위 저장 키 그대로.
   · 담당은 일정표·대시보드·📋 내 업무·🔔 알림 문자·.ics 설명·📤 공유 글에 보인다.
   · 📤 공유 창은 담당별로 좁히고, 팀원 연락처 번호가 있으면 문자 받는 번호를 채운다. 작업지시 창도 담당 한 명이면 번호를 채운다.
   · 오늘은 2026-11-05(목)로 고정(localDate 를 가로챔). */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    const orig = window.localDate; window.localDate = (d) => d ? orig(d) : '2026-11-05';
    window.__shared = []; window.__sms = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared.push(d); } });
    window.hjSmsGo = (u) => { window.__sms.push(u); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = []; state.asLog = [];
    state.contacts = [
      { id: 'k1', name: '김타일', phone: '010-1111-2222', company: '가상타일', title: '', memo: '', team: true },
      { id: 'k2', name: '박도배', phone: '010-3333-4444', company: '', title: '', memo: '', team: true },
      { id: 'k3', name: '이고객', phone: '010-5555-6666', company: '', title: '', memo: '[카카오] 욕실', tag: '고객', email: 'lee@example.invalid' }
    ];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('x', '2026-11-05', '타일 시공', { crew: '김타일' }),
      S('y', '2026-11-05', '도배', { time: '13:00', crew: '박도배' }),
      S('z', '2026-11-05', '자재 정리', { time: '16:00' }),
      S('w', '2026-11-06', '마감', { crew: '김타일, 박도배' })
    ];
    window.__shared = []; window.__sms = []; __calSelDate = null;
  });

  await test('① 연락처 [👷 팀원] 표시 — 저장해도 tag·email 이 남고, 해제하면 team 이 빠진다', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      openContactEdit('k3');
      const box = document.getElementById('cTeam'); const before = box.checked; box.checked = true;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const k3 = Object.assign({}, state.contacts.find(c => c.id === 'k3'));
      state.tab = 'contacts'; render(); await new Promise(r => setTimeout(r, 40));
      const badges = [...document.querySelectorAll('#view [data-conteam]')].map(b => b.closest('.ci').querySelector('b').textContent);
      openContactEdit('k3'); document.getElementById('cTeam').checked = false;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const k3b = Object.assign({}, state.contacts.find(c => c.id === 'k3'));
      openContactEdit(); document.getElementById('cName').value = '최설비'; document.getElementById('cTeam').checked = true;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const fresh = state.contacts.find(c => c.name === '최설비');
      return { before, k3, badges, k3b, fresh: fresh && fresh.team, n: state.contacts.length, keys: Object.keys(serializeData()).length };
    });
    assert(r.before === false && r.k3.team === true && r.k3.tag === '고객' && r.k3.email === 'lee@example.invalid' && r.k3.memo === '[카카오] 욕실', '팀원 표시·다른 칸 보존: ' + JSON.stringify(r.k3));
    assert(JSON.stringify(r.badges) === JSON.stringify(['김타일', '박도배', '이고객']), '팀원 배지: ' + JSON.stringify(r.badges));
    assert(!('team' in r.k3b) && r.k3b.tag === '고객', '해제: ' + JSON.stringify(r.k3b));
    assert(r.fresh === true && r.n === 4 && r.keys === 41, '새 연락처·저장 키: ' + JSON.stringify(r));
  });

  await test('② 일정 창 담당 팀원 — 칩으로 넣고 빼고, 직접 적은 이름도 저장(팀원 아닌 연락처는 칩 없음)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      openScheduleEdit('z');
      const chips = () => [...document.querySelectorAll('#modalRoot .schCrewChip')].map(b => b.dataset.n + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''));
      const inp = document.getElementById('schCrew'), click = n => document.querySelector('#modalRoot .schCrewChip[data-n="' + n + '"]').click();
      const c0 = chips(); click('김타일'); const v1 = inp.value; click('박도배'); const v2 = inp.value, c2 = chips(); click('김타일'); const v3 = inp.value;
      const h = Math.min(...[...document.querySelectorAll('#modalRoot .schCrewChip')].map(b => b.getBoundingClientRect().height));
      inp.value = ' 박도배 ,최설비,박도배 ';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
      const saved = state.schedule.find(s => s.id === 'z').crew;
      state.contacts.forEach(c => { delete c.team; });
      openScheduleEdit('z'); const hint = document.getElementById('schCrewChips').textContent, kept = document.getElementById('schCrew').value; closeModal(true);
      return { c0, v1, v2, c2, v3, h, saved, hint, kept };
    });
    assert(JSON.stringify(r.c0) === JSON.stringify(['김타일', '박도배']), '칩: ' + JSON.stringify(r.c0));
    assert(r.v1 === '김타일' && r.v2 === '김타일, 박도배' && JSON.stringify(r.c2) === JSON.stringify(['김타일*', '박도배*']) && r.v3 === '박도배', '넣고 빼기: ' + JSON.stringify(r));
    assert(r.h >= 44, '칩 높이: ' + r.h);
    assert(r.saved === '박도배, 최설비', '저장(정리·중복 제거): ' + r.saved);
    assert(/팀원'으로 표시하면/.test(r.hint) && r.kept === '박도배, 최설비', '팀원 없을 때: ' + JSON.stringify(r));
  });

  await test('③ 담당이 일정표·대시보드·내 업무·알림 문자·.ics 에 보인다', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      state.tab = 'schedule'; render(); await new Promise(r => setTimeout(r, 40));
      const list = [...document.querySelectorAll('#view [data-schcrew]')].map(e => e.textContent.trim());
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 60));
      const dash = [...document.querySelectorAll('#view [data-dashcrew]')].map(e => e.textContent.trim());
      const root = myWorkView({ refresh: false }); const mw = root.querySelector('[data-mw-sch="x"] .mwMeta').textContent; closeModal(true);
      const nd = notifyDrafts('2026-11-06')[0].worker;
      const ics = buildICS([state.schedule.find(s => s.id === 'w')]);
      return { list, dash, mw, nd, ics };
    });
    assert(JSON.stringify(r.list) === JSON.stringify(['👤 담당 김타일', '👤 담당 박도배', '👤 담당 김타일, 박도배']), '일정표: ' + JSON.stringify(r.list));
    assert(r.dash.includes('👤김타일') && r.dash.includes('👤박도배'), '대시보드: ' + JSON.stringify(r.dash));
    assert(/👤 김타일/.test(r.mw), '내 업무: ' + r.mw);
    assert(/담당: 김타일, 박도배/.test(r.nd), '알림 문자: ' + r.nd);
    assert(/DESCRIPTION:.*담당 김타일\\, 박도배/.test(r.ics), '.ics: ' + r.ics);
  });

  await test('④ 📤 공유 창 담당별 — 그 사람 일정만, 문자 번호 채움, 일정 하나 공유도 담당 한 명이면 번호', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      hjSchShareView({ kind: 'today' });
      const m = () => document.querySelector('#modalRoot .modal');
      const opts = [...m().querySelectorAll('#shCrew option')].map(o => o.textContent);
      const all = { count: m().querySelector('#shCount').textContent, phone: m().querySelector('#shPhone').value, text: m().querySelector('#shText').value };
      const sel = m().querySelector('#shCrew'); sel.value = '김타일'; sel.dispatchEvent(new Event('change'));
      const kim = { count: m().querySelector('#shCount').textContent, phone: m().querySelector('#shPhone').value, text: m().querySelector('#shText').value };
      [...m().querySelectorAll('.shRange')].find(b => b.textContent === '이번 주').click();
      const week = { count: m().querySelector('#shCount').textContent, sel: m().querySelector('#shCrew').value };
      m().querySelector('#shSms').click();
      m().querySelector('#shKakao').click(); await new Promise(r => setTimeout(r, 20));
      hjSchShareView({ ids: ['y'] }); const oneY = m().querySelector('#shPhone').value;
      hjSchShareView({ ids: ['w'] }); const oneW = m().querySelector('#shPhone').value; closeModal(true);
      return { opts, all, kim, week, sms: window.__sms, shared: window.__shared.map(s => s.text), oneY, oneW };
    });
    assert(JSON.stringify(r.opts) === JSON.stringify(['전체 팀원', '👤 김타일', '👤 박도배']), '담당 목록: ' + JSON.stringify(r.opts));
    assert(/일정 3건/.test(r.all.count) && r.all.phone === '' && /👤 김타일/.test(r.all.text), '전체: ' + JSON.stringify(r.all));
    assert(/일정 1건/.test(r.kim.count) && r.kim.phone === '010-1111-2222' && /오늘 · 김타일/.test(r.kim.text) && /타일 시공/.test(r.kim.text) && !/도배|자재 정리/.test(r.kim.text), '김타일만: ' + JSON.stringify(r.kim));
    assert(/일정 2건/.test(r.week.count) && r.week.sel === '김타일', '범위 바꿔도 담당 유지: ' + JSON.stringify(r.week));
    assert(r.sms.length === 1 && /^sms:01011112222\?body=/.test(r.sms[0]) && r.shared.length === 1 && /이번 주 · 김타일/.test(r.shared[0]), '보내기: ' + JSON.stringify(r.sms).slice(0, 120));
    assert(r.oneY === '010-3333-4444' && r.oneW === '', '일정 하나: ' + JSON.stringify([r.oneY, r.oneW]));
  });

  await test('⑤ 작업지시 창 — 담당이 팀원 한 명이면 번호를 채우고, 여럿·팀원 아님·담당 없음은 비운다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const ph = id => { openWorkOrder({ schId: id }); const v = document.getElementById('woPhone').value; closeModal(true); return v; };
      state.schedule.find(s => s.id === 'z').crew = '최외부';
      return [ph('x'), ph('w'), ph('z'), (() => { state.schedule.find(s => s.id === 'z').crew = ''; return ph('z'); })()];
    });
    assert(JSON.stringify(r) === JSON.stringify(['010-1111-2222', '', '', '']), '작업지시 번호: ' + JSON.stringify(r));
  });

  await test('⑥ 화면을 그리는 읽기 경로는 저장본을 바꾸지 않는다', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      state.tab = 'schedule'; render(); state.tab = 'dashboard'; render(); state.tab = 'contacts'; render(); await new Promise(r => setTimeout(r, 40));
      myWorkView({ refresh: false }); closeModal(true); openScheduleEdit('x'); closeModal(true); openContactEdit('k1'); closeModal(true);
      hjSchShareView({ kind: 'week', crew: '박도배' }); closeModal(true); openWorkOrder({ schId: 'x' }); closeModal(true); notifyDrafts('2026-11-05');
      return { same: snap() === b0, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(r.same, '저장본이 바뀌었다');
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== crew-v357: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

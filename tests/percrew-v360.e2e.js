/* percrew-v360.e2e.js — v360 📤 일정 공유 창 '👥 팀원별로 보내기' (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·공유 시트는 가로챔).
   · 담당을 하나씩 고르지 않아도 범위 안 담당 팀원마다 한 줄: 그 사람 일정 수, [✉️ 문자](팀원 연락처 번호가 있을 때), [💬 카톡].
   · 각 글은 그 사람 담당 일정으로 새로 만든다(머리 '이번 주 · 이름'). 담당 없는 일정은 어느 글에도 없고 그 수를 알린다.
   · 담당을 골랐거나·일정 하나 공유·담당이 아무도 없으면 이 칸은 없다. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }, { id: 'k2', name: '박도배', phone: '010-3333-4444', team: true }];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { addr: '대전 서구 둔산동 1' } }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('x', '2026-11-05', '타일 시공', { crew: '김타일' }),
      S('y', '2026-11-05', '도배', { time: '13:00', crew: '박도배' }),
      S('z', '2026-11-05', '자재 정리', { time: '16:00' }),
      S('w', '2026-11-06', '마감', { crew: '김타일, 박도배' }),
      S('q', '2026-11-07', '설비 점검', { crew: '최외부' })
    ];
    window.__shared = []; window.__sms = []; __calSelDate = null;
  });

  await test('① 이번 주 — 팀원마다 한 줄(일정 수·문자/카톡), 번호 없는 사람은 카톡만, 담당 없는 일정 수 안내', async () => {
    await seed();
    const r = await page.evaluate(() => {
      hjSchShareView({ kind: 'week' });
      const box = document.getElementById('shPerCrew');
      const rows = [...box.querySelectorAll('.shPcKakao')].map(b => { const row = b.closest('div'); return { t: row.querySelector('span').textContent.replace(/\s+/g, ' ').trim(), sms: !!row.querySelector('.shPcSms') }; });
      const h = Math.min(...[...box.querySelectorAll('button')].map(b => b.getBoundingClientRect().height));
      return { rows, hint: box.textContent, h, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert(JSON.stringify(r.rows) === JSON.stringify([{ t: '👤 김타일 · 2건', sms: true }, { t: '👤 박도배 · 2건', sms: true }, { t: '👤 최외부 · 1건 (번호 없음)', sms: false }]), '줄: ' + JSON.stringify(r.rows));
    assert(/담당 없는 일정 1건은 팀원별 글에 들어가지 않아요/.test(r.hint), '담당 없음 안내: ' + r.hint);
    assert(r.h >= 44 && r.wide <= 0, '버튼 높이·가로: ' + JSON.stringify(r));
  });

  await test('② 각자 자기 담당 일정 글 — 김타일 문자, 최외부 카톡(고친 글상자 내용은 안 들어감)', async () => {
    await seed();
    const r = await page.evaluate(async () => {
      hjSchShareView({ kind: 'week' });
      document.getElementById('shText').value += '\n가상 고친 줄';
      document.querySelector('#shPerCrew .shPcSms[data-i="0"]').click();
      document.querySelector('#shPerCrew .shPcKakao[data-i="2"]').click(); await new Promise(r => setTimeout(r, 20));
      return { sms: window.__sms, shared: window.__shared.map(s => ({ title: s.title, text: s.text })) };
    });
    assert(r.sms.length === 1 && /^sms:01011112222\?body=/.test(r.sms[0]), '문자: ' + JSON.stringify(r.sms).slice(0, 100));
    const kim = decodeURIComponent(r.sms[0].split('body=')[1]);
    assert(/작업 일정 — 이번 주 · 김타일 11\/2\(월\)~11\/8\(일\)/.test(kim) && /타일 시공/.test(kim) && /마감/.test(kim) && !/13:00 도배|자재 정리|설비 점검|가상 고친 줄/.test(kim), '김타일 글: ' + kim);
    assert(r.shared.length === 1 && /최외부/.test(r.shared[0].title) && /설비 점검/.test(r.shared[0].text) && !/타일 시공/.test(r.shared[0].text), '최외부 카톡: ' + JSON.stringify(r.shared));
  });

  await test('③ 담당을 골랐거나·일정 하나·담당 아무도 없음이면 팀원별 칸이 없다, 저장본은 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      hjSchShareView({ kind: 'week', crew: '김타일' }); const picked = !!document.getElementById('shPerCrew');
      hjSchShareView({ ids: ['w'] }); const one = !!document.getElementById('shPerCrew');
      state.schedule.forEach(s => { delete s.crew; }); const b1 = snap();
      hjSchShareView({ kind: 'week' }); const nobody = !!document.getElementById('shPerCrew'); closeModal(true);
      return { picked, one, nobody, same: snap() === b1, first: b0.length > 0 };
    });
    assert(!r.picked && !r.one && !r.nobody, '칸이 없어야 함: ' + JSON.stringify(r));
    assert(r.same, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== percrew-v360: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

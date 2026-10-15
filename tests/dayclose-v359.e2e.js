/* dayclose-v359.e2e.js — v359 🌙 오늘 마감: 하루를 닫을 때 보고·사진·내일 일정·AS 를 한 화면에서 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · 보고할 일정 = 오늘 끝나는 일정(하루짜리·여러 날 공정 마지막 날) 중 완료 보고 없는 것. 중간 날은 '내일도 계속'. 💰 제외.
   · 오늘 사진 수·현장 미배정 수(오늘 것만). 내일 일정(이어지는 공정 포함)·담당(팀원 연락처가 있을 때만 '담당 없음').
   · 오늘 접수된 끝나지 않은 AS. 버튼은 기존 화면(완료 보고·일정 수정·준비물·공유·알림 문자·사진 탭·AS 관리)을 연다.
   · 입구: 대시보드 '📅 오늘 일정' 머리 [🌙 오늘 마감] · 📋 내 업무 [🌙 오늘 마감]. 읽기 전용. 오늘은 2026-11-05(목) 고정. */
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
  });
  const seed = (team) => page.evaluate((team) => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = [];
    state.contacts = team ? [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }] : [];
    state.projects = [{ name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: {} }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('a', '2026-11-05', '조명'),
      S('b', '2026-11-05', '철거', { report: { done: '철거 끝', progress: '완료' } }),
      S('c', '2026-11-03', '타일 (3일차 시작)', { memo: '2026-11-03~2026-11-05 (3일)' }),
      S('d', '2026-11-05', '도배 (2일차 시작)', { time: '13:00', memo: '2026-11-05~2026-11-06 (2일)' }),
      S('e', '2026-11-05', '💰 잔금', { hours: 0 }),
      S('f', '2026-11-06', '마감', { time: '10:00' }),
      S('g', '2026-11-06', '바닥', { time: '08:00', crew: '김타일' })
    ];
    const P = (id, day, project) => ({ id, kind: 'photo', name: id + '.jpg', project, when: new Date(day + 'T10:00:00'), size: 10 });
    state.files = [P('p1', '2026-11-05', '가상현장A'), P('p2', '2026-11-05', '가상현장A'), P('p3', '2026-11-05', ''), P('p4', '2026-11-04', '')];
    state.asLog = [
      { id: 'as1', project: '가상현장A', date: '2026-11-05', text: '가상 실리콘 들뜸', status: 'open' },
      { id: 'as2', project: '가상현장A', date: '2026-11-05', text: '끝난 AS', status: 'done' },
      { id: 'as3', project: '가상현장A', date: '2026-11-04', text: '어제 AS', status: 'open' }
    ];
  }, team);

  await test('① 요약·보고할 일정(오늘 끝나는 것)·내일도 계속·사진·내일 일정·담당 없음·AS', async () => {
    await seed(true);
    const r = await page.evaluate(() => {
      const d = hjDayCloseData('2026-11-05');
      hjDayCloseView();
      const m = document.getElementById('dayClose');
      const rows = sel => [...m.querySelectorAll(sel)].map(b => b.closest('div').querySelector('span').textContent.replace(/\s+/g, ' ').trim());
      return {
        title: document.querySelector('#modalRoot h3').textContent,
        summary: m.querySelector('#dcSummary').textContent,
        report: rows('[data-dc-report]'), reportIds: [...m.querySelectorAll('[data-dc-report]')].map(b => b.dataset.dcReport),
        crew: [...m.querySelectorAll('[data-dc-crew]')].map(b => b.dataset.dcCrew),
        prep: rows('[data-dc-prep]'), text: m.textContent,
        minH: Math.min(...[...m.querySelectorAll('button')].map(b => b.getBoundingClientRect().height)),
        data: { need: d.needReport.map(x => x.s.id), ongoing: d.ongoing.map(x => x.s.id), reported: d.reported, photos: d.photos, loose: d.loose, tmr: d.tmr.map(x => x.s.id + (x.c ? ':' + x.c.day : '')), noCrew: d.noCrew, as: d.asToday.map(a => a.id) },
        wide: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert(r.title === '🌙 오늘 마감 — 11/5(목)', '제목: ' + r.title);
    assert(JSON.stringify(r.data) === JSON.stringify({ need: ['a', 'c'], ongoing: ['d'], reported: 1, photos: 3, loose: 1, tmr: ['g', 'f', 'd:2'], noCrew: ['f'], as: ['as1'] }), '자료: ' + JSON.stringify(r.data));
    assert(/보고할 일정 2/.test(r.summary) && /미배정 사진 1/.test(r.summary) && /내일 일정 3/.test(r.summary) && /담당 없음 1/.test(r.summary) && /오늘 AS 1/.test(r.summary), '요약: ' + r.summary);
    assert(JSON.stringify(r.reportIds) === JSON.stringify(['a', 'c']) && /09:00 조명 · 가상현장A/.test(r.report[0]) && /타일 \(3\/3일째\)/.test(r.report[1]), '보고할 일정: ' + JSON.stringify(r.report));
    assert(/내일도 계속: 13:00 도배 \(1\/2일째\)|내일도 계속: 도배 \(1\/2일째\)/.test(r.text), '내일도 계속: ' + r.text.slice(0, 400));
    assert(!/잔금/.test(r.text) && !/어제 AS|끝난 AS/.test(r.text) && /가상 실리콘 들뜸/.test(r.text), '빼야 할 것: ' + r.text.slice(0, 300));
    assert(JSON.stringify(r.crew) === '["f"]' && r.prep.length === 3 && /08:00 바닥 · 가상현장A · 👤 김타일/.test(r.prep[0]) && /마감.*담당 없음/.test(r.prep[1]) && /도배 \(2\/2일째\)/.test(r.prep[2]), '내일 일정: ' + JSON.stringify(r.prep));
    assert(r.minH >= 44, '버튼 높이: ' + r.minH);
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('② 버튼은 기존 화면을 연다 — 완료 보고·담당 정하기·준비물·팀 공유(‹ 뒤로)·알림 문자·사진 탭·AS 관리', async () => {
    await seed(true);
    const r = await page.evaluate(async () => {
      const open = sel => { hjDayCloseView(); document.querySelector('#dayClose ' + sel).click(); const h = document.querySelector('#modalRoot h3'); return h ? h.textContent : '(창 없음)'; };
      const out = {};
      out.report = open('[data-dc-report="a"]'); out.reportBox = !!document.getElementById('mwDoneText');
      out.crew = open('[data-dc-crew="f"]'); out.crewBox = !!document.getElementById('schCrew') && document.getElementById('schTitle').value;
      out.prep = open('[data-dc-prep="g"]');
      out.share = open('[data-dc-share]'); out.shareSel = (document.querySelector('.shRange[aria-pressed="true"]') || {}).textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /뒤로/.test(b.textContent)).click(); out.back = document.querySelector('#modalRoot h3').textContent;
      out.notify = open('[data-dc-notify]');
      out.as = open('[data-dc-as]');
      hjDayCloseView(); document.querySelector('#dayClose [data-dc-photos]').click(); out.photos = { tab: state.tab, modal: !!document.querySelector('#modalRoot .modal') };
      closeModal(true); state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 50));
      return out;
    });
    assert(/완료 보고/.test(r.report) && r.reportBox, '완료 보고: ' + JSON.stringify(r));
    assert(r.crew === '일정 수정' && r.crewBox === '마감', '담당 정하기: ' + JSON.stringify(r));
    assert(r.prep !== '(창 없음)' && !/오늘 마감/.test(r.prep), '준비물: ' + r.prep);
    assert(/일정 공유/.test(r.share) && r.shareSel === '내일' && /오늘 마감/.test(r.back), '팀 공유·뒤로: ' + JSON.stringify(r));
    assert(/일정 알림 문자/.test(r.notify) && /AS/.test(r.as), '알림 문자·AS: ' + JSON.stringify(r));
    assert(r.photos.tab === 'photos' && !r.photos.modal, '사진 탭: ' + JSON.stringify(r.photos));
  });

  await test('③ 입구: 대시보드 [🌙 오늘 마감] · 📋 내 업무 [🌙 오늘 마감], 팀원 연락처가 없으면 담당 없음을 말하지 않는다', async () => {
    await seed(false);
    const r = await page.evaluate(async () => {
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 60));
      const b = document.querySelector('#view [data-dayclose]'); const h = b && b.getBoundingClientRect().height; b.click();
      const fromDash = document.querySelector('#modalRoot h3').textContent, crewBtns = document.querySelectorAll('#dayClose [data-dc-crew]').length, sum = document.getElementById('dcSummary').textContent;
      closeModal(true);
      const root = myWorkView({ refresh: false }); root.querySelector('#mwClose').click();
      const fromWork = document.querySelector('#modalRoot h3').textContent; closeModal(true);
      return { h, fromDash, crewBtns, sum, fromWork };
    });
    assert(r.h >= 44 && /오늘 마감/.test(r.fromDash) && /오늘 마감/.test(r.fromWork), '입구: ' + JSON.stringify(r));
    assert(r.crewBtns === 0 && !/담당 없음/.test(r.sum), '팀원 없음: ' + JSON.stringify(r));
  });

  await test('④ 빈 날: 보고·사진·내일 일정이 없다고 말한다', async () => {
    await seed(true);
    const t = await page.evaluate(() => { state.schedule = []; state.files = []; state.asLog = []; hjDayCloseView(); const x = document.getElementById('dayClose').textContent; closeModal(true); return x; });
    assert(/오늘 끝나는 일정이 없어요/.test(t) && /오늘 찍은 사진이 없어요/.test(t) && /내일 잡힌 일정이 없어요/.test(t) && !/오늘 접수된 AS/.test(t), '빈 날: ' + t);
  });

  await test('⑤ 창을 여는 것만으로는 저장본이 바뀌지 않는다', async () => {
    await seed(true);
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      hjDayCloseView(); closeModal(true); hjDayCloseData(); state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 40));
      myWorkView({ refresh: false }); closeModal(true);
      return snap() === b0;
    });
    assert(r, '저장본이 바뀌었다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== dayclose-v359: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

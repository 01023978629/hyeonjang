/* handoff-v374.e2e.js — v374 공정 완료 → 다음 공정 담당에게 알리기 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신 없음(문자 앱·카톡 공유·복사는 가로챔).
   · 다음 공정 = 같은 현장의 완료 보고 전 일정 중 끝난 일정 뒤(같은 날이면 더 늦은 시간)에서 가장 이른 것 — 💰·AS 방문·상담·실측 제외.
   · 일정표 📋 작업 보고(진행률 '완료')·📋 내 업무 ✅ 완료 보고 뒤 '🔨 다음 공정에 알리기' — 끝난 공정·다음 날짜/시간·주소·전달 사항(특이사항),
     담당 👷 팀원 번호가 있으면 [✉️ 담당에게 문자], 없으면 [💬 카톡]·[📋 복사]. 보내면 handoffAt. [나중에]는 아무것도 안 바꿈.
   · 완료가 아닌 보고·다음 공정 없음·AS 방문(→ AS 마무리 먼저)·상담 일정은 묻지 않는다. 오늘은 2026-11-05(목) 고정. */
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
    window.__sms = []; window.__kakao = []; window.__copied = [];
    window.hjSmsGo = url => { window.__sms.push(url); };
    window.kakaoShareText = (t, title) => { window.__kakao.push({ t, title }); };
    window.coworkCopy = (t, label) => { window.__copied.push({ t, label }); };
  });
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.notes = []; state.files = [];
    state.contacts = [{ id: 'k1', name: '김타일', phone: '010-1111-2222', team: true }, { id: 'k2', name: '박도배', phone: '010-3333-4444', team: true }];
    state.projects = [
      { name: '가상현장A', stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-9999-8888', addr: '대전 서구 둔산동 1' } },
      { name: '가상현장B', stage: 2, received: 0, phases: [], cost: {}, customer: {} }
    ];
    state.asLog = [{ id: 'as1', project: '가상현장A', date: '2026-11-01', text: '가상 하자', status: 'open', visitSchedId: 'asv' }];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('t1', '2026-11-05', '타일', { crew: '김타일' }),
      S('t1b', '2026-11-05', '타일 줄눈', { time: '08:00' }),
      S('pay', '2026-11-06', '💰 잔금'),
      S('asv', '2026-11-06', '🔧 AS 방문: 가상 하자', { asId: 'as1', time: '13:00', hours: 2 }),
      S('cs', '2026-11-07', '상담 — 추가 공사'),
      S('t4', '2026-11-10', '도배 (2일차 시작)', { crew: '박도배', memo: '2026-11-10~2026-11-11 (2일)' }),
      S('t5', '2026-11-12', '마루'),
      S('b1', '2026-11-06', '목공', { project: '가상현장B' })
    ];
    window.__sms = []; window.__kakao = []; window.__copied = []; state.tab = 'dashboard'; state.activeProject = null; render();
  });
  const report = (id, prog, issue) => page.evaluate(({ id, prog, issue }) => {
    openReportEdit(id); document.getElementById('rDone').value = '가상 작업 완료'; document.getElementById('rProgress').value = prog; document.getElementById('rIssue').value = issue || '';
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '저장').click();
    const m = document.querySelector('#modalRoot .modal');
    return { h3: m ? m.querySelector('h3').textContent : '', text: (document.getElementById('hoText') || {}).value || '', info: m ? m.textContent : '', btns: m ? [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) : [] };
  }, { id, prog, issue });
  const click = re => page.evaluate(src => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re);

  await test('① 다음 공정 — 같은 현장·완료 보고 전·뒤 일정 중 가장 이른 것(💰·AS 방문·상담 제외, 같은 날 앞 시간 제외)', async () => {
    await seed();
    const r = await page.evaluate(() => Object.fromEntries(['t1', 't1b', 't4', 't5', 'b1', 'cs', 'asv'].map(id => { const n = hjHandoffNext(state.schedule.find(x => x.id === id)); return [id, n ? n.id : null]; })));
    assert(JSON.stringify(r) === JSON.stringify({ t1: 't4', t1b: 't1', t4: 't5', t5: null, b1: null, cs: null, asv: null }), '다음: ' + JSON.stringify(r));
  });

  await test('② 일정표 작업 보고 \'완료\' → 다음 공정 알리기: 글(끝난 공정·다음 날짜·주소·전달 사항), 담당 번호로 문자, handoffAt', async () => {
    await seed();
    const r = await report('t1', '완료', '욕실 벽 한쪽 줄눈 마감 남음');
    assert(r.h3 === '🔨 다음 공정에 알리기' && /타일 완료 → 다음: 11\/10\(화\) 09:00 도배 · 👤 박도배/.test(r.info), '창: ' + r.info.slice(0, 120));
    assert(r.text === '[만물인테리어] 다음 공정 안내\n가상현장A 타일 작업이 끝났습니다.\n다음: 11/10(화) 09:00 도배 — 예정대로 진행 부탁드립니다.\n주소: 대전 서구 둔산동 1\n전달 사항: 욕실 벽 한쪽 줄눈 마감 남음\n- 전병덕 010-2397-8629', '글: ' + r.text);
    assert(JSON.stringify(r.btns) === JSON.stringify(['✉️ 담당에게 문자', '💬 카톡', '나중에']), '버튼: ' + JSON.stringify(r.btns));
    const s = await page.evaluate(() => {
      document.getElementById('hoText').value += '\n가상 덧붙임';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /담당에게 문자/.test(b.textContent)).click();
      return { sms: window.__sms, at: state.schedule.find(x => x.id === 't1').handoffAt, open: !!document.querySelector('#modalRoot .modal') };
    });
    assert(s.sms.length === 1 && /^sms:01033334444/.test(s.sms[0]) && /%EA%B0%80%EC%83%81%20%EB%8D%A7%EB%B6%99%EC%9E%84$/.test(s.sms[0]) && s.at === '2026-11-05' && !s.open, '문자: ' + JSON.stringify(s));
  });

  await test('③ 완료가 아닌 보고·다음 공정 없음·상담·AS 방문(→ AS 마무리)은 묻지 않고, [나중에]는 아무것도 안 바꾼다', async () => {
    await seed();
    const half = await report('t1', '50%');
    const last = await report('t5', '완료');
    const cs = await report('cs', '완료');
    const asv = await report('asv', '완료');
    try { await page.evaluate(() => closeModal(true)); } catch (e) {}
    assert(half.h3 === '' && last.h3 === '' && cs.h3 === '' && asv.h3 === '🔧 AS 기록 마무리', '묻지 않음: ' + JSON.stringify([half.h3, last.h3, cs.h3, asv.h3]));
    await seed();
    await report('t4', '완료');
    const snap = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
    const b0 = await snap();
    assert(await click('^나중에$'), '나중에');
    const after = await page.evaluate(() => ({ open: !!document.querySelector('#modalRoot .modal'), at: state.schedule.find(x => x.id === 't4').handoffAt }));
    assert(!after.open && after.at === undefined && (await snap()) === b0, '나중에: ' + JSON.stringify(after));
  });

  await test('④ 📋 내 업무 ✅ 완료 보고 → 다음 공정 담당 없음이면 [💬 카톡]·[📋 복사], 보내고 나서 내 업무로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      myWorkReport('t4'); document.getElementById('mwDoneText').value = '도배 완료';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /완료 보고 저장/.test(b.textContent)).click();
      const h3 = document.querySelector('#modalRoot h3').textContent, btns = [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent);
      const info = document.getElementById('handoff').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /복사/.test(b.textContent)).click();
      const after = document.querySelector('#modalRoot h3').textContent;
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent === '나중에').click();
      return { h3, btns, info, copied: window.__copied, after, back: document.querySelector('#modalRoot h3').textContent, at: state.schedule.find(x => x.id === 't4').handoffAt };
    });
    assert(r.h3 === '🔨 다음 공정에 알리기' && JSON.stringify(r.btns) === JSON.stringify(['💬 카톡', '📋 복사', '나중에']) && /담당 미정/.test(r.info), '창: ' + JSON.stringify(r).slice(0, 300));
    assert(r.copied.length === 1 && /도배 작업이 끝났습니다/.test(r.copied[0].t) && /다음: 11\/12\(목\) 09:00 마루/.test(r.copied[0].t) && r.at === '2026-11-05', '복사: ' + JSON.stringify(r.copied));
    assert(r.after === '🔨 다음 공정에 알리기' && /^📋 내 업무/.test(r.back), '내 업무로: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== handoff-v374: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

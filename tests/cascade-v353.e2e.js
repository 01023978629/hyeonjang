/* cascade-v353.e2e.js — v353 현장 일정을 옮기면 같은 현장의 뒤 일정도 같이 옮길지 묻는다 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음(hjSendSms 는 가로챔).
   · 작업일 셈은 🗓 공정표(planAssignDates)와 같다 — 일요일만 건너뛴다(토요일은 작업일).
   · 후보: 같은 현장 · 옛 날짜보다 뒤 · 완료 보고 없음 · 💰/AS 방문/상담/실측·분할납·AS 연결 아님. 다른 현장·앞 일정은 그대로.
   · 체크한 것만 옮기고, [↩ 되돌리기] 는 같이 옮긴 것만 원래대로. 고객 안내 글은 바뀐 날짜만(자동 발송 없음).
   · 공정표 메모 '시작~끝 (N일)' 은 날짜를 따라간다(사람이 메모를 고친 저장이면 손대지 않음).
   · 날짜를 안 바꾼 저장·현장을 바꾼 저장·💰 일정·뒤 일정 없는 현장은 묻지 않는다(예전 그대로). */
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
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
    window.__sms = []; window.hjSendSms = (to, t) => { window.__sms.push({ to, t }); };
  });

  // 2026-11-02 는 월요일. 11-08 은 일요일.
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state._demo = false; state.payLog = []; state.quotes = []; state.files = []; state.notes = [];
    const P = (n) => ({ name: n, stage: 2, received: 0, phases: [], cost: {}, customer: { name: '김가상', phone: '010-0000-1111', addr: '' } });
    state.projects = [P('가상현장A'), P('가상현장B')];
    const S = (id, date, title, x) => Object.assign({ id, date, time: '09:00', title, project: '가상현장A', workers: '', memo: '', hours: 8, report: null }, x || {});
    state.schedule = [
      S('pre', '2026-11-01', '자재 발주'),                                                   // 앞 일정 — 그대로
      S('t1', '2026-11-02', '철거'),
      S('t2', '2026-11-04', '타일 (3일차 시작)', { memo: '2026-11-04~2026-11-06 (3일)' }),
      S('dn', '2026-11-05', '바닥', { report: { done: '바닥 끝', progress: '완료' } }),         // 완료 보고 — 그대로
      S('t3', '2026-11-07', '도배'),                                                         // 토 → 화
      S('t4', '2026-11-09', '마감·청소'),                                                    // 월 → 수
      S('pay', '2026-11-10', '💰 잔금 수금', { hours: 0 }),                                   // 수금 — 그대로
      S('as', '2026-11-10', '🔧 AS 방문: 가상 누수', { hours: 0, asId: 'as-1' }),               // AS — 그대로
      S('ob', '2026-11-06', '타일', { project: '가상현장B' })                                  // 다른 현장 — 그대로
    ];
    state.asLog = [{ id: 'as-1', project: '가상현장A', date: '2026-11-01', text: '가상 누수', status: 'open', visitAt: '2026-11-10', visitSchedId: 'as' }];
    window.__toasts = []; window.__sms = [];
  });
  const editDate = (id, date, fn) => page.evaluate(({ id, date, fn }) => {
    openScheduleEdit(id);
    document.getElementById('schDate').value = date;
    if (fn) (new Function(fn))();
    const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent === '저장'); b.click();
    const m = document.querySelector('#modalRoot .modal');
    return m ? { title: m.querySelector('h3').textContent, rows: [...m.querySelectorAll('.ccChk')].map(c => c.closest('label').textContent.replace(/\s+/g, ' ').trim()), foot: [...m.querySelectorAll('.mfoot button')].map(b => b.textContent) } : null;
  }, { id, date, fn: fn || '' });
  const clickFoot = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) throw new Error('버튼 없음 ' + src); b.click(); }, re);
  const dates = () => page.evaluate(() => Object.fromEntries(state.schedule.map(s => [s.id, s.date])));

  await test('① 공정 일정을 미루면 같은 현장의 뒤 일정만 후보로 묻고(💰·AS·완료·다른 현장·앞 일정 제외), 작업일로 옮긴다', async () => {
    await seed();
    const m = await editDate('t2', '2026-11-06');   // 수 → 금 = 작업일 2일
    assert(m && /뒤 일정도 같이 미룰까요/.test(m.title), '묻는 창이 안 떴다 ' + JSON.stringify(m));
    assert(m.rows.length === 2 && /도배/.test(m.rows[0]) && /11\/7\(토\) → 11\/10\(화\)/.test(m.rows[0]) && /마감·청소/.test(m.rows[1]) && /11\/9\(월\) → 11\/11\(수\)/.test(m.rows[1]), '후보 목록: ' + JSON.stringify(m.rows));
    const memo = await page.evaluate(() => state.schedule.find(s => s.id === 't2').memo);
    assert(memo === '2026-11-06~2026-11-09 (3일)', '옮긴 일정의 공정표 메모가 날짜를 안 따라갔다: ' + memo);
    await clickFoot('같이 미루기');
    const d = await dates();
    assert(JSON.stringify(d) === JSON.stringify({ pre: '2026-11-01', t1: '2026-11-02', t2: '2026-11-06', dn: '2026-11-05', t3: '2026-11-10', t4: '2026-11-11', pay: '2026-11-10', as: '2026-11-10', ob: '2026-11-06' }), '옮긴 결과: ' + JSON.stringify(d));
    const r = await page.evaluate(() => ({ title: document.querySelector('#modalRoot h3').textContent, foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent), dirty: state.dirty, visit: state.asLog[0].visitAt }));
    assert(/일정 미루기 완료/.test(r.title) && r.foot.some(t => /고객 일정 안내/.test(t)) && r.foot.some(t => /되돌리기/.test(t)), '완료 창: ' + JSON.stringify(r));
    assert(r.dirty && r.visit === '2026-11-10', '저장 표시·AS 방문일: ' + JSON.stringify(r));
    await clickFoot('고객 일정 안내');
    const sms = await page.evaluate(() => window.__sms);
    assert(sms.length === 1 && sms[0].to === '010-0000-1111', '문자 앱 열기: ' + JSON.stringify(sms));
    const t = sms[0].t;
    assert(/가상현장A 공사 일정 변경 안내/.test(t) && /김가상님/.test(t) && /· 타일: 11\/4\(수\) → 11\/6\(금\)/.test(t) && /· 도배: 11\/7\(토\) → 11\/10\(화\)/.test(t) && /· 마감·청소: 11\/9\(월\) → 11\/11\(수\)/.test(t), '안내 글: ' + t);
    assert(!/일차 시작/.test(t) && !/비|자재|사정/.test(t.replace(/불편/, '')), '안내 글에 공정표 꼬리표나 지어낸 사유: ' + t);
  });

  await test('② 체크를 뺀 일정은 그대로, [↩ 되돌리기]는 같이 옮긴 것만 원래 날짜로', async () => {
    await seed();
    await editDate('t2', '2026-11-06');
    await page.evaluate(() => { document.querySelectorAll('#modalRoot .ccChk')[1].checked = false; });
    await clickFoot('같이 미루기');
    let d = await dates();
    assert(d.t3 === '2026-11-10' && d.t4 === '2026-11-09', '체크 뺀 것까지 옮겼다 ' + JSON.stringify(d));
    await clickFoot('되돌리기');
    d = await dates();
    assert(d.t2 === '2026-11-06' && d.t3 === '2026-11-07' && d.t4 === '2026-11-09', '되돌리기: ' + JSON.stringify(d));
    const r = await page.evaluate(() => ({ open: !!document.querySelector('#modalRoot .modal'), toast: window.__toasts.join(' | ') }));
    assert(!r.open && /원래 날짜로 돌렸어요/.test(r.toast), '되돌리기 뒤: ' + JSON.stringify(r));
  });

  await test('③ [이 일정만]·당기기·묻지 않는 저장(날짜 그대로·현장 바꿈·💰 일정·뒤 일정 없음)', async () => {
    await seed();
    let m = await editDate('t2', '2026-11-06');
    await clickFoot('^이 일정만$');
    let d = await dates();
    assert(d.t3 === '2026-11-07' && d.t4 === '2026-11-09' && !(await page.evaluate(() => !!document.querySelector('#modalRoot .modal'))), '이 일정만: ' + JSON.stringify(d));

    await seed();
    m = await editDate('t3', '2026-11-06');   // 토 → 금 = 작업일 -1
    assert(m && /같이 당길까요/.test(m.title) && m.rows.length === 1 && /11\/9\(월\) → 11\/7\(토\)/.test(m.rows[0]), '당기기: ' + JSON.stringify(m));

    await seed();
    m = await editDate('t2', '2026-11-04', "document.getElementById('schMemo').value='메모만 고침';");
    assert(m === null, '날짜를 안 바꿨는데 물었다 ' + JSON.stringify(m));

    await seed();
    m = await editDate('t2', '2026-11-06', "document.getElementById('schProj').value='가상현장B';");
    assert(m === null, '현장을 바꾼 저장인데 물었다 ' + JSON.stringify(m));

    await seed();
    m = await editDate('pay', '2026-11-12');
    assert(m === null, '💰 일정인데 물었다 ' + JSON.stringify(m));

    await seed();
    m = await editDate('t4', '2026-11-12');
    assert(m === null, '뒤 일정이 없는데 물었다 ' + JSON.stringify(m));

    await seed();
    m = await editDate('t2', '2026-11-06', "document.getElementById('schMemo').value='타일 줄눈 회색으로';");
    const memo = await page.evaluate(() => state.schedule.find(s => s.id === 't2').memo);
    assert(m && memo === '타일 줄눈 회색으로', '사람이 고친 메모를 바꿨다: ' + memo);
  });

  await test('④ 작업일 셈이 공정표(planAssignDates)와 같고, 후보 고르기는 저장본을 바꾸지 않는다', async () => {
    const r = await page.evaluate(() => {
      const plan = planAssignDates([{ name: 'a', days: 3 }, { name: 'b', days: 2 }], '2026-11-06');
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      const s = state.schedule.find(x => x.id === 't2'); const c = hjCascadeCands(s, '2026-11-04');
      return {
        plan: plan.map(p => p.from + '~' + p.to),
        sh: [hjShiftWorkDays('2026-11-06', 2), hjShiftWorkDays('2026-11-09', 1), hjShiftWorkDays('2026-11-09', -1), hjShiftWorkDays('2026-11-07', 0)],
        wd: [hjWorkDaysBetween('2026-11-07', '2026-11-09'), hjWorkDaysBetween('2026-11-09', '2026-11-07'), hjWorkDaysBetween('2026-11-04', '2026-11-06'), hjWorkDaysBetween('2026-11-04', '2036-11-06'.replace('2036', '2099'))],
        n: c.length, same: snap() === b0
      };
    });
    assert(JSON.stringify(r.plan) === JSON.stringify(['2026-11-06~2026-11-09', '2026-11-10~2026-11-11']), '공정표: ' + JSON.stringify(r.plan));
    assert(r.sh[0] === '2026-11-09' && r.sh[1] === '2026-11-10' && r.sh[2] === '2026-11-07' && r.sh[3] === '2026-11-07', '작업일 옮기기: ' + JSON.stringify(r.sh));
    assert(JSON.stringify(r.wd) === JSON.stringify([1, -1, 2, 0]), '작업일 차이: ' + JSON.stringify(r.wd));
    assert(r.n === 2 && r.same, '후보 고르기: ' + JSON.stringify(r));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== cascade-v353: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

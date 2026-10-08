/* delay-v347.e2e.js — v347 공정 지연 점검 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · hjPhaseDelays: 시공(stage 2) 현장의 이틀 이상 지난 일정 가운데 완료 보고도, 그 공정 사진도, 뒤로 옮긴 같은 제목 일정도 없는 것만.
     💰·AS 방문·상담·실측은 공정이 아니다. 어제 것(1일)은 아직 지연이 아니다. 상담·완료 현장은 대상이 아니다.
   · 대시보드 '오늘의 체크' 버튼 → 지연 점검 창(완료 보고·일정 옮기기 = 기존 함수, 문자 초안은 날짜를 지어내지 않고 자동 발송 없음).
   · 화면을 그려도 저장본이 바뀌지 않는다(v345 결함 규칙). */
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
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = []; state.notes = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [P('대전', { phases: ['철거', '타일', '도배', '전기', '마감·청소'] }), P('상담중', { stage: 1 }), P('끝난곳', { stage: 3, doneAt: '2026-09-01' })];
    // 오늘을 2026-10-08 로 고정해 계산한다(hjPhaseDelays 둘째 인자). 대시보드는 실제 오늘을 쓰므로 거기서는 상대 날짜로 다시 심는다.
    const S = (title, date, project, x) => Object.assign(newSchedule(), { title, date, time: '09:00', project }, x || {});
    state.files = [{ id: 'a1', name: 'a1.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '', project: '대전', when: new Date('2026-10-05T01:00:00Z'), handle: null, _file: null, _virtual: true, text: '', ocr: 'na', _phase: '타일' }];
    state.schedule = [
      S('철거 (2일차 시작)', '2026-10-03', '대전', { report: { progress: '완료', done: '철거 끝', filledAt: '2026-10-03T09:00:00Z' } }),   // 완료 보고 → 아님
      S('타일', '2026-10-05', '대전'),                 // 사진 있음 → 아님
      S('도배', '2026-10-05', '대전'),                 // 3일 지남 · 아무 흔적 없음 → 지연
      S('전기', '2026-10-04', '대전'), S('전기', '2026-10-10', '대전'),   // 뒤로 옮겨 둠 → 아님
      S('마감·청소', '2026-10-07', '대전'),            // 어제 → 아직 아님
      S('💰 중도금', '2026-09-20', '대전'), S('AS 방문', '2026-09-25', '대전'),   // 공정 아님
      S('실측', '2026-09-20', '상담중'), S('도장', '2026-09-28', '끝난곳')      // 시공 현장 아님
    ];
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('hjPhaseDelays: 완료 보고·사진·옮긴 일정·어제·💰/AS·시공 아닌 현장은 빼고, 흔적 없는 지난 공정만 센다', async () => {
    const r = await page.evaluate(() => {
      const by = n => state.projects.find(x => x.name === n);
      const d = hjPhaseDelays(by('대전'), '2026-10-08');
      const edge = hjPhaseDelays(by('대전'), '2026-10-09');   // 하루 더 지나면 마감·청소도 이틀
      return { d: d.map(x => [x.name, x.date, x.late]), edge: edge.map(x => x.name), s1: hjPhaseDelays(by('상담중'), '2026-10-08').length, s3: hjPhaseDelays(by('끝난곳'), '2026-10-08').length };
    });
    assert(JSON.stringify(r.d) === JSON.stringify([['도배', '2026-10-05', 3]]), '지연 목록: ' + JSON.stringify(r.d));
    assert(JSON.stringify(r.edge) === JSON.stringify(['도배', '마감·청소']), '이틀 기준: ' + JSON.stringify(r.edge));
    assert(r.s1 === 0 && r.s3 === 0, '상담·완료 현장은 대상이 아니다: ' + r.s1 + '/' + r.s3);
  });

  await test('대시보드 알림 → 지연 점검 창: 완료 보고·일정 옮기기는 기존 함수, 문자 초안은 날짜를 짓지 않고 자동 발송 없음', async () => {
    const r = await page.evaluate(async () => {
      // 대시보드는 실제 오늘을 쓴다 — 도배 일정을 '오늘-3일' 로 옮겨 심는다
      const d = new Date(); d.setDate(d.getDate() - 3); const ymd = localDate(d);
      const dob = state.schedule.find(s => s.title === '도배'); dob.date = ymd;
      state.schedule.find(s => s.title === '타일').date = ymd; state.schedule.filter(s => s.title === '전기').forEach((s, i) => { const e = new Date(); e.setDate(e.getDate() + (i ? 2 : -4)); s.date = localDate(e); });
      const m = new Date(); m.setDate(m.getDate() - 1); state.schedule.find(s => s.title === '마감·청소').date = localDate(m);
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      const chk = hjDailyBrief().checks.find(c => c.ic === '🕒');
      const btns = [...document.querySelectorAll('[data-delayquick]')].map(x => ({ t: x.textContent, h: x.getBoundingClientRect().height }));
      window.__calls = []; const oReport = window.myWorkReport, oEdit = window.openScheduleEdit, oSms = window.hjSendSms;
      window.myWorkReport = id => { __calls.push(['report', String(id)]); }; window.openScheduleEdit = id => { __calls.push(['edit', String(id)]); };
      window.hjSendSms = (tel, text) => { __calls.push(['sms', tel, text]); };
      // 앱 서버(릴레이·고객 페이지·전자계약) 요청만 센다 — 병렬 실행에서는 부팅이 늦게 쏘는 글꼴·GIS 미리읽기가 섞여 거짓 실패가 난다(v346 검사에서 1회 관찰)
      let fetches = 0; const of = window.fetch; window.fetch = (...a) => { if (/script\.google|workers\.dev|\/portal\/|\/relay|127\.0\.0\.1:8398/.test(String(a[0]))) fetches++; return of(...a); };
      document.querySelector('[data-delayquick="대전"]').click(); await new Promise(r => setTimeout(r, 100));
      const root = document.getElementById('modalRoot');
      const title = root.querySelector('.modal h3').textContent, rows = [...root.querySelectorAll('.dlReport')].length;
      root.querySelector('.dlReport').click(); root.querySelector('.dlMove').click();
      [...root.querySelectorAll('.mfoot button')].find(b => /일정 안내 문자/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 50));
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      closeModal();
      window.myWorkReport = oReport; window.openScheduleEdit = oEdit; window.hjSendSms = oSms; window.fetch = of;
      return { chk, btns, title, rows, calls: __calls, fetches, wide, dobId: String(dob.id) };
    });
    assert(r.chk && /공정 1개/.test(r.chk.t) && /대전\(도배 3일\)/.test(r.chk.t), '알림 글: ' + JSON.stringify(r.chk));
    assert(r.btns.length === 1 && r.btns[0].t === '🕒 대전' && r.btns[0].h >= 44, '버튼: ' + JSON.stringify(r.btns));
    assert(/공정 지연 점검 — 대전/.test(r.title) && r.rows === 1, '창: ' + r.title + ' / ' + r.rows);
    assert(JSON.stringify(r.calls.slice(0, 2)) === JSON.stringify([['report', r.dobId], ['edit', r.dobId]]), '기존 함수로 잇는다: ' + JSON.stringify(r.calls));
    const sms = r.calls[2];
    assert(sms && sms[0] === 'sms' && sms[1] === '010-1111-2222' && /도배 작업이 예정보다 늦어지고/.test(sms[2]) && /조정된 날짜: \(여기에 적어 주세요\)/.test(sms[2]) && !/2026-/.test(sms[2]), '문자 초안: ' + JSON.stringify(sms));
    assert(r.fetches === 0, '서버 요청 없음: ' + r.fetches);
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('화면을 그리고 창을 열어도 저장본이 바뀌지 않는다(최상위 키 41개)', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const before = snap();
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 120));
      hjDailyBrief(); state.projects.forEach(p => hjPhaseDelays(p));
      hjDelayView('대전'); await new Promise(r => setTimeout(r, 60)); closeModal();
      hjDelayView('끝난곳'); await new Promise(r => setTimeout(r, 60)); const emptyTxt = document.getElementById('modalRoot').textContent; closeModal();
      return { same: before === snap(), keys: Object.keys(serializeData()).length, emptyTxt };
    });
    assert(r.same, '읽기 경로가 저장본을 바꿨다');
    assert(r.keys === 41, '최상위 키: ' + r.keys);
    assert(/지연 의심 공정이 없습니다/.test(r.emptyTxt), '빈 화면 문구: ' + r.emptyTxt.slice(0, 120));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== delay-v347: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

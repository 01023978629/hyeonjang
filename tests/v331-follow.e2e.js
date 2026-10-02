/* v331-follow.e2e.js — v330 이 남긴 것 중 일정·AI 두 가지 (Playwright)

   ① AS 에서 올린 방문 일정(AS 기록의 visitSchedId)의 날짜를 일정 화면(saveScheduleEdit)에서 바꾸면 AS 방문일(visitAt)도
      따라간다. 예전엔 반대 방향(AS 화면 → 일정)만 옮겨, 일정표에서 날짜를 바꾸면 AS 관리·보증 화면의 방문일이 옛 날짜로 남았다.
      날짜를 안 바꾼 저장(메모만)은 AS 를 건드리지 않고, 연결되지 않은 AS 는 그대로다.
   ② AI 도구 set_labor 의 결과는 '이달 현장 합계' 가 아니라 인건비 장부 [지출 반영]이 실제로 넣는 값 — 그 현장 전체 기간 일당
      합계(laborProjectTotal) — 를 보고한다(v330 부터 반영은 전체 기간). 한 줄 요약(aiResultBrief)도 같은 값을 말한다.
   가짜 자료만 쓴다. 판정은 종료코드.
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone);
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]).catch(() => {}));
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    try { aiOpsEnsureState().enabled = false; } catch (e) {}
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const clickFoot = async (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => new RegExp(src).test(x.textContent)); if (!b) throw new Error('버튼 없음 ' + src); b.click(); }, re);
  const P = '가상AS현장';
  const seed = () => page.evaluate((P) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: P, stage: 3, received: 0, phases: [], cost: {} }];
    state.files = []; state.quotes = []; state.payLog = [];
    state.asLog = [
      { id: 'as-1', project: P, date: '2026-09-10', text: '가상 욕실 누수', status: 'doing', visitAt: '2026-09-30', visitSchedId: 'sc-1' },
      { id: 'as-2', project: P, date: '2026-09-11', text: '가상 다른 AS', status: 'open', visitAt: '2026-09-30' }   // 일정 연결 없음
    ];
    state.schedule = [{ id: 'sc-1', date: '2026-09-30', time: '', title: '🔧 AS 방문: 가상 욕실 누수', project: P, asId: 'as-1', hours: 0, memo: '' }];
    window.__toasts = [];
  }, P);
  const editSched = async (fn) => {
    await page.evaluate(() => openScheduleEdit('sc-1'));
    await page.waitForSelector('#modalRoot #schDate');
    await page.evaluate(fn);
    await clickFoot('^저장$');
    await page.waitForFunction(() => !document.querySelector('#modalRoot #schDate'));
  };

  await test('① 일정 화면에서 AS 방문 일정 날짜를 바꾸면 AS 방문일도 따라간다(연결 안 된 AS 는 그대로)', async () => {
    await seed();
    await editSched(() => { document.getElementById('schDate').value = '2026-10-02'; });
    const r = await page.evaluate(() => ({ as: state.asLog.map(a => [a.id, a.visitAt]), sch: state.schedule.map(s => s.date), toast: window.__toasts.join(' ') }));
    assert(JSON.stringify(r.sch) === JSON.stringify(['2026-10-02']), '일정 날짜가 안 바뀌었다 ' + JSON.stringify(r));
    assert(JSON.stringify(r.as) === JSON.stringify([['as-1', '2026-10-02'], ['as-2', '2026-09-30']]), 'AS 방문일이 일정을 따라가지 않았거나 남의 AS 를 바꿨다 ' + JSON.stringify(r));
    assert(/AS 방문일도 2026-10-02/.test(r.toast), '무엇을 같이 바꿨는지 알리지 않았다 ' + r.toast);
  });

  await test('① 날짜를 안 바꾼 저장(메모만)은 AS 를 건드리지 않는다', async () => {
    await seed();
    await page.evaluate(() => { state.asLog[0].visitAt = '2026-09-29'; });   // 이미 어긋나 있던 옛 자료
    await editSched(() => { document.getElementById('schMemo').value = '가상 메모만'; });
    const r = await page.evaluate(() => ({ as: state.asLog[0].visitAt, memo: state.schedule[0].memo, toast: window.__toasts.join(' ') }));
    assert(r.memo === '가상 메모만' && r.as === '2026-09-29' && !/AS 방문일/.test(r.toast), '메모만 고쳤는데 AS 를 바꿨다 ' + JSON.stringify(r));
  });

  await test('① 반대 방향(AS 화면 → 일정)은 예전 그대로', async () => {
    await seed();
    await page.evaluate(() => asManage());
    await page.waitForSelector('#modalRoot [data-k="visitAt"][data-id="as-1"]', { state: 'attached' });
    await page.evaluate(() => { const el = document.querySelector('#modalRoot [data-k="visitAt"][data-id="as-1"]'); el.value = '2026-10-05'; el.dispatchEvent(new Event('change')); });
    await page.waitForFunction(() => state.schedule[0].date === '2026-10-05');
    await page.evaluate(() => { try { closeModal(true); } catch (e) {} });
  });

  await test('② set_labor 는 현장 전체 기간 일당 합계(지출 반영이 넣는 값)를 보고한다', async () => {
    const r = await page.evaluate((P) => {
      state.projects = [{ name: P, stage: 2, received: 0, phases: [], cost: {} }];
      state.schedule = [
        { id: 'l-aug', date: '2026-08-20', time: '', title: '철거', project: P, labor: { amount: 200000 } },
        { id: 'l-sep', date: '2026-09-20', time: '', title: '타일', project: P }
      ];
      return aiToolRun('set_labor', { date: '2026-09-20', amount: 300000, project: P }).then(out => ({ out, total: laborProjectTotal(P).total, brief: aiResultBrief('set_labor', out) }));
    }, P);
    assert(r.total === 500000, '전제: 전체 기간 합계 50만 원 ' + JSON.stringify(r));
    assert(r.out.현장전체일당합계원 === 500000 && !('이달현장합계원' in r.out), '이달 합계가 아니라 전체 기간 합계를 보고해야 한다 ' + JSON.stringify(r.out));
    assert(/전체 기간/.test(r.out.메모), '메모가 반영 범위를 말하지 않는다 ' + r.out.메모);
    assert(/300,000/.test(r.brief) && /현장 전체 기간 500,000/.test(r.brief), '한 줄 요약이 전체 기간 합계를 말하지 않는다 ' + r.brief);
  });

  await test('★ pageerror 0', async () => { assert(errors.length === 0, 'pageerror: ' + errors.join(' | ')); });
  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });

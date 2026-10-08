/* extraprogress-v346.e2e.js — v346 공정 진행률·추가공사 미청구 경고 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   다른 회사 앱 비교(Houzz Pro 단계별 진행률 · 추가공사 미청구 경고)에서 이 앱에 없던 것.
   · 공정 진행률(hjPhaseProgress)은 사진 공정 표시와 일정 완료 보고에서만 읽는다 — 날짜가 지났다고 완료로 치지 않는다.
   · 고객 페이지 '시공' 메모·진행 보고 문안·브리핑이 같은 글을 쓰고, 공정 표시가 바뀌면 고객 페이지가 '갱신 필요'가 된다.
   · 시공·완료 현장에 '확인 전·금액 협의' 추가공사가 남으면 대시보드 알림 + 버튼(추가공사 창), 준공 전 체크에 줄이 생긴다.
   · 저장 구조는 그대로(최상위 키 41개). */
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
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = []; state.schedule = []; state.notes = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [
      P('대전', { phases: ['철거', '타일', '도배', '마감·청소'], extras: [{ id: 'x1', text: '문틀 교체' }, { id: 'x2', text: '선반 설치', amount: '300000', agreed: true }] }),
      P('한신교회', { stage: 1, extras: [{ id: 'y1', text: '콘센트 추가' }] }),   // 실측 단계 — 아직 시공 전이라 경고 대상이 아니다
      P('둔산', { stage: 3, extras: [{ id: 'z1', text: '욕실 환풍기', amount: '15만' }] })   // 완료 현장 · 금액 확인 필요
    ];
    const ph = (id, phase, when) => ({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '', project: '대전', when: new Date(when), handle: null, _file: null, _virtual: true, text: '', ocr: 'na', _phase: phase });
    state.files = [ph('a1', '철거', '2026-10-01T01:00:00Z'), ph('a2', '타일', '2026-10-05T01:00:00Z')];
    state.schedule = [
      Object.assign(newSchedule(), { title: '도배 (2일차 시작)', date: '2026-10-07', time: '09:00', project: '대전', report: { progress: '완료', done: '도배 마감', filledAt: '2026-10-07T09:00:00Z' } }),
      Object.assign(newSchedule(), { title: '마감·청소', date: '2026-12-01', time: '09:00', project: '대전' })
    ];
    try { closeModal(); } catch (e) {}
    render();
  });

  await test('공정 진행률: 사진 공정·완료 보고에서만 읽고, 고객 페이지 메모·진행 보고 문안·브리핑이 같은 값을 말한다', async () => {
    const r = await page.evaluate(() => {
      const p = state.projects.find(x => x.name === '대전');
      const pr = hjPhaseProgress(p);
      const d = portalBuild('대전');
      const txt = customerProgressText(customerProgressData('대전'));
      const brief = hjDailyBrief().doing.find(x => x.name === '대전');
      // 공정 목록이 비어 있으면 🗓 공정표 일정 제목에서 — 💰·상담·실측·AS 는 공정이 아니다
      const q = { name: '임시', stage: 2, phases: [] };
      state.schedule.push(Object.assign(newSchedule(), { title: '💰 잔금', date: '2026-10-09', project: '임시' }), Object.assign(newSchedule(), { title: '철거 (2일차 시작)', date: '2026-10-02', project: '임시' }), Object.assign(newSchedule(), { title: '실측', date: '2026-09-20', project: '임시' }));
      const fromSch = hjPhaseNames(q);
      state.schedule = state.schedule.filter(s => s.project !== '임시');
      // 날짜만 지난 공정은 완료가 아니다
      state.schedule.push(Object.assign(newSchedule(), { title: '타일', date: '2026-01-01', project: '대전' }));
      const pr2 = hjPhaseProgress(p);
      state.schedule.pop();
      return { pr, memo: d.steps[2].memo, txt, brief: brief && brief.prog, fromSch, pr2done: pr2.done };
    });
    assert(JSON.stringify(r.pr.done) === JSON.stringify(['철거', '도배']) && JSON.stringify(r.pr.doing) === JSON.stringify(['타일']) && JSON.stringify(r.pr.todo) === JSON.stringify(['마감·청소']) && r.pr.pct === 50, '진행률: ' + JSON.stringify(r.pr));
    assert(r.memo === '진행 중 · 공정 4개 중 2개 완료 (철거·도배) · 진행 중: 타일 · 다음: 마감·청소', '고객 페이지 메모: ' + r.memo);
    assert(/공정 4개 중 2개 완료 \(철거·도배\) · 진행 중: 타일 · 다음: 마감·청소/.test(r.txt), '진행 보고 문안: ' + r.txt);
    assert(r.brief === '2/4', '브리핑 진행 현장 칩: ' + r.brief);
    assert(JSON.stringify(r.fromSch) === JSON.stringify(['철거']), '공정표 일정에서 읽은 공정 목록: ' + JSON.stringify(r.fromSch));
    assert(JSON.stringify(r.pr2done) === JSON.stringify(['철거', '도배']), '날짜만 지난 공정을 완료로 치면 안 된다: ' + JSON.stringify(r.pr2done));
  });

  await test('공정 표시가 바뀌면 고객 페이지가 갱신 필요가 되고, 자동 갱신 후보로 잡힌다(서버 요청은 설정 없이는 없음)', async () => {
    const r = await page.evaluate(async () => {
      const p = state.projects.find(x => x.name === '대전');
      p.portalUrl = 'https://example.invalid/p/x'; p.portalSig = portalSig('대전');
      const stale0 = portalStaleList().map(x => x.name);
      let fetches = 0; const of = window.fetch; window.fetch = (...a) => { fetches++; return of(...a); };
      await setPhase('a2', '마감·청소');   // 타일 사진을 마감 공정으로 — 진행률이 바뀐다
      await new Promise(r => setTimeout(r, 120));
      const stale1 = portalStaleList().map(x => x.name);
      const memo = portalBuild('대전').steps[2].memo;
      await setPhase('a2', '타일');
      await new Promise(r => setTimeout(r, 120));
      window.fetch = of; delete p.portalUrl; delete p.portalSig;
      return { stale0, stale1, memo, fetches, keys: Object.keys(serializeData()).length };
    });
    assert(r.stale0.length === 0 && JSON.stringify(r.stale1) === JSON.stringify(['대전']), '갱신 필요 목록: ' + JSON.stringify([r.stale0, r.stale1]));
    // 타일 사진이 사라졌으니 타일은 다시 '예정'이다 — 사진이 없는 공정을 완료로 지어내지 않는다
    assert(r.memo === '진행 중 · 공정 4개 중 2개 완료 (철거·도배) · 진행 중: 마감·청소 · 다음: 타일', '바뀐 메모: ' + r.memo);
    assert(r.fetches === 0, '서버 설정이 없으면 요청하지 않는다: ' + r.fetches);
    assert(r.keys === 41, '최상위 저장 키 41개 그대로: ' + r.keys);
  });

  await test('추가공사 미청구 경고: 시공·완료 현장만, 버튼이 그 현장 추가공사 창을 열고, 준공 전 체크 줄에 상태가 보인다', async () => {
    const r = await page.evaluate(async () => {
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      const b = hjDailyBrief();
      const chk = b.checks.find(c => c.ic === '🖊');
      const btns = [...document.querySelectorAll('[data-extraquick]')].map(x => ({ t: x.textContent, h: x.getBoundingClientRect().height, p: x.dataset.extraquick }));
      const el = document.querySelector('[data-extraquick="둔산"]'); el.click(); await new Promise(r => setTimeout(r, 100));
      const title = document.querySelector('#modalRoot .modal h3').textContent;
      const sel = (document.getElementById('exProj') || {}).value;
      closeModal();
      const p = state.projects.find(x => x.name === '대전');
      const row = stageChecklistItems(p, 3).find(it => it[1] === 'extra');
      const order = stageChecklistItems(p, 3).map(it => it[1]).slice(0, 3);
      const none = stageChecklistItems({ name: '빈', stage: 2 }, 3).find(it => it[1] === 'extra');
      const go = STAGE_CHECK_GO.extra ? STAGE_CHECK_GO.extra.l : '';
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { chk, btns, title, sel, row, order, none, go, wide };
    });
    assert(r.chk && /추가공사 2건이 남은 현장 2곳/.test(r.chk.t) && /대전/.test(r.chk.t) && /둔산/.test(r.chk.t) && !/한신교회/.test(r.chk.t), '알림 글: ' + JSON.stringify(r.chk));
    assert(r.btns.length === 2 && r.btns.every(x => x.h >= 44) && r.btns.map(x => x.p).join() === '대전,둔산', '버튼: ' + JSON.stringify(r.btns));
    assert(/추가공사 확인 — 둔산/.test(r.title) && r.sel === '둔산', '열린 창: ' + r.title + ' / ' + r.sel);
    assert(r.row && /확인받음 1건 300,000원 청구서에 더해짐/.test(r.row[2]) && /금액 협의 1건/.test(r.row[2]), '준공 전 체크 줄: ' + JSON.stringify(r.row));
    assert(JSON.stringify(r.order) === JSON.stringify(['punch', 'extra', 'balance']), '줄 순서(점검표 → 추가공사 → 잔금 청구): ' + JSON.stringify(r.order));
    assert(r.none && r.none[2] === '적어 둔 추가공사 없음', '추가공사 없는 현장: ' + JSON.stringify(r.none));
    assert(r.go === '🖊 추가공사', 'GO 버튼: ' + r.go);
    assert(r.wide <= 0, '390px 에서 가로 넘침: ' + r.wide);
  });

  await test('화면을 그리는 읽기 경로가 저장본을 바꾸지 않는다 — 유상 저장 뒤 저장본==현재 상태 검사(v345 punch:[] 결함 회귀)', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '빈현장', stage: 2, received: 0, phases: ['철거'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } },
        { name: '완료현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, doneAt: '2026-09-01' }];
      state.files = []; state.schedule = []; state.payLog = []; state.expenses = []; state.quotes = []; state.notes = [];
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };   // 저장 시각만 빼고 전부
      const before = snap();
      // 읽기만 하는 경로 전부 — 대시보드(오늘의 체크·현장 보드)·준공 체크 줄·점검표 문안·진행 보고 문안·고객 페이지
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      hjDailyBrief(); projHealthBoard();
      state.projects.forEach(p => { stageChecklistItems(p, 3); stageChecklistItems(p, 2); hjPunchOpen(p); hjPunchText(p); hjPhaseProgress(p); hjExtrasBill(p); customerProgressText(customerProgressData(p.name)); portalBuild(p.name); portalSig(p.name); });
      const after = snap();
      const keys = state.projects.map(p => Object.keys(p).filter(k => ['punch', 'extras', 'measure', 'siteRules', 'checklists'].includes(k)));
      // 쓰기 경로(점검표 화면에서 항목 넣기)는 그대로 배열을 만든다
      punchListView('빈현장'); await new Promise(r => setTimeout(r, 80));
      document.querySelectorAll('.plArea').forEach(c => { if (c.value === '거실') c.checked = true; }); document.getElementById('plSeed').click(); await new Promise(r => setTimeout(r, 80));
      const seeded = (state.projects[0].punch || []).length; closeModal();
      return { same: before === after, keys, seeded };
    });
    assert(r.same, '그리기만 했는데 저장본이 바뀌었다 — 유상 저장 뒤 "paid exact live state conflict" 가 난다');
    assert(JSON.stringify(r.keys) === '[[],[]]', '읽기 경로가 현장 객체에 빈 배열을 붙였다: ' + JSON.stringify(r.keys));
    assert(r.seeded > 0, '점검표 화면의 쓰기 경로는 항목을 넣어야 한다: ' + r.seeded);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== extraprogress-v346: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

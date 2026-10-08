/* board-v351.e2e.js — v351 현장 보드에 공정 지연·추가공사 미청구·증빙 미기록·보수 필요 축 + 더보기 🕒 공정 지연 점검 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.
   · v345~v348 신호가 '오늘의 체크' 줄에만 있어 보드 순위에 안 잡혔다 — 원 함수(hjPhaseDelays·hjExtrasBill·hjProofPending·hjPunchOpen) 결과를
     그대로 축으로 쓴다(임계값 재계산 없음, 드리프트 검사). 배지는 그 현장 화면을 연다(openAction + data-boardarg).
   · 긴급: 지연 7일+, 증빙 미기록 5일+(현금영수증 발행 기한). 추가공사·보수는 주의.
   · 더보기 [🕒 공정 지연 점검](delaycheck → hjDelayPick): 지연 현장이 하나면 바로, 여럿이면 고르기, 없으면 빈 상태 창. 메뉴 계약 121 → 122.
   · 읽기 경로는 저장본을 바꾸지 않는다(v345 규칙). */
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
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

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

  await page.evaluate(({ d9, d3, d6, d1 }) => {
    state._demo = false; state.payLog = []; state.expenses = []; state.quotes = []; state.schedule = []; state.notes = []; state.asLog = [];
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    const P = (n, x) => Object.assign({ name: n, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-1111-2222', addr: '' } }, x || {});
    state.projects = [
      P('지연현장', { phases: ['철거', '타일'] }),                                   // 타일 일정 9일 지남, 사진·보고 없음 → 긴급
      P('추가공사현장', { extras: [{ id: 'x1', text: '문틀 교체' }] }),              // 확인 전 1건 → 주의
      P('증빙현장'),                                                                // 입금 6일 전·증빙 없음 → 긴급
      P('보수현장', { punch: [{ id: 'p1', area: '거실', text: '벽지 들뜸', status: 'fix' }, { id: 'p2', area: '거실', text: '몰딩', status: 'ok' }] }),
      P('깨끗한현장'),
      P('상담현장', { stage: 1, extras: [{ id: 'y1', text: '콘센트' }] }),          // 실측 단계 — 추가공사 축 대상 아님
      P('보관현장', { archived: true, punch: [{ id: 'q1', area: '거실', text: 'x', status: 'fix' }] })
    ];
    state.schedule = [
      Object.assign(newSchedule(), { title: '타일', date: d9, time: '09:00', project: '지연현장' }),
      Object.assign(newSchedule(), { title: '철거', date: d3, time: '09:00', project: '지연현장', report: { progress: '완료', done: '철거 끝' } }),
      Object.assign(newSchedule(), { title: '도배', date: d1, time: '09:00', project: '깨끗한현장' })   // 어제 — 지연 아님
    ];
    state.payLog = [{ d: d6, project: '증빙현장', amt: 1500000 }, { d: d6, project: '깨끗한현장', amt: 50000 }];   // 5만원은 증빙 대상 아님
    // 기존 여섯 축(마진·예산·보증·방치·리뷰·AS)은 이 검사의 대상이 아니다 — 비워서 새 네 축만 등급에 남긴다(방치 축이 빈 시드 현장을 전부 긴급으로 만든다)
    ['lossAlertData', 'budgetAlertData', 'boardWarrantyRows', 'staleProjectData', 'reviewRequestData', 'asOpenData'].forEach(fn => { window[fn] = () => []; });
    try { closeModal(); } catch (e) {}
    render();
  }, { d9: ago(9), d3: ago(3), d6: ago(6), d1: ago(1) });

  await test('보드 축 네 개 — 원 함수 결과와 같은 현장 집합(드리프트 없음), 라벨·긴급 판정, 보관·상담 현장 제외', async () => {
    const r = await page.evaluate(() => {
      const b = projHealthBoard();
      const axis = a => b.rows.filter(x => x.reasons.some(rr => rr.axis === a)).map(x => x.name).sort();
      const today = localDate();
      const src = {
        delay: state.projects.filter(p => !p.archived && hjPhaseDelays(p, today).length).map(p => p.name).sort(),
        extra: state.projects.filter(p => !p.archived && (p.stage || 0) >= 2 && hjExtrasBill(p).pending.length).map(p => p.name).sort(),
        proof: [...new Set(hjProofPending(today).map(x => x.project))].sort(),
        punch: state.projects.filter(p => !p.archived && (p.stage || 0) >= 2 && hjPunchOpen(p) > 0).map(p => p.name).sort()
      };
      const reason = (n, a) => { const row = b.rows.find(x => x.name === n); return row && row.reasons.find(rr => rr.axis === a); };
      return { axis: { delay: axis('delay'), extra: axis('extra'), proof: axis('proof'), punch: axis('punch') }, src,
        dl: reason('지연현장', 'delay'), ex: reason('추가공사현장', 'extra'), pf: reason('증빙현장', 'proof'), pu: reason('보수현장', 'punch'),
        levels: Object.fromEntries(b.rows.map(x => [x.name, x.level])), names: b.rows.map(x => x.name) };
    });
    assert(JSON.stringify(r.axis) === JSON.stringify(r.src), '축 집합 = 원 함수 결과: ' + JSON.stringify([r.axis, r.src]));
    assert(JSON.stringify(r.axis.delay) === '["지연현장"]' && JSON.stringify(r.axis.extra) === '["추가공사현장"]' && JSON.stringify(r.axis.proof) === '["증빙현장"]' && JSON.stringify(r.axis.punch) === '["보수현장"]', '축별 현장: ' + JSON.stringify(r.axis));
    assert(r.dl && /공정 지연 1개 · 9일/.test(r.dl.label) && r.dl.urgent === true && r.dl.openAction === 'hjDelayPick' && r.dl.arg === '지연현장', '지연 축: ' + JSON.stringify(r.dl));
    assert(r.ex && /추가공사 확인 전 1건/.test(r.ex.label) && r.ex.urgent === false && r.ex.openAction === 'extraWork' && r.ex.arg === '추가공사현장', '추가공사 축: ' + JSON.stringify(r.ex));
    assert(r.pf && /증빙 미기록 1건 · 6일/.test(r.pf.label) && r.pf.urgent === true && r.pf.openAction === 'hjProofView', '증빙 축: ' + JSON.stringify(r.pf));
    assert(r.pu && /보수 필요 1곳/.test(r.pu.label) && r.pu.urgent === false && r.pu.openAction === 'punchListView', '보수 축: ' + JSON.stringify(r.pu));
    assert(r.levels['지연현장'] === 'urgent' && r.levels['증빙현장'] === 'urgent' && r.levels['추가공사현장'] === 'watch' && r.levels['보수현장'] === 'watch' && r.levels['깨끗한현장'] === 'ok', '등급: ' + JSON.stringify(r.levels));
    assert(!r.names.includes('보관현장'), '보관 현장은 보드에 없다: ' + JSON.stringify(r.names));
  });

  await test('배지를 누르면 그 현장 화면이 열린다(data-boardarg) — 네 함수 모두 현장 이름을 받고, 모르는 동작은 무시', async () => {
    const r = await page.evaluate(async () => {
      state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 150));
      const tg = document.querySelector('[data-boardtoggle]'); if (tg) { tg.click(); await new Promise(r => setTimeout(r, 150)); }   // 접힌 보드는 상위 3곳만 — 전체 펼치기
      const calls = [];
      const stub = {};['hjDelayPick', 'extraWork', 'hjProofView', 'punchListView'].forEach(fn => { stub[fn] = window[fn]; window[fn] = (...a) => calls.push([fn, ...a]); });
      const btns = [...document.querySelectorAll('[data-boardreason][data-boardarg]')].map(b => ({ act: b.dataset.boardreason, arg: b.dataset.boardarg, h: b.getBoundingClientRect().height }));
      for (const b of document.querySelectorAll('[data-boardreason][data-boardarg]')) { b.click(); await new Promise(r => setTimeout(r, 20)); }
      // 화이트리스트 밖 동작은 무시된다
      const fake = document.createElement('button'); fake.setAttribute('data-boardreason', 'alert'); fake.setAttribute('data-boardarg', 'x'); document.querySelector('#view').appendChild(fake); fake.click(); fake.remove();
      Object.keys(stub).forEach(fn => { window[fn] = stub[fn]; });
      // 실제로 열어 본다 — hjDelayPick('지연현장') 은 그 현장 점검창
      hjDelayPick('지연현장'); await new Promise(r => setTimeout(r, 80));
      const t1 = (document.querySelector('#modalRoot .modal h3') || {}).textContent || ''; closeModal();
      return { btns, calls, t1 };
    });
    assert(r.btns.length === 4 && r.btns.every(b => b.h >= 20), '배지 네 개: ' + JSON.stringify(r.btns));
    const want = [['hjDelayPick', '지연현장'], ['extraWork', '추가공사현장'], ['hjProofView', '증빙현장'], ['punchListView', '보수현장']];
    assert(want.every(w => r.calls.some(c => c[0] === w[0] && c[1] === w[1])) && r.calls.length === 4, '배지 → 함수(현장): ' + JSON.stringify(r.calls));
    assert(/공정 지연 점검 — 지연현장/.test(r.t1), '지연 점검창: ' + r.t1);
  });

  await test('더보기 🕒 공정 지연 점검 — 여럿이면 고르기, 하나면 바로, 없으면 빈 상태(390px·메뉴 122)', async () => {
    const r = await page.evaluate(async ({ d9 }) => {
      const n = MORE_CATS.flatMap(c => c.items).length;
      // 둘: 고르기 창
      state.schedule.push(Object.assign(newSchedule(), { title: '도장', date: d9, time: '09:00', project: '깨끗한현장' }));
      moreActionHandler('delaycheck'); await new Promise(r => setTimeout(r, 80));
      const pick = { title: document.querySelector('#modalRoot .modal h3').textContent, rows: [...document.querySelectorAll('#modalRoot .dpPick')].map(b => [b.dataset.pj, b.getBoundingClientRect().height]) };
      document.querySelector('#modalRoot .dpPick').click(); await new Promise(r => setTimeout(r, 80));
      const opened = document.querySelector('#modalRoot .modal h3').textContent; closeModal();
      state.schedule.pop();
      // 하나: 바로 그 현장
      hjDelayPick(); await new Promise(r => setTimeout(r, 80));
      const one = document.querySelector('#modalRoot .modal h3').textContent; closeModal();
      // 없음: 빈 상태 창
      const keep = state.schedule; state.schedule = [];
      hjDelayPick(); await new Promise(r => setTimeout(r, 80));
      const none = { title: document.querySelector('#modalRoot .modal h3').textContent, empty: !!document.querySelector('#modalRoot .empty') }; closeModal();
      state.schedule = keep;
      const wide = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return { n, pick, opened, one, none, wide };
    }, { d9: ago(9) });
    assert(r.n === 122, '더보기 메뉴 수: ' + r.n);
    assert(/공정 지연 점검$/.test(r.pick.title) && r.pick.rows.length === 2 && r.pick.rows[0][0] === '지연현장' && r.pick.rows.every(x => x[1] >= 44), '고르기 창: ' + JSON.stringify(r.pick));
    assert(/공정 지연 점검 — 지연현장/.test(r.opened) && /공정 지연 점검 — 지연현장/.test(r.one), '바로 열기: ' + r.opened + ' / ' + r.one);
    assert(/공정 지연 점검/.test(r.none.title) && r.none.empty, '빈 상태: ' + JSON.stringify(r.none));
    assert(r.wide <= 0, '390px 가로 넘침: ' + r.wide);
  });

  await test('보드를 그리는 읽기 경로는 저장본을 바꾸지 않는다(현장 객체에 punch/extras 빈 배열 없음)', async () => {
    const r = await page.evaluate(async () => {
      const snap = () => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); };
      const b0 = snap();
      projHealthBoard(); hjHealthBoardHTML(t => t); state.tab = 'dashboard'; render(); await new Promise(r => setTimeout(r, 120)); hjDelayPick(); closeModal();
      return { same: snap() === b0, keys: state.projects.find(p => p.name === '깨끗한현장') ? Object.keys(state.projects.find(p => p.name === '깨끗한현장')).filter(k => ['punch', 'extras'].includes(k)) : null };
    });
    assert(r.same, '그리기만 했는데 저장본이 바뀌었다');
    assert(JSON.stringify(r.keys) === '[]', '빈 배열이 붙었다: ' + JSON.stringify(r.keys));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== board-v351: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

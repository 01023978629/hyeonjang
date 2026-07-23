/* health-board.e2e.js — 🏥 현장 보드(다현장 종합 위험도 랭킹) 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   순수·읽기전용 파생(projHealthBoard). state 미변형·markDirty 미유발·직렬화 스키마 불변 검증.
   실발신/네트워크 없음 — 전화 원문은 화면·리포트에 노출하지 않는다(뒷4자리 마스킹 정책 준수). */
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
const KNOWN_ACTIONS = ['lossAlert', 'budgetAlert', 'warrantyManage', 'dueAgingView', 'staleProjects', 'reviewRequest'];

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // ── 고정 fixture: 적자·예산120%초과·미수95일·보증임박·방치20일·정상·리뷰(완공30일) 7현장 ──
  //   날짜는 실행일 기준 상대(결정성). est는 견적 파일로, 예산초과는 지출장부(자재) 태깅으로 주입.
  async function seed() {
    await page.evaluate(() => {
      const DAY = 86400000;
      const d = (back) => localDate(new Date(Date.now() - back * DAY));
      const whenBack = (back) => new Date(Date.now() - back * DAY);
      state.projects = [
        { name: '적자현장A', stage: 2, received: 0, phases: [], cost: { material: 12000000, labor: 0, outsource: 0 }, customer: { name: '가', phone: '', addr: '' }, archived: false },
        { name: '예산현장B', stage: 2, received: 30000000, budget: 10000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '나', phone: '', addr: '' }, archived: false },
        { name: '미수현장C', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, doneAt: d(95), customer: { name: '다', phone: '', addr: '' }, archived: false },
        { name: '보증현장D', stage: 3, received: 5000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, doneAt: d(343), customer: { name: '라', phone: '', addr: '' }, archived: false },
        { name: '방치현장E', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '마', phone: '', addr: '' }, archived: false },
        { name: '정상현장F', stage: 2, received: 10000000, phases: [], cost: { material: 1000000, labor: 0, outsource: 0 }, customer: { name: '바', phone: '', addr: '' }, archived: false },
        { name: '리뷰현장G', stage: 3, received: 5000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, doneAt: d(30), customer: { name: '사', phone: '01000000000', addr: '' }, archived: false }
      ];
      state.expenses = [{ project: '예산현장B', category: '자재', amount: 12000000, date: d(2) }];
      state.notes = [{ id: 'n1', date: d(1), project: '', text: '메모 테스트' }];
      state.files = [
        { id: 'estA', kind: 'estimate', project: '적자현장A', name: 'A견적', est: { amount: 10000000 }, when: whenBack(1) },
        { id: 'phA', kind: 'photo', project: '적자현장A', name: 'A사진', when: whenBack(0) },
        { id: 'estB', kind: 'estimate', project: '예산현장B', name: 'B견적', est: { amount: 30000000 }, when: whenBack(1) },
        { id: 'phB', kind: 'photo', project: '예산현장B', name: 'B사진', when: whenBack(0) },
        { id: 'estC', kind: 'estimate', project: '미수현장C', name: 'C견적', est: { amount: 5000000 }, when: whenBack(96) },
        { id: 'estD', kind: 'estimate', project: '보증현장D', name: 'D견적', est: { amount: 5000000 }, when: whenBack(343) },
        { id: 'phE', kind: 'photo', project: '방치현장E', name: 'E사진', when: whenBack(20) },
        { id: 'estF', kind: 'estimate', project: '정상현장F', name: 'F견적', est: { amount: 10000000 }, when: whenBack(1) },
        { id: 'phF', kind: 'photo', project: '정상현장F', name: 'F사진', when: whenBack(0) },
        { id: 'estG', kind: 'estimate', project: '리뷰현장G', name: 'G견적', est: { amount: 5000000 }, when: whenBack(30) }
      ];
      state.activeProject = null; state.tab = 'dashboard';
      if (typeof __boardOpen !== 'undefined') { window.__boardOpen = false; }
      render();
    });
    await page.waitForTimeout(150);
  }

  // 1) 점수·등급·정렬 결정성
  await test('결정성 — 등급·counts·정렬(level rank desc → score desc)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const b = projHealthBoard();
      const lvl = {}; const sc = {}; b.rows.forEach(x => { lvl[x.name] = x.level; sc[x.name] = x.score; });
      return { counts: b.counts, order: b.rows.map(x => x.name), levels: lvl, scores: sc,
        ranks: b.rows.map(x => ({ level: x.level, score: x.score })) };
    });
    assert(r.counts.urgent === 3 && r.counts.watch === 3 && r.counts.ok === 1, 'counts=3/3/1: ' + JSON.stringify(r.counts));
    const exp = { '적자현장A': 'urgent', '예산현장B': 'urgent', '미수현장C': 'urgent', '보증현장D': 'watch', '방치현장E': 'watch', '리뷰현장G': 'watch', '정상현장F': 'ok' };
    Object.keys(exp).forEach(n => assert(r.levels[n] === exp[n], n + ' level=' + exp[n] + ' (got ' + r.levels[n] + ')'));
    // 정렬 불변식: rank 비오름차순, 동일 rank 내 score 비오름차순
    const RANK = { urgent: 3, watch: 2, ok: 1 };
    for (let i = 1; i < r.ranks.length; i++) {
      const a = r.ranks[i - 1], c = r.ranks[i];
      assert(RANK[a.level] > RANK[c.level] || (RANK[a.level] === RANK[c.level] && a.score >= c.score), '정렬 불변식 위반 @' + i + ': ' + JSON.stringify([a, c]));
    }
    assert(r.order[0] === '적자현장A', '최상위=적자현장A(220): ' + r.order[0]);
    assert(r.order[6] === '정상현장F', '최하위=정상현장F(ok): ' + r.order[6]);
    assert(r.scores['적자현장A'] > r.scores['미수현장C'] && r.scores['미수현장C'] > r.scores['예산현장B'], 'urgent 내 점수 A>C>B');
  });

  // 2) 임계값 drift 방지 — 원 함수 결과와 board.reasons 축 집합 교차검증
  await test('drift 방지 — 원 함수(loss/budget/due/warranty/stale) 결과 = board.reasons 축', async () => {
    const r = await page.evaluate(() => {
      const b = projHealthBoard();
      const axisSet = (axis) => b.rows.filter(x => x.reasons.some(rr => rr.axis === axis)).map(x => x.name).sort();
      const names = (arr) => arr.map(x => x.name).sort();
      return {
        board: { margin: axisSet('margin'), budget: axisSet('budget'), due: axisSet('due'), warranty: axisSet('warranty'), stale: axisSet('stale'), review: axisSet('review') },
        src: {
          margin: names(lossAlertData()),
          budget: names(budgetAlertData()),
          due: names(dueAgingData()),
          warranty: names(warrantyDue()),
          stale: names(staleProjectData()),
          review: names(reviewRequestData().filter(x => !x.requested && x.customer && x.customer.phone))
        }
      };
    });
    ['margin', 'budget', 'due', 'warranty', 'stale', 'review'].forEach(ax => {
      assert(JSON.stringify(r.board[ax]) === JSON.stringify(r.src[ax]),
        ax + ' 축 불일치 — board=' + JSON.stringify(r.board[ax]) + ' src=' + JSON.stringify(r.src[ax]));
    });
    // 개별 밴드 sanity: 적자는 loss=true(lossAlertData), 예산은 over=true(budgetAlertData)
    const chk = await page.evaluate(() => ({
      lossA: lossAlertData().find(x => x.name === '적자현장A').loss,
      overB: budgetAlertData().find(x => x.name === '예산현장B').over,
      due95: dueAgingData().find(x => x.name === '미수현장C').days
    }));
    assert(chk.lossA === true, '적자현장A loss=true');
    assert(chk.overB === true, '예산현장B over=true');
    assert(chk.due95 >= 90, '미수현장C 90일+ : ' + chk.due95);
  });

  // 3) 읽기전용 — projHealthBoard 전후 state.projects 딥이퀄 + markDirty 미유발
  await test('읽기전용 — state.projects 불변(structuredClone deepEqual)·markDirty 0', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const before = structuredClone(state.projects);
      const beforeExp = structuredClone(state.expenses);
      const beforeFiles = state.files.length;
      const realDirty = window.markDirty; let dirty = 0;
      window.markDirty = function () { dirty++; return realDirty && realDirty.apply(this, arguments); };
      const b = projHealthBoard();
      window.markDirty = realDirty;
      return {
        eqP: JSON.stringify(before) === JSON.stringify(state.projects),
        eqE: JSON.stringify(beforeExp) === JSON.stringify(state.expenses),
        eqF: beforeFiles === state.files.length,
        dirty, rows: b.rows.length
      };
    });
    assert(r.eqP, 'state.projects 딥이퀄 불변');
    assert(r.eqE, 'state.expenses 불변');
    assert(r.eqF, 'state.files 개수 불변');
    assert(r.dirty === 0, 'markDirty 미유발: ' + r.dirty);
    assert(r.rows === 7, 'rows=7');
  });

  // 4) 직렬화 왕복 불변 + 새 최상위 키 금지 + project 새 필드 금지
  await test('직렬화 왕복 — projects/notes/files 보존·최상위 키 불변·신규키 금지', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const s = serializeData();
      const keys = Object.keys(s).sort();
      const round = JSON.parse(JSON.stringify(s));
      applyData(round);
      // 보드를 반복 호출해도 project 객체에 파생 필드를 stash하지 않아야 함(순수·읽기전용).
      // serializeData가 projects를 화이트리스트 없이 통째 저장하므로, 오염 시 조용히 영속화된다.
      try { projHealthBoard(); projHealthBoard(); } catch (e) {}
      return {
        keys,
        projNames: (state.projects || []).map(p => p.name),
        noteIds: (state.notes || []).map(n => n.id),
        fileCount: (state.files || []).length,
        hasBoardKey: keys.some(k => /board|health/i.test(k)),
        boardKeys: keys.filter(k => /board|health/i.test(k)),
        projFieldPollution: (state.projects || []).some(p => Object.keys(p).some(k => /board|health|_score|_level|_rank/i.test(k)))
      };
    });
    // 이 기능이 추가한 새 최상위 직렬화 키가 없어야 함
    assert(!r.hasBoardKey, '보드 관련 최상위 직렬화 키 금지: ' + JSON.stringify(r.boardKeys));
    assert(!r.projFieldPollution, 'projHealthBoard가 project 객체에 파생 필드를 오염시키지 않아야 함(순수·읽기전용)');
    assert(r.projNames.length === 7, '7현장 보존: ' + r.projNames.length);
    assert(r.noteIds.indexOf('n1') >= 0, 'notes 보존');
    assert(r.fileCount >= 1, 'files 보존');
    // 기준 스냅샷(warranty-review 관례) 대비 최상위 키 집합 — 알려진 키만 존재
    const ALLOWED = ['version', 'app', 'savedAt', 'learn', 'quotes', 'schedule', 'notes', 'priceBook', 'asLog', 'satisfaction', 'adPosts', 'portalCfg', '_savedFileCount', 'kakaoLastAt', 'coworkTasks', 'coworkSched', '_cwSchedInit', '_coworkInit', 'payLog', 'expenses', 'goals', 'aiOps', 'suppliers', 'supplierMap', 'inventory', 'brand', 'contacts', 'projects', 'files'].sort();
    assert(JSON.stringify(r.keys) === JSON.stringify(ALLOWED), '최상위 키 집합 불변\n got: ' + JSON.stringify(r.keys) + '\n exp: ' + JSON.stringify(ALLOWED));
  });

  // 5) UI 임시상태 비직렬화 — __boardOpen/__boardFilter 토글 후 serializeData 동일
  await test('UI 임시상태 비직렬화 — 보드 토글 전후 serializeData() 동일', async () => {
    await seed();
    const r = await page.evaluate(() => {
      window.__boardOpen = false; window.__boardFilter = false;
      const s0 = JSON.stringify(serializeData());
      window.__boardOpen = true; window.__boardFilter = true;
      const s1 = JSON.stringify(serializeData());
      // savedAt만 시각차 가능 → 정규화 후 비교
      const norm = (j) => j.replace(/"savedAt":"[^"]*"/, '"savedAt":"X"');
      return { same: norm(s0) === norm(s1), hasOpen: /boardOpen|boardFilter/.test(s1) };
    });
    assert(r.same, '토글 전후 직렬화 출력 동일(savedAt 제외)');
    assert(!r.hasOpen, '__boardOpen/__boardFilter가 직렬화에 없음');
  });

  // 6) 빈/결측 방어 — projects=[] 또는 결측 필드에서 throw 없이 안전
  await test('빈/결측 방어 — projects=[] counts 0·빈 rows, 결측 필드 throw 없음', async () => {
    const r = await page.evaluate(() => {
      const keepP = state.projects, keepE = state.expenses, keepF = state.files;
      let empty, missing, threw = null;
      try {
        state.projects = []; state.expenses = []; state.files = [];
        empty = projHealthBoard();
        // 결측: customer/phases/doneAt 없는 현장
        state.projects = [{ name: '결측현장', stage: 1 }];
        missing = projHealthBoard();
      } catch (e) { threw = String(e && e.message || e); }
      state.projects = keepP; state.expenses = keepE; state.files = keepF;
      return { threw, emptyRows: empty && empty.rows.length, emptyCounts: empty && empty.counts, missingRows: missing && missing.rows.length };
    });
    assert(r.threw === null, 'throw 없음: ' + r.threw);
    assert(r.emptyRows === 0, '빈 projects → rows 0');
    assert(r.emptyCounts && r.emptyCounts.urgent === 0 && r.emptyCounts.watch === 0 && r.emptyCounts.ok === 0, '빈 counts 0');
    assert(r.missingRows === 1, '결측 현장도 안전 처리(활성 stage<3 포함)');
  });

  // 7) 배지 딥링크 — openAction은 기존 6개 함수명만(새 화면 0) + moreActionHandler 참조 확인
  await test('배지 딥링크 — openAction 화이트리스트·전역 함수 존재·moreActionHandler 참조', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const b = projHealthBoard();
      const acts = Array.from(new Set(b.rows.flatMap(x => x.reasons.map(rr => rr.openAction))));
      const mah = moreActionHandler.toString();
      return {
        acts,
        allFn: acts.every(a => typeof window[a] === 'function'),
        inMah: acts.every(a => mah.indexOf(a + '(') >= 0)
      };
    });
    r.acts.forEach(a => assert(KNOWN_ACTIONS.indexOf(a) >= 0, 'openAction 화이트리스트 위반: ' + a));
    assert(r.allFn, '모든 openAction이 전역 함수');
    assert(r.inMah, '모든 openAction이 moreActionHandler에서 호출됨(새 화면 0)');
  });

  // 8) UI — 브리핑 카드에 보드 섹션 렌더 + 전화 원문 미노출 + 배지 클릭 딥링크
  await test('UI — 브리핑 카드 보드 섹션 렌더·전화 원문 미노출·배지 클릭 → 기존 모달', async () => {
    await seed();
    // 전화 원문(리뷰현장G) 화면 노출 금지 확인
    const dom = await page.evaluate(() => {
      const card = document.querySelector('.brief-card');
      return { hasBoard: /🏥 현장 보드/.test(card ? card.innerHTML : ''),
        hasToggle: !!document.querySelector('[data-boardtoggle]'),
        rawPhone: (card ? card.innerHTML : '').indexOf('01000000000') };
    });
    assert(dom.hasBoard, '브리핑 카드에 🏥 현장 보드 섹션 존재');
    assert(dom.hasToggle, '전체 토글(data-boardtoggle) 존재(>3현장)');
    assert(dom.rawPhone === -1, '전화 원문 화면 미노출');
    // 배지 클릭 → 해당 모달 함수 호출(후킹으로 캡처, 실제 모달 미오픈)
    await page.evaluate(() => {
      window.__opened = [];
      KNOWN().forEach(fn => { window[fn] = function () { window.__opened.push(fn); }; });
      function KNOWN() { return ['lossAlert', 'budgetAlert', 'warrantyManage', 'dueAgingView', 'staleProjects', 'reviewRequest']; }
      render();
    });
    await page.waitForTimeout(150);
    const badge = await page.$('[data-boardreason]');
    assert(badge, '이유 배지(data-boardreason) 존재');
    const action = await page.evaluate(el => el.getAttribute('data-boardreason'), badge);
    await badge.click();
    await page.waitForTimeout(120);
    const opened = await page.evaluate(() => window.__opened);
    assert(opened.length === 1 && opened[0] === action, '배지 클릭 → openAction(' + action + ') 호출: ' + JSON.stringify(opened));
    assert(KNOWN_ACTIONS.indexOf(opened[0]) >= 0, '호출된 함수가 화이트리스트');
  });

  // 9) 현장명 클릭 → 현장별 보기 탭 딥링크
  await test('UI — 현장명 클릭 → state.tab=project·activeProject 설정', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await seed();
    const proj = await page.$('[data-boardproj]');
    assert(proj, '현장명(data-boardproj) 존재');
    const name = await page.evaluate(el => el.getAttribute('data-boardproj'), proj);
    await proj.click();
    await page.waitForTimeout(150);
    const st = await page.evaluate(() => ({ tab: state.tab, ap: state.activeProject }));
    assert(st.tab === 'project', 'tab=project: ' + st.tab);
    assert(st.ap === name, 'activeProject=' + name + ' (got ' + st.ap + ')');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

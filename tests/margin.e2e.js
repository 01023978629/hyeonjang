/* margin.e2e.js — 현장별 순마진(부가세 제외) 집계 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   projStats 확장(supply/costEffective/costSource/marginNet)·projMarginSummary·장부 원가 불러오기 검증.
   원본 데이터 불변·읽기전용·직렬화 왕복(serializeData/applyData 미변경)까지 확인. 실발신/네트워크 없음. */
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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 공통 시드: 다양한 원가 소스 조합의 현장 4곳
  async function seed() {
    await page.evaluate(() => {
      state.projects = [
        // A: 수기 p.cost 전부 + '자재' 지출 태깅 동시 존재(이중계상 방지 검증), 견적 supply 명시
        { name: '현장A', stage: 2, received: 0, phases: [], cost: { material: 3000000, labor: 2000000, outsource: 1000000 }, customer: { name: '가', phone: '', addr: '' }, archived: false },
        // B: 수기 0 + 자재/외주/인건비 지출 태깅(장부 자동합류)
        { name: '현장B', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '나', phone: '', addr: '' }, archived: false },
        // C: 견적 supply 없음(amount/1.1) + 적자(원가>공급가)
        { name: '현장C', stage: 2, received: 0, phases: [], cost: { material: 9000000, labor: 0, outsource: 0 }, customer: { name: '다', phone: '', addr: '' }, archived: false },
        // D: 견적·원가 모두 0(경계)
        { name: '현장D', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '라', phone: '', addr: '' }, archived: false }
      ];
      state.files = [
        { id: 'eA', name: 'A견적.pdf', kind: 'estimate', project: '현장A', est: { amount: 11000000, supply: 9500000, vat: 1500000 } },
        { id: 'eB', name: 'B견적.pdf', kind: 'estimate', project: '현장B', est: { amount: 5500000, supply: 5000000, vat: 500000 } },
        { id: 'eC', name: 'C견적.pdf', kind: 'estimate', project: '현장C', est: { amount: 8800000 } } // supply 없음 → 8000000
      ];
      state.expenses = [
        { id: 'x1', date: '2026-07-01', amount: 500000, category: '자재', method: '카드', memo: '', project: '현장A' }, // A는 수기 있으니 무시돼야
        { id: 'x2', date: '2026-07-02', amount: 1200000, category: '자재', method: '카드', memo: '', project: '현장B' },
        { id: 'x3', date: '2026-07-03', amount: 800000, category: '외주', method: '카드', memo: '', project: '현장B' },
        { id: 'x4', date: '2026-07-04', amount: 700000, category: '인건비', method: '현금', memo: '', project: '현장B' },
        { id: 'x5', date: '2026-07-05', amount: 300000, category: '식대', method: '카드', memo: '', project: '현장B' }, // 원가 제외(costEtc)
        { id: 'x6', date: '2026-07-06', amount: 150000, category: '유류', method: '카드', memo: '', project: '현장B' }  // 원가 제외(costEtc)
      ];
      state.activeProject = null; state.tab = 'dashboard';
      state.dirty = false; render();
    });
  }

  // 1) 공급가 정규화 + 부가세 제외 순마진
  await test('공급가 정규화: f.est.supply 우선, 없으면 amount/1.1', async () => {
    await seed();
    const r = await page.evaluate(() => ({ a: projStats('현장A'), c: projStats('현장C') }));
    assert(r.a.supply === 9500000, 'A supply=명시 supply 9,500,000: ' + r.a.supply);
    assert(r.c.supply === 8000000, 'C supply=amount/1.1=8,000,000: ' + r.c.supply);
    // est(부가세 포함)은 그대로 유지
    assert(r.a.est === 11000000, 'A est 유지(부가세 포함): ' + r.a.est);
    // 순마진은 공급가 환산 원가(costSupply) 기준: 자재·외주는 ÷1.1, 인건비(면세)는 그대로
    assert(r.a.costSupply === Math.round(3000000 / 1.1) + Math.round(1000000 / 1.1) + 2000000, 'A costSupply=자재/1.1+외주/1.1+인건: ' + r.a.costSupply);
    assert(r.a.marginNet === r.a.supply - r.a.costSupply, 'A marginNet=supply-costSupply: ' + r.a.marginNet);
    // costEffective(원문합, 지출합계 표시용)는 costSupply보다 큼(자재·외주 부가세만큼)
    assert(r.a.costEffective === 6000000, 'A costEffective 원문합=6,000,000: ' + r.a.costEffective);
    assert(r.a.costSupply < r.a.costEffective, 'A costSupply < costEffective(자재·외주 부가세 제거)');
  });

  // 2) 택일 중복방지: 수기 p.cost.material>0 + '자재' 지출 동시 → 수기값만
  await test('택일 중복방지: 수기 material>0면 자재 지출 무시(이중계상 방지)', async () => {
    const r = await page.evaluate(() => projStats('현장A'));
    assert(r.material === 3000000, 'A material=수기 3,000,000(지출 500,000 미합산): ' + r.material);
    assert(r.costEffective === 6000000, 'A costEffective=3+2+1M=6,000,000: ' + r.costEffective);
    assert(r.costSource === '수기', 'A costSource=수기: ' + r.costSource);
    assert(r.expAgg.material === 500000, '지출 집계 자체는 보존(파생): ' + r.expAgg.material);
  });

  // 3) 장부 자동합류: 수기 0인 항목만 장부에서, 장비/식대/유류는 원가 제외
  await test('장부 자동합류: 자재/외주/인건비 지출 반영, 식대·유류는 costEtc로 분리', async () => {
    const r = await page.evaluate(() => projStats('현장B'));
    assert(r.material === 1200000, 'B material=자재 지출: ' + r.material);
    assert(r.outsource === 800000, 'B outsource=외주 지출: ' + r.outsource);
    assert(r.labor === 700000, 'B labor=인건비 지출(labor==0이므로): ' + r.labor);
    assert(r.costEffective === 2700000, 'B costEffective 원문합=2,700,000: ' + r.costEffective);
    assert(r.costEtc === 450000, 'B costEtc=식대+유류=450,000(원가 제외): ' + r.costEtc);
    assert(r.costSource === '장부', 'B costSource=장부: ' + r.costSource);
    // 순마진: 자재·외주 ÷1.1(부가세 제거), 인건비 그대로
    assert(r.costSupply === Math.round(1200000 / 1.1) + Math.round(800000 / 1.1) + 700000, 'B costSupply 공급가환산: ' + r.costSupply);
    assert(r.marginNet === 5000000 - r.costSupply, 'B marginNet=supply-costSupply: ' + r.marginNet);
  });

  // 4) applyLaborToProject로 채운 labor는 장부 인건비로 덮지 않음(스케줄 우선)
  await test('스케줄 우선: applyLaborToProject labor는 장부 인건비로 안 덮음', async () => {
    const r = await page.evaluate(() => {
      applyLaborToProject('현장B', 990000); // p.cost.labor=990000 로 확정
      const s = projStats('현장B');
      return { labor: s.labor, costSource: s.costSource, dirty: state.dirty };
    });
    assert(r.labor === 990000, 'labor=스케줄값 990,000(지출 700,000로 안 덮음): ' + r.labor);
    // material/outsource는 여전히 장부 → 혼합
    assert(r.costSource === '혼합', 'costSource=혼합(labor 수기 + 자재/외주 장부): ' + r.costSource);
  });

  // 5) 경계: est=0·cost=0, 음수 순마진
  await test('경계: est=0/cost=0 정상, 적자(음수 순마진) 정상', async () => {
    await seed();
    const r = await page.evaluate(() => ({ d: projStats('현장D'), c: projStats('현장C') }));
    assert(r.d.supply === 0 && r.d.costEffective === 0, 'D 공급가·원가 0');
    assert(r.d.marginNet === 0 && r.d.marginRateNet === 0, 'D 순마진/율 0(분모 0 방지): ' + r.d.marginRateNet);
    assert(r.d.costSource === '없음', 'D costSource=없음: ' + r.d.costSource);
    // C: 자재 9,000,000(부가세 포함) ÷1.1 = 공급가원가 8,181,818 > 공급가매출 8,000,000 → 적자
    assert(r.c.costSupply === Math.round(9000000 / 1.1), 'C costSupply=9,000,000/1.1: ' + r.c.costSupply);
    assert(r.c.marginNet === 8000000 - r.c.costSupply, 'C 적자 marginNet=supply-costSupply: ' + r.c.marginNet);
    assert(r.c.marginNet < 0 && r.c.marginRateNet < 0, 'C 순마진/율 음수: ' + r.c.marginRateNet);
  });

  // 6) projMarginSummary 합계
  await test('projMarginSummary: 활성 현장 rows + total 집계', async () => {
    const r = await page.evaluate(() => projMarginSummary());
    assert(r.rows.length === 4, '활성 현장 4곳: ' + r.rows.length);
    const sumSupply = r.rows.reduce((a, x) => a + x.supply, 0);
    const sumCost = r.rows.reduce((a, x) => a + x.costEffective, 0);
    const sumCostSupply = r.rows.reduce((a, x) => a + x.costSupply, 0);
    assert(r.total.supply === sumSupply, 'total.supply=행 합: ' + r.total.supply);
    assert(r.total.costEffective === sumCost, 'total.costEffective=행 합: ' + r.total.costEffective);
    assert(r.total.costSupply === sumCostSupply, 'total.costSupply=행 합: ' + r.total.costSupply);
    // 순마진은 공급가 환산 원가(costSupply) 기준으로 화해
    assert(r.total.marginNet === r.total.supply - r.total.costSupply, 'total.marginNet=supply-costSupply');
    assert(r.total.marginRateNet === Math.round(r.total.marginNet / r.total.supply * 100), 'total.marginRateNet 일치');
    // 마진(부가세 포함 기준)은 유효원가 원문합(costEffective) 기준으로 화해
    assert(r.total.marginEff === r.total.est - r.total.costEffective, 'total.marginEff=est-costEffective');
  });

  // 7) 읽기전용 불변: 다중 호출이 state 변형·markDirty 안 함
  await test('읽기전용: projStats/projMarginSummary 다중 호출이 state 미변형·markDirty 안 함', async () => {
    const r = await page.evaluate(() => {
      state.dirty = false;
      const before = JSON.stringify({ p: state.projects, e: state.expenses, f: state.files.map(f => ({ n: f.name, est: f.est })) });
      for (let i = 0; i < 5; i++) { projStats('현장A'); projStats('현장B'); projMarginSummary(); }
      const after = JSON.stringify({ p: state.projects, e: state.expenses, f: state.files.map(f => ({ n: f.name, est: f.est })) });
      return { same: before === after, dirty: state.dirty };
    });
    assert(r.same, 'projects/expenses/files(est) 불변');
    assert(r.dirty === false, 'markDirty 미유발(state.dirty=false)');
  });

  // 8) 직렬화 왕복: serializeData→applyData 후 supply/costEffective/marginNet 동일
  await test('직렬화 왕복: p.cost·f.est.supply·태깅 expenses 유지 → 파생값 동일', async () => {
    await seed();
    const before = await page.evaluate(() => projMarginSummary());
    const after = await page.evaluate(() => {
      const snap = JSON.parse(JSON.stringify(serializeData()));
      // 로컬 상태 비우고 왕복 적용(가상항목 복원 경로)
      state.files = []; state.projects = []; state.expenses = [];
      applyData(snap);
      return projMarginSummary();
    });
    const keyFields = ['supply', 'costEffective', 'costSupply', 'marginNet', 'marginRateNet', 'marginEff', 'costSource'];
    const byB = {}; before.rows.forEach(r => byB[r.name] = r);
    after.rows.forEach(r => {
      const b = byB[r.name];
      assert(b, '왕복 후 현장 존재: ' + r.name);
      keyFields.forEach(k => assert(String(b[k]) === String(r[k]), r.name + '.' + k + ' 왕복 동일: ' + b[k] + ' vs ' + r[k]));
    });
    assert(before.total.supply === after.total.supply, 'total.supply 왕복 동일');
    assert(before.total.marginNet === after.total.marginNet, 'total.marginNet 왕복 동일');
  });

  // 9) 대시보드 표: 순마진·원가출처 컬럼 렌더 + 안내 문구
  await test('대시보드: 순마진/원가출처 컬럼·안내문구 렌더', async () => {
    await seed();
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    await page.waitForTimeout(200);
    const has = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        note: t.includes('순마진') && t.includes('부가세 제외'),
        btn: !!document.getElementById('btnLoadCostLedger'),
        srcBadge: /수기|장부|혼합/.test(t)
      };
    });
    assert(has.note, '순마진·부가세 제외 안내문구 노출');
    assert(has.btn, '장부에서 원가 불러오기 버튼 노출');
    assert(has.srcBadge, '원가출처 배지 노출');
  });

  // 10) 장부 원가 불러오기: 0인 항목만 제안·반영, 수기 nonzero 안 덮음
  await test('장부 원가 불러오기: 0인 항목만 setCost, 수기값·확인없는 저장 없음', async () => {
    await seed();
    const proposalB = await page.evaluate(() => hjLedgerCostProposal('현장B'));
    assert(proposalB.material === 1200000 && proposalB.outsource === 800000 && proposalB.labor === 700000, 'B 제안=장부 합');
    const proposalA = await page.evaluate(() => hjLedgerCostProposal('현장A'));
    assert(Object.keys(proposalA).length === 0, 'A(수기 전부 있음) 제안 없음: ' + JSON.stringify(proposalA));
    // 확인(반영) 전에는 p.cost 변화 없음
    const beforeApply = await page.evaluate(() => JSON.stringify(state.projects.find(p => p.name === '현장B').cost));
    assert(beforeApply === JSON.stringify({ material: 0, labor: 0, outsource: 0 }), '반영 전 B.cost 불변: ' + beforeApply);
    // 반영 실행
    const afterApply = await page.evaluate(() => { hjApplyLedgerCost('현장B'); return state.projects.find(p => p.name === '현장B').cost; });
    assert(afterApply.material === 1200000 && afterApply.outsource === 800000 && afterApply.labor === 700000, 'B.cost 반영됨: ' + JSON.stringify(afterApply));
    // 반영 후 A는 여전히 수기값(자재 지출 500,000로 덮이지 않음)
    const aCost = await page.evaluate(() => { hjApplyLedgerCost('현장A'); return state.projects.find(p => p.name === '현장A').cost; });
    assert(aCost.material === 3000000, 'A 수기 material 유지(장부로 안 덮음): ' + aCost.material);
  });

  // 11) 공급가 환산 검증: 자재110·외주110·인건100·공급가1000 → 순마진700
  await test('공급가 환산: 자재110만·외주110만·인건100만·공급가1000만 → 순마진 700만', async () => {
    await page.evaluate(() => {
      state.projects = [{ name: '환산장', stage: 2, received: 0, phases: [], cost: { material: 1100000, labor: 1000000, outsource: 1100000 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.files = [{ id: 'eConv', name: '환산.pdf', kind: 'estimate', project: '환산장', est: { amount: 11000000, supply: 10000000, vat: 1000000 } }];
      state.expenses = []; state.activeProject = null; state.tab = 'dashboard'; state.dirty = false; render();
    });
    const r = await page.evaluate(() => projStats('환산장'));
    assert(r.supply === 10000000, 'supply 10,000,000: ' + r.supply);
    // 자재 1,100,000/1.1=1,000,000 · 외주 1,100,000/1.1=1,000,000 · 인건 1,000,000(면세) = 3,000,000
    assert(r.costSupply === 3000000, 'costSupply=1.0M+1.0M+1.0M=3,000,000: ' + r.costSupply);
    assert(r.marginNet === 7000000, '순마진 7,000,000(700만): ' + r.marginNet);
    assert(r.marginRateNet === 70, '순마진율 70%: ' + r.marginRateNet);
    // 원문합(지출합계 표시용)은 3,200,000 — 순마진은 이 값이 아니라 costSupply로 계산
    assert(r.costEffective === 3200000, 'costEffective 원문합=3,200,000: ' + r.costEffective);
  });

  // 12) 견적 dedup: 동일 project+동일 amount 병합(1건) · 상이 amount 합산 위에서 supply 계산
  await test('견적 dedup: 동일 amount 병합→1건, 상이 amount→합산(supply=dedup 결과)', async () => {
    const merged = await page.evaluate(() => {
      state.projects = [{ name: '중복장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.files = [
        { id: 'd1', name: '중복장 견적.pdf', kind: 'estimate', project: '중복장', est: { amount: 5500000, supply: 5000000, vat: 500000 } },
        { id: 'd2', name: '중복장 견적 (1).pdf', kind: 'estimate', project: '중복장', est: { amount: 5500000, supply: 5000000, vat: 500000 } }
      ];
      state.expenses = []; state.dirty = false; render();
      return { est: projStats('중복장').est, supply: projStats('중복장').supply, files: projStats('중복장').files };
    });
    assert(merged.est === 5500000, '동일 project+amount 2건 병합 → est 5,500,000(중복합산 안 함): ' + merged.est);
    assert(merged.supply === 5000000, '병합 후 supply 5,000,000: ' + merged.supply);
    const summed = await page.evaluate(() => {
      state.files = [
        { id: 'd3', name: '중복장 A동.pdf', kind: 'estimate', project: '중복장', est: { amount: 5500000, supply: 5000000, vat: 500000 } },
        { id: 'd4', name: '중복장 B동.pdf', kind: 'estimate', project: '중복장', est: { amount: 3300000, supply: 3000000, vat: 300000 } }
      ];
      render(); return projStats('중복장');
    });
    assert(summed.est === 8800000, '상이 amount 합산 est=8,800,000: ' + summed.est);
    assert(summed.supply === 8000000, 'dedup 결과 위에서 supply=8,000,000(=명시 supply 합): ' + summed.supply);
  });

  // 13) _fromQuote 가상 견적파일이 있어도 직렬화 왕복 후 projMarginSummary 동일
  await test('_fromQuote 가상 견적파일 있어도 직렬화 왕복 후 projMarginSummary 동일', async () => {
    await page.evaluate(() => {
      state.projects = [{ name: '가상장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.files = [
        { id: 'real1', name: '가상장 견적.pdf', kind: 'estimate', project: '가상장', est: { amount: 6600000, supply: 6000000, vat: 600000 } },
        // 앱 작성 견적에서 파생된 가상 파일(같은 현장+같은 amount) → dedup에 병합됨. 직렬화에선 제외됨.
        { id: 'quote_v1', name: '[견적서] 가상장.pdf', ext: 'pdf', kind: 'estimate', _virtual: true, _fromQuote: true, project: '가상장', est: { amount: 6600000, supply: 6000000, vat: 600000 } }
      ];
      state.expenses = []; state.quotes = []; state.dirty = false; render();
    });
    const before = await page.evaluate(() => projMarginSummary());
    const after = await page.evaluate(() => {
      const snap = JSON.parse(JSON.stringify(serializeData())); // _fromQuote 제외 저장
      state.files = []; state.projects = []; state.expenses = [];
      applyData(snap);
      return projMarginSummary();
    });
    const b = before.rows.find(r => r.name === '가상장'), a = after.rows.find(r => r.name === '가상장');
    assert(b && a, '왕복 후 가상장 존재');
    ['supply', 'costEffective', 'costSupply', 'marginNet', 'marginRateNet'].forEach(k => assert(String(b[k]) === String(a[k]), '가상장.' + k + ' 왕복 동일: ' + b[k] + ' vs ' + a[k]));
    assert(a.supply === 6000000, '왕복 후 supply=6,000,000(가상+실물 중복 병합): ' + a.supply);
  });

  // 14) 대시보드 표: 기타경비 컬럼 렌더(0이면 '-', 값이 있으면 금액)
  await test('대시보드 표: 기타경비 컬럼 렌더', async () => {
    await seed(); // 현장B는 식대 300,000 + 유류 150,000 = 기타경비 450,000
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    await page.waitForTimeout(200);
    const has = await page.evaluate(() => {
      const t = document.body.innerText;
      return { header: t.includes('기타경비'), note: t.includes('순마진 제외'), val: t.includes('450,000') };
    });
    assert(has.header, '기타경비 헤더 노출');
    assert(has.note, '기타경비(순마진 제외) 표기');
    assert(has.val, '현장B 기타경비 450,000 렌더');
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

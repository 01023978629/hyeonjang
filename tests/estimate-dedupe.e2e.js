/* estimate-dedupe.e2e.js — 견적서 중복 판정 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.

   대표님이 정한 규칙:
     "엑셀이 원본이므로, PDF는 중복되는 경우 엑셀만 매출에 반영한다."

   그래서 이 파일이 지키는 것은 두 방향이다.
     · 덜 묶으면 → 같은 견적이 두 번 잡혀 매출이 부풀어 오른다
     · 더 묶으면 → 서로 다른 견적이 합쳐져 매출이 통째로 사라진다 (이쪽이 훨씬 위험하다.
       화면에는 '사본 N' 배지만 뜨고, 사라진 금액은 미수금·에이징·파수꾼 어디에도 안 남으며
       청구서까지 축소된 금액으로 나간다)

   실측으로 확인된 사고: '태산그린 101동 견적.xlsx' 500만 + '태산그린 202동 견적.xlsx' 500만
   → 매출 500만원(정답 1,000만원). 현장·금액만 같으면 무조건 같은 견적으로 묶었기 때문이다.
   같은 평형 두 세대를 같은 단가로 수주하는 건 이 업종의 기본 패턴이다.

   실발신·네트워크 없음. state 를 세우고 읽기만 한다. */
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

  // files: [name, ext, amount, date] → 매출 합계와 대표 목록을 돌려준다
  const run = (files) => page.evaluate((fs) => {
    state.projects = [{ name: '현장', stage: 2, received: 0, phases: [], cost: {},
                        customer: { name: '', phone: '', addr: '' }, archived: false }];
    state.files = fs.map((f, i) => ({ id: 'f' + i, name: f[0], ext: f[1], kind: 'estimate', project: '현장',
      est: { customer: f[0], amount: f[2], supply: f[2], vat: Math.round(f[2] * 0.1), date: f[3] },
      when: new Date(f[3]) }));
    state.quotes = [];
    const g = estimateGroups(state.files);
    return { est: projStats('현장').est, reps: g.map(x => ({ name: x.rep.name, dups: x.dups.length })) };
  }, files);

  await test('서로 다른 두 세대가 단가만 같다고 합쳐지지 않는다 (매출이 사라지던 사고)', async () => {
    const r = await run([['태산그린 101동 견적.xlsx', 'xlsx', 5000000, '2026-05-01'],
                         ['태산그린 202동 견적.xlsx', 'xlsx', 5000000, '2026-05-02']]);
    assert(r.est === 10000000, '두 세대 견적이 합쳐져 매출이 사라졌다: ' + r.est + ' (정답 10,000,000)');
    assert(r.reps.length === 2, '별개 견적 2건이어야 한다: ' + r.reps.length);
  });

  await test('같은 날 견적낸 두 세대도 합쳐지지 않는다 (날짜만으로는 못 가른다)', async () => {
    const r = await run([['태산그린 101동 견적.xlsx', 'xlsx', 5000000, '2026-05-01'],
                         ['태산그린 202동 견적.xlsx', 'xlsx', 5000000, '2026-05-01']]);
    assert(r.est === 10000000, '같은 날이라고 합쳐졌다: ' + r.est);
  });

  await test('한쪽이 PDF여도 다른 세대면 합쳐지지 않는다', async () => {
    const r = await run([['태산그린 101동 견적.xlsx', 'xlsx', 5000000, '2026-05-01'],
                         ['태산그린 202동 견적.pdf', 'pdf', 5000000, '2026-05-01']]);
    assert(r.est === 10000000, '호수가 다른데 엑셀·PDF라고 합쳐졌다: ' + r.est);
  });

  await test('같은 견적의 엑셀 + PDF 출력본 → 엑셀만 매출에 반영', async () => {
    const r = await run([['망원동 견적.xlsx', 'xlsx', 7000000, '2026-05-01'],
                         ['망원동 견적서.pdf', 'pdf', 7000000, '2026-05-01']]);
    assert(r.est === 7000000, 'PDF 출력본이 매출에 두 번 잡혔다: ' + r.est);
    assert(r.reps.length === 1 && /\.xlsx$/.test(r.reps[0].name),
      '대표가 엑셀(원본)이어야 한다: ' + JSON.stringify(r.reps));
  });

  await test('이름이 전혀 다른 PDF 스캔본도 엑셀의 사본으로 본다', async () => {
    const r = await run([['망원동카페 견적.xlsx', 'xlsx', 6000000, '2026-05-01'],
                         ['스캔_20260510.pdf', 'pdf', 6000000, '2026-05-01']]);
    assert(r.est === 6000000, '같은 견적의 스캔본이 매출에 또 잡혔다: ' + r.est);
    assert(/\.xlsx$/.test(r.reps[0].name), '대표가 엑셀이어야 한다: ' + r.reps[0].name);
  });

  await test('엑셀 1건 + PDF 2건이어도 매출은 엑셀 1건만', async () => {
    const r = await run([['망원동 견적.xlsx', 'xlsx', 7000000, '2026-05-01'],
                         ['망원동 견적서.pdf', 'pdf', 7000000, '2026-05-01'],
                         ['망원동 견적 사본.pdf', 'pdf', 7000000, '2026-05-01']]);
    assert(r.est === 7000000, 'PDF 사본이 매출에 잡혔다: ' + r.est);
    assert(r.reps.length === 1 && r.reps[0].dups === 2, '사본 2건으로 묶여야 한다: ' + JSON.stringify(r.reps));
  });

  await test('PDF만 있고 엑셀이 없으면 그 PDF가 매출에 잡힌다', async () => {
    const r = await run([['스캔견적.pdf', 'pdf', 4000000, '2026-05-01']]);
    assert(r.est === 4000000, '엑셀이 없는데 PDF 매출이 빠졌다: ' + r.est);
  });

  await test('같은 견적을 이름만 바꿔 두 번 저장한 것은 사본으로 묶는다', async () => {
    // 이름 정규화로는 못 묶이던 실제 사례 — 2차 병합이 잡아야 한다
    const r = await run([['★20251028 빌드캡 공주 3,978,700.xlsx', 'xlsx', 3978700, '2025-10-28'],
                         ['빌드캡 (공주)20251028 (1).xlsx', 'xlsx', 3978700, '2025-10-28']]);
    assert(r.est === 3978700, '같은 견적이 두 번 잡혀 매출이 부풀었다: ' + r.est);
    assert(r.reps.length === 1, '사본으로 묶여야 한다: ' + r.reps.length);
  });

  await test('금액이 다르면 이름이 비슷해도 별개 견적이다', async () => {
    const r = await run([['유성카페 견적.xlsx', 'xlsx', 3978700, '2026-05-10'],
                         ['유성카페 추가공사 견적.xlsx', 'xlsx', 1200000, '2026-05-10']]);
    assert(r.est === 5178700, '본공사와 추가공사가 합쳐졌다: ' + r.est + ' (정답 5,178,700)');
  });

  await test('집계 제외(exSum) 표시한 견적은 매출에서 빠진다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '현장', stage: 2, received: 0, phases: [], cost: {},
                          customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.files = [
        { id: 'x1', name: '둔산동 초안.xlsx', ext: 'xlsx', kind: 'estimate', project: '현장', exSum: true,
          est: { amount: 30000000, supply: 30000000, vat: 3000000, date: '2026-05-01' }, when: new Date('2026-05-01') },
        { id: 'x2', name: '둔산동 확정 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '현장',
          est: { amount: 40000000, supply: 40000000, vat: 4000000, date: '2026-05-05' }, when: new Date('2026-05-05') }
      ];
      state.quotes = [];
      return projStats('현장').est;
    });
    assert(r === 40000000, '집계 제외한 초안이 매출에 들어갔다: ' + r);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== estimate-dedupe: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

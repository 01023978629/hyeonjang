/* restore-parity.e2e.js — 저장(serializeData) ↔ 복원(applyData) 필드 패리티

   2026-08-28 감사에서 실증된 사고: 부팅·서버·드라이브 복원이 전부 지나가는
   applyData 의 '가상 항목' push 에 exSum(집계 제외)·ledger 가 빠져 있어,
   복원 한 번에 '집계 제외' 표시가 풀리고 초안 견적이 매출·부가세에 다시 잡혔다.
   그 상태로 저장되면 서버·백업 사본까지 오염된다.

   이 테스트는 필드 이름을 하나씩 나열하지 않는다 — serializeData 가 저장한
   레코드를 빈 상태에 applyData 로 넣고 다시 serializeData 해서, 저장 레코드가
   **왕복 후에도 같은지**를 통째로 비교한다. 다음에 어떤 필드를 새로 저장하든
   복원 쪽에 안 넣으면 여기서 걸린다.

     ① 가상 복원(실파일 없음 = 부팅 직후) 왕복에서 저장 필드가 그대로다
     ② 특히 exSum:true 와 ledger 가 살아남는다 (실증된 사고 그 자체)
     ③ 집계도 확인: 복원 후 salesEstimateFiles 합계에 제외 견적이 안 들어간다
     ④ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    // 시드: 저장 스키마의 모든 필드를 채운 파일 2개 — 하나는 집계 제외(★초안), 하나는 정상
    state.projects = [{ name: '패리티현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    state.quotes = [];
    state.files = [
      { id: 'pf1', name: '패리티 견적 초안.xlsx', handle: null, prefix: '견적서/패리티현장/', ext: 'xlsx', size: 1234,
        kind: 'estimate', project: '패리티현장', when: new Date('2026-08-01T09:00:00'), lat: 36.3, lng: 127.4,
        place: null, address: '대전 중구', thumb: null, text: '견적 본문', ocr: 'done',
        est: { amount: 5000000, supply: 4545455, vat: 454545, customer: '패리티', date: '2026-08-01', _edited: true },
        exSum: true, ledger: { memo: '초안 — 집계 제외' }, quote: null, contact: null,
        _phase: '견적', _worklabel: '초안', _gdFolder: 'gdX', _driveId: 'driveA', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 1234, _file: null },
      // 두 번째 파일도 전 필드를 채운다 — 왕복 비교가 '기본값 정규화'(ocr 미지정→'na' 등)를
      // 버그로 오인하지 않게, 시드는 항상 완전해야 한다.
      { id: 'pf2', name: '패리티 견적 최종.xlsx', handle: null, prefix: '견적서/패리티현장/', ext: 'xlsx', size: 2345,
        kind: 'estimate', project: '패리티현장', when: new Date('2026-08-02T09:00:00'), lat: 36.31, lng: 127.41,
        place: null, address: '대전 중구 2', thumb: null, text: '최종 본문', ocr: 'done',
        est: { amount: 7000000, supply: 6363636, vat: 636364, customer: '패리티', date: '2026-08-02', _edited: true },
        exSum: false, ledger: null, quote: null, contact: null,
        _phase: '견적', _worklabel: '최종', _gdFolder: 'gdY', _driveId: 'driveB', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 2345, _file: null }
    ];
    const s1 = serializeData();
    // 부팅 직후 상태 재현: 실파일 0 → 전부 가상 복원 경로
    state.files = []; state.projects = []; state.quotes = [];
    window.__scanFresh = false;
    applyData(JSON.parse(JSON.stringify(s1)));
    const s2 = serializeData();
    const pick = (s, name) => (s.files || []).find(f => f.name === name) || null;
    // 집계 확인 — 제외(★초안) 견적이 매출 합계에 다시 들어오면 안 된다
    let saleTotal = 0;
    try { salesEstimateFiles().forEach(f => { saleTotal += (f.est && f.est.amount) || 0; }); } catch (e) { saleTotal = -1; }
    return {
      a1: pick(s1, '패리티 견적 초안.xlsx'), a2: pick(s2, '패리티 견적 초안.xlsx'),
      b1: pick(s1, '패리티 견적 최종.xlsx'), b2: pick(s2, '패리티 견적 최종.xlsx'),
      saleTotal, n2: (s2.files || []).length
    };
  });

  assert(r.a1 && r.a2 && r.b1 && r.b2, '① 왕복 후 파일 레코드가 사라졌다: ' + JSON.stringify({ n: r.n2 }));

  // ① 저장 레코드 전 필드 왕복 비교 — 필드가 늘어도 자동으로 지켜진다
  for (const [before, after, label] of [[r.a1, r.a2, '초안'], [r.b1, r.b2, '최종']]) {
    for (const k of Object.keys(before)) {
      const bv = JSON.stringify(before[k] === undefined ? null : before[k]);
      const av = JSON.stringify(after[k] === undefined ? null : after[k]);
      assert(bv === av, `① ${label} 레코드의 "${k}" 가 왕복에서 변질됐다: 저장 ${bv} → 복원 후 ${av}`);
    }
  }

  // ② 실증된 사고 그 자체
  assert(r.a2.exSum === true, '② 복원 후 exSum(집계 제외)이 풀렸다 — 초안이 매출에 다시 잡힌다');
  assert(r.a2.ledger && r.a2.ledger.memo === '초안 — 집계 제외', '② 복원 후 ledger 가 유실됐다');

  // ③ 매출 합계에 제외 견적 미포함 (700만만, 500만 초안 제외)
  assert(r.saleTotal === 7000000, '③ 복원 후 매출 집계에 제외 견적이 들어갔다: ' + r.saleTotal);

  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));
  console.log('PASS  ① 저장↔가상복원 전 필드 왕복 일치');
  console.log('PASS  ② exSum·ledger 생존 (실증 사고 회귀)');
  console.log('PASS  ③ 복원 후 매출 집계에 제외 견적 미포함');
  console.log('PASS  ④ pageerror 0');
  console.log('\n전부 통과 (4건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

/* snapshot-revert.e2e.js — 안전판 복구가 "그 시점으로" 정말 되돌리는가 (Playwright)

   보호하는 사고: 안전판·백업 복구가 applyData 의 병합 동작을 그대로 써서,
   스냅샷 이후 추가한 파일 항목·est 연결·집계 제외(exSum)·메모가 복구 후에도
   남았다(종합평가: "복구는 병합만 한다 — 약속과 다르다"). 사용자는 "되돌렸다"는
   토스트를 믿고 저장하므로, 남은 찌꺼기가 그대로 확정된다.

   실제 UI(🛡 안전판 모달 → 복구 → 확인)를 눌러 검사한다:
     ① 스냅샷 이후 추가한 파일 항목이 복구로 사라진다
     ② 스냅샷 이후 붙인 est 연결·집계 제외(exSum)·메모가 스냅샷 값으로 돌아간다
     ③ 매칭된 파일은 객체가 교체되지 않는다(런타임 핸들·썸네일 보존)
     ④ 컬렉션(견적·메모)도 스냅샷 시점으로
     ⑤ pageerror 0

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
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 시드 → 스냅샷 → 오염(추가·연결·수정)
  await page.evaluate(async () => {
    state.projects = [{ name: '복구현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    state.files = [
      { id: 'fA', name: 'a.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: '복구현장', text: '원래 메모', ocr: 'na', est: null, exSum: false, ledger: null, size: 10, when: new Date('2026-08-01T09:00:00'), __live: 'A핸들' },
      { id: 'fB', name: 'b.pdf', prefix: '', ext: 'pdf', kind: 'doc', project: '복구현장', text: '', ocr: 'na', est: null, exSum: false, ledger: null, size: 20, when: new Date('2026-08-01T10:00:00') }
    ];
    state.quotes = [{ id: 'q1', title: '견적1', items: [] }];
    state.notes = [{ id: 'n1', text: '원래 노트' }];
    const ok = await hjSnapshot('리버트 테스트', true);
    if (!ok) throw new Error('스냅샷 저장 실패');
    // 오염: 항목 추가 + est/exSum/메모 연결 + 컬렉션 변경
    state.files.push({ id: 'fC', name: 'c.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: null, text: '', ocr: 'na', size: 30 });
    const A = state.files.find(f => f.id === 'fA');
    A.est = '엉뚱한견적.pdf'; A.exSum = true; A.text = '오염된 메모'; A.ledger = { m: 1 };
    state.quotes.push({ id: 'q2', title: '견적2', items: [] });
    state.notes[0].text = '오염된 노트';
  });

  // 실제 UI로 복구: 🛡 모달 → 첫 스냅샷 [복구] → 확인 모달 [✅ 복구]
  await page.evaluate(() => backupHistory());
  await page.waitForSelector('.snapRestore');
  await page.click('.snapRestore >> nth=0');
  await page.waitForTimeout(300);
  const confirmBtn = await page.$$eval('#modalRoot .mfoot button', bs => bs.findIndex(b => /복구/.test(b.textContent)));
  assert(confirmBtn >= 0, '복구 확인 버튼을 못 찾았다');
  await page.click(`#modalRoot .mfoot button >> nth=${confirmBtn}`);
  await page.waitForTimeout(800);

  const st = await page.evaluate(() => {
    const A = state.files.find(f => f.id === 'fA') || state.files.find(f => f.name === 'a.jpg');
    return {
      names: state.files.filter(f => !f._fromQuote).map(f => f.name).sort(),
      A: A ? { est: A.est, exSum: A.exSum, text: A.text, ledger: A.ledger, live: A.__live } : null,
      quotes: state.quotes.map(q => q.id),
      note: state.notes[0] && state.notes[0].text
    };
  });

  assert(!st.names.includes('c.jpg'), '① 스냅샷 이후 추가한 항목이 복구 뒤에도 남았다 — 복구가 병합만 한다: ' + JSON.stringify(st.names));
  assert(st.names.join(',') === 'a.jpg,b.pdf', '① 복구 후 파일 목록이 스냅샷과 다르다: ' + JSON.stringify(st.names));
  assert(st.A && !st.A.est && st.A.exSum === false && !st.A.ledger,
    '② est 연결·집계 제외·장부 표시가 스냅샷 값으로 안 돌아왔다: ' + JSON.stringify(st.A));
  assert(st.A.text === '원래 메모', '② 메모가 스냅샷 값으로 안 돌아왔다: ' + JSON.stringify(st.A));
  assert(st.A.live === 'A핸들', '③ 매칭된 파일 객체가 교체돼 런타임 핸들이 사라졌다');
  assert(st.quotes.join(',') === 'q1', '④ 견적 목록이 스냅샷 시점이 아니다: ' + st.quotes);
  assert(st.note === '원래 노트', '④ 노트가 스냅샷 시점이 아니다: ' + st.note);
  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 스냅샷 이후 추가 항목 제거');
  console.log('PASS  ② est·집계 제외·장부·메모 스냅샷 값 복원');
  console.log('PASS  ③ 매칭 파일 객체 보존(핸들 유지)');
  console.log('PASS  ④ 견적·노트 컬렉션 복원');
  console.log('PASS  ⑤ pageerror 0');
  console.log('\n전부 통과 (5건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

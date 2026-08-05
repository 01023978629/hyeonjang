/* apt-photos.e2e.js — 아파트 오더 ↔ 사진 연결

   사장님의 새 흐름: 시공 사진을 드라이브에 직접 올리고, 파일명에 단지·동/호를
   넣는다(예: 신흥마을아파트_103동1204호_실리콘.jpg). 그 규칙을 오더 화면과 잇는다 —
   오더 줄의 [📸 n] 을 누르면 사진 탭이 그 동/호로 검색된 채 열린다.

     ① 파일명에 동/호가 든 사진이 있으면 오더 줄에 📸 배지가 뜬다 (장수 포함)
     ② 사진이 없으면 버튼 자체가 없다 — 눌러서 빈 화면이 나오면 기능을 못 믿는다
     ③ 누르면 사진 탭으로 이동 + 검색어 설정 + 검색 입력칸에도 반영(지울 수 있게)
     ④ 배지 수 == 사진 탭이 실제로 걸러낼 장수 (matchSearch 와 같은 판정)
        — 배지가 3장이라는데 탭에서 0장이 보이면 끝이다
     ⑤ 검색어는 공백 뺀 동/호 — 파일명에 공백을 안 쓰는 관행과 맞춘다
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'p1', officeId: 'of1', unit: '103동 1204호', text: '욕실 실리콘', amount: 80000, date: localDate(), status: 'work', doneAt: '' },
      { id: 'p2', officeId: 'of1', unit: '201동 505호', text: '사진 없는 오더', amount: 0, date: localDate(), status: 'recv', doneAt: '' }
    ];
    // 사진 픽스처 — 파일명 규칙(공백 없음) 2장 + 다른 동/호 1장 + 사진 아닌 파일 1개
    state.files = state.files.filter(f => !/PHTEST/.test(f.name || ''));
    state.files.push(
      { name: 'PHTEST_신흥마을아파트_103동1204호_실리콘_전.jpg', ext: 'jpg', kind: 'photo' },
      { name: 'PHTEST_신흥마을아파트_103동1204호_실리콘_후.jpg', ext: 'jpg', kind: 'photo' },
      { name: 'PHTEST_신흥마을아파트_999동1호_다른집.jpg', ext: 'jpg', kind: 'photo' },
      { name: 'PHTEST_103동1204호_견적서.pdf', ext: 'pdf', kind: 'estimate' }   // 사진 아님 — 세면 안 됨
    );
  });

  // ①② 배지 유무와 장수
  const badge = await page.evaluate(() => {
    aptOrderManage('of1');
    const root = document.getElementById('modalRoot');
    const b1 = root.querySelector('.apoPh[data-id="p1"]');
    const b2 = root.querySelector('.apoPh[data-id="p2"]');
    return { has1: !!b1, label1: b1 ? b1.textContent.trim() : '', has2: !!b2 };
  });
  assert(badge.has1, '① 사진이 있는데 📸 배지가 없다');
  assert(/2/.test(badge.label1), '① 장수가 2가 아니다 (다른 동/호·PDF 를 세면 안 된다): ' + badge.label1);
  assert(!badge.has2, '② 사진이 없는 오더에 버튼이 있다 — 눌러서 빈 화면이 나온다');

  // ③⑤ 누르면 사진 탭 + 검색어(공백 제거) + 입력칸 반영
  const jump = await page.evaluate(() => {
    document.getElementById('modalRoot').querySelector('.apoPh[data-id="p1"]').onclick();
    const gi = document.getElementById('globalSearch');
    return { tab: state.tab, search: state.search, input: gi ? gi.value : null };
  });
  assert(jump.tab === 'photos', '③ 사진 탭으로 안 간다: ' + jump.tab);
  assert(jump.search === '103동1204호', '⑤ 검색어가 공백 뺀 동/호가 아니다: ' + jump.search);
  assert(jump.input === '103동1204호', '③ 검색 입력칸에 반영 안 됨 — 사용자가 지울 방법이 없다: ' + jump.input);

  // ④ 배지 수 == 탭이 실제로 거를 장수 (같은 matchSearch 판정)
  const agree = await page.evaluate(() => {
    const o = state.aptOrders.find(x => x.id === 'p1');
    const n = aptPhotoCount(o);
    state.search = aptPhotoQuery(o);
    const tabN = state.files.filter(f => f.kind === 'photo' && matchSearch(f)).length;
    state.search = '';
    return { n, tabN };
  });
  assert(agree.n === agree.tabN && agree.n === 2,
    '④ 배지(' + agree.n + ')와 탭 필터(' + agree.tabN + ')가 다르다 — 배지를 못 믿게 된다');

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 사진 있는 오더에 📸 배지 + 정확한 장수');
  console.log('PASS  ② 사진 없으면 버튼 없음');
  console.log('PASS  ③ 사진 탭 이동 + 입력칸 반영');
  console.log('PASS  ④ 배지 수 == 탭 필터 수');
  console.log('PASS  ⑤ 검색어는 공백 뺀 동/호');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

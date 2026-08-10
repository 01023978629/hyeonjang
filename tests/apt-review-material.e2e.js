/* apt-review-material.e2e.js — 완료 오더의 개인정보 없는 후기 재료 복사
   전제: tests/static-server.js(8299) 실행 중. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage(); page.setDefaultTimeout(9000);
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '대전 둔산동 한빛아파트', manager: '김소장', phone: '042-000-0000' }];
    state.aptOrders = [
      { id: 'done1', officeId: 'of1', unit: '105동 1402호', text: '홍길동 010-1234-5678 105동 1402호 욕실 잡배수 보수', customerName: '홍길동', phone: '010-1234-5678', amount: 300000, date: localDate(), status: 'done', doneAt: localDate() },
      { id: 'recv1', officeId: 'of1', unit: '101동 101호', text: '미완료 작업', amount: 0, date: localDate(), status: 'recv', doneAt: '' }
    ];
    state.files = [
      { id: 'p1', kind: 'photo', name: '105동1402호_철거1.jpg', prefix: '', _phase: '철거', when: new Date() },
      { id: 'p2', kind: 'photo', name: '105동1402호_시공전2.jpg', prefix: '', _phase: '시공전', when: new Date() },
      { id: 'p3', kind: 'photo', name: '105동1402호_완료1.jpg', prefix: '', _phase: '완료', when: new Date() },
      { id: 'p4', kind: 'photo', name: '105동1402호_마감2.jpg', prefix: '', _phase: '마감', when: new Date() }
    ];
    aptOrderManage('of1');
  });

  // ① 완료 오더에만 버튼이 보인다.
  const buttons = await page.evaluate(() => ({ done: !!document.querySelector('.apoReview[data-id="done1"]'), recv: !!document.querySelector('.apoReview[data-id="recv1"]') }));
  assert(buttons.done && !buttons.recv, '① 완료/미완료 버튼 노출 규칙 위반: ' + JSON.stringify(buttons));

  // ② 템플릿과 사진 수를 채우되 구조화된 개인정보는 절대 넣지 않는다.
  const text = await page.evaluate(() => aptReviewMaterialText(state.aptOrders.find(o => o.id === 'done1')));
  assert(text.startsWith('[현장 후기 재료]\n'), '② 템플릿 제목 없음');
  assert(/1\. 동네\+단지: 대전 둔산동 한빛아파트/.test(text), '② 단지명 없음: ' + text);
  assert(/5\. 공사 내용: 욕실 잡배수 보수/.test(text), '② 공사 내용 정제 실패: ' + text);
  assert(/시공 전 2장 · 시공 후 2장/.test(text), '② 전후 사진 수가 다름: ' + text);
  assert(/고객 사진 공개 동의: 미확인/.test(text), '② 공개 동의 미확인 문구 없음');
  ['105동 1402호','105동1402호','홍길동','010-1234-5678','01012345678'].forEach(secret => assert(!text.includes(secret), '② 개인정보 포함: ' + secret));

  // ③ 실제 버튼 경로가 같은 문안을 클립보드로 보낸다.
  const copied = await page.evaluate(async () => {
    window.__copied = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = String(t); } } });
    document.querySelector('.apoReview[data-id="done1"]').click();
    await new Promise(r => setTimeout(r, 30));
    return window.__copied;
  });
  assert(copied === text, '③ 버튼 복사 내용이 순수 함수 결과와 다름');

  // ④ 완료되지 않은 오더는 함수 직접 호출로도 복사하지 않는다.
  const blocked = await page.evaluate(async () => {
    window.__copied = '';
    const ok = await aptReviewMaterialCopy('recv1');
    return { ok, copied: window.__copied };
  });
  assert(blocked.ok === false && blocked.copied === '', '④ 미완료 오더 복사 차단 실패: ' + JSON.stringify(blocked));
  assert(errors.length === 0, '⑤ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 완료 오더에만 [후기 재료 복사]');
  console.log('PASS  ② 단지·작업·전후 사진 수 + 개인정보 제외');
  console.log('PASS  ③ 버튼 경로 클립보드 복사');
  console.log('PASS  ④ 미완료 오더 복사 차단');
  console.log('PASS  ⑤ pageerror 0');
  console.log('\n전부 통과 (5건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e); process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

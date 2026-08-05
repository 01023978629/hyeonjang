/* apt-ba.e2e.js — 아파트 오더에서 시공 전/후 비교 카드 만들기

   배경: 대표가 "시공 전·후 사진도 올려야 하는데 어떻게 하나" 물었다.
   확인해 보니 전/후 카드(baPickView)는 **현장(project)에 배정된 사진**만
   대상이었다. 아파트 오더는 현장이 아니라 **파일명(동/호)** 으로 사진을
   잡으므로, 관리사무소 일은 전/후 카드를 아예 만들 수 없었다.

     ① 사진 2장 이상인 오더에만 [🖼] 버튼이 뜬다 (1장이면 짝을 못 지음)
     ② [🖼] 를 누르면 그 동/호 사진만 골라진다 — 남의 집 사진이 섞이면 안 된다
     ③ 카드 제목이 "단지 동/호" 로 나온다 (현장명이 아니다)
     ④ 두 장을 고르면 [비교 카드 만들기]가 열린다 (그 전에는 잠김)
     ⑤ [‹ 뒤로]는 아파트 오더로 돌아온다 (현장 목록으로 튀지 않는다)
     ⑥ 기존 현장 경로(baPickView(현장명))는 그대로 동작한다
     ⑦ pageerror 0

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
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '선비마을3단지', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'b1', officeId: 'of1', unit: '315동 1401호', text: '배관 교체', amount: 0, date: localDate(), status: 'done', doneAt: localDate() },
      { id: 'b2', officeId: 'of1', unit: '210동 502호', text: '수전 교체', amount: 0, date: localDate(), status: 'done', doneAt: localDate() }
    ];
    state.projects = [{ name: '일반현장A', stage: 1, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false }];
    state.files = [
      // 315동 1401호 — 전/후 2장
      { id: 'p1', name: '선비마을3단지_315동1401호_시공전.jpg', ext: 'jpg', kind: 'photo' },
      { id: 'p2', name: '선비마을3단지_315동1401호_시공후.jpg', ext: 'jpg', kind: 'photo' },
      // 210동 502호 — 1장뿐
      { id: 'p3', name: '선비마을3단지_210동502호_시공후.jpg', ext: 'jpg', kind: 'photo' },
      // 현장 배정 사진(기존 경로용)
      { id: 'p4', name: '일반현장_철거.jpg', ext: 'jpg', kind: 'photo', project: '일반현장A', _phase: '철거' },
      { id: 'p5', name: '일반현장_완료.jpg', ext: 'jpg', kind: 'photo', project: '일반현장A', _phase: '완료' }
    ];
  });

  // ① 2장 이상인 오더에만 버튼
  const btns = await page.evaluate(() => {
    aptOrderManage('of1');
    const root = document.getElementById('modalRoot');
    return {
      has2: !!root.querySelector('.apoBA[data-id="b1"]'),
      has1: !!root.querySelector('.apoBA[data-id="b2"]'),
      cnt1: aptPhotoCount(state.aptOrders.find(o => o.id === 'b1')),
      cnt2: aptPhotoCount(state.aptOrders.find(o => o.id === 'b2'))
    };
  });
  assert(btns.cnt1 === 2 && btns.cnt2 === 1, '시드 확인 — 사진 매칭 수가 틀리다: ' + JSON.stringify(btns));
  assert(btns.has2, '① 사진 2장인 오더에 전/후 버튼이 없다 — 관리사무소 일은 전후 카드를 못 만든다');
  assert(!btns.has1, '① 사진 1장인데 전/후 버튼이 뜬다 — 짝지을 수 없는데 열린다');

  // ②③ 누르면 그 동/호 사진만, 제목은 단지+동/호
  const picked = await page.evaluate(async () => {
    document.getElementById('modalRoot').querySelector('.apoBA[data-id="b1"]').click();
    await new Promise(r => setTimeout(r, 250));
    const root = document.getElementById('modalRoot');
    return {
      n: root.querySelectorAll('.baPh').length,
      title: (root.textContent || '').slice(0, 120),
      proj: window.__baPick && window.__baPick.proj
    };
  });
  assert(picked.n === 2, '② 고를 사진이 2장이 아니다(' + picked.n + ') — 남의 집 사진이 섞였거나 못 찾았다');
  assert(/선비마을3단지/.test(picked.proj || '') && /315동 1401호/.test(picked.proj || ''),
    '③ 카드 제목이 "단지 동/호"가 아니다: ' + picked.proj);

  // ④ 두 장 고르면 버튼이 열린다
  const two = await page.evaluate(async () => {
    const root = document.getElementById('modalRoot');
    const before = document.getElementById('baMake').disabled;
    root.querySelectorAll('.baPh')[0].onclick();
    const mid = document.getElementById('baMake').disabled;
    root.querySelectorAll('.baPh')[1].onclick();
    const after = document.getElementById('baMake').disabled;
    return { before, mid, after, pick: window.__baPick };
  });
  assert(two.before === true && two.mid === true, '④ 한 장만 골랐는데 카드 만들기가 열린다');
  assert(two.after === false, '④ 두 장 골랐는데 카드 만들기가 안 열린다');
  assert(two.pick.before === 0 && two.pick.after === 1, '④ 전/후 순서가 안 잡힌다: ' + JSON.stringify(two.pick));

  // ⑤ 뒤로 → 아파트 오더
  const back = await page.evaluate(async () => {
    const bs = Array.from(document.querySelectorAll('#modalRoot button, .modal button'));
    const b = bs.find(x => /뒤로/.test(x.textContent || ''));
    const had = !!b; if (b) b.click();
    await new Promise(r => setTimeout(r, 250));
    return { had, apt: /아파트 오더/.test(document.getElementById('modalRoot').textContent || '') };
  });
  assert(back.had, '⑤ [뒤로] 버튼이 없다');
  assert(back.apt, '⑤ [뒤로]가 아파트 오더로 안 돌아온다 — 현장 목록으로 튄다');

  // ⑥ 기존 현장 경로 회귀
  const legacy = await page.evaluate(async () => {
    closeModal();
    baPickView('일반현장A');
    await new Promise(r => setTimeout(r, 250));
    return { n: document.getElementById('modalRoot').querySelectorAll('.baPh').length, proj: window.__baPick.proj };
  });
  assert(legacy.n === 2 && legacy.proj === '일반현장A', '⑥ 기존 현장 전/후 경로가 깨졌다: ' + JSON.stringify(legacy));

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 사진 2장 이상인 오더에만 [🖼]');
  console.log('PASS  ② 그 동/호 사진만 골라진다');
  console.log('PASS  ③ 카드 제목 = 단지 동/호');
  console.log('PASS  ④ 두 장 고르면 카드 만들기 열림');
  console.log('PASS  ⑤ [뒤로] → 아파트 오더 복귀');
  console.log('PASS  ⑥ 기존 현장 경로 회귀');
  console.log('PASS  ⑦ pageerror 0');
  console.log('\n전부 통과 (7건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

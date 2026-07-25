/* menu-integrity.e2e.js — 더보기 메뉴 무결성 회귀
   "버튼은 있는데 아무 일도 안 일어난다"·"이름과 다른 화면이 열린다" 부류를 막는다.
   실제 렌더되는 시트는 openMoreSheetV2(MORE_CATS 기반) — 평면형은 예외 시 폴백일 뿐이다.
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 700) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 실제로 각 액션을 '호출'해 보는 방식은 쓰지 않는다 —
  // openModal 등을 가로채면 그 뒤 DOM 조작이 터져 앱 버그처럼 보이는 가짜 오류가 난다.
  // 대신 핸들러 소스에 분기가 있는지 정확히 대조한다(부작용 0).
  const handlerSrc = () => page.evaluate(() => moreActionHandler.toString());
  const menuActs = () => page.evaluate(() => MORE_CATS.flatMap(c => c.items.map(i => i[0])));

  await test('★모든 메뉴 항목이 실제로 동작한다 — 핸들러 없는 항목 0', async () => {
    const [src, acts] = await Promise.all([handlerSrc(), menuActs()]);
    const dead = acts.filter(a => src.indexOf("a==='" + a + "'") === -1);
    assert(dead.length === 0, '눌러도 아무 일 없는 메뉴: ' + JSON.stringify(dead));
  });

  await test('★핸들러에 같은 액션 분기가 두 번 있으면 안 된다 (뒤 분기는 영원히 안 걸림)', async () => {
    const [src, acts] = await Promise.all([handlerSrc(), menuActs()]);
    const twice = [];
    [...new Set(acts)].forEach(a => {
      const n = src.split("a==='" + a + "'").length - 1;
      if (n > 1) twice.push(a + '×' + n);
    });
    // 분기가 둘이면 JS는 첫 번째에서 멈춘다 → 두 번째 기능은 영원히 도달 불가
    assert(twice.length === 0, '중복 분기(뒤쪽 죽음): ' + JSON.stringify(twice));
  });

  await test('★같은 액션이 메뉴에 두 번 실리지 않는다 (한쪽은 반드시 이름이 거짓말)', async () => {
    const acts = await menuActs();
    const seen = {}, dup = [];
    acts.forEach(a => { seen[a] = (seen[a] || 0) + 1; });
    Object.keys(seen).forEach(a => { if (seen[a] > 1) dup.push(a + '×' + seen[a]); });
    assert(dup.length === 0, '중복 노출된 액션: ' + JSON.stringify(dup));
  });

  await test('★핸들러에만 있고 메뉴에 없는 기능 없음 (만들어놓고 못 찾는 것 방지)', async () => {
    const [src, acts] = await Promise.all([handlerSrc(), menuActs()]);
    // "a==='" 는 5글자 → slice(5,-1) 이어야 액션명이 온전히 나온다
    const handled = [...new Set((src.match(/a===\'([^\']+)\'/g) || []).map(x => x.slice(5, -1)))];
    const orphan = handled.filter(a => acts.indexOf(a) === -1);
    assert(orphan.length === 0, '메뉴에서 찾을 수 없는 기능: ' + JSON.stringify(orphan));
  });

  await test('★전후 갤러리 / 전후 비교 카드 — 서로 다른 화면이 열린다', async () => {
    const r = await page.evaluate(() => {
      const hit = [];
      const origBA = window.beforeAfterGallery, origCmp = window.baCompareView;
      window.beforeAfterGallery = () => hit.push('gallery');
      window.baCompareView = () => hit.push('compare');
      moreActionHandler('bagallery');
      moreActionHandler('beforeafter');
      window.beforeAfterGallery = origBA; window.baCompareView = origCmp;
      return hit;
    });
    assert(r.indexOf('gallery') !== -1, "'전후 갤러리'가 갤러리를 열어야 함: " + JSON.stringify(r));
    assert(r.indexOf('compare') !== -1, "'전/후 비교 카드'가 비교 화면을 열어야 함: " + JSON.stringify(r));
  });

  await test('★연간 결산 / 연말 결산 — 각자 다른 화면', async () => {
    const r = await page.evaluate(() => {
      const hit = [];
      const a = window.annualReport, y = window.yearReport;
      window.annualReport = () => hit.push('annual');
      window.yearReport = () => hit.push('year');
      moreActionHandler('annual');
      moreActionHandler('yearreport');
      window.annualReport = a; window.yearReport = y;
      return hit;
    });
    assert(r.indexOf('annual') !== -1 && r.indexOf('year') !== -1, '두 결산이 각각 열려야 함: ' + JSON.stringify(r));
  });

  await test('접근성(화면 편하게)이 메뉴에서 찾을 수 있다', async () => {
    const found = await page.evaluate(() =>
      MORE_CATS.some(c => c.items.some(i => i[0] === 'a11y')));
    assert(found, '눈이 불편할 때 쓰는 기능은 메뉴에서 보여야 함(AI 비서로만 닿으면 못 찾음)');
  });

  await test('메뉴 시트가 실제로 V2로 열린다 (평면형은 폴백)', async () => {
    const o = await page.evaluate(() => {
      let v2 = false;
      const orig = window.openMoreSheetV2;
      window.openMoreSheetV2 = function () { v2 = true; return orig.apply(this, arguments); };
      openMoreSheet();
      window.openMoreSheetV2 = orig;
      const sheet = document.getElementById('moreSheet');
      const n = sheet ? sheet.querySelectorAll('[data-moreaction]').length : 0;
      ['moreSheet', 'moreBackdrop'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); });
      return { v2, n };
    });
    assert(o.v2, 'openMoreSheet 은 V2를 써야 함');
    assert(o.n > 50, '시트에 항목이 실제로 그려짐: ' + o.n);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== menu-integrity: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

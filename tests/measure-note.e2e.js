/* measure-note.e2e.js — 📐 실측 노트 (Playwright)

   2026-09-12 대표 지시 "위 내용 진행" 의 셋째 — 실측 때 방마다 한 번 넣어 두면 계산기가 그 값을 가져다 쓴다.
     ① 더보기 그룹·옛 시트·핸들러에 measure 가 있다(정적)
     ② 방을 넣으면 방마다 바닥·벽·둘레가 나오고 합계가 따라 움직인다
     ③ 값은 현장(state.projects[].measure)에 붙어 저장되고, 저장했다 불러와도 남는다 — 저장 키는 늘지 않는다
     ④ 방의 🧮 를 누르면 계산기가 그 방의 면적·둘레·천장고를 받는다(도배는 둘레·높이, 타일은 가로×세로)
     ⑤ ✕ 는 물어보고 지운다, 현장을 바꾸면 그 현장 실측이 나온다
     ⑥ 📋 복사 글에 방별 치수와 합계가 들어간다, pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(/\['measure','📐','실측 노트'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="measure"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='measure'\)\{return measureNote\(\);\}/.test(source), '① 핸들러가 measureNote 로 간다');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true, asked = [];
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.measureNote === 'function' && typeof window.hjMeasureRoom === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const sumText = () => page.evaluate(() => (document.querySelector('#mnSum') || {}).textContent || '');
  const rooms = () => page.evaluate(() => (state.projects.find(p => p.name === '평화로운아파트') || {}).measure || []);
  const fill = async (k, i, v) => { await page.fill('#modalRoot .mnIn[data-k="' + k + '"][data-i="' + i + '"]', v); };

  // 현장 둘 만들고 연다
  await page.evaluate(() => {
    state.projects = [{ name: '평화로운아파트', stage: 0, received: 0, phases: [], cost: {} }, { name: '유성빌라', stage: 0, received: 0, phases: [], cost: {} }];
    state.activeProject = '평화로운아파트';
    state.dirty = false;
    moreActionHandler('measure');
  });
  let t = await modalText();
  assert(/실측 노트 — 평화로운아파트/.test(t) && /아직 적은 방이 없습니다/.test(t), '① 활성 현장으로 열린다: ' + t.slice(0, 80));

  // ② 방을 넣으면 계산이 따라온다
  await page.click('#mnAdd');
  await fill('room', 0, '안방');
  await fill('w', 0, '3.6');
  await fill('h', 0, '3.4');
  await fill('hgt', 0, '2.3');
  await fill('open', 0, '2.5');
  let echo = await page.evaluate(() => document.querySelector('#modalRoot .mnEcho').textContent);
  // 3.6×3.4 = 12.24㎡(3.7평), 둘레 14m, 벽 14×2.3−2.5 = 29.7㎡
  assert(/바닥 12.24㎡ \(3.7평\)/.test(echo) && /벽 29.7㎡/.test(echo) && /둘레 14m/.test(echo), '② 방 계산: ' + echo);
  let sum = await sumText();
  assert(/12.24 ㎡/.test(sum) && /3.7 평/.test(sum) && /29.7 ㎡/.test(sum) && /14 m/.test(sum), '② 합계: ' + sum);
  await page.click('#mnAdd');
  await fill('room', 1, '거실');
  await fill('w', 1, '5');
  await fill('h', 1, '4');
  await fill('hgt', 1, '2.3');
  sum = await sumText();
  // 12.24 + 20 = 32.24㎡, 벽 29.7 + (18×2.3=41.4) = 71.1㎡, 둘레 14+18 = 32m
  assert(/32.24 ㎡/.test(sum) && /71.1 ㎡/.test(sum) && /32 m/.test(sum), '② 두 방 합계: ' + sum);

  // ③ 현장에 붙어 저장된다 — 저장 키는 늘지 않는다
  let saved = await rooms();
  assert(saved.length === 2 && saved[0].room === '안방' && saved[0].w === '3.6' && saved[1].room === '거실' && saved[0].id, '③ 현장에 붙는다: ' + JSON.stringify(saved));
  assert((await page.evaluate(() => state.dirty)) === true, '③ 저장 대기 표시(markDirty)');
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /measure/i.test(k)), '③ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const roundTrip = await page.evaluate(() => {
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.projects = [];   // 다 지우고 되살린다
    applyData(snap);
    const p = state.projects.find(x => x.name === '평화로운아파트');
    return { n: (p.measure || []).length, first: (p.measure || [])[0] };
  });
  assert(roundTrip.n === 2 && roundTrip.first.room === '안방' && roundTrip.first.w === '3.6', '③ 저장했다 불러와도 남는다: ' + JSON.stringify(roundTrip));

  // ④ 방 → 계산기
  await page.evaluate(() => measureNote('평화로운아파트'));
  await page.click('#modalRoot .mnCalc[data-i="0"]');
  assert(/자재 계산기/.test(await modalText()), '④ 계산기 그리드가 열린다');
  await page.click('#modalRoot .calcCat[data-id="paper"]');
  let ins = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot .calcIn')].map(i => [i.dataset.k, i.value])));
  assert(ins.peri === '14' && ins.hgt === '2.3' && ins.open === '2.5', '④ 도배는 둘레·천장고·창문을 받는다: ' + JSON.stringify(ins));
  assert(/롤/.test(await page.evaluate(() => document.querySelector('#calcOut').textContent)), '④ 받자마자 결과가 나온다');
  await page.evaluate(() => measureNote('평화로운아파트'));
  await page.click('#modalRoot .mnCalc[data-i="1"]');
  await page.click('#modalRoot .calcCat[data-id="tile"]');
  ins = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot .calcIn')].map(i => [i.dataset.k, i.value])));
  assert(ins.m2_w === '5' && ins.m2_h === '4', '④ 타일은 가로×세로로 받는다: ' + JSON.stringify(ins));
  assert(/장/.test(await page.evaluate(() => document.querySelector('#calcOut').textContent)), '④ 타일도 바로 계산');
  // 한 번 쓰고 나면 다음 계산에는 따라붙지 않는다
  await page.evaluate(() => { window.__hjCalcMem.mortar = {}; materialCalc('mortar'); });
  ins = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot .calcIn')].map(i => [i.dataset.k, i.value])));
  assert(!ins.m2 && !ins.m2_w, '④ 실측값은 한 번만 들어간다: ' + JSON.stringify(ins));

  // ⑤ 지우기·현장 바꾸기
  await page.evaluate(() => measureNote('평화로운아파트'));
  asked = []; sayYes = false;
  await page.click('#modalRoot .mnDel[data-i="1"]');
  assert(asked.length === 1 && /거실/.test(asked[0]) && (await rooms()).length === 2, '⑤ 취소하면 그대로: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#modalRoot .mnDel[data-i="1"]');
  assert((await rooms()).length === 1 && (await page.evaluate(() => document.querySelectorAll('#modalRoot .mnRow').length)) === 1, '⑤ 확인하면 지운다');
  await page.selectOption('#mnProj', '유성빌라');
  t = await modalText();
  assert(/실측 노트 — 유성빌라/.test(t) && /아직 적은 방이 없습니다/.test(t), '⑤ 현장을 바꾸면 그 현장 실측: ' + t.slice(0, 60));
  await page.selectOption('#mnProj', '평화로운아파트');
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .mnRow').length)) === 1, '⑤ 돌아오면 그대로');

  // ⑥ 복사 글
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#modalRoot .mfoot button:has-text("복사")');
  await page.waitForFunction(() => !!window.__copied);
  const copied = await page.evaluate(() => window.__copied);
  assert(/^📐 평화로운아파트 실측/.test(copied) && /안방 3.6×3.4m/.test(copied) && /바닥 12.24㎡/.test(copied) && /합계 바닥 12.24㎡ \(3.7평\)/.test(copied) && /※ 실측값/.test(copied), '⑥ 복사 글: ' + copied);
  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('measure-note.e2e OK (① 메뉴 ② 방·합계 계산 ③ 현장 저장·왕복 ④ 계산기로 넘김 ⑤ 지우기·현장 전환 ⑥ 복사)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

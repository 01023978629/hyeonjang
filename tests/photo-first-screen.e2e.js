/* photo-first-screen.e2e.js — 폰에서 사진 탭 첫 화면에 사진이 보이는가 (Playwright)

   보호하는 사고: 사진 탭의 주업무는 '새 사진을 현장에 배정'인데, 안내문(86px)+
   도구 두 줄(225px)+공정바(154px)가 폰 첫 화면을 다 차지해 **사진이 한 장도
   안 보였다**(2026-08 종합평가, 실측 첫 썸네일 y=926 > 화면 844).
   좁은 화면(≤720px)에서는 보조 도구·공정바를 접고, 펼침 버튼으로 연다.

     ① 폰(390×844): 첫 번째 사진 썸네일이 y≤650 에서 보인다 (압축 후 실측 609,
        압축 전 926 — 접힌 블록 하나만 되살아나도 +86px 이상이라 650을 넘는다)
     ② 폰: 핵심 도구(올리기·불러오기·선택 모드)는 접지 않고 바로 보인다
     ③ 폰: '더보기'를 누르면 묶음발송 등 보조 도구가 나타난다
     ④ 폰: '공정 관리'를 누르면 공정 추가 UI가 나타난다
     ⑤ 데스크톱(1200px): 종전 그대로 — 안내문·묶음발송·공정바 즉시 표시
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const PX = 'data:image/png;base64,iVBORw0KGgoAAAABAAAAAQAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.replace('AAAABAAAAAQAAAAfFcSJ', 'AAAAEAAAABCAYAAAAfFcSJ');

async function boot(vw, vh) {
  const p = await browser.newPage({ viewport: { width: vw, height: vh }, serviceWorkers: 'block' });
  p.setDefaultTimeout(9000);
  p.__errs = [];
  p.on('pageerror', e => p.__errs.push(String(e)));
  await p.route('https://**/*', route => route.abort());
  await p.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate((px) => {
    const d = s => new Date(s);
    state.projects = [{ name: '측정현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    state.files = Array.from({ length: 8 }, (_, i) => ({ id: 'ph' + i, name: 'p' + i + '.jpg', ext: 'jpg', kind: 'photo', project: i < 4 ? null : '측정현장', when: d('2026-08-' + (10 + i) + 'T09:00:00'), thumb: px }));
    state.tab = 'photos'; state.activeProject = null; state.search = '';
    if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    render();
  }, PX);
  await p.waitForTimeout(600);
  return p;
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  // ── 폰 ──
  const m = await boot(390, 844);
  const r1 = await m.evaluate(() => {
    const thumb = document.querySelector('.cluster img');
    const vis = id => { const e = document.getElementById(id); return !!(e && e.offsetParent !== null); };
    return {
      thumbTop: thumb ? Math.round(thumb.getBoundingClientRect().top) : 9999,
      core: vis('btnGdPhotos') && vis('btnGdLoad') && vis('btnSelMode'),
      moreBtn: vis('btnPhotoMore'), bundle: vis('btnPhotoBundle'),
      phaseAdd: vis('phaseProjAdd'), phaseToggle: vis('btnPhaseBarToggle')
    };
  });
  assert(r1.thumbTop <= 650, '① 폰 첫 화면에 사진이 안 보인다 — 첫 썸네일 y=' + r1.thumbTop + ' (기준 650, 압축 전 926)');
  assert(r1.core, '② 핵심 도구(올리기·불러오기·선택 모드)가 첫 화면에 없다');
  assert(r1.moreBtn && !r1.bundle, '③ 보조 도구가 접혀 있지 않다(묶음발송 보임=' + r1.bundle + ')');
  assert(!r1.phaseAdd && r1.phaseToggle, '④ 공정바가 접혀 있지 않다(공정추가 보임=' + r1.phaseAdd + ')');

  await m.click('#btnPhotoMore'); await m.waitForTimeout(400);
  assert(await m.evaluate(() => { const e = document.getElementById('btnPhotoBundle'); return !!(e && e.offsetParent !== null); }),
    '③ 더보기를 눌러도 묶음발송이 안 나타난다');
  await m.click('#btnPhaseBarToggle'); await m.waitForTimeout(400);
  assert(await m.evaluate(() => { const e = document.getElementById('phaseProjAdd'); return !!(e && e.offsetParent !== null); }),
    '④ 공정 관리를 눌러도 공정 추가 UI가 안 나타난다');
  const mErrs = m.__errs.slice();
  await m.close();

  // ── 데스크톱: 종전 그대로 ──
  const d = await boot(1200, 900);
  const r2 = await d.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!(e && e.offsetParent !== null); };
    return {
      hint: /현장을 아직 안 정한 묶음이 맨 위/.test(document.getElementById('view').textContent),
      bundle: vis('btnPhotoBundle'), phaseAdd: vis('phaseProjAdd'),
      moreBtn: !!document.getElementById('btnPhotoMore'), phaseToggle: !!document.getElementById('btnPhaseBarToggle')
    };
  });
  assert(r2.hint && r2.bundle && r2.phaseAdd, '⑤ 데스크톱에서 안내문·묶음발송·공정바가 즉시 안 보인다: ' + JSON.stringify(r2));
  assert(!r2.moreBtn && !r2.phaseToggle, '⑤ 데스크톱에 접기 버튼이 생겼다 — 넓은 화면은 종전 그대로여야 한다');
  const dErrs = d.__errs.slice();
  await d.close();

  assert(mErrs.length === 0 && dErrs.length === 0, '⑥ pageerror: ' + mErrs.concat(dErrs).join(' | '));

  console.log('PASS  ① 폰 첫 화면에 사진 보임 (첫 썸네일 y≤650)');
  console.log('PASS  ② 핵심 도구는 접지 않음');
  console.log('PASS  ③ 보조 도구 접기/펼치기');
  console.log('PASS  ④ 공정바 접기/펼치기');
  console.log('PASS  ⑤ 데스크톱 종전 그대로');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

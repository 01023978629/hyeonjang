/* site-zip.e2e.js — 현장별 정리 ZIP 내려받기(exportSiteZip) 회귀
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   확인: 현장/종류/공정 폴더 경로·원본(_file/Drive)·썸네일 폴백(저화질)·_미배정·요약 파일·
        메타만 있는 가상레코드 제외. JSZip은 스텁으로 주입(네트워크 불요). */
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

  await test('현장별 정리 ZIP — 폴더 경로·원본/저화질/제외·요약', async () => {
    const out = await page.evaluate(async () => {
      // JSZip 스텁: file(path,bytes) 기록, generateAsync는 작은 Blob
      const calls = [];
      window.JSZip = function () {
        return {
          file: function (p, b) { calls.push({ path: p, bytes: (b && b.length) || (typeof b === 'string' ? b.length : 0), str: (typeof b === 'string') }); },
          generateAsync: async function () { return new Blob(['zip']); }
        };
      };
      // 다운로드 가로채기(공유 미지원 경로 강제)
      const origCanShare = navigator.canShare; try { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); } catch (e) {}
      const clicked = []; const origCreate = document.createElement.bind(document);
      document.createElement = function (t) { const el = origCreate(t); if (t === 'a') { el.click = function () { clicked.push(el.download); }; } return el; };
      const origURL = URL.createObjectURL; URL.createObjectURL = () => 'blob:stub';

      // Drive 원본 경로 스텁: relayReady=true, download는 8바이트 원본 반환
      window.relayReady = () => true;
      window.relayDownloadOriginal = async (id) => ({ name: 'drv', mime: 'image/jpeg', bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) });

      const png = 'data:image/jpeg;base64,/9j/4AAQ';   // 짧은 더미 원본(썸네일 폴백용)
      state.projects = [{ name: '괴산현장', stage: 2, phases: ['철거'], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
      state.files = [
        { id: 'a', kind: 'photo', project: '괴산현장', _phase: '철거', name: 'wall.jpg', thumb: png, when: new Date('2025-03-10') }, // 로컬 썸네일→저화질
        { id: 'b', kind: 'photo', project: '괴산현장', name: 'floor.jpg', _driveId: 'DRIVEID12345', when: new Date('2025-03-11') }, // Drive 원본
        { id: 'c', kind: 'estimate', project: '괴산현장', name: 'quote.pdf', thumb: png, when: new Date('2025-03-05') }, // 견적
        { id: 'd', kind: 'photo', project: '', name: 'loose.jpg', thumb: png, when: null }, // 미배정
        { id: 'e', kind: 'photo', project: '괴산현장', name: 'ghost.jpg', when: new Date() } // 메타만(제외)
      ];

      await exportSiteZip();

      try { if (origCanShare) Object.defineProperty(navigator, 'canShare', { value: origCanShare, configurable: true }); } catch (e) {}
      document.createElement = origCreate; URL.createObjectURL = origURL;
      return { paths: calls.map(c => c.path), clicked, summary: calls.find(c => c.path === '_요약.txt') };
    });

    const P = out.paths;
    assert(P.includes('괴산현장/사진/철거/20250310_wall.jpg'), '공정 하위 폴더 경로: ' + JSON.stringify(P));
    assert(P.includes('괴산현장/사진/20250311_floor.jpg'), 'Drive 원본 사진 경로(공정 없음): ' + JSON.stringify(P));
    assert(P.includes('괴산현장/견적/20250305_quote.pdf'), '견적 폴더 경로: ' + JSON.stringify(P));
    assert(P.includes('_미배정/사진/loose.jpg'), '미배정 폴더 경로(날짜 없음): ' + JSON.stringify(P));
    assert(!P.some(p => /ghost\.jpg/.test(p)), '메타만 있는 레코드는 제외: ' + JSON.stringify(P));
    assert(P.includes('_요약.txt'), '요약 파일 포함: ' + JSON.stringify(P));
    assert(out.summary && out.summary.str, '요약은 텍스트로 기록');
    assert(out.clicked.length === 1 && /만물인테리어_현장정리_\d{8}\.zip/.test(out.clicked[0]), '다운로드 파일명: ' + JSON.stringify(out.clicked));
  });

  await test('빈 상태 — 내려받을 파일 없으면 안전 종료(크래시 없음)', async () => {
    const ok = await page.evaluate(async () => {
      window.JSZip = function () { return { file() {}, generateAsync: async () => new Blob(['z']) }; };
      state.files = [{ id: 'x', kind: 'photo', project: '괴산현장', name: 'meta.jpg', when: new Date() }]; // 원본 없음
      let threw = false; try { await exportSiteZip(); } catch (e) { threw = true; }
      return !threw;
    });
    assert(ok, '원본 없는 파일만 있어도 예외 없이 종료');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== site-zip: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

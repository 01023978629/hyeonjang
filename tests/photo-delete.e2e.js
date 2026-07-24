/* photo-delete.e2e.js — 선택 사진 여러 장 삭제(bulkDelete) 회귀
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   확인: 선택 삭제 버튼·확인 모달(장수+‘사진 연결’ 경고)·삭제 전 강제 스냅샷·목록 제거. */
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

  await test('선택 사진 여러 장 삭제 — 확인 모달·강제 스냅샷·목록 제거, 미선택은 보존', async () => {
    // 시드: 사진 4장(2장 미리보기 있음 / 2장 ‘사진 연결’ 상태=thumb·driveId 없음) + 스냅샷 저장용 프로젝트
    await page.evaluate(() => {
      state.projects = [{ name: '괴산현장', stage: 2, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
      state.files = [
        { id: 'p1', kind: 'photo', project: '괴산현장', name: 'a.jpg', thumb: 'data:image/gif;base64,R0lGOD', when: new Date() },
        { id: 'p2', kind: 'photo', project: '', name: 'b.jpg', when: new Date() },              // 사진 연결(원본 없음)
        { id: 'p3', kind: 'photo', project: '', name: 'c.jpg', when: new Date() },              // 사진 연결
        { id: 'p4', kind: 'photo', project: '괴산현장', name: 'd.jpg', thumb: 'data:image/gif;base64,R0lGOD', when: new Date() }
      ];
      // 선택: p1(미리보기)·p2·p3(사진 연결) 3장
      toggleSel('p1'); toggleSel('p2'); toggleSel('p3');
    });
    const selN = await page.evaluate(() => selFiles().filter(f => f.kind === 'photo').length);
    assert(selN === 3, '3장 선택됨: ' + selN);

    // 삭제 모달 열기
    const modal = await page.evaluate(async () => {
      const before = ((await idbGet('hj_snaps')) || []).length;
      deleteSelectedPhotos();
      const foot = document.querySelector('#modalRoot .mfoot');
      const body = document.querySelector('#modalRoot .mbody');
      return { snapBefore: before, hasModal: !!foot, warnBtn: !!(foot && foot.querySelector('button.warn')), text: body ? body.textContent : '' };
    });
    assert(modal.hasModal && modal.warnBtn, '삭제 확인 모달+삭제 버튼 존재');
    assert(/3장/.test(modal.text), '모달에 3장 표기: ' + modal.text.slice(0, 60));
    assert(/2장은 미리보기가 없는/.test(modal.text), "‘사진 연결’ 2장 경고 표기");

    // 삭제 실행(모달 warn 버튼 클릭)
    await page.click('#modalRoot .mfoot button.warn');
    await page.waitForTimeout(400);
    const after = await page.evaluate(async () => ({
      ids: state.files.map(f => f.id),
      snaps: ((await idbGet('hj_snaps')) || []).length,
      selN: (typeof selFiles === 'function' ? selFiles().length : -1)
    }));
    assert(JSON.stringify(after.ids) === JSON.stringify(['p4']), '선택 3장 삭제·미선택 p4만 남음: ' + JSON.stringify(after.ids));
    assert(after.snaps >= modal.snapBefore + 1, '삭제 전 강제 스냅샷 생성: ' + modal.snapBefore + '→' + after.snaps);
    assert(after.selN === 0, '선택 해제됨: ' + after.selN);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== photo-delete: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

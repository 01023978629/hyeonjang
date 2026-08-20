/* phase-folder-matching.e2e.js — _정리완료 폴더·작업명 공정 복구 회귀검사

   ① 재스캔 백업이 실제 메모리 필드 _phase 를 보존
   ② _정리완료/현장/공정/ 경로에서 공정 자동 복구
   ③ _정리완료/현장/현장사진/ + 작업명도 공정으로 승격
   ④ 과거 폴더 별칭은 저장된 정식 현장명으로 복구
   ⑤ 견적서 같은 종류 폴더는 공정으로 오인하지 않음
   ⑥ 직렬화 결과에도 복구 공정이 저장됨

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
  const page = await browser.newPage({ serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const got = await page.evaluate(() => {
    state.projects = [
      { name: '가온마을', stage: 2, received: 0, phases: [], cost: {}, customer: {} },
      { name: '삼성아파트', stage: 2, received: 0, phases: [], cost: {}, customer: {} }
    ];
    state.files = [
      { id: 'old-good', name: 'old-good.jpg', prefix: '_정리완료/세종 가온마을/현장사진/', kind: 'photo', project: '가온마을', _phase: '1차 방수', _worklabel: '1차 방수' },
      { id: 'old-orphan', name: 'old-orphan.jpg', prefix: '_정리완료/세종 가온마을/현장사진/', kind: 'photo', project: '세종 가온마을', _worklabel: '배관 보강' }
    ];
    backupUserEdits();

    const restored = { name: 'old-good.jpg', prefix: '_정리완료/세종 가온마을/현장사진/', kind: 'photo', project: null };
    restoreUserEdits(restored);

    const folderPhase = { name: 'new.jpg', prefix: '_정리완료/세종 가온마을/2차 방수 작업/', kind: 'photo', project: null };
    recoverOrganizedMetadata(folderPhase);

    const workPhase = { name: 'work.jpg', prefix: '_정리완료/삼성아파트/현장사진/', kind: 'photo', project: '삼성아파트', _worklabel: '배관 교체' };
    recoverOrganizedMetadata(workPhase);

    const orphan = { name: 'old-orphan.jpg', prefix: '_정리완료/세종 가온마을/현장사진/', kind: 'photo', project: null };
    restoreUserEdits(orphan);
    recoverOrganizedMetadata(orphan);

    const estimate = { name: 'q.xlsx', prefix: '_정리완료/가온마을/견적서/', kind: 'estimate', project: '가온마을' };
    recoverOrganizedMetadata(estimate);

    state.files = [restored, folderPhase, workPhase, orphan, estimate];
    const saved = serializeData();
    return {
      restoredPhase: restored._phase,
      folderProject: folderPhase.project,
      folderPhase: folderPhase._phase,
      workPhase: workPhase._phase,
      orphanProject: orphan.project,
      madeOrphanProject: state.projects.some(p => p.name === '세종 가온마을'),
      estimatePhase: estimate._phase || null,
      gaonPhases: state.projects.find(p => p.name === '가온마을').phases,
      samsungPhases: state.projects.find(p => p.name === '삼성아파트').phases,
      savedPhases: saved.files.map(f => f.phase)
    };
  });

  assert(got.restoredPhase === '1차 방수', '① 재스캔 백업이 _phase를 복원하지 못했다: ' + JSON.stringify(got));
  assert(got.folderProject === '가온마을' && got.folderPhase === '2차 방수 작업', '② 폴더 공정 복구 실패: ' + JSON.stringify(got));
  assert(got.workPhase === '배관 교체', '③ 작업명 공정 승격 실패: ' + JSON.stringify(got));
  assert(got.orphanProject === '가온마을' && !got.madeOrphanProject, '④ 폴더 별칭이 정식 현장으로 복구되지 않았다: ' + JSON.stringify(got));
  assert(got.estimatePhase === null, '⑤ 견적서 폴더를 공정으로 오인했다: ' + JSON.stringify(got));
  assert(got.gaonPhases.includes('2차 방수 작업') && got.samsungPhases.includes('배관 교체'), '공정 목록 등록 실패: ' + JSON.stringify(got));
  assert(got.savedPhases.includes('1차 방수') && got.savedPhases.includes('2차 방수 작업') && got.savedPhases.includes('배관 교체'), '⑥ 직렬화 공정 저장 실패: ' + JSON.stringify(got));
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  재스캔 _phase 보존');
  console.log('PASS  정리 폴더 공정 자동 복구');
  console.log('PASS  작업명 공정 승격');
  console.log('PASS  폴더 별칭 정식 현장 복구');
  console.log('PASS  종류 폴더 공정 오인 방지');
  console.log('PASS  직렬화 공정 저장');
  console.log('PASS  pageerror 0');
  console.log('\n전부 통과 (7건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

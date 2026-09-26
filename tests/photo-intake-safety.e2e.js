/* photo-intake-safety.e2e.js — 사진 유입 경로의 기록 섞임·유실 5건 (Playwright)

   2026-09-26 v330 발굴 검토에서 살아남은 결함들. 모두 '이름이 같다'는 것만으로 다른 현장의 사진 기록을
   가져가거나, 성공한 결과를 버리거나, 지운 현장을 되살리던 것이다. 지키는 것:
     ① 서버 사진 목록 합치기(relayLoadDriveFiles): 같은 이름(image.jpg)의 Drive ID 없는 B현장 기록이 A현장 Drive 사진을
        가져가지 않고, A현장 기록(공정·작업명)이 '중복'으로 지워지지 않는다. 이름 후보가 둘 이상이면 고르지 않는다.
        이 기기에 원본이 있는 기록은 크기가 맞아야 잇는다. 전송 대기열에 참조가 있는 기록은 잇지 않는다.
        예전 복구(원본 없는 기록 하나 ↔ 서버 사진 하나)는 그대로 된다.
     ② applyData 이름 폴백: 새로 찍은 B현장 image.jpg 가 같은 이름의 A현장 저장 기록으로 덮이지 않는다(병합·되돌리기).
        되돌리기는 스냅샷에 없던 새 사진을 지운다. 폴더만 옮겨진 같은 크기 사진은 예전처럼 이어진다.
     ③ 전송 대기로 넣은 사진: 대기열 항목이 기록 참조('k:'+fileKey)를 기억하고, 나중에 업로드가 성공하면 그 기록에
        Drive ID 가 붙는다(새로고침으로 기록 객체가 바뀌어도). 동·호수 지정 사진이 빈 기록 + 미배정 사본으로 갈라지지 않는다.
        ③-2(v331) 업로드는 성공했는데 기록에 못 붙인 때(뒤처진 탭·기록이 아직 없음·같은 기록이 둘) Drive ID 를 버리지 않고
        '기록 연결 대기'(action 'link')로 남겨 다음 비우기·서버 목록 합치기가 붙인다. 뒤처진 탭은 Drive ID 를 쓰지 않는다.
        서버 사본이 원본보다 크면 잇지 않는다(①의 가드).
     ④ 📷 촬영으로 찍은 동영상: '읽기 실패'로 버려지지 않고 앱 목록에 들어가며, 결과 화면이 동영상을 따로 알리고
        [🎬 원본 관리]로 가는 길을 준다. 서버 중계로는 보내지 않는다.
     ⑤ _정리완료/<현장>/ 사진이 있는 현장을 지운 뒤 PC 스캔(scanDir)이 그 현장을 되살리거나 사진을 다시 붙이지 않고,
        미배정으로 두었다고 알린다. 처음 보는 정리 폴더(저장 기록 없음)는 예전처럼 현장을 만든다.

   전제: tests/static-server.js(8299) 실행 중. 모든 서버·폴더는 가짜(스텁·합성 핸들)다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await context.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone].filter(Boolean));
    // 부팅 시더를 재운다 — 시나리오 한복판에 자료를 심지 않게
    taxCalendarEnsure(); coworkSchedEnsure(); try { aiOpsEnsureState().enabled = false; } catch (e) {}
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); try { return o(m); } catch (e) {} };
    const P = name => ({ name, archived: false, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    window.__P = P;
    window.__reset = (projects) => {
      state.projects = (projects || ['A현장', 'B현장']).map(P); state.files = []; state.activeProject = null;
      state._demo = false; __tabStale = false; __removedIds.clear && __removedIds.clear(); window.__toasts = [];
      if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    };
  });
  let passed = 0;
  const ok = (m) => { passed++; console.log('PASS  ' + m); };

  // ─── ① 서버 사진 목록 합치기 ───
  const r1 = await page.evaluate(async () => {
    const out = {};
    const origList = window.cloudApiListFiles;
    await idbSet('relay_queue', []);
    const run = async (files, list) => {
      __reset(); state.files = files; window.cloudApiListFiles = async () => ({ ok: true, files: list });
      await relayLoadDriveFiles(true);
      return state.files.map(f => ({ id: f.id, p: f.project || null, ph: f._phase || null, w: f._worklabel || null, d: f._driveId || null, v: !!f._virtual }));
    };
    // (가) A현장 가상 기록이 DRV_A 를 가진 채 B현장의 같은 이름 빈 기록이 있다
    out.steal = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', _worklabel: 'B 오늘 찍은 것', size: 2222, _driveId: null },
      { id: 'a', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', _phase: '시공 전', _worklabel: 'A 철거 전', size: 111111, _driveId: 'DRV_A', _virtual: true }
    ], [{ id: 'DRV_A', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    // (가-2) 같은 상황에서 B 기록 크기를 모를 때(옛 기록) — 크기로도 못 거르니 'A 기록은 손댄 기록이라 합치지 않는다'만 남는다
    out.stealUnknown = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', size: 0, _driveId: null },
      { id: 'a', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', _phase: '시공 전', size: 111111, _driveId: 'DRV_A', _virtual: true }
    ], [{ id: 'DRV_A', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    // (나-2) 크기까지 서버 사본과 같은 후보가 둘 — 고르지 않는다
    out.sizedTwo = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', size: 90000 },
      { id: 'c', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', size: 90000 }
    ], [{ id: 'DRV_X', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    // (나) 아무 기록에도 안 붙은 서버 사진 + 이름 같은 빈 기록 둘 → 고르지 않는다(미배정 가상 사진으로 들어온다)
    out.ambiguous = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', size: 0 },
      { id: 'c', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', size: 0 }
    ], [{ id: 'DRV_X', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    // (다) 이 기기에 원본이 있는 기록(방금 찍은 것)은 크기가 안 맞으면 다른 사진이다
    out.local = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', size: 100000, _file: new Blob(['x']) }
    ], [{ id: 'DRV_X', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    // (라) 전송 대기열에 참조가 있는 기록은 이름으로 잇지 않는다(올라가면 대기열이 직접 붙인다)
    await idbSet('relay_queue', [{ id: 'q1', action: 'upload', payload: { name: 'image.jpg' }, ref: 'k:image.jpg|0', createdAt: Date.now(), retryCount: 0 }]);
    out.pending = await run([
      { id: 'b', name: 'image.jpg', ext: 'jpg', kind: 'photo', project: 'B현장', prefix: '', size: 0 }
    ], [{ id: 'DRV_X', name: 'image.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    await idbSet('relay_queue', []);
    // (마) 예전 복구 — 원본 없는 기록 하나 ↔ 서버 사진 하나 는 그대로 잇는다
    out.legacy = await run([
      { id: 'old', name: 'IMG_7777.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', size: 0, _virtual: true }
    ], [{ id: 'DRV_OLD', name: 'IMG_7777.jpg', mimeType: 'image/jpeg', size: 90000 }]);
    window.cloudApiListFiles = origList;
    return out;
  });
  assert(r1.steal.length === 2, '① A현장 기록이 지워지지 않는다: ' + JSON.stringify(r1.steal));
  const a1 = r1.steal.find(x => x.id === 'a'), b1 = r1.steal.find(x => x.id === 'b');
  assert(a1 && a1.p === 'A현장' && a1.ph === '시공 전' && a1.w === 'A 철거 전' && a1.d === 'DRV_A', '① A현장 기록(공정·작업명·Drive ID) 그대로: ' + JSON.stringify(r1.steal));
  assert(b1 && b1.p === 'B현장' && b1.d === null, '① B현장 기록이 A현장 Drive 사진을 가져가지 않는다: ' + JSON.stringify(r1.steal));
  assert(r1.stealUnknown.length === 2 && r1.stealUnknown.find(x => x.id === 'a').d === 'DRV_A' && r1.stealUnknown.find(x => x.id === 'b').d === null, '① 크기 모르는 B 기록도 A현장 기록을 지우지 않는다: ' + JSON.stringify(r1.stealUnknown));
  ok('① 같은 이름 빈 기록이 다른 현장 Drive 사진·기록을 가져가지 않는다');
  assert(['b', 'c'].every(id => r1.sizedTwo.find(x => x.id === id).d === null), '① 크기가 맞는 후보가 둘이면 고르지 않는다: ' + JSON.stringify(r1.sizedTwo));
  assert(r1.ambiguous.filter(x => x.d).length === 1 && r1.ambiguous.find(x => x.d === 'DRV_X' && x.p === null && x.v) && ['b', 'c'].every(id => r1.ambiguous.find(x => x.id === id).d === null),
    '① 이름 후보가 둘이면 고르지 않고 미배정 가상 사진으로: ' + JSON.stringify(r1.ambiguous));
  ok('① 모호하면 고르지 않는다');
  assert(r1.local.find(x => x.id === 'b').d === null && r1.local.some(x => x.d === 'DRV_X' && x.p === null), '① 이 기기에 원본이 있는 기록은 크기가 맞아야 잇는다: ' + JSON.stringify(r1.local));
  ok('① 원본이 있는 기록은 크기가 맞아야 잇는다');
  assert(r1.pending.find(x => x.id === 'b').d === null, '① 전송 대기 중인 기록은 이름으로 잇지 않는다: ' + JSON.stringify(r1.pending));
  ok('① 전송 대기 기록은 목록 합치기에서 뺀다');
  assert(r1.legacy.length === 1 && r1.legacy[0].id === 'old' && r1.legacy[0].d === 'DRV_OLD' && r1.legacy[0].p === 'A현장', '① 예전 복구(하나 ↔ 하나)는 그대로: ' + JSON.stringify(r1.legacy));
  ok('① 예전 복구 경로 유지');

  // ─── ② applyData 이름 폴백 ───
  const r2 = await page.evaluate(() => {
    const out = {};
    const view = () => state.files.map(f => ({ n: f.name, p: f.project || null, w: f._worklabel || null, ph: f._phase || null, d: f._driveId || null, size: f.size || 0, pre: f.prefix || '' }));
    const seedA = () => ({ id: 'a', name: 'image.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: 'A현장', _phase: '시공 전', _worklabel: 'A 욕실 철거 전', _driveId: 'DRV_A', size: 111111, _virtual: true });
    const seedB = () => ({ id: 'b', name: 'image.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: 'B현장', _worklabel: 'B 타일 완료', size: 1128, _file: new Blob(['b']) });
    for (const mode of ['merge', 'revert']) {
      __reset(); state.files = [seedA()];
      const before = JSON.parse(JSON.stringify(serializeData()));   // 사진 추가 전 자료
      state.files.push(seedB());
      applyData(before, mode === 'revert' ? { revert: true } : undefined);
      out[mode] = view();
    }
    // 같은 사진이 다른 폴더에도 한 장 더(같은 이름·크기) — A 저장 기록은 이미 A 로컬 기록에 쓰였으니 다시 쓰지 않는다
    __reset(); state.files = [seedA(), { id: 'dup', name: 'image.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', project: null, size: 111111, handle: {} }];
    { const before = JSON.parse(JSON.stringify(serializeData())); before.files = before.files.filter(f => f.prefix === ''); applyData(before); }
    out.usedTwice = view();
    // 미배정으로 찍은 새 사진(크기 1128) + A현장 옛 저장 기록(크기 111111, 이 기기엔 없음) — 병합도 크기가 다르면 잇지 않는다
    __reset(); state.files = [{ id: 'n', name: 'image.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: null, size: 1128, _file: new Blob(['n']) }];
    applyData({ files: [{ key: 'image.jpg|111111', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', phase: '시공 전', size: 111111, driveId: 'DRV_A' }] });
    out.mergeSize = view();
    // 미배정으로 찍은 새 사진 + 크기를 모르는 A현장 옛 저장 기록 — 되돌리기는 크기를 알고 같을 때만 이름으로 잇는다
    __reset(); state.files = [{ id: 'n', name: 'image.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: null, size: 1128, _file: new Blob(['n']) }];
    applyData({ files: [{ key: 'image.jpg|0', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', phase: '시공 전', size: 0, driveId: 'DRV_OLD0' }] }, { revert: true });
    out.revertUnknown = view();
    // 같은 크기지만 로컬 기록에 이미 다른 현장이 적혀 있다 — 이름 폴백으로 현장을 바꾸지 않는다
    __reset(); state.files = [{ id: 'q', name: 'IMG_2.jpg', prefix: '_정리완료/B현장/', ext: 'jpg', kind: 'photo', project: 'B현장', size: 500, handle: {} }];
    applyData({ files: [{ key: '현장사진/IMG_2.jpg|500', name: 'IMG_2.jpg', prefix: '현장사진/', kind: 'photo', project: 'A현장', phase: '방수', size: 500 }] });
    out.otherProject = view();
    // 폴더만 옮겨진 같은 크기 사진(PC 정리) — 이름 폴백이 이어 준다(병합·되돌리기 둘 다)
    for (const mode of ['moveMerge', 'moveRevert']) {
      __reset();
      state.files = [{ id: 'm', name: 'IMG_1.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', project: 'A현장', _phase: '방수', size: 500 }];
      const before = JSON.parse(JSON.stringify(serializeData()));
      state.files = [{ id: 'm2', name: 'IMG_1.jpg', prefix: '_정리완료/A현장/방수/', ext: 'jpg', kind: 'photo', project: null, size: 500, handle: {} }];
      applyData(before, mode === 'moveRevert' ? { revert: true } : undefined);
      out[mode] = view();
    }
    return out;
  });
  {
    const b = r2.merge.find(x => x.size === 1128), a = r2.merge.find(x => x.size === 111111);
    assert(r2.merge.length === 2 && b && b.p === 'B현장' && b.w === 'B 타일 완료' && b.ph === null && b.d === null, '② 병합: 새 B현장 사진이 A현장 기록으로 덮이지 않는다: ' + JSON.stringify(r2.merge));
    assert(a && a.p === 'A현장' && a.d === 'DRV_A', '② 병합: A현장 기록 그대로: ' + JSON.stringify(r2.merge));
    ok('② 병합 — 같은 이름 다른 현장 기록으로 덮지 않는다');
    assert(r2.revert.length === 1 && r2.revert[0].size === 111111 && r2.revert[0].p === 'A현장' && r2.revert[0].d === 'DRV_A', '② 되돌리기: 스냅샷에 없던 새 사진은 지워지고 A현장 사진으로 남지 않는다: ' + JSON.stringify(r2.revert));
    ok('② 되돌리기 — 새 사진을 A현장 사진으로 남기지 않는다');
    assert(r2.moveMerge.length === 1 && r2.moveMerge[0].p === 'A현장' && r2.moveMerge[0].ph === '방수' && r2.moveRevert.length === 1 && r2.moveRevert[0].p === 'A현장' && r2.moveRevert[0].pre.startsWith('_정리완료/'),
      '② 폴더만 옮겨진 같은 크기 사진은 이름 폴백으로 이어진다: ' + JSON.stringify([r2.moveMerge, r2.moveRevert]));
    ok('② 폴더 이동 사진 이어 주기는 유지');
    assert(r2.revertUnknown.length === 1 && r2.revertUnknown[0].size === 0 && r2.revertUnknown[0].p === 'A현장' && r2.revertUnknown[0].d === 'DRV_OLD0',
      '② 되돌리기: 크기를 모르는 같은 이름 기록에 새 사진을 잇지 않는다(새 사진은 지워지고 저장 기록은 따로): ' + JSON.stringify(r2.revertUnknown));
    ok('② 되돌리기 — 크기를 알고 같을 때만 이름으로 잇는다');
    const bq = r2.otherProject.find(x => x.pre.startsWith('_정리완료/'));
    assert(bq && bq.p === 'B현장' && bq.ph === null, '② 다른 현장이 적힌 로컬 기록은 이름 폴백으로 현장을 바꾸지 않는다: ' + JSON.stringify(r2.otherProject));
    ok('② 다른 현장 기록은 이름 폴백으로 바꾸지 않는다');
    const dup = r2.usedTwice.find(x => x.pre === '현장사진/');
    assert(dup && dup.p === null && dup.d === null && dup.ph === null, '② 이미 다른 로컬 기록에 쓰인 저장 기록을 이름으로 또 쓰지 않는다: ' + JSON.stringify(r2.usedTwice));
    const nw = r2.mergeSize.find(x => x.size === 1128);
    assert(nw && nw.p === null && nw.d === null && r2.mergeSize.some(x => x.size === 111111 && x.p === 'A현장'), '② 병합: 크기가 다른 같은 이름 저장 기록에 잇지 않는다: ' + JSON.stringify(r2.mergeSize));
    ok('② 쓰인 기록·크기 다른 기록은 이름 폴백에서 뺀다');
  }

  // ─── ③ 전송 대기 → 나중 성공 때 기록에 Drive ID ───
  const r3 = await page.evaluate(async () => {
    __reset(); await idbSet('relay_queue', []);
    const p = state.projects.find(x => x.name === 'A현장');
    p.aptUnits = [{ id: 'u1', dong: '107', ho: '1302' }];
    const origCall = window.relayCall, origReady = window.relayReady, origComp = window.relayCompressPhoto, origList = window.cloudApiListFiles;
    window.relayReady = () => true; window.relayCompressPhoto = async b => b;
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __relay.token = 'TEST-TOKEN';
    const file = new File([new Uint8Array(600)], 'image.jpg', { type: 'image/jpeg' });
    const rec = { id: 'r1', name: 'image.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: 'A현장', size: 600, _aptUnit: { project: 'A현장', unitId: 'u1' }, _file: file };
    state.files = [rec];
    window.relayCall = async () => { throw new TypeError('Failed to fetch'); };   // 오프라인
    const report = {};
    await relayUploadFiles([file], 'photo', [rec], report);
    const q = await idbGet('relay_queue');
    // 새로고침을 흉내 — 기록 객체·id 가 바뀌고 원본 바이트는 없다
    state.files = [{ ...rec, id: 'r1-after-reload', _file: null, _virtual: true }];
    window.relayCall = async (action) => action === 'upload' ? { ok: true, fileId: 'DRV_NEW_0', mimeType: 'image/jpeg', size: 480 } : { ok: false, error: 'x' };
    await cloudFlushQueue(true);
    const afterFlush = state.files.map(f => ({ id: f.id, d: f._driveId || null, u: f._aptUnit ? f._aptUnit.unitId : null, p: f.project, size: f._driveSize }));
    const stored = await idbGet('appState');
    const persisted = !!(stored && Array.isArray(stored.files) && stored.files.some(f => f.driveId === 'DRV_NEW_0'));
    const q2 = await idbGet('relay_queue');
    window.cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRV_NEW_0', name: 'image.jpg', mimeType: 'image/jpeg', size: 480 }] });
    await relayLoadDriveFiles(true);
    const afterList = state.files.map(f => ({ id: f.id, d: f._driveId || null, p: f.project || null }));
    window.relayCall = origCall; window.relayReady = origReady; window.relayCompressPhoto = origComp; window.cloudApiListFiles = origList;
    __relay.url = ''; __relay.token = '';
    // 같은 경로·이름·크기 기록이 둘이면 적어 둔 현장으로 가른다
    const twin = n => ({ id: 't' + n, name: 'dup.jpg', prefix: '', ext: 'jpg', kind: 'photo', project: n, size: 10 });
    state.files = [twin('A현장'), twin('B현장')];
    const twinLinked = relayQueueLinkUpload({ ref: 'k:dup.jpg|10', project: 'B현장', payload: {} }, { fileId: 'DRV_TWIN' });
    const twinView = state.files.map(f => [f.project, f._driveId || null]);
    return { persisted, twinLinked, twinView, report: { queued: report.queued, ok: report.ok }, q: (q || []).map(it => ({ action: it.action, ref: it.ref, project: it.project, payloadRef: 'ref' in (it.payload || {}) })), afterFlush, q2: (q2 || []).length, afterList, key: fileKey(rec) };
  });
  assert(r3.report.queued === 1 && r3.q.length === 1 && r3.q[0].action === 'upload' && r3.q[0].ref === 'k:' + r3.key && r3.q[0].project === 'A현장' && !r3.q[0].payloadRef,
    '③ 대기열 항목이 기록 참조를 기억한다(서버로 가는 payload 밖에): ' + JSON.stringify(r3));
  assert(r3.q2 === 0 && r3.afterFlush.length === 1 && r3.afterFlush[0].d === 'DRV_NEW_0' && r3.afterFlush[0].u === 'u1' && r3.afterFlush[0].size === 480,
    '③ 나중에 업로드가 성공하면 그 동·호수 기록에 Drive ID 가 붙는다: ' + JSON.stringify(r3));
  assert(r3.afterList.length === 1 && r3.afterList[0].d === 'DRV_NEW_0' && r3.afterList[0].p === 'A현장', '③ 서버 목록 합치기가 미배정 사본을 따로 만들지 않는다: ' + JSON.stringify(r3.afterList));
  assert(r3.persisted, '③ 붙인 Drive ID 가 이 기기 저장본에도 남는다');
  assert(r3.twinLinked === true && JSON.stringify(r3.twinView) === JSON.stringify([['A현장', null], ['B현장', 'DRV_TWIN']]), '③ 같은 경로 기록 둘은 적어 둔 현장으로 가른다: ' + JSON.stringify(r3));
  ok('③ 전송 대기 사진 — 성공 때 기록에 Drive ID, 갈라지지 않음');

  // ─── ③-2 (v331) 업로드는 성공했는데 기록에 못 붙인 때 — Drive ID 를 잃지 않고 '기록 연결 대기'로 남겨 나중에 붙인다 ───
  const r3b = await page.evaluate(async () => {
    const out = {};
    const origCall = window.relayCall, origReady = window.relayReady, origList = window.cloudApiListFiles;
    window.relayReady = () => true;
    const up = (id, name, size, project) => ({ id, action: 'upload', payload: { name, mimeType: 'image/jpeg', dataB64: 'QUJD' }, ref: 'k:' + name + '|' + size, project, createdAt: Date.now(), retryCount: 0 });
    const rec = (id, name, size, project) => ({ id, name, prefix: '', ext: 'jpg', kind: 'photo', project, size, _virtual: true });
    const qView = async () => ((await idbGet('relay_queue')) || []).map(it => ({ a: it.action, f: it.fileId || null, ref: it.ref, p: it.project, pl: !!it.payload }));
    const dView = () => state.files.map(f => ({ id: f.id, d: f._driveId || null, p: f.project || null, v: !!f._virtual }));
    let fid = '';
    window.relayCall = async (action) => action === 'upload' ? { ok: true, fileId: fid, mimeType: 'image/jpeg', size: 480 } : { ok: false, error: 'x' };
    // (가) 뒤처진 탭 — 업로드는 성공, 이 탭은 기록에 쓰지 않는다. 항목은 '기록 연결 대기'로 남고 전송 대기 건수에는 안 센다.
    __reset(); fid = 'DRV_STALE';
    state.files = [rec('s1', 'stale.jpg', 600, 'A현장')];
    await idbSet('relay_queue', [up('q-s', 'stale.jpg', 600, 'A현장')]);
    __tabStale = true;
    await cloudFlushQueue(true);
    out.staleFiles = dView(); out.staleQ = await qView(); out.staleQn = __relayQn;
    __tabStale = false;
    await cloudFlushQueue(false);   // 새 탭(뒤처지지 않은) 비우기가 붙인다 — 서버로 다시 보내지 않는다
    out.freshFiles = dView(); out.freshQ = await qView();
    // (나) 비우기 때 기록이 아직 없다(부팅 순서) — 남겨 두었다가 기록이 돌아오면 서버 목록 합치기가 붙인다. 미배정 사본을 만들지 않는다.
    __reset(); fid = 'DRV_LATE';
    state.files = [];
    await idbSet('relay_queue', [up('q-l', 'late.jpg', 700, 'A현장')]);
    await cloudFlushQueue(true);
    out.lateQ = await qView();
    state.files = [rec('l1', 'late.jpg', 700, 'A현장')];
    window.cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRV_LATE', name: 'late.jpg', mimeType: 'image/jpeg', size: 480 }] });
    await relayLoadDriveFiles(true);
    out.lateFiles = dView(); out.lateQ2 = await qView();
    // (다) 같은 경로·이름·크기·현장 기록이 둘(모호) — 고르지 않고 남긴다. 서버 목록에 있어도 사본을 만들지 않는다. 하나가 정리되면 붙는다.
    __reset(); fid = 'DRV_TWIN2';
    state.files = [rec('w1', 'twin.jpg', 800, 'A현장'), rec('w2', 'twin.jpg', 800, 'A현장')];
    await idbSet('relay_queue', [up('q-w', 'twin.jpg', 800, 'A현장')]);
    await cloudFlushQueue(true);
    window.cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRV_TWIN2', name: 'twin.jpg', mimeType: 'image/jpeg', size: 480 }] });
    await relayLoadDriveFiles(true);
    out.twinFiles = dView(); out.twinQ = await qView();
    state.files = state.files.filter(f => f.id !== 'w2');
    await cloudFlushQueue(false);
    out.twinFiles2 = dView(); out.twinQ2 = await qView();
    // (라) 오래된 연결 대기(놓아줄 때가 지난 것) — 비우기가 놓아주고, 서버 목록 합치기가 예전처럼 미배정으로 들인다
    __reset();
    await idbSet('relay_queue', [{ id: 'q-o', action: 'link', ref: 'k:gone.jpg|5', project: 'A현장', fileId: 'DRV_OLD_LINK', mimeType: 'image/jpeg', size: 480, createdAt: 1, linkAt: 1, retryCount: 0 }]);
    await cloudFlushQueue(false);
    out.oldQ = await qView();
    window.cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRV_OLD_LINK', name: 'gone.jpg', mimeType: 'image/jpeg', size: 480 }] });
    await relayLoadDriveFiles(true);
    out.oldFiles = dView();
    // (마) 서버 사본이 원본보다 크면(압축본이 원본보다 클 수 없다) 이름이 하나뿐이어도 잇지 않는다
    __reset(); await idbSet('relay_queue', []);
    state.files = [rec('z1', 'IMG_9.jpg', 1000, 'A현장')];
    window.cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRV_BIG', name: 'IMG_9.jpg', mimeType: 'image/jpeg', size: 90000 }] });
    await relayLoadDriveFiles(true);
    out.bigFiles = dView();
    // 같은 상황에서 서버 사본이 작으면 잇는다(검사가 눈멀지 않았는지)
    __reset(); state.files = [rec('z2', 'IMG_9.jpg', 100000, 'A현장')];
    await relayLoadDriveFiles(true);
    out.smallFiles = dView();
    window.relayCall = origCall; window.relayReady = origReady; window.cloudApiListFiles = origList;
    await idbSet('relay_queue', []);
    return out;
  });
  assert(r3b.staleFiles.length === 1 && r3b.staleFiles[0].d === null, '③-2 뒤처진 탭은 기록에 Drive ID 를 쓰지 않는다: ' + JSON.stringify(r3b.staleFiles));
  assert(r3b.staleQ.length === 1 && r3b.staleQ[0].a === 'link' && r3b.staleQ[0].f === 'DRV_STALE' && r3b.staleQ[0].ref === 'k:stale.jpg|600' && r3b.staleQ[0].p === 'A현장' && !r3b.staleQ[0].pl && r3b.staleQn === 0,
    '③-2 성공한 업로드의 Drive ID·참조·현장을 기록 연결 대기로 남긴다(원본 바이트 없이, 전송 대기 0건): ' + JSON.stringify(r3b));
  assert(r3b.freshFiles[0].d === 'DRV_STALE' && r3b.freshQ.length === 0, '③-2 새 탭 비우기가 그 기록에 붙이고 항목을 지운다: ' + JSON.stringify([r3b.freshFiles, r3b.freshQ]));
  ok('③-2 뒤처진 탭 — Drive ID 를 쓰지 않고 남겨 두었다가 붙인다');
  assert(r3b.lateQ.length === 1 && r3b.lateQ[0].a === 'link' && r3b.lateQ[0].f === 'DRV_LATE', '③-2 기록이 없을 때도 Drive ID 를 잃지 않는다: ' + JSON.stringify(r3b.lateQ));
  assert(r3b.lateFiles.length === 1 && r3b.lateFiles[0].id === 'l1' && r3b.lateFiles[0].d === 'DRV_LATE' && r3b.lateQ2.length === 0, '③-2 기록이 돌아오면 서버 목록 합치기가 그 기록에 붙인다(미배정 사본 없음): ' + JSON.stringify([r3b.lateFiles, r3b.lateQ2]));
  ok('③-2 기록이 아직 없던 업로드 — 나중에 그 기록에 붙는다');
  assert(r3b.twinFiles.length === 2 && r3b.twinFiles.every(x => x.d === null) && r3b.twinQ.length === 1 && r3b.twinQ[0].a === 'link', '③-2 모호하면 고르지 않고 사본도 만들지 않는다: ' + JSON.stringify([r3b.twinFiles, r3b.twinQ]));
  assert(r3b.twinFiles2.length === 1 && r3b.twinFiles2[0].d === 'DRV_TWIN2' && r3b.twinQ2.length === 0, '③-2 모호함이 풀리면 붙인다: ' + JSON.stringify([r3b.twinFiles2, r3b.twinQ2]));
  ok('③-2 모호한 연결 — 풀릴 때까지 기다린다');
  assert(r3b.oldQ.length === 0 && r3b.oldFiles.some(x => x.d === 'DRV_OLD_LINK' && x.p === null && x.v), '③-2 놓아줄 때가 지난 연결 대기는 지우고 미배정으로 들인다: ' + JSON.stringify([r3b.oldQ, r3b.oldFiles]));
  ok('③-2 오래된 연결 대기는 놓아준다');
  assert(r3b.bigFiles.find(x => x.id === 'z1').d === null && r3b.bigFiles.some(x => x.d === 'DRV_BIG' && x.p === null), '① 서버 사본이 원본보다 크면 잇지 않는다: ' + JSON.stringify(r3b.bigFiles));
  assert(r3b.smallFiles.length === 1 && r3b.smallFiles[0].d === 'DRV_BIG', '① 서버 사본이 작으면 잇는다(대조): ' + JSON.stringify(r3b.smallFiles));
  ok('① 압축본이 원본보다 크면 잇지 않는다');

  // ─── ④ 📷 촬영으로 찍은 동영상 ───
  await page.evaluate(() => {
    __reset(); state.activeProject = 'A현장'; state.tab = 'photos';
    window.__mobileMode = true; applyMobileMode(); render(); syncMobileNav();
    window.__relayCalls = []; const oc = window.relayCall; window.__origRelayCall = oc;
    window.relayCall = async (a, p) => { window.__relayCalls.push(a); throw new Error('서버 중계 호출 금지'); };
    // 서버 중계는 없고 구글 드라이브 로그인만 된 기기 — 사진 백업 경로도 동영상은 올리지 않는다
    window.__gdCalls = []; window.__origGdUpload = window.gdUploadBlob; __gdToken = 'TEST-GD-TOKEN';
    window.gdUploadBlob = async (blob, name) => { window.__gdCalls.push(name); return 'GD_' + window.__gdCalls.length; };
  });
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-mnav="__camera"]').click();
  const input = await chooser;
  assert(await input.element().getAttribute('capture') === 'environment', '④ 촬영 입력');
  await input.setFiles([{ name: '20260926_101010.mp4', mimeType: 'video/mp4', buffer: Buffer.from('synthetic-mp4-bytes') }, { name: 'shot.png', mimeType: 'image/png', buffer: PNG }]);
  await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
  await page.locator('#photoIntakeConfirm').click();
  await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !__photoIntakeBusy);
  const r4 = await page.evaluate(() => ({
    text: document.getElementById('photoIntakeResult').innerText,
    video: !!document.getElementById('photoIntakeVideo'),
    buttons: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()),
    files: state.files.map(f => ({ n: f.name, p: f.project, k: f.kind, vid: isVideoRec(f) })),
    relay: window.__relayCalls.slice(), gd: window.__gdCalls.slice()
  }));
  await page.evaluate(() => { window.relayCall = window.__origRelayCall; window.gdUploadBlob = window.__origGdUpload; __gdToken = null; });
  assert(JSON.stringify(r4.gd) === JSON.stringify(['shot.png']), '④ 드라이브 사진 백업은 사진만(동영상 제외): ' + JSON.stringify(r4.gd));
  assert(!/읽기 실패/.test(r4.text) && /앱 목록 추가 2장/.test(r4.text) && /동영상 1개/.test(r4.text), '④ 동영상이 읽기 실패로 버려지지 않는다: ' + JSON.stringify(r4));
  assert(r4.files.some(f => f.n === '20260926_101010.mp4' && f.p === 'A현장' && f.k === 'photo' && f.vid) && r4.files.some(f => f.n === 'shot.png' && f.p === 'A현장'), '④ 동영상·사진 모두 그 현장 목록에: ' + JSON.stringify(r4.files));
  assert(r4.video && /원본 관리/.test(r4.text) && /100MB/.test(r4.text) && /사진첩에 남지 않을 수/.test(r4.text), '④ 결과 화면이 동영상을 따로 알리고 원본 관리로 안내: ' + r4.text);
  assert(r4.buttons.some(b => /원본 관리/.test(b)), '④ [🎬 원본 관리] 버튼: ' + JSON.stringify(r4.buttons));
  assert(r4.relay.length === 0, '④ 서버 중계 호출 없음(연결 안 됨): ' + JSON.stringify(r4.relay));
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /원본 관리/.test(x.textContent)); b.click(); return !!document.querySelector('#modalRoot'); });
  assert(clicked, '④ 원본 관리 버튼이 동작한다');
  await page.evaluate(() => { try { closeModal(); } catch (e) {} });
  ok('④ 촬영 동영상 — 앱 목록에 넣고 원본 관리로 안내');

  // ─── ⑤ 정리 폴더 현장 삭제 뒤 PC 스캔 ───
  const r5 = await page.evaluate(async () => {
    const deny = () => { throw Error('fixture write prohibited'); };
    const fh = (name, body) => ({ kind: 'file', name, createWritable: deny, getFile: async () => new File([body], name, { lastModified: 1750000000000, type: 'image/png' }) });
    const dir = (name, entries) => ({ kind: 'directory', name, removeEntry: deny,
      async *entries() { for (const e of entries) yield [e.name, e]; },
      async getFileHandle(n, o) { if (o && o.create) deny(); const f = entries.find(e => e.name === n); if (!f) throw Error('not found'); return f; } });
    const origSnap = window.hjSnapshot;
    const run = async ({ stored, fresh }) => {
      __reset(['가상X', '이웃']); __lastData = null; __dataAt = ''; state._savedFileCount = 0;
      const pre = '_정리완료/가상X/현장사진/철거/';
      state.files = ['p1.png', 'p2.png'].map((n, i) => ({ id: 'o' + i, name: n, prefix: pre, ext: 'png', kind: 'photo', project: '가상X', _phase: '철거', size: 4 }));
      if (!fresh) {
        const r = hjDeleteProjectCore('가상X');
        if (!r) return { error: 'delete failed' };
      } else {
        state.projects = [__P('이웃')];   // 처음 보는 기기 — 저장 기록 없음
      }
      const saved = serializeData(); saved.savedAt = '2099-01-01T00:00:00Z';
      if (fresh) saved.files = [];
      if (stored || fresh) state.files = [];
      const entries = [dir('_정리완료', [dir('가상X', [dir('현장사진', [dir('철거', [fh('p1.png', 'AAAA'), fh('p2.png', 'BBBB')])])])])];
      if (stored || fresh) entries.push(fh('_현장.json', JSON.stringify(saved)));
      state.dirHandle = dir('만물', entries);
      window.__toasts = [];
      await scanDir();
      const res = { projects: state.projects.map(p => p.name), files: state.files.filter(f => /^p\d\.png$/.test(f.name)).map(f => f.project || null), toasts: window.__toasts.slice() };
      state.dirHandle = null;
      return res;
    };
    const out = {};
    out.session = await run({ stored: false });   // 같은 PC 세션에서 지우고 다시 스캔
    out.stored = await run({ stored: true });     // 새로 연결 — _현장.json 에만 기록이 있다
    out.fresh = await run({ fresh: true });       // 처음 보는 정리 폴더 — 예전처럼 현장을 만든다
    window.hjSnapshot = origSnap;
    return out;
  });
  for (const k of ['session', 'stored']) {
    const x = r5[k];
    assert(!x.error && !x.projects.includes('가상X') && x.files.length === 2 && x.files.every(p => p === null), '⑤ 지운 현장이 스캔으로 되살아나지 않고 사진은 미배정(' + k + '): ' + JSON.stringify(x));
    assert(x.toasts.some(t => /정리 폴더 사진 2장은 미배정 그대로/.test(t) && /가상X/.test(t)), '⑤ 미배정으로 두었다고 알린다(' + k + '): ' + JSON.stringify(x.toasts));
  }
  assert(r5.fresh.projects.includes('가상X') && r5.fresh.files.every(p => p === '가상X'), '⑤ 처음 보는 정리 폴더는 예전처럼 현장을 만든다: ' + JSON.stringify(r5.fresh));
  ok('⑤ 지운 현장의 정리 폴더가 스캔으로 되살아나지 않는다');

  assert(errors.length === 0, 'pageerror 0: ' + JSON.stringify(errors));
  console.log('\n== photo-intake-safety: ' + passed + ' passed, pageerrors=0 ==');
})().catch(e => { console.error('FAIL photo-intake-safety', e && e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

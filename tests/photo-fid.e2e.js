/* photo-fid.e2e.js — v333 사진·파일 기록의 고유 ID(fid) (Playwright)

   대표 요청(사진 배정·동기화 안정화): '같은 이름의 파일도 고유 ID로 구분'. fileKey 는 경로+이름|크기라 아이폰 카메라의
   image.jpg 처럼 이름·크기가 같은 두 장을 한 장으로 보았다 — 다시 불러오면 둘째 장이 '중복'으로 빠지고, 배정·참조가 섞였다.
   지키는 것:
     ① 같은 이름·같은 크기 두 사진이 서로 다른 fid 를 갖고, 저장 → 다시 불러오기(폰 가상 레코드) 뒤에도 둘 다 남아 제 현장·제 참조를 지킨다
     ② 옛 자료(fid 없음)는 처음 불러올 때 정해지는 fid 를 받는다 — 두 번(두 기기) 불러와도 같은 값, 같은 경로 두 기록도 서로 다르다.
        같은 fid 두 기록(복사본)은 둘째가 새 fid 를 받는다
     ③ 재스캔(같은 경로·크기·수정 시각)은 같은 fid 를 이어받고, 수정 시각이 다르면(다른 파일) 이어받지 않는다.
        PC 폴더 파일(handle)은 저장본과 경로로 짝지어 저장된 fid 를 이어받는다
     ④ 서버 병합: 다른 기기의 같은 이름·크기 사진(fid 다름)을 내 사진에 덮어쓰지 않고 따로 들인다, 같은 fid 는 그 기록에 합친다
     ⑤ 전송 대기열: 새 항목은 'f:'+fid 로 기억하고, 같은 경로 두 기록 중 그 기록에만 Drive ID 를 붙인다(옛 'k:' 는 모호하면 안 붙인다)
     ⑥ 서버 사진 목록 합치기: 전송 대기 중인('f:' 참조) 사진에는 이름·크기가 같은 서버 사진을 붙이지 않는다
     ⑦ 선택 복원: 같은 경로 두 기록이 백업의 제 기록(fid)으로 되돌아가고 fid 는 바뀌지 않는다
     ⑧ 최상위 키 41개 그대로 · pageerror 0
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.hjAssignFids === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    for (const k of ['taxCalendarEnsure', 'coworkSchedEnsure', 'backupBootCheck', 'kakaoCheckNew', 'cloudAutoSave']) if (typeof window[k] === 'function') window[k] = () => 0;
    state._demo = false; state.quotes = []; state.dirty = false;
    state.projects = ['A현장', 'B현장'].map(name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }));
    state.files = [];
  });

  // ── ① 같은 이름·같은 크기 두 사진 ─────────────────────────────────────────────────────
  const one = await page.evaluate(async () => {
    const mk = (b, t) => new File([new Uint8Array(100).fill(b)], 'image.jpg', { type: 'image/jpeg', lastModified: t });
    const r1 = await ingestFile(mk(1, Date.UTC(2026, 8, 1)), null, '', { restoreEdits: false });
    const r2 = await ingestFile(mk(2, Date.UTC(2026, 8, 2)), null, '', { restoreEdits: false });
    r1.kind = r2.kind = 'photo'; r1.project = 'A현장'; r2.project = 'B현장'; r1._worklabel = 'A 작업'; r2._worklabel = 'B 작업';
    const ref1 = hjFileRef(r1), ref2 = hjFileRef(r2);
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.files = [];
    applyData(snap);
    const imgs = state.files.filter(f => f.name === 'image.jpg');
    const by = ref => { const f = hjFilesByRefs([ref]).files[0]; return f ? [f.project, f._worklabel] : null; };
    return { fids: [r1.fid, r2.fid], keySame: fileKey(r1) === fileKey(r2), saved: snap.files.map(f => f.fid), refs: [ref1, ref2],
      after: imgs.map(f => [f.fid, f.project, f._worklabel]), res1: by(ref1), res2: by(ref2), refsAfter: imgs.map(hjFileRef) };
  });
  assert(one.keySame && one.fids.every(v => /^[0-9a-f-]{36}$/.test(v)) && one.fids[0] !== one.fids[1], '① 새 사진은 무작위 고유 ID, 같은 경로·이름·크기여도 서로 다르다: ' + JSON.stringify(one.fids));
  assert(JSON.stringify(one.saved) === JSON.stringify(one.fids), '① 저장 레코드에 fid 가 실린다: ' + JSON.stringify(one.saved));
  assert(one.refs[0] === 'f:' + one.fids[0] && one.refs[1] === 'f:' + one.fids[1], "① 참조는 'f:'+fid: " + JSON.stringify(one.refs));
  assert(one.after.length === 2 && JSON.stringify(one.after) === JSON.stringify([[one.fids[0], 'A현장', 'A 작업'], [one.fids[1], 'B현장', 'B 작업']]),
    '① 다시 불러온 뒤에도 두 장 다, 제 현장·작업명·fid 그대로(예전엔 둘째가 중복으로 빠졌다): ' + JSON.stringify(one.after));
  assert(JSON.stringify(one.res1) === JSON.stringify(['A현장', 'A 작업']) && JSON.stringify(one.res2) === JSON.stringify(['B현장', 'B 작업']) && JSON.stringify(one.refsAfter) === JSON.stringify(one.refs),
    '① 참조가 섞이지 않는다: ' + JSON.stringify(one));
  console.log('PASS  ① 같은 이름·같은 크기 두 사진 — 다른 fid, 다시 불러와도 둘 다·제 현장·제 참조');

  // ── ② 옛 자료 ─────────────────────────────────────────────────────────────────────
  const two = await page.evaluate(() => {
    const legacy = () => ({ version: 2, app: '현장', savedAt: '2026-09-01T00:00:00.000Z', quotes: [], files: [
      { key: '현장사진/x.jpg|10', name: 'x.jpg', prefix: '현장사진/', kind: 'photo', project: 'A현장', size: 10 },
      { key: 'image.jpg|50', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', size: 50 },
      { key: 'image.jpg|50', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', size: 50 },
      { key: 'd.jpg|70', name: 'd.jpg', prefix: '', kind: 'photo', project: 'B현장', size: 70, driveId: 'DRIVE-FAKE-D' }
    ] });
    const run = () => { state.files = []; applyData(legacy()); return state.files.map(f => f.fid); };
    const a = run(), b = run();
    const assigned = legacy().files; hjAssignFids(assigned, true);   // 붙이는 규칙 자체 — 같은 경로 두 기록도 서로 다른 값
    const ser = serializeData().files.map(f => f.fid);
    // 같은 fid 두 기록(복사본) — 둘째가 새 fid
    const c0 = state.files[0], copy = Object.assign({}, c0, { id: 'copy' });
    state.files.push(copy);
    const ser2 = serializeData().files.map(f => f.fid);
    state.files.pop();
    return { a, b, ser, ser2, c0: c0.fid, copyFid: copy.fid, assigned: assigned.map(f => f.fid) };
  });
  assert(two.assigned.length === 4 && two.assigned.every(v => /^lg-[0-9a-f]{16}$/.test(v)) && new Set(two.assigned).size === 4, '② 옛 자료 — 기록마다 다른 fid(같은 경로 두 기록 포함): ' + JSON.stringify(two.assigned));
  // 옛 자료 안의 같은 경로 두 기록은 예전처럼 하나로 읽는다(fid 가 없던 시절에는 같은 사진의 중복 기록이었다) — 새 자료만 둘로 가른다(①)
  assert(two.a.length === 3 && JSON.stringify(two.a) === JSON.stringify([two.assigned[0], two.assigned[1], two.assigned[3]]), '② 불러온 기록이 붙이는 규칙과 같은 fid: ' + JSON.stringify(two));
  assert(JSON.stringify(two.a) === JSON.stringify(two.b), '② 옛 자료 — 두 번(두 기기) 불러와도 같은 fid: ' + JSON.stringify([two.a, two.b]));
  assert(JSON.stringify(two.ser) === JSON.stringify(two.a), '② 처음 저장 때 그 fid 가 실린다: ' + JSON.stringify(two.ser));
  assert(two.copyFid !== two.c0 && two.ser2.length === 4 && new Set(two.ser2).size === 4, '② 같은 fid 두 기록 — 둘째가 새 fid: ' + JSON.stringify(two));
  console.log('PASS  ② 옛 자료는 정해지는 fid(기기마다 같다) · 복사본은 새 fid');

  // ── ③ 재스캔 ────────────────────────────────────────────────────────────────────────
  const three = await page.evaluate(async () => {
    const T = Date.UTC(2026, 8, 5), H = name => ({ kind: 'file', name });
    const mk = (t) => new File([new Uint8Array(300).fill(7)], 'scan.jpg', { type: 'image/jpeg', lastModified: t });
    state.files = [];
    const first = await ingestFile(mk(T), H('scan.jpg'), '현장사진/A현장/');
    const other = await ingestFile(new File([new Uint8Array(40)], 'untouched.jpg', { type: 'image/jpeg', lastModified: T }), H('untouched.jpg'), '현장사진/');
    const fid0 = first.fid, fidU = other.fid;
    // 재스캔(같은 파일) — loadFolder 와 같이 편집 백업 → 목록 비움 → 다시 읽기
    backupUserEdits(); state.files = [];
    const again = await ingestFile(mk(T), H('scan.jpg'), '현장사진/A현장/');
    const againU = await ingestFile(new File([new Uint8Array(40)], 'untouched.jpg', { type: 'image/jpeg', lastModified: T }), H('untouched.jpg'), '현장사진/');
    // 같은 경로·크기인데 수정 시각이 다르다 = 다른 파일(덮어쓴 사진)
    backupUserEdits(); state.files = [];
    const replaced = await ingestFile(mk(T + 86400000), H('scan.jpg'), '현장사진/A현장/');
    // PC 부팅: 새로 읽은 파일(무작위 fid) + 저장본(_현장.json) 의 같은 경로 기록 → 저장된 fid 를 이어받는다
    state.files = [];
    const boot = await ingestFile(mk(T), H('scan.jpg'), '현장사진/A현장/', { restoreEdits: false });
    const bootFresh = boot.fid;
    applyData({ version: 2, app: '현장', savedAt: '2026-09-06T00:00:00.000Z', projects: state.projects, quotes: [],
      files: [{ key: '현장사진/A현장/scan.jpg|300', fid: fid0, name: 'scan.jpg', prefix: '현장사진/A현장/', kind: 'photo', project: 'A현장', size: 300, worklabel: '저장된 작업명', sourceModifiedAt: new Date(T).toISOString() }] });
    return { fid0, again: again.fid, fidU, againU: againU.fid, replaced: replaced.fid, bootFresh, boot: boot.fid, bootLabel: boot._worklabel, n: state.files.length };
  });
  assert(three.again === three.fid0 && three.againU === three.fidU, '③ 재스캔 — 같은 실제 파일은 같은 fid(손대지 않은 사진 포함): ' + JSON.stringify(three));
  assert(three.replaced !== three.fid0, '③ 수정 시각이 다른 같은 경로 파일은 fid 를 이어받지 않는다: ' + JSON.stringify(three));
  assert(three.bootFresh !== three.fid0 && three.boot === three.fid0 && three.bootLabel === '저장된 작업명' && three.n === 1, '③ PC 부팅 — 저장본의 fid 를 이어받는다: ' + JSON.stringify(three));
  console.log('PASS  ③ 재스캔·PC 부팅 — 같은 실제 파일만 같은 fid');

  // ── ④ 서버 병합 ─────────────────────────────────────────────────────────────────────
  const four = await page.evaluate(() => {
    state.files = [];
    applyData({ version: 2, app: '현장', savedAt: '2026-09-07T00:00:00.000Z', projects: state.projects, quotes: [],
      files: [{ key: 'image.jpg|100', fid: 'mine-fid-000001', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', size: 100, worklabel: '내 작업' }] });
    const mine = state.files[0];
    // 다른 기기가 올린 같은 이름·같은 크기 사진(다른 fid) + 내 사진(같은 fid)에 붙은 공정
    applyData({ version: 2, app: '현장', savedAt: '2026-09-08T00:00:00.000Z', projects: state.projects, quotes: [], files: [
      { key: 'image.jpg|100', fid: 'mine-fid-000001', name: 'image.jpg', prefix: '', kind: 'photo', project: 'A현장', size: 100, worklabel: '내 작업', phase: '타일' },
      { key: 'image.jpg|100', fid: 'other-fid-00002', name: 'image.jpg', prefix: '', kind: 'photo', project: 'B현장', size: 100, worklabel: '남의 작업' }] });
    const out = { list: state.files.map(f => [f.fid, f.project, f._worklabel, f._phase || null]), same: state.files[0] === mine };
    // 이 기기에서 정리 폴더로 옮긴 사진(경로가 바뀜) — 서버 자료에는 옛 경로, 같은 이름·크기 사진이 하나 더 있어 이름으로는 못 가른다 → fid 로 잇는다
    state.files = [{ id: uid(), fid: 'moved-fid-0001', name: 'IMG_0001.jpg', prefix: '_정리완료/A현장/', size: 300, kind: 'photo', project: 'A현장', ext: 'jpg' }];
    applyData({ version: 2, app: '현장', savedAt: '2026-09-09T00:00:00.000Z', projects: state.projects, quotes: [], files: [
      { key: '현장사진/IMG_0001.jpg|300', fid: 'moved-fid-0001', name: 'IMG_0001.jpg', prefix: '현장사진/', kind: 'photo', project: 'A현장', size: 300, worklabel: '옮긴 사진 작업' },
      { key: '현장사진/B/IMG_0001.jpg|300', fid: 'moved-other-02', name: 'IMG_0001.jpg', prefix: '현장사진/B/', kind: 'photo', project: 'B현장', size: 300, worklabel: '남의 사진' }] });
    out.moved = state.files.map(f => [f.fid, f.prefix, f._worklabel]);
    return out;
  });
  assert(JSON.stringify(four.list) === JSON.stringify([['mine-fid-000001', 'A현장', '내 작업', '타일'], ['other-fid-00002', 'B현장', '남의 작업', null]]) && four.same,
    '④ 서버 병합 — 같은 fid 는 그 기록에, 다른 fid 의 같은 이름·크기 사진은 따로: ' + JSON.stringify(four));
  assert(JSON.stringify(four.moved) === JSON.stringify([['moved-fid-0001', '_정리완료/A현장/', '옮긴 사진 작업'], ['moved-other-02', '현장사진/B/', '남의 사진']]),
    '④ 경로가 바뀐 사진도 fid 로 제 저장 기록과 잇는다(이름이 겹쳐도): ' + JSON.stringify(four.moved));
  console.log('PASS  ④ 서버 병합 — 남의 같은 이름 사진을 내 사진에 덮지 않는다');

  // ── ⑤ 전송 대기열 연결 ──────────────────────────────────────────────────────────────
  const five = await page.evaluate(async () => {
    const mk = (fid, project) => ({ id: uid(), fid, name: 'image.jpg', prefix: '', size: 100, kind: 'photo', project, _driveId: null, ext: 'jpg' });
    state.files = [mk('q-fid-0000001', 'A현장'), mk('q-fid-0000002', 'A현장')];
    __tabStale = false;
    // 새 항목이 'f:' 로 기억되는가 — 서버가 안 받으면(오프라인) 대기열로
    const origCall = relayCall; relayCall = async () => { throw new Error('offline'); };
    await idbSet('relay_queue', []);
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    const origCompress = relayCompressPhoto; relayCompressPhoto = async () => blob;
    try { await relayUploadFiles([file], 'photo', [state.files[1]]); } finally { relayCall = origCall; relayCompressPhoto = origCompress; }
    const q = (await idbGet('relay_queue')) || [];
    const ref = q[0] && q[0].ref;
    // 옛 'k:' 참조 — 같은 경로·같은 현장 두 기록이면 어느 것인지 몰라 붙이지 않는다
    const linkK = relayQueueLinkUpload({ action: 'upload', ref: 'k:image.jpg|100', project: 'A현장', payload: {} }, { fileId: 'DRIVE-FAKE-QK', size: 4, mimeType: 'image/jpeg' });
    const linkF = relayQueueLinkUpload({ action: 'upload', ref, project: 'A현장', payload: {} }, { fileId: 'DRIVE-FAKE-Q2', size: 4, mimeType: 'image/jpeg' });
    await idbSet('relay_queue', []);
    return { ref, linkF, linkK, drives: state.files.map(f => f._driveId) };
  });
  assert(five.ref === 'f:q-fid-0000002', "⑤ 대기열 항목은 'f:'+fid 로 기억한다: " + five.ref);
  assert(five.linkF === true && JSON.stringify(five.drives) === JSON.stringify([null, 'DRIVE-FAKE-Q2']), '⑤ fid 참조는 같은 경로 두 기록 중 그 기록에만 Drive ID 를 붙인다: ' + JSON.stringify(five));
  assert(five.linkK === false, "⑤ 옛 'k:' 참조는 같은 경로 두 기록이면 붙이지 않는다(모호): " + JSON.stringify(five));
  console.log("PASS  ⑤ 전송 대기열 — 'f:' 로 기억하고 그 기록에만 Drive ID");

  // ── ⑥ 서버 사진 목록 합치기 ─────────────────────────────────────────────────────────
  const six = await page.evaluate(async () => {
    state.files = [{ id: uid(), fid: 'pend-fid-00001', name: 'IMG_0001.jpg', prefix: '', size: 500, kind: 'photo', project: 'A현장', ext: 'jpg', _driveId: null }];
    await idbSet('relay_queue', [{ id: 'q1', action: 'upload', ref: 'f:pend-fid-00001', project: 'A현장', payload: { name: 'IMG_0001.jpg' }, createdAt: Date.now(), retryCount: 0 }]);
    const orig = cloudApiListFiles;
    cloudApiListFiles = async () => ({ ok: true, files: [{ id: 'DRIVE-FAKE-OTHER', name: 'IMG_0001.jpg', size: 500, mimeType: 'image/jpeg' }] });
    try { await relayLoadDriveFiles(true); } finally { cloudApiListFiles = orig; }
    await idbSet('relay_queue', []);
    return state.files.map(f => [f.fid, f._driveId, f.project]);
  });
  assert(six.length === 2 && six[0][0] === 'pend-fid-00001' && six[0][1] === null && six[1][1] === 'DRIVE-FAKE-OTHER' && six[1][2] === null,
    '⑥ 전송 대기 중인 사진(f: 참조)에 이름·크기가 같은 서버 사진을 붙이지 않는다(미배정으로 따로): ' + JSON.stringify(six));
  const sixFid = await page.evaluate(() => state.files[1].fid);
  assert(/^lg-[0-9a-f]{16}$/.test(sixFid), '⑥ 서버 목록에서 들인 기록의 fid 는 Drive ID 로 정해진다(두 폰이 같은 값): ' + sixFid);
  console.log('PASS  ⑥ 서버 사진 목록 — 전송 대기 사진에 남의 서버 사진을 붙이지 않는다');

  // ── ⑦ 선택 복원 ─────────────────────────────────────────────────────────────────────
  const seven = await page.evaluate(() => {
    const mk = (fid, label) => ({ id: uid(), fid, name: 'image.jpg', prefix: '', size: 100, kind: 'photo', project: 'A현장', _worklabel: label, ext: 'jpg' });
    state.files = [mk('sel-fid-00001', '백업1'), mk('sel-fid-00002', '백업2')];
    const backup = JSON.parse(JSON.stringify(serializeData())).files;
    state.files[0]._worklabel = '지금1'; state.files[1]._worklabel = '지금2';
    const n = restoreSelectFiles(backup.slice().reverse(), new Set(['A현장']));
    return { n, list: state.files.map(f => [f.fid, f._worklabel]) };
  });
  assert(seven.n === 2 && JSON.stringify(seven.list) === JSON.stringify([['sel-fid-00001', '백업1'], ['sel-fid-00002', '백업2']]),
    '⑦ 선택 복원 — 같은 경로 두 기록이 제 백업(fid)으로, fid 는 그대로: ' + JSON.stringify(seven));
  console.log('PASS  ⑦ 선택 복원 — fid 로 제 짝');

  const keys = await page.evaluate(() => Object.keys(serializeData()).length);
  assert(keys === 41, '⑧ serializeData 최상위 키 41개 그대로: ' + keys);
  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));
  console.log('PASS  ⑧ 최상위 키 41 · pageerror 0');
  console.log('photo-fid.e2e OK');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });

/* v522 중복 정리 도구 '정리본 사본' 거르기 — 원본 폴더(현장사진/)에 남은 "(1)·사본" 이 _정리완료/ 정리본과 바이트가 같으면 정리본을 남기고 사본을 뺀다.
   지금까지는 사본(현장 비어 있음)과 정리본(현장·공정 있음)의 정보가 달라 자동 정리 후보에서 늘 빠졌다(metaDiff). 합성 Blob 원본만, 바깥 쓰기 0.
   시드: 정리본 O1·O2(가온/방수, 바이트 A·B) ↔ 원본 폴더 사본 R1 "IMG_0001 (1).jpg"(A) · R2 "IMG_0002 - 사본.jpg"(B) ·
         미끼 D(크기·촬영 시각이 O3 와 같지만 바이트 다름) · 정보 충돌 X(사본에만 작업명) · 드라이브 연결만 있는 사본 G · 읽을 원본 없는 가상 기록 V
   ① verifyDuplicatePhotos: 정리본 사본 쌍 2(유지=정리본), 미끼·충돌·드라이브 사본은 유지 목록에 이유와 함께, 가상 기록은 후보 아님, 두 번째 검사는 미끼를 다시 읽지 않음 (PAIRS)
   ② 창(trimDuplicates): "정리본 사본 2장" 표시 + 쌍마다 현장/공정 (UI)
   ③ 정리: 안전판 1회·R1·R2 만 빠짐·복구함 1묶음 2장·정리본의 현장·공정 그대로 (CLEAN)
   ④ 복구함에서 되돌리기 → R1·R2 복귀, 바이트 그대로 (RESTORE)
   ⑤ 정리 직전 사본에 정보가 생기면(현장 배정) 정리하지 않는다 (STALE) · 오류 0 · 바깥 쓰기 0
   HJ_V522_BASELINE=<commit> 은 ① 에서, HJ_V522_MUTATION=no-hash 는 ① 미끼에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V522_BASELINE ? execFileSync('git', ['show', process.env.HJ_V522_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V522_MUTATION === 'no-hash') {
  const from = 'try{if(await hashGet(o)===hash){keep=o;break;}}';
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, 'try{if(await hashGet(o)||hash){keep=o;break;}}');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
  }, BOOT);
  return { context, page };
}
const SEED = async () => {
  closeModal(true); __dupCleanSigs.clear(); __tabStale = false;
  await idbDel(PHOTO_RECOVERY_KEY);
  state.projects = ['가온', '한밭'].map(name => ({ name, stage: 1, phases: ['방수', '타일'], cost: {}, customer: {}, archived: false }));
  const A = [1, 2, 3, 4, 5, 6], B = [6, 5, 4, 3, 2, 1], C = [1, 1, 1, 1, 1, 1], D = [2, 2, 2, 2, 2, 2];
  const W = '2026-09-25T01:00:00Z';
  const make = (id, name, prefix, bytes, extra) => Object.assign({ id, name, prefix, kind: 'photo', ext: 'jpg', size: bytes.length, when: new Date(W), project: '', _file: new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' }) }, extra || {});
  state.files = [
    make('O1', 'IMG_0001.jpg', '_정리완료/가온/방수/', A, { project: '가온', _phase: '방수', _worklabel: '2차 방수' }),
    make('R1', 'IMG_0001 (1).jpg', '현장사진/', A),                                                             // 정리본 사본(현장 비어 있음)
    make('O2', 'IMG_0002.jpg', '_정리완료/가온/타일/', B, { project: '가온', _phase: '타일', when: new Date('2026-09-25T02:00:00Z') }),
    make('R2', 'IMG_0002 - 사본.jpg', '현장사진/', B, { when: new Date('2026-09-25T02:00:00Z'), project: '가온' }),   // 같은 현장만 적힌 사본
    make('O3', 'IMG_0003.jpg', '_정리완료/한밭/방수/', C, { project: '한밭', _phase: '방수', when: new Date('2026-09-26T01:00:00Z') }),
    make('D', 'IMG_0003 (1).jpg', '현장사진/', D, { when: new Date('2026-09-26T01:00:00Z') }),                   // 미끼: 크기·시각 같고 바이트 다름
    make('O4', 'IMG_0004.jpg', '_정리완료/한밭/타일/', [7, 7, 7, 7, 7, 7], { project: '한밭', _phase: '타일', when: new Date('2026-09-27T01:00:00Z') }),
    make('X', 'IMG_0004 (1).jpg', '현장사진/', [7, 7, 7, 7, 7, 7], { when: new Date('2026-09-27T01:00:00Z'), _worklabel: '다른 작업' }),   // 사본에만 작업명
    make('O5', 'IMG_0005.jpg', '_정리완료/한밭/타일/', [8, 8, 8, 8, 8, 8], { project: '한밭', _phase: '타일', when: new Date('2026-09-28T01:00:00Z') }),
    make('G', 'IMG_0005 (1).jpg', '현장사진/', [8, 8, 8, 8, 8, 8], { when: new Date('2026-09-28T01:00:00Z'), _driveId: 'drive-only-copy' }),   // 사본에만 드라이브 연결
    Object.assign(make('V', 'IMG_0001.jpg', '현장사진/', A), { _file: null, _virtual: true, _driveId: 'drv-v', when: new Date('2026-09-29T01:00:00Z') }),   // Drive 만 있는 가상 기록 — 읽을 원본 없음(후보 아님, 조용히 건너뜀)
  ];
  state.activeProject = null; state.tab = 'photos'; state.search = ''; state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state.aptOrders = []; state._demo = false; state.dirHandle = null;
  __showDup = false; __phaseProj = null; __photoCache.key = ''; __sel.clear();
  await guardedPersistCurrentState(); render();
};
const ids = page => page.evaluate(() => state.files.map(f => f.id).sort().join(','));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS photodupclean-v522 ' + name); }
  const { context, page } = await openPage();
  await page.evaluate(SEED);

  await test('① 정리본 사본 쌍 2(유지=정리본) · 미끼·정보 충돌·드라이브 사본은 유지 목록에 이유 (PAIRS)', async () => {
    const r = await page.evaluate(async () => {
      const before = JSON.stringify({ ...serializeData(), savedAt: '' });
      const plan = await verifyDuplicatePhotos();
      return { pairs: plan.pairs.map(p => ({ keep: p.keep.id, file: p.file.id, copy: !!p.copy, km: p.keepMeta !== p.fileMeta })), held: plan.held.map(h => h.f.id + ':' + h.reason), stats: plan.stats, unchanged: before === JSON.stringify({ ...serializeData(), savedAt: '' }) };
    });
    assert.deepEqual(r.pairs.map(p => [p.keep, p.file, p.copy, p.km]), [['O1', 'R1', true, true], ['O2', 'R2', true, true]], 'PAIRS ' + JSON.stringify(r));
    assert(r.unchanged, 'verification changes nothing');
    assert(r.held.some(h => /^D:정리본과 내용\(바이트\)이 달라/.test(h)), 'decoy held with byte reason ' + JSON.stringify(r.held));
    assert(r.held.some(h => /^X:작업명이 다름/.test(h)) && r.held.some(h => /^G:사본 쪽에만 드라이브 연결/.test(h)), 'conflicting copies held ' + JSON.stringify(r.held));
    assert(r.held.some(h => /^O1:정리본 유지/.test(h)), 'keeper listed ' + JSON.stringify(r.held));
    assert.equal(r.stats.copyPairs, 2, JSON.stringify(r.stats));
    assert(!r.held.some(h => /^V:/.test(h)) && r.stats.checkedGroups === 3, 'unreadable Drive-only record is not a candidate (3 groups read: R1·R2·D) ' + JSON.stringify(r.stats));
    const again = await page.evaluate(async () => (await verifyDuplicatePhotos()).stats);
    assert(again.checkedGroups === 2 && again.copyPairs === 2 && again.clean >= 1, 'second run re-reads only the real pairs; the decoy is remembered as clean ' + JSON.stringify(again));
  });

  await test('② 창에 "정리본 사본 2장" + 쌍마다 현장/공정 (UI)', async () => {
    const r = await page.evaluate(async () => {
      await trimDuplicates();
      await new Promise(r => setTimeout(r, 200));
      const root = document.getElementById('modalRoot');
      return { text: root.textContent.replace(/\s+/g, ' '), tag: (root.querySelector('[data-dup-copy]') || {}).dataset?.dupCopy, btns: [...root.querySelectorAll('.mfoot button')].map(b => b.textContent) };
    });
    assert.equal(r.tag, '2', r.text.slice(0, 300));
    assert.match(r.text, /안전 정리 가능 2장/); assert.match(r.text, /IMG_0001 \(1\)\.jpg → IMG_0001\.jpg 유지 · 정리본 사본 → 가온 \/ 방수/); assert.match(r.text, /IMG_0002 - 사본\.jpg → IMG_0002\.jpg 유지 · 정리본 사본 → 가온 \/ 타일/);
    assert(r.btns.some(t => /2장 중복 삭제/.test(t)), JSON.stringify(r.btns));
    await page.evaluate(() => closeModal(true));
  });

  await test('③ 정리: 안전판 1회 · R1·R2 만 빠짐 · 복구함 1묶음 2장 · 정리본 그대로 (CLEAN)', async () => {
    const r = await page.evaluate(async () => {
      window.__snapCalls = []; const real = hjSnapshot; hjSnapshot = async (...a) => { window.__snapCalls.push(a[0]); return real(...a); };
      const plan = await verifyDuplicatePhotos(); const ok = await saveVerifiedDuplicates(plan); hjSnapshot = real;
      const j = await idbGetStrict(PHOTO_RECOVERY_KEY), o1 = state.files.find(f => f.id === 'O1');
      return { ok, snaps: window.__snapCalls, batches: j?.batches.length, recs: j?.batches[0].records.map(x => x.id).sort(), stored: (await idbGetStrict('appState')).files.map(f => f.name).sort().join(','), o1: [o1.project, o1._phase, o1._worklabel, o1.prefix] };
    });
    assert(r.ok, JSON.stringify(r));
    assert.deepEqual(r.snaps, ['검증된 중복 사진 정리 전'], 'CLEAN one snapshot ' + JSON.stringify(r.snaps));
    assert.equal(await ids(page), 'D,G,O1,O2,O3,O4,O5,V,X', 'CLEAN only the two copies left the list');
    assert.equal(r.stored, 'IMG_0001.jpg,IMG_0001.jpg,IMG_0002.jpg,IMG_0003 (1).jpg,IMG_0003.jpg,IMG_0004 (1).jpg,IMG_0004.jpg,IMG_0005 (1).jpg,IMG_0005.jpg', 'persisted list matches');
    assert.equal(r.batches, 1); assert.deepEqual(r.recs, ['R1', 'R2']);
    assert.deepEqual(r.o1, ['가온', '방수', '2차 방수', '_정리완료/가온/방수/'], 'organized copy untouched');
  });

  await test('④ 복구함에서 되돌리기 → R1·R2 복귀, 바이트 그대로 (RESTORE)', async () => {
    const r = await page.evaluate(async () => {
      const j = await idbGetStrict(PHOTO_RECOVERY_KEY);
      const ok = await restoreDuplicateBatch(j.batches[0].id);
      const r1 = state.files.find(f => f.id === 'R1');
      return { ok, bytes: r1 ? Array.from(new Uint8Array(await r1._file.arrayBuffer())) : [], prefix: r1 && r1.prefix, project: r1 && r1.project, left: (await idbGetStrict(PHOTO_RECOVERY_KEY)).batches.length };
    });
    assert(r.ok, JSON.stringify(r));
    assert.equal(await ids(page), 'D,G,O1,O2,O3,O4,O5,R1,R2,V,X');
    assert.deepEqual(r.bytes, [1, 2, 3, 4, 5, 6]); assert.equal(r.prefix, '현장사진/'); assert.equal(r.project, '');
    assert.equal(r.left, 0);
  });

  await test('⑤ 정리 직전 사본에 정보가 생기면 정리하지 않는다 (STALE) · 오류 0 · 바깥 쓰기 0', async () => {
    await page.evaluate(SEED);
    const r = await page.evaluate(async () => { const p = await verifyDuplicatePhotos(); state.files.find(f => f.id === 'R1').project = '한밭'; const ok = await saveVerifiedDuplicates(p); return { ok, toast: document.getElementById('toast').textContent }; });
    assert.equal(r.ok, false, 'STALE ' + JSON.stringify(r)); assert.match(r.toast, /다시 검증하세요|자료가 변경/);
    assert.equal(await ids(page), 'D,G,O1,O2,O3,O4,O5,R1,R2,V,X');
    assert.match(SRC, /const km=pair\.keepMeta\|\|duplicateMetadata\(pair\.file\),fm=pair\.fileMeta\|\|km;/, 'save re-checks the metadata captured at verification');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
    await context.close();
  });

  console.log(`photodupclean-v522: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL photodupclean-v522', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

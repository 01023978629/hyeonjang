/* v556 정리한 사진 표시(photoTombs) — 중복 정리로 뺀 기록이 다른 기기·옛 저장본 병합으로 되살아나지 않는다.
   2026-11-05 실측: 정리로 뺀 수백 장이 다시 들어와 있었다. '다시 불러오지 않기'(removed_ids)는 이 브라우저 IDB 에만 있어
   빼기 전 자료를 가진 기기(폰)·옛 저장본이 applyData 병합으로 기록을 다시 넣었다. 합성 Blob 원본만, 바깥 쓰기 0.
   시드: 정리본 O1(가온/방수, 바이트 A) ↔ 원본 폴더 사본 R1 "IMG_0001 (1).jpg"(A) · 다른 사진 O2.
   ① 정리 → 저장본에 R1 표시 → 옛 저장본(정리 전, 표시 없음) 병합해도 R1 안 돌아옴 · O1·O2 그대로 (PINGPONG)
   ② 옛 자료를 가진 다른 기기(새 브라우저 문맥)가 새 저장본을 병합 → 그 기기의 R1 도 빠지고, 그 기기 저장본에 표시가 실린다 (OTHERDEVICE)
   ③ 복구함 되돌리기 → R1 복귀 · 표시 꺼짐(r>t) · 표시 든 옛 저장본을 다시 병합해도 R1 유지 (REVIVE)
   ④ 안전판 되돌리기(applyData revert) → R1 복귀 · 표시 꺼짐 · 그 뒤 병합에서도 유지 (SNAPREVERT)
   ⑤ 남는 기록과 신원이 같으면 표시하지 않음 · 합치기 순서 무관 · 같은 키 t·r 최대 · 상한 (MERGE)
   ⑥ v555 저장본(키 없음)에서 v556 로 올라와도 정상 부팅·자료 그대로·저장 성공 (UPGRADE)
   ⑦ 핀 3곳
   HJ_V556_BASELINE=<commit> 은 ① 에서, HJ_V556_MUTATION=no-skip(병합 거르기 삭제) 은 ① 에서 실패해야 한다. */
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
const gitShow = rev => execFileSync('git', ['show', rev + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let html = process.env.HJ_V556_BASELINE ? gitShow(process.env.HJ_V556_BASELINE) : null;
if (process.env.HJ_V556_MUTATION === 'no-skip') {
  const from = 'if(__tombAct.size&&__tombAct.has(hjTombKeyOfSaved(s))){__tombSkipped++;return;}';
  const from2 = 'if(__tombAct.size){const n0=state.files.length;';
  assert(SRC.includes(from) && SRC.includes(from2), 'mutation anchor');
  html = SRC.replace(from, '').replace(from2, 'if(false){const n0=state.files.length;');
}
// ⑥ 올라오기 전 판(v555) — 기준선 지정이 있으면 그것을, 없으면 이 판의 바로 앞 판.
let oldHtml = null;
for (const rev of [process.env.HJ_V556_OLD, 'HEAD', 'HEAD~1', 'HEAD~2', 'HEAD~3', 'origin/main'].filter(Boolean)) {
  try { const t = gitShow(rev); if (!t.includes('photoTombs')) { oldHtml = t; break; } } catch (_) { /* 얕은 복제 등 — 다음 후보 */ }
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(context, body) {
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      const b = body === undefined ? html : body;
      if (b && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: b });
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
  return page;
}
const newContext = () => browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
const SEED = async () => {
  closeModal(true); __dupCleanSigs.clear(); __tabStale = false;
  await idbDel(PHOTO_RECOVERY_KEY); await idbSet('hj_snaps', []); __snapLastAt = 0;
  state.projects = ['가온', '한밭'].map(name => ({ name, stage: 1, phases: ['방수'], cost: {}, customer: {}, archived: false }));
  const A = [1, 2, 3, 4, 5, 6], B = [9, 8, 7, 6, 5, 4, 3];
  const W = '2026-09-25T01:00:00Z';
  const make = (id, name, prefix, bytes, extra) => Object.assign({ id, name, prefix, kind: 'photo', ext: 'jpg', size: bytes.length, when: new Date(W), project: '', _file: new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' }) }, extra || {});
  state.files = [
    make('O1', 'IMG_0001.jpg', '_정리완료/가온/방수/', A, { project: '가온', _phase: '방수', _worklabel: '2차 방수' }),
    make('R1', 'IMG_0001 (1).jpg', '현장사진/', A),
    make('O2', 'IMG_0002.jpg', '_정리완료/한밭/방수/', B, { project: '한밭', _phase: '방수', when: new Date('2026-09-26T01:00:00Z') }),
  ];
  if ('photoTombs' in state) state.photoTombs = [];
  state.activeProject = null; state.tab = 'photos'; state.search = ''; state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state.aptOrders = []; state._demo = false; state.dirHandle = null;
  __showDup = false; __phaseProj = null; __photoCache.key = ''; __sel.clear();
  await guardedPersistCurrentState(); render();
};
const names = page => page.evaluate(() => state.files.filter(f => !f._fromQuote).map(f => f.name).sort().join(','));
const CLEAN = async () => { const plan = await verifyDuplicatePhotos(); return { ok: await saveVerifiedDuplicates(plan), pairs: plan.pairs.map(p => p.file.name) }; };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS photodupsync-v556 ' + name); }
  const ctxA = await newContext();
  const page = await openPage(ctxA);
  await page.evaluate(SEED);
  let stale = null, fresh = null;

  await test('① 정리 → 표시 → 옛 저장본 병합해도 R1 안 돌아옴 (PINGPONG)', async () => {
    stale = await page.evaluate(() => JSON.parse(JSON.stringify(serializeData())));   // 정리 전 자료 = 다른 기기가 가진 옛 자료
    const r = await page.evaluate(CLEAN);
    assert(r.ok, JSON.stringify(r)); assert.deepEqual(r.pairs, ['IMG_0001 (1).jpg']);
    assert.equal(await names(page), 'IMG_0001.jpg,IMG_0002.jpg');
    const after = await page.evaluate(async old => {
      const stored = await idbGetStrict('appState');
      applyData(JSON.parse(JSON.stringify(old)));
      return { tombs: (stored.photoTombs || []).map(x => JSON.parse(x.k)[1] + (x.t && !x.r ? ':t' : ':?')), skipped: window.__photoTombSkipped, o1: (() => { const o = state.files.find(f => f.name === 'IMG_0001.jpg'); return o && [o.project, o._phase, o._worklabel]; })() };
    }, stale);
    assert.equal(await names(page), 'IMG_0001.jpg,IMG_0002.jpg', 'PINGPONG old saved state brought the removed copy back');
    assert.deepEqual(after.tombs, ['IMG_0001 (1).jpg:t'], 'stored appState carries the tomb ' + JSON.stringify(after));
    assert.deepEqual(after.o1, ['가온', '방수', '2차 방수'], 'keeper untouched');
    assert.equal(after.skipped, 1);
    fresh = await page.evaluate(() => JSON.parse(JSON.stringify(serializeData())));
    assert.equal(fresh.photoTombs.length, 1); assert(!fresh.files.some(f => f.name === 'IMG_0001 (1).jpg'));
  });

  await test('② 옛 자료를 가진 다른 기기가 새 저장본을 병합 → 그 기기 R1 도 빠지고 표시가 실린다 (OTHERDEVICE)', async () => {
    const ctxB = await newContext();
    const b = await openPage(ctxB);
    await b.evaluate(SEED);
    assert.equal(await names(b), 'IMG_0001 (1).jpg,IMG_0001.jpg,IMG_0002.jpg', 'device B starts with the stale copy');
    const r = await b.evaluate(async data => {
      applyData(JSON.parse(JSON.stringify(data)));
      const ok = await guardedPersistCurrentState();
      const out = serializeData();
      return { ok, tombs: out.photoTombs.length, names: out.files.map(f => f.name).sort().join(',') };
    }, fresh);
    assert.equal(await names(b), 'IMG_0001.jpg,IMG_0002.jpg', 'OTHERDEVICE stale local copy removed');
    assert(r.ok, JSON.stringify(r)); assert.equal(r.tombs, 1); assert.equal(r.names, 'IMG_0001.jpg,IMG_0002.jpg');
    await ctxB.close();
  });

  await test('③ 복구함 되돌리기 → R1 복귀 · 표시 꺼짐 · 표시 든 저장본을 다시 병합해도 유지 (REVIVE)', async () => {
    const r = await page.evaluate(async data => {
      const j = await idbGetStrict(PHOTO_RECOVERY_KEY);
      const ok = await restoreDuplicateBatch(j.batches[0].id);
      const t = (await idbGetStrict('appState')).photoTombs || [];
      applyData(JSON.parse(JSON.stringify(data)));   // 다른 기기가 아직 표시(t)만 가진 저장본
      return { ok, tomb: t.map(x => !!x.t && !!x.r && Date.parse(x.r) >= Date.parse(x.t)), active: hjTombActiveKeys(state.photoTombs).size };
    }, fresh);
    assert(r.ok, JSON.stringify(r)); assert.deepEqual(r.tomb, [true], 'revive stamped ' + JSON.stringify(r)); assert.equal(r.active, 0);
    assert.equal(await names(page), 'IMG_0001 (1).jpg,IMG_0001.jpg,IMG_0002.jpg', 'REVIVE restored copy survives a merge with the older tomb');
  });

  await test('④ 안전판 되돌리기 → R1 복귀 · 표시 꺼짐 · 그 뒤 병합에서도 유지 (SNAPREVERT)', async () => {
    await page.evaluate(SEED);
    const r = await page.evaluate(async () => {
      const c = await (async () => { const plan = await verifyDuplicatePhotos(); return saveVerifiedDuplicates(plan); })();
      const gone = !state.files.some(f => f.name === 'IMG_0001 (1).jpg');
      const tombed = JSON.parse(JSON.stringify(serializeData()));
      const snaps = (await idbGet('hj_snaps')) || [], s = snaps.find(x => x.label === '검증된 중복 사진 정리 전');
      const ok = await hjRestoreSnapshot(s);
      const back = state.files.some(f => f.name === 'IMG_0001 (1).jpg'), active = hjTombActiveKeys(state.photoTombs).size;
      applyData(tombed);
      return { c, gone, ok, back, active, still: state.files.some(f => f.name === 'IMG_0001 (1).jpg') };
    });
    assert.deepEqual(r, { c: true, gone: true, ok: true, back: true, active: 0, still: true }, 'SNAPREVERT ' + JSON.stringify(r));
  });

  await test('⑤ 남는 기록과 같은 신원은 표시 안 함 · 합치기 순서 무관 · t·r 최대 · 상한 (MERGE)', async () => {
    const r = await page.evaluate(() => {
      const f = { prefix: 'a/', name: 'x.jpg', size: 10, _driveId: 'D1' }, twin = { ...f }, other = { prefix: 'b/', name: 'x.jpg', size: 10, _driveId: 'D1' };
      const keepTwin = hjTombUpdate([], [f], [], [twin], '2026-11-06T00:00:00.000Z');
      const onlyOther = hjTombUpdate([], [f], [], [other], '2026-11-06T00:00:00.000Z');
      const a = [{ k: 'K1', t: '2026-11-01T00:00:00.000Z' }, { k: 'K2', t: '2026-11-02T00:00:00.000Z', r: '2026-11-03T00:00:00.000Z' }];
      const b = [{ k: 'K1', r: '2026-11-04T00:00:00.000Z' }, { k: 'K2', t: '2026-11-05T00:00:00.000Z' }, { k: 'bad' }, null, { k: 3, t: 'x' }];
      const ab = JSON.stringify(hjPhotoTombsSafe([...a, ...b])), ba = JSON.stringify(hjPhotoTombsSafe([...b, ...a]));
      const many = Array.from({ length: HJ_PHOTO_TOMB_MAX + 5 }, (_, i) => ({ k: 'k' + i, t: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() }));
      const capped = hjPhotoTombsSafe(many);
      return { keepTwin: keepTwin.length, onlyOther: onlyOther.length, same: ab === ba, act: [...hjTombActiveKeys(JSON.parse(ab))], cap: capped.length, oldestGone: !capped.some(x => x.k === 'k0'), idem: JSON.stringify(hjPhotoTombsSafe(JSON.parse(ab))) === ab };
    });
    assert.equal(r.keepTwin, 0, 'never tomb a key that a remaining record still has');
    assert.equal(r.onlyOther, 1, 'same Drive ID but other path is a different record');
    assert(r.same && r.idem, 'order independent and idempotent ' + JSON.stringify(r));
    assert.deepEqual(r.act, ['K2'], 'K1 revived later, K2 re-tombed later ' + JSON.stringify(r));
    assert(r.cap === 6000 && r.oldestGone, JSON.stringify(r));
  });
  await ctxA.close();

  await test('⑥ v555 저장본(키 없음)에서 올라와도 정상 부팅·자료 그대로·저장 성공 (UPGRADE)', async () => {
    if (!oldHtml || process.env.HJ_V556_BASELINE) { console.log('  (⑥ 건너뜀 — 옛 판 없음 또는 기준선 실행)'); return; }
    assert(!oldHtml.includes('photoTombs'), 'old build must predate the key');
    const ctx = await newContext();
    const o = await openPage(ctx, oldHtml);
    await o.evaluate(SEED);
    const before = await o.evaluate(async () => { await __appStateWriteQueue; const s = await idbGetStrict('appState'); return { keys: 'photoTombs' in s, n: s.files.length }; });
    assert.deepEqual(before, { keys: false, n: 3 });
    await o.close();
    const p = await openPage(ctx, SRC);
    const r = await p.evaluate(async () => {
      const banner = document.body.innerText.match(/복구 모드|자료를 확인할 수 없|recovery/i);
      const n = state.files.filter(f => !f._fromQuote).length, tombs = serializeData().photoTombs;
      const ok = await guardedPersistCurrentState(); const s = await idbGetStrict('appState');
      return { banner: banner && banner[0], n, tombs, ok, stored: Array.isArray(s.photoTombs), stale: __tabStale, recovery: !!__paidCommitRecoverySnapshot };
    });
    assert.deepEqual(r, { banner: null, n: 3, tombs: [], ok: true, stored: true, stale: false, recovery: false }, 'UPGRADE ' + JSON.stringify(r));
    await ctx.close();
  });

  await test('⑦ 핀 3곳', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
    for (const [name, text] of [['index.html', SRC], ['sw.js', sw], ['version-sync', vs]]) assert(text.includes('hyeonjang-v556-phototombs'), name);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`photodupsync-v556: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL photodupsync-v556', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

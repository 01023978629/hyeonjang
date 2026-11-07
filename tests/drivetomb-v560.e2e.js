/* v560 서버 Drive 사진 목록이 정리 표시(photoTombs)를 지킨다 — 다른 기기(폰)에서 정리로 뺀 사본이 '미배정'으로 되살아나지 않는다.
   2026-11-07 실측: PC 에서 정리로 뺀 압축본 2장이 부팅 뒤 relayLoadDriveFiles 로 '현장사진/' 미배정 기록으로 다시 들어왔다.
   그 함수는 '다시 불러오지 않기'(__removedIds — 정리한 그 기기 IDB 에만 있음)만 보고 정리 표시는 안 봤다. 그래서 정리를 안 한 기기(폰)는
   정리 표시만 있고 그 기기에 removed_ids 가 없는 Drive 사진(실측 113장)을 미배정으로 들일 수 있었다. 합성 자료·가짜 서버 목록만, 바깥 쓰기 0.
   시드: 가온 O1(IMG_0001.jpg, Drive D_LIVE) · 다시 스캔으로 Drive ID 를 잃은 남긴 기록 K1(IMG_0050.jpg) ·
         정리 표시: D_GONE(O1 의 압축본 사본) · D_DEL(지운 사진) · D_LINK(K1 과 같은 사진의 뺀 사본 — K1 이 이 Drive 파일에 이어져야 함) ·
         D_BACK(되살린 표시 r>t). 서버 목록: D_LIVE · D_GONE · D_DEL · D_LINK · D_BACK · D_NEW(새로 올린 사진).
   ① 새 기기(removed_ids 비어 있음)에서 서버 사진 불러오기 → D_GONE·D_DEL 은 기록이 안 생김 · D_NEW·D_BACK 은 미배정으로 들어옴 ·
      O1 그대로 (RESURRECT)
   ② 이미 있는 기록에 잇기는 그대로 — Drive ID 를 잃은 K1 은 표시된 D_LINK 에 이어지고 새 기록은 안 생김 (LINK)
   ③ 손으로 [서버 사진 불러오기] 하면 '정리한 사진 2장은 다시 넣지 않음' 안내 · 두 번째 불러오기는 아무것도 안 늘림(멱등) (TOAST)
   ④ 복구함·안전판으로 되살리면(r>t) 다시 들어올 수 있음 (REVIVE)
   ⑤ 소스·핀 3곳(v560 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V560_BASELINE=<commit> 은 ① 에서, HJ_V560_MUTATION=no-skip(대조 한 줄 삭제) 은 ① 에서 실패해야 한다. */
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
const SKIP = "        if(tombDrive.has(String(f.id))){tombSkipped++;continue;}";
let html = process.env.HJ_V560_BASELINE ? execFileSync('git', ['show', process.env.HJ_V560_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V560_MUTATION) {
  assert.equal(process.env.HJ_V560_MUTATION, 'no-skip', 'unknown mutation ' + process.env.HJ_V560_MUTATION);
  assert.equal(SRC.split(SKIP).length, 2, 'mutation anchor');
  html = SRC.replace(SKIP, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS drivetomb-v560 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; aiOpsEnsureState().enabled = false;
    // 가짜 서버: 중계는 켜진 것으로, 사진 목록은 아래 SERVER 로. 미리보기·저장은 바깥으로 안 나가게.
    relayReady = () => true; hydrateThumbs = () => {}; relayGetThumbnail = async () => null; relaySaveNow = async () => false;
    window.__toasts = []; const t0 = toast; toast = (msg, ...rest) => { window.__toasts.push(String(msg)); try { return t0(msg, ...rest); } catch (_) { return undefined; } };
    window.__listCalls = 0;
    cloudApiListFiles = async () => { window.__listCalls++; return { ok: true, files: JSON.parse(JSON.stringify(window.__SERVER || [])) }; };
  }, BOOT);
  return { context, page };
}
const SEED = async () => {
  closeModal(true); __tabStale = false; __removedIds = new Set();   // 정리를 안 한 기기(폰) — 이 기기에는 '다시 불러오지 않기'가 없다
  const W = new Date('2026-09-25T01:00:00Z'), T = '2026-11-07T04:53:11.920Z';
  state.projects = [{ name: '가온', stage: 1, phases: ['방수'], cost: {}, customer: {}, archived: false }];
  const rec = (id, name, prefix, size, extra) => Object.assign({ id, name, prefix, kind: 'photo', ext: name.split('.').pop().toLowerCase(), size, when: W, project: '가온', _virtual: true, thumb: null, text: '', ocr: 'na' }, extra || {});
  state.files = [
    rec('O1', 'IMG_0001.jpg', '_정리완료/가온/현장사진/', 600, { _driveId: 'D_LIVE', _phase: '방수' }),
    rec('K1', 'IMG_0050.jpg', '_정리완료/가온/현장사진/', 400, { _phase: '방수' }),   // 다시 스캔으로 Drive ID 를 잃은 남긴 기록
  ];
  state.photoTombs = [
    { k: hjTombKey('현장사진/', 'IMG_0001.jpg', 300, 'D_GONE'), t: T },           // O1 의 폰 압축본 — 정리로 뺌
    { k: hjTombKey('현장사진/', 'IMG_0009.HEIC', 500, 'D_DEL'), t: T },           // 지운 사진
    { k: hjTombKey('현장사진/', 'IMG_0050.jpg', 400, 'D_LINK'), t: T },           // K1 과 같은 사진의 뺀 사본(같은 Drive 파일)
    { k: hjTombKey('현장사진/', 'IMG_0007.jpg', 200, 'D_BACK'), t: T, r: '2026-11-07T05:00:00.000Z' },   // 복구함으로 되살림(r>t)
  ];
  window.__SERVER = [
    { id: 'D_LIVE', name: 'IMG_0001.jpg', mimeType: 'image/jpeg', size: 300, modifiedAt: '2026-09-25T01:00:00Z', kind: 'photo' },
    { id: 'D_GONE', name: 'IMG_0001 (1).jpg', mimeType: 'image/jpeg', size: 300, modifiedAt: '2026-09-25T01:00:00Z', kind: 'photo' },
    { id: 'D_DEL', name: 'IMG_0009.HEIC', mimeType: 'image/heic', size: 500, modifiedAt: '2026-06-12T01:44:57Z', kind: 'photo' },
    { id: 'D_LINK', name: 'IMG_0050.jpg', mimeType: 'image/jpeg', size: 400, modifiedAt: '2026-09-25T01:00:00Z', kind: 'photo' },
    { id: 'D_BACK', name: 'IMG_0007.jpg', mimeType: 'image/jpeg', size: 200, modifiedAt: '2026-09-25T01:00:00Z', kind: 'photo' },
    { id: 'D_NEW', name: 'IMG_0100.jpg', mimeType: 'image/jpeg', size: 700, modifiedAt: '2026-11-07T06:00:00Z', kind: 'photo' },
  ];
  state.activeProject = null; state.tab = 'photos'; state.search = ''; state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null;
  await guardedPersistCurrentState(); render();
};
const view = page => page.evaluate(() => {
  const byDrive = {}; state.files.filter(f => !f._fromQuote).forEach(f => { const k = f._driveId || ('-' + f.id); byDrive[k] = (byDrive[k] || 0) + 1; });
  const o1 = state.files.find(f => f.id === 'O1'), k1 = state.files.find(f => f.id === 'K1');
  return { n: state.files.filter(f => !f._fromQuote).length, byDrive, unassigned: state.files.filter(f => f.kind === 'photo' && !f.project).map(f => f._driveId).sort(),
    o1: o1 && [o1.project, o1._driveId, o1._phase, o1.prefix].join('|'), k1: k1 && [k1.project, k1._driveId, k1._phase].join('|') };
});

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();
    await page.evaluate(SEED);
    await test('① 새 기기에서 서버 사진 불러오기 → 정리로 뺀 D_GONE·D_DEL 은 안 들어옴 · D_NEW·D_BACK 은 들어옴 · O1 그대로 (RESURRECT)', async () => {
      const added = await page.evaluate(() => relayLoadDriveFiles(true));
      const v = await view(page);
      assert.equal(v.byDrive.D_GONE, undefined, 'O1 의 뺀 압축본 D_GONE 이 미배정으로 되살아남 — ' + JSON.stringify(v));
      assert.equal(v.byDrive.D_DEL, undefined, '지운 사진 D_DEL 이 미배정으로 되살아남 — ' + JSON.stringify(v));
      assert.equal(v.byDrive.D_NEW, 1, '새로 올린 사진 D_NEW 는 들어와야 함');
      assert.equal(v.byDrive.D_BACK, 1, '되살린 표시(r>t)의 D_BACK 은 들어와야 함');
      assert.deepEqual(v.unassigned, ['D_BACK', 'D_NEW'], '미배정은 새 사진·되살린 사진만');
      assert.equal(v.o1, '가온|D_LIVE|방수|_정리완료/가온/현장사진/', 'O1 정보 그대로');
      assert.equal(v.byDrive.D_LIVE, 1, '같은 Drive 사진 기록 둘 아님');
      assert.equal(added, 3, '들임 2 + 잇기 1 — ' + added);
    });
    await test('② 이미 있는 기록에 잇기는 그대로 — Drive ID 를 잃은 K1 이 D_LINK 에 이어짐 · 새 기록 0 (LINK)', async () => {
      const v = await view(page);
      assert.equal(v.k1, '가온|D_LINK|방수', 'K1 이 D_LINK 에 이어지고 현장·공정 그대로 — ' + v.k1);
      assert.equal(v.byDrive.D_LINK, 1, 'D_LINK 기록은 K1 하나');
      assert.equal(v.n, 4, 'O1 · K1 · D_BACK · D_NEW');
    });
    await test('③ 손으로 불러오기 → "정리한 사진 2장은 다시 넣지 않음" · 두 번째도 그대로(멱등) (TOAST)', async () => {
      const r = await page.evaluate(async () => { window.__toasts = []; const n = await relayLoadDriveFiles(false); return { n, toasts: window.__toasts.slice() }; });
      assert.equal(r.n, 0, '두 번째 불러오기는 아무것도 안 늘림');
      assert.ok(r.toasts.some(t => t.includes('새로 불러올 서버 사진이 없습니다') && t.includes('정리한 사진 2장은 다시 넣지 않음')), '안내 — ' + JSON.stringify(r.toasts));
      const v = await view(page);
      assert.equal(v.n, 4, '그대로 4');
    });
    await test('④ 복구함·안전판으로 되살리면(r>t) 다시 들어올 수 있음 (REVIVE)', async () => {
      const v = await page.evaluate(async () => {
        state.photoTombs = hjTombUpdate(state.photoTombs, [], [{ prefix: '현장사진/', name: 'IMG_0009.HEIC', size: 500, _driveId: 'D_DEL' }], state.files, new Date().toISOString());
        await relayLoadDriveFiles(true);
        return state.files.filter(f => f._driveId === 'D_DEL').map(f => [f.prefix, f.project || ''].join('|'));
      });
      assert.deepEqual(v, ['현장사진/|'], '되살린 D_DEL 은 미배정으로 다시 들어옴');
      const left = await page.evaluate(() => state.files.filter(f => f._driveId === 'D_GONE').length);
      assert.equal(left, 0, '되살리지 않은 D_GONE 은 여전히 안 들어옴');
    });
    await test('⑤ 소스·핀 3곳(v560 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 560, '핀 v560 이상 ' + a);
      assert.ok(src.includes(SKIP), 'Drive 목록 대조가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
    console.log(`drivetomb-v560: ${passed}/5 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL drivetomb-v560 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

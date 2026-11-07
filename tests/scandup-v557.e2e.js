/* v557 [다시 스캔]이 정리한 사진을 되살리거나 멈추지 않는다 — 2026-11-06 현장 실측 세 가지.
   ① 멈춤: 내용 0바이트 사진(…공사_06.jpg)·깨진 JPEG 에서 EXIF 읽기가 끝나지 않아 스캔이 영원히 멈췄고(910/1,764),
      그 사이 자동 저장이 반쯤 읽은 목록을 기기·서버·폴더에 저장했다(사진 1,738 → 848, 현장 배정 풀림).
   ② 되살림: 목록에서 뺀 중복((1) 사본·폰 압축본·다른 폴더 사본)의 실제 파일이 PC 에 남아 있어 스캔이 다시 기록을 만들었다
      (사진 1,704 → 2,230). v556 정리 표시는 [경로·이름·크기·Drive ID] 가 똑같아야 걸러서, Drive ID 를 다르게 되찾은 사본은 못 걸렀다.
   ③ 엉뚱한 연결: 이름만 같은 사본(크기가 다른 압축본)이 원본 기록의 Drive ID·현장을 이름으로 물려받아 같은 Drive 사진 기록이 둘이 됐다.
   합성 폴더·합성 JPEG 만, 바깥 쓰기 0. 시드(정리 뒤 상태, 보관 중인 것은 정리 표시로):
     수정타운 K_A.jpg + 뺀 사본 'K_A (1).jpg'(같은 바이트) · 가온 IMG_G.jpg — 남긴 기록은 Drive 폴더 경로(PC 에 없음), PC 사본 기록은 뺌 ·
     도램 K_D.jpg 원본 + 뺀 현장사진/K_D.jpg 압축본(이름 같고 크기 다름) · 한신교회 K_M.jpg 를 PC 에서 다른 폴더로 옮김 ·
     망월 P.jpg 같은 경로·크기 기록 둘 중 하나만 뺌(남긴 쪽은 그대로) · 용전신동 0바이트 E.jpg · 깨진 T.jpg · 정리 표시 없는 압축본(옛 정리분) 하나.
   ① 멈추지 않음(20초 안) · 0바이트 건너뜀 안내 · 깨진 JPEG 는 기록 (STALL)
   ② 스캔 도중 저장 0회 — 반쪽 목록이 기기 저장본에 안 들어감 · 끝난 뒤 한 번 저장 (PARTIAL)
   ③ 뺀 사본 4가지가 안 돌아옴 · 남긴 기록 정보 그대로 · 같은 Drive ID 기록 0 · 현장별 장수 그대로 (RESURRECT)
   ④ 옮긴 파일은 이름으로 배정 복구(v101) · 같은 경로 남긴 기록은 안 숨김 · 정리 표시 없는 압축본은 원본의 Drive ID·현장을 안 가져감 (LINK)
   ⑤ 두 번째 스캔도 같은 결과(멱등) (AGAIN)
   ⑥ 핀 3곳
   HJ_V557_BASELINE=<commit> 은 ① 에서, HJ_V557_MUTATION=no-path(경로 표시 대조 삭제) 은 ③ 에서, no-gate(이름 복구 사본 검사 삭제) 은 ④ 에서 실패해야 한다. */
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
const EXIF_JS = fs.readFileSync(path.join(__dirname, 'fixtures', 'vendor', 'exif-js-2.3.0.js'), 'utf8');
let html = process.env.HJ_V557_BASELINE ? execFileSync('git', ['show', process.env.HJ_V557_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-path': ['&&__tombPath.has(hjTombPathOf(f))&&', '&&false&&'],
  'no-gate': ['if(b&&window.__scanDiskPaths&&window.__scanDiskPaths.has(b.__path))b=null;', ''],
};
if (process.env.HJ_V557_MUTATION) {
  const [from, to] = MUT[process.env.HJ_V557_MUTATION] || [];
  assert(from && SRC.includes(from), 'mutation anchor ' + process.env.HJ_V557_MUTATION);
  html = SRC.replace(from, to);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    // 실제 PC 처럼 EXIF 라이브러리가 있어야 깨진 JPEG 멈춤이 재현된다 — 같은 판(2.3.0)을 검사 폴더에서 준다(바깥 요청 없음)
    if (read && url.href === 'https://cdnjs.cloudflare.com/ajax/libs/exif-js/2.3.0/exif.min.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: EXIF_JS });
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    aiAutoOrgOffer = () => {}; quoteAutoAssignOffer = () => {}; if (typeof hjEstimateAutoRead === 'function') hjEstimateAutoRead = () => {};
  }, BOOT);
  assert.equal(await page.evaluate(() => typeof EXIF !== 'undefined' && typeof EXIF.getData), 'function', 'real exif-js loaded (the stall needs it)');
  return { context, page };
}

// 페이지 안: 합성 폴더 + 정리 뒤 상태를 심는다. 폴더 쓰기는 _현장.json 만 메모리로 받는다.
const SEED = async () => {
  closeModal(true); __tabStale = false;
  const jpeg = async (color, q) => { const c = new OffscreenCanvas(24, 24), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 24, 24); x.fillStyle = '#fff'; x.fillRect(3, 3, 9, 9); x.fillStyle = '#123'; x.fillRect(13, 13, 7, 7); return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: q })).arrayBuffer()); };
  const B = { A: await jpeg('#c33', .95), G: await jpeg('#3c3', .95), D: await jpeg('#33c', .95), Dsmall: await jpeg('#33c', .2), M: await jpeg('#cc3', .95), P: await jpeg('#3cc', .95), Z: await jpeg('#c3c', .95), Zsmall: await jpeg('#c3c', .2) };
  if (B.D.length === B.Dsmall.length || B.Z.length === B.Zsmall.length) throw Error('fixture: compressed copies must differ in size');
  // 촬영 시각·GPS 가 든 JPEG(APP1 Exif/TIFF 직접 조립) — EXIF 읽기 방식을 바꿔도 날짜·위치가 그대로 읽히는지
  const exifJpeg = base => {
    const u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255], rat = (n, d) => [...u32(n), ...u32(d)], t = [];
    t.push(0x49, 0x49, 0x2A, 0x00, ...u32(8));
    t.push(...u16(2), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(38), ...u16(0x8825), ...u16(4), ...u32(1), ...u32(56), ...u32(0));
    t.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(110), ...u32(0));
    t.push(...u16(4), ...u16(1), ...u16(2), ...u32(2), 0x4E, 0, 0, 0, ...u16(2), ...u16(5), ...u32(3), ...u32(130), ...u16(3), ...u16(2), ...u32(2), 0x45, 0, 0, 0, ...u16(4), ...u16(5), ...u32(3), ...u32(154), ...u32(0));
    for (const c of '2026:06:29 10:30:00') t.push(c.charCodeAt(0)); t.push(0);
    t.push(...rat(36, 1), ...rat(20, 1), ...rat(556, 10), ...rat(127, 1), ...rat(22, 1), ...rat(456, 10));
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t], len = payload.length + 2;
    return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, len >> 8, len & 255, ...payload, ...base.slice(2)]);
  };
  B.X = exifJpeg(await jpeg('#888', .9));
  const T0 = 1750000000000;
  window.__fx = { reads: [], writes: [], forbidden: [], hooks: {} };
  const deny = what => { __fx.forbidden.push(what); throw Error('fixture write prohibited: ' + what); };
  const file = (name, bytes, at) => ({ kind: 'file', name, createWritable: () => deny('file ' + name), queryPermission: async () => 'granted',
    getFile: async () => { __fx.reads.push(name); const hook = __fx.hooks[name]; if (hook) await hook(); return new File([bytes], name, { type: name.endsWith('.json') ? 'application/json' : 'image/jpeg', lastModified: at || T0 }); } });
  const dir = (name, entries) => {
    const d = { kind: 'directory', name, entries: null, removeEntry: async n => deny('remove ' + n), queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *entries() { for (const e of d.list) yield [e.name, e]; },
      async getFileHandle(n, o) {
        const f = d.list.find(e => e.kind === 'file' && e.name === n);
        if (f) return f;
        if (o && o.create && n === '_현장.json') { const nf = jsonFile(n); d.list.push(nf); return nf; }
        if (o && o.create) deny('create ' + n);
        throw new DOMException('not found', 'NotFoundError');
      },
      async getDirectoryHandle(n, o) { const s = d.list.find(e => e.kind === 'directory' && e.name === n); if (s) return s; if (o && o.create) deny('mkdir ' + n); throw new DOMException('not found', 'NotFoundError'); } };
    d.list = entries; return d;
  };
  const jsonFile = name => { const h = { kind: 'file', name, body: '', queryPermission: async () => 'granted',
    getFile: async () => new File([h.body], name, { type: 'application/json', lastModified: Date.now() }),
    createWritable: async () => { let buf = ''; return { write: async v => { buf += typeof v === 'string' ? v : await new Blob([v]).text(); }, close: async () => { h.body = buf; __fx.writes.push(name); } }; } }; return h; };
  const P = {
    A: '_정리완료/수정타운아파트/현장사진/', G: '_정리완료/가온마을/현장사진/', GD: '_정리완료/세종 가온마을/2차 방수 작업/', D: '_정리완료/도램아파트/현장사진/',
    RAW: '현장사진/', M: '_정리완료/한신교회/고정 작업/', MP: '_정리완료/망월카페/현장사진/', Y: '_정리완료/용전신동아파트/현장사진/', Z: '_정리완료/도램아파트/현장사진/',
  };
  const h = {
    A: file('K_A.jpg', B.A), A1: file('K_A (1).jpg', B.A), G: file('IMG_G.jpg', B.G), D: file('K_D.jpg', B.D), Ds: file('K_D.jpg', B.Dsmall),
    M: file('K_M.jpg', B.M), P: file('P.jpg', B.P), E: file('E.jpg', new Uint8Array(0)), T: file('T.jpg', new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])),
    Z: file('K_Z.jpg', B.Z), Zs: file('K_Z.jpg', B.Zsmall), X: file('EXIF.jpg', B.X),
  };
  const json = jsonFile('_현장.json');
  const root = dir('만물', [
    dir('현장사진', [h.Ds, h.Zs]),
    dir('_정리완료', [
      dir('수정타운아파트', [dir('현장사진', [h.A, h.A1])]),
      dir('가온마을', [dir('현장사진', [h.G])]),
      dir('도램아파트', [dir('현장사진', [h.D, h.Z])]),
      dir('한신교회', [dir('고정 작업', [h.M])]),
      dir('망월카페', [dir('현장사진', [h.P])]),
      dir('용전신동아파트', [dir('현장사진', [h.E, h.T, h.X])]),
    ]),
    json,
  ]);
  window.__fx.root = root; window.__fx.json = json;
  const proj = name => ({ name, stage: 1, phases: [], cost: {}, customer: {}, archived: false });
  state.projects = ['수정타운아파트', '세종 가온마을아파트', '도램아파트', '한신교회', '망월카페', '용전신동아파트'].map(proj);
  const rec = (id, name, prefix, bytes, handle, extra) => Object.assign({ id, name, prefix, kind: 'photo', ext: 'jpg', size: bytes.length, when: new Date(T0), handle: handle || null, _virtual: !handle, project: null, ocr: 'na', text: '' }, extra || {});
  const keep = [
    rec('kA', 'K_A.jpg', P.A, B.A, h.A, { project: '수정타운아파트', _worklabel: '세탁실 우수관', _driveId: 'DA' }),
    rec('kG', 'IMG_G.jpg', P.GD, B.G, null, { project: '세종 가온마을아파트', _phase: '2차 방수 작업', _worklabel: '2차 방수', _driveId: 'DG' }),
    rec('kD', 'K_D.jpg', P.D, B.D, h.D, { project: '도램아파트', _worklabel: '오수관 교체', _driveId: 'DD1' }),
    rec('kM', 'K_M.jpg', P.RAW, B.M, null, { project: '한신교회', _worklabel: '실리콘 작업' }),   // PC 에서는 _정리완료/한신교회/고정 작업/ 으로 옮겨졌다
    rec('kP', 'P.jpg', P.MP, B.P, h.P, { project: '망월카페', _worklabel: '바닥 방수', _driveId: 'E1' }),
    rec('kZ', 'K_Z.jpg', P.Z, B.Z, h.Z, { project: '도램아파트', _worklabel: '도램 욕실', _driveId: 'DZ1' }),
  ];
  const drop = [
    rec('xA1', 'K_A (1).jpg', P.A, B.A, h.A1, { project: '수정타운아파트', _driveId: 'DA2' }),
    rec('xG', 'IMG_G.jpg', P.G, B.G, h.G, { project: '세종 가온마을아파트', _driveId: 'DG' }),
    rec('xD', 'K_D.jpg', P.RAW, B.Dsmall, h.Ds, { _driveId: 'DD2' }),
    rec('xP', 'P.jpg', P.MP, B.P, h.P, { project: '망월카페', _driveId: 'E2' }),
  ];
  state.files = [...keep, ...drop];
  state.activeProject = null; state.tab = 'photos'; state.search = ''; state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state.aptOrders = []; state._demo = false;
  state.dirHandle = null; if ('photoTombs' in state) state.photoTombs = [];
  __photoCache.key = ''; __sel.clear();
  if (!(await guardedPersistCurrentState())) throw Error('seed persist failed');
  // 정리(목록에서 빼기) — 정리 표시가 같이 저장되는 길. 옛 판(표시 없음)은 5번째 인자를 무시한다.
  const refs = state.files.slice(), before = JSON.stringify(serializeData().files);
  const current = () => refs.length === state.files.length && refs.every((f, i) => state.files[i] === f) && before === JSON.stringify(serializeData().files);
  if (!(await guardedPersistMediaFiles(state.files.filter(f => !drop.includes(f)), current, undefined, undefined, { tomb: true }))) throw Error('seed drop failed');
  // 옛 정리분(정리 표시 없음) — 압축본 K_Z 사본은 목록에 없고 표시도 없다.
  const saved = serializeData();
  __lastData = JSON.parse(JSON.stringify(saved)); __dataAt = saved.savedAt;
  json.body = JSON.stringify(saved);
  window.__fx.pre = { photos: state.files.filter(f => f.kind === 'photo').length, counts: Object.fromEntries(state.projects.map(p => [p.name, state.files.filter(f => f.project === p.name).length])), tombs: (state.photoTombs || []).length };
  return window.__fx.pre;
};
// 페이지 안: 스캔 한 번. 20초 안에 안 끝나면 HANG. 스캔 도중 저장 시도를 센다.
const SCAN = async (opts) => {
  window.__inWalk = 0; window.__saveDuringWalk = []; window.__photosAtSave = [];
  if (!window.__walkWrapped) {
    const realWalk = walk; walk = async (...a) => { window.__inWalk++; try { return await realWalk(...a); } finally { window.__inWalk--; } };
    const realGP = guardedPersistCurrentState; guardedPersistCurrentState = async (...a) => { if (window.__inWalk > 0) window.__saveDuringWalk.push(state.files.length); return realGP(...a); };
    window.__walkWrapped = true;
  }
  __fx.hooks = {};
  if (opts && opts.dirtyMid) __fx.hooks['K_M.jpg'] = async () => {
    markDirty(); await new Promise(r => setTimeout(r, 1300)); window.__midStored = (await idbGetStrict('appState')).files.length;
    // 스캔 도중 서버 연결이 있다면 — Drive 사진 불러오기·서버 자료 적용·서버 올리기가 서버에 닿지 않아야 한다(11/6: 반쪽 목록에 386장을 새로 들였다)
    const keep = { relayReady, cloudApiListFiles, cloudApiLoad }; window.__midServer = 0;
    relayReady = () => true; cloudApiListFiles = async () => { __midServer++; return { ok: true, files: [] }; }; cloudApiLoad = async () => { __midServer++; return { ok: true, exists: false }; };
    try { window.__midDrive = await relayLoadDriveFiles(true); window.__midApply = await relayLoadApply(true); window.__midPush = await relaySaveNow(false); }
    finally { relayReady = keep.relayReady; cloudApiListFiles = keep.cloudApiListFiles; cloudApiLoad = keep.cloudApiLoad; }
  };
  state.dirHandle = __fx.root;
  const t0 = Date.now();
  const r = await Promise.race([scanDir().then(() => 'done', e => 'err:' + (e && e.message)), new Promise(res => setTimeout(() => res('HANG'), 20000))]);
  await new Promise(res => setTimeout(res, 1500));
  const photos = state.files.filter(f => f.kind === 'photo');
  const byDrive = {}; photos.forEach(f => { if (f._driveId) byDrive[f._driveId] = (byDrive[f._driveId] || 0) + 1; });
  const row = f => ({ name: f.name, prefix: f.prefix, size: f.size, project: f.project || null, phase: f._phase || null, worklabel: f._worklabel || null, drive: f._driveId || null, live: !!f.handle, when: f.when ? new Date(f.when).toISOString() : null, lat: f.lat == null ? null : Math.round(f.lat * 1e4) / 1e4, lng: f.lng == null ? null : Math.round(f.lng * 1e4) / 1e4 });
  const stored = await idbGetStrict('appState');
  return { r, sec: Math.round((Date.now() - t0) / 1000), toast: document.getElementById('toast').textContent, rows: photos.map(row).sort((a, b) => (a.prefix + a.name + a.size).localeCompare(b.prefix + b.name + b.size)),
    dupDrive: Object.entries(byDrive).filter(([, n]) => n > 1).map(([k]) => k), counts: Object.fromEntries(state.projects.map(p => [p.name, state.files.filter(f => f.project === p.name).length])),
    saveDuringWalk: window.__saveDuringWalk, midStored: window.__midStored, midServer: window.__midServer, midDrive: window.__midDrive, midApply: window.__midApply, midPush: window.__midPush, storedPhotos: stored.files.filter(f => f.kind === 'photo').length, tombs: (state.photoTombs || []).length, forbidden: __fx.forbidden, busy: !!window.__hjScanBusy };
};

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS scandup-v557 ' + name); }
  const { context, page } = await openPage();
  const pre = await page.evaluate(SEED);
  let first = null;

  await test('① 0바이트·깨진 JPEG 에서 멈추지 않음 · 0바이트 건너뜀 안내 · 깨진 JPEG 는 기록 · 촬영 날짜·위치는 그대로 읽힘 (STALL)', async () => {
    first = await page.evaluate(SCAN, { dirtyMid: true });
    assert.equal(first.r, 'done', 'STALL scan must finish within 20s, got ' + first.r + ' toast=' + first.toast);
    assert(!first.rows.some(r => r.name === 'E.jpg'), 'zero-byte file is not indexed');
    assert(first.rows.some(r => r.name === 'T.jpg' && r.project === '용전신동아파트'), 'broken JPEG still indexed under its folder project ' + JSON.stringify(first.rows.filter(r => /^[ET]\./.test(r.name))));
    assert.match(first.toast, /0바이트[^·]*1/, 'toast mentions the skipped empty file: ' + first.toast);
    const x = first.rows.find(r => r.name === 'EXIF.jpg');
    assert.deepEqual(x && [x.when, x.lat, x.lng], ['2026-06-29T01:30:00.000Z', 36.3488, 127.3793], 'EXIF date/GPS still read ' + JSON.stringify(x));
    assert.equal(first.busy, false, 'scan busy flag released');
  });

  await test('② 스캔 도중 저장·서버 받기/올리기 0회 · 반쪽 목록이 저장본에 안 들어감 · 끝난 뒤 한 번 저장 (PARTIAL)', async () => {
    assert.deepEqual(first.saveDuringWalk, [], 'PARTIAL no persist while the folder is being read ' + JSON.stringify(first.saveDuringWalk));
    assert(first.midStored >= pre.photos, 'stored list mid-scan is the full pre-scan list (' + first.midStored + ' < ' + pre.photos + ')');
    assert.equal(first.storedPhotos, first.rows.length, 'after the scan the final list is saved once');
    assert.deepEqual([first.midServer, first.midDrive, first.midApply, first.midPush], [0, 0, false, false], 'no server pull/push while scanning ' + JSON.stringify([first.midServer, first.midDrive, first.midApply, first.midPush]));
  });

  await test('③ 뺀 사본이 안 돌아옴 · 남긴 기록 그대로 · 같은 Drive ID 기록 0 · 현장별 장수 그대로 (RESURRECT)', async () => {
    const names = first.rows.map(r => r.prefix + r.name + '|' + r.size);
    assert(!first.rows.some(r => r.name === 'K_A (1).jpg'), 'RESURRECT (1) copy came back ' + JSON.stringify(names));
    assert.equal(first.rows.filter(r => r.name === 'IMG_G.jpg').length, 1, 'RESURRECT one IMG_G record ' + JSON.stringify(first.rows.filter(r => r.name === 'IMG_G.jpg')));
    const g = first.rows.find(r => r.name === 'IMG_G.jpg');
    assert.deepEqual([g.project, g.phase, g.worklabel, g.drive], ['세종 가온마을아파트', '2차 방수 작업', '2차 방수', 'DG'], 'keeper metadata kept ' + JSON.stringify(g));
    assert.equal(first.rows.filter(r => r.name === 'K_D.jpg').length, 1, 'RESURRECT compressed copy came back ' + JSON.stringify(first.rows.filter(r => r.name === 'K_D.jpg')));
    assert.deepEqual(first.dupDrive, [], 'no two records share a Drive ID ' + JSON.stringify(first.dupDrive));
    for (const [p, n] of Object.entries(pre.counts)) if (p !== '용전신동아파트') assert.equal(first.counts[p], n, 'project count unchanged: ' + p + ' ' + JSON.stringify(first.counts));
    assert(first.tombs >= 4, 'tombs kept ' + first.tombs);
  });

  await test('④ 옮긴 파일은 이름으로 복구 · 같은 경로 남긴 기록은 안 숨김 · 표시 없는 압축본은 원본 연결을 안 가져감 (LINK)', async () => {
    const m = first.rows.filter(r => r.name === 'K_M.jpg');
    assert.equal(m.length, 1, JSON.stringify(m)); assert.equal(m[0].project, '한신교회', 'moved file keeps its project (v101 BUG-5)'); assert.equal(m[0].prefix, '_정리완료/한신교회/고정 작업/');
    const p = first.rows.filter(r => r.name === 'P.jpg');
    assert.equal(p.length, 1, 'same-path keeper is not hidden by the other record\'s tomb ' + JSON.stringify(p)); assert.equal(p[0].drive, 'E1'); assert.equal(p[0].project, '망월카페');
    const z = first.rows.filter(r => r.name === 'K_Z.jpg');
    const orig = z.find(r => r.prefix === '_정리완료/도램아파트/현장사진/'), copy = z.find(r => r.prefix === '현장사진/');
    assert(orig && orig.drive === 'DZ1' && orig.project === '도램아파트' && orig.worklabel === '도램 욕실', 'original keeps its link ' + JSON.stringify(z));
    assert(copy && copy.drive !== 'DZ1' && copy.project !== '도램아파트', 'LINK un-marked compressed copy must not inherit the original\'s Drive ID/project by name ' + JSON.stringify(z));
  });

  await test('⑤ 두 번째 스캔도 같은 결과 (AGAIN)', async () => {
    const again = await page.evaluate(SCAN, {});
    assert.equal(again.r, 'done');
    assert.deepEqual(again.rows.map(r => [r.prefix, r.name, r.size, r.project, r.drive]), first.rows.map(r => [r.prefix, r.name, r.size, r.project, r.drive]), 'AGAIN idempotent');
    assert.deepEqual(again.dupDrive, []);
    assert.deepEqual(again.forbidden, [], 'no writes into the folder except _현장.json');
  });

  await test('⑥ 핀 3곳(v557 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
    const pins = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (sw.match(/const C='([^']+)'/) || [])[1], (vs.match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p && p === pins[0]), 'pins equal ' + JSON.stringify(pins));
    assert(Number((pins[0].match(/-v(\d+)-/) || [])[1]) >= 557, 'pin v557+ ' + pins[0]);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });
  await context.close();
  console.log(`scandup-v557: ${passed}/${passed} PASS; synthetic folder; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL scandup-v557', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

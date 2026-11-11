/* v570 [다시 열기](스캔) 도중 서버 사진 목록 맞추기가 '미배정 사본'을 만들지 않는다 + 예전에 생긴 서버 사본 쌍둥이 정리.
   2026-11-11 실측(PC): 앱을 연 직후 [다시 열기]를 누르자, 그 전에 시작해 서버 응답을 기다리던 서버 사진 목록 맞추기(relayLoadDriveFiles)가
   스캔이 목록을 비운 사이에 끝나 '없는' Drive 사진 72장을 '현장사진/' 미배정 사본으로 새로 들였다. 시작할 때만 스캔 중인지 봤기 때문.
   스캔이 원래 기록(같은 Drive ID·같은 이름, 현장 다섯 곳)을 되살린 뒤에도 사본은 남아 '미배정 사진 72'로 보였다.
   합성 폴더·합성 JPEG·가짜 서버 목록만, 바깥 쓰기 0.
   ① 목록을 기다리는 사이 스캔이 시작되면 멈춤 → 스캔 도중 저장 0 · 사본 0 · 스캔이 끝나면 한 번 다시 맞춰 새 사진(D_NEW)만 미배정으로 (RACE)
   ② 이미 생긴 사본 정리: 같은 Drive ID·같은 이름의 손대지 않은 미배정 사본만 뺌 — 이름 다름·모두 사본·작업명 있음·크기가 서버와 다름·이 기기 원본 있음은 그대로 ·
      안내 '서버 사본 중복 n장 정리' · 기기 저장본에도 · 두 번째는 0 (HEAL)
   ③ 소스·핀 3곳(v570 이상·서로 같음) · 페이지 오류 0 · 바깥 쓰기 0
   (스캔은 따로 정리하지 않는다 — 저장본에 든 사본은 스캔의 저장본 적용(applyData → mergeOrganizedPhotoDuplicates 이름 짝)이 이미 정리본으로 합친다.
    남는 길은 부팅이 정확 복원(유상 generation)이라 applyData 를 안 거치는 기기 — 그래서 부팅·불러오기 때 도는 목록 맞추기에서 정리한다.)
   HJ_V570_BASELINE=<commit> 은 ① 에서, HJ_V570_MUTATION=no-recheck 는 ① 에서, no-heal 은 ② 에서 실패해야 한다. */
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
const RECHECK = "      if((typeof hjScanBusy==='function'&&hjScanBusy())){window.__hjRelayFilesDeferred=true;return 0;}\n";
const MUT = {
  'no-recheck': [RECHECK, ''],
  'no-heal': ['const healed=hjDropBareRelayTwins();', 'const healed=0;'],
};
let html = process.env.HJ_V570_BASELINE ? execFileSync('git', ['show', process.env.HJ_V570_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V570_MUTATION) {
  const [from, to] = MUT[process.env.HJ_V570_MUTATION] || [];
  assert(from && SRC.split(from).length === 2, 'mutation anchor ' + process.env.HJ_V570_MUTATION);
  html = SRC.replace(from, to);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS relayscan-v570 ' + name); }
async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
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
    taxCalendarEnsure(); coworkSchedEnsure();   // 부팅 4초 뒤 도는 자료 씨앗을 미리 — 검사 중에 끼어들지 않게(v507 과 같은 방법)
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; aiOpsEnsureState().enabled = false;
    aiAutoOrgOffer = () => {}; quoteAutoAssignOffer = () => {}; if (typeof hjEstimateAutoRead === 'function') hjEstimateAutoRead = () => {};
    // 가짜 서버: 중계는 켜진 것으로, 사진 목록은 __SERVER 로(문 __gate 가 있으면 열릴 때까지 기다림). 미리보기·서버 저장은 바깥으로 안 나가게.
    relayReady = () => true; hydrateThumbs = () => {}; relayGetThumbnail = async () => null; relaySaveNow = async () => false;
    window.__toasts = []; const t0 = toast; toast = (msg, ...rest) => { window.__toasts.push(String(msg)); try { return t0(msg, ...rest); } catch (_) { return undefined; } };
    window.__listCalls = 0; window.__gate = null;
    cloudApiListFiles = async () => { window.__listCalls++; if (window.__gate) await window.__gate; return { ok: true, files: JSON.parse(JSON.stringify(window.__SERVER || [])) }; };
    window.__savesDuringScan = 0;
    const realGP = guardedPersistCurrentState;
    guardedPersistCurrentState = async (...a) => { if (hjScanBusy()) window.__savesDuringScan++; return realGP(...a); };
  }, BOOT);
  return { context, page };
}

// 페이지 안: 합성 폴더(만물/현장사진 · _정리완료/가나아파트/현장사진/K_1·K_2.jpg · _현장.json) + 정리된 기록 둘(D1·D2).
// extra 는 저장본에만 있는 기록(서버 사본 등) — 폴더에는 없다.
const SEED = async (extra) => {
  closeModal(true); __tabStale = false; __removedIds = new Set();
  const jpeg = async (color) => { const c = new OffscreenCanvas(24, 24), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 24, 24); x.fillStyle = '#fff'; x.fillRect(4, 4, 9, 9); return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: .9 })).arrayBuffer()); };
  const B1 = await jpeg('#c33'), B2 = await jpeg('#3c3');
  window.__fx = { hooks: {}, forbidden: [] };
  const deny = what => { __fx.forbidden.push(what); throw Error('fixture write prohibited: ' + what); };
  const file = (name, bytes) => ({ kind: 'file', name, createWritable: () => deny('file ' + name), queryPermission: async () => 'granted',
    getFile: async () => { const hook = __fx.hooks[name]; if (hook) await hook(); return new File([bytes], name, { type: 'image/jpeg', lastModified: 1750000000000 }); } });
  const jsonFile = name => { const h = { kind: 'file', name, body: '', queryPermission: async () => 'granted',
    getFile: async () => new File([h.body], name, { type: 'application/json', lastModified: Date.now() }),
    createWritable: async () => { let buf = ''; return { write: async v => { buf += typeof v === 'string' ? v : await new Blob([v]).text(); }, close: async () => { h.body = buf; } }; } }; return h; };
  const dir = (name, entries) => {
    const d = { kind: 'directory', name, removeEntry: async n => deny('remove ' + n), queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *entries() { for (const e of d.list) yield [e.name, e]; },
      async getFileHandle(n, o) { const f = d.list.find(e => e.kind === 'file' && e.name === n); if (f) return f; if (o && o.create && n === '_현장.json') { const nf = jsonFile(n); d.list.push(nf); return nf; } if (o && o.create) deny('create ' + n); throw new DOMException('not found', 'NotFoundError'); },
      async getDirectoryHandle(n, o) { const s = d.list.find(e => e.kind === 'directory' && e.name === n); if (s) return s; if (o && o.create) deny('mkdir ' + n); throw new DOMException('not found', 'NotFoundError'); } };
    d.list = entries; return d;
  };
  const h1 = file('K_1.jpg', B1), h2 = file('K_2.jpg', B2), json = jsonFile('_현장.json');
  const root = dir('만물', [dir('현장사진', []), dir('_정리완료', [dir('가나아파트', [dir('현장사진', [h1, h2])])]), json]);
  __fx.root = root; __fx.json = json;
  const P = '_정리완료/가나아파트/현장사진/', W = new Date('2026-09-15T00:28:44Z');
  state.projects = [{ name: '가나아파트', stage: 1, phases: [], cost: {}, customer: {}, archived: false }];
  const rec = (id, name, prefix, size, more) => Object.assign({ id, name, prefix, kind: 'photo', ext: 'jpg', size, when: W, project: null, _virtual: true, handle: null, thumb: null, text: '', ocr: 'na', lat: null, lng: null }, more || {});
  state.files = [
    rec('O1', 'K_1.jpg', P, B1.length, { project: '가나아파트', _worklabel: '배관 교체', _driveId: 'D1', _driveMimeType: 'image/jpeg', _driveSize: 300 }),
    rec('O2', 'K_2.jpg', P, B2.length, { project: '가나아파트', _worklabel: '배관 교체', _driveId: 'D2', _driveMimeType: 'image/jpeg', _driveSize: 300 }),
    ...(extra || []).map(x => rec(x.id, x.name, x.prefix, x.size, x.more)),
  ];
  window.__SERVER = [
    { id: 'D1', name: 'K_1.jpg', mimeType: 'image/jpeg', size: 300, modifiedAt: '2026-10-31T06:14:58Z', kind: 'photo' },
    { id: 'D2', name: 'K_2.jpg', mimeType: 'image/jpeg', size: 300, modifiedAt: '2026-10-31T06:14:58Z', kind: 'photo' },
    { id: 'D_NEW', name: 'IMG_NEW.jpg', mimeType: 'image/jpeg', size: 500, modifiedAt: '2026-11-10T08:00:00Z', kind: 'photo' },
  ];
  state.activeProject = null; state.tab = 'photos'; state.search = ''; state.quotes = []; state.schedule = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null;
  if ('photoTombs' in state) state.photoTombs = [];
  __photoCache.key = '';
  if (!(await guardedPersistCurrentState())) throw Error('seed persist failed');
  const saved = serializeData(); __lastData = JSON.parse(JSON.stringify(saved)); __dataAt = saved.savedAt; json.body = JSON.stringify(saved);
  window.__savesDuringScan = 0; window.__listCalls = 0; window.__gate = null; window.__toasts = []; window.__hjRelayFilesDeferred = false;
  return state.files.length;
};
const VIEW = () => {
  const byDrive = {}; state.files.filter(f => !f._fromQuote).forEach(f => { if (f._driveId) byDrive[f._driveId] = (byDrive[f._driveId] || 0) + 1; });
  const row = f => [f.id && /^[A-Z]\d|^[A-Z]{1,2}\d/.test(f.id) ? f.id : '-', f.prefix, f.name, f.project || '', f._worklabel || '', f._driveId || ''].join('|');
  return { n: state.files.filter(f => !f._fromQuote).length, byDrive, unassigned: state.files.filter(f => f.kind === 'photo' && !f.project).map(f => f._driveId || f.name).sort(),
    rows: state.files.filter(f => !f._fromQuote).map(row).sort() };
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open();

    await test('① 목록을 기다리는 사이 스캔이 시작되면 멈춤 — 스캔 도중 저장 0 · 사본 0 · 끝나면 한 번 다시 맞춰 새 사진만 미배정 (RACE)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(async () => {
        window.__gate = new Promise(res => { window.__openGate = res; });
        // 스캔이 첫 사진을 읽는 순간 서버 응답이 온다(문을 열고 1.5초 쉼) — 11/11 PC 와 같은 순서: 목록 맞추기 먼저 시작 → [다시 열기] → 응답은 스캔 도중
        __fx.hooks['K_1.jpg'] = async () => { window.__openGate(); await new Promise(res => setTimeout(res, 1500)); };
        const relayP = relayLoadDriveFiles(true);
        await new Promise(res => setTimeout(res, 50));
        state.dirHandle = __fx.root;
        const scanR = await Promise.race([scanDir().then(() => 'done', e => 'err:' + (e && e.message)), new Promise(res => setTimeout(() => res('HANG'), 20000))]);
        const relayR = await relayP;
        const t0 = Date.now();
        while (Date.now() - t0 < 8000 && (window.__listCalls < 2 || __relayFilesInflight)) await new Promise(res => setTimeout(res, 100));
        await new Promise(res => setTimeout(res, 400));
        __fx.hooks = {};
        return { scanR, relayR, listCalls: window.__listCalls, saves: window.__savesDuringScan, deferred: !!window.__hjRelayFilesDeferred, forbidden: __fx.forbidden.slice() };
      });
      const v = await page.evaluate(VIEW);
      assert.equal(r.scanR, 'done', 'scan finished ' + r.scanR);
      assert.equal(r.saves, 0, 'RACE no save while the folder is being read (a half list was written) — saves=' + r.saves + ' ' + JSON.stringify(v.byDrive));
      assert.equal(r.relayR, 0, 'the run that started before the scan stops without adding');
      assert.deepEqual([v.byDrive.D1, v.byDrive.D2], [1, 1], 'RACE no unassigned copy of D1·D2 ' + JSON.stringify(v.rows));
      assert.equal(r.listCalls, 2, 'RACE the deferred list merge ran once after the scan (calls=' + r.listCalls + ')');
      assert.equal(r.deferred, false, 'deferred flag cleared');
      assert.equal(v.byDrive.D_NEW, 1, 'the really new server photo still comes in');
      assert.deepEqual(v.unassigned, ['D_NEW'], 'only the new photo is unassigned ' + JSON.stringify(v.rows));
      assert(v.rows.some(x => x.endsWith('_정리완료/가나아파트/현장사진/|K_1.jpg|가나아파트|배관 교체|D1')), 'K_1 keeps project·work·Drive ID ' + JSON.stringify(v.rows));
      assert.deepEqual(r.forbidden, [], 'no writes into the folder except _현장.json');
    });

    await test('② 이미 생긴 서버 사본 정리 — 같은 Drive ID·같은 이름의 손대지 않은 미배정 사본만 뺌 · 안내 · 저장 · 두 번째는 0 (HEAL)', async () => {
      const RAW = '현장사진/', P = '_정리완료/가나아파트/현장사진/';
      const plain = (d, size) => ({ _driveId: d, _driveMimeType: 'image/jpeg', _driveSize: size });
      await page.evaluate(SEED, [
        { id: 'B1', name: 'K_1.jpg', prefix: RAW, size: 300, more: plain('D1', 300) },                                   // 뺄 것: O1 의 서버 사본
        { id: 'O3', name: 'K_3.jpg', prefix: P, size: 4000, more: Object.assign({ project: '가나아파트' }, plain('D3', 310)) },
        { id: 'B3', name: 'OTHER.jpg', prefix: RAW, size: 310, more: plain('D3', 310) },                                 // 이름 다름 → 남김
        { id: 'B4', name: 'IMG_4.jpg', prefix: RAW, size: 320, more: plain('D4', 320) },
        { id: 'B5', name: 'IMG_4.jpg', prefix: RAW, size: 320, more: plain('D4', 320) },                                 // 모두 사본 → 둘 다 남김
        { id: 'O6', name: 'K_6.jpg', prefix: P, size: 4100, more: Object.assign({ project: '가나아파트' }, plain('D6', 330)) },
        { id: 'W6', name: 'K_6.jpg', prefix: RAW, size: 330, more: Object.assign({ _worklabel: '확인' }, plain('D6', 330)) },   // 작업명 있음 → 남김
        { id: 'O7', name: 'K_7.jpg', prefix: P, size: 4200, more: Object.assign({ project: '가나아파트' }, plain('D7', 340)) },
        { id: 'L7', name: 'K_7.jpg', prefix: RAW, size: 4200, more: plain('D7', 340) },                                  // 크기가 서버와 다름(원본) → 남김
      ]);
      const r = await page.evaluate(async () => {
        // O8 + 이 기기 원본(handle)이 있는 같은 이름 기록 → 남김
        state.files.push(Object.assign({}, state.files.find(f => f.id === 'O7'), { id: 'O8', name: 'K_8.jpg', _driveId: 'D8' }));
        state.files.push({ id: 'H8', name: 'K_8.jpg', prefix: '현장사진/', kind: 'photo', ext: 'jpg', size: 350, when: new Date('2026-09-15T00:28:44Z'), project: null, _virtual: false, handle: __fx.root.list[0], thumb: null, text: '', ocr: 'na', lat: null, lng: null, _driveId: 'D8', _driveMimeType: 'image/jpeg', _driveSize: 350 });
        // 서버 목록의 크기 = 그 Drive 사진의 크기(사본을 만들 때 쓴 값) — 목록 맞추기가 기록의 서버 크기를 이 값으로 다시 적는다
        window.__SERVER = [['D1', 300], ['D3', 310], ['D4', 320], ['D6', 330], ['D7', 340], ['D8', 350]].map(([id, size], i) => ({ id, name: 'X' + i + '.jpg', mimeType: 'image/jpeg', size, modifiedAt: '2026-10-31T06:14:58Z', kind: 'photo' }));
        window.__toasts = [];
        const n1 = await relayLoadDriveFiles(false);
        const t1 = window.__toasts.slice();
        await new Promise(res => setTimeout(res, 1600));   // markDirty → 기기 저장(800ms)
        const stored = (await idbGetStrict('appState')).files.map(f => [f.prefix, f.name, f.driveId || ''].join('|')).sort();
        window.__toasts = [];
        const n2 = await relayLoadDriveFiles(false);
        return { n1, t1, stored, n2, t2: window.__toasts.slice() };
      });
      const v = await page.evaluate(VIEW);
      const ids = v.rows.map(x => x.split('|')[0]).sort();
      assert.deepEqual(ids, ['B3', 'B4', 'B5', 'H8', 'L7', 'O1', 'O2', 'O3', 'O6', 'O7', 'O8', 'W6'], 'HEAL only B1 (bare copy, same Drive ID and name) is dropped ' + JSON.stringify(v.rows));
      assert.equal(v.byDrive.D1, 1, 'D1 once');
      assert(r.t1.some(t => t.includes('서버 사본 중복 1장 정리')), 'HEAL toast says what was cleaned ' + JSON.stringify(r.t1));
      assert.equal(r.n1, 0, 'nothing new added or linked');
      assert(!r.stored.includes('현장사진/|K_1.jpg|D1'), 'the device store no longer has the copy ' + JSON.stringify(r.stored));
      assert(r.stored.includes('_정리완료/가나아파트/현장사진/|K_1.jpg|D1'), 'the original record is stored');
      assert.equal(r.n2, 0, 'second run adds nothing');
      assert(!r.t2.some(t => t.includes('서버 사본 중복')), 'second run cleans nothing ' + JSON.stringify(r.t2));
    });

    await test('③ 소스·핀 3곳(v570 이상·서로 같음) · 페이지 오류 0 · 바깥 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, 'pins equal ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 570, 'pin v570+ ' + a);
      assert.ok(SRC.includes(RECHECK), 'the post-wait scan check is in the source');
      assert.deepEqual(errors, [], 'page errors 0');
      assert.equal(network.writes, 0, 'external writes 0');
    });
    await context.close();
    console.log(`relayscan-v570: ${passed}/3 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL relayscan-v570 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

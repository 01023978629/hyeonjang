/* v531 📤 PC 사진을 다른 기기에서도 — 서버 사본이 없는 사진 일괄 올리기(이어하기) + 폴더 자동 저장 최대 대기.
   10/31 PC 에만 있는 사진 600여 장이 폰에서 빈칸이었고, 탭에서 돌린 일괄 업로드는 크롬이 뒤 탭을 닫아 중간에 멈췄다.
   전제: tests/mock-relay.js(8398) + tests/static-server.js(8299). 합성 자료·가짜 폴더(사진은 캔버스로 만든 작은 JPEG,
   쓰기는 _현장.json 만 받아 적는다). 실제 고객·현장 자료 없음.
   ① 건강 줄 '📤 폰에 안 보이는 사진 N' → 창 → [올리기 시작]: 동영상·서버 사본 있는 사진·서버 전용 기록은 빼고 올린다.
      원본 없는 1장·크기가 바뀐 1장은 건너뛰고 이름을 보여 준다. 형식을 모르는 HEIC(해석 불가)는 image/heic 로 원본을 올린다.
      서버(mock)·이 기기 저장본(appState)·폴더 _현장.json 모두 새 driveId 를 가진다 (RUN)
   ② [멈추기] → 그 묶음까지만 올리고 서버에 저장돼 있다 → [이어서] → 나머지만(같은 사진 두 번 업로드 0) (RESUME)
   ③ 새로고침(탭이 닫힌 셈) 뒤에도 올린 사진은 남고 남은 수만 다시 센다 · 지난번 멈춤 안내 (RELOAD)
   ④ 폴더 자동 저장 예약은 첫 변경 뒤 한 번 — 계속 손대도 미루지 않는다 · 저장하면 예약을 비운다 (AUTOSAVE)
   ⑤ 업로드 사이에 사진 기록이 옛 사본(서버 표시 없음)으로 바뀌어도 올린 사진의 표시를 다시 붙이고, 다시 올리지 않는다 (RELINK)
   ⑥ 폴더·서버가 없는 기기(폰 화면)에는 항목이 없다 · 소스·핀 3곳(v531 이상·서로 같음) (MISC)
   HJ_V531_BASELINE=<commit>(v530) 과 HJ_V531_MUTATION=no-done(서버 사본 있는 사진도 고름) 은 ① 에서,
   HJ_V531_MUTATION=debounce(예약을 매번 미룸) 는 ④ 에서, no-relink(다시 붙이기 끔) 는 ⑤ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
let APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398', TOKEN = 'test-token-123', ALT_PORT = 8302;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V531_BASELINE ? execFileSync('git', ['show', process.env.HJ_V531_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = process.env.HJ_V531_MUTATION || '';
if (MUT === 'no-done') {
  const from = "function pcupEligible(f){return !!f&&f.kind==='photo'&&!isVideoRec(f)&&!f._driveId;}";
  assert(SRC.includes(from), 'mutation anchor no-done');
  html = SRC.replace(from, "function pcupEligible(f){return !!f&&f.kind==='photo'&&!isVideoRec(f);}");
}
if (MUT === 'debounce') {
  const from = '  if(__autosaveTimer)return;   // 이미 예약돼 있으면 미루지 않는다';
  assert(SRC.includes(from), 'mutation anchor debounce');
  html = SRC.replace(from, '  clearTimeout(__autosaveTimer);__autosaveTimer=null;');
}
if (MUT === 'no-relink') {
  const from = 'const pcupRelink=()=>{let n=0;';
  assert(SRC.includes(from), 'mutation anchor no-relink');
  html = SRC.replace(from, 'const pcupRelink=()=>{return 0;let n=0;');
}
// 기준선·변이 index.html 은 따로 띄운 로컬 서버가 준다 — route.fulfill 로 준 문서는 localhost(mock relay) 요청이 막힌다(v530 과 같은 이유).
let altServer = null;
async function startAlt() {
  const http = require('node:http');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
  altServer = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': MIME['.html'] }); return res.end(html); }
    const f = path.resolve(ROOT, '.' + p);
    if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
  });
  await new Promise((resolve, reject) => { altServer.once('error', reject); altServer.listen(ALT_PORT, 'localhost', resolve); });
  APP = 'http://localhost:' + ALT_PORT + '/index.html';
}
async function mockState() { const r = await fetch(MOCK + '/__state'); return r.json(); }
const driveIdsOnServer = st => ((st.data && st.data.files) || []).filter(f => f.driveId && /^mockfile_/.test(f.driveId)).map(f => f.name).sort();

let browser, passed = 0, uploadDelay = 0;
const errors = [];
async function device(phone) {
  const context = await browser.newContext(phone ? { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' }
    : { serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push((phone ? 'phone: ' : 'pc: ') + String(e)));
  page.on('dialog', d => { if (d.type() === 'beforeunload') return d.accept(); errors.push('dialog:' + d.type()); d.dismiss(); });
  await context.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith(MOCK)) {
      // 업로드만 조금 느리게 — [멈추기]를 누를 틈(실제 Apps Script 는 장당 7~9초)
      if (uploadDelay && route.request().method() === 'POST' && /"action":"upload"/.test(route.request().postData() || '')) await new Promise(r => setTimeout(r, uploadDelay));
      return route.continue();
    }
    if (u.startsWith(new URL(APP).origin + '/')) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await booted(page);
  return { context, page };
}
async function booted(page) {
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
}
// 가짜 폴더(만물) — 사진은 현장사진/ 아래. _현장.json 쓰기만 받아 window.__folderWrites 에 적는다. 다른 쓰기·삭제는 거부.
async function mountFolder(page, { fresh }) {
  return page.evaluate(async ({ fresh }) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const x = c.getContext('2d'); x.fillStyle = '#c84'; x.fillRect(0, 0, 64, 48); x.fillStyle = '#246'; x.fillRect(8, 8, 20, 20);
    const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))).arrayBuffer());
    const heicBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 1, 2, 3, 4, 5, 6, 7, 8]);   // 'ftypheic' 머리만 — 브라우저가 해석 못 함
    window.__folderWrites = window.__folderWrites || [];
    const deny = () => { throw Error('fixture write prohibited'); };
    const fileH = (name, bytes) => ({ kind: 'file', name, createWritable: deny, getFile: async () => new File([bytes], name, { type: '', lastModified: 1761900000000 }) });
    const names = Array.from({ length: 22 }, (_, i) => 'p' + String(i + 1).padStart(2, '0') + '.jpg');
    const photos = names.map(n => fileH(n, jpg)).concat([fileH('changed.jpg', jpg), fileH('raw.heic', heicBytes), fileH('v1.mp4', jpg)]);
    const sub = { kind: 'directory', name: '현장사진', removeEntry: deny,
      async *entries() { for (const p of photos) yield [p.name, p]; },
      async getDirectoryHandle(n) { throw Error('not found ' + n); },
      async getFileHandle(n, o) { if (o && o.create) deny(); const f = photos.find(p => p.name === n); if (!f) throw Error('not found'); return f; } };
    const dataH = { kind: 'file', name: '_현장.json', getFile: async () => new File([window.__folderWrites.slice(-1)[0] || '{}'], '_현장.json'),
      createWritable: async () => { const parts = []; return { write: async d => { parts.push(typeof d === 'string' ? d : String(d)); }, close: async () => { window.__folderWrites.push(parts.join('')); } }; } };
    const root = { kind: 'directory', name: '만물', removeEntry: deny,
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *entries() { yield ['현장사진', sub]; },
      async getDirectoryHandle(n) { if (n === '현장사진') return sub; throw Error('not found ' + n); },
      async getFileHandle(n, o) { if (n === '_현장.json') return dataH; if (o && o.create) deny(); throw Error('not found ' + n); } };
    state.dirHandle = root;
    if (fresh) {
      const rec = (name, size, extra) => Object.assign({ id: uid(), name, handle: null, prefix: '현장사진/', ext: name.split('.').pop().toLowerCase(), size, kind: 'photo', project: null,
        thumb: null, text: '', ocr: 'na', est: null, contact: null, _file: null, when: new Date('2026-10-20T01:00:00Z') }, extra || {});
      state.files = names.map(n => rec(n, jpg.length))
        .concat([rec('lost.jpg', jpg.length), rec('changed.jpg', 999), rec('raw.heic', heicBytes.length), rec('v1.mp4', jpg.length),
          rec('already.jpg', jpg.length, { _driveId: 'drive-already', _driveMimeType: 'image/jpeg', _driveSize: 10 }),
          rec('server-only.jpg', 0, { _virtual: true, _driveId: 'drive-virtual' })]);
      state.projects = [{ name: '가온아파트', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }];
      markDirty();
      await guardedPersistCurrentState();
    }
    state.tab = 'dashboard'; state.activeProject = null; state.search = '';
    render();
    return { total: state.files.length, jpg: jpg.length };
  }, { fresh });
}
async function waitRunDone(page, ms) {
  await page.waitForFunction(() => typeof __pcup !== 'undefined' && __pcup && !__pcup.running && __pcup.finishedAt, null, { timeout: ms || 30000 });
}
const lastFolderJson = page => page.evaluate(() => { const s = (window.__folderWrites || []).slice(-1)[0]; return s ? JSON.parse(s) : null; });

(async () => {
  await fetch(MOCK + '/__reset');
  if (html) await startAlt();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS pcupload-v531 ' + name); }
  const pc = await device(false);
  const page = pc.page;
  await page.evaluate(async ({ url, token }) => { await idbSet('relay_url', url); await idbSet('relay_token', token); await relayBoot(); }, { url: MOCK, token: TOKEN });
  await mountFolder(page, { fresh: true });
  for (let i = 0; i < 75 && (await mockState()).revision < 1; i++) await new Promise(r => setTimeout(r, 200));
  assert((await mockState()).revision >= 1, 'first relay save');

  await test('① 건강 줄 → 창 → 올리기: 대상 고르기·건너뛰기·HEIC·서버·기기·폴더 저장 (RUN)', async () => {
    assert.equal(await page.evaluate(() => typeof pcupTargets === 'function' ? pcupTargets().length : -1), 25, '22 jpg + lost + changed + heic (video·already uploaded·server-only excluded)');
    const seg = page.locator('[data-health="pcup"]');
    await seg.waitFor({ timeout: 8000 });
    assert.match(await seg.innerText(), /폰에 안 보이는 사진\s*25/);
    assert((await seg.boundingBox()).height >= 44, 'health segment tap target ≥ 44px');
    await seg.click();
    await page.waitForSelector('#modalRoot .modal');
    assert.match(await page.locator('#modalRoot .modal').innerText(), /이 PC 에만 있는 사진 25장/);
    // 첫 실행은 [멈추기] 없이 끝까지 — 단, ②에서 쓰려고 22장 중 일부만 남기기 위해 먼저 12장을 서버에 있는 것으로 돌려 둔다
    await page.evaluate(() => { const pick = state.files.filter(f => /^p(1[3-9]|2[0-2])\.jpg$/.test(f.name)); pick.forEach(f => { f._pcupHold = true; f.kind = 'photo-hold'; }); });
    await page.click('#modalRoot .mfoot button.blue');
    await waitRunDone(page);
    const run = await page.evaluate(() => ({ ok: __pcup.ok, failed: __pcup.failed, reason: __pcup.reason, failedNames: __pcup.failedNames, left: pcupTargets().length }));
    assert.equal(run.ok, 13, '12 jpg + raw.heic uploaded ' + JSON.stringify(run));
    assert.equal(run.failed, 2, 'lost + changed skipped');
    assert.equal(run.reason, 'done');
    assert(run.failedNames.some(n => /^lost\.jpg — 이 PC 폴더에서 원본을 찾지 못함/.test(n)) && run.failedNames.some(n => /^changed\.jpg — 원본 크기가 기록과 다름/.test(n)), JSON.stringify(run.failedNames));
    const st = await mockState();
    const heic = st.uploads.find(u => u.name === 'raw.heic');
    assert(heic && heic.mimeType === 'image/heic', 'undecodable HEIC uploaded as image/heic ' + JSON.stringify(heic));
    assert(!st.uploads.some(u => /v1\.mp4|already\.jpg|server-only\.jpg/.test(u.name)), 'video, uploaded and server-only records are not uploaded');
    assert.equal(st.uploads.length, 13);
    assert.equal(driveIdsOnServer(st).length, 13, 'server data has every new driveId');
    const stored = await page.evaluate(async () => ((await idbGet('appState')).files || []).filter(f => /^mockfile_/.test(f.driveId || '')).length);
    assert.equal(stored, 13, 'device appState has every new driveId');
    const folder = await lastFolderJson(page);
    assert(folder && folder.files.filter(f => /^mockfile_/.test(f.driveId || '')).length === 13, 'folder _현장.json written with the new driveIds');
    const modal = await page.locator('#modalRoot .modal').innerText();
    assert.match(modal, /다 올렸습니다/);
    assert.match(modal, /건너뛴 사진 2장 보기/);
    const sumH = await page.evaluate(() => Math.round(document.querySelector('#modalRoot details summary').getBoundingClientRect().height));
    assert(sumH >= 44, 'details summary ≥ 44px ' + sumH);
    await page.click('#modalRoot .mfoot button.ghost');
  });

  await test('② [멈추기] → 그 묶음까지 저장 · [이어서] → 나머지만(중복 0) (RESUME)', async () => {
    await page.evaluate(() => { state.files.filter(f => f._pcupHold).forEach(f => { delete f._pcupHold; f.kind = 'photo'; }); });
    // 10장(p13~p22) + 새로 들어온 사진 10장(q01~q10, 같은 폴더 JPEG 를 이름만 달리) — 20장이면 두 묶음
    await page.evaluate(async () => {
      const sub = await state.dirHandle.getDirectoryHandle('현장사진');
      const base = await (await sub.getFileHandle('p01.jpg')).getFile();
      const bytes = new Uint8Array(await base.arrayBuffer());
      const extra = Array.from({ length: 10 }, (_, i) => 'q' + String(i + 1).padStart(2, '0') + '.jpg');
      const orig = sub.getFileHandle.bind(sub);
      sub.getFileHandle = async (n, o) => extra.includes(n) ? { kind: 'file', name: n, getFile: async () => new File([bytes], n, { type: 'image/jpeg' }) } : orig(n, o);
      extra.forEach(n => state.files.push({ id: uid(), name: n, handle: null, prefix: '현장사진/', ext: 'jpg', size: bytes.length, kind: 'photo', project: null, thumb: null, text: '', ocr: 'na', est: null, contact: null, _file: null, when: new Date() }));
      markDirty(); render();
    });
    assert.equal(await page.evaluate(() => pcupTargets().length), 20, '10 held + 10 new (skipped failures stay out this session)');
    uploadDelay = 250;
    await page.evaluate(() => hjHealthOpen('pcup'));
    await page.click('#modalRoot .mfoot button.blue');
    const stop = page.locator('#modalRoot .mfoot button.warn');
    await stop.waitFor();
    await stop.click();
    assert.match(await stop.innerText(), /이번 묶음 끝나면 멈춤/);
    await waitRunDone(page);
    uploadDelay = 0;
    const first = await page.evaluate(() => ({ ok: __pcup.ok, reason: __pcup.reason, left: pcupTargets().length }));
    assert.deepEqual(first, { ok: 10, reason: 'stopped', left: 10 }, 'stopped after one batch');
    let st = await mockState();
    assert.equal(st.uploads.length, 23);
    assert.equal(driveIdsOnServer(st).length, 23, 'what was uploaded before stopping is already saved on the server');
    assert.match(await page.locator('#modalRoot .modal').innerText(), /멈췄습니다 — 다시 누르면 남은 사진만/);
    await page.click('#modalRoot .mfoot button.blue');   // 남은 10장 이어서
    await page.waitForFunction(() => typeof __pcup !== 'undefined' && __pcup && __pcup.running === false && __pcup.ok === 10 && __pcup.reason === 'done', null, { timeout: 30000 });
    st = await mockState();
    assert.equal(st.uploads.length, 33, 'resume uploaded only the remaining 10');
    const names = st.uploads.map(u => u.name);
    assert.equal(new Set(names).size, names.length, 'no photo uploaded twice ' + names.join(','));
    assert.equal(driveIdsOnServer(st).length, 33);
    await page.click('#modalRoot .mfoot button.ghost');
  });

  await test('③ 새로고침 뒤에도 올린 사진은 남고 남은 수만 · 지난번 멈춤 안내 (RELOAD)', async () => {
    // 한 장을 더 넣고 올리다 '탭이 닫힌' 기록을 남긴다(running:true 그대로)
    await page.evaluate(() => { localStorage.setItem('hj_pcup', JSON.stringify({ at: Date.now(), running: true, total: 40, done: 17, ok: 17, failed: 0, reason: '' })); });
    // 저장이 끝난 뒤에 닫는다 — 기기 저장이 남아 있으면 앱이 '나가시겠어요?'를 띄워 새로고침이 흔들린다(이 검사가 보려는 것은 저장 뒤의 재시작)
    await page.waitForFunction(() => !__hjLocalSavePending && !__relaySaving, null, { timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await booted(page);
    await mountFolder(page, { fresh: false });
    const r = await page.evaluate(() => ({ left: pcupTargets().map(f => f.name).sort(), drive: state.files.filter(f => /^mockfile_/.test(f._driveId || '')).length }));
    assert.equal(r.drive, 33, 'uploaded photos keep their server copy after reload');
    assert.deepEqual(r.left, ['changed.jpg', 'lost.jpg'], 'only the never-uploaded originals remain (skip list is per session)');
    await page.evaluate(() => hjHealthOpen('pcup'));
    assert.match(await page.locator('#modalRoot .modal').innerText(), /지난번에 17\/40장까지 올리다 멈췄어요/);
    await page.click('#modalRoot .mfoot button.ghost');
  });

  await test('④ 폴더 자동 저장 예약은 첫 변경 뒤 한 번 · 저장하면 비움 (AUTOSAVE)', async () => {
    const r = await page.evaluate(async () => {
      __autoSaveOn = true; clearTimeout(__autosaveTimer); __autosaveTimer = null;
      markDirty(); const t1 = __autosaveTimer;
      markDirty(); markDirty(); const t2 = __autosaveTimer;
      const before = (window.__folderWrites || []).length;
      await saveProject(true);
      return { t1: !!t1, same: t1 === t2, afterSave: __autosaveTimer, wrote: (window.__folderWrites || []).length - before };
    });
    assert.deepEqual(r, { t1: true, same: true, afterSave: null, wrote: 1 }, 'max-wait autosave ' + JSON.stringify(r));
  });

  await test('⑤ 업로드 사이 기록이 옛 사본으로 바뀌어도 표시를 다시 붙이고 다시 올리지 않음 (RELINK)', async () => {
    const before = (await mockState()).uploads.length;
    const r = await page.evaluate(async () => {
      const sub = await state.dirHandle.getDirectoryHandle('현장사진');
      const bytes = new Uint8Array(await (await (await sub.getFileHandle('p01.jpg')).getFile()).arrayBuffer());
      const extra = Array.from({ length: 12 }, (_, i) => 'r' + String(i + 1).padStart(2, '0') + '.jpg');
      const orig = sub.getFileHandle.bind(sub);
      sub.getFileHandle = async (n, o) => extra.includes(n) ? { kind: 'file', name: n, getFile: async () => new File([bytes], n, { type: 'image/jpeg' }) } : orig(n, o);
      extra.forEach(n => state.files.push({ id: uid(), name: n, handle: null, prefix: '현장사진/', ext: 'jpg', size: bytes.length, kind: 'photo', project: null, thumb: null, text: '', ocr: 'na', est: null, contact: null, _file: null, when: new Date() }));
      __pcup = null;   // 새 세션처럼
      const stale = state.files.map(f => Object.assign({}, f));   // 업로드 전 사본 — 서버 표시 없음
      let swapped = false, okAtSwap = 0;
      const run = await pcupRun(x => { if (!swapped && x.batches === 1) { swapped = true; okAtSwap = x.ok; state.files = stale; } });
      const rs = state.files.filter(f => /^r\d\d\.jpg$/.test(f.name));
      const saved = ((await idbGet('appState')).files || []).filter(f => /^r\d\d\.jpg$/.test(f.name) && /^mockfile_/.test(f.driveId || '')).length;
      return { ok: run.ok, reason: run.reason, relinked: run.relinked, okAtSwap, swapped, linked: rs.filter(f => f._driveId).length, records: rs.length, left: pcupTargets().filter(f => /^r\d\d/.test(f.name)).length, saved };
    });
    const st = await mockState();
    assert.deepEqual({ ok: r.ok, reason: r.reason, swapped: r.swapped, linked: r.linked, records: r.records, left: r.left, saved: r.saved, uploads: st.uploads.length - before },
      { ok: 12, reason: 'done', swapped: true, linked: 12, records: 12, left: 0, saved: 12, uploads: 12 }, 'RELINK ' + JSON.stringify(r));
    assert(r.okAtSwap > 0 && r.relinked === r.okAtSwap, 'every photo uploaded before the swap got its server id back on the stale copy ' + JSON.stringify(r));
    assert.equal(driveIdsOnServer(st).filter(n => /^r\d\d\.jpg$/.test(n)).length, 12, 'server data has all 12');
  });

  await test('⑥ 폴더·서버 없는 기기에는 항목 없음 · 소스·핀 3곳 (MISC)', async () => {
    const phone = await device(true);
    const pr = await phone.page.evaluate(() => { state.files = [{ id: uid(), name: 'x.jpg', handle: null, prefix: '현장사진/', ext: 'jpg', size: 10, kind: 'photo', thumb: null, text: '', ocr: 'na' }]; render(); return { available: pcupAvailable(), seg: hjHealthLineHTML().includes('data-health="pcup"') }; });
    assert.deepEqual(pr, { available: false, seg: false });
    await phone.context.close();
    const build = (SRC.match(/const APP_BUILD='hyeonjang-v(\d+)-[^']*'/) || [])[1];
    assert(Number(build) >= 531, 'APP_BUILD v531+');
    const pin = SRC.match(/const APP_BUILD='([^']+)'/)[1];
    assert.equal(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/)[1], pin);
    assert.equal(fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/)[1], pin);
    assert(/function pcupRun\(/.test(SRC) && /function scheduleFolderAutoSave\(/.test(SRC));
    assert.deepEqual(errors, [], 'no page errors');
  });

  console.log('pcupload-v531: ' + passed + '/6 passed');
  await browser.close();
  if (altServer) altServer.close();
  process.exit(passed === 6 ? 0 : 1);
})().catch(async e => {
  console.error('FAIL pcupload-v531', e && e.stack || e);
  try { await browser.close(); } catch (_) {}
  if (altServer) altServer.close();
  process.exit(1);
});

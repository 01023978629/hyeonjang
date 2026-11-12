/* v593 사진 크게 보기(renderLightbox) — 미리보기도 서버 사본(Drive ID)도 없는 사진을 '같은 이름'으로 아무 Drive 사진이나 열고 그 ID 를 저장하던 것.
   예전: 이 기기에 원본(파일 핸들·_file)이 있어도 드라이브 전체를 같은 이름으로 찾았고, 같은 이름이 여럿이거나 크기가 달라도 첫 것을 열어 f._driveId 에 적고 markDirty 했다
   (다른 해의 IMG_1001 이 열리고 남의 Drive ID 가 저장됐다 — AGENTS v584). 사본 꼬리표를 뗀 '이름 일부'로도 찾아 이름이 다른 사진까지 열었다.
   합성 자료(이름·사진은 지어낸 것 — 단색 PNG), 시계 2026-11-12 고정, 바깥 쓰기 0.
   드라이브 대역: getRoToken 만 페이지 안에서 바꿔 끼운다(구글 로그인 창은 이 컨테이너에서 못 띄운다). 목록·원본 받기는 앱의 진짜 roList·fetch 가 그대로 돌고,
   www.googleapis.com/drive/v3/files 요청을 Playwright route 로 가로채 지어낸 목록(DRIVE)으로 답한다 — 요청 수·질의·받은 원본 id 를 센다.
   ① 이 기기 원본(핸들만·_file 만) 있는 사진 → 그 원본을 그린다(3×2) · 드라이브 요청 0 · 토큰 0 · Drive ID 안 적음 · markDirty 0 · 저장본 불변 (LOCAL)
   ② 원본 없는 사진(마지막 수단) — 같은 이름 둘(하나는 크기까지 같음)·하나인데 크기 다름·이름 일부만 맞음('IMG_1003 (1).jpg', 이름 일부 질의 없음)·
      목록 크기는 맞는데 받은 원본 크기가 다름 → 모두 열지 않고 안내만 · 원본 받기는 마지막 것 하나뿐 · Drive ID·markDirty 0 · 저장본 불변 · 안내가 폰 390 안 (DRIVE-NO)
   ③ 같은 이름 하나·크기 같음 → 그 원본이 열리고 Drive ID 한 번 적음(markDirty 1) · 크기 모르는 사진(0)도 이름 하나면 연다 ·
      다른 기록이 이미 쓰는 Drive ID 면 보여 주기만(안 적음) · 저장본은 그 두 Drive ID 만 바뀜 (DRIVE-ONE)
   ④ 미리보기가 있는 사진은 예전 그대로(그 미리보기·드라이브 요청 0) · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)
   HJ_V593_BASELINE=<commit> 은 ① 에서, HJ_V593_MUTATION=drive-first(기기 원본을 안 봄)는 ①, first-hit(같은 이름 여럿이면 첫 것)·size-pick(같은 이름 여럿 중
   크기 하나 맞으면 그것)·no-size(목록 크기 대조 뺌 — 받은 원본 크기 대조가 막아도 원본을 받으러 가므로 받은 id 로 잡힌다)·no-raw-size(받은 원본 크기 대조 뺌)는 ②,
   no-taken(다른 기록이 쓰는 Drive ID 도 적음)은 ③ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'drive-first': [['let local=null; try{ local=f._heicFile||await getFileOf(f); }catch(_){ local=null; }', 'let local=null;']],
  'first-hit': [['if(list.length>1){ say(', 'if(false){ say(']],
  'size-pick': [['if(list.length>1){ say(', 'if(list.length>1&&list.filter(x=>Number(x.size)===Number(f.size)).length!==1){ say('],
    ['const hit=list[0], sz=', 'const hit=list.find(x=>Number(x.size)===Number(f.size))||list[0], sz=']],
  'no-size': [['if(sz>0&&Number(hit.size)!==sz){', 'if(false){']],
  'no-raw-size': [['if(sz>0&&raw.size!==sz){', 'if(false){']],
  'no-taken': [['||state.files.some(x=>x&&x!==f&&x._driveId===hit.id))return;', ')return;']],
};
let html = process.env.HJ_V593_BASELINE ? execFileSync('git', ['show', process.env.HJ_V593_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V593_MUTATION) {
  const m = MUT[process.env.HJ_V593_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V593_MUTATION);
  html = SRC; for (const [a, b] of m) { assert.equal(html.split(a).length, 2, 'mutation anchor ' + a); html = html.replace(a, b); }
}

// 합성 PNG(정해진 잡음 무늬) — 가로×세로가 다르면 바이트 수도 다르다. 어느 사진이 열렸는지는 그림 크기로 안다.
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t, 'ascii'), d]); len.writeUInt32BE(d.length); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
function png(w, h, seed) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = w * 3 + 1, raw = Buffer.alloc(row * h); let r = seed >>> 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; raw[y * row + 1 + x] = r >>> 24; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = { local: png(3, 2, 11), A: png(5, 5, 22), B: png(7, 4, 33), C: png(6, 3, 44) };
assert.equal(new Set(Object.values(PNG).map(b => b.length)).size, 4, '합성 사진 바이트 수가 서로 달라야 크기 대조를 시험할 수 있다');
// 지어낸 드라이브 — 같은 이름 사진이 여럿 있는 폴더(다른 해·다른 현장 사진)
const DRIVE = [
  { id: 'D_2001', name: 'IMG_2001.jpg', buf: PNG.A },               // ① L1 과 이름만 같은 다른 사진 — 열리면 안 된다
  { id: 'D_2002', name: 'IMG_2002.jpg', buf: PNG.A },               // ① L2 도
  { id: 'D_OLD', name: 'IMG_1001.jpg', buf: PNG.A },                // ② A1 과 크기까지 같음 — 그래도 같은 이름이 둘이라 어느 것인지 모른다
  { id: 'D_NEW', name: 'IMG_1001.jpg', buf: PNG.B },
  { id: 'D_1002', name: 'IMG_1002.jpg', buf: PNG.B },               // ② A2(크기 A) 와 크기 다름
  { id: 'D_1003', name: 'IMG_1003.jpg', buf: PNG.A },               // ② A3 'IMG_1003 (1).jpg' — 이름 일부로만 맞는다(크기는 같음)
  { id: 'D_1007', name: 'IMG_1007.jpg', size: PNG.A.length, buf: PNG.B },   // ② 목록 크기는 A7 과 같은데 받은 원본은 다름(그 사이 바뀐 파일)
  { id: 'D_1004', name: 'IMG_1004.jpg', buf: PNG.C },               // ③ 하나·크기 같음
  { id: 'D_1005', name: 'IMG_1005.jpg', buf: PNG.C },               // ③ A5 는 크기 모름(0)
  { id: 'D_1006', name: 'IMG_1006.jpg', buf: PNG.C },               // ③ X6 이 이미 이 ID 를 쓴다
];
const drive = { list: [], media: [], other: [] };
const unq = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
function driveMock(route, url) {
  const req = route.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (m && url.searchParams.get('alt') === 'media') {
    drive.media.push(m[1]);
    const d = DRIVE.find(x => x.id === m[1]);
    return d ? route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'image/png' }, cors), body: d.buf }) : route.fulfill({ status: 404, headers: cors, body: '' });
  }
  if (url.pathname === '/drive/v3/files') {
    const q = url.searchParams.get('q') || ''; drive.list.push(q);
    const eq = q.match(/name\s*=\s*'((?:\\.|[^'\\])*)'/), ct = q.match(/name contains '((?:\\.|[^'\\])*)'/);
    const hits = DRIVE.filter(d => eq ? d.name === unq(eq[1]) : ct ? d.name.includes(unq(ct[1])) : false);
    return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify({ files: hits.map(d => ({ id: d.id, name: d.name, mimeType: 'image/png', size: String(d.size || d.buf.length) })) }) });
  }
  drive.other.push(url.pathname);
  return route.fulfill({ status: 404, headers: cors, body: '' });
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS lightboxname-v593 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/drive/v3/files')) return driveMock(route, url);
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-12T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    // 구글 로그인(GIS) 대신 — 읽기 권한 토큰만 지어낸다. 목록·원본 받기는 앱 코드 그대로(route 가 답한다).
    window.__C = { ro: 0, dirty: 0, getFile: 0 };
    getRoToken = async () => { __C.ro++; return 'TOK-SYNTHETIC'; };
    const md = markDirty; markDirty = function () { __C.dirty++; return md.apply(this, arguments); };
  }, BOOT);
  return { context, page };
}
const SEED = P => {
  closeModal(true); __tabStale = false; state._demo = false;
  const bytes = k => new Uint8Array(P[k]);
  state.projects = [{ name: '가온아파트', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }];
  state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = [];
  const mk = o => Object.assign({ handle: null, prefix: '현장사진/', ext: 'jpg', kind: 'photo', project: '가온아파트', when: null, lat: null, lng: null, place: null, address: null,
    thumb: null, text: '', ocr: 'na', est: null, contact: null, _driveId: null, _driveMimeType: null, _driveSize: 0, _file: null }, o);
  state.files = [
    // ① PC 폴더 스캔 직후 모양(파일 핸들만) · 폰 갤러리로 넣은 모양(_file 만) — 둘 다 미리보기 만들기 전
    mk({ id: 'L1', name: 'IMG_2001.jpg', size: P.local.length, handle: { kind: 'file', name: 'IMG_2001.jpg', getFile: async () => { __C.getFile++; return new File([bytes('local')], 'IMG_2001.jpg', { type: 'image/png' }); } } }),
    mk({ id: 'L2', name: 'IMG_2002.jpg', size: P.local.length, _file: new File([bytes('local')], 'IMG_2002.jpg', { type: 'image/png' }) }),
    // ②③ 폰의 PC 전용 사진 모양(원본도 사본도 없음 — 저장본에서 되살린 기록)
    mk({ id: 'A1', name: 'IMG_1001.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A2', name: 'IMG_1002.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A3', name: 'IMG_1003 (1).jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A7', name: 'IMG_1007.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A4', name: 'IMG_1004.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'A5', name: 'IMG_1005.jpg', size: 0, _virtual: true }),
    mk({ id: 'A6', name: 'IMG_1006.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'X6', name: 'IMG_1006.jpg', prefix: '_정리완료/가온아파트/현장사진/', size: P.C.length, _virtual: true, _driveId: 'D_1006', thumb: P.px }),
    // ④ 미리보기가 있는 사진
    mk({ id: 'T1', name: 'IMG_3001.jpg', size: 4321, _virtual: true, thumb: P.px }),
  ];
  state.activeProject = null; state.tab = 'estimates'; state.editingQuote = null;
  render();
};
const snapState = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };
// 크게 보기 한 장을 열고 끝날 때까지 — 그림이 그려졌거나(blob) '여는 중·찾는 중'이 아닌 안내가 남았을 때. 그 뒤 늦은 쓰기가 없는지 조금 더 기다린다.
async function view(page, id, ids) {
  const before = { list: drive.list.length, media: drive.media.length };
  await page.evaluate(([i, l]) => { if (document.getElementById('lightbox')) closeLightbox(); window.__C0 = Object.assign({}, __C); openLightbox(i, l); }, [id, ids || [id]]);
  await page.waitForFunction(() => {
    const im = document.getElementById('lbImg'), n = document.getElementById('lbNote');
    if (im && /^blob:/.test(im.src) && im.complete && im.naturalWidth > 0) return true;
    if (im && /^data:/.test(im.src) && im.complete && im.naturalWidth > 0 && !n) return true;
    return !!n && !['open', 'search'].includes(n.getAttribute('data-lb-note'));
  }, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(350);
  const r = await page.evaluate(i => {
    const im = document.getElementById('lbImg'), n = document.getElementById('lbNote'), f = state.files.find(x => x.id === i);
    const rect = n && n.getBoundingClientRect();
    return { src: im ? ((im.getAttribute('src') || '').match(/^(blob|data):/) || ['', im.getAttribute('src') ? 'other' : ''])[1] : null, w: im && im.complete ? im.naturalWidth : 0, h: im && im.complete ? im.naturalHeight : 0,
      note: n ? (n.getAttribute('data-lb-note') || 'old:' + n.textContent.slice(0, 40)) : null, noteText: n ? n.textContent : '',
      noteIn: n ? (rect.left >= -0.5 && rect.right <= innerWidth + 0.5 && rect.width > 120) : null,
      driveId: f ? f._driveId : 'gone', thumb: !!(f && f.thumb), ro: __C.ro - __C0.ro, dirty: __C.dirty - __C0.dirty, getFile: __C.getFile - __C0.getFile };
  }, id);
  r.list = drive.list.slice(before.list); r.media = drive.media.slice(before.media);
  return r;
}

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    const P = { local: [...PNG.local], A: [...PNG.A], B: [...PNG.B], C: [...PNG.C], px: 'data:image/png;base64,' + PNG.B.toString('base64') };
    await page.evaluate(SEED, P);
    const before = await page.evaluate(snapState);

    await test('① 이 기기 원본이 있으면 그 원본을 — 드라이브 요청 0 · 토큰 0 · Drive ID·markDirty 0 (LOCAL)', async () => {
      const l1 = await view(page, 'L1', ['L1', 'L2']);
      assert.deepEqual([l1.list.length, l1.media.length, l1.ro], [0, 0, 0], 'L1(핸들만) — 드라이브 요청·토큰 없음 ' + JSON.stringify(l1));
      assert.deepEqual([l1.src, l1.w, l1.h, l1.note], ['blob', 3, 2, null], 'L1 — 이 기기 원본(3×2)을 그린다(드라이브의 같은 이름 5×5 아님) ' + JSON.stringify(l1));
      assert.equal(l1.getFile, 1, 'L1 — 원본은 파일 핸들에서');
      assert.deepEqual([l1.driveId, l1.dirty, l1.thumb], [null, 0, false], 'L1 — 아무것도 적지 않는다 ' + JSON.stringify(l1));
      const l2 = await view(page, 'L2', ['L1', 'L2']);
      assert.deepEqual([l2.list.length, l2.media.length, l2.ro, l2.src, l2.w, l2.h, l2.driveId, l2.dirty], [0, 0, 0, 'blob', 3, 2, null, 0], 'L2(_file 만) ' + JSON.stringify(l2));
      await page.evaluate(() => closeLightbox());
      assert.equal(drive.list.length + drive.media.length, 0, '① 동안 드라이브 요청 0');
      assert.equal(await page.evaluate(snapState), before, '① 저장본 불변');
    });

    await test('② 원본 없는 사진 — 같은 이름 여럿·크기 다름·이름 일부·받은 원본 크기 다름은 열지 않음 · Drive ID 0 (DRIVE-NO)', async () => {
      const a1 = await view(page, 'A1');
      assert.equal(a1.note, 'ambiguous', 'A1 — 같은 이름 둘(하나는 크기까지 같음)이면 열지 않는다 ' + JSON.stringify(a1));
      assert.deepEqual([a1.media, a1.driveId, a1.dirty, a1.src], [[], null, 0, ''], 'A1 — 원본 받기·Drive ID·markDirty 없음 ' + JSON.stringify(a1));
      assert.ok(a1.ro >= 1 && a1.list.length === 1 && /^name='IMG_1001\.jpg' and trashed=false/.test(a1.list[0]), 'A1 — 이름이 정확히 같은 것만 찾는다 ' + JSON.stringify(a1.list));
      assert.ok(/같은 이름 사진이 2장/.test(a1.noteText) && a1.noteIn, 'A1 안내 글·폰 390 안 ' + JSON.stringify(a1));
      const a2 = await view(page, 'A2');
      assert.deepEqual([a2.note, a2.media, a2.driveId, a2.dirty], ['size', [], null, 0], 'A2 — 같은 이름 하나지만 크기가 다르면 받지도 않는다 ' + JSON.stringify(a2));
      const a3 = await view(page, 'A3');
      assert.deepEqual([a3.note, a3.media, a3.driveId, a3.dirty], ['notfound', [], null, 0], "A3 — 'IMG_1003 (1).jpg' 은 IMG_1003.jpg 가 아니다 " + JSON.stringify(a3));
      assert.ok(a3.list.length === 1 && !a3.list.some(q => /name contains/.test(q)), "A3 — 이름 일부('contains') 질의를 하지 않는다 " + JSON.stringify(a3.list));
      assert.ok(a3.noteText.includes('IMG_1003 (1).jpg'), 'A3 안내에 파일 이름 그대로 ' + a3.noteText);
      const a7 = await view(page, 'A7');
      assert.deepEqual([a7.note, a7.media, a7.driveId, a7.dirty, a7.src], ['size', ['D_1007'], null, 0, ''], 'A7 — 목록 크기는 같아도 받은 원본 크기가 다르면 그리지도 적지도 않는다 ' + JSON.stringify(a7));
      await page.evaluate(() => closeLightbox());
      assert.deepEqual(drive.media, ['D_1007'], '② 원본 받기는 A7 하나뿐 ' + JSON.stringify(drive.media));
      assert.equal(await page.evaluate(snapState), before, '② 저장본 불변(Drive ID 안 적음)');
    });

    await test('③ 같은 이름 하나·크기 같음 → 열고 Drive ID 한 번 · 다른 기록이 쓰는 ID 는 안 적음 (DRIVE-ONE)', async () => {
      const a4 = await view(page, 'A4');
      await page.waitForFunction(() => state.files.find(x => x.id === 'A4')._driveId === 'D_1004' && __C.dirty > __C0.dirty, null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(250);
      const a4b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'A4')._driveId, dirty: __C.dirty - __C0.dirty, thumb: /^data:/.test(state.files.find(x => x.id === 'A4').thumb || '') }));
      assert.deepEqual([a4.src, a4.w, a4.h, a4.media], ['blob', 6, 3, ['D_1004']], 'A4 — 그 드라이브 원본(6×3)을 연다 ' + JSON.stringify(a4));
      assert.deepEqual(a4b, { driveId: 'D_1004', dirty: 1, thumb: true }, 'A4 — Drive ID 한 번 적고 미리보기도 ' + JSON.stringify(a4b));
      const a5 = await view(page, 'A5');
      await page.waitForFunction(() => state.files.find(x => x.id === 'A5')._driveId === 'D_1005', null, { timeout: 5000 }).catch(() => {});
      const a5b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'A5')._driveId, dirty: __C.dirty - __C0.dirty }));
      assert.deepEqual([a5.src, a5.w, a5.media, a5b.driveId, a5b.dirty], ['blob', 6, ['D_1005'], 'D_1005', 1], 'A5 — 크기를 모르면 같은 이름 하나로 연다 ' + JSON.stringify([a5, a5b]));
      const a6 = await view(page, 'A6');
      await page.waitForTimeout(300);
      const a6b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'A6')._driveId, dirty: __C.dirty - __C0.dirty, x6: state.files.find(x => x.id === 'X6')._driveId }));
      assert.deepEqual([a6.src, a6.w, a6.media], ['blob', 6, ['D_1006']], 'A6 — 보여 주기는 한다 ' + JSON.stringify(a6));
      assert.deepEqual(a6b, { driveId: null, dirty: 0, x6: 'D_1006' }, 'A6 — X6 이 이미 쓰는 Drive ID 는 적지 않는다 ' + JSON.stringify(a6b));
      await page.evaluate(() => closeLightbox());
      const after = JSON.parse(await page.evaluate(snapState)), exp = JSON.parse(before);
      const ids = o => o.files.map(x => [x.name, x.driveId]);
      assert.deepEqual(ids(after), ids(exp).map(([n, d]) => [n, n === 'IMG_1004.jpg' ? 'D_1004' : n === 'IMG_1005.jpg' ? 'D_1005' : d]), '저장본 Drive ID — A4·A5 만 ' + JSON.stringify(ids(after)));
      const strip = o => JSON.stringify(Object.assign({}, o, { files: o.files.map(x => Object.assign({}, x, { driveId: null })) }));
      assert.equal(strip(after), strip(exp), '저장본은 그 두 Drive ID 말고 그대로');
    });

    await test('④ 미리보기 있는 사진은 예전 그대로 · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)', async () => {
      const t1 = await view(page, 'T1');
      assert.deepEqual([t1.src, t1.w, t1.note, t1.list.length, t1.media.length, t1.ro, t1.dirty], ['data', 7, null, 0, 0, 0, 0], 'T1 — 미리보기 그대로 ' + JSON.stringify(t1));
      await page.evaluate(() => closeLightbox());
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(drive.other, [], '드라이브 다른 요청 없음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('lightboxname-v593: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL lightboxname-v593', e && e.stack || e); process.exit(1); });

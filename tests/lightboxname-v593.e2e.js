/* v593 사진 크게 보기(renderLightbox) — 미리보기도 서버 사본(Drive ID)도 없는 사진을 '같은 이름'으로 아무 Drive 사진이나 열고 그 ID 를 저장하던 것.
   예전: 이 기기에 원본(파일 핸들·_file)이 있어도 드라이브 전체를 같은 이름으로 찾았고, 같은 이름이 여럿이거나 크기가 달라도 첫 것을 열어 f._driveId 에 적고 markDirty 했다
   (다른 해의 IMG_1001 이 열리고 남의 Drive ID 가 저장됐다 — AGENTS v584). 사본 꼬리표를 뗀 '이름 일부'로도 찾아 이름이 다른 사진까지 열었다.
   합성 자료(이름·사진은 지어낸 것 — 잡음 PNG), 시계 2026-11-12 고정, 바깥 쓰기 0.
   드라이브 대역: getRoToken 만 페이지 안에서 바꿔 끼운다(구글 로그인 창은 이 컨테이너에서 못 띄운다). 목록·원본 받기는 앱의 진짜 roList·fetch 가 그대로 돌고,
   www.googleapis.com/drive/v3/files 요청을 Playwright route 로 가로채 지어낸 목록(DRIVE)으로 답한다 — 요청 수·질의·받은 원본 id 를 센다.
   대역의 name= 은 진짜 드라이브처럼 대소문자를 가리지 않고, md5Checksum 도 준다. gates 로 목록·원본 응답을 붙잡아 둘 수 있다(늦은 응답 시험).
   ① 이 기기 원본(핸들만·_file 만) 있는 사진 → 그 원본을 그린다(3×2) · 드라이브 요청 0 · 토큰 0 · Drive ID 안 적음 · markDirty 0 · 저장본 불변 ·
      그리지 못하는 원본(손상)은 빈 화면 대신 'decode' 안내 · 드라이브로 넘어가지 않음 (LOCAL)
   ② 원본 없는 사진(마지막 수단) — 같은 이름 둘(하나는 크기까지 같음)·같은 이름 둘 다 같은 크기지만 내용(MD5) 다름·하나인데 크기 다름·
      이름 일부만 맞음('IMG_1003 (1).jpg', 이름 일부 질의 없음)·대소문자만 다른 이름('img_1008.JPG')·목록 크기는 맞는데 받은 원본 크기가 다름 → 모두 열지 않고 안내만 ·
      원본 받기는 마지막 것 하나뿐 · Drive ID·markDirty 0 · 저장본 불변 · 안내가 폰 390·360 에서 사진 칸 아래(‹ › 단추·파일 이름을 덮지 않음) (DRIVE-NO)
   ③ 같은 이름 하나·크기 같음 → 그 원본이 열리고 Drive ID 한 번 적음(markDirty 1) · 크기 모르는 사진(0)은 이름 하나면 보여 주되 'unverified' 조심 글·안 적음 ·
      같은 이름 둘이 같은 크기·같은 MD5(사본)면 보여 주기만 · 다른 기록이 이미 쓰는 Drive ID 면 보여 주기만 · 저장본은 그 한 Drive ID 만 바뀜 (DRIVE-ONE)
   ④ 늦은 응답 — 원본 찾는 사이 닫으면 드라이브 찾기·토큰 0 · 목록 받는 사이 닫으면 원본 받기 0 · 원본 받는 사이 다른 곳에서 Drive ID 를 정하면 덮지 않음 ·
      그 사이 기록이 바뀌면(새 객체) 옛 객체에 적지 않음·markDirty 0 (RACE)
   ⑤ 미리보기가 있는 사진은 예전 그대로(그 미리보기·드라이브 요청 0) · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)
   HJ_V593_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V593_MUTATION:
     drive-first(기기 원본을 안 봄)·no-decode-note(그리기 실패 안내 뺌) → ①
     first-hit(같은 이름 여럿이면 첫 것)·size-pick(같은 이름 여럿 중 크기 하나 맞으면 그것)·no-size(목록 크기 대조 뺌 — 받은 원본 크기 대조가 막아도 원본을 받으러 가므로 받은 id 로 잡힌다)·
     no-raw-size(받은 원본 크기 대조 뺌)·copies-size-only(사본 판정에서 MD5 뺌)·no-name-filter(받은 목록의 이름 대조 뺌)·note-overlay(안내 글을 예전처럼 사진 칸 안에 띄움) → ②
     no-taken(다른 기록이 쓰는 Drive ID 도 적음)·size0-write(크기 모름도 적음)·copies-write(사본 여럿도 적음) → ③
     no-still-after-local·no-still-after-list(그 사이 닫았는지 다시 보기 뺌)·no-own-driveid-guard·no-includes-guard(적기 직전 대조 뺌) → ④ */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'drive-first': [['let local=null; try{ local=f._heicFile||await getFileOf(f); }catch(_){ local=null; }', 'let local=null;']],
  'no-decode-note': [["im.onerror=()=>say(fail,'decode');", '']],
  'first-hit': [['if(list.length>1&&!copies){ say(', 'if(false){ say(']],
  'size-pick': [['if(list.length>1&&!copies){ say(', 'if(list.length>1&&!copies&&list.filter(x=>Number(x.size)===Number(f.size)).length!==1){ say('],
    ['const hit=list[0];', 'const hit=list.find(x=>Number(x.size)===Number(f.size))||list[0];']],
  'no-size': [['if(sz>0&&Number(hit.size)!==sz){', 'if(false){']],
  'no-raw-size': [['if(sz>0&&raw.size!==sz){', 'if(false){']],
  'copies-size-only': [['&&x.md5Checksum&&x.md5Checksum===list[0].md5Checksum', '']],
  'no-name-filter': [['.filter(x=>x&&x.id&&x.name===f.name);', ';']],
  'note-overlay': [['n.style.cssText=HJ_LB_NOTE_CSS;stage.after(n);', "n.style.cssText='position:absolute;left:50%;transform:translateX(-50%);width:max-content;max-width:86vw;color:#cbd5e1;font-size:13px;text-align:center;line-height:1.5;overflow-wrap:anywhere';stage.appendChild(n);"]],
  'no-taken': [['||state.files.some(x=>x&&x!==f&&x._driveId===hit.id))return;', ')return;']],
  'size0-write': [['if(copies||sz<=0)return;', 'if(copies)return;']],
  'copies-write': [['if(copies||sz<=0)return;', 'if(sz<=0)return;']],
  'no-still-after-local': [['if(!__stillCurrent())return;   // 그 사이 넘겼거나', '//']],
  'no-still-after-list': [['      if(!__stillCurrent())return;\n      if(!list.length){', '      if(!list.length){']],
  'no-own-driveid-guard': [['if(f._driveId||!state.files.includes(f)||', 'if(!state.files.includes(f)||']],
  'no-includes-guard': [['if(f._driveId||!state.files.includes(f)||', 'if(f._driveId||']],
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
  { id: 'D_1008L', name: 'img_1008.JPG', buf: PNG.C },              // ② A8 'IMG_1008.jpg' 와 대소문자만 다름 — 드라이브 name= 은 이것도 돌려준다. 크기는 같다
  { id: 'D_DUP1', name: 'IMG_5001.jpg', buf: PNG.C },               // ③ S1 — 같은 사진의 사본 둘(정리본·_중복정리_보관): 같은 크기·같은 MD5
  { id: 'D_DUP2', name: 'IMG_5001.jpg', buf: PNG.C },
  { id: 'D_5002A', name: 'IMG_5002.jpg', buf: PNG.A },              // ② S2 — 같은 이름 둘이 둘 다 S2 와 같은 크기지만 내용(MD5)이 다르다
  { id: 'D_5002B', name: 'IMG_5002.jpg', size: PNG.A.length, buf: PNG.B },
  { id: 'D_6001', name: 'IMG_6001.jpg', buf: PNG.C },               // ④ R1~R4 — 모두 '딱 하나·크기 같음'(정상이면 열고 적을 사진)
  { id: 'D_6002', name: 'IMG_6002.jpg', buf: PNG.C },
  { id: 'D_6003', name: 'IMG_6003.jpg', buf: PNG.C },
  { id: 'D_6004', name: 'IMG_6004.jpg', buf: PNG.C },
];
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
const drive = { list: [], media: [], other: [] };
// 늦은 응답 시험 — 'list:<이름>'·'media:<id>' 열쇠로 응답을 붙잡아 둔다(요청은 바로 센다)
const gates = {};
const gate = key => { let release; const p = new Promise(r => { release = r; }); gates[key] = { p, release: () => { delete gates[key]; release(); } }; return gates[key]; };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout waiting'); await new Promise(r => setTimeout(r, 25)); } };
const unq = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
async function driveMock(route, url) {
  const req = route.request();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization', 'access-control-allow-methods': 'GET' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const m = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (m && url.searchParams.get('alt') === 'media') {
    drive.media.push(m[1]);
    if (gates['media:' + m[1]]) await gates['media:' + m[1]].p;
    const d = DRIVE.find(x => x.id === m[1]);
    return d ? route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'image/png' }, cors), body: d.buf }) : route.fulfill({ status: 404, headers: cors, body: '' });
  }
  if (url.pathname === '/drive/v3/files') {
    const q = url.searchParams.get('q') || ''; drive.list.push(q);
    const eq = q.match(/name\s*=\s*'((?:\\.|[^'\\])*)'/), ct = q.match(/name contains '((?:\\.|[^'\\])*)'/);
    // 진짜 드라이브처럼 name= 은 대소문자를 가리지 않는다 — 앱이 받은 목록을 이름 그대로 다시 대조하는지 본다
    const hits = DRIVE.filter(d => eq ? d.name.toLowerCase() === unq(eq[1]).toLowerCase() : ct ? d.name.toLowerCase().includes(unq(ct[1]).toLowerCase()) : false);
    if (eq && gates['list:' + unq(eq[1])]) await gates['list:' + unq(eq[1])].p;
    return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify({ files: hits.map(d => ({ id: d.id, name: d.name, mimeType: 'image/png', size: String(d.size || d.buf.length), md5Checksum: md5(d.buf) })) }) });
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
    // ① 이 기기 원본이 있지만 그릴 수 없는 파일(잘린 JPG) — 빈 화면 대신 까닭, 드라이브로 넘어가지 않는다
    mk({ id: 'B1', name: 'IMG_2003.jpg', size: 10, _file: new File([new Uint8Array([0xff, 0xd8, 0xff, 4, 5, 6, 7, 8, 9, 10])], 'IMG_2003.jpg', { type: 'image/jpeg' }) }),
    // ②③ 폰의 PC 전용 사진 모양(원본도 사본도 없음 — 저장본에서 되살린 기록)
    mk({ id: 'A1', name: 'IMG_1001.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A2', name: 'IMG_1002.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A3', name: 'IMG_1003 (1).jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A7', name: 'IMG_1007.jpg', size: P.A.length, _virtual: true }),
    mk({ id: 'A4', name: 'IMG_1004.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'A5', name: 'IMG_1005.jpg', size: 0, _virtual: true }),
    mk({ id: 'A6', name: 'IMG_1006.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'X6', name: 'IMG_1006.jpg', prefix: '_정리완료/가온아파트/현장사진/', size: P.C.length, _virtual: true, _driveId: 'D_1006', thumb: P.px }),
    mk({ id: 'A8', name: 'IMG_1008.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'S1', name: 'IMG_5001.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'S2', name: 'IMG_5002.jpg', size: P.A.length, _virtual: true }),
    // ④ 늦은 응답 — R1 은 핸들이 있지만 새로고침 뒤 권한이 풀려 getFile 이 (게이트 뒤) 실패하는 모양, R2~R4 는 원본 없음
    mk({ id: 'R1', name: 'IMG_6001.jpg', size: P.C.length, handle: { kind: 'file', name: 'IMG_6001.jpg', getFile: async () => { await window.__gateLocal; throw new DOMException('denied', 'NotAllowedError'); } } }),
    mk({ id: 'R2', name: 'IMG_6002.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'R3', name: 'IMG_6003.jpg', size: P.C.length, _virtual: true }),
    mk({ id: 'R4', name: 'IMG_6004.jpg', size: P.C.length, _virtual: true }),
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
// 안내 글 자리 — 폰에서 ‹ › 단추를 덮어 눌리지 않거나 파일 이름 위에 겹치면 안 된다(검토: 예전엔 사진 칸 안에 띄워 단추 윗부분이 죽었다)
const layout = page => page.evaluate(() => {
  const box = el => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width }; };
  const n = document.getElementById('lbNote'), name = document.querySelector('.lb-meta b');
  const nav = ['lbPrev', 'lbNext'].map(id => document.getElementById(id)).filter(Boolean);
  const N = box(n), M = box(name), X = nav.map(box);
  const dead = [];
  for (const btn of nav) { const b = btn.getBoundingClientRect(), x = b.left + b.width / 2;
    for (let y = Math.ceil(b.top) + 2; y < b.bottom - 2; y += 3) { const h = document.elementFromPoint(x, y); if (!(h === btn || btn.contains(h))) dead.push(btn.id + '@' + y + '=' + (h && (h.id || h.className || h.tagName))); } }
  const cross = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
  return { nav: X.length, dead, navCross: X.map(x => cross(N, x)), nameCross: cross(N, M), inView: N.l >= -0.5 && N.r <= innerWidth + 0.5 && N.w > 120, below: N.t >= document.querySelector('.lb-stage').getBoundingClientRect().bottom - 0.5 };
});

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
      const b1 = await view(page, 'B1');
      assert.deepEqual([b1.list.length, b1.media.length, b1.ro, b1.driveId, b1.dirty, b1.src, b1.w], [0, 0, 0, null, 0, 'blob', 0], 'B1(그릴 수 없는 원본) — 드라이브로 넘어가지 않고 아무것도 적지 않는다 ' + JSON.stringify(b1));
      assert.equal(b1.note, 'decode', 'B1 — 빈 화면 대신 그리지 못한 까닭을 남긴다 ' + JSON.stringify(b1));
      assert.ok(/이 기기의 원본을 그리지 못했습니다/.test(b1.noteText) && b1.noteIn, 'B1 안내 글·폰 390 안 ' + JSON.stringify(b1));
      await page.evaluate(() => closeLightbox());
      assert.equal(drive.list.length + drive.media.length, 0, '① 동안 드라이브 요청 0');
      assert.equal(await page.evaluate(snapState), before, '① 저장본 불변');
    });

    await test('② 원본 없는 사진 — 같은 이름 여럿·크기 다름·이름 일부·받은 원본 크기 다름은 열지 않음 · Drive ID 0 (DRIVE-NO)', async () => {
      const a1 = await view(page, 'A1', ['A1', 'A2']);
      assert.equal(a1.note, 'ambiguous', 'A1 — 같은 이름 둘(하나는 크기까지 같음)이면 열지 않는다 ' + JSON.stringify(a1));
      for (const [w, h] of [[390, 900], [360, 740]]) {
        if (w !== 390) { await page.setViewportSize({ width: w, height: h }); const again = await view(page, 'A1', ['A1', 'A2']); assert.equal(again.note, 'ambiguous', w + ' A1 다시'); }
        const L = await layout(page);
        assert.equal(L.nav, 2, w + ' — ‹ › 단추가 있는 화면에서 본다');
        assert.deepEqual(L.dead, [], w + ' — 안내 글이 ‹ › 단추를 덮어 눌리지 않는 곳이 없다 ' + JSON.stringify(L));
        assert.deepEqual([L.navCross, L.nameCross, L.inView, L.below], [[0, 0], 0, true, true], w + ' — 안내 글은 사진 칸 아래, 단추·파일 이름과 겹치지 않고 화면 안 ' + JSON.stringify(L));
      }
      await page.setViewportSize({ width: 390, height: 900 });
      assert.deepEqual([a1.media, a1.driveId, a1.dirty, a1.src], [[], null, 0, ''], 'A1 — 원본 받기·Drive ID·markDirty 없음 ' + JSON.stringify(a1));
      assert.ok(a1.ro >= 1 && a1.list.length === 1 && /^name='IMG_1001\.jpg' and trashed=false/.test(a1.list[0]), 'A1 — 이름이 정확히 같은 것만 찾는다 ' + JSON.stringify(a1.list));
      assert.ok(/같은 이름 사진이 2장/.test(a1.noteText) && a1.noteIn, 'A1 안내 글·폰 390 안 ' + JSON.stringify(a1));
      const a2 = await view(page, 'A2');
      assert.deepEqual([a2.note, a2.media, a2.driveId, a2.dirty], ['size', [], null, 0], 'A2 — 같은 이름 하나지만 크기가 다르면 받지도 않는다 ' + JSON.stringify(a2));
      const a3 = await view(page, 'A3');
      assert.deepEqual([a3.note, a3.media, a3.driveId, a3.dirty], ['notfound', [], null, 0], "A3 — 'IMG_1003 (1).jpg' 은 IMG_1003.jpg 가 아니다 " + JSON.stringify(a3));
      assert.ok(a3.list.length === 1 && !a3.list.some(q => /name contains/.test(q)), "A3 — 이름 일부('contains') 질의를 하지 않는다 " + JSON.stringify(a3.list));
      assert.ok(a3.noteText.includes('IMG_1003 (1).jpg'), 'A3 안내에 파일 이름 그대로 ' + a3.noteText);
      const s2 = await view(page, 'S2');
      assert.deepEqual([s2.note, s2.media, s2.driveId, s2.dirty, s2.src], ['ambiguous', [], null, 0, ''], 'S2 — 같은 이름 둘이 같은 크기여도 내용(MD5)이 다르면 열지 않는다 ' + JSON.stringify(s2));
      const a8 = await view(page, 'A8');
      assert.deepEqual([a8.note, a8.media, a8.driveId, a8.dirty, a8.src], ['notfound', [], null, 0, ''], "A8 — 'img_1008.JPG' 는 'IMG_1008.jpg' 가 아니다(드라이브가 돌려줘도) " + JSON.stringify(a8));
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
      await page.waitForTimeout(300);
      const a5b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'A5')._driveId, dirty: __C.dirty - __C0.dirty }));
      assert.deepEqual([a5.src, a5.w, a5.media, a5.note], ['blob', 6, ['D_1005'], 'unverified'], 'A5 — 크기를 모르면 같은 이름 하나로 보여 주되 조심 글 ' + JSON.stringify(a5));
      assert.ok(/같은 사진인지 확인하지 못했습니다/.test(a5.noteText) && a5.noteIn, 'A5 조심 글·폰 390 안 ' + JSON.stringify(a5));
      assert.deepEqual([a5b.driveId, a5b.dirty], [null, 0], 'A5 — 크기를 모르면 같은 사진이라는 근거가 없어 Drive ID 를 적지 않는다 ' + JSON.stringify(a5b));
      const s1 = await view(page, 'S1');
      await page.waitForTimeout(300);
      const s1b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'S1')._driveId, dirty: __C.dirty - __C0.dirty }));
      assert.deepEqual([s1.src, s1.w, s1.h, s1.note, s1.media.length], ['blob', 6, 3, null, 1], 'S1 — 같은 크기·같은 MD5 사본 둘이면 하나만 받아 보여 준다 ' + JSON.stringify(s1));
      assert.deepEqual([s1b.driveId, s1b.dirty], [null, 0], 'S1 — 어느 사본에 이을지 몰라 Drive ID 는 적지 않는다 ' + JSON.stringify(s1b));
      const a6 = await view(page, 'A6');
      await page.waitForTimeout(300);
      const a6b = await page.evaluate(() => ({ driveId: state.files.find(x => x.id === 'A6')._driveId, dirty: __C.dirty - __C0.dirty, x6: state.files.find(x => x.id === 'X6')._driveId }));
      assert.deepEqual([a6.src, a6.w, a6.media], ['blob', 6, ['D_1006']], 'A6 — 보여 주기는 한다 ' + JSON.stringify(a6));
      assert.deepEqual(a6b, { driveId: null, dirty: 0, x6: 'D_1006' }, 'A6 — X6 이 이미 쓰는 Drive ID 는 적지 않는다 ' + JSON.stringify(a6b));
      await page.evaluate(() => closeLightbox());
      const after = JSON.parse(await page.evaluate(snapState)), exp = JSON.parse(before);
      const ids = o => o.files.map(x => [x.name, x.driveId]);
      assert.deepEqual(ids(after), ids(exp).map(([n, d]) => [n, n === 'IMG_1004.jpg' ? 'D_1004' : d]), '저장본 Drive ID — A4 만 ' + JSON.stringify(ids(after)));
      const strip = o => JSON.stringify(Object.assign({}, o, { files: o.files.map(x => Object.assign({}, x, { driveId: null })) }));
      assert.equal(strip(after), strip(exp), '저장본은 그 Drive ID 말고 그대로');
    });

    await test('④ 늦은 응답 — 닫은 뒤엔 찾지도 받지도 않고, 그 사이 정해진 Drive ID·바뀐 기록에는 적지 않음 (RACE)', async () => {
      const st = id => page.evaluate(i => { const f = state.files.find(x => x.id === i); return { driveId: f ? f._driveId : 'gone', dirty: __C.dirty - __C0.dirty, ro: __C.ro - __C0.ro }; }, id);
      // R1 — 원본(핸들)을 읽는 사이 닫음 → 원본이 없다고 나와도 드라이브 찾기·로그인(토큰)을 하지 않는다
      let m0 = { list: drive.list.length, media: drive.media.length };
      await page.evaluate(() => { window.__gateLocal = new Promise(r => { window.__releaseLocal = r; }); window.__C0 = Object.assign({}, __C); openLightbox('R1', ['R1']); });
      await page.waitForTimeout(150);
      await page.evaluate(() => { closeLightbox(); window.__releaseLocal(); });
      await page.waitForTimeout(500);
      const r1 = await st('R1');
      assert.deepEqual([drive.list.slice(m0.list), drive.media.slice(m0.media), r1], [[], [], { driveId: null, dirty: 0, ro: 0 }], 'R1 — 닫은 뒤엔 드라이브를 찾지 않는다 ' + JSON.stringify(r1));
      // R2 — 드라이브 목록을 기다리는 사이 닫음 → 원본을 받지 않는다
      m0 = { list: drive.list.length, media: drive.media.length };
      const g2 = gate('list:IMG_6002.jpg');
      await page.evaluate(() => { window.__C0 = Object.assign({}, __C); openLightbox('R2', ['R2']); });
      await until(() => drive.list.slice(m0.list).some(q => q.includes('IMG_6002.jpg')));
      await page.evaluate(() => closeLightbox());
      g2.release();
      await page.waitForTimeout(500);
      const r2 = await st('R2');
      assert.deepEqual([drive.media.slice(m0.media), r2.driveId, r2.dirty], [[], null, 0], 'R2 — 닫은 뒤 도착한 목록으로 원본을 받지 않는다 ' + JSON.stringify(r2));
      // R3 — 원본을 받는 사이 다른 곳(서버 사진 목록 맞추기 등)에서 Drive ID 가 정해짐 → 덮지 않는다
      m0 = { list: drive.list.length, media: drive.media.length };
      const g3 = gate('media:D_6003');
      await page.evaluate(() => { window.__C0 = Object.assign({}, __C); openLightbox('R3', ['R3']); });
      await until(() => drive.media.slice(m0.media).includes('D_6003'));
      await page.evaluate(() => { state.files.find(x => x.id === 'R3')._driveId = 'D_ELSEWHERE'; });
      g3.release();
      await page.waitForFunction(() => { const im = document.getElementById('lbImg'); return im && /^blob:/.test(im.src) && im.complete && im.naturalWidth > 0; }, null, { timeout: 8000 });
      await page.waitForTimeout(300);
      const r3 = await st('R3');
      assert.deepEqual([r3.driveId, r3.dirty], ['D_ELSEWHERE', 0], 'R3 — 그 사이 정해진 Drive ID 를 덮지 않는다 ' + JSON.stringify(r3));
      await page.evaluate(() => closeLightbox());
      // R4 — 원본을 받는 사이 기록이 새 객체로 바뀜(서버 자료 불러오기 등) → 옛 객체에 적고 markDirty 하지 않는다
      m0 = { list: drive.list.length, media: drive.media.length };
      const g4 = gate('media:D_6004');
      await page.evaluate(() => { window.__C0 = Object.assign({}, __C); openLightbox('R4', ['R4']); });
      await until(() => drive.media.slice(m0.media).includes('D_6004'));
      await page.evaluate(() => { window.__oldR4 = state.files.find(x => x.id === 'R4'); state.files[state.files.indexOf(__oldR4)] = Object.assign({}, __oldR4); });
      g4.release();
      await page.waitForFunction(() => { const im = document.getElementById('lbImg'); return im && /^blob:/.test(im.src) && im.complete && im.naturalWidth > 0; }, null, { timeout: 8000 });
      await page.waitForTimeout(300);
      const r4 = await st('R4'), old4 = await page.evaluate(() => __oldR4._driveId);
      assert.deepEqual([r4.driveId, old4, r4.dirty], [null, null, 0], 'R4 — 바뀐 기록에는 적지 않는다 ' + JSON.stringify([r4, old4]));
      await page.evaluate(() => closeLightbox());
    });

    await test('⑤ 미리보기 있는 사진은 예전 그대로 · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)', async () => {
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
  console.log('lightboxname-v593: ' + passed + '/5');
  if (passed !== 5) process.exit(1);
})().catch(e => { console.error('FAIL lightboxname-v593', e && e.stack || e); process.exit(1); });

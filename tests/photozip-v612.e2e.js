/* v612 🗜 한 달 지난 현장 사진 — PC 에는 줄인 사진 ZIP, 앱(폰·PC)에서는 구글 서버 사본으로 계속 보기.
   대표 11/19 "PC 에서는 압축 관리하고 구글서버에는 사진 자료가 올라와 있게 해서 PC 에서만 용량을 줄일 수 있게"(물음 두 개: '원본은 안 남김' · 'PC 엔 줄인 사진 ZIP').
   v611(11/18, 원본 ZIP·앱 목록에서 뺌) 검사(photozip-v611.e2e.js)를 이것으로 바꿨다 — 같은 OPFS·python3 zipfile 틀에 구글 서버(중계)를 페이지 안 가짜로.
   합성 자료와 OPFS(브라우저 안의 진짜 폴더 손잡이 — 만들기·쓰기·바꿔 쓰기·지우기가 PC 폴더와 같은 API)만 쓴다. 바깥 쓰기 0(중계 호출은 페이지 안 가짜 relayCall).
   쓴 ZIP 은 Node 로 꺼내 python3 zipfile 로 다시 읽는다. 줄인 사진은 페이지에서 그려 크기·EXIF(앱이 쓰는 EXIF.js 2.3.0 고정본)를 본다.
   이 컨테이너 크로미움은 로캘이 없으면 OPFS 의 한글 이름을 버린다 — LANG=C.UTF-8 로 띄운다(CI 는 원래 UTF-8).
   ① PLAN — 한 달 전 같은 날 · 대상과 아닌 것 · 현장별 묶음 · 구글에 먼저 올릴 수 · 읽기만 · 구글 서버 연결이 없으면 막음 · EXIF(촬영일시 한국·GPS, JFIF 뺌)를 앱 판독기로
   ② RUN — 구글 사본 확인(목록)·없거나 사라진 사진만 올림·못 올리면 PC 에 그대로 · 줄인 사진(긴 변 2000·PNG→JPG·HEIC 그대로)·EXIF · csv v2 · ZIP 표시 ·
      원본 삭제 · 기록은 앱에 남고 구글 사본 기록으로(저장본에도) · 정리 표시·다시 불러오지 않기 없음 · 미리보기 미리 넣음 · 현장 요약(장수·원본·ZIP) · 내역서 사진 수 그대로 · 안전판 1회
   ③ APPEND — 같은 ZIP 에 덧붙임 · ZIP 에 있는데 원본을 못 지운 사진은 다시 안 담고 원본만 · 같은 자리 같은 크기라도 내용이 다르면 새로 담음 · 파일 없는 기록은
      구글 사본이 있으면 기록만 · 없으면 그대로 · 크기 상한이면 _2 · [멈추기] 뒤 이어서
   ④ GUARD — 깨진 ZIP(새로·덧붙임)·안전판 실패·읽은 뒤 바뀐 원본·저장 실패(원본을 안 지움 → 다음 실행이 ZIP 에 다시 안 담고 마무리) · 서버 연결 없음·목록 실패·
      목록이 잘렸고 미리보기도 못 하면 그대로(되면 보관) · 데모·오래된 창·직원·폴더 없음·폴더 읽는 중 · 보관 중에는 [다시 스캔] 안 함
   ⑤ MIGRATE — 진짜 v611(2c8160d) 페이지로 원본 ZIP 을 만들고(앱에서 빠짐·정리 표시·다시 불러오지 않기·days), v612 가 같은 기기 자료로 열어 앱에 되살리고
      (정리 표시의 Drive ID · 없으면 ZIP 에서 올림 · 못 올리는 형식은 ZIP 에 원본) ZIP 을 줄인 사진으로 다시 씀 · 내역서 사진 수 두 번 안 셈 · 다시 열어도 그대로 · 두 번째는 할 일 없음
   ⑥ AUTO — 진짜 폴더 읽기 뒤 묻지 않고 보관 · 다시 읽어도 기록은 구글 사본으로 남고 '평소보다 적어요'(색인 정리 끔)가 안 뜸 · _사진보관 은 안 읽음 · 서버 연결 없으면 기록만 · 끄면 안 함
   ⑦ UI — ⋯ 사진 도구 · 창(대상·먼저 올릴 수·자동·마지막 결과·현장 줄의 원본→ZIP·서버 연결 없음 안내·잠김) · 도움말 · 폰 390 넘침 0·44px · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0
   HJ_V612_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V612_MUTATION: all-ages 는 ①, no-drive-check·no-shrink·no-exif·remove-records 는 ②, no-crc-guard·no-heal 은 ③,
   no-verify·no-tmp·delete-first 는 ④, no-restore·no-days·no-tomb-revive 는 ⑤, no-scan-guard·no-auto·no-scan-skip 은 ⑥ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const EXIF_JS = fs.readFileSync(path.join(__dirname, 'fixtures', 'vendor', 'exif-js-2.3.0.js'), 'utf8');
const EXIF_CDN = 'https://cdn.jsdelivr.net/npm/exif-js@2.3.0/exif.js';
const V611 = '2c8160d';   // v611 병합 — ⑤ 의 '옛 원본 ZIP' 을 그 코드로 만든다
const MUT = {
  'all-ages': ['const day=hjKDayFast(f);return !!day&&day<cutoff;', 'const day=hjKDayFast(f);return !!day;'],
  'no-drive-check': ["if(rec._driveId){const has=await hjPzDriveHas(ctx,rec._driveId);if(has===true)return rec._driveId;if(has===null){res.unknown++;return '';}}", 'if(rec._driveId)return rec._driveId;'],
  'no-shrink': ['    if(out.length>=u8.length)return {bytes:u8,shrunk:false,thumb};', '    return {bytes:u8,shrunk:false,thumb};'],
  'no-exif': ['const out=hjPzExifJpeg(new Uint8Array(await blob.arrayBuffer()),rec&&rec.when,rec&&rec.lat,rec&&rec.lng);', 'const out=new Uint8Array(await blob.arrayBuffer());'],
  'remove-records': ['try{saved=await guardedPersistMediaFiles(arr0.map(f=>map.get(f)||f),current);}', 'try{saved=await guardedPersistMediaFiles(arr0.filter(f=>!map.has(f)),current);}'],
  'no-crc-guard': ['if(inZip.get(key)===ocrc){later.push(it);continue;}', 'if(inZip.has(key)){later.push(it);continue;}'],
  'no-heal': ['if(has===true)later.push({rec,driveId:rec._driveId,heal:true});else res.missing++;', 'res.missing++;'],
  'no-verify': ["    if(blob.size!==a.size||(await hjCrc32Blob(blob))!==a.crc)throw new Error('zip-crc');", "    if(blob.size!==a.size)throw new Error('zip-crc');"],
  'no-tmp': ['const tmpName=last.name+HJ_PZ_TMP,{h:th,w}=await hjPzOpenWrite(root,tmpName);', 'const tmpName=last.name+HJ_PZ_TMP,th=last.handle,w=await th.createWritable();'],
  'delete-first': ["if(done===null){res.uncommitted+=go.length;res.why='commit';return 0;}", "if(done===null){for(const x of go)if(!x.heal)await hjPzDeleteSource(x);res.uncommitted+=go.length;res.why='commit';return 0;}"],
  'no-restore': ['    pend.push(rec);ready.set(e.name,driveId);', '    ready.set(e.name,driveId);'],
  'no-days': ['undo.push([p,p.photoArchive]);p.photoArchive=hjPzSummaryRestore(p.photoArchive,list);', 'undo.push([p,p.photoArchive]);'],
  'no-tomb-revive': ['      state.photoTombs=hjTombUpdate(prevT,[],recs.concat(pseudo),files,new Date().toISOString());', ''],
  'no-scan-guard': ['    const _saved=Math.max(0,(state._savedFileCount||0)-_pzN);', '    const _saved=(state._savedFileCount||0);'],
  'no-auto': ['    if(ok){try{hjPhotoZipAutoSchedule();}catch(e){}}\n', ''],
  'no-scan-skip': [
    ["if(/^(_백업|데이터|_중복정리_보관|_사진보관)/.test(name)||(!prefix&&/^사례 작성/.test(String(name).normalize('NFC')))){try{window.__walkSkip", "if(/^(_백업|데이터|_중복정리_보관)/.test(name)||(!prefix&&/^사례 작성/.test(String(name).normalize('NFC')))){try{window.__walkSkip"],
    ['(_백업|데이터|_중복정리_보관|_사진보관)[^\\/]*\\//.test(path))return true;', '(_백업|데이터|_중복정리_보관)[^\\/]*\\//.test(path))return true;'],
  ],
};
const gitShow = rev => execFileSync('git', ['show', rev + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let html = process.env.HJ_V612_BASELINE ? gitShow(process.env.HJ_V612_BASELINE) : null;
if (process.env.HJ_V612_MUTATION) {
  const m = MUT[process.env.HJ_V612_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V612_MUTATION);
  const pairs = Array.isArray(m[0]) ? m : [m];
  html = SRC;
  for (const [from, to] of pairs) { assert.equal(html.split(from).length, 2, 'mutation anchor ' + from.slice(0, 60)); html = html.replace(from, () => to); }
}

const TODAY = '2026-11-19';   // 앱의 '오늘'(hjPzToday)을 고정 — 기준일 2026-10-19 앞에 찍은 사진이 대상
const gen = (n, seed) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7 + (i >> 8)) & 255; return b; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hj-v612-'));
// python3 zipfile 로 다시 읽기 — testzip(CRC), 항목(이름·크기·CRC·주석·날짜·sha256), csv 글자, ZIP 주석
const PY = `import zipfile,json,hashlib,sys
z=zipfile.ZipFile(sys.argv[1])
bad=z.testzip()
out={'bad':bad,'comment':z.comment.decode('latin-1'),'entries':[],'csv':[]}
for i in z.infolist():
    d=z.read(i)
    out['entries'].append({'name':i.filename,'size':i.file_size,'csize':i.compress_size,'method':i.compress_type,'crc':'%08x'%i.CRC,'comment':i.comment.decode('utf-8'),'date':list(i.date_time),'utf8':bool(i.flag_bits & 0x800),'sha':hashlib.sha256(d).hexdigest()})
    if i.filename.startswith('_목록/'):
        out['csv'].append(d.decode('utf-8-sig'))
print(json.dumps(out,ensure_ascii=False))`;
function pyZip(b64, tag) {
  const file = path.join(TMP, tag + '.zip'); fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return JSON.parse(execFileSync('python3', ['-c', PY, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}
const csvRows = text => { const lines = text.replace(/\r\n$/, '').split('\r\n'); const head = lines.shift().split(','); return lines.map(l => { const c = l.split(','), o = {}; head.forEach((h, i) => { o[h] = c[i]; }); return o; }); };

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, auto, context: ctx0, appHtml }) {
  const context = ctx0 || await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  if (!ctx0) {
    context.__html = html;
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (context.__html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: context.__html }); return route.continue(); }
      if (read && url.href === EXIF_CDN) return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: EXIF_JS });
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
  }
  if (appHtml !== undefined) context.__html = appHtml;
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message()); dialog.dismiss(); });
  await page.addInitScript(auto => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' }));
    if (auto) Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false });   // 사람이 연 PC 처럼(자동 보관은 자동화 브라우저에서 안 한다)
  }, !!auto);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, today }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    __gdToken = null; relayReady = () => false; aiAutoOrgOffer = () => {}; quoteAutoAssignOffer = () => {}; if (typeof hjEstimateAutoRead === 'function') hjEstimateAutoRead = () => {};
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    if (typeof hjPzToday === 'function') hjPzToday = () => today;
    // 페이지 안 가짜 구글 서버(중계) — 사진 목록·올리기·미리보기만. 앱의 다른 서버 길(저장·목록 맞추기)은 끈다
    window.__R = {
      files: new Map(), uploads: [], calls: [], seq: 0, truncated: false, truncLimit: 0, failNames: new Set(), listFail: false, thumbThrow: false,
      add(id, info) { this.files.set(id, Object.assign({ name: id + '.jpg', mimeType: 'image/jpeg', size: 1000 }, info || {})); return id; },
    };
    relayCall = async (action, payload) => {
      __R.calls.push(action);
      if (action === 'listFiles') {
        if (__R.listFail) return { ok: false, error: 'server-error', message: 'x' };
        const all = [...__R.files].map(([id, f]) => ({ id, name: f.name, mimeType: f.mimeType, size: f.size, kind: 'photo', recoverOnly: false }));
        return { ok: true, files: __R.truncated ? all.slice(0, __R.truncLimit) : all, truncated: !!__R.truncated };
      }
      if (action === 'upload') {
        const name = String(payload.name), mime = String(payload.mimeType);
        __R.uploads.push({ name, mime, b64: payload.dataB64.length });
        if (__R.failNames.has(name)) return { ok: false, error: 'server-error', message: '잠시 뒤에' };
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mime)) return { ok: false, error: 'bad-request', message: '허용되지 않는 파일 형식: ' + mime };
        const id = 'UP' + String(++__R.seq).padStart(3, '0') + 'drivefileid', size = Math.floor(payload.dataB64.length * 3 / 4);
        __R.files.set(id, { name, mimeType: mime, size, b64: payload.dataB64 });
        return { ok: true, fileId: id, name, folder: '현장사진', mimeType: mime, size };
      }
      if (action === 'thumbnail') {
        if (__R.thumbThrow) throw new Error('HTTP 500');
        return __R.files.has(payload.fileId) ? { ok: true, fileId: payload.fileId, mimeType: 'image/jpeg', source: 'thumbnail', dataB64: '/9j/' } : { ok: false, error: 'not-found', message: '사진 파일을 찾지 못했습니다' };
      }
      return { ok: false, error: 'bad-request', message: 'action ' + action };
    };
    if (typeof relaySaveNow === 'function') relaySaveNow = async () => {};
    if (typeof relayMarkUnsynced === 'function') relayMarkUnsynced = () => {};
    if (typeof relayLoadDriveFiles === 'function') relayLoadDriveFiles = async () => {};
    const gen = (n, seed) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7 + (i >> 8)) & 255; return b; };
    window.__T = {
      gen,
      relayOn() { relayReady = () => true; }, relayOff() { relayReady = () => false; },
      // 잡음 사진(JPEG·PNG) — 줄이면 확실히 작아진다
      async img(w, h, seed, type, q) {
        const c = new OffscreenCanvas(w, h), x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
        let s = (seed * 2654435761) >>> 0 || 1;
        for (let i = 0; i < d.length; i += 4) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; d[i] = s & 255; d[i + 1] = (s >>> 8) & 255; d[i + 2] = ((i >> 14) + seed * 40) & 255; d[i + 3] = 255; }
        x.putImageData(im, 0, 0);
        return new Uint8Array(await (await c.convertToBlob({ type: type || 'image/jpeg', quality: q || 0.92 })).arrayBuffer());
      },
      async root(name) { const o = await navigator.storage.getDirectory(); return o.getDirectoryHandle(name, { create: true }); },
      async dir(top, p) { let d = top; for (const x of String(p).split('/').filter(Boolean)) d = await d.getDirectoryHandle(x, { create: true }); return d; },
      async put(top, p, name, bytes) { const d = await __T.dir(top, p), h = await d.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(bytes); await w.close(); return h; },
      async exists(top, p, name) { try { const d = await __T.dir(top, p); await d.getFileHandle(name); return true; } catch (e) { return false; } },
      async bytesOf(top, p, name) { const d = await __T.dir(top, p), f = await (await d.getFileHandle(name)).getFile(); return new Uint8Array(await f.arrayBuffer()); },
      async list(top, p) { const d = await __T.dir(top, p), out = []; for await (const [n, h] of d.entries()) out.push(n + (h.kind === 'directory' ? '/' : '')); return out.sort(); },
      b64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
      async zip(top, name) { return __T.b64(await __T.bytesOf(top, '_사진보관', name)); },
      eq(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; },
      async sha(u) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map(b => b.toString(16).padStart(2, '0')).join(''); },
      proj(name, extra) { return Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, extra || {}); },
      async rec(top, id, project, prefix, name, bytes, when, extra) {
        const h = await __T.put(top, prefix, name, bytes);
        return Object.assign({ id, kind: 'photo', project, prefix, name, ext: name.split('.').pop().toLowerCase(), size: bytes.length, when: new Date(when), handle: h, _file: null, thumb: null, text: '', ocr: 'na', lat: null, lng: null, place: null, address: null, _phase: null, _worklabel: null }, extra || {});
      },
      // ZIP 안 항목 하나 꺼내 그려 보기(크기) · EXIF(앱이 쓰는 판독기)
      async entry(top, zipName, entryName) {
        const f = await (await (await __T.dir(top, '_사진보관')).getFileHandle(zipName)).getFile(), d = await hjPzReadDir(f), e = d && d.entries.find(x => x.name === entryName);
        if (!e) return null;
        const u = await hjPzEntryData(f, e);
        let w = 0, h = 0; try { const b = await createImageBitmap(new Blob([u])); w = b.width; h = b.height; b.close(); } catch (_) {}
        let exif = null; try { const t = EXIF.readFromBinaryFile(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)) || {}; exif = { dt: t.DateTimeOriginal || '', lat: t.GPSLatitude ? dms(t.GPSLatitude, t.GPSLatitudeRef) : null, lng: t.GPSLongitude ? dms(t.GPSLongitude, t.GPSLongitudeRef) : null }; } catch (_) {}
        return { size: u.length, w, h, soi: [u[0], u[1], u[2], u[3]], exif };
      },
    };
  }, { keys: BOOT, mobile: !!mobile, today: TODAY });
  return { context, page };
}
async function addExif(page) { await page.addScriptTag({ content: EXIF_JS }); }
async function test(name, fn) { await fn(); passed++; console.log('PASS photozip-v612 ' + name); }
const zipNames = z => z.entries.map(e => e.name);
const photosOf = z => zipNames(z).filter(n => !n.startsWith('_목록/'));

(async () => {
  browser = await chromium.launch({
    executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined,
    env: Object.assign({}, process.env, /utf-?8/i.test(process.env.LC_ALL || process.env.LANG || '') ? {} : { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }),
  });
  try {
    const { page } = await open({ width: 1280 });
    await addExif(page);

    await test('① 한 달 전 같은 날 · 대상과 아닌 것 · 구글에 먼저 올릴 수 · 읽기만 · 서버 연결 없으면 막음 · EXIF (PLAN)', async () => {
      const r = await page.evaluate(async () => {
        const cut = ['2026-11-19', '2026-03-31', '2026-01-15', '2024-03-30', '2026-12-31', ''].map(hjPzCutoff);
        const F = (id, project, name, when, extra) => Object.assign({ id, kind: 'photo', project, prefix: '_정리완료/P/', name, ext: name.split('.').pop().toLowerCase(), size: 1000, when: new Date(when), handle: { getFile: async () => null }, text: '', ocr: 'na' }, extra || {});
        state.projects = [__T.proj('계획A'), __T.proj('계획B')];
        state.files = [
          F('in1', '계획A', 'a.jpg', '2026-09-01T10:00:00+09:00', { _driveId: 'DIN1drivefile' }),
          F('in2', '계획A', 'b.heic', '2026-10-18T23:59:00+09:00'),                  // 경계 전날 밤 — 대상
          F('in3', '계획B', 'c.PNG', '2026-07-01T09:00:00+09:00', { ext: 'png' }),
          F('in0', '계획A', 'z.jpg', '2026-08-01T09:00:00+09:00', { _driveId: 'DIN0drivefile' }),   // 더 먼저 찍음 — 묶음 맨 앞
          F('out-edge', '계획A', 'd.jpg', '2026-10-19T00:00:00+09:00'),               // 기준일 0시 — 아직 아님
          F('out-recent', '계획A', 'e.jpg', '2026-11-15T09:00:00+09:00'),
          F('out-nopj', null, 'f.jpg', '2026-09-01T09:00:00+09:00'),
          F('out-gone', '(삭제됨) 계획C', 'g.jpg', '2026-09-01T09:00:00+09:00'),
          F('out-video', '계획A', 'h.mp4', '2026-09-01T09:00:00+09:00', { ext: 'mp4' }),
          F('out-virtual', '계획A', 'i.jpg', '2026-09-01T09:00:00+09:00', { handle: null, _virtual: true, _driveId: 'DVdrivefileid' }),
          F('out-zero', '계획A', 'j.jpg', '2026-09-01T09:00:00+09:00', { size: 0 }),
          F('out-est', '계획A', 'k.jpg', '2026-09-01T09:00:00+09:00', { kind: 'estimate' }),
          F('out-quote', '계획A', 'l.jpg', '2026-09-01T09:00:00+09:00', { _fromQuote: true }),
        ];
        const before = JSON.stringify(serializeData().files), P = hjPhotoZipPlan();
        const groups = [...P.groups].map(([k, v]) => [k, v.map(f => f.id)]);
        const after = JSON.stringify(serializeData().files);
        // 막음 — 폴더는 있는데 구글 서버 연결이 없으면
        state.dirHandle = await __T.root('계획빈'); __T.relayOff();
        const blockOff = hjPhotoZipBlock(), runOff = await hjPhotoZipRun({}), toastOff = document.getElementById('toast').textContent;
        __T.relayOn(); const blockOn = hjPhotoZipBlock(); __T.relayOff(); state.dirHandle = null;
        // EXIF — 캔버스 JPEG 에 촬영일시(한국)·GPS 를 적고 JFIF 를 뺀다 · 앱 판독기(EXIF.js · parseExifDate · dms)로 다시 읽기
        const small = await __T.img(40, 30, 3), when = new Date('2026-09-10T10:00:00+09:00');
        const ex = hjPzExifJpeg(small, when, 36.3504, 127.3845), exS = hjPzExifJpeg(small, when, -33.5, -70.25), exN = hjPzExifJpeg(small, when, null, null);
        const read = u => { const t = EXIF.readFromBinaryFile(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)) || {}; return { dt: t.DateTimeOriginal, at: parseExifDate(t.DateTimeOriginal) && parseExifDate(t.DateTimeOriginal).toISOString(), lat: t.GPSLatitude ? dms(t.GPSLatitude, t.GPSLatitudeRef) : null, lng: t.GPSLongitude ? dms(t.GPSLongitude, t.GPSLongitudeRef) : null }; };
        const b = await createImageBitmap(new Blob([ex], { type: 'image/jpeg' }));
        return { cut, n: P.n, bytes: P.bytes, projects: P.projects, cutoff: P.cutoff, noDrive: P.noDrive, groups, same: before === after, auto: hjPhotoZipAutoSchedule(), webdriver: navigator.webdriver,
          blockOff, runOff: runOff.why, toastOff, blockOn, small23: [small[2], small[3]], ex23: [ex[2], ex[3]], app0Gone: ![...ex.subarray(4, 400)].some((v, i, a) => v === 0xFF && a[i + 1] === 0xE0), w: b.width,
          exif: read(ex), exifS: read(exS), exifN: read(exN) };
      });
      assert.deepEqual(r.cut, ['2026-10-19', '2026-02-28', '2025-12-15', '2024-02-29', '2026-11-30', ''], '한 달 전 같은 날(달 끝·윤년·1월)');
      assert.equal(r.cutoff, '2026-10-19');
      assert.deepEqual(r.groups, [['계획A', ['in0', 'in1', 'in2']], ['계획B', ['in3']]], '대상과 현장별 묶음(먼저 찍은 차례)');
      assert.equal(r.n, 4); assert.equal(r.bytes, 4000); assert.equal(r.projects, 2); assert.equal(r.noDrive, 2, '구글에 먼저 올릴 사진(사본 없음) 2장');
      assert.ok(r.same, '계획은 읽기만');
      assert.equal(r.webdriver, true); assert.equal(r.auto, false, '자동화 브라우저에서는 자동 보관을 예약하지 않는다');
      assert.equal(r.blockOff, 'relay', '구글 서버 연결이 없으면 막음'); assert.equal(r.runOff, 'relay'); assert.match(r.toastOff, /구글 서버\(☁️ 서버 연결\)를 먼저 연결하세요/); assert.equal(r.blockOn, '');
      assert.deepEqual(r.small23, [0xFF, 0xE0], '캔버스 JPEG 은 JFIF 로 시작'); assert.deepEqual(r.ex23, [0xFF, 0xE1], 'SOI 바로 뒤 Exif(APP1)'); assert.ok(r.app0Gone, 'JFIF(APP0) 뺌'); assert.equal(r.w, 40, '여전히 그려짐');
      assert.equal(r.exif.dt, '2026:09:10 10:00:00', '촬영일시(한국)'); assert.equal(r.exif.at, '2026-09-10T01:00:00.000Z', '앱 판독기로 같은 순간');
      assert.ok(Math.abs(r.exif.lat - 36.3504) < 1e-6 && Math.abs(r.exif.lng - 127.3845) < 1e-6, 'GPS ' + JSON.stringify(r.exif));
      assert.ok(Math.abs(r.exifS.lat + 33.5) < 1e-6 && Math.abs(r.exifS.lng + 70.25) < 1e-6, '남위·서경 ' + JSON.stringify(r.exifS));
      assert.equal(r.exifN.dt, '2026:09:10 10:00:00'); assert.equal(r.exifN.lat, null, '위치 없으면 GPS 안 적음');
    });

    // ② 실제 실행 — 현장 둘 + 대상이 아닌 것
    const S2 = await page.evaluate(async () => {
      const top = await __T.root('만물');
      state.dirHandle = top; __T.relayOn();
      state.projects = [
        __T.proj('T612 현장A', { aptUnits: [{ id: 'u1', type: 'unit', dong: '101', ho: '501', name: '', note: '' }] }),
        __T.proj('T612 B/동'), __T.proj('T612 최근'),
      ];
      const A = '_정리완료/T612 현장A/현장사진/', A2D = '_정리완료/T612 현장A/2차 방수/', B = '_정리완료/T612 B_동/현장사진/';
      __R.add('DA1drivefileid', { name: 'IMG_A1.jpg', size: 400000 }); __R.add('DB1drivefileid', { name: 'IMG_B1.jpg' }); __R.add('DVXdrivefileid', { name: 'drive.jpg' });
      const bytes = { A1: await __T.img(2100, 1575, 11), A2: await __T.img(1200, 900, 12, 'image/png'), A3: __T.gen(4002, 13), AX: await __T.img(1800, 1350, 14), AF: await __T.img(800, 600, 15), B1: await __T.img(1600, 1200, 16) };
      const R = [
        await __T.rec(top, 'A1', 'T612 현장A', A, 'IMG_A1.jpg', bytes.A1, '2026-09-10T10:00:00+09:00', { _driveId: 'DA1drivefileid', _driveMimeType: 'image/jpeg', _driveSize: 400000, _worklabel: '철거', _phase: '1차', lat: 36.35, lng: 127.38, address: '대전 중구 시험로 1', _aptUnit: { project: 'T612 현장A', unitId: 'u1' }, ocr: 'pending' }),
        await __T.rec(top, 'A2', 'T612 현장A', A, 'IMG_A2.png', bytes.A2, '2026-09-10T11:30:00+09:00', { _worklabel: '철거' }),
        await __T.rec(top, 'AF', 'T612 현장A', A, 'IMG_AF.jpg', bytes.AF, '2026-09-13T09:00:00+09:00'),
        await __T.rec(top, 'AX', 'T612 현장A', A, 'IMG_AX.jpg', bytes.AX, '2026-09-12T09:00:00+09:00', { _driveId: 'DGONEdrivefile', _driveMimeType: 'image/jpeg', _driveSize: 5 }),
        await __T.rec(top, 'A3', 'T612 현장A', A2D, '사진 한글.heic', bytes.A3, '2026-10-18T23:59:00+09:00', { _worklabel: '방수' }),
        await __T.rec(top, 'A4', 'T612 현장A', A, 'IMG_A4.jpg', __T.gen(3001, 17), '2026-10-19T00:00:00+09:00'),
        await __T.rec(top, 'AV', 'T612 현장A', A, 'V1.mp4', __T.gen(6000, 18), '2026-09-10T10:00:00+09:00'),
        await __T.rec(top, 'B1', 'T612 B/동', B, 'IMG_B1.jpg', bytes.B1, '2026-08-01T09:00:00+09:00', { _driveId: 'DB1drivefileid' }),
        await __T.rec(top, 'U1', null, '현장사진/', 'IMG_U1.jpg', __T.gen(3500, 19), '2026-09-01T09:00:00+09:00'),
        await __T.rec(top, 'R1', 'T612 최근', '_정리완료/T612 최근/', 'IMG_R1.jpg', __T.gen(2000, 20), '2026-11-10T09:00:00+09:00'),
      ];
      R.push({ id: 'VX', kind: 'photo', project: 'T612 현장A', prefix: '현장사진/', name: 'drive.jpg', ext: 'jpg', size: 900, when: new Date('2026-09-01T09:00:00+09:00'), handle: null, _virtual: true, _driveId: 'DVXdrivefileid', text: '', ocr: 'na' });
      __R.failNames.add('IMG_AF.jpg');
      state.files = R; state.photoTombs = []; __removedIds = new Set();
      const sizes = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, v.length]));
      const snaps0 = ((await idbGetStrict('hj_snaps')) || []).filter(s => s.label === '한 달 지난 사진 ZIP 보관 전').length;
      const stmt = () => ({ stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T612 현장A', ['2026-09-10']), unbilled: hjUnbilledPlan({ days: 100000 }).rows.filter(r => r.project === 'T612 현장A').map(r => [r.from, r.to, r.photos, r.works.join('·')]) });
      const before = stmt(), ids0 = state.files.map(f => f.id).sort();
      const res = await hjPhotoZipRun({});
      const snaps1 = ((await idbGetStrict('hj_snaps')) || []).filter(s => s.label === '한 달 지난 사진 ZIP 보관 전').length;
      const pick = id => { const f = state.files.find(x => x.id === id); return f && { handle: !!f.handle, virtual: !!f._virtual, thumb: f.thumb, driveId: f._driveId, link: f._relayLink, project: f.project, phase: f._phase, work: f._worklabel, unit: f._aptUnit, when: f.when && new Date(f.when).toISOString(), lat: f.lat, ocr: f.ocr, size: f.size, file: f._file, heic: !!f._heicFile }; };
      const saved = (await idbGetStrict('appState')).files, sv = n => { const s = saved.find(x => x.name === n); return s && { driveId: s.driveId, project: s.project, worklabel: s.worklabel }; };
      const thumb = await idbGet('thumb:DA1drivefileid');
      let tw = 0; try { const b = await createImageBitmap(await (await fetch(thumb)).blob()); tw = Math.max(b.width, b.height); b.close(); } catch (_) {}
      return {
        res, snaps: snaps1 - snaps0, before, after: stmt(), sizes, ids0, ids: state.files.map(f => f.id).sort(),
        recs: Object.fromEntries(['A1', 'A2', 'A3', 'AX', 'AF', 'B1', 'A4', 'VX'].map(id => [id, pick(id)])),
        saved: { A1: sv('IMG_A1.jpg'), A2: sv('IMG_A2.png'), AX: sv('IMG_AX.jpg') },
        tombs: hjTombActiveKeys(state.photoTombs).size, removed: [...__removedIds], thumb: (thumb || '').slice(0, 23), tw,
        uploads: __R.uploads.map(u => [u.name, u.mime]), serverHas: { AX: __R.files.has(pick('AX').driveId) },
        sumA: state.projects.find(p => p.name === 'T612 현장A').photoArchive, sumB: state.projects.find(p => p.name === 'T612 B/동').photoArchive, sumR: state.projects.find(p => p.name === 'T612 최근').photoArchive || null,
        archived: hjPzArchivedCount(),
        box: await __T.list(top, '_사진보관'),
        left: { A: await __T.list(top, A), A2D: await __T.list(top, A2D), B: await __T.list(top, B), U: await __T.list(top, '현장사진/'), R: await __T.list(top, '_정리완료/T612 최근/') },
        zipA: await __T.zip(top, 'T612 현장A_사진보관.zip'), zipB: await __T.zip(top, 'T612 B_동_사진보관.zip'),
        e: { A1: await __T.entry(top, 'T612 현장A_사진보관.zip', '101동 501호/2026-09-10/IMG_A1.jpg'), A2: await __T.entry(top, 'T612 현장A_사진보관.zip', '2026-09-10/IMG_A2.jpg'), AX: await __T.entry(top, 'T612 현장A_사진보관.zip', '2026-09-12/IMG_AX.jpg'), B1: await __T.entry(top, 'T612 B_동_사진보관.zip', '2026-08-01/IMG_B1.jpg') },
        last: hjPzLastGet(), toast: document.getElementById('toast').textContent,
      };
    });

    await test('② 구글 사본 확인·올림 → 줄인 사진 ZIP(EXIF) → 기록은 구글 사본으로 남고 원본만 지움 · 요약 · 내역서 그대로 (RUN)', async () => {
      const r = S2;
      assert.equal(r.res.ok, true, JSON.stringify(r.res)); assert.equal(r.res.n, 5); assert.equal(r.res.added, 5); assert.equal(r.res.projects, 2);
      assert.equal(r.res.uploaded, 3, 'A2·A3(사본 없음)·AX(서버에서 사라짐)만 올림'); assert.equal(r.res.noDrive, 1, 'AF 는 못 올려 그대로'); assert.equal(r.res.shrunk, 4); assert.equal(r.res.asIs, 1);
      assert.deepEqual(r.uploads.map(u => u[0]).sort(), ['IMG_A2.png', 'IMG_AF.jpg', 'IMG_AX.jpg', '사진 한글.heic'].sort());
      assert.deepEqual(r.uploads.find(u => u[0] === '사진 한글.heic')[1], 'image/heic', '못 그리는 HEIC 은 그대로 올림'); assert.equal(r.uploads.find(u => u[0] === 'IMG_A2.png')[1], 'image/jpeg', '나머지는 앱이 늘 올리던 JPEG 사본');
      assert.deepEqual(r.res.zips.sort(), ['_사진보관/T612 B_동_사진보관.zip', '_사진보관/T612 현장A_사진보관.zip']);
      assert.deepEqual(r.box, ['T612 B_동_사진보관.zip', 'T612 현장A_사진보관.zip'], '_사진보관 에 ZIP 둘만(.작성중 없음)');
      const zA = pyZip(r.zipA, 'a1'), zB = pyZip(r.zipB, 'b1');
      assert.equal(zA.bad, null, 'python zipfile CRC 검사'); assert.equal(zB.bad, null); assert.equal(zA.comment, 'hj-photozip-v2', '줄인 사진 ZIP 표시');
      assert.deepEqual(photosOf(zA), ['101동 501호/2026-09-10/IMG_A1.jpg', '2026-09-10/IMG_A2.jpg', '2026-09-12/IMG_AX.jpg', '2026-10-18/사진 한글.heic'], 'PNG 는 .jpg 로 · AF 는 안 담음');
      const e = n => zA.entries.find(x => x.name === n);
      assert.ok(e('101동 501호/2026-09-10/IMG_A1.jpg').size < r.sizes.A1 && e('2026-09-10/IMG_A2.jpg').size < r.sizes.A2 && e('2026-09-12/IMG_AX.jpg').size < r.sizes.AX, '줄인 사진은 더 작다');
      assert.equal(e('2026-10-18/사진 한글.heic').sha, sha(gen(4002, 13)), 'HEIC 은 그 바이트 그대로');
      assert.ok(zA.entries.every(x => x.method === 0 && x.size === x.csize && x.utf8), '무압축 STORE · 이름 UTF-8 표시');
      assert.equal(e('101동 501호/2026-09-10/IMG_A1.jpg').comment, '_정리완료/T612 현장A/현장사진/IMG_A1.jpg', '주석 = 원래 위치'); assert.deepEqual(e('101동 501호/2026-09-10/IMG_A1.jpg').date, [2026, 9, 10, 10, 0, 0]);
      assert.deepEqual([r.e.A1.w, r.e.A1.h], [2000, 1500], '긴 변 2000'); assert.deepEqual([r.e.A2.w, r.e.A2.h], [1200, 900], '작은 사진은 키우지 않음'); assert.deepEqual([r.e.B1.w, r.e.B1.h], [1600, 1200]);
      assert.deepEqual(r.e.A1.soi, [0xFF, 0xD8, 0xFF, 0xE1]);
      assert.equal(r.e.A1.exif.dt, '2026:09:10 10:00:00', '촬영일시 EXIF'); assert.ok(Math.abs(r.e.A1.exif.lat - 36.35) < 1e-6 && Math.abs(r.e.A1.exif.lng - 127.38) < 1e-6, 'GPS EXIF ' + JSON.stringify(r.e.A1.exif));
      assert.equal(r.e.AX.exif.dt, '2026:09:12 09:00:00'); assert.equal(r.e.AX.exif.lat, null);
      const rows = csvRows(zA.csv[0]);
      assert.equal(zA.csv.length, 1);
      assert.match(zA.csv[0], /^압축 안 파일,원래 위치,현장,촬영일시,공정,작업명,동·호수,위도,경도,주소,원본 크기\(바이트\),보관 크기\(바이트\),줄임,구글 사본 ID,원본 CRC32,CRC32\r\n/);
      const a1 = rows.find(x => x['압축 안 파일'] === '101동 501호/2026-09-10/IMG_A1.jpg');
      assert.deepEqual([a1['원래 위치'], a1['현장'], a1['촬영일시'], a1['공정'], a1['작업명'], a1['동·호수'], a1['위도'], a1['경도'], a1['주소'], +a1['원본 크기(바이트)'], +a1['보관 크기(바이트)'], a1['줄임'], a1['구글 사본 ID']],
        ['_정리완료/T612 현장A/현장사진/IMG_A1.jpg', 'T612 현장A', '2026-09-10 10:00:00', '1차', '철거', '101동 501호', '36.35', '127.38', '대전 중구 시험로 1', r.sizes.A1, e('101동 501호/2026-09-10/IMG_A1.jpg').size, '예', 'DA1drivefileid']);
      assert.equal(a1['CRC32'], e('101동 501호/2026-09-10/IMG_A1.jpg').crc); assert.match(a1['원본 CRC32'], /^[0-9a-f]{8}$/);
      const a3 = rows.find(x => x['압축 안 파일'] === '2026-10-18/사진 한글.heic');
      assert.equal(a3['줄임'], '원본 그대로'); assert.equal(a3['구글 사본 ID'], r.recs.A3.driveId); assert.equal(a3['원본 CRC32'], a3['CRC32']);
      assert.deepEqual(photosOf(zB), ['2026-08-01/IMG_B1.jpg']);
      // PC — 보관한 원본만 지움
      assert.deepEqual(r.left.A, ['IMG_A4.jpg', 'IMG_AF.jpg', 'V1.mp4'], '경계 날·동영상·구글에 못 올린 사진은 그대로');
      assert.deepEqual(r.left.A2D, []); assert.deepEqual(r.left.B, []); assert.deepEqual(r.left.U, ['IMG_U1.jpg']); assert.deepEqual(r.left.R, ['IMG_R1.jpg']);
      // 앱 — 기록은 그대로 남고 구글 사본 기록으로
      assert.deepEqual(r.ids, r.ids0, '앱 목록에서 빠지는 사진 없음');
      for (const id of ['A1', 'A2', 'A3', 'AX', 'B1']) { const x = r.recs[id]; assert.ok(!x.handle && x.virtual && x.thumb === null && x.file === null && !x.heic && x.link === 'relay:' + x.driveId, id + ' 구글 사본 기록 ' + JSON.stringify(x)); }
      assert.equal(r.recs.A1.driveId, 'DA1drivefileid'); assert.match(r.recs.A2.driveId, /^UP\d+/); assert.match(r.recs.A3.driveId, /^UP\d+/);
      assert.match(r.recs.AX.driveId, /^UP\d+/, '서버에서 사라진 사본은 새로 올린 ID'); assert.equal(r.serverHas.AX, true);
      assert.deepEqual([r.recs.A1.project, r.recs.A1.phase, r.recs.A1.work, r.recs.A1.unit, r.recs.A1.when, r.recs.A1.lat], ['T612 현장A', '1차', '철거', { project: 'T612 현장A', unitId: 'u1' }, '2026-09-10T01:00:00.000Z', 36.35], '현장·공정·작업명·동호수·촬영일·위치 그대로');
      assert.equal(r.recs.A1.ocr, 'na', '원본이 없으니 글자 읽기는 안 함으로'); assert.equal(r.recs.A1.size, r.sizes.A1, '크기는 원본 크기 그대로(같은 사진 신원)');
      assert.ok(r.recs.AF.handle && !r.recs.AF.driveId, 'AF 는 PC 원본 그대로'); assert.ok(r.recs.A4.handle); assert.ok(r.recs.VX.virtual && r.recs.VX.driveId === 'DVXdrivefileid');
      assert.deepEqual(r.saved, { A1: { driveId: 'DA1drivefileid', project: 'T612 현장A', worklabel: '철거' }, A2: { driveId: r.recs.A2.driveId, project: 'T612 현장A', worklabel: '철거' }, AX: { driveId: r.recs.AX.driveId, project: 'T612 현장A', worklabel: null } }, '저장본(기기)에도 구글 사본 ID');
      assert.equal(r.tombs, 0, '정리 표시 없음'); assert.deepEqual(r.removed, [], '다시 불러오지 않기 없음');
      assert.equal(r.thumb, 'data:image/jpeg;base64,', '미리보기를 이 기기에 넣어 둠'); assert.ok(r.tw > 0 && r.tw <= 320, '미리보기 긴 변 ' + r.tw);
      assert.equal(r.snaps, 1, '안전판 한 번');
      assert.equal(r.sumA.v, 2); assert.equal(r.sumA.n, 4); assert.equal(r.sumA.bytes, r.sizes.A1 + r.sizes.A2 + r.sizes.AX + r.sizes.A3); assert.equal(r.sumA.zbytes, Buffer.from(r.zipA, 'base64').length);
      assert.deepEqual(r.sumA.zips, ['_사진보관/T612 현장A_사진보관.zip']); assert.equal(r.sumA.from, '2026-09-10'); assert.equal(r.sumA.to, '2026-10-18'); assert.equal(r.sumA.days, undefined, 'days 없음(사진이 앱에 남는다)');
      assert.equal(r.sumB.n, 1); assert.equal(r.sumR, null); assert.equal(r.archived, 5);
      assert.equal(r.before.stmt, 3, '보관 전: A1·A2 + 같은 날 동영상'); assert.equal(r.after.stmt, 3, '📑 내역서 줄 사진 수 그대로'); assert.deepEqual(r.after.unbilled, r.before.unbilled, "'내역서에 없는 작업' 그대로");
      assert.ok(r.res.saved > 0 && r.res.bytes === r.sizes.A1 + r.sizes.A2 + r.sizes.AX + r.sizes.A3 + r.sizes.B1, 'PC 에서 줄인 용량 ' + JSON.stringify([r.res.saved, r.res.bytes]));
      assert.equal(r.last.n, 5); assert.equal(r.last.auto, false);
      assert.match(r.toast, /한 달 지난 사진 5장 — PC 에는 줄인 사진 ZIP\(만물\/_사진보관\), 앱에는 구글 사본으로 그대로/); assert.match(r.toast, /구글에 새로 올림 3장/); assert.match(r.toast, /구글에 못 올린 1장은 PC 에 그대로/);
    });

    await test('③ 덧붙임 · ZIP 에 있는 사진은 원본만 · 내용이 다르면 새로 · 파일 없는 기록 · _2 · 멈춘 뒤 이어서 (APPEND)', async () => {
      const r = await page.evaluate(async a1size => {
        const top = state.dirHandle, A = '_정리완료/T612 현장A/현장사진/', out = {};
        state.files.find(f => f.id === 'AF').project = null;   // 이번 검사에서는 빼 둔다(못 올리는 사진)
        const zip0 = await __T.bytesOf(top, '_사진보관', 'T612 현장A_사진보관.zip'), d0 = await hjPzReadDir(new Blob([zip0]));
        // (가) 새 사진 A5 · 원본을 못 지운 A6(다음 실행에서 원본만) · 파일 없는 기록 H(구글 사본 있음)·M(없음)
        const A5 = await __T.rec(top, 'A5', 'T612 현장A', A, 'IMG_A5.jpg', await __T.img(1000, 750, 21), '2026-09-20T10:00:00+09:00');
        const A6 = await __T.rec(top, 'A6', 'T612 현장A', A, 'IMG_A6.jpg', await __T.img(900, 600, 22), '2026-09-21T10:00:00+09:00');
        const H = await __T.rec(top, 'H', 'T612 현장A', A, 'IMG_H.jpg', __T.gen(2100, 23), '2026-09-22T10:00:00+09:00', { _driveId: __R.add('DHdrivefileid') });
        const M = await __T.rec(top, 'M', 'T612 현장A', A, 'IMG_M.jpg', __T.gen(2200, 24), '2026-09-22T11:00:00+09:00');
        const dA = await __T.dir(top, A); await dA.removeEntry('IMG_H.jpg'); await dA.removeEntry('IMG_M.jpg');
        state.files.push(A5, A6, H, M);
        const del0 = hjPzDeleteSource; hjPzDeleteSource = async it => it.name === 'IMG_A6.jpg' ? 'error' : del0(it);
        const r1 = await hjPhotoZipRun({});
        hjPzDeleteSource = del0;
        out.one = { r1, a6left: await __T.exists(top, A, 'IMG_A6.jpg'), a6: (f => f && { handle: !!f.handle, driveId: f._driveId })(state.files.find(f => f.id === 'A6')), h: (f => f && { handle: !!f.handle, virtual: !!f._virtual })(state.files.find(f => f.id === 'H')), m: (f => f && { handle: !!f.handle, virtual: !!f._virtual })(state.files.find(f => f.id === 'M')) };
        const zip1 = await __T.bytesOf(top, '_사진보관', 'T612 현장A_사진보관.zip');
        out.oldSame = __T.eq(zip1.subarray(0, d0.cdOffset), zip0.subarray(0, d0.cdOffset));
        // (나) 다시 폴더를 읽은 꼴 — A6 파일이 남아 있어 PC 기록으로 다시 잡혔다 → 이번엔 ZIP 에 다시 안 담고 원본만 지운다
        const a6 = state.files.find(f => f.id === 'A6'); a6.handle = await (await __T.dir(top, A)).getFileHandle('IMG_A6.jpg'); a6._virtual = false;
        M.project = null;
        // (다) 같은 자리·같은 크기인데 내용이 다른 파일(A1 자리에 새 파일) — ZIP 에 이미 있다고 보면 안 된다
        const A7 = await __T.rec(top, 'A7', 'T612 현장A', A, 'IMG_A1.jpg', __T.gen(a1size, 25), '2026-09-10T10:00:00+09:00', { _driveId: __R.add('DA7drivefileid') });
        state.files.push(A7);
        const r2 = await hjPhotoZipRun({});
        out.two = { r2, a6left: await __T.exists(top, A, 'IMG_A6.jpg'), a7left: await __T.exists(top, A, 'IMG_A1.jpg'), a6: (f => ({ handle: !!f.handle, virtual: !!f._virtual }))(state.files.find(f => f.id === 'A6')), zip: await __T.zip(top, 'T612 현장A_사진보관.zip'), box: await __T.list(top, '_사진보관'), sumA: state.projects.find(p => p.name === 'T612 현장A').photoArchive };
        // (라) 크기 상한(작게) — 8000바이트 사진 넷(못 그리는 바이트라 그대로)이 두 ZIP 으로
        HJ_PZ_PART_MAX = 26000;
        state.projects.push(__T.proj('T612 조각'));
        for (let i = 1; i <= 4; i++) state.files.push(await __T.rec(top, 'C' + i, 'T612 조각', '_정리완료/T612 조각/', 'C' + i + '.jpg', __T.gen(8000, 30 + i), '2026-07-0' + i + 'T09:00:00+09:00', { _driveId: __R.add('DC' + i + 'drivefileid') }));
        const r3 = await hjPhotoZipRun({});
        HJ_PZ_PART_MAX = 500 * 1024 * 1024;
        out.parts = { r3, box: await __T.list(top, '_사진보관'), c1: await __T.zip(top, 'T612 조각_사진보관.zip'), c2: await __T.zip(top, 'T612 조각_사진보관_2.zip'), sum: state.projects.find(p => p.name === 'T612 조각').photoArchive };
        // (마) [멈추기] — S1 을 읽은 뒤 멈추면 그 사진만, 다음 실행이 나머지를 같은 ZIP 에
        state.projects.push(__T.proj('T612 멈춤'));
        for (let i = 1; i <= 3; i++) state.files.push(await __T.rec(top, 'S' + i, 'T612 멈춤', '_정리완료/T612 멈춤/', 'S' + i + '.jpg', __T.gen(3000 + i, 40 + i), '2026-08-1' + i + 'T09:00:00+09:00', { _driveId: __R.add('DS' + i + 'drivefileid') }));
        const crc0 = hjCrc32Async; hjCrc32Async = async u => { const v = await crc0(u); if (u.length === 3001) window.__hjPzStop = true; return v; };
        const r4 = await hjPhotoZipRun({});
        hjCrc32Async = crc0;
        out.stop = { r4, left: await __T.list(top, '_정리완료/T612 멈춤/'), pc: state.files.filter(f => /^S/.test(f.id) && f.handle).map(f => f.id), last: hjPzLastGet(), bar: !!document.getElementById('hjPzBar') };
        const r5 = await hjPhotoZipRun({});
        Object.assign(out.stop, { r5, left2: await __T.list(top, '_정리완료/T612 멈춤/'), zip: await __T.zip(top, 'T612 멈춤_사진보관.zip'), box: await __T.list(top, '_사진보관') });
        return out;
      }, S2.sizes.A1);
      const { one, two, parts, stop } = r;
      assert.equal(one.r1.ok, true, JSON.stringify(one.r1)); assert.equal(one.r1.n, 3, 'A5·A6(기록만)·H(파일 없음·구글 사본)'); assert.equal(one.r1.added, 2); assert.equal(one.r1.healed, 1); assert.equal(one.r1.missing, 1); assert.equal(one.r1.keep, 1, 'A6 원본을 못 지움');
      assert.equal(one.a6left, true); assert.deepEqual(one.a6.handle, false, 'A6 기록은 구글 사본으로(원본은 다음에)'); assert.deepEqual(one.h, { handle: false, virtual: true }); assert.deepEqual(one.m, { handle: true, virtual: false }, '구글 사본 없는 파일 없는 기록은 그대로');
      assert.equal(r.oldSame, true, '덧붙여도 옛 항목 바이트 그대로');
      assert.equal(two.r2.ok, true, JSON.stringify(two.r2)); assert.equal(two.r2.n, 2); assert.equal(two.r2.added, 1, 'A6 는 다시 안 담고 A7 만 새로');
      assert.equal(two.a6left, false, 'A6 원본은 이번에 지움'); assert.equal(two.a7left, false); assert.deepEqual(two.a6, { handle: false, virtual: true });
      const z = pyZip(two.zip, 'a2');
      assert.equal(z.bad, null); assert.equal(z.comment, 'hj-photozip-v2');
      assert.deepEqual(photosOf(z), ['101동 501호/2026-09-10/IMG_A1.jpg', '2026-09-10/IMG_A2.jpg', '2026-09-12/IMG_AX.jpg', '2026-10-18/사진 한글.heic', '2026-09-20/IMG_A5.jpg', '2026-09-21/IMG_A6.jpg', '2026-09-10/IMG_A1.jpg'], '같은 ZIP 에 덧붙임 · A6 한 번 · 내용이 다른 A1 자리 파일(동·호수 없음)은 날짜 폴더 — v626 A1 은 101동 501호 폴더라 겹치지 않음');
      assert.equal(z.entries.find(x => x.name === '2026-09-10/IMG_A1.jpg').sha, sha(gen(S2.sizes.A1, 25)), '못 그리는 바이트는 그대로');
      assert.equal(zipNames(z).filter(n => n.startsWith('_목록/')).length, 3, '실행마다 csv 하나');
      assert.ok(two.box.every(n => !/작성중|crswap/.test(n)), '.작성중·임시 파일 없음 ' + two.box.join(','));
      assert.equal(two.sumA.n, 7, '요약은 ZIP 사진 목록에서 다시 셈'); assert.equal(two.sumA.v, 2);
      assert.equal(parts.box.filter(n => n.startsWith('T612 조각')).length, 2, '두 ZIP 으로 ' + parts.box.join(','));
      const c1 = pyZip(parts.c1, 'c1'), c2 = pyZip(parts.c2, 'c2');
      assert.equal(c1.bad, null); assert.equal(c2.bad, null);
      assert.deepEqual(photosOf(c1), ['2026-07-01/C1.jpg', '2026-07-02/C2.jpg']); assert.deepEqual(photosOf(c2), ['2026-07-03/C3.jpg', '2026-07-04/C4.jpg']);
      assert.equal(c2.entries.find(x => x.name === '2026-07-04/C4.jpg').sha, sha(gen(8000, 34)));
      assert.equal(parts.sum.n, 4); assert.deepEqual(parts.sum.zips, ['_사진보관/T612 조각_사진보관.zip', '_사진보관/T612 조각_사진보관_2.zip']);
      assert.equal(stop.r4.why, 'stopped'); assert.equal(stop.r4.n, 1); assert.equal(stop.bar, false, '끝나면 진행 띠가 사라짐');
      assert.deepEqual(stop.left, ['S2.jpg', 'S3.jpg']); assert.deepEqual(stop.pc, ['S2', 'S3']); assert.match(stop.last.why, /stopped/);
      assert.equal(stop.r5.n, 2); assert.deepEqual(stop.left2, []);
      const s = pyZip(stop.zip, 's1');
      assert.equal(s.bad, null); assert.deepEqual(photosOf(s), ['2026-08-11/S1.jpg', '2026-08-12/S2.jpg', '2026-08-13/S3.jpg'], '멈춘 뒤 같은 ZIP 에 이어서');
      assert.ok(stop.box.every(n => !/작성중/.test(n)));
    });

    await test('④ 깨진 ZIP·안전판·바뀐 원본·저장 실패·서버 연결·목록·막는 경우 — 원본과 기록은 그대로 (GUARD)', async () => {
      const r = await page.evaluate(async () => {
        const top = state.dirHandle, A = '_정리완료/T612 현장A/현장사진/', out = {};
        const W = FileSystemWritableFileStream.prototype, w0 = W.write;
        W.write = function (data) { if (window.__pzCorrupt && data instanceof Uint8Array && data.length === window.__pzCorrupt) { const c = data.slice(); c[100] ^= 0xFF; return w0.call(this, c); } return w0.call(this, data); };
        const recOf = id => (f => f && { handle: !!f.handle, virtual: !!f._virtual })(state.files.find(f => f.id === id));
        // (가) 새 ZIP 이 깨짐
        state.projects.push(__T.proj('T612 깨짐'));
        const K1 = await __T.rec(top, 'K1', 'T612 깨짐', '_정리완료/T612 깨짐/', 'K1.jpg', __T.gen(6007, 51), '2026-09-01T09:00:00+09:00', { _driveId: __R.add('DK1drivefileid') });
        state.files.push(K1); window.__pzCorrupt = 6007;
        const a = await hjPhotoZipRun({});
        out.a = { res: a, src: __T.eq(await __T.bytesOf(top, '_정리완료/T612 깨짐/', 'K1.jpg'), __T.gen(6007, 51)), rec: recOf('K1'), box: await __T.list(top, '_사진보관'), sum: state.projects.find(p => p.name === 'T612 깨짐').photoArchive || null, toast: document.getElementById('toast').textContent };
        K1.project = null;
        // (나) 이미 있는 ZIP 에 덧붙이다 깨짐 — 원래 ZIP 은 한 바이트도 안 바뀐다
        const zip0 = await __T.bytesOf(top, '_사진보관', 'T612 현장A_사진보관.zip');
        const A8 = await __T.rec(top, 'A8', 'T612 현장A', A, 'IMG_A8.jpg', __T.gen(6007, 52), '2026-09-25T09:00:00+09:00', { _driveId: __R.add('DA8drivefileid') });
        state.files.push(A8);
        const b = await hjPhotoZipRun({});
        out.b = { res: b, same: __T.eq(await __T.bytesOf(top, '_사진보관', 'T612 현장A_사진보관.zip'), zip0), src: await __T.exists(top, A, 'IMG_A8.jpg'), rec: recOf('A8'), box: await __T.list(top, '_사진보관') };
        window.__pzCorrupt = 0; W.write = w0; A8.project = null;
        // (다) 안전판을 못 만들면 아무것도 안 한다
        const F1 = await __T.rec(top, 'F1', 'T612 현장A', A, 'IMG_F1.jpg', __T.gen(2222, 53), '2026-09-26T09:00:00+09:00', { _driveId: __R.add('DF1drivefileid') });
        state.files.push(F1);
        const snap0 = hjSnapshot; hjSnapshot = async () => false;
        const c = await hjPhotoZipRun({});
        hjSnapshot = snap0;
        out.c = { res: c, src: await __T.exists(top, A, 'IMG_F1.jpg'), rec: recOf('F1'), same: __T.eq(await __T.bytesOf(top, '_사진보관', 'T612 현장A_사진보관.zip'), zip0), toast: document.getElementById('toast').textContent };
        F1.project = null;
        // (라) ZIP 검사 뒤 원본이 바뀌면 그 사진은 기록도 원본도 그대로
        state.projects.push(__T.proj('T612 바뀜'));
        const G1 = await __T.rec(top, 'G1', 'T612 바뀜', '_정리완료/T612 바뀜/', 'G1.jpg', __T.gen(5555, 54), '2026-09-02T09:00:00+09:00', { _driveId: __R.add('DG1drivefileid') });
        const G2 = await __T.rec(top, 'G2', 'T612 바뀜', '_정리완료/T612 바뀜/', 'G2.jpg', __T.gen(5556, 55), '2026-09-02T09:05:00+09:00', { _driveId: __R.add('DG2drivefileid') });
        state.files.push(G1, G2);
        await new Promise(r => setTimeout(r, 20));
        const v0 = hjPzVerify; let once = 0;
        hjPzVerify = async (...x) => { const v = await v0(...x); if (!once++) await __T.put(top, '_정리완료/T612 바뀜/', 'G1.jpg', new Uint8Array(5555).fill(7)); return v; };
        const d = await hjPhotoZipRun({});
        hjPzVerify = v0;
        out.d = { res: d, left: await __T.list(top, '_정리완료/T612 바뀜/'), g1: recOf('G1'), g2: recOf('G2'), zip: await __T.zip(top, 'T612 바뀜_사진보관.zip') };
        G1.project = null;
        // (마) 기록 저장이 안 되면 원본을 지우지 않는다 — 다음 실행이 ZIP 에 다시 안 담고 기록만 바꾸고 원본을 지운다
        state.projects.push(__T.proj('T612 저장'));
        const E1 = await __T.rec(top, 'E1', 'T612 저장', '_정리완료/T612 저장/', 'E1.jpg', __T.gen(4321, 56), '2026-09-03T09:00:00+09:00', { _driveId: __R.add('DE1drivefileid') });
        state.files.push(E1);
        const g0 = guardedPersistMediaFiles; guardedPersistMediaFiles = async () => false;
        const e1 = await hjPhotoZipRun({});
        guardedPersistMediaFiles = g0;
        out.e = { res: e1, src: await __T.exists(top, '_정리완료/T612 저장/', 'E1.jpg'), rec: recOf('E1'), zip: await __T.zip(top, 'T612 저장_사진보관.zip') };
        const e2 = await hjPhotoZipRun({});
        Object.assign(out.e, { res2: e2, src2: await __T.exists(top, '_정리완료/T612 저장/', 'E1.jpg'), rec2: recOf('E1'), zip2: await __T.zip(top, 'T612 저장_사진보관.zip') });
        // (바) 서버 — 연결 없음 · 목록 실패 · 목록이 잘렸는데 미리보기도 못 함 → 그대로, 되면 보관
        state.projects.push(__T.proj('T612 서버'));
        const T1 = await __T.rec(top, 'T1', 'T612 서버', '_정리완료/T612 서버/', 'T1.jpg', __T.gen(1234, 57), '2026-09-04T09:00:00+09:00', { _driveId: __R.add('DT1drivefileid') });
        state.files.push(T1);
        __T.relayOff(); const f1 = await hjPhotoZipRun({}), toastRelay = document.getElementById('toast').textContent; __T.relayOn();
        __R.listFail = true; const f2 = await hjPhotoZipRun({}), toastList = document.getElementById('toast').textContent; __R.listFail = false;
        __R.truncated = true; __R.truncLimit = 0; __R.thumbThrow = true;
        const f3 = await hjPhotoZipRun({});
        out.f = { f1: f1.why, toastRelay, f2: f2.why, toastList, f3, src3: await __T.exists(top, '_정리완료/T612 서버/', 'T1.jpg'), rec3: recOf('T1'), calls3: __R.calls.filter(x => x === 'thumbnail').length };
        __R.thumbThrow = false;
        const f4 = await hjPhotoZipRun({});
        Object.assign(out.f, { f4, src4: await __T.exists(top, '_정리완료/T612 서버/', 'T1.jpg'), rec4: recOf('T1') });
        __R.truncated = false;
        // (사) 막는 경우
        const why = [];
        state._demo = true; why.push((await hjPhotoZipRun({})).why); state._demo = false;
        __tabStale = true; why.push((await hjPhotoZipRun({})).why); __tabStale = false;
        localStorage.setItem(HJ_STAFF_KEY, 'staff'); why.push((await hjPhotoZipRun({})).why); localStorage.removeItem(HJ_STAFF_KEY);
        const dh = state.dirHandle; state.dirHandle = null; why.push((await hjPhotoZipRun({})).why); state.dirHandle = dh;
        window.__hjScanBusy = true; window.__hjScanBusyAt = Date.now(); why.push((await hjPhotoZipRun({})).why); window.__hjScanBusy = false;
        out.why = why;
        // (아) 보관 중에는 [다시 스캔] 안 함
        const n0 = state.files.length; window.__hjPzBusy = true;
        await scanDir();
        out.scan = { scanned: !!window.__hjScanBusy, n: state.files.length === n0, toast: document.getElementById('toast').textContent, busyRun: (await hjPhotoZipRun({})).why };
        window.__hjPzBusy = false;
        out.box = await __T.list(top, '_사진보관');
        return out;
      });
      assert.equal(r.a.res.why, 'error'); assert.match(r.a.res.err, /zip-crc/, '검사에서 CRC 가 맞지 않아 멈춤');
      assert.equal(r.a.src, true, '원본 그대로'); assert.deepEqual(r.a.rec, { handle: true, virtual: false }, '기록 그대로'); assert.equal(r.a.sum, null);
      assert.ok(!r.a.box.some(n => /깨짐/.test(n)), '검사에 떨어진 새 ZIP 은 지움 ' + r.a.box.join(',')); assert.match(r.a.toast, /검사를 통과하지 못한 사진은 지우지 않았어요/);
      assert.equal(r.b.res.why, 'error'); assert.equal(r.b.same, true, '덧붙이던 원래 ZIP 은 한 바이트도 안 바뀜'); assert.equal(r.b.src, true); assert.deepEqual(r.b.rec, { handle: true, virtual: false });
      assert.ok(r.b.box.every(n => !/작성중/.test(n)), '.작성중 은 지움 ' + r.b.box.join(','));
      assert.equal(r.c.res.why, 'snapshot'); assert.equal(r.c.src, true); assert.deepEqual(r.c.rec, { handle: true, virtual: false }); assert.equal(r.c.same, true); assert.match(r.c.toast, /안전판을 저장하지 못해/);
      assert.equal(r.d.res.n, 1); assert.equal(r.d.res.changed, 1, '검사 뒤 바뀐 원본 1장'); assert.deepEqual(r.d.left, ['G1.jpg'], '바뀐 원본은 남김');
      assert.deepEqual(r.d.g1, { handle: true, virtual: false }, '바뀐 사진 기록은 PC 그대로'); assert.deepEqual(r.d.g2, { handle: false, virtual: true });
      const zd = pyZip(r.d.zip, 'd1'); assert.equal(zd.bad, null); assert.equal(zd.entries.find(x => x.name === '2026-09-02/G1.jpg').sha, sha(gen(5555, 54)), 'ZIP 에는 읽을 때의 바이트');
      assert.equal(r.e.res.why, 'commit'); assert.equal(r.e.res.uncommitted, 1); assert.equal(r.e.res.ok, false);
      assert.equal(r.e.src, true, '기록을 저장 못 하면 원본을 지우지 않는다'); assert.deepEqual(r.e.rec, { handle: true, virtual: false });
      assert.deepEqual(photosOf(pyZip(r.e.zip, 'e1')), ['2026-09-03/E1.jpg'], 'ZIP 에는 이미 있음');
      assert.equal(r.e.res2.ok, true); assert.equal(r.e.res2.n, 1); assert.equal(r.e.res2.added, 0, '다음 실행은 다시 안 담음'); assert.equal(r.e.src2, false); assert.deepEqual(r.e.rec2, { handle: false, virtual: true });
      assert.deepEqual(photosOf(pyZip(r.e.zip2, 'e2')), ['2026-09-03/E1.jpg']);
      assert.equal(r.f.f1, 'relay'); assert.match(r.f.toastRelay, /구글 서버\(☁️ 서버 연결\)를 먼저 연결하세요/);
      assert.equal(r.f.f2, 'drivelist'); assert.match(r.f.toastList, /구글 서버 사진 목록을 받지 못해 보관하지 않았어요 — 사진은 그대로예요/);
      assert.equal(r.f.f3.unknown, 1, '목록이 잘렸고 미리보기도 못 하면 모름'); assert.equal(r.f.f3.n, 0); assert.equal(r.f.src3, true); assert.deepEqual(r.f.rec3, { handle: true, virtual: false }); assert.ok(r.f.calls3 >= 1);
      assert.equal(r.f.f4.n, 1, '미리보기로 사본이 확인되면 보관'); assert.equal(r.f.f4.uploaded, 0); assert.equal(r.f.src4, false); assert.deepEqual(r.f.rec4, { handle: false, virtual: true });
      assert.deepEqual(r.why, ['demo', 'stale', 'staff', 'nofolder', 'scan']);
      assert.equal(r.scan.scanned, false); assert.equal(r.scan.n, true); assert.match(r.scan.toast, /ZIP 으로 보관하는 중이에요/); assert.equal(r.scan.busyRun, 'busy');
      assert.ok(r.box.every(n => !/작성중/.test(n)), r.box.join(','));
    });

    await test('⑦ ⋯ 사진 도구 · 창(대상·먼저 올릴 수·자동·마지막 결과·원본→ZIP·서버 연결 없음) · 도움말 (UI)', async () => {
      const r = await page.evaluate(async () => {
        const top = state.dirHandle;
        const N1 = await __T.rec(top, 'N1', 'T612 현장A', '_정리완료/T612 현장A/현장사진/', 'IMG_N1.jpg', __T.gen(1500, 61), '2026-09-27T09:00:00+09:00');
        state.files.push(N1);
        photoToolsView();
        const item = document.querySelector('#modalRoot .ptBtn[data-fn="hjPhotoZipView"]');
        const itemText = item && item.textContent;
        item.click(); await new Promise(r => setTimeout(r, 200));
        const v = document.querySelector('#modalRoot [data-pz-view]');
        const tg = document.getElementById('pzAutoToggle'), run = document.getElementById('pzRunNow');
        const o = { itemText, view: !!v, text: v.textContent, pending: v.querySelector('[data-pz-pending]').getAttribute('data-pz-pending'), nodrive: (v.querySelector('[data-pz-nodrive]') || { getAttribute: () => '' }).getAttribute('data-pz-nodrive'),
          auto: v.querySelector('[data-pz-auto]').getAttribute('data-pz-auto'), pressed: tg && tg.getAttribute('aria-pressed'), tgH: tg && tg.getBoundingClientRect().height, runDisabled: run && run.disabled, last: (v.querySelector('[data-pz-last]') || {}).textContent || '',
          arch: v.querySelector('[data-pz-arch]') && v.querySelector('[data-pz-arch]').getAttribute('data-pz-arch'), rowA: (v.querySelector('[data-pz-row="T612 현장A"]') || {}).textContent || '', legacy: !!v.querySelector('[data-pz-legacy]') };
        tg.click(); await new Promise(r => setTimeout(r, 100));
        o.off = { ls: localStorage.getItem('hj_photo_zip_auto'), auto: document.querySelector('#modalRoot [data-pz-auto]').getAttribute('data-pz-auto'), pressed: document.getElementById('pzAutoToggle').getAttribute('aria-pressed'), sched: hjPhotoZipAutoSchedule() };
        document.getElementById('pzAutoToggle').click(); await new Promise(r => setTimeout(r, 100));
        o.on = { ls: localStorage.getItem('hj_photo_zip_auto'), auto: document.querySelector('#modalRoot [data-pz-auto]').getAttribute('data-pz-auto') };
        closeModal(true);
        __T.relayOff(); hjPhotoZipView(); await new Promise(r => setTimeout(r, 100));
        o.noRelay = { block: (document.querySelector('#modalRoot [data-pz-block]') || { getAttribute: () => '' }).getAttribute('data-pz-block'), text: (document.querySelector('#modalRoot [data-pz-block]') || {}).textContent || '', run: document.getElementById('pzRunNow').disabled };
        closeModal(true); __T.relayOn(); N1.project = null;
        o.help = (document.body.innerHTML.match(/한 달 지난 사진 ZIP 보관<\/b>[^<]{0,80}/) || [''])[0];
        return o;
      });
      assert.match(r.itemText, /한 달 지난 사진 ZIP 보관 1장/); assert.match(r.itemText, /구글 서버 사본/); assert.equal(r.view, true);
      assert.equal(r.pending, '1'); assert.equal(r.nodrive, '1', '구글에 먼저 올릴 1장'); assert.equal(r.runDisabled, false);
      assert.match(r.text, /줄인 사진\(긴 변 2000px\)/); assert.match(r.text, /원본 화질은 남기지 않습니다/); assert.equal(r.legacy, false);
      assert.equal(r.auto, 'on'); assert.equal(r.pressed, 'true'); assert.ok(r.tgH >= 44, '켜고 끄기 44px ' + r.tgH);
      assert.match(r.last, /마지막: /); assert.ok(+r.arch >= 6, '줄여 둔 현장 ' + r.arch);
      assert.match(r.rowA, /T612 현장A · 7장 · 원본 [\d.]+ ?[KMG]?B → ZIP [\d.]+ ?[KMG]?B/); assert.match(r.rowA, /T612 현장A_사진보관\.zip/);
      assert.deepEqual(r.off, { ls: '0', auto: 'off', pressed: 'false', sched: false }, '끄면 자동 예약 안 함');
      assert.deepEqual(r.on, { ls: '1', auto: 'on' });
      assert.equal(r.noRelay.block, 'relay'); assert.match(r.noRelay.text, /구글 서버/); assert.equal(r.noRelay.run, true, '서버 연결 없으면 [지금 보관] 잠김');
      assert.match(r.help, /한 달 지난 사진 ZIP 보관<\/b> — PC 에서 만물 폴더를 열면/, '도움말 한 줄');
    });

    // ⑤ v611 이 만든 원본 ZIP → v612 가 앱에 되살리고 줄인 사진으로(같은 기기 자료 — 진짜 v611 코드로 만든다)
    await test('⑤ v611 원본 ZIP → 앱에 되살림(정리 표시·다시 불러오지 않기·days) · 줄인 사진 ZIP 으로 다시 씀 · 다시 열어도 그대로 (MIGRATE)', async () => {
      const v611 = gitShow(V611);
      const { context: mc, page: p1 } = await open({ width: 1280, appHtml: v611 });
      const made = await p1.evaluate(async () => {
        const top = await __T.root('만물이전');
        state.dirHandle = top;
        state.projects = [__T.proj('T612 이전', { aptUnits: [{ id: 'u7', type: 'unit', dong: '102', ho: '1203', name: '', note: '' }] })];
        const P = '_정리완료/T612 이전/현장사진/';
        const bytes = { M1: await __T.img(2100, 1400, 71), M2: await __T.img(1500, 1000, 72), M3: __T.gen(3333, 73), M4: __T.gen(2444, 74) };
        state.files = [
          await __T.rec(top, 'M1', 'T612 이전', P, 'IMG_M1.jpg', bytes.M1, '2026-09-05T08:00:00+09:00', { _driveId: 'DM1drivefileid', _driveMimeType: 'image/jpeg', _driveSize: 300000, _worklabel: '타일', _phase: '2차', lat: 36.1, lng: 127.2, address: '대전 서구 이전로 2', _aptUnit: { project: 'T612 이전', unitId: 'u7' } }),
          await __T.rec(top, 'M2', 'T612 이전', P, 'IMG_M2.jpg', bytes.M2, '2026-09-05T09:00:00+09:00', { _worklabel: '타일' }),
          await __T.rec(top, 'M3', 'T612 이전', P, 'IMG_M3.heic', bytes.M3, '2026-09-06T09:00:00+09:00'),
          await __T.rec(top, 'M4', 'T612 이전', P, 'IMG_M4.tif', bytes.M4, '2026-09-06T10:00:00+09:00'),
        ];
        state.photoTombs = []; __removedIds = new Set();
        const res = await hjPhotoZipRun({});
        const zip = await __T.bytesOf(top, '_사진보관', 'T612 이전_사진보관.zip');
        return { res, files: state.files.map(f => f.id), tombs: hjTombActiveKeys(state.photoTombs).size, removed: [...__removedIds], sum: state.projects[0].photoArchive, stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T612 이전', ['2026-09-05', '2026-09-06']), zipLen: zip.length, sizes: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, v.length])) };
      });
      assert.equal(made.res.n, 4, 'v611 이 넷을 원본 ZIP 으로 ' + JSON.stringify(made.res)); assert.deepEqual(made.files, [], 'v611 은 앱 목록에서 뺐다'); assert.equal(made.tombs, 4); assert.deepEqual(made.removed, ['DM1drivefileid']);
      assert.deepEqual(made.sum.days, { '2026-09-05': 2, '2026-09-06': 2 }); assert.equal(made.stmt, 4, 'v611: 내역서 사진 수는 days 로 셈');
      await p1.close();
      // 같은 기기(같은 저장소)를 v612 로 연다
      const { page: p2 } = await open({ width: 1280, context: mc, appHtml: html || SRC });
      await addExif(p2);
      const r = await p2.evaluate(async () => {
        const top = await __T.root('만물이전');
        state.dirHandle = top; __T.relayOn();
        __R.add('DM1drivefileid', { name: 'IMG_M1.jpg', size: 300000 });
        const pre = { files: state.files.filter(f => f.project === 'T612 이전').length, tombs: hjTombActiveKeys(state.photoTombs).size, removed: [...__removedIds], legacy: hjPzLegacyProjects(), stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T612 이전', ['2026-09-05', '2026-09-06']) };
        hjPhotoZipView(); await new Promise(r => setTimeout(r, 100));
        pre.view = { legacy: (document.querySelector('#modalRoot [data-pz-legacy]') || { getAttribute: () => '' }).getAttribute('data-pz-legacy'), old: !!document.querySelector('#modalRoot [data-pz-old]'), run: document.getElementById('pzRunNow').disabled };
        closeModal(true);
        const res = await hjPhotoZipRun({});
        const mine = state.files.filter(f => f.project === 'T612 이전').sort((a, b) => a.name.localeCompare(b.name));
        const recs = mine.map(f => ({ name: f.name, prefix: f.prefix, size: f.size, handle: !!f.handle, virtual: !!f._virtual, driveId: f._driveId, link: f._relayLink, when: f.when && new Date(f.when).toISOString(), phase: f._phase, work: f._worklabel, unit: f._aptUnit || null, lat: f.lat, lng: f.lng, address: f.address, kind: f.kind }));
        const tombKey = n => hjTombKey('_정리완료/T612 이전/현장사진/', n.name, n.size, n.driveId);
        const act = hjTombActiveKeys(state.photoTombs);
        const thumb = await idbGet('thumb:DM1drivefileid');
        const out = { pre, res, recs, tombsLeft: act.size, m1TombLive: act.has(hjTombKey('_정리완료/T612 이전/현장사진/', 'IMG_M1.jpg', recs[0] && recs[0].size, 'DM1drivefileid')), removed: [...__removedIds], sum: state.projects.find(p => p.name === 'T612 이전').photoArchive,
          stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T612 이전', ['2026-09-05', '2026-09-06']), legacy: hjPzLegacyProjects(), thumb: (thumb || '').slice(0, 23),
          zip: await __T.zip(top, 'T612 이전_사진보관.zip'), box: await __T.list(top, '_사진보관'),
          m1: await __T.entry(top, 'T612 이전_사진보관.zip', '2026-09-05/IMG_M1.jpg'), uploads: __R.uploads.map(u => [u.name, u.mime]),
          saved: (await idbGetStrict('appState')).files.filter(s => s.project === 'T612 이전').map(s => [s.name, s.driveId]).sort() };
        const again = await hjPhotoZipRun({});
        out.again = { restored: again.restored || 0, migrated: again.migrated || 0, n: again.n, why: again.why, files: state.files.filter(f => f.project === 'T612 이전').length };
        return out;
      });
      await p2.close();
      const { page: p3 } = await open({ width: 1280, context: mc, appHtml: html || SRC });
      const re = await p3.evaluate(() => ({ files: state.files.filter(f => f.project === 'T612 이전').map(f => [f.name, f._driveId, !!f._virtual]).sort(), stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T612 이전', ['2026-09-05', '2026-09-06']), legacy: hjPzLegacyProjects() }));
      await mc.close();
      assert.deepEqual([r.pre.files, r.pre.tombs, r.pre.removed, r.pre.legacy, r.pre.stmt], [0, 4, ['DM1drivefileid'], ['T612 이전'], 4], 'v612 로 연 같은 기기 자료 ' + JSON.stringify(r.pre));
      assert.deepEqual(r.pre.view, { legacy: '1', old: true, run: false }, '창에 예전 방식 안내 · 대상이 없어도 [지금 보관] 가능');
      assert.equal(r.res.ok, true, JSON.stringify(r.res)); assert.equal(r.res.restored, 3, 'M1(정리 표시의 Drive ID)·M2·M3(ZIP 에서 올림)'); assert.equal(r.res.uploaded, 2); assert.equal(r.res.noDrive, 1, 'TIFF 는 서버가 안 받음'); assert.equal(r.res.migrated, 1);
      assert.deepEqual(r.uploads.map(u => u[0]).sort(), ['IMG_M2.jpg', 'IMG_M3.heic', 'IMG_M4.tif'].sort()); assert.equal(r.uploads.find(u => u[0] === 'IMG_M3.heic')[1], 'image/heic');
      assert.deepEqual(r.recs.map(x => x.name), ['IMG_M1.jpg', 'IMG_M2.jpg', 'IMG_M3.heic'], 'M4(못 올림)는 ZIP 에만');
      const m1 = r.recs[0];
      assert.deepEqual([m1.prefix, m1.size, m1.handle, m1.virtual, m1.driveId, m1.link, m1.when, m1.phase, m1.work, m1.unit, m1.lat, m1.lng, m1.address, m1.kind],
        ['_정리완료/T612 이전/현장사진/', made.sizes.M1, false, true, 'DM1drivefileid', 'relay:DM1drivefileid', '2026-09-04T23:00:00.000Z', '2차', '타일', { project: 'T612 이전', unitId: 'u7' }, 36.1, 127.2, '대전 서구 이전로 2', 'photo'], '되살린 기록 ' + JSON.stringify(m1));
      assert.match(r.recs[1].driveId, /^UP\d+/); assert.match(r.recs[2].driveId, /^UP\d+/);
      assert.equal(r.tombsLeft, 1, 'M4 정리 표시만 남음'); assert.equal(r.m1TombLive, false, 'M1 정리 표시 되살림'); assert.deepEqual(r.removed, [], '다시 불러오지 않기 풀림');
      assert.equal(r.stmt, 4, '📑 내역서 사진 수 — 되살린 3장 + 앱에 없는 M4 1장(두 번 안 셈)');
      assert.deepEqual(r.sum.days, { '2026-09-06': 1 }, 'days 에는 앱에 없는 M4 만'); assert.equal(r.sum.v, 2); assert.equal(r.sum.n, 4); assert.equal(r.sum.bytes, made.sizes.M1 + made.sizes.M2 + made.sizes.M3 + made.sizes.M4);
      assert.deepEqual(r.legacy, []); assert.equal(r.thumb, 'data:image/jpeg;base64,');
      assert.deepEqual(r.saved, [['IMG_M1.jpg', 'DM1drivefileid'], ['IMG_M2.jpg', r.recs[1].driveId], ['IMG_M3.heic', r.recs[2].driveId]].sort(), '저장본(기기)에 되살린 기록');
      const z = pyZip(r.zip, 'mig');
      assert.equal(z.bad, null); assert.equal(z.comment, 'hj-photozip-v2', '줄인 사진 ZIP 표시'); assert.ok(r.box.every(n => !/작성중/.test(n)), r.box.join(','));
      assert.deepEqual(photosOf(z), ['2026-09-05/IMG_M1.jpg', '2026-09-05/IMG_M2.jpg', '2026-09-06/IMG_M3.heic', '2026-09-06/IMG_M4.tif']);
      assert.ok(Buffer.from(r.zip, 'base64').length < made.zipLen, 'ZIP 이 작아짐 ' + [Buffer.from(r.zip, 'base64').length, made.zipLen]);
      const e = n => z.entries.find(x => x.name === n);
      assert.ok(e('2026-09-05/IMG_M1.jpg').size < made.sizes.M1 && e('2026-09-05/IMG_M2.jpg').size < made.sizes.M2, '되살린 JPEG 은 줄임');
      assert.equal(e('2026-09-06/IMG_M3.heic').sha, sha(gen(3333, 73)), 'HEIC 그대로'); assert.equal(e('2026-09-06/IMG_M4.tif').sha, sha(gen(2444, 74)), '앱에 없는 TIFF 는 원본 그대로');
      assert.deepEqual(e('2026-09-05/IMG_M1.jpg').date, [2026, 9, 5, 8, 0, 0], '날짜 그대로'); assert.equal(e('2026-09-05/IMG_M1.jpg').comment, '_정리완료/T612 이전/현장사진/IMG_M1.jpg');
      assert.deepEqual([r.m1.w, r.m1.h], [2000, 1333]); assert.equal(r.m1.exif.dt, '2026:09:05 08:00:00'); assert.ok(Math.abs(r.m1.exif.lat - 36.1) < 1e-6);
      assert.equal(z.csv.length, 1, 'csv 는 새 것 하나');
      const rows = csvRows(z.csv[0]), row = n => rows.find(x => x['압축 안 파일'] === n);
      assert.deepEqual([row('2026-09-05/IMG_M1.jpg')['구글 사본 ID'], row('2026-09-05/IMG_M1.jpg')['줄임'], row('2026-09-05/IMG_M1.jpg')['동·호수'], +row('2026-09-05/IMG_M1.jpg')['원본 크기(바이트)']], ['DM1drivefileid', '예', '102동 1203호', made.sizes.M1]);
      assert.deepEqual([row('2026-09-06/IMG_M4.tif')['구글 사본 ID'], row('2026-09-06/IMG_M4.tif')['줄임']], ['', '원본 그대로']);
      assert.deepEqual(r.again, { restored: 0, migrated: 0, n: 0, why: 'none', files: 3 }, '두 번째는 할 일 없음');
      assert.deepEqual(re.files, [['IMG_M1.jpg', 'DM1drivefileid', true], ['IMG_M2.jpg', r.recs[1].driveId, true], ['IMG_M3.heic', r.recs[2].driveId, true]], '다시 열어도 그대로(정리 표시가 숨기지 않음)');
      assert.equal(re.stmt, 4); assert.deepEqual(re.legacy, []);
    });

    // ⑥ 진짜 폴더 읽기 뒤 자동(사람이 연 PC 처럼 navigator.webdriver = false)
    await test('⑥ 폴더를 다 읽은 뒤 묻지 않고 보관 · 다시 읽어도 구글 사본 기록 · 평소보다 적어요 안 뜸 · _사진보관 안 읽음 · 서버 없으면 기록만 (AUTO)', async () => {
      const { page: pa } = await open({ width: 1280, auto: true });
      const r = await pa.evaluate(async () => {
        const jpeg = async color => { const c = new OffscreenCanvas(24, 24), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 24, 24); return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: .9 })).arrayBuffer()); };
        const exifJpeg = async (color, day) => hjPzExifJpeg(await jpeg(color), new Date('2026-06-' + day + 'T10:30:00+09:00'), null, null);
        const top = await __T.root('만물자동'), P = '_정리완료/T612 오토/현장사진/';
        for (let i = 1; i <= 12; i++) await __T.put(top, P, 'OLD' + String(i).padStart(2, '0') + '.jpg', await exifJpeg('#' + (i * 3 % 10) + '3' + (i % 10), String(10 + i)));
        for (let i = 1; i <= 18; i++) await __T.put(top, P, 'NEW' + String(i).padStart(2, '0') + '.jpg', await jpeg('#3' + (i % 10) + 'c'));
        await __T.put(top, '_사진보관/', '옛현장_사진보관.zip', new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        await __T.put(top, '_사진보관/', '사진.jpg', await jpeg('#33c'));
        state.projects = [__T.proj('T612 오토')]; state.files = []; __T.relayOn();
        HJ_PZ_AUTO_DELAY_MS = 200;
        setMountedDirectory(top);
        const waitRun = async t0 => { for (let i = 0; i < 150; i++) { const l = hjPzLastGet(); if (l && l.at >= t0 && !window.__hjPzBusy) return l; await new Promise(r => setTimeout(r, 200)); } return hjPzLastGet(); };
        let t0 = new Date().toISOString();
        await scanDir();
        const scanned = state.files.map(f => [f.prefix + f.name, f.project, hjKDayFast(f)]).sort();
        const last = await waitRun(t0);
        const o = { scanned, last, left: await __T.list(top, P), box: await __T.list(top, '_사진보관'), zip: await __T.exists(top, '_사진보관', 'T612 오토_사진보관.zip') ? await __T.zip(top, 'T612 오토_사진보관.zip') : '',
          old: state.files.filter(f => /^OLD/.test(f.name)).map(f => [!!f.handle, !!f._virtual, /^UP/.test(f._driveId || '')]), saved: state._savedFileCount };
        // 다시 폴더 읽기 — 옛 사진 12장은 폴더에 없지만 구글 사본 기록으로 남는다 · 평소보다 적어요(색인 정리 끔)가 뜨면 안 된다
        __hjPzAutoTimer = null; clearTimeout(__hjPzAutoTimer); localStorage.setItem('hj_photo_zip_auto', '0');
        await new Promise(r => setTimeout(r, 300));
        state._savedFileCount = state.files.length;   // 다음에 앱을 열면 저장본 수(30)로 시작한다 — 그 상태에서 폴더를 다시 읽는 꼴
        const toasts = []; const t0f = toast; toast = (m, ...x) => { toasts.push(String(m)); return t0f(m, ...x); };
        await scanDir();
        toast = t0f; localStorage.removeItem('hj_photo_zip_auto');
        o.rescan = { n: state.files.length, old: state.files.filter(f => /^OLD/.test(f.name)).map(f => [!!f.handle, !!f._virtual, f.project]).length, oldVirtual: state.files.filter(f => /^OLD/.test(f.name)).every(f => !f.handle && f._virtual && f.project === 'T612 오토'), pruneOff: !!window.__pruneOff, fewer: toasts.filter(m => /평소보다 적어요/.test(m)), archived: hjPzArchivedCount() };
        // 서버 연결이 없으면 자동은 하지 않고 마지막 결과에만 적는다
        await __T.put(top, P, 'OLD13.jpg', await exifJpeg('#a3a', '25'));
        __T.relayOff();
        t0 = new Date().toISOString();
        await scanDir();
        const lastOff = await waitRun(t0);
        o.off = { last: lastOff, left: (await __T.list(top, P)).includes('OLD13.jpg') };
        localStorage.setItem('hj_photo_zip_auto', '0'); o.offSched = hjPhotoZipAutoSchedule(); localStorage.removeItem('hj_photo_zip_auto');
        return o;
      });
      assert.ok(!r.scanned.some(x => x[0].startsWith('_사진보관/')), '_사진보관 은 목록에 안 들어감 ' + JSON.stringify(r.scanned.slice(0, 3)));
      assert.ok(r.scanned.some(x => x[0] === '_정리완료/T612 오토/현장사진/OLD01.jpg' && x[1] === 'T612 오토' && x[2] === '2026-06-11'), 'EXIF 촬영일로 읽힘 ' + JSON.stringify(r.scanned.slice(0, 2)));
      assert.ok(r.last && r.last.auto === true && r.last.n === 12 && r.last.uploaded === 12, '폴더 읽기 뒤 자동 보관 ' + JSON.stringify(r.last));
      assert.equal(r.left.filter(n => /^OLD/.test(n)).length, 0, '한 달 지난 12장 원본 지움'); assert.equal(r.left.filter(n => /^NEW/.test(n)).length, 18);
      assert.deepEqual(r.old, Array(12).fill([false, true, true]), '기록은 구글 사본 기록으로');
      assert.ok(r.box.includes('T612 오토_사진보관.zip') && r.box.includes('옛현장_사진보관.zip') && r.box.includes('사진.jpg'), r.box.join(','));
      const z = pyZip(r.zip, 'auto');
      assert.equal(z.bad, null); assert.equal(photosOf(z).length, 12); assert.ok(photosOf(z).every(n => /^2026-06-\d\d\/OLD\d\d\.jpg$/.test(n)), photosOf(z).join(','));
      assert.equal(r.rescan.old, 12, '다시 읽어도 12장 기록 그대로'); assert.equal(r.rescan.oldVirtual, true); assert.equal(r.rescan.n, 30);
      assert.deepEqual(r.rescan.fewer, [], "'평소보다 적어요' 안 뜸"); assert.equal(r.rescan.pruneOff, false, '색인 정리를 끄지 않음'); assert.equal(r.rescan.archived, 12);
      assert.equal(r.off.last.why, 'relay', '서버 연결 없으면 기록만 ' + JSON.stringify(r.off.last)); assert.equal(r.off.last.pending, 1); assert.equal(r.off.left, true);
      assert.equal(r.offSched, false, '자동을 끄면 예약 안 함');
    });

    await test('⑦-2 폰 390 — 창·진행 띠 넘침 0 · 44px · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0', async () => {
      const { page: pp } = await open({ width: 390, mobile: true });
      const r = await pp.evaluate(async () => {
        state.projects = [__T.proj('T612 폰현장 아주 긴 이름이 붙은 아파트 단지 101동', { photoArchive: { v: 2, n: 12, bytes: 34567890, zbytes: 4567890, zips: ['_사진보관/T612 폰현장 아주 긴 이름이 붙은 아파트 단지 101동_사진보관.zip'], from: '2026-09-01', to: '2026-09-30', at: new Date().toISOString() } }),
          __T.proj('T612 옛방식', { photoArchive: { n: 3, bytes: 3000, zips: ['_사진보관/T612 옛방식_사진보관.zip'], days: { '2026-09-01': 3 }, labels: {}, from: '2026-09-01', to: '2026-09-01', at: new Date().toISOString() } })];
        hjPzLastSet({ at: new Date().toISOString(), auto: true, n: 12, projects: 1, why: '', changed: 0, saved: 3000000, uploaded: 2 });
        hjPhotoZipView(); await new Promise(r => setTimeout(r, 200));
        const m = document.querySelector('#modalRoot .modal'), tg = document.getElementById('pzAutoToggle'), run = document.getElementById('pzRunNow');
        const o = { overflow: m.scrollWidth - m.clientWidth, docOverflow: document.documentElement.scrollWidth - innerWidth, tgH: tg.getBoundingClientRect().height, run: run.disabled, block: (document.querySelector('[data-pz-block]') || { getAttribute: () => '' }).getAttribute('data-pz-block'),
          legacy: (document.querySelector('[data-pz-legacy]') || { getAttribute: () => '' }).getAttribute('data-pz-legacy'), last: (document.querySelector('[data-pz-last]') || {}).textContent || '' };
        closeModal(true);
        hjPzBar('🗜 한 달 지난 사진 보관 중 — T612 폰현장 아주 긴 이름이 붙은 아파트 단지 101동 12/120 · 전체 34/870');
        const b = document.getElementById('hjPzBar').getBoundingClientRect(), s = document.getElementById('hjPzStop').getBoundingClientRect(), nav = document.querySelector('.mobile-nav');
        o.bar = { left: b.left, right: innerWidth - b.right, stopH: s.height, navTop: nav ? nav.getBoundingClientRect().top : null, barBottom: b.bottom, role: document.getElementById('hjPzBar').getAttribute('role') };
        document.getElementById('hjPzStop').click(); o.stop = window.__hjPzStop === true; window.__hjPzStop = false;
        hjPzBar(null); o.gone = !document.getElementById('hjPzBar');
        return o;
      });
      assert.ok(r.overflow <= 1 && r.docOverflow <= 1, '넘침 ' + JSON.stringify(r)); assert.ok(r.tgH >= 44); assert.equal(r.run, true, '폴더 없으면 잠김'); assert.equal(r.block, 'nofolder');
      assert.equal(r.legacy, '1', '예전 방식 현장 안내'); assert.match(r.last, /12장 PC 원본 정리\(앱엔 구글 사본\) · 현장 1곳 · PC 2\.9 ?MB 줄임 · 구글에 새로 올림 2장/);
      assert.ok(r.bar.left >= 0 && r.bar.right >= 0, '진행 띠 화면 안 ' + JSON.stringify(r.bar)); assert.ok(r.bar.stopH >= 44); assert.equal(r.bar.role, 'status');
      assert.ok(r.bar.navTop == null || r.bar.barBottom <= r.bar.navTop + 1, '하단 메뉴를 가리지 않음 ' + JSON.stringify(r.bar));
      assert.equal(r.stop, true, '[멈추기]'); assert.equal(r.gone, true);
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 612, '핀 3곳 같음(v612 이상) ' + [a, b, c]);
      assert.deepEqual(errors, [], '페이지 오류 0'); assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally {
    await browser.close();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
  console.log('photozip-v612: ' + passed + '/8');
  if (passed !== 8) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

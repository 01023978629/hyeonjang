/* v611 🗜 한 달 지난 현장 사진 → 현장별 ZIP 보관 · 낱장 삭제 — 대표 11/18 "프로젝트에서 1달 넘어간 사진은 압축해서 보관해서 정리 될 수 있게해줘
   원본은 압축본으로 보관 사진은 삭제 코드 수정 해줘"(물음 두 개: '현장별 ZIP 으로 묶기' · 'PC 에서 앱 열면 자동').
   합성 자료와 OPFS(브라우저 안의 진짜 폴더 손잡이 — 만들기·쓰기·바꿔 쓰기·지우기가 PC 폴더와 같은 API)만 쓴다. 바깥 쓰기 0.
   쓴 ZIP 은 Node 로 꺼내 python3 zipfile 로 다시 읽는다(실제 프로그램이 여는지 — CRC·UTF-8 이름·날짜·주석·바이트).
   이 컨테이너 크로미움은 로캘이 없으면 OPFS 의 한글 이름을 버린다 — LANG=C.UTF-8 로 띄운다(CI 는 원래 UTF-8).
   ① PLAN — 한 달 전 같은 날(달 끝·윤년·1월), 대상(현장 있는 PC 사진·사진 확장자·한 달 전 날보다 앞섬)과 아닌 것 9가지, 현장별 묶음·차례, 읽기만, 자동화 브라우저는 자동 예약 안 함
   ② RUN — [지금 보관]: 현장별 ZIP 둘(현장 이름의 / → _) · 원본 바이트 그대로 · 촬영일 폴더 · 주석 = 원래 위치 · 촬영 시각 · csv(공정·작업명·동·호수·위치·주소) ·
      원본 삭제(경계 다음 날·동영상·현장 미지정·최근 현장은 그대로) · 기록 빠짐 · 정리 표시 · Drive 다시 불러오지 않기 · 현장 요약 · 안전판 1회 · 마지막 결과 ·
      📑 내역서 줄 사진 수와 '내역서에 없는 작업'이 보관한 날을 그대로 센다
   ③ APPEND — 같은 ZIP 에 덧붙임(옛 사진 바이트 그대로 · .작성중 없음 · csv 둘) · 같은 사진(다른 폴더 사본)은 다시 안 담고 원본만 · 파일이 이미 없는 기록은 목록에서만 ·
      크기 상한을 넘으면 _2 · [멈추기] 뒤 다음 실행이 이어서
   ④ GUARD — ZIP 에 쓴 바이트가 깨지면 검사에서 떨어져 원본·기록 그대로(새 ZIP 은 지움 · 덧붙이던 ZIP 은 한 바이트도 안 바뀜 · .작성중 없음) · 안전판 실패면 안 함 ·
      읽은 뒤 바뀐 원본은 안 지움 · 데모·오래된 창·직원 모드·폴더 없음·폴더 읽는 중이면 안 함 · 보관 중에는 [다시 스캔] 안 함
   ⑤ AUTO — 진짜 폴더 읽기(scanDir: EXIF 촬영일 6/29 사진 + 방금 만든 사진 + 이미 있는 _사진보관 ZIP) 뒤 묻지 않고 보관 · _사진보관 은 목록에 안 들어감 · 자동 끄면 안 함
   ⑥ UI — ⋯ 사진 도구 항목 · 창(대상·자동 켜고 끄기·마지막 결과·보관한 현장·대상 없으면 단추 잠김) · 폰 390 창·진행 띠 넘침 0·44px · 도움말 · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0
   HJ_V611_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V611_MUTATION: all-ages(한 달 기준 빼기)는 ①, no-tomb(정리 표시 없이 기록 빼기)·no-stmt(내역서 사진 수에 보관 사진 안 셈)은 ②,
   no-dedupe(같은 사진 다시 담기)·no-heal(파일 없는 기록 그대로)은 ③, no-verify(쓴 ZIP 의 바이트를 다시 계산 안 함)·no-tmp(덧붙일 때 원래 ZIP 에 바로 씀)은 ④,
   no-scan-skip(_사진보관 도 스캔)·no-auto(폴더 읽은 뒤 예약 안 함)은 ⑤ 에서 실패해야 한다. */
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
const EXIF_JS = fs.readFileSync(path.join(__dirname, 'fixtures', 'vendor', 'exif-js-2.3.0.js'));
const EXIF_CDN = 'https://cdn.jsdelivr.net/npm/exif-js@2.3.0/exif.js';
const MUT = {
  'all-ages': ['const day=hjKDayFast(f);return !!day&&day<cutoff;', 'const day=hjKDayFast(f);return !!day;'],
  'no-tomb': ['current,[...removed],undefined,{tomb:true});}catch(e){ok=false;}', 'current,[...removed],undefined,undefined);}catch(e){ok=false;}'],
  'no-stmt': ['  hjPzArchivedEach(only,(name,day,c)=>{let m=idx.get(name);', '  if(0)hjPzArchivedEach(only,(name,day,c)=>{let m=idx.get(name);'],
  'no-dedupe': ["const twin=(have.get(size0+':'+crc)||[]).find(x=>x.base===b);", 'const twin=null;'],
  'no-heal': ["if(e&&e.name==='NotFoundError'){const hit=havePath.get(path+'|'+size0)", "if(false){const hit=havePath.get(path+'|'+size0)"],
  'no-verify': ['    if(blob.size!==a.size||(await hjCrc32Blob(blob))!==a.crc)throw new Error(\'zip-crc\');', '    if(blob.size!==a.size)throw new Error(\'zip-crc\');'],
  'no-tmp': ['const tmpName=last.name+HJ_PZ_TMP,{h:th,w}=await open(tmpName);', 'const tmpName=last.name+HJ_PZ_TMP,th=last.handle,w=await th.createWritable();'],
  'no-scan-skip': [
    ["if(/^(_백업|데이터|_중복정리_보관|_사진보관)/.test(name)||(!prefix&&/^사례 작성/.test(String(name).normalize('NFC')))){try{window.__walkSkip", "if(/^(_백업|데이터|_중복정리_보관)/.test(name)||(!prefix&&/^사례 작성/.test(String(name).normalize('NFC')))){try{window.__walkSkip"],
    ['(_백업|데이터|_중복정리_보관|_사진보관)[^\\/]*\\//.test(path))return true;', '(_백업|데이터|_중복정리_보관)[^\\/]*\\//.test(path))return true;'],
  ],
  'no-auto': ['    if(ok){try{hjPhotoZipAutoSchedule();}catch(e){}}\n', ''],
};
let html = process.env.HJ_V611_BASELINE ? execFileSync('git', ['show', process.env.HJ_V611_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V611_MUTATION) {
  const m = MUT[process.env.HJ_V611_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V611_MUTATION);
  const pairs = Array.isArray(m[0]) ? m : [m];
  html = SRC;
  for (const [from, to] of pairs) { assert.equal(html.split(from).length, 2, 'mutation anchor ' + from.slice(0, 60)); html = html.replace(from, () => to); }
}

const TODAY = '2026-11-18';   // 앱의 '오늘'(hjPzToday)을 고정 — 기준일 2026-10-18 앞에 찍은 사진이 대상
const gen = (n, seed) => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7 + (i >> 8)) & 255; return b; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hj-v611-'));
// python3 zipfile 로 다시 읽기 — testzip(CRC), 항목(이름·크기·CRC·주석·날짜·sha256), csv 글자
const PY = `import zipfile,json,hashlib,sys
z=zipfile.ZipFile(sys.argv[1])
bad=z.testzip()
out={'bad':bad,'entries':[],'csv':[]}
for i in z.infolist():
    d=z.read(i)
    out['entries'].append({'name':i.filename,'size':i.file_size,'csize':i.compress_size,'method':i.compress_type,'crc':'%08x'%i.CRC,'comment':i.comment.decode('utf-8'),'date':list(i.date_time),'utf8':bool(i.flag_bits & 0x800),'sha':hashlib.sha256(d).hexdigest()})
    if i.filename.startswith('_목록/'):
        out['csv'].append(d.decode('utf-8-sig'))
print(json.dumps(out,ensure_ascii=False))`;
function pyZip(b64, tag) {
  const file = path.join(TMP, tag + '.zip'); fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return JSON.parse(execFileSync('python3', ['-c', PY, file], { encoding: 'utf8' }));
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, auto }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (read && auto && url.href === EXIF_CDN) return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: EXIF_JS });
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
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
    // 검사 도구: OPFS 에 합성 폴더 만들기 · 파일 바이트 · base64
    const gen = (n, seed) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 7 + (i >> 8)) & 255; return b; };
    window.__T = {
      gen,
      async root(name) { const o = await navigator.storage.getDirectory(); return o.getDirectoryHandle(name, { create: true }); },
      async dir(top, p) { let d = top; for (const x of String(p).split('/').filter(Boolean)) d = await d.getDirectoryHandle(x, { create: true }); return d; },
      async put(top, p, name, bytes) { const d = await __T.dir(top, p), h = await d.getFileHandle(name, { create: true }), w = await h.createWritable(); await w.write(bytes); await w.close(); return h; },
      async exists(top, p, name) { try { const d = await __T.dir(top, p); await d.getFileHandle(name); return true; } catch (e) { return false; } },
      async bytesOf(top, p, name) { const d = await __T.dir(top, p), f = await (await d.getFileHandle(name)).getFile(); return new Uint8Array(await f.arrayBuffer()); },
      async list(top, p) { const d = await __T.dir(top, p), out = []; for await (const [n, h] of d.entries()) out.push(n + (h.kind === 'directory' ? '/' : '')); return out.sort(); },
      b64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
      async zip(top, name) { return __T.b64(await __T.bytesOf(top, '_사진보관', name)); },
      eq(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; },
      proj(name, extra) { return Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, extra || {}); },
      async rec(top, id, project, prefix, name, n, seed, when, extra) {
        const h = await __T.put(top, prefix, name, gen(n, seed));
        return Object.assign({ id, kind: 'photo', project, prefix, name, ext: name.split('.').pop().toLowerCase(), size: n, when: new Date(when), handle: h, _file: null, thumb: null, text: '', ocr: 'na', lat: null, lng: null, place: null, address: null, _phase: null, _worklabel: null }, extra || {});
      },
    };
  }, { keys: BOOT, mobile: !!mobile, today: TODAY });
  return { context, page };
}
async function test(name, fn) { await fn(); passed++; console.log('PASS photozip-v611 ' + name); }
const zipNames = z => z.entries.map(e => e.name);

(async () => {
  browser = await chromium.launch({
    executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined,
    env: Object.assign({}, process.env, /utf-?8/i.test(process.env.LC_ALL || process.env.LANG || '') ? {} : { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }),
  });
  try {
    const { page } = await open({ width: 1280 });

    await test('① 한 달 전 같은 날 · 대상과 아닌 것 · 현장별 묶음 · 읽기만 (PLAN)', async () => {
      const r = await page.evaluate(async () => {
        const cut = ['2026-11-18', '2026-03-31', '2026-01-15', '2024-03-30', '2026-12-31', ''].map(hjPzCutoff);
        const F = (id, project, name, when, extra) => Object.assign({ id, kind: 'photo', project, prefix: '_정리완료/P/', name, ext: name.split('.').pop().toLowerCase(), size: 1000, when: new Date(when), handle: { getFile: async () => null }, text: '', ocr: 'na' }, extra || {});
        state.projects = [__T.proj('계획A'), __T.proj('계획B')];
        state.files = [
          F('in1', '계획A', 'a.jpg', '2026-09-01T10:00:00+09:00'),
          F('in2', '계획A', 'b.heic', '2026-10-17T23:59:00+09:00'),                  // 경계 전날 밤 — 대상
          F('in3', '계획B', 'c.PNG', '2026-07-01T09:00:00+09:00', { ext: 'png' }),
          F('in0', '계획A', 'z.jpg', '2026-08-01T09:00:00+09:00'),                   // 더 먼저 찍음 — 묶음 맨 앞
          F('out-edge', '계획A', 'd.jpg', '2026-10-18T00:00:00+09:00'),               // 기준일 0시 — 아직 아님
          F('out-recent', '계획A', 'e.jpg', '2026-11-15T09:00:00+09:00'),
          F('out-nopj', null, 'f.jpg', '2026-09-01T09:00:00+09:00'),
          F('out-gone', '(삭제됨) 계획C', 'g.jpg', '2026-09-01T09:00:00+09:00'),
          F('out-video', '계획A', 'h.mp4', '2026-09-01T09:00:00+09:00', { ext: 'mp4' }),
          F('out-virtual', '계획A', 'i.jpg', '2026-09-01T09:00:00+09:00', { handle: null, _virtual: true, _driveId: 'DV' }),
          F('out-zero', '계획A', 'j.jpg', '2026-09-01T09:00:00+09:00', { size: 0 }),
          F('out-est', '계획A', 'k.jpg', '2026-09-01T09:00:00+09:00', { kind: 'estimate' }),
          F('out-quote', '계획A', 'l.jpg', '2026-09-01T09:00:00+09:00', { _fromQuote: true }),
        ];
        const before = JSON.stringify(serializeData().files), P = hjPhotoZipPlan();
        const groups = [...P.groups].map(([k, v]) => [k, v.map(f => f.id)]);
        const after = JSON.stringify(serializeData().files);
        return { cut, n: P.n, bytes: P.bytes, projects: P.projects, cutoff: P.cutoff, groups, same: before === after, auto: hjPhotoZipAutoSchedule(), webdriver: navigator.webdriver };
      });
      assert.deepEqual(r.cut, ['2026-10-18', '2026-02-28', '2025-12-15', '2024-02-29', '2026-11-30', ''], '한 달 전 같은 날(달 끝·윤년·1월)');
      assert.equal(r.cutoff, '2026-10-18');
      assert.deepEqual(r.groups, [['계획A', ['in0', 'in1', 'in2']], ['계획B', ['in3']]], '대상과 현장별 묶음(먼저 찍은 차례)');
      assert.equal(r.n, 4); assert.equal(r.bytes, 4000); assert.equal(r.projects, 2);
      assert.ok(r.same, '계획은 읽기만');
      assert.equal(r.webdriver, true); assert.equal(r.auto, false, '자동화 브라우저에서는 자동 보관을 예약하지 않는다');
    });

    // ② 실제 실행 — 현장 둘 + 대상이 아닌 것 다섯
    const S2 = await page.evaluate(async () => {
      const top = await __T.root('만물');
      state.dirHandle = top;
      state.projects = [
        __T.proj('T611 현장A', { aptUnits: [{ id: 'u1', type: 'unit', dong: '101', ho: '501', name: '', note: '' }] }),
        __T.proj('T611 B/동'), __T.proj('T611 최근'),
      ];
      const A = '_정리완료/T611 현장A/현장사진/', A2D = '_정리완료/T611 현장A/2차 방수/', B = '_정리완료/T611 B_동/현장사진/';
      const R = [
        await __T.rec(top, 'A1', 'T611 현장A', A, 'IMG_A1.jpg', 5003, 11, '2026-09-10T10:00:00+09:00', { _driveId: 'DA1', _worklabel: '철거', _phase: '1차', lat: 36.35, lng: 127.38, address: '대전 중구 시험로 1', _aptUnit: { project: 'T611 현장A', unitId: 'u1' } }),
        await __T.rec(top, 'A2', 'T611 현장A', A, 'IMG_A2.jpg', 7001, 12, '2026-09-10T11:30:00+09:00', { _worklabel: '철거' }),
        await __T.rec(top, 'A3', 'T611 현장A', A2D, '사진 한글.heic', 4002, 13, '2026-10-17T23:59:00+09:00', { _worklabel: '방수' }),
        await __T.rec(top, 'A4', 'T611 현장A', A, 'IMG_A4.jpg', 3001, 14, '2026-10-18T00:00:00+09:00'),
        await __T.rec(top, 'AV', 'T611 현장A', A, 'V1.mp4', 6000, 15, '2026-09-10T10:00:00+09:00'),
        await __T.rec(top, 'B1', 'T611 B/동', B, 'IMG_B1.jpg', 4500, 16, '2026-08-01T09:00:00+09:00'),
        await __T.rec(top, 'U1', null, '현장사진/', 'IMG_U1.jpg', 3500, 17, '2026-09-01T09:00:00+09:00'),
        await __T.rec(top, 'R1', 'T611 최근', '_정리완료/T611 최근/', 'IMG_R1.jpg', 2000, 18, '2026-11-10T09:00:00+09:00'),
      ];
      R.push({ id: 'VX', kind: 'photo', project: 'T611 현장A', prefix: '현장사진/', name: 'drive.jpg', ext: 'jpg', size: 900, when: new Date('2026-09-01T09:00:00+09:00'), handle: null, _virtual: true, _driveId: 'DVX', text: '', ocr: 'na' });
      state.files = R; state.photoTombs = [];
      const tombKeys = ['A1', 'A2', 'A3', 'B1'].map(id => hjTombKeyOf(R.find(f => f.id === id)));
      const snaps0 = ((await idbGetStrict('hj_snaps')) || []).filter(s => s.label === '한 달 지난 사진 ZIP 보관 전').length;
      const before = { stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T611 현장A', ['2026-09-10']), unbilled: hjUnbilledPlan({ days: 100000 }).rows.filter(r => r.project === 'T611 현장A').map(r => [r.from, r.to, r.photos, r.works.join('·')]) };
      const res = await hjPhotoZipRun({});
      const snaps1 = ((await idbGetStrict('hj_snaps')) || []).filter(s => s.label === '한 달 지난 사진 ZIP 보관 전').length;
      const act = hjTombActiveKeys(state.photoTombs);
      const pA = state.projects.find(p => p.name === 'T611 현장A'), pB = state.projects.find(p => p.name === 'T611 B/동');
      return {
        res, snaps: snaps1 - snaps0, before,
        after: { stmt: hjStmtPhotoCount(hjStmtPhotoIndex(), 'T611 현장A', ['2026-09-10']), unbilled: hjUnbilledPlan({ days: 100000 }).rows.filter(r => r.project === 'T611 현장A').map(r => [r.from, r.to, r.photos, r.works.join('·')]) },
        files: state.files.map(f => f.id).sort(), tombs: tombKeys.map(k => act.has(k)), removed: [...__removedIds],
        sumA: pA.photoArchive, sumB: pB.photoArchive, sumR: state.projects.find(p => p.name === 'T611 최근').photoArchive || null,
        box: await __T.list(top, '_사진보관'),
        left: { A: await __T.list(top, A), A2D: await __T.list(top, A2D), B: await __T.list(top, B), U: await __T.list(top, '현장사진/'), R: await __T.list(top, '_정리완료/T611 최근/') },
        zipA: await __T.zip(top, 'T611 현장A_사진보관.zip'), zipB: await __T.zip(top, 'T611 B_동_사진보관.zip'),
        last: hjPzLastGet(), toast: document.getElementById('toast').textContent,
      };
    });

    await test('② [지금 보관] — 현장별 ZIP · 원본 그대로 · 원본·기록 정리 · 정리 표시 · 요약 · 안전판 1회 · 내역서 사진 수 그대로 (RUN)', async () => {
      const r = S2;
      assert.equal(r.res.ok, true, JSON.stringify(r.res)); assert.equal(r.res.n, 4); assert.equal(r.res.added, 4); assert.equal(r.res.projects, 2);
      assert.deepEqual(r.res.zips.sort(), ['_사진보관/T611 B_동_사진보관.zip', '_사진보관/T611 현장A_사진보관.zip']);
      assert.deepEqual(r.box, ['T611 B_동_사진보관.zip', 'T611 현장A_사진보관.zip'], '_사진보관 에 ZIP 둘만(.작성중 없음)');
      const zA = pyZip(r.zipA, 'a1'), zB = pyZip(r.zipB, 'b1');
      assert.equal(zA.bad, null, 'python zipfile CRC 검사'); assert.equal(zB.bad, null);
      assert.deepEqual(zipNames(zA).filter(n => !n.startsWith('_목록/')), ['2026-09-10/IMG_A1.jpg', '2026-09-10/IMG_A2.jpg', '2026-10-17/사진 한글.heic']);
      assert.equal(zipNames(zA).filter(n => /^_목록\/\d{8}-\d{6}\.csv$/.test(n)).length, 1, '사진 목록 csv 하나');
      const e = n => zA.entries.find(x => x.name === n);
      assert.equal(e('2026-09-10/IMG_A1.jpg').sha, sha(gen(5003, 11)), '원본 바이트 그대로'); assert.equal(e('2026-09-10/IMG_A2.jpg').sha, sha(gen(7001, 12))); assert.equal(e('2026-10-17/사진 한글.heic').sha, sha(gen(4002, 13)));
      assert.ok(zA.entries.every(x => x.method === 0 && x.size === x.csize && x.utf8), '무압축 STORE · 이름 UTF-8 표시');
      assert.equal(e('2026-09-10/IMG_A1.jpg').comment, '_정리완료/T611 현장A/현장사진/IMG_A1.jpg', '주석 = 원래 위치');
      assert.deepEqual(e('2026-09-10/IMG_A1.jpg').date, [2026, 9, 10, 10, 0, 0], '촬영 시각(한국)'); assert.deepEqual(e('2026-10-17/사진 한글.heic').date, [2026, 10, 17, 23, 59, 0]);
      const csv = zA.csv[0];
      assert.match(csv, /^압축 안 파일,원래 위치,현장,촬영일시,공정,작업명,동·호수,위도,경도,주소,크기\(바이트\),CRC32\r\n/);
      assert.match(csv, /2026-09-10\/IMG_A1\.jpg,_정리완료\/T611 현장A\/현장사진\/IMG_A1\.jpg,T611 현장A,2026-09-10 10:00:00,1차,철거,101동 501호,36\.35,127\.38,대전 중구 시험로 1,5003,[0-9a-f]{8}\r\n/);
      assert.match(csv, /2026-10-17\/사진 한글\.heic,_정리완료\/T611 현장A\/2차 방수\/사진 한글\.heic,T611 현장A,2026-10-17 23:59:00,,방수,/);
      assert.deepEqual(zipNames(zB).filter(n => !n.startsWith('_목록/')), ['2026-08-01/IMG_B1.jpg']);
      assert.equal(zB.entries[0].sha, sha(gen(4500, 16)));
      assert.deepEqual(r.left.A, ['IMG_A4.jpg', 'V1.mp4'], '경계 날(10/18 0시) 사진·동영상은 그대로, 보관한 원본은 지움');
      assert.deepEqual(r.left.A2D, []); assert.deepEqual(r.left.B, []);
      assert.deepEqual(r.left.U, ['IMG_U1.jpg'], '현장 미지정은 그대로'); assert.deepEqual(r.left.R, ['IMG_R1.jpg'], '최근 현장은 그대로');
      assert.deepEqual(r.files, ['A4', 'AV', 'R1', 'U1', 'VX'], '보관한 사진만 목록에서 빠짐(Drive 전용 기록은 그대로)');
      assert.deepEqual(r.tombs, [true, true, true, true], '정리 표시 — 다른 기기·옛 저장본이 되살리지 않게');
      assert.ok(r.removed.includes('DA1'), 'Drive 사본은 다시 불러오지 않기');
      assert.equal(r.snaps, 1, '안전판 한 번');
      assert.equal(r.sumA.n, 3); assert.equal(r.sumA.bytes, 5003 + 7001 + 4002);
      assert.deepEqual(r.sumA.days, { '2026-09-10': 2, '2026-10-17': 1 }); assert.deepEqual(r.sumA.labels, { '2026-09-10': { 철거: 2 }, '2026-10-17': { 방수: 1 } });
      assert.deepEqual(r.sumA.zips, ['_사진보관/T611 현장A_사진보관.zip']); assert.equal(r.sumA.from, '2026-09-10'); assert.equal(r.sumA.to, '2026-10-17');
      assert.equal(r.sumB.n, 1); assert.equal(r.sumR, null);
      assert.equal(r.before.stmt, 3, '보관 전: A1·A2 + 같은 날 동영상'); assert.equal(r.after.stmt, 3, '📑 내역서 줄 사진 수 — 보관한 날도 그대로 센다');
      assert.deepEqual(r.after.unbilled, r.before.unbilled, "'내역서에 없는 작업' 이 보관한 날을 그대로 본다");
      assert.ok(r.after.unbilled.some(x => x[0] === '2026-09-10' && x[2] === 3 && x[3] === '철거'), JSON.stringify(r.after.unbilled));
      assert.equal(r.last.n, 4); assert.equal(r.last.auto, false); assert.match(r.toast, /한 달 지난 사진 4장을 현장 2곳 ZIP 으로 보관하고 낱장은 지웠어요/);
    });

    await test('③ 덧붙임 · 같은 사진은 원본만 · 파일 없는 기록은 목록에서만 · 크기 상한이면 _2 · 멈춘 뒤 이어서 (APPEND)', async () => {
      const r = await page.evaluate(async () => {
        const top = state.dirHandle, A = '_정리완료/T611 현장A/현장사진/';
        const oldZip = await __T.bytesOf(top, '_사진보관', 'T611 현장A_사진보관.zip');
        // 새 사진 · 다른 폴더의 같은 사진(A1 과 같은 이름·바이트) · 파일이 이미 없는 기록(A2 자리 — 지난번에 원본을 지운 뒤 멈춘 꼴)
        const A5 = await __T.rec(top, 'A5', 'T611 현장A', A, 'IMG_A5.jpg', 5100, 21, '2026-09-20T10:00:00+09:00');
        const DUP = await __T.rec(top, 'DUP', 'T611 현장A', '현장사진/', 'IMG_A1.jpg', 5003, 11, '2026-09-10T10:00:00+09:00', { _driveId: 'DDUP' });
        const H = await __T.rec(top, 'H', 'T611 현장A', A, 'IMG_A2.jpg', 7001, 12, '2026-09-10T11:30:00+09:00');
        await (await __T.dir(top, A)).removeEntry('IMG_A2.jpg');
        // 다른 폴더 사본인데 파일이 이미 없는 기록 — 원래 위치는 다르지만 이름·크기가 이번에 담은 A5 와 같다(검사를 통과한 뒤에만 목록에서 뺀다)
        const HB = await __T.rec(top, 'HB', 'T611 현장A', '_정리완료/T611 옛폴더/', 'IMG_A5.jpg', 5100, 21, '2026-09-21T10:00:00+09:00');
        await (await __T.dir(top, '_정리완료/T611 옛폴더/')).removeEntry('IMG_A5.jpg');
        state.files.push(A5, DUP, H, HB);
        const r1 = await hjPhotoZipRun({});
        const one = { r1, zipA: await __T.zip(top, 'T611 현장A_사진보관.zip'), box: await __T.list(top, '_사진보관'), files: state.files.map(f => f.id).sort(), raw: await __T.list(top, '현장사진/'), A: await __T.list(top, A), sumA: state.projects.find(p => p.name === 'T611 현장A').photoArchive, oldLen: oldZip.length };
        // 크기 상한(작게) — 8000바이트 사진 넷이 두 ZIP 으로
        HJ_PZ_PART_MAX = 26000;
        state.projects.push(__T.proj('T611 조각'));
        for (let i = 1; i <= 4; i++) state.files.push(await __T.rec(top, 'C' + i, 'T611 조각', '_정리완료/T611 조각/', 'C' + i + '.jpg', 8000, 30 + i, '2026-07-0' + i + 'T09:00:00+09:00'));
        const r2 = await hjPhotoZipRun({});
        HJ_PZ_PART_MAX = 500 * 1024 * 1024;
        const parts = { box: await __T.list(top, '_사진보관'), c1: await __T.zip(top, 'T611 조각_사진보관.zip'), c2: await __T.zip(top, 'T611 조각_사진보관_2.zip') };
        // [멈추기] — 첫 사진을 읽은 뒤 멈추면 그 사진만 담고 끝, 다음 실행이 나머지를 같은 ZIP 에 덧붙인다
        state.projects.push(__T.proj('T611 멈춤'));
        for (let i = 1; i <= 3; i++) state.files.push(await __T.rec(top, 'S' + i, 'T611 멈춤', '_정리완료/T611 멈춤/', 'S' + i + '.jpg', 3000 + i, 40 + i, '2026-08-1' + i + 'T09:00:00+09:00'));
        const crc0 = hjCrc32Async; let calls = 0; hjCrc32Async = async u => { const v = await crc0(u); if (++calls === 1) window.__hjPzStop = true; return v; };
        const r3 = await hjPhotoZipRun({});
        hjCrc32Async = crc0;
        const stop = { r3, left: await __T.list(top, '_정리완료/T611 멈춤/'), files: state.files.filter(f => /^S/.test(f.id)).map(f => f.id), last: hjPzLastGet(), bar: !!document.getElementById('hjPzBar') };
        const r4 = await hjPhotoZipRun({});
        stop.r4 = r4; stop.left2 = await __T.list(top, '_정리완료/T611 멈춤/'); stop.zip = await __T.zip(top, 'T611 멈춤_사진보관.zip'); stop.box = await __T.list(top, '_사진보관');
        return { one, parts, stop };
      });
      const { one, parts, stop } = r;
      assert.equal(one.r1.ok, true, JSON.stringify(one.r1)); assert.equal(one.r1.n, 4); assert.equal(one.r1.added, 1); assert.equal(one.r1.dup, 1); assert.equal(one.r1.healed, 2, '원래 위치로 하나 · 이름·크기로 하나');
      const z = pyZip(one.zipA, 'a2');
      assert.equal(z.bad, null);
      const photos = zipNames(z).filter(n => !n.startsWith('_목록/'));
      assert.deepEqual(photos, ['2026-09-10/IMG_A1.jpg', '2026-09-10/IMG_A2.jpg', '2026-10-17/사진 한글.heic', '2026-09-20/IMG_A5.jpg'], '같은 ZIP 에 덧붙임 · 같은 사진은 한 번만');
      assert.equal(zipNames(z).filter(n => n.startsWith('_목록/')).length, 2, '실행마다 csv 하나');
      const e = n => z.entries.find(x => x.name === n);
      assert.equal(e('2026-09-10/IMG_A1.jpg').sha, sha(gen(5003, 11)), '옛 사진 바이트 그대로'); assert.equal(e('2026-09-10/IMG_A2.jpg').sha, sha(gen(7001, 12))); assert.equal(e('2026-09-20/IMG_A5.jpg').sha, sha(gen(5100, 21)));
      assert.ok(one.box.every(n => !/작성중|crswap/.test(n)), '.작성중·임시 파일 없음 ' + one.box.join(','));
      assert.deepEqual(one.raw, ['IMG_U1.jpg'], '다른 폴더의 같은 사진 원본은 지움(ZIP 에 이미 있음)');
      assert.deepEqual(one.A, ['IMG_A4.jpg', 'V1.mp4']);
      assert.ok(['A5', 'DUP', 'H', 'HB'].every(id => !one.files.includes(id)), '넷 다 목록에서 빠짐 ' + one.files.join(','));
      assert.equal(one.sumA.n, 7); assert.deepEqual(one.sumA.days, { '2026-09-10': 4, '2026-10-17': 1, '2026-09-20': 1, '2026-09-21': 1 });
      // 조각
      assert.equal(parts.box.filter(n => n.startsWith('T611 조각')).length, 2, '두 ZIP 으로 ' + parts.box.join(','));
      const c1 = pyZip(parts.c1, 'c1'), c2 = pyZip(parts.c2, 'c2');
      assert.equal(c1.bad, null); assert.equal(c2.bad, null);
      assert.deepEqual(zipNames(c1).filter(n => !n.startsWith('_목록/')), ['2026-07-01/C1.jpg', '2026-07-02/C2.jpg']);
      assert.deepEqual(zipNames(c2).filter(n => !n.startsWith('_목록/')), ['2026-07-03/C3.jpg', '2026-07-04/C4.jpg']);
      assert.equal(c2.entries.find(x => x.name === '2026-07-04/C4.jpg').sha, sha(gen(8000, 34)));
      // 멈춤
      assert.equal(stop.r3.why, 'stopped'); assert.equal(stop.r3.n, 1); assert.equal(stop.bar, false, '끝나면 진행 띠가 사라짐');
      assert.deepEqual(stop.left, ['S2.jpg', 'S3.jpg']); assert.deepEqual(stop.files, ['S2', 'S3']); assert.match(stop.last.why, /stopped/);
      assert.equal(stop.r4.n, 2); assert.deepEqual(stop.left2, []);
      const s = pyZip(stop.zip, 's1');
      assert.equal(s.bad, null); assert.deepEqual(zipNames(s).filter(n => !n.startsWith('_목록/')), ['2026-08-11/S1.jpg', '2026-08-12/S2.jpg', '2026-08-13/S3.jpg'], '멈춘 뒤 같은 ZIP 에 이어서');
      assert.ok(stop.box.every(n => !/작성중/.test(n)));
    });

    await test('④ 깨진 ZIP·안전판 실패·읽은 뒤 바뀐 원본·막는 경우 — 원본과 기록은 그대로 (GUARD)', async () => {
      const r = await page.evaluate(async () => {
        const top = state.dirHandle, out = {};
        // 사진 데이터를 ZIP 에 쓸 때 한 바이트를 바꾼다(그 크기의 사진만) — 검사가 CRC 를 다시 계산해야 잡힌다
        const W = FileSystemWritableFileStream.prototype, w0 = W.write;
        W.write = function (data) { if (window.__pzCorrupt && data instanceof Uint8Array && data.length === window.__pzCorrupt) { const c = data.slice(); c[100] ^= 0xFF; return w0.call(this, c); } return w0.call(this, data); };
        // (가) 새 ZIP
        state.projects.push(__T.proj('T611 깨짐'));
        const K1 = await __T.rec(top, 'K1', 'T611 깨짐', '_정리완료/T611 깨짐/', 'K1.jpg', 6007, 51, '2026-09-01T09:00:00+09:00');
        state.files.push(K1); window.__pzCorrupt = 6007;
        const a = await hjPhotoZipRun({});
        out.a = { res: a, src: __T.eq(await __T.bytesOf(top, '_정리완료/T611 깨짐/', 'K1.jpg'), __T.gen(6007, 51)), rec: state.files.includes(K1), box: await __T.list(top, '_사진보관'), sum: state.projects.find(p => p.name === 'T611 깨짐').photoArchive || null, toast: document.getElementById('toast').textContent };
        K1.project = null;
        // (나) 이미 있는 ZIP 에 덧붙이다 깨짐 — 원래 ZIP 은 한 바이트도 안 바뀐다
        const zip0 = await __T.bytesOf(top, '_사진보관', 'T611 현장A_사진보관.zip');
        const A6 = await __T.rec(top, 'A6', 'T611 현장A', '_정리완료/T611 현장A/현장사진/', 'IMG_A6.jpg', 6007, 52, '2026-09-25T09:00:00+09:00');
        state.files.push(A6);
        const b = await hjPhotoZipRun({});
        out.b = { res: b, same: __T.eq(await __T.bytesOf(top, '_사진보관', 'T611 현장A_사진보관.zip'), zip0), src: await __T.exists(top, '_정리완료/T611 현장A/현장사진/', 'IMG_A6.jpg'), rec: state.files.includes(A6), box: await __T.list(top, '_사진보관') };
        window.__pzCorrupt = 0; W.write = w0; A6.project = null;
        // (다) 안전판을 못 만들면 아무것도 안 한다
        const F1 = await __T.rec(top, 'F1', 'T611 현장A', '_정리완료/T611 현장A/현장사진/', 'IMG_F1.jpg', 2222, 53, '2026-09-26T09:00:00+09:00');
        state.files.push(F1);
        const snap0 = hjSnapshot; hjSnapshot = async () => false;
        const c = await hjPhotoZipRun({});
        hjSnapshot = snap0;
        out.c = { res: c, src: await __T.exists(top, '_정리완료/T611 현장A/현장사진/', 'IMG_F1.jpg'), rec: state.files.includes(F1), same: __T.eq(await __T.bytesOf(top, '_사진보관', 'T611 현장A_사진보관.zip'), zip0), toast: document.getElementById('toast').textContent };
        F1.project = null;
        // (라) 읽은 뒤(검사 사이) 원본이 바뀌면 그 원본은 지우지 않고 기록도 남긴다
        state.projects.push(__T.proj('T611 바뀜'));
        const G1 = await __T.rec(top, 'G1', 'T611 바뀜', '_정리완료/T611 바뀜/', 'G1.jpg', 5555, 54, '2026-09-02T09:00:00+09:00');
        const G2 = await __T.rec(top, 'G2', 'T611 바뀜', '_정리완료/T611 바뀜/', 'G2.jpg', 5556, 55, '2026-09-02T09:05:00+09:00');
        state.files.push(G1, G2);
        await new Promise(r => setTimeout(r, 20));
        const v0 = hjPzVerify; let once = 0;
        hjPzVerify = async (...x) => { const v = await v0(...x); if (!once++) await __T.put(top, '_정리완료/T611 바뀜/', 'G1.jpg', new Uint8Array(5555).fill(7)); return v; };
        const d = await hjPhotoZipRun({});
        hjPzVerify = v0;
        out.d = { res: d, left: await __T.list(top, '_정리완료/T611 바뀜/'), g1: state.files.includes(G1), g2: state.files.includes(G2), zip: await __T.zip(top, 'T611 바뀜_사진보관.zip') };
        G1.project = null;
        // (마) 막는 경우 — 데모·오래된 창·직원 모드·폴더 없음·폴더 읽는 중
        const why = [];
        state._demo = true; why.push((await hjPhotoZipRun({})).why); state._demo = false;
        __tabStale = true; why.push((await hjPhotoZipRun({})).why); __tabStale = false;
        localStorage.setItem(HJ_STAFF_KEY, 'staff'); why.push((await hjPhotoZipRun({})).why); localStorage.removeItem(HJ_STAFF_KEY);
        const dh = state.dirHandle; state.dirHandle = null; why.push((await hjPhotoZipRun({})).why); state.dirHandle = dh;
        window.__hjScanBusy = true; window.__hjScanBusyAt = Date.now(); why.push((await hjPhotoZipRun({})).why); window.__hjScanBusy = false;
        out.why = why;
        // (바) 보관 중에는 [다시 스캔] 안 함
        const n0 = state.files.length; window.__hjPzBusy = true;
        await scanDir();
        out.scan = { scanned: !!window.__hjScanBusy, n: state.files.length === n0, toast: document.getElementById('toast').textContent, busyRun: (await hjPhotoZipRun({})).why };
        window.__hjPzBusy = false;
        out.box = await __T.list(top, '_사진보관');
        return out;
      });
      assert.equal(r.a.res.why, 'error'); assert.match(r.a.res.err, /zip-crc/, '검사에서 CRC 가 맞지 않아 멈춤');
      assert.equal(r.a.src, true, '원본 그대로'); assert.equal(r.a.rec, true, '기록 그대로'); assert.equal(r.a.sum, null);
      assert.ok(!r.a.box.some(n => /깨짐/.test(n)), '검사에 떨어진 새 ZIP 은 지움 ' + r.a.box.join(',')); assert.match(r.a.toast, /검사를 통과하지 못한 사진은 지우지 않았어요/);
      assert.equal(r.b.res.why, 'error'); assert.equal(r.b.same, true, '덧붙이던 원래 ZIP 은 한 바이트도 안 바뀜'); assert.equal(r.b.src, true); assert.equal(r.b.rec, true);
      assert.ok(r.b.box.every(n => !/작성중/.test(n)), '.작성중 은 지움 ' + r.b.box.join(','));
      assert.equal(r.c.res.why, 'snapshot'); assert.equal(r.c.src, true); assert.equal(r.c.rec, true); assert.equal(r.c.same, true); assert.match(r.c.toast, /안전판을 저장하지 못해/);
      assert.equal(r.d.res.n, 1); assert.equal(r.d.res.changed, 1, '읽은 뒤 바뀐 원본 1장'); assert.deepEqual(r.d.left, ['G1.jpg'], '바뀐 원본은 남김'); assert.equal(r.d.g1, true); assert.equal(r.d.g2, false);
      const zd = pyZip(r.d.zip, 'd1'); assert.equal(zd.bad, null); assert.equal(zd.entries.find(x => x.name === '2026-09-02/G1.jpg').sha, sha(gen(5555, 54)), 'ZIP 에는 읽을 때의 바이트');
      assert.deepEqual(r.why, ['demo', 'stale', 'staff', 'nofolder', 'scan']);
      assert.equal(r.scan.scanned, false); assert.equal(r.scan.n, true); assert.match(r.scan.toast, /ZIP 으로 보관하는 중이에요/); assert.equal(r.scan.busyRun, 'busy');
    });

    await test('⑥ ⋯ 사진 도구 · 창(대상·자동 켜고 끄기·마지막 결과·보관한 현장) · 도움말 (UI)', async () => {
      const r = await page.evaluate(async () => {
        photoToolsView();
        const item = document.querySelector('#modalRoot .ptBtn[data-fn="hjPhotoZipView"]');
        const itemText = item && item.textContent;
        item.click(); await new Promise(r => setTimeout(r, 200));
        const v = document.querySelector('#modalRoot [data-pz-view]');
        const tg = document.getElementById('pzAutoToggle'), run = document.getElementById('pzRunNow');
        const o = { itemText, view: !!v, pending: v && v.querySelector('[data-pz-pending]').getAttribute('data-pz-pending'), auto: v && v.querySelector('[data-pz-auto]').getAttribute('data-pz-auto'),
          pressed: tg && tg.getAttribute('aria-pressed'), tgH: tg && tg.getBoundingClientRect().height, runDisabled: run && run.disabled, last: (v.querySelector('[data-pz-last]') || {}).textContent || '',
          arch: v.querySelector('[data-pz-arch]') && v.querySelector('[data-pz-arch]').getAttribute('data-pz-arch'), rowA: (v.querySelector('[data-pz-row="T611 현장A"]') || {}).textContent || '' };
        tg.click(); await new Promise(r => setTimeout(r, 100));
        o.off = { ls: localStorage.getItem('hj_photo_zip_auto'), auto: document.querySelector('#modalRoot [data-pz-auto]').getAttribute('data-pz-auto'), pressed: document.getElementById('pzAutoToggle').getAttribute('aria-pressed'), sched: hjPhotoZipAutoSchedule() };
        document.getElementById('pzAutoToggle').click(); await new Promise(r => setTimeout(r, 100));
        o.on = { ls: localStorage.getItem('hj_photo_zip_auto'), auto: document.querySelector('#modalRoot [data-pz-auto]').getAttribute('data-pz-auto') };
        closeModal(true);
        o.help = (document.body.innerHTML.match(/한 달 지난 사진 ZIP 보관<\/b>[^<]{0,40}/) || [''])[0];
        return o;
      });
      assert.match(r.itemText, /한 달 지난 사진 ZIP 보관/); assert.equal(r.view, true);
      assert.equal(r.pending, '0', '남은 대상 없음'); assert.equal(r.runDisabled, true, '대상이 없으면 [지금 보관] 잠김');
      assert.equal(r.auto, 'on'); assert.equal(r.pressed, 'true'); assert.ok(r.tgH >= 44, '켜고 끄기 44px ' + r.tgH);
      assert.match(r.last, /마지막: .*장 보관·낱장 삭제/); assert.ok(+r.arch >= 5, '보관한 현장 ' + r.arch); assert.match(r.rowA, /T611 현장A · 7장/); assert.match(r.rowA, /T611 현장A_사진보관\.zip/);
      assert.deepEqual(r.off, { ls: '0', auto: 'off', pressed: 'false', sched: false }, '끄면 자동 예약 안 함');
      assert.deepEqual(r.on, { ls: '1', auto: 'on' });
      assert.match(r.help, /한 달 지난 사진 ZIP 보관/, '도움말 한 줄');
    });

    // ⑤ 진짜 폴더 읽기 뒤 자동(사람이 연 PC 처럼 navigator.webdriver = false)
    const { page: pa } = await open({ width: 1280, auto: true });
    await test('⑤ 폴더를 다 읽은 뒤 묻지 않고 보관 · _사진보관 은 안 읽음 · 끄면 안 함 (AUTO)', async () => {
      const r = await pa.evaluate(async () => {
        const jpeg = async color => { const c = new OffscreenCanvas(24, 24), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 24, 24); return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: .9 })).arrayBuffer()); };
        const exifJpeg = base => {   // 촬영 시각 2026:06:29 10:30:00(DateTimeOriginal) 만 든 APP1
          const u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255], t = [];
          t.push(0x49, 0x49, 0x2A, 0x00, ...u32(8), ...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
          t.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(44), ...u32(0));
          for (const c of '2026:06:29 10:30:00') t.push(c.charCodeAt(0)); t.push(0);
          const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...t], len = payload.length + 2;
          return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, len >> 8, len & 255, ...payload, ...base.slice(2)]);
        };
        const top = await __T.root('만물자동');
        const K1 = exifJpeg(await jpeg('#c33')), K2 = await jpeg('#3c3');
        await __T.put(top, '_정리완료/T611 오토/현장사진/', 'K1.jpg', K1);
        await __T.put(top, '_정리완료/T611 오토/현장사진/', 'K2.jpg', K2);
        await __T.put(top, '_사진보관/', '옛현장_사진보관.zip', new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        await __T.put(top, '_사진보관/', '사진.jpg', await jpeg('#33c'));
        state.projects = [__T.proj('T611 오토')]; state.files = [];
        HJ_PZ_AUTO_DELAY_MS = 200;
        setMountedDirectory(top);
        const t0 = new Date().toISOString();
        await scanDir();
        const scanned = state.files.map(f => [f.prefix + f.name, f.project, hjKDayFast(f)]).sort();
        for (let i = 0; i < 100; i++) { const l = hjPzLastGet(); if (l && l.at >= t0 && !window.__hjPzBusy) break; await new Promise(r => setTimeout(r, 200)); }
        const last = hjPzLastGet();
        const o = { scanned, last, files: state.files.map(f => f.prefix + f.name).sort(), left: await __T.list(top, '_정리완료/T611 오토/현장사진/'), box: await __T.list(top, '_사진보관'),
          zip: await __T.exists(top, '_사진보관', 'T611 오토_사진보관.zip') ? await __T.zip(top, 'T611 오토_사진보관.zip') : '', k1: Array.from(K1.slice(0, 8)), k1len: K1.length };
        localStorage.setItem('hj_photo_zip_auto', '0'); o.offSched = hjPhotoZipAutoSchedule(); localStorage.removeItem('hj_photo_zip_auto');
        return o;
      });
      assert.ok(!r.scanned.some(x => x[0].startsWith('_사진보관/')), '_사진보관 은 목록에 안 들어감 ' + JSON.stringify(r.scanned));
      assert.ok(r.scanned.some(x => x[0] === '_정리완료/T611 오토/현장사진/K1.jpg' && x[1] === 'T611 오토' && x[2] === '2026-06-29'), 'EXIF 촬영일로 읽힘 ' + JSON.stringify(r.scanned));
      assert.ok(r.last && r.last.auto === true && r.last.n === 1, '폴더 읽기 뒤 자동 보관 ' + JSON.stringify(r.last));
      assert.deepEqual(r.left, ['K2.jpg'], '한 달 지난 K1 만 지움');
      assert.deepEqual(r.files, ['_정리완료/T611 오토/현장사진/K2.jpg']);
      assert.ok(r.box.includes('T611 오토_사진보관.zip') && r.box.includes('옛현장_사진보관.zip') && r.box.includes('사진.jpg'), r.box.join(','));
      const z = pyZip(r.zip, 'auto');
      assert.equal(z.bad, null); assert.deepEqual(zipNames(z).filter(n => !n.startsWith('_목록/')), ['2026-06-29/K1.jpg']);
      assert.equal(z.entries[0].size, r.k1len, 'EXIF 가 든 원본 그대로'); assert.deepEqual(z.entries[0].date, [2026, 6, 29, 10, 30, 0]);
      assert.equal(r.offSched, false, '자동을 끄면 예약 안 함');
    });

    await test('⑥-2 폰 390 — 창·진행 띠 넘침 0 · 44px · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0', async () => {
      const { page: pp } = await open({ width: 390, mobile: true });
      const r = await pp.evaluate(async () => {
        state.projects = [__T.proj('T611 폰현장 아주 긴 이름이 붙은 아파트 단지 101동', { photoArchive: { n: 12, bytes: 34567890, zips: ['_사진보관/T611 폰현장 아주 긴 이름이 붙은 아파트 단지 101동_사진보관.zip'], days: { '2026-09-01': 12 }, labels: {}, from: '2026-09-01', to: '2026-09-30', at: new Date().toISOString() } })];
        hjPzLastSet({ at: new Date().toISOString(), auto: true, n: 12, projects: 1, why: '', changed: 0 });
        hjPhotoZipView(); await new Promise(r => setTimeout(r, 200));
        const m = document.querySelector('#modalRoot .modal'), tg = document.getElementById('pzAutoToggle'), run = document.getElementById('pzRunNow');
        const o = { overflow: m.scrollWidth - m.clientWidth, docOverflow: document.documentElement.scrollWidth - innerWidth, tgH: tg.getBoundingClientRect().height, run: run.disabled, block: (document.querySelector('[data-pz-block]') || {}).getAttribute ? document.querySelector('[data-pz-block]').getAttribute('data-pz-block') : '' };
        closeModal(true);
        hjPzBar('🗜 한 달 지난 사진 ZIP 보관 중 — T611 폰현장 아주 긴 이름이 붙은 아파트 단지 101동 12/120 · 전체 34/870');
        const b = document.getElementById('hjPzBar').getBoundingClientRect(), s = document.getElementById('hjPzStop').getBoundingClientRect(), nav = document.querySelector('.mobile-nav');
        o.bar = { left: b.left, right: innerWidth - b.right, bottom: innerHeight - b.bottom, stopH: s.height, navTop: nav ? nav.getBoundingClientRect().top : null, barBottom: b.bottom, role: document.getElementById('hjPzBar').getAttribute('role') };
        document.getElementById('hjPzStop').click(); o.stop = window.__hjPzStop === true; window.__hjPzStop = false;
        hjPzBar(null); o.gone = !document.getElementById('hjPzBar');
        return o;
      });
      assert.ok(r.overflow <= 1 && r.docOverflow <= 1, '넘침 ' + JSON.stringify(r)); assert.ok(r.tgH >= 44); assert.equal(r.run, true, '폴더 없으면 잠김'); assert.equal(r.block, 'nofolder');
      assert.ok(r.bar.left >= 0 && r.bar.right >= 0, '진행 띠 화면 안 ' + JSON.stringify(r.bar)); assert.ok(r.bar.stopH >= 44); assert.equal(r.bar.role, 'status');
      assert.ok(r.bar.navTop == null || r.bar.barBottom <= r.bar.navTop + 1, '하단 메뉴를 가리지 않음 ' + JSON.stringify(r.bar));
      assert.equal(r.stop, true, '[멈추기]'); assert.equal(r.gone, true);
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 611, '핀 3곳 같음(v611 이상) ' + [a, b, c]);
      assert.deepEqual(errors, [], '페이지 오류 0'); assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
  } finally {
    await browser.close();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
  console.log('photozip-v611: ' + passed + '/7');
  if (passed !== 7) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

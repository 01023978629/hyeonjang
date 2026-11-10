/* v567 사진 되살아남·동기화 뒷정리 3건 — v530·v560·v531 절의 '안 한 것'·'백로그'.
   전제: tests/mock-relay.js(8398) + tests/static-server.js(8299). 합성 자료·가짜 폴더·가짜 Drive 다운로드만, 실제 고객·현장 자료 없음.
   ① 폰 머리 '☁ 서버 자료 HH:MM 받음'(#hjSyncAt) — 값은 __relay.syncAt 만(relayLoadApply 뒤 서버 modifiedAt). 오늘이 아니면 'M/D HH:MM'.
      우선순위: 경고 상태(offline·netfail·conflict·auth·qfail·stale)·오래된 창(__tabStale)이면 숨겨 그쪽 표시가 이긴다. PC 머리에는 안 보인다(사이드바 relayStat 가 있다) (LABEL)
   ② OAuth 직접 들이기(__gdIngestOne)도 정리 표시(photoTombs)의 Drive ID 를 대조 — 뺀 사본은 새 기록으로 안 들이고 받지도 않는다.
      이미 있는 기록에 잇는 길(같은 Drive ID 가상 기록)과 되살린 표시(r>t)는 종전대로 들어온다 (GDSKIP)
   ③ 📤 PC 사진 올리기 — 같은 원본을 가리키는 기록 둘(같은 경로·크기·수정 시각 / 같은 handle)은 한 번만 올리고 Drive ID 를 둘 다에 잇는다.
      한 묶음 안(같은 경로)·다음 묶음(같은 handle, 다른 경로) 둘 다. 바이트가 같아도 경로가 다르면 둘 다 올린다(합치지 않음). 진행 글 '같은 원본 연결 2' (TWINS)
   ④ 핀 3곳 서로 같음(v564 이상 — 판 번호는 통합자가 올린다) · 페이지 오류 0 (PINS)
   HJ_V567_MUTATION: no-label(표시 제거)·no-priority(경고 무시) 는 ①, no-gdskip(대조 한 줄 삭제) 는 ②, dup-upload(묶음 안 중복 올리기 복귀)·no-prior(다음 묶음 중복 올리기 복귀) 는 ③ 에서 실패해야 한다.
   HJ_V567_BASELINE=<commit>(v564) 은 ① 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
let APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398', TOKEN = 'test-token-123', ALT_PORT = 8319;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V567_BASELINE ? execFileSync('git', ['show', process.env.HJ_V567_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-label': ['  el.textContent=txt;el.hidden=!txt;\n}', "  el.textContent='';el.hidden=true;\n}"],
  'no-priority': ["  const txt=(!warn&&!stale&&relayReady())?relaySyncAtText():'';", "  const txt=relayReady()?relaySyncAtText():'';"],
  'no-gdskip': ['  if(!ph&&__gdTombDrive().has(String(id))){window.__gdTombSkipped=(window.__gdTombSkipped||0)+1;return 0;}', ''],
  'dup-upload': ['        if(lead){twins.push({f,lead});skip.add(fileKey(f));continue;}', ''],
  'no-prior': ['        if(prior){linkTwin(f,prior);linkedNow++;skip.add(fileKey(f));run.done++;continue;}', ''],
}[process.env.HJ_V567_MUTATION || ''];
if (process.env.HJ_V567_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V567_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}
// 기준선·변이 index.html 은 따로 띄운 로컬 서버가 준다 — route.fulfill 문서는 mock relay(localhost) 요청이 로컬 네트워크 규칙에 막힌다(v530 과 같은 이유).
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
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function mockState() { const r = await fetch(MOCK + '/__state'); return r.json(); }
async function pollMock(pred, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const st = await mockState(); if (pred(st)) return st; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('pollMock timeout: ' + label + ' — rev=' + (await mockState()).revision);
}

let browser, passed = 0;
const errors = [];
async function device(phone) {
  const context = await browser.newContext(phone ? { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE, timezoneId: 'Asia/Seoul' }
    : { serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push((phone ? 'phone: ' : 'pc: ') + String(e)));
  page.on('dialog', d => { if (d.type() === 'beforeunload') return d.accept(); errors.push('dialog:' + d.type()); d.dismiss(); });
  await context.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(MOCK)) return route.continue();
    if (u.startsWith(new URL(APP).origin + '/')) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (e) {} }, BOOT);
  return { context, page };
}
const connect = page => page.evaluate(async ({ url, token }) => { await idbSet('relay_url', url); await idbSet('relay_token', token); await relayBoot(); }, { url: MOCK, token: TOKEN });
const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
// 머리 표시 읽기 — hidden 속성·실제 그려짐·글자·글자 크기
const label = page => page.evaluate(() => { const el = document.getElementById('hjSyncAt'); if (!el) return { exists: false }; const cs = getComputedStyle(el); return { exists: true, hidden: el.hidden, text: el.textContent, display: cs.display, font: parseFloat(cs.fontSize), inHeader: !!el.closest('header'), state: __relayState }; });

// 가짜 폴더(만물/현장사진) — 같은 JPEG 바이트·같은 수정 시각의 사진 여러 장. 같은 이름은 늘 같은 handle 객체를 돌려준다(실제 폴더처럼 경로 하나 = 파일 하나). 쓰기는 _현장.json 만.
async function mountFolder(page) {
  return page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const x = c.getContext('2d'); x.fillStyle = '#c84'; x.fillRect(0, 0, 64, 48); x.fillStyle = '#246'; x.fillRect(8, 8, 20, 20);
    const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8))).arrayBuffer());
    window.__folderWrites = window.__folderWrites || [];
    const deny = () => { throw Error('fixture write prohibited'); };
    const fileH = name => ({ kind: 'file', name, createWritable: deny, getFile: async () => new File([jpg], name, { type: '', lastModified: 1761900000000 }) });
    const names = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].concat(Array.from({ length: 10 }, (_, i) => 'f' + String(i + 1).padStart(2, '0') + '.jpg'));
    const photos = names.map(fileH);
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
    const rec = (name, extra) => Object.assign({ id: uid(), name, handle: null, prefix: '현장사진/', ext: 'jpg', size: jpg.length, kind: 'photo', project: null,
      thumb: null, text: '', ocr: 'na', est: null, contact: null, _file: null, when: new Date('2026-10-20T01:00:00Z') }, extra || {});
    const bH = photos.find(p => p.name === 'b.jpg');
    // 16 기록: a 두 기록(같은 경로 → 한 묶음 안 쌍) · b 두 기록(같은 handle, 둘째는 다른 경로·맨 뒤 → 다음 묶음) · c·d(바이트만 같음, 경로 다름 → 둘 다 올림) · f01~f10
    state.files = [rec('a.jpg', { id: 'A1' }), rec('a.jpg', { id: 'A2' }), rec('b.jpg', { id: 'B1', handle: bH }), rec('c.jpg', { id: 'C' }), rec('d.jpg', { id: 'D' })]
      .concat(names.slice(4).map(n => rec(n)))
      .concat([rec('b.jpg', { id: 'B2', handle: bH, prefix: 'other/' })]);
    state.projects = [P0('가온아파트')];
    function P0(name) { return { name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }; }
    state.tab = 'dashboard'; state.activeProject = null; state.search = ''; __pcup = null;
    markDirty(); await guardedPersistCurrentState(); render();
    return { total: state.files.length };
  });
}

(async () => {
  await fetch(MOCK + '/__reset');
  if (html) await startAlt();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS photosync-v567 ' + name); }
  // PC: 서버 연결 → 현장 하나 저장(rev 1)
  const pc = await device(false);
  await connect(pc.page);
  await pc.page.evaluate(({ p }) => { state.projects.push(p); markDirty(); }, { p: P('가온아파트') });
  await pollMock(st => st.revision >= 1, 12000, 'pc rev 1');

  await test('① 폰 머리 ☁ 서버 자료 HH:MM 받음 — syncAt 그대로 · 어제는 M/D · 경고·오래된 창이 이김 · PC 에는 없음 (LABEL)', async () => {
    // PC: 상태가 '저장 완료'여도 머리 표시는 그리지 않는다(사이드바가 있다)
    await pc.page.evaluate(() => relaySetStatus('saved'));
    const pcL = await label(pc.page);
    assert(pcL.exists && pcL.display === 'none', 'PC header never shows the sync label ' + JSON.stringify(pcL));
    const phone = await device(true);
    const pm = phone.page;
    await pm.evaluate(() => { __mobileMode = true; applyMobileMode(); });   // 모바일 모드는 화면 폭이 아니라 설정값(v319)
    await connect(pm);
    const before = await label(pm);
    assert(before.exists && before.hidden === true && before.text === '', 'nothing received yet → hidden ' + JSON.stringify(before));
    const applied = await pm.evaluate(() => relayLoadApply(true));
    assert.equal(applied, true, 'server data applied on the phone');
    await pm.waitForFunction(() => { const el = document.getElementById('hjSyncAt'); return el && !el.hidden && /받음/.test(el.textContent); });
    // 기대 HH:MM 은 페이지(Asia/Seoul) 안에서 센다 — 검사 러너의 시간대(UTC)와 다르다
    const r = await pm.evaluate(() => { const d = new Date(__relay.syncAt); return { syncAt: __relay.syncAt, hm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), mobile: document.body.classList.contains('mobile-mode'), state: __relayState }; });
    const st = await mockState();
    assert.equal(r.syncAt, st.savedAt, 'syncAt is the server modifiedAt (read only, no new key) ' + JSON.stringify(r));
    assert(r.mobile, 'phone is in mobile mode');
    let L = await label(pm);
    assert.equal(L.text, '☁ 서버 자료 ' + r.hm + ' 받음', 'today → HH:MM only ' + JSON.stringify(L));
    assert(L.display !== 'none' && L.inHeader && L.font <= 12, 'visible, small, in the phone header ' + JSON.stringify(L));
    // 어제 받은 자료면 날짜도
    const yday = await pm.evaluate(() => { const keep = __relay.syncAt; const d = new Date(Date.now() - 86400000); d.setHours(7, 5, 0, 0); __relay.syncAt = d.toISOString(); relaySetStatus('saved'); const t = document.getElementById('hjSyncAt').textContent; __relay.syncAt = keep; relaySetStatus('saved'); return { t, m: d.getMonth() + 1, d: d.getDate() }; });
    assert.equal(yday.t, '☁ 서버 자료 ' + yday.m + '/' + yday.d + ' 07:05 받음', 'not today → M/D HH:MM ' + JSON.stringify(yday));
    // 우선순위 — 경고 상태·오래된 창이면 숨긴다(안심시키는 줄이 실패를 가리면 안 된다), 풀리면 다시 보인다
    const prio = await pm.evaluate(() => {
      const out = {}; const read = () => { const el = document.getElementById('hjSyncAt'); return el.hidden || !el.textContent ? 'hidden' : 'shown'; };
      for (const c of ['offline', 'netfail', 'conflict', 'auth', 'qfail', 'stale']) { relaySetStatus(c); out[c] = read(); }
      relaySetStatus('saved'); out.saved = read();
      __tabStale = true; relaySetStatus('saved'); out.staleTab = read(); __tabStale = false; relaySetStatus('saved'); out.back = read();
      relaySetStatus('saving'); out.saving = read(); relaySetStatus('ready'); out.ready = read();
      return out;
    });
    assert.deepEqual(prio, { offline: 'hidden', netfail: 'hidden', conflict: 'hidden', auth: 'hidden', qfail: 'hidden', stale: 'hidden', saved: 'shown', staleTab: 'hidden', back: 'shown', saving: 'shown', ready: 'shown' }, 'warnings and the stale tab win ' + JSON.stringify(prio));
    // 사이드바 상태 글(PC 가 보는 것)은 그대로다
    const stat = await pm.evaluate(() => (document.getElementById('relayStat') || {}).textContent || '');
    assert.match(stat, /☁️ 서버 연결됨|클라우드 저장 완료/);
    await phone.context.close();
  });

  await test('② OAuth 직접 들이기도 정리 표시의 Drive ID 를 지킨다 — 뺀 사본은 안 받고 안 만듦 · 기존 기록 잇기·되살린 표시는 그대로 (GDSKIP)', async () => {
    const r = await pc.page.evaluate(async () => {
      window.__gdFetched = [];
      const real = window.fetch;
      window.fetch = function (u, o) { const s = String(u); if (s.indexOf('googleapis.com/drive/v3/files/') >= 0 && s.indexOf('alt=media') >= 0) { window.__gdFetched.push(s.split('/files/')[1].split('?')[0]); return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })) }); } return real.call(this, u, o); };
      const T = '2026-11-07T04:53:11.920Z';
      state.photoTombs = [
        { k: hjTombKey('현장사진/', 'IMG_0001.jpg', 300, 'D_GONE'), t: T },   // 정리로 뺀 사본
        { k: hjTombKey('현장사진/', 'IMG_0050.jpg', 400, 'D_LINK'), t: T },   // 뺀 사본과 같은 Drive 파일 — 남긴 가상 기록이 그 ID 를 든다(잇기 길)
        { k: hjTombKey('현장사진/', 'IMG_0007.jpg', 200, 'D_BACK'), t: T, r: '2026-11-07T05:00:00.000Z' },   // 복구함으로 되살림(r>t)
      ];
      state.files = [{ id: 'K1', name: 'IMG_0050.jpg', prefix: '현장사진/', ext: 'jpg', kind: 'photo', size: 400, project: '가온아파트', _phase: '방수', _virtual: true, _driveId: 'D_LINK', thumb: null, text: '', ocr: 'na', when: new Date('2026-09-25T01:00:00Z') }];
      window.__gdTombSkipped = 0;
      const gone = await __gdIngestOne('D_GONE', 'IMG_0001 (1).jpg', 'image/jpeg', 'TOK');
      const fresh = await __gdIngestOne('D_NEW', 'IMG_0100.jpg', 'image/jpeg', 'TOK');
      const link = await __gdIngestOne('D_LINK', 'IMG_0050.jpg', 'image/jpeg', 'TOK');
      const back = await __gdIngestOne('D_BACK', 'IMG_0007.jpg', 'image/jpeg', 'TOK');
      const again = await __gdIngestOne('D_GONE', 'IMG_0001 (1).jpg', 'image/jpeg', 'TOK');
      const byId = id => state.files.filter(f => f._driveId === id);
      const out = { gone, fresh, link, back, again, skipped: window.__gdTombSkipped, fetched: window.__gdFetched.slice(),
        goneRecs: byId('D_GONE').length, newRecs: byId('D_NEW').length, linkRecs: byId('D_LINK').length, linkVirtual: byId('D_LINK').map(f => !!f._virtual), linkPhase: byId('D_LINK').map(f => f._phase), backRecs: byId('D_BACK').length };
      window.fetch = real; state.photoTombs = []; return out;
    });
    assert.deepEqual({ gone: r.gone, again: r.again, goneRecs: r.goneRecs, skipped: r.skipped, fetchedGone: r.fetched.filter(x => x === 'D_GONE').length },
      { gone: 0, again: 0, goneRecs: 0, skipped: 2, fetchedGone: 0 }, 'tombed Drive photo is neither downloaded nor recorded ' + JSON.stringify(r));
    assert.deepEqual({ fresh: r.fresh, newRecs: r.newRecs, back: r.back, backRecs: r.backRecs }, { fresh: 1, newRecs: 1, back: 1, backRecs: 1 }, 'new photo and revived tomb still come in ' + JSON.stringify(r));
    assert.deepEqual({ link: r.link, linkRecs: r.linkRecs, linkVirtual: r.linkVirtual, linkPhase: r.linkPhase }, { link: 1, linkRecs: 1, linkVirtual: [false], linkPhase: ['방수'] }, 'existing record with the same Drive ID is still replaced in place (link path untouched) ' + JSON.stringify(r));
    assert.deepEqual(r.fetched.sort(), ['D_BACK', 'D_LINK', 'D_NEW'], 'only non-tombed files are downloaded ' + JSON.stringify(r.fetched));
  });

  await test('③ 📤 PC 사진 올리기 — 같은 원본 기록 둘은 한 번만 올리고 Drive ID 를 둘 다에 · 바이트만 같으면 둘 다 올림 (TWINS)', async () => {
    const page = pc.page;
    await page.waitForFunction(() => !__relaySaving, null, { timeout: 15000 });
    const m = await mountFolder(page);
    assert.equal(m.total, 16);
    assert.equal(await page.evaluate(() => pcupTargets().length), 16, 'all 16 records lack a server copy');
    const before = (await mockState()).uploads.length;
    const r = await page.evaluate(async () => {
      const run = await pcupRun();
      const g = id => state.files.find(f => f.id === id) || {};
      return { ok: run.ok, done: run.done, total: run.total, twins: run.twins, failed: run.failed, reason: run.reason, linked: state.files.filter(f => f._driveId).length,
        a: [g('A1')._driveId, g('A2')._driveId], b: [g('B1')._driveId, g('B2')._driveId], c: g('C')._driveId, d: g('D')._driveId, left: pcupTargets().length,
        progress: pcupProgressHTML(run).replace(/<[^>]+>/g, ' ') };
    });
    const st = await mockState();
    const names = st.uploads.slice(before).map(u => u.name);
    assert.deepEqual({ ok: r.ok, done: r.done, total: r.total, twins: r.twins, failed: r.failed, reason: r.reason, linked: r.linked, left: r.left, uploads: names.length },
      { ok: 14, done: 16, total: 16, twins: 2, failed: 0, reason: 'done', linked: 16, left: 0, uploads: 14 }, 'TWINS ' + JSON.stringify(r) + ' uploads=' + names.join(','));
    assert(r.a[0] && r.a[0] === r.a[1], 'same path → one upload, both records carry the same Drive ID ' + JSON.stringify(r.a));
    assert(r.b[0] && r.b[0] === r.b[1], 'same handle (different path, later batch) → linked, not uploaded again ' + JSON.stringify(r.b));
    assert(r.c && r.d && r.c !== r.d, 'same bytes but different paths are not merged ' + JSON.stringify([r.c, r.d]));
    assert.equal(names.filter(n => n === 'a.jpg').length, 1); assert.equal(names.filter(n => n === 'b.jpg').length, 1);
    assert.equal(new Set(names).size, 14, 'no original uploaded twice ' + names.join(','));
    assert.match(r.progress, /16 \/ 16장 · 올림 14 · 같은 원본 연결 2/);
    // 서버 저장본·이 기기 저장본에도 둘 다 Drive ID 가 있다
    // 저장 기록은 id 가 아니라 prefix·name·driveId 로 남는다(serializeData) — a.jpg 두 줄(같은 경로)·b.jpg 두 줄(현장사진/·other/)
    const links = list => ({ a: (list || []).filter(f => f.name === 'a.jpg').map(f => f.driveId || null), b: ['현장사진/', 'other/'].map(px => ((list || []).find(f => f.name === 'b.jpg' && f.prefix === px) || {}).driveId || null) });
    const saved = links(await page.evaluate(async () => (await idbGet('appState')).files || []));
    assert(saved.a.length === 2 && saved.a[0] && saved.a[0] === saved.a[1] && saved.b[0] && saved.b[0] === saved.b[1], 'device appState keeps both links ' + JSON.stringify(saved));
    const srv = links((st.data && st.data.files) || []);
    assert(srv.a.length === 2 && srv.a[0] && srv.a[0] === srv.a[1] && srv.b[0] && srv.b[0] === srv.b[1], 'server data has both links ' + JSON.stringify(srv));
  });

  await test('④ 핀 3곳 서로 같음(v564+) · 페이지 오류 0 (PINS)', async () => {
    const build = (SRC.match(/const APP_BUILD='hyeonjang-v(\d+)-[^']*'/) || [])[1];
    assert(Number(build) >= 564, 'APP_BUILD v564+');
    const pin = SRC.match(/const APP_BUILD='([^']+)'/)[1];
    assert.equal(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/)[1], pin);
    assert.equal(fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/)[1], pin);
    assert(/function relaySyncAtRender\(/.test(SRC) && /function __gdTombDrive\(/.test(SRC) && /const pcupSrcKey=/.test(SRC));
    assert.deepEqual(errors, [], 'no page errors');
  });

  console.log('photosync-v567: ' + passed + '/4 passed');
  await browser.close();
  if (altServer) altServer.close();
  process.exit(passed === 4 ? 0 : 1);
})().catch(async e => {
  console.error('FAIL photosync-v567', e && e.stack || e);
  try { await browser.close(); } catch (_) {}
  if (altServer) altServer.close();
  process.exit(1);
});

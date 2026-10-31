/* v532 🛡 오래된 탭이 폴더 _현장.json 을 덮지 않게 + 폴더 저장본이 '더 새것'처럼 보여도 내용이 다르면 자동으로 덮지 않기.
   10/31 실측: 아침에 열어 둔 탭(옛 자료 — 현장 56·견적 0)이 오후 15:14 에 폴더 _현장.json 을 다시 썼다. 기기 저장본(IndexedDB)은
   다중 탭 문지기가 막았지만 폴더 파일 쓰기(saveProject)는 문지기가 없었다. 그 파일은 저장 시각이 더 나중이라, 다음에 폴더를 연결하면
   loadProject 가 오늘 작업(현장 61·견적 32)을 옛 자료로 바꿀 수 있었다.
   전제: tests/static-server.js(8299). 합성 자료·가짜 폴더(_현장.json 읽기/쓰기만). 서버 없음.
   ① 다른 탭이 더 최근에 저장하면(방송 없이도) 이 탭의 폴더 저장은 쓰지 않는다 · 경고 띠 · 최신 탭은 쓴다 (STALE)
   ② 폴더 저장본이 시각은 나중인데 내용이 다르면 이 기기 자료 유지 + 확인 창(두 자료 요약) → [이 기기 자료 유지] 가 폴더 파일을 지금 자료로 다시 쓴다 (NEWER)
   ③ [폴더 저장본 불러오기]: 🛡 안전판을 먼저 만들고 폴더 자료를 적용한다 (LOAD)
   ④ 내용이 같으면(저장 시각·AI 점검 기록만 다름) 조용히 적용 · 폴더가 더 오래되면 이 기기 유지(예전 그대로) · 이 기기 자료가 없으면(첫 연결) 폴더 적용 (SAME)
   ⑤ 소스·핀 3곳(v532 이상·서로 같음) · 페이지 오류 0 (MISC)
   HJ_V532_BASELINE=<commit>(v531) 은 ① 에서, HJ_V532_MUTATION=no-guard(폴더 저장 문지기 끔) 는 ① 에서, no-choice(다르면 묻기 끔) 는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
let APP = 'http://localhost:8299/index.html';
const ALT_PORT = 8303;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V532_BASELINE ? execFileSync('git', ['show', process.env.HJ_V532_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = process.env.HJ_V532_MUTATION || '';
if (MUT === 'no-guard') {
  const from = "    if(!fresh){__tabStale=true;__hjLocalSavePending=false;multiTabStaleWarn();";
  assert(SRC.includes(from), 'mutation anchor no-guard');
  html = SRC.replace(from, "    if(false){__tabStale=true;__hjLocalSavePending=false;multiTabStaleWarn();");
}
if (MUT === 'no-choice') {
  const from = "    } else if(ref && hjDataHasContent(ref) && hjDataSig(data)!==hjDataSig(ref)){";
  assert(SRC.includes(from), 'mutation anchor no-choice');
  html = SRC.replace(from, "    } else if(false){");
}
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
let browser, passed = 0;
const errors = [];
async function openPage(context, label) {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(label + ': ' + String(e)));
  page.on('dialog', d => { if (d.type() === 'beforeunload') return d.accept(); errors.push('dialog:' + d.type()); d.dismiss(); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
  return page;
}
// 가짜 폴더: _현장.json 만 읽고 쓴다. window.__folderFile 이 지금 파일 내용, __folderWrites 가 쓴 기록.
async function mountFolder(page, fileText) {
  await page.evaluate(text => {
    window.__folderFile = text; window.__folderWrites = [];
    const deny = () => { throw Error('fixture write prohibited'); };
    const dataH = { kind: 'file', name: '_현장.json',
      getFile: async () => { if (window.__folderFile == null) throw Error('not found'); return new File([window.__folderFile], '_현장.json'); },
      createWritable: async () => { const parts = []; return { write: async d => { parts.push(typeof d === 'string' ? d : String(d)); }, close: async () => { window.__folderFile = parts.join(''); window.__folderWrites.push(window.__folderFile); } }; } };
    state.dirHandle = { kind: 'directory', name: '만물', removeEntry: deny, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      async *entries() {}, async getDirectoryHandle(n) { throw Error('not found ' + n); },
      async getFileHandle(n, o) { if (n === '_현장.json') { if (window.__folderFile == null && !(o && o.create)) throw Error('not found'); return dataH; } throw Error('not found ' + n); } };
  }, fileText);
}
const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
const names = page => page.evaluate(() => (state.projects || []).map(p => p.name).sort());

(async () => {
  if (html) await startAlt();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS folderguard-v532 ' + name); }
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Seoul' });
  await context.route('**/*', route => route.request().url().startsWith(new URL(APP).origin + '/') ? route.continue() : route.abort('blockedbyclient'));
  await context.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  // 아침 탭(A): 현장 둘로 시작해 저장
  const a = await openPage(context, 'A');
  await a.evaluate(async ({ ps }) => { state.projects = ps; markDirty(); await guardedPersistCurrentState(); }, { ps: [P('가온아파트'), P('나래아파트')] });
  // 오후 탭(B): 같은 기기 저장본을 열어 작업을 더하고 저장 — 방송(BroadcastChannel)은 끄고 저장본 문지기만으로 막히는지 본다
  const b = await openPage(context, 'B');
  await b.evaluate(async ({ p }) => { try { __tabBC && __tabBC.close(); } catch (_) {} __tabBC = null; state.projects.push(p); markDirty(); await guardedPersistCurrentState(); }, { p: P('다솜아파트') });

  await test('① 다른 탭이 더 최근에 저장하면 폴더 저장을 쓰지 않음 · 경고 띠 · 최신 탭은 씀 (STALE)', async () => {
    await mountFolder(a, null);
    const ra = await a.evaluate(async () => { const staleBefore = __tabStale; await saveProject(true); return { staleBefore, writes: window.__folderWrites.length, stale: __tabStale, banner: !!document.getElementById('hjTabWarn') }; });
    assert.equal(ra.staleBefore, false, 'A is not flagged by a broadcast (channel off) — the stored-state guard must catch it');
    assert.equal(ra.writes, 0, 'stale tab must not write the folder file ' + JSON.stringify(ra));
    assert(ra.stale && ra.banner, 'stale tab is flagged and warned ' + JSON.stringify(ra));
    await mountFolder(b, null);
    const rb = await b.evaluate(async () => { await saveProject(true); const f = window.__folderWrites.slice(-1)[0]; return { writes: window.__folderWrites.length, projects: f ? JSON.parse(f).projects.map(p => p.name).sort() : null }; });
    assert.deepEqual(rb, { writes: 1, projects: ['가온아파트', '나래아파트', '다솜아파트'] }, 'fresh tab writes its data');
  });

  // 폴더 파일을 '아침 자료 + 더 나중 저장 시각'으로 바꿔 둔다(10/31 의 바로 그 모양)
  const morning = await a.evaluate(() => { const d = serializeData(); d.savedAt = new Date(Date.now() + 3600000).toISOString(); return JSON.stringify(d, null, 1); });
  await a.close();

  await test('② 시각은 나중·내용은 다른 폴더 저장본 → 이 기기 유지 + 확인 창 → [이 기기 자료 유지]가 폴더를 다시 씀 (NEWER)', async () => {
    await mountFolder(b, morning);
    await b.evaluate(async () => { await scanDir(); });
    assert.deepEqual(await names(b), ['가온아파트', '나래아파트', '다솜아파트'], 'local data kept — not replaced by the older content');
    await b.waitForSelector('[data-folder-choice]', { timeout: 5000 });
    const brief = await b.evaluate(() => ({ mine: document.querySelector('[data-folder-mine]').textContent, file: document.querySelector('[data-folder-file]').textContent }));
    assert.match(brief.mine, /현장 3 · 견적 0 · 파일 0/);
    assert.match(brief.file, /현장 2 · 견적 0 · 파일 0/);
    await b.click('#modalRoot .mfoot button.blue');
    await b.waitForFunction(() => window.__folderWrites.length >= 1);
    const after = await b.evaluate(() => JSON.parse(window.__folderFile).projects.map(p => p.name).sort());
    assert.deepEqual(after, ['가온아파트', '나래아파트', '다솜아파트'], 'folder file rewritten with the current data');
  });

  await test('③ [폴더 저장본 불러오기] — 안전판 먼저, 그다음 폴더 자료 (LOAD)', async () => {
    await mountFolder(b, morning);
    await b.evaluate(async () => { await scanDir(); });
    await b.waitForSelector('[data-folder-choice]', { timeout: 5000 });
    await b.click('#modalRoot .mfoot button.ghost');
    await b.waitForFunction(() => state.projects.length === 2);
    assert.deepEqual(await names(b), ['가온아파트', '나래아파트']);
    const snaps = await b.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(s => s.label));
    assert(snaps.includes('폴더 저장본 불러오기 전'), 'snapshot before loading ' + JSON.stringify(snaps.slice(0, 5)));
  });

  await test('④ 같은 내용은 조용히 적용 · 오래된 폴더는 이 기기 유지 · 첫 연결은 폴더 적용 (SAME)', async () => {
    // 같은 내용 + 더 나중 시각(AI 점검 기록만 다름) → 창 없이 적용
    const same = await b.evaluate(() => { const d = serializeData(); d.savedAt = new Date(Date.now() + 7200000).toISOString(); d.aiOps = Object.assign({}, d.aiOps || {}, { nextCheck: '2099-01-01T00:00:00Z' }); return JSON.stringify(d, null, 1); });
    await mountFolder(b, same);
    await b.evaluate(async () => { closeModal(true); await scanDir(); });
    await b.waitForTimeout(700);
    assert.equal(await b.evaluate(() => !!document.querySelector('[data-folder-choice]')), false, 'no prompt for identical content');
    // 더 오래된 폴더 저장본(내용 다름) → 예전처럼 이 기기 유지, 창 없음
    await b.evaluate(async ({ p }) => { state.projects.push(p); markDirty(); await guardedPersistCurrentState(); }, { p: P('라온아파트') });
    const older = await b.evaluate(() => { const d = serializeData(); d.projects = d.projects.slice(0, 1); d.savedAt = '2020-01-01T00:00:00.000Z'; return JSON.stringify(d, null, 1); });
    await mountFolder(b, older);
    await b.evaluate(async () => { applyData(JSON.parse(JSON.stringify(serializeData()))); await scanDir(); });
    await b.waitForTimeout(700);
    assert.deepEqual(await names(b), ['가온아파트', '나래아파트', '라온아파트']);
    assert.equal(await b.evaluate(() => !!document.querySelector('[data-folder-choice]')), false, 'no prompt when the folder file is older');
    // 첫 연결(이 기기 자료 없음) → 폴더 적용
    await mountFolder(b, morning);
    await b.evaluate(async () => { state.projects = []; state.files = []; state.quotes = []; __lastData = null; __dataAt = ''; await scanDir(); });
    await b.waitForTimeout(700);
    assert.deepEqual(await names(b), ['가온아파트', '나래아파트']);
    assert.equal(await b.evaluate(() => !!document.querySelector('[data-folder-choice]')), false, 'first connection applies silently');
  });

  await test('⑤ 소스·핀 3곳 · 페이지 오류 0 (MISC)', async () => {
    const build = (SRC.match(/const APP_BUILD='hyeonjang-v(\d+)-[^']*'/) || [])[1];
    assert(Number(build) >= 532, 'APP_BUILD v532+');
    const pin = SRC.match(/const APP_BUILD='([^']+)'/)[1];
    assert.equal(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/)[1], pin);
    assert.equal(fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/)[1], pin);
    assert(/function hjFolderNewerChoice\(/.test(SRC) && /fresh=await guardedPersistCurrentState\(\)/.test(SRC));
    assert.deepEqual(errors, [], 'no page errors');
  });

  console.log('folderguard-v532: ' + passed + '/5 passed; synthetic data; no server');
  await browser.close();
  if (altServer) altServer.close();
  process.exit(passed === 5 ? 0 : 1);
})().catch(async e => {
  console.error('FAIL folderguard-v532', e && e.stack || e);
  try { await browser.close(); } catch (_) {}
  if (altServer) altServer.close();
  process.exit(1);
});

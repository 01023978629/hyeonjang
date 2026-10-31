/* v530 📱 다른 기기 최신 자료 자동 반영 — 10/31 대표 "모바일로 접속했을 때 최신 자료로 보여지는지 확인하고 검토".
   전제: tests/mock-relay.js(8398) + tests/static-server.js(8299). 합성 자료만(현장 이름은 가짜), 서버는 mock.
   PC 와 폰(390·iPhone) 두 기기가 같은 mock relay 를 쓴다.
   ① 처음 쓰는 폰(hj_relay_unsynced 없음)은 예전처럼 배너 · 배너 단추 44px · [불러오기] 뒤 '다 올림'(0)·이 기기 저장본에도 남음 (FIRST)
   ② PC 가 또 저장 → 폰을 다시 열면 배너 없이 자동으로 최신(안전판 먼저 · 안내 토스트 · rev 따라감) (BOOT)
   ③ 폰에 서버로 못 올린 변경이 있으면 자동으로 받지 않는다 — 충돌 창(사람이 고름) · 폰 변경 그대로 · ① 서버 데이터 사용으로 정리(폰 변경은 안전판, 배너도 내림) (UNSYNCED)
   ④ 앱을 다시 볼 때(visibilitychange) 자동으로 최신 · 창이 떠 있으면 자동 대신 배너 (RESUME)
   ⑤ 지난번에 못 올린 변경(3초 안에 닫힘)은 서버가 그대로면 부팅 때 바로 올린다 (LEFTOVER)
   ⑥ 소스·핀 3곳(v530 이상·서로 같음) · 페이지 오류 0
   HJ_V530_BASELINE=<commit> 은 ① 에서, HJ_V530_MUTATION=no-ff(자동 반영 끔) 는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
let APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398', TOKEN = 'test-token-123', ALT_PORT = 8301;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V530_BASELINE ? execFileSync('git', ['show', process.env.HJ_V530_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V530_MUTATION === 'no-ff') {
  const from = "  if(!block){\n    const r=await relayLoadApply(true,'다른 기기 자료 자동 반영 전'";
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, "  if(false){\n    const r=await relayLoadApply(true,'다른 기기 자료 자동 반영 전'");
}
// 기준선·변이 index.html 은 따로 띄운 로컬 서버(8301)가 준다 — route.fulfill 로 준 문서는 크롬이 'unknown' 주소로 보고
// localhost(mock relay) 요청을 로컬 네트워크 접근 규칙으로 막는다(실제 앱과 다른 이유로 실패).
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
const names = st => ((st.data && st.data.projects) || []).map(p => p.name);

let browser, passed = 0;
const errors = [];
async function device(phone) {
  const context = await browser.newContext(phone ? { serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE, timezoneId: 'Asia/Seoul' }
    : { serviceWorkers: 'block', viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
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
  await booted(page);
  return { context, page };
}
async function booted(page) {
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
}
const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
const addProject = (page, name) => page.evaluate(({ p }) => { state.projects.push(p); markDirty(); }, { p: P(name) });
const projNames = page => page.evaluate(() => (state.projects || []).map(p => p.name));
const snaps = page => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).map(s => s.label));

(async () => {
  await fetch(MOCK + '/__reset');
  if (html) await startAlt();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS relaysync-v530 ' + name); }
  // PC: 서버 연결 → 현장 하나 저장(rev 1)
  const pc = await device(false);
  await pc.page.evaluate(async ({ url, token }) => { await idbSet('relay_url', url); await idbSet('relay_token', token); await relayBoot(); }, { url: MOCK, token: TOKEN });
  await addProject(pc.page, '가온아파트');
  await pollMock(st => st.revision === 1, 12000, 'pc rev 1');
  const phone = await device(true);
  const pm = phone.page;

  await test('① 처음 쓰는 폰은 예전처럼 배너 · 44px · 불러오기 뒤 다 올림·기기 저장 (FIRST)', async () => {
    const pcFlag = await pc.page.evaluate(() => ({ mem: __relayUnsynced, ls: localStorage.getItem('hj_relay_unsynced') }));
    assert.deepEqual(pcFlag, { mem: 0, ls: '0' }, 'PC after a successful save is synced');
    await pm.evaluate(async ({ url, token }) => { await idbSet('relay_url', url); await idbSet('relay_token', token); await relayBoot(); }, { url: MOCK, token: TOKEN });
    await pm.waitForSelector('#relayNewBar');
    const sizes = await pm.evaluate(() => ['#relayNewGo', '#relayNewX'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().height)));
    assert(sizes.every(h => h >= 44), 'banner buttons ≥ 44px ' + JSON.stringify(sizes));
    assert.deepEqual(await projNames(pm), [], 'unknown device is not auto-applied');
    await pm.click('#relayNewGo');
    await pm.waitForFunction(() => state.projects.some(p => p.name === '가온아파트'));
    const r = await pm.evaluate(async () => { const saved = await idbGet('appState'); return { rev: __relay.rev, mem: __relayUnsynced, ls: localStorage.getItem('hj_relay_unsynced'), stored: saved && Array.isArray(saved.projects) ? saved.projects.map(p => p.name) : null }; });
    assert(r.rev === 1 && r.mem === 0 && r.ls === '0', 'FIRST synced after load ' + JSON.stringify(r));
    assert(!r.stored || r.stored.includes('가온아파트'), 'FIRST applied data stored on the device ' + JSON.stringify(r.stored));
  });

  await test('② PC 가 또 저장 → 폰을 다시 열면 자동으로 최신(안전판 먼저·토스트·rev) (BOOT)', async () => {
    await addProject(pc.page, '나래아파트');
    await pollMock(st => st.revision === 2 && names(st).includes('나래아파트'), 12000, 'pc rev 2');
    await pm.reload({ waitUntil: 'domcontentloaded' });
    await booted(pm);
    await pm.waitForFunction(() => state.projects.some(p => p.name === '나래아파트'), null, { timeout: 8000 }).catch(() => {});
    const r = await pm.evaluate(() => ({ names: state.projects.map(p => p.name), bar: !!document.getElementById('relayNewBar'), rev: __relay.rev, toast: document.getElementById('toast').textContent, mem: __relayUnsynced }));
    assert(r.names.includes('나래아파트') && !r.bar && r.rev === 2 && r.mem === 0, 'BOOT auto applied without banner ' + JSON.stringify(r));
    assert.match(r.toast, /다른 기기에서 저장한 최신 자료로 바꿨어요/);
    assert((await snaps(pm)).includes('다른 기기 자료 자동 반영 전'), 'BOOT snapshot before applying');
  });

  await test('③ 폰에 못 올린 변경이 있으면 자동으로 안 받는다 — 충돌 창 · 폰 변경 그대로 (UNSYNCED)', async () => {
    const block = u => String(u).startsWith(MOCK);
    await pm.route(block, r => r.abort());
    await addProject(pm, '폰에서추가');
    await pm.waitForFunction(async () => ((await idbGet('relay_queue')) || []).length === 1 ? true : false, null, { timeout: 12000 }).catch(() => {});
    await pm.evaluate(async () => { for (let i = 0; i < 400; i++) { if (((await idbGet('relay_queue')) || []).length >= 1) return; await new Promise(r => setTimeout(r, 25)); } throw new Error('save was not queued'); });
    await pm.unroute(block);
    await addProject(pc.page, '다솜아파트');
    await pollMock(st => st.revision === 3, 12000, 'pc rev 3');
    await pm.reload({ waitUntil: 'domcontentloaded' });
    await booted(pm);
    await pm.waitForSelector('#ryConflictBox', { timeout: 12000 });
    const r = await pm.evaluate(() => ({ names: state.projects.map(p => p.name), rev: __relay.rev }));
    assert(r.names.includes('폰에서추가') && !r.names.includes('다솜아파트') && r.rev === 2, 'UNSYNCED keeps the phone edit, no auto apply ' + JSON.stringify(r));
    await pm.click('#modalRoot .mfoot button:nth-child(1)');   // ① 서버 데이터 사용
    await pm.waitForFunction(() => state.projects.some(p => p.name === '다솜아파트'));
    const after = await pm.evaluate(() => ({ names: state.projects.map(p => p.name), rev: __relay.rev, mem: __relayUnsynced, bar: !!document.getElementById('relayNewBar') }));
    assert(after.rev === 3 && after.mem === 0 && !after.names.includes('폰에서추가') && !after.bar, 'UNSYNCED resolved by ① — stale banner removed too ' + JSON.stringify(after));
    assert((await snaps(pm)).includes('충돌-서버적용 전'), 'UNSYNCED phone edit kept in a snapshot');
  });

  await test('④ 다시 볼 때 자동으로 최신 · 창이 떠 있으면 배너 (RESUME)', async () => {
    await addProject(pc.page, '라온아파트');
    await pollMock(st => st.revision === 4, 12000, 'pc rev 4');
    await pm.evaluate(() => { __relayResumeAt = 0; document.dispatchEvent(new Event('visibilitychange')); });
    await pm.waitForFunction(() => state.projects.some(p => p.name === '라온아파트'), null, { timeout: 10000 });
    assert.equal(await pm.evaluate(() => __relay.rev), 4);
    // 1분 안에는 다시 묻지 않는다
    const thr = await pm.evaluate(async () => relayResumeCheck());
    assert.equal(thr, '', 'RESUME throttled within a minute');
    // 창이 떠 있으면 자동 대신 배너
    await pm.evaluate(() => openModal('시험 창', '<p>입력 중</p>'));
    await addProject(pc.page, '마루아파트');
    await pollMock(st => st.revision === 5, 12000, 'pc rev 5');
    const r = await pm.evaluate(async () => { __relayResumeAt = 0; const out = await relayResumeCheck(); return { out, names: state.projects.map(p => p.name), bar: !!document.getElementById('relayNewBar') }; });
    assert(r.out === 'banner' && r.bar && !r.names.includes('마루아파트'), 'RESUME with a modal open → banner only ' + JSON.stringify(r));
    await pm.evaluate(() => { closeModal(); document.getElementById('relayNewX').click(); });
  });

  await test('⑤ 지난번에 못 올린 변경은 서버가 그대로면 부팅 때 바로 올린다 (LEFTOVER)', async () => {
    await pm.evaluate(async () => { await relayLoadApply(true); });   // rev 5 로 맞춤
    assert.equal(await pm.evaluate(() => __relay.rev), 5);
    // 변경을 기기에만 저장하고(3초 디바운스 전에 닫힌 것처럼) 서버로는 보내지 않는다
    await pm.evaluate(async p => { state.projects.push(p); relayMarkUnsynced(); await guardedPersistCurrentState(); }, P('남은변경'));
    const before = (await mockState()).revision;
    await pm.reload({ waitUntil: 'domcontentloaded' });
    await booted(pm);
    const st = await pollMock(s => s.revision === before + 1, 12000, 'leftover pushed');
    assert(names(st).includes('남은변경') && names(st).includes('마루아파트'), 'LEFTOVER pushed with server data intact ' + JSON.stringify(names(st)));
    const r = await pm.evaluate(() => ({ mem: __relayUnsynced, ls: localStorage.getItem('hj_relay_unsynced'), rev: __relay.rev }));
    assert(r.mem === 0 && r.ls === '0' && r.rev === before + 1, 'LEFTOVER synced ' + JSON.stringify(r));
  });

  await test('⑥ 소스·핀 3곳(v530 이상·서로 같음) · 페이지 오류 0', async () => {
    assert.match(SRC, /try\{relayResumeCheck\(\)\.catch\(\(\)=>\{\}\);\}catch\(e\)\{\}\}\}\);   \/\/ v530/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 530, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await phone.context.close(); await pc.context.close();
    assert.deepEqual(errors, []);
  });

  console.log(`relaysync-v530: ${passed}/${passed} PASS; synthetic data; mock relay only`);
})().catch(async error => { console.error('FAIL relaysync-v530', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); if (altServer) altServer.close(); });

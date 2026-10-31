/* v534 🔒 오래된 창 잠금 — 다른 창이 더 최근에 저장한 창은 서버에도 쓰지 않는다 + 충돌 창의 ② 덮어쓰기를 막는다 + 띠의 [🔄 새로고침].
   10/31 실측: 아침부터 열려 있던 창(옛 자료)이 몇 시간 뒤 서버 충돌 창(서버 rev 899 · 이 창 892)을 띄웠다. 기기 저장(v457)·폴더 저장(v532)은
   문지기가 막았지만 서버 저장(relaySaveNow)·대기열 보내기(cloudFlushQueue)·충돌 창 ② 는 문지기가 없어, ② 를 누르면 그날 작업이 옛 자료로 서버까지 덮일 수 있었다.
   전제: tests/static-server.js(8299) + tests/mock-relay.js(8398). 같은 브라우저의 두 창(A 아침 · B 오후). 합성 자료만.
   ① A(오래된 창)의 수정 → 서버 저장 0 · 상태 '🔒 오래된 창' · 띠에 [🔄 안전판 보관하고 새로고침] · '안 올린 변경' 표시 안 남김 · 수동 저장·대기열 보내기도 0 → B(최신 창)가 보냄 (SERVER)
   ② 다시 보면 띠가 바로 · A 의 충돌 창: ② 없음·[🔄 새로고침]만 · B(최신)의 충돌 창은 ①②③ 그대로 · 창이 떠 있는 사이 오래돼도 ② 는 서버·기준 revision 을 바꾸지 않음 · A 에서 서버 불러오기 적용도 안 함 (CONFLICT)
   ③ 띠의 [🔄 새로고침] → 🛡 안전판(이 창 자료·늦은 수정 포함) → 창 닫기 경고 없이 다시 열림 → B 의 최신 자료 · 오래된 창 풀림 (RELOAD)
   ④ 소스·핀 3곳(v534 이상·서로 같음) · 페이지 오류 0
   HJ_V534_BASELINE=<commit>(v533) 과 변이 no-relay-guard 는 ①, two-in-stale 은 ②, no-bypass 는 ③ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
let APP = 'http://localhost:8299/index.html';
const MOCK = 'http://localhost:8398', TOKEN = 'test-token-123', ALT_PORT = 8304;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V534_BASELINE ? execFileSync('git', ['show', process.env.HJ_V534_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-relay-guard': ["  if(typeof __tabStale!=='undefined'&&__tabStale){relaySetStatus('stale');try{multiTabStaleWarn();}catch(e){}if(manual)toast(", "  if(false){relaySetStatus('stale');try{multiTabStaleWarn();}catch(e){}if(manual)toast("],
  'two-in-stale': ["  if(typeof __tabStale!=='undefined'&&__tabStale){\n    openModal('⚠️ 저장 충돌 — 이 창은 오래된 자료예요',", "  if(false){\n    openModal('⚠️ 저장 충돌 — 이 창은 오래된 자료예요',"],
  'no-bypass': ["window.addEventListener('beforeunload',e=>{if(window.__hjStaleReload)return;", "window.addEventListener('beforeunload',e=>{"]
}[process.env.HJ_V534_MUTATION || ''];
if (process.env.HJ_V534_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V534_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}
// 기준선·변이 index.html 은 따로 띄운 로컬 서버가 준다(route.fulfill 문서는 mock relay(localhost) 요청이 로컬 네트워크 규칙에 막힌다 — relaysync-v530 과 같은 이유)
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
async function pollMock(pred, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const st = await mockState(); if (pred(st)) return st; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('pollMock timeout: ' + label + ' — rev=' + (await mockState()).revision);
}
let browser, passed = 0;
const errors = [], unloadDialogs = { A: 0, B: 0 };
async function booted(page) {
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
}
async function openPage(context, label) {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(label + ': ' + String(e)));
  page.on('dialog', d => { if (d.type() === 'beforeunload') { unloadDialogs[label]++; return d.accept(); } errors.push(label + ' dialog:' + d.type() + ' ' + d.message()); d.dismiss(); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await booted(page);
  return page;
}
const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
const names = page => page.evaluate(() => (state.projects || []).map(p => p.name).sort());
const quiet = page => page.waitForFunction(() => !__hjLocalSavePending && !__relaySaving, null, { timeout: 15000 });
// 부팅 뒤 스스로 markDirty 하는 일(일정 채우기·백업 점검·카톡 확인·AI 점검)을 멈춘다 — 서버 저장 횟수를 결정적으로 세려고
const settle = page => page.evaluate(() => { window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0; aiOpsEnsureState().enabled = false; });
async function stable(ms) { let last = (await mockState()).revision, t = Date.now(); while (Date.now() - t < ms) { await new Promise(r => setTimeout(r, 250)); const rv = (await mockState()).revision; if (rv !== last) { last = rv; t = Date.now(); } } return last; }
const serverNames = st => ((st.data && st.data.projects) || []).map(p => p.name).sort();

(async () => {
  await fetch(MOCK + '/__reset');
  if (html) await startAlt();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS stalelock-v534 ' + name); }
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
  await context.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(MOCK) || u.startsWith(new URL(APP).origin + '/')) return route.continue();
    return route.abort('blockedbyclient');
  });
  await context.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });

  // 아침 창 A: 서버 연결 → 현장 하나 저장(rev 1)
  const a = await openPage(context, 'A');
  await settle(a);
  await a.evaluate(async ({ url, token }) => { await idbSet('relay_url', url); await idbSet('relay_token', token); await relayBoot(); }, { url: MOCK, token: TOKEN });
  await a.evaluate(({ p }) => { state.projects.push(p); markDirty(); }, { p: P('가온아파트') });
  await pollMock(st => serverNames(st).includes('가온아파트'), 12000, 'A saved');
  await quiet(a); await stable(2500);
  // 오후 창 B: 같은 기기 자료를 열어 현장을 더하고 저장(rev 2) — A 는 B 의 저장 방송으로 '오래된 창'이 된다
  const b = await openPage(context, 'B');
  await settle(b);
  await b.evaluate(({ p }) => { state.projects.push(p); markDirty(); }, { p: P('나래아파트') });
  await pollMock(st => serverNames(st).includes('나래아파트'), 12000, 'B saved');
  await quiet(b); await stable(2500);
  await a.waitForFunction(() => __tabStale === true, null, { timeout: 10000 });

  await test('① 오래된 창의 수정 → 서버 저장 0 · 🔒 상태 · 띠 [🔄 새로고침] · 안 올린 변경 표시 없음 · 수동·대기열도 0 → 최신 창이 보냄 (SERVER)', async () => {
    const s0 = await mockState();
    const flag0 = await a.evaluate(() => localStorage.getItem('hj_relay_unsynced'));
    await a.evaluate(({ p }) => { state.projects.push(p); markDirty(); }, { p: P('A늦은현장') });
    await a.waitForTimeout(4500);   // 자동 저장(3초)이 지나도록
    const s1 = await mockState();
    assert(!serverNames(s1).includes('A늦은현장'), "the stale tab's data never reaches the server " + JSON.stringify(serverNames(s1)));
    assert.equal(s1.saves.length, s0.saves.length, 'stale tab must not save to the server ' + JSON.stringify([s0.revision, s1.revision, s1.saves.slice(-1)]));
    const ui = await a.evaluate(() => { const act = document.getElementById('hjTabWarnAct'); return { rs: __relayState, stat: (document.getElementById('relayStat') || {}).textContent || '', msg: (document.getElementById('hjTabWarnMsg') || {}).textContent || '', act: act ? act.textContent : '', h: act ? Math.round(act.getBoundingClientRect().height) : 0, flag: localStorage.getItem('hj_relay_unsynced'), modal: !!document.querySelector('#modalRoot .modal') }; });
    assert(ui.rs === 'stale' && /🔒 오래된 창/.test(ui.stat), 'status shows the lock ' + JSON.stringify(ui));
    assert(/자동저장을 멈췄/.test(ui.msg) && /안전판 보관하고 새로고침/.test(ui.act) && ui.h >= 40, 'banner with reload action ' + JSON.stringify(ui));
    assert.equal(ui.flag, flag0, "stale tab leaves the shared '안 올린 변경' flag alone");
    assert.equal(ui.modal, false, 'no conflict window is raised by a stale tab');
    // 수동 저장·대기열 보내기도 막힌다 — 대기열 save 는 보내는 순간의 serializeData() 라 오래된 창이 보내면 옛 자료가 올라간다
    const man = await a.evaluate(async () => { const ok = await relaySaveNow(true); await relayQueuePush('save'); await cloudFlushQueue(true); return { ok, toast: document.getElementById('toast').textContent, q: ((await idbGet('relay_queue')) || []).filter(it => it.action === 'save').length }; });
    const s2 = await mockState();
    assert(man.ok === false && /오래된 자료라 서버에 올리지 않았어요/.test(man.toast) && man.q === 1 && s2.saves.length === s0.saves.length, 'manual save & queue flush blocked in the stale tab ' + JSON.stringify(man));
    // 최신 창 B 는 그 대기열을 보낸다(B 의 자료 — 오래된 창의 늦은 현장은 없음)
    await b.evaluate(async () => { await cloudFlushQueue(true); });
    const s3 = await pollMock(st => st.saves.length === s2.saves.length + 1, 12000, 'B flush');
    assert.deepEqual(serverNames(s3), ['가온아파트', '나래아파트'], 'fresh tab sent its own data');
    assert.equal(await b.evaluate(async () => ((await idbGet('relay_queue')) || []).filter(it => it.action === 'save').length), 0, 'queue drained by the fresh tab');
    await quiet(b);
  });

  await test('② 충돌 창 — 오래된 창은 ② 없이 [🔄 새로고침] · 최신 창은 ①②③ · 떠 있는 사이 오래되면 ② 는 서버·기준 rev 그대로 · 불러오기 적용 안 함 (CONFLICT)', async () => {
    // 방송만 받은 상태(띠 없음)로 그 창을 다시 보면 띠가 바로 뜬다 — 옛 자료를 보며 일하지 않게
    const vis = await b.evaluate(() => { const had = !!document.getElementById('hjTabWarnAct'); __tabStale = true; document.dispatchEvent(new Event('visibilitychange')); const now = !!document.getElementById('hjTabWarnAct'); __tabStale = false; return { had, now }; });
    assert.deepEqual(vis, { had: false, now: true }, 'returning to a stale tab shows the reload banner right away');
    const res = { ok: false, error: 'conflict', serverRevision: 9, serverModifiedAt: new Date().toISOString(), serverSavedBy: 'pc-test' };
    const sa = await a.evaluate(r => { closeModal(); relayConflictModal(r); return { stale: !!document.querySelector('#ryConflictBox[data-stale-conflict]'), title: document.querySelector('#modalRoot .modal h3').textContent, btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.textContent.trim()), compare: !!document.getElementById('ryConflictCompare') }; }, res);
    assert(sa.stale && /오래된 자료/.test(sa.title) && sa.compare, 'stale conflict window ' + JSON.stringify(sa));
    assert.deepEqual(sa.btns, ['닫기', '🔄 안전판 보관하고 새로고침'], 'no overwrite button in a stale tab ' + JSON.stringify(sa.btns));
    await a.evaluate(() => closeModal());
    const sb = await b.evaluate(r => { closeModal(); relayConflictModal(r); return [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.textContent.trim().slice(0, 1)); }, res);
    assert.deepEqual(sb, ['①', '②', '③'], 'fresh tab keeps the three choices');
    // 창이 떠 있는 사이 B 도 오래된 창이 되면(다른 창이 저장) — ② 를 눌러도 서버·기준 revision 을 건드리지 않는다
    const s0 = await mockState();
    const rev0 = await b.evaluate(async () => ({ mem: __relay.rev, idb: await idbGet('relay_rev') }));
    await b.evaluate(() => { __tabStale = true; });
    await b.click('#modalRoot .mfoot button:nth-child(2)');
    await b.waitForTimeout(800);
    const after = await b.evaluate(async () => ({ mem: __relay.rev, idb: await idbGet('relay_rev'), toast: document.getElementById('toast').textContent }));
    const s1 = await mockState();
    assert(s1.saves.length === s0.saves.length && after.mem === rev0.mem && after.idb === rev0.idb && /덮어쓰지 않았어요/.test(after.toast), '② in a tab that went stale changes nothing ' + JSON.stringify([rev0, after, s0.saves.length, s1.saves.length]));
    await b.evaluate(() => { __tabStale = false; });   // B 는 실제로는 최신 창 — 흉내만 되돌린다
    // 오래된 창에서 서버 자료를 불러와 적용하지 않는다(적용해도 기기에 저장되지 않고 기준 revision 만 남는다)
    const l0 = (await mockState()).loads;
    const la = await a.evaluate(async () => { const before = state.projects.map(p => p.name).sort(); const relayRev = await idbGet('relay_rev'); const ok = await relayLoadApply(false); return { ok, same: JSON.stringify(state.projects.map(p => p.name).sort()) === JSON.stringify(before), revSame: (await idbGet('relay_rev')) === relayRev, toast: document.getElementById('toast').textContent }; });
    const l1 = (await mockState()).loads;
    assert(la.ok === false && la.same && la.revSame && l1 === l0 && /서버 자료를 여기에 적용하지 않았어요/.test(la.toast), 'no server apply in a stale tab ' + JSON.stringify([la, l0, l1]));
  });

  await test('③ 띠의 [🔄 새로고침] → 🛡 안전판(늦은 수정 포함) → 창 닫기 경고 없이 다시 열림 → 최신 자료 · 오래된 창 풀림 (RELOAD)', async () => {
    // 폴더를 연 창처럼(저장 안 된 변경 + 폴더) — 그냥 새로고침이면 '사이트에서 나가시겠습니까?'가 뜨는 상태
    await a.evaluate(() => { state.dirHandle = { kind: 'directory', name: '만물' }; state.dirty = true; });
    const nav = a.waitForEvent('load', { timeout: 15000 });
    await a.click('#hjTabWarnAct');
    await nav;
    await booted(a);
    const r = await a.evaluate(async () => { const snaps = (await idbGet('hj_snaps')) || []; const s = snaps.filter(x => x.label === '오래된 창 자료(새로고침 전)').slice(-1)[0]; return { stale: __tabStale, names: state.projects.map(p => p.name).sort(), snap: s ? s.data.projects.map(p => p.name).sort() : null }; });
    assert.equal(unloadDialogs.A, 0, 'reload from the lock banner must not ask "leave site?"');
    assert.deepEqual(r.snap, ['A늦은현장', '가온아파트'], "the 🛡 snapshot holds the stale tab's own data incl. its unsaved edit " + JSON.stringify(r));
    assert(r.stale === false && JSON.stringify(r.names) === JSON.stringify(['가온아파트', '나래아파트']), 'reopened with the latest data, lock released ' + JSON.stringify(r));
  });

  await test('④ 소스·핀 3곳(v534 이상·서로 같음) · 페이지 오류 0', async () => {
    assert.match(SRC, /async function hjStaleReload\(\)\{/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 534, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []);
  });

  console.log(`stalelock-v534: ${passed}/${passed} passed; synthetic data; mock relay only`);
})().catch(error => { console.error('FAIL stalelock-v534', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); if (altServer) altServer.close(); });

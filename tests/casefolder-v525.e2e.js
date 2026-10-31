/* v525 '사례 작성' 폴더 제외 — 10/30 대표 결정("빼"). 홍보 글용 사진·파일 모음(10/30 실측 56건: 사진 38 + 기타 18, 그중 미배정 사진 30)이
   현장 배정 대상으로 잡혀 미배정 수·추측 배정·건강 줄을 흐렸다. 합성 자료만, 바깥 쓰기 0.
   ① isAppOwnFile: 맨 위 '사례 작성…' 폴더 아래 파일은 앱이 관리하지 않는 파일(어느 깊이든). '사례 작성.jpg' 같은 사진 이름·_정리완료 안의 현장 이름은 아님 (RULE)
   ② applyData(부팅·병합): 저장본에 든 사례 작성 기록 3건(배정 1 포함)은 되살리지 않고, 보통 사진 2장은 그대로. 저장 표시 + 안내 1회 · 건강 줄 미배정 수 (APPLY)
   ③ applyData(되돌리기)도 같은 규칙, 안내는 없음 (REVERT)
   ④ walk: 맨 위 '사례 작성' 폴더는 들어가지 않고 __walkSkip 에 남긴다(안의 파일을 읽지 않음) · 현장사진 폴더는 들어간다 (WALK)
   ⑤ 소스: 스캔 뒤 자가치유 필터가 그대로 있고(기록 제거), 핀 3곳 v525 · 오류 0 · 바깥 쓰기 0
   HJ_V525_BASELINE=<commit> 은 ① 에서, HJ_V525_MUTATION=no-heal 은 ② 에서 실패해야 한다. */
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
let html = process.env.HJ_V525_BASELINE ? execFileSync('git', ['show', process.env.HJ_V525_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V525_MUTATION === 'no-heal') {
  const from = '    if(isAppOwnFile(s.name,s.prefix)){__appOwnSkipped++;return;}\n';
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}
// 저장본(serializeData 모양) — 사례 작성 3건(사진 2 + html 1, 사진 1장은 현장 있음) + 현장사진 2장(1장 미배정)
const SAVED = () => ({
  version: 2, app: '현장', savedAt: '2026-10-30T05:00:00.000Z',
  projects: [{ name: '가온', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }],
  files: [
    { key: 'k1', name: 'IMG_0001.jpg', prefix: '사례 작성/2026-08-18_문화동/', kind: 'photo', project: '', text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: '', phase: null, worklabel: null, gdFolder: null, driveId: null, size: 1200, lat: null, lng: null, when: '2026-10-10T01:00:00.000Z' },
    { key: 'k2', name: 'IMG_0002.jpg', prefix: '사례 작성/2026-08-18_문화동/web/assets/cases/', kind: 'photo', project: '가온', text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: '', phase: '방수', worklabel: null, gdFolder: null, driveId: null, size: 1300, lat: null, lng: null, when: '2026-10-10T01:05:00.000Z' },
    { key: 'k3', name: 'index.html', prefix: '사례 작성/2026-08-18_문화동/web/', kind: 'other', project: '', text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: '', phase: null, worklabel: null, gdFolder: null, driveId: null, size: 500, lat: null, lng: null, when: null },
    { key: 'k4', name: 'IMG_0101.jpg', prefix: '현장사진/', kind: 'photo', project: '', text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: '', phase: null, worklabel: null, gdFolder: null, driveId: null, size: 2200, lat: 36.35, lng: 127.38, when: '2026-10-07T01:00:00.000Z' },
    { key: 'k5', name: 'IMG_0102.jpg', prefix: '_정리완료/가온/방수/', kind: 'photo', project: '가온', text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: '', phase: '방수', worklabel: null, gdFolder: null, driveId: null, size: 2300, lat: 36.35, lng: 127.38, when: '2026-10-07T01:05:00.000Z' },
  ],
  quotes: [], schedule: [], notes: [], payLog: [], expenses: [],
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS casefolder-v525 ' + name); }
  const { context, page } = await openPage();

  await test('① isAppOwnFile — 맨 위 사례 작성 폴더만, 어느 깊이든 (RULE)', async () => {
    const r = await page.evaluate(() => [
      isAppOwnFile('IMG_0001.jpg', '사례 작성/'), isAppOwnFile('IMG_0001.jpg', '사례 작성/2026-08-18_문화동/web/assets/cases/'), isAppOwnFile('index.html', '사례 작성 2차/x/'),
      isAppOwnFile('사례 작성.jpg', '현장사진/'), isAppOwnFile('IMG_0001.jpg', '_정리완료/사례 작성 현장/방수/'), isAppOwnFile('IMG_0001.jpg', '현장사진/사례 작성/'),
      isAppOwnFile('IMG_0001.jpg', '사례 작성/'.normalize('NFD')),
    ]);
    assert.deepEqual(r, [true, true, true, false, false, false, true], 'RULE ' + JSON.stringify(r));
  });

  await test('② applyData(부팅·병합): 사례 작성 기록 3건 제외 · 보통 2장 유지 · 저장 표시 · 안내 1회 · 건강 줄 (APPLY)', async () => {
    const r = await page.evaluate(async (saved) => {
      state.files = []; state.projects = []; state.dirty = false; window.__appOwnSkipped = 0; window.__appOwnToasted = false;
      const n = applyData(saved);
      await new Promise(r => setTimeout(r, 50));
      const dirtyAfterTick = state.dirty;
      await new Promise(r => setTimeout(r, 1700));
      return { n, names: state.files.map(f => f.prefix + f.name).sort(), skipped: window.__appOwnSkipped, dirtyAfterTick, toast: document.getElementById('toast').textContent, health: hjHealthData().photo, unassigned: state.files.filter(f => f.kind === 'photo' && !f.project).length };
    }, SAVED());
    assert.deepEqual(r.names, ['_정리완료/가온/방수/IMG_0102.jpg', '현장사진/IMG_0101.jpg'], 'APPLY only normal records restored ' + JSON.stringify(r));
    assert(r.n === 2 && r.skipped === 3 && r.dirtyAfterTick === true, 'APPLY restored 2, skipped 3, marked dirty ' + JSON.stringify(r));
    assert.match(r.toast, /앱이 관리하지 않는 폴더\(사례 작성·백업 등\)의 기록 3건을 목록에서 뺐습니다/, 'APPLY toast ' + r.toast);
    assert(r.health === 1 && r.unassigned === 1, 'health line counts only the real unassigned photo ' + JSON.stringify(r));
  });

  await test('③ applyData(되돌리기)도 같은 규칙, 안내 없음 (REVERT)', async () => {
    const r = await page.evaluate(async (saved) => {
      const t = document.getElementById('toast'); t.textContent = ''; window.__appOwnToasted = true; window.__appOwnSkipped = 0;
      const n = applyData(saved, { revert: true });
      await new Promise(r => setTimeout(r, 1700));
      return { n, count: state.files.length, caseLeft: state.files.filter(f => /^사례 작성\//.test(f.prefix)).length, skipped: window.__appOwnSkipped, toast: t.textContent };
    }, SAVED());
    assert(r.caseLeft === 0 && r.count === 2 && r.skipped === 3, 'REVERT ' + JSON.stringify(r));
    assert(!/목록에서 뺐습니다/.test(r.toast), 'REVERT no second toast ' + r.toast);
  });

  await test('④ walk: 맨 위 사례 작성 폴더는 들어가지 않는다 · 현장사진은 들어간다 (WALK)', async () => {
    const r = await page.evaluate(async () => {
      window.__walkDirs = new Set(); window.__walkSaw = new Set(); window.__walkFailed = new Set(); window.__walkSkip = new Set();
      const entered = [];
      const dir = (name, children) => ({ kind: 'directory', name, async *entries() { entered.push(name); for (const c of children) yield [c.name, c]; } });
      const root = dir('만물', [dir('사례 작성', [dir('2026-08-18_문화동', [])]), dir('현장사진', [dir('사례 작성', [])]), dir('_백업', [])]);
      await walk(root, '');
      return { entered, skip: [...window.__walkSkip], dirs: [...window.__walkDirs] };
    });
    assert(r.entered.includes('만물') && r.entered.includes('현장사진') && !r.entered.includes('2026-08-18_문화동'), 'WALK top-level case folder not entered ' + JSON.stringify(r));
    assert(r.skip.includes('사례 작성/') && r.skip.includes('_백업/') && !r.skip.includes('현장사진/사례 작성/'), 'WALK skip set ' + JSON.stringify(r));
    assert(r.dirs.includes('현장사진/') && r.dirs.includes('현장사진/사례 작성/'), 'WALK a same-named folder under 현장사진 is still walked ' + JSON.stringify(r));
  });

  await test('⑤ 소스: 스캔 뒤 자가치유 필터 유지 · 핀 3곳 v525 · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /state\.files=\(state\.files\|\|\[\]\)\.filter\(function\(f\)\{return !isAppOwnFile\(f\.name,f\.prefix\);\}\);/, 'post-scan self-heal filter still removes app-own records');
    // v526 부터: 핀은 판마다 바뀐다 — v525 이상이고 세 곳이 같은지만 본다(이 검사가 다음 판에서 떨어지지 않게)
    const ver = s => { const m = String(s || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    const pins = [ver(pin[0]) >= 525, pin[0] === pin[1], pin[0] === pin[2]];
    assert.deepEqual(pins, [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`casefolder-v525: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL casefolder-v525', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

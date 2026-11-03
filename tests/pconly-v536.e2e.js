/* v536 📵 이 기기에 안 보이는 사진(폴더 없는 기기) · 📑 30일 넘은 협력사 미수(오늘 챙길 일) — 10/31 대표 "계속 진행".
   10/31 검토: 사진 기록 1,272장 중 610장이 PC 폴더에만 있어 폰에서 빈 칸이었다. v531 📤 은 폴더+서버가 연결된 PC 에서만 보여,
   폰에서는 사진이 사라진 것처럼 보였다. v535 로 내역서 경과일을 보게 됐지만, 첫 화면에서 오래된 미수를 알려 주지는 않았다.
   합성 자료만, 바깥 요청 0, 바깥 쓰기 0.
   ① 세기: 서버 사본·이 기기 원본(공유함·핸들·파일) 없는 사진만 · 동영상·문서 빠짐 · 서버 안 쓰는 기기·폴더 연 PC·데모는 0 (COUNT)
   ② 화면(390px): 🩺 줄 '📵 이 기기에 안 보이는 사진 3' → 창(현장별 수·PC 에서 할 일) → [☁️ 최신 자료 확인]이 1분 제한을 풀고 서버 확인 · 자료 그대로 (UI)
   ③ 오늘 챙길 일: 30일 넘은 남은 돈 있는 내역서만 '📑 30일 넘은 협력사 미수 n장 · 금액' · 누르면 견적 작성 탭(장부) (DAILY)
   ④ 소스·핀 3곳(v536 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V536_BASELINE=<commit> 은 ① 에서, HJ_V536_MUTATION=count-inbox(공유함 사진도 셈) 는 ①, no-daily 는 ③ 에서 실패해야 한다. */
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
let html = process.env.HJ_V536_BASELINE ? execFileSync('git', ['show', process.env.HJ_V536_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'count-inbox': ["&&!f._driveId&&!f._shareInboxId&&!f.shareInboxId&&!f.handle&&!f._file);}", "&&!f._driveId&&!f.handle&&!f._file);}"],
  'no-daily': ["  try{const old=hjStmtLedger().filter(s=>s.left>0&&hjStmtAgeDays(s,today)>=30);if(old.length)items.push(", "  try{const old=[];if(old.length)items.push("]
}[process.env.HJ_V536_MUTATION || ''];
if (process.env.HJ_V536_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V536_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS pconly-v536 ' + name); }
  const { context, page } = await openPage();
  // 합성: PC 에만 있는 사진 3(A현장 2·B현장 1) · 서버 사본 있는 사진 · 이 폰 공유함 사진 · 동영상 · 핸들 있는 사진 · 견적 파일
  const SEED = () => page.evaluate(() => {
    const P = name => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
    state.projects = [P('A현장'), P('B현장')];
    state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = [];
    const F = (id, o) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project: 'A현장', size: 100, when: new Date('2026-10-20T01:00:00Z') }, o || {});
    state.files = [F('p1'), F('p2'), F('p3', { project: 'B현장' }), F('d1', { _driveId: 'DRV1' }), F('s1', { _shareInboxId: 'SI1' }), F('v1', { name: 'v1.mp4', ext: 'mp4' }), F('h1', { handle: { kind: 'file' } }), F('e1', { name: 'e1.xlsx', ext: 'xlsx', kind: 'estimate' })];
    state.dirHandle = null; state._demo = false;
    try { closeModal(); } catch (e) {}
  });

  await test('① 세기 — 서버 사본·이 기기 원본 없는 사진만 · 동영상·문서 빠짐 · 서버 없음·폴더 연 PC·데모는 0 (COUNT)', async () => {
    await SEED();
    const r = await page.evaluate(() => {
      const off = hjPcOnlyCount();
      relayReady = () => true;
      const on = hjPcOnlyCount(), ids = hjPcOnlyFiles().map(f => f.id);
      state.dirHandle = { kind: 'directory', name: '만물' }; const pc = FS_OK ? hjPcOnlyCount() : 0; state.dirHandle = null;
      state._demo = true; const demo = hjPcOnlyCount(); state._demo = false;
      const before = JSON.stringify(serializeData().files);
      const health = hjHealthData();
      return { off, on, ids, pc, demo, pconly: health.pconly, pcup: health.pcup, same: JSON.stringify(serializeData().files) === before };
    });
    assert.deepEqual(r, { off: 0, on: 3, ids: ['p1', 'p2', 'p3'], pc: 0, demo: 0, pconly: 3, pcup: 0, same: true }, 'COUNT ' + JSON.stringify(r));
  });

  await test('② 화면 390px — 🩺 줄 → 창(현장별·PC 에서 할 일) → [☁️ 최신 자료 확인]이 1분 제한을 풀고 서버 확인 (UI)', async () => {
    await page.evaluate(() => { relayReady = () => true; state.tab = 'dashboard'; state.activeProject = null; state.search = ''; render(); });
    await page.waitForSelector('[data-health="pconly"]');
    const seg = await page.evaluate(() => { const b = document.querySelector('[data-health="pconly"]'); return { t: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(b.getBoundingClientRect().height), line: document.querySelector('[data-health-line]').dataset.healthLine, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    assert(/📵 이 기기에 안 보이는 사진 3/.test(seg.t) && seg.h >= 44 && seg.line === 'todo' && seg.wide <= 0, 'health segment ' + JSON.stringify(seg));
    await page.click('[data-health="pconly"]');
    await page.waitForSelector('[data-pconly-row]');
    const m = await page.evaluate(() => ({ title: document.querySelector('#modalRoot .modal h3').textContent, rows: [...document.querySelectorAll('[data-pconly-row]')].map(r => [...r.children].map(c => c.textContent.trim()).join(' ')), body: document.querySelector('#modalRoot .modal').textContent.replace(/\s+/g, ' '), btns: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()) }));
    assert.match(m.title, /📵 이 기기에 안 보이는 사진 3장/);
    assert.deepEqual(m.rows, ['A현장 2장', 'B현장 1장'], 'per-site counts ' + JSON.stringify(m.rows));
    assert(/사진이 사라진 것은 아닙니다/.test(m.body) && /PC에서 현장 앱을 열고 폴더를 연결/.test(m.body) && /📤 폰에 안 보이는 사진/.test(m.body), 'what to do on the PC ' + m.body);
    assert.deepEqual(m.btns, ['닫기', '☁️ 최신 자료 확인']);
    await page.evaluate(() => { window.__rc = []; __relayResumeAt = Date.now(); relayResumeCheck = async () => { window.__rc.push(__relayResumeAt); return 'same'; }; });
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => window.__rc.length === 1);
    const after = await page.evaluate(() => ({ rc: window.__rc, toast: document.getElementById('toast').textContent, modal: !!document.querySelector('[data-pconly-row]'), files: state.files.length }));
    assert(after.rc[0] === 0 && /이미 서버의 최신 자료예요/.test(after.toast) && !after.modal && after.files === 8, 'manual check bypasses the 1-minute throttle, changes nothing ' + JSON.stringify(after));
  });

  await test('③ 오늘 챙길 일 — 30일 넘은 남은 돈 있는 내역서만 · 누르면 견적 작성 탭 (DAILY)', async () => {
    const r = await page.evaluate(() => {
      relayReady = () => false;
      const ago = n => localDate(new Date(Date.now() - n * 86400000));
      const mk = (src, to, date, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: amts.map((a, i) => ({ d: date, loc: project + ' 작업' + i, work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); };
      state.files = []; localStorage.removeItem('hj_daily_dismiss');
      const none = dailyCheckData().filter(it => it.ic === '📑').length;
      mk('A.xlsx', '시험누수', ago(45), 'A현장', [1490001]);
      mk('B.xlsx', '시험누수', ago(10), 'B현장', [150000]);
      mk('E.xlsx', '시험방수', ago(40), 'B현장', [80000]);
      hjStmtPayApply('E.xlsx', { amt: 80000, d: localDate(), method: '계좌이체' });
      const it = dailyCheckData().find(x => x.ic === '📑');
      return { none, t: it && it.t, act: it && it.act };
    });
    assert.equal(r.none, 0);
    assert.equal(r.t, '30일 넘은 협력사 미수 1장 · 1,490,001원 — 📑 장부에서 미수 안내 글', 'DAILY ' + JSON.stringify(r));
    await page.evaluate(act => { state.tab = 'dashboard'; render(); (0, eval)(act); }, r.act);
    await page.waitForSelector('[data-stmt-ledger] [data-stmtdun]');
    assert.equal(await page.evaluate(() => state.tab), 'quotemaker');
  });

  await test('④ 소스·핀 3곳(v536 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(k==='pconly'\)return hjPcOnlyView\(\);/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 536, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`pconly-v536: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL pconly-v536', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

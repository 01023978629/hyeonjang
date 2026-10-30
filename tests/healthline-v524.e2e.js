/* v524 🩺 자료 건강 줄 — 첫 화면 '오늘 챙길 일' 바로 위 한 줄: 읽지 않은 견적 n · 미배정 사진 n · 중복 후보 n · 백업 n일 전. 누르면 그 도구. 합성 자료만, 바깥 쓰기 0.
   ① 시드(안 읽은 견적 2·미배정 사진 3·중복 후보 1·백업 3일 전) → 줄 글자·숫자·순서, 오늘 챙길 일 카드 '오늘 그만' 뒤에도 남음 (LINE)
   ② 네 단추가 각각 hjEstimateAutoRead · hjPhotoSuggestReview · trimDuplicates · backupNow 를 부른다 (OPEN)
   ③ 다 치우면 '🩺 자료 깨끗' + 백업만 · 백업 7일 넘으면 경고색 · 백업 기록 없으면 '백업 기록 없음' · 자료가 없으면 줄 없음 (CLEAN)
   ④ 중복 후보 세기가 사진의 _dup 표시를 건드리지 않는다 · 폰 390 에서 단추 44px·가로 넘침 없음·줄 높이 두 줄 이하 · 오류 0 (PHONE)
   HJ_V524_BASELINE=<commit> 은 ① 에서, HJ_V524_MUTATION=zero-photo 는 ① 에서 실패해야 한다. */
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
let html = process.env.HJ_V524_BASELINE ? execFileSync('git', ['show', process.env.HJ_V524_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V524_MUTATION === 'zero-photo') {
  const from = "try{d.photo=(state.files||[]).reduce((a,f)=>a+(f&&f.kind==='photo'&&!f.project?1:0),0);}catch(e){}";
  assert(SRC.includes(from), 'mutation anchor');
  html = SRC.replace(from, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width, height, backupAgoDays) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.addInitScript(days => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now() - days * 86400000 - 3600000, kind: 'file' })); }, backupAgoDays);
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}
const SEED = () => {
  const d = s => new Date(s);
  state._demo = false;
  state.projects = [{ name: '가온', stage: 1, phases: ['방수'], cost: {}, customer: {}, archived: false }];
  const ph = (id, project, when, size) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: d(when), size, prefix: '현장사진/' });
  const est = (id, ext) => ({ id, name: id + '.' + ext, ext, kind: 'estimate', project: '가온', prefix: '견적서/', ocr: 'pending', est: null, size: 2000 });
  state.files = [ph('u1', '', '2026-10-07T01:00:00Z', 101), ph('u2', '', '2026-10-07T01:05:00Z', 102), ph('u3', '', '2026-10-08T01:00:00Z', 103),
    ph('a1', '가온', '2026-10-01T01:00:00Z', 500), ph('a2', '가온', '2026-10-01T01:00:00Z', 500),   // 중복 후보 1(크기·촬영 시각 같음)
    est('견적A', 'xlsx'), est('견적B', 'pdf')];
  state.schedule = []; state.quotes = []; state.notes = []; state.expenses = []; state.payLog = []; state.tab = 'dashboard'; state.activeProject = null; state.search = '';
  try { localStorage.removeItem('hj_daily_dismiss'); } catch (e) {}
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const line = page => page.evaluate(() => {
  const el = document.querySelector('[data-health-line]');
  if (!el) return null;
  return { kind: el.dataset.healthLine, text: el.textContent.replace(/\s+/g, ' ').trim(), btns: [...el.querySelectorAll('[data-health]')].map(b => ({ k: b.dataset.health, t: b.textContent.replace(/\s+/g, ' ').trim(), h: Math.round(b.getBoundingClientRect().height), warn: /var\(--warn\)/.test(b.getAttribute('style') || '') })),
    h: Math.round(el.getBoundingClientRect().height), top: Math.round(el.getBoundingClientRect().top), beforeDaily: (() => { const c = [...document.querySelectorAll('#view *')].find(x => /오늘 챙길 일/.test(x.textContent) && x.tagName === 'B'); return c ? el.getBoundingClientRect().top < c.getBoundingClientRect().top : null; })() };
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS healthline-v524 ' + name); }
  const { context, page } = await openPage(1280, 860, 3);
  await page.evaluate(SEED);

  await test('① 줄 글자·숫자·순서 · 오늘 그만 뒤에도 남음 (LINE)', async () => {
    const l = await line(page);
    assert(l, 'LINE health line rendered');
    assert.equal(l.kind, 'todo');
    assert.deepEqual(l.btns.map(b => [b.k, b.t]), [['est', '📄 읽지 않은 견적 2'], ['photo', '📷 미배정 사진 3'], ['dup', '🧹 중복 후보 1'], ['backup', '💾 백업 3일 전']], 'LINE ' + JSON.stringify(l));
    assert(l.beforeDaily === true, 'line sits right above the daily check card ' + JSON.stringify(l));
    await page.evaluate(() => dismissDailyCheck());
    const l2 = await line(page);
    assert(l2 && l2.btns.length === 4 && !(await page.evaluate(() => /오늘 챙길 일/.test(document.getElementById('view').textContent))), 'line stays after dismissing the daily card');
  });

  await test('② 네 단추 → 각 도구 (OPEN)', async () => {
    const calls = await page.evaluate(async () => {
      window.__calls = [];
      const stub = name => { window['__real_' + name] = window[name]; window[name] = (...a) => { window.__calls.push(name + ':' + JSON.stringify(a)); }; };
      ['hjEstimateAutoRead', 'hjPhotoSuggestReview', 'trimDuplicates', 'backupNow'].forEach(stub);
      for (const k of ['est', 'photo', 'dup', 'backup']) { document.querySelector('[data-health="' + k + '"]').click(); await new Promise(r => setTimeout(r, 50)); }
      ['hjEstimateAutoRead', 'hjPhotoSuggestReview', 'trimDuplicates', 'backupNow'].forEach(name => { window[name] = window['__real_' + name]; });
      return window.__calls;
    });
    assert.deepEqual(calls, ['hjEstimateAutoRead:[{"silent":false,"auto":false}]', 'hjPhotoSuggestReview:[{"from":"health"}]', 'trimDuplicates:[]', 'backupNow:[]'], 'OPEN ' + JSON.stringify(calls));
  });

  await test('③ 다 치우면 깨끗 + 백업만 · 7일 넘으면 경고색 · 기록 없음 · 자료 없으면 줄 없음 (CLEAN)', async () => {
    await page.evaluate(() => { state.files.forEach(f => { if (f.kind === 'photo' && !f.project) f.project = '가온'; if (f.kind === 'estimate') { f.ocr = 'done'; f.est = { amount: 1000 }; } }); state.files = state.files.filter(f => f.id !== 'a2'); render(); });
    let l = await line(page);
    assert(l && l.kind === 'clean' && /🩺 자료 깨끗/.test(l.text) && l.btns.length === 1 && l.btns[0].t === '💾 백업 3일 전' && !l.btns[0].warn, 'CLEAN ' + JSON.stringify(l));
    await page.evaluate(() => { localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now() - 8 * 86400000, kind: 'file' })); render(); });
    l = await line(page);
    assert(l.btns[0].t === '💾 백업 8일 전' && l.btns[0].warn, 'backup over 7 days is warn-colored ' + JSON.stringify(l.btns));
    await page.evaluate(() => { localStorage.removeItem('hj_last_backup'); render(); });
    l = await line(page);
    assert(l.btns[0].t === '💾 백업 기록 없음' && l.btns[0].warn, 'no backup record ' + JSON.stringify(l.btns));
    await page.evaluate(() => { state.projects = []; state.files = []; render(); });
    assert.equal(await line(page), null, 'no data → no line');
  });

  await test('④ 세기가 _dup 표시를 안 건드림 · 폰 390 44px·넘침 없음·두 줄 이하 · 오류 0 (PHONE)', async () => {
    await context.close();
    const m = await openPage(390, 844, 3);
    await m.page.evaluate(SEED);
    const r = await m.page.evaluate(() => {
      state.files.forEach(f => { if (f.kind === 'photo') f._dup = 'keep'; });
      const n = hjDupSuspectCount();
      const untouched = state.files.filter(f => f.kind === 'photo').every(f => f._dup === 'keep');
      state.files.forEach(f => { if (f.kind === 'photo') delete f._dup; });
      const el = document.querySelector('[data-health-line]');
      return { n, untouched, h: Math.round(el.getBoundingClientRect().height), minH: Math.min(...[...el.querySelectorAll('[data-health]')].map(b => Math.round(b.getBoundingClientRect().height))), scrollW: document.documentElement.scrollWidth, right: Math.max(...[...el.querySelectorAll('[data-health]')].map(b => Math.round(b.getBoundingClientRect().right))) };
    });
    assert(r.n === 1 && r.untouched, 'counting does not mutate _dup ' + JSON.stringify(r));
    assert(r.minH >= 44 && r.scrollW <= 390 && r.right <= 390 && r.h <= 44 * 2 + 6 + 2, 'PHONE ' + JSON.stringify(r));
    await m.context.close();
    assert.match(SRC, /hjHealthLineHTML\(\)\+dailyCheckCardHTML\(\)/, 'dashboard order: health line right above the daily card');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`healthline-v524: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL healthline-v524', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v498 ⏱ 작업시간 창 '현장' 칸 — 보관한 현장 '(보관)' 표시(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 보관(archived) 현장은 이름 뒤 ' (보관)', 목록 맨 뒤(보관 아닌 것끼리·보관끼리는 최근 기록 순) · 고르면 그 현장 창(값은 이름 그대로)
      · 보관 현장 창에서도 칸이 그 현장을 가리킴 · 복사 글엔 '(보관)' 없음 · 44px · 넘침 없음 · 자료 불변 (ARCH)
   ② 보관 현장이 없으면 v485 그대로(최근 기록 순, 표시 없음) · 전부 보관이면 전부 표시·최근 기록 순 · 오류 0
   HJ_V498_BASELINE=<commit> 은 ARCH 에서 실패해야 한다. HJ_V498_MUTATION=no-archived(보관을 뒤로 안 보냄)도 ARCH 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T36 둔산 크로바아파트 101동 1203호', B = 'TEST_T36 대흥동 상가 2층', C = 'TEST_T36 유천동 주택', D = 'TEST_T36 법동 빌라 3층';
const MUT = process.env.HJ_V498_MUTATION || '';
let html = process.env.HJ_V498_BASELINE ? execFileSync('git', ['show', process.env.HJ_V498_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-archived');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '(archSet.has(a[0])?1:0)-(archSet.has(b[0])?1:0)||';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async ({ A, B, C, D }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n);
    const proj = (name, archived) => ({ name, kind: 'interior', stage: archived ? 3 : 2, phases: ['철거', '타일'], received: 0, archived, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9801', addr: '대전 서구 둔산동' } });
    state.projects = [proj(A, false), proj(B, true), proj(C, false), proj(D, true)];
    let i = 0; const wl = (project, n) => ({ id: 'TEST_W' + (++i), project, date: ago(n), in: '09:00', out: '12:00', memo: '' });
    state.workLogs = [wl(B, 0), wl(A, 1), wl(A, 2), wl(C, 3), wl(D, 4), wl(D, 5), wl('', 2)];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
  }, { A, B, C, D });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlarchived-v498 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const s = m.querySelector('[data-wl-project]');
    return { title: document.getElementById('modalTitle').textContent.trim(), pick: s ? { value: s.value, opts: [...s.options].map(o => o.textContent.trim()), vals: [...s.options].map(o => o.value), h: Math.round(s.getBoundingClientRect().height) } : null,
      rows: m.querySelectorAll('.worklog-row').length, ov: [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth] }; });

  await test('① 보관 현장 \'(보관)\'·맨 뒤 · 고르면 그 현장 창 · 보관 현장 창도 가리킴 · 복사엔 표시 없음 · 넘침 없음 · 자료 불변 (ARCH)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win();
    assert.deepEqual(w.pick.opts, ['전체 · 7줄', A + ' · 2줄', C + ' · 1줄', B + ' (보관) · 1줄', D + ' (보관) · 2줄'], 'ARCH archived last with a label ' + JSON.stringify(w.pick.opts));
    assert.deepEqual(w.pick.vals, ['', A, C, B, D], 'ARCH option values stay the plain names');
    assert.equal(w.pick.h >= 44, true, 'tap target ' + w.pick.h); assert(w.ov.every(x => x <= 1), 'overflow ' + JSON.stringify(w.ov));
    await page.locator('#modalRoot [data-wl-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.doesNotMatch(await page.evaluate(() => window.__copied[0]), /보관/, 'copy text uses plain names');
    await page.locator('#modalRoot [data-wl-project]').selectOption(B);
    await page.waitForFunction(b => document.getElementById('modalTitle')?.textContent.includes(b), B, { timeout: 3000 }).catch(() => {});
    w = await win();
    assert.equal(w.title, '⏱ 작업시간 — ' + B, 'picking an archived project opens it'); assert.equal(w.rows, 1); assert.equal(w.pick.value, B);
    await page.locator('#modalRoot [data-wl-project]').selectOption('');
    await page.waitForFunction(() => document.getElementById('modalTitle')?.textContent.trim() === '⏱ 작업시간');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), D); await page.locator('#modalRoot [data-wl-project]').waitFor();
    w = await win();
    assert.equal(w.pick.value, D, 'archived project window points at itself'); assert.equal(w.pick.opts.at(-1), D + ' (보관) · 2줄'); assert.equal(w.rows, 2);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 보관 없음 → v485 그대로 · 전부 보관 → 전부 표시·최근 순 · 오류 0', async () => {
    await page.evaluate(() => { state.projects.forEach(p => { p.archived = false; }); });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.deepEqual((await win()).pick.opts, ['전체 · 7줄', B + ' · 1줄', A + ' · 2줄', C + ' · 1줄', D + ' · 2줄'], 'no archived → latest record first, no label');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => { state.projects.forEach(p => { p.archived = true; }); });
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.deepEqual((await win()).pick.opts, ['전체 · 7줄', B + ' (보관) · 1줄', A + ' (보관) · 2줄', C + ' (보관) · 1줄', D + ' (보관) · 2줄'], 'all archived → all labelled, latest first');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlarchived-v498: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlarchived-v498', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

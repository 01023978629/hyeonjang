/* v485 ⏱ 작업시간 창 — 현장 고르기(개발_백로그 '작업시간 전체 창에서 현장 고르기'). 합성 자료만, 외부 쓰기 0.
   ① 기록이 있는 현장이 둘 이상이면 맨 위 '현장' 칸(전체 · n줄 + 최근 기록 순 '현장 · m줄', 44px) → 고르면 그 현장 창(제목·줄·위 칸) → '전체'로 복귀
      · 기록 없는 현장 창에서 열면 그 현장이 '· 0줄'로 골라져 있음 · 390px 넘침 없음 · 자료 불변 (PICK)
   ② 기록 있는 현장이 하나뿐이면 칸 없음(전체·현장 창 모두) · 오류 0
   HJ_V485_BASELINE=<commit> 은 PICK 에서 실패해야 한다. HJ_V485_MUTATION=no-pick(골라도 안 바뀜)도 PICK 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T25 둔산 크로바아파트 101동 1203호', B = 'TEST_T25 대흥동 상가 2층', C = 'TEST_T25 유천동 빌라 302호', D = 'TEST_T25 관저동 주택';
const MUT = process.env.HJ_V485_MUTATION || '';
let html = process.env.HJ_V485_BASELINE ? execFileSync('git', ['show', process.env.HJ_V485_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-pick');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(sel)sel.onchange=function(){workView(sel.value||'');};";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'if(sel)sel.onchange=null;');
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
    const proj = name => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8501', addr: '대전 서구 둔산동' } });
    state.projects = [proj(A), proj(B), proj(C), proj(D)];
    let i = 0; const wl = (project, n) => ({ id: 'TEST_W' + (++i), project, date: ago(n), in: '09:00', out: '12:00', memo: '' });
    state.workLogs = [wl(A, 1), wl(A, 2), wl(A, 3), wl(A, 4), wl(A, 5), wl(B, 0), wl(B, 6), wl(B, 7), wl(C, 10), wl('', 2)];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { A, B, C, D });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlpick-v485 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const s = m.querySelector('[data-wl-project]');
    return { title: document.getElementById('modalTitle').textContent.trim(), pick: s ? { value: s.value, opts: [...s.options].map(o => o.textContent.trim()), h: Math.round(s.getBoundingClientRect().height) } : null,
      rows: m.querySelectorAll('.worklog-row').length, days: m.querySelector('.mbody > div').innerText.replace(/\s+/g, ' ').match(/작업 일수 (\d+일)/)?.[1] || '', ov: [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth] }; });

  await test('① 현장 칸 → 고르면 그 현장 창 → 전체로 복귀 · 기록 없는 현장도 가리킴 · 넘침 없음 · 자료 불변 (PICK)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win();
    assert(w.pick, 'PICK select shown');
    assert.deepEqual(w.pick.opts, ['전체 · 10줄', B + ' · 3줄', A + ' · 5줄', C + ' · 1줄'], 'PICK options — latest record first ' + JSON.stringify(w.pick.opts));
    assert.equal(w.pick.value, ''); assert.equal(w.pick.h >= 44, true, 'tap target ' + w.pick.h); assert.equal(w.title, '⏱ 작업시간'); assert.equal(w.rows, 10);
    assert(w.ov.every(x => x <= 1), 'overflow ' + JSON.stringify(w.ov));
    await page.locator('#modalRoot [data-wl-project]').selectOption(B);
    await page.waitForFunction(b => document.getElementById('modalTitle')?.textContent.includes(b), B, { timeout: 3000 }).catch(() => {});   // 안 바뀌면 아래 PICK 단언이 말한다
    w = await win();
    assert.equal(w.title, '⏱ 작업시간 — ' + B, 'PICK opens that project'); assert.equal(w.rows, 3); assert.equal(w.days, '3일'); assert.equal(w.pick.value, B);
    await page.locator('#modalRoot [data-wl-project]').selectOption('');
    await page.waitForFunction(() => document.getElementById('modalTitle')?.textContent.trim() === '⏱ 작업시간');
    w = await win(); assert.equal(w.rows, 10, 'back to all'); assert.equal(w.pick.value, '');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), D); await page.locator('#modalRoot [data-wl-project]').waitFor();
    w = await win();
    assert.deepEqual(w.pick.opts, ['전체 · 10줄', D + ' · 0줄', B + ' · 3줄', A + ' · 5줄', C + ' · 1줄']); assert.equal(w.pick.value, D, 'empty project selected'); assert.equal(w.rows, 0);
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 기록 있는 현장이 하나뿐이면 칸 없음 · 오류 0', async () => {
    await page.evaluate(a => { state.workLogs = state.workLogs.filter(w => w.project === a); }, A);
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.equal((await win()).pick, null, 'one project → no select (all window)');
    await page.evaluate(a => workView(a), A); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.equal((await win()).pick, null, 'one project → no select (project window)');
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlpick-v485: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlpick-v485', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

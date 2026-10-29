/* v460 📋 대표 할 일 — Claude 인수인계 (개발_백로그 1번). 합성 자료만, 외부 쓰기 0.
   ① 첫 화면 '📋 대표 할 일 n건' 줄(n = 항목 수 − 자동 확인) → [보기] 가 팀 업무·인수인계 보드를 열고 맨 위 카드에 항목이 모두 있다 · 44px · 390px 넘침 없음(OWNER_TODO_LINE)
   ② 체크하면 카드 수·첫 화면 줄이 줄고 이 기기(localStorage)에만 남는다 — 새로고침 뒤에도 유지, 앱 저장본은 그대로(OWNER_TODO_PERSIST) · [끝난 것 보기] 로 되돌릴 수 있다
   ③ 리뷰 링크를 넣으면 그 항목은 '자동 확인'으로 끝난 것 취급 · [설정 열기] 가 설정 › 기타 › 리뷰 링크 칸으로 · 직원 모드에선 줄·카드가 숨는다
   HJ_V460_BASELINE=<commit> 은 OWNER_TODO_LINE 에서 실패해야 한다. HJ_V460_MUTATION=no-persist 는 OWNER_TODO_PERSIST 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_O1 둔산 욕실';
const MUT = process.env.HJ_V460_MUTATION || '';
let html = process.env.HJ_V460_BASELINE ? execFileSync('git', ['show', process.env.HJ_V460_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-persist');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "try{localStorage.setItem(HJ_OWNER_TODO_KEY,JSON.stringify(done));}catch(e){}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0 };
  async function open(width) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
    await boot(page, width);
    return { context, page };
  }
  async function boot(page, width) {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
    await page.evaluate(async ({ P, mobile }) => {
      aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __mobileMode = mobile; applyMobileMode();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
      state.projects = [{ name: P, kind: 'interior', stage: 2, phases: ['타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6001', addr: '대전 서구 둔산동 1-1' } }];
      __reviewUrl = ''; state.activeProject = null; state.tab = 'dashboard'; render();
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V460_SEED_SAVE_FAILED');
    }, { P, mobile: width < 760 });
  }
  const snapshot = page => page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const live = serializeData(); live.savedAt = ''; return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')) }; });
  const close = page => page.evaluate(() => closeModal(true));
  async function test(name, fn) { await fn(); passed++; console.log('PASS ownertodo-v460 ' + name); }

  const ph = await open(390), pc = await open(1280);

  await test('① 첫 화면 줄 → [보기] → 팀 업무·인수인계 보드 맨 위 카드에 항목 전부 · 44px · 390px 넘침 없음(OWNER_TODO_LINE)', async () => {
    for (const [tag, page] of [['phone', ph.page], ['pc', pc.page]]) {
      const total = await page.evaluate(() => (typeof HJ_OWNER_TODO !== 'undefined' ? HJ_OWNER_TODO.length : 0));
      assert(total >= 8, 'OWNER_TODO_LINE constant present (' + tag + ') ' + total);
      const expected = await page.evaluate(() => hjOwnerTodoOpenCount());
      assert.equal(expected, total, 'nothing auto-done on 127.0.0.1 with no review url');
      const line = page.locator('#view [data-owner-todo-line]'); await line.waitFor();
      assert.match(await line.innerText(), new RegExp('📋 대표 할 일 ' + expected + '건'));
      const h = await page.locator('#view [data-owner-todo-open]').evaluate(n => n.getBoundingClientRect().height); assert(h >= 44, 'button height ' + h);
      await page.locator('#view [data-owner-todo-open]').click(); await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
      const r = await page.evaluate(() => { const card = document.querySelector('#modalRoot [data-owner-todo-card]'); const board = document.getElementById('teamBoard'); const first = board.querySelector('section,p,button,div'); const items = [...card.querySelectorAll('[data-owner-todo-item][data-open="1"]')];
        return { atTop: board.firstElementChild === card, n: items.length, labels: items.map(li => li.querySelector('label').getBoundingClientRect().height >= 44), count: card.querySelector('[data-owner-todo-count]').textContent, settings: !!card.querySelector('[data-owner-todo-settings]'), link: !!card.querySelector('a[href*="pull/189"]'), modalOverflow: (m => m.scrollWidth > m.clientWidth + 1)(document.querySelector('#modalRoot .modal')), pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      assert.equal(r.n, expected, 'card lists every open item ' + JSON.stringify(r)); assert(r.atTop, 'card at the top of the board'); assert(r.labels.every(Boolean), 'label rows 44px');
      assert.match(r.count, new RegExp('남은 것 ' + expected + '건')); assert(r.settings && r.link, 'settings and link actions present');
      assert.equal(r.modalOverflow, false, tag + ' modal overflow'); assert.equal(r.pageOverflow, false, tag + ' page overflow');
      await close(page);
    }
  });

  await test('② 체크 → 카드·첫 화면 줄이 줄고 이 기기에만 남는다 · 새로고침 뒤 유지 · 저장본 불변 · [끝난 것 보기] (OWNER_TODO_PERSIST)', async () => {
    const page = ph.page; const before = await snapshot(page);
    const total = await page.evaluate(() => HJ_OWNER_TODO.length);
    await page.evaluate(() => hjTeamBoard()); await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
    await page.locator('#modalRoot [data-owner-todo="pr189"]').click();   // check() 는 바뀐 뒤 다시 그려지는 카드와 안 맞는다 await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
    await page.locator('#modalRoot [data-owner-todo="decide-exam-toast"]').click(); await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
    const after = await page.evaluate(() => ({ open: document.querySelectorAll('#modalRoot [data-owner-todo-item][data-open="1"]').length, count: document.querySelector('#modalRoot [data-owner-todo-count]').textContent, ls: JSON.parse(localStorage.getItem('hj_owner_todo_done') || '{}'), toggle: (document.querySelector('#modalRoot [data-owner-todo-toggle]') || {}).textContent || '' }));
    assert.equal(after.open, total - 2, 'OWNER_TODO_PERSIST two fewer open rows ' + JSON.stringify(after)); assert.deepEqual(Object.keys(after.ls).sort(), ['decide-exam-toast', 'pr189'], 'OWNER_TODO_PERSIST localStorage');
    assert.match(after.toggle, /끝난 것 2건 보기/);
    await page.locator('#modalRoot [data-owner-todo-toggle]').click(); await page.locator('#modalRoot [data-owner-todo-closed]').waitFor();
    assert.equal(await page.locator('#modalRoot [data-owner-todo-closed] [data-owner-todo-item]').count(), 2);
    await page.locator('#modalRoot [data-owner-todo-closed] [data-owner-todo="pr189"]').click(); await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
    assert.deepEqual(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('hj_owner_todo_done') || '{}'))), ['decide-exam-toast'], 'uncheck removes the mark');
    await close(page);
    assert.match(await page.locator('#view [data-owner-todo-line]').innerText(), new RegExp('대표 할 일 ' + (total - 1) + '건'), 'dashboard line follows');
    assert.deepEqual(await snapshot(page), before, 'app data unchanged by checking');
    await boot(page, 390);   // 새로고침(같은 기기) — localStorage 만 남는다
    assert.match(await page.locator('#view [data-owner-todo-line]').innerText(), new RegExp('대표 할 일 ' + (total - 1) + '건'), 'OWNER_TODO_PERSIST after reload');
    await page.evaluate(() => localStorage.removeItem('hj_owner_todo_done'));
  });

  await test('③ 리뷰 링크가 들어가면 자동 확인 · [설정 열기] → 설정 › 기타 › 리뷰 링크 칸 · 직원 모드에선 숨김', async () => {
    const page = pc.page;
    await page.evaluate(() => { __reviewUrl = 'https://naver.me/TESTabc'; render(); });
    const total = await page.evaluate(() => HJ_OWNER_TODO.length);
    assert.match(await page.locator('#view [data-owner-todo-line]').innerText(), new RegExp('대표 할 일 ' + (total - 1) + '건'), 'review item auto-done');
    await page.evaluate(() => hjTeamBoard({ ownerDone: true })); await page.locator('#modalRoot [data-owner-todo-closed]').waitFor();
    const auto = await page.evaluate(() => { const li = document.querySelector('#modalRoot [data-owner-todo-item="review-url"]'); return { closed: !!li.closest('[data-owner-todo-closed]'), tag: !!li.querySelector('[data-owner-todo-auto]'), disabled: li.querySelector('input').disabled }; });
    assert.deepEqual(auto, { closed: true, tag: true, disabled: true }, JSON.stringify(auto));
    await page.evaluate(() => { __reviewUrl = ''; }); await page.evaluate(() => hjTeamBoard()); await page.locator('#modalRoot [data-owner-todo-card]').waitFor();
    await page.locator('#modalRoot [data-owner-todo-item="review-url"] [data-owner-todo-settings]').click(); await page.waitForTimeout(200);
    const s = await page.evaluate(() => { const tab = document.querySelector('#modalRoot #setTab-etc'), inp = document.querySelector('#modalRoot #rvUrl'); return { tab: tab ? tab.getAttribute('aria-selected') : null, focused: !!inp && document.activeElement === inp }; });
    assert.deepEqual(s, { tab: 'true', focused: true }, 'settings etc tab + rvUrl focus ' + JSON.stringify(s)); await close(page);
    // 직원 모드: 첫 화면 줄·보드 카드 모두 숨김
    await page.evaluate(() => { localStorage.setItem('hj_role', 'staff'); document.body.classList.add('hj-staff'); render(); });
    const staff = await page.evaluate(() => ({ line: !!document.querySelector('#view [data-owner-todo-line]'), lineHtml: hjOwnerTodoLineHtml(), card: hjOwnerTodoCardHtml(false) }));
    assert.deepEqual(staff, { line: false, lineHtml: '', card: '' }, 'hidden for staff ' + JSON.stringify(staff).slice(0, 120));
    await page.evaluate(() => { localStorage.removeItem('hj_role'); document.body.classList.remove('hj-staff'); render(); });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`ownertodo-v460: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await ph.context.close(); await pc.context.close();
})().catch(async error => { console.error('FAIL ownertodo-v460', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

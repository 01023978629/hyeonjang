/* v464 첫 화면 '현장별 지출 · 마진' 표 — PC 1280 맞춤(개발_백로그 5번). 합성 자료만, 외부 쓰기 0.
   ① 1280px(옆 메뉴 포함, 본문 약 960px)에서 표가 옆으로 안 밀린다(가로 스크롤 없음) — 열 제목·마진 칸 괄호 설명은 줄바꿈, 굵은 금액은 한 줄(MARGIN_FITS_1280)
   ② 1024px 에서는 그대로 옆으로 스크롤(금액이 꺾이지 않는다) · 이름 칸 150px 이상(v452 계약) · 마진 칸 글은 projectMarginLabel 과 같은 뜻('금액 · 비율% (입력 원가 기준)')
   ③ 폰(390px, 모바일 모드)에서는 마진 칸이 한 줄 글 '금액 · 비율% (입력 원가 기준)' 그대로(카드형 표) · 원가 입력칸은 그대로 입력된다(data-cost)
   HJ_V464_BASELINE=<commit> 은 MARGIN_FITS_1280 에서 실패해야 한다. HJ_V464_MUTATION=wide(PC 입력칸 84px 규칙을 지움)도 MARGIN_FITS_1280 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V464_MUTATION || '';
let html = process.env.HJ_V464_BASELINE ? execFileSync('git', ['show', process.env.HJ_V464_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'wide');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'body:not(.mobile-mode) #dashboardMarginTable td.amt input.mg-in{width:84px;box-sizing:border-box;font-size:12px;padding:5px 6px}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}
const P1 = 'TEST_M1 은행동 한빛아파트 101동 702호 욕실 리모델링', P2 = 'TEST_M2 대치동 아파트', P3 = 'TEST_M3 성수동 사무실';

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0 };
  async function open(width, height, mobile) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async ({ keys, mobile, P1, P2, P3 }) => {
      await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
      aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __mobileMode = !!mobile; applyMobileMode();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
      state.projects = [
        { name: P1, kind: 'interior', stage: 2, received: 8000000, phases: [], archived: false, cost: { material: 4200000, labor: 3000000, outsource: 1200000 } },
        { name: P2, kind: 'interior', stage: 3, received: 24500000, phases: [], archived: false, cost: { material: 12000000, labor: 9000000, outsource: 4000000 } },
        { name: P3, kind: 'interior', stage: 1, received: 0, phases: [], archived: false, cost: { material: 0, labor: 0, outsource: 0 } }];
      state.files = [{ id: 'TEST_E1', name: 'a.pdf', ext: 'pdf', kind: 'estimate', project: P1, est: { amount: 12000000, supply: 10909091, vat: 1090909 }, _virtual: true },
        { id: 'TEST_E2', name: 'b.pdf', ext: 'pdf', kind: 'estimate', project: P2, est: { amount: 35000000, supply: 31818182, vat: 3181818 }, _virtual: true }];
      state.activeProject = null; state.tab = 'dashboard'; render();
    }, { keys: BOOT, mobile, P1, P2, P3 });
    return { context, page };
  }
  const measure = page => page.evaluate(() => {
    const tbl = document.getElementById('dashboardMarginTable'), wrap = tbl.parentElement, broken = [];
    const walk = document.createTreeWalker(tbl, NodeFilter.SHOW_TEXT); let node;
    while ((node = walk.nextNode())) { const m = /\d[\d,]{4,}원/.exec(node.nodeValue || ''); if (!m) continue; const range = document.createRange(); range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length); const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top))); if (tops.size > 1) broken.push(m[0]); }
    const mg = [...tbl.querySelectorAll('tbody td.mg')].map(td => td.innerText.replace(/\s+/g, ' ').trim());
    return { wrap: wrap.clientWidth, table: tbl.scrollWidth, overflow: tbl.scrollWidth > wrap.clientWidth + 1, scroll: getComputedStyle(wrap).overflowX, nm: Math.round(tbl.querySelector('td.nm').getBoundingClientRect().width), broken, mg,
      heads: [...tbl.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width)), inputs: [...tbl.querySelectorAll('input[data-cost]')].map(i => Math.round(i.getBoundingClientRect().width)) };
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS margin1280-v464 ' + name); }

  await test('① 1280px: 표가 옆으로 안 밀림(가로 스크롤 없음) · 금액 안 꺾임 · 굵은 금액 한 줄 + 설명 줄바꿈 (MARGIN_FITS_1280)', async () => {
    const { context, page } = await open(1280, 860, false);
    const r = await measure(page);
    assert.equal(r.overflow, false, 'MARGIN_FITS_1280 table ' + r.table + 'px in ' + r.wrap + 'px');
    assert.deepEqual(r.broken, [], 'no amount breaks'); assert.equal(r.scroll, 'auto'); assert(r.nm >= 150, 'name column ' + r.nm);
    assert.match(r.mg[0], /^3,600,000원 30% \(입력 원가 기준\)$/, r.mg[0]); assert.match(r.mg[1], /^3,000,000원 27% \(입력 원가 기준\)$/, r.mg[1]); assert.equal(r.mg[4], '견적 입력 필요');
    const lines = await page.evaluate(() => { const td = document.querySelector('#dashboardMarginTable tbody td.mg'); const a = td.querySelector('.mg-amt').getBoundingClientRect(), n = td.querySelector('.mg-note').getBoundingClientRect(); return { amtOneLine: Math.round(a.height) < 30, noteBelow: n.top >= a.bottom - 1, sepHidden: getComputedStyle(td.querySelector('.mg-sep')).display === 'none' }; });
    assert.deepEqual(lines, { amtOneLine: true, noteBelow: true, sepHidden: true }, JSON.stringify(lines));
    assert(r.inputs.every(w => w >= 80 && w <= 90), 'PC cost inputs 84px ' + JSON.stringify(r.inputs));
    // 입력은 그대로 — 자재비를 고치면 원가가 바뀐다
    await page.locator('#dashboardMarginTable input[data-cost="material"]').first().fill('4,500,000'); await page.locator('#dashboardMarginTable input[data-cost="material"]').first().press('Enter'); await page.locator('#dashboardMarginTable input[data-cost="material"]').first().blur().catch(() => {});
    await page.waitForFunction(n => state.projects.find(p => p.name === n).cost.material === 4500000, P1, { timeout: 5000 });
    await context.close();
  });

  await test('② 1024px: 그대로 옆으로 스크롤(금액 안 꺾임) · 이름 칸 150px · 1440px 도 안 밀림', async () => {
    const a = await open(1024, 768, false);
    const r = await measure(a.page);
    assert.equal(r.overflow, true, '1024 scrolls ' + r.table + '/' + r.wrap); assert.deepEqual(r.broken, []); assert.equal(r.scroll, 'auto'); assert(r.nm >= 150, 'name column ' + r.nm);
    await a.context.close();
    const b = await open(1440, 900, false);
    const r2 = await measure(b.page); assert.equal(r2.overflow, false, '1440 fits ' + r2.table + '/' + r2.wrap); assert.deepEqual(r2.broken, []);
    await b.context.close();
  });

  await test('③ 폰 390px(모바일 모드): 마진 칸 한 줄 글 그대로 · 원가 입력칸 96px · 오류 0', async () => {
    const { context, page } = await open(390, 800, true);
    const r = await page.evaluate(() => { const tbl = document.getElementById('dashboardMarginTable'); const td = tbl.querySelector('tbody td.mg'); const a = td.querySelector('.mg-amt').getBoundingClientRect(), n = td.querySelector('.mg-note').getBoundingClientRect(), i = tbl.querySelector('input[data-cost]').getBoundingClientRect();
      return { text: td.innerText.replace(/\s+/g, ' ').trim(), sep: getComputedStyle(td.querySelector('.mg-sep')).display, sameLine: Math.abs(a.top - n.top) < 4, pieces: td.querySelectorAll(':scope > *').length, input: [Math.round(i.width), Math.round(i.height)], doc: document.documentElement.scrollWidth - innerWidth }; });
    assert.equal(r.text, '3,600,000원 · 30% (입력 원가 기준)', JSON.stringify(r)); assert.notEqual(r.sep, 'none'); assert.equal(r.sameLine, true, 'one line on the phone ' + JSON.stringify(r)); assert.equal(r.pieces, 1, 'one flex item in the card cell');
    assert(r.input[0] >= 90 && r.input[1] >= 44, 'phone input ' + JSON.stringify(r.input)); assert(r.doc <= 1, 'no horizontal overflow at 390px');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
    await context.close();
  });

  console.log(`margin1280-v464: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL margin1280-v464', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v452 PC 화면·어두운 화면 고침(리허설 R7 PC 점검) — 합성 자료만, 외부 쓰기 0.
   ① 견적 편집기 합계 칸이 1024px 에서 잘리지 않음(QM_SIDE_VISIBLE_1024) ② PC 탭 줄 [⋯ 더보기] → 126개 목록(가운데 창) · 폰에선 숨김 · 검색창 바로가기가 더보기 기능도 찾음
   ③ 비서 창이 열린 채 연 모달의 닫기 단추를 누를 수 있음(폰·PC) · 키 없을 때 설정 🔑 탭 ④ OfficeOps 주소 없으면 요청 0 ⑤ 어두운 화면 대비 — 설정 탭·비교표 차이/합계 줄·파랑/초록 단추·단추 올렸을 때·계절 칩
   ⑥ PC 첫 화면 지출·마진 표(금액 안 꺾임) · 인건비 장부 상자 · 서류 만들기 두 칸 · 미리보기 60vh · 토스트 위 · 백업 안내 문구.
   HJ_V452_BASELINE=<commit> 은 PCDARK_API_PRESENT 에서, HJ_V452_MUTATION=qm-grid(minmax 되돌림)는 QM_SIDE_VISIBLE_1024 에서 실패해야 한다. */
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
const P = 'TEST_W1 둔산 욕실';
let html = null;
if (process.env.HJ_V452_BASELINE) html = execFileSync('git', ['show', process.env.HJ_V452_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
else if (process.env.HJ_V452_MUTATION) {
  assert.equal(process.env.HJ_V452_MUTATION, 'qm-grid');
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), needle = '.qm-wrap{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px}';
  assert.equal(src.split(needle).length, 2, 'mutation needle must appear once');
  html = src.replace(needle, '.qm-wrap{display:grid;grid-template-columns:1fr 260px;gap:16px}').replace('@media(min-width:761px) and (max-width:1100px){body:not(.mobile-mode) .qm-wrap{grid-template-columns:1fr}body:not(.mobile-mode) .qm-side{position:static;order:-1}}', '');
}
const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (!m) return null; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return 21; const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + 0.05) / (l + 0.05); };

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0, posts: [] };
  async function open(width, height, mobile) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: !!mobile, hasTouch: !!mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) { network.writes++; network.posts.push(request.method() + ' ' + url.pathname); }
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(m => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); window.__v452 = { toasts: [], mobile: m }; }, !!mobile);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
    await page.evaluate(async ({ P, mobile }) => {
      aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const realToast = toast; toast = m => { __v452.toasts.push(String(m)); return realToast(m); };
      hjSendSms = () => {};
      __mobileMode = mobile; applyMobileMode();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
      state.projects = [{ name: P, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 1000000, labor: 500000, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-4701', addr: '대전 서구 둔산동 1-1' } }];
      const item = (name, qty, price) => ({ name, spec: '', qty, price });
      state.quotes = [{ id: 'TEST_WQ1', project: P, title: '욕실 기본', no: 'A', date: localDate(), vatIncluded: true, tier: 'basic', items: [item('타일', 10, 100000), item('도기', 1, 300000)] },
        { id: 'TEST_WQ2', project: P, title: '욕실 고급', no: 'B', date: localDate(), vatIncluded: true, tier: 'premium', items: [item('타일', 10, 150000), item('도기', 1, 600000), item('조명', 1, 120000)] }];
      state.quotes.forEach(q => syncQuoteToProject(q));
      state.tab = 'dashboard'; render();
    }, { P, mobile });
    return { context, page };
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS pcdark-v452 ' + name); }
  const close = page => page.evaluate(() => closeModal(true));

  const pc = await open(1280, 800, false), laptop = await open(1024, 768, false), phone = await open(390, 780, true);

  await test('① PCDARK_API_PRESENT · PC 모드', async () => {
    assert.equal(await pc.page.evaluate(() => typeof hjMoreCmdHits === 'function' && !!document.getElementById('btnMorePc') && !document.body.classList.contains('mobile-mode')), true, 'PCDARK_API_PRESENT');
  });

  await test('② 견적 편집기 합계 칸이 1280·1024 에서 모두 보인다(QM_SIDE_VISIBLE_1024)', async () => {
    for (const [label, t] of [['1280', pc], ['1024', laptop]]) {
      await t.page.evaluate(() => { state.editingQuote = JSON.parse(JSON.stringify(state.quotes[1])); state.tab = 'quotemaker'; render(); });
      const r = await t.page.evaluate(() => { const side = document.querySelector('.qm-side'), view = document.getElementById('view'); const b = side.getBoundingClientRect(), v = view.getBoundingClientRect(); const tot = side.querySelector('.qm-sum-row.total'); const tb = tot && tot.getBoundingClientRect(); return { sideRight: Math.round(b.right), viewRight: Math.round(v.right), totalVisible: !!(tb && tb.width > 0 && tb.right <= v.right + 1 && tb.left >= v.left - 1), overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      assert(r.totalVisible && r.sideRight <= r.viewRight + 1 && !r.overflow, 'QM_SIDE_VISIBLE_' + label + ' ' + JSON.stringify(r));
      await t.page.evaluate(() => { state.editingQuote = null; state.tab = 'dashboard'; render(); });
    }
  });

  await test('③ PC [⋯ 더보기] → 126개 목록이 가운데 창으로 · 폰에선 숨김 · 검색창 바로가기가 더보기 기능도 찾는다', async () => {
    assert.equal(await phone.page.evaluate(() => getComputedStyle(document.getElementById('btnMorePc')).display), 'none', 'hidden on the phone');
    await pc.page.locator('#btnMorePc').click(); await pc.page.locator('#moreSheet.open').waitFor();
    const r = await pc.page.evaluate(() => { const s = document.getElementById('moreSheet'), b = s.getBoundingClientRect(); return { count: s.querySelectorAll('[data-moreaction]').length, centered: Math.abs((b.left + b.right) / 2 - innerWidth / 2) < 8, top: Math.round(b.top), width: Math.round(b.width), title: (document.getElementById('moreSheetTitle') || {}).textContent }; });
    assert(r.count >= 100 && r.centered && r.top < 120 && r.width <= 880, JSON.stringify(r)); assert.match(r.title, /126/);
    await pc.page.evaluate(() => { document.querySelectorAll('#moreSheet details').forEach(d => { d.open = true; }); });
    await pc.page.locator('#moreSheet [data-moreaction="season"]').first().click();
    await pc.page.waitForFunction(() => !document.querySelector('#moreSheet.open') && !!document.querySelector('#modalRoot .modal'));
    await close(pc.page);
    const hits = await pc.page.evaluate(() => ({ base: hjActionSearch('계절').map(a => a.n), all: hjActionSearch('계절').concat(hjMoreCmdHits('계절', hjActionSearch('계절'))).map(a => a.n), dup: hjMoreCmdHits('자재발주', hjActionSearch('자재발주')).map(a => a.n) }));
    assert(hits.base.length === 0 && hits.all.includes('영업 달력'), 'a 더보기-only feature is reachable from the PC palette: ' + JSON.stringify(hits));
    assert(!hits.dup.includes('자재 발주서'), 'no duplicate of an HJ_ACTIONS entry');
    assert.equal(await pc.page.evaluate(() => MORE_CATS.reduce((sum, c) => sum + c.items.length, 0)), 126);
  });

  await test('④ 비서 창이 열린 채 연 모달은 폰·PC 모두 위에 보이고 닫기를 누를 수 있다 · 키 없으면 설정 🔑 탭', async () => {
    for (const [label, t] of [['phone', phone], ['pc', pc]]) {
      const r = await t.page.evaluate(() => {
        aiAgent(); openModal('TEST 모달', '<p id="tm">본문</p>', [{ label: '닫기', cls: 'ghost', fn: closeModal }]);
        const m = document.querySelector('#modalRoot .modal'), closeBtn = document.querySelector('#modalRoot .modal-close'), cb = closeBtn.getBoundingClientRect();
        const topClose = document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2), b = m.getBoundingClientRect(), topBody = document.elementFromPoint(b.left + b.width / 2, b.top + 30);
        const out = { sheetOpen: document.getElementById('aiSheet').style.display !== 'none', closeReachable: !!(topClose && (topClose === closeBtn || closeBtn.contains(topClose))), bodyVisible: !!(topBody && m.contains(topBody)) };
        closeModal(true); aiHide(); return out;
      });
      assert.deepEqual(r, { sheetOpen: true, closeReachable: true, bodyVisible: true }, label + ' ' + JSON.stringify(r));
    }
    await pc.page.evaluate(async () => { window.__geminiKey = ''; window.__openaiKey = ''; await aiAgentSend('이번달 손익'); });
    await pc.page.locator('#setTab-keys[aria-selected="true"]').waitFor();
    const keys = await pc.page.evaluate(() => { const tab = document.getElementById('setTab-keys'), r = tab.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const ok = !!(top && (top === tab || tab.contains(top))); aiHide(); return ok; });
    assert.equal(keys, true, 'keys tab reachable above the AI panel');
    await close(pc.page);
  });

  await test('⑤ OfficeOps 주소·토큰이 없으면 요청을 보내지 않는다(앱 페이지로 POST 0)', async () => {
    const before = network.writes;
    const r = await pc.page.evaluate(async () => { __officeOps.url = ''; __officeOps.token = ''; try { await officeOpsCall('officeOpsList', {}); return { threw: false }; } catch (e) { return { threw: true, code: e.code }; } });
    assert.deepEqual(r, { threw: true, code: 'office-setup' }); assert.equal(network.writes, before, 'no POST ' + JSON.stringify(network.posts));
  });

  await test('⑥ 어두운 화면: 설정 탭·비교표 차이/합계 줄·파랑/초록 단추·올렸을 때·계절 칩 글자가 읽힌다(≥3:1)', async () => {
    const t = pc;
    await t.page.locator('#btnDark').click(); await t.page.waitForFunction(() => document.body.classList.contains('dark'));
    await t.page.evaluate(() => openGdriveSetup()); await t.page.locator('#setTab-etc').waitFor();
    const bgOf = el => { let e = el; while (e && e !== document.documentElement) { const bg = getComputedStyle(e).backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; e = e.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const read = sel => t.page.evaluate(([sel, bgSrc]) => { const bgOf = new Function('el', bgSrc); return [...document.querySelectorAll(sel)].filter(n => n.getClientRects().length).slice(0, 6).map(n => ({ c: getComputedStyle(n).color, bg: bgOf(n), t: n.textContent.trim().slice(0, 20) })); }, [sel, bgOf.toString().replace(/^[^{]*\{/, '').replace(/\}$/, '')]);
    const low = rows => rows.filter(r => contrast(r.c, r.bg) < 3).map(r => r.t + ' ' + contrast(r.c, r.bg).toFixed(2));
    assert.deepEqual(low(await read('#modalRoot .setTab')), [], 'settings tabs');
    await close(t.page);
    await t.page.evaluate(n => hjQuoteCompareView(n, ['TEST_WQ1', 'TEST_WQ2']), P); await t.page.locator('#hjQuoteCompare').waitFor();
    assert.deepEqual(low(await read('#hjQuoteCompare [data-qc-diff] td, #hjQuoteCompare [data-qc-total] td')), [], 'compare rows');
    await close(t.page);
    await t.page.evaluate(() => { state.tab = 'dashboard'; render(); });
    const btn = await t.page.evaluate(() => { const b = document.createElement('button'); b.className = 'blue'; b.id = 'TEST_B'; b.textContent = '📆 월말 마감'; const m = document.createElement('button'); m.className = 'moss'; m.id = 'TEST_M'; m.textContent = '엑셀'; document.getElementById('view').append(b, m); return [b, m].map(x => ({ c: getComputedStyle(x).color, bg: getComputedStyle(x).backgroundColor, t: x.textContent })); });
    assert.deepEqual(low(btn), [], 'blue/moss buttons');
    await t.page.hover('#TEST_B'); await t.page.waitForTimeout(250);
    const hov = await t.page.evaluate(() => [document.getElementById('TEST_B')].map(x => ({ c: getComputedStyle(x).color, bg: getComputedStyle(x).backgroundColor, t: 'hover ' + x.textContent })));
    assert.deepEqual(low(hov), [], 'hovered blue button keeps its label'); await t.page.evaluate(() => { document.getElementById('TEST_B').remove(); document.getElementById('TEST_M').remove(); });
    await t.page.evaluate(() => hjSeasonView()); await t.page.locator('[data-season-pick]').first().waitFor();
    const pill = await t.page.evaluate(() => [...document.querySelectorAll('[data-season-pick][aria-pressed="true"] [data-season-now]')].map(n => ({ c: getComputedStyle(n).color, bg: getComputedStyle(n.parentElement).backgroundColor, t: n.textContent })));
    assert.deepEqual(low(pill), [], 'season pill'); await close(t.page);
    await t.page.locator('#btnDark').click(); await t.page.waitForFunction(() => !document.body.classList.contains('dark'));
  });

  await test('⑦ PC 첫 화면 지출·마진 표 금액이 안 꺾인다 · 인건비 장부 상자 · 서류 만들기 두 칸 · 미리보기 60vh · 토스트 위 · 백업 안내 문구', async () => {
    const r = await pc.page.evaluate(() => { const tbl = document.getElementById('dashboardMarginTable'); const broken = [];
      const walk = document.createTreeWalker(tbl, NodeFilter.SHOW_TEXT); let node;
      while ((node = walk.nextNode())) { const m = /\d[\d,]{4,}원/.exec(node.nodeValue || ''); if (!m) continue; const range = document.createRange(); range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length); const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top))); if (tops.size > 1) broken.push(m[0]); }
      return { broken, scroll: getComputedStyle(tbl.parentElement).overflowX, nm: Math.round(tbl.querySelector('td.nm').getBoundingClientRect().width) }; });
    assert.deepEqual(r.broken, [], 'no amount breaks across lines'); assert.equal(r.scroll, 'auto'); assert(r.nm >= 150, 'name column ' + r.nm);
    await pc.page.evaluate(ym => laborLedger(ym), new Date().toISOString().slice(0, 7)); await pc.page.locator('#llRows').waitFor();
    assert.equal(await pc.page.evaluate(() => getComputedStyle(document.getElementById('llRows')).maxHeight), 'none'); await close(pc.page);
    assert.equal(await phone.page.evaluate(async ym => { laborLedger(ym); await new Promise(r => setTimeout(r, 50)); const v = getComputedStyle(document.getElementById('llRows')).maxHeight; closeModal(true); return v !== 'none'; }, new Date().toISOString().slice(0, 7)), true, 'phone keeps the inner scroll box');
    await pc.page.evaluate(n => docHubView(n), P); await pc.page.locator('#modalRoot .docHubBtn').first().waitFor();
    const hub = await pc.page.evaluate(() => { const btns = [...document.querySelectorAll('#modalRoot .docHubBtn')]; const lefts = new Set(btns.map(b => Math.round(b.getBoundingClientRect().left))); return { cols: lefts.size, planned: btns.filter(b => /예정 · v\d/.test(b.textContent)).length, grid: getComputedStyle(document.querySelector('#modalRoot .mbody')).display }; });
    assert.deepEqual(hub, { cols: 2, planned: 0, grid: 'grid' }, JSON.stringify(hub)); await close(pc.page);
    await pc.page.evaluate(n => hjDocDeliverView(n, '<html><body>t</body></html>', 'TEST', '테스트 문서', null), P); await pc.page.locator('.doc-preview-frame').waitFor();
    const ph = await pc.page.evaluate(() => Math.round(document.querySelector('.doc-preview-frame').getBoundingClientRect().height)); assert(ph >= 0.55 * 800, 'preview height ' + ph); await close(pc.page);
    const toastTop = await pc.page.evaluate(() => { toast('TEST 토스트'); const r = document.getElementById('toast').getBoundingClientRect(); return r.top; });
    assert(toastTop < 80, 'PC toast at the top: ' + toastTop);
    const msg = await pc.page.evaluate(() => { localStorage.removeItem('hj_last_backup'); __v452.toasts.length = 0; backupBootCheck(); return new Promise(r => setTimeout(() => r(__v452.toasts.slice()), 2700)); });
    assert(msg.some(m => /아직 백업한 적이 없어요/.test(m)), JSON.stringify(msg));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`pcdark-v452: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await pc.context.close(); await laptop.context.close(); await phone.context.close();
})().catch(error => { console.error('FAIL pcdark-v452', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

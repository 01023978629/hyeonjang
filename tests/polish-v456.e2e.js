/* v456 다듬기 — 리허설 R2·R7 남은 것. 합성 자료만, 외부 쓰기 0.
   ① 🎉 준공 관리 카드: 리뷰 링크가 비어 있으면 [⚠ 리뷰 링크 없음 — 설정] 단추가 보이고 누르면 ⚙️ 설정 › 기타 › 리뷰 링크 칸으로 간다 · 링크를 넣으면 사라진다(REVIEW_LINK_HINT)
   ② 밝은 화면 작은 글자 — 단계 탭 보조 글자·진행 ○·사진 안내·비준공 카드·문서 센터 '준비 중'·원가 출처 '없음'·손익 지출·AI 두뇌 카드 — 글자/배경 4.5:1 이상(LIGHT_SMALL_TEXT),
      주황 #e8912d 는 글자색으로 더 쓰지 않는다
   ③ PC(≥900px) 🧾 영수증 확인: 사진은 왼쪽 칸에 고정(sticky), 입력칸은 모두 오른쪽 칸 · 폰(390px)은 한 줄(RECEIPT_TWO_COL)
   ④ AI 두뇌·운영 모드 카드: 키 없는 두뇌도 눌러서 키 화면으로(흐린 disabled 아님)(PROVIDER_CLICKABLE)
   HJ_V456_BASELINE=<commit> 은 REVIEW_LINK_HINT 에서 실패해야 한다. HJ_V456_MUTATION=rc-grid 는 RECEIPT_TWO_COL 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const DONE = 'TEST_P1 준공 둔산 욕실', LIVE = 'TEST_P2 진행 대흥 누수';
const MUT = process.env.HJ_V456_MUTATION || '';
let html = process.env.HJ_V456_BASELINE ? execFileSync('git', ['show', process.env.HJ_V456_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'rc-grid');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'body:not(.mobile-mode) #hjRcConfirm>:not([data-rc-photo]){grid-column:2}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'body:not(.mobile-mode) #hjRcConfirm>:not([data-rc-photo]){grid-column:auto}');
}
const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c); if (!m) return null; if (m[4] !== undefined && Number(m[4]) === 0) return null; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return 21; const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + 0.05) / (l + 0.05); };

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
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
    await page.evaluate(async ({ DONE, LIVE, mobile }) => {
      aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __mobileMode = mobile; applyMobileMode();
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
      const today = localDate(), ago = n => hjAddDays(today, -n);
      state.projects = [
        { name: DONE, kind: 'interior', stage: 3, doneAt: ago(10), phases: ['타일'], received: 1500000, archived: false, cost: { material: 400000, labor: 250000, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-5601', addr: '대전 서구 둔산동 1-1' } },
        { name: LIVE, kind: 'leak', stage: 1, phases: [], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김테스트', phone: '010-0000-5602', addr: '대전 중구 대흥동 2-2' } }];
      const item = (name, qty, price) => ({ name, spec: '', qty, price });
      state.quotes = [{ id: 'TEST_PQ1', project: DONE, title: '욕실 기본', no: 'A', date: ago(20), vatIncluded: true, items: [item('타일', 10, 150000)] }];
      state.quotes.forEach(q => syncQuoteToProject(q));
      state.payLog = [{ d: ago(3), project: DONE, amt: 1500000 }];
      state.expenses = [{ id: 'TEST_E1', date: ago(5), amount: 120000, vendor: 'TEST 자재', cat: '자재', method: '카드', project: DONE }];
      __reviewUrl = ''; __geminiKey = ''; __openaiKey = ''; __aiProvider = 'gemini';
      state.activeProject = null; state.tab = 'dashboard'; render();
    }, { DONE, LIVE, mobile: width < 760 });
    return { context, page };
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS polish-v456 ' + name); }
  const close = page => page.evaluate(() => closeModal(true));
  const detail = (page, name) => page.evaluate(name => { closeModal(true); state.activeProject = name; state.tab = 'project'; window.__projView = null; render(); }, name);
  // 보이는 글자 노드의 (글자색, 실제 배경, 조상 opacity 곱) — 배경은 투명하지 않은 가장 가까운 조상
  const sample = (page, sel, max) => page.evaluate(([sel, max]) => {
    const bgOf = el => { let e = el; while (e && e !== document.documentElement) { const cs = getComputedStyle(e), bg = cs.backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'image'; e = e.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const opOf = el => { let o = 1, e = el; while (e && e !== document.documentElement) { o *= Number(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
    const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const roots = [...document.querySelectorAll(sel)]; let node;
    while ((node = walker.nextNode()) && out.length < max) {
      const t = (node.nodeValue || '').trim(); if (t.length < 2) continue; const el = node.parentElement; if (!el || !roots.some(r => r.contains(el))) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      out.push({ t: t.slice(0, 24), c: cs.color, bg: bgOf(el), op: opOf(el), size: parseFloat(cs.fontSize), weight: cs.fontWeight, el: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/).join('.') : '') });
    }
    return out;
  }, [sel, max || 400]);
  // 조상 opacity 를 섞은 실제 글자색으로 대비를 센다(WCAG 1.4.3: 작은 글자 4.5:1)
  const mix = (fg, bg, op) => { const a = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(fg), b = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg); if (!a || !b || op >= 1) return fg; return 'rgb(' + [1, 2, 3].map(i => Math.round(op * +a[i] + (1 - op) * +b[i])).join(', ') + ')'; };
  const low = (rows, min) => rows.filter(r => r.bg !== 'image' && !/^[\s\W\d]+$/.test(r.t) && contrast(mix(r.c, r.bg, r.op), r.bg) < (min || 4.5)).map(r => r.el + ' "' + r.t + '" ' + r.c + (r.op < 1 ? ' ×' + r.op.toFixed(2) : '') + ' on ' + r.bg + ' ' + contrast(mix(r.c, r.bg, r.op), r.bg).toFixed(2));

  const pc = await open(1280), ph = await open(390);

  await test('① 준공 관리 카드: 리뷰 링크 없으면 [⚠ 리뷰 링크 없음 — 설정] → 설정 › 기타 › 리뷰 링크 칸 · 링크 넣으면 사라짐(REVIEW_LINK_HINT)', async () => {
    for (const page of [pc.page, ph.page]) {
      await detail(page, DONE); await page.waitForTimeout(150);
      const r = await page.evaluate(() => { const b = document.querySelector('[data-donecard="1"] [data-review-link-missing]'); return { card: !!document.querySelector('[data-donecard="1"]'), hint: !!b, text: b && b.textContent.trim(), tap: b && b.getBoundingClientRect().height >= 32, review: !!document.querySelector('[data-reviewreqp]') }; });
      assert(r.card && r.review, 'done card ' + JSON.stringify(r)); assert(r.hint, 'REVIEW_LINK_HINT ' + JSON.stringify(r)); assert.match(r.text, /리뷰 링크 없음/);
      await page.locator('[data-donecard="1"] [data-review-link-missing]').click(); await page.waitForTimeout(200);
      const s = await page.evaluate(() => { const tab = document.querySelector('#modalRoot #setTab-etc'), inp = document.querySelector('#modalRoot #rvUrl'); return { tab: tab ? tab.getAttribute('aria-selected') : null, input: !!inp, focused: document.activeElement === inp, visible: !!inp && inp.getClientRects().length > 0 }; });
      assert.deepEqual(s, { tab: 'true', input: true, focused: true, visible: true }, 'settings etc tab + rvUrl focus ' + JSON.stringify(s));
      await close(page);
      await page.evaluate(() => { __reviewUrl = 'https://naver.me/TESTabc'; }); await detail(page, DONE); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => !!document.querySelector('[data-review-link-missing]')), false, 'hint hidden once the link is set');
      await page.evaluate(() => { __reviewUrl = ''; });
      // 비준공 현장 카드는 리뷰 단추도 힌트도 없다
      await detail(page, LIVE); await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(() => ({ dim: !!document.querySelector('[data-donecard="0"]'), hint: !!document.querySelector('[data-review-link-missing]'), review: !!document.querySelector('[data-reviewreqp]') })), { dim: true, hint: false, review: false });
    }
  });

  await test('② 밝은 화면 작은 글자 4.5:1 — 단계 탭·진행 ○·사진 안내·비준공 카드·문서 센터·원가 출처·손익·AI 두뇌 (LIGHT_SMALL_TEXT)', async () => {
    const page = pc.page; await close(page);
    assert.equal(await page.evaluate(() => document.body.classList.contains('dark')), false);
    // 현장 탭: 단계 탭 보조 글자(small)·진행 ○·비준공 카드
    await page.evaluate(() => { closeModal(true); state.activeProject = null; state.tab = 'project'; window.__projView = null; render(); }); await page.waitForTimeout(100);
    const stage = await sample(page, '.stage-filter, .st-prog, [data-donecard="0"]', 300);
    assert(stage.some(r => r.el.startsWith('small')), 'stage tab small text rendered ' + stage.length);
    assert.deepEqual(low(stage), [], 'LIGHT_SMALL_TEXT stage tabs');
    await detail(page, LIVE); await page.waitForTimeout(100);
    const dim = await sample(page, '[data-donecard="0"]', 50);
    assert(dim.length >= 2, 'inactive 준공 card text sampled'); assert.deepEqual(low(dim), [], 'LIGHT_SMALL_TEXT inactive 준공 card');
    // 사진 탭 안내(.ph-hint): 뒤 규칙이 앞 규칙을 덮어 v453 색이 안 먹던 것
    await page.evaluate(() => { closeModal(true); state.tab = 'photos'; render(); }); await page.waitForTimeout(150);
    const hint = await page.evaluate(() => { const h = document.querySelector('.ph-hint'); const probe = document.createElement('span'); probe.className = 'ph-hint'; probe.textContent = 'x'; document.body.appendChild(probe); const c = getComputedStyle(probe).color; probe.remove(); return { any: !!h, color: c }; });
    assert.equal(hint.color, 'rgb(107, 127, 149)', '.ph-hint color ' + JSON.stringify(hint));
    // 첫 화면 마진 표 원가 출처 '없음' 배지 · 문서 센터 '준비 중' · 손익 지출 숫자
    await page.evaluate(() => { closeModal(true); state.tab = 'dashboard'; render(); }); await page.waitForTimeout(150);
    const dash = await sample(page, '#dashboardMarginTable', 300);
    assert(dash.some(r => /없음/.test(r.t)), 'srcBadge 없음 rendered'); assert.deepEqual(low(dash), [], 'LIGHT_SMALL_TEXT margin table');
    await page.evaluate(n => docHubView(n), DONE); await page.locator('#modalRoot .docHubBtn').first().waitFor();
    const hub = await sample(page, '#modalRoot .docHubBtn', 400);
    assert(hub.some(r => /준비 중/.test(r.t)), 'planned label rendered'); assert.deepEqual(low(hub), [], 'LIGHT_SMALL_TEXT doc hub'); await close(page);
    await page.evaluate(() => pnl()); await page.locator('#modalRoot .modal').waitFor(); await page.waitForTimeout(100);
    const pnl = await sample(page, '#modalRoot .mbody', 500);
    assert(pnl.some(r => /지출/.test(r.t)), 'pnl rendered'); assert.deepEqual(low(pnl), [], 'LIGHT_SMALL_TEXT 손익'); await close(page);
    // AI 두뇌 선택 카드(키 없음) — 흐리지 않고 읽힌다
    await page.evaluate(() => aiProviderManage()); await page.locator('#modalRoot .provPick').first().waitFor();
    const prov = await sample(page, '#modalRoot .provPick', 200);
    assert(prov.some(r => /키 필요/.test(r.t)), '키 필요 rendered'); assert.deepEqual(low(prov), [], 'LIGHT_SMALL_TEXT AI 두뇌'); await close(page);
    // 주황 #e8912d 는 글자색으로 쓰지 않는다(그래프 선·점만)
    const src = await page.evaluate(async () => (await (await fetch(location.pathname, { cache: 'no-store' })).text()));
    assert.equal((src.match(/color:#e8912d/g) || []).length, 0, 'no color:#e8912d text in source');
  });

  await test('③ PC 🧾 영수증 확인: 사진 왼쪽 고정 · 입력칸 오른쪽 · 폰은 한 줄(RECEIPT_TWO_COL)', async () => {
    for (const [page, want] of [[pc.page, 'grid'], [ph.page, 'block']]) {
      await close(page);
      await page.evaluate(async () => {
        hjReceiptOcrText = () => Promise.resolve('TEST 자재\n' + localDate().replace(/-/g, '.') + ' 14:22\n합 계 55,000\n신용카드 승인번호 12345678');
        const c = document.createElement('canvas'); c.width = 360; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 900); g.fillStyle = '#111'; g.font = '17px sans-serif'; g.fillText('영수증', 12, 28);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        hjReceiptAdd({ files: [new File([blob], 'TEST_r.png', { type: 'image/png' })] });
      });
      await page.locator('#hjRcConfirm').waitFor();
      const r = await page.evaluate(() => {
        const root = document.getElementById('hjRcConfirm'), cs = getComputedStyle(root), img = root.querySelector('[data-rc-photo]'), ics = getComputedStyle(img);
        const kids = [...root.children].filter(k => k !== img), cols = new Set(kids.map(k => getComputedStyle(k).gridColumnStart));
        const ib = img.getBoundingClientRect(), fb = document.getElementById('rcDate').getBoundingClientRect(), modal = document.querySelector('#modalRoot .modal');
        return { display: cs.display, imgPos: ics.position, imgCol: ics.gridColumnStart, kidCols: [...cols].join(','), sideBySide: fb.left >= ib.right, below: fb.top >= ib.bottom, modalOverflow: modal.scrollWidth > modal.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1, n: kids.length };
      });
      assert.equal(r.display, want, 'RECEIPT_TWO_COL display ' + JSON.stringify(r));
      if (want === 'grid') { assert.equal(r.imgPos, 'sticky'); assert.equal(r.imgCol, '1'); assert.equal(r.kidCols, '2', 'RECEIPT_TWO_COL every field in column 2 ' + JSON.stringify(r)); assert(r.sideBySide && r.n >= 12, JSON.stringify(r)); }
      else { assert(r.below && !r.sideBySide, JSON.stringify(r)); }
      assert.equal(r.modalOverflow, false); assert.equal(r.pageOverflow, false);
      await page.evaluate(() => closeModal(true)); await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => __hjRc), null, 'receipt flow cleared on close');
    }
  });

  await test('④ 키 없는 AI 두뇌 카드는 눌러서 키 화면으로 · 운영 모드 제공자 카드도 disabled 아님(PROVIDER_CLICKABLE)', async () => {
    const page = pc.page; await close(page);
    await page.evaluate(() => aiProviderManage()); await page.locator('#modalRoot .provPick').first().waitFor();
    const before = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .provPick')].map(b => ({ p: b.dataset.p, disabled: b.disabled, avail: b.dataset.available, border: getComputedStyle(b).borderTopStyle })));
    assert(before.length >= 3 && before.every(b => !b.disabled), 'PROVIDER_CLICKABLE ' + JSON.stringify(before));
    assert(before.filter(b => b.avail === '0').every(b => b.border === 'dashed'), 'unavailable cards dashed ' + JSON.stringify(before));
    await page.locator('#modalRoot .provPick[data-p="openai"]').click(); await page.waitForTimeout(250);
    const s = await page.evaluate(() => { const tab = document.querySelector('#modalRoot #setTab-keys'); return { keysTab: tab ? tab.getAttribute('aria-selected') : null, provider: __aiProvider }; });
    assert.deepEqual(s, { keysTab: 'true', provider: 'gemini' }, 'key-less pick opens keys tab, provider unchanged ' + JSON.stringify(s));
    await close(page);
    await page.evaluate(() => aiOperateMode()); await page.locator('#modalRoot .opProvPick').first().waitFor();
    const op = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .opProvPick')].map(b => ({ p: b.dataset.p, disabled: b.disabled, ready: b.dataset.ready, op: getComputedStyle(b).opacity })));
    assert(op.length >= 2 && op.every(b => !b.disabled && b.op === '1'), 'PROVIDER_CLICKABLE 운영 모드 ' + JSON.stringify(op));
    await close(page);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`polish-v456: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await pc.context.close(); await ph.context.close();
})().catch(async error => { console.error('FAIL polish-v456', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

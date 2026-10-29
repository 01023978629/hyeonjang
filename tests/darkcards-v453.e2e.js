/* v453 어두운 화면 — 인라인 파스텔 배경·진한 글자색(리허설 R7 남은 48화면). 합성 자료만, 외부 쓰기 0.
   어두운 화면에서 ① 첫 화면 백업 카드·견적서 내역 제목·마진 표 '적자'·요일 ② 👷 팀원 주간 현황 칸 ③ 🛡 AS 보증 관리 만료 카드 ④ 부가세 준비 타일
   ⑤ 월별 손익·연간 KPI 타일 ⑥ Cowork 예약·AI 운영 센터 안내 카드 ⑦ 비교표 규격 글자 — 글자/배경 대비 3:1 이상(DARK_CARDS_READABLE),
   밝은 화면은 그대로(인라인 배경 유지, LIGHT_UNCHANGED). HJ_V453_BASELINE=<commit> 은 DARK_CARDS_READABLE 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const P = 'TEST_D1 둔산 욕실', WAR = 'TEST_D2 보증 만료 현장';
const html = process.env.HJ_V453_BASELINE ? execFileSync('git', ['show', process.env.HJ_V453_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const lum = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c); if (!m) return null; if (m[4] !== undefined && Number(m[4]) === 0) return null; const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return 21; const [h, l] = la > lb ? [la, lb] : [lb, la]; return (h + 0.05) / (l + 0.05); };

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.removeItem('hj_last_backup'); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  await page.evaluate(async ({ P, WAR }) => {
    aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = false; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n);
    state.projects = [
      { name: P, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 9000000, labor: 500000, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-4801', addr: '대전 서구 둔산동 1-1' } },
      { name: WAR, kind: 'interior', stage: 3, doneAt: ago(365 * 3 + 40), received: 2000000, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '만료고객', phone: '010-0000-4802', addr: '대전 중구 대흥동' } }];
    state.contacts = [{ id: 'TEST_T1', name: '김타일', phone: '010-0000-4803', team: true, trade: '타일', dayRate: 250000 }];
    const item = (name, qty, price) => ({ name, spec: '액체방수 2회', qty, price });
    state.quotes = [{ id: 'TEST_DQ1', project: P, title: '욕실 기본', no: 'A', date: today, vatIncluded: true, tier: 'basic', items: [item('타일', 10, 100000), item('방수', 1, 700000)] },
      { id: 'TEST_DQ2', project: P, title: '욕실 고급', no: 'B', date: today, vatIncluded: true, tier: 'premium', items: [item('타일', 10, 150000), item('방수', 1, 900000)] }];
    state.quotes.forEach(q => syncQuoteToProject(q));
    state.payLog = [{ d: today, project: P, amt: 500000 }];
    state.schedule.push({ id: 'TEST_DS1', project: P, title: '타일 시공', date: today, time: '09:00', hours: 8, crew: '김타일', labor: { amount: 250000, names: '김타일', by: { '김타일': { days: 1, rate: 250000 } } } });
    state.tab = 'dashboard'; render();
  }, { P, WAR });
  async function test(name, fn) { await fn(); passed++; console.log('PASS darkcards-v453 ' + name); }
  const close = () => page.evaluate(() => closeModal(true));
  // 보이는 글자 노드의 (글자색, 실제 배경) — 배경은 투명하지 않은 가장 가까운 조상
  const sample = (sel, max) => page.evaluate(([sel, max]) => {
    const bgOf = el => { let e = el; while (e && e !== document.documentElement) { const cs = getComputedStyle(e), bg = cs.backgroundColor; if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg; if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'image'; e = e.parentElement; } return getComputedStyle(document.body).backgroundColor; };
    const out = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const roots = [...document.querySelectorAll(sel)]; let node;
    while ((node = walker.nextNode()) && out.length < max) {
      const t = (node.nodeValue || '').trim(); if (t.length < 2) continue; const el = node.parentElement; if (!el || !roots.some(r => r.contains(el))) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      out.push({ t: t.slice(0, 24), c: cs.color, bg: bgOf(el) });
    }
    return out;
  }, [sel, max || 400]);
  const low = rows => rows.filter(r => r.bg !== 'image' && contrast(r.c, r.bg) < 3).map(r => r.t + ' ' + r.c + ' on ' + r.bg + ' ' + contrast(r.c, r.bg).toFixed(2));
  const dark = on => page.evaluate(on => { if (document.body.classList.contains('dark') !== on) document.getElementById('btnDark').click(); return document.body.classList.contains('dark'); }, on);

  await test('① 밝은 화면 기준값 — 인라인 파스텔 배경은 그대로(LIGHT_UNCHANGED)', async () => {
    assert.equal(await dark(false), false);
    const r = await page.evaluate(() => { const card = document.querySelector('[data-backup-card]'); const head = [...document.querySelectorAll('#view div')].find(d => /견적서 내역/.test(d.textContent) && d.getAttribute('style') && /0b4ea2/.test(d.getAttribute('style'))); return { cardBg: card ? getComputedStyle(card).backgroundImage !== 'none' || getComputedStyle(card).backgroundColor : null, headColor: head ? getComputedStyle(head).color : null }; });
    assert(r.cardBg && r.cardBg !== 'rgb(23, 34, 46)', 'LIGHT_UNCHANGED backup card ' + JSON.stringify(r)); assert.equal(r.headColor, 'rgb(11, 78, 162)', 'LIGHT_UNCHANGED heading');
  });

  await test('② 어두운 화면: 첫 화면(백업 카드·견적서 내역 제목·마진 표·요일) · 비교표 규격 글자 (DARK_CARDS_READABLE)', async () => {
    assert.equal(await dark(true), true);
    await page.evaluate(() => { state.tab = 'dashboard'; render(); });
    assert.deepEqual(low(await sample('[data-backup-card], #dashboardMarginTable, #view .dash-sec', 200)), [], 'DARK_CARDS_READABLE dashboard');
    await page.evaluate(() => { state.tab = 'schedule'; render(); });
    assert.deepEqual(low(await sample('.cal-dow, .cal-cell.sat .cal-d', 60)), [], 'calendar saturday');
    await page.evaluate(n => hjQuoteCompareView(n, ['TEST_DQ1', 'TEST_DQ2']), P); await page.locator('#hjQuoteCompare').waitFor();
    assert.deepEqual(low(await sample('#hjQuoteCompare', 300)), [], 'DARK_CARDS_READABLE compare specs'); await close();
  });

  await test('③ 어두운 화면: 팀원 주간 현황 · AS 보증 관리 · 부가세 준비 · 월별 손익 · 연간 KPI · Cowork 예약 · AI 운영 센터 (DARK_CARDS_READABLE)', async () => {
    assert.equal(await dark(true), true);
    const views = [['crewweek', () => hjCrewWeekView()], ['warranty', () => moreActionHandler('warranty')], ['vatc', () => moreActionHandler('vatc')], ['pnl', () => moreActionHandler('pnl')], ['annual', () => moreActionHandler('annual')], ['cwsched', () => moreActionHandler('cwsched')], ['aiops', () => moreActionHandler('aiops')], ['syncguide', () => moreActionHandler('syncguide')], ['backupcenter', () => moreActionHandler('backupcenter')]];
    const bad = {};
    for (const [id, fn] of views) {
      await close(); await page.evaluate(f => { const r = (0, eval)('(' + f + ')')(); return r && r.then ? r.catch(() => {}) : r; }, fn.toString()); await page.locator('#modalRoot .modal').waitFor();
      const rows = low(await sample('#modalRoot .mbody', 400)); if (rows.length) bad[id] = rows.slice(0, 5);
    }
    await close();
    assert.deepEqual(bad, {}, 'DARK_CARDS_READABLE ' + JSON.stringify(bad));
  });

  await test('④ 어두운 화면 글자색 치환은 color: 에만 — 배경·테두리에 쓴 같은 색은 그대로 · 밝은 화면 복귀', async () => {
    const r = await page.evaluate(() => { const a = document.createElement('div'); a.id = 'TEST_A'; a.setAttribute('style', 'border:1px solid #0b4ea2;background-color:#0b4ea2;color:#fff;padding:4px'); a.textContent = 'x'; const b = document.createElement('span'); b.id = 'TEST_B'; b.setAttribute('style', 'font-size:12px;color:#0b4ea2'); b.textContent = 'y'; document.getElementById('view').append(a, b); const out = { aBg: getComputedStyle(a).backgroundColor, aColor: getComputedStyle(a).color, bColor: getComputedStyle(b).color }; a.remove(); b.remove(); return out; });
    assert.deepEqual(r, { aBg: 'rgb(11, 78, 162)', aColor: 'rgb(255, 255, 255)', bColor: 'rgb(106, 176, 255)' });
    assert.equal(await dark(false), false);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`darkcards-v453: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL darkcards-v453', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

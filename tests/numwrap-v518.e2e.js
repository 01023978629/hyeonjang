/* v518 폰(390px)에서 금액·시간 숫자가 중간에서 끊기지 않게 — 견적 정산 탭 '견적 합계' 칸은 한 줄 전체, 통계 칸은 띄어쓰기에서 먼저 줄바꿈(개발_백로그). 합성(데모) 자료만, 외부 쓰기 0.
   ① 견적 정산 탭: 합계 금액 칸이 줄 전체 폭(300px 넘게)이고 금액('55,500,000원')이 한 줄 · 작은 칸 둘은 한 줄에 나란히 (NUMWRAP)
   ② ⏱ 작업시간 창 통계 칸: '60시간 30분' 이 '60시간 30' / '분' 처럼 숫자·단위 사이에서 끊기지 않음(줄이 '분'·'시간'으로 시작하지 않음) · 넘침 없음 · 오류 0
   HJ_V518_BASELINE=<commit> 은 NUMWRAP 에서 실패해야 한다. HJ_V518_MUTATION=no-fullrow(합계 칸 줄 전체 규칙 없음)도 NUMWRAP 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V518_MUTATION || '';
let html = process.env.HJ_V518_BASELINE ? execFileSync('git', ['show', process.env.HJ_V518_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-fullrow');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = '.estimate-overview>div:last-child{flex-basis:100%}';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.evaluate(async () => { closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue; try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}
    __mobileMode = true; applyMobileMode(); loadDemo(); closeModal(true); });
  await page.addScriptTag({ content: `window.__lines = el => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rc = r.getClientRects()[0]; if (!rc || !rc.width) continue; const top = Math.round(rc.top), last = out[out.length - 1]; if (last && Math.abs(last.top - top) < 4) last.t += n.data[i]; else out.push({ top, t: n.data[i] }); } } return out.map(x => x.t.trim()).filter(Boolean); };` });
  async function test(name, fn) { await fn(); passed++; console.log('PASS numwrap-v518 ' + name); }

  await test('① 견적 정산 탭 합계 금액 칸 줄 전체·한 줄 (NUMWRAP)', async () => {
    await page.evaluate(() => { closeModal(true); state.activeProject = null; state.tab = 'estimates'; render(); window.scrollTo(0, 0); });
    await page.locator('.estimate-overview').waitFor();
    const r = await page.evaluate(() => { const tiles = [...document.querySelectorAll('.estimate-overview > div')], money = tiles.at(-1).querySelector('b');
      return { n: tiles.length, w: tiles.map(t => Math.round(t.getBoundingClientRect().width)), tops: tiles.map(t => Math.round(t.getBoundingClientRect().top)), money: money.textContent.trim(), lines: __lines(money) }; });
    assert.equal(r.n, 3); assert.match(r.money, /^[\d,]+원$/, 'money text ' + r.money);
    assert.deepEqual(r.lines, [r.money], 'NUMWRAP money in one line ' + JSON.stringify(r));
    assert(r.w[2] > 300, 'NUMWRAP money tile full row ' + JSON.stringify(r.w)); assert.equal(r.tops[0], r.tops[1], 'two small tiles side by side');
  });

  await test('② 작업시간 통계 칸: 숫자·단위 사이에서 안 끊김 · 넘침 없음 · 오류 0', async () => {
    await page.evaluate(() => { const today = localDate(), A = state.projects[0].name; let i = 0;
      state.workLogs = Array.from({ length: 7 }, (_, k) => ({ id: 'TEST_N' + (++i), project: A, date: hjAddDays(today, -k), in: '08:00', out: k === 6 ? '14:30' : '17:00', memo: '' })); workView(''); });
    await page.locator('#modalRoot .worklog-row').first().waitFor();
    const t = await page.evaluate(() => [...document.querySelectorAll('#modalRoot div')].filter(d => /^\d+시간( \d+분)?$/.test(d.textContent.trim()) && !d.children.length).map(d => ({ t: d.textContent.trim(), lines: __lines(d) })));
    assert(t.length >= 1 && t.some(x => x.t === '60시간 30분'), 'tiles ' + JSON.stringify(t));
    for (const x of t) assert(x.lines.every(l => !/^(분|시간)/.test(l)), 'NUMWRAP no line starts with a unit ' + JSON.stringify(x));
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`numwrap-v518: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL numwrap-v518', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

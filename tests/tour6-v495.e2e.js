/* v495 🧭 데모 둘러보기 6단계 — 셋째 '👷 팀 보고 노트'(개발_백로그). 합성(데모) 자료만, 외부 쓰기 0.
   ① 데모 카드 6단계, 3번 '👷 팀 보고 노트' [열기](44px) → 망원동 카페 노트 창(칩·[📋 글로 복사]) · 그 단계 ✓ · '봤어요 1/5 · 6단계' · 데모 자료 불변 (TOUR6)
   ② PC 1280: 3줄 × 2칸(5·6 나란히, 끝내기도 반 칸) · 390px 한 칸 · 넘침 없음 · 오류 0
   HJ_V495_BASELINE=<commit> 은 TOUR6 에서 실패해야 한다. HJ_V495_MUTATION=no-note(단추가 노트를 안 엶)도 TOUR6 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V495_MUTATION || '';
let html = process.env.HJ_V495_BASELINE ? execFileSync('git', ['show', process.env.HJ_V495_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-note');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "if(go==='note'){hjDemoTourMarkDone(go);hjTeamReportNoteView(HJ_DEMO_CAFE);return true;}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open(width, height, mobile) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error))); page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; aiOpsEnsureState().enabled = false; __mobileMode = !!mobile; applyMobileMode(); await loadDemo(); }, { keys: BOOT, mobile });
  await page.locator('#view [data-demo-tour]').waitFor();
  return { context, page };
}
const card = page => page.evaluate(() => { const d = document.querySelector('#view [data-demo-tour]'); return { steps: [...d.querySelectorAll('[data-demo-tour-step]')].map(li => li.innerText.replace(/\s+/g, ' ').trim()), btns: [...d.querySelectorAll('[data-demo-tour-go]')].map(b => [b.getAttribute('data-demo-tour-go'), Math.round(b.getBoundingClientRect().height)]),
  done: [...d.querySelectorAll('[data-demo-tour-step][data-done]')].map(li => li.getAttribute('data-demo-tour-step')), seen: d.querySelector('[data-demo-tour-seen]').textContent.trim(),
  li: [...d.querySelectorAll('[data-demo-tour-step]')].map(n => { const r = n.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; }), ov: [d.scrollWidth - d.clientWidth, document.documentElement.scrollWidth - innerWidth] }; });

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS tour6-v495 ' + name); }

  await test('① 6단계 · 3번 [열기] → 망원동 카페 노트 창(칩·글로 복사) · ✓ · "봤어요 1/5 · 6단계" · 자료 불변 (TOUR6)', async () => {
    const { context, page } = await open(390, 800, true);
    const before = await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
    let c = await card(page);
    assert.equal(c.steps.length, 6, 'TOUR6 six steps ' + JSON.stringify(c.steps)); assert.match(c.steps[2], /^3\. 👷 팀 보고 노트 /, c.steps[2]);
    assert.deepEqual(c.btns.map(b => b[0]), ['pending', 'report', 'note', 'aptdocs', 'ledger', 'exit']); assert(c.btns.every(b => b[1] >= 44), 'tap targets');
    assert.match(c.seen, /^6단계 · 3분$/, c.seen);
    await page.locator('#view [data-demo-tour-go="note"]').click();
    await page.locator('#modalRoot #hjTeamNote').waitFor({ timeout: 3000 }).catch(() => {});
    const note = await page.evaluate(() => ({ title: (document.getElementById('modalTitle') || {}).textContent || '', chips: !!document.querySelector('#modalRoot [data-note-filter]'), copy: !!document.querySelector('#modalRoot [data-team-note-copy]') }));
    assert.match(note.title, /팀 작업 보고 — 망원동 카페/, 'TOUR6 note window opens ' + JSON.stringify(note)); assert.equal(note.chips, true); assert.equal(note.copy, true);
    await page.evaluate(() => closeModal(true));
    c = await card(page);
    assert.deepEqual(c.done, ['3'], 'step 3 marked'); assert.match(c.seen, /^봤어요 1\/5 · 6단계/, c.seen);
    assert.equal(await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); }), before, 'demo data unchanged');
    await context.close();
  });

  await test('② PC 1280 3줄 × 2칸(5·6 나란히) · 390 한 칸 · 넘침 없음 · 오류 0', async () => {
    let { context, page } = await open(1280, 860, false);
    let c = await card(page);
    assert.equal(c.li[0].t, c.li[1].t); assert.equal(c.li[2].t, c.li[3].t); assert.equal(c.li[4].t, c.li[5].t, 'steps 5 and 6 share the last row ' + JSON.stringify(c.li));
    assert(c.li[5].l > c.li[4].l + 100 && Math.abs(c.li[5].w - c.li[4].w) <= 2, 'exit step takes the right half');
    assert(c.ov.every(x => x <= 1), 'overflow ' + JSON.stringify(c.ov));
    await context.close();
    ({ context, page } = await open(390, 800, true));
    c = await card(page);
    for (let i = 1; i < c.li.length; i++) assert(c.li[i].t > c.li[i - 1].t, 'one column on the phone');
    assert(c.ov.every(x => x <= 1), 'phone overflow ' + JSON.stringify(c.ov));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`tour6-v495: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL tour6-v495', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

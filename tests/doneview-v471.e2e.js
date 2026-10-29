/* v471 첫 화면 '📄 팀 보고 n건 들어옴' 줄에 [보기](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① v458 줄에 [완료보고서 초안]·[보기]·[넘기기] 세 단추(44px) — [보기] → v466 노트 창, 가장 최근 완료 보고(완료보고서 안 만든 것)에 초점 · 자료 불변 (DONE_VIEW)
   ② [넘기기]·[완료보고서 초안]은 그대로 동작 · 390px 넘침 없음 · 오류 0
   HJ_V471_BASELINE=<commit> 은 DONE_VIEW 에서 실패해야 한다. HJ_V471_MUTATION=no-key(초점 열쇠를 안 넘김)도 DONE_VIEW 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T11 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V471_MUTATION || '';
let html = process.env.HJ_V471_BASELINE ? execFileSync('git', ['show', process.env.HJ_V471_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-key');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "key:String(rows[rows.length-1].key||'')}:null;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "key:''}:null;");
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
  await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    window.__v471 = { pdf: 0 }; buildAptReportPDF = async o => { __v471.pdf++; return { pages: 1, photos: o.photos.length }; };
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7101', addr: '대전 서구 둔산동' },
      workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
        { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거·폐기물 반출', issue: '', reporter: '김타일', checklist: [], photos: 2, at },
        { key: 'TEST_R2', status: 'done', workDate: ago(1), hours: 6, done: '벽·바닥 타일 시공 완료', issue: '', reporter: '김타일', checklist: [], photos: 3, at }] }] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS doneview-v471 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① 줄에 [완료보고서 초안]·[보기]·[넘기기] · [보기] → 노트 창, 가장 최근 완료 보고에 초점 · 자료 불변 (DONE_VIEW)', async () => {
    await page.locator('#view [data-team-done-doc]').waitFor();
    const before = await serialized();
    const btns = await page.locator('#view [data-team-done-doc] button').evaluateAll(ns => ns.map(n => [n.textContent.trim(), Math.round(n.getBoundingClientRect().height), n.getAttribute('data-team-note')]));
    assert.deepEqual(btns.map(b => b[0]), ['완료보고서 초안', '보기', '넘기기'], 'DONE_VIEW buttons ' + JSON.stringify(btns)); assert(btns.every(b => b[1] >= 44), 'tap targets');
    assert.equal(btns[1][2], 'TEST_R2', 'DONE_VIEW focus key = latest done report');
    await page.locator('#view [data-team-done-doc] [data-team-note]').click(); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const r = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-team-note]')].map(n => [n.getAttribute('data-team-note'), n.hasAttribute('data-focus')]));
    assert.deepEqual(r, [['TEST_R2', true], ['TEST_R1', false]], 'DONE_VIEW note window focused on the latest done report ' + JSON.stringify(r));
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'nothing changed');
  });

  await test('② [완료보고서 초안]·[넘기기] 그대로 · 390px 넘침 없음 · 오류 0', async () => {
    await page.locator('#view [data-team-done-open]').click(); await page.locator('#modalRoot #rpWorks').waitFor(); await page.evaluate(() => closeModal(true));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow at 390px');
    await page.locator('#view [data-team-done-skip]').click(); await page.waitForFunction(() => !document.querySelector('#view [data-team-done-doc]'));
    assert.deepEqual(await page.evaluate(n => hjTeamReportsOf(state.projects.find(p => p.name === n)).map(r => !!r.docAck), APT), [true, true]);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`doneview-v471: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL doneview-v471', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

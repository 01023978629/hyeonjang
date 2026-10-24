/* v484 👷 팀 보고 노트 줄 — '지시 wo_…' 대신 사람이 읽는 지시 이름(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 지시에 제목이 있으면 '지시: 제목(M/D)'(지시 date, 없으면 due) + 마우스를 올리면 번호(title) · 제목이 없으면 '지시 wo_…' 그대로 · 지시 없는 보고는 '보고만'
      · 제목의 <b>·& 는 글자로(꼴 안 바뀜) · [📋 글로 복사]에도 '지시: 제목(M/D)', 번호만 있는 지시는 빼고 · 자료 불변 (ORDER_NAME)
   ② 390px 넘침 없음 · 오류 0
   HJ_V484_BASELINE=<commit> 은 ORDER_NAME 에서 실패해야 한다. HJ_V484_MUTATION=no-title(지시를 못 찾음)도 ORDER_NAME 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T24 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V484_MUTATION || '';
let html = process.env.HJ_V484_BASELINE ? execFileSync('git', ['show', process.env.HJ_V484_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-title');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const w=hjWoOrders(p).find(o=>o.packetId===id),t=';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const w=null,t=');
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
  const D = await page.evaluate(async ({ APT }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos: 0, at });
    const wo = (packetId, extra, reports) => Object.assign({ packetId, sentAt: at, via: 'copy', assignee: '김타일', priority: 'normal', checklist: [], items: [], reports }, extra);
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8401', addr: '대전 서구 둔산동' },
      workOrders: [wo('wo_20261020_001', { title: '욕실 타일 1차', date: ago(4), due: ago(2) }, [rep('TEST_R1', 'done', 3, '바닥 타일', '', '김타일')]),
        wo('wo_20261021_002', { due: ago(1) }, [rep('TEST_R2', 'review', 2, '벽 타일', '줄눈 색', '김타일')]),
        wo('wo_20261022_003', { title: '<b>줄눈</b> & 실리콘', due: ago(1) }, [rep('TEST_R4', 'done', 0, '실리콘 마감', '', '박설비')])],
      teamReports: [rep('TEST_R3', 'blocked', 1, '', '자재 미도착', '박설비')] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    const md = n => { const d = ago(n); return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); };
    return { m4: md(4), m1: md(1) };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS ordername-v484 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot #hjTeamNote [data-team-note]')].map(n => { const meta = n.querySelector('div > span'), o = n.querySelector('[data-team-note-order]');
    return { key: n.getAttribute('data-team-note'), meta: meta ? meta.textContent.trim() : '', order: o ? [o.textContent, o.getAttribute('title'), o.children.length] : null }; }));

  await test('① 제목 있으면 "지시: 제목(M/D)"·title 에 번호 · 없으면 번호 · 지시 없으면 "보고만" · 특수문자는 글자로 · 복사에도 · 자료 불변 (ORDER_NAME)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const r = await rows();
    assert.deepEqual(r.map(x => x.key), ['TEST_R4', 'TEST_R3', 'TEST_R2', 'TEST_R1']);
    assert.deepEqual(r[0].order, ['지시: <b>줄눈</b> & 실리콘(' + D.m1 + ')', 'wo_20261022_003', 0], 'ORDER_NAME title with due date, escaped ' + JSON.stringify(r[0]));
    assert.deepEqual(r[3].order, ['지시: 욕실 타일 1차(' + D.m4 + ')', 'wo_20261020_001', 0], 'ORDER_NAME title with order date ' + JSON.stringify(r[3]));
    assert.equal(r[2].order, null); assert.match(r[2].meta, /지시 wo_20261021_002$/, 'no title → number as before');
    assert.equal(r[1].order, null); assert.match(r[1].meta, /보고만$/);
    await page.locator('#modalRoot [data-team-note-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    const lines = (await page.evaluate(() => window.__copied[0])).split('\n');
    assert.match(lines[1], new RegExp('\\(박설비 · 2시간 · 지시: <b>줄눈</b> & 실리콘\\(' + D.m1 + '\\)\\)$'), 'copy has the title: ' + lines[1]);
    assert.doesNotMatch(lines[3], /지시/, 'number-only order left out of the copy: ' + lines[3]);
    assert.match(lines[4], new RegExp('지시: 욕실 타일 1차\\(' + D.m4 + '\\)\\)$'), lines[4]);
    assert.equal(await serialized(), before, 'read-only — app data unchanged');
  });

  await test('② 390px 넘침 없음 · 오류 0', async () => {
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`ordername-v484: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL ordername-v484', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

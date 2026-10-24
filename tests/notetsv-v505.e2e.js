/* v505 👷 팀 보고 노트 창 — [📊 엑셀용 복사](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 보이는 보고를 탭 표로: 머리 '날짜 상태 보고자 시간 한 일 이슈 사진 지시 확인' + 줄(최근 것부터, 상태 글자만, 시간·사진 숫자,
      셀 안 탭·줄바꿈 빈칸, 지시 이름, 확인한 검수·막힘은 '확인함') · 칩을 따름 · 44px · 현장 이름·고객 정보 없음 · 자료 불변 (TSV)
   ② 클립보드가 막히면 예전 방식(execCommand) · 알림 · 오류 0
   HJ_V505_BASELINE=<commit> 은 TSV 에서 실패해야 한다. HJ_V505_MUTATION=no-head(머리줄 없음)도 TSV 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T43 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V505_MUTATION || '';
let html = process.env.HJ_V505_BASELINE ? execFileSync('git', ['show', process.env.HJ_V505_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-head');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const head=['날짜','상태','보고자','시간','한 일','이슈','사진','지시','확인'].join('\\t');";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "const head='';");
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
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0006', addr: '대전 서구 둔산동' },
      workOrders: [{ packetId: 'wo_20261020_001', title: '욕실 타일', sentAt: at, via: 'copy', assignee: '김타일', due: ago(3), priority: 'normal', checklist: [], items: [],
        reports: [{ key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 6, done: '벽 타일\t1차\n완료', issue: '', reporter: '김타일', checklist: [], photos: 4, at }] }],
      teamReports: [{ key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2.5, done: '줄눈', issue: '색 확인', reporter: '김타일', checklist: [], photos: 0, at, ack: true, ackAt: today },
        { key: 'TEST_R3', status: 'blocked', workDate: ago(1), hours: 0, done: '', issue: '자재 미도착', reporter: '박설비', checklist: [], photos: 1, at }] }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V505_SEED_SAVE_FAILED');
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { d1: ago(1), d2: ago(2), d3: ago(3), order: hjTeamReportOrderTitle(state.projects[0], 'wo_20261020_001') };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notetsv-v505 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  let copies = 0;
  const copy = async () => { copies++; await page.locator('#modalRoot [data-team-note-tsv]').click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n').map(l => l.split('\t')); };
  const HEAD = ['날짜', '상태', '보고자', '시간', '한 일', '이슈', '사진', '지시', '확인'];

  await test('① 탭 표 머리·줄(상태 글자·숫자·지시 이름·확인함) · 칩을 따름 · 44px · 현장·고객 정보 없음 · 자료 불변 (TSV)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    const b = await page.evaluate(() => { const x = document.querySelector('#modalRoot [data-team-note-tsv]'); return x ? [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)] : null; });
    assert.deepEqual(b, ['📊 엑셀용 복사', 44], 'TSV button');
    let T = await copy();
    assert.deepEqual(T, [HEAD,
      [D.d1, '막힘', '박설비', '', '', '자재 미도착', '1', '', ''],
      [D.d2, '검수 요청', '김타일', '2.5', '줄눈', '색 확인', '', '', '확인함'],
      [D.d3, '완료', '김타일', '6', '벽 타일 1차 완료', '', '4', D.order, '']], 'TSV rows ' + JSON.stringify(T));
    assert(D.order, 'order title resolved');
    const flat = T.flat().join(' ');
    assert.doesNotMatch(flat, /정테스트|010-|둔산 크로바/, 'no site or customer info');
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    T = await copy();
    assert.deepEqual(T.map(r => r[2]), ['보고자', '김타일', '김타일'], 'follows the chip');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 클립보드가 막히면 예전 방식 · 알림 · 오류 0', async () => {
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; window.__exec = []; window.__ex0 = document.execCommand.bind(document); document.execCommand = c => { window.__exec.push([c, (document.querySelector('body > textarea') || {}).value || '']); return true; }; });
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    await page.locator('#modalRoot [data-team-note-tsv]').click(); await page.waitForFunction(() => window.__exec.length === 1);
    const ex = await page.evaluate(() => window.__exec[0]);
    assert.equal(ex[0], 'copy'); assert.equal(ex[1].split('\n')[0], HEAD.join('\t'));
    assert.match(await page.evaluate(() => document.getElementById('toast').textContent), /보고 3건을 표\(엑셀용\)로 복사했어요/);
    await page.evaluate(() => { closeModal(true); document.execCommand = window.__ex0; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notetsv-v505: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notetsv-v505', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

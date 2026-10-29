/* v503 ⏱ 작업시간 창 — [📊 엑셀용 복사](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 보이는 줄을 탭으로 나눈 표로: 머리 '날짜 현장 시작 종료 시간 메모 팀 보고' + 줄(화면 순서, 시간은 시간 단위 숫자 3·4·1.5,
      진행 중은 종료·시간 빈칸, 메모 안 탭·줄바꿈은 빈칸, 팀 보고는 보고자) · 팀 칩을 따름 · 44px · 고객 정보 없음 · 자료 불변 (TSV)
   ② 클립보드가 막히면 예전 방식(execCommand) · 알림 · 오류 0
   HJ_V503_BASELINE=<commit> 은 TSV 에서 실패해야 한다. HJ_V503_MUTATION=no-head(머리줄 없음)도 TSV 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T41 둔산 크로바아파트 101동 1203호', B = 'TEST_T41 대흥동 상가 2층';
const MUT = process.env.HJ_V503_MUTATION || '';
let html = process.env.HJ_V503_BASELINE ? execFileSync('git', ['show', process.env.HJ_V503_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-head');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const head=['날짜','현장','시작','종료','시간','메모','팀 보고'].join('\\t');";
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
  const D = await page.evaluate(async ({ A, B }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    try { taxCalendarEnsure(); coworkSchedEnsure(); } catch (_) {}   // 부팅 4~4.5초 뒤 도는 자료 씨앗(세금 일정·예약)을 미리 — 늦게 끼어들어 '자료 불변'이 흔들리지 않게
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-0004', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [{ key: 'TEST_K1', status: 'done', workDate: ago(2), hours: 4, done: '타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }]), proj(B, [])];
    state.workLogs = [{ id: 'TEST_A0', project: A, date: today, in: '08:30', out: '', memo: '' },
      { id: 'TEST_A1', project: A, date: ago(1), in: '09:00', out: '12:00', memo: '바닥\t철거\n2차' },
      { id: 'TEST_A2', project: A, date: ago(2), in: '13:00', out: '17:00', memo: '[팀 보고 · 김타일]', teamReport: { key: 'TEST_K1', orderId: '', hours: 4, reporter: '김타일' } },
      { id: 'TEST_B1', project: B, date: ago(3), in: '09:00', out: '10:30', memo: '' }];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { d0: today, d1: ago(1), d2: ago(2), d3: ago(3) };
  }, { A, B });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wltsv-v503 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  let copies = 0;
  const copy = async () => { copies++; await page.locator('#modalRoot [data-wl-copy-tsv]').click(); await page.waitForFunction(k => window.__copied.length === k, copies); return (await page.evaluate(() => window.__copied.at(-1))).split('\n').map(l => l.split('\t')); };
  const HEAD = ['날짜', '현장', '시작', '종료', '시간', '메모', '팀 보고'];

  await test('① 탭 표 머리·줄(시간 숫자·진행 중 빈칸·메모 정리·팀 보고자) · 팀 칩 · 44px · 고객 정보 없음 · 자료 불변 (TSV)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const b = await page.evaluate(() => { const x = document.querySelector('#modalRoot [data-wl-copy-tsv]'); return x ? [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)] : null; });
    assert.deepEqual(b, ['📊 엑셀용 복사', 44], 'TSV button');
    let T = await copy();
    assert.deepEqual(T, [HEAD,
      [D.d0, A, '08:30', '', '', '', ''],
      [D.d1, A, '09:00', '12:00', '3', '바닥 철거 2차', ''],
      [D.d2, A, '13:00', '17:00', '4', '[팀 보고 · 김타일]', '김타일'],
      [D.d3, B, '09:00', '10:30', '1.5', '', '']], 'TSV rows ' + JSON.stringify(T));
    assert.doesNotMatch(T.flat().join(' '), /정테스트|010-/, 'no customer name/phone');
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    T = await copy();
    assert.deepEqual(T, [HEAD, [D.d2, A, '13:00', '17:00', '4', '[팀 보고 · 김타일]', '김타일']], 'follows the chip');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 클립보드가 막히면 예전 방식 · 알림 · 오류 0', async () => {
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; window.__exec = []; window.__ex0 = document.execCommand.bind(document); document.execCommand = c => { window.__exec.push([c, (document.querySelector('body > textarea') || {}).value || '']); return true; }; });
    await page.evaluate(n => workView(n), B); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await page.locator('#modalRoot [data-wl-copy-tsv]').click(); await page.waitForFunction(() => window.__exec.length === 1);
    const ex = await page.evaluate(() => window.__exec[0]);
    assert.equal(ex[0], 'copy'); assert.equal(ex[1].split('\n')[0], HEAD.join('\t'));
    assert.match(await page.evaluate(() => document.getElementById('toast').textContent), /작업시간 1줄을 표\(엑셀용\)로 복사했어요/);
    await page.evaluate(() => { closeModal(true); document.execCommand = window.__ex0; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wltsv-v503: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wltsv-v503', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

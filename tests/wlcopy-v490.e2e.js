/* v490 ⏱ 작업시간 창 — [📋 보이는 n줄 글로 복사](개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 35줄이면 보이는 30줄만: 머리줄 '⏱ 작업시간 — 전체 · 30줄' + '- M/D(요일) 현장 시작~종료 (시간) 메모'(진행 중 줄은 시간 없음) + '합계 …'
      · 팀 보고만 칩 → 머리줄에 칩·그 줄만 · 현장 창은 줄에 현장 이름 없음 · [더 보기] 뒤 35줄 · 44px · 자료 불변 (COPY)
      · v496: 전체 창 복사는 합계 뒤에 '현장별 소계' 3줄이 붙는다(두 현장) — 줄 수·합계 위치를 그에 맞춤
   ② 클립보드가 막히면 예전 방식(execCommand) · 알림 · 오류 0
   HJ_V490_BASELINE=<commit> 은 COPY 에서 실패해야 한다. HJ_V490_MUTATION=no-visible(안 보이는 줄까지 복사)도 COPY 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const A = 'TEST_T29 둔산 크로바아파트 101동 1203호', B = 'TEST_T29 대흥동 상가 2층';
const MUT = process.env.HJ_V490_MUTATION || '';
let html = process.env.HJ_V490_BASELINE ? execFileSync('git', ['show', process.env.HJ_V490_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-visible');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'hjWorkCopy(pjName,visible,{';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'hjWorkCopy(pjName,view,{');
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
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const proj = (name, reports) => ({ name, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9001', addr: '대전 서구 둔산동' }, teamReports: reports });
    state.projects = [proj(A, [{ key: 'TEST_K1', status: 'done', workDate: ago(2), hours: 4, done: '타일', issue: '', reporter: '김타일', checklist: [], photos: 0, at }]), proj(B, [])];
    state.workLogs = [{ id: 'TEST_A0', project: A, date: today, in: '08:30', out: '', memo: '' },
      { id: 'TEST_A1', project: A, date: ago(1), in: '09:00', out: '12:00', memo: '바닥 철거' },
      { id: 'TEST_A2', project: A, date: ago(2), in: '13:00', out: '17:00', memo: '[팀 보고 · 김타일]', teamReport: { key: 'TEST_K1', orderId: '', hours: 4, reporter: '김타일' } },
      ...Array.from({ length: 32 }, (_, i) => ({ id: 'TEST_B' + (i + 3), project: B, date: ago(i + 3), in: '09:00', out: '11:00', memo: '' }))];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { m0: hjMdDow(today), m1: hjMdDow(ago(1)), m2: hjMdDow(ago(2)), m3: hjMdDow(ago(3)), h2: workHM(120), h3: workHM(180), h4: workHM(240), sum30: workHM(180 + 240 + 27 * 120), sum35: workHM(180 + 240 + 32 * 120), sumA: workHM(420), hA2: workHM(420).trim(), hB27: workHM(27 * 120).trim(), hB32: workHM(32 * 120).trim() };
  }, { A, B });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlcopy-v490 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const btn = () => page.evaluate(() => { const b = document.querySelector('#modalRoot [data-wl-copy]'); return b ? [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)] : null; });
  const copy = async n => { await page.locator('#modalRoot [data-wl-copy]').click(); await page.waitForFunction(k => window.__copied.length === k, n); return (await page.evaluate(() => window.__copied.at(-1))).split('\n'); };

  await test('① 보이는 30줄만 · 머리줄·줄·합계 · 팀 칩 · 현장 창 · 더 보기 뒤 35줄 · 44px · 자료 불변 (COPY)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    assert.deepEqual(await btn(), ['📋 보이는 30줄 글로 복사', 44], 'COPY button');
    let L = await copy(1);
    assert.equal(L[0], '⏱ 작업시간 — 전체 · 30줄', 'COPY header (visible rows only) ' + L[0]);
    assert.equal(L.length, 35, 'header + 30 lines + total + v496 site subtotal (3)');
    assert.equal(L[1], '- ' + D.m0 + ' ' + A + ' 08:30~진행 중');
    assert.equal(L[2], '- ' + D.m1 + ' ' + A + ' 09:00~12:00 (' + D.h3 + ') 바닥 철거');
    assert.equal(L[3], '- ' + D.m2 + ' ' + A + ' 13:00~17:00 (' + D.h4 + ') [팀 보고 · 김타일]');
    assert.equal(L[4], '- ' + D.m3 + ' ' + B + ' 09:00~11:00 (' + D.h2 + ')', 'plain row without memo');
    assert.equal(L[31], '합계 ' + D.sum30, 'total of visible rows');
    assert.deepEqual(L.slice(32), ['현장별 소계 (진행 중 1줄 제외)', '- ' + B + ' · 27줄 · ' + D.hB27, '- ' + A + ' · 2줄 · ' + D.hA2], 'v496 site subtotal of the visible rows');
    assert.doesNotMatch(L.join('\n'), /정테스트|010-/, 'no customer name/phone');
    await page.locator('#modalRoot [data-wl-filter="team"]').click(); await page.locator('#modalRoot [data-wl-team-sum]').waitFor();
    L = await copy(2);
    assert.deepEqual(L, ['⏱ 작업시간 — 전체 · 👷 팀 보고 · 1줄', '- ' + D.m2 + ' ' + A + ' 13:00~17:00 (' + D.h4 + ') [팀 보고 · 김타일]', '합계 ' + D.h4], 'COPY follows the chip');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => workView(n), A); await page.locator('#modalRoot .worklog-row').first().waitFor();
    L = await copy(3);
    assert.deepEqual(L, ['⏱ 작업시간 — ' + A + ' · 3줄', '- ' + D.m0 + ' 08:30~진행 중', '- ' + D.m1 + ' 09:00~12:00 (' + D.h3 + ') 바닥 철거', '- ' + D.m2 + ' 13:00~17:00 (' + D.h4 + ') [팀 보고 · 김타일]', '합계 ' + D.sumA], 'project window: no site name per line');
    await page.evaluate(() => closeModal(true));
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    const mb = page.locator('#modalRoot [data-wl-more-btn]'); await mb.scrollIntoViewIfNeeded(); await mb.click();
    await page.waitForFunction(() => document.querySelectorAll('#modalRoot .worklog-row').length === 35);
    assert.deepEqual(await btn(), ['📋 보이는 35줄 글로 복사', 44]);
    L = await copy(4); assert.equal(L[0], '⏱ 작업시간 — 전체 · 35줄'); assert.equal(L[36], '합계 ' + D.sum35);
    assert.deepEqual(L.slice(37), ['현장별 소계 (진행 중 1줄 제외)', '- ' + B + ' · 32줄 · ' + D.hB32, '- ' + A + ' · 2줄 · ' + D.hA2], 'v496 subtotal follows [더 보기]');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'copy only — app data unchanged');
  });

  await test('② 클립보드가 막히면 예전 방식 · 알림 · 오류 0', async () => {
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; window.__exec = []; window.__ex0 = document.execCommand.bind(document); document.execCommand = c => { window.__exec.push([c, (document.querySelector('body > textarea') || {}).value || '']); return true; }; });
    await page.evaluate(n => workView(n), A); await page.locator('#modalRoot .worklog-row').first().waitFor();
    await page.locator('#modalRoot [data-wl-copy]').click(); await page.waitForFunction(() => window.__exec.length === 1);
    const ex = await page.evaluate(() => window.__exec[0]);
    assert.equal(ex[0], 'copy'); assert.match(ex[1], /^⏱ 작업시간 — TEST_T29 둔산 크로바아파트 101동 1203호 · 3줄\n/);
    assert.match(await page.evaluate(() => document.getElementById('toast').textContent), /작업시간 3줄을 글로 복사했어요/);
    await page.evaluate(() => { closeModal(true); document.execCommand = window.__ex0; });
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlcopy-v490: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlcopy-v490', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

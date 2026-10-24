/* v493 ⏱ 작업시간 창 — '📅 지난달' 칩(개발_백로그, 월초 정산용). 합성 자료만, 외부 쓰기 0. 날짜는 오늘 기준(이번 달·지난달·지지난달).
   ① [전부 6]·[👷 팀 보고만 1]·[📅 이번 달 2]·[📅 지난달 3] → 지난달만(지난달 1일·말일 포함, 지지난달 제외), 합계 줄 · 이번 달을 누르면 지난달이 꺼짐(하나만)
      · 팀 칩과 함께 → 둘 다 맞는 줄·합계 줄 · [📋 글로 복사] 머리줄에 '📅 지난달' · [전부] · 위 칸 그대로 · 자료 불변 (PREV)
   ② 1월이면 지난달 = 지난해 12월(localDate 를 2027-01-15 로) · 지난달 기록이 없으면 칩 없음 · 오류 0
   HJ_V493_BASELINE=<commit> 은 PREV 에서 실패해야 한다. HJ_V493_MUTATION=no-prev(칩을 눌러도 줄이 안 줄어듦)도 PREV 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T32 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V493_MUTATION || '';
let html = process.env.HJ_V493_BASELINE ? execFileSync('git', ['show', process.env.HJ_V493_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-prev');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'const list=prevOnly?view.filter(isPrev):view;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'const list=view;');
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
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = [];
    const today = localDate(), first = today.slice(0, 7) + '-01', prevLast = hjAddDays(first, -1), prevFirst = prevLast.slice(0, 7) + '-01', ppLast = hjAddDays(prevFirst, -1), at = new Date().toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9301', addr: '대전 서구 둔산동' },
      teamReports: [{ key: 'TEST_K1', status: 'done', workDate: prevFirst, hours: 4, done: '철거', issue: '', reporter: '김타일', checklist: [], photos: 0, at }] }];
    const w = (id, date, inT, outT, team) => Object.assign({ id, project: APT, date, in: inT, out: outT, memo: id }, team ? { teamReport: { key: team, orderId: '', hours: 4, reporter: '김타일' } } : {});
    state.workLogs = [w('TEST_P1', today, '09:00', '12:00'), w('TEST_P2', first, '09:00', '10:00'), w('TEST_Q1', prevLast, '09:00', '18:00'), w('TEST_Q2', prevLast.slice(0, 7) + '-15', '08:00', '10:00'), w('TEST_T1', prevFirst, '13:00', '17:00', 'TEST_K1'), w('TEST_R1', ppLast, '09:00', '11:00')];
    state.activeProject = null; state.tab = 'dashboard'; render();
    window.__copied = []; navigator.clipboard.writeText = async t => { window.__copied.push(t); };
    return { prev3: workHM(540 + 120 + 240), both: workHM(240), month2: workHM(180 + 60) };
  }, { APT });
  async function test(name, fn) { await fn(); passed++; console.log('PASS wlprev-v493 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const win = () => page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); if (!m) return null; const sum = m.querySelector('[data-wl-team-sum]');
    return { chips: [...m.querySelectorAll('[data-wl-filter]')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed'), Math.round(b.getBoundingClientRect().height)]), ids: [...m.querySelectorAll('.worklog-row .wkEdit')].map(b => b.getAttribute('data-id')).sort(),
      sum: sum ? sum.textContent.trim() : '', tiles: m.querySelector('.mbody > div').innerText.replace(/\s+/g, ' ').trim() }; });
  const chip = async k => { await page.locator('#modalRoot [data-wl-filter="' + k + '"]').click(); await page.waitForTimeout(120); return win(); };

  await test('① [📅 지난달 3] → 지난달만 · 이번 달과 하나만 · 팀 칩과 함께 · 복사 머리줄 · [전부] · 위 칸 그대로 · 자료 불변 (PREV)', async () => {
    const before = await serialized();
    await page.evaluate(() => workView()); await page.locator('#modalRoot .worklog-row').first().waitFor();
    let w = await win(); const tiles = w.tiles;
    assert.deepEqual(w.chips, [['전부 6', 'true', 44], ['👷 팀 보고만 1', 'false', 44], ['📅 이번 달 2', 'false', 44], ['📅 지난달 3', 'false', 44]], 'PREV chips ' + JSON.stringify(w.chips));
    w = await chip('prev');
    assert.deepEqual(w.ids, ['TEST_Q1', 'TEST_Q2', 'TEST_T1'], 'PREV last month only (1st·last day in, two months ago out) ' + JSON.stringify(w.ids));
    assert.deepEqual(w.chips.map(c => c[1]), ['false', 'false', 'false', 'true']);
    assert.equal(w.sum, '📅 지난달 3줄 · 합계 ' + D.prev3 + ' — 위 칸은 전부 기준이에요', w.sum);
    w = await chip('month');
    assert.deepEqual(w.ids, ['TEST_P1', 'TEST_P2'], 'month on turns last month off'); assert.deepEqual(w.chips.map(c => c[1]), ['false', 'false', 'true', 'false']);
    w = await chip('prev');
    assert.deepEqual(w.chips.map(c => c[1]), ['false', 'false', 'false', 'true'], 'and the other way round');
    w = await chip('team');
    assert.deepEqual(w.ids, ['TEST_T1'], 'team + last month'); assert.equal(w.sum, '👷 팀 보고 · 📅 지난달 1줄 · 합계 ' + D.both + ' — 위 칸은 전부 기준이에요');
    await page.locator('#modalRoot [data-wl-copy]').click(); await page.waitForFunction(() => window.__copied.length === 1);
    assert.equal((await page.evaluate(() => window.__copied[0])).split('\n')[0], '⏱ 작업시간 — 전체 · 👷 팀 보고 · 📅 지난달 · 1줄', 'copy header names the chips');
    w = await chip('');
    assert.equal(w.ids.length, 6, '[전부] clears all'); assert.deepEqual(w.chips.map(c => c[1]), ['true', 'false', 'false', 'false']); assert.equal(w.tiles, tiles, 'tiles unchanged');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 1월이면 지난해 12월 · 지난달 기록 없으면 칩 없음 · 오류 0', async () => {
    const r = await page.evaluate(async () => {
      const ld = localDate, logs = state.workLogs;
      try {
        localDate = () => '2027-01-15';
        state.workLogs = [{ id: 'TEST_J1', project: logs[0].project, date: '2027-01-03', in: '09:00', out: '10:00', memo: '' }, { id: 'TEST_D1', project: logs[0].project, date: '2026-12-20', in: '09:00', out: '11:00', memo: '' }, { id: 'TEST_N1', project: logs[0].project, date: '2026-11-30', in: '09:00', out: '12:00', memo: '' }];
        workView();
        const chips = [...document.querySelectorAll('#modalRoot [data-wl-filter]')].map(b => b.textContent.trim());
        document.querySelector('#modalRoot [data-wl-filter="prev"]').click();
        const ids = [...document.querySelectorAll('#modalRoot .worklog-row .wkEdit')].map(b => b.getAttribute('data-id'));
        closeModal(true);
        state.workLogs = [{ id: 'TEST_J2', project: logs[0].project, date: '2027-01-03', in: '09:00', out: '10:00', memo: '' }, { id: 'TEST_N2', project: logs[0].project, date: '2026-11-30', in: '09:00', out: '12:00', memo: '' }];
        workView();
        const chips2 = [...document.querySelectorAll('#modalRoot [data-wl-filter]')].map(b => b.textContent.trim());
        closeModal(true);
        return { chips, ids, chips2 };
      } finally { localDate = ld; state.workLogs = logs; }
    });
    assert.deepEqual(r.chips, ['전부 3', '📅 이번 달 1', '📅 지난달 1'], 'January chips ' + JSON.stringify(r.chips));
    assert.deepEqual(r.ids, ['TEST_D1'], 'January → last December');
    assert.equal(r.chips2.some(c => /지난달/.test(c)), false, 'no last-month rows → no chip ' + JSON.stringify(r.chips2));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`wlprev-v493: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL wlprev-v493', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* v492 👷 팀 보고 노트 창 — PC(900px 이상, 모바일 모드 아님)에서 두 칸(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 1280px: 줄 1·2 가 같은 높이 왼→오, 3 은 그 아래 · 두 칸 폭 같음 · 사진 격자 펼쳐도 칸 안 · 빈 글은 두 칸 가득 · 순서 그대로 · 넘침 없음 · 자료 불변 (COL2)
   ② 390px 폰과 1280px 모바일 모드는 한 칸(왼쪽 같고 위→아래) · 오류 0
   HJ_V492_BASELINE=<commit> 은 COL2 에서 실패해야 한다. HJ_V492_MUTATION=one-col(격자 규칙 없음)도 COL2 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T31 둔산 크로바아파트 101동 1203호';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MUT = process.env.HJ_V492_MUTATION || '';
let html = process.env.HJ_V492_BASELINE ? execFileSync('git', ['show', process.env.HJ_V492_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'one-col');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'body:not(.mobile-mode) #hjTeamNote [data-team-note-list]{display:grid;';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'body:not(.mobile-mode) #hjTeamNote [data-team-note-list-off]{display:grid;');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width, height, mobile) {
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
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  // v519 설정 복원(폭·터치로 모바일 모드를 다시 정함)이 끝나면 푸터 #buildTag 가 채워진다 — 그 전에 정하면 느린 CI 에서 부팅이 되돌린다
  await page.waitForFunction(() => /^build /.test((document.getElementById('buildTag') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});   // 드물게 설정 복원이 멈추면(그땐 되돌리지도 않음) 그냥 진행
  await page.evaluate(async ({ keys, APT, PX, mobile }) => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    closeModal(true); aiOpsEnsureState().enabled = false; __mobileMode = !!mobile; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
    const rep = (key, status, days, done, issue, reporter, photos) => ({ key, status, workDate: ago(days), hours: 2, done, issue, reporter, checklist: [], photos, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-9201', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_R1', 'done', 5, '욕실 바닥 철거와 폐기물 반출, 바닥 미장 준비까지 마쳤습니다', '', '김타일', 2), rep('TEST_R2', 'review', 4, '벽 타일 1차', '줄눈 색 확인', '김타일', 0), rep('TEST_R3', 'blocked', 3, '', '자재 미도착', '박설비', 0),
        rep('TEST_R4', 'done', 2, '방수 1차', '', '박설비', 0), rep('TEST_R5', 'review', 1, '천장 목공', '', '김타일', 0)] }];
    state.files = [0, 1, 2, 3].map(i => ({ id: 'TEST_F' + i, name: 'f' + i + '.jpg', kind: 'photo', ext: 'jpg', project: APT, when: new Date(ago(5) + 'T1' + i + ':00:00+09:00'), thumb: PX, size: 1000, _virtual: true }));
    state.activeProject = null; state.tab = 'dashboard'; render(); }, { keys: BOOT, APT, PX, mobile });
  return { context, page };
}
const layout = page => page.evaluate(() => { const list = document.querySelector('#hjTeamNote [data-team-note-list]'), lr = list.getBoundingClientRect(), m = document.querySelector('#modalRoot .modal');
  return { list: Math.round(lr.width), rows: [...list.querySelectorAll(':scope > [data-team-note]')].map(n => { const r = n.getBoundingClientRect(); return { key: n.getAttribute('data-team-note'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; }),
    ov: [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth, list.scrollWidth - list.clientWidth] }; });

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS note2col-v492 ' + name); }

  await test('① 1280px 두 칸 · 순서 그대로 · 폭 같음 · 사진 격자 칸 안 · 빈 글 두 칸 가득 · 넘침 없음 · 자료 불변 (COL2)', async () => {
    const { context, page } = await openPage(1280, 860, false);
    const before = await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    let L = await layout(page);
    assert.deepEqual(L.rows.map(r => r.key), ['TEST_R5', 'TEST_R4', 'TEST_R3', 'TEST_R2', 'TEST_R1'], 'order unchanged');
    const [a, b, c] = L.rows;
    assert(Math.abs(a.y - b.y) <= 2 && b.x > a.x + 100, 'COL2 rows 1·2 side by side ' + JSON.stringify(L.rows));
    assert(c.y > a.y + 20 && Math.abs(c.x - a.x) <= 2, 'row 3 below row 1 ' + JSON.stringify(L.rows));
    assert(Math.abs(a.w - b.w) <= 2 && a.w < L.list * 0.6, 'equal half widths ' + JSON.stringify([a.w, b.w, L.list]));
    assert(L.ov.every(x => x <= 1), 'overflow ' + JSON.stringify(L.ov));
    await page.locator('#modalRoot [data-team-note="TEST_R1"] [data-team-note-photos]').click();
    L = await layout(page);
    const g = await page.evaluate(() => { const r = document.querySelector('#modalRoot [data-team-note="TEST_R1"]').getBoundingClientRect(), q = document.querySelector('#modalRoot [data-team-note-photo-grid]').getBoundingClientRect(); return [Math.round(q.left - r.left), Math.round(r.right - q.right)]; });
    assert(g.every(x => x >= 0), 'photo grid stays inside its column ' + JSON.stringify(g)); assert(L.ov.every(x => x <= 1), 'overflow with photos ' + JSON.stringify(L.ov));
    await page.locator('#modalRoot [data-note-filter-status="blocked"]').click();
    await page.locator('#modalRoot [data-note-filter-reporter="김타일"]').click();
    const e = await page.evaluate(() => { const n = document.querySelector('#hjTeamNote [data-team-note-empty]'), l = document.querySelector('#hjTeamNote [data-team-note-list]'); return n ? [Math.round(n.getBoundingClientRect().width), Math.round(l.getBoundingClientRect().width)] : null; });
    assert(e && Math.abs(e[0] - e[1]) <= 2, 'empty hint spans both columns ' + JSON.stringify(e));
    await page.evaluate(() => closeModal(true));
    assert.equal(await page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); }), before, 'screen only');
    await context.close();
  });

  await test('② 390px 폰·1280px 모바일 모드는 한 칸 · 오류 0', async () => {
    for (const [w, h, mobile] of [[390, 800, true], [1280, 860, true]]) {
      const { context, page } = await openPage(w, h, mobile);
      await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
      const L = await layout(page);
      assert(L.rows.every(r => Math.abs(r.x - L.rows[0].x) <= 2), 'one column at ' + w + ' ' + JSON.stringify(L.rows));
      assert(L.rows.every((r, i) => i === 0 || r.y > L.rows[i - 1].y), 'top to bottom at ' + w);
      assert(L.ov.every(x => x <= 1), 'overflow at ' + w + ' ' + JSON.stringify(L.ov));
      await context.close();
    }
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`note2col-v492: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL note2col-v492', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

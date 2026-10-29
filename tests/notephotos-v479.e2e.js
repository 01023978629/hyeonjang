/* v479 👷 팀 보고 노트 줄 — 사진 펼쳐 보기(개발_백로그 '팀 보고 노트 줄 사진 n장 → 사진 펼쳐 보기'). 합성 자료만, 외부 쓰기 0.
   ① 이 기기에 사진이 있는 보고에만 [📷 사진 n장 보기](44px, aria-expanded) — 완료보고서(v463)와 같은 규칙(열쇠 먼저, 아니면 작업일), 막힘은 남은 사진에서·사진 수가 있을 때만,
      썸네일 없는 사진은 뺌 · 누르면 줄 아래 격자, 썸네일 → 크게 보기(창 위에 겹침, 닫으면 창·격자 그대로) · 칩으로 다시 그려도 펼친 채 · 390px 넘침 없음 · 자료 불변 (PHOTOS)
   ② [확인함]으로 다시 그려도 펼친 채 · 창을 새로 열면 접힘 · ack 말고는 자료 불변 · 오류 0
   HJ_V479_BASELINE=<commit> 은 PHOTOS 에서 실패해야 한다. HJ_V479_MUTATION=no-grid(눌러도 격자를 안 넣음)도 PHOTOS 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T19 둔산 크로바아파트 101동 1203호';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MUT = process.env.HJ_V479_MUTATION || '';
let html = process.env.HJ_V479_BASELINE ? execFileSync('git', ['show', process.env.HJ_V479_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-grid');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "row.insertAdjacentHTML('beforeend',hjTeamNotePhotoGridHtml(key,files));";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
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
  await page.evaluate(async ({ APT, PX }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString(), when = (n, h) => new Date(ago(n) + 'T' + h + ':00:00+09:00');   // 앱의 사진 when 은 Date(fmtDate·사진 크게 보기가 Date 를 쓴다)
    const rep = (key, status, days, done, issue, reporter, photos) => ({ key, status, workDate: ago(days), hours: 3, done, issue, reporter, checklist: [], photos, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 2, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-7901', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_R1', 'done', 3, '욕실 바닥 타일 철거', '', '김타일', 2), rep('TEST_R2', 'review', 2, '벽 타일 1차', '줄눈 색 확인', '김타일', 1), rep('TEST_R3', 'blocked', 1, '', '배수구 위치 다름', '박설비', 1),
        rep('TEST_R4', 'done', 5, '방수 1차', '', '김타일', 2), rep('TEST_R5', 'blocked', 4, '', '자재 미도착', '박설비', 0)] }];
    const f = (id, n, h, extra) => Object.assign({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', project: APT, when: when(n, h), thumb: PX, size: 1000, _virtual: true }, extra || {});
    state.files = [f('TEST_F1', 3, '10'), f('TEST_F2', 3, '15'), f('TEST_F3', 6, '09', { _teamReport: 'TEST_R2' }), f('TEST_F4', 1, '11'), f('TEST_F5', 4, '09'), f('TEST_F6', 3, '12', { thumb: '' })];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V479_SEED_SAVE_FAILED');
  }, { APT, PX });
  async function test(name, fn) { await fn(); passed++; console.log('PASS notephotos-v479 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const strip = s => s.replace(/"ack":true,?/g, '').replace(/"ackAt":"\d{4}-\d{2}-\d{2}",?/g, '');
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot #hjTeamNote [data-team-note]')].map(n => { const b = n.querySelector('[data-team-note-photos]'), g = n.querySelector('[data-team-note-photo-grid]');
    return { key: n.getAttribute('data-team-note'), btn: b ? [b.textContent.trim(), b.getAttribute('aria-expanded'), Math.round(b.getBoundingClientRect().height)] : null, grid: g ? [...g.querySelectorAll('[data-team-note-photo]')].map(x => [x.getAttribute('data-team-note-photo'), Math.round(x.getBoundingClientRect().height) >= 44]) : null, text: n.innerText.replace(/\s+/g, ' ').trim() }; }));
  const row = async key => (await rows()).find(r => r.key === key);
  const photoBtn = key => page.locator('#modalRoot [data-team-note="' + key + '"] [data-team-note-photos]');

  await test('① 사진 있는 보고에만 [📷 사진 n장 보기] → 격자 · 썸네일 → 크게 보기 · 칩으로 다시 그려도 펼친 채 · 넘침 없음 · 자료 불변 (PHOTOS)', async () => {
    const before = await serialized();
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    let r = await rows();
    assert.deepEqual(r.map(x => [x.key, x.btn]), [['TEST_R3', ['📷 사진 1장 보기', 'false', 44]], ['TEST_R2', ['📷 사진 1장 보기', 'false', 44]], ['TEST_R1', ['📷 사진 2장 보기', 'false', 44]], ['TEST_R5', null], ['TEST_R4', null]], 'PHOTOS buttons ' + JSON.stringify(r.map(x => [x.key, x.btn])));
    assert.match(r[4].text, /사진 2장/, 'reported count still in the meta line'); assert.equal(r.every(x => x.grid === null), true, 'all folded at first');
    await photoBtn('TEST_R1').click();
    let r1 = await row('TEST_R1');
    assert.deepEqual(r1.grid, [['TEST_F1', true], ['TEST_F2', true]], 'PHOTOS grid — same-day photos with a thumbnail, oldest first ' + JSON.stringify(r1));
    assert.deepEqual(r1.btn.slice(0, 2), ['📷 사진 접기', 'true']);
    const ov = await page.evaluate(() => { const m = document.getElementById('hjTeamNote'); return { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    await page.locator('#modalRoot [data-team-note="TEST_R1"] [data-team-note-photo="TEST_F2"]').click();
    await page.locator('#lightbox #lbClose').waitFor();   // #lightbox 자체는 크기 0(안쪽이 fixed)
    assert.equal((await page.locator('#lightbox .lb-count').innerText()).trim(), '2 / 2', 'viewer walks only this report\'s photos');
    assert.equal(await page.locator('#modalRoot #hjTeamNote').count(), 1, 'note window stays under the viewer');
    await page.locator('#lbClose').click(); await page.waitForFunction(() => !document.getElementById('lightbox'));
    assert.deepEqual((await row('TEST_R1')).grid.map(x => x[0]), ['TEST_F1', 'TEST_F2'], 'grid still open after the viewer');
    await photoBtn('TEST_R2').click();
    assert.deepEqual((await row('TEST_R2')).grid.map(x => x[0]), ['TEST_F3'], 'keyed photo from another day');
    await photoBtn('TEST_R3').click();
    assert.deepEqual((await row('TEST_R3')).grid.map(x => x[0]), ['TEST_F4'], 'blocked report gets the left-over day photo');
    await page.locator('#modalRoot [data-note-filter-status="done"]').click();
    r = await rows();
    assert.deepEqual(r.map(x => [x.key, x.grid && x.grid.length]), [['TEST_R1', 2], ['TEST_R4', null]], 'chip re-render keeps R1 open');
    await page.locator('#modalRoot [data-note-filter-status=""]').click();
    r = await rows();
    assert.deepEqual(r.map(x => [x.key, x.grid && x.grid.length]), [['TEST_R3', 1], ['TEST_R2', 1], ['TEST_R1', 2], ['TEST_R5', null], ['TEST_R4', null]]);
    await photoBtn('TEST_R1').click();
    r1 = await row('TEST_R1'); assert.equal(r1.grid, null, 'fold again'); assert.deepEqual(r1.btn.slice(0, 2), ['📷 사진 2장 보기', 'false']);
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② [확인함] 뒤에도 펼친 채 · 새 창은 접힘 · ack 말고 자료 불변 · 오류 0', async () => {
    const before = await serialized();
    await page.locator('#modalRoot [data-team-note="TEST_R3"] [data-team-note-ack]').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot [data-team-note="TEST_R3"] [data-team-note-ack]'));
    const r3 = await row('TEST_R3');
    assert.deepEqual(r3.grid && r3.grid.map(x => x[0]), ['TEST_F4'], 'still open after ack re-render ' + JSON.stringify(r3)); assert.match(r3.text, /확인 취소/);
    await page.evaluate(() => closeModal(true));
    await page.evaluate(n => hjTeamReportNoteView(n), APT); await page.locator('#modalRoot #hjTeamNote').waitFor();
    assert.equal((await rows()).every(x => x.grid === null), true, 'new window starts folded');
    await page.evaluate(() => closeModal(true));
    assert.equal(strip(await serialized()), strip(before), 'only ack/ackAt changed');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`notephotos-v479: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL notephotos-v479', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

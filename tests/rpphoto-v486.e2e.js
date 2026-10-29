/* v486 📄 완료보고서 — 팀 보고 사진 묶음 썸네일 → 크게 보기(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① 묶음 줄 썸네일이 단추(44px, 4장까지 + '+n') → 누르면 사진 크게 보기(그 묶음 사진만 넘겨 봄, 보고서 창 위에 겹침) · 체크(빼기/넣기)는 안 바뀜
      · 닫으면 보고서 창·입력·사진 수 그대로 · 체크는 여전히 눌러서 빼기/넣기 · 390px 넘침 없음 · 자료 불변 (RP_PHOTO)
   ② 뺀 묶음의 썸네일도 크게 보기는 되고 체크는 그대로 · 오류 0
   HJ_V486_BASELINE=<commit> 은 RP_PHOTO 에서 실패해야 한다. HJ_V486_MUTATION=no-view(썸네일을 눌러도 안 열림)도 RP_PHOTO 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T26 둔산 크로바아파트 101동 1203호';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MUT = process.env.HJ_V486_MUTATION || '';
let html = process.env.HJ_V486_BASELINE ? execFileSync('git', ['show', process.env.HJ_V486_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-view');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "openLightbox(btn.getAttribute('data-rp-team-photo'),ids);";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'void ids;');
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
    buildAptReportPDF = async o => ({ pages: 1, photos: o.photos.length });
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString(), when = (n, h) => new Date(ago(n) + 'T' + h + ':00:00+09:00');
    const rep = (key, status, days, done, photos) => ({ key, status, workDate: ago(days), hours: 4, done, issue: '', reporter: '김타일', checklist: [], photos, at });
    state.projects = [{ name: APT, kind: 'interior', stage: 3, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-8601', addr: '대전 서구 둔산동' },
      teamReports: [rep('TEST_R1', 'done', 3, '욕실 바닥 철거', 2), rep('TEST_R2', 'review', 2, '벽 타일 1차', 1), rep('TEST_R3', 'done', 1, '줄눈·실리콘 마감', 5)] }];
    const f = (id, n, h) => ({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', project: APT, when: when(n, h), thumb: PX, size: 1000, _virtual: true });
    state.files = [f('TEST_F1', 3, '10'), f('TEST_F2', 3, '11'), f('TEST_F3', 2, '14'), f('TEST_F4', 1, '09'), f('TEST_F5', 1, '10'), f('TEST_F6', 1, '11'), f('TEST_F7', 1, '12'), f('TEST_F8', 1, '13')];
    state.activeProject = null; state.tab = 'dashboard'; render();
  }, { APT, PX });
  async function test(name, fn) { await fn(); passed++; console.log('PASS rpphoto-v486 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const bundles = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-rp-team-bundle]')].map(r => ({ key: r.getAttribute('data-rp-team-bundle'), checked: r.querySelector('[data-rp-team-include]').checked,
    thumbs: [...r.querySelectorAll('[data-rp-team-photo]')].map(b => [b.tagName, b.getAttribute('data-rp-team-photo'), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width)]), more: (r.querySelector('[data-rp-team-more]') || {}).textContent || '' })));
  const count = () => page.evaluate(() => document.querySelector('#modalRoot [data-rp-photo-count]').textContent.trim());
  const openViewer = async sel => { await page.locator(sel).click(); await page.locator('#lightbox #lbClose').waitFor({ timeout: 3000 }).catch(() => {}); return page.evaluate(() => { const c = document.querySelector('#lightbox .lb-count'); return c ? c.textContent.trim() : null; }); };
  const closeViewer = async () => { await page.locator('#lbClose').click(); await page.waitForFunction(() => !document.getElementById('lightbox')); };

  await test('① 썸네일 단추 → 크게 보기(그 묶음만) · 체크 그대로 · 닫으면 보고서 그대로 · 체크로 빼기 여전 · 넘침 없음 · 자료 불변 (RP_PHOTO)', async () => {
    const before = await serialized();
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#modalRoot #rpWorks').waitFor();
    let b = await bundles();
    assert.deepEqual(b.map(x => [x.key, x.checked, x.thumbs.map(t => t[1]), x.more]), [['TEST_R1', true, ['TEST_F1', 'TEST_F2'], ''], ['TEST_R2', true, ['TEST_F3'], ''], ['TEST_R3', true, ['TEST_F4', 'TEST_F5', 'TEST_F6', 'TEST_F7'], '+1']], 'RP_PHOTO thumbs ' + JSON.stringify(b));
    assert(b.flatMap(x => x.thumbs).every(t => t[0] === 'BUTTON' && t[2] >= 44 && t[3] >= 44), 'RP_PHOTO 44px buttons ' + JSON.stringify(b.map(x => x.thumbs)));
    assert.equal(await count(), '8');
    const works = await page.locator('#modalRoot #rpWorks').inputValue();
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return [document.documentElement.scrollWidth - innerWidth, m.scrollWidth - m.clientWidth]; });
    assert(ov.every(x => x <= 1), 'overflow ' + JSON.stringify(ov));
    assert.equal(await openViewer('#modalRoot [data-rp-team-photo="TEST_F6"]'), '3 / 5', 'RP_PHOTO viewer walks the R3 bundle only');
    assert.equal((await bundles())[2].checked, true, 'checkbox untouched by the thumbnail');
    await closeViewer();
    assert.equal(await page.locator('#modalRoot #rpWorks').inputValue(), works, 'report window intact'); assert.equal(await count(), '8');
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] [data-rp-team-include]').click();
    b = await bundles(); assert.equal(b[0].checked, false, 'checkbox still toggles'); assert.equal(await count(), '6');
    await page.evaluate(() => closeModal(true));
    assert.equal(await serialized(), before, 'screen only — app data unchanged');
  });

  await test('② 뺀 묶음도 크게 보기 · 체크 그대로 · 오류 0', async () => {
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#modalRoot #rpWorks').waitFor();
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] [data-rp-team-include]').click();
    assert.equal((await bundles())[0].checked, false);
    assert.equal(await openViewer('#modalRoot [data-rp-team-photo="TEST_F1"]'), '1 / 2');
    assert.equal((await bundles())[0].checked, false, 'excluded bundle stays excluded'); assert.equal(await count(), '6');
    await closeViewer();
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`rpphoto-v486: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL rpphoto-v486', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

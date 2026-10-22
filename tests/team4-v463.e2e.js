/* v463 팀 앱 연동 4차 — 📄 완료보고서의 '팀 보고 사진' 묶음(개발_백로그 4번). 합성 자료만, 외부 쓰기 0.
   ① 완료보고서 창 위쪽에 팀 보고(완료·검수 요청)마다 사진 묶음이 먼저 보인다 — 이 세션에 _teamReport 가 남은 사진은 그 열쇠로(key), 없으면 보고 작업일과 사진 한국 날짜가 같은 사진으로(day),
      같은 날 보고 둘이면 먼저 온 보고가 가져가고, 사진 0장 보고(사진 없음)는 줄이 없다 · '(보고 n장 · 이 기기 m장)' (TEAM_PHOTO_BUNDLES)
   ② 묶음을 빼면 PDF 사진 대장에서 그 사진만 빠지고(작업 내용 줄은 그대로), 다시 넣으면 돌아온다 · 사진 수 표시가 따라 바뀐다 · 저장 자료는 그대로(빼기는 창 안에서만)
   ③ 390px 넘침 없음 · 줄 44px · 오류 0 · 읽기 함수(hjTeamReportPhotos)는 자료를 바꾸지 않는다
   HJ_V463_BASELINE=<commit> 은 TEAM_PHOTO_BUNDLES 에서 실패해야 한다. HJ_V463_MUTATION=no-exclude(PDF 가 뺀 묶음을 무시)도 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T4 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V463_MUTATION || '';
let html = process.env.HJ_V463_BASELINE ? execFileSync('git', ['show', process.env.HJ_V463_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-exclude');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'photos:ph.filter(f=>!__rpExcluded.has(f)),';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'photos:ph,');
}
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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
  const D = await page.evaluate(async ({ APT, PX }) => {
    closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    __mobileMode = true; applyMobileMode();
    window.__v463 = { pdf: [] }; buildAptReportPDF = async o => { __v463.pdf.push({ photos: o.photos.map(f => f.name), works: o.works.slice() }); return { pages: 2, photos: o.photos.length }; };
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString(), when = (n, h) => new Date(new Date(ago(n) + 'T' + h + ':00:00+09:00')).toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 3, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6301', addr: '대전 서구 둔산동' },
      workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
        { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거·폐기물 반출', issue: '', reporter: '김타일', checklist: [], photos: 2, at },
        { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [], photos: 1, at },
        { key: 'TEST_R2b', status: 'done', workDate: ago(2), hours: 3, done: '벽 타일 2차', issue: '', reporter: '김타일', checklist: [], photos: 1, at },
        { key: 'TEST_R3', status: 'done', workDate: ago(1), hours: 6, done: '실리콘 마감', issue: '', reporter: '김타일', checklist: [], photos: 0, at },
        { key: 'TEST_R5', status: 'blocked', workDate: ago(4), hours: 0, done: '', issue: '자재 미도착', reporter: '김타일', checklist: [], photos: 1, at }] }] }];
    const f = (id, name, n, h, extra) => Object.assign({ id, name, kind: 'photo', ext: 'jpg', project: APT, when: when(n, h), thumb: PX, size: 1000, _virtual: true }, extra || {});
    state.files = [f('TEST_F1', 'r1_key.jpg', 3, '10', { _teamReport: 'TEST_R1', _phase: '시공 전', _worklabel: '욕실 바닥 타일 철거·폐기물 반출' }), f('TEST_F2', 'r1_sameday_nokey.jpg', 3, '11'), f('TEST_F3', 'r2_day.jpg', 2, '14'), f('TEST_F4', 'other_day.jpg', 5, '09'), f('TEST_F5', 'blocked_day.jpg', 4, '09')];
    state.activeProject = null; state.tab = 'dashboard'; render();
    if (!(await guardedPersistCurrentState())) throw Error('TEST_V463_SEED_SAVE_FAILED');
    return { today, r1: ago(3), r2: ago(2) };
  }, { APT, PX });
  async function test(name, fn) { await fn(); passed++; console.log('PASS team4-v463 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
  const md = iso => iso.slice(5).replace('-', '/');

  await test('① 완료보고서 위쪽 팀 보고 사진 묶음 — key 우선·같은 날은 day·먼저 온 보고가 가져감·사진 0장 보고·막힘 보고는 없음 (TEAM_PHOTO_BUNDLES)', async () => {
    const before = await serialized();
    const b = await page.evaluate(n => { const p = state.projects.find(x => x.name === n); return hjTeamReportPhotos(p, state.files).map(x => [x.key, x.how, x.want, x.files.map(f => f.name)]); }, APT);
    assert.deepEqual(b, [['TEST_R1', 'key', 2, ['r1_key.jpg']], ['TEST_R2', 'day', 1, ['r2_day.jpg']], ['TEST_R2b', 'day', 1, []]], 'TEAM_PHOTO_BUNDLES ' + JSON.stringify(b));
    assert.equal(await serialized(), before, 'read-only');
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    assert.equal(await page.locator('#modalRoot [data-rp-teamphotos]').count(), 1, 'TEAM_PHOTO_BUNDLES block');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-rp-team-bundle]')].map(r => ({ key: r.getAttribute('data-rp-team-bundle'), text: r.innerText.replace(/\s+/g, ' ').trim(), checked: r.querySelector('input').checked, disabled: r.querySelector('input').disabled, imgs: r.querySelectorAll('img').length, h: Math.round(r.getBoundingClientRect().height) })));
    assert.deepEqual(rows.map(r => [r.key, r.checked, r.disabled, r.imgs]), [['TEST_R1', true, false, 1], ['TEST_R2', true, false, 1], ['TEST_R2b', false, true, 0]], JSON.stringify(rows));
    assert.match(rows[0].text, new RegExp('^' + md(D.r1) + ' 욕실 바닥 타일 철거·폐기물 반출 \\(보고 2장 · 이 기기 1장\\)$')); assert.match(rows[2].text, /벽 타일 2차 \(보고 1장 · 이 기기 0장 — 없음\)/);
    assert(rows.every(r => r.h >= 44), 'rows 44px ' + JSON.stringify(rows.map(r => r.h)));
    // 묶음 덩어리는 입력칸보다 위(먼저)
    const order = await page.evaluate(() => { const a = document.querySelector('#modalRoot [data-rp-teamphotos]'), b = document.getElementById('rpDest'); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
    assert.equal(order, true, 'bundles come before the form fields');
    assert.equal(await page.locator('#modalRoot [data-rp-photo-count]').innerText(), '5');
  });

  await test('② 묶음 빼기 → PDF 사진 대장에서 그 사진만 빠짐(작업 내용 줄은 그대로) · 다시 넣으면 복귀 · 저장 자료 불변', async () => {
    const before = await serialized();
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] input').click();
    assert.equal(await page.locator('#modalRoot [data-rp-photo-count]').innerText(), '4');
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R2"] input').click();
    assert.equal(await page.locator('#modalRoot [data-rp-photo-count]').innerText(), '3');
    await page.locator('#modalRoot .mfoot button', { hasText: 'PDF 만들기' }).click();
    await page.waitForFunction(() => __v463.pdf.length === 1);
    const first = await page.evaluate(() => __v463.pdf[0]);
    assert.deepEqual(first.photos.sort(), ['blocked_day.jpg', 'other_day.jpg', 'r1_sameday_nokey.jpg'], 'excluded bundles left the photo ledger ' + JSON.stringify(first.photos));
    assert(first.works.some(w => /욕실 바닥 타일 철거·폐기물 반출/.test(w)), 'work line stays ' + JSON.stringify(first.works));
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] input').click(); await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] input').click();   // 뺐다 다시 넣기
    assert.equal(await page.locator('#modalRoot [data-rp-photo-count]').innerText(), '5');
    await page.locator('#modalRoot .mfoot button', { hasText: 'PDF 만들기' }).click();
    await page.waitForFunction(() => __v463.pdf.length === 2);
    assert.equal((await page.evaluate(() => __v463.pdf[1].photos)).length, 5, 'all photos again');
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const after = await serialized();
    // PDF 를 만들면 v458 docAt 이 찍힌다 — 그것 말고는 바뀐 것이 없어야 한다
    const strip = s => s.replace(/"docAt":"\d{4}-\d{2}-\d{2}"/g, '"docAt":""');
    assert.equal(strip(after).replace(/,"docAt":""/g, ''), strip(before).replace(/,"docAt":""/g, ''), 'exclusion is not stored');
  });

  await test('③ 390px 넘침 없음 · 오류 0 · 외부 쓰기 0', async () => {
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    const ov = await page.evaluate(() => { const m = document.querySelector('#modalRoot [data-rp-teamphotos]'); return { doc: document.documentElement.scrollWidth - innerWidth, box: m.scrollWidth - m.clientWidth }; });
    assert(ov.doc <= 1 && ov.box <= 1, 'overflow ' + JSON.stringify(ov));
    await page.evaluate(() => closeModal(true));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`team4-v463: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL team4-v463', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

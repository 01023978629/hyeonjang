/* v468 📄 완료보고서 PDF 사진 대장 — 팀 보고 사진 묶음을 '팀 보고 · 한 일' 머리글로 먼저(개발_백로그). 합성 자료만, 외부 쓰기 0.
   ① hjReportPhotoGroups(photos, teamBundles): 묶음 사진은 작업일 순 '팀 보고 · 한 일' 그룹으로 맨 앞, 나머지만 작업명 그룹 · 묶음이 없으면 예전과 같은 결과 · 읽기만(자료 불변)(TEAM_GROUP_FIRST)
   ② 완료보고서 창 → PDF: 창의 묶음(빼기 반영)이 teamBundles 로 넘어가 buildAptReportPDF 가 그 머리글로 묶는다 — 묶음 하나를 빼면 그 사진은 대장에서 빠지고 머리글도 사라진다
   ③ 작업 내용 줄(hjReportDraft)은 그대로 · 390px 오류 0
   HJ_V468_BASELINE=<commit> 은 TEAM_GROUP_FIRST 에서 실패해야 한다. HJ_V468_MUTATION=no-pass(창이 teamBundles 를 안 넘김)는 ② 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T8 둔산 크로바아파트 101동 1203호';
const MUT = process.env.HJ_V468_MUTATION || '';
let html = process.env.HJ_V468_BASELINE ? execFileSync('git', ['show', process.env.HJ_V468_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-pass');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'teamBundles:bundles.map(b=>({key:b.key,workDate:b.workDate,status:b.status,done:b.done,files:b.files.filter(f=>!__rpExcluded.has(f))})).filter(b=>b.files.length),';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
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
    // 진짜 buildAptReportPDF 가 팀 묶음을 받는지 먼저 본문으로 확인하고, 그 다음 그룹 결과만 기록하는 대역으로 바꾼다(jsPDF 는 바깥 스크립트라 막혀 있다)
    window.__v468 = { real: /hjReportPhotoGroups\(o\.photos,o\.teamBundles\)/.test(String(buildAptReportPDF)), runs: [] };
    buildAptReportPDF = async o => { __v468.runs.push({ bundles: Array.isArray(o.teamBundles) ? o.teamBundles.map(b => [b.key, b.files.map(f => f.name)]) : null, groups: hjReportPhotoGroups(o.photos, o.teamBundles).map(g => [g.label, !!g.team, g.photos.map(f => f.name)]) }); return { pages: 2, photos: o.photos.length }; };
    state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
    state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
    const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString(), when = (n, h) => new Date(ago(n) + 'T' + h + ':00:00+09:00').toISOString();
    state.projects = [{ name: APT, kind: 'interior', stage: 3, phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-6801', addr: '대전 서구 둔산동' },
      workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
        { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거·폐기물 반출', issue: '', reporter: '김타일', checklist: [], photos: 2, at },
        { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [], photos: 1, at }] }] }];
    const f = (id, name, n, h, extra) => Object.assign({ id, name, kind: 'photo', ext: 'jpg', project: APT, when: when(n, h), thumb: PX, size: 1000, _virtual: true }, extra || {});
    state.files = [f('TEST_F1', 'r1_a.jpg', 3, '10', { _teamReport: 'TEST_R1', _worklabel: '철거' }), f('TEST_F2', 'r1_b.jpg', 3, '11', { _teamReport: 'TEST_R1', _worklabel: '철거' }), f('TEST_F3', 'r2_day.jpg', 2, '14', { _worklabel: '타일' }), f('TEST_F4', 'other_before.jpg', 5, '09', { _worklabel: '시공 전' }), f('TEST_F5', 'other_after.jpg', 1, '16', { _worklabel: '완료' })];
    state.activeProject = null; state.tab = 'dashboard'; render();
    return { today, r1: ago(3), r2: ago(2) };
  }, { APT, PX });
  async function test(name, fn) { await fn(); passed++; console.log('PASS teampdf-v468 ' + name); }
  const serialized = () => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });

  await test('① hjReportPhotoGroups(photos, teamBundles): 팀 보고 그룹이 작업일 순으로 맨 앞 · 나머지만 작업명 그룹 · 묶음 없으면 예전 그대로 · 자료 불변 (TEAM_GROUP_FIRST)', async () => {
    assert.equal(await page.evaluate(() => __v468.real), true, 'TEAM_GROUP_FIRST the real PDF builder passes o.teamBundles');
    const before = await serialized();
    const r = await page.evaluate(n => { const p = state.projects.find(x => x.name === n), photos = state.files; const bundles = hjTeamReportPhotos(p, photos);
      const withTeam = hjReportPhotoGroups(photos, bundles).map(g => [g.label, !!g.team, g.photos.map(f => f.name), g.first]);
      const plain = hjReportPhotoGroups(photos).map(g => [g.label, !!g.team, g.photos.map(f => f.name)]);
      return { bundles: bundles.map(b => [b.key, b.files.map(f => f.name)]), withTeam, plain }; }, APT);
    assert.deepEqual(r.bundles, [['TEST_R1', ['r1_a.jpg', 'r1_b.jpg']], ['TEST_R2', ['r2_day.jpg']]], JSON.stringify(r.bundles));
    assert.deepEqual(r.withTeam.slice(0, 2), [['팀 보고 · 욕실 바닥 타일 철거·폐기물 반출', true, ['r1_a.jpg', 'r1_b.jpg'], D.r1], ['팀 보고 · 벽 타일 1차', true, ['r2_day.jpg'], D.r2]], 'TEAM_GROUP_FIRST ' + JSON.stringify(r.withTeam));
    assert.deepEqual(r.withTeam.slice(2).flatMap(g => g[2]).sort(), ['other_after.jpg', 'other_before.jpg'], 'the rest keep their label groups ' + JSON.stringify(r.withTeam));
    assert(r.withTeam.slice(2).every(g => g[1] === false), 'label groups are not team groups');
    assert.equal(r.plain.some(g => g[1]), false, 'no bundles → no team groups'); assert.equal(r.plain.flatMap(g => g[2]).length, 5);
    assert.equal(await serialized(), before, 'read-only');
  });

  await test('② 완료보고서 창 → PDF 에 묶음(빼기 반영)이 넘어가고 머리글로 먼저 묶인다', async () => {
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    await page.locator('#modalRoot .mfoot button', { hasText: 'PDF 만들기' }).click(); await page.waitForFunction(() => __v468.runs.length === 1);
    const first = await page.evaluate(() => __v468.runs[0]);
    assert.deepEqual(first.bundles, [['TEST_R1', ['r1_a.jpg', 'r1_b.jpg']], ['TEST_R2', ['r2_day.jpg']]], 'bundles reach the PDF builder ' + JSON.stringify(first.bundles));
    assert.deepEqual(first.groups.slice(0, 2).map(g => [g[0], g[1], g[2]]), [['팀 보고 · 욕실 바닥 타일 철거·폐기물 반출', true, ['r1_a.jpg', 'r1_b.jpg']], ['팀 보고 · 벽 타일 1차', true, ['r2_day.jpg']]], JSON.stringify(first.groups));
    assert.equal(first.groups.flatMap(g => g[2]).length, 5);
    // 묶음 R1 을 빼면 — 그 사진 2장은 대장에서 빠지고 머리글도 없다
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    await page.locator('#modalRoot [data-rp-team-bundle="TEST_R1"] input').click();
    await page.locator('#modalRoot .mfoot button', { hasText: 'PDF 만들기' }).click(); await page.waitForFunction(() => __v468.runs.length === 2);
    const second = await page.evaluate(() => __v468.runs[1]);
    assert.deepEqual(second.bundles, [['TEST_R2', ['r2_day.jpg']]], 'excluded bundle is gone ' + JSON.stringify(second.bundles));
    assert.deepEqual(second.groups[0], ['팀 보고 · 벽 타일 1차', true, ['r2_day.jpg']]); assert.equal(second.groups.flatMap(g => g[2]).length, 3);
    assert(!second.groups.some(g => /철거·폐기물/.test(g[0])), 'no header for the excluded bundle');
  });

  await test('③ 작업 내용 줄은 그대로 · 오류 0', async () => {
    const works = await page.evaluate(n => hjReportDraft(n).works, APT);
    assert(works.some(w => /욕실 바닥 타일 철거·폐기물 반출/.test(w)), 'team done line still in works ' + JSON.stringify(works));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`teampdf-v468: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL teampdf-v468', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

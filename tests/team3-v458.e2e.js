/* v458 팀 앱 연동 3차 — 팀 작업 보고 → 📄 완료보고서. 합성 자료만, 외부 쓰기 0.
   ① 완료(done) 보고의 한 일이 완료보고서 작업 내용 끝에 날짜 줄로 들어가고(보고자 이름·이슈·검수 보고는 안 들어감), 공사 기간도 보고 작업일까지 늘어난다(TEAM_LINES_IN_REPORT)
   ② 첫 화면 "📄 팀 보고 n건 들어옴 · 사진 m장 — 현장 [완료보고서 초안][넘기기]": 초안 → 완료보고서 창, 넘기기 → 줄 사라짐(보고 레코드 docAck, 저장됨)
   ③ PDF 를 만들면 그 현장 보고에 docAt 이 찍혀 줄이 내려간다 · 📎 서류 만들기 완료보고서 줄에 '👷 팀 보고 n건' · HJ_WO_PHASE_LABEL.during 은 v454 와 같은 '시공 중'
   HJ_V458_BASELINE=<commit> 은 TEAM_LINES_IN_REPORT 에서 실패해야 한다. HJ_V458_MUTATION=team-lines 도 TEAM_LINES_IN_REPORT 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const APT = 'TEST_T1 둔산 크로바아파트 101동 1203호', OTHER = 'TEST_T2 대흥 상가 화장실';
const MUT = process.env.HJ_V458_MUTATION || '';
let html = process.env.HJ_V458_BASELINE ? execFileSync('git', ['show', process.env.HJ_V458_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'team-lines');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = 'team.forEach(t=>{if(!works.includes(t.text))works.push(t.text);});';
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
}

let browser, passed = 0, page;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
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
  let D;
  async function seed() {
    D = await page.evaluate(async ({ APT, OTHER }) => {
      closeModal(true); aiOpsEnsureState().enabled = false; clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      __mobileMode = true; applyMobileMode();
      window.__v458 = { pdf: [] }; buildAptReportPDF = async o => { __v458.pdf.push({ site: o.site, works: o.works.slice(), period: o.period }); return { pages: 2, photos: o.photos.length }; };
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.quotes = []; state.payLog = []; state.contacts = []; state.expenses = []; state.workLogs = [];
      state.schedule = (state.schedule || []).filter(s => s && s._taxAuto);
      const today = localDate(), ago = n => hjAddDays(today, -n), at = new Date().toISOString();
      state.projects = [
        { name: APT, kind: 'interior', stage: 3, doneAt: ago(1), phases: ['철거', '타일'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '정테스트', phone: '010-0000-5801', addr: '대전 서구 둔산동' },
          workOrders: [{ packetId: 'wo_20261020_001', sentAt: at, via: 'copy', assignee: '김타일', due: ago(2), priority: 'normal', checklist: [], items: [], reports: [
            { key: 'TEST_R1', status: 'done', workDate: ago(3), hours: 8, done: '욕실 바닥 타일 철거·폐기물 반출', issue: '', reporter: '김타일', checklist: [], photos: 2, at },
            { key: 'TEST_R2', status: 'review', workDate: ago(2), hours: 2, done: '벽 타일 1차', issue: '줄눈 색 확인 필요', reporter: '김타일', checklist: [], photos: 0, at }] }],
          teamReports: [{ key: 'TEST_R3', status: 'done', workDate: ago(1), hours: 6, done: '벽·바닥 타일 시공 완료, 실리콘 마감', issue: '세면대 하부 누수 흔적 — 설비 확인 요청', reporter: '김타일', checklist: [], photos: 3, at }] },
        { name: OTHER, kind: 'interior', stage: 2, phases: ['도배'], received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김테스트', phone: '010-0000-5802', addr: '대전 중구 대흥동' },
          teamReports: [{ key: 'TEST_R4', status: 'done', workDate: ago(5), hours: 4, done: '도배 완료', issue: '', reporter: '박도배', checklist: [], photos: 0, at, docAt: ago(4) }] }];
      state.files = [{ key: 'TEST_F1', name: 'tile_before.jpg', kind: 'photo', project: APT, when: new Date(Date.now() - 3 * 86400000).toISOString(), thumb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', _phase: '시공 전', _worklabel: '철거 전' }];
      state.activeProject = null; state.tab = 'dashboard'; render();
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V458_SEED_SAVE_FAILED');
      return { today, r1: ago(3), r3: ago(1), r2: ago(2) };
    }, { APT, OTHER });
  }
  const close = () => page.evaluate(() => closeModal(true));
  async function test(name, fn) { await fn(); passed++; console.log('PASS team3-v458 ' + name); }

  await test('① 완료 보고의 한 일이 완료보고서 작업 내용 끝에 날짜 줄로 — 보고자·이슈·검수 보고는 빠짐 · 기간은 보고 작업일까지(TEAM_LINES_IN_REPORT)', async () => {
    await seed();
    const d = await page.evaluate(n => hjReportDraft(n), APT);
    const mmdd = iso => iso.slice(5).replace('-', '/');
    assert.deepEqual(d.works.slice(-2), [mmdd(D.r1) + ' 욕실 바닥 타일 철거·폐기물 반출', mmdd(D.r3) + ' 벽·바닥 타일 시공 완료, 실리콘 마감'], 'TEAM_LINES_IN_REPORT ' + JSON.stringify(d.works));
    assert(!d.works.join('\n').includes('김타일') && !d.works.join('\n').includes('누수 흔적') && !d.works.join('\n').includes('벽 타일 1차'), 'no reporter, issue or review text ' + JSON.stringify(d.works));
    assert.equal(d.team, 2); assert.equal(d.teamPhotos, 5); assert.equal(d.period, D.r1 + ' ~ ' + D.r3, 'period spans the team work dates ' + d.period);
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    assert.match(await page.locator('[data-rp-team]').innerText(), /팀 작업 보고 2건[\s\S]*보고 사진 5장[\s\S]*보고자 이름·이슈는 넣지 않습니다/);
    assert.match(await page.locator('#rpWorks').inputValue(), new RegExp(mmdd(D.r3) + ' 벽·바닥 타일 시공 완료, 실리콘 마감$'));
    assert.equal(await page.locator('#rpPeriod').inputValue(), D.r1 + ' ~ ' + D.r3);
    await close();
    assert.equal(await page.evaluate(() => HJ_WO_PHASE_LABEL.during), '시공 중', 'during label matches the v454 stage name');
  });

  await test('② 첫 화면 "📄 팀 보고 n건 들어옴" 줄 → [완료보고서 초안] 창 · [넘기기] 면 사라지고 docAck 저장', async () => {
    await seed();
    await page.locator('#view [data-team-done-doc]').first().waitFor();
    const rows = await page.locator('#view [data-team-done-doc]').allInnerTexts();
    assert.equal(rows.length, 1, 'OTHER already has docAt → no line ' + JSON.stringify(rows)); assert.match(rows[0], /팀 보고 2건 들어옴 · 사진 5장 — TEST_T1/);
    const sizes = await page.locator('#view [data-team-done-open], #view [data-team-done-skip]').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().height)));
    assert(sizes.length === 2 && sizes.every(h => h >= 44), 'tap targets ' + JSON.stringify(sizes));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow at 390px');
    await page.locator('#view [data-team-done-open]').click(); await page.locator('#rpWorks').waitFor(); await close();
    await page.locator('#view [data-team-done-skip]').click(); await page.waitForFunction(() => !document.querySelector('#view [data-team-done-doc]'));
    const marks = await page.evaluate(n => { const p = state.projects.find(x => x.name === n); return hjTeamReportsOf(p).map(r => [r.key, !!r.docAck, !!r.docAt]); }, APT);
    assert.deepEqual(marks, [['TEST_R1', true, false], ['TEST_R2', false, false], ['TEST_R3', true, false]], 'only done reports are acked');
    await page.waitForFunction(() => !__hjLocalSavePending, null, { timeout: 5000 }); await page.evaluate(async () => { await __appStateWriteQueue; });
    const stored = await page.evaluate(async n => { const p = (await idbGetStrict('appState')).projects.find(x => x.name === n); return [p.workOrders[0].reports[0].docAck, p.teamReports[0].docAck]; }, APT);
    assert.deepEqual(stored, [true, true], 'ack persisted in the report records');
  });

  await test('③ PDF 를 만들면 docAt 이 찍혀 줄이 내려감 · 📎 서류 만들기 완료보고서 줄에 👷 팀 보고 n건', async () => {
    await seed();
    await page.evaluate(n => docHubView(n), APT); await page.locator('#modalRoot .docHubBtn[data-act="aptreport"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="aptreport"]').innerText(), /👷 팀 보고 2건/); await close();
    await page.evaluate(n => aptReportView(n), APT); await page.locator('#rpWorks').waitFor();
    await page.locator('#modalRoot .mfoot button', { hasText: 'PDF 만들기' }).click();
    await page.waitForFunction(() => __v458.pdf.length === 1);
    const r = await page.evaluate(n => { const p = state.projects.find(x => x.name === n); return { pdf: __v458.pdf[0], marks: hjTeamReportsOf(p).map(x => [x.key, x.docAt === localDate()]), line: !!document.querySelector('#view [data-team-done-doc]') }; }, APT);
    assert.equal(r.pdf.site, APT); assert(r.pdf.works.some(w => /벽·바닥 타일 시공 완료/.test(w)), 'team line reached the PDF ' + JSON.stringify(r.pdf.works));
    assert.deepEqual(r.marks, [['TEST_R1', true], ['TEST_R2', false], ['TEST_R3', true]]); assert.equal(r.line, false, 'dashboard line gone after the PDF');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`team3-v458: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  await context.close();
})().catch(async error => { console.error('FAIL team3-v458', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

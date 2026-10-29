/* v462 🧪 데모 자료 보강 — 첫 사용자가 v432~v458 기능을 데모에서 바로 본다(개발_백로그 3번). 합성 자료만, 외부 쓰기 0.
   ① 빈 기기에서 데모를 열면 망원동 카페에 팀 작업 보고 2건(완료 1·검수 요청 1)이 있어 첫 화면에 '🔎 검수 요청 1건'·'📄 팀 보고 1건 들어옴 · 사진 3장' 줄이 뜨고,
      은행동 한빛아파트는 이웃 동의서 1건만 발행돼 '서류 4종 만들기'(시공 D-2) 할 일은 그대로이며, 영수증 지출 2건이 🧾 파일과 묶여 있다(DEMO_SEED)
   ② 화면: 📎 서류 만들기(카페)에 '👷 팀 보고 1건'·(한빛)에 '발행 1/4', 월말 장부에 🧾 두 줄 → 🧾 보기가 그림을 연다, [완료보고서 초안]이 팀 보고 줄을 작업 내용에 넣는다 · 390px 넘침 없음 · 44px
   ③ 저장 안 됨: 실제 지출이 있는 기기에서 데모에 들어가면 화면엔 데모 지출만, 이 기기 저장본(appState)은 실제 지출 그대로, [데모 끝내기] 뒤 실제 지출이 돌아오고 데모 영수증 파일은 없다
   HJ_V462_BASELINE=<commit> 은 DEMO_SEED 에서 실패해야 한다. HJ_V462_MUTATION=no-reports(보고 배열 이름을 바꿔 보고가 안 읽히게)도 DEMO_SEED 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const CAFE = '망원동 카페', APT = '은행동 한빛아파트 101동 702호';
const MUT = process.env.HJ_V462_MUTATION || '';
let html = process.env.HJ_V462_BASELINE ? execFileSync('git', ['show', process.env.HJ_V462_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-reports');
  html = html || require('node:fs').readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "reports:[{key:'wr_demo_20250310'";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "reportsX:[{key:'wr_demo_20250310'");
}

let browser, passed = 0;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const errors = [], network = { writes: 0 };
  async function open(viewport) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(String(error)));
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
      if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
      if (!read) network.writes++;
      return route.abort('blockedbyclient');
    });
    await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
    await boot(page);
    return { context, page };
  }
  async function boot(page) {
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(keys => typeof serializeData === 'function' && typeof loadDemo === 'function' && keys.every(key => !!window[key]), BOOT);
    await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; aiOpsEnsureState().enabled = false; }, BOOT);
  }
  async function test(name, fn) { await fn(); passed++; console.log('PASS demo-v462 ' + name); }

  /* ── ①② 빈 기기(폰 폭) ── */
  const { context, page } = await open({ width: 390, height: 800 });
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = m => { __toasts.push(String(m)); return o(m); }; });

  await test('① 데모 씨앗: 팀 보고 3건(완료 1·검수 1·막힘 1, v489)·첫 화면 줄 · 아파트 동의서 1건 발행 + D-2 서류 할 일 유지 · 영수증 지출 2건 ↔ 파일 (DEMO_SEED)', async () => {
    const r = await page.evaluate(async () => {
      const ok = await loadDemo();
      const cafe = state.projects.find(p => p.name === '망원동 카페'), apt = state.projects.find(p => p.name === '은행동 한빛아파트 101동 702호');
      const reports = hjTeamReportsOf(cafe), lines = hjTeamDoneLines(cafe);
      return {
        ok, demo: !!state._demo, projects: state.projects.length, toast: __toasts.at(-1) || '',
        reports: reports.map(x => [x.status, x.workDate, x.photos, x.reporter]), ago2: hjAddDays(localDate(), -2), ago3: hjAddDays(localDate(), -3), lines: lines.map(x => x.text), pending: hjTeamReportPending().map(x => [x.project, x.status]), doneDoc: hjTeamDoneDoc().map(x => [x.project, x.n, x.photos]),
        docs: hjDocLogs(apt).map(x => [x.type, x.no.slice(0, 3), hjIsoLocalDay(x.at) === hjAddDays(localDate(), -3)]), due: hjAptDocsDue().map(x => x.name),
        exp: (state.expenses || []).map(e => [e.src, e.vendor, e.amount, e.cat, e.method, e.project, !!hjReceiptFileOf(e)]),
        rcFiles: state.files.filter(f => f.kind === 'receipt').map(f => [f.name, f._virtual, !!f._file]),
        dash: {
          pending: (document.querySelector('#view [data-team-report-pending]') || {}).innerText || '',
          done: (document.querySelector('#view [data-team-done-doc="망원동 카페"]') || {}).innerText || '',
          apt: [...document.querySelectorAll('#view [data-aptdocs-due]')].map(p => p.innerText.replace(/\s+/g, ' ')).join('|')
        }
      };
    });
    assert.equal(r.ok, true); assert.equal(r.demo, true); assert.equal(r.projects, 4, 'demo project count unchanged (settings-safety contract)');
    assert.match(r.toast, /현장 4곳 · 파일 17개 · 팀 보고 3건 · 영수증 2장/, r.toast);   // v489 막힘 보고 1건 더
    assert.deepEqual(r.reports, [['done', '2025-03-10', 3, '박 반장'], ['blocked', r.ago3, 0, '김 기사'], ['review', r.ago2, 2, '박 반장']], 'DEMO_SEED team reports ' + JSON.stringify(r.reports));   // v489 막힘(김 기사, 사흘 전)   // v481 검수 요청은 이틀 전(첫 화면 "· 2일째")
    assert.deepEqual(r.lines, ['03/10 바닥·벽 철거, 폐기물 반출(마대 20장)'], 'DEMO_SEED done line');
    assert.deepEqual(r.pending, [['망원동 카페', 'review'], ['망원동 카페', 'blocked']]); assert.deepEqual(r.doneDoc, [['망원동 카페', 1, 3]]);
    assert.match(r.dash.pending, /🔎 검수 요청 1건[\s\S]*망원동 카페/, 'dashboard review line: ' + r.dash.pending);   // v465 부터 줄마다 [확인함]
    assert.match(r.dash.done, /📄 팀 보고 1건 들어옴 · 사진 3장 — 망원동 카페/, 'dashboard done line: ' + r.dash.done);
    assert.deepEqual(r.docs, [['aptconsent', 'AC-', true]], 'one consent form issued 3 days ago ' + JSON.stringify(r.docs));
    assert.deepEqual(r.due, ['은행동 한빛아파트 101동 702호'], 'D-2 to-do stays (no 신청서 yet)'); assert.match(r.dash.apt, /서류 4종 만들기 — 은행동 한빛아파트 101동 702호 \(시공 D-2\)/, r.dash.apt);
    assert.deepEqual(r.exp, [['receipt', '한밭철물', 38500, '자재', '현금', '망원동 카페', true], ['receipt', 'SK주유소', 55000, '유류', '카드', '', true]], 'two receipt expenses linked to files ' + JSON.stringify(r.exp));
    assert.equal(r.rcFiles.length, 2); assert(r.rcFiles.every(x => /^영수증_\d{8}_.+원\.jpg$/.test(x[0]) && x[1] === true && x[2] === true), 'receipt files are virtual with an in-memory picture ' + JSON.stringify(r.rcFiles));
  });

  await test('② 화면: 📎 서류 만들기 팀 보고·발행 1/4 · 월말 장부 🧾 두 줄 → 보기 · [완료보고서 초안]에 팀 보고 줄 · 390px 넘침 없음 · 44px', async () => {
    const hub = async name => { await page.evaluate(n => docHubView(n), name); await page.locator('#modalRoot .docHubBtn').first().waitFor(); const t = await page.evaluate(() => document.getElementById('modalRoot').innerText.replace(/\s+/g, ' ')); await page.evaluate(() => closeModal()); return t; };
    assert.match(await hub(CAFE), /👷 팀 보고 1건/, 'doc hub shows team reports');
    assert.match(await hub(APT), /발행 1\/4/, 'doc hub shows 1 of 4 issued');
    // 월말 장부(이번 달) — 영수증 두 줄 + 🧾 보기
    await page.evaluate(() => expenseLedger(localDate().slice(0, 7)));
    await page.locator('#modalRoot .expRow').first().waitFor();
    const rows = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .expRow')].map(r => ({ text: r.innerText.replace(/\s+/g, ' '), rc: !!r.querySelector('[data-rc-view]') })));
    assert.equal(rows.length, 2, JSON.stringify(rows)); assert(rows.every(r => r.rc), 'each row has 🧾'); assert(rows.some(r => /한밭철물/.test(r.text) && /38,500/.test(r.text)) && rows.some(r => /SK주유소/.test(r.text) && /55,000/.test(r.text)), JSON.stringify(rows));
    const sizes = await page.locator('#modalRoot [data-rc-view]').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().height)));
    assert(sizes.every(h => h >= 44), 'receipt buttons 44px ' + JSON.stringify(sizes));
    await page.locator('#modalRoot [data-rc-view]').first().click();
    await page.locator('#modalRoot img[data-rc-preview]').waitFor();
    const img = await page.evaluate(async () => { const i = document.querySelector('#modalRoot img[data-rc-preview]'); await i.decode().catch(() => {}); return { src: i.src.slice(0, 5), w: i.naturalWidth, title: document.getElementById('modalRoot').innerText.replace(/\s+/g, ' ').slice(0, 80) }; });
    assert.equal(img.src, 'blob:'); assert(img.w > 0, 'picture decodes'); assert.match(img.title, /🧾 (한밭철물|SK주유소) · [\d,]+원/, img.title);
    await page.evaluate(() => closeModal());
    // [완료보고서 초안] → 작업 내용에 팀 보고 줄(v458 hjReportDraft)
    await page.locator('#view [data-team-done-open="망원동 카페"]').click();
    await page.locator('#modalRoot #rpWorks').waitFor();
    const rp = await page.evaluate(() => ({ works: document.getElementById('rpWorks').value, team: !!document.querySelector('#modalRoot [data-rp-team]') }));
    assert.match(rp.works, /03\/10 바닥·벽 철거, 폐기물 반출/, 'team done line in report works: ' + rp.works); assert.equal(rp.team, true, 'v458 team hint');
    await page.evaluate(() => closeModal());
    const ov = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - innerWidth, dash: (() => { const s = document.getElementById('dashboardTodo'); return s ? s.scrollWidth - s.clientWidth : 0; })() }));
    assert(ov.doc <= 1 && ov.dash <= 1, 'no horizontal overflow at 390px ' + JSON.stringify(ov));
    const btns = await page.locator('#view [data-team-report-pending] button, #view [data-team-done-doc] button, #view [data-aptdocs-due] button').evaluateAll(ns => ns.map(n => Math.round(n.getBoundingClientRect().height)));
    assert(btns.length >= 3 && btns.every(h => h >= 44), 'dashboard buttons 44px ' + JSON.stringify(btns));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });
  await context.close();

  /* ── ③ 실제 자료가 있는 기기(PC 폭) ── */
  await test('③ 저장 안 됨: 화면엔 데모 지출만 · appState 는 실제 지출 그대로 · [데모 끝내기] 뒤 실제 지출 복귀, 데모 영수증 파일 없음', async () => {
    const { context: c2, page: p2 } = await open({ width: 1280, height: 860 });
    const seeded = await p2.evaluate(async () => {
      clearTimeout(__idbSaveTimer); __idbSaveTimer = null; state._demo = false; __tabStale = false; state.dirHandle = null;
      state.projects = [{ name: 'TEST_V462 실제 현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 } }];
      state.files = []; state.quotes = []; state.payLog = []; state.notes = [];
      state.expenses = [{ id: 'TEST_V462_EXP', date: localDate(), amount: 12345, category: '자재', method: '현금', memo: '실제 지출 TEST', project: 'TEST_V462 실제 현장', vendor: 'TEST 철물' }];
      state.dirty = false;
      return guardedPersistCurrentState();
    });
    assert.equal(seeded, true, 'seed persisted');
    p2.once('dialog', d => d.accept());
    await p2.click('#btnDemo');
    await p2.waitForFunction(() => state._demo === true && state.projects.length === 4);
    const inDemo = await p2.evaluate(() => ({ exp: state.expenses.map(e => [e.src, e.amount]), names: state.projects.map(p => p.name).join('|') }));
    assert.deepEqual(inDemo.exp, [['receipt', 38500], ['receipt', 55000]], 'only demo expenses on screen ' + JSON.stringify(inDemo));
    await p2.waitForTimeout(1300);   // 부정 증명: 800ms 디바운스 저장이 돌 시간을 준다
    const stored = await p2.evaluate(async () => { const s = await idbGet('appState'); return { exp: (s && s.expenses || []).map(e => [e.id, e.amount]), files: (s && s.files || []).filter(f => /영수증_/.test(f.name)).length, projects: (s && s.projects || []).map(p => p.name).join('|') }; });
    assert.deepEqual(stored, { exp: [['TEST_V462_EXP', 12345]], files: 0, projects: 'TEST_V462 실제 현장' }, 'device store untouched by demo ' + JSON.stringify(stored));
    await Promise.all([p2.waitForNavigation({ waitUntil: 'load' }), p2.click('#btnDemo')]);
    await p2.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
    await p2.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
    await p2.waitForFunction(() => Array.isArray(state.projects) && state.projects.length > 0);
    const back = await p2.evaluate(() => ({ demo: !!state._demo, exp: state.expenses.map(e => [e.id, e.amount]), rc: state.files.filter(f => f.kind === 'receipt' || /영수증_/.test(f.name)).length, names: state.projects.map(p => p.name).join('|') }));
    assert.deepEqual(back, { demo: false, exp: [['TEST_V462_EXP', 12345]], rc: 0, names: 'TEST_V462 실제 현장' }, 'real data back after exit ' + JSON.stringify(back));
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
    await c2.close();
  });

  console.log(`demo-v462: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL demo-v462', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

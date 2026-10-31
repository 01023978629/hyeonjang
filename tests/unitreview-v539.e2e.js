/* v539 🏢 내역서 동·호수 등록 다듬기 — 10/31~11/1 대표 "PC를 사용하여 검토하고 개발".
   PC 의 실제 작업내역서 3장을 반영 전 저장본에 다시 적용해(이 컨테이너 안에서만 — 실자료는 커밋하지 않음) 보니, 세대 후보 11곳 중 9곳이
   '○○아파트 303-603' 꼴이라 v537 은 2곳만 미리 체크했다. 위치 단지 이름이 현장 이름과 다른 줄('○○아파트' 줄이 '○○로운아파트' 현장으로)도 그대로 체크됐다.
   자료 무결성 검토(별도 에이전트)가 짚은 것도 함께: '…호라인'·'…호기'·'○○2동 1001호' 를 확실로 읽음, 한 세대 이름 현장에 다른 세대, 미리보기에 위치 원문 없음,
   옛 미리보기로 누를 때마다 안전판이 쌓임, 보관을 다시 안 봄, id 겹침.
   합성 자료만(실제 단지·동·호수 아님), 바깥 요청 0, 바깥 쓰기 0.
   ① 읽기: 아파트 이름 뒤 '동-호'(호 3~4자리)는 확실 · 짧은 호수·전화·날짜·'B1-101'·'…호라인'·'…호기'·동 숫자 앞에 붙은 한글은 확인 필요 (PARSE)
   ② 후보: 위치 원문 · 한 세대 이름 현장에 다른 세대는 체크 안 함 · 위치 단지 ≠ 현장 이름이면 체크 안 함 · 종결(lost) 견적 빠짐 · 장부 줄은 체크될 것만 셈 (PLAN)
   ③ 저장: 옛 미리보기는 안전판 전에 거부(안전판 안 쌓임) · 미리보기 뒤 보관하면 거부 · id 가 계속 겹치면 통째로 멈춤(겹친 id 저장 0) (APPLY)
   ④ 소스·핀 3곳(v539 이상·서로 같음) · 오류 0 · 바깥 쓰기 0
   HJ_V539_BASELINE=<commit> 은 ① 에서, HJ_V539_MUTATION=no-own 은 ②, snap-first(안전판 뒤에 거부) 는 ③ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let html = process.env.HJ_V539_BASELINE ? execFileSync('git', ['show', process.env.HJ_V539_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-own': ["const own=aptNameParse(p.name),ownOther=!!(own&&", "const own=aptNameParse(p.name),ownOther=false&&!!(own&&"],
  'snap-first': ["  for(const k of Object.keys(now)){if(now[k]!==before[k])throw new Error(", "  for(const k of Object.keys(now)){if(false)throw new Error("]
}[process.env.HJ_V539_MUTATION || ''];
if (process.env.HJ_V539_MUTATION) {
  assert(MUT && SRC.split(MUT[0]).length === 2, 'mutation anchor ' + process.env.HJ_V539_MUTATION);
  html = SRC.replace(MUT[0], MUT[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS unitreview-v539 ' + name); }
  const { context, page } = await openPage();
  // 합성 현장: 시험아파트(일반) · '가온아파트 1동 907호'(이름이 한 세대) · 나래로운아파트(위치는 '나래아파트')
  const SEED = () => page.evaluate(() => {
    const P = (name, o) => Object.assign({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }, o || {});
    state.projects = [P('시험아파트'), P('가온아파트 1동 907호'), P('나래로운아파트')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.aptOrders = []; state.aptOffices = [];
    const L = (loc, work) => ({ d: '2026-10-20', loc, work, amt: 10000 });
    const mk = (src, project, lines, result) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date: '2026-10-20', vat: 'included', project, lines }); if (result) q.result = result; state.quotes.push(q); syncQuoteToProject(q); };
    mk('A.xlsx', '시험아파트', [L('복수동 시험아파트 303-603', '욕실'), L('시험아파트 301-21', '점검'), L('시험아파트 101동 3호라인 입상관', '입상관')]);
    mk('A.xlsx', '가온아파트 1동 907호', [L('가온아파트 1동 907호', '누수'), L('가온아파트 1동 908호', '누수')]);
    mk('A.xlsx', '나래로운아파트', [L('신탄진 나래아파트 101동 1302호', '배관')]);
    mk('L.xlsx', '시험아파트', [L('시험아파트 999동 999호', '취소된 일')], 'lost');
    try { closeModal(); } catch (e) {}
  });

  await test("① 읽기 — 아파트 뒤 '동-호'는 확실 · 짧은 호수·전화·날짜·B1·호라인·호기·붙은 한글은 확인 필요 (PARSE)", async () => {
    await SEED();
    const r = await page.evaluate(() => [
      '복수동 시험아파트 303-603', '시험타운아파트 105-1604', '시험아파트101-1001', '시험아파트 101동 1001호 욕실',
      '시험아파트 301-21', '시험아파트 관리소 010-1234-5678', '시험아파트 2026-10-31 점검', '시험아파트 B1-101',
      '시험아파트 101동 3호라인 입상관', '시험아파트 104동 2호기', '시험2동 1001호', '시험빌딩 101-1001'
    ].map(x => { const u = hjStmtUnitOf(x); return u ? [u.dong, u.ho, u.sure] : null; }));
    assert.deepEqual(r, [
      ['303', '603', true], ['105', '1604', true], ['101', '1001', true], ['101', '1001', true],
      ['301', '21', false], ['10', '1234', false], ['2026', '10', false], ['1', '101', false],
      ['101', '3', false], ['104', '2', false], ['2', '1001', false], ['101', '1001', false]], 'PARSE ' + JSON.stringify(r));
  });

  await test('② 후보 — 위치 원문 · 한 세대 이름 현장의 다른 세대·단지 이름 다름은 체크 안 함 · 종결 견적 빠짐 · 장부 줄은 체크될 것만 (PLAN)', async () => {
    const r = await page.evaluate(() => hjStmtUnitPlan().map(x => [x.project, x.dong + '-' + x.ho, x.check, x.warn, x.locs.join(' / ')]));
    assert.deepEqual(r, [
      ['가온아파트 1동 907호', '1-907', true, '', '가온아파트 1동 907호'],
      ['가온아파트 1동 907호', '1-908', false, '현장 이름의 세대(1동 907호)와 달라요 — 그 세대 현장이 맞는지 확인', '가온아파트 1동 908호'],
      ['나래로운아파트', '101-1302', false, '위치의 단지(나래아파트)와 현장 이름이 달라요 — 확인', '신탄진 나래아파트 101동 1302호'],
      ['시험아파트', '101-3', false, '번호 앞뒤에 다른 글자가 붙어 있어요', '시험아파트 101동 3호라인 입상관'],
      ['시험아파트', '301-21', false, '‘동-호’ 꼴이 분명하지 않아요(짧은 호수·전화·날짜일 수 있음)', '시험아파트 301-21'],
      ['시험아파트', '303-603', true, '', '복수동 시험아파트 303-603']], 'PLAN ' + JSON.stringify(r));
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    await page.waitForSelector('[data-stmt-unitline]');
    assert.match(await page.evaluate(() => document.querySelector('[data-stmt-unitline]').textContent.replace(/\s+/g, ' ')), /분명하게 적힌 동·호수 2곳/);
    await page.click('[data-stmt-unitline] [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    const m = await page.evaluate(() => [...document.querySelectorAll('[data-stmtunit-row]')].map(r => [r.querySelector('.suChk').checked, (r.querySelector('[data-stmtunit-loc]') || {}).textContent || '']));
    assert.deepEqual(m.map(x => x[0]), [true, false, false, false, false, true]);
    assert(m.every(x => /^위치: /.test(x[1])), 'every row shows its source location ' + JSON.stringify(m));
    await page.evaluate(() => closeModal());
  });

  await test('③ 저장 — 옛 미리보기는 안전판 전에 거부 · 미리보기 뒤 보관 거부 · id 가 계속 겹치면 통째로 멈춤 (APPLY)', async () => {
    const snaps = () => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).filter(s => s.label === '내역서 동·호수 등록 전').length);
    // (가) 옛 미리보기 — 두 번 눌러도 안전판이 쌓이지 않는다
    await page.click('[data-stmt-unitline] [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    const s0 = await snaps();
    await page.evaluate(async () => { await aptUnitSave('시험아파트', { type: 'unit', dong: '109', ho: '909' }); });
    for (let k = 0; k < 2; k++) {
      await page.click('#modalRoot .mfoot button:nth-child(2)');
      await page.waitForFunction(() => /그사이 바뀌었습니다/.test((document.getElementById('aptUnitIssue') || {}).textContent || ''));
      await page.evaluate(() => { document.getElementById('aptUnitIssue').textContent = ''; });
    }
    assert.equal(await snaps(), s0, 'refused before taking a snapshot');
    assert.deepEqual(await page.evaluate(() => aptUnitList(aptUnitProject('시험아파트')).map(u => u.dong + '-' + u.ho)), ['109-909'], 'nothing registered from the stale preview');
    await page.evaluate(() => closeModal());
    // (나) 미리보기를 연 뒤 보관 — 거부
    await page.evaluate(() => render());
    await page.waitForSelector('[data-stmt-unitline] [data-stmtunit]');
    await page.click('[data-stmt-unitline] [data-stmtunit]');
    await page.waitForSelector('#stmtUnitPanel');
    await page.evaluate(() => { state.projects.find(p => p.name === '시험아파트').archived = true; });
    await page.click('#modalRoot .mfoot button:nth-child(2)');
    await page.waitForFunction(() => /보관한 현장/.test((document.getElementById('aptUnitIssue') || {}).textContent || ''));
    assert.deepEqual(await page.evaluate(() => aptUnitList(aptUnitProject('시험아파트')).map(u => u.dong + '-' + u.ho)), ['109-909']);
    await page.evaluate(() => { state.projects.find(p => p.name === '시험아파트').archived = false; closeModal(); });
    // (다) 난수가 고장 나 id 가 계속 겹치면 — 겹친 id 를 저장하지 않고 통째로 멈춘다
    const r = await page.evaluate(async () => {
      const plan = hjStmtUnitPlan().filter(x => x.project === '가온아파트 1동 907호');
      plan.forEach(x => { x.check = true; });
      const seen0 = hjStmtUnitStamp(plan), orig = Math.random; let err = '';
      Math.random = () => 0.123456789;
      try { await hjStmtUnitApply(plan, seen0); } catch (e) { err = e.message; } finally { Math.random = orig; }
      const p = aptUnitProject('가온아파트 1동 907호');
      return { err, units: p.aptUnits ? p.aptUnits.length : 0 };
    });
    assert(/세대 번호를 만들지 못했습니다/.test(r.err) && r.units === 0, 'duplicate ids never committed ' + JSON.stringify(r));
  });

  await test('④ 소스·핀 3곳(v539 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /const HJ_STMT_UNIT_DONGHO_RE=/);
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert.deepEqual([ver(pin[0]) >= 539, pin[0] === pin[1], pin[0] === pin[2]], [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`unitreview-v539: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL unitreview-v539', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

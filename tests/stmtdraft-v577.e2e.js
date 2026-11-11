/* v577 📝 다음 작업내역서 초안(엑셀) — '내역서에 아직 없는 작업'(v566)을 협력사에 보내는 내역서 양식으로 (v566 '안 한 것').
   합성 자료(이름은 지어낸 것), 시계 2026-11-10 고정, 엑셀 라이브러리는 가짜(쓴 격자·파일 이름만 기록), 바깥 쓰기 0.
   ① 격자 — 받는 분·작성일·머리글 '작업 날짜|위치|작업명|작업비용'·작업비용 빈칸·합계 줄 · 위치는 지난 내역서 줄 위치(없으면 현장 이름) · 여러 날 작업명 (GRID)
   ② 왕복 — 작업비용을 채운 격자를 [📑 작업내역서 반영]의 읽기(hjStmtParse)에 넣으면 같은 줄·거래처·작성일·합계 · 파일 이름에서도 거래처 (ROUNDTRIP)
   ③ 창 — '내역서에 아직 없는 작업' 칸의 [📝 내역서 초안] → 받는 분(최근 협력사)·체크 해제 → 고른 줄만 · SUM 합계 · 파일 이름 · 저장본 불변 (VIEW)
   ④ 고른 게 없거나 작성일이 틀리면 안 만듦 · 폰 390 넘침 없음·44px · 페이지 오류 0 · 외부 쓰기 0 (GUARD)
   HJ_V577_BASELINE=<commit> 은 ①, HJ_V577_MUTATION=amount-filled(작업비용 칸에 0 을 넣음)은 ① 에서 실패해야 한다. */
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
const MUT = { 'amount-filled': ["g.push([r.from,hjStmtDraftLoc(r.project),hjStmtDraftWork(r),''])", 'g.push([r.from,hjStmtDraftLoc(r.project),hjStmtDraftWork(r),0])'] };
let html = process.env.HJ_V577_BASELINE ? execFileSync('git', ['show', process.env.HJ_V577_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V577_MUTATION) {
  const m = MUT[process.env.HJ_V577_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V577_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtdraft-v577 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    // 가짜 엑셀 — 쓴 격자(수식 칸 포함)와 파일 이름만 남긴다
    window.__xlsx = [];
    window.XLSX = { utils: { aoa_to_sheet: aoa => ({ __aoa: JSON.parse(JSON.stringify(aoa)) }), book_new: () => ({ sheets: [] }), book_append_sheet: (wb, ws, name) => wb.sheets.push({ ws, name }) },
      writeFile: (wb, name) => { window.__xlsx.push({ name, sheets: wb.sheets.map(s => ({ name: s.name, aoa: s.ws.__aoa, sum: s.ws[Object.keys(s.ws).find(k => /^D\d+$/.test(k))] || null, cols: s.ws['!cols'] })) }); } };
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김가상', phone: '010-0000-0000', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜빌라')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  let n = 0;
  const ph = (project, day, label) => ({ id: 'PH' + (++n), name: 'IMG_' + n + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 1000 + n, when: new Date(day + 'T10:00:00+09:00'), _worklabel: label || '' });
  state.files = [ph('가온아파트', '2026-11-05', '욕조 방수'), ph('가온아파트', '2026-11-06', '타일'), ph('다솜빌라', '2026-11-08', '실리콘')];
  const stmt = (src, project, date, to, loc) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to, date, vat: 'included', project, lines: [{ d: date, loc, work: '방수', amt: 220000 }] }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  stmt('S1.xlsx', '가온아파트', '2026-09-01', '시험누수', '가온아파트 101-1101'); stmt('S2.xlsx', '가온아파트', '2026-10-01', '가상협력', '가온아파트 101-1102');
  const S = (id, date, title, project) => ({ id, date, time: '09:00', title, project, workers: '', hours: 8, memo: '' });
  state.schedule = [S('A', '2026-11-03', '세면대 배관 공사', '나래아파트')];
  __hjStmtYm = null; __hjStmtOldOpen = false; state.activeProject = null; state.tab = 'estimates'; state.search = '';
  render();
};

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);
    const before = await page.evaluate(() => JSON.stringify(serializeData().quotes) + JSON.stringify(state.schedule) + JSON.stringify(state.payLog));
    let grid;
    await test('① 격자 — 머리 · 작업비용 빈칸 · 합계 · 위치는 지난 내역서 줄 · 여러 날 작업명 (GRID)', async () => {
      grid = await page.evaluate(() => hjStmtDraftGrid(hjUnbilledPlan().rows, '가상협력', '2026-11-10'));
      assert.deepEqual(grid.slice(0, 5), [['작업내역서 (초안)'], ['받는 분', '가상협력'], ['작성일', '2026-11-10'], ['※ 작업비용 칸을 채워 주세요 — 만물인테리어'], ['작업 날짜', '위치', '작업명', '작업비용']]);
      assert.deepEqual(grid.slice(5), [
        ['2026-11-03', '나래아파트', '세면대 배관 공사', ''],
        ['2026-11-05', '가온아파트 101-1102', '욕조 방수 · 타일 (11/5~11/6)', ''],
        ['2026-11-08', '다솜빌라', '실리콘', ''],
        ['합계', '', '', '']], JSON.stringify(grid));
      assert.ok(!/김가상|010-/.test(JSON.stringify(grid)), '고객 이름·전화 없음');
    });
    await test('② 왕복 — 금액을 채우면 [📑 작업내역서 반영] 읽기가 같은 줄로 (ROUNDTRIP)', async () => {
      const r = await page.evaluate(g => {
        const filled = g.map((row, i) => i >= 5 && row[0] !== '합계' ? [row[0], row[1], row[2], [330000, 550000, 110000][i - 5]] : row[0] === '합계' ? ['합계', '', '', 990000] : row);
        const p = hjStmtParse([{ name: '작업내역서', grid: filled }], hjStmtDraftName('가상협력', '2026-11-10'));
        const blank = hjStmtParse([{ name: '작업내역서', grid: g }], hjStmtDraftName('', '2026-11-10'));
        return { to: p.to, date: p.date, lines: p.lines.map(l => [l.d, l.loc, l.work, l.amt]), stated: p.stated, sum: p.sum, warn: p.warn, blank: blank.lines.length, name: hjStmtDraftName('가상 협력/A', '2026-11-10'), nameTo: hjStmtParse([{ name: 's', grid: g.slice(4) }], hjStmtDraftName('가상협력', '2026-11-10')).to };
      }, grid);
      assert.equal(r.to, '가상협력'); assert.equal(r.date, '2026-11-10');
      assert.deepEqual(r.lines, [['2026-11-03', '나래아파트', '세면대 배관 공사', 330000], ['2026-11-05', '가온아파트 101-1102', '욕조 방수 · 타일 (11/5~11/6)', 550000], ['2026-11-08', '다솜빌라', '실리콘', 110000]]);
      assert.ok(r.stated === 990000 && r.sum === 990000 && !r.warn.some(w => /다릅니다/.test(w)), JSON.stringify(r));
      assert.equal(r.blank, 0, '금액을 안 채우면 매출 줄이 생기지 않음');
      assert.equal(r.name, '작업내역서초안_20261110_가상협력A.xlsx');
      assert.equal(r.nameTo, '가상협력', '머리 위 받는 분이 없어도 파일 이름에서');
    });
    await test('③ 창 — [📝 내역서 초안] → 최근 협력사 · 체크 해제 → 고른 줄만 · SUM · 저장본 불변 (VIEW)', async () => {
      await page.click('#view [data-unbilled-draft]');
      await page.waitForSelector('#modalRoot [data-stmtdraft-row]');
      assert.equal(await page.inputValue('#modalRoot #sdTo'), '가상협력', '가장 최근 협력사');
      assert.equal(await page.locator('#modalRoot [data-stmtdraft-row]').count(), 3);
      await page.locator('#modalRoot .sdPick').nth(2).uncheck();
      assert.equal(await page.textContent('#modalRoot #sdN'), '2');
      await page.click('#modalRoot .mfoot button.clay');
      await page.waitForFunction(() => window.__xlsx.length === 1);
      const x = await page.evaluate(() => window.__xlsx[0]);
      assert.equal(x.name, '작업내역서초안_20261110_가상협력.xlsx');
      assert.equal(x.sheets.length, 1); assert.equal(x.sheets[0].name, '작업내역서');
      assert.deepEqual(x.sheets[0].aoa.slice(5, 7).map(r => [r[0], r[2], r[3]]), [['2026-11-05', '욕조 방수 · 타일 (11/5~11/6)', null], ['2026-11-08', '실리콘', null]], '체크 푼 줄(나래 11/3)은 빠짐: ' + JSON.stringify(x.sheets[0].aoa));
      assert.equal(x.sheets[0].aoa.length, 8, '머리 5 + 줄 2 + 합계 1');
      assert.deepEqual(x.sheets[0].sum, { t: 'n', f: 'SUM(D6:D7)' });
      assert.match(await page.textContent('#toast'), /작업 2건/);
      assert.equal(await page.evaluate(() => JSON.stringify(serializeData().quotes) + JSON.stringify(state.schedule) + JSON.stringify(state.payLog)), before, '저장본 불변');
      await page.evaluate(() => closeModal(true));
    });
    await test('④ 막음 · 폰 390 · 오류 0 · 외부 쓰기 0 (GUARD)', async () => {
      const r = await page.evaluate(async () => { const out = []; for (const a of [[[], 'x', '2026-11-10'], [hjUnbilledPlan().rows, 'x', '11/10']]) { try { await hjStmtDraftDownload(...a); out.push('made'); } catch (e) { out.push(e.message); } } return { out, n: window.__xlsx.length }; });
      assert.deepEqual(r.out, ['넣을 작업을 하나 이상 고르세요', '작성일을 확인하세요']); assert.equal(r.n, 1);
      await page.evaluate(() => hjStmtDraftView());
      const ui = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#modalRoot button,#modalRoot label[data-stmtdraft-row]')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim().slice(0, 20)), font: getComputedStyle(document.querySelector('#modalRoot #sdTo')).fontSize }));
      assert.ok(ui.over <= 1 && !ui.small.length && ui.font === '16px', JSON.stringify(ui));
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtdraft-v577: ${passed}/4 PASS; synthetic data · fixed clock · fake xlsx; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtdraft-v577 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

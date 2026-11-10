/* v566 🧾 내역서에 아직 없는 작업 — 사진·일정 ↔ 작업내역서 대조 (대표 지시 2026-11-10 "사진 및 현장 관리에 개발 가능 부분 개발 진행").
   최근 90일 사진 찍은 날·일정 날을 현장별로 이어 묶고, 앞뒤 하루 안에 내역서 줄이 없으면 '내역서에 아직 없는 작업'으로 📑 내역서 탭에 보인다.
   합성 자료(날짜는 오늘 기준), 바깥 쓰기 0.
   ① 계획 — 이어지는 날 묶음 · 앞뒤 하루 안 내역서 줄이면 빠짐 · 보관 현장·90일 밖·💰·내일 일정·현장 없는 사진 제외 · 참고(견적 현장·방문만) · 읽기만 (PLAN)
   ② 화면 — 📑 내역서 탭 장부 아래 · 줄 글 · 참고 접힘 · [📋 글로 복사] 글(금액 없음) (VIEW)
   ③ [청구 안 함] → 현장 안 stmtSkip 에만 적고 줄이 빠짐 · [넘긴 작업 다시 보기] · 오래된 창이면 안 적음 (SKIP)
   ④ 내역서를 반영하면 줄이 사라지고 '✓ 모두 내역서에' (BILLED)
   ⑤ 폰 390 — 가로 넘침 없음 · 단추 44px (PHONE)
   ⑥ 소스·핀 3곳(v566 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V566_BASELINE=<commit> 은 ① 에서, HJ_V566_MUTATION=no-tolerance(앞뒤 하루 여유 삭제) 도 ① 에서 실패해야 한다. */
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
const TOL = 'const lo=hjAddDays(r.from,-1),hi=hjAddDays(r.to,1);';
let html = process.env.HJ_V566_BASELINE ? execFileSync('git', ['show', process.env.HJ_V566_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V566_MUTATION) {
  assert.equal(process.env.HJ_V566_MUTATION, 'no-tolerance', 'unknown mutation ' + process.env.HJ_V566_MUTATION);
  assert.equal(SRC.split(TOL).length, 2, 'mutation anchor');
  html = SRC.replace(TOL, 'const lo=r.from,hi=r.to;');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS unbilled-v566 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  const today = localDate(), d = n => hjAddDays(today, -n);
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }, extra || {});
  state.projects = [P('가온'), P('나래'), P('다솜'), P('라온', { archived: true }), P('마루')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  let n = 0;
  const ph = (project, day, label) => ({ id: 'PH' + (++n), name: 'IMG_' + n + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 1000 + n, when: new Date(day + 'T10:00:00+09:00'), _worklabel: label || '' });
  state.files = [ph('가온', d(11)), ph('가온', d(10)), ph('가온', d(10)), ph('가온', d(10)), ph('가온', d(9)),          // 내역서 줄 d(10) — 이어진 사흘 한 묶음, 들어간 작업
    ph('가온', d(5), '욕조 방수'), ph('가온', d(5), '욕조 방수'), ph('가온', d(4), '타일'),                                  // 내역서 없음 → 줄
    ph('마루', d(29)),                                                                                                   // 내역서 줄 d(30) — 하루 차이는 들어간 작업
    ph('다솜', d(7)), ph('다솜', d(7)),                                                                                  // 견적서로 청구하는 현장 → 참고
    ph('라온', d(6)), ph('가온', d(100)), ph('', d(3))];                                                                 // 보관 · 90일 밖 · 현장 없음 → 제외
  state.files.push({ id: 'E_D', name: '다솜_견적서.xlsx', ext: 'xlsx', kind: 'estimate', project: '다솜', prefix: '_정리완료/다솜/견적서/', size: 901, est: { customer: '다솜', amount: 3300000, supply: 3000000, vat: 300000, date: d(40) }, when: new Date(d(40) + 'T09:00:00+09:00') });
  const stmt = (src, project, amt, date) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines: [{ d: date, loc: project + ' 101-1', work: '방수', amt }] }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  stmt('S1.xlsx', '가온', 220000, d(10)); stmt('S2.xlsx', '마루', 330000, d(30));
  const S = (id, date, title, project) => ({ id, date, time: '09:00', title, project, workers: '', hours: 8, memo: '' });
  state.schedule = [S('A', d(3), '세면대 배관 공사', '나래'), S('B', d(20), '현장 방문', '나래'), S('C', d(2), '💰 잔금 받기', '나래'), S('D', hjAddDays(today, 1), '타일', '나래'), S('E', d(3), '개인 일정', '')];
  __hjStmtYm = null; __hjStmtOldOpen = false; state.activeProject = null; state.tab = 'estimates'; state.search = '';
  render();
  return { rowA: hjMdDow(d(3)) + ' 나래 — 세면대 배관 공사 · 사진 없음', rowB: hjMdDow(d(5)) + '~' + hjMdDow(d(4)) + ' 가온 — 욕조 방수 · 타일 · 사진 3장',
    refEst: hjMdDow(d(7)) + ' 다솜 — 작업 내용 없음 · 사진 2장', refVisit: hjMdDow(d(20)) + ' 나래 — 현장 방문 · 사진 없음', d3: d(3), d4: d(4), d5: d(5) };
};
const ROWS = () => ({ n: (document.querySelector('#view [data-unbilled-n]') || {}).textContent, rows: [...document.querySelectorAll('#view [data-unbilled] > [data-unbilled-row]')].map(el => el.firstChild.textContent.trim()),
  refs: [...document.querySelectorAll('#view [data-unbilled-refs] [data-unbilled-row]')].map(el => [el.dataset.unbilledRef, el.firstChild.textContent.replace(/\s+/g, ' ').trim()]), ok: !!document.querySelector('#view [data-unbilled-ok]') });

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    const D = await page.evaluate(SEED);
    await test('① 계획 — 묶음 · 앞뒤 하루 · 제외 · 참고 · 읽기만 (PLAN)', async () => {
      const r = await page.evaluate(() => { const before = JSON.stringify(serializeData().projects) + JSON.stringify(state.schedule); const P = hjUnbilledPlan();
        return { rows: P.rows.map(hjUnbilledLine), refs: P.refs.map(x => [x.visit ? 'visit' : 'est', hjUnbilledLine(x)]), skipped: P.skipped, text: hjUnbilledText(P), same: before === JSON.stringify(serializeData().projects) + JSON.stringify(state.schedule) }; });
      assert.deepEqual(r.rows, [D.rowA, D.rowB], '내역서에 없는 작업 2건(최근 먼저) — ' + JSON.stringify(r.rows));
      assert.deepEqual(r.refs, [['est', D.refEst], ['visit', D.refVisit]], '참고 2건 — ' + JSON.stringify(r.refs));
      assert.equal(r.skipped, 0);
      assert.ok(r.text.startsWith('내역서에 아직 없는 작업 2건 (') && r.text.endsWith('- ' + D.rowA + '\n- ' + D.rowB) && !/원/.test(r.text), '복사 글(금액 없음) — ' + r.text);
      assert.ok(r.same, '읽기만');
    });
    await test('② 화면 — 📑 내역서 탭 · 줄 글 · 참고 접힘 · [📋 글로 복사] (VIEW)', async () => {
      const a = await page.evaluate(ROWS);
      assert.deepEqual([a.n, a.rows, a.ok], ['2', [D.rowA, D.rowB], false], JSON.stringify(a));
      assert.deepEqual(a.refs, [['est', D.refEst + ' (견적서로 청구하는 현장)'], ['visit', D.refVisit + ' (방문·상담 일정만)']], JSON.stringify(a.refs));
      const pos = await page.evaluate(() => { const v = document.querySelector('#view [data-stmt-view]'), kids = [...v.children].map(c => c.matches('[data-stmt-ledger]') ? 'ledger' : c.matches('[data-unbilled]') ? 'unbilled' : c.matches('[data-stmt-months]') ? 'months' : '').filter(Boolean);
        return { kids, refsOpen: document.querySelector('#view [data-unbilled-refs]').open }; });
      assert.deepEqual(pos, { kids: ['ledger', 'unbilled', 'months'], refsOpen: false }, '장부 아래·월별 위 · 참고는 접힘 — ' + JSON.stringify(pos));
      await page.evaluate(() => { window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { window.__copied = t; } } }); });
      await page.click('#view [data-unbilled-copy]');
      await page.waitForFunction(() => window.__copied);
      const text = await page.evaluate(() => window.__copied);
      assert.ok(text.split('\n').length === 3 && text.includes(D.rowB), '복사 글 — ' + text);
    });
    await test('③ [청구 안 함] → 현장 안 stmtSkip · [넘긴 작업 다시 보기] · 오래된 창이면 안 적음 (SKIP)', async () => {
      const st = await page.evaluate(d3 => { window.__tabStale = true; const r = hjUnbilledSkip('나래', d3, d3); window.__tabStale = false; return [r, JSON.stringify(state.projects.find(p => p.name === '나래').stmtSkip || null)]; }, D.d3);
      assert.deepEqual(st, [false, 'null'], '오래된 창이면 안 적음 — ' + JSON.stringify(st));
      await page.click('#view [data-unbilled] > [data-unbilled-row="나래"] [data-unbilled-skip]');
      const b = await page.evaluate(() => ({ n: document.querySelector('#view [data-unbilled-n]').textContent, rows: [...document.querySelectorAll('#view [data-unbilled] > [data-unbilled-row]')].map(el => el.firstChild.textContent.trim()),
        skip: serializeData().projects.find(p => p.name === '나래').stmtSkip, other: serializeData().projects.filter(p => p.stmtSkip).length, un: !!document.querySelector('#view [data-unbilled-unskip]') }));
      assert.deepEqual([b.n, b.rows, b.other, b.un], ['1', [D.rowB], 1, true], JSON.stringify(b));
      assert.deepEqual(b.skip.map(x => [x.from, x.to]), [[D.d3, D.d3]], '현장 안 stmtSkip — ' + JSON.stringify(b.skip));
      await page.click('#view [data-unbilled-unskip]');
      const c = await page.evaluate(() => ({ n: document.querySelector('#view [data-unbilled-n]').textContent, has: 'stmtSkip' in state.projects.find(p => p.name === '나래'), un: !!document.querySelector('#view [data-unbilled-unskip]') }));
      assert.deepEqual(c, { n: '2', has: false, un: false }, '다시 보기 — ' + JSON.stringify(c));
    });
    await test('④ 내역서를 반영하면 줄이 사라지고 ✓ (BILLED)', async () => {
      await page.evaluate(D => { const add = (src, project, date) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines: [{ d: date, loc: project, work: '방수', amt: 110000 }] }); state.quotes.push(q); syncQuoteToProject(q); };
        add('S3.xlsx', '가온', D.d4); add('S4.xlsx', '나래', D.d3); render(); }, D);
      const a = await page.evaluate(ROWS);
      assert.deepEqual([a.n, a.rows, a.ok, a.refs.length], ['0', [], true, 2], JSON.stringify(a));
    });
    await context.close();
    await test('⑤ 폰 390 — 가로 넘침 없음 · 단추 44px (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED);
      const r = await m.page.evaluate(() => { const v = document.getElementById('view'); document.querySelector('#view [data-unbilled-refs]').open = true;
        const small = [...v.querySelectorAll('[data-unbilled] button,[data-unbilled] summary')].filter(b => b.getClientRects().length).map(b => [b.innerText.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        return { rows: v.querySelectorAll('[data-unbilled-row]').length, over: document.documentElement.scrollWidth - innerWidth, viewOver: v.scrollWidth - v.clientWidth, small }; });
      assert.ok(r.rows === 4 && r.over <= 1 && r.viewOver <= 1, '넘침 없음 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px 미만 — ' + JSON.stringify(r.small));
      await m.context.close();
    });
    await test('⑥ 소스·핀 3곳(v566 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 566, '핀 v566 이상 ' + a);
      assert.ok(src.includes(TOL) && src.includes('function hjUnbilledPlan('), '대조 함수가 소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`unbilled-v566: ${passed}/6 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL unbilled-v566 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

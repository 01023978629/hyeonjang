/* v568 📷 내역서 줄 ↔ 현장 사진 · 📑 현장 화면의 작업내역서 칸 · 🩺 '내역서에 없는 작업' — 대표 지시(2026-11-11) "더 개발 진행 — 다른 부분도".
   모두 읽기만. 합성 자료(날짜는 오늘 기준), 바깥 쓰기 0.
   ① 📑 내역서 탭 월별 현장 줄 — 작업일 앞뒤 하루의 그 현장 사진 수 · 없으면 '📷 사진 없음' · 머리 '사진 없는 줄 n건' (TAB)
   ② 현장 화면 '📑 이 현장 작업내역서' — 합계·받은 돈·남은 돈 · 줄(최근 먼저, 집계 제외 표시) · [내역서 탭] · 내역서 없는 현장엔 칸 없음 (SITE)
   ③ 🩺 자료 건강 줄 '🧾 내역서에 없는 작업 n' → 내역서 탭 · 내역서가 없는 자료에서는 안 보임 · 넘기면 바로 줄어듦 (HEALTH)
   ④ 폰 390 — 현장 화면 칸 넘침 없음 · 단추 44px · 그리기만으로 자료 불변 (PHONE)
   ⑤ 소스·핀 3곳(v568 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V568_BASELINE=<commit> 은 ① 에서, HJ_V568_MUTATION=same-day(앞뒤 하루 여유 삭제) 도 ① 에서 실패해야 한다. */
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
const WIN = 'const lo=hjAddDays(ds[0],-1),hi=hjAddDays(ds[ds.length-1],1);let n=0;';
let html = process.env.HJ_V568_BASELINE ? execFileSync('git', ['show', process.env.HJ_V568_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V568_MUTATION) {
  assert.equal(process.env.HJ_V568_MUTATION, 'same-day', 'unknown mutation ' + process.env.HJ_V568_MUTATION);
  assert.equal(SRC.split(WIN).length, 2, 'mutation anchor');
  html = SRC.replace(WIN, 'const lo=ds[0],hi=ds[ds.length-1];let n=0;');
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtphoto-v568 ' + name); }
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
const SEED = withStmt => {
  closeModal(true);
  const today = localDate(), YM = today.slice(0, 7), d1 = YM + '-01', d2 = hjAddDays(d1, 1), far = hjAddDays(d1, 12);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false });
  state.projects = [P('가온'), P('나래'), P('다솜')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.schedule = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  try { __hjUnbilledMemo = null; } catch (_) {}
  let n = 0;
  const ph = (project, day) => ({ id: 'PH' + (++n), name: 'IMG_' + n + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 1000 + n, when: new Date(day + 'T10:00:00+09:00') });
  state.files = [ph('가온', d1), ph('가온', d1), ph('가온', d2), ph('가온', far), ph('다솜', hjAddDays(today, -100)), ph('나래', d1)];   // 가온: 작업일 2 + 다음 날 1 = 3장(12일 뒤 1장은 그 줄 것) · 다솜: 작업일 근처 사진 없음(100일 전 1장뿐)
  if (withStmt) {
    const stmt = (src, project, lines, to) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: to || '시험누수', date: d1, vat: 'included', project, lines }); state.quotes.push(q); syncQuoteToProject(q); return q; };
    stmt('S1.xlsx', '가온', [{ d: d1, loc: '가온 101-1', work: '우수관 방수', amt: 220000 }]);
    stmt('S2.xlsx', '다솜', [{ d: d1, loc: '다솜 2-3', work: '욕조 방수', amt: 1100000 }]);
    stmt('S3.xlsx', '가온', [{ d: far, loc: '가온 101-1', work: '타일 보수', amt: 330000 }], '더시험');
    const ex = stmt('SX.xlsx', '가온', [{ d: d2, loc: '가온 101-1', work: '비교용', amt: 500000 }]); ex.exSum = true; syncQuoteToProject(ex);
    hjStmtPayApply('S1.xlsx', { amt: 100000, d: today <= d1 ? d1 : today, method: '계좌이체' });
  }
  __hjStmtYm = null; __hjStmtOldOpen = false; state.activeProject = null; state.tab = 'estimates'; state.search = '';
  render();
  return { mm: +YM.slice(5, 7), d1md: hjStmtMd(d1), d2md: hjStmtMd(d2), farmd: hjStmtMd(far), far };
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    const D = await page.evaluate(SEED, true);
    await test('① 내역서 탭 월별 현장 줄 — 사진 수(앞뒤 하루) · 사진 없음 · 머리 (TAB)', async () => {
      const r = await page.evaluate(() => ({ items: [...document.querySelectorAll('#view [data-stmt-item]')].map(el => [el.querySelector('[data-open]').textContent, el.querySelector('[data-stmt-photo]').dataset.stmtPhoto, el.querySelector('[data-stmt-photo]').textContent]),
        head: (document.querySelector('#view [data-stmt-nophoto]') || {}).textContent || '' }));
      assert.deepEqual(r.items, [['가온', '3', '📷 3장'], ['다솜', '0', '📷 사진 없음'], ['가온', '1', '📷 1장']], '작업일 2장 + 다음 날 1장 = 3 · 12일 뒤 줄은 그날 1장 — ' + JSON.stringify(r.items));
      assert.equal(r.head.trim(), '· 📷 사진 없는 줄 1건', r.head);
    });
    await test('② 현장 화면 📑 이 현장 작업내역서 — 합계·받은 돈·남은 돈 · 줄 · 내역서 없는 현장엔 없음 (SITE)', async () => {
      const r = await page.evaluate(() => { state.activeProject = '가온'; state.tab = 'project'; render();
        const c = document.querySelector('#view [data-pjstmt]');
        const a = { sum: c.querySelector('[data-pjstmt-sum]').innerText.replace(/\s+/g, ' ').trim(), rows: [...c.querySelectorAll('[data-pjstmt-row]')].map(el => el.innerText.replace(/\s+/g, ' ').trim()), head: c.querySelector('.cust-h').innerText.replace(/\s+/g, ' ').trim() };
        state.activeProject = '나래'; render(); a.none = !document.querySelector('#view [data-pjstmt]');
        state.activeProject = '가온'; render(); document.querySelector('#view [data-pjstmt] [data-stmt-go]').click(); a.tab = state.tab;
        return a; });
      assert.equal(r.sum, '합계 550,000원 · 받은 돈 100,000원 · 남은 돈 450,000원', '집계 제외 500,000 은 합계에서 빠짐 — ' + r.sum);
      assert.equal(r.head, '📑 이 현장 작업내역서 협력사 청구 3줄');
      assert.deepEqual(r.rows, [D.farmd + ' 타일 보수 · 더시험 📷 1장 330,000원', D.d2md + ' 비교용 · 시험누수 · 집계 제외 📷 3장 500,000원', D.d1md + ' 우수관 방수 · 시험누수 📷 3장 220,000원'], '최근 먼저 — ' + JSON.stringify(r.rows));
      assert.deepEqual([r.none, r.tab], [true, 'estimates'], '내역서 없는 현장엔 칸 없음 · [내역서 탭]');
    });
    await test('③ 🩺 건강 줄 🧾 내역서에 없는 작업 n → 내역서 탭 · 내역서 없는 자료에선 안 보임 · 넘기면 줄어듦 (HEALTH)', async () => {
      const a = await page.evaluate(() => { state.activeProject = null; state.tab = 'dashboard'; render(); const b = document.querySelector('#view [data-health="unbilled"]');
        return { text: b ? b.innerText.replace(/\s+/g, ' ').trim() : '', line: document.querySelector('#view [data-health-line]').dataset.healthLine, plan: hjUnbilledPlan().rows.map(r => r.project + ':' + r.from) }; });
      assert.equal(a.text, '🧾 내역서에 없는 작업 1', '나래(내역서도 견적도 없는 현장)의 사진 찍은 날 1건 — ' + JSON.stringify(a));
      assert.equal(a.line, 'todo');
      await page.click('#view [data-health="unbilled"]');
      await page.waitForSelector('#view [data-unbilled]');
      const b = await page.evaluate(() => { const tab = state.tab; document.querySelector('#view [data-unbilled-skip]').click(); state.tab = 'dashboard'; render(); return { tab, seg: !!document.querySelector('#view [data-health="unbilled"]') }; });
      assert.deepEqual(b, { tab: 'estimates', seg: false }, '넘기면 건강 줄에서 바로 사라짐 — ' + JSON.stringify(b));
      await page.evaluate(SEED, false);
      const c = await page.evaluate(() => { state.tab = 'dashboard'; render(); return { seg: !!document.querySelector('#view [data-health="unbilled"]'), n: hjUnbilledCount(), plan: hjUnbilledPlan().rows.length }; });
      assert.deepEqual([c.seg, c.n], [false, 0], '내역서가 없는 자료(예전 화면)에서는 건강 줄에 안 넣음(계획 ' + c.plan + '건이어도)');
    });
    await context.close();
    await test('④ 폰 390 — 현장 화면 칸 넘침 없음 · 단추 44px · 그리기만으로 자료 불변 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED, true);
      const r = await m.page.evaluate(() => { const strip = () => { const x = Object.assign({}, serializeData()); delete x.savedAt; return JSON.stringify(x); }, before = strip();
        state.activeProject = '가온'; state.tab = 'project'; render(); state.activeProject = null; state.tab = 'dashboard'; render(); state.activeProject = '가온'; state.tab = 'project'; render();
        const c = document.querySelector('#view [data-pjstmt]'), v = document.getElementById('view');
        const small = [...c.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height * 10) / 10).filter(h => h < 43.9);
        const st0 = JSON.parse(before), st1 = JSON.parse(strip()); delete st0.tab; delete st1.tab; delete st0.activeProject; delete st1.activeProject;
        return { right: Math.round(c.getBoundingClientRect().right), vw: innerWidth, over: document.documentElement.scrollWidth - innerWidth, viewOver: v.scrollWidth - v.clientWidth, small, same: JSON.stringify(st0) === JSON.stringify(st1) }; });
      assert.ok(r.right <= r.vw && r.over <= 1 && r.viewOver <= 1, '넘침 없음 — ' + JSON.stringify(r));
      assert.deepEqual(r.small, [], '44px');
      assert.ok(r.same, '그리기만으로 자료 불변');
      await m.context.close();
    });
    await test('⑤ 소스·핀 3곳(v568 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
      const src = html || SRC;
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
      const a = (src.match(/const APP_BUILD='(hyeonjang-v(\d+)-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.ok(Number(a.match(/-v(\d+)-/)[1]) >= 568, '핀 v568 이상 ' + a);
      assert.ok(src.includes(WIN) && src.includes('function hjProjStmtCard('), '소스에 있음');
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtphoto-v568: ${passed}/5 PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtphoto-v568 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

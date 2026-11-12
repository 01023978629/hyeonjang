/* v590 다 받은 내역서의 현장 줄 남은 돈 숨기기 — 대표 결정 11/12 "다 받은 현장 줄의 남은 돈은 숨겨 주세요".
   내역서를 다 받아 📄 내역서 보기 머리가 '✓ 다 받음'인데, 현장 미지정 입금처럼 현장별로 나눠 적지 않은 돈 때문에 현장 줄에 '남은 돈'이 남았다.
   현장 화면 '📑 이 현장 작업내역서' 칸도 같은 몫을 남은 돈으로 셌다. 합성 자료(이름은 지어낸 것), 시계 2026-11-05 고정, 바깥 쓰기 0.
   ① 내역서 보기 — 다 받은 내역서는 현장 줄에 남은 돈 없음(자료 hjStmtDetailData 의 g.left 는 그대로 — 화면만) · 덜 받은 내역서는 그대로 · 다 받은 현장은 '✓ 다 받음' (DETAIL)
   ② 현장 화면 칸 — 남은 돈은 아직 다 받지 않은 내역서만(내역서마다 이 현장 몫 − 이 현장으로 받은 돈) · 다 받은 내역서만 있는 현장은 '✓ 다 받음' · 합계·받은 돈 글자는 그대로 (CARD)
   ③ 폰 390 넘침 없음 · 저장본 불변 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)
   HJ_V590_BASELINE=<commit> 와 HJ_V590_MUTATION=show-left(현장 줄 남은 돈을 다시 보임)는 ①, card-all(현장 칸을 예전처럼 합계 − 받은 돈)은 ② 에서 실패해야 한다. */
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
const MUT = {
  'show-left': ["(g.left?(D.left?' · 남은 돈 '+W(g.left):''):' · <b style=\"color:var(--ok)\">✓ 다 받음</b>')", "(g.left?' · 남은 돈 '+W(g.left):' · <b style=\"color:var(--ok)\">✓ 다 받음</b>')"],
  'card-all': ['  return {name,lines,total,paid,left,n:qs.length};', '  left=Math.max(0,total-paid);return {name,lines,total,paid,left,n:qs.length};']
};
let html = process.env.HJ_V590_BASELINE ? execFileSync('git', ['show', process.env.HJ_V590_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V590_MUTATION) {
  const m = MUT[process.env.HJ_V590_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V590_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtdone-v590 ' + name); }
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
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
  state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = [];
  const mk = (src, date, project, lines) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project, lines }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  // A.xlsx — 가온 550,000 · 나래 110,000. 330,000 을 남은 돈 비율로(가온 275,000 · 나래 55,000) + 현장 없이 적힌 330,000 → 장부는 다 받음, 현장 몫은 갈림
  mk('A.xlsx', '2026-10-13', '가온아파트', [{ d: '2026-10-06', loc: '가온아파트 101-1001', work: '배관 교체', amt: 550000 }]);
  mk('A.xlsx', '2026-10-13', '나래아파트', [{ d: '2026-10-08', loc: '나래아파트 2-301', work: '실리콘 보수', amt: 110000 }]);
  hjStmtPayApply('A.xlsx', { amt: 330000, d: '2026-10-25', method: '계좌이체' });
  state.payLog.push({ d: '2026-10-30', project: '', amt: 330000, stmt: 'A.xlsx', memo: '현장 없이 적힌 입금' });
  // B.xlsx — 가온 440,000 중 140,000 만 받음(덜 받은 내역서)
  mk('B.xlsx', '2026-10-20', '가온아파트', [{ d: '2026-10-18', loc: '가온아파트 101-1001', work: '타일 보수', amt: 440000 }]);
  hjStmtPayApply('B.xlsx', { amt: 140000, d: '2026-10-28', method: '계좌이체' });
  // D.xlsx — 다솜 220,000 다 받음(현장 몫도 다 받음)
  mk('D.xlsx', '2026-10-22', '다솜아파트', [{ d: '2026-10-21', loc: '다솜아파트 3-502', work: '도어 보수', amt: 220000 }]);
  hjStmtPayApply('D.xlsx', { amt: 220000, d: '2026-10-31', method: '계좌이체' });
  state.activeProject = null; state.tab = 'estimates'; state.editingQuote = null;
  render();
};
const snapState = () => { const o = JSON.parse(JSON.stringify(serializeData())); delete o.savedAt; delete o.tab; delete o.activeProject; return JSON.stringify(o); };
const siteSums = () => [...document.querySelectorAll('#modalRoot [data-sd-site]')].map(s => [s.dataset.sdSite, s.querySelector('[data-sd-site-sum]').innerText.replace(/\s+/g, ' ').trim()]);

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);
    const before = await page.evaluate(snapState);

    await test('① 내역서 보기 — 다 받은 내역서는 현장 줄에 남은 돈 없음 · 덜 받은 내역서는 그대로 (DETAIL)', async () => {
      await page.evaluate(() => hjStmtDetailView('A.xlsx'));
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]');
      const a = await page.evaluate(sel => ({ head: document.querySelector('#modalRoot [data-sd-sum]').textContent.replace(/\s+/g, ' ').trim(), sites: eval(sel)(),
        data: hjStmtDetailData('A.xlsx').sites.map(g => [g.project, g.left]) }), '(' + siteSums.toString() + ')');
      assert.equal(a.head, '합계 660,000원 · 받음 660,000원 · ✓ 다 받음', '머리는 장부 셈으로 다 받음 ' + a.head);
      assert.deepEqual(a.sites, [['가온아파트', '합계 550,000원 · 받은 돈 275,000원'], ['나래아파트', '합계 110,000원 · 받은 돈 55,000원'], ['', '받은 돈 330,000원']],
        '다 받은 내역서의 현장 줄에는 남은 돈이 없다 ' + JSON.stringify(a.sites));
      assert.deepEqual(a.data, [['가온아파트', 275000], ['나래아파트', 55000], ['', 0]], '자료(g.left)는 그대로 — 화면에서만 숨김');
      await page.evaluate(() => hjStmtDetailView('B.xlsx'));
      await page.waitForSelector('#modalRoot [data-stmt-detail="B.xlsx"]');
      const b = await page.evaluate(sel => eval(sel)(), '(' + siteSums.toString() + ')');
      assert.deepEqual(b, [['가온아파트', '합계 440,000원 · 받은 돈 140,000원 · 남은 돈 300,000원']], '덜 받은 내역서는 현장 줄 남은 돈 그대로 ' + JSON.stringify(b));
      await page.evaluate(() => hjStmtDetailView('D.xlsx'));
      await page.waitForSelector('#modalRoot [data-stmt-detail="D.xlsx"]');
      const d = await page.evaluate(sel => eval(sel)(), '(' + siteSums.toString() + ')');
      assert.deepEqual(d, [['다솜아파트', '합계 220,000원 · 받은 돈 220,000원 · ✓ 다 받음']], '현장 몫까지 다 받으면 ✓ 다 받음 ' + JSON.stringify(d));
      await page.evaluate(() => closeModal(true));
    });

    await test('② 현장 화면 칸 — 남은 돈은 아직 다 받지 않은 내역서만 (CARD)', async () => {
      const card = async name => {
        await page.evaluate(n => { state.activeProject = n; state.tab = 'project'; __projView = null; render(); }, name);
        await page.waitForSelector('[data-pjstmt] [data-pjstmt-sum]');
        return page.evaluate(() => document.querySelector('[data-pjstmt] [data-pjstmt-sum]').innerText.replace(/\s+/g, ' ').trim());
      };
      // 가온: 합계 990,000(A 550,000 + B 440,000) · 받은 돈 415,000(A 275,000 + B 140,000) — 남은 돈은 덜 받은 B 몫 300,000 만(예전 셈이면 575,000)
      assert.equal(await card('가온아파트'), '합계 990,000원 · 받은 돈 415,000원 · 남은 돈 300,000원');
      // 나래: 다 받은 A 의 몫 55,000 만 남아 있었다 → ✓ 다 받음(예전 셈이면 '남은 돈 55,000원')
      assert.equal(await card('나래아파트'), '합계 110,000원 · 받은 돈 55,000원 · ✓ 다 받음');
      assert.equal(await card('다솜아파트'), '합계 220,000원 · 받은 돈 220,000원 · ✓ 다 받음');
      await page.evaluate(() => { state.activeProject = null; state.tab = 'estimates'; render(); });
    });

    await test('③ 폰 390 넘침 없음 · 저장본 불변 · 핀 3곳 같음 · 페이지 오류 0 · 외부 쓰기 0 (PHONE)', async () => {
      await page.evaluate(() => hjStmtDetailView('A.xlsx'));
      await page.waitForSelector('#modalRoot [data-stmt-detail="A.xlsx"]');
      const over = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-sd-site], #modalRoot [data-sd-site-sum]')].filter(e => e.scrollWidth - e.clientWidth > 1).length + (document.documentElement.scrollWidth > innerWidth + 1 ? 1 : 0));
      assert.equal(over, 0, '넘침 없음');
      await page.evaluate(() => closeModal(true));
      assert.equal(await page.evaluate(snapState), before, '보기만 했으니 저장본 그대로');
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c]);
        assert.ok(Number(a.match(/v(\d+)/)[1]) >= 590, '핀 v590 이상 ' + a);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('stmtdone-v590: ' + passed + '/3');
  if (passed !== 3) process.exit(1);
})().catch(e => { console.error('FAIL stmtdone-v590', e && e.stack || e); process.exit(1); });

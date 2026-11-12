/* v578 🧾 내역서 입금 증빙 한 번에 — 협력사는 내역서 한 장에 세금계산서 한 장인데, 입금은 현장마다 나눠 적혀(v527) 증빙도 줄마다 눌러야 했다(AGENTS v533 '안 한 것').
   합성 자료(이름은 지어낸 것), 시계 2026-11-05 고정, 바깥 쓰기 0.
   ① 대상 — 그 내역서 입금 중 증빙 없는 것만 · 증빙 있는 내역서·견적과 이어진 기록은 빠짐 · 장부 줄에 '🧾 증빙 n건 아직' (TARGET)
   ② 장부 → 창 → [n건 한 번에 기록] — 모든 줄 세금계산서 발행·같은 발행일·승인번호 · 안전판 1개 · 첫 화면 증빙 알림에서 빠짐 · 장부 버튼 사라짐 · 다시 열어도 그대로 (SAVE)
   ③ 기타·카드 뜻 · 막음 — 연 뒤 입금 기록이 바뀜 · 오래된 창 · 미래 발행일 · 아무것도 안 바뀜 (GUARD)
   ④ 데모 — 화면에서만 기록 · 폰 390 넘침 없음·44px · 페이지 오류 0 · 외부 쓰기 0 (DEMO)
   HJ_V578_BASELINE=<commit> 은 ①, HJ_V578_MUTATION=no-recheck(연 뒤 바뀐 기록 확인을 뺌)는 ③ 에서 실패해야 한다. */
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
  'no-recheck': ["  if(recs.length!==now.length||recs.some(r=>!now.includes(r)))throw new Error('입금 기록이 바뀌었어요 — 창을 다시 열어 주세요');\n", '']
};
let html = process.env.HJ_V578_BASELINE ? execFileSync('git', ['show', process.env.HJ_V578_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V578_MUTATION) {
  const m = MUT[process.env.HJ_V578_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V578_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtproof-v578 ' + name); }
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
    window.__snaps = []; const orig = hjSnapshot; hjSnapshot = async function (label) { window.__snaps.push(String(label)); return orig.apply(this, arguments); };
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true); __tabStale = false; state._demo = false;
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜아파트')];
  state.files = []; state.quotes = []; state.expenses = []; state.payLog = []; state.schedule = []; state.notes = [];
  const mk = (src, project, amts) => { const q = hjStmtBuildQuote({ src, file: src, doc: '작업내역서', to: '시험누수', date: '2026-10-13', vat: 'included', project, lines: amts.map((a, i) => ({ d: '2026-10-13', loc: project + ' ' + (i + 1) + '-101', work: '작업' + i, amt: a })) }); state.quotes.push(q); syncQuoteToProject(q); return q; };
  mk('A.xlsx', '가온아파트', [220000]); mk('A.xlsx', '나래아파트', [270000]); mk('A.xlsx', '다솜아파트', [1000000]);
  mk('B.xlsx', '가온아파트', [150000]); mk('C.xlsx', '나래아파트', [330000]); mk('D.xlsx', '다솜아파트', [440000]);
  hjStmtPayApply('A.xlsx', { amt: 1490000, d: '2026-10-31', method: '계좌이체' });
  hjStmtPayApply('B.xlsx', { amt: 150000, d: '2026-10-31', method: '계좌이체', proof: 'tax' });
  hjStmtPayApply('C.xlsx', { amt: 330000, d: '2026-10-31', method: '계좌이체' });
  hjStmtPayApply('D.xlsx', { amt: 440000, d: '2026-10-31', method: '계좌이체' });
  // 견적 받은 돈과 이어진 기록(v543) — 그 창에서 적는다
  const linked = state.payLog.find(x => x.stmt === 'D.xlsx'); linked.id = 'PL_LINKED'; state.quotes.find(q => q.stmt && q.stmt.src === 'D.xlsx').paid = { payLogId: 'PL_LINKED' };
  state.activeProject = null; state.tab = 'estimates'; window.__snaps = [];
  render();
};

(async () => {
  browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);
    await test('① 대상 — 증빙 없는 내역서 입금만 · 장부 줄 버튼 (TARGET)', async () => {
      const r = await page.evaluate(() => ({ A: hjStmtProofTargets('A.xlsx').map(x => x.project), B: hjStmtProofTargets('B.xlsx').length, D: hjStmtProofTargets('D.xlsx').length,
        btn: [...document.querySelectorAll('#view [data-stmtproof]')].map(b => [b.dataset.stmtproof, b.textContent.trim()]) }));
      assert.deepEqual(r.A, ['가온아파트', '나래아파트', '다솜아파트']);
      assert.equal(r.B, 0, '증빙 있는 내역서'); assert.equal(r.D, 0, '견적과 이어진 기록은 빠짐');
      assert.deepEqual(r.btn.sort(), [['A.xlsx', '🧾 증빙 3건 아직'], ['C.xlsx', '🧾 증빙 1건 아직']]);
    });
    await test('② 장부 → 창 → 한 번에 기록 — 세 줄 같은 발행일·번호 · 안전판 1개 · 알림에서 빠짐 · 버튼 사라짐 (SAVE)', async () => {
      const pend0 = await page.evaluate(() => hjProofPending('2026-11-05').filter(x => x.rec.stmt === 'A.xlsx').length);
      assert.equal(pend0, 3, '첫 화면 증빙 알림 3건');
      await page.click('#view [data-stmtproof="A.xlsx"]');
      await page.waitForSelector('#modalRoot [data-stmtproof-n]');
      assert.equal(await page.locator('#modalRoot [data-stmtproof-row]').count(), 3);
      assert.equal(await page.getAttribute('#modalRoot .spfKind[data-k="tax"]', 'aria-pressed'), 'true', '세금계산서가 기본');
      await page.fill('#modalRoot #spfAt', '2026-11-03'); await page.fill('#modalRoot #spfNo', '20261103-TEST-0001');
      await page.click('#modalRoot .mfoot button.clay');
      await page.waitForFunction(() => !document.querySelector('#modalRoot [data-stmtproof-n]'));
      const r = await page.evaluate(() => ({ recs: state.payLog.filter(x => x.stmt === 'A.xlsx').map(x => [x.proof, x.proofAt, x.issue && x.issue.status, x.issue && x.issue.no, x.method]),
        snaps: window.__snaps, pend: hjProofPending('2026-11-05').filter(x => x.rec.stmt === 'A.xlsx').length, btn: !!document.querySelector('#view [data-stmtproof="A.xlsx"]'),
        saved: JSON.parse(JSON.stringify(serializeData().payLog)).filter(x => x.stmt === 'A.xlsx').every(x => x.proof === 'tax'), toast: document.getElementById('toast').textContent }));
      assert.deepEqual(r.recs, Array(3).fill(['tax', '2026-11-03', 'issued', '20261103-TEST-0001', '계좌이체']), JSON.stringify(r.recs));
      assert.deepEqual(r.snaps, ['내역서 증빙 한 번에 전'], '안전판 1개: ' + JSON.stringify(r.snaps));
      assert.ok(r.pend === 0 && !r.btn && r.saved, JSON.stringify(r));
      assert.match(r.toast, /입금 기록 3건에 한 번에/);
      const again = await page.evaluate(() => { hjStmtProofView('A.xlsx'); return !!document.querySelector('#modalRoot [data-stmtproof-done]'); });
      assert.ok(again, '다시 열면 모두 기록함'); await page.evaluate(() => closeModal(true));
    });
    await test('③ 기타·카드 뜻 · 막음(연 뒤 바뀜·오래된 창·미래 발행일) — 아무것도 안 바뀜 (GUARD)', async () => {
      const r = await page.evaluate(async () => {
        const out = {}, snap = () => JSON.stringify(state.payLog);
        const recs = hjStmtProofTargets('C.xlsx');
        const extra = { d: '2026-11-01', project: '나래아파트', amt: 1000, stmt: 'C.xlsx', memo: 'x' }; state.payLog.push(extra);   // 창을 연 뒤 새 입금
        let b = snap(); try { await hjStmtProofSave('C.xlsx', 'tax', { recs }); out.changed = 'saved'; } catch (e) { out.changed = e.message; } out.changedSame = snap() === b;
        state.payLog.splice(state.payLog.indexOf(extra), 1);
        __tabStale = true; b = snap(); try { await hjStmtProofSave('C.xlsx', 'tax', {}); out.stale = 'saved'; } catch (e) { out.stale = e.message; } out.staleSame = snap() === b; __tabStale = false;
        b = snap(); try { await hjStmtProofSave('C.xlsx', 'cash', { at: '2026-11-09' }); out.future = 'saved'; } catch (e) { out.future = e.message; } out.futureSame = snap() === b;
        await hjStmtProofSave('C.xlsx', 'etc', {});
        out.etc = state.payLog.filter(x => x.stmt === 'C.xlsx').map(x => [x.proof, x.method]);
        return out;
      });
      assert.match(r.changed, /바뀌었어요/, '연 뒤 바뀐 기록: ' + r.changed); assert.ok(r.changedSame);
      assert.match(r.stale, /오래된 창/); assert.ok(r.staleSame);
      assert.match(r.future, /오늘까지/); assert.ok(r.futureSame);
      assert.deepEqual(r.etc, [['etc', '기타']]);
      const card = await page.evaluate(() => hjStmtProofInput({ d: '2026-10-31', amt: 1, method: '계좌이체' }, 'card', '', ''));
      assert.deepEqual(card, { method: '카드', issue: { type: 'none', status: 'notApplicable', no: '', at: '' } });
    });
    await test('④ 데모 — 화면에서만 · 폰 390 넘침 없음·44px · 오류 0 · 외부 쓰기 0 (DEMO)', async () => {
      await page.evaluate(SEED);
      await page.evaluate(() => { hjStmtProofView('A.xlsx'); });
      const ui = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#modalRoot button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim()) }));
      assert.ok(ui.over <= 1 && !ui.small.length, JSON.stringify(ui));
      await page.evaluate(() => closeModal(true));
      const r = await page.evaluate(async () => { state._demo = true; const x = await hjStmtProofSave('A.xlsx', 'tax', {}); const out = { x, n: state.payLog.filter(p => p.stmt === 'A.xlsx' && p.proof === 'tax').length, snaps: window.__snaps.length }; state._demo = false; return out; });
      assert.deepEqual(r, { x: { n: 3, demo: true }, n: 3, snaps: 0 });
      await context.close();
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    console.log(`stmtproof-v578: ${passed}/4 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL stmtproof-v578 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

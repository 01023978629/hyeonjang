/* delete-guard.e2e.js — 파괴적 삭제(AS 기록·회의록) 확인/스냅샷 가드 회귀
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   버그(감사 CONFIRMED): AS·회의록 삭제 ✕가 confirm·되돌리기 없이 즉시 영구 삭제 →
   장갑 낀 한 손 오조작으로 하자 기록 소실. 형제 삭제(자재·지출)와 달리 무방비였음. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await test('AS 삭제 — 취소하면 유지, 확인하면 삭제 + 삭제 전 강제 스냅샷', async () => {
    await page.evaluate(() => {
      // 스냅샷이 실제 저장되려면 projects/files/quotes 중 하나가 있어야 함(hjSnapshot 빈상태 미저장 정책)
      state.projects = [{ name: '가디언현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, doneAt: '2026-01-01', archived: false }];
      state.asLog = [{ id: 'as1', project: '가디언현장', date: '2026-01-01', text: '누수 하자', status: 'open' }];
      asManage();
    });
    await page.waitForTimeout(250);
    // 1) 취소 → 유지
    page.once('dialog', d => d.dismiss());
    await page.click('.asmDel');
    await page.waitForTimeout(250);
    const afterCancel = await page.evaluate(() => state.asLog.length);
    assert(afterCancel === 1, '취소(dismiss) 시 AS 기록 유지되어야: ' + afterCancel);
    // 2) 확인 → 삭제 + 스냅샷 생성
    const before = await page.evaluate(async () => ((await idbGet('hj_snaps')) || []).length);
    page.once('dialog', d => d.accept());
    await page.click('.asmDel');
    await page.waitForTimeout(500);
    const r = await page.evaluate(async () => ({ n: state.asLog.length, snaps: ((await idbGet('hj_snaps')) || []).length }));
    assert(r.n === 0, '확인(accept) 시 AS 기록 삭제되어야: ' + r.n);
    assert(r.snaps > before, '삭제 전 강제 스냅샷이 안전판에 남아야: ' + before + '→' + r.snaps);
  });

  await test('회의록 삭제 — 취소하면 유지, 확인하면 삭제', async () => {
    await page.evaluate(() => {
      state.projects = [{ name: '가디언현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, doneAt: '2026-01-01', archived: false }];
      state.notes = [{ id: 'n1', date: '2026-01-01', project: '가디언현장', text: '현장 회의 메모' }];
      voiceMemo();
    });
    await page.waitForTimeout(250);
    page.once('dialog', d => d.dismiss());
    await page.click('[data-notedel]');
    await page.waitForTimeout(250);
    const afterCancel = await page.evaluate(() => state.notes.length);
    assert(afterCancel === 1, '취소 시 회의록 유지: ' + afterCancel);
    page.once('dialog', d => d.accept());
    await page.click('[data-notedel]');
    await page.waitForTimeout(400);
    const n = await page.evaluate(() => state.notes.length);
    assert(n === 0, '확인 시 회의록 삭제: ' + n);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== delete-guard: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

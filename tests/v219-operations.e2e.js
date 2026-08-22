/* v219-operations.e2e.js — v218 도움말 백업의 안전한 운영 기능 병합
   전제: tests/static-server.js(8299) 실행 중, service worker 차단.

   이 테스트가 막는 회귀:
   1) 기능 검색에서 새 운영 화면이 빠지거나 민감 출입정보 메뉴가 다시 노출됨
   2) 월말·단가·차량·작업시간 데이터가 저장/복원 과정에서 유실됨
   3) 공동현관/도어락 비밀번호가 프로젝트 백업에 평문으로 섞임
   4) 같은 운행 범위를 두 번 경비로 넣어 지출이 중복 계상됨
   5) 잘못 찍은 작업 시작/종료 시각을 수정할 수 없음 */
'use strict';

let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (_) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  async function seed() {
    await page.evaluate(() => {
      state.projects = [{
        name: '테스트 현장', stage: 3, doneAt: '2026-08-20', received: 0,
        phases: ['방수', '마감'], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '고객', phone: '', addr: '대전 중구' }, archived: false,
        access: { door: 'LEGACY-DOOR-SECRET', unit: 'LEGACY-UNIT-SECRET' }
      }];
      state.files = [];
      state.quotes = [];
      state.schedule = [];
      state.notes = [];
      state.payLog = [];
      state.asLog = [];
      state.aptOrders = [];
      state.aptRates = [{ id: 'r1', name: '누수 탐지', spec: '1회', price: 150000, note: '' }];
      state.monthClosed = { '2026-07': { at: '2026-08-01T00:00:00.000Z' } };
      state.quoteSets = [{ id: 'q1', name: '누수 기본', items: [{ name: '탐지', qty: 1, unit: 150000 }] }];
      state.trips = [{ id: 't1', date: '2026-08-20', project: '테스트 현장', km: 20, memo: '현장 방문' }];
      state.tripCfg = { rate: 100 };
      state.workLogs = [{ id: 'w1', project: '테스트 현장', date: '2026-08-20', in: '09:00', out: '18:00', memo: '' }];
      state.expenses = [];
      state.activeProject = null;
      state.tab = 'dashboard';
      render();
    });
  }

  await test('기능 검색은 새 운영 기능을 찾고 출입 비밀번호 기능은 제외한다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const names = ['월말', '운행', '완료보고서', '단가표', '사진 도구'].map(q => (hjActionSearch(q)[0] || {}).n || '');
      const secretHits = hjActionSearch('비밀번호').map(x => x.n);
      return { names, secretHits };
    });
    assert(r.names[0] === '월말 마감', '월말 검색: ' + JSON.stringify(r.names));
    assert(r.names[1] === '차량 운행일지', '운행 검색: ' + JSON.stringify(r.names));
    assert(r.names[2] === '완료보고서', '완료보고서 검색: ' + JSON.stringify(r.names));
    assert(r.names[3] === '표준 단가표', '단가표 검색: ' + JSON.stringify(r.names));
    assert(r.names[4] === '사진 도구', '사진 도구 검색: ' + JSON.stringify(r.names));
    assert(r.secretHits.length === 0, '민감 출입 메뉴가 검색됨: ' + JSON.stringify(r.secretHits));
  });

  await test('운영 데이터는 직렬화·복원되고 출입 비밀번호는 백업에서 제거된다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const saved = JSON.parse(JSON.stringify(serializeData()));
      const serialized = JSON.stringify(saved);
      state.aptRates = []; state.monthClosed = {}; state.quoteSets = [];
      state.trips = []; state.tripCfg = {}; state.workLogs = [];
      applyData(saved);
      return {
        rates: state.aptRates.length,
        closed: !!state.monthClosed['2026-07'],
        sets: state.quoteSets.length,
        trips: state.trips.length,
        rate: state.tripCfg.rate,
        work: state.workLogs.length,
        projectAccess: Object.prototype.hasOwnProperty.call(state.projects[0] || {}, 'access'),
        leaked: serialized.includes('LEGACY-DOOR-SECRET') || serialized.includes('LEGACY-UNIT-SECRET')
      };
    });
    assert(r.rates === 1 && r.closed && r.sets === 1, '단가·월말·품목세트 왕복: ' + JSON.stringify(r));
    assert(r.trips === 1 && r.rate === 100 && r.work === 1, '차량·작업시간 왕복: ' + JSON.stringify(r));
    assert(!r.projectAccess && !r.leaked, '출입 비밀번호가 백업/복원됨: ' + JSON.stringify(r));
  });

  await test('손상된 새 데이터 키는 기존 정상 상태를 덮어쓰지 않는다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const bad = {
        files: [], projects: state.projects,
        aptRates: { broken: true }, monthClosed: [], quoteSets: 'broken',
        trips: { broken: true }, tripCfg: 'broken', workLogs: { broken: true }
      };
      let error = '';
      try { applyData(bad); } catch (e) { error = String(e && e.message || e); }
      return {
        error,
        rates: Array.isArray(state.aptRates) ? state.aptRates.length : -1,
        closed: !!(state.monthClosed && state.monthClosed['2026-07']),
        sets: Array.isArray(state.quoteSets) ? state.quoteSets.length : -1,
        trips: Array.isArray(state.trips) ? state.trips.length : -1,
        rate: state.tripCfg && state.tripCfg.rate,
        work: Array.isArray(state.workLogs) ? state.workLogs.length : -1
      };
    });
    assert(!r.error, '손상 백업 적용 중 예외: ' + r.error);
    assert(r.rates === 1 && r.closed && r.sets === 1, '단가·월말·세트 정상값 손상: ' + JSON.stringify(r));
    assert(r.trips === 1 && r.rate === 100 && r.work === 1, '차량·작업시간 정상값 손상: ' + JSON.stringify(r));
  });

  await test('같은 운행 범위는 경비로 한 번만 반영한다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      window.__trip = { from: '2026-08-20', to: '2026-08-20', pj: '테스트 현장', page: 1 };
      tripView();
      const first = document.getElementById('trExp');
      first.click();
      tripView();
      const second = document.getElementById('trExp');
      if (second) second.click();
      return {
        count: state.expenses.length,
        sourceKeys: state.expenses.map(x => x.sourceKey).filter(Boolean),
        amount: state.expenses.reduce((s, x) => s + Number(x.amount || 0), 0)
      };
    });
    assert(r.count === 1, '운행 경비 중복: ' + JSON.stringify(r));
    assert(r.sourceKeys.length === 1, '운행 경비 식별키 없음: ' + JSON.stringify(r));
    assert(r.amount === 2000, '20km × 100원 = 2,000원: ' + JSON.stringify(r));
  });

  await test('작업시간 기록을 수정하면 합계에 바로 반영한다', async () => {
    await seed();
    const r = await page.evaluate(() => {
      workView('테스트 현장');
      const edit = document.querySelector('#modalRoot .wkEdit[data-id="w1"]');
      if (!edit) return { edit: false };
      edit.click();
      document.getElementById('wkIn').value = '10:00';
      document.getElementById('wkOut').value = '16:30';
      const save = document.getElementById('wkSave');
      if (save) save.click();
      const row = state.workLogs.find(x => x.id === 'w1');
      return { edit: true, in: row.in, out: row.out, minutes: workMinutes(row) };
    });
    assert(r.edit, '작업시간 수정 버튼 없음');
    assert(r.in === '10:00' && r.out === '16:30', '수정값 미반영: ' + JSON.stringify(r));
    assert(r.minutes === 390, '수정 후 6시간30분이 아님: ' + JSON.stringify(r));
  });

  const failed = results.filter(x => !x.ok);
  console.log('\n== v219 operations: ' + (results.length - failed.length) + '/' + results.length + ' passed, pageerrors=' + pageErrors.length + ' ==');
  if (failed.length) failed.forEach(x => console.log('  FAIL ' + x.name + '\n    ' + x.err));
  if (pageErrors.length) console.log('  PAGEERRORS ' + pageErrors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(failed.length || pageErrors.length ? 1 : 0);
})();

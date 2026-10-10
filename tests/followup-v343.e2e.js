/* followup-v343.e2e.js — v343 드라이브 빈 기록 예방·외주(매입) 견적·옛 호수 현장 합치기 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.

   · 드라이브 빈 기록: 2026-10-08 실측 242개가 applyData 병합에서 생겼다(PC 원본 기록과 같은 Drive ID·이름, 정보 없음).
     병합에서는 새로 만들지 않되, 정보가 다른 기록·되돌리기(revert)·PC 원본이 없는 기기(폰)는 예전 그대로 둔다.
   · 외주(매입) 견적: 다른 업체가 낸 견적(용진인테리어)이 매출로 잡혔다. 표시하면 사본까지 함께 매출에서 빠지고
     현장 '외주' 지출이 한 번만 기록되며, 되돌리면 손대지 않은 그 지출만 지운다.
   · 옛 호수 현장: '삼성아파트 21동 301호' 같은 옛 현장을 단지 동·호수로 합친다. v331 안전 규칙(연결 기록 있으면 막기,
     동 없는 이름은 추정 안 함)을 그대로 쓰고, 여러 곳이어도 안전판은 한 번만 찍는다. */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  await test('드라이브 병합은 PC 원본과 같은 Drive 사진의 빈 기록을 새로 만들지 않는다 (정보 다름·되돌리기·폰은 예전대로)', async () => {
    const r = await page.evaluate(() => {
      state._demo = false;
      const P = n => ({ name: n, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' } });
      state.projects = [P('케이투커피')];
      const live = { id: 'L1', name: 'G1.jpg', handle: null, prefix: '_정리완료/케이투커피/현장사진/', ext: 'jpg', size: 5000, kind: 'photo', project: '케이투커피',
        when: new Date('2026-06-16T08:00:00Z'), lat: 36.3, lng: 127.4, thumb: null, text: '', ocr: 'na', est: null, contact: null, _file: new Blob([new Uint8Array(5000)]), _driveId: 'drv1' };
      state.files = [live];
      const base = serializeData(), rec = base.files[0];
      const ghost = { ...rec, prefix: '현장사진/', when: '2026-06-26T10:00:00.000Z', lat: null, lng: null }; delete ghost.key;
      const other = { ...ghost, project: '다른현장', prefix: '현장사진/sub/' };
      const n = () => state.files.filter(f => f._driveId === 'drv1').length;
      applyData({ ...base, files: [rec, ghost] }); const merge = n();
      state.files = [live]; applyData({ ...base, files: [rec, other] }); const withInfo = n();
      state.files = [live]; applyData({ ...base, files: [rec, ghost] }, { revert: true }); const revert = n();
      state.files = []; applyData({ ...base, files: [rec, ghost] }); const phone = n();
      return { merge, withInfo, revert, phone };
    });
    assert(r.merge === 1, '빈 기록이 또 생겼다: ' + JSON.stringify(r));
    assert(r.withInfo === 2, '정보가 다른 기록은 남겨야 한다: ' + JSON.stringify(r));
    assert(r.revert === 2, '되돌리기는 스냅샷 그대로여야 한다: ' + JSON.stringify(r));
    assert(r.phone === 2, 'PC 원본이 없는 기기는 예전 동작 그대로여야 한다: ' + JSON.stringify(r));
  });

  await test('외주(매입) 견적: 사본까지 매출에서 빠지고 외주 지출 1건, 되돌리면 원래대로', async () => {
    const r = await page.evaluate(async () => {
      state._demo = false; state.expenses = []; state.quotes = [];
      const P = n => ({ name: n, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
      state.projects = [P('태산그린아파트')];
      const E = (id, name, amount) => ({ id, name, ext: name.split('.').pop(), kind: 'estimate', project: '태산그린아파트', est: { amount, supply: Math.round(amount / 1.1), vat: amount - Math.round(amount / 1.1), date: '2026-06-04' }, when: new Date('2026-06-04') });
      state.files = [E('a', '20260604 태산그린아파트-넥산 작업.xlsx', 3366000), E('b', '태산그린아파트 넥산 작업-용진인테리어.xlsx', 6512000), E('c', '태산그린아파트 넥산 작업-용진인테리어.pdf', 6512000)];
      const sales = () => hjSalesEntries().reduce((n, e) => n + e.amount, 0);
      const before = sales();
      state.tab = 'estimates'; render();
      document.querySelector('[data-estpurchase="b"]').click();
      await new Promise(r => setTimeout(r, 50));
      const mid = { sales: sales(), est: projStats('태산그린아파트').est, exp: state.expenses.map(e => [e.category, e.amount, e.project, e.vendor]), cost: projStats('태산그린아파트').costEffective,
        flags: state.files.map(f => !!(f.est && f.est.purchase)), saved: JSON.stringify(serializeData().files.find(f => f.name.endsWith('용진인테리어.xlsx')).est || {}) };
      document.querySelector('[data-estpurchase="c"]').click();
      await new Promise(r => setTimeout(r, 50));
      return { before, mid, after: sales(), expAfter: state.expenses.length, flagsAfter: state.files.map(f => !!(f.est && f.est.purchase)) };
    });
    assert(r.before === 3366000 + 6512000, '시작 매출: ' + r.before);
    assert(r.mid.sales === 3366000, '외주 견적(사본 포함)이 매출에서 안 빠졌다: ' + JSON.stringify(r.mid));
    assert(JSON.stringify(r.mid.flags) === '[false,true,true]', '같은 견적의 PDF 사본도 함께 표시돼야 한다: ' + JSON.stringify(r.mid.flags));
    assert(r.mid.exp.length === 1 && r.mid.exp[0][0] === '외주' && r.mid.exp[0][1] === 6512000 && r.mid.exp[0][3] === '용진인테리어', '외주 지출 기록: ' + JSON.stringify(r.mid.exp));
    assert(r.mid.cost === 6512000, '현장 외주 원가에 잡혀야 한다: ' + r.mid.cost);
    assert(r.mid.saved.includes('"purchase":true'), '저장 자료에 표시가 남아야 한다: ' + r.mid.saved);
    assert(r.after === r.before && r.expAfter === 0 && r.flagsAfter.every(x => !x), '되돌리기: ' + JSON.stringify(r));
  });

  await test('옛 호수 현장을 단지 동·호수로 합치고(사진·공정 이동, 보관), 막을 것은 막으며 안전판은 한 번', async () => {
    const r = await page.evaluate(async () => {
      state._demo = false; state.expenses = []; state.quotes = [];
      const P = (n, x) => Object.assign({ name: n, stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, x || {});
      state.projects = [P('삼성아파트', { aptUnits: [] }), P('삼성아파트 21동 301호', { phases: ['철거', '도배'] }),
        P('무궁화아파트', { aptUnits: [{ id: 'unit_a1', type: 'unit', dong: '202', ho: '903', name: '', note: '' }] }), P('무궁화아파트 202동903호'),
        P('열매마을', { aptUnits: [] }), P('열매마을 704-1102'), P('목양마을아파트 1502호'), P('효성혜링턴', { aptUnits: [] }), P('효성혜링턴 105동501호')];
      state.payLog = [{ id: 'pl1', project: '효성혜링턴 105동501호', amount: 100000, date: '2026-06-01' }];
      state.files = [{ id: 'f1', name: 'a.jpg', kind: 'photo', ext: 'jpg', size: 10, prefix: '현장사진/', project: '삼성아파트 21동 301호', when: new Date('2026-06-01'), handle: null, _file: null, _virtual: true, text: '', ocr: 'na' }];
      render();
      const c = hjAptLegacyCandidates();
      let snaps = 0; const orig = hjSnapshot; window.hjSnapshot = async (...a) => { snaps++; return orig(...a); };
      let done; try { done = await hjAptLegacyMergeApply(c); } finally { window.hjSnapshot = orig; }
      const sam = state.projects.find(p => p.name === '삼성아파트');
      return { ok: c.filter(x => x.ok).map(x => x.name), blocked: c.filter(x => !x.ok).map(x => x.name), done: done.length, snaps,
        units: aptUnitList(sam).map(u => u.dong + '-' + u.ho), phases: sam.phases, file: [state.files[0].project, state.files[0]._aptUnit && state.files[0]._aptUnit.unitId === aptUnitList(sam)[0].id],
        archived: state.projects.filter(p => p.archived).map(p => p.name).sort(), hyo: state.projects.find(p => p.name === '효성혜링턴 105동501호').archived || false,
        mug: aptUnitList(state.projects.find(p => p.name === '무궁화아파트')).length };
    });
    assert(JSON.stringify(r.ok) === JSON.stringify(['삼성아파트 21동 301호', '무궁화아파트 202동903호']), '합칠 대상: ' + JSON.stringify(r));
    assert(['열매마을 704-1102', '목양마을아파트 1502호', '효성혜링턴 105동501호'].every(n => r.blocked.includes(n)), '추정·연결 기록 현장은 막아야 한다: ' + JSON.stringify(r.blocked));
    assert(r.snaps === 1, '안전판은 한 번만: ' + r.snaps);
    assert(JSON.stringify(r.units) === '["21-301"]' && JSON.stringify(r.phases) === '["철거","도배"]', '동·호수·공정: ' + JSON.stringify(r));
    assert(r.file[0] === '삼성아파트' && r.file[1] === true, '사진이 동·호수로 옮겨져야 한다: ' + JSON.stringify(r.file));
    assert(JSON.stringify(r.archived) === JSON.stringify(['무궁화아파트 202동903호', '삼성아파트 21동 301호']) && !r.hyo, '보관: ' + JSON.stringify(r));
    assert(r.mug === 1, '이미 있는 동·호수는 재사용해야 한다: ' + r.mug);
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== followup-v343: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

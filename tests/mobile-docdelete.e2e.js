/* mobile-docdelete.e2e.js — 폰에서 현장별 정리함의 견적서 [🗑 삭제] 회귀 (Playwright)
   원래 증상: 폰(모바일 모드)에서 견적서 삭제 버튼은 보이는데 눌러도
   "📱 모바일은 올리기·보기 전용입니다" 안내만 뜨고 아무것도 지워지지 않았다
   (docDelete 가 requireEditMode 로 모바일 전체를 막고 있었다 — 정작 그 아래 모달은
   '앱 목록에서만 제거' 경우를 이미 준비해 두었는데 도달을 못 했다).

   지키는 것:
   ① 폰에서 삭제 확인 모달이 열리고, 실제로 목록에서 빠지며 매출 집계에서도 빠진다
   ② 폰에서는 원본 파일을 건드리지 않는다(폴더 쓰기 호출 0) — 안내 문구도 그렇게 말한다
   ③ 지우기 전에 스냅샷(🛡 안전판)이 남아 되살릴 수 있다
   ④ 드라이브에서 온 파일은 '제거함'으로 기록돼 다시 불러와도 되살아나지 않는다
   ⑤ PC(폴더 연결)에서는 예전대로 폴더의 원본까지 지운다 — 기존 동작 회귀 방지
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실제 파일·네트워크 없음. */
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

  async function seedMobile() {
    await page.evaluate(() => {
      state.projects = [{ name: '유천동주택', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '가', phone: '', addr: '' }, archived: false }];
      state.files = [
        // 이름을 뚜렷이 다르게 둔다 — 비슷하면 견적 중복제거(estimateGroups)로 묶여 집계가 한쪽만 잡힌다
        { id: 'del1', name: '유천동 도배공사 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '유천동주택', _driveId: 'drv-del1',
          est: { amount: 3000000, supply: 2727273, vat: 272727, date: '2026-07-01' } },
        { id: 'keep1', name: '유천동 욕실방수 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '유천동주택',
          est: { amount: 5000000, supply: 4545455, vat: 454545, date: '2026-07-02' } }
      ];
      state.dirHandle = null;                       // 폰: 폴더 연결 없음
      state.activeProject = '유천동주택'; state.tab = 'project'; state.dirty = false;
      __mobileMode = true; applyMobileMode(); render();
    });
    await page.waitForTimeout(250);
  }
  await seedMobile();

  await test('① 폰: 견적서 삭제 버튼이 보이고, 누르면 확인 모달이 열린다', async () => {
    const r = await page.evaluate(() => {
      const btn = document.querySelector('.card[data-id="del1"] [data-fdel]');
      if (!btn) return { noBtn: true };
      btn.click();
      const root = document.getElementById('modalRoot');
      return { txt: (root && root.textContent || '').slice(0, 300) };
    });
    assert(!r.noBtn, '견적서 카드에 [🗑 삭제] 버튼이 있어야 함');
    assert(/파일 삭제/.test(r.txt), '삭제 확인 모달이 열려야 함(예전엔 안내 토스트만 뜨고 끝났다): ' + r.txt.slice(0, 120));
    assert(/유천동 도배공사 견적\.xlsx/.test(r.txt), '지울 파일 이름이 보여야 함');
  });

  await test('② 폰: 안내가 "목록에서만 제거 · 원본은 그대로"라고 정직하게 말한다', async () => {
    const txt = await page.evaluate(() => (document.getElementById('modalRoot') || {}).textContent || '');
    assert(/앱 목록에서만/.test(txt), '목록에서만 제거된다고 안내해야 함: ' + txt.slice(0, 200));
    assert(/원본 파일은 그대로/.test(txt), '원본 보존을 안내해야 함');
    assert(!/폴더의 실제 파일이 삭제됩니다/.test(txt), '폰에서 원본 삭제를 예고하면 안 됨');
  });

  await test('①-2 폰: 삭제를 누르면 실제로 목록·매출 집계에서 빠진다', async () => {
    const r = await page.evaluate(async () => {
      const before = salesEstimateFiles().reduce((s, f) => s + (f.est.amount || 0), 0);
      const btns = [...document.querySelectorAll('#modalRoot button')];
      const del = btns.find(b => b.textContent.trim() === '삭제');
      del.click();
      // 삭제는 강제 스냅샷(IDB 왕복)과 removed_ids 기록 뒤에 일어난다 — 빠질 때까지 기다린다(최대 5초)
      for (let i = 0; i < 200 && state.files.some(f => f.id === 'del1'); i++) await new Promise(r2 => setTimeout(r2, 25));
      const after = salesEstimateFiles().reduce((s, f) => s + (f.est.amount || 0), 0);
      return { before, after, gone: !state.files.some(f => f.id === 'del1'),
        kept: state.files.some(f => f.id === 'keep1'),
        card: !document.querySelector('.card[data-id="del1"]') };
    });
    assert(r.gone, '삭제한 견적서가 state.files 에서 빠져야 함');
    assert(r.kept, '다른 견적서는 남아야 함');
    assert(r.card, '화면 카드도 사라져야 함');
    assert(r.before === 8000000 && r.after === 5000000, '매출 집계 8,000,000 → 5,000,000 이어야 함: ' + r.before + '→' + r.after);
  });

  await test('③ 지우기 전 스냅샷이 남아 되살릴 수 있다', async () => {
    const r = await page.evaluate(async () => {
      const snaps = (await idbGet('hj_snaps')) || [];
      const last = snaps[snaps.length - 1] || {};
      // 스냅샷의 파일은 serializeData 형태(id 없음 · name/key 기준)
      const had = ((last.data || {}).files || []).some(f => f.name === '유천동 도배공사 견적.xlsx');
      return { label: last.label || '', had, n: snaps.length };
    });
    assert(/삭제 전/.test(r.label), '삭제 전 스냅샷 라벨이 남아야 함: ' + r.label);
    assert(r.had, '스냅샷 안에 지운 파일이 들어 있어야 복구가 된다');
  });

  await test('④ 드라이브 파일은 다시 불러와도 되살아나지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const inMem = __removedIds.has('drv-del1');
      const saved = ((await idbGet('removed_ids')) || []).indexOf('drv-del1') >= 0;
      return { inMem, saved };
    });
    assert(r.inMem, '__removedIds 에 기록돼야 함(재유입 차단)');
    assert(r.saved, '기기에 저장돼야 함 — 앱을 껐다 켜도 유지');
  });

  await test('⑤ PC(폴더 연결): 예전대로 폴더의 원본까지 지운다', async () => {
    const r = await page.evaluate(async () => {
      let removed = '';
      state.files = [{ id: 'pc1', name: 'PC견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '유천동주택',
        prefix: '', est: { amount: 1000000 },
        handle: { remove: async () => { removed = 'handle'; } } }];
      state.dirHandle = { getDirectoryHandle: async () => ({}) };   // 폴더 연결됨(가짜)
      __mobileMode = false; applyMobileMode(); render();
      await new Promise(r2 => setTimeout(r2, 150));
      document.querySelector('.card[data-id="pc1"] [data-fdel]').click();
      const warnTxt = (document.getElementById('modalRoot') || {}).textContent || '';
      const del = [...document.querySelectorAll('#modalRoot button')].find(b => b.textContent.trim() === '삭제');
      del.click();
      for (let i = 0; i < 200 && state.files.some(f => f.id === 'pc1'); i++) await new Promise(r2 => setTimeout(r2, 25));
      return { removed, warned: /폴더의 실제 파일이 삭제됩니다/.test(warnTxt), gone: !state.files.some(f => f.id === 'pc1') };
    });
    assert(r.warned, 'PC에서는 원본 삭제를 경고해야 함');
    assert(r.removed === 'handle', 'PC에서는 폴더의 원본 파일이 삭제돼야 함: ' + r.removed);
    assert(r.gone, '목록에서도 빠져야 함');
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

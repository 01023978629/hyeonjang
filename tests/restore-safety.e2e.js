/* restore-safety.e2e.js — 자료를 덮어쓰는 경로의 안전판(스냅샷) 회귀
   원칙: 지금 자료를 덮어쓰는 동작은 예외 없이 '덮어쓰기 전에 안전판 저장에 성공'해야 진행한다.
        저장에 실패하면 덮어쓰지 않고 중단한다(실패를 조용히 삼키지 않는다).
   이게 깨지면 날짜를 잘못 고른 되돌리기 한 번으로 되돌아올 방법이 사라진다.
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 700) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const seedLocal = () => page.evaluate(() => {
    state.projects = [{ name: '지금작업중', stage: 2, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
      customer: {}, received: 3000000, archived: false }];
    state.files = [{ id: 'f1', kind: 'estimate', project: '지금작업중', name: 'q.xlsx',
      est: { amount: 9000000 }, when: new Date() }];
    state.quotes = []; state.asLog = []; state.schedule = [];
  });

  await test('★드라이브 되돌리기 — 덮어쓰기 전에 안전판을 남긴다', async () => {
    await seedLocal();
    const r = await page.evaluate(async () => {
      // hjSnapshot 은 자동저장 경로에서도 불린다 → '불렸다'만 보면 안 되고
      // **덮어쓰기 전에** 불렸는지(그 시점 자료가 아직 옛것인지) 순서를 확인해야 한다.
      let snapAt = null;
      // __gdToken 은 let 선언이라 window 로 못 바꾼다 → 함수 선언인 gdGetToken 을 스텁한다
      const origSnap = window.hjSnapshot, origTokFn = window.gdGetToken, origFetch = window.fetch;
      window.hjSnapshot = async () => {
        if (snapAt === null) snapAt = (state.projects || []).map(p => p.name);   // 첫 호출 시점의 자료
        return true;
      };
      window.gdGetToken = async () => 'stub-token';
      window.fetch = async () => ({ ok: true, status: 200,
        json: async () => ({ app: '현장', version: 1, projects: [{ name: '옛날현장' }], files: [] }) });
      const ok = await gdRestoreBackup('FILEID');
      window.hjSnapshot = origSnap; window.gdGetToken = origTokFn; window.fetch = origFetch;
      return { ok, snapAt, now: (state.projects || []).map(p => p.name) };
    });
    assert(r.snapAt !== null, '되돌리기 전에 안전판 저장이 호출돼야 함(없으면 되돌아올 길이 사라짐)');
    assert(r.snapAt.indexOf('지금작업중') !== -1,
      '안전판에 담긴 건 덮어쓰기 *전* 자료여야 함(덮어쓴 뒤 찍으면 의미 없음): ' + JSON.stringify(r.snapAt));
    assert(r.ok, '정상 흐름에서는 되돌리기가 성공해야 함');
    assert(r.now.indexOf('옛날현장') !== -1, '되돌린 자료가 실제로 적용됨: ' + JSON.stringify(r.now));
  });

  await test('★안전판 저장이 실패하면 덮어쓰지 않고 중단한다', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '소중한자료', stage: 2, phases: [], cost: {}, customer: {}, received: 0, archived: false }];
      state.files = [];
      // ※ __gdToken 은 let 선언이라 window 로 못 바꾼다. gdGetToken(함수 선언)을 스텁해야
      //   실제 구글 로그인이 돌지 않고 본 흐름까지 도달한다.
      //   (이걸 빠뜨리면 로그인 실패로 false 가 반환돼 '가드가 없는데도 통과'하는 가짜 테스트가 된다)
      const origSnap = window.hjSnapshot, origTokFn = window.gdGetToken, origFetch = window.fetch;
      window.hjSnapshot = async () => false;          // 저장공간 부족 등으로 안전판 저장 실패
      window.gdGetToken = async () => 'stub-token';
      window.fetch = async () => ({ ok: true, status: 200,
        json: async () => ({ app: '현장', version: 1, projects: [{ name: '덮어쓸자료' }], files: [] }) });
      const ok = await gdRestoreBackup('FILEID');
      window.hjSnapshot = origSnap; window.gdGetToken = origTokFn; window.fetch = origFetch;
      return { ok, now: (state.projects || []).map(p => p.name) };
    });
    assert(r.ok === false, '안전판 실패 시 false 를 반환해 중단해야 함');
    assert(r.now.indexOf('소중한자료') !== -1, '지금 자료가 보존돼야 함: ' + JSON.stringify(r.now));
    assert(r.now.indexOf('덮어쓸자료') === -1, '안전판 없이 덮어쓰면 안 됨: ' + JSON.stringify(r.now));
  });

  await test('★서버(relay) 불러오기도 같은 규약 — 안전판 실패 시 로컬 보존', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '로컬자료', stage: 2, phases: [], cost: {}, customer: {}, received: 0, archived: false }];
      state.files = [];
      const origSnap = window.hjSnapshot, origLoad = window.cloudApiLoad;
      window.hjSnapshot = async () => false;
      window.cloudApiLoad = async () => ({ ok: true, exists: true, revision: 5,
        data: { app: '현장', version: 1, projects: [{ name: '서버자료' }], files: [] } });
      const ok = await relayLoadApply(true, 'test');
      window.hjSnapshot = origSnap; window.cloudApiLoad = origLoad;
      return { ok, now: (state.projects || []).map(p => p.name) };
    });
    assert(r.ok === false, '안전판 실패 → 적용 중단');
    assert(r.now.indexOf('로컬자료') !== -1, '로컬 자료 보존: ' + JSON.stringify(r.now));
  });

  await test('빈 기기에서는 안전판 없이도 진행된다 (보호할 자료가 없음)', async () => {
    const ok = await page.evaluate(async () => {
      state.projects = []; state.files = []; state.quotes = [];
      const origSnap = window.hjSnapshot;
      let called = false;
      window.hjSnapshot = async () => { called = true; return false; };   // 실패해도
      const r = await relayGuardSnapshot('빈 기기');
      window.hjSnapshot = origSnap;
      return { r, called };
    });
    assert(ok.r === true, '빈 기기는 통과시켜야 함(첫 사용 시 불러오기가 막히면 안 됨)');
    assert(ok.called === false, '보호할 자료가 없으면 스냅샷 시도 자체를 안 함');
  });

  await test('되돌리기 확인 문구 — 덮어쓴다는 사실을 미리 알린다', async () => {
    const txt = await page.evaluate(() => {
      const src = gdShowRestore.toString();
      return src;
    });
    assert(/덮어/.test(txt), '되돌리기 안내에 덮어쓴다는 경고가 있어야 함');
    assert(/confirm\(/.test(txt), '한 번 더 확인을 받아야 함');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== restore-safety: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

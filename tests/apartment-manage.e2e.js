/* apartment-manage.e2e.js — 🏢 아파트 관리 탭 (v299)

   지키는 것:
   ① 탭을 **실제로 눌러** 화면이 열린다. 상단 탭·더보기 양쪽 진입로 모두.
      (v297 회귀의 교훈 — 함수를 직접 부르면 배선이 죽어도 통과한다)
   ② 같은 단지끼리 묶인다. 아파트가 아닌 현장·보관한 현장은 들어오지 않는다.
   ③ 이름에서 읽은 동·호수는 **미리보기 없이 등록되지 않는다**. 취소하면 자료가 그대로다.
   ④ 등록은 한 번만 — 두 번 눌러도, 이미 있는 동·호수여도 중복이 안 생긴다.
   ⑤ 사진은 절대 배정되지 않는다(_aptUnit 불변). 현장명·파일명도 안 바뀐다.
   ⑥ 동명 현장 2개는 손대지 않는다(aptUnitProject 가 null 을 주는 상황).
   ⑦ 등록 직전 안전판(스냅샷)이 남는다 — 되돌릴 수 있어야 한다.
   ⑧ 등록은 로컬만 — 바깥으로 아무것도 보내지 않는다.

   HJ_APT_MANAGE_MUTATION=parse|dupe|preview 로 한 축씩 페이지에서만 깨뜨리면
   같은 회귀가 반드시 실패해야 한다. 운영 소스·고객 자료는 건드리지 않는다.

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_APT_MANAGE_MUTATION || '';
assert(['', 'parse', 'dupe', 'preview'].includes(MUTATION), 'unknown HJ_APT_MANAGE_MUTATION');
let browser, passed = 0;

async function boot(width = 1200) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600,
    hasTouch: width < 600, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = [], unexpectedRequests = [];
  page.on('pageerror', e => errors.push(String(e)));
  let monitorNetwork = false;
  page.on('request', req => { if (monitorNetwork && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) unexpectedRequests.push(req.url()); });
  const gisDone = page.waitForEvent('requestfailed', { predicate: r => r.url() === 'https://accounts.google.com/gsi/client', timeout: 20000 });
  await context.route('**/*', route => new URL(route.request().url()).origin === ORIGIN ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' }); await gisDone;
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async (mutation) => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    const P = (name, extra = {}) => ({ name, archived: false, stage: 2, received: 0, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, geo: null, ...extra });
    state.projects = [
      P('가상금성아파트 1동 907호'),
      P('가상금성아파트 1동 1502호'),
      P('가상선비마을3단지 315동 1401호'),        // '3단지'의 3과 '315동'을 섞으면 안 된다
      P('가상망원동 카페'),                        // 아파트 아님 → 목록·등록 모두 제외
      P('가상보관아파트 5동 501호', { archived: true }),   // 보관 → 제외
      P('가상기존아파트 7동 701호', { aptUnits: [{ id: 'unit-known', type: 'unit', dong: '7', ho: '701', name: '', note: '' }] }),
      P('가상동명아파트 2동 202호'), P('가상동명아파트 2동 202호'),   // 동명 2개 → 손대지 않는다
    ];
    state.files = [
      { id: 'ph-1', name: '가상_907.png', kind: 'photo', ext: 'png', size: 11, project: '가상금성아파트 1동 907호', _virtual: true, _worklabel: '기존 작업' },
      { id: 'ph-2', name: '가상_1502.png', kind: 'photo', ext: 'png', size: 12, project: '가상금성아파트 1동 1502호', _virtual: true },
      { id: 'ph-3', name: '가상_기존.png', kind: 'photo', ext: 'png', size: 13, project: '가상기존아파트 7동 701호', _virtual: true,
        _aptUnit: { project: '가상기존아파트 7동 701호', unitId: 'unit-known' } },
    ];
    state.aptOffices = [{ id: 'off-virtual', complex: '가상금성아파트', manager: '가상 소장' }];
    state.aptOrders = [{ id: 'ord-virtual', officeId: 'off-virtual', unit: '1동 907호', text: '가상 실리콘', status: 'recv', date: '2026-09-15' }];
    state.payLog = []; state.activeProject = null; state.tab = 'dashboard'; state.search = '';
    state._demo = false; state.dirty = false; state.dirHandle = null;
    __tabStale = false; __photoCache.key = null; __sel.clear();
    relayReady = () => false; __gdToken = null;
    window.__aptNetwork = []; window.__aptSnapshots = [];
    relayCall = async (...a) => { window.__aptNetwork.push(['relay', a[0]]); throw new Error('unexpected relay request'); };
    gdUploadBlob = async () => { window.__aptNetwork.push(['upload']); throw new Error('unexpected upload'); };
    const nativeSnapshot = hjSnapshot;
    hjSnapshot = function(label) { window.__aptSnapshots.push(label); return nativeSnapshot.apply(this, arguments); };
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw new Error('virtual fixture baseline failed to persist');
    await __appStateWriteQueue;
    window.__aptBaseline = JSON.stringify({ projects: state.projects.map(p => p.name), files: state.files.map(f => f.name) });

    // ── 변이 주입 (페이지에서만) ──
    if (mutation === 'parse') {                       // 아파트가 아닌 이름도 아파트로 읽는다
      aptNameParse = (name) => ({ complex: String(name || ''), dong: '1', ho: '1' });
    }
    if (mutation === 'dupe') {                        // 이미 등록된 동·호수를 걸러내지 않는다
      const native = aptBulkPlan;
      aptBulkPlan = function() {
        const dupes = aptDupeNames();
        return (state.projects || []).filter(p => p && p.name && !p.archived && dupes.get(p.name) === 1 && aptNameParse(p.name))
          .map(p => { const x = aptNameParse(p.name); return { project: p.name, complex: x.complex, dong: x.dong, ho: x.ho }; });
      };
      void native;
    }
    if (mutation === 'preview') {                     // 미리보기 없이 바로 등록한다
      aptBulkView = () => aptBulkApply(aptBulkPlan()).then(() => render());
    }
  }, MUTATION);
  monitorNetwork = true;
  return { context, page, errors, unexpectedRequests, width };
}

// 이 화면이 절대 건드리면 안 되는 것들
async function invariant(test) {
  const f = await test.page.evaluate(() => ({
    baseline: window.__aptBaseline,
    now: JSON.stringify({ projects: state.projects.map(p => p.name), files: state.files.map(f => f.name) }),
    photoLinks: state.files.map(f => [f.id, f._aptUnit ? f._aptUnit.project + '/' + f._aptUnit.unitId : null]),
    workLabel: (state.files.find(f => f.id === 'ph-1') || {})._worklabel,
    orders: state.aptOrders.length, offices: state.aptOffices.length, pay: state.payLog.length,
    network: window.__aptNetwork,
    dupeUnits: state.projects.filter(p => p.name === '가상동명아파트 2동 202호').map(p => (p.aptUnits || []).length),
  }));
  assert.equal(f.now, f.baseline, '현장명·파일명은 절대 바뀌지 않는다');
  assert.deepEqual(f.photoLinks, [['ph-1', null], ['ph-2', null], ['ph-3', '가상기존아파트 7동 701호/unit-known']],
    '사진의 동·호수 연결은 이 화면이 바꾸지 않는다');
  assert.equal(f.workLabel, '기존 작업', '작업명 보존');
  assert.deepEqual([f.orders, f.offices, f.pay], [1, 1, 0], '오더·단지·수금 장부를 만들지 않는다');
  assert.deepEqual(f.network, [], '아파트 관리는 로컬 작업 — 바깥으로 보내지 않는다');
  assert.deepEqual(test.unexpectedRequests, [], '외부 요청 없음');
  assert.deepEqual(f.dupeUnits, [0, 0], '동명 현장 2개는 손대지 않는다');
}

async function scenario(name, fn, width = 1200) {
  const test = await boot(width);
  try { await fn(test); assert.deepEqual(test.errors, [], 'pageerror 0'); passed++; console.log('PASS ' + width + 'px ' + name); }
  finally { await test.context.close(); }
}
const units = (page) => page.evaluate(() => state.projects.map(p => [p.name, (p.aptUnits || []).length]));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  await scenario('상단 탭을 실제로 눌러 열린다 · 단지별로 묶인다 · 비아파트/보관은 빠진다', async ({ page }) => {
    const tab = page.locator('.tab[data-tab="aptmgmt"]');
    await tab.waitFor({ state: 'visible' });
    assert.match(await tab.innerText(), /아파트 관리/);
    // 위임이 아니라 정적 탭 배선이지만, 클릭이 실제로 화면을 바꾸는지가 핵심이다
    await tab.click();
    await page.waitForFunction(() => state.tab === 'aptmgmt');
    await page.locator('#view [data-aptbulk]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.tab[data-tab="aptmgmt"]').getAttribute('aria-selected'), 'true');

    const heads = await page.locator('#view .cust-card .cust-h').allInnerTexts();
    const names = heads.map(h => h.split('\n')[0].trim());
    // 현장 많은 순 → 같으면 가나다순. 동명 현장도 목록에는 보인다(등록만 건너뛴다) — 안 보이면 사장님이 중복을 못 고친다.
    assert.deepEqual(names, ['가상금성아파트', '가상동명아파트', '가상기존아파트', '가상선비마을3단지'], '같은 단지는 한 묶음, 현장 많은 순');
    const body = await page.locator('#view').innerText();
    assert.doesNotMatch(body, /가상망원동/, '아파트가 아닌 현장은 이 화면에 없다');
    assert.doesNotMatch(body, /가상보관아파트/, '보관한 현장은 이 화면에 없다');
    assert.match(heads[0], /2곳/, '금성아파트 아래 두 세대');
    assert.match(body, /관리사무소 등록됨/, '같은 이름의 단지가 있으면 관리사무소를 이어 보여준다');
    assert.match(body, /오더 1건/);
  });

  await scenario('일괄 등록은 미리보기를 거친다 · 취소하면 자료가 그대로다', async (test) => {
    const { page } = test;
    await page.locator('.tab[data-tab="aptmgmt"]').click();
    await page.locator('#view [data-aptbulk]').waitFor({ state: 'visible' });
    const before = await units(page);
    assert.deepEqual(before.map(u => u[1]), [0, 0, 0, 0, 0, 1, 0, 0], '누르기 전에는 아무것도 등록돼 있지 않다');

    await page.locator('#view [data-aptbulk]').click();
    await page.locator('#aptBulkPanel').waitFor({ state: 'visible' });
    assert.match(await page.locator('#aptBulkPanel').innerText(), /3곳을 등록합니다/, '동명·보관·비아파트·기등록을 뺀 3곳만');
    assert.deepEqual(await units(page), before, '미리보기를 여는 것만으로는 아무것도 바뀌지 않는다');

    await page.locator('#aptBulkCancel').click();
    await page.waitForFunction(() => !document.querySelector('#aptBulkPanel'));
    assert.deepEqual(await units(page), before, '취소하면 그대로다');
    assert.deepEqual(await page.evaluate(() => window.__aptSnapshots), [], '취소했으면 안전판도 만들지 않는다');
    await invariant(test);
  });

  await scenario('등록하면 이름에서 읽은 동·호수만 들어간다 · 두 번 눌러도 중복이 없다', async (test) => {
    const { page } = test;
    await page.locator('.tab[data-tab="aptmgmt"]').click();
    await page.locator('#view [data-aptbulk]').click();
    await page.locator('#aptBulkSave').click();
    await page.waitForFunction(() => !document.querySelector('#aptBulkPanel'));

    assert.deepEqual(await units(page), [
      ['가상금성아파트 1동 907호', 1], ['가상금성아파트 1동 1502호', 1], ['가상선비마을3단지 315동 1401호', 1],
      ['가상망원동 카페', 0], ['가상보관아파트 5동 501호', 0], ['가상기존아파트 7동 701호', 1],
      ['가상동명아파트 2동 202호', 0], ['가상동명아파트 2동 202호', 0],
    ], '해당 현장에만 한 곳씩');
    assert.deepEqual(await page.evaluate(() => {
      const p = state.projects.find(p => p.name === '가상선비마을3단지 315동 1401호');
      return [p.aptUnits[0].dong, p.aptUnits[0].ho, p.aptUnits[0].type];
    }), ['315', '1401', 'unit'], "'3단지'의 3이 아니라 315동으로 읽는다");

    assert.equal(await page.evaluate(() => aptBulkPlan().length), 0, '다 끝났으면 대기 0곳');
    assert(await page.evaluate(() => window.__aptSnapshots.includes('동·호수 일괄 등록 전')), '등록 직전 안전판이 남는다');

    // 다시 눌러도 중복이 생기지 않아야 한다 (버튼은 비활성이지만 오래된 화면의 클릭도 막혀야 한다)
    await page.evaluate(() => aptBulkView());
    await page.waitForFunction(() => !document.querySelector('#aptBulkPanel'));
    assert.deepEqual((await units(page)).map(u => u[1]), [1, 1, 1, 0, 0, 1, 0, 0], '두 번째 실행은 아무것도 더하지 않는다');

    // 저장된 자료에도 그대로 실렸는가 (새로고침 왕복)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone);
    await page.evaluate(() => window.__hjRestoreDone);
    assert.deepEqual(await page.evaluate(() => {
      const p = state.projects.find(p => p.name === '가상금성아파트 1동 907호');
      return [(p.aptUnits || []).length, (p.aptUnits || [])[0] && p.aptUnits[0].dong + '동' + p.aptUnits[0].ho + '호'];
    }), [1, '1동907호'], '새로고침해도 남아 있다');
  });

  await scenario('단지 안의 현장을 눌러 그 현장으로 간다 · 오더 보기가 열린다', async (test) => {
    const { page } = test;
    await page.locator('.tab[data-tab="aptmgmt"]').click();
    await page.locator('#view [data-aptorders]').first().click();
    await page.locator('#modalRoot .modal').waitFor({ state: 'visible' });
    await page.evaluate(() => closeModal());

    await page.locator('.tab[data-tab="aptmgmt"]').click();
    const go = page.locator('#view [data-aptgo]').first();
    const label = (await go.innerText()).trim();
    await go.click();
    await page.waitForFunction(() => state.tab === 'project');
    assert.match(await page.evaluate(() => state.activeProject), /가상금성아파트/, '누른 현장이 열린다');
    assert.match(label, /^\d+동 \d+호$/, '단지 안에서는 동·호수만 보여준다');
    await invariant(test);
  });

  await scenario('폰: 상단 탭이 숨겨져도 더보기로 들어갈 수 있다', async ({ page }) => {
    assert(await page.locator('.tab[data-tab="aptmgmt"]').isHidden(), '폰에서 상단 탭은 숨는다');
    assert(await page.evaluate(() => MORE_NAV_SHORTCUTS.some(s => s.tab === 'aptmgmt')), '더보기에 아파트 관리가 있어야 폰에서 닿는다');
    await page.evaluate(() => { state.tab = 'aptmgmt'; render(); syncMobileNav(); });
    await page.locator('#view [data-aptbulk]').waitFor({ state: 'visible' });
    const nodes = await page.locator('#view button:visible').evaluateAll(els => els.map(el => {
      const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 12), w: r.width, h: r.height };
    }));
    assert.deepEqual(nodes.filter(n => n.h < 44), [], '폰에서 누르는 버튼은 44px 이상');
    assert(await page.locator('#view').evaluate(el => el.scrollWidth <= el.clientWidth + 1), '가로로 넘치지 않는다');
  }, 390);

  console.log('\n== apartment-manage: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => { console.error('FAIL apartment-manage', error && error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

/* apt-unit-assign.e2e.js — 동·호수 사진 배정이 '저장은 됐는데 화면 갱신 실패' 로 끝나던 사고의 회귀
   (2026-09-17 대표님 화면: 'paid exact round-trip conflict' + 빨간 배너).
   원인: 초안(draft)의 사진 항목에 aptUnit 키를 처음 붙이면 맨 뒤에 덧붙는데, 복원 뒤 재직렬화는 고정 순서라
   같은 자료가 다른 JSON 문자열이 됐다. 카톡으로 들어온 사진은 sourceModifiedAt 이 있어 전부 걸렸다.
   여기서는 (1) sourceModifiedAt·sourceSha256·mediaOriginal 이 있는 사진을 실제 유상 경로(aptUnitAssign)로 배정·해제해
   성공하는지, (2) 미배정 목록 [전체 선택] 이 있고 직접 배선되어 한 번에 켜고 끄는지, (3) 그 흐름으로 저장까지 되는지 본다.
   전제: tests/static-server.js(8299). serviceWorkers:'block'. 자료는 전부 자기서술형 가짜값. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  const A = '가상 삼성아파트';
  // 카톡으로 들어온 사진처럼: sourceModifiedAt·sha256·mediaOriginal 이 있고 aptUnit 은 아직 없다
  const seed = () => page.evaluate(async ({ A, PNG }) => {
    try { closeModal(true); } catch (e) {}
    state.projects = [{ name: A, stage: 1, received: 0, archived: false, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {},
      aptUnits: [{ id: 'u1', type: 'unit', dong: '21', ho: '1203', name: '', note: '' }, { id: 'u2', type: 'unit', dong: '21', ho: '1204', name: '', note: '' }] }];
    state.files = [1, 2, 3, 4, 5, 6, 7].map(i => ({ id: 'kk' + i, name: 'KakaoTalk_20260915_165340974_0' + i + '.jpg', prefix: '', kind: 'photo', ext: 'jpg', size: 100000 + i, project: A,
      when: new Date('2026-09-15T07:53:4' + i + '.000Z'), place: null, address: null, thumb: 'data:image/png;base64,' + PNG, text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null,
      _phase: null, _worklabel: null, _gdFolder: null, _driveId: null, _driveMimeType: null, _driveSize: 0, _relayLink: null, _file: null, _heicFile: null, _needHeic: false, _virtual: true,
      _originalSha256: 'a'.repeat(64), _mediaOriginal: { name: 'k' + i + '.jpg', size: 100000 + i, sha256: 'a'.repeat(64) }, sourceModifiedAt: '2026-09-15T07:53:4' + i + '.000Z',
      ...(i === 7 ? { _aptUnit: { project: A, unitId: 'u2' } } : {}) }));
    state.quotes = []; state.activeProject = A; state.dirty = false; __tabStale = false;
    render(); clearTimeout(__idbSaveTimer); if (!await guardedPersistCurrentState()) throw new Error('fixture persistence failed'); await __appStateWriteQueue;
    try { document.getElementById('hjPaidCommitRecovery')?.remove(); } catch (e) {}
  }, { A, PNG });

  await test('sourceModifiedAt 이 있는 카톡 사진을 실제 유상 경로로 배정·해제해도 왕복 정확일치가 깨지지 않는다', async () => {
    await seed();
    const r = await page.evaluate(async A => {
      const out = {};
      out.n = await aptUnitAssign(A, 'u1', ['kk1', 'kk2', 'kk3']);
      out.links = state.files.filter(f => f._aptUnit && f._aptUnit.unitId === 'u1').map(f => f.id);
      out.stale = !!__tabStale; out.banner = !!document.getElementById('hjPaidCommitRecovery');
      // 해제(null) 와 다른 세대로 옮기기도 같은 길
      out.n2 = await aptUnitAssign(A, '', ['kk1']);
      out.n3 = await aptUnitAssign(A, 'u2', ['kk2']);
      out.after = state.files.filter(f => ['kk1', 'kk2', 'kk3'].includes(f.id)).map(f => [f.id, f._aptUnit ? f._aptUnit.unitId : null]);
      // 저장본(IDB)에도 그대로
      const stored = await idbGet('appState');
      out.stored = (stored.files || []).filter(f => /_0[123]\.jpg$/.test(f.name)).map(f => [f.name.slice(-6, -4), f.aptUnit ? f.aptUnit.unitId : null]);
      out.kept = state.files.find(f => f.id === 'kk2').sourceModifiedAt;
      return out;
    }, A);
    assert(r.n === 3 && eq(r.links, ['kk1', 'kk2', 'kk3']), '배정 3장: ' + JSON.stringify(r));
    assert(!r.stale && !r.banner, "저장은 됐는데 '화면 갱신 실패' 배너/stale 이 떴다(정확일치 검사가 키 순서에 걸린 것)");
    assert(r.n2 === 1 && r.n3 === 1 && eq(r.after, [['kk1', null], ['kk2', 'u2'], ['kk3', 'u1']]), '해제·이동: ' + JSON.stringify(r.after));
    assert(eq(r.stored, [['01', null], ['02', 'u2'], ['03', 'u1']]), 'IDB 저장본: ' + JSON.stringify(r.stored));
    assert(r.kept === '2026-09-15T07:53:42.000Z', '배정이 sourceModifiedAt 을 건드리면 안 된다: ' + r.kept);
  });

  await test('미배정 목록 [전체 선택] — 직접 배선되어 한 번에 켜고 끄며, 문구가 상태를 따라간다', async () => {
    await seed();
    await page.evaluate(A => aptUnitView(A, ''), A);
    let r = await page.evaluate(() => { const b = document.getElementById('aptUnitSelectAll'); return { has: !!b, wired: !!b && typeof b.onclick === 'function', txt: b && b.textContent,
      boxes: document.querySelectorAll('#modalRoot .apt-unit-photo-check').length, checked: document.querySelectorAll('#modalRoot .apt-unit-photo-check:checked').length }; });
    assert(r.has && r.wired, '[전체 선택] 버튼이 모달에 직접 배선되어야 한다(모달은 #view 위임 밖): ' + JSON.stringify(r));
    assert(r.boxes === 6 && r.checked === 0 && r.txt.includes('전체 선택') && r.txt.includes('6장'), '미배정 6장, 처음엔 아무것도 안 켜짐: ' + JSON.stringify(r));
    await page.evaluate(() => document.getElementById('aptUnitSelectAll').click());
    r = await page.evaluate(() => ({ checked: document.querySelectorAll('#modalRoot .apt-unit-photo-check:checked').length, txt: document.getElementById('aptUnitSelectAll').textContent }));
    assert(r.checked === 6 && r.txt.includes('전체 해제'), '한 번 누르면 전부 켜지고 문구는 해제로: ' + JSON.stringify(r));
    await page.evaluate(() => document.getElementById('aptUnitSelectAll').click());
    r = await page.evaluate(() => ({ checked: document.querySelectorAll('#modalRoot .apt-unit-photo-check:checked').length, txt: document.getElementById('aptUnitSelectAll').textContent }));
    assert(r.checked === 0 && r.txt.includes('전체 선택'), '다시 누르면 전부 꺼진다: ' + JSON.stringify(r));
    // 사진이 없는 세대 화면에는 버튼이 없다
    await page.evaluate(A => aptUnitView(A, 'u1'), A);
    assert(!(await page.evaluate(() => !!document.getElementById('aptUnitSelectAll'))), '목록이 비면 버튼도 없어야 한다');
  });

  await test('[전체 선택] → 세대 고르기 → [선택 사진 배정 저장] 이 화면에서 끝까지 된다(오류 문구·배너 없음)', async () => {
    await seed();
    await page.evaluate(A => aptUnitView(A, ''), A);
    await page.evaluate(() => { document.getElementById('aptUnitSelectAll').click(); document.getElementById('aptUnitAssignTarget').value = 'u1'; document.getElementById('aptUnitAssignSave').click(); });
    await page.waitForFunction(() => state.files.filter(f => f._aptUnit && f._aptUnit.unitId === 'u1').length === 6, null, { timeout: 10000 });
    const r = await page.evaluate(() => ({ issue: (document.getElementById('aptUnitIssue') || {}).textContent || '', banner: !!document.getElementById('hjPaidCommitRecovery'), stale: !!__tabStale,
      left: state.files.filter(f => !f._aptUnit).length, title: (document.querySelector('#aptUnitPanel h3') || {}).textContent || '' }));
    assert(!r.issue && !r.banner && !r.stale, '오류 문구/배너 없이 저장되어야 한다: ' + JSON.stringify(r));
    assert(r.left === 0, '미배정이 0장이어야 한다: ' + r.left);
    assert(r.title.includes('21동 1203호') && r.title.includes('6장'), '저장 뒤 그 세대 화면으로 넘어가 6장이 보여야 한다: ' + r.title);
  });

  await test('작업명 일괄 입력 — 고른 사진에 한 번에 들어가고, 선택·배정 칸은 그대로 남는다', async () => {
    await seed();
    await page.evaluate(A => aptUnitView(A, ''), A);
    let r = await page.evaluate(() => { const b = document.getElementById('aptUnitWorkSave'), i = document.getElementById('aptUnitWork');
      return { btn: !!b, wired: !!b && typeof b.onclick === 'function', input: !!i, list: !!document.getElementById('aptUnitWorkList') }; });
    assert(r.btn && r.wired && r.input && r.list, '작업명 칸·버튼이 직접 배선되어야 한다(모달은 #view 위임 밖): ' + JSON.stringify(r));
    // 아무것도 안 고르고 누르면 안내만 하고 아무것도 안 바뀐다
    await page.evaluate(() => { document.getElementById('aptUnitWork').value = 'TEST 화장실 방수'; document.getElementById('aptUnitWorkSave').click(); });
    r = await page.evaluate(() => ({ issue: document.getElementById('aptUnitIssue').textContent, labels: state.files.filter(f => f._worklabel).length }));
    assert(/고르세요/.test(r.issue) && r.labels === 0, '선택 없이 저장되면 안 된다: ' + JSON.stringify(r));
    // 전체 선택 → 배정 칸을 21동 1204호로 바꿔 두고 → 작업명 넣기
    await page.evaluate(() => { document.getElementById('aptUnitSelectAll').click(); document.getElementById('aptUnitAssignTarget').value = 'u2'; document.getElementById('aptUnitWorkSave').click(); });
    r = await page.evaluate(() => ({ labeled: state.files.filter(f => f._worklabel === 'TEST 화장실 방수').map(f => f.id).sort(),
      untouched: state.files.find(f => f.id === 'kk7')._worklabel || null, links: state.files.filter(f => f._aptUnit).map(f => f.id),
      checked: document.querySelectorAll('#modalRoot .apt-unit-photo-check:checked').length, target: document.getElementById('aptUnitAssignTarget').value,
      shownLabel: (document.querySelector('#modalRoot .apt-unit-row small') || {}).textContent, dirty: state.dirty, issue: document.getElementById('aptUnitIssue').textContent }));
    assert(eq(r.labeled, ['kk1', 'kk2', 'kk3', 'kk4', 'kk5', 'kk6']), '미배정 6장에 작업명: ' + JSON.stringify(r.labeled));
    assert(r.untouched === null, '목록에 없던 kk7(다른 세대)은 건드리면 안 된다');
    assert(eq(r.links, ['kk7']), '작업명 저장이 동·호수 연결을 바꾸면 안 된다: ' + JSON.stringify(r.links));
    assert(r.checked === 6 && r.target === 'u2', '선택과 배정 칸이 그대로 남아야 이어서 배정할 수 있다: ' + JSON.stringify(r));
    assert(/TEST 화장실 방수/.test(r.shownLabel || ''), "목록이 새 작업명으로 다시 그려져야 한다: " + r.shownLabel);
    assert(r.dirty === true, '작업명을 바꿨으면 저장 대상이어야 한다');
    // 직렬화 왕복
    const rt = await page.evaluate(() => JSON.parse(JSON.stringify(serializeData())).files.filter(f => f.worklabel === 'TEST 화장실 방수').length);
    assert(rt === 6, '직렬화에 작업명이 남아야 백업에 실린다: ' + rt);
  });

  await test('작업명 제안 목록은 이 현장에서 쓴 것만 · 빈 칸은 확인을 거쳐야 지운다', async () => {
    await seed();
    await page.evaluate(A => { state.files.find(f => f.id === 'kk1')._worklabel = 'TEST 지난 작업';
      state.files.push({ id: 'other', name: '가상_other.jpg', kind: 'photo', ext: 'jpg', prefix: '', size: 1, project: '가상 다른현장', when: new Date('2026-09-01'), _worklabel: 'TEST 남의 현장 작업' });
      aptUnitView(A, ''); }, A);
    let r = await page.evaluate(() => [...document.querySelectorAll('#aptUnitWorkList option')].map(o => o.value));
    assert(eq(r, ['TEST 지난 작업']), '제안은 이 현장에서 쓴 작업명만: ' + JSON.stringify(r));
    // 빈 칸 + 취소 → 그대로
    await page.evaluate(() => { window.confirm = () => false; document.getElementById('aptUnitSelectAll').click(); document.getElementById('aptUnitWork').value = '   '; document.getElementById('aptUnitWorkSave').click(); });
    assert((await page.evaluate(() => state.files.find(f => f.id === 'kk1')._worklabel)) === 'TEST 지난 작업', '취소했는데 작업명을 지웠다');
    // 빈 칸 + 확인 → 지운다
    await page.evaluate(() => { window.confirm = () => true; document.getElementById('aptUnitWorkSave').click(); });
    r = await page.evaluate(() => ({ left: state.files.filter(f => f.project === '가상 삼성아파트' && f._worklabel).length, other: state.files.find(f => f.id === 'other')._worklabel }));
    assert(r.left === 0 && r.other === 'TEST 남의 현장 작업', '확인하면 고른 것만 지운다: ' + JSON.stringify(r));
  });

  await test('[전체 선택] 문구가 실제 체크 상태를 따라간다 — 작업명 넣은 뒤에도, 손으로 다 켰을 때도', async () => {
    await seed();
    await page.evaluate(A => aptUnitView(A, ''), A);
    const st = () => page.evaluate(() => ({ checked: document.querySelectorAll('#modalRoot .apt-unit-photo-check:checked').length,
      txt: document.getElementById('aptUnitSelectAll').textContent }));
    await page.evaluate(() => document.getElementById('aptUnitSelectAll').click());
    let r = await st(); assert(r.checked === 6 && /전체 해제/.test(r.txt), '전부 켜면 문구는 해제: ' + JSON.stringify(r));
    // v315 사고: 작업명을 넣으면 목록이 다시 그려지면서 문구만 '전체 선택' 으로 되돌아갔다.
    // 그 문구를 믿고 누르면 전부 꺼지고, 이어 누른 [배정 저장] 이 0장으로 끝났다.
    await page.evaluate(() => { document.getElementById('aptUnitWork').value = 'TEST 방수'; document.getElementById('aptUnitWorkSave').click(); });
    r = await st(); assert(r.checked === 6 && /전체 해제/.test(r.txt), '작업명 넣은 뒤에도 문구가 실제와 같아야 한다: ' + JSON.stringify(r));
    // v312 부터 있던 경로: 손으로 전부 켜도 문구는 '전체 선택' 이라, 누르면 켜지는 줄 알았는데 전부 꺼졌다
    await page.evaluate(() => { document.getElementById('aptUnitSelectAll').click(); document.querySelectorAll('#modalRoot .apt-unit-photo-check').forEach(x => { x.checked = true; x.dispatchEvent(new Event('change', { bubbles: true })); }); });
    r = await st(); assert(r.checked === 6 && /전체 해제/.test(r.txt), '손으로 전부 켜도 문구가 따라와야 한다: ' + JSON.stringify(r));
    await page.evaluate(() => document.getElementById('aptUnitSelectAll').click());
    r = await st(); assert(r.checked === 0 && /전체 선택/.test(r.txt), '그 상태에서 누르면 꺼지고 문구도 따라온다: ' + JSON.stringify(r));
  });

  await test('작업명 넣기는 목록을 다시 그리지 않는다 — 동·호수 찾기 필터·스크롤이 살아 있고 제안 목록만 늘어난다', async () => {
    await seed();
    await page.evaluate(A => aptUnitView(A, ''), A);
    await page.evaluate(() => { document.getElementById('aptUnitSearch').value = '21'; document.getElementById('aptUnitSearch').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('aptUnitSelectAll').click(); document.getElementById('aptUnitWork').value = 'TEST 새 작업'; document.getElementById('aptUnitWorkSave').click(); });
    const r = await page.evaluate(() => ({ search: document.getElementById('aptUnitSearch').value,
      hidden: [...document.querySelectorAll('#modalRoot [data-unit-label]')].filter(b => b.hidden).length,
      labels: [...document.querySelectorAll('#modalRoot [data-wl]')].map(e => e.textContent),
      opts: [...document.querySelectorAll('#aptUnitWorkList option')].map(o => o.value), input: document.getElementById('aptUnitWork').value }));
    assert(r.search === '21', '검색어가 지워지면 안 된다: ' + r.search);
    assert(r.labels.length === 6 && r.labels.every(t => t === 'TEST 새 작업'), '작업명 글자가 제자리에서 바뀌어야 한다: ' + JSON.stringify(r.labels));
    assert(r.opts.includes('TEST 새 작업'), '방금 쓴 작업명이 제안 목록에 들어가야 한다: ' + JSON.stringify(r.opts));
    assert(r.input === 'TEST 새 작업', '입력칸 값이 남아야 이어서 쓸 수 있다');
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length, failed = results.filter(r => !r.ok);
  console.log('\n== apt-unit-assign: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

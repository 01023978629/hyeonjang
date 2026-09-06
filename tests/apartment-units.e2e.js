/* v266: 프로젝트는 아파트명 그대로, 동/호·공용부와 사진 연결은 명시 선택으로만.
   새 로컬 컨텍스트와 가상 PNG/아파트만 사용한다. 저장은 실제 IndexedDB 경로를 검증한다.
   HJ_APARTMENT_UNITS_MUTATION=scope|serialize: 프로젝트 격리/직렬화 한 축을
   페이지에서만 깨뜨리면 같은 회귀가 실패해야 한다. 운영 소스/고객 자료는 건드리지 않는다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_APARTMENT_UNITS_MUTATION || '';
assert(['', 'scope', 'serialize'].includes(MUTATION), 'unknown HJ_APARTMENT_UNITS_MUTATION');
const A = '가상 가아파트', B = '가상 나아파트';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const XSS = '<img src=x onerror=window.__aptUnitXss=1>';
let browser, passed = 0;

async function boot(width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600,
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
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure(); coworkSchedEnsure(); aiOpsEnsureState().enabled = false;
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
  });
  await page.evaluate(async ({ a, b, png, mutation }) => {
    const project = (name, units) => ({ name, archived: false, stage: 1, received: 0, phases: [],
      cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, ...(units ? { aptUnits: units } : {}) });
    const unit = (id, dong, ho) => ({ id, type: 'unit', dong, ho, name: '', note: '' });
    state.projects = [project(a, [unit('unit-shared', '103', '1204'), unit('unit-other', '104', '1204'),
      { id: 'common-a', type: 'common', dong: '', ho: '', name: '지하실', note: '주철관 보수' }]),
      project(b, [unit('unit-shared', '103', '1204')]), project('기존 일반현장')];
    let sequence = 0;
    const photo = (id, projectName, unitId, extras = {}) => ({ id, name: '가상_' + id + '.png', prefix: '', kind: 'photo', ext: 'png',
      size: 100 + ++sequence, when: new Date('2026-09-07T01:00:00Z'), project: projectName, _virtual: true,
      thumb: 'data:image/png;base64,' + png, _worklabel: '기존 배관 작업', _phase: '시공 전',
      ...(unitId ? { _aptUnit: { project: projectName, unitId } } : {}), ...extras });
    state.files = [photo('a-own', a, 'unit-shared'), photo('a-other', a, 'unit-other'), photo('b-own', b, 'unit-shared'),
      photo('a-common', a, 'common-a'), photo('a-unassigned', a, '', { _driveId: 'FAKE-UNIT-DRIVE', _relayLink: 'relay:FAKE-UNIT-DRIVE' }),
      photo('a-stale', a, '', { _aptUnit: { project: b, unitId: 'unit-shared' } }),
      photo('a-unknown', a, 'missing-unit'), photo('unassigned-project', null, ''),
      { id: 'not-photo', name: '가상_견적서.pdf', kind: 'estimate', ext: 'pdf', project: a, _aptUnit: { project: a, unitId: 'unit-shared' }, size: 200 }];
    state.aptOrders = []; state.aptOffices = []; state.payLog = [];
    state.activeProject = a; state.tab = 'photos'; state.search = '';
    state._demo = false; state.dirty = false; state.dirHandle = null;
    __tabStale = false; __photoCache.key = null; __sel.clear(); __sel.add('a-own'); __selMode = true;
    relayReady = () => false; __gdToken = null;
    window.__aptUnitXss = 0; window.__unitMutationApplied = 0; window.__unitSnapshots = []; window.__unitNetwork = [];
    relayCall = async (...args) => { window.__unitNetwork.push(['relay', args[0]]); throw new Error('unexpected relay request'); };
    gdUploadBlob = async () => { window.__unitNetwork.push(['upload']); throw new Error('unexpected upload'); };
    const nativeSnapshot = hjSnapshot;
    hjSnapshot = function(label, force, allowEmpty) {
      window.__unitSnapshots.push({ label, force, allowEmpty }); return nativeSnapshot.apply(this, arguments);
    };
    render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
    if (!(await guardedPersistCurrentState())) throw new Error('virtual fixture baseline failed to persist');
    await __appStateWriteQueue;
    window.__unitFileNames = state.files.map(f => f.name);
    window.__unitProjectNames = state.projects.map(p => p.name);
    if (mutation === 'scope') {
      const nativeForPhoto = aptUnitForPhoto;
      aptUnitForPhoto = function(file, project) {
        if (file && file._aptUnit && project && (file.project !== project.name || file._aptUnit.project !== project.name)) {
          window.__unitMutationApplied++;
          return nativeForPhoto.call(this, { ...file, project: project.name, _aptUnit: { ...file._aptUnit, project: project.name } }, project);
        }
        return nativeForPhoto.apply(this, arguments);
      };
    }
    if (mutation === 'serialize') {
      const nativeSerialize = serializeData;
      serializeData = function() {
        const value = nativeSerialize.apply(this, arguments);
        if (window.__unitSerializeMutationEnabled) for (const file of value.files || []) if (file.aptUnit) { delete file.aptUnit; window.__unitMutationApplied++; }
        return value;
      };
    }
  }, { a: A, b: B, png: PNG, mutation: MUTATION });
  monitorNetwork = true;
  return { context, page, errors, unexpectedRequests, width };
}

async function invariant(test, names = true) {
  const facts = await test.page.evaluate(() => ({ projects: state.projects.map(p => p.name), files: state.files.map(f => f.name),
    originalProjects: window.__unitProjectNames, originalFiles: window.__unitFileNames,
    orders: state.aptOrders.length, offices: state.aptOffices.length, pay: state.payLog.length,
    network: window.__unitNetwork, xss: window.__aptUnitXss }));
  if (names) { assert.deepEqual(facts.projects, facts.originalProjects, 'project names are never auto-renamed/merged'); assert.deepEqual(facts.files, facts.originalFiles, 'photo names are never rewritten'); }
  assert.deepEqual([facts.orders, facts.offices, facts.pay], [0, 0, 0], 'unit management must not create 0-won orders, offices or payment records');
  assert.deepEqual(facts.network, []); assert.equal(facts.xss, 0);
  assert.deepEqual(test.unexpectedRequests, [], 'unit management is local and must not transmit data');
}
async function scenario(name, fn, width = 390) {
  const test = await boot(width);
  try { await fn(test); assert.deepEqual(test.errors, [], 'pageerror 0'); passed++; console.log('PASS ' + width + 'px ' + name); }
  finally {
    if (MUTATION) console.log('MUTATION ' + MUTATION + ' applied=' + await test.page.evaluate(() => window.__unitMutationApplied).catch(() => 0));
    await test.context.close();
  }
}
async function snapshot(page) {
  return page.evaluate(async () => ({ live: JSON.stringify({ projects: state.projects, files: state.files, orders: state.aptOrders, pay: state.payLog,
    selected: [...__sel], active: state.activeProject, search: state.search, dirty: state.dirty }), stored: JSON.stringify(await idbGet('appState')) }));
}
async function tryCall(page, name, ...args) {
  return page.evaluate(async ({ name, args }) => { try { return { value: await window[name](...args) }; } catch (error) { return { error: String(error.message || error) }; } }, { name, args });
}
async function controls(page) {
  const nodes = await page.locator('#modalRoot button:visible, #modalRoot input:not([type="checkbox"]):visible, #modalRoot select:visible, #modalRoot textarea:visible').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect(); return { id: el.id || el.className, w: r.width, h: r.height,
      label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length) || el.textContent };
  }));
  assert.deepEqual(nodes.filter(n => n.w < 44 || n.h < 44), [], 'unit modal controls must be at least 44px');
  assert.deepEqual(nodes.filter(n => !n.label), [], 'unit modal controls have accessible names');
  assert(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'unit modal does not overflow horizontally');
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await scenario('아파트+동호 ID 이중 격리·명시 연결만·미지정과 손상 데이터 fail closed', async test => {
    const actual = await test.page.evaluate(a => {
      const p = aptUnitProject(a), get = id => state.files.find(f => f.id === id);
      return { own: aptUnitPhotos(p, 'unit-shared').map(f => f.id), other: aptUnitPhotos(p, 'unit-other').map(f => f.id),
        common: aptUnitPhotos(p, 'common-a').map(f => f.id), unassigned: aptUnitPhotos(p, '').map(f => f.id).sort(),
        foreign: aptUnitForPhoto(get('b-own'), p), stale: aptUnitForPhoto(get('a-stale'), p), unknown: aptUnitForPhoto(get('a-unknown'), p),
        managed: [aptUnitManaged(p), aptUnitManaged(aptUnitProject('기존 일반현장'))] };
    }, A);
    assert.deepEqual(actual, { own: ['a-own'], other: ['a-other'], common: ['a-common'],
      unassigned: ['a-stale', 'a-unassigned', 'a-unknown'], foreign: null, stale: null, unknown: null, managed: [true, false] },
    'same unit ID/number in another apartment must not grant photo membership');
    const malformed = await test.page.evaluate(a => {
      const p = aptUnitProject(a), bad = { ...p, aptUnits: [p.aptUnits[0], { ...p.aptUnits[0] }] };
      const list = aptUnitList(bad), before = state.projects.slice(); state.projects.push({ ...p });
      const ambiguous = aptUnitProject(a); state.projects = before;
      return { duplicateIds: list.map(u => u.id), ambiguous, invalid: aptUnitList({ name: '가상', aptUnits: 'bad' }),
        managedInvalid: aptUnitManaged({ name: '가상', aptUnits: null }) };
    }, A);
    assert.deepEqual(malformed, { duplicateIds: [], ambiguous: null, invalid: [], managedInvalid: true }, 'duplicate IDs/names and malformed managed data do not silently choose an owner');
    await invariant(test);
  });
  await scenario('동·호 정규화/중복 차단·등록/수정 ID 유지·공용부·실제 저장', async test => {
    const { page } = test;
    const norm = await page.evaluate(() => aptUnitNormalize({ type: 'unit', dong: ' 0103동 ', ho: ' 01204호 ', name: '무시할 이름', note: '  배관 보수  ' }));
    assert.deepEqual(norm, { type: 'unit', dong: '103', ho: '1204', name: '', note: '배관 보수' });
    const beforeDuplicate = await snapshot(page);
    assert((await tryCall(page, 'aptUnitSave', A, norm)).error, 'normalized duplicate must be rejected');
    assert.deepEqual(await snapshot(page), beforeDuplicate, 'duplicate rejection changes neither live state nor saved appState');
    const add = await tryCall(page, 'aptUnitSave', A, { type: 'unit', dong: '105', ho: '501', note: '난방 작업' });
    assert(!add.error && typeof add.value === 'string' && add.value, 'save returns a durable unit ID');
    const id = add.value;
    await tryCall(page, 'aptUnitSave', A, { type: 'unit', dong: '105', ho: '502', note: '수전 위치 변경' }, id);
    const common = await tryCall(page, 'aptUnitSave', A, { type: 'common', name: '지하 주차장', note: '배수관 확인' });
    assert(!common.error && common.value);
    const result = await page.evaluate(async ({ a, id, common }) => {
      const p = aptUnitProject(a), stored = await idbGet('appState');
      return { unit: aptUnitList(p).find(u => u.id === id), common: aptUnitList(p).find(u => u.id === common),
        saved: stored.projects.find(p => p.name === a).aptUnits, names: state.projects.map(p => p.name), snapshots: window.__unitSnapshots };
    }, { a: A, id, common: common.value });
    assert.deepEqual(result.unit, { id, type: 'unit', dong: '105', ho: '502', name: '', note: '수전 위치 변경' });
    assert.deepEqual(result.common, { id: common.value, type: 'common', dong: '', ho: '', name: '지하 주차장', note: '배수관 확인' });
    assert(result.saved.some(u => u.id === id && u.ho === '502'), 'edited unit survives actual IndexedDB commit');
    assert(result.snapshots.filter(s => s.force && s.allowEmpty).length >= 3, 'successful changes request recovery snapshots');
    await invariant(test);
  });
  await scenario('사진 명시 배정·해제·다른 아파트/문서 거부·Drive/작업/공정 보존', async test => {
    const { page } = test;
    const before = await page.evaluate(() => { const f = state.files.find(f => f.id === 'a-unassigned'); return { id: f.id, thumb: f.thumb,
      saved: serializeData().files.find(s => s.name === f.name) }; });
    const assigned = await tryCall(page, 'aptUnitAssign', A, 'unit-shared', ['a-unassigned']);
    assert.deepEqual(assigned, { value: 1 });
    const after = await page.evaluate(() => { const f = state.files.find(f => f.name === '가상_a-unassigned.png'); return { id: f.id, thumb: f.thumb,
      saved: serializeData().files.find(s => s.name === f.name) }; });
    assert.deepEqual(after, { ...before, saved: { ...before.saved, aptUnit: { project: A, unitId: 'unit-shared' } } }, 'assignment only changes the explicit apartment-unit link, not saved photo metadata or its runtime identity');
    for (const ids of [['b-own'], ['not-photo'], ['does-not-exist'], ['a-own', 'b-own']]) {
      const previous = await snapshot(page);
      assert((await tryCall(page, 'aptUnitAssign', A, 'unit-shared', ids)).error, 'invalid/mixed selection rejected: ' + ids);
      assert.deepEqual(await snapshot(page), previous, 'invalid selection is atomic and must not partially assign');
    }
    await tryCall(page, 'aptUnitAssign', A, '', ['a-unassigned']);
    assert.equal(await page.evaluate(a => aptUnitForPhoto(state.files.find(f => f.id === 'a-unassigned'), aptUnitProject(a)), A), null);
    await invariant(test);
  });
  await scenario('사진 연결 직렬화·복원·재스캔 보존·새 동명 업로드는 연결 승계 금지', async test => {
    const { page } = test;
    const result = await page.evaluate(({ a, png }) => {
      window.__unitSerializeMutationEnabled = true;
      const saved = JSON.parse(JSON.stringify(serializeData()));
      const stored = saved.files.find(f => f.name === '가상_a-own.png');
      const projectUnits = projects => JSON.stringify(projects.map(p => ({ name: p.name, aptUnits: p.aptUnits })));
      const projects = projectUnits(saved.projects);
      state.files = []; state.projects = []; applyData(saved);
      const restored = state.files.find(f => f.name === '가상_a-own.png');
      backupUserEdits();
      const rescanned = { name: restored.name, prefix: restored.prefix || '', kind: 'photo', project: null };
      restoreUserEdits(rescanned);
      return { link: stored.aptUnit, restored: restored._aptUnit, rescanned: rescanned._aptUnit,
        projectsSame: projects === projectUnits(state.projects), label: aptUnitLabel(aptUnitList(aptUnitProject(a))[0]) };
    }, { a: A, png: PNG });
    assert.deepEqual(result.link, { project: A, unitId: 'unit-shared' }, 'serialized file.aptUnit must preserve its explicit apartment and stable unit ID');
    assert.deepEqual(result.restored, result.link); assert.deepEqual(result.rescanned, result.link);
    assert(result.projectsSame); assert.match(result.label, /103.*1204/);
    const fresh = await page.evaluate(async png => {
      const f = new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], '가상_a-own.png', { type: 'image/png' });
      const rec = await ingestFile(f, null, '', { restoreEdits: false });
      return { link: rec._aptUnit || null, project: rec.project };
    }, PNG);
    assert.equal(fresh.link, null, 'a newly selected same-name photo does not inherit a prior household');
    await invariant(test, false);
  });
  await scenario('안전 스냅샷/원자 저장 실패는 live/appState 모두 무변경', async test => {
    const { page } = test;
    await page.evaluate(() => { window.__savedUnitSnapshot = hjSnapshot; hjSnapshot = async () => false; });
    for (const [name, args] of [['aptUnitSave', [A, { type: 'unit', dong: '106', ho: '601' }]], ['aptUnitAssign', [A, 'unit-shared', ['a-unassigned']]]]) {
      const before = await snapshot(page); assert((await tryCall(page, name, ...args)).error, 'snapshot failure rejects ' + name);
      assert.deepEqual(await snapshot(page), before, 'snapshot failure cannot mutate or persist candidate data');
    }
    await page.evaluate(() => { hjSnapshot = window.__savedUnitSnapshot; paidCommitWriteAtomic = async () => { throw new DOMException('virtual disk full', 'QuotaExceededError'); }; });
    for (const [name, args] of [['aptUnitSave', [A, { type: 'unit', dong: '106', ho: '602' }]], ['aptUnitAssign', [A, 'unit-other', ['a-unassigned']]]]) {
      const before = await snapshot(page); assert((await tryCall(page, name, ...args)).error, 'atomic commit failure rejects ' + name);
      assert.deepEqual(await snapshot(page), before, 'commit failure keeps the last confirmed live/stored data');
    }
    await invariant(test);
  });
  await scenario('세대별 사진 추가·아파트 변경 시 세대 선택 초기화·실제 PNG 연결 저장', async test => {
    const { page } = test;
    await page.evaluate(a => aptUnitView(a, 'unit-shared'), A);
    const chooser = page.waitForEvent('filechooser'); await page.locator('#aptUnitUpload').click();
    const picker = await chooser;
    await picker.setFiles({ name: 'virtual-new-unit.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await page.locator('#photoIntakeProject').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#photoIntakeProject').inputValue(), '1');
    assert.equal(await page.locator('#photoIntakeUnit').inputValue(), 'unit-shared', 'entry from unit card preselects that unit');
    const before = await snapshot(page);
    await page.locator('#photoIntakeProject').selectOption('2');
    assert.equal(await page.locator('#photoIntakeUnit').inputValue(), '', 'changing apartment clears household even when both use the same unit ID');
    await page.locator('#photoIntakeUnit').selectOption('unit-shared');
    await page.locator('#photoIntakeProject').selectOption('3');
    assert.equal(await page.locator('#photoIntakeUnit').inputValue(), '');
    assert(await page.locator('#photoIntakeUnit').isDisabled(), 'legacy project without units does not inherit another apartment unit');
    await page.locator('#photoIntakeProject').selectOption('1');
    await page.locator('#photoIntakeUnit').selectOption('common-a');
    await page.locator('#photoIntakeWork').fill('지하실 주철관 보수');
    assert.deepEqual(await snapshot(page), before, 'changing pending upload inputs does not write existing data');
    await page.locator('#photoIntakeConfirm').click();
    await page.locator('#photoIntakeResult').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !__photoIntakeBusy);
    const added = await page.evaluate(async () => {
      const file = state.files.find(f => f.name === 'virtual-new-unit.png'), stored = await idbGet('appState');
      return { project: file.project, unit: file._aptUnit, work: file._worklabel,
        saved: stored.files.find(f => f.name === file.name).aptUnit };
    });
    assert.deepEqual(added, { project: A, unit: { project: A, unitId: 'common-a' }, work: '지하실 주철관 보수', saved: { project: A, unitId: 'common-a' } });
    assert.match(await page.locator('#photoIntakeResult').innerText(), /지하실/);
    await invariant(test, false);
  });
  await scenario('관리사무소 완료 사진도 아파트+세대+서버 안전 파일만 선택', async test => {
    const actual = await test.page.evaluate(({ a, b }) => {
      const p = aptUnitProject(a); p.officeIntakeProjectId = 'office-project-test001';
      aptUnitProject(b).officeIntakeProjectId = 'office-project-test002';
      state.files.filter(f => f.kind === 'photo').forEach(f => { f._driveId = 'FAKE-COMP-' + f.id; f._driveMimeType = 'image/jpeg'; f._driveSize = 123; });
      const own = state.files.find(f => f.id === 'a-own');
      state.files.push({ ...own, id: 'a-own-copy' }, { ...own, id: 'a-unsafe', _driveId: 'FAKE-UNSAFE', _driveMimeType: 'application/pdf' });
      const legacy = { ...own, id: 'legacy-same-unit', name: '가상_103동1204호_legacy.png', project: '기존 일반현장' };
      delete legacy._aptUnit; state.files.push(legacy);
      const order = { project: a, projectIdentity: p.officeIntakeProjectId, source: 'office-intake', unit: '103동 1204호', intakePhotoIds: [] };
      const before = JSON.stringify({ files: state.files, projects: state.projects });
      return { own: officeCompletionPhotoIds(order), other: officeCompletionPhotoIds({ ...order, unit: '104동 1204호' }),
        common: officeCompletionPhotoIds({ ...order, unit: '지하실' }), unknown: officeCompletionPhotoIds({ ...order, unit: '999동 999호' }),
        unrelatedIdentity: officeCompletionPhotoIds({ ...order, projectIdentity: 'office-project-test002' }),
        orphanPhotoList: aptPhotoList({ ...order, projectIdentity: 'office-project-test002' }).map(f => f.id),
        missingIdentityPhotos: aptPhotoList({ ...order, projectIdentity: '' }).map(f => f.id),
        intakeExcluded: officeCompletionPhotoIds({ ...order, intakePhotoIds: [own._driveId] }),
        unchanged: before === JSON.stringify({ files: state.files, projects: state.projects }) };
    }, { a: A, b: B });
    assert.deepEqual(actual, { own: ['FAKE-COMP-a-own'], other: ['FAKE-COMP-a-other'], common: ['FAKE-COMP-a-common'],
      unknown: [], unrelatedIdentity: [], orphanPhotoList: [], missingIdentityPhotos: [], intakeExcluded: [], unchanged: true }, 'completion manifest and orphaned intake lookup must not expose other apartments/households or fall back to global legacy filename matches');
    await invariant(test, false);
  });
  await scenario('사진 더보기의 기존 체크·배정 대상 유지·중복 없음·조회 무변경', async test => {
    const { page } = test;
    await page.evaluate(({ a, png }) => {
      for (let i = 0; i < 85; i++) state.files.push({ id: 'virtual-page-' + i, name: '가상_추가목록_' + i + '.png',
        kind: 'photo', ext: 'png', project: a, prefix: '', size: 300 + i, when: new Date(Date.UTC(2026, 8, 8, 1, i)),
        thumb: 'data:image/png;base64,' + png, _virtual: true });
      aptUnitView(a, '');
    }, { a: A, png: PNG });
    const before = await snapshot(page);
    assert.equal(await page.locator('.apt-unit-photo-check').count(), 80);
    const first = page.locator('.apt-unit-photo-check').first(), id = await first.getAttribute('value');
    await first.check(); await page.locator('#aptUnitAssignTarget').selectOption('unit-other');
    await page.locator('#aptUnitMore').click();
    assert.equal(await page.locator('.apt-unit-photo-check').count(), 88, 'all remaining unassigned photos appear once');
    assert(await page.locator('.apt-unit-photo-check[value="' + id + '"]').isChecked(), 'prior checked photo stays selected');
    assert.equal(await page.locator('#aptUnitAssignTarget').inputValue(), 'unit-other', 'more does not silently reset assignment target');
    const ids = await page.locator('.apt-unit-photo-check').evaluateAll(nodes => nodes.map(n => n.value));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(await page.locator('#aptUnitMore').count(), 0);
    assert.deepEqual(await snapshot(page), before, 'read-only pagination changes neither data, global selection nor stored state');
    await invariant(test, false);
  });
  for (const width of [390, 360]) await scenario('모바일 추가/취소/중복 클릭·사진 선택 배정·XSS·44px', async test => {
    const { page } = test;
    await page.evaluate(a => aptUnitView(a), A);
    await page.locator('#aptUnitAdd').waitFor({ state: 'visible' });
    const before = await snapshot(page);
    await page.locator('#aptUnitAdd').click(); await page.locator('#aptUnitType').waitFor({ state: 'visible' }); await controls(page);
    assert(await page.locator('#aptUnitNumbers').isVisible()); assert(await page.locator('#aptUnitName').isHidden());
    await page.locator('#aptUnitType').selectOption('common');
    assert(await page.locator('#aptUnitNumbers').isHidden()); assert(await page.locator('#aptUnitName').isVisible());
    await page.locator('#aptUnitCancel').click(); await page.locator('#aptUnitAdd').waitFor({ state: 'visible' });
    assert.deepEqual(await snapshot(page), before, 'cancel leaves data unchanged');
    await page.locator('#aptUnitAdd').click();
    await page.locator('#aptUnitType').selectOption('unit');
    await page.locator('#aptUnitDong').fill('109'); await page.locator('#aptUnitHo').fill('909'); await page.locator('#aptUnitNote').fill(XSS);
    await page.evaluate(() => { const b = document.getElementById('aptUnitSave'); b.click(); b.click(); });
    await page.waitForFunction(a => aptUnitList(aptUnitProject(a)).filter(u => u.dong === '109' && u.ho === '909').length === 1, A);
    await page.locator('#aptUnitAdd').waitFor({ state: 'visible' });
    const id = await page.evaluate(a => aptUnitList(aptUnitProject(a)).find(u => u.dong === '109' && u.ho === '909').id, A);
    assert.equal(await page.locator('#modalRoot img[src="x"], #modalRoot script').count(), 0, 'note is escaped');
    await page.evaluate(a => aptUnitView(a, ''), A);
    const checkbox = page.locator('.apt-unit-photo-check[value="a-unassigned"]');
    await checkbox.waitFor({ state: 'visible' }); await checkbox.check();
    await page.locator('#aptUnitAssignTarget').selectOption(id);
    await page.locator('#aptUnitAssignSave').click();
    await page.waitForFunction(({ a, id }) => { const f = state.files.find(f => f.id === 'a-unassigned'); return f && f._aptUnit && f._aptUnit.project === a && f._aptUnit.unitId === id; }, { a: A, id });
    await page.evaluate(({ a, id }) => aptUnitView(a, id), { a: A, id });
    await controls(page);
    if (process.env.HJ_APARTMENT_UNITS_SCREENSHOT_DIR) {
      await page.waitForFunction(() => { const toast = document.getElementById('toast'); return !toast || (!toast.classList.contains('show') && Number(getComputedStyle(toast).opacity) < 0.01); });
      await page.locator('#modalRoot .modal').screenshot({ path: path.join(process.env.HJ_APARTMENT_UNITS_SCREENSHOT_DIR, 'apartment-units-' + width + '.png') });
    }
    assert.equal(await page.evaluate(a => aptUnitList(aptUnitProject(a)).filter(u => u.dong === '109' && u.ho === '909').length, A), 1, 'double click never creates duplicate units');
    await invariant(test);
  }, width);
  console.log('\n== apartment-units: ' + passed + ' passed, pageerrors=0 ==');
})().catch(error => { console.error('FAIL apartment-units', error && error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

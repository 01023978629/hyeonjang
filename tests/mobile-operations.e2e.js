/* v290 first-screen operations, real UI with isolated synthetic data only.
   No real account, upload, photo, message or backend. Requires static-server:8299.
   HJ_MOBILE_OPERATIONS_MUTATION=project|summary|prepguard must fail assertions. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const MUTATION = process.env.HJ_MOBILE_OPERATIONS_MUTATION || '';
assert(['', 'project', 'summary', 'prepguard'].includes(MUTATION));
let source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
if (MUTATION === 'project') {
  assert(source.includes("state.activeProject=name;state.tab='project';__projView=null;"));
  source = source.replace("state.activeProject=name;state.tab='project';__projView=null;", "state.activeProject=null;state.tab='projects';__projView=null;");
}
if (MUTATION === 'summary') {
  assert(source.includes('const late=open.filter(n=>n.day&&n.day<today).length;'));
  source = source.replace('const late=open.filter(n=>n.day&&n.day<today).length;', 'const late=open.length;');
}
if (MUTATION === 'prepguard') {
  assert.equal(source.split('if(!stillCurrent())return;').length - 1, 2);
  source = source.replaceAll('if(!stillCurrent())return;', '');
}
let browser, passed = 0;
async function boot(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = [], external = [], effects = [];
  let observe = false;
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (observe && !r.url().startsWith(ORIGIN) && !/^(data:|blob:)/.test(r.url())) external.push(r.url()); });
  page.on('download', () => effects.push('download')); page.on('popup', () => effects.push('popup'));
  page.on('dialog', d => d.dismiss());
  const gis = page.waitForEvent('requestfailed', { predicate: r => r.url() === 'https://accounts.google.com/gsi/client', timeout: 25000 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (MUTATION && url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: source });
    return route.continue();
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' }); await gis;
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.waitForFunction(() => !!localStorage.getItem('hj_glance'));
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue; aiOpsEnsureState().enabled = false;
    const project = name => ({ name, stage: 2, received: 0, cost: {}, phases: [], archived: false });
    state.projects = Array.from({ length: 31 }, (_, i) => project('가상현장' + String(i + 1).padStart(2, '0')));
    state.projects.push({ ...project('가상보관현장'), archived: true });
    state.files = []; state.quotes = []; state.aptOrders = []; state.aptOffices = []; state.expenses = []; state.payLog = []; state.contacts = [];
    state.notes = [
      { id: 'late', todo: true, done: false, day: '2000-01-01', text: '지난날 미완료', project: '가상현장01' },
      { id: 'now', todo: true, done: false, day: localDate(), text: '오늘 미완료', project: '' },
      { id: 'old', todo: true, done: false, text: '날짜 없는 옛 할일', project: '' },
      { id: 'finished', todo: true, done: true, day: '2000-01-01', text: '완료건', project: '' },
      { id: 'memo', text: '일반 메모', day: '2000-01-01', done: false }
    ];
    state.schedule = [
      { id: 's1', date: localDate(), time: '09:00', title: '욕실 타일 시공', project: '가상현장01', prep: { '가상 자재': true, '옛 목록': true } },
      { id: 's2', date: localDate(), time: '10:00', title: '욕실 타일 시공', project: '가상현장02' },
      { id: 's3', date: localDate(), title: '백업', routine: true },
      { id: 's4', date: localDate(), title: '정해지지 않은 업무', project: '' }
    ];
    localStorage.setItem('hj_prep_sets', JSON.stringify({ '타일': ['가상 자재', '가상 공구'] }));
    state.activeProject = null; state.tab = 'dashboard'; state.search = ''; state.editingQuote = null;
    state.dirHandle = null; state._demo = false; __gdToken = null; __tabStale = false;
    __sel.clear(); __sel.add('fake-selected'); __mobileMode = true; applyMobileMode();
    relayReady = () => false;
    const reject = name => () => { throw new Error('Unexpected external operation: ' + name); };
    relayCall = reject('relay'); window.open = reject('popup'); window.showOpenFilePicker = reject('picker');
    if (navigator.share) navigator.share = reject('share');
    taxCalendarEnsure(); coworkSchedEnsure(); state.dirty = false; render(); clearTimeout(__idbSaveTimer);
    await guardedPersistCurrentState(); await __appStateWriteQueue;
    const dirty = markDirty; window.__opsDirty = 0;
    markDirty = function () { window.__opsDirty++; return dirty.apply(this, arguments); };
    window.__opsData = () => JSON.stringify({ projects: state.projects, files: state.files, notes: state.notes, schedule: state.schedule, inventory: state.inventory });
  });
  observe = true;
  return { context, page, errors, external, effects };
}
async function scenario(name, fn, width = 390) {
  if (process.env.HJ_MOBILE_OPERATIONS_ONLY && !name.includes(process.env.HJ_MOBILE_OPERATIONS_ONLY)) return;
  const t = await boot(width);
  try { await fn(t.page); assert.deepEqual(t.errors, []); assert.deepEqual(t.external, []); assert.deepEqual(t.effects, []); passed++; console.log('PASS ' + width + 'px ' + name); }
  finally { await t.context.close(); }
}
const historySettled = page => page.waitForFunction(() => !__mobileSheetHistoryRetire && !mobileSheetHistoryMarker());
async function searchProject(page, query) {
  await page.evaluate(() => hjGlobalSearch()); await page.locator('#gsInput').fill(query);
  await page.locator('button.gsItem[data-search-project]').first().waitFor({ state: 'visible' });
}
async function mobileFits(page, selector) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
  for (const button of await page.locator(selector).all()) {
    const box = await button.boundingBox(); assert(box && box.width >= 44 && box.height >= 44, '44px touch target');
  }
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  for (const width of [360, 390]) await scenario('첫 화면 미완료·밀림 정확성 / 키보드 현장 검색 이동', async page => {
    const before = await page.evaluate(() => __opsData());
    assert.match(await page.locator('#dashboardTodoSummary').innerText(), /미완료 3건 · 밀린 할일 1건/);
    assert(await page.locator('#dashboardTodo').evaluate(el => el.compareDocumentPosition(document.querySelector('.ai-dashrow')) & Node.DOCUMENT_POSITION_FOLLOWING));
    await page.evaluate(() => { state.activeProject = '가상현장02'; state.search = '이전검색'; __aptPhotoSearchQuery = '이전검색'; __projView = 2; __showDup = true; });
    await page.locator('#dashboardSearchOpen').click(); await page.locator('#gsInput').fill('가상현장31');
    const result = page.locator('button[data-search-project="가상현장31"]'); await result.waitFor(); await result.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('gsInput'));
    assert.deepEqual(await page.evaluate(() => [state.tab, state.activeProject, state.search, __projView, __aptPhotoSearchQuery, __showDup, [...__sel]]), ['project', '가상현장31', '', null, null, false, ['fake-selected']]);
    assert.equal(await page.evaluate(() => __opsData()), before, 'navigation writes no business data');
    assert.equal(await page.evaluate(() => __opsDirty), 0);
  }, width);
  await scenario('보관 현장 유지 / 삭제·동명이인·잠긴 창은 이동 차단 / HTML 안전', async page => {
    await searchProject(page, '가상보관현장'); await page.locator('[data-search-project="가상보관현장"]').click();
    assert.equal(await page.evaluate(() => state.projects.find(p => p.name === '가상보관현장').archived), true);
    await historySettled(page);
    await searchProject(page, '가상현장31');
    await page.evaluate(() => { state.projects = state.projects.filter(p => p.name !== '가상현장31'); });
    const before = await page.evaluate(() => __opsData());
    await page.locator('[data-search-project="가상현장31"]').click(); assert.equal(await page.locator('#gsInput').count(), 1);
    assert.equal(await page.evaluate(() => state.activeProject), '가상보관현장'); assert.equal(await page.evaluate(() => __opsData()), before);
    await page.evaluate(() => { state.projects.push({ ...state.projects[0] }); });
    await page.locator('#gsInput').fill('가상현장01'); await page.locator('[data-search-project="가상현장01"]').first().click();
    assert.equal(await page.locator('#gsInput').count(), 1);
    await page.locator('#gsInput').fill('가상현장02'); await page.locator('[data-search-project="가상현장02"]').waitFor();
    await page.evaluate(() => { __modalCloseLocked = true; }); await page.locator('[data-search-project="가상현장02"]').click();
    assert.equal(await page.locator('#gsInput').count(), 1); assert.equal(await page.evaluate(() => state.activeProject), '가상보관현장');
    await page.evaluate(() => { __modalCloseLocked = false; state.projects.push({ name: '<img src=x onerror=alert(1)>', stage: 0, cost: {}, phases: [] }); });
    await page.locator('#gsInput').fill('<img');
    await page.locator('[data-search-project]').filter({ hasText: '<img src=x onerror=alert(1)>' }).waitFor();
    assert.equal(await page.locator('#gsResults img').count(), 0); await mobileFits(page, '#gsResults button');
  });
  for (const exit of ['close', 'escape', 'back']) await scenario('할 일 요약 실시간 갱신·초점 복귀 ' + exit, async page => {
    await page.locator('#dashboardTodoOpen').click();
    await page.locator('.todoChkBox[data-id="late"]').check();
    assert.match(await page.locator('#dashboardTodoSummary').textContent(), /미완료 2건 · 밀린 할일 0건/);
    await page.locator('#todoText').fill('가상 추가 작업'); await page.locator('#todoAdd').click();
    assert.match(await page.locator('#dashboardTodoSummary').textContent(), /미완료 3건/);
    if (exit === 'close') await page.locator('#modalRoot .modal-close').click();
    if (exit === 'escape') await page.keyboard.press('Escape');
    if (exit === 'back') await page.goBack();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .modal') && document.activeElement.id === 'dashboardTodoOpen');
    assert.equal(new URL(page.url()).pathname, '/index.html'); await mobileFits(page, '#dashboardTodo button');
    assert.deepEqual(await page.evaluate(() => state.notes.filter(n => !n.todo).map(n => n.text)), ['일반 메모']);
  });
  await scenario('31번째 현장과 반복 추가 선택 유지 / 삭제된 현장 쓰기 차단', async page => {
    await page.evaluate(() => { state.activeProject = '가상현장31'; todoView(); });
    assert.equal(await page.locator('#todoProj').inputValue(), '가상현장31');
    await page.locator('#todoText').fill('첫 작업'); await page.locator('#todoAdd').click();
    await page.locator('#todoProj').selectOption('가상현장30');
    await page.locator('#todoText').fill('둘째 작업'); await page.locator('#todoAdd').click();
    assert.equal(await page.locator('#todoProj').inputValue(), '가상현장30');
    await page.locator('#todoText').fill('셋째 작업'); await page.locator('#todoText').press('Enter');
    assert.deepEqual(await page.evaluate(() => hjTodoList().slice(-3).map(n => n.project)), ['가상현장31', '가상현장30', '가상현장30']);
    await page.evaluate(() => { state.projects = state.projects.filter(p => p.name !== '가상현장30'); });
    const before = await page.evaluate(() => __opsData()); await page.locator('#todoText').fill('보존해야 하는 초안'); await page.locator('#todoAdd').click();
    assert.equal(await page.evaluate(() => __opsData()), before); assert.equal(await page.locator('#todoText').inputValue(), '보존해야 하는 초안');
  });
  await scenario('현장 0개에서도 할 일·빈 목록 동작', async page => {
    await page.evaluate(() => { state.projects = []; state.schedule = []; state.notes = []; render(); });
    assert.match(await page.locator('#dashboardTodoSummary').textContent(), /미완료 할 일이 없습니다/);
    await page.locator('#dashboardTodoOpen').click(); await page.locator('#todoText').fill('현장 없는 할 일'); await page.locator('#todoAdd').click();
    assert.equal(await page.evaluate(() => hjTodoList()[0].project), '');
    assert.match(await page.locator('#dashboardTodoSummary').textContent(), /미완료 1건/);
    await page.keyboard.press('Escape'); await historySettled(page);
    await page.evaluate(() => convTodoResult([{ t: '가상 대화에서 담은 할 일' }], '', false));
    await page.getByRole('button', { name: '✅ 할일로 담기', exact: true }).click();
    assert.equal(await page.locator('#modalRoot .modal').count(), 0);
    assert.match(await page.locator('#dashboardTodoSummary').textContent(), /미완료 2건/, 'conversation to-do also updates first screen');
  });
  for (const width of [360, 390]) await scenario('준비물 진행률·정확한 일정·일지 연결·포커스 유지', async page => {
    const label = page.locator('[data-dashboard-prep="s1"]');
    assert.equal(await label.textContent(), '챙김 1/2개'); assert.equal(await page.locator('[data-dashboard-prep="s4"]').textContent(), '준비물 목록 확인');
    assert.equal(await page.locator('[data-dashboard-prep="s3"]').count(), 0, 'routine keeps old action');
    assert.equal(await page.locator('[data-routinego="백업"]').count(), 1);
    const other = await page.evaluate(() => JSON.stringify(state.schedule.find(s => s.id === 's2')));
    await page.locator('[data-schprep="s1"]').click(); await page.locator('.prepChk[data-x="가상 공구"]').check();
    assert.equal(await label.textContent(), '챙김 2/2개'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.dataset.schprep === 's1');
    assert.equal(await page.evaluate(() => JSON.stringify(state.schedule.find(s => s.id === 's2'))), other);
    await historySettled(page); await page.locator('[data-schreport="s2"]').click();
    assert.match(await page.locator('#modalRoot').innerText(), /가상현장02/); assert.equal(await page.locator('#rDone').count(), 1);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#modalRoot .modal'));
    await mobileFits(page, '[data-schprep], [data-schreport]');
  }, width);
  await scenario('열어둔 준비물의 교체·삭제·수정·중복 ID는 쓰기 차단', async page => {
    await page.locator('[data-schprep="s1"]').click();
    await page.evaluate(() => { const i = state.schedule.findIndex(s => s.id === 's1'); state.schedule[i] = { ...state.schedule[i], prep: {} }; });
    // A single tap: check() would retry on the replacement control after the guard redraws.
    const beforeDirty = await page.evaluate(() => __opsDirty);
    let before = await page.evaluate(() => __opsData()); await page.locator('.prepChk[data-x="가상 공구"]').click();
    assert.equal(await page.evaluate(() => __opsData()), before, 'replacement never writes old object');
    assert.equal(await page.evaluate(() => __opsDirty), beforeDirty, 'single checkbox cannot report a lost write as saved');
    assert.equal(await page.locator('.prepChk[data-x="가상 공구"]').isChecked(), false);
    await page.locator('.prepChk[data-x="가상 공구"]').check(); assert.equal(await page.evaluate(() => state.schedule.find(s => s.id === 's1').prep['가상 공구']), true);
    await page.evaluate(() => { state.schedule = state.schedule.filter(s => s.id !== 's1'); }); before = await page.evaluate(() => __opsData());
    const dirty = await page.evaluate(() => __opsDirty); await page.getByRole('button', { name: '전부 체크', exact: true }).click();
    assert.equal(await page.evaluate(() => __opsData()), before); assert.equal(await page.evaluate(() => __opsDirty), dirty, 'no misleading save after deletion');
    await page.evaluate(() => prepCheck('s2'));
    await page.evaluate(() => { state.schedule.find(s => s.id === 's2').project = '가상현장03'; });
    before = await page.evaluate(() => __opsData()); await page.getByRole('button', { name: '전부 체크', exact: true }).click();
    assert.equal(await page.evaluate(() => __opsData()), before);
    await page.evaluate(() => { state.schedule.push({ ...state.schedule.find(s => s.id === 's2') }); });
    before = await page.evaluate(() => __opsData()); await page.getByRole('button', { name: '전부 체크', exact: true }).click();
    assert.equal(await page.evaluate(() => __opsData()), before);
  });
  await scenario('긴 일정·현장명 및 다가오는 3건 표시', async page => {
    await page.evaluate(() => {
      state.schedule[0].title = '가상긴작업명'.repeat(30); state.schedule[0].project = '가상긴현장명'.repeat(30);
      state.schedule = state.schedule.filter(s => s.date <= localDate());
      for (let i = 0; i < 5; i++) {
        const date = new Date(localDate() + 'T12:00:00'); date.setDate(date.getDate() + i + 1);
        state.schedule.push({ id: 'future' + i, date: localDate(date), title: '가상 예정 작업', project: '가상현장01' });
      }
      render();
    });
    assert.equal(await page.locator('[data-dashboard-prep^="future"]').count(), 3);
    await mobileFits(page, '#dashboardTodo button, [data-schprep], [data-schreport]');
  }, 360);
  console.log('mobile-operations: ' + passed + ' scenarios passed; isolated synthetic data only.');
})().catch(e => { console.error('FAIL mobile-operations', e.stack || e); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

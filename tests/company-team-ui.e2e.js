/* Isolated company portal QA. No production endpoint, credentials or legacy storage. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const ROOT = path.join(__dirname, '..'), ORIGIN = 'http://127.0.0.1:8299';
const API = 'https://script.google.com/macros/s/AKfyTEST_COMPANY/exec', PORTAL = 'https://script.google.com/macros/s/AKfyTEST_PORTAL/exec';
const TOKEN = 'TEST_SESSION_NOT_A_REAL_CREDENTIAL_'.padEnd(80, 'X');
const MUTANT = process.env.HJ_TEAM_UI_MUTATION || '';
const engine = vm.createContext({ console }); vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script-team-ops/TeamPure.gs'), 'utf8'), engine);
const clone = x => JSON.parse(JSON.stringify(x));
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
function seed() {
  return { schema: 1, revision: 0, requests: [], audit: [],
    teams: [{ id: 't1', name: '누수·배관팀', active: true }, { id: 't2', name: '인테리어팀', active: true }],
    members: [
      { id: 'owner', userId: 'TEST_OWNER_USER', officeId: 'TEST_OFFICE', name: '대표 모의', role: 'owner', active: true, teamIds: ['t1', 't2'] },
      { id: 'lead', userId: 'TEST_LEAD_USER', officeId: 'TEST_OFFICE', name: '팀장 모의', role: 'lead', active: true, teamIds: ['t1'] },
      { id: 'member', userId: 'TEST_MEMBER_USER', officeId: 'TEST_OFFICE', name: '직원 모의', role: 'member', active: true, teamIds: ['t1'] },
      { id: 'external', userId: 'TEST_EXTERNAL_USER', officeId: 'TEST_OFFICE', name: '외주 모의', role: 'external', active: true, teamIds: ['t2'] }
    ], tasks: [
      { id: 'task1', title: '배관 보수 모의 업무', project: '모의 현장 A', teamId: 't1', assigneeId: 'member', due: '2026-10-01', status: 'todo', handoff: '', sourceRef: '', updatedAt: '2026-09-27T00:00:00Z', updatedBy: 'owner' },
      { id: 'task2', title: '마감 모의 업무', project: '모의 현장 B', teamId: 't2', assigneeId: 'external', due: '2026-10-02', status: 'review', handoff: '검토 요청 모의', sourceRef: '', updatedAt: '2026-09-27T00:00:00Z', updatedBy: 'owner' }
    ] };
}
let browser, count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
async function harness(options = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  const page = await context.newPage(); page.setDefaultTimeout(6500);
  const h = { page, context, store: seed(), role: options.role || 'owner', calls: [], errors: [], writes: [], failNext: '', holdList: null, malformed: false, outOfScope: false };
  page.on('pageerror', e => h.errors.push(String(e)));
  const identity = () => ({ userId: h.store.members.find(m => m.id === h.role)?.userId || 'TEST_UNLINKED_USER', officeId: 'TEST_OFFICE' });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url.startsWith(ORIGIN + '/')) {
      const name = new URL(url).pathname.slice(1);
      if (['team.html', 'team-ui.js', 'team-config.js'].includes(name)) {
        let content = name === 'team-config.js' ? 'window.HJ_TEAM_CONFIG={apiUrl:' + JSON.stringify(options.unconfigured ? '' : API) + '};' : fs.readFileSync(path.join(ROOT, name), 'utf8');
        if (name === 'team-ui.js' && MUTANT === 'allow-role-leak') content = content.replace("if (!d.tasks.every(t => d.me.role === 'owner' || (d.me.role === 'lead' && d.me.teamIds.includes(t.teamId)) || t.assigneeId === d.me.id)) return false;", '/* mutation: ignore projection */');
        if (name === 'team-ui.js' && MUTANT === 'persist-session') content = content.replace('state.token = r.sessionToken;', 'state.token = r.sessionToken; localStorage.setItem("MUTANT_SESSION", r.sessionToken);');
        if (name === 'team-ui.js' && MUTANT === 'retry-new-id') content = content.replace('const r = await api(edit.pending.action, edit.pending.payload);', 'edit.pending.payload.requestId = crypto.randomUUID(); const r = await api(edit.pending.action, edit.pending.payload);');
        return route.fulfill({ status: 200, contentType: name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8', body: content });
      }
      return route.fulfill({ status: 404, body: '' });
    }
    if (![API, PORTAL].includes(url)) { h.errors.push('Unexpected external request'); return route.abort(); }
    assert.equal(request.method(), 'POST'); const body = JSON.parse(request.postData()); h.calls.push(clone(body));
    let result;
    try {
      if (url === PORTAL) {
        if (body.action === 'portalLogin') { assert.equal(body.payload.loginCode, 'TEST_PASSWORD'); result = { sessionToken: TOKEN, expiresAt: Date.now() + 3600000 }; }
        else { assert.equal(body.action, 'portalLogout'); result = {}; }
      } else if (body.action === 'health') result = { service: 'company-team-v1', portalUrl: PORTAL };
      else {
        assert.equal(body.sessionToken, TOKEN);
        if (body.action === 'identity') result = { identity: identity() };
        else if (body.action === 'list') {
          if (h.holdList) { const hold = h.holdList; h.holdList = null; await hold.promise; }
          if (h.failNext === 'read-forbidden') { h.failNext = ''; throw new Error('forbidden'); }
          result = { data: clone(engine.teamPresent_(h.store, identity())) };
          if (h.malformed) result.data.me.role = 'made-up';
          if (h.outOfScope) result.data.tasks = clone(h.store.tasks);
        } else {
          h.writes.push(clone(body));
          if (h.failNext === 'conflict') { h.failNext = ''; h.store.revision++; throw new Error('conflict'); }
          if (h.failNext === 'unknown') { h.failNext = ''; throw new Error('unknown-secret-detail'); }
          if (h.failNext === 'session-expired') { h.failNext = ''; throw new Error('session-expired'); }
          const out = engine.teamApply_(h.store, identity(), body.action, body.payload, '2026-09-27T01:00:00Z', crypto.randomUUID(), digest);
          h.store = clone(out.store); result = { data: clone(engine.teamPresent_(h.store, identity())), replayed: out.replayed };
          if (h.failNext === 'network-after-write') { h.failNext = ''; return route.abort('failed'); }
        }
      }
      result.ok = true;
    } catch (e) { result = { ok: false, error: e.message }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) }).catch(() => {});
  });
  await page.goto(ORIGIN + '/team.html');
  h.login = async () => {
    await page.waitForFunction(() => !document.getElementById('loginButton').disabled);
    await page.fill('#officeCode', 'test-office'); await page.fill('#email', 'staff@example.invalid'); await page.fill('#loginCode', 'TEST_PASSWORD'); await page.click('#loginButton');
    await page.waitForFunction(() => !document.getElementById('sessionPanel').hidden);
    if (h.role !== 'unlinked') await page.waitForFunction(() => !document.getElementById('workspace').hidden);
  };
  h.close = async () => { assert.deepEqual(h.errors, [], 'No page or unexpected network errors'); await context.close(); };
  return h;
}
async function newTask(h, title = '새 모의 업무') {
  await h.page.click('#newTask'); await h.page.fill('#edit-title', title); await h.page.fill('#edit-project', '모의 현장 C'); await h.page.selectOption('#edit-teamId', 't1'); await h.page.selectOption('#edit-assigneeId', 'member');
}
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await test('not configured: login locked and zero credential/API requests', async () => {
    const h = await harness({ unconfigured: true }); assert(await h.page.isDisabled('#loginButton')); assert((await h.page.textContent('#connection')).includes('설정되지')); assert.equal(h.calls.length, 0); await h.close();
  });
  await test('dark header return link remains readable',async()=>{
    const h=await harness({unconfigured:true});assert.equal(await h.page.locator('header a').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');await h.close();
  });
  await test('memory-only login and 360px accessible organization/member/team flows', async () => {
    const h = await harness(); await h.login(); assert.equal(await h.page.inputValue('#loginCode'), '');
    assert.deepEqual(await h.page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, legacy: typeof window.state, db: typeof window.idbGet })), { local: 0, session: 0, legacy: 'undefined', db: 'undefined' });
    await h.page.click('#tabOrg'); assert((await h.page.textContent('#orgList')).includes('누수·배관팀'));
    await h.page.click('#newTeam'); await h.page.fill('#edit-name', '모의 새 팀'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open); assert(h.store.teams.some(t => t.name === '모의 새 팀'));
    await h.page.click('#newMember'); await h.page.fill('#edit-name', '신규 모의'); await h.page.fill('#edit-userId', 'TEST_NEW_USER'); await h.page.check('input[name=teamIds][value=t1]'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open); assert(h.store.members.some(m => m.userId === 'TEST_NEW_USER' && m.teamIds[0] === 't1'));
    assert(await h.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    const tiny = await h.page.locator('button:visible,input:visible,select:visible').evaluateAll(ns => ns.filter(n => n.getBoundingClientRect().height < 44).map(n => n.id)); assert.deepEqual(tiny, []);
    await h.page.click('#tabAudit'); assert((await h.page.textContent('#auditList')).includes('직원 권한 변경')); await h.close();
  });
  await test('owner assignment saves exact API schema; user text never becomes HTML', async () => {
    const h = await harness(); await h.login(); await newTask(h, '<img src=x onerror=alert(1)>'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open);
    const task = h.store.tasks.at(-1); assert.equal(task.status, 'todo'); assert.equal(task.assigneeId, 'member'); assert.equal(task.project, '모의 현장 C');
    await h.page.selectOption('#scopeFilter', 'visible'); assert((await h.page.textContent('#taskList')).includes('<img')); assert.equal(await h.page.locator('#taskList img').count(), 0); await h.close();
  });
  await test('member sees own assignments only; no organization administration or completion approval', async () => {
    const h = await harness({ role: 'member' }); await h.login(); assert(await h.page.isHidden('#newTask')); assert(await h.page.isHidden('#orgActions')); assert(await h.page.isHidden('#tabAudit'));
    assert((await h.page.textContent('#taskList')).includes('배관 보수')); assert(!(await h.page.textContent('#taskList')).includes('마감 모의'));
    await h.page.getByRole('button', { name: '업무 확인·수정' }).click(); assert(await h.page.isDisabled('#edit-title')); assert(await h.page.isDisabled('#edit-teamId')); assert.equal(await h.page.locator('#edit-status option[value=done]').count(), 0);
    await h.page.selectOption('#edit-status', 'review'); await h.page.click('#save'); assert((await h.page.textContent('#editorMessage')).includes('인수인계')); assert.equal(h.writes.length, 0);
    await h.page.fill('#edit-handoff', '모의 검수 요청'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open); assert.equal(h.store.tasks[0].status, 'review'); await h.close();
  });
  await test('lead assigns only own team and external can update only assigned work', async () => {
    const h = await harness({ role: 'lead' }); await h.login(); await h.page.click('#newTask'); assert.deepEqual(await h.page.locator('#edit-teamId option').evaluateAll(ns => ns.map(n => n.value)), ['t1']); await h.page.click('#editorClose'); await h.close();
    const ext = await harness({ role: 'external' }); await ext.login(); assert(await ext.page.isHidden('#newTask')); assert((await ext.page.textContent('#taskList')).includes('마감 모의')); assert(!(await ext.page.textContent('#taskList')).includes('배관 보수')); await ext.close();
  });
  await test('conflict retains draft and requires compare, explicit rebase, then explicit save', async () => {
    const h = await harness(); await h.login(); await newTask(h, '충돌 보존 모의'); h.failNext = 'conflict'; await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('compare').hidden);
    assert.equal(await h.page.inputValue('#edit-title'), '충돌 보존 모의'); assert(await h.page.isDisabled('#save')); assert.equal(h.writes.length, 1);
    await h.page.click('#compare'); await h.page.waitForFunction(() => !document.getElementById('rebase').hidden); assert.equal(h.writes.length, 1);
    await h.page.click('#rebase'); assert.equal(h.writes.length, 1); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open);
    assert.equal(h.writes[1].payload.revision, 1); assert.notEqual(h.writes[0].payload.requestId, h.writes[1].payload.requestId); await h.close();
  });
  await test('ambiguous network retry sends identical request and cannot duplicate committed task', async () => {
    const h = await harness(); await h.login(); await newTask(h, '재시도 모의'); h.failNext = 'network-after-write'; await h.page.click('#save'); await h.page.waitForFunction(() => document.getElementById('save').textContent.includes('재확인'));
    assert(await h.page.isDisabled('#edit-title')); assert.equal(await h.page.inputValue('#edit-title'), '재시도 모의'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open);
    assert.deepEqual(h.writes[0], h.writes[1]); assert.equal(h.store.tasks.filter(t => t.title === '재시도 모의').length, 1); await h.close();
  });
  await test('unknown failure is not success and keeps exact retry plus draft', async () => {
    const h = await harness(); await h.login(); await newTask(h, '실패 보존 모의'); h.failNext = 'unknown'; await h.page.click('#save'); await h.page.waitForFunction(() => document.getElementById('save').textContent.includes('재확인'));
    assert((await h.page.textContent('#editorMessage')).includes('확인하지 못했습니다')); assert(!(await h.page.textContent('body')).includes('unknown-secret-detail')); assert.equal(h.store.tasks.length, 2); assert.equal(await h.page.inputValue('#edit-title'), '실패 보존 모의'); await h.close();
  });
  await test('import previews locally and sends only selected draft after explicit assignment', async () => {
    const h = await harness(); await h.login(); await h.page.click('#importButton');
    const material = { format: 'company-task-drafts-v1', tasks: [{ title: '가져온 모의 업무', project: '모의 기존 현장', due: '', handoff: '', sourceRef: 'legacy-test-1' }] };
    await h.page.setInputFiles('#importFile', { name: 'test-drafts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(material)) });
    await h.page.getByRole('button', { name: '배정 초안 열기' }).waitFor(); assert.equal(h.writes.length, 0); await h.page.getByRole('button', { name: '배정 초안 열기' }).click(); assert.equal(h.writes.length, 0); assert.equal(await h.page.inputValue('#edit-title'), '가져온 모의 업무');
    await h.page.selectOption('#edit-assigneeId', 'member'); await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('editor').open); assert.equal(h.writes.length, 1); assert.equal(h.store.tasks.at(-1).sourceRef, 'legacy-test-1'); assert(await h.page.getByRole('button', { name: '이미 등록됨' }).isDisabled()); await h.close();
  });
  await test('unlinked identity can be shown, but no data/privileged forms', async () => {
    const h = await harness({ role: 'unlinked' }); await h.login(); await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('권한')); assert(await h.page.isHidden('#workspace')); assert((await h.page.textContent('#identity')).includes('TEST_UNLINKED_USER')); await h.close();
  });
  await test('malformed or out-of-scope server projection fails closed', async () => {
    const h = await harness({ role: 'member' }); await h.login(); h.outOfScope = true; await h.page.click('#refresh'); await h.page.waitForFunction(() => document.getElementById('workspace').hidden); assert((await h.page.textContent('#connection')).includes('응답')); assert.equal(await h.page.locator('#taskList article').count(), 0); await h.close();
    const bad = await harness(); await bad.login(); bad.malformed = true; await bad.page.click('#refresh'); await bad.page.waitForFunction(() => document.getElementById('workspace').hidden); await bad.close();
  });
  await test('logout clears DOM and rejects a late previous-session read', async () => {
    const h = await harness(); await h.login(); let release; h.holdList = { promise: new Promise(r => { release = r; }) };
    const countBefore = h.calls.length; await h.page.click('#refresh'); await h.page.waitForFunction(() => document.getElementById('refresh').disabled); assert(h.calls.length >= countBefore);
    await h.page.click('#logout'); release(); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    assert.equal(await h.page.textContent('#identity'), ''); assert.equal(await h.page.textContent('#orgList'), ''); assert.equal(await h.page.textContent('#taskList'), ''); assert(await h.page.isHidden('#workspace')); assert.equal(await h.page.evaluate(() => localStorage.length + sessionStorage.length), 0); await h.close();
  });
  await test('expired session clears even an unsaved editor', async () => {
    const h = await harness(); await h.login(); await newTask(h, '세션 만료 초안 모의'); h.failNext = 'session-expired'; await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    assert.equal(await h.page.locator('#editorFields input').count(), 0); assert.equal(await h.page.textContent('#identity'), ''); assert(await h.page.isHidden('#workspace')); await h.close();
  });
  await browser.close(); console.log('company-team-ui: ' + count + '/' + count + ' PASS');
}
if (process.argv.includes('--mutations')) {
  const { spawnSync } = require('child_process'); let caught = 0;
  for (const name of ['allow-role-leak', 'persist-session', 'retry-new-id']) {
    const result = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_TEAM_UI_MUTATION: name }, timeout: 120000, encoding: 'utf8' });
    assert(!result.error, name + ': runner error ' + result.error); assert.notEqual(result.status, 0, name + ' survived'); assert((result.stdout + result.stderr).includes('FAIL company-team-ui:'), name + ': did not reach assertions'); console.log('DETECTED ' + name); caught++;
  }
  console.log('company-team-ui mutations: ' + caught + '/3 detected');
} else run().catch(async e => { console.error('FAIL company-team-ui:', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });

/* Isolated company portal QA. No production endpoint, credentials or legacy storage. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const ROOT = path.join(__dirname, '..'), ORIGIN = 'http://127.0.0.1:8299';
const API = 'https://script.google.com/macros/s/AKfyTEST_COMPANY/exec', PORTAL = 'https://script.google.com/macros/s/AKfyTEST_PORTAL/exec';
const TOKEN = 'TEST_SESSION_NOT_A_REAL_CREDENTIAL_'.padEnd(80, 'X');
const MUTANT = process.env.HJ_TEAM_UI_MUTATION || '';
const engine = vm.createContext({ console, companyDigest_: x => crypto.createHash('sha256').update(x).digest('hex') });
for (const file of ['TeamPure.gs', 'TeamProjects.gs', 'TeamEvidence.gs']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script-team-ops', file), 'utf8'), engine);
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
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block', hasTouch: !!options.touch });
  const page = await context.newPage(); page.setDefaultTimeout(6500);
  const h = { page, context, store: seed(), role: options.role || 'owner', calls: [], errors: [], writes: [], failNext: '', holdList: null, malformed: false, outOfScope: false };
  if (options.store) h.store = clone(options.store); h.files = {};
  if (options.shared) Object.defineProperty(h, 'store', { get: () => options.shared.store, set: v => { options.shared.store = v; } });
  page.on('pageerror', e => h.errors.push(String(e)));
  const identity = () => ({ userId: h.store.members.find(m => m.id === h.role)?.userId || 'TEST_UNLINKED_USER', officeId: 'TEST_OFFICE' });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url.startsWith(ORIGIN + '/')) {
      const name = new URL(url).pathname.slice(1);
      if (['team.html', 'team-ui.js', 'team-projects.js', 'team-packet.js', 'team-config.js', 'team-upload.js'].includes(name)) {
        let content = name === 'team-config.js' ? 'window.HJ_TEAM_CONFIG={apiUrl:' + JSON.stringify(options.unconfigured ? '' : API) + '};' : fs.readFileSync(path.join(ROOT, name), 'utf8');
        if (name === 'team-ui.js' && MUTANT === 'allow-role-leak') content = content.replace("if (!d.tasks.every(t => d.me.role === 'owner' || (d.me.role === 'lead' ? d.me.teamIds.includes(t.teamId) : t.assigneeId === d.me.id))) return false;", '/* mutation: ignore projection */');
        if (name === 'team-ui.js' && MUTANT === 'team-filter') content = content.replace('if (team) return d.tasks.filter(t => t.teamId === team.id);', 'if (team) return d.tasks;');
        if (name === 'team-ui.js' && MUTANT === 'action-autosave') content = content.replace("editorNotice('아직 반영되지 않았습니다.", "save({preventDefault(){}}); editorNotice('아직 반영되지 않았습니다.");
        if (name === 'team-ui.js' && MUTANT === 'persist-session') content = content.replace('state.token = r.sessionToken;', 'state.token = r.sessionToken; localStorage.setItem("MUTANT_SESSION", r.sessionToken);');
        if (name === 'team-ui.js' && MUTANT === 'retry-new-id') content = content.replace('const r = await api(edit.pending.action, edit.pending.payload);', 'edit.pending.payload.requestId = crypto.randomUUID(); const r = await api(edit.pending.action, edit.pending.payload);');
        // 대표 결정 2026-10-01: 20-minute idle logout and its one-minute warning.
        if (name === 'team-ui.js' && MUTANT === 'idle-no-logout') content = content.replace('if (now >= state.idleAt + IDLE_MS) { logout(IDLE_MESSAGE); return; }', '');
        if (name === 'team-ui.js' && MUTANT === 'idle-no-warning') content = content.replace('if (now >= state.idleAt + IDLE_MS - IDLE_WARN_MS) showIdleWarning(true);', '');
        // A touch fires pointerdown AND touchstart before its click; ignoring only pointerdown inside the banner hid it on touchstart and the click fell through.
        if (name === 'team-ui.js' && MUTANT === 'idle-touch-ghost') content = content.replace("const activity = ev => { if (ev && ev.target && ev.target.closest && ev.target.closest('#idleNotice')) return; touchSession(); };", "const activity = ev => { if (ev && ev.type === 'pointerdown' && ev.target && ev.target.closest && ev.target.closest('#idleNotice')) return; touchSession(); };");
        if (name === 'team-ui.js' && MUTANT === 'idle-text-literal') content = content.replace('IDLE_MIN = Math.round(IDLE_MS / 60000)', 'IDLE_MIN = 19');
        if (name === 'team-ui.js' && MUTANT === 'idle-no-extend') content = content.replace("$('idleExtend').onclick = () => touchSession(); ['pointerdown', 'keydown', 'touchstart', 'touchmove', 'wheel'].forEach(ev => window.addEventListener(ev, activity, { passive: true, capture: true }));", '');
        if (options.mutate) content = options.mutate(name, content);
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
      } else if (body.action === 'health') result = { service: options.oldServer ? 'company-team-v2' : 'company-team-v3', portalUrl: PORTAL };
      else {
        assert.equal(body.sessionToken, TOKEN);
        if (body.action === 'identity') result = { identity: identity() };
        else if (body.action === 'list') {
          if (h.holdList) { const hold = h.holdList; h.holdList = null; await hold.promise; }
          if (h.failNext === 'read-forbidden') { h.failNext = ''; throw new Error('forbidden'); }
          result = { data: clone(engine.teamPresent_(h.store, identity())) };
          if (h.malformed) result.data.me.role = 'made-up';
          if (h.outOfScope) result.data.tasks = clone(h.store.tasks);
        } else if (body.action === 'evidenceRead') {
          const e = h.store.evidence.find(e => e.id === body.payload.evidenceId);
          if (!e || !engine.teamEvidenceVisible_(h.store, engine.teamMember_(h.store, identity()), e)) throw new Error('forbidden');
          if (h.holdEvidence) { const hold = h.holdEvidence; h.holdEvidence = null; await hold.promise; }
          result = { file: { mime: e.mime, name: e.name, size: e.size, sha256: e.sha256, base64: h.files[e.id] } };
        } else if (['evidenceMediaBegin', 'evidenceMediaChunk', 'evidenceReadChunk'].includes(body.action)) {
          // v333 fake of TeamMedia.gs: server-held offset, resend never appends twice, whole-file SHA check on completion.
          h.media ||= {}; h.mediaCalls ||= []; h.mediaCalls.push({ action: body.action, offset: body.payload.offset, uploadId: body.payload.uploadId });
          // holdMedia/failMedia may name the exact call number ({ at: n }) so tests never race a timer.
          const nth = h.mediaCalls.length, due = x => x && (!x.at || x.at === nth);
          if (due(h.holdMedia)) { const hold = h.holdMedia; h.holdMedia = null; await hold.promise; }
          const failing = due(h.failMedia) ? h.failMedia.mode || h.failMedia : ''; if (failing) h.failMedia = '';
          if (failing === 'network-before') return route.abort('failed');
          const me = engine.teamMember_(h.store, identity());
          if (body.action === 'evidenceReadChunk') {
            const e = h.store.evidence.find(e => e.id === body.payload.evidenceId); if (!e || !engine.teamEvidenceVisible_(h.store, me, e)) throw new Error('forbidden');
            const all = Buffer.from(h.files[e.id], 'base64'), part = all.subarray(body.payload.offset, body.payload.offset + body.payload.length);
            result = { chunk: { mime: e.mime, size: e.size, sha256: e.sha256, offset: body.payload.offset, nextOffset: body.payload.offset + part.length, eof: body.payload.offset + part.length === e.size, base64: part.toString('base64') } };
          } else {
            let job = h.media[body.payload.uploadId];
            if (body.action === 'evidenceMediaBegin') {
              const meta = engine.teamEvidenceValidate_(h.store, me, body.payload.entity); if (meta.kind !== 'video') throw new Error('invalid-input');
              if (h.store.evidence?.some(e => e.id === meta.id)) result = { upload: { uploadId: body.payload.uploadId, state: 'committed', offset: meta.size, size: meta.size, chunkBytes: 1048576 } };
              else { if (job && JSON.stringify(job.entity) !== JSON.stringify(body.payload.entity)) throw new Error('request-conflict'); job = h.media[body.payload.uploadId] ||= { entity: clone(body.payload.entity), parts: [], actor: me.id }; }
            } else {
              if (!job) throw new Error('upload-not-found'); if (job.actor !== me.id) throw new Error('forbidden'); engine.teamEvidenceValidate_(h.store, me, job.entity);
              const bytes = Buffer.from(body.payload.base64, 'base64'), have = Buffer.concat(job.parts).length;
              if (body.payload.offset === have) job.parts.push(bytes);
            }
            if (!result) {
              const all = Buffer.concat(job.parts), complete = all.length === job.entity.size;
              if (complete && digest(all) !== job.entity.sha256) throw new Error('hash-mismatch');
              result = { upload: { uploadId: body.payload.uploadId, state: complete ? 'complete' : 'uploading', offset: all.length, size: job.entity.size, chunkBytes: 1048576 } };
            }
          }
          if (failing === 'network-after') return route.abort('failed');
        } else if (body.action === 'claimBundle') {
          if (h.bundleChange) { h.store.tasks[0].handoff = '모의 변경'; h.bundleChange = false; }
          result = { bundle: clone(engine.teamClaimBundle_(h.store, engine.teamMember_(h.store, identity()), body.payload.claimId, digest)) };
        } else {
          h.writes.push(clone(body));
          if (h.failNext === 'conflict') { h.failNext = ''; h.store.revision++; throw new Error('conflict'); }
          if (h.failNext === 'unknown') { h.failNext = ''; throw new Error('unknown-secret-detail'); }
          if (h.failNext === 'session-expired') { h.failNext = ''; throw new Error('session-expired'); }
          const payload = clone(body.payload); let attachment;
          if (body.action === 'evidenceUpload' && payload.uploadId) { const job = h.media?.[payload.uploadId]; if (!job || Buffer.concat(job.parts).length !== payload.entity.size) throw new Error('upload-incomplete'); h.files[payload.entity.id] = Buffer.concat(job.parts).toString('base64'); delete payload.uploadId; attachment = { fileId: 'MOCK_PRIVATE_FILE', binding: digest(JSON.stringify([h.role, payload.entity])) }; }
          else if (body.action === 'evidenceUpload') { h.files[payload.entity.id] = payload.base64; delete payload.base64; attachment = { fileId: 'MOCK_PRIVATE_FILE', binding: digest(JSON.stringify([h.role, payload.entity])) }; }
          if (h.failNext === 'network-before-write') { h.failNext = ''; return route.abort('failed'); }
          const out = engine.teamApply_(h.store, identity(), body.action, payload, new Date().toISOString(), crypto.randomUUID(), digest, attachment);
          h.store = clone(out.store); result = { data: clone(engine.teamPresent_(h.store, identity())), replayed: out.replayed };
          if (h.failNext === 'network-after-write') { h.failNext = ''; return route.abort('failed'); }
          // v333: stored, but the answer says duplicate/conflict (another tab or a lost answer under a different requestId).
          if (h.failNext === 'duplicate-after-write' || h.failNext === 'conflict-after-write') { const c = h.failNext.replace('-after-write', ''); h.failNext = ''; throw new Error(c); }
        }
      }
      result.ok = true;
    } catch (e) { result = { ok: false, error: e.message }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) }).catch(() => {});
  });
  await page.goto(ORIGIN + '/team.html' + (options.hash || ''));
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
async function openFilters(h) { if (!await h.page.locator('#taskFilters').evaluate(el => el.open)) await h.page.locator('#taskFilters > summary').click(); }
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  await test('not configured: login locked and zero credential/API requests', async () => {
    const h = await harness({ unconfigured: true }); assert(await h.page.isDisabled('#loginButton')); assert((await h.page.textContent('#connection')).includes('설정되지')); assert.equal(h.calls.length, 0); await h.close();
  });
  await test('dark header return link remains readable',async()=>{
    const h=await harness({unconfigured:true});assert.equal(await h.page.locator('header a').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');await h.close();
  });
  await test('old server without report contract cannot accept credentials', async () => {
    const h = await harness({ oldServer: true }); await h.page.waitForFunction(() => document.getElementById('connection').textContent.includes('응답'));
    assert(await h.page.isDisabled('#loginButton')); assert.deepEqual(h.calls.map(c => c.action), ['health']); await h.close();
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
    await h.page.click('#tabTeams'); await h.page.locator('[data-team-id=t1] button').click(); assert((await h.page.textContent('#taskList')).includes('<img')); assert.equal(await h.page.locator('#taskList img').count(), 0); await h.close();
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
  await test('20 minutes without touch, key, scroll or request logs out with a one-minute warning that any activity extends', async () => {
    // 대표 결정 2026-10-01. Fake clock: time still flows, fastForward jumps it.
    const h = await harness(); await h.page.clock.install({ time: new Date('2026-10-01T09:00:00+09:00') }); await h.login();
    const M = 60000, logouts = () => h.calls.filter(c => c.action === 'portalLogout').length, before = logouts();
    await h.page.clock.fastForward(18 * M); assert(await h.page.isHidden('#idleNotice'), 'no warning at 18 minutes'); assert(await h.page.isHidden('#loginPanel'));
    await h.page.clock.fastForward(90 * 1000); await h.page.waitForFunction(() => !document.getElementById('idleNotice').hidden);
    assert((await h.page.textContent('#idleText')).includes('1분 뒤 자동 로그아웃됩니다'), await h.page.textContent('#idleText')); assert.equal(await h.page.getAttribute('#idleNotice', 'role'), 'alert');
    await h.page.click('#idleExtend'); await h.page.waitForFunction(() => document.getElementById('idleNotice').hidden);
    await h.page.clock.fastForward(18 * M); assert(await h.page.isHidden('#loginPanel'), 'extending restarted the 20 minutes'); assert(await h.page.isHidden('#idleNotice'));
    await h.page.keyboard.press('Shift'); await h.page.clock.fastForward(19 * M + 30 * 1000); assert(await h.page.isHidden('#loginPanel'), 'a key press is activity');
    await h.page.waitForFunction(() => !document.getElementById('idleNotice').hidden); await h.page.mouse.move(5, 5); await h.page.mouse.wheel(0, 10); await h.page.waitForFunction(() => document.getElementById('idleNotice').hidden, null, { timeout: 2000 }).catch(() => {});
    const scrolled = await h.page.isHidden('#idleNotice'); assert(scrolled, 'a scroll is activity');
    await h.page.clock.fastForward(20 * M + 1000); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    assert((await h.page.textContent('#connection')).includes('20분 동안 쓰지 않아 자동으로 로그아웃했습니다 — 다시 로그인하세요.'), await h.page.textContent('#connection'));
    assert.equal(logouts(), before + 1, 'the server session is ended the same way as the logout button'); assert(await h.page.isHidden('#workspace')); assert.equal(await h.page.textContent('#identity'), '');
    assert.equal(await h.page.evaluate(() => localStorage.length + sessionStorage.length), 0); assert(await h.page.isHidden('#idleNotice')); await h.close();
  });
  await test('the idle warning text and the login footnote say the minutes IDLE_MS actually means', async () => {
    // The literal '20분' used to be written in three places; mutant idle-text-literal cuts the wording loose from IDLE_MS (timing unchanged, text wrong).
    const src = fs.readFileSync(path.join(ROOT, 'team-ui.js'), 'utf8'), mutatedMin = Number(/const IDLE_MS = (\d+) \* 60000/.exec(src)[1]);
    assert(!/\d+분 동안/.test(src) && !/\d+분 뒤/.test(src), 'team-ui.js writes no minute count as a literal');
    assert(!/\d+분 동안/.test(fs.readFileSync(path.join(ROOT, 'team.html'), 'utf8')), 'team.html leaves the footnote minutes to team-ui.js');
    const h = await harness(); await h.page.clock.install({ time: new Date('2026-10-01T09:00:00+09:00') });
    await h.page.waitForFunction(() => document.getElementById('idleFootnote').textContent.includes('분'));
    assert.equal(await h.page.textContent('#idleFootnote'), mutatedMin + '분 동안 쓰지 않으면 자동으로 로그아웃됩니다.');
    await h.login(); await h.page.clock.fastForward(mutatedMin * 60000 - 30 * 1000); await h.page.waitForFunction(() => !document.getElementById('idleNotice').hidden);
    assert.equal(await h.page.textContent('#idleText'), '1분 뒤 자동 로그아웃됩니다 — ' + mutatedMin + '분 동안 쓰지 않았습니다. 계속 쓰려면 누르세요.');
    await h.page.clock.fastForward(31 * 1000); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    assert((await h.page.textContent('#connection')).includes(mutatedMin + '분 동안 쓰지 않아 자동으로 로그아웃했습니다 — 다시 로그인하세요.'), await h.page.textContent('#connection')); await h.close();
  });
  await test('on a touch screen, tapping [계속 사용] extends the session and never ghost-clicks what sits under the banner', async () => {
    // A tap fires pointerdown, touchstart, then click. Hiding the banner on touchstart let the click hit-test the header link under it,
    // navigating to the field app and dropping the memory-only session — the opposite of 대표 결정 ⑤.
    const h = await harness({ touch: true }); await h.page.clock.install({ time: new Date('2026-10-01T09:00:00+09:00') }); await h.login();
    const M = 60000, logouts = () => h.calls.filter(c => c.action === 'portalLogout').length, before = logouts();
    await h.page.evaluate(() => { window.__clicks = []; window.addEventListener('click', e => window.__clicks.push(e.target.id || e.target.tagName + ':' + (e.target.getAttribute('href') || '')), true); });
    await h.page.clock.fastForward(19 * M + 30 * 1000); await h.page.waitForFunction(() => !document.getElementById('idleNotice').hidden);
    // Precondition: something else sits under the button (the banner is position:fixed over the page), so a fallen-through click is observable.
    const under = await h.page.evaluate(() => { const n = document.getElementById('idleNotice'), b = document.getElementById('idleExtend').getBoundingClientRect(); n.style.visibility = 'hidden'; const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); n.style.visibility = ''; return el ? el.id || el.tagName : ''; });
    assert(under && under !== 'idleExtend', 'precondition: an element lies under the button: ' + under);
    await h.page.tap('#idleExtend'); await h.page.waitForFunction(() => document.getElementById('idleNotice').hidden);
    assert.deepEqual(await h.page.evaluate(() => window.__clicks), ['idleExtend'], 'the tap clicked the button and nothing else');
    assert(new URL(h.page.url()).pathname.endsWith('/team.html'), 'still on team.html: ' + h.page.url()); assert(await h.page.isHidden('#loginPanel'), 'still logged in');
    await h.page.clock.fastForward(18 * M); assert(await h.page.isHidden('#loginPanel'), 'the tap restarted the idle clock'); assert(await h.page.isHidden('#idleNotice')); assert.equal(logouts(), before);
    await h.page.touchscreen.tap(180, 400); await h.page.clock.fastForward(18 * M); assert(await h.page.isHidden('#loginPanel'), 'a touch elsewhere is activity'); assert(await h.page.isHidden('#idleNotice'));
    await h.close();
  });
  await test('expired session clears even an unsaved editor', async () => {
    const h = await harness(); await h.login(); await newTask(h, '세션 만료 초안 모의'); h.failNext = 'session-expired'; await h.page.click('#save'); await h.page.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    assert.equal(await h.page.locator('#editorFields input').count(), 0); assert.equal(await h.page.textContent('#identity'), ''); assert(await h.page.isHidden('#workspace')); await h.close();
  });
  await test('team workspace is scoped, project assignment is contextual, route contains no project or text', async () => {
    const h = await harness(); await h.login(); await h.page.click('#tabTeams'); await h.page.locator('[data-team-id=t1] button').click();
    assert.equal(await h.page.textContent('#pageTitle'), '누수·배관팀 작업실'); assert.equal(await h.page.getAttribute('#tabTeams', 'aria-current'), 'page');
    assert((await h.page.textContent('#taskList')).includes('배관 보수')); assert(!(await h.page.textContent('#taskList')).includes('마감 모의'));
    await openFilters(h); await h.page.selectOption('#projectFilter', '모의 현장 A'); await h.page.fill('#search', '배관'); await h.page.click('#newTask');
    assert.equal(await h.page.inputValue('#edit-teamId'), 't1'); assert.equal(await h.page.inputValue('#edit-project'), '모의 현장 A'); assert.equal(h.writes.length, 0);
    await h.page.click('#editorClose'); assert(h.page.url().endsWith('#team/t1')); assert(!h.page.url().includes(encodeURIComponent('모의')));
    await h.page.click('#tabTasks'); await h.page.goBack(); await h.page.waitForFunction(() => document.getElementById('pageTitle').textContent.includes('누수'));
    assert.equal(await h.page.evaluate(() => document.activeElement.id), 'pageTitle');
    await h.page.locator('.skip').focus(); await h.page.keyboard.press('Enter'); assert(h.page.url().endsWith('#team/t1')); assert.equal(await h.page.evaluate(() => document.activeElement.id), 'pageTitle');
    assert.equal(await h.page.inputValue('#search'), '배관'); assert.equal(await h.page.inputValue('#projectFilter'), '모의 현장 A');
    await h.page.fill('#search', '없는 업무'); assert.equal(await h.page.locator('#taskList article').count(), 0); await h.page.click('#resetFilters'); assert.equal(await h.page.locator('#taskList article').count(), 1);
    assert(await h.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await h.close();
  });
  await test('unauthorized routes and changed team membership fall back; in-progress draft cannot navigate away', async () => {
    const member = await harness({ role: 'member', hash: '#settings' }); await member.login(); assert(member.page.url().endsWith('#mine')); assert(await member.page.isHidden('#tabOrg'));
    await member.page.evaluate(() => location.hash = '#team/t2'); await member.page.waitForFunction(() => location.hash === '#mine'); assert(!(await member.page.textContent('#taskList')).includes('마감 모의'));
    await member.page.getByRole('button', { name: '업무 확인·수정' }).click(); await member.page.fill('#edit-handoff', '보존할 작업 메모'); await member.page.evaluate(() => location.hash = '#teams');
    await member.page.waitForFunction(() => location.hash === '#mine'); assert.equal(await member.page.inputValue('#edit-handoff'), '보존할 작업 메모'); assert.equal(member.writes.length, 0); await member.page.click('#editorClose'); await member.close();
    const lead = await harness({ role: 'lead', hash: '#team/t1' }); await lead.login(); lead.store.members.find(m => m.id === 'lead').teamIds = [];
    await lead.page.click('#refresh'); await lead.page.waitForFunction(() => location.hash === '#mine'); assert.equal(await lead.page.locator('#taskList article').count(), 0); assert.equal(await lead.page.locator('#teamDirectory article').count(), 0); await lead.close();
  });
  await test('operations page finds overdue/blocked work and opens an exact team filter', async () => {
    const h = await harness(); h.store.tasks[0].due = '2000-01-01'; h.store.tasks[0].status = 'blocked'; h.store.tasks[0].handoff = '모의 자재 확인'; await h.login();
    await h.page.click('#tabOperations'); const ops = h.page.locator('#operationsList article').filter({ hasText: '누수·배관팀' }); await ops.getByRole('button', { name: '기한 지남 1건' }).click();
    assert.equal(await h.page.inputValue('#dueFilter'), 'late'); assert.equal(await h.page.locator('#taskList article').count(), 1); assert(h.page.url().endsWith('#team/t1')); await h.close();
  });
  await test('two isolated staff views complete start/report/rework/approval with immutable report history', async () => {
    const shared = { store: seed() }, worker = await harness({ role: 'member', shared }), lead = await harness({ role: 'lead', shared }); await worker.login(); await lead.login();
    await worker.page.getByRole('button', { name: '작업 시작', exact: true }).click(); assert.equal(worker.writes.length, 0); assert.equal(await worker.page.inputValue('#edit-status'), 'doing');
    await worker.page.fill('#edit-handoff', '연결부 점검 시작'); await worker.page.click('#save'); await worker.page.waitForFunction(() => !document.getElementById('editor').open);
    await worker.page.getByRole('button', { name: '검수 요청', exact: true }).click(); assert.equal(worker.writes.length, 1); await worker.page.fill('#edit-handoff', '보수 후 확인 요청'); await worker.page.click('#save'); await worker.page.waitForFunction(() => !document.getElementById('editor').open);
    await lead.page.click('#refresh'); await lead.page.click('#tabReview'); assert.equal(await lead.page.locator('#taskList article').count(), 1);
    await lead.page.getByRole('button', { name: '보완 요청', exact: true }).click(); assert.equal(lead.writes.length, 0); assert.equal(await lead.page.inputValue('#edit-handoff'), ''); await lead.page.fill('#edit-handoff', '연결부 재확인 필요'); await lead.page.click('#save'); await lead.page.waitForFunction(() => !document.getElementById('editor').open); assert.equal(await lead.page.locator('#taskList article').count(), 0);
    await worker.page.click('#refresh'); await worker.page.getByRole('button', { name: '검수 요청', exact: true }).click(); await worker.page.fill('#edit-handoff', '연결부 재확인 완료'); await worker.page.click('#save'); await worker.page.waitForFunction(() => !document.getElementById('editor').open);
    await lead.page.click('#refresh'); await lead.page.getByRole('button', { name: '완료 승인', exact: true }).click(); assert.equal(lead.writes.length, 1); await lead.page.click('#save'); await lead.page.waitForFunction(() => !document.getElementById('editor').open); assert.equal(shared.store.tasks[0].status, 'done');
    assert.deepEqual(shared.store.tasks[0].history.map(e => e.status), ['todo', 'doing', 'review', 'doing', 'review', 'done']); assert.equal(shared.store.tasks[0].history[0].baseline, true); assert.equal(shared.store.tasks[0].history[0].at, '2026-09-27T00:00:00Z');
    await worker.page.click('#refresh'); await openFilters(worker); await worker.page.selectOption('#statusFilter', 'done'); await worker.page.getByRole('button', { name: '완료 내용 보기' }).click(); assert(await worker.page.isHidden('#save')); assert(await worker.page.isDisabled('#edit-handoff')); await worker.page.click('#editorClose');
    await worker.page.getByText('작업 보고·처리 이력', { exact: true }).click(); assert((await worker.page.textContent('#taskList .history')).includes('연결부 재확인 필요')); assert.equal(await worker.page.locator('#taskList .history li').count(), 6);
    await worker.close(); await lead.close();
  });
  if (process.env.HJ_TEAM_PREVIEW) {
    const h = await harness(); await h.login(); await h.page.click('#tabTeams'); await h.page.locator('[data-team-id=t1] button').click();
    await h.page.evaluate(() => { const p=document.createElement('p');p.textContent='개발 미리보기 · 가상 직원/업무 자료입니다. 실제 서버는 아직 연결하지 않았습니다.';p.className='notice';document.getElementById('main').prepend(p); });
    await h.page.screenshot({ path: process.env.HJ_TEAM_PREVIEW, fullPage: true }); await h.close();
  }
  await browser.close(); console.log('company-team-ui: ' + count + '/' + count + ' PASS');
}
module.exports = { harness, seed, engine, clone, digest, setBrowser: value => { browser = value; } };
if (require.main === module && process.argv.includes('--mutations')) {
  const { spawnSync } = require('child_process'); let caught = 0;
  const names = ['allow-role-leak', 'persist-session', 'retry-new-id', 'team-filter', 'action-autosave', 'idle-no-logout', 'idle-no-warning', 'idle-no-extend', 'idle-touch-ghost', 'idle-text-literal'];
  for (const name of names) {
    const result = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_TEAM_UI_MUTATION: name }, timeout: 120000, encoding: 'utf8' });
    assert(!result.error, name + ': runner error ' + result.error); assert.notEqual(result.status, 0, name + ' survived'); assert((result.stdout + result.stderr).includes('FAIL company-team-ui:'), name + ': did not reach assertions'); console.log('DETECTED ' + name); caught++;
  }
  console.log('company-team-ui mutations: ' + caught + '/' + names.length + ' detected');
} else if (require.main === module) run().catch(async e => { console.error('FAIL company-team-ui:', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });

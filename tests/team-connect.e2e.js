/* v333 직원 작업실 실제 운영 연결 — 서버 주소 설정·연결 확인, 권한 점검(대표)·내 권한 확인(모든 역할),
   현장 앱 → 직원 작업실 초안 전달. 가짜 서버·가짜 계정만 쓴다(실제 주소·토큰·전화번호 없음).
   변이: HJ_CONNECT_MUTATION=<이름> 으로 지키는 동작을 하나씩 되돌리면 이 검사가 떨어져야 한다(맨 아래 목록). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
let chromium; try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const ROOT = path.join(__dirname, '..'), APP = 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const API = 'https://script.google.com/macros/s/AKfyTEST_CONNECT_COMPANY/exec', PORTAL = 'https://script.google.com/macros/s/AKfyTEST_CONNECT_PORTAL/exec';
const OTHER = 'https://script.google.com/macros/s/AKfyTEST_NOT_COMPANY/exec', DOWN = 'https://script.google.com/macros/s/AKfyTEST_DOWN/exec', BARE = 'https://script.google.com/macros/s/AKfyTEST_NO_PROPS/exec';
const TOKEN = 'TEST_CONNECT_SESSION_NOT_REAL_'.padEnd(80, 'Z'), MUTANT = process.env.HJ_CONNECT_MUTATION || '';
const b64 = x => crypto.createHash('sha256').update(x).digest('base64url');
function engineFrom(pureMutate) {
  const e = vm.createContext({ console, companyDigest_: x => crypto.createHash('sha256').update(x).digest('hex') });
  for (const f of ['TeamPure.gs', 'TeamProjects.gs', 'TeamEvidence.gs']) { let src = fs.readFileSync(path.join(ROOT, 'apps-script-team-ops', f), 'utf8'); if (pureMutate && f === 'TeamPure.gs') src = pureMutate(src); vm.runInContext(src, e); }
  return e;
}
const engine = engineFrom(), drifted = engineFrom(src => src.replace("function teamCanSee_(m,t) { return m.role==='owner' || (m.role==='lead' ? m.teamIds.indexOf(t.teamId)>=0 : t.assigneeId===m.id); }", "function teamCanSee_(m,t) { return m.role!=='member' || t.assigneeId===m.id; }"));
assert.equal(drifted.teamCanSee_({ role: 'lead', teamIds: [], id: 'x' }, { teamId: 'y' }), true, 'drifted server engine prepared');
// 두 번째 어긋난 서버: 업무 범위는 맞지만 남의 팀·동료 식별정보·변경 이력을 흘린다(teamPresent_ 만 바뀜).
const leakSwap = (src, a, b) => { assert(src.includes(a), 'leak anchor missing: ' + a); return src.replace(a, b); };
const leaky = engineFrom(src => [["var teams=s.teams.filter(function(t){return m.role==='owner'||m.teamIds.indexOf(t.id)>=0;});", 'var teams=s.teams.slice();'],
  ["if(m.role==='owner'){out.userId=u.userId;out.officeId=u.officeId;}", 'out.userId=u.userId;out.officeId=u.officeId;'],
  ["audit:m.role==='owner'?s.audit.slice(-100).reverse():[]", 'audit:s.audit.slice(-100).reverse()']].reduce((x, [a, b]) => leakSwap(x, a, b), src));
const clone = x => JSON.parse(JSON.stringify(x));
function seed() {
  return { schema: 1, revision: 3, requests: [], audit: [{ at: '2026-09-27T00:00:00Z', actorId: 'owner', action: 'teamSave', targetId: 't1', kind: 'team', revision: 1 }],
    teams: [{ id: 't1', name: '누수·배관팀', active: true }, { id: 't2', name: '인테리어팀', active: true }, { id: 't3', name: '관리사무소 대응팀', active: true }],
    members: [
      { id: 'owner', userId: 'TEST_OWNER_USER', officeId: 'TEST_OFFICE', name: '대표모의', role: 'owner', active: true, teamIds: ['t1'] },
      { id: 'lead', userId: 'TEST_LEAD_USER', officeId: 'TEST_OFFICE', name: '김팀장모의', role: 'lead', active: true, teamIds: ['t2'] },
      { id: 'member', userId: 'TEST_MEMBER_USER', officeId: 'TEST_OFFICE', name: '박직원모의', role: 'member', active: true, teamIds: ['t1'] },
      { id: 'external', userId: 'TEST_EXTERNAL_USER', officeId: 'TEST_OFFICE', name: '외주모의', role: 'external', active: true, teamIds: ['t2'] },
      { id: 'gone', userId: 'TEST_GONE_USER', officeId: 'TEST_OFFICE', name: '퇴사모의', role: 'member', active: false, teamIds: [] }
    ], tasks: [
      { id: 'a1', title: '배관 모의 1', project: '모의 현장 A', teamId: 't1', assigneeId: 'member', due: '', status: 'todo', handoff: '', sourceRef: '', updatedAt: '2026-09-27T00:00:00Z', updatedBy: 'owner' },
      { id: 'b1', title: '마감 모의 1', project: '모의 현장 B', teamId: 't2', assigneeId: 'external', due: '', status: 'doing', handoff: '', sourceRef: '', updatedAt: '2026-09-27T00:00:00Z', updatedBy: 'owner' },
      { id: 'b2', title: '마감 모의 2', project: '모의 현장 B', teamId: 't2', assigneeId: 'lead', due: '', status: 'todo', handoff: '', sourceRef: '', updatedAt: '2026-09-27T00:00:00Z', updatedBy: 'owner' }
    ] };
}
function mutateUi(name, content) {
  if (name !== 'team-ui.js') return content;
  const swap = (a, b) => { assert(content.includes(a), 'mutation anchor missing: ' + MUTANT); return content.replace(a, b); };
  if (MUTANT === 'save-unchecked') return swap('const health = await healthOf(url, epoch); if (epoch !== state.epoch) return;\n      let stored', 'const health = { portalUrl: ' + JSON.stringify(PORTAL) + ' };\n      let stored');
  if (MUTANT === 'device-overrides-config') return swap('let apiUrl = configFixed ? configUrl : deviceUrl();', 'let apiUrl = deviceUrl() || configUrl;');
  if (MUTANT === 'expect-from-server') return swap('const want = expectRule.tasks(m, list.tasks), match = d.visibleTasks === want.length && d.visibleTaskDigest === await idsDigest(want);', 'const want = expectRule.tasks(m, list.tasks), match = true;');
  if (MUTANT === 'self-probe-skip') return swap("try { await api('companyDiagnose'); if (epoch", "try { fail('forbidden'); if (epoch");
  if (MUTANT === 'owner-button-all') return swap("$('ownerCheck').hidden = !owner;", "$('ownerCheck').hidden = false;");
  if (MUTANT === 'handoff-autosave') return swap("state.imports = h.tasks; dropHandoff();", "state.imports = h.tasks; dropHandoff(); api('taskSave', { requestId: crypto.randomUUID(), revision: state.data.revision, entity: { id: '', title: h.tasks[0].title, project: h.tasks[0].project, teamId: state.data.teams[0].id, assigneeId: state.data.me.id, due: '', status: 'todo', handoff: '', sourceRef: h.tasks[0].sourceRef } }).catch(() => {});");
  if (MUTANT === 'handoff-keep') return swap('state.imports = h.tasks; dropHandoff();', 'state.imports = h.tasks;');
  if (MUTANT === 'handoff-stale') return swap('Date.now() - v.at > HANDOFF_TTL ||', '');
  if (MUTANT === 'handoff-member') return swap("function handoffAllowed() { return !!state.data && state.data.me.role === 'owner' && assignableTeams().length > 0; }", "function handoffAllowed() { return !!state.data; }");
  if (MUTANT === 'handoff-lead') return swap("state.data.me.role === 'owner' && assignableTeams()", "assignableTeams()");
  if (MUTANT === 'handoff-malformed-silent') return swap('if (!expired) state.handoffLost = true;', 'if (false) state.handoffLost = true;');
  if (MUTANT === 'checking-stuck') return swap("state.checking = false; $('selfCheck').disabled = false; $('ownerCheck').disabled = false; $('accessStatus')", "$('accessStatus')");
  if (MUTANT === 'self-foreign-teams') return swap("rows.push([foreignTeams.length ? 'bad' : 'ok'", "rows.push([false ? 'bad' : 'ok'");
  if (MUTANT === 'self-peer-ids') return swap("rows.push([ids.length ? 'bad' : 'ok'", "rows.push([false ? 'bad' : 'ok'");
  if (MUTANT === 'self-audit') return swap("rows.push([Array.isArray(raw.audit) && raw.audit.length ? 'bad' : 'ok'", "rows.push([false ? 'bad' : 'ok'");
  return content;
}
let browser, count = 0;
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name); }
async function harness(options = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  const h = { context, store: clone(options.store || seed()), role: options.role || 'owner', calls: [], writes: [], errors: [], diagOpen: !!options.diagOpen, oldServer: !!options.oldServer, drift: !!options.drift, opened: [], hangDiagnose: !!options.hangDiagnose };
  if (options.shared) Object.defineProperty(h, 'store', { get: () => options.shared.store, set: v => { options.shared.store = v; } });
  const identity = () => ({ userId: h.store.members.find(m => m.id === h.role)?.userId || 'TEST_UNLINKED', officeId: 'TEST_OFFICE' });
  if (options.init) await context.addInitScript(options.init);
  await context.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  await context.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url.startsWith(ORIGIN + '/')) {
      const name = new URL(url).pathname.slice(1);
      if (['team.html', 'team-ui.js', 'team-projects.js', 'team-packet.js', 'team-config.js'].includes(name)) {
        let content = name === 'team-config.js' ? 'window.HJ_TEAM_CONFIG=Object.freeze({apiUrl:' + JSON.stringify(options.config || '') + '});' : fs.readFileSync(path.join(ROOT, name), 'utf8');
        content = mutateUi(name, content);
        return route.fulfill({ status: 200, contentType: name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8', body: content });
      }
      if (name === 'operations-review.js' && ['index-standalone-blank', 'index-filter-ctrl'].includes(MUTANT)) {
        let text = fs.readFileSync(path.join(ROOT, name), 'utf8'); const a = MUTANT === 'index-standalone-blank' ? "if(hjTeamPortalSameWindow()){location.assign('./team.html#mine');return;}" : '!/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]/.test(v),seen=new Set();';
        assert(text.includes(a), 'mutation anchor missing: ' + MUTANT);
        text = text.replace(a, MUTANT === 'index-standalone-blank' ? '' : 'true,seen=new Set();');
        return route.fulfill({ contentType: 'text/javascript', body: text });
      }
      if (name === 'operations-review.js' && MUTANT === 'index-autosend') {
        let text = fs.readFileSync(path.join(ROOT, name), 'utf8'); assert(text.includes('hjCompanyHandoffPending();\n  if(!confirm('));
        text = text.replace('hjCompanyHandoffPending();\n  if(!confirm(', 'hjCompanyHandoffPending();\n  if(false&&!confirm(');
        return route.fulfill({ contentType: 'text/javascript', body: text });
      }
      return route.continue();
    }
    if (![API, PORTAL, OTHER, DOWN, BARE].includes(url)) return route.abort();
    if (url === DOWN) return route.abort('failed');
    const body = JSON.parse(request.postData() || '{}'); h.calls.push({ url, action: body.action });
    let result;
    try {
      if (url === API && body.action === 'companyDiagnose' && h.hangDiagnose) { h.hangDiagnose = false; await new Promise(r => { h.releaseDiagnose = r; }); }
      if (url === OTHER) result = { service: 'photo-relay', portalUrl: PORTAL };
      else if (url === BARE) throw new Error('not-configured');
      else if (url === PORTAL) result = body.action === 'portalLogin' ? { sessionToken: TOKEN, expiresAt: Date.now() + 3600000 } : {};
      else if (body.action === 'health') result = { service: 'company-team-v3', portalUrl: PORTAL };
      else {
        assert.equal(body.sessionToken, TOKEN);
        const eng = h.drift ? drifted : h.leakNow ? leaky : engine;
        if (body.action === 'identity') result = { identity: identity() };
        else if (body.action === 'list') result = { data: clone(eng.teamPresent_(h.store, identity())) };
        else if (body.action === 'companyDiagnose') {
          // Same gate order as Code.gs: authenticate member, then owner-only, then read-only diagnosis.
          if (h.oldServer) throw new Error('invalid-action');
          const me = eng.teamMember_(h.store, identity()); if (me.role !== 'owner' && !h.diagOpen) throw new Error('forbidden');
          if (body.payload !== undefined) throw new Error('invalid-input');
          result = { diagnosis: { ...clone(eng.teamDiagnose_(h.store, 'TEST_OFFICE', b64)), service: 'company-team-v3', authorityBound: true, properties: { COMPANY_ENABLED: true, COMPANY_PORTAL_URL: true, COMPANY_FOLDER_ID: true, COMPANY_OFFICE_ID: true, COMPANY_HEAD: true, COMPANY_OWNER_USER_ID: false, COMPANY_OWNER_NAME: !!options.leftover } } };
        } else {
          h.writes.push(clone(body));
          const out = engine.teamApply_(h.store, identity(), body.action, body.payload, new Date().toISOString(), crypto.randomUUID(), (x => crypto.createHash('sha256').update(x).digest('hex')));
          h.store = clone(out.store); result = { data: clone(engine.teamPresent_(h.store, identity())), replayed: out.replayed };
        }
      }
      result.ok = true;
    } catch (e) { result = { ok: false, error: e.message }; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(result) }).catch(() => {});
  });
  h.team = async (page) => {
    page = page || await context.newPage(); page.setDefaultTimeout(7000); page.on('pageerror', e => h.errors.push(String(e)));
    page.on('dialog', d => { (h.dialogs = h.dialogs || []).push(d.message()); return h.declineNext ? (h.declineNext = false, d.dismiss()) : d.accept(); });
    await page.goto(ORIGIN + '/team.html'); return page;
  };
  h.login = async (page) => {
    await page.waitForFunction(() => !document.getElementById('loginButton').disabled);
    await page.fill('#officeCode', 'test-office'); await page.fill('#email', 'staff@example.invalid'); await page.fill('#loginCode', 'TEST_PASSWORD'); await page.click('#loginButton');
    await page.waitForFunction(() => !document.getElementById('workspace').hidden);
  };
  h.close = async () => { assert.deepEqual(h.errors, [], 'no page errors'); await context.close(); };
  return h;
}
const rowsOf = (page, sel) => page.locator(sel + ' li').evaluateAll(ns => ns.map(n => [n.className, n.textContent]));
async function ownerCheck(page) {
  await page.click('#tabAccess'); await page.click('#ownerCheck');
  await page.waitForFunction(() => document.getElementById('accessStatus').textContent.includes('마쳤') || document.getElementById('accessStatus').textContent.includes('버전') || document.getElementById('accessStatus').textContent.includes('확인하지'));
}
async function selfCheck(page) {
  await page.click('#tabAccess'); await page.click('#selfCheck');
  await page.waitForFunction(() => /확인했습니다|확인하지/.test(document.getElementById('accessStatus').textContent) || document.getElementById('connection').textContent.includes('닫았습니다'));
}
async function run() {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  await test('연결 설정: 형식·다른 서버·속성 누락·연결 실패는 사람 말로, 저장하지 않는다', async () => {
    const h = await harness(), page = await h.team();
    assert(await page.locator('#connectBox').evaluate(el => el.open), '주소가 없으면 설정 칸이 열려 있다');
    assert(await page.isDisabled('#loginButton')); assert.equal(h.calls.length, 0, '주소 없이는 요청 0');
    const attempt = async (url, expect) => {
      await page.fill('#apiUrlInput', url); await page.click('#apiSave');
      await page.waitForFunction(t => document.getElementById('connectMessage').textContent.includes(t), expect);
      assert.equal(await page.evaluate(() => localStorage.getItem('hj_team_api_url')), null, url + ' 는 저장되면 안 된다'); assert(await page.isDisabled('#loginButton'));
    };
    await attempt('https://script.google.com/macros/s/AKfyTEST/dev', '/exec'); assert.equal(h.calls.length, 0, '형식이 틀리면 요청 0');
    await attempt(OTHER, 'company-team-v3'); await attempt(BARE, 'COMPANY_ENABLED'); await attempt(DOWN, '모든 사용자');
    assert(!(await page.textContent('#connectMessage')).includes('AKfyTEST_DOWN'), '실패 안내에 주소 원문을 늘어놓지 않는다');
    await page.fill('#apiUrlInput', '  ' + API + '  '); await page.click('#apiSave'); await page.waitForFunction(() => document.getElementById('connectMessage').textContent.includes('연결됐습니다'));
    assert.equal(await page.evaluate(() => localStorage.getItem('hj_team_api_url')), API); assert(!(await page.isDisabled('#loginButton')));
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('hj_team') || k.includes('session') || k.includes('token')).join()), 'hj_team_api_url', '주소 말고는 저장하지 않는다');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '360px 넘침 없음');
    // 새로 열면 저장한 주소로 health 를 다시 확인하고 로그인 칸이 열린다
    const again = await h.team(); await again.waitForFunction(() => !document.getElementById('loginButton').disabled);
    assert.equal(await again.inputValue('#apiUrlInput'), API);
    await h.login(again); assert.equal(await again.evaluate(() => localStorage.getItem('hj_team_api_url')), API);
    assert(!(await again.evaluate(() => JSON.stringify(localStorage))).includes(TOKEN), '세션 토큰은 저장하지 않는다');
    await again.click('#logout'); await again.waitForFunction(() => !document.getElementById('loginPanel').hidden);
    await again.locator('#connectBox > summary').click(); h.declineNext = true; await again.click('#apiClear'); assert.equal(await again.evaluate(() => localStorage.getItem('hj_team_api_url')), API, '확인 취소면 안 지운다');
    await again.click('#apiClear'); await again.waitForFunction(() => document.getElementById('loginButton').disabled);
    assert.equal(await again.evaluate(() => localStorage.getItem('hj_team_api_url')), null);
    await h.close();
  });

  await test('배포 설정 주소가 있으면 그 주소가 이기고 입력칸은 숨는다', async () => {
    const h = await harness({ config: API, init: () => { try { localStorage.setItem('hj_team_api_url', 'https://script.google.com/macros/s/AKfyTEST_NOT_COMPANY/exec'); } catch (_) {} } }), page = await h.team();
    await page.waitForFunction(() => !document.getElementById('loginButton').disabled);
    assert.deepEqual(h.calls.map(c => c.url), [API], '기기 주소가 아니라 배포 설정 주소로만 확인');
    assert(await page.isHidden('#apiUrlInput')); assert((await page.textContent('#connectFixed')).includes('team-config.js'));
    await h.close();
  });

  await test('대표 권한 점검: 역할마다 실제 서버 결과와 규칙이 맞으면 ✓, 값은 숨김, 쓰기 0', async () => {
    const h = await harness({ config: API }), page = await h.team(); await h.login(page); await ownerCheck(page);
    assert((await page.textContent('#accessSummary')).startsWith('문제 없음'), await page.textContent('#accessSummary'));
    const lead = await rowsOf(page, '[data-access-group=lead]');
    assert(lead.some(([k, t]) => k === 'ok' && t.includes('자기 팀(인테리어팀) 업무 2건만 본다')), JSON.stringify(lead));
    assert(lead.some(([k, t]) => k === 'ok' && t.includes('배정·완료 승인: 인테리어팀')));
    const ext = await rowsOf(page, '[data-access-group=external]');
    assert(ext.some(([k, t]) => k === 'ok' && t.includes('자기에게 배정된 업무 1건만 본다'))); assert(ext.some(([k, t]) => k === 'ok' && t.includes('배정·완료 승인 권한 없음')));
    assert(ext.some(([k, t]) => k === 'ok' && t.includes('동료 계정 식별정보')));
    const owner = await rowsOf(page, '[data-access-group=owner]'); assert(owner.some(([k, t]) => k === 'ok' && t.includes('회사 업무 3건 전체')));
    const gone = await rowsOf(page, '[data-access-group=gone]'); assert(gone.some(([k, t]) => k === 'ok' && t.includes('비활성')));
    const cfg = await rowsOf(page, '[data-access-group=config]');
    assert(cfg.some(([k, t]) => k === 'ok' && t.startsWith('COMPANY_FOLDER_ID 있음'))); assert(cfg.some(([k, t]) => k === 'warn' && t.includes('관리사무소 대응팀')), '소속 직원 없는 팀은 확인 필요로');
    const text = await page.textContent('#accessResult');
    for (const raw of ['TEST_OFFICE', 'TEST_LEAD_USER', PORTAL, API, TOKEN]) assert(!text.includes(raw), '점검 화면에 원문 값: ' + raw);
    assert.deepEqual(h.writes, [], '점검은 아무것도 저장하지 않는다'); assert(h.calls.some(c => c.action === 'companyDiagnose'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '360px 넘침 없음');
    await h.close();
  });

  await test('서버가 규칙에서 벗어나면(팀장이 남의 팀을 봄) 대표 점검이 ✗ 로 잡는다', async () => {
    const h = await harness({ config: API, drift: true, leftover: true }), page = await h.team(); await h.login(page); await ownerCheck(page);
    assert((await page.textContent('#accessSummary')).startsWith('문제'), await page.textContent('#accessSummary'));
    const lead = await rowsOf(page, '[data-access-group=lead]'); assert(lead.some(([k, t]) => k === 'bad' && t.includes('서버는 3건')), JSON.stringify(lead));
    const cfg = await rowsOf(page, '[data-access-group=config]'); assert(cfg.some(([k, t]) => k === 'warn' && t.startsWith('COMPANY_OWNER_NAME 가 남아')));
    await h.close();
  });

  await test('옛 서버(진단 없음)는 다시 배포하라고 말하고 아무것도 꾸미지 않는다', async () => {
    const h = await harness({ config: API, oldServer: true }), page = await h.team(); await h.login(page); await ownerCheck(page);
    assert((await page.textContent('#accessStatus')).includes('새 버전')); assert.equal(await page.locator('#accessResult li').count(), 0); await h.close();
  });

  await test('내 권한 확인: 팀장·직원·외주는 볼 수 없는 것을 못 보고, 대표 전용 점검은 서버가 거절한다', async () => {
    for (const [role, scope] of [['lead', '모두 내 팀 업무'], ['member', '모두 나에게 배정된 일'], ['external', '모두 나에게 배정된 일']]) {
      const h = await harness({ config: API, role }), page = await h.team(); await h.login(page);
      await selfCheck(page); const rows = await rowsOf(page, '#accessResult');
      assert(await page.isVisible('#selfCheck') && await page.isHidden('#ownerCheck'), role + ' 에게 대표 점검 버튼 없음');
      assert(rows.every(([k]) => k !== 'bad'), role + ': ' + JSON.stringify(rows));
      assert(rows.some(([k, t]) => k === 'ok' && t.includes(scope)));
      assert(rows.some(([k, t]) => k === 'ok' && t.includes('대표 전용 권한 점검은 서버가 거절한다')));
      assert(rows.some(([k, t]) => k === 'ok' && t.includes('변경 이력을 받지 않는다')));
      assert(h.calls.some(c => c.action === 'companyDiagnose'), '서버에 실제로 물어본다'); assert.deepEqual(h.writes, []);
      await h.close();
    }
    const o = await harness({ config: API }), page = await o.team(); await o.login(page); await selfCheck(page);
    assert((await rowsOf(page, '#accessResult')).some(([k, t]) => k === 'ok' && t.includes('서버가 허용한다'))); await o.close();
  });

  await test('대표 전용 점검을 서버가 직원에게 열어 주면 내 권한 확인이 ✗', async () => {
    const h = await harness({ config: API, role: 'member', diagOpen: true }), page = await h.team(); await h.login(page); await selfCheck(page);
    assert((await rowsOf(page, '#accessResult')).some(([k, t]) => k === 'bad' && t.includes('열어 줬다'))); assert((await page.textContent('#accessSummary')).startsWith('문제'));
    await h.close();
  });

  await test('현장 앱: 서버가 연결된 기기에서만 「초안 보내기」, 확인 뒤 전달함에만 넣고 자동 등록 없음', async () => {
    const h = await harness({ config: API, init: () => { if (location.pathname.endsWith('/index.html')) { try { localStorage.setItem('hj_team_api_url', 'https://script.google.com/macros/s/AKfyTEST_CONNECT_COMPANY/exec'); } catch (_) {} } } });
    const app = await h.context.newPage(); app.setDefaultTimeout(15000); app.on('pageerror', e => h.errors.push(String(e)));
    const dialogs = []; app.on('dialog', d => { dialogs.push(d.message()); return d.accept(); });
    await app.goto(APP, { waitUntil: 'domcontentloaded' });
    await app.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && typeof hjCompanyLegacySend === 'function');
    await app.evaluate(async () => {
      await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone, window.__hjRelayBootDone]);
      taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const team = (id, title, status) => ({ id, text: '[팀 업무]', todo: true, done: status === 'done', project: '모의 현장 A', teamTask: { schema: 1, title, assignee: '', status, due: '', handoff: '', recorder: '', updatedAt: '2026-09-27T00:00:00Z' } });
      state.notes = [team('n1', '모의 배관 점검', 'todo'), team('n2', '모의 실리콘', 'doing'), team('n3', '끝난 모의', 'done'), team('n4', '', 'todo')];
      window.__opened = []; window.open = (...a) => { __opened.push(a); return null; };
      hjTeamBoard();
    });
    assert(await app.isVisible('#teamDraftSend')); assert.equal(await app.getAttribute('#teamPortalOpen', 'href'), './team.html');
    await app.click('#teamDraftSend');
    await app.waitForFunction(() => !!localStorage.getItem('hj_company_drafts_handoff'));
    assert(dialogs.at(-1).includes('2건') && dialogs.at(-1).includes('1건은 빼고'), '사람 확인 창이 건수·뺀 건수를 말한다: ' + dialogs.at(-1));
    const handed = await app.evaluate(() => JSON.parse(localStorage.getItem('hj_company_drafts_handoff')));
    assert.equal(handed.format, 'company-task-drafts-v1'); assert.deepEqual(handed.tasks.map(t => t.sourceRef), ['legacy-team:n1', 'legacy-team:n2']);
    assert.deepEqual(await app.evaluate(() => __opened.map(a => a[0])), ['./team.html']);
    assert.equal(h.calls.length, 0, '현장 앱은 서버를 부르지 않는다');
    // 주소가 없는 기기: 보내기 버튼 대신 기존 내려받기와 안내
    await app.evaluate(() => { localStorage.removeItem('hj_team_api_url'); closeModal(); hjTeamBoard(); });
    assert.equal(await app.locator('#teamDraftSend').count(), 0); assert((await app.textContent('#teamBoard')).includes('서버 연결 설정'));

    // 직원 작업실(대표): 전달함을 보여 주고, 사람이 한 건씩 배정해 저장해야 서버에 올라간다
    const staff = await h.team(); await h.login(staff);
    assert(await staff.isVisible('#handoffBox')); assert((await staff.textContent('#handoffText')).includes('2건'));
    assert.deepEqual(h.writes, [], '불러오기 전 서버 쓰기 0');
    await staff.click('#handoffLoad'); await staff.getByRole('button', { name: '배정 초안 열기' }).first().waitFor();
    assert.equal(await staff.evaluate(() => localStorage.getItem('hj_company_drafts_handoff')), null, '한 번 불러오면 전달함을 비운다');
    assert.equal(await staff.locator('#importList .row').count(), 2); assert(await staff.isHidden('#handoffBox'));
    assert.deepEqual(h.writes, [], '불러와도 자동 저장 없음');
    await staff.getByRole('button', { name: '배정 초안 열기' }).first().click(); assert.equal(await staff.inputValue('#edit-title'), '모의 배관 점검'); assert.deepEqual(h.writes, []);
    await staff.selectOption('#edit-teamId', 't1'); await staff.selectOption('#edit-assigneeId', 'member'); await staff.click('#save'); await staff.waitForFunction(() => !document.getElementById('editor').open);
    assert.equal(h.writes.length, 1); assert.equal(h.writes[0].action, 'taskSave'); assert.equal(h.store.tasks.at(-1).sourceRef, 'legacy-team:n1');
    await h.close();
  });

  await test('전달함: 직원 계정엔 안 보이고 지우지 않음, 하루 지난 초안은 버린다', async () => {
    const drafts = { format: 'company-task-drafts-v1', tasks: [{ title: '모의 초안', project: '모의 현장 A', due: '', handoff: '', sourceRef: 'legacy-team:x1' }] };
    const m = await harness({ config: API, role: 'member', init: `localStorage.setItem('hj_company_drafts_handoff', ${JSON.stringify(JSON.stringify({ ...drafts, at: Date.now() }))})` });
    const mp = await m.team(); await m.login(mp); assert(await mp.isHidden('#handoffBox'), '배정 권한 없는 직원에게는 안 보인다');
    assert.notEqual(await mp.evaluate(() => localStorage.getItem('hj_company_drafts_handoff')), null, '대표가 볼 초안을 지우지 않는다'); await m.close();
    const old = await harness({ config: API, init: `localStorage.setItem('hj_company_drafts_handoff', ${JSON.stringify(JSON.stringify({ ...drafts, at: Date.now() - 25 * 3600000 }))})` });
    const op = await old.team(); await old.login(op); assert(await op.isHidden('#handoffBox'), '하루 지난 초안은 안 보인다');
    assert.equal(await op.evaluate(() => localStorage.getItem('hj_company_drafts_handoff')), null, '하루 지난 초안은 지운다');
    assert(await op.isHidden('#handoffBox'), '하루 지난 초안은 조용히 버린다'); await old.close();
    // 팀장: 배정 권한은 있지만 모든 팀 현장명이 든 전달함은 대표 계정에만 — 보이지도 지워지지도 않는다
    const l = await harness({ config: API, role: 'lead', init: `localStorage.setItem('hj_company_drafts_handoff', ${JSON.stringify(JSON.stringify({ ...drafts, at: Date.now() }))})` });
    const lp = await l.team(); await l.login(lp); assert(await lp.isHidden('#handoffBox'), '팀장에게는 안 보인다');
    assert.notEqual(await lp.evaluate(() => localStorage.getItem('hj_company_drafts_handoff')), null, '팀장 로그인이 대표 초안을 지우지 않는다'); await l.close();
    // 형식이 틀린 묶음(제목에 제어문자)은 버리되 대표에게 버렸다고 말한다
    const bad = { format: 'company-task-drafts-v1', tasks: [{ title: '모의\u0007초안', project: '모의 현장 A', due: '', handoff: '', sourceRef: 'legacy-team:x2' }], at: Date.now() };
    const b = await harness({ config: API, init: `localStorage.setItem('hj_company_drafts_handoff', ${JSON.stringify(JSON.stringify(bad))})` });
    const bp = await b.team(); await b.login(bp);
    assert.equal(await bp.evaluate(() => localStorage.getItem('hj_company_drafts_handoff')), null);
    assert(await bp.isVisible('#handoffBox') && (await bp.textContent('#handoffText')).includes('읽지 못해 버렸습니다'), '버린 사실을 알린다');
    assert(await bp.isHidden('#handoffLoad'), '불러올 것이 없으면 불러오기 버튼도 없다'); await b.close();
  });

  await test('어긋난 서버가 남의 팀·동료 식별정보·변경 이력을 흘리면 내 권한 확인이 줄마다 ✗', async () => {
    for (const role of ['lead', 'member']) {
      // 로그인 읽기는 정상, 점검 때만 흘린다 — 변경 이력이 섞이면 화면 검증이 자료를 닫지만 ✗ 줄은 알림에 남아야 한다
      const h = await harness({ config: API, role }), page = await h.team(); await h.login(page); h.leakNow = true; await selfCheck(page);
      const text = (await rowsOf(page, '#accessResult')).filter(([k]) => k === 'bad').map(([, t]) => t).join('\n') + '\n' + await page.textContent('#connection');
      for (const want of ['소속이 아닌 팀', '계정 식별정보를 받았다', '변경 이력']) assert(text.includes(want), role + ' ✗ 줄 없음: ' + want + ' / ' + text);
      assert.deepEqual(h.writes, []); await h.close();
    }
  });

  await test('점검 중 로그아웃해도 다시 로그인하면 [내 권한 확인]·[전 직원 권한 점검]이 살아 있다', async () => {
    const h = await harness({ config: API, hangDiagnose: true }), page = await h.team(); await h.login(page);
    await page.click('#tabAccess'); await page.click('#selfCheck');
    await page.waitForFunction(() => document.getElementById('accessStatus').textContent.includes('확인하고 있습니다'));
    for (let i = 0; i < 100 && !h.releaseDiagnose; i++) await new Promise(r => setTimeout(r, 50)); assert(h.releaseDiagnose, '점검 요청이 서버에 걸려 있다');
    await page.click('#logout'); await page.waitForFunction(() => !document.getElementById('loginPanel').hidden); h.releaseDiagnose();
    await h.login(page); await page.click('#tabAccess');
    assert(!(await page.isDisabled('#selfCheck')) && !(await page.isDisabled('#ownerCheck')), '두 버튼이 풀려 있다');
    await selfCheck(page); assert((await page.textContent('#accessStatus')).includes('확인했습니다')); await h.close();
  });

  await test('설치 앱(홈 화면)으로 떠 있으면 새 창 대신 같은 화면에서 직원 작업실로 — 저장소가 갈리지 않게', async () => {
    const h = await harness({ config: API, init: () => {
      const orig = window.matchMedia.bind(window);
      window.matchMedia = q => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : orig(q);
      if (location.pathname.endsWith('/index.html')) { try { localStorage.setItem('hj_team_api_url', 'https://script.google.com/macros/s/AKfyTEST_CONNECT_COMPANY/exec'); } catch (_) {} }
    } });
    const app = await h.context.newPage(); app.setDefaultTimeout(15000); app.on('pageerror', e => h.errors.push(String(e)));
    const dialogs = []; app.on('dialog', d => { dialogs.push(d.message()); return d.accept(); });
    await app.goto(APP, { waitUntil: 'domcontentloaded' });
    await app.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && typeof hjCompanyLegacySend === 'function');
    await app.evaluate(async () => {
      await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone, window.__hjRelayBootDone]);
      taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const team = (id, title, handoff) => ({ id, text: '[팀 업무]', todo: true, done: false, project: '모의 현장 A', teamTask: { schema: 1, title, assignee: '', status: 'todo', due: '', handoff, recorder: '', updatedAt: '2026-09-27T00:00:00Z' } });
      // n2 의 인계 글에는 직원 작업실이 거절하는 제어문자 — 현장 앱이 미리 빼야 묶음 전체가 버려지지 않는다
      state.notes = [team('n1', '모의 배관 점검', '줄바꿈\n허용'), team('n2', '모의 제어문자', '모의\u0007벨')];
      window.__opened = []; window.open = (...a) => { __opened.push(a); return null; };
      hjTeamBoard();
    });
    assert.equal(await app.getAttribute('#teamPortalOpen', 'target'), null, '설치 앱에서는 링크도 새 창이 아니다');
    await app.click('#teamDraftSend'); await app.waitForURL(/\/team\.html#mine$/);
    assert(dialogs.some(d => d.includes('1건을 직원 작업실로') && d.includes('1건은 빼고')), JSON.stringify(dialogs));
    await h.login(app); assert(await app.isVisible('#handoffBox'), '같은 화면으로 옮긴 직원 작업실에 초안이 보인다');
    assert((await app.textContent('#handoffText')).includes('1건')); assert.deepEqual(h.writes, []);
    await h.close();
  });

  await browser.close(); console.log('team-connect: ' + count + '/' + count + ' PASS');
}
const MUTATIONS = ['save-unchecked', 'device-overrides-config', 'expect-from-server', 'self-probe-skip', 'owner-button-all', 'handoff-autosave', 'handoff-keep', 'handoff-stale', 'handoff-member', 'index-autosend',
  'handoff-lead', 'handoff-malformed-silent', 'checking-stuck', 'self-foreign-teams', 'self-peer-ids', 'self-audit', 'index-standalone-blank', 'index-filter-ctrl'];
if (require.main === module && process.argv.includes('--mutations')) {
  const { spawnSync } = require('child_process'); let caught = 0;
  for (const name of MUTATIONS) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, HJ_CONNECT_MUTATION: name }, timeout: 200000, encoding: 'utf8' });
    const out = r.stdout + r.stderr, ok = r.status !== 0 && out.includes('FAIL team-connect:') && !out.includes('mutation anchor missing');
    console.log((ok ? 'DETECTED ' : 'SURVIVED ') + name); if (ok) caught++;
  }
  console.log('team-connect mutations: ' + caught + '/' + MUTATIONS.length + ' detected'); if (caught !== MUTATIONS.length) process.exitCode = 1;
} else if (require.main === module) run().catch(async e => { console.error('FAIL team-connect:', e.stack); if (browser) await browser.close().catch(() => {}); process.exitCode = 1; });

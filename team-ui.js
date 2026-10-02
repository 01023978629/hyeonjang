/* Standalone company portal: no legacy scripts, shared token or offline writes. Sessions and passwords live in memory only.
 * The only device storage is the public server endpoint the owner typed (hj_team_api_url) and the one-time
 * draft hand-off the main app leaves for review (hj_company_drafts_handoff, removed once read, 24h limit). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const roles = { owner: '대표·관리자', lead: '팀장', member: '직원', external: '외주' };
  const statuses = { todo: '대기', doing: '진행', blocked: '막힘', review: '검수 요청', done: '완료' };
  const transitions = { todo: ['doing', 'blocked', 'review'], doing: ['blocked', 'review'], blocked: ['doing', 'review'], review: ['doing', 'done'], done: ['doing'] };
  const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const API_KEY = 'hj_team_api_url', HANDOFF_KEY = 'hj_company_drafts_handoff', HANDOFF_TTL = 24 * 3600000;
  const configUrl = typeof window.HJ_TEAM_CONFIG?.apiUrl === 'string' ? window.HJ_TEAM_CONFIG.apiUrl.trim() : '';
  const configFixed = endpointPattern.test(configUrl); // A deployed team-config.js always wins over a typed address.
  function deviceUrl() { try { const v = localStorage.getItem(API_KEY) || ''; return endpointPattern.test(v) ? v : ''; } catch (_) { return ''; } }
  let apiUrl = configFixed ? configUrl : deviceUrl();
  const state = { epoch: 0, token: '', portalUrl: '', identity: null, data: null, editor: null, imports: [], expiry: 0, timer: 0, reading: false, page: '', filters: {}, access: null, checking: false };
  const activeRequests = new Set();
  const errors = {
    'not-configured': '팀 업무 서버가 아직 설정되지 않았습니다. 대표가 별도 서버를 설정한 뒤 사용할 수 있습니다.',
    'configuration-mismatch': '회사 인증 서버 설정과 저장 자료가 다릅니다. 관리자 확인 전에는 수정할 수 없습니다.',
    'session-expired': '로그인 시간이 끝났거나 계정이 변경되었습니다. 다시 로그인해 주세요.',
    'invalid-credentials': '코드·이메일·비밀번호를 확인해 주세요.', 'rate-limited': '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    forbidden: '회사 팀 권한이 없거나 변경되었습니다. 관리자에게 권한 연결을 요청해 주세요.',
    conflict: '다른 직원이 먼저 수정했습니다. 작성한 내용은 유지됩니다. 최신 내용과 비교한 뒤 다시 검토해 주세요.',
    'request-conflict': '같은 요청 번호의 내용이 다릅니다. 최신 내용을 비교한 뒤 새 요청으로 검토해 주세요.',
    'invalid-input': '입력 형식과 필수 항목을 확인해 주세요.', 'invalid-team': '현재 사용 가능한 팀을 선택해 주세요.',
    'invalid-assignee': '선택한 팀의 활성 직원을 담당자로 지정해 주세요.', 'invalid-transition': '현재 단계에서 선택할 수 없는 상태입니다.',
    'invalid-project': '프로젝트의 담당 팀과 운영 상태를 확인하세요.', 'invalid-schedule': '작업일과 시작·종료 시간을 함께 입력하세요.', 'schedule-conflict': '같은 기술자의 일정이 겹칩니다. 시간 또는 담당자를 조정하세요.', 'evidence-bound': '사진이 있는 업무의 프로젝트는 변경할 수 없습니다.',
    'handoff-required': '막힘·검수 요청에는 이유 또는 인수인계 내용을 적어 주세요.',
    'review-note-required': '보완 요청 사유를 새로 적어 주세요. 이전 보고는 처리 이력에 남습니다.',
    duplicate: '같은 이름 또는 계정이 이미 등록되어 있습니다.', 'duplicate-source': '이 기존 업무는 이미 공유 업무로 등록되었습니다. 최신 자료를 확인해 주세요.',
    'team-in-use': '활성 직원이나 미완료 업무가 있는 팀은 비활성화할 수 없습니다.',
    'self-lockout': '자신의 관리자 권한·계정·활성 상태는 해제할 수 없습니다.', 'last-owner': '마지막 관리자는 해제할 수 없습니다.',
    'identity-immutable': '이미 연결한 계정의 식별정보는 바꿀 수 없습니다.', 'reassign-open-tasks': '먼저 남은 업무를 다른 담당자에게 배정해 주세요.',
    'not-found': '대상이 변경되었거나 없습니다. 최신 자료와 비교해 주세요.', capacity: '서버 보관 한도에 도달했습니다. 관리자에게 확인해 주세요.',
    'invalid-unit': '이 프로젝트에 등록된 동·호수 또는 공용부를 선택하세요.', 'unit-in-use': '업무에 연결된 위치는 바꿀 수 없습니다. 관리자 검토가 필요합니다.', 'ack-stale': '업무 배정이 바뀌었습니다. 최신 업무를 다시 확인한 뒤 수락하세요.',
    busy: '서버가 다른 요청을 처리 중입니다. 잠시 후 같은 내용으로 다시 확인해 주세요.',
    'auth-unavailable': '인증 서버에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.',
    'storage-failed': '서버 저장 결과를 확인하지 못했습니다. 같은 내용으로 재확인해 주세요.',
    corrupt: '서버 자료를 검증하지 못했습니다. 관리자 확인 전에는 수정할 수 없습니다.',
    network: '연결이 끊겨 결과를 확인하지 못했습니다. 저장 요청이라면 아래 버튼으로 같은 요청을 재확인해 주세요.',
    'bad-response': '서버 응답 형식을 확인하지 못했습니다. 저장 성공으로 처리하지 않았습니다.',
    'server-error': '서버가 요청을 완료하지 못했습니다. 잠시 후 결과를 다시 확인해 주세요.'
  };
  function fail(code) { const e = new Error(code); e.code = code; throw e; }
  function codeOf(e) { return String(e?.code || 'network').replace(/_/g, '-'); }
  function message(e) { return errors[codeOf(e)] || '처리 결과를 확인하지 못했습니다. 관리자에게 문의해 주세요.'; }
  function node(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text); if (cls) n.className = cls; return n; }
  function button(text, fn, cls) { const n = node('button', text, cls); n.type = 'button'; n.onclick = fn; return n; }
  function notice(text, error = false) { $('connection').textContent = text; $('connection').className = 'notice' + (error ? ' error' : ''); }
  function editorNotice(text, error = true) { $('editorMessage').hidden = !text; $('editorMessage').textContent = text; $('editorMessage').className = 'notice' + (error ? ' error' : ''); }
  function str(v, max = 2000, empty = true) { return typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v); }
  function id(v) { return str(v, 100, false) && !/[\x00-\x1f]/.test(v); }
  function unique(a) { return new Set(a).size === a.length; }
  function identityValid(v) { return v && id(v.userId) && id(v.officeId); }
  function validData(d) {
    if (!d || !Number.isSafeInteger(d.revision) || d.revision < 0 || !d.me || !id(d.me.id) || !Object.hasOwn(roles, d.me.role) || !str(d.me.name, 60, false) || !Array.isArray(d.me.teamIds)) return false;
    if (!['teams', 'members', 'tasks', 'audit'].every(k => Array.isArray(d[k])) || d.teams.length > 50 || d.members.length > 100 || d.tasks.length > 2000 || d.audit.length > 100) return false;
    if (!d.teams.every(t => t && id(t.id) && str(t.name, 60, false) && typeof t.active === 'boolean') || !unique(d.teams.map(t => t.id))) return false;
    if (!d.members.every(m => m && id(m.id) && str(m.name, 60, false) && Object.hasOwn(roles, m.role) && typeof m.active === 'boolean' && Array.isArray(m.teamIds) && m.teamIds.every(id))) return false;
    if (!unique(d.members.map(m => m.id)) || !d.members.some(m => m.id === d.me.id && m.active && m.role === d.me.role) || !d.me.teamIds.every(id)) return false;
    if (d.me.role === 'owner' && !d.members.every(m => id(m.userId) && id(m.officeId))) return false;
    if (!d.tasks.every(t => t && id(t.id) && str(t.title, 160, false) && str(t.project, 160, false) && id(t.teamId) && id(t.assigneeId) && Object.hasOwn(statuses, t.status) && str(t.due, 10) && (!t.due || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && str(t.handoff) && str(t.sourceRef, 150) && str(t.updatedAt, 40) && id(t.updatedBy)) || !unique(d.tasks.map(t => t.id))) return false;
    // Defense in depth: never render a task outside the authenticated member's projection.
    if (!d.tasks.every(t => d.me.role === 'owner' || (d.me.role === 'lead' ? d.me.teamIds.includes(t.teamId) : t.assigneeId === d.me.id))) return false;
    if (!d.tasks.every(t => t.history === undefined || Array.isArray(t.history) && t.history.length <= 100 && t.history.every(h => h && str(h.at, 40, false) && id(h.actorId) && Object.hasOwn(statuses, h.status) && str(h.handoff) && id(h.teamId) && id(h.assigneeId) && Number.isSafeInteger(h.revision) && h.revision >= 0 && typeof h.baseline === 'boolean'))) return false;
    if (d.me.role !== 'owner' && d.audit.length) return false;
    if (!d.tasks.every(t => (t.assignmentVersion === undefined || Number.isSafeInteger(t.assignmentVersion) && t.assignmentVersion >= 0 && t.assignmentVersion <= d.revision) && (t.acknowledgements === undefined || Array.isArray(t.acknowledgements) && t.acknowledgements.length <= 100 && t.acknowledgements.every(r => r && id(r.memberId) && str(r.at, 40, false) && Number.isSafeInteger(r.assignmentVersion) && r.assignmentVersion >= 0 && r.assignmentVersion <= d.revision)))) return false;
    return projectUI.valid(d) && d.audit.every(a => a && str(a.at, 40) && id(a.actorId) && ['teamSave', 'memberSave', 'taskSave', 'taskAcknowledge', 'projectSave', 'taskBatch', 'evidenceUpload', 'claimSave', 'claimReview', 'claimSubmitRecord'].includes(a.action) && id(a.targetId) && str(a.kind, 20) && Number.isSafeInteger(a.revision));
  }
  async function request(url, body, epoch = state.epoch) {
    if (!endpointPattern.test(url)) fail('not-configured');
    const controller = new AbortController(); activeRequests.add(controller);
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch(url, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body), signal: controller.signal });
      if (epoch !== state.epoch) fail('stale');
      if (!r.ok) fail('network');
      let result; try { result = await r.json(); } catch (_) { fail('bad-response'); }
      if (epoch !== state.epoch) fail('stale');
      if (!result || result.ok !== true) fail(typeof result?.error === 'string' ? result.error.replace(/_/g, '-') : 'bad-response');
      return result;
    } catch (e) { if (epoch !== state.epoch) fail('stale'); if (e.code) throw e; fail('network'); }
    finally { clearTimeout(timer); activeRequests.delete(controller); }
  }
  const api = (action, payload) => request(apiUrl, { action, sessionToken: state.token, ...(payload ? { payload } : {}) });
  function clearWorkspace() {
    projectUI.reset();
    state.data = null; state.imports = []; state.editor = null; $('workspace').hidden = true;
    if ($('editor').open) $('editor').close();
    ['taskList', 'orgList', 'auditList', 'importList', 'editorFields', 'conflictLatest', 'teamDirectory', 'teamSummary', 'projectSummary', 'memberWorkload', 'operationsList', 'accessResult'].forEach(k => $(k).replaceChildren());
    // A check still in flight when the session ends skips its finally (epoch moved), so the buttons are freed here.
    state.access = null; state.handoffLost = false; state.checking = false; $('selfCheck').disabled = false; $('ownerCheck').disabled = false; $('accessStatus').textContent = ''; $('handoffBox').hidden = true;
    $('importFile').value = ''; $('importNotice').textContent = ''; $('importPanel').hidden = true;
    state.page = ''; state.filters = {}; resetFilters();
    $('projectFilter').replaceChildren(new Option('모든 현장', '')); $('assigneeFilter').replaceChildren(new Option('모든 담당자', ''));
    $('teamScope').textContent = ''; $('pageTitle').textContent = '직원 작업실'; document.title = '현장 · 직원 작업실';
    $('taskStats').textContent = ''; $('lastRead').textContent = ''; editorNotice('');
    $('assignmentNotice').textContent = ''; $('assignmentNotice').hidden = true;
  }
  function endSession(text) {
    state.epoch++; activeRequests.forEach(c => c.abort()); activeRequests.clear(); clearTimeout(state.timer);
    state.token = ''; state.identity = null; state.expiry = 0; state.reading = false; clearWorkspace();
    history.replaceState(null, '', '#mine');
    $('identity').textContent = ''; $('who').textContent = ''; $('sessionPanel').hidden = true; $('loginPanel').hidden = false; $('loginForm').reset();
    $('refresh').disabled = false; loginEnabled(!!state.portalUrl); notice(text);
  }
  function loginEnabled(yes) { [...$('loginForm').elements].forEach(el => { el.disabled = !yes; }); }
  async function logout() {
    const token = state.token, url = state.portalUrl;
    endSession('이 기기에서 로그아웃했습니다.');
    if (token && url) { try { await request(url, { action: 'portalLogout', sessionToken: token }); } catch (e) { if (codeOf(e) !== 'stale') notice('이 기기에서는 로그아웃했습니다. 서버 세션 종료는 확인하지 못했습니다.', true); } }
  }
  function handleReadError(e) {
    if (codeOf(e) === 'stale') return;
    if (codeOf(e) === 'session-expired') { endSession(message(e)); return; }
    clearWorkspace(); $('who').textContent = '로그인됨 · 회사 권한 확인 필요';
    // Health passed and the portal accepted the login, so not-configured here means the company store was never created.
    notice(codeOf(e) === 'not-configured' && state.token ? '서버 연결과 로그인은 됐지만 회사 자료가 아직 만들어지지 않았습니다. Apps Script 편집기에서 companyBootstrapFromProperties_ 를 한 번 실행했는지 확인하세요(설치 절차서 7단계).' : message(e), true);
  }
  function acceptData(d) { if (!validData(d)) fail('bad-response'); state.data = d; render(); }
  async function read() {
    if (!state.token || state.reading) return;
    state.reading = true; $('refresh').disabled = true;
    try { const r = await api('list'); acceptData(r.data); notice('서버 자료를 확인했습니다. 수정은 저장 버튼을 누른 때에만 전송됩니다.'); }
    catch (e) { handleReadError(e); }
    finally { state.reading = false; $('refresh').disabled = false; }
  }
  async function login(e) {
    e.preventDefault(); if (!state.portalUrl) return;
    const epoch = state.epoch; loginEnabled(false); notice('계정과 회사 권한을 확인하고 있습니다.');
    const payload = { officeCode: $('officeCode').value.trim(), email: $('email').value.trim(), loginCode: $('loginCode').value };
    try {
      const r = await request(state.portalUrl, { action: 'portalLogin', payload }, epoch);
      if (typeof r.sessionToken !== 'string' || !/^[A-Za-z0-9_-]{64,256}$/.test(r.sessionToken) || !Number.isFinite(r.expiresAt) || r.expiresAt <= Date.now()) fail('bad-response');
      state.token = r.sessionToken; state.expiry = r.expiresAt; $('loginForm').reset();
      state.timer = setTimeout(() => endSession(errors['session-expired']), Math.min(2147483647, state.expiry - Date.now()));
      const me = await api('identity'); if (!identityValid(me.identity)) fail('bad-response');
      state.identity = { userId: me.identity.userId, officeId: me.identity.officeId };
      $('identity').textContent = 'userId: ' + state.identity.userId + '\nofficeId: ' + state.identity.officeId;
      $('loginPanel').hidden = true; $('sessionPanel').hidden = false; await read();
    } catch (err) { if (epoch !== state.epoch) return; endSession(message(err)); }
    finally { payload.loginCode = ''; if (epoch === state.epoch) { $('loginCode').value = ''; loginEnabled(!!state.portalUrl); } }
  }
  function canAssign(teamId) { return state.data && (state.data.me.role === 'owner' || state.data.me.role === 'lead' && state.data.me.teamIds.includes(teamId)); }
  function assignableTeams() { return state.data.teams.filter(t => t.active && canAssign(t.id)); }
  function memberName(idValue) { return state.data.members.find(m => m.id === idValue)?.name || '현재 권한 밖 직원'; }
  function teamName(idValue) { return state.data.teams.find(t => t.id === idValue)?.name || '현재 권한 밖 팀'; }
  const pages = { mine: ['내 업무', '내게 배정된 일을 시작하고 작업 내용을 보고합니다.'], planner: ['기술자 일정', '기술자별 현장·시간·진행 상태를 확인하고 최대 10건을 함께 배정합니다.'], projects: ['프로젝트 사진', '업무에 연결한 원본 사진을 프로젝트별로 모읍니다.'], claims: ['보험 제출 준비', '대표가 원본 증빙과 보수 내역을 검토하고 제출 자료를 준비합니다.'], teams: ['팀별 작업실', '팀의 현장·담당자별 업무를 관리합니다.'], review: ['검수·승인', '완료 보고를 확인한 뒤 승인하거나 보완을 요청합니다.'], operations: ['운영 관리', '팀별 업무량과 지연·막힘을 확인하고 담당 업무를 조정합니다.'], settings: ['직원·팀 설정', '소속 팀과 권한을 지정해 각자의 작업 공간을 연결합니다.'], audit: ['변경 이력', '서버가 기록한 변경 주체와 시각을 확인합니다.'], access: ['권한 점검', '로그인한 계정이 볼 수 있는 것과 없는 것을 서버에 직접 물어 확인합니다.'] };
  const navPages = { Tasks: 'mine', Planner: 'planner', Projects: 'projects', Teams: 'teams', Review: 'review', Claims: 'claims', Operations: 'operations', Org: 'settings', Audit: 'audit', Access: 'access' };
  const filterIds = ['projectFilter', 'assigneeFilter', 'statusFilter', 'dueFilter', 'search'];
  function currentTeam() { return state.page.startsWith('team/') ? state.data?.teams.find(t => t.id === state.page.slice(5)) : null; }
  function pageAllowed(page) {
    const me = state.data?.me; if (!me) return false;
    if (page.startsWith('team/')) return /^[A-Za-z0-9_-]{1,100}$/.test(page.slice(5)) && state.data.teams.some(t => t.id === page.slice(5));
    if (!Object.hasOwn(pages, page)) return false;
    if (['settings', 'audit', 'claims'].includes(page)) return me.role === 'owner';
    if (['review', 'operations'].includes(page)) return ['owner', 'lead'].includes(me.role);
    return true;
  }
  function resetFilters() { filterIds.forEach(k => $(k).value = k === 'statusFilter' ? 'open' : k === 'dueFilter' ? 'all' : ''); }
  function rememberFilters() { if (state.page) state.filters[state.page] = Object.fromEntries(filterIds.map(k => [k, $(k).value])); }
  function go(page, push = true) {
    if (!state.data) return;
    if (state.editor || projectUI.hasDraft()) { history.replaceState(null, '', '#' + state.page); notice('작성 중인 창을 먼저 저장하거나 닫아 주세요.'); editorNotice('작성 중인 업무를 먼저 저장하거나 닫아 주세요. 작성 내용은 유지됩니다.', false); return; }
    rememberFilters();
    if (!pageAllowed(page)) { page = 'mine'; notice('이 페이지의 접근 권한이 없어 내 업무로 이동했습니다.', true); }
    state.page = page;
    if (location.hash !== '#' + page) history[push ? 'pushState' : 'replaceState'](null, '', '#' + page);
    resetFilters(); renderPage();
    $('pageTitle').focus();
  }
  function baseTasks() {
    const d = state.data, team = currentTeam(); if (!d) return [];
    if (team) return d.tasks.filter(t => t.teamId === team.id);
    if (state.page === 'review') return d.tasks.filter(t => t.status === 'review' && canAssign(t.teamId));
    return d.tasks.filter(t => t.assigneeId === d.me.id);
  }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function late(t) { return t.status !== 'done' && !!t.due && t.due < today(); }
  function counts(tasks) { return { open: tasks.filter(t => t.status !== 'done').length, late: tasks.filter(late).length, blocked: tasks.filter(t => t.status === 'blocked').length, review: tasks.filter(t => t.status === 'review').length }; }
  function fillSelect(key, choices, label) {
    const selected = state.filters[state.page]?.[key] || ''; $(key).replaceChildren(new Option(label, ''));
    choices.forEach(([v, name]) => $(key).add(new Option(name, v)));
    if (choices.some(([v]) => v === selected)) $(key).value = selected;
  }
  function selectWork(teamId, filters = {}) {
    go('team/' + teamId); if (currentTeam()?.id !== teamId || state.editor) return;
    resetFilters(); Object.entries(filters).forEach(([k, v]) => { if (filterIds.includes(k)) $(k).value = v; }); rememberFilters(); renderTasks(); $('taskHeading').scrollIntoView({ block: 'start' });
  }
  function summaryButtons(root, tasks, teamId) {
    const c = counts(tasks); root.replaceChildren();
    [['미완료', c.open, {}], ['기한 지남', c.late, { dueFilter: 'late' }], ['막힘', c.blocked, { statusFilter: 'blocked' }], ['검수 대기', c.review, { statusFilter: 'review' }]].forEach(([label, value, filters]) => {
      const b = button('', () => selectWork(teamId, filters)); b.append(node('span', label), node('strong', value + '건')); root.append(b);
    });
  }
  function renderTeamSpaces() {
    const d = state.data; $('teamDirectory').replaceChildren(); $('operationsList').replaceChildren();
    d.teams.forEach(team => {
      const tasks = d.tasks.filter(t => t.teamId === team.id), c = counts(tasks), card = node('article', undefined, 'card');
      card.append(node('h3', team.name + (team.active ? '' : ' · 비활성')), node('p', '미완료 ' + c.open + ' · 검수 ' + c.review + ' · 막힘 ' + c.blocked, 'meta'), button('작업실 열기', () => go('team/' + team.id), 'primary'));
      card.dataset.teamId = team.id; $('teamDirectory').append(card);
      if (canAssign(team.id)) {
        const ops = node('article', undefined, 'card'), summary = node('div', undefined, 'work-summary'); ops.append(node('h3', team.name)); summaryButtons(summary, tasks, team.id); ops.append(summary, button('현장별 배정·담당자 조정', () => go('team/' + team.id))); $('operationsList').append(ops);
      }
    });
    if (!d.teams.length) $('teamDirectory').append(node('p', '소속 팀이 없습니다. 대표에게 팀 연결을 요청해 주세요.', 'notice'));
    const team = currentTeam(); $('projectSummary').replaceChildren(); $('memberWorkload').replaceChildren();
    if (!team) return;
    const tasks = baseTasks(); $('teamScope').textContent = canAssign(team.id) ? '이 팀의 업무 배정·담당자 조정·완료 검수를 관리합니다. 현장별 목록과 업무량은 아래에서 확인하세요.' : '이 팀에서 나에게 배정된 업무만 표시됩니다. 다른 직원의 업무·금액·사진 자료는 읽지 않습니다.';
    summaryButtons($('teamSummary'), tasks, team.id);
    [...new Set(tasks.map(t => t.project))].sort((a, b) => a.localeCompare(b, 'ko')).forEach(project => {
      const group = tasks.filter(t => t.project === project), c = counts(group), card = node('article', undefined, 'task');
      card.append(node('h3', project), node('p', '미완료 ' + c.open + ' · 검수 ' + c.review + ' · 완료 ' + group.filter(t => t.status === 'done').length, 'meta'), button('이 현장 업무 보기', () => selectWork(team.id, { projectFilter: project, statusFilter: 'all' }))); $('projectSummary').append(card);
    });
    if (!tasks.length) $('projectSummary').append(node('p', '아직 등록된 업무가 없습니다. 업무 배정 시 입력한 현장별로 표시됩니다.', 'muted'));
    d.members.filter(m => m.active && m.teamIds.includes(team.id)).forEach(m => $('memberWorkload').append(button(m.name + ' · 미완료 ' + tasks.filter(t => t.assigneeId === m.id && t.status !== 'done').length + '건', () => selectWork(team.id, { assigneeFilter: m.id }))));
  }
  function renderPage() {
    const d = state.data, team = currentTeam(), page = state.page, owner = d.me.role === 'owner', manager = ['owner', 'lead'].includes(d.me.role);
    const title = team ? team.name + ' 작업실' : pages[page][0]; $('pageTitle').textContent = title; document.title = title + ' · 현장'; $('pageIntro').textContent = team ? '현장별로 일을 배정하고, 담당자가 보고하고, 팀장이 마무리를 확인합니다.' : pages[page][1];
    Object.entries(navPages).forEach(([key, value]) => { const el = $('tab' + key); el.hidden = ['settings', 'audit', 'claims'].includes(value) ? !owner : ['review', 'operations'].includes(value) ? !manager : false; if (value === page || team && value === 'teams') el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('teamsPanel').hidden = page !== 'teams'; $('teamContext').hidden = !team; $('operationsPanel').hidden = page !== 'operations'; $('orgPanel').hidden = page !== 'settings'; $('auditPanel').hidden = page !== 'audit'; $('accessPanel').hidden = page !== 'access'; $('ownerCheck').hidden = !owner;
    $('tasksPanel').hidden = !team && !['mine', 'review'].includes(page); $('orgActions').hidden = !owner;
    $('taskHeading').textContent = team ? '현장별 담당 업무' : title;
    $('taskHint').textContent = page === 'review' ? '보고 내용과 처리 이력을 확인한 뒤 완료 승인 또는 보완 요청을 선택하세요. 승인 시에도 저장 버튼을 눌러야 반영됩니다.' : '작업 시작 → 진행 보고 → 검수 요청 → 완료 승인. 현장·담당자·기한으로 필요한 일만 골라 처리하세요.';
    $('newTask').hidden = page === 'review' || (team ? !team.active || !canAssign(team.id) : !assignableTeams().length); $('importButton').hidden = page === 'review' || !assignableTeams().length;
    const tasks = baseTasks(); fillSelect('projectFilter', [...new Set(tasks.map(t => t.project))].sort((a, b) => a.localeCompare(b, 'ko')).map(n => [n, n]), '모든 현장');
    const assignees = team && canAssign(team.id) ? d.members.filter(m => m.active && m.teamIds.includes(team.id)) : d.members.filter(m => tasks.some(t => t.assigneeId === m.id));
    fillSelect('assigneeFilter', assignees.map(m => [m.id, m.name]), '모든 담당자');
    ['statusFilter', 'dueFilter', 'search'].forEach(k => { if (state.filters[page]?.[k] !== undefined) $(k).value = state.filters[page][k]; });
    $('statusFilter').disabled = page === 'review'; if (page === 'review') $('statusFilter').value = 'review';
    renderTeamSpaces(); renderTasks(); if (owner) { renderOrg(); renderAudit(); } else { $('orgList').replaceChildren(); $('auditList').replaceChildren(); } renderImports(); renderHandoff(); renderAccess(); projectUI.render(page);
  }
  function render() {
    const d = state.data; if (!d) return;
    $('workspace').hidden = false; $('who').textContent = d.me.name + ' · ' + roles[d.me.role];
    $('lastRead').textContent = '조회 ' + new Date().toLocaleString('ko-KR') + ' · 자료 버전 ' + d.revision;
    const supported = d.capabilities?.includes('task-ack-v1'), waiting = d.tasks.filter(t => t.assigneeId === d.me.id && t.status !== 'done' && !assignmentReceipt(t)).length;
    $('assignmentNotice').hidden = false;
    $('assignmentNotice').textContent = supported ? (waiting ? '새 배정·변경 확인 필요 ' + waiting + '건 · 내 업무에서 내용을 확인하고 「업무 확인·수락」을 누르세요.' : d.tasks.some(t => t.assigneeId === d.me.id && t.status !== 'done') ? '현재 조회한 내 업무의 배정 확인이 끝났습니다.' : '현재 조회한 내 진행 업무가 없습니다.') : '이 서버는 업무 수락 기록을 지원하지 않습니다. 기존 업무 처리는 가능하며, 수락 기능은 별도 서버 업데이트 후 사용합니다.';
    rememberFilters(); const page = state.page || location.hash.slice(1) || 'mine'; state.page = pageAllowed(page) ? page : 'mine';
    history.replaceState(null, '', '#' + state.page); resetFilters(); renderPage();
  }
  function renderTasks() {
    const d = state.data; if (!d) return;
    const term = $('search').value.normalize('NFKC').toLocaleLowerCase().replace(/\s/g, '');
    const tasks = baseTasks().filter(t => (!$('projectFilter').value || t.project === $('projectFilter').value) && (!$('assigneeFilter').value || t.assigneeId === $('assigneeFilter').value) && ($('statusFilter').value === 'all' || ($('statusFilter').value === 'open' ? t.status !== 'done' : t.status === $('statusFilter').value)) && ($('dueFilter').value === 'all' || $('dueFilter').value === 'late' && late(t) || $('dueFilter').value === 'today' && t.status !== 'done' && t.due && t.due <= today() || $('dueFilter').value === 'none' && !t.due) && (t.project + t.title).normalize('NFKC').toLocaleLowerCase().replace(/\s/g, '').includes(term)).slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'ko'));
    $('taskStats').textContent = '선택한 조건 ' + tasks.length + '건 · 막힘 ' + tasks.filter(t => t.status === 'blocked').length + '건 · 검수 요청 ' + tasks.filter(t => t.status === 'review').length + '건';
    $('taskList').replaceChildren(); if (!tasks.length) $('taskList').append(node('p', '표시할 업무가 없습니다. 담당자 또는 필터를 확인해 주세요.', 'muted'));
    tasks.forEach(t => {
      const card = node('article', undefined, 'task'), top = node('div', undefined, 'row between'); card.dataset.taskId = t.id;
      top.append(node('span', statuses[t.status], 'badge ' + t.status), node('span', t.due ? '기한 ' + t.due : '기한 미지정', 'meta'));
      card.append(top, node('p', t.project, 'meta'), node('h3', t.title), node('p', teamName(t.teamId) + ' · ' + memberName(t.assigneeId), 'meta'));
      if (t.projectId) card.append(node('p', projectUI.location(t), 'meta'));
      if (d.capabilities?.includes('task-ack-v1')) { const receipt = assignmentReceipt(t); card.append(node('p', receipt ? '담당자 수락 확인 · ' + receipt.at : '현재 배정 미확인 · 일정/현장/담당자 변경 시 다시 확인', 'notice')); }
      if (t.handoff) card.append(node('p', t.handoff, 'pre'));
      if (t.workDate) card.append(node('p', '작업일 ' + t.workDate + ' ' + (t.startTime || '') + (t.endTime ? '–' + t.endTime : ''), 'meta'));
      const actions = node('div', undefined, 'row task-actions');
      if (d.capabilities?.includes('task-ack-v1') && t.assigneeId === d.me.id && t.status !== 'done' && !assignmentReceipt(t)) actions.append(button('업무 확인·수락', () => openEditor('ack', t), 'primary'));
      if (t.status === 'todo' || t.status === 'blocked') actions.append(button('작업 시작', () => openTaskAction(t, 'doing', '작업 시작'), 'primary'));
      if (t.status === 'doing') actions.append(button('검수 요청', () => openTaskAction(t, 'review', '검수 요청'), 'primary'));
      if (t.status === 'review' && canAssign(t.teamId)) { actions.append(button('완료 승인', () => openTaskAction(t, 'done', '완료 승인'), 'primary'), button('보완 요청', () => openTaskAction(t, 'doing', '보완 요청', true))); }
      actions.append(button(t.status === 'done' && !canAssign(t.teamId) ? '완료 내용 보기' : '업무 확인·수정', () => openEditor('task', t))); card.append(actions);
      const history = node('details'); history.append(node('summary', '작업 보고·처리 이력')); const list = node('ol', undefined, 'history');
      (t.history || []).slice().reverse().forEach(h => { const li = node('li'); li.append(node('p', (h.baseline ? '이력 도입 전 마지막 보존본 · ' : '') + h.at + ' · ' + memberName(h.actorId), 'meta'), node('strong', statuses[h.status]), node('p', h.handoff || '별도 보고 내용 없음', 'pre')); list.append(li); });
      if (!t.history?.length) list.append(node('li', '아직 상세 이력이 없습니다. 기존 최신 보고는 위 내용이며 다음 변경부터 이력이 쌓입니다.')); history.append(list); card.append(history); $('taskList').append(card);
    });
  }
  function assignmentReceipt(t) { return (t.acknowledgements || []).find(r => r.memberId === t.assigneeId && r.assignmentVersion === (t.assignmentVersion || 0)); }
  function openTaskAction(task, status, label, requireNote = false) {
    openEditor('task', task); if (!state.editor) return;
    $('edit-status').value = status; $('editorTitle').textContent = label + ' · ' + task.title; $('save').textContent = label + ' 저장'; state.editor.requireNote = requireNote;
    if (requireNote) { $('edit-handoff').value = ''; $('edit-handoff').required = true; $('edit-handoff').focus(); }
    editorNotice('아직 반영되지 않았습니다. 내용을 확인하고 저장하면 처리 이력과 함께 반영됩니다.', false);
  }
  function renderOrg() {
    const d = state.data; $('orgList').replaceChildren();
    const groups = d.teams.map(t => ({ team: t, members: d.members.filter(m => m.teamIds.includes(t.id)) }));
    const noTeam = d.members.filter(m => !m.teamIds.length); if (noTeam.length) groups.push({ team: { name: '팀 미배정', active: true }, members: noTeam });
    groups.forEach(({ team, members }) => {
      const li = node('li'), row = node('div', undefined, 'row between'); row.append(node('h3', team.name + (team.active ? '' : ' · 비활성')));
      if (d.me.role === 'owner' && team.id) row.append(button('팀 수정', () => openEditor('team', team))); li.append(row);
      const ul = node('ul'); members.slice().sort((a, b) => Object.keys(roles).indexOf(a.role) - Object.keys(roles).indexOf(b.role) || a.name.localeCompare(b.name, 'ko')).forEach(m => {
        const item = node('li'), line = node('div', undefined, 'row between'); line.append(node('span', m.name + ' · ' + roles[m.role] + (m.active ? '' : ' · 비활성')));
        if (d.me.role === 'owner') line.append(button('권한 수정', () => openEditor('member', m))); item.append(line); ul.append(item);
      }); if (!members.length) ul.append(node('li', '등록된 직원 없음', 'muted')); li.append(ul); $('orgList').append(li);
    }); if (!groups.length) $('orgList').append(node('li', '현재 권한으로 볼 수 있는 팀이 없습니다.'));
  }
  function renderAudit() {
    $('auditList').replaceChildren(); const labels = { teamSave: '팀 변경', memberSave: '직원 권한 변경', taskSave: '업무 변경', taskAcknowledge: '담당자 업무 수락', projectSave: '프로젝트 변경', taskBatch: '업무 일괄 배정', evidenceUpload: '원본 증빙 등록', claimSave: '보험 준비 변경', claimReview: '자료 검토 기록', claimSubmitRecord: '직접 제출 사실 수동 기록' };
    state.data.audit.forEach(a => $('auditList').append(node('li', a.at + ' · ' + memberName(a.actorId) + ' · ' + labels[a.action] + ' · 대상 ' + a.targetId + ' · 버전 ' + a.revision)));
    if (!state.data.audit.length) $('auditList').append(node('li', '표시할 변경 이력이 없습니다.'));
  }
  function field(form, key, label, type = 'text', value = '', opts = {}) {
    const wrap = node('label', undefined, 'field'); wrap.htmlFor = 'edit-' + key; wrap.append(node('span', label));
    const input = node(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'); input.id = 'edit-' + key; input.name = key;
    if (input.tagName === 'INPUT') input.type = type; if (opts.max) input.maxLength = opts.max; if (opts.required) input.required = true; if (opts.disabled) input.disabled = true;
    if (opts.options) opts.options.forEach(o => input.add(new Option(o[1], o[0]))); input.value = value; wrap.append(input); if (opts.help) wrap.append(node('small', opts.help)); form.append(wrap); return input;
  }
  function closeEditor() {
    if (state.editor?.busy) { editorNotice('전송 결과를 확인 중입니다. 로그아웃하면 이 기기의 작성 내용은 지워집니다.'); return; }
    if (state.editor?.pending && !confirm('이 요청의 서버 저장 결과가 아직 확인되지 않았습니다. 창을 닫은 뒤에는 최신 자료에서 중복 여부를 먼저 확인해야 합니다. 닫을까요?')) return;
    const taskId = state.editor?.old.id; $('editor').close(); state.editor = null; $('editorFields').replaceChildren(); returnFocus(taskId);
  }
  function returnFocus(taskId) { const target = taskId && $('taskList').querySelector('[data-task-id="' + CSS.escape(taskId) + '"] button'); (target && !$('tasksPanel').hidden ? target : $('pageTitle')).focus(); }
  function openEditor(kind, old = {}, imported = null) {
    if (!state.data || state.editor || projectUI.hasDraft() || (!['task', 'ack'].includes(kind) && state.data.me.role !== 'owner')) return;
    if (kind === 'ack' && (!state.data.capabilities?.includes('task-ack-v1') || old.assigneeId !== state.data.me.id || old.status === 'done')) return;
    if (kind === 'task' && !old.id && !assignableTeams().length) return;
    state.editor = { kind, old: JSON.parse(JSON.stringify(old)), revision: state.data.revision, pending: null, busy: false, conflict: false, imported };
    const form = $('editorFields'); form.replaceChildren(); editorNotice(''); $('conflictLatest').hidden = true; $('compare').hidden = true; $('rebase').hidden = true; $('save').hidden = false; $('save').disabled = false; $('save').textContent = '저장';
    $('editorTitle').textContent = kind === 'ack' ? '업무 확인·수락' : ({ team: '팀', member: '직원 권한', task: '업무' })[kind] + (old.id ? ' 수정' : ' 등록');
    if (kind === 'ack') {
      form.append(node('h3', old.title), node('p', old.project + ' · ' + projectUI.location(old)), node('p', '기한 ' + (old.due || '미정') + ' · 작업일 ' + (old.workDate || '미정') + ' ' + (old.startTime || '') + '–' + (old.endTime || '')), node('p', old.handoff || '추가 작업 안내 없음', 'pre'), node('p', '내 계정으로 현재 배정 내용을 확인하고 수락합니다. 작업 시작·검수·완료 승인을 대신하지 않습니다.', 'notice'));
      const label = node('label', undefined, 'check'), input = node('input'); input.type = 'checkbox'; input.id = 'edit-ackConfirm'; input.required = true; label.append(input, node('span', '위 현장·위치·작업 일정 확인')); form.append(label); $('save').textContent = '확인·수락 저장';
    } else if (kind === 'team') {
      field(form, 'name', '팀 이름', 'text', old.name || '', { max: 60, required: true });
      field(form, 'active', '사용 상태', 'select', String(old.active !== false), { options: [['true', '사용'], ['false', '비활성화']] });
      form.append(node('p', '직원 또는 미완료 업무가 남아 있는 팀은 비활성화할 수 없습니다.', 'muted'));
    } else if (kind === 'member') {
      form.append(node('p', '기존 직원 포털의 로그인 계정을 연결합니다. 비밀번호를 만들거나 전달하지 않습니다. 직원이 로그인 화면의 내 식별정보를 직접 확인해 전달하도록 안내하세요.', 'notice'));
      field(form, 'name', '직원 이름', 'text', old.name || '', { max: 60, required: true });
      field(form, 'userId', '포털 userId', 'text', old.userId || '', { max: 100, required: true, disabled: !!old.id });
      field(form, 'officeId', '포털 officeId', 'text', old.officeId || state.identity.officeId, { max: 100, required: true, disabled: true });
      field(form, 'role', '회사 권한', 'select', old.role || 'member', { options: Object.entries(roles) });
      field(form, 'active', '사용 상태', 'select', String(old.active !== false), { options: [['true', '사용'], ['false', '비활성화']] });
      const group = node('fieldset'); group.append(node('legend', '소속 팀 · 여러 팀 선택 가능'));
      state.data.teams.filter(t => t.active).forEach(t => { const label = node('label', undefined, 'check'), check = node('input'); check.type = 'checkbox'; check.name = 'teamIds'; check.value = t.id; check.checked = !!old.teamIds?.includes(t.id); label.append(check, node('span', t.name)); group.append(label); }); form.append(group);
    } else {
      const source = imported || old, canEdit = !old.id || canAssign(old.teamId), contextTeam = currentTeam();
      field(form, 'title', '할 일', 'text', source.title || '', { max: 160, required: true, disabled: !canEdit });
      field(form, 'project', '현장명', 'text', source.project || (!old.id && !imported ? $('projectFilter').value : '') || '', { max: 160, required: true, disabled: !canEdit, help: '사진을 모으려면 아래에서 등록 프로젝트를 연결하세요. 이름만 같은 기존 자료는 자동 공유하지 않습니다.' });
      const linkedProject = field(form, 'projectId', '사진함에 연결할 프로젝트', 'select', source.projectId || '', { disabled: !canEdit, options: [['', '연결 안 함 · 기존 현장명 유지'], ...(state.data.projects || []).map(p => [p.id, p.name])] });
      const unitSupported = state.data.capabilities?.includes('project-units-v1');
      const unit = field(form, 'unitId', '동·호수 / 공용부', 'select', '', { disabled: !canEdit || !unitSupported });
      const fillUnits = preferred => { unit.replaceChildren(new Option('위치 미지정', '')); (state.data.projects?.find(p => p.id === linkedProject.value)?.units || []).forEach(u => unit.add(new Option(projectUI.unitLabel(u), u.id))); unit.value = preferred || ''; };
      fillUnits(source.unitId); if (!unitSupported) form.append(node('p', '동·호수 연결은 별도 직원 서버 업데이트 후 사용합니다.', 'muted'));
      linkedProject.onchange = () => { const p = state.data.projects?.find(p => p.id === linkedProject.value); if (p) $('edit-project').value = p.name; fillUnits(''); };
      const available = canEdit ? assignableTeams() : state.data.teams.filter(t => t.id === old.teamId);
      const teams = field(form, 'teamId', '담당 팀', 'select', old.teamId || contextTeam?.id || available[0]?.id || '', { required: true, disabled: !canEdit, options: available.map(t => [t.id, t.name]) });
      const assignee = field(form, 'assigneeId', '담당자', 'select', '', { required: true, disabled: !canEdit });
      const setAssignees = (preferred) => { assignee.replaceChildren(new Option('담당자를 선택하세요', '')); state.data.members.filter(m => m.active && m.teamIds.includes(teams.value)).forEach(m => assignee.add(new Option(m.name + ' · ' + roles[m.role], m.id))); if ([...assignee.options].some(o => o.value === preferred)) assignee.value = preferred; };
      setAssignees(old.assigneeId || ''); teams.onchange = () => setAssignees('');
      field(form, 'due', '작업 기한', 'date', source.due || '', { disabled: !canEdit });
      field(form, 'workDate', '예정 작업일', 'date', source.workDate || '', { disabled: !canEdit });
      field(form, 'startTime', '작업 시작 시간', 'time', source.startTime || '', { disabled: !canEdit });
      field(form, 'endTime', '작업 종료 시간', 'time', source.endTime || '', { disabled: !canEdit });
      const states = old.id ? [old.status, ...transitions[old.status].filter(s => canEdit || s !== 'done' && old.status !== 'done')] : ['todo'];
      field(form, 'status', '진행 상태', 'select', old.status || 'todo', { options: states.map(s => [s, statuses[s]]) });
      field(form, 'handoff', '작업 내용·막힌 이유·인수인계', 'textarea', source.handoff || '', { max: 2000, help: '변경 전 보고는 처리 이력에 남고, 재배정한 새 담당자도 이전 보고를 볼 수 있습니다. 고객 연락처·출입 비밀번호는 적지 마세요.' });
      if (source.sourceRef) form.append(node('p', '기존 업무 연결 번호: ' + source.sourceRef, 'meta'));
      if (!canEdit) form.append(node('p', '배정 정보는 대표·팀장이 변경합니다. 내 업무의 진행 상황과 인수인계만 수정할 수 있습니다.', 'notice'));
      if (old.status === 'done' && !canEdit) { [...form.querySelectorAll('input,select,textarea')].forEach(el => el.disabled = true); $('save').hidden = true; form.append(node('p', '완료된 업무는 조회만 가능합니다. 재작업이 필요하면 팀장에게 재개를 요청하세요.', 'notice')); }
    }
    $('editor').showModal();
  }
  function entityFromForm() {
    const e = state.editor, value = k => $('edit-' + k).value, old = e.old;
    if (e.kind === 'team') return { id: old.id || '', name: value('name').trim(), active: value('active') === 'true' };
    if (e.kind === 'member') return { id: old.id || '', name: value('name').trim(), userId: value('userId').trim(), officeId: value('officeId'), role: value('role'), active: value('active') === 'true', teamIds: [...$('editorFields').querySelectorAll('input[name=teamIds]:checked')].map(i => i.value) };
    if (e.kind === 'ack') return { id: old.id, assignmentVersion: old.assignmentVersion || 0 };
    return { id: old.id || '', title: value('title').trim(), project: value('project').trim(), projectId: value('projectId'), ...(state.data.capabilities?.includes('project-units-v1') ? { unitId: value('unitId') } : {}), workDate: value('workDate'), startTime: value('startTime'), endTime: value('endTime'), teamId: value('teamId'), assigneeId: value('assigneeId'), due: value('due'), status: value('status'), handoff: value('handoff'), sourceRef: e.imported?.sourceRef || old.sourceRef || '' };
  }
  function freezeFields(freeze) {
    [...$('editorFields').querySelectorAll('input,select,textarea')].forEach(n => { if (freeze) { if (!n.disabled) n.dataset.temporarilyDisabled = '1'; n.disabled = true; } else if (n.dataset.temporarilyDisabled) { n.disabled = false; delete n.dataset.temporarilyDisabled; } });
  }
  async function save(e) {
    e.preventDefault(); const edit = state.editor; if (!edit || edit.busy || edit.conflict) return;
    if (!edit.pending) {
      if (!$('editorForm').reportValidity()) return;
      const entity = entityFromForm(); if (['blocked', 'review'].includes(entity.status) && !entity.handoff.trim()) { editorNotice(errors['handoff-required']); $('edit-handoff').focus(); return; }
      if (edit.kind === 'task' && edit.old.status === 'review' && entity.status === 'doing' && (!entity.handoff.trim() || entity.handoff === edit.old.handoff)) { editorNotice(errors['review-note-required']); $('edit-handoff').focus(); return; }
      if (!crypto.randomUUID) { editorNotice('이 브라우저에서 안전한 요청 번호를 만들 수 없습니다. 최신 브라우저를 사용해 주세요.'); return; }
      edit.pending = { action: edit.kind === 'ack' ? 'taskAcknowledge' : edit.kind + 'Save', payload: { requestId: crypto.randomUUID(), revision: edit.revision, entity } };
    }
    const epoch = state.epoch; edit.busy = true; freezeFields(true); $('save').disabled = true; editorNotice('서버에 저장 결과를 확인하고 있습니다.', false);
    try {
      const r = await api(edit.pending.action, edit.pending.payload); if (epoch !== state.epoch || state.editor !== edit) return;
      acceptData(r.data); edit.pending = null; edit.busy = false; $('editor').close(); state.editor = null; $('editorFields').replaceChildren(); returnFocus(edit.old.id); notice('공유 업무 자료를 저장했습니다. 동료 기기에서는 최신 자료 확인을 눌러 볼 수 있습니다.');
    } catch (err) {
      if (epoch !== state.epoch || state.editor !== edit) return;
      const code = codeOf(err); if (code === 'session-expired') { endSession(message(err)); return; }
      if (code === 'forbidden') { handleReadError(err); return; }
      editorNotice(message(err));
      if (['conflict', 'request-conflict', 'not-found', 'duplicate-source', 'ack-stale'].includes(code)) { edit.pending = null; edit.conflict = true; $('compare').hidden = false; $('save').disabled = true; freezeFields(false); }
      else if (['network', 'bad-response', 'server-error', 'storage-failed', 'busy', 'auth-unavailable'].includes(code) || !errors[code]) { $('save').textContent = '보낸 내용으로 결과 재확인'; }
      else { edit.pending = null; freezeFields(false); $('save').textContent = '저장'; }
    } finally { if (state.editor === edit) { edit.busy = false; $('save').disabled = edit.conflict; } }
  }
  async function compare() {
    const edit = state.editor; if (!edit || edit.busy) return; edit.busy = true; $('compare').disabled = true;
    try {
      const r = await api('list'); if (state.editor !== edit) return; acceptData(r.data);
      const list = r.data[edit.kind === 'member' ? 'members' : edit.kind === 'team' ? 'teams' : 'tasks'];
      const current = list.find(x => x.id === edit.old.id);
      $('conflictLatest').textContent = current ? '현재 서버 내용\n' + JSON.stringify(current, null, 2) : '현재 서버에는 이 편집 대상이 없습니다. 신규 등록의 경우 중복 여부를 확인해 주세요.';
      $('conflictLatest').hidden = false; $('rebase').hidden = false; edit.latestRevision = r.data.revision;
      editorNotice('작성 중인 칸은 그대로입니다. 서버 내용과 비교한 뒤 「이 초안으로 다시 검토」를 눌러 주세요. 자동 저장하지 않습니다.', false);
    } catch (e) { if (state.editor === edit) { if (['session-expired', 'forbidden'].includes(codeOf(e))) handleReadError(e); else editorNotice(message(e)); } }
    finally { if (state.editor === edit) edit.busy = false; $('compare').disabled = false; }
  }
  function rebase() {
    const e = state.editor; if (!e || e.busy || e.latestRevision !== state.data?.revision) return;
    if (e.kind === 'ack') { const current = state.data.tasks.find(t => t.id === e.old.id); state.editor = null; $('editor').close(); $('editorFields').replaceChildren(); if (current) openEditor('ack', current); return; }
    e.revision = e.latestRevision; e.conflict = false; e.pending = null; freezeFields(false); $('save').disabled = false; $('save').textContent = '검토한 내용 저장'; $('compare').hidden = true; $('rebase').hidden = true;
    editorNotice('최신 버전을 기준으로 다시 검토할 수 있습니다. 저장을 눌러야 전송됩니다.', false);
  }
  function draftsFrom(v) {
    if (!v || v.format !== 'company-task-drafts-v1' || !Array.isArray(v.tasks) || v.tasks.length > 100) fail('invalid-input');
    if (!v.tasks.every(t => t && Object.keys(t).every(k => ['title', 'project', 'due', 'handoff', 'sourceRef'].includes(k)) && str(t.title, 160, false) && str(t.project, 160, false) && str(t.due, 10) && (!t.due || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && str(t.handoff) && str(t.sourceRef, 150, false)) || !unique(v.tasks.map(t => t.sourceRef))) fail('invalid-input');
    return v.tasks.map(t => ({ title: t.title, project: t.project, due: t.due, handoff: t.handoff, sourceRef: t.sourceRef }));
  }
  async function importDrafts() {
    if (!state.data || !assignableTeams().length) return;
    const file = $('importFile').files[0]; if (!file) return; const epoch = state.epoch;
    try {
      if (file.size > 512000) fail('invalid-input'); const text = await file.text(); if (epoch !== state.epoch || !state.data) return;
      state.imports = draftsFrom(JSON.parse(text));
      $('importNotice').textContent = state.imports.length + '건을 이 화면에만 불러왔습니다. 아직 서버에 저장하지 않았습니다.'; renderImports();
    } catch (_) { if (epoch === state.epoch) $('importNotice').textContent = '업무 초안 파일을 확인해 주세요. 기존 초안과 서버 자료는 변경하지 않았습니다.'; }
  }
  /* Main-app hand-off (v333): the owner pressed 「직원 작업실로 초안 보내기」 in the field app. Same rules as a file:
   * nothing is sent until each draft is assigned and saved here. Stale or malformed hand-offs are dropped unread. */
  function readHandoff() {
    let raw = null; try { raw = localStorage.getItem(HANDOFF_KEY); } catch (_) { return null; }
    if (!raw) return null;
    try {
      const v = JSON.parse(raw); if (!v || !Number.isFinite(v.at) || Date.now() - v.at > HANDOFF_TTL || v.at > Date.now() + 60000) fail('invalid-input');
      const tasks = draftsFrom(v); if (!tasks.length) fail('invalid-input'); return { at: v.at, tasks };
    } catch (_) {
      dropHandoff();
      // Expired hand-offs go quietly; a malformed one must not vanish while the owner believes it was sent.
      let expired = false; try { const v = JSON.parse(raw); expired = !!v && Number.isFinite(v.at) && Date.now() - v.at > HANDOFF_TTL; } catch (_) { /* not JSON: malformed */ }
      if (!expired) state.handoffLost = true;
      return null;
    }
  }
  /* The hand-off sits in this browser's storage and carries site names (possibly 동·호수) of every team,
   * so only the owner — whose device the field app is — sees or consumes it; a lead on a shared browser does not. */
  function handoffAllowed() { return !!state.data && state.data.me.role === 'owner' && assignableTeams().length > 0; }
  function dropHandoff() { try { localStorage.removeItem(HANDOFF_KEY); } catch (_) { /* private mode: nothing was stored */ } }
  function renderHandoff() {
    const box = $('handoffBox'), h = handoffAllowed() ? readHandoff() : null; if (h) state.handoffLost = false;
    const lost = !h && state.handoffLost && handoffAllowed(); box.hidden = (!h && !lost) || $('tasksPanel').hidden;
    $('handoffLoad').hidden = !h; $('handoffDrop').hidden = !h; box.classList.toggle('error', lost);
    if (lost) { $('handoffText').textContent = '현장 앱에서 보낸 업무 초안을 읽지 못해 버렸습니다. 서버와 현장 앱의 원래 업무는 바뀌지 않았습니다. 현장 앱에서 다시 보내거나 「JSON 파일로 내려받기」를 쓰세요.'; return; }
    if (!h) return;
    $('handoffText').textContent = '현장 앱에서 보낸 업무 초안 ' + h.tasks.length + '건이 있습니다(' + new Date(h.at).toLocaleString('ko-KR') + '). 불러오면 이 화면에만 표시되고, 한 건씩 팀·담당자를 정해 저장해야 서버에 올라갑니다.';
  }
  function loadHandoff() {
    const h = handoffAllowed() ? readHandoff() : null; if (!h) { renderHandoff(); return; }
    state.imports = h.tasks; dropHandoff(); $('importPanel').hidden = false;
    $('importNotice').textContent = h.tasks.length + '건을 이 화면에만 불러왔습니다. 아직 서버에 저장하지 않았습니다. 「배정 초안 열기」로 한 건씩 저장하세요.';
    renderImports(); renderHandoff(); $('importPanel').scrollIntoView({ block: 'start' });
  }
  function renderImports() {
    $('importList').replaceChildren(); if (!state.data) return;
    state.imports.forEach(t => { const row = node('div', undefined, 'row between'), exists = state.data.tasks.some(x => x.sourceRef === t.sourceRef); row.append(node('p', t.project + ' · ' + t.title)); const b = button(exists ? '이미 등록됨' : '배정 초안 열기', () => openEditor('task', {}, t)); b.disabled = exists; row.append(b); $('importList').append(row); });
  }
  /* ── 권한 점검 (v333). Read-only: list + companyDiagnose. The expected rules below are written out
   * independently of the server gates so that a server that drifted from TeamPure.gs shows up as ✗. */
  const expectRule = {
    tasks: (m, tasks) => tasks.filter(t => m.role === 'owner' || (m.role === 'lead' ? m.teamIds.includes(t.teamId) : t.assigneeId === m.id)).map(t => t.id),
    teams: (m, teams) => teams.filter(t => m.role === 'owner' || m.teamIds.includes(t.id)).map(t => t.id),
    assign: (m, teams) => teams.filter(t => m.role === 'owner' || m.role === 'lead' && m.teamIds.includes(t.id)).map(t => t.id)
  };
  const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
  async function idsDigest(ids) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ids.slice().sort())));
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function teamNames(ids) { return ids.length ? ids.map(teamName).join(', ') : '없음'; }
  function checkList(rows) { const ul = node('ul', undefined, 'check-list'); rows.forEach(([kind, text]) => ul.append(node('li', text, kind))); return ul; }
  function renderAccess() {
    const root = $('accessResult'); root.replaceChildren(); const a = state.access; if (!a) return;
    const all = [].concat(a.self ? a.self : [], ...(a.groups || []).map(g => g.rows)), bad = all.filter(r => r[0] === 'bad').length, warn = all.filter(r => r[0] === 'warn').length;
    const summary = node('p', (bad ? '문제 ' + bad + '건' : '문제 없음') + (warn ? ' · 확인 필요 ' + warn + '건' : '') + ' · 점검 ' + new Date(a.at).toLocaleString('ko-KR') + ' · 자료 버전 ' + a.revision, 'notice' + (bad ? ' error' : ''));
    summary.id = 'accessSummary'; root.append(summary);
    if (a.self) { const card = node('article', undefined, 'card'); card.append(node('h3', '내 권한 · ' + a.selfTitle), checkList(a.self)); root.append(card); }
    (a.groups || []).forEach(g => { const card = node('article', undefined, 'card'); card.dataset.accessGroup = g.key; card.append(node('h3', g.title), checkList(g.rows)); root.append(card); });
  }
  function accessBusy(yes, text) { state.checking = yes; $('selfCheck').disabled = yes; $('ownerCheck').disabled = yes; $('accessStatus').textContent = text || ''; }
  function accessError(e, epoch) {
    if (epoch !== state.epoch || codeOf(e) === 'stale') return;
    if (['session-expired', 'forbidden'].includes(codeOf(e))) { handleReadError(e); return; }
    accessBusy(false, message(e));
  }
  async function selfCheck() {
    if (!state.data || state.checking) return; const epoch = state.epoch; accessBusy(true, '서버에 내 권한을 확인하고 있습니다.');
    try {
      const raw = (await api('list')).data; if (epoch !== state.epoch) return;
      const me = raw && raw.me; if (!me || !Object.hasOwn(roles, me.role) || !Array.isArray(me.teamIds)) fail('bad-response');
      const rows = [], owner = me.role === 'owner', tasks = Array.isArray(raw.tasks) ? raw.tasks : [], teams = Array.isArray(raw.teams) ? raw.teams : [], members = Array.isArray(raw.members) ? raw.members : [];
      const outside = tasks.filter(t => !expectRule.tasks(me, [t]).length), foreignTeams = teams.filter(t => !owner && !me.teamIds.includes(t.id));
      rows.push(['info', '내 계정: ' + me.name + ' · ' + roles[me.role] + ' · 소속 팀 ' + (me.teamIds.length ? me.teamIds.map(id => teams.find(t => t.id === id)?.name || '이름 미확인').join(', ') : '없음')]);
      rows.push([outside.length ? 'bad' : 'ok', owner ? '회사 업무 ' + tasks.length + '건 전체를 본다' : outside.length ? '내 권한 밖 업무 ' + outside.length + '건을 서버가 보냈다 — 서버 코드 확인 필요' : me.role === 'lead' ? '받은 업무 ' + tasks.length + '건이 모두 내 팀 업무다(다른 팀 업무는 받지 않는다)' : '받은 업무 ' + tasks.length + '건이 모두 나에게 배정된 일이다(동료 업무는 받지 않는다)']);
      if (!owner) {
        rows.push([foreignTeams.length ? 'bad' : 'ok', foreignTeams.length ? '소속이 아닌 팀 ' + foreignTeams.length + '개를 받았다' : '소속 팀 목록만 받는다']);
        const ids = members.filter(m => m && (Object.hasOwn(m, 'userId') || Object.hasOwn(m, 'officeId')));
        rows.push([ids.length ? 'bad' : 'ok', ids.length ? '동료 ' + ids.length + '명의 계정 식별정보를 받았다' : '동료 계정 식별정보(userId)를 받지 않는다']);
        rows.push([Array.isArray(raw.audit) && raw.audit.length ? 'bad' : 'ok', Array.isArray(raw.audit) && raw.audit.length ? '대표 전용 변경 이력 ' + raw.audit.length + '건을 받았다' : '대표 전용 변경 이력을 받지 않는다']);
        rows.push([Array.isArray(raw.claims) && raw.claims.length ? 'bad' : 'ok', Array.isArray(raw.claims) && raw.claims.length ? '대표 전용 보험 제출 자료를 받았다' : '대표 전용 보험 제출 자료를 받지 않는다']);
      } else rows.push([members.every(m => m && Object.hasOwn(m, 'userId')) ? 'ok' : 'bad', '직원 ' + members.length + '명의 계정 연결 정보를 본다(대표만)']);
      const assignable = teams.filter(t => t.active && (owner || me.role === 'lead' && me.teamIds.includes(t.id)));
      rows.push(['info', assignable.length ? '업무 배정·완료 승인 가능한 팀: ' + assignable.map(t => t.name).join(', ') : '업무 배정·완료 승인 권한 없음 — 내 업무의 진행·보고만 할 수 있다']);
      rows.push(['info', '열 수 있는 메뉴: ' + Object.keys(pages).filter(p => owner || (!['settings', 'audit', 'claims'].includes(p) && (['owner', 'lead'].includes(me.role) || !['review', 'operations'].includes(p)))).map(p => pages[p][0]).join(', ')]);
      try { await api('companyDiagnose'); if (epoch !== state.epoch) return; rows.push([owner ? 'ok' : 'bad', owner ? '대표 전용 권한 점검을 서버가 허용한다' : '서버가 대표 전용 권한 점검을 열어 줬다 — 서버 코드 확인 필요']); }
      catch (e) {
        if (epoch !== state.epoch || codeOf(e) === 'stale') return;
        if (codeOf(e) === 'session-expired') { endSession(message(e)); return; }
        rows.push(codeOf(e) === 'forbidden' ? [owner ? 'bad' : 'ok', owner ? '대표인데 서버가 권한 점검을 거절했다' : '대표 전용 권한 점검은 서버가 거절한다'] : codeOf(e) === 'invalid-action' ? ['warn', '서버 코드가 권한 점검 이전 버전이라 이 항목은 확인하지 못했다'] : ['warn', '대표 전용 점검 거절 여부를 확인하지 못했다: ' + message(e)]);
      }
      if (!validData(raw)) { clearWorkspace(); $('who').textContent = '로그인됨 · 서버 응답 확인 필요'; notice('내 권한 확인 결과 문제가 있어 화면을 닫았습니다.\n' + rows.filter(r => r[0] === 'bad').map(r => '✗ ' + r[1]).join('\n'), true); return; }
      const keepOwner = state.access && state.access.groups; state.data = raw;
      state.access = { at: Date.now(), revision: raw.revision, self: rows, selfTitle: me.name + ' · ' + roles[me.role], groups: keepOwner && state.access.revision === raw.revision ? keepOwner : null };
      accessBusy(false, '내 권한을 확인했습니다. 아무것도 바꾸지 않았습니다.'); render();
    } catch (e) { accessError(e, epoch); }
    finally { if (epoch === state.epoch) { state.checking = false; $('selfCheck').disabled = false; $('ownerCheck').disabled = false; } }
  }
  async function ownerCheck() {
    if (!state.data || state.checking || state.data.me.role !== 'owner') return; const epoch = state.epoch; accessBusy(true, '서버 설정과 직원별 권한을 점검하고 있습니다.');
    try {
      const list = (await api('list')).data; if (epoch !== state.epoch) return; if (!validData(list)) fail('bad-response');
      let diag; try { diag = (await api('companyDiagnose')).diagnosis; }
      catch (e) { if (codeOf(e) === 'invalid-action') { state.data = list; accessBusy(false, '서버 코드가 권한 점검 이전 버전입니다. Code.gs·TeamPure.gs 를 새로 붙여 넣고 「배포 관리 → 수정 → 새 버전」으로 다시 배포하세요(주소는 그대로).'); render(); return; } throw e; }
      if (epoch !== state.epoch) return;
      if (!diag || !Array.isArray(diag.members) || !diag.properties || typeof diag.properties !== 'object') fail('bad-response');
      if (diag.revision !== list.revision) { state.data = list; accessBusy(false, '점검하는 사이 다른 기기에서 자료가 바뀌었습니다. 한 번 더 눌러 주세요.'); render(); return; }
      state.data = list;
      const p = diag.properties, cfg = [];
      [['COMPANY_ENABLED', '켜짐(1)'], ['COMPANY_PORTAL_URL', '있음'], ['COMPANY_FOLDER_ID', '있음'], ['COMPANY_OFFICE_ID', '있음'], ['COMPANY_HEAD', '있음 · 부트스트랩 완료']].forEach(([k, ok]) => cfg.push([p[k] === true ? 'ok' : 'bad', k + ' ' + (p[k] === true ? ok : '없음') + ' (값은 표시하지 않음)']));
      ['COMPANY_OWNER_USER_ID', 'COMPANY_OWNER_NAME'].forEach(k => cfg.push([p[k] === false ? 'ok' : 'warn', p[k] === false ? k + ' 정리됨(부트스트랩 임시 속성)' : k + ' 가 남아 있다 — 부트스트랩을 다시 확인하고 스크립트 속성에서 지우세요']));
      cfg.push([diag.authorityBound === true ? 'ok' : 'bad', '회사 인증 서버·신원 단지와 저장 자료가 같은 곳을 가리킨다']);
      const roleCount = r => list.members.filter(m => m.active && m.role === r).length;
      cfg.push(['info', '자료 버전 ' + diag.revision + ' · 팀 ' + list.teams.filter(t => t.active).length + '개 · 사용 중 직원 ' + list.members.filter(m => m.active).length + '명(대표 ' + roleCount('owner') + ' · 팀장 ' + roleCount('lead') + ' · 직원 ' + roleCount('member') + ' · 외주 ' + roleCount('external') + ') · 업무 ' + list.tasks.length + '건']);
      list.teams.filter(t => t.active && !list.members.some(m => m.active && m.teamIds.includes(t.id))).forEach(t => cfg.push(['warn', t.name + ': 소속 직원이 없어 이 팀 업무는 대표만 배정할 수 있다']));
      const groups = [{ key: 'config', title: '서버 설정', rows: cfg }];
      const teamIdsAll = list.teams.map(t => t.id);
      for (const m of list.members.slice().sort((a, b) => Object.keys(roles).indexOf(a.role) - Object.keys(roles).indexOf(b.role) || a.name.localeCompare(b.name, 'ko'))) {
        const d = diag.members.find(x => x.id === m.id), rows = [], label = roles[m.role] + ' ' + m.name;
        if (!d) { rows.push(['bad', '서버 점검 결과에 이 직원이 없다']); groups.push({ key: m.id, title: label, rows }); continue; }
        if (!m.active) { rows.push([d.access === 'forbidden' ? 'ok' : 'bad', d.access === 'forbidden' ? '비활성 — 로그인해도 회사 자료를 하나도 못 본다' : '비활성인데 서버가 자료를 열어 준다']); groups.push({ key: m.id, title: label + ' · 비활성', rows }); continue; }
        if (!d.linked) rows.push(['warn', '연결한 단지 ID 가 회사 신원 단지와 달라 이 계정으로는 로그인할 수 없다']);
        if (d.duplicate) rows.push(['bad', '같은 포털 계정이 두 번 연결돼 이 계정은 막힌다 — 한쪽을 비활성화하세요']);
        if (d.access !== 'ok') { rows.push(['bad', '서버가 이 계정을 막는다(' + d.access + ')']); groups.push({ key: m.id, title: label, rows }); continue; }
        const want = expectRule.tasks(m, list.tasks), match = d.visibleTasks === want.length && d.visibleTaskDigest === await idsDigest(want);
        if (epoch !== state.epoch) return;
        const scope = m.role === 'owner' ? '회사 업무 ' + want.length + '건 전체를 본다' : m.role === 'lead' ? '자기 팀(' + teamNames(m.teamIds.filter(id => teamIdsAll.includes(id))) + ') 업무 ' + want.length + '건만 본다' : '자기에게 배정된 업무 ' + want.length + '건만 본다';
        rows.push([match ? 'ok' : 'bad', match ? scope : '기대: ' + scope + ' — 서버는 ' + d.visibleTasks + '건을 보여 준다']);
        const wantTeams = expectRule.teams(m, list.teams), teamsOk = Array.isArray(d.visibleTeamIds) && sameSet(d.visibleTeamIds, wantTeams);
        rows.push([teamsOk ? 'ok' : 'bad', (m.role === 'owner' ? '모든 팀' : '소속 팀(' + teamNames(wantTeams) + ')') + (teamsOk ? '만 보인다' : ' 기대와 서버 결과가 다르다')]);
        const wantAssign = expectRule.assign(m, list.teams), assignOk = Array.isArray(d.assignableTeamIds) && sameSet(d.assignableTeamIds, wantAssign);
        rows.push([assignOk ? 'ok' : 'bad', (wantAssign.length ? '배정·완료 승인: ' + (m.role === 'owner' ? '모든 팀' : teamNames(wantAssign)) : '배정·완료 승인 권한 없음(내 업무 진행·보고만)') + (assignOk ? '' : ' — 서버 결과가 다르다')]);
        const idsOk = d.seesIdentities === (m.role === 'owner');
        rows.push([idsOk ? 'ok' : 'bad', m.role === 'owner' ? '직원 계정 연결 정보를 본다' : idsOk ? '동료 계정 식별정보·변경 이력은 못 본다' : '동료 계정 식별정보를 볼 수 있다 — 서버 코드 확인 필요']);
        if (d.seesAudit !== null && d.seesAudit !== undefined && d.seesAudit !== (m.role === 'owner')) rows.push(['bad', m.role === 'owner' ? '대표인데 변경 이력이 안 보인다' : '대표 전용 변경 이력이 보인다']);
        groups.push({ key: m.id, title: label, rows });
      }
      state.access = { at: Date.now(), revision: diag.revision, self: null, groups };
      accessBusy(false, '점검을 마쳤습니다. 아무것도 바꾸지 않았습니다.'); render();
    } catch (e) { accessError(e, epoch); }
    finally { if (epoch === state.epoch) { state.checking = false; $('selfCheck').disabled = false; $('ownerCheck').disabled = false; } }
  }
  /* ── 서버 연결 설정 (v333). The address is a public endpoint; the health reply must be this company server. */
  const connectErrors = {
    format: '주소 형식이 다릅니다. Apps Script 「배포 관리」의 웹 앱 URL(https://script.google.com/macros/s/…/exec)을 그대로 붙여 넣으세요. 끝이 /dev 인 테스트 주소는 쓸 수 없습니다.',
    network: '서버에 닿지 못했습니다. 인터넷 연결과, 배포의 「액세스 권한이 있는 사용자」가 「모든 사용자」인지 확인하세요. 「나만」으로 배포하면 이 화면에서 연결되지 않습니다.',
    'bad-response': '응답은 왔지만 회사 팀 업무 서버(company-team-v3)의 응답이 아닙니다. 사진 중계·관리사무소 포털 주소를 넣지 않았는지, 서버 파일 네 개를 최신으로 붙여 넣고 새 버전으로 배포했는지 확인하세요.',
    'not-configured': '서버는 응답했지만 스크립트 속성이 덜 들어갔습니다. COMPANY_ENABLED=1, COMPANY_PORTAL_URL(관리사무소 포털 /exec 주소), COMPANY_FOLDER_ID, COMPANY_OFFICE_ID 네 가지를 확인하세요(설치 절차서 3단계).'
  };
  function connectMessage(e) { return connectErrors[codeOf(e)] || message(e); }
  function connectNotice(text, error = false) { $('connectMessage').hidden = !text; $('connectMessage').textContent = text; $('connectMessage').className = 'notice' + (error ? ' error' : ''); }
  function shortUrl(u) { const m = /\/macros\/s\/([A-Za-z0-9_-]+)\/exec$/.exec(u || ''); return m ? 'script.google.com/…/s/' + m[1].slice(0, 6) + '…' + m[1].slice(-4) + '/exec' : ''; }
  async function healthOf(url, epoch) {
    if (!endpointPattern.test(url)) fail('format');
    const health = await request(url, { action: 'health' }, epoch);
    if (health.service !== 'company-team-v3' || !endpointPattern.test(health.portalUrl)) fail('bad-response');
    return health;
  }
  function renderConnect() {
    $('connectFixed').hidden = !configFixed; $('apiUrlInput').closest('label').hidden = configFixed; $('apiSave').hidden = configFixed; $('apiClear').hidden = configFixed || !deviceUrl();
    if (configFixed) $('connectFixed').textContent = '배포 설정(team-config.js)에 고정된 주소를 씁니다: ' + shortUrl(configUrl);
    else if (!$('apiUrlInput').value) $('apiUrlInput').value = deviceUrl();
    if (!apiUrl) $('connectBox').open = true;
  }
  async function saveConnect() {
    if (state.token || configFixed) return;
    const url = $('apiUrlInput').value.trim();
    if (!endpointPattern.test(url)) { connectNotice(connectErrors.format, true); $('apiUrlInput').focus(); return; }
    state.epoch++; const epoch = state.epoch; $('apiSave').disabled = true; loginEnabled(false); connectNotice('서버 응답을 확인하고 있습니다.');
    try {
      const health = await healthOf(url, epoch); if (epoch !== state.epoch) return;
      let stored = true; try { localStorage.setItem(API_KEY, url); } catch (_) { stored = false; }
      apiUrl = url; state.portalUrl = health.portalUrl; loginEnabled(true); renderConnect();
      connectNotice('연결됐습니다. 회사 팀 업무 서버가 응답했습니다.\n서버: ' + shortUrl(url) + '\n로그인 확인 서버: ' + shortUrl(health.portalUrl) + (stored ? '\n이 기기에 주소를 저장했습니다. 현장 앱의 팀 업무 화면에서도 「직원 작업실로 초안 보내기」가 열립니다.' : '\n이 브라우저는 주소를 저장하지 못했습니다(사생활 보호 모드 등). 이번 화면에서만 씁니다.'));
      notice('개인 계정으로 로그인해 회사에서 허용한 업무를 확인하세요.');
    } catch (e) {
      if (epoch !== state.epoch || codeOf(e) === 'stale') return;
      connectNotice(connectMessage(e) + '\n주소는 저장하지 않았습니다.', true); loginEnabled(!!state.portalUrl && endpointPattern.test(apiUrl));
    } finally { if (epoch === state.epoch) $('apiSave').disabled = false; }
  }
  function clearConnect() {
    if (state.token || configFixed || !deviceUrl()) return;
    if (!confirm('이 기기에 저장한 팀 서버 주소를 지울까요? 서버 자료와 직원 계정은 그대로이고, 다시 쓰려면 주소를 새로 넣어야 합니다.')) return;
    try { localStorage.removeItem(API_KEY); } catch (_) { /* nothing stored */ }
    state.epoch++; apiUrl = ''; state.portalUrl = ''; loginEnabled(false); $('apiUrlInput').value = ''; renderConnect();
    connectNotice('저장한 주소를 지웠습니다.'); notice(errors['not-configured'], true);
  }
  const projectUI = window.HJTeamProjects.create({ node, button, data: () => state.data, epoch: () => state.epoch,
    binding: () => state.data && state.identity ? { apiUrl, portalUrl: state.portalUrl, officeId: state.identity.officeId, userId: state.identity.userId } : null,
    api, accept: acceptData, notice, message, onError: handleReadError, hasTaskDraft: () => !!state.editor, openTask: t => openEditor('task', t), statuses });
  $('loginForm').addEventListener('submit', login); $('logout').onclick = logout; $('refresh').onclick = read;
  $('copyIdentity').onclick = async () => { try { await navigator.clipboard.writeText($('identity').textContent); notice('계정 연결용 식별정보를 복사했습니다. 비밀번호는 포함되지 않습니다.'); } catch (_) { notice('복사 권한이 없습니다. 펼친 식별정보를 직접 선택해 복사해 주세요.', true); } };
  Object.entries(navPages).forEach(([key, page]) => $('tab' + key).onclick = () => go(page));
  filterIds.forEach(k => $(k)[k === 'search' ? 'oninput' : 'onchange'] = () => { rememberFilters(); renderTasks(); });
  $('resetFilters').onclick = () => { resetFilters(); if (state.page === 'review') $('statusFilter').value = 'review'; rememberFilters(); renderTasks(); };
  $('backTeams').onclick = () => go('teams'); window.addEventListener('hashchange', () => go(location.hash.slice(1), false));
  document.querySelector('.skip').onclick = e => { e.preventDefault(); $('pageTitle').focus(); $('pageTitle').scrollIntoView({ block: 'start' }); };
  $('newTask').onclick = () => openEditor('task'); $('newTeam').onclick = () => openEditor('team'); $('newMember').onclick = () => openEditor('member');
  $('editorClose').onclick = closeEditor; $('editor').addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
  $('editorForm').addEventListener('submit', save); $('compare').onclick = compare; $('rebase').onclick = rebase;
  $('importButton').onclick = () => { $('importPanel').hidden = false; $('importFile').focus(); }; $('importFile').onchange = importDrafts;
  $('handoffLoad').onclick = loadHandoff; $('handoffDrop').onclick = () => { if (confirm('현장 앱에서 보낸 초안을 버릴까요? 현장 앱의 원래 업무는 그대로입니다.')) { dropHandoff(); renderHandoff(); } };
  $('selfCheck').onclick = selfCheck; $('ownerCheck').onclick = ownerCheck; $('apiSave').onclick = saveConnect; $('apiClear').onclick = clearConnect;
  $('apiUrlInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveConnect(); } });
  window.addEventListener('pagehide', () => { endSession('화면을 떠나 로그아웃되었습니다. 다시 로그인해 주세요.'); });
  window.addEventListener('pageshow', e => { if (e.persisted) endSession('다시 로그인해 주세요.'); });
  window.addEventListener('beforeunload', e => { if (state.editor || projectUI.hasDraft()) { e.preventDefault(); e.returnValue = ''; } });
  (async () => {
    renderConnect();
    if (!endpointPattern.test(apiUrl)) { notice(errors['not-configured'] + ' 대표는 아래 「서버 연결 설정」에서 서버 주소를 넣을 수 있습니다.', true); return; }
    const epoch = state.epoch;
    try { const health = await healthOf(apiUrl, epoch); if (epoch !== state.epoch) return; state.portalUrl = health.portalUrl; loginEnabled(true); notice('개인 계정으로 로그인해 회사에서 허용한 업무를 확인하세요.'); }
    catch (e) { if (epoch === state.epoch && codeOf(e) !== 'stale') { notice(connectMessage(e), true); if (!configFixed) $('connectBox').open = true; } }
  })();
})();

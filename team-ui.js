/* Standalone company portal: no legacy scripts, persistence, shared token or offline writes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const roles = { owner: '대표·관리자', lead: '팀장', member: '직원', external: '외주' };
  const statuses = { todo: '대기', doing: '진행', blocked: '막힘', review: '검수 요청', done: '완료' };
  const transitions = { todo: ['doing', 'blocked', 'review'], doing: ['blocked', 'review'], blocked: ['doing', 'review'], review: ['doing', 'done'], done: ['doing'] };
  const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const apiUrl = typeof window.HJ_TEAM_CONFIG?.apiUrl === 'string' ? window.HJ_TEAM_CONFIG.apiUrl : '';
  const state = { epoch: 0, token: '', portalUrl: '', identity: null, data: null, editor: null, imports: [], expiry: 0, timer: 0, reading: false };
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
    'handoff-required': '막힘·검수 요청에는 이유 또는 인수인계 내용을 적어 주세요.',
    duplicate: '같은 이름 또는 계정이 이미 등록되어 있습니다.', 'duplicate-source': '이 기존 업무는 이미 공유 업무로 등록되었습니다. 최신 자료를 확인해 주세요.',
    'team-in-use': '활성 직원이나 미완료 업무가 있는 팀은 비활성화할 수 없습니다.',
    'self-lockout': '자신의 관리자 권한·계정·활성 상태는 해제할 수 없습니다.', 'last-owner': '마지막 관리자는 해제할 수 없습니다.',
    'identity-immutable': '이미 연결한 계정의 식별정보는 바꿀 수 없습니다.', 'reassign-open-tasks': '먼저 남은 업무를 다른 담당자에게 배정해 주세요.',
    'not-found': '대상이 변경되었거나 없습니다. 최신 자료와 비교해 주세요.', capacity: '서버 보관 한도에 도달했습니다. 관리자에게 확인해 주세요.',
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
    if (!d.tasks.every(t => d.me.role === 'owner' || (d.me.role === 'lead' && d.me.teamIds.includes(t.teamId)) || t.assigneeId === d.me.id)) return false;
    if (d.me.role !== 'owner' && d.audit.length) return false;
    return d.audit.every(a => a && str(a.at, 40) && id(a.actorId) && ['teamSave', 'memberSave', 'taskSave'].includes(a.action) && id(a.targetId) && str(a.kind, 20) && Number.isSafeInteger(a.revision));
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
    state.data = null; state.imports = []; state.editor = null; $('workspace').hidden = true;
    if ($('editor').open) $('editor').close();
    ['taskList', 'orgList', 'auditList', 'importList', 'editorFields', 'conflictLatest'].forEach(k => $(k).replaceChildren());
    $('importFile').value = ''; $('importNotice').textContent = ''; $('importPanel').hidden = true;
    $('search').value = ''; $('scopeFilter').value = 'mine'; $('statusFilter').value = 'open'; $('teamFilter').replaceChildren(new Option('모든 팀', ''));
    $('taskStats').textContent = ''; $('lastRead').textContent = ''; editorNotice('');
  }
  function endSession(text) {
    state.epoch++; activeRequests.forEach(c => c.abort()); activeRequests.clear(); clearTimeout(state.timer);
    state.token = ''; state.identity = null; state.expiry = 0; state.reading = false; clearWorkspace();
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
    clearWorkspace(); $('who').textContent = '로그인됨 · 회사 권한 확인 필요'; notice(message(e), true);
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
  function showTab(name) { ['tasks', 'org', 'audit'].forEach(k => { $(k + 'Panel').hidden = k !== name; $('tab' + k[0].toUpperCase() + k.slice(1)).setAttribute('aria-pressed', String(k === name)); }); }
  function render() {
    const d = state.data; if (!d) return;
    $('workspace').hidden = false; $('who').textContent = d.me.name + ' · ' + roles[d.me.role];
    $('lastRead').textContent = '조회 ' + new Date().toLocaleString('ko-KR') + ' · 자료 버전 ' + d.revision;
    const owner = d.me.role === 'owner', assign = assignableTeams().length > 0;
    $('orgActions').hidden = !owner; $('tabAudit').hidden = !owner; if (!owner && !$('auditPanel').hidden) showTab('tasks');
    $('newTask').hidden = !assign; $('importButton').hidden = !assign;
    const selected = $('teamFilter').value; $('teamFilter').replaceChildren(new Option('모든 팀', ''));
    d.teams.forEach(t => $('teamFilter').add(new Option(t.name + (t.active ? '' : ' · 비활성'), t.id)));
    if (d.teams.some(t => t.id === selected)) $('teamFilter').value = selected;
    renderTasks(); renderOrg(); renderAudit(); renderImports();
  }
  function renderTasks() {
    const d = state.data; if (!d) return;
    const term = $('search').value.normalize('NFKC').toLocaleLowerCase().replace(/\s/g, '');
    const tasks = d.tasks.filter(t => ($('scopeFilter').value !== 'mine' || t.assigneeId === d.me.id) && (!$('teamFilter').value || t.teamId === $('teamFilter').value) && ($('statusFilter').value === 'all' || ($('statusFilter').value === 'open' ? t.status !== 'done' : t.status === $('statusFilter').value)) && (t.project + t.title).normalize('NFKC').toLocaleLowerCase().replace(/\s/g, '').includes(term)).slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'ko'));
    $('taskStats').textContent = '선택한 조건 ' + tasks.length + '건 · 막힘 ' + tasks.filter(t => t.status === 'blocked').length + '건 · 검수 요청 ' + tasks.filter(t => t.status === 'review').length + '건';
    $('taskList').replaceChildren(); if (!tasks.length) $('taskList').append(node('p', '표시할 업무가 없습니다. 담당자 또는 필터를 확인해 주세요.', 'muted'));
    tasks.forEach(t => {
      const card = node('article', undefined, 'task'), top = node('div', undefined, 'row between');
      top.append(node('span', statuses[t.status], 'badge ' + t.status), node('span', t.due ? '기한 ' + t.due : '기한 미지정', 'meta'));
      card.append(top, node('p', t.project, 'meta'), node('h3', t.title), node('p', teamName(t.teamId) + ' · ' + memberName(t.assigneeId), 'meta'));
      if (t.handoff) card.append(node('p', t.handoff, 'pre'));
      card.append(button('업무 확인·수정', () => openEditor('task', t))); $('taskList').append(card);
    });
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
    $('auditList').replaceChildren(); const labels = { teamSave: '팀 변경', memberSave: '직원 권한 변경', taskSave: '업무 변경' };
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
    $('editor').close(); state.editor = null; $('editorFields').replaceChildren();
  }
  function openEditor(kind, old = {}, imported = null) {
    if (!state.data || state.editor || (kind !== 'task' && state.data.me.role !== 'owner')) return;
    if (kind === 'task' && !old.id && !assignableTeams().length) return;
    state.editor = { kind, old: JSON.parse(JSON.stringify(old)), revision: state.data.revision, pending: null, busy: false, conflict: false, imported };
    const form = $('editorFields'); form.replaceChildren(); editorNotice(''); $('conflictLatest').hidden = true; $('compare').hidden = true; $('rebase').hidden = true; $('save').hidden = false; $('save').disabled = false; $('save').textContent = '저장';
    $('editorTitle').textContent = ({ team: '팀', member: '직원 권한', task: '업무' })[kind] + (old.id ? ' 수정' : ' 등록');
    if (kind === 'team') {
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
      const source = imported || old, canEdit = !old.id || canAssign(old.teamId);
      field(form, 'title', '할 일', 'text', source.title || '', { max: 160, required: true, disabled: !canEdit });
      field(form, 'project', '현장명', 'text', source.project || '', { max: 160, required: true, disabled: !canEdit, help: '기존 현장과 같은 이름으로 입력하세요. 사진·견적 자료를 자동 공유하지 않습니다.' });
      const available = canEdit ? assignableTeams() : state.data.teams.filter(t => t.id === old.teamId);
      const teams = field(form, 'teamId', '담당 팀', 'select', old.teamId || available[0]?.id || '', { required: true, disabled: !canEdit, options: available.map(t => [t.id, t.name]) });
      const assignee = field(form, 'assigneeId', '담당자', 'select', '', { required: true, disabled: !canEdit });
      const setAssignees = (preferred) => { assignee.replaceChildren(new Option('담당자를 선택하세요', '')); state.data.members.filter(m => m.active && m.teamIds.includes(teams.value)).forEach(m => assignee.add(new Option(m.name + ' · ' + roles[m.role], m.id))); if ([...assignee.options].some(o => o.value === preferred)) assignee.value = preferred; };
      setAssignees(old.assigneeId || ''); teams.onchange = () => setAssignees('');
      field(form, 'due', '작업 기한', 'date', source.due || '', { disabled: !canEdit });
      const states = old.id ? [old.status, ...transitions[old.status].filter(s => canEdit || s !== 'done' && old.status !== 'done')] : ['todo'];
      field(form, 'status', '진행 상태', 'select', old.status || 'todo', { options: states.map(s => [s, statuses[s]]) });
      field(form, 'handoff', '작업 내용·막힌 이유·인수인계', 'textarea', source.handoff || '', { max: 2000, help: '막힘·검수 요청에는 내용을 적어 주세요. 고객 연락처·출입 비밀번호는 적지 마세요.' });
      if (source.sourceRef) form.append(node('p', '기존 업무 연결 번호: ' + source.sourceRef, 'meta'));
      if (!canEdit) form.append(node('p', '배정 정보는 대표·팀장이 변경합니다. 내 업무의 진행 상황과 인수인계만 수정할 수 있습니다.', 'notice'));
    }
    $('editor').showModal();
  }
  function entityFromForm() {
    const e = state.editor, value = k => $('edit-' + k).value, old = e.old;
    if (e.kind === 'team') return { id: old.id || '', name: value('name').trim(), active: value('active') === 'true' };
    if (e.kind === 'member') return { id: old.id || '', name: value('name').trim(), userId: value('userId').trim(), officeId: value('officeId'), role: value('role'), active: value('active') === 'true', teamIds: [...$('editorFields').querySelectorAll('input[name=teamIds]:checked')].map(i => i.value) };
    return { id: old.id || '', title: value('title').trim(), project: value('project').trim(), teamId: value('teamId'), assigneeId: value('assigneeId'), due: value('due'), status: value('status'), handoff: value('handoff'), sourceRef: e.imported?.sourceRef || old.sourceRef || '' };
  }
  function freezeFields(freeze) {
    [...$('editorFields').querySelectorAll('input,select,textarea')].forEach(n => { if (freeze) { if (!n.disabled) n.dataset.temporarilyDisabled = '1'; n.disabled = true; } else if (n.dataset.temporarilyDisabled) { n.disabled = false; delete n.dataset.temporarilyDisabled; } });
  }
  async function save(e) {
    e.preventDefault(); const edit = state.editor; if (!edit || edit.busy || edit.conflict) return;
    if (!edit.pending) {
      if (!$('editorForm').reportValidity()) return;
      const entity = entityFromForm(); if (['blocked', 'review'].includes(entity.status) && !entity.handoff.trim()) { editorNotice(errors['handoff-required']); return; }
      if (!crypto.randomUUID) { editorNotice('이 브라우저에서 안전한 요청 번호를 만들 수 없습니다. 최신 브라우저를 사용해 주세요.'); return; }
      edit.pending = { action: edit.kind + 'Save', payload: { requestId: crypto.randomUUID(), revision: edit.revision, entity } };
    }
    const epoch = state.epoch; edit.busy = true; freezeFields(true); $('save').disabled = true; editorNotice('서버에 저장 결과를 확인하고 있습니다.', false);
    try {
      const r = await api(edit.pending.action, edit.pending.payload); if (epoch !== state.epoch || state.editor !== edit) return;
      acceptData(r.data); edit.pending = null; edit.busy = false; $('editor').close(); state.editor = null; $('editorFields').replaceChildren(); notice('공유 업무 자료를 저장했습니다. 동료 기기에서는 최신 자료 확인을 눌러 볼 수 있습니다.');
    } catch (err) {
      if (epoch !== state.epoch || state.editor !== edit) return;
      const code = codeOf(err); if (code === 'session-expired') { endSession(message(err)); return; }
      if (code === 'forbidden') { handleReadError(err); return; }
      editorNotice(message(err));
      if (['conflict', 'request-conflict', 'not-found', 'duplicate-source'].includes(code)) { edit.pending = null; edit.conflict = true; $('compare').hidden = false; $('save').disabled = true; freezeFields(false); }
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
    e.revision = e.latestRevision; e.conflict = false; e.pending = null; freezeFields(false); $('save').disabled = false; $('save').textContent = '검토한 내용 저장'; $('compare').hidden = true; $('rebase').hidden = true;
    editorNotice('최신 버전을 기준으로 다시 검토할 수 있습니다. 저장을 눌러야 전송됩니다.', false);
  }
  async function importDrafts() {
    if (!state.data || !assignableTeams().length) return;
    const file = $('importFile').files[0]; if (!file) return; const epoch = state.epoch;
    try {
      if (file.size > 512000) fail('invalid-input'); const text = await file.text(); if (epoch !== state.epoch || !state.data) return;
      const v = JSON.parse(text);
      if (!v || v.format !== 'company-task-drafts-v1' || !Array.isArray(v.tasks) || v.tasks.length > 100) fail('invalid-input');
      if (!v.tasks.every(t => t && Object.keys(t).every(k => ['title', 'project', 'due', 'handoff', 'sourceRef'].includes(k)) && str(t.title, 160, false) && str(t.project, 160, false) && str(t.due, 10) && (!t.due || /^\d{4}-\d{2}-\d{2}$/.test(t.due)) && str(t.handoff) && str(t.sourceRef, 150, false)) || !unique(v.tasks.map(t => t.sourceRef))) fail('invalid-input');
      state.imports = v.tasks.map(t => ({ title: t.title, project: t.project, due: t.due, handoff: t.handoff, sourceRef: t.sourceRef }));
      $('importNotice').textContent = state.imports.length + '건을 이 화면에만 불러왔습니다. 아직 서버에 저장하지 않았습니다.'; renderImports();
    } catch (_) { if (epoch === state.epoch) $('importNotice').textContent = '업무 초안 파일을 확인해 주세요. 기존 초안과 서버 자료는 변경하지 않았습니다.'; }
  }
  function renderImports() {
    $('importList').replaceChildren(); if (!state.data) return;
    state.imports.forEach(t => { const row = node('div', undefined, 'row between'), exists = state.data.tasks.some(x => x.sourceRef === t.sourceRef); row.append(node('p', t.project + ' · ' + t.title)); const b = button(exists ? '이미 등록됨' : '배정 초안 열기', () => openEditor('task', {}, t)); b.disabled = exists; row.append(b); $('importList').append(row); });
  }
  $('loginForm').addEventListener('submit', login); $('logout').onclick = logout; $('refresh').onclick = read;
  $('copyIdentity').onclick = async () => { try { await navigator.clipboard.writeText($('identity').textContent); notice('계정 연결용 식별정보를 복사했습니다. 비밀번호는 포함되지 않습니다.'); } catch (_) { notice('복사 권한이 없습니다. 펼친 식별정보를 직접 선택해 복사해 주세요.', true); } };
  ['Tasks', 'Org', 'Audit'].forEach(k => $('tab' + k).onclick = () => showTab(k.toLowerCase()));
  ['scopeFilter', 'teamFilter', 'statusFilter'].forEach(k => $(k).onchange = renderTasks); $('search').oninput = renderTasks;
  $('newTask').onclick = () => openEditor('task'); $('newTeam').onclick = () => openEditor('team'); $('newMember').onclick = () => openEditor('member');
  $('editorClose').onclick = closeEditor; $('editor').addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
  $('editorForm').addEventListener('submit', save); $('compare').onclick = compare; $('rebase').onclick = rebase;
  $('importButton').onclick = () => { $('importPanel').hidden = false; $('importFile').focus(); }; $('importFile').onchange = importDrafts;
  window.addEventListener('pagehide', () => { endSession('화면을 떠나 로그아웃되었습니다. 다시 로그인해 주세요.'); });
  window.addEventListener('pageshow', e => { if (e.persisted) endSession('다시 로그인해 주세요.'); });
  window.addEventListener('beforeunload', e => { if (state.editor) { e.preventDefault(); e.returnValue = ''; } });
  (async () => {
    if (!endpointPattern.test(apiUrl)) { notice(errors['not-configured'], true); return; }
    try { const health = await request(apiUrl, { action: 'health' }); if (health.service !== 'company-team-v1' || !endpointPattern.test(health.portalUrl)) fail('bad-response'); state.portalUrl = health.portalUrl; loginEnabled(true); notice('개인 계정으로 로그인해 회사에서 허용한 업무를 확인하세요.'); }
    catch (e) { if (codeOf(e) !== 'stale') notice(message(e), true); }
  })();
})();

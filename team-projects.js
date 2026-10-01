/* Company-only work planning and claim preparation. No legacy storage or insurer submission. */
window.HJTeamProjects = Object.freeze({ create(ctx) {
  'use strict';
  const { node: n, button: b } = ctx, phases = { before: '작업 전', cause: '원인 확인', during: '작업 중', after: '마무리', document: '증빙 서류' };
  const types = { undecided: '담당자 확인 전', 'customer-support': '고객 보험 청구 지원', 'contractor-billing': '보험 의뢰 공사비 청구' };
  const messages = { 'schedule-conflict': '담당자의 다른 일정과 겹칩니다. 시간 또는 담당자를 바꿔 주세요.', 'invalid-schedule': '작업일과 시작·종료 시간을 함께 입력하세요.', 'project-in-use': '사용 중인 프로젝트입니다.', 'evidence-bound': '사진이 연결된 업무의 프로젝트는 바꿀 수 없습니다.', 'invalid-project': '연결 가능한 프로젝트를 선택하세요.', 'evidence-missing': '선택한 증빙을 확인할 수 없습니다.', 'invalid-file': 'JPG·PNG·WebP·HEIC 사진(12MiB), MP4·MOV·WebM 동영상(100MB) 또는 대표용 PDF 원본과 크기를 확인하세요.', 'hash-mismatch': '원본 해시가 일치하지 않습니다. 원본 저장 상태를 확인해야 합니다.', 'storage-ambiguous': '동일 번호의 원본이 여러 개입니다. 자동 처리하지 않으며 관리자 확인이 필요합니다.', 'review-required': '자료가 바뀌었거나 검토 전입니다. 제출 자료를 다시 검토해 주세요.', 'review-stale': '검토한 자료가 바뀌었습니다. 최신 내용으로 다시 검토해 주세요.', 'claim-incomplete': '청구 방식·보험사·사고일·발견 및 보수 내용·금액·사진·동의 확인을 완료하세요.', 'project-immutable': '기존 청구 건의 프로젝트는 바꿀 수 없습니다.', 'private-storage-required': '회사 전용 비공개 저장 폴더를 확인해야 합니다.' };
  let selected = '', day = localDay(), edit = null, busy = false, viewEpoch = 0;
  const objectUrls = new Set(), photoUrls = new Set();
  const HEIC2ANY = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js'; // Same CDN and version as the main app.
  const dlg = n('dialog'); dlg.id = 'projectEditor'; dlg.setAttribute('aria-labelledby', 'projectEditTitle');
  const form = n('form'), head = n('div', undefined, 'dialog-head row between'), title = n('h2'); title.id = 'projectEditTitle';
  const close = b('닫기', closeEdit); close.id = 'projectEditClose'; head.append(title, close);
  const fields = n('div', undefined, 'dialog-body'); fields.id = 'projectFields';
  const foot = n('div', undefined, 'dialog-foot'), msg = n('p', '', 'notice'); msg.id = 'projectEditMessage'; msg.setAttribute('role', 'status');
  const save = n('button', '저장', 'primary'); save.id = 'projectSave'; save.type = 'submit';
  const compare = b('최신 내용 확인', compareEdit), rebase = b('비교한 초안 다시 검토', rebaseEdit); compare.hidden = true; rebase.hidden = true;
  foot.append(msg, compare, rebase, save); form.append(head, fields, foot); dlg.append(form); document.body.append(dlg);
  dlg.addEventListener('cancel', e => { e.preventDefault(); closeEdit(); }); form.onsubmit = submit;
  function localDay() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  const data = () => ctx.data(), owner = () => data()?.me.role === 'owner';
  const manager = () => ['owner', 'lead'].includes(data()?.me.role);
  const projects = () => data()?.projects || [], evidence = () => data()?.evidence || [], claims = () => data()?.claims || [];
  const queue = window.HJTeamUpload.create({ api: ctx.api, accept: ctx.accept, data, epoch: ctx.epoch, onError: ctx.onError, onChange: () => renderQueue(),
    onDone: item => ctx.notice(item.entity.name + ' 원본의 서버 저장을 확인했습니다.') });
  const canAssign = team => owner() || data()?.me.role === 'lead' && data().me.teamIds.includes(team);
  const errText = e => messages[e.code] || ctx.message(e);
  const choices = (el, list, value = '') => { el.replaceChildren(...list.map(([v, label]) => new Option(label, v))); el.value = value; return el; };
  function field(root, key, label, type = 'text', value = '', options = {}) {
    const wrap = n('label', undefined, 'field'), el = n(type === 'select' || type === 'textarea' ? type : 'input');
    el.id = 'xp-' + key; wrap.htmlFor = el.id; el.name = key; if (el.tagName === 'INPUT') el.type = type;
    if (options.choices) choices(el, options.choices, value); else el.value = value;
    if (options.required) el.required = true; if (options.max) el.maxLength = options.max;
    if (type === 'number') { el.min = '0'; el.max = '1000000000000'; el.step = '1'; }
    wrap.append(n('span', label), el); if (options.help) wrap.append(n('small', options.help)); root.append(wrap); return el;
  }
  function check(root, key, label, checked = false, value = '') { const wrap = n('label', undefined, 'check'), el = n('input'); el.type = 'checkbox'; el.name = key; el.value = value; el.checked = checked; wrap.append(el, n('span', label)); root.append(wrap); return el; }
  const value = key => form.elements.namedItem(key)?.value || '';
  const checks = key => [...fields.querySelectorAll('input[name="' + key + '"]:checked')].map(el => el.value);
  function reset() {
    viewEpoch++; busy = false; selected = ''; edit = null; fields.replaceChildren(); msg.textContent = ''; dlg.close(); queue.stop();
    objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear(); photoUrls.clear();
    ['plannerPanel', 'projectsPanel', 'claimsPanel'].forEach(id => document.getElementById(id)?.replaceChildren());
  }
  function closeEdit() {
    if (!edit) { dlg.close(); return; }
    if (edit.busy) { msg.textContent = '전송 결과를 확인 중입니다. 로그아웃하면 이 기기의 임시 자료는 지워집니다.'; return; }
    if (edit.pending && !confirm('일부 전송 결과가 확인되지 않았을 수 있습니다. 닫은 뒤 최신 자료에서 등록 여부를 확인하세요. 닫을까요?')) return;
    edit = null; fields.replaceChildren(); dlg.close(); document.getElementById('pageTitle').focus();
  }
  function begin(kind, label, entity = {}) {
    if (!data() || edit || ctx.hasTaskDraft() || busy) return false;
    edit = { kind, old: JSON.parse(JSON.stringify(entity)), revision: data().revision, pending: null, busy: false, blocked: false, epoch: ctx.epoch(), localEpoch: viewEpoch };
    fields.replaceChildren(); title.textContent = label; msg.textContent = '입력 후 저장을 눌러야 회사 서버에 반영됩니다.'; compare.hidden = rebase.hidden = true; save.hidden = false; save.disabled = false; save.textContent = '저장'; dlg.showModal(); return true;
  }
  function freeze(yes) { fields.querySelectorAll('input,select,textarea,button').forEach(el => { if (yes) { if (!el.disabled) el.dataset.xFrozen = '1'; el.disabled = true; } else if (el.dataset.xFrozen) { el.disabled = false; delete el.dataset.xFrozen; } }); }
  const alive = e => edit === e && ctx.epoch() === e.epoch && viewEpoch === e.localEpoch && !!data();
  async function compareEdit() {
    const e = edit; if (!e || e.busy) return; e.busy = true; compare.disabled = true;
    try { const r = await ctx.api('list'); if (!alive(e)) return; ctx.accept(r.data); e.latest = r.data.revision;
      const pre = fields.querySelector('[data-latest]') || n('pre', '', 'notice'); pre.dataset.latest = '1';
      const current = e.old.id ? (e.kind === 'project' ? projects() : ['claim', 'review', 'submission'].includes(e.kind) ? claims() : data().tasks).find(x => x.id === e.old.id) : null;
      pre.textContent = '최신 자료 버전 ' + e.latest + '\n' + (current ? JSON.stringify(current, null, 2) : '신규 작업: 일정표·사진 목록에서 같은 자료가 이미 등록됐는지 먼저 확인하세요.'); fields.append(pre); rebase.hidden = false; msg.textContent = '작성한 값은 유지했습니다. 최신 내용과 비교한 뒤 다시 검토하세요.';
    } catch (error) { if (alive(e)) report(error); } finally { if (alive(e)) { e.busy = false; compare.disabled = false; } }
  }
  function rebaseEdit() {
    if (!edit || edit.latest !== data()?.revision) return;
    if (['review', 'submission'].includes(edit.kind)) { const kind = edit.kind, current = claims().find(c => c.id === edit.old.id); if (!current) return; edit = null; dlg.close(); if (kind === 'review') reviewEditor(current); else submissionEditor(current); return; }
    edit.revision = edit.latest; edit.pending = null;
    edit.blocked = false; freeze(false); save.disabled = false; compare.hidden = rebase.hidden = true; save.textContent = '검토한 내용 저장'; msg.textContent = '다시 저장해야 전송됩니다. 기존 자료를 자동으로 덮어쓰지 않습니다.';
  }
  function report(error) { if (['forbidden', 'session-expired'].includes(error.code)) { ctx.onError(error); return; } msg.textContent = errText(error); }
  function projectEditor(p = {}) {
    if (!owner() || !begin('project', p.id ? '프로젝트 수정' : '프로젝트 등록', p)) return;
    field(fields, 'name', '프로젝트명', 'text', p.name || '', { required: true, max: 160 });
    field(fields, 'active', '운영 상태', 'select', String(p.active !== false), { choices: [['true', '진행'], ['false', '보관']] });
    const group = n('fieldset'); group.append(n('legend', '담당 팀'));
    data().teams.filter(t => t.active).forEach(t => check(group, 'teams', t.name, p.teamIds?.includes(t.id), t.id)); fields.append(group);
    fields.append(n('p', '기존 현장 앱의 이름과 같아도 자동 연결하지 않습니다. 직원 업무에 이 프로젝트를 직접 지정해 사진을 모읍니다.', 'notice'));
  }
  function planner(root) {
    const top = n('div', undefined, 'row between'); top.append(n('h2', '기술자별 작업 배정'));
    if (manager()) top.append(b('최대 10건 일괄 배정', batchEditor, 'primary')); root.append(top);
    root.append(n('p', '등록된 직원의 같은 날 일정과 진행 상태입니다. 실계정 연결은 직원·팀 설정에서 합니다. 시간 미정 업무는 아래에 따로 표시합니다.', 'muted'));
    const date = field(root, 'day', '작업 날짜', 'date', day); date.onchange = () => { day = date.value || localDay(); render('planner'); };
    const grid = n('div', undefined, 'grid'); grid.id = 'technicianBoard'; root.append(grid);
    const members = manager() ? data().members.filter(m => m.active && (owner() || m.teamIds.some(canAssign))) : data().members.filter(m => m.id === data().me.id);
    members.forEach(m => {
      const card = n('article', undefined, 'card'), tasks = data().tasks.filter(t => t.assigneeId === m.id && t.workDate === day).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      card.dataset.technicianId = m.id; card.append(n('h3', m.name), n('p', tasks.length + '건 · 완료 ' + tasks.filter(t => t.status === 'done').length, 'meta'));
      tasks.forEach(t => { const row = n('div', undefined, 'task'); row.append(n('strong', (t.startTime || '시간 미정') + (t.endTime ? '–' + t.endTime : '') + ' · ' + t.project), n('p', t.title + ' · ' + ctx.statuses[t.status]), b('업무 진행·보고', () => ctx.openTask(t))); card.append(row); });
      if (!tasks.length) card.append(n('p', '이 날짜 배정 없음', 'muted')); grid.append(card);
    });
    const unscheduled = data().tasks.filter(t => !t.workDate && t.status !== 'done'); const det = n('details'); det.append(n('summary', '작업일 미지정 ' + unscheduled.length + '건'));
    unscheduled.forEach(t => det.append(b(t.project + ' · ' + t.title, () => ctx.openTask(t)))); root.append(det);
  }
  function batchEditor() {
    if (!manager() || !begin('batch', '기술자 업무 일괄 배정')) return;
    fields.append(n('p', '한 번에 최대 10건. 같은 기술자의 겹치는 시간은 서버에서 차단하며 한 건이라도 잘못되면 전부 저장하지 않습니다.', 'notice'));
    const rows = n('div'); rows.id = 'batchRows'; fields.append(rows);
    const add = b('배정 칸 추가', () => addRow()); fields.append(add);
    function addRow() {
      if (rows.children.length >= 10) return;
      const i = rows.children.length, row = n('fieldset'); row.className = 'batch-row'; row.append(n('legend', '배정 ' + (i + 1)));
      const ps = field(row, 'p' + i, '프로젝트', 'select', '', { required: true, choices: [['', '선택'], ...projects().filter(p => p.active && p.teamIds.some(canAssign)).map(p => [p.id, p.name])] });
      const team = field(row, 't' + i, '담당 팀', 'select', '', { required: true }), person = field(row, 'm' + i, '기술자', 'select', '', { required: true });
      function fillPeople() { choices(person, [['', '선택'], ...data().members.filter(m => m.active && m.teamIds.includes(team.value)).map(m => [m.id, m.name])]); }
      ps.onchange = () => { choices(team, [['', '선택'], ...data().teams.filter(t => t.active && canAssign(t.id) && projects().find(p => p.id === ps.value)?.teamIds.includes(t.id)).map(t => [t.id, t.name])]); fillPeople(); }; team.onchange = fillPeople; ps.onchange();
      field(row, 'title' + i, '할 일', 'text', '', { required: true, max: 160 }); field(row, 'd' + i, '작업일', 'date', day, { required: true });
      const times = n('div', undefined, 'grid'); field(times, 's' + i, '시작', 'time', '09:00', { required: true }); field(times, 'e' + i, '종료', 'time', '12:00', { required: true }); row.append(times); rows.append(row); add.disabled = rows.children.length >= 10;
    }
    addRow();
  }
  function projectPage(root) {
    const top = n('div', undefined, 'row between'); top.append(n('h2', '프로젝트 사진함')); if (owner()) top.append(b('프로젝트 등록', () => projectEditor(), 'primary')); root.append(top);
    root.append(n('p', '기술자는 본인 업무에 연결한 사진만, 팀장은 담당 팀 사진만 볼 수 있습니다. 대표는 프로젝트 전체 사진과 보험 증빙을 모읍니다.', 'muted'));
    const select = field(root, 'projectSelect', '프로젝트 선택', 'select', selected, { choices: [['', '프로젝트를 선택하세요'], ...projects().map(p => [p.id, p.name + (p.active ? '' : ' · 보관')])] });
    if (!projects().some(p => p.id === selected)) selected = ''; select.value = selected; select.onchange = () => { selected = select.value; render('projects'); };
    const p = projects().find(p => p.id === selected); if (!p) { root.append(n('p', '기존 문자열 현장명은 자동 연결되지 않습니다. 대표가 프로젝트 등록 후 업무에 연결해 주세요.', 'notice')); return; }
    const actions = n('div', undefined, 'row'); if (owner()) actions.append(b('프로젝트 수정', () => projectEditor(p)));
    if (data().tasks.some(t => t.projectId === p.id)) actions.append(b('작업 사진·동영상 올리기', () => uploadEditor(p, 'photo'), 'primary'));
    if (owner()) actions.append(b('보험 증빙 서류 올리기', () => uploadEditor(p, 'document'))); root.append(actions);
    const qbox = n('section', undefined, 'card'); qbox.id = 'uploadQueue'; qbox.setAttribute('aria-live', 'polite'); root.append(qbox); renderQueue();
    const tasks = data().tasks.filter(t => t.projectId === p.id); root.append(n('p', '연결 업무 ' + tasks.length + '건 · 완료 ' + tasks.filter(t => t.status === 'done').length + '건', 'meta'));
    tasks.forEach(t => root.append(b(t.title + ' · ' + ctx.statuses[t.status], () => ctx.openTask(t))));
    const grid = n('div', undefined, 'grid photo-grid'); grid.id = 'projectEvidence'; root.append(grid);
    evidence().filter(e => e.projectId === p.id).forEach(e => {
      const card = n('article', undefined, 'card'); card.dataset.evidenceId = e.id;
      card.append(n('h3', (e.kind === 'video' ? '🎬 동영상 · ' : '') + (phases[e.phase] || '증빙')), n('p', e.caption || '설명 없음'), n('p', (e.kind === 'video' ? (e.duration ? '길이 ' + e.duration + '초 · ' : '길이 모름 · ') : '') + (isHeic(e.mime) ? 'HEIC 원본 · ' : '') + (e.capturedDate ? '사용자 입력 촬영일 ' + e.capturedDate + ' · ' : '') + (e.size / 1024 / 1024).toFixed(2) + 'MiB', 'meta'));
      const target = n('div'); card.append(target, b(e.mime === 'application/pdf' ? '원본 서류 받기' : e.kind === 'video' ? '원본 동영상 보기' : '원본 사진 보기', () => showEvidence(e, target))); grid.append(card);
    });
    if (!grid.children.length) grid.append(n('p', '아직 이 프로젝트에 등록한 사진·서류가 없습니다.', 'notice'));
  }
  function uploadEditor(p, kind) {
    if (!begin('upload', kind === 'photo' ? '프로젝트 작업 사진·동영상 올리기' : '대표 전용 보험 증빙 서류', { projectId: p.id, kind })) return;
    fields.append(n('p', p.name, 'page-context'));
    if (kind === 'photo') field(fields, 'task', '사진을 연결할 업무', 'select', '', { required: true, choices: [['', '선택'], ...data().tasks.filter(t => t.projectId === p.id).map(t => [t.id, t.title])] });
    field(fields, 'phase', '작업 단계', 'select', kind === 'photo' ? 'before' : 'document', { choices: Object.entries(phases).filter(([k]) => kind === 'photo' ? k !== 'document' : k === 'document') });
    field(fields, 'caption', '사진·서류 설명', 'textarea', '', { max: 1000 }); field(fields, 'date', '촬영일·작성일 (직접 확인)', 'date');
    const file = field(fields, 'files', kind === 'photo' ? '원본 파일 · 최대 10개 · 사진(JPG·PNG·WebP·HEIC) 각 12MiB, 동영상(MP4·MOV·WebM) 각 100MB 이하' : '원본 파일 · 최대 10개, 각 12MiB 이하', 'file', '', { required: true }); file.multiple = true;
    file.accept = kind === 'photo' ? 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm' : 'image/jpeg,image/png,image/webp,application/pdf';
    fields.append(n('p', '원본을 편집·압축·변환하지 않습니다(HEIC도 원본 그대로). 사진·영상 속 얼굴·차량 번호·주소·위치정보를 확인하세요. 서류는 대표만 볼 수 있습니다.', 'notice'),
      n('p', '[대기열에 넣고 올리기]를 누르면 이 기기의 업로드 대기열에 원본을 보관한 뒤 순서대로 올립니다. 연결이 끊기거나 앱을 다시 열어도, 같은 직원으로 로그인하면 이어서 올립니다. 서버 저장이 확인되면 이 기기 사본은 지웁니다.', 'muted')); save.textContent = '대기열에 넣고 올리기';
  }
  async function sha(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join(''); }
  const isHeic = mime => mime === 'image/heic' || mime === 'image/heif';
  const bad = () => Object.assign(new Error('bad-response'), { code: 'bad-response' });
  async function verifiedFile(e, onProgress) {
    if (e.kind === 'video') {
      // Up to 100MB: 1 MiB verified chunks, then the WHOLE original must match the recorded SHA-256 before anyone sees it.
      const out = new Uint8Array(e.size); let offset = 0;
      while (offset < e.size) {
        const c = (await ctx.api('evidenceReadChunk', { evidenceId: e.id, offset, length: 1048576 })).chunk;
        if (!c || c.offset !== offset || c.sha256 !== e.sha256 || c.size !== e.size || typeof c.base64 !== 'string' || c.base64.length > 1400000) throw bad();
        const part = Uint8Array.from(atob(c.base64), x => x.charCodeAt(0)); if (!part.length || offset + part.length > e.size || c.nextOffset !== offset + part.length) throw bad();
        out.set(part, offset); offset += part.length; if (onProgress) onProgress(offset / e.size);
      }
      if (await sha(out) !== e.sha256) throw bad(); return { ...e, bytes: out };
    }
    const r = await ctx.api('evidenceRead', { evidenceId: e.id }), file = r.file || r;
    if (typeof file.base64 !== 'string' || file.base64.length > 18 * 1024 * 1024 || file.mime !== e.mime || file.sha256 !== e.sha256 || file.size !== e.size) throw bad();
    const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0)); if (bytes.length !== e.size || await sha(bytes) !== e.sha256) throw bad(); return { ...e, bytes };
  }
  let heicLoading = null;
  function loadHeic2any() {
    // Loaded only when this browser cannot draw HEIC itself (most Android/PC Chrome). Preview only: the original is never replaced.
    if (window.heic2any) return Promise.resolve(window.heic2any);
    heicLoading ||= new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = HEIC2ANY; sc.crossOrigin = 'anonymous'; sc.referrerPolicy = 'no-referrer'; sc.onload = () => window.heic2any ? ok(window.heic2any) : no(new Error('heic')); sc.onerror = () => { heicLoading = null; sc.remove(); no(new Error('heic')); }; document.head.append(sc); });
    return heicLoading;
  }
  async function previewSrc(blob, mime) {
    const draw = async src => { const img = new Image(); img.src = src; await img.decode(); return src; };
    const url = URL.createObjectURL(blob); objectUrls.add(url); photoUrls.add(url);
    if (!isHeic(mime)) return url;
    try { return await draw(url); } catch (_) { /* this browser cannot draw HEIC */ }
    const out = await (await loadHeic2any())({ blob, toType: 'image/jpeg', quality: 0.85 }), jpeg = URL.createObjectURL(Array.isArray(out) ? out[0] : out);
    objectUrls.add(jpeg); photoUrls.add(jpeg); return draw(jpeg);
  }
  async function showEvidence(e, target) {
    const epoch = ctx.epoch(), view = viewEpoch, current = () => epoch === ctx.epoch() && view === viewEpoch && !!data() && target.isConnected; target.textContent = '원본 확인 중…';
    try { const file = await verifiedFile(e, f => { if (current()) target.textContent = '원본 확인 중 ' + Math.floor(f * 100) + '%'; }); if (!current()) return;
      const blob = new Blob([file.bytes], { type: e.mime }); if (e.mime === 'application/pdf') { download(blob, '증빙-원본.pdf'); target.textContent = '원본 서류를 다운로드했습니다. 실제 보험사 제출은 하지 않았습니다.'; }
      else if (e.kind === 'video') { const url = URL.createObjectURL(blob); objectUrls.add(url); photoUrls.add(url); const v = n('video'); v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = url; v.setAttribute('aria-label', e.caption || '동영상 원본'); v.style.cssText = 'max-width:100%;height:auto'; target.replaceChildren(v, b('원본 동영상 받기', () => download(blob, '증빙-원본.' + ({ 'video/quicktime': 'mov', 'video/webm': 'webm' }[e.mime] || 'mp4'))));
      } else {
        let src = ''; try { src = await previewSrc(blob, e.mime); } catch (_) { src = ''; } if (!current()) return;
        if (!src) { target.replaceChildren(n('p', '이 기기에서 HEIC 미리보기를 만들지 못했습니다. 원본은 서버에 그대로 있습니다.', 'notice'), b('원본 HEIC 받기', () => download(blob, '증빙-원본.heic'))); return; }
        const img = n('img'); img.src = src; img.alt = e.caption || phases[e.phase]; img.style.cssText = 'max-width:100%;height:auto'; target.replaceChildren(img);
        if (isHeic(e.mime)) target.append(n('p', '미리보기는 JPEG로 바꿔 보여 준 것이며 저장된 원본(HEIC)은 바뀌지 않았습니다.', 'meta'));
      }
    } catch (error) { if (epoch === ctx.epoch() && view === viewEpoch) { target.textContent = errText(error); if (['forbidden', 'session-expired'].includes(error.code)) ctx.onError(error); } }
  }
  function claimPage(root) {
    root.append(n('h2', '보험 제출 준비 · 대표 전용'), n('p', '보험사 시스템과 자동 연동하지 않습니다. 원본 사진·작업 기록·금액을 검토해 자료를 내려받고, 실제 제출은 보험사 담당자 안내에 따라 직접 진행합니다. ZIP 한 묶음은 원본 50개·합계 50MiB 이하입니다.', 'notice'), b('청구 준비 건 만들기', () => claimEditor(), 'primary'));
    const source = n('p', '보험사·담보·사고 유형에 따라 요구 서류가 달라집니다. '), link = n('a', '현대해상 필요서류 안내 예시'); link.href = 'https://www.hi.co.kr/serviceAction.do?menuId=100635'; link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link); root.append(source);
    const list = n('div', undefined, 'grid'); list.id = 'claimList'; root.append(list);
    claims().forEach(c => {
      const card = n('article', undefined, 'card'); card.dataset.claimId = c.id;
      card.append(n('h3', projects().find(p => p.id === c.projectId)?.name || '프로젝트'), n('p', (types[c.mode] || '방식 확인 필요') + ' · ' + (c.insurerName || '보험사 미입력'), 'meta'));
      readinessLines(card, readiness(c));
      // 준비(검토 고정)와 실제 제출 기록은 다른 줄·다른 색이다 — 검토나 ZIP 다운로드를 '제출했다'로 읽지 않게.
      const prep = c.reviewCurrent ? n('p', '✔ 제출 준비 완료(검토 고정)' + (c.reviewedAt ? ' · 검토 ' + String(c.reviewedAt).slice(0, 10) : '') + ' — 보험사 제출은 아직 아닙니다', 'claim-line claim-ready')
        : c.reviewStale ? n('p', '✖ 준비 상태 무효 — 검토 뒤 자료가 바뀌었습니다. 「자료 검토 확인」으로 다시 검토하세요', 'claim-line claim-stale')
        : n('p', '○ 제출 준비 전 — 「자료 검토 확인」이 필요합니다', 'claim-line claim-draft');
      prep.dataset.claimPrep = c.reviewCurrent ? 'ready' : c.reviewStale ? 'stale' : 'draft'; card.append(prep);
      const subs = c.submissions || [];
      if (!subs.length) { const none = n('p', '📮 제출 기록 없음 — 실제로 낸 뒤에만 「직접 제출한 사실 기록」에 적습니다', 'claim-line claim-nosub'); none.dataset.claimSubmission = 'none'; card.append(none); }
      subs.forEach(s => { const line = n('p', '📮 제출 기록(직접 낸 뒤 손으로 적음) · ' + (s.submittedDate || '') + ' · ' + (s.channel || '') + ' · 접수번호 ' + (s.referenceNo || '') + ' · 당시 자료 ' + (s.fingerprint || '').slice(0, 12), 'claim-line claim-submitted'); line.dataset.claimSubmission = 'record'; card.append(line); });
      if (c.status === 'changed-after-submission') card.append(n('p', '마지막 제출 기록 뒤 자료가 바뀌었습니다 — 위 제출 기록은 바뀌기 전 자료 기준입니다', 'meta'));
      const zip = b('제출 준비 ZIP 받기', () => exportClaim(c)), zipNote = n('span', '다운로드는 제출 기록이 아닙니다', 'meta'); zipNote.dataset.zipNote = '1';
      const row = n('div', undefined, 'row'); row.append(b('내용·금액·사진 선택', () => claimEditor(c)), b('자료 검토 확인', () => reviewEditor(c)), zip, zipNote, b('직접 제출한 사실 기록', () => submissionEditor(c))); card.append(row);
      list.append(card);
    });
  }
  // 단계 충족 점검 — 경고만 한다(필수 서류는 대표 결정 전). 서버 teamClaimReadiness_ 와 같은 규칙.
  function readiness(c) {
    const out = { photos: { before: 0, cause: 0, after: 0 }, documents: 0, warnings: [] }, chosen = new Set(c.selectedEvidenceIds || []);
    evidence().filter(e => chosen.has(e.id) && e.projectId === c.projectId).forEach(e => { if (e.kind === 'photo' && Object.hasOwn(out.photos, e.phase)) out.photos[e.phase]++; else if (e.kind === 'document' && e.mime === 'application/pdf') out.documents++; });
    ['before', 'cause', 'after'].forEach(k => { if (!out.photos[k]) out.warnings.push('missing-' + k); }); if (!out.documents) out.warnings.push('missing-document');
    return out;
  }
  const warnText = { 'missing-before': '작업 전 사진', 'missing-cause': '원인 확인 사진', 'missing-after': '마무리 사진', 'missing-document': '수리 내역 서류(PDF)' };
  function readinessLines(root, r) {
    if (!r || !r.photos) return;
    root.append(n('p', '단계 사진 · 작업 전 ' + r.photos.before + ' · 원인 확인 ' + r.photos.cause + ' · 마무리 ' + r.photos.after + ' · 서류 PDF ' + r.documents, 'meta'));
    if (r.warnings.length) { const w = n('p', '⚠ 빠진 단계(경고 — 검토는 막지 않습니다): ' + r.warnings.map(k => warnText[k] || k).join(', '), 'claim-line claim-warn'); w.dataset.claimWarnings = r.warnings.join(' '); root.append(w); }
  }
  function claimEditor(c = {}) {
    if (!owner() || !begin('claim', '보험 제출 준비 정보', c)) return;
    const ps = field(fields, 'projectId', '프로젝트', 'select', c.projectId || '', { required: true, choices: [['', '선택'], ...projects().map(p => [p.id, p.name])] }); if (c.id) ps.disabled = true;
    field(fields, 'mode', '청구 방식', 'select', c.mode || 'undecided', { choices: Object.entries(types) });
    field(fields, 'insurerName', '보험사', 'text', c.insurerName || '', { max: 100 }); field(fields, 'referenceNo', '사고·의뢰 접수번호 (선택)', 'text', c.referenceNo || '', { max: 100 });
    field(fields, 'accidentDate', '사고 확인일', 'date', c.accidentDate || '');
    for (const [key, label] of [['incident', '발견 경위·피해 상황'], ['cause', '확인한 원인 (추정은 추정으로 표기)'], ['repair', '실제 보수 내용']]) field(fields, key, label, 'textarea', c[key] || '', { max: 2000 });
    fields.append(n('p', '주민번호·계좌번호·고객 비밀번호를 적지 마세요. 보험 지급 여부나 금액을 계산하는 화면이 아닙니다.', 'notice'));
    const items = n('div'); items.id = 'claimItems'; fields.append(n('h3', '원인 교정·피해 복구 항목별 금액'), items);
    const add = b('금액 항목 추가', () => addItem({})); fields.append(add);
    function addItem(item) { if (items.children.length >= 50) return; const i = items.children.length, row = n('fieldset'); row.append(n('legend', '항목 ' + (i + 1)));
      field(row, 'kind' + i, '구분', 'select', item.kind || 'cause', { choices: [['cause', '누수 원인 교정'], ['restore', '피해 복구'], ['other', '기타']] }); field(row, 'desc' + i, '세부 내역', 'text', item.description || '', { max: 240 }); field(row, 'amount' + i, '금액 (원 · 세금 포함 여부는 내역에 명시)', 'number', String(item.amount ?? 0)).max = '1000000000'; items.append(row); add.disabled = items.children.length >= 50; }
    (c.items?.length ? c.items : [{}]).forEach(addItem);
    const selectEvidence = n('fieldset'); selectEvidence.id = 'claimEvidence'; fields.append(selectEvidence);
    function populate() { selectEvidence.replaceChildren(n('legend', '함께 제출할 사진·서류 선택')); evidence().filter(e => e.projectId === ps.value).forEach(e => check(selectEvidence, 'evidence', (e.kind === 'video' ? '🎬 동영상 · ' : '') + phases[e.phase] + ' · ' + (e.caption || '설명 없음') + ' · ' + (e.size / 1048576).toFixed(1) + 'MiB', c.selectedEvidenceIds?.includes(e.id), e.id)); }
    ps.onchange = populate; populate();
    check(fields, 'insurerConfirmed', '보험사 담당자에게 이번 사고의 필요서류·제출 경로를 확인했습니다.', c.insurerConfirmed);
    check(fields, 'consentConfirmed', '선택한 고객 자료의 보험 제출 권한·동의를 확인했습니다.', c.consentConfirmed);
    fields.append(n('p', '사진 전/후·원인과 보수 내역·견적 및 지급 증빙을 확인하세요. 목록은 일반 준비 안내이며 개별 보험사의 필수서류를 대신하지 않습니다.', 'muted'));
  }
  async function confirmedBundle(e) {
    e.busy = true; save.disabled = true; msg.textContent = '검토할 최신 자료를 확인하고 있습니다.';
    const r = await ctx.api('claimBundle', { claimId: e.old.id }); if (!alive(e)) return null;
    const bundle = r.bundle || r;
    if (!bundle.claim || bundle.claim.id !== e.old.id || !/^[a-f0-9]{64}$|^[A-Za-z0-9_-]{43}$/.test(bundle.fingerprint)) throw Object.assign(new Error('bad-response'), { code: 'bad-response' });
    e.fingerprint = bundle.fingerprint; e.bundle = bundle;
    fields.append(n('p', JSON.stringify({ project: bundle.project.name, insurer: bundle.claim.insurerName, incident: bundle.claim.incident, cause: bundle.claim.cause, repair: bundle.claim.repair, items: bundle.claim.items, evidence: bundle.evidence.map(x => ({ phase: phases[x.phase], caption: x.caption, hash: x.sha256 })) }, null, 2), 'pre'));
    return bundle;
  }
  async function reviewEditor(c) {
    if (!owner() || !begin('review', '선택 자료 검토 확인', c)) return;
    const e = edit;
    fields.append(n('p', '프로젝트·업무 보고·선택 사진과 서류·금액의 현재 상태를 서버에서 묶어 기록합니다. 이후 관련 자료가 바뀌면 다시 검토해야 합니다. 보험 승인이나 실제 제출 완료를 뜻하지 않습니다.', 'notice'));
    try { const reviewed = await confirmedBundle(e); if (!reviewed) return; readinessLines(fields, reviewed.readiness || readiness(c)); const confirm = check(fields, 'reviewConfirm', '위 최신 내용과 원본 증빙을 직접 확인했습니다.'); confirm.required = true; save.textContent = '현재 자료 검토 기록'; save.disabled = false; msg.textContent = '다른 기기에서 내용이 바뀌면 다시 검토해야 합니다.'; }
    catch (error) { if (alive(e)) { e.blocked = true; report(error); } } finally { if (alive(e)) e.busy = false; }
  }
  async function submissionEditor(c) {
    if (!owner() || !begin('submission', '직접 제출한 사실만 수동 기록', c)) return;
    const e = edit;
    fields.append(n('p', '이 버튼은 보험사에 전송하지 않습니다. 실제 제출 후 확인한 날짜·경로·접수번호를 남깁니다. 이전 기록은 보존하며 보험사 접수 성공을 이 앱이 검증하지는 않습니다.', 'notice'));
    try { const bundle = await confirmedBundle(e); if (!bundle) return; if (!bundle.reviewCurrent) throw Object.assign(new Error('review-stale'), { code: 'review-stale' });
      field(fields, 'submittedDate', '실제 제출일', 'date', localDay(), { required: true }); field(fields, 'channel', '직접 제출한 경로', 'text', '', { required: true, max: 100 }); field(fields, 'referenceNo', '확인한 접수번호', 'text', '', { required: true, max: 100 }); save.textContent = '수동 제출 기록 저장'; save.disabled = false; msg.textContent = '실제로 제출한 경우에만 아래 기록을 저장하세요.';
    } catch (error) { if (alive(e)) { e.blocked = true; report(error); } } finally { if (alive(e)) e.busy = false; }
  }
  function payloadEntity(e) {
    if (e.kind === 'project') return { id: e.old.id || '', name: value('name').trim(), active: value('active') === 'true', teamIds: checks('teams') };
    if (e.kind === 'batch') return { tasks: [...document.getElementById('batchRows').children].map((_, i) => ({ title: value('title' + i), project: projects().find(p => p.id === value('p' + i))?.name || '', projectId: value('p' + i), teamId: value('t' + i), assigneeId: value('m' + i), workDate: value('d' + i), startTime: value('s' + i), endTime: value('e' + i), due: value('d' + i), status: 'todo', handoff: '', sourceRef: '' })) };
    if (e.kind === 'review') return { id: e.old.id, expectedFingerprint: e.fingerprint };
    if (e.kind === 'submission') return { id: e.old.id, expectedFingerprint: e.fingerprint, submittedDate: value('submittedDate'), channel: value('channel'), referenceNo: value('referenceNo') };
    const items = [...document.getElementById('claimItems').children].map((_, i) => ({ kind: value('kind' + i), description: value('desc' + i).trim(), amount: Number(value('amount' + i)) })).filter(i => i.description || i.amount);
    return { id: e.old.id || '', projectId: value('projectId'), mode: value('mode'), insurerName: value('insurerName'), referenceNo: value('referenceNo'), accidentDate: value('accidentDate'), incident: value('incident'), cause: value('cause'), repair: value('repair'), items, selectedEvidenceIds: checks('evidence'), insurerConfirmed: !!checks('insurerConfirmed').length, consentConfirmed: !!checks('consentConfirmed').length };
  }
  async function enqueueUpload(e) {
    const meta = { projectId: e.old.projectId, taskId: value('task'), phase: value('phase'), caption: value('caption'), capturedDate: value('date') };
    msg.textContent = '원본을 확인하고 있습니다(해시 계산).';
    const prepared = await window.HJTeamUpload.prepare(form.elements.namedItem('files').files, e.old.kind === 'document', meta); if (!alive(e)) return;
    if (prepared.error) throw Object.assign(new Error('invalid-input'), { code: 'invalid-input', detail: prepared.error });
    const r = await queue.add(prepared.entries); if (!alive(e)) return;
    edit = null; fields.replaceChildren(); dlg.close(); render('projects');
    ctx.notice(r.added + '개를 올리기 대기열에 넣었습니다.' + (r.skipped ? ' 이미 올렸거나 대기 중인 같은 원본 ' + r.skipped + '개는 뺐습니다.' : '') + (r.deviceOnly ? ' 이 기기 저장 공간이 부족해 ' + r.deviceOnly + '개 원본은 보관하지 못했습니다 — 화면을 닫거나 로그아웃하면 다시 골라야 합니다.' : ''), !!r.deviceOnly);
  }
  function renderQueue() {
    const box = document.getElementById('uploadQueue'); if (!box) return;
    const rows = queue.view(), stateText = { queued: '대기', uploading: '올리는 중', waiting: '다시 시도 대기', failed: '실패', done: '완료' };
    box.replaceChildren(n('h3', '올리기 대기열 ' + rows.length + '개'));
    if (!rows.length) { box.append(n('p', '대기 중인 원본이 없습니다.', 'muted')); return; }
    box.append(n('p', '서버 저장이 확인될 때까지 원본 사본이 이 기기에 남습니다. 공용 기기라면 다 올린 뒤 확인하세요.', 'muted'));
    rows.forEach(r => {
      const row = n('div', undefined, 'task'); row.dataset.queueKey = r.key; row.dataset.queueState = r.state;
      const pct = Math.floor(r.progress * 100), label = (r.kind === 'video' ? '🎬 ' : '') + r.name + ' · ' + (r.size / 1048576).toFixed(1) + 'MiB';
      row.append(n('strong', label), n('p', stateText[r.state] + (r.state === 'uploading' && r.kind === 'video' ? ' ' + pct + '%' : '') + (r.state === 'waiting' ? ' · ' + r.attempts + '번째 실패' : ''), 'meta'));
      if (r.state === 'uploading' && r.kind === 'video') { const bar = n('progress'); bar.max = 100; bar.value = pct; bar.setAttribute('aria-label', r.name + ' 올리는 중'); row.append(bar); }
      if (r.reason) row.append(n('p', r.reason, r.state === 'failed' ? 'notice error' : 'muted'));
      if (r.deviceOnly) row.append(n('p', '이 기기에 원본을 보관하지 못했습니다(저장 공간 부족 또는 비공개 모드). 화면을 닫거나 로그아웃하면 다시 골라야 합니다.', 'notice error'));
      const tools = n('div', undefined, 'row');
      if (r.state === 'failed' || r.state === 'waiting') tools.append(b('다시 올리기', () => queue.retry(r.key)));
      tools.append(b('취소', () => { if (confirm(r.name + ' 올리기를 취소하고 이 기기 사본을 지울까요? 이미 서버에 저장된 경우에는 서버 자료가 지워지지 않습니다.')) queue.cancel(r.key); }));
      row.append(tools); box.append(row);
    });
  }
  async function submit(event) {
    event.preventDefault(); const e = edit; if (!e || e.busy || e.blocked || !data()) return;
    if (!e.pending && !form.reportValidity()) return; e.busy = true; freeze(true); save.disabled = true;
    try {
      if (e.kind === 'upload') { await enqueueUpload(e); return; }
      if (e.kind === 'claim') { const total = evidence().filter(x => checks('evidence').includes(x.id)).reduce((sum, x) => sum + x.size, 0); if (total > 50 * 1048576) throw Object.assign(new Error('invalid-input'), { code: 'invalid-input', detail: '함께 낼 사진·동영상·서류 합계가 50MiB를 넘습니다(지금 ' + (total / 1048576).toFixed(1) + 'MiB). 큰 동영상은 빼고 [원본 동영상 받기]로 따로 전달하세요.' }); }
      if (!e.pending) e.pending = { action: ({ project: 'projectSave', batch: 'taskBatch', claim: 'claimSave', review: 'claimReview', submission: 'claimSubmitRecord' })[e.kind], payload: { requestId: crypto.randomUUID(), revision: e.revision, entity: payloadEntity(e) } };
      if (!alive(e)) return;
      msg.textContent = '저장 결과 확인 중…';
      const r = await ctx.api(e.pending.action, e.pending.payload); if (!alive(e)) return; ctx.accept(r.data); e.pending = null;
      e.busy = false; edit = null; fields.replaceChildren(); dlg.close(); ctx.notice('공유 자료를 저장했습니다. 동료는 최신 자료 확인 후 볼 수 있습니다.');
    } catch (error) {
      if (!alive(e)) return; if (error.detail) { msg.textContent = error.detail; freeze(false); return; } report(error); if (!alive(e)) return;
      if (['conflict', 'request-conflict', 'not-found', 'review-stale'].includes(error.code)) { e.blocked = true; compare.hidden = false; }
      else if (['network', 'bad-response', 'server-error', 'storage-failed', 'busy', 'auth-unavailable'].includes(error.code) || !error.code) { save.textContent = '같은 요청으로 결과 재확인'; }
      else { e.pending = null; freeze(false); save.textContent = '입력 수정 후 저장'; }
    } finally { if (alive(e)) { e.busy = false; save.disabled = e.blocked; } }
  }
  function download(blob, filename) { const url = URL.createObjectURL(blob); objectUrls.add(url); const a = n('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => { URL.revokeObjectURL(url); objectUrls.delete(url); }, 30000); }
  async function exportClaim(c) {
    if (!owner() || edit || busy) return; busy = true; const epoch = ctx.epoch(), view = viewEpoch;
    const current = () => epoch === ctx.epoch() && view === viewEpoch && owner();
    try {
      ctx.notice('보험 제출 준비 자료를 검증하고 있습니다. 실제 보험사로 전송하지 않습니다.');
      const first = await ctx.api('claimBundle', { claimId: c.id }); if (!current()) return; const bundle = first.bundle || first;
      if (!bundle.reviewCurrent || !Array.isArray(bundle.evidence) || bundle.evidence.length > 50 || bundle.evidence.reduce((s, e) => s + e.size, 0) > 50 * 1048576) throw Object.assign(new Error('review-required'), { code: 'review-required' });
      const files = []; for (const e of bundle.evidence) { files.push(await verifiedFile(e)); if (!current()) return; }
      const last = await ctx.api('claimBundle', { claimId: c.id }); if (!current()) return; const latest = last.bundle || last;
      if (!latest.reviewCurrent || latest.fingerprint !== bundle.fingerprint) throw Object.assign(new Error('review-required'), { code: 'review-required' });
      const zip = await window.HJTeamPacket.build(bundle, files); if (!current()) return;
      const final = await ctx.api('claimBundle', { claimId: c.id }); if (!current()) return;
      if (!(final.bundle || final).reviewCurrent || (final.bundle || final).fingerprint !== bundle.fingerprint) throw Object.assign(new Error('review-required'), { code: 'review-required' });
      download(zip, '보험-제출준비.zip'); ctx.notice('제출 준비 ZIP을 만들었습니다. 압축을 푼 뒤 report.html에서 내용을 확인하세요. 실제 보험 제출은 하지 않았습니다.');
    } catch (error) { if (current()) { ctx.notice(errText(error), true); if (['forbidden', 'session-expired'].includes(error.code)) ctx.onError(error); } }
    finally { if (current()) busy = false; }
  }
  function render(page) {
    photoUrls.forEach(url => { URL.revokeObjectURL(url); objectUrls.delete(url); }); photoUrls.clear();
    ['planner', 'projects', 'claims'].forEach(key => { const el = document.getElementById(key + 'Panel'); el.hidden = key !== page; if (key !== page) el.replaceChildren(); });
    if (data()) queue.kick(); // Logged in again: stored originals of THIS staff member resume without being picked again.
    if (!['planner', 'projects', 'claims'].includes(page)) return;
    const root = document.getElementById(page + 'Panel'); if (!root || !data()) return;
    if (page === 'claims' && !owner()) { root.replaceChildren(); root.hidden = true; return; }
    root.replaceChildren(); if (page === 'planner') planner(root); else if (page === 'projects') projectPage(root); else if (page === 'claims') claimPage(root);
  }
  function valid(d) {
    const arrays = ['projects', 'evidence', 'claims']; if (!arrays.every(k => d[k] === undefined || Array.isArray(d[k]))) return false;
    const ps = d.projects || [], es = d.evidence || [], cs = d.claims || [];
    if (ps.length > 500 || es.length > 10000 || cs.length > 1000 || d.me.role !== 'owner' && cs.length) return false;
    if (!ps.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 160 && Array.isArray(p.teamIds) && typeof p.active === 'boolean')) return false;
    return es.every(e => e && typeof e.id === 'string' && typeof e.projectId === 'string' && typeof e.caption === 'string' && Object.hasOwn(phases, e.phase) && (e.kind === 'video' ? ['video/mp4', 'video/quicktime', 'video/webm'] : ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']).includes(e.mime) && /^[a-f0-9]{64}$/.test(e.sha256) && Number.isSafeInteger(e.size) && e.size > 0 && e.size <= (e.kind === 'video' ? 100 : 12) * 1048576 && (e.duration === undefined || e.duration === '' || e.kind === 'video' && Number.isFinite(e.duration) && e.duration > 0) && !('fileId' in e) && !('base64' in e) && (e.kind === 'document' ? d.me.role === 'owner' : (e.kind === 'photo' || e.kind === 'video') && d.tasks.some(t => t.id === e.taskId && t.projectId === e.projectId))) && cs.every(c => c && typeof c.id === 'string' && typeof c.projectId === 'string' && Array.isArray(c.items) && Array.isArray(c.selectedEvidenceIds));
  }
  return Object.freeze({ render, reset, valid, hasDraft: () => !!edit || busy });
} });

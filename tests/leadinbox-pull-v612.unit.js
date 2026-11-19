/* v613 📬 홈페이지 문의 접수함 당겨오기(대표 정리 항목 28) — 만물웹 apps-script-lead-inbox 서버에서 문의를 당겨 📥 웹 업무 연결의 같은 미리보기·등록 흐름으로.
   실제 앱 코드(index.html 의 웹 업무 연결 구역 + '📬 문의 접수함 당겨오기' 구역 통째)를 vm 에서 돌린다 — 가짜 접수함 서버(fetch)·가짜 IndexedDB·작은 가짜 화면,
   합성 자료만, 브라우저·바깥 요청 없음. 서버 문의 줄의 message 는 만물웹 97c4d0b js/lead-transport.js buildLeadText → LeadInboxPure.gs 정규화를 실제로 돌려 얻은 그대로.
   ① GUARD     주소가 없으면 큰 단추 대신 한 줄 안내와 작은 [켜는 법](누르면 '설정에서 넣어 주세요' 안내만 — 요청·창 0) · 주소 검사(script.google.com /exec 만) · 주소를 바꾸면 옛 세션을 버린다
   ② LOGIN     관리 비밀번호는 leadLogin 요청 본문 한 곳에만 — 이 기기 저장소(IndexedDB)·state·직렬화 자료 어디에도 없다 · 세션 {token,expiresAt}은 이 창 메모리에만
               (기기 저장소에 남기지 않는다 — v613 검토) · 형식 틀리면 요청 없음 ·
               이상한 응답(짧은 토큰·9시간 넘는 만료)은 받지 않음 · 부팅 때 세션을 이어 쓰지 않고 예전 개발판의 IDB 세션은 지운다 · 로그인 창에 보낼 곳(배포 ID 끝 6자리)
   ③ LIST      leadList 요청 꼴(POST text/plain · credentials omit · sessionToken) · 문의 줄 정리(잘못된 ID 버림) · 본문 = message + '접수번호' 줄
               (만물웹 접수함 '앱에 붙여넣을 본문 복사'와 같은 글) → 메일 붙여넣기와 같은 중복 ID · 인테리어·누수·관리사무소·A/S 본문이 모두 읽힌다
   ④ REGISTER  화면 흐름: 버튼 → 로그인 창 → 틀린 비밀번호(칸 비움) → 목록 → [📥 열어서 등록] → 미리보기(접수함 칸·메모) → [현장으로 등록] →
               안전판 → 이 기기 저장 → 그 **뒤에** leadDecide '승인'(메모: 대표 메모 · 현장웹 현장 등록: 현장 이름, requestId UUID v4) · 현장 source lead-inbox·접수번호 · 메모 줄 ·
               저장 실패면 승인 안 보냄 · 이미 등록한 문의는 등록 버튼 없음
   ⑤ RETRY     승인 표시가 실패해도 등록은 그대로 → 그 문의를 다시 열면 [✅ 접수함에 승인 표시] → 같은 requestId 로 다시(서버가 한 번만 기록) · 이미 승인된 문의는 승인 안 보냄
   ⑥ DECIDE    보류는 그 자리 · 거절은 사유 메모 없으면 요청 없음 → 메모 넣으면 거절 후 목록으로 · 거절한 문의는 등록 버튼 없음 → [↩ 보류로 되돌리기] 뒤 등록 버튼
   ⑦ AS        A/S 문의 → 현장 고르기 → AS 관리 기록(sourceReceiptNo) + '승인'(현장웹 AS 접수: 현장) · 누수 현장은 원인 확인 창에 via 를 넘긴다
   ⑧ EXPIRED   서버가 session-expired → 이 기기 세션 지움 + 로그인 창 '다시 로그인' · 이 기기에서 이미 만료된 세션은 요청 없이 로그인 창 · 등록 뒤 승인 때 만료면 안내
   ⑨ STATIC    웹 업무 연결 구역에는 여전히 fetch·IndexedDB·localStorage 가 없다(붙여넣기 길은 바깥을 안 읽는다) · 접수함 구역의 저장 키는 주소 하나뿐(세션은 저장 안 함) · 직렬화·설정·훅
   HJ_V612L_MUTATION=store-password ①(이 기기 저장 키가 둘이 된다 — ② 에서도 잡힌다) · store-session ① · no-approve ④ · new-request-id ⑤ · register-rejected ⑥ · keep-expired ⑧ 에서 실패해야 한다.
   HJ_V612L_BASELINE=<commit>(그 커밋의 index.html — 5a87511 = 입구 갈래) 은 ① 에서 실패해야 한다(접수함 구역이 없다).
   HJ_MANMOOL_ROOT=<만물웹 사본 폴더> 를 주면 ③ 이 고정 본문을 만물웹 buildLeadText·LeadInboxPure 로 다시 만들어 대조하고, 서버 계약(액션·전이·오류 코드)도 대조한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let source = process.env.HJ_V612L_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V612L_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'store-password': ["  const result=await leadInboxPost('leadLogin',{adminCode:code},false);", "  await idbSet('lead_inbox_code',code);const result=await leadInboxPost('leadLogin',{adminCode:code},false);"],
  'no-approve': ["    try{if(draft.via&&typeof leadInboxAfterRegister==='function')leadInboxAfterRegister(draft.via,projectName,'site');}catch(e){}   // v613 저장이 끝난 뒤에만 접수함에 '승인'\n", ''],
  'new-request-id': ["if(!LEAD_INBOX_UUID_RE.test(String(requestId||''))){requestId=leadInboxUuid();__leadInbox.req[key]=requestId;}", "{requestId=leadInboxUuid();__leadInbox.req[key]=requestId;}"],
  'register-rejected': ["function leadInboxRegisterAllowed(via){const status=leadInboxStatusOf(via);return status==='신규'||status==='보류'||status==='승인';}", 'function leadInboxRegisterAllowed(via){return true;}'],
  'store-session': ["  __leadInbox.session=session;__leadInbox.statusById={};", "  __leadInbox.session=session;__leadInbox.statusById={};await idbSet('lead_inbox_session',{token:session.token,expiresAt:session.expiresAt});"],
  'keep-expired': ["    if(code==='session-expired')await leadInboxForgetSession();\n", '']
};
const mutation = process.env.HJ_V612L_MUTATION || '';
if (mutation) {
  assert(MUT[mutation], 'unknown mutation ' + mutation);
  const [from, to] = MUT[mutation]; assert.equal(source.split(from).length, 2, 'mutation anchor ' + mutation); source = source.replace(from, to);
}

// ── 앱 코드 꺼내기 ──────────────────────────────────────────
function region(startMark, endMark) {
  const start = source.indexOf(startMark), end = source.indexOf(endMark);
  return start > 0 && end > start ? source.slice(start, end) : '';
}
const BRIDGE = region('/* ═══ 웹 업무 연결 센터', '/* ═══ /웹 업무 연결 센터 ═══ */');
const LEAD = region('/* ═══ 📬 홈페이지 문의 접수함 당겨오기', '/* ═══ /문의 접수함 당겨오기 ═══ */');
function extract(name) {
  const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert(start >= 0, 'function exists: ' + name);
  const lineEnd = source.indexOf('\n', start), first = source.slice(start, lineEnd);
  return first.endsWith('}') ? first : source.slice(start, source.indexOf('\n}', lineEnd) + 2);
}
const HELPERS = ['escapeHtml', 'escapeAttr', 'num', 'hjAddMonths', 'hjToday0', 'hjWarranty', 'localDate', 'pad', 'hjLeakProjectRef', 'hjLeakProjectByRef', 'hjLeakProjectStamp'];
const CONSTS = ['WARRANTY_ITEMS_DEFAULT'];

// ── 만물웹 97c4d0b 가 실제로 만드는 문의 줄(buildLeadText → leadPureNormalizeCreate_) ──
const MSG = {
  interior: '[만물인테리어 상담 신청]\n이름: 최인테\n연락처: 010-2222-3333\n공간: 주거 · 32평 · 대전 유성구 노은동\n범위: 전체 리모델링 · 욕실,주방\n예산/시기: 4천만원대 · 2027년 1월\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 실측 상담 원합니다.\n주말 가능해요.',
  leak: '[만물인테리어 상담 신청]\n연락처: 010-4444-5555\n공간: 누수 · 대전 서구 둔산동\n증상: 아랫집 천장 물자국, 계량기 움직임\n신청 목적: 전화로 증상 상담\n접수 경로: leak-page\n개인정보 수집·이용 동의: 동의\n메모: 퇴근 후 통화 원해요',
  as: '[만물인테리어 상담 신청]\n이름: 김하자\n연락처: 010-1234-5678\n공간: A/S · 대전 서구 둔산동 수정타운아파트\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 욕실 타일 줄눈이 들떴어요.',
  office: '[만물인테리어 상담 신청]\n연락처: 070-1234-5678\n단지명: 테스트 한빛아파트\n관리사무소 담당자: 시설 담당자\n지역: 대전 중구\n관심 업무: 누수·배관, 공용부 보수\n도입 희망 시점: 2027년 1월 협의\n공간: 관리사무소 30일 시험운영\n접수 경로: office-pilot\n개인정보 수집·이용 동의: 동의\n문의 내용: 시험 운영 상담 원합니다.'
};
const MANMOOL_INPUT = {
  interior: { name: '최인테', phone: '010-2222-3333', type: '주거', area: '32', region: '대전 유성구 노은동', scope: '전체 리모델링', works: ['욕실', '주방'], budget: '4천만원대', movein: '2027년 1월', source: 'website', privacyConsent: true, memo: '실측 상담 원합니다.\n주말 가능해요.' },
  leak: { phone: '010-4444-5555', type: '누수', region: '대전 서구 둔산동', symptoms: ['아랫집 천장 물자국', '계량기 움직임'], inquiryPurpose: 'phone-consult', source: 'leak-page', privacyConsent: true, memo: '퇴근 후 통화 원해요' },
  as: { name: '김하자', phone: '010-1234-5678', type: 'A/S', region: '대전 서구 둔산동 수정타운아파트', source: 'website', privacyConsent: true, memo: '욕실 타일 줄눈이 들떴어요.' },
  office: { phone: '070-1234-5678', type: '관리사무소 30일 시험운영', complexName: '테스트 한빛아파트', officeContactName: '시설 담당자', region: '대전 중구', pilotInterest: ['leak-piping', 'common-repair'], desiredStart: '2027년 1월 협의', source: 'office-pilot', privacyConsent: true, memo: '시험 운영 상담 원합니다.' }
};
const PASS = 'TEST-only-admin-77';   // 합성 값 — 실제 관리 비밀번호 아님
const URL_OK = 'https://script.google.com/macros/s/TEST_lead_inbox_v612_fake/exec';
const ID = n => '2f1c6a5e-8b7d-4c3a-9e1f-0a1b2c3d4e' + String(n).padStart(2, '0');
function ROWS() {
  const row = (n, key, status, extra) => Object.assign({ leadId: ID(n), receiptNo: 'LD-20261119-000' + n, receivedAt: '2026-11-19T0' + n + ':10:00.000Z', status, decidedAt: '', name: '', phone: '', type: '', service: '', region: '',
    area: '', scope: '', works: '', budget: '', movein: '', live: '', symptoms: '', purpose: '', visit: '', memo: '', source: '', sourcePage: '', ctaId: '', utm: 'x / y', emailDelivered: 'Y', message: MSG[key], extra: '{"a":1}', updatedAt: '' }, extra);
  return [
    row(1, 'interior', '신규', { name: '최인테', phone: '010-2222-3333', service: '인테리어', type: '주거', region: '대전 유성구 노은동', works: '욕실, 주방', memo: '실측 상담 원합니다.\n주말 가능해요.', source: 'website' }),
    row(2, 'leak', '신규', { name: '(이름 없음)', phone: '010-4444-5555', service: '누수', type: '누수', region: '대전 서구 둔산동', symptoms: '아랫집 천장 물자국, 계량기 움직임', source: 'leak-page', emailDelivered: 'N',
      receivedAt: 'Thu Nov 19 2026 11:20:00 GMT+0900 (Korean Standard Time)' }),   // 시트가 날짜로 바꿔 String(Date) 로 온 꼴
    row(3, 'as', '신규', { name: '김하자', phone: '010-1234-5678', service: '인테리어', type: 'A/S', region: '대전 서구 둔산동 수정타운아파트', memo: '욕실 타일 줄눈이 들떴어요.', source: 'website' }),
    row(4, 'office', '보류', { name: '(이름 없음)', phone: '070-1234-5678', service: '관리사무소', type: '관리사무소 30일 시험운영', region: '대전 중구', source: 'office-pilot' }),
    row(5, 'interior', '거절', { message: MSG.interior.replace('최인테', '거절된손님').replace('010-2222-3333', '010-9999-0000'), name: '거절된손님', phone: '010-9999-0000', service: '인테리어' }),
    row(6, 'interior', '신규', { leadId: 'not-a-uuid', name: '버릴 줄' })
  ];
}

// ── 가짜 접수함 서버(만물웹 Code.gs 계약) ─────────────────────
function makeServer(log) {
  const srv = { calls: [], rows: ROWS(), sessions: new Map(), history: [], tokens: 0, fail: null, failRequests: [] };
  const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => typeof value === 'string' ? value : JSON.stringify(value) });
  const TRANS = { '신규': ['승인', '보류', '거절'], '보류': ['승인', '거절'], '거절': ['보류'], '승인': [] };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  srv.fetch = async (url, init) => {
    const body = JSON.parse(init.body); srv.calls.push({ url, init, body, raw: init.body }); log.push('fetch:' + body.action);
    if (srv.fail) { const f = srv.fail(body); if (f === 'network') { srv.failRequests.push(body); throw new TypeError('Failed to fetch'); } if (f) return f; }
    if (url !== URL_OK) return reply('not found', 404);
    const p = body.payload || {};
    if (body.action === 'leadLogin') {
      if (p.adminCode !== PASS) return reply({ ok: false, error: 'invalid-credentials' });
      const token = 'TESTSESSION' + 'x'.repeat(60) + '.' + (++srv.tokens); srv.sessions.set(token, Date.now() + 8 * 3600e3);
      return reply({ ok: true, sessionToken: token, expiresAt: srv.sessions.get(token) });
    }
    if (!srv.sessions.has(body.sessionToken) || !(srv.sessions.get(body.sessionToken) > Date.now())) return reply({ ok: false, error: 'session-expired' });
    if (body.action === 'leadLogout') { srv.sessions.delete(body.sessionToken); return reply({ ok: true, loggedOut: true }); }
    if (body.action === 'leadList') {
      const st = String(p.status || '전체'), counts = { '신규': 0, '승인': 0, '보류': 0, '거절': 0 };
      srv.rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
      const leads = srv.rows.filter(r => st === '전체' || r.status === st);
      return reply({ ok: true, leads, total: leads.length, counts });
    }
    if (body.action === 'leadDecide') {
      if (!UUID.test(String(p.leadId || '')) || !UUID.test(String(p.requestId || '')) || !['승인', '보류', '거절'].includes(p.decision)) return reply({ ok: false, error: 'invalid-input' });
      if (p.decision === '거절' && !String(p.memo || '').trim()) return reply({ ok: false, error: 'invalid-input' });
      const row = srv.rows.find(r => r.leadId === p.leadId); if (!row) return reply({ ok: false, error: 'not-found' });
      if (srv.history.some(h => h.requestId === p.requestId)) return reply({ ok: true, lead: row, duplicate: true });
      if (!TRANS[row.status].includes(p.decision)) return reply({ ok: false, error: 'invalid-transition' });
      srv.history.push({ leadId: row.leadId, from: row.status, to: p.decision, memo: p.memo, requestId: p.requestId }); row.status = p.decision; row.decidedAt = new Date().toISOString();
      return reply({ ok: true, lead: row });
    }
    return reply({ ok: false, error: 'bad-request' });
  };
  return srv;
}

// ── 작은 가짜 화면(openModal 이 그린 글에서 id·data-* 버튼을 꺼낸다) ──
function makeContext() {
  const log = [], idb = new Map(), ctx = {};
  const el = extra => Object.assign({ value: '', textContent: '', disabled: false, isConnected: true, onclick: null, oninput: null, onchange: null, onkeydown: null, dataset: {}, focus() {} }, extra || {});
  let modal = null;
  const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  function buildModal(title, body, buttons) {
    const ids = new Map(), data = [];
    for (const m of body.matchAll(/id="([A-Za-z0-9_-]+)"/g)) ids.set(m[1], el({ id: m[1] }));
    const memo = body.match(/<textarea id="leadInboxMemo"[^>]*>([^<]*)<\/textarea>/); if (memo) ids.get('leadInboxMemo').value = unescape(memo[1]);
    for (const m of body.matchAll(/data-lead-inbox-(filter|open|decide)="([^"]+)"/g)) data.push(el({ kind: m[1], dataset: { ['leadInbox' + m[1][0].toUpperCase() + m[1].slice(1)]: unescape(m[2]) } }));
    const foot = Array.from(buttons || [], b => el({ label: b.label, onclick: b.fn, fn: b.fn }));
    const buttonsIn = () => data.concat(['leadInboxRefresh', 'leadInboxLogout', 'webWorkLeadPull'].filter(id => ids.has(id)).map(id => ids.get(id)));
    const root = { querySelector: sel => sel[0] === '#' ? (ids.get(sel.slice(1)) || null) : null,
      querySelectorAll: sel => sel === 'button' ? buttonsIn() : data.filter(d => sel === '[data-lead-inbox-' + d.kind + ']') };
    return { title, body, buttons: foot, ids, data, root, has: mark => body.includes(mark) };
  }
  Object.assign(ctx, {
    console, URL, AbortController, TextEncoder, structuredClone, crypto: globalThis.crypto, Promise, Date, Math, JSON, Object, Array, Set, Map, Number, String, RegExp, Error, TypeError, Uint8Array,
    state: { projects: [], notes: [], asLog: [], dirty: false, activeProject: null },
    __photoCache: { key: 'x' }, __idbSaveTimer: null, __modalCloseLocked: false, __tabStale: false, __appVersionUpdating: false,
    setTimeout() { return 1; }, clearTimeout() {},
    uidN: 0, uid() { ctx.uidN++; return 'u' + ctx.uidN; },
    toast(t) { log.push('toast:' + t); }, render() { log.push('render'); }, persistLocal() { log.push('persistLocal'); },
    asManage(id) { log.push('asManage:' + id); }, hjLeakIntakeView(name) { log.push('leakIntake:' + name); }, hjOperationsCenter() {}, officeIntakeSync: async () => true, officeIntakeOpen() {}, aptOrderManage() {}, openGdriveSetup() {},
    webOfficeConnectionPanel: () => '<section id="webWorkConnectionPanel"></section>', webOfficeConnectionState: () => ({ pending: 0, overdue: 0 }), webOfficeConnectionRefresh() {},
    projectBackupSafe: p => p, hjLeakRepeatWarranty: () => ({}), photoIntakePending: () => false,
    hjSnapshot: async label => { log.push('snapshot:' + label); return ctx.__snapshotOk !== false; },
    guardedPersistCurrentState: async () => { log.push('persist'); return ctx.__persistOk !== false; },
    hjLeakAsView: (ref, options, back) => { log.push('leakAsView:' + ref); ctx.__leakAs = { ref, options, back }; return true; },
    $: () => null, scheduleFolderAutoSave() {}, backupDriveAuto() {}, cloudAutoSave() {},
    idbGet: async key => idb.has(key) ? structuredClone(idb.get(key)) : undefined,
    idbSet: async (key, value) => { log.push('idbSet:' + key); idb.set(key, structuredClone(value)); },
    idbDel: async key => { log.push('idbDel:' + key); idb.delete(key); },
    openModal(title, body, buttons) { ctx.__modalOnClose = null; modal = buildModal(title, body, buttons); ctx.__modal = modal; log.push('modal:' + title); },
    closeModal() { if (modal && (modal.has('web-work-preview') || modal.has('web-work-center'))) vm.runInContext('webWorkCancelPending()', ctx); modal = null; ctx.__modal = null; const hook = ctx.__modalOnClose; ctx.__modalOnClose = null; if (hook) hook(); log.push('close'); return true; },
    __log: log, __idb: idb
  });
  ctx.window = ctx;
  Object.defineProperty(ctx, '__modalOnClose', { get() { return ctx.___onClose || null; }, set(v) { ctx.___onClose = v; }, configurable: true });
  const marks = { '#modalRoot [data-lead-inbox-list]': 'data-lead-inbox-list', '#modalRoot [data-lead-inbox-login]': 'data-lead-inbox-login', '#modalRoot [data-lead-inbox-box]': 'data-lead-inbox-box' };
  ctx.document = {
    getElementById: id => (modal && modal.ids.get(id)) || null,
    querySelector: sel => modal && marks[sel] && modal.has(marks[sel]) ? modal.root : null,
    querySelectorAll: sel => {
      if (!modal) return [];
      if (sel === '#modalRoot .mfoot button') return modal.buttons;
      if (sel.includes('[data-lead-inbox-box] button')) return modal.data.filter(d => d.kind === 'decide').concat(modal.ids.has('leadInboxMemo') ? [modal.ids.get('leadInboxMemo')] : [], modal.buttons);
      return [];
    }
  };
  vm.createContext(ctx);
  const consts = CONSTS.map(n => { const at = source.indexOf('const ' + n + '='); assert(at >= 0, 'const ' + n); return source.slice(at, source.indexOf('\n', at)); }).join('\n');
  vm.runInContext(consts + '\n' + HELPERS.map(extract).join('\n') + '\n' + BRIDGE + '\n' + LEAD, ctx, { filename: 'index.html#leadinbox' });
  ctx.__server = makeServer(log); ctx.fetch = ctx.__server.fetch;
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 2)); };   // SHA-256(crypto.subtle) 은 마이크로태스크 밖에서 끝난다
const foot = (ctx, label) => { const b = ctx.__modal && ctx.__modal.buttons.find(x => x.label.includes(label)); return b || null; };
const dataBtn = (ctx, kind, value) => ctx.__modal && ctx.__modal.data.find(d => d.kind === kind && Object.values(d.dataset)[0] === value) || null;
async function loggedIn(ctx) { await run(ctx, `leadInboxSaveUrl(${JSON.stringify(URL_OK)})`); await run(ctx, `leadInboxLogin(${JSON.stringify(PASS)})`); }
function allStored(ctx) {
  return JSON.stringify([...ctx.__idb.entries()]) + JSON.stringify(run(ctx, 'JSON.stringify(state)')) + JSON.stringify(run(ctx, 'JSON.stringify({u:__leadInbox.url,m:__leadInbox.memo,r:__leadInbox.req,s:__leadInbox.statusById})'));
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS leadinbox-pull-v612 ' + name); }

(async () => {
  await test('① GUARD: no address → guidance only (no request, no window) · address check · new address drops the old session', async () => {
    assert(BRIDGE, 'web work bridge region'); assert(LEAD, 'lead inbox pull region exists (baseline has none)');
    const ctx = makeContext(); await run(ctx, '__hjLeadInboxBootDone');
    run(ctx, 'webWorkCenterOpen()');
    assert(ctx.__modal.body.includes('id="webWorkLeadPull"'), 'center shows the pull button'); assert.equal(ctx.__modal.body.indexOf('id="webWorkConnectionPanel"') < ctx.__modal.body.indexOf('id="webWorkLeadPull"'), true, 'office panel stays first');
    assert.match(ctx.__modal.body, /data-lead-inbox-panel="off"/);
    assert.equal(/class="blue" id="webWorkLeadPull"/.test(ctx.__modal.body), false, 'no big primary button before the inbox is set up');
    assert.match(ctx.__modal.body, /홈페이지 문의 접수함을 켜면 메일 붙여넣기 없이 가져올 수 있어요 — ⚙️ 설정 › ⭐ 기타/);
    const title = ctx.__modal.title; ctx.__modal.ids.get('webWorkLeadPull').onclick();
    assert.match(ctx.__modal.ids.get('webWorkLeadStatus').textContent, /접수함 주소를 설정에서 넣어 주세요/);
    assert.equal(ctx.__modal.title, title, 'stays on the center'); assert.equal(ctx.__server.calls.length, 0, 'no request before an address exists');
    await assert.rejects(run(ctx, `leadInboxPost('leadList',{},true)`), e => e.code === 'no-url');
    const ok = run(ctx, `[${JSON.stringify(URL_OK)},'https://script.google.com/macros/s/AbC_-9/exec'].map(leadInboxUrlOk)`);
    assert.deepEqual(Array.from(ok), [true, true]);
    const bad = run(ctx, `['http://script.google.com/macros/s/A/exec','https://script.google.com/macros/s/A/exec?x=1','https://script.google.com/macros/s/A/exec#h','https://script.googleusercontent.com/macros/s/A/exec',
      'https://evil.example/macros/s/A/exec',' https://script.google.com/macros/s/A/exec','https://script.google.com/macros/s/A/dev','https://script.google.com:444/macros/s/A/exec',''].map(leadInboxUrlOk)`);
    assert.deepEqual(Array.from(bad), Array(9).fill(false));
    await assert.rejects(run(ctx, `leadInboxSaveUrl('https://evil.example/exec')`), e => e.code === 'bad-url'); assert.equal(ctx.__idb.size, 0, 'bad address not stored');
    await loggedIn(ctx);
    assert.deepEqual([...ctx.__idb.keys()].sort(), ['lead_inbox_url'], 'only the address is stored on this device — the session stays in memory');
    assert.equal(run(ctx, 'leadInboxLive()'), true, 'logged in (memory)');
    await run(ctx, `leadInboxSaveUrl('https://script.google.com/macros/s/OTHER_server/exec')`);
    assert.equal(ctx.__idb.has('lead_inbox_session'), false, 'changing the address drops the old session'); assert.equal(run(ctx, '__leadInbox.session'), null);
    await run(ctx, 'leadInboxClearAll()'); assert.equal(ctx.__idb.size, 0, 'clear removes both device keys');
  });

  await test('② LOGIN: password only in the leadLogin body — never in IndexedDB, state or memory; only the server session is kept', async () => {
    const ctx = makeContext(); await run(ctx, `leadInboxSaveUrl(${JSON.stringify(URL_OK)})`);
    await assert.rejects(run(ctx, `leadInboxLogin('short')`), e => e.code === 'invalid-credentials');
    await assert.rejects(run(ctx, `leadInboxLogin('has space 123')`), e => e.code === 'invalid-credentials');
    assert.equal(ctx.__server.calls.length, 0, 'bad shape → no request');
    await assert.rejects(run(ctx, `leadInboxLogin('WRONG-admin-code-1')`), e => e.code === 'invalid-credentials');
    await run(ctx, `leadInboxLogin(${JSON.stringify(PASS)})`);
    const login = ctx.__server.calls.filter(c => c.body.action === 'leadLogin');
    assert.equal(login.length, 2); assert.deepEqual(Object.keys(login[1].body).sort(), ['action', 'payload', 'ts']); assert.deepEqual(Object.keys(login[1].body.payload), ['adminCode']);
    assert.equal(login[1].init.method, 'POST'); assert.equal(login[1].init.headers['Content-Type'], 'text/plain;charset=utf-8'); assert.equal(login[1].init.credentials, 'omit'); assert.equal(login[1].init.redirect, 'follow');
    assert.equal(ctx.__idb.has('lead_inbox_session'), false, 'session not in IndexedDB (same origin as the public manmool pages)');
    const session = JSON.parse(run(ctx, 'JSON.stringify(__leadInbox.session)'));
    assert.deepEqual(Object.keys(session).sort(), ['expiresAt', 'token']); assert.match(session.token, /^TESTSESSION/);
    assert.equal(allStored(ctx).includes(PASS), false, 'password is not stored anywhere');
    await run(ctx, 'leadInboxFetchList("신규")');
    assert.equal(ctx.__server.calls.filter(c => c.raw.includes(PASS)).length, 1, 'only the login request carries the password');
    // 이상한 응답은 저장하지 않는다
    for (const odd of [{ sessionToken: 'short', expiresAt: Date.now() + 3600e3 }, { sessionToken: 'T'.repeat(80), expiresAt: Date.now() + 24 * 3600e3 }, { sessionToken: 'T'.repeat(80) + '<', expiresAt: Date.now() + 3600e3 }]) {
      const c2 = makeContext(); await run(c2, `leadInboxSaveUrl(${JSON.stringify(URL_OK)})`);
      c2.__server.fail = b => b.action === 'leadLogin' ? { ok: true, status: 200, text: async () => JSON.stringify(Object.assign({ ok: true }, odd)) } : null;
      await assert.rejects(run(c2, `leadInboxLogin(${JSON.stringify(PASS)})`), e => e.code === 'invalid-response');
      assert.equal(c2.__idb.has('lead_inbox_session'), false); assert.equal(run(c2, '__leadInbox.session'), null);
    }
    // 부팅: 세션을 이어 쓰지 않는다(새로 열면 다시 로그인) — 예전 개발판이 IDB 에 남긴 세션은 살아 있어도 지운다
    const c3 = makeContext(); c3.__idb.set('lead_inbox_url', URL_OK); c3.__idb.set('lead_inbox_session', { token: 'T'.repeat(80), expiresAt: Date.now() + 3600e3 });
    await run(c3, 'leadInboxBoot()');
    assert.equal(c3.__idb.has('lead_inbox_session'), false, 'old IDB session removed'); assert.equal(run(c3, 'leadInboxLive()'), false, 'not resumed'); assert.equal(run(c3, '__leadInbox.url'), URL_OK);
    // 로그인 창 — 비밀번호를 보낼 곳(배포 ID 끝 6자리)
    assert.equal(run(c3, `leadInboxUrlTail(${JSON.stringify(URL_OK)})`), '2_fake'); assert.equal(run(c3, `leadInboxUrlTail('https://evil.example/x')`), '');
    run(c3, 'leadInboxLoginView("")');
    assert.match(c3.__modal.body, /data-lead-inbox-dest[^>]*>비밀번호를 보낼 곳: 설정에 넣은 접수함 주소\(끝자리 <b>…2_fake<\/b>\)/);
    assert.equal(c3.__modal.body.includes('IndexedDB') || c3.__modal.body.includes('세션'), false, 'plain words in the login note');
  });

  await test('③ LIST: request shape · rows cleaned · body = message + receipt line (same id as the pasted mail) · all four kinds parse', async () => {
    if (process.env.HJ_MANMOOL_ROOT) {
      const MM = process.env.HJ_MANMOOL_ROOT, c = { window: {}, localStorage: { removeItem() {} }, console }; vm.createContext(c);
      vm.runInContext(fs.readFileSync(path.join(MM, 'js', 'lead-transport.js'), 'utf8'), c);
      const pure = require(path.join(MM, 'apps-script-lead-inbox', 'LeadInboxPure.gs'));
      for (const [key, input] of Object.entries(MANMOOL_INPUT)) {
        const payload = Object.assign({ leadId: ID(0) }, input), message = c.window.ManmulLead.buildLeadText(payload);
        assert.equal(pure.leadPureNormalizeCreate_(Object.assign({}, payload, { message })).row.message, MSG[key], 'manmool message matches fixture: ' + key);
      }
      assert.deepEqual(pure.LEAD_TRANSITIONS, { '신규': ['승인', '보류', '거절'], '보류': ['승인', '거절'], '거절': ['보류'], '승인': [] });
      const code = fs.readFileSync(path.join(MM, 'apps-script-lead-inbox', 'Code.gs'), 'utf8');
      assert.match(code, /var LEAD_PUBLIC_ACTIONS = \['leadHealth', 'leadCreate', 'leadLogin'\];/); assert.match(code, /sessionToken: rawToken, expiresAt: nowMs \+ LEAD_SESSION_TTL_MS/);
      for (const err of ['not-configured', 'invalid-credentials', 'rate-limited', 'session-expired', 'not-found', 'bad-request', 'invalid-transition', 'invalid-input', 'server-error']) assert(code.includes("'" + err + "'"), 'server error code ' + err);
      const ctx0 = makeContext(); for (const err of ['not-configured', 'invalid-credentials', 'rate-limited', 'session-expired', 'not-found', 'bad-request', 'invalid-transition', 'invalid-input', 'server-error']) assert(run(ctx0, `Object.prototype.hasOwnProperty.call(LEAD_INBOX_MESSAGES,${JSON.stringify(err)})`), 'app knows ' + err);
      const page = fs.readFileSync(path.join(MM, 'js', 'lead-inbox.js'), 'utf8');
      assert(page.includes("return receiptNo ? message.replace(/\\s+$/, '') + '\\n접수번호: ' + receiptNo : message;"), 'manmool copy text = message + 접수번호 line');
      console.log('  (HJ_MANMOOL_ROOT: messages · transitions · error codes · copy text matched)');
    }
    const ctx = makeContext(); await loggedIn(ctx);
    const leads = await run(ctx, 'leadInboxFetchList("전체")');
    const call = ctx.__server.calls.at(-1);
    assert.equal(call.body.action, 'leadList'); assert.deepEqual(call.body.payload, { status: '전체' }); assert.match(call.body.sessionToken, /^TESTSESSION/);
    assert.equal(leads.length, 5, 'row with a bad leadId is dropped');
    assert.deepEqual(Object.keys(leads[0]).sort(), ['emailDelivered', 'leadId', 'memo', 'message', 'name', 'phone', 'receiptNo', 'receivedAt', 'region', 'service', 'status', 'symptoms', 'type', 'works']);
    assert.deepEqual(JSON.parse(JSON.stringify(run(ctx, '__leadInbox.counts'))), { '신규': 4, '보류': 1, '승인': 0, '거절': 1 });
    assert.match(run(ctx, `leadInboxWhen(${JSON.stringify(leads[1].receivedAt)})`), /11/, 'String(Date) from the sheet still reads');
    const text = run(ctx, `leadInboxMailText(leadInboxFind(${JSON.stringify(ID(1))}))`);
    assert.equal(text, MSG.interior + '\n접수번호: LD-20261119-0001');
    const ids = await run(ctx, `(async () => { const a = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(1))})), b = await webWorkDraftFromText(${JSON.stringify(MSG.interior)}), c = await webWorkDraftFromText(${JSON.stringify(MSG.interior + '\n접수번호: LD-20261119-0001')});
      return { a: a.id, b: b.id, c: c.id, via: a.via, receipt: a.fields.receiptNo, viaB: b.via, frozen: Object.isFrozen(a.via) }; })()`);
    assert.equal(ids.a, ids.b, 'same dedupe id as pasting the plain mail'); assert.equal(ids.a, ids.c, 'same id as the lead-inbox copy text');
    assert.deepEqual(JSON.parse(JSON.stringify(ids.via)), { kind: 'lead-inbox', leadId: ID(1), receiptNo: 'LD-20261119-0001', status: '신규', receivedAt: '2026-11-19T01:10:00.000Z' });
    assert.equal(ids.receipt, 'LD-20261119-0001'); assert.equal(ids.viaB, null, 'paste drafts carry no via'); assert.equal(ids.frozen, true);
    const kinds = await run(ctx, `Promise.all(${JSON.stringify([1, 2, 3, 4].map(ID))}.map(id => leadInboxDraft(leadInboxFind(id)).then(d => d.service)))`);
    assert.deepEqual(Array.from(kinds), ['interior', 'leak-pipe', 'as', 'office-sales']);
  });

  await test('④ REGISTER: button → login (wrong password clears the field) → list → open → preview → register → save → THEN 승인 with memo', async () => {
    const ctx = makeContext(); await run(ctx, `leadInboxSaveUrl(${JSON.stringify(URL_OK)})`);
    run(ctx, 'webWorkCenterOpen()'); assert.match(ctx.__modal.body, /data-lead-inbox-panel="on"/);
    ctx.__modal.ids.get('webWorkLeadPull').onclick();
    assert(ctx.__modal.has('data-lead-inbox-login'), 'login window'); assert.match(ctx.__modal.body, /type="password"/); assert.match(ctx.__modal.body, /autocomplete="one-time-code"/);
    const code = ctx.__modal.ids.get('leadInboxCode'); code.value = 'WRONG-admin-code-1';
    await foot(ctx, '로그인').fn(); assert.equal(code.value, '', 'field cleared at once'); await settle(); assert.match(ctx.__modal.ids.get('leadInboxLoginIssue').textContent, /관리 비밀번호가 맞지 않아요/);
    code.value = PASS; await foot(ctx, '로그인').fn(); await settle();
    assert(ctx.__modal.has('data-lead-inbox-list="3"'), 'list of 3 new leads (filter 신규, bad row dropped)'); assert.equal(code.value, '');
    assert.equal(ctx.__modal.data.filter(d => d.kind === 'open').length, 3); assert.match(ctx.__modal.body, /최인테/); assert.match(ctx.__modal.body, /메일 미발송/);
    assert.equal(ctx.__modal.body.includes('📥 열어서 등록'), true);
    ctx.__log.length = 0;
    await dataBtn(ctx, 'open', ID(1)).onclick(); await settle();
    assert.equal(ctx.__modal.title, '🔎 웹 문의 미리보기'); assert(ctx.__modal.has('data-lead-inbox-box'), 'lead inbox box in preview');
    assert.match(ctx.__modal.body, /LD-20261119-0001/); assert.match(ctx.__modal.body, /data-lead-inbox-state="신규"/);
    assert.deepEqual(ctx.__modal.buttons.map(b => b.label), ['현장으로 등록', '← 접수함 목록', '닫기']);
    assert.deepEqual(ctx.__modal.data.filter(d => d.kind === 'decide').map(d => d.dataset.leadInboxDecide), ['보류', '거절']);
    const memo = ctx.__modal.ids.get('leadInboxMemo'); memo.value = '토요일 실측 약속'; memo.oninput();
    ctx.__persistOk = false; await foot(ctx, '현장으로 등록').fn(); await settle();
    assert.equal(ctx.__server.calls.filter(c => c.body.action === 'leadDecide').length, 0, 'save failed → no approval sent');
    assert.equal(run(ctx, 'state.projects.length'), 0, 'rolled back');
    ctx.__persistOk = true; ctx.__log.length = 0;
    await foot(ctx, '현장으로 등록').fn(); await settle();
    const order = ctx.__log.filter(x => /^(snapshot|persist|fetch)/.test(x));
    assert.deepEqual(order, ['snapshot:웹 업무 연결 등록 전', 'persist', 'fetch:leadDecide'], 'snapshot → save → approval');
    const p = run(ctx, 'state.projects[0]');
    assert.equal(p.source, 'lead-inbox'); assert.equal(p.sourceReceiptNo, 'LD-20261119-0001'); assert.equal(p.customer.phone, '010-2222-3333'); assert.equal(p.stage, 0);
    const note = run(ctx, 'state.notes[0].text');
    assert.match(note, /접수경로: 홈페이지 문의 접수함에서 가져오기/); assert.match(note, /접수번호: LD-20261119-0001/); assert.match(note, /리드ID: webmail-[a-f0-9]{64}/);
    const decide = ctx.__server.calls.filter(c => c.body.action === 'leadDecide')[0].body;
    assert.equal(decide.payload.decision, '승인'); assert.equal(decide.payload.leadId, ID(1));
    assert.equal(decide.payload.memo, '토요일 실측 약속 · 현장웹 현장 등록: ' + p.name);
    assert.match(decide.payload.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(ctx.__server.rows[0].status, '승인'); assert(ctx.__log.some(x => /접수함에도 '승인'으로 표시했어요/.test(x)));
    assert.equal(run(ctx, '__leadInbox.leads'), null, 'list dropped from memory after registering');
    // 다시 열면: 등록됨·승인 — 등록 버튼 없음
    await run(ctx, 'leadInboxView()'); await settle();
    assert(ctx.__modal.has('data-lead-inbox-list="2"'), 'approved lead left the 신규 list');
    run(ctx, `__leadInbox.filter='전체'`); await run(ctx, 'leadInboxRefresh()'); await settle();
    assert.match(ctx.__modal.body, /✅ 앱에 등록됨 · /);
    await dataBtn(ctx, 'open', ID(1)).onclick(); await settle();
    assert.equal(foot(ctx, '현장으로 등록'), null, 'already registered → no register button'); assert.match(ctx.__modal.body, /이미 등록된 문의입니다/); assert.match(ctx.__modal.body, /접수함에서도 승인된 문의예요/);
    assert.equal(allStored(ctx).includes(PASS), false);
  });

  await test('⑤ RETRY: approval fails → registration stays → reopen → [✅ 접수함에 승인 표시] with the same requestId; already-approved leads send nothing', async () => {
    const ctx = makeContext(); await loggedIn(ctx); await run(ctx, 'leadInboxFetchList("신규")');
    ctx.__server.fail = b => b.action === 'leadDecide' ? 'network' : null;
    await run(ctx, `(async () => { __webWorkDraft = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(2))})); webWorkPreviewOpen(__webWorkDraft); })()`);
    await foot(ctx, '현장으로 등록').fn(); await settle();
    assert.equal(run(ctx, 'state.projects.length'), 1, 'registration kept'); assert.equal(run(ctx, 'state.projects[0].kind'), 'leak');
    assert(ctx.__log.some(x => /등록은 됐지만 접수함 '승인' 표시를 못 했어요/.test(x)), 'failure toast');
    const firstId = ctx.__server.failRequests[0].payload.requestId; assert.match(firstId, /^[0-9a-f-]{36}$/);
    assert.equal(ctx.__server.rows[1].status, '신규');
    ctx.__server.fail = null;
    await run(ctx, 'leadInboxFetchList("신규")'); run(ctx, 'leadInboxListOpen()');
    assert.match(ctx.__modal.body, /✅ 접수함에 승인 표시/); assert.match(ctx.__modal.body, /✅ 앱에 등록됨 · /);
    await dataBtn(ctx, 'open', ID(2)).onclick(); await settle();
    assert.equal(foot(ctx, '현장으로 등록'), null); assert.deepEqual(ctx.__modal.data.filter(d => d.kind === 'decide').map(d => d.dataset.leadInboxDecide), ['승인', '보류', '거절']);
    await dataBtn(ctx, 'decide', '승인').onclick(); await settle();
    const sent = ctx.__server.calls.filter(c => c.body.action === 'leadDecide').at(-1).body.payload;
    assert.equal(sent.requestId, firstId, 'retry reuses the requestId of the lost request'); assert.match(sent.memo, /^현장웹 현장 등록: /);
    assert.equal(ctx.__server.rows[1].status, '승인'); assert.equal(ctx.__server.history.length, 1);
    assert.match(ctx.__modal.body, /data-lead-inbox-state="승인"/, 'preview redrawn with the new state');
    // 접수함에서 이미 승인됐지만 이 기기에 없는 문의 → 등록은 되고 승인은 다시 보내지 않는다
    const c2 = makeContext(); await loggedIn(c2); c2.__server.rows[0].status = '승인'; await run(c2, 'leadInboxFetchList("전체")');
    await run(c2, `(async () => { __webWorkDraft = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(1))})); webWorkPreviewOpen(__webWorkDraft); })()`);
    assert.match(c2.__modal.body, /이 기기에는 없어서 등록할 수 있어요/);
    await foot(c2, '현장으로 등록').fn(); await settle();
    assert.equal(run(c2, 'state.projects.length'), 1); assert.equal(c2.__server.calls.filter(c => c.body.action === 'leadDecide').length, 0, 'no decide for an approved lead');
  });

  await test('⑥ DECIDE: 보류 stays · 거절 needs a reason (no request) → then back to the list · a rejected lead cannot be registered until 보류', async () => {
    const ctx = makeContext(); await loggedIn(ctx); run(ctx, 'leadInboxView()'); await settle();
    await dataBtn(ctx, 'open', ID(1)).onclick(); await settle();
    await dataBtn(ctx, 'decide', '보류').onclick(); await settle();
    assert.equal(ctx.__server.rows[0].status, '보류'); assert.match(ctx.__modal.body, /data-lead-inbox-state="보류"/);
    assert.deepEqual(ctx.__modal.data.filter(d => d.kind === 'decide').map(d => d.dataset.leadInboxDecide), ['거절']); assert(foot(ctx, '현장으로 등록'), 'still registrable');
    const before = ctx.__server.calls.length;
    await dataBtn(ctx, 'decide', '거절').onclick(); await settle();
    assert.equal(ctx.__server.calls.length, before, 'reject without a reason → no request'); assert.match(ctx.__modal.ids.get('leadInboxDecideStatus').textContent, /사유 메모가 꼭 필요/);
    ctx.__modal.ids.get('leadInboxMemo').value = '예산이 맞지 않음';
    await dataBtn(ctx, 'decide', '거절').onclick(); await settle();
    assert.equal(ctx.__server.rows[0].status, '거절'); assert.equal(ctx.__server.history.at(-1).memo, '예산이 맞지 않음');
    assert(ctx.__modal.has('data-lead-inbox-list'), 'back to the list'); assert.equal(dataBtn(ctx, 'open', ID(1)), null, 'rejected lead left the 신규 list');
    // 거절한 문의(5번): 등록 버튼 없음 → 보류로 되돌리기 → 등록 버튼
    run(ctx, `__leadInbox.filter='전체'`); await run(ctx, 'leadInboxRefresh()'); await settle();
    await dataBtn(ctx, 'open', ID(5)).onclick(); await settle();
    assert.equal(foot(ctx, '현장으로 등록'), null, 'rejected → no register button'); assert.match(ctx.__modal.body, /↩ 보류로 되돌리기/);
    assert.deepEqual(ctx.__modal.data.filter(d => d.kind === 'decide').map(d => d.dataset.leadInboxDecide), ['보류']);
    await dataBtn(ctx, 'decide', '보류').onclick(); await settle();
    assert.equal(ctx.__server.rows[4].status, '보류'); assert(foot(ctx, '현장으로 등록'), 'after 보류 the lead can be registered');
  });

  await test('⑦ AS: A/S lead → pick a site → AS 관리 record (receipt) + 승인 "현장웹 AS 접수" · leak site → cause check gets the via', async () => {
    const ctx = makeContext(); await loggedIn(ctx); await run(ctx, 'leadInboxFetchList("신규")');
    run(ctx, `state.projects = [{ name: '둔산 수정타운 욕실', kind: 'interior', stage: 3, doneAt: '2025-04-10', customer: {} }, { name: '둔산 누수 욕실', kind: 'leak', stage: 3, customer: { addr: '대전 서구 둔산동' }, leak: { detect: { cause: '배관' } } }]`);
    await run(ctx, `(async () => { __webWorkDraft = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(3))})); webWorkPreviewOpen(__webWorkDraft); })()`);
    assert(foot(ctx, 'AS 관리에 접수'), 'A/S register button'); assert(ctx.__modal.has('id="webWorkAsProject"'));
    ctx.__modal.ids.get('webWorkAsProject').value = '둔산 수정타운 욕실';
    await foot(ctx, 'AS 관리에 접수').fn(); await settle();
    const rec = run(ctx, 'state.asLog[0]');
    assert.equal(rec.project, '둔산 수정타운 욕실'); assert.equal(rec.sourceReceiptNo, 'LD-20261119-0003'); assert.equal(run(ctx, 'state.projects.length'), 2, 'no new site');
    const sent = ctx.__server.calls.filter(c => c.body.action === 'leadDecide').at(-1).body.payload;
    assert.equal(sent.decision, '승인'); assert.equal(sent.memo, '현장웹 AS 접수: 둔산 수정타운 욕실');
    assert.deepEqual(JSON.parse(run(ctx, 'JSON.stringify(leadInboxKnown("LD-20261119-0003"))')), { name: '둔산 수정타운 욕실', as: true });
    // 누수 현장: 원인 확인 창에 via 가 같이 간다(그 창이 저장한 뒤 승인 — index.html hjLeakAsView)
    const c2 = makeContext(); await loggedIn(c2); await run(c2, 'leadInboxFetchList("신규")');
    run(c2, `state.projects = [{ name: '둔산 누수 욕실', kind: 'leak', stage: 3, customer: { addr: '대전 서구 둔산동' }, leak: { detect: { cause: '배관' } } }]`);
    await run(c2, `(async () => { __webWorkDraft = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(3))})); webWorkPreviewOpen(__webWorkDraft); })()`);
    c2.__modal.ids.get('webWorkAsProject').value = '둔산 누수 욕실';
    await foot(c2, 'AS 관리에 접수').fn();
    assert.equal(c2.__leakAs.options.web.via.leadId, ID(3)); assert.equal(c2.__server.calls.filter(c => c.body.action === 'leadDecide').length, 0, 'nothing sent before the leak AS is saved');
  });

  await test('⑧ EXPIRED: server session-expired → device session removed + login window · locally expired → no request · approval after expiry explains', async () => {
    const ctx = makeContext(); await loggedIn(ctx); run(ctx, 'leadInboxView()'); await settle();
    assert(ctx.__modal.has('data-lead-inbox-list'));
    ctx.__server.sessions.clear();
    await run(ctx, 'leadInboxRefresh()'); await settle();
    assert(ctx.__modal.has('data-lead-inbox-login'), 'back to login'); assert.match(ctx.__modal.body, /id="leadInboxLoginIssue"[^>]*>접수함 로그인이 만료됐어요/);
    assert.equal(ctx.__idb.has('lead_inbox_session'), false, 'device session removed'); assert.equal(run(ctx, '__leadInbox.session'), null);
    // 이 기기에서 이미 만료 — 요청 없이 로그인 창
    const c2 = makeContext(); await loggedIn(c2); run(c2, '__leadInbox.session.expiresAt = Date.now() - 1'); const n = c2.__server.calls.length;
    run(c2, 'leadInboxView()'); await settle();
    assert(c2.__modal.has('data-lead-inbox-login')); assert.equal(c2.__server.calls.length, n, 'no request with an expired session'); assert.equal(c2.__idb.has('lead_inbox_session'), false);
    // 등록 뒤 승인 때 만료 → 등록은 그대로, 안내
    const c3 = makeContext(); await loggedIn(c3); await run(c3, 'leadInboxFetchList("신규")');
    await run(c3, `(async () => { __webWorkDraft = await leadInboxDraft(leadInboxFind(${JSON.stringify(ID(1))})); webWorkPreviewOpen(__webWorkDraft); })()`);
    c3.__server.sessions.clear();
    await foot(c3, '현장으로 등록').fn(); await settle();
    assert.equal(run(c3, 'state.projects.length'), 1); assert(c3.__log.some(x => /로그인이 만료돼 '승인' 표시를 못 했어요/.test(x)));
    assert.equal(c3.__idb.has('lead_inbox_session'), false);
  });

  await test('⑨ STATIC: paste bridge stays offline · lead region stores two device keys only · not serialized · settings/center/leak hooks', async () => {
    for (const bad of ['fetch(', 'idbSet(', 'idbGet(', 'localStorage', 'sessionStorage', 'location', 'navigator.clipboard']) assert.equal(BRIDGE.includes(bad), false, 'bridge must not use ' + bad);
    for (const bad of ['localStorage', 'sessionStorage', 'navigator.clipboard', 'location.']) assert.equal(LEAD.includes(bad), false, 'lead region must not use ' + bad);
    const keys = [...LEAD.matchAll(/idbSet\('([^']+)'/g)].map(m => m[1]).sort();
    assert.deepEqual([...new Set(keys)], ['lead_inbox_url'], 'the only device key is the address');
    assert.equal((LEAD.match(/adminCode:/g) || []).length, 1, 'adminCode is sent only in the login payload');
    assert.equal(/idbSet\('lead_inbox_session'/.test(LEAD), false, 'the session token is never written to IndexedDB');
    assert.equal(/IndexedDB|Apps Script|세션/.test(run(makeContext(), 'leadInboxSettingsHtml()')), false, 'settings text uses plain words');
    const serialize = extract('serializeData');
    assert.equal(/lead_inbox|__leadInbox/.test(serialize), false, 'not part of the synced data');
    assert.equal(/lead_inbox|__leadInbox/.test(extract('hjSnapshot')), false, 'not part of the safety snapshot');
    assert.match(extract('openGdriveSetup'), /leadInboxSettingsMount\(root\)/, 'settings › 기타 has the address field');
    assert.match(extract('webWorkCenterOpen'), /leadInboxCenterBind\(\)/);
    assert.match(extract('hjLeakAsView'), /leadInboxAfterRegister\(context\.web\.via,p\.name,'as'\)/, 'leak AS approval after its own save');
    assert.equal(/<meta[^>]+Content-Security-Policy/i.test(source), false, 'index.html has no CSP meta (script.google.com needs no allow-list today)');
    assert.match(LEAD, /window\.__hjLeadInboxBootDone=leadInboxBoot\(\);/);
  });

  console.log('leadinbox-pull-v612: ' + passed + '/9 PASS; fake lead-inbox server, synthetic data; no browser or real network');
})().catch(error => { console.error(error); process.exitCode = 1; });

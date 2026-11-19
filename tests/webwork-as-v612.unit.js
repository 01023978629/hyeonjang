/* v612 입구 정리 — 📥 웹 업무 연결의 A/S·하자 분류(→ 고른 현장의 🔧 AS 관리) · 광고 탭 누수 링크(만물웹) · 공개 페이지 noindex.
   실제 앱 코드(index.html 의 웹 업무 연결 구역 통째 + 누수 AS 저장 함수)를 vm 에서 돌린다 — 합성 자료만, 브라우저·바깥 요청·저장소 없음.
   ① CLASSIFY  공간 첫 칸 'A/S'(별칭 AS·하자·하자보수) → service 'as'·'A/S·하자', 모르는 유형은 여전히 오류, 옛 세 분류 그대로
   ② PARSE     만물웹 lead-transport.js buildLeadText 가 만드는 A/S 본문 그대로(접수 경로 website 만) · 동의 없음/경로 다름은 오류 · 같은 본문의 인테리어와 다른 중복 ID
   ③ CANDS     전화·고객 이름·주소/단지 낱말로 후보만 — 동·호 숫자 하나로는 후보 아님 · 보관 현장 포함 · 고르기 칸은 미리 고르지 않음 · 이름은 글자로
   ④ REGISTER  안 고르면 '현장을 먼저 고르세요'(안전판·저장 없음) → 고르면 안전판 → 저장, 새 현장 0 · AS 기록 1(AS 관리 꼴) · 메모 1(리드ID) · AS 관리 열기 ·
               같은 메일·같은 접수번호 다시 막기 · 저장 실패면 되돌림 · 누수 현장은 원인 확인 창(hjLeakAsView)으로 · 현장 등록 버튼 길(webWorkRegister)은 A/S 를 거절
   ⑤ LEAKAS    누수 AS 원자 저장(hjLeakAsSave)에 web 표시·메모가 같이 들어가고, 같은 메일 두 번째는 저장하지 않는다 · web 없으면 예전 그대로
   ⑥ LINK      HJ_LEAK_WEB_URL = 만물웹 leak.html(canonical) · 소개글은 만물웹 폼 그대로(옛 '증상 여섯 가지·사진 두 장 문자로' 없음, 번호·금액·동호수 없음)
   ⑦ PAGES     leak.html = '홈페이지로 옮겼어요' + 만물웹 버튼 + noindex(스크립트·스타일 파일 없음) · bathroom.html noindex · 옛 '[누수접수]' 파서는 남음 · stage-pages 목록
   HJ_V612_MUTATION=no-as(분류 줄 삭제) ①, preselect(첫 후보 미리 고르기) ③, no-dupe-as(AS 기록 중복 판정 삭제) ④, old-url(링크를 현장웹으로) ⑥ 에서 실패해야 한다.
   HJ_V612_BASELINE=<commit>(그 커밋의 index.html) 은 ① 에서 실패해야 한다(기준선 2c8160d = v611).
   HJ_MANMOOL_ROOT=<만물웹 사본 폴더> 를 주면 ⑥ 이 만물웹 leak.html 의 canonical·폼 문구와도 대조한다(CI 에는 없어서 건너뜀). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let source = process.env.HJ_V612_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V612_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'no-as': ["  else if(/^(?:A\\/S|AS|하자|하자보수)$/i.test(compact))service='as';\n", ''],
  'preselect': ["const opt=function(value,label,extra){return '<option value=\"'+escapeAttr(value)+'\"'+(extra||'')+'>'+escapeHtml(label)+'</option>';};",
    "const opt=function(value,label,extra){return '<option value=\"'+escapeAttr(value)+'\"'+(extra||'')+(extra&&value===cands[0].name?' selected':'')+'>'+escapeHtml(label)+'</option>';};"],
  'no-dupe-as': ["    (data.asLog||[]).some(function(item){return item&&item.sourceInquiryId===id;})||\n", ''],
  'old-url': ["const HJ_LEAK_WEB_URL='https://01023978629.github.io/manmool/leak.html';", "const HJ_LEAK_WEB_URL='https://01023978629.github.io/hyeonjang/leak.html';"]
};
const mutation = process.env.HJ_V612_MUTATION || '';
if (mutation) {
  assert(MUT[mutation], 'unknown mutation ' + mutation);
  const [from, to] = MUT[mutation]; assert.equal(source.split(from).length, 2, 'mutation anchor ' + mutation); source = source.replace(from, to);
}

// ── 앱 코드 꺼내기 ──────────────────────────────────────────
const bridgeStart = source.indexOf('/* ═══ 웹 업무 연결 센터'), bridgeEnd = source.indexOf('/* ═══ /웹 업무 연결 센터 ═══ */');
assert(bridgeStart > 0 && bridgeEnd > bridgeStart, 'web work bridge region');
const bridge = source.slice(bridgeStart, bridgeEnd);
function extract(name) {
  const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert(start >= 0, 'function exists: ' + name);
  const lineEnd = source.indexOf('\n', start), first = source.slice(start, lineEnd);
  return first.endsWith('}') ? first : source.slice(start, source.indexOf('\n}', lineEnd) + 2);
}
function constLine(name) {
  const at = source.indexOf('const ' + name + '='); assert(at >= 0, 'const ' + name);
  return source.slice(at, source.indexOf('\n', at));
}
const helpers = ['escapeHtml', 'escapeAttr', 'num', 'hjAddMonths', 'hjToday0', 'hjWarranty', 'localDate', 'pad',
  'hjLeakProjectRef', 'hjLeakProjectByRef', 'hjLeakProjectStamp', 'hjLeakAsSave', 'hjLeakWebIntroText'].map(extract).join('\n');
const consts = ['WARRANTY_ITEMS_DEFAULT', 'HJ_LEAK_WEB_URL', 'HJ_LEAK_WEB_MARK'].map(constLine).join('\n');

const TODAY = '2026-11-19';
function makeContext() {
  const elements = new Map(), log = [];
  const element = extra => Object.assign({ value: '', textContent: '', disabled: false, isConnected: true, onchange: null, focus() { log.push('focus'); } }, extra || {});
  const ctx = {
    console, Date: class extends Date { constructor(...a) { if (!a.length) super(TODAY + 'T12:00:00.000Z'); else super(...a); } static now() { return Date.parse(TODAY + 'T12:00:00.000Z'); } },
    crypto: globalThis.crypto, TextEncoder, structuredClone,
    state: { projects: [], notes: [], asLog: [], dirty: false, activeProject: null },
    __photoCache: { key: 'x' }, __idbSaveTimer: null, __modalCloseLocked: false, __tabStale: false,
    clearTimeout() {}, setTimeout(fn) { fn(); return 1; },
    uidN: 0, uid() { ctx.uidN++; return 'u' + ctx.uidN; },
    toast(t) { log.push('toast:' + t); }, render() { log.push('render'); }, closeModal() { log.push('close'); elements.clear(); return true; },
    asManage(id) { log.push('asManage:' + id); }, persistLocal() { log.push('persistLocal'); },
    projectBackupSafe: p => p, hjLeakRepeatWarranty: () => ({}), photoIntakePending: () => false, __appVersionUpdating: false,
    hjSnapshot: async label => { log.push('snapshot:' + label); return ctx.__snapshotOk !== false; },
    guardedPersistCurrentState: async () => { log.push('persist'); if (ctx.__persistOk === false) return false; return true; },
    hjLeakAsView: (ref, options, back) => { log.push('leakAsView:' + ref); ctx.__leakAs = { ref, options, back }; return true; },
    $: () => null, scheduleFolderAutoSave() {}, backupDriveAuto() {}, cloudAutoSave() {},
    openModal(title, body, buttons) {
      elements.clear(); log.push('modal:' + title); ctx.__modal = { title, body, buttons };
      if (body.includes('id="webWorkAsProject"')) { elements.set('webWorkAsProject', element()); elements.set('webWorkAsIssue', element()); elements.set('webWorkAsInfo', element()); }
      if (body.includes('id="webWorkRegisterStatus"')) elements.set('webWorkRegisterStatus', element());
      ctx.__buttons = (buttons || []).map(b => element({ label: b.label }));
    },
    document: { getElementById: id => elements.get(id) || null, querySelectorAll: sel => sel === '#modalRoot .mfoot button' ? (ctx.__buttons || []) : [] },
    __log: log, __elements: elements
  };
  vm.createContext(ctx);
  vm.runInContext(consts + '\n' + helpers + '\n' + bridge, ctx, { filename: 'index.html#bridge' });
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);

// 만물웹 js/lead-transport.js buildLeadText 가 실제로 만드는 본문(11/19 만물웹 97c4d0b 에서 그 함수를 돌려 얻은 그대로 — 공간 줄 'A/S · 지역', 접수 경로 website)
const AS_MAIL = '[만물인테리어 상담 신청]\n이름: 김하자\n연락처: 010-1234-5678\n공간: A/S · 대전 서구 둔산동 수정타운아파트\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 욕실 타일 줄눈이 들떴어요.\n작년 봄에 공사했습니다.';
const AS_MAIL_FULL = '[만물인테리어 상담 신청]\n이름: 김하자\n연락처: 010-1234-5678\n공간: A/S · 32평 · 대전 서구 둔산동 수정타운아파트\n범위: 부분 · 욕실\n예산/시기: 미정 · 협의\n접수 경로: website\n개인정보 수집·이용 동의: 동의\n메모: 욕실 타일 줄눈이 들떴어요.\n작년 봄에 공사했습니다.';
const PROJECTS = () => [
  { name: '둔산 수정타운 욕실', kind: 'interior', stage: 3, doneAt: '2025-04-10', customer: { name: '', phone: '', addr: '' }, archived: true },
  { name: '갈마동 김하자님 주방', kind: 'interior', stage: 3, doneAt: '2025-08-01', customer: {}, archived: false },
  { name: '전화로만 아는 집', kind: 'interior', stage: 2, customer: { name: '박', phone: '010 1234 5678', addr: '' }, archived: false },
  { name: '노은 101동 도배', kind: 'interior', stage: 1, customer: {}, archived: false },
  { name: '<b>둔산 누수</b> & "따옴표"', kind: 'leak', stage: 3, doneAt: '2026-01-05', customer: { addr: '대전 서구 둔산동' }, archived: false },
  { name: '상관없는 현장', kind: 'interior', stage: 0, customer: {}, archived: false }
];

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS webwork-as-v612 ' + name); }

(async () => {
  await test('① CLASSIFY: A/S·AS·하자·하자보수 → as, unknown types still rejected, old three unchanged', async () => {
    const ctx = makeContext();
    const r = run(ctx, `[ 'A/S · 대전 서구', 'AS', 'as · 32평 · 유성구', '하자', '하자보수 · 대전', 'A / S' ].map(v => { const c = webWorkClassify(v); return [c.service, c.serviceLabel, c.type, c.area, c.region]; })`);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), [['as', 'A/S·하자', 'A/S', '', '대전 서구'], ['as', 'A/S·하자', 'AS', '', ''], ['as', 'A/S·하자', 'as', '32평', '유성구'], ['as', 'A/S·하자', '하자', '', ''], ['as', 'A/S·하자', '하자보수', '', '대전'], ['as', 'A/S·하자', 'A / S', '', '']]);
    const old = run(ctx, `['주거 · 34평 · 대전','누수 · 서구','관리사무소 30일 시험운영'].map(v => webWorkClassify(v).service)`);
    assert.deepEqual(Array.from(old), ['interior', 'leak-pipe', 'office-sales']);
    for (const bad of ['창고 · 대전', 'A/S하자', 'AS센터', '하자 접수', '']) {
      const e = run(ctx, `(() => { try { webWorkClassify(${JSON.stringify(bad)}); return 'accepted'; } catch (e) { return e.code + '|' + e.message; } })()`);
      assert.match(e, /^web-work-invalid\|공간 첫 항목은 .*A\/S 중 하나/, 'unknown type stays an error: ' + bad);
    }
  });

  await test('② PARSE: manmool A/S body (website only), consent/source guards, distinct dedupe id', async () => {
    const ctx = makeContext();
    const r = await run(ctx, `(async () => { const a = webWorkParse(${JSON.stringify(AS_MAIL)}), b = webWorkParse(${JSON.stringify(AS_MAIL_FULL)});
      const d = await webWorkDraftFromText(${JSON.stringify(AS_MAIL)}), i = await webWorkDraftFromText(${JSON.stringify(AS_MAIL.replace('공간: A/S', '공간: 주거'))});
      return { a: [a.service, a.serviceLabel, a.region, a.fields.name, a.fields.phone, a.fields.intakeSource, a.fields.memo], b: [b.service, b.area, b.region, b.fields.scope], draft: [d.service, d.customerName, d.region, /^webmail-[a-f0-9]{64}$/.test(d.id)], differs: d.id !== i.id, interior: i.service }; })()`);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), {
      a: ['as', 'A/S·하자', '대전 서구 둔산동 수정타운아파트', '김하자', '010-1234-5678', 'website', '욕실 타일 줄눈이 들떴어요.\n작년 봄에 공사했습니다.'],
      b: ['as', '32평', '대전 서구 둔산동 수정타운아파트', '부분 · 욕실'], draft: ['as', '김하자', '대전 서구 둔산동 수정타운아파트', true], differs: true, interior: 'interior' });
    const rejected = run(ctx, `({ leakPage: ${JSON.stringify(AS_MAIL.replace('접수 경로: website', '접수 경로: leak-page'))}, pilot: ${JSON.stringify(AS_MAIL.replace('접수 경로: website', '접수 경로: office-pilot'))},
      noConsent: ${JSON.stringify(AS_MAIL.replace('\n개인정보 수집·이용 동의: 동의', ''))}, unknownType: ${JSON.stringify(AS_MAIL.replace('공간: A/S', '공간: 창고'))} })`);
    for (const [key, text] of Object.entries(rejected)) {
      const code = run(ctx, `(() => { try { webWorkParse(${JSON.stringify(text)}); return 'accepted'; } catch (e) { return e.code; } })()`);
      assert.equal(code, 'web-work-invalid', key);
    }
  });

  await test('③ CANDS: phone·name·address hints only, archived kept, nothing preselected, names escaped', async () => {
    const ctx = makeContext();
    ctx.state.projects = PROJECTS();
    const draft = await run(ctx, `webWorkDraftFromText(${JSON.stringify(AS_MAIL)})`);
    ctx.__draft = draft;
    const cands = JSON.parse(JSON.stringify(run(ctx, 'webWorkAsCandidates(__draft)')));
    const byName = Object.fromEntries(cands.map(c => [c.name, c]));
    assert.deepEqual(cands.map(c => c.name).sort(), ['<b>둔산 누수</b> & "따옴표"', '갈마동 김하자님 주방', '둔산 수정타운 욕실', '전화로만 아는 집'].sort());
    assert.equal(cands[0].name, '전화로만 아는 집', 'phone match ranks first'); assert.deepEqual(cands[0].reasons, ['전화 같음']);
    assert.match(byName['둔산 수정타운 욕실'].reasons.join(), /주소·단지/); assert.equal(byName['둔산 수정타운 욕실'].archived, true, 'archived (done) projects are where A/S comes from');
    assert.deepEqual(byName['갈마동 김하자님 주방'].reasons, ['현장 이름에 고객 이름']);
    assert(!byName['노은 101동 도배'] && !byName['상관없는 현장'], 'no candidate without a real hint');
    // 동·호 숫자 하나로는 후보가 아니다
    ctx.__d2 = { ...draft, customerName: '', fields: { ...draft.fields, phone: '042-000-0000' }, region: '101동 501호' };
    assert.deepEqual(Array.from(run(ctx, 'webWorkAsCandidates(__d2)')), [], 'unit numbers alone are not enough');
    const html = run(ctx, 'webWorkAsPickHtml(__draft)');
    assert(!/\sselected\b/.test(html), 'nothing preselected — the owner picks');
    assert.match(html, /<select id="webWorkAsProject"[^>]*><option value="">현장을 고르세요<\/option><optgroup label="추천 — 이름·전화·주소가 맞는 현장">/);
    assert.match(html, /data-web-work-as-cands="4"/); assert.match(html, /<optgroup label="보관 현장">|둔산 수정타운 욕실 — [^<]*\(보관\)/);
    assert(!html.includes('<b>둔산'), 'project names are escaped'); assert(html.includes('&lt;b&gt;둔산 누수&lt;/b&gt; &amp; &quot;따옴표&quot;'));
    assert.equal((html.match(/value="상관없는 현장"/g) || []).length, 1, 'every project still listed once');
    // 고르면 보증 한 줄(hjWarranty 그대로)
    assert.match(run(ctx, "webWorkAsInfoText('둔산 수정타운 욕실')"), /^🛡 보증 ~2028-04-10 \(D-\d+\) · 법정 기본 기간$/);
    assert.match(run(ctx, "webWorkAsInfoText('노은 101동 도배')"), /보증 정보 없음/);
    assert.match(run(ctx, "webWorkAsInfoText(state.projects[4].name)"), /누수 현장 — 접수 전에 이전 원인과 같은지/);
  });

  await test('④ REGISTER: pick first, snapshot → persist, one AS record + one note, no new project, dedupe, rollback, leak routing', async () => {
    const ctx = makeContext();
    ctx.state.projects = PROJECTS();
    await run(ctx, `(async () => { __webWorkDraft = await webWorkDraftFromText(${JSON.stringify(AS_MAIL)}); webWorkPreviewOpen(__webWorkDraft); })()`);
    assert.equal(ctx.__modal.title, '🔎 웹 문의 미리보기');
    assert.deepEqual(Array.from(ctx.__modal.buttons, b => b.label), ['🔧 AS 관리에 접수', '다시 붙여넣기', '닫기'], 'no "현장으로 등록" for A/S');
    assert.match(ctx.__modal.body, /data-web-work-service="as" style="[^"]*#2563eb/, 'A/S card is highlighted');
    const before = JSON.stringify({ p: ctx.state.projects, n: ctx.state.notes, a: ctx.state.asLog });
    const id = run(ctx, '__webWorkDraft.id');
    // 안 고르면 막는다 — 안전판·저장 없음
    assert.equal(await run(ctx, `webWorkAsRegister(${JSON.stringify(id)})`), false);
    assert.equal(ctx.__elements.get('webWorkAsIssue').textContent.startsWith('현장을 먼저 고르세요'), true);
    assert(!ctx.__log.some(l => l.startsWith('snapshot') || l === 'persist'), 'no snapshot or save without a project');
    assert.equal(JSON.stringify({ p: ctx.state.projects, n: ctx.state.notes, a: ctx.state.asLog }), before);
    // 현장 등록 길은 A/S 를 거절한다(새 현장 0)
    assert.equal(await run(ctx, `webWorkRegister(${JSON.stringify(id)})`), false); assert.equal(ctx.state.projects.length, 6);
    // 고르고 접수
    const sel = ctx.__elements.get('webWorkAsProject'); sel.value = '둔산 수정타운 욕실'; sel.onchange();
    assert.match(ctx.__elements.get('webWorkAsInfo').textContent, /🛡 보증/); assert.equal(ctx.__elements.get('webWorkAsIssue').textContent, '');
    ctx.__log.length = 0;
    assert.equal(await run(ctx, `webWorkAsRegister(${JSON.stringify(id)})`), true);
    assert.deepEqual(ctx.__log.filter(l => /^(snapshot|persist|asManage|close)/.test(l)).map(l => l.replace(/:u\d+$/, ':ID')), ['snapshot:웹 업무 연결 AS 접수 전', 'persist', 'close', 'asManage:ID']);
    assert.equal(ctx.state.projects.length, 6, 'no new project or lead');
    assert.equal(ctx.state.asLog.length, 1); assert.equal(ctx.state.notes.length, 1);
    const rec = ctx.state.asLog[0];
    assert.deepEqual(Object.keys(rec).sort(), ['date', 'id', 'project', 'sourceInquiryId', 'status', 'text'].sort());
    assert.equal(rec.project, '둔산 수정타운 욕실'); assert.equal(rec.status, 'open'); assert.equal(rec.date, TODAY); assert.equal(rec.sourceInquiryId, id);
    assert.equal(rec.text, '[홈페이지] 욕실 타일 줄눈이 들떴어요. / 작년 봄에 공사했습니다.');
    assert(ctx.__log.includes('asManage:' + rec.id), 'AS 관리 opens on the new record');
    const note = ctx.state.notes[0];
    assert.equal(note.project, '둔산 수정타운 욕실'); assert.match(note.text, /^\[웹 업무 연결\]\n서비스: A\/S·하자\n/); assert.match(note.text, /\n리드ID: webmail-[a-f0-9]{64}$/); assert.match(note.text, /공간: A\/S · 대전 서구/);
    assert.deepEqual(ctx.state.projects[0].customer, { name: '', phone: '', addr: '' }, 'project customer fields are not touched');
    assert.equal(run(ctx, '__webWorkDraft'), null, 'PII draft cleared after saving');
    // 같은 메일 다시 → 중복 (메모를 지워도 AS 기록 표시로 막는다)
    ctx.state.notes = [];
    await run(ctx, `(async () => { __webWorkDraft = await webWorkDraftFromText(${JSON.stringify(AS_MAIL)}); webWorkPreviewOpen(__webWorkDraft); })()`);
    assert.match(ctx.__modal.body, /이미 등록된 문의입니다.<\/b> 같은 메일로 AS를 다시 접수하지 않습니다/); assert(!ctx.__modal.buttons.some(b => /AS 관리에 접수/.test(b.label)));
    // 같은 접수번호(본문은 달라도) → 중복
    ctx.state.asLog = []; ctx.state.notes = [];
    const receiptMail = AS_MAIL + '\n접수번호: LD-20261119-0001';
    await run(ctx, `(async () => { __webWorkDraft = await webWorkDraftFromText(${JSON.stringify(receiptMail)}); webWorkPreviewOpen(__webWorkDraft); })()`);
    ctx.__elements.get('webWorkAsProject').value = '전화로만 아는 집';
    assert.equal(await run(ctx, 'webWorkAsRegister(__webWorkDraft.id)'), true); assert.equal(ctx.state.asLog[0].sourceReceiptNo, 'LD-20261119-0001');
    assert.equal(run(ctx, `webWorkDupe('webmail-' + 'a'.repeat(64), 'LD-20261119-0001')`), true, 'same receipt number blocks a second A/S');
    // 저장 실패 → 되돌림
    ctx.state.asLog = []; ctx.state.notes = []; ctx.__persistOk = false;
    await run(ctx, `(async () => { __webWorkDraft = await webWorkDraftFromText(${JSON.stringify(AS_MAIL)}); webWorkPreviewOpen(__webWorkDraft); })()`);
    ctx.__elements.get('webWorkAsProject').value = '둔산 수정타운 욕실';
    assert.equal(await run(ctx, 'webWorkAsRegister(__webWorkDraft.id)'), false);
    assert.deepEqual([ctx.state.asLog.length, ctx.state.notes.length, ctx.state.projects.length], [0, 0, 6], 'persist failure rolls back');
    assert.match(ctx.__elements.get('webWorkRegisterStatus').textContent, /접수를 중단/); assert.equal(run(ctx, '__modalCloseLocked'), false);
    // 안전판 실패 → 아무것도 안 바뀜
    ctx.__persistOk = true; ctx.__snapshotOk = false; ctx.__log.length = 0;
    assert.equal(await run(ctx, 'webWorkAsRegister(__webWorkDraft.id)'), false); assert(!ctx.__log.includes('persist'));
    assert.deepEqual([ctx.state.asLog.length, ctx.state.notes.length], [0, 0]);
    // 누수 현장 → v423 원인 확인 창으로(여기서 저장하지 않는다)
    ctx.__snapshotOk = true; ctx.__log.length = 0;
    const leakName = ctx.state.projects[4].name; ctx.__elements.get('webWorkAsProject').value = leakName;
    assert.equal(await run(ctx, 'webWorkAsRegister(__webWorkDraft.id)'), true);
    assert.equal(ctx.__leakAs.ref, leakName); assert.equal(ctx.__leakAs.options.text, '[홈페이지] 욕실 타일 줄눈이 들떴어요. / 작년 봄에 공사했습니다.');
    assert.match(ctx.__leakAs.options.web.inquiryId, /^webmail-[a-f0-9]{64}$/); assert.equal(ctx.__leakAs.options.web.note.project, leakName);
    assert(!ctx.__log.some(l => l.startsWith('snapshot') || l === 'persist'), 'leak path saves inside the leak AS window only');
    assert.equal(run(ctx, '__webWorkDraft'), null); ctx.__leakAs.back(); assert.equal(ctx.__modal.title, '🔎 웹 문의 미리보기', 'cancel returns to the preview');
    // 현장이 하나도 없으면 안내
    ctx.state.projects = [];
    await run(ctx, `(async () => { __webWorkDraft = await webWorkDraftFromText(${JSON.stringify(AS_MAIL)}); webWorkPreviewOpen(__webWorkDraft); })()`);
    assert.match(ctx.__modal.body, /data-web-work-as-cands="0"[^>]*>앱에 현장이 없어요/);
    assert.equal(await run(ctx, 'webWorkAsRegister(__webWorkDraft.id)'), false); assert.match(ctx.__elements.get('webWorkAsIssue').textContent, /현장을 먼저 고르세요/);
  });

  await test('⑤ LEAKAS: web mark + note go into the same leak AS save; second time is refused; plain leak AS unchanged', async () => {
    const ctx = makeContext();
    ctx.state.projects = [{ name: '둔산 누수', kind: 'leak', stage: 3, doneAt: '2026-01-05', customer: {}, leak: { detect: { cause: '욕실 배수관' } } }];
    ctx.durableLocalMutation = async ({ mutateDraft, beforeCommit }) => {
      if (beforeCommit) await beforeCommit();
      const draft = structuredClone({ projects: ctx.state.projects, asLog: ctx.state.asLog, notes: ctx.state.notes }), result = mutateDraft(draft);
      ctx.state.asLog = draft.asLog; ctx.state.notes = draft.notes; return result;
    };
    const draft = await run(ctx, `webWorkDraftFromText(${JSON.stringify(AS_MAIL)})`);
    ctx.__web = { inquiryId: draft.id, receiptNo: '', note: run(ctx, `webWorkNote(${JSON.stringify(draft)}, '둔산 누수')`) };
    const p = ctx.state.projects[0];
    ctx.__p = p;
    const id1 = await run(ctx, `hjLeakAsSave(__p, { text: '[홈페이지] 천장 물자국', same: 'same' }, hjLeakProjectStamp(__p), { web: __web })`);
    assert.equal(ctx.state.asLog.length, 1); const a = ctx.state.asLog[0];
    assert.equal(a.id, id1); assert.equal(a.sourceInquiryId, draft.id); assert.deepEqual(JSON.parse(JSON.stringify(a.leak)), { prevProjectId: '둔산 누수', cause: '욕실 배수관', same: true });
    assert.equal(ctx.state.notes.length, 1); assert.match(ctx.state.notes[0].text, /리드ID: webmail-/); assert.equal(ctx.state.notes[0].project, '둔산 누수');
    await assert.rejects(run(ctx, `hjLeakAsSave(__p, { text: '[홈페이지] 천장 물자국', same: 'same' }, hjLeakProjectStamp(__p), { web: __web })`), /이미 접수한 웹 문의/);
    assert.equal(ctx.state.asLog.length, 1, 'second save of the same mail is refused');
    await run(ctx, `hjLeakAsSave(__p, { text: '전화로 온 AS', same: 'same' }, hjLeakProjectStamp(__p), {})`);
    assert.equal(ctx.state.asLog.length, 2); assert.equal(ctx.state.notes.length, 1, 'no note without web');
    assert.deepEqual(Object.keys(ctx.state.asLog[1]).sort(), ['date', 'id', 'leak', 'project', 'status', 'text'], 'plain leak AS record shape unchanged');
  });

  await test('⑥ LINK: ads link = manmool leak.html canonical, intro matches the manmool form', async () => {
    const ctx = makeContext();
    assert.equal(run(ctx, 'HJ_LEAK_WEB_URL'), 'https://01023978629.github.io/manmool/leak.html');
    const intro = run(ctx, 'hjLeakWebIntroText()'), body = intro.replace(/https?:\/\/\S+/g, '');
    assert(intro.endsWith('\nhttps://01023978629.github.io/manmool/leak.html'));
    assert.match(body, /연락처/); assert.match(body, /증상/); assert.match(body, /사진은 회신드릴 때 문자로/); assert.match(body, /평수·예산은 묻지 않/);
    assert.doesNotMatch(body, /여섯 가지|사진 두 장|두 장만|문자로 보내 주세요|체크하고/, 'no old hyeonjang leak page wording');
    assert.doesNotMatch(body, /\d/, 'no phone, amount or unit numbers'); assert.doesNotMatch(body, /원\s|만원|협력|동\s*\d|호수/);
    // 만물웹 사본이 있으면(로컬) canonical 과 폼 문구를 직접 대조한다 — CI 에는 없으니 건너뛴다
    const mm = process.env.HJ_MANMOOL_ROOT && path.join(process.env.HJ_MANMOOL_ROOT, 'leak.html');
    if (mm && fs.existsSync(mm)) {
      const page = fs.readFileSync(mm, 'utf8');
      assert(page.includes('<link rel="canonical" href="' + run(ctx, 'HJ_LEAK_WEB_URL') + '"'), 'manmool canonical');
      assert(page.includes('사진은 접수 후 회신드릴 때 문자로') && page.includes('평수·예산은 묻지 않습니다') && /name="phone"[^>]*required/.test(page), 'manmool form wording');
      console.log('  (manmool leak.html 대조함)');
    }
  });

  await test('⑦ PAGES: moved leak.html + noindex, bathroom noindex, old [누수접수] parser kept, stage list', async () => {
    const noindex = '<meta name="robots" content="noindex,nofollow">';
    for (const name of ['leak.html', 'bathroom.html']) {
      const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
      assert.equal(html.split(noindex).length - 1, 1, name + ' noindex once');
      assert(html.indexOf(noindex) > html.indexOf('<head') && html.indexOf(noindex) < html.indexOf('</head>'), name + ' noindex in head');
    }
    const leak = fs.readFileSync(path.join(ROOT, 'leak.html'), 'utf8');
    assert.match(leak, /누수 접수는 만물인테리어 홈페이지로 옮겼어요/);
    assert.match(leak, /<a class="go" id="leakGo" data-leak-moved href="https:\/\/01023978629\.github\.io\/manmool\/leak\.html">/);
    assert(!/<script|<link[^>]+stylesheet|<form|<input/i.test(leak), 'no script, stylesheet file, form or input');
    const bath = fs.readFileSync(path.join(ROOT, 'bathroom.html'), 'utf8');
    for (const kept of ['bathroom.js', 'bathroom-model.js', 'bathroom.css', 'id="customerMode"', 'id="sendToApp"']) assert(bath.includes(kept), 'bathroom feature kept: ' + kept);
    assert(source.includes("const HJ_LEAK_WEB_MARK='[누수접수]';") && /function hjLeakWebParse\(text\)/.test(source) && /function hjLeakWebIntakeView\(prefill\)/.test(source), 'old [누수접수] sms parser kept');
    for (const kept of ['leak.js', 'leak.css']) assert(fs.existsSync(path.join(ROOT, kept)), kept + ' kept in the repo');
    const stage = fs.readFileSync(path.join(ROOT, 'scripts', 'stage-pages.mjs'), 'utf8'), list = (stage.match(/const publicFiles = \[([\s\S]*?)\];/) || [])[1] || '';
    assert(list.includes("'leak.html'") && list.includes("'bathroom.html'") && !list.includes("'leak.js'") && !list.includes("'leak.css'"), 'stage-pages public list');
  });

  console.log('webwork-as-v612: ' + passed + '/7 PASS; synthetic data; no browser, network or storage');
})().catch(error => { console.error('FAIL webwork-as-v612', error && error.stack || error); process.exitCode = 1; });

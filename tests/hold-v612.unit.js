/* v612 ⏸ 보류 묶음 판정 — 실제 앱 함수(index.html 에서 그대로 떼어 낸 HJ_HOLD_* · hjHold* · 대시보드 단추 줄 · CW_MOVED)를 합성 자료로 돌린다.
   브라우저·네트워크·실제 자료 없음(team-config.js 읽기는 가짜 fetch). 화면 쪽(더보기 묶음·견적 작성 탭·광고 탭·🧰)은 hold-v612.e2e.js.
   ① 목록 — 자동·처음 보류 id 가 모두 더보기 칸이거나 따로 그리는 항목 · 보류하지 않는 목록(사진·일정·수금·AS·웹 업무·접수함·🧰·전자계약·AI 비서)과 겹치지 않음 ·
      11/18 대표 자료 꼴(서버 없음·저장 칸 0)이면 18개 모두 보류 (LIST)
   ② 자동 — 고객 페이지 주소·OfficeOps 주소+토큰·직원 작업실 apiUrl 이 있으면 보이고, 받은 카카오 문의·게시한 고객 페이지·열린 팀 업무가 있으면 보인다 ·
      ☁ 팀 공유 할일은 중계(Apps Script)가 연결돼 있어도 처음 보류(18 할 일 하나 — v612 검토) · 내 업무가 읽어 온 남은 공유 할일이 있으면 보임 · 까닭 글은 실제 자리·쉬운 말 (AUTO)
   ③ 자료 — 그 칸에 자료가 생기면 다시 보인다 · 목표 칸의 매출 기준(salesBasis)은 목표가 아니다 · 보관 현장의 예산은 안 센다 · 견적 셋은 자료와 상관없이 보류 ·
      예산 경고는 예산이 없어도 견적의 70%를 넘는 지출이 있으면 보임(budgetAlertData 의 실제 입력) (DATA)
   ④ 이 기기 설정 — [다시 보이기]는 그 id 만 · 모르는 id·보류 아닌 것은 안 적음 · 깨진 값은 빈 설정 · 처음으로 되돌리기 · 자동 먼저 차례 (PREFS)
   ⑤ 더보기 묶음 HTML — '보류 n개 보기' · 줄마다 까닭·[다시 보이기] · 직원 작업실은 ./team.html 링크 · 되돌리기 단추는 다시 보이게 한 것이 있을 때만 · 편집 중 잠김 (BLOCK)
   ⑥ 대시보드 단추 줄 — 기본은 ✅ 할 일 하나(☁ 팀 공유 할일·팀 업무·직원 작업실 없음) · 다시 보이면 제자리 · 서명(sig)이 바뀐다 (DASH)
   ⑦ 🧰 옮긴 명령 — 관리 프로그램과 같은 일인 사진 명령 넷만 · 청구 누락(cw_unbilled)·캘린더 맞추기·작업내역서 반영은 남김 · 내가 만든 명령은 안 옮김 (COWORK)
   HJ_V612_MUTATION=no-auto 는 ①②, shared-when-relay 는 ②, no-data 는 ②③, goal-basis·alert-budget-only 는 ③, show-ignored 는 ④, dash-always 는 ⑥, move-unbilled 는 ⑦ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const MUT = {
  'no-auto': ["  if(f){let a='';try{a=f()||'';}catch(e){a='';}if(a)return {why:String(a),auto:true};}\n", '\n'],
  'no-data': ["  return {why:n>0?'':d.why,auto:false};", '  return {why:d.why,auto:false};'],
  'shared-when-relay': ["  sharedtodo:{why:'할 일은 ✅ 할 일 한 곳에 — 팀 공유 할일은 직원이 생기면 다시 보이기',", "  sharedtodo:{why:'',"],
  'alert-budget-only': ["n:()=>hjHoldProjCount(p=>num(p.budget)>0?1:0)+(typeof budgetAlertData==='function'?budgetAlertData().length:0)}", "n:()=>hjHoldProjCount(p=>num(p.budget)>0?1:0)}"],
  'goal-basis': ["n:()=>{const g=state.goals||{};return (num(g.month)>0?1:0)+(num(g.year)>0?1:0);}}", 'n:()=>Object.keys(state.goals||{}).length}'],
  'show-ignored': ["function hjHeld(id){try{return !!hjHoldWhy(id)&&!hjHoldPrefs().show.includes(id);}", 'function hjHeld(id){try{return !!hjHoldWhy(id);}'],
  'dash-always': ["const shared=!hjHeld('sharedtodo'),team=!hjHeld('teamboard'),room=!hjHeld('teamroom');", 'const shared=true,team=true,room=true;'],
  'move-unbilled': ["  cw_photoassign:'확인필요 정리 · 프로젝트 정리'   // 현장을 못 정한 사진 하나씩 현장 고르기\n});", "  cw_photoassign:'확인필요 정리 · 프로젝트 정리',cw_unbilled:'월간 정리'\n});"]
};
let src = SRC;
if (process.env.HJ_V612_MUTATION) {
  const m = MUT[process.env.HJ_V612_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V612_MUTATION);
  assert.equal(src.split(m[0]).length, 2, 'mutation anchor'); src = src.replace(m[0], () => m[1]);
}
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, 'slice ' + from.slice(0, 30)); return src.slice(a, b); };
const code = [
  cut('function escapeHtml(s){', 'function escapeAttr(s){'), cut('function escapeAttr(s){', '\n') + '\n',
  cut('const MORE_CATS=[', 'const MORE_NAV_SHORTCUTS='),
  cut('const HJ_HOLD_KEY=', 'function moreItemInfo(action){'),
  cut('function moreItemInfo(action){', 'function moreReadActions('),
  cut('const CW_SAFE=', 'const CW_FILL_RE='),
  cut('function budgetAlertData(){', 'function budgetAlert(){')
].join('\n') + '\n;globalThis.__hold={HJ_HOLD_IDS,HJ_HOLD_NEVER,HJ_HOLD_EXTRA,HJ_HOLD_AUTO,HJ_HOLD_DEFAULT,HJ_HOLD_KEY,MORE_CATS,CW_MOVED};';

function env(opts = {}) {
  const store = new Map(Object.entries(opts.local || {}));
  const ctx = {
    console, setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {},
    state: Object.assign({ projects: [{ name: '시험현장', archived: false }], quotes: [{ id: 'q1' }], notes: [], inventory: [], materials: [], suppliers: [], supplierMap: {},
      satisfaction: [], goals: {}, adPosts: [], portalCfg: {}, kakaoLastAt: '', tab: 'photos' }, opts.state || {}),
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { if (opts.denyWrite) throw new Error('quota'); store.set(k, String(v)); }, removeItem: k => store.delete(k) },
    __relay: Object.assign({ url: '', token: '' }, opts.relay || {}), __officeOps: Object.assign({ url: '', token: '' }, opts.office || {}),
    relayReady() { return !!(ctx.__relay.url && ctx.__relay.token); },
    hjTeamList: () => (ctx.state.notes || []).filter(n => n && n.teamTask), hjTeamData: n => n.teamTask || {},
    num: v => Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')) || 0,
    toasts: [], toast: m => ctx.toasts.push(String(m)), renders: 0, scheduleRender: () => { ctx.renders++; },
    document: { getElementById: () => null, createElement: () => ({ innerHTML: '', firstElementChild: null }) },
    fetches: 0, fetch: async () => { ctx.fetches++; if (opts.teamFail) throw new Error('offline'); return { ok: true, text: async () => "window.HJ_TEAM_CONFIG = Object.freeze({ apiUrl: '" + (opts.team || '') + "' });" }; },
    projStats: n => Object.assign({ costTotal: 0, est: 0 }, (opts.stats || {})[n]),   // 예산 경고(budgetAlertData)가 보는 지출·견적만
    window: {}, AD_CH: [{ id: 'threads' }], COMPANY: { name: '시험회사' }, moreDispatch: a => a, hjQuoteNewDirect() {}, hjTeamBoard() {}, hjSharedTodoView() {}, adPostAdd() {}
  };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, store, H: ctx.__hold };
}
const settle = () => new Promise(r => setImmediate(r));
const heldIds = c => [...c.hjHoldState().held];
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS hold-v612 ' + name); }

(async () => {
  await test('① 목록 — 더보기 칸·따로 그리는 항목 · 보류하지 않는 것과 겹치지 않음 · 대표 자료 꼴이면 18개 모두 보류 (LIST)', async () => {
    const { ctx, H } = env();
    const menu = new Set(H.MORE_CATS.flatMap(c => c.items.map(i => i[0])));
    assert.equal(menu.size, 126, '더보기 126개 그대로(지우지 않음)');
    for (const id of H.HJ_HOLD_IDS) assert.ok(menu.has(id) !== !!H.HJ_HOLD_EXTRA[id], id + ' 는 더보기 칸이거나 따로 그리는 항목 하나');
    for (const id of Object.keys(H.HJ_HOLD_EXTRA)) assert.ok(!menu.has(id) && H.HJ_HOLD_IDS.includes(id), 'extra ' + id);
    const never = ['photoaudit', 'photobundle', 'beforeafter', 'schshare', 'payproof', 'payplan', 'asmanage', 'webbridge', 'aptorders', 'claudeinbox', 'cowork', 'contractdraft', 'ai', 'aiprovider'];
    for (const id of never) assert.ok(H.HJ_HOLD_NEVER.includes(id) && !H.HJ_HOLD_IDS.includes(id), '보류하지 않음 ' + id);
    assert.deepEqual([...Object.keys(H.HJ_HOLD_AUTO), ...Object.keys(H.HJ_HOLD_DEFAULT)].filter(id => H.HJ_HOLD_NEVER.includes(id)), [], '자동·처음 목록은 보류하지 않는 목록과 겹치지 않는다');
    assert.deepEqual([...H.HJ_HOLD_IDS], ['kakaoin', 'ptlist', 'officeops', 'teamboard', 'teamroom', 'sharedtodo', 'quotenew', 'aiquote', 'photoquote', 'inventory', 'materials', 'matdue', 'suppliers', 'satisfaction', 'goal', 'budget', 'budgetalert', 'adpostlog']);
    ctx.hjHoldTeamState(); await settle();   // team-config.js apiUrl '' → off
    assert.deepEqual(heldIds(ctx).sort(), [...H.HJ_HOLD_IDS].sort(), '서버 없음·저장 칸 0 → 18개 모두 보류');
    const st = ctx.hjHoldState();
    assert.deepEqual([...st.rows.filter(r => r.auto).map(r => r.id)], ['kakaoin', 'ptlist', 'officeops', 'teamboard', 'teamroom', 'sharedtodo'], '자동 보류가 먼저 · 정해진 차례');
    assert.ok(st.rows.every(r => r.why && typeof r.why === 'string'), '줄마다 까닭');
    assert.equal(ctx.fetches, 1, 'team-config.js 는 한 번만 읽는다');
    for (const id of never) assert.equal(ctx.hjHeld(id), false, 'never ' + id);
  });

  await test('② 자동 — 서버 주소·토큰이 있거나 이미 자료가 있으면 보인다 (AUTO)', async () => {
    const on = env({ state: { portalCfg: { base: 'https://example.invalid/portal' } }, office: { url: 'https://example.invalid/office', token: 'TEST_TOKEN' },
      relay: { url: 'https://script.google.com/macros/s/TEST_DEPLOY_ID/exec', token: 'TEST_TOKEN' }, team: 'https://example.invalid/team' });
    on.ctx.hjHoldTeamState(); await settle();
    for (const id of ['kakaoin', 'ptlist', 'officeops', 'teamboard', 'teamroom']) assert.equal(on.ctx.hjHeld(id), false, '연결됨 → 보임 ' + id);
    // 18 할 일 하나 — 중계가 연결된 기기(대표 PC·폰)에서도 ☁ 팀 공유 할일은 처음엔 접는다(자동이 아니라 처음 보류 — 까닭은 '할 일은 한 곳에')
    const shared = on.ctx.hjHoldReason('sharedtodo');
    assert.deepEqual([on.ctx.hjHeld('sharedtodo'), shared.auto], [true, false], '중계 연결 → 공유 할일은 처음 보류 ' + JSON.stringify(shared));
    assert.match(shared.why, /할 일은 ✅ 할 일 한 곳에/);
    assert.equal(on.ctx.dashboardTodoBtnsHTML().includes('dashboardSharedTodoOpen'), false, '대시보드 할 일 단추는 하나');
    assert.match(on.ctx.dashboardTodoHintText(), /✅ 할 일 한 곳에/);
    on.ctx.__hjMyWork = { sharedState: 'ready', shared: [{ id: 's1', done: true }] };
    assert.equal(on.ctx.hjHeld('sharedtodo'), true, '끝난 공유 할일만 있으면 그대로 보류');
    on.ctx.__hjMyWork = { sharedState: 'ready', shared: [{ id: 's1', done: false }] };
    assert.equal(on.ctx.hjHeld('sharedtodo'), false, '내 업무가 읽어 온 남은 공유 할일이 있으면 보인다(자료가 있으면 숨기지 않는다)');
    on.ctx.__hjMyWork = { sharedState: 'error', shared: [{ id: 's1', done: false }] };
    assert.equal(on.ctx.hjHeld('sharedtodo'), true, '읽기에 실패한 목록은 세지 않는다');
    assert.equal(env().ctx.hjHoldReason('sharedtodo').auto, true, '중계가 없으면 자동 보류(서버 없음)가 먼저');
    // 까닭 글 — 실제로 고치는 자리 · 개발 말(파일 이름) 없음 · 읽기 실패는 '확인하지 못했어요'
    const plain = env();
    assert.match(plain.ctx.hjHoldWhy('kakaoin'), /현장 화면 \[🔗 고객 페이지\] › ⚙️ 서버 설정/);
    assert.match(plain.ctx.hjHoldWhy('ptlist'), /현장 화면 \[🔗 고객 페이지\] › ⚙️ 서버 설정/);
    assert.match(plain.ctx.hjHoldWhy('officeops'), /^영업·정기관리 서버가/);
    plain.ctx.hjHoldTeamState(); await settle();
    assert.equal(plain.ctx.hjHoldWhy('teamroom'), '직원 작업실 서버가 아직 없어요');
    for (const id of plain.H.HJ_HOLD_IDS) assert.ok(!/team-config|\.js\b|\.md\b/.test(plain.ctx.hjHoldWhy(id)), id + ' 까닭에 파일 이름 ' + plain.ctx.hjHoldWhy(id));
    // 중계가 Apps Script 주소가 아니면(공유 할일 서버 계약이 없음) 보류 그대로
    const other = env({ relay: { url: 'https://example.invalid/relay', token: 'TEST_TOKEN' } });
    assert.equal(other.ctx.hjHeld('sharedtodo'), true, 'Apps Script 가 아닌 중계 → 공유 할일 보류');
    // 자료가 이미 있으면 서버가 없어도 보인다
    const data = env({ state: { kakaoLastAt: '2026-11-01T00:00:00Z', projects: [{ name: '시험현장', portalUrl: 'https://example.invalid/p' }],
      notes: [{ id: 't1', todo: true, teamTask: { schema: 1, status: 'doing', title: '가상 업무' } }] } });
    data.ctx.hjHoldTeamState(); await settle();
    assert.deepEqual([data.ctx.hjHeld('kakaoin'), data.ctx.hjHeld('ptlist'), data.ctx.hjHeld('teamboard'), data.ctx.hjHeld('teamroom')], [false, false, false, true], '받은 문의·게시한 페이지·열린 팀 업무 → 보임, 직원 작업실 링크는 서버 없으면 보류');
    const done = env({ state: { notes: [{ id: 't1', teamTask: { schema: 1, status: 'done' } }] } });
    done.ctx.hjHoldTeamState(); await settle();
    assert.equal(done.ctx.hjHeld('teamboard'), true, '끝난 팀 업무만 있으면 보류');
    // OfficeOps 주소만(토큰 없음)은 못 쓴다 · team-config 를 못 읽으면 보류
    assert.equal(env({ office: { url: 'https://example.invalid/office' } }).ctx.hjHeld('officeops'), true);
    const fail = env({ teamFail: true }); fail.ctx.hjHoldTeamState(); await settle();
    assert.deepEqual([fail.ctx.hjHoldTeamState(), fail.ctx.hjHeld('teamroom')], ['error', true]);
    assert.match(fail.ctx.hjHoldWhy('teamroom'), /확인하지 못했어요/, '읽기 실패는 서버가 없다고 하지 않는다');
    assert.match(env().ctx.hjHoldWhy('officeops'), /OfficeOps/);
  });

  await test('③ 자료 — 그 칸에 자료가 생기면 다시 보인다 · 매출 기준은 목표가 아님 · 견적 셋은 늘 보류 (DATA)', async () => {
    const one = { inventory: [{ id: 'i1' }], materials: [{ id: 'm1' }], satisfaction: [{ id: 's1' }], adPosts: [{ id: 'a1', ch: 'threads' }], suppliers: [{ id: 'x' }] };
    for (const [key, ids] of [['inventory', ['inventory']], ['materials', ['materials']], ['satisfaction', ['satisfaction']], ['adPosts', ['adpostlog']], ['suppliers', ['suppliers']]]) {
      const { ctx } = env({ state: { [key]: one[key] } });
      for (const id of ids) assert.equal(ctx.hjHeld(id), false, key + ' 1건 → ' + id + ' 보임');
    }
    assert.equal(env({ state: { supplierMap: { '시험 자재': '시험상회' } } }).ctx.hjHeld('suppliers'), false, '거래처 연결표도 자료');
    assert.equal(env({ state: { goals: { salesBasis: 'stmt' } } }).ctx.hjHeld('goal'), true, '매출 기준(salesBasis)만 있으면 목표 없음 → 보류');
    assert.equal(env({ state: { goals: { salesBasis: 'stmt', month: 10000000 } } }).ctx.hjHeld('goal'), false, '월 목표 → 보임');
    assert.deepEqual([true, true].map((_, i) => env({ state: { projects: [{ name: 'A', archived: i === 0, budget: 5000000 }] } }).ctx.hjHeld('budget')), [true, false], '보관 현장의 예산은 안 센다');
    assert.equal(env({ state: { projects: [{ name: 'A', budget: '3,000,000' }] } }).ctx.hjHeld('budgetalert'), false);
    // 예산 경고는 예산이 없어도 견적의 70%(지출 목표)와 지출을 견준다 — 경고가 생기면 보류하지 않는다(예산 메뉴는 그대로 보류)
    const spend = env({ state: { projects: [{ name: 'A' }] }, stats: { A: { est: 1000000, costTotal: 800000 } } }).ctx;
    assert.deepEqual([spend.hjHeld('budgetalert'), spend.hjHeld('budget')], [false, true], '예산 없이 지출 114% → 예산 경고 보임');
    assert.equal(env({ state: { projects: [{ name: 'A' }] }, stats: { A: { est: 1000000, costTotal: 300000 } } }).ctx.hjHeld('budgetalert'), true, '지출 43% → 경고 없음 → 보류');
    assert.equal(env({ state: { projects: [{ name: 'A', matOrders: [{ id: 'o1' }] }] } }).ctx.hjHeld('matdue'), false, '납품 기록 → 보임');
    const many = env({ state: { quotes: Array.from({ length: 40 }, (_, i) => ({ id: 'q' + i })), inventory: [{ id: 'i' }] } }).ctx;
    assert.deepEqual(['quotenew', 'aiquote', 'photoquote'].map(id => many.hjHeld(id)), [true, true, true], '견적 셋은 견적 수와 상관없이 보류(대표 결정)');
    assert.match(many.hjHoldWhy('quotenew'), /Claude 견적 만들기\(단가표 엑셀\)/);
  });

  await test('④ 이 기기 설정 — 다시 보이기·되돌리기·깨진 값·모르는 id (PREFS)', async () => {
    const { ctx, store, H } = env();
    assert.equal(ctx.hjHoldShow('kakaoin'), true);
    assert.deepEqual(JSON.parse(store.get(H.HJ_HOLD_KEY)), { show: ['kakaoin'] }, '그 id 만 적는다');
    assert.equal(ctx.hjHeld('kakaoin'), false, '다시 보임');
    assert.equal(ctx.hjHeld('ptlist'), true, '다른 것은 그대로');
    assert.deepEqual([...ctx.hjHoldState().shown], ['kakaoin']);
    assert.ok(!ctx.hjHoldState().held.has('kakaoin'));
    assert.equal(ctx.hjHoldShow('asmanage'), false, '보류하지 않는 것은 적지 않는다');
    assert.equal(ctx.hjHoldShow('없는기능'), false);
    assert.deepEqual(JSON.parse(store.get(H.HJ_HOLD_KEY)), { show: ['kakaoin'] });
    ctx.state.tab = 'quotemaker'; ctx.hjHoldShow('quotenew'); assert.equal(ctx.renders, 1, '견적 작성 탭이면 다시 그린다');
    assert.equal(ctx.hjHoldReset(), true); assert.equal(store.has(H.HJ_HOLD_KEY), false, '처음 보류로');
    assert.deepEqual([ctx.hjHeld('kakaoin'), ctx.hjHeld('quotenew')], [true, true]);
    for (const bad of ['not-json', '[]', '{"show":"kakaoin"}', '{"show":[1,null,{},"없는기능","kakaoin","kakaoin"]}']) {
      const e = env({ local: { [H.HJ_HOLD_KEY]: bad } });
      assert.deepEqual([...e.ctx.hjHoldPrefs().show], bad.includes('"kakaoin"') && bad.startsWith('{"show":[') ? ['kakaoin'] : [], '깨진 값 ' + bad);
    }
    const deny = env({ denyWrite: true });
    assert.equal(deny.ctx.hjHoldShow('kakaoin'), false); assert.equal(deny.ctx.hjHeld('kakaoin'), true); assert.match(deny.ctx.toasts.join(' '), /저장하지 못했어요/);
  });

  await test('⑤ 더보기 묶음 HTML — 보류 n개 보기 · 까닭·다시 보이기 · 직원 작업실 링크 · 되돌리기 (BLOCK)', async () => {
    const { ctx } = env();
    ctx.hjHoldTeamState(); await settle();
    const chip = it => '<button type="button" class="more-chip" data-moreaction="' + it.id + '">' + it.label + '</button>';
    let st = ctx.hjHoldState(), html = ctx.moreHoldBlockHtml(st, chip, false);
    assert.ok(html.startsWith('<details class="more-cat-block more-hold" data-cat="hold" id="moreHold">'), '접힌 채로 시작');
    assert.match(html, /보류 18개 보기/);
    assert.equal((html.match(/data-hold-row="/g) || []).length, 18);
    assert.equal((html.match(/data-more-unhold="/g) || []).length, 18, '줄마다 [다시 보이기]');
    assert.equal((html.match(/data-moreaction="/g) || []).length, 13, '더보기 칸 13개는 그 칸 단추 그대로(거기서 연다)');
    assert.equal((html.match(/data-hold-open="/g) || []).length, 4, '따로 그리는 넷은 열기 단추');
    assert.match(html, /<a class="more-chip more-hold-open" href="\.\/team\.html" data-hold-link="teamroom"/, '직원 작업실은 링크');
    assert.ok(html.indexOf('🔌 서버 연결이 없어 접어 둔 것 6') < html.indexOf('💤 안 쓰는 메뉴 12'), '서버 없음 먼저');
    assert.ok(!/data-more-holdreset/.test(html), '되돌릴 것이 없으면 단추 없음');
    ctx.hjHoldShow('inventory'); ctx.hjHoldShow('teamboard');
    st = ctx.hjHoldState(); html = ctx.moreHoldBlockHtml(Object.assign({}, st, { open: true }), chip, false);
    assert.match(html, /id="moreHold" open>/); assert.match(html, /보류 16개 보기/); assert.match(html, /다시 보이게 한 2개/);
    const editing = ctx.moreHoldBlockHtml(st, chip, true);
    assert.equal((editing.match(/data-more-unhold="[^"]+"[^>]* disabled/g) || []).length, 16, '즐겨찾기 편집 중엔 [다시 보이기] 잠김');
    // 모두 다시 보이게 했어도 되돌리기는 남는다
    for (const id of [...ctx.hjHoldState().held]) ctx.hjHoldShow(id);
    st = ctx.hjHoldState(); html = ctx.moreHoldBlockHtml(st, chip, false);
    assert.match(html, /보류 0개 보기/); assert.match(html, /다시 보이게 한 18개/);
    ctx.hjHoldReset(); ctx.state.inventory = [{ id: 'i' }];
    assert.equal(ctx.hjHoldState().rows.length, 17, '자료가 생긴 것은 묶음에서 빠진다');
  });

  await test('⑥ 대시보드 단추 줄 — 기본은 ✅ 할 일 하나 · 다시 보이면 제자리 (DASH)', async () => {
    const { ctx } = env();
    ctx.hjHoldTeamState(); await settle();
    const ids = h => [...h.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    const before = ctx.dashboardTodoBtnsHTML();
    assert.deepEqual(ids(before), ['dashboardTodoBtns', 'dashboardInquiryOpen', 'dashboardTodoOpen', 'dashboardCaseOpen', 'dashboardSearchOpen', 'dashboardOperationsConnections']);
    assert.match(before, /✅ 할 일 확인·추가/); assert.match(before, /data-hold-sig="111"/);
    assert.match(ctx.dashboardTodoHintText(), /할 일은 여기 ✅ 할 일 한 곳에/);
    ['sharedtodo', 'teamboard', 'teamroom'].forEach(id => ctx.hjHoldShow(id));
    const after = ctx.dashboardTodoBtnsHTML();
    assert.deepEqual(ids(after), ['dashboardTodoBtns', 'dashboardInquiryOpen', 'dashboardTodoOpen', 'dashboardCaseOpen', 'dashboardSharedTodoOpen', 'dashboardSearchOpen', 'dashboardTeamOpen', 'dashboardCompanyTeam', 'dashboardOperationsConnections'], '예전 차례 그대로');
    assert.match(after, /data-hold-sig="000"/); assert.match(after, /href="\.\/team\.html"/);
    assert.match(ctx.dashboardTodoHintText(), /팀 공유 목록과 별도/);
  });

  await test('⑦ 🧰 옮긴 명령 — 관리 프로그램과 같은 일인 사진 명령 넷만 (COWORK)', async () => {
    const { ctx, H } = env();
    assert.deepEqual(Object.keys(H.CW_MOVED), ['cw_sitesort', 'cw_photoin', 'cw_chatphoto', 'cw_photoassign']);
    const defaults = ctx.cwDefaultsV529().map(t => t.id);
    for (const id of Object.keys(H.CW_MOVED)) assert.ok(defaults.includes(id) && /사진 정리|확인필요 정리/.test(H.CW_MOVED[id]), id + ' 는 기본 명령이고 관리 프로그램 카드 이름이 있다');
    for (const id of ['cw_unbilled', 'cw_calsync', 'cw_stmt', 'cw_dupe', 'cw_salescheck', 'cw_pay', 'cw_save', 'cw_dev']) assert.equal(ctx.cwMoved({ id, builtin: true }), false, '남김 ' + id);
    assert.equal(ctx.cwMoved({ id: 'cw_sitesort', builtin: false }), false, '내가 만든 명령은 안 옮긴다');
    assert.equal(ctx.cwMoved({ id: 'cw_sitesort', builtin: true }), true);
  });

  console.log('hold-v612.unit: ' + passed + '/' + passed + ' PASS · 합성 자료 · 네트워크 0');
})().catch(error => { console.error('FAIL hold-v612.unit', error && error.stack || error); process.exitCode = 1; });

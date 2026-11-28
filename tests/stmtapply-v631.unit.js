/* v631 🤖 요청함 '내역서 반영'(stmt_apply) (단위 검사)
   대표 결정(11/28 "반영 도구 만들어"): 📑 작업내역서 장부의 '아직 안 넣음' 내역서를 카톡봇·Claude 가 요청(결재)으로 올리면 현장웹이 [📑 반영] 확인 창의
   기본값 그대로 넣는다 — 원본을 이 기기에서 열 수 있고 애매하지 않을 때만. 요청함 ✓ 는 언제나 📑 확인 창을 연다.
   ① 카톡 승인 요청 · 원본이 있는 기기(PC) — 위치 두 곳이 이미 있는 현장 둘로 · 안전판(넣기 전) 한 번 · claudeDone · 토스트 · '아직 안 넣음'에서 빠짐 (APPLY)
   ② 원본이 없는 기기(폰)·원본 열기 실패 — 넣지 않고 처리로도 안 표시 · 안전판 0 · 승인 사흘 뒤에도(사진 도구의 이틀 기다림 없음) · 원본이 생기면(PC) 넣음 (WAIT)
   ③ 애매하면 넣지 않음 — 새 현장 필요·현장 후보 여럿·이름이 많이 다름·합계 다름(경고)·합계 줄 없음·작성일보다 늦은 날짜·미래 작성일·같은 이름 파일 둘·목록에 없음·줄을 못 읽음
      — 안전판 0 · 요청함에 남음 · 미리보기에 까닭 · 같은 묶음의 좋은 요청은 들어감 (HOLD)
   ④ 금액만 바뀐 줄(다른 내역서에 같은 날짜·위치·작업명)이 있으면 넣지 않음 — 옛 줄 금액 그대로 · AI 비서 길도 막힘 (REVISE)
   ⑤ 같은 파일 요청 둘(한 묶음)은 한 번만 · 이미 넣은 내역서는 원본 없는 기기에서도 처리로만 · 같은 줄의 사본 파일도 이미 (SAME)
   ⑥ 다른 문 그대로 — 링크·붙여넣기·도장 없음·Claude·7일·카톡봇 id 아님·직원·체험 (GATE)
   ⑦ AI 비서 — 늘 확인(⚡자동이어도) · 미리보기(파일·받는 분·작성일·합계·줄·현장 · 전화번호 가림) · 애매하면 throw · 기존 견적 집계 제외 안 함 · 답 줄 (AI)
   ⑧ 요청함 ✓ — 저절로 넣지 않고 📑 확인 창을 연다(그 창의 [반영] 뒤에야 처리로) · 원본이 없으면 요청이 남음 · 이미 넣은 내역서는 처리로 (MANUAL)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(noteauto-v630.unit.js 와 같은 틀) 진짜 hjKakaoAutoTick·hjKakaoAutoApply·aiToolRun·claudeInboxView·
   hjStmtReview 를 부른다. 엑셀 라이브러리는 가짜(XLSX.read 가 JSON 격자를 돌려줌 — stmtimport-v526.e2e 와 같음), 중계는 가짜 relayCall.
   실제 고객·주소·내역서 없음 — 현장·거래처·파일 이름은 모두 가짜.
   변이(HJ_V631_MUTATION): not-auto·no-prep·min-low(문턱 0.3 이면 비슷한 이름이 후보로 더 잡혀 ①도 애매해짐) 는 ①, no-file-wait 는 ②,
   can-write-any·multi-ok·weak-ok·warn-ok·no-stated-ok·odd-ok·future-ok·dup-name-ok·new-msg·empty-same·prep-cap-small 은 ③, rev-ok·run-no-check 는 ④, no-applied-check·same-counted-new 는 ⑤,
   preview-phone·auto-confirm-off·not-write 는 ⑦, manual-direct·review-no-callback 은 ⑧ 에서 실패해야 한다.
   HJ_V631_BASELINE=<commit>(예: 8627fb8 = v630) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V631_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V631_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('stmt_apply');", ''],
  'no-prep': ['    await hjStmtApplyPrepAll(cand);', '    '],
  'no-file-wait': ["  if(q&&q.tool==='stmt_apply'){const P=__hjStmtPrepOf.get(q);return !!P&&P.st!=='wait';}", "  if(q&&q.tool==='stmt_apply'){return true;}"],
  'can-write-any': ["    if(q.tool==='stmt_apply'){const P=__hjStmtPrepOf.get(q);return !!P&&P.st!=='hold';}", "    if(q.tool==='stmt_apply'){return true;}"],
  'multi-ok': ['    else if(strong.length>1)why.push(', '    else if(false)why.push('],
  'weak-ok': ['    else if(!strong.length||strong[0].name!==g.choice||!(state.projects', '    else if(!(state.projects'],
  'min-low': ['const HJ_STMT_APPLY_MIN=0.5,', 'const HJ_STMT_APPLY_MIN=0.3,'],
  'warn-ok': ["  if((r.warn||[]).length)why.push('⚠ '+r.warn[0]);", "  if(false)why.push('⚠ '+r.warn[0]);"],
  'no-stated-ok': ['  else if(r.stated==null)why.push(', '  else if(false)why.push('],
  'odd-ok': ["  if(odd)why.push('작성일보다 늦은 작업 날짜 '", "  if(false)why.push('작성일보다 늦은 작업 날짜 '"],
  'future-ok': ["  if(String(r.date||'')>today)why.push(", '  if(false)why.push('],
  'dup-name-ok': ["  if(hit.length>1)return {miss:'같은 이름 파일이 '", "  if(false)return {miss:'같은 이름 파일이 '"],
  'new-msg': ["    else if(g.choice.indexOf('__new__:')===0)why.push(", '    else if(false)why.push('],
  'rev-ok': ["  if(cls.rev.size)why.push('금액만 바뀐 줄 '", "  if(false)why.push('금액만 바뀐 줄 '"],
  'empty-same': ['none=A.lines>0&&!A.fresh&&!A.rev;', 'none=!A.fresh&&!A.rev;'],
  'prep-cap-small': ['HJ_STMT_APPLY_PREP_MAX=50;', 'HJ_STMT_APPLY_PREP_MAX=10;'],
  'no-applied-check': ['  if(hjStmtUsedSet().has(name))return {applied:true,name};\n', ''],
  'same-counted-new': ['          if(out&&out.이미)same++;else{n++;stmtN++;', '          if(false)same++;else{n++;stmtN++;'],
  'run-no-check': ["  if(P.st!=='auto')throw new Error('내역서를 넣지 않았어요 — '", "  if(P.st==='wait')throw new Error('내역서를 넣지 않았어요 — '"],
  'preview-phone': ["function hjStmtApplyMask(s){return hjAiMaskText(String(s==null?'':s).replace(HJ_AI_PHONE_RE,m=>hjBriefMaskPhone(m)));}", "function hjStmtApplyMask(s){return String(s==null?'':s);}"],
  'auto-confirm-off': ["AI_ALWAYS_CONFIRM.add('stmt_apply');", ''],
  'not-write': ["AI_WRITE.add('stmt_apply');", ''],
  'manual-direct': ["    if(q.tool==='stmt_apply'){   // v631 내역서 반영은 📑 확인 창에서", "    if(false){   // v631 내역서 반영은 📑 확인 창에서"],
  'review-no-callback': ["      if(opts&&typeof opts.onApplied==='function'){try{opts.onApplied(res);}catch(e){}}", '']
};
if (process.env.HJ_V631_MUTATION) {
  const m = MUT[process.env.HJ_V631_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V631_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V631_MUTATION); html = html.replace(m[0], () => m[1]);
}

function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
let writes = 0;
const store = new Map();
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const noop = () => {};
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, queueMicrotask, Promise, Intl, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, performance, structuredClone,
    document: any('document'), navigator: any('navigator'), history: any('history'), indexedDB: any('indexedDB'), caches: any('caches'), visualViewport: any('vv'),
    Notification: any('Notification'), speechSynthesis: any('ss'), getSelection: () => any('sel'), getComputedStyle: () => any('cs'),
    location: { href: 'http://127.0.0.1/index.html', search: '', hash: '', pathname: '/index.html', origin: 'http://127.0.0.1', protocol: 'http:', hostname: '127.0.0.1', reload: noop, replace: noop },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    fetch: () => { writes++; return new Promise(noop); }, addEventListener: noop, removeEventListener: noop, screen: { width: 1280, height: 800 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    alert: noop, confirm: () => false, prompt: () => null, scrollTo: noop, scrollBy: noop, open: () => null, print: noop,
    Blob: globalThis.Blob || function () {}, File: globalThis.File || function () {}, Response: globalThis.Response, Headers: globalThis.Headers, Request: globalThis.Request,
    AbortController: globalThis.AbortController, atob: globalThis.atob, btoa: globalThis.btoa, Event: function () {}, CustomEvent: function () {},
    HTMLElement: function () {}, Element: function () {}, Node: function () {}
  };
  for (const k of ['BroadcastChannel', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'Image', 'Worker', 'FileReader', 'DOMParser', 'XMLSerializer', 'FormData'])
    ctx[k] = function () { return any(k); };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(code, ctx, { filename: 'index.html#app-script' }); }
  catch (e) { throw new Error('앱 스크립트를 VM 에 올리지 못함 — 새 브라우저 API 면 이 검사의 ctx 에 더하라: ' + (e && e.message)); }
  return ctx;
}
const ctx = loadApp();
const fetchAtBoot = writes;
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

// 도장 시각은 카톡봇처럼 지역 시각 'YYYY-MM-DDTHH:MM'(앱도 지역 시각으로 읽는다 — T0 기준으로 만든다)
const T0 = Date.UTC(2026, 10, 28, 3, 0, 0), TODAY = '2026-11-28';
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000, D = 24 * 60 * MIN;
const stamp = (via = 'kakao', ago = 5 * MIN) => ({ via, at: at(T0 - ago), item: 1100 });
let seq = 0;
const req = (file, extra) => Object.assign({ id: 'kb-20261128-130000-a' + (1100 + (++seq)), tool: 'stmt_apply', args: { file }, why: '카톡봇 안 넣은 내역서', approved: stamp() }, extra || {});

// 가짜 엑셀 — 파일 내용이 [{name,grid}] JSON(시트마다 격자). 작업내역서 양식(작업 날짜 | 위치 | 작업명 | 작업비용)
const SER = d => (Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000;
function sheets({ to = '가상거래', date = '2026-11-20', rows, total }) {
  const g = [['작업 내역서', '', '', ''], ['받는 분', to, '작성일', SER(date)], ['작업 날짜', '위치', '작업명', '작업비용']];
  rows.forEach(([d, loc, work, amt]) => g.push([d ? SER(d) : '', loc, work, amt]));
  if (total !== null) g.push(['합 계', '', '', total === undefined ? rows.reduce((s, r) => s + r[3], 0) : total]);
  return [{ name: '작업 내역서', grid: g }];
}
ctx.XLSX = {
  read: u8 => { const j = JSON.parse(Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('utf8')); return { SheetNames: j.map(s => s.name), Sheets: Object.fromEntries(j.map(s => [s.name, s.grid])) }; },
  utils: { sheet_to_json: ws => ws }
};
let fid = 0;
const fileRec = (name, sh, opt = {}) => Object.assign({ id: 'SF' + (++fid), name, prefix: opt.prefix || '작업내역서/', kind: 'other', ext: 'xlsx', size: 100, when: new Date('2026-11-20T01:00:00Z') },
  opt.nofile ? {} : { _file: new File([JSON.stringify(sh)], name) },
  opt.throws ? { handle: { getFile: () => Promise.reject(new Error('NotAllowedError: 권한 없음')) } } : {});

// 가짜 현장 — 사진 1장씩(자료 없는 현장 −0.2 를 피함). '한빛누리아파트'는 보관(새 현장 제안을 막아 '이름이 많이 다른 현장'이 기본 선택이 되게)
const PJS = ['가상숲마을', '가상별빛타운', '가람숲마을 1단지', '가람숲마을 3단지', '한빛누림터전마을'];
const NAME_A = '작업내역서20261120_가상거래.xlsx';
const ROWS_A = [['2026-11-14', '가상숲마을 101동 1203호', '욕실 방수', 300000], ['2026-11-14', '가상숲마을 101동 1203호', '수전 교체', 150000], ['2026-11-15', '가상별빛타운 7동 802호', '배관 교체', 300000]];
const SH_A = sheets({ rows: ROWS_A });

let relayLog = [], fileJson = { requests: [] };
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-28T03:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
let toasts = [], snaps = [], modals = [];
ctx.toast = (t) => { toasts.push(String(t)); };
ctx.openModal = (title, body, btns) => { modals.push({ title: String(title), body: String(body || ''), btns: btns || [] }); };
ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = (label) => { snaps.push({ label: String(label), quotes: vm.runInContext('(state.quotes||[]).length', ctx) }); return Promise.resolve(true); };
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
const realLocalDate = ctx.localDate;
ctx.localDate = d => (d === undefined ? TODAY : realLocalDate(d));
const realReview = ctx.hjStmtReview;
function reset(stmtFiles, extra) {
  relayLog = []; toasts = []; snaps = []; modals = []; store.clear(); ctx.__T__ = T0;
  ctx.__seedFiles = PJS.map((p, i) => ({ id: 'PH' + i, name: 'ph' + i + '.jpg', ext: 'jpg', kind: 'photo', project: p, when: new Date('2026-11-14T01:00:00Z') })).concat(stmtFiles || []);
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;if(typeof __hjStmtApplyMemo!=="undefined")__hjStmtApplyMemo.clear();__tabStale=false;state._demo=false;state.claudeDone=[];
    state.projects=${JSON.stringify(PJS.map(name => ({ name, stage: 1, received: 0, phases: [] })).concat([{ name: '한빛누리아파트', stage: 3, received: 0, phases: [], archived: true }]))};
    state.files=__seedFiles;state.quotes=[];state.payLog=[];state.schedule=[];state.notes=[];state.expenses=[];state.goals={};
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
  if (extra) extra();
}
const quotes = () => run('return (state.quotes||[]).filter(q=>q&&q.stmt).map(q=>({project:q.project,src:q.stmt.src,to:q.stmt.to,date:q.stmt.date,total:quoteCalc(q).total,lines:q.stmt.lines.map(l=>[l.d,l.work,l.amt])})).sort((a,b)=>a.project.localeCompare(b.project));');
const done = () => run('return state.claudeDone.slice();');
const pending = () => run('return hjClaudeInboxNoticeData().n;');
const notApplied = () => run('return hjStmtFiles().filter(x=>!x.applied).map(x=>x.f.name);');
const tick = () => runA('return await hjKakaoAutoTick();');
const apply = (reqs, via = 'drive') => runA(`return await hjKakaoAutoApply({ok:true,via:${JSON.stringify(via)},requests:${JSON.stringify(reqs)}});`);
const prep = (file) => runA(`const P=await hjStmtApplyPrep({file:${JSON.stringify(file)}});return {st:P.st,why:P.why};`);
const preview = (file) => run(`return aiActionWarnings('stmt_apply',{file:${JSON.stringify(file)}});`);
const putToasts = () => toasts.filter(t => /카톡에서 승인한/.test(t));

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS stmtapply-v631 ' + name); }

(async () => {
  await test('① 카톡 승인 · 원본이 있는 기기 — 위치 두 곳 → 이미 있는 현장 둘 · 안전판 한 번 · claudeDone · 토스트 · 아직 안 넣음에서 빠짐 (APPLY)', async () => {
    reset([fileRec(NAME_A, SH_A)]);
    // 합성 자료가 확인 창 기본값으로 이미 있는 현장 둘을 고르는지(검사 전제)
    assert.deepEqual(run(`const r=hjStmtParse(${JSON.stringify(SH_A)},${JSON.stringify(NAME_A)});return hjStmtGroups(r).map(g=>[g.choice,g.cands.filter(c=>c.score>=0.5).length]);`),
      [['가상숲마을', 1], ['가상별빛타운', 1]], '전제: 위치마다 0.5 이상 후보가 하나');
    assert.deepEqual(notApplied(), [NAME_A]);
    const R = req(NAME_A);
    fileJson = { requests: [R] };
    assert.equal(await tick(), true);
    assert.deepEqual(relayLog, ['listFiles', 'download'], '요청 파일만 읽음');
    assert.deepEqual(quotes(), [
      { project: '가상별빛타운', src: NAME_A, to: '가상거래', date: '2026-11-20', total: 300000, lines: [['2026-11-15', '배관 교체', 300000]] },
      { project: '가상숲마을', src: NAME_A, to: '가상거래', date: '2026-11-20', total: 450000, lines: [['2026-11-14', '욕실 방수', 300000], ['2026-11-14', '수전 교체', 150000]] }
    ], '확인 창 기본값 그대로 — 현장마다 견적 1건(받는 분·작성일은 파일에서)');
    assert.deepEqual(done(), [R.id], '처리한 id');
    assert.deepEqual(snaps.map(s => [s.label, s.quotes]), [['📲 카톡 승인 요청 반영 전 — 1건', 0]], '안전판은 넣기 전에 한 번');
    assert.deepEqual(putToasts(), ['📲 카톡에서 승인한 요청 1건을 현장웹에 넣었어요 · 📑 내역서 1장 750,000원'], JSON.stringify(toasts));
    assert.deepEqual(notApplied(), [], "'아직 안 넣음'에서 빠짐");
    assert.equal(pending(), 0);
    assert.equal(run('return state.projects.length;'), PJS.length + 1, '새 현장 없음');
    assert.equal(await apply(fileJson.requests), 0, '처리한 id 는 다시 안 넣음');
    assert.equal(quotes().length, 2);
  });

  await test('② 원본이 없는 기기·원본 열기 실패 — 넣지 않고 처리로도 안 표시 · 사흘 뒤에도 · 원본이 생기면 넣음 (WAIT)', async () => {
    const R = req(NAME_A, { approved: stamp('kakao', 3 * D) });   // 사진 도구는 이틀 뒤 있는 것만 넣지만 내역서는 원본 없이 안 넣는다
    fileJson = { requests: [R] };
    reset([fileRec(NAME_A, SH_A, { nofile: true })]);
    assert.equal(await tick(), true);
    assert.deepEqual([quotes(), done(), snaps.length], [[], [], 0], '안 넣음 · 처리로 안 표시 · 안전판 0');
    assert.equal(pending(), 1, '요청함에 남음');
    assert.deepEqual(preview(NAME_A).slice(-1), ['이 기기에서 원본을 열 수 없어요 — 만물 폴더를 연 PC에서 넣어요 — 요청은 남겨 둬요']);
    await assert.rejects(runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NAME_A)}});`), /내역서를 넣지 않았어요 — 이 기기에서 원본을 열 수 없어요/);
    assert.deepEqual(quotes(), []);
    // 원본 열기가 실패하는 기기(폴더 권한이 풀림)
    reset([fileRec(NAME_A, SH_A, { nofile: true, throws: true })]);
    assert.equal(await apply([R]), 0);
    assert.deepEqual([quotes(), done(), snaps.length], [[], [], 0]);
    assert.equal((await prep(NAME_A)).st, 'wait');
    // 같은 요청을 원본이 있는 기기(PC)가 읽으면 넣는다
    reset([fileRec(NAME_A, SH_A)]);
    assert.equal(await apply([R]), 1);
    assert.equal(quotes().length, 2);
    assert.deepEqual(done(), [R.id]);
  });

  await test('③ 애매하면 넣지 않음 — 안전판 0 · 요청함에 남음 · 미리보기에 까닭 · 좋은 요청은 들어감 (HOLD)', async () => {
    const L = (loc, work = '누수 보수', amt = 200000, d = '2026-11-14') => [d, loc, work, amt];
    const C = {
      newp: ['작업내역서20261121_가상새벌.xlsx', sheets({ rows: [L('가상새벌마을 3동 101호')] }), "저절로 넣지 않아요 — ‘가상새벌마을 3동 101호’ 는 새 현장(가상새벌마을)이 필요해요 — 새 현장은 대표가 골라요"],
      multi: ['작업내역서20261122_가상가람.xlsx', sheets({ rows: [L('가람숲마을 3단지 301동 1203호')] }), '저절로 넣지 않아요 — ‘가람숲마을 3단지 301동 1203호’ 현장 후보가 여럿(가람숲마을 3단지·가람숲마을 1단지)'],
      weak: ['작업내역서20261123_가상한빛.xlsx', sheets({ rows: [L('한빛누리아파트 101동 1203호')] }), '저절로 넣지 않아요 — ‘한빛누리아파트 101동 1203호’ 와 이름이 많이 다른 현장(한빛누림터전마을)'],
      warn: ['작업내역서20261124_가상합계.xlsx', sheets({ rows: [L('가상숲마을 102동 101호')], total: 999999 }), '저절로 넣지 않아요 — ⚠ 내역서 합계 999,999원과 줄 금액 합 200,000원이 다릅니다 — 원본을 확인하세요.'],
      nosum: ['작업내역서20261125_가상합계없음.xlsx', sheets({ rows: [L('가상숲마을 102동 102호')], total: null }), '저절로 넣지 않아요 — 내역서에 합계 줄이 없어요 — 줄을 다 읽었는지 대표가 확인해요'],
      odd: ['작업내역서20261126_가상날짜.xlsx', sheets({ rows: [L('가상숲마을 102동 103호', '누수 보수', 200000, '2026-11-25')] }), '저절로 넣지 않아요 — 작성일보다 늦은 작업 날짜 1줄'],
      future: ['작업내역서20261205_가상미래.xlsx', sheets({ date: '2026-12-05', rows: [L('가상숲마을 102동 104호')] }), '저절로 넣지 않아요 — 작성일(2026-12-05)이 미래예요'],
      twin: ['작업내역서20261127_가상쌍둥이.xlsx', sheets({ rows: [L('가상숲마을 102동 105호')] }), '저절로 넣지 않아요 — 같은 이름 파일이 2개라 어느 것인지 몰라요'],
      none: ['작업내역서20261128_가상없음.xlsx', null, '저절로 넣지 않아요 — 📑 아직 안 넣음 목록에 없는 파일이에요(이름 확인 · 이 기기 파일 목록에 아직 없을 수도)'],
      empty: ['작업내역서20261119_가상빈표.xlsx', [{ name: 'S', grid: [['아무 표'], ['이름', '값'], ['a', 1]] }], '저절로 넣지 않아요 — 작업 줄을 찾지 못했어요 · 내역서에 합계 줄이 없어요 — 줄을 다 읽었는지 대표가 확인해요']   // 줄 0 은 '이미'가 아님
    };
    const recs = [];
    Object.entries(C).forEach(([k, [name, sh]]) => { if (sh) recs.push(fileRec(name, sh)); if (k === 'twin') recs.push(fileRec(name, sh, { prefix: '견적서/' })); });
    reset(recs);
    // 전제: 이름이 많이 다른 현장은 확인 창 기본 선택이 그 현장(0.5 미만) · 새 현장 제안 · 후보 둘
    assert.deepEqual(run(`return [${['newp', 'multi', 'weak'].map(k => `hjStmtGroups(hjStmtParse(${JSON.stringify(C[k][1])},'x.xlsx')).map(g=>[g.choice,g.cands.filter(c=>c.score>=0.5).length,g.cands.length?Math.round(g.cands[0].score*100):0])[0]`).join(',')}];`),
      [['__new__:가상새벌마을', 0, 44], ['가람숲마을 3단지', 2, 100], ['한빛누림터전마을', 0, 40]]);
    const reqs = Object.values(C).map(([name]) => req(name));
    fileJson = { requests: reqs };
    assert.equal(await tick(), true);
    assert.deepEqual([quotes(), done(), snaps.length], [[], [], 0], '하나도 안 넣음 · 처리로 안 표시 · 안전판 0 ' + JSON.stringify(quotes()).slice(0, 300));
    assert.equal(pending(), reqs.length, '모두 요청함에 남아 대표가 📑 반영에서');
    for (const [k, [name, , why]] of Object.entries(C)) assert.deepEqual(preview(name).slice(-1), [why], k);
    // 같은 묶음에 좋은 요청이 있으면 그것만 넣는다 — 애매한 요청 10건 뒤의 11번째여도(미리 셈·고르기 자리를 애매한 요청이 차지하지 않음)
    reset(recs.concat([fileRec(NAME_A, SH_A)]));
    const good = req(NAME_A);
    assert.equal(await apply(reqs.concat([good])), 1);
    assert.deepEqual(done(), [good.id]);
    assert.deepEqual(snaps.map(s => s.label), ['📲 카톡 승인 요청 반영 전 — 1건'], '고른 것은 좋은 요청 하나');
    assert.deepEqual(quotes().map(q => q.src), [NAME_A, NAME_A]);
  });

  await test('④ 금액만 바뀐 줄이 있으면 넣지 않음 — 옛 줄 금액 그대로 · AI 비서 길도 막힘 (REVISE)', async () => {
    const NAME_B = '작업내역서20261101_가상거래.xlsx';
    reset([fileRec(NAME_A, SH_A)], () => vm.runInContext(`const q=hjStmtBuildQuote({src:${JSON.stringify(NAME_B)},file:${JSON.stringify(NAME_B)},doc:'작업내역서',to:'가상거래',date:'2026-11-01',vat:'included',project:'가상숲마을',
      lines:[{d:'2026-11-14',loc:'가상숲마을 101동 1203호',work:'욕실 방수',amt:280000}]});state.quotes.push(q);syncQuoteToProject(q);`, ctx));
    assert.equal(run(`const r=hjStmtParse(${JSON.stringify(SH_A)},${JSON.stringify(NAME_A)});return hjStmtClassify(r.lines).rev.size;`), 1, '전제: 금액만 바뀐 줄 1');
    const before = quotes();
    const R = req(NAME_A);
    assert.equal(await apply([R]), 0);
    assert.deepEqual([quotes(), done(), snaps.length], [before, [], 0], '옛 줄 280,000 그대로 · 새 견적 없음 · 안전판 0');
    assert.deepEqual(preview(NAME_A).slice(-1), ['저절로 넣지 않아요 — 금액만 바뀐 줄 1개 — 바꿀지 대표가 골라요']);
    await assert.rejects(runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NAME_A)}});`), /금액만 바뀐 줄 1개 — 바꿀지 대표가 골라요 · 📑 반영에서 확인해 주세요/);
    assert.deepEqual(quotes(), before);
  });

  await test('⑤ 같은 파일 요청 둘은 한 번만 · 이미 넣은 내역서는 원본 없는 기기에서도 처리로만 · 사본 파일도 이미 (SAME)', async () => {
    reset([fileRec(NAME_A, SH_A)]);
    const R1 = req(NAME_A), R2 = req(NAME_A);
    assert.equal(await apply([R1, R2]), 1);
    assert.equal(quotes().length, 2, '두 번 안 넣음');
    assert.deepEqual(done(), [R1.id, R2.id], '둘 다 처리로');
    assert.deepEqual(putToasts(), ['📲 카톡에서 승인한 요청 1건을 현장웹에 넣었어요 · 이미 있던 1건은 건너뜀 · 📑 내역서 1장 750,000원']);
    // 원본이 없는 기기(폰)에서도 이미 넣은 내역서인 줄은 안다 — 처리로만(원본을 읽지 않음)
    const snapQuotes = JSON.stringify(quotes());
    run(`state.files.filter(f=>f.name===${JSON.stringify(NAME_A)}).forEach(f=>{delete f._file;});`);
    toasts = []; snaps = [];
    const R3 = req(NAME_A);
    assert.equal(await apply([R3]), 0);
    assert.deepEqual(done(), [R1.id, R2.id, R3.id], '처리로 표시');
    assert.equal(JSON.stringify(quotes()), snapQuotes);
    assert.deepEqual(putToasts(), [], "'넣었어요' 토스트 없음");
    assert.deepEqual(preview(NAME_A).slice(-1), ['이미 넣은 내역서예요 — 다시 넣지 않고 처리로만 표시해요']);
    // 이름만 바꾼 사본(같은 줄) — 줄이 모두 이미 들어가 있어 처리로만
    const COPY = '작업내역서20261120_가상거래 (1).xlsx';
    run('state.claudeDone=[];');
    ctx.__copy = fileRec(COPY, SH_A); run('state.files.push(__copy);');
    const R4 = req(COPY);
    assert.equal(await apply([R4]), 0);
    assert.deepEqual(done(), [R4.id]);
    assert.equal(JSON.stringify(quotes()), snapQuotes, '사본으로 두 번 안 잡힘');
    assert.deepEqual(preview(COPY).slice(-1), ['줄이 모두 이미 들어가 있어요 — 다시 넣지 않고 처리로만 표시해요']);
  });

  await test('⑥ 다른 문 그대로 — 링크·붙여넣기·도장 없음·Claude·7일·카톡봇 id 아님·직원·체험 (GATE)', async () => {
    reset([fileRec(NAME_A, SH_A)]);
    const good = req(NAME_A);
    const viaLink = await runA(`const d=claudeReqDecode(${JSON.stringify(JSON.stringify({ requests: [good] }))});return {via:d.via,n:d.requests.length,applied:await hjKakaoAutoApply(d)};`);
    assert.deepEqual(viaLink, { via: 'link', n: 1, applied: 0 }, '링크로 받은 요청');
    assert.equal(await apply([good], 'link'), 0);
    const gated = [req(NAME_A, { approved: undefined }), req(NAME_A, { approved: stamp('claude') }), req(NAME_A, { approved: stamp('kakao', 8 * D) }),
      Object.assign(req(NAME_A), { id: 'cl-20261128-130000-a1199' })];
    assert.equal(await apply(gated), 0);
    store.set('hj_role', 'staff');
    assert.equal(await apply([good]), 0, '직원 모드');
    store.delete('hj_role'); run('state._demo=true;');
    assert.equal(await apply([good]), 0, '체험 모드');
    run('state._demo=false;');
    assert.deepEqual([quotes(), done(), snaps.length], [[], [], 0], '안 넣고 처리로도 안 표시 · 안전판 0');
    assert.deepEqual(run("return [HJ_KAKAO_AUTO_TOOLS.has('stmt_apply'),CLAUDE_REQ_DENY.has('stmt_apply'),claudeReqBad({id:'kb-1',tool:'stmt_apply',args:{file:'a.xlsx'}})];"), [true, false, '']);
  });

  await test('⑦ AI 비서 — 늘 확인 · 미리보기(전화번호 가림) · 애매하면 throw · 기존 견적 집계 제외 안 함 · 답 줄 (AI)', async () => {
    assert.deepEqual(run("window.__aiAuto=true;const r=[aiWriteNeedsConfirm('stmt_apply'),AI_ALWAYS_CONFIRM.has('stmt_apply'),AI_WRITE.has('stmt_apply'),SAFE_AUTO.has('stmt_apply'),AI_TOOLS.some(t=>t.name==='stmt_apply')];window.__aiAuto=false;return r;"),
      [true, true, true, false, true], '⚡자동 실행이어도 확인');
    const SH_P = sheets({ to: '가상거래 010-1234-5678', rows: ROWS_A });
    reset([fileRec(NAME_A, SH_P), { id: 'E1', name: '20261101 가상숲마을 견적 500,000.xlsx', ext: 'xlsx', kind: 'estimate', project: '가상숲마을', est: { amount: 500000 }, when: new Date('2026-11-01T01:00:00Z') }]);
    assert.equal(run(`return aiActionLabel('stmt_apply',{file:${JSON.stringify(NAME_A)}});`), '내역서 반영 → "' + NAME_A + '"');
    assert.deepEqual(preview(NAME_A), ['원본을 아직 읽지 않았어요 — 만물 폴더를 연 PC에서 읽어 확인한 뒤 넣어요'], '읽기 전');
    assert.deepEqual(await prep(NAME_A), { st: 'auto', why: '' });
    const pv = preview(NAME_A);
    assert.deepEqual(pv, ['📄 ' + NAME_A + ' · 받는 분 가상거래 ···5678 · 작성일 2026-11-20 · 합계 750,000원', '줄 3개 → 가상숲마을 2줄 · 가상별빛타운 1줄',
      '견적이 따로 있는 현장 1곳 — 그 견적은 그대로 둬요(내역서로 대신하면 📑 반영에서 집계 제외)', '애매한 것이 없어 카톡 승인이면 저절로 넣어요(확인 창 기본값 그대로 · 새 현장·금액 바꾸기 없음)']);
    assert.ok(!/1234/.test(JSON.stringify(pv)), '전화번호 안 보임');
    const out = await runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NAME_A)}});`);
    assert.deepEqual(out, { 결과: '내역서 반영', 파일: NAME_A, 이미: 0, 새견적: 2, 줄추가: 0, 현장: ['가상숲마을', '가상별빛타운'], 이미든줄: 0, 금액: 750000, 견적따로: 1 });
    assert.equal(run("return aiResultBrief('stmt_apply',"+JSON.stringify(out)+");"), ' — 새 견적 2건 · 750,000원');
    assert.equal(run("return !!state.files.find(f=>f.id==='E1').exSum;"), false, '기존 견적은 집계 제외하지 않음(exclude [])');
    const again = await runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NAME_A)}});`);
    assert.equal(again.이미, 1);
    assert.equal(run("return aiResultBrief('stmt_apply',{이미:1});"), ' — 이미 넣은 내역서');
    assert.equal(quotes().length, 2);
    // 애매하면(새 현장) AI 비서도 넣지 않는다 — 현장을 만들지 않음
    const NEWP = '작업내역서20261121_가상새벌.xlsx';
    ctx.__np = fileRec(NEWP, sheets({ rows: [['2026-11-14', '가상새벌마을 3동 101호', '누수 보수', 200000]] })); run('state.files.push(__np);');
    await assert.rejects(runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NEWP)}});`), /내역서를 넣지 않았어요 — ‘가상새벌마을 3동 101호’ 는 새 현장\(가상새벌마을\)이 필요해요 — 새 현장은 대표가 골라요 · 📑 반영에서 확인해 주세요/);
    assert.equal(run("return state.projects.some(p=>p.name==='가상새벌마을');"), false);
    assert.equal(quotes().length, 2);
  });

  await test('⑧ 요청함 ✓ — 📑 확인 창을 연다([반영] 뒤에야 처리로) · 원본이 없으면 남음 · 이미 넣은 내역서는 처리로 (MANUAL)', async () => {
    // 요청함 화면의 단추를 가짜 뿌리로 잡는다(나머지 DOM 은 빈 대역)
    const anyDoc = ctx.document;
    let claiBtns = [];
    const fakeRoot = { querySelectorAll: sel => (sel === '.clai' ? claiBtns : []), querySelector: () => null };
    ctx.document = new Proxy({}, { get: (t, k) => (k === 'getElementById' ? (id => (id === 'modalRoot' ? fakeRoot : anyDoc.getElementById(id))) : anyDoc[k]) });
    const openInbox = async (reqs) => {
      claiBtns = reqs.map((q, i) => ({ dataset: { i: String(i) }, disabled: false, textContent: '✓ 승인·적용' }));
      ctx.__preset = { ok: true, via: 'drive', requests: reqs, bad: [], total: reqs.length };
      assert.deepEqual(await runA('return await claudeInboxView(__preset);'), { 요청: reqs.length });
      return modals[modals.length - 1];
    };
    try {
      reset([fileRec(NAME_A, SH_A)]);
      const R = req(NAME_A);
      const inbox = await openInbox([R]);
      assert.match(inbox.body, /내역서 반영 → &quot;작업내역서20261120_가상거래\.xlsx&quot;|내역서 반영 → "작업내역서20261120_가상거래\.xlsx"/);
      assert.match(inbox.body, /📄 작업내역서20261120_가상거래\.xlsx · 받는 분 가상거래 · 작성일 2026-11-20 · 합계 750,000원/, '미리보기(원본을 읽어 채움)');
      assert.match(inbox.body, /data-stmt-apply-hint/); assert.match(inbox.body, /장부를 바꾸는 작업입니다/);
      await claiBtns[0].onclick();
      const review = modals[modals.length - 1];
      assert.equal(review.title, '📑 작업내역서 반영', '✓ 는 확인 창을 연다');
      assert.deepEqual([quotes(), done(), snaps.length], [[], [], 0], '✓ 만으로는 안 넣음 · 처리로 안 표시');
      const btn = review.btns.find(b => b.label === '반영');
      assert.ok(btn, '[반영] 단추');
      await btn.fn();
      assert.equal(quotes().length, 2, '[반영] 뒤에 들어감');
      assert.deepEqual(done(), [R.id], '그 요청을 처리로');
      assert.deepEqual(snaps.map(s => [s.label, s.quotes]), [['🔗 요청 적용 전 — 내역서 반영 → "' + NAME_A + '"', 0]], '[반영] 직전 안전판');
      // 원본이 없는 기기 — 확인 창을 못 열고 요청이 남는다(단추 되살림)
      reset([fileRec(NAME_A, SH_A, { nofile: true })]);
      const R2 = req(NAME_A);
      await openInbox([R2]);
      const nModal = modals.length;
      await claiBtns[0].onclick();
      assert.equal(modals.length, nModal, '확인 창 안 열림');
      assert.deepEqual([claiBtns[0].disabled, claiBtns[0].textContent], [false, '✓ 승인·적용']);
      assert.deepEqual(toasts.slice(-1), ['📑 이 기기에서 원본을 열 수 없어요 — 만물 폴더를 연 PC에서 넣어요 — 요청은 남겨 둬요']);
      assert.deepEqual([quotes(), done()], [[], []]);
      // 애매한 내역서(새 현장)도 ✓ 는 확인 창을 연다 — 대표가 거기서 고른다
      const NEWP = '작업내역서20261121_가상새벌.xlsx';
      reset([fileRec(NEWP, sheets({ rows: [['2026-11-14', '가상새벌마을 3동 101호', '누수 보수', 200000]] }))]);
      await openInbox([req(NEWP)]);
      await claiBtns[0].onclick();
      assert.equal(modals[modals.length - 1].title, '📑 작업내역서 반영');
      // 이미 넣은 내역서 — 확인 창 없이 처리로
      reset([fileRec(NAME_A, SH_A)]);
      await runA(`return await aiToolRun('stmt_apply',{file:${JSON.stringify(NAME_A)}});`);
      const R3 = req(NAME_A);
      await openInbox([R3]);
      const nModal2 = modals.length;
      await claiBtns[0].onclick();
      assert.equal(modals.length, nModal2, '확인 창 없음');
      assert.deepEqual(done(), [R3.id]);
      assert.ok(toasts.includes('📑 이미 넣은 내역서예요 — 요청을 처리로 표시해요'));
      // hjStmtReview 는 opts 없이 부르면 예전 그대로(📑 반영 단추)
      assert.equal(realReview.length, 2);
    } finally { ctx.document = anyDoc; }
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('stmtapply-v631: ' + passed + '/8');
  if (passed !== 8) process.exit(1);
})().catch(e => { console.error('FAIL stmtapply-v631', e && e.stack || e); process.exit(1); });

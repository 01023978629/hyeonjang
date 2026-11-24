/* v620 🖼 사진 넣기 · 일정 ↔ 현장 · 열면 바로 (단위 검사)
   대표 결정(11/24) '위 개발 내용 진행'(1단계):
   ① assign_photo_files — 카톡봇이 현장사진\<현장> 으로 옮긴 사진을 파일 이름으로 그 현장에. 현장이 없는 사진만(그 현장은 그대로 · 다른 현장 · 같은 이름 여럿은 건드리지 않음) (PUT)
   ② 카톡·관리 프로그램 승인이면 저절로 — 사진이 이 기기에 다 있을 때만(v619 세대 연결과 같은 문) (AUTO)
   ③ 일정 ↔ 현장 — add_schedule 에 현장이 없으면 제목으로(하나일 때만 · 'A'=아파트 · 긴 이름 먼저 · 보관 현장은 나중) · 일정 탭 '현장 잇기'(체크한 것만 · 그새 생긴 현장은 그대로) (SCH)
   ④ 열면 바로 — 부팅·다시 보기 때 카톡 승인 요청을 바로 읽음(1분에 한 번 · 같은 문) (OPEN)
   브라우저 없이 돈다: index.html 앱 스크립트를 통째로 VM 에 올려(kakaotick-v619.unit.js 와 같은 틀) 진짜 aiToolRun·hjKakaoAutoApply·hjKakaoOpenCheck 를 부른다.
   중계는 가짜 relayCall(합성 요청 파일). 실제 중계·드라이브·고객 없음.
   변이(HJ_V620_MUTATION): put-other-site·put-dups 는 ①, not-auto·no-photo-wait 는 ②, no-guess·guess-short-wins·guess-no-a·guess-first·link-overwrites 는 ③,
   no-open-boot·open-no-gap·open-ignores-staff 는 ④ 에서 실패해야 한다. HJ_V620_BASELINE=<commit>(예: e530ff3) 은 ①에서. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V620_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V620_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'put-other-site': ["        const free=fs.filter(f=>!f.project);\n", "        const free=fs;\n"],
  'put-dups': ["        if(free.length!==1){skipped++;continue;}                          // 같은 이름이 여럿 — 어느 사진인지 모른다\n        free[0].project=pj;put++;",
    "        free.forEach(f=>{f.project=pj;});put++;"],
  'not-auto': ["HJ_KAKAO_AUTO_TOOLS.add('assign_photo_files');", ''],
  'no-photo-wait': ["const HJ_KAKAO_PHOTO_TOOLS=new Set(['apt_unit_link','assign_photo_files']);", "const HJ_KAKAO_PHOTO_TOOLS=new Set(['apt_unit_link']);"],
  'no-guess': ["project:String(a.project||'')||hjSchGuessProject(t),", "project:String(a.project||''),"],
  'guess-short-wins': ['    const top=hit.filter(h=>!hit.some(o=>o!==h&&nameKey(o).length>nameKey(h).length&&nameKey(o).includes(nameKey(h))));\n', '    const top=hit;\n'],
  'guess-no-a': ["  const tA=t.replace(/([가-힣])a(?=[0-9]|$|[^a-z0-9])/g,'$1아파트');\n", '  const tA=t;\n'],
  'guess-first': ["    return top.length===1?top[0].name:(top.length>1?null:'');\n", "    return top.length?top[0].name:'';\n"],
  'link-overwrites': ['    if(s&&!s.project&&(state.projects||[]).some(p=>p&&p.name===r.name)){s.project=r.name;n++;}});', '    if(s){s.project=r.name;n++;}});'],
  'no-open-boot': ['setTimeout(()=>{hjKakaoOpenCheck();},6000);', ''],
  'open-no-gap': ['    if(now-Math.max(last,hjClaudeInboxCheckedAt())<HJ_KAKAO_OPEN_GAP_MS)return false;\n', '\n'],
  'open-ignores-staff': ["    if(state._demo||typeof relayReady!=='function'||!relayReady()||!__hjCinboxArmed||(typeof hjStaffOn==='function'&&hjStaffOn()))return false;\n    try{if(navigator.onLine===false)return false;}catch(e){}\n    const now=Date.now();\n    let last=0;try{last=Number(localStorage.getItem(HJ_KAKAO_TICK_AT_KEY))||0;}catch(e){}\n    if(now-Math.max(last,hjClaudeInboxCheckedAt())<HJ_KAKAO_OPEN_GAP_MS)",
    "    if(state._demo||typeof relayReady!=='function'||!relayReady()||!__hjCinboxArmed)return false;\n    try{if(navigator.onLine===false)return false;}catch(e){}\n    const now=Date.now();\n    let last=0;try{last=Number(localStorage.getItem(HJ_KAKAO_TICK_AT_KEY))||0;}catch(e){}\n    if(now-Math.max(last,hjClaudeInboxCheckedAt())<HJ_KAKAO_OPEN_GAP_MS)"]
};
if (process.env.HJ_V620_MUTATION) {
  const m = MUT[process.env.HJ_V620_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V620_MUTATION);
  assert.equal(html.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V620_MUTATION); html = html.replace(m[0], () => m[1]);
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
let appCode = '';
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  appCode = code;
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
const realNavigator = ctx.navigator;
const run = (src) => JSON.parse(JSON.stringify(vm.runInContext('(()=>{' + src + '})()', ctx)) ?? null);
const runA = async (src) => { const v = await vm.runInContext('(async()=>{' + src + '})()', ctx); return v === undefined ? null : JSON.parse(JSON.stringify(v)); };

const T0 = Date.UTC(2026, 10, 24, 1, 0, 0);
const p2 = n => String(n).padStart(2, '0');
const at = ms => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
const SITE = '가상동 257-10', OTHER = '다른 현장';
const N = i => `KakaoTalk_20261123_162901${p2(i)}0.jpg`;
const photo = (name, project = null, id) => ({ id: id || 'f-' + name + '-' + (project || ''), kind: 'photo', name, project, prefix: '현장사진/' + (project || SITE) + '/' });
const PROJECTS = [{ name: SITE, stage: 0, received: 0, phases: [] }, { name: OTHER, stage: 0, received: 0, phases: [] }];
const req = (id, files, extra) => Object.assign({ id, tool: 'assign_photo_files', args: { project: SITE, files }, why: '카톡봇 사진 정리', approved: { via: 'kakao', at: at(T0 - 5 * MIN), item: 1012 } }, extra || {});
let relayLog = [], fileJson = { requests: [] };
ctx.relayCall = (action) => {
  relayLog.push(action);
  if (action === 'listFiles') return Promise.resolve({ ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', modifiedAt: '2026-11-24T01:00:00Z' }] });
  if (action === 'download') return Promise.resolve({ ok: true, dataB64: Buffer.from(JSON.stringify(fileJson), 'utf8').toString('base64') });
  return Promise.resolve({ ok: false, message: 'unexpected ' + action });
};
ctx.toast = () => {}; ctx.openModal = () => {}; ctx.closeModal = () => {}; ctx.render = () => {}; ctx.markDirty = () => {};
ctx.hjSnapshot = () => Promise.resolve(true);
ctx.__hjRelayBootDone = Promise.resolve();
ctx.__T__ = T0;
vm.runInContext('Date.now=()=>globalThis.__T__;', ctx);
function reset(opts = {}) {
  relayLog = []; store.clear(); ctx.__T__ = T0; ctx.navigator = realNavigator;
  vm.runInContext(`__hjCinbox={at:0,result:null,items:null,dismissed:null};__hjCinboxArmed=true;state._demo=false;state.claudeDone=[];
    state.projects=${JSON.stringify(opts.projects || PROJECTS)};
    state.files=${JSON.stringify(opts.files || [])};
    state.schedule=${JSON.stringify(opts.schedule || [])};
    __relay.url='https://script.google.com/macros/s/AKfyTEST/exec';__relay.token='TEST-RELAY-TOKEN';`, ctx);
}
const done = () => run('return state.claudeDone.slice();');
const projOf = () => run('return state.files.map(f=>f.name+"="+(f.project||""));');

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS photoassign-v620 ' + name); }

(async () => {
  await test('① 사진 넣기 — 현장이 없는 사진만 · 그 현장은 그대로 · 다른 현장·같은 이름 여럿은 그대로 (PUT)', async () => {
    reset({ files: [photo(N(1)), photo(N(2).toUpperCase()), photo(N(3), OTHER), photo(N(4), null, 'a'), photo(N(4), null, 'b'), photo(N(5), SITE)] });
    const out = await runA(`return await aiToolRun('assign_photo_files',{project:${JSON.stringify(SITE)},files:${JSON.stringify([N(1), N(2), N(3), N(4), N(5), N(9), N(1)])}});`);
    assert.deepEqual([out.넣음, out.이미, out.건너뜀, out.못찾음], [2, 1, 2, 1], JSON.stringify(out));
    assert.deepEqual(projOf(), [N(1) + '=' + SITE, N(2).toUpperCase() + '=' + SITE, N(3) + '=' + OTHER, N(4) + '=', N(4) + '=', N(5) + '=' + SITE],
      '다른 현장 사진·같은 이름이 여럿인 사진은 그대로');
    await assert.rejects(runA(`return await aiToolRun('assign_photo_files',{project:'없는 현장',files:['a.jpg']});`), /없거나/);
    await assert.rejects(runA(`return await aiToolRun('assign_photo_files',{project:${JSON.stringify(SITE)},files:[]});`), /이름이 없/);
    assert.equal(run("return claudeReqBad({id:'kb-20261124-100000-a1012',tool:'assign_photo_files',args:{}});"), '', '요청함이 아는 도구');
    assert.equal(run("return AI_WRITE.has('assign_photo_files');"), true, '장부를 바꾸는 작업으로 표시(요청함 경고·안전판)');
    assert.equal(run("return aiActionLabel('assign_photo_files',{project:'x',files:['a','b']});"), '사진 넣기 → "x" · 2장', '요청함·확인 창에 보이는 이름');
  });

  await test('② 승인이면 저절로 — 사진이 이 기기에 다 있을 때만 · 이틀 지나면 있는 것만 (AUTO)', async () => {
    assert.equal(run("return HJ_KAKAO_AUTO_TOOLS.has('assign_photo_files');"), true);
    fileJson = { requests: [req('kb-20261124-100000-a1012', [N(1), N(2)])] };
    reset({ files: [photo(N(1))] });                                   // 한 장만 이 기기에
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(done(), [], '사진이 덜 왔으면 넣지 않고 요청함에 남김');
    assert.deepEqual(projOf(), [N(1) + '=']);
    run(`state.files.push(${JSON.stringify(photo(N(2)))});`);
    ctx.__T__ = T0 + 5 * MIN + 1;
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(done(), ['kb-20261124-100000-a1012']);
    assert.deepEqual(projOf(), [N(1) + '=' + SITE, N(2) + '=' + SITE], '다 오면 넣음');
    // 이틀 지나도 덜 오면 있는 것만
    fileJson = { requests: [req('kb-20261121-100000-a1013', [N(1), N(2)], { approved: { via: 'manager', at: at(T0 - 2 * D - H), item: 1013 } })] };
    reset({ files: [photo(N(1))] });
    assert.equal(await runA('return await hjKakaoAutoTick();'), true);
    assert.deepEqual(projOf(), [N(1) + '=' + SITE]);
    // 링크·붙여넣기(via link)로 받은 것은 저절로 넣지 않는다(v617 문 그대로)
    reset({ files: [photo(N(1)), photo(N(2))] });
    assert.equal(await runA(`return await hjKakaoAutoApply({ok:true,via:'link',requests:${JSON.stringify([req('kb-20261124-100000-a1014', [N(1)])])}});`), 0);
    assert.deepEqual(projOf(), [N(1) + '=', N(2) + '=']);
  });

  await test('③ 일정 ↔ 현장 — 제목에 하나일 때만 · A=아파트 · 긴 이름 먼저 · 보관은 나중 · 잇기는 고른 것만 (SCH)', async () => {
    const P = [{ name: '가상여울아파트' }, { name: '가상성아파트' }, { name: '가상성아파트 1동101호' }, { name: '가상캡 (가상시)' }, { name: '가상열매마을' },
      { name: '가상메이드' }, { name: '가상평화아파트', archived: true }, { name: 'K2' }];
    reset({ projects: P });
    const g = t => run(`return hjSchGuessProject(${JSON.stringify(t)});`);
    assert.equal(g('가상여울A 101동 202호·203호 변기배관 슬리브'), '가상여울아파트');
    assert.equal(g('가상성아파트 1동 101호 냉·온수 배관 교체'), '가상성아파트 1동101호', '긴 이름(단지+동호) 먼저');
    assert.equal(g('가상성아파트 경비실 누수 점검'), '가상성아파트');
    assert.equal(g('가상캡 판넬 지붕'), '가상캡 (가상시)', '괄호 안은 빼고 비교');
    assert.equal(g('가상열매마을 101-202 욕조방수'), '가상열매마을');
    assert.equal(g('가상평화아파트 101동 생활관 수리'), '가상평화아파트', '진행 현장에 없으면 보관 현장');
    assert.equal(g('가상메이드·가상열매마을 자재 입고'), '', '둘이면 짐작하지 않음');
    assert.equal(g('K2 커피 미팅'), '', '3글자 미만 이름은 보지 않음');
    assert.equal(g('목사님 식사 및 커피'), '');
    // add_schedule — 현장이 없으면 제목으로, 있으면 그대로
    await runA("await aiToolRun('add_schedule',{title:'가상여울A 101동 변기배관',date:'2026-11-26'});await aiToolRun('add_schedule',{title:'가상열매마을 마감',date:'2026-11-26',project:'가상메이드'});" +
      "await aiToolRun('add_schedule',{title:'가상아파트 옆 주차장 안전바',date:'2026-11-26',allDay:true});return null;");
    assert.deepEqual(run('return state.schedule.map(s=>s.title.slice(0,6)+"|"+s.project);'), ['가상여울A |가상여울아파트', '가상열매마을|가상메이드', '가상아파트 |']);
    // 일정 탭 — 이미 있는 일정 잇기
    reset({ projects: P, schedule: [{ id: 's1', date: '2026-11-14', time: '', title: '가상열매마을 101-202 욕조방수', project: '' },
      { id: 's2', date: '2026-11-17', time: '', title: '가상여울A 101동 변기배관', project: '' },
      { id: 's3', date: '2026-11-25', time: '', title: '목사님 식사', project: '' },
      { id: 's4', date: '2026-11-25', time: '', title: '가상열매마을 재방문', project: '가상메이드' }] });
    assert.deepEqual(run('return hjSchLinkCands().map(r=>r.s.id+">"+r.name);'), ['s1>가상열매마을', 's2>가상여울아파트']);
    assert.match(run('return hjSchLinkBanner();'), /현장 없는 일정 <b>2건<\/b>[\s\S]*data-sch-link/);
    run("state.schedule.find(s=>s.id==='s2').project='가상메이드';");   // 그사이 손으로 현장을 넣은 일정
    assert.equal(run('const c=[{s:{id:"s1"},name:"가상열매마을"},{s:{id:"s2"},name:"가상여울아파트"},{s:{id:"s3"},name:"없는 현장"}];return hjSchLinkApply(c);'), 1);
    assert.deepEqual(run('return state.schedule.map(s=>s.id+":"+s.project);'), ['s1:가상열매마을', 's2:가상메이드', 's3:', 's4:가상메이드'], '고른 것만 · 그새 생긴 현장·없는 현장은 그대로');
    store.set('hj_role', 'staff');
    assert.equal(run('return hjSchLinkBanner();'), '', '직원 모드에는 안 보임');
  });

  await test('④ 열면 바로 — 부팅·다시 보기 때 1분에 한 번 · 같은 문 (OPEN)', async () => {
    assert.match(appCode, /__hjCinboxArmed=true;[^\n]*setTimeout\(\(\)=>\{hjKakaoOpenCheck\(\);\},6000\)/, '부팅(중계 연결) 뒤 바로 한 번');
    assert.match(appCode, /visibilitychange',\(\)=>\{if\(document\.visibilityState==='visible'\)\{hjClaudeInboxAutoCheck\('visible'\);setTimeout\(\(\)=>\{hjKakaoOpenCheck\(\);\},1500\);\}\}\)/, '다시 볼 때도');
    fileJson = { requests: [{ id: 'kb-20261124-075441-a1011', tool: 'add_schedule', args: { title: '가상 일정', date: '2026-11-26', allDay: true }, approved: { via: 'manager', at: at(T0 - 3 * H), item: 1011 } }] };
    reset();
    store.set('hj_kakao_tick_at', String(T0 - 2 * MIN));               // 2분 전에 읽음 — 5분 깨우기는 쉬지만 열 때는 읽는다
    assert.equal(await runA('return await hjKakaoAutoTick();'), false);
    assert.equal(await runA('return await hjKakaoOpenCheck();'), true);
    assert.deepEqual(done(), ['kb-20261124-075441-a1011']);
    assert.deepEqual(relayLog, ['listFiles', 'download']);
    ctx.__T__ = T0 + 30 * 1000;
    assert.equal(await runA('return await hjKakaoOpenCheck();'), false, '1분 안에 다시 열어도 중계를 두드리지 않음');
    assert.deepEqual(relayLog, ['listFiles', 'download']);
    for (const [why, setup] of [['부팅 전', () => run('__hjCinboxArmed=false;')], ['중계 없음', () => run("__relay.url='';__relay.token='';")],
      ['직원 모드', () => store.set('hj_role', 'staff')], ['체험', () => run('state._demo=true;')], ['오프라인', () => { ctx.navigator = { onLine: false }; }]]) {
      reset(); setup();
      assert.equal(await runA('return await hjKakaoOpenCheck();'), false, why);
      assert.deepEqual(relayLog, [], why + ' — 요청 파일도 안 읽음');
    }
  });

  assert.equal(writes, fetchAtBoot, '바깥 요청 없음');
  console.log('photoassign-v620: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL photoassign-v620', e && e.stack || e); process.exit(1); });

/* v616 모델 역할 배정 — Gemini 무료 한도를 모델마다 나눠 쓰는 단위 검사
   대표 지시(11/20) "모델 역할 구분해서 배정해줘". 무료 Gemini 는 한도를 구글 프로젝트·모델마다 따로 센다.
   예전에는 모든 기능이 gemini-flash-latest 를 먼저 부르고 429 를 받으면 다른 모델을 보지 않고 멈췄다.
   이제 일의 성격(HJ_AI_ROLES: bulk·vision·tools·smart)마다 모델 차례가 있고, 한 모델이 429·404 면 다음 모델로 간다.
   브라우저 없이 돈다: index.html 앱 스크립트를 VM 에 올려 **진짜 geminiCall·hjAiGenerate·geminiAsk·geminiVision·aiFC·aiAsk** 를 부른다.
   바깥은 가짜뿐 — fetch(기기 키 길)·contractCall(서버 중계 길)·quotaReserve 를 이 검사가 갈아 끼운다. 실제 키·서버·구글 없음.
   ① 역할표 — 많이 도는 글·사진·AI 비서는 3.5 Flash-Lite 먼저, 돈·계약·하자 판단은 3.8 Flash 먼저 · Gemma 는 글(bulk)에만 · 별칭은 끝 예비 (ROLES)
   ② 429(한 모델의 무료 한도) → 다음 모델로 — 기기 키 길·서버 중계 길(AI_UPSTREAM '(429)') 둘 다 · 404(단종)도 다음 (NEXT)
   ③ 멈춤 — 서버 보호선 AI_QUOTA 는 다른 모델·기기 키로 넘어가지 않는다(ai-relay ⑤) · 400 은 키·요청 문제라 멈춘다 (STOP)
   ④ 모두 한도면 '한도' 를 알린다 · 앱 보호선 예약은 구글에서 200 을 못 받았을 때만 되돌린다 (QUOTA)
   ⑤ 돈·계약·하자 판단 기능(HJ_AI_SMART_FEATURES)만 'smart' 로 부르고, 사진은 Gemma 로 가지 않는다 · aiAsk 도 역할을 넘기고,
      서버 중계에만 키가 있어도 aiAsk 가 Gemini 로 간다(예전에는 기기 키만 봐서 'AI 키 없음') (ASSIGN)
   ⑥ 답의 생각(thought) 조각은 글에서 빠진다 · AI 비서(aiFC)는 tools 역할 (READ)
   HJ_V616_BASELINE=<commit>(예: origin/main 31d4490) 은 ①에서, HJ_V616_MUTATION=break-on-429 는 ②, no-stop-quota 는 ③,
   gemma-in-vision 은 ①(역할표), smart-dropped·aiask-no-relay 는 ⑤, thought-kept 는 ⑥ 에서 실패해야 한다.
   앱 스크립트가 VM 에 안 올라가면(새 최상위 코드가 브라우저 API 를 부름) 아래 any()/ctx 에 그 이름을 더하라 — 검사를 끄지 마라. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
let html = process.env.HJ_V616_BASELINE
  ? execFileSync('git', ['show', process.env.HJ_V616_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  : fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/\r\n/g, '\n');
const MUT = {
  'break-on-429': ["      if(st===429){limited=true;lastErr='Gemini 한도(429)';continue;}   // 한도는 모델마다 따로 — 다음 모델\n", "      if(st===429){limited=true;lastErr='Gemini 한도(429)';break;}\n"],
  'no-stop-quota': ['      if(e&&e.__aiStop)throw fail(e.message);', '      '],
  'gemma-in-vision': ["  vision:{label:'사진',models:['gemini-3.5-flash-lite',", "  vision:{label:'사진',models:['gemma-4-31b-it','gemini-3.5-flash-lite',"],
  'smart-dropped': ["let t=await geminiAsk(prompt,'smart');", 'let t=await geminiAsk(prompt);'],   // reviewQuote(견적 검토)
  'thought-kept': ['c.content.parts.filter(p=>p&&!p.thought)', 'c.content.parts.filter(p=>p)'],
  'aiask-no-relay': ['  if(window.__geminiKey||(await aiRelayProbe(false)).gemini){\n    try{return await geminiAsk(prompt,role);}', '  if(window.__geminiKey){\n    try{return await geminiAsk(prompt,role);}']
};
if (process.env.HJ_V616_MUTATION) {
  const m = MUT[process.env.HJ_V616_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V616_MUTATION);
  assert.ok(html.split(m[0]).length >= 2, 'mutation anchor'); html = html.replace(m[0], () => m[1]);
}

// ── 앱 스크립트를 VM 에 — 화면·저장소·네트워크는 무엇이든 받아 주는 빈 껍데기 (formernames-v614.unit.js 와 같은 틀) ──
function any(name) {
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) { if (k === Symbol.iterator) return function* () {}; if (k === Symbol.toPrimitive) return () => ''; if (k === 'then') return undefined; if (k === 'length') return 0; return any(name + '.' + String(k)); },
    set() { return true; }, apply() { return any(name + '()'); }, construct() { return any('new ' + name); }, has() { return true; }
  });
}
function loadApp() {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, code = '';
  while ((m = re.exec(html))) if (m[1].length > code.length) code = m[1];
  assert.ok(code.length > 1e6, '앱 스크립트를 찾음');
  const store = new Map(), noop = () => {};
  const ctx = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: noop }, setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, queueMicrotask, Promise, Intl, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, performance, structuredClone,
    document: any('document'), navigator: any('navigator'), history: any('history'), indexedDB: any('indexedDB'), caches: any('caches'), visualViewport: any('vv'),
    Notification: any('Notification'), speechSynthesis: any('ss'), getSelection: () => any('sel'), getComputedStyle: () => any('cs'),
    location: { href: 'http://127.0.0.1/index.html', search: '', hash: '', pathname: '/index.html', origin: 'http://127.0.0.1', protocol: 'http:', hostname: '127.0.0.1', reload: noop, replace: noop },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    fetch: () => new Promise(noop), addEventListener: noop, removeEventListener: noop, screen: { width: 1280, height: 800 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
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
const run = src => JSON.parse(vm.runInContext('JSON.stringify((()=>{' + src + '})())', ctx));

/* 가짜 바깥 — plan[model] 이 그 모델의 답을 정한다.
   기기 키 길: {status, text?, parts?} → fetch 응답. 서버 중계 길: {code:'AI_UPSTREAM'|'AI_QUOTA', st} → contractCall 오류, 아니면 {status, json}.
   기록: calls(부른 모델 차례) · released(앱 보호선 예약을 되돌린 수) · direct(기기 키로 구글을 직접 부른 수) */
const SETUP = `
  window.__T={calls:[],released:0,direct:0,relay:false,plan:{}};
  window.__geminiKey='FAKE-TEST-NOT-A-KEY';window.__aiProvider=undefined;
  quotaReserve=async()=>({ok:true,release:async()=>{__T.released++;}});
  aiUsageTrack=()=>{};
  aiRelayProbe=async()=>({checked:true,gemini:__T.relay,at:Date.now()});
  const answer=(m)=>{const p=__T.plan[m]||__T.plan['*']||{status:500};
    const parts=p.parts||(p.text!==undefined?[{text:p.text}]:[]);return {p,json:{candidates:[{content:{parts}}]}};};
  contractCall=async(name,args)=>{const m=args.model;__T.calls.push(m);const {p,json}=answer(m);
    if(p.code){const e=new Error(p.code==='AI_QUOTA'?'오늘 AI 한도(200건)를 다 썼어요':'Gemini 가 거절했습니다 ('+p.st+') 가짜');e.__code=p.code;throw e;}
    return {ok:true,status:p.status,json};};
  fetch=async(url,opt)=>{const m=String(url).split('/models/')[1].split(':')[0];__T.calls.push(m);__T.direct++;const {p,json}=answer(m);
    return {ok:p.status>=200&&p.status<300,status:p.status,json:async()=>json};};
`;
async function arun(src) {
  const p = vm.runInContext('(async()=>{' + SETUP + src + '})()', ctx);
  return JSON.parse(JSON.stringify(await p));
}
const tryAsk = call => `let out='',err='';try{out=await ${call};}catch(e){err=e.message||String(e);}return {out,err,calls:__T.calls,released:__T.released,direct:__T.direct};`;

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ai-roles-v616 ' + name); }

(async () => {
  await test('① 역할표 — Flash-Lite 먼저(글·사진·비서) · 3.8 Flash 먼저(돈·계약·하자) · Gemma 는 글에만 · 별칭은 끝 (ROLES)', async () => {
    const r = run(`return {roles:HJ_AI_ROLES,text:hjAiRolesText(),bulk:hjAiModels('bulk'),unknown:hjAiModels('없는역할'),smartList:HJ_AI_SMART_FEATURES};`);
    assert.deepEqual(Object.keys(r.roles).sort(), ['bulk', 'smart', 'tools', 'vision'], '역할 넷');
    for (const k of ['bulk', 'vision', 'tools']) assert.equal(r.roles[k].models[0], 'gemini-3.5-flash-lite', k + ' 은 3.5 Flash-Lite 먼저');
    assert.equal(r.roles.smart.models[0], 'gemini-3.8-flash', '판단은 3.8 Flash 먼저');
    for (const [k, v] of Object.entries(r.roles)) {
      const ms = v.models;
      assert.equal(new Set(ms).size, ms.length, k + ' 모델 겹침 없음');
      assert.ok(ms.includes('gemini-3.5-flash-lite') && ms.includes('gemini-3.1-flash-lite'), k + ' 은 Flash-Lite 둘을 예비로 가진다');
      assert.equal(ms.includes('gemma-4-31b-it'), k === 'bulk', k + ' — Gemma 는 글(bulk)에만');
      const alias = ms.findIndex(m => /-latest$/.test(m));
      assert.ok(alias > 0 && ms.slice(alias + 1).every(m => !/^gemini-/.test(m)), k + ' — 별칭(-latest)은 Gemini 차례 끝 예비 ' + JSON.stringify(ms));
    }
    assert.deepEqual(r.unknown, r.bulk, '모르는 역할은 bulk');
    assert.ok(/3\.8 Flash/.test(r.text) && /Gemma 4/.test(r.text) && !/latest/.test(r.text), '설정 한 줄 ' + r.text);
    assert.ok(!/'gemini-2\.0-flash'/.test(html), '단종 모델 이름이 남지 않음');
  });

  await test('② 429 → 다음 모델(기기 키 길·서버 중계 길) · 404(단종)도 다음 (NEXT)', async () => {
    const dev = await arun(`__T.plan={'gemini-3.5-flash-lite':{status:429},'gemini-3.1-flash-lite':{status:200,text:'둘째 답'}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.equal(dev.out, '둘째 답', '기기 키 길 ' + JSON.stringify(dev));
    assert.deepEqual(dev.calls, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'], '3.5 한도 → 3.1');
    assert.equal(dev.released, 0, '답을 받았으니 예약 유지');
    const rel = await arun(`__T.relay=true;__T.plan={'gemini-3.5-flash-lite':{code:'AI_UPSTREAM',st:429},'gemini-3.1-flash-lite':{status:200,text:'중계 둘째 답'}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.equal(rel.out, '중계 둘째 답', '서버 중계 길 ' + JSON.stringify(rel));
    assert.equal(rel.direct, 0, '중계가 있으면 기기 키로 직접 가지 않음');
    const gone = await arun(`__T.plan={'gemini-3.5-flash-lite':{status:404},'gemini-3.1-flash-lite':{status:200,text:'단종 뒤 답'}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.equal(gone.out, '단종 뒤 답', '404 → 다음 ' + JSON.stringify(gone));
    const smart = await arun(`__T.plan={'gemini-3.8-flash':{status:429},'gemini-3.5-flash-lite':{status:200,text:'판단 예비 답'}};` + tryAsk(`geminiAsk('가상 견적 검토','smart')`));
    assert.deepEqual(smart.calls, ['gemini-3.8-flash', 'gemini-3.5-flash-lite'], '판단: 3.8 Flash 한도 → 3.5 Flash-Lite ' + JSON.stringify(smart));
    assert.equal(smart.out, '판단 예비 답');
  });

  await test('③ 멈춤 — 서버 보호선(AI_QUOTA)은 다른 모델·기기 키로 넘어가지 않음 · 400 은 멈춤 (STOP)', async () => {
    const q = await arun(`__T.relay=true;__T.plan={'*':{code:'AI_QUOTA'}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.deepEqual(q.calls, ['gemini-3.5-flash-lite'], '한 번만 부르고 멈춤 ' + JSON.stringify(q));
    assert.equal(q.direct, 0, '기기 키로 우회하지 않음');
    assert.ok(/한도/.test(q.err), '한도를 알림 ' + q.err);
    const bad = await arun(`__T.plan={'*':{status:400}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.deepEqual(bad.calls, ['gemini-3.5-flash-lite'], '400 은 다른 모델도 같다 — 멈춤 ' + JSON.stringify(bad));
    assert.ok(/요청 오류\(400\)/.test(bad.err), bad.err);
    const relBad = await arun(`__T.relay=true;__T.plan={'*':{code:'AI_UPSTREAM',st:403}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.deepEqual(relBad.calls, ['gemini-3.5-flash-lite'], '중계 403 도 멈춤 ' + JSON.stringify(relBad));
  });

  await test('④ 모두 한도면 한도를 알림 · 예약은 200 을 못 받았을 때만 되돌림 (QUOTA)', async () => {
    const all = await arun(`__T.plan={'*':{status:429}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.deepEqual(all.calls, run(`return hjAiModels('bulk');`), '글 역할 모델을 한 번씩 모두 ' + JSON.stringify(all.calls));
    assert.ok(/한도/.test(all.err) && /429/.test(all.err), '한도 알림 ' + all.err);
    assert.equal(all.released, 1, '구글이 생성하지 않았으니 앱 보호선 예약을 되돌림');
    const empty = await arun(`__T.plan={'*':{status:200,text:''}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.ok(/응답 없음/.test(empty.err), empty.err);
    assert.equal(empty.released, 0, '200 을 받았으면(빈 답이어도) 되돌리지 않음 — 한도 과소집계 금지');
    const late = await arun(`__T.plan={'gemini-3.5-flash-lite':{status:200,text:''},'gemini-3.1-flash-lite':{status:200,text:'둘째에서 답'}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.equal(late.out, '둘째에서 답', '빈 답 → 다음 모델 ' + JSON.stringify(late));
  });

  await test('⑤ 돈·계약·하자 판단 기능만 smart · 사진은 Gemma 로 안 감 · aiAsk 도 역할을 넘김 (ASSIGN)', async () => {
    const list = run(`return HJ_AI_SMART_FEATURES;`);
    const fnBody = name => { const m = html.match(new RegExp('\\n(?:async\\s+)?function\\s+' + name + '\\(')); assert.ok(m, name + ' 함수가 있음');
      const rest = html.slice(m.index + 10); const nx = rest.search(/\n(?:async\s+)?function\s+\w+\(/); return html.slice(m.index, m.index + 10 + (nx < 0 ? rest.length : nx)); };
    for (const name of list) assert.ok(/(?:geminiAsk|geminiVision|aiAsk)\([^\n]*?'smart'\)/.test(fnBody(name)), name + ' 이 smart 로 부르지 않음');
    const smartCalls = (html.match(/(?:geminiAsk|geminiVision|aiAsk)\([^\n]*?'smart'\)/g) || []).length;
    assert.equal(smartCalls, list.length, 'smart 호출 수 = 목록 수(목록 밖에서 smart 를 쓰지 않음) ' + smartCalls);
    const vis = await arun(`__T.plan={'*':{status:429}};` + tryAsk(`geminiVision('가상 사진',['AAAA'])`));
    assert.ok(vis.calls.length >= 2 && !vis.calls.some(m => /gemma/.test(m)), '사진은 Gemma 로 가지 않음 ' + JSON.stringify(vis.calls));
    const visBulk = await arun(`__T.plan={'*':{status:429}};` + tryAsk(`geminiVision('가상 사진',['AAAA'],'bulk')`));
    assert.ok(!visBulk.calls.some(m => /gemma/.test(m)), 'bulk 를 넘겨도 사진은 vision 차례 ' + JSON.stringify(visBulk.calls));
    const visSmart = await arun(`__T.plan={'gemini-3.8-flash':{status:200,text:'하자 판단'}};` + tryAsk(`geminiVision('가상 하자',['AAAA'],'smart')`));
    assert.deepEqual(visSmart.calls, ['gemini-3.8-flash'], '하자·견적 사진은 3.8 Flash ' + JSON.stringify(visSmart));
    const role = await arun(`let got=null;const keep=geminiAsk;geminiAsk=async(p,r)=>{got=r||'(없음)';return 'ok';};
      try{await aiAsk('가상','smart');}finally{geminiAsk=keep;}return got;`);
    assert.equal(role, 'smart', 'aiAsk 가 역할을 geminiAsk 로 넘김');
    const relayOnly = await arun(`window.__geminiKey=undefined;__T.relay=true;__T.plan={'*':{status:200,text:'중계 답'}};` + tryAsk(`aiAsk('가상 계약서 검토','smart')`));
    assert.equal(relayOnly.out, '중계 답', '서버에만 키가 있어도 aiAsk 가 Gemini 로 감(AI 키 없음으로 멈추지 않음) ' + JSON.stringify(relayOnly));
    assert.deepEqual(relayOnly.calls, ['gemini-3.8-flash'], '중계 길로 smart 차례 ' + JSON.stringify(relayOnly.calls));
    assert.equal(relayOnly.direct, 0, '기기 키 없음 — 직접 부르지 않음');
  });

  await test('⑥ 생각(thought) 조각은 글에서 빠짐 · AI 비서는 tools 역할 (READ)', async () => {
    const th = await arun(`__T.plan={'*':{status:200,parts:[{text:'가상 생각',thought:true},{text:'가상 답'}]}};` + tryAsk(`geminiAsk('가상 질문')`));
    assert.equal(th.out, '가상 답', '생각 조각 빠짐 ' + JSON.stringify(th));
    const fc = await arun(`__T.plan={'gemini-3.5-flash-lite':{status:429},'gemini-3.1-flash-lite':{status:200,parts:[{functionCall:{name:'list_projects',args:{}}}]}};
      let parts=null,err='';try{parts=await aiFC([{role:'user',parts:[{text:'가상'}]}]);}catch(e){err=e.message;}return {parts,err,calls:__T.calls};`);
    assert.deepEqual(fc.calls, run(`return hjAiModels('tools');`).slice(0, 2), 'AI 비서 — tools 차례로 한도 넘어감 ' + JSON.stringify(fc));
    assert.equal(fc.parts && fc.parts[0].functionCall.name, 'list_projects', '도구 호출 조각을 그대로 돌려줌');
  });

  console.log(`ai-roles-v616: ${passed} passed`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });

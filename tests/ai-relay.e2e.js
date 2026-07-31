/* ai-relay.e2e.js — AI 키를 기기에서 서버로 옮긴 뒤의 회귀

   왜 옮겼는가
     예전에는 Gemini·ChatGPT 키가 **사장님 폰 브라우저 안**에 있었다. 그래서
       · 기기마다 키를 따로 넣어야 했고(키는 클라우드 백업에 안 실린다)
       · 사파리가 7일마다 저장소를 정리해 키가 사라졌고
       · 한도를 기기마다 따로 세서 PC 200 + 폰 200 = 400건이 나갔다.
     이제 계약 서버(Apps Script)의 스크립트 속성에 키를 두고 `ai.ask` 로 통과시킨다.

   여기서 지키는 것
     ① 서버 중계가 준비돼 있으면 기기에 키가 없어도 AI 가 열린다 (aiKeyReady)
     ② 중계로 갈 때 구글 API 로 **직접 나가는 요청이 0** 이다 — 키가 폰에 없으니 나갈 수도 없다
     ③ 중계 요청 본문에 API 키가 실리지 않는다 (키는 서버 스크립트 속성에만 있다)
     ④ 서버에 키가 없다고(AI_NOT_CONFIGURED) 하면 조용히 기기 키로 되돌아간다 — AI 가 멈추지 않는다
     ⑤ 서버가 한도 초과(AI_QUOTA)라고 하면 **기기 키로 우회하지 않는다** — 우회하면 한도가 무의미해진다
     ⑥ 중계가 없으면 지금까지처럼 기기 키로 직접 부른다 (기존 동작 무변경)
     ⑦ 도구 호출(aiFC) 경로도 중계로 간다 — 여기만 안 열려 있으면 AI 비서가 죽는다
     ⑧ 유료(ChatGPT) 는 앱이 중계로 부르지 않는다 — 무료 Gemini 만 쓴다
     ⑨ 서버 주소·토큰이 없으면 중계를 켰다고 하지 않는다 (있는 척 금지)
     ⑩ 설정 화면이 "지금 어느 길로 가는지" 를 사실대로 알린다
     ⑪ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const WEBAPP = 'https://script.google.com/macros/s/AKfyTEST/exec';
const GEMINI_HOST = 'generativelanguage.googleapis.com';
let browser;

/* 서버가 살아 있고 AI 중계가 켜진 상태를 흉내내는 fetch.
   실제 서버가 하는 대로 HTTP 는 언제나 200 이고 ok 필드로 성패를 말한다. */
const RELAY_STUB = (opts) => `(${function (o) {
  window.__relayCalls = [];
  window.__directCalls = [];
  window.fetch = async function (u, opt) {
    const url = String(u);
    if (url.indexOf('generativelanguage.googleapis.com') >= 0) {
      window.__directCalls.push(url);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '기기키응답' }] } }] }) };
    }
    const body = JSON.parse(opt.body);
    window.__relayCalls.push(body);
    if (body.action === 'health') {
      return { ok: true, status: 200, json: async () => ({
        ok: true, live: false, modules: { ai: o.aiModule }, ai: { gemini: o.gemini, openai: o.openai } }) };
    }
    if (body.action === 'ai.ask') {
      if (o.askError) return { ok: true, status: 200,
        json: async () => ({ ok: false, error: o.askError, message: '서버가 거절함' }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, provider: body.payload.provider,
        model: body.payload.model, status: 200,
        json: { candidates: [{ content: { parts: [{ text: '중계응답' }] } }] } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
}})(${JSON.stringify(opts)})`;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // 기기 키를 완전히 비운 상태에서 시작한다 — "폰을 새로 샀다"와 같은 상황.
  const clearKeys = async () => page.evaluate(() => {
    window.__geminiKey = null; window.__openaiKey = null; window.__llamaConfig = null;
    window.__aiProvider = 'gemini';
    __aiRelay = { checked: false, gemini: false, at: 0 };
    __contract.url = 'https://script.google.com/macros/s/AKfyTEST/exec';
    __contract.token = 'tk';
  });

  // ①②③ 서버에 키가 있으면 기기에 키가 없어도 AI 가 열리고, 구글로 직접 나가지 않는다
  await clearKeys();
  const viaRelay = await page.evaluate(async (stub) => {
    eval(stub);
    await aiRelayProbe(true);
    const readyBefore = aiKeyReady();
    const text = await geminiAsk('안녕');
    const ask = window.__relayCalls.filter(c => c.action === 'ai.ask');
    return {
      readyBefore, text,
      direct: window.__directCalls.length,
      askCount: ask.length,
      provider: ask[0] && ask[0].payload.provider,
      hasModel: !!(ask[0] && ask[0].payload.model),
      hasBody: !!(ask[0] && ask[0].payload.body && ask[0].payload.body.contents),
      // 본문 전체를 훑어 API 키처럼 생긴 값이 실렸는지 본다
      bodyDump: JSON.stringify(ask[0] || {}),
      adminToken: ask[0] && ask[0].adminToken
    };
  }, RELAY_STUB({ aiModule: true, gemini: true, openai: false }));
  assert(viaRelay.readyBefore === true, '① 서버에 키가 있는데 AI 가 잠겨 있음 — 기기마다 키를 넣어야 하는 문제가 그대로다');
  assert(viaRelay.text === '중계응답', '① 중계 응답을 받지 못함: ' + viaRelay.text);
  assert(viaRelay.direct === 0, '② 구글 API 로 직접 나간 요청 ' + viaRelay.direct + '건 — 중계를 쓰는데 왜 직접 나가나');
  assert(viaRelay.askCount === 1, '② ai.ask 호출 수가 1이 아님: ' + viaRelay.askCount);
  assert(viaRelay.provider === 'gemini' && viaRelay.hasModel && viaRelay.hasBody, '③ ai.ask 본문 모양이 규약과 다름');
  assert(!/AIza|sk-[A-Za-z0-9]/.test(viaRelay.bodyDump), '③ 중계 요청에 API 키처럼 보이는 값이 실림');
  assert(viaRelay.adminToken === 'tk', '③ 관리자 토큰 없이 ai.ask 를 부름 — 서버가 거절한다');

  // ④ 서버에 키가 빠졌으면(AI_NOT_CONFIGURED) 기기 키로 되돌아간다
  await clearKeys();
  const fallback = await page.evaluate(async (stub) => {
    eval(stub);
    window.__geminiKey = 'AIzaDEVICEKEY';
    await aiRelayProbe(true);
    const text = await geminiAsk('안녕');
    return { text, direct: window.__directCalls.length, relayFlag: __aiRelay.gemini };
  }, RELAY_STUB({ aiModule: true, gemini: true, openai: false, askError: 'AI_NOT_CONFIGURED' }));
  assert(fallback.text === '기기키응답', '④ 서버에 키가 없는데 기기 키로 되돌아가지 않음 — AI 가 멈춘다');
  assert(fallback.direct === 1, '④ 기기 키 직접 호출이 1건이어야 함: ' + fallback.direct);
  assert(fallback.relayFlag === false, '④ 서버가 키 없다고 했는데 중계를 계속 준비된 것으로 봄');

  // ⑤ 한도 초과는 기기 키로 우회하지 않는다
  await clearKeys();
  const quota = await page.evaluate(async (stub) => {
    eval(stub);
    window.__geminiKey = 'AIzaDEVICEKEY';   // 우회할 수 있는 키를 일부러 쥐여 준다
    await aiRelayProbe(true);
    let msg = '';
    try { await geminiAsk('안녕'); } catch (e) { msg = e.message || String(e); }
    return { msg, direct: window.__directCalls.length };
  }, RELAY_STUB({ aiModule: true, gemini: true, openai: false, askError: 'AI_QUOTA' }));
  assert(quota.direct === 0, '⑤ 한도 초과인데 기기 키로 우회함 — 서버 한 곳에서 세는 의미가 없어진다');
  assert(/한도/.test(quota.msg), '⑤ 한도 초과가 사용자에게 전해지지 않음: ' + quota.msg);

  // ⑥ 중계가 없으면 지금까지처럼 기기 키로 직접 부른다 (기존 동작 무변경)
  await clearKeys();
  const legacy = await page.evaluate(async (stub) => {
    eval(stub);
    window.__geminiKey = 'AIzaDEVICEKEY';
    await aiRelayProbe(true);
    const text = await geminiAsk('안녕');
    return { text, direct: window.__directCalls.length,
             ask: window.__relayCalls.filter(c => c.action === 'ai.ask').length };
  }, RELAY_STUB({ aiModule: false, gemini: false, openai: false }));
  assert(legacy.text === '기기키응답', '⑥ 중계가 없는데 기기 키로 안 부름 — 기존 동작이 깨졌다');
  assert(legacy.direct === 1 && legacy.ask === 0, '⑥ 중계가 없는데 ai.ask 를 부름');

  // ⑦ 도구 호출(aiFC) 경로도 중계로 간다 — AI 비서 전체가 이 경로를 탄다
  await clearKeys();
  const fc = await page.evaluate(async (stub) => {
    eval(stub);
    await aiRelayProbe(true);
    let err = '';
    let parts = null;
    try { parts = await aiFC([{ role: 'user', parts: [{ text: '안녕' }] }]); }
    catch (e) { err = e.message || String(e); }
    return { err, ok: !!(parts && parts[0] && parts[0].text),
             direct: window.__directCalls.length,
             ask: window.__relayCalls.filter(c => c.action === 'ai.ask').length };
  }, RELAY_STUB({ aiModule: true, gemini: true, openai: false }));
  assert(fc.err === '', '⑦ 도구 호출 경로가 막힘: ' + fc.err);
  assert(fc.ok, '⑦ 도구 호출이 응답을 못 받음');
  assert(fc.direct === 0 && fc.ask === 1, '⑦ 도구 호출이 중계로 안 감 (직접 ' + fc.direct + ' · 중계 ' + fc.ask + ')');

  // ⑧ 유료(ChatGPT) 는 앱이 중계로 부르지 않는다 — 지금은 무료 Gemini 만 쓴다
  const paid = await page.evaluate((src) => {
    // ai.ask 를 부르는 곳이 provider:'gemini' 뿐인지 소스로 확인한다.
    const m = src.match(/contractCall\(\s*'ai\.ask'[\s\S]{0,200}?\)/g) || [];
    return { sites: m.length, allGemini: m.every(s => /provider\s*:\s*'gemini'/.test(s)) };
  }, await page.evaluate(() => document.documentElement.innerHTML));
  assert(paid.sites >= 1, '⑧ ai.ask 호출 지점을 못 찾음');
  assert(paid.allGemini, '⑧ 앱이 유료 제공자를 중계로 부른다 — 무료로 쓰기로 한 결정과 어긋난다');

  // ⑨ 서버 주소·토큰이 없으면 중계를 켰다고 하지 않는다
  const noServer = await page.evaluate(async () => {
    __contract.url = ''; __contract.token = '';
    window.__geminiKey = null; window.__openaiKey = null; window.__llamaConfig = null;
    __aiRelay = { checked: false, gemini: false, at: 0 };
    window.__netCalls = 0;
    window.fetch = async () => { window.__netCalls++; throw new Error('물어볼 곳이 없는데 나감'); };
    const r = await aiRelayProbe(true);
    return { gemini: r.gemini, ready: aiKeyReady(), net: window.__netCalls };
  });
  assert(noServer.gemini === false, '⑨ 서버 주소가 없는데 중계가 준비됐다고 함');
  assert(noServer.ready === false, '⑨ 키도 서버도 없는데 AI 가 열려 있음');
  assert(noServer.net === 0, '⑨ 주소가 없는데 네트워크로 나감: ' + noServer.net);

  // ⑩ 설정 화면이 "지금 어느 길로 가는지" 를 사실대로 알려 준다
  const notice = await page.evaluate(async (stub) => {
    eval(stub);
    __contract.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __contract.token = 'tk';
    window.__geminiKey = null;
    __aiRelay = { checked: false, gemini: false, at: 0 };
    await aiRelayProbe(true);
    openGdriveSetup();
    const on = (document.getElementById('modalRoot') || {}).textContent || '';
    closeModal();
    __aiRelay = { checked: true, gemini: false, at: Date.now() };
    openGdriveSetup();
    const off = (document.getElementById('modalRoot') || {}).textContent || '';
    closeModal();
    return { on, off };
  }, RELAY_STUB({ aiModule: true, gemini: true, openai: false }));
  assert(/계약 서버에 있습니다/.test(notice.on), '⑩ 서버에 키가 있는데 설정 화면이 알려 주지 않음');
  assert(/GEMINI_API_KEY/.test(notice.off), '⑩ 서버에 키를 넣는 방법을 안내하지 않음');
  assert(!/계약 서버에 있습니다/.test(notice.off), '⑩ 서버에 키가 없는데 있다고 표시함');

  assert(errors.length === 0, '⑪ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 서버에 키가 있으면 기기 키 없이도 AI 가 열린다');
  console.log('PASS  ② 중계로 갈 때 구글 직접 호출 0');
  console.log('PASS  ③ 중계 요청에 API 키가 실리지 않는다 · 관리자 토큰은 실린다');
  console.log('PASS  ④ 서버에 키가 없으면 기기 키로 되돌아간다');
  console.log('PASS  ⑤ 한도 초과는 기기 키로 우회하지 않는다');
  console.log('PASS  ⑥ 중계가 없으면 기존대로 기기 키로 직접 부른다');
  console.log('PASS  ⑦ 도구 호출(aiFC) 경로도 중계로 간다');
  console.log('PASS  ⑧ 앱은 무료 Gemini 만 중계로 부른다');
  console.log('PASS  ⑨ 서버가 없으면 있는 척하지 않는다 · 요청 0');
  console.log('PASS  ⑩ 설정 화면이 지금 어느 길로 가는지 사실대로 알린다');
  console.log('PASS  ⑪ pageerror 0');
  console.log('\n전부 통과 (11건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

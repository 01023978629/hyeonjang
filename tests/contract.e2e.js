/* contract.e2e.js — 전자계약(Apps Script) 잠금·통신규약·정직성 회귀

   Fly 서버가 종료되고 계약 서버가 Apps Script 웹앱으로 바뀌었다.
   앞서 Codex 가 CONTRACT_FEATURE_AVAILABLE=false 로 기능을 잠갔는데,
   그 잠금이 지키던 성질을 **그대로 지키면서** 조건만 더 엄격하게 바꿨다.

     이전: 소스에 박힌 false. 사람이 파일을 고쳐야 열린다.
     지금: 그 서버에 selfTest 를 실제로 걸어 통과해야 열린다.

   상수는 "이제 괜찮다"는 사람의 판단이고, selfTest 는 서버가 살아 있다는 증거다.
   그래서 기본은 여전히 잠김이고, 증거 없이는 계약 버튼이 눌리지 않는다.

   지키는 것
     ① 종료된 Fly 주소가 소스 어디에도 없다
     ② 잠긴 상태에서는 네트워크 요청도 발송 이력도 0이다 (Codex 가 지키던 것)
     ③ 주소 입력칸은 열려 있다 — 칸을 숨기면 새 주소를 넣을 방법이 없어 영원히 잠긴다
     ④ 통신은 text/plain 단일 엔드포인트 POST, 커스텀 헤더 없음(preflight 회피)
     ⑤ Apps Script 는 실패해도 HTTP 200 을 준다. ok:false 는 실패로 다룬다
     ⑥ selfTest 가 통과해야만 열리고, 실패하면 잠긴 채로 남는다
     ⑦ 주소·토큰을 바꾸면 예전 자가진단 결과는 무효가 된다
     ⑧ notify.sent 가 true 일 때만 "보냈다"고 기록한다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
// 다른 테스트와 같은 폴백 — 이게 없어서 이 테스트만 조용히 실행되지 않고 있었다(MODULE_NOT_FOUND).
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const WEBAPP = 'https://script.google.com/macros/s/AKfyTEST/exec';
let browser;

// selfTest 응답을 흉내낸다. allOk 가 곧 잠금 해제 조건이다.
const selfTestReply = (allOk) => ({
  ok: true,
  checks: { allOk, items: [{ name: '스크립트 속성', ok: true, detail: '4개 모두 설정됨' },
                           { name: '스프레드시트', ok: allOk, detail: allOk ? '열림' : 'SPREADSHEET_ID 로 열 수 없음' }] }
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // ①③ 기본은 잠김. 안내가 뜨고, 그래도 주소 입력칸은 열려 있다.
  const boot = await page.evaluate(() => {
    __contract.url = ''; __contract.token = ''; __contract.selfTestOk = false; __contract.selfTestAt = '';
    openGdriveSetup();
    const root = document.getElementById('modalRoot') || document.body;
    return {
      def: CONTRACT_SERVER_DEFAULT,
      ready: contractReady(),
      hasUrlInput: !!root.querySelector('#ctUrl'),
      hasSelfTestBtn: !!root.querySelector('#ctSelfTest'),
      hint: (root.querySelector('#ctUrl') || {}).placeholder || '',
      text: root.textContent || '',
      flyInSource: document.documentElement.innerHTML.includes('manmool-contract.fly.dev')   // dead-endpoint-ok: 없음을 확인하는 줄
    };
  });
  assert(boot.def === '', '기본 서버 주소가 비어 있어야 함(죽은 주소를 채워 두지 않는다)');
  assert(boot.flyInSource === false, '종료된 Fly 주소가 화면 소스에 남음');
  assert(boot.ready === false, '자가진단 전인데 계약 기능이 열려 있음');
  assert(/잠김/.test(boot.text), '잠김 안내가 보여야 함');
  assert(boot.hasUrlInput, '주소 입력칸이 없으면 새 서버를 영원히 넣을 수 없다');
  assert(boot.hasSelfTestBtn, '자가진단 버튼이 없으면 잠금을 풀 방법이 없다');
  assert(/script\.google\.com/.test(boot.hint) && /\/exec/.test(boot.hint), 'Apps Script 주소 안내 없음: ' + boot.hint);
  await page.evaluate(() => closeModal());

  // ② 과거 주소·토큰이 기기에 남아 있어도 잠금이 우선한다 — 요청도 이력도 0.
  const locked = await page.evaluate(async () => {
    __contract.url = 'https://example.invalid'; __contract.token = 'device-only-token';
    __contract.selfTestOk = false;
    const p = { name: '테스트 현장', phases: ['욕실'], customer: { name: '홍길동', phone: '010-1234-5678' } };
    window.__calls = [];
    window.fetch = async function (u) { window.__calls.push(String(u)); throw new Error('잠금 상태에서 호출되면 안 됨'); };
    await contractSend(p, 1100000);
    await hjWorkOrderAlimtalk('010-5555-6666', '문안', null, {});
    return { calls: window.__calls.length, ready: contractReady(), logs: (p.contractLog || []).length };
  });
  assert(locked.ready === false, '잠금 상태에서 contractReady 가 true');
  assert(locked.calls === 0, '잠금 상태에서 네트워크 요청 발생: ' + locked.calls);
  assert(locked.logs === 0, '잠금 상태에서 계약 발송 이력 생성');

  // ④⑤ 통신 규약 — 단일 엔드포인트 · text/plain · 커스텀 헤더 없음 · ok:false 는 실패
  const wire = await page.evaluate(async (WEBAPP) => {
    __contract.url = WEBAPP; __contract.token = 'tk';
    window.__calls = [];
    window.fetch = async function (u, opt) {
      window.__calls.push({ url: String(u), ct: (opt.headers || {})['Content-Type'],
        hdrs: Object.keys(opt.headers || {}), body: JSON.parse(opt.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true, live: false }) };
    };
    await contractCall('health', {}, { noAuth: true });
    const one = window.__calls[0];
    window.fetch = async () => ({ ok: true, status: 200,
      json: async () => ({ ok: false, error: 'UNAUTHORIZED', message: '관리자 인증에 실패했습니다' }) });
    let thrown = null;
    try { await contractCall('listContracts', {}); } catch (e) { thrown = { code: e.__code, msg: e.message }; }
    return { one, thrown };
  }, WEBAPP);
  assert(wire.one.url === WEBAPP, '단일 엔드포인트로 가야 함: ' + wire.one.url);
  assert(/^text\/plain/.test(wire.one.ct), 'text/plain 이 아니면 preflight 로 막힌다: ' + wire.one.ct);
  assert(!wire.one.hdrs.some(h => /^x-/i.test(h)), '커스텀 헤더가 있으면 preflight 가 생긴다: ' + wire.one.hdrs.join(','));
  assert(wire.one.body.action === 'health' && wire.one.body.adminToken === undefined, 'health 는 토큰 없이 가야 함');
  assert(wire.thrown && wire.thrown.code === 'UNAUTHORIZED', 'ok:false 인데 성공으로 넘어감 — 실패가 조용히 지나간다');

  // ⑥ selfTest 실패는 잠긴 채로, 성공해야 열린다
  const gate = await page.evaluate(async (r) => {
    const [failReply, okReply] = r;
    __contract.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __contract.token = 'tk';
    window.fetch = async () => ({ ok: true, status: 200, json: async () => failReply });
    let afterFail;
    try { await contractSelfTest(); } catch (e) {}
    afterFail = contractFeatureAvailable();
    window.fetch = async () => ({ ok: true, status: 200, json: async () => okReply });
    await contractSelfTest();
    return { afterFail, afterOk: contractFeatureAvailable(), at: __contract.selfTestAt };
  }, [selfTestReply(false), selfTestReply(true)]);
  assert(gate.afterFail === false, '자가진단이 실패했는데 계약 기능이 열림 — 가장 위험한 결함');
  assert(gate.afterOk === true, '자가진단을 통과했는데도 열리지 않음');
  assert(!!gate.at, '통과 시각이 기록되지 않음');

  // ⑦ 주소·토큰을 바꾸면 예전 자가진단은 무효 (다른 서버의 결과다)
  const invalidated = await page.evaluate(async () => {
    openGdriveSetup();
    const root = document.getElementById('modalRoot');
    root.querySelector('#ctUrl').value = 'https://script.google.com/macros/s/OTHER/exec';
    await root.querySelector('#ctSave').onclick();
    const r = { ok: contractFeatureAvailable(), at: __contract.selfTestAt };
    closeModal();
    return r;
  });
  assert(invalidated.ok === false, '서버 주소를 바꿨는데 예전 자가진단 결과로 계약이 열린 채 남음');
  assert(invalidated.at === '', '통과 시각이 지워지지 않음');

  // ⑧ 발송 정직성 — notify.sent 가 true 일 때만 SENT
  const honesty = await page.evaluate(async (WEBAPP) => {
    __contract.url = WEBAPP; __contract.token = 'tk'; __contract.selfTestOk = true;
    const mk = (sent) => async (u, opt) => {
      const req = JSON.parse(opt.body);
      if (req.action === 'health') return { ok: true, status: 200, json: async () => ({ ok: true, live: false }) };
      return { ok: true, status: 200, json: async () => ({ ok: true, contractId: 'ct_1', contractNo: 'MM-2026-0143',
        signUrl: WEBAPP + '?page=sign&t=RAW', notify: { sent, reason: sent ? '' : 'MOCK_OFF' } }) };
    };
    const a = { name: 'A현장', phases: [], customer: { name: '홍길동', phone: '010-1234-5678' } };
    window.__calls = [];
    window.fetch = async function (u, opt) { window.__calls.push(JSON.parse(opt.body)); return mk(false)(u, opt); };
    await contractSend(a, 1100000);
    const link = (document.getElementById('ctSignLink') || {}).value || '';
    const modalText = (document.getElementById('modalRoot') || {}).textContent || '';
    closeModal();
    const b = { name: 'B현장', phases: [], customer: { name: '김고객', phone: '010-2222-3333' } };
    window.fetch = mk(true);
    await contractSend(b, 500000);
    return {
      actions: window.__calls.map(c => c.action),
      idem: window.__calls.some(c => c.action === 'quickSend' && !!c.idem),
      tokenInBody: window.__calls.some(c => c.action === 'quickSend' && c.adminToken === 'tk'),
      link, modalText,
      offStatus: a.contractLog[0].status, onStatus: b.contractLog[0].status
    };
  }, WEBAPP);
  assert(honesty.actions.indexOf('quickSend') >= 0, 'quickSend 를 부르지 않음: ' + honesty.actions.join(','));
  assert(honesty.tokenInBody, '관리자 토큰이 본문에 실리지 않음');
  assert(honesty.idem, '멱등성 키가 없음 — 재시도하면 계약이 두 건 생긴다');
  assert(honesty.link === WEBAPP + '?page=sign&t=RAW', '서명 링크는 서버가 준 signUrl 그대로여야 함: ' + honesty.link);
  assert(/지금만 볼 수 있습니다/.test(honesty.modalText), '링크를 다시 못 본다는 안내가 없음');
  assert(honesty.offStatus === 'LINK_CREATED', '발송 안 됐는데 SENT 로 기록함: ' + honesty.offStatus);
  assert(honesty.onStatus === 'SENT', 'notify.sent=true 인데 SENT 로 기록하지 않음: ' + honesty.onStatus);

  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 종료된 Fly 주소 소스에 없음');
  console.log('PASS  ② 잠긴 상태 — 네트워크 요청 0 · 발송 이력 0');
  console.log('PASS  ③ 주소 입력칸·자가진단 버튼은 열려 있음');
  console.log('PASS  ④ 단일 엔드포인트 · text/plain · 커스텀 헤더 없음');
  console.log('PASS  ⑤ ok:false 는 HTTP 200 이어도 실패');
  console.log('PASS  ⑥ 자가진단 실패는 잠김 유지 · 통과해야 열림');
  console.log('PASS  ⑦ 주소 변경 시 예전 자가진단 무효화');
  console.log('PASS  ⑧ notify.sent=true 일 때만 SENT');
  console.log('PASS  ⑨ pageerror 0');
  console.log('\n전부 통과 (9건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

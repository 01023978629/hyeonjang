/* claude-inbox.e2e.js — 클로드 요청함: 대화에서 만든 작업을 앱이 승인 후 적용

   배경: 대표가 "클로드를 통하여 작업할 수 있게 해달라"고 했다.
   클로드가 서버 데이터 파일(현장데이터.json)을 직접 고치면 앱의 revision
   충돌 방지를 우회해 폰이 저장할 때 한쪽이 통째로 덮어써진다. 그래서
   클로드는 **별도 요청 파일만** 두고, 적용은 앱이 aiToolRun 으로 한다 —
   기존 검증과 승인 게이트를 그대로 통과한다.

     ① 중계 미연결이면 아무 요청도 안 하고 이유를 말한다
     ② 요청 파일을 읽어 사람 말 라벨로 보여 준다
     ③ [승인]해야 장부에 들어간다 — 열기만 해서는 안 바뀐다
     ④ 같은 요청을 두 번 적용하지 않는다 (claudeDone) ← 돈이 두 번 들어가면 안 된다
     ⑤ 모르는 도구·형식 오류는 실행하지 않고 건너뛴다 (임의 실행 금지)
     ⑥ 도구 자체의 검증은 그대로 작동한다 (음수 금액 거부)
     ⑦ claudeDone 이 직렬화에 실려 기기끼리 공유된다
     ⑧ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

// 요청 파일 내용을 base64 로 (앱은 relay download 의 dataB64 를 읽는다)
const REQ = {
  requests: [
    { id: 'r1', tool: 'apt_order_add', args: { complex: '선비마을3단지', unit: '315동 1401호', work: '배관 교체', amount: 150000 }, why: '대화에서 보고하신 건' },
    { id: 'r2', tool: 'apt_order_add', args: { complex: '선비마을3단지', unit: '210동 502호', work: '수전 교체' }, why: '금액 미정' },
    { id: 'bad1', tool: 'rm_rf_everything', args: {}, why: '없는 도구' },
    { id: '', tool: 'apt_order_add', args: {}, why: 'id 없음' },
    { id: 'neg1', tool: 'apt_order_add', args: { complex: '선비마을3단지', unit: '1동 1호', work: 'x', amount: -50000 }, why: '음수' }
  ]
};

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '선비마을3단지', manager: '', phone: '' }];
    state.aptOrders = [];
    state.claudeDone = [];
    __relay.url = ''; __relay.token = '';   // ① 미연결 상태로 시작
  });

  // ① 미연결 — 요청 자체를 안 보낸다
  const off = await page.evaluate(async () => {
    window.__calls = [];
    window.relayCall = async (a) => { window.__calls.push(a); return { ok: true }; };
    const r = await claudeInboxFetch();
    return { ok: r.ok, err: r.error || '', calls: window.__calls.length };
  });
  assert(off.ok === false && /설정|중계/.test(off.err), '① 미연결인데 이유를 안 알려준다: ' + off.err);
  assert(off.calls === 0, '① 미연결인데 서버로 요청을 보냈다');

  // 중계 연결 + 가짜 relayCall (실제 통신 없음)
  await page.evaluate((reqJson) => {
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST/exec';
    __relay.token = 'TEST-RELAY-TOKEN';
    const b64 = btoa(unescape(encodeURIComponent(reqJson)));
    window.__dl = b64;
    window.relayCall = async (action, payload) => {
      if (action === 'listFiles') return { ok: true, files: [{ id: 'FILEID1234567890', name: '클로드_요청함.json', mimeType: 'application/json', modifiedAt: '2026-08-05T10:00:00Z' }] };
      if (action === 'download') return { ok: true, fileId: payload.fileId, name: '클로드_요청함.json', dataB64: window.__dl };
      return { ok: true };
    };
  }, JSON.stringify(REQ));

  // ②⑤ 읽기 — 정상 2건만, 형식 오류/모르는 도구는 제외
  const fetched = await page.evaluate(async () => {
    const r = await claudeInboxFetch();
    return { n: r.requests.length, ids: r.requests.map(x => x.id), bad: r.bad.length, total: r.total };
  });
  assert(fetched.total === 5, '② 요청 파일을 다 못 읽었다: ' + fetched.total);
  assert(fetched.n === 3 && fetched.ids.join(',') === 'r1,r2,neg1',
    '⑤ 형식 오류·모르는 도구가 걸러지지 않았다: ' + JSON.stringify(fetched.ids));
  assert(fetched.bad === 2, '⑤ 걸러낸 사유가 기록되지 않는다: ' + fetched.bad);

  // ③ 열기만 해서는 장부가 안 바뀐다
  const opened = await page.evaluate(async () => {
    await claudeInboxView();
    await new Promise(r => setTimeout(r, 200));
    const root = document.getElementById('modalRoot');
    return { orders: state.aptOrders.length, btns: root.querySelectorAll('.clai').length, txt: (root.textContent || '') };
  });
  assert(opened.orders === 0, '③ 열기만 했는데 장부에 들어갔다 — 승인 게이트가 없다');
  assert(opened.btns === 3, '③ 승인 버튼 수가 안 맞다: ' + opened.btns);
  assert(/배관 교체/.test(opened.txt) && /선비마을3단지/.test(opened.txt), '② 사람 말 라벨이 아니다');
  assert(!/rm_rf_everything/.test(opened.txt), '⑤ 모르는 도구가 화면에 뜬다');

  // ③-2 승인하면 들어간다
  const applied = await page.evaluate(async () => {
    document.getElementById('modalRoot').querySelectorAll('.clai')[0].click();
    await new Promise(r => setTimeout(r, 600));
    const o = state.aptOrders.find(x => x.unit === '315동 1401호');
    return { n: state.aptOrders.length, amt: o && o.amount, status: o && o.status, done: (state.claudeDone || []).slice() };
  });
  assert(applied.n === 1 && applied.amt === 150000, '③ 승인했는데 장부에 안 들어간다: ' + JSON.stringify(applied));
  assert(applied.status === 'recv', '③ 상태가 접수가 아니다');
  assert(applied.done.indexOf('r1') >= 0, '④ 처리 표시가 안 남는다');

  // ④ 두 번 적용 금지 — 다시 열어도 r1 은 안 나온다
  const again = await page.evaluate(async () => {
    const r = await claudeInboxFetch();
    return { ids: r.requests.map(x => x.id), orders: state.aptOrders.length };
  });
  assert(again.ids.indexOf('r1') < 0, '④ 이미 적용한 요청이 다시 나온다 — 두 번 들어가면 금액이 겹친다');
  assert(again.orders === 1, '④ 장부가 중복됐다: ' + again.orders);

  // ⑥ 도구 검증은 그대로 — 음수 금액은 거부
  const neg = await page.evaluate(async () => {
    await claudeInboxView();
    await new Promise(r => setTimeout(r, 250));
    const root = document.getElementById('modalRoot');
    const idx = Array.from(root.querySelectorAll('.clai')).length - 1;   // neg1 이 마지막
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; };
    root.querySelectorAll('.clai')[idx].click();
    await new Promise(r => setTimeout(r, 500));
    window.toast = rt;
    return { msg, orders: state.aptOrders.length, done: (state.claudeDone || []).indexOf('neg1') };
  });
  assert(/실패|0 이상/.test(neg.msg), '⑥ 음수 금액이 조용히 통과했다: ' + neg.msg);
  assert(neg.orders === 1, '⑥ 음수 금액 요청이 장부에 들어갔다');
  assert(neg.done < 0, '⑥ 실패했는데 처리 완료로 표시됐다 — 고칠 기회가 사라진다');

  // ⑦ 직렬화 왕복
  const ser = await page.evaluate(() => {
    const d = JSON.parse(JSON.stringify(serializeData()));
    state.claudeDone = [];
    applyData(d);
    return { inSer: Array.isArray(d.claudeDone) && d.claudeDone.indexOf('r1') >= 0, back: (state.claudeDone || []).indexOf('r1') >= 0 };
  });
  assert(ser.inSer, '⑦ claudeDone 이 직렬화에 안 실린다 — 다른 기기에서 또 적용된다');
  assert(ser.back, '⑦ claudeDone 이 복원되지 않는다');

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 중계 미연결 — 요청 0회 + 이유 설명');
  console.log('PASS  ② 요청 파일 읽기 + 사람 말 라벨');
  console.log('PASS  ③ 승인해야 장부에 들어간다');
  console.log('PASS  ④ 같은 요청 두 번 적용 금지');
  console.log('PASS  ⑤ 모르는 도구·형식 오류 차단');
  console.log('PASS  ⑥ 도구 검증(음수 금액) 유지 · 실패는 완료 처리 안 함');
  console.log('PASS  ⑦ claudeDone 직렬화 왕복');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

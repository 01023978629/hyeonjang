/* claude-inbox.e2e.js — 클로드 요청함: 상업 요청은 앱 수동 승인으로 넘김

   배경: 대표가 "클로드를 통하여 작업할 수 있게 해달라"고 했다.
   클로드가 서버 데이터 파일(현장데이터.json)을 직접 고치면 앱의 revision
   충돌 방지를 우회해 폰이 저장할 때 한쪽이 통째로 덮어써진다. 그래서
   클로드는 **별도 요청 파일만** 둔다. 유료 아파트 오더는 링크의 승인
   버튼으로도 쓸 수 없고, 대표가 앱의 상업 승인 화면에서 직접 처리한다.

     ① 중계 미연결이면 아무 요청도 안 하고 이유를 말한다
     ② 요청 파일을 읽어 사람 말 라벨로 보여 준다
     ③ [승인·적용]을 눌러도 상업 요청은 장부에 안 들어가며 정확히 수동 조치를 안내한다
     ④ 상업 요청은 완료 처리하지 않아 다시 시도할 수 있다 (claudeDone 미기록)
     ⑤ 모르는 도구·형식 오류는 실행하지 않고 건너뛴다 (임의 실행 금지)
     ⑥ 다른 상업 요청도 같은 unresolved 정책을 따른다
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
  // 부팅의 IDB 읽기(복원·중계 설정·접수함 설정)가 끝난 뒤에 모의값을 넣는다 — 고정 대기만으로는 늦게 끝난 부팅이 모의값을 덮어쓴다(v251 CI 실패와 같은 종류)
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]));

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
  // 거부 사실은 보여야 하지만(조용한 폐기 금지), 요청자가 준 문자열을 그대로 싣지는 않는다
  assert(!/rm_rf_everything/.test(opened.txt), '⑤ 모르는 도구 이름이 화면에 그대로 찍힌다 — 신뢰 UI 안 스푸핑 표면');
  assert(/거부된 요청/.test(opened.txt), '⑤ 거부 사실이 안 보인다 — 조용히 버려지면 감사 흔적이 없다');

  // ③-2 상업 요청은 버튼을 눌러도 직접 적용하지 않고, 수동 승인으로 넘긴다.
  const applied = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 700));   // 오탭 방지 잠금이 풀릴 때까지
    let msg='';const oldToast=window.toast;window.toast=m=>{msg=String(m||'');};
    const btn=document.getElementById('modalRoot').querySelectorAll('.clai')[0];
    btn.click();
    await new Promise(r => setTimeout(r, 600));
    window.toast=oldToast;
    const o = state.aptOrders.find(x => x.unit === '315동 1401호');
    return { n: state.aptOrders.length, found:!!o, done: (state.claudeDone || []).slice(),
      msg,disabled:btn.disabled,text:btn.textContent };
  });
  assert(applied.n === 0 && !applied.found, '③ 클로드 상업 요청이 장부에 직접 들어갔다: ' + JSON.stringify(applied));
  assert(applied.msg === '상업 승인 필요 — 아파트 오더 화면에서 대표가 직접 등록하세요',
    '③ 수동 조치 안내가 정확하지 않다: '+applied.msg);
  assert(!applied.disabled && /승인·적용/.test(applied.text), '③ unresolved 요청의 재시도 버튼이 복구되지 않았다');
  assert(applied.done.indexOf('r1') < 0, '④ unresolved 상업 요청이 처리 완료로 표시됐다');

  // ④ unresolved — 다시 읽으면 r1 이 남아 대표가 수동 처리 후 정리할 수 있다.
  const again = await page.evaluate(async () => {
    const r = await claudeInboxFetch();
    return { ids: r.requests.map(x => x.id), orders: state.aptOrders.length };
  });
  assert(again.ids.indexOf('r1') >= 0, '④ unresolved 요청이 사라졌다 — 대표가 다시 처리할 수 없다');
  assert(again.orders === 0, '④ unresolved 재조회 중 장부가 변경됐다: ' + again.orders);

  // ⑥ 다른 상업 요청도 값에 관계없이 같은 수동 승인 경로로 남는다.
  const neg = await page.evaluate(async () => {
    await claudeInboxView();
    await new Promise(r => setTimeout(r, 250));
    const root = document.getElementById('modalRoot');
    await new Promise(r => setTimeout(r, 700));   // 오탭 방지 잠금이 풀릴 때까지
    const idx = Array.from(root.querySelectorAll('.clai')).length - 1;   // neg1 이 마지막
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; };
    root.querySelectorAll('.clai')[idx].click();
    await new Promise(r => setTimeout(r, 500));
    window.toast = rt;
    return { msg, orders: state.aptOrders.length, done: (state.claudeDone || []).indexOf('neg1') };
  });
  assert(neg.msg === '상업 승인 필요 — 아파트 오더 화면에서 대표가 직접 등록하세요',
    '⑥ 상업 요청 안내가 일관되지 않다: ' + neg.msg);
  assert(neg.orders === 0, '⑥ 상업 요청이 장부에 들어갔다');
  assert(neg.done < 0, '⑥ 실패했는데 처리 완료로 표시됐다 — 고칠 기회가 사라진다');

  // ⑦ 완료된 비상업 요청 이력의 기존 직렬화 호환은 유지한다.
  const ser = await page.evaluate(() => {
    state.claudeDone = ['historic-noncommercial'];
    const d = JSON.parse(JSON.stringify(serializeData()));
    state.claudeDone = [];
    applyData(d);
    return { inSer: Array.isArray(d.claudeDone) && d.claudeDone.indexOf('historic-noncommercial') >= 0,
      back: (state.claudeDone || []).indexOf('historic-noncommercial') >= 0,
      unresolvedAbsent:(state.claudeDone||[]).indexOf('r1')<0 };
  });
  assert(ser.inSer, '⑦ claudeDone 이 직렬화에 안 실린다 — 다른 기기에서 또 적용된다');
  assert(ser.back, '⑦ claudeDone 이 복원되지 않는다');
  assert(ser.unresolvedAbsent, '⑦ unresolved 상업 요청이 직렬화 완료 목록에 섞였다');

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 중계 미연결 — 요청 0회 + 이유 설명');
  console.log('PASS  ② 요청 파일 읽기 + 사람 말 라벨');
  console.log('PASS  ③ 상업 요청은 장부 무변경 + 정확한 수동 조치 안내');
  console.log('PASS  ④ unresolved 요청은 claudeDone 미기록 + 재시도 가능');
  console.log('PASS  ⑤ 모르는 도구·형식 오류 차단');
  console.log('PASS  ⑥ 상업 요청 unresolved 정책 일관성');
  console.log('PASS  ⑦ claudeDone 직렬화 왕복');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

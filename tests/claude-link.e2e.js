/* claude-link.e2e.js — 클로드가 준 링크·코드로 앱에 작업 요청

   배경: 대표가 "여기서 작업 지시를 해서 앱에 적용되면 된다"고 했다.
   드라이브 요청함은 폴더 공유가 선행돼야 하는데 계정이 갈려 있어 막혔다.
   그래서 링크(?hjreq=) 와 붙여넣기로도 같은 요청을 받게 한다.
   **승인 게이트·중복 방지·도구 허용목록은 드라이브 경로와 동일해야 한다.**

     ① base64url 링크를 풀어 요청을 읽는다 (한글 깨지지 않음)
     ② 원문 JSON·전체 URL 도 받는다
     ③ 깨진 코드는 이유를 말하고 아무것도 안 한다
     ④ 링크로 와도 승인해야 적용된다 (열기만으로 안 바뀜)
     ⑤ 이미 처리한 요청은 링크로 다시 와도 안 나온다 (중복 적용 금지)
     ⑥ 모르는 도구는 링크로 와도 실행되지 않는다
     ⑦ 주소창의 hjreq 는 즉시 지워진다 (새로고침 재적용 방지)
     ⑧ 출처가 링크임을 화면에 밝힌다
     ⑨ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const mk = (reqs) => Buffer.from(JSON.stringify({ requests: reqs }), 'utf8')
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const OK1 = [{ id: 'L1', tool: 'apt_order_add', args: { complex: '선비마을3단지', unit: '315동 1401호', work: '배관 교체', amount: 150000 }, why: '대화에서 지시하신 건' }];
const BADTOOL = [{ id: 'L9', tool: 'wipe_everything', args: {}, why: '위험' }];

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));

  // ⑦ 링크로 진입 — 주소가 지워지고 요청함이 열린다
  await page.goto(APP + '?hjreq=' + mk(OK1), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    state.aptOffices = [{ id: 'of1', complex: '선비마을3단지', manager: '', phone: '' }];
    state.aptOrders = []; state.claudeDone = [];
  });
  const url = await page.evaluate(() => location.search);
  assert(!/hjreq/.test(url), '⑦ 주소에 hjreq 가 남아 있다 — 새로고침마다 같은 요청이 다시 뜬다: ' + url);

  // ①④⑧ 링크 요청이 뜨고, 열기만으로는 안 들어간다
  const shown = await page.evaluate(async () => {
    const d = claudeReqDecode(new URLSearchParams('hjreq=' + window.__t).get('hjreq'));
    return d;
  }, {}).catch(() => null);

  const view = await page.evaluate(async (b64) => {
    const d = claudeReqDecode(b64);
    await claudeInboxView(d);
    await new Promise(r => setTimeout(r, 250));
    const root = document.getElementById('modalRoot');
    return { ok: d.ok, n: d.requests.length, orders: state.aptOrders.length,
             txt: root.textContent || '', btns: root.querySelectorAll('.clai').length };
  }, mk(OK1));
  assert(view.ok && view.n === 1, '① 링크를 못 푼다');
  assert(/배관 교체/.test(view.txt) && /315동 1401호/.test(view.txt), '① 한글이 깨졌다');
  assert(view.orders === 0, '④ 열기만 했는데 장부에 들어갔다');
  assert(/링크로 받은/.test(view.txt), '⑧ 출처가 링크임을 안 밝힌다');

  // ④-2 승인하면 들어간다
  const applied = await page.evaluate(async () => {
    document.getElementById('modalRoot').querySelectorAll('.clai')[0].click();
    await new Promise(r => setTimeout(r, 600));
    const o = state.aptOrders.find(x => x.unit === '315동 1401호');
    return { n: state.aptOrders.length, amt: o && o.amount, done: (state.claudeDone || []).indexOf('L1') };
  });
  assert(applied.n === 1 && applied.amt === 150000, '④ 승인했는데 안 들어간다: ' + JSON.stringify(applied));
  assert(applied.done >= 0, '⑤ 처리 표시가 안 남는다');

  // ⑤ 같은 링크 재사용 — 요청이 비어야 한다
  const again = await page.evaluate((b64) => {
    const d = claudeReqDecode(b64);
    return { n: d.requests.length, orders: state.aptOrders.length };
  }, mk(OK1));
  assert(again.n === 0, '⑤ 같은 링크로 또 적용된다 — 금액이 두 번 들어간다');
  assert(again.orders === 1, '⑤ 장부가 중복됐다');

  // ② 원문 JSON · 전체 URL 형태
  const forms = await page.evaluate((b64) => {
    const raw = JSON.stringify({ requests: [{ id: 'L2', tool: 'apt_orders', args: {}, why: '조회' }] });
    return {
      json: claudeReqDecode(raw).ok,
      full: claudeReqDecode('https://01023978629.github.io/hyeonjang/?hjreq=' + b64 + '&x=1').ok
    };
  }, mk([{ id: 'L3', tool: 'apt_orders', args: {}, why: '조회' }]));
  assert(forms.json, '② 원문 JSON 을 못 받는다');
  assert(forms.full, '② 전체 URL 을 못 받는다');

  // ③ 깨진 코드
  const bad = await page.evaluate(() => ({
    junk: claudeReqDecode('!!!not-base64!!!'),
    empty: claudeReqDecode(''),
    noreq: claudeReqDecode(JSON.stringify({ hello: 1 }))
  }));
  assert(!bad.junk.ok && bad.junk.error, '③ 깨진 코드에 이유가 없다');
  assert(!bad.empty.ok && !bad.noreq.ok, '③ 빈 값·요청 없음을 안 막는다');

  // ⑥ 모르는 도구는 링크로도 안 통한다
  const bt = await page.evaluate((b64) => {
    const d = claudeReqDecode(b64);
    return { n: d.requests.length, bad: d.bad.length, total: d.total };
  }, mk(BADTOOL));
  assert(bt.total === 1 && bt.n === 0 && bt.bad === 1,
    '⑥ 모르는 도구가 링크로 들어온다 — 임의 실행 통로가 된다: ' + JSON.stringify(bt));

  // ⑥-2 삭제·고객 발송은 링크로 절대 못 온다.
  // 링크는 누구나 만들어 카톡으로 보낼 수 있다 — 승인 한 번 잘못 눌러 현장이
  // 지워지거나 고객에게 문자가 나가면 되돌릴 수 없다.
  const deny = await page.evaluate(() => {
    const names = ['delete_project', 'delete_schedule', 'send_receipt', 'send_settle_doc', 'batch_receive'];
    const out = {};
    names.forEach((n, i) => {
      const raw = JSON.stringify({ requests: [{ id: 'D' + i, tool: n, args: {}, why: '위장' }] });
      const d = claudeReqDecode(raw);
      out[n] = { pass: d.requests.length, blocked: d.bad.length === 1 };
    });
    // 모두 AI_TOOLS 에는 실제로 있어야 의미 있는 검사다(오타로 통과한 게 아님)
    out._inTools = names.every(n => AI_TOOLS.some(t => t.name === n));
    return out;
  });
  assert(deny._inTools, '⑥-2 검사 대상 도구가 AI_TOOLS 에 없다 — 검사가 무의미하다');
  ['delete_project', 'delete_schedule', 'send_receipt', 'send_settle_doc', 'batch_receive'].forEach(n => {
    assert(deny[n].pass === 0 && deny[n].blocked,
      '⑥-2 ' + n + ' 이 링크로 실행 가능하다 — 되돌릴 수 없는 사고가 난다');
  });

  assert(errors.length === 0, '⑨ pageerror: ' + errors.join(' | '));
  void shown;

  console.log('PASS  ① base64url 링크 해독 (한글 보존)');
  console.log('PASS  ② 원문 JSON · 전체 URL 수용');
  console.log('PASS  ③ 깨진 코드는 이유 설명 후 중단');
  console.log('PASS  ④ 링크로 와도 승인해야 적용');
  console.log('PASS  ⑤ 같은 링크 재사용 시 중복 적용 없음');
  console.log('PASS  ⑥ 모르는 도구 차단 + 삭제·고객 발송 도구 차단');
  console.log('PASS  ⑦ 주소창 hjreq 즉시 제거');
  console.log('PASS  ⑧ 출처(링크) 표시');
  console.log('PASS  ⑨ pageerror 0');
  console.log('\n전부 통과 (9건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

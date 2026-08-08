/* app-version.e2e.js — 폰이 최신 버전인지 화면에서 확인

   배경: 사장님이 "새로 고쳐도 안 바뀐다" 고 할 때, 지금 폰에 무엇이 들어
   있는지 확인할 방법이 없었다. 푸터에 build 글씨가 있긴 했지만
   ① 앱 전체를 끝까지 굴려야 나오고 ② 그게 최신인지 말해 주지 않고
   ③ 무엇보다 **틀린 값**이었다(v183 을 쓰는 폰이 '2026-07-30' 을 띄웠다).
   틀린 번호는 없는 번호보다 나쁘다 — 그 답을 믿고 엉뚱한 데를 판다.

     ① APP_BUILD 가 sw.js 캐시 이름과 같다 (version-sync.check 와 짝)
     ② 설정을 열면 탭 밖에 버전 줄이 있고, 열자마자 스스로 확인한다
     ③ 서버가 같은 번호면 "최신입니다"
     ④ 서버가 더 새 번호면 경고 + 버튼이 [지금 받기] 로 바뀐다
     ⑤ 화면·서버는 같은데 캐시만 옛것이면 그것도 잡는다 (반쯤 적용된 상태)
     ⑥ 오프라인이면 캐시를 지우지 않는다 ← 지우면 받아올 데가 없어 앱이 안 열린다
     ⑦ 서버 확인 실패를 "최신"으로 말하지 않는다
     ⑧ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  // ① 소스 대조 — 화면에 찍히는 값과 캐시 이름이 같은 값이어야 한다
  const root = path.join(__dirname, '..');
  const swVer = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const\s+C\s*=\s*'([^']+)'/)[1];
  const appVer = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const\s+APP_BUILD\s*=\s*'([^']+)'/)[1];
  assert(swVer === appVer, '① 화면 버전과 캐시 버전이 다르다: ' + appVer + ' vs ' + swVer);

  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  // caches 는 http(localhost)에서도 쓸 수 있지만, 테스트가 브라우저 실제
  // 캐시에 기대면 순서에 따라 흔들린다. 읽는 쪽만 가짜로 바꿔 고정한다.
  const stub = async (cacheKeys, serverVer, online) => page.evaluate(([ks, sv, on]) => {
    // caches 는 읽기 전용 접근자라 window.caches = ... 는 조용히 무시된다.
    // (그걸 모르고 대입만 하면 스텁이 안 먹은 채 테스트가 통과해 버린다)
    Object.defineProperty(window, 'caches', { configurable: true, value: {
      keys: async () => ks.slice(),
      delete: async (k) => { window.__deleted = (window.__deleted || []); window.__deleted.push(k); return true; }
    } });
    Object.defineProperty(navigator, 'onLine', { get: () => on, configurable: true });
    window.__deleted = [];
    window.fetch = async (u) => {
      if (String(u).indexOf('sw.js') >= 0) {
        if (sv === null) throw new Error('offline');
        return { ok: true, status: 200, text: async () => "const C='" + sv + "';" };
      }
      return { ok: true, status: 200, text: async () => '' };
    };
  }, [cacheKeys, serverVer, online]);

  const shell = await page.evaluate(() => APP_BUILD);
  assert(shell === swVer, '① 실행 중인 앱이 말하는 버전이 소스와 다르다: ' + shell);

  // ②③ 설정 열기 — 탭 밖에 버전 줄, 열자마자 확인, 같은 번호면 "최신"
  await stub([shell], shell, true);
  const fresh = await page.evaluate(async () => {
    openGdriveSetup();
    await new Promise(r => setTimeout(r, 600));
    const r0 = document.getElementById('modalRoot');
    const bar = r0.querySelector('#appVerBar');
    const panels = [...r0.querySelectorAll('[role="tabpanel"]')];
    return {
      has: !!bar,
      inTab: panels.some(p => p.contains(bar)),
      now: (r0.querySelector('#appVerNow') || {}).textContent || '',
      msg: (r0.querySelector('#appVerMsg') || {}).textContent || '',
      btn: (r0.querySelector('#appVerBtn') || {}).textContent || ''
    };
  });
  assert(fresh.has, '② 설정에 버전 줄이 없다 — 원격으로 물어볼 곳이 없다');
  assert(!fresh.inTab, '② 버전 줄이 탭 안에 있다 — 다른 탭을 보고 있으면 안 보인다');
  assert(fresh.now === shell.replace(/^hyeonjang-/, ''), '② 버전 숫자가 안 찍힌다: ' + fresh.now);
  assert(/최신/.test(fresh.msg), '③ 같은 번호인데 "최신"이 아니다: ' + fresh.msg);
  assert(!/받기/.test(fresh.btn), '③ 최신인데 [지금 받기] 가 떠 있다: ' + fresh.btn);

  // ④ 서버가 더 새 번호 — 경고 + [지금 받기]
  await stub([shell], 'hyeonjang-v999-newer', true);
  const stale = await page.evaluate(async () => {
    document.getElementById('appVerBtn').click();
    await new Promise(r => setTimeout(r, 500));
    const m = document.getElementById('appVerMsg');
    return { msg: m.textContent || '', color: m.style.color, btn: document.getElementById('appVerBtn').textContent || '' };
  });
  assert(/v999-newer/.test(stale.msg), '④ 새 버전이 있는데 안 알린다: ' + stale.msg);
  assert(/받기/.test(stale.btn), '④ 버튼이 [지금 받기] 로 안 바뀐다: ' + stale.btn);
  assert(/warn/.test(stale.color), '④ 경고 색이 아니다: ' + stale.color);

  // ⑥ 오프라인이면 캐시를 지우지 않는다 — 지우면 받아올 데가 없어 앱이 안 열린다
  await stub([shell], null, false);
  const offline = await page.evaluate(async () => {
    let msg = ''; const rt = window.toast; window.toast = m => { msg = m; };
    const r = await appVersionUpdate();
    window.toast = rt;
    return { r, msg, deleted: (window.__deleted || []).length, reloaded: location.href };
  });
  assert(offline.r === false, '⑥ 오프라인인데 갱신을 진행했다');
  assert(offline.deleted === 0, '⑥ 오프라인인데 캐시를 지웠다 — 앱이 안 열리게 된다');
  assert(/오프라인/.test(offline.msg), '⑥ 오프라인 사유를 안 알려준다: ' + offline.msg);

  // ⑦ 서버 확인 실패를 "최신"으로 말하지 않는다
  await stub([shell], null, true);
  const noserver = await page.evaluate(async () => {
    document.getElementById('appVerBtn').click();
    await new Promise(r => setTimeout(r, 500));
    let msg2 = ''; const rt = window.toast; window.toast = m => { msg2 = m; };
    const r = await appVersionUpdate();
    window.toast = rt;
    return { msg: document.getElementById('appVerMsg').textContent || '', r, msg2, deleted: (window.__deleted || []).length };
  });
  assert(!/최신입니다/.test(noserver.msg), '⑦ 확인 못 했는데 "최신입니다" 라고 한다: ' + noserver.msg);
  assert(/실패/.test(noserver.msg), '⑦ 실패 사실을 안 알린다: ' + noserver.msg);
  assert(noserver.r === false && noserver.deleted === 0, '⑦ 서버 확인 실패인데 캐시를 지웠다');

  // ⑤ 화면·서버는 같은데 캐시만 옛것 — 반쯤 적용된 상태도 잡는다
  await stub(['hyeonjang-v1-old'], shell, true);
  const halfway = await page.evaluate(async () => {
    document.getElementById('appVerBtn').click();
    await new Promise(r => setTimeout(r, 500));
    return { msg: document.getElementById('appVerMsg').textContent || '', btn: document.getElementById('appVerBtn').textContent || '' };
  });
  assert(/v1-old/.test(halfway.msg) && !/^최신입니다$/.test(halfway.msg),
    '⑤ 캐시만 옛 버전인 상태를 "최신"으로 넘긴다: ' + halfway.msg);
  assert(/받기/.test(halfway.btn), '⑤ 맞출 방법(버튼)이 없다: ' + halfway.btn);

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① APP_BUILD == sw.js 캐시 이름 (' + shell + ')');
  console.log('PASS  ② 설정 탭 밖에 버전 줄 + 열자마자 자동 확인');
  console.log('PASS  ③ 같은 번호면 "최신입니다"');
  console.log('PASS  ④ 새 버전이면 경고 + [지금 받기]');
  console.log('PASS  ⑤ 캐시만 옛 버전인 반쪽 상태도 잡는다');
  console.log('PASS  ⑥ 오프라인이면 캐시를 안 지운다');
  console.log('PASS  ⑦ 확인 실패를 "최신"으로 말하지 않는다');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

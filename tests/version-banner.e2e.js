/* version-banner.e2e.js — 새 버전 자동 안내 (Playwright)

   2026-09-04 v255: 옛 버전을 쓰는 사람은 자기가 옛 버전인 걸 모른다. 설정 창을 열어야만 확인되던 버전을
   앱을 켤 때·다시 볼 때 서버 sw.js 번호로 확인해 위에 한 줄 배너로 알린다.

     ① 서버 sw.js 가 더 새 번호면 부팅 뒤 배너(#hjVerNew)가 뜨고 새 번호·현재 번호·「지금 새로고침」·「나중에」가 있다
     ② 「지금 새로고침」(v260): 폰(폴더 없음)은 예약된 IDB 저장을 끝낸 뒤 appVersionUpdate, 저장 실패·throw 면 이유와 함께 막고 버튼 복구,
        폴더 연결 PC 의 밀린 파일 저장은 예전처럼 막는다 — v255 규칙(state.dirty 면 무조건 차단)은 폰에서 영원히 막혔다
     ③ 서버와 같은 번호면 배너가 없다
     ④ 6시간 안에 확인한 적이 있으면 다시 확인하지 않는다(서버가 새 번호여도 배너 없음, 요청도 없음)
     ⑤ 오프라인이면 확인하지 않고 확인 시각도 남기지 않는다
     ⑥ 앱을 다시 볼 때(visibilitychange) 6시간이 지났으면 다시 확인해 배너를 띄운다
     ⑦ 「나중에」로 닫으면 같은 번호로는 다시 띄우지 않는다
     ⑧ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];
  const open = async (opts) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(9000);
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('https://**/*', route => route.abort());
    page.__swHits = 0;
    await page.route(/\/sw\.js\?v=/, route => { page.__swHits++; if (opts.server) route.fulfill({ status: 200, contentType: 'application/javascript', body: "const C='" + opts.server + "';" }); else route.continue(); });
    await page.addInitScript((o) => {
      try { localStorage.setItem('hj_onboard_done', '1'); if (o.checkedAt !== undefined) localStorage.setItem('hj_ver_checked_at', String(o.checkedAt)); else localStorage.removeItem('hj_ver_checked_at'); } catch (e) {}
      if (o.offline) Object.defineProperty(navigator, 'onLine', { get: () => false });
    }, opts);
    await page.goto(APP, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__hjRestoreDone);
    return page;
  };
  const banner = (page) => page.evaluate(() => { const b = document.getElementById('hjVerNew'); return b ? { msg: (document.getElementById('hjVerNewMsg') || {}).textContent, go: !!document.getElementById('hjVerNewGo'), later: !!document.getElementById('hjVerNewLater'), visible: b.getBoundingClientRect().height > 0 } : null; });

  // ① 새 버전 → 배너
  const p1 = await open({ server: 'hyeonjang-v999-future' });
  await p1.waitForSelector('#hjVerNew', { timeout: 9000 });
  const b1 = await banner(p1);
  assert(b1 && /새 버전 v999-future/.test(b1.msg) && /지금 v\d+/.test(b1.msg) && b1.go && b1.later && b1.visible, '① 배너 내용: ' + JSON.stringify(b1));
  const stamped = await p1.evaluate(() => +localStorage.getItem('hj_ver_checked_at') > Date.now() - 60000);
  assert(stamped, '① 확인 시각을 남긴다');

  // ② 새로고침 전 저장 규칙 (v260): 폰(폴더 없음)은 dirty 여도 예약된 IDB 저장을 지금 끝내고 새로고침한다 —
  //    v255 는 state.dirty 만 보고 막았는데 폰에서는 clearDirty 가 불릴 일이 없어 한 번 편집하면 영원히 막혔다.
  //    저장이 실패하면(false/throw) 막고 이유를 말한다. 폴더가 연결된 PC 는 파일 저장이 밀렸으면 예전처럼 막는다.
  const guard = await p1.evaluate(async () => {
    window.__upd = 0; window.__flush = 0; appVersionUpdate = async () => { window.__upd++; return true; };
    const go = () => new Promise(r => { document.getElementById('hjVerNewGo').click(); setTimeout(r, 80); });
    const btn = () => document.getElementById('hjVerNewGo');
    guardedPersistCurrentState = async () => { window.__flush++; return true; };
    state.dirHandle = null; state.dirty = true; await go();
    const phone = { upd: window.__upd, flush: window.__flush };
    btn().disabled = false;
    guardedPersistCurrentState = async () => { window.__flush++; return false; };
    await go();
    const failed = { upd: window.__upd, flush: window.__flush, toast: document.querySelector('#toast').textContent, enabled: !btn().disabled };
    guardedPersistCurrentState = async () => { window.__flush++; throw new Error('stale appState conflict'); };
    await go();
    const threw = { upd: window.__upd, toast: document.querySelector('#toast').textContent, enabled: !btn().disabled };
    guardedPersistCurrentState = async () => { window.__flush++; return true; };
    state.dirHandle = {}; state.dirty = true; await go();
    const pc = { upd: window.__upd, flush: window.__flush, toast: document.querySelector('#toast').textContent };
    state.dirHandle = null; state.dirty = false;
    return { phone, failed, threw, pc };
  });
  assert(guard.phone.upd === 1 && guard.phone.flush === 1, '② 폰: dirty 여도 저장을 끝낸(flush 1) 뒤 새로고침(upd 1): ' + JSON.stringify(guard.phone));
  assert(guard.failed.upd === 1 && guard.failed.flush === 2 && /저장이 끝나지 않아/.test(guard.failed.toast) && guard.failed.enabled, '② 저장 실패(false)면 막고 버튼을 되살린다: ' + JSON.stringify(guard.failed));
  assert(guard.threw.upd === 1 && /저장이 끝나지 않아/.test(guard.threw.toast) && /stale/.test(guard.threw.toast) && guard.threw.enabled, '② 저장이 throw 하면 이유와 함께 막는다: ' + JSON.stringify(guard.threw));
  assert(guard.pc.upd === 1 && guard.pc.flush === 3 && /폴더에 저장/.test(guard.pc.toast), '② 폴더 연결 PC 의 밀린 파일 저장은 예전처럼 막는다(flush 안 함): ' + JSON.stringify(guard.pc));
  await p1.close();

  // ③ 같은 번호 → 배너 없음
  const p3 = await open({});
  await p3.waitForTimeout(3300);
  // 확인 시각은 서버 응답을 받은 뒤에만 남는다 — 2.5초 타이머+캐시 조회+응답이 느린 러너에서 3.3초를 넘겨도 기다린다
  await p3.waitForFunction(() => !!localStorage.getItem('hj_ver_checked_at'), null, { timeout: 9000 }).catch(() => {});
  assert(await banner(p3) === null && p3.__swHits >= 1, '③ 같은 번호면 배너 없음(확인은 했다): hits=' + p3.__swHits);
  await p3.close();

  // ④ 6시간 안에 확인했으면 요청도 배너도 없다
  const p4 = await open({ server: 'hyeonjang-v999-future', checkedAt: Date.now() - 60 * 60 * 1000 });
  await p4.waitForTimeout(3300);
  await p4.evaluate(() => appVersionAutoCheck());   // 부팅 타이머가 아직 안 돌았어도 6시간 규칙을 직접 한 번 더 태운다
  assert(await banner(p4) === null && p4.__swHits === 0, '④ 6시간 안 재확인 없음: hits=' + p4.__swHits);

  // ⑥ 다시 볼 때 6시간이 지났으면 확인한다
  await p4.evaluate(() => {
    localStorage.setItem('hj_ver_checked_at', String(Date.now() - 7 * 60 * 60 * 1000));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p4.waitForSelector('#hjVerNew', { timeout: 9000 }).catch(() => {});   // 캐시 조회·sw.js 응답·배너 삽입까지 기다린다
  const shown = await p4.evaluate(() => !!document.getElementById('hjVerNew'));
  assert(shown && p4.__swHits === 1, '⑥ 다시 볼 때 6시간 지났으면 확인·배너: shown=' + shown + ' hits=' + p4.__swHits);

  // ⑦ 「나중에」 → 같은 번호로 다시 안 띄운다
  const again = await p4.evaluate(async () => {
    document.getElementById('hjVerNewLater').click();
    const gone = !document.getElementById('hjVerNew');
    localStorage.setItem('hj_ver_checked_at', String(Date.now() - 7 * 60 * 60 * 1000));
    await appVersionAutoCheck();
    return { gone, back: !!document.getElementById('hjVerNew') };
  });
  assert(again.gone && !again.back, '⑦ 나중에 → 같은 번호로 재표시 없음: ' + JSON.stringify(again));
  await p4.close();

  // ⑤ 오프라인 → 확인 안 함, 시각 안 남김
  const p5 = await open({ server: 'hyeonjang-v999-future', offline: true });
  await p5.waitForTimeout(3300);
  await p5.evaluate(() => appVersionAutoCheck());   // 오프라인 규칙도 직접 한 번 더 태운다
  const off = await p5.evaluate(() => ({ banner: !!document.getElementById('hjVerNew'), stamp: localStorage.getItem('hj_ver_checked_at') }));
  assert(!off.banner && off.stamp === null && p5.__swHits === 0, '⑤ 오프라인이면 확인·기록 없음: ' + JSON.stringify(off) + ' hits=' + p5.__swHits);
  await p5.close();

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));
  console.log('PASS  version-banner: 새 버전 배너·저장 가드·같은 번호 무표시·6시간 절제·오프라인 무확인·다시 볼 때 확인·나중에');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

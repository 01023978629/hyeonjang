/* multi-tab-guard.e2e.js — 다중 탭 마지막-저장-승리 방지 (Playwright)

   보호하는 사고: 같은 자료를 두 탭에서 열면 로컬 자동저장(IndexedDB appState)이
   서로를 덮어써서 한쪽 작업이 소리 없이 사라졌다(종합평가 무결성 결함).
   가드는 두 겹: ① 쓰기 전 savedAt 대조(뒤처진 탭은 덮지 않고 경고)
                ② BroadcastChannel 로 이중 탭 경고 + 저장 방송.

     ① 정상 저장: markDirty → idb appState 의 savedAt 이 전진한다
     ② 두 번째 탭이 열리면 양쪽 다 "다른 탭" 경고를 받는다
     ③ 탭2가 저장하면 탭1이 방송으로 뒤처짐을 안다(조용히) — 경고는 실제
        저장이 막히는 순간에만 뜬다(다른 안내 토스트를 덮지 않기 위해)
     ④ 뒤처진 탭은 자동저장으로도 pagehide(탭 닫힘)로도 덮지 않는다
     ⑤ 방송 없는 외부 저장(다른 기기 동기화 등)도 쓰기 전 대조가 차단한다
     ⑥ pageerror 0 (모든 탭)

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

async function boot(ctx, errors) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(9000);
  p.on('pageerror', e => errors.push(String(e)));
  await p.route('https://**/*', route => route.abort());
  await p.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    window.__toasts = [];
    const orig = window.toast;
    window.toast = (t) => { window.__toasts.push(String(t)); try { orig(t); } catch (e) {} };
  });
  return p;
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  const errors = [];
  const p1 = await boot(ctx, errors);

  // ① 정상 저장 — savedAt 전진
  const first = await p1.evaluate(async () => {
    state.notes = [{ id: 'n1', text: '탭1 메모' }];
    const stampBefore = __tabStamp; markDirty();
    // 저장은 0.8초 디바운스 뒤 잠금·IDB 왕복 — 스탬프가 바뀔 때까지 기다린다(최대 +5초)
    await new Promise(r => setTimeout(r, 900));
    for (let i = 0; i < 200 && __tabStamp === stampBefore; i++) await new Promise(r => setTimeout(r, 25));
    const cur = await idbGet('appState');
    return { savedAt: cur && cur.savedAt, stamp: __tabStamp };
  });
  assert(first.savedAt && first.savedAt === first.stamp, '① 저장 후 savedAt/스탬프가 어긋난다: ' + JSON.stringify(first));

  // 이 시점부터 탭1의 저장 경로를 스텁으로 봉인한다(③에서 원복). 이유 둘:
  //  · 탭1의 백그라운드 저장이 탭2 부팅 뒤에 끼어들면 탭2가 먼저 뒤처져
  //    방송이 아예 안 나가고 ③이 헛돈다(실측)
  //  · "경고는 저장 시도 때만" 어서션이 백그라운드 저장 시도와 레이스한다(실측)
  await p1.evaluate(() => {
    window.__realPersist = persistLocal;
    window.persistLocal = () => {};
  });

  // ② 두 번째 탭 — 양쪽 다 경고 (BroadcastChannel)
  await p1.evaluate(() => { window.__toasts.length = 0; });
  const p2 = await boot(ctx, errors);
  await p1.waitForTimeout(600);
  const banner = (p) => p.evaluate(() => (document.getElementById('hjTabWarnMsg') || {}).textContent || '');
  const warns = await Promise.all([
    banner(p1).then(t => t.includes('다른 탭')),
    banner(p2).then(t => t.includes('다른 탭')),
  ]);
  assert(warns[0], '② 먼저 열려 있던 탭이 새 탭을 알아채지 못했다');
  assert(warns[1], '② 새 탭이 기존 탭을 알아채지 못했다');

  // ③ 탭2가 저장하면 탭1이 방송으로 뒤처짐을 알고 자동저장을 멈춘다
  //    주의 1: 백그라운드(taxCalendarEnsure 등)가 탭1에서 markDirty 를 불러 쓰기 전
  //    대조(①겹)로도 stale 이 서 버린다 — 그러면 방송(②겹)을 지워도 이 검사가
  //    통과해 뮤테이션이 생존한다(실측).
  //    주의 2: 같은 백그라운드가 "경고는 저장 시도 때만" 어서션과도 레이스한다
  //    (뮤테이션 실행 중 실측 — 게이트 플레이크가 된다).
  //    → 조용한 구간 동안 persistLocal 자체를 스텁해 저장 시도를 봉인하고,
  //      방송만으로 stale 이 서는지를 결정적으로 본다.
  await p2.evaluate(async () => {
    state.notes = [{ id: 'n2', text: '탭2 메모' }];
    markDirty();
    await new Promise(r => setTimeout(r, 1300));
  });
  await p1.waitForTimeout(400);
  const r3 = await p1.evaluate(() => ({ stale: __tabStale, banner: (document.getElementById('hjTabWarnMsg') || {}).textContent || '', toasts: window.__toasts.slice() }));
  assert(r3.stale === true, '③ 다른 탭의 저장 방송을 받고도 뒤처짐 표시가 안 됐다: ' + JSON.stringify(r3));
  // 방송 수신만으로 경고하지 않는다 — 경고는 실제 저장이 막히는 순간에만.
  // 그리고 경고는 공용 토스트가 아니라 전용 배너다: 토스트로 띄우면 ?lead 차단
  // 안내 같은 다른 메시지를 덮는다(v240 배포 게이트 실측 — sensitive-query 실패).
  assert(!r3.banner.includes('자동저장을 멈췄'), '③ 저장 시도도 없는데 방송만으로 경고를 띄웠다: ' + r3.banner);
  const r3b = await p1.evaluate(async () => {
    window.persistLocal = window.__realPersist;   // 저장 경로 원복 — 이제부터가 진짜 저장 시도
    state.notes = [{ id: 'n1w', text: '탭1 수정 시도' }];
    markDirty();
    await new Promise(r => setTimeout(r, 1300));
    return { banner: (document.getElementById('hjTabWarnMsg') || {}).textContent || '', toasts: window.__toasts.slice() };
  });
  assert(r3b.banner.includes('자동저장을 멈췄'), '③ 저장이 막히는 순간의 경고 배너가 없다: ' + r3b.banner);
  assert(!r3b.toasts.some(t => t.includes('자동저장을 멈췄')), '③ 경고가 공용 토스트로 나갔다 — 다른 안내를 덮는다: ' + JSON.stringify(r3b.toasts));

  // ④ 뒤처진 탭(탭1)의 자동저장·pagehide 가 탭2의 저장을 덮지 않는다
  const r4 = await p1.evaluate(async () => {
    state.notes = [{ id: 'n1b', text: '탭1 늦은 수정' }];
    markDirty();
    await new Promise(r => setTimeout(r, 1300));
    window.dispatchEvent(new Event('pagehide'));
    await new Promise(r => setTimeout(r, 400));
    const after = await idbGet('appState');
    return { note: after.notes && after.notes[0] && after.notes[0].id };
  });
  assert(r4.note === 'n2', '④ 뒤처진 탭이 탭2의 저장을 덮어썼다: ' + JSON.stringify(r4));

  // ⑤ 방송 없이 남이 저장한 경우(다른 기기 동기화 등)도 쓰기 전 대조가 잡는다
  //    — 탭2(현재 최신, stale 아님)에 idb 직접 조작으로 더 미래의 저장본을 심는다
  const r5 = await p2.evaluate(async () => {
    const cur = await idbGet('appState');
    const foreign = Object.assign({}, cur, { savedAt: '9999-01-01T00:00:00.000Z', notes: [{ id: 'nX', text: '외부 최신 작업' }] });
    await idbSet('appState', foreign);
    state.notes = [{ id: 'n2b', text: '탭2 수정' }];
    markDirty();
    await new Promise(r => setTimeout(r, 900));
    for (let i = 0; i < 200 && !__tabStale; i++) await new Promise(r => setTimeout(r, 25));
    const after = await idbGet('appState');
    return { savedAt: after.savedAt, note: after.notes && after.notes[0] && after.notes[0].id, stale: __tabStale };
  });
  assert(r5.savedAt === '9999-01-01T00:00:00.000Z' && r5.note === 'nX',
    '⑤ 쓰기 전 대조가 안 된다 — 마지막-저장-승리가 살아 있다: ' + JSON.stringify(r5));
  assert(r5.stale === true, '⑤ 뒤처짐 플래그가 안 섰다');

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 정상 저장은 savedAt 전진');
  console.log('PASS  ② 두 탭 모두 "다른 탭" 경고');
  console.log('PASS  ③ 방송은 조용히 정지, 경고는 저장이 막힐 때만');
  console.log('PASS  ④ 뒤처진 탭은 자동저장·pagehide 로도 안 덮는다');
  console.log('PASS  ⑤ 방송 없는 외부 저장도 쓰기 전 대조로 차단');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

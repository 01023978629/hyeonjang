/* snapshot-guard.e2e.js — 안전판(hjSnapshot)이 저장소 읽기 오류를 '비어 있음'으로 오해하지 않는다 (Playwright)

   2026-09-04 v255: idbGet 은 오류를 null 로 접는다. 안전판이 그 null 을 빈 목록으로 보고 새 1개만 쓰면
   기존 12개 복구 지점이 소리 없이 사라진다(점검에서 발견). 읽기 실패면 아무것도 쓰지 않고 false.

     ① hj_snaps 읽기가 오류를 내면 hjSnapshot 은 false 를 돌려주고 기존 안전판은 그대로다
     ② 읽기가 되면 평소처럼 true 를 돌려주고 한 개가 늘어난다
     ③ 저장된 값이 배열이 아니면(깨진 값) 덮지 않고 false
     ④ pageerror 0

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
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone);
  await page.evaluate(() => Promise.resolve(window.__hjRestoreDone));

  const r = await page.evaluate(async () => {
    // 기존 안전판 2개를 심는다
    state.projects = [{ name: '검사현장', stage: 2, received: 0, phases: [], customer: {} }];
    const fake = (label) => ({ at: new Date().toISOString(), label, np: 1, nf: 0, nq: 0, data: { projects: [], files: [] } });
    await idbSet('hj_snaps', [fake('첫째'), fake('둘째')]);
    __snapLastAt = 0;

    // ① hj_snaps 읽기만 진짜 IDB 오류로 만든다 (다른 키는 정상)
    const native = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key) {
      if (key === 'hj_snaps') { const req = native.call(this, key); Object.defineProperty(req, 'result', { get() { throw new DOMException('read failed', 'UnknownError'); } }); return { set onsuccess(fn) { setTimeout(() => { if (this.onerror) this.onerror({ target: this }); }, 0); }, set onerror(fn) { this._err = fn; }, get onerror() { return this._err; }, error: new DOMException('read failed', 'UnknownError') }; }
      return native.call(this, key);
    };
    const failed = await hjSnapshot('오류 중 저장', true, true);
    IDBObjectStore.prototype.get = native;
    const afterFail = (await idbGet('hj_snaps')) || [];

    // ② 정상 읽기면 한 개 늘어난다
    __snapLastAt = 0;
    const ok = await hjSnapshot('정상 저장', true, true);
    const afterOk = (await idbGet('hj_snaps')) || [];

    // ③ 깨진 값(배열 아님)이면 덮지 않는다
    await idbSet('hj_snaps', { broken: true });
    __snapLastAt = 0;
    const brokenRet = await hjSnapshot('깨진 값', true, true);
    const afterBroken = await idbGet('hj_snaps');
    await idbSet('hj_snaps', []);
    return { failed, afterFail: afterFail.map(s => s.label), ok, afterOk: afterOk.map(s => s.label), brokenRet, afterBroken };
  });
  assert(r.failed === false && r.afterFail.join() === '첫째,둘째', '① 읽기 오류면 false 이고 기존 안전판 2개가 그대로다: ' + JSON.stringify(r));
  assert(r.ok === true && r.afterOk.join() === '첫째,둘째,정상 저장', '② 정상이면 true 이고 한 개 늘어난다: ' + JSON.stringify(r));
  assert(r.brokenRet === false && r.afterBroken && r.afterBroken.broken === true, '③ 깨진 값은 덮지 않는다: ' + JSON.stringify(r));
  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));
  console.log('PASS  snapshot-guard: 읽기 오류·깨진 값에는 안전판을 덮지 않는다, 정상이면 한 개 추가');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

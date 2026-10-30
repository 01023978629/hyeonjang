/* v520 푸터 'build vNNN' 표시 누락 고침 — 비동기 부팅이 HTML 파서보다 먼저 끝나면 footer(#buildTag, 외부 스크립트 3개 뒤)가 아직 없어
   글자를 못 썼다(PC 1280 에서 4번 중 1번). 설정(다크·글꼴·모바일 모드) 복원은 원래 끝까지 됐다 — 이 검사는 그것도 함께 못 박는다.
   합성 자료만, 바깥 쓰기 0.
   ① 외부 스크립트를 1.5초 늦게 내려 주어 경합을 일부러 만든다(파서가 footer 앞에서 멈춤) → 그래도 buildTag 가 'build …'(BUILDTAG) · 저장한 다크·글꼴·모바일 모드 복원 · 오류 0 (1280·390)
   ② 늦추지 않은 보통 부팅 1280 × 8번 · 390 × 4번 → buildTag 12/12 · 오류 0
   HJ_V520_BASELINE=<commit> 은 ① 의 BUILDTAG 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const html = process.env.HJ_V520_BASELINE ? execFileSync('git', ['show', process.env.HJ_V520_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width, height) {
  const slow = { on: false };
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error))); page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      // 본문 스크립트 뒤의 외부 스크립트를 늦춰 파서를 footer 앞에서 멈추게 한다 — 부팅은 그 사이 끝난다
      if (slow.on && /\/(media-safety|shared-todo-backup|operations-review)\.js$/.test(url.pathname)) await new Promise(r => setTimeout(r, 1500));
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  return { context, page, slow };
}
async function boot(page) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
}
const snapshot = page => page.evaluate(() => ({ tag: (document.getElementById('buildTag') || {}).textContent || '', ready: document.readyState,
  dark: document.body.classList.contains('dark'), fs: document.documentElement.style.getPropertyValue('--fs'), mobile: document.body.classList.contains('mobile-mode'), modeBadge: (document.getElementById('modeBadge') || {}).textContent || '' }));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS bootrestore-v520 ' + name); }

  await test('① 파서보다 먼저 끝나는 부팅에서도 buildTag · 다크·글꼴·모바일 모드 복원 · 오류 0 (BUILDTAG)', async () => {
    for (const [w, h, wantMobile] of [[1280, 860, true], [390, 844, false]]) {
      const { context, page, slow } = await openPage(w, h);
      // 1차 부팅(보통): 저장값을 남긴다(기본과 반대로 — 1280 은 모바일 모드 켬, 390 은 끔)
      await boot(page); await page.waitForFunction(() => document.readyState === 'complete');
      await page.evaluate(async m => { await idbSet('pref_dark', true); await idbSet('pref_font', 2); await idbSet('pref_mobile', m); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; state.dirty = false; }, wantMobile);
      // 2차 부팅: 외부 스크립트가 늦어 파서가 footer 앞에서 멈춘 사이 부팅이 끝난다
      slow.on = true; await boot(page);
      const early = await snapshot(page);
      await page.waitForFunction(() => document.readyState === 'complete');
      await page.waitForFunction(() => /^build /.test((document.getElementById('buildTag') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
      const late = await snapshot(page);
      assert(early.dark && late.dark, w + ' dark restored ' + JSON.stringify([early, late]));
      assert.equal(late.fs, '125%', w + ' font step restored ' + JSON.stringify(late));
      assert.equal(late.mobile, wantMobile, w + ' mobile mode restored ' + JSON.stringify(late));
      assert.match(late.tag, /^build hyeonjang-v\d+/, 'BUILDTAG ' + w + ' footer build text ' + JSON.stringify([early, late]));
      await context.close();
    }
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  await test('② 보통 부팅 1280×8 · 390×4 — buildTag 12/12 · 오류 0', async () => {
    let ok = 0, n = 0;
    for (const [w, h, times] of [[1280, 860, 8], [390, 844, 4]]) for (let i = 0; i < times; i++) {
      const { context, page } = await openPage(w, h);
      await boot(page);
      await page.waitForFunction(() => document.readyState === 'complete');
      await page.waitForFunction(() => /^build /.test((document.getElementById('buildTag') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
      const s = await snapshot(page); n++; if (/^build hyeonjang-v\d+/.test(s.tag)) ok++;
      await context.close();
    }
    assert.equal(ok, n, 'buildTag present in every boot ' + ok + '/' + n);
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`bootrestore-v520: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL bootrestore-v520', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

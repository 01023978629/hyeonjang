/* heic-integrity.e2e.js — 대표 결정 2026-10-01: HEIC 변환 스크립트(heic2any@0.0.4, jsDelivr)에 무결성 해시.
   ① ensureHeic2any 가 만드는 <script> 에 integrity(sha384-…)·crossorigin=anonymous 가 있다 — 해시는 npm 저장소 파일에서 계산한 값,
      index.html 과 team-projects.js 가 같은 값을 적는다
   ② 내용이 바뀐 스크립트(해시 불일치)는 브라우저가 막고, 앱은 조용히 실패하지 않는다 — 토스트
      'HEIC 변환 도구를 불러오지 못했습니다(무결성 확인 실패) — JPEG 로 바꿔 올려 주세요', 호출자에게는 거부(reject)
   ③ 실패 뒤 다시 부르면 다시 시도한다(막힌 Promise 가 남지 않는다) · 토스트는 10초에 한 번
   가짜 스크립트만 쓴다 — 실제 CDN 은 부르지 않는다. 전제: tests/static-server.js(8299) 실행 중 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const CDN = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
const SRI = 'sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL';
const MSG = 'HEIC 변환 도구를 불러오지 못했습니다(무결성 확인 실패) — JPEG 로 바꿔 올려 주세요';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;
(async () => {
  const root = path.join(__dirname, '..');
  for (const f of ['index.html', 'team-projects.js']) assert(fs.readFileSync(path.join(root, f), 'utf8').split(SRI).length === 2, f + ' 가 heic2any 의 sha384 를 한 번 적어야 한다');
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = []; let served = 0;
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  // 마지막에 건 route 가 먼저 맞는다 — CDN 응답 route 는 전체 차단 뒤에 건다
  await page.route(CDN, route => { served++; return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.heic2any=async()=>new Blob();/* 바뀐 내용 — 해시와 다르다 */' }); });
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__hjRestoreDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone));
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]));

  const r = await page.evaluate(async () => {
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); try { o(m); } catch (e) {} };
    window.__scripts = []; const ap = document.head.appendChild.bind(document.head);
    document.head.appendChild = x => { if (x && x.tagName === 'SCRIPT') window.__scripts.push({ src: x.src, integrity: x.integrity, cross: x.crossOrigin }); return ap(x); };
    let err1 = '', err2 = '';
    try { await ensureHeic2any(); } catch (e) { err1 = String(e && e.message || e); }
    const loaded = typeof heic2any !== 'undefined';
    try { await ensureHeic2any(); } catch (e) { err2 = String(e && e.message || e); }
    document.head.appendChild = ap;
    return { err1, err2, loaded, scripts: window.__scripts, toasts: window.__toasts, pending: !!window.__heicLoading };
  });
  assert(r.scripts.length === 2 && r.scripts.every(s => s.src === CDN && s.integrity === SRI && s.cross === 'anonymous'), '① script 요소에 integrity·crossorigin 이 없다: ' + JSON.stringify(r.scripts));
  assert(!r.loaded, '② 해시가 다른 스크립트가 실행됐다');
  assert(r.err1 === MSG && r.err2 === MSG, '② 호출자에게 거부가 돌아가야 한다: ' + JSON.stringify([r.err1, r.err2]));
  assert(r.toasts.length === 1 && r.toasts[0] === MSG, '② 안내 토스트가 한 번 떠야 한다(10초 안 중복 없음): ' + JSON.stringify(r.toasts));
  assert(served === 2 && !r.pending, '③ 실패 뒤 다시 부르면 다시 시도하고, 막힌 Promise 가 남지 않는다: ' + JSON.stringify([served, r.pending]));
  assert(errors.length === 0, '페이지 오류: ' + errors.join(' | '));
  console.log('PASS heic-integrity ①~③');
  await browser.close();
})().catch(async e => { console.error('FAIL heic-integrity:', e && e.stack || e); if (browser) await browser.close().catch(() => {}); process.exit(1); });

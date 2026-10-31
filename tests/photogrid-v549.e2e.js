/* v549 폰 사진 탭 — 사진 2열 격자 · 📍 위치 배지 · 위쪽 큰 단추 줄 [🧭 추측 배정][🧩 공정 채우기](대표 PDF 9번) + OfficeOps 부팅 대기. 합성 자료만, 외부 쓰기 0.
   ① 폰 390(모바일 모드): 요약 줄 한 줄(≤70px, 🧭 는 요약 줄에서 빠짐) · 바로 아래 큰 단추 둘이 반반 · 48px · 2열 격자(칸 150px↑) · GPS 사진만 📍 배지(왼쪽 아래) ·
      첫 사진 y≤650(v243 첫 화면 약속) · 가로 넘침 0 (PHONE)
   ② 누르면 있던 창 — 🧭 → 추측 배정 보기 창 · 🧩 → 🧩 공정·작업명 채우기 창, 여는 것만으로 자료 불변 (OPEN)
   ③ 하나만 있으면 한 줄 가득 · 할 일 없으면 줄 없음 · 폭 600 PC 모드(좁은 화면)도 같은 폰 화면 · 어두운 화면 단추 대비 4.5↑ (STATES)
   ④ PC 1280 은 종전 그대로(요약 줄 단추·큰 줄 없음·여러 열) + 📍 배지 · OfficeOps 호출은 부팅이 주소·토큰을 다 읽을 때까지 기다린 뒤 판단 (PC)
   ⑤ 소스·핀 3곳(v549 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V549_BASELINE=<commit> 은 ① 에서, HJ_V549_MUTATION=three-col(폰 2열 규칙 삭제)도 ① 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const MUT = process.env.HJ_V549_MUTATION || '';
let html = process.env.HJ_V549_BASELINE ? execFileSync('git', ['show', process.env.HJ_V549_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'three-col');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const needle of ['  body.mobile-mode .cluster-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px 12px}\n', '  @media(max-width:720px){.cluster-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px 12px}}\n']) {
    assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, '');
  }
}
const GA = 'T549 빌라';   // 짧게 — 긴 현장 이름은 묶음 머리 select 를 다음 줄로 밀어(+29px) 첫 화면 측정이 이름 길이를 재게 된다
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile, seed = 'full' }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, seed, ga, px }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    state.projects.push({ name: ga, stage: 2, received: 0, phases: ['철거', '타일'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    const ph = (id, project, when, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 2048 + id.length, when: new Date(when), handle: null, _file: null, _virtual: true, thumb: px, text: '', ocr: 'na', lat: null, lng: null, _phase: null, _worklabel: null }, extra || {});
    const done = { _phase: '철거', _worklabel: '철거' };
    if (seed === 'full') state.files.push(ph('u1', null, '2026-10-30T10:00:00+09:00'), ph('u2', null, '2026-10-30T10:05:00+09:00'), ph('a1', ga, '2026-10-29T09:00:00+09:00', { lat: 36.351, lng: 127.385 }), ph('a2', ga, '2026-10-29T09:10:00+09:00'), ph('a3', ga, '2026-10-29T09:20:00+09:00'), ph('b1', ga, '2026-10-28T09:00:00+09:00', done));
    if (seed === 'unassigned') state.files.push(ph('u1', null, '2026-10-30T10:00:00+09:00'), ph('b1', ga, '2026-10-28T09:00:00+09:00', done));
    if (seed === 'clean') state.files.push(ph('b1', ga, '2026-10-28T09:00:00+09:00', done), ph('b2', ga, '2026-10-28T09:05:00+09:00', done));
    __photoCache.key = null; state.tab = 'photos'; state.activeProject = null; state.search = ''; render();
  }, { keys: BOOT, mobile: !!mobile, seed, ga: GA, px: PX });
  return { context, page };
}
const look = page => page.evaluate(() => {
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const bar = document.querySelector('#view .photo-bar'), row = document.querySelector('#view .hj-ph-actions'), body = document.querySelector('#view .cluster-body');
  const cellOf = id => { const c = document.querySelector('#view input[data-sel="' + id + '"]'); return c ? c.closest('.ph') : null; };
  const badge = id => { const ph = cellOf(id), b = ph && ph.querySelector('.ph-gps'); return b ? { text: b.textContent, dl: Math.round(b.getBoundingClientRect().left - ph.getBoundingClientRect().left), db: Math.round(ph.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom) } : null; };
  return {
    bar: R(bar), barBtns: bar ? [...bar.querySelectorAll('button')].map(b => b.id) : [], row: R(row), rowAfterBar: !!(row && bar && bar.nextElementSibling === row), rowN: row ? row.dataset.phActions : '',
    btns: row ? [...row.querySelectorAll('button')].map(b => ({ id: b.id, text: b.textContent.trim(), ...R(b) })) : [],
    cols: body ? getComputedStyle(body).gridTemplateColumns.trim().split(/\s+/).length : 0, cellW: Math.round((document.querySelector('#view .cluster-body .ph') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
    thumbTop: Math.round((document.querySelector('#view .cluster img') || { getBoundingClientRect: () => ({ top: 9999 }) }).getBoundingClientRect().top),
    gps: { a1: badge('a1'), a2: badge('a2'), u1: badge('u1') }, over: document.documentElement.scrollWidth - innerWidth
  };
});
const data = page => page.evaluate(() => JSON.stringify(state.files.map(f => [f.id, f.project, f._phase, f._worklabel])));
async function test(name, fn) { await fn(); passed++; console.log('PASS photogrid-v549 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' });   // 화면 모음엔 안내 토스트를 빼고 }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open({ width: 390, mobile: true });

  await test('① 폰 390 — 요약 줄 한 줄 · 큰 단추 둘 반반 · 2열 · 📍 배지 · 첫 사진 y≤650 (PHONE)', async () => {
    const r = await look(page);
    assert(r.row && r.rowAfterBar, 'big button row right under the summary bar ' + JSON.stringify(r.row));
    assert(r.bar.h <= 70 && !r.barBtns.includes('btnSuggestReview'), 'summary bar stays one line, 🧭 moved out ' + JSON.stringify([r.bar, r.barBtns]));
    assert.deepEqual(r.btns.map(b => [b.id, b.text]), [['btnSuggestReview', '🧭 추측 배정 2장'], ['btnPhotoFill', '🧩 공정 채우기 3장']]);
    const [a, b] = r.btns;
    assert(a.h >= 44 && b.h >= 44 && a.top === b.top && Math.abs(a.w - b.w) <= 1 && a.left - r.row.left <= 1 && r.row.right - b.right <= 1, 'two equal halves on one line ' + JSON.stringify(r.btns));
    assert(Math.abs(r.row.left - r.bar.left) <= 1 && Math.abs(r.row.right - r.bar.right) <= 1, 'full width like the summary bar');
    assert.equal(r.cols, 2, 'two photo columns on the phone'); assert(r.cellW >= 150, 'big cells ' + r.cellW);
    assert.deepEqual([r.gps.a1 && r.gps.a1.text, r.gps.a2, r.gps.u1], ['📍 위치', null, null], 'badge only on photos with GPS');
    assert(r.gps.a1.dl <= 8 && r.gps.a1.db <= 8, 'badge sits at the bottom-left of the photo ' + JSON.stringify(r.gps.a1));
    assert(r.thumbTop <= 650, 'first photo still on the first screen ' + r.thumbTop); assert(r.over <= 0, 'no horizontal overflow');
    await shot(page, 'v549-phone-photos');
  });

  await test('② 누르면 있던 창 — 🧭 추측 배정 보기 · 🧩 채우기 창 · 자료 불변 (OPEN)', async () => {
    const before = await data(page);
    await page.locator('#view .hj-ph-actions #btnSuggestReview').click();
    await page.waitForFunction(() => /추측 배정 보기/.test((document.getElementById('modalRoot') || {}).innerText || ''));
    await page.evaluate(() => closeModal(true));
    await page.locator('#view .hj-ph-actions #btnPhotoFill').click(); await page.locator('#hjPhotoFill').waitFor();
    await page.evaluate(() => closeModal(true));
    assert.equal(await data(page), before, 'opening changes nothing');
  });

  await test('③ 하나면 한 줄 가득 · 없으면 줄 없음 · 600 PC 모드도 폰 화면 · 어두운 화면 대비 (STATES)', async () => {
    const { page: p1 } = await open({ width: 390, mobile: true, seed: 'unassigned' });
    let r = await look(p1);
    assert.equal(r.btns.length, 1); assert(Math.abs(r.btns[0].w - r.row.w) <= 1, 'single button spans the row ' + JSON.stringify(r));
    const { page: p0 } = await open({ width: 390, mobile: true, seed: 'clean' });
    r = await look(p0); assert.equal(r.row, null, 'nothing to do → no row'); assert.equal(r.cols, 2);
    const { page: p6 } = await open({ width: 600 });
    r = await look(p6); assert(r.row && r.btns.length === 2 && r.cols === 2, 'narrow PC window gets the phone layout ' + JSON.stringify([r.btns.length, r.cols])); assert(r.over <= 0);
    await page.evaluate(() => { document.body.classList.add('dark'); render(); });
    await page.waitForTimeout(700);
    const c = await page.evaluate(() => [...document.querySelectorAll('#view .hj-ph-actions button')].map(b => [getComputedStyle(b).color, getComputedStyle(b).backgroundColor]));
    assert(c.length === 2 && c.every(([f, bg]) => ratio(f, bg) >= 4.5), 'dark contrast ' + JSON.stringify(c));
    await shot(page, 'v549-phone-dark');
    await page.evaluate(() => { document.body.classList.remove('dark'); render(); });
  });

  await test('④ PC 1280 종전 그대로 + 📍 배지 · OfficeOps 부팅 대기 (PC)', async () => {
    const { page: pc } = await open({ width: 1280 });
    const r = await look(pc);
    assert.equal(r.row, null, 'no big row on PC'); assert(r.barBtns.includes('btnSuggestReview') && r.barBtns.includes('btnPhotoFill'), 'PC buttons stay in the summary bar ' + JSON.stringify(r.barBtns));
    assert.equal(await pc.evaluate(() => document.getElementById('btnSuggestReview').textContent.trim()), '🧭 미배정 2장 추측 배정 보기');
    assert(r.cols > 2, 'PC keeps many columns ' + r.cols); assert.equal(r.gps.a1 && r.gps.a1.text, '📍 위치');
    const w = await pc.evaluate(async () => {
      const keep = window.__hjOfficeOpsBootDone, url = __officeOps.url, token = __officeOps.token; __officeOps.url = ''; __officeOps.token = '';
      let bootAt = 0; window.__hjOfficeOpsBootDone = new Promise(res => setTimeout(() => { bootAt = performance.now(); res(null); }, 120));
      let code = '', endAt = 0; try { await officeOpsCall('officeOpsList', {}); } catch (e) { code = e.code; endAt = performance.now(); }
      window.__hjOfficeOpsBootDone = keep; __officeOps.url = url; __officeOps.token = token;
      return { code, waited: bootAt > 0 && endAt >= bootAt };
    });
    assert.deepEqual(w, { code: 'office-setup', waited: true }, 'OfficeOps waits for the config boot before saying "not connected"');
    await shot(pc, 'v549-pc-photos');
  });

  await test('⑤ 소스·핀 3곳(v549 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('if(__narrow)html+=hjPhotoTopActionsHTML(__unAllN,__pfN,__sureN);'), 'phone row wired');
    assert(src.includes('${hjPhotoGpsBadge(p)}'), 'badge in the photo cell');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 549, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('photogrid-v549: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL photogrid-v549', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

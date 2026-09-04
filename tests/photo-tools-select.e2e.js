/* photo-tools-select.e2e.js — 폰 사진 도구 시트 + 선택 모드 부분 갱신 (Playwright)

   2026-09-04 v256 (업그레이드 점검 #4·#3):
     ① 폰(mobile-mode)에서는 마우스를 올려야 보이던 22px 도구 세 개 대신 ⋯ 버튼(36px 이상) 하나가 항상 보인다
     ② ⋯ → 「사진 도구」 시트에 이동·이름·삭제 큰 버튼(48px 이상)이 있고, 누르면 기존 함수(renameFile 등)가 그 사진 id 로 불린다
     ③ PC(mobile-mode 아님)에서는 예전 ⇄✎🗑 도구가 그대로다
     ④ 선택 모드에서 사진을 체크해도 화면 전체 render 가 돌지 않는다 — 칸 하나(.sel/.on/checked)와 일괄 막대(N장 선택됨)만 바뀐다
     ⑤ 일괄 막대의 버튼은 부분 갱신 뒤에도 배선돼 있다(선택 해제가 동작)
     ⑥ 현장별 보기의 일괄 막대도 같은 방식(scope 유지)
     ⑦ pageerror 0

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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const SEED = () => {
    const d = (s) => new Date(s);
    const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: ['철거', '방수'], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
    state.projects = [P('둔산현장', { lat: 36.35, lng: 127.38 })];
    state.files = [];
    for (let i = 0; i < 30; i++) state.files.push({ id: 'p' + i, name: 'p' + i + '.jpg', ext: 'jpg', kind: 'photo', project: i < 20 ? '둔산현장' : '', when: d('2026-08-1' + (i % 9) + 'T09:' + String(i).padStart(2, '0') + ':00'), lat: 36.3503, lng: 127.3803, size: 1000 + i, _driveId: 'drive-p' + i, address: '대전 서구 둔산동 1234 · 어느아파트' });
    state.tab = 'photos'; state.activeProject = null; state.search = ''; __sel.clear(); __selMode = false; document.body.classList.remove('selmode');
    __mobileMode = true; applyMobileMode();
    if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    render();
  };
  await page.evaluate(SEED);

  // ① 폰: ⋯ 하나, 예전 도구 없음
  const phone = await page.evaluate(() => { const b = document.querySelector('#view .ph .ph-menu'); const r = b ? b.getBoundingClientRect() : { width: 0, height: 0 }; return { more: document.querySelectorAll('#view .ph-menu').length, tools: document.querySelectorAll('#view .ph-tools').length, w: Math.round(r.width), h: Math.round(r.height), visible: getComputedStyle(b).opacity !== '0' }; });
  assert(phone.more >= 12 && phone.tools === 0 && phone.w >= 36 && phone.h >= 36 && phone.visible, '① 폰에서는 ⋯ 버튼(36px+)만 보인다: ' + JSON.stringify(phone));

  // ② 시트 → 이름 변경이 그 사진 id 로 불린다
  const sheet = await page.evaluate(async () => {
    window.__calls = []; const wrap = (name) => { const orig = window[name]; window[name] = (id) => { window.__calls.push([name, id]); }; return orig; };
    wrap('renameFile'); wrap('moveSinglePhoto'); wrap('deletePhoto');
    const b = document.querySelector('#view .ph-menu'); const id = b.dataset.phmore; b.click();
    await new Promise(r => setTimeout(r, 60));
    const modal = document.querySelector('#modalRoot');
    const btns = [...modal.querySelectorAll('.phToolBtn')].map(x => ({ t: x.textContent.trim(), h: Math.round(x.getBoundingClientRect().height) }));
    const title = modal.textContent.includes('사진 도구');
    modal.querySelector('.phToolBtn[data-fn="rename"]').click();
    await new Promise(r => setTimeout(r, 120));
    return { id, title, btns, calls: window.__calls, modalGone: !document.querySelector('#modalRoot .phToolBtn') };
  });
  assert(sheet.title && sheet.btns.length === 3 && sheet.btns.every(b => b.h >= 48) && /이동/.test(sheet.btns[0].t) && /이름/.test(sheet.btns[1].t) && /삭제/.test(sheet.btns[2].t), '② 시트에 큰 버튼 셋: ' + JSON.stringify(sheet));
  assert(sheet.calls.length === 1 && sheet.calls[0][0] === 'renameFile' && sheet.calls[0][1] === sheet.id && sheet.modalGone, '② 이름 변경이 그 사진으로 불린다: ' + JSON.stringify(sheet));

  // ③ PC 는 예전 도구 그대로
  const pc = await page.evaluate(() => { __mobileMode = false; applyMobileMode(); __photoCache.key = null; render(); return { more: document.querySelectorAll('#view .ph-menu').length, tools: document.querySelectorAll('#view .ph-tools').length }; });
  assert(pc.more === 0 && pc.tools >= 12, '③ PC 도구 유지: ' + JSON.stringify(pc));

  // ④ 선택 모드: 체크해도 전체 render 없음
  const sel = await page.evaluate(async () => {
    __mobileMode = true; applyMobileMode(); __photoCache.key = null; render();
    toggleSelMode();
    const orig = render; window.__renders = 0; render = (...a) => { window.__renders++; return orig(...a); };
    const ids = ['p0', 'p1', 'p2', 'p3', 'p4'];
    for (const id of ids) document.querySelector('#view input[data-sel="' + id + '"]').click();
    await new Promise(r => setTimeout(r, 80));
    const cell = (id) => { const chk = document.querySelector('#view input[data-sel="' + id + '"]'); return { checked: chk.checked, on: chk.closest('.ph-chk').classList.contains('on'), sel: chk.closest('.ph').classList.contains('sel') }; };
    const out = { renders: window.__renders, p0: cell('p0'), p9: cell('p9'), bar: (document.querySelector('#bulkBarSlot .bulk-n') || {}).textContent || '', size: __sel.size };
    document.querySelector('#view input[data-sel="p0"]').click();
    await new Promise(r => setTimeout(r, 40));
    out.afterUncheck = { p0: cell('p0'), bar: (document.querySelector('#bulkBarSlot .bulk-n') || {}).textContent || '', renders: window.__renders };
    render = orig;
    return out;
  });
  assert(sel.renders === 0 && sel.size === 5 && sel.p0.checked && sel.p0.on && sel.p0.sel && !sel.p9.checked && !sel.p9.sel && /5장 선택됨/.test(sel.bar), '④ 체크 5번에 전체 render 0, 칸·막대만 갱신: ' + JSON.stringify(sel));
  assert(sel.afterUncheck.renders === 0 && !sel.afterUncheck.p0.checked && !sel.afterUncheck.p0.sel && /4장 선택됨/.test(sel.afterUncheck.bar), '④ 해제도 부분 갱신: ' + JSON.stringify(sel.afterUncheck));

  // ⑤ 부분 갱신 뒤에도 일괄 막대 버튼이 배선돼 있다
  const wired = await page.evaluate(async () => { document.querySelector('#bulkClear').click(); await new Promise(r => setTimeout(r, 120)); return { size: __sel.size, bar: !!document.querySelector('#bulkBarSlot .bulkbar') }; });
  assert(wired.size === 0 && !wired.bar, '⑤ 선택 해제 버튼 동작: ' + JSON.stringify(wired));

  // ⑥ 현장별 보기에서도 scope 를 지킨 채 부분 갱신(공정 칩이 남는다)
  const proj = await page.evaluate(async () => {
    state.tab = 'project'; state.activeProject = '둔산현장'; __projPhotoOpen.add('둔산현장'); __photoCache.key = null; render();
    if (!__selMode) toggleSelMode();
    const orig = render; window.__renders = 0; render = (...a) => { window.__renders++; return orig(...a); };
    for (const id of ['p0', 'p1']) { const chk = document.querySelector('#view input[data-sel="' + id + '"]'); if (chk) chk.click(); }
    await new Promise(r => setTimeout(r, 80));
    const slot = document.getElementById('bulkBarSlot');
    const out = { renders: window.__renders, scope: slot && slot.dataset.scope, chips: slot ? slot.querySelectorAll('[data-bulkphase]').length : -1, bar: slot ? (slot.querySelector('.bulk-n') || {}).textContent : '' };
    render = orig; __sel.clear(); if (__selMode) toggleSelMode();
    return out;
  });
  assert(proj.renders === 0 && proj.scope === '둔산현장' && proj.chips === 2 && /2장 선택됨/.test(proj.bar), '⑥ 현장별 보기 부분 갱신(scope·공정 칩 유지): ' + JSON.stringify(proj));

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));
  console.log('PASS  photo-tools-select: 폰 ⋯ 도구 시트(36px·48px)·PC 도구 유지·선택 체크 부분 갱신(render 0)·막대 배선·현장별 scope');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

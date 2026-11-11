/* v584 🧹·🧭 확인필요 사진을 창 안에서 크게 보기 + '내역서에 아직 없는 작업' 줄 사진 미리보기.
   문제: 🧹 AI 자동 정리 창(aiAutoOrganize)의 '🔎 확인필요 — 현장을 확인하고 체크하세요' 묶음 미리보기 3장(hjorg-th)과 🧭 추측 배정 창(psr-th)은 그림뿐이라
   커지지 않았고, 🧭 창은 '사진 탭의 묶음에서 보세요'라 창을 나가면 체크한 것을 잃었다. v566 '내역서에 아직 없는 작업' 줄은 '사진 n장' 숫자뿐이었다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-10 고정, 바깥 쓰기 0. openLightbox 는 인자만 기록하고 원래 함수를 그대로 부른다(실제 #lightbox 가 열린다).
   ① 🧹 창(폰 390): 썸네일은 단추(44px·aria '사진 크게 보기', 체크 label 밖) · 누르면 그 묶음 사진만 넘겨 보는 크게 보기가 창 위에 · '+n' 은 묶음 첫 장부터 ·
      Esc 로 닫으면 창·체크·고른 현장 그대로, 초점은 그 썸네일로 · 눌러도 체크 안 바뀜 (ORG)
   ② 🧭 창: 같은 규칙 · 안내 글이 '사진 탭의 묶음에서 보세요'가 아님 (PSR)
   ③ 내역서 줄: 볼 수 있는 사진이 있는 작업에만 썸네일 단추(앞 3장) · 날짜마다 4장까지 모음 · 누르면 그 작업 사진만 · 복사 글·초안 엑셀에는 사진 없음 · 저장본 불변 (UNBILLED)
   ④ 폰 390 넘침 없음·44px · PC 1280 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)
   HJ_V584_BASELINE=<commit> 과 HJ_V584_MUTATION=no-wire(창 썸네일 onclick 미배선)·all-ids(묶음 대신 전체 사진)는 ① 에서,
   no-delegate(#view 위임 목록에서 [data-unbilled-photo] 뺌)는 ③ 에서 실패해야 한다. */
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
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MUT = {
  'no-wire': ['btn.onclick=e=>{e.preventDefault();e.stopPropagation();hjThumbOpen(btn.getAttribute(attr),idsOf(btn));};', ''],
  'all-ids': ['openLightbox(id,list.length?list:[id]);', 'openLightbox(id);'],
  'no-delegate': ["#qmMeasure,[data-unbilled-photo]')", "#qmMeasure')"],
};
let html = process.env.HJ_V584_BASELINE ? execFileSync('git', ['show', process.env.HJ_V584_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V584_MUTATION) {
  const m = MUT[process.env.HJ_V584_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V584_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS photoview-v584 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.removeItem('hj_auto_org'); });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
    // 사진 크게 보기 — 인자만 기록하고 원래 함수를 그대로 부른다
    window.__lb = []; const orig = openLightbox;
    openLightbox = function (id, ids) { window.__lb.push({ id, ids: Array.isArray(ids) ? ids.slice() : null }); return orig.apply(this, arguments); };
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
/* 시드(합성 이름): 현장 셋. 현장 없는 사진 — 11/8 일정(가온) 날 위치 없는 5장(u1~u5 → 🧹 확인필요 '일정만' 한 묶음) · 11/9 일정 없는 날 2장(n1·n2).
   현장 있는 사진 — 가온 11/5 6장(G1~G6) + 11/6 2장(G7·G8), 다솜 11/7 미리보기 없는 1장(D1). 가온 9/1 작업내역서 1건(내역서 탭 켜짐). 나래 11/3 일정(사진 없음). */
const SEED = px => {
  closeModal(true);
  const P = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김가상', phone: '010-0000-0000', addr: '' }, archived: false });
  state.projects = [P('가온아파트'), P('나래아파트'), P('다솜빌라')];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; state.goals = {}; window.__tabStale = false;
  let n = 0;
  const ph = (id, project, at, thumb) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 2000 + (++n) * 13, when: new Date(at + '+09:00'), lat: null, lng: null, thumb: thumb === false ? undefined : px, _worklabel: '' });
  state.files = [
    ph('G1', '가온아파트', '2026-11-05T09:00:00'), ph('G2', '가온아파트', '2026-11-05T09:05:00'), ph('G3', '가온아파트', '2026-11-05T09:10:00'),
    ph('G4', '가온아파트', '2026-11-05T09:15:00'), ph('G5', '가온아파트', '2026-11-05T09:20:00'), ph('G6', '가온아파트', '2026-11-05T09:25:00'),
    ph('G7', '가온아파트', '2026-11-06T10:00:00'), ph('G8', '가온아파트', '2026-11-06T10:05:00'),
    ph('D1', '다솜빌라', '2026-11-07T11:00:00', false),
    ph('u1', '', '2026-11-08T09:00:00'), ph('u2', '', '2026-11-08T09:04:00'), ph('u3', '', '2026-11-08T09:08:00'), ph('u4', '', '2026-11-08T09:12:00'), ph('u5', '', '2026-11-08T09:16:00'),
    ph('n1', '', '2026-11-09T15:00:00'), ph('n2', '', '2026-11-09T15:03:00'),
  ];
  const q = hjStmtBuildQuote({ src: 'S1.xlsx', file: 'S1.xlsx', doc: '작업내역서', to: '가상협력', date: '2026-09-01', vat: 'included', project: '가온아파트', lines: [{ d: '2026-09-01', loc: '가온아파트 101-1101', work: '방수', amt: 220000 }] });
  state.quotes.push(q); syncQuoteToProject(q);
  const S = (id, date, title, project) => ({ id, date, time: '09:00', title, project, workers: '', hours: 8, memo: '' });
  state.schedule = [S('A', '2026-11-03', '세면대 배관 공사', '나래아파트'), S('B', '2026-11-08', '욕실 타일', '가온아파트')];
  __hjStmtYm = null; __hjStmtOldOpen = false; state.activeProject = null; state.tab = 'photos'; state.search = ''; state.dirty = false;
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const snap = page => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
// 창의 묶음 줄 — 체크·고른 현장·썸네일(단추인지·표시·높이·폭·aria·체크 label 안인지)
const modalRows = (page, rowSel, chkSel, selSel, attr) => page.evaluate(({ rowSel, chkSel, selSel, attr }) => [...document.querySelectorAll('#modalRoot ' + rowSel)].map(r => {
  const sel = r.querySelector(selSel);
  return { checked: r.querySelector(chkSel).checked, sel: sel ? sel.value : null,
    thumbs: [...r.querySelectorAll('[' + attr + ']')].map(b => { const rc = b.getBoundingClientRect(); return { tag: b.tagName, id: b.getAttribute(attr), h: Math.round(rc.height), w: Math.round(rc.width), aria: b.getAttribute('aria-label') || '', inLabel: !!b.closest('label'), text: b.textContent.trim() }; }) };
}), { rowSel, chkSel, selSel, attr });
const lbCount = page => page.evaluate(() => { const c = document.querySelector('#lightbox .lb-count'); return c ? c.textContent.trim() : null; });
async function clickThumb(page, sel) {
  const before = await page.evaluate(() => window.__lb.length);
  await page.locator(sel).click();
  await page.locator('#lightbox #lbClose').waitFor({ timeout: 3000 }).catch(() => {});
  return { call: await page.evaluate(n => window.__lb[n] || null, before), count: await lbCount(page), inert: await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return m ? !!m.inert : null; }) };
}
async function escClose(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('lightbox'));
  await page.waitForTimeout(80);
  return page.evaluate(() => ({ modal: !!document.querySelector('#modalRoot .modal'), inert: (document.querySelector('#modalRoot .modal') || {}).inert, focus: document.activeElement ? (document.activeElement.getAttribute('data-org-photo') || document.activeElement.getAttribute('data-psr-photo') || document.activeElement.getAttribute('data-unbilled-photo') || document.activeElement.tagName) : '' }));
}

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  try {
    let { context, page } = await open(390, true);
    await page.evaluate(SEED, PX);
    const before = await snap(page);

    await test('① 🧹 창 — 썸네일 단추 → 그 묶음만 크게 보기 · +n 은 첫 장부터 · Esc 뒤 창·체크·고른 현장 그대로 (ORG)', async () => {
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
      await page.waitForSelector('#modalRoot .hjorg-row');
      const ROW = ['.hjorg-row', '.orgChk', '.orgSel', 'data-org-photo'];
      let rows = await modalRows(page, ...ROW);
      const ids = rows.map(r => r.thumbs.map(t => t.id + (t.text ? ':' + t.text : '')).join(','));
      assert.deepEqual(ids, ['n1,n2', 'u1,u2,u3,u1:+2'], 'ORG thumbnails (확인필요 2묶음, 앞 3장 + "+2"=첫 장) ' + JSON.stringify(ids));
      const all = rows.flatMap(r => r.thumbs);
      assert.ok(all.every(t => t.tag === 'BUTTON' && t.h >= 44 && t.w >= 44 && /사진 크게 보기/.test(t.aria) && !t.inLabel), 'ORG thumb buttons 44px · aria · outside the check label ' + JSON.stringify(all));
      assert.deepEqual(rows.map(r => [r.checked, r.sel]), [[false, ''], [false, '가온아파트']], 'ORG 확인필요 rows unchecked ' + JSON.stringify(rows.map(r => [r.checked, r.sel])));
      // 사람이 고른 상태를 만들어 둔다 — 11/9 체크, 11/8 은 현장을 나래로 바꿈(→ 체크됨)
      await page.evaluate(() => { const r = document.querySelectorAll('#modalRoot .hjorg-row'); r[0].querySelector('.orgChk').checked = true; const s = r[1].querySelector('.orgSel'); s.value = '나래아파트'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      const picked = (await modalRows(page, ...ROW)).map(r => [r.checked, r.sel]);
      assert.deepEqual(picked, [[true, ''], [true, '나래아파트']]);
      let v = await clickThumb(page, '#modalRoot .hjorg-row >> nth=1 >> [data-org-photo="u2"]');
      assert.deepEqual(v.call, { id: 'u2', ids: ['u1', 'u2', 'u3', 'u4', 'u5'] }, 'ORG opens the bundle only ' + JSON.stringify(v));
      assert.equal(v.count, '2 / 5', 'ORG viewer walks the 5 photos of that bundle');
      assert.equal(v.inert, true, 'ORG viewer sits over the window');
      let c = await escClose(page);
      assert.deepEqual([c.modal, c.inert, c.focus], [true, false, 'u2'], 'ORG Esc closes only the viewer, focus back on the thumb ' + JSON.stringify(c));
      assert.deepEqual((await modalRows(page, ...ROW)).map(r => [r.checked, r.sel]), picked, 'ORG checks and picks unchanged');
      v = await clickThumb(page, '#modalRoot .hjorg-row >> nth=1 >> .hjorg-more');
      assert.deepEqual([v.call && v.call.id, v.count], ['u1', '1 / 5'], 'ORG "+2" starts from the first photo ' + JSON.stringify(v));
      await page.locator('#lbClose').click(); await page.waitForFunction(() => !document.getElementById('lightbox'));
      v = await clickThumb(page, '#modalRoot .hjorg-row >> nth=0 >> [data-org-photo="n2"]');
      assert.deepEqual([v.call && v.call.ids, v.count], [['n1', 'n2'], '2 / 2'], 'ORG other bundle ' + JSON.stringify(v));
      c = await escClose(page);
      assert.equal(c.modal, true);
      assert.deepEqual((await modalRows(page, ...ROW)).map(r => [r.checked, r.sel]), picked, 'ORG checks still unchanged');
      await page.evaluate(() => closeModal(true));
      assert.equal(await snap(page), before, 'ORG 저장본 불변');
    });

    await test('② 🧭 창 — 같은 규칙 · 안내 글 (PSR)', async () => {
      await page.evaluate(() => { hjPhotoSuggestReview({ from: 'test' }); });
      await page.waitForSelector('#modalRoot .psr-row');
      const ROW = ['.psr-row', '.psrChk', '.psrSel', 'data-psr-photo'];
      const rows = await modalRows(page, ...ROW);
      const ids = rows.map(r => r.thumbs.map(t => t.id + (t.text ? ':' + t.text : '')).join(','));
      assert.deepEqual(ids, ['n1,n2', 'u1,u2,u3,u1:+2'], 'PSR thumbnails ' + JSON.stringify(ids));
      assert.ok(rows.flatMap(r => r.thumbs).every(t => t.tag === 'BUTTON' && t.h >= 44 && t.w >= 44 && /사진 크게 보기/.test(t.aria) && !t.inLabel), 'PSR thumb buttons ' + JSON.stringify(rows));
      const hint = await page.evaluate(() => document.querySelector('#modalRoot .mbody').textContent);
      assert.ok(!/사진 탭의 묶음에서 보세요/.test(hint) && /사진을 누르면 이 창 위에서 크게 볼 수 있어요/.test(hint), 'PSR hint ' + hint.slice(-200));
      await page.evaluate(() => { const r = document.querySelectorAll('#modalRoot .psr-row'); r[0].querySelector('.psrChk').checked = true; const s = r[1].querySelector('.psrSel'); if (s) { s.value = '다솜빌라'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
      const picked = (await modalRows(page, ...ROW)).map(r => [r.checked, r.sel]);
      const v = await clickThumb(page, '#modalRoot [data-psr-photo="u3"]');
      assert.deepEqual([v.call, v.count, v.inert], [{ id: 'u3', ids: ['u1', 'u2', 'u3', 'u4', 'u5'] }, '3 / 5', true], 'PSR opens the cluster only ' + JSON.stringify(v));
      const c = await escClose(page);
      assert.deepEqual([c.modal, c.focus], [true, 'u3'], 'PSR Esc ' + JSON.stringify(c));
      assert.deepEqual((await modalRows(page, ...ROW)).map(r => [r.checked, r.sel]), picked, 'PSR checks and picks unchanged ' + JSON.stringify(picked));
      const m = await clickThumb(page, '#modalRoot .psr-more');
      assert.deepEqual([m.call && m.call.id, m.count], ['u1', '1 / 5'], 'PSR "+2" from the first photo');
      await page.locator('#lbClose').click(); await page.waitForFunction(() => !document.getElementById('lightbox'));
      await page.evaluate(() => closeModal(true));
      assert.equal(await snap(page), before, 'PSR 저장본 불변');
    });

    await test('③ 내역서 줄 — 썸네일(앞 3장, 날짜마다 4장까지) · 그 작업 사진만 · 복사 글·초안 엑셀엔 없음 (UNBILLED)', async () => {
      await page.evaluate(() => { state.tab = 'estimates'; render(); });
      await page.waitForSelector('#view [data-unbilled]');
      const r = await page.evaluate(() => {
        const P = hjUnbilledPlan();
        return { plan: P.rows.map(x => [x.project, x.from, x.to, x.photos, (x.ids || []).join(',')]),
          dom: [...document.querySelectorAll('#view [data-unbilled] > [data-unbilled-row]')].map(el => ({ p: el.dataset.unbilledRow, line: el.firstChild.textContent.trim(), thumbs: [...el.querySelectorAll('[data-unbilled-photo]')].map(b => [b.tagName, b.getAttribute('data-unbilled-photo'), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width), b.getAttribute('aria-label')]),
            box: (el.querySelector('[data-unbilled-thumbs]') || { getAttribute: () => null }).getAttribute('data-unbilled-thumbs') })),
          lines: P.rows.map(hjUnbilledLine), text: hjUnbilledText(P), grid: JSON.stringify(hjStmtDraftGrid(P.rows, '가상협력', '2026-11-10')) };
      });
      assert.deepEqual(r.plan, [['가온아파트', '2026-11-08', '2026-11-08', 0, ''], ['다솜빌라', '2026-11-07', '2026-11-07', 1, ''], ['가온아파트', '2026-11-05', '2026-11-06', 8, 'G1,G2,G3,G4,G7,G8'], ['나래아파트', '2026-11-03', '2026-11-03', 0, '']],
        'UNBILLED ids: 날짜마다 4장까지 · 미리보기 없는 사진·사진 없는 날은 없음 ' + JSON.stringify(r.plan));
      assert.deepEqual(r.dom.map(x => x.line), r.lines, 'UNBILLED row text unchanged');
      assert.deepEqual(r.dom.map(x => x.thumbs.map(t => t[1])), [[], [], ['G1', 'G2', 'G3'], []], 'UNBILLED thumbs only where there is something to see ' + JSON.stringify(r.dom));
      assert.ok(r.dom[2].thumbs.every(t => t[0] === 'BUTTON' && t[2] >= 44 && t[3] >= 44 && /사진 크게 보기/.test(t[4])), 'UNBILLED 44px buttons ' + JSON.stringify(r.dom[2].thumbs));
      assert.equal(r.dom[2].box, JSON.stringify(['G1', 'G2', 'G3', 'G4', 'G7', 'G8']));
      assert.ok(!/G\d|D1|사진 크게/.test(r.text) && !/G\d|D1/.test(r.grid), 'copy text and draft grid carry no photos ' + r.text + ' ' + r.grid);
      const v = await clickThumb(page, '#view [data-unbilled-photo="G2"]');
      assert.deepEqual([v.call, v.count], [{ id: 'G2', ids: ['G1', 'G2', 'G3', 'G4', 'G7', 'G8'] }, '2 / 6'], 'UNBILLED opens that work only ' + JSON.stringify(v));
      const c = await escClose(page);
      assert.equal(c.focus, 'G2', 'UNBILLED Esc → focus back ' + JSON.stringify(c));
      assert.equal(await page.evaluate(() => state.tab + ':' + !!document.querySelector('#view [data-unbilled]') + ':' + !document.querySelector('#modalRoot .modal')), 'estimates:true:true', 'UNBILLED view unchanged, no window opened');
      assert.equal(await snap(page), before, 'UNBILLED 저장본 불변');
    });

    await test('④ 폰 390 넘침 없음·44px · PC 1280 · 핀 · 오류 0 · 바깥 쓰기 0 (GUARD)', async () => {
      const measure = () => page.evaluate(() => {
        const sm = [...document.querySelectorAll('#modalRoot button, #view [data-unbilled] button')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim().slice(0, 12));
        const m = document.querySelector('#modalRoot .modal');
        return { over: document.documentElement.scrollWidth - innerWidth, modalOver: m ? m.scrollWidth - m.clientWidth : 0, rowOver: [...document.querySelectorAll('#modalRoot .hjorg-row,#modalRoot .psr-row,#view [data-unbilled-row]')].filter(x => x.getBoundingClientRect().right > innerWidth + 0.5).length, sm };
      });
      let u = await measure();
      assert.ok(u.over <= 1 && u.rowOver === 0 && !u.sm.length, 'PHONE unbilled ' + JSON.stringify(u));
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); }); await page.waitForSelector('#modalRoot .hjorg-row');
      u = await measure(); assert.ok(u.over <= 1 && u.modalOver <= 1 && u.rowOver === 0 && !u.sm.length, 'PHONE 🧹 ' + JSON.stringify(u));
      await page.evaluate(() => { closeModal(true); hjPhotoSuggestReview({}); }); await page.waitForSelector('#modalRoot .psr-row');
      u = await measure(); assert.ok(u.over <= 1 && u.modalOver <= 1 && u.rowOver === 0 && !u.sm.length, 'PHONE 🧭 ' + JSON.stringify(u));
      await page.evaluate(() => closeModal(true));
      await context.close();
      ({ context, page } = await open(1280, false));
      await page.evaluate(SEED, PX);
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); }); await page.waitForSelector('#modalRoot .hjorg-row');
      const pc = await page.evaluate(() => { const r = document.querySelectorAll('#modalRoot .hjorg-row')[1], b = r.querySelector('[data-org-photo]').getBoundingClientRect(), t = r.querySelector('.hjorg-txt').getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), beside: t.left > b.right && Math.abs(t.top - b.top) < 12 }; });
      assert.deepEqual(pc, { h: 48, w: 48, beside: true }, 'PC thumbs 48px, text beside ' + JSON.stringify(pc));
      const v = await clickThumb(page, '#modalRoot [data-org-photo="u3"]');
      assert.deepEqual([v.call && v.call.ids.length, v.count], [5, '3 / 5'], 'PC click ' + JSON.stringify(v));
      await escClose(page); await page.evaluate(() => closeModal(true));
      await context.close();
      const src = html || SRC;
      const a = (src.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      const b = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      const c = (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
      assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    console.log(`photoview-v584: ${passed}/4 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL photoview-v584 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

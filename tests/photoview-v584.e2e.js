/* v584 🧹·🧭 확인필요 사진을 창 안에서 크게 보기 + '내역서에 아직 없는 작업' 줄 사진 미리보기.
   문제: 🧹 AI 자동 정리 창(aiAutoOrganize)의 '🔎 확인필요 — 현장을 확인하고 체크하세요' 묶음 미리보기 3장(hjorg-th)과 🧭 추측 배정 창(psr-th)은 그림뿐이라
   커지지 않았고, 🧭 창은 '사진 탭의 묶음에서 보세요'라 창을 나가면 체크한 것을 잃었다. v566 '내역서에 아직 없는 작업' 줄은 '사진 n장' 숫자뿐이었다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-10 고정, 바깥 쓰기 0. openLightbox 는 인자만 기록하고 원래 함수를 그대로 부른다(실제 #lightbox 가 열린다).
   ① 🧹 창(폰 390): 썸네일은 단추(44px·aria '사진 크게 보기', 체크 label 밖) · 누르면 그 묶음 사진만 넘겨 보는 크게 보기가 창 위에 · '+n' 은 묶음 첫 장부터 ·
      Esc 로 닫으면 창·체크·고른 현장 그대로, 초점은 그 썸네일로 · 눌러도 체크 안 바뀜 (ORG)
   ② 🧭 창: 같은 규칙 · 안내 글이 '사진 탭의 묶음에서 보세요'가 아님 (PSR)
   ③ 내역서 줄: 볼 수 있는 사진이 있는 작업에만 썸네일 단추(앞 3장) + 남은 장수 '+n'(그 작업 사진 수 기준) · 날짜마다 4장까지 모음 · 누르면 그 작업 사진만 ·
      복사 글·초안 엑셀에는 사진 없음 · 저장본 불변 (UNBILLED)
   ④ 🧹 창의 ✅ 구역·🔎 구역 줄 번호가 각자 제 묶음을 연다 · 창을 연 뒤 없어진 사진은 넘겨 볼 목록에서 빠지고, 없어진 사진을 누르면 열리지 않고 알림 (SECTIONS)
   ⑤ 미리보기 없는 사진(v584 검토): PC 폴더 스캔 직후 사진(원본만, thumb 없음)은 창 안에서 원본으로 미리보기를 만들고 크게 보기도 그 미리보기로 —
      드라이브 '같은 이름' 찾기(getRoToken·roList)·Drive ID 기록·markDirty 0 · 폰의 PC 전용 사진(원본도 사본도 없음)은 단추가 아니라 '미리보기 없음' 칸 ·
      내역서 줄에 안 그려진 4번째 사진까지 넘겨도 같음 · 저장본 불변 (LOCAL)
   ⑥ 폰 390·360 넘침 없음·44px·글 칸 150px 이상(썸네일 줄이 넓어도 줄바꿈) · PC 1280 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (GUARD)
   HJ_V584_BASELINE=<commit> 과 HJ_V584_MUTATION=no-wire(창 썸네일 onclick 미배선)·all-ids(묶음 대신 전체 사진)는 ① 에서,
   no-delegate(#view 위임 목록에서 [data-unbilled-photo] 뺌)·ub-no-more(내역서 줄 '+n' 뺌)는 ③ 에서, ck-index(🧹 줄 번호를 🔎 구역 기준으로)·raw-ids(없어진·볼 수 없는 id 를
   그대로 넘김)는 ④ 에서, no-guard(미리보기 없는 사진도 '볼 수 있음'으로)는 ③(미리보기 없는 D1 이 썸네일이 됨)·⑤ 에서, no-make(열기 전에 미리보기를
   안 만듦)는 ⑤ 에서, org-no-wrap·no-wrap(🧹·🧭 폰 줄바꿈 삭제)은 ⑥ 에서 실패해야 한다. ⑤ 끝의 드라이브 대역 세기는 앞 단정을 모두 꺼도 이름 찾기 길을 잡는다
   (시험 삼아 '미리보기 만들기·거르기를 뺀 판'으로 돌리면 이름 찾기 5번·Drive ID 5장 기록으로 떨어진다). */
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
  'no-wire': ["btn.onclick=e=>{e.preventDefault();e.stopPropagation();hjThumbOpen(btn.getAttribute(attr),idsOf(btn),btn.closest('.modal'));};", ''],
  'all-ids': ['openLightbox(id,list.length?list:[id]);', 'openLightbox(id);'],
  'no-delegate': ["#qmMeasure,[data-unbilled-photo]')", "#qmMeasure')"],
  'ub-no-more': ["(more>0?'<button type=\"button\" class=\"ub-th ub-more\"", "(false?'<button type=\"button\" class=\"ub-th ub-more\""],
  'ck-index': ['g=row&&rows[+row.dataset.org]', 'g=row&&ckG[+row.dataset.org]'],
  'raw-ids': ['const list=group.filter(hjThumbCanShow).map(f=>f.id);', 'const list=(Array.isArray(ids)?ids:[]).slice();'],
  'no-guard': ['function hjThumbCanShow(f){return !!f&&(!!f.thumb||!!f._driveId||isVideoRec(f));}', 'function hjThumbCanShow(f){return !!f;}'],
  'no-make': ['await Promise.all(need.map(hjThumbMake));', ''],
  'org-no-wrap': ['.hjorg-row{gap:6px;flex-wrap:wrap}', '.hjorg-row{gap:6px}'],
  'no-wrap': ['.psr-row{gap:6px;flex-wrap:wrap}', '.psr-row{gap:6px}'],
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
  await (typeof sel === 'string' ? page.locator(sel) : sel).click();
  await page.locator('#lightbox #lbClose').waitFor({ timeout: 4000 }).catch(() => {});
  return { call: await page.evaluate(n => window.__lb[n] || null, before), count: await lbCount(page), inert: await page.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return m ? !!m.inert : null; }) };
}
async function escClose(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('lightbox'));
  await page.waitForTimeout(80);
  return page.evaluate(() => ({ modal: !!document.querySelector('#modalRoot .modal'), inert: (document.querySelector('#modalRoot .modal') || {}).inert, focus: document.activeElement ? (document.activeElement.getAttribute('data-org-photo') || document.activeElement.getAttribute('data-psr-photo') || document.activeElement.getAttribute('data-unbilled-photo') || document.activeElement.tagName) : '' }));
}
// 창 줄마다 썸네일 칸 — B(단추)/S(칸):id(또는 none):img(그림이 있음):+n
const strips = page => page.evaluate(() => [...document.querySelectorAll('#modalRoot .hjorg-row, #modalRoot .psr-row')].map(r => [...r.querySelectorAll('.hjorg-thumbs > *, .psr-thumbs > *')].map(el =>
  (el.tagName === 'BUTTON' ? 'B:' : 'S:') + (el.getAttribute('data-org-photo') || el.getAttribute('data-psr-photo') || (el.hasAttribute('data-thumb-none') ? 'none' : '?')) + (el.querySelector('img') ? ':img' : '') + (/^\+\d+$/.test(el.textContent.trim()) ? ':' + el.textContent.trim() : ''))));
// 드라이브 '같은 이름' 찾기 길을 세는 대역 — 이 검사에서는 한 번도 불리면 안 된다
const STUB_DRIVE = async px => {
  const blob = await (await fetch(px)).blob();
  window.__C = { ro: 0, list: 0, drive: 0, dirty: 0, getFile: 0 };
  getRoToken = async () => { __C.ro++; return 'TOK'; };
  roList = async () => { __C.list++; return [{ id: 'DRIVE_OTHER', name: 'x', size: '2345678' }]; };
  const of = window.fetch; window.fetch = async (u, o) => { if (/googleapis\.com/.test(String(u))) { __C.drive++; return new Response(blob); } return of(u, o); };
  const md = markDirty; markDirty = function () { __C.dirty++; return md.apply(this, arguments); };
  return blob.size;
};

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

    await test('③ 내역서 줄 — 썸네일(앞 3장 + 남은 장수, 날짜마다 4장까지) · 그 작업 사진만 · 복사 글·초안 엑셀엔 없음 (UNBILLED)', async () => {
      await page.evaluate(() => { state.tab = 'estimates'; render(); });
      await page.waitForSelector('#view [data-unbilled]');
      const r = await page.evaluate(() => {
        const P = hjUnbilledPlan();
        return { plan: P.rows.map(x => [x.project, x.from, x.to, x.photos, (x.ids || []).join(',')]),
          dom: [...document.querySelectorAll('#view [data-unbilled] > [data-unbilled-row]')].map(el => ({ p: el.dataset.unbilledRow, line: el.firstChild.textContent.trim(), thumbs: [...el.querySelectorAll('[data-unbilled-photo]')].map(b => [b.tagName, b.getAttribute('data-unbilled-photo'), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width), b.getAttribute('aria-label'), b.textContent.trim()]),
            box: (el.querySelector('[data-unbilled-thumbs]') || { getAttribute: () => null }).getAttribute('data-unbilled-thumbs') })),
          lines: P.rows.map(hjUnbilledLine), text: hjUnbilledText(P), grid: JSON.stringify(hjStmtDraftGrid(P.rows, '가상협력', '2026-11-10')) };
      });
      assert.deepEqual(r.plan, [['가온아파트', '2026-11-08', '2026-11-08', 0, ''], ['다솜빌라', '2026-11-07', '2026-11-07', 1, ''], ['가온아파트', '2026-11-05', '2026-11-06', 8, 'G1,G2,G3,G4,G7,G8'], ['나래아파트', '2026-11-03', '2026-11-03', 0, '']],
        'UNBILLED ids: 날짜마다 4장까지 · 미리보기 없는 사진·사진 없는 날은 없음 ' + JSON.stringify(r.plan));
      assert.deepEqual(r.dom.map(x => x.line), r.lines, 'UNBILLED row text unchanged');
      assert.deepEqual(r.dom.map(x => x.thumbs.map(t => t[1] + (t[5] ? ':' + t[5] : ''))), [[], [], ['G1', 'G2', 'G3', 'G1:+5'], []], 'UNBILLED thumbs (앞 3장 + 남은 5장 "+5"=첫 장) only where there is something to see ' + JSON.stringify(r.dom));
      assert.ok(r.dom[2].thumbs.every(t => t[0] === 'BUTTON' && t[2] >= 44 && t[3] >= 44 && /사진 크게 보기/.test(t[4])), 'UNBILLED 44px buttons ' + JSON.stringify(r.dom[2].thumbs));
      assert.ok(r.dom[2].thumbs.slice(0, 3).every(t => /사진 8장/.test(t[4]) && /날짜마다 앞 4장까지/.test(t[4])) && /5장 더/.test(r.dom[2].thumbs[3][4]), 'UNBILLED aria tells the real photo count and the 4-a-day limit ' + JSON.stringify(r.dom[2].thumbs.map(t => t[4])));
      assert.equal(r.dom[2].box, JSON.stringify(['G1', 'G2', 'G3', 'G4', 'G7', 'G8']));
      assert.ok(!/G\d|D1|사진 크게/.test(r.text) && !/G\d|D1/.test(r.grid), 'copy text and draft grid carry no photos ' + r.text + ' ' + r.grid);
      let v = await clickThumb(page, '#view [data-unbilled-photo="G2"]');
      assert.deepEqual([v.call, v.count], [{ id: 'G2', ids: ['G1', 'G2', 'G3', 'G4', 'G7', 'G8'] }, '2 / 6'], 'UNBILLED opens that work only ' + JSON.stringify(v));
      const c = await escClose(page);
      assert.equal(c.focus, 'G2', 'UNBILLED Esc → focus back ' + JSON.stringify(c));
      v = await clickThumb(page, '#view .ub-more');
      assert.deepEqual([v.call && v.call.id, v.count], ['G1', '1 / 6'], 'UNBILLED "+5" starts from the first photo ' + JSON.stringify(v));
      await escClose(page);
      assert.equal(await page.evaluate(() => state.tab + ':' + !!document.querySelector('#view [data-unbilled]') + ':' + !document.querySelector('#modalRoot .modal')), 'estimates:true:true', 'UNBILLED view unchanged, no window opened');
      assert.equal(await snap(page), before, 'UNBILLED 저장본 불변');
    });

    await test('④ 🧹 ✅ 구역·🔎 구역 줄이 각자 제 묶음 · 창을 연 뒤 없어진 사진은 빠지고 누르면 알림 (SECTIONS)', async () => {
      await page.evaluate(SEED, PX);
      // 가온 현장 자리 + 11/8(가온 일정 날) 위치가 가온 옆인 미배정 2장 → ✅ 위치·일정 일치 묶음
      await page.evaluate(px => {
        const g = state.projects.find(p => p.name === '가온아파트'); g.lat = 36.35; g.lng = 127.38;
        const a = (id, at, d) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project: '', prefix: '현장사진/', size: 7000 + d * 10000, when: new Date(at + '+09:00'), lat: 36.35 + d * 0.0001, lng: 127.38, thumb: px, _worklabel: '' });
        state.files.push(a('a1', '2026-11-08T14:00:00', 2), a('a2', '2026-11-08T14:03:00', 3));
        if (typeof __photoCache !== 'undefined') __photoCache.key = null; render();
      }, PX);
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
      await page.waitForSelector('#modalRoot .hjorg-row');
      const layout = await page.evaluate(() => [...document.querySelectorAll('#modalRoot [data-org-sec], #modalRoot .hjorg-row')].map(el => el.dataset.orgSec ? 'SEC:' + el.dataset.orgSec : el.dataset.org + ':' + [...el.querySelectorAll('[data-org-photo]')].map(b => b.getAttribute('data-org-photo')).join(',') + ':' + el.querySelector('.orgChk').checked));
      assert.deepEqual(layout, ['SEC:ok', '0:a1,a2:true', 'SEC:check', '1:n1,n2:false', '2:u1,u2,u3,u1:false'], 'SECTIONS ✅ then 🔎 ' + JSON.stringify(layout));
      const row = i => page.locator('#modalRoot .hjorg-row').nth(i);
      let v = await clickThumb(page, row(0).locator('[data-org-photo="a2"]'));
      assert.deepEqual([v.call, v.count], [{ id: 'a2', ids: ['a1', 'a2'] }, '2 / 2'], 'SECTIONS ✅ row opens its own bundle ' + JSON.stringify(v));
      await escClose(page);
      v = await clickThumb(page, row(1).locator('[data-org-photo="n1"]'));
      assert.deepEqual([v.call, v.count], [{ id: 'n1', ids: ['n1', 'n2'] }, '1 / 2'], 'SECTIONS first 🔎 row ' + JSON.stringify(v));
      await escClose(page);
      v = await clickThumb(page, row(2).locator('[data-org-photo="u2"]'));
      assert.deepEqual([v.call, v.count], [{ id: 'u2', ids: ['u1', 'u2', 'u3', 'u4', 'u5'] }, '2 / 5'], 'SECTIONS second 🔎 row ' + JSON.stringify(v));
      await escClose(page);
      // 창을 연 채 다시 스캔·복원으로 사진이 바뀐 셈 — u4 가 없어짐
      await page.evaluate(() => { state.files = state.files.filter(f => f.id !== 'u4'); });
      v = await clickThumb(page, row(2).locator('[data-org-photo="u2"]'));
      assert.deepEqual([v.call, v.count], [{ id: 'u2', ids: ['u1', 'u2', 'u3', 'u5'] }, '2 / 4'], 'SECTIONS stale id dropped from the walk ' + JSON.stringify(v));
      await escClose(page);
      // 누른 사진(u1)이 없어짐 → 열리지 않고 알림
      await page.evaluate(() => { state.files = state.files.filter(f => f.id !== 'u1'); document.getElementById('toast').textContent = ''; });
      const n0 = await page.evaluate(() => window.__lb.length);
      await row(2).locator('[data-org-photo="u1"]').first().click();
      await page.waitForTimeout(300);
      const gone = await page.evaluate(() => ({ calls: window.__lb.length, lb: !!document.getElementById('lightbox'), toast: document.getElementById('toast').textContent, modal: !!document.querySelector('#modalRoot .modal') }));
      assert.deepEqual([gone.calls - n0, gone.lb, gone.modal], [0, false, true], 'SECTIONS missing photo does not open ' + JSON.stringify(gone));
      assert.ok(/사진을 찾을 수 없어요/.test(gone.toast), 'SECTIONS missing photo → toast ' + gone.toast);
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modalRoot .orgChk')].map(c => c.checked)), [true, false, false], 'SECTIONS checks unchanged');
      await page.evaluate(() => closeModal(true));
    });

    await test('⑤ 미리보기 없는 사진 — 원본으로 미리보기를 만들어 보고, 드라이브 이름 찾기·Drive ID 기록 0 · 볼 수 없는 사진은 단추가 아님 (LOCAL)', async () => {
      await page.evaluate(SEED, PX);
      await page.evaluate(STUB_DRIVE, PX);
      await page.evaluate(async px => {
        const blob = await (await fetch(px)).blob();
        // PC 폴더 스캔 모양: 미리보기(thumb) 없음 · 원본만(_heicFile 표시 또는 handle 만)
        const scan = (f, heic) => { const file = new File([blob], f.name, { type: 'image/jpeg' }); f.thumb = null; f._needHeic = !!heic; f._heicFile = heic ? file : null; f.handle = { kind: 'file', name: f.name, getFile: async () => { __C.getFile++; return file; } }; return f; };
        const byId = id => state.files.find(f => f.id === id);
        ['G1', 'G3', 'G4', 'G5', 'G6'].forEach(id => scan(byId(id), true));
        scan(byId('G2'), false);
        // 미배정 — 11/7 폰의 PC 전용 1장(q1) + PC 스캔 4장(p1~p4) 한 묶음 · 11/4 폰의 PC 전용 4장(r1~r4) 한 묶음
        state.files = state.files.filter(f => f.project);
        let k = 0;
        const ph = (id, at) => ({ id, name: 'IMG_' + id.toUpperCase() + '.JPG', ext: 'jpg', kind: 'photo', project: '', prefix: '현장사진/', size: 3000 + (++k) * 17, when: new Date(at + '+09:00'), lat: null, lng: null, _worklabel: '' });
        state.files.push(ph('q1', '2026-11-07T09:00:00'), scan(ph('p1', '2026-11-07T09:01:00'), true), scan(ph('p2', '2026-11-07T09:02:00'), true), scan(ph('p3', '2026-11-07T09:03:00'), true), scan(ph('p4', '2026-11-07T09:04:00'), true),
          ph('r1', '2026-11-04T10:00:00'), ph('r2', '2026-11-04T10:01:00'), ph('r3', '2026-11-04T10:02:00'), ph('r4', '2026-11-04T10:03:00'));
        state.tab = 'schedule'; if (typeof __photoCache !== 'undefined') __photoCache.key = null; render();
      }, PX);
      const before5 = await snap(page);
      await page.evaluate(() => { Object.keys(__C).forEach(k => { __C[k] = 0; }); window.__lb = []; });
      // 🧹 — 창이 열리면 원본만 있는 썸네일(p1·p2)이 그림이 된다(창은 #view 밖)
      await page.evaluate(() => { aiAutoOrganize({ auto: false }); });
      await page.waitForSelector('#modalRoot .hjorg-row');
      await page.waitForFunction(() => document.querySelector('#modalRoot [data-org-photo="p1"] img') && document.querySelector('#modalRoot [data-org-photo="p2"] img'), null, { timeout: 8000 }).catch(() => {});
      let st = await strips(page);
      assert.deepEqual(st, [['S:none', 'B:p1:img', 'B:p2:img', 'B:p1:+2'], ['S:none', 'S:none', 'S:none', 'S:none:+1']], 'LOCAL 🧹 strips: 볼 수 없는 사진은 칸, 원본만 있는 사진은 그림이 된 단추 ' + JSON.stringify(st));
      let v = await clickThumb(page, '#modalRoot [data-org-photo="p2"]:not(.hjorg-more)');
      assert.deepEqual([v.call, v.count], [{ id: 'p2', ids: ['p1', 'p2', 'p3', 'p4'] }, '2 / 4'], 'LOCAL 🧹 walks the 4 viewable photos (p3·p4 미리보기를 먼저 만듦) ' + JSON.stringify(v));
      for (const want of ['3 / 4', '4 / 4']) { await page.keyboard.press('ArrowRight'); assert.equal(await lbCount(page), want); }
      await page.waitForFunction(() => /^blob:/.test((document.querySelector('#lightbox #lbImg') || {}).src || ''), null, { timeout: 3000 }).catch(() => {});
      assert.ok(/^blob:/.test(await page.evaluate(() => document.querySelector('#lightbox #lbImg').src)), 'LOCAL p4 shows its own preview');
      await escClose(page);
      v = await clickThumb(page, '#modalRoot button.hjorg-more');
      assert.deepEqual([v.call && v.call.id, v.count], ['p1', '1 / 4'], 'LOCAL "+2" starts from the first viewable photo ' + JSON.stringify(v));
      await escClose(page);
      await page.evaluate(() => closeModal(true));
      // 🧭 — 같은 규칙
      await page.evaluate(() => { hjPhotoSuggestReview({}); });
      await page.waitForSelector('#modalRoot .psr-row');
      st = await strips(page);
      assert.ok(st.length === 2 && st.some(x => x.join() === 'S:none,B:p1:img,B:p2:img,B:p1:+2') && st.some(x => x.join() === 'S:none,S:none,S:none,S:none:+1'), 'LOCAL 🧭 strips ' + JSON.stringify(st));
      v = await clickThumb(page, '#modalRoot [data-psr-photo="p1"]:not(.psr-more)');
      assert.deepEqual([v.call && v.call.ids, v.count], [['p1', 'p2', 'p3', 'p4'], '1 / 4'], 'LOCAL 🧭 ' + JSON.stringify(v));
      await escClose(page);
      await page.evaluate(() => closeModal(true));
      // 내역서 줄 — 화면에 그려진 3장 밖(4번째 G4·원본 핸들만 있는 G2)까지 넘겨도 같다
      await page.evaluate(() => { state.tab = 'estimates'; render(); });
      await page.waitForSelector('#view [data-unbilled-photo="G1"]');
      await page.waitForFunction(() => document.querySelector('#view [data-unbilled-photo="G1"] img') && document.querySelector('#view [data-unbilled-photo="G3"] img'), null, { timeout: 8000 }).catch(() => {});
      v = await clickThumb(page, '#view [data-unbilled-photo="G1"]:not(.ub-more)');
      assert.deepEqual([v.call, v.count], [{ id: 'G1', ids: ['G1', 'G2', 'G3', 'G4', 'G7', 'G8'] }, '1 / 6'], 'LOCAL unbilled ' + JSON.stringify(v));
      for (const want of ['2 / 6', '3 / 6', '4 / 6']) { await page.keyboard.press('ArrowRight'); assert.equal(await lbCount(page), want); }
      await page.waitForTimeout(400);
      await escClose(page);
      const res = await page.evaluate(() => ({ C: Object.assign({}, __C), drive: state.files.filter(f => f._driveId).map(f => f.id), lbUrl: !!window.__lbUrl }));
      assert.deepEqual([res.C.ro, res.C.list, res.C.drive, res.C.dirty, res.drive], [0, 0, 0, 0, []], 'LOCAL no Drive name search, no Drive ID written, nothing marked to save ' + JSON.stringify(res));
      assert.ok(res.C.getFile >= 1, 'LOCAL G2 (handle only) preview came from its own original ' + JSON.stringify(res.C));
      assert.equal(await snap(page), before5, 'LOCAL 저장본 불변');
    });
    await context.close();

    await test('⑥ 폰 390·360 넘침 없음·44px·글 칸 150px · PC 1280 · 핀 · 오류 0 · 바깥 쓰기 0 (GUARD)', async () => {
      const measure = page => page.evaluate(() => {
        const sm = [...document.querySelectorAll('#modalRoot button, #view [data-unbilled] button')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 43.5).map(b => b.textContent.trim().slice(0, 12));
        const m = document.querySelector('#modalRoot .modal');
        const w = sel => [...document.querySelectorAll(sel)].filter(x => x.getClientRects().length).map(x => Math.round(x.getBoundingClientRect().width));
        return { over: document.documentElement.scrollWidth - innerWidth, modalOver: m ? m.scrollWidth - m.clientWidth : 0, rowOver: [...document.querySelectorAll('#modalRoot .hjorg-row,#modalRoot .psr-row,#view [data-unbilled-row]')].filter(x => x.getBoundingClientRect().right > innerWidth + 0.5).length, sm,
          txt: w('#modalRoot .hjorg-txt, #modalRoot .psr-txt, #view [data-unbilled-row] > div:first-child'), sel: w('#modalRoot .orgSel, #modalRoot .psrSel') };
      });
      for (const width of [390, 360]) {
        ({ context, page } = await open(width, true));
        await page.evaluate(SEED, PX);
        await page.evaluate(() => { state.tab = 'estimates'; render(); }); await page.waitForSelector('#view [data-unbilled-photo]');
        let u = await measure(page);
        assert.ok(u.over <= 1 && u.rowOver === 0 && !u.sm.length && Math.min(...u.txt) >= 150, 'PHONE ' + width + ' unbilled ' + JSON.stringify(u));
        await page.evaluate(() => { aiAutoOrganize({ auto: false }); }); await page.waitForSelector('#modalRoot .hjorg-row');
        u = await measure(page); assert.ok(u.over <= 1 && u.modalOver <= 1 && u.rowOver === 0 && !u.sm.length && Math.min(...u.txt) >= 150, 'PHONE ' + width + ' 🧹 (글 칸이 썸네일 줄 옆에서 짓눌리지 않음 — 현장 고르기는 글 칸 안, 글자 폭만큼) ' + JSON.stringify(u));
        await page.evaluate(() => { closeModal(true); hjPhotoSuggestReview({}); }); await page.waitForSelector('#modalRoot .psr-row');
        u = await measure(page); assert.ok(u.over <= 1 && u.modalOver <= 1 && u.rowOver === 0 && !u.sm.length && Math.min(...u.txt) >= 150, 'PHONE ' + width + ' 🧭 ' + JSON.stringify(u));
        await page.evaluate(() => closeModal(true));
        await context.close();
      }
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
    console.log(`photoview-v584: ${passed}/6 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL photoview-v584 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

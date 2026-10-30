/* v523 🧭 추측 배정 보기 — 현장 없는 사진 묶음을 한 창에서 훑고(추정 현장·근거·사진 3장) 체크한 것만 배정, 안전판 1회. AI 키 없이.
   + photoSuggestFor 에 '그날 일정' 참고 단서(일정표가 한 현장만 가리킬 때, 💰 제외, 두 현장이면 없음). 합성 자료만, 바깥 쓰기 0.
   ① 사진 탭(1280) [🧭 미배정 n장 추측 배정 보기] → 창: 묶음 6(최신순) · GPS 묶음은 체크·사진 3장+'+1' · 일정 묶음은 참고(체크 해제) · 단서 없는 3묶음은 현장 고르기 칸
      (두 현장 일정인 날·💰 일정만 있는 날은 단서 없음) · 묶음 헤더 👉 버튼에도 '참고: 그날 일정' (SCHEDULE)
   ② 안전판 실패 → 아무것도 바꾸지 않고 안내, 단추 다시 켜짐 (SNAPSHOT)
   ③ 참고 묶음 체크 + 단서 없는 묶음 현장 고르기(고르면 체크됨) → 배정: GPS 4 · 일정 2 · 고른 1 · 나머지(partial) 1 = 4묶음 8장, 안 고른 2묶음 그대로, 안전판 '추측 배정 전' 1개 (APPLY)
   ④ 그 안전판으로 되돌리기 → 전부 미배정으로 복귀 (UNDO)
   ⑤ 첫 화면 점검 줄 '미배정 사진 n장 — 추측 배정 보기' · 폰 390: 단추 44px·창 가로 넘침 없음·체크칸·셀렉트·발 단추 44px (PHONE)
   ⑥ 소스: AI 자동 정리 창의 적용도 안전판 뒤 · 일괄 배정(PHOTO_SUGGEST_SURE)에 schedule 없음 · 오류 0 · 바깥 쓰기 0
   HJ_V523_BASELINE=<commit> 은 ① 에서, HJ_V523_MUTATION=no-snapshot 은 ② SNAPSHOT 에서 실패해야 한다. */
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
let html = process.env.HJ_V523_BASELINE ? execFileSync('git', ['show', process.env.HJ_V523_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V523_MUTATION === 'no-snapshot') {
  const gate = "if(!snapped){btns.forEach(b=>{if(b.isConnected)b.disabled=false;});toast('안전판을 만들지 못해 배정하지 않았습니다. 잠시 후 다시 시도하세요.');return 0;}";
  assert(SRC.includes(gate), 'mutation anchor');
  html = SRC.replace(gate, '');
}
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); }, BOOT);
  return { context, page };
}
/* 시드 — 둔산(좌표) · 은행(좌표 없음) · 유성(좌표 없음) · 보관(archived, 둔산 옆). 일정표: 8/5 은행만 · 8/6 둔산+유성(두 현장) · 8/7 💰 만.
   사진(현장 없음): s1·s2 8/5 GPS 없음(일정 단서) · g1~g4 8/10 둔산 40m(GPS) · n1 8/12 단서 없음 · x1 8/6(두 현장 일정) · m1 8/7(💰 일정만) · p2 8/14 p1(둔산)과 같은 자리(나머지)
   a0 는 유성에 이미 배정(창에 안 나온다). */
const SEED = px => {
  const d = s => new Date(s);
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
  let n = 0;
  const ph = (id, project, when, lat, lng) => ({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: d(when), lat, lng, size: 1000 + (++n) * 7, thumb: px, address: lat ? '대전 서구 둔산동 1234 · 어느아파트' : '' });
  state.projects = [P('둔산현장', { lat: 36.35, lng: 127.38 }), P('은행현장'), P('유성현장'), P('보관현장', { archived: true, lat: 36.3505, lng: 127.3805 })];
  state.schedule = [
    { id: 'sc1', date: '2026-08-05', time: '09:00', title: '도배', project: '은행현장' },
    { id: 'sc2', date: '2026-08-06', time: '09:00', title: '철거', project: '둔산현장' }, { id: 'sc3', date: '2026-08-06', time: '14:00', title: '실측', project: '유성현장' },
    { id: 'sc4', date: '2026-08-07', time: '10:00', title: '💰 잔금', project: '둔산현장' },
  ];
  state.files = [
    ph('a0', '유성현장', '2026-08-01T09:00:00', 36.40, 127.30),
    ph('s1', '', '2026-08-05T09:00:00', null, null), ph('s2', '', '2026-08-05T09:05:00', null, null),
    ph('x1', '', '2026-08-06T09:00:00', null, null),
    ph('m1', '', '2026-08-07T09:00:00', null, null),
    ph('g1', '', '2026-08-10T09:00:00', 36.3503, 127.3803), ph('g2', '', '2026-08-10T09:05:00', 36.3503, 127.3803), ph('g3', '', '2026-08-10T09:10:00', 36.3503, 127.3803), ph('g4', '', '2026-08-10T09:15:00', 36.3503, 127.3803),
    ph('n1', '', '2026-08-12T09:00:00', null, null),
    ph('p1', '둔산현장', '2026-08-14T09:00:00', 36.3504, 127.3804), ph('p2', '', '2026-08-14T09:03:00', 36.3504, 127.3804),
  ];
  state.tab = 'photos'; state.activeProject = null; state.search = ''; state.dirty = false;
  if (typeof __photoCache !== 'undefined') __photoCache.key = null;
  render();
};
const proj = page => page.evaluate(() => Object.fromEntries(state.files.map(f => [f.id, f.project || ''])));
const rowsInfo = page => page.evaluate(() => {
  const root = document.getElementById('modalRoot');
  return {
    title: (root.querySelector('#modalTitle') || {}).textContent || '',
    rows: [...root.querySelectorAll('.psr-row')].map(r => ({
      text: r.querySelector('.psr-txt').textContent.replace(/\s+/g, ' ').trim(), checked: r.querySelector('.psrChk').checked,
      imgs: r.querySelectorAll('.psr-th img').length, more: (r.querySelector('.psr-more') || {}).textContent || '', select: !!r.querySelector('.psrSel'),
    })),
    foot: [...root.querySelectorAll('.mfoot button')].map(b => ({ t: b.textContent, h: Math.round(b.getBoundingClientRect().height), disabled: b.disabled })),
  };
});

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS photoassign-v523 ' + name); }
  const { context, page } = await openPage(1280, 860);
  await page.evaluate(SEED, PX);

  await test('① 사진 탭 단추 → 창: 묶음 6 · GPS 체크+사진 3장 · 일정은 참고 · 단서 없는 3묶음은 현장 고르기 · 👉 참고: 그날 일정 (SCHEDULE)', async () => {
    const bar = await page.evaluate(() => {
      const b = document.getElementById('btnSuggestReview');
      const sched = [...document.querySelectorAll('#view .suggest-btn')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
      return { btn: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', inBar: !!(b && b.closest('.photo-bar')), sched, all: (document.getElementById('btnSuggestAll') || {}).textContent || '' };
    });
    assert.equal(bar.btn, '🧭 미배정 10장 추측 배정 보기', 'photo bar button ' + JSON.stringify(bar));
    assert(bar.inBar, 'button sits in the summary bar');
    assert(bar.sched.some(t => /^👉 은행현장 참고: 그날 일정표에 이 현장만 있음/.test(t)), 'SCHEDULE cluster header shows the schedule clue as advisory ' + JSON.stringify(bar.sched));
    assert.match(bar.all, /추천대로 2묶음 배정/, 'bulk button still counts only sure clusters (gps+partial) ' + bar.all);
    await page.click('#btnSuggestReview');
    const m = await rowsInfo(page);
    assert.match(m.title, /추측 배정 보기 — 현장 없는 사진 10장/, m.title);
    assert.equal(m.rows.length, 6, JSON.stringify(m.rows));
    const [rP, rN, rG, rM, rX, rS] = m.rows;   // 최신순: 8/14 p · 8/12 n · 8/10 g · 8/7 m · 8/6 x · 8/5 s
    assert(/2026\.08\.14 · 미배정 1장 \/ 2장/.test(rP.text) && rP.checked && /"둔산현장"/.test(rP.text) && /나머지/.test(rP.text), 'partial row ' + JSON.stringify(rP));
    assert(/2026\.08\.12 · 미배정 1장/.test(rN.text) && !rN.checked && rN.select, 'no-clue row has a select ' + JSON.stringify(rN));
    assert(/2026\.08\.10 · 미배정 4장/.test(rG.text) && rG.checked && /"둔산현장"/.test(rG.text) && /\d+m 거리/.test(rG.text) && rG.imgs === 3 && rG.more === '+1', 'gps row checked with 3 thumbs + 1 ' + JSON.stringify(rG));
    assert(/2026\.08\.07/.test(rM.text) && rM.select && !rM.checked, '💰-only schedule day gives no clue ' + JSON.stringify(rM));
    assert(/2026\.08\.06/.test(rX.text) && rX.select && !rX.checked, 'two-project schedule day gives no clue ' + JSON.stringify(rX));
    assert(/2026\.08\.05 · 미배정 2장/.test(rS.text) && !rS.checked && /"은행현장"/.test(rS.text) && /참고: 그날 일정표/.test(rS.text) && rS.imgs === 2, 'SCHEDULE row advisory, unchecked ' + JSON.stringify(rS));
    assert(m.foot.length === 2 && /체크한 묶음 배정/.test(m.foot[0].t), JSON.stringify(m.foot));
  });

  await test('② 안전판 실패 → 무변경·안내·단추 다시 켜짐 (SNAPSHOT)', async () => {
    const before = await proj(page);
    const r = await page.evaluate(async () => {
      window.__realSnap = hjSnapshot; window.__snapCalls = [];
      hjSnapshot = async label => { window.__snapCalls.push(label); return false; };
      const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /체크한 묶음 배정/.test(x.textContent));
      b.click();
      await new Promise(r => setTimeout(r, 300));
      return { toast: document.getElementById('toast').textContent, calls: window.__snapCalls, modal: !!document.querySelector('#modalRoot .modal'), disabled: [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.disabled) };
    });
    assert.deepEqual(await proj(page), before, 'SNAPSHOT nothing changed');
    assert.deepEqual(r.calls, ['추측 배정 전'], JSON.stringify(r));
    assert(/안전판을 만들지 못해 배정하지 않았습니다/.test(r.toast) && r.modal && r.disabled.every(x => !x), 'SNAPSHOT toast + modal stays + buttons enabled ' + JSON.stringify(r));
  });

  await test('③ 참고 체크 + 현장 고르기 → 4묶음 8장 배정 · 안 고른 2묶음 그대로 · 안전판 1개 (APPLY)', async () => {
    const r = await page.evaluate(async () => {
      hjSnapshot = window.__realSnap;
      const root = document.getElementById('modalRoot');
      const rows = [...root.querySelectorAll('.psr-row')];
      rows[5].querySelector('.psrChk').checked = true;                                   // 일정 묶음(s)
      const sel = rows[1].querySelector('.psrSel'); sel.value = '유성현장'; sel.dispatchEvent(new Event('change', { bubbles: true }));   // 단서 없는 묶음(n)
      const nChecked = rows[1].querySelector('.psrChk').checked;
      window.__dirtyCalls = 0; const od = markDirty; markDirty = () => { window.__dirtyCalls++; return od(); };
      const before = ((await idbGet('hj_snaps')) || []).length;
      [...root.querySelectorAll('.mfoot button')].find(x => /체크한 묶음 배정/.test(x.textContent)).click();
      await new Promise(r => setTimeout(r, 600));
      markDirty = od;
      const snaps = (await idbGet('hj_snaps')) || [];
      return { nChecked, toast: document.getElementById('toast').textContent, modal: !!document.querySelector('#modalRoot .modal'), dirty: window.__dirtyCalls, snapN: snaps.length - before, snapLabel: (snaps[snaps.length - 1] || {}).label, btn: (document.getElementById('btnSuggestReview') || {}).textContent || '' };
    });
    assert(r.nChecked, 'choosing a project checks the row');
    const after = await proj(page);
    assert.deepEqual(after, { a0: '유성현장', s1: '은행현장', s2: '은행현장', x1: '', m1: '', g1: '둔산현장', g2: '둔산현장', g3: '둔산현장', g4: '둔산현장', n1: '유성현장', p1: '둔산현장', p2: '둔산현장' }, 'APPLY projects ' + JSON.stringify(after));
    assert.match(r.toast, /4묶음 8장을 배정했습니다/, r.toast);
    assert(!r.modal && r.dirty >= 1 && r.snapN === 1 && r.snapLabel === '추측 배정 전', 'APPLY modal closed, dirty, one snapshot ' + JSON.stringify(r));
    assert.match(r.btn, /미배정 2장/, 'bar button recounts ' + r.btn);
  });

  await test('④ 안전판으로 되돌리기 → 전부 미배정 복귀 (UNDO)', async () => {
    const r = await page.evaluate(async () => {
      const snaps = (await idbGet('hj_snaps')) || [];
      const s = snaps.filter(x => x.label === '추측 배정 전').pop();
      const ok = await hjRestoreSnapshot(s);
      return { ok, btn: (document.getElementById('btnSuggestReview') || {}).textContent || '' };
    });
    assert.equal(r.ok, true);
    const after = await proj(page);
    assert.equal(Object.values(after).filter(v => !v).length, 10, 'UNDO 10 photos unassigned again ' + JSON.stringify(after));
    assert.match(r.btn, /미배정 10장/, r.btn);
  });

  await test('⑤ 첫 화면 점검 줄 · 폰 390: 단추 44px · 창 넘침 없음 · 체크칸·셀렉트·발 단추 44px (PHONE)', async () => {
    const daily = await page.evaluate(() => dailyCheckData().filter(i => /미배정 사진/.test(i.t)).map(i => ({ t: i.t, act: i.act })));
    assert(daily.length === 1 && /미배정 사진 10장 — 추측 배정 보기/.test(daily[0].t) && /hjPhotoSuggestReview/.test(daily[0].act), JSON.stringify(daily));
    await context.close();
    const m = await openPage(390, 844);
    await m.page.evaluate(SEED, PX);
    const r = await m.page.evaluate(async () => {
      const b = document.getElementById('btnSuggestReview');
      const bar = document.querySelector('#view .photo-bar');
      const out = { btn: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', btnH: b ? Math.round(b.getBoundingClientRect().height) : 0, barH: Math.round(bar.getBoundingClientRect().height), pageW: document.documentElement.scrollWidth };
      b.click(); await new Promise(r => setTimeout(r, 200));
      const root = document.getElementById('modalRoot');
      out.modal = !!root.querySelector('.modal');
      out.scrollW = document.documentElement.scrollWidth; out.modalW = Math.round(root.querySelector('.modal').getBoundingClientRect().width);
      out.chkH = Math.min(...[...root.querySelectorAll('.psr-chk')].map(x => Math.round(x.getBoundingClientRect().height)));
      out.selH = Math.min(...[...root.querySelectorAll('.psrSel')].map(x => Math.round(x.getBoundingClientRect().height)));
      out.footH = Math.min(...[...root.querySelectorAll('.mfoot button')].map(x => Math.round(x.getBoundingClientRect().height)));
      out.thumbs = [...root.querySelectorAll('.psr-row')].map(r => r.querySelectorAll('.psr-th img').length);
      out.rowOver = [...root.querySelectorAll('.psr-row')].some(r => r.getBoundingClientRect().right > 390);
      closeModal();
      return out;
    });
    assert.equal(r.btn, '🧭 10', 'PHONE short label next to the ✨ bulk button (one line) ' + JSON.stringify(r));
    assert(r.barH <= 70, 'PHONE summary bar stays one line ' + JSON.stringify(r));
    assert(r.btnH >= 44 && r.pageW <= 390 && r.modal && r.scrollW <= 390 && !r.rowOver, 'PHONE button 44px, no horizontal overflow ' + JSON.stringify(r));
    assert(r.chkH >= 44 && r.selH >= 44 && r.footH >= 44, 'PHONE 44px targets ' + JSON.stringify(r));
    assert.deepEqual(r.thumbs, [1, 1, 3, 1, 1, 2], 'PHONE thumbnails per row ' + JSON.stringify(r.thumbs));
    await m.context.close();
  });

  await test('⑥ 소스 훅 · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /PHOTO_SUGGEST_SURE=\['gps','revisit','partial'\]/, 'schedule clue stays advisory');
    assert.match(SRC, /snapped=await hjSnapshot\('AI 자동 정리 전',true,true\)/, 'AI auto-organize apply snapshots first');
    assert.match(SRC, /if\(t\.id==='btnSuggestReview'\)\{e\.stopPropagation\(\);return hjPhotoSuggestReview\(\{from:'tab'\}\);\}/, 'click delegation');
    assert.match(SRC, /\[data-suggest\],#btnSuggestAll,#btnSuggestReview,/, 'closest selector list');
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`photoassign-v523: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL photoassign-v523', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

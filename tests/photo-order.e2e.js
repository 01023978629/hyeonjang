/* photo-order.e2e.js — 사진 탭 묶음 정렬 규칙 (Playwright)

   2026-08-14 대표 지시: "맨 위 미지정 프로젝트, 다음 우선순위 날짜별 최신순".

   배경: 이 화면은 새로 들어온 사진을 현장에 배정하는 화면이다. 예전 정렬은
   위치 있는 묶음 먼저 → 같은 위치끼리 → **날짜 오름차순**이라, 방금 찍어 올린
   사진이 목록 한참 아래에 묻혔다. 위치가 있는 옛날 사진이 위를 다 차지했다.

     ① 현장 미지정 묶음이 배정된 묶음보다 항상 위
     ② 미지정끼리는 날짜 최신순
     ③ 배정된 묶음끼리도 날짜 최신순
     ④ 절반만 배정된 묶음도 '미지정' 취급 — 아직 손이 필요하다
     ⑤ 위치(GPS·주소)가 있다고 위로 올라가지 않는다 (옛 규칙의 핵심이 뒤집혔는지)
     ⑥ 날짜 없는 묶음은 맨 뒤
     ⑦ 미지정 묶음에 '현장 미지정 N장' 배지가 보인다
     ⑧ 같은 날짜는 바로 위와 같은 현장 묶음이 우선
     ⑨ pageerror 0

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
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 시드: 사진 6장 → 촬영시각을 6시간 이상 벌려 서로 다른 묶음이 되게 한다.
  //   old-located  : 2026-01-05 · 배정됨 · GPS 있음   (옛 규칙이라면 맨 위였을 것)
  //   new-unassign : 2026-08-10 · 미지정 · GPS 없음   → 새 규칙에서 1위
  //   old-unassign : 2026-02-01 · 미지정             → 2위
  //   half         : 2026-08-12 · 2장 중 1장만 배정   → 미지정 취급, 날짜가 제일 최신이라 0위
  //   new-assigned : 2026-08-11 · 배정됨             → 미지정 뒤, 배정된 것 중 1위
  //   nodate       : 날짜 없음 · 배정됨              → 맨 뒤
  const setup = await page.evaluate(() => {
    const d = (s) => new Date(s);
    state.projects = [
      { name: '둔산현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false },
      { name: '은행현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }
    ];
    state.files = [
      { id: 'p_oldloc', name: 'old-located.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-01-05T09:00:00'), lat: 36.32, lng: 127.41, address: '대전 중구 어딘가' },
      { id: 'p_newun', name: 'new-unassigned.jpg', ext: 'jpg', kind: 'photo', project: '', when: d('2026-08-10T09:00:00') },
      { id: 'p_oldun', name: 'old-unassigned.jpg', ext: 'jpg', kind: 'photo', project: '', when: d('2026-02-01T09:00:00') },
      { id: 'p_half_a', name: 'half-a.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-12T09:00:00') },
      { id: 'p_half_b', name: 'half-b.jpg', ext: 'jpg', kind: 'photo', project: '', when: d('2026-08-12T09:05:00') },
      { id: 'p_newas', name: 'new-assigned.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-11T09:00:00') },
      { id: 'p_same_a_late', name: 'same-a-late.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-09T23:00:00') },
      { id: 'p_same_b_mid', name: 'same-b-mid.jpg', ext: 'jpg', kind: 'photo', project: '은행현장', when: d('2026-08-09T15:00:00') },
      { id: 'p_same_a_early', name: 'same-a-early.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-09T07:00:00') },
      { id: 'p_nodate', name: 'nodate.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: null }
    ];
    state.tab = 'photos'; state.activeProject = null; state.search = '';
    if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    render();
    return { n: state.files.length };
  });
  assert(setup.n === 10, '시드가 안 들어갔다');
  await page.waitForTimeout(600);

  // 실제 화면에 그려진 묶음 순서를 읽는다(정렬 함수가 아니라 결과를 본다)
  const order = await page.evaluate(() => {
    const cs = window.__clusters || [];
    return cs.map(c => ({
      ids: c.items.map(p => p.id),
      unassigned: c.items.some(p => !p._dup && !p.project),
      when: (c.items.find(p => p.when) || {}).when ? new Date(c.items.find(p => p.when).when).toISOString().slice(0, 10) : null
    }));
  });
  const has = (i, id) => order[i] && order[i].ids.indexOf(id) >= 0;
  const idxOf = (id) => order.findIndex(c => c.ids.indexOf(id) >= 0);
  const dbg = JSON.stringify(order.map(c => c.ids.join('+') + (c.unassigned ? '(미지정)' : '') + '@' + c.when));

  // ①④ 미지정(절반 배정 포함)이 전부 배정된 묶음보다 앞
  const lastUn = order.map((c, i) => c.unassigned ? i : -1).reduce((a, b) => Math.max(a, b), -1);
  const firstAs = order.findIndex(c => !c.unassigned);
  assert(lastUn >= 0 && firstAs >= 0, '시드가 미지정/배정 두 종류를 다 만들지 못했다: ' + dbg);
  assert(lastUn < firstAs, '① 미지정 묶음이 배정된 묶음보다 뒤에 있다: ' + dbg);

  // ④ 절반만 배정된 묶음도 미지정 취급
  assert(order[idxOf('p_half_b')].unassigned, '④ 절반 배정 묶음이 미지정으로 안 잡힌다: ' + dbg);
  assert(idxOf('p_half_b') < firstAs, '④ 절반 배정 묶음이 위로 안 올라왔다: ' + dbg);

  // ② 미지정끼리 날짜 최신순 — 2026-08-12(half) > 2026-08-10(newun) > 2026-02-01(oldun)
  assert(idxOf('p_half_b') < idxOf('p_newun'), '② 미지정 최신순이 아니다(08-12가 08-10보다 뒤): ' + dbg);
  assert(idxOf('p_newun') < idxOf('p_oldun'), '② 미지정 최신순이 아니다(08-10이 02-01보다 뒤): ' + dbg);

  // ③ 배정된 묶음끼리도 최신순 — 2026-08-11 > 2026-01-05
  assert(idxOf('p_newas') < idxOf('p_oldloc'), '③ 배정 묶음이 최신순이 아니다: ' + dbg);

  // ⑤ 위치가 있다고 위로 올라가지 않는다 (옛 규칙이 되살아나면 여기서 걸린다)
  assert(idxOf('p_oldloc') > firstAs - 1 && idxOf('p_oldloc') > idxOf('p_newun'),
    '⑤ GPS 있는 옛 사진이 다시 맨 위로 올라왔다 — 옛 정렬 규칙이 돌아왔다: ' + dbg);
  assert(!has(0, 'p_oldloc'), '⑤ 첫 묶음이 GPS 있는 옛 사진이다: ' + dbg);

  // ⑥ 날짜 없는 배정 묶음은 맨 뒤
  assert(idxOf('p_nodate') === order.length - 1, '⑥ 날짜 없는 묶음이 맨 뒤가 아니다: ' + dbg);

  // ⑦ 배지
  const badge = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.cluster .cluster-h')];
    return {
      first: heads[0] ? (heads[0].querySelector('.unassigned-badge') || {}).textContent || '' : '',
      count: document.querySelectorAll('.unassigned-badge').length
    };
  });
  assert(/현장 미지정/.test(badge.first), '⑦ 첫 묶음에 "현장 미지정" 배지가 없다: ' + JSON.stringify(badge));
  assert(badge.count === 3, '⑦ 미지정 배지 개수가 3이 아니다(half·newun·oldun): ' + badge.count);

  // ⑧ 같은 날짜에서는 첫 묶음(23시 A) 바로 아래에 같은 현장(07시 A)이 오고, 다른 현장(15시 B)은 그다음이다.
  assert(idxOf('p_same_a_late') < idxOf('p_same_a_early') && idxOf('p_same_a_early') < idxOf('p_same_b_mid'),
    '⑧ 같은 날짜의 같은 현장이 이어지지 않는다: ' + dbg);

  assert(errors.length === 0, '⑨ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 미지정 묶음이 맨 위');
  console.log('PASS  ② 미지정끼리 날짜 최신순');
  console.log('PASS  ③ 배정 묶음도 날짜 최신순');
  console.log('PASS  ④ 절반만 배정된 묶음도 미지정 취급');
  console.log('PASS  ⑤ GPS 있다고 위로 올라가지 않는다');
  console.log('PASS  ⑥ 날짜 없는 묶음은 맨 뒤');
  console.log('PASS  ⑦ 현장 미지정 배지');
  console.log('PASS  ⑧ 같은 날짜는 위와 같은 현장 우선');
  console.log('PASS  ⑨ pageerror 0');
  console.log('\n전부 통과 (9건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

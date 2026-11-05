/* v556 사진 탭 같은 사진 쌍 접기 — 11/5 대표 폰(서버 자료): 한 사진에 기록이 둘(정리된 기록 + 원본 폴더에 남은 미배정 기록)이라 모든 사진이 두 장씩 보였다. 합성 자료만, 외부 쓰기 0.
   ① 폰 390: 같은 크기·촬영시각 쌍은 대표 한 장(현장 있는 정리본)만 그려지고 그 장에 '📎 사본 1'(title 에 접힌 기록의 현장·작업명) · 다른 사진은 그대로 · 중복 의심 수는 종전처럼 전체에서 셈 · 자료 불변 (FOLD)
   ② 폰: 도구 더보기 안 [📎 같은 사진 n장 접음 · 펼치기] → 둘 다 보이고 배지 없음 → 다시 접기. '의심 사진 보기'는 종전 그대로 둘 다 (TOGGLE)
   ③ 크기 0 이거나 촬영시각 없는 묶음은 접지 않음 · 대표 고르기(현장 > _정리완료/ > 그 현장 이름 폴더 > 작업명 > Drive 연결 > 첫 장) (RULES)
   ④ PC 1280: 요약 줄에 토글, 접힘 동작 같음 · 선택 모드에서 접힌 기록은 선택칸이 없음(펼치면 생김) (PC)
   ⑥ (11/5 저녁 PC 자료 101쌍: 같은 현장 78·한쪽 미배정 7·다른 현장 16) 다른 현장 두 곳의 같은 사진은 접지 않고 둘 다 ⚠ · 현장별 보기도 같은 현장 쌍을 접고 📎, 토글로 펼침 (CROSS)
   ⑤ 소스·핀 3곳(v556 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V556_BASELINE=<commit> 은 ① 에서, HJ_V556_MUTATION=nofold(접기 끔)는 ① 에서 실패해야 한다. */
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
const MUT = process.env.HJ_V556_MUTATION || '';
let html = process.env.HJ_V556_BASELINE ? execFileSync('git', ['show', process.env.HJ_V556_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'nofold');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "const __twOn=!__photoTwinsOpen&&!__showDup&&__tw.n>0;";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, "const __twOn=false;");
}
const GA = 'T556 탄방동 빌라';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS phototwins-v556 ' + name); }
async function open({ width, mobile }) {
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
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile, ga, px }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0;
    try { closeModal(true); } catch (_) {}
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    state.projects.push({ name: ga, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
    const ph = (id, project, when, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 50000, when: when ? new Date(when) : null, handle: null, _file: null, _virtual: true, thumb: px, text: '', ocr: 'done', lat: null, lng: null, place: null, address: null, est: null, contact: null }, extra || {});
    const T = '2026-10-21T14:10:00+09:00';
    state.files = [
      // 쌍 1 — 정리본(현장 있음, 작업명) ↔ 원본 폴더에 남은 미배정 기록(다른 작업명): 같은 크기·같은 촬영시각
      ph('org1', ga, T, { prefix: '_정리완료/' + ga + '/', _worklabel: '보일러·난방 분배기 확인 (10/21)', size: 777001 }),
      ph('raw1', null, T, { _worklabel: '10/21 탄방동 보일러·분배기 사진 — 현장 확인필요', size: 777001 }),
      // 쌍 2 — 둘 다 미배정, 한쪽만 작업명(대표 = 작업명 있는 쪽)
      ph('raw2a', null, '2026-10-21T14:12:00+09:00', { size: 777002 }),
      ph('raw2b', null, '2026-10-21T14:12:00+09:00', { size: 777002, _worklabel: '분배기 밸브' }),
      // 다른 사진(크기 다름) — 접히지 않음
      ph('solo', null, '2026-10-21T14:15:00+09:00', { size: 777003 }),
      // 크기 0·촬영시각 없는 두 기록 — 중복 의심 묶음이 되더라도 접지 않는다
      ph('zero1', null, null, { size: 0 }), ph('zero2', null, null, { size: 0 })
    ];
    __photoCache.key = null; __photoTwinsOpen = false; __showDup = false; state.tab = 'photos'; state.activeProject = null; state.search = ''; render();
  }, { keys: BOOT, mobile: !!mobile, ga: GA, px: PX });
  return { context, page };
}
const look = page => page.evaluate(() => {
  const cells = [...document.querySelectorAll('#view .cluster-body .ph')];
  const ids = cells.map(c => { const i = c.querySelector('input[data-sel]'); return i ? i.dataset.sel : (c.querySelector('[data-pid]') || {}).dataset?.pid || '?'; });
  const twins = [...document.querySelectorAll('#view .ph-twin')].map(b => ({ of: b.dataset.twinOf, text: b.textContent.trim(), title: b.title }));
  const bar = document.querySelector('#view .photo-bar');
  const dup = bar ? (bar.textContent.match(/중복 의심\s*(\d+)/) || [])[1] : '';
  const btn = document.getElementById('btnTwinToggle');
  const live = serializeData(); live.savedAt = '';
  return { cells: cells.length, ids, twins, dup: dup || '', btn: btn ? { text: btn.textContent.trim(), pressed: btn.getAttribute('aria-pressed'), visible: !!btn.getClientRects().length } : null, over: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth, state: paidStableJson(live) };
});
const cellIds = page => page.evaluate(() => [...document.querySelectorAll('#view .cluster-body .ph')].map(c => { const img = c.querySelector('img[data-pid],img[data-id]'); const i = c.querySelector('input[data-sel]'); return i ? i.dataset.sel : img ? (img.dataset.pid || img.dataset.id) : c.outerHTML.match(/data-(?:sel|pid|id)="([^"]+)"/)?.[1] || '?'; }));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page: ph } = await open({ width: 390, mobile: true });
  let before;

  await test('① 폰: 같은 사진 쌍은 대표 한 장 + 📎 사본 1 · 다른 사진 그대로 · 중복 의심 수는 전체 · 자료 불변 (FOLD)', async () => {
    const r = await look(ph); before = r.state;
    const ids = await cellIds(ph);
    assert.equal(r.cells, 5, '7 records → 5 cards (two pairs folded, zero-size pair kept): ' + ids.join(','));
    assert(ids.includes('org1') && !ids.includes('raw1'), 'pair 1 shows the organized record only: ' + ids.join(','));
    assert(ids.includes('raw2b') && !ids.includes('raw2a'), 'pair 2 shows the labelled record: ' + ids.join(','));
    assert(ids.includes('solo') && ids.includes('zero1') && ids.includes('zero2'), 'solo and zero-size records stay');
    assert.deepEqual(r.twins.map(t => [t.of, t.text]).sort(), [['org1', '📎 사본 1'], ['raw2b', '📎 사본 1']], JSON.stringify(r.twins));
    const t1 = r.twins.find(t => t.of === 'org1');
    assert(t1.title.includes('현장 없음') && t1.title.includes('현장 확인필요') && t1.title.includes('현장사진/'), 'badge title names the folded record: ' + t1.title);
    assert.equal(r.dup, '3', '중복 의심 still counts all suspected copies (pair1 + pair2 + zero pair) — got ' + r.dup);
    assert.equal(r.over, 0, 'no horizontal overflow');
  });

  await test('② 폰: 도구 더보기 [📎 같은 사진 2장 접음 · 펼치기] → 둘 다 · 배지 없음 → 접기 · 의심 사진 보기 종전 그대로 (TOGGLE)', async () => {
    await ph.locator('#btnPhotoMore').click();
    let r = await look(ph);
    assert(r.btn && r.btn.visible && r.btn.pressed === 'true' && /📎 같은 사진 2장 접음 · 펼치기/.test(r.btn.text), 'toggle in the phone tools: ' + JSON.stringify(r.btn));
    await ph.locator('#btnTwinToggle').click();
    r = await look(ph);
    const ids = await cellIds(ph);
    assert.equal(r.cells, 7, 'unfolded: all 7 cards ' + ids.join(','));
    assert.deepEqual(r.twins, [], 'no badge while unfolded');
    assert.equal(r.state, before, 'state unchanged by toggling');
    if (!(await ph.locator('#btnTwinToggle').isVisible())) await ph.locator('#btnPhotoMore').click();   // 도구 더보기 펼침은 그대로 남는다
    await ph.locator('#btnTwinToggle').click();
    r = await look(ph); assert.equal(r.cells, 5, 'folded again');
    // 의심 사진 보기 — 묶음마다 둘 다(기준 + 의심), 접기와 무관
    await ph.locator('#btnToggleDup').click();
    const dupView = await ph.evaluate(() => ({ groups: document.querySelectorAll('#view .cluster').length, cells: document.querySelectorAll('#view .cluster-body .ph').length, back: !!document.getElementById('btnToggleDup') }));
    assert.deepEqual([dupView.groups, dupView.cells], [3, 6], '의심 사진 보기 shows every suspected pair: ' + JSON.stringify(dupView));
    await ph.locator('#btnToggleDup').click();
    assert.equal((await look(ph)).cells, 5, 'back to the folded grid');
  });

  await test('③ 규칙: 크기 0·촬영시각 없음은 안 접음 · 대표 고르기 순서 (RULES)', async () => {
    const r = await ph.evaluate(() => {
      const P = (o) => Object.assign({ id: 'x', size: 10, when: new Date('2026-10-21T00:00:00Z'), project: null, prefix: '현장사진/' }, o);
      const pick = g => hjPhotoTwinPick(g).id;
      return {
        zero: hjPhotoTwinFold([[P({ id: 'a', size: 0 }), P({ id: 'b', size: 0 })]]).n,
        undated: hjPhotoTwinFold([[P({ id: 'a', when: null }), P({ id: 'b', when: null })]]).n,
        single: hjPhotoTwinFold([[P({ id: 'a' })]]).n,
        project: pick([P({ id: 'a', _worklabel: '라벨', prefix: '_정리완료/x/' }), P({ id: 'b', project: '현장' })]),
        organized: pick([P({ id: 'a', _worklabel: '라벨' }), P({ id: 'b', prefix: '_정리완료/x/' })]),
        label: pick([P({ id: 'a' }), P({ id: 'b', _phase: '타일' })]),
        drive: pick([P({ id: 'a' }), P({ id: 'b', _driveId: 'd1' })]),
        ownFolder: pick([P({ id: 'a', project: '가온마을', prefix: '_정리완료/세종 가온마을/2차 방수/' }), P({ id: 'b', project: '가온마을', prefix: '_정리완료/가온마을/현장사진/' })]),
        first: pick([P({ id: 'a' }), P({ id: 'b' })])
      };
    });
    assert.deepEqual(r, { zero: 0, undated: 0, single: 0, project: 'b', organized: 'b', label: 'b', drive: 'b', ownFolder: 'b', first: 'a' }, JSON.stringify(r));
  });

  await test('④ PC 1280: 요약 줄 토글 · 접힘 같음 · 선택 모드에서 접힌 기록은 선택칸 없음, 펼치면 생김 (PC)', async () => {
    const { page: pc } = await open({ width: 1280, mobile: false });
    let r = await look(pc); const pcBefore = r.state;
    assert(r.btn && r.btn.visible && r.btn.pressed === 'true' && /접음 · 펼치기/.test(r.btn.text), 'toggle in the PC photo bar: ' + JSON.stringify(r.btn));
    assert.equal(r.cells, 5, 'PC folded');
    await pc.locator('#btnSelMode').click();
    let sel = await pc.evaluate(() => [...document.querySelectorAll('#view input[data-sel]')].map(i => i.dataset.sel));
    assert(sel.includes('org1') && !sel.includes('raw1'), 'folded record has no select box: ' + sel.join(','));
    await pc.locator('#btnTwinToggle').click();
    sel = await pc.evaluate(() => [...document.querySelectorAll('#view input[data-sel]')].map(i => i.dataset.sel));
    assert(sel.includes('raw1') && sel.includes('raw2a'), 'unfolded: every record selectable: ' + sel.join(','));
    r = await look(pc); assert.equal(r.cells, 7, 'PC unfolded'); assert.equal(r.state, pcBefore, 'state unchanged (PC)');
  });

  await test('⑥ 다른 현장 쌍은 접지 않고 ⚠ · 현장별 보기도 같은 현장 쌍 접힘·토글 (CROSS)', async () => {
    const { page: pp } = await open({ width: 1280, mobile: false });
    const OTHER = 'T556 다른 현장';
    await pp.evaluate(({ ga, other }) => {
      state.projects.push({ name: other, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
      const base = state.files.find(f => f.id === 'org1');
      const mk = (id, project, prefix, size, when) => Object.assign({}, base, { id, name: id + '.jpg', project, prefix, size, when: new Date(when), _worklabel: '' });
      state.files.push(mk('x1', ga, '_정리완료/' + ga + '/', 888001, '2026-10-22T10:00:00+09:00'), mk('x2', other, '_정리완료/' + other + '/', 888001, '2026-10-22T10:00:00+09:00'),
        mk('p1', ga, '_정리완료/' + ga + '/A/', 888002, '2026-10-22T11:00:00+09:00'), mk('p2', ga, '_정리완료/세종 ' + ga + '/B/', 888002, '2026-10-22T11:00:00+09:00'));
      __photoCache.key = null; __photoTwinsOpen = false; state.tab = 'photos'; render();
    }, { ga: GA, other: OTHER });
    let ids = await cellIds(pp);
    assert.equal(ids.length, 8, '11 records → 8 cards (pair1·pair2·p-pair folded, cross pair kept): ' + ids.join(','));
    assert(ids.includes('x1') && ids.includes('x2') && ids.includes('p1') && !ids.includes('p2'), ids.join(','));
    let cross = await pp.evaluate(() => [...document.querySelectorAll('#view [data-twin-cross]')].map(b => [b.dataset.twinCross, b.textContent.trim()]));
    assert.deepEqual(cross.sort(), [['x1', '⚠ 다른 현장에도: T556 다른 현장'], ['x2', '⚠ 다른 현장에도: T556 탄방동 빌라']], JSON.stringify(cross));
    // 현장별 보기 — 이 현장 사진: org1(미배정 사본은 다른 곳) · x1(⚠) · p1/p2(같은 현장 쌍 → 하나)
    await pp.evaluate(ga => { state.tab = 'project'; state.activeProject = ga; __projView = null; __projPhotoOpen.add(ga); render(); }, GA);
    const pv = () => pp.evaluate(() => ({ ids: [...document.querySelectorAll('#view .phase-group .cluster-body .ph')].map(c => (c.querySelector('input[data-sel]') || {}).dataset?.sel || '?'),
      twins: [...document.querySelectorAll('#view .phase-group [data-twin-of]')].map(b => b.dataset.twinOf).sort(), cross: [...document.querySelectorAll('#view .phase-group [data-twin-cross]')].map(b => b.dataset.twinCross),
      btn: (document.getElementById('btnTwinToggle') || {}).textContent || '', head: ([...document.querySelectorAll('#view span')].find(e => /현장 사진 · \d+ · 날짜별/.test(e.textContent)) || {}).textContent || '',
      over: [...document.querySelectorAll('#view .phase-group .ph')].some(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.ph-twin-ov')].some(b => { const q = b.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }); }) }));
    let r = await pv();
    assert.deepEqual(r.ids.slice().sort(), ['org1', 'p1', 'x1'], 'project view folded: ' + r.ids.join(','));
    assert.deepEqual([r.twins, r.cross], [['org1', 'p1'], ['x1']], JSON.stringify(r));
    assert(/📎 같은 사진 1장 접음 · 펼치기/.test(r.btn) && /현장 사진 · 3 · 날짜별/.test(r.head) && !r.over, JSON.stringify(r));
    await pp.locator('#btnTwinToggle').click();
    r = await pv();
    assert.deepEqual(r.ids.slice().sort(), ['org1', 'p1', 'p2', 'x1'], 'project view unfolded: ' + r.ids.join(','));
    assert.deepEqual(r.twins, [], 'no 📎 while unfolded'); assert.deepEqual(r.cross, ['x1'], '⚠ stays while unfolded');
    await pp.locator('#btnTwinToggle').click();
    assert.equal((await pv()).ids.length, 3, 'folded again');
  });

  await test('⑤ 소스·핀 3곳(v556 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes('function hjPhotoTwinFold(dupSets){') && src.includes('function hjPhotoTwinPick(g){') && src.includes("id==='btnTwinToggle'"), 'v556 source markers');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 556, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('phototwins-v556: ' + passed + '/6 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL phototwins-v556', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

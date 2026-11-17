/* v610 사진 탭 '현장 방문' 묶음 머리에 🏢 동·호수 — 대표 11/17 "현장 방문에 동호수도 보이게 코드 수정해줘". 합성 자료만, 외부 쓰기 0.
   ① PC 1280 (CHIP) — 사진에 연결해 둔 세대(_aptUnit)만 읽는다:
      · 세대 하나·모두 연결 = '🏢 101동 501호'(현장 방문 묶음, 장수 없음)
      · 여럿 + 세대 연결 안 한 사진 = '101동 501호 2장 · 102동 1203호 1장 · 미지정 1장' — 장수 많은 순, 현장 없는 사진은 미지정에 안 셈('현장 미지정 1장' 배지가 센다)
      · 셋이면 '… 외 1곳'(같은 장수면 먼저 찍은 순) · title 에 전부 · 공용부는 그 이름('🏢 지하주차장')
      · 끊긴 연결(지운 세대)·연결 없는 묶음·동·호수를 안 쓰는 현장(다른 현장을 가리키는 연결)엔 칩 없음
      · 자리 — '현장 미지정' 배지·재방문 뒤, 위치 앞 · 그리기만으로 자료 불변
   ② 폰 390 모바일 모드 (PHONE) — 밝은 화면 · 어두운 화면 + 큰 글씨 2단계: 칩이 머리 안 · 가로 넘침 0 · 글자 대비 4.5↑ · 칩 없는 묶음 머리엔 칩 없음
   ③ 바뀌면 따라감 (LIVE) — [동·호수 관리]와 같은 길(aptUnitAssign·aptUnitSave, 안전판·원자 저장)로: 연결하면 칩이 생김(사진 묶음 캐시가 연결을 본다) ·
      세대 동·호를 고치면 새 이름 · 꺾쇠·따옴표·& 든 공용부 이름은 글자로(칩 안에 요소가 안 생김) · 연결을 풀면 칩이 사라짐
   ④ 도움말 한 줄 · 핀 3곳(v610 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V610_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V610_MUTATION: no-chip(칩 빼기)·count-all(현장 없는 사진도 미지정으로 셈)·order-first(장수 대신 먼저 나온 순)는 ①,
   stale-cache(사진 묶음 캐시 열쇠에서 세대 연결 뺌)·no-escape(세대 이름을 그대로 HTML 로)는 ③ 에서 실패해야 한다. */
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
const MUT = {
  'no-chip': ['      ${revisit}\n      ${unitChip}\n', '      ${revisit}\n'],
  'count-all': ['rest:managed-linked,total:items.length}', 'rest:items.length-linked,total:items.length}'],
  'order-first': ['.sort((a,b)=>b.n-a.n||a.at-b.at)', '.sort((a,b)=>a.at-b.at)'],
  'stale-cache': ["+':'+hjPhotoLeakTag(p)+':'+(p._aptUnit?(p._aptUnit.project||'')+'/'+(p._aptUnit.unitId||''):'')).join('|')", "+':'+hjPhotoLeakTag(p)).join('|')"],
  'no-escape': ['<span aria-hidden="true">🏢 </span>${escapeHtml(text)}</span>`', '<span aria-hidden="true">🏢 </span>${text}</span>`']
};
let html = process.env.HJ_V610_BASELINE ? execFileSync('git', ['show', process.env.HJ_V610_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V610_MUTATION) {
  const m = MUT[process.env.HJ_V610_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V610_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
const GA = 'T608 아파트', GB = 'T608 빌라';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const ODD = '<img src=x onerror=alert(1)> "A&B"';

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open({ width, mobile }) {
  const context = await browser.newContext(mobile ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' } : { viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { errors.push('dialog:' + dialog.type() + ':' + dialog.message()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    if (mobile) { __mobileMode = true; applyMobileMode(); }
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
// 묶음 일곱: A 현장 방문(위치·세대 하나) · B 여럿+미지정+현장 없는 사진 · C 세 세대 · D 공용부(A 와 같은 자리 = 재방문) · E 끊긴 연결 · F 연결 없음 · G 동·호수 안 쓰는 현장
const seedView = page => page.evaluate(({ GA, GB, PX }) => {
  const U = (id, dong, ho) => ({ id, type: 'unit', dong, ho, name: '', note: '' });
  const base = name => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } });
  state.projects.push(Object.assign(base(GA), { aptUnits: [U('u1', '101', '501'), U('u2', '102', '1203'), { id: 'c1', type: 'common', dong: '', ho: '', name: '지하주차장', note: '' }] }), base(GB));
  let n = 0;
  const ph = (id, project, when, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 4096 + (++n) * 7, when: new Date(when), handle: null, _file: null, _virtual: true, thumb: PX, text: '', ocr: 'na', lat: null, lng: null, _phase: null, _worklabel: null }, extra || {});
  const L = unitId => ({ _aptUnit: { project: GA, unitId } }), G = { lat: 36.351, lng: 127.385 };
  state.files.push(
    ph('a1', GA, '2026-11-10T10:00:00+09:00', { ...L('u1'), ...G }), ph('a2', GA, '2026-11-10T10:05:00+09:00', { ...L('u1'), ...G }), ph('a3', GA, '2026-11-10T10:10:00+09:00', { ...L('u1'), ...G }),
    ph('b1', GA, '2026-11-11T09:00:00+09:00', L('u2')), ph('b2', GA, '2026-11-11T09:05:00+09:00', L('u1')), ph('b3', GA, '2026-11-11T09:10:00+09:00', L('u1')),
    ph('b4', GA, '2026-11-11T09:15:00+09:00'), ph('b5', null, '2026-11-11T09:20:00+09:00'),
    ph('c1p', GA, '2026-11-12T09:00:00+09:00', L('u1')), ph('c2p', GA, '2026-11-12T09:05:00+09:00', L('u2')), ph('c3p', GA, '2026-11-12T09:10:00+09:00', L('c1')),
    ph('d1', GA, '2026-11-13T10:00:00+09:00', { ...L('c1'), ...G }), ph('d2', GA, '2026-11-13T10:05:00+09:00', { ...L('c1'), ...G }),
    ph('e1', GA, '2026-11-14T09:00:00+09:00', L('gone')), ph('e2', GA, '2026-11-14T09:05:00+09:00', L('gone')),
    ph('f1', GA, '2026-11-15T09:00:00+09:00'), ph('f2', GA, '2026-11-15T09:05:00+09:00'),
    ph('g1', GB, '2026-11-16T09:00:00+09:00', L('u1')));
  __photoCache.key = null; state.tab = 'photos'; state.activeProject = null; state.search = ''; render();
}, { GA, GB, PX });
// 묶음마다(첫 사진 id 로) 머리 글·칩·머리 안 차례·칩 안 요소 수 — 칩이 없으면 chip:null
const heads = page => page.evaluate(() => {
  const out = {};
  for (const c of document.querySelectorAll('#view .cluster')) {
    const ids = [...c.querySelectorAll('input[data-sel]')].map(i => i.dataset.sel), h = c.querySelector('.cluster-h');
    if (!h || !ids.length) continue;
    const chip = h.querySelector('.cluster-unit');
    out[ids[0]] = { when: ((h.querySelector('.when') || {}).textContent || '').trim(), chip: chip ? chip.textContent.trim() : null, n: chip ? chip.dataset.clusterUnit : null, title: chip ? chip.title : null,
      kids: [...h.children].map(e => (e.className && String(e.className).split(' ')[0]) || e.tagName.toLowerCase()), inner: chip ? chip.querySelectorAll('*').length : 0, img: chip ? chip.querySelectorAll('img').length : 0,
      un: ((h.querySelector('.unassigned-badge') || {}).textContent || '').trim(), rv: ((h.querySelector('.revisit') || {}).textContent || '').trim() };
  }
  return out;
});
const data = page => page.evaluate(() => JSON.stringify([state.files.map(f => [f.id, f.project, f._aptUnit || null, f._phase, f._worklabel]), state.projects.map(p => [p.name, p.aptUnits || null])]));
const before = (kids, a, b) => kids.indexOf(a) >= 0 && kids.indexOf(b) >= 0 && kids.indexOf(a) < kids.indexOf(b);
async function test(name, fn) { await fn(); passed++; console.log('PASS visitunit-v610 ' + name); }
// 화면 모음(HJ_SHOTS)엔 안내 토스트를 빼고 찍는다
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }
const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const phoneLook = page => page.evaluate(() => {
  const rows = [];
  for (const chip of document.querySelectorAll('#view .cluster-h .cluster-unit')) {
    const h = chip.closest('.cluster-h'), r = chip.getBoundingClientRect(), hr = h.getBoundingClientRect(), cs = getComputedStyle(chip);
    rows.push({ text: chip.textContent.trim(), inside: r.left >= hr.left - 1 && r.right <= hr.right + 1, w: Math.round(r.width), color: cs.color, bg: cs.backgroundColor, fs: parseFloat(cs.fontSize) });
  }
  return { rows, over: document.documentElement.scrollWidth - innerWidth, chips: document.querySelectorAll('#view .cluster-unit').length };
});

(async () => {
  browser = await chromium.launch();
  try {
    let { context, page } = await open({ width: 1280 });
    await test('① PC — 세대 하나·여럿·미지정·외 n곳·공용부·없음 · 자리 · title · 자료 불변 (CHIP)', async () => {
      await seedView(page);
      const d0 = await data(page);
      const H = await heads(page);
      assert.deepEqual(Object.keys(H).sort(), ['a1', 'b1', 'c1p', 'd1', 'e1', 'f1', 'g1'], '묶음 일곱 ' + Object.keys(H));
      // A — 위치 있는 묶음 = '현장 방문', 세대 하나·모두 연결 = 장수 없이
      assert.ok(/^현장 방문 \d+ · /.test(H.a1.when), 'A 는 현장 방문 묶음 ' + H.a1.when);
      assert.deepEqual([H.a1.chip, H.a1.n, H.a1.title], ['🏢 101동 501호', '1', '동·호수 — 101동 501호 3장'], 'A 세대 하나 ' + JSON.stringify(H.a1));
      // B — 장수 많은 순(먼저 찍은 102동 이 뒤로) · 세대 연결 안 한 사진 1장 = 미지정 1장 · 현장 없는 사진은 '현장 미지정' 배지가 셈
      assert.equal(H.b1.chip, '🏢 101동 501호 2장 · 102동 1203호 1장 · 미지정 1장', 'B 여럿·미지정 ' + JSON.stringify(H.b1));
      assert.deepEqual([H.b1.n, H.b1.un], ['2', '현장 미지정 1장'], 'B 칩 수·현장 미지정 배지 ' + JSON.stringify(H.b1));
      assert.ok(before(H.b1.kids, 'when', 'unassigned-badge') && before(H.b1.kids, 'unassigned-badge', 'cluster-unit') && before(H.b1.kids, 'cluster-unit', 'where'), 'B 자리 — 현장 미지정 배지 뒤, 위치 앞 ' + H.b1.kids);
      // C — 세 세대 같은 장수 = 먼저 찍은 순 두 곳 + 외 1곳, title 에 전부
      assert.equal(H.c1p.chip, '🏢 101동 501호 1장 · 102동 1203호 1장 외 1곳', 'C 외 1곳 ' + JSON.stringify(H.c1p));
      assert.deepEqual([H.c1p.n, H.c1p.title], ['3', '동·호수 — 101동 501호 1장, 102동 1203호 1장, 지하주차장 1장'], 'C title ' + JSON.stringify(H.c1p));
      // D — 공용부 이름 · A 와 같은 자리라 재방문 2/2차 · 칩은 재방문 뒤
      assert.ok(/^현장 방문 \d+ · /.test(H.d1.when) && H.d1.chip === '🏢 지하주차장', 'D 공용부 ' + JSON.stringify(H.d1));
      assert.ok(/재방문 2\/2차/.test(H.d1.rv) && before(H.d1.kids, 'revisit', 'cluster-unit') && before(H.d1.kids, 'cluster-unit', 'where'), 'D 재방문 뒤 ' + JSON.stringify(H.d1));
      // E·F·G — 끊긴 연결 · 연결 없음 · 동·호수 안 쓰는 현장(다른 현장을 가리키는 연결) = 칩 없음
      assert.deepEqual([H.e1.chip, H.f1.chip, H.g1.chip], [null, null, null], '칩 없는 묶음 ' + JSON.stringify([H.e1, H.f1, H.g1]));
      assert.ok([H.a1, H.b1, H.c1p, H.d1].every(x => x.inner === 1 && x.img === 0), '칩 안에는 숨긴 아이콘 칸 하나뿐');
      await page.evaluate(() => { __photoCache.key = null; render(); render(); });
      assert.equal(await data(page), d0, '그리기만으로 자료 불변');
      await shot(page, 'v610-pc');
    });
    await context.close();

    ({ context, page } = await open({ width: 390, mobile: true }));
    await test('② 폰 390 — 밝은·어두운+큰 글씨 2단계: 칩이 머리 안 · 넘침 0 · 대비 4.5↑ (PHONE)', async () => {
      await seedView(page);
      const light = await phoneLook(page);
      assert.equal(light.chips, 4, '폰 칩 넷 ' + JSON.stringify(light));
      assert.ok(light.over <= 0, '가로 넘침 0 ' + light.over);
      for (const r of light.rows) {
        assert.ok(r.inside, '칩이 머리 안 ' + JSON.stringify(r));
        assert.ok(ratio(r.color, r.bg) >= 4.5, '밝은 화면 대비 ' + JSON.stringify(r) + ' ' + ratio(r.color, r.bg).toFixed(2));
        assert.ok(r.fs >= 12, '글자 12px 이상 ' + r.fs);
      }
      const H = await heads(page);
      assert.deepEqual([H.e1.chip, H.f1.chip, H.g1.chip], [null, null, null], '폰 칩 없는 묶음');
      await shot(page, 'v610-phone');
      await page.evaluate(() => { document.body.classList.add('dark'); document.body.classList.add('a11y-big2'); __photoCache.key = null; render(); });
      await page.waitForTimeout(400);   // 색 전환(transition) 끝난 뒤 잰다
      const dark = await phoneLook(page);
      assert.equal(dark.chips, 4, '어두운 화면 칩 넷');
      assert.ok(dark.over <= 0, '어두운+큰 글씨 가로 넘침 0 ' + dark.over);
      for (const r of dark.rows) {
        assert.ok(r.inside, '어두운 화면 칩이 머리 안 ' + JSON.stringify(r));
        assert.ok(ratio(r.color, r.bg) >= 4.5, '어두운 화면 대비 ' + JSON.stringify(r) + ' ' + ratio(r.color, r.bg).toFixed(2));
      }
      await shot(page, 'v610-phone-dark-big');
    });
    await context.close();

    ({ context, page } = await open({ width: 1280 }));
    await test('③ 연결·고치기·이상한 이름·풀기가 바로 보임 — 실제 저장 길 (LIVE)', async () => {
      await page.evaluate(async ({ GA, PX }) => {
        const ph = (id, when, extra) => Object.assign({ id, name: 'L608_' + id + '.jpg', prefix: '현장사진/', kind: 'photo', ext: 'jpg', size: 50000 + id.length * 13 + id.charCodeAt(id.length - 1), project: GA, when: new Date(when), place: null, address: null,
          thumb: PX, text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, _phase: null, _worklabel: null, _gdFolder: null, _driveId: null, _driveMimeType: null, _driveSize: 0,
          _relayLink: null, _file: null, _heicFile: null, _needHeic: false, _virtual: true, lat: null, lng: null }, extra || {});
        state.projects = [{ name: GA, stage: 1, received: 0, archived: false, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {},
          aptUnits: [{ id: 'u1', type: 'unit', dong: '101', ho: '501', name: '', note: '' }, { id: 'u2', type: 'unit', dong: '102', ho: '1203', name: '', note: '' }] }];
        state.files = [ph('a1', '2026-11-10T10:00:00+09:00', { _aptUnit: { project: GA, unitId: 'u1' } }), ph('a2', '2026-11-10T10:05:00+09:00', { _aptUnit: { project: GA, unitId: 'u1' } }),
          ph('f1', '2026-11-15T09:00:00+09:00'), ph('f2', '2026-11-15T09:05:00+09:00')];
        state.quotes = []; state.activeProject = null; state.search = ''; state.tab = 'photos'; state.dirty = false; __tabStale = false;
        __photoCache.key = null; render(); clearTimeout(__idbSaveTimer);
        if (!await guardedPersistCurrentState()) throw new Error('fixture persistence failed'); await __appStateWriteQueue;
        try { document.getElementById('hjPaidCommitRecovery')?.remove(); } catch (e) {}
      }, { GA, PX });
      let H = await heads(page);
      assert.deepEqual([H.a1 && H.a1.chip, H.f1 && H.f1.chip], ['🏢 101동 501호', null], '처음 ' + JSON.stringify(H));
      // 연결 — [동·호수 관리]의 배정과 같은 함수(안전판·원자 저장 뒤 앱이 다시 그린다). 캐시를 손으로 비우지 않는다
      await page.evaluate(GA => aptUnitAssign(GA, 'u2', ['f1', 'f2']), GA);
      H = await heads(page);
      assert.equal(H.f1 && H.f1.chip, '🏢 102동 1203호', '연결하면 칩이 생김(묶음 캐시가 연결을 봄) ' + JSON.stringify(H.f1));
      // 세대 동·호 고치기
      await page.evaluate(GA => aptUnitSave(GA, { type: 'unit', dong: '101', ho: '502' }, 'u1'), GA);
      H = await heads(page);
      assert.equal(H.a1 && H.a1.chip, '🏢 101동 502호', '세대 이름을 고치면 새 이름 ' + JSON.stringify(H.a1));
      // 꺾쇠·따옴표·& 든 공용부 이름은 글자로
      await page.evaluate(async ({ GA, ODD }) => { const id = await aptUnitSave(GA, { type: 'common', name: ODD }); await aptUnitAssign(GA, id, ['a1', 'a2']); }, { GA, ODD });
      H = await heads(page);
      assert.deepEqual([H.a1 && H.a1.chip, H.a1 && H.a1.inner, H.a1 && H.a1.img, H.a1 && H.a1.title], ['🏢 ' + ODD, 1, 0, '동·호수 — ' + ODD + ' 2장'], '이상한 이름은 글자로 ' + JSON.stringify(H.a1));
      // 연결 풀기 — 칩이 사라짐
      await page.evaluate(GA => aptUnitAssign(GA, '', ['f1', 'f2']), GA);
      H = await heads(page);
      assert.equal(H.f1 && H.f1.chip, null, '연결을 풀면 칩이 사라짐 ' + JSON.stringify(H.f1));
      assert.ok(!(await page.evaluate(() => !!document.getElementById('hjPaidCommitRecovery') || !!__tabStale)), '저장 사고 띠·오래된 창 없음');
      await shot(page, 'v610-live');
    });

    await test('④ 도움말 · 핀 3곳 · 페이지 오류 0 · 외부 쓰기 0', async () => {
      assert.ok(/<li><b>동·호수<\/b> — 현장의 \[동·호수 관리\]에서 세대를 연결해 둔 사진은 묶음 머리에/.test(html || SRC), '도움말 한 줄');
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 610, '핀 3곳 같음(v610 이상) ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('visitunit-v610: ' + passed + '/4');
  if (passed !== 4) process.exit(1);
})().catch(e => { console.error('FAIL visitunit-v610', e && e.stack || e); process.exit(1); });

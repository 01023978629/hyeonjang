/* v545 🧩 사진 공정·작업명 빈칸 묶음 채우기 — 대표 PDF 5번. 합성 자료만(가상 사진 기록), 외부 쓰기 0.
   ① 묶음·제안: 현장+촬영일 묶음 중 빈칸 있는 것만(보관 현장·미배정 사진 빼고) · 제안 작업명 = 같은 날 가장 많은 것 · 제안 공정 = 같은 날 공정 → 작업명(HJ_PHASE_MAP) → 그날 일정 ·
      미리 체크는 같은 날 사진에서 나온 제안만 · 창을 여는 것만으론 자료 불변 (GROUPS)
   ② 채우기: 체크한 묶음만 · 칩 누르면/작업명 적으면 체크 · 안전판 1회 · **빈칸만**(적힌 공정·작업명 그대로) · 공정표에 없던 공정은 공정표 끝에 · 즉시 이동 모드여도 폴더 이동 0 (FILL)
   ③ 안전판 실패 무변경 · 연 뒤 빈칸이 바뀌면 거부 · 고른 게 없으면 아무것도 안 함 (GUARD)
   ④ PC 사진 탭 '🧩 공정·작업명 빈칸 n장' 단추(폰 요약 줄은 한 줄 그대로 — 폰 입구는 v549) · 폰 390 창 칩·체크·작업명 44px · 가로 넘침 없음 (UI)
   ⑤ 소스·핀 3곳(v545 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0
   HJ_V545_BASELINE=<commit> 은 ① 에서, HJ_V545_MUTATION=no-snapshot(안전판 없이 채우면)은 ② 에서 실패해야 한다(안전판 1회). */
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
const A = 'TEST_V545 가온빌라 3층', B = 'TEST_V545 나래상가 1층', C = 'TEST_V545 보관 현장';
const MUT = process.env.HJ_V545_MUTATION || '';
let html = process.env.HJ_V545_BASELINE ? execFileSync('git', ['show', process.env.HJ_V545_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (MUT) {
  assert.equal(MUT, 'no-snapshot');
  html = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const needle = "let ok=false;try{ok=await hjSnapshot('공정·작업명 채우기 전',true,true);}catch(e){ok=false;}";
  assert.equal(html.split(needle).length, 2, 'mutation needle'); html = html.replace(needle, 'let ok=true;');
}
// 한국 시각 정오(날짜가 UTC 와 같은 날)
const T = d => Date.parse(d + 'T12:00:00+09:00');
const PHOTOS = [
  // A 10/10 — 2장은 '방수·욕실 방수', 2장은 빈칸 → 같은 날 제안(확실)
  ['a1', A, '2026-10-10', '방수', '욕실 방수'], ['a2', A, '2026-10-10', '방수', '욕실 방수'], ['a3', A, '2026-10-10', '', ''], ['a4', A, '2026-10-10', '', ''],
  // A 10/11 — 공정 없음 3, 작업명 1장('배관 교체') → 공정은 작업명에서 '설비'(참고)
  ['b1', A, '2026-10-11', '', '배관 교체'], ['b2', A, '2026-10-11', '', ''], ['b3', A, '2026-10-11', '', ''],
  // B 10/12 — 빈칸 2, 그날 일정 '타일 시공' → 공정 '타일'(참고), 작업명 제안 없음
  ['c1', B, '2026-10-12', '', ''], ['c2', B, '2026-10-12', '', ''],
  // B 10/13 — 다 채워짐(묶음 아님) · 보관 현장 C · 미배정 사진은 대상 아님
  ['d1', B, '2026-10-13', '도장', '현관 도장'], ['e1', C, '2026-10-12', '', ''], ['u1', '', '2026-10-12', '', '']
];

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function open(width) {
  const mobile = width < 600;
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
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
  await page.evaluate(async ({ keys, mobile, a, b, c, photos, times }) => {
    await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone;
    aiOpsEnsureState().enabled = false; taxCalendarEnsure(); coworkSchedEnsure();
    if (mobile) { __mobileMode = true; applyMobileMode(); }
    const P = (name, phases, archived) => Object.assign({ name, stage: 3, received: 0, phases, cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, archived ? { archived: true } : {});
    state.projects.push(P(a, ['철거', '설비', '방수']), P(b, []), P(c, [], true));
    const svg = c => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="' + c + '"/></svg>');
    photos.forEach(([k, project, date, phase, label], i) => state.files.push({ id: 'v545_' + k, name: 'IMG_V545_' + k + '.jpg', ext: 'jpg', kind: 'photo', project, prefix: '현장사진/', size: 2048, when: new Date(times[date] + i * 60000), handle: null, _file: null, _virtual: true, thumb: svg(['#7a9', '#a97', '#79a', '#aa7'][i % 4]), text: '', ocr: 'na', lat: null, lng: null, _phase: phase || null, _worklabel: label || null }));
    state.schedule.push({ id: 'v545s', date: '2026-10-12', time: '09:00', title: '타일 시공', project: b, workers: '', memo: '' });
    __photoCache.key = null; state.tab = 'photos'; state.activeProject = null; render();
  }, { keys: BOOT, mobile, a: A, b: B, c: C, photos: PHOTOS, times: { '2026-10-10': T('2026-10-10'), '2026-10-11': T('2026-10-11'), '2026-10-12': T('2026-10-12'), '2026-10-13': T('2026-10-13') } });
  return { context, page };
}
const data = page => page.evaluate(() => { const d = serializeData(); d.savedAt = ''; return paidStableJson(d); });
const tags = page => page.evaluate(() => Object.fromEntries(state.files.filter(f => /^v545_/.test(f.id)).map(f => [f.id.slice(5), [f._phase || '', f._worklabel || '']])));
const snapCount = page => page.evaluate(async () => ((await idbGet('hj_snaps')) || []).filter(s => /공정·작업명 채우기 전/.test(s.label || '')).length);
async function test(name, fn) { await fn(); passed++; console.log('PASS photofill-v545 ' + name); }
async function shot(page, name) { if (!process.env.HJ_SHOTS) return; fs.mkdirSync(process.env.HJ_SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.HJ_SHOTS, name + '.png'), animations: 'disabled' }); }

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const { page } = await open(1280);

  await test('① 묶음·제안·미리 체크 · 보관 현장·미배정 빼고 · 여는 것만으론 자료 불변 (GROUPS)', async () => {
    const before = await data(page);
    const g = await page.evaluate(() => hjPhotoFillGroups().map(g => ({ project: g.project, date: g.date, noPhase: g.noPhase.length, noLabel: g.noLabel.length, phase: g.phase, label: g.label, sure: g.sure, phaseWhy: g.phaseWhy })));
    const by = Object.fromEntries(g.map(x => [x.date + ' ' + x.project, x]));
    assert.deepEqual(Object.keys(by).sort(), ['2026-10-10 ' + A, '2026-10-11 ' + A, '2026-10-12 ' + B], 'groups ' + JSON.stringify(g));
    assert.deepEqual([by['2026-10-10 ' + A].noPhase, by['2026-10-10 ' + A].noLabel, by['2026-10-10 ' + A].phase, by['2026-10-10 ' + A].label, by['2026-10-10 ' + A].sure], [2, 2, '방수', '욕실 방수', true]);
    const g11 = by['2026-10-11 ' + A]; assert.deepEqual([g11.noPhase, g11.noLabel, g11.phase, g11.label, g11.sure], [3, 2, '설비', '배관 교체', false]); assert.match(g11.phaseWhy, /작업명/);
    const g12 = by['2026-10-12 ' + B]; assert.deepEqual([g12.phase, g12.label, g12.sure], ['타일', '', false]); assert.match(g12.phaseWhy, /그날 일정/);
    assert.equal(await page.evaluate(() => hjPhotoFillCount()), 7, 'distinct photos with a blank');
    await page.evaluate(() => hjPhotoFillView()); await page.locator('#hjPhotoFill [data-pf-row]').first().waitFor();
    assert.equal(await page.locator('#hjPhotoFill [data-pf-row]').count(), 3);
    assert.equal(await data(page), before, 'opening changes nothing');
    await page.evaluate(() => closeModal(true));
  });

  await test('② 체크한 묶음만 · 안전판 1회 · 빈칸만 · 공정표에 더함 · 폴더 이동 0 (FILL)', async () => {
    await page.evaluate(() => { __moveMode = 'instant'; window.__dirCalls = 0; const o = ensurePhaseDir; ensurePhaseDir = async (...a) => { window.__dirCalls++; return o(...a); }; });
    await page.evaluate(() => hjPhotoFillView()); await page.locator('#hjPhotoFill [data-pf-row]').first().waitFor();
    const row = date => page.locator('#hjPhotoFill [data-pf-row]').filter({ hasText: date });
    assert.equal(await row('2026-10-11').locator('[data-pf-check]').isChecked(), false);
    // 제안으로 눌려 있는 칩을 누르면 끄지 않고 줄만 체크
    assert.equal(await row('2026-10-11').locator('[data-pf-phase="설비"]').getAttribute('aria-pressed'), 'true', 'suggested chip pressed');
    await row('2026-10-11').locator('[data-pf-phase="설비"]').click();
    assert.equal(await row('2026-10-11').locator('[data-pf-check]').isChecked(), true, 'chip checks the row');
    assert.equal(await row('2026-10-11').locator('[data-pf-phase="설비"]').getAttribute('aria-pressed'), 'true', 'suggested chip stays on');
    // 다른 칩을 누르면 그것 하나만, 다시 누르면 꺼짐 → 원래 칩으로 되돌림
    await row('2026-10-11').locator('[data-pf-phase="방수"]').click();
    assert.deepEqual(await row('2026-10-11').locator('[data-pf-phase][aria-pressed="true"]').evaluateAll(n => n.map(x => x.dataset.pfPhase)), ['방수']);
    await row('2026-10-11').locator('[data-pf-phase="방수"]').click();
    assert.equal(await row('2026-10-11').locator('[data-pf-phase][aria-pressed="true"]').count(), 0, 'pressing again turns it off');
    await row('2026-10-11').locator('[data-pf-phase="설비"]').click();
    await row('2026-10-12').locator('[data-pf-label]').fill('욕실 타일');
    assert.equal(await row('2026-10-12').locator('[data-pf-check]').isChecked(), true, 'typing a label checks the row');
    const s0 = await snapCount(page);
    await page.locator('#modalRoot .mfoot button', { hasText: '체크한 묶음 채우기' }).click();
    await page.waitForFunction(() => !document.getElementById('hjPhotoFill'));
    assert.equal(await snapCount(page) - s0, 1, 'one snapshot');
    const t = await tags(page);
    assert.deepEqual([t.a1, t.a2, t.a3, t.a4], [['방수', '욕실 방수'], ['방수', '욕실 방수'], ['방수', '욕실 방수'], ['방수', '욕실 방수']]);
    assert.deepEqual([t.b1, t.b2, t.b3], [['설비', '배관 교체'], ['설비', '배관 교체'], ['설비', '배관 교체']], 'existing label kept, blanks filled');
    assert.deepEqual([t.c1, t.c2], [['타일', '욕실 타일'], ['타일', '욕실 타일']]);
    assert.deepEqual([t.d1, t.e1, t.u1], [['도장', '현관 도장'], ['', ''], ['', '']], 'filled group, archived project and unassigned untouched');
    const ph = await page.evaluate(({ a, b }) => [state.projects.find(p => p.name === a).phases, state.projects.find(p => p.name === b).phases], { a: A, b: B });
    assert.deepEqual(ph, [['철거', '설비', '방수'], ['타일']], 'new phase appended to the phase list only where missing');
    assert.equal(await page.evaluate(() => window.__dirCalls), 0, 'no folder moves even in instant mode');
    assert.equal(await page.evaluate(() => hjPhotoFillGroups().length), 0, 'no blanks left');
  });

  await test('③ 안전판 실패 무변경 · 연 뒤 바뀌면 거부 · 고른 것 없으면 무변경 (GUARD)', async () => {
    await page.evaluate(() => { const f = state.files.find(x => x.id === 'v545_d1'); f._phase = null; f._worklabel = null; __photoCache.key = null; });
    const seen = await page.evaluate(() => hjPhotoFillGroups().reduce((o, g) => { o[g.key] = hjPhotoFillSig(g); return o; }, {}));
    const pick = [{ project: B, date: '2026-10-13', phase: '도장', label: '현관 도장' }];
    let before = await data(page);
    await page.evaluate(() => { window.__snapReal = hjSnapshot; hjSnapshot = async () => false; });
    const r1 = await page.evaluate(({ pick, seen }) => hjPhotoFillApply(pick, seen), { pick, seen });
    await page.evaluate(() => { hjSnapshot = window.__snapReal; });
    assert.equal(r1.오류, '안전판', JSON.stringify(r1)); assert.equal(await data(page), before, 'snapshot failure changes nothing');
    await page.evaluate(() => { state.files.find(x => x.id === 'v545_d1')._phase = '도장'; });
    before = await data(page);
    const r2 = await page.evaluate(({ pick, seen }) => hjPhotoFillApply(pick, seen), { pick, seen });
    assert.equal(r2.오류, '바뀜'); assert.equal(await data(page), before, 'stale plan changes nothing');
    const r3 = await page.evaluate(() => hjPhotoFillApply([{ project: 'x', date: '2026-10-13', phase: '', label: '  ' }], {}));
    assert.equal(r3.채움, 0); assert.equal(await data(page), before);
  });

  await test("④ PC 사진 탭 단추 · 폰 요약 줄 그대로 · 폰 390 창 44px · 넘침 없음 (UI)", async () => {
    // PC 사진 탭 요약 줄의 단추
    await page.evaluate(() => { state.files.find(x => x.id === 'v545_a3')._phase = null; __photoCache.key = null; state.tab = 'photos'; render(); });
    const btn = await page.evaluate(() => { const b = document.getElementById('btnPhotoFill'); return b ? b.textContent : null; });
    assert(btn && /공정·작업명 빈칸 \d+장/.test(btn), 'PC photo tab button ' + JSON.stringify(btn));
    // 폰은 요약 줄 한 줄 약속(v523·photo-suggest) — 단추는 줄에 안 넣고(폰 입구는 v549 의 큰 단추) 창은 같은 함수로 연다
    const { page: pm } = await open(390);
    assert.equal(await pm.locator('#btnPhotoFill').count(), 0, 'phone summary bar unchanged');
    await pm.evaluate(() => hjPhotoFillView()); await pm.locator('#hjPhotoFill [data-pf-row]').first().waitFor();
    const ui = await pm.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return { over: m.scrollWidth - m.clientWidth, doc: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('#hjPhotoFill .hjpf-chk,#hjPhotoFill [data-pf-phase],#hjPhotoFill [data-pf-label],#modalRoot .mfoot button')].map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 44) }; });
    assert(ui.over <= 1 && ui.doc <= 0, 'no overflow ' + JSON.stringify(ui)); assert.deepEqual(ui.small, [], '44px controls');
    await shot(pm, 'v545-phone-photofill');
  });

  await test('⑤ 소스·핀 3곳(v545 이상·서로 같음) · 페이지 오류 0 · 외부 쓰기 0', async () => {
    const src = html || fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert(src.includes("if(t.id==='btnPhotoFill'){e.stopPropagation();return hjPhotoFillView();}"), 'photo tab entry wired');
    const pins = [(src.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests/version-sync.check.js'), 'utf8').match(/const TARGET_BUILD = '([^']+)'/) || [])[1]];
    assert(pins.every(p => p === pins[0]) && +((pins[0] || '').match(/-v(\d+)-/) || [])[1] >= 545, 'pins ' + JSON.stringify(pins));
    assert.deepEqual(errors, [], 'page errors'); assert.equal(network.writes, 0, 'no external writes');
  });

  console.log('photofill-v545: ' + passed + '/5 PASS; synthetic data; external writes=0');
  await browser.close();
})().catch(async error => { console.error('FAIL photofill-v545', error && error.stack || error); try { await browser.close(); } catch (_) {} process.exit(1); });

/* photo-suggest.e2e.js — 👉 추천 배정: 새로 들어온 사진 묶음에 현장을 알아서 제안하고 한 번에 배정 (Playwright)

   2026-09-04 대표 요청: "사진 분류를 더 편하게". 묶음마다 셀렉트에서 현장을 찾던 일을 없앤다.

     ① gps      묶음 GPS 가 현장 좌표 500m 안 → 그 현장 (현장 좌표가 없으면 그 현장 사진의 최대 묶음이 기준)
     ② revisit  현장 기준 좌표는 멀어도, 같은 자리(재방문 묶음)의 다른 방문이 배정돼 있으면 그 현장
     ③ sameday  GPS 없는 묶음은 같은 날 배정된 현장을 '참고'로만 제안 — 일괄 배정에는 넣지 않는다
     ④ partial  절반만 배정된 묶음은 나머지를 같은 현장으로
     ⑤ 근거 없는 묶음(멀리 떨어짐·같은 날 배정 없음)은 제안하지 않는다
     ⑥ 보관(archived) 현장은 후보에서 빠진다
     ⑦ 묶음 헤더의 👉 버튼 한 번으로 그 묶음의 현장 없는 사진만 배정된다(이미 배정된 사진 불변)
     ⑧ 「추천대로 전부 배정」은 확실한 것(gps·revisit·partial)만, 안전판 스냅샷 뒤에만 — 실패면 아무것도 바꾸지 않는다
     ⑨ 배정 뒤에는 그 묶음의 추천 버튼이 사라지고 셀렉트가 그 현장을 가리킨다
     ⑩ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(/\[data-geo\],\[data-suggest\],#btnSuggestAll,/.test(source), '클릭 위임 목록에 추천 버튼이 들어 있다');
assert(/PHOTO_SUGGEST_SURE=\['gps','revisit','partial'\]/.test(source), '일괄 배정은 gps·revisit·partial 만');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 시드 — 둔산(좌표) · 은행(좌표 없음, 배정 사진 2장이 기준) · 유성(좌표 없음, F1 에 3장이 최대 묶음, F2 에 1장) · 보관(archived, 좌표)
  const seed = await page.evaluate(() => {
    const d = (s) => new Date(s);
    const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
    const ph = (id, project, when, lat, lng, extra) => Object.assign({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: d(when), lat, lng, size: 100 + id.length * 7 + (when.length) }, extra || {});
    state.projects = [P('둔산현장', { lat: 36.35, lng: 127.38 }), P('은행현장'), P('유성현장'), P('보관현장', { archived: true, lat: 36.3505, lng: 127.3805 })];
    state.files = [
      ph('bank1', '은행현장', '2026-08-01T09:00:00', 36.3300, 127.4300), ph('bank2', '은행현장', '2026-08-01T09:10:00', 36.3299, 127.4301),
      ph('d1', '', '2026-08-01T15:30:00', null, null),                                   // ③ 같은 날(은행) · GPS 없음 · 6시간 넘게 떨어져 별도 묶음
      ph('yus1', '유성현장', '2026-08-02T09:00:00', 36.40, 127.30), ph('yus2', '유성현장', '2026-08-02T09:05:00', 36.40, 127.30), ph('yus3', '유성현장', '2026-08-02T09:10:00', 36.40, 127.30),
      ph('yus4', '유성현장', '2026-08-03T09:00:00', 36.36, 127.35),                       // 유성의 두 번째 자리(F2)
      ph('a1', '', '2026-08-10T09:00:00', 36.3503, 127.3803), ph('a2', '', '2026-08-10T09:05:00', 36.3503, 127.3803), // ① 둔산 40m
      ph('b1', '', '2026-08-11T09:00:00', 36.3302, 127.4302),                            // ① 은행(사진 기준)
      ph('c1', '', '2026-08-12T09:00:00', 36.3601, 127.3501),                            // ② F2 재방문 → 유성 (유성 기준 F1 은 6km 밖)
      ph('e1', '', '2026-08-13T09:00:00', 36.60, 127.10),                                // ⑤ 근거 없음
      ph('p1', '둔산현장', '2026-08-14T09:00:00', 36.3504, 127.3804), ph('p2', '', '2026-08-14T09:03:00', 36.3504, 127.3804), // ④ 절반 배정
    ];
    state.tab = 'photos'; state.activeProject = null; state.search = '';
    if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    render();
    const byFirst = {};
    (window.__clusters || []).forEach((c, i) => { const sg = window.__clusterSuggest[i]; byFirst[c.items[0].id] = sg ? { name: sg.name, why: sg.why, km: sg.km, ids: sg.ids } : null; });
    const view = document.querySelector('#view');
    return {
      byFirst,
      clusterCount: window.__clusters.length,
      btns: [...view.querySelectorAll('.suggest-btn')].map(b => ({ i: b.dataset.suggest, text: b.textContent.replace(/\s+/g, ' ').trim(), clay: b.classList.contains('clay') })),
      bar: (view.querySelector('#suggestBar') || {}).textContent || '',
    };
  });
  const S = seed.byFirst;
  assert(S.a1 && S.a1.name === '둔산현장' && S.a1.why === 'gps' && S.a1.km < 100 && S.a1.ids.join() === 'a1,a2', '① 둔산 40m: ' + JSON.stringify(S.a1));
  assert(S.b1 && S.b1.name === '은행현장' && S.b1.why === 'gps', '① 좌표 없는 현장은 배정 사진 묶음이 기준: ' + JSON.stringify(S.b1));
  assert(S.c1 && S.c1.name === '유성현장' && S.c1.why === 'revisit', '② 같은 자리 재방문: ' + JSON.stringify(S.c1));
  assert(S.d1 && S.d1.name === '은행현장' && S.d1.why === 'sameday', '③ GPS 없음 → 같은 날 배정 현장을 참고 제안: ' + JSON.stringify(S.d1));
  assert(S.p1 && S.p1.name === '둔산현장' && S.p1.why === 'partial' && S.p1.ids.join() === 'p2', '④ 절반 배정 묶음은 나머지만: ' + JSON.stringify(S.p1));
  assert(S.e1 === null, '⑤ 근거 없는 묶음은 제안 없음: ' + JSON.stringify(S.e1));
  assert(S.bank1 === null && S.yus1 === null && S.yus4 === null, '다 배정된 묶음은 제안 없음');
  assert(!Object.values(S).some(sg => sg && sg.name === '보관현장'), '⑥ 보관 현장은 후보에서 제외(둔산 옆에 같은 좌표로 두어도)');
  assert(seed.btns.length === 5, '헤더 추천 버튼 5개(a·b·c·d·p): ' + JSON.stringify(seed.btns));
  const dBtn = seed.btns.find(b => /은행현장 배정 참고: 같은 날 배정한 현장 \(확인 후 누르세요\)/.test(b.text));
  assert(dBtn && !dBtn.clay, '③ 참고 제안은 글로도 \'참고\'라 적고 강조하지 않는다: ' + JSON.stringify(dBtn));
  assert(seed.btns.filter(b => /^👉 /.test(b.text) && !/참고:/.test(b.text)).length === 4, '확실한 제안 4개에는 참고 표시가 없다');
  assert(seed.btns.filter(b => b.clay).length === 4, '확실한 제안 4개는 강조 버튼');
  assert(/추천이 확실한\s*4묶음/.test(seed.bar.replace(/\s+/g, ' ')) && /추천대로 전부 배정/.test(seed.bar) && /절반 배정된 묶음의 나머지/.test(seed.bar) && /안전판/.test(seed.bar), '⑧ 일괄 막대는 확실한 4묶음만 세고 무엇을 하는지 적는다: ' + seed.bar);

  // ⑦ 한 번 눌러 배정 — a 묶음
  const one = await page.evaluate(() => {
    const idx = window.__clusters.findIndex(c => c.items[0].id === 'a1');
    document.querySelector('#view .suggest-btn[data-suggest="' + idx + '"]').click();
    const f = id => state.files.find(x => x.id === id).project;
    return { a1: f('a1'), a2: f('a2'), b1: f('b1'), p1: f('p1'), p2: f('p2'), toast: document.querySelector('#toast').textContent };
  });
  assert(one.a1 === '둔산현장' && one.a2 === '둔산현장', '⑦ 묶음의 현장 없는 사진이 배정된다: ' + JSON.stringify(one));
  assert(one.b1 === '' && one.p2 === '' && one.p1 === '둔산현장', '⑦ 다른 묶음·이미 배정된 사진은 불변');
  assert(/2장을 “둔산현장”에 배정/.test(one.toast), '토스트: ' + one.toast);

  // ⑦ 절반 배정 묶음(p)의 버튼은 현장 없는 사진(p2)만 넘긴다 — 이미 배정된 p1 은 호출에도 끼지 않는다
  const partial = await page.evaluate(() => {
    const calls = []; const orig = assignProjectMany; assignProjectMany = (ids, p) => { calls.push({ ids: ids.slice(), p }); return orig(ids, p); };
    const idx = window.__clusters.findIndex(c => c.items[0].id === 'p1');
    document.querySelector('#view .suggest-btn[data-suggest="' + idx + '"]').click();
    assignProjectMany = orig;
    const f = id => state.files.find(x => x.id === id).project;
    return { calls, p1: f('p1'), p2: f('p2') };
  });
  assert(partial.calls.length === 1 && partial.calls[0].ids.join() === 'p2' && partial.calls[0].p === '둔산현장' && partial.p2 === '둔산현장', '⑦ 절반 배정 묶음은 나머지 사진만 넘긴다: ' + JSON.stringify(partial));

  // ⑨ 다시 그리면 a 묶음의 버튼은 없고 셀렉트가 둔산을 가리킨다
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const idx = window.__clusters.findIndex(c => c.items[0].id === 'a1');
    const h = [...document.querySelectorAll('#view .cluster')].find(el => el.querySelector('select[data-act=cluster]').dataset.ids.split(',').includes('a1'));
    return { btn: !!document.querySelector('#view .suggest-btn[data-suggest="' + idx + '"]'), sel: h.querySelector('select[data-act=cluster]').value, sg: window.__clusterSuggest[idx], bar: (document.querySelector('#suggestBar') || {}).textContent || '' };
  });
  assert(after.btn === false && after.sel === '둔산현장' && after.sg === null, '⑨ 배정 뒤 추천 버튼 사라짐·셀렉트 반영: ' + JSON.stringify(after));
  const focused = await page.evaluate(() => { const el = document.activeElement; return el && el.matches('select[data-act=cluster]') ? (el.dataset.ids.split(',').includes('p1') || el.dataset.ids.split(',').includes('a1')) : false; });
  assert(focused, '⑨ 원탭 뒤 포커스가 그 묶음의 현장 셀렉트로 간다');
  assert(/2묶음/.test(after.bar), '⑨ 일괄 막대 개수가 2로 준다(a·p 배정 뒤): ' + after.bar);

  // ⑧ 안전판 실패 → 아무것도 바꾸지 않는다
  const failed = await page.evaluate(async () => {
    window.__snapCalls = [];
    hjSnapshot = async (label) => { window.__snapCalls.push(label); return false; };
    const n = await photoSuggestApplyAll();
    const f = id => state.files.find(x => x.id === id).project;
    return { n, b1: f('b1'), c1: f('c1'), p2: f('p2'), d1: f('d1'), toast: document.querySelector('#toast').textContent, calls: window.__snapCalls };
  });
  assert(failed.n === 0 && failed.b1 === '' && failed.c1 === '' && failed.d1 === '', '⑧ 안전판 실패면 무변경: ' + JSON.stringify(failed));
  assert(/안전판을 만들지 못해/.test(failed.toast) && failed.calls.join() === '추천 배정 전', '⑧ 안전판 실패 안내: ' + JSON.stringify(failed));

  // ⑧ 안전판 성공 → 확실한 것만 배정, 참고(sameday)·근거 없음은 그대로
  const bulk = await page.evaluate(async () => {
    window.__snapCalls = [];
    hjSnapshot = async (label) => { window.__snapCalls.push(label); return true; };
    window.__dirtyCalls = 0; const origDirty = markDirty; markDirty = () => { window.__dirtyCalls++; return origDirty(); };
    const n = await photoSuggestApplyAll();
    const f = id => state.files.find(x => x.id === id).project;
    return { n, b1: f('b1'), c1: f('c1'), p2: f('p2'), d1: f('d1'), e1: f('e1'), yus4: f('yus4'), dirty: window.__dirtyCalls, toast: document.querySelector('#toast').textContent, bar: !!document.querySelector('#suggestBar'), btns: document.querySelectorAll('#view .suggest-btn').length };
  });
  assert(bulk.n === 2 && bulk.b1 === '은행현장' && bulk.c1 === '유성현장' && bulk.p2 === '둔산현장', '⑧ 확실한 2묶음 2장 배정(p 는 원탭으로 이미): ' + JSON.stringify(bulk));
  assert(bulk.d1 === '' && bulk.e1 === '', '⑧ 참고 제안(같은 날)·근거 없음은 일괄에서 제외: ' + JSON.stringify(bulk));
  assert(bulk.yus4 === '유성현장' && bulk.dirty >= 1, '기존 배정 불변 · 저장 표시');
  assert(/2묶음 2장을 추천 현장에 배정/.test(bulk.toast), '토스트: ' + bulk.toast);
  assert(bulk.bar === false && bulk.btns === 1, '⑨ 일괄 뒤 막대는 사라지고 참고 제안(d) 버튼만 남는다: ' + JSON.stringify(bulk));

  // 폰(390px)에서 추천 버튼은 손가락 크기(44px 이상)
  await page.setViewportSize({ width: 390, height: 844 });
  const tap = await page.evaluate(() => { __photoCache.key = null; render(); const b = document.querySelector('#view .suggest-btn'); return b ? Math.round(b.getBoundingClientRect().height) : 0; });
  assert(tap >= 44, '폰에서 추천 버튼 높이 44px 이상: ' + tap);

  assert(errors.length === 0, '⑩ pageerror: ' + errors.join(' | '));
  console.log('PASS  photo-suggest: gps·재방문·같은 날·절반 배정 제안, 원탭 배정, 확실한 것만 일괄(안전판 뒤), 보관 제외, pageerror 0');
  await browser.close();
})().catch(async (e) => { console.error('FAIL', e && e.stack || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

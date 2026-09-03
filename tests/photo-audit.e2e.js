/* photo-audit.e2e.js — 📍 사진 배정 점검: GPS 로 현장과 어긋난 사진 찾기·재배정·중복 정리 (Playwright)

   2026-09-03 대표 요청: "사진이 위치에 맞게 프로젝트에 잘 들어갔는지 확인해서 수정하고 중복사진 제거".

     ① 배정 현장에서 1km 넘게 떨어졌고 다른 현장이 500m 안에 있으면 '재배정 제안'
     ② 멀리 떨어졌지만 가까운 현장이 없으면 '확인 필요' (자동으로 옮기지 않는다)
     ③ 배정 현장 근처(1km 안) 사진은 건드리지 않는다
     ④ GPS 없는 사진은 판단하지 않고 개수만 센다
     ⑤ 현장 좌표가 없으면 그 현장 사진들의 가장 큰 GPS 묶음이 기준이 된다
     ⑥ 같은 크기·촬영시각 중복은 대표 1장만 남기는 제거 버튼으로 이어진다(기존 trimDuplicates)
     ⑦ 재배정은 안전판 스냅샷 뒤에만 실행되고, 스냅샷 실패면 아무것도 바꾸지 않는다
     ⑧ 재배정 뒤 project 가 바뀌고 _phase 는 비워지며 저장 표시(markDirty)가 켜진다
     ⑨ 더보기 메뉴·사진 도구에서 열 수 있다
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
assert(/\['photoaudit','📍','사진 배정 점검'\]/.test(source), 'more menu group exposes the audit');
assert(/data-moreaction="photoaudit"/.test(source), 'more sheet exposes the audit');
assert(/a==='photoaudit'\)\{photoAssignmentAudit\(\);\}/.test(source), 'more action routes to the audit');
assert(/it\('📍','사진 배정 점검'[^)]*'photoAssignmentAudit'\)/.test(source), 'photo tools expose the audit');

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

  // 시드: 둔산(좌표 있음) · 은행(좌표 없음 → 사진 묶음이 기준; 먼 사진을 먼저 두어 '가장 큰 묶음' 규칙을 시험) · 유성(사진 1장)
  //   둔산 36.3500,127.3800 / 은행 36.3300,127.4300 (약 5.0km) / 먼 곳 36.60,127.10 (30km+)
  //   유성은 좌표 없이 사진 1장뿐 → 그 사진이 스스로 기준이 되어 어긋남으로 잡히지 않는다(한 장으로는 판단 불가)
  const seed = await page.evaluate(() => {
    const d = (s) => new Date(s);
    const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }, extra || {});
    state.projects = [P('둔산현장', { lat: 36.35, lng: 127.38 }), P('은행현장'), P('유성현장'), P('보관현장', { archived: true, lat: 36.33, lng: 127.43 })];
    state.files = [
      { id: 'ok1', name: 'ok1.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-01T09:00:00'), lat: 36.3505, lng: 127.3806, size: 100 },
      { id: 'wrong1', name: 'wrong1.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', _phase: '철거', when: d('2026-08-02T09:00:00'), lat: 36.3302, lng: 127.4301, size: 101, address: '대전 동구 은행동' },
      { id: 'bankfar', name: 'bankfar.jpg', ext: 'jpg', kind: 'photo', project: '은행현장', when: d('2026-08-04T09:00:00'), lat: 36.60, lng: 127.10, size: 104 },
      { id: 'bank1', name: 'bank1.jpg', ext: 'jpg', kind: 'photo', project: '은행현장', when: d('2026-08-03T09:00:00'), lat: 36.3301, lng: 127.4302, size: 102 },
      { id: 'bank2', name: 'bank2.jpg', ext: 'jpg', kind: 'photo', project: '은행현장', when: d('2026-08-03T09:10:00'), lat: 36.3299, lng: 127.4299, size: 103 },
      { id: 'nogps', name: 'nogps.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-05T09:00:00'), size: 105 },
      { id: 'noref', name: 'noref.jpg', ext: 'jpg', kind: 'photo', project: '유성현장', when: d('2026-08-06T09:00:00'), lat: 36.36, lng: 127.35, size: 106 },
      { id: 'unassigned', name: 'unassigned.jpg', ext: 'jpg', kind: 'photo', project: '', when: d('2026-08-07T09:00:00'), lat: 36.60, lng: 127.10, size: 107 },
      { id: 'dupA', name: 'dupA.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-08T09:00:00'), lat: 36.3501, lng: 127.3801, size: 5000 },
      { id: 'dupB', name: 'dupB.jpg', ext: 'jpg', kind: 'photo', project: '둔산현장', when: d('2026-08-08T09:00:00'), lat: 36.3501, lng: 127.3801, size: 5000 },
    ];
    state.tab = 'photos'; state.activeProject = null; state.search = '';
    if (typeof __photoCache !== 'undefined') __photoCache.key = null;
    const d1 = photoAssignmentAuditData();
    return {
      mismatches: d1.mismatches.map(r => ({ id: r.id, from: r.from, to: r.to, far: r.km > 1, near: r.toKm <= 0.5 })),
      unsure: d1.unsure.map(r => ({ id: r.id, from: r.from, to: r.to || null })),
      checked: d1.checked, noGps: d1.noGps, noRef: d1.noRef, dups: d1.dups,
      bankRef: d1.coords['은행현장'] ? { src: d1.coords['은행현장'].src, n: d1.coords['은행현장'].n } : null,
      dunsanRef: d1.coords['둔산현장'] ? d1.coords['둔산현장'].src : null,
      archivedRef: '보관현장' in d1.coords,
    };
  });
  assert(seed.mismatches.length === 1 && seed.mismatches[0].id === 'wrong1' && seed.mismatches[0].from === '둔산현장' && seed.mismatches[0].to === '은행현장' && seed.mismatches[0].far && seed.mismatches[0].near, '① 은행 옆에서 찍힌 둔산 배정 사진만 은행으로 재배정 제안: ' + JSON.stringify(seed.mismatches));
  assert(seed.unsure.length === 1 && seed.unsure[0].id === 'bankfar' && seed.unsure[0].to === null, '② 가까운 현장이 없는 먼 사진은 확인 필요: ' + JSON.stringify(seed.unsure));
  assert(seed.checked === 8, '③④ GPS 있는 배정 사진 8장만 대조(미배정·GPS 없음 제외): ' + seed.checked);
  assert(seed.noGps === 1 && seed.noRef === 0, '④⑤ GPS 없음 1 · 사진 한 장뿐인 현장(유성)은 그 사진이 기준이 되어 건너뛰지 않는다: ' + seed.noGps + '/' + seed.noRef);
  assert(seed.bankRef && seed.bankRef.src === 'photos' && seed.bankRef.n === 2, '⑤ 은행 기준 = 사진 묶음(2장, 먼 1장 제외): ' + JSON.stringify(seed.bankRef));
  assert(seed.dunsanRef === 'project', '⑤ 둔산 기준 = 현장 좌표');
  assert(seed.archivedRef === false, '보관(archived) 현장은 후보에서 제외');
  assert(seed.dups === 1, '⑥ 같은 크기·촬영시각 중복 1장: ' + seed.dups);

  // UI: 더보기 → 사진 배정 점검
  const ui = await page.evaluate(async () => {
    window.__snapCalls = [];
    hjSnapshot = async (label) => { window.__snapCalls.push(label); return true; };
    window.__dirtyCalls = 0; const origDirty = markDirty; markDirty = () => { window.__dirtyCalls++; return origDirty(); };
    photoAssignmentAudit();
    const modal = document.querySelector('#modalRoot');
    const picks = [...modal.querySelectorAll('.paPick')].map(el => ({ id: el.dataset.id, to: el.dataset.to, checked: el.checked }));
    const buttons = [...modal.querySelectorAll('.mfoot button')].map(b => b.textContent.trim());
    return { text: modal.textContent, picks, buttons, dupCount: (modal.querySelector('#paDupCount') || {}).textContent };
  });
  assert(ui.picks.length === 1 && ui.picks[0].id === 'wrong1' && ui.picks[0].to === '은행현장' && ui.picks[0].checked, '재배정 제안이 체크된 채 보인다: ' + JSON.stringify(ui.picks));
  assert(/bankfar\.jpg/.test(ui.text) && /확인 필요/.test(ui.text), '확인 필요 목록이 보인다');
  assert(ui.dupCount === '1' && ui.buttons.some(b => /중복 1장 제거/.test(b)), '⑥ 중복 제거 버튼: ' + JSON.stringify(ui.buttons));
  assert(ui.buttons.some(b => /체크한 사진 재배정/.test(b)), '재배정 버튼');

  // ⑦ 스냅샷 실패면 아무것도 바꾸지 않는다
  const failed = await page.evaluate(async () => {
    hjSnapshot = async () => false;
    const n = await photoAssignmentApply([{ id: 'wrong1', to: '은행현장' }]);
    return { n, project: state.files.find(f => f.id === 'wrong1').project, phase: state.files.find(f => f.id === 'wrong1')._phase };
  });
  assert(failed.n === 0 && failed.project === '둔산현장' && failed.phase === '철거', '⑦ 스냅샷 실패 시 불변: ' + JSON.stringify(failed));

  // ⑧ 재배정 실행(버튼 경로)
  const applied = await page.evaluate(async () => {
    hjSnapshot = async (label) => { window.__snapCalls.push(label); return true; };
    const btn = [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /체크한 사진 재배정/.test(b.textContent));
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const f = state.files.find(x => x.id === 'wrong1');
    return { project: f.project, phase: f._phase, snaps: window.__snapCalls.slice(), dirty: window.__dirtyCalls, modalOpen: !!document.querySelector('#modalRoot .modal'), again: photoAssignmentAuditData().mismatches.length, others: state.files.filter(x => x.id !== 'wrong1').map(x => x.project).join(',') };
  });
  assert(applied.project === '은행현장' && applied.phase === null, '⑧ project 변경·공정 초기화: ' + JSON.stringify(applied));
  assert(applied.snaps.includes('사진 배정 점검 전'), '⑦ 재배정 전 안전판 스냅샷');
  assert(applied.dirty >= 1, '⑧ 저장 표시');
  assert(applied.again === 0, '⑧ 재배정 뒤 재점검에 제안이 남지 않는다');
  assert(applied.others === '둔산현장,은행현장,은행현장,은행현장,둔산현장,유성현장,,둔산현장,둔산현장', '다른 사진의 배정은 그대로: ' + applied.others);

  // ⑧ 직접 호출: 저장 표시는 재배정 함수 자체가 켠다(화면 갱신에 기대지 않는다)
  const direct = await page.evaluate(async () => {
    window.__dirtyCalls = 0;
    const n = await photoAssignmentApply([{ id: 'bank1', to: '둔산현장' }]);
    return { n, dirty: window.__dirtyCalls, project: state.files.find(f => f.id === 'bank1').project };
  });
  assert(direct.n === 1 && direct.dirty === 1 && direct.project === '둔산현장', '⑧ 재배정 함수가 저장 표시를 정확히 한 번 켠다: ' + JSON.stringify(direct));
  await page.evaluate(() => { state.files.find(f => f.id === 'bank1').project = '은행현장'; });

  // 존재하지 않는 현장·보관 현장으로는 옮기지 않는다
  const guard = await page.evaluate(async () => {
    const n = await photoAssignmentApply([{ id: 'ok1', to: '없는현장' }, { id: 'ok1', to: '보관현장' }, { id: 'nope', to: '은행현장' }]);
    return { n, project: state.files.find(f => f.id === 'ok1').project };
  });
  assert(guard.n === 0 && guard.project === '둔산현장', '없는·보관 현장으로는 옮기지 않는다: ' + JSON.stringify(guard));

  assert(errors.length === 0, '⑩ pageerror: ' + errors.join(' | '));
  await browser.close();
  console.log('PASS  사진 배정 점검: 재배정 제안·확인 필요·GPS 없음·묶음 기준·중복·안전판·재배정·메뉴 노출');
})().catch(async error => { console.error(error); try { if (browser) await browser.close(); } catch (_) {} process.exitCode = 1; });

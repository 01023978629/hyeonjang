/* photo-refs.e2e.js — 현장 안의 사진 참조가 재부팅·복원·기기 이동 뒤에도 끊기지 않는다 (Playwright)

   2026-09-26: 파일 레코드 id(uid)는 부팅·복원·스캔마다 새로 붙는데(serializeData 파일 레코드에 id 가 없다)
   p.extras[].photo · p.casePack.photos · p.warrantyDoc.photoIds 가 그 id 를 적어 두고 있었다. 그래서 폰(전부 가상 레코드)·
   안전판 복원·기기 이동 뒤 사례 내보내기 선택이 비고('사진을 한 장 이상 고르세요'), 추가공사 사진이 '사진 없음',
   완료보증서 보관본이 사진 없이 나가는데 화면은 '같은 사본' 이라 말했다. case-pack ⑥ 왕복은 files 를 비우지 않아 못 잡았다.
   지키는 것:
     ① 옛 id 로 적힌 자료도 읽히고, 화면을 열면 안정 참조로 고쳐 적힌다(dirty) — 뒤처진 탭이면 적지 않는다
     ② 세 기능이 사진을 적을 때 안정 참조('d:'+Drive ID, 없으면 'k:'+fileKey)로 적는다
     ③ serializeData → state.files 를 비우고 applyData(폰 가상 레코드, 새 id) → hydrateThumbs 뒤에도 세 참조가 같은 사진을 가리킨다,
        현장 이름을 바꿔도 끊기지 않는다
     ④ 정말 없어진 사진은 조용히 빈 값이 아니라 '사진을 찾을 수 없음 N장' 으로 알린다 — 저절로 지우지 않고, [목록에서 빼기]로만 뺀다,
        보증서 보관본은 '같은 사본' 이라 말하지 않고 다시 보내기 전에 묻는다
     ⑤ 참조 풀이 규칙: 정리 폴더로 옮겨진 사진(이름·크기 같음)·v323 원본→정리본 합침은 따라가고, 모호하면 고르지 않는다,
        Drive 에 올라가면 'd:' 로 고쳐 적고, 같은 Drive ID 가 두 기록에 붙으면 'k:' 로 가리킨다
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
const P = '석교동주택';
const DIR = '현장사진/석교동주택/';
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true; const asked = [];
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.casePackView === 'function' && typeof window.hjFilesByRefs === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    // 부팅 시더가 시나리오 한복판에 자료를 심고 dirty 를 켜지 않게 재운다(AGENTS 검사 함정)
    for (const k of ['taxCalendarEnsure', 'coworkSchedEnsure', 'backupBootCheck', 'kakaoCheckNew']) if (typeof window[k] === 'function') window[k] = () => 0;
    // 적었는가는 state.dirty 가 아니라 markDirty 호출 수로, 한 evaluate(동기 구간) 안에서 잰다 — state.dirty 는 evaluate 사이에
    // 배경 작업이 켤 수 있어 '적지 않았다' 단정이 9회 중 1회 흔들렸다
    window.__mdN = 0; const om = markDirty; markDirty = function () { window.__mdN++; return om.apply(this, arguments); };
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');
  const idOf = name => page.evaluate(n => (state.files.find(f => f.name === n) || {}).id, name);
  const proj = () => page.evaluate(n => JSON.parse(JSON.stringify(state.projects.find(p => p.name === n) || null)), P);

  // 시드 — 전2(하나는 Drive 에 올라감)·후2(하나는 Drive)·중1·지울 사진 1. 썸네일은 문서에 실리는 data:image/png.
  await page.evaluate(({ P, DIR }) => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 6; const g = c.getContext('2d'); g.fillStyle = '#35a'; g.fillRect(0, 0, 8, 6);
    window.__PNG = c.toDataURL('image/png');
    const ph = (id, name, size, phase, when, drive) => ({ id, kind: 'photo', name, prefix: DIR, ext: 'jpg', size, project: P, _phase: phase || null, when: new Date(when), thumb: window.__PNG, _driveId: drive || null });
    state.projects = [{ name: P, stage: STAGES.length - 1, doneAt: '2026-09-08', received: 0, phases: ['시공 전', '완료'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가상 고객', phone: '010-0000-1234', addr: '' } }];
    state.files = [
      ph('s-b1', '전_거실.jpg', 1001, '시공 전', '2026-09-01T09:00', 'DRIVE-FAKE-B1'),
      ph('s-b2', '전_주방.jpg', 1002, '시공 전', '2026-09-02T09:00'),
      ph('s-a1', '후_거실.jpg', 2001, '완료', '2026-09-05T09:00', 'DRIVE-FAKE-A1'),
      ph('s-a2', '후_주방.jpg', 2002, '완료', '2026-09-06T09:00'),
      ph('s-m1', '중_배관.jpg', 3001, null, '2026-09-03T09:00'),
      ph('s-x1', '지울_사진.jpg', 4001, null, '2026-09-04T09:00')
    ];
    state.quotes = []; state.activeProject = P; state.dirty = false;
  }, { P, DIR });

  // ── ① 옛 id 자료 — 읽히고, 열면 새 형식으로 고쳐 적힌다 ────────────────────────────
  // 뒤처진 탭: 화면에는 풀어 보여 주되 적지 않는다
  await page.evaluate(n => {
    const p = state.projects[0];
    p.casePack = { photos: ['s-b1', 's-m1'] };
    p.extras = [{ id: 'e1', date: '2026-09-03', text: '선반', amount: '', days: '', photo: 's-a1', agreed: false }];
    __tabStale = true;
    const n0 = window.__mdN; casePackView(n); window.__wrote = window.__mdN - n0;
  }, P);
  let stale = await page.evaluate(() => ({ photos: state.projects[0].casePack.photos.slice(), wrote: window.__wrote,
    checked: [...document.querySelectorAll('#modalRoot .cpChk:checked')].map(e => e.dataset.id).sort() }));
  assert(JSON.stringify(stale.photos) === JSON.stringify(['s-b1', 's-m1']) && stale.wrote === 0, '① 뒤처진 탭은 이전을 적지 않는다: ' + JSON.stringify(stale));
  assert(JSON.stringify(stale.checked) === JSON.stringify(['s-b1', 's-m1']), '① 뒤처진 탭이어도 옛 id 선택은 화면에 풀린다: ' + JSON.stringify(stale.checked));
  // 옛 id 가 남은 목록에서 체크를 풀면 그 사진을 가리키던 옛 id 도 함께 빠진다(참조 문자열이 달라도 같은 사진)
  await page.uncheck('#modalRoot .cpChk[data-id="s-b1"]');
  stale = await page.evaluate(() => state.projects[0].casePack.photos.slice());
  assert(JSON.stringify(stale) === JSON.stringify(['s-m1']), '① 옛 id 로 적힌 같은 사진도 체크 해제로 빠진다: ' + JSON.stringify(stale));
  await page.evaluate(() => { state.projects[0].casePack.photos = ['s-b1', 's-m1']; });
  // 뒤처진 탭 — 추가공사·보증서 보관본도 열 때 이전을 적지 않는다(화면에는 풀린다)
  const staleOthers = await page.evaluate(n => {
    closeModal(true);
    let n0 = window.__mdN; extraWork(n);
    const ex = { photo: state.projects[0].extras[0].photo, wrote: window.__mdN - n0, seen: /📷 사진 있음/.test(document.querySelector('#modalRoot').textContent) };
    closeModal(true);
    state.projects[0].warrantyDoc = { at: '2026-09-08', file: 'x.html', html: warrantyHTML(n, { hideEmptyPhotos: true }), photoIds: { before: ['s-b2'], after: ['s-a2'] } };
    n0 = window.__mdN; warrantyDocView(n);
    const wd = { ids: JSON.stringify(state.projects[0].warrantyDoc.photoIds), wrote: window.__mdN - n0, photos: (document.querySelector('#modalRoot iframe').getAttribute('srcdoc').match(/data-photo="/g) || []).length };
    closeModal(true); delete state.projects[0].warrantyDoc;
    return { ex, wd };
  }, P);
  assert(staleOthers.ex.photo === 's-a1' && staleOthers.ex.wrote === 0 && staleOthers.ex.seen, '① 뒤처진 탭 — 추가공사는 이전을 적지 않고 사진은 보인다: ' + JSON.stringify(staleOthers.ex));
  assert(staleOthers.wd.ids === JSON.stringify({ before: ['s-b2'], after: ['s-a2'] }) && staleOthers.wd.wrote === 0 && staleOthers.wd.photos === 2, '① 뒤처진 탭 — 보증서 보관본은 이전을 적지 않고 사진은 들어간다: ' + JSON.stringify(staleOthers.wd));
  // 추가공사에서 고른 사진도 안정 참조로 적는다 — 열 때 이전이 덮어 주지 않는 뒤처진 탭에서 본다(선택 줄 자체를 지킨다)
  await page.evaluate(n => { closeModal(true); extraWork(n); }, P);
  await page.selectOption('#modalRoot .exIn[data-k="photo"][data-i="0"]', 's-a2');
  stale = await page.evaluate(() => state.projects[0].extras[0].photo);
  assert(stale === 'k:' + '현장사진/석교동주택/' + '후_주방.jpg|2002', '① 추가공사 — 고른 사진은 파일 id 가 아니라 안정 참조로 적힌다: ' + stale);
  await page.evaluate(() => { state.projects[0].extras[0].photo = 's-a1'; });
  await page.evaluate(n => { __tabStale = false; closeModal(true); const n0 = window.__mdN; casePackView(n); window.__wrote = window.__mdN - n0; }, P);
  let mig = await page.evaluate(() => ({ photos: state.projects[0].casePack.photos.slice(), dirty: window.__wrote > 0,
    checked: [...document.querySelectorAll('#modalRoot .cpChk:checked')].map(e => e.dataset.id).sort(), count: document.querySelector('#cpCount').textContent }));
  assert(JSON.stringify(mig.photos) === JSON.stringify(['d:DRIVE-FAKE-B1', 'k:' + DIR + '중_배관.jpg|3001']) && mig.dirty === true,
    '① 사례 — 옛 id 가 d:/k: 로 고쳐 적히고 dirty: ' + JSON.stringify(mig));
  assert(JSON.stringify(mig.checked) === JSON.stringify(['s-b1', 's-m1']) && /고른 사진 2장/.test(mig.count), '① 사례 — 옛 id 선택이 체크로 보인다: ' + JSON.stringify(mig));
  await page.evaluate(n => { closeModal(true); const n0 = window.__mdN; extraWork(n); window.__wrote = window.__mdN - n0; }, P);
  mig = await page.evaluate(() => ({ photo: state.projects[0].extras[0].photo, dirty: window.__wrote > 0, text: document.querySelector('#modalRoot').textContent,
    sel: (document.querySelector('#modalRoot .exIn[data-k="photo"][data-i="0"]').selectedOptions[0] || {}).textContent }));
  assert(mig.photo === 'd:DRIVE-FAKE-A1' && mig.dirty === true && /📷 사진 있음/.test(mig.text) && mig.sel === '후_거실.jpg', '① 추가공사 — 옛 id 가 고쳐 적히고 사진이 보인다: ' + JSON.stringify({ ...mig, text: mig.text.slice(0, 60) }));
  await page.evaluate(n => { closeModal(true); const p = state.projects[0]; p.warrantyDoc = { at: '2026-09-08', file: 'x.html', html: warrantyHTML(n, { hideEmptyPhotos: true }), photoIds: { before: ['s-b2'], after: ['s-a2'] } }; const n0 = window.__mdN; warrantyDocView(n); window.__wrote = window.__mdN - n0; }, P);
  mig = await page.evaluate(() => ({ ids: state.projects[0].warrantyDoc.photoIds, dirty: window.__wrote > 0, same: document.querySelector('#wdSame').textContent }));
  assert(JSON.stringify(mig.ids) === JSON.stringify({ before: ['k:' + DIR + '전_주방.jpg|1002'], after: ['k:' + DIR + '후_주방.jpg|2002'] }) && mig.dirty === true && /같은 사본입니다/.test(mig.same),
    '① 보증서 보관본 — 옛 id 가 고쳐 적힌다: ' + JSON.stringify(mig));

  // ── ② 세 기능이 적는 값 ────────────────────────────────────────────────────────────
  await page.evaluate(n => { closeModal(true); const p = state.projects[0]; p.casePack = {}; p.extras = []; delete p.warrantyDoc; casePackView(n); }, P);
  for (const nm of ['전_거실.jpg', '전_주방.jpg', '후_주방.jpg', '중_배관.jpg']) await page.check('#modalRoot .cpChk[data-id="' + await idOf(nm) + '"]');
  await page.uncheck('#modalRoot .cpChk[data-id="' + await idOf('중_배관.jpg') + '"]');
  await page.check('#modalRoot .cpChk[data-id="' + await idOf('중_배관.jpg') + '"]');
  const casePhotos = (await proj()).casePack.photos;
  assert(JSON.stringify(casePhotos) === JSON.stringify(['d:DRIVE-FAKE-B1', 'k:' + DIR + '전_주방.jpg|1002', 'k:' + DIR + '후_주방.jpg|2002', 'k:' + DIR + '중_배관.jpg|3001']),
    '② 사례 — 체크는 안정 참조로 적힌다(해제·재체크도 한 번만): ' + JSON.stringify(casePhotos));
  await page.evaluate(n => { closeModal(true); extraWork(n); }, P);
  await page.click('#exAdd'); await page.click('#exAdd');
  await page.selectOption('#modalRoot .exIn[data-k="photo"][data-i="0"]', await idOf('후_거실.jpg'));
  await page.selectOption('#modalRoot .exIn[data-k="photo"][data-i="1"]', await idOf('중_배관.jpg'));
  const exPhotos = (await proj()).extras.map(x => x.photo);
  assert(JSON.stringify(exPhotos) === JSON.stringify(['d:DRIVE-FAKE-A1', 'k:' + DIR + '중_배관.jpg|3001']), '② 추가공사 — 사진 연결은 안정 참조로: ' + JSON.stringify(exPhotos));
  const issued = await page.evaluate(async n => {
    closeModal(true);
    const orig = hjWarrantyShareHtml; let sent = '';
    hjWarrantyShareHtml = async (nm, html) => { sent = html; return true; };
    try { await warrantyIssueSend(n); } finally { hjWarrantyShareHtml = orig; }
    return { ids: state.projects[0].warrantyDoc.photoIds, sentPhotos: (sent.match(/data-photo="/g) || []).length };
  }, P);
  assert(JSON.stringify(issued.ids) === JSON.stringify({ before: ['d:DRIVE-FAKE-B1', 'k:' + DIR + '전_주방.jpg|1002'], after: ['k:' + DIR + '후_주방.jpg|2002', 'd:DRIVE-FAKE-A1'] }) && issued.sentPhotos === 4,
    '② 완료보증서 — 보관본에 안정 참조, 보낸 본에는 사진 4장: ' + JSON.stringify(issued));

  // ── ③ 폰·복원·기기 이동: serializeData → files 비우고 applyData(가상 레코드, 새 id) → hydrateThumbs ─────────
  const moved = await page.evaluate(async n => {
    for (const f of state.files) await idbSet(f._driveId ? 'thumb:' + f._driveId : 'thumb-local:' + fileKey(f), window.__PNG);   // 이 기기 썸네일 캐시(참조와 같은 신원)
    const snap = JSON.parse(JSON.stringify(serializeData()));
    const before = new Set(state.files.map(f => f.id));
    state.files = [];
    applyData(snap);
    await hydrateThumbs();
    const fresh = state.files.filter(f => f.kind === 'photo');
    return { allNew: fresh.length === 6 && fresh.every(f => f._virtual && !before.has(f.id)), thumbs: fresh.every(f => hjDocThumbOk(f)) };
  }, P);
  assert(moved.allNew && moved.thumbs, '③ 시나리오 전제 — 전부 새 id 의 가상 레코드이고 썸네일 캐시가 붙었다(아니면 ③이 헛돈다): ' + JSON.stringify(moved));
  const after = await page.evaluate(n => {
    const p = state.projects.find(x => x.name === n);
    const ph = hjWarrantyDocPhotos(p), html = hjWarrantyDocHtml(p);
    const idsIn = [...html.matchAll(/data-photo="([^"]+)"/g)].map(m => (state.files.find(f => f.id === m[1]) || {}).name);
    return { casePick: hjCaseSelected(p).map(f => f.name), block: hjCaseBlock(p), wb: ph.before.map(f => f.name), wa: ph.after.map(f => f.name), idsIn, missing: ph.missing,
      ex: (p.extras || []).map(x => (hjFilesByRefs([x.photo]).files[0] || {}).name || null) };
  }, P);
  assert(JSON.stringify(after.casePick) === JSON.stringify(['전_거실.jpg', '전_주방.jpg', '중_배관.jpg', '후_주방.jpg']) && !/사진을 한 장 이상|찾을 수 없/.test(after.block),
    '③ 사례 — 새 id 뒤에도 같은 사진 4장(전→중→후): ' + JSON.stringify(after));
  assert(JSON.stringify(after.ex) === JSON.stringify(['후_거실.jpg', '중_배관.jpg']), '③ 추가공사 — 같은 사진: ' + JSON.stringify(after.ex));
  assert(JSON.stringify(after.wb) === JSON.stringify(['전_거실.jpg', '전_주방.jpg']) && JSON.stringify(after.wa) === JSON.stringify(['후_주방.jpg', '후_거실.jpg']) && after.missing === 0,
    '③ 보증서 — 보관본이 가리키는 사진: ' + JSON.stringify(after));
  assert(after.idsIn.length === 4 && after.idsIn.every(Boolean), '③ 보증서 — 보관본을 다시 만들면 사진 4장이 새 id 로 들어간다: ' + JSON.stringify(after.idsIn));
  // 화면으로도 — 체크·📷·같은 사본
  await page.evaluate(n => casePackView(n), P);
  let ui = await page.evaluate(() => ({ checked: [...document.querySelectorAll('#modalRoot .cpChk:checked')].map(e => (state.files.find(f => f.id === e.dataset.id) || {}).name).sort(),
    lost: document.querySelector('#cpLost').hidden, count: document.querySelector('#cpCount').textContent }));
  assert(JSON.stringify(ui.checked) === JSON.stringify(['전_거실.jpg', '전_주방.jpg', '중_배관.jpg', '후_주방.jpg']) && ui.lost && /고른 사진 4장/.test(ui.count), '③ 사례 화면 — 체크가 살아 있다: ' + JSON.stringify(ui));
  await page.evaluate(n => { closeModal(true); extraWork(n); }, P);
  ui = await page.evaluate(() => ({ t: document.querySelector('#modalRoot').textContent, sel: [0, 1].map(i => (document.querySelector('#modalRoot .exIn[data-k="photo"][data-i="' + i + '"]').selectedOptions[0] || {}).textContent) }));
  assert((ui.t.match(/📷 사진 있음/g) || []).length === 2 && !/찾을 수 없음/.test(ui.t) && JSON.stringify(ui.sel) === JSON.stringify(['후_거실.jpg', '중_배관.jpg']), '③ 추가공사 화면: ' + JSON.stringify(ui.sel));
  await page.evaluate(n => { closeModal(true); warrantyDocView(n); }, P);
  ui = await page.evaluate(() => ({ same: document.querySelector('#wdSame').textContent, frame: (document.querySelector('#modalRoot iframe').getAttribute('srcdoc').match(/data-photo="/g) || []).length }));
  assert(/같은 사본입니다/.test(ui.same) && !/⚠/.test(ui.same) && ui.frame === 4, '③ 보증서 보관본 화면 — 사진 4장, 같은 사본: ' + JSON.stringify(ui));
  // 최근 40장 목록 밖(여기서는 딴 현장으로 옮겨 간) 사진이 연결돼 있어도 선택이 '사진 없음' 으로 보이지 않는다
  await page.evaluate(n => { closeModal(true); state.files.find(f => f.name === '후_거실.jpg').project = '딴 현장'; extraWork(n); }, P);
  ui = await page.evaluate(() => ({ t: document.querySelector('#modalRoot .exRow').textContent, sel: (document.querySelector('#modalRoot .exIn[data-k="photo"][data-i="0"]').selectedOptions[0] || {}).textContent }));
  assert(/📷 사진 있음/.test(ui.t) && ui.sel === '후_거실.jpg', '③ 목록 밖 사진도 연결된 채로 보인다: ' + JSON.stringify(ui));
  await page.evaluate(n => { state.files.find(f => f.name === '후_거실.jpg').project = n; }, P);
  // 현장 이름을 바꿔도(renameProject 와 같은 갱신) 끊기지 않는다
  const renamed = await page.evaluate(n => {
    closeModal(true);
    const p = state.projects.find(x => x.name === n), nv = n + ' 2차';
    p.name = nv; state.files.forEach(f => { if (f.project === n) f.project = nv; });
    const r = { casePick: hjCaseSelected(p).length, wr: hjWarrantyDocPhotos(p).used };
    p.name = n; state.files.forEach(f => { if (f.project === nv) f.project = n; });
    return r;
  }, P);
  assert(renamed.casePick === 4 && renamed.wr === 4, '③ 현장 이름을 바꿔도 참조가 이어진다: ' + JSON.stringify(renamed));

  // ── ④ 정말 없어진 사진 ─────────────────────────────────────────────────────────────
  await page.evaluate(n => { state.files = state.files.filter(f => f.name !== '중_배관.jpg' && f.name !== '전_주방.jpg'); const n0 = window.__mdN; casePackView(n); window.__wrote = window.__mdN - n0; }, P);
  let lost = await page.evaluate(() => ({ hidden: document.querySelector('#cpLost').hidden, text: document.querySelector('#cpLost').textContent, count: document.querySelector('#cpCount').textContent,
    photos: state.projects[0].casePack.photos.length, dirty: window.__wrote > 0 }));
  assert(!lost.hidden && /사진을 찾을 수 없음 2장/.test(lost.text) && /고른 사진 2장/.test(lost.count), '④ 사례 — 찾을 수 없는 사진을 개수로 알린다: ' + JSON.stringify(lost));
  assert(lost.photos === 4 && lost.dirty === false, '④ 사례 — 저절로 지우지 않는다(동기화 전일 수 있다): ' + JSON.stringify(lost));
  // ZIP 도 빠진 장수를 말한다(사진 굽기·압축은 스텁 — case-pack ⑤ 가 실제 굽기를 본다)
  const zipToast = await page.evaluate(async () => {
    const p = state.projects[0], keep = JSON.parse(JSON.stringify(p.casePack)), origJpeg = hjCaseJpeg, origCreate = document.createElement.bind(document);
    Object.assign(p.casePack, { place: '석교동', symptom: 'a', method: 'b', cause: 'c', work: 'd', duration: 'e', consent: true });
    window.JSZip = function () { return { file() {}, generateAsync: async () => new Blob(['zip']) }; };
    hjCaseJpeg = async () => ({ bytes: new Uint8Array([1]), w: 1, h: 1 });
    document.createElement = function (tag) { const el = origCreate(tag); if (tag === 'a') el.click = () => {}; return el; };
    try { await hjCaseZip(p); } finally { hjCaseJpeg = origJpeg; document.createElement = origCreate; p.casePack = keep; }
    return window.__toasts[window.__toasts.length - 1];
  });
  assert(/사례 묶음 2장/.test(zipToast) && /사진을 찾을 수 없음 2장 빠짐/.test(zipToast), '④ 사례 ZIP — 빠진 장수를 말한다: ' + zipToast);
  const lostN0 = await page.evaluate(() => window.__mdN);
  await page.click('#cpLostClear');
  lost = await page.evaluate(n0 => ({ hidden: document.querySelector('#cpLost').hidden, photos: state.projects[0].casePack.photos.slice(), dirty: window.__mdN > n0 }), lostN0);
  assert(lost.hidden && JSON.stringify(lost.photos) === JSON.stringify(['d:DRIVE-FAKE-B1', 'k:' + DIR + '후_주방.jpg|2002']) && lost.dirty && /2장을 목록에서 뺐습니다/.test(await lastToast()),
    '④ 사례 — [목록에서 빼기] 로만 뺀다: ' + JSON.stringify(lost));
  const blocked = await page.evaluate(() => { const p = state.projects[0]; const keep = p.casePack; p.casePack = { place: '석교동', symptom: 'a', method: 'b', cause: 'c', work: 'd', duration: 'e', consent: true, photos: ['k:없는/사진.jpg|1', 's-nothing'] };
    const r = hjCaseBlock(p); p.casePack = keep; return r; });
  assert(/사진을 찾을 수 없음 2장/.test(blocked), '④ 사례 — 고른 사진이 모두 없으면 그 이유를 말한다: ' + blocked);
  await page.evaluate(n => { closeModal(true); const n0 = window.__mdN; extraWork(n); window.__wrote = window.__mdN - n0; }, P);
  lost = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#modalRoot .exRow')].map(r => !!r.querySelector('.exMiss')), sum: document.querySelector('#exSum').textContent,
    sel: (document.querySelector('#modalRoot .exIn[data-k="photo"][data-i="1"]').selectedOptions[0] || {}).textContent, photo: state.projects[0].extras[1].photo, dirty: window.__wrote > 0 }));
  assert(JSON.stringify(lost.rows) === JSON.stringify([false, true]) && /사진을 찾을 수 없음 1장/.test(lost.sum) && /찾을 수 없는 사진/.test(lost.sel), '④ 추가공사 — 줄과 합계에 알린다: ' + JSON.stringify(lost));
  assert(lost.photo === 'k:' + DIR + '중_배관.jpg|3001' && lost.dirty === false, '④ 추가공사 — 연결값은 그대로 둔다: ' + JSON.stringify(lost));
  // 사진이 하나도 없는 현장이어도 찾을 수 없는 연결을 풀 수 있게 선택지가 나온다
  const empty = await page.evaluate(n => {
    closeModal(true);
    state.projects.push({ name: '빈 현장', stage: 2, received: 0, phases: [], cost: {}, extras: [{ id: 'e9', date: '2026-09-09', text: '문틀', amount: '', days: '', photo: 'k:현장사진/빈 현장/없는.jpg|5', agreed: false }] });
    extraWork('빈 현장');
    const sel = document.querySelector('#modalRoot .exIn[data-k="photo"][data-i="0"]');
    const r = { sel: sel ? (sel.selectedOptions[0] || {}).textContent : null, miss: !!document.querySelector('#modalRoot .exMiss') };
    closeModal(true); state.projects = state.projects.filter(p => p.name !== '빈 현장'); extraWork(n);
    return r;
  }, P);
  assert(empty.sel === '⚠ 찾을 수 없는 사진' && empty.miss, '④ 사진 없는 현장에서도 찾을 수 없는 연결을 보이고 풀 수 있다: ' + JSON.stringify(empty));
  await page.fill('#modalRoot .exIn[data-k="amount"][data-i="0"]', '50000');
  assert(/사진을 찾을 수 없음 1장/.test(await page.evaluate(() => document.querySelector('#exSum').textContent)), '④ 추가공사 — 금액을 고쳐 합계를 다시 그려도 경고가 남는다');
  await page.evaluate(n => { closeModal(true); state.files.find(f => f.name === '후_거실.jpg').thumb = null; warrantyDocView(n); }, P);
  const wd = await page.evaluate(() => ({ same: document.querySelector('#wdSame').textContent, frame: (document.querySelector('#modalRoot iframe').getAttribute('srcdoc').match(/data-photo="/g) || []).length }));
  assert(!/같은 사본입니다/.test(wd.same) && /사진 4장 중 2장만/.test(wd.same) && /사진을 찾을 수 없음 1장/.test(wd.same) && /미리보기를 아직 못 불러온 사진 1장/.test(wd.same) && wd.frame === 2,
    "④ 보증서 — 사진이 빠졌으면 '같은 사본' 이라 말하지 않는다: " + JSON.stringify(wd));
  const share = await page.evaluate(() => { window.__wdShares = 0; window.__wdOrigShare = hjWarrantyShareHtml; hjWarrantyShareHtml = async () => { window.__wdShares++; return true; }; return true; });
  assert(share, 'share stub');
  sayYes = false; asked.length = 0;
  await page.click('#modalRoot .mfoot button:has-text("다시 보내기")');   // confirm 은 클릭 처리 안에서 동기로 뜬다 — click 이 끝나면 이미 답했다
  assert(asked.length === 1 && /2장이 빠진 채로/.test(asked[0]) && await page.evaluate(() => window.__wdShares) === 0, '④ 보증서 — 빠진 채로 다시 보내기 전에 묻고, 아니오면 안 보낸다: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#modalRoot .mfoot button:has-text("다시 보내기")');
  await page.waitForFunction(() => window.__wdShares === 1);
  await page.evaluate(() => { hjWarrantyShareHtml = window.__wdOrigShare; closeModal(true); });

  // ── ⑤ 참조 풀이 규칙 ───────────────────────────────────────────────────────────────
  const rules = await page.evaluate(() => {
    const keep = state.files;
    const out = {};
    const f = (id, name, prefix, size, extra) => ({ id, kind: 'photo', name, prefix, size, ...(extra || {}) });
    // 정리 폴더로 옮겨짐(이름·크기 같음) — 따라가고 새 경로로 고쳐 적는다
    state.files = [f('z1', 'a.jpg', '_정리완료/X/시공전/', 500)];
    let r = hjFilesByRefs(['k:현장사진/X/a.jpg|500']); out.moved = [r.files.map(x => x.id), r.healed, r.changed];
    // v323 원본→정리본 합침(크기가 다른 정리본 하나뿐) — 따라간다
    state.files = [f('z2', 'b.jpg', '_정리완료/X/완료/', 480)];
    r = hjFilesByRefs(['k:현장사진/X/b.jpg|500']); out.merged = r.files.map(x => x.id);
    // 모호 — 같은 이름·크기 둘 / 정리본 둘이면 고르지 않는다
    state.files = [f('z3', 'c.jpg', '_정리완료/X/시공전/', 500), f('z4', 'c.jpg', '_정리완료/Y/시공전/', 500)];
    r = hjFilesByRefs(['k:현장사진/X/c.jpg|500']); out.ambSame = [r.files.length, r.missing.length];
    state.files = [f('z5', 'd.jpg', '_정리완료/X/시공전/', 480), f('z6', 'd.jpg', '_정리완료/Y/시공전/', 470)];
    r = hjFilesByRefs(['k:현장사진/X/d.jpg|500']); out.ambOrg = [r.files.length, r.missing.length];
    // 크기가 다르고 정리본도 아니면 다른 사진이다
    state.files = [f('z7', 'e.jpg', '현장사진/Y/', 480)];
    r = hjFilesByRefs(['k:현장사진/X/e.jpg|500']); out.diff = r.missing.length;
    // Drive 에 올라가면 'd:' 로 고쳐 적는다
    state.files = [f('z8', 'g.jpg', '현장사진/X/', 700, { _driveId: 'DRIVE-FAKE-G' })];
    r = hjFilesByRefs(['k:현장사진/X/g.jpg|700', 'z8']); out.up = [r.files.length, r.healed];
    // 같은 Drive ID 가 두 기록에 붙은 모호한 원본/정리본은 경로로 가리킨다
    state.files = [f('z9', 'h.jpg', '현장사진/X/', 700, { _driveId: 'DRIVE-FAKE-H' }), f('z10', 'h.jpg', '_정리완료/X/완료/', 700, { _driveId: 'DRIVE-FAKE-H' })];
    out.dup = [hjFileRef(state.files[0]), hjFileRef(state.files[1])];
    state.files = [f('z11', 'i.jpg', '', 0)];
    out.noSize = hjFilesByRefs(['k:다른/i.jpg|0']).missing.length;   // 크기를 모르면 이름만으로 고르지 않는다
    out.empty = hjFilesByRefs(null).files.length + hjFilesByRefs([null, '', undefined]).healed.length;
    state.files = keep;
    return out;
  });
  assert(JSON.stringify(rules.moved) === JSON.stringify([['z1'], ['k:_정리완료/X/시공전/a.jpg|500'], true]), '⑤ 정리 폴더로 옮겨진 사진을 따라가고 새 경로로 고쳐 적는다: ' + JSON.stringify(rules.moved));
  assert(JSON.stringify(rules.merged) === JSON.stringify(['z2']), '⑤ v323 원본→정리본 합침을 따라간다: ' + JSON.stringify(rules.merged));
  assert(JSON.stringify(rules.ambSame) === JSON.stringify([0, 1]) && JSON.stringify(rules.ambOrg) === JSON.stringify([0, 1]) && rules.diff === 1 && rules.noSize === 1, '⑤ 모호하면 고르지 않는다: ' + JSON.stringify(rules));
  assert(JSON.stringify(rules.up) === JSON.stringify([1, ['d:DRIVE-FAKE-G']]), "⑤ Drive 에 올라가면 'd:' 로(옛 id 와 겹치면 한 번만): " + JSON.stringify(rules.up));
  assert(JSON.stringify(rules.dup) === JSON.stringify(['k:현장사진/X/h.jpg|700', 'k:_정리완료/X/완료/h.jpg|700']), "⑤ 같은 Drive ID 두 기록은 'k:' 로: " + JSON.stringify(rules.dup));
  assert(rules.empty === 0, '⑤ 빈 값은 건너뛴다: ' + rules.empty);

  // ⑥ 최상위 키는 그대로(참조는 현장 객체 안 필드), pageerror 0
  const keys = await page.evaluate(() => Object.keys(serializeData()).length);
  assert(keys === 41, '⑥ serializeData 최상위 키 41개 그대로: ' + keys);
  assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  console.log('photo-refs.e2e OK (① 옛 id 이전·뒤처진 탭 ② 안정 참조로 적기 ③ 새 id 가상 레코드 뒤 같은 사진·이름 변경 ④ 찾을 수 없음 N장·빼기·같은 사본 아님 ⑤ 풀이 규칙 ⑥ 키·오류)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });

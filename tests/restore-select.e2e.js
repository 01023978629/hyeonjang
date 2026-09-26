/* restore-select.e2e.js — 「백업에서 복원 → 현장 선택」이 약속대로 되돌리는가 (Playwright)

   2026-09-26 확인된 사고: 선택 복원은 화면에 '선택한 현장의 정보가 백업 시점으로 통째로 덮어쓰입니다'라고
   말하면서, 파일은 project·공정·kind·est 넷만 되돌리고 이름만으로 첫 파일을 골랐다.
     - 작업명·동·호수·메모·집계 제외·장부·견적 품목은 지금 값 그대로 남았다(되돌렸다는 토스트를 믿고 저장된다)
     - 같은 이름의 원본(현장사진/)과 정리본(_정리완료/)이 함께 있으면 먼저 나온 쪽에 백업 값을 덮고,
       맞는 쪽은 그대로 두었다
   지금은 안전판·전체 되돌리기와 같은 함수(hjApplySavedFileFields revert)로, fileKey(경로+이름+크기)로 짝을 찾는다.

   실제 UI(선택 복원 창 → [선택 복원])를 눌러 검사한다:
     ① 고른 현장의 파일은 저장 레코드의 모든 필드가 백업 시점 값 그대로다(필드를 나열하지 않는다 — 새로 저장하는
        필드가 생기면 여기서 걸린다). Drive 신원은 물리적 사실이라 지금 값을 지킨다
     ①' 원본 출처 사실(sourceSha256·mediaOriginal·sourceModifiedAt)도 Drive 처럼 지금 값을 지킨다 — 백업 뒤 서버에 원본을
        올린 사진을 복원해도 서버 원본 기록(mediaOriginal.fileId)을 잊지 않는다. 지금 비어 있으면 백업 값으로 채운다
     ② 동명 원본/정리본 쌍은 각자 자기 백업 레코드로 돌아간다 — 서로 바뀌거나 한쪽만 덮이지 않는다
        백업 뒤에 생긴 정리본(백업에 없는 경로)은 이름이 같아도 건드리지 않는다
     ③ 경로가 바뀐 파일(정리·이동)은 백업과 지금 양쪽에 그 이름이 하나뿐일 때만 이름으로 찾아 되돌린다
     ④ 고르지 않은 현장의 파일·백업 뒤 새로 들어온 파일·다른 현장은 그대로다
     ⑤ 현장 레코드: 백업의 모든 필드(모르는 필드 __probe 포함)가 돌아오고, 보관 여부는 지금 값, 백업에 아예 없던
        필드는 남긴다(창이 그렇게 말한다), 옛 백업의 access(출입정보)는 되살리지 않는다
     ⑥ 복원한 값이 창에 붙잡힌 백업 자료와 객체를 나눠 쓰지 않는다(이후 편집이 백업을 고치지 않는다),
        토스트가 되돌린 파일 수를 말한다
     ⑦ pageerror 0

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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(async () => {
    await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone, __hjRelayBootDone]);
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
  });

  // 시드: 백업 시점 상태 → serializeData 로 백업 자료 → 지금 상태로 바꾼다
  await page.evaluate(() => {
    const SEL = '선택현장', OTHER = '다른현장';
    const sha = 'd'.repeat(64);
    const base = (id, name, prefix, size, extra) => ({ id, name, handle: null, prefix, ext: name.split('.').pop(), size,
      kind: 'photo', project: SEL, when: new Date('2026-09-01T09:00:00'), lat: 36.3, lng: 127.4, place: null, address: null, thumb: null,
      text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null,
      _phase: null, _worklabel: null, _gdFolder: null, _driveId: null, _driveMimeType: null, _driveSize: 0, _file: null, ...extra });
    const backupFiles = () => [
      // ① 모든 필드를 채운 사진 — 동명 쌍의 원본 쪽
      base('raw', '동명.jpg', '현장사진/', 100, { _phase: '타일', _worklabel: '원본 작업명', text: '원본 메모', ocr: 'done',
        address: '대전 가상구 · 백업 건물', contact: { name: '가상' }, _gdFolder: '현장사진', _aptUnit: { project: SEL, unitId: 'u1' },
        sourceModifiedAt: '2026-09-01T00:00:00.000Z', _originalSha256: sha, _mediaOriginal: { fileId: 'TEST_ORIGINAL_SEL', sha256: sha, size: 100 },
        _driveId: 'drive-raw', _driveMimeType: 'image/jpeg', _driveSize: 100 }),
      // ② 동명 쌍의 정리본 쪽(같은 크기 — v323 이 둘 다 남기는 쌍)
      base('org', '동명.jpg', '_정리완료/선택현장/현장사진/', 100, { _phase: '타일', _worklabel: '정리본 작업명', text: '정리본 메모',
        _aptUnit: { project: SEL, unitId: 'u2' }, _driveId: 'drive-org', _driveMimeType: 'image/jpeg', _driveSize: 100 }),
      // ① 견적 — 집계 제외·장부·견적 품목
      base('est', '견적.xlsx', '견적서/선택현장/', 500, { kind: 'estimate', text: '견적 본문', ocr: 'done',
        est: { amount: 2200000, supply: 2000000, vat: 200000, _edited: true }, exSum: false,
        ledger: { memo: '백업 장부' }, quote: { items: [{ name: '백업 품목', qty: 1, price: 2000000 }] }, _phase: '견적', _worklabel: '백업 견적' }),
      // ③ 백업 뒤 정리 폴더로 옮겨진 사진(이름은 하나뿐)
      base('moved', '이동전.jpg', '현장사진/', 200, { _worklabel: '옮기기 전 작업명', _phase: '철거' }),
      // ② 백업 때는 원본만 있었고, 뒤에 같은 이름의 정리본이 생겼다
      base('only', '뒤에정리.jpg', '현장사진/', 300, { _worklabel: '백업 원본 작업명' }),
      // ①' 백업 때는 원본 증빙이 없었고, 백업 뒤 서버에 원본을 올렸다
      base('upl', '올린영상.mp4', '현장사진/', 700, { kind: 'photo', _worklabel: '백업 영상 작업명' }),
      // ④ 고르지 않은 현장의 사진
      base('other', '남의사진.jpg', '현장사진/', 400, { project: OTHER, _worklabel: '다른현장 백업 값' })
    ];
    state.projects = [
      { name: SEL, stage: 2, received: 1000000, phases: ['철거', '타일'], cost: { material: 10, labor: 20, outsource: 30 },
        customer: { name: '백업고객', phone: '010-0000-1234', addr: '대전 가상구' }, geo: null, archived: false,
        siteRules: { hours: '백업 시간', park: '지하' }, extras: [{ id: 'x1', text: '백업 추가공사', amount: 100000 }],
        measure: { rooms: [{ name: '거실', w: 4, d: 5 }] }, casePack: { place: '가상동', photos: ['raw'], consent: true },
        aptUnits: [{ id: 'u1', type: 'unit', dong: '107', ho: '1302', name: '', note: '' }, { id: 'u2', type: 'unit', dong: '107', ho: '1303', name: '', note: '' }],
        warrantyLog: [{ at: '2026-09-01', via: 'pdf' }], portalAsk: [{ q: '백업 질문' }], doneAt: '2026-09-01',
        __probe: { deep: [1, { two: 2 }] } },
      { name: OTHER, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '다른고객', phone: '', addr: '' }, geo: null }
    ];
    state.files = backupFiles(); state.quotes = [];
    const data = serializeData();
    // 옛 백업에 섞여 있던 출입정보 — 되살리면 안 된다
    data.projects.find(p => p.name === SEL).access = { door: '1234' };
    window.__backupData = data;
    window.__backupSnapshot = JSON.stringify(data);

    // 지금 상태 — 백업 뒤 바뀐 값들
    const now = backupFiles();
    const f = id => now.find(x => x.id === id);
    Object.assign(f('raw'), { _worklabel: '지금 원본', text: '지금 메모', _phase: '도배', address: null, contact: null, _gdFolder: null,
      _aptUnit: { project: SEL, unitId: 'u2' }, exSum: true, ledger: { memo: '지금 장부' } });
    Object.assign(f('org'), { _worklabel: '지금 정리본', text: '', _aptUnit: { project: SEL, unitId: 'u1' } });
    Object.assign(f('est'), { exSum: true, est: { amount: 9900000, supply: 9000000, vat: 900000, _edited: true }, ledger: null,
      quote: { items: [{ name: '지금 품목', qty: 2, price: 1 }] }, _worklabel: '지금 견적', _driveId: 'drive-est-after', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 500,
      // 백업에는 없던 동·호수 — 되돌리면 없어져야 한다(백업 시점에 없던 값).
      // 출처 시각은 파일의 물리적 사실이라 지금 값을 지킨다(①' — 새 계약: 선택 복원이 출처 사실을 지우지 않는다)
      _aptUnit: { project: SEL, unitId: 'u2' }, sourceModifiedAt: '2026-09-22T00:00:00.000Z' });
    // ①' 백업 뒤 서버에 원본을 올린 영상 — 지금만 증빙이 있다
    Object.assign(f('upl'), { _worklabel: '지금 영상 작업명', _originalSha256: 'e'.repeat(64),
      _mediaOriginal: { fileId: 'TEST_ORIGINAL_AFTER_BACKUP', sha256: 'e'.repeat(64), size: 700 },
      sourceModifiedAt: '2026-09-23T00:00:00.000Z', _sourceVerification: { state: 'verified', sha256: 'e'.repeat(64) } });
    // ①' 지금 증빙이 비어 있는 원본 — 백업 값으로 채운다
    delete f('raw')._originalSha256; delete f('raw')._mediaOriginal;
    Object.assign(f('moved'), { prefix: '_정리완료/선택현장/현장사진/', _worklabel: '옮긴 뒤 작업명', _phase: null });
    Object.assign(f('only'), { _worklabel: '지금 원본2' });
    Object.assign(f('other'), { _worklabel: '다른현장 지금 값' });
    now.push(base('orgAfter', '뒤에정리.jpg', '_정리완료/선택현장/현장사진/', 280, { _worklabel: '뒤에 생긴 정리본' }));
    now.push(base('fresh', '새사진.jpg', '현장사진/', 600, { _worklabel: '백업 뒤 새 사진' }));
    state.files = now;
    state.projects = [
      { name: SEL, stage: 4, received: 3000000, phases: ['도배'], cost: { material: 99, labor: 99, outsource: 99 },
        customer: { name: '지금고객', phone: '', addr: '' }, geo: null, archived: true,
        siteRules: { hours: '지금 시간' }, extras: [], measure: { rooms: [] }, casePack: { place: '지금', photos: [], consent: false, sentAt: '2026-09-20' },
        aptUnits: [], warrantyLog: [], portalAsk: [], doneAt: '2026-09-25', __probe: '지금 값',
        warrantySigs: [{ at: '2026-09-21', png: 'data:image/png;base64,TESTSIG', via: 'link' }] },
      { name: OTHER, stage: 3, received: 50, phases: ['지금'], cost: { material: 1, labor: 1, outsource: 1 }, customer: { name: '다른현장 지금 고객', phone: '', addr: '' }, geo: null }
    ];
    window.__backups = [{ name: '현장_20260920120000.json', handle: null, data }];
  });

  // 실제 UI: 선택 창 → 다른현장 체크 해제 → [선택 복원]
  await page.evaluate(() => restoreSelect(0));
  await page.waitForSelector('#modalRoot input[data-bkp]');
  const notice = await page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  assert(/백업 뒤에 새로 들어온 파일은 지우지 않고 그대로 둡니다/.test(notice), '⑤ 창이 실제 동작(새 파일·백업에 없던 항목은 남긴다)을 말한다: ' + notice.slice(0, 200));
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('#modalRoot input[data-bkp]')];
    const projs = window.__backups[0].data.projects;
    boxes.forEach(b => { b.checked = projs[+b.dataset.bkp].name === '선택현장'; });
  });
  await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click());
  await page.waitForFunction(() => (window.__toasts || []).some(t => /현장을 복원했습니다/.test(t)));

  const r = await page.evaluate(() => {
    const saved = JSON.parse(JSON.stringify(serializeData()));   // 아래 편집 전에 값으로 떠 둔다(serializeData 는 객체를 복사하지 않는다)
    const pick = (list, prefix, name) => (list || []).find(f => f.prefix === prefix && f.name === name) || null;
    const backup = JSON.parse(window.__backupSnapshot);
    const sel = state.projects.find(p => p.name === '선택현장');
    const other = state.projects.find(p => p.name === '다른현장');
    const bSel = backup.projects.find(p => p.name === '선택현장');
    const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
    const projDiff = Object.keys(bSel).filter(k => !['archived', 'access'].includes(k) && stable(bSel[k]) !== stable(sel[k]))
      .map(k => k + ': ' + stable(bSel[k]) + ' → ' + stable(sel[k]));
    // ⑥ 복원 뒤 편집이 창에 붙잡힌 백업 자료를 고치지 않는다
    sel.siteRules.hours = '복원 뒤 편집'; sel.extras.push({ id: 'x2' });
    const rawNow = state.files.find(f => f.prefix === '현장사진/' && f.name === '동명.jpg');
    if (rawNow && rawNow.contact) rawNow.contact.name = '복원 뒤 편집';
    const backupUntouched = JSON.stringify(window.__backups[0].data) === window.__backupSnapshot;
    return {
      pairs: [
        ['raw', pick(backup.files, '현장사진/', '동명.jpg'), pick(saved.files, '현장사진/', '동명.jpg')],
        ['org', pick(backup.files, '_정리완료/선택현장/현장사진/', '동명.jpg'), pick(saved.files, '_정리완료/선택현장/현장사진/', '동명.jpg')],
        ['est', pick(backup.files, '견적서/선택현장/', '견적.xlsx'), pick(saved.files, '견적서/선택현장/', '견적.xlsx')],
        ['upl', pick(backup.files, '현장사진/', '올린영상.mp4'), pick(saved.files, '현장사진/', '올린영상.mp4')]
      ],
      uplVerify: (state.files.find(f => f.name === '올린영상.mp4') || {})._sourceVerification || null,
      moved: pick(saved.files, '_정리완료/선택현장/현장사진/', '이동전.jpg'),
      only: pick(saved.files, '현장사진/', '뒤에정리.jpg'),
      orgAfter: pick(saved.files, '_정리완료/선택현장/현장사진/', '뒤에정리.jpg'),
      fresh: pick(saved.files, '현장사진/', '새사진.jpg'),
      otherFile: pick(saved.files, '현장사진/', '남의사진.jpg'),
      projDiff,
      archived: sel.archived, access: sel.access, sigs: sel.warrantySigs,
      other: { stage: other.stage, cust: other.customer && other.customer.name },
      backupUntouched,
      toast: (window.__toasts || []).find(t => /현장을 복원했습니다/.test(t))
    };
  });

  // ① 모든 저장 필드가 백업 값 그대로 — Drive 신원(driveId·형식·크기)은 물리적 사실이라 지금 값을 지킨다(안전판 되돌리기와 같은 규칙)
  // 원본 출처 사실(SOURCE)도 같은 규칙 — 아래 ①' 에서 따로 본다
  const DRIVE = new Set(['driveId', 'driveMimeType', 'driveSize', 'sourceSha256', 'mediaOriginal', 'sourceModifiedAt']);
  for (const [label, before, after] of r.pairs) {
    assert(before && after, `① ${label} 레코드를 못 찾았다: ` + JSON.stringify({ before: !!before, after: !!after }));
    // 백업에 없던 키가 복원 뒤에 남아 있는 것도 잡도록 양쪽 키를 합쳐 본다
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (DRIVE.has(k)) continue;
      const bv = JSON.stringify(before[k] === undefined ? null : before[k]);
      const av = JSON.stringify(after[k] === undefined ? null : after[k]);
      assert(bv === av, `① ${label} 의 "${k}" 가 백업 시점으로 안 돌아왔다: 백업 ${bv} → 복원 후 ${av}`);
    }
  }
  const est = r.pairs.find(p => p[0] === 'est')[2];
  assert(est.driveId === 'drive-est-after' && est.driveSize === 500, '① 백업 뒤 붙은 Drive 연결은 물리적 사실이라 지킨다: ' + JSON.stringify(est));
  console.log('PASS  ① 고른 현장 파일의 저장 필드 전부(작업명·동·호수·메모·집계 제외·장부·견적 품목)가 백업 값으로');

  const upl = r.pairs.find(p => p[0] === 'upl')[2];
  assert(upl.worklabel === '백업 영상 작업명', "①' 영상의 작업명은 백업 값으로: " + JSON.stringify(upl));
  assert(upl.mediaOriginal && upl.mediaOriginal.fileId === 'TEST_ORIGINAL_AFTER_BACKUP', "①' 백업 뒤 서버에 올린 원본 기록(mediaOriginal)을 지웠다: " + JSON.stringify(upl));
  assert(upl.sourceSha256 === 'e'.repeat(64), "①' 백업 뒤 붙은 원본 해시를 지웠다: " + JSON.stringify(upl));
  assert(upl.sourceModifiedAt === '2026-09-23T00:00:00.000Z', "①' 파일 수정 시각을 지웠다: " + JSON.stringify(upl));
  assert(r.uplVerify && r.uplVerify.state === 'verified', "①' 지킨 증빙의 검증 상태까지 지웠다: " + JSON.stringify(r.uplVerify));
  assert(est.sourceModifiedAt === '2026-09-22T00:00:00.000Z', "①' 견적 파일의 수정 시각을 지웠다: " + JSON.stringify(est));
  const [, rawB, rawA] = r.pairs.find(p => p[0] === 'raw');
  assert(rawA.sourceSha256 === rawB.sourceSha256 && JSON.stringify(rawA.mediaOriginal) === JSON.stringify(rawB.mediaOriginal) && rawB.mediaOriginal,
    "①' 지금 비어 있는 원본 증빙은 백업 값으로 채운다: " + JSON.stringify({ b: rawB.mediaOriginal, a: rawA.mediaOriginal }));
  console.log("PASS  ①' 원본 해시·서버 원본 기록·수정 시각은 지금 값을 지키고, 비어 있으면 백업 값으로 채운다");

  // ② 동명 쌍은 각자 제자리로(위 ① 에서 raw·org 가 각자 백업 레코드와 일치) + 백업에 없던 정리본은 그대로
  assert(r.only && r.only.worklabel === '백업 원본 작업명', '② 백업에 있던 원본은 되돌린다: ' + JSON.stringify(r.only));
  assert(r.orgAfter && r.orgAfter.worklabel === '뒤에 생긴 정리본', '② 백업 뒤 생긴 같은 이름의 정리본에 원본의 백업 값을 덮었다: ' + JSON.stringify(r.orgAfter));
  console.log('PASS  ② 동명 원본/정리본 — 경로+이름+크기로 제 짝만 되돌린다');

  // ③ 옮긴 파일(이름 하나뿐) — 이름으로 찾아 되돌린다
  assert(r.moved && r.moved.worklabel === '옮기기 전 작업명' && r.moved.phase === '철거', '③ 경로가 바뀐 파일을 되돌리지 못했다: ' + JSON.stringify(r.moved));
  console.log('PASS  ③ 정리·이동으로 경로가 바뀐 파일은 이름이 하나뿐일 때 되돌린다');

  // ④ 고르지 않은 현장·새 파일·다른 현장
  assert(r.otherFile && r.otherFile.worklabel === '다른현장 지금 값', '④ 고르지 않은 현장의 파일을 되돌렸다: ' + JSON.stringify(r.otherFile));
  assert(r.fresh && r.fresh.worklabel === '백업 뒤 새 사진' && r.fresh.project === '선택현장', '④ 백업 뒤 새로 들어온 파일을 건드렸다: ' + JSON.stringify(r.fresh));
  assert(r.other.stage === 3 && r.other.cust === '다른현장 지금 고객', '④ 고르지 않은 현장 레코드를 덮었다: ' + JSON.stringify(r.other));
  console.log('PASS  ④ 고르지 않은 현장·백업 뒤 새 파일은 그대로');

  // ⑤ 현장 레코드
  assert(r.projDiff.length === 0, '⑤ 현장 필드가 백업 값으로 안 돌아왔다: ' + r.projDiff.join(' | '));
  assert(r.archived === true, '⑤ 보관 여부는 지금 운영 상태라 되돌리지 않는다: ' + r.archived);
  assert(r.access === undefined, '⑤ 옛 백업의 access(출입정보)가 되살아났다');
  assert(Array.isArray(r.sigs) && r.sigs.length === 1, '⑤ 백업에 아예 없던 필드(서명 등)는 창이 말한 대로 남는다: ' + JSON.stringify(r.sigs));
  console.log('PASS  ⑤ 현장 레코드 — 모르는 필드 포함 전부, 보관 여부는 지금 값, 백업에 없던 필드는 남김, 출입정보 제외');

  // ⑥ 백업 자료 분리·토스트
  assert(r.backupUntouched, '⑥ 복원한 값이 창에 붙잡힌 백업 자료와 같은 객체다 — 복원 뒤 편집이 백업을 고쳤다');
  assert(/파일 6개 되돌림/.test(r.toast || ''), '⑥ 토스트가 되돌린 파일 수(6)를 말한다: ' + r.toast);
  console.log('PASS  ⑥ 백업 자료와 객체를 나누지 않는다 · 토스트가 파일 수를 말한다');

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));
  console.log('PASS  ⑦ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

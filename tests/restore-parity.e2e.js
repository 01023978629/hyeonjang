/* restore-parity.e2e.js — 저장(serializeData) ↔ 복원(applyData) 필드 패리티

   2026-08-28 감사에서 실증된 사고: 부팅·서버·드라이브 복원이 전부 지나가는
   applyData 의 '가상 항목' push 에 exSum(집계 제외)·ledger 가 빠져 있어,
   복원 한 번에 '집계 제외' 표시가 풀리고 초안 견적이 매출·부가세에 다시 잡혔다.
   그 상태로 저장되면 서버·백업 사본까지 오염된다.

   이 테스트는 필드 이름을 하나씩 나열하지 않는다 — serializeData 가 저장한
   레코드를 빈 상태에 applyData 로 넣고 다시 serializeData 해서, 저장 레코드가
   **왕복 후에도 같은지**를 통째로 비교한다. 다음에 어떤 필드를 새로 저장하든
   복원 쪽에 안 넣으면 여기서 걸린다.

     ① 가상 복원(실파일 없음 = 부팅 직후) 왕복에서 저장 필드가 그대로다
     ② 특히 exSum:true 와 ledger 가 살아남는다 (실증된 사고 그 자체)
     ③ 집계도 확인: 복원 후 salesEstimateFiles 합계에 제외 견적이 안 들어간다
     ⑤ 현장(project) 레코드도 같은 방식으로 — 병합(부팅·서버·드라이브)과 되돌리기(revert) 두 모드 모두
        저장한 현장의 모든 필드(모르는 필드 __probe 포함)가 그대로다. 지금은 applyData 가 {...clean} 전개라
        안전하지만, 필드 목록을 손으로 적는 순간 새 필드(부대사항·추가공사·보증서·사례…)가 조용히 사라진다.
        의도된 누락은 이름으로 따로 단정한다 — 옛 백업의 access(출입정보)와 부대사항에 섞인 출입번호.
     ⑥ 재스캔 편집 백업(backupUserEdits → ingestFile 의 restoreUserEdits) 왕복 — 저장 레코드의 모든 필드가
        새로 읽은 레코드에 되살아난다(장부·견적 품목·건물명·드라이브 폴더 기록이 빠져 있었다)
     ⑦ 원본/정리본 병합(mergeOrganizedPhotoDuplicates)이 원본 증빙을 버리지 않는다 — 지워질 쪽에만
        해시·서버 원본 기록이 있거나 Drive 사진이 서로 다르면 합치지 않고, 합칠 때는 Drive 형식·크기와
        출처 수정 시각을 함께 넘긴다
     ④ pageerror 0

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
  await page.route('https://**/*', r => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  // 부팅 복원·중계·OfficeOps 가 끝난 뒤에 시드한다(고정 대기는 느린 러너에서 경쟁 조건이 된다)
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone && window.__hjRelayBootDone);
  await page.evaluate(async () => { await Promise.all([__hjRestoreDone, __hjRelayConfigDone, __hjOfficeOpsBootDone, __hjRelayBootDone]); });

  const r = await page.evaluate(() => {
    // 시드: 저장 스키마의 모든 필드를 채운 파일 2개 — 하나는 집계 제외(★초안), 하나는 정상
    state.projects = [{ name: '패리티현장', stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false }];
    state.quotes = [];
    state.files = [
      { id: 'pf1', name: '패리티 견적 초안.xlsx', handle: null, prefix: '견적서/패리티현장/', ext: 'xlsx', size: 1234,
        kind: 'estimate', project: '패리티현장', when: new Date('2026-08-01T09:00:00'), lat: 36.3, lng: 127.4,
        place: null, address: '대전 중구', thumb: null, text: '견적 본문', ocr: 'done',
        est: { amount: 5000000, supply: 4545455, vat: 454545, customer: '패리티', date: '2026-08-01', _edited: true },
        exSum: true, ledger: { memo: '초안 — 집계 제외' }, quote: null, contact: null,
        _phase: '견적', _worklabel: '초안', _gdFolder: 'gdX', _driveId: 'driveA', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 1234, _file: null },
      // 두 번째 파일도 전 필드를 채운다 — 왕복 비교가 '기본값 정규화'(ocr 미지정→'na' 등)를
      // 버그로 오인하지 않게, 시드는 항상 완전해야 한다.
      { id: 'pf2', name: '패리티 견적 최종.xlsx', handle: null, prefix: '견적서/패리티현장/', ext: 'xlsx', size: 2345,
        kind: 'estimate', project: '패리티현장', when: new Date('2026-08-02T09:00:00'), lat: 36.31, lng: 127.41,
        place: null, address: '대전 중구 2', thumb: null, text: '최종 본문', ocr: 'done',
        est: { amount: 7000000, supply: 6363636, vat: 636364, customer: '패리티', date: '2026-08-02', _edited: true },
        exSum: false, ledger: null, quote: null, contact: null,
        _phase: '견적', _worklabel: '최종', _gdFolder: 'gdY', _driveId: 'driveB', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 2345, _file: null }
    ];
    const s1 = serializeData();
    // 부팅 직후 상태 재현: 실파일 0 → 전부 가상 복원 경로
    state.files = []; state.projects = []; state.quotes = [];
    window.__scanFresh = false;
    applyData(JSON.parse(JSON.stringify(s1)));
    const s2 = serializeData();
    const pick = (s, name) => (s.files || []).find(f => f.name === name) || null;
    // 집계 확인 — 제외(★초안) 견적이 매출 합계에 다시 들어오면 안 된다
    let saleTotal = 0;
    try { salesEstimateFiles().forEach(f => { saleTotal += (f.est && f.est.amount) || 0; }); } catch (e) { saleTotal = -1; }
    return {
      a1: pick(s1, '패리티 견적 초안.xlsx'), a2: pick(s2, '패리티 견적 초안.xlsx'),
      b1: pick(s1, '패리티 견적 최종.xlsx'), b2: pick(s2, '패리티 견적 최종.xlsx'),
      saleTotal, n2: (s2.files || []).length
    };
  });

  assert(r.a1 && r.a2 && r.b1 && r.b2, '① 왕복 후 파일 레코드가 사라졌다: ' + JSON.stringify({ n: r.n2 }));

  // ① 저장 레코드 전 필드 왕복 비교 — 필드가 늘어도 자동으로 지켜진다
  for (const [before, after, label] of [[r.a1, r.a2, '초안'], [r.b1, r.b2, '최종']]) {
    for (const k of Object.keys(before)) {
      const bv = JSON.stringify(before[k] === undefined ? null : before[k]);
      const av = JSON.stringify(after[k] === undefined ? null : after[k]);
      assert(bv === av, `① ${label} 레코드의 "${k}" 가 왕복에서 변질됐다: 저장 ${bv} → 복원 후 ${av}`);
    }
  }

  // ② 실증된 사고 그 자체
  assert(r.a2.exSum === true, '② 복원 후 exSum(집계 제외)이 풀렸다 — 초안이 매출에 다시 잡힌다');
  assert(r.a2.ledger && r.a2.ledger.memo === '초안 — 집계 제외', '② 복원 후 ledger 가 유실됐다');

  // ③ 매출 합계에 제외 견적 미포함 (700만만, 500만 초안 제외)
  assert(r.saleTotal === 7000000, '③ 복원 후 매출 집계에 제외 견적이 들어갔다: ' + r.saleTotal);

  console.log('PASS  ① 저장↔가상복원 전 필드 왕복 일치');
  console.log('PASS  ② exSum·ledger 생존 (실증 사고 회귀)');
  console.log('PASS  ③ 복원 후 매출 집계에 제외 견적 미포함');

  // ⑤ 현장 레코드 왕복 — 병합·되돌리기 두 모드. 필드 이름을 나열하지 않고 저장 레코드 전체를 비교한다.
  const FULL_PROJECT = {
    name: '패리티현장', stage: 3, received: 1500000, phases: ['철거', '타일'], cost: { material: 100, labor: 200, outsource: 300 },
    customer: { name: '가상고객', phone: '010-0000-1234', addr: '대전 가상구 1' }, geo: { lat: 36.3, lng: 127.4 },
    archived: false, doneAt: '2026-09-01', reviewRequestedAt: '2026-09-02T00:00:00.000Z',
    aptUnits: [{ id: 'u1', type: 'unit', dong: '107', ho: '1302', name: '', note: '' }, { id: 'c1', type: 'common', dong: '', ho: '', name: '공용부', note: '' }],
    siteRules: { hours: '평일 9~18시', park: '지하 2층', at: '2026-09-01', atMap: { hours: '2026-09-01', park: '2026-08-30' } },
    extras: [{ id: 'x1', date: '2026-09-03', text: '추가 타일', amount: 300000, days: 1, photo: 'pf1', agreed: true }],
    casePack: { place: '가상동 가상아파트', photos: ['pf1'], consent: true, sentAt: '2026-09-20' },
    measure: { rooms: [{ name: '거실', w: 4.2, d: 5.1, h: 2.3, open: 3.2 }] },
    warrantyDoc: { at: '2026-09-05', file: '가상_완료보증서.html', html: '<p>TEST</p>', photoIds: ['pf1'] },
    warrantyLog: [{ at: '2026-09-05', via: 'pdf' }],
    warrantySigs: [{ at: '2026-09-06', png: 'data:image/png;base64,TESTSIG', via: 'link' }],
    warrantyLinks: [{ id: 'TEST-LINK-1', at: '2026-09-06', status: 'sent' }],
    portalUrl: 'https://example.invalid/portal/TEST', portalToken: 'TEST-PORTAL-TOKEN', portalAsk: [{ q: '가상 질문' }], portalApproval: { ok: true },
    portalMsgs: [{ t: '가상 메시지' }], portalNotice: '가상 공지', portalSig: 'data:image/png;base64,TESTPORTAL', portalSyncAt: '2026-09-07T00:00:00.000Z',
    portalReview: { stars: 5 }, portalAcc: { views: 1 },
    __probe: { deep: { list: [1, 'two', { three: 3 }] }, flag: true }
  };
  const r5 = await page.evaluate((full) => {
    // 키 순서와 무관하게 비교하고, 어긋나면 어느 키가 어떻게 바뀌었는지 이름을 말한다
    const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x);
    const diff = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
      .filter(k => stable(a && a[k]) !== stable(b && b[k])).map(k => k + ': ' + stable(a && a[k]) + ' → ' + stable(b && b[k]));
    const byName = (list, name) => (list || []).find(p => p && p.name === name) || null;
    const second = { name: '둘째현장', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null };
    state.files = []; state.quotes = [];
    state.projects = [structuredClone(full), structuredClone(second)];
    const s1 = serializeData();
    const out = {};
    // 병합 모드(부팅·서버·드라이브 적용) — 빈 상태에 넣는다
    state.projects = [];
    applyData(JSON.parse(JSON.stringify(s1)));
    out.merge = diff(byName(s1.projects, '패리티현장'), byName(state.projects, '패리티현장'));
    out.mergeSecond = diff(byName(s1.projects, '둘째현장'), byName(state.projects, '둘째현장'));
    out.mergeSaved = diff(byName(s1.projects, '패리티현장'), byName(serializeData().projects, '패리티현장'));
    // 되돌리기 모드 — 값이 바뀌고, 스냅샷 뒤에 생긴 필드·현장이 있는 상태에서 되돌린다
    state.projects = [{ ...structuredClone(full), stage: 5, received: 0, customer: { name: '바뀐고객' }, extras: [], __probe: '바뀜', nowOnly: '스냅샷 뒤에 생긴 필드' },
      { name: '스냅샷에없는현장', stage: 1, received: 0, phases: [], cost: {}, customer: {} }];
    applyData(JSON.parse(JSON.stringify(s1)), { revert: true });
    out.revert = diff(byName(s1.projects, '패리티현장'), byName(state.projects, '패리티현장'));
    out.revertNames = state.projects.map(p => p.name).sort();
    // 의도된 누락 — 옛 백업에 섞여 있던 출입정보(access)와 부대사항의 출입번호는 되살리지 않는다(AGENTS v284·v286)
    const legacy = JSON.parse(JSON.stringify(s1));
    const lp = byName(legacy.projects, '패리티현장');
    lp.access = { door: '1234' }; lp.siteRules.etc = '도어락 1234';
    for (const mode of ['merge', 'revert']) {
      state.projects = [];
      applyData(JSON.parse(JSON.stringify(legacy)), mode === 'revert' ? { revert: true } : undefined);
      const got = byName(state.projects, '패리티현장');
      out['legacy_' + mode] = { access: got && got.access, etc: got && got.siteRules && got.siteRules.etc,
        rest: diff(byName(s1.projects, '패리티현장'), got) };
    }
    return out;
  }, FULL_PROJECT);
  assert(r5.merge.length === 0, '⑤ 병합 모드 applyData 가 현장 필드를 바꾸거나 버렸다: ' + r5.merge.join(' | '));
  assert(r5.mergeSecond.length === 0, '⑤ 병합 모드 applyData 가 기본값만 있는 현장을 바꿨다: ' + r5.mergeSecond.join(' | '));
  assert(r5.mergeSaved.length === 0, '⑤ 병합 후 다시 저장한 현장 레코드가 처음 저장과 다르다: ' + r5.mergeSaved.join(' | '));
  assert(r5.revert.length === 0, '⑤ 되돌리기 모드가 현장을 스냅샷 값 그대로 되돌리지 않았다(뒤에 생긴 필드가 남거나 값이 섞였다): ' + r5.revert.join(' | '));
  assert(r5.revertNames.join(',') === '둘째현장,패리티현장', '⑤ 되돌리기 뒤 현장 목록이 스냅샷과 다르다: ' + r5.revertNames.join(','));
  for (const mode of ['merge', 'revert']) {
    const g = r5['legacy_' + mode];
    assert(g.access === undefined, `⑤ ${mode}: 옛 백업의 access(출입정보)가 되살아났다`);
    assert(g.etc === undefined, `⑤ ${mode}: 부대사항에 섞인 출입번호가 되살아났다`);
    assert(g.rest.length === 0, `⑤ ${mode}: 출입정보를 빼면서 다른 현장 필드까지 바뀌었다: ` + g.rest.join(' | '));
  }
  console.log('PASS  ⑤ 현장 레코드 전 필드 왕복 — 병합·되돌리기, 모르는 필드 포함, 출입정보만 의도적으로 뺀다');

  // ⑥ 재스캔 편집 백업 — backupUserEdits 로 담아 두고, 새로 읽은 레코드(ingestFile 모양)에 restoreUserEdits
  const r6 = await page.evaluate(() => {
    const when = new Date('2026-08-03T09:00:00');
    const full = { id: 're1', name: '재스캔 견적.xlsx', handle: null, prefix: '견적서/패리티현장/', ext: 'xlsx', size: 4321,
      kind: 'estimate', project: '패리티현장', when, lat: 36.3, lng: 127.4, place: null, address: '대전 가상구 · 가상빌딩', thumb: null,
      text: '재스캔 본문', ocr: 'done', est: { amount: 3300000, supply: 3000000, vat: 300000, _edited: true }, exSum: true,
      ledger: { type: 'card', rows: 2, byYm: { '2026-08': { cnt: 2, amt: 3300000, supply: 3000000, vat: 300000 } } },
      quote: { items: [{ name: '타일', qty: 1, price: 3000000 }] }, contact: { name: '가상', phone: '010-0000-1234' },
      _phase: '견적', _worklabel: '재스캔 작업명', _gdFolder: '견적서', _driveId: 'driveRE', _driveMimeType: 'application/vnd.ms-excel', _driveSize: 4321,
      _originalSha256: 'a'.repeat(64), _mediaOriginal: { fileId: 'TEST_ORIGINAL_RE', sha256: 'a'.repeat(64), size: 4321 },
      _aptUnit: { project: '패리티현장', unitId: 'u1' }, sourceModifiedAt: '2026-08-03T00:00:00.000Z', _file: null };
    state.files = [full];
    const before = serializeData().files[0];
    backupUserEdits();
    // ingestFile 이 새로 만드는 레코드 모양 — 파일에서 다시 읽는 when·lat·lng·size·sourceModifiedAt 은 같게 둔다
    const fresh = { id: 're2', name: full.name, handle: null, prefix: full.prefix, ext: 'xlsx', size: full.size, kind: 'other',
      project: null, when, lat: 36.3, lng: 127.4, place: null, address: null, thumb: null, text: '', ocr: 'pending',
      est: null, contact: null, _driveMimeType: null, _driveSize: 0, _file: null, sourceModifiedAt: full.sourceModifiedAt };
    restoreUserEdits(fresh);
    state.files = [fresh];
    const after = serializeData().files[0];
    // ⑥' 분류가 other·현장 없음 — 손댄 흔적이 이 한 필드뿐인 파일도 백업에 담겨 재스캔에서 살아난다
    //     (kind!=='other' 이 이미 참인 위 시드로는 touched 조건의 새 항목을 지키지 못한다 — 필드마다 따로 본다)
    const only = { ledger: { type: 'card', rows: 1 }, quote: { items: [{ name: '가상 품목', qty: 1, price: 1000 }] },
      address: '대전 가상구 · 손으로 적은 건물', _gdFolder: '기타', exSum: true };
    const lone = {};
    for (const [k, v] of Object.entries(only)) {
      const name = '기타_' + k.replace('_', '') + '.pdf';
      const base = { id: 'o-' + k, name, handle: null, prefix: '기타/', ext: 'pdf', size: 111, kind: 'other', project: null, when: null,
        lat: null, lng: null, place: null, address: null, thumb: null, text: '', ocr: 'na', est: null, contact: null,
        _driveMimeType: null, _driveSize: 0, _file: null };
      state.files = [{ ...structuredClone(base), [k]: structuredClone(v) }];
      backupUserEdits();
      const fresh2 = { ...structuredClone(base), id: 'o2-' + k, ocr: 'pending' };
      restoreUserEdits(fresh2);
      lone[k] = JSON.stringify(fresh2[k] === undefined ? null : fresh2[k]) === JSON.stringify(v) ? 'ok' : 'lost: ' + JSON.stringify(fresh2[k]);
    }
    return { before, after, lone };
  });
  for (const k of Object.keys(r6.before)) {
    const bv = JSON.stringify(r6.before[k] === undefined ? null : r6.before[k]);
    const av = JSON.stringify(r6.after[k] === undefined ? null : r6.after[k]);
    assert(bv === av, `⑥ 재스캔 뒤 "${k}" 가 사라지거나 바뀌었다(backupUserEdits/restoreUserEdits 에 없다): 저장 ${bv} → 재스캔 후 ${av}`);
  }
  for (const [k, v] of Object.entries(r6.lone)) assert(v === 'ok', `⑥' kind other·현장 없음 파일의 "${k}" 가 재스캔에서 사라졌다(backupUserEdits touched 조건): ${v}`);
  console.log('PASS  ⑥ 재스캔 편집 백업 — 저장 레코드 전 필드가 새로 읽은 레코드에 되살아난다(other 분류·필드 하나만 손댄 파일 포함)');

  // ⑦ 원본/정리본 병합의 원본 증빙
  const r7 = await page.evaluate(() => {
    const sha = 'b'.repeat(64), orgSha = 'c'.repeat(64);
    const rec = (name, prefix, size, extra) => ({ key: prefix + name + '|' + size, name, prefix, kind: 'photo', project: '패리티현장', size,
      text: '', ocr: 'na', est: null, exSum: false, ledger: null, quote: null, contact: null, address: null, phase: null, worklabel: null, gdFolder: null,
      driveId: null, driveMimeType: null, driveSize: 0, lat: null, lng: null, when: '2026-08-01T00:00:00.000Z', ...extra });
    const org = () => '_정리완료/패리티현장/현장사진/';
    const files = [
      // A: 원본에만 해시·서버 원본 기록 → 합치면 증빙이 사라진다 → 둘 다 남긴다
      rec('ev.jpg', '현장사진/', 100, { sourceSha256: sha, mediaOriginal: { fileId: 'TEST_ORIGINAL_EV', sha256: sha, size: 100 }, driveId: 'drive-ev', driveMimeType: 'image/jpeg', driveSize: 100 }),
      rec('ev.jpg', org(), 90, {}),
      // B: 서로 다른 Drive 사진 → 같은 사진이라는 근거가 없다 → 둘 다 남긴다
      rec('dr.jpg', '현장사진/', 100, { driveId: 'drive-raw', driveMimeType: 'image/jpeg', driveSize: 100 }),
      rec('dr.jpg', org(), 90, { driveId: 'drive-org', driveMimeType: 'image/jpeg', driveSize: 90 }),
      // C: 증빙 없음 → 합친다. Drive ID·형식·크기는 한 묶음으로, 출처 수정 시각은 빈 칸에
      rec('mv.jpg', '현장사진/', 2048, { driveId: 'drive-mv', driveMimeType: 'image/jpeg', driveSize: 2048, sourceModifiedAt: '2026-08-01T01:02:03.000Z' }),
      rec('mv.jpg', org(), 1500, {}),
      // D: 증빙이 남는 쪽(정리본)에만 있다 → 합쳐도 잃는 것이 없다
      rec('ok.jpg', '현장사진/', 300, { driveId: 'drive-ok' }),
      rec('ok.jpg', org(), 280, { sourceSha256: orgSha }),
      // E: 같은 Drive ID 두 기록 — 작은 쪽(지워질 쪽)에만 서버 원본 기록 → 둘 다 남긴다
      rec('dup.jpg', '현장사진/', 100, { driveId: 'drive-dup', mediaOriginal: { fileId: 'TEST_ORIGINAL_DUP', sha256: sha, size: 100 } }),
      rec('dup.jpg', '현장사진/_확인필요/', 900, { driveId: 'drive-dup' }),
      // F: 같은 Drive ID 두 기록 — 지워질 쪽에만 Drive 형식·크기 → 남는 쪽에 채운다
      rec('dm.jpg', '현장사진/', 100, { driveId: 'drive-dm', driveMimeType: 'image/jpeg', driveSize: 777 }),
      rec('dm.jpg', '현장사진/_확인필요/', 900, { driveId: 'drive-dm' }),
      // G: 원본에만 해시(서버 원본 기록 없음) → 합치면 해시가 사라진다 → 둘 다 남긴다
      rec('hs.jpg', '현장사진/', 100, { sourceSha256: sha }),
      rec('hs.jpg', org(), 90, {}),
      // H: 같은 서버 원본 기록인데 해시만 다르다 → 같은 바이트라는 근거가 없다 → 둘 다 남긴다
      rec('hd.jpg', '현장사진/', 100, { sourceSha256: sha, mediaOriginal: { fileId: 'TEST_ORIGINAL_HD', sha256: sha, size: 100 } }),
      rec('hd.jpg', org(), 90, { sourceSha256: orgSha, mediaOriginal: { fileId: 'TEST_ORIGINAL_HD', sha256: sha, size: 100 } }),
      // I: 같은 Drive ID 두 기록 — 지워질 쪽(작은 쪽)에만 해시 → 둘 다 남긴다
      rec('ds.jpg', '현장사진/', 100, { driveId: 'drive-ds', sourceSha256: sha }),
      rec('ds.jpg', '현장사진/_확인필요/', 900, { driveId: 'drive-ds' })
    ];
    const compact = mergeOrganizedPhotoDuplicates(JSON.parse(JSON.stringify(files)));
    const pick = (list, name, prefixStart) => list.filter(f => f.name === name && (!prefixStart || String(f.prefix).startsWith(prefixStart)));
    const c = compact.files;
    // 실제 경로(applyData → 가상 항목)로도 확인
    state.files = []; state.projects = [{ name: '패리티현장', stage: 1, received: 0, phases: [], cost: {}, customer: {}, geo: null }];
    window.__scanFresh = false;
    applyData({ projects: state.projects, files: JSON.parse(JSON.stringify(files)) });
    const live = state.files;
    const liveRaw = live.find(f => f.name === 'ev.jpg' && f.prefix === '현장사진/');
    const liveMv = live.filter(f => f.name === 'mv.jpg');
    return {
      counts: { merged: compact.merged, linked: compact.linked, driveDeduped: compact.driveDeduped, total: c.length },
      ev: pick(c, 'ev.jpg').map(f => f.prefix + '|' + (f.sourceSha256 || '') + '|' + ((f.mediaOriginal || {}).fileId || '')),
      dr: pick(c, 'dr.jpg').map(f => f.prefix + '|' + f.driveId),
      mv: pick(c, 'mv.jpg').map(f => ({ prefix: f.prefix, driveId: f.driveId, mime: f.driveMimeType, size: f.driveSize, mod: f.sourceModifiedAt })),
      ok: pick(c, 'ok.jpg').map(f => ({ prefix: f.prefix, driveId: f.driveId, sha: f.sourceSha256 })),
      dup: pick(c, 'dup.jpg').map(f => f.prefix + '|' + ((f.mediaOriginal || {}).fileId || '')),
      dm: pick(c, 'dm.jpg').map(f => ({ prefix: f.prefix, mime: f.driveMimeType, size: f.driveSize })),
      hs: pick(c, 'hs.jpg').map(f => f.prefix + '|' + (f.sourceSha256 || '')),
      hd: pick(c, 'hd.jpg').map(f => f.prefix + '|' + (f.sourceSha256 || '')),
      ds: pick(c, 'ds.jpg').map(f => f.prefix + '|' + (f.sourceSha256 || '')),
      liveRaw: liveRaw ? { sha: liveRaw._originalSha256, orig: (liveRaw._mediaOriginal || {}).fileId, driveId: liveRaw._driveId } : null,
      liveMv: liveMv.map(f => ({ prefix: f.prefix, driveId: f._driveId, mime: f._driveMimeType, size: f._driveSize, mod: f.sourceModifiedAt }))
    };
  });
  const j7 = JSON.stringify(r7);
  assert(r7.ev.length === 2 && r7.ev.some(x => x === '현장사진/|' + 'b'.repeat(64) + '|TEST_ORIGINAL_EV'),
    '⑦ 원본에만 있던 해시·서버 원본 기록이 병합으로 사라졌다: ' + JSON.stringify(r7.ev));
  assert(r7.liveRaw && r7.liveRaw.sha === 'b'.repeat(64) && r7.liveRaw.orig === 'TEST_ORIGINAL_EV' && r7.liveRaw.driveId === 'drive-ev',
    '⑦ applyData 를 지난 원본 레코드가 증빙을 잃었다: ' + JSON.stringify(r7.liveRaw));
  assert(r7.dr.length === 2 && r7.dr.includes('현장사진/|drive-raw') && r7.dr.some(x => /drive-org$/.test(x)),
    '⑦ 서로 다른 Drive 사진이 붙은 두 레코드를 합쳐 한쪽 연결을 버렸다: ' + JSON.stringify(r7.dr));
  assert(r7.mv.length === 1 && r7.mv[0].prefix.startsWith('_정리완료/') && r7.mv[0].driveId === 'drive-mv' && r7.mv[0].mime === 'image/jpeg' && r7.mv[0].size === 2048,
    '⑦ 합칠 때 Drive ID 만 옮기고 형식·크기를 버렸다: ' + JSON.stringify(r7.mv));
  assert(r7.mv[0].mod === '2026-08-01T01:02:03.000Z', '⑦ 합칠 때 출처 수정 시각(sourceModifiedAt)을 버렸다: ' + JSON.stringify(r7.mv));
  assert(r7.liveMv.length === 1 && r7.liveMv[0].driveId === 'drive-mv' && r7.liveMv[0].mime === 'image/jpeg' && r7.liveMv[0].size === 2048 && r7.liveMv[0].mod === '2026-08-01T01:02:03.000Z',
    '⑦ applyData 를 지난 정리본이 Drive 형식·크기·출처 시각을 잃었다: ' + JSON.stringify(r7.liveMv));
  assert(r7.ok.length === 1 && r7.ok[0].prefix.startsWith('_정리완료/') && r7.ok[0].driveId === 'drive-ok' && r7.ok[0].sha === 'c'.repeat(64),
    '⑦ 남는 쪽에만 증빙이 있으면 합쳐야 한다(잃는 것이 없다): ' + JSON.stringify(r7.ok));
  assert(r7.dup.length === 2 && r7.dup.includes('현장사진/|TEST_ORIGINAL_DUP'),
    '⑦ 같은 Drive ID 정리에서 지워질 쪽의 서버 원본 기록이 사라졌다: ' + JSON.stringify(r7.dup));
  assert(r7.dm.length === 1 && r7.dm[0].prefix === '현장사진/_확인필요/' && r7.dm[0].mime === 'image/jpeg' && r7.dm[0].size === 777,
    '⑦ 같은 Drive ID 정리에서 Drive 형식·크기를 채우지 않았다: ' + JSON.stringify(r7.dm));
  assert(r7.hs.length === 2 && r7.hs.includes('현장사진/|' + 'b'.repeat(64)),
    '⑦ 원본에만 있던 해시(서버 원본 기록 없이)가 병합으로 사라졌다: ' + JSON.stringify(r7.hs));
  assert(r7.hd.length === 2 && r7.hd.includes('현장사진/|' + 'b'.repeat(64)) && r7.hd.some(x => x.endsWith('|' + 'c'.repeat(64))),
    '⑦ 해시가 다른 두 기록을 서버 원본 기록이 같다는 이유로 합쳤다: ' + JSON.stringify(r7.hd));
  assert(r7.ds.length === 2 && r7.ds.includes('현장사진/|' + 'b'.repeat(64)),
    '⑦ 같은 Drive ID 정리에서 지워질 쪽의 해시가 사라졌다: ' + JSON.stringify(r7.ds));
  assert(r7.counts.merged === 2 && r7.counts.linked === 2 && r7.counts.driveDeduped === 1 && r7.counts.total === 15, '⑦ 병합 집계가 예상과 다르다: ' + j7);
  console.log('PASS  ⑦ 원본/정리본 병합 — 원본 증빙·다른 Drive 연결은 합치지 않고, Drive 형식·크기·출처 시각은 함께 넘긴다');

  assert(errors.length === 0, '④ pageerror: ' + errors.join(' | '));
  console.log('PASS  ④ pageerror 0');
  console.log('\n전부 통과 (7건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

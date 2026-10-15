/* estimate-photo-dup-v342.e2e.js — v342 견적 이중 계상·사진 중복 도구·세금 기한 회귀 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신·네트워크 없음.

   2026-10-08 대표 자료에서 실측한 사고를 그대로 시드로 쓴다.
     · 미배정 '20260324 대전.pdf' 26,675,000 이 대전 현장 엑셀과 따로 매출에 더해졌다(사본 판정이 현장 안에서만 돌았다)
     · '넥산 작업.xlsx - 견적서.pdf'(구글 시트 PDF 출력) 2,970,000 이 엑셀과 따로 더해졌다
     · '… - 복사본.pdf' 정규화가 '복'을 남겨 원본과 이름이 갈렸다
     · '용진인테리어.pdf' 1,026,451,304원(사업자번호·숫자 이어 읽기) — 대표가 바뀌면 10억이 매출로 들어간다
     · 중복 사진 검사가 같은 크기 묶음 앞쪽 50장에서 매번 멈춰 늘 '0장'이었다
     · 같은 Drive 파일을 가리키는 빈 기록 242개, 두 현장에 따로 들어간 같은 사진 14장
   반대 방향(더 묶어 매출이 사라지는 것)도 함께 지킨다 — 그쪽이 더 위험하다. */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 견적 시드: [name, project|null, amount, extra]
  const seedEst = (rows, projects) => page.evaluate(([rows, projects]) => {
    state.projects = projects.map(n => ({ name: n, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false }));
    state.quotes = [];
    state.files = rows.map((r, i) => Object.assign({ id: 'e' + i, name: r[0], ext: r[0].split('.').pop().toLowerCase(), kind: 'estimate', project: r[1],
      est: { amount: r[2], supply: Math.round(r[2] / 1.1), vat: r[2] - Math.round(r[2] / 1.1), date: '2026-06-01' }, when: new Date('2026-06-01') }, r[3] || {}));
    const sales = hjSalesEntries().reduce((n, e) => n + e.amount, 0);
    const reps = []; const by = new Map();
    state.files.forEach(f => { const k = f.project || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(f); });
    by.forEach(fs => estimateGroups(fs).forEach(g => reps.push(g.rep.name)));
    return { sales, reps };
  }, [rows, projects]);

  await test('미배정 PDF가 현장에 배정된 같은 견적(날짜·금액·이름)이면 매출에서 빠진다', async () => {
    const r = await seedEst([
      ['★20260324 대전 견적 26,675,000.xlsx', '대전', 26675000],
      ['20260316 대전 견적 13,500,000.xlsx', '대전', 13500000, { exSum: true }],
      ['20260324 대전.pdf', null, 26675000],
      ['20260316 대전.pdf', null, 13500000]], ['대전']);
    assert(r.sales === 26675000, '미배정 사본이 또 더해졌다: ' + r.sales + ' (정답 26,675,000)');
  });

  await test('다른 현장 이름의 미배정 견적은 금액·날짜가 같아도 빠지지 않는다', async () => {
    const r = await seedEst([
      ['20260324 둔산동 견적 5,000,000.xlsx', '둔산동', 5000000],
      ['20260324 유성카페.pdf', null, 5000000]], ['둔산동']);
    assert(r.sales === 10000000, '다른 현장 견적이 사본으로 사라졌다: ' + r.sales + ' (정답 10,000,000)');
  });

  await test("구글 시트 PDF 출력('파일.xlsx - 견적서.pdf')과 '- 복사본'은 엑셀의 사본이다", async () => {
    const r = await seedEst([
      ['20260604 태산그린아파트-넥산 작업.xlsx', '태산그린아파트', 3366000],
      ['20260604 태산그린아파트-넥산 작업.xlsx - 견적서.pdf', '태산그린아파트', 2970000],
      ['태산그린아파트 1월27일.xlsx', '태산그린아파트', 825000],
      ['태산그린아파트 1월27일 - 복사본.xlsx', '태산그린아파트', 825000]], ['태산그린아파트']);   // 같은 형식(엑셀↔엑셀)이라 2차 병합도 이름 글자가 같아야 묶인다
    assert(r.sales === 3366000 + 825000, '출력본·복사본이 매출에 더해졌다: ' + r.sales);
    assert(r.reps.length === 2, '대표는 넥산 엑셀·1월27일 2건이어야 한다: ' + JSON.stringify(r.reps));
  });

  await test('10억 이상으로 읽힌 금액은 집계에서 빠지고, 직접 고친 금액(_edited)은 믿는다', async () => {
    const a = await seedEst([['태산그린아파트 넥산 작업-용진인테리어.pdf', '태산그린아파트', 1026451304]], ['태산그린아파트']);
    assert(a.sales === 0, '10억 오인식이 매출에 들어갔다: ' + a.sales);
    const b = await seedEst([['큰 공사 견적.xlsx', '현장', 1200000000, { est: { amount: 1200000000, supply: 1090909091, vat: 109090909, _edited: true } }]], ['현장']);
    assert(b.sales === 1200000000, '직접 고친 금액이 빠졌다: ' + b.sales);
  });

  await test('견적 탭 합계·배지가 매출 집계와 같은 기준이다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '대전', stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false }];
      state.files = [
        { id: 'b1', name: '★20260324 대전 견적 26,675,000.xlsx', ext: 'xlsx', kind: 'estimate', project: '대전', est: { amount: 26675000, supply: 24250000, vat: 2425000 }, when: new Date() },
        { id: 'b2', name: '20260324 대전.pdf', ext: 'pdf', kind: 'estimate', project: null, est: { amount: 26675000 }, when: new Date() },
        { id: 'b3', name: '20250501 방화문교체 3,333,000.xlsx', ext: 'xlsx', kind: 'estimate', project: '대전', est: { amount: 1630000, supply: 1630000, vat: 163000 }, when: new Date() }];
      state.tab = 'estimates'; render();
      const ov = document.querySelector('.estimate-overview').innerText;
      const badges = [...document.querySelectorAll('.est-badges .est-warn')].map(x => x.textContent);
      return { ov, badges, sales: hjSalesEntries().reduce((n, e) => n + e.amount, 0) };
    });
    assert(r.ov.includes('28,305,000원'), '견적 탭 합계가 매출 집계와 다르다: ' + r.ov);
    assert(r.sales === 28305000, '매출 집계: ' + r.sales);
    assert(r.badges.some(t => t.includes('같은 견적이 대전에')), '미배정 사본 배지가 없다: ' + r.badges.join(' / '));
    assert(r.badges.some(t => t.includes('파일명 금액 3,333,000원')), '파일명 금액 불일치 배지가 없다: ' + r.badges.join(' / '));
  });

  await test('비슷한 이름 배정 제안은 체크 해제로 나오고, 동점이면 제안하지 않는다', async () => {
    const r = await page.evaluate(() => {
      const P = n => ({ name: n, stage: 1, received: 0, phases: [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false });
      state.projects = [P('금성백조아파트'), P('선비마을아파트 1단지'), P('선비마을아파트 3단지')];
      state.files = [
        { id: 'm1', name: '금성백도아파트_용진인테리어.xlsx', ext: 'xlsx', kind: 'estimate', project: null, est: { amount: 0 } },
        { id: 'm2', name: '20260908 송촌 선비 1단지 만물인테리어.xlsx', ext: 'xlsx', kind: 'estimate', project: null, est: { amount: 0 } },
        { id: 'm3', name: '선비 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: null, est: { amount: 0 } }];
      const m = quoteAutoMatch();
      bulkAssignCenter();
      const checked = [...document.querySelectorAll('.baChk')].map(c => c.checked);
      closeModal();
      return { m: m.map(x => [x.name, x.project, !!x.fuzzy]), checked, offer: quoteAutoMatch().filter(x => !x.fuzzy).length };
    });
    const by = Object.fromEntries(r.m.map(x => [x[0], x]));
    assert(by['금성백도아파트_용진인테리어.xlsx'] && by['금성백도아파트_용진인테리어.xlsx'][1] === '금성백조아파트' && by['금성백도아파트_용진인테리어.xlsx'][2], '오타 제안: ' + JSON.stringify(r.m));
    assert(by['20260908 송촌 선비 1단지 만물인테리어.xlsx'] && by['20260908 송촌 선비 1단지 만물인테리어.xlsx'][1] === '선비마을아파트 1단지', '단지 표기 제안: ' + JSON.stringify(r.m));
    assert(!by['선비 견적.xlsx'], '1단지·3단지 동점인데 제안했다: ' + JSON.stringify(r.m));
    assert(r.checked.every(c => c === false), '비슷한 이름 제안이 미리 체크돼 있다: ' + JSON.stringify(r.checked));
    assert(r.offer === 0, '비슷한 이름 제안만으로 스캔 뒤 창을 띄우면 안 된다');
  });

  // 사진 시드 — 바이트는 Blob 으로 준다(_file)
  const seedPhotos = () => page.evaluate(() => {
    state._demo = false;
    const P = (n, ph) => ({ name: n, stage: 1, received: 0, phases: ph || [], cost: {}, customer: { name: '', phone: '', addr: '' }, archived: false });
    state.projects = [P('범지기아파트'), P('케이투커피', ['2차 방수 작업']), P('망월카페', ['3차 도막 방수']), P('한신교회')];
    let n = 0;
    const blob = (size, fill) => new Blob([new Uint8Array(size).fill(fill)], { type: 'image/jpeg' });
    const ph = (name, project, size, fill, extra) => Object.assign({ id: 'p' + (++n), name, handle: null, prefix: '_정리완료/' + project + '/현장사진/', ext: 'jpg', size, kind: 'photo', project,
      when: new Date('2026-07-03T01:49:37Z'), lat: 36.3, lng: 127.4, place: null, address: null, thumb: null, text: '', ocr: 'na', est: null, contact: null,
      _file: fill == null ? null : blob(size, fill), _virtual: fill == null }, extra || {});
    state.files = [ph('K111.jpg', '범지기아파트', 3000, 1), ph('K111 (1).jpg', '범지기아파트', 3000, 1),
      ph('카톡_04.jpg', '망월카페', 4000, 3, { _phase: '3차 도막 방수', text: '[보고서명:HANNAM161]', when: new Date('2026-06-16T07:21:56Z') }),
      ph('HANNAM161_001.jpeg', '케이투커피', 4000, 3, { when: new Date('2026-06-16T07:21:56Z') }),
      ph('G1.jpg', '케이투커피', 5000, 4, { _driveId: 'drv1' }),
      ph('G1.jpg', '케이투커피', 5000, null, { _driveId: 'drv1', prefix: '현장사진/', when: new Date('2026-06-26T10:00:00Z'), lat: null, lng: null })];
    // 정보가 서로 다른 같은 크기 사진 60쌍 — 예전 검사는 여기서 50장 한도에 걸려 진짜 중복까지 못 갔다
    for (let i = 0; i < 60; i++) {
      state.files.unshift(ph('D' + i + 'a.jpg', '한신교회', 9000 + i, 10 + (i % 200), { when: new Date(Date.UTC(2026, 5, 1, i % 24)) }));
      state.files.unshift(ph('D' + i + 'b.jpg', '케이투커피', 9000 + i, 11 + (i % 200), { when: new Date(Date.UTC(2026, 5, 2, i % 24)) }));
    }
    render();
    return state.files.length;
  });

  await test('중복 사진 검사가 정보 다른 묶음에 막히지 않고 진짜 중복을 찾고, 두 번째엔 이어서 간다', async () => {
    await seedPhotos();
    const r = await page.evaluate(async () => {
      const p1 = await verifyDuplicatePhotos();
      const ok = await saveVerifiedDuplicates(p1);
      const p2 = await verifyDuplicatePhotos();
      return { pairs: p1.pairs.map(p => p.file.name + '>' + p.keep.name), ok, s1: p1.stats, s2: p2.stats, left: state.files.filter(f => f.name === 'K111 (1).jpg').length };
    });
    assert(r.pairs.length === 1 && r.pairs[0] === 'K111 (1).jpg>K111.jpg', '진짜 중복을 못 찾았다: ' + JSON.stringify(r));
    assert(r.ok && r.left === 0, '정리 실패: ' + JSON.stringify(r));
    assert(r.s1.remaining === 0, '50장 한도에 남은 후보가 있다고 한다: ' + JSON.stringify(r.s1));
    assert(r.s2.checkedGroups === 0, '두 번째 검사가 확인한 묶음을 다시 읽었다: ' + JSON.stringify(r.s2));
  });

  await test('같은 Drive 사진의 빈 기록만 정리하고 원본 기록·Drive 연결은 남긴다', async () => {
    const r = await page.evaluate(async () => {
      const g = hjDriveGhostRecords();
      const ok = await hjRemoveDriveGhosts(g);
      const left = state.files.filter(f => f._driveId === 'drv1');
      return { n: g.length, ok, left: left.map(f => !!f._file), removed: __removedIds.has('drv1') };
    });
    assert(r.n === 1 && r.ok, '빈 기록을 못 찾거나 못 지웠다: ' + JSON.stringify(r));
    assert(r.left.length === 1 && r.left[0] === true, 'PC 원본 기록이 남아야 한다: ' + JSON.stringify(r));
    assert(!r.removed, 'Drive ID 가 삭제 목록에 올라 원본 연결이 막혔다');
  });

  await test('현장이 다른 같은 사진 — 고른 현장에 남기고 공정·메모를 옮긴다', async () => {
    const r = await page.evaluate(async () => {
      const f = await hjCrossDupFind();
      const n = f.combos.length ? await hjCrossDupMerge(f.combos[0].pairs, '케이투커피') : 0;
      const k = state.files.find(x => x.name === 'HANNAM161_001.jpeg');
      return { combos: f.combos.map(c => c.projects.join('|') + ':' + c.pairs.length), n, k: k && [k.project, k._phase, k.text],
        mw: state.files.filter(x => x.project === '망월카페').length, phases: state.projects.find(p => p.name === '케이투커피').phases };
    });
    assert(r.combos.length === 1 && r.n === 1, '현장 쌍을 못 찾거나 못 정리했다: ' + JSON.stringify(r));
    assert(r.k && r.k[0] === '케이투커피' && r.k[1] === '3차 도막 방수' && r.k[2] === '[보고서명:HANNAM161]', '공정·메모가 옮겨지지 않았다: ' + JSON.stringify(r.k));
    assert(r.mw === 0 && r.phases.includes('3차 도막 방수'), '정리 후 상태: ' + JSON.stringify(r));
  });

  await test('일반 삭제도 다른 기록이 쓰는 Drive ID 는 삭제 목록에 올리지 않는다', async () => {
    const r = await page.evaluate(async () => {
      const a = { id: 'z1', name: 'S.jpg', kind: 'photo', ext: 'jpg', size: 10, project: '한신교회', prefix: '', handle: null, _file: new Blob([new Uint8Array(10)]), _driveId: 'shared1', when: new Date() };
      const b = { id: 'z2', name: 'S.jpg', kind: 'photo', ext: 'jpg', size: 10, project: '한신교회', prefix: '현장사진/', handle: null, _file: null, _virtual: true, _driveId: 'shared1', when: new Date() };
      const c = { id: 'z3', name: 'T.jpg', kind: 'photo', ext: 'jpg', size: 11, project: '한신교회', prefix: '', handle: null, _file: null, _virtual: true, _driveId: 'solo1', when: new Date() };
      state.files.push(a, b, c);
      const ok1 = await deletePhotoRecordsSafely([b]), ok2 = await deletePhotoRecordsSafely([c]);
      return { ok1, ok2, shared: __removedIds.has('shared1'), solo: __removedIds.has('solo1') };
    });
    assert(r.ok1 && r.ok2, '삭제 실패: ' + JSON.stringify(r));
    assert(!r.shared, '남은 기록이 쓰는 Drive ID 가 삭제 목록에 올랐다');
    assert(r.solo, '혼자 쓰던 Drive ID 는 예전처럼 삭제 목록에 올라야 한다');
  });

  await test('세금 기한은 휴일이면 다음 영업일, 예전 자동 일정은 옮기고 id 는 유지한다', async () => {
    const r = await page.evaluate(() => {
      const due = ['2026-10-25', '2027-01-25', '2027-04-25', '2028-01-25'].map(hjTaxDueDate);
      state.schedule = [Object.assign(newSchedule(), { id: 'tax_2026-10-25_vatpre', title: '부가세 예정고지 납부', date: '2026-10-25', time: '09:00', memo: '세금 캘린더 자동 등록', _taxAuto: true }),
        Object.assign(newSchedule(), { id: 'tax_2027-04-25_vatpre', title: '부가세 예정고지 납부', date: '2027-04-25', time: '10:00', memo: '대표가 고친 일정' })];
      state.calendarImports = ['tax:tax_2026-10-25_vatpre', 'tax:tax_2027-04-25_vatpre'];
      taxCalendarEnsure();
      const s1 = state.schedule.filter(s => s.id === 'tax_2026-10-25_vatpre'), s2 = state.schedule.filter(s => s.id === 'tax_2027-04-25_vatpre');
      return { due, s1: s1.map(s => s.date), s2: s2.map(s => s.date) };
    });
    assert(JSON.stringify(r.due) === JSON.stringify(['2026-10-26', '2027-01-25', '2027-04-26', '2028-01-28']), '기한 계산: ' + JSON.stringify(r.due));
    assert(JSON.stringify(r.s1) === '["2026-10-26"]', '자동 일정이 옮겨지지 않았거나 중복됐다: ' + JSON.stringify(r.s1));
    assert(JSON.stringify(r.s2) === '["2027-04-25"]', '대표가 고친 일정(_taxAuto 없음)은 그대로여야 한다: ' + JSON.stringify(r.s2));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== estimate-photo-dup-v342: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

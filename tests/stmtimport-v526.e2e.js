/* v526 📑 작업내역서 반영 — 10/31 대표 요청("내역에 있어 해줘"). 협력사(누수나라·더케이)에 보낸 작업내역서 엑셀(작업 날짜 | 위치 | 작업명 | 작업비용)을
   현장마다 견적 1건(수주)으로. 합성 자료만(실제 고객·주소 아님), 엑셀 라이브러리는 가짜(XLSX.read 가 JSON 격자를 돌려줌), 바깥 쓰기 0.
   ① 읽기: 누수나라 양식(일련번호 날짜·이어지는 줄·합계) + 더케이 병합 셀 양식(0·3·6·9 칸, 개별 시트 + '통합본' → 통합본만, 소계 건너뜀, '서비스' 0원,
      금액 빈 줄은 위 작업명에 붙임, '미기재' 날짜는 빈칸) · 받는 분·작성일 · 파일 이름에서 거래처 (PARSE)
   ② 현장 맞추기: 동·호수 등록 현장 가산, 동점이면 자료 많은 현장, 앞 글자('평화' → 평화로운아파트), 이름 오타(신동아 → 은빛신동),
      '대전' 같은 도시 이름 현장에는 붙지 않음, 없는 아파트는 '＋ 새 현장' 기본 (MATCH)
   ③ 금액: 부가세 포함 270,000 → 공급가 245,455 + 세액 24,545 = 270,000(반올림 1원 보정) · 청구(hjEstBill)도 270,000 · 품목을 고치면 보정 꺼짐 ·
      공급가 모드는 +10% (GROSS)
   ④ 같은 현장·같은 금액 내역서 견적 2건은 사본으로 묶이지 않는다(두 달 치 우수관 220,000 → 매출 440,000) (PAIR)
   ⑤ 반영: 위치 2곳 → 같은 현장이면 견적 1건 · 새 현장 생성 · 체크한 기존 견적(엑셀+PDF 사본)만 집계 제외 · 다시 반영하면 0건(이미 반영됨) · 계좌 비움 (APPLY)
   ⑥ 화면: 견적 작성 탭 [📑 작업내역서 반영] · 확인 창(기본 선택·새 현장·기존 견적 체크) → [반영] → 목록에 📑 내역서 배지 · 줄 없는 파일 안내 (UI)
   ⑦ 소스·핀 3곳 v526 · 오류 0 · 바깥 쓰기 0
   ⑧ 읽기 함정(검토 v526): 머리글 같은 정보 줄·'작업 위치'·'자재비용 | 작업비용'·₩/만원/(VAT포함) 금액·'소 계'·구역 합계 + '총액'·'전체' 통합 시트 (PARSE2)
   ⑨ 반영 함정(검토 v526): 관계없는 같은 금액 견적과 안 묶임 · 체크했다가 '반영 안 함'으로 바꾼 현장은 제외 안 함 · 앱 견적 + PDF 사본 묶음은 둘 다 제외 ·
      이름만 바꾼 사본 '(1).xlsx' 는 0건 · 같은 파일에 줄이 늘면 그 견적에 붙임 · 파일 이름의 '#' (APPLY2)
   HJ_V526_BASELINE=<commit> 은 ① 에서, HJ_V526_MUTATION=no-gross 는 ③ 에서, no-pair 는 ④ 에서 실패해야 한다. */
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
let html = process.env.HJ_V526_BASELINE ? execFileSync('git', ['show', process.env.HJ_V526_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
const MUT = {
  'no-gross': ['  const g=hjStmtGross(q,sub);if(g){vat=g-supply;total=g;}\n', ''],
  'no-pair': ['      if(hasStmt(c)||hasStmt(g))return false;\n', ''],
}[process.env.HJ_V526_MUTATION || ''];
if (MUT) { assert(SRC.includes(MUT[0]), 'mutation anchor'); html = SRC.replace(MUT[0], MUT[1]); }

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type()); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'file' })); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; }, BOOT);
  return { context, page };
}
// 엑셀 일련번호(2026-09-09 = 46274)
const SER = d => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000) + 25569);
// 누수나라 양식(가짜 현장) — 4칸, 날짜는 일련번호, 같은 세대 두 번째 줄은 날짜·위치 빈칸
const GRID_A = () => [
  ['작업 내역서', '', '', ''],
  ['받는 분', '시험누수', '작성일', SER('2026-09-17')],
  ['작성자 / 업체명', '시험/만물인테리어', '연락처', '010-0000-0000'],
  ['아래와 같이 작업 내역을 보내드립니다.', '', '', ''],
  ['', '', '', '단위: 원'],
  ['작업 날짜', '위치', '작업명', '작업비용'],
  [SER('2026-09-09'), '구름말 평화아파트 101동 1309호', '수도관 누수', 1000000],
  [SER('2026-09-11'), '솔동 보람 3동 408호', '우수관 1개', 220000],
  ['', '', '부분 줄눈 보수', 50000],
  [SER('2026-09-12'), '은빛동 신동아아파트 6-502', '온냉수 교체', '1,800,000'],
  [SER('2026-09-13'), '새벽동 모란아파트 303-704', '변기 재시공', 100000],
  [SER('2026-09-14'), '하늘아파트 10-707', '우수관 교체', 220000],
  ['', '하늘아파트 15-707', '우수관 교체', 220000],
  ['합 계', '', '', 3610000],
  ['비고', '', '', ''],
];
// 더케이 병합 셀 양식 — 값이 0·3·6·9 칸, 개별 시트 + 통합본
const ROW12 = (a, b, c, d) => [a, '', '', b, '', '', c, '', '', d, '', ''];
const GRID_B1 = () => [ROW12('작업 내역서', '', '', ''), ROW12('받는 분', '미기재', '작성일', SER('2026-09-29')), ROW12('작업 날짜', '위치', '작업명', '작업비용'),
  ROW12('미기재', '가람 센트럴\n602동 1005호', '화장실 방수 2개\n(1차)', 900000), ROW12('', '', '화장실 방수 2개\n(2차)', ''), ROW12('', '', '엑셀 2개', 100000), ROW12('', '', '샤워기', '서비스'), ROW12('합 계', '', '', 1000000)];
const GRID_B4 = () => [ROW12('작업 내역서', '', '', ''), ROW12('받는 분', '현장별 내역 참조', '작성일', SER('2026-09-29')), ROW12('작업 날짜', '위치', '작업명', '작업비용'),
  ROW12('미기재', '가람 센트럴\n602동 1005호', '화장실 방수 2개\n(1차)', 900000), ROW12('', '', '화장실 방수 2개\n(2차)', ''), ROW12('', '', '엑셀 2개', 100000), ROW12('', '', '샤워기', '서비스'),
  ROW12('가람 센트럴 소계', '', '', 1000000), ROW12('9월 7일', '공주 한빛아파트\n102동 109호', '베란다 방수\n(1차)', 500000), ROW12('9월 8일', '', '베란다 도막 방수', ''),
  ROW12('공주 한빛 소계', '', '', 500000), ROW12('합 계', '', '', 1500000)];

// 공사내역서 양식 — 위치 칸 없이 머리글 위 '현장명'·'공사일자', 단가·금액 칸
const GRID_C = () => [['공 사 내 역 서'], ['수 신', '', '귀하', '', '', '공급자: 시험'], ['현 장 명', '', '시험동 시험아파트 108동 2003호'], ['공사일자', '', '2026.10.02 ~ 2026.10.07'], ['작성일자', '', '2026.10.21'],
  ['순번', '공정', '항목', '규격/비고', '단위', '수량', '단가', '금액'], [1, '방수', '화장실 도막 작업', '10/2 시공', '식', 1, 100000, 100000], [2, '설비', '환기구 코어 작업', '10/7 시공', '개소', 1, 200000, 200000],
  ['합 계 (금액 합계)', '', '', '', '', '', '', 300000]];
// 세금계산서 품목표 양식 — 월 | 일 | 품목('아파트 동·호' 포함) | … | 공급가액 | 세액
const GRID_D = () => [['작성일자', '2026-09-01', '비고', ''], ['합계금액', 880000, '공급가액', 800000, '세액', 80000], ['월', '일', '품목', '규격', '수량', '단가', '공급가액', '세액', '비고'],
  ['09', '01', '시험마을 812동 1203호', '건', 1, 500000, 500000, 50000, ''], ['09', '01', '이음동 별빛아파트 3동 506호 생활관', '건', 1, 300000, 300000, 30000, '']];

// 읽기 함정 — 머리글처럼 보이는 정보 줄, '작업 위치', '자재비용 | 작업비용', ₩·만원·(VAT포함), '소 계', 구역 합계 뒤 다음 구역, 마지막 '총액'
const GRID_E = () => [['현장명', '시험', '작성일자', '2026-10-30', '합계금액', 999], ['받는 분', '시험누수'],
  ['작업 날짜', '작업 위치', '작업명', '자재비용', '작업비용'],
  [SER('2026-10-01'), '가온아파트 101동 101호', '우수관', 10000, '₩300,000'], ['', '', '육가', '', '30만원'], ['소 계', '', '', '', 600000],
  [SER('2026-10-02'), '나래아파트 2-202', '변기', '', '300,000원(VAT포함)'], ['합 계', '', '', '', 300000],
  [SER('2026-10-03'), '다솜아파트 3-303', '수전', '', 220000], ['', '', '', '', 1120000], ['총액', '', '', '', 1120000]];
// 통합 시트 이름이 '전체' — 개별 시트(A동·B동)와 같은 줄은 한 번만
const HDR = ['작업 날짜', '위치', '작업명', '작업비용'];
const GRID_FA = () => [HDR, [SER('2026-10-05'), '가온아파트 1-101', '우수관', 220000], [SER('2026-10-05'), '가온아파트 1-102', '우수관', 220000]];
const GRID_FB = () => [HDR, [SER('2026-10-06'), '나래아파트 2-201', '변기', 80000]];
const GRID_FT = () => [HDR, [SER('2026-10-05'), '가온아파트 1-101', '우수관', 220000], [SER('2026-10-05'), '가온아파트 1-102', '우수관', 220000], [SER('2026-10-06'), '나래아파트 2-201', '변기', 80000], ['합계', '', '', 520000]];

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  async function test(name, fn) { await fn(); passed++; console.log('PASS stmtimport-v526 ' + name); }
  const { context, page } = await openPage();
  // 합성 현장 — 동·호수 등록(aptUnits) · 사진 수(동점 가르기)
  const SEED = () => page.evaluate(() => {
    const P = (name, units) => ({ name, stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null, ...(units ? { aptUnits: units.map((u, i) => ({ id: 'u' + name.length + '_' + i, type: 'unit', dong: u[0], ho: u[1], name: '', note: '' })) } : {}) });
    state.projects = [P('보람아파트', [['2', '204'], ['3', '408']]), P('솔동보람아파트', [['3', '408']]), P('평화로운아파트'), P('은빛신동아파트', [['6', '502']]), P('하늘타운아파트', [['10', '707']]),
      P('푸른마을아파트 1단지', [['101', '904']]), P('푸른마을아파트 3단지', [['315', '1404']]), P('대전'), P('가람센트럴'), P('공주 소담한빛아파트')];
    state.files = []; state.quotes = []; state.expenses = []; state.payLog = [];
    // 사진: 보람 3장, 나머지 실제 현장 1장씩 — '솔동보람아파트'·'대전'은 빈 현장(10/31 실자료의 빈 중복 현장과 같은 모양)
    const ph = (id, project) => state.files.push({ id, name: id + '.jpg', ext: 'jpg', kind: 'photo', project, when: new Date('2026-09-11T01:00:00Z'), _virtual: true });
    for (let i = 0; i < 3; i++) ph('PH' + i, '보람아파트');
    ['평화로운아파트', '은빛신동아파트', '하늘타운아파트', '푸른마을아파트 1단지', '푸른마을아파트 3단지', '가람센트럴', '공주 소담한빛아파트'].forEach((n, i) => ph('PQ' + i, n));
  });

  await test('① 읽기 — 누수나라 양식 · 더케이 병합 셀 + 통합본 (PARSE)', async () => {
    await SEED();
    const r = await page.evaluate(({ a, b1, b4, c, d }) => {
      const A = hjStmtParse([{ name: '작업 내역서', grid: a }], '작업내역서20260917_시험누수.xlsx');
      const B = hjStmtParse([{ name: '01_가람센트럴', grid: b1 }, { name: '04_통합본', grid: b4 }], '작업내역서_개별2건_통합본.xlsx');
      const N = hjStmtParse([{ name: 'S', grid: [['아무 표'], ['이름', '값'], ['a', 1]] }], 'x.xlsx');
      const C = hjStmtParse([{ name: '공사내역서', grid: c }], '20261021_공사내역서.xlsx');
      const D = hjStmtParse([{ name: '세금계산서', grid: d }], '세금계산서.xlsx');
      return { A: { to: A.to, date: A.date, stated: A.stated, sum: A.sum, warn: A.warn, lines: A.lines.map(l => [l.d, l.loc, l.work, l.amt]) },
        B: { to: B.to, date: B.date, stated: B.stated, sum: B.sum, sheets: B.sheets, vat: B.vatHint, lines: B.lines.map(l => [l.d, l.loc, l.work, l.amt]) }, N: N.lines.length,
        C: { to: C.to, date: C.date, stated: C.stated, vat: C.vatHint, lines: C.lines.map(l => [l.d, l.loc, l.work, l.amt]) }, D: { date: D.date, vat: D.vatHint, warn: D.warn.length, lines: D.lines.map(l => [l.d, l.loc, l.work, l.amt]) } };
    }, { a: GRID_A(), b1: GRID_B1(), b4: GRID_B4(), c: GRID_C(), d: GRID_D() });
    assert.deepEqual(r.A.lines, [
      ['2026-09-09', '구름말 평화아파트 101동 1309호', '수도관 누수', 1000000],
      ['2026-09-11', '솔동 보람 3동 408호', '우수관 1개', 220000],
      ['2026-09-11', '솔동 보람 3동 408호', '부분 줄눈 보수', 50000],
      ['2026-09-12', '은빛동 신동아아파트 6-502', '온냉수 교체', 1800000],
      ['2026-09-13', '새벽동 모란아파트 303-704', '변기 재시공', 100000],
      ['2026-09-14', '하늘아파트 10-707', '우수관 교체', 220000],
      ['2026-09-14', '하늘아파트 15-707', '우수관 교체', 220000]], 'PARSE A lines ' + JSON.stringify(r.A));
    assert(r.A.to === '시험누수' && r.A.date === '2026-09-17' && r.A.stated === 3610000 && r.A.sum === 3610000 && r.A.warn.length === 0, 'PARSE A head ' + JSON.stringify(r.A));
    assert.deepEqual(r.B.sheets, ['04_통합본'], 'PARSE B uses only the combined sheet');
    assert.deepEqual(r.B.lines, [
      ['', '가람 센트럴 602동 1005호', '화장실 방수 2개 (1차) · 화장실 방수 2개 (2차)', 900000],
      ['', '가람 센트럴 602동 1005호', '엑셀 2개', 100000],
      ['', '가람 센트럴 602동 1005호', '샤워기(서비스)', 0],
      ['2026-09-07', '공주 한빛아파트 102동 109호', '베란다 방수 (1차) · 베란다 도막 방수', 500000]], 'PARSE B lines ' + JSON.stringify(r.B));
    assert(r.B.to === '' && r.B.date === '2026-09-29' && r.B.stated === 1500000 && r.B.sum === 1500000, 'PARSE B head ' + JSON.stringify(r.B));
    assert.equal(r.N, 0, 'PARSE no header → no lines');
    assert.equal(r.B.vat, 'included');
    assert.deepEqual(r.C.lines, [['2026-10-02', '시험동 시험아파트 108동 2003호', '화장실 도막 작업', 100000], ['2026-10-02', '시험동 시험아파트 108동 2003호', '환기구 코어 작업', 200000]], 'PARSE 공사내역서 ' + JSON.stringify(r.C));
    assert(r.C.to === '' && r.C.date === '2026-10-21' && r.C.stated === 300000 && r.C.vat === 'included', 'PARSE 공사내역서 head ' + JSON.stringify(r.C));
    assert.deepEqual(r.D.lines, [['2026-09-01', '시험마을 812동 1203호', '시험마을 812동 1203호', 500000], ['2026-09-01', '이음동 별빛아파트 3동 506호 생활관', '이음동 별빛아파트 3동 506호 생활관', 300000]], 'PARSE 세금계산서 ' + JSON.stringify(r.D));
    assert(r.D.date === '2026-09-01' && r.D.vat === 'separate' && r.D.warn === 1, 'PARSE 세금계산서 → 공급가 모드 ' + JSON.stringify(r.D));
  });

  await test('② 현장 맞추기 — 동·호수·동점·앞 글자·오타·도시 이름·새 현장 (MATCH)', async () => {
    const r = await page.evaluate(() => {
      const top = loc => { const c = hjStmtMatch(loc); return c.length ? [c[0].name, Math.round(c[0].score * 100) / 100, c[0].why] : null; };
      const g = hjStmtGroups({ lines: [{ d: '', loc: '새벽동 모란아파트 303-704', work: 'x', amt: 1 }, { d: '', loc: '솔동 보람 3동 408호', work: 'y', amt: 1 }, { d: '', loc: '푸른마을 305동 1404호', work: 'z', amt: 1 }] });
      return {
        boram: top('솔동 보람 3동 408호'), peace: top('구름말 평화아파트 101동 1309호'), eunbit: top('은빛동 신동아아파트 6-502'), haneul: top('하늘아파트 10-707'),
        pureun1: top('푸른마을아파트 101호 904호'), city: hjStmtMatch('대전 솔동 보람아파트 2동 204호').some(c => c.name === '대전'), moran: top('새벽동 모란아파트 303-704'),
        groups: g.map(x => [x.loc, x.choice, x.suggest]), newName: hjStmtNewName('온새동 노을마을 105동 1106호 (화장실)'), unit: [hjStmtUnit('푸른마을아파트 101호 904호'), hjStmtUnit('은빛동 신동아아파트 6-502'), hjStmtUnit('가람 센트럴 602동 1005호')],
      };
    });
    assert(r.boram[0] === '보람아파트' && /3동 408호/.test(r.boram[2]), 'MATCH empty duplicate project loses to the active one ' + JSON.stringify(r.boram));
    assert(r.peace && r.peace[0] === '평화로운아파트' && r.peace[1] >= 0.5, 'MATCH prefix ' + JSON.stringify(r.peace));
    assert(r.eunbit[0] === '은빛신동아파트' && /6동 502호/.test(r.eunbit[2]), 'MATCH typo + unit ' + JSON.stringify(r.eunbit));
    assert(r.haneul[0] === '하늘타운아파트', 'MATCH contained name ' + JSON.stringify(r.haneul));
    assert(r.pureun1[0] === '푸른마을아파트 1단지', 'MATCH unit decides between 1단지/3단지 ' + JSON.stringify(r.pureun1));
    assert.equal(r.city, false, 'MATCH city-named project is never a candidate');
    assert.equal(r.moran, null, 'MATCH unknown apartment has no candidate');
    assert.deepEqual(r.groups[0], ['새벽동 모란아파트 303-704', '__new__:모란아파트', '모란아파트'], 'MATCH new project default ' + JSON.stringify(r.groups));
    assert.equal(r.groups[1][1], '보람아파트');
    assert.equal(r.newName, '노을마을');
    assert.deepEqual(r.unit, [{ dong: '101', ho: '904' }, { dong: '6', ho: '502' }, { dong: '602', ho: '1005' }]);
  });

  await test('③ 금액 — 부가세 포함 270,000 은 270,000 그대로(1원 보정) · 청구도 같음 · 품목 고치면 보정 꺼짐 · 공급가 모드 +10% (GROSS)', async () => {
    const r = await page.evaluate(() => {
      const mk = (vat, lines, project) => hjStmtBuildQuote({ src: 'a.xlsx', doc: '작업내역서', to: '시험누수', date: '2026-10-13', vat, project, lines });
      const q1 = mk('included', [{ d: '2026-10-05', loc: '솔동 보람 3동 408호', work: '우수관 교체', amt: 220000 }, { d: '2026-10-05', loc: '솔동 보람 3동 408호', work: '부분 줄눈 보수', amt: 50000 }], '보람아파트');
      const c1 = quoteCalc(q1), items = q1.items.map(i => i.price);
      state.quotes = [q1]; state.files = state.files.filter(f => !f._fromQuote); syncQuoteToProject(q1);
      const st = projStats('보람아파트'), bill = hjEstBill('보람아파트', estimateGroups(state.files.filter(f => f.project === '보람아파트' && f.kind === 'estimate')));
      const edited = JSON.parse(JSON.stringify(q1)); edited.items[0].price += 1000; const c2 = quoteCalc(edited);
      const q3 = mk('separate', [{ d: '', loc: 'x', work: '우수관', amt: 220000 }, { d: '', loc: 'x', work: '육가', amt: 50000 }], '보람아파트');
      const c3 = quoteCalc(q3);
      const plain = quoteCalc({ vatIncluded: true, items: [{ qty: 1, price: 245455 }] });
      return { c1, items, est: st.est, billEst: st.bill, billTotal: bill.total, billVat: bill.vat, c2, c3, plain, acct: q1.accountIdx, result: q1.result, key: q1.stmt.key, no: q1.no };
    });
    assert.deepEqual(r.c1, { sub: 245455, supply: 245455, vat: 24545, total: 270000 }, 'GROSS quoteCalc ' + JSON.stringify(r.c1));
    assert.equal(r.items.reduce((a, b) => a + b, 0), 245455, 'GROSS item prices sum to supply');
    assert(r.est === 270000 && r.billEst === 270000 && r.billTotal === 270000 && r.billVat === 24545, 'GROSS sales and bill ' + JSON.stringify(r));
    assert.equal(r.c2.total, 246455 + Math.round(246455 * 0.1), 'GROSS off after edits');
    assert.deepEqual(r.c3, { sub: 270000, supply: 270000, vat: 27000, total: 297000 }, 'GROSS separate ' + JSON.stringify(r.c3));
    assert.equal(r.plain.total, 270001, 'ordinary quotes unchanged');
    assert(r.acct === null && r.result === 'won' && r.key === 'a.xlsx#보람아파트' && r.no === '제20261013', 'quote fields ' + JSON.stringify(r));
  });

  await test('④ 같은 현장·같은 금액 내역서 견적 2건은 사본이 아니다 (PAIR)', async () => {
    const r = await page.evaluate(() => {
      const mk = (src, date) => hjStmtBuildQuote({ src, doc: '작업내역서', to: '시험누수', date, vat: 'included', project: '보람아파트', lines: [{ d: date, loc: '솔동 보람 2동 204호', work: '우수관 1개', amt: 220000 }] });
      state.files = state.files.filter(f => !f._fromQuote); state.quotes = [];
      const a = mk('9월.xlsx', '2026-09-17'); state.quotes.push(a); syncQuoteToProject(a);
      const b = mk('10월.xlsx', '2026-10-13'); state.quotes.push(b); syncQuoteToProject(b);
      const sales = hjSalesEntries().filter(e => e.project === '보람아파트').reduce((s, e) => s + e.amount, 0);
      return { sales, est: projStats('보람아파트').est, stmtFlag: state.files.filter(f => f._stmt).map(f => f._stmt) };
    });
    assert(r.sales === 440000 && r.est === 440000, 'PAIR both counted ' + JSON.stringify(r));
    assert.deepEqual(r.stmtFlag, ['9월.xlsx#보람아파트', '10월.xlsx#보람아파트']);
  });

  await test('⑤ 반영 — 같은 현장 묶기 · 새 현장 · 체크한 기존 견적만 제외 · 다시 반영 0건 (APPLY)', async () => {
    await SEED();
    const r = await page.evaluate((a) => {
      // 하늘타운에 매출로 잡힌 견적(엑셀 + PDF 사본) · 보람에도 하나
      state.files.push({ id: 'E1', name: '20260901 하늘타운 견적 500,000.xlsx', ext: 'xlsx', kind: 'estimate', project: '하늘타운아파트', est: { amount: 500000 }, when: new Date('2026-09-01T01:00:00Z'), _virtual: true });
      state.files.push({ id: 'E1P', name: '20260901 하늘타운 견적 500,000.pdf', ext: 'pdf', kind: 'estimate', project: '하늘타운아파트', est: { amount: 500000 }, when: new Date('2026-09-01T01:00:00Z'), _virtual: true });
      state.files.push({ id: 'E2', name: '20260902 보람 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '보람아파트', est: { amount: 300000 }, when: new Date('2026-09-02T01:00:00Z'), _virtual: true });
      const p = hjStmtParse([{ name: '작업 내역서', grid: a }], '작업내역서20260917_시험누수.xlsx');
      const groups = hjStmtGroups(p).map(g => ({ loc: g.loc, lines: g.lines, choice: g.choice }));
      const existing = hjStmtExistingEst('하늘타운아파트').map(e => [e.id, e.amount, e.members.length]);
      const plan = { src: p.file, file: p.file, doc: '작업내역서', to: p.to, date: p.date, vat: 'included', groups, exclude: ['E1'] };
      const r1 = hjStmtApply(plan);
      const after1 = { quotes: state.quotes.length, sales: hjSalesEntries().reduce((s, e) => s + e.amount, 0), ex: state.files.filter(f => f.exSum).map(f => f.id).sort(), projects: state.projects.map(x => x.name).filter(n => n === '모란아파트'), dirty: state.dirty };
      const r2 = hjStmtApply(plan);
      const sj = state.quotes.find(q => q.project === '하늘타운아파트');
      return { choices: groups.map(g => [g.loc, g.choice]), existing, r1: { n: r1.quotes.length, total: r1.total, newP: r1.newProjects, excluded: r1.excluded, skipped: r1.skipped }, after1,
        r2: { n: r2.quotes.length, skipped: r2.skipped.map(x => x.why), dup: r2.dupLines, appended: r2.appended.length }, quotesAfter2: state.quotes.length,
        sj: { items: sj.items.length, place: sj.place, total: quoteCalc(sj).total, acct: sj.accountIdx, lines: sj.stmt.lines.length }, boramSales: projStats('보람아파트').est };
    }, GRID_A());
    assert.deepEqual(r.choices, [['구름말 평화아파트 101동 1309호', '평화로운아파트'], ['솔동 보람 3동 408호', '보람아파트'], ['은빛동 신동아아파트 6-502', '은빛신동아파트'], ['새벽동 모란아파트 303-704', '__new__:모란아파트'], ['하늘아파트 10-707', '하늘타운아파트'], ['하늘아파트 15-707', '하늘타운아파트']], 'APPLY default choices ' + JSON.stringify(r.choices));
    assert.deepEqual(r.existing, [['E1', 500000, 2]], 'APPLY existing estimate group (xlsx + pdf copy) ' + JSON.stringify(r.existing));
    assert(r.r1.n === 5 && r.r1.total === 3610000 && r.r1.excluded === 1 && r.r1.skipped.length === 0, 'APPLY first run ' + JSON.stringify(r.r1));
    assert.deepEqual(r.r1.newP, ['모란아파트']);
    assert.deepEqual(r.after1.ex, ['E1', 'E1P'], 'APPLY only checked estimate (and its copy) excluded ' + JSON.stringify(r.after1));
    assert(r.after1.sales === 3610000 + 300000 && r.after1.dirty === true, 'APPLY sales = statement + untouched 보람 견적 ' + JSON.stringify(r.after1));
    assert(r.r2.n === 0 && r.r2.appended === 0 && r.r2.dup === 7 && r.quotesAfter2 === 5 && r.r2.skipped.every(w => w === '이미 반영된 줄'), 'APPLY re-run adds nothing ' + JSON.stringify(r.r2));
    assert(r.sj.items === 2 && r.sj.place === '하늘아파트 10-707 / 하늘아파트 15-707' && r.sj.total === 440000 && r.sj.acct === null && r.sj.lines === 2, 'APPLY two locations → one quote ' + JSON.stringify(r.sj));
    assert.equal(r.boramSales, 270000 + 300000, 'APPLY 보람 270,000 exact + 기존 견적 유지');
  });

  await test('⑥ 화면 — [📑 작업내역서 반영] · 확인 창 → [반영] → 📑 내역서 배지 · 줄 없는 파일 안내 (UI)', async () => {
    await SEED();
    await page.evaluate(() => { state.tab = 'quotemaker'; state.editingQuote = null; render(); });
    await page.waitForSelector('#qmStmt');
    // 가짜 엑셀 라이브러리로 파일 읽기 경로까지
    const parsed = await page.evaluate(async (a) => {
      window.XLSX = { read: u8 => ({ SheetNames: ['작업 내역서'], Sheets: { '작업 내역서': JSON.parse(new TextDecoder().decode(u8)) } }), utils: { sheet_to_json: ws => ws } };
      const file = new File([JSON.stringify(a)], '작업내역서20260917_시험누수.xlsx');
      const r = await hjStmtReadFile(file); hjStmtReview(r); return { n: r.lines.length, to: r.to };
    }, GRID_A());
    assert.deepEqual(parsed, { n: 7, to: '시험누수' });
    await page.waitForSelector('.stmt-review');
    const ui = await page.evaluate(() => ({ sels: [...document.querySelectorAll('[data-stmt-proj]')].map(s => s.value), to: document.querySelector('#stmtTo').value, date: document.querySelector('#stmtDate').value,
      summary: document.querySelector('#stmtSummary').textContent, newOpt: !!document.querySelector('[data-stmt-proj] option[value="__new__:모란아파트"]') }));
    assert.deepEqual(ui.sels, ['평화로운아파트', '보람아파트', '은빛신동아파트', '__new__:모란아파트', '하늘타운아파트', '하늘타운아파트'], 'UI defaults ' + JSON.stringify(ui));
    assert(ui.to === '시험누수' && ui.date === '2026-09-17' && ui.newOpt && /현장 5곳/.test(ui.summary), 'UI head ' + JSON.stringify(ui));
    // 평화 줄은 반영 안 함으로 바꾸고, 공급가 모드
    await page.selectOption('[data-stmt-proj="0"]', '');
    await page.check('input[name="stmtVat"][value="separate"]');
    await page.click('.mfoot button.blue');
    await page.waitForFunction(() => !document.querySelector('.stmt-review'));
    const done = await page.evaluate(() => ({ n: state.quotes.length, peace: state.quotes.some(q => q.project === '평화로운아파트'), boram: quoteCalc(state.quotes.find(q => q.project === '보람아파트')).total,
      badges: document.querySelectorAll('[data-qstmt]').length, toast: document.getElementById('toast').textContent }));
    assert(done.n === 4 && !done.peace && done.boram === 297000, 'UI applied (separate VAT, one group skipped) ' + JSON.stringify(done));
    assert(done.badges === 4 && /작업내역서 반영: 새 견적 4건/.test(done.toast), 'UI badges + toast ' + JSON.stringify(done));
    await page.evaluate(() => hjStmtReview(hjStmtParse([{ name: 'S', grid: [['표'], ['a', 'b']] }], 'empty.xlsx')));
    await page.waitForFunction(() => /작업 줄을 찾지 못했습니다/.test(document.querySelector('#modalRoot').textContent));
    await page.evaluate(() => closeModal());
  });

  await test('⑧ 읽기 함정 — 정보 줄·작업 위치·자재비용|작업비용·₩/만원/(VAT포함)·소 계·구역 합계·총액·전체 시트 (PARSE2)', async () => {
    const r = await page.evaluate(({ e, fa, fb, ft, HDR, s7 }) => {
      const SER = () => s7;
      const E = hjStmtParse([{ name: 'S', grid: e }], '작업내역서20261030_시험누수.xlsx');
      const F = hjStmtParse([{ name: 'A동', grid: fa }, { name: '전체', grid: ft }, { name: 'B동', grid: fb }], 'x.xlsx');
      const amts = ['₩300,000', '30만원', '300,000원(VAT포함)', '1.5만', '서비스', '-', '2동', '1.300.000'].map(hjStmtAmt);
      const B = hjStmtParse([{ name: 'S', grid: [HDR, [SER('2026-10-07'), '가온아파트 1-101', '우수관', 220000], ['', '', '줄눈 보수', '약 5만']] }], 'b.xlsx');
      return { E: { to: E.to, date: E.date, stated: E.stated, sum: E.sum, warn: E.warn, lines: E.lines.map(l => [l.d, l.loc, l.work, l.amt]) },
        F: { sheets: F.sheets, skipped: F.skippedSheets, n: F.lines.length, sum: F.sum, stated: F.stated, warn: F.warn.length }, amts, bad: B.warn.filter(w => /금액으로 읽지 못한 칸 1개\(‘약 5만’\)/.test(w)).length };
    }, { e: GRID_E(), fa: GRID_FA(), fb: GRID_FB(), ft: GRID_FT(), HDR, s7: SER('2026-10-07') });
    assert.deepEqual(r.E.lines, [['2026-10-01', '가온아파트 101동 101호', '우수관', 300000], ['2026-10-01', '가온아파트 101동 101호', '육가', 300000],
      ['2026-10-02', '나래아파트 2-202', '변기', 300000], ['2026-10-03', '다솜아파트 3-303', '수전', 220000]], 'PARSE2 lines ' + JSON.stringify(r.E));
    assert(r.E.to === '시험누수' && r.E.date === '2026-10-30' && r.E.sum === 1120000 && r.E.stated === 1120000 && r.E.warn.length === 0, 'PARSE2 head/total ' + JSON.stringify(r.E));
    assert.deepEqual(r.F.sheets, ['전체']); assert.deepEqual(r.F.skipped, ['A동', 'B동']);
    assert(r.F.n === 3 && r.F.sum === 520000 && r.F.stated === 520000, 'PARSE2 combined sheet counted once ' + JSON.stringify(r.F));
    assert.deepEqual(r.amts, [300000, 300000, 300000, 15000, 0, null, null, 1300000], 'PARSE2 amounts ' + JSON.stringify(r.amts));
    assert.equal(r.bad, 1, 'PARSE2 unreadable amount is reported, not silently folded');
  });

  await test('⑨ 반영 함정 — 같은 금액 다른 견적·체크 후 해제한 현장·앱 견적+PDF 묶음·(1) 사본·줄 추가·# 파일 이름 (APPLY2)', async () => {
    await SEED();
    const r = await page.evaluate((a) => {
      // 하늘타운: 앱 견적 550,000 + 그 PDF 사본 550,000 · 보람: 관계없는 같은 금액 견적 270,000
      const q0 = { id: 'Q0', title: '하늘타운 욕실', no: '제20260901', date: '2026-09-01', place: '', vatIncluded: true, accountIdx: null, memo: '', project: '하늘타운아파트', items: [{ name: '욕실', spec: '', qty: 1, price: 500000 }], result: 'won' };
      state.quotes.push(q0); syncQuoteToProject(q0);
      state.files.push({ id: 'Q0P', name: '하늘타운 욕실 견적서.pdf', ext: 'pdf', kind: 'estimate', project: '하늘타운아파트', est: { amount: 550000 }, when: new Date('2026-09-01T02:00:00Z'), _virtual: true });
      state.files.push({ id: 'S1', name: '20260801 보람 욕실 견적.xlsx', ext: 'xlsx', kind: 'estimate', project: '보람아파트', est: { amount: 270000 }, when: new Date('2026-08-01T01:00:00Z'), _virtual: true });
      const p = hjStmtParse([{ name: '작업 내역서', grid: a }], '작업내역서20260917_시험누수.xlsx');
      const groups = hjStmtGroups(p).map(g => ({ loc: g.loc, lines: g.lines, choice: g.loc === '솔동 보람 3동 408호' ? '' : g.choice }));
      const sjGroup = hjStmtExistingEst('하늘타운아파트');
      const base = { src: p.file, file: p.file, doc: '작업내역서', to: p.to, date: p.date, vat: 'included' };
      // ① 보람는 '반영 안 함'인데 S1 체크가 남아 있음 · 하늘타운 앱 견적 묶음 체크
      const r1 = hjStmtApply({ ...base, groups, exclude: ['S1', sjGroup[0].id] });
      const after1 = { s1: !!state.files.find(f => f.id === 'S1').exSum, q0: !!q0.exSum, q0p: state.files.find(f => f.id === 'Q0P').exSum, sj: projStats('하늘타운아파트').est, boram: projStats('보람아파트').est, n: r1.quotes.length, ex: r1.excluded };
      // ② 이름만 바꾼 사본 '(1).xlsx' — 보람를 이번엔 고름: 보람 줄만 새로, 나머지는 이미 반영된 줄
      const groups2 = hjStmtGroups(p).map(g => ({ loc: g.loc, lines: g.lines, choice: g.choice }));
      const r2 = hjStmtApply({ ...base, src: '작업내역서20260917_시험누수 (1).xlsx', file: '작업내역서20260917_시험누수 (1).xlsx', groups: groups2, exclude: [] });
      const after2 = { n: r2.quotes.length, dup: r2.dupLines, boram: projStats('보람아파트').est, boramSales: hjSalesEntries().filter(e => e.project === '보람아파트').length };
      // ③ 같은 파일 이름에 줄이 하나 늘었다(하늘타운 15-707 육가 100,000) — 그 견적에 붙인다
      const extra = { d: '2026-09-14', loc: '하늘아파트 15-707', work: '육가 교체', amt: 100000, sheet: 'S' };
      const r3 = hjStmtApply({ ...base, groups: [{ loc: extra.loc, lines: [extra], choice: '하늘타운아파트' }], exclude: [] });
      const sq = state.quotes.find(q => q.stmt && q.project === '하늘타운아파트' && hjStmtSrcOf(q) === p.file);
      const after3 = { n: r3.quotes.length, appended: r3.appended.length, total: r3.total, items: sq.items.length, lines: sq.stmt.lines.length, qt: quoteCalc(sq).total, place: sq.place };
      // ④ 파일 이름에 '#'
      const one = { d: '2026-10-20', loc: '구름말 평화아파트 101동 1309호', work: '배관 보수', amt: 150000, sheet: 'S' };
      const r4 = hjStmtApply({ ...base, src: 'A#B 내역.xlsx', file: 'A#B 내역.xlsx', groups: [{ loc: one.loc, lines: [one], choice: '평화로운아파트' }], exclude: [] });
      const r5 = hjStmtApply({ ...base, src: 'A#B 내역.xlsx', file: 'A#B 내역.xlsx', groups: [{ loc: one.loc, lines: [one], choice: '평화로운아파트' }], exclude: [] });
      const hq = state.quotes.find(q => q.stmt && hjStmtSrcOf(q) === 'A#B 내역.xlsx');
      return { after1, after2, after3, r4: r4.quotes.length, r5: { n: r5.quotes.length, dup: r5.dupLines }, hsrc: hq && hq.stmt.src, hkey: hq && hq.stmt.key };
    }, GRID_A());
    assert(r.after1.s1 === false && r.after1.boram === 270000, 'APPLY2 deselected project keeps its estimate ' + JSON.stringify(r.after1));
    assert(r.after1.q0 === true && r.after1.q0p === true && r.after1.ex === 1 && r.after1.sj === 440000, 'APPLY2 app quote + pdf copy both excluded ' + JSON.stringify(r.after1));
    assert(r.after2.n === 1 && r.after2.dup === 5 && r.after2.boram === 540000 && r.after2.boramSales === 2, 'APPLY2 renamed copy adds only new lines; 보람 not merged with same-amount estimate ' + JSON.stringify(r.after2));
    assert(r.after3.n === 0 && r.after3.appended === 1 && r.after3.total === 100000 && r.after3.items === 3 && r.after3.lines === 3 && r.after3.qt === 540000, 'APPLY2 revised file appends ' + JSON.stringify(r.after3));
    assert(r.r4 === 1 && r.r5.n === 0 && r.r5.dup === 1 && r.hsrc === 'A#B 내역.xlsx' && r.hkey === 'A#B 내역.xlsx#평화로운아파트', 'APPLY2 # in file name ' + JSON.stringify(r));
  });

  await test('⑦ 소스·핀 3곳(v526 이상·서로 같음) · 오류 0 · 바깥 쓰기 0', async () => {
    assert.match(SRC, /if\(t\.id==='qmStmt'\)return hjStmtImportPick\(\);/);
    // 핀은 판마다 바뀐다 — v526 이상이고 세 곳이 같은지만 본다(다음 판에서 떨어지지 않게)
    const ver = x => { const m = String(x || '').match(/hyeonjang-v(\d+)-/); return m ? +m[1] : 0; };
    const pin = [(SRC.match(/const APP_BUILD='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='([^']+)'/) || [])[1], (fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '([^']+)'/) || [])[1]];
    const pins = [ver(pin[0]) >= 526, pin[0] === pin[1], pin[0] === pin[2]];
    assert.deepEqual(pins, [true, true, true], 'pins ' + JSON.stringify(pin));
    await context.close();
    assert.deepEqual(errors, []); assert.equal(network.writes, 0);
  });

  console.log(`stmtimport-v526: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
})().catch(async error => { console.error('FAIL stmtimport-v526', error.stack || error); process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

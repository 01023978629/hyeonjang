/* material-calc.e2e.js — 🧮 자재 계산기 (Playwright)

   2026-09-11 대표 요청: 다른 현장 앱의 '계산기'처럼 자재별 소요량을 폰에서 바로 뽑는다.
   같은 날 2차 "선택지가 필요하면 설정 가능하게, 더 쓰기 좋게": 기본값 저장·면적 3가지 입력·칩·작업기록·현장 메모·견적 담기·예상 자재비.
     ① 더보기 그룹·옛 시트·핸들러에 calc 가 있다(정적)
     ② 순수 계산 hjCalcRun — 헤베·평, 타일(줄눈·로스·박스), 레미탈 포대, 페인트 L·통 구성·프라이머, 벽돌(0.5B~2.0B·블록·조적 몰탈),
        도배(폭 재단법 + 면적법 참고), 전기(여유율·역률·전선표 60A=16㎟), 지붕(각도·치·%), 필름, 칼라강판(폭·경사·면수 / 실면적), 석고(양면·피스),
        목재(간격 어림), 바닥(폭 수), 콘크리트(0.5㎥ 발주), 입력 부족 안내, 대표 수량 main
     ③ 더보기 → 자재 계산기: 14개 종류 그리드가 열리고, 타일을 고르면 입력 폼·기본값·칩
     ④ 값을 넣으면 입력 즉시 결과가 바뀌고, 「← 다른 계산」으로 돌아갔다가(최근 줄) 다시 들어오면 값이 남아 있다(세션 기억)
     ⑤ 결과 복사 글에 입력값과 결과가 들어간다
     ⑥ 저장 구조 변경 없음 — serializeData 에 calc 키가 없다
     ⑦ 칩을 누르면 규격·로스가 한 번에 바뀌고 눌린 칩이 표시된다
     ⑧ ⭐ 기본값으로 → 처음값과 다른 값만 hj_calc_prefs 에, 새로고침해도 그 값으로 시작, ↺ 처음값으로 지운다; ⚙ 기본값 화면 목록·✕·전부 처음으로
     ⑨ 면적 3가지 입력 — 평·가로×세로로 넣어도 ㎡로 계산, 모드 바꿔도 값이 이어짐, 시작 모드 설정
     ⑩ 🕘 작업기록 — 화면 한 번에 한 건, 누르면 그 값으로 다시 열림, ✕·모두 지우기, 끄면 남기지 않음
     ⑪ 📝 현장 메모로 — state.notes 에 한 건(현장 미지정이면 project null), dirty
     ⑫ ➕ 견적에 담기 — 견적 작성 중일 때만 보이고, 빈 첫 줄을 바꾼 뒤 그다음은 추가; 자재 단가가 있으면 💰 예상 자재비와 공급가
     ⑬ 지우는 동작은 물어보고 지운다(끄기·모두 지우기·전부 처음으로·기본값 ✕), 취소하면 그대로 — pageerror 0

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
assert(/\['calc','🧮','자재 계산기'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="calc"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='calc'\)\{return materialCalc\(\);\}/.test(source), '① 핸들러가 materialCalc 로 간다');
assert(/localStorage\.getItem\('hj_calc_prefs'\)/.test(source) && /localStorage\.getItem\('hj_calc_log'\)/.test(source), '① 기본값·작업기록은 이 폰 localStorage');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true, asked = [];   // confirm 은 기본이 '취소' 라 직접 답한다
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  const boot = async () => { await page.goto(APP, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof window.hjCalcRun === 'function' && typeof window.materialCalc === 'function'); };
  await boot();
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const outText = () => page.evaluate(() => (document.querySelector('#calcOut') || {}).textContent || '');
  const run = (id, v) => page.evaluate(([id, v]) => hjCalcRun(id, v), [id, v]);
  const val = (res, label) => { const r = res.rows.find(x => x[0] === label); assert(r, '행 없음: ' + label + ' in ' + JSON.stringify(res)); return r[1]; };
  const inputs = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modalRoot .calcIn')].map(i => [i.dataset.k, i.value])));
  const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('hj_calc_prefs') || 'null'));
  const logRead = () => page.evaluate(() => JSON.parse(localStorage.getItem('hj_calc_log') || '[]'));
  // 작업기록은 글자마다 쓰지 않고 0.5초 모았다 쓴다(화면을 옮기거나 닫으면 바로 쓴다) — 세어 보기 전에 모아둔 것을 쓴다
  const flushLog = () => page.evaluate(() => hjCalcLogFlush());
  const waitOut = re => page.waitForFunction(re => new RegExp(re).test((document.querySelector('#calcOut') || {}).textContent || ''), re.source);

  // ② 순수 계산
  let r = await run('area', { py: '10' });
  assert(val(r, '면적') === '33.06 ㎡' && val(r, '평') === '10 평' && r.main === null, '② 평→㎡: ' + JSON.stringify(r));
  r = await run('area', { w: '4', h: '3' });
  assert(val(r, '면적') === '12 ㎡' && val(r, '평') === '3.63 평' && val(r, '둘레') === '14 m', '② 가로세로: ' + JSON.stringify(r));
  r = await run('tile', { m2: '10', tw: '300', th: '600', joint: '3', loss: '10', box: '10' });
  // (0.303×0.603=0.182709㎡) 10/0.182709=54.73 → ×1.1=60.2 → 61장, 박스 7
  assert(val(r, '타일 (로스 포함)') === '61 장' && val(r, '순수 소요') === '55 장' && val(r, '박스') === '7 박스 (10장/박스)', '② 타일: ' + JSON.stringify(r));
  assert(r.main && r.main.name === '타일' && r.main.qty === 61 && r.main.unit === '장' && r.main.alt && r.main.alt.qty === 7 && r.main.alt.unit === '박스' && /300×600/.test(r.main.spec), '② 타일 main: ' + JSON.stringify(r.main));
  r = await run('tile', { m2: '10', tw: '300', th: '600', joint: '3', loss: '0' });
  assert(val(r, '타일 (로스 포함)') === '55 장' && !r.rows.some(x => x[0] === '박스') && !r.main.alt, '② 타일 로스 0·박스 미입력: ' + JSON.stringify(r));
  r = await run('mortar', { m2: '10', t: '20', loss: '0' });
  assert(val(r, '레미탈 40kg') === '10 포' && val(r, '무게') === '400 kg' && r.main.qty === 10 && r.main.unit === '포', '② 레미탈 20mm ㎡당 1포: ' + JSON.stringify(r));
  r = await run('paint', { m2: '40', cov: '8', coats: '2', loss: '10' });
  assert(val(r, '페인트') === '11 L' && val(r, '4L 통') === '3 통' && val(r, '18L 통') === '1 통' && val(r, '통 구성 참고') === '4L × 3' && !r.rows.some(x => /프라이머/.test(x[0])), '② 페인트: ' + JSON.stringify(r));
  r = await run('paint', { m2: '200', cov: '8', coats: '2', loss: '0', pcov: '10' });
  // 50L → 18L×2 + 나머지 14L(4L×4=16L) → 18L 한 통이 낫다 → 18L×3; 프라이머 200/10 = 20L
  assert(val(r, '페인트') === '50 L' && val(r, '통 구성 참고') === '18L × 3' && val(r, '프라이머 (1회)') === '20 L', '② 페인트 통 구성·프라이머: ' + JSON.stringify(r));
  r = await run('brick', { m2: '10', type: '75', loss: '3' });
  assert(val(r, '벽돌') === '773 매' && val(r, '조적 몰탈 참고') === '0.19 ㎥ (레미탈 40kg 약 10포)', '② 벽돌 0.5B: ' + JSON.stringify(r));
  r = await run('brick', { m2: '10', loss: '3' });
  assert(val(r, '벽돌') === '773 매', '② 벽돌 쌓기 미선택 → 0.5B 기본: ' + JSON.stringify(r));
  r = await run('brick', { m2: '10', type: '149', loss: '0' });
  assert(val(r, '벽돌') === '1,490 매', '② 벽돌 1.0B: ' + JSON.stringify(r));
  r = await run('brick', { m2: '10', type: '224', loss: '0' });
  assert(val(r, '벽돌') === '2,240 매', '② 벽돌 1.5B: ' + JSON.stringify(r));
  r = await run('brick', { m2: '10', type: '13', loss: '0' });
  assert(val(r, '블록') === '130 매' && !r.rows.some(x => /몰탈/.test(x[0])) && r.main.name === '블록', '② 블록: ' + JSON.stringify(r));
  r = await run('paper', { peri: '14', hgt: '2.3', open: '4', ceil: '0', kind: '0.93|17.75', loss: '15' });
  // 폭 재단: 14/0.93 → 16폭, 17.75/(2.3+0.1) → 롤당 7폭 → 3롤. 면적법: 14×2.3−4=28.2 → ×1.15=32.43 → /16.5075 → 2롤(참고)
  assert(val(r, '벽지').startsWith('3 롤') && val(r, '벽 폭 수') === '16 폭 (롤당 7폭, 여유 10cm)' && val(r, '면적법 참고').startsWith('2 롤') && val(r, '벽 면적') === '28.2 ㎡' && val(r, '도배 평 (창·문 뺀 실면적)') === '8.5 평' && /코너에서 자투리/.test(r.note), '② 도배 폭 재단·코너 안내: ' + JSON.stringify(r));
  assert(r.main.qty === 3 && r.main.unit === '롤', '② 도배 main: ' + JSON.stringify(r.main));
  r = await run('paper', { peri: '14', hgt: '2.3', open: '4', ceil: '0', kind: '0.93|17.75', walls: '4', loss: '15' });
  // 16폭 + (4면−1) = 19폭 → 롤당 7폭 → 3롤
  assert(val(r, '코너 여유 포함') === '19 폭 → 3 롤 (4면 각각 재단할 때)' && !/코너에서 자투리/.test(r.note), '② 도배 코너 여유: ' + JSON.stringify(r));
  r = await run('paper', { peri: '14', hgt: '2.3', open: '0', ceil: '12', kind: '0.93|17.75', loss: '15' });
  assert(val(r, '벽지').startsWith('4 롤') && val(r, '천장 (면적법)') === '1 롤', '② 도배 천장 추가: ' + JSON.stringify(r));
  r = await run('paper', { peri: '14', hgt: '2.3', open: '4', ceil: '0', kind: '16.5', loss: '15' });
  assert(val(r, '벽지').startsWith('2 롤') && !r.rows.some(x => x[0] === '벽 폭 수'), '② 도배 옛 ㎡ 벽지값이면 면적법: ' + JSON.stringify(r));
  r = await run('electric', { w: '3000', volt: '220' });
  assert(val(r, '전류') === '13.6 A (220V)' && val(r, '차단기 참고') === '20 A' && /2\.5㎟/.test(val(r, '전선 굵기 참고')) && /KEC/.test(r.note) && r.main === null, '② 전기: ' + JSON.stringify(r));
  r = await run('electric', { w: '30000', volt: '220' });
  assert(/초과/.test(val(r, '차단기 참고')), '② 전기 100A 초과 안내: ' + JSON.stringify(r));
  r = await run('electric', { w: '4000', volt: '220' });
  // 18.2A ×1.25 여유 = 22.7A → 30A (여유율이 없으면 20A 로 잘못 나온다)
  assert(val(r, '전류') === '18.2 A (220V)' && val(r, '차단기 참고') === '30 A' && /4㎟/.test(val(r, '전선 굵기 참고')), '② 전기 여유율 1.25: ' + JSON.stringify(r));
  r = await run('electric', { w: '6580', volt: '380' });
  assert(val(r, '전류') === '10 A (380V)', '② 삼상 380V √3: ' + JSON.stringify(r));
  r = await run('electric', { w: '10000', volt: '220' });
  // 45.5A ×1.25 = 56.8 → 60A → 16㎟ (옛 표는 10㎟ 로 얇았다)
  assert(val(r, '차단기 참고') === '60 A' && /16㎟/.test(val(r, '전선 굵기 참고')), '② 전기 60A 전선 16㎟: ' + JSON.stringify(r));
  r = await run('electric', { w: '3000', volt: '220', pf: '0.8' });
  assert(val(r, '전류') === '17 A (220V, 역률 0.8)' && val(r, '차단기 참고') === '30 A' && !/모터/.test(r.note), '② 전기 역률: ' + JSON.stringify(r));
  r = await run('electric', { w: '3000', volt: '380' });
  assert(/모터·에어컨/.test(r.note), '② 역률 1 이면 모터 부하 안내: ' + JSON.stringify(r));
  r = await run('roof', { m2: '100', deg: '30', loss: '0' });
  assert(val(r, '지붕 실면적') === '115.47 ㎡' && val(r, '경사 계수') === '1.155', '② 지붕 경사: ' + JSON.stringify(r));
  r = await run('roof', { m2: '100', deg: '10', unit: 'chi', loss: '0' });
  assert(val(r, '지붕 실면적') === '141.42 ㎡' && val(r, '경사 계수') === '1.414 (45°)', '② 지붕 10치=45°: ' + JSON.stringify(r));
  r = await run('roof', { m2: '100', deg: '100', unit: 'pct', loss: '0' });
  assert(val(r, '경사 계수') === '1.414 (45°)', '② 지붕 100%=45°: ' + JSON.stringify(r));
  r = await run('roof', { m2: '100', deg: '95', loss: '0' });
  assert(r.rows.length === 0 && /90° 이상/.test(r.note), '② 지붕 90° 이상은 조용히 자르지 않는다: ' + JSON.stringify(r));
  r = await run('roof', { m2: '100', deg: '85', loss: '0' });
  assert(r.rows.length === 3 && /단위/.test(r.note), '② 지붕 급경사 확인 안내: ' + JSON.stringify(r));
  r = await run('film', { m2: '12.2', width: '1.22', loss: '0' });
  assert(val(r, '필름 길이').startsWith('10 m') && val(r, '50m 롤') === '1 롤' && r.main.alt.unit === '롤', '② 필름: ' + JSON.stringify(r));
  r = await run('film', { m2: '12.2', width: '1.22', loss: '0', pcov: '6.1' });
  assert(val(r, '프라이머 (1회)') === '2 L', '② 필름 프라이머: ' + JSON.stringify(r));
  r = await run('steel', { m2: '75', eff: '0.75', slen: '6', eave: '0', loss: '0' });
  assert(val(r, '강판 총 길이').startsWith('100 m') && val(r, '장수').startsWith('17 장'), '② 칼라강판 실면적: ' + JSON.stringify(r));
  r = await run('steel', { width: '10', slen: '6', faces: '2', eff: '0.762', eave: '0.1', loss: '0' });
  // 10/0.762 → 14장/면 × 2면 = 28장, 장당 6.1m, 총 170.8m
  assert(val(r, '강판 장수').startsWith('28 장') && /면당 14장 × 2면/.test(val(r, '강판 장수')) && val(r, '장당 길이').startsWith('6.1 m') && val(r, '강판 총 길이') === '170.8 m' && r.main.qty === 28, '② 칼라강판 폭·경사·면수: ' + JSON.stringify(r));
  r = await run('steel', { width: '10', slen: '6', faces: '1', eff: 'c', effc: '0.5', eave: '0', loss: '0' });
  assert(val(r, '강판 장수').startsWith('20 장'), '② 칼라강판 유효폭 직접 입력: ' + JSON.stringify(r));
  r = await run('steel', { width: '10', slen: '6', faces: '1', eff: 'c', effc: '', loss: '0' });
  assert(r.rows.length === 0 && /유효폭/.test(r.note), '② 칼라강판 유효폭 없음 안내: ' + JSON.stringify(r));
  r = await run('gypsum', { m2: '32.4', sheet: '1.62', layers: '2', loss: '0' });
  assert(val(r, '석고보드') === '40 장' && val(r, '피스 참고') === '1,320 개 (장당 33개, ㎡당 20개 기준)', '② 석고보드 2겹: ' + JSON.stringify(r));
  r = await run('gypsum', { m2: '32.4', sheet: '1.62', layers: '1', sides: '2', loss: '0' });
  assert(val(r, '석고보드') === '40 장 (양면)', '② 석고보드 양면: ' + JSON.stringify(r));
  r = await run('gypsum', { m2: '28.8', sheet: '2.88', layers: '1', loss: '0' });
  assert(val(r, '석고보드') === '10 장' && val(r, '피스 참고') === '580 개 (장당 58개, ㎡당 20개 기준)', '② 석고 피스는 보드 크기 따라: ' + JSON.stringify(r));
  r = await run('wood', { m2: '10', spacing: '450', stick: '3.6', loss: '0' });
  // 10/0.45 = 22.2m → /3.6 → 7본
  assert(val(r, '각재 (간격 450mm 한 방향 어림)').startsWith('7 본') && /한 방향/.test(r.note) && val(r, '합판').startsWith('4 장') && r.main.name === '각재', '② 목재 간격 어림(찾던 것은 각재): ' + JSON.stringify(r));
  r = await run('wood', { len: '20', stick: '3.6', loss: '10' });
  assert(val(r, '각재').startsWith('7 본') && r.main.name === '각재', '② 각재 총 길이: ' + JSON.stringify(r));
  r = await run('floor', { m2: '12', aw: '4', ah: '3', roll: '1.8', box: '1.5', loss: '0' });
  // 가로 4/1.8 → 3폭×3.1=9.3m, 세로 3/1.8 → 2폭×4.1=8.2m → 짧은 쪽
  assert(val(r, '장판 (폭 1.8m · 폭 수)') === '8.2 m (2폭, 여유 10cm)' && val(r, '마루·타일형').startsWith('8 박스'), '② 바닥 폭 수: ' + JSON.stringify(r));
  r = await run('floor', { m2: '12', roll: '2', box: '', loss: '0' });
  assert(val(r, '장판 (폭 2m)') === '6 m' && r.main === null, '② 장판 면적법: ' + JSON.stringify(r));
  r = await run('concrete', { w: '5', h: '4', t: '10', loss: '5' });
  assert(val(r, '순 부피') === '2 ㎥' && val(r, '레미콘 (로스 포함)') === '2.1 ㎥' && val(r, '레미콘 발주 참고').startsWith('2.5 ㎥') && r.main.qty === 2.5, '② 콘크리트: ' + JSON.stringify(r));
  r = await run('concrete', { w: '1', h: '1', t: '10', loss: '0' });
  assert(val(r, '레미콘 발주 참고').startsWith('1 ㎥'), '② 레미콘 최소 1㎥: ' + JSON.stringify(r));
  r = await run('tile', { m2: '', tw: '300', th: '600' });
  assert(r.rows.length === 0 && /면적/.test(r.note) && r.main === null, '② 입력 부족 안내: ' + JSON.stringify(r));
  r = await run('nope', {});
  assert(r.rows.length === 0 && /없는 계산기/.test(r.note), '② 모르는 종류: ' + JSON.stringify(r));
  // 선택지·칩에 적힌 숫자와 실제로 쓰는 값이 같은가 — 벽돌 매/㎡, 석고·합판 규격, 벽지 폭×길이, 강판 유효폭, 칩이 넣는 값
  const wrong = await page.evaluate(() => {
    const bad = [];
    const near = (a, b) => Math.abs(a - b) <= 0.011;
    const cat = id => HJ_CALC_CATS.find(c => c.id === id);
    const field = (id, k) => cat(id).fields.find(f => f.k === k);
    field('brick', 'type').o.forEach(([v, l]) => { const m = l.match(/\((\d+(?:\.\d+)?)매\/㎡\)/); if (!m || Number(m[1]) !== Number(v)) bad.push('벽돌 ' + l + ' ≠ ' + v); });
    [['gypsum', 'sheet'], ['wood', 'sheet']].forEach(([id, k]) => field(id, k).o.forEach(([v, l]) => { const m = l.match(/(\d+)×(\d+)/); if (m && !near(m[1] * m[2] / 1e6, Number(v))) bad.push(id + ' ' + l + ' ≠ ' + v); }));
    field('paper', 'kind').o.forEach(([v, l]) => { const m = l.match(/(\d+)cm×([\d.]+)m/); const parts = String(v).split('|'); if (m && (!near(Number(m[1]) / 100, Number(parts[0])) || !near(Number(m[2]), Number(parts[1])))) bad.push('벽지 ' + l + ' ≠ ' + v); });
    field('steel', 'eff').o.forEach(([v, l]) => { const m = l.match(/(\d+)mm/); if (m && v !== 'c' && !near(Number(m[1]) / 1000, Number(v))) bad.push('강판 ' + l + ' ≠ ' + v); });
    HJ_CALC_CATS.forEach(c => (c.chips || []).forEach(g => g.items.forEach(it => {
      const nums = (it.l.match(/[\d.]+/g) || []).map(Number);
      Object.keys(it.v).forEach(k => { const val = it.v[k]; if (typeof val === 'number' && !nums.some(x => near(x, val))) bad.push(c.id + ' 칩 「' + it.l + '」 에 ' + k + ' ' + val + ' 이 안 보임'); });
    })));
    return bad;
  });
  assert(wrong.length === 0, '② 선택지·칩 숫자와 이름이 다름: ' + wrong.join(' / '));

  // ③ 더보기 → 계산기 그리드 → 타일 폼
  await page.evaluate(() => moreActionHandler('calc'));
  let t = await modalText();
  const cats = await page.evaluate(() => document.querySelectorAll('#modalRoot .calcCat').length);
  assert(/자재 계산기/.test(t) && cats === 14, '③ 그리드 14종: ' + cats);
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcRecent').length)) === 0, '③ 처음엔 최근 줄 없음');
  await page.click('#modalRoot .calcCat[data-id="tile"]');
  t = await modalText();
  assert(/타일 계산/.test(t) && /줄눈/.test(t), '③ 타일 폼: ' + t.slice(0, 80));
  let d = await inputs();
  assert(d.tw === '300' && d.th === '600' && d.joint === '3' && d.loss === '10' && d.m2 === '', '③ 기본값: ' + JSON.stringify(d));
  assert(/면적과 타일 크기를 넣어 주세요/.test(await outText()), '③ 빈 입력 안내');
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcChip').length)) === 8, '③ 타일 칩 5규격+3로스');
  assert(await page.evaluate(() => document.querySelector('#calcTools').hidden === true && !document.querySelector('#calcQuote')), '③ 결과 없으면 도구 줄 숨김, 견적 작성 중 아니면 담기 없음');
  assert(await page.evaluate(() => { const o = document.querySelector('#calcOut'); const g = document.querySelector('#modalRoot .calcIn'); return !!o && !!g && (o.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; }), '③ 결과 상자가 입력보다 위');
  assert(await page.evaluate(() => { const o = document.querySelector('#calcOut'); const top = document.querySelector('#calcTop'); return getComputedStyle(top).position === 'sticky' && top.contains(o) && top.contains(document.querySelector('#calcTools')) && o.getAttribute('aria-live') === 'polite' && o.getAttribute('role') === 'status'; }), '③ 결과와 도구 줄이 함께 위에 붙어 있고, 결과는 소리로 읽힌다');
  // 계산기가 스스로 그린 것은 44px 이상(모달 밑줄 버튼은 앱 공통 규칙 42px 이라 뺀다)
  const small = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mbody button, #modalRoot .mbody input:not([type=hidden]), #modalRoot .mbody select')].filter(el => el.getBoundingClientRect().height < 43.5).map(el => (el.textContent || el.dataset.k || el.type) + ' ' + Math.round(el.getBoundingClientRect().height)));
  assert(small.length === 0, '③ 손가락으로 누르는 것은 44px 이상: ' + small.join(', '));
  const tiny = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mbody .calcIn')].filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.dataset.k + ' ' + getComputedStyle(el).fontSize));
  assert(tiny.length === 0, '③ 입력 글자는 16px 이상(아이폰이 칸마다 화면을 확대하지 않게): ' + tiny.join(', '));
  const noName = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .calcIn')].filter(el => !el.getAttribute('aria-label') && !el.closest('label')).map(el => el.dataset.k));
  assert(noName.length === 0, '③ 모든 입력칸에 이름이 있다(소리로 읽힌다): ' + noName.join(', '));

  // ④ 입력 즉시 결과, 뒤로 갔다 와도 값 유지
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await page.fill('#modalRoot .calcIn[data-k="box"]', '10');
  await waitOut(/61 장/);
  let out = await outText();
  assert(/타일 \(로스 포함\)61 장/.test(out) && /7 박스/.test(out), '④ 즉시 계산: ' + out);
  assert(await page.evaluate(() => document.querySelector('#calcTools').hidden === false), '④ 결과가 나오면 도구 줄');
  await page.click('#modalRoot .mfoot button:has-text("다른 계산")');
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcCat').length)) === 14, '④ 그리드로 돌아감');
  assert((await page.evaluate(() => [...document.querySelectorAll('#modalRoot .calcRecent')].map(b => b.dataset.id).join())) === 'tile', '④ 최근 줄에 타일');
  await page.click('#modalRoot .calcRecent[data-id="tile"]');
  await waitOut(/61 장/);
  assert((await inputs()).m2 === '10', '④ 값 기억');

  // ⑤ 결과 복사 글
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#modalRoot .mfoot button:has-text("결과 복사")');
  await page.waitForFunction(() => !!window.__copied);
  let copied = await page.evaluate(() => window.__copied);
  assert(/^🧮 타일 — /.test(copied) && /면적 ㎡ 10/.test(copied) && /타일 \(로스 포함\): 61 장/.test(copied) && /박스: 7 박스/.test(copied) && /※ 참고값/.test(copied) && !/예상 자재비/.test(copied), '⑤ 복사 글: ' + copied);

  // ⑥ 저장 구조 변경 없음
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /calc/i.test(k)), '⑥ serializeData 에 calc 키 없음: ' + keys.join(','));

  // ⑦ 칩
  await page.click('#modalRoot .calcChip:has-text("600×600")');
  await waitOut(/31 장/);   // 10/(0.603²)=27.5 → ×1.1 → 31장, 4장/박스 → 8박스
  d = await inputs();
  assert(d.tw === '600' && d.th === '600' && d.box === '4' && /8 박스/.test(await outText()), '⑦ 규격 칩: ' + JSON.stringify(d));
  assert(await page.evaluate(() => document.querySelector('#modalRoot .calcChip[aria-pressed="true"]').textContent.includes('600×600')), '⑦ 눌린 칩 표시');
  await page.click('#modalRoot .calcChip:has-text("대각 15%")');
  await waitOut(/32 장/);
  assert((await inputs()).loss === '15' && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcChip[aria-pressed="true"]').length)) === 2, '⑦ 로스 칩·둘 다 눌림');

  // ⑧ ⭐ 기본값으로 → 새로고침 후에도, ↺ 처음값
  assert(/⭐ 를 누르면/.test(await page.evaluate(() => document.querySelector('#calcDefStatus').textContent)), '⑧ 저장 전 안내');
  await page.click('#calcSaveDef');
  let p = await prefs();
  assert(p && p.d && p.d.tile && p.d.tile.tw === '600' && !('th' in p.d.tile) && p.d.tile.loss === '15' && p.d.tile.box === '4' && !('joint' in p.d.tile), '⑧ 처음값과 다른 것만 저장(세로 600·줄눈 3은 처음값이라 빠짐): ' + JSON.stringify(p));
  assert(/내 기본값/.test(await page.evaluate(() => document.querySelector('#calcDefStatus').textContent)), '⑧ 저장 표시');
  await boot();
  await page.evaluate(() => materialCalc());
  assert(/⭐ 내 기본값/.test(await page.evaluate(() => document.querySelector('#modalRoot .calcCat[data-id="tile"]').textContent)), '⑧ 그리드에 내 기본값 표시');
  await page.click('#modalRoot .calcCat[data-id="tile"]');
  d = await inputs();
  assert(d.tw === '600' && d.th === '600' && d.loss === '15' && d.box === '4' && d.joint === '3' && d.m2 === '', '⑧ 새로고침 뒤 내 기본값으로 시작: ' + JSON.stringify(d));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await waitOut(/32 장/);
  asked = []; sayYes = false;
  await page.click('#calcResetDef');
  await page.waitForFunction(() => true);
  assert(asked.length === 1 && /기본값을 지우고/.test(asked[0]) && (await prefs()).d.tile && (await inputs()).loss === '15', '⑧ ↺ 처음값을 취소하면 저장한 기본값이 그대로: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#calcResetDef');
  await waitOut(/61 장/);
  d = await inputs();
  p = await prefs();
  assert(d.tw === '300' && d.th === '600' && d.loss === '10' && d.box === '' && d.m2 === '10' && !(p.d && p.d.tile), '⑧ 처음값: 규격·로스만 돌리고 면적은 그대로, 저장값 삭제: ' + JSON.stringify(d) + ' ' + JSON.stringify(p));
  // 고르는 칸(규격·면수)은 그대로 두고 숫자만 바꿔 저장하면, 안 건드린 선택지는 들어가지 않는다
  await page.evaluate(() => { window.__hjCalcMem.gypsum = {}; materialCalc('gypsum'); });
  await page.fill('#modalRoot .calcIn[data-k="layers"]', '2');
  await page.click('#calcSaveDef');
  p = await prefs();
  assert(p.d.gypsum && p.d.gypsum.layers === '2' && !('sheet' in p.d.gypsum) && !('sides' in p.d.gypsum), '⑧ 안 바꾼 선택지는 기본값에 안 들어간다: ' + JSON.stringify(p.d.gypsum));
  await page.evaluate(() => { const pr = hjCalcPrefs(); delete pr.d.gypsum; hjCalcPrefsSave(pr); });
  await page.evaluate(() => materialCalc('tile'));
  // ⚙ 기본값 화면: 목록·✕·전부 처음으로
  await page.click('#modalRoot .calcChip:has-text("300×300")');
  await page.click('#calcSaveDef');
  await page.evaluate(() => materialCalc('paper'));
  await page.selectOption('#modalRoot .calcIn[data-k="kind"]', '1.06|15.6');
  await page.click('#calcSaveDef');
  await page.evaluate(() => materialCalcSettings());
  t = await modalText();
  assert(/계산기 기본값/.test(t) && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcDefRow').length)) === 2 && /타일 세로 mm 300, 박스당 장수 11/.test(t) && /벽지 실크 106cm×15.6m/.test(t), '⑧ 설정 화면 목록: ' + t.slice(0, 300));
  asked = [];
  await page.click('#modalRoot .calcDefDel[data-id="paper"]');
  p = await prefs();
  assert(asked.length === 1 && /지울까요/.test(asked[0]), '⑧ 기본값 ✕ 도 물어본다: ' + JSON.stringify(asked));
  assert(!(p.d.paper) && p.d.tile && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcDefRow').length)) === 1, '⑧ ✕ 하나 지움');
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("전부 처음으로")');
  p = await prefs();
  assert(Object.keys(p.d).length === 0 && /저장한 기본값이 없습니다/.test(await modalText()) && asked.length === 1, '⑧ 전부 처음으로(물어본 뒤)');
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("전부 처음으로")');
  assert(asked.length === 0, '⑧ 지울 게 없으면 묻지도 지웠다고 하지도 않는다');

  // ⑨ 면적 3가지 입력 (앞 단계에서 바뀐 규격은 지우고 처음값 300×600 으로)
  await page.evaluate(() => { window.__hjCalcMem.tile = { m2: '10' }; materialCalc('tile'); });
  await page.click('#modalRoot .calcSeg[data-mode="py"]');
  d = await inputs();
  assert(!('m2' in d) && d.m2_py === '3.03', '⑨ ㎡→평 전환 시 값 이어짐(10㎡=3.03평): ' + JSON.stringify(d));
  assert(/면적 평/.test(await page.evaluate(() => document.querySelector('.calcArea').textContent)) && (await page.evaluate(() => document.querySelector('.calcIn[data-k="m2_py"]').getAttribute('aria-label'))) === '면적 평', '⑨ 평 모드면 라벨도 평: ' + await page.evaluate(() => document.querySelector('.calcArea span').textContent));
  await page.fill('#modalRoot .calcIn[data-k="m2_py"]', '10');
  await waitOut(/200 장/);   // 10평=33.06㎡ / 0.182709 = 180.9 → ×1.1 → 200장
  assert(/= 33.06 ㎡/.test(await page.evaluate(() => document.querySelector('.calcAreaEcho').textContent)), '⑨ 평 → ㎡ 환산 표시');
  await page.click('#modalRoot .calcSeg[data-mode="wh"]');
  assert((await page.evaluate(() => [document.querySelector('.calcIn[data-k="m2_w"]').getAttribute('aria-label'), document.querySelector('.calcIn[data-k="m2_h"]').getAttribute('aria-label')].join('|'))) === '면적 가로 m|면적 세로 m', '⑨ 가로×세로 칸 이름');
  await page.fill('#modalRoot .calcIn[data-k="m2_w"]', '4');
  await page.fill('#modalRoot .calcIn[data-k="m2_h"]', '3');
  await waitOut(/73 장/);   // 12㎡ / 0.182709 = 65.7 → ×1.1 → 73장
  assert(/= 12 ㎡ \(3.63평\)/.test(await page.evaluate(() => document.querySelector('.calcAreaEcho').textContent)), '⑨ 가로×세로 → ㎡·평 표시');
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });   // ⑧ 에서 새로고침했으니 복사 가로채기를 다시 건다
  await page.click('#modalRoot .mfoot button:has-text("결과 복사")');
  await page.waitForFunction(() => /4×3m/.test(window.__copied || ''));
  copied = await page.evaluate(() => window.__copied);
  assert(/면적 ㎡ 12 \(4×3m\)/.test(copied), '⑨ 복사 글에 가로×세로: ' + copied);
  await page.click('#modalRoot .calcSeg[data-mode="m2"]');
  d = await inputs();
  assert(d.m2 === '12' && /3.63 평/.test(await page.evaluate(() => document.querySelector('.calcAreaEcho').textContent)), '⑨ ㎡ 모드로 돌아오면 환산값: ' + JSON.stringify(d));
  await page.click('#modalRoot .calcSeg[data-mode="py"]');
  assert((await inputs()).m2_py === '3.63', '⑨ 다시 평으로 가면 지금 면적(12㎡=3.63평) — 아까 넣은 10평이 되살아나지 않는다: ' + JSON.stringify(await inputs()));
  await page.click('#modalRoot .calcSeg[data-mode="wh"]');
  assert((await inputs()).m2_w === '4' && (await inputs()).m2_h === '3', '⑨ 가로×세로는 곱이 맞으면 그대로 둔다');
  await page.click('#modalRoot .calcSeg[data-mode="py"]');
  await page.fill('#modalRoot .calcIn[data-k="m2_py"]', '20');
  await waitOut(/399 장/);   // 20평=66.12㎡ → /0.182709 → 361.9 → ×1.1 → 399장
  await page.click('#modalRoot .calcSeg[data-mode="wh"]');
  assert((await inputs()).m2_w === '' && (await inputs()).m2_h === '' && /가로·세로|면적/.test(await outText()), '⑨ 면적이 바뀌었으면 안 맞는 가로·세로는 비운다: ' + JSON.stringify(await inputs()));
  await page.evaluate(() => materialCalcSettings());
  await page.selectOption('#calcAreaMode', 'py');
  await page.evaluate(() => materialCalc('paint'));
  d = await inputs();
  assert('m2_py' in d && !('m2' in d), '⑨ 시작 모드 설정(평)이 새 화면에 적용: ' + JSON.stringify(d));
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('hj_calc_prefs')); p.ui.areaMode = 'm2'; localStorage.setItem('hj_calc_prefs', JSON.stringify(p)); });

  // ⑩ 작업기록
  await flushLog();
  let log = await logRead();
  const tileLogs = log.filter(e => e.cat === 'tile');
  assert(log.length >= 3 && log.length <= 20 && tileLogs.length >= 1 && /타일 \(로스 포함\) 399 장/.test(log[0].head) && log[0].cat === 'tile', '⑩ 계산마다 기록, 화면 하나에 한 건(맨 앞이 방금 한 계산): ' + JSON.stringify(log.map(e => [e.cat, e.head])));
  const before = log.length;
  await page.evaluate(() => { window.__hjCalcMem.tile = {}; materialCalc('tile'); });   // ⑨ 에서 가로×세로 모드로 두고 나왔으니 ㎡ 로 되돌린다
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '5');
  await waitOut(/31 장/);   // 5/0.182709=27.4 → ×1.1 → 31장
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '6');
  await waitOut(/37 장/);
  assert((await logRead()).length === before, '⑩ 글자를 칠 때마다 저장하지는 않는다(잠깐 모았다 쓴다)');
  await flushLog();
  log = await logRead();
  assert(log.length === before + 1 && log[0].cat === 'tile' && /37 장/.test(log[0].head) && log[0].v.m2 === '6', '⑩ 같은 화면에서 값을 고쳐도 한 건이 덮어써짐: ' + JSON.stringify(log.slice(0, 2)));
  await page.evaluate(() => materialCalcLog());
  t = await modalText();
  const rowsN = await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLogRow').length);
  assert(/계산 작업기록/.test(t) && rowsN === before + 1 && /타일 · 타일 \(로스 포함\) 37 장/.test(t), '⑩ 기록 화면: ' + rowsN + ' ' + t.slice(0, 200));
  await page.click('#modalRoot .calcLogRow >> nth=0');
  await waitOut(/37 장/);
  assert((await inputs()).m2 === '6' && /타일 계산/.test(await modalText()), '⑩ 기록을 누르면 그 값으로 다시 열림');
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '7');
  await waitOut(/43 장/);
  await flushLog();
  assert((await logRead()).length === before + 1, '⑩ 기록에서 다시 연 화면은 그 기록을 덮어쓴다(새 건 없음)');
  await page.evaluate(() => materialCalcLog());
  await page.click('#modalRoot .calcLogDel >> nth=0');
  assert((await logRead()).length === before && (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLogRow').length)) === before, '⑩ ✕ 하나 지움: ' + JSON.stringify((await logRead()).map(e => [e.cat, e.head, e.id])) + ' 저장 ' + (await logRead()).length + ' 화면 ' + (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLogRow').length)) + ' 기대 ' + before);
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("모두 지우기")');
  assert((await logRead()).length === 0 && /아직 기록이 없습니다/.test(await modalText()) && asked.length === 1 && /되돌릴 수 없습니다/.test(asked[0]), '⑩ 모두 지우기는 물어본 뒤: ' + JSON.stringify(asked));
  // 쌓인 기록이 있는 채로 끄면 지울지 따로 물어본다 — 취소하면 그대로 둔다(예고 없는 삭제 금지)
  await page.evaluate(() => materialCalc('mortar'));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await waitOut(/포/);
  await flushLog();
  assert((await logRead()).length === 1, '⑩ 끄기 시험용 기록 1건');
  await page.evaluate(() => materialCalcSettings());
  asked = []; sayYes = false;
  await page.uncheck('#calcLogOn');
  assert(asked.length === 1 && /이미 쌓인 1건도 지울까요/.test(asked[0]) && (await logRead()).length === 1 && (await prefs()).ui.log === false, '⑩ 끄기를 취소하면 기록은 그대로: ' + JSON.stringify(asked) + ' ' + JSON.stringify(await logRead()));
  sayYes = true;
  await page.check('#calcLogOn');
  await page.uncheck('#calcLogOn');
  assert((await logRead()).length === 0, '⑩ 확인하면 쌓인 기록도 지운다');
  await page.evaluate(() => materialCalc('tile'));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '8');
  await waitOut(/49 장/);
  await flushLog();
  assert((await logRead()).length === 0 && (await prefs()).ui.log === false, '⑩ 작업기록 끄면 남기지 않음');
  await page.evaluate(() => materialCalcSettings());
  await page.check('#calcLogOn');
  assert((await prefs()).ui.log === true, '⑩ 작업기록 다시 켬');

  // ⑪ 현장 메모로
  const notesBefore = await page.evaluate(() => { state.notes = state.notes || []; state.activeProject = null; state.dirty = false; return state.notes.length; });
  await page.evaluate(() => materialCalc('tile'));
  await page.fill('#modalRoot .calcIn[data-k="m2"]', '10');
  await waitOut(/61 장/);
  await page.evaluate(() => { window.__renderCalls = 0; if (!window.__renderWrapped) { window.__renderWrapped = true; const orig = window.render; window.render = function () { window.__renderCalls++; return orig.apply(this, arguments); }; } });
  await page.click('#calcNote');
  assert((await page.evaluate(() => window.__renderCalls)) >= 1, '⑪ 메모를 넣으면 바로 화면을 다시 그린다(넣었는데 안 보이면 또 넣게 된다)');
  const note = await page.evaluate(() => ({ n: state.notes.length, last: state.notes[state.notes.length - 1], dirty: state.dirty }));
  assert(note.n === notesBefore + 1 && /^🧮 타일 — 면적 ㎡ 10/.test(note.last.text) && /61 장/.test(note.last.text) && note.last.project === null && note.last.id && note.last.date && note.dirty === true, '⑪ 현장 메모: ' + JSON.stringify(note));
  await page.evaluate(() => { state.activeProject = '시험현장'; });
  await page.click('#calcNote');
  assert((await page.evaluate(() => state.notes[state.notes.length - 1].project)) === '시험현장', '⑪ 활성 현장이 있으면 그 현장으로');
  await page.evaluate(() => { state.notes.splice(-2, 2); state.activeProject = null; });

  // ⑫ 견적에 담기 + 예상 자재비
  await page.evaluate(() => { state.editingQuote = newQuote(false); state.materials = [{ id: 'm_t1', name: '포세린 타일 300×600', spec: '무광', unit: '장', entries: [{ supplier: '시험', price: 1100 }] }, { id: 'm_t2', name: '타일 본드', unit: 'kg', entries: [{ supplier: '시험', price: 5500 }] }]; });
  await page.evaluate(() => materialCalc('tile'));
  await waitOut(/61 장/);
  out = await outText();
  assert(/💰 예상 자재비 참고 ≈ 61,000원/.test(out) && /공급가 1,000원\/장 × 61장/.test(out) && !/다른 후보/.test(out), '⑫ 예상 자재비(단위 같은 자재만, 공급가 ÷1.1): ' + out);
  assert(await page.evaluate(() => !!document.querySelector('#calcQuote')), '⑫ 견적 작성 중이면 담기 버튼');
  await page.click('#calcQuote');
  let q = await page.evaluate(() => ({ items: state.editingQuote.items, pushed: window.__hjCalcQuotePushed, dirty: state.dirty }));
  assert(q.items.length === 1 && q.items[0].name === '타일' && /300×600/.test(q.items[0].spec) && q.items[0].qty === 61 && q.items[0].price === 1000 && q.pushed === true && q.dirty === true, '⑫ 빈 첫 줄을 품목으로: ' + JSON.stringify(q));
  await page.click('#calcQuote');
  q = await page.evaluate(() => state.editingQuote.items);
  assert(q.length === 2 && q[1].name === '타일', '⑫ 두 번째는 추가: ' + JSON.stringify(q));
  await page.click('#modalRoot .mfoot button:has-text("결과 복사")');
  await page.waitForFunction(() => /예상 자재비/.test(window.__copied || ''));
  assert(/💰 예상 자재비 참고 ≈ 61,000원/.test(await page.evaluate(() => window.__copied)), '⑫ 복사 글에도 예상 자재비');
  await page.evaluate(() => { state.materials = [{ id: 'm_t3', name: '타일', unit: '박스', entries: [{ supplier: '시험', price: 22000 }] }]; });
  await page.fill('#modalRoot .calcIn[data-k="box"]', '10');
  await waitOut(/20,000원\/박스 × 7박스/);   // 장 단위 자재가 없으면 박스로
  // 장 단위 자재가 없고 박스 단가만 있을 때: 박스 단가는 박스 수량과 함께 들어가야 한다(장 수량에 곱하면 8배 넘게 부푼다)
  await page.evaluate(() => { state.materials = [{ id: 'm_b1', name: '타일', unit: '박스', entries: [{ supplier: '비싼곳', price: 33000 }] }, { id: 'm_b2', name: '포세린 타일', unit: '박스', entries: [{ supplier: '싼곳', price: 22000 }] }]; state.editingQuote = newQuote(false); });
  await page.evaluate(() => materialCalc('tile'));
  await page.fill('#modalRoot .calcIn[data-k="box"]', '10');
  await waitOut(/7 박스/);
  out = await outText();
  assert(/최저 공급가 20,000원\/박스 × 7박스/.test(out) && /140,000원/.test(out) && /다른 후보 1건/.test(out) && /부가세 별도·실측 후 확정/.test(out), '⑫ 이름이 겹치면 가장 싼 단가, 매입가 고지: ' + out);
  await page.click('#calcQuote');
  q = await page.evaluate(() => state.editingQuote.items);
  assert(q.length === 1 && q[0].qty === 7 && q[0].price === 20000 && /단위 박스/.test(q[0].spec), '⑫ 박스 단가는 박스 수량으로 담긴다: ' + JSON.stringify(q));
  await page.evaluate(() => { state.materials = []; state.editingQuote = newQuote(false); });
  await page.fill('#modalRoot .calcIn[data-k="box"]', '');
  await waitOut(/61 장/);
  assert(!/예상 자재비/.test(await outText()), '⑫ 자재가 없으면 예상 자재비 없음');
  await page.click('#calcQuote');
  q = await page.evaluate(() => state.editingQuote.items);
  assert(q.length === 1 && q[0].qty === 61 && q[0].price === 0 && !/단위/.test(q[0].spec), '⑫ 단가를 못 찾으면 계산 수량 그대로·단가 0: ' + JSON.stringify(q));
  // 저장된 값이 깨져 있어도 화면은 열린다 / 사라진 선택지는 처음값으로
  await flushLog();   // 방금 계산한 건이 나중에 끼어들지 않게 먼저 쓴다
  await page.evaluate(() => { localStorage.setItem('hj_calc_log', JSON.stringify([null, { id: 'ok1', cat: 'tile', t: '시험', head: 'h', v: { m2: '3' } }, { nope: 1 }])); materialCalcLog(); });
  assert((await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLogRow').length)) === 1 && errors.length === 0, '⑫ 깨진 작업기록이 섞여도 열린다: 줄 ' + (await page.evaluate(() => document.querySelectorAll('#modalRoot .calcLogRow').length)) + ' 오류 ' + errors.join(' | '));
  await page.evaluate(() => { const pr = JSON.parse(localStorage.getItem('hj_calc_prefs') || '{}'); pr.d = pr.d || {}; pr.d.gypsum = { sheet: '9.99', layers: '2' }; localStorage.setItem('hj_calc_prefs', JSON.stringify(pr)); materialCalc('gypsum'); });
  d = await inputs();
  const shown = await page.evaluate(() => { const c = HJ_CALC_CATS.find(x => x.id === 'gypsum'); const pr = hjCalcPrefs(); return [hjCalcDefault(c, c.fields.find(f => f.k === 'sheet'), pr), hjCalcDefault(c, c.fields.find(f => f.k === 'layers'), pr)]; });
  assert(d.sheet === '1.62' && d.layers === '2' && shown[0] === '1.62' && shown[1] === '2', '⑫ 없어진 규격이 저장돼 있으면 처음값으로, 나머지 기본값은 그대로: ' + JSON.stringify(d) + ' ' + JSON.stringify(shown));
  await page.evaluate(() => { const pr = JSON.parse(localStorage.getItem('hj_calc_prefs')); delete pr.d.gypsum; localStorage.setItem('hj_calc_prefs', JSON.stringify(pr)); localStorage.setItem('hj_calc_log', '[]'); });
  let rendered = 0;
  await page.evaluate(() => { window.__renderCalls = 0; const orig = window.render; window.render = function () { window.__renderCalls++; return orig.apply(this, arguments); }; });
  await page.click('#modalRoot .modal-close');
  rendered = await page.evaluate(() => window.__renderCalls);
  assert(rendered >= 1 && (await page.evaluate(() => window.__hjCalcQuotePushed)) === false, '⑫ 담은 뒤 닫으면 견적표를 다시 그린다: ' + rendered);
  await page.evaluate(() => { state.editingQuote = null; state.dirty = false; });

  // ⑬ 오류 0
  assert(errors.length === 0, '⑬ pageerror: ' + errors.join(' | '));

  console.log('material-calc.e2e OK (① 메뉴 ② 계산 44건 ③ 그리드·폼·칩 ④ 즉시·기억·최근 ⑤ 복사 ⑥ 저장 무변경 ⑦ 칩 ⑧ 기본값·설정 ⑨ 면적 3모드 ⑩ 작업기록 ⑪ 현장 메모 ⑫ 견적 담기·예상 자재비 ⑬ 오류 0)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

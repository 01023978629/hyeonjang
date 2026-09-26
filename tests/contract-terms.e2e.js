/* contract-terms.e2e.js — 같은 앱이 서로 다른 계약 조건을 말하지 않는다 (Playwright)

   2026-09-26: 전자계약 서버(manmool apps-script-contract)는 지급 50/40/10·하자보증 법정 기간(방수 3년·설비 2년·
   마감 1년)을 말하는데, 앱의 계약서 초안·간이 계약서·분할납 계획은 30/40/30, 준공 인사 문자·계약서 초안·
   관리사무소 완료보고서는 '하자보수 1년' 을 말했다. 고객이 받은 초안과 서명한 전자계약이 다른 돈·다른 보증을
   말하면 분쟁 때에만 드러난다. 대표 승인(2026-09-26)으로 정본 하나로 맞췄다. 지키는 것:
     ① 정적 — HJ_PAY_RATIO 가 {down:0.5,mid:0.4,bal:0.1} 이고, 이웃 manmool 저장소가 있으면 서버 PAYMENT_RATIO·
        제7조 법정 기간과 실제로 대조한다. index.html 어디에도 옛 값(하자보수 단독 1년·무상 1년·개월간 한 숫자 하자·
        계약금 30%·30/40/30)이 다시 생기지 않는다 — 패턴 자기진단(옛 문장은 잡고 법정 공종별 나열은 안 잡는다) 포함
     ② 계약서 초안(contractDraftText) — 50%/40%/10% 금액, 셋의 합 = 계약금액(잔금은 나머지), 하자보수는 공종별
        법정 기간, 현장에 🛡 보증 항목을 등록해 두었으면 그 항목(보증서·청구서와 같은 정본)
     ③ 준공 인사 문자(msgTemplate done, 문자 센터 화면) — '1년간' 단독 약속 없이 공종별 기간, 현장 없이 불러도 안 깨진다
     ④ 분할납 계획(payPlanDialog) — 기본 50/40/10·합계 100%, 슬라이더로 비율을 바꾸는 기능은 그대로(바꾼 비율로 예약)
     ⑤ 간이 계약서(openContractDoc → drawDocCanvas) — 입력 기본 50/40, 캔버스 글에 계약금(50%)·중도금(40%)·잔금(10%)과
        공종별 하자, 한 숫자 '개월간' 하자 없음, 칸을 비우면 정본 기본값, 비율을 바꾸면 바꾼 대로, 작업확인서면 하자 줄 숨김
     ⑥ 관리사무소 완료보고서(buildAptReportPDF) 마지막 장 — 공종별 하자 기간
     ⑦ AS 관리 빈 안내·계약서 위험 검토 조언·AI 도구 설명·도움말도 같은 말(무상 1년·예: 1년·30/40/30 없음), pageerror 0

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

// ── ① 정적 ──
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ratioM = source.match(/const HJ_PAY_RATIO=Object\.freeze\(\{down:([\d.]+),mid:([\d.]+),bal:([\d.]+)\}\);/);
assert(ratioM, '① HJ_PAY_RATIO 정본 상수가 index.html 에 있다');
const appRatio = { down: +ratioM[1], mid: +ratioM[2], bal: +ratioM[3] };
assert(appRatio.down === 0.5 && appRatio.mid === 0.4 && appRatio.bal === 0.1, '① 앱 지급 비율 = 대표 확정 50/40/10: ' + JSON.stringify(appRatio));

// 이웃 manmool 저장소가 있으면 서버 정본과 글자 그대로 대조한다(없으면 건너뛰고 말한다)
const PURE = ['/home/user/manmool/apps-script-contract/Pure.gs', path.join(__dirname, '..', '..', 'manmool', 'apps-script-contract', 'Pure.gs')].find(p => fs.existsSync(p));
if (PURE) {
  const pure = fs.readFileSync(PURE, 'utf8');
  const m = pure.match(/var PAYMENT_RATIO\s*=\s*\{\s*down:\s*([\d.]+),\s*mid:\s*([\d.]+),\s*bal:\s*([\d.]+)\s*\}/);
  assert(m, '① 서버 Pure.gs 에서 PAYMENT_RATIO 를 읽었다');
  assert(+m[1] === appRatio.down && +m[2] === appRatio.mid && +m[3] === appRatio.bal, '① 앱 HJ_PAY_RATIO == 서버 PAYMENT_RATIO: 서버 ' + m.slice(1).join('/'));
  const svc = fs.readFileSync(path.join(path.dirname(PURE), 'ContractService.gs'), 'utf8');
  assert(/방수 관련 공사는 3년, 급배수 등 설비공사는 2년, 그 밖의 마감공사는 1년/.test(svc), '① 서버 제7조가 법정 3/2/1 을 말한다');
}
const defM = source.match(/const WARRANTY_ITEMS_DEFAULT=(\[[^\n]*\]);/);
assert(defM, '① WARRANTY_ITEMS_DEFAULT 가 있다');
const defItems = JSON.parse(defM[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
const monthsOf = re => (defItems.find(it => re.test(it.name)) || {}).months;
assert(monthsOf(/^방수/) === 36 && monthsOf(/설비/) === 24 && monthsOf(/^마감/) === 12, '① 앱 보증 정본 = 법정(방수 36·설비 24·마감 12개월): ' + defM[1]);

// 다시 생기면 안 되는 옛 값. 이름을 말해야 고칠 수 있다.
const FORBIDDEN = [
  [/하자\s*보[수증](?:(?!3년)[^\n]){0,30}?(?:1년|12개월)/, '하자보수·하자보증 뒤에 공종별 나열(3년) 없이 1년·12개월 단독 약속'],
  [/무상\s*(?:A\/S)?\s*\(?(?:완료\s*\+\s*)?(?:1년|12개월)/, "'무상 1년'·'무상 A/S(완료+1년)'"],
  [/(?:준공|완료)일로?부터\s*(?:1년|12개월)/, "'준공일로부터 1년' 단독 기간"],
  [/개월간 시공 하자/, '간이 계약서의 한 숫자 하자 기간(N개월간)'],
  [/warranty\s*:\s*12\b/, '간이 계약서 하자 기본값 12'],
  [/id="dcWar"/, '간이 계약서의 한 숫자 하자 입력칸'],
  [/id="ppP[13]">30%/, '분할납 계획 기본 30% 표시'],
  [/id="(?:ppR1|ppR3|dcP1)"[^>]*value="30"/, '분할납·간이 계약서 입력 기본값 30'],
  [/p1\s*:\s*30\s*,/, '간이 계약서 계약금 기본값 30'],
  [/value\|\|30\b/, '간이 계약서 계약금 빈칸 대체값 30'],
  [/계약금\s*\(\s*30\s*%\s*\)/, "계약서 초안 '계약금(30%)'"],
  [/계약금\s*30\s*\/\s*중도금\s*40\s*\/\s*잔금\s*30/, '도움말·AI 설명의 30/40/30'],
  [/amt\s*\*\s*0\.3\b/, '계약서 초안 계약금 0.3 곱셈'],
];
// 자기진단 — 옛 문장(b519e35 원문)은 전부 잡고, 법정 공종별 나열·무관한 0.3 은 안 잡아야 이 검사가 눈을 뜨고 있다
const OLD_SAMPLES = [
  "'6. 하자보수: 준공일로부터 1년 (통상 마모·사용자 과실 제외)\\n'+",
  '사용하시다 불편한 점이 있으면 바로 연락 주세요 — 하자보수는 준공일로부터 1년간 책임지고 처리해 드립니다.',
  '완료일이 입력된 현장이 없습니다 — 현장을 완료 처리하면 무상 1년이 자동 계산됩니다.',
  "advice:'하자보수 기간(예: 1년)과 범위를 명시하세요.'",
  '미처리 목록·전체 이력·무상 A/S(완료+1년) 만료 임박을 반환하고',
  "T('· 하자보수: 준공일로부터 1년간 책임 보수 (공종별 상세는 계약서 기준)',70,y,'25px sans-serif','#555');",
  "T('하자보수: 을은 공사 완료일로부터 '+d.warranty+'개월간 시공 하자를 무상 보수한다.',20);",
  "    p1:30,p2:40, warranty:12, from:'', to:'', memo:''};",
  '계약금 <input id="dcP1" type="number" value="30" style="width:64px">',
  "p1:+g('dcP1').value||30,p2:+g('dcP2').value||40",
  '<span>💰 계약금</span><span id="ppP1">30%</span></div><input type="range" id="ppR1" min="0" max="100" value="30" style="width:100%">',
  "'   - 계약금(30%): '+won(dp)+'원 — 계약 시\\n'+",
  '계약금액·지급조건(계약금30/중도금40/잔금30)·계좌·하자보수가 채워진',
  'const dp=Math.round(amt*0.3),mp=Math.round(amt*0.4),fp=amt-dp-mp;',
];
OLD_SAMPLES.forEach(s => assert(FORBIDDEN.some(([re]) => re.test(s)), '① 자기진단: 옛 문장을 못 잡는다(검사가 눈이 멀었다): ' + s));
const LEGIT_SAMPLES = [
  "'하자보증 방수 3년 · 급배수 등 설비 2년 · 마감 1년 (건설산업기본법 시행령 별표4 기준)',",
  '🛡 무상 A/S 기간 (법정 기준 · 방수 3년·설비 2년·마감 1년)',
  '만물 표준(방수 3년·급배수·배관 설비 2년·마감·전기 1년)은 자유롭게 수정하세요.',
  "if(nego<0 && c.supply>0 && Math.abs(nego)>c.supply*0.3)flags.push",
];
LEGIT_SAMPLES.forEach(s => FORBIDDEN.forEach(([re, why]) => assert(!re.test(s), '① 자기진단: 옳은 문장을 옛 값으로 잘못 잡는다(' + why + '): ' + s)));
const lines = source.split('\n');
const hits = [];
lines.forEach((l, i) => FORBIDDEN.forEach(([re, why]) => { const m = l.match(re); if (m) hits.push((i + 1) + '행 ' + why + ' — …' + l.slice(Math.max(0, m.index - 30), m.index + m[0].length + 10) + '…'); }));
assert(!hits.length, '① index.html 에 옛 계약 조건이 남아 있다:\n  ' + hits.join('\n  '));

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.contractDraftText === 'function' && !!window.__hjRestoreDone && !!window.__hjRelayBootDone);
  await page.evaluate(() => window.__hjRestoreDone);
  await page.evaluate(() => window.__hjRelayBootDone);
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const LEGAL = await page.evaluate(() => hjWarrantyPeriodText(WARRANTY_ITEMS_DEFAULT));
  assert(/방수 3년/.test(LEGAL) && /설비 2년/.test(LEGAL) && /마감\(도배·바닥·타일\) 1년/.test(LEGAL), '전제: 보증 정본 글이 법정 3/2/1 을 말한다: ' + LEGAL);

  // 시드 — 견적 파일(분할납 총액) + 견적서(간이 계약서) + 보증 항목 없는 현장·등록한 현장. 전화는 자기서술형 가짜값.
  await page.evaluate(() => {
    state.projects = [
      { name: '계약현장', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '010-0000-1234', addr: '대전 가짜구 시험로 1' }, archived: false },
      { name: '보증등록현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박고객', phone: '', addr: '' }, doneAt: '2026-01-01',
        warranty: { startedAt: '2026-01-01', items: [{ name: '방수', months: 60, expiresAt: '2031-01-01' }, { name: '마감', months: 24, expiresAt: '2028-01-01' }] }, archived: false }
    ];
    state.files = [{ id: 'e1', kind: 'estimate', name: '계약현장 견적.xlsx', project: '계약현장', est: { amount: 12345679, supply: 11223345, vat: 1122334 } }];
    state.quotes = [{ id: 'q1', project: '계약현장', title: '욕실 공사', date: '2026-09-20', vatIncluded: true, items: [{ name: '욕실 리모델링', qty: 1, price: 10000000 }] }];
    state.asLog = []; state.schedule = []; state.activeProject = '계약현장'; state.dirty = false;
  });

  // ② 계약서 초안
  const draft = await page.evaluate(() => {
    const f = { project: '계약현장', est: { amount: 12345679, supply: 11223345, vat: 1122334 } };
    const t = contractDraftText(f);
    const custom = contractDraftText({ project: '보증등록현장', est: { amount: 10000000 } });
    const sep = contractDraftText({ project: '계약현장', est: { amount: 11000000, supply: 11000000, vat: 1100000 } });   // 부가세 별도형
    return { t, custom, sep, down: Math.round(12345679 * HJ_PAY_RATIO.down), mid: Math.round(12345679 * HJ_PAY_RATIO.mid) };
  });
  const bal = 12345679 - draft.down - draft.mid;
  assert(draft.down === 6172840 && draft.mid === 4938272 && bal === 1234567, '② 50/40/나머지 금액: ' + [draft.down, draft.mid, bal].join('/'));
  // 줄 단위로 정확히 — won() 이 '원'을 붙이므로 '원원' 이 나오면 여기서 떨어진다(예전 초안이 그랬다)
  assert(draft.t.includes('\n   - 계약금(50%): 6,172,840원 — 계약 시\n'), '② 초안 계약금(50%) 금액: ' + (draft.t.match(/계약금\([^\n]*/) || [''])[0]);
  assert(draft.t.includes('\n   - 중도금(40%): 4,938,272원 — 공정 50% 시\n'), '② 초안 중도금(40%) 금액: ' + (draft.t.match(/중도금\([^\n]*/) || [''])[0]);
  assert(draft.t.includes('\n   - 잔금(10%): 1,234,567원 — 준공 검수 후 7일 이내\n'), '② 초안 잔금(10%) = 나머지(합이 계약금액과 1원도 안 어긋난다): ' + (draft.t.match(/잔금\([^\n]*/) || [''])[0]);
  assert(draft.t.includes('3. 계약금액: 일금 12,345,679원정 (부가가치세 포함)'), '② 계약금액 줄(원원정 아님): ' + (draft.t.match(/3\. 계약금액[^\n]*/) || [''])[0]);
  assert(!/원원/.test(draft.t + draft.sep), "② 초안 어디에도 '원원' 이 없다(별도 부가세 줄 포함): " + (draft.sep.match(/3\. 계약금액[^\n]*/) || [''])[0]);
  assert(!/\(30%\)/.test(draft.t), '② 초안에 옛 30% 가 없다');
  const wline = (draft.t.match(/6\. 하자보수:[^\n]*/) || [''])[0];
  assert(wline === '6. 하자보수: 준공일로부터 공종별로 ' + LEGAL + ' (통상 마모·사용자 과실 제외)', '② 초안 하자보수 = 공종별 법정 기간: ' + wline);
  const cline = (draft.custom.match(/6\. 하자보수:[^\n]*/) || [''])[0];
  assert(/방수 5년 · 마감 2년/.test(cline) && !/방수 3년/.test(cline), '② 🛡 보증 항목을 등록한 현장은 그 항목으로(보증서·청구서와 같은 정본): ' + cline);

  // ③ 준공 인사 문자 — 문자 센터 화면으로
  await page.evaluate(() => msgCenterCompose('done'));
  await page.waitForSelector('#modalRoot #mcBody');
  const doneMsg = await page.inputValue('#modalRoot #mcBody');
  assert(!/1년간/.test(doneMsg) && !/하자보수[^\n]{0,20}1년/.test(doneMsg.replace(LEGAL, '')), "③ 준공 문자에 '1년간' 단독 약속이 없다: " + doneMsg);
  assert(doneMsg.includes('하자보수는 준공일로부터 공종별로 ' + LEGAL + ' 동안 책임지고 처리해 드립니다.'), '③ 준공 문자 = 공종별 법정 기간: ' + doneMsg);
  const noProj = await page.evaluate(() => msgTemplate('done', null, {}));
  assert(noProj.includes(LEGAL), '③ 현장 없이 불러도 법정 기본으로 나온다');
  await page.evaluate(() => closeModal());

  // ④ 분할납 계획 — 기본 50/40/10, 바꾸는 기능 유지
  await page.evaluate(() => payPlanDialog('계약현장'));
  await page.waitForSelector('#modalRoot #ppR1');
  const pp = await page.evaluate(() => ({
    r: ['ppR1', 'ppR2', 'ppR3'].map(id => document.getElementById(id).value),
    p: ['ppP1', 'ppP2', 'ppP3'].map(id => document.getElementById(id).textContent),
    a1: document.getElementById('ppA1').textContent, want1: hjMan(Math.round(12345679 * 0.5)),
    sum: document.getElementById('ppSum').textContent
  }));
  assert(pp.r.join('/') === '50/40/10', '④ 슬라이더 기본 50/40/10: ' + pp.r.join('/'));
  assert(pp.p.join('/') === '50%/40%/10%', '④ 표시 기본 50%/40%/10%: ' + pp.p.join('/'));
  assert(pp.a1 === pp.want1, '④ 계약금 예상액 = 총액×50%: ' + pp.a1 + ' / ' + pp.want1);
  assert(/100%/.test(pp.sum) && /✓/.test(pp.sum), '④ 기본 합계 100% ✓: ' + pp.sum);
  await page.evaluate(() => { ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = '2026-10-0' + (i + 1); }); });
  await page.click('#modalRoot button:has-text("예약 저장")');
  const memos1 = await page.evaluate(() => (state.schedule || []).filter(s => s.project === '계약현장').map(s => s.memo));
  assert(memos1.join('|') === '계약현장 계약금(50%) 입금 예정|계약현장 중도금(40%) 입금 예정|계약현장 잔금(10%) 입금 예정', '④ 기본값 그대로 예약: ' + memos1.join('|'));
  await page.evaluate(() => { state.schedule = []; payPlanDialog('계약현장'); });
  await page.waitForSelector('#modalRoot #ppR1');
  await page.evaluate(() => { const r = document.getElementById('ppR1'); r.value = '30'; r.dispatchEvent(new Event('input', { bubbles: true })); ['ppD1', 'ppD2', 'ppD3'].forEach((id, i) => { document.getElementById(id).value = '2026-10-1' + (i + 1); }); });
  const pp2 = await page.evaluate(() => ({ p1: document.getElementById('ppP1').textContent, sum: document.getElementById('ppSum').textContent }));
  assert(pp2.p1 === '30%' && /80%/.test(pp2.sum), '④ 슬라이더로 비율을 바꿀 수 있다(표시·합계가 따라온다): ' + JSON.stringify(pp2));
  await page.click('#modalRoot button:has-text("예약 저장")');
  const memos2 = await page.evaluate(() => (state.schedule || []).filter(s => s.project === '계약현장').map(s => s.memo));
  assert(memos2[0] === '계약현장 계약금(30%) 입금 예정', '④ 바꾼 비율로 예약된다: ' + memos2.join('|'));

  // ⑤ 간이 계약서 — 입력 기본값·캔버스 글
  await page.evaluate(() => {
    window.__ft = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) { try { window.__ft.push(String(t)); } catch (e) {} return orig.apply(this, arguments); };
    window.__exports = [];
    window.__docExport = async function (cv, name, asPdf) { window.__exports.push({ name, asPdf, h: cv && cv.height }); };
    openContractDoc('q1');
  });
  await page.waitForSelector('#modalRoot #dcP1');
  const dc = await page.evaluate(() => ({ p1: document.getElementById('dcP1').value, p2: document.getElementById('dcP2').value, war: !!document.getElementById('dcWar'), row: (document.getElementById('dcWarRow') || {}).textContent || '' }));
  assert(dc.p1 === '50' && dc.p2 === '40', '⑤ 간이 계약서 입력 기본 50/40: ' + dc.p1 + '/' + dc.p2);
  assert(!dc.war, '⑤ 한 숫자 하자 입력칸(dcWar)이 없다');
  assert(dc.row.includes(LEGAL), '⑤ 하자 안내 줄 = 공종별 법정 기간: ' + dc.row);
  // 폰 폭(360)에서 긴 공종별 글이 칸을 밀어내지 않는다 — 넘침은 scrollWidth - clientWidth 로 잰다
  const ov = await page.evaluate(() => { const d = el => el ? el.scrollWidth - el.clientWidth : -1; return { doc: d(document.documentElement), modal: d(document.querySelector('#modalRoot .modal')), body: d(document.querySelector('#modalRoot .mbody')), pay: d(document.getElementById('dcPayRow')), war: d(document.getElementById('dcWarRow')) }; });
  assert(Object.values(ov).every(v => v === 0), '⑤ 360px 에서 간이 계약서 가로 넘침 0: ' + JSON.stringify(ov));
  const drawOnce = async () => {
    await page.evaluate(() => { window.__ft = []; window.__exports = []; });
    await page.click('#modalRoot #dcImg');
    await page.waitForFunction(() => window.__exports.length === 1);
    return page.evaluate(() => window.__ft.join(' '));
  };
  let canvasText = await drawOnce();
  assert(canvasText.includes('① 계약금(50%): ₩5,500,000') && canvasText.includes('② 중도금(40%): ₩4,400,000') && canvasText.includes('③ 잔    금(10%): ₩1,100,000'), '⑤ 캔버스 대금 50/40/10(총 11,000,000): ' + (canvasText.match(/① 계약금[^₩]*₩[\d,]+/) || [''])[0]);
  assert(canvasText.includes('하자보수: 을은 공사 완료일로부터 공종별로 ' + LEGAL + ' 동안 시공 하자를 무상 보수한다.'), '⑤ 캔버스 하자 = 공종별 법정 기간(접힌 줄을 이어 읽는다): ' + (canvasText.match(/하자보수:.{0,120}/) || [''])[0]);
  assert(!/개월간/.test(canvasText), '⑤ 한 숫자 개월간 하자가 없다');
  await page.fill('#modalRoot #dcP1', '');
  await page.fill('#modalRoot #dcP2', '');
  canvasText = await drawOnce();
  assert(canvasText.includes('① 계약금(50%)') && canvasText.includes('② 중도금(40%)'), '⑤ 칸을 비우면 정본 기본값으로: ' + (canvasText.match(/① 계약금\([^)]*\)/) || [''])[0]);
  await page.fill('#modalRoot #dcP1', '30');
  await page.fill('#modalRoot #dcP2', '40');
  canvasText = await drawOnce();
  assert(canvasText.includes('① 계약금(30%): ₩3,300,000') && canvasText.includes('③ 잔    금(30%)'), '⑤ 비율을 바꾸면 바꾼 대로 찍힌다(현장마다 조정 가능): ' + (canvasText.match(/① 계약금[^₩]*₩[\d,]+/) || [''])[0]);
  await page.check('#modalRoot input[name=dockind][value=confirm]');
  const hidden = await page.evaluate(() => ({ pay: getComputedStyle(document.getElementById('dcPayRow')).display, war: getComputedStyle(document.getElementById('dcWarRow')).display }));
  assert(hidden.pay === 'none' && hidden.war === 'none', '⑤ 작업확인서면 대금·하자 줄을 숨긴다(찍히지 않는 조건): ' + JSON.stringify(hidden));
  canvasText = await drawOnce();
  assert(!/하자보수/.test(canvasText) && !/계약금\(/.test(canvasText), '⑤ 작업확인서에는 대금·하자 조항이 없다');
  await page.check('#modalRoot input[name=dockind][value=contract]');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('dcWarRow')).display !== 'none'), '⑤ 계약서로 되돌리면 하자 줄이 다시 보인다');
  await page.evaluate(() => closeModal());

  // ⑥ 관리사무소 완료보고서 마지막 장
  const rpt = await page.evaluate(async () => {
    window.jspdf = { jsPDF: function () { return { addPage() {}, addImage() {}, save(n) { window.__pdfSaved = n; } }; } };
    await buildAptReportPDF({ site: '계약현장', dest: '시험 관리사무소', title: '계약현장 공사', period: '2026-09-01 ~ 2026-09-02', worker: '대표 1인', works: ['배관 교체'], note: '', showAmt: false, amt: 0, vat: false, date: '2026-09-26', photos: [] });
    return { texts: window.__rptTexts.join(''), saved: window.__pdfSaved || '' };
  });
  assert(rpt.saved, '⑥ 보고서가 끝까지 만들어졌다(save 호출)');
  assert(rpt.texts.includes('· 하자보수: 준공일로부터 공종별로 ' + LEGAL + ' 책임 보수'), '⑥ 완료보고서 하자 = 공종별 법정 기간: ' + (rpt.texts.match(/· 하자보수:.{0,100}/) || [''])[0]);
  assert(!/1년간/.test(rpt.texts), "⑥ 완료보고서에 '1년간' 단독 약속이 없다");

  // ⑦ AS 관리 빈 안내·위험 검토 조언·AI 설명·도움말
  await page.evaluate(() => { state.projects.forEach(p => { delete p.doneAt; delete p.warranty; }); asManage(); });
  await page.waitForSelector('#modalRoot #asmAdd');
  const asText = await modalText();
  assert(asText.includes('현장을 완료 처리하면 공종별 무상 기간이 자동 계산됩니다') && !/무상 1년/.test(asText), '⑦ AS 관리 빈 안내가 공종별 기간을 말한다: ' + (asText.match(/완료일이 입력된[^.]*\./) || [''])[0]);
  await page.evaluate(() => closeModal());
  const misc = await page.evaluate(() => ({
    advice: (CONTRACT_CHECKLIST.find(c => c.key === 'warranty') || {}).advice || '',
    qc: (AI_TOOLS.find(t => t.name === 'quote_contract') || {}).description || '',
    am: (AI_TOOLS.find(t => t.name === 'as_manage') || {}).description || '',
    help: [].concat(...HJ_HELP.map(g => g.items || [])).filter(it => it.k === '계약서 초안' || it.k === 'AS 관리').map(it => it.d).join(' || ')
  }));
  assert(misc.advice.includes(LEGAL) && !/예: 1년/.test(misc.advice), '⑦ 계약서 위험 검토 조언 = 공종별 기간: ' + misc.advice);
  assert(misc.qc.includes('계약금50/중도금40/잔금10') && misc.qc.includes('공종별 하자보수'), '⑦ AI 도구(quote_contract) 설명이 50/40/10·공종별 하자를 말한다: ' + misc.qc);
  assert(!/1년/.test(misc.am) && misc.am.includes('공종별 보증기간'), '⑦ AI 도구(as_manage) 설명에 무상 1년이 없다: ' + misc.am);
  assert(misc.help.includes('계약금50/중도금40/잔금10') && !/잔금30/.test(misc.help) && !/1년/.test(misc.help), '⑦ 도움말이 50/40/10·공종별 기간을 말한다: ' + misc.help);

  assert(!errors.length, 'pageerror 0: ' + errors.join(' | '));
  console.log('contract-terms.e2e OK (① 정적·서버 대조 ② 계약서 초안 ③ 준공 문자 ④ 분할납 ⑤ 간이 계약서 ⑥ 완료보고서 ⑦ AS·검토·AI·도움말)' + (PURE ? '' : ' — manmool 서버 소스가 옆에 없어 서버 대조는 건너뜀'));
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

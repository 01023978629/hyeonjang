/* v572 📑 계약·확인 양식 9종 — 합성 레코드만 쓴다(실제 고객·전화·계좌 없음). 실제 인쇄·공유·문자·외부 쓰기는 0.
   HJ_V572_BASELINE=<commit> 은 FORMS9_API_PRESENT 에서 실패해야 한다.
   HJ_V572_MUTATION=<이름> 은 index.html 을 메모리에서만 바꿔(파일은 그대로) 보호 동작을 되돌린다 — 아래 MUTATIONS 의 단언에서 실패해야 한다:
     clause-drop(조항 한 줄 삭제) · rrn-prefill(주민번호 미리 채움) · account-prefill(받을 계좌 미리 채움) · tax-compute(소득세 계산해 채움)
     early-issue(미리보기에서 발행 기록) · vat-guess(모르는 부가세를 포함으로) · amount-invent(없는 계약금액 지어냄) · settle-zero(빈 ②③④ 를 0 으로 정산) */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const ROOT = path.resolve(__dirname, '..');
const FULL = 'TEST_FORM_FULL_PROJECT', BARE = 'TEST_FORM_BARE_PROJECT', QONLY = 'TEST_FORM_QUOTE_PROJECT';
const CUST = { name: 'TEST_CUSTOMER_KIM', phone: '010-0000-0001', addr: 'TEST_ADDR 가짜구 가짜로 1' };
const WORKER = { name: 'TEST_WORKER_LEE', phone: '010-0000-0002', rrn: '900101-1234567', account: 'TESTBANK 111-2222-3333-44' };
const SUB = { name: 'TEST_SUB_TEAM', phone: '010-0000-0003', lead: 'TEST_LEAD_PARK' };
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const KEYS = ['contract', 'finish', 'change', 'photoconsent', 'subwork', 'daylabor', 'wagepay', 'asfix', 'cancel'];
const PREFIX = { contract: 'CT', finish: 'FS', change: 'CO', photoconsent: 'PC', subwork: 'SW', daylabor: 'DL', wagepay: 'WP', asfix: 'AF', cancel: 'CX' };
/* 양식 원본(docs/문서양식)의 글자 그대로 — 제목 + 핵심 조항·안내문. 하나라도 바뀌거나 빠지면 ① 이 실패한다. */
const PHRASES = {
  contract: ['공사도급계약서', '계약 요약', '대금 지급 (제3조)', '세부 범위·자재 사양·수량은 별첨 견적서(No.',
    '제1조(공사의 내용) 도급인(이하 "갑")과 수급인 만물인테리어(이하 "을")은 위 공사 장소의 공사에 관하여 이 계약을 체결한다. 공사의 구체적 범위·자재 사양·수량은 별첨 견적서에 따른다.',
    '제2조(계약금액) 총 계약금액은 위 계약금액란에 적은 금액으로 하며, 부가가치세 포함 여부는 그 란의 표시에 따른다.',
    '① 계약금(50%) — 계약 체결로 공사금액을 확정하고 자재를 구매하기 위한 대금으로, 계약 체결 시 지급한다.', '② 중도금(40%) — 주요 공정 완료를 갑이 확인한 때 지급한다.', '③ 잔금(10%) — 준공 및 하자 마무리 확인 후 지급한다.',
    '제4조(공사기간) 공사기간은 위 공사기간란에 적은 기간으로 한다. 다만, 천재지변, 민원, 갑의 자재 선정 지연 또는 현장 출입 불가 등 을의 책임 없는 사유로 공사가 지연된 경우 그 기간만큼 공사기간은 연장된다.',
    '제5조(공정별 확인과 동의)', '② 갑은 통지를 받은 날부터 3일 이내에 동의 여부를 회신한다.', '제6조(추가·변경 공사)', '③ 별도 계약 없이 갑의 요청에 따라 을이 서비스로 시공한 작업은 제7조의 하자보증 대상에서 제외한다.',
    '제7조(하자보증)', '① 을은 목적물 인도일부터 방수 관련 공사는 3년, 급배수 등 설비공사는 2년, 그 밖의 마감공사는 1년 동안 하자보수 책임을 진다(건설산업기본법 시행령 별표4 기준).',
    '제8조(잔금과 하자보수의 관계)', '제9조(지체상금) 을의 귀책사유로 준공이 지연된 경우 을은 지연 1일당 계약금액의 0.1%를 지체상금으로 갑에게 지급한다. 다만 제4조 단서에 해당하는 기간은 지연일수에서 제외한다.',
    '제10조(안전 및 민원)', '제11조(손해배상의 범위와 한도)', '① 을의 통상 과실로 발생한 재산상 손해에 대한 배상책임은 사고당 금 15,000,000원을 한도로 한다.', '2. 생명·신체에 대한 손해',
    '제12조(계약의 성립과 보관) 이 계약은 갑과 을이 계약서에 서명 또는 날인함으로써 성립하며, 계약서 2부를 작성하여 각 1부씩 보관한다. 별첨 견적서는 이 계약의 일부로 본다.',
    '제13조(계약의 해제와 분쟁)', '③ 본 계약에 정하지 아니한 사항은 관련 법령과 거래 관행에 따른다.',
    '해당하는 항목에만 ✓ 표시하고, 필요한 내용은 빈 줄에 적습니다.', '철거 후 발견되는 은폐 하자(누수·배관 부식 등)의 보수는 별도 견적으로 협의한다.', '거주 중 공사의 경우 귀중품은 갑이 미리 정리하며, 을은 보양 후 시공한다.',
    '을이 지정해 통지하는 계좌 하나에 ✓', '갑 (도급인)', '을 (수급인)', '생년월일', '첨부: 견적서 1부 (No.', '※ 본 계약서는 당사자 확인용이며 법률 자문이 아닙니다.'],
  finish: ['마감재 선택 확인서', '시공에 쓸 마감재의 제품·색상을 발주 전에 함께 확인하는 문서입니다.', '이 날까지 정하지 못한 항목은 공사 일정이 조정될 수 있습니다(계약서 제4조).', '제품명 · 브랜드', '품번 · 색상', '규격 · 수량',
    '확인 칸: 실물 샘플로 봤으면 "실물", 사진·카탈로그로 봤으면 "사진"에 ○', '1. 실제 색상·무늬는 조명·화면과 제조 차수(로트)에 따라 샘플과 조금 다를 수 있습니다.', '2. 품절·단종된 제품은 만물인테리어가 미리 알려 드리고 동급 이상 제품으로 바꿉니다.',
    '3. 이 확인서대로 발주한 뒤 바꾸시면 이미 발주·재단한 자재 비용과 일정 변경이 생길 수 있으며, 그 내용은 「추가·변경 공사 합의서」로 정합니다.', ')의 제품 하자는 하자보증 범위에서 제외됩니다(계약서 제7조 제2항).', '고객 확인', '만물인테리어 확인'],
  change: ['추가·변경 공사 합의서', '공사 중 추가·변경되는 작업의 내용과 금액을 시공 전에 서로 확인하는 문서입니다(공사도급계약서 제6조).', '원 계약', '합의 차수', '현장 여건(철거 후 발견 등)', '자재 품절·단종', '내용 (위치 · 작업)',
    '증감 합계 (감액은 − 로 표시)', '변경 후 총 계약금액 (원 계약금액 ± 증감 합계)', '구분 칸: 해당하는 것에 ○', '위 금액에 부가세 포함', '작업 완료 즉시', '변동 없음', '변경 준공일',
    '이 합의로 시공하는 작업에도 계약서 제7조의 하자보증이 그대로 적용됩니다.', '금액 없이 해 드리는 작업:', '계약서 제6조 제3항에 따라 하자보증 대상에서 제외됩니다.',
    '갑과 을은 위 내용에 합의하며, 을은 이 합의서에 적은 금액 외의 추가 비용을 청구하지 않습니다.', '※ 문자·카카오톡으로 먼저 합의한 경우에도 이 합의서로 정리해 각 1부씩 보관합니다.'],
  photoconsent: ['시공 사진 활용 동의서', '만물인테리어가 시공 사진을 시공 사례로 소개하는 데 대한 동의서입니다.', '동의하지 않으셔도 계약·시공·AS에 아무런 불이익이 없습니다.', '동의하시는 항목에만 □ 안에 ✓ 표시해 주세요.',
    '전후 비교', '인스타그램·Threads', '상담용 포트폴리오(인쇄물·태블릿)', '동까지 (예: 대전 중구 유천동)', '남겨 주신 말씀을 이름 없이 그대로 인용해도 됨', '동의하신 날부터 철회하실 때까지',
    '· 고객님 성함·연락처·동·호수·차량번호, 사람 얼굴, 가족사진·우편물 같은 개인 물품은 싣지 않거나 가립니다.', '· 공사 금액은 싣지 않습니다.', '· 고객 말씀은 실제로 남겨 주신 문구만, 고치지 않고 인용합니다.',
    '· 동의는 언제든 전화·문자로 철회하실 수 있고, 요청을 받은 날부터 7일 이내에 만물인테리어가 올린 게시물에서 내립니다. 이미 인쇄해 나눠 드린 자료는 회수가 어려울 수 있습니다.',
    '위 내용을 읽고, ✓ 표시한 범위에서 시공 사진 활용에 동의합니다.', '동의인 (고객)'],
  subwork: ['외주 작업 발주·확인서', '전문팀에 맡기는 작업의 범위·금액·조건을 작업 전에 정하고, 끝난 뒤 함께 확인하는 문서입니다.', '수급자 (전문팀)', '없음(개인)', '실측 치수', '만물 지급 (시공만)', '완료 확인 후',
    '3.3% 원천징수 (사업자 없는 개인)', '팀 시공으로 생긴 하자는 완료일부터 아래 기간 동안 무상으로 보수합니다.', '급배수 등 설비 2년', '부산물 정리', '폐기물 반출', '엘리베이터 보양 · 작업 가능 시간 · 소음 작업 · 주차 등',
    '작업이 끝나면 사진 3장(전경 · 디테일 · 정리 상태)을 보내 주세요.', '작업 중 알게 된 고객 정보(성함·연락처·주소)는 이 작업에만 쓰고 외부에 알리지 않습니다.', '완료 확인', '보완 필요 (', '발주자와 수급자는 위 내용으로 작업을 발주하고 수주합니다.'],
  daylabor: ['일용근로계약서', '건설 일용근로자의 근로조건을 서면으로 정하고, 1부를 근로자에게 드립니다(근로기준법 제17조).', '(이하 "근로자")는 다음과 같이 근로계약을 체결한다.', '1. 계약기간', '(기간을 정하지 않으면 시작일만 적음)', '2. 근무 장소', '3. 업무 내용', '보통인부',
    '4. 근로시간', '5. 근무일·휴일', '주휴일: 1주간 소정근로일을 개근한 경우 근로기준법에 따라 유급휴일을 부여한다.', '6. 임금', '연장·야간·휴일근로: 근로기준법에 따라 지급한다.', '7. 지급 방법', '(세법에 따라 원천징수 후 지급)',
    '8. 연차유급휴가', '근로기준법에서 정하는 바에 따라 부여한다.', '9. 사회보험', '10. 안전', '건설업 기초안전보건교육 이수증 확인', '근로자는 지급받은 안전장구를 착용하고 현장 안전수칙을 지킨다.',
    '11. 계약서 교부', '사업주는 이 계약서를 2부 작성하여 1부를 근로자에게 교부한다.', '12. 기타', '이 계약에 정하지 않은 사항은 근로기준법 등 관계 법령에 따른다.', '※ 같은 근로자를 계속·반복해 쓰는 경우 등 노무 판단이 필요하면 노무사 확인을 권합니다.'],
  wagepay: ['노임 지급 확인서', '일용 근로 노임을 지급하고 받은 금액을 확인하는 문서입니다. 근로자 1명당 1장씩 씁니다.', '주민등록번호', '입금 계좌', '예금주(본인)', '식대 등 (원)', '공수: 하루 1.0 · 반나절 0.5', '금액 = 공수 × 일당 + 식대 등',
    '지급 총액', '지방소득세', '실지급액', '위 금액을 정히 받았습니다.', '받은 사람 (근로자)', '지급한 사람',
    '※ 원천징수(2026년 10월 기준): 소득세 = (하루 노임 − 150,000원) × 6% × (1 − 55%), 곧 15만 원 넘는 금액의 2.7%. 지방소득세는 소득세의 10%. 소득세가 1,000원 미만이면 떼지 않으며, 여러 날 몫을 한 번에 지급하면 그 합계 세액으로 판단합니다.',
    '※ 신고: 일용근로소득 지급명세서는 지급한 달의 다음 달 말일까지, 원천세는 다음 달 10일까지 냅니다(반기별 납부 승인을 받았으면 그 기한). 세법이 바뀌면 세무사 확인이 필요합니다.',
    '※ 주민등록번호·계좌는 노임 지급과 일용근로소득 지급명세서 제출(소득세법)에만 쓰고, 세법이 정한 보관 기간이 지나면 파기합니다.'],
  asfix: ['하자보수(AS) 처리 확인서', '접수된 하자의 확인 결과와 처리 내용을 기록하고, 보수 완료를 함께 확인하는 문서입니다.', '접수번호', '준공(인도)일', '해당 공종', '만료일', '확인 · 처리', '현장에서 확인한 사실과 사진 근거만 적습니다.',
    '보증 범위 안의 시공 하자 — 무상 보수', '보증 범위 밖(사용·환경·제3자 원인, 보증기간 경과 등) — 실비', '제품 자체 불량 — 제조사 접수 대행', '원인 복합 — 분담 (', '사용 자재', '고객에게 전송',
    '위 하자의 보수가 완료되었음을 확인합니다.', '이 확인은 위 하자 1건에 한하며, 다른 부위의 하자와 남은 보증기간의 하자보수 책임에는 영향을 주지 않습니다.', '한 말씀 (선택)'],
  cancel: ['공사계약 해제 합의서', '체결한 공사도급계약을 서로 합의해 해제하고, 이미 받은 돈과 들어간 비용을 정산하는 문서입니다.', '계약번호', '해제 내용', '공사 중 (공정 약', '고객(갑)의 사정', '만물인테리어(을)의 사정', '서로 합의',
    '갑이 이미 지급한 금액', '이미 시공한 부분의 대금', '이미 구입·발주해 반품·취소할 수 없는 자재 대금', '그 밖에 이미 들어간 비용 (철거·폐기물 처리 등)', '정산 금액 ① − ( ② + ③ + ④ )',
    '을이 갑에게 돌려줌 (⑤가 플러스)', '갑이 을에게 지급 (⑤가 마이너스)', '받을 계좌', '을이 회수 (이 경우 ③에 넣지 않음)', '을이 정리 후 인도 (', '이미 시공한 부분의 하자보수는 원 계약 제7조에 따릅니다.',
    '갑과 을은 위 정산으로 원 계약의 해제에 따른 대금 정산을 마친 것으로 하며, 이 합의서에 정하지 않은 사항은 서로 협의하여 정합니다.', '※ 전자계약으로 체결한 계약의 해제도 이 합의서로 합니다.', '※ 해제에 따른 손해배상·위약금에 다툼이 있으면 서명 전에 전문가 검토를 권합니다.']
};
const MUTATIONS = {
  'clause-drop': [["    '제9조(지체상금) 을의 귀책사유로 준공이 지연된 경우 을은 지연 1일당 계약금액의 0.1%를 지체상금으로 갑에게 지급한다. 다만 제4조 단서에 해당하는 기간은 지연일수에서 제외한다.',\n", '']],
  'rrn-prefill': [["<td data-f9-rrn>'+hjF9Blank(70)+' – '+hjF9Blank(80)+'</td>", "<td data-f9-rrn>'+escapeHtml(String(((state.contacts||[]).find(c=>c&&c.name===m.wName)||{}).rrn||''))+'</td>"]],
  'account-prefill': [["data-f9-account>은행 '+hjF9Blank(70)+'&nbsp;&nbsp; 계좌번호 '+hjF9Blank(190)+'&nbsp;&nbsp; 예금주 '+hjF9Blank(70)+'</td>", "data-f9-account>은행 '+escapeHtml(COMPANY.accounts[0].bank)+'&nbsp;&nbsp; 계좌번호 '+escapeHtml(COMPANY.accounts[0].no)+'&nbsp;&nbsp; 예금주 '+hjF9Blank(70)+'</td>"]],
  'tax-compute': [["<tr><th>소득세</th><td class=\"r\" data-f9-tax>'+hjF9Blank(140)+' 원</td>", "<tr><th>소득세</th><td class=\"r\" data-f9-tax>'+hjNum(Math.round(m.payTotal*0.027))+' 원</td>"]],
  'early-issue': [["    closeModal();\n    const who=model.wName||model.subName||'';", "    closeModal();hjDoc433IssueQuiet(name,{type:key,no:model.no,purpose:'preview',name:def.t});\n    const who=model.wName||model.subName||'';"]],
  'vat-guess': [["if(s[k]==='none'||blank)return null;return typeof auto==='boolean'?auto:null;};", "if(s[k]==='none'||blank)return null;return typeof auto==='boolean'?auto:true;};"]],
  'amount-invent': [["F('workName',pick('workName',p.name));F('place',pick('place',b.cust.addr));F('scope',pick('scope',b.scope));F('quoteNo',pick('quoteNo',b.quoteNo));\n    F('amount',pickNum('amount',b.amount));", "F('workName',pick('workName',p.name));F('place',pick('place',b.cust.addr));F('scope',pick('scope',b.scope));F('quoteNo',pick('quoteNo',b.quoteNo));\n    F('amount',pickNum('amount',b.amount||10000000));"]],
  'settle-zero': [["&&n2!=null&&n3!=null&&n4!=null?m.paid-(n2+n3+n4):null;", "?m.paid-((n2||0)+(n3||0)+(n4||0)):null;"]]
};
function appBody() {
  if (process.env.HJ_V572_BASELINE) return execFileSync('git', ['show', process.env.HJ_V572_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  const kind = process.env.HJ_V572_MUTATION; if (!kind) return null;
  assert(MUTATIONS[kind], 'unknown mutation ' + kind);
  let src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const [from, to] of MUTATIONS[kind]) { assert.equal(src.split(from).length - 1, 1, 'unique mutation anchor: ' + kind); src = src.replace(from, to); }
  return src;
}
let browser, passed = 0, page;
(async () => {
  const body = appBody();
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? undefined : '/opt/pw-browsers/chromium') });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  page = await context.newPage(); const errors = [], network = { writes: 0 };
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) {
      if (body && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
      return route.continue();
    }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1');
    localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    window.__f9Calls = { print: [], word: [], html: [], sms: [], external: [] };
    window.open = (...args) => { __f9Calls.external.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (...args) => { __f9Calls.external.push(args); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => { await Promise.all(keys.map(key => window[key])); if (window.__hjShareInboxBootDone) await __hjShareInboxBootDone; }, BOOT);
  assert.equal(await page.evaluate(() => ['hjForm9Model', 'hjForm9View', 'hjForm9Status', 'hjF9Shell', 'hjF9ContractHtml', 'hjF9CancelHtml', 'hjForm9DocTypes'].every(k => typeof window[k] === 'function')
    && typeof HJ_FORM9 === 'object' && typeof HJ_FORM9_HTML === 'object'), true, 'FORMS9_API_PRESENT');
  await page.evaluate(async () => {
    aiOpsEnsureState().enabled = false;
    taxCalendarEnsure(); coworkSchedEnsure();
    clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    hjSendSms = (phone, text) => { __f9Calls.sms.push({ phone, text }); };
    hjDocPrint = html => { __f9Calls.print.push(String(html)); return true; };
    hjDocDownload = (text, fname) => { __f9Calls.word.push(fname); };
    hjWarrantyShareHtml = async (name, html, fname) => { __f9Calls.html.push(fname); return true; };
    __mobileMode = true; applyMobileMode();
  });
  async function test(name, fn) { await fn(); passed++; console.log('PASS forms-v572 ' + name); }
  async function close() {
    await page.evaluate(() => closeModal(true));
    await page.waitForFunction(() => typeof __mobileSheetHistoryRetire === 'undefined' || !__mobileSheetHistoryRetire);
  }
  const footer = text => page.locator('#modalRoot .mfoot button', { hasText: text });
  async function seed() {
    await close();
    await page.evaluate(async ({ full, bare, qonly, cust, worker, sub }) => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue; __tabStale = false; __appVersionUpdating = false;
      state._demo = false; state.dirHandle = null; state.dirty = false; state.editingQuote = null;
      state.files = []; state.notes = []; state.schedule = []; state.quotes = []; state.payLog = []; state.asLog = []; state.contacts = []; state.suppliers = []; state.expenses = [];
      const day = localDate(), ym = day.slice(0, 7), d1 = ym + '-01', d2 = ym + '-02';
      const project = (name, stage) => ({ name, kind: 'interior', stage, phases: [], customer: {}, received: 0, archived: false, cost: { material: 0, labor: 0, outsource: 0 } });
      const p = project(full, 3); p.customer = { ...cust }; p.received = 5500000; p.doneAt = d2;
      p.contractLog = [{ at: d1 + 'T03:00:00.000Z', amount: 11000000, contractNo: 'TEST-CT-0001', contractId: 'TEST_CONTRACT_ID', status: 'SENT', serverStatus: 'COMPLETED', vatIncluded: true }];
      p.extras = [{ id: 'TEST_EX_1', date: d2, text: '베란다 방수 추가', amount: '300000', days: 2, agreed: true }, { id: 'TEST_EX_2', date: d2, text: '콘센트 이설', amount: '', days: 0, agreed: false }];
      p.subQuotes = [{ id: 'TEST_SQ_1', sup: sub.name, trade: '타일', at: d1 + 'T04:00:00.000Z', items: ['욕실 벽 타일 시공'], when: '', status: 'picked', amount: 1200000 }];
      const b = project(bare, 0);
      const q = project(qonly, 1); q.customer = { name: 'TEST_CUSTOMER_Q', phone: '', addr: '' };
      state.projects = [p, q, b];
      state.quotes = [
        { id: 'TEST_F9_QUOTE', project: full, title: 'TEST_FULL_QUOTE', no: 'TEST-Q-001', date: d1, items: [{ name: '욕실 타일', spec: '식', qty: 1, price: 5000000 }, { name: '도배', spec: '식', qty: 1, price: 5000000 }], vatIncluded: true },
        { id: 'TEST_F9_QUOTE_EXC', project: qonly, title: 'TEST_EXC_QUOTE', no: 'TEST-Q-002', date: d1, items: [{ name: '몰딩', spec: 'm', qty: 10, price: 100000 }], vatIncluded: false }];
      state.quotes.forEach(x => syncQuoteToProject(x));   // files 를 다 채운 뒤(v555 주의)
      state.payLog = [{ id: 'TEST_F9_PAY', d: d1, project: full, amt: 5500000, method: '계좌이체' }];
      state.schedule = [
        { id: 'TEST_F9_SCH_1', project: full, title: '타일 시공', date: d1, time: '09:00', labor: { by: { [worker.name]: { days: 1, rate: 250000 } }, amount: 250000, names: worker.name } },
        { id: 'TEST_F9_SCH_2', project: full, title: '도배', date: d2, time: '09:00', labor: { by: { [worker.name]: { days: 0.5, rate: 250000 } }, amount: 125000, names: worker.name } }];
      state.asLog = [{ id: 'TEST_F9_AS', project: full, date: day, text: '욕실 실리콘 들뜸', status: 'open', visitAt: day, fix: '실리콘 재시공', fee: '50000', warrantyItem: '방수', verdict: { result: 'paid', reasons: ['TEST'], at: day } }];
      state.contacts = [{ id: 'TEST_F9_CONTACT', name: worker.name, phone: worker.phone, team: true, trade: '타일', dayRate: 250000, rrn: worker.rrn, account: worker.account }];
      state.suppliers = [{ name: sub.name, phone: sub.phone, category: '외주', memo: '', items: '타일', trade: '타일', lead: sub.lead, rate: { type: 'day', amount: 300000 } }];
      state.activeProject = full; state.tab = 'project'; state.search = ''; __photoCache.key = null; __sel.clear(); __selMode = false;
      __relay.url = ''; __relay.token = ''; __gdToken = null; for (const k of Object.keys(__f9Calls)) __f9Calls[k] = [];
      render(); syncMobileNav(); clearTimeout(__idbSaveTimer);
      if (!(await guardedPersistCurrentState())) throw Error('TEST_V572_SEED_SAVE_FAILED');
    }, { full: FULL, bare: BARE, qonly: QONLY, cust: CUST, worker: WORKER, sub: SUB });
  }
  async function snapshot() {
    return page.evaluate(async () => {
      clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
      const live = serializeData(); live.savedAt = '';
      return { live: paidStableJson(live), stored: paidStableJson(await idbGetStrict('appState')), keys: Object.keys(live).sort() };
    });
  }
  function sameSnapshot(actual, expected, label = 'serialized state remains unchanged') {
    const changed = [];
    for (const section of ['live', 'stored']) {
      if (actual[section] === expected[section]) continue;
      const a = JSON.parse(actual[section]), b = JSON.parse(expected[section]);
      for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) if (JSON.stringify((a || {})[key]) !== JSON.stringify((b || {})[key])) changed.push(section + '.' + key);
    }
    if (JSON.stringify(actual.keys) !== JSON.stringify(expected.keys)) changed.push('keys');
    assert.deepEqual(changed, [], label + ' (changed field names only)');
  }
  /* 문서 HTML → 보이는 글(공백 정리) · 표식 줄의 □/☑ · 표식 칸의 글 */
  const probe = (html, sels) => page.evaluate(({ html, sels }) => {
    const doc = new DOMParser().parseFromString(html, 'text/html'); doc.querySelectorAll('style,.pbar').forEach(n => n.remove()); doc.querySelectorAll('div,p,td,th,tr,h1,br,table,.sg,.hd span').forEach(n => { n.before(' '); n.after(' '); });   // 칸·줄 경계는 빈칸 하나(textContent 는 붙여 버린다)
    const norm = t => String(t || '').replace(/\s+/g, ' ').trim(), out = { text: norm(doc.body.textContent), boxes: {}, cells: {}, on: Array.from(doc.querySelectorAll('[data-f9-box="1"]')).length };
    (sels || []).forEach(sel => { const nodes = Array.from(doc.querySelectorAll(sel)); out.cells[sel] = nodes.map(n => norm(n.textContent)); out.boxes[sel] = nodes.map(n => Array.from(n.querySelectorAll('[data-f9-box]')).map(b => b.dataset.f9Box).join('')); });
    return out;
  }, { html, sels });
  const norm = t => String(t).replace(/\s+/g, ' ').trim();
  const build = (name, key, input) => page.evaluate(({ name, key, input }) => { const p = state.projects.find(x => x.name === name), m = hjForm9Model(p, key, input || {}); return { html: HJ_FORM9_HTML[key](m), no: m.no, fill: m.fill.slice() }; }, { name, key, input });
  const previewHtml = () => page.locator('#modalRoot iframe').getAttribute('srcdoc');
  const tapOk = async selector => {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).map(n => ({ h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width, id: n.id || n.textContent.slice(0, 12) })));
    assert(sizes.length, selector + ' rendered'); assert(sizes.every(s => s.h >= 44 && s.w >= 44), 'TAP_44 ' + selector + ' ' + JSON.stringify(sizes.filter(s => s.h < 44 || s.w < 44)));
  };
  const noOverflow = async label => {
    assert(await page.locator('#modalRoot .modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'NO_OVERFLOW_390 modal ' + label);
    assert(await page.locator('#modalRoot .mbody').evaluate(n => n.scrollWidth <= n.clientWidth + 1), 'NO_OVERFLOW_390 body ' + label);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'NO_OVERFLOW_390 page ' + label);
  };
  const openForm = async (name, key) => {
    await close(); await page.evaluate(n => docHubView(n), name);
    const btn = page.locator('#modalRoot .docHubBtn[data-act="form9:' + key + '"]'); await btn.waitFor(); await btn.click(); await page.locator('#hjForm9').waitFor();
  };
  const company = await page.evaluate(() => ({ name: COMPANY.name, owner: COMPANY.owner, bizno: COMPANY.bizno, tel: COMPANY.tel, addr: COMPANY.addr, accounts: COMPANY.accounts.map(a => a.no) }));

  await test('① 📎 서류 만들기에 9종 묶음 — 모두 열리고 제목·조항 글자가 양식 그대로, 390px 넘침 0·44px', async () => {
    await seed(); const before = await snapshot();
    await page.evaluate(name => docHubView(name), FULL); await page.locator('#modalRoot .docHubBtn').first().waitFor();
    const groups = await page.locator('#modalRoot .docHubGroup').allInnerTexts();
    assert(groups.includes('📑 계약·확인 양식(9종)'), 'FORMS9_GROUP ' + JSON.stringify(groups));
    assert.deepEqual(await page.locator('#modalRoot .docHubBtn[data-act^="form9:"]').evaluateAll(nodes => nodes.map(n => n.dataset.act)), KEYS.map(k => 'form9:' + k), 'FORMS9_NINE_ITEMS');
    await tapOk('#modalRoot .docHubBtn[data-act^="form9:"]'); await noOverflow('docHub');
    const hubText = await page.locator('#modalRoot .mbody').innerText();
    assert.match(hubText, /「🖊 추가공사 확인」 기록을 골라 담는 합의서 양식/, '03 relation line'); assert.match(hubText, /「🧰 수리·작업 확인서」와 다른 AS 전용 양식/, '08 relation line');
    assert.match(hubText, /채워짐 \d+칸/, 'filled status'); assert.doesNotMatch(hubText, /무료|최고|최저가/, 'no unconditional claims');
    for (const key of KEYS) {
      await openForm(FULL, key);
      await noOverflow('form ' + key); await tapOk('#hjForm9 input:not([type=checkbox]), #hjForm9 select, #hjForm9 textarea, #modalRoot .mfoot button');
      assert.equal(await page.locator('#hjForm9 input, #hjForm9 textarea, #hjForm9 select').evaluateAll(nodes => nodes.filter(n => n.type !== 'checkbox' && parseFloat(getComputedStyle(n).fontSize) < 16).length), 0, 'INPUT_16 ' + key);
      await footer('미리보기·내보내기').click(); await page.locator('#hjDocPdf').waitFor();
      for (const id of ['#hjDocPdf', '#hjDocWord', '#hjDocHtml']) assert.equal(await page.locator(id).count(), 1, key + ' ' + id);
      await tapOk('#hjDocPdf, #hjDocWord, #hjDocHtml'); await noOverflow('deliver ' + key);
      const r = await probe(await previewHtml());
      for (const phrase of PHRASES[key]) assert(r.text.includes(norm(phrase)), 'FORM_TEXT_VERBATIM ' + key + ' — ' + phrase.slice(0, 40));
      assert(r.text.startsWith(norm(company.name + ' No. ' + PREFIX[key] + '-')), 'FORM_HEADER ' + key + ' — ' + r.text.slice(0, 40));
      assert(r.text.includes(norm(company.name + ' · 대표 ' + company.owner + ' · 사업자등록번호 ' + company.bizno + ' · ' + company.addr + ' · ' + company.tel)), 'FORM_FOOTER_COMPANY ' + key);
      assert(r.text.includes('양식 0' + (KEYS.indexOf(key) + 1) + ' · ' + PHRASES[key][0] + ' · 2026.11'), 'FORM_FOOTER_EDITION ' + key);
      assert.match(r.text, /\(서명\)/, 'signature slot ' + key);
    }
    const c = await probe((await build(FULL, 'contract')).html);
    for (let i = 1; i <= 13; i++) assert(c.text.includes('제' + i + '조('), 'CONTRACT_13_ARTICLES ' + i);
    const fin = await page.evaluate(name => { const p = state.projects.find(x => x.name === name), d = new DOMParser().parseFromString(HJ_FORM9_HTML.finish(hjForm9Model(p, 'finish', {})), 'text/html'); return d.querySelectorAll('[data-f9-rows] tbody tr').length; }, FULL);
    assert.equal(fin, 13, 'finish 13 rows');
    await close(); sameSnapshot(await snapshot(), before, 'PREVIEW_DOES_NOT_ISSUE (9 forms opened)');
  });

  await test('② 앱 자료로 채우는 칸 · 모르는 칸은 빈칸(지어내지 않음)', async () => {
    await seed();
    const exp = await page.evaluate(name => { const p = state.projects.find(x => x.name === name), w = hjWarranty(p), it = w.items.find(x => x.name === '방수'), day = localDate(), ym = day.slice(0, 7), fmt = d => d.replace(/-/g, '. ') + '.'; return { d1: fmt(ym + '-01'), d2: fmt(ym + '-02'), day: fmt(day), wEnd: fmt(it.expiresAt), ko: (() => { const a = day.split('-'); return a[0] + '년 ' + Number(a[1]) + '월 ' + Number(a[2]) + '일'; })(), md1: ym.slice(5) + '.01', md2: ym.slice(5) + '.02' }; }, FULL);
    // 01 계약서 — 서명 계약 기록 금액·부가세, 견적 번호·품목, 일정 범위, 대금 지급 50/40/10
    let r = await probe((await build(FULL, 'contract')).html, ['[data-f9-amount]', '[data-f9-period]', '[data-f9-pay] tbody tr']);
    assert(r.text.includes(FULL) && r.text.includes(CUST.name) && r.text.includes(CUST.phone) && r.text.includes(CUST.addr), 'contract customer');
    assert(r.text.includes('별첨 견적서(No. TEST-Q-001)') && r.text.includes('첨부: 견적서 1부 (No. TEST-Q-001)') && r.text.includes('욕실 타일, 도배'), 'contract quote no·scope');
    assert.match(r.cells['[data-f9-amount]'][0], /일금 일천일백만 원정 \(₩ 11,000,000 \)/, 'CONTRACT_AMOUNT ' + r.cells['[data-f9-amount]'][0]); assert.equal(r.boxes['[data-f9-amount]'][0], '10', 'CONTRACT_VAT_FROM_SIGNED_LOG');
    assert.equal(r.cells['[data-f9-period]'][0], norm('공사기간 착공 ' + exp.d1 + ' ~ 준공 ' + exp.d2 + ' ( 2 일간)'), 'CONTRACT_PERIOD_FROM_SCHEDULE');
    assert.deepEqual(r.cells['[data-f9-pay] tbody tr'].slice(0, 3), ['계약금 50% 5,500,000 원 계약 체결 시', '중도금 40% 4,400,000 원 주요 공정 완료를 갑이 확인한 때', '잔금 10% 1,100,000 원 준공 및 하자 마무리 확인 후'], 'CONTRACT_PAY_PLAN');
    for (const no of company.accounts) assert(r.cells['[data-f9-pay] tbody tr'][3].includes(no), 'contract accounts from COMPANY');
    assert.equal(r.boxes['[data-f9-pay] tbody tr'][3], '00', 'account boxes stay unchecked'); assert(r.text.includes('계약일 ' + exp.ko), 'sign day = today');
    // 견적만 있는 현장(부가세 별도) — 금액은 세액을 뺀 견적 금액 + □ 별도
    r = await probe((await build(QONLY, 'contract')).html, ['[data-f9-amount]', '[data-f9-period]']);
    assert.match(r.cells['[data-f9-amount]'][0], /₩ 1,000,000 \)/, 'QUOTE_EXCL_AMOUNT ' + r.cells['[data-f9-amount]'][0]); assert.equal(r.boxes['[data-f9-amount]'][0], '01', 'QUOTE_EXCL_BOX');
    assert.doesNotMatch(r.cells['[data-f9-period]'][0], /\d{4}\. \d{2}/, 'no schedule → blank period');
    // 자료 없는 현장 — 금액·부가세·기간·고객 전부 빈칸
    r = await probe((await build(BARE, 'contract')).html, ['[data-f9-amount]', '[data-f9-period]', '[data-f9-pay] tbody tr']);
    assert.equal(r.cells['[data-f9-amount]'][0], norm('계약금액 일금 원정 (₩ ) □ 부가세 포함 □ 부가세 별도'), 'BARE_AMOUNT_BLANK ' + r.cells['[data-f9-amount]'][0]);
    assert.equal(r.boxes['[data-f9-amount]'][0], '00', 'BARE_VAT_UNCHECKED'); assert.equal(r.on, 0, 'BARE_NO_CHECKED_BOX');
    assert.equal(r.cells['[data-f9-period]'][0], norm('공사기간 착공 20 . . . ~ 준공 20 . . . ( 일간)'), 'BARE_PERIOD_BLANK'); assert.equal(r.cells['[data-f9-pay] tbody tr'][0], '계약금 50% 원 계약 체결 시', 'BARE_PAY_BLANK');
    assert.doesNotMatch(r.text.replace(company.bizno, '').replace(company.tel, '').replace('15,000,000원', ''), /\d{1,3}(,\d{3})+/, 'BARE_NO_INVENTED_MONEY');
    for (const key of KEYS) { const x = await build(BARE, key); const t = await probe(x.html); assert.equal(t.on, 0, 'BARE_NO_CHECKED_BOX ' + key); assert(!t.text.includes(CUST.name), 'bare has no other customer ' + key); }
    // 03 합의서 — 추가공사 기록·차수·합계
    r = await probe((await build(FULL, 'change')).html, ['[data-f9-amount]', '[data-f9-rows] tbody tr']);
    assert.match(r.cells['[data-f9-amount]'][0], /^원 계약금액 11,000,000 원/, 'change base amount'); assert.equal(r.boxes['[data-f9-amount]'][0], '10');
    assert.equal(r.cells['[data-f9-rows] tbody tr'][0], '1 추가 · 변경 · 감액 베란다 방수 추가 300,000', 'CHANGE_ROW_1'); assert.equal(r.cells['[data-f9-rows] tbody tr'][1], '2 추가 · 변경 · 감액 콘센트 이설', 'CHANGE_ROW_2 금액 협의는 빈칸');
    assert.equal(r.cells['[data-f9-rows] tbody tr'][6], '증감 합계 (감액은 − 로 표시) 300,000 원'); assert.equal(r.cells['[data-f9-rows] tbody tr'][7], '변경 후 총 계약금액 (원 계약금액 ± 증감 합계) 11,300,000 원');
    assert(r.text.includes('합의 차수 제 1 차') && r.text.includes('2 일 연장'), 'change round·days');
    // 05 외주 — 고른 팀·받은 금액·공종
    r = await probe((await build(FULL, 'subwork', { supName: SUB.name })).html, ['[data-f9-amount]']);
    assert(r.text.includes(SUB.name) && r.text.includes(SUB.lead) && r.text.includes(SUB.phone) && r.text.includes('욕실 벽 타일 시공'), 'SUBWORK_FROM_SUPPLIER');
    assert.match(r.cells['[data-f9-amount]'][0], /^금액 금 1,200,000 원/, 'SUBWORK_AMOUNT_FROM_SUBQUOTE'); assert.equal(r.boxes['[data-f9-amount]'][0], '00', 'subwork vat unknown'); assert.equal(r.on, 1, 'only 타일 trade box');
    assert(!r.text.includes(CUST.name) && !r.text.includes(CUST.phone), 'SUBWORK_NO_CUSTOMER_NAME_PHONE');
    r = await probe((await build(FULL, 'subwork')).html, ['[data-f9-amount]']); assert.equal(r.cells['[data-f9-amount]'][0], norm('금액 금 원 □ 부가세 포함 □ 부가세 별도'), 'subwork without team is blank');
    // 06·07 근로자 — 명단 일당·그 달 장부 공수
    r = await probe((await build(FULL, 'daylabor', { worker: WORKER.name })).html, ['[data-f9-wage]']);
    assert(r.text.includes('와 ' + WORKER.name + ' (이하 "근로자")') && r.text.includes(WORKER.phone) && r.text.includes('작업: 타일'), 'DAYLABOR_FROM_CONTACT'); assert.match(r.cells['[data-f9-wage]'][0], /^6\. 임금 일급 250,000 원/, 'DAYLABOR_RATE');
    r = await probe((await build(FULL, 'wagepay', { worker: WORKER.name })).html, ['[data-f9-rows] tbody tr', '[data-f9-pay] tr']);
    assert.equal(r.cells['[data-f9-rows] tbody tr'][0], norm(exp.md1 + ' ' + FULL + ' 타일 시공 1 250,000 250,000'), 'WAGE_LINE_1 ' + r.cells['[data-f9-rows] tbody tr'][0]);
    assert.equal(r.cells['[data-f9-rows] tbody tr'][1], norm(exp.md2 + ' ' + FULL + ' 도배 0.5 250,000 125,000'), 'WAGE_LINE_2'); assert.equal(r.cells['[data-f9-rows] tbody tr'][2], '.', 'unused rows blank');
    assert.equal(r.cells['[data-f9-rows] tbody tr'][10], '합계 1.5 375,000', 'WAGE_SUM'); assert.match(r.cells['[data-f9-pay] tr'][0], /^지급 총액 375,000 원 지급일 20 \. \. \.$/, 'WAGE_TOTAL·지급일 빈칸 ' + r.cells['[data-f9-pay] tr'][0]);
    // 08 AS — 접수·보증·판정·비용
    r = await probe((await build(FULL, 'asfix')).html, ['[data-f9-warranty]', '[data-f9-verdict]', '[data-f9-fee]']);
    assert(r.text.includes('접수일 ' + exp.day) && r.text.includes('욕실 실리콘 들뜸') && r.text.includes('실리콘 재시공') && r.text.includes('준공(인도)일 ' + exp.d2) && r.text.includes('방문일 ' + exp.day), 'ASFIX_FROM_ASLOG');
    assert.equal(r.cells['[data-f9-warranty]'][0], norm('보증기간 ☑ 방수 3년 □ 급배수 등 설비 2년 □ 마감 1년 → 만료일 ' + exp.wEnd), 'ASFIX_WARRANTY ' + r.cells['[data-f9-warranty]'][0]);
    assert.equal(r.boxes['[data-f9-verdict]'][0], '0100', 'ASFIX_VERDICT_FROM_RECORD'); assert.match(r.cells['[data-f9-fee]'][0], /^비용 □ 무상 ☑ 유상 50,000 원/, 'ASFIX_FEE'); assert(r.text.includes('접수번호 접수일'), '접수번호 빈칸');
    // 09 해제 — 받은 돈만, ②③④ 빈칸이면 ⑤ 도 빈칸
    r = await probe((await build(FULL, 'cancel')).html, ['[data-f9-settle] tbody tr', '[data-f9-amount]']);
    assert(r.text.includes('계약번호 TEST-CT-0001') && r.text.includes('계약일 ' + exp.d1), 'cancel contract log'); assert.equal(r.cells['[data-f9-settle] tbody tr'][0], '① 갑이 이미 지급한 금액 5,500,000 원', 'CANCEL_PAID_FROM_RECEIVED');
    assert.equal(r.cells['[data-f9-settle] tbody tr'][1], '② 이미 시공한 부분의 대금 원 □ 내역 별첨'); assert.equal(r.cells['[data-f9-settle] tbody tr'][4], '⑤ 정산 금액 ① − ( ② + ③ + ④ ) 원', 'CANCEL_SETTLE_BLANK_UNTIL_ALL_ENTERED ' + r.cells['[data-f9-settle] tbody tr'][4]);
    assert.equal(r.on, 1, 'cancel: only 부가세 포함 checked');
    r = await probe((await build(FULL, 'cancel', { doneAmt: '2,000,000', matAmt: '500000', etcAmt: '0' })).html, ['[data-f9-settle] tbody tr']);
    assert.equal(r.cells['[data-f9-settle] tbody tr'][4], '⑤ 정산 금액 ① − ( ② + ③ + ④ ) 3,000,000 원', 'CANCEL_SETTLE_COMPUTED'); assert(r.text.includes('☑ 을이 갑에게 돌려줌 (⑤가 플러스)'), 'cancel direction');
    // 입력 화면에서 고친 값·지운 값이 이긴다 + 빈 양식 그대로
    await openForm(FULL, 'contract');
    assert.equal(await page.locator('#f9CustName').inputValue(), CUST.name); assert.equal(await page.locator('#f9Amount').inputValue(), '11,000,000');
    await page.locator('#f9CustName').fill(''); await page.locator('#f9Amount').fill('12,345,000'); await page.locator('#f9Vat').selectOption('exc');
    await footer('미리보기·내보내기').click(); await page.locator('#hjDocPdf').waitFor();
    r = await probe(await previewHtml(), ['[data-f9-amount]', '[data-f9-pay] tbody tr']);
    assert.match(r.cells['[data-f9-amount]'][0], /₩ 12,345,000 \)/); assert.equal(r.boxes['[data-f9-amount]'][0], '01'); assert(!r.text.includes(CUST.name), 'cleared name stays blank');
    assert.deepEqual(r.cells['[data-f9-pay] tbody tr'].slice(0, 3).map(t => t.split(' ')[2]), ['6,172,500', '4,938,000', '1,234,500'], 'pay plan sums to total');
    await footer('뒤로').click(); await page.locator('#hjForm9').waitFor();
    assert.equal(await page.locator('#f9Amount').inputValue(), '12,345,000', 'back keeps typed values'); assert.equal(await page.locator('#f9CustName').inputValue(), '');
    await footer('빈 양식 그대로').click(); await page.locator('#hjDocPdf').waitFor();
    r = await probe(await previewHtml(), ['[data-f9-amount]']);
    assert.equal(r.on, 0, 'BLANK_FORM_NO_BOX'); assert(!r.text.includes(CUST.name) && !r.text.includes(FULL) && !r.text.includes('TEST-Q-001') && !r.text.includes('12,345,000'), 'BLANK_FORM_EMPTY');
    assert(r.text.includes(company.bizno) && r.text.includes('계약일 20 년 월 일'), 'blank form keeps company, sign day blank');
    for (const phrase of PHRASES.contract) assert(r.text.includes(norm(phrase)), 'blank form text ' + phrase.slice(0, 30));
    // 근로자·외주팀·AS 는 명단에서 고르면 채워진다
    await openForm(FULL, 'daylabor'); assert.equal(await page.locator('#f9WName').inputValue(), '');
    await page.locator('#f9Worker').selectOption(WORKER.name); await page.waitForFunction(n => (document.querySelector('#f9WName') || {}).value === n, WORKER.name);
    assert.equal(await page.locator('#f9DayRate').inputValue(), '250,000'); assert.equal(await page.locator('#f9WPhone').inputValue(), WORKER.phone);
    await openForm(FULL, 'subwork'); await page.locator('#f9Sup').selectOption(SUB.name); await page.waitForFunction(n => (document.querySelector('#f9SubName') || {}).value === n, SUB.name);
    assert.equal(await page.locator('#f9Amount').inputValue(), '1,200,000'); assert.equal(await page.locator('#f9SubLead').inputValue(), SUB.lead);
    await openForm(FULL, 'asfix'); assert.equal(await page.locator('#f9As').inputValue(), 'TEST_F9_AS'); assert.equal(await page.locator('#f9Fix').inputValue(), '실리콘 재시공');
    await close();
  });

  await test('③ 주민등록번호·계좌·세액 칸은 늘 빈칸 — 입력칸도 없고 저장도 안 한다', async () => {
    await seed();
    const digits = /\d/;
    for (const input of [{ worker: WORKER.name }, { worker: WORKER.name, wName: WORKER.name, payTotal: '375000', payDay: await page.evaluate(() => localDate()) }]) {
      const r = await probe((await build(FULL, 'wagepay', input)).html, ['[data-f9-rrn]', '[data-f9-account]', '[data-f9-tax]']);
      assert.equal(r.cells['[data-f9-rrn]'].length, 1); assert.doesNotMatch(r.cells['[data-f9-rrn]'][0], digits, 'RRN_ALWAYS_BLANK ' + r.cells['[data-f9-rrn]'][0]); assert.equal(r.cells['[data-f9-rrn]'][0], '–');
      assert.equal(r.cells['[data-f9-account]'][0], '은행 계좌번호 예금주(본인)', 'WAGE_ACCOUNT_ALWAYS_BLANK ' + r.cells['[data-f9-account]'][0]);
      assert.deepEqual(r.cells['[data-f9-tax]'], ['원', '원', '원'], 'TAX_CELLS_HANDWRITTEN ' + JSON.stringify(r.cells['[data-f9-tax]']));
      assert(!r.text.includes('900101') && !r.text.includes('1234567') && !r.text.includes('111-2222'), 'WAGE_NO_RRN_ACCOUNT_ANYWHERE'); assert(r.text.includes(WORKER.name), 'worker name is filled');
    }
    let r = await probe((await build(FULL, 'daylabor', { worker: WORKER.name })).html);
    assert(!r.text.includes('900101') && !r.text.includes('111-2222'), 'DAYLABOR_NO_RRN_ACCOUNT'); assert(r.text.includes('생년월일 연락처'), 'birth date blank');
    for (const input of [{}, { doneAmt: '0', matAmt: '0', etcAmt: '0', payBy: await page.evaluate(() => localDate()) }]) {
      r = await probe((await build(FULL, 'cancel', input)).html, ['[data-f9-account]']);
      assert.equal(r.cells['[data-f9-account]'][0], '은행 계좌번호 예금주', 'CANCEL_ACCOUNT_ALWAYS_BLANK ' + r.cells['[data-f9-account]'][0]);
      for (const no of company.accounts) assert(!r.text.includes(no), 'cancel never shows company account');
    }
    for (const key of ['daylabor', 'wagepay', 'cancel']) {
      await openForm(FULL, key);
      if (key !== 'cancel') { await page.locator('#f9Worker').selectOption(WORKER.name); await page.waitForFunction(n => (document.querySelector('#f9WName') || {}).value === n, WORKER.name); }
      const fields = await page.locator('#hjForm9 label').evaluateAll(nodes => nodes.map(n => n.textContent));
      assert.equal(fields.filter(t => /주민|계좌|소득세|실지급/.test(t)).length, 0, 'NO_RRN_ACCOUNT_INPUT ' + key + ' ' + JSON.stringify(fields));
      assert.equal(await page.locator('#hjForm9 input, #hjForm9 textarea').evaluateAll(nodes => nodes.filter(n => /900101|111-2222/.test(n.value)).length), 0, 'no rrn/account in inputs ' + key);
    }
    // 07 을 가져가도 발행 기록·노트에 주민번호·계좌가 없다
    await openForm(FULL, 'wagepay'); await page.locator('#f9Worker').selectOption(WORKER.name); await page.waitForFunction(n => (document.querySelector('#f9WName') || {}).value === n, WORKER.name);
    await footer('미리보기·내보내기').click(); await page.locator('#hjDocWord').waitFor(); await page.locator('#hjDocWord').click();
    await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).some(d => d.type === 'wagepay'), FULL);
    const rec = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name), stored = await idbGetStrict('appState'); return { docs: JSON.stringify(p.docs), notes: JSON.stringify(state.notes), project: JSON.stringify(stored.projects.find(x => x.name === name)), word: __f9Calls.word.slice() }; }, FULL);
    assert.doesNotMatch(rec.docs + rec.notes + rec.project, /900101|1234567|111-2222/, 'ISSUE_RECORD_NO_RRN_ACCOUNT'); assert.match(rec.docs, /"type":"wagepay"/); assert.match(rec.docs, /WP-\d{8}-01/); assert.equal(rec.word.length, 1); assert.match(rec.word[0], /노임 지급 확인서_WP-\d{8}-01\.doc$/);
    await close();
  });

  await test('④ 발행 기록은 실제로 가져간 때만 — 미리보기·입력은 저장본 불변, 번호 한 번, 최상위 키 그대로', async () => {
    await seed(); const before = await snapshot();
    await openForm(FULL, 'contract'); await page.locator('#f9Scope').fill('TEST_SCOPE_EDIT'); await footer('미리보기·내보내기').click(); await page.locator('#hjDocPdf').waitFor();
    const r0 = await probe(await previewHtml()); assert.match(r0.text, /No\. CT-\d{8}-01/); assert(r0.text.includes('TEST_SCOPE_EDIT'));
    sameSnapshot(await snapshot(), before, 'PREVIEW_DOES_NOT_ISSUE'); assert.equal(await page.evaluate(name => (state.projects.find(x => x.name === name).docs || []).length, FULL), 0, 'PREVIEW_DOES_NOT_ISSUE docs');
    await footer('뒤로').click(); await page.locator('#hjForm9').waitFor(); await footer('닫기').click();
    await page.waitForFunction(() => !document.querySelector('#modalRoot .modal')); sameSnapshot(await snapshot(), before, 'open·type·close does not save');
    await openForm(FULL, 'contract'); await footer('미리보기·내보내기').click(); await page.locator('#hjDocPdf').waitFor();
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).length === 1, FULL);
    const issued = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; const p = state.projects.find(x => x.name === name), stored = await idbGetStrict('appState'); return { docs: p.docs, notes: state.notes.filter(n => n.text.startsWith('[문서]')), storedDocs: stored.projects.find(x => x.name === name).docs, prints: __f9Calls.print.length, keys: Object.keys(serializeData()).sort() }; }, FULL);
    assert.equal(issued.prints, 1); assert.equal(issued.docs[0].type, 'contract'); assert.match(issued.docs[0].no, /^CT-\d{8}-01$/); assert.equal(issued.docs[0].purpose, 'pdf'); assert.equal(issued.docs[0].name, '공사도급계약서');
    assert.equal(issued.notes.length, 1); assert.match(issued.notes[0].text, /^\[문서\] 공사도급계약서 발행 · CT-\d{8}-01/); assert.deepEqual(issued.storedDocs, issued.docs); assert.deepEqual(issued.keys, before.keys, 'NO_NEW_TOP_LEVEL_KEYS');
    await page.locator('#hjDocPdf').click(); await page.waitForFunction(() => __f9Calls.print.length === 2);
    await page.locator('#hjDocWord').click(); await page.waitForFunction(() => __f9Calls.word.length === 1);
    await page.evaluate(async () => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; });
    assert.equal(await page.evaluate(name => state.projects.find(x => x.name === name).docs.length, FULL), 1, 'ISSUE_ONCE_PER_NUMBER');
    assert.equal(await page.evaluate(() => hjDocNextNo('CT')).then(no => /-02$/.test(no)), true, 'next number advances'); assert.equal(await page.evaluate(() => hjDocNextNo('WC')).then(no => /-01$/.test(no)), true, 'other prefixes untouched');
    // 다른 양식은 자기 접두 · HTML 공유도 기록 · 빈 양식은 purpose 에 표시
    await openForm(FULL, 'asfix'); await footer('빈 양식 그대로').click(); await page.locator('#hjDocHtml').waitFor(); await page.locator('#hjDocHtml').click();
    await page.waitForFunction(name => (state.projects.find(x => x.name === name).docs || []).some(d => d.type === 'asfix'), FULL);
    const two = await page.evaluate(async name => { clearTimeout(__idbSaveTimer); await __appStateWriteQueue; return { docs: state.projects.find(x => x.name === name).docs, html: __f9Calls.html.slice() }; }, FULL);
    assert.deepEqual(two.docs.map(d => d.type), ['contract', 'asfix']); assert.match(two.docs[1].no, /^AF-\d{8}-01$/); assert.equal(two.docs[1].purpose, 'html·빈양식'); assert.equal(two.html.length, 1);
    await close(); await page.evaluate(name => docHubView(name), FULL); await page.locator('#modalRoot .docHubBtn[data-act="form9:contract"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="form9:contract"] .docHubStatus').innerText(), /^발행 CT-\d{8}-01 · \d{4}-\d{2}-\d{2}$/, 'hub shows issued number');
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="form9:finish"] .docHubStatus').innerText(), /채워짐 \d+칸/);
    await close(); await page.evaluate(name => docHubView(name), BARE); await page.locator('#modalRoot .docHubBtn[data-act="form9:photoconsent"]').waitFor();
    assert.match(await page.locator('#modalRoot .docHubBtn[data-act="form9:cancel"] .docHubStatus').innerText(), /^빈 양식/, 'BARE_STATUS_BLANK'); assert.match(await page.locator('#modalRoot .docHubBtn[data-act="form9:subwork"] .docHubStatus').innerText(), /^빈 양식/);
    const types = await page.evaluate(() => ({ types: Object.keys(HJ_DOC433_TYPES), prefixes: Object.values(HJ_DOC433_TYPES).map(x => x.prefix), ok: Object.values(HJ_DOC433_TYPES).every(x => HJ_DOC433_NO_RE.test(x.prefix + '-20261110-01')), apt: ['AA', 'AN', 'AP', 'AC', 'LR'].some(x => HJ_DOC433_NO_RE.test(x + '-20261110-01')) }));
    assert.equal(new Set(types.prefixes).size, types.prefixes.length, 'ISSUE_PREFIX_UNIQUE'); assert.equal(types.ok, true, 'every type prefix is numberable'); assert.equal(types.apt, false, 'v441·v422 prefixes stay separate');
    for (const key of KEYS) assert.equal(types.prefixes[types.types.indexOf(key)], PREFIX[key], 'prefix ' + key);
    await close();
  });

  await test('⑤ 계약·오류 0·외부 쓰기 0·핀 세 곳 일치·원본은 Pages 에 안 실림', async () => {
    assert.deepEqual(errors, [], 'pageerror 0'); assert.equal(network.writes, 0, 'external writes 0');
    const calls = await page.evaluate(() => ({ external: __f9Calls.external.length, sms: __f9Calls.sms.length })); assert.deepEqual(calls, { external: 0, sms: 0 }, 'no share·sms·window.open');
    assert.equal(await page.evaluate(() => MORE_CATS.reduce((sum, category) => sum + category.items.length, 0)), 126, 'more menu 126');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
    const build = (html.match(/const APP_BUILD='([^']+)'/) || [])[1], target = (vs.match(/const TARGET_BUILD = '([^']+)'/) || [])[1];
    assert(build && build === target && sw.includes(build), 'PINS_IN_SYNC ' + build + ' / ' + target);
    if (!process.env.HJ_V572_BASELINE && !process.env.HJ_V572_MUTATION) {
      const fn = (html.match(/\nfunction hjForm9View\([\s\S]*?\n}\n/) || [''])[0], model = (html.match(/\nfunction hjForm9Model\([\s\S]*?\n}\n/) || [''])[0];
      assert(fn && model, 'source found'); assert.doesNotMatch(fn + model, /markDirty\(|durableLocalMutation\(|localStorage|idbSet\(/, 'FORM_VIEW_MODEL_READ_ONLY');
      assert.doesNotMatch(fn, /rrn|주민등록번호 *['"]\s*,/i, 'no rrn field in view');
      const stage = fs.readFileSync(path.join(ROOT, 'scripts', 'stage-pages.mjs'), 'utf8'); assert.doesNotMatch(stage, /문서양식|docs\//, 'DOCS_NOT_PUBLIC');
      const dir = path.join(ROOT, 'docs', '문서양식'); assert.equal(fs.readdirSync(path.join(dir, '워드(편집용)')).filter(f => f.endsWith('.docx')).length, 9); assert.equal(fs.readdirSync(path.join(dir, 'PDF(인쇄용)')).filter(f => f.endsWith('.pdf')).length, 9); assert(fs.existsSync(path.join(dir, 'README.md')));
    }
  });
  console.log(`forms-v572: ${passed}/${passed} PASS; synthetic data; real prints/sends=0; external writes=0`);
  await context.close();
})().catch(async error => { console.error('FAIL forms-v572', error.stack || error); try { console.error('modal:', await page.evaluate(() => (document.querySelector('#modalRoot') || {}).innerText || '').then(t => t.slice(0, 400))); } catch (_) {} process.exitCode = 1; })
  .finally(async () => { if (browser) await browser.close(); });

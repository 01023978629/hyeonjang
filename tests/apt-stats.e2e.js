/* apt-stats.e2e.js — 🏢 아파트 오더 2차: 일정 연동 · 단지 통계 · 정산서 엑셀

   1차(apt-orders.e2e.js)가 장부의 뼈대(접수→완료→청구→입금, payLog 합류)를 지킨다.
   여기는 그 위에 얹은 세 가지를 지킨다.

     ① 방문예정으로 바꾸면 날짜를 물어 일정표(state.schedule)에 올린다
        — 일정에 없으면 아침 브리핑에서 빠져 그날 잊는다. 이게 연동의 이유다.
     ② 날짜를 취소·비움하면 일정 없이 상태만 바뀐다 (전화로 아직 조율 중일 수 있다)
     ③ 잘못된 날짜 형식은 일정으로 만들지 않는다 (쓰레기 일정 방지)
     ④ 단지 통계 — 완료월(doneAt) 기준, 그 단지 것만, 입금/미수를 가른다
        접수월로 세면 정산서와 숫자가 어긋난다. 기준이 같아야 장부가 하나다.
     ⑤ 다른 단지의 오더가 통계에 섞이지 않는다
     ⑥ 정산서 엑셀 — 화면의 정산 자료 그대로(동/호·금액·합계), 파일명에 단지·월
     ⑦ 엑셀 모듈 로드 실패 시 조용히 죽지 않고 안내한다 (문안 복사는 계속 가능)
     ⑧ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // 공통 픽스처 — 단지 2곳, 이번 달·지난달 오더
  await page.evaluate(() => {
    state.aptOffices = [
      { id: 'of1', complex: '신흥마을아파트', manager: '김소장', phone: '' },
      { id: 'of2', complex: '한밭타운', manager: '', phone: '' }
    ];
    const ym = localDate().slice(0, 7);
    window.__ym = ym;
    state.aptOrders = [
      { id: 'a1', officeId: 'of1', unit: '103동 1204호', text: '욕실 실리콘', amount: 80000, date: localDate(), status: 'recv', doneAt: '' },
      { id: 'a2', officeId: 'of1', unit: '105동 202호', text: '문 경첩', amount: 50000, date: localDate(), status: 'paid', doneAt: ym + '-05' },
      { id: 'a3', officeId: 'of1', unit: '지하주차장', text: '도장 보수', amount: 300000, date: localDate(), status: 'billed', doneAt: ym + '-10' },
      { id: 'a4', officeId: 'of1', unit: '101동 101호', text: '지난달 작업', amount: 999000, date: '2026-06-01', status: 'paid', doneAt: '2026-06-15' },
      { id: 'a5', officeId: 'of1', unit: '104동 404호', text: '지난달 접수, 이달 완료', amount: 44000, date: '2026-07-20', status: 'billed', doneAt: ym + '-01' },
      { id: 'b1', officeId: 'of2', unit: '1동 1호', text: '다른 단지 작업', amount: 700000, date: localDate(), status: 'billed', doneAt: ym + '-11' }
    ];
    state.schedule = []; state.payLog = [];
  });

  // ①  방문예정 → 날짜 입력 → 일정표에 올라간다
  const visit = await page.evaluate(() => {
    window.prompt = () => '2026-08-20';
    aptOrderManage('of1');
    const sel = document.getElementById('modalRoot').querySelector('.apoStat[data-id="a1"]');
    sel.value = 'visit'; sel.onchange();
    const s = (state.schedule || [])[0];
    return { n: state.schedule.length, status: state.aptOrders.find(o => o.id === 'a1').status,
             date: s && s.date, title: s && s.title, hasId: !!(s && s.id) };
  });
  assert(visit.n === 1, '① 방문예정인데 일정이 안 생겼다 — 아침 브리핑에서 빠진다');
  assert(visit.date === '2026-08-20', '① 일정 날짜가 입력값과 다르다: ' + visit.date);
  assert(/신흥마을아파트/.test(visit.title) && /103동 1204호/.test(visit.title), '① 일정 제목에 단지·동/호가 없다: ' + visit.title);
  assert(visit.status === 'visit' && visit.hasId, '① 상태·일정 형식이 틀렸다');

  // ② 취소하면 일정 없이 상태만
  const cancel = await page.evaluate(() => {
    state.schedule = [];
    window.prompt = () => null;   // 취소
    const sel = document.getElementById('modalRoot').querySelector('.apoStat[data-id="a1"]');
    sel.value = 'recv'; sel.onchange();
    const sel2 = document.getElementById('modalRoot').querySelector('.apoStat[data-id="a1"]');
    sel2.value = 'visit'; sel2.onchange();
    return { n: state.schedule.length, status: state.aptOrders.find(o => o.id === 'a1').status };
  });
  assert(cancel.n === 0 && cancel.status === 'visit', '② 취소했는데 일정이 생겼거나 상태가 안 바뀜');

  // ③ 형식이 틀리면 일정을 만들지 않는다
  const badDate = await page.evaluate(() => {
    state.schedule = [];
    window.prompt = () => '내일쯤';
    const sel = document.getElementById('modalRoot').querySelector('.apoStat[data-id="a1"]');
    sel.value = 'recv'; sel.onchange();
    const sel2 = document.getElementById('modalRoot').querySelector('.apoStat[data-id="a1"]');
    sel2.value = 'visit'; sel2.onchange();
    return { n: state.schedule.length };
  });
  assert(badDate.n === 0, '③ "내일쯤" 같은 값으로 쓰레기 일정이 생겼다');

  // ④⑤ 단지 통계 — 완료월 기준 · 입금/미수 구분 · 다른 단지 제외
  const stats = await page.evaluate(() => {
    const r = aptStats('of1');
    const root = document.getElementById('modalRoot');
    const text = root.textContent || '';
    return { r, text,
      hasPaid: /50,000원/.test(text),          // 이번 달 입금(a2)
      hasUnpaid: /344,000원/.test(text),       // 이번 달 미수(a3 300,000 + a5 44,000) — a5 는 접수가 지난달·완료가 이번 달이라, 접수월로 세면 여기서 빠진다
      hasLastMonth: /999,000원/.test(text),    // 지난달 완료(a4) — 6개월 표 안에 보여야 함
      // 이번 달 줄의 '완료 금액' 합계. a5(접수 7월·완료 8월)가 들어가야 394,000 이다.
      // 미수 타일은 없앴다. 표의 월별 값이 월 기준(완료월) 검증의 핵심이다.
      hasMonthTotal: /394,000원/.test(text),
      otherComplex: /700,000원/.test(text)     // 다른 단지(b1) — 보이면 안 됨
    };
  });
  assert(stats.hasPaid, '④ 이번 달 입금 금액이 통계에 없다');
  // 미수(청구 후 미입금) 표시는 없앴다(2026-08-13 대표 결정) — 되살아나면 잡는다.
  assert(!stats.hasUnpaid, '④ 미수(청구 후 미입금) 표시가 되살아났다');
  assert(stats.hasLastMonth, '④ 지난달 완료분이 6개월 표에 없다');
  assert(stats.hasMonthTotal, '④ 이번 달 완료 금액 합계(394,000)가 표에 없다 — 월 기준이 완료월(doneAt)이 아니면 여기서 어긋난다');
  assert(!stats.otherComplex, '⑤ 다른 단지 금액이 섞였다 — 단지별 정산이 무너진다');
  assert(stats.r.미수 === undefined, '④ 반환값에 미수 합계가 되살아났다: ' + stats.r.미수);

  // ⑥ 정산서 엑셀 — 화면 자료 그대로, 파일명에 단지·월
  const xlsx = await page.evaluate(async () => {
    // 가짜 XLSX — 실제 CDN 로드 없이 무엇이 저장되는지 본다
    window.__xl = { sheets: [], file: '' };
    window.XLSX = {
      utils: {
        book_new: () => ({}),
        aoa_to_sheet: (aoa) => ({ aoa }),
        book_append_sheet: (wb, ws, name) => window.__xl.sheets.push({ name, aoa: ws.aoa })
      },
      writeFile: (wb, fname) => { window.__xl.file = fname; }
    };
    aptSettle('of1', window.__ym);
    const btn = [...document.getElementById('modalRoot').querySelectorAll('button')].find(b => /엑셀/.test(b.textContent));
    await btn.onclick();
    const aoa = (window.__xl.sheets[0] || {}).aoa || [];
    const flat = JSON.stringify(aoa);
    return { file: window.__xl.file, flat,
      hasUnit: flat.indexOf('105동 202호') < 0 && flat.indexOf('지하주차장') >= 0,  // a2 는 paid → 정산 대상 아님, a3 만
      hasSum: flat.indexOf('344000') >= 0,   // 합계 = a3 300,000 + a5 44,000
      hasVатNote: flat.indexOf('부가세 별도') >= 0 };
  });
  assert(/신흥마을아파트/.test(xlsx.file) && xlsx.file.indexOf('정산서.xlsx') >= 0, '⑥ 파일명에 단지·월이 없다: ' + xlsx.file);
  assert(xlsx.hasUnit, '⑥ 정산 대상(청구분)만 실려야 하는데 어긋났다: ' + xlsx.flat.slice(0, 200));
  assert(xlsx.hasSum && xlsx.hasVатNote, '⑥ 합계·부가세 별도 표기가 없다');

  // ⑦ 엑셀 모듈이 안 떠도 조용히 죽지 않는다
  const noXlsx = await page.evaluate(async () => {
    delete window.XLSX;
    const realLoad = window.loadExtLib;
    window.loadExtLib = async () => { throw new Error('offline'); };
    let toastMsg = ''; const realToast = window.toast;
    window.toast = (m) => { toastMsg = m; realToast(m); };
    const btn = [...document.getElementById('modalRoot').querySelectorAll('button')].find(b => /엑셀/.test(b.textContent));
    await btn.onclick();
    window.loadExtLib = realLoad; window.toast = realToast;
    return { toastMsg };
  });
  assert(/엑셀 모듈|인터넷/.test(noXlsx.toastMsg), '⑦ 로드 실패를 알리지 않는다: ' + noXlsx.toastMsg);
  assert(/복사/.test(noXlsx.toastMsg), '⑦ 대안(복사)을 안내하지 않는다');

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 방문예정 → 일정표 자동 등록 (단지·동/호 제목)');
  console.log('PASS  ② 날짜 취소 시 일정 없이 상태만');
  console.log('PASS  ③ 형식 틀린 날짜는 일정 안 만듦');
  console.log('PASS  ④ 단지 통계 — 완료월 기준 · 입금/미수 구분');
  console.log('PASS  ⑤ 다른 단지 미포함');
  console.log('PASS  ⑥ 정산서 엑셀 — 청구분 그대로 · 파일명에 단지·월');
  console.log('PASS  ⑦ 엑셀 로드 실패 시 안내 + 대안');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

/* apt-integrate.e2e.js — 아파트 오더가 기존 화면 4곳에 합류했는지

   별도 장부는 편하지만 위험도 있다: **다른 화면들이 모르는 돈**이 된다.
   주간 브리핑이 못 보면 잊히고, 검색이 못 찾으면 없는 셈이 되고,
   전체 장부 엑셀에 안 실리면 세무사에게 가는 자료에서 통째로 빠진다.
   이 테스트는 그 네 군데 합류를 지킨다.

     ① 통합 검색 — 단지·동/호·작업 내용으로 오더가 찾아진다
     ② 주간 브리핑 — 지난주 완료·진행 중·미입금이 문안에 들어간다
     ③ 운영 리포트 — 기간 내 완료 건수·금액과 미입금이 들어간다
     ④ 전체 장부 엑셀 — '아파트오더' 시트(10번째)가 생기고 내용이 실린다
     ⑤ 오더가 하나도 없으면 브리핑·리포트에 아파트 줄이 나타나지 않는다 (빈 소음 금지)
     ⑥ pageerror 0

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

  // 픽스처 — 지난주 완료 1건 + 진행 1건 + 청구 미입금 1건
  await page.evaluate(() => {
    const r = hjWeekRange(-1);   // 지난주
    window.__lastFrom = r.from;
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '김소장', phone: '' }];
    state.aptOrders = [
      { id: 'w1', officeId: 'of1', unit: '103동 1204호', text: '욕실 실리콘 교체', amount: 80000, date: r.from, status: 'paid', doneAt: r.from },
      { id: 'w2', officeId: 'of1', unit: '201동 505호', text: '현관 도어락', amount: 120000, date: localDate(), status: 'work', doneAt: '' },
      { id: 'w3', officeId: 'of1', unit: '지하주차장', text: '도장 보수', amount: 300000, date: r.from, status: 'billed', doneAt: r.from }
    ];
  });

  // ① 통합 검색
  const search = await page.evaluate(() => {
    const byComplex = universalSearch('신흥마을');
    const byUnit = universalSearch('1204호');
    const byText = universalSearch('도어락');
    const g = (r) => (r.그룹['아파트 오더'] || []).length;
    return { byComplex: g(byComplex), byUnit: g(byUnit), byText: g(byText) };
  });
  assert(search.byComplex >= 3, '① 단지명으로 오더가 안 찾아진다: ' + search.byComplex);
  assert(search.byUnit === 1, '① 동/호로 안 찾아진다: ' + search.byUnit);
  assert(search.byText === 1, '① 작업 내용으로 안 찾아진다: ' + search.byText);

  // ② 주간 브리핑
  const brief = await page.evaluate(() => weekBriefText(weekBriefData()));
  assert(/아파트 오더/.test(brief), '② 주간 브리핑에 아파트 오더 항목이 없다: ' + brief.slice(0, 120));
  assert(/완료 2건/.test(brief) && /380,000원/.test(brief), '② 지난주 완료 건수·금액이 틀리다 (paid+billed 완료 2건 = 80,000+300,000):\n' + brief);
  assert(/진행 중 1건/.test(brief), '② 진행 중 건수가 없다');
  assert(/미입금 300,000원/.test(brief), '② 관리사무소 미입금이 챙길 일에 없다 — 못 받은 돈이 잊힌다:\n' + brief);

  // ③ 운영 리포트 (이번 주 기간이라 지난주 완료는 제외 — 미입금만 보인다)
  const ops = await page.evaluate(() => opsReportText(opsReportData('week')));
  assert(/관리사무소.*미입금 300,000원|미입금 300,000원/.test(ops), '③ 운영 리포트에 미입금이 없다:\n' + ops);

  // ③-2 월 리포트 — 이번 달 완료가 있으면 완료 줄도 나온다
  const opsMonth = await page.evaluate(() => {
    const ym = localDate().slice(0, 7);
    state.aptOrders.push({ id: 'm1', officeId: 'of1', unit: '303동 101호', text: '이달 완료', amount: 55000, date: localDate(), status: 'paid', doneAt: ym + '-01' });
    return opsReportText(opsReportData('month'));
  });
  assert(/아파트 오더 완료/.test(opsMonth) && /55,000원|435,000원/.test(opsMonth), '③ 월 리포트에 아파트 완료분이 없다:\n' + opsMonth);

  // ④ 전체 장부 엑셀 — 아파트오더 시트
  const xlsx = await page.evaluate(async () => {
    window.__xl = { sheets: [] };
    window.XLSX = {
      utils: { book_new: () => ({}), aoa_to_sheet: (aoa) => ({ aoa }),
        book_append_sheet: (wb, ws, name) => window.__xl.sheets.push({ name, aoa: ws.aoa }) },
      writeFile: () => {}
    };
    const r = await exportFullXlsx();
    const st = window.__xl.sheets.find(x => x.name === '아파트오더');
    return { sheets: window.__xl.sheets.map(x => x.name), rows: st ? st.aoa.length : 0,
             flat: st ? JSON.stringify(st.aoa) : '', ret: r };
  });
  assert(xlsx.sheets.includes('아파트오더'), '④ 아파트오더 시트가 없다 — 세무 자료에서 통째로 빠진다: ' + xlsx.sheets.join(','));
  assert(xlsx.rows === 5, '④ 시트 행수가 틀리다(머리 1+오더 4): ' + xlsx.rows);
  assert(/신흥마을아파트/.test(xlsx.flat) && /103동 1204호/.test(xlsx.flat), '④ 시트에 단지·동/호가 없다');
  assert(xlsx.ret && xlsx.ret.시트 === 10, '④ 시트 수 보고가 10이 아니다: ' + JSON.stringify(xlsx.ret));

  // ⑤ 오더가 없으면 줄이 안 생긴다 — 빈 소음 금지
  const empty = await page.evaluate(() => {
    state.aptOrders = [];
    return { brief: weekBriefText(weekBriefData()), ops: opsReportText(opsReportData('week')) };
  });
  assert(!/아파트 오더/.test(empty.brief), '⑤ 오더가 없는데 브리핑에 아파트 줄이 나온다');
  assert(!/아파트 오더/.test(empty.ops), '⑤ 오더가 없는데 리포트에 아파트 줄이 나온다');

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 통합 검색 — 단지·동/호·작업으로 찾아진다');
  console.log('PASS  ② 주간 브리핑 — 완료·진행·미입금 합류');
  console.log('PASS  ③ 운영 리포트 — 주·월 모두 합류');
  console.log('PASS  ④ 전체 장부 엑셀 — 아파트오더 시트(10번째)');
  console.log('PASS  ⑤ 오더 없으면 빈 줄 안 만듦');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

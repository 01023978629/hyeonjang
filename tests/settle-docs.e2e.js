/* settle-docs.e2e.js — 고객 발송 문서(거래명세서·청구서·계약서·하자보증서) 금액/문구 정확성 회귀
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   대상 버그(감사 CONFIRMED):
   (1) 품목 없을 때 부가세 포함 총액을 공급가로 써서 10% 이중가산(고객 과다청구)
   (2) 계약서 초안이 부가세 '포함' 견적도 항상 '별도'로 표기
   (3) 하자보증서가 방수 2년 등록돼도 '1년' 하드코딩(만료일과 모순) */
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
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  // (4) 문서 안에서 산수가 맞는가 — 합계 − 기수금 = 청구금액
  // 견적이 '부가세 별도'면 견적금액에 부가세가 없어서, 청구액만 d.due(=견적금액−수금)로 뽑던 예전 코드는
  // 표에 합계 1,100만·기수금 300만을 적어 놓고 청구액은 700만을 찍었다. 부가세만큼 덜 청구한다.
  await test('청구서 — 합계 − 기수금 = 청구금액 (부가세 별도 견적에서도 산수가 맞는다)', async () => {
    const r = await page.evaluate(() => {
      // 부가세 별도 견적: est.amount 에 부가세가 안 들어 있다. 계약금 300만 수금.
      state.projects = [{ name: '갈마동', stage: 2, received: 3000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '', addr: '대전' }, archived: false }];
      state.files = [{ id: 'e2', kind: 'estimate', project: '갈마동', name: '별도견적',
        est: { amount: 10000000, supply: 10000000, vat: 1000000, date: '2026-05-10' }, when: new Date('2026-05-10') }];
      state.quotes = [];
      const inv = invoiceHTML('갈마동'), stmt = statementHTML('갈마동');
      // 천단위 콤마가 있는 숫자만 — 그냥 [\d,]{4,} 로 하면 색상값(#c2410c)의 '2410' 을 집는다
      const grab = (label, html) => {
        const i = html.indexOf(label); if (i < 0) return null;
        const m = html.slice(i).match(/(\d{1,3}(?:,\d{3})+)/);
        return m ? Number(m[1].replace(/,/g, '')) : null;
      };
      return { 합계: grab('공사대금 합계', inv), 기수금: grab('기수금', inv), 청구: grab('청구 금액', inv),
               명세서잔금: grab('잔금', stmt) };
    });
    assert(r.합계 === 11000000, '청구서 합계가 11,000,000 이 아니다: ' + r.합계);
    assert(r.기수금 === 3000000, '기수금이 3,000,000 이 아니다: ' + r.기수금);
    assert(r.청구 === r.합계 - r.기수금,
      '문서 안에서 산수가 안 맞는다 — 합계 ' + r.합계 + ' − 기수금 ' + r.기수금 + ' = ' + (r.합계 - r.기수금) + ' 인데 청구금액은 ' + r.청구);
    assert(r.명세서잔금 === 8000000, '거래명세서 잔금도 합계 기준이어야 한다: ' + r.명세서잔금);
  });

  // (1) 품목 없는(외부 견적파일만) 완료현장 → 청구서/명세서: 공급가=부가세 제외, 합계=총액(이중가산 없음)
  await test('청구서·명세서 — 품목 없을 때 부가세 10% 이중가산 없음(공급가 제외값 사용)', async () => {
    const r = await page.evaluate(() => {
      // est.amount=12,000,000(부가세 포함 총액), supply=10,909,091, vat=1,090,909
      state.projects = [{ name: '외부견적현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '박고객', phone: '', addr: '대전' }, doneAt: '2026-06-01', archived: false }];
      state.files = [{ id: 'e1', kind: 'estimate', project: '외부견적현장', name: '외부견적', est: { amount: 12000000, supply: 10909091, vat: 1090909 }, when: new Date('2026-05-01') }];
      state.quotes = [];
      return { inv: invoiceHTML('외부견적현장'), stmt: statementHTML('외부견적현장') };
    });
    assert(r.inv.indexOf('10,909,091') >= 0, '청구서 공급가액=10,909,091(부가세 제외): 없음');
    assert(r.inv.indexOf('13,200,000') < 0, '청구서에 이중가산 13,200,000 표기됨(버그)');
    assert(r.stmt.indexOf('10,909,091') >= 0, '명세서 공급가액=10,909,091: 없음');
    assert(r.stmt.indexOf('13,200,000') < 0, '명세서 합계 이중가산 13,200,000(버그)');
    assert(r.stmt.indexOf('12,000,000') >= 0, '명세서 합계=실제 총액 12,000,000: 없음');
  });

  // (2) 계약서 초안 — 부가세 포함 견적은 '포함', 별도 견적은 '별도 + 총액'
  await test('계약서 초안 — 부가세 포함/별도 판정 정확(항상 별도 버그 수정)', async () => {
    const r = await page.evaluate(() => {
      // 포함형: amount = supply+vat
      const incl = contractDraftText({ project: '포함현장', est: { amount: 12100000, supply: 11000000, vat: 1100000 } });
      // 별도형: amount = supply (부가세는 별도)
      const excl = contractDraftText({ project: '별도현장', est: { amount: 11000000, supply: 11000000, vat: 1100000 } });
      return { incl, excl };
    });
    assert(/부가가치세 포함/.test(r.incl), '포함형인데 포함 표기 아님: ' + (r.incl.match(/계약금액[^\n]*/) || [''])[0]);
    assert(!/부가가치세 별도/.test(r.incl), '포함형이 별도로 오표기(버그)');
    assert(/부가가치세 별도/.test(r.excl) && r.excl.indexOf('12,100,000') >= 0, '별도형은 별도+총액(12,100,000) 병기: ' + (r.excl.match(/계약금액[^\n]*/) || [''])[0]);
  });

  // (3) 하자보증서 — 항목별 보증(방수2년·마감1년)이면 실제 기간 표기('1년' 하드코딩 금지)
  await test('하자보증서 — 항목별 보증 기간 정확 표기(1년 하드코딩 제거)', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '보증현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '', addr: '대전' }, doneAt: '2026-01-01',
        warranty: { startedAt: '2026-01-01', items: [{ name: '방수', months: 24, expiresAt: '2028-01-01' }, { name: '마감', months: 12, expiresAt: '2027-01-01' }] }, archived: false }];
      state.files = []; state.quotes = [];
      return warrantyHTML('보증현장');
    });
    assert(r.indexOf('최대 2년') >= 0, '배지에 실제 최장 기간(최대 2년) 없음');
    assert(r.indexOf('방수 2년') >= 0 && r.indexOf('마감 1년') >= 0, '항목별 기간(방수 2년·마감 1년) 표기 없음');
    assert(r.indexOf('(1년)') < 0, "'(1년)' 하드코딩이 남아 만료일과 모순");
    assert(r.indexOf('2028') >= 0, '만료일 2028(방수 2년) 표기 없음');
  });

  await test('청구서 note 와 하자보증서가 같은 기본기간을 말한다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '법정기본현장', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이고객', phone: '', addr: '대전' }, doneAt: '2026-08-01', archived: false }];
      state.files = [{ id: 'e3', kind: 'estimate', project: '법정기본현장', name: '견적', est: { amount: 1100000, supply: 1000000, vat: 100000 }, when: new Date('2026-07-01') }];
      state.quotes = [];
      return { summary: hjWarrantyPeriodText(), invoice: invoiceHTML('법정기본현장'), warranty: warrantyHTML('법정기본현장'), desc: HJ_SETTLE_DOCS.warranty.desc };
    });
    assert(/방수 3년/.test(r.summary) && /급배수·배관 설비 2년/.test(r.summary) && /마감\(도배·바닥·타일\) 1년/.test(r.summary), '법정 기본기간 요약이 틀림: ' + r.summary);
    assert(r.invoice.indexOf(r.summary) >= 0, '청구서 note 가 보증 기본기간과 다름: ' + r.summary);
    assert(r.warranty.indexOf(r.summary) >= 0, '하자보증서가 같은 기본기간을 말하지 않음: ' + r.summary);
    assert(r.desc.indexOf(r.summary) >= 0, '문서 선택 설명도 같은 기본기간이 아님: ' + r.desc);
  });

  // (4) 하자보증서 = 관리사무소 제출용 「작업 하자보증서」 양식(2026-09 대표님 양식)
  //     아는 값은 채우고, 확인자·서명은 비워 인쇄해서 받는다. 조항 5개는 문구가 곧 약속이라 글자로 지킨다.
  await test('하자보증서 — 관리사무소 제출용 양식의 칸과 조항이 모두 있다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '가상금성아파트 1동 907호', stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '김고객', phone: '', addr: '대전 유성구 가상금성아파트 1동 907호' }, doneAt: '2026-09-10', archived: false }];
      state.files = []; state.quotes = [{ id: 'qw', project: '가상금성아파트 1동 907호', date: '2026-09-01',
        items: [{ name: '욕실 방수', spec: '', qty: 1, price: 800000 }] }];
      state.aptOffices = [{ id: 'ow', complex: '가상금성아파트', manager: '김 소장' }];
      return warrantyHTML('가상금성아파트 1동 907호');
    });
    ['작 업 하 자 보 증 서', '관리사무소 제출용', '제출처', '작업명', '작업장소', '작업내용 / 범위', '작업완료일', '보증기간']
      .forEach(k => assert(r.indexOf(k) >= 0, '양식 칸 없음: ' + k));
    ['(보증기간)', '(보증범위)', '(보증제외)', '(접수·처리)', '(기타)']
      .forEach(k => assert(r.indexOf(k) >= 0, '보증 안내 조항 없음: ' + k));
    assert(r.indexOf('공용부 또는 인접 세대에 발생한 하자를 포함') >= 0, '공용부·인접세대 포함 문구가 빠지면 관리사무소가 안 받는다');
    assert(r.indexOf('제조사 보증 적용') >= 0, '제품 자체 불량 제외 문구 없음');
    assert(r.indexOf('가상금성아파트') >= 0 && r.indexOf('관리사무소 귀중') >= 0, '제출처에 등록해 둔 관리사무소가 안 채워짐');
    assert(r.indexOf('2026년 9월 10일') >= 0, '작업완료일이 안 채워짐');
    assert(r.indexOf('욕실 방수') >= 0, '작업내용이 견적에서 안 채워짐');
    // 확인자와 서명은 비워 둬야 한다 — 앱이 지어내면 안 되는 칸이다
    assert(r.indexOf('□ 관리사무소') >= 0 && r.indexOf('□ 의뢰인(세대)') >= 0, '확인자 구분 선택칸 없음');
    ['소속 / 동·호수', '성명 / 직위', '서명 또는 직인'].forEach(k => assert(r.indexOf(k) >= 0, '확인자 칸 없음: ' + k));
    assert(r.indexOf('2부 작성') >= 0, '2부 작성·보관 안내 없음');
    // 이 보증서는 관리사무소에만 가는 게 아니다 — 완료보증서로 고객에게도 간다(tests/kakao-project.e2e.js ⑤).
    // 양식에는 없던 칸이지만 고객명과 'A/S' 라는 낱말은 남겨야 한다. v302 에서 한 번 빠뜨려 깨졌다.
    assert(r.indexOf('의뢰인(고객)') >= 0 && r.indexOf('김고객') >= 0, '고객에게 가는 보증서인데 고객명이 없다');
    assert(r.indexOf('무상 A/S') >= 0, "고객이 알아듣는 '무상 A/S' 낱말이 빠졌다");
    // 시공업체 정보는 앱의 COMPANY 하나에서만 온다(문서마다 따로 적으면 번호가 어긋난다)
    ['만물인테리어', '전병덕', '895-48-01132'].forEach(k => assert(r.indexOf(k) >= 0, '시공업체 정보 없음: ' + k));
  });

  // (5) 하자보증서는 앱에 한 벌만 있어야 한다.
  //     예전엔 서류 만들기만 캔버스로 따로 그려서(buildWarrantyPDF), 같은 이름의 문서 둘이
  //     서로 다른 말을 했다. 이제 정산 문서·완료보증서·서류 만들기가 모두 warrantyHTML() 을 쓴다.
  await test('하자보증서는 한 벌 — 서류 만들기도 같은 양식을 쓰고, 화면에서 고친 값이 반영된다', async () => {
    const r = await page.evaluate(() => {
      state.projects = [{ name: '가상단벌현장', stage: 3, received: 0, phases: ['욕실 방수'], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '김고객', phone: '', addr: '대전' }, doneAt: '2026-09-10', archived: false }];
      state.files = []; state.quotes = [{ id: 'q5', project: '가상단벌현장', date: '2026-09-01', items: [{ name: '욕실 방수', spec: '', qty: 1, price: 800000 }] }];
      state.aptOffices = [];
      docHubView('가상단벌현장');
      const hub = [...document.querySelectorAll('#modalRoot .docHubBtn')].map(b => ({ act: b.dataset.act, text: b.textContent }));
      closeModal();
      return {
        hub,
        plain: warrantyHTML('가상단벌현장'),
        edited: warrantyHTML('가상단벌현장', { work: '욕실 방수 + 타일 보수', client: '가상 관리사무소' }),
        legacyGone: typeof buildWarrantyPDF === 'undefined',
      };
    });
    const w = r.hub.find(h => h.act === 'warranty');
    assert(w, '서류 만들기에 하자보증서 항목이 있어야 함');
    assert(w.text.indexOf('관리사무소 제출용') >= 0, '서류 만들기 설명이 새 양식을 가리켜야 함: ' + w.text);
    assert(r.plain.indexOf('작 업 하 자 보 증 서') >= 0, '기본 호출이 새 양식이 아님');
    assert(r.edited.indexOf('욕실 방수 + 타일 보수') >= 0, '화면에서 고친 작업내용이 안 들어감');
    assert(r.edited.indexOf('가상 관리사무소') >= 0, '화면에서 고친 의뢰인이 안 들어감');
    assert(r.plain.indexOf('김고객') >= 0, '안 고쳤으면 앱 자료(고객명)를 쓴다');
    assert(r.legacyGone, 'buildWarrantyPDF 가 살아 있으면 하자보증서가 다시 두 벌로 갈린다');
  });

  // (6) 하자보증서 작업 전/후 사진 — 장수를 고르면 그만큼 문서에 들어간다.
  //     전은 오래된 순(처음 상태), 후는 최근 순(마지막 상태). 공정 이름 띄어쓰기('시공 전')를 무시하고 가른다.
  //     장수를 안 주면 빈 칸 그대로(완료보증서 경로가 그 길이다). 있는 것보다 많이 달라도 있는 만큼만.
  await test('하자보증서 — 전/후 사진 장수를 고르면 그 장수만큼, 전은 오래된 순·후는 최근 순으로 들어간다', async () => {
    const r = await page.evaluate(() => {
      const N = '가상사진현장';
      const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
      state.projects = [{ name: N, stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', phone: '', addr: '대전' }, doneAt: '2026-09-10', archived: false }];
      state.quotes = []; state.aptOffices = [];
      const ph = (id, phase, when, extra) => Object.assign({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', size: 10, project: N, _virtual: true, _phase: phase, when: new Date(when), thumb: 'data:image/png;base64,' + PNG }, extra || {});
      state.files = [ph('b-old', '시공 전', '2026-09-01T00:00:00Z'), ph('b-mid', '시공 전', '2026-09-02T00:00:00Z'), ph('b-new', '철거', '2026-09-03T00:00:00Z'),
        ph('a-old', '완료', '2026-09-08T00:00:00Z'), ph('a-new', '준공', '2026-09-09T00:00:00Z'),
        ph('video', '완료', '2026-09-09T01:00:00Z', { ext: 'mp4', name: 'v.mp4' }),          // 영상은 제외
        ph('nothumb', '완료', '2026-09-09T02:00:00Z', { thumb: '' }),                        // 썸네일 없으면 제외(파일에 못 싣는다)
        ph('other', '완료', '2026-09-09T03:00:00Z', { project: '다른현장' })];                // 다른 현장 제외
      const ids = h => [...h.matchAll(/data-photo="([^"]+)"/g)].map(m => m[1]);
      const pools = hjWarrantyPhotoPools(N);
      return {
        pools: { before: pools.before.map(f => f.id), after: pools.after.map(f => f.id) },
        none: warrantyHTML(N), two: ids(warrantyHTML(N, { beforeN: 2, afterN: 1 })), clamp: ids(warrantyHTML(N, { beforeN: 4, afterN: 4 })),
        zero: ids(warrantyHTML(N, { beforeN: 0, afterN: 0 })),
      };
    });
    assert(JSON.stringify(r.pools.before) === JSON.stringify(['b-old', 'b-mid', 'b-new']), "'시공 전'(띄어쓰기)·'철거' 가 전이고, 오래된 순: " + r.pools.before);
    assert(JSON.stringify(r.pools.after) === JSON.stringify(['a-new', 'a-old']), "'완료'·'준공' 이 후이고 최근 순, 영상·썸네일없음·다른현장은 제외: " + r.pools.after);
    assert((r.none.match(/사진 부착 \/ 삽입/g) || []).length === 2 && !/<img /.test(r.none), '장수를 안 주면 빈 칸 둘 그대로');
    assert(JSON.stringify(r.two) === JSON.stringify(['b-old', 'b-mid', 'a-new']), '전 2장은 가장 오래된 둘, 후 1장은 가장 최근 하나: ' + r.two);
    assert(JSON.stringify(r.clamp) === JSON.stringify(['b-old', 'b-mid', 'b-new', 'a-new', 'a-old']), '있는 것보다 많이 달라도 있는 만큼만: ' + r.clamp);
    assert(JSON.stringify(r.zero) === JSON.stringify([]), '0장이면 넣지 않는다');
  });

  await test('하자보증서 미리보기 — 사진 장수 선택칸이 현장에 있는 만큼만 열린다', async () => {
    const r = await page.evaluate(() => {
      const N = '가상사진현장';   // 위 검사의 자료(전 3장·후 2장)를 그대로 쓴다
      warrantyView(N);
      const opts = id => [...document.querySelectorAll('#' + id + ' option')].map(o => ({ v: o.value, sel: o.selected, dis: o.disabled }));
      const out = { before: opts('wrBefore'), after: opts('wrAfter'), text: document.querySelector('#modalRoot').innerText };
      closeModal(); return out;
    });
    assert(JSON.stringify(r.before.filter(o => o.sel).map(o => o.v)) === JSON.stringify(['2']), '전 3장 있으면 기본 2장');
    assert(JSON.stringify(r.before.filter(o => o.dis).map(o => o.v)) === JSON.stringify(['4']), '전은 3장뿐이라 4장은 못 고른다');
    assert(JSON.stringify(r.after.filter(o => o.sel).map(o => o.v)) === JSON.stringify(['2']), '후 2장 있으면 기본 2장');
    assert(JSON.stringify(r.after.filter(o => o.dis).map(o => o.v)) === JSON.stringify(['4']), '후는 2장뿐이라 4장은 못 고른다');
    assert(/작업 전 \(현장에 3장\)/.test(r.text) && /작업 후 \(현장에 2장\)/.test(r.text), '현장에 몇 장 있는지 보여준다: ' + r.text.slice(0, 300));
  });

  const pe = errs.length;
  console.log('\npageerrors:', pe, pe ? errs.slice(0, 4) : '');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log('\n== settle-docs: ' + passed + '/' + results.length + ' passed, pageerrors=' + pe + ' ==');
  if (failed.length) failed.forEach(f => console.log('  FAIL ' + f.name + '\n    ' + (f.err || '')));
  await browser.close();
  process.exit(failed.length || pe ? 1 : 0);
})();

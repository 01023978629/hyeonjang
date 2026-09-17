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

  await test('하자보증서 미리보기 — 사진을 탭해서 직접 고른다(없음→전→후), 공정 사진은 미리 골라져 있고 한쪽 최대 4장', async () => {
    const r = await page.evaluate(() => {
      const N = '가상사진현장';   // 위 검사의 자료(전 3장·후 2장 + 영상·썸네일없음·다른현장)를 그대로 쓴다
      warrantyView(N);
      const tiles = () => [...document.querySelectorAll('#wrPhotoGrid .wrPh')].map(el => ({ id: el.dataset.id, tag: el.querySelector('.wrTag').textContent, shown: el.querySelector('.wrTag').style.display !== 'none' }));
      const count = () => document.getElementById('wrPickCount').textContent;
      const tap = id => document.querySelector('#wrPhotoGrid .wrPh[data-id="' + id + '"]').click();
      const out = { tiles0: tiles(), count0: count() };
      tap('b-new'); out.afterTap1 = { tags: tiles().filter(x => x.shown).map(x => x.id + ':' + x.tag), count: count() };   // 없음 → 전 (전 3/4)
      tap('b-new'); out.afterTap2 = tiles().filter(x => x.shown).map(x => x.id + ':' + x.tag);                             // 전 → 후 (후 3/4)
      tap('b-new'); out.afterTap3 = tiles().filter(x => x.shown).map(x => x.id + ':' + x.tag);                             // 후 → 없음
      out.pick = JSON.parse(JSON.stringify(window.__wrPick));
      closeModal(); return out;
    });
    assert(JSON.stringify(r.tiles0.map(x => x.id)) === JSON.stringify(['b-old', 'b-mid', 'b-new', 'a-old', 'a-new']),
      '격자에는 이 현장의 썸네일 있는 사진만 날짜순으로(영상·썸네일없음·다른현장 제외): ' + r.tiles0.map(x => x.id));
    assert(JSON.stringify(r.tiles0.filter(x => x.shown).map(x => x.id + ':' + x.tag)) === JSON.stringify(['b-old:전 1', 'b-mid:전 2', 'a-old:후 2', 'a-new:후 1']),
      '공정 사진은 전 2장(오래된 순)·후 2장(최근 순)이 미리 골라져 있다: ' + JSON.stringify(r.tiles0.filter(x => x.shown)));
    assert(r.count0 === '전 2/4 · 후 2/4', '개수 표시: ' + r.count0);
    assert(r.afterTap1.tags.includes('b-new:전 3') && r.afterTap1.count === '전 3/4 · 후 2/4', '한 번 탭 → 전 3번: ' + JSON.stringify(r.afterTap1));
    assert(r.afterTap2.includes('b-new:후 3') && !r.afterTap2.some(x => x === 'b-new:전 3'), '두 번 탭 → 후: ' + r.afterTap2);
    assert(!r.afterTap3.some(x => x.startsWith('b-new:')), '세 번 탭 → 없음: ' + r.afterTap3);
    assert(JSON.stringify(r.pick) === JSON.stringify({ before: ['b-old', 'b-mid'], after: ['a-new', 'a-old'] }), '최종 선택: ' + JSON.stringify(r.pick));
  });

  await test('하자보증서 — 직접 고른 사진(id)이 우선이고, 전은 오래된 순·후는 최근 순·한쪽 4장·이 현장 사진만', async () => {
    const r = await page.evaluate(() => {
      const N = '가상사진현장';
      const ids = h => [...h.matchAll(/data-photo="([^"]+)"/g)].map(m => m[1]);
      return {
        picked: ids(warrantyHTML(N, { beforeIds: ['b-new', 'b-old'], afterIds: ['a-old'] })),
        junk: ids(warrantyHTML(N, { beforeIds: ['video', 'nothumb', 'other', 'no-such', 'b-mid'], afterIds: [] })),
        overCount: ids(warrantyHTML(N, { beforeIds: ['b-old', 'b-mid', 'b-new', 'a-old', 'a-new'], afterIds: [] })).length,
        idsWinOverCount: ids(warrantyHTML(N, { beforeIds: ['b-mid'], afterIds: ['a-old'], beforeN: 4, afterN: 4 })),
        emptyIds: (warrantyHTML(N, { beforeIds: [], afterIds: [] }).match(/사진 부착 \/ 삽입/g) || []).length,
      };
    });
    assert(JSON.stringify(r.picked) === JSON.stringify(['b-old', 'b-new', 'a-old']), '고른 순서와 무관하게 전은 오래된 순: ' + r.picked);
    assert(JSON.stringify(r.junk) === JSON.stringify(['b-mid']), '영상·썸네일없음·다른현장·없는 id 는 조용히 뺀다: ' + r.junk);
    assert(r.overCount === 4, '한쪽 최대 4장: ' + r.overCount);
    assert(JSON.stringify(r.idsWinOverCount) === JSON.stringify(['b-mid', 'a-old']), 'id 를 주면 장수는 무시한다: ' + r.idsWinOverCount);
    assert(r.emptyIds === 2, '빈 목록이면 장수 방식으로 떨어지지 않고 빈 칸 둘');
  });

  // (8) 하자보증서 입구 통일 — 정산 문서의 카드도 같은 화면(사진 장수 선택)으로 간다.
  //     한쪽 입구만 사진 없는 문서를 만들면, 같은 이름의 문서가 입구에 따라 달라진다(v304 에서 겪은 유형).
  await test('정산 문서의 하자보증서 카드도 사진 장수를 고르는 같은 화면으로 간다 · 사진은 잘리지 않고 인쇄에서 안 끊긴다', async () => {
    const r = await page.evaluate(() => {
      const N = '가상사진현장';
      settleDocs(N);
      const card = document.querySelector('#modalRoot .sdCard[data-k="warranty"]');
      const cardText = card ? card.textContent : '';
      if (card) card.click();
      const routed = !!document.getElementById('wrPhotoGrid') && !!document.getElementById('wrPickCount');
      closeModal();
      const h = warrantyHTML(N, { beforeN: 1, afterN: 1 });
      // 셸 헤더의 로고 img 도 object-fit:cover 를 쓰므로, 사진(data-photo) 태그만 본다
      const photoTags = h.match(/<img data-photo="[^"]+"[^>]*>/g) || [];
      return { cardText, routed, contain: photoTags.length === 2 && photoTags.every(x => /object-fit:contain/.test(x)), cover: photoTags.some(x => /object-fit:cover/.test(x)),
        keep: (h.match(/class="keep"/g) || []).length, printRule: /\.keep\{break-inside:avoid/.test(h) };
    });
    assert(r.cardText.indexOf('하자보증서') >= 0, '정산 문서에 하자보증서 카드가 있어야 함');
    assert(r.routed, '정산 문서에서 눌러도 사진 고르는 격자(wrPhotoGrid)가 있는 같은 화면이어야 함');
    assert(r.contain && !r.cover, '증빙 사진은 잘라내지 않는다(object-fit:contain)');
    assert(r.keep === 4 && r.printRule, '사진 칸 2 + 서명란 2 는 인쇄에서 한 덩어리(.keep): ' + r.keep);
  });

  // (9) v308 — 공정 판정 한 곳(hjPhaseHit). 화면에서 만드는 공정 이름은 '시공 전' 인데 상수는 '시공전' 이라,
  //     글자 그대로 비교하던 전후 갤러리·후기 재료가 그 사진을 못 잡았다. 셋이 같은 기준을 써야 한다.
  await test('전/후 공정 판정 — 띄어쓰기가 있어도 잡고, 갤러리·보증서가 같은 사진을 같은 쪽으로 본다', async () => {
    const r = await page.evaluate(() => {
      const N = '가상공정현장';
      const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
      state.projects = [{ name: N, stage: 3, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객', addr: '대전' }, doneAt: '2026-09-10', archived: false }];
      state.quotes = []; state.aptOffices = [];
      const ph = (id, phase, day) => ({ id, name: id + '.jpg', kind: 'photo', ext: 'jpg', size: 9, project: N, _virtual: true, _phase: phase, when: new Date('2026-09-' + day + 'T00:00:00Z'), thumb: 'data:image/png;base64,' + PNG });
      state.files = [ph('sp1', '시공 전', '01'), ph('sp2', '시공전', '02'), ph('done1', '완료', '08'), ph('none1', '', '09')];
      const gal = beforeAfterPairs(N), pools = hjWarrantyPhotoPools(N);
      return { galBefore: gal.before.map(f => f.id), galAfter: gal.after.map(f => f.id),
        wrBefore: pools.before.map(f => f.id), wrAfter: pools.after.map(f => f.id),
        hit: [hjPhaseHit({ _phase: '시공 전' }, PHASE_BEFORE), hjPhaseHit({ _phase: '시공전' }, PHASE_BEFORE), hjPhaseHit({ _phase: '' }, PHASE_BEFORE), hjPhaseHit({ _phase: '완료' }, PHASE_BEFORE)] };
    });
    assert(JSON.stringify(r.hit) === JSON.stringify([true, true, false, false]), "'시공 전'·'시공전' 둘 다 전, 빈 공정·다른 공정은 아님: " + r.hit);
    assert(JSON.stringify(r.galBefore) === JSON.stringify(['sp1', 'sp2']), '전후 갤러리가 띄어쓰기 있는 공정도 전으로 잡아야 함: ' + r.galBefore);
    assert(JSON.stringify(r.galAfter) === JSON.stringify(['done1']), '갤러리 후: ' + r.galAfter);
    assert(JSON.stringify(r.wrBefore) === JSON.stringify(r.galBefore) && JSON.stringify(r.wrAfter) === JSON.stringify(r.galAfter),
      '보증서와 갤러리가 같은 사진을 같은 쪽으로 봐야 한다: 보증서 ' + JSON.stringify([r.wrBefore, r.wrAfter]) + ' vs 갤러리 ' + JSON.stringify([r.galBefore, r.galAfter]));
  });

  // (10) v308 — 문서에서 바로 인쇄/PDF 저장. 인쇄물에는 버튼이 나오면 안 된다.
  await test('문서에 [인쇄 / PDF 저장] 버튼 — 세 문서 모두 있고, 인쇄할 땐 숨는다', async () => {
    const r = await page.evaluate(() => {
      const N = '가상공정현장';
      const docs = { warranty: warrantyHTML(N), statement: statementHTML(N), invoice: invoiceHTML(N) };
      const out = {};
      // @media print 블록 안에 중첩 중괄호가 있어 [^}]* 로는 못 넘는다 — 두 조각이 다 있는지만 본다
      Object.keys(docs).forEach(k => { const h = docs[k] || ''; out[k] = { btn: /window\.print\(\)/.test(h), hide: h.indexOf('@media print{') >= 0 && h.indexOf('.pbar{display:none}') >= 0 }; });
      return out;
    });
    ['warranty', 'statement', 'invoice'].forEach(k => {
      assert(r[k].btn, k + ' 에 인쇄 버튼이 없다');
      assert(r[k].hide, k + ' 는 인쇄할 때 버튼을 숨겨야 한다(종이에 버튼이 찍힌다)');
    });
  });

  // (11) v310 — 문서를 PDF·워드로 가져갈 수 있어야 한다.
  //      그동안 .html 파일 한 벌만 떨어뜨렸다. 관리사무소에 내야 하는 종이인데 받아 놓고
  //      할 수 있는 게 없었고, 윈도우에서는 공유창만 뜨고 끝나 "다운로드가 안 된다"가 됐다.
  await test('하자보증서 [보증서 만들기] → PDF·워드·HTML 세 갈래를 고르는 화면이 뜬다', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '한밭우성아파트', stage: 4, received: 0, doneAt: '2026-09-01', phases: ['도배'],
        cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '관리사무소' }, archived: false }];
      state.files = []; state.quotes = [];
      warrantyView('한밭우성아파트');
      const btns = [...document.querySelectorAll('#modalRoot .mfoot button')];
      const make = btns.find(b => b.textContent.includes('보증서 만들기'));
      if (!make) return { err: '[보증서 만들기] 버튼이 없다' };
      make.click();
      await new Promise(r => setTimeout(r, 120));
      const ids = ['hjDocPdf', 'hjDocWord', 'hjDocHtml'].map(id => !!document.querySelector('#modalRoot #' + id));
      return { ids, preview: !!document.querySelector('#modalRoot iframe[srcdoc]'),
        wired: ['hjDocPdf', 'hjDocWord', 'hjDocHtml'].map(id => typeof (document.querySelector('#modalRoot #' + id) || {}).onclick === 'function') };
    });
    assert(!r.err, r.err || '');
    assert(r.ids.every(Boolean), 'PDF·워드·HTML 버튼이 다 있어야 한다: ' + JSON.stringify(r.ids));
    assert(r.preview, '미리보기가 없다 — 사진을 잘못 골랐는지 볼 데가 있어야 한다');
    // 모달 본문 버튼은 #view 위임이 닿지 않는다. 직접 배선하지 않으면 보이기만 하고 안 눌린다(v300 과 같은 사고).
    assert(r.wired.every(Boolean), '세 버튼 모두 openModal 뒤 직접 배선되어야 한다: ' + JSON.stringify(r.wired));
  });

  await test('워드(.doc) 변환 — 워드가 A4로 열고, 인쇄 버튼은 종이에 안 따라간다', async () => {
    const r = await page.evaluate(() => {
      const html = warrantyHTML('한밭우성아파트');
      const w = hjDocWordHtml(html);
      return {
        hadBtn: /window\.print\(\)/.test(html), stillBtn: /window\.print\(\)/.test(w),
        ns: w.includes('xmlns:w="urn:schemas-microsoft-com:office:word"'),
        page: w.includes('@page WordSection1') && w.includes('210mm 297mm'),
        section: w.includes('<div class="WordSection1">') && w.includes('</div></body>'),
        keptTitle: w.includes('작 업 하 자 보 증 서'),
        keptCompany: w.includes('만물인테리어')
      };
    });
    assert(r.hadBtn, '원본에는 인쇄 버튼이 있어야 검사가 뜻이 있다');
    assert(!r.stillBtn, '워드 파일에 인쇄 버튼이 남았다 — 워드에서는 눌러도 뜻이 없고 종이에 찍힌다');
    assert(r.ns, '워드 네임스페이스가 없다 — 워드가 웹페이지로 열어 버린다');
    assert(r.page, '@page WordSection1 A4 설정이 없다');
    assert(r.section, 'WordSection1 로 본문을 감싸지 않았다');
    assert(r.keptTitle && r.keptCompany, '변환하면서 문서 내용이 날아갔다');
  });

  await test('PDF 저장 — 숨김 iframe 으로 인쇄를 열고, 사진이 뜬 뒤에 연다', async () => {
    const r = await page.evaluate(async () => {
      // 진짜 인쇄 대화상자는 테스트에서 못 띄우므로 print() 를 가로채 호출 여부만 본다.
      const html = warrantyHTML('한밭우성아파트');
      let printed = 0, before = document.querySelectorAll('iframe#hjDocPrintFrame').length;
      const origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      const ok = hjDocPrint(html);
      const frame = document.getElementById('hjDocPrintFrame');
      if (frame && frame.contentWindow) { frame.contentWindow.print = () => { printed++; }; }
      await new Promise(r => setTimeout(r, 600));
      const visible = frame ? getComputedStyle(frame).visibility : 'none';
      const after = document.querySelectorAll('iframe#hjDocPrintFrame').length;
      // 두 번 불러도 액자가 쌓이면 안 된다
      hjDocPrint(html);
      await new Promise(r => setTimeout(r, 400));
      const twice = document.querySelectorAll('iframe#hjDocPrintFrame').length;
      return { ok, made: !!frame, printed, visible, before, after, twice, hasDesc: !!origDesc };
    });
    assert(r.ok === true, 'hjDocPrint 가 실패를 돌려줬다');
    assert(r.made, '인쇄용 숨김 iframe 을 안 만들었다');
    assert(r.printed >= 1, 'print() 가 안 불렸다 — 인쇄 창이 안 뜬다');
    assert(r.visible === 'hidden', '인쇄용 액자가 화면에 보인다');
    assert(r.twice === 1, '인쇄를 두 번 누르면 액자가 쌓인다(' + r.twice + '개) — 매번 지우고 새로 만들어야 한다');
  });

  await test('정산 문서(거래명세서·청구서)도 같은 세 갈래로 나간다', async () => {
    const r = await page.evaluate(async () => {
      state.projects = [{ name: '갈마동', stage: 2, received: 1000000, phases: [],
        cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김고객' }, archived: false }];
      state.files = [{ id: 'e9', kind: 'estimate', project: '갈마동', name: '견적',
        est: { amount: 5000000, supply: 5000000, vat: 500000, date: '2026-05-10' }, when: new Date('2026-05-10') }];
      settleDocs('갈마동');
      const card = document.querySelector('#modalRoot .sdCard[data-k="statement"]');
      if (!card) return { err: '거래명세서 카드가 없다' };
      card.click();
      await new Promise(r => setTimeout(r, 120));
      return { pdf: !!document.querySelector('#modalRoot #hjDocPdf'),
        word: !!document.querySelector('#modalRoot #hjDocWord'),
        html: !!document.querySelector('#modalRoot #hjDocHtml'),
        back: [...document.querySelectorAll('#modalRoot .mfoot button')].some(b => b.textContent.includes('뒤로')) };
    });
    assert(!r.err, r.err || '');
    assert(r.pdf && r.word && r.html, '거래명세서도 PDF·워드·HTML 을 고를 수 있어야 한다: ' + JSON.stringify(r));
    assert(r.back, '[← 뒤로] 가 없으면 문서 목록으로 못 돌아간다');
  });

  // (12) v311 — 워드 파일에 사진이 실제로 들어간다.
  //      v310 은 HTML 안에 data: 이미지(base64)를 그대로 두고 .doc 으로 내보냈다. 워드는 그걸 안 그린다 —
  //      대표님 워드 화면에서 작업 전 4장·후 3장이 전부 빨간 X 였다. 사진을 MIME 조각으로 따로 싣는
  //      MHTML(웹 아카이브)이어야 워드가 읽는다. 여기서는 (a) 구조가 맞는지, (b) HTML 조각을 QP 복원하면
  //      한글이 온전한지, (c) 사진 주소가 전부 조각과 짝이 맞는지, (d) 그 파일을 Chromium 이 file:// 로
  //      열었을 때 사진이 실제로 그려지는지까지 본다 — Chromium 은 MHTML 을 원래 읽는 브라우저라
  //      구조가 틀리면 사진이 안 뜬다(file:/// 주소로 만들었을 때 실제로 8장 다 안 떴다).
  await test('워드(.doc) — 사진이 MHTML 조각으로 실리고, HTML 조각에 data: 이미지가 남지 않는다', async () => {
    const r = await page.evaluate(() => {
      const mk = (c) => { const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 320, 240); return cv.toDataURL('image/jpeg', 0.8); };
      state.projects = [{ name: '한밭우성아파트', stage: 4, received: 0, doneAt: '2026-09-01', phases: ['도배'],
        cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '관리사무소' }, archived: false }];
      state.files = [1, 2, 3].map(i => ({ id: 'wph' + i, kind: 'photo', project: '한밭우성아파트', name: 'w' + i + '.jpg', thumb: mk(i < 3 ? '#b45309' : '#0a7f43'), when: new Date('2026-09-0' + i) }));
      state.quotes = [];
      const html = warrantyHTML('한밭우성아파트', { beforeIds: ['wph1', 'wph2'], afterIds: ['wph3'] });
      const mht = hjDocWordMhtml(html);
      const B = '------=_NextPart_hyeonjang_doc';
      const parts = mht.split(B).filter(x => /^\r\nContent-Type:/.test(x));
      const htmlPart = parts.find(x => /Content-Type: text\/html/.test(x)) || '';
      const body = htmlPart.split('\r\n\r\n').slice(1).join('\r\n\r\n');
      // quoted-printable 복원 → UTF-8
      const qp = body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
      const bytes = new Uint8Array(qp.length); for (let i = 0; i < qp.length; i++) bytes[i] = qp.charCodeAt(i);
      const decoded = new TextDecoder().decode(bytes);
      const locs = [...mht.matchAll(/^Content-Location: (\S+)/gm)].map(m => m[1]);
      const srcs = [...decoded.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m => m[1]);
      const imgParts = parts.filter(x => /Content-Type: image\//.test(x));
      // 사진 조각의 base64 가 실제 JPEG 인지(디코딩 시 FF D8 로 시작)
      const firstB64 = ((imgParts[0] || '').split('\r\n\r\n')[1] || '').replace(/\s/g, '');
      const bin = atob(firstB64.slice(0, 8));
      return { mimeHead: mht.startsWith('MIME-Version: 1.0\r\nContent-Type: multipart/related;'),
        imgParts: imgParts.length, htmlDataLeft: (decoded.match(/src="data:/g) || []).length,
        srcs: srcs.length, unresolved: srcs.filter(x => !locs.includes(x)).length,
        hangul: decoded.includes('작 업 하 자 보 증 서') && decoded.includes('관리사무소'),
        jpegMagic: bin.charCodeAt(0) === 0xFF && bin.charCodeAt(1) === 0xD8,
        httpLoc: locs.every(l => /^http:\/\//.test(l)), pbar: /window\.print\(\)/.test(decoded), mht };
    });
    assert(r.mimeHead, 'MIME multipart/related 머리가 없다 — 워드가 MHTML 로 못 연다');
    assert(r.imgParts === 3, '사진 조각이 3개여야 한다(전 2 + 후 1): ' + r.imgParts);
    assert(r.htmlDataLeft === 0, 'HTML 조각에 data: 이미지가 남았다 — 워드에서 빨간 X 가 된다(v310 사고)');
    assert(r.srcs === 3 && r.unresolved === 0, '모든 <img src> 가 조각 Content-Location 과 짝이 맞아야 한다: ' + JSON.stringify(r));
    assert(r.hangul, 'QP 복원 후 한글이 깨졌다');
    assert(r.jpegMagic, '사진 조각이 JPEG 바이트가 아니다');
    assert(r.httpLoc, '조각 주소는 http:// 절대주소여야 한다 — file:/// 는 Chromium 이 막는다(실험으로 확인)');
    assert(!r.pbar, '워드 파일에 인쇄 버튼이 남았다');
    // (d) Chromium 이 file:// 로 열어 사진을 그리는가
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
    const f = path.join(os.tmpdir(), 'hj-word-' + process.pid + '.mht');
    fs.writeFileSync(f, r.mht);
    const p2 = await ctx.newPage();
    try {
      await p2.goto('file://' + f);
      await p2.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 8000 });
      const imgs = await p2.evaluate(() => [...document.images].map(i => ({ w: i.naturalWidth, ok: i.complete && i.naturalWidth > 0 })));
      assert(imgs.length === 3, 'MHTML 을 연 화면에 사진이 3장이어야 한다: ' + imgs.length);
      assert(imgs.every(i => i.ok), 'MHTML 안의 사진이 그려지지 않았다(naturalWidth 0) — 조각 주소·인코딩이 어긋난 것: ' + JSON.stringify(imgs));
      assert(imgs.every(i => i.w === 320), '사진 원본 크기가 보존되어야 한다(320): ' + JSON.stringify(imgs));
    } finally { await p2.close(); try { fs.unlinkSync(f); } catch (e) {} }
  });

  await test('워드(.doc) — 사진 격자는 2열 표로, 사진 폭은 숫자로 못 박는다(워드는 grid·width:100% 를 모른다)', async () => {
    const r = await page.evaluate(() => {
      const html = warrantyHTML('한밭우성아파트', { beforeIds: ['wph1', 'wph2'], afterIds: ['wph3'] });
      const w = hjDocWordHtml(html);
      return { gridsLeft: (w.match(/display:grid/g) || []).length, tables: (w.match(/<table width="100%"/g) || []).length,
        fixed: (w.match(/<img[^>]*data-photo[^>]*width="230"/g) || []).length, rows: (w.match(/<tr>/g) || []).length };
    });
    assert(r.gridsLeft === 0, '워드 파일에 CSS grid 가 남았다 — 워드가 사진을 세로로 한 줄씩 늘어놓는다');
    assert(r.tables === 2, '전·후 격자 둘이 표 둘로 바뀌어야 한다: ' + r.tables);
    assert(r.fixed === 3, '사진 3장 모두 width="230" 이어야 한다(안 그러면 워드가 쪽 너비로 늘린다): ' + r.fixed);
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

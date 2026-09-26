/* dates-warranty-office.e2e.js — 날짜·보증·관리사무소 결함 묶음(v330 발굴 검토에서 살아남은 것)

   시계를 한국 시간 2026-09-26 오전 7시 30분에 세운다. 이때 UTC 는 아직 9월 25일이라
   toISOString().slice(0,10) 으로 '오늘'을 잡는 곳은 전부 하루 어긋난다(tests/local-date.check.js 가 새로 생기는 것을 막는다).

     ⓐ 견적·수금·AS·오더·운행 이력 기본 기간의 끝 = 한국 날짜 오늘, 오늘 쓴 견적이 목록에 든다 · 준공일·카카오 '내일' 일정도 한국 날짜
     ⓑ 보증 시작을 안 누른 완료 현장의 보증 만료 = 보증서와 같은 항목별 기간(방수 3년) — 12개월로 세어 '보증 만료'를 알리지 않는다
     ⓒ 완료를 내렸다 올려도 준공일은 그대로, 바꾸는 길은 🛡 보증 수정의 준공일 칸
     ⓓ 현장 카드 [✍️ 서명 확인] → 서명이 든 보증서 화면으로 잇는다
     ⓔ 보증 시작일이 준공일과 다른 옛 자료 — 종이 보증서 기간이 만료일과 같은 기준일에서 시작한다
     ⓕ 아파트 오더 사진은 그 단지 안에서, 동/호 경계를 지켜서만 잡는다(불변식: 그 동/호 사진만)
     ⓖ 월 정산서·엑셀의 부가세 표기는 오더의 승인 조건 값에서만(모르면 적지 않는다)
     ⓗ 6개월보다 오래된 미결(완료·청구) 오더도 정산서에서 골라 입금 확인에 닿는다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  // 한국 오전 7:30 = UTC 전날 22:30. 시계는 멈춰 두되 타이머는 돈다(setFixedTime).
  await page.clock.setFixedTime(new Date('2026-09-26T07:30:00+09:00'));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone, window.__hjRelayBootDone].filter(Boolean));
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(String(m)); try { o(m); } catch (e) {} };
  });

  const clean = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    state.projects = []; state.files = []; state.quotes = []; state.payLog = []; state.asLog = []; state.aptOrders = []; state.aptOffices = [];
    state.schedule = []; state.trips = []; window.__toasts = [];
  });

  await test('시계 확인 — 한국 9/26 07:30 인데 UTC 날짜는 9/25 (이 전제가 무너지면 아래 ⓐ 는 아무것도 안 지킨다)', async () => {
    const r = await page.evaluate(() => ({ local: localDate(), utc: new Date().toISOString().slice(0, 10) }));
    assert(r.local === '2026-09-26' && r.utc === '2026-09-25', JSON.stringify(r));
  });

  await test('ⓐ 이력 5곳의 기본 기간 끝 = 한국 날짜 오늘 · 오늘 쓴 견적이 목록에 든다', async () => {
    await clean();
    const r = await page.evaluate(() => {
      state.quotes = [{ id: 'q1', date: localDate(), title: '오늘 견적', project: '', items: [{ name: '방수', qty: 1, price: 100000 }] }];
      const out = {};
      quoteHistoryView(true); out.qt = window.__qtHist.to; out.qtFrom = window.__qtHist.from; out.qtHit = quoteHistFilter().length; closeModal(true);
      payHistoryView(true); out.pay = window.__payHist.to; closeModal(true);
      asHistoryView(true); out.as = window.__asHist.to; closeModal(true);
      aptHistoryView(true); out.apt = window.__aptHist.to; closeModal(true);
      tripView(true); out.trip = window.__trip.to; closeModal(true);
      return out;
    });
    ['qt', 'pay', 'as', 'apt', 'trip'].forEach(k => assert(r[k] === '2026-09-26', k + ' 기본 끝날이 한국 날짜가 아니다: ' + JSON.stringify(r)));
    assert(r.qtFrom === '2026-03-26', '견적 이력 시작일(6개월 전)도 한국 날짜: ' + r.qtFrom);
    assert(r.qtHit === 1, '오늘 쓴 견적이 기본 목록에 없다: ' + JSON.stringify(r));
  });

  await test('ⓐ 준공일·카카오 문의 \'내일\' 일정도 한국 날짜', async () => {
    await clean();
    const r = await page.evaluate(() => {
      state.projects = [{ name: '가상완료현장', stage: 2, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false }];
      window.__clPass = 1; setStage('가상완료현장', STAGES.length - 1);
      const res = kakaoLeadApply({ name: '가상', area: '가상동', workType: '욕실', work: '욕실' }, { contact: false, project: false, schedule: true });
      return { doneAt: state.projects[0].doneAt, sched: res.일정, stamp: localStamp() };
    });
    assert(r.doneAt === '2026-09-26', '준공일이 UTC 날짜로 찍혔다: ' + r.doneAt);
    assert(r.sched === '2026-09-27', "카카오 '내일' 일정이 하루 이르다: " + r.sched);
    assert(r.stamp === '2026-09-26 07:30', '화면 시각 도장이 한국 시각이 아니다: ' + r.stamp);
  });

  await test('ⓒ 완료를 내렸다 올려도 준공일은 그대로 · 명시적으로 바꾸는 길은 🛡 보증 수정의 준공일 칸', async () => {
    await clean();
    const r = await page.evaluate(() => {
      state.projects = [{ name: '가상옛현장', stage: STAGES.length - 1, doneAt: '2025-03-01', received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false }];
      const p = state.projects[0];
      setStage('가상옛현장', 2);
      const mid = { doneAt: p.doneAt, prev: p.doneAtPrev, inList: warrantyList(true).some(w => w.name === '가상옛현장') };
      window.__clPass = 1; setStage('가상옛현장', STAGES.length - 1);
      return { mid, after: p.doneAt, prevLeft: 'doneAtPrev' in p, toast: window.__toasts.join(' | ') };
    });
    assert(r.mid.doneAt === null && r.mid.prev === '2025-03-01', '완료를 내리면 준공일을 옮겨 둬야 한다: ' + JSON.stringify(r.mid));
    assert(!r.mid.inList, '완료를 내린 현장이 보증 목록에 남았다');
    assert(r.after === '2025-03-01', '다시 완료로 올리니 준공일이 바뀌었다: ' + r.after);
    assert(!r.prevLeft, '되살린 뒤 doneAtPrev 가 남았다');
    assert(/준공일 2025-03-01 그대로/.test(r.toast), '되살린 준공일을 알려야 한다: ' + r.toast);
    // 명시적으로 바꾸는 길
    const r2 = await page.evaluate(() => {
      hjWarrantyStart('가상옛현장');
      document.querySelector('#modalRoot #wsStart').value = '2025-03-15';
      [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => b.textContent.includes('보증 시작')).click();
      const p = state.projects[0];
      return { doneAt: p.doneAt, started: p.warranty && p.warranty.startedAt };
    });
    assert(r2.doneAt === '2025-03-15' && r2.started === '2025-03-15', '보증 수정의 준공일 칸이 준공일과 보증 시작을 같이 맞춰야 한다: ' + JSON.stringify(r2));
  });

  await test('ⓑ 보증 시작을 안 누른 완료 현장 — 만료일·개월은 보증서와 같은 항목별 기간 · 점검 문자가 \'보증 만료\'를 1년에 말하지 않는다', async () => {
    await clean();
    const r = await page.evaluate(() => {
      const mk = (name, doneAt, extra) => Object.assign({ name, stage: STAGES.length - 1, doneAt, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false, customer: { name: '가상 고객', phone: '010-0000-1234' } }, extra || {});
      state.projects = [mk('가상11개월', '2025-10-26'), mk('가상13개월', '2025-08-26'), mk('가상35개월', '2023-10-26'),
        mk('가상구형60', '2025-01-10', { warranty: 60 }), mk('가상구형12', '2025-01-10', { warranty: 12 })];
      const sms = []; const real = window.hjSendSms; window.hjSendSms = (ph, t) => { sms.push(t); };
      try {
        const L = n => warrantyList(true).find(w => w.name === n);
        const H = n => hjWarranty(state.projects.find(p => p.name === n));
        warrantySms('가상13개월'); warrantySms('가상35개월');
        return { l11: L('가상11개월'), h11: H('가상11개월'), due: warrantyDue().map(w => w.name), sms,
          h35end: H('가상35개월').end, g60: L('가상구형60'), g12: L('가상구형12') };
      } finally { window.hjSendSms = real; }
    });
    assert(r.l11.expiry === r.h11.end && r.l11.expiry === '2028-10-26', '보증 목록 만료일이 보증서(hjWarranty)와 다르다: ' + JSON.stringify({ list: r.l11.expiry, doc: r.h11.end }));
    assert(r.l11.months === 36, '보증 개월이 방수 36개월이 아니다: ' + r.l11.months);
    assert(!r.due.includes('가상11개월') && !r.due.includes('가상13개월'), '방수 보증이 남은 현장이 만료 임박 알림에 떴다: ' + JSON.stringify(r.due));
    assert(r.due.includes('가상35개월'), '만료 두 달 전 현장은 알림에 떠야 한다: ' + JSON.stringify(r.due));
    assert(!/보증 기간이 지났지만/.test(r.sms[0]), '13개월 현장(방수 3년 보증 중)에 \'보증 기간이 지났지만\' 문자: ' + r.sms[0]);
    assert(r.sms[1].includes('보증 만료(' + r.h35end + ')를 앞두고'), '점검 문자의 만료일이 보증서 끝날과 다르다: ' + r.sms[1]);
    assert(r.g60.expiry === '2030-01-10', '구형 숫자 보증 60개월은 법정보다 길면 그대로: ' + r.g60.expiry);
    assert(r.g12.expiry === '2028-01-10', '구형 숫자 보증 12개월이 법정 방수 3년을 줄였다: ' + r.g12.expiry);
    assert(r.g12.months === 36 && r.g60.months === 60, '구형 숫자 보증의 개월 표시: ' + JSON.stringify([r.g12.months, r.g60.months]));
  });

  await test('ⓔ 보증 시작일이 준공일과 다른 옛 자료 — 종이 보증서 기간이 만료일과 같은 기준일에서 시작한다 · 같으면 예전 그대로', async () => {
    await clean();
    const r = await page.evaluate(() => {
      state.projects = [
        { name: '가상어긋남', stage: 4, doneAt: '2026-03-01', received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false, customer: { name: '가상 고객' },
          warranty: { startedAt: '2026-03-15', items: [{ name: '방수', months: 36, expiresAt: '2029-03-15' }, { name: '마감', months: 12, expiresAt: '2027-03-15' }] } },
        { name: '가상같음', stage: 4, doneAt: '2026-03-01', received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false, customer: { name: '가상 고객' } }];
      const txt = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' '); };
      return { a: txt(warrantyHTML('가상어긋남')), b: txt(warrantyHTML('가상같음')),
        la: hjWarrantyLinkBody('가상어긋남', {}).warranty, lb: hjWarrantyLinkBody('가상같음', {}).warranty };
    });
    assert(/2026년 3월 15일 ~ 2029년 3월 15일/.test(r.a), '보증기간이 만료일과 같은 기준일(3/15)에서 시작해야 한다: ' + (r.a.match(/보증기간[^A]{0,90}/g) || []).join(' / '));
    assert(/보증 시작일로부터 3년/.test(r.a) && !/작업완료일로부터 3년/.test(r.a), '기준일이 다르면 \'작업완료일로부터\'라 적지 않는다: ' + (r.a.match(/보증기간[^A]{0,90}/g) || []).join(' / '));
    assert(/작업완료일\s*2026년 3월 1일/.test(r.a), '작업완료일 칸은 준공일 그대로: ' + (r.a.match(/작업완료일.{0,20}/) || [''])[0]);
    assert(/2026년 3월 1일 ~ 2029년 3월 1일 \(작업완료일로부터 3년\)/.test(r.b), '보통 현장의 보증서 문구가 바뀌었다: ' + (r.b.match(/보증기간.{0,80}/) || [''])[0]);
    assert(/2026년 3월 15일부터/.test(r.la) && /작업완료일로부터/.test(r.lb), '링크 서명 본문도 같은 기준일: ' + JSON.stringify([r.la, r.lb]));
  });

  await test('ⓓ 현장 카드 [✍️ 서명 확인] → 서명을 보관하고 서명이 든 보증서 화면으로 잇는다', async () => {
    await clean();
    await page.evaluate(({ PNG }) => {
      state.projects = [{ name: '가상링크', stage: 4, doneAt: '2026-09-01', received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false, customer: { name: '가상 고객' },
        warrantyLinks: [{ id: 'wl_t1', at: '2026-09-02T00:00:00.000Z', contractId: 'ct_t1', contractNo: 'MM-TEST-1', role: 'office', org: '가상아파트 관리사무소', name: '홍길동 소장', work: '가상 욕실 방수 작업', client: '가상 의뢰인' }] }];
      state.files = [{ id: 's1', name: '가상_s1.png', kind: 'photo', ext: 'png', size: 10, project: '가상링크', when: new Date('2026-09-01T09:00:00'), thumb: 'data:image/png;base64,' + PNG, _phase: '시공 전' }];
      __contract.url = 'https://script.google.com/macros/s/TEST/exec'; __contract.token = 'SUPER-SECRET-ADMIN-TOKEN'; __contract.selfTestOk = true;
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 18; cv.getContext('2d').fillRect(2, 2, 40, 10);
      const sigPng = cv.toDataURL('image/png');
      window.contractCall = async (action) => {
        if (action === 'contract.signature') return { ok: true, signerName: '홍길동 소장', signedAt: '2026-09-18T04:05:06.000Z', signatureImage: sigPng };
        const e = new Error('모르는 동작'); e.__code = 'BAD_REQUEST'; throw e;
      };
      window.__lastWr = null; const realW = window.__realWr = window.warrantyHTML;
      window.warrantyHTML = function (n, o) { const h = realW(n, o); window.__lastWr = { o: o || {}, h }; return h; };
      // 현장 카드의 버튼과 같은 마크업을 #view 안에 둔다 — 위임 경로를 탄다
      const b = document.createElement('button'); b.className = 'mini-btn'; b.id = 'tWlPull'; b.dataset.wlpull = '가상링크|wl_t1'; b.textContent = '✍️ 서명 확인';
      document.getElementById('view').appendChild(b);
    }, { PNG });
    await page.click('#tWlPull');
    await page.waitForFunction(() => !!document.querySelector('#modalRoot #hjDocPdf'), null, { timeout: 8000 });
    const r = await page.evaluate(() => ({ sigs: (state.projects[0].warrantySigs || []).length, signedAt: state.projects[0].warrantyLinks[0].signedAt,
      title: (document.querySelector('#modalRoot') || {}).textContent.slice(0, 200), o: window.__lastWr && window.__lastWr.o,
      hasSigImg: !!(window.__lastWr && /data:image\/png/.test(window.__lastWr.h) && /홍길동 소장/.test(window.__lastWr.h)),
      hasBack: !!document.querySelector('#modalRoot #hjDocBack, #modalRoot [data-docback]') || /뒤로/.test((document.querySelector('#modalRoot') || {}).textContent || '') }));
    assert(r.sigs === 1 && r.signedAt, '서명이 보관되지 않았다: ' + JSON.stringify(r));
    assert(r.o && r.o.sig && r.o.work === '가상 욕실 방수 작업' && r.o.client === '가상 의뢰인', '링크를 만들 때의 작업내용·의뢰인과 서명으로 문서를 만들어야 한다: ' + JSON.stringify(r.o && { work: r.o.work, client: r.o.client, sig: !!r.o.sig }));
    assert(r.hasSigImg, '문서에 서명 그림·서명자가 없다');
    assert(/서명/.test(r.title), '서명 보증서 화면 제목: ' + r.title);
    await page.evaluate(() => { if (window.__realWr) window.warrantyHTML = window.__realWr; });
  });

  await test('ⓕ 아파트 오더 사진 — 그 단지 안에서, 동/호 경계를 지켜서만', async () => {
    await clean();
    const r = await page.evaluate(() => {
      state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
      state.aptOrders = [
        { id: 'o1', officeId: 'of1', unit: '103동 1204호', text: '실리콘', amount: 0, date: localDate(), status: 'done', doneAt: localDate() },
        { id: 'o2', officeId: 'of1', unit: '3동 1204호', text: '문', amount: 0, date: localDate(), status: 'done', doneAt: localDate() }];
      state.files = [
        { id: 'f1', name: '신흥마을아파트_103동1204호_시공전.jpg', ext: 'jpg', kind: 'photo' },
        { id: 'f2', name: '신흥마을_103동 1204호_시공후.jpg', ext: 'jpg', kind: 'photo' },
        { id: 'f3', name: '금성백조아파트_103동1204호_시공전.jpg', ext: 'jpg', kind: 'photo' },   // 다른 단지·같은 동/호
        { id: 'f4', name: '신흥마을아파트_1103동1204호.jpg', ext: 'jpg', kind: 'photo' },          // 다른 동(앞에 숫자)
        { id: 'f5', name: '신흥마을아파트_103동12045호.jpg', ext: 'jpg', kind: 'photo' },
        { id: 'f6', name: '103동1204호_마감.jpg', ext: 'jpg', kind: 'photo' },                   // 단지 이름 없이 동/호만 — 예전처럼 받는다
        { id: 'f7', name: 'IMG_01.jpg', ext: 'jpg', kind: 'photo', project: '금성백조아파트 103동 1204호' }];   // 다른 단지 현장에 배정된 사진
      const ids = o => aptPhotoList(state.aptOrders.find(x => x.id === o)).map(f => f.id).sort();
      return { o1: ids('o1'), o2: ids('o2') };
    });
    assert(JSON.stringify(r.o1) === JSON.stringify(['f1', 'f2', 'f6']), '103동 1204호 오더는 그 단지의 그 세대 사진만: ' + JSON.stringify(r.o1));
    assert(r.o2.length === 0, "'3동 1204호' 오더가 '103동1204호' 사진을 잡았다: " + JSON.stringify(r.o2));
  });

  await test('ⓖ 월 정산서·엑셀의 부가세 표기는 오더의 승인 조건 값에서만', async () => {
    await clean();
    const seed = (modes) => page.evaluate((modes) => {
      try { closeModal(true); } catch (e) {}
      state.aptOffices = [{ id: 'of1', complex: '가상단지', manager: '', phone: '' }];
      state.aptOrders = modes.map((m, i) => Object.assign({ id: 'v' + i, officeId: 'of1', unit: (101 + i) + '동 101호', text: '보수' + i, amount: 110000 + i * 10000, date: '2026-09-01', status: 'done', doneAt: '2026-09-10' },
        m ? { commercialTerms: { workKind: 'repair', scope: '보수', exclusions: [], vatMode: m, quotedAmount: 110000 + i * 10000, validUntil: '2027-12-31', scheduleWindow: '협의' } } : {}));
      aptSettle('of1', '2026-09');
      return document.getElementById('apsText').value;
    }, modes);
    const inc = await seed(['included']);
    assert(/합계: 110,000원 \(부가세 포함\)/.test(inc) && !/별도/.test(inc), '포함 조건 오더에 \'별도\'라 적었다:\n' + inc);
    const exc = await seed(['excluded', 'excluded']);
    assert(/합계: 230,000원 \(부가세 별도\)/.test(exc), '별도 조건:\n' + exc);
    const mix = await seed(['included', 'excluded', '']);
    assert(/\[부가세 포함\]/.test(mix) && /\[부가세 별도\]/.test(mix), '섞이면 줄마다 적어야 한다:\n' + mix);
    assert(/합계: 360,000원 \(포함 110,000원 · 별도 120,000원 · 표기 없음 130,000원\)/.test(mix), '섞이면 합계를 나눠 적어야 한다:\n' + mix);
    const unk = await seed(['', '']);
    assert(!/부가세/.test(unk), '조건을 모르는 오더에 부가세 표기를 지어냈다:\n' + unk);
    const x = await page.evaluate(async () => {
      window.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: aoa => ({ aoa }), book_append_sheet: (wb, ws) => { window.__aoa = ws.aoa; } }, writeFile: () => {} };
      state.aptOrders[0].commercialTerms = { vatMode: 'included' }; state.aptOrders.splice(1);
      aptSettle('of1', '2026-09');
      await [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /엑셀/.test(b.textContent)).onclick();
      return JSON.stringify(window.__aoa);
    });
    assert(/"부가세"/.test(x) && /"포함"/.test(x) && /"합계",110000,"부가세 포함"/.test(x) && !/별도/.test(x), '엑셀 부가세 열·합계 표기: ' + x);
  });

  await test('ⓗ 6개월보다 오래된 미결 오더 — 정산서 월 목록에 있고 입금 확인에 닿는다', async () => {
    await clean();
    const r = await page.evaluate(async () => {
      state.aptOffices = [{ id: 'of1', complex: '가상단지', manager: '', phone: '' }];
      state.aptOrders = [
        { id: 'old1', officeId: 'of1', unit: '101동 101호', text: '3월 작업', amount: 50000, date: '2026-02-20', status: 'billed', doneAt: '2026-03-05' },
        { id: 'old2', officeId: 'of1', unit: '101동 102호', text: '1월 입금완료', amount: 40000, date: '2026-01-02', status: 'paid', doneAt: '2026-01-05' }];
      aptSettle('of1');
      const opts = [...document.querySelectorAll('#apsYm option')].map(o => o.value + '|' + o.textContent);
      const hint = !!document.getElementById('apsOldOpen');
      closeModal(true);
      aptSettle('of1', '2026-03');
      const sel = (document.getElementById('apsYm') || {}).value;
      let ids = null; const real = window.settlePaidAptOrders;
      window.settlePaidAptOrders = async (x) => { ids = x; return { total: 50000 }; };
      window.confirm = () => true;
      try { await [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /입금 확인/.test(b.textContent)).onclick(); }
      finally { window.settlePaidAptOrders = real; }
      return { opts, hint, sel, ids };
    });
    assert(r.opts.some(o => /^2026-03\|.*미결/.test(o)), '6개월 밖 청구분의 달이 월 목록에 없다: ' + JSON.stringify(r.opts));
    assert(!r.opts.some(o => /^2026-01\|/.test(o)), '입금이 끝난 옛 달까지 목록에 넣었다: ' + JSON.stringify(r.opts));
    assert(r.hint, '6개월 전 미결 오더 안내가 없다');
    assert(r.sel === '2026-03', '고른 옛 달이 선택되지 않았다: ' + r.sel);
    assert(JSON.stringify(r.ids) === '["old1"]', '옛 달 청구분이 입금 확인에 닿지 않는다: ' + JSON.stringify(r.ids));
  });

  await test('pageerror 0', async () => { assert(errs.length === 0, errs.join('\n')); });

  await browser.close();
  const bad = results.filter(x => !x.ok).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' 통과');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL (crash) ' + (e && e.stack || e)); process.exit(1); });

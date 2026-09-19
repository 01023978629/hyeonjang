/* pay-receipt.e2e.js — 🧾 간이영수증 (서류 만들기) 회귀
   대표 요청: "현장별 보기에 서류만들기에 간이세금계산서 양식으로 ... 만들기 추가해줘"
   주신 양식은 제목도 「인테리어 간이영수증」이고 맨 아래가 "정히 영수합니다 / 수령인" 이라 영수증이다.

   여기서 지키는 것 — 틀리면 고객 손에 틀린 종이가 남는 것들:
     · 누계 수금액이 '이번에 받은 돈'으로 둔갑하지 않는다 (기존 수금 영수증이 그렇게 떨어진다)
     · 받은 돈을 1.1 로 나눠 부가세를 지어내지 않는다 (부가세 별도 견적에서 통째로 틀린다)
     · 앱이 모르는 칸(결제방법·입금자명)을 자동으로 채우지 않는다 — 빈칸으로 남겨 손으로 쓰게 한다
     · 내역 합계와 이번에 받은 돈이 다르면 두 숫자를 나란히 말한다
     · 공급자 정보는 COMPANY 에서 읽는다 — 그림의 값을 코드에 박지 않는다
     · 세금계산서라고 적지 않는다 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 900) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayConfigDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjOfficeOpsBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {}; });

  const N = '탄방 이편한아파트 105동 602호';
  const seed = () => page.evaluate(n => {
    try { closeModal(true); } catch (e) {}
    // 누계 수금 380만(=300만 + 100만 − 20만 정정). 0 으로 두면 '누계가 새어 나오는' 사고가
    // 아예 재현되지 않아, 그걸 막는 검사가 통과하고도 아무것도 지키지 못한다.
    state.projects = [{ name: n, stage: 4, received: 3800000, doneAt: '2026-09-18', phases: ['설비'],
      cost: { material: 0, labor: 0, outsource: 0 },
      customer: { name: '홍길동', phone: '010-1111-2222', addr: '대전 서구 탄방동 105-1' }, archived: false }];
    state.files = []; state.quotes = [];
    // 입금 기록 세 건 — 하나는 정정(마이너스)이라 영수증 후보에서 빠져야 한다
    state.payLog = [
      { project: n, d: '2026-09-10', amt: 3000000 },
      { project: n, d: '2026-09-18', amt: 1000000 },
      { project: n, d: '2026-09-12', amt: -200000 },
    ];
    state.activeProject = n; state.dirty = false;
  }, N);

  const openDialog = () => page.evaluate(n => { payRcptDialog(n); }, N);
  const waitDoc = () => page.waitForFunction(() => !!document.querySelector('#modalRoot #hjDocPdf'), null, { timeout: 8000 });
  const make = () => page.evaluate(() => { [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => x.textContent.includes('영수증 만들기')).click(); });
  const docHtml = () => page.evaluate(() => document.querySelector('#modalRoot iframe').getAttribute('srcdoc'));

  await test('서류 만들기 화면에 [🧾 간이영수증] 이 있고 눌러서 열린다', async () => {
    await seed();
    await page.evaluate(n => docHubView(n), N);
    const has = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#modalRoot .docHubBtn')].find(x => /간이영수증/.test(x.textContent));
      return { has: !!b, act: b ? b.dataset.act : '', wired: !!b && typeof b.onclick === 'function' };
    });
    assert(has.has && has.act === 'payrcpt', '서류 만들기에 간이영수증 항목이 없다: ' + JSON.stringify(has));
    assert(has.wired, '모달 버튼이 직접 배선되어야 한다(위임 밖)');
    await page.evaluate(() => [...document.querySelectorAll('#modalRoot .docHubBtn')].find(x => /간이영수증/.test(x.textContent)).click());
    await page.waitForSelector('#prcAmt', { timeout: 5000 });
  });

  await test('정산 문서 화면에도 카드로 들어가고, 빈 양식이 바로 나가지 않는다', async () => {
    await seed();
    await page.evaluate(n => settleDocs(n), N);
    const card = await page.evaluate(() => {
      const b = document.querySelector('#modalRoot .sdCard[data-k="payrcpt"]');
      return { has: !!b, txt: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' };
    });
    assert(card.has && /간이영수증/.test(card.txt), '정산 문서 카드가 없다: ' + JSON.stringify(card));
    await page.evaluate(() => document.querySelector('#modalRoot .sdCard[data-k="payrcpt"]').click());
    // ★ 미리보기가 아니라 입력 화면이 떠야 한다 — 바로 만들면 금액이 빈 종이가 나간다
    await page.waitForSelector('#prcAmt', { timeout: 5000 });
    const preview = await page.evaluate(() => !!document.querySelector('#modalRoot #hjDocPdf'));
    assert(!preview, '금액을 묻지 않고 곧장 문서를 만들어 버렸다');
  });

  await test('★ 앱이 모르는 칸은 자동으로 채우지 않는다 (금액·날짜·결제방법·입금자명)', async () => {
    const r = await page.evaluate(() => ({
      amt: document.getElementById('prcAmt').value,
      date: document.getElementById('prcDate').value,
      method: document.getElementById('prcMethod').value,
      payer: document.getElementById('prcPayer').value,
      kind: document.getElementById('prcKind').value,
      vat: document.getElementById('prcVat').value,
    }));
    assert(r.amt === '' && r.date === '', '금액·날짜를 미리 채웠다 — 누계가 이번 금액으로 둔갑한다: ' + JSON.stringify(r));
    assert(r.method === '' && r.payer === '' && r.kind === '' && r.vat === '', '앱이 모르는 칸을 채웠다: ' + JSON.stringify(r));
  });

  await test('★ 입금 기록에서 고르면 그 한 건의 금액·날짜가 들어간다 (정정 기록은 목록에 없다)', async () => {
    const rows = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .prcRow')].map(b => ({ d: b.dataset.d, a: b.dataset.a })));
    assert(rows.length === 2, '양수 입금 2건만 보여야 한다: ' + JSON.stringify(rows));
    assert(rows.every(x => Number(x.a) > 0), '정정(마이너스) 기록이 목록에 남았다: ' + JSON.stringify(rows));
    assert(rows[0].d === '2026-09-18', '최근 것이 위로 와야 한다: ' + JSON.stringify(rows));
    await page.evaluate(() => document.querySelectorAll('#modalRoot .prcRow')[0].click());
    const r = await page.evaluate(() => ({ amt: document.getElementById('prcAmt').value, date: document.getElementById('prcDate').value }));
    assert(/1,?000,?000/.test(r.amt) && r.date === '2026-09-18', '고른 입금이 칸에 안 들어갔다: ' + JSON.stringify(r));
  });

  await test('★ 누계(400만)가 아니라 고른 한 건(100만)이 영수증에 찍힌다', async () => {
    await make(); await waitDoc();
    const h = await docHtml();
    assert(/1,000,000\s*원/.test(h), '고른 금액이 안 보인다');
    assert(!/4,000,000|3,800,000/.test(h), '누계가 영수증에 찍혔다');
    assert(/金 일백만원정/.test(h), '한글 금액 표기가 없다: ' + (h.match(/金[^<]*/) || [''])[0]);
  });

  await test('★ 받은 돈을 1.1 로 나눠 부가세를 지어내지 않는다', async () => {
    const h = await docHtml();
    assert(!/909,091|90,909|부가가치세|공급가액/.test(h), '있지도 않은 부가세 칸이 생겼다');
  });

  await test('★ 세금계산서라고 적지 않는다 — 다른 서류로 오해하면 손님이 곤란해진다', async () => {
    const h = await docHtml();
    const title = (h.match(/<title>([^<]*)<\/title>/) || ['', ''])[1];
    assert(!/세금계산서|계산서/.test(title), '문서 제목이 계산서다: ' + title);
    assert(!/<h1[^>]*>[^<]*계산서/.test(h), '표지 제목이 계산서다');
    assert(/간 이 영 수 증/.test(h), '문서 제목이 간이영수증이어야 한다');
    assert(/정히 영수합니다/.test(h) && /수령인/.test(h), '양식의 영수 문구·수령인 칸이 없다');
    // 세금계산서·현금영수증이 필요하면 따로 발행한다는 안내는 있어야 한다
    assert(/세금계산서나 현금영수증이 필요하시면/.test(h), '따로 발행한다는 안내가 없다');
  });

  await test('★ 공급자 정보는 COMPANY 에서 읽는다 — 양식의 값을 코드에 박지 않았다', async () => {
    const r = await page.evaluate(() => {
      const before = payRcptHTML(state.projects[0].name, { amt: 1000000 });
      const keep = { name: COMPANY.name, owner: COMPANY.owner, bizno: COMPANY.bizno, tel: COMPANY.tel, addr: COMPANY.addr };
      COMPANY.name = '가상상호'; COMPANY.owner = '가상대표'; COMPANY.bizno = '000-00-00000'; COMPANY.tel = '010-0000-0000'; COMPANY.addr = '가상주소';
      const after = payRcptHTML(state.projects[0].name, { amt: 1000000 });
      Object.assign(COMPANY, keep);
      return { hadReal: /895-48-01132/.test(before), fake: /가상상호/.test(after) && /000-00-00000/.test(after), stillReal: /895-48-01132/.test(after) };
    });
    assert(r.hadReal, '평소에는 실제 사업자번호가 찍혀야 한다');
    assert(r.fake && !r.stillReal, '공급자 정보가 코드에 박혀 있다 — COMPANY 를 바꿔도 그대로다: ' + JSON.stringify(r));
  });

  await test('★ 내역 합계와 이번에 받은 돈이 다르면 두 숫자를 나란히 말한다', async () => {
    const h = await page.evaluate(n => payRcptHTML(n, { amt: 1000000, items: [{ name: '변기 안착', qty: 1, price: 3000000 }] }), N);
    assert(/3,000,000/.test(h) && /1,000,000/.test(h), '두 숫자가 다 있어야 한다');
    assert(/이번에 받은 금액은 <b>|이번에 받은 금액은/.test(h.replace(/<b>/g, '')), '어느 쪽이 받은 돈인지 말하지 않는다');
  });

  await test('수량×단가로 금액이 계산되고 합계가 맞는다', async () => {
    const h = await page.evaluate(n => payRcptHTML(n, { amt: 0, items: [{ name: '변기 안착', qty: 2, price: 50000 }, { name: '실리콘', qty: 3, price: 10000 }] }), N);
    assert(/100,000/.test(h) && /30,000/.test(h) && /130,000/.test(h), '계산이 틀렸다');
  });

  await test('★ 금액을 안 주면 누계가 대신 찍히지 않는다 — 밑줄 빈칸으로 남는다', async () => {
    const r = await page.evaluate(n => {
      const h = payRcptHTML(n, {});
      return { ok: !!h, recv: projStats(n).recv,
        blanks: (h.match(/border-bottom:1px solid #c7d2e0/g) || []).length,
        leaked: /3,800,000/.test(h), noZero: !/>0 원</.test(h),
        rows: (h.match(/<td class="c">[1-6]<\/td>/g) || []).length };
    }, N);
    assert(r.ok, '빈 양식을 못 만든다');
    assert(r.recv === 3800000, '시드가 누계를 안 채웠다 — 이 검사가 헛돈다: ' + r.recv);
    assert(!r.leaked, '금액을 안 줬는데 누계 380만이 영수증에 찍혔다');
    assert(r.blanks >= 10, '빈칸이 밑줄로 남지 않았다: ' + r.blanks);
    assert(r.noZero, "금액이 '0 원'으로 찍혔다 — 비워야 한다");
    assert(r.rows === 6, '수령내역이 6줄이어야 한다: ' + r.rows);
  });

  await test('★ AI 가 영수증을 바로 보내려 하면 금액 확인 화면을 연다', async () => {
    await seed();
    const r = await page.evaluate(async n => await settleDocShare(n, 'payrcpt'), N);
    assert(r && r.안내 && /금액/.test(r.안내), '빈 양식이 그대로 나갈 뻔했다: ' + JSON.stringify(r));
    assert(!r.완료 && !r.파일, '실제로 파일을 만들어 버렸다: ' + JSON.stringify(r));
  });

  await test('영수증을 만들어도 입금 기록·현장 자료는 바뀌지 않는다', async () => {
    const r = await page.evaluate(n => {
      const before = JSON.stringify(serializeData());
      payRcptHTML(n, { amt: 1000000, date: '2026-09-18', method: '계좌이체', payer: '홍길동', items: [{ name: 'x', qty: 1, price: 1 }] });
      const after = JSON.parse(JSON.stringify(serializeData())), b = JSON.parse(before);
      const changed = Object.keys(b).filter(k => k !== 'savedAt' && JSON.stringify(b[k]) !== JSON.stringify(after[k]));
      return { changed };
    }, N);
    assert(r.changed.length === 0, '영수증을 만들었을 뿐인데 자료가 달라졌다: ' + r.changed.join(', '));
  });

  await test('페이지 오류가 없다', async () => {
    const real = errs.filter(e => !/ResizeObserver|favicon/i.test(e));
    assert(real.length === 0, '오류: ' + real.join(' / '));
  });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (bad.length ? bad.length + '건 실패' : '전부 통과 (' + results.length + '건)'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

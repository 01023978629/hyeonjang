/* brief-actions.e2e.js — ☀️ 오늘의 브리핑 원탭 액션 회귀 테스트 (Playwright)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'.
   실발신 없음 — hjSendSms/hjBriefLeadContact 후킹으로 딥링크 의도 캡처(location 미이동). */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const APP = 'http://localhost:8299/index.html';
const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e).slice(0, 800) }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(cond, msg) { if (!cond) throw new Error('assert: ' + msg); }

const RAW_CUST = '01012345678';     // 진행/미수 현장 고객 (원문 — 화면에 노출되면 안 됨)
const RAW_FOLLOW = '01055557777';   // 후속 유도 현장 고객
const RAW_LEAD = '01098765432';     // 리드 노트 텍스트 내 전화

(async () => {
  const launchOpts = {};
  if (process.env.PLAYWRIGHT_EXECUTABLE) launchOpts.executablePath = process.env.PLAYWRIGHT_EXECUTABLE;
  else if (process.platform !== 'win32') launchOpts.executablePath = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 시드: 진행 현장(고객 전화·미수)·후속 유도 현장·리드 노트 → 대시보드 브리핑 렌더 ──
  await page.evaluate(({ rc, rf, rl }) => {
    window.__briefOpen = true;
    state.tab = 'dashboard';
    state.projects = [
      { name: '행복빌라 201호', stage: 2, received: 1000000, phases: ['철거', '도배', '마루'], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '김사장', phone: rc, addr: '서울시 강남구' }, archived: false },
      { name: '샛별상가 1층', stage: 1, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '이대표', phone: rf, addr: '경기도 성남시' }, archived: false }
    ];
    state.files = [
      { id: 'estA', kind: 'estimate', project: '행복빌라 201호', name: '행복빌라 견적서', est: { amount: 5000000 }, when: new Date('2026-07-10') }
    ];
    state.notes = [
      { id: 'leadA', date: '2026-07-20 10:00', project: '', text: '[홈페이지 상담 리드]\n공사: 아파트 전체\n메모: 상담희망 연락처 ' + rl }
    ];
    render();
  }, { rc: RAW_CUST, rf: RAW_FOLLOW, rl: RAW_LEAD });
  await page.waitForTimeout(400);

  // 실발신 차단 + 딥링크 의도 캡처: hjSendSms(청구)·hjBriefLeadContact(리드) 후킹. 나머지 원본 로직 유지.
  await page.evaluate(() => {
    window.__sms = [];
    window.__leadNav = [];
    const realLead = window.hjBriefLeadContact;
    window.hjSendSms = function (phone, text) { window.__sms.push({ phone: String(phone || ''), text: String(text || '') }); };
    window.hjBriefLeadContact = function (noteId, mode) {
      // 원본 로직으로 전화 원문을 해석하되, location 이동 대신 딥링크 문자열만 캡처
      const n = (state.notes || []).find(x => x && x.id === noteId);
      const ph = telHref(hjBriefLeadPhone(n));
      window.__leadNav.push({ noteId, mode, ok: !!ph, href: ph ? (mode === 'call' ? 'tel:' : 'sms:') + ph : '' });
    };
    void realLead;
  });

  await test('0. 후속 현장 고객 전화 조회 정상(기존 data-callcust 핸들러 경로)', async () => {
    const ok = await page.evaluate(() => { const p = state.projects.find(x => x.name === '샛별상가 1층'); return !!(p && telHref(p.customer.phone)); });
    assert(ok, '후속 현장 전화 미해석');
  });

  await test('1. 브리핑 카드 렌더 + 세 섹션 원탭 버튼 존재', async () => {
    assert(await page.$('.brief-card'), '브리핑 카드 없음');
    assert(await page.$('.brief-card [data-workorderp="행복빌라 201호"]'), '진행 현장 [작업지시] 버튼 없음');
    assert(await page.$('.brief-card [data-briefbill="행복빌라 201호"]'), '미수 현장 [청구] 버튼 없음');
    assert(await page.$('.brief-card [data-callcust="샛별상가 1층"]'), '후속 [전화] 버튼 없음');
    assert(await page.$('.brief-card [data-smscust="샛별상가 1층"]'), '후속 [문자] 버튼 없음');
    assert(await page.$('.brief-card [data-briefleadcall="leadA"]'), '리드 [전화] 버튼 없음(텍스트 전화 파싱 실패)');
    assert(await page.$('.brief-card [data-briefleadsms="leadA"]'), '리드 [문자] 버튼 없음');
  });

  await test('2. [📋 작업지시] 클릭 → openWorkOrder 모달(현장 프리필)', async () => {
    await page.click('.brief-card [data-workorderp="행복빌라 201호"]');
    await page.waitForSelector('#woSite', { timeout: 5000 });
    const site = await page.$eval('#woSite', el => el.value);
    assert(site === '행복빌라 201호', '현장 프리필 불일치: ' + site);
    await page.evaluate(() => closeModal());
  });

  await test('3. [💬 청구] 클릭 → hjSendSms(고객번호 + 현장 + 미수액 문안)', async () => {
    await page.evaluate(() => { window.__sms.length = 0; });
    await page.click('.brief-card [data-briefbill="행복빌라 201호"]');
    await page.waitForTimeout(150);
    const sms = await page.evaluate(() => window.__sms.slice());
    assert(sms.length === 1, 'hjSendSms 호출 1회 아님: ' + JSON.stringify(sms));
    assert(sms[0].phone === RAW_CUST, 'sms 대상 번호 불일치: ' + sms[0].phone);
    const body = sms[0].text;
    assert(body.indexOf('행복빌라 201호') >= 0, '문안에 현장명 없음: ' + body);
    assert(body.indexOf('4,000,000') >= 0, '문안에 미수액(4,000,000) 없음: ' + body);
    assert(body.indexOf('만물인테리어') >= 0, '문안에 업체명 없음');
  });

  await test('4. 챙길 연락 — 리드 [📞][💬] 텍스트 전화 파싱 딥링크 + 후속 버튼 동작', async () => {
    // 리드: 노트 텍스트 내 전화를 파싱해 tel:/sms: 딥링크 생성(원본 hjBriefLeadPhone 경로)
    await page.evaluate(() => { window.__leadNav.length = 0; });
    await page.click('.brief-card [data-briefleadcall="leadA"]');
    await page.click('.brief-card [data-briefleadsms="leadA"]');
    await page.waitForTimeout(150);
    const nav = await page.evaluate(() => window.__leadNav.slice());
    assert(nav.some(x => x.mode === 'call' && x.href === 'tel:' + RAW_LEAD), '리드 tel 딥링크(텍스트 파싱) 없음: ' + JSON.stringify(nav));
    assert(nav.some(x => x.mode === 'sms' && x.href === 'sms:' + RAW_LEAD), '리드 sms 딥링크 없음');
    // 후속: 기존 data-callcust/data-smscust 재사용 — 클릭이 pageerror 없이 처리(전화 해석됨)
    await page.click('.brief-card [data-callcust="샛별상가 1층"]');
    await page.click('.brief-card [data-smscust="샛별상가 1층"]');
    await page.waitForTimeout(100);
  });

  await test('5. 화면 전화 원문 노출 없음(마스킹만)', async () => {
    const bodyTxt = await page.evaluate(() => document.querySelector('.brief-card').innerText);
    assert(bodyTxt.indexOf(RAW_CUST) < 0, '진행/미수 고객 원문 노출');
    assert(bodyTxt.indexOf(RAW_FOLLOW) < 0, '후속 고객 원문 노출');
    assert(bodyTxt.indexOf(RAW_LEAD) < 0, '리드 전화 원문 노출');
    // 후속 마스킹(뒷 4자리 ···7777)만 노출 허용
    assert(bodyTxt.indexOf('7777') >= 0, '후속 마스킹(뒷4자리) 표시 확인');
  });

  await test('8. 목표 페이스 경보 — 앞서갈 때 오발화 없음(%↔원 단위 불일치 회귀)', async () => {
    const r = await page.evaluate(() => {
      const ym = localDate().slice(0, 7);
      // 앞서가는 상황: 목표 100만, 이번달 수금 500만 → 달성률 500%(기대 진행률 훨씬 초과)
      state.goals = { month: 1000000, year: 0 };
      state.payLog = [{ d: ym + '-05', project: '행복빌라 201호', amt: 5000000 }];
      const gA = goalProgress();
      const nagA = (typeof briefExtraItems === 'function' ? briefExtraItems() : []).some(it => /페이스 주의/.test(it.t || ''));
      // 뒤처지는 상황: 목표 1억, 이번달 수금 0 → 달성률 0%
      state.goals = { month: 100000000, year: 0 };
      state.payLog = [];
      const gB = goalProgress();
      const nagB = briefExtraItems().some(it => /페이스 주의/.test(it.t || ''));
      state.goals = {}; state.payLog = [];
      return { paceA: gA.monthPace, expA: gA.monthExpected, nagA, paceB: gB.monthPace, expB: gB.monthExpected, nagB, day: gB.dayOfMonth };
    });
    assert(r.paceA >= r.expA, '시드 확인: 앞서가는 상황(pace≥expected): pace=' + r.paceA + ' exp=' + r.expA);
    // 앞서가면 날짜와 무관하게 경보 없어야 함(옛 버그: 목표만 있으면 10일부터 무조건 발화)
    assert(!r.nagA, '앞서가는데 페이스 경보 오발화 — %↔원 단위 불일치 버그 재발');
    // 뒤처지면(달성률 0%) 경보가 실제 페이스에 반응: 10일+엔 발화, 그 전엔 침묵
    if (r.day >= 10) assert(r.nagB, '뒤처지는데(달성률 0%, ' + r.day + '일) 페이스 경보 미발화');
    else assert(!r.nagB, '10일 이전에는 페이스 경보 없음(day=' + r.day + ')');
  });

  await test('6. serializeData() 직렬화 불변 — 브리핑 관련 새 키 없음', async () => {
    const keys = await page.evaluate(() => Object.keys(serializeData()));
    const bad = keys.filter(k => /brief/i.test(k));
    assert(bad.length === 0, '직렬화에 브리핑 키 추가됨: ' + bad.join(','));
    assert(keys.indexOf('projects') >= 0 && keys.indexOf('notes') >= 0, '직렬화 기본 키 손상');
  });

  await test('7. pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror 발생: ' + errs.join(' | '));
  });

  await browser.close();
  const pass = results.filter(r => r.ok).length;
  console.log('\n=== brief-actions: ' + pass + '/' + results.length + ' passed ===');
  results.filter(r => !r.ok).forEach(r => console.log('  FAIL ' + r.name + '\n    ' + r.err));
  process.exit(pass === results.length ? 0 : 1);
})();

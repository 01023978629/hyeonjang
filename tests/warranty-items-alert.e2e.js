/* warranty-items-alert.e2e.js — 대표 결정 2026-10-01: 보증 만료 알림은 항목별 법정 기간대로("방수는 3년, 기본 1년, 법적과 동일하게").
   v330 은 알림·점검 문자·파수꾼을 가장 늦은 항목 끝(약 3년)에만 냈다. 이제 hjWarranty(p).items 의 expiresAt 묶음마다
   '마감·전기 1년'·'설비 2년'·'방수 3년' 을 따로 알린다. 숫자는 WARRANTY_ITEMS_DEFAULT/hjWarranty 에서만 온다.

     ① warrantyDue — 한 줄 = 현장 하나, daysLeft·item 은 지금 말할 항목 묶음, expiry 는 전체 보증 종료(보증서와 같은 값)
        · 알릴 묶음 = 60일 안 다음 만료, 없으면 가장 최근 지난 만료 · 구형 숫자 보증(모든 항목 같은 날)은 이름 없이
     ② 파수꾼 hjWatchScan — 묶음마다 한 줄(D-N · 항목 · 기간), 마지막 묶음은 '(전체 보증 종료)'
     ③ 현장 보드 — '마감·전기 보증 D-19' 처럼 항목 이름이 붙고, 끝난 보증은 긴급이 아니다
     ④ 알림 센터(briefExtraItems)·AI 플래너(aiPlannerScan) 의 글에도 항목·기간
     ⑤ 🛡 AS 보증 관리 — 배지 '설비 2년 만료' / 'D-19' / '만료됨'(전체 끝) · '전체 보증 종료 YYYY-MM-DD' · 점검 안내 버튼
     ⑥ 점검 문자(warrantySms) — 항목 이름을 넣되 문장 틀 유지, 이어지는 보증을 한 문장으로 · 전체 끝·구형은 예전 문장
     ⑦ 보증서 문서(warrantyHTML·hjWarranty.end)는 이 결정으로 바뀌지 않는다 · state 를 바꾸지 않는다

   시계는 한국 2026-10-01 09:00 에 고정. 자료는 전부 가짜(전화 010-0000-0000). 전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
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
  await page.clock.setFixedTime(new Date('2026-10-01T09:00:00+09:00'));
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
    window.__sms = []; window.hjSendSms = (ph, t) => { window.__sms.push(t); };
  });

  // 시드 — 완공일만으로 법정 기본 항목이 파생되는 현장들(🛡 보증 시작을 안 누른 가장 흔한 경우) + 구형 숫자 보증 하나
  const seed = () => page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    const mk = (name, doneAt, extra) => Object.assign({ name, stage: STAGES.length - 1, doneAt, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false, customer: { name: '가상 고객', phone: '010-0000-0000' } }, extra || {});
    state.projects = [
      mk('가상마감임박', '2025-10-20'),   // 마감·전기 2026-10-20 D-19 · 설비 2027 · 방수 2028
      mk('가상설비지남', '2024-09-10'),   // 마감 2025 지남 · 설비 2026-09-10 D+21 · 방수 2027-09-10
      mk('가상방수마지막', '2023-10-15'), // 방수 2026-10-15 D-14 = 전체 보증 종료
      mk('가상중간', '2025-04-01'),       // 마감 2026-04-01 D+183 · 설비 2027 — 60일 창 안 묶음 없음
      mk('가상전체끝', '2022-01-10'),     // 전부 끝(방수 2025-01-10)
      mk('가상구형', '2021-11-20', { warranty: 60 }) // 네 항목 모두 60개월 → 2026-11-20 D-50, 한 묶음
    ];
    state.files = []; state.schedule = []; state.asLog = []; state.expenses = []; state.quotes = []; state.payLog = []; state.aptOrders = [];
    window.__toasts = []; window.__sms = [];
    return JSON.stringify(state.projects);
  });

  await test('시계 확인 — 한국 2026-10-01', async () => {
    const r = await page.evaluate(() => localDate());
    assert(r === '2026-10-01', r);
  });

  await test('① warrantyDue — 항목 묶음 기준 daysLeft·item, expiry 는 전체 보증 종료(보증서 값)', async () => {
    const before = await seed();
    const r = await page.evaluate(() => {
      const due = warrantyDue();
      const row = n => due.find(w => w.name === n);
      const H = n => hjWarranty(state.projects.find(p => p.name === n));
      return { names: due.map(w => w.name), count: due.length, unique: new Set(due.map(w => w.name)).size,
        a: row('가상마감임박'), b: row('가상설비지남'), c: row('가상방수마지막'), d: row('가상중간'), e: row('가상전체끝'), f: row('가상구형'),
        hA: H('가상마감임박').end, hF: H('가상구형').end, after: JSON.stringify(state.projects) };
    });
    assert(r.count === 6 && r.unique === 6, '한 줄 = 현장 하나(항목마다 줄을 늘리지 않는다): ' + JSON.stringify(r.names));
    assert(r.a && r.a.item.label === '마감·전기' && r.a.item.term === '1년' && r.a.daysLeft === 19 && r.a.item.expiresAt === '2026-10-20', '마감·전기 1년 임박: ' + JSON.stringify(r.a && r.a.item));
    assert(r.a.expiry === r.hA && r.a.expiry === '2028-10-20' && r.a.allDaysLeft > 700, '전체 보증 종료는 보증서(hjWarranty.end)와 같은 3년 끝날: ' + JSON.stringify([r.a.expiry, r.hA]));
    assert(r.a.remaining.map(g => g.label).join('/') === '설비/방수', '그 뒤에 이어지는 묶음: ' + JSON.stringify(r.a.remaining));
    assert(r.b && r.b.item.label === '설비' && r.b.item.term === '2년' && r.b.daysLeft === -21, '설비 2년 지남 — 가장 최근 지난 묶음(마감 1년 지난 것이 아니라): ' + JSON.stringify(r.b && r.b.item));
    assert(r.c && r.c.item.label === '방수' && r.c.item.last === true && r.c.daysLeft === 14 && r.c.remaining.length === 0, '방수 3년 = 마지막 묶음: ' + JSON.stringify(r.c && r.c.item));
    assert(r.d && r.d.item.label === '마감·전기' && r.d.daysLeft === -183, '60일 창 안 묶음이 없으면 가장 최근 지난 만료(마감 1년)를 말한다: ' + JSON.stringify(r.d && r.d.item));
    assert(r.e && r.e.allDaysLeft < 0 && r.e.item.label === '방수' && r.e.daysLeft < -600, '전부 끝난 현장도 알림 모집단에 남는다(보드가 창을 좁힌다): ' + JSON.stringify(r.e && [r.e.allDaysLeft, r.e.daysLeft]));
    assert(r.f && r.f.item.all === true && r.f.daysLeft === 50 && r.f.item.term === '5년' && r.f.expiry === r.hF, '구형 숫자 보증은 네 항목이 한 묶음(all): ' + JSON.stringify(r.f && r.f.item));
    assert(r.after === before, '읽기 전용 — state.projects 가 바뀌었다');
  });

  await test('② 파수꾼 — 묶음마다 한 줄, 항목·기간, 마지막 묶음은 (전체 보증 종료)', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const w = hjWatchScan().warranty.map(v => ({ name: v.name, dday: v.dday, item: v.item, term: v.term, last: v.last, end: v.end }));
      __watchOpen = true; const d = document.createElement('div'); d.innerHTML = hjWatchCardHTML(); __watchOpen = false;
      return { w, text: d.textContent.replace(/\s+/g, ' ') };
    });
    assert(JSON.stringify(r.w.map(v => v.name + ':' + v.dday)) === JSON.stringify(['가상방수마지막:14', '가상마감임박:19', '가상구형:50']), '60일 안 묶음만, 가까운 순: ' + JSON.stringify(r.w));
    assert(r.w[1].item === '마감·전기' && r.w[1].term === '1년' && r.w[1].last === false && r.w[1].end === '2026-10-20', '마감·전기 1년 줄: ' + JSON.stringify(r.w[1]));
    assert(r.w[0].item === '방수' && r.w[0].last === true, '방수 = 마지막 묶음: ' + JSON.stringify(r.w[0]));
    assert(r.w[2].item === '' && r.w[2].term === '5년', '구형 숫자 보증은 항목 이름 없이: ' + JSON.stringify(r.w[2]));
    assert(/가상마감임박 D-19 마감·전기 1년 보증 2026-10-20 만료/.test(r.text), '파수꾼 카드 줄이 항목·기간을 말하지 않는다: ' + r.text);
    assert(/가상방수마지막 D-14 방수 3년 보증 2026-10-15 만료 \(전체 보증 종료\)/.test(r.text), '마지막 묶음에 전체 보증 종료 표시가 없다: ' + r.text);
    assert(/보증만료 3/.test(r.text), '칩 개수: ' + r.text);
  });

  await test('③ 현장 보드 — 항목 이름이 붙은 라벨, 14일 안쪽만 긴급, 끝난 보증은 창 밖', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const b = projHealthBoard();
      const w = n => { const row = b.rows.find(x => x.name === n); return row ? { level: row.level, r: row.reasons.filter(x => x.axis === 'warranty') } : null; };
      return { a: w('가상마감임박'), b: w('가상설비지남'), c: w('가상방수마지막'), d: w('가상중간'), e: w('가상전체끝'), f: w('가상구형') };
    });
    assert(r.a && r.a.r.length === 1 && r.a.r[0].label === '마감·전기 보증 D-19' && r.a.r[0].urgent === false, '마감·전기 D-19 라벨: ' + JSON.stringify(r.a));
    assert(r.b && r.b.r.length === 1 && r.b.r[0].label === '설비 보증만료 D+21' && r.b.r[0].urgent === false, '설비 D+21 관찰: ' + JSON.stringify(r.b));
    assert(r.c && r.c.r.length === 1 && r.c.r[0].label === '방수 보증 D-14' && r.c.r[0].urgent === true && r.c.level === 'urgent', '방수 D-14 긴급: ' + JSON.stringify(r.c));
    assert((!r.d || r.d.r.length === 0) && (!r.e || r.e.r.length === 0), '183일·600일 전에 끝난 묶음은 보드에 없다: ' + JSON.stringify([r.d, r.e]));
    assert(r.f && r.f.r[0].label === '보증 D-50', '구형 숫자 보증 라벨은 예전 그대로: ' + JSON.stringify(r.f));
  });

  await test('④ 알림 센터·AI 플래너 글에 항목·기간', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const brief = briefExtraItems().find(x => x.ic === '🛡');
      let plan = [];
      try { aiOpsEnsureState(); plan = aiPlannerScan().filter(t => t.type === 'warranty').map(t => ({ project: t.project, reason: t.reason, title: t.title })); } catch (e) { plan = [{ err: String(e) }]; }
      return { brief, plan };
    });
    assert(r.brief && /보증 만료 임박 3곳/.test(r.brief.t) && r.brief.sub.startsWith('가상방수마지막 방수(3년) D-14 등'), '알림 센터 줄: ' + JSON.stringify(r.brief));
    const byP = Object.fromEntries(r.plan.map(x => [x.project, x.reason]));
    assert(byP['가상마감임박'] === '마감·전기 보증 만료(1년) D-19 — 재영업 기회', '플래너 마감·전기: ' + JSON.stringify(r.plan));
    assert(byP['가상방수마지막'] === '방수 보증 만료(3년) D-14 — 재영업 기회' && byP['가상구형'] === '보증 만료 D-50 — 재영업 기회', '플래너 방수·구형: ' + JSON.stringify(r.plan));
    assert(!byP['가상설비지남'] && !byP['가상전체끝'], '지난 만료는 플래너가 조르지 않는다(예전 그대로): ' + JSON.stringify(r.plan));
  });

  await test('⑤ 🛡 AS 보증 관리 — 항목 배지·전체 보증 종료·점검 안내 버튼', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const out = warrantyManage();
      const rows = [...document.querySelectorAll('#modalRoot .wtSms, #modalRoot .wtItem')].length;
      const txt = document.getElementById('modalRoot').textContent.replace(/\s+/g, ' ');
      const line = n => { const b = [...document.querySelectorAll('#modalRoot b')].find(x => x.textContent === n); return b ? b.parentElement.parentElement.textContent.replace(/\s+/g, ' ') : ''; };
      const res = { out, rows, a: line('가상마감임박'), b: line('가상설비지남'), e: line('가상전체끝'), d: line('가상중간'), f: line('가상구형'), hasBtnB: !!document.querySelector('#modalRoot .wtSms[data-n="가상설비지남"]'), hasBtnD: !!document.querySelector('#modalRoot .wtSms[data-n="가상중간"]') };
      closeModal(true); return res;
    });
    assert(r.out.완공현장 === 6 && r.out.임박 === 6, '요약 수: ' + JSON.stringify(r.out));
    assert(/마감·전기 D-19/.test(r.a) && /전체 보증 종료 2028-10-20/.test(r.a) && !/만료 2028/.test(r.a), '임박 줄 배지·전체 종료: ' + r.a);
    assert(/설비 2년 만료/.test(r.b) && /전체 보증 종료 2027-09-10/.test(r.b) && !/만료됨/.test(r.b) && r.hasBtnB, '설비 2년 만료 줄(만료됨 아님, 점검 안내 버튼): ' + r.b);
    assert(/마감·전기 1년 만료/.test(r.d) && r.hasBtnD, '창 밖이어도 지난 묶음은 배지로 보인다: ' + r.d);
    assert(/만료됨/.test(r.e) && !/방수 3년 만료/.test(r.e), '전부 끝난 현장만 만료됨: ' + r.e);
    assert(/D-50/.test(r.f) && !/방수·/.test(r.f.split('완공')[0]), '구형 숫자 보증 배지는 항목 이름 없이: ' + r.f);
  });

  await test('⑥ 점검 문자 — 항목 이름을 넣고 문장 틀 유지, 이어지는 보증 한 문장 · 전체 끝·구형은 예전 문장', async () => {
    await seed();
    const r = await page.evaluate(() => {
      ['가상마감임박', '가상설비지남', '가상방수마지막', '가상전체끝', '가상구형'].forEach(n => warrantySms(n));
      return window.__sms;
    });
    const frame = s => /^가상 고객님 안녕하세요, .+입니다\. .+ 시공 후 잘 지내고 계신지요\? .+ 무상 점검을 도와드리고자 연락드립니다\.( .+ 보증은 그대로 이어집니다\.)? 불편하신 곳 있으면 편히 말씀해 주세요\. 문의: /.test(s);
    assert(r.length === 5 && r.every(frame), '문장 틀이 깨졌다: ' + JSON.stringify(r));
    assert(r[0].includes('? 마감(도배·바닥·타일)·전기 보증 만료(2026-10-20)를 앞두고 무상 점검') && r[0].includes('연락드립니다. 급배수·배관 설비·방수 보증은 그대로 이어집니다. 불편하신'), '마감·전기 임박 문자: ' + r[0]);
    assert(r[1].includes('? 급배수·배관 설비 보증 기간(2년)이 지났지만 무상 점검') && r[1].includes('연락드립니다. 방수 보증은 그대로 이어집니다.'), '설비 지남 문자: ' + r[1]);
    assert(r[2].includes('? 방수 보증 만료(2026-10-15)를 앞두고 무상 점검') && !r[2].includes('이어집니다'), '방수(마지막) 문자: ' + r[2]);
    assert(r[3].includes('? 보증 기간이 지났지만 무상 점검') && !r[3].includes('이어집니다'), '전부 끝난 현장은 예전 문장: ' + r[3]);
    assert(r[4].includes('? 보증 만료(2026-11-20)를 앞두고 무상 점검') && !r[4].includes('이어집니다'), '구형 숫자 보증은 예전 문장: ' + r[4]);
  });

  await test('⑦ 보증서 문서는 바뀌지 않는다 — 기간 문구·끝날은 전체 보증 기준 그대로', async () => {
    await seed();
    const r = await page.evaluate(() => {
      const d = document.createElement('div'); d.innerHTML = warrantyHTML('가상마감임박'); const t = d.textContent.replace(/\s+/g, ' ');
      return { t, link: hjWarrantyLinkBody('가상마감임박', {}).warranty };
    });
    assert(/2025년 10월 20일 ~ 2028년 10월 20일 \(작업완료일로부터 3년\)/.test(r.t) && /방수 3년/.test(r.t) && /마감\(도배·바닥·타일\) 1년/.test(r.t), '종이 보증서: ' + (r.t.match(/보증기간.{0,160}/) || [''])[0]);
    assert(/방수 3년/.test(r.link) && /1년/.test(r.link), '링크 본문: ' + r.link);
  });

  await test('pageerror 0', async () => { assert(errs.length === 0, errs.join(' | ')); });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log('== ' + (results.length - fail) + '/' + results.length + ' passed ==');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

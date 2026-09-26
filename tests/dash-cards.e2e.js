/* dash-cards.e2e.js — 폰에서 옆으로 밀어야 하던 표 둘 (v329)

   배경: 대시보드의 현장별 현황(5열, 수금액 입력 118px)·지출·마진(10열, 자재·인건·외주 입력 96px×3)·
   견적서 내역(8열)은 wrapWideTables 가 .tbl-scroll 로 감싸 640px 표를 옆으로 밀게 했고, 월별 견적 표는
   래핑도 미디어쿼리도 없었다. 폰에서 수금액 하나 적으려고 표를 밀고, 12.5px 글씨 칸을 눌러 확대가 됐다.
   아파트 오더 줄 오른쪽 도구 묶음(📸N·🖼·후기 재료 복사·상태 select)은 white-space:nowrap 이라
   완료+사진 2장 이상이면 360px 모달 안에 가로 스크롤이 생겼다.

     ① 360×740 모바일 모드 대시보드 — #view 안 .tbl-scroll 0개, 표 머리줄 숨김, 문서·#view 가로 넘침 0
     ② 현장 카드마다 수금액 입력이 44px·16px, 원가 입력 셋도 44px·16px
     ③ 카드 칸마다 열 이름(data-label)이 붙어 ::before 로 보인다(첫 칸=제목은 이름 없음)
     ④ 모바일 모드 설정이 꺼져 있어도 폭 360 이면(미디어쿼리) 같은 카드
     ④-2 폰 가로 화면(740×360)이라도 모바일 모드면 카드(body.mobile-mode 규칙)
     ⑤ PC 1280 — 종전처럼 .tbl-scroll 로 감싸고 머리줄이 보인다(PC 폭은 그대로)
     ⑤-2 PC 에서 그린 뒤 폭만 360 으로 줄여도(다시 그리기 없음) 남은 틀 안에서 옆으로 밀지 않는다
     ⑥ 아파트 오더 모달 — 완료·사진 3장·금액 있는 오더에서 작업 내용 칸이 안 짓눌리고 가로 넘침 0, 상태 select 16px·44px
     ⑥-2 큰 글씨 2단계에서도 오더 모달 가로 넘침 0(원래 코드는 75px 넘쳤다)
     ⑦ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
async function test(name, fn) { try { await fn(); console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); } }

async function boot(browser, viewport, mobile) {
  const page = await browser.newPage({ viewport, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.viewDashboard === 'function' && !!window.__hjRestoreDone && !!window.__hjRelayBootDone);
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]));
  // 부팅의 설정 복원(pref_mobile — 없으면 폭 820 이하를 모바일 모드로 켠다)은 위 신호들 뒤에 끝난다. 그 블록이 바로 다음 줄에서
  // 푸터 #buildTag 에 'build …' 를 적으므로 그것을 끝 신호로 기다린다 — 안 기다리면 아래서 끈 모바일 모드를 부팅이 다시 켠다.
  await page.waitForFunction(() => /^build /.test((document.getElementById('buildTag') || {}).textContent || ''));
  await page.evaluate((mobile) => {
    // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다(AGENTS.md 검사 도구 함정)
    ['taxCalendarEnsure', 'coworkSchedEnsure', 'backupBootCheck', 'kakaoCheckNew'].forEach(n => { if (typeof window[n] === 'function') window[n] = () => 0; });
    // 모바일 모드는 화면 폭이 아니라 설정값 — 명시적으로 켜고 끈다
    __mobileMode = mobile; applyMobileMode();
    const today = localDate();
    state.projects = [
      { name: '둔산동 크로바아파트 108동 1502호 욕실·주방 전체 리모델링', stage: 2, received: 12000000, cost: { material: 3400000, labor: 2100000, outsource: 1500000 }, archived: false },
      { name: '월평동 누리아파트 거실 도배', stage: 1, received: 0, cost: { material: 0, labor: 0, outsource: 0 }, archived: false },
      { name: '노은 열매마을 5단지 베란다 방수', stage: 3, received: 2800000, cost: { material: 900000, labor: 600000, outsource: 0 }, archived: false }
    ];
    state.files = [
      { id: 'e1', name: '견적서_크로바1502.xlsx', ext: 'xlsx', kind: 'estimate', project: state.projects[0].name, est: { customer: '크로바 1502호 고객', date: today, supply: 30000000, vat: 3000000, amount: 33000000 } },
      { id: 'e2', name: '견적서_누리도배.xlsx', ext: 'xlsx', kind: 'estimate', project: state.projects[1].name, est: { customer: '누리 도배', date: today, supply: 2000000, vat: 200000, amount: 2200000 } },
      { id: 'e3', name: '견적서_열매방수.xlsx', ext: 'xlsx', kind: 'estimate', project: state.projects[2].name, est: { customer: '열매 방수', date: '2026-07-14', supply: 4000000, vat: 400000, amount: 4400000 } }
    ];
    state.tab = 'dashboard'; state.activeProject = null; render();
  }, mobile);
  // 표는 render 가 동기로 그리고 wrapWideTables 도 동기로 돈다 — 표가 보일 때까지만 기다린다
  await page.waitForFunction(() => document.querySelectorAll('#view table.estimate-table').length >= 3);
  return page;
}

// 대시보드 표 상태를 한 번에 잰다
function measureDash() {
  const v = document.getElementById('view');
  const cards = [...v.querySelectorAll('table.dash-cards')];
  const headShown = cards.filter(t => { const th = t.querySelector('thead'); return th && getComputedStyle(th).display !== 'none'; }).length;
  const recv = [...v.querySelectorAll('input[data-recv]')].map(i => { const r = i.getBoundingClientRect(); return { h: Math.round(r.height), f: parseFloat(getComputedStyle(i).fontSize), right: Math.round(r.right) }; });
  const cost = [...v.querySelectorAll('input[data-cost]')].map(i => { const r = i.getBoundingClientRect(); return { h: Math.round(r.height), f: parseFloat(getComputedStyle(i).fontSize), right: Math.round(r.right) }; });
  // 라벨: 첫 칸·빈 칸을 뺀 모든 칸이 data-label 을 갖고 ::before 로 그 이름을 보인다
  const unlabeled = [];
  cards.forEach(t => t.querySelectorAll('tbody td,tfoot td').forEach((td, i) => {
    if (getComputedStyle(td).display === 'none') return;
    const isFirst = td === td.parentElement.firstElementChild;
    const before = getComputedStyle(td, '::before').content;
    if (isFirst) { if (before !== 'none' && before !== 'normal' && before !== '""') unlabeled.push('첫칸 이름표:' + before); return; }
    const lab = td.getAttribute('data-label') || '';
    if (!lab || before.indexOf(lab) < 0) unlabeled.push(td.textContent.trim().slice(0, 12) + '→' + lab + '/' + before);
    // 합계 줄의 빈 칸이 이름표만 달고 '단계 (빈칸)' 처럼 보이면 안 된다
    if (!td.textContent.trim() && !td.children.length) unlabeled.push('빈칸이 보임:' + lab);
  }));
  return {
    cards: cards.length,
    months: v.querySelectorAll('table.month-table.dash-cards').length,
    scroll: v.querySelectorAll('.tbl-scroll').length,
    hintShown: [...v.querySelectorAll('.tbl-hint')].filter(h => getComputedStyle(h).display !== 'none').length,
    headShown, recv, cost, unlabeled,
    docOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    viewOver: v.scrollWidth - v.clientWidth,
    maxTableOver: Math.max(0, ...cards.map(t => t.scrollWidth - t.clientWidth)),
    vw: window.innerWidth,
    mobileMode: document.body.classList.contains('mobile-mode')
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const errors = [];

  const phone = await boot(browser, { width: 360, height: 740 }, true);
  const m = await phone.evaluate(measureDash);

  await test('① 360 모바일 모드 — 밀어 보는 틀 없이 카드, 머리줄 숨김, 가로 넘침 0', async () => {
    assert(m.cards >= 4, '대시보드 카드 표가 4개 미만(현장·지출·견적서·월별): ' + m.cards);
    assert(m.months === 1, '월별 견적 표가 카드 대상이 아님: ' + m.months);
    assert(m.scroll === 0, '#view 안 .tbl-scroll ' + m.scroll + '개 — 폰에서 아직 옆으로 민다');
    assert(m.hintShown === 0, '폰에 "옆으로 밀면" 안내가 남음: ' + m.hintShown);
    assert(m.headShown === 0, '카드인데 표 머리줄이 보임: ' + m.headShown);
    assert(m.docOver <= 1, '문서 가로 넘침 ' + m.docOver + 'px');
    assert(m.viewOver <= 1, '#view 가로 넘침 ' + m.viewOver + 'px');
    assert(m.maxTableOver <= 1, '카드 표 안 가로 넘침 ' + m.maxTableOver + 'px');
  });

  await test('② 현장 카드마다 수금액 44px·16px, 원가 입력도 44px·16px, 화면 안', async () => {
    assert(m.recv.length === 3, '수금 입력이 현장 수(3)만큼 없음: ' + m.recv.length);
    m.recv.forEach((r, i) => {
      assert(r.h >= 44, '수금 입력 ' + i + ' 높이 ' + r.h);
      assert(r.f >= 16, '수금 입력 ' + i + ' 글씨 ' + r.f + 'px — 누르면 확대된다');
      assert(r.right <= m.vw, '수금 입력 ' + i + ' 이 화면 밖(' + r.right + ')');
    });
    assert(m.cost.length === 9, '원가 입력이 3현장×3 이 아님: ' + m.cost.length);
    m.cost.forEach((r, i) => {
      assert(r.h >= 44 && r.f >= 16, '원가 입력 ' + i + ' ' + JSON.stringify(r));
      assert(r.right <= m.vw, '원가 입력 ' + i + ' 이 화면 밖(' + r.right + ')');
    });
  });

  await test('③ 카드 칸마다 열 이름이 보인다(첫 칸은 제목)', async () => {
    assert(m.unlabeled.length === 0, '이름 없는 칸: ' + JSON.stringify(m.unlabeled.slice(0, 5)));
    const recvLabel = await phone.evaluate(() => document.querySelector('#view input[data-recv]').closest('td').getAttribute('data-label'));
    assert(recvLabel === '수금액', '수금 칸 이름이 "수금액" 이 아님: ' + recvLabel);
  });

  await test('③-2 수금액 입력은 카드에서도 그대로 저장된다', async () => {
    const r = await phone.evaluate(async () => {
      const i = document.querySelector('#view input[data-recv]');
      i.value = '12,500,000';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
      i.dispatchEvent(new Event('blur', { bubbles: true }));
      for (let k = 0; k < 40; k++) { if (projStats(state.projects[0].name).recv === 12500000) break; await new Promise(x => setTimeout(x, 50)); }
      return projStats(state.projects[0].name).recv;
    });
    assert(r === 12500000, '카드 수금 입력이 저장되지 않음: ' + r);
  });
  errors.push(...phone.__errors);
  await phone.close();

  await test('④ 모바일 모드 설정이 꺼져 있어도 폭 360 이면 같은 카드(미디어쿼리)', async () => {
    const narrow = await boot(browser, { width: 360, height: 740 }, false);
    const n = await narrow.evaluate(measureDash);
    errors.push(...narrow.__errors);
    await narrow.close();
    assert(n.mobileMode === false, '시나리오 전제(모바일 모드 꺼짐)가 성립하지 않음 — 미디어쿼리만 검사해야 한다');
    assert(n.scroll === 0, '폭 360 인데 .tbl-scroll ' + n.scroll + '개');
    assert(n.headShown === 0, '폭 360 인데 머리줄이 보임: ' + n.headShown);
    assert(n.docOver <= 1 && n.viewOver <= 1, '폭 360 가로 넘침: ' + n.docOver + '/' + n.viewOver);
    n.recv.forEach((r, i) => assert(r.h >= 44 && r.f >= 16, '폭 360 수금 입력 ' + i + ' ' + JSON.stringify(r)));
  });

  await test('④-2 폰 가로(740×360)에 모바일 모드면 폭이 640 을 넘어도 카드', async () => {
    const land = await boot(browser, { width: 740, height: 360 }, true);
    const n = await land.evaluate(measureDash);
    errors.push(...land.__errors);
    await land.close();
    assert(n.scroll === 0, '모바일 모드 가로 화면인데 .tbl-scroll ' + n.scroll + '개');
    assert(n.headShown === 0, '모바일 모드 가로 화면인데 머리줄이 보임: ' + n.headShown);
    assert(n.docOver <= 1 && n.viewOver <= 1, '가로 화면 넘침: ' + n.docOver + '/' + n.viewOver);
    n.recv.forEach((r, i) => assert(r.h >= 44 && r.f >= 16, '가로 화면 수금 입력 ' + i + ' ' + JSON.stringify(r)));
    assert(n.unlabeled.length === 0, '가로 화면 이름 없는 칸: ' + JSON.stringify(n.unlabeled.slice(0, 3)));
  });

  await test('⑤ PC 1280 — 종전 표 그대로(.tbl-scroll 로 감싸고 머리줄 보임)', async () => {
    const pc = await boot(browser, { width: 1280, height: 900 }, false);
    const p = await pc.evaluate(() => {
      const v = document.getElementById('view');
      const est = [...v.querySelectorAll('table.estimate-table.dash-cards')];
      return {
        wrapped: est.filter(t => t.parentElement.classList.contains('tbl-scroll')).length,
        est: est.length,
        heads: [...v.querySelectorAll('table.dash-cards thead')].filter(h => getComputedStyle(h).display === 'table-header-group').length,
        rows: [...v.querySelectorAll('table.dash-cards tbody tr')].filter(r => getComputedStyle(r).display === 'table-row').length,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    errors.push(...pc.__errors);
    await pc.close();
    assert(p.est >= 3 && p.wrapped === p.est, 'PC 에서 대시보드 표가 .tbl-scroll 로 감싸이지 않음: ' + JSON.stringify(p));
    assert(p.heads >= 4, 'PC 에서 표 머리줄이 숨음: ' + JSON.stringify(p));
    assert(p.rows > 0, 'PC 에서 줄이 표 줄이 아님: ' + JSON.stringify(p));
    assert(p.over <= 1, 'PC 가로 밀림 ' + p.over);
  });

  await test('⑤-2 PC 폭에서 그린 뒤 다시 그리지 않고 폭 360 으로 줄여도 감싼 틀 안에서 옆으로 밀지 않는다', async () => {
    const pc = await boot(browser, { width: 1280, height: 900 }, false);
    const before = await pc.evaluate(() => document.querySelectorAll('#view .tbl-scroll').length);
    await pc.setViewportSize({ width: 360, height: 740 });
    // 크기 변경은 render 를 부르지 않는다 — 옛 .tbl-scroll 틀이 남은 채로 CSS 만 바뀐다
    await pc.waitForFunction(() => window.innerWidth === 360);
    const r = await pc.evaluate(() => {
      const wraps = [...document.querySelectorAll('#view .tbl-scroll')];
      return {
        wraps: wraps.length,
        over: Math.max(0, ...wraps.map(w => w.scrollWidth - w.clientWidth)),
        heads: [...document.querySelectorAll('#view table.dash-cards thead')].filter(h => getComputedStyle(h).display !== 'none').length
      };
    });
    errors.push(...pc.__errors);
    await pc.close();
    assert(before >= 3 && r.wraps === before, '시나리오 전제(PC 틀이 남아 있음)가 성립하지 않음: ' + before + '/' + JSON.stringify(r));
    assert(r.over <= 1, '남은 틀 안에서 표가 옆으로 밀림 ' + r.over + 'px');
    assert(r.heads === 0, '폭 360 인데 머리줄이 보임: ' + r.heads);
  });

  // 사고 조건: 완료(후기 재료 복사)+사진 2장 이상(🖼)+금액 — 도구 묶음이 white-space:nowrap 한 줄이다.
  //  · 기본 글씨에서는 묶음이 버티는 대신 왼쪽 작업 내용 칸이 30여 px 로 짓눌려 한 글자씩 줄이 바뀐다(원래 코드 실측 36px).
  //  · 큰 글씨 2단계(설정 → a11y-big2)에서는 묶음이 모달보다 넓어져 가로 스크롤이 생긴다(원래 코드 실측 75px).
  async function aptModal(big) {
    const pg = await boot(browser, { width: 360, height: 740 }, true);
    const r = await pg.evaluate(async (big) => {
      if (big) document.body.classList.add('a11y-big' + big);
      const today = localDate();
      state.aptOffices = [{ id: 'dc-of1', complex: '열매마을5단지', manager: '', phone: '' }];
      state.aptOrders = [
        { id: 'dc-o1', officeId: 'dc-of1', unit: '507동 1204호', text: '욕실 배관 교체 및 실리콘 재시공', amount: 1850000, date: today, status: 'done', doneAt: today }
      ];
      state.files = state.files.concat([
        { id: 'dc-p1', name: '열매마을5단지_507동1204호_시공전.jpg', ext: 'jpg', kind: 'photo' },
        { id: 'dc-p2', name: '열매마을5단지_507동1204호_시공중.jpg', ext: 'jpg', kind: 'photo' },
        { id: 'dc-p3', name: '열매마을5단지_507동1204호_시공후.jpg', ext: 'jpg', kind: 'photo' }
      ]);
      aptOrderManage('dc-of1');
      const root = document.getElementById('modalRoot');
      for (let k = 0; k < 40 && !root.querySelector('[data-apt-order-row="dc-o1"]'); k++) await new Promise(x => setTimeout(x, 50));
      const row = root.querySelector('[data-apt-order-row="dc-o1"]');
      // 시드가 사고 조건을 만들었는지 — 📸3·🖼·후기 재료 복사·상태 select 가 한 줄 묶음에 다 있다
      const cond = { ph: !!row.querySelector('.apoPh'), ba: !!row.querySelector('.apoBA'), review: !!row.querySelector('.apoReview'), stat: !!row.querySelector('.apoStat'), phText: (row.querySelector('.apoPh') || {}).textContent || '', amt: /1,850,000/.test(row.textContent) };
      let worst = { d: 0, who: '' };
      const modal = root.querySelector('.modal');
      [modal, ...modal.querySelectorAll('*')].forEach(el => {
        const ox = getComputedStyle(el).overflowX;
        if (el !== modal && ox === 'visible') return;
        const d = el.scrollWidth - el.clientWidth;
        if (d > worst.d) worst = { d, who: el.tagName + '.' + el.className + ' ' + ox };
      });
      const mr = modal.getBoundingClientRect();
      const tools = [...row.querySelectorAll('.apoPh,.apoBA,.apoReview,.apoStat')].map(b => Math.round(b.getBoundingClientRect().right));
      // 작업 내용 칸 = 줄 머리(첫 자식) 안의 첫 칸
      const info = row.firstElementChild.firstElementChild;
      const s = row.querySelector('.apoStat'), sr = s.getBoundingClientRect();
      return { cond, worst, modalRight: Math.round(mr.right), tools, infoW: Math.round(info.getBoundingClientRect().width), rowW: row.clientWidth, statF: parseFloat(getComputedStyle(s).fontSize), statH: Math.round(sr.height) };
    }, big);
    errors.push(...pg.__errors);
    await pg.close();
    return r;
  }

  await test('⑥ 아파트 오더 — 완료·사진 3장·금액 오더, 360 모달: 작업 내용 칸이 안 짓눌리고 가로 넘침 0', async () => {
    const r = await aptModal(0);
    assert(r.cond.ph && r.cond.ba && r.cond.review && r.cond.stat && /3/.test(r.cond.phText) && r.cond.amt, '시드가 사고 조건(완료·사진 3장·금액)을 만들지 못함: ' + JSON.stringify(r.cond));
    assert(r.worst.d <= 1, '오더 모달 가로 넘침 ' + r.worst.d + 'px — ' + r.worst.who);
    assert(Math.max(...r.tools) <= r.modalRight + 1, '도구 버튼이 모달 밖: ' + JSON.stringify(r));
    assert(r.infoW >= r.rowW * 0.6, '작업 내용 칸이 도구 묶음에 짓눌림: ' + r.infoW + '/' + r.rowW + 'px');
    assert(r.statF >= 16, '상태 select 글씨 ' + r.statF + 'px — 누르면 확대된다');
    assert(r.statH >= 44, '상태 select 높이 ' + r.statH);
  });

  await test('⑥-2 큰 글씨 2단계에서도 오더 모달 가로 넘침 0', async () => {
    const r = await aptModal(2);
    assert(r.cond.ph && r.cond.ba && r.cond.review && r.cond.stat, '시드가 사고 조건을 만들지 못함: ' + JSON.stringify(r.cond));
    assert(r.worst.d <= 1, '큰 글씨 오더 모달 가로 넘침 ' + r.worst.d + 'px — ' + r.worst.who);
    assert(Math.max(...r.tools) <= r.modalRight + 1, '큰 글씨 도구 버튼이 모달 밖: ' + JSON.stringify(r));
  });

  await test('⑦ pageerror 0', async () => {
    assert(errors.length === 0, 'pageerror: ' + errors.join(' | '));
  });

  console.log('\n== dash-cards: ' + pass + '/' + (pass + fail) + ' passed ==');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

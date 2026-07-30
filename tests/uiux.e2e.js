/* uiux.e2e.js — cb49941 이 넣은 접근성·모바일 사용성을 못박는다

   cb49941 은 기능을 바꾸지 않고 '쓸 수 있게' 만든 커밋이다.
   그런 변경은 눈으로 한 번 보고 넘어가면 다음 리팩터링에서 조용히 사라진다.
   (실제로 이 저장소에서 aria-label 과 포커스 처리가 두 번 사라졌다)

   지키는 것
     ① 본문 건너뛰기 링크가 있고 실제 대상(#view)을 가리킨다
     ② 탭이 키보드로 움직인다 — ← → Home End, roving tabindex, aria-selected
     ③ 모달: Esc 로 닫히고, 닫으면 초점이 열었던 버튼으로 돌아온다
     ④ 모달 안에서 Tab 이 갇힌다(마지막 → 처음)
     ⑤ 아이콘만 있는 버튼에 이름이 있다 — 일정·연락처·달력
     ⑥ 금액 입력칸에 라벨과 숫자 키패드가 있다
     ⑦ 가로 스크롤이 생기지 않는다 — 폰(390)과 PC(1280) 양쪽
     ⑧ 폰에서 손가락으로 누를 수 있는 크기(40px)다
     ⑨ 모달이 열리면 뒤 화면이 스크롤되지 않는다

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('PASS  ' + name); }
  catch (e) { results.push({ name, ok: false }); console.log('FAIL  ' + name + '\n      ' + String(e && e.message || e)); }
}
function assert(c, m) { if (!c) throw new Error('assert: ' + m); }

// 일정·연락처·사진 버튼이 그려지도록 최소한의 자료를 넣는다.
const SEED = () => {
  state.projects = [{ name: '둔산동아파트', stage: 2, received: 1000000, phases: ['철거', '타일'],
    cost: { material: 0, labor: 0, outsource: 0 },
    customer: { name: '김고객', phone: '010-1111-2222', addr: '대전 서구' }, archived: false }];
  state.files = [{ id: 'q1', name: '견적.pdf', ext: 'pdf', kind: 'estimate', project: '둔산동아파트',
    est: { amount: 5000000, date: '2026-07-01' } }];
  state.schedule = [{ id: 's1', date: '2026-08-03', time: '09:00', title: '타일 시공', project: '둔산동아파트' }];
  state.contacts = [{ id: 'c1', name: '박타일', phone: '010-3333-4444', memo: '타일팀' }];
  state.payLog = []; state.dirty = false;
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });

  /* ══════════ PC (1280×860) ══════════ */
  const pc = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 860 } });
  const p = await pc.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await p.goto(APP, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(SEED);
  await p.evaluate(() => render());
  await p.waitForTimeout(250);

  await test('① 본문 건너뛰기 링크가 실제 대상을 가리킨다', async () => {
    const r = await p.evaluate(() => {
      const a = document.querySelector('a.skip-link');
      if (!a) return { has: false };
      const href = a.getAttribute('href') || '';
      return { has: true, href, target: !!document.querySelector(href), text: a.textContent.trim() };
    });
    assert(r.has, '건너뛰기 링크가 없다');
    assert(r.target, '가리키는 대상이 없다: ' + r.href);
    assert(r.text.length > 0, '링크에 글자가 없다');
  });

  await test('② 탭이 키보드로 움직인다 — ← → Home End · roving tabindex', async () => {
    const r = await p.evaluate(async () => {
      const tabs = [...document.querySelectorAll('.tab')];
      const list = document.getElementById('tabs');
      const fire = (el, key) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      tabs[0].focus();
      const before = state.tab;
      fire(tabs[0], 'ArrowRight');
      const afterRight = state.tab;
      fire(document.querySelector('.tab.active'), 'End');
      const afterEnd = state.tab;
      fire(document.querySelector('.tab.active'), 'Home');
      const afterHome = state.tab;
      // ★ roving 검사는 '첫 탭이 아닌 곳'에서 해야 한다.
      //   첫 탭은 정적 HTML 이 이미 tabindex="0" 이라, 갱신 코드를 지워도 우연히 통과한다
      //   (실제로 처음 이 테스트가 그 결함을 놓쳤다).
      fire(document.querySelector('.tab.active'), 'ArrowRight');
      fire(document.querySelector('.tab.active'), 'ArrowRight');
      const movedTab = state.tab;
      const cur = [...document.querySelectorAll('.tab')];
      return {
        role: list.getAttribute('role'),
        before, afterRight, afterEnd, afterHome,
        firstTab: tabs[0].dataset.tab, lastTab: tabs[tabs.length - 1].dataset.tab,
        movedTab, notFirst: movedTab !== tabs[0].dataset.tab,
        // roving tabindex — 활성 탭만 0, 나머지는 -1
        roving: cur.filter(t => t.tabIndex === 0).length,
        activeIsZero: document.querySelector('.tab.active').tabIndex === 0,
        selected: cur.filter(t => t.getAttribute('aria-selected') === 'true').length
      };
    });
    assert(r.role === 'tablist', 'tabs 에 role=tablist 가 없다');
    assert(r.afterRight !== r.before, '→ 로 탭이 넘어가지 않는다');
    assert(r.afterEnd === r.lastTab, 'End 가 마지막 탭으로 가지 않는다: ' + r.afterEnd);
    assert(r.afterHome === r.firstTab, 'Home 이 첫 탭으로 가지 않는다: ' + r.afterHome);
    assert(r.notFirst, 'roving 검사가 첫 탭에서 이뤄져 의미가 없다: ' + r.movedTab);
    assert(r.activeIsZero, 'roving tabindex 가 갱신되지 않았다 — 활성 탭(' + r.movedTab + ')이 tabIndex 0 이 아니다');
    assert(r.roving === 1, 'tabIndex 0 인 탭이 ' + r.roving + '개(1개여야 함) — 키보드로 탭을 건너뛰게 된다');
    assert(r.selected === 1, 'aria-selected=true 가 ' + r.selected + '개(1개여야 함)');
  });

  await test('③ 모달 — Esc 로 닫히고 초점이 열었던 버튼으로 돌아온다', async () => {
    const r = await p.evaluate(async () => {
      // 초점을 둘 곳으로 실제 버튼을 하나 쓴다.
      const opener = document.getElementById('btnDiag') || document.querySelector('header button') || document.querySelector('button');
      opener.id = opener.id || '__openerProbe';
      opener.focus();
      const openerId = opener.id;
      openModal('테스트 창', '<p>내용</p>');
      await new Promise(r2 => setTimeout(r2, 60));
      const dlg = document.querySelector('#modalRoot .modal');
      const opened = {
        role: dlg && dlg.getAttribute('role'),
        modal: dlg && dlg.getAttribute('aria-modal'),
        labelled: !!(dlg && document.getElementById(dlg.getAttribute('aria-labelledby'))),
        hasClose: !!document.querySelector('#modalRoot .modal-close[aria-label]'),
        bodyLocked: document.body.classList.contains('modal-open')
      };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise(r2 => setTimeout(r2, 80));
      return {
        opened,
        closed: !document.querySelector('#modalRoot .modal'),
        unlocked: !document.body.classList.contains('modal-open'),
        focusBack: document.activeElement && document.activeElement.id === openerId,
        focusId: document.activeElement && document.activeElement.id
      };
    });
    assert(r.opened.role === 'dialog' && r.opened.modal === 'true', '모달에 role=dialog/aria-modal 이 없다');
    assert(r.opened.labelled, 'aria-labelledby 가 실제 제목을 가리키지 않는다');
    assert(r.opened.hasClose, '이름 있는 닫기 버튼이 없다');
    assert(r.opened.bodyLocked, '모달이 열렸는데 뒤 화면 스크롤이 잠기지 않았다');
    assert(r.closed, 'Esc 로 닫히지 않는다');
    assert(r.unlocked, '닫았는데 스크롤 잠금이 남아 있다');
    assert(r.focusBack, '초점이 열었던 버튼으로 돌아오지 않았다: ' + r.focusId);
  });

  await test('④ 모달 안에서 Tab 이 갇힌다', async () => {
    const r = await p.evaluate(async () => {
      openModal('갇힘 시험', '<button id="__m1">첫</button><button id="__m2">둘</button>',
        [{ label: '닫기', cls: 'ghost', fn: closeModal }]);
      await new Promise(r2 => setTimeout(r2, 60));
      const modal = document.querySelector('#modalRoot .modal');
      const f = [...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(el => el.getClientRects().length);
      const last = f[f.length - 1], first = f[0];
      last.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      await new Promise(r2 => setTimeout(r2, 40));
      const wrapped = document.activeElement === first;
      first.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      await new Promise(r2 => setTimeout(r2, 40));
      const wrappedBack = document.activeElement === last;
      closeModal();
      return { n: f.length, wrapped, wrappedBack };
    });
    assert(r.n >= 2, '모달 안에 초점 받을 요소가 부족하다: ' + r.n);
    assert(r.wrapped, '마지막에서 Tab 이 처음으로 돌아오지 않는다');
    assert(r.wrappedBack, '처음에서 Shift+Tab 이 마지막으로 가지 않는다');
  });

  await test('⑤ 아이콘만 있는 버튼에 이름이 있다 — 일정·연락처·달력', async () => {
    const r = await p.evaluate(async () => {
      const bad = [];
      const scan = (sel, where) => {
        document.querySelectorAll(sel).forEach(b => {
          const txt = (b.textContent || '').trim();
          const name = b.getAttribute('aria-label') || b.getAttribute('title') || '';
          // 글자가 아이콘 하나뿐(이모지·기호)인데 이름이 없으면 화면읽기로 구분이 안 된다.
          const iconOnly = txt.length <= 2;
          if (iconOnly && !name) bad.push(where + ' "' + txt + '"');
        });
      };
      state.tab = 'schedule'; render(); await new Promise(r2 => setTimeout(r2, 200));
      scan('.sch-tools .mini-btn', '일정');
      scan('.cal-nav', '달력');
      scan('[data-calday]', '달력날짜');
      state.tab = 'contacts'; render(); await new Promise(r2 => setTimeout(r2, 200));
      scan('.con-tools .mini-btn, .con-tools a.mini-btn', '연락처');
      state.tab = 'dashboard'; render(); await new Promise(r2 => setTimeout(r2, 150));
      return bad;
    });
    assert(r.length === 0, '이름 없는 아이콘 버튼: ' + r.slice(0, 6).join(' / '));
  });

  await test('⑥ 금액 입력칸에 라벨과 숫자 키패드가 있다', async () => {
    const r = await p.evaluate(async () => {
      state.tab = 'dashboard'; render(); await new Promise(r2 => setTimeout(r2, 250));
      const money = [...document.querySelectorAll('input[data-recv],input[data-cost]')];
      return {
        n: money.length,
        noLabel: money.filter(i => !(i.getAttribute('aria-label') || '').trim()).length,
        noNumeric: money.filter(i => i.getAttribute('inputmode') !== 'numeric').length,
        // 화면 전체에서 이름 없는 select 도 함께 본다(파일 종류·현장 배정)
        selNoLabel: [...document.querySelectorAll('select[data-act]')]
          .filter(s => !(s.getAttribute('aria-label') || '').trim()).length
      };
    });
    assert(r.n > 0, '검사할 금액 입력칸이 렌더되지 않았다');
    assert(r.noLabel === 0, '라벨 없는 금액칸 ' + r.noLabel + '개');
    assert(r.noNumeric === 0, '숫자 키패드(inputmode) 없는 금액칸 ' + r.noNumeric + '개');
    assert(r.selNoLabel === 0, '라벨 없는 배정 select ' + r.selNoLabel + '개');
  });

  await test('⑦ PC(1280)에서 가로 스크롤이 생기지 않는다', async () => {
    const over = await p.evaluate(async () => {
      const bad = [];
      for (const t of ['dashboard', 'docs', 'photos', 'estimates', 'schedule', 'contacts', 'project', 'ledger']) {
        state.tab = t; render(); await new Promise(r2 => setTimeout(r2, 180));
        const de = document.documentElement;
        if (de.scrollWidth > de.clientWidth + 1) bad.push(t + '(' + de.scrollWidth + '>' + de.clientWidth + ')');
      }
      return bad;
    });
    assert(over.length === 0, '가로로 넘친 화면: ' + over.join(', '));
  });

  await pc.close();

  /* ══════════ 폰 (390×844) ══════════ */
  const mb = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const m = await mb.newPage();
  m.on('pageerror', e => errs.push('[mobile] ' + String(e)));
  await m.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); } catch (e) {} });
  await m.goto(APP, { waitUntil: 'domcontentloaded' });
  await m.waitForTimeout(1200);
  await m.evaluate(SEED);
  await m.evaluate(() => { __mobileMode = true; applyMobileMode(); render(); });
  await m.waitForTimeout(300);

  await test('⑧ 폰(390)에서 가로 스크롤이 생기지 않는다', async () => {
    const over = await m.evaluate(async () => {
      const bad = [];
      for (const t of ['dashboard', 'docs', 'photos', 'estimates', 'schedule', 'contacts', 'project', 'ledger']) {
        state.tab = t; render(); await new Promise(r2 => setTimeout(r2, 200));
        const de = document.documentElement;
        if (de.scrollWidth > de.clientWidth + 1) bad.push(t + '(' + de.scrollWidth + '>' + de.clientWidth + ')');
      }
      return bad;
    });
    assert(over.length === 0, '폰에서 가로로 넘친 화면: ' + over.join(', '));
  });

  await test('⑨ 폰에서 일정·연락처 버튼이 손가락으로 누를 수 있는 크기다', async () => {
    const r = await m.evaluate(async () => {
      const small = [];
      const scan = async (tab, sel, where) => {
        state.tab = tab; render(); await new Promise(r2 => setTimeout(r2, 220));
        document.querySelectorAll(sel).forEach(b => {
          const q = b.getBoundingClientRect();
          if (q.width < 38 || q.height < 38) small.push(where + ' ' + Math.round(q.width) + '×' + Math.round(q.height));
        });
      };
      await scan('schedule', '.sch-tools .mini-btn', '일정');
      await scan('contacts', '.con-tools .mini-btn', '연락처');
      return small;
    });
    // 38px 로 본다 — CSS 는 40px 을 주지만 테두리·반올림으로 1~2px 이 깎인다.
    assert(r.length === 0, '너무 작은 버튼: ' + r.slice(0, 6).join(' / '));
  });

  await test('⑩ 폰에서도 모달이 Esc 로 닫히고 뒤 화면이 잠긴다', async () => {
    const r = await m.evaluate(async () => {
      openModal('폰 모달', '<p>내용</p>');
      await new Promise(r2 => setTimeout(r2, 80));
      const locked = document.body.classList.contains('modal-open');
      const w = document.querySelector('#modalRoot .modal').getBoundingClientRect().width;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise(r2 => setTimeout(r2, 80));
      return { locked, w, closed: !document.querySelector('#modalRoot .modal'), vw: window.innerWidth };
    });
    assert(r.locked, '폰에서 뒤 화면 스크롤이 잠기지 않았다');
    assert(r.closed, '폰에서 Esc 로 닫히지 않는다');
    assert(r.w <= r.vw, '모달이 화면보다 넓다: ' + Math.round(r.w) + '>' + r.vw);
  });

  await mb.close();

  await test('⑪ 화면 오류(pageerror) 0', async () => {
    assert(errs.length === 0, errs.slice(0, 3).join(' | '));
  });

  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log('\n' + (bad.length ? bad.length + '건 실패' : '전부 통과 (' + results.length + '건)'));
  if (bad.length) process.exitCode = 1;
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exitCode = 1; });

/* mobile-list.e2e.js — 모바일(폰) 목록 사용성 회귀 (Playwright)
   폰에서 목록이 불편하던 것들이 다시 나빠지지 않게 지킨다:
   ① 서류·견적 카드가 1열 거대 격자 대신 '한 줄 리스트형'으로 눕는다(사진 격자는 다열 유지)
   ② 카드 버튼·분류 드롭다운이 44px 손가락 크기다(터치 타깃)
   ③ 현장 선택 시트: 검색이 항상 있고, 미수금은 표시하지 않는다
   ④ 긴 목록에서 '맨 위로' 버튼이 뜨고 실제로 올라간다 (모바일 모드 전용)
   전제: tests/static-server.js(8299) 실행 중. serviceWorkers:'block'. 실발신/네트워크 없음. */
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

  // 시드: 미수 있는 현장 + 완납 현장 + 서류(견적·기타) 파일. 모바일 모드 켜고 서류 탭.
  await page.evaluate(() => {
    state.projects = [
      { name: '둔산현장', stage: 2, received: 1000000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '가', phone: '', addr: '' }, archived: false },
      { name: '완납현장', stage: 3, received: 5500000, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '나', phone: '', addr: '' }, archived: false }
    ];
    state.files = [
      { id: 'm1', name: '둔산 견적.pdf', ext: 'pdf', kind: 'estimate', project: '둔산현장', est: { amount: 11000000, supply: 10000000, vat: 1000000 } },
      { id: 'm2', name: '완납 견적.pdf', ext: 'pdf', kind: 'estimate', project: '완납현장', est: { amount: 5500000, supply: 5000000, vat: 500000 } },
      { id: 'm3', name: '사업자등록증.pdf', ext: 'pdf', kind: 'bizreg', project: '' }
    ];
    state.activeProject = null; state.search = ''; state.dirty = false;
    __mobileMode = true; applyMobileMode();
    state.tab = 'docs'; render();
  });
  await page.waitForTimeout(300);

  await test('① 모바일 모드: 서류 카드가 한 줄 리스트형(가로 배치·1열)', async () => {
    const r = await page.evaluate(() => {
      const card = document.querySelector('.card.k-estimate');
      if (!card) return { missing: true };
      const grid = card.closest('.grid');
      const cols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
      const dir = getComputedStyle(card).flexDirection;
      const th = card.querySelector('.thumb').getBoundingClientRect();
      return { cols, dir, thumbW: Math.round(th.width) };
    });
    assert(!r.missing, '견적 카드가 렌더돼야 함(k-estimate 클래스)');
    assert(r.cols === 1, '서류 격자는 1열이어야 함: ' + r.cols + '열');
    assert(r.dir === 'row', '카드는 가로(row) 배치여야 함: ' + r.dir);
    assert(r.thumbW <= 90, '썸네일은 작은 정사각(≤90px)이어야 함: ' + r.thumbW + 'px');
  });

  await test('① 사진 카드가 있는 격자는 다열 유지(사진 훑어보기)', async () => {
    const cols = await page.evaluate(() => {
      const g = document.createElement('div'); g.className = 'grid'; g.id = '__phGrid';
      g.innerHTML = '<div class="card k-photo"><div class="thumb"></div></div><div class="card k-photo"><div class="thumb"></div></div>';
      document.getElementById('view').appendChild(g);
      const n = getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/).length;
      g.remove(); return n;
    });
    assert(cols >= 2, '사진 격자는 2열 이상이어야 함: ' + cols + '열');
  });

  await test('② 터치 타깃: 카드 버튼·분류 드롭다운 44px+', async () => {
    const r = await page.evaluate(() => {
      const btn = document.querySelector('.card.k-estimate .mini-btn');
      const sel = document.querySelector('.card.k-estimate .cardact select');
      return {
        btnH: btn ? Math.round(btn.getBoundingClientRect().height) : 0,
        selH: sel ? Math.round(sel.getBoundingClientRect().height) : 0
      };
    });
    assert(r.btnH >= 44, '카드 미니 버튼 높이 44px 이상이어야 함: ' + r.btnH + 'px');
    assert(r.selH >= 44, '분류 드롭다운 높이 44px 이상이어야 함: ' + r.selH + 'px');
  });

  await test('③ 현장 선택 시트: 현장이 적어도 검색이 항상 보인다', async () => {
    const has = await page.evaluate(() => {
      openProjectSheet();
      return !!document.getElementById('psSearch');
    });
    assert(has, '현장 2곳뿐이어도 검색 입력이 있어야 함(예전엔 7곳부터만)');
  });

  await test('③ 현장 선택 시트: 미수금이 표시되지 않는다', async () => {
    // 미수금 표시는 없앴다(2026-08-13 대표 결정) — 배지가 되살아나면 여기서 잡힌다.
    const txt = await page.evaluate(() => {
      const sh = document.getElementById('projSheet');
      return sh ? (sh.textContent || '') : '';
    });
    assert(txt, '현장 선택 시트가 열려 있지 않다');
    assert(!/미수/.test(txt), '현장 선택 시트에 미수 배지가 되살아났다: ' + txt.slice(0, 200));
  });

  await test('③ 현장 선택 시트: 검색하면 다른 현장 행이 숨는다', async () => {
    const r = await page.evaluate(() => {
      const inp = document.getElementById('psSearch');
      inp.value = '둔산'; inp.dispatchEvent(new Event('input'));
      const vis = (nm) => { const el = [...document.querySelectorAll('#psList [data-psel]')].find(x => x.dataset.psel === nm); return el ? el.style.display !== 'none' : null; };
      const out = { d: vis('둔산현장'), w: vis('완납현장') };
      const bd = document.getElementById('projSheetBd'); if (bd) bd.click();
      return out;
    });
    assert(r.d === true, '검색어와 맞는 현장은 보여야 함');
    assert(r.w === false, '검색어와 다른 현장은 숨어야 함');
  });

  await test('④ 맨 위로: 스크롤하면 뜨고, 누르면 실제로 올라간다', async () => {
    await page.evaluate(() => {
      const pad = document.createElement('div'); pad.id = '__tallPad'; pad.style.height = '3000px';
      document.getElementById('view').appendChild(pad);
      void pad.offsetHeight;
      window.scrollTo(0, 1500);
    });
    await page.waitForFunction(() => {
      const tb = document.getElementById('toTopBtn');
      return window.scrollY > 600 && tb.classList.contains('show') && getComputedStyle(tb).display !== 'none';
    }, null, { timeout: 2000 });
    const shown = await page.evaluate(() => {
      const tb = document.getElementById('toTopBtn');
      return tb.classList.contains('show') && getComputedStyle(tb).display !== 'none';
    });
    assert(shown, '600px 이상 내려가면 맨 위로 버튼이 보여야 함');
    await page.evaluate(() => document.getElementById('toTopBtn').click());
    await page.waitForFunction(() => window.scrollY < 50, null, { timeout: 2000 });
    const y = await page.evaluate(() => { const v = window.scrollY; const p = document.getElementById('__tallPad'); if (p) p.remove(); return v; });
    assert(y < 50, '누르면 맨 위로 올라가야 함: scrollY=' + y);
  });

  await test('④ PC 모드에서는 맨 위로 버튼이 없다', async () => {
    const disp = await page.evaluate(() => {
      __mobileMode = false; applyMobileMode();
      window.scrollTo(0, 1200); window.dispatchEvent(new Event('scroll'));
      return getComputedStyle(document.getElementById('toTopBtn')).display;
    });
    assert(disp === 'none', 'PC 모드에서는 숨어야 함: ' + disp);
  });

  await test('★pageerror 0', async () => {
    assert(errs.length === 0, 'pageerror: ' + errs.join(' | '));
  });

  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(fail ? '\n' + fail + '건 실패' : '\n전부 통과 (' + results.length + '건)');
  process.exit(fail ? 1 : 0);
})();

/* 폰에서 누를 수 있는 크기인가, 넓은 표를 밀 수 있다는 걸 아는가 (v221)
   배경 1: 얇은 버튼(21~26px)은 옆 걸 누르게 된다 — 현장에서 장갑 낀 손이면 더하다.
   배경 2: 넓은 표는 .tbl-scroll 로 밀 수 있었지만 신호가 없어, 오른쪽 금액 열이
           있는 줄도 모르고 지나쳤다.
   예외: 사진 위에 겹쳐진 공정 태그(.ph-phase)는 키우면 사진을 가려 제외한다.
   전제: tests/static-server.js(8299) 실행 중 */
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
async function test(name, fn) { try { await fn(); console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); } }

(async () => {
  const exe = process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe });
  const pageerrors = [];

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on('pageerror', e => pageerrors.push('m:' + String(e.message).slice(0, 100)));
  await mobile.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await mobile.waitForTimeout(1500);
  await mobile.evaluate(() => {
    localStorage.setItem('hj_onboard_done', '1');
    try { loadDemo(); } catch (e) {}
    document.body.classList.add('mobile-mode');
  });

  await test('폰: 주요 탭 버튼이 누를 만한 높이다(32px 이상)', async () => {
    const r = await mobile.evaluate(async () => {
      const bad = {};
      for (const t of ['dashboard', 'schedule', 'ledger', 'estimates']) {
        state.tab = t; state.activeProject = null; render();
        await new Promise(x => setTimeout(x, 330));
        bad[t] = [...document.querySelectorAll('#view button')]
          .filter(b => b.offsetParent !== null && !b.classList.contains('ph-phase'))
          .map(b => ({ h: Math.round(b.getBoundingClientRect().height), t: b.textContent.trim().slice(0, 10) }))
          .filter(x => x.h > 0 && x.h < 32);
      }
      return bad;
    });
    Object.keys(r).forEach(t => assert(r[t].length === 0, t + ' 탭에 얇은 버튼: ' + JSON.stringify(r[t].slice(0, 4))));
  });

  await test('폰: 버튼이 서로 겹치지 않는다', async () => {
    const r = await mobile.evaluate(async () => {
      let ov = 0;
      for (const t of ['dashboard', 'schedule', 'ledger', 'estimates', 'photos']) {
        state.tab = t; state.activeProject = null; render();
        await new Promise(x => setTimeout(x, 320));
        const bs = [...document.querySelectorAll('#view button')].filter(b => b.offsetParent !== null)
          .map(b => b.getBoundingClientRect());
        for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
          if (Math.min(bs[i].right, bs[j].right) - Math.max(bs[i].left, bs[j].left) > 2 &&
              Math.min(bs[i].bottom, bs[j].bottom) - Math.max(bs[i].top, bs[j].top) > 2) ov++;
        }
      }
      return ov;
    });
    assert(r === 0, '버튼 겹침 ' + r + '건');
  });

  // [v329] 폰(모바일 모드·폭 640 이하)의 대시보드 표는 이제 카드로 쌓여 밀 표가 없다(tests/dash-cards.e2e.js 가 지킨다).
  // '밀 수 있다는 신호' 계약은 여전히 PC 레이아웃의 좁은 창(768px — 표 min-width 640 이 본문보다 넓다)에 남아 있으므로
  // 검사 대상을 그 화면으로 옮긴다(완화가 아니라 대상 이동 — 단정은 그대로).
  const narrow = await browser.newPage({ viewport: { width: 768, height: 900 } });
  narrow.on('pageerror', e => pageerrors.push('n:' + String(e.message).slice(0, 100)));
  await narrow.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await narrow.waitForFunction(() => !!window.__hjRestoreDone && !!window.__hjRelayBootDone);
  await narrow.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]));
  // 설정 복원(폭 820 이하면 모바일 모드로 켠다)이 끝나면 푸터 #buildTag 가 채워진다 — 그 뒤에 꺼야 부팅이 다시 켜지 않는다
  await narrow.waitForFunction(() => /^build /.test((document.getElementById('buildTag') || {}).textContent || ''));
  await narrow.evaluate(() => {
    localStorage.setItem('hj_onboard_done', '1');
    try { loadDemo(); } catch (e) {}
    __mobileMode = false; applyMobileMode();
  });

  await test('좁은 PC 창: 넓은 표에는 밀어보라는 안내가 뜬다', async () => {
    assert(await narrow.evaluate(() => !document.body.classList.contains('mobile-mode')), '시나리오 전제(모바일 모드 꺼짐)가 성립하지 않음');
    const r = await narrow.evaluate(async () => {
      state.tab = 'dashboard'; state.activeProject = null; render();
      await new Promise(x => setTimeout(x, 350));
      const v = document.getElementById('view');
      const wraps = [...v.querySelectorAll('.tbl-scroll')];
      const wide = wraps.filter(w => { const t = w.querySelector('table'); return t && t.scrollWidth > w.clientWidth + 4; });
      const shown = [...v.querySelectorAll('.tbl-hint')].filter(h => getComputedStyle(h).display !== 'none');
      return { wide: wide.length, shown: shown.length, text: shown[0] ? shown[0].textContent : '' };
    });
    assert(r.wide > 0, '넓은 표가 없어 검증 불가');
    assert(r.shown === r.wide, '안내 수가 넓은 표 수와 다름: ' + JSON.stringify(r));
    assert(/오른쪽/.test(r.text), '안내 문구가 무엇을 보라는지 말하지 않음: ' + r.text);
  });

  await test('좁은 PC 창: 한 번 밀면 안내가 사라진다', async () => {
    const r = await narrow.evaluate(async () => {
      const w = [...document.querySelectorAll('#view .tbl-scroll')]
        .find(x => { const t = x.querySelector('table'); return t && t.scrollWidth > x.clientWidth + 4; });
      if (!w) return { skip: true };
      const hint = w.previousElementSibling;
      const before = getComputedStyle(hint).display !== 'none';
      w.scrollLeft = 120;
      w.dispatchEvent(new Event('scroll'));
      await new Promise(x => setTimeout(x, 120));
      return { before, after: getComputedStyle(hint).display !== 'none' };
    });
    assert(r.skip !== true, '대상 표 없음');
    assert(r.before === true && r.after === false, '민 뒤에도 안내가 남음: ' + JSON.stringify(r));
  });

  const pc = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  pc.on('pageerror', e => pageerrors.push('pc:' + String(e.message).slice(0, 100)));
  await pc.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await pc.waitForTimeout(1500);

  await test('PC: 표가 다 보이면 안내를 띄우지 않는다', async () => {
    const r = await pc.evaluate(async () => {
      localStorage.setItem('hj_onboard_done', '1');
      try { loadDemo(); } catch (e) {}
      state.tab = 'dashboard'; state.activeProject = null; render();
      await new Promise(x => setTimeout(x, 350));
      const v = document.getElementById('view');
      return {
        shown: [...v.querySelectorAll('.tbl-hint')].filter(h => getComputedStyle(h).display !== 'none').length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    assert(r.shown === 0, 'PC에서 불필요한 안내: ' + JSON.stringify(r));
    assert(r.overflow === false, 'PC 가로 밀림');
  });

  assert(pageerrors.length === 0, 'pageerror: ' + pageerrors.join(' | '));
  console.log('\n== mobile-tap-table: ' + pass + '/' + (pass + fail) + ' passed, pageerrors=' + pageerrors.length + ' ==');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();

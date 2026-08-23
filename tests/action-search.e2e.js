/* 기능 검색: 사장님이 치는 말로 찾히는가 (v222)
   배경 1: "오시는길"처럼 띄어쓰기 없이 치면 하나도 안 나왔다. 화면 이름을
           정확히 외워야 찾히는 검색은 검색이 아니다.
   배경 2: 자재 발주·포트폴리오·전체 장부 엑셀·주간 브리핑·설정은 메뉴 깊은
           곳에 있는데 검색에도 없어 닿을 길이 사실상 없었다.
   주의: 등록한 기능은 전부 실제 함수여야 한다 — 없는 함수를 걸어두면
         눌렀을 때 죽는다.
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageerrors = [];
  page.on('pageerror', e => pageerrors.push(String(e.message).slice(0, 110)));
  await page.goto('http://127.0.0.1:8299/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { localStorage.setItem('hj_onboard_done', '1'); try { loadDemo(); } catch (e) {} });

  await test('띄어쓰기 없이 쳐도 찾힌다', async () => {
    const r = await page.evaluate(() => {
      const want = { '오시는길': '오시는 길', '품목세트': '품목 세트', '사진도구': '사진 도구',
                     '고객페이지': '고객 페이지', '서류만들기': '서류 만들기', '월말마감': '월말 마감' };
      const bad = [];
      Object.keys(want).forEach(q => {
        const hit = hjActionSearch(q);
        if (!hit.some(a => a.n === want[q])) bad.push(q + '→' + (hit[0] ? hit[0].n : '없음'));
      });
      return bad;
    });
    assert(r.length === 0, '붙여 쓰면 못 찾음: ' + JSON.stringify(r));
  });

  await test('띄어 쓴 원래 말도 그대로 찾힌다', async () => {
    const r = await page.evaluate(() =>
      ['오시는 길', '품목 세트', '월말 마감', '보증서', '기름'].filter(q => hjActionSearch(q).length === 0));
    assert(r.length === 0, '기존 검색이 깨짐: ' + JSON.stringify(r));
  });

  await test('메뉴 깊은 기능도 검색으로 닿는다', async () => {
    const r = await page.evaluate(() => {
      const want = { '자재': '자재 발주서', '포트폴리오': '포트폴리오 PDF', '장부 엑셀': '전체 장부 엑셀',
                     '주간': '주간 브리핑', '설정': '설정·백업' };
      const bad = [];
      Object.keys(want).forEach(q => { if (!hjActionSearch(q).some(a => a.n === want[q])) bad.push(q); });
      return bad;
    });
    assert(r.length === 0, '검색으로 못 닿는 기능: ' + JSON.stringify(r));
  });

  await test('등록된 기능은 전부 실제로 실행 가능한 함수다', async () => {
    const r = await page.evaluate(() => ({
      total: HJ_ACTIONS.length,
      dead: HJ_ACTIONS.filter(a => typeof a.run !== 'function').map(a => a.n),
      dup: HJ_ACTIONS.map(a => a.n).filter((n, i, arr) => arr.indexOf(n) !== i)
    }));
    assert(r.dead.length === 0, '실행 불가 항목: ' + JSON.stringify(r.dead));
    assert(r.dup.length === 0, '이름 중복: ' + JSON.stringify(r.dup));
    assert(r.total >= 30, '등록 수가 줄었다: ' + r.total);
  });

  await test('검색에 추가된 깊은 기능은 올바른 실행 대상으로 연결된다', async () => {
    const r = await page.evaluate(() => {
      const names = ['자재 발주서', '포트폴리오 PDF', '전체 장부 엑셀', '주간 브리핑', '설정·백업'];
      const calls = [];
      const originals = {
        materialOrder: window.materialOrder,
        exportPortfolio: window.exportPortfolio,
        exportFullXlsx: window.exportFullXlsx,
        weekBrief: window.weekBrief,
        openGdriveSetup: window.openGdriveSetup,
        hjNeedProj: window.hjNeedProj
      };
      window.materialOrder = () => calls.push('자재 발주서');
      window.exportPortfolio = () => calls.push('포트폴리오 PDF');
      window.exportFullXlsx = () => calls.push('전체 장부 엑셀');
      window.weekBrief = () => calls.push('주간 브리핑');
      window.openGdriveSetup = () => calls.push('설정·백업');
      window.hjNeedProj = fn => fn('테스트 현장');
      try {
        names.forEach(name => HJ_ACTIONS.find(a => a.n === name)?.run());
      } finally {
        Object.keys(originals).forEach(key => { window[key] = originals[key]; });
      }
      return { names, calls };
    });
    assert(r.calls.length === r.names.length && r.names.every(name => r.calls.includes(name)),
      '검색 실행 연결이 어긋남: ' + JSON.stringify(r));
  });

  await test('검색창에 치면 바로가기 목록이 뜬다', async () => {
    const r = await page.evaluate(async () => {
      const gi = document.getElementById('globalSearch');
      gi.value = '자재발주';
      gi.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 300));
      const box = document.getElementById('hjCmdBox');
      const items = box ? [...box.querySelectorAll('.hjCmdIt')].map(b => b.textContent.trim()) : [];
      gi.value = '';
      gi.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 250));
      return { items, closed: !document.getElementById('hjCmdBox') };
    });
    assert(r.items.some(t => t.includes('자재 발주서')), '붙여 친 말로 목록이 안 뜸: ' + JSON.stringify(r.items));
    assert(r.closed === true, '검색어를 지워도 목록이 남음');
  });

  assert(pageerrors.length === 0, 'pageerror: ' + pageerrors.join(' | '));
  console.log('\n== action-search: ' + pass + '/' + (pass + fail) + ' passed, pageerrors=' + pageerrors.length + ' ==');
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();

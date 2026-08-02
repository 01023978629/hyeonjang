/* settings-tabs.e2e.js — ⚙️ 설정 화면 탭 나누기 + 키 [🔎 확인] 회귀

   왜 나눴는가
     예전에는 네 덩어리(드라이브·전자계약·키·기타)를 위에서 아래로 이어 붙여
     한 화면이 **1,510px** 이었다. 폰에서 두 화면 반을 굴려야 키 칸에 닿았고,
     그렇게 못 찾은 것이 사장님 키가 반복해서 사라진 사고의 뿌리였다.

     아코디언으로 접지 않고 탭으로 나눈 이유: 키 칸은 이미 자기 <details> 안에 있어서
     위에 하나 더 씌우면 두 겹이 된다. 두 겹은 '못 찾는 깊이'다
     (key-persist ⑪ 이 그 선을 지킨다). 탭은 <div> 라 겹을 늘리지 않는다.

   왜 [🔎 확인] 을 붙였는가
     키를 넣고 저장해도 맞는지 알 길이 없었다. 오타·만료·권한 미설정이면
     며칠 뒤 "AI가 대답을 안 해요" 로만 드러났고 원인을 짚을 수 없었다.

   지키는 것
     ① 첫 화면이 한 화면에 들어온다 (스크롤이 생기지 않는다)
     ② 탭 넷이 다 있고, 각각 자기 내용을 연다
     ③ 한 번에 한 패널만 보인다 (숨긴 패널은 hidden)
     ④ 좌우 화살표로 탭을 옮길 수 있다 (탭 목록의 표준 동작)
     ⑤ 열지 않아도 상태가 보인다 — 탭마다 설정됨/미설정 점
     ⑥ 탭이 <details> 겹을 늘리지 않는다 — 키는 여전히 한 겹
     ⑦ [확인]이 실제로 그 API 에 시험 호출을 하고, 성공/실패를 각각 다르게 알린다
     ⑧ [확인]은 키를 저장하지 않는다 — 확인과 저장은 다른 행동이다
     ⑨ [확인]은 칸에 새로 넣은 값을 먼저 쓴다 — 저장 전에 오타를 거를 수 있어야 한다
     ⑩ 발급처 링크에 rel=noopener (새 창이 원래 창을 조작하지 못하게)
     ⑪ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const TABS = ['save', 'ct', 'keys', 'etc'];

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  // ① 첫 화면이 한 화면에 들어온다
  const size = await page.evaluate(() => {
    openGdriveSetup();
    const m = document.querySelector('#modalRoot .modal');
    return { scroll: m.scrollHeight, view: m.clientHeight, tabs: document.querySelectorAll('#modalRoot .setTab').length };
  });
  assert(size.tabs === 4, '① 탭이 4개가 아님: ' + size.tabs);
  assert(size.scroll <= size.view + 40,
    '① 설정 첫 화면에 스크롤이 생겼다 (' + size.scroll + 'px / 화면 ' + size.view + 'px) — 나눈 의미가 없다');

  // ②③ 탭마다 자기 내용이 열리고, 한 번에 하나만 보인다
  const MARK = { save: '#ryUrl', ct: '#ctUrl', keys: '#gdGemini', etc: '#rvUrl' };
  for (const t of TABS) {
    const r = await page.evaluate(({ t, MARK, TABS }) => {
      document.getElementById('setTab-' + t).click();
      const vis = (sel) => { const e = document.querySelector(sel); return !!(e && e.offsetParent !== null); };
      const shown = TABS.filter(x => !document.getElementById('setPanel-' + x).hidden);
      return { mine: vis(MARK[t]), shown, sel: document.getElementById('setTab-' + t).getAttribute('aria-selected') };
    }, { t, MARK, TABS });
    assert(r.mine, '② ' + t + ' 탭을 눌렀는데 그 내용(' + MARK[t] + ')이 안 보인다');
    assert(r.shown.length === 1 && r.shown[0] === t, '③ 패널이 여럿 보인다: ' + r.shown.join(','));
    assert(r.sel === 'true', '③ aria-selected 가 안 붙었다 — 화면읽기로는 어느 탭인지 알 수 없다');
  }

  // ④ 좌우 화살표로 이동
  const arrow = await page.evaluate(async () => {
    const first = document.getElementById('setTab-save');
    first.click(); first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const after = document.activeElement && document.activeElement.dataset.tab;
    const shown = ['save', 'ct', 'keys', 'etc'].filter(x => !document.getElementById('setPanel-' + x).hidden);
    return { after, shown };
  });
  assert(arrow.after === 'ct' && arrow.shown[0] === 'ct',
    '④ 화살표로 탭이 안 옮겨진다 (초점 ' + arrow.after + ' · 열린 패널 ' + arrow.shown.join(',') + ')');

  // ⑤ 열지 않아도 상태가 보인다
  const dots = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#modalRoot .setTab').forEach(b => {
      const s = b.querySelector('span[title]');
      out[b.dataset.tab] = s ? s.getAttribute('title') : null;
    });
    return out;
  });
  for (const t of TABS) {
    assert(dots[t] && /설정됨|미설정|자가진단/.test(dots[t]),
      '⑤ ' + t + ' 탭에 상태 표시가 없다 — 열어 봐야만 알 수 있으면 나눈 뜻이 반감된다');
  }

  // ⑥ 탭이 <details> 겹을 늘리지 않는다
  const depth = await page.evaluate(() => {
    document.getElementById('setTab-keys').click();
    const modal = document.querySelector('#modalRoot .modal');
    const d = (id) => {
      let n = 0, cur = (document.getElementById(id) || {}).parentElement;
      while (cur && cur !== modal) { if (cur.tagName === 'DETAILS') n++; cur = cur.parentElement; }
      return n;
    };
    return { gemini: d('gdGemini'), vision: d('gdVision'), kakao: d('gdKakao'), openai: d('gdOpenai') };
  });
  for (const [k, v] of Object.entries(depth)) {
    assert(v <= 1, '⑥ ' + k + ' 키가 아코디언 ' + v + '겹 안에 있다 — 탭이 겹을 늘렸다');
  }

  // ⑦⑧⑨ [확인] — 실제 호출 · 성공/실패 구분 · 저장하지 않음 · 칸 값 우선
  const check = await page.evaluate(async () => {
    document.getElementById('setTab-keys').click();
    document.querySelectorAll('#modalRoot details').forEach(d => { d.open = true; });
    window.__geminiKey = 'AIzaSAVED-0001';
    const seen = [];
    const real = window.fetch;
    window.fetch = async (u, opt) => {
      const url = String(u);
      if (url.indexOf('generativelanguage') < 0) return real(u, opt);
      seen.push({ url, key: (opt.headers || {})['x-goog-api-key'] });
      return { ok: seen.length === 1, status: seen.length === 1 ? 200 : 401, json: async () => ({}) };
    };
    const el = document.getElementById('gdGemini');
    const out = document.getElementById('gdGeminiOut');
    // ⑨ 칸에 새 값을 넣고 확인 → 저장된 키가 아니라 그 값을 써야 한다
    el.value = 'AIzaTYPED-9999';
    await document.getElementById('gdGeminiChk').onclick();
    const okText = out.textContent, okColor = out.style.color;
    const savedAfter = window.__geminiKey;    // ⑧ 확인이 저장하면 안 된다
    const inputAfter = el.value;
    // 두 번째 호출은 401 → 실패로 알려야 한다
    await document.getElementById('gdGeminiChk').onclick();
    const badText = out.textContent, badColor = out.style.color;
    window.fetch = real;
    return { calls: seen.length, usedKey: seen[0] && seen[0].key, okText, okColor, badText, badColor, savedAfter, inputAfter };
  });
  assert(check.calls === 2, '⑦ [확인]이 실제 호출을 하지 않았다: ' + check.calls + '회');
  assert(/작동/.test(check.okText) && /✅/.test(check.okText), '⑦ 성공을 알리지 않는다: ' + check.okText);
  assert(/맞지 않|⚠️/.test(check.badText), '⑦ 실패를 알리지 않는다: ' + check.badText);
  assert(check.okColor !== check.badColor, '⑦ 성공과 실패가 같은 색이다 — 눈으로 구분되지 않는다');
  assert(check.savedAfter === 'AIzaSAVED-0001', '⑧ [확인]이 키를 저장해 버렸다 — 확인과 저장은 다른 행동이다');
  assert(check.inputAfter === 'AIzaTYPED-9999', '⑧ [확인]이 입력칸을 비웠다 — 저장을 못 누르게 된다');
  assert(check.usedKey === 'AIzaTYPED-9999',
    '⑨ [확인]이 칸에 넣은 값을 쓰지 않고 저장된 키를 썼다 — 저장 전에 오타를 거를 수 없다: ' + check.usedKey);

  // ⑩ 발급처 링크는 noopener
  const links = await page.evaluate(() => {
    document.getElementById('setTab-keys').click();
    return [...document.querySelectorAll('#modalRoot a[target="_blank"]')]
      .map(a => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') || '' }));
  });
  assert(links.length >= 4, '⑩ 발급처 바로가기가 없다 — 키를 어디서 받는지 다시 찾아 헤매게 된다');
  for (const l of links) assert(/noopener/.test(l.rel), '⑩ rel=noopener 없음: ' + l.href);

  assert(errors.length === 0, '⑪ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 설정 첫 화면이 한 화면에 들어온다 (' + size.scroll + 'px / ' + size.view + 'px)');
  console.log('PASS  ② 탭 넷이 각각 자기 내용을 연다');
  console.log('PASS  ③ 한 번에 한 패널만 · aria-selected 표시');
  console.log('PASS  ④ 좌우 화살표로 탭 이동');
  console.log('PASS  ⑤ 열지 않아도 탭마다 상태가 보인다');
  console.log('PASS  ⑥ 탭이 아코디언 겹을 늘리지 않는다');
  console.log('PASS  ⑦ [확인]이 실제로 호출하고 성공/실패를 구분해 알린다');
  console.log('PASS  ⑧ [확인]은 저장하지 않는다');
  console.log('PASS  ⑨ [확인]은 칸에 넣은 값을 먼저 쓴다');
  console.log('PASS  ⑩ 발급처 링크 rel=noopener');
  console.log('PASS  ⑪ pageerror 0');
  console.log('\n전부 통과 (11건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

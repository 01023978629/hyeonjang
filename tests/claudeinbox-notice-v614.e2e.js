/* claudeinbox-notice-v614.e2e.js — 🤖 클로드 요청함 알림: 카톡봇·클로드 요청이 첫 화면 한 줄로 보이고 [요청함 열기]로 바로 승인 화면

   배경: 카톡봇(v1.8.6)이 '현장 만들기' 요청을 드라이브 만물인테리어/견적서/클로드_요청함.json 에 쓴다. 예전 현장웹은 대표가
   더보기 › 🤖 클로드 요청함을 열 때만 그 파일을 읽어 요청이 묻혔다. 이제 서버가 연결된 기기는 30분에 한 번 조용히 읽어
   ✅ 오늘 현장 업무 칸에 알린다(읽기만 — 적용은 요청함의 [✓ 승인·적용] 그대로). 단위 검사는 tests/claudeinbox-notice-v614.unit.js.

     ⓪ 부팅 뒤에 붙인 연결은 자동 확인 안 함(다음에 열 때부터) — 이 검사는 그다음 '부팅 때 연결된 기기'로 켠다(__hjCinboxArmed)
     ① 첫 화면을 그리면 요청 파일을 읽어 '요청 4건이 승인을 기다려요' + 새 현장 이름 3개 '외 1곳' (처리한 id·금지 도구 빠짐) · 장부 무변경
     ② 390px 폰 — 단추 44px · 가로 넘침 없음 · 어두운 화면에서도 어두운 바탕·밝은 글자
     ③ 다시 그리기·앱 다시 보기(visibilitychange)는 30분 안이라 중계 요청 0
     ④ [요청함 열기] → 🤖 클로드 요청함에 그 요청들(다시 받지 않음 · 링크 경고 없음) · 열기만으로는 장부 무변경
     ⑤ [✓ 승인·적용] 하나 → 현장이 생기고 첫 화면 줄은 3건으로
     ⑥ [✕] → 숨김(다시 그려도) · 새 요청이 오면(30분 뒤 앱 다시 보기) 다시 4건
     ⑦ 서버 미연결이면 요청 0 · 중계 오류는 조용히(토스트·창 없음)
     ⑧ pageerror 0

   중계는 가짜 relayCall(page 안) — 실제 통신 없음. 이름·id 는 모두 가짜.
   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const req = (id, name) => ({ id, tool: 'add_project', args: { name }, why: '카톡봇: 사진 폴더 새 현장' });
const REQ = { requests: [
  req('kb-20261120-091500-1', '가상하이츠 305동 602호'),
  req('kb-20261120-091500-2', '가상빌라 201호'),
  req('kb-20261120-091500-3', '가상주택 별채'),
  req('kb-20261120-091500-4', '가상상가 1층'),
  req('kb-20261119-100000-1', '가상 이미 처리한 현장'),
  { id: 'kb-20261120-091500-9', tool: 'delete_project', args: { name: '가상 기존현장' }, why: '금지 도구' }
] };

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  // 부팅의 IDB 읽기(복원·중계 설정)가 끝난 뒤에 모의값을 넣는다 — 늦게 끝난 부팅이 모의값을 덮어쓰지 않게(claude-inbox.e2e 와 같은 이유)
  await page.evaluate(() => Promise.all([window.__hjRestoreDone, window.__hjRelayConfigDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]));

  const setup = await page.evaluate((reqJson) => {
    try { ['hj_claude_inbox_checked_at', 'hj_claude_inbox_pending', 'hj_claude_inbox_dismissed'].forEach(k => localStorage.removeItem(k)); } catch (_) {}
    __hjCinbox = { at: 0, result: null, items: null, dismissed: null };
    state.projects = [{ name: '가상 기존현장', stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }];
    state.claudeDone = ['kb-20261119-100000-1'];
    state.tab = 'dashboard'; state.activeProject = null;
    __relay.url = 'https://script.google.com/macros/s/AKfyTEST/exec'; __relay.token = 'TEST-RELAY-TOKEN';
    window.__calls = []; window.__other = []; window.__relayMode = 'ok';   // __calls = 요청함이 쓰는 두 가지(목록·내려받기)만 — 앱 다시 보기의 다른 확인(health·officeInbox)은 __other
    window.__dl = btoa(unescape(encodeURIComponent(reqJson)));
    window.relayCall = async (action, payload) => {
      if (action !== 'listFiles' && action !== 'download') { window.__other.push(action); return { ok: true }; }
      window.__calls.push(action);
      if (window.__relayMode === 'throw') throw new Error('가짜 네트워크 오류');
      if (action === 'listFiles') return { ok: true, files: [{ id: 'FREQ1', name: '클로드_요청함.json', mimeType: 'application/json', modifiedAt: '2026-11-20T00:15:00Z' }] };
      if (action === 'download') return { ok: true, fileId: payload.fileId, name: '클로드_요청함.json', dataB64: window.__dl };
      return { ok: true };
    };
    window.__toasts = []; const rt = window.toast; window.toast = (m) => { window.__toasts.push(String(m || '')); try { rt(m); } catch (_) {} };
    render();
    return { calls: window.__calls.slice(), projects: state.projects.length, armed: __hjCinboxArmed };
  }, JSON.stringify(REQ));
  assert(setup.projects === 1, 'seed');
  // ⓪ 부팅 뒤에 붙인 연결(이 검사처럼 · 설정에서 방금 연결)은 켜지지 않는다 — 다음에 열 때부터. 그다음 '부팅 때 연결된 기기'로 켠다.
  const pre = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 400)); return { calls: window.__calls.length, at: localStorage.getItem('hj_claude_inbox_checked_at'), slot: !!document.querySelector('#dashboardClaudeInbox[hidden]') }; });
  assert(setup.armed === false && pre.calls === 0 && pre.at === null && pre.slot, '⓪ 부팅 뒤 연결인데 자동 확인했다: ' + JSON.stringify([setup, pre]));
  await page.evaluate(() => { __hjCinboxArmed = true; render(); });

  // ① 첫 화면 → 요청 파일 읽기 → 한 줄
  await page.waitForFunction(() => !!document.querySelector('#dashboardTodo #dashboardClaudeInbox [data-claude-inbox-notice]'));
  const one = await page.evaluate(() => {
    const n = document.querySelector('[data-claude-inbox-notice]');
    return { text: n.innerText, names: (n.querySelector('[data-claude-inbox-names]') || {}).textContent || '', calls: window.__calls.slice(), projects: state.projects.map(p => p.name),
      hidden: document.getElementById('dashboardClaudeInbox').hidden, toasts: window.__toasts.length, modal: !!document.querySelector('#modalRoot .modal') };
  });
  assert(/🤖 카톡봇·클로드 요청 4건이 승인을 기다려요/.test(one.text), '① 건수 줄: ' + one.text);
  assert(one.names === '🏗 새 현장: 가상하이츠 305동 602호 · 가상빌라 201호 · 가상주택 별채 외 1곳', '① 이름 줄: ' + one.names);
  assert(!/이미 처리한/.test(one.text), '① 처리한 요청이 보인다');
  assert(JSON.stringify(one.calls) === '["listFiles","download"]', '① 중계 요청이 다르다: ' + JSON.stringify(one.calls));
  assert(JSON.stringify(one.projects) === '["가상 기존현장"]', '① 알림만으로 장부가 바뀌었다: ' + JSON.stringify(one.projects));
  assert(!one.hidden && one.toasts === 0 && !one.modal, '① 조용한 한 줄이어야 한다(토스트·창 없음)');

  // ② 390px — 44px · 가로 넘침 없음 · 어두운 화면
  const lay = await page.evaluate(() => {
    const n = document.querySelector('[data-claude-inbox-notice]'), r = n.getBoundingClientRect();
    const btn = [...n.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return { h: q.height, w: q.width, right: q.right }; });
    const light = { bg: getComputedStyle(n).backgroundColor };
    document.body.classList.add('dark');
    const dark = { bg: getComputedStyle(n).backgroundColor, fg: getComputedStyle(n.querySelector('b')).color };
    document.body.classList.remove('dark');
    return { right: r.right, vw: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, btn, light, dark };
  });
  assert(lay.btn.length === 2 && lay.btn.every(b => b.h >= 44 && b.w >= 44), '② 단추가 44px 보다 작다: ' + JSON.stringify(lay.btn));
  assert(lay.right <= lay.vw && lay.btn.every(b => b.right <= lay.vw), '② 줄이 화면 밖으로 나간다: ' + JSON.stringify(lay));
  assert(lay.scroll <= lay.vw, '② 가로 넘침: ' + lay.scroll + ' > ' + lay.vw);
  const lum = (c) => { const m = String(c).match(/\d+(\.\d+)?/g) || [0, 0, 0]; return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  assert(lum(lay.dark.bg) < 80 && lum(lay.dark.fg) > 160, '② 어두운 화면에서 바탕·글자: ' + JSON.stringify(lay.dark));
  assert(lay.light.bg !== lay.dark.bg, '② 어두운 화면 바탕이 그대로 흰색');

  // ③ 30분 안 — 다시 그리기·앱 다시 보기는 요청 0
  const thr = await page.evaluate(async () => {
    render(); render(); document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 400));
    return { calls: window.__calls.length, at: localStorage.getItem('hj_claude_inbox_checked_at'), still: !!document.querySelector('[data-claude-inbox-notice]') };
  });
  assert(thr.calls === 2, '③ 30분 안인데 중계를 다시 불렀다: ' + thr.calls);
  assert(Number(thr.at) > 0 && thr.still, '③ 확인 시각 기록·줄 유지');

  // ④ [요청함 열기] → 🤖 클로드 요청함
  await page.locator('[data-claude-inbox-open]').click();
  await page.waitForFunction(() => document.querySelectorAll('#modalRoot .clai').length === 4);
  const open = await page.evaluate(() => {
    const root = document.getElementById('modalRoot');
    return { title: (root.querySelector('.modal h3, .modal .mh, .modal header') || root).textContent, txt: root.textContent, calls: window.__calls.length, projects: state.projects.length };
  });
  assert(/🤖 클로드 요청함/.test(open.txt), '④ 요청함이 안 열렸다');
  assert(/가상하이츠 305동 602호/.test(open.txt) && /가상상가 1층/.test(open.txt), '④ 요청이 안 보인다');
  assert(!/이미 처리한/.test(open.txt), '④ 처리한 요청이 다시 보인다');
  assert(!/출처를 앱이 확인할 수 없습니다/.test(open.txt), '④ 드라이브 요청인데 링크 경고가 뜬다');
  assert(open.calls === 2, '④ 열 때 다시 받았다(받은 결과를 쓰지 않음): ' + open.calls);
  assert(open.projects === 1, '④ 열기만 했는데 장부가 바뀌었다');

  // ⑤ 하나 승인 → 현장 생김 · 첫 화면 줄 3건
  const ap = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 700));   // 오탭 방지 잠금이 풀릴 때까지
    document.querySelectorAll('#modalRoot .clai')[0].click();
    const t0 = Date.now(); while (Date.now() - t0 < 5000 && document.querySelectorAll('#modalRoot .clai').length !== 3) await new Promise(r => setTimeout(r, 50));
    const left = document.querySelectorAll('#modalRoot .clai').length;
    closeModal();
    await new Promise(r => setTimeout(r, 200));
    const n = document.querySelector('[data-claude-inbox-notice]');
    return { left, projects: state.projects.map(p => p.name), done: state.claudeDone.slice(), text: n ? n.innerText : '', calls: window.__calls.length };
  });
  assert(ap.left === 3, '⑤ 승인 뒤 남은 요청이 3건이 아니다: ' + ap.left);
  assert(ap.projects.includes('가상하이츠 305동 602호'), '⑤ 승인했는데 현장이 안 생겼다: ' + JSON.stringify(ap.projects));
  assert(ap.done.includes('kb-20261120-091500-1'), '⑤ 처리 기록(claudeDone) 없음');
  assert(/요청 3건이 승인을 기다려요/.test(ap.text) && !/가상하이츠/.test(ap.text), '⑤ 첫 화면 줄이 줄지 않았다: ' + ap.text);
  assert(ap.calls === 2, '⑤ 승인 중 중계를 다시 불렀다: ' + ap.calls);

  // ⑥ [✕] → 숨김 · 새 요청이 오면 다시
  await page.locator('[data-claude-inbox-dismiss]').click();
  const dis = await page.evaluate(async () => {
    const hid1 = document.getElementById('dashboardClaudeInbox').hidden && !document.querySelector('[data-claude-inbox-notice]');
    render(); await new Promise(r => setTimeout(r, 200));
    const hid2 = !document.querySelector('[data-claude-inbox-notice]');
    return { hid1, hid2, saved: JSON.parse(localStorage.getItem('hj_claude_inbox_dismissed') || '[]') };
  });
  assert(dis.hid1 && dis.hid2, '⑥ 닫았는데 줄이 남는다: ' + JSON.stringify(dis));
  assert(dis.saved.length === 3, '⑥ 숨긴 요청 id 를 기억하지 않는다: ' + JSON.stringify(dis.saved));
  const again = await page.evaluate(async (newReq) => {
    const cur = JSON.parse(decodeURIComponent(escape(atob(window.__dl))));
    cur.requests.push(newReq);
    window.__dl = btoa(unescape(encodeURIComponent(JSON.stringify(cur))));
    localStorage.setItem('hj_claude_inbox_checked_at', String(Date.now() - 31 * 60 * 1000)); __hjCinbox.at = 0;   // 30분이 지난 셈
    document.dispatchEvent(new Event('visibilitychange'));
    const t0 = Date.now(); while (Date.now() - t0 < 5000 && !document.querySelector('[data-claude-inbox-notice]')) await new Promise(r => setTimeout(r, 50));
    const n = document.querySelector('[data-claude-inbox-notice]');
    return { text: n ? n.innerText : '', ids: hjClaudeInboxNoticeData().ids, calls: window.__calls.slice(2) };
  }, req('kb-20261120-101500-1', '가상오피스텔 1204호'));
  assert(/요청 4건이 승인을 기다려요/.test(again.text) && /가상빌라 201호 · 가상주택 별채 · 가상상가 1층 외 1곳/.test(again.text), '⑥ 새 요청이 와도 다시 안 보인다: ' + again.text);
  assert(again.ids[again.ids.length - 1] === 'kb-20261120-101500-1', '⑥ 새 요청 id: ' + JSON.stringify(again.ids));
  assert(JSON.stringify(again.calls) === '["listFiles","download"]', '⑥ 30분 뒤 앱 다시 보기 확인: ' + JSON.stringify(again.calls));

  // ⑦ 서버 미연결 → 요청 0 · 오류는 조용히
  const quiet = await page.evaluate(async () => {
    const n0 = window.__calls.length;
    __relay.token = ''; localStorage.removeItem('hj_claude_inbox_checked_at'); __hjCinbox.at = 0;
    render(); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 400));
    const offCalls = window.__calls.length - n0, offAt = localStorage.getItem('hj_claude_inbox_checked_at');
    __relay.token = 'TEST-RELAY-TOKEN'; window.__relayMode = 'throw'; window.__toasts = [];
    render(); await new Promise(r => setTimeout(r, 500));
    const errCalls = window.__calls.length - n0;
    render(); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 300));
    return { offCalls, offAt, errCalls, after: window.__calls.length - n0, toasts: window.__toasts.slice(), modal: !!document.querySelector('#modalRoot .modal') };
  });
  assert(quiet.offCalls === 0 && quiet.offAt === null, '⑦ 서버 미연결인데 요청했다: ' + JSON.stringify(quiet));
  assert(quiet.errCalls === 1, '⑦ 연결되면 확인한다(목록 한 번): ' + JSON.stringify(quiet));
  assert(quiet.after === 1, '⑦ 실패 뒤에도 30분은 다시 안 부른다: ' + JSON.stringify(quiet));
  assert(quiet.toasts.length === 0 && !quiet.modal, '⑦ 오류를 알림창·토스트로 띄웠다: ' + JSON.stringify(quiet.toasts));

  assert(errors.length === 0, '⑧ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 첫 화면 한 줄 — 4건 · 이름 3개 외 1곳 · 처리한 것·금지 도구 빠짐 · 장부 무변경');
  console.log('PASS  ② 390px 44px · 가로 넘침 없음 · 어두운 화면');
  console.log('PASS  ③ 30분 안 다시 그리기·앱 다시 보기 요청 0');
  console.log('PASS  ④ [요청함 열기] → 🤖 클로드 요청함(다시 받지 않음 · 링크 경고 없음)');
  console.log('PASS  ⑤ 승인 하나 → 현장 생김 · 줄 3건');
  console.log('PASS  ⑥ [✕] 숨김 · 새 요청이 오면 다시');
  console.log('PASS  ⑦ 서버 미연결 요청 0 · 오류는 조용히');
  console.log('PASS  ⑧ pageerror 0');
  console.log('\n전부 통과 (8건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

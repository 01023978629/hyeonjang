/* apt-edit.e2e.js — 오더의 동/호·작업내용 즉석 수정

   금액은 목록에서 고칠 수 있게 됐는데(apt-amount) 동/호·작업내용은
   여전히 지우고 다시 넣어야 했다. 동/호 오타는 [📸] 사진 연결(파일명 검색)까지
   어긋나게 하므로 고칠 길이 필요하다. 규칙은 금액과 동일하다.

     ① 동/호를 눌러 고치면 반영되고, [📸] 사진 검색어도 새 동/호 기준이 된다
     ② 작업내용을 고치면 정산서 문안에도 새 내용이 실린다
     ③ 입금완료(paid)는 둘 다 봉인 — 정산 끝난 기록. 이유를 설명한다
     ④ 취소·빈 값은 '안 바꿈'
     ⑤ 고친 값에 HTML 을 넣어도 실행되지 않는다 (escapeHtml)
     ⑥ pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://localhost:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hj_onboard_done', '1'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const ym = localDate().slice(0, 7);
    window.__ym = ym;
    state.aptOffices = [{ id: 'of1', complex: '신흥마을아파트', manager: '', phone: '' }];
    state.aptOrders = [
      { id: 'd1', officeId: 'of1', unit: '103동 1240호', text: '욕실 실린콘', amount: 80000, date: localDate(), status: 'done', doneAt: ym + '-03' },   // 일부러 오타
      { id: 'd2', officeId: 'of1', unit: '301동 707호', text: '입금된 건', amount: 70000, date: localDate(), status: 'paid', doneAt: ym + '-05' }
    ];
    state.files = state.files.filter(f => !/EDITTEST/.test(f.name || ''));
    state.files.push({ name: 'EDITTEST_신흥마을아파트_103동1204호_실리콘.jpg', ext: 'jpg', kind: 'photo' });
  });

  // ① 동/호 오타 수정 → 사진 검색어까지 맞춰진다
  const unit = await page.evaluate(async () => {
    aptOrderManage('of1');
    const before = aptPhotoCount(state.aptOrders.find(o => o.id === 'd1'));   // 오타라 0장
    window.prompt = () => '103동 1204호';
    await document.getElementById('modalRoot').querySelector('.apoUnit[data-id="d1"]').onclick();
    const o = state.aptOrders.find(x => x.id === 'd1');
    return { before, unit: o.unit, after: aptPhotoCount(o) };
  });
  assert(unit.before === 0 && unit.unit === '103동 1204호' && unit.after === 1,
    '① 동/호 수정이 사진 연결까지 살리지 못한다: ' + JSON.stringify(unit));

  // ② 작업내용 수정 → 정산서 문안 반영
  const text = await page.evaluate(async () => {
    window.prompt = () => '욕실 실리콘 교체';
    await document.getElementById('modalRoot').querySelector('.apoText[data-id="d1"]').onclick();
    aptSettle('of1', window.__ym);
    const t = document.getElementById('modalRoot').querySelector('#apsText').value;
    const back = (aptOrderManage('of1'), true);
    return { text: state.aptOrders.find(x => x.id === 'd1').text, inSettle: /욕실 실리콘 교체/.test(t), back };
  });
  assert(text.text === '욕실 실리콘 교체' && text.inSettle, '② 작업내용 수정이 정산서에 안 실린다');

  // ③ 입금완료는 봉인
  const sealed = await page.evaluate(async () => {
    let promptCalled = false; window.prompt = () => { promptCalled = true; return '바꾼값'; };
    let toastMsg = ''; const rt = window.toast; window.toast = (m) => { toastMsg = m; rt(m); };
    await document.getElementById('modalRoot').querySelector('.apoUnit[data-id="d2"]').onclick();
    await document.getElementById('modalRoot').querySelector('.apoText[data-id="d2"]').onclick();
    window.toast = rt;
    const o = state.aptOrders.find(x => x.id === 'd2');
    return { unit: o.unit, text: o.text, promptCalled, toastMsg };
  });
  assert(sealed.unit === '301동 707호' && sealed.text === '입금된 건' && !sealed.promptCalled,
    '③ 입금완료 기록이 고쳐진다 — 정산 근거가 흔들린다');
  assert(/고칠 수 없습니다|새 오더/.test(sealed.toastMsg), '③ 왜 안 되는지 설명이 없다: ' + sealed.toastMsg);

  // ④ 취소·빈 값은 안 바꿈
  const keep = await page.evaluate(async () => {
    window.prompt = () => null;
    await document.getElementById('modalRoot').querySelector('.apoUnit[data-id="d1"]').onclick();
    window.prompt = () => '  ';
    await document.getElementById('modalRoot').querySelector('.apoText[data-id="d1"]').onclick();
    const o = state.aptOrders.find(x => x.id === 'd1');
    return { unit: o.unit, text: o.text };
  });
  assert(keep.unit === '103동 1204호' && keep.text === '욕실 실리콘 교체', '④ 취소/빈 값인데 값이 바뀜: ' + JSON.stringify(keep));

  // ⑤ HTML 주입 — 실행되지 않는다
  const xss = await page.evaluate(async () => {
    window.__xssEdit = false;
    window.prompt = () => '<img src=x onerror="window.__xssEdit=true">';
    await document.getElementById('modalRoot').querySelector('.apoText[data-id="d1"]').onclick();
    await new Promise(r => setTimeout(r, 200));
    const root = document.getElementById('modalRoot');
    return { fired: window.__xssEdit, img: !!root.querySelector('img[src="x"]') };
  });
  assert(!xss.fired && !xss.img, '⑤ 수정값의 HTML 이 실행된다 — escapeHtml 누락');

  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('PASS  ① 동/호 수정 → 사진 연결 회복');
  console.log('PASS  ② 작업내용 수정 → 정산서 반영');
  console.log('PASS  ③ 입금완료 봉인 + 이유 설명');
  console.log('PASS  ④ 취소·빈 값은 안 바꿈');
  console.log('PASS  ⑤ HTML 주입 차단');
  console.log('PASS  ⑥ pageerror 0');
  console.log('\n전부 통과 (6건)');
  await browser.close();
})().catch(async e => {
  console.error('FAIL', e && e.stack || e);
  process.exitCode = 1;
  if (browser) await browser.close().catch(() => {});
});

/* extra-work.e2e.js — 🖊 추가공사 확인 (Playwright)

   2026-09-12: 공사 중 "이것도 해주세요" 를 말로 받아 놓고 정산 때 "그건 원래 포함 아니었어요?" 로 못 받는 일을 막는다.
     ① 더보기 그룹·옛 시트·핸들러에 extrawork 가 있다(정적)
     ② 한 건 적으면 금액·공기 합계와 건수가 따라 움직인다
     ③ '확인받음' 을 눌러 표시하고 되돌릴 수 있다, 사진을 연결할 수 있다
     ④ 값은 현장(state.projects[].extras)에 붙어 저장되고, 저장했다 불러와도 남는다 — 저장 키는 늘지 않는다
     ⑤ 📋 확인 글 — 고객에게 보낼 글을 만든다(자동 발송 없음), 금액을 비우면 '금액 협의'
     ⑥ ➕ 견적에 담기 — 견적 작성 중이면 [추가] 품목으로 들어간다
     ⑦ 지우기는 물어보고 지운다, 현장을 바꾸면 그 현장 것이 나온다, pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const fs = require('fs');
const path = require('path');
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(/\['extrawork','🖊','추가공사 확인'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="extrawork"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='extrawork'\)\{return extraWork\(\);\}/.test(source), '① 핸들러가 extraWork 로 간다');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let sayYes = true, asked = [];
  page.on('dialog', d => { asked.push(d.message()); return sayYes ? d.accept() : d.dismiss(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.extraWork === 'function' && typeof window.hjExtraText === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const sumText = () => page.evaluate(() => (document.querySelector('#exSum') || {}).textContent || '');
  const extras = () => page.evaluate(() => ((state.projects.find(p => p.name === '평화로운아파트') || {}).extras || []).map(x => ({ text: x.text, amount: x.amount, days: x.days, agreed: !!x.agreed, photo: x.photo })));
  const fill = (k, i, v) => page.fill('#modalRoot .exIn[data-k="' + k + '"][data-i="' + i + '"]', v);

  await page.evaluate(() => {
    state.projects = [{ name: '평화로운아파트', stage: 2, received: 0, phases: [], cost: {} }, { name: '유성빌라', stage: 2, received: 0, phases: [], cost: {} }];
    state.files = [{ id: 'f1', kind: 'photo', name: '거실 벽면.jpg', project: '평화로운아파트' }];
    state.activeProject = '평화로운아파트'; state.dirty = false;
    moreActionHandler('extrawork');
  });
  let t = await modalText();
  assert(/추가공사 확인 — 평화로운아파트/.test(t) && /적어 둔 추가공사가 없습니다/.test(t), '① 활성 현장으로 열린다: ' + t.slice(0, 80));

  // ② 한 건 적으면 합계가 움직인다
  await page.click('#exAdd');
  await fill('text', 0, '거실 선반 설치');
  await fill('amount', 0, '300000');
  await fill('days', 0, '1');
  let sum = await sumText();
  assert(/300,000원/.test(sum) && /1건 · \+1일/.test(sum) && /확인받음0건/.test(sum.replace(/\s/g, '')), '② 합계: ' + sum);
  await page.click('#exAdd');
  await fill('text', 1, '베란다 타일 덧방');
  await fill('amount', 1, '450000');
  sum = await sumText();
  assert(/750,000원/.test(sum) && /2건/.test(sum), '② 두 건 합계: ' + sum);

  // ③ 확인받음 표시·사진 연결
  await page.click('#modalRoot .exAgree[data-i="0"]');
  let list = await extras();
  assert(list[0].agreed === true && /확인받음1건/.test((await sumText()).replace(/\s/g, '')), '③ 확인받음: ' + JSON.stringify(list[0]));
  await page.click('#modalRoot .exAgree[data-i="0"]');
  assert((await extras())[0].agreed === false, '③ 되돌리기');
  await page.click('#modalRoot .exAgree[data-i="0"]');
  await page.selectOption('#modalRoot .exIn[data-k="photo"][data-i="0"]', 'f1');
  assert((await extras())[0].photo === 'f1' && /📷 사진 있음/.test(await modalText()), '③ 사진 연결');

  // ④ 현장에 저장·왕복
  list = await extras();
  assert(list.length === 2 && list[0].text === '거실 선반 설치' && (await page.evaluate(() => state.dirty)) === true, '④ 현장에 붙는다: ' + JSON.stringify(list));
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /extra/i.test(k)), '④ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const round = await page.evaluate(() => {
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.projects = [];
    applyData(snap);
    const p = state.projects.find(x => x.name === '평화로운아파트');
    return { n: (p.extras || []).length, first: (p.extras || [])[0] };
  });
  assert(round.n === 2 && round.first.text === '거실 선반 설치' && round.first.agreed === true, '④ 저장했다 불러와도 남는다: ' + JSON.stringify(round));

  // ⑤ 확인 글
  await page.evaluate(() => extraWork('평화로운아파트'));
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#modalRoot .mfoot button:has-text("확인 글")');
  await page.waitForFunction(() => !!window.__copied);
  let copied = await page.evaluate(() => window.__copied);
  assert(/추가공사 확인/.test(copied) && /1\. 거실 선반 설치 — 300,000원 · 공기 \+1일/.test(copied) && /합계 750,000원/.test(copied) && /계약 범위 밖/.test(copied) && /전병덕/.test(copied), '⑤ 확인 글: ' + copied);
  // 금액을 비우면 협의로
  await fill('amount', 1, '');
  await page.evaluate(() => { window.__copied = ''; });
  await page.click('#modalRoot .mfoot button:has-text("확인 글")');
  await page.waitForFunction(() => !!window.__copied);
  copied = await page.evaluate(() => window.__copied);
  assert(/베란다 타일 덧방 — 금액 협의/.test(copied) && /합계 300,000원/.test(copied), '⑤ 금액 협의: ' + copied);
  await fill('amount', 1, '450000');

  // ⑥ 견적에 담기
  assert(await page.evaluate(() => { extraWork('평화로운아파트'); return true; }));
  await page.click('#modalRoot .mfoot button:has-text("견적에 담기")');
  assert(/견적 작성 화면에서 쓰는 기능/.test(await page.evaluate(() => (document.querySelector('#toast') || {}).textContent || '')), '⑥ 견적 작성 중이 아니면 알려 준다');
  await page.evaluate(() => { state.editingQuote = newQuote(false); extraWork('평화로운아파트'); });
  await page.click('#modalRoot .mfoot button:has-text("견적에 담기")');
  const q = await page.evaluate(() => state.editingQuote.items);
  assert(q.length === 2 && q[0].name === '[추가] 거실 선반 설치' && q[0].price === 300000 && q[0].spec === '공기 +1일' && q[1].name === '[추가] 베란다 타일 덧방' && q[1].price === 450000, '⑥ 견적 품목: ' + JSON.stringify(q));

  // ⑦ 지우기·현장 전환
  await page.evaluate(() => extraWork('평화로운아파트'));
  asked = []; sayYes = false;
  await page.click('#modalRoot .exDel[data-i="1"]');
  assert(asked.length === 1 && /베란다 타일 덧방/.test(asked[0]) && (await extras()).length === 2, '⑦ 취소하면 그대로: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#modalRoot .exDel[data-i="1"]');
  assert((await extras()).length === 1, '⑦ 확인하면 지운다');
  await page.selectOption('#exProj', '유성빌라');
  assert(/추가공사 확인 — 유성빌라/.test(await modalText()) && /적어 둔 추가공사가 없습니다/.test(await modalText()), '⑦ 현장 전환');
  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));

  console.log('extra-work.e2e OK (① 메뉴 ② 합계 ③ 확인받음·사진 ④ 현장 저장·왕복 ⑤ 확인 글 ⑥ 견적 담기 ⑦ 지우기·전환)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

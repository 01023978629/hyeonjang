/* completion-links.e2e.js — 체크만 있고 기능으로 안 이어지던 곳을 잇는다 (Playwright)

   2026-09-26: 준공 체크(잔금 청구·보증 안내·사진 ZIP·리뷰 부탁)는 체크박스뿐이었고, 현장 부대사항(siteRules)은
   작업지시·계약서 초안·현장 상세 어디에도 흐르지 않았다.
     ① 준공 체크 줄 옆 버튼이 이미 있는 기능을 연다(settleDocs·warrantyView·exportSiteZip·reviewRequest) —
        도어락 안내 줄에는 버튼이 없다(문안 신설은 대표 승인), 누르기 전 체크 상태를 저장한다
     ② 예치금 칸이 적혀 있으면 '관리실 예치금 환급 확인' 줄이 붙고, 체크가 저장·백업 왕복에서 살아남는다 —
        예치금이 없으면 줄이 없다, 착공 전 체크(idx 2)에는 붙지 않는다, 준공 체크에도 현장 규칙 한 줄이 보인다
     ③ 작업지시 주의사항(#woCau)에 부대사항이 미리 채워지고 고칠 수 있다 — 출입 번호는 새지 않는다
     ④ 계약서 초안 특약 7항에 작업 시간·엘리베이터·폐기물 줄(있을 때만, 값 그대로)
     ⑤ 현장 상세에 '부대사항 N칸 · 추가공사 N건 · 실측 N방' 한 줄과 여는 버튼 — 열기만 해서는 아무것도 쓰지 않는다

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
const goSrc = source.slice(source.indexOf('const STAGE_CHECK_GO={'), source.indexOf('};', source.indexOf('const STAGE_CHECK_GO={')));
assert(goSrc.length > 50, '① STAGE_CHECK_GO 를 찾았다');
assert(!/pwchange/.test(goSrc), '① 도어락 비번 안내에는 버튼(문안)이 없다');

const NAME = '가짜아파트 101동 1001호';
const PLAIN = '규칙없는가짜현장';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {}
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true,
      value: { writeText(t) { window.__copied = t; return Promise.resolve(); } } });
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: undefined });
  });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.stageChecklistView === 'function' && window.__hjRestoreDone && window.__hjRelayBootDone && window.__hjOfficeOpsBootDone);
  await page.evaluate(async () => { await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone, window.__hjOfficeOpsBootDone]); });
  // 부팅 시더가 시나리오 한복판에 자료를 심지 않게 재운다
  await page.evaluate(() => {
    window.taxCalendarEnsure = () => 0; window.coworkSchedEnsure = () => 0; window.backupBootCheck = () => 0; window.kakaoCheckNew = () => 0;
  });
  const seed = () => page.evaluate(([nm, plain]) => {
    closeModal();
    state.projects = [
      { name: nm, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 },
        customer: { name: '가짜고객', phone: '010-0000-1234', addr: '가짜로 1' }, geo: null,
        siteRules: { hours: '평일 09~18시', park: '지하 2층 B구역', elev: '사용 전날 예약', waste: '만물 자가 반출',
          deposit: '예치금 30만원 준공 후 환급', office: '관리실 042-000-0000',
          etc: '도어락 9876',                       // 옛 버전에서 섞여 들어온 출입 번호 — 어디로도 새면 안 된다
          atMap: { hours: '2026-09-01' }, at: '2026-09-01' },
        extras: [{ id: 'x1', text: '문틀 교체' }, { id: 'x2', text: '콘센트 추가' }],
        measure: [{ room: '안방', w: 3, d: 4 }, { room: '거실', w: 5, d: 4 }, { room: '주방', w: 2, d: 3 }] },
      { name: plain, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, geo: null }
    ];
    state.activeProject = null;
  }, [NAME, PLAIN]);
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');

  // ── ① 준공 체크 줄 → 기능 ──
  await seed();
  await page.evaluate(() => {
    window.__calls = [];
    window.settleDocs = (...a) => { __calls.push(['settleDocs', ...a]); };
    window.warrantyView = (...a) => { __calls.push(['warrantyView', ...a]); };
    window.exportSiteZip = (...a) => { __calls.push(['exportSiteZip']); };
    window.reviewRequest = (...a) => { __calls.push(['reviewRequest']); };
  });
  await page.evaluate(nm => stageChecklistView(nm, 3), NAME);
  const go = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .clGo')].map(b => ({ k: b.dataset.go, l: b.textContent, h: b.getBoundingClientRect().height })));
  assert(JSON.stringify(go.map(x => x.k)) === JSON.stringify(['balance', 'warranty', 'zip', 'review']), '① 버튼 네 개(도어락·예치금 줄 제외): ' + JSON.stringify(go));
  assert(go.every(x => x.h >= 44), '① 버튼은 44px: ' + JSON.stringify(go.map(x => x.h)));
  // 누르기 전에 체크한 것이 저장돼야 한다(다른 창이 이 창을 덮는다)
  await page.click('#modalRoot .clChk[data-k="pwchange"]');
  for (const k of ['balance', 'warranty', 'zip', 'review']) await page.click('#modalRoot .clGo[data-go="' + k + '"]');
  const calls = await page.evaluate(() => __calls);
  assert(JSON.stringify(calls) === JSON.stringify([['settleDocs', NAME], ['warrantyView', NAME], ['exportSiteZip'], ['reviewRequest']]), '① 각 버튼이 그 기능을 연다: ' + JSON.stringify(calls));
  const saved1 = await page.evaluate(nm => { const p = state.projects.find(x => x.name === nm); return p.checklists && p.checklists.done; }, NAME);
  assert(saved1 && saved1.pwchange === true && !saved1._ok, '① 버튼을 누르기 전 체크가 저장됐다(완료 표시는 아니다): ' + JSON.stringify(saved1));
  // 줄의 버튼을 눌러도 그 줄 체크는 바뀌지 않는다(버튼은 라벨 밖)
  const balChk = await page.evaluate(() => document.querySelector('#modalRoot .clChk[data-k="balance"]').checked);
  assert(balChk === false, '① 버튼은 체크를 바꾸지 않는다');

  // ── ② 예치금 줄 ──
  const dep = await page.evaluate(() => {
    const c = document.querySelector('#modalRoot .clChk[data-k="deposit"]');
    const row = c && c.closest('label');
    return { has: !!c, text: row ? row.textContent : '', brief: !!document.querySelector('#modalRoot .hjSiteOpen') };
  });
  assert(dep.has && /관리실 예치금 환급 확인/.test(dep.text) && /예치금 30만원 준공 후 환급/.test(dep.text), '② 예치금 줄이 붙고 적어 둔 값이 보인다: ' + JSON.stringify(dep));
  assert(dep.brief, '② 준공 체크에도 현장 규칙 한 줄이 보인다');
  await page.click('#modalRoot .clChk[data-k="deposit"]');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /건너뛰고/.test(x.textContent)); b.click(); });
  const rt = await page.evaluate(nm => {
    const snap = JSON.parse(JSON.stringify(serializeData()));
    applyData(snap);
    const p = state.projects.find(x => x.name === nm);
    return { dep: p.checklists && p.checklists.done && p.checklists.done.deposit, stage: p.stage, keys: Object.keys(snap).length };
  }, NAME);
  assert(rt.dep === true && rt.stage === 3, '② 예치금 체크가 저장·백업 왕복에서 남는다: ' + JSON.stringify(rt));
  assert(rt.keys === 41, '② 직렬화 최상위 키는 그대로(41개): ' + rt.keys);
  await page.evaluate(nm => stageChecklistView(nm, 3), NAME);
  assert(await page.evaluate(() => document.querySelector('#modalRoot .clChk[data-k="deposit"]').checked), '② 다시 열어도 체크돼 있다');
  // 예치금이 없는 현장 · 착공 전 체크에는 없다
  const noDep = await page.evaluate(([nm, plain]) => {
    stageChecklistView(plain, 3);
    const a = !!document.querySelector('#modalRoot .clChk[data-k="deposit"]');
    stageChecklistView(nm, 2);
    const b = !!document.querySelector('#modalRoot .clChk[data-k="deposit"]');
    const g = document.querySelectorAll('#modalRoot .clGo').length;
    return { a, b, g };
  }, [NAME, PLAIN]);
  assert(!noDep.a && !noDep.b && noDep.g === 0, '② 예치금 없는 현장·착공 전 체크에는 예치금 줄·기능 버튼이 없다: ' + JSON.stringify(noDep));

  // ── ③ 작업지시 주의사항 ──
  await seed();
  await page.evaluate(nm => openWorkOrder({ proj: nm }), NAME);
  const cau = await page.evaluate(() => document.querySelector('#woCau').value);
  assert(/출입·작업 시간: 평일 09~18시 \(2026-09-01 확인\)/.test(cau) && /엘리베이터·보양: 사용 전날 예약/.test(cau) && /폐기물 배출 \(누가 치우나\): 만물 자가 반출/.test(cau), '③ 부대사항이 주의사항에 미리 채워진다: ' + cau);
  assert(!/9876/.test(cau) && !/도어락/.test(cau), '③ 출입 번호는 새지 않는다: ' + cau);
  assert(!/현장 규칙$/m.test(cau), '③ 머리줄(현장 규칙 제목)은 빼고 넣는다: ' + cau);
  await page.evaluate(() => { const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /복사/.test(x.textContent)); b.click(); });
  await page.waitForFunction(() => typeof window.__copied === 'string');
  const woText = await page.evaluate(() => window.__copied);
  assert(/■ 주의사항: · 출입·작업 시간: 평일 09~18시/.test(woText) && !/9876/.test(woText), '③ 나가는 작업지시 글에도 실린다(번호 없이): ' + woText);
  // 고칠 수 있다
  await page.fill('#woCau', '오늘은 소음작업 없음');
  await page.evaluate(() => { window.__copied = undefined; const b = [...document.querySelectorAll('#modalRoot .mfoot button')].find(x => /복사/.test(x.textContent)); b.click(); });
  await page.waitForFunction(() => typeof window.__copied === 'string');
  const woText2 = await page.evaluate(() => window.__copied);
  assert(/■ 주의사항: 오늘은 소음작업 없음/.test(woText2) && !/평일 09~18시/.test(woText2), '③ 고친 값이 나간다: ' + woText2);
  await page.evaluate(plain => openWorkOrder({ proj: plain }), PLAIN);
  assert(await page.evaluate(() => document.querySelector('#woCau').value) === '', '③ 규칙 없는 현장은 빈칸 그대로');
  // 적어 둔 것이 출입 번호뿐이면(옛 자료) 채울 것이 없다 — '적어 둔 규칙이 없습니다' 같은 빈 안내를 주의사항에 넣지 않는다
  await page.evaluate(plain => { state.projects.find(x => x.name === plain).siteRules = { etc: '도어락 9876' }; openWorkOrder({ proj: plain }); }, PLAIN);
  const cauOnlyCode = await page.evaluate(() => document.querySelector('#woCau').value);
  assert(cauOnlyCode === '', '③ 출입 번호뿐인 현장은 빈칸 그대로: ' + cauOnlyCode);

  // ── ④ 계약서 초안 특약 ──
  const ct = await page.evaluate(([nm, plain]) => ({
    a: contractDraftText({ project: nm, est: { amount: 10000000 } }),
    b: contractDraftText({ project: plain, est: { amount: 10000000 } })
  }), [NAME, PLAIN]);
  assert(ct.a.includes('7. 특약사항:\n   - 출입·작업 시간: 평일 09~18시\n   - 엘리베이터·보양: 사용 전날 예약\n   - 폐기물 배출 (누가 치우나): 만물 자가 반출\n   - \n   - \n'), '④ 특약에 세 줄(값 그대로) + 빈 줄: ' + ct.a.slice(ct.a.indexOf('7.'), ct.a.indexOf('7.') + 200));
  assert(!/지하 2층|9876|예치금 30만원|042-000-0000/.test(ct.a), '④ 다른 칸·출입 번호는 계약서에 넣지 않는다');
  assert(ct.b.includes('7. 특약사항:\n   - \n   - \n\n'), '④ 규칙 없는 현장은 예전 그대로 빈 줄 둘');
  // 출입 번호처럼 보이는 값은 그 칸도 빼고(옛 자료), 빈 칸은 줄을 만들지 않는다
  const ct2 = await page.evaluate(nm => {
    const p = state.projects.find(x => x.name === nm);
    p.siteRules = { hours: '현관 5790', elev: '', waste: '관리소 지정업체 유상' };
    return contractDraftText({ project: nm, est: { amount: 10000000 } });
  }, NAME);
  assert(ct2.includes('7. 특약사항:\n   - 폐기물 배출 (누가 치우나): 관리소 지정업체 유상\n   - \n   - \n') && !/5790/.test(ct2), '④ 번호 칸·빈 칸은 빠진다: ' + ct2.slice(ct2.indexOf('7.'), ct2.indexOf('7.') + 120));

  // ── ⑤ 현장 상세 한 줄 ──
  await seed();
  const before = await page.evaluate(() => JSON.stringify(state.projects));
  await page.evaluate(nm => { state.tab = 'project'; state.activeProject = nm; render(); }, NAME);
  await page.waitForSelector('#pjLinks');
  const line = await page.evaluate(() => (document.querySelector('#pjLinks') || {}).textContent || '');
  assert(/부대사항 7칸 · 🖊 추가공사 2건 · 📐 실측 3방/.test(line), '⑤ 요약 한 줄: ' + line);
  await page.evaluate(plain => { state.activeProject = plain; render(); }, PLAIN);
  await page.waitForFunction(() => /부대사항 0칸 · 🖊 추가공사 0건 · 📐 실측 0방/.test((document.querySelector('#pjLinks') || {}).textContent || ''));
  const after = await page.evaluate(() => JSON.stringify(state.projects));
  assert(before === after, '⑤ 보여 주기만 해서는 현장 객체에 아무것도 쓰지 않는다(빈 배열도 만들지 않는다)');
  await page.evaluate(nm => { state.activeProject = nm; render(); }, NAME);
  await page.click('#pjLinks [data-pjsite]');
  assert(/현장 부대사항 — 가짜아파트 101동 1001호/.test(await modalText()), '⑤ 🏢 부대사항 버튼이 그 현장 부대사항을 연다');
  await page.evaluate(() => closeModal());
  await page.click('#pjLinks [data-pjextra]');
  const exOpen = await page.evaluate(() => ({ t: (document.querySelector('#modalRoot') || {}).textContent || '', v: [...document.querySelectorAll('#modalRoot .exIn[data-k="text"]')].map(x => x.value) }));
  assert(/추가공사/.test(exOpen.t) && exOpen.v.join('|') === '문틀 교체|콘센트 추가', '⑤ 🖊 추가공사 버튼이 그 현장 추가공사를 연다: ' + JSON.stringify(exOpen.v));
  await page.evaluate(() => closeModal());
  // 버튼은 자기 현장 이름을 들고 간다 — 화면이 다시 그려지기 전에 현재 현장이 바뀌어도 딴 현장을 열지 않는다
  await page.evaluate(plain => { state.activeProject = plain; }, PLAIN);
  await page.click('#pjLinks [data-pjmeasure]');
  const msOpen = await page.evaluate(() => ({ t: (document.querySelector('#modalRoot') || {}).textContent || '', sel: (document.querySelector('#modalRoot select') || {}).value || '' }));
  assert(/실측/.test(msOpen.t) && msOpen.sel === NAME, '⑤ 📐 실측 버튼이 그 현장 실측 노트를 연다: ' + msOpen.sel);
  await page.evaluate(() => closeModal());

  assert(!errors.length, 'pageerror 0: ' + errors.join(' | '));
  console.log('completion-links: ①~⑤ 통과');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });

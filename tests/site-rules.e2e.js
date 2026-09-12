/* site-rules.e2e.js — 🏢 현장 부대사항 (Playwright)

   2026-09-12: 실측 때 관리소에서 들은 규칙(작업 시간·엘리베이터·폐기물)이 시공 당일 아침에 기억나지 않는다.
     ① 더보기 그룹·옛 시트·핸들러에 siterules 가 있다(정적), 현장이 없으면 안내만 한다
     ② 적으면 그 현장(state.projects[].siteRules)에 붙고 '적어 둔 규칙 n개' 가 따라 움직인다
     ③ 저장 키는 늘지 않고, 저장했다 불러와도 남는다 — 출입정보(access)처럼 지워지지 않는다
     ④ 📋 복사 — 적은 칸만 들어간 글을 만든다, 빈 현장은 '아직 적어 둔 규칙이 없습니다'
     ⑤ 📤 공유 — 공유가 되면 공유, 안 되면 복사로 떨어진다
     ⑥ 현장을 바꾸면 그 현장 것이 나오고, 적어 둔 개수가 목록에 보인다
     ⑦ 도어락 비밀번호 칸은 두지 않는다, pageerror 0
     ⑧ 다른 칸에 적은 출입 번호도 저장하지 않는다(관리실 전화번호는 오탐하지 않는다), 백업·동기화에서도 빠진다
     ⑨ 보관 현장도 열린다 — 'AS 때 다시 묻지 않는다'가 바로 그 상황이다, 없는 현장이면 알려 준다
     ⑩ 자료를 새로 불러와 현장 객체가 바뀌어도 입력이 사라지지 않는다
     ⑪ 화면을 열기만 해서는 현장에 아무것도 쓰지 않는다
     ⑫ 복사·공유가 조용히 실패하지 않는다(폴백)
     ⑬ 「선택 복원」이 부대사항을 되살린다
     ⑭ 키보드가 올라와도 아래 버튼 바가 입력칸을 덮지 않는다, 버튼은 44px, 제목은 이름 그대로
     ⑮ 현장을 바꿔도 포커스가 현장 고르기에 남고, 글자마다 안내 문장을 다시 읽지 않는다, 테두리 색이 글과 같이 간다
     ⑯ 정작 필요한 순간에 보인다 — 「📋 착공 전 체크」와 「🧰 출발 전 챙김」에서 바로 열린다
     ⑰ 한 글자씩 쳐도 번호 앞자리가 남지 않는다(실제 키보드), 막힌 입력은 아무것도 만들지 않는다
     ⑱ 낱말 하나하나·단위 하나하나를 따로 확인한다(한 낱말만 살아 있어도 통과하면 안 된다)
     ⑲ 칸마다 확인일이 따로 남는다 — 다른 칸을 고쳐도 옛 칸의 날짜는 그대로다
     ⑳ 복사·공유가 자료 교체 뒤에도 새 객체를 읽고, 나가는 글에는 번호가 섞이지 않는다

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
assert(/\['siterules','🏢','현장 부대사항'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="siterules"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='siterules'\)\{return siteRulesView\(\);\}/.test(source), '① 핸들러가 siteRulesView 로 간다');
// 백업에서 지워지는 이름(access)을 쓰면 적어 둔 규칙이 복원 때 사라진다
assert(/p\.siteRules/.test(source) && !/\bp\.access\s*=/.test(source), '① 저장 위치는 siteRules 다');
// 도어락 비밀번호는 앱에 남기지 않는다 — 칸 자체를 만들지 않는다
const fieldsSrc = source.slice(source.indexOf('const HJ_SITE_FIELDS=['), source.indexOf('];', source.indexOf('const HJ_SITE_FIELDS=[')));
assert(fieldsSrc.length > 300 && (fieldsSrc.match(/\{k:'/g) || []).length === 8, '⑦ 칸 목록 8개를 찾았다: ' + fieldsSrc.length);
assert(!/비밀번호|passwo?rd|공동현관|도어락/i.test(fieldsSrc), '⑦ 비밀번호·출입 칸이 목록에 없다');
const viewSrc = source.slice(source.indexOf('function siteRulesView('), source.indexOf('/* ── 🖊 추가공사 확인'));
assert(!/type="password"|비밀번호[^처]{0,4}(입력|칸)/.test(viewSrc), '⑦ 비밀번호 입력 칸을 그리지 않는다');

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.siteRulesView === 'function' && typeof window.hjSiteText === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const sumText = () => page.evaluate(() => (document.querySelector('#srSum') || {}).textContent || '');
  const rules = n => page.evaluate(nm => ((state.projects.find(p => p.name === nm) || {}).siteRules || null), n);
  const type = (k, v) => page.fill('#modalRoot .srIn[data-k="' + k + '"]', v);

  // ① 현장이 없으면 안내만
  await page.evaluate(() => { state.projects = []; moreActionHandler('siterules'); });
  assert(/현장이 없습니다/.test(await modalText()), '① 현장 없음 안내');
  // 막다른 길이 아니다 — 여기서 바로 현장을 추가할 수 있고, 버튼은 장갑 낀 손으로도 눌린다
  const emptyBtns = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent));
  assert(emptyBtns.some(b => /현장 추가/.test(b)), '① 빈 화면에 현장 추가: ' + JSON.stringify(emptyBtns));
  const emptyTaps = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button'), document.querySelector('#modalRoot .modal-close')]
    .map(b => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height) * 10) / 10; }));
  assert(emptyTaps.every(v => v >= 43.5), '① 44px 아래인 버튼: ' + JSON.stringify(emptyTaps));
  const went = await page.evaluate(() => {
    let got = null; const o = window.moreActionHandler;
    window.moreActionHandler = a => { got = a; };
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /현장 추가/.test(b.textContent)).click();
    window.moreActionHandler = o; return got;
  });
  assert(went === 'addproject', '① 현장 추가로 간다: ' + went);
  await page.evaluate(() => closeModal());

  await page.evaluate(() => {
    state.projects = [{ name: '평화로운아파트', stage: 2, received: 0, phases: [], cost: {} },
                      { name: '유성빌라', stage: 2, received: 0, phases: [], cost: {} }];
    state.activeProject = '평화로운아파트'; state.dirty = false;
    moreActionHandler('siterules');
  });
  let t = await modalText();
  assert(/현장 부대사항 — 평화로운아파트/.test(t) && /아직 적어 둔 규칙이 없습니다/.test(t), '① 활성 현장으로 열린다: ' + t.slice(0, 80));
  const fields = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .srIn')].map(e => e.dataset.k));
  assert(fields.join() === 'hours,park,carry,elev,waste,deposit,office,etc', '① 칸 8개: ' + fields.join());

  // ② 적으면 현장에 붙고 개수가 움직인다
  await type('hours', '평일 09~18시 (소음작업 10~17시)');
  assert(/적어 둔 규칙 1개/.test(await sumText()) && (await page.evaluate(() => state.dirty)) === true, '② 1개: ' + await sumText());
  await type('park', '지하 2층 B구역, 방문증 관리실');
  await type('waste', '후문 지정 장소, 당일 반출');
  assert(/적어 둔 규칙 3개/.test(await sumText()), '② 3개: ' + await sumText());
  let r = await rules('평화로운아파트');
  assert(r.hours === '평일 09~18시 (소음작업 10~17시)' && r.park === '지하 2층 B구역, 방문증 관리실' && r.waste === '후문 지정 장소, 당일 반출', '② 현장에 붙는다: ' + JSON.stringify(r));
  assert(r.at === await page.evaluate(() => localDate()), '② 언제 적었는지 남는다: ' + JSON.stringify(r));
  await type('park', '');
  assert(/적어 둔 규칙 2개/.test(await sumText()), '② 지우면 준다: ' + await sumText());
  await type('park', '지하 2층 B구역, 방문증 관리실');
  // 따옴표·꺾쇠가 섞인 메모도 그대로 다시 열린다(화면을 깨지 않는다)
  await type('etc', '이웃 "예민" <주의>');
  await page.evaluate(() => siteRulesView('평화로운아파트'));
  assert(await page.evaluate(() => (document.querySelector('#modalRoot .srIn[data-k="etc"]') || {}).value) === '이웃 "예민" <주의>', '② 따옴표·꺾쇠가 그대로 돌아온다');
  assert(await page.evaluate(() => !document.querySelector('#modalRoot script')), '② 메모가 태그로 실행되지 않는다');
  await type('etc', '');

  // ③ 저장 키는 그대로, 왕복해도 남는다(출입정보처럼 지워지지 않는다)
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /siterule|rules/i.test(k)), '③ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const round = await page.evaluate(() => {
    const p = state.projects.find(x => x.name === '평화로운아파트');
    p.access = '도어락 1234';                       // 옛 백업에 섞여 있던 출입정보
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.projects = [];
    applyData(snap);
    const q = state.projects.find(x => x.name === '평화로운아파트');
    return { rules: q.siteRules, access: q.access };
  });
  assert(round.rules && round.rules.hours === '평일 09~18시 (소음작업 10~17시)' && round.rules.waste === '후문 지정 장소, 당일 반출', '③ 저장했다 불러와도 남는다: ' + JSON.stringify(round.rules));
  assert(round.access === undefined, '③ 출입정보(access)는 그대로 걸러진다');

  // ④ 📋 복사 — 적은 칸만
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; siteRulesView('평화로운아파트'); });
  await page.click('#modalRoot .mfoot button:has-text("복사")');
  await page.waitForFunction(() => !!window.__copied);
  let copied = await page.evaluate(() => window.__copied);
  assert(/🏢 평화로운아파트 현장 규칙/.test(copied), '④ 제목: ' + copied);
  assert(/· 출입·작업 시간: 평일 09~18시 \(소음작업 10~17시\)/.test(copied) && /· 주차: 지하 2층 B구역/.test(copied) && /· 폐기물 배출 \(누가 치우나\): 후문 지정 장소, 당일 반출/.test(copied), '④ 적은 칸: ' + copied);
  assert(!/엘리베이터|관리실 위치|그 밖에|공사 신고/.test(copied), '④ 빈 칸은 빠진다: ' + copied);
  assert(copied.split('\n')[1].indexOf('· 출입·작업 시간') === 0, '④ 칸 차례는 화면과 같다: ' + copied);
  // 언제 기준인지 밝힌다 — 반년 전 규칙이 '지금 확인한 것'으로 읽히면 분쟁 때 그대로 근거가 된다
  const today = await page.evaluate(() => localDate());
  assert(copied.indexOf('※ ' + today + ' 현장에서 관리실에 들은 내용입니다') > 0 && /그 뒤 바뀌었을 수 있으니/.test(copied), '④ 확인일·한계 안내: ' + copied);
  const empty = await page.evaluate(() => hjSiteText('유성빌라', {}));
  assert(/아직 적어 둔 규칙이 없습니다/.test(empty) && !/undefined/.test(empty), '④ 빈 현장: ' + empty);

  // ⑤ 📤 공유
  const shared = await page.evaluate(async () => {
    window.__shared = null; navigator.share = o => { window.__shared = o; return Promise.resolve(); };
    siteRulesView('평화로운아파트');
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /공유/.test(b.textContent)).click();
    return window.__shared;
  });
  assert(shared && /출입·작업 시간/.test(shared.text) && /평화로운아파트/.test(shared.title), '⑤ 공유: ' + JSON.stringify(shared));
  const fallback = await page.evaluate(() => {
    try { delete navigator.share; } catch (e) {}
    window.__copied = '';
    siteRulesView('평화로운아파트');
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /공유/.test(b.textContent)).click();
    return true;
  });
  await page.waitForFunction(() => !!window.__copied);
  assert(fallback && /출입·작업 시간/.test(await page.evaluate(() => window.__copied)), '⑤ 공유가 안 되면 복사로');

  // ⑥ 현장 전환
  await page.evaluate(() => siteRulesView('평화로운아파트'));
  let opts = await page.evaluate(() => [...document.querySelectorAll('#srProj option')].map(o => o.textContent));
  assert(opts[0] === '평화로운아파트 (3)' && opts[1] === '유성빌라', '⑥ 적어 둔 개수가 목록에: ' + JSON.stringify(opts));
  await page.selectOption('#srProj', '유성빌라');
  t = await modalText();
  assert(/현장 부대사항 — 유성빌라/.test(t) && /아직 적어 둔 규칙이 없습니다/.test(t), '⑥ 현장 전환: ' + t.slice(0, 80));
  await type('elev', '사용 전날 예약, 보양 필수');
  assert((await rules('유성빌라')).elev === '사용 전날 예약, 보양 필수' && (await rules('평화로운아파트')).elev === undefined, '⑥ 다른 현장에 섞이지 않는다');

  // 메뉴 검색에서 '주차'·'엘리베이터' 같은 실제로 찾는 말로 걸린다
  const found = await page.evaluate(() => ['주차', '엘리베이터', '폐기물', '관리실'].map(q => (moreSearchItems(q) || []).map(i => i.id).includes('siterules')));
  assert(found.every(Boolean), '① 메뉴 검색으로 찾을 수 있다: ' + JSON.stringify(found));

  const asks = await page.evaluate(() => [...document.querySelectorAll('#modalRoot input')]
    .map(e => (e.type || '') + '|' + (e.getAttribute('aria-label') || '') + '|' + (e.placeholder || '')));
  assert(asks.length === 8 && !asks.some(a => /password|비밀번호|도어락/i.test(a)), '⑦ 화면에도 비밀번호 칸이 없다: ' + JSON.stringify(asks));

  // ⑧ 출입 번호는 다른 칸에 적어도 저장하지 않는다
  await page.evaluate(() => siteRulesView('평화로운아파트'));
  const before = await sumText();
  // 경고는 평소 감춰져 있다(속성만 아니라 실제로 안 보여야 한다)
  const warnHiddenAtFirst = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .srWarn')]
    .map(w => ({ prop: w.hidden, disp: getComputedStyle(w).display, boxes: w.getClientRects().length })));
  assert(warnHiddenAtFirst.length === 8 && warnHiddenAtFirst.every(w => w.prop && w.disp === 'none' && w.boxes === 0),
    '⑧ 경고가 평소에 보이면 안 된다: ' + JSON.stringify(warnHiddenAtFirst.slice(0, 2)));
  const etcBefore = (await rules('평화로운아파트')).etc;
  await type('etc', '도어락 5678 누르고 들어감');
  let warned = await page.evaluate(() => {
    const w = document.querySelector('#modalRoot .srWarn[data-k="etc"]');
    return { shown: w && !w.hidden && getComputedStyle(w).display !== 'none', text: (w || {}).textContent || '' };
  });
  assert(warned.shown && /저장하지 않았습니다/.test(warned.text), '⑧ 경고가 보인다: ' + JSON.stringify(warned));
  assert((await rules('평화로운아파트')).etc === etcBefore, '⑧ 저장하지 않는다(앞서 값 그대로): ' + JSON.stringify([etcBefore, (await rules('평화로운아파트')).etc]));
  assert((await sumText()) === before, '⑧ 개수도 오르지 않는다');
  // 앞서 저장해 둔 값은 지우지 않는다 — 덧붙이다 번호가 섞여도 원래 메모가 사라지면 안 된다
  await type('waste', '후문 지정 장소, 당일 반출, 도어락 9999');
  assert((await rules('평화로운아파트')).waste === '후문 지정 장소, 당일 반출', '⑧ 앞서 저장된 값은 그대로: ' + JSON.stringify(await rules('평화로운아파트')));
  await type('waste', '후문 지정 장소, 당일 반출');
  await type('etc', '아랫집 소음 민감 — 타격 작업 전 인사');
  warned = await page.evaluate(() => { const w = document.querySelector('#modalRoot .srWarn[data-k="etc"]'); return w.hidden && getComputedStyle(w).display === 'none'; });
  assert(warned && (await rules('평화로운아파트')).etc === '아랫집 소음 민감 — 타격 작업 전 인사', '⑧ 보통 메모는 그대로 저장·경고 사라짐');
  // 현장에서 실제로 쓰는 정상 메모를 막으면 안 된다(막으면 그 칸이 통째로 저장되지 않는다)
  const noFalse = await page.evaluate(() => ['042-000-0000', '정문 옆 1층 #101호', '지하 2층 B구역', '평일 09~18시 (소음작업 10~17시)',
    '후문 지정 장소, 당일 반출, 톤백 25000*2대', '공동현관 폭 1100mm, 계단 좁음', '공동현관 보양 필수, 보양비 30000원',
    '도어락 교체 예정 (2026년)', '방문차량 등록 #1234 (관리실)', '신청서+동의서 제출, 예치금 300000원 준공 후 환급',
    '후문 지정 장소, 처리비 *30000원 별도', '정문 옆 1층, 관리실 042-486-1234', '엘리베이터 3호기 8시~18시']
    .map(v => hjLooksLikeAccessCode(v)));
  assert(noFalse.every(v => v === false), '⑧ 오탐: ' + JSON.stringify(noFalse));
  // 현장에서 실제로 쓰는 표기('도어락'이라는 말을 안 써도)를 잡는다
  const yes = await page.evaluate(() => ['도어락 1234', '공동현관 0000', '#1234', '5678*', '현관번호 8282',
    '현관 1234', '번호키 8282', '출입문 1234 누르고 들어감', '비번 0000']
    .map(v => hjLooksLikeAccessCode(v)));
  assert(yes.every(v => v === true), '⑧ 놓침: ' + JSON.stringify(yes));
  // 이미 들어 있던 값도 백업·동기화에서 빠진다(access 와 같은 약속)
  const scrub = await page.evaluate(() => {
    const q = state.projects.find(x => x.name === '평화로운아파트');
    q.siteRules.office = '정문 옆 1층, 042-000-0000';
    q.siteRules.etc = '도어락 9876';                       // 옛 자료·다른 기기에서 섞여 들어온 경우
    q.siteRules.at = '2026-09-12';
    const out = serializeData().projects.find(x => x.name === '평화로운아파트').siteRules;
    return { out, kept: q.siteRules.etc };
  });
  assert(scrub.out.etc === undefined && scrub.out.office === '정문 옆 1층, 042-000-0000' && scrub.out.at === '2026-09-12', '⑧ 백업에서 빠진다: ' + JSON.stringify(scrub.out));
  assert(scrub.kept === '도어락 9876', '⑧ 백업에서 빼는 것이지 화면 자료를 지우는 것이 아니다: ' + JSON.stringify(scrub.kept));
  const warnRole = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .srWarn')].map(w => w.getAttribute('role')));
  assert(warnRole.length === 8 && warnRole.every(r => r === 'alert'), '⑧ 경고는 읽어 주는 자리다: ' + JSON.stringify(warnRole));
  await page.evaluate(() => { delete state.projects.find(x => x.name === '평화로운아파트').siteRules.etc; });

  // ⑨ 보관 현장도 열린다
  await page.evaluate(() => { state.projects.find(x => x.name === '유성빌라').archived = true; siteRulesView(); });
  opts = await page.evaluate(() => [...document.querySelectorAll('#srProj option')].map(o => o.textContent));
  assert(opts.some(o => /유성빌라 「보관」/.test(o)), '⑨ 보관 현장이 목록에: ' + JSON.stringify(opts));
  assert(opts.findIndex(o => /「보관」/.test(o)) === opts.length - 1, '⑨ 보관 현장은 뒤쪽에: ' + JSON.stringify(opts));
  await page.selectOption('#srProj', '유성빌라');
  assert(/현장 부대사항 — 유성빌라/.test(await modalText()), '⑨ 보관 현장이 열린다');
  await type('park', '지상 방문차 30분');
  assert((await rules('유성빌라')).park === '지상 방문차 30분', '⑨ 보관 현장에도 적을 수 있다');
  // 없는 현장이면 조용히 딴 현장을 열지 않고 알려 준다
  await page.evaluate(() => { window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(m); return o(m); }; siteRulesView('없는현장'); });
  const told = await page.evaluate(() => window.__toasts.join('|'));
  assert(/없는현장.*찾지 못해/.test(told), '⑨ 못 찾으면 알려 준다: ' + told);
  await page.evaluate(() => { state.projects.find(x => x.name === '유성빌라').archived = false; });

  // ⑩ 자료를 새로 불러와도 입력이 사라지지 않는다
  const afterReload = await page.evaluate(() => {
    siteRulesView('평화로운아파트');
    const snap = JSON.parse(JSON.stringify(serializeData()));
    applyData(snap);                                        // state.projects 가 통째로 새 객체로 바뀐다
    const el = document.querySelector('#modalRoot .srIn[data-k="carry"]');
    el.value = '후문 화물 엘리베이터';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return (state.projects.find(x => x.name === '평화로운아파트').siteRules || {}).carry;
  });
  assert(afterReload === '후문 화물 엘리베이터', '⑩ 새 현장 객체에 들어간다: ' + afterReload);

  // ⑪ 열기만 해서는 아무것도 쓰지 않는다
  const untouched = await page.evaluate(() => {
    state.projects.push({ name: '새현장', stage: 0, received: 0, phases: [], cost: {} });
    state.dirty = false;
    siteRulesView('새현장');
    const q = state.projects.find(x => x.name === '새현장');
    return { has: Object.prototype.hasOwnProperty.call(q, 'siteRules'), dirty: state.dirty };
  });
  assert(untouched.has === false && untouched.dirty === false, '⑪ 열기만 하면 그대로: ' + JSON.stringify(untouched));

  // ⑫ 복사가 조용히 실패하지 않는다 — clipboard 가 없으면 폴백이 받는다
  const fellBack = await page.evaluate(() => {
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(m); return o(m); };
    const saved = navigator.clipboard;
    try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) {}
    let used = false; const oe = document.execCommand; document.execCommand = c => { used = true; return true; };
    siteRulesView('평화로운아파트');
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /복사/.test(b.textContent)).click();
    document.execCommand = oe; if (saved) try { Object.defineProperty(navigator, 'clipboard', { value: saved, configurable: true }); } catch (e) {}
    return { used, toasts: window.__toasts.join('|') };
  });
  assert(fellBack.used && /복사했습니다/.test(fellBack.toasts), '⑫ 복사 폴백: ' + JSON.stringify(fellBack));
  // 공유가 거부되면 복사로 이어진다(사용자 취소는 조용히)
  const shareFail = await page.evaluate(async () => {
    window.__toasts = []; const o = window.toast; window.toast = m => { window.__toasts.push(m); return o(m); };
    window.__copied = ''; navigator.clipboard = { writeText: t => { window.__copied = t; return Promise.resolve(); } };
    navigator.share = () => Promise.reject(new Error('not allowed'));
    siteRulesView('평화로운아파트');
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /공유/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 60));
    const failed = { copied: window.__copied, toasts: window.__toasts.join('|') };
    window.__toasts = []; window.__copied = '';
    navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /공유/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 60));
    return { failed, aborted: { copied: window.__copied, toasts: window.__toasts.join('|') } };
  });
  assert(/출입·작업 시간/.test(shareFail.failed.copied) && /공유가 안 돼 복사했습니다/.test(shareFail.failed.toasts), '⑫ 공유 실패→복사: ' + JSON.stringify(shareFail.failed));
  assert(shareFail.aborted.copied === '' && shareFail.aborted.toasts === '', '⑫ 사용자 취소는 조용히: ' + JSON.stringify(shareFail.aborted));

  // ⑬ 「선택 복원」이 부대사항을 되살린다
  const restored = await page.evaluate(async () => {
    const bp = { name: '복원현장', stage: 1, received: 0, phases: [], cost: {},
                 siteRules: { hours: '평일만', waste: '후문' }, customer: { name: '홍길동', phone: '', addr: '' } };
    window.__backups = [{ name: '백업_20260912.json', data: { projects: [bp], files: [] } }];
    restoreSelect(0);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const q = (state.projects || []).find(x => x.name === '복원현장');
    return q ? { rules: q.siteRules, cust: (q.customer || {}).name, arch: q.archived } : null;
  });
  assert(restored && restored.rules && restored.rules.hours === '평일만' && restored.rules.waste === '후문' && restored.cust === '홍길동',
    '⑬ 선택 복원이 부대사항·고객을 되살린다: ' + JSON.stringify(restored));
  assert(restored.arch === undefined, '⑬ 보관 여부는 백업 시점으로 되돌리지 않는다: ' + JSON.stringify(restored));
  // 준공 후 보관해 둔 현장에 옛 백업을 덮어써도 보관이 풀리면 안 된다(대시보드에 다시 뜬다)
  const keptArchive = await page.evaluate(async () => {
    const q = state.projects.find(x => x.name === '복원현장');
    q.archived = true; q.siteRules = { hours: '지금 값' };
    window.__backups = [{ name: '백업_20260905.json', data: { projects: [{ name: '복원현장', stage: 1, received: 0, phases: [], cost: {},
      archived: false, siteRules: { hours: '백업 값', park: '지하' } }], files: [] } }];
    restoreSelect(0);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /선택 복원/.test(b.textContent)).click();
    await new Promise(r => setTimeout(r, 400));
    const z = state.projects.find(x => x.name === '복원현장');
    return { arch: z.archived, rules: z.siteRules };
  });
  assert(keptArchive.arch === true, '⑬ 보관이 풀리면 안 된다: ' + JSON.stringify(keptArchive));
  assert(keptArchive.rules && keptArchive.rules.hours === '백업 값' && keptArchive.rules.park === '지하', '⑬ 규칙은 백업 값으로: ' + JSON.stringify(keptArchive.rules));

  // ⑭ 키보드가 올라온 높이에서 입력칸이 버튼 바에 가리지 않는다
  await page.setViewportSize({ width: 390, height: 420 });
  await page.evaluate(() => siteRulesView('평화로운아파트'));
  const covered = await page.evaluate(async () => {
    const out = [];
    for (const k of ['park', 'waste', 'etc']) {
      const el = document.querySelector('#modalRoot .srIn[data-k="' + k + '"]');
      el.focus(); el.scrollIntoView({ block: 'nearest' });
      await new Promise(r => setTimeout(r, 30));
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.push({ k, tag: hit ? hit.tagName + '.' + (hit.className || '') : 'none' });
    }
    return out;
  });
  assert(covered.every(c => /INPUT/.test(c.tag)), '⑭ 버튼 바가 입력칸을 덮는다: ' + JSON.stringify(covered));
  const taps = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .mfoot button'), document.querySelector('#modalRoot .modal-close')]
    .map(b => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height) * 10) / 10; }));
  assert(taps.every(v => v >= 43.5), '⑭ 44px 아래인 버튼: ' + JSON.stringify(taps));
  await page.setViewportSize({ width: 390, height: 844 });
  // 제목은 이름 그대로(이중 escape 없음)
  const titled = await page.evaluate(() => {
    state.projects.push({ name: '유성빌라 A&B 동', stage: 0, received: 0, phases: [], cost: {} });
    siteRulesView('유성빌라 A&B 동');
    return document.querySelector('#modalTitle').textContent;
  });
  assert(/유성빌라 A&B 동/.test(titled) && !/&amp;/.test(titled), '⑭ 제목 이중 escape: ' + titled);

  // ⑮ 현장을 바꿔도 포커스가 남는다
  await page.evaluate(() => siteRulesView('평화로운아파트'));
  await page.evaluate(() => document.querySelector('#srProj').focus());
  await page.selectOption('#srProj', '유성빌라');
  let focusOk = true;
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'srProj', null, { timeout: 3000 })
    .catch(() => { focusOk = false; });
  assert(focusOk, '⑮ 현장을 바꾸면 포커스가 날아간다: ' + await page.evaluate(() => (document.activeElement || {}).tagName + '.' + ((document.activeElement || {}).className || '')));
  // 글자마다 안내 문장까지 다시 읽지 않는다 — live 영역은 개수만
  const live = await page.evaluate(async () => {
    siteRulesView('평화로운아파트');
    const sum = document.querySelector('#srSum'), cnt = document.querySelector('#srCount');
    const liveNode = cnt && cnt.getAttribute('aria-live') === 'polite';
    const outerLive = sum.getAttribute('aria-live');
    let n = 0; const mo = new MutationObserver(ms => { n += ms.length; });
    mo.observe(sum, { childList: true, subtree: true, characterData: true });
    const el = document.querySelector('#modalRoot .srIn[data-k="park"]');
    for (const v of ['지', '지하', '지하2', '지하2층']) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 50)); mo.disconnect();
    return { liveNode, outerLive, muts: n, text: cnt.textContent };
  });
  assert(live.liveNode && live.outerLive === null, '⑮ 개수만 읽어 준다: ' + JSON.stringify(live));
  assert(live.muts <= 1 && /적어 둔 규칙/.test(live.text), '⑮ 글자마다 다시 읽는다: ' + JSON.stringify(live));
  // 테두리 색이 글과 같이 간다
  const border = await page.evaluate(async () => {
    state.projects.push({ name: '빈현장', stage: 0, received: 0, phases: [], cost: {} });
    siteRulesView('빈현장');
    const sum = () => getComputedStyle(document.querySelector('#srSum')).borderColor;
    const before = sum();
    const el = document.querySelector('#modalRoot .srIn[data-k="hours"]');
    el.value = '평일만'; el.dispatchEvent(new Event('input', { bubbles: true }));
    const after = sum();
    el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
    return { before, after, cleared: sum() };
  });
  assert(border.before !== border.after && border.cleared === border.before, '⑮ 테두리 색: ' + JSON.stringify(border));

  // ⑯ 시공 당일 아침에 보인다 — 더보기 안에만 있으면 이 기능이 풀려던 문제를 못 푼다
  const atStart = await page.evaluate(() => {
    const p = state.projects.find(x => x.name === '평화로운아파트');
    stageChecklistView('평화로운아파트', 2);
    const box = document.querySelector('#modalRoot .hjSiteOpen');
    return { has: !!box, label: box ? box.textContent : '', n: hjSiteFilled(p.siteRules),
             text: (document.querySelector('#modalRoot') || {}).textContent || '' };
  });
  assert(atStart.has && /이 현장 규칙 \d+개/.test(atStart.text) && atStart.label === '보기', '⑯ 착공 전 체크에 보인다: ' + JSON.stringify({ has: atStart.has, label: atStart.label }));
  await page.click('#modalRoot .hjSiteOpen');
  assert(/현장 부대사항 — 평화로운아파트/.test(await modalText()), '⑯ 착공 전 체크에서 바로 열린다');
  // 규칙이 없는 현장에서는 '적기' 로 부른다
  const empty2 = await page.evaluate(() => {
    state.projects.push({ name: '규칙없는현장', stage: 1, received: 0, phases: [], cost: {} });
    stageChecklistView('규칙없는현장', 2);
    const box = document.querySelector('#modalRoot .hjSiteOpen');
    return { label: box ? box.textContent : '', text: (document.querySelector('#modalRoot') || {}).textContent || '' };
  });
  assert(empty2.label === '적기' && /적어 둔 현장 규칙이 없습니다/.test(empty2.text), '⑯ 비어 있으면 적으라고 한다: ' + JSON.stringify(empty2.label));
  // 출발 전 챙김에서도
  const atPrep = await page.evaluate(() => {
    state.schedule = [{ id: 'sr1', date: localDate(), time: '09:00', title: '욕실 타일 시공', project: '평화로운아파트' }];
    prepCheck('sr1');
    const box = document.querySelector('#modalRoot .hjSiteOpen');
    return { has: !!box, p: box ? box.dataset.p : '' };
  });
  assert(atPrep.has && atPrep.p === '평화로운아파트', '⑯ 출발 전 챙김에 보인다: ' + JSON.stringify(atPrep));
  await page.click('#modalRoot .hjSiteOpen');
  assert(/현장 부대사항 — 평화로운아파트/.test(await modalText()), '⑯ 출발 전 챙김에서 바로 열린다');

  // ⑰ 실제 키보드로 한 글자씩 — 네 자리를 다 치기 전 앞자리가 남으면 안 된다
  const typed = await page.evaluate(() => {
    state.projects = [{ name: '타자현장', stage: 1, received: 0, phases: [], cost: {} }];
    state.activeProject = '타자현장'; state.dirty = false;
    siteRulesView('타자현장');
    return true;
  });
  assert(typed);
  await page.click('#modalRoot .srIn[data-k="etc"]');
  await page.keyboard.type('도어락 9876', { delay: 5 });
  let after = await rules('타자현장');
  // 숫자는 한 자리도 남으면 안 된다(네 자리를 다 치기 전 앞자리가 남으면 경우의 수가 열 가지로 줄어든다)
  assert(!/[0-9]/.test(String((after || {}).etc || '')), '⑰ 번호 앞자리도 남지 않는다: ' + JSON.stringify(after));
  const backup = await page.evaluate(() => JSON.stringify(serializeData().projects[0].siteRules || {}));
  assert(!/9|8|7|6/.test(backup.replace(/2026-\d\d-\d\d/g, '')), '⑰ 백업에도 없다: ' + backup);
  const copyOut = await page.evaluate(() => hjSiteText('타자현장', (state.projects[0].siteRules) || {}));
  assert(!/987|9876/.test(copyOut), '⑰ 복사 글에도 없다: ' + copyOut);
  // 처음부터 번호만 치면 아무것도 만들지 않는다
  const onlyNum = await page.evaluate(async () => {
    state.projects.push({ name: '번호만현장', stage: 0, received: 0, phases: [], cost: {} });
    state.dirty = false;
    siteRulesView('번호만현장');
    const el = document.querySelector('#modalRoot .srIn[data-k="etc"]');
    for (const v of ['1', '12', '123', '1234']) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    const p = state.projects.find(x => x.name === '번호만현장');
    return { has: Object.prototype.hasOwnProperty.call(p, 'siteRules'), dirty: state.dirty };
  });
  assert(onlyNum.has === false && onlyNum.dirty === false, '⑰ 막힌 입력은 빈 규칙 객체도 저장 대기도 만들지 않는다: ' + JSON.stringify(onlyNum));
  await page.evaluate(() => { state.projects = state.projects.filter(p => p.name !== '번호만현장'); siteRulesView('타자현장'); });
  // 단위를 붙이면 그대로 저장된다
  await page.fill('#modalRoot .srIn[data-k="etc"]', '');
  await page.click('#modalRoot .srIn[data-k="park"]');
  await page.keyboard.type('지하 2층 B구역', { delay: 5 });
  assert((await rules('타자현장')).park === '지하 2층 B구역', '⑰ 단위가 붙은 숫자는 그대로: ' + JSON.stringify(await rules('타자현장')));

  // ⑱ 낱말·단위를 하나씩 따로 확인한다
  const words = await page.evaluate(() => ({
    yes: ['비밀번호 1234', '비번 12', '도어락 9', '도어록 98', '도어키 4321', '번호키 8282', '마스터키 7', '공동현관 0000', '현관 1234', '출입 5678', '1234', '#12', '5678*'].map(v => [v, hjLooksLikeAccessCode(v)]),
    no: ['현관 1층', '공동현관 폭 1100mm', '보양비 30000원', '출입 2명', '현관 앞 3m', '엘리베이터 3호기', '2026년 준공', '톤백 25000*2대', '042-486-1234', '도어락 교체 예정 (2026년)', '방문차량 등록 #1234 (관리실)'].map(v => [v, hjLooksLikeAccessCode(v)])
  }));
  assert(words.yes.every(x => x[1] === true), '⑱ 막아야 하는데 통과: ' + JSON.stringify(words.yes.filter(x => !x[1])));
  assert(words.no.every(x => x[1] === false), '⑱ 정상 메모를 막는다: ' + JSON.stringify(words.no.filter(x => x[1])));

  // ⑲ 칸마다 확인일 — 다른 칸을 고쳐도 옛 날짜가 살아 있다
  const dated = await page.evaluate(async () => {
    const p = state.projects[0];
    p.siteRules = { hours: '평일 09~18시', park: '지하 2층', at: '2026-03-01', atMap: { hours: '2026-03-01', park: '2026-03-01' } };
    siteRulesView('타자현장');
    const el = document.querySelector('#modalRoot .srIn[data-k="waste"]');
    el.value = '만물 자가 반출'; el.dispatchEvent(new Event('input', { bubbles: true }));
    const r = state.projects[0].siteRules;
    return { map: r.atMap, text: hjSiteText('타자현장', r), today: localDate() };
  });
  assert(dated.map.hours === '2026-03-01' && dated.map.park === '2026-03-01' && dated.map.waste === dated.today,
    '⑲ 고친 칸만 오늘로: ' + JSON.stringify(dated.map));
  assert(dated.text.indexOf('· 출입·작업 시간: 평일 09~18시 (2026-03-01 확인)') > 0, '⑲ 줄마다 언제 들은 것인지: ' + dated.text);
  assert(dated.text.indexOf('※ 2026-03-01~' + dated.today + ' 현장에서') > 0, '⑲ 기간으로 밝힌다: ' + dated.text);

  // ⑳ 자료 교체 뒤에도 새 객체를 읽고, 나가는 글에 번호가 섞이지 않는다
  const fresh = await page.evaluate(() => {
    window.__copied = ''; navigator.clipboard = { writeText: t => { window.__copied = t; return Promise.resolve(); } };
    siteRulesView('타자현장');
    const snap = JSON.parse(JSON.stringify(serializeData()));
    snap.projects[0].siteRules.park = '지상 방문차 30분';
    snap.projects[0].siteRules.etc = '도어락 9876';        // 옛 자료·다른 기기에서 섞여 들어온 번호
    applyData(snap);
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /복사/.test(b.textContent)).click();
    return window.__copied;
  });
  await page.waitForFunction(() => !!window.__copied);
  const copied2 = await page.evaluate(() => window.__copied);
  assert(/지상 방문차 30분/.test(copied2), '⑳ 자료를 바꾸면 새 객체를 읽는다: ' + copied2);
  assert(!/9876/.test(copied2), '⑳ 나가는 글에 번호가 섞이지 않는다: ' + copied2);
  // 복원을 거치지 않고 화면 자료에 직접 섞여 있는 번호도 나가는 글에는 들어가면 안 된다
  const direct = await page.evaluate(() => {
    // 복원을 거치지 않고 화면 자료에 그대로 들어 있는 경우를 따로 세운다
    state.projects = [{ name: '섞인현장', stage: 1, received: 0, phases: [], cost: {},
      siteRules: { park: '지상 방문차 30분', etc: '도어락 9876', atMap: { park: '2026-03-01' } } }];
    state.activeProject = '섞인현장';
    window.__copied = '';
    siteRulesView('섞인현장');
    const has = !!(state.projects[0].siteRules || {}).etc;
    [...document.querySelectorAll('#modalRoot .mfoot button')].find(b => /복사/.test(b.textContent)).click();
    return has;
  });
  const copied3 = await page.evaluate(() => hjSiteText('섞인현장', state.projects[0].siteRules));
  assert(direct && !/9876|987/.test(copied3), '⑳ 화면 자료에 남아 있어도 나가는 글에는 안 넣는다: ' + copied3);
  assert(/지상 방문차 30분/.test(copied3), '⑳ 나머지 줄은 그대로: ' + copied3);
  assert((await page.evaluate(() => state.projects[0].siteRules.etc)) === '도어락 9876', '⑳ 화면 자료를 지우는 것은 아니다');

  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));
  console.log('site-rules.e2e OK (① 메뉴·빈 현장 ② 현장에 저장·개수 ③ 왕복·출입정보 구분 ④ 복사 글 ⑤ 공유 ⑥ 현장 전환 ⑦ 비밀번호 칸 없음 ⑧ 출입번호 차단 ⑨ 보관 현장 ⑩ 자료 교체 ⑪ 읽기는 읽기만 ⑫ 폴백 ⑬ 선택 복원 ⑭ 키보드·44px·제목 ⑮ 포커스·낭독·테두리 ⑯ 착공 전·출발 전 진입점 ⑰ 한 글자씩 ⑱ 낱말·단위 ⑲ 칸별 확인일 ⑳ 교체·유출)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

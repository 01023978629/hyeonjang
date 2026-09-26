/* as-record.e2e.js — 🔧 AS 기록이 1년 뒤 분쟁에서 쓸모 있게 (Playwright)

   2026-09-26: AS 레코드는 {id,project,date,text,status} 뿐이라 '완료' 로 바꿔도 무엇을 어떻게 고쳤는지·돈을 받았는지·
   어느 공종 보증으로 봤는지가 남지 않았다. 접수 현장 목록·보증 목록은 보관 현장을 빼서, 끝나 보관한 현장(= AS 가
   들어오는 현장)을 고를 수 없었다. 지키는 것:
     ① 접수 현장 목록·AS 화면 보증 목록·🛡 보증 관리에 보관 현장이 「보관」 표시로 들어간다 — 보관 현장으로 접수된다.
        알림(warrantyDue)은 예전대로 보관 현장을 뺀다(파수꾼·Watchdog 과 같은 모집단)
     ② 처리 내용·유상 금액(비우면 무상)은 제자리에서 저장되고 요약 줄이 바로 바뀐다(실제 키보드 입력)
     ③ 공종 = 그 현장 보증 항목 — 접수일 기준 '보증 기간 안/밖 (만료 YYYY-MM-DD)'
     ④ 방문일 — 넣으면 일정에 올릴지 묻고(승낙 → 일정 1건, 거절 → 0건), 다시 바꾸면 그 일정을 옮긴다(두 건이 되지 않는다)
     ⑤ 사진 — 안정 참조(hjFileRef)로 저장, 파일 id 가 바뀌어도 따라가고, 옛 id 는 조용히 고쳐 적고,
        없어진 사진은 '사진을 찾을 수 없음' 으로 알리되 지우지 않는다. ✕ 로 빼면 빠진다
     ⑥ 고객 안내 문자 — 문자 센터의 msgTemplate('as') 문안 그대로 공유/복사, 발송 함수는 안 부른다
     ⑦ 엑셀 열 — 방문일·처리내용·유상금액·공종·보증 판정. 공사 스토리·파일철 AS 줄에 처리 내용(스토리엔 금액 없음)
     ⑧ 현장 카드 — 요약 줄 + ✏️ 가 그 기록을 펼친 AS 화면을 연다(클릭 위임)
     ⑨ 옛 레코드(새 필드 없음)도 그대로 보인다, 저장 왕복 뒤 필드 유지·최상위 키 불변, 폰 44px·16px·가로 넘침 0, pageerror 0

   전제: tests/static-server.js(8299) 실행 중 */
'use strict';
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
catch (_) { ({ chromium } = require('playwright')); }
const APP = 'http://127.0.0.1:8299/index.html';
const assert = (v, m) => { if (!v) throw new Error(m); };
let browser;

const LIVE = '가상AS현장 101동 1001호';
const ARC = '가상보관현장';
const DIR = '가상/현장사진/';

(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE || (process.platform !== 'win32' ? '/opt/pw-browsers/chromium' : undefined) });
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let dialogAnswer = true; const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); if (d.type() === 'confirm' && !dialogAnswer) d.dismiss(); else d.accept(); });
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hj_onboard_done', '1'); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hjRestoreDone && window.__hjRelayBootDone && typeof window.asManage === 'function');
  await page.evaluate(async () => {
    await Promise.all([window.__hjRestoreDone, window.__hjRelayBootDone]);
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => false; backupBootCheck = () => {}; kakaoCheckNew = () => {};
    window.__toasts = []; const o = window.toast; window.toast = (m) => { window.__toasts.push(String(m)); return o(m); };
    window.__sms = []; hjSendSms = (ph, b) => { window.__sms.push(b); };
  });
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const rec = (id) => page.evaluate((id) => JSON.parse(JSON.stringify(state.asLog.find(x => x.id === id) || null)), id);

  await page.evaluate(({ LIVE, ARC, DIR }) => {
    state.projects = [
      { name: LIVE, stage: 3, doneAt: '2025-03-01', phases: [], cost: {}, customer: { name: '김가상', phone: '010-0000-1234' } },
      { name: ARC, stage: 3, doneAt: '2025-10-20', archived: true, phases: [], cost: {}, customer: { name: '이가상', phone: '010-0000-5678' } },
      { name: '가상진행현장', stage: 1, phases: [], cost: {} },
    ];
    state.files = [
      { id: 'f1', kind: 'photo', name: '가상_누수.jpg', prefix: DIR, ext: 'jpg', size: 1111, project: LIVE, when: new Date('2026-09-20') },
      { id: 'f2', kind: 'photo', name: '가상_보수후.jpg', prefix: DIR, ext: 'jpg', size: 2222, project: LIVE, when: new Date('2026-09-21') },
      { id: 'f3', kind: 'photo', name: '가상_남의사진.jpg', prefix: DIR, ext: 'jpg', size: 3333, project: '가상진행현장', when: new Date('2026-09-21') },
    ];
    state.asLog = [
      // 옛 레코드 — 새 필드 없음
      { id: 'as-old', project: ARC, date: '2026-08-01', text: '욕실 줄눈 들뜸', status: 'open' },
      { id: 'as-new', project: LIVE, date: '2026-09-20', text: '안방 천장 물자국', status: 'open' },
      { id: 'as-3', project: LIVE, date: '2026-09-22', text: '현관 몰딩 벌어짐', status: 'open' },
    ];
    state.schedule = []; state.activeProject = LIVE; state.dirty = false;
  }, { LIVE, ARC, DIR });

  // ① 보관 현장 — 접수 목록·보증 목록
  await page.evaluate(() => asManage());
  const opts = await page.$$eval('#asmProj option', os => os.map(o => ({ v: o.value, t: o.textContent, s: o.selected })));
  const arcOpt = opts.find(o => o.v === ARC);
  assert(arcOpt && /보관/.test(arcOpt.t), '① 접수 현장 목록에 보관 현장이 「보관」 표시로 있다: ' + JSON.stringify(opts));
  assert(opts.findIndex(o => o.v === ARC) > opts.findIndex(o => o.v === '가상진행현장'), '① 보관 현장은 진행 현장 뒤에');
  assert((opts.find(o => o.s) || {}).v === LIVE, '① 기본 선택은 지금 보는 현장');
  const warrRows = await page.$$eval('#modalRoot .asmWarr', rs => rs.map(r => r.textContent));
  assert(warrRows.some(t => t.includes(ARC) && /보관/.test(t)), '① AS 화면 보증 목록에 보관 현장이 「보관」 표시로: ' + JSON.stringify(warrRows));
  // ⑨ 옛 레코드가 그대로 보인다 — 요약 줄은 비어 있다(지어낸 '무상' 없음)
  const oldCard = await page.evaluate(() => { const r = [...document.querySelectorAll('#modalRoot .asmRec')].find(x => x.dataset.id === 'as-old'); return r ? { t: r.textContent, sum: r.querySelector('.asmSum').textContent, arc: !!r.querySelector('.asmArc') } : null; });
  assert(oldCard && oldCard.t.includes('욕실 줄눈 들뜸') && oldCard.sum === '' && oldCard.arc, '⑨ 옛 레코드가 그대로(요약 없음·보관 표시): ' + JSON.stringify(oldCard));
  await page.selectOption('#asmProj', ARC);
  await page.fill('#asmText', '베란다 창 실리콘');
  await page.click('#asmAdd');
  const added = await page.evaluate(() => state.asLog.find(x => x.text === '베란다 창 실리콘'));
  assert(added && added.project === ARC, '① 보관 현장으로 접수된다: ' + JSON.stringify(added));
  const wl = await page.evaluate(() => ({ all: warrantyList(true).map(w => w.name + (w.archived ? '*' : '')), def: warrantyList().map(w => w.name), due: warrantyDue().map(w => w.name) }));
  assert(wl.all.includes(ARC + '*') && !wl.def.includes(ARC) && !wl.due.includes(ARC), '① warrantyList(true) 만 보관 포함, 알림은 그대로: ' + JSON.stringify(wl));
  await page.evaluate(() => warrantyManage());
  const wm = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .wtArc')].map(x => x.closest('div').textContent));
  assert(wm.some(t => t.includes(ARC)), '① 🛡 보증 관리에 보관 현장이 「보관」 표시로: ' + JSON.stringify(wm));

  // ② 처리 내용·유상 금액 — 실제 키보드
  await page.evaluate(() => asManage('as-new'));
  const sel = (k, id) => `#modalRoot .asmF[data-k="${k}"][data-id="${id}"]`;
  assert(await page.evaluate(() => [...document.querySelectorAll('#modalRoot .asmMore')].find(d => d.dataset.id === 'as-new').open), '② asManage(id) 가 그 기록을 펼쳐 연다');
  await page.click(sel('fix', 'as-new'));
  await page.keyboard.type('욕실 방수층 보수');
  await page.click(sel('fee', 'as-new'));
  await page.keyboard.type('50,000');
  let r = await rec('as-new');
  assert(r.fix === '욕실 방수층 보수' && r.fee === 50000, '② 처리 내용·유상 금액 저장: ' + JSON.stringify(r));
  const sumNow = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .asmSum')].find(x => x.dataset.id === 'as-new').textContent);
  assert(/처리: 욕실 방수층 보수/.test(await sumNow()) && /유상 50,000원/.test(await sumNow()), '② 요약 줄이 바로 바뀐다: ' + await sumNow());
  assert(await page.evaluate(() => document.activeElement && document.activeElement.dataset.k === 'fee'), '② 치는 동안 칸 초점이 유지된다(다시 그리지 않는다)');
  await page.fill(sel('fee', 'as-new'), '');
  r = await rec('as-new');
  assert(r.fee === '' && /무상/.test(await sumNow()) && !/유상/.test(await sumNow()), '② 금액을 비우면 무상: ' + await sumNow());

  // ③ 공종 = 보증 항목 → 접수일(2026-09-20) 기준 판정
  const wopts = await page.$$eval(sel('warrantyItem', 'as-new') + ' option', os => os.map(o => o.value));
  assert(wopts.includes('방수') && wopts.includes('마감(도배·바닥·타일)'), '③ 공종 칸이 그 현장 보증 항목: ' + JSON.stringify(wopts));
  await page.selectOption(sel('warrantyItem', 'as-new'), '방수');
  const verdict = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .asmVerdict')].find(x => x.dataset.id === 'as-new').textContent);
  assert(/보증 기간 안 \(만료 2028-03-01\)/.test(await verdict()), '③ 방수 3년 안: ' + await verdict());
  assert((await rec('as-new')).warrantyItem === '방수', '③ 공종 저장');
  await page.selectOption(sel('warrantyItem', 'as-new'), '마감(도배·바닥·타일)');
  assert(/보증 기간 밖 \(만료 2026-03-01\)/.test(await verdict()), '③ 마감 1년 밖: ' + await verdict());
  // 기준일은 오늘이 아니라 접수일 — 만료 전에 접수된 하자는 방문·기록이 만료 뒤여도 '안'. 만료일 당일 접수도 '안'.
  const byDate = await page.evaluate(() => ['2026-02-20', '2026-03-01', '2026-03-02'].map(d => hjAsWarrantyVerdict({ date: d, warrantyItem: '마감(도배·바닥·타일)' }, state.projects[0]).text));
  assert(JSON.stringify(byDate) === JSON.stringify(['보증 기간 안 (만료 2026-03-01)', '보증 기간 안 (만료 2026-03-01)', '보증 기간 밖 (만료 2026-03-01)']), '③ 접수일 기준·만료일 당일 포함: ' + JSON.stringify(byDate));
  // 보증 항목에서 빠진 공종을 적어 둔 옛 기록 — 판정을 지어내지 않는다
  const unk = await page.evaluate(() => hjAsWarrantyVerdict({ date: '2026-09-20', warrantyItem: '가상공종' }, state.projects[0]));
  assert(unk && unk.unknown && !/안|밖/.test(unk.text.replace('안내', '')), '③ 모르는 공종은 판정하지 않는다: ' + JSON.stringify(unk));

  // ④ 방문일 → 일정
  dialogs.length = 0; dialogAnswer = true;
  await page.fill(sel('visitAt', 'as-new'), '2026-09-30');
  await page.waitForFunction(() => (state.schedule || []).length === 1);
  let sch = await page.evaluate(() => JSON.parse(JSON.stringify(state.schedule)));
  r = await rec('as-new');
  assert(dialogs.some(m => /일정/.test(m)), '④ 일정에 올릴지 묻는다');
  assert(sch[0].date === '2026-09-30' && sch[0].project === LIVE && r.visitAt === '2026-09-30' && r.visitSchedId === sch[0].id && !(sch[0].hours > 0), '④ 승낙 → 방문 일정 1건: ' + JSON.stringify({ sch, r }));
  await page.fill(sel('visitAt', 'as-new'), '2026-10-02');
  await page.waitForFunction(() => state.schedule[0].date === '2026-10-02');
  assert(await page.evaluate(() => state.schedule.length) === 1, '④ 다시 바꾸면 그 일정을 옮긴다(두 건이 되지 않는다)');
  dialogAnswer = false;
  await page.click('#modalRoot .asmMore[data-id="as-3"] summary');   // 펼친 상태는 다시 그려도 유지된다(as-new 도 열린 채)
  await page.fill(sel('visitAt', 'as-3'), '2026-10-05');
  await page.waitForFunction(() => (state.asLog.find(x => x.id === 'as-3') || {}).visitAt === '2026-10-05');
  assert(await page.evaluate(() => state.schedule.length) === 1 && !(await rec('as-3')).visitSchedId, '④ 거절 → 방문일만 적고 일정은 안 늘어난다');
  dialogAnswer = true;

  // ⑤ 사진 — 안정 참조
  // 뒤처진 탭에서는 고쳐 적기(heal)가 멈춘다 — 그래서 고를 때부터 안정 참조로 적어야 한다(다시 그릴 때 고쳐질 거라 믿지 않는다)
  await page.evaluate(() => { __tabStale = true; });
  await page.selectOption('#modalRoot .asmPhAdd[data-id="as-new"]', 'f1');
  await page.evaluate(() => { __tabStale = false; });
  r = await rec('as-new');
  assert(JSON.stringify(r.photos) === JSON.stringify(['k:' + DIR + '가상_누수.jpg|1111']), '⑤ 안정 참조로 저장: ' + JSON.stringify(r.photos));
  const addable = await page.$$eval('#modalRoot .asmPhAdd[data-id="as-new"] option', os => os.map(o => o.value));
  assert(!addable.includes('f3') && !addable.includes('f1') && addable.includes('f2'), '⑤ 고를 수 있는 사진은 그 현장의, 아직 안 붙인 것만: ' + JSON.stringify(addable));
  // 부팅·복원처럼 파일 id 가 새로 붙어도 따라간다
  await page.evaluate(() => { state.files.forEach(f => { f.id = 'n-' + f.id; }); asManage(); });
  let chips = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .asmRec')].find(x => x.dataset.id === 'as-new').textContent);
  assert(chips.includes('가상_누수.jpg') && !/찾을 수 없음/.test(chips), '⑤ id 가 바뀌어도 사진이 이어진다');
  // 옛 id 로 적힌 기록은 조용히 지금 형식으로
  await page.evaluate(() => { state.asLog.find(x => x.id === 'as-3').photos = ['n-f2']; asManage(); });
  assert(JSON.stringify((await rec('as-3')).photos) === JSON.stringify(['k:' + DIR + '가상_보수후.jpg|2222']), '⑤ 옛 id 를 안정 참조로 고쳐 적는다: ' + JSON.stringify((await rec('as-3')).photos));
  // 없어진 사진 — 알리되 지우지 않는다(옛 id 를 고쳐 적는 김에 같이 지워지지 않게 한 기록에 둘 다)
  await page.evaluate(() => { state.asLog.find(x => x.id === 'as-3').photos = ['n-f2', 'k:가상/없는사진.jpg|9']; asManage(); });
  const miss = await page.evaluate(() => [...document.querySelectorAll('#modalRoot .asmRec')].find(x => x.dataset.id === 'as-3').textContent);
  assert(/사진을 찾을 수 없음 1장/.test(miss) && JSON.stringify((await rec('as-3')).photos) === JSON.stringify(['k:' + DIR + '가상_보수후.jpg|2222', 'k:가상/없는사진.jpg|9']), '⑤ 없어진 사진은 알리고 목록에서 지우지 않는다: ' + JSON.stringify((await rec('as-3')).photos));
  // 이름·크기 짐작은 그 현장 사진 안에서만 — 딴 현장의 같은 이름·크기 사진으로 바꿔 적지 않는다
  await page.evaluate(() => { state.asLog.find(x => x.id === 'as-3').photos = ['k:옮긴폴더/가상_남의사진.jpg|3333']; asManage(); });
  assert(JSON.stringify((await rec('as-3')).photos) === JSON.stringify(['k:옮긴폴더/가상_남의사진.jpg|3333']), '⑤ 딴 현장 사진으로 짐작하지 않는다: ' + JSON.stringify((await rec('as-3')).photos));
  await page.evaluate(() => { const r = [...document.querySelectorAll('#modalRoot .asmRec')].find(x => x.dataset.id === 'as-new'); r.querySelector('details').open = true; });
  await page.click('#modalRoot .asmRec[data-id="as-new"] .asmPhDel');
  assert(!(await rec('as-new')).photos, '⑤ ✕ 로 빼면 빠진다: ' + JSON.stringify(await rec('as-new')));

  // ⑥ 고객 안내 문자 — 공유 창, 없으면 복사. 문안은 msgTemplate('as') 그대로, 발송 없음
  await page.evaluate(() => { window.__shared = []; Object.defineProperty(navigator, 'share', { value: (d) => { window.__shared.push(d.text); return Promise.resolve(); }, configurable: true }); });
  await page.evaluate(() => { const r = [...document.querySelectorAll('#modalRoot .asmRec')].find(x => x.dataset.id === 'as-new'); r.querySelector('details').open = true; });
  await page.click('#modalRoot .asmRec[data-id="as-new"] .asmMsg');
  const expectMsg = await page.evaluate((n) => msgTemplate('as', state.projects.find(p => p.name === n)), LIVE);
  const shared = await page.evaluate(() => window.__shared);
  assert(shared.length === 1 && shared[0] === expectMsg && expectMsg.includes('김가상님') && expectMsg.includes('A/S 요청 잘 접수했습니다'), '⑥ 공유 = msgTemplate(as) 문안 그대로: ' + JSON.stringify(shared));
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true }); });
  await page.click('#modalRoot .asmRec[data-id="as-new"] .asmMsg');
  await page.waitForFunction(() => window.__copied.length === 1);
  assert(await page.evaluate(() => window.__copied[0]) === expectMsg, '⑥ 공유가 없으면 같은 문안을 복사');
  assert((await page.evaluate(() => window.__sms)).length === 0, '⑥ 발송 함수는 부르지 않는다');

  // ⑦ 엑셀·공사 스토리·파일철
  await page.evaluate(() => { state.asLog.find(x => x.id === 'as-3').status = 'done'; state.asLog.find(x => x.id === 'as-new').fee = 120000; });
  const xl = await page.evaluate(async () => {
    ensureXLSX = async () => {};
    window.XLSX = { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: rows => JSON.parse(JSON.stringify(rows)), book_append_sheet: (wb, sh) => wb.s.push(sh) }, writeFile: (wb) => { window.__xl = wb.s[0]; } };
    window.__asHist = { from: '2026-01-01', to: '2026-12-31', st: '', q: '', page: 1 };
    await asHistExcel(); return window.__xl;
  });
  assert(JSON.stringify(xl[0]) === JSON.stringify(['일자', '상태', '현장', '증상/내용', '방문일', '처리내용', '유상금액', '공종', '보증 판정']), '⑦ 엑셀 머리줄: ' + JSON.stringify(xl[0]));
  const xr = id => xl.find(row => row[3] === id);
  assert(JSON.stringify(xr('안방 천장 물자국').slice(4)) === JSON.stringify(['2026-10-02', '욕실 방수층 보수', 120000, '마감(도배·바닥·타일)', '보증 기간 밖 (만료 2026-03-01)']), '⑦ 새 필드 열: ' + JSON.stringify(xr('안방 천장 물자국')));
  assert(xr('현관 몰딩 벌어짐')[6] === '무상', '⑦ 금액 없이 완료된 건은 무상: ' + JSON.stringify(xr('현관 몰딩 벌어짐')));
  assert(JSON.stringify(xr('욕실 줄눈 들뜸').slice(4)) === JSON.stringify(['', '', '', '', '']), '⑦ 옛 미처리 레코드는 빈칸(지어낸 무상 없음): ' + JSON.stringify(xr('욕실 줄눈 들뜸')));
  const story = await page.evaluate((n) => hjStoryData(n).map(e => e.d + ' ' + e.t), LIVE);
  assert(story.includes('2026-10-02 AS 처리 — 욕실 방수층 보수') && !story.some(t => /120,000|유상/.test(t)), '⑦ 공사 스토리에 처리 줄(방문일), 금액은 싣지 않는다: ' + JSON.stringify(story));
  const hist = await page.evaluate((n) => projectHistoryData(n).timeline.map(e => e.t), LIVE);
  assert(hist.some(t => /AS .*안방 천장 물자국 → 처리: 욕실 방수층 보수/.test(t)), '⑦ 파일철 AS 줄에 처리 내용: ' + JSON.stringify(hist));

  // ⑧ 현장 카드 — 요약 줄 + ✏️ (클릭 위임)
  await page.evaluate((n) => { closeModal(); state.tab = 'project'; state.activeProject = n; render(); }, LIVE);
  const cardSum = await page.evaluate(() => [...document.querySelectorAll('.asCardSum')].map(x => x.textContent));
  assert(cardSum.some(t => /처리: 욕실 방수층 보수/.test(t) && /유상 120,000원/.test(t)), '⑧ 현장 카드 요약 줄: ' + JSON.stringify(cardSum));
  await page.click('[data-asedit="as-new"]');
  await page.waitForFunction(() => { const d = [...document.querySelectorAll('#modalRoot .asmMore')].find(x => x.dataset.id === 'as-new'); return d && d.open; });
  assert(/AS·하자보수 관리/.test(await modalText()), '⑧ ✏️ 가 AS 화면을 연다');

  // ⑨ 폰 — 44px·16px·가로 넘침 0. 모바일 모드는 설정값이라(폭이 아니다) 꺼 둔 채로 잰다 — 전역 모바일 규칙 없이도 44 여야 한다
  const ui = await page.evaluate(() => {
    __mobileMode = false; applyMobileMode();
    const d = [...document.querySelectorAll('#modalRoot .asmMore')].find(x => x.dataset.id === 'as-new');
    const els = [...d.querySelectorAll('input,select,textarea,button,summary')].concat([...document.querySelectorAll('#modalRoot #asmProj,#modalRoot #asmText,#modalRoot #asmAdd,#modalRoot .asmStat,#modalRoot .asmDel')]);
    const small = els.filter(e => e.getBoundingClientRect().height < 44 && e.offsetParent).map(e => e.className + '/' + (e.dataset.k || '') + ':' + e.getBoundingClientRect().height);
    const font = els.filter(e => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.className);
    const m = document.querySelector('#modalRoot .modal');
    return { small, font, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, mover: m.scrollWidth - m.clientWidth };
  });
  assert(!ui.small.length && !ui.font.length && ui.over <= 0 && ui.mover <= 1, '⑨ 44px·16px·넘침 0: ' + JSON.stringify(ui));

  // ⑨ 저장 왕복
  const rt = await page.evaluate(() => {
    const before = Object.keys(serializeData()).length;
    applyData(JSON.parse(JSON.stringify(serializeData())));
    const a = state.asLog.find(x => x.id === 'as-new');
    return { before, after: Object.keys(serializeData()).length, a: JSON.parse(JSON.stringify(a)) };
  });
  assert(rt.before === 41 && rt.after === 41, '⑨ 최상위 키 41개 그대로: ' + JSON.stringify(rt));
  assert(rt.a.fix === '욕실 방수층 보수' && rt.a.fee === 120000 && rt.a.visitAt === '2026-10-02' && rt.a.warrantyItem === '마감(도배·바닥·타일)' && rt.a.visitSchedId, '⑨ 저장 왕복 뒤 필드 유지: ' + JSON.stringify(rt.a));

  assert(!errors.length, 'pageerror 0: ' + errors.join(' | '));
  console.log('PASS as-record ①~⑨');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { await browser.close(); } catch (_) {} process.exit(1); });

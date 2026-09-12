/* todo-list.e2e.js — ✅ 오늘 할일 (Playwright)

   2026-09-12: 현장에서 떠오른 한 줄이 메모에 묻혀 다음 날 아무도 다시 안 보던 문제.
     ① 더보기 그룹·옛 시트·핸들러에 todo 가 있다(정적)
     ② 한 줄 적고 ➕ 하면 목록에 뜨고, 지금 보고 있는 현장이 같이 붙는다
     ③ 체크하면 '끝낸 일'로 내려가고 다시 풀면 돌아온다
     ④ 어제까지 안 끝난 것은 '밀린 할일'로 맨 위에 올라온다
     ⑤ 저장은 메모(state.notes)에 todo 표시로 — 저장 키는 늘지 않고 저장했다 불러와도 남는다
     ⑥ 🎙 음성 회의록 목록에는 할일이 섞이지 않는다, 대화→할일에서 바로 담을 수 있다
     ⑦ 지우기는 물어보고 지운다, pageerror 0

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
assert(/\['todo','✅','오늘 할일'\]/.test(source), '① 더보기 메뉴 그룹에 있다');
assert(/data-moreaction="todo"/.test(source), '① 옛 더보기 시트에도 있다');
assert(/else if\(a==='todo'\)\{return todoView\(\);\}/.test(source), '① 핸들러가 todoView 로 간다');

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
  await page.waitForFunction(() => typeof window.todoView === 'function' && typeof window.hjTodoAdd === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const todos = () => page.evaluate(() => hjTodoList().map(n => ({ text: n.text, done: !!n.done, project: n.project, day: n.day })));
  const rowsN = () => page.evaluate(() => document.querySelectorAll('#modalRoot .todoRow').length);

  await page.evaluate(() => {
    state.projects = [{ name: '평화로운아파트', stage: 1, received: 0, phases: [], cost: {} }, { name: '유성빌라', stage: 1, received: 0, phases: [], cost: {} }];
    state.notes = [{ id: 'n1', date: '2026-09-11', text: '회의록: 관리소와 통화', project: '평화로운아파트' }];
    state.activeProject = '평화로운아파트'; state.dirty = false;
    moreActionHandler('todo');
  });
  let t = await modalText();
  assert(/오늘 할일/.test(t) && /할 일이 없습니다/.test(t), '① 빈 목록으로 열린다: ' + t.slice(0, 60));

  // ② 한 줄 적고 담기 — 현장이 같이 붙는다
  await page.fill('#todoText', '실리콘 사기');
  await page.click('#todoAdd');
  let list = await todos();
  assert(list.length === 1 && list[0].text === '실리콘 사기' && list[0].project === '평화로운아파트' && list[0].done === false, '② 담김: ' + JSON.stringify(list));
  assert((await page.evaluate(() => state.dirty)) === true, '② 저장 대기 표시');
  assert(/오늘 할일 \(1\)/.test(await modalText()), '② 제목에 남은 개수');
  // 엔터로도 담긴다, 현장 없음도 고를 수 있다
  await page.selectOption('#todoProj', '');
  await page.fill('#todoText', '사다리 반납');
  await page.press('#todoText', 'Enter');
  list = await todos();
  assert(list.length === 2 && list[1].text === '사다리 반납' && list[1].project === '', '② 엔터·현장 없음: ' + JSON.stringify(list));
  assert((await rowsN()) === 2, '② 두 줄');

  // ③ 체크 → 끝낸 일, 다시 풀기
  await page.click('#modalRoot .todoChkBox[data-id="' + (await page.evaluate(() => hjTodoList()[0].id)) + '"]');
  list = await todos();
  assert(list[0].done === true && /끝낸 일 1/.test(await modalText()) && /오늘 할일 \(1\)/.test(await modalText()), '③ 체크: ' + JSON.stringify(list));
  await page.click('#modalRoot .todoChkBox[data-id="' + (await page.evaluate(() => hjTodoList()[0].id)) + '"]');
  assert((await todos())[0].done === false && /오늘 할일 \(2\)/.test(await modalText()), '③ 다시 풀기');

  // ④ 어제 것은 밀린 할일로
  await page.evaluate(() => { const n = hjTodoList()[1]; n.day = '2026-09-01'; todoView(); });
  t = await modalText();
  assert(/밀린 할일 1/.test(t) && /2026-09-01 부터/.test(t), '④ 밀린 할일: ' + t.slice(0, 140));

  // ⑤ 저장 구조 — 메모에 얹히고 왕복해도 남는다
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /todo/i.test(k)), '⑤ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const round = await page.evaluate(() => {
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.notes = [];
    applyData(snap);
    return { todos: hjTodoList().length, memo: (state.notes || []).filter(n => !n.todo).length };
  });
  assert(round.todos === 2 && round.memo === 1, '⑤ 저장했다 불러와도 남는다: ' + JSON.stringify(round));

  // ⑥ 회의록 목록에는 안 섞인다 / 대화→할일에서 바로 담기
  await page.evaluate(() => voiceMemo());
  t = await modalText();
  assert(/회의록: 관리소와 통화/.test(t) && !/실리콘 사기/.test(t) && !/사다리 반납/.test(t), '⑥ 회의록에는 할일이 없다: ' + t.slice(0, 200));
  await page.evaluate(() => convTodoResult([{ t: '타일 본드 추가 주문' }, { t: '관리실에 엘리베이터 예약' }], '유성빌라', true));
  await page.evaluate(() => document.querySelectorAll('.todoChk').forEach(c => { c.checked = true; }));
  await page.click('#modalRoot .mfoot button:has-text("할일로 담기")');
  list = await todos();
  assert(list.length === 4 && list[3].text === '관리실에 엘리베이터 예약' && list[3].project === '유성빌라', '⑥ 대화→할일에서 담기: ' + JSON.stringify(list.map(x => x.text)));

  // ⑦ 지우기·끝낸 일 정리
  await page.evaluate(() => todoView());
  asked = []; sayYes = false;
  let id = await page.evaluate(() => hjTodoList()[0].id);
  await page.click('#modalRoot .todoDel[data-id="' + id + '"]');
  assert(asked.length === 1 && /실리콘 사기/.test(asked[0]) && (await todos()).length === 4, '⑦ 취소하면 그대로: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#modalRoot .todoDel[data-id="' + id + '"]');
  assert((await todos()).length === 3, '⑦ 확인하면 지운다');
  // 다른 기능이 메모에 done 같은 표시를 달아 두어도 할일 정리가 그 메모를 건드리면 안 된다
  await page.evaluate(() => { state.notes.push({ id: 'n2', date: '2026-09-11', text: '점검 완료 메모', project: '', done: true }); hjTodoList().forEach(n => { n.done = true; }); todoView(); });
  asked = [];
  await page.click('#modalRoot .mfoot button:has-text("끝낸 일 지우기")');
  assert(asked.length === 1 && /3건을 지울까요/.test(asked[0]) && (await todos()).length === 0 && (await page.evaluate(() => (state.notes || []).map(n => n.id).join())) === 'n1,n2', '⑦ 끝낸 할일만 지운다(회의록·다른 메모는 남는다): ' + JSON.stringify(asked));
  assert(errors.length === 0, '⑦ pageerror: ' + errors.join(' | '));

  console.log('todo-list.e2e OK (① 메뉴 ② 담기·현장 ③ 체크 ④ 밀린 할일 ⑤ 저장·왕복 ⑥ 회의록 분리·대화→할일 ⑦ 지우기)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

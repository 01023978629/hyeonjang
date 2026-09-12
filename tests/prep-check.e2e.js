/* prep-check.e2e.js — 🧰 출발 전 챙김 (Playwright)

   2026-09-12: 현장 도착해서 실리콘 건을 안 가져온 걸 알면 왕복 40분이다.
   지금까지 일정 브리핑의 준비물은 고칠 수도 체크할 수도 없는 고정 문구였다.
     ① 작업 종류별 준비물이 한 곳(HJ_PREP_SETS)에 있고, 일정 제목·메모·현장 단계로 고른다
     ② 일정 카드의 🧰 를 누르면 그 일정의 준비물이 체크박스로 뜬다
     ③ 체크는 그 일정에 남는다(state.schedule 항목의 prep) — 저장 키는 늘지 않고 왕복해도 남는다
     ④ 목록을 고치면 이 폰에 저장돼 다음 같은 작업에도 그대로 나온다, ↺ 기본 목록으로 되돌린다
     ⑤ 남은 개수를 위에 알려 주고, 전부 체크하면 '다 실었습니다'
     ⑥ 일정 브리핑의 준비물도 같은 목록을 쓴다(두 곳이 어긋나지 않게), pageerror 0

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
assert(/const HJ_PREP_SETS=\[/.test(source), '① 준비물 목록이 한 곳에 있다(정적)');
assert(/data-schprep=/.test(source) && /if\(d\.schprep!==undefined\)return prepCheck\(d\.schprep\);/.test(source), '② 일정 카드 🧰 가 prepCheck 로 간다(정적)');
assert(/\[data-schprep\],/.test(source), '② 클릭 위임 선택자에 등록(안 하면 버튼이 조용히 먹통)');

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
  await page.waitForFunction(() => typeof window.prepCheck === 'function' && typeof window.hjPrepFor === 'function');
  const modalText = () => page.evaluate(() => (document.querySelector('#modalRoot') || {}).textContent || '');
  const items = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .prepChk')].map(c => c.dataset.x));
  const checked = () => page.evaluate(() => [...document.querySelectorAll('#modalRoot .prepChk')].filter(c => c.checked).map(c => c.dataset.x));
  const sch = () => page.evaluate(() => (state.schedule || []).find(s => s.id === 's1'));

  await page.evaluate(() => {
    const today = localDate();
    state.projects = [{ name: '평화로운아파트', stage: 2, received: 0, phases: [], cost: {} }];
    state.schedule = [{ id: 's1', date: today, time: '09:00', title: '욕실 타일 시공', project: '평화로운아파트' },
                      { id: 's2', date: today, time: '14:00', title: '신규 상담', project: '' }];
    state.activeProject = '평화로운아파트'; state.dirty = false;
    try { localStorage.removeItem('hj_prep_sets'); } catch (e) {}
  });

  // ① 작업 종류로 고른다
  const pick = await page.evaluate(() => ({
    tile: hjPrepFor({ title: '욕실 타일 시공' }, null),
    talk: hjPrepFor({ title: '신규 상담' }, null),
    none: hjPrepFor({ title: '기타 방문' }, null),
    memo: hjPrepFor({ title: '방문', memo: '누수 점검' }, null)
  }));
  assert(pick.tile.kinds.join() === '타일' && pick.tile.items.includes('압착시멘트') && pick.tile.items.includes('실리콘·건'), '① 타일: ' + JSON.stringify(pick.tile));
  assert(pick.talk.items.includes('명함') && !pick.talk.items.includes('압착시멘트'), '① 상담: ' + JSON.stringify(pick.talk));
  assert(pick.none.items.length === 0, '① 해당 없으면 비어 있다');
  assert(pick.memo.kinds.join() === '누수' && pick.memo.items.includes('내시경 카메라'), '① 메모로도 고른다: ' + JSON.stringify(pick.memo));

  // ② 일정 카드의 🧰
  await page.evaluate(() => { state.tab = 'schedule'; render(); });
  assert(await page.evaluate(() => !!document.querySelector('[data-schprep="s1"]')), '② 일정 카드에 🧰 버튼');
  await page.click('[data-schprep="s1"]');
  let t = await modalText();
  assert(/출발 전 챙김/.test(t) && /욕실 타일 시공/.test(t) && /평화로운아파트/.test(t), '② 열린다: ' + t.slice(0, 90));
  let list = await items();
  assert(list.includes('타일') && list.includes('스페이서') && list.length === 6, '② 타일 준비물 6개: ' + JSON.stringify(list));
  assert(/아직 6개 안 실었습니다/.test(t), '⑤ 남은 개수: ' + t.slice(0, 60));

  // ③ 체크가 그 일정에 남는다
  await page.click('#modalRoot .prepChk[data-x="타일"]');
  assert((await sch()).prep['타일'] === true && (await page.evaluate(() => state.dirty)) === true, '③ 체크가 일정에 저장: ' + JSON.stringify((await sch()).prep));
  assert(/아직 5개 안 실었습니다/.test(await modalText()), '⑤ 남은 개수가 준다');
  const keys = await page.evaluate(() => Object.keys(serializeData()));
  assert(!keys.some(k => /prep/i.test(k)), '③ serializeData 최상위 키는 그대로: ' + keys.join(','));
  const round = await page.evaluate(() => {
    const snap = JSON.parse(JSON.stringify(serializeData()));
    state.schedule = [];
    applyData(snap);
    const s = (state.schedule || []).find(x => x.id === 's1');
    return s && s.prep ? Object.keys(s.prep) : [];
  });
  assert(round.join() === '타일', '③ 저장했다 불러와도 남는다: ' + JSON.stringify(round));

  // ⑤ 전부 체크
  await page.evaluate(() => prepCheck('s1'));
  await page.click('#modalRoot .mfoot button:has-text("전부 체크")');
  assert(/다 실었습니다/.test(await modalText()) && (await checked()).length === 6, '⑤ 전부 체크: ' + (await modalText()).slice(0, 60));
  await page.click('#modalRoot .prepChk[data-x="타일"]');
  assert((await sch()).prep['타일'] === undefined && /아직 1개/.test(await modalText()), '⑤ 풀면 다시 남은 것으로');

  // ④ 목록 고치기 — 빼고 더하고, 다음에 열어도 그대로
  await page.click('#modalRoot .prepDel[data-x="스페이서"]');
  list = await items();
  assert(!list.includes('스페이서') && list.length === 5, '④ 뺐다: ' + JSON.stringify(list));
  await page.fill('#prepNew', '실리콘 리무버');
  await page.click('#prepAdd');
  list = await items();
  assert(list.includes('실리콘 리무버') && list.length === 6, '④ 더했다: ' + JSON.stringify(list));
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hj_prep_sets') || '{}'));
  assert(saved['타일'] && !saved['타일'].includes('스페이서') && saved['타일'].includes('실리콘 리무버'), '④ 이 폰에 저장: ' + JSON.stringify(saved));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.prepCheck === 'function');
  await page.evaluate(() => {
    const today = localDate();
    state.projects = [{ name: '평화로운아파트', stage: 2, received: 0, phases: [], cost: {} }];
    state.schedule = [{ id: 's3', date: today, time: '10:00', title: '주방 타일 보수', project: '평화로운아파트' }];
    prepCheck('s3');
  });
  list = await items();
  assert(list.includes('실리콘 리무버') && !list.includes('스페이서'), '④ 새로고침·다른 일정에도 내 목록: ' + JSON.stringify(list));
  asked = []; sayYes = false;
  await page.click('#modalRoot .mfoot button:has-text("기본 목록")');
  assert(asked.length === 1 && (await items()).includes('실리콘 리무버'), '④ 되돌리기 취소: ' + JSON.stringify(asked));
  sayYes = true;
  await page.click('#modalRoot .mfoot button:has-text("기본 목록")');
  list = await items();
  assert(list.includes('스페이서') && !list.includes('실리콘 리무버'), '④ 기본 목록으로: ' + JSON.stringify(list));

  // ⑥ 브리핑도 같은 목록을 쓴다
  const brief = await page.evaluate(() => {
    const mine = { '타일': ['타일', '압착시멘트', '내 특별 공구'] };
    localStorage.setItem('hj_prep_sets', JSON.stringify(mine));
    const d = todayScheduleBrief();
    const row = d.list.find(r => r.sch.id === 's3');
    return { hints: row.hints, total: row.prepTotal, done: row.prepDone };
  });
  assert(/내 특별 공구/.test(brief.hints.join()) && brief.total === 3 && brief.done === 0, '⑥ 브리핑이 내 목록을 쓴다: ' + JSON.stringify(brief));
  assert(errors.length === 0, '⑥ pageerror: ' + errors.join(' | '));

  console.log('prep-check.e2e OK (① 종류별 목록 ② 일정 🧰 ③ 일정에 저장·왕복 ④ 목록 고치기·되돌리기 ⑤ 남은 개수 ⑥ 브리핑 공유)');
  await browser.close();
})().catch(async e => { console.error('FAIL', e && e.message || e); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });

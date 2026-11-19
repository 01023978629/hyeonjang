/* v612 🧹 현장 단계 한 번에 정리 (분석 AD WA6) — 단계 0(상담)인 현장을 돈·작업 기록으로 살펴 제안하고, 체크한 것만 반영한다.
   ★ 파수꾼·보증·방치 현장은 stage 가 아니라 doneAt(준공일)을 본다 — 앱에서 '완료'를 누르면(setStage) doneAt 이 오늘이 되므로 이 창은 그 길을 안 쓰고
     근거 날짜(마지막 작업일 → 작업 날짜가 없으면 마지막 입금일, 날짜 칸에서 고칠 수 있음)를 준공일로 적는다. 합성 자료, 시계 고정(11/19 목), PC 1280·폰 390, 바깥 쓰기 0.
     (v612 검토: 협력사 일괄 입금일을 준공일로 쓰면 보증 기산일이 작업이 끝난 날보다 최대 71일 늦어진다 — 입금일은 근거 글로만.)
   ① 제안 — 진짜 projStats(내역서 견적·입금 기록): 완납 → 완료 체크(준공일 = 마지막 작업일) · 부분 입금 → 체크 끈 완료 · 앞으로 일정 → 체크 끔 ·
      보관·이미 단계 있음 → 없음 · 근거 없음 → 뺀 목록 · 읽기만 (PLAN)
   ② 창(PC) — 왼쪽 현장 목록 [🧹 단계 정리 n곳] · 표 머리(현장 | 지금 단계 | 제안 단계 | 완료일과 근거 | 반영) · 미리 체크한 것 = 완납만 · 체크 수 ·
      날짜를 고쳐도 체크는 저절로 켜지지 않고 '체크해야 바뀌어요' 안내 · 창을 열고 골라도 자료 불변 (VIEW)
   ③ 반영 — 체크한 것만 · 준공일 = 근거 날짜·고친 날짜(오늘 아님) · 보증 시작일 = 그 날 · 일반 저장(markDirty) · 안전판 1회 · 결과 창 · 단추 수 줄어듦 (APPLY)
   ④ 되돌리기 — 결과 창 [↩ 되돌리기] = 그 뒤로 안 바뀐 현장만 원래대로(준공일 칸까지) · 안전판 한 번 더 (UNDO)
   ⑤ 가드 — 오늘 뒤 날짜·빈 날짜는 안전판 전에 멈춤 · 안전판 실패 · 오래된 창 · 창을 연 뒤 단계가 바뀐 현장은 그대로 · 직원 모드 (GUARD)
   ⑥ 폰 390·입구 — 현장 선택 시트 [🧹 단계 정리] → 창 · 넘침 0·44px·16px · 💤 방치 현장 창 단추와 ‹ 뒤로 · 체크해 둘 줄이 0 이 돼도(한 번 반영한 뒤)
      💤 방치 현장 창·기능 찾기 '현장 단계 정리'로 남은 제안을 다시 연다 · 핀 3곳 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V612_STAGE_BASELINE=<commit> 은 ① 에서 실패해야 한다. HJ_V612_STAGE_E2E_MUTATION=via-setstage 는 ③, undo-all 은 ④, no-date-guard·no-recheck 는 ⑤ 에서 실패해야 한다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch (_) { ({ chromium } = require('playwright')); }
const APP = process.env.HJ_TEST_APP || 'http://127.0.0.1:8299/index.html', ORIGIN = new URL(APP).origin;
const BOOT = ['__hjRestoreDone', '__hjRelayConfigDone', '__hjOfficeOpsBootDone', '__hjRelayBootDone'];
const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const MUT = {
  'via-setstage': ['    p.stage=r.to;\n    if(r.to===HJ_STAGE_TIDY_DONE){p.doneAt=d;delete p.doneAtPrev;}', '    window.__clPass=1;setStage(p.name,r.to);window.__clPass=0;\n    if(false){p.doneAt=d;delete p.doneAtPrev;}'],
  'undo-all': ['    if(list.length!==1||p.stage!==x.after.stage||String(p.doneAt||\'\')!==x.after.doneAt){kept++;return;}', '    if(list.length!==1){kept++;return;}'],
  'no-date-guard': ["      if(d>today){if(!bad)bad={el:inp,msg:'오늘 뒤 날짜는 준공일로 쓸 수 없어요'};return;}\n", ''],
  'no-recheck': ["    if(list.length!==1||p.archived||(Number(p.stage)||0)!==0||String(p.doneAt||'')!==r.seen.doneAt||String(p.doneAtPrev||'')!==r.seen.doneAtPrev){changed++;return;}", '    if(list.length!==1){changed++;return;}']
};
let html = process.env.HJ_V612_STAGE_BASELINE ? execFileSync('git', ['show', process.env.HJ_V612_STAGE_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V612_STAGE_E2E_MUTATION) {
  const m = MUT[process.env.HJ_V612_STAGE_E2E_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V612_STAGE_E2E_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], () => m[1]);
}
let browser, passed = 0;
const errors = [], network = { writes: 0 };
const TODAY = '2026-11-19';
async function test(name, fn) { await fn(); passed++; console.log('PASS stagetidy-v612 ' + name); }
async function open(viewport, mobile) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date(TODAY + 'T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false;
    window.__toasts = []; const t0 = toast; toast = (m, ...a) => { window.__toasts.push(String(m)); return t0(m, ...a); };
    window.__md = 0; const md0 = markDirty; markDirty = (...a) => { window.__md++; return md0(...a); };
  }, BOOT);
  return { context, page };
}
// 합성 자료 — 오늘 11/19(목). 작업내역서 견적(수주)·입금 기록은 앱의 반영·입금 길과 같은 꼴. 견적 → 견적 파일(가상)은 syncQuoteToProject(견적 저장과 같은 함수).
async function seed(page) {
  await page.evaluate(() => {
    try { closeModal(true); } catch (e) {}
    __tabStale = false; window.__toasts = []; window.__md = 0;
    const proj = (name, extra) => Object.assign({ name, stage: 0, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' } }, extra || {});
    const q = (id, project, total, days) => ({ id, no: 'T-' + id, title: project + ' 작업내역서', project, date: '2026-10-31', result: 'won', vatIncluded: true, accountIdx: null,
      items: [{ name: '작업', spec: '', qty: 1, price: Math.round(total / 1.1) }],
      stmt: { v: 1, doc: '작업내역서', to: '시험 협력사', date: '2026-10-31', file: 'T.xlsx', key: 'T.xlsx#' + project, vat: 'included', total, src: 'T.xlsx', lines: days.map(d => ({ d, loc: project, work: '작업', amt: Math.round(total / days.length) })) } });
    state.projects = [
      proj('가온아파트', { received: 1100000 }), proj('나래빌라', { received: 550000 }), proj('다온타운', { received: 300000 }),
      proj('모란아파트', { archived: true, received: 220000 }), proj('바다빌라', { stage: 2, received: 330000 }), proj('별빛상가', { received: 440000 }), proj('빈현장')
    ];
    state.quotes = [q(1, '가온아파트', 1100000, ['2026-10-20', '2026-10-22']), q(2, '나래빌라', 550000, ['2026-10-01']), q(3, '다온타운', 1000000, ['2026-10-15']),
      q(4, '모란아파트', 220000, ['2026-09-01']), q(5, '바다빌라', 330000, ['2026-09-02']), q(6, '별빛상가', 440000, ['2026-10-05'])];
    state.files = []; state.quotes.forEach(x => syncQuoteToProject(x));
    state.payLog = [{ d: '2026-11-05', project: '가온아파트', amt: 600000 }, { d: '2026-11-10', project: '가온아파트', amt: 500000 }, { d: '2026-11-03', project: '나래빌라', amt: 550000 },
      { d: '2026-11-03', project: '다온타운', amt: 300000 }, { d: '2026-11-04', project: '모란아파트', amt: 220000 }, { d: '2026-11-04', project: '바다빌라', amt: 330000 }, { d: '2026-11-06', project: '별빛상가', amt: 440000 }];
    state.schedule = [{ id: 's1', date: '2026-11-25', time: '', title: '추가 세대 방수', project: '별빛상가', hours: 8, memo: '', report: null }];
    state.goals = {}; state.activeProject = null; state.tab = 'dashboard';
    try { localStorage.removeItem('hj_role'); } catch (e) {}
    render();
  });
}
const snapSig = page => page.evaluate(() => { const d = JSON.parse(JSON.stringify(serializeData())); delete d.savedAt; return JSON.stringify(d); });
const snapCount = (page, label) => page.evaluate(async l => ((await idbGet('hj_snaps')) || []).filter(x => x.label === l).length, label);
// [단계, 준공일 칸('-' = 칸 없음), 예전 준공일 칸] — undefined 를 페이지 밖으로 넘기지 않는다
const pj = (page, name) => page.evaluate(n => { const p = state.projects.find(x => x.name === n); return p ? [p.stage, 'doneAt' in p ? p.doneAt : '-', 'doneAtPrev' in p ? p.doneAtPrev : '-'] : null; }, name);
const lastToast = page => page.evaluate(() => window.__toasts.slice(-1)[0] || '');
const row = (name) => '#hjStageTidy tr[data-stage-tidy-row="' + name + '"]';
async function openView(page) { await page.evaluate(() => hjStageTidyView()); await page.waitForSelector('#hjStageTidy'); }
async function applyBtn(page) { await page.click('#modalRoot .mfoot button:has-text("반영")'); }

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open({ width: 1280, height: 900 });

    await test('① 제안 — 완납 → 완료 체크(준공일 = 마지막 작업일) · 부분 입금·앞으로 일정은 체크 끔 · 보관·단계 있음 제외 · 읽기만 (PLAN)', async () => {
      await seed(page);
      const before = await snapSig(page);
      const p = await page.evaluate(() => { const r = hjStageTidyPlan(); return { today: r.today, on: r.on, skip: r.skip, rows: r.rows.map(x => [x.name, x.kind, x.to, x.on, x.doneAt]), left: r.left.map(x => [x.name, x.kind]) }; });
      assert.equal(p.today, '2026-11-19');
      assert.deepEqual(p.rows, [['가온아파트', 'paid', 3, true, '2026-10-22'], ['나래빌라', 'paid', 3, true, '2026-10-01'], ['별빛상가', 'paid', 3, false, '2026-10-05'], ['다온타운', 'partial', 3, false, '2026-10-15']],
        '제안 · 차례(체크한 것 먼저) · 준공일 = 마지막 작업일(입금 11/03~11/10 아님) ' + JSON.stringify(p.rows));
      assert.deepEqual([p.on, p.skip, p.left], [2, { archived: 1, staged: 1, dup: 0 }, [['빈현장', 'none']]], JSON.stringify([p.on, p.skip, p.left]));
      assert.equal(await snapSig(page), before, '읽기만 — 자료 불변');
    });

    await test('② 창(PC) — 목록 단추 · 표 머리 · 미리 체크 = 완납만 · 체크 수 · 자료 불변 (VIEW)', async () => {
      await seed(page);
      const before = await snapSig(page);
      await page.waitForSelector('#projList #sideStageTidy');
      const b = await page.evaluate(() => { const x = document.getElementById('sideStageTidy'); return { text: x.textContent.trim(), n: x.dataset.stageTidyN, h: Math.round(x.getBoundingClientRect().height), after: x.previousElementSibling && x.previousElementSibling.id }; });
      assert.deepEqual([b.text, b.n, b.h >= 44, b.after], ['🧹 단계 정리 2곳', '2', true, 'sideLeakFilter'], '왼쪽 현장 목록 단추 ' + JSON.stringify(b));
      await page.click('#sideStageTidy'); await page.waitForSelector('#hjStageTidy');
      const v = await page.evaluate(() => {
        const root = document.getElementById('hjStageTidy'), rows = [...root.querySelectorAll('tr[data-stage-tidy-row]')];
        return { head: [...root.querySelectorAll('thead th')].map(th => th.textContent.trim()),
          rows: rows.map(r => [r.dataset.stageTidyRow, [...r.children].slice(1, 3).map(td => td.textContent.trim()), (r.querySelector('.stdDate') || {}).value || '', r.querySelector('.stdChk').checked]),
          count: root.querySelector('[data-stage-tidy-count]').textContent, btn: [...document.querySelectorAll('#modalRoot .mfoot button')].map(x => x.textContent.trim()),
          why: root.querySelector('tr[data-stage-tidy-row="별빛상가"] .std-why').textContent, left: (root.querySelector('[data-stage-tidy-left]') || {}).textContent || '',
          skip: (root.querySelector('[data-stage-tidy-skip]') || {}).textContent || '', max: root.querySelector('.stdDate').max };
      });
      assert.deepEqual(v.head, ['현장', '지금 단계', '제안 단계', '완료일과 근거', '반영'], '표 머리 ' + JSON.stringify(v.head));
      assert.deepEqual(v.rows, [['가온아파트', ['상담', '완료'], '2026-10-22', true], ['나래빌라', ['상담', '완료'], '2026-10-01', true], ['별빛상가', ['상담', '완료'], '2026-10-05', false], ['다온타운', ['상담', '완료'], '2026-10-15', false]],
        '줄·준공일·미리 체크(완납만) ' + JSON.stringify(v.rows));
      assert.equal(v.count, '체크 2곳 / 4곳');
      assert.ok(v.btn.includes('🧹 체크한 2곳 반영') && v.btn.includes('닫기'), JSON.stringify(v.btn));
      assert.match(v.why, /앞으로 일정 11\/25\(수\) — 이어지는 공사면 체크하지 마세요/, v.why);
      assert.match(v.left, /근거가 모자라 뺀 현장 1곳/, v.left);
      assert.match(v.skip, /보관한 현장 1곳 · 이미 단계가 있는 현장 1곳/, v.skip);
      assert.equal(v.max, TODAY, '날짜 칸 최대 = 오늘');
      assert.ok(!/\d[\d,]*\s*원|미수/.test(await page.evaluate(() => document.getElementById('hjStageTidy').textContent)), '창에 금액·미수 없음');
      await page.click('#stdPickNone');
      assert.equal(await page.evaluate(() => document.querySelectorAll('#hjStageTidy .stdChk:checked').length), 0, '체크 모두 끄기');
      await page.click('#stdPickDefault');
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#hjStageTidy .stdChk')].map(c => c.checked)), [true, true, false, false], '제안대로 체크');
      await page.fill(row('다온타운') + ' .stdDate', '2026-10-16');
      const dh = () => page.evaluate(() => { const tr = document.querySelector('#hjStageTidy tr[data-stage-tidy-row="다온타운"]'), h = tr.querySelector('[data-stage-tidy-datehint]'); return [tr.querySelector('.stdChk').checked, h ? h.textContent : '']; });
      const d1 = await dh();
      assert.equal(d1[0], false, '날짜를 고쳐도 체크는 저절로 켜지지 않는다(체크한 것만 바뀐다)');
      assert.match(d1[1], /체크해야 바뀌어요/, '체크 안내 ' + JSON.stringify(d1));
      await page.check(row('다온타운') + ' .stdChk');
      assert.deepEqual(await dh(), [true, ''], '체크하면 안내가 사라진다');
      await page.uncheck(row('다온타운') + ' .stdChk');
      assert.equal(await snapSig(page), before, '창을 열고 골라도 자료 불변');
      await page.evaluate(() => closeModal());
    });

    await test('③ 반영 — 체크한 것만 · 준공일 = 근거·고친 날짜(오늘 아님) · 보증 시작 · 일반 저장 · 안전판 1회 · 결과 창 (APPLY)', async () => {
      await seed(page);
      const snaps0 = await snapCount(page, '현장 단계 정리 전'), keep = { 별빛상가: await pj(page, '별빛상가'), 모란아파트: await pj(page, '모란아파트'), 바다빌라: await pj(page, '바다빌라') };
      await openView(page);
      await page.uncheck(row('나래빌라') + ' .stdChk');
      await page.fill(row('다온타운') + ' .stdDate', '2026-10-16');
      await page.check(row('다온타운') + ' .stdChk');   // 날짜를 고친 줄도 체크해야 바뀐다
      await page.evaluate(() => { window.__md = 0; });
      await applyBtn(page);
      await page.waitForSelector('#hjStageTidyDone');
      const r = await page.evaluate(() => {
        const g = n => state.projects.find(x => x.name === n), w = hjWarranty(g('가온아파트'));
        return { gaon: [g('가온아파트').stage, g('가온아파트').doneAt], daon: [g('다온타운').stage, g('다온타운').doneAt], narae: [g('나래빌라').stage, 'doneAt' in g('나래빌라')],
          warranty: w && w.startedAt, md: window.__md,
          done: [...document.querySelectorAll('#hjStageTidyDone [data-stage-tidy-done]')].map(li => li.textContent.trim()), foot: [...document.querySelectorAll('#modalRoot .mfoot button')].map(b => b.textContent.trim()) };
      });
      assert.deepEqual(r.gaon, [3, '2026-10-22'], '완납 — 준공일 = 마지막 작업일(입금일 11/10 아님) ' + JSON.stringify(r.gaon));
      assert.deepEqual(r.daon, [3, '2026-10-16'], '고친 날짜 ' + JSON.stringify(r.daon));
      assert.deepEqual(r.narae, [0, false], '체크 안 한 줄 그대로 ' + JSON.stringify(r.narae));
      assert.notEqual(r.gaon[1], TODAY); assert.notEqual(r.daon[1], TODAY);
      assert.equal(r.warranty, '2026-10-22', '보증 시작일 = 준공일(작업이 끝난 날 — 오늘·입금일 아님)');
      assert.ok(r.md >= 1, '일반 저장(markDirty) ' + r.md);
      for (const n of Object.keys(keep)) assert.deepEqual(await pj(page, n), keep[n], n + ' 그대로');
      assert.equal(await snapCount(page, '현장 단계 정리 전') - snaps0, 1, '안전판 1회');
      assert.deepEqual(r.done, ['가온아파트 — 완료 · 준공일 2026-10-22', '다온타운 — 완료 · 준공일 2026-10-16'], JSON.stringify(r.done));
      assert.deepEqual(r.foot, ['↩ 되돌리기', '닫기'], JSON.stringify(r.foot));
      assert.match(await lastToast(page), /현장 2곳의 단계를 정리했어요/);
      await page.evaluate(() => closeModal());
      await page.waitForFunction(() => { const b = document.getElementById('sideStageTidy'); return b && b.dataset.stageTidyN === '1'; });
    });

    await test('④ 되돌리기 — 그 뒤로 안 바뀐 현장만 원래대로 · 안전판 한 번 더 (UNDO)', async () => {
      await seed(page);
      await openView(page);
      await applyBtn(page);
      await page.waitForSelector('#hjStageTidyDone');
      const snaps0 = await snapCount(page, '현장 단계 정리 되돌리기 전');
      await page.evaluate(() => { state.projects.find(x => x.name === '나래빌라').doneAt = '2026-11-01'; });   // 결과 창을 연 채 다른 곳에서 준공일을 고침
      await page.click('#modalRoot .mfoot button:has-text("되돌리기")');
      await page.waitForSelector('#hjStageTidyDone', { state: 'detached' });
      assert.deepEqual(await pj(page, '가온아파트'), [0, '-', '-'], '원래대로(준공일 칸 없음)');
      assert.deepEqual(await pj(page, '나래빌라'), [3, '2026-11-01', '-'], '그 사이 바뀐 현장은 그대로');
      assert.match(await lastToast(page), /현장 1곳을 원래 단계로 되돌렸어요 · 그 사이 바뀐 1곳은 그대로/);
      assert.equal(await snapCount(page, '현장 단계 정리 되돌리기 전') - snaps0, 1, '되돌리기 전 안전판');
    });

    await test('⑤ 가드 — 오늘 뒤·빈 날짜 · 안전판 실패 · 오래된 창 · 그 사이 바뀐 현장 · 직원 모드 (GUARD)', async () => {
      await seed(page);
      let before = await snapSig(page);
      await page.evaluate(() => { window.__snapCalls = 0; window.__realSnap = window.__realSnap || hjSnapshot; hjSnapshot = async (...a) => { window.__snapCalls++; return window.__realSnap(...a); }; });
      await openView(page);
      await page.fill(row('가온아파트') + ' .stdDate', '2026-11-20');
      await applyBtn(page);
      const f = await page.evaluate(() => ({ calls: window.__snapCalls, open: !!document.getElementById('hjStageTidy'), inv: document.querySelector('#hjStageTidy tr[data-stage-tidy-row="가온아파트"] .stdDate').getAttribute('aria-invalid'), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([f.calls, f.open, f.inv], [0, true, 'true'], '오늘 뒤 날짜 — 안전판 전에 멈춤 ' + JSON.stringify(f));
      assert.match(f.toast, /아무 현장도 바꾸지 않았어요/, f.toast);
      await page.fill(row('가온아파트') + ' .stdDate', '');
      await applyBtn(page);
      assert.equal(await page.evaluate(() => window.__snapCalls), 0, '빈 날짜 — 안전판 전에 멈춤');
      assert.equal(await snapSig(page), before, '날짜 틀림 — 자료 불변');
      await page.fill(row('가온아파트') + ' .stdDate', '2026-10-22');
      // 안전판 실패
      await page.evaluate(() => { hjSnapshot = async () => { window.__snapCalls++; return false; }; });
      await applyBtn(page);
      const s = await page.evaluate(() => ({ open: !!document.getElementById('hjStageTidy'), dis: [...document.querySelectorAll('#modalRoot .mfoot button')].some(x => x.disabled), toast: window.__toasts.slice(-1)[0] || '' }));
      assert.deepEqual([s.open, s.dis], [true, false], '안전판 실패 — 창 그대로·단추 다시 눌림 ' + JSON.stringify(s));
      assert.match(s.toast, /안전판을 만들지 못해/, s.toast);
      assert.equal(await snapSig(page), before, '안전판 실패 — 자료 불변');
      // 오래된 창
      await page.evaluate(() => { window.__snapCalls = 0; hjSnapshot = async (...a) => { window.__snapCalls++; return window.__realSnap(...a); }; __tabStale = true; });
      await applyBtn(page);
      const st = await page.evaluate(() => ({ calls: window.__snapCalls, toast: window.__toasts.slice(-1)[0] || '' }));
      await page.evaluate(() => { __tabStale = false; });
      assert.equal(st.calls, 0, '오래된 창 — 안전판 전에 멈춤'); assert.match(st.toast, /오래된 창/, st.toast);
      assert.equal(await snapSig(page), before, '오래된 창 — 자료 불변');
      // 창을 연 뒤 다른 곳에서 단계가 바뀐 현장은 덮지 않는다
      await page.evaluate(() => { state.projects.find(x => x.name === '가온아파트').stage = 1; });
      await applyBtn(page);
      await page.waitForSelector('#hjStageTidyDone');
      assert.deepEqual(await pj(page, '가온아파트'), [1, '-', '-'], '그 사이 바뀐 현장 그대로');
      assert.deepEqual(await pj(page, '나래빌라'), [3, '2026-10-01', '-'], '나머지는 반영');
      assert.match(await lastToast(page), /그 사이 바뀐 현장 1곳은 그대로/);
      await page.evaluate(() => closeModal());
      // 직원 모드 — 창도 단추도 없다
      await seed(page);
      before = await snapSig(page);
      const sf = await page.evaluate(() => { localStorage.setItem('hj_role', 'staff'); const r = hjStageTidyView(), n = hjStageTidyBtnN(); localStorage.removeItem('hj_role'); return { r, n, open: !!document.getElementById('hjStageTidy') }; });
      assert.deepEqual(sf, { r: false, n: 0, open: false }, '직원 모드 ' + JSON.stringify(sf));
      assert.equal(await snapSig(page), before, '직원 모드 — 자료 불변');
      await page.evaluate(() => { hjSnapshot = window.__realSnap; });
    });
    await context.close();

    const m = await open({ width: 390, height: 844 }, true);
    await test('⑥ 폰 390·입구 — 시트 단추 → 창 · 넘침 0·44px·16px · 방치 현장 창 · 핀 · 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      await seed(m.page);
      await m.page.waitForFunction(() => !__mobileSheetHistoryRetire && !__mobileSheetHistoryDeferredOpen);
      await m.page.locator('#projChip').click(); await m.page.locator('#projSheet').waitFor();
      const sb = await m.page.evaluate(() => { const b = document.getElementById('psStageTidy'); return b ? { text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height) } : null; });
      assert.ok(sb && sb.text === '🧹 단계 정리 2곳' && sb.h >= 44, '시트 단추 ' + JSON.stringify(sb));
      await m.page.click('#psStageTidy');
      await m.page.waitForSelector('#hjStageTidy');
      await m.page.waitForFunction(() => !document.getElementById('projSheet'));
      await m.page.waitForTimeout(300);   // 시트 히스토리 정리(뒤로) 뒤에도 창이 남는지
      const v = await m.page.evaluate(() => {
        const root = document.getElementById('hjStageTidy'), modal = root.closest('.modal') || document.querySelector('#modalRoot .modal');
        const big = el => el.getBoundingClientRect().height >= 43.5 && el.getBoundingClientRect().width >= 43.5;
        return { open: !!document.getElementById('hjStageTidy'), over: document.documentElement.scrollWidth > innerWidth + 1 || modal.scrollWidth > modal.clientWidth + 1,
          picks: [...root.querySelectorAll('.std-pick')].every(big), foot: [...document.querySelectorAll('#modalRoot .mfoot button')].every(b => b.getBoundingClientRect().height >= 43.5),
          tools: [...root.querySelectorAll('.std-tools button')].every(b => b.getBoundingClientRect().height >= 43.5),
          date16: [...root.querySelectorAll('.stdDate')].every(d => parseFloat(getComputedStyle(d).fontSize) >= 16 && d.getBoundingClientRect().height >= 43.5),
          rowsIn: [...root.querySelectorAll('tr[data-stage-tidy-row]')].every(r => r.getBoundingClientRect().right <= innerWidth + 1) };
      });
      assert.deepEqual(v, { open: true, over: false, picks: true, foot: true, tools: true, date16: true, rowsIn: true }, '폰 390 ' + JSON.stringify(v));
      await m.page.evaluate(() => closeModal());
      // 💤 방치 현장 창 — 단추와 ‹ 뒤로
      await m.page.evaluate(() => staleProjects());
      await m.page.waitForSelector('#stpStageTidy');
      assert.match(await m.page.textContent('#stpStageTidy'), /🧹 돈·작업 기록으로 단계 정리 2곳/);
      await m.page.click('#stpStageTidy');
      await m.page.waitForSelector('#hjStageTidy');
      await m.page.click('#modalRoot .mfoot button:has-text("뒤로")');
      await m.page.waitForSelector('#stpStageTidy');
      await m.page.evaluate(() => closeModal());
      // 한 번 반영해 체크해 둘 줄이 0 이 돼도(가온·나래 완료) 남은 제안(체크 끈 2곳)으로 돌아오는 길 — 💤 방치 현장 창 · 기능 찾기
      await m.page.evaluate(() => { ['가온아파트', '나래빌라'].forEach(n => { const p = state.projects.find(x => x.name === n); p.stage = 3; p.doneAt = '2026-10-20'; }); render(); });
      assert.deepEqual(await m.page.evaluate(() => [hjStageTidyBtnN(), hjStageTidyCounts().rows]), [0, 2], '체크해 둘 줄 0 · 남은 제안 2');
      await m.page.evaluate(() => staleProjects());
      await m.page.waitForSelector('#stpStageTidy');
      assert.match(await m.page.textContent('#stpStageTidy'), /확인할 제안 2곳/);
      await m.page.evaluate(() => closeModal());
      await m.page.evaluate(() => HJ_ACTIONS.find(a => a.n === '현장 단계 정리').run());
      await m.page.waitForSelector('#hjStageTidy');
      assert.equal(await m.page.locator('#hjStageTidy tr[data-stage-tidy-row]').count(), 2, '기능 찾기로 남은 제안 2곳');
      await m.page.evaluate(() => closeModal());
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c && +a.match(/v(\d+)/)[1] >= 611, '핀 3곳 같음 ' + [a, b, c]);
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    await m.context.close();
  } finally { await browser.close(); }
  console.log('stagetidy-v612: ' + passed + '/6');
  if (passed !== 6) process.exit(1);
})().catch(e => { console.error('FAIL stagetidy-v612', e && e.stack || e); process.exit(1); });

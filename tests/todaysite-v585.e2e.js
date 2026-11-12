/* v585 📸 촬영·현장 고르기에 '📅 오늘 일정 현장' 먼저 + 사진 추가 확인 창 경고.
   하루 두세 현장을 도는 날, 앞 현장이 골라진 채 다음 현장에서 찍으면 사진 추가 확인 창이 앞 현장을 미리 골라 두고
   그대로 [추가]하면 엉뚱한 현장 사진이 됐다. 현장 고르기 시트는 '사진 0개 먼저·가나다'라 오늘 현장을 찾기 어려웠다.
   합성 자료(이름은 지어낸 것), 시계 2026-11-11(수) 10:00 고정, 바깥 쓰기 0.
   ① 규칙 hjTodaySiteNames — ⏱ 작업 중 먼저 + 그날 일정 현장(여러 날 공정 이어지는 날 포함) · 💰·세금 자동·개인 일정·보관·없는 현장·
      끝난 작업·어제 작업·완료 보고한 공정·📥 팀 보고로 들어온 작업 기록 제외 · 읽기만(state.workLogs 를 만들지 않음) (RULE)
   ② 현장 고르기 시트(폰 390) — 맨 위 [data-ps-today] 줄 · 아래 목록 순서·행 수 그대로 · 검색 중 숨김 · 누르면 그 현장 화면 · 다시 열면 '지금 현장' (SHEET)
   ③ 촬영 시트 — [data-camera-today] 줄 · [data-camera-project] 순서 그대로 · 검색 중 숨김 · 누르면 그 현장으로 카메라 · 골라져 있으면 바로 카메라(그대로) (CAMERA)
   ④ 사진 추가 확인 창 — 오늘 현장 칩(누르면 칸 값만 · 남은 '현장을 선택해 주세요' 글을 지움) · 촬영·공유 사진인데 오늘 현장 밖이면 경고,
      오늘 현장이어도 ⏱ 작업 중인 현장이 따로 있으면 경고(막지 않음) · 갤러리·빈칸·미배정·⏱ 현장은 경고 없음 ·
      오늘 현장 7곳 이상 — 칩은 6곳·'외 n곳' 안내, 경고 판정·글은 전체로 · 저장 없음 (INTAKE)
   ⑤ 폰 360 · 긴 이름 · 큰 글씨 2단계 — 가로 넘침 없음 · 누르는 것 44px · 입력 16px · 머리글·작은 글·경고도 커짐 (PHONE)
   ⑥ 핀(세 곳 같음) · 페이지 오류 0 · 바깥 쓰기 0
   HJ_V585_BASELINE=<commit> 은 ① 에서, HJ_V585_MUTATION=no-cont(이어지는 날 빼기)·money-in(💰 포함)·workdata(workData() 로 읽기)·
   team-work(팀 보고 기록도 작업 중으로)는 ①, no-hide(검색 중 숨기지 않음)는 ②, no-warn(경고 끔)·no-work(⏱ 경고 끔)·no-clear(현장 검색을 안 비움)·
   no-issue-clear(오류 글을 안 지움)·cap-judge(경고를 6곳으로 자른 목록으로 판정)는 ④, no-big(큰 글씨 경고 규칙 빼기)는 ⑤ 에서 실패해야 한다. */
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
  'no-cont': ['    if(!on&&s.date&&s.date<ymd){try{on=hjSchContDates(s).includes(ymd);}catch(e){}}\n', ''],
  'money-in': ["    if(/^💰/.test(String(s.title||'').trim())||s._taxAuto||s.sourceUid)return;", '    if(s._taxAuto||s.sourceUid)return;'],
  'workdata': ['(Array.isArray(state.workLogs)?state.workLogs:[]).forEach(w=>{if(w&&w.project&&w.date===ymd', 'workData().forEach(w=>{if(w&&w.project&&w.date===ymd'],
  'no-hide': ["const today=sh.querySelector('#psToday');if(today)today.hidden=!!q;", "const today=sh.querySelector('#psToday');"],
  'no-warn': ["  if(source!=='camera'&&source!=='share')return '';\n", "  return '';\n"],
  'no-work': ["  return (workNames||[]).length&&!workNames.includes(picked)?'work':'';\n", "  return '';\n"],
  'team-work': ['&&!w.out&&!w.teamReport&&live.has(w.project)', '&&!w.out&&live.has(w.project)'],
  'cap-judge': ['const todayAll=hjTodaySiteNames().filter(n=>projects.some(p=>p.name===n)),todayNames=todayAll.slice(0,HJ_TODAY_SITE_SHOW),',
    'const todayAll=hjTodaySiteNames().filter(n=>projects.some(p=>p.name===n)).slice(0,HJ_TODAY_SITE_SHOW),todayNames=todayAll,'],
  'no-issue-clear': ["    const issue=document.getElementById('photoIntakeIssue');if(issue)issue.textContent='';\n", ''],
  'no-big': ['  body.a11y-big1 .hj-today-warn{font-size:16px}body.a11y-big2 .hj-today-warn{font-size:18px}\n', ''],
  'no-clear': ["    if(q&&q.value){q.value='';q.dispatchEvent(new Event('input'));}\n", '']
};
let html = process.env.HJ_V585_BASELINE ? execFileSync('git', ['show', process.env.HJ_V585_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V585_MUTATION) {
  const m = MUT[process.env.HJ_V585_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V585_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}
const TODAY = ['라온주택', '가온아파트', '나래빌라'];   // ⏱ 작업 중 먼저, 그다음 일정 순서
// 아래 목록(사진 0개 먼저 · 가나다) — 오늘 줄이 생겨도 이 순서·행 수는 그대로여야 한다
const LIST = ['가온아파트', '다솜상가', '사랑빌라', '아라아파트', '자두빌라', '차오름', '하늘아파트', '나래빌라', '라온주택', '바다아파트'];

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS todaysite-v585 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: true, isMobile: true });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('pref_mobile', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = true; applyMobileMode();
  }, BOOT);
  return { context, page };
}
/* 합성 시드 — 오늘 2026-11-11(수).
   라온주택: ⏱ 08:30 시작·안 끝냄 / 가온아파트: 오늘 도배 / 나래빌라: 11/10~11/12 타일(이어지는 날) — 이 셋이 오늘 현장.
   빠지는 것: 다솜상가(💰 잔금만) · 차오름(세금 자동) · 사랑빌라(앱이 넣은 개인 일정) · 마루아파트(보관 — 일정·작업 모두) · 없는현장 ·
   아라아파트(오늘 작업 끝냄) · 자두빌라(어제 시작한 작업) · 하늘아파트(이어지는 공정이지만 완료 보고) · 바다아파트(어제 하루 일정 — 지금 골라져 있는 현장) ·
   사랑빌라의 오늘 작업 기록(📥 팀 보고 0시간 완료 — out 이 빈칸이지만 ⏱ 를 누른 것이 아니다). */
const SEED = () => {
  closeModal(true);
  ['projSheet', 'projSheetBd', 'cameraProjectSheet', 'cameraProjectBackdrop'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  const P = (name, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false }, extra || {});
  state.projects = ['가온아파트', '나래빌라', '다솜상가', '라온주택', '바다아파트', '사랑빌라', '아라아파트', '자두빌라', '차오름', '하늘아파트'].map(n => P(n)).concat([P('마루아파트', { archived: true })]);
  let n = 0;
  const ph = project => ({ id: 'ph' + (++n), name: 'p' + n + '.jpg', ext: 'jpg', kind: 'photo', project, size: 1000 + n, when: new Date('2026-11-0' + (1 + n % 8) + 'T10:00:00+09:00') });
  state.files = [ph('나래빌라'), ph('나래빌라'), ph('라온주택'), ph('바다아파트'), ph('바다아파트'), ph('바다아파트')];
  const S = (id, date, title, project, extra) => Object.assign({ id, date, time: '09:00', title, project, workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [
    S('s1', '2026-11-11', '도배', '가온아파트'),
    S('s2', '2026-11-10', '타일', '나래빌라', { memo: '2026-11-10~2026-11-12 (3일)' }),
    S('s3', '2026-11-11', '💰 잔금 받기', '다솜상가'),
    S('s4', '2026-11-11', '부가세 신고', '차오름', { _taxAuto: true }),
    S('s5', '2026-11-11', '개인 약속', '사랑빌라', { sourceUid: 'personal-1' }),
    S('s6', '2026-11-11', '마감', '마루아파트'),
    S('s7', '2026-11-11', '점검', '없는현장'),
    S('s8', '2026-11-09', '방수', '하늘아파트', { memo: '2026-11-09~2026-11-11 (3일)', report: { progress: '완료', done: '방수 끝' } }),
    S('s9', '2026-11-10', '철거', '바다아파트'),
  ];
  state.workLogs = [
    { id: 'w1', project: '라온주택', date: '2026-11-11', in: '08:30', out: '', memo: '' },
    { id: 'w2', project: '아라아파트', date: '2026-11-11', in: '07:00', out: '08:00', memo: '' },
    { id: 'w3', project: '자두빌라', date: '2026-11-10', in: '13:00', out: '', memo: '' },
    { id: 'w4', project: '마루아파트', date: '2026-11-11', in: '08:00', out: '', memo: '' },
    { id: 'w5', project: '사랑빌라', date: '2026-11-11', in: '09:00', out: '', memo: '[팀 보고] 완료', teamReport: { key: 'r1', orderId: '', hours: 0, reporter: '' } },
  ];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state._demo = false; state.dirHandle = null; window.__tabStale = false;
  state.activeProject = '바다아파트'; state.tab = 'dashboard'; state.search = '';
  render(); syncMobileNav();
};
const snap = () => { const d = JSON.parse(JSON.stringify(serializeData())); delete d.savedAt; return JSON.stringify(d); };
const sheetGone = page => page.waitForFunction(() => !document.getElementById('projSheet') && !document.getElementById('cameraProjectSheet') && !__mobileSheetHistoryRetire && !(history.state && history.state.__hjMobileSheet));
const tapSizes = (page, sel) => page.locator(sel).evaluateAll(es => es.filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 14), Math.round(r.width), Math.round(r.height)]; }));

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(390);
    await page.evaluate(SEED);

    await test('① 규칙 — 작업 중 먼저 + 그날 일정 현장 · 빠질 것 빠짐 · 읽기만 (RULE)', async () => {
      const before = await page.evaluate(snap);
      const r = await page.evaluate(() => {
        const today = hjTodaySiteNames(), tomorrow = hjTodaySiteNames('2026-11-12'), yesterday = hjTodaySiteNames('2026-11-10');
        const saved = state.workLogs; delete state.workLogs;
        const noLogs = hjTodaySiteNames(); const created = Object.prototype.hasOwnProperty.call(state, 'workLogs');
        state.workLogs = saved;
        return { today, tomorrow, yesterday, noLogs, created };
      });
      r.same = before === await page.evaluate(snap);
      assert.deepEqual(r.today, TODAY, '오늘 현장(팀 보고 기록은 작업 중이 아님) — ' + JSON.stringify(r.today));
      assert.deepEqual(r.tomorrow, ['나래빌라'], '11/12 는 이어지는 공정 셋째 날만 — ' + JSON.stringify(r.tomorrow));
      assert.deepEqual(r.yesterday, ['자두빌라', '나래빌라', '바다아파트'], '11/10 — 그날 시작한 작업·그날 일정 — ' + JSON.stringify(r.yesterday));
      assert.deepEqual(r.noLogs, ['가온아파트', '나래빌라'], '작업 기록이 없으면 일정만');
      assert.equal(r.created, false, '읽기만 — state.workLogs 를 만들지 않는다');
      assert.ok(r.same, '저장본 그대로');
    });

    await test('② 현장 고르기 시트 — 맨 위 오늘 줄 · 아래 목록 그대로 · 검색 중 숨김 · 누르면 그 현장 (SHEET)', async () => {
      const before = await page.evaluate(snap);
      await page.evaluate(() => openProjectSheet());
      await page.locator('#psToday [data-ps-today]').first().waitFor({ state: 'visible' });
      const r = await page.evaluate(() => {
        const sh = document.getElementById('projSheet'), strip = document.getElementById('psToday'), list = document.getElementById('psList');
        return {
          today: [...strip.querySelectorAll('[data-ps-today]')].map(b => b.dataset.psToday),
          work: [...strip.querySelectorAll('[data-ps-today]')].filter(b => /⏱ 작업 중/.test(b.textContent)).map(b => b.dataset.psToday),
          pressed: [...strip.querySelectorAll('[aria-pressed="true"]')].length,
          rows: [...list.querySelectorAll('.ps-row')].map(b => b.dataset.psel),
          pselInSheet: sh.querySelectorAll('button[data-psel]').length, pselInList: list.querySelectorAll('button[data-psel]').length,
          above: strip.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
          heading: strip.querySelector('.hj-today-h').textContent, label: strip.getAttribute('aria-labelledby'),
          over: document.documentElement.scrollWidth - document.documentElement.clientWidth, sheetOver: sh.scrollWidth - sh.clientWidth
        };
      });
      assert.deepEqual(r.today, TODAY);
      assert.deepEqual(r.work, ['라온주택'], '작업 중 표시');
      assert.equal(r.pressed, 0, '지금 골라진 바다아파트는 오늘 현장이 아니라 눌린 칩 없음');
      assert.deepEqual(r.rows, LIST, '아래 목록 순서 그대로 — ' + JSON.stringify(r.rows));
      assert.equal(r.pselInSheet, r.pselInList, '오늘 줄 단추는 [data-psel] 이 아니다');
      assert.ok(r.above, '오늘 줄은 목록 위');
      assert.match(r.heading, /오늘 일정 현장/); assert.equal(r.label, 'psTodayH');
      assert.ok(r.over <= 1 && r.sheetOver <= 1, '가로 넘침 없음 ' + JSON.stringify(r));
      const sizes = await tapSizes(page, '#psToday [data-ps-today]');
      assert.deepEqual(sizes.filter(x => x[1] < 44 || x[2] < 44), [], '44px ' + JSON.stringify(sizes));
      await page.fill('#psSearch', '바다');
      await page.waitForFunction(() => document.getElementById('psToday').hidden && document.getElementById('psToday').getClientRects().length === 0);
      assert.deepEqual(await page.locator('#psList .ps-row').evaluateAll(es => es.map(e => e.dataset.psel)), ['바다아파트'], '검색 결과는 목록에서');
      await page.fill('#psSearch', '');
      await page.waitForFunction(() => !document.getElementById('psToday').hidden && document.getElementById('psToday').getClientRects().length > 0);
      await page.locator('#psToday [data-ps-today="가온아파트"]').click();
      await sheetGone(page);
      assert.deepEqual(await page.evaluate(() => [state.activeProject, state.tab]), ['가온아파트', 'project'], '목록 행과 같은 동작');
      await page.evaluate(() => openProjectSheet());
      await page.locator('#psToday [data-ps-today]').first().waitFor({ state: 'visible' });
      const again = await page.evaluate(() => [...document.querySelectorAll('#psToday [aria-pressed="true"]')].map(b => [b.dataset.psToday, /지금 현장/.test(b.textContent)]));
      assert.deepEqual(again, [['가온아파트', true]], '다시 열면 지금 현장 표시');
      await page.locator('#projSheetClose').click(); await sheetGone(page);
      const after = await page.evaluate(snap);
      const changed = (a, b) => { const x = JSON.parse(a), y = JSON.parse(b); return Object.keys(Object.assign({}, x, y)).filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k])); };
      assert.deepEqual(changed(before, after), [], '현장 고르기 말고 저장 자료 변화 없음');
    });

    await test('③ 촬영 시트 — 오늘 줄 · 목록 순서 그대로 · 검색 중 숨김 · 누르면 그 현장으로 카메라 · 골라져 있으면 바로 카메라 (CAMERA)', async () => {
      await page.evaluate(() => { state.activeProject = null; state.tab = 'dashboard'; render(); syncMobileNav(); const old = document.getElementById('camInput'); if (old) old.remove(); });
      await page.locator('[data-mnav="__camera"]').click();
      await page.locator('#cameraToday [data-camera-today]').first().waitFor({ state: 'visible' });
      const r = await page.evaluate(() => {
        const strip = document.getElementById('cameraToday'), list = document.getElementById('cameraProjectList');
        return { today: [...strip.querySelectorAll('[data-camera-today]')].map(b => b.dataset.cameraToday),
          rows: [...document.querySelectorAll('[data-camera-project]')].map(b => b.dataset.cameraProject),
          above: strip.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING, active: state.activeProject, cam: !!document.getElementById('camInput') };
      });
      assert.deepEqual(r.today, TODAY);
      assert.deepEqual(r.rows, LIST, '촬영 목록 순서 그대로');
      assert.ok(r.above, '오늘 줄은 목록 위');
      assert.deepEqual([r.active, r.cam], [null, false], '고르기 전엔 현장·카메라 그대로');
      const sizes = await tapSizes(page, '#cameraToday [data-camera-today]');
      assert.deepEqual(sizes.filter(x => x[1] < 44 || x[2] < 44), [], '44px ' + JSON.stringify(sizes));
      await page.fill('#cameraProjectSearch', '라온');
      await page.waitForFunction(() => document.getElementById('cameraToday').getClientRects().length === 0);
      await page.fill('#cameraProjectSearch', '');
      await page.waitForFunction(() => document.getElementById('cameraToday').getClientRects().length > 0);
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#cameraToday [data-camera-today="나래빌라"]').click();
      await chooser;
      assert.deepEqual(await page.evaluate(() => [state.activeProject, !!document.getElementById('cameraProjectSheet')]), ['나래빌라', false], '고른 현장으로 카메라');
      await sheetGone(page);
      // 골라져 있으면 시트 없이 바로 카메라(탭 수 그대로) — 사진 추가 확인 창의 경고가 대신 잡는다
      await page.evaluate(() => { state.activeProject = '바다아파트'; const old = document.getElementById('camInput'); if (old) old.remove(); });
      const direct = page.waitForEvent('filechooser');
      await page.locator('[data-mnav="__camera"]').click();
      await direct;
      assert.equal(await page.locator('#cameraProjectSheet').count(), 0, '골라져 있으면 시트 없음');
    });

    await test('④ 사진 추가 확인 창 — 오늘 현장 칩 · 촬영·공유 사진이 오늘 현장 밖이거나 ⏱ 현장이 따로 있으면 경고(막지 않음) · 7곳 이상 · 저장 없음 (INTAKE)', async () => {
      const openIntake = (source, project) => page.evaluate(([source, project]) => {
        closeModal(true);
        return openPhotoIntake([new File([new Uint8Array([255, 216, 255, 217])], 'cam.jpg', { type: 'image/jpeg' })], { project, source });
      }, [source, project]);
      const view = () => page.evaluate(() => {
        const sel = document.getElementById('photoIntakeProject'), warn = document.getElementById('photoIntakeTodayWarn'), more = document.querySelector('#photoIntakeToday [data-today-more]');
        return { picked: sel.value === 'none' ? 'none' : sel.value === '' ? '' : sel.options[sel.selectedIndex].textContent,
          chips: [...document.querySelectorAll('#photoIntakeToday [data-intake-today]')].map(b => b.dataset.intakeToday),
          work: [...document.querySelectorAll('#photoIntakeToday [data-intake-today]')].filter(b => /⏱ 작업 중/.test(b.textContent)).map(b => b.dataset.intakeToday),
          pressed: [...document.querySelectorAll('#photoIntakeToday [aria-pressed="true"]')].map(b => b.dataset.intakeToday),
          warn: warn && !warn.hidden && warn.getClientRects().length ? warn.textContent : '', kind: warn ? warn.dataset.intakeTodayWarn || '' : '',
          more: more ? more.textContent : '', issue: document.getElementById('photoIntakeIssue').textContent, described: sel.getAttribute('aria-describedby') };
      });
      const before = await page.evaluate(snap);
      assert.equal(await openIntake('camera', '바다아파트'), true);
      let v = await view();
      assert.equal(v.picked, '바다아파트', '골라져 있던 현장은 그대로 미리 골라 둔다');
      assert.deepEqual(v.chips, TODAY);
      assert.deepEqual(v.work, ['라온주택'], '칩에도 ⏱ 작업 중 표시');
      assert.equal(v.more, '', '오늘 현장이 6곳 이하면 외 n곳 안내 없음');
      assert.equal(v.kind, 'out');
      assert.match(v.warn, /^⚠ 오늘 일정 현장은 라온주택 · 가온아파트 · 나래빌라 — .*맞는지 확인/, '촬영 사진이 오늘 현장 밖이면 경고 — ' + v.warn);
      assert.match(v.described, /photoIntakeTodayWarn/, '경고는 현장 칸 설명으로 이어진다');
      const sizes = await tapSizes(page, '#photoIntakeToday [data-intake-today]');
      assert.deepEqual(sizes.filter(x => x[1] < 44 || x[2] < 44), [], '44px ' + JSON.stringify(sizes));
      assert.ok(await page.locator('#modalRoot .modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1), '창 가로 넘침 없음');
      // 현장 칸 위 '현장 검색'으로 목록을 줄여 둔 채 칩을 눌러도 그 현장이 골라진다
      await page.fill('#photoIntakeForm .project-select-search input[type="search"]', '바다');
      assert.equal(await page.locator('#photoIntakeProject option').filter({ hasText: '라온주택' }).count(), 0, '검색으로 목록이 줄었다');
      await page.locator('#photoIntakeToday [data-intake-today="라온주택"]').click();
      v = await view();
      assert.deepEqual([v.picked, v.pressed, v.warn, v.kind], ['라온주택', ['라온주택'], '', ''], '칩 → 칸 값만 · ⏱ 작업 중 현장이면 경고 없음');
      assert.equal(await page.inputValue('#photoIntakeForm .project-select-search input[type="search"]'), '', '현장 검색은 비워진다');
      assert.equal(await page.evaluate(() => state.activeProject), '바다아파트', '칩은 지금 현장을 바꾸지 않는다');
      // 하루 두세 현장 — 앞서 들른 오늘 현장(가온아파트)이 골라진 채 ⏱ 작업 중인 라온주택에서 찍으면 경고
      await page.selectOption('#photoIntakeProject', { label: '가온아파트' });
      v = await view();
      assert.equal(v.kind, 'work');
      assert.match(v.warn, /^⚠ 지금 ⏱ 작업 중인 현장은 라온주택 — .*맞는지 확인/, '오늘 현장이어도 ⏱ 현장이 따로 있으면 경고 — ' + v.warn);
      await page.selectOption('#photoIntakeProject', { label: '바다아파트' });
      v = await view(); assert.ok(v.kind === 'out' && v.warn && !v.pressed.length, '다시 오늘 현장 밖 → 경고 · 눌린 칩 없음');
      await page.selectOption('#photoIntakeProject', 'none');
      v = await view(); assert.equal(v.warn, '', '미배정은 경고 없음');
      await page.selectOption('#photoIntakeProject', '');
      v = await view(); assert.equal(v.warn, '', '빈칸은 경고 없음');
      // 빈칸으로 [추가] → '현장을 선택해 주세요' 글 → 칩을 누르면 그 글이 지워진다
      await page.locator('#photoIntakeConfirm').click();
      v = await view(); assert.match(v.issue, /현장을 선택해/, '빈칸 [추가]는 막히고 글이 뜬다 — ' + v.issue);
      await page.locator('#photoIntakeToday [data-intake-today="나래빌라"]').click();
      v = await view();
      assert.deepEqual([v.picked, v.issue, v.kind], ['나래빌라', '', 'work'], '칩을 누르면 오류 글이 지워진다');
      // 막지 않는다 — 경고가 떠 있어도 [추가]는 고른 현장 그대로 진행한다
      await page.selectOption('#photoIntakeProject', { label: '바다아파트' });
      await page.evaluate(() => { window.__ran = null; runPhotoIntake = async (files, approved) => { window.__ran = { project: approved.project, source: approved.source, n: files.length }; __photoIntakeBusy = false; closeModal(true); }; });
      await page.locator('#photoIntakeConfirm').click();
      await page.waitForFunction(() => !!window.__ran);
      assert.deepEqual(await page.evaluate(() => window.__ran), { project: '바다아파트', source: 'camera', n: 1 }, '경고는 막지 않는다');
      for (const [source, project, kind] of [['share', '바다아파트', 'out'], ['gallery', '바다아파트', ''], ['camera', '가온아파트', 'work'], ['camera', '라온주택', ''],
        ['share', '나래빌라', 'work'], ['gallery', '가온아파트', ''], ['camera', null, '']]) {
        assert.equal(await openIntake(source, project), true);
        v = await view();
        assert.deepEqual(v.chips, TODAY, source + ' 칩');
        assert.deepEqual([v.kind, !!v.warn], [kind, !!kind], source + '/' + project + ' 경고 ' + kind + ' — ' + v.warn);
      }
      // 오늘 현장 7곳(⏱ 없음) — 칩은 6곳 + '외 1곳' 안내, 7번째 현장을 골라도 경고 없음, 경고 글의 '외 n곳'은 전체로 센다
      const seven = await page.evaluate(() => {
        closeModal(true); state.workLogs = [];
        ['다솜상가', '아라아파트', '자두빌라', '차오름', '하늘아파트'].forEach((n, i) => state.schedule.push({ id: 'c' + i, date: '2026-11-11', time: String(11 + i) + ':00', title: '보수', project: n, workers: '', hours: 1, memo: '', report: null }));
        return hjTodaySiteNames();
      });
      assert.equal(seven.length, 7, '오늘 현장 7곳 — ' + JSON.stringify(seven));
      assert.equal(await openIntake('camera', seven[6]), true);
      v = await view();
      assert.deepEqual([v.chips, v.picked, v.kind, v.warn], [seven.slice(0, 6), seven[6], '', ''], '7번째 오늘 현장 — 칩엔 없지만 경고 없음');
      assert.match(v.more, /외 1곳/, '칩 밖 오늘 현장 안내 — ' + v.more);
      assert.equal(await openIntake('camera', '바다아파트'), true);
      v = await view();
      assert.match(v.warn, /^⚠ 오늘 일정 현장은 .+ 외 4곳 — /, '외 n곳은 전체 7곳에서 센다 — ' + v.warn);
      await page.evaluate(() => { closeModal(true); openProjectSheet(); });
      await page.locator('#psToday [data-ps-today]').first().waitFor({ state: 'visible' });
      assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('#psToday [data-ps-today]').length, (document.querySelector('#psToday [data-today-more]') || {}).textContent || '']),
        [6, '오늘 현장 외 1곳은 아래 목록·검색에서 고르세요'], '시트도 6곳 + 외 n곳 안내');
      await page.locator('#projSheetClose').click(); await sheetGone(page);
      await page.evaluate(() => { state.schedule = []; state.workLogs = []; });
      assert.equal(await openIntake('camera', '바다아파트'), true);
      v = await view();
      assert.deepEqual([v.chips, v.warn, await page.locator('#photoIntakeToday').count()], [[], '', 0], '오늘 현장이 없으면 칩·경고 없음');
      await page.evaluate(() => closeModal(true));
      const after = await page.evaluate(snap);
      const keys = (a, b) => { const x = JSON.parse(a), y = JSON.parse(b); return Object.keys(Object.assign({}, x, y)).filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k])); };
      assert.deepEqual(keys(before, after).sort(), ['schedule', 'workLogs'], '창은 저장하지 않는다(일정·작업 기록은 검사가 바꾼 것)');
    });

    await test('⑤ 폰 360 · 긴 이름 · 큰 글씨 — 가로 넘침 없음 · 44px · 입력 16px (PHONE)', async () => {
      const m = await open(360);
      await m.page.evaluate(SEED);
      await m.page.evaluate(() => {
        const long = '아주아주긴이름의한빛마을아파트101동1202호욕실전체리모델링현장';
        state.projects.push({ name: long, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: {}, archived: false });
        state.schedule.push({ id: 'sL', date: '2026-11-11', time: '13:00', title: '욕실', project: long, hours: 4, memo: '', report: null });
        render();
      });
      const check = async (sel, label) => {
        const r = await m.page.evaluate(sel => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          box: [...document.querySelectorAll(sel)].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.height)]; }) }), sel);
        assert.ok(r.over <= 1, label + ' 넘침 ' + r.over);
        assert.ok(r.box.length === 4 && r.box.every(b => b[0] >= 0 && b[1] <= 360 && b[2] >= 44), label + ' 칩 ' + JSON.stringify(r.box));
      };
      await m.page.evaluate(() => openProjectSheet());
      await m.page.locator('#psToday [data-ps-today]').first().waitFor({ state: 'visible' });
      await check('#psToday [data-ps-today]', '현장 고르기');
      assert.ok(await m.page.locator('#projSheet').evaluate(e => e.scrollWidth <= e.clientWidth + 1), '시트 넘침 없음');
      await m.page.locator('#projSheetClose').click(); await sheetGone(m.page);
      await m.page.evaluate(() => { state.activeProject = null; openCamera(); });
      await m.page.locator('#cameraToday [data-camera-today]').first().waitFor({ state: 'visible' });
      await check('#cameraToday [data-camera-today]', '촬영');
      await m.page.evaluate(() => closeCameraProjectSheet()); await sheetGone(m.page);
      await m.page.evaluate(() => openPhotoIntake([new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })], { project: '바다아파트', source: 'camera' }));
      await check('#photoIntakeToday [data-intake-today]', '사진 추가');
      const f = await m.page.evaluate(() => ({ modal: document.querySelector('#modalRoot .modal').scrollWidth - document.querySelector('#modalRoot .modal').clientWidth,
        font: parseFloat(getComputedStyle(document.getElementById('photoIntakeProject')).fontSize), warn: document.getElementById('photoIntakeTodayWarn').textContent }));
      assert.ok(f.modal <= 1 && f.font >= 16, '창 넘침·입력 글자 ' + JSON.stringify(f));
      assert.match(f.warn, /외 1곳/, '오늘 현장이 넷이면 경고는 셋까지 · 외 1곳 — ' + f.warn);
      // 큰 글씨 2단계 — 칩 이름은 전역 단추 규칙으로, 머리글·⏱ 작은 글·경고 줄은 따로 커진다(아래 목록 .ps-meta 14px 와 같은 방식)
      const big = await m.page.evaluate(() => {
        document.body.classList.add('a11y-big2'); closeModal(true);
        openPhotoIntake([new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })], { project: '바다아파트', source: 'camera' });
        const fs = el => parseFloat(getComputedStyle(el).fontSize), modal = document.querySelector('#modalRoot .modal');
        const r = { warn: fs(document.getElementById('photoIntakeTodayWarn')), head: fs(document.getElementById('photoIntakeTodayH')),
          small: fs(document.querySelector('#photoIntakeToday small')), chip: fs(document.querySelector('#photoIntakeToday .hj-today-n')),
          over: modal.scrollWidth - modal.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        closeModal(true); document.body.classList.remove('a11y-big2');
        return r;
      });
      assert.ok(big.warn >= 18 && big.head >= 17 && big.small >= 14 && big.chip >= 17 && big.over <= 1 && big.doc <= 1, '큰 글씨 ' + JSON.stringify(big));
      await m.page.evaluate(() => { document.body.classList.add('a11y-big2'); openPhotoIntake([new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })], { project: '바다아파트', source: 'camera' }); });
      await check('#photoIntakeToday [data-intake-today]', '사진 추가(큰 글씨)');
      await m.page.evaluate(() => { closeModal(true); document.body.classList.remove('a11y-big2'); });
      await m.page.evaluate(() => closeModal(true));
      await m.context.close();
    });

    await test('⑥ 핀(세 곳 같음) · 페이지 오류 0 · 바깥 쓰기 0', async () => {
      const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const C='(hyeonjang-v\d+-[^']+)'/)[1];
      const pin = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8').match(/TARGET_BUILD = '(hyeonjang-v\d+-[^']+)'/)[1];
      assert(sw === pin && SRC.includes("const APP_BUILD='" + sw + "'"), 'pins equal ' + [sw, pin].join(' / '));
      assert.deepEqual(errors, []); assert.equal(network.writes, 0);
    });
    await context.close();
    console.log(`todaysite-v585: ${passed}/${passed} PASS; synthetic data; external writes=${network.writes}`);
  } catch (error) { console.error('FAIL todaysite-v585', error.stack || error); process.exitCode = 1; }
  finally { if (browser) await browser.close(); }
})();

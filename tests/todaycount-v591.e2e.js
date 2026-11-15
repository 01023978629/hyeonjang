/* v591 '오늘 일정'을 세는 나머지 아홉 곳에도 여러 날 공정의 이어지는 날
   문제(기준선): v586 이 🤖 오늘 챙길 일·한눈 보기·하단 캘린더 배지·☀️ 브리핑을 hjTodaySchRows/hjDaySchView(오늘 시작 + 이어지는 날)로 바꿨지만,
   AI get_overview·🔔 스마트 알림(hjNotifyItems)·📅 일정 브리핑(todayScheduleBrief)·🤖 능동 브리핑(aiActiveBriefData)·🗣 음성 브리핑(ttsBriefText)·
   운영 루프 계획(aiPlannerScan)·☀️ 운영 일일 브리핑(aiOpsDailyBrief)·🗺 오늘 동선(routeToday)·🧠 AI 브레인(aiOpsBrain)은 date===오늘만 세어
   3일짜리 공정 둘째 날이 빠졌다(🗺 동선은 오늘 그 현장에 가는데도 '1곳뿐'). 🔔 알림 시각 알림(hjAlertTodayHtml)은 시작 시각 알림이라 그대로.
   합성 자료(이름은 지어낸 것), 시계 2026-11-11(수) 10:00 고정, 바깥 쓰기 0.
   ① 아홉 곳 모두 어제 시작한 3일 공정을 오늘 '(2/3일째)'로 셈 · 원본 일정은 그대로 (CONT)
   ② 거르던 것은 그대로 — 💰 수금은 거르던 여덟 곳에서 이어지는 날까지 빠지고, 거르지 않던 get_overview 는 예전처럼 셈(aiBriefData 와 같은 목록) ·
      완료 보고된 공정·내일 일정 없음 · get_overview 수 = 🤖 오늘 챙길 일(hjTodaySchRows), 💰 를 거르는 여덟 곳 = 그중 💰 를 뺀 수(일부러 다르다) ·
      아홉 곳을 다 불러도 저장 자료 한 글자도 안 바뀜 (FILTER)
   ③ 일요일은 이어지는 날이 아님(hjSchContOn 과 같은 셈) — 토요일 시작 3일 공정: 일요일엔 아홉 곳 모두 없음, 월요일엔 모두 '(2/3일째)' · 페이지 오류 0 · 외부 쓰기 0 (SUNDAY)
   ④ 검토에서 찾은 것 (REVIEW) — 1일째 저녁에 진행 중 보고(🎙·[기록]·AI 일지가 쓰는 workLogSave '진행', 📋 일일 작업 보고 '진행중')를 남긴 공정도
      다음 날 아홉 곳·🤖 오늘 챙길 일·달력(hjSchContDates)에 이어지는 날로 나옴, 진행률 없이 글만 있는 옛 보고는 예전처럼 끝난 것 ·
      두 현장 09:00 여러 날 공정(담당 다름)이 겹쳐도 운영 루프 계획에 '일정 충돌'이 생기지 않음(🔍 일정 점검과 같음) ·
      현장 없는 여러 날 일정은 🗺 동선 방문지가 아님 · 긴 공정 이름도 🤖 능동·🗣 음성·AI get_overview 에서 '몇째 날'이 잘리지 않음(🗣 은 '4일 중 3일째')
   HJ_V591_BASELINE=<commit> 은 ① 에서, HJ_V591_MUTATION=overview-old·notify-old·brief-old·active-old·tts-old·planner-old·opsdaily-old·route-old·brain-old
   (아홉 곳을 하나씩 예전 date===오늘 줄로 되돌림)는 ①,
   no-money(💰 거르기를 뺌)·overview-money(get_overview 가 💰 를 새로 거름)는 ②,
   cont-reported·contdates-reported(진행 중 보고도 끝난 것으로 — v354 옛 줄)·going-legacy(글만 있는 옛 보고도 이어짐)·planner-conflict-cont(이어지는 날도
   시각 겹침으로 셈)·route-noproject(🗺 현장 거르기 뺌)·active-cut·overview-cut(제목을 꼬리째 자름)은 ④, tts-cut 은 ① 에서(🗣 은 '3일 중 2일째') 실패해야 한다. */
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
  'notify-old': ["  hjDaySchNoMoney(today).forEach(s=>{", "  (state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||'')).forEach(s=>{"],
  'route-old': ["  const sch=hjDaySchView(date,s=>!!s.project&&!HJ_MONEY_SCH_RE.test(String(s.title||'')));", "  const sch=(state.schedule||[]).filter(s=>s.date===date&&s.project&&!/^💰/.test(s.title||''));"],
  'brain-old': ["  const todaySch=hjDaySchNoMoney(aiOpsTodayKey()).length;", "  const todaySch=(state.schedule||[]).filter(s=>s.date===aiOpsTodayKey()&&!/^💰/.test(s.title||'')).length;"],
  'planner-old': ["      const todaySch=hjDaySchNoMoney(today);", "      const todaySch=(state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||''));"],
  'overview-old': ['      const ts=hjDaySchView(today).sort(', '      const ts=(state.schedule||[]).filter(s=>s.date===today).sort('],
  'brief-old': ["  const list=hjDaySchNoMoney(today).sort(", "  const list=(state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||'')).sort("],
  'active-old': ["  const sch=hjDaySchNoMoney(today).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));   // v591 이어지는 날 포함\n  if(sch.length){const f=sch[0];",
    "  const sch=(state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||'')).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));\n  if(sch.length){const f=sch[0];"],
  'tts-old': ["  const sch=hjDaySchNoMoney(today).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));   // v591 이어지는 날 포함\n  if(sch.length){\n",
    "  const sch=(state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||'')).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));\n  if(sch.length){\n"],
  'opsdaily-old': ["  const sch=hjDaySchNoMoney(today).sort((a,b)=>String(a.time).localeCompare(String(b.time)));", "  const sch=(state.schedule||[]).filter(s=>s.date===today&&!/^💰/.test(s.title||'')).sort((a,b)=>String(a.time).localeCompare(String(b.time)));"],
  'no-money': ["function hjDaySchNoMoney(day){return hjDaySchView(day,s=>!HJ_MONEY_SCH_RE.test(String(s.title||'')));}", 'function hjDaySchNoMoney(day){return hjDaySchView(day);}'],
  'overview-money': ['      const ts=hjDaySchView(today).sort(', '      const ts=hjDaySchNoMoney(today).sort('],
  'cont-reported': ['  if(!s||!s.date||!(ymd>s.date)||hjSchContEnded(s))return null;', '  if(!s||!s.date||!(ymd>s.date)||hjSchReported(s))return null;'],
  'contdates-reported': ['  if(!s||!s.date||hjSchContEnded(s))return [];', '  if(!s||!s.date||hjSchReported(s))return [];'],
  'going-legacy': ["function hjSchContEnded(s){return hjSchReported(s)&&!HJ_SCH_GOING_RE.test(String(s.report.progress||'').trim());}", "function hjSchContEnded(s){return !!(s&&s.report&&s.report.progress==='완료');}"],
  'planner-conflict-cont': ['todaySch.filter(s=>!s._cont).concat(tmrSch)', 'todaySch.concat(tmrSch)'],
  'route-noproject': ["hjDaySchView(date,s=>!!s.project&&!HJ_MONEY_SCH_RE.test(", "hjDaySchView(date,s=>!HJ_MONEY_SCH_RE.test("],
  'active-cut': ["'('+f.time+' '+hjDaySchCutTitle(f,10)+' 등)'", "'('+f.time+' '+hjCut(f.title,10)+' 등)'"],
  'tts-cut': ['hjDaySchCutTitle(s,20,true)', "hjCut(s.title||'',20)"],
  'overview-cut': ['제목:s._cont?hjDaySchCutTitle(s,40):cut(s.title)', '제목:cut(s.title)']
};
let html = process.env.HJ_V591_BASELINE ? execFileSync('git', ['show', process.env.HJ_V591_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V591_MUTATION) {
  const m = MUT[process.env.HJ_V591_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V591_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor'); html = SRC.replace(m[0], m[1]);
}

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS todaycount-v591 ' + name); }
async function open(width) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now()));
    localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); localStorage.setItem('hj_morning_shown', '2026-11-11');
    localStorage.setItem('hj_active_brief', '2026-11-11');
    window.__v591 = { prompts: [] };
  });
  await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async keys => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    // 🧠 AI 브레인은 AI 키가 있어야 돈다 — 바깥 AI 대신 받은 질문만 적어 둔다. 브레인이 원래 남기는 운영 기록(aiOpsLog)은 이 판과 무관한 쓰기라 끈다
    aiKeyReady = () => true; aiAsk = async p => { __v591.prompts.push(String(p)); return '1. 가\n2. 나\n3. 다'; }; aiOpsLog = () => {};
  }, BOOT);
  return { context, page };
}
const SEED = () => {
  closeModal(true);
  // 🗺 동선은 좌표 있는 현장만 센다 — 네 현장 모두 좌표를 준다(현장이 빠지면 그 까닭은 일정 쪽이다)
  const P = (name, lat, lng) => ({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: '' }, archived: false, lat, lng });
  state.projects = [P('가온아파트', 36.35, 127.38), P('나래빌라', 36.32, 127.42), P('다솜상가', 36.30, 127.45), P('라온주택', 36.36, 127.33)];
  state.notes = []; state.payLog = []; state.expenses = []; state.files = []; state.asLog = []; state.workLogs = []; state.quotes = []; state._demo = false; state.dirHandle = null;
  __tabStale = false; state.editingQuote = null;
  const S = (id, date, time, title, extra) => Object.assign({ id, date, time, title, project: '', workers: '', hours: 8, memo: '', report: null }, extra || {});
  state.schedule = [
    S('MULTI', '2026-11-10', '09:00', '타일 (3일차 시작)', { project: '가온아파트', memo: '2026-11-10~2026-11-12 (3일)' }),
    S('DONE3', '2026-11-10', '08:00', '도배 (3일차 시작)', { project: '다솜상가', memo: '2026-11-10~2026-11-12 (3일)', report: { progress: '완료', done: '도배 끝' } }),
    S('MONEYM', '2026-11-10', '07:00', '💰 분할 수금 (3일차 시작)', { project: '라온주택', memo: '2026-11-10~2026-11-12 (3일)', hours: 0 }),
    S('TODAY', '2026-11-11', '13:00', '실리콘 보수', { project: '나래빌라', hours: 0 }),
    S('MONEY', '2026-11-11', undefined, '💰 수금: 라온주택', { project: '라온주택', hours: 0 }),
    S('LATER', '2026-11-12', '09:00', '줄눈', { project: '가온아파트', hours: 0 }),
    // 토요일 시작 3일 공정 — 일요일(11/15)은 쉬고 월요일(11/16)이 2일째(🗓 공정표 셈)
    S('WKND', '2026-11-14', '08:30', '목공 (3일차 시작)', { project: '가온아파트', memo: '2026-11-14~2026-11-17 (3일)' })];
  state.activeProject = null; state.tab = 'dashboard'; state.search = '';
  render();
};
// 아홉 곳을 그대로 부른다 — 각자 자기 꼴의 결과에서 '오늘 일정' 부분만 꺼낸다
const COLLECT = async () => {
  const out = {};
  const ov = await aiToolRun('get_overview', {});
  out.overview = (ov.오늘일정 || []).map(x => (x.시간 ? x.시간 + ' ' : '') + x.제목 + ' @' + x.현장);
  out.notify = hjNotifyItems().filter(i => String(i.key).startsWith('sch-')).map(i => i.key + '|' + i.title).sort();
  const tb = todayScheduleBrief(); out.brief = { n: tb.count, rows: tb.list.map(r => r.sch.id + '|' + (r.sch.time || '') + ' ' + r.sch.title) };
  const ab = aiActiveBriefData(); out.active = { part: ab.parts.find(p => p.startsWith('오늘 일정')) || '', urgent: (ab.urgent.find(u => u.ic === '🗓') || {}).t || '' };
  out.tts = ttsBriefText();
  const bt = aiPlannerScan('daily').find(t => t.type === 'brief_today'); out.planner = bt ? bt.title + ' | ' + bt.reason : '';
  const od = aiOpsDailyBrief(); out.opsDaily = { v: (od.lines.find(l => l.h === '📅 오늘 일정') || {}).v || '', summary: od.summary };
  const rt = await routeToday();
  out.route = { n: rt.현장수, names: [...document.querySelectorAll('#modalRoot b')].map(b => b.textContent.trim()).filter(t => /주택|빌라|상가|아파트/.test(t)).sort(),
    nocoord: ((document.querySelector('#modalRoot') || {}).textContent || '').includes('위치 정보') };
  closeModal(true);
  __v591.prompts = []; const br = await aiOpsBrain();
  out.brain = { ok: br.브레인, line: ((__v591.prompts[0] || '').match(/- 오늘 일정: \d+건/) || [''])[0] };
  closeModal(true);
  return out;
};
const snap = page => page.evaluate(async () => { clearTimeout(__idbSaveTimer); const live = serializeData(); live.savedAt = ''; return paidStableJson(live); });

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await page.evaluate(SEED);
    let r;
    await test('① 아홉 곳 모두 어제 시작한 3일 공정을 오늘 (2/3일째)로 셈 · 원본 일정은 그대로 (CONT)', async () => {
      const before = await snap(page);
      r = await page.evaluate(COLLECT);
      // ① 은 '이어지는 날이 들어왔나'만 본다(수가 정확한지·💰 를 거르는지는 ②) — 수만 내보이는 곳은 시작하는 일정(실리콘 보수 1건)보다 많아야 한다
      const T = '타일 (2/3일째)', N = t => +((String(t).match(/(\d+)건/) || [])[1] || 0);
      assert.ok(r.overview.includes('09:00 ' + T + ' @가온아파트'), 'AI get_overview 오늘일정 — ' + JSON.stringify(r.overview));
      assert.ok(r.notify.includes('sch-MULTI|오늘 일정: 09:00 ' + T), '🔔 스마트 알림 — ' + JSON.stringify(r.notify));
      assert.ok(r.brief.rows.includes('MULTI|09:00 ' + T), '📅 일정 브리핑 — ' + JSON.stringify(r.brief));
      assert.ok(N(r.active.part) >= 2 && N(r.active.urgent) >= 2, '🤖 능동 브리핑 — ' + JSON.stringify(r.active));
      assert.ok(r.tts.includes('09:00 가온아파트 타일 3일 중 2일째'), '🗣 음성 브리핑(귀로 듣는 꼴 — 3일 중 2일째) — ' + r.tts);
      assert.ok(N(r.planner) >= 2, '운영 루프 계획 — ' + r.planner);
      assert.ok(r.opsDaily.v.split('\n').includes('09:00 가온아파트'), '☀️ 운영 일일 브리핑 — ' + JSON.stringify(r.opsDaily));
      assert.ok(r.route.names.includes('가온아파트'), '🗺 오늘 동선 — 이어지는 날도 그 현장에 가는 날 — ' + JSON.stringify(r.route));
      assert.ok(N(r.brain.line) >= 2, '🧠 AI 브레인 — ' + JSON.stringify(r.brain));
      const orig = await page.evaluate(() => { const s = state.schedule.find(x => x.id === 'MULTI'); return { title: s.title, date: s.date, cont: '_cont' in s }; });
      assert.deepEqual(orig, { title: '타일 (3일차 시작)', date: '2026-11-10', cont: false }, '원본 일정은 복사본 제목·날짜를 받지 않는다');
      assert.equal(await snap(page), before, '아홉 곳을 불러도 저장 자료 그대로');
    });
    await test('② 거르던 것은 그대로 — 💰·완료 보고·내일 일정 · get_overview 수 = hjTodaySchRows, 여덟 곳 = 💰 뺀 수 (FILTER)', async () => {
      // get_overview 는 예전부터 💰 도 셌다 — 이어지는 날까지 같이(🌅 브리핑 aiBriefData 와 같은 목록). 시각 없는 일정이 먼저(예전 정렬)
      assert.deepEqual(r.overview, ['💰 수금: 라온주택 @라온주택', '07:00 💰 분할 수금 (2/3일째) @라온주택', '09:00 타일 (2/3일째) @가온아파트', '13:00 실리콘 보수 @나래빌라'],
        'get_overview — ' + JSON.stringify(r.overview));
      const ref = await page.evaluate(() => {
        const all = hjTodaySchRows(localDate()), work = all.filter(x => !String(x.s.title || '').startsWith('💰'));
        return { all: all.length, work: work.length, brief: aiBriefData().오늘일정.length };
      });
      assert.deepEqual(ref, { all: 4, work: 2, brief: 4 }, '기준 수 — ' + JSON.stringify(ref));
      assert.equal(r.overview.length, ref.all, 'get_overview 수 = 🤖 오늘 챙길 일(hjTodaySchRows) 수');
      assert.deepEqual(r.notify, ['sch-MULTI|오늘 일정: 09:00 타일 (2/3일째)', 'sch-TODAY|오늘 일정: 13:00 실리콘 보수'], '🔔 💰·완료 보고·내일 없음 — ' + JSON.stringify(r.notify));
      assert.deepEqual(r.brief, { n: 2, rows: ['MULTI|09:00 타일 (2/3일째)', 'TODAY|13:00 실리콘 보수'] }, '📅 일정 브리핑 — ' + JSON.stringify(r.brief));
      assert.deepEqual(r.active, { part: '오늘 일정 2건(09:00 타일 (2/3일째) 등)', urgent: '오늘 일정 2건' }, '🤖 능동 브리핑 — 첫 줄이 이어지는 날 — ' + JSON.stringify(r.active));
      assert.ok(r.tts.includes('오늘 일정은 2건입니다.') && !r.tts.includes('💰') && !r.tts.includes('도배') && !r.tts.includes('줄눈'), '🗣 — ' + r.tts);
      assert.equal(r.planner, '오늘 일정 브리핑 (2건) | 13:00 나래빌라, 09:00 가온아파트', '운영 루프 계획(예전처럼 정렬 없음 — 시작하는 일정 다음 이어지는 날) — ' + r.planner);
      assert.deepEqual(r.opsDaily, { v: '09:00 가온아파트\n13:00 나래빌라', summary: '일정 2건' }, '☀️ — ' + JSON.stringify(r.opsDaily));
      assert.deepEqual(r.route, { n: 2, names: ['가온아파트', '나래빌라'], nocoord: false }, '🗺 💰(라온주택)·완료 보고(다솜상가)는 방문지 아님 — ' + JSON.stringify(r.route));
      assert.equal(r.brain.line, '- 오늘 일정: ' + ref.work + '건');
      // 브레인 창의 '오늘 일정' 칸도 같은 수
      await page.evaluate(async () => { await aiOpsBrain(); });
      const cell = await page.evaluate(() => { const d = [...document.querySelectorAll('#modalRoot div')].find(x => x.textContent.trim() === '오늘 일정'); const b = d && d.parentElement.querySelector('b'); return b ? b.textContent : ''; });
      await page.evaluate(() => closeModal(true));
      assert.equal(cell, '2', '🧠 브레인 창 오늘 일정 칸');
      const before = await snap(page);
      await page.evaluate(COLLECT); await page.evaluate(COLLECT);
      assert.equal(await snap(page), before, '두 번 더 불러도 저장 자료 한 글자도 안 바뀜');
    });
    await test('③ 일요일은 이어지는 날이 아님 — 일요일엔 없음 · 월요일엔 아홉 곳 모두 (2/3일째) · 오류 0 · 외부 쓰기 0 (SUNDAY)', async () => {
      await page.clock.setFixedTime(new Date('2026-11-15T10:00:00+09:00'));
      const sun = await page.evaluate(COLLECT);
      const has = (x, k) => JSON.stringify(x).includes(k);
      for (const k of Object.keys(sun)) assert.ok(!has(sun[k], '목공') && !(k === 'opsDaily' && sun[k].v.includes('08:30')), '일요일 ' + k + ' 에 목공 없음 — ' + JSON.stringify(sun[k]));
      assert.equal(await page.evaluate(() => hjTodaySchRows(localDate()).length), 0, '일요일 기준 수 0');
      assert.equal(sun.brain.line, '- 오늘 일정: 0건'); assert.equal(sun.route.n, 0); assert.equal(sun.brief.n, 0);
      await page.clock.setFixedTime(new Date('2026-11-16T10:00:00+09:00'));
      const mon = await page.evaluate(COLLECT);
      const W = '목공 (2/3일째)';
      assert.deepEqual(mon.overview, ['08:30 ' + W + ' @가온아파트'], JSON.stringify(mon.overview));
      assert.deepEqual(mon.notify, ['sch-WKND|오늘 일정: 08:30 ' + W]);
      assert.deepEqual(mon.brief, { n: 1, rows: ['WKND|08:30 ' + W] });
      assert.equal(mon.active.part, '오늘 일정 1건(08:30 목공 (2/3일째) 등)');
      assert.ok(mon.tts.includes('오늘 일정은 1건입니다.') && mon.tts.includes('08:30 가온아파트 목공 3일 중 2일째'), mon.tts);
      assert.equal(mon.planner, '오늘 일정 브리핑 (1건) | 08:30 가온아파트');
      assert.deepEqual(mon.opsDaily, { v: '08:30 가온아파트', summary: '일정 1건' });
      assert.equal(mon.route.n, 1, '🗺 방문 현장 1곳');
      assert.equal(mon.brain.line, '- 오늘 일정: 1건');
      assert.equal(await page.evaluate(() => hjTodaySchRows(localDate()).map(x => x.s.id + (x.c ? ' ' + x.c.day + '/' + x.c.days : '')).join()), 'WKND 2/3', '🤖 오늘 챙길 일과 같은 셈');
      assert.deepEqual(errors, [], '페이지 오류 0 — ' + errors.join(' | '));
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await test('④ 진행 중 보고 뒤에도 이어지는 날 · 담당 다른 09:00 공정 충돌 없음 · 현장 없는 일정은 동선 아님 · 긴 이름의 몇째 날 (REVIEW)', async () => {
      // 1일째(11/10) 저녁 — 🎙 음성 일지·첫 화면 [기록]·AI add_work_log 가 부르는 workLogSave 로 '오늘 한 일' 한 줄(진행률 '진행')
      await page.clock.setFixedTime(new Date('2026-11-10T18:00:00+09:00'));
      const BASE = '주방 상부장 하부장 전체 철거 및 교체와 아일랜드 식탁 설치';   // 33자 — 🗣 20자·🤖 10자·get_overview 40자 자르기에 다 걸린다
      const logged = await page.evaluate(async base => {
        closeModal(true);
        const S = (id, date, time, title, extra) => Object.assign({ id, date, time, title, project: '', workers: '', hours: 8, memo: '', report: null }, extra || {});
        state.schedule = [
          // 📋 일일 작업 보고를 진행률 '진행중'으로 남긴 4일 공정(11/9~11/12) — 오늘(11/11) 3일째
          S('LONG', '2026-11-09', '09:00', base + ' (4일차 시작)', { project: '가온아파트', crew: '김목수', memo: '2026-11-09~2026-11-12 (4일)',
            report: { done: '상부장 철거', actualWorkers: '2', material: '', issue: '', progress: '진행중', weather: '맑음', filledAt: '2026-11-09T18:00:00.000Z' } }),
          // 같은 09:00(🗓 공정표 기본 시각), 다른 현장·다른 담당 — 아래에서 workLogSave 로 1일째 일지를 남긴다
          S('LOGGED', '2026-11-10', '09:00', '타일 (3일차 시작)', { project: '나래빌라', crew: '박타일', memo: '2026-11-10~2026-11-12 (3일)' }),
          // 현장 없는 여러 날 일정(가져온 개인 일정·현장 없는 작업일지 꼴) — 🗺 동선 방문지가 아니다
          S('NOPROJ', '2026-11-10', '10:00', '자재 정리 (3일차 시작)', { crew: '이정리', memo: '2026-11-10~2026-11-12 (3일)' }),
          // 진행률 없이 '오늘 한 작업'만 적은 옛 보고 — 예전(v354)처럼 끝난 것
          S('LEGACY', '2026-11-10', '08:00', '도배 (3일차 시작)', { project: '다솜상가', memo: '2026-11-10~2026-11-12 (3일)', report: { done: '도배 끝', progress: '' } })];
        const r = await workLogSave('나래빌라', '거실 바닥 절반 붙임', localDate());
        const s = state.schedule.find(x => x.id === 'LOGGED');
        return { 일정: r.일정, 오류: r.오류 || '', report: { done: s.report.done, progress: s.report.progress }, reported: hjSchReported(s) };
      }, BASE);
      assert.deepEqual(logged, { 일정: 'LOGGED', 오류: '', report: { done: '거실 바닥 절반 붙임', progress: '진행' }, reported: true }, '1일째 일지는 그 공정에 붙고 진행률 진행 — ' + JSON.stringify(logged));
      // 2일째(11/11) 아침
      await page.clock.setFixedTime(new Date('2026-11-11T10:00:00+09:00'));
      const before = await snap(page);
      const r = await page.evaluate(COLLECT);
      const extra = await page.evaluate(() => {
        const sc = scheduleConflicts(), today = localDate();
        return { rows: hjTodaySchRows(today).map(x => x.s.id + (x.c ? ' ' + x.c.day + '/' + x.c.days : '')).join(),
          dates: { LOGGED: hjSchContDates(state.schedule.find(x => x.id === 'LOGGED')), LONG: hjSchContDates(state.schedule.find(x => x.id === 'LONG')), LEGACY: hjSchContDates(state.schedule.find(x => x.id === 'LEGACY')) },
          conflictTask: aiPlannerScan('daily').filter(t => t.type === 'conflict').map(t => t.reason),
          check: { conflicts: sc.conflicts.filter(c => c.date === today).length, crew: sc.crewClashes.filter(c => c.date === today).length } };
      });
      assert.equal(extra.rows, 'LONG 3/4,LOGGED 2/3,NOPROJ 2/3', '🤖 오늘 챙길 일 — 진행 중 보고 두 공정은 이어지고, 글만 있는 옛 보고(LEGACY)는 끝 — ' + extra.rows);
      assert.deepEqual(extra.dates, { LOGGED: ['2026-11-11', '2026-11-12'], LONG: ['2026-11-10', '2026-11-11', '2026-11-12'], LEGACY: [] }, '달력 막대·일정 점검(hjSchContDates) — ' + JSON.stringify(extra.dates));
      const L = BASE + ' (3/4일째)';
      assert.deepEqual(r.overview, ['09:00 ' + L + ' @가온아파트', '09:00 타일 (2/3일째) @나래빌라', '10:00 자재 정리 (2/3일째) @'], 'AI get_overview — 40자에 걸려도 몇째 날이 남음 — ' + JSON.stringify(r.overview));
      assert.deepEqual(r.notify, ['sch-LOGGED|오늘 일정: 09:00 타일 (2/3일째)', 'sch-LONG|오늘 일정: 09:00 ' + L, 'sch-NOPROJ|오늘 일정: 10:00 자재 정리 (2/3일째)'], '🔔 — ' + JSON.stringify(r.notify));
      assert.deepEqual(r.brief, { n: 3, rows: ['LONG|09:00 ' + L, 'LOGGED|09:00 타일 (2/3일째)', 'NOPROJ|10:00 자재 정리 (2/3일째)'] }, '📅 — ' + JSON.stringify(r.brief));
      assert.deepEqual(r.active, { part: '오늘 일정 3건(09:00 주방 상부장 하부… (3/4일째) 등)', urgent: '오늘 일정 3건' }, '🤖 능동 브리핑 — 바탕 이름만 자르고 몇째 날을 붙임 — ' + JSON.stringify(r.active));
      assert.ok(r.tts.includes('오늘 일정은 3건입니다. 09:00 가온아파트 주방 상부장 하부장 전체 철거 및 … 4일 중 3일째 09:00 나래빌라 타일 3일 중 2일째 10:00 자재 정리 3일 중 2일째'),
        '🗣 음성 브리핑 — 20자로 잘라도 몇째 날(3일 중 N일째)이 남음 — ' + r.tts);
      assert.equal(r.planner, '오늘 일정 브리핑 (3건) | 09:00 가온아파트, 09:00 나래빌라, 10:00 자재 정리 (2/3일째)', '운영 루프 계획 — ' + r.planner);
      assert.deepEqual(extra.conflictTask, [], '두 현장 09:00 이어지는 공정(담당 다름)은 운영 루프 \'일정 충돌\'이 아님 — ' + JSON.stringify(extra.conflictTask));
      assert.deepEqual(extra.check, { conflicts: 0, crew: 0 }, '🔍 일정 점검도 충돌 없음(같은 판단) — ' + JSON.stringify(extra.check));
      assert.deepEqual(r.opsDaily, { v: '09:00 가온아파트\n09:00 나래빌라\n10:00 자재 정리 (2/3일째)', summary: '일정 3건' }, '☀️ — ' + JSON.stringify(r.opsDaily));
      assert.deepEqual(r.route, { n: 2, names: ['가온아파트', '나래빌라'], nocoord: false }, '🗺 현장 없는 일정은 방문지도 \'위치 정보 없는 현장\'도 아님 — ' + JSON.stringify(r.route));
      assert.equal(r.brain.line, '- 오늘 일정: 3건', '🧠 — ' + JSON.stringify(r.brain));
      assert.equal(await snap(page), before, '아홉 곳을 불러도 저장 자료 그대로');
      assert.deepEqual(errors, [], '페이지 오류 0 — ' + errors.join(' | '));
      assert.equal(network.writes, 0, '외부 쓰기 0');
    });
    await context.close();
  } finally { await browser.close(); }
  console.log('todaycount-v591: ' + passed + '/4 통과');
})().catch(error => { console.error(error); process.exit(1); });

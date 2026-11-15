/* v601 🔄 구글 캘린더 맞추기 미리보기의 '＋ 새 현장' — 어느 현장과도 안 맞는 구글 일정에서 그 자리에서 현장을 만들어 잇는다.
   예전에는 고르기 칸이 '현장 없이'+이미 있는 현장뿐이라(반영은 모르는 이름을 버림) 협력사 누수 일감처럼 늘 새 현장인 일정이 현장 없는 일정으로 들어갔고,
   📤 내일 팀 지시·사진 현장 판단에서 빠졌다 — 현장을 따로 만들고 일정마다 열어 다시 이어야 했다. 합성 이름만, 시계 2026-11-10 고정, 바깥 쓰기 0.
   ① 미리보기 — 맞는 현장이 없는 새 일정 줄에만 '＋ 새 현장: 이름'(제목 → 구글 위치)·'＋ 새 현장 (이름 입력)' · 미리 고르지 않음(기본값·체크 예전 그대로) ·
      맞는 현장이 있는 줄·받은 초대·반복 회차에는 없음 · 보관한 현장과 같은 이름이면 선택지 대신 안내 · 계획·미리보기는 읽기만 (PREVIEW)
   ② 반영 — 같은 새 이름 두 줄 → 현장 하나(주소 = 첫 줄의 구글 위치) · 고친 이름으로 · 이름 입력 줄 · 안전판 1회(그때는 아직 안 만듦) · 유형·세대 안 만듦 ·
      결과 창·토스트에 새 현장 · 내일 팀 지시·그날 일정 현장에 들어감 · 다시 읽으면 0줄 (APPLY)
   ③ 이름 규칙 — 있는 현장 이름이면 만들지 않고 잇기만(그 현장 주소는 비어 있어도 그대로) · 비슷한 이름·보관한 같은 이름·짧은 이름은 그 줄만 안 넣고 까닭에 그 현장 이름 ·
      다른 줄은 그대로 반영 · 출입 번호·링크처럼 보이는 위치는 주소로 안 적음 · 첫 줄에 적을 위치가 없으면 다음 줄 위치 · 맞는 현장이 있던 줄·받은 초대는 '__new__' 를 넘겨도 안 만듦 (RULES)
   ④ 가드 — 막힌 줄뿐이면 안전판도 안 만들고 멈춤 · 안전판 실패·오래된 창·일정표 바뀜·직원 모드 → 현장도 일정도 안 생김 (GUARDS)
   ⑤ 폰 390 — 붙여 넣기 → 고르기 → 이름 칸(16px·44px)·주소 줄 → 이름을 실제 키보드로 고침 → 비슷한 이름이면 줄 아래 안내 → 반영 · 넘침 없음 ·
      핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)
   HJ_V601_BASELINE=<commit> 와 HJ_V601_MUTATION=new-preselected(새 현장을 미리 고름)·invite-newsite(받은 초대·반복 회차에도 냄)·
   archived-link(보관한 같은 이름 현장을 '있는 현장'으로 봄 — 안내가 사라지고 반영하면 보관 현장에 이어진다)는 ①, create-before-snapshot(안전판 전에 만듦)은 ②,
   similar-create(비슷한 이름도 만듦)·addr-existing(있던 현장의 빈 주소를 채움)·access-addr(출입 번호 위치도 주소로)·link-addr(링크 위치도 주소로)는 ③,
   no-dead-stop(막힌 줄뿐이어도 안전판을 만들고 지나감)은 ④ 에서 실패해야 한다. */
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
  'new-preselected': ["(r.siteNew?hjNewSiteOptionHtml(r.suggest)+'<option value=\"__new__:\">", "(r.siteNew?hjNewSiteOptionHtml(r.suggest,true)+'<option value=\"__new__:\">"],
  'invite-newsite': ['    const siteNew=!project&&!base.invite&&!base.series;\n', '    const siteNew=!project;\n'],
  'similar-create': ["  return {to:'',fresh:false,why:c.why==='exists'?'archived':c.why,similar:c.similar||[]};\n", "  if(c.why==='similar')return {to:c.name,fresh:true,why:'',similar:[]};\n  return {to:'',fresh:false,why:c.why==='exists'?'archived':c.why,similar:c.similar||[]};\n"],
  'archived-link': ["  if(c.why==='exists'&&(state.projects||[]).some(p=>p&&p.name===c.name&&!p.archived))return {to:c.name,fresh:false,why:'exists',similar:[]};\n  return {to:'',fresh:false,", "  if(c.why==='exists')return {to:c.name,fresh:false,why:'exists',similar:[]};\n  return {to:'',fresh:false,"],
  'addr-existing': ['    if(made.has(t.to)){const p=state.projects.find(q=>q&&q.name===t.to),ad=', '    if(true){const p=state.projects.find(q=>q&&q.name===t.to),ad='],
  'access-addr': ["const t=hjStmtCell(loc).slice(0,120);return t&&!hjLooksLikeAccessCode(t)&&!HJ_CALSYNC_LINK_RE.test(t)?t:'';}", "const t=hjStmtCell(loc).slice(0,120);return t&&!HJ_CALSYNC_LINK_RE.test(t)?t:'';}"],
  'link-addr': ["const t=hjStmtCell(loc).slice(0,120);return t&&!hjLooksLikeAccessCode(t)&&!HJ_CALSYNC_LINK_RE.test(t)?t:'';}", "const t=hjStmtCell(loc).slice(0,120);return t&&!hjLooksLikeAccessCode(t)?t:'';}"],
  'no-dead-stop': ["  if(sel.every(x=>wantsNew(x)&&!hjCalSyncNewTarget(hjNewSiteChoice(x.project)).to))throw new Error(", "  if(false)throw new Error("],
  'create-before-snapshot': ["  let snapped=false;try{snapped=await hjSnapshot('구글 캘린더 맞추기 전',true,true);}catch(e){snapped=false;}\n", "  sel.forEach(x=>{if(wantsNew(x)){const t=hjCalSyncNewTarget(hjNewSiteChoice(x.project));if(t.fresh)ensureProjectExists(t.to);}});\n  let snapped=false;try{snapped=await hjSnapshot('구글 캘린더 맞추기 전',true,true);}catch(e){snapped=false;}\n"]
};
let html = process.env.HJ_V601_BASELINE ? execFileSync('git', ['show', process.env.HJ_V601_BASELINE + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }) : null;
if (process.env.HJ_V601_MUTATION) {
  const m = MUT[process.env.HJ_V601_MUTATION]; assert.ok(m, 'unknown mutation ' + process.env.HJ_V601_MUTATION);
  assert.equal(SRC.split(m[0]).length, 2, 'mutation anchor ' + process.env.HJ_V601_MUTATION); html = SRC.replace(m[0], () => m[1]);
}
// 구글 캘린더 API 일정 모양(합성) — 시각 있는 일정
const T = (id, summary, date, t1, t2, extra) => Object.assign({ kind: 'calendar#event', id, iCalUID: id + '@google.com', status: 'confirmed', summary,
  start: { dateTime: date + 'T' + t1 + ':00+09:00', timeZone: 'Asia/Seoul' }, end: { dateTime: date + 'T' + t2 + ':00+09:00', timeZone: 'Asia/Seoul' }, eventType: 'default' }, extra || {});
const LOC_M1 = '시험시 새벽로 12 모란아파트 303동 704호', LOC_M2 = '시험시 새벽로 12 모란아파트 101동 202호', LOC_D = '시험시 달빛동 55-3';
// ① 미리보기 — 줄마다 다른 경우
const PREVIEW = [
  T('a1', '@우수관 1개', '2026-11-13', '09:00', '11:00', { location: LOC_M1 }),                    // 위치에 단지 → '모란아파트'
  T('b1', '@누수 탐지', '2026-11-13', '14:00', '15:00', { location: LOC_D }),                       // 위치가 주소뿐 → '달빛동 55-3'
  T('c1', '@한빛타워 3층 누수 점검', '2026-11-14', '10:00', '11:00'),                                // 제목에 건물 → '한빛타워'
  T('d1', '@자재 사러 가기', '2026-11-14', '15:00', '16:00'),                                        // 이름 없음 → 이름 입력만
  T('e1', '@도배', '2026-11-16', '09:00', '17:00', { location: '시험시 가온로 1 가온아파트 101동 202호' }),   // 맞는 현장 있음 → 예전 그대로
  T('f1', '달빛아파트 반상회', '2026-11-17', '10:00', '11:00', { organizer: { email: 'other@example.com' }, attendees: [{ self: true, responseStatus: 'needsAction' }] }),   // 받은 초대
  T('g1', '@새벽아파트 청소', '2026-11-18', '09:00', '10:00', { recurringEventId: 'rr1' }),          // 반복 회차
  T('h1', '@옛빌라 누수 확인', '2026-11-19', '09:00', '10:00')                                       // 보관한 현장과 같은 이름
];
// ② 반영 — 같은 단지 두 세대(v600: 따로 줄) + 주소뿐인 일정 + 이름 없는 일정 + 맞는 현장 있는 일정
const APPLY = [PREVIEW[0], T('a2', '@우수관 1개', '2026-11-13', '13:00', '14:00', { location: LOC_M2 }), T('b1', '@누수 탐지', '2026-11-13', '15:00', '16:00', { location: LOC_D }), PREVIEW[3], PREVIEW[4]];
// ③ 이름 규칙 — 줄마다 이름을 손으로 넘긴다
const RULES = [
  T('r1', '@배관 점검', '2026-11-13', '09:00', '10:00', { location: '시험시 은하로 7' }),            // → 있는 현장 이름(나래마을아파트, 주소 빈 현장)
  T('r2', '@방수 확인', '2026-11-13', '10:00', '11:00', { location: '시험시 은하로 8' }),            // → 비슷한 이름
  T('r3', '@타일 보수', '2026-11-13', '11:00', '12:00'),                                             // → 보관한 같은 이름
  T('r4', '@실리콘', '2026-11-13', '12:00', '13:00'),                                                // → 짧은 이름
  T('r5', '@누수 탐지', '2026-11-13', '13:00', '14:00', { location: '공동현관 비번 1234' }),          // → 새 현장, 위치가 출입 번호
  T('r6', '@샤시 점검', '2026-11-13', '14:00', '15:00', { location: 'https://meet.example.com/abc-defg' }),   // → 새 현장(위치가 링크 — 주소 아님) …
  T('r7', '@샤시 실측', '2026-11-13', '15:00', '16:00', { location: '시험시 솔밭로 9' }),            //   … 같은 새 현장, 다음 줄 위치
  T('r8', '@도배', '2026-11-16', '09:00', '17:00', { location: '시험시 가온로 1 가온아파트 101동 202호' }),   // 맞는 현장 있음 — '__new__' 를 넘겨도 예전 그대로
  T('r9', '달빛아파트 반상회', '2026-11-17', '10:00', '11:00', { organizer: { email: 'other@example.com' }, attendees: [{ self: true, responseStatus: 'needsAction' }] })
];
// ⑤ 폰 — 화면 글 두 줄
const TEXT2 = ['오전 9시~오전 11시, @우수관 1개, 홍길동, 위치: 새벽로 12 모란아파트 303동 704호, 2026년 11월 13일', '오후 2시~오후 3시, @누수 탐지, 홍길동, 위치: 시험시 달빛동 55-3, 2026년 11월 13일'].join('\n');

let browser, passed = 0;
const errors = [], network = { writes: 0 };
async function test(name, fn) { await fn(); passed++; console.log('PASS calnewsite-v601 ' + name); }
async function open(width, mobile) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', timezoneId: 'Asia/Seoul', hasTouch: !!mobile });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') return dialog.accept(); errors.push('dialog:' + dialog.type() + ':' + dialog.message().slice(0, 60)); dialog.dismiss(); });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), read = ['GET', 'HEAD'].includes(request.method());
    if (url.origin === ORIGIN && read) { if (html && url.pathname === new URL(APP).pathname) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); return route.continue(); }
    if (!read) network.writes++;
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => { localStorage.setItem('hj_onboard_done', '1'); localStorage.setItem('hj_gcal_auto', '0'); localStorage.setItem('hj_ver_checked_at', String(Date.now())); localStorage.setItem('hj_last_backup', JSON.stringify({ at: Date.now(), kind: 'test' })); });
  await page.clock.setFixedTime(new Date('2026-11-10T10:00:00+09:00'));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(keys => typeof serializeData === 'function' && keys.every(key => !!window[key]), BOOT);
  await page.evaluate(async ({ keys, mobile }) => {
    await Promise.all(keys.map(key => window[key])); clearTimeout(__idbSaveTimer); await __appStateWriteQueue;
    taxCalendarEnsure = () => 0; coworkSchedEnsure = () => 0; backupBootCheck = () => 0; kakaoCheckNew = () => 0;
    __autoSaveOn = false; __gdToken = null; relayReady = () => false; aiOpsEnsureState().enabled = false; window.__geminiKey = '';
    __mobileMode = !!mobile; applyMobileMode();
    // 맞추기 안전판 호출을 적어 둔다 — 그 순간의 현장 수도(만들기는 안전판 뒤여야 한다). 반영 뒤 markDirty 가 찍는 '작업 중' 자동 안전판은 세지 않는다
    window.__proj = () => state.projects.map(p => [p.name, p.stage, (p.customer || {}).addr || '', !!p.archived, p.kind === undefined ? '-' : p.kind, Array.isArray(p.aptUnits) ? p.aptUnits.length : '-']);
    window.__snaps = []; const o = hjSnapshot; hjSnapshot = async (...a) => { if (a[0] === '구글 캘린더 맞추기 전') window.__snaps.push([a[0], (state.projects || []).length]); if (window.__snapFail) return false; return o(...a); };
  }, { keys: BOOT, mobile: !!mobile });
  return { context, page };
}
// 합성 현장: 진행 둘(주소 있는 곳·주소 빈 곳) + 보관 하나. 일정표는 비움.
const SEED = () => {
  closeModal(true);
  const P = (name, addr, extra) => Object.assign({ name, stage: 2, received: 0, phases: [], cost: { material: 0, labor: 0, outsource: 0 }, customer: { name: '', phone: '', addr: addr || '' }, archived: false }, extra || {});
  state.projects = [P('가온아파트', '시험시 가온로 1'), P('나래마을아파트', ''), P('옛빌라', '시험시 옛길 3', { stage: 3, archived: true })];
  state.quotes = []; state.notes = []; state.payLog = []; state.expenses = []; state.contacts = []; state._demo = false; state.dirHandle = null; state.goals = {}; __tabStale = false;
  state.files = [{ id: 'PH1', name: 'IMG_1.jpg', ext: 'jpg', kind: 'photo', project: '가온아파트', prefix: '현장사진/', size: 1001, when: new Date('2026-11-01T10:00:00+09:00') },
    { id: 'PH2', name: 'IMG_2.jpg', ext: 'jpg', kind: 'photo', project: '나래마을아파트', prefix: '현장사진/', size: 1002, when: new Date('2026-11-02T10:00:00+09:00') }];
  state.schedule = []; state.activeProject = null; state.tab = 'schedule'; state.search = '';
  window.__snaps = []; window.__snapFail = false;
  render();
};

(async () => {
  browser = await chromium.launch();
  try {
    const { context, page } = await open(1280);
    await test('① 미리보기 — 맞는 현장 없는 새 일정 줄에만 \'＋ 새 현장\'(제목 → 구글 위치)·이름 입력 · 미리 고르지 않음 · 초대·반복·맞는 현장 줄엔 없음 · 읽기만 (PREVIEW)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(items => {
        const before = JSON.stringify(serializeData()), P = hjCalSyncPlan(hjCalApiEvents(items));
        hjCalSyncView(); hjCalSyncRender(P);
        const box = document.getElementById('csBody');
        const rows = P.rows.map((x, i) => { const s = box.querySelector('.csSel[data-i="' + i + '"]'), nb = box.querySelector('.csNewBox[data-i="' + i + '"]'), sim = box.querySelector('[data-cs-sim="' + i + '"]');
          return { t: x.title, st: x.status, chk: x.check, proj: x.project, siteNew: x.siteNew, suggest: x.suggest, val: s ? s.value : null,
            news: s ? [...s.options].filter(o => o.value.indexOf('__new__:') === 0).map(o => [o.value, o.textContent, o.selected]) : null,
            box: nb ? [nb.getClientRects().length, nb.querySelector('.csNew').value] : null, sim: sim ? sim.textContent : '' }; });
        const out = { rows, hint: !!box.querySelector('[data-cs-newsite-hint]'), readonly: before === JSON.stringify(serializeData()), projects: state.projects.length };
        closeModal(true); return out;
      }, PREVIEW);
      const by = Object.fromEntries(r.rows.map(x => [x.t, x]));
      assert.deepEqual(r.rows.map(x => [x.t, x.st, x.chk, x.proj, x.siteNew, x.suggest]), [
        ['우수관 1개', 'new', true, '', true, '모란아파트'],
        ['누수 탐지', 'new', true, '', true, '달빛동 55-3'],
        ['한빛타워 3층 누수 점검', 'new', true, '', true, '한빛타워'],
        ['자재 사러 가기', 'new', true, '', true, ''],
        ['도배', 'new', true, '가온아파트', false, ''],
        ['달빛아파트 반상회', 'new', false, '', false, ''],
        ['새벽아파트 청소', 'new', false, '', false, ''],
        ['옛빌라 누수 확인', 'new', true, '', true, '옛빌라']], '줄마다 새 현장을 낼지·제안 이름 — ' + JSON.stringify(r.rows.map(x => [x.t, x.st, x.chk, x.proj, x.siteNew, x.suggest])));
      assert.deepEqual(by['우수관 1개'].news, [['__new__:모란아파트', '＋ 새 현장: 모란아파트', false], ['__new__:', '＋ 새 현장 (이름 입력)', false]], '단지 이름 제안 + 이름 입력 — ' + JSON.stringify(by['우수관 1개'].news));
      assert.deepEqual(by['누수 탐지'].news.map(x => x[0]), ['__new__:달빛동 55-3', '__new__:'], '주소 꼴 제안');
      assert.deepEqual(by['한빛타워 3층 누수 점검'].news.map(x => x[0]), ['__new__:한빛타워', '__new__:'], '제목의 건물 이름');
      assert.deepEqual(by['자재 사러 가기'].news.map(x => x[0]), ['__new__:'], '이름을 못 읽으면 이름 입력만');
      assert.deepEqual([by['도배'].news, by['도배'].box, by['도배'].val], [[], null, '가온아파트'], '맞는 현장이 있는 줄은 예전 그대로 — ' + JSON.stringify(by['도배']));
      assert.deepEqual([by['달빛아파트 반상회'].news, by['달빛아파트 반상회'].box, by['새벽아파트 청소'].news, by['새벽아파트 청소'].box], [[], null, [], null], '받은 초대·반복 회차에는 내지 않음');
      assert.deepEqual(by['옛빌라 누수 확인'].news.map(x => x[0]), ['__new__:'], '보관한 현장과 같은 이름은 선택지로 내지 않음');
      assert.ok(by['옛빌라 누수 확인'].sim.includes('옛빌라') && by['옛빌라 누수 확인'].sim.includes('보관'), '대신 그 현장 이름을 알려 줌 — ' + by['옛빌라 누수 확인'].sim);
      // 미리 고르지 않는다 — 기본값은 예전 그대로('현장 없이' 또는 추천 현장), 이름 칸은 숨김
      assert.deepEqual(r.rows.filter(x => x.siteNew).map(x => [x.val, x.news.some(o => o[2]), x.box[0]]), [['', false, 0], ['', false, 0], ['', false, 0], ['', false, 0], ['', false, 0]], '새 현장은 미리 골라지지 않고 이름 칸도 숨김 — ' + JSON.stringify(r.rows.map(x => [x.val, x.box])));
      assert.deepEqual(r.rows.filter(x => x.siteNew).map(x => x.box[1]), ['모란아파트', '달빛동 55-3', '한빛타워', '', ''], '이름 칸에는 제안 이름(만들 수 있을 때만)');
      assert.ok(r.hint && r.readonly && r.projects === 3, '안내 줄 · 계획·미리보기는 읽기만(현장 3곳 그대로) — ' + JSON.stringify([r.hint, r.readonly, r.projects]));
    });

    await test('② 반영 — 같은 새 이름 두 줄 → 현장 하나(주소 = 첫 줄 위치) · 고친 이름 · 이름 입력 · 안전판 1회(만들기 전) · 결과 창·토스트 · 팀 지시·그날 일정 현장 · 다시 읽으면 0줄 (APPLY)', async () => {
      await page.evaluate(SEED);
      await page.evaluate(items => { window.__P = hjCalSyncPlan(hjCalApiEvents(items)); hjCalSyncView(); hjCalSyncRender(window.__P); }, APPLY);
      const idx = await page.evaluate(() => window.__P.rows.map(x => [x.title, x.time]));
      assert.deepEqual(idx, [['우수관 1개', '09:00'], ['우수관 1개', '13:00'], ['누수 탐지', '15:00'], ['자재 사러 가기', '15:00'], ['도배', '09:00']], '줄 차례 — ' + JSON.stringify(idx));
      await page.selectOption('#csBody .csSel[data-i="0"]', '__new__:모란아파트');
      await page.selectOption('#csBody .csSel[data-i="1"]', '__new__:모란아파트');
      await page.selectOption('#csBody .csSel[data-i="2"]', '__new__:달빛동 55-3');
      await page.fill('#csBody .csNew[data-i="2"]', '달빛동 주택');                 // 제안 이름을 고침
      await page.selectOption('#csBody .csSel[data-i="3"]', '__new__:');
      await page.fill('#csBody .csNew[data-i="3"]', '한빛상가 2층');                // 이름 입력
      const v = await page.evaluate(() => { const box = document.getElementById('csBody');
        return [0, 1, 2, 3].map(i => { const nb = box.querySelector('.csNewBox[data-i="' + i + '"]'); return [nb.getClientRects().length > 0, nb.querySelector('.csNew').value, nb.querySelector('.csNewMsg').dataset.state, nb.querySelector('.csNewAddr').textContent]; }); });
      assert.deepEqual(v, [
        [true, '모란아파트', 'new', '📍 현장 주소로 저장: 시험시 새벽로 12 모란아파트 303동 704호'],
        [true, '모란아파트', 'join', '📍 현장 주소로 저장: 시험시 새벽로 12 모란아파트 303동 704호'],
        [true, '달빛동 주택', 'new', '📍 현장 주소로 저장: 시험시 달빛동 55-3'],
        [true, '한빛상가 2층', 'new', '구글 위치가 없어 현장 주소는 비워 둡니다']], '고르면 이름 칸·무엇이 되는지·적을 주소 — ' + JSON.stringify(v));
      // 첫 줄의 체크를 풀면 둘째 줄이 만드는 줄이 된다(주소도 둘째 줄 위치) — 체크 안 한 줄은 '체크해야 반영'
      await page.uncheck('#csBody .csChk[data-i="0"]');
      const u = await page.evaluate(() => [0, 1].map(i => { const nb = document.querySelector('#csBody .csNewBox[data-i="' + i + '"]'), msg = nb.querySelector('.csNewMsg'); return [msg.dataset.state, msg.textContent.includes('체크해야 반영'), nb.querySelector('.csNewAddr').textContent]; }));
      assert.deepEqual(u, [['new', true, '📍 현장 주소로 저장: 시험시 새벽로 12 모란아파트 303동 704호'], ['new', false, '📍 현장 주소로 저장: 시험시 새벽로 12 모란아파트 101동 202호']], '체크를 풀면 다음 줄이 만드는 줄 — ' + JSON.stringify(u));
      await page.check('#csBody .csChk[data-i="0"]');
      await page.click('#csApply');
      await page.waitForSelector('#modalRoot #hjCalSyncDone');
      const r = await page.evaluate(items => {
        const done = document.getElementById('hjCalSyncDone'), out = { proj: window.__proj(), snaps: window.__snaps, toast: document.getElementById('toast').textContent,
          newsite: (done.querySelector('[data-csd-newsite]') || {}).textContent || '', blocked: !!done.querySelector('[data-csd-blocked]'), groups: [...done.querySelectorAll('[data-csd-group]')].map(g => [g.dataset.csdGroup, g.querySelectorAll('[data-csd-row]').length]),
          sch: state.schedule.map(s => [s.date, s.time, s.title, s.project]).sort((a, b) => (a[0] + a[1] + a[3]).localeCompare(b[0] + b[1] + b[3])) };
        closeModal(true);
        out.wo = hjWoDaySchedules('2026-11-13').map(s => [s.time, s.project]); out.place = hjPlaceSchedNames('2026-11-13');
        const P2 = hjCalSyncPlan(hjCalApiEvents(items)); out.again = [P2.rows.length, P2.stats.same];
        return out;
      }, APPLY);
      assert.deepEqual(r.snaps, [['구글 캘린더 맞추기 전', 3]], '안전판 1회 — 그때는 아직 현장 3곳(만들기는 안전판 뒤) — ' + JSON.stringify(r.snaps));
      assert.deepEqual(r.proj, [['가온아파트', 2, '시험시 가온로 1', false, '-', '-'], ['나래마을아파트', 2, '', false, '-', '-'], ['옛빌라', 3, '시험시 옛길 3', true, '-', '-'],
        ['모란아파트', 0, LOC_M1, false, '-', '-'], ['달빛동 주택', 0, LOC_D, false, '-', '-'], ['한빛상가 2층', 0, '', false, '-', '-']], '현장 셋만 새로(같은 이름 두 줄 = 하나) · 단계 0 · 주소 = 구글 위치 · 유형·세대 없음 · 있던 현장 그대로 — ' + JSON.stringify(r.proj));
      assert.deepEqual(r.sch, [['2026-11-13', '09:00', '우수관 1개', '모란아파트'], ['2026-11-13', '13:00', '우수관 1개', '모란아파트'], ['2026-11-13', '15:00', '누수 탐지', '달빛동 주택'], ['2026-11-14', '15:00', '자재 사러 가기', '한빛상가 2층'], ['2026-11-16', '09:00', '도배', '가온아파트']], '일정마다 제 현장 — ' + JSON.stringify(r.sch));
      assert.ok(r.newsite.includes('새 현장 3곳') && r.newsite.includes('모란아파트') && r.newsite.includes('달빛동 주택') && r.newsite.includes('한빛상가 2층') && !r.blocked, '결과 창에 새 현장 — ' + r.newsite);
      assert.ok(r.toast.includes('추가 5') && r.toast.includes('새 현장 3곳'), '토스트 — ' + r.toast);
      assert.deepEqual(r.groups.map(g => g[0]).sort(), ['가온아파트', '달빛동 주택', '모란아파트', '한빛상가 2층'].sort(), '결과 창 현장 묶음 — ' + JSON.stringify(r.groups));
      assert.deepEqual([r.wo, r.place], [[['09:00', '모란아파트'], ['13:00', '모란아파트'], ['15:00', '달빛동 주택']], ['모란아파트', '달빛동 주택']], '내일 팀 지시·그날 일정 현장에 들어감 — ' + JSON.stringify([r.wo, r.place]));
      assert.deepEqual(r.again, [0, 5], '다시 읽으면 바꿀 것 없음 — ' + JSON.stringify(r.again));
      // 고르지 않으면 예전 그대로 — 현장은 안 생기고 '현장 없이'로 들어간다
      await page.evaluate(SEED);
      const old = await page.evaluate(async items => { const P = hjCalSyncPlan(hjCalApiEvents(items)); hjCalSyncView(); hjCalSyncRender(P); document.getElementById('csApply').click();
        for (let i = 0; i < 200 && document.getElementById('hjCalSync'); i++) await new Promise(r => setTimeout(r, 25));
        const o = { n: state.projects.length, sch: state.schedule.map(s => s.project), newsite: !!document.querySelector('[data-csd-newsite]') }; closeModal(true); return o; }, APPLY);
      assert.deepEqual(old, { n: 3, sch: ['', '', '', '', '가온아파트'], newsite: false }, '고르지 않으면 현장 안 생김 — ' + JSON.stringify(old));
    });

    await test('③ 이름 규칙 — 있는 현장이면 잇기만(빈 주소도 그대로) · 비슷한·보관한 같은·짧은 이름은 그 줄만 안 넣고 까닭에 그 현장 이름 · 출입 번호 위치 · 다음 줄 위치 · 초대·맞는 현장 줄 (RULES)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(async items => {
        const P = hjCalSyncPlan(hjCalApiEvents(items)), at = t => P.rows.findIndex(x => x.title === t);
        const picks = [[at('배관 점검'), '__new__:나래마을아파트'], [at('방수 확인'), '__new__:나래마을 아파트 2단지'], [at('타일 보수'), '__new__:옛빌라'], [at('실리콘'), '__new__:가'],
          [at('누수 탐지'), '__new__:은하빌라'], [at('샤시 점검'), '__new__:솔밭주택'], [at('샤시 실측'), '__new__:솔밭주택'], [at('도배'), '__new__:엉뚱한집'], [at('달빛아파트 반상회'), '__new__:달빛아파트']].map(([i, project]) => ({ i, project }));
        const tg = n => { const t = hjCalSyncNewTarget(n); return [t.to, t.fresh, t.why, t.similar]; };
        const out = { target: { ex: tg('나래마을아파트'), sim: tg('나래마을 아파트 2단지'), arch: tg('옛빌라'), short: tg('가'), ok: tg('은하빌라') } };
        const res = await hjCalSyncApply(P, picks);
        out.res = { added: res.added, np: res.newProjects, blocked: res.blocked.map(b => [b.title, b.name, b.why, b.similar]) };
        out.proj = window.__proj(); out.snaps = window.__snaps;
        out.sch = state.schedule.map(s => [s.time, s.title, s.project]).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
        const done = hjCalSyncDone(res), el = document.getElementById('hjCalSyncDone'); out.doneBlocked = el ? (el.querySelector('[data-csd-blocked]') || {}).textContent || '' : ''; out.done = !!done; closeModal(true);
        return out;
      }, RULES);
      assert.deepEqual(r.target.ex, ['나래마을아파트', false, 'exists', []], '있는 현장 이름 → 잇기만 — ' + JSON.stringify(r.target.ex));
      assert.deepEqual([r.target.sim[0], r.target.sim[2], r.target.sim[3]], ['', 'similar', ['나래마을아파트']], '비슷한 이름 → 막힘 + 그 현장 이름 — ' + JSON.stringify(r.target.sim));
      assert.deepEqual(r.target.arch, ['', false, 'archived', ['옛빌라']], '보관한 같은 이름 → 막힘 — ' + JSON.stringify(r.target.arch));
      assert.deepEqual([r.target.short, r.target.ok], [['', false, 'short', []], ['은하빌라', true, '', []]], '짧은 이름 막힘 · 새 이름 통과 — ' + JSON.stringify([r.target.short, r.target.ok]));
      assert.deepEqual(r.res.blocked, [['방수 확인', '나래마을 아파트 2단지', 'similar', ['나래마을아파트']], ['타일 보수', '옛빌라', 'archived', ['옛빌라']], ['실리콘', '가', 'short', []]], '막힌 줄 셋(까닭·비슷한 현장) — ' + JSON.stringify(r.res.blocked));
      assert.deepEqual([r.res.added, r.res.np], [6, ['은하빌라', '솔밭주택']], '다른 줄은 그대로 반영 · 새 현장 둘 — ' + JSON.stringify(r.res));
      assert.deepEqual(r.proj, [['가온아파트', 2, '시험시 가온로 1', false, '-', '-'], ['나래마을아파트', 2, '', false, '-', '-'], ['옛빌라', 3, '시험시 옛길 3', true, '-', '-'],
        ['은하빌라', 0, '', false, '-', '-'], ['솔밭주택', 0, '시험시 솔밭로 9', false, '-', '-']],
        '있던 현장의 주소는 비어 있어도 그대로 · 출입 번호·링크 위치는 주소로 안 적음 · 첫 줄에 적을 위치가 없으면 다음 줄 위치 · 엉뚱한집·달빛아파트·보관 현장 쌍둥이는 안 생김 — ' + JSON.stringify(r.proj));
      assert.deepEqual(r.sch, [['09:00', '도배', ''], ['09:00', '배관 점검', '나래마을아파트'], ['10:00', '달빛아파트 반상회', ''], ['13:00', '누수 탐지', '은하빌라'], ['14:00', '샤시 점검', '솔밭주택'], ['15:00', '샤시 실측', '솔밭주택']],
        "막힌 줄은 일정도 안 들어감 · '＋ 새 현장'을 내지 않은 줄(맞는 현장이 있던 줄·받은 초대)은 '__new__' 를 넘겨도 모르는 이름처럼 버린다(현장 없이) — " + JSON.stringify(r.sch));
      assert.deepEqual(r.snaps, [['구글 캘린더 맞추기 전', 3]], '안전판 1회');
      assert.ok(r.done && r.doneBlocked.includes('넣지 않은 일정 3건') && r.doneBlocked.includes('나래마을아파트') && r.doneBlocked.includes('옛빌라(보관)'), '결과 창에 넣지 않은 줄과 그 현장 이름 — ' + r.doneBlocked);
    });

    await test('④ 가드 — 막힌 줄뿐이면 안전판도 안 만들고 멈춤 · 안전판 실패·오래된 창·일정표 바뀜·직원 모드 → 현장도 일정도 안 생김 (GUARDS)', async () => {
      await page.evaluate(SEED);
      const r = await page.evaluate(async items => {
        const out = {}, st = () => [state.projects.length, state.schedule.length, window.__snaps.length];
        const run = async (name, project, pre, post) => { const P = hjCalSyncPlan(hjCalApiEvents(items)); if (pre) pre(); let err = '';
          try { await hjCalSyncApply(P, [{ i: 0, project }, { i: 1, project }].slice(0, name === 'dead' ? 2 : 1)); } catch (e) { err = String(e && e.message || e); }
          if (post) post(); out[name] = [err, st()]; window.__snaps = []; };
        await run('dead', '__new__:옛빌라');                                                         // 막힌 줄뿐
        await run('snap', '__new__:모란아파트', () => { window.__snapFail = true; }, () => { window.__snapFail = false; });
        await run('stale', '__new__:모란아파트', () => { __tabStale = true; }, () => { __tabStale = false; });
        await run('stamp', '__new__:모란아파트', () => { state.schedule.push({ id: 'zz', date: '2026-11-20', time: '09:00', title: '끼어든 일정', project: '' }); }, () => { state.schedule.pop(); });
        await run('staff', '__new__:모란아파트', () => { localStorage.setItem(HJ_STAFF_KEY, 'staff'); }, () => { localStorage.removeItem(HJ_STAFF_KEY); });
        return out;
      }, PREVIEW);
      assert.ok(r.dead[0].includes('새 현장 이름을 확인') && r.dead[0].includes('옛빌라'), '막힌 줄뿐 — 까닭에 그 현장 이름: ' + r.dead[0]);
      assert.deepEqual(r.dead[1], [3, 0, 0], '안전판도 안 만듦 — ' + JSON.stringify(r.dead));
      assert.ok(r.snap[0].includes('안전판을 만들지 못해'), r.snap[0]);
      assert.deepEqual(r.snap[1], [3, 0, 1], '안전판 실패 — 현장·일정 그대로 — ' + JSON.stringify(r.snap));
      assert.ok(r.stale[0].includes('오래된 창') && r.stamp[0].includes('일정표가 바뀌었어요') && r.staff[0].includes('직원 모드'), JSON.stringify([r.stale[0], r.stamp[0], r.staff[0]]));
      assert.deepEqual([r.stale[1], r.stamp[1], r.staff[1]], [[3, 0, 0], [3, 0, 0], [3, 0, 0]], '오래된 창·일정표 바뀜·직원 모드 — 현장 안 생김 — ' + JSON.stringify([r.stale, r.stamp, r.staff]));
    });
    await context.close();

    await test('⑤ 폰 390 — 붙여 넣기 → 고르기 → 이름 칸(16px·44px)·주소 줄 → 키보드로 고침 → 비슷한 이름 안내 → 반영 · 넘침 없음 · 핀 3곳 같음 · 페이지 오류 0 · 바깥 쓰기 0 (PHONE)', async () => {
      const m = await open(390, true);
      await m.page.evaluate(SEED);
      await m.page.evaluate(t => { hjCalSyncView(); document.getElementById('csText').value = t; document.getElementById('csRead').click(); }, TEXT2);
      await m.page.waitForSelector('#csBody [data-cs-row]');
      const before = await m.page.evaluate(() => [...document.querySelectorAll('#csBody .csSel')].map(s => [s.value, [...s.options].filter(o => o.value.indexOf('__new__:') === 0).map(o => o.textContent), document.querySelector('#csBody .csNewBox[data-i="' + s.dataset.i + '"]').getClientRects().length]));
      assert.deepEqual(before, [['', ['＋ 새 현장: 모란아파트', '＋ 새 현장 (이름 입력)'], 0], ['', ['＋ 새 현장: 달빛동 55-3', '＋ 새 현장 (이름 입력)'], 0]], '화면 글도 같은 선택지 · 미리 안 고름 — ' + JSON.stringify(before));
      await m.page.selectOption('#csBody .csSel[data-i="0"]', '__new__:모란아파트');
      await m.page.selectOption('#csBody .csSel[data-i="1"]', '__new__:달빛동 55-3');
      // 이름을 실제 키보드로 — 있는 현장과 비슷한 이름이면 줄 아래에 그 현장 이름
      await m.page.click('#csBody .csNew[data-i="1"]'); await m.page.keyboard.press('Control+A'); await m.page.keyboard.type('나래마을 아파트');
      const mid = await m.page.evaluate(() => { const nb = document.querySelector('#csBody .csNewBox[data-i="1"]'), msg = nb.querySelector('.csNewMsg'); return [msg.dataset.state, msg.textContent, nb.querySelector('.csNew').getAttribute('aria-invalid'), nb.querySelector('.csNewAddr').getClientRects().length]; });
      assert.ok(mid[0] === 'similar' && mid[1].includes('비슷한 현장: 나래마을아파트') && mid[1].includes('이 줄은 넣지 않아요') && mid[2] === 'true' && mid[3] === 0, '비슷한 이름 — 줄 아래 안내 — ' + JSON.stringify(mid));
      await m.page.keyboard.press('Control+A'); await m.page.keyboard.type('달빛동 단독주택');
      const v = await m.page.evaluate(() => { const root = document.querySelector('#modalRoot .modal');
        const small = [...root.querySelectorAll('#hjCalSync button,#hjCalSync select,#hjCalSync label,#hjCalSync input.csNew,.mfoot button')].filter(b => b.getClientRects().length).map(b => [b.tagName, Math.round(b.getBoundingClientRect().height * 10) / 10]).filter(x => x[1] < 43.9);
        const wide = [...root.querySelectorAll('#hjCalSync *')].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 1).length;
        return { st: [...root.querySelectorAll('.csNewMsg')].map(x => x.dataset.state), addr: [...root.querySelectorAll('.csNewAddr')].map(x => x.textContent), vis: [...root.querySelectorAll('.csNewBox')].map(x => x.getClientRects().length > 0),
          fonts: [...root.querySelectorAll('#csBody select,#csBody input.csNew')].map(s => parseFloat(getComputedStyle(s).fontSize)), small, wide, over: document.documentElement.scrollWidth - innerWidth, chk: [...root.querySelectorAll('.csChk')].map(c => c.checked) }; });
      assert.deepEqual([v.st, v.vis, v.chk], [['new', 'new'], [true, true], [true, true]], '두 줄 다 새 현장(체크는 예전 그대로) — ' + JSON.stringify(v));
      assert.deepEqual(v.addr, ['📍 현장 주소로 저장: 새벽로 12 모란아파트 303동 704호', '📍 현장 주소로 저장: 시험시 달빛동 55-3'], '적을 주소가 줄에 보임 — ' + JSON.stringify(v.addr));
      assert.ok(v.wide === 0 && v.over <= 1 && v.fonts.length === 4 && v.fonts.every(f => f >= 16), '넘침 없음 · 고르기·이름 칸 16px — ' + JSON.stringify([v.wide, v.over, v.fonts]));
      assert.deepEqual(v.small, [], '44px 미만 — ' + JSON.stringify(v.small));
      await m.page.click('#csApply');
      await m.page.waitForSelector('#modalRoot #hjCalSyncDone');
      const done = await m.page.evaluate(() => { const el = document.getElementById('hjCalSyncDone'), wide = [...el.querySelectorAll('*')].filter(x => x.getClientRects().length && x.getBoundingClientRect().right > innerWidth + 1).length;
        const o = { newsite: el.querySelector('[data-csd-newsite]').textContent, wide, over: document.documentElement.scrollWidth - innerWidth, snaps: window.__snaps,
          proj: state.projects.slice(3).map(p => [p.name, p.customer.addr, p.stage]), sch: state.schedule.map(s => [s.time, s.project]).sort() }; closeModal(true); return o; });
      assert.ok(done.newsite.includes('새 현장 2곳') && done.newsite.includes('모란아파트') && done.newsite.includes('달빛동 단독주택') && done.wide === 0 && done.over <= 1, '결과 창 — ' + JSON.stringify(done));
      assert.deepEqual([done.proj, done.sch, done.snaps], [[['모란아파트', '새벽로 12 모란아파트 303동 704호', 0], ['달빛동 단독주택', '시험시 달빛동 55-3', 0]], [['09:00', '모란아파트'], ['14:00', '달빛동 단독주택']], [['구글 캘린더 맞추기 전', 3]]], '고친 이름으로 만들고 이음 · 안전판 1회 — ' + JSON.stringify(done));
      await m.context.close();
      if (!html) {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), vs = fs.readFileSync(path.join(ROOT, 'tests', 'version-sync.check.js'), 'utf8');
        const a = (SRC.match(/const APP_BUILD='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], b = (sw.match(/const C='(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1], c = (vs.match(/TARGET_BUILD = '(hyeonjang-v\d+-[a-z0-9-]+)'/) || [])[1];
        assert.ok(a && a === b && b === c, '핀 3곳 같음 ' + [a, b, c].join(' / '));
      }
      assert.deepEqual(errors, [], '페이지 오류 0');
      assert.equal(network.writes, 0, '바깥 쓰기 0');
    });
    console.log(`calnewsite-v601: ${passed}/5 PASS; synthetic data · fixed clock; external writes=${network.writes}`);
  } catch (error) {
    console.error('FAIL calnewsite-v601 ' + (error && error.stack || error));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
